# Alpha.5 P0 — 独立 Team Adapter 可行性与执行保证 PoC 实施指导

> **状态：PLANNED / NOT EXECUTED。** 这是用于关闭 Alpha.5 选型问题的 PoC 阶段指导，**不是** Alpha.5 产品开发开工令、测试已通过的记录或已批准合并 PR 的声明。
>
> **编写日期：2026-10-16**。目标宿主 **DSH `0.2.0-rc.2` @ `639ed015397290b3745d163aafe02ffee4aa3f84`**，版本与测试路径仍以 `tests/paths.mjs` 为运行时唯一来源。对更新版 DSH 的实验必须单独标注，不可替代 pinned baseline。
>
> **权威与约束：** [Alpha.5 ADR](./ADR-alpha5-tool-io-governance.md) §8、[Architecture V2](./architecture.md) §14、[A5-FORK-001](./tool-fork-debt.md)、[仓库红线](../../../../AGENTS.md)、[执行路由](../../../ROUTER_RULES.md) §0、[测试规程](../../../TEST_METHODS.md)。本文件为 `docs/plans/memo/` 中的设计阶段计划，不能覆盖在行 Alpha.4 计划或冻结历史文档。涉及路径如不确定，以文件真实位置为准；每个 PoC 执行前重新读取这些规范。

## 0. 决策目标与研究方法

本 PoC 回答的核心问题不是“能否注册一个同名函数”，而是：

**能否在未修改 DSH Core、未导入私有 API、未复制原生工具体的条件下，为 Team Agent 独立注册受约束的 Adapter，使其在所有支持的调用/生命周期路径中独占执行，且原生功能和实际 I/O 保证符合策略？**

一个 **GO** 必须同时证明：**身份与工具绑定 → 独占分发 → Team 准入 → 实际强制 I/O → 结果语义及生命周期**。静态源码证据只能降低实验范围，不能替代真实 pinned Host 结果。

优先尝试三条符合零 Core Patch 的路线（**按单个工具族选型，不强迫所有工具使用同一路线**）：

- **R1 — Agent Scope 同名 Team `ToolDefinition` + 继承工具遮蔽：** 在正确的 Agent Scope 中，先对继承来的原生工具调用 `tools.restrict({deny:[name]})`，再注册同名 Team Adapter；保持遮蔽的生命周期不短于 Adapter/有效调用。
- **R2 — Service isolation + 复用原生注册函数：** 采用公开 Cordis `ctx.isolate('fs'|'shell'|'subprocess')` / `ctx.provide` 的受控服务视图，在 Agent Scope 重新装配原生工具，保证其实际 I/O 进入受约束 Provider。
- **R3 — 公开 API 组合的独立 Adapter：** 对 R2 不适用的工具，用包根公开的 parse/argv/format/stream/render 辅助函数组成新的 Team `ToolDefinition`；只在必要处维护少量行为粘合代码。

**R4 — 仅经证明后默认回退的工具级 Fork：** 只有 R1–R3 对某具体工具的必需保证已通过最小反例证明不可行，且 Fork 本身仍能使用公开依赖、独立注册及独占分发时，才可选择有界工具级 Fork，并登记具体 `A5-FORK-<family>` 债务和清退标准。**缺少 bwrap、内核能力或工程量较大不是 `CORE_SEAM_BLOCKER`；R4 不是 Core 级接口不足的万能解。**

### 0.1 静态源码已确认的事实（不是 PoC PASS）

| ID | 事实/位置（DSH pinned source） | 它证明了什么 / 没证明什么 |
| --- | --- | --- |
| S-01 | `packages/preset/agent-preset-registry/src/index.ts`：`bindScopeParent(agentKey, presetKey)` | Agent 继承 Preset 工具；**不等于**热卸载绝无竞态 |
| S-02 | `packages/core/tools/src/index.ts`：`ToolRuntime.view`、`tools.register`、`tools.restrict` | 当前 Scope 同名工具可遮蔽祖先；继承限制不隐藏本 Scope 自注册工具；**同层重名与 run_code 例外另测** |
| S-03 | 同上：`createExecution` 与 `dispatchToolBody` | 前段捕获 projector/finalizer；实际工具体在分发期重新 `resolveExecution`，存在替换/卸载不一致的测试窗口 |
| S-04 | 同上：`tools/pre-execute → tools.guard → tools/execute` | `guard` 为单调拒绝；`tools/execute` 不应被无验证地假定为替代 ToolDefinition 的透明入口 |
| S-05 | `packages/core/tools/src/ptc.ts` | 内层 SDK 调用走 ToolRuntime 分发；`run_code` 是不能同名注册或 `restrict` 的保留 Transport |
| S-06 | `vendor/cordis/src/context.ts` 与 `reflect.ts` | `ctx.isolate` / `ctx.provide` 是公开服务隔离机制；**不自动传递每次调用的 OperationGrant** |
| S-07 | `packages/subprocess/subprocess/src/index.ts` 与 `packages/sandbox/sandbox/src/index.ts` | `ctx.subprocess.spawn` 同步返回 handle，而 `ctx.sandbox.confine` 异步返回 argv；直接二者套接存在形状差异 |
| S-08 | `packages/fs/tool-fs-search/src/index.ts` / `search-core.ts` | `glob/grep` 经 plain subprocess 启动 ripgrep；包根导出 parse、build、parseMatches、resolveRgPath 等可复用函数 |
| S-09 | `packages/fs/tool-fs-search/src/direct-call.ts` | 原生完整结果的 post-execute spill 用精确 ToolDefinition 对象身份判断；替换 Definition 可能损失 Spill 行为 |
| S-10 | `packages/fs/fs-sandbox/src/index.ts`、`packages/sandbox/sandbox-local/src/profiles.ts` | 原生 FS 仅对修改做 sandbox fence；原生 bwrap 使用 `--ro-bind / /`，不是 Alpha.5 受限读取保证 |
| S-11 | `packages/lsp/lsp-stdio/src/index.ts` 与 `instance.ts` | LSP 是持续存在的语言服务器进程 + 可信 Host 的部分文件读取；不能仅管外层 `lsp.file_path` |
| S-12 | Team `packages/runtime/src/plugin/live/agent-bindings.mjs` | 现有真实组合顺序 Preset → builtinToolDeny → Team tools → MCP → Coverage → pre-execute；新 Adapter 插入点必须在真实装配路径中验证 |

