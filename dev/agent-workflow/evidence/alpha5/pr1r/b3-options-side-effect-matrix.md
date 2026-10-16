# Alpha.5 PR1r · B3 — 五候选路线的宿主原生机制副作用面矩阵（纯证据，零实现，合并冻结不变）

- **分析代理**：B3 选项副作用面分析代理。模型（逐字）：`You are a coding agent powered by the qwen3.8-flash-next model.`；Harness：**DeepSeek Harness**（两行分列，不合并表述）。
- **任务**：为用户裁决 PR1r B3 四+一路线（(i)/(ii)/W-1/W-2/(v)）逐一写明**会绕过/接管哪些宿主原生机制**。不做推荐结论，不改任何代码/语义，不动合并冻结。
- **锚点**：
  - 源 = `review-PR1r.md` @ `dd70ef3cc7790f83e1caeef0546adb7e2a377d4e`（`origin/alpha5-pr1r-residual-boundaries`）B3 节（:100-150）；base master `db5cb5f7`。
  - pinned 宿主 = **0.2.0-rc.2** 树 `@639ed015397290b3745d163aafe02ffee4aa3f84`，检出 `.worktrees/a5-pr1r/tests/deepseek-harness-test-use`（本会话复核 `git status --porcelain` = 0 行，跑前跑后各验一次）。下文 **`index.ts` = 该树 `packages/core/tools/src/index.ts`**（1985 行），reviewer 所给行号 `:1391/:1436/:1519/:1564/:1568/:1572/:1578/:1865/:1876` 全部在本树逐行对上。
  - 我方门 = `.worktrees/a5-pr1r/packages/runtime/tool-dispatch/install.ts`（下称 `install.ts`）与 `scoped-dispatcher.ts`（下称 `dispatcher.ts`）。
  - waterfall 语义 = 同树 `vendor/cordis/src/events.ts`（下称 `events.ts`）。
- **探针**：本代理自有一次性探针（pinned 0.2.0-rc.2 registry、p00-fixture 同款配方、跑完即删、原文见附录 A）。约定：`V1` = 已钉 definition，`V2` = 合法重注册后的移动体；`l0/l3` = 挂在我方门前/门后的观测 listener 计数；`post/result` = `tools/post-execute` / `tools/result` 观测计数。

---

## 0. 结论依赖的宿主机制底图（全部为 pinned 树原文）

**M1 waterfall = 不调 `next()` 即否决整条内链。** `events.ts:224-240`：

```
   * Compose listeners around the final `next` callback.
   * ... Listeners run outermost-first; a listener that does not call
   * `next()` vetoes the rest of the chain, including the built-in behavior.
  waterfall(...args: any[]) {
    const cbs = this.dispatch('waterfall', args)
    const inner = args.pop()
    const next = () => { const cb = cbs.shift() ?? inner; return cb(...args) }
```

监听者按注册序外层先跑（`events.ts:251` `options.prepend ? 'unshift' : 'push'`）。⇒ 我方门之后注册的一切 execute listener 与最内步 `dispatchToolBody`（`index.ts:1605-1608` 的 `inner`）在同一被否决集合里。

**M2 事件全集封闭。** `index.ts:142-210` 声明的宿主 tool 事件只有 `tools/pre-execute`(:153)/`tools/execute`(:164)/`tools/post-execute`(:176)/`tools/ptc-dispatch-log`(:190)/`tools/result`(:198, emit)/`tools/change`(:208, emit)；调用点 `:1325/:1505/:1605/:1782`（emit `:1702-1705`、`:835`）。`tools/execute` 契约原文（`:155-159`）：

```
 * Around-dispatch waterfall for timeout, retry, or metrics. `next()` returns
 * a normalized result; wrappers may change only `exec.signal`, while call
 * identity remains immutable. The registry re-fuses the original caller
 * signal before the body, so replacement cannot detach caller cancellation;
 * wrappers must still restore their signal and reach quiescence.
```

