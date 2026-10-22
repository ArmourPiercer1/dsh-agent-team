# Alpha.5 — S0 + PR0–PR8 分阶段实施计划（PoC 选型后）
> **[2026-10-22 banner] historical / superseded-by `docs/plans/active/alpha5-tool-io-governance/current-execution-plan.md`** — 本文档的阶段状态与采纳状态（含 PROPOSED 提案）为记录时点，当前执行以该入口为准。设计约束/需求正文**仍有效**（本 banner 不宣告设计失效）；正文未改动。

**状态：PROPOSED / NOT STARTED，待开发阶段启动和合并门裁决。**  
**日期：2026-10-16；依据 PR #249 当前 PoC HEAD `a2e741a02c4f0126f0aa6615c02c51877f7f3dba`；DSH Host pin `639ed015397290b3745d163aafe02ffee4aa3f84`（0.2.0-rc.2）。**  
**技术细节唯一引用：** [接管分类与执行控制设计](./post-poc-technical-design.md)；裁决权威为 [Alpha.5 ADR](./ADR-alpha5-tool-io-governance.md) `8、[Architecture V2](./architecture.md) `14；历史证据在 [P0-SELECTION-REPORT](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/P0-SELECTION-REPORT.md)、[NEG-1..12](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/negative-cases.md)、[landlock lanes](../../../../dev/agent-workflow/evidence/alpha5-adapter-p0/10-landlock-lanes/notes.md)。本计划作为未来实施候选，不优先于在行 Alpha.4 计划或冻结 20260829 文档，直到用户批准阶段转换。

## 0. 目标、工程红线、范围与阶段出口

**目标：** 在 DSH 0.2.0-rc.2 PUBLIC seams 上交付独立可注册的 Team Tool I/O Governance；不改 Core、不使用私有 API；在真正的 FS/Process/Network/Remote 效果边界兑现安全承诺。普通 Agent 不受 Team 限制；所有 Team dispatchable 工具必须有可信 Binding 或被拒。允许声明仅特定 Provider/OS 下的受限功能，对不具备能力的组合 typed fail-closed。

**不得省略：**

1. `CORE PATCH BUDGET = 0`；禁止修改 upstream checkout/Core、`patch-package`、postinstall patch、DSH 内部私有 API、全局替换工具注册；`tool-level fork` 只在 public adapter 路线确实阻塞且最小复现支持时采用，具名 [A5-FORK debt](./tool-fork-debt.md)。
2. 不允许“原生工具体执行后才拒绝”、未受限 fallback、不批准即热启动 Bash、交叉使用不同 Member Grant、错误将 `stat` 能力标为 Landlock 完整限制、错误将 ABI4 网络能力当作 `network:deny all`。
3. 不修改 Alpha.4 既有 Role/Reviewer Authority、Envelope、不把用户不可认证的角色字段当作真实 Admin、Domain Gate 不能被 Team 审批覆盖。
4. 当前 Blueprint **v3 closed**；新字段只是内部 TypeScript 契约，直到最后迁移门才进入受支持 vNext。
5. 严格测试卫生：从 `tests/paths.mjs` 读取 pin；`tests/deepseek-harness-test-use` 必须 pristine、byte-clean；隔离 `tests/homes/<world>` 与 3180–3186 / 3491–3500 空闲端口；`:3080`、正式实例 HOME、真实设备/科研状态全部不碰。PoC 原始 569 文件保持在 PR #249；功能 PR 不复制它们，也不以历史 KIT 报告替代最终实测。
6. 每个 PR 的 Base/HEAD、增量测试、基线测试失败身份集合、独立 Reviewer 与 OS 取证同时留痕。优先证伪安全声明；每项负控必须有同环境正控（否则 `ENV_BLOCK`）。
7. 当前仓库正常门禁继承 Alpha.4 的差分 baseline 原则：`pnpm typecheck` / changed-file lint / 新增测试必须全绿；全仓失败集合不得产生 NEW，不能用“已有红”吞掉新的失效；构建产物/组成门按实际触达范围执行并报告，最终真实 Host Gate 独立复核。

**阶段结果**按工具/Provider/OS Profile 独立判为 `SUPPORTED`（全证）、`UNSUPPORTED`（正确拒绝）、`BOUNDED-DEFER`（明确依赖）、`CORE_BLOCK`（公开接缝证据不足且安全必需）、`NOT_VERIFIED`。不能从一个成功 PR 推断别的工具族 GO。

## 1. S0 + 九个 PR 的依赖与交付

