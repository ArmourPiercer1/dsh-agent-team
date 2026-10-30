# Alpha.6 S0 — 基线复审与接口可行性（Lane 2，2026-10-30 真实 UTC）

> **状态**：S0 结论文件（Lane 2 独立执行体产物）。**不改变全仓 Current Authority**（仍 = `dev/engineering/current-authority.json` → Alpha.5 `as20261026r1`），不宣布 Alpha.5 GO，不授权实施/启用/合并。
> **设计来源**：GitHub PR #319（Closed，未合并）`docs/plans/memo/alpha6-review-separation/architecture.md`，head commit `e3158780533997acfe4fdc92023301504b16a77a`，原审查基线 `master @ fe8290381d1518ff437b60fb72972e5742f0e40d`。本文件**不复述**该草案，只记录它在当前基线上的再验证结果。
> **复审基线**：`origin/master @ 12cc9843e840849e7f831d513fdcd83b0813a921`（= 本 Lane clone HEAD 起点）；DSH 宿主 = 固定测试基线 `0.2.0-rc.2 @ 639ed015397290b3745d163aafe02ffee4aa3f84`（`tests/paths.mjs` 的 `TEST_USE_BASELINE_SHA`）。
> **与设计基线的距离**：`fe829038..12cc9843e` = 942 commits；`packages/runtime/control/**` 1 commit、`operation-permission/**` 3、共享装配面（`root.ts` + `live/*.mjs`）36。

## 0. S0 结论

**CONDITIONAL PASS**——架构方向可行，**无 `CORE_SEAM_BLOCKER`**（不改 DSH 上游即可成立）；三个条件必须先落地：

| 条件 | 内容 | 未落地时的边界 |
| --- | --- | --- |
| **C1 受保护中心** | Alpha.6 的决策入口改造点**全部落在 ARC-A 摘要钉死的受保护中心**（`control/**`、`operation-permission/**` 等 33 文件）。任何改动必须是**具名 Center-Interface PR + `arc-a-protected-center.json` override 条目**（先例 #377/#391/#392），不是普通功能 PR。 | Alpha.6 只允许实现**零受保护文件改动**的模块（调度器内核、ReviewPlan/Mandate 派生、投影派生、家族工具），决策入口改造排队为具名接口 PR。 |
| **C2 同机资源隔离** | 两个 clone 的端口租约互不可见（租约文件在各 clone 树内）；`/srv` 共享宿主基线在本机不存在；BOOT-BUDGET 是 git 账本，非运行时互斥。 | **禁止真实 Host 并发启动**。本阶段只跑静态检查、单测、局部构建；真实 Host PoC 延后到有跨 clone 互斥或端口分区协议之后。 |
| **C3 CI 可见性** | 全部 workflow 的 `pull_request` 触发条件是 `branches: [master]`（base 过滤）；base 非 master 的 PR **零 CI**。master 的服务器端保护 = required checks `pr-gate` / `ci-required` / `pr-settlement-gate`，`strict=true`，`enforce_admins=true`（`gh api` 实测 200）。 | Alpha.6 的 PR 一律 **base = master 的 Draft PR**（取得真实 CI），Lane 内集成分支只作堆叠，不冒充门禁。缺少检查不得记为通过。 |

## 1. 原架构决定：保留 / 修订 / 否决

**保留（证据支持，无需修订）**

- P-1 不新增权限阶梯；Approval Officer = 持受限 Mandate 的普通 Member Instance。
- P-2 `ReviewAssignment` 只表示归属，不构成授权；权威仍是唯一 ControlService/TeamDomain。
- P-3 `handoff`（同级转交）≠ `escalateApprovalLeg`（`control/service.ts:4786`，真实权限层级迁移，写入 `control-request-escalation-recorded` 并升 leg）。
- P-4 单飞调度器只拥有非授权调度状态；不建第二套审批账本。
- P-5 不宣称跨 TeamDomain/DSH Inbox 的物理 exactly-once；必须设计崩溃恢复、去重、fencing、Stop、fail-closed。
- P-6 未启用 Alpha.6 的既有 Team 保持旧行为；新旧 notifier 不得对同一审批路径双投。