**M3 执行链关键位。** `createExecution` `:1391`：早解析 `:1407 const visible = this.get(name, agent)`，finalizer/projector 快照 `:1436-1437`（`visible?.finalizeContent?.bind(visible)`），`cancellationStates` 置 `bodyInvoked: false` `:1451`。`prepareExecution` `:1493`：caller-cancel 早退 `:1500-1501`（`kind:'final-result'`→跳过 execute waterfall 与 post-execute）；`tools/pre-execute` `:1505-1508`；`cancel` 决定 `:1514-1516` 与 guard 拒 `:1519-1534` 走 `'post-result'`（post-execute 仍跑）；放行 `:1537 {kind:'dispatch'}`。`dispatchScheduledExecution` `:1601`：`tools/execute` waterfall `:1605-1608`（inner=`dispatchToolBody`）→ `normalizeDispatchResult` `:1609` → 若 `callerCancelled && !isError` 用 `cancellationResult` 换结果 `:1624-1627`。`dispatchToolBody` `:1564`：

```
1568    const wrapperSignal = exec.signal
1569    const fused = fuseToolSignals(state.callerSignal, wrapperSignal)
1572    if (isAborted(signal)) { fused.dispose(); return toolAbortedBeforeDispatchResult() }
1573    exec.signal = signal
1578      const tool = this.resolveExecution(exec.name, exec.agent, exec.parent !== undefined)
1580      state.bodyInvoked = true
1581      const returned = await tool.execute(exec.arguments, exec)
1582      const result = this.createSuccessResult(exec, tool, returned)
1583      return isAborted(signal) ? toolAbortedResult(result) : result
1589-1590 finally { fused.dispose(); exec.signal = wrapperSignal }
```

`normalizeDispatchResult` `:1865-1883`：canonical 命中直通 `:1866`；isError 走错误规范化 `:1867-1875`；否则**按名重解析**：

```
1876    const tool = this.resolveExecution(exec.name, exec.agent, exec.parent !== undefined)
1877    if (tool === undefined) throw new ToolNotFoundError(exec.name)
1878    const normalized = this.createSuccessResult(exec, tool, result.value)
```

`post-execute` 的 `value` 替换同样按名重解析（`:1807`）。`bodyInvoked` 唯一用途 = 取消归类 `cancellationResult` `:1550-1556`：`state.bodyInvoked ? toolAbortedResult(prior) : toolAbortedBeforeDispatchResult(prior)`。两种取消形状 `:1958-1982`：`ABORTED`（"tool call aborted"，保留 prior 的 additionalContexts）vs `ABORTED_BEFORE_DISPATCH`（"tool call aborted before dispatch"）；常量 `:483/:486`。

**M4 宿主自带 `tools/execute` wrapper（生产代码全集，grep `on('tools/execute'`）：** `packages/guard/timeout-policy/src/index.ts:56`（超时，swap 派生 deadline signal 再还原）与 `packages/session/session-checkpoint-policy/src/index.ts:70-75`（flush 后 `if (exec.signal.aborted) return abortedBeforeDispatchResult()`——**宿主自己就有"不调 next() 直接返回 ABORTED_BEFORE_DISPATCH"的先例**）；这两个在 base bundle 清单（`packages/bundle/base/cordis.patch.yml:401/:413`，且 base 自述为 "the first patch layer"，用户层 patch——含我方 lane——在其后激活 ⇒ 默认装配里它们注册在我方门**之前**=外层，(i) 不跳过它们；被 (i) 跳过的是**注册在我方门之后**的一切 listener：第三方同名插件（review B1 `inner-after-ours` 臂证明其合法存在）、后经 plugin-manager/HMR 装入的包、以及条件装配 `packages/experimental/browser-use-runtime/src/mcp.ts:136/:192`、`browser-use-stagehand-native:192`、`computer-use-cua-driver-native:119`。**本仓库自身不再装第二条 `tools/execute` listener**（grep `install.ts` 全部注册：`tools/pre-execute`/`tools/post-execute`/`tools/result`/`tools/execute`(门)/`tools/change`，无我们自己在门后的 listener）。

**M5 `tools/change` 无参、全局。** `index.ts:208` `'tools/change'(): void`；发出方 = 注册层回调 `:835 () => { this.ctx.emit('tools/change') }`（任何 register/unregister/restrict）。事件契约原文（`:203-206`）："An UNFILTERED registry-subject notification, deliberately not scope-filtered"。⇒ 任何以 change 为扳机的动作必须自带 (agent, name) 筛选。