| 阶段 | 交付核心 | 严格依赖 | 独立安全门 | 可并行 |
| --- | --- | --- | --- | --- |
| **S0** | 统一 PoC Selection Matrix / 宿主基线与平台 Capability Truth | PR #249 证据 | 旧结论已全部标 superseded，**不宣称产品 GO** | — |
| **PR0** | Binding、Effect、Realm、Grant、Assurance、ExecutionLease 纯契约 | S0 | 零生产行为变化，纯代数不容隐式扩权 | — |
| **PR1** | Closed-world Guard + Stable Scoped Dispatcher + 有序 Mask/Unload | PR0 | **NEG-1 / NEG-2 / NEG-12 / H6 dynRan** 真 Host 回归 | — |
| **PR2** | Operation Admission + Alpha.4 ApprovalCase 多 Effect + Grant 单次消耗 | PR1 | 角色天花板、一次性/竞态、完整 Effect Set | — |
| **PR3** | Trusted Controlled FS Adapter | PR2 | 受限读取、写入与旧内容保护，Hardlink/TOCTOU 不虚报 | 与 PR4 接口冻结后并行 |
| **PR4** | Linux Confined Process、Landlock、FD/Child/Network Capability SPI | PR2 | syscall 层正负控、真实 Host、无无沙箱 fallback | 与 PR3 |
| **PR5** | `grep/glob` R3 + Bash/Pwsh Tool Adapter + 原生等价层 | PR3 + PR4 | Spill/取消/输出及完整范围；后台任务保留授权范围 | 可内部拆两 lane |
| **PR6** | PTC 外层授权桥 + LSP  per-member 专项 PoC/适配 | PR1 + PR2 + PR4 | PTC outer/inner 双隔离；LSP 可隔离或实际禁用 | 与 PR7 |
| **PR7** | Web/Jobs/MCP/Remote + Domain Gate Provider | PR2；stdio 受限模式依赖 PR4 | URL/redirect、Job Owner、MCP 动态工具与领域最终否决 | 与 PR6 |
| **PR8** | Blueprint vNext / 兼容迁移 + 真实 Host E2E / Security Gate | PR3–PR7 完成或分族 defer | 无静默扩权、最终 Supported/Unsupported Matrix、独立复核 | 最后 |

**关键路径：** `S0 → PR0 → PR1 → PR2 → (PR3 ∥ PR4) → PR5 → PR8`。`PR6 ∥ PR7` 可在依赖满足后推进，与 PR5 并行只在文件所有权不冲突时允许。严禁跳过 PR1 直接在未治理 Tool Surface 上开发 FS/Process 并宣称安全。每个阶段独立 worktree/branch/writer，集成按顺序进行，禁止 force-push 已审核 History、未经授权合并 PR。

## 2. S0 — PoC 证据收敛与选型 Freeze（文档性阶段）

**目的：** PoC 报告存在早期判断、后期勘误和成功的真 Host Case；先构造唯一权威 `S0-SELECTION-MATRIX.md`，把“技术候选”与“产品支持”分开。

**工作项：**

