# Alpha.6 修正版执行计划：Blueprint-first ReviewRouter + 轻量唤醒

> **状态：PLAN / DESIGN-ONLY。** 2026-11-02（真实 UTC）。本计划细化 PR #536
> 的设计裁决，不授予实现、启用或合并权限；不改变 Alpha.5 的当前权威
> （`dev/engineering/current-authority.json` 仍指 Alpha.5）。
>
> **设计正本**：[`alpha6-blueprint-router-wake-rebase-20261103.md`](./alpha6-blueprint-router-wake-rebase-20261103.md)
> （PR #536 head `50e0147c2`；该文件日期是既有的会话日历标签，本计划的
> 新锚点一律取书写时的 `date -u`）。
>
> **PoC 证据**：[`alpha6-rebase-poc-20261102/`](../../../../dev/agent-workflow/evidence/alpha6-rebase-poc-20261102/README.md)
> — P-AUTH PASS-with-qualification，P-BP PASS，P-INBOX seam/model PASS + host
> ENV_BLOCK。

## 0. 目标、边界与不变量继承

**G1 职责分离**：专职 Officer 处理日常工具 `ask`；Leader 保留 Team 调度/
治理/持久权限变更/蓝图例外；Human 永不下放。
**G2 重复消息修复**：已 resolve 不再产生新无效通知；同一接收者同一时间
最多一个在途 Review Wake，事件合并，收到唤醒后重读权威待办。

本计划完整继承 PR #536 §2 的 **A6-NATIVE / A6-AUTHORITY / A6-BLUEPRINT /
A6-LEDGER / A6-INBOX / A6-LEGACY / A6-SCOPE** 七条不变量。任何 PR 的描述
必须逐条回答“本 PR 触碰了哪条、为什么允许的最小接缝足够”；答案为空才可
进入评审。

**非目标**（继续排除）：通用动态路由/调度系统、路由 LLM/subagent、Jev、
自动风险评分、定时 defer、多 Officer 负载均衡、实例级持久路由编辑器、
工具执行体系或基础权限体系改造、恶意插件/提示词注入专项防御。

## 1. PoC 结论对计划的约束

| 结论 | 计划后果 |
| --- | --- |
| P-AUTH：角色闭集是唯一的基础权限 gate；一个 case-scoped 谓词即可让指定非 Leader 走完同一决议/账本/guard | PR-A6-2 是**具名 Center-Interface PR**，必须一次只动一个受保护文件；不得改全局 `CONTROL_RESOLVER_ROLES`；四个入口共用同一谓词 |
| P-BP：现有入口拒绝 `reviewRouting`；加法面可解析 Template × Tool；family 必须进哈希 | PR-A6-1 必须走**新版本边界**（本计划提议 `schemaVersion: 5`），v3/v4 的解析与哈希零移动；不接受 metadata/sidecar 旁路 |
| P-INBOX：Host Inbox 提供 append/claim/remove-before-claim/pending/turn；claim 后不可撤回 | PR-A6-3 只做纯 latch；PR-A6-4 才接投递；完成定义里禁止承诺“取消已 claim 的消息” |
| P-INBOX host：三请求/崩溃/Stop 未跑 | PR-A6-7 是唯一可以宣称端到端绿色的位置；在那之前只能标 seam/model |

## 2. 提议的 schema 与身份方案（需在 PR-A6-1 评审时确认）

### 2.1 Blueprint v5 = v4 + 可选 `reviewRouting`

- 新增 `schemaVersion: 5`，顶层封闭字段集 = v4 字段集 + `reviewRouting`。
- `reviewRouting` **可选**；缺席 = 不启用新模式（旧 v3/v4 文档行为逐字节
  不变）。
- `reviewRouting` 进入内容哈希（必须在 `toHashableBlueprintV5` 投影里），
  否则“改了路由但哈希不变”会成为第二个配置源。
- v3/v4 文档不因本变更获得新字段；现有 v3/v4 哈希保持 P-BP 记录的常量
  （`sha256:e71c4629…` / `sha256:0c6c1cee…` 的 canary 只作回归锚，不是产品
  哈希承诺）。
- 作者面字段严格采用 PR #536 §3.3 的语义，实施时允许改名，但必须保持：
  仅 Template × 可信 Tool 坐标、无 instanceId/label 选择器、默认 Officer、
  `whenOfficerUnavailable ∈ {hold, leader}`、无隐式默认。

### 2.2 一个 Team 唯一 Officer：用“存在性不变量”而不是新账本

- Team 创建/启用 Alpha.6 时，恰好创建一个 `officerTemplateId` 对应的
  MemberInstance；admission 拒绝第二个同模板实例，也拒绝把其他模板的实例
  声明为 Officer。
- 运行时按“当前未归档的、templateId == officerTemplateId 的唯一实例”
  解析 Officer；不新增 binding ledger、不写 Assignment、不复制
  TeamDomain 事实。
- 实例归档/不可恢复 = Unavailable，按 Blueprint 的 `hold`/`leader` 处理；
  恢复后不得抢回已转交 leg。
