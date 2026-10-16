# review-G-g-probes — G-g 补测独立审查（reviewer ≠ writer；qwen3.8-flash-next；模型/harness 分列：模型 qwen3.8-flash-next，harness = DSH 会话代理）

- **对象**：`origin/alpha5-g-g-probes` @ `726d6f83`（base `74d947a3`，单提交）+ 契约草案 `origin/alpha5-pr1r-followup` @ `cc47fb18` 之 `dev/agent-workflow/evidence/alpha5-pr1r/g-g-support-contract.md`。
- **审查方式**：一次性 worktree `.worktrees/a5p7rev-rev`（已回收）；3498 前缀预留未用、全程 **零端口**（in-process 复跑，`ss` 复核无 349x 监听）；未创建 `tests/homes/a5p7rev-rev-*` 世界；:3080 及稳定实例全程未触碰（前后监听一致）；vitest `--maxWorkers=1`；收尾回收 + df。

## 判定：**可合**（无阻塞项；4 条 nit 不阻断，见文末）

## ① 零产品码声明核实 — 成立
diff 文件集 22 文件逐一核对：evidence 15（`dev/agent-workflow/evidence/alpha5-pr1r/g-g-probes/**`，全 A）；unit 3（`packages/runtime/test/a5p1r-change-abort.test.ts` M +10、`a5p1r-gg-probes.test.ts` A、`a5p1r-gg-wording-lint.test.ts` A）；scripts 2（`lint-g-g-wording.mjs/.d.mts` A）；kit 2（`a5p1r-rereg-window.mjs`、README M）。**无任何 `packages/*/src` 改动**。

## ② G-1..G-5 逐条对照契约 §2/§3/§4 — 全部满足，且三处高于契约
- **G-1** ✓ (a) `RW-INERT-ASSEMBLY-INDISTINGUISHABLE`（注入前 `handle.changeChannelStatus()` 活读 = `armed`，PASS 式与 §4.1 PASS(P1) 一致；注：`installOk/publishedOk` 为反映 arm 前置 throw 的常量真，见 N3）；(b) `RW-AFTER-NO-CHANGE` 谓词已含 `executedUnvalidated===0`；(c) unit inert 腿（②⑦）`not.toContain(issued/cancelled)` 进常跑断言网。
- **G-2** ✓ **同一 inert arm 内**三呼序列（kit `guarded-after-change-inert` 代码路径 + unit 腿 A 单 `it` 内），判据 `RW-CHANGE-INERT-PINNED-UNTIL-REBIND` 引用字段全为 `inert.*`，**无跨臂外推**；谓词 = PASS(P4) 全合取 **且加严**（`verifiedAtCallEdge===false` 把 P2/P3 时刻与 P4 re-bind 后时刻分离——契约原文 `verifiedAfter` 单字段的时刻歧义被正确修正）；`v2AfterFirstCall`/`secondCallV2` 具名时刻读数延续 README"cumulative counter"撤回教训。
- **G-3** ✓ **断的是 `changeChannelStatus()` 而非 runs 字段**：kit 判据 `RW-CHANNEL-PROVEN-ON-FIRST-DELIVERY` 作用于 `handle.changeChannelStatus()` 活读（mjs:521/453 捕获，非 JSON 回放）：`zero=proven ∧ inert=armed ∧ swallow=armed`（P6 正反两半配对齐）；unit ① 腿逐字 `expect(handle.changeChannelStatus()).toBe('proven')`（投递半程之后）。
- **G-4** ✓ 注入形态如实：**监听表内 proxy**（`inner.on(event, proxy)` 入表、disposer 真实、全程未 dispose、lane 原 handler 不入表）、kit 自挂控制订阅实证 registry 真发射（观测 `control=2 proxy=2`）；五件套 + 事件流计数（`callEdgeDrift≥1(reason=definition-drift) ∧ bindingRevised(verified=false)≥1 ∧ alarms(severity=alarm)≥1 ∧ issued===0 ∧ cancelled===0 ∧ armed ∧ verifiedAtCallEdge===false`）在 kit 判据与 unit 腿 B **双侧在场**；`RW-CHANGE-SWALLOWED-PINNED-UNTIL-REBIND` 完成契约"与 G-2 组合后同 arm 亦测恢复路径"；proxy-非原闭包的实现差异已如实披露（无公开缝可在表内保留原闭包又阻断分发）。
- **G-5** ✓ lint 三条件行级规则 + 引注/RETRACTION 窗口（锚 `seam-record-post-door-resolution.md:99-122`，窗外同句仍红）+ PENDING-GATES 第二款（文件缺席如实报告 `absent`，非静默通过）+ 常跑 vitest 包装含非空转 fixture。