**M6 MCP 侧来源。** `packages/mcp/mcp-client/src/tools.ts:113-160 syncTools`：先建下一代 definition，再 `for (const dispose of previous.values()) dispose()` 后逐名 `ctx.tools.register(definition)`（`:146-150`）——**每次同步都是整批 dispose+register**；`connection.ts:263-269` MCP `listChanged.tools.onChanged → refreshTools`、断线重连换代（`:172` enqueueSync）。即：MCP 是**周期性、无通知语义细分的合法重注册源**。definition 全局注册、名 `mcp__<server>__<raw>`；execute 体 = `client.callTool(..., { signal: execution.signal, toolDefinition: tool, ... })`（`tools.ts:137-142`）——MCP body 直接消费 `exec.signal`。

**M7 会话/观测消费面。** `packages/core/agent-loop/src/tool-calls.ts:264` 落 `tool/call`、`:282-287` 落 `tool/result`（`...result.error?.info ? { error: result.error.info }` ⇒ **错误码进耐久会话日志**）；`packages/session/session-telemetry/src/coordinator.ts:270-273`：`tool/result` 的 `isError` → 遥测 severity=`error`。definition 早快照（M3 的 `:1436-1437`）意味着 finalize/project 通道取自**调用起点**的解析，而 normalize 取自**结果终点**的解析——(i) 下二者可与实际执行体三者互不相同。

---

## 1. 选项 (i) — 门内自执行已核验 definition（不调 `next()`）

1. **原生 execute waterfall listener**：**接管执行段 = 否决整条内链**（M1）。实测：门后第三方 listener `l3=0`，门外层 wrapper `l0=1`，未校验体 `v2=0`（探针 `I_PLAIN/I_MOVE`）。具体被跳过面 = M4 清单中注册在我方门之后的一切（第三方超时/重试/计量 wrapper、实验性 browser/computer-use wrapper、后装入插件），**外加** `dispatchToolBody` 本体：fuse `:1569`、晚期解析 `:1578`、`bodyInvoked=true` 登记 `:1580`、canonical 化 `:1582`、body 后取消归类 `:1583`、信号还原 `:1589-1590`。注册在前者（timeout-policy、session-checkpoint-policy）不受影响（外层已跑完才进门）。
2. **hooks/生命周期**：`tools/pre-execute`、`tools/post-execute`、`tools/result` 均照常（实测 `post=1, result=1`）；`tools/change` 无关。**结果身份差异（核心）**：返回值非 canonical ⇒ normalize `:1866` 不命中 → `:1876` **按名重解析** → `createSuccessResult(exec, 移动后的定义, 我方 value)`：探针 `I_MOVE_THEN_NORMALIZE` 原文 `text: "V2RENDER:ran:grep@V1"`——**执行体 V1、渲染/schema/presentationMeta 全按 V2**；且 finalizer/projector 仍取 `:1436-1437` 的**调用起点快照**（V1 时刻），即一次调用三个通道可由三个不同 definition 决定。`bodyInvoked=false` 的下游：`:1624-1627` 取消替换走 `cancellationResult` 的 `!bodyInvoked` 分支——探针 `I_CANCEL_WITH_BODY`：body 已完整执行并返回，最终结果仍为 `"Error: tool call aborted before dispatch"` `code=ABORTED_BEFORE_DISPATCH`；原生对照 `NATIVE_CANCEL_WITH_BODY` = `"Error: tool call aborted"` `code=ABORTED`。**"before dispatch" 成为假话，且 body 已跑过的事实对事件面消失**。返回协议：探针 `probe4` 证实 `return {content:[…]}` → `isError:true, "Error: tool \"grep\" returned invalid output: value is not lossless JSON", code=INVALID_TOOL_OUTPUT`（`:1878` 校验路径）；必须 `return { value }` ——模仿 registry 内部协议（与 reviewer C1 一致）。
3. **telemetry/观测**：宿主 `tool/call`/`tool/result` 会话事件照发（agent-loop 层不分来源）；变形内容 = (a) `tool/result.message` 的 content 可能由移动后定义的 render 生成（M7+本项 2）；(b) OTel severity 按 `isError` 计（`coordinator.ts:272`），(i) 不新增/丢失条目，但取消竞态下条目文本/code 换成 before-dispatch 形状。我方 lane 遥测：`dispatcher-call-begin`（`dispatcher.ts:528`，pre-execute 租约）→`dispatcher-result-observed`→`dispatcher-call-end`+`noteCallEdgeDefinition`（`install.ts:615-630`）全链不受 (i) 影响（事件照发，实测 post/result 计数为 1）；`dispatcher-definition-change-at-call-edge` 语义反而更常命中"真移动"（门后窗口没了，settled 边检出者必是门外移动+门内已执行 pinned 体的场景）。
4. **cancel/abort**：受影响最重的选项。`isAborted` 路径 `:1572` 在 (i) 下**不执行**；等价功能必须我方自建：(a) caller↔wrapper 信号 fuse（`:1569`/`fuseToolSignals` `:1928-1955` 的语义——探针 `I_CANCEL_WITH_BODY` 的 `bodySigExit:false`：外层 wrapper 替换信号后，caller abort 在 (i) 下**永远到不了 body**；原生 `NATIVE_CANCEL_WITH_BODY` `bodySigExit:true`）；(b) body 后取消归类（`:1583`）；(c) `exec.signal` 还原（`:1590`）。未重建前，取消语义、quiescence 契约（"Cancellation never abandons the body" `:1559-1563`）由我方隐式接管。
5. **MCP/工具来源**：行为按 definition 来源基本无差（(i) 只调 `pinned.execute(args, exec)`，MCP 体照常 `client.callTool`，`tools.ts:137-142`）。差异点：MCP 体以 `execution.signal` 驱动远端超时——(i) 传入的是**未 fuse** 的 exec.signal（本项 4a），MCP 调用的取消传播完全依赖外层 wrapper 链恰好保持 caller 血缘；原生/自注册定义无此远端后果面。
6. **自我 DoS/活性**：无新增自伤扳机（不依赖 change）。活性风险 = 门后 listener 被静默跳过引发的功能退化（别的插件的超时/重试/计量不再生效而无人知），以及结果身份错位（本项 2）导致的诊断失真。功能代价：被 (i) 接管的那次调用不再享受宿主 dispatch 段的取消/归类语义。