**源链接：** `https://github.com/ArmourPiercer1/deepseek-harness/tree/stable-3-0.2.0-rc.2/packages`，Team `https://github.com/ArmourPiercer1/dsh-agent-team/tree/master/packages/runtime`。最终报告必须给出实际 pinned SHA 的逐项源码锚点，不仅链接易移动分支。

## 1. 不变量、信任边界与禁止的捷径

### 1.1 必须证明的安全不变量

- **INV-1 覆盖：** 当前 Team Agent 实际可分发的工具集（包括 `run_code` 所绑定的内层工具、Team Tools、MCP 与动态注册）均有 Team 管理绑定；被显式 deny 的工具不得通过 Adapter 重新显露可执行能力。**仅比对模型 `schemas()` 不充分。**
- **INV-2 独占：** 一次 Team 所治理的调用最终只进入一个受批准的 Adapter/执行边界。拒绝、取消、安装失败、卸载、Hot Reload、冷恢复、`tools/execute` 延迟/异常时，原生执行体计数始终为 0，不发生 silent fallback。
- **INV-3 单调拒绝：** 任意较早 `tools/pre-execute` listener 提前返回 allow 不得绕开 Team guard；Team 或 Domain 明确拒绝不得被 Core/Host 其他同意反转。
- **INV-4 授权精确：** Team `ask` 及资源增量批准在 body 启动前完成，授权绑定 Member、Tool Binding、参数指纹、权限世代、资源/Realm 和一次分发；并发调用不能窃取别人单次 Grant。
- **INV-5 真实 I/O：** Trusted FS 在操作实际落点限制读取/写入；进程型工具的文件、网络和子进程访问必须在实际 OS/Provider 边界拒绝。**“结果没有输出秘密”不代表没有读取秘密。**
- **INV-6 生命周期：** 子进程、PTC 子工具、LSP Server、后台 Job 不得通过父级批准隐式扩权；取消请求不等于已终止，持续授权范围必须可观测。
- **INV-7 功能等价：** 合法调用保留现有 Tool Schema/输入、结构化 `value`、`content`/`meta`、错误分类、超时/取消、输出保留与合法 Spill 行为，允许有记录的显式差异而非静默丢失。
- **INV-8 非目标范围：** 不触动普通 Host Session / 另一 Team / 普通 Preset；不将可信原生插件视为恶意同进程代码隔离；远程 MCP 内部 I/O 不被本地 Sandbox 伪称受限。
- **INV-9 失效关闭：** 在不支持某种读/写 ACL、目的地过滤、真实执行身份、启动机制时拒绝该组合。不能把 `SANDBOX_UNAVAILABLE`、功能差异、环境没有 bwrap 误写成权限批准或 Core 缺接口。
- **INV-10 零 Core 变更：** pristine DSH checkout 始终在精确基线，所有 Adapter/测试 Fixture 均在 Team 工作树；不使用私有 API、`patch-package`、全局 `require` hook、monkey-patch 或静默包替换。

### 1.2 观察与反例原则

每个安全否定测试必须建立*正控 + 负控*：例如同一沙箱内批准的 `public.txt` 可读，禁止的 `secret.txt` 实际 `open` 被拒绝；批准写入的目录成功，禁止写入的目录未修改；允许的子工具执行 1 次，禁止的原始体执行 0 次。仅依赖返回文本 `isError=true`，没有文件系统/进程/计数证据，不能算安全测试 PASS。

Provider 仅对**自己实际控制的执行边界**声称保证。依赖软限制或未测试 OS 行为不得标记成 `enforced`。使用所有自造的测试敏感文件、空白凭据和回环/隔离网络端点；禁止接触真实设备、真实科研权威存储或用户的其他项目数据。

## 2. PoC 运行与证据纪律

