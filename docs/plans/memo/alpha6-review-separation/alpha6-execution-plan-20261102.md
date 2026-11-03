# Alpha.6 修正版执行计划：Blueprint-first ReviewRouter + 轻量唤醒

> **状态：CONDITIONAL PLAN / DESIGN-ONLY（2026-11-02 复审后修订）。** 本计划
> 细化 PR #536 的设计裁决，不授予实现、启用或合并权限；不改变 Alpha.5 的
> 当前权威。**复审判定：方向保留，原七切片顺序不直接开工；四个 P0 必须先
> 闭合。**
>
> **设计正本**：[`alpha6-blueprint-router-wake-rebase-20261103.md`](./alpha6-blueprint-router-wake-rebase-20261103.md)
> （PR #536 head `659f617b7`；该文件日期是既有的会话日历标签，本计划的新锚点
> 一律取书写时的 `date -u`）。
>
> **PoC 证据**：[`alpha6-rebase-poc-20261102/`](../../../../dev/agent-workflow/evidence/alpha6-rebase-poc-20261102/README.md)。
> 复审后的重定级见 §1。

## 0. 目标、边界与不变量继承

**G1 职责分离**：专职 Officer 处理日常工具 `ask`；Leader 保留 Team 调度/
治理/持久权限变更/蓝图例外；Human 永不下放。
**G2 重复消息修复**：已 resolve 不再产生新无效通知；同一接收者同一时间
最多一个在途 Review Wake，事件合并，收到唤醒后重读权威待办。

完整继承 PR #536 §2 的 **A6-NATIVE / A6-AUTHORITY / A6-BLUEPRINT /
A6-LEDGER / A6-INBOX / A6-LEGACY / A6-SCOPE**。每个 PR 描述必须逐条回答
“触碰了哪条、为什么最小接缝足够”。

**非目标**：通用动态路由/调度系统、路由 LLM/subagent、Jev、自动风险评分、
定时 defer、多 Officer 负载均衡、实例级持久路由编辑器、工具执行体系或基础
权限体系改造、恶意插件/提示词注入专项防御。

## 1. 复审后的 PoC 定级（取代首轮自评）

| PoC | 复审定级 | 依据 / 计划后果 |
| --- | --- | --- |
| **P-AUTH** | **简单 Control 决议接缝 PASS；完整 PA 工具审批链 FAIL（base law）；委托原型 PASS；生产契约已由 ADR-A6-1 裁决（未实施）** | 真实 PA manifest + 真实 verifier 下，Officer（member）在 `resolve` 就被判 `pa-authority-drift`；`mayReview(member, member, leader)` 恒假，`deciderAuthority()` 把 member 固定解释为 `member`，`verifyEffectSetApproval()` / `issueApprovedGrant()` / guard 是同一结论。**2026-11-03 用户裁决 ADR 先行并授权统一 ReviewCapability；实施从 PR2a 开始，不再重复 PoC。** |
| **P-BP** | **原型层 PASS（12/12）** | Template × Tool 确定、同模板一致、instance 选择器拒绝、哈希必须移动。复审新增两项已落：Officer 必须是 MemberTemplate；**Officer 自己的 ask 默认 Leader**（防自等待）。生产 schema 仍需与 Alpha.5 协调。 |
| **P-INBOX** | **公开接缝 PASS；模型 PASS（11/11，已修复三处 P0）；Host ENV_BLOCK** | 旧模型把“未变化”误当“无待办”，会撤销唯一有效 wake；`recover()` 无条件重投；投递失败会永久卡 `queued`。已拆分 `pending`/`changed`，恢复前查询持久 wake，失败释放队列。Host 三请求/claim/崩溃/Stop 仍未跑。 |

**不再为三项分别组织开放式架构 PoC。** P-AUTH 完整 PA 链已完成并被复审确认；
2026-11-03 ADR 接受后，实施从 PR2a（纯求值器）开始，已有三模式实验作为回归基线。

## 2. schema、身份、委托与通知的最小方案