## 2. 选项 (ii) — 门内 signal wrapper + `tools/change` 触发 abort

1. **原生 execute waterfall listener**：**全保留**。实测 `II_FILTERED`：`l3=1, post=1, result=1`，链完整跑到 `dispatchToolBody`，由宿主自己在 `:1572`（先于 `:1578`）拦停；执行者仍是宿主。不跳过任何注册面，也不接管 `dispatchToolBody` 内的任何机制（fuse 在 abort 检查之前已按原样跑 `:1569`）。契约合法：只改 `exec.signal`（`:156` 明文允许），且宿主自己就以同一形状先行使用（M4 checkpoint-policy）。
2. **hooks/生命周期**：pre-execute/post-execute/tools/result 全数照常（实测计数 1/1/1）；`tools/change` 本就是我方诊断 listener 在收（`install.ts:676-689`）。结果身份 = 宿主规范化 isError 分支 `:1867-1875`（不做按名重解析，**没有 (i) 的三重身份问题**）；但结果是 abort 规范形而非 typed guard 拒形（review 已载）。
3. **telemetry/观测**：宿主条目数不变；变形 = 每次治理拒在会话 `tool/result.error` 里落 `{name:'AbortError', code:'ABORTED_BEFORE_DISPATCH'}`（M7），OTel severity=error——**治理拒与真取消在耐久日志同一码同一文案**。我方 lane 遥测不变，另需在 lane 侧另发自定义 typed 观测补语义（review (ii) 代价条）。
4. **cancel/abort 可区分性**：三臂对照实测 payload **逐字段同形**：`II_FILTERED` / `CANCEL_EARLY` / `CANCEL_LATE` 均 `text="Error: tool call aborted before dispatch", code=ABORTED_BEFORE_DISPATCH, info.name=AbortError`（`:1972-1982` 单一构造函数，无来源字段 ⇒ 事件面上**不可区分**）。唯一的弱区分轴是**边形状**：`CANCEL_EARLY`（prepare 早退 `:1500-1501`）`execute listener=0, post=0`；`CANCEL_LATE` 与 `II` 都是 `listener≥1, post=1` ⇒ (ii) 与"迟到的真取消"**完全同边同形**；上游（agent-loop、会话重放、遥测 alerting）无任何字段可分。宿主内既有同码不同语义先例（M4 checkpoint 的 flush 失败路径也用同码），说明消费方本就按"码"而非"来源"处理。
5. **MCP/工具来源**：MCP 是 (ii) 的主要扳机噪声源：M6 的整批 dispose+register（listChanged、重连换代）会对该 server 全部 `mcp__*` 名发出 change ⇒ 已筛选的 (ii) 会把这些名的在飞调用按名 abort（治理上正确、运维上是重连风暴）；未筛选则是下一条的全局自伤。原生/自注册定义只在真实注册动作时触发 change，噪声面小。
6. **自我 DoS（精确筛选失败的后果形状）**：实测 `II_DOS_INFLIGHT_OTHER`——change 扳机不校验 (agent,name) 时，一个**无关名**的合法重注册把另一条**已进 body 的在飞调用**中止：`bText="Error: tool call aborted", bCode=ABORTED, otherBodyCompleted=true`——**副作用已执行、结果却被改写为取消**；未进 body 的同批在飞调用则以 `ABORTED_BEFORE_DISPATCH` 假取消死掉（本项 4 的不可区分性使其无法被上游事后甄别）。`tools/change` 无参（M5）⇒ 筛选只能靠 lane 自己的 callId→(agent,name) 租约表（`dispatcher.ts:518-528 beginCall` 已具雏形），错一格=按整场风暴批量伪装用户取消。

