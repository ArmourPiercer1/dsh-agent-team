# Alpha.5 P0 — 独立源码锚定：S-01..S-12 静态核验 source map

- **角色**：独立源码锚定代理（非协调者）。只读核验 + 本证据文件写入；未修改任何源文件，未执行任何 git 写操作。
- **日期（UTC）**：2026-10-15T21:31:17Z（`date -u` 实测）
- **shell pwd**：`/srv/workspace/dsh-plugins/dsh-agent-team`（会话工作区；全部被检文件以绝对路径寻址，位于 W 下）
- **指导来源**：`docs/plans/memo/alpha5-tool-io-governance/P0-independent-adapter-poc-implementation-guide.md` §0.1（先读，S 清单原文第 27–40 行）
- **模型名逐字回报**：系统提示 powered-by 原文为 "You are a coding agent powered by the qwen3.8-flash-next model."（模型名 `qwen3.8-flash-next`）

## 0. 基线验证（git 原文）

```
$ git -C T rev-parse HEAD          # T = W/tests/deepseek-harness-test-use
639ed015397290b3745d163aafe02ffee4aa3f84
$ git -C T status -sb | head -3
## HEAD (no branch)
$ git -C W rev-parse HEAD          # W = .worktrees/exp-alpha5-poc-20261016 (Team 树)
d3c9760d8f8ea2a2bfac4fd628133261b127f756
```

- **T（pinned DSH）= `639ed015397290b3745d163aafe02ffee4aa3f84`，detached（no branch）** —— 与指导 §头部 "目标宿主 DSH 0.2.0-rc.2 @ 639ed015…" 完全一致。✔
- **Team 树 HEAD = `d3c9760d8f8ea2a2bfac4fd628133261b127f756`**（S-12 在此树）。
- 下文所有路径相对 `T/`（DSH 树）或写明 Team 树全路径。所有行号均为本代理实际读取所见。

## 1. 逐条核验

### S-01 — Preset 绑定 `bindScopeParent(agentKey, presetKey)` — **CONFIRMED**

实际位置：`packages/preset/agent-preset-registry/src/index.ts:241-244`（调用点；指导所述签名参数名为语义名，实参为 `key, generation.key`，语义等：agent 作用域键 → preset 代际作用域键）。定义在 `packages/core/scope/src/index.ts:72`。

```ts
// agent-preset-registry/src/index.ts
241:   private join(ctx: Context, key: ScopeKey, generation: Generation): void {
242:     const binding = { parent: bindScopeParent(key, generation.key), generation }
// core/scope/src/index.ts
72: export function bindScopeParent(key: ScopeKey, parent: ScopeKey): ScopeParentBinding {
73:   if (scopeParents.has(key)) {
74:     throw new Error('dsh-scope: scope key is already bound to a parent; …')
```

判定理由：agent 作用域被绑定为 preset 代际作用域的**子级**（父链），故 S-02 的 `view()` 层链遍历使 Preset 注册的工具对 agent 继承可见；且 `bind()`（同文件 231-238 行）经 `binding.parent.rebind(generation.key)` 支持热换父代际——"不等于热卸载绝无竞态"的告诫与 `rebind` 重链窗口（scope/index.ts:79-82 `rebind(next)`）静态一致。

### S-02 — `ToolRuntime.view` / `tools.register` / `tools.restrict`：遮蔽与"限制不隐藏本 Scope 自注册" — **CONFIRMED**

实际位置：`packages/core/tools/src/index.ts`；register=1063-1088，restrict=1097-1124，view=1178-1219。**确切实现分支**（restrict 不过滤本 Scope 注册）：

```ts
1184:    const own = this.layers.peek(scope)          // 本 Scope 独占层（chain-blind）
1189:      if (layer === own) continue                // 继承面构建时跳过 own 层
1195:    for (const [name, definition] of inherited) {
1200:      if (layers.every(layer => layer.admits(name))) visible.set(name, definition)  // 限制只作用于继承面
1204:    if (own !== undefined) {
1207:        visible.set(name, definition)             // own 注册最后无条件可见（遮蔽同名继承）
```

register 文档（1058-1059）："Register globally or in the calling agent scope. **Scoped tools shadow globals**; duplicates within one layer and the reserved `run_code` name fail." restrict 的 `restrictableNames`（1114，源自 1194-1197 仅由 inherited 填充）意味着 restrict 只能命名继承名，天然无法命名 own 层工具。判定理由：同名遮蔽（1204-1208）与"restrict 仅过滤 INHERITED surface、own 注册豁免"（JSDoc 1163-1164 原话）均有明确分支实现。