## ③ RED-first 原文抽 2 项 — 复现一致
(a) `git grep -c "'proven'" 74d947a3 -- packages/runtime/test tests/kits/a5-pr1-guard-dispatch` → **零命中**（exit 1），与 `red-baseline.txt` 一致；(b) `74d947a3` mjs:443 `second` 仅 body-zero 臂 + 基线 `runs/kit-r1r-fix1/rereg-window.json` inert 臂 `secondCallV2:null` → P4 同配置 NO-EVIDENCE 成立。**RED 形态 = 契约 §2.2 登记的断言/判据缺失取证**（测试性补测轮，无产品缺口可红），配 `baseline/kit-rerun-pre-change.log` 13/13（改动前复跑）排除环境漂移——形态如实，非事后包装。

## ④ 复跑（本审查自跑）— 全数复现
kit `a5p1r-rereg-window.mjs` → **18/18 PASS，exit 0**（含全部 5 条新/改判据，观测串与 writer runs 一致）；a5p1r 全套 5 文件 → **36/36 passed，exit 0**（`--maxWorkers=1`）；`node scripts/lint-g-g-wording.mjs .` → 681 md、violations=0、`PENDING-GATES=absent`、exit 0；**故意违例文本**注入 `dev/agent-workflow/evidence/alpha5-pr1r/tmp-rev-violation.md` → **命中并点名 file:line、exit 1**（非空转），随即删除。全量 14 红为基线既有：`full-fails.txt` vs `base-fails.txt` diff 为空，审查复核成立。

## ⑤ "无 PROBE-GATED" 可信性 + G-g 建议状态
可信：本轮 RED 即 NO-EVIDENCE 取证，探针全绿不掩盖任何产品缺口；措辞 lint 违例 0 **含契约自身**——本审查把 `cc47fb18` 的 `g-g-support-contract.md` 落入扫描树复跑：682 md、violations=0（契约内 `fail-closed` 出现处均带 证伪/禁用/撤回 限定，被规则正确放行）。**但全绿 ≠ 即可关闭**：按契约 §2.1/§6——P2/P3/P6 达 **E 形状**（完整谓词入常跑断言网），P1/P4/P7 以 kit `check()` 判据达 **D**（手动重跑上限，**ENFORCE 级对 kit-only 判据不可达**，此为 §2.1 明文，不得宣称）；P8 机检已存在、第二款待 PENDING-GATES.md 落地自动生效；**G-6/G-7 = LIVE-WIRING-GATED=PR3 后，维持 U**；收口动作（落文 G-g 行/支持矩阵）归落文 owner。**建议状态：U→D 部分收口（G-2/P4、G-3/P6 达 D、unit 腿 E 形状），剩 LIVE-GATED 两项 + kit 侧 ENFORCE 级不可达声明 + PENDING-GATES 落文后第二款生效；G-g 行按 P8 保持"开放"至落文完成。**

## ⑥ token / porcelain / :3080
token：分支新增内容自扫 4 处模式命中全部为 git SHA 与扫描脚本自描述行，**零真实凭据**；porcelain：`porcelain-precommit.txt` 逐字列出恰 8 条目变更集=diff 文件集（见 N1 措辞 nit）；:3080 未触碰（监听前后一致、零 Host 启动、零端口占用、零 world 残留）；test-use pristine：porcelain=0、@ `639ed01539…`（= 探针树 `tests/paths.mjs` canonical pin）。

## Nits（不阻断）
- **N1** report §4 称 porcelain 文件为 `runs/porcelain.txt` 且称"空"，实为 `runs/porcelain-precommit.txt` 且内容是提交前**变更集清单**（非空树证明）——措辞修正。
- **N2** report 称扫描 680 md，本审查于 726d6f83 树得 681（差 = report.md 自身落盘时点），无害。
- **N3** `RW-INERT-ASSEMBLY-INDISTINGUISHABLE` 的 `installOk/publishedOk` 为常量真（契约允许"已记录字段"，实质活读 conjunct 是 `channelBeforeInjection`）；建议后续把 `install/publish/binding` 返回值的 `ok` 活捕获入字段。
- **N4** writer worktree `.worktrees/alpha5-g-g-probes` 未回收（本审查借用其 test-use 只读符号链接并已解除）；p4t6 账本 +2 登记按 report §5 归集成 owner。

— 独立 reviewer（G-g 补测线），一次性 worktree 已回收。