### 2.1 Blueprint 加法版本边界（版本号与 Alpha.5 协调，不预占 v5）

- 必须走**新版本边界**：旧 v3/v4 文档不获得 `reviewRouting`，解析与哈希
  零移动；family 进入新版本的哈希投影，禁止 metadata/sidecar 旁路。
- **版本号不预先钉死为 5**：Alpha.5 的最终实施也可能需要最小 Blueprint
  扩展；由工程在 PR1 评审时与 Alpha.5 当前实施协调后确定，避免两条开发线
  各自定义不同的 v5。原则（加法、旧版零移动、family 进哈希）不变。
- 作者面保持：仅 Template × 可信 Tool 坐标、无 instanceId/label 选择器、
  默认 Officer、`whenOfficerUnavailable ∈ {hold, leader}`、无隐式默认。
- **Officer 必须是 MemberTemplate**：Leader 模板是合法蓝图模板但不是合法
  Officer；引用 Leader 作为 Officer 直接拒绝（`officer-not-member`）。

### 2.2 一个 Team 唯一 Officer：区分“配置非法”与“临时不可用”

- Team 创建/启用时恰好创建一个 `officerTemplateId` 对应的 MemberInstance；
  admission 拒绝第二个同模板实例。运行时按“当前未归档的唯一同模板实例”
  解析，不新增 binding ledger。
- **配置非法**（模板缺失、引用 Leader、重复声明、路由字段越界）：拒绝启用/
  拒绝创建，typed error，不静默回退 Leader。
- **合法 Officer 临时不可用**（归档、崩溃、未恢复）：不是 Team 启动失败；
  按 Blueprint 的 `hold`（默认）或 `leader`（显式）处理；恢复后不得抢回已
  转交 leg。
- 不存在“先建团队、后补 Officer”的隐式成功路径；补建必须是一次显式的
  enable 操作并重新校验。

### 2.3 通知身份（按 DSH 公开事实修正）

`agent.followup()` 返回 `void`。因此：

1. 先用 `createUserMessage()` 构造消息，保存其 `message.id`；
2. 把同一条消息交给 `agent.followup()`；
3. 后续 `remove`/`replace` 用保存的 id，不依赖 `followup()` 返回值；
4. 去重键是“接收者 + 逻辑 wake 代际 + 该 id”，不是
   `source.kind=plugin:dsh-agent-team`。

PR4 必须在真实 Host 适配上验证 claim 后不可撤回、未 claim 可撤。

### 2.4 ReviewCapability 契约（ADR-A6-1 已接受）

用户已选择“ADR 先行”，并授权对 Alpha.6 审批授权模型作必要、系统性的调整。
[`ADR-alpha6-review-capability-20261103.md`](./ADR-alpha6-review-capability-20261103.md)
是唯一契约正本，要点：

- **身份与能力分离**：durable `decider` 始终是真实 Principal（Officer 仍是
  member）；`ReviewCapability` 是该 Principal 在当前 Case/leg/scope 内的有效
  审批能力，独立求值、独立快照。
- **一个纯求值器**（建议 `packages/runtime/review-authority/`）：所有入口
  （Control 决议、PA presenter、verifier、grant、guard）只读同一结果；禁止在
  各入口分别硬编码 Officer→Leader。
- **静态委托来自冻结 Blueprint**：普通案件不建 per-case Mandate/Assignment
  账本；只有显式 Handoff 写一条最小 current-leg 事实。
- **Durable decision 携带 `reviewCapability` 快照**（可选、additive）；旧行
  缺席 = legacy 行为逐字节不变。
- **失败关闭**：case/scope/generation/Blueprint 不匹配、快照缺失、verifier
  不可读 → 拒绝或 `authority-undetermined`，绝不降级 allow。
- **保留**：Human 审批、Leader 专属治理/持久权限变更、Alpha.5 I/O 硬上界、
  一次性 Grant/Guard、非委托审批语义。