1. 在真正开始本 PoC 开发前读取 `AGENTS.md`、`docs/ROUTER_RULES.md`（尤其 `0`）、`docs/TEST_METHODS.md`、当期 active 阶段计划、`dev/agent-workflow/graph.yaml` 与 `SESSION_ROUTER_LOG.md` 末尾。**本指导不改写 Alpha.4 阶段实施权威，也不自动授权启动 Alpha.5。**
2. 在**独立任务分支 / worktree** 中实施 PoC Fixture；一个任务一个 writer，分离 Reviewer。不得在本设计 PR 分支上混入实现代码，不得修改 `master`、`stable`、冻结计划或 DSH upstream。
3. 测试 Host 来源只能是 `tests/deepseek-harness-test-use`（pristine `639ed015...`；不把 PoC 代码写进它）或遵守测试规程的独立真实 Host 组合。运行时 `DSH_HOME=tests/homes/<unique-world>`，工作区内专属，端口取 `3180–3186` 或允许的 `3491–3500` 空闲端口；**绝不触碰稳定 `:3080` 和其 HOME**，也不抢占其他正在使用的 PoC 端口。必要构建遵守 `pnpm run build` 及 `tests/paths.mjs` 单一版本来源，不重用归档旧 characterization CI 作为当前 PASS。
4. 默认先跑**无模型密钥**的 ToolRuntime/Host Fixture，再跑完整 DSH 实例；有模型参与的验证使用 mock model。所有危险操作用虚构文件、假设备网关和 loopback fixture，测试日志脱敏，禁止提交 DSH_HOME、launch token 或真实凭据。
5. 实验证据目录按任务实际创建于 `dev/agent-workflow/evidence/alpha5-adapter-p0/`，可复用通用 Kit 方可移至 `tests/kits/`。不得在本阶段提交不相关代码清理，完整保留失败反例和复核记录。
6. 每轮保存：`HEAD`、upstream SHA、Node/OS/kernel、sandbox candidates、`git status --porcelain` 前后、测试命令/退出码、完整结构化观测 JSON、文件/进程真实副作用证据、适用的最小源码引文。环境限制标记为 `ENV_BLOCK`，不算程序缺陷或接口不存在。
7. 运行后的证据必须由独立 Reviewer 按精确提交 HEAD 在真实测试 Host 复验至少一组关键反例。原生工具和 OS Sandbox 的安全保证不得仅用 mocks 出具最终 GO。

建议基于上面的目录规范创建 `00-baseline/`、`01-routing/`、`02-search/`、`03-fs/`、`04-process/`、`05-ptc/`、`06-lsp/`、`07-integration/`、`08-review/`；它们是**实施时的输出路径**，目前不是已存在的工件。

## 3. 阶段化执行计划与硬门

| Work package | 重点问题 | 依赖 | 完成产物 |
| --- | --- | --- | --- |
| **P0-0 Baseline & Harness** | pristine Host、双 Agent、原生工具计数、真实装配顺序 | 无 | 可复现 Fixture + 原生 baseline parity |
| **P0-1 Scoped Binding & Original-Body Fallback** | 同名覆盖、`restrict` 遮蔽、并发卸载、PTC 嵌套、Guard | P0-0 | 证明/否证 `R1` 独占分发 |
| **P0-2 Search Strategy Tournament** | 原生工具重新装配 + Service Isolate vs 包根辅助函数重组 | P0-1 | `grep/glob` 路线裁决与等价报告 |
| **P0-3 Controlled FS** | 文件读取、写入、隐藏读取、per-call Grant、并发、路径竞态 | P0-1 | `read/write/edit/read_image/editor` 路线裁决 |
| **P0-4 Confined Process Assurance** | 真实 OS 读取白名单、拒绝子树、写入、network deny、继承 | P0-2 的 launcher 接口 | 已验证 Provider capability matrix |
| **P0-5 PTC/LSP Lifecycle** | `run_code` 无法同名注册、PTC 外层 Node 与内层调用；持久 LSP | P0-1 + P0-4 | 每个特殊工具的支持/拒绝分类 |
| **P0-6 Full Host Integration & Selection** | Team 实际装配、Alpha.4 审批、冷恢复、取消、各 Agent 隔离 | 上述适用路线上通过 | 单工具族 GO/DEFER/BLOCK + 风险/债务报告 |

**顺序约束：** P0-1（独占分发）是共享硬门。如果不能对一类 Team 工具证明“原体永不回落”，其后该类工具的 I/O 成功示例**不能提升**为安全 GO。P0-2/P0-3 可在 P0-1 合格并冻结接口后按不同 worktree 并行；P0-5 不应由自称通过的纯模拟案例解锁真实保障。

### P0-0：基础 Fixture 与观测器

最少构造：

