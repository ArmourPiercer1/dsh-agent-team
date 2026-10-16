# G-g 支持契约补测（G-1..G-5）— probe report

- **任务**：G-g 支持契约 §3 补测清单 G-1..G-5 的 RED-first 落地（G-6/G-7 = LIVE-WIRING-GATED=PR3 后，不在本轮）。
- **writer**：G-g 支持契约补测 writer（模型 qwen3.8-flash-next；harness = DSH 会话代理）。
- **基线**：`origin/master` @ `74d947a3ac959e66525ad8fdaae0bb99cb692c14`；分支 `alpha5-g-g-probes`（一次性 worktree `.worktrees/alpha5-g-g-probes`，1 task = 1 branch = 1 worktree = 1 writer）。轮内 master 由并行 lane 推进至 `d69bfc4b`（PR #260，a5p5-tools lane）——本轮未 rebase（分支所触文件与其零交集，处置归集成 owner）；所有 RED 取证显式钉 `74d947a3`。
- **权威输入**：`origin/alpha5-pr1r-followup` @ `cc47fb18cf085daabdf40e545fcac44f946a0d82` 上 `dev/agent-workflow/evidence/alpha5-pr1r/g-g-support-contract.md`（P1–P9 命题、E/D/UR/U 分级、G-1..G-7 定义；本轮实现其 §4.1 PASS(P1..P8) 判据式对应的断言/判据，不改动任何裁决与矩阵定位）。
- **端口/世界纪律**：本轮 **零端口**（全部为 in-process 探针：kit 腿走 p00-fixture 钉定 registry 纯 in-process、unit 腿走 registry double、G-5 为静态扫描）。3496 前缀预留未用、未自占；未创建任何 `tests/homes/a5p7rev-*` 世界（无需清理留痕）；:3080 及其 DSH_HOME 全程未触碰（未启动任何 Host 实例）。`vitest --maxWorkers=1`。
- **红线遵守**：**零产品码改动**（diff 仅测试文件 + kit runner + kit README + 新 lint 脚本/其 .d.mts + 本证据目录）；未碰共享 tsconfig/barrel/registry/scanner 与 p4t6；对 ledger（PENDING-GATES.md，master 上不存在）只做**只读断言**（G-5 第二款的条件挂载），登记与落文留集成 owner。

## 0. 结果一览

| 项 | 内容（契约 §3 行） | 状态 |
| --- | --- | --- |
| G-1 | 判据补齐：(a) `RW-INERT-ASSEMBLY-INDISTINGUISHABLE`；(b) `RW-AFTER-NO-CHANGE` 追加 `executedUnvalidated===0`；(c) unit inert 腿追加 `issued=0`/`cancelled=0` 断言 | **GREEN** |
| G-2 | inert arm 内完整"被拒→re-bind 恢复"：kit 判据 `RW-CHANGE-INERT-PINNED-UNTIL-REBIND` + unit 同臂镜腿（§(j) 允许说法自此在静默配置自身内有测量；分级升格与否归收口 owner） | **GREEN** |
| G-3 | "送达⇒proven" 正断言：kit `RW-CHANNEL-PROVEN-ON-FIRST-DELIVERY`（正半 + inert/swallow 反向配对）+ unit ① 腿 `expect(handle.changeChannelStatus()).toBe('proven')` | **GREEN** |
| G-4 | 新 arm `guarded-after-change-swallow` + 判据 `RW-CHANGE-SWALLOWED-LOUD`（五件套+事件流计数+控制订阅实证发射）与 `RW-CHANGE-SWALLOWED-PINNED-UNTIL-REBIND`；unit 镜腿（谓词组 + 恢复路径） | **GREEN** |
| G-5 | 措辞 lint `scripts/lint-g-g-wording.mjs`（CLI）+ 常跑 vitest 包装（fixture 证明规则非空转，宁窄勿宽）；PENDING-GATES G-g/G-a 同判 closed 检查已挂载（文件在 master 缺席=诚实报告 `absent`，落地即生效） | **GREEN**（文件缺席状态如实记录） |

**PROBE-GATED：无。** 所有探针在未改动产品上直接 GREEN——RED 的形态是契约 §2.2/§5 登记的 **NO-EVIDENCE（缺断言/缺判据/缺机检）**，本轮补的就是断言与判据本身；未暴露任何产品侧缺口，故无红留证据、无 it.skip（也未被使用）。

## 1. RED 基线（原文）