**修订（当前代码给出的更强形式）**

- R-1 原 §4.2 只把 ReviewPlan 作为"配置建议"；**升级为硬前置**：Mandate 只能由可信 ReviewPlan 在当前 Team/Blueprint hash/epoch 上派生，模型文本与 `callerRef` 自称一律无效。理由见 §2.1（成员 decider 在持久语法上本就合法）。
- R-2 原 §6 的"Case-scoped ReviewMandate"落地形态确定化：**新增 ledger fact 家族**（granted/revoked，同 `putEntry`、同 `withTeamLock`）+ `buildApprovalCaseState`（`control/service.ts:4363`）派生 `mandates` 切片；不在 Case 行上加 assignee 字段（Case 本就是 fold，`ApprovalCaseState` 无 version/generation 字段）。
- R-3 准入式必须是 `kind 角色表 ∋ role` **OR** `(row.approvalCaseId 存在 ∧ 该 case 上有效 Mandate 绑定 callerRefOf(caller))`。**OR 支必须以 `approvalCaseId` 存在为门**：加宽角色表（给 `leader-approval` 加 `member`）会让无 leg 的历史/PA 行也获得 member 决议权——即使不考虑 C1 也是错的。
- R-4 唤醒投递的实现路径由"改造 `deliverRootControlNotification`"改为"**新投递面 + 显式旧路保留**"：同文件已存在 acceptance-only + plugin 归属的正确先例 `deliverRootWorkCompletionNotification`（`agent-bindings.mjs:5203-5256`：`source.kind='plugin:dsh-agent-team'`、idle→`followup`/busy→`steer`、不 `await whenIdle`）。Alpha.6 抄这个先例，不动旧路语义。
- R-5 单飞去重的宿主侧机制确定化：宿主**没有**幂等键，但 `Inbox` 对 pending 消息按 `message.id` 唯一并同步抛出 `message "<id>" is already pending`（`agent-loop/src/inbox.ts:223`）；因此 **插件自造确定性 `MessageId`** = 宿主背书的去重原语。唯一性只覆盖 pending、只在进程内 ⇒ 持久 fold/检查点不是可选优化，是必需件。
- R-6 `ReviewAssignment` 的 CAS 与投影落点确定化：投影 fold 对未知 `factType` 抛 `TEAM_PROJECTION_SOURCE_LEDGER_CATEGORY_UNKNOWN`（`packages/runtime/test/a4pr0a-fact-type-closed-set.test.ts` 头注），新 fact 家族**必须同 PR** 加 category 映射；派生视图走 `packages/testkit/test/p4t6-projection-categories-bookings/` 的 drop-in 目录（新增 `<family>.mjs`，不编辑中心）。

**否决 / 不做**

- V-1 否决"用 `CONTROL_RESOLVER_ROLES` 加宽实现 Reviewer"（`control/types.ts:193-197` 是 carrier-kind 闭表，加宽即违反 invariant 37 且波及无 leg 行）。
- V-2 否决"Scheduler 自行决定 who handles this"。Router 是确定性代码；Router 输入缺失 → fail closed（交 Leader）。
- V-3 否决本轮任何 Blueprint v3 schema 变更。opt-in 用既有 Host 侧透传位（`config.teamToolPlane.*`，先例 `jobsEnabled` / `centerAssembly` / `uiFamilyEnabled`，`agent-bindings.mjs:2599`、`:2648`；缺省 = 零翻转）+ 结构开放的 `capabilities.teamTools` 允许表。

## 2. S0-A 权限决策入口（受限委托能否进唯一权威路径）

**结论：FEASIBLE**，且它使实现对齐**已写下的 Alpha.4 法律**，不是新增权威。