- Agent A：绑定真实 Preset，并选择原生 `grep`/`read` 等。Team 将其注册成同名 Adapter。Agent B：同一 Host 上使用相同 Preset，但不属于该 Team 或绑定另一策略。
- 原生 `ToolDefinition.execute` 和 Adapter execute 分别加**观测型计数器**（通过独立测试 Definition/Wrapper，**不要修改 pinned 上游原文件**），并在每次调用输出 scope、callId、parent、binding identity、工具最终选择和实际效果记录。
- `tools/pre-execute` 的恶意/提前放行 Listener、`tools/execute` 的可控暂停 Wrapper、手动释放的 ApprovalCase Deferred Gate，形成确定性竞态窗口。禁止只用 sleep 碰运气。
- File fixtures：允许文件、禁止文件、同名不同目录、只读/可写子树、符号链接指向禁止区域、不同 Agent 的不同 Workspace、带前后空格的文件名；先在隔离环境中使用硬链接/别名等特殊 fixture，受平台约束时记录 `UNSUPPORTED`。
- 实验记录同时包括模型可见工具、真实 `tools.get(name, agent)`、PTC 可绑定工具与最终真实分发，以便辨别“可见但不可执行”和“隐藏但仍可从子调用执行”。

**P0-0 GO：** 能稳定复现原生工具调用，能够统计真实原体与 Adapter 的调用数，两个 Agent 的真实 Scope 可区分，冻结全部源码/环境版本。不可创建真实 Host Fixture 时不得进入“安全已证明”的结论。

### P0-1：路由与竞态（最高优先）

**建议验证的组合次序：**

1. 在 Agent A 的真实 Scope **先** `tools.restrict({deny:['grep']})` 遮蔽来自 Preset 的 `grep`，确认 `get('grep', A)` 不再解析原体，Agent B 仍能解析原体。
2. 随后 `agentCtx.tools.register(teamGrepDefinition)`；确认 A `schemas`/`get`/实际 `ctx.tools.execute` 都解析并执行 Adapter，B 仍执行原生。
3. **Adapter 卸载，但继承限制保持存活：** A 此时应当没有可执行的 `grep`；错误/取消/热替换不得恢复原生。再逆向实验“先移除遮蔽”以**确定性复现危险时序**；该反例是设计防护的证据而非可提交产品行为。
4. 在可控 ApprovalCase 等待期暂停；在 Guard 之后、`tools/execute` 与 `dispatchToolBody` 重新查表之前暂停；分别执行 Adapter 卸载/替换/Scope 更改、Agent dispose、冷恢复。每一组都要核原体计数 **0**。主动插入 `tools/pre-execute` 提前 `allow`，确认 Monotonic Guard 未漏检。
5. 测相同名字在 Agent OWN layer 上已被 Team 工具或 MCP 注册、重复注册失败、安装中途异常、disposer 逆序/交叉顺序、同一 Member 恢复时重复安装。遮蔽层必须比 Adapter 存活更久；**部分装配不能发布 Agent**。
6. 模型 `native`、`both`、`ptc` 三模式，验证模型外层 `run_code` 与内部 `tools.grep`；Direct `ctx.tools.execute`（带 Agent）、Agent-less host 调用（明确是否不属 Team）与自定义复合工具嵌套 dispatch 分别归档。对于未知新工具与可检测绑定漂移，禁止未经再次绑定检查的调用。
7. 检查 ToolRuntime 早期捕获 `projectContent/finalizeContent` 与晚期执行时查询工具体是否产生结果/权限不一致；不能仅保证 `execute` 计数合格而接受敏感结果投影泄漏。

**必需断言：** Adapter 正常调用数=1、原体=0；所有 Team 负例原体=0；B 未受影响；遮蔽卸载顺序失败时无原体执行；guard 的授权对象仍与最后实际绑定一致。请另外记录运行中的原 Adapter 是否被错误终止或结果 Finalizer 与所运行的定义不一致。

**注意：** `tools.restrict` 不过滤本 Scope 的注册，故遮蔽与 Adapter 的生命周期必须作为**一个有序原子装配单元**处理。并且 `tools.restrict` 不能约束保留的 `run_code`；不能把同一技巧直接套用到 PTC 传输工具。

**分歧裁决：** 如果独占分发失败，先尝试公开的长存活遮蔽、有效版本锁定或执行租约；只有证明无法在 public API 上安全实现才记录 `CORE_SEAM_BLOCKER`。如果 Fork 同样依赖不安全的 ToolRuntime 分发，则**禁止错误地将 Fork 视作已经解决问题**。

### P0-2：`grep/glob` 两条无 Fork 路线竞赛

**R2（保留完整原生工具体）**：

- 创建 Agent 作用域内的 `ctx.isolate('subprocess')` Service Realm，部署受约束 Provider；通过原生公开 `applyGrepTool/applyGlobTool`（或合法 Plugin Mount）在该上下文独立注册原生工具。
- 检查该工具的闭包实际捕获**隔离后的** `ctx.subprocess`，并且原有 `ctx.spillStore`/SystemPrompt/Tools 仍是正确 Agent Scope；绝不因 isolate 使 sibling 使用相同 Provider 或把原生工具注册在错误的 Scope。
- 处理形状矛盾：上游 `ctx.subprocess.spawn(spec)` **同步返回** `SubprocessHandle`，而 `ctx.sandbox.confine(argv, policy)` **异步**。先验证**调用前准备隔离计划**可否使用可信执行上下文精确关联本次 `spawn` 与已获准的 Grant；若采用同步代理 Handle，必须覆盖 `done`、piped stdio、collected readers、`terminate`、`waitForExit` 与取消竞态并明确复杂度。**不得使用 Agent 共用的可变 currentGrant 或因未知而无沙箱直通。**
- 若服务隔离无法安全解决 per-call Grant 或 sync/async shape，请留下最小反例，不为挽救 R2 而扩展通用 Subprocess API 的未验证语义。

