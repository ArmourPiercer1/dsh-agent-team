# PR6 PoC6a/PoC6b — SEAM-VERDICTS（PoC-1 格式三态记录）

- Lane E（PR6 PTC PoC6a + LSP PoC6b）writer；模型逐字 = `You are a coding agent powered by the qwen3.8-flash-next model.`（模型 `qwen3.8-flash-next`）。
- 记录日（UTC）：2026-10-16（fold 轮修正：原稿误作 10-19；基准 = committed result json `recorded_at_utc` 与 commit 日期，review-LaneE MINOR-1）。基线：team base `db5cb5f7`（branch `alpha5-pr6-ptclsp`）；Host T = pristine 0.2.0-rc.2 @ `639ed01539`（porcelain 前后均空；只读；路径=既有 PoC worktree 检出，见 runner `host_env.test_use`）。
- 三态 = `SUPPORT`（公开 seam 可钉住该性质）/ `typed-reject`（公开 seam 可先于副作用类型化拒绝）/ `SEAM-GAP`（公开面不可表达，记录缺项）。
- 格式沿用 PR1 `s12-evidence.md` "PUBLIC-seam gap (PoC-1 format)"：`seam asked for / what it gives / what it does NOT give / consequence / residual`。
- 复现：`node p6a-runner.mjs`（EXIT=0，9 legs）、`node p6b-runner.mjs`（EXIT=0，10 legs）；证据 = 同目录 `p6a-result.json` / `p6b-result.json`。DORMANT：无任何东西接线进装配；无端口、无 DSH_HOME 世界（分配位 3183 / `tests/homes/a5p6-*` 未使用，如实记录）；:3080 未触碰。

## PoC6a — D 类（PTC/run_code）：scope 隔离与身份归属

### A1 内层 `tools.*` 调用的效果归属 — **SUPPORT**
- seam asked for：钉住"哪个 member 的哪次 run_code 的哪个内层调用产生了哪个效果/事件"。
- what it gives：生产桥逐内层调用注入 `{ callId: `${parentCallId}:ptc:n`, rootCallId, agent: exec.agent, parent: exec.token }`（ptc.ts:545-553，fold 轮修正：原稿误作 525-536；pinned src `639ed01539` 逐行复核，review-LaneE MINOR-2）→ 内层走同一 scheduler prepare/dispatch/finalize/finish（guard/post-execute/Spill 全管线），durable `tool/ptc-dispatch-start/settle` 只 append 进**拥有者 session**（ptc.ts:611-618）。
- what it does NOT give：（无关键缺项；身份=agent 对象，Team 需保证 member↔agent 绑定由装配持有。）
- 证据：P6A-2 两 member 并发、体内重叠窗口内 `enter` 身份互不漂移（`member-A/p6a-c4:ptc:1`、`member-B/p6a-c5:ptc:1`），session 日志零交叉条目。

### A2 外层 run 的 standing policy 逐 member 交接 — **SUPPORT（session 粒度）**
- seam：`options.resolveSandboxPolicy(exec)`（ptc.ts:391 → index.ts:948-952 `policy.resolve({session: exec.agent.session})`；真实现 = SandboxPolicyService.resolve 的 mode/session-cwd/sessionId 三级，sandbox-policy/src/index.ts:166-178，本 fixture 用镜像 stub 只测通道）。
- 观测：三个 session（含与 A 同 cwd 不同 sessionId 的 C）逐调用收到各自 session 并产出各自 policy → `spec.sandboxPolicy` 按 member 分路。
- does NOT give：**session 以下**的任何粒度（无 per-call OperationGrant 通道）；`sessionId ≠ memberInstanceId`（Team 模型一 member 一 session 时等价，装配须保证）。

### A3 `PtcRunRequest` spec 自身的运行身份 — **SEAM-GAP**
- seam asked for：`ctx.ptcRuntime.run(spec)` 从 spec 即可判定该外层 run 属于哪个 member 的哪次调用。
- what it gives：`spec_keys = [bindings, cwd, program, sandboxPolicy, signal, timeoutMs]`（运行时实测 census，P6A-3a）；`sandboxPolicy.sessionId` 仅在 runtime 声明 `sandboxMode` 时存在且为 session 粒度。
- what it does NOT give：agent/member/callId/owner/grant 任何字段。**负控 P6A-3c：同 member 两次并发 run 的 spec 深相等** ⇒ 纯 spec 通道无法把 per-call Grant 绑到"这一次" run。
- consequence：S0 §9 问句"spec 自带精确 Grant"分支 = 不成立；工具级 Fork 不得为此绕开保留 transport 的 Core 限制。

