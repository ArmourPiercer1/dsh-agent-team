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

### R-5 风险台账（ROUTER_RULES §6）：#513 pinned-quote 校验器可被同 commit 关掉——2026-10-31 接受为已知残差

- **Gate**：ci-pr-gate leg `verbatim-quotes`（必需 leg，非 OPTIONAL_BY_DEFAULT）+ 其校验器
  `dev/agent-workflow/evidence/alpha6-513/verify-verbatim-quotes.mjs`。
- **风险点**（round-11 F-R11-3 MAJOR，作者已接受；round-14 复现）：**被打分的那份 checker 与被它打分的
  内容在同一个 commit 里可编辑**。把 `NEAR` 从 56 抬到 124、把 leg 从 LEG_ORDER 摘掉、或把校验器换成一个
  只打印 `quotes=2 drift=0 verdict=ok` 的桩，都能让本应红的文档变绿；汇总行的 `verifier_sha256=`
  **不验证任何东西**——它哈希的是"当前正在跑的那份字节"，因此钉住的是结论，不是判断。
- **相关文件 / 证据位置**：校验器头部 RESIDUAL RISK 段（同一措辞三处：本 memo、leg 注释
  `scripts/ci-pr-gate.mjs`、校验器头部）；复现在 round-11 攻击集与 round-14 攻击集的
  `x_stub_verifier` / `x_near_switch` 两例（各自打印被改字节与 rc 翻转；按 lane 约定证据留在 scratch，
  不入 tracked 内容，结论与可复跑用例名登记在此行与校验器头部）。
- **当时判定"可控"的理由**：round 11 的结论成立且被接受——**仓库内不存在防线**（PR 内的任何检查都可被该
  PR 编辑，自指即无穷回归；自哈希或由同一文件校验签名只是掩盖回归，不是消除）。唯一真实的控制是带外动作：
  对 `scripts/ci-pr-gate.mjs` 与 `dev/agent-workflow/evidence/alpha6-513/` 施加 branch protection +
  `CODEOWNERS` 审查。**这是托管远端上的运维者动作，本 lane 尚未执行，也不得宣称已经就位。**本控制真正
  拥有的是确定性：同一字节必得同一结论，任何人可复跑，所以绿可被核查——但不可被伪造这一点，它没有。

### R-6 风险台账（ROUTER_RULES §6）：census 腿在本 lane 分支拓扑上没有任何可达绿色世界——2026-10-31 登记为继承的 Alpha.5 baseline/仪器缺陷；owner = Alpha.5 phase authority

- **Gate**：`scripts/ci-pr-gate.mjs` 的 `census` leg（`--full` 下唯一非绿腿）；基线正本
  `dev/agent-workflow/evidence/a4-pr7/population-baseline/nine-root-u7-1-old-reds.md`（CURRENT
  CORPUS `626 / 7936`，declared @ `27a818456`，2026-10-26，Alpha.5 阶段）+ gate 自身
  `--self-test` 对 `626/7936` 的钉。**裁决语义 = 红身份集对新成员的空容差集比较**
  （`RETIRED-TO-EMPTY: 9 titled reds retired against predecessor 2b1099d7`），计数只是上下文。
- **风险点**：该 leg 的**可测人口绑在一个 optional gitignored 目录上**——
  `tests/deepseek-harness-test-use` 缺席 ⇒ `REFUSED before spawning vitest`（拒绝不是 pass）；存在
  ⇒ 同一 commit 从 661f/8416l（46 文件零腿，收集即死）翻成 661f/8947l，graded 红集非空。可达世界
  逐一为红：未物化=拒绝；物化未构建=`a4p7` composition-smoke 红 3/3（该状态永不绿）；物化已构建
  =`a4p7` closure + client-lane 红 2/2（已在分支 memo §8 披露）；外加负载 race 池（P11/X3/GLUE-6/
  AC-1/a5p4，solo 3/3 绿）。托管 CI 对这些分支不触发（四个 workflow 全部 `branches: [master]`），
  PR 门禁叙事只剩这条本地腿，而它**无法通过本 lane 的任何合规动作变绿**。
- **非本 lane 造成**：universe 626→660（栈基 `7b906b432`）→661（`a2bc18d78`）→661（head
  `9dd6ff48c`）；lane 的 real-host commit 向 census universe **贡献 0 文件 0 腿**（两 commit × 两
  世界 2×2 实测 + `comm` 空集）。