**R3（公共辅助函数组合）**：

- 直接从 `@deepseek-ai/dsh-tool-fs-search` 包根导入 `parseGrepArgs`、`buildGrepCommand`、`parseGrepMatches`、`parseGlobArgs`、`buildGlobCommand`、`resolveRgPath`、`toWorkdirRelative` 等确有导出的函数；
- 在 Team ToolDefinition 的 **async execute** 中先 `await` 编译/实施 Sandbox，再使用现有公开 Subprocess Provider `spawn({argv: confined.argv,...})`，并复用上游解析/格式化 API；保证无 `src/*` 私有导入；
- 单独处理原生完整结果超量 Spill、`tools/post-execute` 的定义对象身份判断、`presentationMeta`/`render`、`exec.parent` 的 PTC 语义。**禁止仅凭小结果样例声称与原生结果完全等价。**

**对照用例（R2/R3 均执行）：** 空匹配、非法 regexp、无匹配退出码、二进制/非 UTF-8 命中、hidden/ignored、VCS excludes、绝对/相对路径、工作目录别名、时间排序、超 100 文件结果、超 250 grep 命中、raw output overflow、后处理 Spill Store 不存在/失败、取消、timeout、后台输出误报、PTC 内层调用、两个 Agent 并发和 1 次中途卸载。对照实际原生结果的 `value`、`content`、`presentationMeta`/`meta` 及 error code/信息类型，允许的差异单独备案。

**技术决策优先规则：** R2 若可以完整复用原生实现且安全等价，则优先 R2；R2 如对同步契约、隔离身份或授权串扰存在不可消除问题，而 R3 通过，则选 R3。R3 若仅差少量、可明确维护的输出投影或 Spill 逻辑，不因此触发 Fork；必须证明核心功能不可重组才进入 R4 资格审查。

### P0-3：Controlled FS 与精确 Grant

- 在不改上游 `ctx.fs` 类型的前提下探索**安全地传递**调用身份和 Effect Grant 的两种方案：按 Agent 绑定固定 FS Policy 的专用 Service，以及在 Team ToolDefinition 内显式将 Grant 交给 Trusted FS Adapter。**不要**将一次性 `ask` 资源临时扩入整个 Agent 共享 FS 权限。
- 测 `read` / `read_image` / `write` / `edit` / `str_replace_editor` 各子命令的隐含操作：`stat`、`listDir`、`readText/streamText/readBytes`、创建、覆盖前 `before`、搜索替换时的读、返回 Diff 中的原内容、元数据观察和可选 `watch`。只授写权限不能借写工具获得未经授权的旧内容。
- 对两个并发调用施加不同一次性 Grant：允许 A 读特殊目录、拒绝 B；在 B 的 I/O 中途完成 A 的审批/执行，保证 B 永远无法读取 A 的额外资源。
- 包括相对路径以 immutable Workspace 锚定、`~/` 目标 Realm Home、前后空格路径不被 trim、相对 `..` 拒绝、绝对路径明确授权、symlink retarget、同一对象的多路径身份、硬链接/挂载/rename 竞态；记录不能强制的范围和原因。
- 检查 `ctx.fs.sandboxMode` / 原生用户批准升级接口是否有机会绕过 Team 上限；Core 的 `sandbox_permissions` 获批**不等于** Team 获批。

**GO 判据：** 读/写真实副作用可在操作边界被限制，所有未批准读取不会因假允许的 `ctx.fs` 路径而披露；并发 one-shot Grant 不串扰；不承诺当前 Provider 未实现的 POSIX/Windows 原子别名保护。

### P0-4：Confined Spawn / OS Enforcement

- 以 Linux 为第一强制目标；记录 bwrap、Landlock 安装、功能探测、实际用户 namespace 与 mount namespace 能力。**有 bwrap 二进制不算执行保证通过**。当前上游 `bwrapProfileArgs` 的 `--ro-bind / /` 对 restricted READ 不合格。
- 最小案例：`allowed/read.txt` 能 read、`private/secret.txt` 无法 read、`allowed-output` 可写、`private` 不可写、目录枚举/metadata 与策略相符、符号链接/`..`/别名绕过失败；网络 deny 对 IPv4、IPv6、loopback、代理和必要的 Unix sockets/inherited FDs 不可误报。按策略无法保护的一项即 `IO_POLICY_UNSUPPORTED`。
- 先在基础执行环境演示受限 shell/rg 子进程，随后对 `grep/glob`/Bash/PTC/LSP **同一策略**分别验证。子进程及其后代不可脱离限制，程序可以读取被显式允许的运行时库/可执行文件，但不可从 runtime base 得到随意读取 Host Home 的能力。
- 对 “read all / write restricted”、 “read restricted / write restricted”、 “write-only/no-read”、受限网络 destinations 等组合逐项记录是否**可精确表达**；不存在对应 Provider 时明确 `UNSUPPORTED`，不按宽松模式运行。
- 异常与取消：Sandbox 启动失败不执行裸进程；启动后的杀进程树、`timeout`、后台 Job 停止与清理事实必须可核实。Windows 若只能做到部分写隔离，不得标记与 Linux 严格读权限等价。

