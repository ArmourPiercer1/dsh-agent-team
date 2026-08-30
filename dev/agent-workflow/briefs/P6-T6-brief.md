# P6-T6 Worker Brief — Team tools + orchestration E2E + G6

（主 Agent 编排指令。本 brief 是输入件，不是冻结文档；冲突时按 §1 文档权威序裁决并显式记录理由。）

## 0. 身份与红线

- 你是执行任务 P6-T6 的唯一 leaf worker。禁止再拉子代理；禁止 push / force-push；禁止升级沙箱权限；禁止触碰稳定实例（:3080 与 `D:\deepseek-harness\` 部署）；禁止修改 upstream 源码。
- 你的 worktree（唯一可写位置）：`D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\P6-T6`
- 分支：`task/P6-T6-team-tools-e2e`（base = `760e7369650fe7e082772368f67569730cd80912` = int/P6-activation-runtime tip）
- 主仓（只读参考）：`D:\AgentDev\dsh-plugins\dsh-agent-team`
- 你的报告是 CLAIM 不是 fact：主 Agent 将独立复核（git truth、zero-core、owned-boundary、全链重跑、E2E 重跑）。自述不替代证据。

## 1. 会话开始必读（顺序，不得以“上下文已熟悉”跳过）

1. `<worktree>\docs\ROUTER_RULES.md`
2. `<worktree>\docs\TEST_METHODS.md`
3. 本 brief：`D:\AgentDev\dsh-plugins\dsh-agent-team\dev\agent-workflow\briefs\P6-T6-brief.md`
4. 冻结文档（§3；开工先核 hash，不一致即 STOP 并报告 `FROZEN_DOC_HASH_MISMATCH`）

## 2. 任务卡（TaskDoc P6-T6，逐字）

### P6-T6 — Team tools + orchestration E2E + G6

- **目标**：注册 list/create/delegate/followup/message/progress/control/lifecycle inspect 等 model-facing tools，全部委托 Runtime。
- **拥有的文件/包**：`packages/tools/**；P6 e2e`
- **前置依赖**：P6-T3,P6-T4,P6-T5
- **允许依赖**：public tool registration + TeamRuntime only
- **禁止项**：全局 forbidden block。
- **实现要点**：tool 层不得直接写 TeamDomain 或 agents.create。
- **必须测试**：same template N instances；persistent follow-up same Session；fresh delegation new instance；restart；quota race。
- **验收标准**：G6 PASS；tool bypass scan PASS。
- **输出物**：tools package；headless E2E；G6 report
- **难度**：`R5/C5/T5`；推荐 `Class A`。
- **并行关系**：`G3`。只有在其前置 contract/base 已冻结时才能进入 READY。
- **审查重点**：Reviewer 必须核对 owned-path、frozen semantics、negative tests 与全局 zero-core 约束；不得仅依据 worker 的自述批准。

### G6 Gate 执行方法（TaskDoc，逐字）

主 Agent 不得因为本 Phase task 全部 `APPROVE` 就自动通过 Gate。必须另外创建一个 `G6-REVIEW` task，由独立 reviewer：

```text
1. checkout Phase integration SHA
2. 读取上位文档中对应 Gate 条目
3. 重跑关键 positive + negative tests
4. 执行 zero-core/private-import/owned-boundary 检查
5. 对 cross-task invariants 做组合审查
6. 输出 criterion -> evidence -> PASS/FAIL
```

只有所有 criterion PASS 才能由主 Agent 将 integration branch 合入 `main`。

## 3. 冻结文档（只读权威；gitignored，仅存在于主 worktree 下）

- TaskDoc: `D:\AgentDev\dsh-plugins\dsh-agent-team\docs\plans\active\DSH_Agent_Team_vNext_Task_Decomposition_and_Review_Method_20260829.md`
  sha256 = `2b457cc033ca1b72aa781e072e0ef7fe55bc05d2f7ea25cc03c827d257e888a3`
- DevPlan: `D:\AgentDev\dsh-plugins\dsh-agent-team\docs\plans\active\DSH_Agent_Team_vNext_Detailed_Development_Plan_20260829.md`
  sha256 = `a05d237f8515fd6467373632849afe0c6a1ae63bc0ec298de63b9d124d881d0f`
- Arch: `D:\AgentDev\dsh-plugins\dsh-agent-team\docs\plans\active\DSH_Agent_Team_vNext_Detailed_Architecture_20260829.md`
  sha256 = `030dfb8ec55bae30f35c2826c7e4e659c0e0b742d836018ce502f34017870c53`
- UI: `D:\AgentDev\dsh-plugins\dsh-agent-team\docs\plans\active\DSH_Agent_Team_vNext_Detailed_UI_Design_20260829.md`
  sha256 = `3ef3ab69ed2bd7879e4c15079a16c8dae456b572690246a5c1f9cbb0c8c4981e`
- Cross-check: `dev\agent-workflow\evidence\provenance\file-manifest.json` 字段 `frozen_docs`（CRLF）。主 Agent kickoff 前已复核 4/4 一致；你开工前必须再自行复核一次（Get-FileHash）。

### DevPlan §19.6 Team tools（逐字）

建议第一轮 tool contract覆盖：

```text
list_team_members/templates
create/delegate instance
follow_up_instance
send_team_message
report_progress
request_control
resolve_control (leader where authorized)
archive/restore/dispose where authorized
inspect effective config
```

具体 tool 命名可以实现阶段收敛，但 authority 必须统一走 Runtime。

### DevPlan §19.7 Gate G6（逐字）

```text
✓ same template can create N simultaneous instances
✓ every runtime action is instance-addressed
✓ persistent follow-up keeps same Session
✓ fresh_per_delegation creates new instance
✓ message/control/progress survive restart
✓ quota race does not over-create
✓ tool layer cannot bypass ActivationProvider/TeamRuntime
```

## 4. Base 现状（int/P6 @ 760e736；主 Agent 已独立重跑验证）

- 全量测试 1181/1181；tsc ×5（contracts/domain/storage/runtime/testkit）全 exit 0；p4t6 扫描计数 318（断言 + 枚举注释 + it-title 三处一致）。
- base 上已有 P6 模块（只读依赖，只允许使用其 public 导出面）：
  - `packages/runtime/activation/**` — ActivationProvider（唯一创建入口；16 步顺序 19.2；admit-once 稳定操作身份 (rootSessionId, source, requestToken)；PREPARED roll-forward / COMMITTED replay / FAILED fail-loud OPERATION_FAILED；配额唯一在 provider step-7 执行：count+1>limit 拒绝、==limit 边界内、team-then-template）
  - `packages/runtime/admission/**` + `packages/runtime/action-router/**` — createTeamRuntime 门面（enforcement 0–6：请求校验 → instanceId-first 目标寻址（label/template 拒绝 ACTION_ADDRESSING_REJECTED）→ 调用方 identity+role 取自 TeamDomain → authority+envelope → compat/admission gate（仅 NEW work）→ quota via provider；durable effects 在 withTeamLock 下）
  - `packages/runtime/messaging/**` — createMessagingCoordinator（两记录分离：facade ledger fact `team-coordination-recorded` + 目标 Session 的普通 attributed input 经注入的 SessionInputPort；无 Team SessionEvent）
  - `packages/runtime/control/**` — createControlService（requestControl/resolveControl/listControlState/guardOperation；3 个 durable ledger facts；首个 decision 权威；inv 45 无缓存 authority；外部硬策略不可被 allow 覆盖）
  - `packages/runtime/activity/**` — createActivityLedger（two-phase write：facade authority + guarded commit；out-of-order REJECT 严格 head+1；每 (instanceId, subject, correlation) 至多一个 open interval；纯投影、无 workflow authority）
  - `packages/runtime/member-residency/**` — P5 residency（fresh/cold/evict）+ `harness/` 先例（必读）
- 现有 tools 骨架：`packages/tools/{package.json, src/index.ts, test/tools.test.ts, tsconfig.json, tsconfig.build.json, vitest.config.ts}`
- 单测风格先例：`packages/runtime/test/p6t1-*.test.ts` … `p6t5-*.test.ts`（helpers 模式、命名、断言风格照此）

## 5. Owned paths（只允许改这些）

- `packages/tools/**`（tools 源码、tools 测试、e2e harness）
- P6 e2e harness：建议 `packages/tools/harness/**`（先例布局 `packages/runtime/member-residency/harness/{run.mjs, plugin.mjs, slots-t6.mjs}`）
- DEC-1（R29 批准、常设例外）：`packages/testkit/test/p4t6-session-event-scan.test.ts` — 计数维护（断言 + 枚举注释 + it-title 三处一致；scanner `.mjs` 逻辑必须保持字节不变，只动计数/枚举/title）
- 其余任何文件不得修改（含 docs/、dev/agent-workflow/graph.yaml、scripts/、其他 packages）。

## 6. 实现要求（主 Agent 指定 carry-forwards）

(a) **last-mile guard**：tool 层触发任何受控操作前，必须经 T4 control service 的 `guardOperation`（tool 层是 last-mile guard 的调用方）；外部硬策略不可被 allow 覆盖。

(b) **tool 依赖边界**：tools 只允许依赖 public tool registration + TeamRuntime public 面（卡片“允许依赖”）。tool 层不得直接写 TeamDomain、不得调用 `agents.create`、不得使用 legacy Team SessionEvent 词汇。tool bypass scan 必须能静态证明这三点。

(c) **真实实例 headless E2E（T6 独有，你负责）**：
- 先例必读（全部 tracked 在 base 上）：`packages/runtime/member-residency/harness/run.mjs` + `plugin.mjs`（boot / directive / scenario / summary.json 机制）；`dev/agent-workflow/evidence/P5-T6/run-log.txt`（逐 leg 精确命令序列）、`public-surfaces.md`（所用 public seam 注册表）、`g5-report.md`。
- boot：`node apps/cli/lib/bin.js web --port N --no-open`；**FILE-FD stdio spawn**（沙箱禁命名管道：node 子进程不得用默认 `stdio: 'pipe'` 捕获输出，照 P5 run.mjs 先例的文件-FD 方案）；env：`DSH_HOME` + `DSH_CLIENT_COMMIT_HASH`（取值与 P5-T6 run.mjs 先例一致，对应 test-use head `cd5ef8148158c3a752a658978873241fdf8e2bbc`）。
- hostTree（测试用 pristine DSH 源码）：`D:\AgentDev\dsh-plugins\dsh-agent-team\references\deepseek-harness-test-use` — 必须保持 pristine（链前后各验：`git -C <hostTree> rev-parse HEAD` = `cd5ef814…` 且 `git status --porcelain` 为空）。
- DSH_HOME：`D:\AgentDev\dsh-plugins\dsh-agent-team\references\.dsh-test-p6t6`（新建、任务专属；**禁止复用** `.dsh-test-p5t6`；行挂载缝 `profiles/web/cordis.patch.yml`，同 P5 先例）。
- 端口：boot 用 3180/3181（odd/even 约定同 P5 先例）；mini-MCP 固定 3491–3495；**harness 运行必须串行**（共享 DSH_HOME + 固定端口，禁止并行）。
- 接线（关键）：plugin.mjs 中把 T3 的 `SessionInputPort` 落到真实 public Session input API（seam 名见 `public-surfaces.md`）；tools 通过 public Cordis tool registration 注册；E2E driver 必须经由**注册的 tool handler** 发起动作（driver 调 tool 层；不得由 driver 直接调 Runtime API 替代 tool 层——否则 G6 准则 7 无意义）。
- 稳定实例自检：链前后 probe :3080 必须 200（严禁影响稳定实例）。

(d) **基线与计数**：基线 1181 + 你新增测试 = 全量通过；p4t6 = 318 +（落在其枚举根内的你新增文件数——开工前先读 p4t6 测试弄清枚举根，完成后重算并保持三处一致；worker 曾犯 prose-miscount 错误，务必用实际扫描结果而非心算）。

(e) **规范链**（完成前必须连跑两次全绿；每 leg 命令 + 逐字输出，格式同 P5-T6 run-log）：
```
leg0-baseline : 未改动的 worktree 上跑完整链，期望 1181/1181 + tsc ×5 全 0 + p4t6 318
leg1-install  : pnpm install --ignore-scripts（worktree 根）
leg2-runtests : node scripts/run-tests.mjs（无参 = 全部 9 包；只发现 packages/<pkg>/test/*.test.ts）
leg3..leg7-tsc: node node_modules/typescript/bin/tsc -p packages/<pkg>/tsconfig.json ×5（contracts/domain/storage/runtime/testkit）
leg-harness   : E2E 全场景（串行）
```
禁止：`pnpm run` / `pnpm exec` / vitest CLI / tsx / esbuild / vite。
语言约束：matcher 仅 toBe/toEqual/toBeGreaterThan/toThrow(+.not)；.ts 文件禁 `node:` 内建 import（TS2591）；NodeNext + verbatimModuleSyntax（相对 import 带 `.js` 后缀）；erasable TS only（harness `.mjs` 为普通 JS，可用 node: 内建）。

(f) **tool 范围裁决（记入报告 scoping_decisions）**：实现 P6 Runtime 已支撑的 tools — list_team_members/templates、create/delegate instance、follow_up_instance、send_team_message、report_progress、request_control、resolve_control（leader where authorized）、inspect effective config。DevPlan 19.6 列表中的 archive/restore/dispose 属 P7-T3（Archive/Restore/Dispose + descendant drain）范围，本任务不实现其语义。tool 命名可收敛；authority 必须统一走 Runtime（DevPlan 19.6 末句）。

(g) **E2E 场景覆盖**（至少一一映射 G6 七准则；场景命名可收敛，覆盖必须完整、证据可复现：summary.json + 每场景 JSON + boot logs）：
- E1 准则 1：same template 并发建 N（≥3）实例，全部 admitted，instanceId 互异
- E2 准则 2：actions instance-addressed（follow_up/message/progress 指向具体 instanceId）；label/template 寻址被活体拒绝（ACTION_ADDRESSING_REJECTED）
- E3 准则 3：persistent follow-up 保持同一 Session（Session id 跨 follow-up 稳定）
- E4 准则 4：fresh_per_delegation 每次新 instance（新 instanceId + 新 child Session）
- E5 准则 5：message/control/progress survive restart（boot 1 写入 → kill → boot 2 读回：顺序、内容、control 状态、activity 区间全部在）
- E6 准则 6：quota race（并发 create：恰 ==limit 边界内 admitted，count+1>limit 拒绝；绝不超建）
- E7 准则 7：tool bypass scan 测试 PASS（静态）+ 结构审查（主 Agent + reviewer）

## 7. 证据与提交纪律

- 证据目录（你的 worktree 内）：`dev/agent-workflow/evidence/P6-T6/`
  - `run-log.txt`：每 leg 命令逐字 + 输出（selfcheck-before / leg0-baseline / leg1-install / leg2-runtests / leg3..7-tsc / harness legs / verdict），格式同 P5-T6 run-log
  - `attempt-ledger.txt`：每次 counted attempt 一行（开始时间、链结果、失败原因）
  - `g6-report.md`：criterion → evidence → PASS/FAIL（G6 七准则逐条；TaskDoc G6 执行方法六步全部执行；含 zero-core / owned-boundary / bypass-scan 证据）
  - `harness-output/`（summary.json + 每场景 JSON + boot logs + git status/head 证据）
- 提交：所有工作提交到 `task/P6-T6-team-tools-e2e`。最后的 run-log 收尾 commit（惯例遗留）可留给主 Agent 的 evidence-close commit（主 Agent 惯例：pick 前补一个 evidence-close 提交并重跑链）。
- counted attempts ≤ 3（失败修复后每次完整链重跑计一次 attempt，记录 attempt-ledger）。

## 8. 结构化报告（最终消息必须以 fenced block 结尾，逐字 key=value）

```
P6T6_REPORT
branch=task/P6-T6-team-tools-e2e
base=760e7369650fe7e082772368f67569730cd80912
head=<git rev-parse HEAD>
status=PASS|FAIL
attempts=<n>/3
tests=<全量 passed>/<全量 total>
new_tests=<n>
tsc=contracts:0 domain:0 storage:0 runtime:0 testkit:0
p4t6_count=<n>
e2e_scenarios=<pass>/<total>
zero_core_self_declaration=PASS|FAIL + 一行 detail
owned_boundary_self_declaration=PASS|FAIL + 一行 detail
changed_paths=<顶层列表>
scoping_decisions=<列表>
risks=<列表>
```

## 9. 失败处理

- 链内失败：记录 run-log + attempt-ledger，修复，重跑完整链（counted attempt +1）。
- 3 次 attempts 仍失败：停止，`status=FAIL` + 精确诊断（message/stack/文件/行）；禁止绕过。
- 任何需要 patch upstream core 才能推进的路径：立即停止，固定格式报告 `CORE_SEAM_BLOCKER:<seam>`。