- **处置（2026-10-31 记录）**：诊断/入册不改任何东西——基线正本、booking、p4t6、gate 脚本一概不动
  （owner 不在本 lane）。**决策 = (c) 现在就记为继承缺陷 + (a) 重定基线升级上报 Alpha.5 phase
  authority**；上报注记：re-baseline 只改上下文句子，不能让本 lane 绿（空容差集一条红即致命），须
  与修两条 a4p7 构建树腿/驯服 race 池配套；(b)（两世界登记同数）同为 owner 的仪器语义变更，未选。
- **证据位置**：`dev/agent-workflow/evidence/alpha6-census-baseline/`（诊断正本
  `census-leg-diagnosis-20261031.md`、机器矩阵 `census-capture-matrix.json`、四份 universe 清单）
  + 执行日志同日「census leg 诊断入册」条目（含对该条目内 :7320「环境拒绝」框定的向前退役引文）。
  原始捕获按证据尺寸守卫与路径键控约束留在 tracked 之外，正本已摘要并声明。
- **当时判定"可控"的理由**：拒绝态从不算 pass、披露纪律在位（PR body 的 environment-refusal 句
  只对其 authoring world 为真，已由日志条目加框）、托管 CI 不受此影响（对这些分支不触发）；本行
  实际拥有的控制是**不让"重跑/补环境"被误当修复**——变绿的唯一路径在 owner 手里，不在本 lane。

### R-7 风险台账（ROUTER_RULES §6）：审批作用域语义在 Alpha.5 执行侧重设计后可能静默变宽或静默失配——2026-11-01（真实 UTC 2026-10-31 书写）登记

- **Gate**：**后续的差分审查（differential review）**——Alpha.5 sandbox-first 执行链与 Alpha.6 审批集成
  的接口差分审查，发生在任何审批→执行路径接线授权之前；本行风险在该 Gate 上有名有据之前不解除。
- **风险点**（源自用户 2026-11-01 转发的外部设计裁决之两契约之一，代码侧实测成立）：审批作用域语义的
  两类静默失效。①**`by-action-name` 过度委托**：`ReviewPlan.effectScopes` 只认
  `exact-fingerprint`/`by-action-name` 两种形式且无通配（`packages/runtime/review-mandate/plan.ts:209-210`），
  而 `planCoversEffectScope` 令 `by-action-name` 覆盖该动作的**每一个** fingerprint
  （`plan.ts:333-344`）——在逐工具 EffectSet 执行模型下这是一个有界作用域；在 MemberPolicy 驱动的 I/O
  执行模型下，若未来 I/O 扩权请求复用既有 mandate 的 fingerprint 空间，一次 `fs:write` 授权可能静默
  变成对任意写入的空白授权。②**fingerprint 身份漂移**：若执行侧改变了 fingerprint 的推导语义，原本
  匹配的 scope 会静默不再匹配（字符串全等对调用方折叠进来的任何值），失效不报错、只是永远拒绝或永远
  放行不了该拒的东西。
- **相关文件 / 证据位置**：`docs/plans/memo/alpha6-review-separation/alpha5-sandbox-first-interface-20261101.md`
  （§3 fingerprint 身份、§4 版本绑定 = 两个具名待决契约；§2 = 在 `991faacc4` 与 PR #517/#522 heads 逐名
  实测的冻结契约面；§5 = 能力分级启用门三律）。
- **当时判定"可控"的理由**：①整条分支栈是 Draft（PR #531 亦 DRAFT·DO-NOT-MERGE，零代码、不动
  `dev/engineering/current-authority.json`，机器现行合同仍是 PR #364 线）；②`ALLOWED_CONSUMERS = []`
  （`packages/runtime/test/a6-pr2-lane-hygiene.test.ts:47`，`991faacc4` 实测）= 本 lane 今日**零生产调用者**，
  语义漂移无处泄露——没有任何生产路径消费审批作用域判断；③两个开放契约已被写成**具名决策**（各自的
  选项、当前行为、以及"本轮不改代码，因为对未冻结契约发明适配器只会造出假接口"的记录在案），不是被
  默认吞掉的假设。控制的实际内容 = 差分审查到来时读者不必重新考古。

#### R-7 扩展（dated 2026-11-01，真实 UTC 2026-10-31T22:32Z–22:42Z 书写；`date -u`，ROUTER_RULES §8.5.8 时钟锚点律）：
#### 触发器入册——**消费者在 guardrail 仍按 tripwire 定标时出现**（owner + 检查写死，不另开 R-8）

