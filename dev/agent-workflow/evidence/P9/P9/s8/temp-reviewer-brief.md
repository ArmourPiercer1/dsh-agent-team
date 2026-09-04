# P9 S9 独立 reviewer 指令（L2 read-only）

你是 P9（D:\AgentDev\dsh-plugins\dsh-agent-team）S9 收口的**独立 reviewer**。你与 builder/executor 无共享上下文，本 brief 自包含。你的产出是裁决，不是修复。

## 红线（违反即裁决作废）
1. **只读**：不得修改任何 tracked 文件；不得执行任何 git 写操作（commit/add/checkout/branch/stash 全禁）；只允许 `git -C <worktree> log/diff/show/rev-parse` 等只读命令。
2. 五闸验证命令（lint/typecheck/build/test/smoke）**允许执行**（它们只写 untracked scratch/.tmp-fault/node_modules，不动 tracked 文件）。
3. 不触碰：master 提交、冻结分支 `feat/team-vnext-integration-20260829`、`references/` 两棵冻结树、`graph.yaml` 的 `p9_prototype:`/`current_phase`、`docs/plans/active/`（只读权威）。
4. 禁止 push。

## 路径与输入
- **主树**：`D:\AgentDev\dsh-plugins\dsh-agent-team`（bookkeeping + 最终证据所在）
- **worktree**：`D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\P9`（branch `task/P9-ui-legacy-reuse`；产品代码 + 五闸在此跑；注意：**worktree 无 `docs/plans/`**，计划一律读主树）
- **计划（只读权威）**：主树 `docs/plans/active/DSH_Agent_Team_vNext_P9_UI_T12_T24_Legacy_Reuse_Implementation_Test_Plan.md`
  - S9 规范 L1737–1791（五闸命令 L1741–1749；audit 9 列 L1761–1781；verdict 格式 L1783–1791）
  - §9 band L1049–1081；§17 R9-1..R9-4 L1954–2030；DoD-15 L2199–2217
- **终稿 audit（你要签核的文件）**：主树 `dev/agent-workflow/evidence/P9/reuse-audit.md`（§A 47 行 / §B band 表 / §C 14 测试 / §D 预算 / §E carry-over / §F F-4..F-8 / §G PENDING）
- **DoD-15 映射（输入+核验）**：主树 `dev/agent-workflow/evidence/P9/s9-dod15-mapping.md`
- **S1 原稿 + legacy 基线**：worktree `dev/agent-workflow/evidence/P9/`（`reuse-audit.md` S1 草稿、`legacy-ui-team-manifest-at-506191b.txt`、`legacy-506191b/packages/client/ui-team/` 47 文件字节快照）
- **基线**：audited tip = worktree HEAD（builder S9 两个 commit 之上，主 Agent 提交后核对 `git rev-parse HEAD`）；legacy 基线 = `506191b` 快照
- **gate 日志**：主树 `dev/agent-workflow/evidence/P9/s8/temp-s9-testgate.log`（testkit 红面）、`s8/temp-reuse-numstat-out.txt`（47 行 numstat+SHA 底账）