## 3. 选项 W-1 — 上游请求：`resolveExecution` 之后、`tool.execute` 之前追加一段最内层 waterfall（携带已解析 definition，deny 走既有 typed 拒形）

1. **waterfall listener**：对现行树**零改动**（请求未落地）。落地后新段位于 `:1578` 与 `:1581` 之间：外层/内层既有 listener 位次不变，无否决面。
2. **hooks**：现行事件面零变化；新事件为宿主公开面（新事件名进 `Events` 声明 `:142-210`），typed 拒复用 `:1519-1534` 的 denial 物化形状（`Error: <reason>` + `error.info`），结果身份 = `createSuccessResult(exec, 已钉 definition, …)`——三重身份问题**结构性消失**（拒形与结果都由已解析 definition 决定）。
3. **telemetry**：现行条目零变化；typed 拒在会话日志里是 guard 拒形（`denialReason` 路径）而非取消码 ⇒ 与真取消天然可区分（对照 M7/本件 §2.4）。
4. **cancel/abort**：`:1572` 路径、`cancellationResult`、`bodyInvoked` 语义原样保留；新段自身在 fuse 之后（`:1573` 后），取消竞态归类不变。
5. **MCP/来源**：无来源相关差异（新段在统一 dispatch 段）。
6. **自我 DoS/活性**：无本地扳机。风险全部在**上游接受度**（CORE=0 下这是"最小上游能力请求"，未获前 R-b 维持现状）；(v) 的功能代价不由 W-1 承担。**当前树上无任何可测副作用——该条本身就是证据。**

## 4. 选项 W-2 — 上游请求：解析稳定执行（钉 `createExecution` 早解析进 execution，`dispatchToolBody`/normalize 不再按名重解析）

1. **waterfall listener**：位次不变，零否决面。改动点是**取消两处按名重解析**：`:1578`（改用钉住的 definition）、`:1876` 与 `:1807`（改用钉住的 definition 或 canonical 短路）。`:1436-1437` 已是该模式的现成先例（finalizer 早快照）。
2. **hooks**：事件名/次序不变；结果身份统一 = 钉住的 definition（同时消掉 (i) 的"结果由移动后的行决定"，review W-2 条），pre-execute 窗口一并闭合。
3. **telemetry**：条目数不变；语义收紧一处：会话日志里结果渲染/schema 校验永远出自调用起点定义，settled 边"移动"不再能改变本次调用任何字节（移动只影响后续调用）——我方 `dispatcher-definition-change-at-call-edge` 从"撤回+暴露一次"降级为纯披露。
4. **cancel/abort**：不动 `:1572/:1583/:1550-1556`；零影响。
5. **MCP/来源**：语义差异点（**代价面**）：今天的宿主语义里"晚解析"同时意味着**合法**重注册对在飞调用生效；W-2 后一切在飞调用（含 MCP 重连换代时刻、任何插件的正常热替换）固定跑旧定义到调用结束——这是把"在飞一致性"从"跟随最新"改成"跟随起点"的全局语义变更，受益方是治理，受损方是依赖晚解析热生效的既有装配（宿主自身 `resolveExecution` 的 ptc-collapse 判定 `:1247/:1339` 亦需同步钉，否则两解析漂移）。
6. **自我 DoS/活性**：无本地扳机；风险 = 上游接受度 + 上一条的全局语义变更需宿主自己裁决（比 W-1 重）。