`runs/red-baseline.txt`（本目录）：对 `origin/master` 树执行的缺断言/缺判据/缺 lint 取证（`git grep` 命令 + 原文输出）。要点：

- `git grep -c "'proven'" origin/master -- packages/runtime/test tests/kits/a5-pr1-guard-dispatch` → **零命中**（与契约 §2.2 P6 行"全检仅命中 install.ts 源三处"一致）⇒ G-3 断言缺失成立。
- `RW-AFTER-NO-CHANGE` 旧谓词无 `executedUnvalidated` conjunct ⇒ P7 记录级非判据（G-1b 缺口）。
- `guarded-after-change-inert` arm 无 second/third 探针（`runs/kit-r1r-fix1/rereg-window.json` 中 `secondCallV2:null`）⇒ P4 同配置 NO-EVIDENCE（G-2 缺口）。
- 四个新判据 id 与 `scripts/lint-g-g-wording.mjs` 在 master 均零命中 ⇒ G-1a/G-4/G-5 缺口。
- kit 基线复跑（改动前）：`runs/baseline/`（13 criteria 全 PASS、exit 0，`rereg-window-baseline.json`）——证明本轮 GREEN 非环境漂移所致。

## 2. 实现落点与观测

### G-1（P1 装配不可区分 + P7 误报守卫 + P2 常跑零-abort）
- kit `tests/kits/a5-pr1-guard-dispatch/a5p1r-rereg-window.mjs`：
  - armB3 记录 `installOk/publishedOk/channelBeforeInjection`（原来"隐含于 throw 之外"的装配事实显式入档）；判据 `RW-INERT-ASSEMBLY-INDISTINGUISHABLE`：`installOk ∧ publishedOk ∧ channelBeforeInjection==='armed'`。观测：`installOk=true publishedOk=true channelBeforeInjection=armed`（PASS）。
  - `RW-AFTER-NO-CHANGE` 谓词追加 `executedUnvalidated===0`（PASS：`unvalidated=0`）。
  - `RW-CHANGE-INERT-LOUD` 按 §4.1 PASS(P2) 补齐 conjunct：`cancelledBeforeBody===0`，并把 `v2`/`verifiedAfter` 改为**具名时刻读数** `v2AfterFirstCall`/`verifiedAtCallEdge`（恢复路径加入同一臂后，end-of-run 读数不再是 P2 所指时刻；这是对 README"cumulative counter"撤回教训的延续，见 kit README 该节）。
- unit `packages/runtime/test/a5p1r-change-abort.test.ts` ②⑦ 腿（:245 族）追加 `not.toContain('dispatcher-change-abort-issued')` 与 `not.toContain('dispatcher-call-cancelled-before-body')`。

### G-2（P4 收口硬前提：静默配置自身的 pinned-until-re-bind）
- kit：`guarded-after-change-inert` 臂内静默调用 settled 后 `second=f.run('grep')`（断言被拒：body 计数=0 且文本含 `definition drift`+`re-bind required`）→ `bindOwnTools(['grep'])` → `third=f.run('grep')`。判据 `RW-CHANGE-INERT-PINNED-UNTIL-REBIND`＝`secondCallRefused ∧ secondCallV2===v2AfterFirstCall ∧ rebindOk ∧ thirdCallExecuted ∧ verifiedAfter===true`（re-bind 后读数；call-edge 的 `verified===false` 由 `verifiedAtCallEdge` 独立承载，P2/P3 与 P4 时刻分离）。观测：`secondRefused=true secondV2=1 v2(first)=1 rebindOk=true thirdExec=true edge=false afterRebind=true`。
- unit 新文件 `packages/runtime/test/a5p1r-gg-probes.test.ts` 腿 A：同序列在 registry double 上常跑。
- **family 说明**：恢复路径测于 `team-own:` family（`own: [{name:'grep',identity:'TEAM.grep'}] + bindOwnTools`）——`bindOwnTools` 只重绑 `team-own:`，inherited native 名按 PR1 稳定身份律不可 re-bind（a5p1r-change-abort.test.ts 腿⑥ 注释即此律）；kit armB3 各臂本来就是 `assemblyOwnedNames + bindOwnTools`，unit 镜腿与 kit 臂同族，非口径漂移。