### S-03 — `createExecution` 前段捕获 projector/finalizer；`dispatchToolBody` 晚期重新 resolve — **CONFIRMED**

实际位置：同文件。`createExecution`=1391（捕获 1436-1437，源自 1407 的 `this.get(name, agent)`）；`dispatchToolBody`=1564（晚期重解析 1578）。

```ts
1407:    const visible = this.get(name, agent)
1436:    const capturedFinalizer = visible?.finalizeContent?.bind(visible)
1437:    const capturedProjector = visible?.projectContent?.bind(visible)
1564:  private async dispatchToolBody(exec: MutableToolRunContext): Promise<ToolExecutionResult> {
1578:      const tool = this.resolveExecution(exec.name, exec.agent, exec.parent !== undefined)
1581:      const returned = await tool.execute(exec.arguments, exec)
```

判定理由：工具体按名字在分发时刻重新解析，而 projector/finalizer 是 prepare 时刻的旧定义回调；prepare→dispatch 之间发生重注册/卸载即出现"新体 + 旧投影器"的不一致窗口——静态事实成立。

### S-04 — `tools/pre-execute → tools.guard → tools/execute`；guard 单调拒绝；tools/execute 非透明替代入口 — **CONFIRMED**

实际位置：同文件。顺序编排在 `prepareExecution`=1493-1539；guard 注册 1136-1142；`guardReason`=1144-1154；`tools/execute` 环绕在 `dispatchScheduledExecution`=1601-1608。

```ts
1505:      const gate = await this.ctx.waterfall(
1506:        carrier, 'tools/pre-execute', exec, () => Promise.resolve<PreToolDecision>({ kind: 'allow' }))
1519:      const denialReason = decision.kind === 'allow' ? this.guardReason(exec) : decision.reason
1605:      const result = await this.ctx.waterfall(
1606:        carrier, 'tools/execute', mutableExec,
1607:        () => this.dispatchToolBody(mutableExec),
```

判定理由：即使 pre-execute 瀑布提前返回 allow，1519 仍运行 guard；guard 语义（1129-1131）"Any matching guard may deny by returning a reason, while **no guard can force-allow** a call another guard denied"；`tools/execute` 文档（155-158）限定 wrappers "may change only `exec.signal`, while call identity remains immutable"，且体仍由 1578 按名解析——wrapper 无法注入替代 ToolDefinition，非透明替代入口。

### S-05 — `run_code` 保留传输：内层 SDK 调用走 ToolRuntime 分发；不能同名注册或 restrict — **CONFIRMED（位置注记）**

`RUN_CODE_NAME` 定义与内层分发在 `packages/core/tools/src/ptc.ts`；**但显式拒绝代码实际在 index.ts**（指导把 S-05 位置钉在 ptc.ts，属位置漂移，事实本身成立）：

```ts
// ptc.ts
 30: export const RUN_CODE_NAME = 'run_code'
328:  * @param registry - the owning registry (sub-calls go through its `execute`, …)
557:        const scheduler = registry[TOOL_RUNTIME_SCHEDULER]   // 走 registry 暂存调度管线
// index.ts
1080:    if (name === RUN_CODE_NAME) {
1081:      throw new Error(`tool name "${RUN_CODE_NAME}" is reserved … cannot be registered or shadowed`)
1111:    if ([...allow ?? [], ...deny ?? []].includes(RUN_CODE_NAME)) {
```

判定理由：`createRunCodeTool` 绑定内层子调用经 `registry[TOOL_RUNTIME_SCHEDULER]`（index.ts:480 的包内 symbol，prepare=pre-execute/guard → dispatch → finalize 全管线）；register（1080-1082）与 restrict（1111-1113）对 `run_code` 均显式 throw。

### S-06 — `ctx.isolate` / `ctx.provide` 是公开服务隔离；不自动传递每次调用的 OperationGrant — **CONFIRMED**

实际位置：`vendor/cordis/src/context.ts:121-125`；`vendor/cordis/src/reflect.ts:33-46`。

