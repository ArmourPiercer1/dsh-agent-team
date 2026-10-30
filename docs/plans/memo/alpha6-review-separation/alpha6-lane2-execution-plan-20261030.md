# Alpha.6 Lane 2 执行计划（PR0–PR6 再基线，2026-10-30 真实 UTC）

> **状态**：Lane 2（独立 clone `dsh-agent-team-lane-2`）的阶段内执行计划。**不是全仓 Current Authority**（仍 = Alpha.5，`dev/engineering/current-authority.json`），不授权合并进 `master`，不授权产品启用。
> **再基线依据**：`s0-revalidation-20261030.md`。设计来源 PR #319（Closed）head `e31587805`；复审基线 `origin/master @ 12cc9843e`。
> **与 Lane 1 的关系**：仅通过 GitHub（分支 / PR / Issue / 契约表）协作；不共享文件、IPC、Agent 记忆；不要求 Lane 1 为 Alpha.6 暂停。

## 0. 硬门禁（每个 PR 都受约束）

| 门禁 | 规则 |
| --- | --- |
| G-1 受保护中心 | `control/**`、`operation-permission/**`、`governance-center/**`、`tool-admission/**`、`tool-dispatch/**`、`live/agent-bindings.mjs`、`live/pa-mount-registry.mjs` 摘要钉死（`dev/agent-workflow/ledgers/arc-a-protected-center.json`，执法 `packages/runtime/test/u6-arc-a-fitness.test.ts` L1）。触及 = **具名 Center-Interface PR + ledger override 条目**（先例 #377）。前缀匹配 ⇒ 这些目录下**新增文件同样违规**。 |
| G-2 CI 可见 | 交付 PR 的 base 必须是 `master`（否则零 workflow，检查缺席不得记为通过）。Lane 堆叠分支只用于依赖串接，其 PR 必须写明"CI 缺席"。 |
| G-3 结算法 | 未获独立审查清偿前保留 `DO-NOT-MERGE`；解除需首行 `[dated settlement, <真实 UTC>]` + 与检查时 head 相等的 40-hex sha 评论（`scripts/pr-settlement-gate.mjs`）。 |
| G-4 新增文件记账 | `packages/**` 新可扫文件 → `packages/testkit/test/p4t6-bookings/alpha6-<pr>.json`；投影 category → `p4t6-projection-categories-bookings/alpha6-<pr>.mjs`；新 factType → 同 PR 加 fold category。 |
| G-5 不冒充 | 真实 Host 腿在资源隔离未成立前一律 ENV_BLOCK；DORMANT/未接线能力不得描述为生产可用；不得为变绿削弱测试。 |
| G-6 零语义外溢 | 不改 Alpha.5 的权限/拒绝/EffectSet/Grant 语义；不改 Blueprint schema；不改全仓 Current Authority；默认关闭（旧 Team 行为逐字节不变）。 |

## 1. PR 切分