**GO 判据：** 实际文件/进程/网络效果与要求契约相符，且启动失败零 side effect；`SANDBOX_UNAVAILABLE`、`IO_POLICY_UNSUPPORTED` 与工具本身的非零退出码明确区分。

### P0-5：PTC / LSP 的特殊执行生命周期

**PTC（`run_code`）：**

- 验证原生 Registry 对 `run_code` 禁止 `tools.register` 与 `tools.restrict`，不能以普通同名 Adapter PoC 的结果代表它的支持。
- 检查外层 `run_code` 的 Team Admission 与最终约束能否通过公开的 `ctx.ptcRuntime`、`ctx.sandboxPolicy` 或其他公开接缝**按 Agent/调用绑定**；尤其 `ToolRuntime` 内部从其自有 `this.ctx` 查 Runtime/Policy，Agent 作用域隔离不一定影响这条根上下文读。
- 外层 Node 进程直接 `fs`/`net` 必须符合强制保证；内部 `tools.read/grep/bash` 各自再次经过 Team 工具绑定、Approval 与 Guard。父调用不应自动授权所有子工具。
- 对父调用取消、内层子工具等待 `ask`、并发子调用、原始结果消耗、父进程结束时的 `drainDispatches()` 和无原体回落做负例。
- 如果当前公开接口无法保障严格 `run_code`，允许该工具在严格 Profile 下**明确拒绝**；这不代表普通 native tools 或整个 Alpha.5 必须停止。把具体缺口单独记成 `CORE_SEAM_BLOCKER`，不要谎称用同名代理替换成功。

**LSP：**

- `tool-lsp` 的 Host 文件读取走 `ctx.fs`；语言服务器通过 `ctx.subprocess.spawn` 在每个 Provider/Workspace 上持续运行，必须同时约束两者。
- 使用**虚构、可审计的 stdio language-server Fixture** 验证：首次启动、相同 Workspace 复用、两个 Agent 同名 Workspace 但不同 Read ACL 不能复用危险实例、权限降级后 Server 退出并重建、退出/取消后无残留进程。验证 LSP Server 自己无法读取限制目录，不能以 `workspace/applyEdit` 已被 Host 拒绝作为全程只读证明。
- 验证跨 Region/Execution Realm 不因为路径字符串相同而共享 Server 的权限身份。

**P0-5 判据：** 选择性按工具给出 “受支持 / 严格模式拒绝 / 需要 Tool-Level Fork 证明 / 需要上游接口” 的逐项结论，不允许特殊工具隐式复用宽松 Host 服务。

### P0-6：Team 真实组合与权威回归

- 在真实 Team 的 Agent Setup 阶段验证**Preset mount → builtinToolDeny → Team Adapters 的继承遮蔽 + Scoped Registration → Team Tool/Skill → MCP reconcile → 最终 Dispatchable Coverage → Policy/Guard**。这些不是新的强制全局装配顺序，必须通过最终实测保证自己的装配没有与现有先后顺序竞争。
- 禁止 `builtinToolDeny` 原先屏蔽的工具因 Team 自注册重新出现；对未声明管理的动态工具以 fail-closed 而非自动白名单处理。
- 复用 Alpha.4 已有操作指纹、AuthorityCeilingEvaluator、ApprovalCase、一次性批准消费与 last-mile 检查。PoC 可以在临时 Fixture 中模拟 vNext `RequestedEffectSet`，**不得直接把未来 Schema 字段写入现有生产 Blueprint v3**。审批域要区分 Expansion Plane 的 `no-match=no-authority` 和 Approval Plane 的 `no-match=no-narrowing`，不得因为新资源类型加入而误统一两者。
- 测 `teamHardEnvelope` / `permissionMutationEnvelope` 的不同 Reviewer 门限、多资源 Ask 的最高合法共同审批层级、拒绝任何未知 Effect、审批时权限世代变动、不合法批准不消耗 Grant、域服务对独立业务状态拒绝。Domain 实验使用本地 Fake Service，既不重写研究状态账本，也不访问真实设备。
- 装配/冷恢复/热注销/外部 Core Ask 同意/后台 Job 恢复均应拒绝任何没有 Team 有效绑定与真实隔离保证的调用。

**P0-6 GO：** 在 **pinned Real Host** 而不只是测试 Double 里完成至少一组 end-to-end “受限文件 read + 搜索 + Bash/PTC 对照 + 禁止/审批” 的实证；每个通过的工具族有运行时计数、OS 副作用证据、版本化资格表。