## 5. 选项 (v) — 该拓扑严格档禁用（装配期不可确证 ⇒ `IO_POLICY_UNSUPPORTED` 拒装）

1. **waterfall listener**：不装门 ⇒ 我方门后的别人（与自己）的 execute listener 全部照跑；**没有绕过**——但也没有闭合：R-b 窗口在该拓扑下原样存在（review B1 的 `inner-after-ours` 即其形状）。
2. **hooks**：全保留；变化全部在装配期：`armRequiredSeam` 既有失败路径就产 typed `IO_POLICY_UNSUPPORTED` 整体拒装（`install.ts:555-573`，先例即 M-01 行"不能保证的 Profile 启动前 `IO_POLICY_UNSUPPORTED`"）。
3. **telemetry**：运行期条目 = 纯宿主面；新增装配期拒装披露（须进矩阵而非仅 kit README，review 替代路线条原文）。
4. **cancel/abort**：零影响（无新机制）。
5. **MCP/来源**：**代价集中处**。M-12 行选型字面要求"动态注册/撤回/重注册/同名遮蔽全量进 closed-world Guard"（`S0-SELECTION-MATRIX.md:59`）；(v) 对"own-layer 治理名只有 Team 一个贡献者"不可确证的装配直接拒 ⇒ 含第三方同名贡献者的世界（B1 已证其合法性）里 **MCP 治理面从『全量进 Guard』回落到『装配拒绝/unsupported』**，M-01/M-02/M-03/M-14 的拒绝姿态前提（"治理名身份不被移动"）也须按 review 明记 `partial`（`S0-SELECTION-MATRIX.md:48/49/50/61` + review B3 受影响行段）。已 SUP 场景的退化判据：凡装配期存在（或无法排除）第二个同 scope 治理名贡献者——第三方插件包、动态注册型 MCP、HMR 后装入——该 Agent 的全部受治理工具面在严格档退 unsupported；B1 威胁模型明文这类贡献者"在支持范围内"，所以这不是罕见的恶意类，而是普通合法世界类别。
6. **自我 DoS/活性**：无运行期扳机（零自伤面）；活性代价全部前移为**可用性代价**（上两条）。这是五选项中唯一运行期零副作用、代价全在功能面的路线。

---

## 6. 5×6 矩阵（选项 × 机制面；`不受影响/绕过/接管/变形` + 一句原因）

