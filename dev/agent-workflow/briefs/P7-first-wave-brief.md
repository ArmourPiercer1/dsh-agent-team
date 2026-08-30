# P7 First Wave — Shared Worker Brief（P7-T1 / T3 / T4 / T5 / T6）

你是本轮 5 个并行 worker 之一，负责本 brief 中标明 `YOUR TASK` 的那一个任务。5 个任务并行执行、各自独立 worktree/分支；你**只能**写自己 owned paths 内的文件（+ p4t6 计数维护 + 自己的 evidence 目录）。

## 0. 会话开始必读（提示词注入要求，不得跳过）

按顺序读取（read 工具）：
1. 你的 worktree 内 `docs/ROUTER_RULES.md`
2. 你的 worktree 内 `docs/TEST_METHODS.md`
3. 本 brief（`dev/agent-workflow/briefs/P7-first-wave-brief.md`，主 worktree 路径）

之后才可执行任务。你是 leaf worker：禁止再拉起子代理；禁止 push；禁止修改受审外的任何仓库状态。

## 1. 红线（全局禁止 block）

- CORE PATCH BUDGET = 0：不得修改 upstream（`references/deepseek-harness-test-use`）源码；不得 import/使用 upstream 私有/内部 API；不得 patch-package / postinstall 改写；不得把任何 Team patch 应用到 host 树。需要 upstream 能力而公开 seam 不足 → `STOP → CORE_SEAM_BLOCKER:<seam>`（固定格式，见 ROUTER_RULES）。
- 不得把 legacy Team SessionEvent 词汇当 vNext 权威（vNext 无 Team SessionEvents；对象模型：TeamBlueprint→TeamSession+TeamDomain→MemberInstance）。
- 文档权威序：upstream 公开契约 → 冻结 4 文档（`docs/plans/active/`，只读）→ ROUTER_RULES → TEST_METHODS → migration docs → legacy 代码（仅证据）→ 实现便利。冲突按此序裁决，科学/设计理由需显式记录在报告。
- 影响面必须可逆、在 evidence 留痕。

## 2. 冻结文档（hash 必须复核）

| 文档 | 路径 | SHA-256 |
| --- | --- | --- |
| Architecture | `docs/plans/active/DSH_Agent_Team_vNext_Detailed_Architecture_20260829.md` | `030dfb8ec55bae30f35c2826c7e4e659c0e0b742d836018ce502f34017870c53` |
| UI | `docs/plans/active/DSH_Agent_Team_vNext_Detailed_UI_Design_20260829.md` | `3ef3ab69ed2bd7879e4c15079a16c8dae456b572690246a5c1f9cbb0c8c4981e` |
| Development Plan | `docs/plans/active/DSH_Agent_Team_vNext_Detailed_Development_Plan_20260829.md` | `a05d237f8515fd6467373632849afe0c6a1ae63bc0ec298de63b9d124d881d0f` |
| Task Decomposition | `docs/plans/active/DSH_Agent_Team_vNext_Task_Decomposition_and_Review_Method_20260829.md` | `2b457cc033ca1b72aa781e072e0ef7fe55bc05d2f7ea25cc03c827d257e888a3` |

开工前 `Get-FileHash -Algorithm SHA256`（或等价）复核 4/4 一致，并与 `dev/agent-workflow/evidence/provenance/file-manifest.json` 的 `frozen_docs` 交叉核对；不一致 → `STOP → FROZEN_DOC_HASH_MISMATCH:<file>`。

## 3. 测试基线与 canonical chain（sanctioned sandbox 链，逐字执行）

- 当前基线：full chain **1214/1214**（9 包）+ tsc ×5（contracts/domain/storage/runtime/testkit）全 exit 0；p4t6 扫描断言 = **330 files scanned**。
- 执行链（唯一允许方式）：
  1. `pnpm install --ignore-scripts`
  2. `node scripts/run-tests.mjs`（无参 = 全部 9 包；只发现 `packages/<pkg>/test/*.test.ts`，**顶层 test 目录**）
  3. `node node_modules/typescript/bin/tsc -p packages/<pkg>/tsconfig.json` ×5