- **为什么扩这一行而不是新增 R-8**：本触发器击穿的正是本行「当时判定"可控"的理由」第②条所依据的那件实测事实——
  `ALLOWED_CONSUMERS = []`（零生产调用者）。也就是说，**消费者出现 = 本行的可控前提消失**，这是同一个风险本体的
  激活条件，不是第二个风险；同一风险写两行，未来的读者只会读到其中一行。上一笔治理 commit（`fe8918209`）已按同一
  判据拒绝过一次新增行（那次是标签新鲜度），本轮沿同一判据。**扩展只加内容，本行上文原文一字不动。**
- **触发条件（任一成立即触发，全部可实测）**：①任何名字进入 `ALLOWED_CONSUMERS`（不再等于 `[]`）；②发布出任何
  入口——`packages/runtime/review-assignment/**` 或 `review-mandate/**` 在 `packages/runtime/test/` **之外**获得
  调用方（含经由 lane barrel `review-assignment/index.ts` 的 re-export）；③出现 build/tooling 消费者——有产物、
  kit 或脚本 import lane 的 `dist` 而非源码（此臂同时是 PR #522 开放项 `F-I1b5-7`（symlink 进 `dist`）从"无法测"
  变为"必须测"的那条线）。
- **触发后欠的动作（时序是硬要求）**：guardrail **在那笔引入消费者的 PR 合并之前**重新定标为 **boundary**——
  行为性检查（活 verdict 逐路径 `Object.keys` 精确闭形、判别联合穷尽性）写进 **issue #502 的接口合同**，
  **不得**以"再加一条静态规则"顶替（静态扫描不是能力边界：正本 = 接口 memo §7.1/§7.2
  `docs/plans/memo/alpha6-review-separation/alpha5-sandbox-first-interface-20261101.md`，含 #522 收束语逐字引用）。
  定标未改而消费者已合并 = 本行由"可控"直接转为**已泄露**，须按 ROUTER_RULES 入册为缺陷，不是补文档。
- **Owner**：引入消费者的那笔 PR 的写者——**在其 PR 内**完成重新定标；本 lane 治理写者只负责在差分审查到来时证明
  触发器被检查过（可复跑命令见下），不承担替别人定标。**Gate 未变**：仍是本行的后续差分审查（differential review），
  发生在任何审批→执行路径接线授权之前；本扩展给这个 Gate 加了一条有名有姓的前置检查，没有替换它。
- **检查（可复跑，逐条给判据；本轮实测值附后）**：
  `grep -n "const ALLOWED_CONSUMERS" packages/runtime/test/a6-pr2-lane-hygiene.test.ts` → 判据 = 必须是 `= []`
  （本轮实测：`GOV` `991faacc4` `:47`；活 `P517` `199e18cc4` `:48`；活 `P522` `aee7cec18` 那份 `:56`——三处皆空表，
  行号各按其 commit 标注）；
  `git grep -n -E "(from|import\()\s*['\"][^'\"]*review-assignment" <head> -- packages ':!packages/runtime/dist' ':!packages/runtime/test'`
  → 判据 = **必须无输出**（本轮实测 `aee7cec18` 无输出；不加排除的对照只答测试文件，证明这条 grep 不是"静默为空"）；
  `git cat-file -e <head>:packages/runtime/review-assignment/assignment-admission.ts` → 判据 = 除 `P522` 系分支外
  **必须 ABSENT**（本轮实测活 `P517` / 活 `P531` / `GOV` 三处 ABSENT）；再加一条 build 臂：任何新增的
  `tests/kits/**` 或脚本若 import lane 的 `dist` 路径，即触发 ③。
- **本轮实测状态（2026-11-01 记账，真实 UTC 2026-10-31T22:32Z–22:42Z）**：三个触发条件全部**未成立**，两条
  guardrail PR（#517 / #522）本轮**各自收束于"仪器+诚实披露"**（#517 于 `199e18cc4`，round-5 = 0/0/1/3，
  `F-I1a3-3` 元上限按设计保持开放；#522 于 `aee7cec18`，round-8 = 0/0/1/5，`F-I1b5-7` 待真实构建保持开放），
  两者仍 Draft + DO-NOT-MERGE、`control/service.ts` 仍不在 #522 的 diff 内。**风险状态：仍可控，但"可控"的依据从
  "零调用者"这条事实变成了"零调用者这条事实每轮被实测一次"**——差别是有意的：前者是状态，后者是动作。