**不再重复三模式 PoC。** 已有证据作为回归基线；实施按 PR2a→PR2b→PR2c→PR5
推进，PR2b 必须用真实 PA manifest 完成纵向验证。

### 2.5 Officer 自身 ask 的路由

固定规则：**请求者的 templateId == `officerTemplateId` 时，普通工具 ask
默认交 Leader，绝不交回 Officer。** 理由：当前 Officer turn 等待审批，审批
又需要下一个 Officer turn，形成正常运行的依赖环；同层自审本身也不合法。
这是一条职责隔离规则，不是通用死锁检测器。Blueprint 的 Leader 例外仍然
有效；优先级见设计正本 §3。

## 3. PR 切分、所有权与依赖

> 纪律：1 PR = 1 branch = 1 worktree = 1 writer；一个 Center-Interface PR
> 只落地**一个连贯契约**并列出全部受保护文件，禁止并行写者；每个 PR 独立可
> 回滚。Dormant PR 必须有 lane-hygiene 证明与零新权威写路径声明。

| PR | 内容 | 主要路径 | 受保护中心 | 依赖 | 完成判据 |
| --- | --- | --- | --- | --- | --- |
| **A6-PR1** | 加法版本 grammar + `BlueprintRoutingStrategy` 纯解析器 | `packages/domain/blueprint/**`、`packages/domain/test/**`、`packages/runtime/review-router/**`（纯） | 否 | 无 | 旧版哈希零移动；新版解析/拒绝矩阵；同模板一致、例外/默认；**Officer 必须是 MemberTemplate**；**Officer 自问 → Leader**；instance 选择器拒绝；零消费者 |
| **A6-ADR** | ReviewCapability 契约、身份/能力分离、数据流、修订后的不变量 | 本目录 ADR | 否 | 用户已裁决 | 本 ADR 接受；计划/设计正本同步；零生产代码 |
| **A6-PR2a** | 纯 `ReviewCapability` 求值器 + 完整拒绝矩阵 + 单测；零消费者 | `packages/runtime/review-authority/**`（纯） | 否 | ADR | 单一能力来源；leader/human/治理/自审/self-ask/scope/generation 拒绝矩阵；零 I/O |
| **A6-PR2b** | **统一契约落地**：Control 写 `reviewCapability` 快照；PA presenter/verifier/grant/guard 读同一快照（legacy fallback） | `packages/runtime/control/{types,service}.ts`、`operation-permission/pa-control-bridge.ts`、`tool-admission/approval-case.ts`（必要处）、ARC-A override | **是**（Center-Interface，多文件同一契约） | PR2a | 真实 PA manifest 全链：leader 正例、member 无委托拒绝、委托通过、grant/guard 恰好一次；durable decider 仍 member；旧行逐字节不变；四个入口**共用资格判断、逐入口能力表**（`appendTerminalOutcome`/零审查关闭不得由 Officer 新建关闭案件） |
| **A6-PR2c** | Handoff / 异常接管：current-leg 持久事实 + 生产事件接线 + 纵向测试 | `packages/runtime/control/**`（中心）、`live/**` 接线（另开中心 PR） | **是** | PR2b | Officer 发起 handoff → 校验当前 case/leg → 写持久 Leader 接管事实 → 原 Officer 失去该 leg 归属 → Leader 合并 wake；不抢回；不建通用 Assignment Ledger |
| **A6-PR3** | 纯 `ReviewWakeCoordinator`：activation/poll/latch、generation、no-progress 守卫 | `packages/runtime/review-wake/**`（纯） | 否 | 无（可与 PR1 并行） | 3 请求→≤1 wake；running 只 dirty；resolved/无进展不 re-wake；**pending-unchanged 不 cancel**；**恢复前查持久 wake，不重复**；**投递失败释放 queued**；零 I/O、零 timer |
| **A6-PR4** | 投递接缝：通用 Review Wake 入 DSH Inbox；旧 Leader notifier 互斥替换 | `packages/runtime/control/leader-notification.ts`、`live/agent-bindings.mjs` | **是**（一次一个文件） | PR3 | 在可控 Host 适配环境实际投递一条 wake；`createUserMessage().id` 可 remove/replace；claim 后不可撤；未启用 Team 逐字节旧行为 |
| **A6-PR5** | Officer 受限访问 + Handoff 工具面：读自己应审待办、走既有入口决议/转交 | `packages/tools/**`、访问适配器、契约 | 视落点 | PR2c | Officer 不能读全 Team 管理面；决议/转交复用 ControlService；负控完整 |
| **A6-PR6** | 生产接线与 opt-in：唯一 Officer、蓝图绑定、旧 notifier 切换、观测 | `packages/runtime/root*`、plugin 组装、GUI 邻接 | 可能 | PR1/2b/4/5 | **第一条真实消费纵切在此闭合**（含 Handoff 与通知出口）；未启用 Team 零变化；指标可读 |
| **A6-PR7** | 组合回归、故障/压力、性能指标与发布验收 | 测试套件/证据，不改生产语义 | 否 | PR6 | 最终行为矩阵回归；**不再承担第一次生产接线**；Host 核心行为必须通过，ENV_BLOCK 只能出现在设计/模块阶段 |