- 决议唯一写路径：`resolveControl`（`control/service.ts:2555`）→ `commitDecision`（`:1992`）；锁内顺序 NOT_FOUND → abandoned → DECIDED → **role closure `:2622`** → case 法 `assertNoActOnEarlierLeg :2642` → envelope → staleness → 外部硬策略 → PA gate → commit。锁外只有 `notifyLeaderRequest`（`:2535-2549`）。
- 身份来源可信：`admission/resolve.ts:216-287`（human / `LEADER_INSTANCE_ID`→leader / 活成员行，否则 `CALLER_ROLE_STALE`），工具面 caller 由宿主派生（`tools.ts:455-481`）。
- **规格早已 case-scoped**：Alpha.4 规格 `mayReview(reviewer, CASE)`（`alpha4-permission-governance-spec.md:305`）+ §24.4 要求写路径重导出 leg `reviewAuthority`；实现目前只以 kind 表实现它。→ Mandate 检查是**向成文法律收紧**。
- 持久语法已合法容纳成员 decider：`parseCallerRef`（`service.ts:518-538`）接受 `{kind:'instance', role:'member'}`。
- 组合点 = 4 个 role-closure 站点 `:2622 / :4852 / :5228 / :5495`。既有锁内端口 `authorityRevalidation` / `paEffectsVerifier` 都是 **refuse-only 且在 role closure 之后**，无法承载"准入"型组合检查——这是新能力形状（新 shape，不是新 store）。
- Alpha.5 交互不变量：allow 之后执行时仍重验 A1-14 rung（`:3210` 传 ROW 的 `reviewAuthority`）、PA verifier、exact scope + 一次性消费、`verifyEffectSetApproval`（`tool-admission/approval-case.ts:446-517`）、grant single-use。Mandate **不改写** row 的 `reviewAuthority`，只附在旁边。

**必须先裁决的边界（Lane 2 建议，待集成裁决）**

- 无 `approvalCaseId` 的三类 `leader-approval` 行（pre-v3 适配、PA bridge 行、裸 `team_request_control`）**不进 Officer 视野**：case-keyed Mandate 结构上挂不上去；`escalateApprovalLeg` 今天就拒它们（`:4845-4851`）。
- `tadm:…` 是 PA 效果集 id，**不是** control `approvalCaseId` 命名空间（顶层写入 = corrupt leg）。
- 消费门 `:3210` 传 ROW rung：mandate allow 之后 `authority-risen` 仍须拒。

## 3. S0-B DSH 公开接口（固定 `0.2.0-rc.2 @ 639ed01539`）

无 `CORE_SEAM_BLOCKER`。关键公开能力（上游路径相对 `/home/armourpiercer/deepseek-harness`）：

| 需要 | 公开 API | 引用 |
| --- | --- | --- |
| 取目标 Agent | `ctx.agents.get(id)` / `.resume({...})` | `core/agent/src/index.ts:566`、`:410` |
| 入队唤醒 | `agent.followup(m): void`（= next-turn + wake）；busy 用 `steer` | `core/agent/src/runtime-types.ts:222`、`:231` |
| 去重 | 无幂等键；pending 按 id 唯一并抛 `already pending` | `core/agent-loop/src/inbox.ts:223` |
| 撤回未领取 | `agent.inbox.remove(messageId): boolean`（仅 pending；抛 `agent/inbox/discarded`） | `core/agent/src/runtime-types.ts:84`、`inbox.ts:152` |
| 插件归属 | `MessageSourceMap` 可声明合并；本仓已发 `kind:'plugin:dsh-agent-team'` | `core/llm/src/message.ts:110-136`；本仓 `agent-bindings.mjs:5246` |
| claim→turn 绑定 | `agent/inbox/claimed {agent,message,turn}`（**live-only，不可回放**） | `runtime-types.ts:299`、`inbox.ts:112` |
| turn 结束（持久） | `session/event` `turn/end {turn,reason}`；Stop = `reason.kind='aborted' ∧ cause.kind='user'` | `core/session/src/types.ts:297`、`:189-194` |
| 重启后"是否有开轮" | `sessionProjections.stateOf(s,'turnBoundary').openTurnStartSeq` | `core/agent/src/types.ts:69-79` |
| 调度器持久状态 | `storageDomain.open(defineDomain(...))` KvTable（CAS/条件写）+ `domain/changed` | `packages/storage/storage-domain/src/index.ts` |