```ts
// context.ts
121:  isolate(name: string, label?: symbol) {
122:    const shadow = Object.create(this[symbols.isolate])
123:    shadow[name] = label ?? Symbol(name)
124:    return this.extend({ [symbols.isolate]: shadow })
// reflect.ts (provide 文档)
35:     * The service becomes visible to dependents in the same isolation scope
36:     * once the fiber is active; it is unregistered … when the returned disposer runs or the fiber unloads.
```

判定理由：隔离粒度 = 作用域标签 + fiber 生命周期（作用域级实现替换）；对 `vendor/cordis/src/context.ts` 与 `reflect.ts` grep `grant` 零命中——无任何 per-call grant 概念，负半句以"该机制按作用域而非按调用"这一读取事实成立。

### S-07 — `subprocess.spawn` 同步返回 handle vs `sandbox.confine` 异步返回 argv — **CONFIRMED**

```ts
// packages/subprocess/subprocess/src/index.ts
 97:  * - {@link spawn} returns a live handle synchronously. …
153:  abstract spawn(spec: SubprocessSpawnSpec): SubprocessHandle
// packages/sandbox/sandbox/src/index.ts
 98:   argv: string[]                                  // ConfinedArgv（96-98）
177:  abstract confine(argv: readonly string[], policy: SandboxPolicy, signal?: AbortSignal): Promise<ConfinedArgv>
```

判定理由：`spawn` 同步返回活 handle（无 Promise），`confine` 异步返回**待替换 argv**——直接套接需先 await confine、再以包装 argv 重新构造 spawn spec，签名行证实形状差异。

### S-08 — tool-fs-search 包根导出（7 符号逐项）+ glob/grep 经 plain subprocess 启动 ripgrep — **CONFIRMED（定义文件注记）**

包根：`packages/fs/tool-fs-search/package.json:16-23` `"." → lib/index.js`（即 src/index.ts 编译面）；`src/index.ts` barrel 再导出。**七个符号逐一实存**：

| 符号 | 定义处 file:line | barrel 再导出（src/index.ts） |
| --- | --- | --- |
| parseGrepArgs | `src/grep.ts:89` | :45 |
| buildGrepCommand | `src/grep.ts:111` | :42 |
| parseGrepMatches | `src/grep.ts:169` | :46 |
| parseGlobArgs | `src/glob.ts:71` | :36 |
| buildGlobCommand | `src/glob.ts:89` | :36 |
| resolveRgPath | `src/search-core.ts:171` | :59 |
| toWorkdirRelative | `src/search-core.ts:300` | :61 |

```ts
// src/search-core.ts（plain subprocess 启动）
194:  * The spawn is unconfined (a plain `ctx.subprocess` call), so `--no-config` …
238:    handle = ctx.subprocess.spawn({
```

判定理由：7/7 全部真实存在且经包根可导入（无缺失）；rg 经 `ctx.subprocess.spawn` 普通（unconfined）前台 spawn 启动。注记：grep/glob 三函数定义在 `grep.ts`/`glob.ts` 而非指导所写 `search-core.ts`——但"包根导出"这一被核验事实经 barrel 成立，属定义文件位置注记而非反例。

### S-09 — post-execute spill 用精确 ToolDefinition 对象身份判断 — **CONFIRMED**

实际位置：`packages/fs/tool-fs-search/src/direct-call.ts:17-28`。

```ts
17: export function acceptedDirectCallValue(
24:   if (decision.kind !== 'accept' || decision.content !== undefined || Object.hasOwn(decision, 'value')
25:     || exec.parent !== undefined || exec.name !== tool.name || result.isError
26:     || ctx.tools.get(exec.name, exec.agent) !== tool) return undefined
```

判定理由：第 26 行 `!== tool` 是注册定义与当前作用域解析结果的精确对象同一性判断；同名替换 Definition 后该判断失败 → 返回 undefined（spill 弃权），"替换 Definition 可能损失 Spill 行为"静态成立。

### S-10 — 原生 FS 仅对修改做 fence；原生 bwrap 用 `--ro-bind / /` — **CONFIRMED**

```ts
// packages/fs/fs-sandbox/src/index.ts（模块头 6-8 行）
 7:  * implementation's, verbatim; this package adds only the per-call POLICY fence
 8:  * on the two mutations. Reads pass through untouched: every mode permits reading.
// 类体仅覆写两个修改方法：
80:   override async writeText( … )      // 122 checkedTarget: read-only 全拒 / workspace-write 限制可写根
101:  override async editText( … )
// packages/sandbox/sandbox-local/src/profiles.ts
16: export function bwrapProfileArgs(policy: SandboxPolicy): string[] {
17:   const args = ['--ro-bind', '/', '/', '--dev', '/dev', '--unshare-pid', '--proc', '/proc', '--die-with-parent']
```

