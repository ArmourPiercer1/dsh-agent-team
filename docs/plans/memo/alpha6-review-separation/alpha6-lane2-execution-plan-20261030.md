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
| G-4 新增文件记账 | `packages/**` 新可扫文件 → `packages/testkit/test/p4t6-bookings/alpha6-<pr>.json`；投影 category → `p4t6-projection-categories-bookings/alpha6-<pr>.mjs`；新 factType → 同 PR 加 fold category。**并且**：`packages/runtime/dist/**` 是入库的安装面——凡在 `tsconfig.build.json` include 里新增一个 lane 目录，必须同 commit 提交 `pnpm build` + `place-dist-glue` 的产物（否则 `check:artifacts-committed` 在 pr-gate / ci-security 双双报 `verdict=stale … produced-but-untracked`；PR #501 首轮 CI 即为此红）。 |
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

---

## 修订记录（2026-10-31 真实 UTC，用户裁决驱动；原文 §0–§4 不改写）

裁决正本 = 同目录 `rulings-20261031-timed-wake-and-pr-i1.md`；能力边界变化 = 同目录
`s0-addendum-timed-wake-carrier-20261031.md`（新增命题 N-1）；阻塞台账 =
`dev/agent-workflow/blockers/alpha6-pr-i2-timed-wake-carrier-20261031.md`。

### R-1 依赖图变化（新增一条阻塞边，重述一条既有边）

```
新增：CORE_SEAM_BLOCKER(alpha6-pr-i2-timed-wake-carrier) --阻塞--> PR-I2 的 floor-delayed 定时唤醒子集
重述 **2026-10-31 同批裁决 §3**（round-3 G-R3-7 修正归因：BL-01 的 OPEN RELEASE BLOCKER 状态与「阻塞发布」是既有记录 `ALPHA5-EFFECTIVE-BACKLOG.md:13`；**PR1-allow 这条边**与「开发/审查不受阻」豁免出自本轮裁决——此前计划把 PR1 的 allow 门记在 G-5、把 BL-01 指向 PR-I1/PR-I2）：BL-01(OPEN RELEASE BLOCKER, Alpha.5) --阻塞--> PR1 的 allow 接线与发布验收（开发/审查不受阻）
不变：PR-I1a --无前置--> 可开工（本轮已开始）
不变：PR-I1b --前置--> 具名 Center-Interface PR + ARC-A override + 与 Alpha.5 的文件所有权协调；可与 I1a 并行开发
不变：PR5′  --前置--> 仅读现有真实事实；优先级低于 PR-I1
不变：真实 Host C2 --ENV_BLOCK--> 最终候选 HEAD 的单所有者运行（资源隔离未证明前不计 PASS）
```

### R-2 §1 表的编号映射（消歧，不改内容；历史编号不得静默重定义）

| 原 §1 行 | 当前编号 | 变更性质 |
| --- | --- | --- |
| PR2′（含 `ReviewAssignment` fact + 投影 booking） | **PR2′（#507 已交付待审，Draft + DO-NOT-MERGE，未合并）** + **PR-I1a（新名，本轮开工）** | PR-I1a = 原 PR2′ 行中被递延的"持久化 Writer"那一半，正式命名；不是新造历史编号 |
| PR-I1（4 站点 role-closure 的 Mandate 准入 OR 支 + arc-a override） | **PR-I1b** | 仅编号细化以腾出 I1a；内容、受保护面、override 要求一字不改 |
| PR-I2（`agent-bindings.mjs` 投递面 + 互斥开关） | **PR-I2（不变）**，内部区分「即时唤醒子集」与「定时唤醒子集」 | 后者被 R-1 的 blocker 停掉；**不新建 PR 编号**；PR-I2 的 PR 描述必须显式声明只含即时唤醒子集 |
| PR1 / PR4 / PR5 / PR6 | 维持原编号；PR5′ = 只读展示收窄版 | BL-01 与 C2 的门槛按裁决重述，语义不变 |

### R-3 本轮实际交付（替换 §1 末行"本轮实际交付"的时点陈述，原文保留）

已交付待审（全部 Draft + `DO-NOT-MERGE`，无一合并）：PR-A、PR0、PR3′、PR2′（#507）、PR4′（#509，defer 面，**DORMANT**；26 路径 / 无消费者无接线（`ALLOWED_CONSUMERS=[]`）/ 四个新增休眠 lane 模块 `packages/runtime/review-defer/**`（**universe 明示**：tracked 路径按 #509 head `ff7f4b48b` 实测 = 4——`gate.ts`/`index.ts`/`store.ts`/`types.ts`；同一路径在本 lane 的其它 worktree 里根本没检出（0），所以任何「这个 glob 匹配 N 个」的句子都必须说自己数的是哪个 head、tracked 还是磁盘——round-4 F-R4-10 报的 20 路径在我能到达的三个位置上没有一个复现）——「零生产文件」的旧说法已于 2026-10-31 在 #509 正文撤回，见其评论 `6540728163`，round-3 G-R3-5；三轮独立审查
闭合中）。进行中：**PR-I1a**（受治理的 `ReviewAssignment` 唯一持久化 Writer）。并行允许：PR-I1b 的接口设计与
安全负控（其受保护文件改动须先与 Alpha.5 协调并在 #502 公告所有权）。受阻：PR-I2 定时唤醒子集（R-1）。

### R-4 PR-I1a 的验收判据（用户裁决六条，逐条必须有测试）

创建/转交/退休的持久化写入与恢复；Epoch/CAS + 幂等 + 并发冲突 + 写入失败的明确处理；ledger 所有权校验 + 跨
Case/Team 隔离 + 损坏记录诊断；host/client factType-category 一致 + 重启后 Projection 重建；**Assignment 只是
处理者归属事实，绝不是授权凭据**；条件无法证明时**退回 Leader**，禁止由空 Assignment 或缺失记录推导出允许执行。
硬约束：复用 TeamDomain Ledger / 写入序列 / Team 锁 / 投影；**不建第二套审批 Ledger**；factType 新增必须 host +
client 同 commit 落账；默认关闭，未启用 Team 行为逐字节不变。