## 任务（按序）
1. **核对基线**：`git -C <worktree> rev-parse HEAD` 记录 audited tip；确认 `506191b` 快照 47/47 文件存在（manifest 对照）。
2. **五闸独立复跑**（worktree 内）：`pnpm -r run typecheck`、`pnpm -r run build`、`pnpm lint`、`pnpm -r run test`、`pnpm smoke:composition`。全绿/非绿如实记录（含 client 面是否实际运行——`pnpm -r run test` 拓扑 bail 历史：testkit 红则 client 不跑；若 testkit 绿则 client 必须出现，缺席即异常）。
3. **audit §A 47 行第 9 列（Reviewer verdict）**：逐行签核。每行 verdict ∈ {CONFIRMED, CONFIRMED-WITH-NOTE, DISPUTED} + 一句理由。重点复核：retained% 启发式计算（抽 ≥10 行用 `git diff --no-index --numstat` 对 `legacy-506191b/packages/client/ui-team/` 重算）、Reuse class 定级（R9-1 九项高复用资产须 ≥ MECHANICAL）、R9-3 停止条件（worktree 内 `NewTimeline|NewMembers|NewDock|NewTeamFeed` 文件必须不存在）。
4. **§B band 裁决**（计划 §9 L1049–1081 为唯一标准）：对每个 MISS/BORDERLINE 行裁定"计划强制理由成立/不成立"：timeline model（~68% vs 80–95）、members model（~53% vs 65–80）、feed model（~0% line-retained vs 40–60，§8.8 强制重写）、feed component（~29% vs 50–70）、marker tsx（partial）、members comp（~65%）、dock panel（~69%）、TeamView（~49%）、tasks（~28%）。deviation trigger（plan L1071–1080）是否任一触发。
5. **§D 新增模块预算合符性**（R9-4）：`model/{team-governance,team-handoff,team-intent-model,team-legacy,team-member-commands}.ts`、`state/team-session-resolution.ts`、`transport/host-seams.ts` 是否落在计划新增预算内。
6. **DoD-15 核验**：对照 `s9-dod15-mapping.md` 15 行 + 计划 L2199–2217 原文，确认每条证据引用真实存在且支撑；两个 ⏳（第 11 行）以你第 2 步五闸结果终判。
7. **lint 修复策略裁决**：343× 定点 `eslint-disable-next-line @typescript-eslint/no-explicit-any`（单规则单行非 blanket）+ `tests/**` ignore + scoped node-globals 是否可接受为"首跑清债"策略（REPAIR 语义只覆盖 located client defects——lint 债属测试/基建面，非产品/client 缺陷，见 audit F-8；你若认为属产品缺陷则 REPAIR）。
8. **testkit 双面发现裁决**：2 个红 spec（p4t6-session-event-scan ENOENT 竞争、t6-1 Vite root clamp）是否确属既有基建缺陷而非 P9 引入（可用 `git -C <worktree> log --oneline -- <file>` + 主树 gate 历史佐证）。
9. **签发 P9_VERDICT**：∈ {GO, REPAIR, CONTRACT_BLOCKER}（格式按 plan L1783–1791）。写两个文件：
   - 主树 `dev/agent-workflow/evidence/P9/s9-verdict.md`：verdict + 五闸结果 + §A 签核统计 + §B/§D/DoD 裁决全文 + lint/testkit 策略裁决 + 理由
   - 编辑主树 `dev/agent-workflow/evidence/P9/reuse-audit.md`：§A 各行第 9 列 + §G verdict 行（这是你被授权的唯一 tracked-adjacent 写入：两文件均在主树 evidence，untracked）
   
   判定基准：GO = 五闸全绿 + §B 所有 MISS 有成立之计划强制理由 + §D 预算合符 + DoD 15 全 ✓ + 无产品/client 缺陷；REPAIR = 存在已定位的 client 产品缺陷（列出文件+行）；CONTRACT_BLOCKER = 需要 frozen backend 契约变更（给出契约证据）。

## 输出（最终消息，中文）
- audited tip SHA
- 五闸结果表（5 行：命令 / 结果 / 关键数字）
- §A 签核统计（CONFIRMED / WITH-NOTE / DISPUTED 计数 + DISPUTED 行号）
- §B 逐 band 裁决一行摘要
- §D 预算合符 是/否
- DoD-15 15 行终态（✓/✗ + 失败项）
- P9_VERDICT + 一句话理由
- 落档文件路径（s9-verdict.md + reuse-audit.md 修改）

预计耗时 ≤ 90 分钟。遇任何"需要改产品代码才能验证"的歧义：不猜，记入 verdict 文件"Open questions"节并继续其余任务。
