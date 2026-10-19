# DEF-#257-FREEZE — PR #257「DO NOT MERGE + 审查 BLOCKED」事实链闭合

C 路（guard/schema 对账，只读）；作者=c7886d5f 之外的 C 路代理；取证时刻 2026-10-19T07:30–07:45Z；
树 = `.worktrees/a5-guard-schema` @ `d5de74974b0320b191b310ead82407d478477ed7`（产品冻结 SHA，干净）。

## 判定（三选一之果）

**有留痕裁决解冻（属主合入 + 用户 B3 裁决 + 修后独审 PASS 三重留痕），非静默越过；技术面无活缺陷。**
附两点如实披露（见 §5）：①合并发生在 B3 取消语义**完整裁决文本落档之前 50 分钟**，且该落档条目自我声明
「本裁决为事后裁决，不回填 17:02 合并时点」「不回填为 17:02 合并时已批准」（这是仓库**主动披露**的时序保留，
不是被发现掩盖）；②GitHub 面上 PR 标题保留 "DO NOT MERGE" 直至合并、无 GitHub review-approve 事件
（独审走 commit 线，本仓库惯例），只读 GitHub API 无上下文的读者会误判——**文档卫生项，入修复队列单**。

## 1. GitHub 侧事实（`gh api`，取于 2026-10-19T07:3xZ，repo=armourpiercer1/dsh-agent-team）