### A4 组合公开 seam（around-listener + ALS + ptcRuntime 替换）— **SUPPORT**
- composition：root `ctx.on('tools/execute', (exec,next)=> als.run({member:exec.agent?.id, callId:exec.callId}, ()=>next()))` + Team 实现公开抽象类 `PtcRuntime` 替换 `ctx.ptcRuntime`，在 `run()` 入口与重包的 binding 闭包处读 ALS。
- 验证（非循环，P6A-3b）：4 个交错并发 run（含同 member 双发）下，binding 时刻 ALS `callId` 与 body 观测的 `subCallId` 前缀逐一配对且 member 一致；ALS 与 root dispatch 真值表一致。
- 机理保证：`binding()/drive()` 位于每次 `execute()` 的闭包内（ptc.ts:415-686）⇒ per-run driver lane 天然携带本 run 的 async 上下文；`run(resolve(...))` 在 execute 体内同步调用 ⇒ ALS 无竞态窗口。
- residual（披露）：(i) 依赖"listener→body 同步段"结构，上游若插 await 需复测；(ii) binding 记录对象被桥 **non-writable** 冻结（`Object.defineProperty(..., {enumerable:true})` 默认）——Team wrapper 必须**重建** spec.bindings 而非原地改（实测证据）；(iii) ALS store 缺失必须 fail-closed（拒绝该 run），不得回落猜测。
- 结论分支（S0 §9）：`无法证明 per-call` **不成立**——经该组合公开 seam，"精确本次 OperationGrant → 真实外层 runtime"可关联；启用 Strict `run_code` 仍需 PR4 ConfinedProcessProvider 的外层 OS 强制（本腿 NOT_RUN，见 A7）。

### A5 外层 run_code 的每 member 类型化拒绝 — **typed-reject**
- guard 在 `scheduler.prepare` 体内、body 之前命中（index.ts:1519-1530）；run_code 被保留于可见性过滤之外但**不**豁免 pre-execute/guards：P6A-4 中 B 被拒（typed reason 到模型）、`runtime.run` 计数 0，A 正常执行。

### A6 around-seam 的 scope 可见性隔离 — **SUPPORT**
- 在 member-A 的 scope ctx 注册的 `tools/execute` 监听器只收到 A 的外层 run_code + A 的内层 grep（carrier=`scopeTarget(this, exec.agent)`，index.ts:1603；events flow up-never-down）；root 监听器收全部（Team guard 信任假设，如实记录）。

### A7 取消边界（C-GW 分型）+ 外层 OS 强制 — **SUPPORT（分型）/ NOT_RUN（OS）**
- 程序可见两形态实测（P6A-6）：在飞 = `run_code run is over (user-cancel); grep result discarded`；其后排队 = `... not dispatched`；sibling member 正常完成。`drainDispatches` = DRAINING settled 边。
- NOT_RUN：外层 Node 真实进程 fs/net 的 OS 拒绝（= `ptc-runtime-node` 经 `ctx.subprocess.spawn` + `ctx.sandbox.confine(argv,policy,signal)`，ptc-runtime-node/src/index.ts:236 —— 该装配路径**存在**且消费 PR4 向 ConfinedArgv{argv,enforcement,denialSignatures,runnerFailureRules}；OS 强制正/负控归 D3/D5 host 腿）。

## PoC6b — E 类（LSP）：池键与 service 生命周期隔离

### B1 原生共享池 = 路径键（对照负控）— **HAZARD 确认（as-expected control）**
- 同 `workspaceRoot` 串、两个（调用方侧）策略主体 → 同一常驻 pid + 同一 server 侧 didOpen 账本（opens=2）。P0-5 L3 在本宿主复现；键=fs targetKey，`LspQueryRequest` 无 caller/policy 字段（lsp/src/types.ts:38-47）。

### B2 `ctx.isolate('lsp')` + per-realm `plugin(Lsp)+plugin(lsp-stdio)` 重装 — **SUPPORT（realm 粒度）**
- 同 workspace → 每 realm 独立常驻 pid（51/60/根 42 互异），realm 内热复用；server 侧效果账本 realm 私有了（各自 opens=1）。
- 池隐私来源 = **per-realm provider 实例**（每 realm 一个 provider 池 Map），不是池键变宽——池键仍是纯路径。

### B3 真实模型路线 `tool-lsp → ctx.lsp.query` 按 member 解析 — **SUPPORT**
- `createScope(inner, agent).ctx.isolate('lsp')` 子上下文同时携带 scope 标（工具层键）与 isolate label（Lsp 解析）；per-member 挂 `tool-lsp` 成功（scoped 注册合法：index.ts:747 "per-agent variant … through that agent's ctx"）。
- 模型 route `execute('lsp', {agent})`：两 member 解析到**不同 definition 对象**、不同 pid，server 侧 opens 各 1 ⇒ S0 §9 PoC-6b 主问句（scoped service re-mount 在真实调用链中真的解析每 Member 实例吗）= **通过**。