| PR | 内容 | 受保护文件 | 可独立度 | 验收形态（本轮真实可达） |
| --- | --- | --- | --- | --- |
| **PR-A** | S0 再验证 + 所有权矩阵 + 本计划（文档） | 无 | 100% | `docs:sync --check` findings=0 + Draft PR 上 master-base CI 真跑 |
| **PR0** | 可信 ReviewPlan / ReviewerIdentity / Case-scoped ReviewMandate 的**纯派生与校验内核** + 安全负控（新目录 `packages/runtime/review-mandate/`） | 无 | 100% | vitest 单测（含负控）+ `pnpm typecheck` + `pnpm test` 无回归 |
| **PR3′** | 单飞调度器**内核**：WakeSlot 状态机、确定性 `MessageId`、去重/撤回/退避/无进度守卫/恢复 fold，全部走注入端口（新目录 `packages/runtime/review-wake/`） | 无 | 100% | vitest：100 请求→≤1 唤醒、首轮清空→后续 0 轮、claim 后不重发、Stop、重启对账、并发 CAS 恰好一胜 |
| **PR2′** | ReviewRouter 确定性分派 + `ReviewAssignment` ledger fact + 投影 category + 同级 handoff（**不改 ControlService 决议路径**） | 无（新 fact + 投影 drop-in booking） | 90% | vitest：归属≠授权、CAS 竞争、handoff≠escalate、投影可派生 |
| **PR-I1** | **具名 Center-Interface PR**：在 4 个 role-closure 站点（`control/service.ts:2622/4852/5228/5495`）组合 case-scoped Mandate 准入 OR 支（以 `approvalCaseId` 存在为门）+ arc-a ledger override | **是** | 依赖裁决 | 与 Alpha.5 共候选重跑 C1 + 安全负控；真实 C2 ENV_BLOCK 如实记 |
| **PR-I2** | 唤醒投递具名 PR：`live/agent-bindings.mjs` 注入 acceptance-only 投递面（抄 `:5203-5256` 先例）+ 与旧 notifier 的互斥开关 | **是** | 依赖裁决 | 同上 |
| **PR1** | Reviewer 决策真正接入 allow（依赖 PR-I1） | 是 | 依赖 PR-I1 | 未过安全门前不接 `allow`（G-5） |
| **PR4** | 真实轮次关联、过期消息、恢复、Stop、fencing 的真实 Host PoC | 否 | **受 C2 阻塞** | 端口分区/互斥协议 + BOOT-BUDGET C-册预登记后方可跑 |
| **PR5** | Alpha.4/Alpha.5 组合回归 + 依赖死锁负控 | 部分 | 依赖 PR1 | 同上 |
| **PR6** | 最小可观测性、UI、启用/回退手册、完整验收 | `root.ts`/plane 邻接 | 末段 | — |

**本轮实际交付**：PR-A、PR0、PR3′（+ PR2′ 视余量）。PR-I1/PR-I2 以**接口契约 PR/Issue**形式提出，不抢先改受保护文件。

## 2. 依赖与冻结面

- 上游冻结面：DSH `0.2.0-rc.2 @ 639ed01539`，只用公开导出；发现需要私有 seam 立即停该路径并报 `CORE_SEAM_BLOCKER`（S0-B 判定：无需）。
- Alpha.5 依赖点（只读）：`CONTROL_RESOLVER_ROLES`、`ApprovalCaseState` fold、`resolveControl` 锁内顺序、EffectSet/Grant 执行时重验、`withTeamLock`、Team15 工具目录、FamilyAssembly 能力闭集。
- 冲突已知：Alpha.5 开放阻塞项 BL-01（ask/审批穿透）与 U6 enforcement flip 都在同一条审批链上 ⇒ PR-I1/PR-I2 必须在其之后、且一次一个受保护文件。

## 3. 审查组成（本仓纪律 = 计划优先，ROUTER_RULES §0.2/§0.3）

每个交付 PR：lane 自检 → 独立 code-review 子代理（未参与本 PR 实现、裁决基于代码与测试）→ 触及授权/投递面追加 security reviewer。修复只复审本轮 findings 并逐条给关闭证据；新的高层交付重新全新评审。

## 4. 同机资源协议（Lane 2 自约束）

1. 独占：本 clone 的 `node_modules`、`.artifacts/`（含私有 pnpm store 副本）、`tests/homes/<world>`、构建产物。
2. 共享 store 在本沙箱只读 ⇒ Lane 2 用工作区内 store 副本，绝不写 `~/.local/share/pnpm`。
3. 真实 Host：**本轮零启动**。开工前置 = 跨 clone 端口分区共识（Lane 2 拟用 13000-13099 段）+ BOOT-BUDGET C-册预登记行 + 宿主树供给（本机 `/srv` 基线缺失，需从 `ArmourPiercer1/deepseek-harness` 分支 `stable-3-0.2.0-rc.2` 克隆至 `tests/deepseek-harness-test-use`）。
4. `:3080`、用户正式 DSH_HOME、Lane 1 目录、上游 pristine 树：绝不读写。