| 项 | #257 | #256 |
|---|---|---|
| state / merged | closed / **true** | closed / **true** |
| merged_at | **2026-10-16T17:02:20Z** | 2026-10-16T18:31:47Z |
| merge_commit_sha | `452a04c0bcfd720b51ee2a4cd1da36d2b74e34ab`（= master 祖先，实证 `git merge-base --is-ancestor 452a04c0 d5de7497` = true） | `ae3dcf54fbb7997c5eb5ccb3df9cee69cbba62df` |
| merged_by | **ArmourPiercer1（仓库owner=根账号）** | ArmourPiercer1 |
| reviews | 仅 copilot COMMENTED（quota 失败，08:54:38Z @2b16de64）；无人工 approve/dismiss | — |
| issue comments | **0 条**（`issues/257/comments` 空数组） | — |
| title（合并时=现值） | 「Alpha.5 PR1 残余边界收口…— **DO NOT MERGE**」 | 「…(ready: #257 merged)」 |

`reviews` 无人工事件 = 本仓独审惯例走 **commit 线**（评审即提交），故 GitHub 面不构成授权链，须看 commit + ROUTER_LOG（下）。

## 2. 时序（全 UTC 2026-10-16，逐值核对）

| 时刻 | 事件 | 证据 |
|---|---|---|
| 08:06:56Z | #255（PR1）合 master = `db5cb5f7` | ROUTER_LOG「#255 于 2026-10-16T08:06:56Z 被合入 master」 |
| 08:53:22Z | PR1r 分支 head `2b16de64`（evidence set + seam record） | `git log -1 2b16de64` |
| 09:17:33Z | 独审 commit `dd70ef3c`：**Verdict: BLOCKED (merge freeze on PR #257 and dependent PR #256 stands)**，B1=「the post-door arm still runs one un-validated Body (v2=1)…'recorded + refused next call' is not closure」；B3=给出两条 CORE=0 路线待裁 | `git log -1 --format=%B dd70ef3c` 原文 |
| （BLOCKED 后，修复轮内） | **用户裁定 B3 = 方案 (ii)**（定义变化时取消未执行调用，signal-wrapper + change-abort）；明确否决"门内自执行/不调 next()" | ROUTER_LOG 修复轮条目「**裁决**：用户裁定 B3 = 方案 (ii)」（L6226） |
| 15:16:33Z | 修复首 commit `83a0b994`：B3(ii) 实现，body count zero | `git log -1 83a0b994`；runs/B3-after-door-{RED,GREEN}.json |
| 16:39:39/16:41:26Z | `ffbc6e9a`/`d5890103`（类型化 registry double + 日志勘误） | git log |
| ≤17:02Z（合并前，落档于 squash 消息尾部） | 修后**独审 PASS @ d5890103**（1 MINOR；①-⑨全部独立复测：窗口 13/13 GREEN、kit 36/36 真宿主、only_in_after=[]、旧"one call, then withdrawn"姿态**完全撤回**） | `git log -1 --format=%B 452a04c0` 尾段 + `dev/agent-workflow/evidence/alpha5-pr1r/review-PR1r-fix.md` |
| **17:02:20Z** | **#257 squash 合并 = `452a04c0`，merged_by=owner 账号** | gh api + git |
| 17:52Z | 用户取消语义**完整裁决**落档（#258=`18f53c99`）+ PENDING-GATES 新建（D-1 延期、G-g 不随裁关闭），并**自我声明**：「本裁决为事后裁决，不回填 17:02 合并时点」 | ROUTER_LOG「取消语义用户裁决（2026-10-16 17:52Z）」段；`dev/agent-workflow/PENDING-GATES.md` G-a 行「不回填为 17:02 合并时已批准」 |
| 18:31:47Z | #256（PR2）合 = `ae3dcf54`（message 载 "ready: #257 merged"），依赖链自洽 | gh api + git |

## 3. 合入路径（问题②）

- squash（GitHub "Squash and merge"；`merge_commit_sha` 即 master 唯一 commit `452a04c0`，消息含全部子 commit 叙述 + `Co-authored-by: Alpha.5 PR1r reviewer`，`---------` 分隔 = GitHub squash 格式）。非 cherry-pick、非 force（分支 `alpha5-pr1r-residual-boundaries` 全程 fast-forward push，见 ROUTER_LOG git 段）。
- master 内对应 commit 消息所载授权语 = 尾部「review(alpha5-pr1r): fix-round independent review @ d5890103 — **PASS** (1 MINOR ledger note, disclosure ruling)」。
- ROUTER_LOG 2026-10-16~17 段已通读（L6176–6290）：含 BLOCKED 处置、用户 B3 裁决、修复轮、17:52Z 裁决、D-1/D-2/G-g 登记。**首报中"grep 未命中解冻记录"为取证方法错误**（词组 `#257`+merge/freeze 未命中，因条目以「B3 = 方案 (ii)」「17:52Z」表述），已更正。

## 4. B1 技术面现状（问题③）：**不活**

- 当前树机制：`packages/runtime/tool-dispatch/pending-calls.ts`（watch 台账，watched→abort-issued→settled）+ `install.ts` `armWrapperSignal`（install.ts:882 定义、:994 挂接；reentry 双身份 :986-993 拒、wrapper 不可装 :994-1002 拒；`tools/change` → :1046 `pendingCalls.onRegistryChange` 取消；`dispatcher-call-terminated-after-body-start` :722；`dispatcher-call-executed-unvalidated` alarm :823）。
- 修前/修后实测：`runs/B3-after-door-RED.json` v1=0 **v2=1 secondCallV2=1** → `runs/B3-after-door-GREEN.json` **v1=0 v2=0 secondCallV2=0**；kit `RW-AFTER-DOOR-BODY-ZERO` 原文 `v1=0 v2=0 code=ABORTED_BEFORE_DISPATCH`（`runs/kit-r1r-fix1/rereg-window.json`，经 review-PR258.md 逐值复核）。即"post-door un-validated Body 跑一次"的 arm 已在**合并前**被取消-先于-Body 机制替换，非合后再修。
- 残留（均**已登记在册**，非未披露缺陷）：
  - **D-1**『只取消未执行』严格属性=延期（需公开可信 body-start 检查；`bodyInvoked` 私有 `packages/core/tools/src/index.ts:1580`；候选三件未选型）——PENDING-GATES.md D-1 行。
  - **G-g** 静默已订阅通道（订阅成功永不投递）**非 fail-closed**（G-7 实测被移 Body 实跑、响亮告警），等级上限 LIVE-CONFIRMED/ENFORCE-PARTIAL——PENDING-GATES.md G-g 行。
  - **MINOR（修后独审遗留，未采纳）**：arm 后两条拒发路径（install.ts:989/:999）只 `dispatcher.endCallById(…, 'refused')`，pendingCalls 台账 settle 仍依赖 result 边（settle 唯一调用点 :806）；实测 leak-free（leak-probe），不变量依赖"result 边必发"——1 行硬化未入码。

## 5. 对冻结产品 `d5de7497` 试用面定性

- #257 语义（B3(ii) 取消路线）已在试用候选内且无活缺陷；试用面定性不因本追查改变。
- 试用面**已知负披露**应引用既有在册行（G-g 静默非 fail-closed；D-1 严格属性延期），不新设。
- 治理卫生两项入修复队列单：①squash 消息把中间 BLOCKED 裁决与终局 PASS 同筐，建议后续 PR 消息纪律=中间裁决段加SUPERSEDED 标（docs-only）；②GitHub 标题 "DO NOT MERGE" 合并后才失效——流程上根合入即授权，无需改动，仅记录以免再误读。

## 6. 证据路径索引

- `dev/agent-workflow/evidence/alpha5-pr1r/{review-PR1r-fix.md, s12-residual-evidence.md, seam-record-post-door-resolution.md, review-PR258.md, runs/}`
- `dev/agent-workflow/PENDING-GATES.md`（G-a/G-b/G-g/D-1/D-2 行）
- `dev/agent-workflow/SESSION_ROUTER_LOG.md` L6176–6290（PR1r/PR2/17:52Z 裁决段）
- commit 原文：`dd70ef3c`（BLOCKED 评审）、`83a0b994`（B3(ii) 修复）、`d5890103`（PASS 复审基点）、`452a04c0`（squash 正文=全程史）、`18f53c99`（#258 裁决落档）
- gh api：`pulls/257`、`pulls/256`、`issues/257/comments`