- 禁止：`pnpm run` / `pnpm exec`、vitest CLI、tsx、esbuild、vite、任何其它执行器。
- 测试代码约束：matchers 只用 `toBe / toEqual / toBeGreaterThan / toThrow`（+ `.not`）；.ts 内**禁止** `node:` builtin import（TS2591）；NodeNext + `verbatimModuleSyntax`（相对 import 必须带 `.js` 后缀）；只用 erasable TS（无 enum/namespace/参数属性）；harness 类 .mjs 才可用 node: builtins。
- 你的新测试文件放 `packages/runtime/test/p7t<N>-*.test.ts`（T6 放 `packages/legacy/test/p7t6-*.test.ts`），文件名必须带任务前缀（并行防碰撞）。
- Attempt 记账（≤3 次 counted）：attempt 1 = 变更**前** baseline chain（预期 1214/1214 全绿，确认起点干净）；attempt 2 = 变更后第一次全绿；attempt 3 = 第二次连续全绿（复现稳定性）。失败修复后的重跑计入 attempts；3 次用尽仍不绿 → 报告 BLOCKED 并留全部日志。

## 4. Owned paths 纪律 + DEC-1（p4t6 计数维护）

- 只能修改：你的任务卡 **拥有的文件/包** 列出的路径（新建文件）+ `packages/testkit/test/p4t6-session-event-scan.test.ts`（仅计数维护，DEC-1 正式例外，R29 批准）+ 你的 evidence 目录 `dev/agent-workflow/evidence/<你的任务>/`。
- DEC-1 操作：你新增的 `packages/**` 下文件（src + test + .mjs + .d.mts，与 scanner 口径一致）会改变 p4t6 累计计数。把 330 加上你的新增文件数，同步更新该测试的**三处**：两处断言数字 + `it` 标题（"N files scanned"）+ 枚举注释（追加你的文件名，保持 union 风格）。scanner `.mjs` 本体**不得**改动（byte-identical 要求）。
- 零核心检查：`node scripts/verify-zero-core.mjs`（按 TEST_METHODS 的参数形式）+ 自己对新 import 的 specifier 扫描（只允许：intra-repo 相对/包内、`vitest`、upstream **公开**根导出；任何 `@deepseek-ai/*` 私有路径/深层路径 → 违规即 BLOCKER 级 finding，自行纠正后重跑）。

## 5. 本波（H1 第一波）范围界定