**阶段验收前移（复审 P1）**：

| 里程碑 | 必须证明 |
| --- | --- |
| PR1 / PR3 | 纯函数正确性；误取消/恢复重复/投递失败三处 P0 已修 |
| PR2a + PR2b | 单一求值器；真实 ControlService + PA manifest + Officer + Grant/Guard 跨层结果；不是简单 Control 行 |
| PR4 | 可控 Host 适配环境真实投递一条 wake，验证 claim/去重/取消 |
| PR2c / PR5 / PR6 | Officer 身份、受限读取、实际路由、Handoff、通知出口的纵向闭环 |
| PR7 | 只做组合回归、压力/故障、性能指标与发布验收 |

**并行 lane**：Lane D（PR1）、Lane W（PR3）可并行；Lane C（ADR→PR2a→PR2b→
PR2c→PR5）串行；Integration（PR4→PR6→PR7）串行，不与中心 PR 并行改同一文件。

## 4. 验收矩阵（复审修订）

| # | 可观察要求 | Owner | 层级 |
| --- | --- | --- | --- |
| 1 | 三条普通 Member 常规 ask → Officer ≤1 在途 Wake；Leader 常规审批唤醒 0 | PR3/PR4/PR7 | 单元 + Host |
| 2 | 三件首轮完成或投递前 resolve → 不因旧通知额外启动模型 | PR3/PR7 | 单元 + Host |
| 3 | Officer 执行中 B/C 到达 → 只标 dirty，结束后重读，不逐条 followup | PR3/PR7 | 单元 + Host |
| 4 | 模板 A 指定 Leader、模板 B 未指定 → A→Leader、B→Officer；同模板实例初始一致 | PR1/PR7 | 单元 + Host |
| 5 | 调度/治理/持久权限变更 → Leader；Human-only → Human，不被 Officer 接管 | PR2/PR6/PR7 | 单元 + Host |
| 6 | Officer 主动 handoff → 当前 leg 归 Leader；合并唤醒；不抢回 | PR2b/PR5/PR7 | 单元 + Host |
| 7 | Busy 保持排队；Unavailable 分别验证 hold / leader | PR3/PR6/PR7 | Host |
| 8 | 插件审批通知与工作完成通知共存 → 不互相覆盖/不误去重 | PR4/PR7 | Host |
| 9 | claim 后崩溃、恢复、用户 Stop → 可恢复权威未决；无重复 allow；Stop 不被复活 | PR3/PR7 | Host |
| 10 | 未启用 Alpha.6 的 Team → 旧 notifier/角色/权限/审批行为不变 | PR4/PR6/PR7 | 单元 + Host |
| 11 | 路由不改变 allow/deny；Officer 决议后 guard 独立验证 | PR1/PR2/PR7 | 单元 + Host |
| 12 | 指标：Leader/Officer 模型请求数、token、通知数、审批可达性、等待时间 | PR7 | Host |
| **13** | **Officer 自己的普通 ask → Leader，不产生等待自身下一轮审批的死锁** | **PR1/PR7** | **单元 + Host** |
| **14** | **完整 PA 链：leader 正例；member 无委托被拒；ReviewCapability 委托下 grant mint + guard 恰好一次** | **PR2a/PR2b** | **真实服务对象** |
| **15** | **Handoff 写入 current-leg 持久接管事实，原 Officer 不再拥有该 leg，Leader 合并唤醒** | **PR2c/PR7** | **单元 + Host** |
| **16** | **Latch：pending-unchanged 不 cancel；恢复不重复已有 wake；投递失败释放 queued** | **PR3** | **单元** |