### B4 realm 以下（policy/policyGeneration/trustRoot 进池键）— **SEAM-GAP（上游）**
- 一个 realm 内两个策略标签同 workspace 仍共享 pid（B1 即其形状）；公开面没有任何策略输入通道可让池键含 policyGeneration，也没有 generation 变更强制逐出钩子；spawn spec 无 per-policy 约束参数（server 进程 OS 读不受 ctx.fs/沙箱中介 = P0-5 L4/L6 结论，本腿沿用不重跑）。
- consequence：realm 是公开面可表达的**最细**隔离粒度；`memberInstanceId + realm + provider + workspaceIdentity + policyGeneration` 全键设计要求上游扩展点（P0-5 §6.1 素材在本 host 复核仍然成立）。**严禁把共享池改名复用冒充隔离。**

### B5 terminate 与 lease 边界（对 C-PROC/C-GW 契约）— **SUPPORT**
- C-PROC `terminate`（≠cancel，终止确认有界）：忽略 shutdown 的虚构服务器下，dispose 预算（1200ms）→ SIGTERM/SIGKILL，**dispose await 到进程关闭**（实测 1217ms 后 pid 消失；instance.ts:267-301 "nothing outlives disposal"）⇒ `EXECUTION_TERMINATION_UNCONFIRMED` 在此 seam 可避免。
- cancel≠terminate：查询 cancel → 类型化拒绝（`LSP query aborted`）→ 被取消实例被终止（旧 pid 即逝）→ 下一查询**重生新 pid**（opens=1 证新实例）。
- C-GW lease ACTIVE→DRAINING settled 边：dispose 后在飞/排队均以 `LSP_DISPOSED` 类型化落定；settle 后再查询报 `no LSP provider handles ...`（provider 已注销）⇒ **settled 后不可能再起进程**（aborted-先于-I/O，index.ts:261-262）。
- 分型披露：已开始/未开始在**错误码面不可分辨**（同为 `LSP_DISPOSED`）；区分在**效果面**（旧 pid 终止可观测 vs 从未 spawn）。对 C-GW "事件面可区分"要求，LSP seam 处记 residual（若 Gate 要求错误面分型，属上游小缺口候选）。

## 综合三态结论（供 PR6 门 / PR8 矩阵）

| 腿 | 三态 | 一句话 |
| --- | --- | --- |
| 6a 内层效果归属 | SUPPORT | 生产桥自带 member+父调用身份，事件只入拥有者 session |
| 6a standing policy | SUPPORT(session 粒度) | 逐调用 exec.agent.session 交接，session 以下无通道 |
| 6a spec 自带身份 | SEAM-GAP | PtcRunRequest 无任何身份字段；同 member 并发 spec 深相等 |
| 6a 组合 seam | SUPPORT | around-listener+ALS+ptcRuntime 替换可精确关联并发调用（fail-closed 纪律入装配要求） |
| 6a 外层类型化拒绝 | typed-reject | guard 先于任何特权，run 计数 0 |
| 6a scope 监听隔离 | SUPPORT | scope-tagged 监听只见本 member |
| 6a 取消分型 | SUPPORT；外层 OS 强制 NOT_RUN(D3/D5) | discarded/not-dispatched 两形态实测 |
| 6b 共享池 | HAZARD 确认 | 路径键共享 pid+服务端账本（对照） |
| 6b realm 重装 | SUPPORT(realm) | isolate+per-realm provider ⇒ 私有池；dispose 只杀本 realm |
| 6b 真实路线按 member | SUPPORT | tool-lsp per-scope 挂载，模型 route 解析各自实例 |
| 6b policyGeneration 粒度 | SEAM-GAP | 池键无策略输入；realm=公开面最细粒度 |
| 6b terminate/lease | SUPPORT | 终止确认有界；settled 边不可能再起进程（错误面分型记 residual） |

PoC 分叉判定（S0 §9）：**PoC6a**=中间分支成立（可信 Runtime 组合 seam + 固定 session-Realm 策略 + one-shot 扩权走既有 approval 通道（ptc.ts:395-406 逐调用 agent/callId，静态引））；Strict 启用另需 D3/D5 的 OS 强制实证。**PoC6b**=第一分支通过（每 Member 持久池可建），条件=每 member 一 realm、policy-generation 逐出缺口如实挂账、原生共享池禁止改名复用。