**缺口（全部插件侧可缓解，均不需宿主补丁）**：G1 无提交幂等键（用确定性 `MessageId` + 持久 fold 代偿）；G2 宿主不合并唤醒，N 条 pending = N 个连续轮次（`agent.ts:252-254`，正是原设计 §1.2 的放大器）；G3 无公开租约/fencing（在 storageDomain 内自管 epoch/CAS）；G4 交给 idle Agent 的唤醒**不可召回**（`runtime-types.ts:206-210`：即使消息被清掉，轮次边界仍会开）⇒ 去重必须在 `followup` **之前**完成；G6 `agent/inbox/claimed` 不持久、`user/message` 无 turn 字段 ⇒ 重启后按位置 fold。

**硬约束**：`whenIdle()` 等待整个队列抽干（`agent.ts:237-241`），今日控制通知正因此成为多余轮次的放大器（`agent-bindings.mjs:5033`）；`agent/created` / `pre-step` / `turn-stopping` 是**被 await 的**钩子（`runtime-types.ts:252-254` 明文禁止在钩子里 `whenIdle()`）⇒ 调度器只订阅 emit-mode 事件。

**当前路径的三项违例（本仓 `agent-bindings.mjs`）**：acceptance-only ✗（`:5033` await `whenIdle`）；单飞去重 ✗（无 wake 去重，消息 id 每条新 UUID）；插件归属 ✗（`:5030` 用 `source:{kind:'user'}` 冒充人类输入；真人标记实为 `kind:'user' ∧ rpcId`）。

## 4. S0-C 接口所有权矩阵（摘要）

| 路径 | Alpha.5 热度（10-20 起，非 merge） | Alpha.6 需要 | 类别 | 变更载体 |
| --- | --- | --- | --- | --- |
| `runtime/control/**` | 1 | 是（决策入口、wake-set 退出） | SHARED_SEAM **PROTECTED** | 具名 Center-Interface PR + arc-a override |
| `runtime/operation-permission/**` | 3 | 是（rung→审批者） | SHARED_SEAM **PROTECTED** | 具名接口 PR + override |
| `runtime/governance-center/**` | 5 | 否 | ALPHA5_OWNED | 只以 contribution 交互 |
| `plugin/root.ts` | 1 | 是（端口装配、工具接线） | SHARED_SEAM（非 protected） | 普通/接口 PR |
| `live/agent-bindings.mjs` | 9（热） | 尽量否（仅需注入点时） | SHARED_SEAM **PROTECTED** | 具名接口 PR + override，合并为**一个** |
| `live/team-tool-plane.mjs` | 19（最热） | **否**（FamilyAssembly 已落地 = 0 平面行） | ALPHA5_OWNED | 家族 PR 必须零平面 diff |
| `live/family-assembly.mjs` | 2 | 否（能力键闭集，禁授权句柄） | ALPHA5_OWNED 契约 | 无 |
| `packages/storage/schema/ledger.ts` | 低 | 新 fact 家族（无需改存储） | SHARED_SEAM 只读 | 无（factType 是开放卫生串） |
| `packages/contracts/**` | 1 | 否 | SHARED_SEAM frozen v1 | 避免 |
| `tools/src/tools.ts`（Team15 目录） | 0 | 是（`team_list_assigned_reviews` / `team_review_decide`） | SHARED_SEAM 实际开放 | 功能 PR + EF-05 再生产仪式 |
| `tools/families/manifest.json` + index | 16 | 是 | SHARED_SEAM HOT | 家族 PR；push 前 rebase |
| 新 `tools/review-family/**` | — | 是 | **ALPHA6_OWNED** | 家族 PR |
| 新 `packages/runtime/<a6-lane>/**` | — | 是 | **ALPHA6_OWNED**（非 protected 前缀） | 模块 PR + `p4t6` booking |
| `tests/paths.mjs` / `tests/world-factory/**` | 1 / 109 | 只读 + drop-in suite | ALPHA5_OWNED 基础设施 | drop-in `suites/`、`world-kinds/`；BOOT-BUDGET C-册预登记行 |