- 若蓝图声明了 officer 模板但团队未成功创建该实例：**fail closed**，不启用
  新模式，输出 typed error；不得静默回退到 Leader。

### 2.3 通知身份

不预设 Host 未公开的确定性 message id 注入。PR-A6-3 只定义“逻辑 wake
（recipient + generation）”；PR-A6-4 用投递 API 实际返回的消息身份做
remove/replace，并在真实 Host 上验证 claim 后不可撤回。禁止用
`source.kind=plugin:dsh-agent-team` 作为唯一去重键。

## 3. PR 切分、所有权与依赖

> 纪律：1 PR = 1 branch = 1 worktree = 1 writer；受保护中心一次只动一个
> 文件；每个 PR 都必须能独立回滚。Dormant PR 必须有 lane-hygiene 证明
> （零生产消费者）与零新权威写路径声明。

| PR | 内容 | 主要路径 | 受保护中心 | 依赖 | 完成判据 |
| --- | --- | --- | --- | --- | --- |
| **A6-PR1** | Blueprint v5 加法 grammar + `BlueprintRoutingStrategy` 纯解析器 | `packages/domain/blueprint/**`、`packages/domain/test/**`、`packages/runtime/review-router/**`（纯）、bookings | 否 | 无 | v3/v4 哈希零移动；v5 文档解析/拒绝矩阵；同模板一致、例外/默认、instance 选择器拒绝；零消费者 |
| **A6-PR2** | Control 层 case-scoped Officer 决议接缝（四个入口同一谓词） | `packages/runtime/control/service.ts`（中心）、必要的 `types.ts`、ARC-A override | **是**（Center-Interface） | PR1 的 designation 类型（可先以本地类型落） | 指定非 Leader 可决；非指定 Member/跨 Team/已决/Human-only 全部拒绝；同一账本；guard 独立消费一次；旧角色闭集零放宽 |
| **A6-PR3** | 纯 `ReviewWakeCoordinator`：activation/poll/latch、generation、no-progress 守卫 | `packages/runtime/review-wake/**`（纯）、测试、bookings | 否 | 无（可与 PR1 并行） | 3 请求→≤1 wake；running 期间只 dirty；resolved/no-progress 不再 wake；崩溃恢复重读；零 I/O、零 timer |
| **A6-PR4** | 投递接缝：通用 Review Wake 入 DSH Inbox；旧 Leader notifier 的互斥替换点 | `packages/runtime/control/leader-notification.ts`、`packages/runtime/src/plugin/live/agent-bindings.mjs` 等 | **是**（Center-Interface，一次一个文件） | PR3 | opt-in Team 无双投；未启用 Team 逐字节旧行为；未 claim 可撤、claim 后不可撤 |
| **A6-PR5** | Officer 受限访问：读自己应审待办 + 走既有入口决议的最小工具面 | `packages/tools/**`、`packages/runtime` 访问适配器、契约 | 视落点（若触 `live/**` 另开中心 PR） | PR2 | Officer 不能读全 Team 管理面；决议复用 ControlService；工具面负控完整 |
| **A6-PR6** | 生产接线与 opt-in：Team 创建时唯一 Officer、蓝图绑定、旧 notifier 切换、观测 | `packages/runtime/root*`、plugin 组装、GUI 邻接 | 可能 | PR1/2/4/5 | 至少一条真实消费纵切；未启用 Team 零变化；指标可读 |
| **A6-PR7** | 真 Host 端到端与发布证据 | 测试套件/证据，不改生产语义 | 否 | PR6 | PR #536 §4 最终行为矩阵全绿；指标齐全；BLOCK/ENV 如实标 |

**并行 lane**：

- Lane D（domain/router）：A6-PR1。
- Lane W（wake）：A6-PR3。
- Lane C（control）：A6-PR2，PR1 落地后接 PR5。
- Integration lane：A6-PR4 → PR6 → PR7，逐个串联，不与中心 PR 并行改同一文件。

## 4. 验收矩阵（从 PR #536 §4 继承，指定 owner）

| # | 可观察要求 | Owner | 层级 |
| --- | --- | --- | --- |
| 1 | 三条普通 Member 常规 ask → Officer ≤1 在途 Wake；Leader 常规审批唤醒 0 | PR3/PR4/PR7 | 单元 + Host |
| 2 | 三件首轮完成或投递前 resolve → 不因旧通知额外启动模型 | PR3/PR7 | 单元 + Host |
| 3 | Officer 执行中 B/C 到达 → 只标 dirty，结束后重读，不逐条 followup | PR3/PR7 | 单元 + Host |
| 4 | 模板 A 指定 Leader、模板 B 未指定 → A→Leader、B→Officer；同模板实例初始一致 | PR1/PR7 | 单元 + Host |
| 5 | 调度/治理/持久权限变更 → Leader；Human-only → Human，不被 Officer 接管 | PR2/PR6/PR7 | 单元 + Host |
| 6 | Officer 主动 handoff → 当前 leg 归 Leader；合并唤醒；不抢回 | PR2/PR3/PR7 | 单元 + Host |
| 7 | Busy 保持排队；Unavailable 分别验证 hold / leader | PR3/PR6/PR7 | Host |
| 8 | 插件审批通知与工作完成通知共存 → 不互相覆盖/不误去重 | PR4/PR7 | Host |
| 9 | claim 后崩溃、恢复、用户 Stop → 可恢复权威未决；无重复 allow；Stop 不被复活 | PR3/PR7 | Host |
| 10 | 未启用 Alpha.6 的 Team → 旧 notifier/角色/权限/审批行为不变 | PR4/PR6/PR7 | 单元 + Host |
| 11 | 路由不改变 allow/deny；Officer 决议后 guard 独立验证 | PR1/PR2/PR7 | 单元 + Host |
| 12 | 指标：Leader/Officer 模型请求数、token、通知数、审批可达性、等待时间 | PR7 | Host |