## 4. 最小测试 ID 清单（必测项，不允许被总通过数掩盖）

| ID | 场景 | PASS 必要证据 |
| --- | --- | --- |
| BND-01 | A 同名覆盖原生、B 使用原生 | `get/schemas/execute` 及双方 body 计数 |
| BND-02 | 先 restrict 后 register；撤销 Adapter 时 restrict 保留 | Team 原体 0，未注册时 UNKNOWN/拒绝 |
| BND-03 | 错误顺序卸载 + Ask/Guard 后暂停竞态 | 危险序列在失效关闭实现中不可执行原体 |
| BND-04 | `pre-execute` 提前 allow/around wrapper 暂停 | Guard 不被跳过，最终 body identity 一致 |
| BND-05 | Own-layer 同名冲突、MCP 更新、冷恢复 | 装配不部分发布，未知绑定 fail-closed |
| BND-06 | PTC 内层 `tools.grep` + agentless caller | Team inner call 独立授权；Agentless 范围明确 |
| SRCH-01 | Isolated Subprocess 原生 `applyGrepTool` | 独立服务真的被工具闭包使用，A/B 不串扰 |
| SRCH-02 | `spawn` sync vs `confine` async | 证明方案不使用未授权 ambient grant / 暗中裸运行 |
| SRCH-03 | public helper composed `grep/glob` | 无私有导入；参数、error、value、render 等价 |
| SRCH-04 | 超量内容 Spill/PostExecute | 完整恢复结果不丢失、不越过读策略 |
| FS-01 | `read/read_image/stat/listDir` 读取拒绝 | 实际内容/元数据 I/O 拒绝，无仅输出过滤 |
| FS-02 | `write/edit/editor` 隐式读取与旧内容 | 禁止旧内容披露，结果符合 read/write 双权 |
| FS-03 | 同 Agent 并发两份不同 one-shot Grant | 授权零串扰、不复用已消耗 Grant |
| FS-04 | symlink、别名、`..`、前后空格 | 使用实际对象身份拒绝逃逸，合法带空格路径保留 |
| PROC-01 | Linux Allowed/Denied 文件与网络 | 同一真实 Sandbox 中正控成功、负控 syscall 失败 |
| PROC-02 | runtime dependency 与禁止目录 | 不因可执行环境偷渡 Home/秘密数据 |
| PROC-03 | 沙箱不可用/启动故障/子进程/取消 | fail-closed + 无遗留裸进程 + 退出证明 |
| PTC-01 | `run_code` 不可同名注册与不能 restrict | 显式实际返回/错误；严格 Profile 不绕过 |
| PTC-02 | Node 直接 I/O 和内层 `tools.*` | 外层 OS boundary + 内层 Team Admission 均有效 |
| LSP-01 | Language server per scope/realm & policy rebind | 不共享越权进程、不留存旧权限 |
| GOV-01 | Alpha.4 多 Effect Ask 与世代变化 | 合法最高需要权限；过期/未知拒绝 |
| GOV-02 | Domain fake service 拒绝 | Team allow 不能覆盖 Domain deny |
| REG-01 | 独立真实 Host 复验 | 再现最关键的正/负例、同一锁定 SHA、干净 upstream |

完整验收应补充多轮**确定性事件栅栏**重复运行：涉及 async 和卸载竞态的 case 不能只跑一次“碰巧绿”。记录每轮尝试次数和失败率，不允许用测试名称包含关键字代替断言证据。

## 5. 选型算法：逐工具出结论，不作全盘二选一

**条件依次判定：**

1. `R1` 注册/遮蔽/Guard 的独占生命周期 **FAIL**：该工具不得进入任何受保护执行。先尝试公开生命周期修复；若不可行，记录 `CORE_SEAM_BLOCKER`。在此问题未解决前 Fork 工具体无意义。
2. `R1` PASS 且 `R2` 可在原生完整工具体内提供准确的 per-call FS/Spawn 限制及结果等价：**SELECT R2（无 Fork）**。
3. `R2` 不满足，但 `R3` 使用公开包根辅助函数可保持必要工具语义与安全保证：**SELECT R3（无 Fork）**，记录显式维护的粘合/渲染部分。
4. R2/R3 均被**最小 public-seam 反例**否定，且 Fork 仍可通过同一 `R1` 防绕行门：**FORK-ELIGIBLE**；启用工具级回退与具体债务登记，不等于自动允许改 Core。
5. 仅因本机无法建 namespace、缺依赖或环境权限不足导致失败：**ENV_BLOCK**，安排支持环境复测；不能直接把其归咎于 DSH public API。
6. 工具某种能力组合无法精确实现（例如 write-only 进程视图、域名细粒度网络）而其他组合能实现：标 **BOUNDED-DEFER**，清楚指定拒绝的策略形态，禁止宽松执行替代。
7. 工具即使 Fork 也不能独占、Provider 违反保证或需要 Core 私有 API：**BLOCK**，需要未来 upstream public seam；不可在本轮悄悄实现不安全通路。