### G-3（P6 两半齐）
- kit `RW-CHANNEL-PROVEN-ON-FIRST-DELIVERY`：`zero.changeChannel==='proven' ∧ inert.changeChannel==='armed' ∧ swallow.changeChannel==='armed'`（body-zero 臂的真实 re-register 投递=正半；两个静默臂 run 末尾反向半）。观测：`delivered=proven inert=armed swallow=armed`。
- unit ① 腿：`registerOwn` 投递后 `expect(handle.changeChannelStatus()).toBe('proven')`（反向半既有 :251/:269）。
- 措辞纪律（契约 §4.2）：P6 已收口前（收口动作=G-1..G-5 落地并复跑留 runs，判定权在收口 owner），`changeChannelStatus()` 读数在对外措辞中仍只作**诊断**引用。

### G-4（swallow 注入 = "订阅存活、发射被吞"的第二种静默注入）
- kit 新臂 `guarded-after-change-swallow`：交给 lane 的 `on` 被包一层——`tools/change` 订阅**被接受**、disposer 真实且**全程未 dispose**、该表项留在 Host 监听表中，但表项是转发永不开闸的 proxy（与 inert 的"先订阅后 dispose"是两种注入；lane 视角不可区分：装配形状相同、status 恒 `armed`）。**实现披露**：留在监听表中的表项是 kit 侧 proxy（cordis 内部 `dispatch` 逐 listener 调用，无公开缝可保留原闭包又阻断对其分发；harness 不碰 Host 内部结构）。为排除"注入退化成全局无发射"，kit 自挂一条**控制订阅**实证 registry 确实 emit：观测 `control=2 proxy=2`（发射发生、表项被分发、lane handler 未收到 ⇒ 状态仍 `armed`）。
- 判据 `RW-CHANGE-SWALLOWED-LOUD`＝ 五件套（`v2AfterFirstCall===1 ∧ executedUnvalidated≥1 ∧ issued===0 ∧ cancelled===0 ∧ changeChannel==='armed' ∧ verifiedAtCallEdge===false`）**加**事件流计数（`dispatcher-definition-change-at-call-edge(reason=definition-drift)≥1 ∧ dispatcher-binding-revised(verified=false)≥1 ∧ executedUnvalidated(severity=alarm)≥1`）**加** `swallowControlEvents≥1 ∧ swallowProxyEmissions≥1`。观测全绿（`callEdgeDrift=1 bindingRevised=1 alarms=1`）。fail-closed 告警期望按契约措辞：本判据**只**断言"响亮上报 + 不取消 + 通道未证明"，不构成对静默配置的任何 closed/fail-closed 宣称（P8 禁则由 G-5 lint 机检）。
- 同臂恢复路径：`RW-CHANGE-SWALLOWED-PINNED-UNTIL-REBIND`（G-2×G-4 组合，"与 G-2 组合后同 arm 亦测恢复路径"）。
- unit 镜腿（`a5p1r-gg-probes.test.ts` 腿 B）：double 上以同法注入（表项在 `double.listeners`、`disposed===false`、控制计数≥1、proxy 计数≥1），常跑同一谓词组 + 恢复路径 + run 末 `armed`。

### G-5（P8 的机检形态 = 措辞 lint）
- `scripts/lint-g-g-wording.mjs`（CLI，exit 1=violation，命中输出 `file:line:`）+ `packages/runtime/test/a5p1r-gg-wording-lint.test.ts`（常跑，含**非空转 fixture 证明**：裸宣称被捕获；UNSUPPORTED/UNTESTED/待证/RETRACTION/禁则 与"吞异常"类无通道语境行不被捕获）。
- 规则（宁窄勿宽，行级三条件同时成立才红）：闭合宣称（`fail-closed|silent-safe|已合规|compliant`）× 静默通道语境（`静默通道/静默配置/静默时/静默观察/订阅成功但/永不投递/永不送达/never-deliver/never arrives/silent-channel/accepted-but-silent/订阅存活`，`swallow` 须同行伴随订阅/通道/tools-change 词汇）× 无限定/撤回标记（`UNSUPPORTED/UNTESTED/待证/NO-EVIDENCE/RETRACTION/retract/撤回/禁则/禁用/禁止/不得/证伪`）。引注/RETRACTION 窗口 allowlist，锚 = `seam-record-post-door-resolution.md:99-122`（窗口外同句仍红）。
- 第二款：`dev/agent-workflow/PENDING-GATES.md` 存在时断言 G-g 行与 G-a 行不得同判 closed；本轮 master 无该文件 → 报告行如实显示 `PENDING-GATES=absent`（非静默通过）。**CI 挂载与文件落地归集成 owner**。
- 本轮扫描：680 个 md、violations=0（对既有含 `fail-closed` 的 4 条候选行逐一核对为通道外语境，未误伤；规则设计记录见脚本头注）。