| 选项 | ① execute waterfall listener 链 | ② hooks/生命周期事件 | ③ telemetry/观测 | ④ cancel/abort 语义 | ⑤ MCP/来源语义 | ⑥ 自我 DoS/活性 |
| --- | --- | --- | --- | --- | --- | --- |
| **(i) 门内自执行** | **绕过**：门后全部 listener + `dispatchToolBody` 整段被否决（events.ts:234-240；实测 l3=0） | **变形**：pre/post/result 照发，但结果身份由 `:1876` 按名重解析决定，实测 `"V2RENDER:ran:grep@V1"` 三体分离；返回须模仿内部 `{value}` 协议（实测 INVALID_TOOL_OUTPUT） | 条目数不变；变形=result 内容由移动后定义渲染、取消竞态条目换 before-dispatch 形状；lane settled 边链不受损 | **接管**：`:1569` fuse、`:1572/:1583` 归类、`:1590` 还原全部旁路须自建；实测 body 已执行仍报 `ABORTED_BEFORE_DISPATCH`、caller abort 到不了 body（bodySigExit:false） | 基本不受影响；MCP 体消费的 exec.signal 未 fuse，取消传播靠外层链血缘 | 无新扳机；风险=门后 wrapper 静默失效 + 结果身份错位的诊断失真 |
| **(ii) signal wrapper + change-abort** | **不受影响**：链完整跑到 `:1572`（实测 l3=1） | **不受影响**：三事件全发（post=1,result=1）；isError 规范化路径 `:1867` 无重解析 | 条目数不变；治理拒在耐久日志落 `ABORTED_BEFORE_DISPATCH`（与真取消同码同文案） | **变形**：与迟到真取消逐字段同形、事件面不可区分（三臂实测同 payload）；弱区分轴仅边形状（早期取消 post=0，(ii) post=1） | MCP 重连/listChanged = 整批 dispose+register（tools.ts:146-150）→ 该 server 全部受治理名在飞调用被按名 abort；噪声/风暴集中于 MCP | **最高**：筛选失败实测——无关名合法重注册把已执行完副作用的在飞调用改写为 `ABORTED`（副作用不回滚），未起 body 的同批以假取消死 |
| **W-1 上游：解析后拒点** | 不受影响（新段嵌在 `:1578/:1581` 之间，位次不变） | 不受影响；typed 拒复用 `:1519-1534` 形状，与取消天然可区分 | 不受影响；无取消码复用 | 不受影响（fuse/归类原样，新段在 fuse 后） | 不受影响 | 无本地扳机；风险全在上游接受度 |
| **W-2 上游：钉 definition** | 不受影响（改解析源，不改链） | 不受影响；结果身份统一于起点 definition，(i) 的三重身份问题消失 | 条目数不变；settled 边"移动"降级为纯披露 | 不受影响（不动 `:1572/:1550`） | **变形（全局）**：在飞调用不再跟随合法热替换（含 MCP 换代跑旧定义到结束）；`:1578/:1876/:1807` 三处须同钉 | 无本地扳机；代价=宿主级"晚解析→早解析"语义变更由上游裁决 |
| **(v) 严格档禁用** | 不受影响（不装门） | 不受影响；装配期 typed `IO_POLICY_UNSUPPORTED` 拒装（install.ts:554-572 既有形状） | 运行期=纯宿主面；新增装配期拒装披露（须进矩阵） | 不受影响 | **代价集中**：M-12"全量进 Guard"字面要求不可满足；M-01/02/03/14 前提记 partial | 运行期零自伤；全部代价前移为可用性——凡不可排除第二同 scope 贡献者的世界整体退 unsupported |

---

## 附录 A — 一次性探针原文（pinned 0.2.0-rc.2 registry；跑完即删，脚本与 out.json 已 `rm -rf`，worktree/test-use porcelain 复核均 0 行）

配方 = `dev/agent-workflow/evidence/alpha5-adapter-p0/00-baseline/p00-fixture.mjs`（同款 cordis Context + ToolRuntime + mintScope；无模型无 Host）。每臂独立 fixture。脚本要点（贴关键段，完整源已删）：

- 每臂 V1 先注册；`l0`=门前观测 listener（部分臂替换 `exec.signal` 为**不链接** caller 的新 AbortController——timeout-policy 形状的最坏合法变体）；门=(i) 版 `tools.execute` listener：`pinned = c.tools.get('grep', A.key)`，身份核验后 `const value = await pinned.execute(exec.arguments, exec); return { value }`（**不调 next()**）；(ii) 版：`const ac = new AbortController(); exec.signal = ac.signal; return next().finally(() => { exec.signal = upstream })`，`tools/change` 监听按 `c.tools.get(w.name, A.key)?.__id !== w.pinned` 选择性 `ac.abort()`；`l3`=门后第三方 listener（计数 + 合法 `disposeV1(); c.tools.register(V2)`）。

原始输出（`out.json` 全文）：

