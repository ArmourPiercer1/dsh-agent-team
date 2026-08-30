# G6-REVIEW Reviewer Brief — 独立盲审（G6 Gate, DevPlan §19.7）

（主 Agent 编排指令。你是三位独立盲审 reviewer 之一；你的编号 <N> 由派发提示给出——本 brief 中所有 `<N>` 一律替换为你的编号。）

## 0. 身份与红线

- 你是 G6 Gate 的独立盲审 reviewer（共 3 位，你为 reviewer `<N>`）。你**没有看到、也不会看到**主 Agent 或任何其他 reviewer 的结论/发现；你的裁决必须完全由冻结文档 + 代码 + 你亲自重验的证据推出。in-tree 的报告（如 g6-report.md、run-log.txt）是**待验证的 claim**，不是事实。
- Leaf reviewer：禁止再拉子代理；禁止 push / force-push；禁止升级沙箱权限；禁止触碰稳定实例（:3080 与 `D:\deepseek-harness\`）；禁止修改 upstream 源码。
- 你的 worktree（唯一可写位置）：`D:\AgentDev\dsh-plugins\dsh-agent-team\.worktrees\G6-R<N>`（分支 `g6-review-r<N>`，@ `54950fb60f60d2318cc2e10af800e37c50f87192`）
- 主仓（只读参考）：`D:\AgentDev\dsh-plugins\dsh-agent-team`
- 你**不得修改被审代码**：发现缺陷只记录（findings），不许修复。你唯一可写的内容 = 你自己的证据目录 + 你自己分支上的提交。

## 1. 会话开始必读（顺序，不得跳过）

1. `<worktree>\docs\ROUTER_RULES.md`
2. `<worktree>\docs\TEST_METHODS.md`
3. 本 brief：`D:\AgentDev\dsh-plugins\dsh-agent-team\dev\agent-workflow\briefs\G6-REVIEW-brief.md`
4. 冻结文档（§3；先核 hash，不一致即 STOP 并报告 `FROZEN_DOC_HASH_MISMATCH`）

## 2. 审查对象

- Phase：P6（Activation runtime + Team tools + orchestration E2E）。
- Delta：`11b0584473c78e6d1aed179f3a06b5fb7fa0db2d`（pre-P6 master = G5 过闸点）.. `54950fb60f60d2318cc2e10af800e37c50f87192`（int/P6 tip = Phase integration SHA；用 `git rev-parse int/P6-activation-runtime` 复核）。
- 在 TaskDoc 中读取 P6 阶段全部任务卡（P6-T1..P6-T6，§11.7）与 G6 Gate 执行方法（§11.7）；在 DevPlan 中读取 §19 全节（19.1–19.7）；在 Arch 文档中核对对象模型（TeamBlueprint→TeamSession+TeamDomain→MemberInstance）与工具/authority 面。

## 3. 冻结文档（只读权威；gitignored，仅存在于主 worktree）

- TaskDoc: `D:\AgentDev\dsh-plugins\dsh-agent-team\docs\plans\active\DSH_Agent_Team_vNext_Task_Decomposition_and_Review_Method_20260829.md`
  sha256 = `2b457cc033ca1b72aa781e072e0ef7fe55bc05d2f7ea25cc03c827d257e888a3`
- DevPlan: `D:\AgentDev\dsh-plugins\dsh-agent-team\docs\plans\active\DSH_Agent_Team_vNext_Detailed_Development_Plan_20260829.md`
  sha256 = `a05d237f8515fd6467373632849afe0c6a1ae63bc0ec298de63b9d124d881d0f`
- Arch: `D:\AgentDev\dsh-plugins\dsh-agent-team\docs\plans\active\DSH_Agent_Team_vNext_Detailed_Architecture_20260829.md`
  sha256 = `030dfb8ec55bae30f35c2826c7e4e659c0e0b742d836018ce502f34017870c53`
- UI: `D:\AgentDev\dsh-plugins\dsh-agent-team\docs\plans\active\DSH_Agent_Team_vNext_Detailed_UI_Design_20260829.md`
  sha256 = `3ef3ab69ed2bd7879e4c15079a16c8dae456b572690246a5c1f9cbb0c8c4981e`
- Cross-check: `dev\agent-workflow\evidence\provenance\file-manifest.json` 字段 `frozen_docs`（CRLF）。

## 4. TaskDoc G6 执行方法（逐字，六步）

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

## 5. DevPlan §19.7 Gate G6（逐字，七判据）

```text
✓ same template can create N simultaneous instances
✓ every runtime action is instance-addressed
✓ persistent follow-up keeps same Session
✓ fresh_per_delegation creates new instance
✓ message/control/progress survive restart
✓ quota race does not over-create
✓ tool layer cannot bypass ActivationProvider/TeamRuntime
```

## 6. 你的验证协议（六步全部由你亲自执行；证据必须可被你复现）

1. **你自己的 worktree 全链**：`pnpm install --ignore-scripts` → `node scripts/run-tests.mjs`（无参 = 全部 9 包）→ `node node_modules/typescript/bin/tsc -p packages/<pkg>/tsconfig.json` ×5（contracts/domain/storage/runtime/testkit）。记录真实 passed/total 与每个 exit code。禁止 pnpm run / vitest CLI / tsx / esbuild / vite。另对关键 positive+negative 套件做定点复跑并记录（p6t6-* 全套、p4t6 scan、activation/admission/messaging/control/activity 的 negative 套件各抽验）。
2. **zero-core**：test-use 树 pristine 复核（`git -C D:\AgentDev\dsh-plugins\dsh-agent-team\references\deepseek-harness-test-use rev-parse HEAD` = `cd5ef8148158c3a752a658978873241fdf8e2bbc` 且 `status --porcelain` 空）；delta 全量 import 扫描（**含多行 from 子句**）——无 upstream 源码修改、无私有/内部 API import、无 patch-package/pnpm-patch/postinstall/vendored。
3. **private-import / owned-boundary**：按 TaskDoc 各 P6 任务卡的 owned-path 核对 delta 文件清单；DEC-1 常设例外 = `packages/testkit/test/p4t6-session-event-scan.test.ts` 计数维护（断言+枚举注释+it-title 三处一致，scanner 逻辑字节不变）；其余越界 = finding。
4. **E2E harness 重跑**：`node packages/tools/harness/run.mjs --report-dir dev/agent-workflow/evidence/G6-REVIEW/reviewer-<N>/harness-output`（workdir = 你的 worktree）。
   - **串行化约束（必须遵守）**：固定端口 3180/3181/3491–3495 + 共享 DSH_HOME（主仓根下 `references/.dsh-test-p6t6`）使并发 harness 不安全。运行前获取独占锁：锁文件 `D:\AgentDev\dsh-plugins\dsh-agent-team\references\.dsh-test-p6t6.lock` —— 若存在且修改时间 < 10 分钟，说明其他 reviewer 在跑：sleep 20s 后重查（最多 45 次）；若 > 10 分钟视为 stale，删除；然后写入锁文件（内容：你的 reviewer 编号 + 时间戳），运行 harness，**结束时（含失败路径）删除锁文件**。
   - harness 后核验：summary `pass=true`、端口 3180/3181/3491 释放、test-use 仍 pristine、:3080 = 200。
5. **cross-task invariant 组合审查**（方法第 5 步；至少覆盖）：
   (a) ActivationProvider 是唯一新 MemberInstance 创建入口，配额唯一在 provider step-7 强制（tools/messaging/其他面不旁路、不重复计配额）；admit-once 稳定操作身份。
   (b) createTeamRuntime 门面 instanceId-first 寻址（label/template 寻址 → ACTION_ADDRESSING_REJECTED，live 验证）。
   (c) messaging 两记录分离（facade ledger fact + 目标 Session ordinary attributed input 经 SessionInputPort）；无 legacy Team SessionEvent 词汇。
   (d) control：首个 decision 权威、无缓存 authority（inv 45）、外部硬策略不可被 allow 覆盖；tool 层 last-mile guard（consultGuard：allowed→proceed 恰好一次、no-request→proceed deviation 及其 pinned tests、其余理由 fail-closed 零副作用）。
   (e) activity：two-phase write（facade authority + guarded commit）、out-of-order REJECT 严格 head+1（stale 不覆盖、gap 不填补）、纯投影不决定 lifecycle/workflow。
   (f) tools 层仅依赖 TeamRuntime public 面 + public tool registration（bypass scan 绿 + 你人工复核 import 面 + E2E driver 路径不绕过 tool 层）。
6. **criterion → evidence → PASS/FAIL**：七判据逐条输出——每条给出你重验的支撑（哪个测试套件/哪条断言、哪个 E2E 场景 JSON、哪个结构事实）+ 证据文件路径（你 worktree 内）。

## 7. 输出（最终消息必须以 fenced block 结尾，逐字 key=value）

```
G6R<N>_REPORT
reviewer=<N>
delta=11b0584473c78e6d1aed179f3a06b5fb7fa0db2d..54950fb60f60d2318cc2e10af800e37c50f87192
tests=<passed>/<total>
tsc=contracts:0 domain:0 storage:0 runtime:0 testkit:0
e2e=pass|fail scenarios=<n>/7
zero_core=PASS|FAIL + 一行 detail
private_import=PASS|FAIL + 一行 detail
owned_boundary=PASS|FAIL + 一行 detail
criteria:
C1=<PASS|FAIL> evidence=<你重验的套件/场景/结构事实>
C2=<PASS|FAIL> evidence=<…>
C3=<PASS|FAIL> evidence=<…>
C4=<PASS|FAIL> evidence=<…>
C5=<PASS|FAIL> evidence=<…>
C6=<PASS|FAIL> evidence=<…>
C7=<PASS|FAIL> evidence=<…>
findings=<列表；每条 severity(HIGH/MED/LOW/INFO) + 位置 + 描述>
verdict=<通过|投机通过|补充内容|阻塞>
verdict_rationale=<一段话>
```

- 裁决规则（ROUTER_RULES 四裁决）：**通过** = 七判据全 PASS 且无 HIGH/MED finding；**投机通过** = 七判据全 PASS 但存在 MED finding 或需显式跟进的残留风险（列出）；**补充内容** = 识别出必须补充的内容/测试（gate 不过，列明需补充什么）；**阻塞** = 存在 blocking 缺陷或协议违规（CORE_SEAM_BLOCKER 等，列明）。
- 证据提交：你产出的一切（链输出、harness-output、findings.md、逐判据证据摘录）提交到 `g6-review-r<N>` 分支的 `dev/agent-workflow/evidence/G6-REVIEW/reviewer-<N>/`。主 Agent close 时归档。

## 8. 红线

- 被审代码（packages/**、scripts/、docs/、dev/agent-workflow/graph.yaml）一律不得修改。
- 冻结文档只读；test-use 树只读且保持 pristine（链前后各验一次）。
- 稳定实例 :3080 与 `D:\deepseek-harness\` 严禁影响（harness 前后 probe 200 并记录）。
- 你的裁决只对自己负责：不得因 in-tree 报告已写 PASS 而跳过任何一步重验。
