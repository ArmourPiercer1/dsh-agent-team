<!-- S6 PR body (FINAL — PATCH /pulls/31). All <<S5:*>>/<<S6:*>> filled from the
     S5 re-run verdict (166P/1F/fatal=null, S5 = 0ed7065) and the S6 final
     battery at tip 0ed70657 (S6 commit = evidence/bookkeeping only). -->

# Team restart recovery — 0.1.7-rc.1 (C1 activation fence) + supplemental fix round

## 概要

修复 dynamic Team Session 在 backend restart 后的 cold resume（stock SessionController 的 ordinary auto-promotion 会偷走 Team writer）。方案 C1：利用 0.1.7 awaited-serial `agent/created` 作为 Team Session activation ownership fence — Team 自己的 `agents.create/resume` 全部带显式 owned guard；Team-managed Session 被 ordinary auto-promotion 时 fail closed，以 exact `agent/disposed` 作为 writer-release barrier，随后经完整 `agentSetup` 由既有 Team glue 再 resume 并持有真实 `AgentHandle`。删除 `$DSH_HOME/sessions` 物理扫描（改用 public `SessionPersistence.stat()`）；writer-held 仅在确认 foreign rollback 后允许 exactly-one retry（无 sleep/retry loop）。**CORE PATCH BUDGET = 0**：upstream 零修改，test-use pristine @ `46a7f68b09`（0.1.7-rc.1），全部能力经外部插件 + 公开 seam。Remote 契约保持 v5（未 bump v6）。

## 补充修复轮（本 PR 第二轮，审查意见 pr31_supplemental_fix_guide.md）

审查基线 = 首推 head `449e1fc`（= merge PR #30 后分支头）。按 guide §7 顺序 S1→S6：

| 提交 | 内容 |
| --- | --- |
| S1 `58d30de` | activation core：exact Agent-object generation claim（`claimOwnedGeneration` 仅 runOwned guard 持有时接受；`ownedDepth` 不再是 causal authority）/ ownershipReady barrier（resolver 未绑定时 Team 激活挂起 PENDING，不当 unmanaged 放行）/ epoch/tombstone（completed rollback 记录删除后完成仍可观测：`completedEpoch > baseline`）/ 单一 absolute deadline（两阶段共消 `deadline - now()`）/ per-SID single-flight（`ensureLiveAgentOnce` + `createRootAgentOnce` 双 map）+ A10–A15 / G7–G10 |
| S2 `673bb7c` | host/root 契约：production fence 11 方法 surface 完整性检查（缺一即 apply 时 `TEAM_PLUGIN_GLUE_UNAVAILABLE` 硬失败）/ `prepareOrdinaryOpen` 条件 spread（armer 缺席 = typed `TEAM_REMOTE_TEAM_ORDINARY_OPEN_PORT_UNAVAILABLE`，退役 pre-round FAKE SUCCESS）/ H1/H2 startup fence + d2 R6a/R6b + G11/G12（真 ordinary owner 经 explicit permit 后仍 OUTSIDE_TEAM；Team-vs-Team 竞态 single-flight joiner 按身份拿非 writer-held 失败 → START_FAILED，永不 OUTSIDE_TEAM） |
| S3 `833c699` | client same-page characterization（**仅证据**，先不写产品 workaround）：spike `packages/client/test/s3-client-generation-spike.test.ts`（published 0.1.7 client 的 `ClientSessions` + `UiWorkspaceService` over `RemoteMock`）+ `supplement-client/`（same-SID reopen refcount trace / failed-generation lifetime / public seam inventory / 五问答案 / composer lock chain source-verified）→ **NO-GO-C1 实证**（见下 §12 Q4 + `C1-client-closure-NO-GO.md`） |
| — | S4 same-page client repair：**SKIPPED**（guide：仅 S3=GO 后实现；S3 = NO-GO-C1） |
| S5a `5e16fa7` | S5 实宿主阻塞根因修复（见下「缺陷记录」#3）：提交的 dist 镜像 glue 是 pre-S1 陈旧 placement（`tsc` 不 emit `.mjs`，S1/S2 提交漏跑 `place-dist-glue` 步骤）→ 实宿主 = 新 S1 fence + 旧 glue（无 exact-claim wrapper）→ boot-1 bootstrap 被自家 fence veto，全 world FATAL。修复 = `check-artifacts-committed` 新增 **check-D glue-placement parity gate**（stale 树 RED 实证）+ `place-dist-glue` 模块化（`PLACEMENTS` 单一来源，新 placement 自动入闸）+ dist glue 重新放置（md5 == src，+196 行 = 恰为 S1 src 改动）；**零 src 行为改动**（fence/claim 设计经 source 逐环验证正确，缺陷在构建产物） |
| S5 `0ed7065` | 实宿主 A–F 全量重跑 @ S5a tip：ledger **166P/1F/fatal=null** — World A §5 strict gate 在预测的 **step 10** 精确复现 NO-GO-C1（见下「验证」§S6 电池 + `supplement-s5/worlds-verdict-s5.md`）；回归 B 16/16 · C 7/7 · D 15/15（`prepareOrdinaryOpen` permitted:true + contractVersion 5，S2 watch CLEAR）· E 20/20 · F 38/38（F1/F2/F3 新腿） |
| S6 `本提交` | 终验簿记：p4t6 pin 763→765（S2/S3 两个新可扫描测试文件）+ root vitest include 排除 S3 evidence-only spike（需 client 包环境，包级 1/1 绿）+ STATUS/PR body 定稿 + S6 终 tip 电池记录（零产品行为改动） |