## 5. 测试与证据策略

- **L1 纯单元**：路由/拒绝矩阵（含 Officer 自问、Officer=Leader 拒绝）、
  latch 三处 P0 回归、schema 哈希零移动。
- **L2 真实服务对象**：ControlService + 真实 TeamDomain world；**PA 用例必须
  带严格 manifest 与真实 verifier，断言 grant mint、guard 消费次数与 durable
  decision reason**；负控含非指定 Member、跨 Team、已决、Human-only、治理。
- **L3 真实 Host/适配环境**：PR4 起在可控适配环境投递真实 wake；PR7 用
  `tests/world-factory` 的预算租约与 pristine Host `639ed01539`，端口只用
  `tests/paths.mjs` 测试带，绝不碰 `:3080`。
- **L4 发布**：矩阵 + 指标 + 回滚演练。**ENV_BLOCK 只允许作为设计/模块阶段的
  披露；宣称 Alpha.6 可用/可正式验收时，核心真实 Host 行为必须通过。**
- 每个 PR 的 `RESULTS.md` 必须写清“跑了什么、没跑什么、为什么”。

## 6. 风险、紧急停用与回滚

| 风险 | 触发点 | 缓解 |
| --- | --- | --- |
| PA 委托被扩大成全局角色放宽 | PR2 | 契约限定 case/scope/generation；durable 身份保持 member；四入口能力表；安全复审 |
| Officer 自审/自等待 | PR1 | Officer 自问固定 Leader；Host 用例 |
| 误撤唯一有效 wake | PR3 | pending 与 changed 分离；单测回归 |
| 恢复重复投递 | PR3 | 恢复前查询持久 wake；单测 + Host 崩溃用例 |
| 投递失败永久卡 queued | PR3 | 失败释放 + 无 timer 的后续激活重试；单测 |
| 双 notifier / 重复唤醒 | PR4/PR6 | 每 Team 互斥开关；通知数/模型轮次指标 |
| Blueprint v5 与 Alpha.5 冲突 | PR1 | 版本号协调；旧版零移动；不预占 5 |
| 回滚假设冻结配置可改 | 发布 | 见下 |

**紧急停用与回滚（修正）**：

- 启用状态来自不可变 Blueprint，**不能假设改 Blueprint 关闭**；旧二进制也
  可能不认识新版本。
- 因此必须有**运行时 kill switch**（部署/root 配置，默认关）：关闭后
  (a) 不再产生新的 Officer 决议与委托；(b) 新工作按 Leader 路径处理；
  (c) 已有 pending leg 仍可由 Leader/Human 合法决议，不因停用变成孤儿；
  (d) 已 mint 的 grant 不被回滚，交由既有 guard/消费法律处理。
- 回滚 = 关闭 kill switch，**不是**回退二进制、不是编辑冻结蓝图；对已启用
  新版本 Blueprint 的 Team，不得降级到不识别该版本的二进制。
- PR6 必须演练一次“停用后已有 Case 仍可完成”。

## 7. 评审组成与门禁

- 每个 PR：lane 自检 → 独立 code-review（未参与实现）→ 中心/投递/PA 面追加
  security reviewer；修复只复审本轮 findings。