- 核对 `P0-SELECTION-REPORT` `6 续轮、Landlock corrections、10-landlock、Web/Jobs/MCP 09 lane、H6 动态工具旁路；旧 `decision.md` 原始记录保留，新增精确 supersession 表，不篡改历史失败日志。
- 每工具绑定原生 source anchor、公开接口确证、真实 Host/fixture/OS syscall 的证据等级、未测试项、默认处理（支持或拒绝）、对应实施 PR 与未来 Fork 债务。
- 将二义词规范化：`R1` 为 Scope Binding；`R2/R3` 为工具实现选择；`R4` 为 Fork；`executionBoundary` 为可信 Host/真实进程/远端；Assurance 由有效 Policy 推导。
- 冻结性能测量方法（延迟 p50/p95，内存/CPU/进程数，按小/大用例），不是根据猜测设置一刀切阈值。
- 遗留差异：S0 不批准 LSP 上游方案，也不将 `strict read metadata` 修改为 content-only。
  
**测试/审查：** 检查所有 12 个 NEG 反例记录与对应 raw JSON/代码、Landlock 原始 errno，核对双 Reviewer 对应 SHA 与 Stage2b 10/10、H6 18/18；文档交叉链接与语义一致性 lint；S0 自检不运行生产代码。

**验收：** 一份唯一选型矩阵，明确 `P0 NOT CLOSED`；逐族能回答“首选/备选/不可用/PoC 分叉/owner/验收证据”。签订实施期的版本/测试基线。若结果不足，将其变成 PR 专项 PoC 而非草率 GO。

## 3. PR0 — 纯契约与不可变授权代数

**实现：** 在现有 `packages/runtime`/`packages/domain` 内建立内部 `ToolBinding`、`ResourceRef`、`RequestedEffectSet`、`OperationGrant`、`ExecutionLease`、`AssuranceContract`，以及独立的工具实现来源/执行边界/保证维度；类型精确限定 Member、Binding Revision、Authority Generation、Realm、完整 Arg/Effects Fingerprint、执行与撤销时效。资源匹配含真实 workspace、`~/` Home、绝对路径、目录与元数据/网络 Destination 的不同种类，不预先将实体对象简化为无安全含义的字符串。

**测试：** Canonical Fingerprint 的稳定性与冲突、隐藏参数不可忽略、资源 Realm 不可混淆、deny/ask/allow 求值、复合 Effect 去重顺序、不可变快照、无匹配规则的 Alpha.4 双平面差异（expansion no authority / approval no narrowing）；类型/Schema 否定测试，循环依赖/跨层 imports 审计。

**验收：** 不增加可用权限、不修改 v3 文件格式、不引入第二 ApprovalCase、不持久化任何新的默许许可；类型/纯测试全绿；存储和 UI 输出零变化。**接口冻结点：** `OperationAdmission`、`ControlledFs`、`ConfinedProcessProvider`、`ProviderGateway` 与 Result/Error contracts；PR3/PR4 可据此并行。

## 4. PR1 — 动态分发闭集、Scoped Dispatcher 和生命周期

**实现：**

- 在 Team Agent 的受信装配处先安装长期生效的 **closed-world monotonic Guard**，之后安装 `restrict` 的继承原体遮蔽，再在 Agent Own Scope 注册**稳定** `ToolDefinition`；Binding 改动更新内部不可变 revision，不靠卸载工具定义做普通策略变更。
- 建立 `PREPARING → ACTIVE → DRAINING → TOMBSTONED → RELEASED` 状态机；先拒绝新调用、保持 mask、取消/排空在飞分发，最后才允许解除 mask。必须记录自己持有的 lease/token 数，而非仅检查 Cordis Dispose 已返回。
- Team 身份可信映射、MCP 动态注册与 `tools/change` 观测、PTC 内层重复 Admission。除可信/显式 Binding 外未知工具 **deny**，包括 after-setup Own layer；明确不干扰普通 DSH Agent。
- Agentless lane：普通 Host 调用保持原状态；Team-origin nested calls 必须可信携带 Agent 身份，否则拒绝。
- 缺少必需 Service 时不接受 Cordis Fiber 静默 `PENDING` 当作“已完成装配”；完整 READY/Scope/Provider 否则 Team 成员不发布。

**强制负控：** NEG-1 人为错序导致原体=1 的 hazard 测试作为防护对照；正式代码正确卸载原体=0；NEG-2 Agentless；NEG-12 未适配访问；H6 `hc-dyn-observation.dynRan=true` 必须变为 deny；Guard-after-allow、Scope A/B 差异、MCP 后到、PTC nested、cold resume、Agent tombstone 下 late callbacks；打断 PREPARING 任一点无发布。结果投影/Finalizer 也不得在 Binding 更新后回用旧原体内容。

**验收：** 真 Host HEAD 复跑 Stage2b + H6，H6 动态漏检行为**预期发生改变**为 typed deny（KIT 如需更改，须更新断言解释并保留 PoC 原始记录），所有其他 Alpha.4 断言无新增红；没有未受治理 Body 运行；非 Team control Agent 零影响。

**PoC-1（仅遇到异常时）：** 验证 Global Team-member Guard 的可信身份与 Tombstone 能否跨 Agent 生命周期保留。**通过**→共享 Root Guard 仅匹配 Team Identity；**不通过**→仅采用 Agent Scope Guard 并拒绝旧 Scope 生命周期以外任何请求，不能证明无晚期分发则阻塞本 PR，最小 PUBLIC-seam case 提上游。Fork ToolDefinition **不能**修复 ToolRuntime 原体 late re-resolution，不能用 R4 抹平该阻塞。

## 5. PR2 — 统一 Operation Admission、Ask 与 Execution Grant

**实现：**

- 从工具调用、文件读写/目录/metadata、网络目的地及 domain reference 建立不可变 `RequestedEffectSet`；一次调用多个 Team Ask 使用**同一逻辑 Alpha.4 ApprovalCase**，每个 Effect 独立检验 reviewer 的审批位置和 Envelope 覆盖，不用简单取最大 rank 代替合法性。
- 一次性 Grant 绑定 Member/CallId、原始 Argument Fingerprint、Tool Binding Revision、Blueprint Authority Generation、Realm 和精确 Scope/ConsumptionId；`one-shot` 不能重放也不成为耐久权限变更。
- 明确批准→执行间世代改变、Scope 变化、目标身份变化、Domain Gate 变化的 stale 处理；不自动裁剪和重试。禁止批准包含确定 deny/undetermined Effect 的请求。
- 守卫用于**不可绕过的最终拒绝**，pre-execute/Control Flow 用来**等待 Ask**，不可用其他 Listener 强行允许。
- ExecutionLease 管后台进程寿命、Job Owner 和 cancellation guarantee；不是无限复用 Grant 的新概念。

**测试：** Leader/Human User/Human Admin 不可用阶梯、禁止自批、旧 leg escalate 后旧人不能 allow、批量 Effect 中任一超天花板整组拒绝、并行 Ask 同一 Grant 不串扰、Cancel 先/中/后、审批与 dispatch 之间故意插入权限变更、跨 Member Grant 盗用、重复消费、resume 旧 token 失效；Alpha.4 已有操作指纹与 envelope 变更回归。

**验收：** 无模型输入可信角色/Grant，副作用只在审批终局后发生；任何 fail/stale = 0 body；数据库不出现“第二套授权事实”；保存原 Alpha.4 所有操作审查轨迹和统计口径。

**PoC-2：** 若多 Effect 的 ApprovalCase 需要新增 fingerprint carrier 但现有 Core/Team 记录承载不足：**可以安全扩展 Team 内部 Control/ApprovalCase**→走普通 PR2 合法迁移；**会使审批 authority 与现有历史不兼容**→退回 `BOUNDED-DEFER` 多资源 Ask，明确该组合拒绝，提交规范变更，不给“每 Effect 分散批准后拼凑执行”的旁路。拒绝修改 DSH Core。

## 6. PR3 — Trusted Controlled FS

**实现：** Team Own `ControlledFs` 服务对可信 File Tool 的真实 `read/stream/readBytes/stat/listDir/create/write/edit/rename/link/watch` 集中校验。独立 ToolDefinition 保留原生 Schema/输出承诺；`write` 旧文本输出与 `edit` 的隐含 read 必须要求 Read 或在可信路径消除旧内容回传。Member 的额外 Ask 仅随具体调用进入 FS，不修改共享 `ctx.fs` policy。

**路径安全：** Workspace/Realm Home 不随 cwd 漂移；相对 `..` 拒绝、合法空白不 trim、不可通过 symlink/hardlink/rename/别名绕过。`realpath + (dev,ino)` 快照仅作 PoC 参考，产品级强保证要求安全打开：Linux `openat2` 相对受信目录 FD、合适 resolve flags、按 FD 校验与两端 rename 源目标约束；不声称通用 `fstat` 自动证明任意动态硬链接正确。严格任意共享树无法保证时标 `IO_POLICY_UNSUPPORTED`，而非凭字符串名允许。

**测试：** P0 FS-01..04、NEG-11 硬链接、NEG-12 旁路、Symlink retarget/directory rename 并发、`new-file`/`unlink`/`hardlink`、绝对路径/`~/`、空白路径、`stat/list` 侧信道、`stream/read_image/editor`、Write-only 编辑拒绝与无旧内容泄漏、两个 Member 不同 one-shot Grant 并发；测实际 OS open/fstat/hash/mtime 与标准错误码；权限世代变更后重校验。

**验收：** 受信 File Tool 的已声明 FS 影响面全部被中介；未授权路径在其自身调用面上 `open-issued=0` 或原子 OS 拒绝；真实 Host 不泄露旧内容；别名及竞态边界准确声明，不可提供的 Profile 启动前拒绝。无未适配原生读取旁路（PR1 上游门）。

**PoC-3（限定本阶段）：** `openat2`/目录 FD 能否与 DSH public FS target/finalize/error 兼容。**通过**→优先使用 Provider 内核句柄方案；**仅适用于固定受信数据树**→发布该窄 Profile，任意不可信可变树拒绝；**任意路径 alias/metadata 不可证明**→严格策略 `BOUNDED-DEFER`，不得在 PR8 宣称该 Profile Supported。需要平台 native helper 时可在 Team 边界内实现，不因此 Fork DSH。

## 7. PR4 — Confined Process 与平台能力契约

**实现：** `ConfinedProcessProvider` = `probe()`、`prepare(Grant,argv,cwd,env,Policy)`、`execute(plan,signal)`、`terminate/wait`；每维 Capability 明确 FS content/list/metadata/write/alias、network deny/restricted、FD inheritance、child confinement、cancellation/termination。Linux 以**受信 pre-exec launcher 子进程**先自锁 Landlock 后执行不可信程序（不能在 DSH Host 主进程 `restrict_self`）；支持必要 Runtime Base、最小允许 mount/proc/dev 与被信任 fd 管理。Landlock 只主张 PoC 实际验证的文件能力。

**强制限制：** Landlock 读取强制≠全元数据隐藏，ABI v4 ≠全网络禁止；TOCTOU_A 的旧 FD 不追溯必须在实际 launcher 关闭所有未批准继承 FD，CLOEXEC 标识是机制非单独完全保证。当前 bwrap/netns 宿主环境受限，不能把这类失败归因为全平台无能力。

**测试：** 重跑 10-landlock-lanes 全 7 腿+真实 Host POS/NEG；私有文件内容、write-only、符号链接、进程树 fork/exec、注入命令、不可信 env/HOME/代理、旧 FD 逃逸、stdout/stderr 大输出、超时/取消、Shell bg、runner 无效/缺二进制、网络 IPv4/IPv6/UDP/Unix Socket/loopback/继承 Socket；对 `stat/listdir` 等无法强制的元数据声明 `unsupported`。`network:restricted` 目的地过滤需独立真实 Provider/DNS/重定向试验。

**验收：** 支持矩阵中的每项由同主机真实效果证明；不存在 “sandbox unavailable→unconfined spawn” 的零防护回退。未证明的完整 network deny / metadata restrictions 在必须满足时**进程根本不启动**。

**PoC-4a：严格元数据隔离。** 受信 mount namespace/独立 Runner 可用 → 选 OS 可见性沙箱；不可用 → 当前 Landlock 只发布内容读写受限子能力，完整 metadata 严格 Profile 拒绝。
  
**PoC-4b：全网络 deny。** 对 IPv4/IPv6/UDP/Unix socket/FD 做正负控；受信 netns/seccomp/远程受限 Runner 若能覆盖全部要求 → 支持 `network:deny`；否则 `IO_POLICY_UNSUPPORTED`，不把 Landlock TCP port ABI4 视为一般无网络保证。
  
**PoC-4c：异步启动与结果/子进程契约。** Team async ToolDefinition 中 `await prepare` + 公共 `SubprocessRuntime.spawn` 同步句柄可保真 → 直接使用公开底层；不能保持整个 Managed Range/PTY/Terminate 语义 → Team-owned `SubprocessRuntime` public Service Provider 或继续分族 Bounded Defer；禁止伪同步句柄导致失控进程。

## 8. PR5 — 搜索与 Shell 原生兼容层

**实现：**

**搜索**首选 R1+R3：公开包根 `parseGrepArgs/buildGrepCommand/parseGrepMatches/parseGlobArgs/buildGlobCommand/resolveRgPath/toWorkdirRelative`，Team Own `async execute` 提前取得 Plan、启动真 rg、自管 bounded output / `presentationMeta` / Spill；不导入私有 `src/*`。保证未授权 subtree 对 rg 的真实访问被 OS 拒绝，不以结果过滤代替。
  
**Shell** R1 + 受控 `ShellExecutor`/Team-own ToolDefinition，保留 native argv/env/cwd/job/timeout/Signal/stream/terminal API，支持严格 Profile 的版本才开放。Windows `pwsh` 缺严格读证据时显式拒绝相应模式，不能不告知地放行。

**测试：** `grep/glob` 真实固定 rg 版行为回归（原生 vs Team 的结构化 value、meta/render、错误、binary、ignore/hidden/VCS、路径、溢出 Spill、本机/并发/Cancel/timeout）；搜索小/大树性能 p50/p95/内存；Shell foreground/background、正确进程退出与资源归属、命令注入/环境变量试验、已批准/拒绝文件及网络边界；PTC 内层以 ToolRegistry 路由验证但不抢 PR6 外层责任。

**验收：** 真 Host 经独立复跑，无原体回落、无未受限 rg/bash body、等价差异有明确清单；Spill 可正确归属且被读取时复核权限；取消与 Job 未结束不能被误写为已停止。性能异常不构成降低隔离强度的理由。

**PoC-5（只在 R3 不满足功能契约时）：** R2 以 `ctx.isolate('subprocess')` + 真实 Provider + 原生 `applyGrepTool/applyGlobTool` 正式测试 fiber READY、授权上下文和同步句柄。**R3 完整通过**→选 R3；**R3 重要行为不可复用但 R2 通过**→选 R2；**R2/R3 都被公有 seam 证伪且窄 Fork 有用**→登记 `A5-FORK-search` 并独立注册；若 Fork 不能解决 Core 分发问题→CORE_BLOCK。PoC 的 `fiber PENDING` 仅说明缺必需 Service，**不**等于直接触发 Fork。

## 9. PR6 — PTC 外层授权与 LSP 常驻进程

**PTC 实现：** 保留 DSH 内置 `run_code`；ToolRuntime 不能 `register/restrict` 同名 transport。每个内层 `tools.*` 由 PR1/PR2 的 guarded ToolRuntime 重新判定。外层 Node `fs/net` 需要在生成 PtcRunSpec/启动 worker 前绑定本次准确的 Grant、Team Policy 和真实 OS Provider，而不能从模型输入自称授权；超时与父取消必须传递并 drain 内层分发。

**LSP 实现：** 默认严格 Profile 暂停原生共享 `lsp`；优先用公开 Cordis `ctx.isolate('lsp')`、`ctx.isolate('subprocess')` 和独立 `LspRegistry/stdio Provider` 的 per-Member / per-Policy Realm；其服务器池键至少包含 (Member,Realm,Provider,Workspace,PolicyGeneration) 并随变更销毁。Host 文件预读受 ControlledFs 管理，服务器自己受 Confined Process 控制。

**测试：** PTC 外层 Node 真实文件/网络负控与内层 denied tool 原体 0、并发两 Member 不串授、call cancellation 与 queue drain、run_code 保留拒绝；LSP 同路径不同策略不共享 PID、虚构服务器尝试 forbidden 实际失败、同策略热复用、Grant/Policy 变更重建、冷恢复/关闭无残留、stdio 生命周期。

**PoC-6a（PTC：必须在启用 Strict 前完成）：** Root `ctx.ptcRuntime`/`sandboxPolicy` 与 Agent-scoped Grant 可否通过 PUBLIC Service/around-wrapper 或独立 PtcRuntime 精确关联并发调用？**通过**→启用该 Profile；**只可可信固定 Realm Policy**→支持该窄固定策略、one-shot 额外范围拒绝；**无法证明 per-call 且一般 Strict 要求**→Strict `run_code` 禁用并记录具体缺失 seam。工具级 Fork 不得绕过内置 Transport 的 Core 限制。

**PoC-6b（LSP：必须执行）：** scoped service re-mount 在真实 `tool-lsp→ctx.lsp.query` 中真的解析每 Member 实例吗？**通过**→每 Member 持久池+有条件启用；**R2 不行但 Team Own LSP Protocol Client 可以走 PUBLIC Spawn**→采用独立 LSP Adapter/Pool；**两者都不可行**→Strict LSP 禁用，保存 upstream API 缺口（不默认 Core Fork）。原生共享池绝不能被改名后直接复用来冒充隔离。

**验收：** PTC 或 LSP 可以 `SUPPORTED` 或明确 `UNSUPPORTED/BOUNDED-DEFER`，但产品 UI/Blueprint/日志必须如实报告，不允许在功能列表显示为严格可用而执行时暗中放行。

## 10. PR7 — Web/Jobs/MCP/Remote/Domain 的可信 Provider 路线

**实现：**

- **Web**：Tool/URL 目标、DNS/IP、Port、Redirect 每跳与代理出口等由可信 Web Provider 根据声明的能力执行；搜索后端与搜索结果 URL 是不同网络对象；无 arbitrary URL path 保证时不造假。参数合法仍须 Team Grant 与网络真实限制匹配。
- **Jobs**：`job_output/list/kill` 的执行身份、Job Owner、创建时 Grant/ExecutionLease、Cancel requested vs terminated，长期 Job 作用域与跨 Member 输出隔离；停止结果不代表已撤销已发生效果。
- **MCP**：动态工具列表随时治理；stdio 本地进程的读/写/网络需实际 ConfinedProcess；remote HTTP MCP 在真实 Provider 端进行强制，Team 本地只能准入和可信绑定；隔离认证身份、热替换、重连/撤销。
- **Domain**：研究状态/设备/远程 HPC 的最终合法性由 trusted Domain Gateway 在 effect commit 决定；包含 CAS 版本、Principal 可信生成、业务拒绝与网络重试不明状态。不要给 Shell 普通进程真实领域凭据造成 Gate bypass。

**测试：** 复跑 09-web-jobs-mcp 回环 30/30 并补真实 Host；Web 同源/跨源 Redirect、DNS rebinding、URL 重写、IPv4/IPv6、PrivateAddr/SSRF 与超时；Jobs 两 Member owner 正负控、kill 不可即时完成、重启恢复；MCP 后到/撤销、新 Agent、同名 Tool Scope 与 stdio 子进程被禁文件；Domain Gateway 用虚构 CAS 状态/模拟设备联锁，允许 Team 操作但 Domain veto=0 side effects。

**PoC-7a（网络）：** 没有经验证 Provider 能完整限制任意网络时，`allow`（依底层部署与 Team Operation Permit）和经过验证的 destination-bound subset 分别发布；`restricted/deny` 超出能力直接拒绝。第三方真实外网需要经允许的测试环境，缺权限标 `ENV_BLOCK`，不以回环结果扩张产品保证。

**PoC-7b（Job ownership）：** dsh-agent 真实 owner carrier 可否贯穿已启动/重启 Job？通过→直接复用原生 jobs 服务；否则 Team Job Gateway 强制 owner 映射、或禁止跨 Member 查询和控制；不能证明跨源授权时不授予该能力。

**验收：** 可信 Provider 明确自己的支持矩阵；由实际 Effect Gateway 拒绝敏感操作；外部异常不触发不幂等重试；没有未治理动态 MCP；所有主张有正负控或显式 `BOUNDED-DEFER`。

## 11. PR8 — Blueprint vNext、迁移与产品级总 Gate

**实现：** 当前只支持 Blueprint `schemaVersion: 3` 且字段封闭。PR8 再选择明确的 vNext 版本（建议 4，但须记录正式 Schema ADR）实现 `toolBindings`、Read/Write/Network I/O Policies、Provider/Execution Boundary Binding、Assurance 引导与诊断；将 Alpha.4 两份 authority envelopes 的 Scope 语法合法扩展至新操作类型，不引入新 Role Ladder，也不改变已绑定 Blueprint 的生命周期。迁移必须显示拒绝/升级策略，不自动从缺省字段推断 unrestricted。

**测试：** 严格 Schema 拒绝未知字段/错误版本；升级前 v3 的具体状态与提示、vNext 迁移后的权限不升高；动态 Binding 与新 Tool 不因迁移而成为隐式 allow；Leader/Human User 限权、多 Effect ASK、domain veto；全工具族 *实际 Host* 正负控与 cold restart；Linux OS Capability/metadata/network 独立审计；UI 诊断说明真实 Unsupported；基本 CLI/浏览器烟测；Zero-Core scan + 基线差分 CI + 独立 Security Reviewer。

**验收矩阵必须机器可读：** 每行 = tool family × OS × Provider × policy profile，声明 `SUPPORTED|UNSUPPORTED|DEFERRED`、实际能力（例如 content read 与 metadata 分别列）、真实 Host 证据引用、未测/不适用项与拒绝错误；所有 Supported 都能由独立 Reviewer 在固定 HEAD 上复跑，所有 Unsupported 在运行时**确实拒绝**。`P0 fixture 成功` 不能抵 PR8 Gate。所有需要 `CORE_BLOCK` 的路径不得被发布为支持。

**发布裁决：** PR8 合并≠ Alpha.5 已人工验收/发布；按团队正常 Gate 决定是否发正式 Alpha.5，同时保证现有 Alpha.4 人工/产品收口状态未被偷改。

## 12. Review、证据工件、性能与门禁程序

每个 PR 交付至少：(a) PR-local ADR/Decision delta，(b) 目标/源路径映射，(c) RED-first 最小负控与对应正控，(d) 真实 Host Run Receipt（需要实际 OS/执行能力的 PR 必须），(e) baseline-diff matrix（原有红、NEW/FIXED 身份），(f) 变更文件清单和哈希 (g) Reviewer exact-head verdict，(h) 未达能力/债务与下一 PR owner。保存到 `dev/agent-workflow/evidence/alpha5/<stage>/<commit>/`，复用可维护 Kit 在 `tests/kits/`；端口/HOME/测试树保护按 `docs/TEST_METHODS.md`。

**每 PR 门禁行为：** Targeted tests GREEN → typecheck GREEN → changed-file lint GREEN → full suite no-new-red → build/artifact/composition 关联门 → pinned 真实 Host（适用时）→ 安全负控并验证实际效果 → independent Reviewer → 关闭 Findings 后复审 → user-authorized merge。任何失败不得通过编辑 expected fixture 或吞掉新的失败身份“修绿”。审查者不能仅阅读协调者摘要，也不能把 Preview 呈现当作 OS syscall 证据。

**性能测量**：对 `read/write` 小/大文件、`rg` 小/大 Workspace、`bash` 冷启动/后台、PTC 外层、LSP 冷/热复用、Web/Job Gateway 记录 p50/p95、内存/CPU、OS 进程开销和 Spill IO；与锁定上游 native 对照。性能不佳需排队优化与风险记录，**不得以移除权限防护作调优手段**。S0 确定可复现环境和预算，PR8 以实际测值给最终发布判断。

## 13. 结果分叉索引

| 发现 | 可继续路线 | 不可继续路线 |
| --- | --- | --- |
| R1 Scope Mask+Guard+Dispatcher 在真 Host 通过 | PR2 及后续工具适配 | 直接跳过调用末端 Guard |
| 动态同 Scope 工具能绕过 Guard | 未治理工具拒绝/阻塞 PR1 | “仅 Setup Coverage”仍称安全 |
| FS 身份竞态不能保证 | 缩窄 Supported Profile / 严格拒绝复杂路径 | 利用 `realpath` 快照假定永久不可别名 |
| Landlock 文件内容强制但网络 deny/元数据不可保证 | 按维度声明，附加可信 Runner/Provider | 直接标 full sandbox 或静默走裸进程 |
| R3 搜索 parity 通过 | 上游公共 helper 组合 | 提前 Fork search |
| R3 缺关键行为、R2 通过 | R2 完整原生体隔离重装 | 将 fiber PENDING 当原生工具不可能接入 |
| R2/R3 都需非公开接口且工具 Fork 可修补 | 具名有界 Tool Fork 与清退债务 | 更改 DSH Core、依赖私有 API |
| PTC 外层 per-call Grant 未证 | Strict run_code DENY 或明示窄固定策略 | 以“内层 guard 通过”替代外层防护 |
| LSP per-Member Provider PoC 失败 | Strict LSP DENY、上游接口请求/Team-own client 二选一再证 | 使用原生 Workspace-only 池作为 Strict |
| Web/Jobs/MCP 仅模拟环境通过 | 发布已证子能力或 defer | 宣称任意网络目的地安全/远端完全隔离 |

## 14. 完成定义（Definition of Done）

- **架构：** 没有未受治理 Tool body；Scope 正确、无原生体回落、可信身份和 Grant 绑定真实操作。正/负控、并发、取消/重启均已由真实 Host 验证。
- **权限：** 复用 Alpha.4 单一审批/Envelope，多个 Effect 不合并成虚假总 allow；Domain 否决最终生效。
- **执行：** 每个 Supported I/O 限制在其实际执行边界生效；不支持的限制启动前拒绝；Landlock 内容强制与 network/metadata 证据分开。
- **兼容：** 原生工具使用体验/结构化结果/Spill/Job/LSP 路线按 Support Matrix 真实一致，或受影响场景明确 Disabled 而非悄然改变。
- **安全：** Zero Core Patch；所有 Fork 有最小证据及债务退出；稳定 Host 与 DSH_HOME 零干扰；没有凭据/私人数据被持久化在测试 Evidence 中。
- **验证：** baseline no-new-red，版本/HEAD pin 正确，独立 Reviewer 对真实负例复跑，附公开问题清单与长期债务。
- **发布：** 只有在人类阶段验收和产品 Gate 通过后才可声称 Alpha.5 成果；部分 Provider/OS 保留明确 Unsupported 是允许的，不得将未证功能写成 Supported。

**总裁决：** 先 S0/PR0/PR1 闭合全局动态工具旁路与 late-dispatch 竞态；再 PR2 把 Alpha.4 单次授权接入新的 Effect/Grant；PR3/PR4 并行形成可信 FS 与受限进程；PR5 推出高价值受控原生搜索/Shell；PR6、PR7 对特殊长期/远端工具做能力限定；PR8 最终形成 vNext Blueprint 与真实 Host 证据链。不得为追求全工具“一键可用”而突破可证明的安全边界。