## 核心改动（产品代码，全部在本插件内）

- `packages/runtime/src/plugin/team-session-activation.ts` — fence 核心（S1 五项 + 既有 veto/rollback/recovery）
- `packages/runtime/src/plugin/live/agent-bindings.mjs` — owned guard 接线（9 call-site `runOwned` wrapper + `ensureLiveAgent` exactly-one retry）
- `packages/runtime/src/plugin/host.ts` — S2 fence surface 完整性检查
- `packages/runtime/src/plugin/root.ts` — S2 `prepareOrdinaryOpen` 条件 spread
- 测试：`team-session-activation.test.ts`（A 系列）/ `team-session-activation-glue.test.ts`（G 系列）/ `team-session-startup-fence.test.ts`（新，H1/H2）/ `d2-s6-ensure-root-live.test.ts`（D/R 系列）
- 仓库工具（S5a）：`scripts/check-artifacts-committed.mjs`（check-D：dist 镜像 glue 必须与 src byte-identical — 封堵「src 改了、dist 放置漏了」这一安装面漂移类）/ `scripts/place-dist-glue.mjs`（模块化，`PLACEMENTS` 单一来源）/ `packages/runtime/dist/.../live/agent-bindings.mjs`（重新放置 = S1 src 字节）
- 测试基础设施（S6，零产品行为）：`packages/testkit/test/p4t6-session-event-scan.test.ts`（pin 763→765 勘误 = S2 startup-fence 套件 + S3 spike 两个新可扫描文件，零 denylist 词汇，隔离命中集不变）/ `vitest.config.ts`（root include 排除 S3 evidence-only spike — 该文件驱动 pristine upstream 0.1.7 client 服务，import 期触 `window`，需 client 包环境；包级命令验证 1/1 绿；断言零产品行为）

## §12 — 四个问题的回答（code + 测试 + real-host evidence）

**Q1. 同一个 Team Session 有两个 Team caller 同时要求 activation 时，谁负责 single-flight？**
activation core 的 per-SID single-flight：`ensureLiveAgentOnce` + `createRootAgentOnce` 两个 process-local map 对同一 SID 的并发 ensure 做 joiner — 第二个 caller 按身份拿第一个 caller 的结果/失败（S1；单测 G 系列含并发 join；real-host：S5 World **F1 ×20** `Promise.all([ensureRootLive, ensureRootLive])` — **20/20 迭代 2/2 caller 成功，每迭代恰一个 Team generation + 一个 writer，OUTSIDE_TEAM=0，unresolved writer-held=0**（`world-F/` 每迭代 JSON））。

**Q2. backend restart 后，在 TeamDomain ownership resolver 尚未 ready 的窗口里，为什么 ordinary SessionController 不能再次偷到 Team writer？**
ownershipReady barrier（S1）：resolver 未绑定时，Team Session 的 activation 分类为 **PENDING 并挂起** — 既不放行为 Team，也不当 unmanaged 放行；窗口内任何 foreign/ordinary 激活在 resolver 就绪后按 exact claim 判定 → Team-managed = typed veto（`TeamSessionActivationInterceptedError`）+ exact-generation rollback。窗口行为由 H1/H2 startup fence 测试锁定（真实 apply 生命周期、两阶段 gated-restart world：H1 root source=resume 挂起 → 释放后 typed veto；H2 ordinary source=startup 挂起 → unmanaged 放行）；real-host：S5 World A 的 cold open 即在 restart 后的窗口内发生并被 veto（probe 事件 created → exact disposed + 生产措辞）。

**Q3. ordinary activation 已经 veto+disposed 后，Team recovery 为什么不会因为 record 已删除而错过这次 handoff？**
epoch/tombstone（S1）：completed rollback 记录虽被删除，其 **完成 epoch 仍可通过 `completedEpoch > baseline` 事后观测** — recovery 判定「这次 handoff 的 rollback 已完成」不再依赖记录仍存在于 map 中。单测 A 系列（completed 后删除再 recovery 仍确认）；real-host：S5 World **F3** deterministic ordinary-first barrier — 强制 ordinary `agent/created` 先发生 → veto → exact `agent/disposed` → Team ensure success，记录 created>=2 / disposed>=1 / surviving=1（<<S5:F3: 数字>>）。