判定理由：`SandboxedFileSystem` 只覆写 `writeText`/`editText`（读路径完全继承 LocalFileSystem 直通）；bwrap 将**整个 `/` 只读绑定**——全盘可读、仅写受限，确实不构成 Alpha.5 受限读取保证。

### S-11 — LSP = 持续存在的语言服务器进程 + 可信 Host 读取；不能仅管外层 `lsp.file_path` — **CONFIRMED**

实际位置：`packages/lsp/lsp-stdio/src/index.ts` 与 `instance.ts`。

```ts
// index.ts
157:        spec => ctx.subprocess.spawn(spec),                       // 服务器进程经 subprocess seam 常驻
220:  /** One live instance per stable canonical workspace identity. */
221:  private readonly instances = new Map<WorkspaceKey, LspInstance>()
279:      const source = await readHostSource(this.fs, request.filePath, workspace, …)  // 外层 file_path = 可信 Host 经 ctx.fs 预读
// instance.ts：服务器反向请求仅 configuration/lifecycle noop，其余拒绝 —— 无受管文件读取回调通道
247:  private answerServerRequest(method: string, params: unknown): Promise<unknown> {
263:    return Promise.reject(new Error(`unsupported server request: ${method}`))
```

判定理由：实例按 workspace 身份池化复用（279 注释"an invalid source still cannot leave an idle process pooled"证实 idle 进程驻留）；宿主仅为外层 `filePath` 读源，而语言服务器进程自身在 OS 级读写（工程/索引文件）不经任何 `ctx.fs`/受管通道——仅管外层 `lsp.file_path` 覆盖不住服务器进程实际 I/O。

### S-12 — Team 真实装配顺序 Preset → builtinToolDeny → Team tools → MCP → Coverage → pre-execute — **CONFIRMED**

实际位置：Team 树 `packages/runtime/src/plugin/live/agent-bindings.mjs`（4949 行；同一 agent setup 回调内顺序）：

```
2163:        await presets.mount(agentCtx, isRoot ? config.rootPresetId : config.memberPresetId)
2180:        const denyDisposer = applyBuiltInToolDeny(agentCtx, capabilities.builtinToolDeny)
2202-2204:    for (const def of selected) { toolDisposers.push(agentCtx.tools.register(def)) }
2212:        const skillDisposer = registerTeamSkills(…)                      // skills 介于 tools 与 MCP
2266-2270:   pre-MCP surface snapshot → await reconcileMcpSet(state, mcpMountTarget)
2286-2296:   const verdict = evaluatePermissionCoverage(finalSurfaceNames, {…})   // Coverage Gate，失败 throw
2313-2315:   // the tools/pre-execute permission enforcement … installed LAST in the setup
2332-2343:   if (permissionPolicy !== undefined) { … installParameterPermissionListener …（fail-closed）
```

判定理由：代码注释（2167-2169）自述"frozen ordering: model selection -> agentPresets.mount -> builtinToolDeny -> Team tools -> Team skills -> MCP"，其后 Coverage Gate 与 pre-execute 安装依次进行（2314 注释明言 "installed LAST"）；顺序与指导一致（指导清单未列 skills，属简写非矛盾）。

## 2. 判定汇总表

| S-ID | 判定 | 关键锚点 |
| --- | --- | --- |
| S-01 | CONFIRMED | agent-preset-registry/src/index.ts:242 + core/scope/src/index.ts:72 |
| S-02 | CONFIRMED | core/tools/src/index.ts:1184/1189/1200/1204-1208（own 层豁免分支） |
| S-03 | CONFIRMED | 同文件 1436-1437 捕获 vs 1578 晚期重解析 |
| S-04 | CONFIRMED | 同文件 1505-1508→1519→1605-1608；guard 单调语义 1129-1131 |
| S-05 | CONFIRMED | ptc.ts:30/557；拒绝代码在 index.ts:1080-1082/1111-1113（位置注记） |
| S-06 | CONFIRMED | cordis context.ts:121-124；reflect.ts:33-46；grant 零命中 |
| S-07 | CONFIRMED | subprocess index.ts:153（sync handle）vs sandbox index.ts:177（Promise\<ConfinedArgv\>） |
| S-08 | CONFIRMED | 7/7 符号实存（grep.ts/glob.ts/search-core.ts），barrel→包根；spawn= search-core.ts:238 |
| S-09 | CONFIRMED | direct-call.ts:26 对象同一性 `!== tool` |
| S-10 | CONFIRMED | fs-sandbox index.ts:7-8 仅 fence 修改；profiles.ts:17 `--ro-bind / /` |
| S-11 | CONFIRMED | lsp-stdio index.ts:220-221 池化 + :157 spawn + instance.ts:247-263 |
| S-12 | CONFIRMED | agent-bindings.mjs:2163→2180→2202→2212→2269→2286→2313 |