- 5 个任务全部是**单元/集成测试级**交付：按各自任务卡 **必须测试** 列表实现 negative + positive 测试。**本波不启动任何真实 DSH 实例**（无 DSH_HOME、无端口 3180/3181/3491–3495、无 harness run）——phase 级 real-instance E2E 是 P7-T7 的责任（G7 e2e）。因此 5 worker 可安全并行，无共享资源。
- 稳定实例 :3080 与 `D:\deepseek-harness\` 部署**绝对不可触碰**。
- 现有代码地图（只读参考）：P3 compat engine / policy resolver / blueprint catalog；P4 TeamDomain + OperationJournal + SessionBinding + provisioning；P5 agent binder / persona+model overlay / capability guard / root binding / member residency；P6 activation provider（唯一 MemberInstance 创建入口）、TeamRuntime admission facade（`packages/runtime/admission*`、action-router）、control service（request/resolve/guardOperation）、activity ledger、messaging coordinator、10 个 model-facing tools（`packages/tools`，全部经 `performAction` 委托）。你的实现必须构建在这些**公开 API** 之上；需要新公开面时在包内 public barrel 导出并在报告中声明。

## 6. 报告格式（最终消息必须以 fenced block 结尾）

```
P7T<N>_REPORT
branch: task/P7-TN-...
head_sha: <完整 40 位，git rev-parse>
attempts: <used>/3
baseline_chain: <attempt1 结果，如 1214/1214 PASS>
final_chain: <最终 N/N PASS（含新增测试数）>
tsc: <5/5 exit 0>
zero_core: <PASS，serious=0 + 备注>
owned_boundary: <PASS，列出触碰文件全集>
p4t6_count: 330 -> <new>（新增 <k> 文件）
new_files: <清单>
tests_added: <suite 名 + 断言数>
deviations_scoping: <显式记录的设计裁决/偏离，无则 none>
evidence: dev/agent-workflow/evidence/P7-TN/
```

## 7. 失败处理

- 协议定义的 blocker（CORE_SEAM_BLOCKER / FROZEN_DOC_HASH_MISMATCH / 等）→ 立即 `STOP → <BLOCKER:<id>>` 格式报告，不继续。
- 技术失败（测试红、tsc 错、chain 崩）→ 在 attempt budget 内自行诊断修复；全部日志（UTF-8）落到你的 evidence 目录。
- 报告是 CLAIMS，主 Agent 会独立复核（rev-parse / status / log、chain 重跑、tsc、zero-core / owned-boundary、p4t6 收敛）。

---

## § P7-T1 — Compatibility drift + ACK lifecycle（YOUR TASK 之一）

- **worktree**：`.worktrees/P7-T1`　**branch**：`task/P7-T1-compat-drift-ack`　**base**：`6732601`
- **目标**：实现 probe generation、warning ACK fingerprint、capability drift 对 new work admission 的影响。
- **拥有的文件/包**：`packages/runtime/compatibility/**`
- **前置依赖**：P6-T6
- **允许依赖**：compat engine + TeamDomain
- **禁止项**：全局 forbidden block。
- **实现要点**：in-flight admitted work 可 settle；new work block。
- **必须测试**：environment fingerprint change；stale ACK；cold resume；in-flight drift。
- **验收标准**：drift semantics 与 frozen spec 一致。
- **输出物**：runtime compatibility tests
- **难度**：`R5/C4/T5`；推荐 `Class A`。
- **并行关系**：`H1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。
- 任务备注：frozen spec = DevPlan §20.1 + Arch 文档 compatibility 章节（先读后实现，drift 的 warning/fatal 分级、ACK fingerprint 失效语义以冻结文档逐字为准）；与 P6 admission pipeline 的接面 = "new work block" 发生在 admission/compatibility 检查位，不改动 in-flight work 的 settle 路径。

## § P7-T3 — Archive/Restore/Dispose + descendant drain（YOUR TASK 之一）

- **worktree**：`.worktrees/P7-T3`　**branch**：`task/P7-T3-lifecycle-archive`　**base**：`6732601`
- **目标**：实现 close admission→interrupt→drain→release→commit；Restore 只 ARCHIVED→SETTLED。
- **拥有的文件/包**：`packages/runtime/lifecycle*`
- **前置依赖**：P6-T6
- **允许依赖**：public descendant seam + residency + TeamDomain
- **禁止项**：全局 forbidden block。
- **实现要点**：Restore 绝不 agents.resume；Dispose 保历史。
- **必须测试**：archive running；nested subagent drain；restore no agent；dispose race。
- **验收标准**：quiescence 与 durable lifecycle一致。
- **输出物**：lifecycle module；tests
- **难度**：`R5/C5/T5`；推荐 `Class A`。
- **并行关系**：`H1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。
- 任务备注：frozen spec = DevPlan §20.3 + Arch lifecycle 章节；residency = P5-T6 member-residency 公开面；public descendant seam = P2-T2 agent lifecycle 公开 API；"Restore 绝不 agents.resume" 是 G7 判据（"Restore does not create/resume Agent"），必须有对应的 negative 测试（调用面断言 resume 未被触达）。

## § P7-T4 — Fork reconciliation（YOUR TASK 之一）

- **worktree**：`.worktrees/P7-T4`　**branch**：`task/P7-T4-fork-reconciliation`　**base**：`6732601`
- **目标**：实现 lazy root fork sidecar：same Blueprint snapshot + zero members；Member fork 保持 ordinary Session。
- **拥有的文件/包**：`packages/runtime/fork*；persistence reconciliation`
- **前置依赖**：P6-T6
- **允许依赖**：public lineage + TeamDomain binding
- **禁止项**：全局 forbidden block。
- **实现要点**：不得 patch session.fork；repeated reconciliation 幂等。
- **必须测试**：root fork；member fork；ordinary fork；crash during sidecar；repeat reconcile。
- **验收标准**：Root/Member fork exact frozen semantics。
- **输出物**：fork reconciler；tests
- **难度**：`R5/C5/T5`；推荐 `Class A`。
- **并行关系**：`H1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。
- 任务备注：frozen spec = DevPlan §20.4 + Arch fork 章节（Root fork exact semantics / Member fork ordinary semantics 是 G7 判据，逐字对齐）；"不得 patch session.fork" = 不改 Session 自身的 fork 行为，reconciler 只在 TeamDomain 持久化侧做 sidecar 记录；crash during sidecar 用 testkit 故障注入手法（P4-T5 先例）。

## § P7-T5 — Start Team from Here（YOUR TASK 之一）

- **worktree**：`.worktrees/P7-T5`　**branch**：`task/P7-T5-handoff-start-from-here`　**base**：`6732601`
- **目标**：实现 source canonical surface freeze→one-shot summary/handoff→new TeamIntent/Root；无 live link。
- **拥有的文件/包**：`packages/runtime/handoff*`
- **前置依赖**：P6-T6
- **允许依赖**：public session query/read surface + Team creation
- **禁止项**：全局 forbidden block。
- **实现要点**：source 后续变化不影响 handoff；target 无 history_search source 权限。
- **必须测试**：snapshot once；source mutate；target inspect；failure before root create。
- **验收标准**：handoff 是一次性上下文，不建立 cross-session memory。
- **输出物**：handoff module；tests
- **难度**：`R5/C4/T5`；推荐 `Class A`。
- **并行关系**：`H1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。
- 任务备注：frozen spec = DevPlan §20.5 + Arch handoff 章节；handoff 产出一次性上下文，新 Team 的创建必须走 P6-T1 ActivationProvider 公开入口（handoff 模块不得自造 MemberInstance/TeamSession 创建路径）；"target 无 history_search source 权限" 需要 negative 测试（target 视角查询 source 历史被拒）。

## § P7-T6 — Legacy teammate adapter（YOUR TASK 之一）

- **worktree**：`.worktrees/P7-T6`　**branch**：`task/P7-T6-legacy-teammate-adapter`　**base**：`6732601`
- **目标**：将 `.dsh/teammates` 仅作为 one-time Blueprint import adapter。
- **拥有的文件/包**：`packages/legacy/teammates-adapter*`
- **前置依赖**：P3-T2
- **允许依赖**：filesystem + blueprint parser
- **禁止项**：全局 forbidden block。
- **实现要点**：无 watcher、无 live runtime authority。
- **必须测试**：import valid/invalid；duplicate；source changes after snapshot。
- **验收标准**：legacy definition 可生成新 Blueprint，但不会控制既有 TeamSession。
- **输出物**：adapter + fixtures
- **难度**：`R3/C4/T4`；推荐 `Class B`。
- **并行关系**：`H1`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。
- 任务备注：frozen spec = DevPlan §20.6 + migration docs（legacy `.dsh/teammates` 格式见 `references/deepseek-harness`（只读）中对应实现，仅作参考证据）；blueprint parser = P3-T2 blueprint-catalog 公开面；fixtures 放 `packages/legacy/test/fixtures/`（计入 p4t6 扫描口径的文件按其扩展名规则）；adapter 只读 filesystem、只产 Blueprint 对象，不得持有/调用任何 runtime authority（negative 测试：import 后对既有 TeamSession 无任何变更）。