**最终 verdict 只按“工具族 × 所需 Policy Capability × Host/OS”产生：**

| Verdict | 意义 | 是否允许后续实施 |
| --- | --- | --- |
| `GO-R2` | 公开装配与隔离服务充分，经 Real Host 验证 | 可以编写正式 Adapter 实施计划 |
| `GO-R3` | 公开辅助函数独立组装满足功能/安全门 | 可以编写正式 Adapter 实施计划 |
| `FORK-ELIGIBLE` | 独立路线被精确反例否定；受限工具 Fork 可解决且有退场路径 | 仅按 A5-FORK 专项债务与审核实施 |
| `BOUNDED-DEFER` | 特定模式/OS/工具未满足，调用真实失败关闭 | 只实施已证能力，其余不可用 |
| `ENV_BLOCK` | 实验环境不具备证明条件 | 不得以其代替技术选型结论 |
| `CORE_BLOCK` | 所需公开分发/生命周期接口不存在、Fork 也无法闭合 | 停止受影响功能，提出上游接口需求 |
| `INCONCLUSIVE` | 证据缺失/测试未运行/原体无法观测 | 不准写“可行且安全”结论 |

**GO 不代表 Alpha.5 实施完成；只代表选型条件已通过 PoC。** 失败的工具不得因相邻工具通过而自动继承 GO。

## 6. 证据、审查和交付模板

每个 PoC 包必须交付：

- `hypothesis.md`：明确要证伪的命题、公有接口、信任模型、输入环境与是否有可行替代；
- `source-map.md`：真实 pinned SHA、源码链接与公开包根导出证据，不以私有 `src/*` 导入参与实现；
- `fixture/` 与可执行 `run` 脚本、测试清单及 `expected-vs-actual.json`，包含 body counters、实际文件/网络副作用和完整退出码；
- `negative-cases.md`：至少一个具有正控的拒绝测试、竞争事件栅栏复跑及导致 FAIL 的最小反例；
- `parity.md`：schema、value、render、meta、timeout、cancel、jobs/Spill 的原生/Adapter 对照与差异；
- `decision.md`：逐工具 `R2/R3/FORK/DEFER/BLOCK` 结论，证据路径、不能保证的组合、下一实现 PR owner。

集成收尾以一份 `P0-SELECTION-REPORT.md` 交付，包含下表实际填值：

| Tool family | Original-body zero proof | Actual FS read/write | Network/children | Native parity | Selected route | Residual risk/evidence |
| --- | --- | --- | --- | --- | --- | --- |
| FS tools | NOT_RUN | NOT_RUN | N/A | NOT_RUN | PENDING | — |
| grep/glob | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | PENDING | — |
| bash/pwsh | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | PENDING | — |
| run_code/PTC | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | PENDING | — |
| LSP | NOT_RUN | NOT_RUN | NOT_RUN | NOT_RUN | PENDING | — |
| web/jobs/MCP/domain sample | NOT_RUN | N/A/provider-owned | NOT_RUN | NOT_RUN | PENDING | — |

每项“NOT_RUN”必须被真实证据替换才允许相应领域 GO。不得仅提供工具成功运行时的截图、空命中日志或只测 mock 的报告。

### 6.1 CORE_SEAM_BLOCKER 固定格式

必要时记录：

`hostSHA`、`publicSeam`、`requiredBehavior`、`observedBehavior`、`minimalReproducer`、`affectedInvariant`、`alternatePublicRoutesExamined`、`whyToolForkHelpsOrCannotHelp`、`proposedUpstreamGenericAPI`、`affectedToolFamilies`、`safeFallback`。

**并同步技术债务：** 只有实际启用工具级 Fork 后，新建 `A5-FORK-<family>`（上游 version/SHA、MIT/NOTICE、最小差异、Owner、升级安全响应、偿还验收）。只提出候选不记作已产生债务。DSH 将来公开充分接口后，应独立改回非 Fork 并删除复制的上游工具代码。

### 6.2 审查重点与退出条件

独立 Reviewer 必须至少亲手核对：Pinned Host 未变、原体零执行、丢 Adapter 不回落、PTC 子分发、真实拒绝 I/O、同 Agent 并发 Grant 无串扰、两 Agent 隔离、取消/进程树、read-before-write 与 Spill、缺失 Sandbox 时 fail-closed、无私有导入与 Core 修改。

**P0 完成条件：** 对主要原生工具族作出证据支持的逐项路线选择；没有把重要的 `INCONCLUSIVE` 伪装为 `GO`；存在未过的功能明确登记为 `BOUNDED-DEFER / ENV_BLOCK / CORE_BLOCK`。所有上游约束与测试隔离得到审计证明，结果可以直接喂给下一阶段的实施计划，不需要重新讨论当前架构语义。

---

**本指导的边界：** 这份文件只定义**要验证什么、怎样验证、什么结果可以选型**。实现 P0、启用任何真实 Fork、Schema 迁移和 Alpha.5 产品合并须遵循后续正式阶段流程。即使 PoC 的所有工具选择通过，也不能将其等同为已完成 Production Safety Assurance。