**12/12 CONFIRMED；0 REFUTED。** 无包根导出缺失（S-08 七符号全部实存）。

## 3. 漂移 / 位置注记记录（无 REFUTED 反例节需要）

本表无 REFUTED 项，且 S-08 包根导出无缺失，故按任务约定**不产生最小反例专节**；仅记录下列漂移：

1. **S-05 位置漂移（事实不漂移）**：指导将 `run_code` 对 register/restrict 的显式拒绝钉在 `src/ptc.ts`；该拒绝代码实际位于 `src/index.ts`（register 1080-1082、restrict 1111-1113），ptc.ts 拥有 `RUN_CODE_NAME`（:30）与内层分发桥（:557）。语义完整成立，仅文件归属漂移。
2. **S-08 定义文件注记**：指导并列 `index.ts / search-core.ts`；`parseGrepArgs/buildGrepCommand/parseGrepMatches` 定义在 `grep.ts`，`parseGlobArgs/buildGlobCommand` 定义在 `glob.ts`，仅 `resolveRgPath/toWorkdirRelative` 在 `search-core.ts`。"包根导出可复用"经由 index.ts barrel 成立。
3. **S-01 签名注记**：指导写 `bindScopeParent(agentKey, presetKey)`，实文为 `bindScopeParent(key, generation.key)`（key=scopeOf(ctx) 的 agent 作用域键，generation.key=preset 代际作用域键）——语义对应。
4. **S-12 简写注记**：真实顺序在 Team tools 与 MCP 之间另有 Team skills 注册（2211-2218）；指导清单为简写，不构成顺序矛盾。

## 4. 本代理实际执行的关键命令

- `git -C T rev-parse HEAD` / `git -C T status -sb` / `git -C W rev-parse HEAD` / `pwd` / `date -u`（基线验证，原文见 §0）
- `wc -l` + `grep -n "S-0\|S-1" <guide>`；read 指导 §0.1（行 1-60）
- 文件存在性 + 行数批检（`for f in …; do wc -l …`，15 个 DSH 源文件全在）
- `grep -n "bindScopeParent" packages/preset/agent-preset-registry/src/index.ts`；`grep -rln "export function bindScopeParent" packages/`；read core/scope/src/index.ts:60-90
- `grep -n "RUN_CODE_NAME\|restrict\|register(" packages/core/tools/src/index.ts`；read index.ts:1040-1246 / 1362-1481 / 1482-1661 / 143-172
- `grep -n "execute\|dispatch\|scheduler" packages/core/tools/src/ptc.ts`；read ptc.ts:536-575
- `grep -n "isolate\|provide" vendor/cordis/src/context.ts vendor/cordis/src/reflect.ts`；read context.ts:105-129、reflect.ts:10-51；`grep -in grant` 两文件（零命中）
- read subprocess index.ts:86-163、sandbox index.ts:144-182（S-07 签名）
- read tool-fs-search package.json 全文、src/index.ts 全文；逐符号 `grep -n "export function …" grep.ts/glob.ts/search-core.ts`（S-08 表）
- read direct-call.ts 全文（28 行）、profiles.ts 全文（58 行）、fs-sandbox index.ts 全文（147 行）
- `grep -n "spawn\|instance\|read…" lsp-stdio/src/index.ts,instance.ts`；read index.ts:251-310、instance.ts:240-269（S-11）
- `grep -n "\.mount(\|builtinToolDeny\|reconcileMcpSet\|evaluatePermissionCoverage\|installParameterPermissionListener" agent-bindings.mjs`；read 2140-2224、2246-2350（S-12）