## 5. 测试与证据策略

- **L1 纯单元**（每个 PR 必跑）：路由解析/拒绝矩阵、latch 合并/无进展、
  schema 哈希零移动。禁止用 mock 替代权威账本断言。
- **L2 服务层真实对象**：ControlService + 真实 TeamDomain world（P-AUTH
  模式）；负控必须包含普通 Member、非指定 Member、跨 Team、已 resolved、
  Human-only、治理事项。
- **L3 真 Host**：`tests/world-factory` 的预算租约与 pristine Host
  `639ed01539`；一个 World 一次 boot；端口只用 `tests/paths.mjs` 的测试带，
  绝不碰 `:3080`。
- **L4 发布**：矩阵 + 指标 + 回滚演练。Host 不可运行标 `ENV_BLOCK`，不得
  以模块全绿替代。
- 证据目录：`dev/agent-workflow/evidence/alpha6/<pr>/`；每个 PR 的
  `RESULTS.md` 必须写清“跑了什么、没跑什么、为什么”。

## 6. 风险与回滚

| 风险 | 触发点 | 缓解 |
| --- | --- | --- |
| P-AUTH 接缝被扩大成全局角色放宽 | PR2 | 四入口同一谓词 + 负控；ARC-A override 具名；security reviewer 必审 |
| v5 改动意外移动 v3/v4 哈希 | PR1 | canary 常量回归 + 旧版本拒绝新字段 |
| 双 notifier / 重复唤醒 | PR4/PR6 | 每 Team 互斥开关；Host 指标（通知数/模型轮次）作为验收 |
| claim 后崩溃导致丢待办或重复 allow | PR3/PR7 | 恢复重读权威；消息不是授权；Host 崩溃用例 |
| “Busy”被误判为“Unavailable” | PR3/PR6 | Busy 只排队；Unavailable 需明确不可恢复证据；两种策略都测 |
| 过度设计复发 | 全部 | 不新增第二份账本/调度器/timer；新增任何持久状态都要在 PR 描述里逐条对照 A6-LEDGER/A6-INBOX |

**回滚**：v5 蓝图 opt-in；PR6 之前的 PR 全部 dormant；PR6 的回滚只需关闭
opt-in 并恢复旧 notifier 入口；不迁移旧数据、不改旧文档。

## 7. 评审组成与门禁

- 每个 PR：lane 自检 → 独立 code-review（未参与实现）→ 触及中心/投递面追加
  security reviewer；修复只复审本轮 findings，须逐条关闭证据。
- 中心 PR（A6-PR2/PR4）：另需 ARC-A override 条目、具名 Center-Interface
  说明、以及“无新增绕过规范服务的权威写路径”声明。
- 每个 PR 合并前必须通过 `docs-sync --check`、typecheck、lint、相关测试；
  Host 证据与 CI 证据分开陈述。
- 任一 PoC 结论被后续证据推翻 → 回到本计划 §1 修订，不得在实现里“顺手
  解决”。

## 8. 待用户/ADR 确认的决策（PR-A6-1 前）

1. **schemaVersion 5** 是否是本轮采用的加法边界（备选：延后 schema，先做
   PR2/PR3；不推荐，因为路由无来源）。
2. **唯一 Officer 的“存在性不变量”**（创建时恰好一个、按模板查询）是否
   可接受；若不接受，需要另设计绑定事实并重新过 A6-LEDGER。
3. Officer 模板缺失/创建失败时 **fail closed 拒绝启用**，还是允许团队先
   创建、后补 Officer（本计划倾向前者）。
4. `whenOfficerUnavailable` 默认 `hold` 是否保持；`leader` 接管是否要求
   Blueprint 显式声明（本计划要求显式）。
5. 指标落点：只进 evidence/日志，还是需要长期可观测面（不得为此新建第二
   套任务库）。

## 9. 完成定义

- 验收矩阵 1–12 全部有真实证据（Host 不可用项标 ENV_BLOCK 并给出解除
  条件）；
- 未启用 Team 的旧行为有回归证据；
- 无第二份审批/授权账本、无七相位调度器、无新 timer、无 Core patch；
- 中心变更均有具名 PR 与 ledger override；
- 回滚演练通过；
- 发布说明明确“Officer 能做什么、不能做什么、Busy/Unavailable/Handoff
  的边界”。