- PR2b/PR2c/PR4：ARC-A override + 具名 Center-Interface 说明 + “无新增绕过
  规范服务的权威写路径”声明。
- ADR 契约先于 PR2b；PR2a 的求值器单测先于任何消费者；不允许“先写再接”。
- 合并前通过 `docs-sync --check`、typecheck、lint、相关测试；Host 证据与
  CI 证据分开陈述。

## 8. 决策归属（ADR 接受后）

**用户已裁决（2026-11-03）**：选择“ADR 先行”；授权对 Alpha.6 审批授权模型作
必要、系统性的调整（身份/能力分离、统一 ReviewCapability、贯通 Control/PA/
Grant/Guard），同时保留既有非委托语义、权限层级、Hard Ceiling、工具执行约束、
一次性 Grant 与 Human/Leader 专属边界。ADR 见 §2.4 链接。

以下由工程决定，不再上升为用户裁决：

1. 加法版本的具体版本号：与 Alpha.5 当前实施协调后由工程定（原则不变）。
2. 唯一 Officer 的存在性不变量：产品已裁决，工程采用；不建绑定账本。
3. 配置非法 vs 临时不可用：工程按 §2.2 区分；`hold` 默认、`leader` 显式。
4. 指标首版只进日志/证据；长期 UI 不是本轮完成前提。
5. `ReviewCapability` 的具体模块落点、快照字段名、legacy fallback 细节：
   在 PR2a/PR2b 评审中定，但不得偏离 ADR 的单一来源与失败关闭。

**只有实施证明必须扩大 Human/基础工具权限、或无法在 ADR 边界内实现时**，
才停止并提交新的架构裁决；不以“尽量少改代码”为由绕过契约。

## 9. 完成定义

- 验收矩阵 1–16 全部有真实证据；Host 不可用项在设计/模块阶段可标 ENV_BLOCK，
  但**发布 PASS 必须包含核心 Host 行为**。
- 未启用 Team 的旧行为有回归证据；紧急停用演练通过。
- 无第二份审批/授权账本、无七相位调度器、无新 timer、无 Core patch。
- 中心变更均有具名 PR 与 ledger override。
- 发布说明明确 Officer 能做什么、不能做什么，以及 Busy/Unavailable/Handoff/
  Officer 自问的边界。

## 10. 修订记录

### 2026-11-02（真实 UTC，复审修订）

- 接受复审对 P-AUTH 的重定级：简单 Control 接缝通过不等于 PA 工具审批链
  通过；曾新增 PR2 Gate 0 与 §2.4 委托契约（2026-11-03 由 ADR 取代）。
- 新增 Officer 自问 → Leader 规则与负控。
- 修复 latch 三处 P0：pending/changed 分离、恢复查持久 wake、投递失败释放。
- 新增 A6-PR2b 承接 Handoff/接管事实，补齐原计划缺失的 Owner。
- 七个原切片保留为代码所有权切分；另增完整 PA 链前置验证与 Handoff 纵向
  闭环。阶段验收前移：PR2 验跨层，PR4 验真实投递，PR6 闭纵向，PR7 只做
  回归/发布。
- v5 版本号改为与 Alpha.5 协调；回滚改为运行时 kill switch；发布判据明确
  ENV_BLOCK 不等于 PASS。

### 2026-11-03（真实 UTC，ADR 接受）

- 用户选择“ADR 先行”，并授权系统性 ReviewCapability 扩展；新增
  [`ADR-alpha6-review-capability-20261103.md`](./ADR-alpha6-review-capability-20261103.md)。
- 原 PR2/Gate 0/PR2b 重排为：ADR → PR2a（纯求值器）→ PR2b（Control+PA 统一
  契约，中心）→ PR2c（Handoff 与接线）→ PR5（Officer 访问）。不重复三模式
  PoC；已有证据作回归基线。
- A6-AUTHORITY 修订为“保留非委托语义，允许统一委托契约”；A6-LEDGER 明确
  decision 能力快照不是新账本、Handoff 只需一条最小事实。