**Q4. 用户在同一页面看到 Session unavailable 后，只点击一次「以 Team 模式打开」，为什么 composer 能直接恢复，而不需要 reload / switch-away-and-back？**
**诚实回答：在 0.1.7-rc.1 published client 上，当前不能 — 这是本补充轮 S3 的实证结论（NO-GO-C1），按 guide §10 提交为架构决定，待主审裁决。**
- 数据层实证（S3 spike，published client 自己的 `ClientSessions`/`UiWorkspaceService`）：same-SID reopen 的 refcount 瞬态 2 结算 1、**从未到 0**；`refresh()`（现产品 step (c)）只刷 Host catalog；`handleConnected` 不触 scopes — 失败 generation 的 sticky 状态（`openState 'error'`/`openError`/`lastAgentError` + per-generation 缓存的 composer faces）三者均不清除。
- 唯一 public 到 0 路径 = `uiWorkspace.archiveSession`（带 host-archive 副作用 + `clearArchivedCurrent` 拒持 archived 为 main → 需 archive→unarchive→reopen 三调用对）— §3.4 明令无正式 ADR 不得伪装 same-page repair；seam inventory（两 service 运行期枚举）无任何 reset/reopen/release 类 seam；`UiWorkspaceService` 实例建于 host `apply()`、无 provider 替换槽 — Q5 = NO（「小型 client replacement」不成立）。
- 因此 **C1 client closure = NO-GO**（`supplement-client/C1-client-closure-NO-GO.md`：缺失的 public seam / 为何 refresh/openSession 不足 / 最小可行替代及各自修改范围）。按 §3.4/§8：**本轮不启动 B+**；替代选项（A′ startup ownership protection：host 侧在 startup/catalog 路径提前发布 Team-managed 性，cold open 直接 Team 模式，veto 状态根本不会出现，无 core patch / B+ SessionController compatibility replacement：PR #26 同款 pattern，唯一 semantic delta = activation owner selection，开工前需 Typert descriptor spike）由主审决定。
- 在此之前用户可见恢复 = full page reload（Q2 浏览器证据已证）；§5 World A hard gate 在 S5 按原文执行（driver 零 fallback），gate 的精确失败步（step 10 composer 未恢复）作为证据记录 — 按 §5「如果这一 gate 无法通过，PR #31 仍不 merge-ready」：**same-page UX closure 不构成 merge-ready**，其余收口项（Q1–Q3 + race closure + 契约）均已闭合。S5 实宿主复现（`supplement-s5/worlds-verdict-s5.md` + `world-A/boot-2/gate-verdict.json`）：steps 1–9 全 PASS（fresh 页开冷 root / fence 精确措辞 veto / 「会话不可用」+ composer disabled / 单击 exactly once / 零 reload/blank/switch），**step 10（GATE STEP）FAIL = predicted（failedStep=10）** — host 侧 takeover 成功（step 15：created=3 / disposed=2 / surviving=1，最终 Team generation live）而 client composer 保持 disabled；三处驱动缺陷修复均为 pre-gate 机制（gate 断言逐字未动，中间证据 `world-A-buggy-driver/` + `world-A-step7-composer-defect/`）。**裁决请求：A′（startup ownership protection，无 core patch）vs B+（SessionController compatibility replacement，需 Typert spike）请 lead-reviewer 裁决；裁决前恢复手段 = full page reload。**

## 验证（S6 终验，@ tip `0ed70657`；S6 簿记提交零产品行为改动，安装面不变）

- typecheck 0 / build 0 / build:composition 0 / check:artifacts **1196 files OK（含 check-D glue placement）** / zero-core **0 findings**（main checkout，test-use @ `46a7f68b09` pristine）
- focused suites：client S3 spike **1/1**（包级命令，`s6-focused-client-manual.log`）| runtime 受影响四套件（activation + glue + startup-fence + d2-s6）**4 文件 / 58 测试全 PASS**
- root 全套件 vs 债务基线（债务 = 6 文件/8 测试 runtime：p6t3-mediation 5F / p6t3-restart 2F / d3 D3-4 1F / p8s3b + t12a-b2 + t12a-glue-handoff 文件级；root 级另有 domain t1 9F / t2 1F / tools p6t6 1F / p6t1-parallel 2F 负载 flake）：本次 run = **9 文件 / 19 测试失败 = 债务子集（p6t1-parallel 本次 0F），new deterministic failures = 0**；`ROOTTEST_PROCESS_EXIT=1`（非零 = 既有债务，如实记录）/ `ROOTTEST_BASELINE_EQUIVALENT=true` / `ROOTTEST_NEW_FAILURE_COUNT=0`（`supplement-s6/s6-root-suite-r2.log`；S6 簿记前 p4t6 pin 763→765 勘误 + root include 排除 S3 evidence-only spike —— 详见「核心改动」）
- install-from-git / production profile smoke：PASS — S5 kit 每 world 的 install 腿（bare-clone tip == 分支 SHA + `dsh plugin add` exit 0 + 0.1.7 compat 门 + 1196 安装面齐全，`supplement-s5/world-*/install/`）
- 实宿主：S5 worlds A–F = **166P/1F/fatal=null**，唯一 F = World A §5 gate step 10（预测步，文档化发现）— `supplement-s5/worlds-verdict-s5.md`