**新增文件的既有记账门（不可绕过）**：`packages/**` 新增可扫文件必须在 `packages/testkit/test/p4t6-bookings/<lane>.json` 落 booking（精确总量法）；投影 category 走 `p4t6-projection-categories-bookings/`；新模型可见工具进 `TOOL-CAPABILITY-MATRIX` M-14/A-10 计数与 `u7-tool-acceptance.json` 本行。

## 5. S0-D CI 与同机资源隔离

- **CI 只对 base=master 的 PR 生效**（`pr-gate.yml:46-51` 等 9 个 workflow 全部 `branches: [master]`；`ci-fast/integration/security/full` 是 `workflow_call`-only，仅由 `ci-required` 调用）。
- **服务器端保护实测存在**：master required contexts = `pr-gate`、`ci-required`、`pr-settlement-gate`，strict，`enforce_admins=true`；`stable` 无保护；唯一 ruleset `enforcement: disabled`。Lane 集成分支无保护 ⇒ 其门禁只有纪律 + 本地运行，必须如实披露。
- 结算法：`DO-NOT-MERGE` 标记（标题或正文首行）= 阻塞；解除需首行为 `[dated settlement, …]` 且内含与检查时 head 相等的 40-hex sha 的 issue 评论。
- 门禁分级：C1 = 静态/离线（CI 唯一真跑的层）；C2 = 真实 Host canary，**从不进 CI**（`tests/world-factory/u5-canary-runner.mjs --suite … --budget-ledger`）；ENV_BLOCK/SKIP/REFUSED 永不是 PASS。
- **同机隔离真相**：WorldFactory 端口租约默认落在 `<本 clone>/.artifacts/tmp/port-leases`，只对同一 clone 的 `.worktrees/` 收敛（`tests/world-factory/lib/world-factory.mjs:289-293`）⇒ **两个 clone 无法互斥**；DSH_HOME/lock 每 clone 独立；BOOT-BUDGET 是 git 账本非运行时锁；跨 lane 仅剩 OS bind 探测（TOCTOU）。本机测试端口段此刻全空（只有 `:3080` 稳定实例 + DNS，绝不触碰）。
- 本 clone 缺 `tests/deepseek-harness-test-use`，且 `/srv/workspace` 基线在本机不存在；`provision-host-sandbox.mjs --check` 以 `ENTRY_MODULE_MISSING` fail-closed。⇒ 真实 Host 腿全部 **ENV_BLOCK 候选**，按 TEST_METHODS §8 记 ENV_BLOCK，不记 PASS。

## 6. 对实施计划的直接影响

见同目录 `alpha6-lane2-execution-plan-20261030.md`。一句话：**PR3（单飞调度器内核）与 PR0（可信 ReviewPlan/Identity/Mandate 派生）不碰受保护文件，先做；PR1/PR2 的决策与路由入口改造是具名 Center-Interface PR，排在 C1 条件落地之后；真实 Host 腿（PR4/PR5 的验收形态）在 C2 条件落地之前全部 ENV_BLOCK，不冒充。**

证据原件（本仓 gitignored `.artifacts/alpha6-s0/`，随 PR 附关键片段）：`A-permission-decision-audit.md`、`B-dsh-public-api-0.2.0-rc.2.md`、`C-ownership-matrix.md`、`D-ci-and-resource-isolation.md`。