## 3. 分级影响（事实陈述，不代行收口）

本轮后各命题的**机检要素存在性**（分级裁决归 G-g 收口 owner；§4.2 禁则在收口前持续生效）：
- P1：Host 级判据已命名（原缺 G-1a）；P7：进入判据（原仅记录级）；P2：unit 腿补 `issued=0/cancelled=0` 进常跑断言网；P4：静默配置内恢复路径 kit 判据 + unit 常跑两腿（原同配置 NO-EVIDENCE）；P6：正向半首次成断言（kit+unit 双侧）且与反向半配对；P3：事件流计数断言（unit 常跑 + kit 判据）；P8：lint 机检存在且常跑。
- 静默配置（订阅成功但永不投递）在收口动作（含本报告 runs 的复跑确认与落文）完成前的矩阵定位仍按契约 P8 行 = **UNSUPPORTED/待证**；本报告不构成"已合规/closed/fail-closed"宣称。
- G-6/G-7 不动（LIVE-WIRING-GATED=PR3 后）。

## 4. 门禁记录（原文见 runs/）

- kit（窗口 runner，改动后）：`node tests/kits/a5-pr1-guard-dispatch/a5p1r-rereg-window.mjs` → **18/18 PASS，exit 0**（`runs/kit-gg-probes-1.log` + `runs/kit-gg-probes-1/rereg-window.json`；基线复跑 `runs/baseline/` 13/13 exit 0）。
- unit：`a5p1r-change-abort.test.ts`（18，含 2 条新断言行）+ `a5p1r-gg-probes.test.ts`（2 腿）+ `a5p1r-gg-wording-lint.test.ts`（3）全绿，`--maxWorkers=1`；a5p1r 全套复跑见 full vitest 记录。
- 全仓 vitest（`--maxWorkers=1`）：`runs/full-vitest.log`（534 passed / 7 failed files；6843 passed / 14 failed tests）。**14 条红全部为基线既有**：对照运行 `runs/control-7files-at-baseline.log`（探针全部撤除、`git stash` 回 74d947a3 原树后仅跑该 7 文件）→ **同一 7 文件、同一 14 测试名、同一断言数值**（`runs/full-fails.txt` vs `runs/base-fails.txt`，diff 为空）。失败域均与 a5p1r/G-g 无关（a4p7-merge-gate 需组合构建产物、p6t3/p6t6 会话 fixture、t2 hash、a5p0 layer-audit、p4t6 账本计数 `1122→1109`——该数值在含/不含探针两次运行中完全相同，证明与本轮新文件零交互）。本轮范围内**无新增红**；红如实记录、处置归各域 lane。
- typecheck：`pnpm -r run typecheck` → **TSC_EXIT=0**，`error TS` 计数 0（`runs/typecheck.log`）。
- token 扫描：对本分支全部新增/改动文件扫描 `token=`/launch-token/长随机 token 形态 → **0**（`runs/token-scan.txt`）。
- porcelain：提交前 `git status --porcelain` 空（`runs/porcelain.txt`）。
- test-use（pristine）：`git status --porcelain` 空、HEAD=`639ed01539…`（0.2.0-rc.2 pin，`runs/test-use-clean.txt`）。
- 工作树一次性：`.worktrees/alpha5-g-g-probes`，无端口占用、无 world 残留。

## 5. 交接

- 集成 owner：G-5 lint 的 CI 挂载（脚本可独立跑：`node scripts/lint-g-g-wording.mjs .`；vitest 包装已在 root suite 内）；PENDING-GATES.md 落地时第二条款自动生效；本目录 runs 与 §3 事实陈述供收口裁决引用。**p4t6 账本**：本轮新增 `packages/runtime/test/a5p1r-gg-probes.test.ts` / `a5p1r-gg-wording-lint.test.ts` 两个可扫面文件——若 p4t6 扫描器 universe 在合并树把它们计入，账本 +2 的增量登记由集成 owner 执行（本轮未触碰 p4t6 文件；基线对照中 `1122→1109` 数值与探针在场与否无关，见 §4）。
- 落文 owner：G-g 行/支持矩阵的措辞更新（§4.2 禁则先于允许式；缺证声明模板仍适用于未收口期间）。