## 缺陷记录

- 首跑 BLOCKED（Commit 4 轮）：`runOwned` 同步 guard lifetime 缺陷（guard 未覆盖 await 生命周期）→ 定因留痕 `commit4/DEFECT-c1-runOwned-guard-lifetime.md` → 修复 f3d5a71b（含 A9），重发全绿。
- Q2 浏览器发现（run 20）：takeover 成功后 composer 页内 sticky 会话不可用、reload 恢复 — **client 状态机 gap，非 fence 缺陷**（fence 行为完全符合设计）→ 本补充轮 S3 数据层定因 + NO-GO 架构决定（上 §12 Q4）。
- **S5 首跑 BLOCKED（补充轮）→ S5a 定因修复**：实宿主 A–F 全 world 于 boot 1 FATAL（`TeamSessionActivationInterceptedError … Team-managed session "session-rst017s5-boot-…"`）。主代理独立定因（不采信初诊的设计层归因）：fence + exact-claim 设计在 src 层逐环正确（agent-loop `setupAndPublish` 传给 setup 的 Agent 与 awaited-serial announce 携带的 Agent 为**同一对象**，单一 fence 实例）；真根因 = **提交的 dist 镜像 glue 自 449e1fc 起 byte-identical（md5 `ddd17d74`）于 pre-S1**（`tsc` 不 emit `.mjs`，S1/S2 提交更新了编译 TS dist 却从未含 .mjs 镜像）→ 安装面 = 新 fence + 旧 glue（无 claim wrapper）→ 自家 boot-1 激活无 exact claim → foreign veto。三层漏检：unit 套件从 src 载（绿）/ A/B/C 三向闸只比 disk vs index（stale 两侧同 stale）/ 唯一执行 dist glue 的消费者 = 实宿主 git-install。修复 = S5a `5e16fa7`（check-D parity gate RED 实证 + dist 重放置）；实宿主复核：修复后 World A boot root `agent/created source=startup veto=false` 且无 exact `agent/disposed`（blocked run 为 21ms 内 created→disposed 对）。证据 `supplement-s5/ROOT-CAUSE-s5a-stale-dist-glue.md`（含 md5 工件取证 + 身份链引用 + 重跑探针）。

## follow-ups

- F-rc1 / F-rc2（前轮登记：p6t1-parallel per-root re-probe 序列化建议等，见前轮 body）
- **F-rc3（本轮新增）：same-page composer 恢复的 A′/B+ 裁决** — NO-GO-C1 已实证（`supplement-client/C1-client-closure-NO-GO.md`）；在裁决落地前，cold-open-after-restart 的用户可见恢复 = full page reload。

## 红线

CORE PATCH BUDGET = 0（upstream 零修改；test-use pristine @ 46a7f68b09，本轮前后双证）/ Remote v5 不 bump v6 / 无 session.lock 删除 / 无 sleep-backoff / while-retry / 无 substring-only writer authority / 无 silent adopt / 无 ownedDepth PASS / 无物理扫描 / 无 DOM hack / 无 private store / 无 reload 修复 / 无无 ADR 的 blank-switch 伪装 / 未 NO-GO 前不启动 B+（NO-GO 现已实证，B+ 仍为待裁决项）/ push 面 = 仅本分支 FF、零 force-push、master 零触碰。

## 证据指针

`dev/agent-workflow/evidence/restart-017rc1/`：phase0/（spike 1–20 + verdict GO）/ commit2–5（前轮全量）/ **supplement-s1/**（A10–A15 + G7–G10）/ **supplement-s2/**（H1/H2 + R6 + G11/G12 + 全套件对照 ×5）/ **supplement-client/**（S3 spike + verification.md + spike-run-1.log + C1-client-closure-NO-GO.md）/ **supplement-s5/**（kit-s5.mjs + browser-gate-driver-v2.mjs + ROOT-CAUSE-s5a-stale-dist-glue.md + world-A…F + worlds-verdict-s5.md）/ **supplement-s6/**（终验 battery 日志）。