```json
{
 "NATIVE_MOVE":  {"v1":0,"v2":1,"l0":1,"l3":1,"text":"V2RENDER:ran:grep@V2"},
 "I_PLAIN":      {"v1":1,"v2":0,"l0":1,"l3":0,"post":1,"result":1,"text":"ran:grep@ran:grep@V1","isError":false,"code":"","bodySigExit":null},
 "I_MOVE_THEN_NORMALIZE": {"v1":1,"v2":0,"l0":1,"l3":0,"post":1,"result":1,"text":"V2RENDER:ran:grep@V1","isError":false,"code":"","bodySigExit":null},
 "I_CANCEL_WITH_BODY":    {"v1":2,"v2":0,"l0":1,"l3":0,"post":1,"result":1,"text":"Error: tool call aborted before dispatch","isError":true,"code":"ABORTED_BEFORE_DISPATCH","bodySigExit":false},
 "NATIVE_CANCEL_WITH_BODY":{"v1":2,"text":"Error: tool call aborted","isError":true,"code":"ABORTED","bodySigExit":true},
 "II_FILTERED":  {"v1":0,"v2":0,"l3":1,"post":1,"result":1,"text":"Error: tool call aborted before dispatch","isError":true,"code":"ABORTED_BEFORE_DISPATCH","infoName":"AbortError","otherText":"ran:other@ran:other@O1","otherIsError":false},
 "II_UNFILTERED":{"v1":0,"v2":0,"l3":1,"post":1,"result":1,"text":"Error: tool call aborted before dispatch","isError":true,"code":"ABORTED_BEFORE_DISPATCH","infoName":"AbortError","otherText":"ran:other@ran:other@O1","otherIsError":false},
 "II_DOS_INFLIGHT_OTHER":{"bText":"Error: tool call aborted","bCode":"ABORTED","bIsError":true,"otherBodyCompleted":true},
 "CANCEL_EARLY": {"l":0,"post":0,"result":1,"text":"Error: tool call aborted before dispatch","code":"ABORTED_BEFORE_DISPATCH","infoName":"AbortError"},
 "CANCEL_LATE":  {"l":1,"post":1,"result":1,"text":"Error: tool call aborted before dispatch","code":"ABORTED_BEFORE_DISPATCH","infoName":"AbortError"}
}
```

（探针工件注记：`I_PLAIN.text` 与 `otherText` 的双前缀 `ran:grep@ran:grep@`/`ran:other@ran:other@` 是探针 render 前缀叠加的显示工件，非宿主行为。`NATIVE_MOVE v2=1` 证明 harness 有牙。）

`probe3`（(i)-move 全量结果转储，证明 §1.2 的三通道分离）：

```
POST-EXECUTE sees: {"text":"V2RENDER:ran:grep@V1","hasValue":true,"value":"ran:grep@V1","isError":false}
TOOLS/RESULT sees: {"text":"V2RENDER:ran:grep@V1","value":"ran:grep@V1","isError":false}
FINAL: {"isError":false,"content":[{"type":"text","text":"V2RENDER:ran:grep@V1"}],"value":"ran:grep@V1"}
```

`probe4`（(i) 返回协议确认，§1.2 末）：

```
content => isError: true | text: Error: tool "grep" returned invalid output: value is not lossless JSON | code: INVALID_TOOL_OUTPUT
value   => isError: false | text: ran:V1 | code: 
```

## 附录 B — 引用行号自检

本件全部 `index.ts` 行号（`:142-210/:483/:486/:835/:1247/:1339/:1391/:1407/:1436-1437/:1451/:1493/:1500-1501/:1505-1508/:1514-1534/:1537/:1542/:1550-1556/:1564/:1568-1573/:1578-1583/:1589-1590/:1601/:1605-1609/:1624-1627/:1668-1681/:1694-1712/:1782/:1807/:1865-1883/:1928-1955/:1958-1969/:1972-1982`）与 `events.ts:224-251`、`timeout-policy:55-83`、`session-checkpoint-policy:41-47/:70-75`、`mcp tools.ts:113-160`、`mcp connection.ts:160-177/:255-275`、`tool-calls.ts:264/:282-287`、`coordinator.ts:270-273`、`install.ts:555-573/:575/:596/:615-630/:648-672/:674-691`、`dispatcher.ts:518-559`、`S0-SELECTION-MATRIX.md:48-61`、`cordis.patch.yml:401/:413` 均在本会话于 pinned/我方树 `grep -n`/`sed` 逐行复核；pinned 树与 a5-pr1r worktree 在探针运行前后 `git status --porcelain` 均为空。**主检出仅新增本文件（untracked，未 commit/push）。**
