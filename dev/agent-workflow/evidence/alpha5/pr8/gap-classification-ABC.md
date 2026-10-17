# Gap 分类 A/B/C —— vnext-migration-gap-checklist C-01..C-13 逐行二分（可三）

- 轮次 = **alpha5-gap-classify**（reviewer ≠ W8 writer；qwen3.8-flash-next）；基 = `master@aece4f21`。
- 受审件 = `vnext-migration-gap-checklist.md`（下称 **checklist**，行号按其原文）；分类法：
  - **A** = 只是未实现/未接线（原计划内、公开 seam 足、可立即派工）→ 给步骤（文件/包/大致量）+ owner 类型；
  - **B** = 真需用户裁决（语义/范围/产品边界）→ 精确裁决问题一句话 + 选项；
  - **C** = 公开 seam 真缺（`CORE_SEAM_BLOCKER` 级）→ 引已有最小复现路径。
- 方法：本 reviewer 对每行引用的现有证据**逐锚点独立复验**（grep/sed/python 只读；零端口、零世界、:3080 未触碰）；不确定处**显式标注原因，禁猜**。

## 0. 分类总表

| 行 | checklist 行号 | 分类 | 一句话 |
|---|---|---|---|
| C-01 | :11 | **A**（可派工） | 工具面已落，缺 registry 断言实现 + G-d 集成确认 |
| C-02 | :12 | **A**（无差距边界行，无需派工） | 有意丢弃 + p4t6 机检封禁在册 |
| C-03 | :13 | **A**（无差距，无需派工） | 三分身份已按冻结对象模型落 contracts（注：其 INTERFACES-v1 正本不在分支，见 §2-U1） |
| C-04 | :14 | **A**（可派工；附 B 依赖） | editor 族三缺腿可装配；"任意树 Supported"宣称线另受 OpenAtPort 裁决 |
| C-05 | :15 | **A**（可派工） | read_image 全链三缺腿可装配 |
| C-06 | :16 | **A**（可派工） | PTC 管线两缺腿 + provider 生产 glue，seam 已被 PoC6a A4 证可组合 |
| C-07 | :17 | **C**（CORE_SEAM_BLOCKER 级；附可派工子腿） | policyGeneration 池键 = 上游公开面真缺（B4 SEAM-GAP），已有复现 |
| C-08 | :18 | **A**（可派工） | Domain mock + veto 三腿 + compile-plane，全部自有面工作 |
| C-09 | :19 | **A**（无差距，无需派工） | pinned 版本本无 job_start，absent 机检行如实维持 |
| C-10 | :20 | **A**（可派工；附不确定子项） | 生产 glue 在 GLUE 队列；三缺项中 trusted 锚定一项不确定 |
| C-11 | :21 | **A**（可派工，小） | registry run≠null / root vitest 收集 = 已披露 GLUE/PR8-build 队列 |
| C-12 | :22 | **B**（用户裁决；附 C 面） | "投递/取消/静默安全"保证的支持语义边界归用户；硬保证路线触 D-1 上游缺 |
| C-13 | :23 | **A**（无差距完整性行，无需派工） | P 系列与 Alpha.5 治理面正交，本表不复审 |

**计数：A=11（其中可派工 7 = C-01/04/05/06/08/10/11；无差距边界行 4 = C-02/03/09/13）· B=1（C-12）· C=1（C-07）。**

---

## 1. 逐行裁决与依据

### C-01 · Team 协作工具族 → **A**
- 原文：checklist:11。复验：五工具 B 级移植决策 = `docs/migration/reuse-map.md:54-58`（§1.5 tool-team 五工具行）；vNext 自有词表面已落 = `packages/tools/src/tools.ts:10-14`（facade 映射表，亲读）；缺 = registry 套件 `00-guard-dispatch` `run: null` = `docs/plans/memo/alpha5-tool-io-governance/pr8-accept/e2e-skeleton/suites/registry.mjs:7,:13`（注释 :2 明言"run: null = 断言实现归 PR8 正式轮"）。
- 判定：**公开 seam 足**（工具面+facade 均在 master；无上游缺项；G-d=流程集成确认非裁决非 seam 缺口）。
- 步骤：① 实现 `registry.mjs` suite `00-guard-dispatch` 的 `run`（team_* ↔ facade 映射 per-agent 装填断言 + SD-GUARD 负控，参照 a5w5 kit 行形）；② G-d 各 lane 集成确认签认（`dev/agent-workflow/PENDING-GATES.md`；ALPHA5-ACCEPTANCE-STATUS.md:24）；③ 行级断言挂 pr8 runner 复跑。
- 量：小～中（1 套件实现 + 集成确认会话）。Owner：**GLUE owner**（IF-5 共享文件：live registry，`dev/agent-workflow/evidence/alpha5/WIRING-PHASE-PLAN.md` IF-5）+ 各 lane owner（G-d）。

### C-02 · Team SessionEvent 词汇 → **A（无差距边界行）**
- 原文：checklist:12。复验：G2 丢弃决策 = `docs/migration/legacy-behavior-inventory.md:17`；红线2 = `docs/migration/reuse-map.md:156`；机检 = `dev/agent-workflow/evidence/alpha5/pr8/runner/lib.mjs:358-365`（`runP4t6ReadonlyScan` + QUARANTINE 集仅 2 个 contracts 隔离文件，亲读）。
- 判定：非"未实现"，是**有意丢弃且机检在场**；无需派工。维持：任何改动 p4t6 账本即触红（pay-the-tie 惯例 `dev/agent-workflow/evidence/alpha5/wiring/WIRING-SURFACE.md:18`）。

### C-03 · 运行时身份 → **A（无差距）**
- 原文：checklist:13。复验：G1 错误假设 = `legacy-behavior-inventory.md:16`；三分身份落面 = `packages/contracts/src/ids/session-id.ts`、`packages/contracts/src/projection/member.ts` 等（childSessionId/instanceId 亲 grep 命中，非 dist）。
- 判定：D+重写完成，无差距，无需派工。
- 注（引用勘正，见 §2-U1）：checklist 证据格引 `INTERFACES-v1 C-GW/C-BIND`——该**正本不在本分支**（`wiring/WIRING-SURFACE.md:21` 明载"正本在主检出=协调者持有"；分支仅跟踪 `wiring/INTERFACES-v1.1-ERRATUM.md`）。结论不因引文受影响（身份三分以 contracts 亲验），但后续引用请改指分支内件。

### C-04 · M-04 str_replace_editor → **A（可派工；附 B 依赖披露）**
- 原文：checklist:14。复验：vNext 树实现面 0（本 reviewer 亲跑 `grep -rl str_replace_editor packages --include=*.ts` 非 dist = **0 命中**）；常量钉 `ARBITRARY_TREE_PROFILE_PUBLISHED = false` = `packages/runtime/controlled-fs/src/admission-binding.ts:146`（亲读，其上注记：翻转需 openat2 native helper **且** PR8 发布轮）；缺腿点名 = `pr8/matrix-machine.json` M-04 `transition_record.missing_legs`（editor_subcommand_map_complete / undo_history_io / editor 子命令级 IO_POLICY_UNSUPPORTED 负控）；S0 候选态 = `pr8-accept/acceptance-matrix.json` M-04 `current_status=s0-candidate-impl-pending`。
- 判定：**A**。断言/kit 腿全部在自有装配面（W5 admission 门控工具面 + W4 执行腿，IF-1 plugin row + 公开 barrel），无上游 seam 缺项。
- 步骤：① 在 W5 装配面（`evidence/alpha5/wiring/w5/a5w5-assembly-row.mjs` 同格）加 editor 子命令 I/O 映射 kit row + undo 历史 I/O 腿 + typed 默认拒负控（判据原文 = matrix M-04 `criterion`）；② 产 receipt → 复跑 `pr8/probes/probe-M-04.mjs` 走 LIVE 通道；③ registry suite `20-controlled-fs` 对应 run 实现（GLUE 队列）。
- 量：中（三腿 kit + receipt 闭环）。Owner：**wire/kit writer（W5/W8 同型）+ GLUE owner（registry）**。
- **B 依赖（不阻塞上述派工，但限制宣称）**："任意树 profile 是否永久窄化" = 用户裁决项（备选=落地 OpenAtPort native helper），见 `dev/agent-workflow/evidence/alpha5/ALPHA5-ACCEPTANCE-STATUS.md:79`（"PR3 OpenAtPort（或永久窄 Profile 裁定）"在 final_declaration 缺项最小集）。裁决问题：*"str_replace_editor 族是等待 openat2 native helper 后发布 arbitrary-tree Supported，还是裁定永久窄 Profile（放弃该宣称）？"* 未裁前 editor 行可在窄 Profile 下装配+验收。

### C-05 · M-05 read_image → **A**
- 原文：checklist:15。复验：名字仅名字面在场 = `packages/domain/blueprint/src/schema.ts`、`packages/domain/authority-envelope/src/authority-envelope.ts`（亲 grep；**勘正注**：另有 `packages/runtime/operation-permission/types.ts:34,:56,:61` 与 `packages/runtime/permission-lifecycle/decision-lane.ts:28`（注释）命中，均为封闭字段集/词表非治理消费实现——checklist"无治理消费实现"结论成立，证据格列举偏窄）；缺腿点名 = matrix M-05 `missing_legs`（image_read.chain=admission-gated-controlled-fs / thumbnail-read-bypass typed-deny / admission-unbound bytes_leaked=0）；registry `20-controlled-fs run:null` = `registry.mjs:25`。
- 步骤：① read_image 附件→解码→渲染链装配 row（W5 admission 面）+ 缩略图旁路负控 + admission-unbound live 负控；② receipt → 复跑 `probe-M-05.mjs`；③ registry suite 20 同项（与 C-04 同批改）。
- 量：中。Owner：同 C-04。B 依赖同 C-04（同一 OpenAtPort 宣称线，`ALPHA5-ACCEPTANCE-STATUS.md:50` 同文点名）。

### C-06 · M-08 run_code(PTC) → **A**
- 原文：checklist:16。复验：`HARD_PROFILE_ENABLED = false` = `packages/runtime/sandbox-provider/realm-evidence.ts:45`（亲读）；OS 负控腿已闭合 = matrix M-08 `live_legs_booked`（A2 W4-DOMAIN-DENY EACCES rc=1 leaked=false；A3 启动前拒 spawn_count=0）+ `pr8/probes/runs/w8-probe-M-08.log`；缺 = `missing_legs`（execution.inner_reentry_same_pipeline / transport_same_name_both_sides_throw）；seam 可行性 = `pr6/SEAM-VERDICTS.md:28-33`（A4 around-listener+ALS+PtcRuntime 替换组合公开 seam = SUPPORT；:33 明言"启用 Strict 仍需 PR4 ConfinedProcessProvider 外层 OS 强制，本腿 NOT_RUN"）；装配路径存在 = 同文 :43（ptc-runtime-node 消费 PR4 ConfinedArgv）。
- 判定：**A**——两缺腿均为自有装配 row + 断言，公开 seam 已被 PoC6a 证可组合；provider 生产 glue 在 GLUE 队列（`agent-bindings.mjs` 对 createConfinedProcessProvider/sandbox-provider 引用 = **0**，本 reviewer 亲 grep）。
- 步骤：① PTC 管线装配 row：内层复入逐次 Guard 断言（沿 W4 装配面 `evidence/alpha5/w4/a5w4-provider-row.mjs` 行形）；② 保留传输同名双侧 throw 断言（PTC/PR8 面，matrix M-08 `note`）；③ `packages/runtime/src/plugin/live/agent-bindings.mjs` 接 provider spawn 生产行（GLUE 独占）。
- 量：中。Owner：**runtime implementer + GLUE owner**。Strict 启用姿态无需新裁决（S0 §9 中间分支判定已落文，`pr6/SEAM-VERDICTS.md:85`）。

### C-07 · M-09 lsp → **C（CORE_SEAM_BLOCKER 级）**，附可派工子腿
- 原文：checklist:17。复验：`pr6/SEAM-VERDICTS.md:58-60`（**B4 = SEAM-GAP（上游）**：池键无策略输入通道、无 generation 逐出钩子、spawn spec 无 per-policy 约束参数；realm = 公开面可表达**最细**粒度；"严禁共享池改名复用冒充隔离"）；机检在册 = matrix M-09 `missing_legs[pool.policy_change_old_pid_terminated_recreated]` 括注"公开面无策略输入通道 pr6/SEAM-VERDICTS.md:59，矩阵 note 预设恒 PROBE-GATED"；S0 姿态 = M-09 `criterion`（"Strict deny 兜底未实现为机检拒装面；S0 不批准上游方案 §5 D-1"）+ `carried_current_status=s0-bounded-defer`。
- **最小复现（已有，直接可引）**：`dev/agent-workflow/evidence/alpha5/pr6/` `node p6b-runner.mjs`（EXIT=0，10 legs，`SEAM-VERDICTS.md:7` 复现行）——B1 腿 = 同 workspace 两策略主体 → 同一常驻 pid + 共享 server 侧 didOpen 账本（`p6b-result.json`）；Host = 0.2.0-rc.2 @`639ed01539`（porcelain 0，SEAM-VERDICTS.md:4）。
- CORE_SEAM_BLOCKER 要素（按 ROUTER_RULES §5.1 固定格式字段归纳）：seam 名=LSP 池键策略输入/policyGeneration 逐出钩子/spawn spec per-policy 参数；Host SHA=`639ed015397290b3745d163aafe4aa3f84`；Required behavior=池键 ⊇ Member+Realm+Provider+Workspace+**PolicyGeneration** 且代际变更强制逐出；Observed public behavior=池键纯路径、realm 最细、无逐出钩子（B1/B4）；无既有 public composition path=B4 实测（realm 以下无输入面）+ B2 明示池隐私来自 per-realm provider 实例而非池键变宽；Affected=M-09 行 LIVE 通道（矩阵 note 预设恒 PROBE-GATED）。**处置=该腿停 BLOCKED，不派工、不 patch upstream。**
- 可派工子腿（A 性质，与本行 C 裁决并列在册）：A1 per-Member realm 装配（`SEAM-VERDICTS.md:50-56` B2/B3 = SUPPORT，PoC6b 主问=通过）——按"每 member 一 realm"条件装配 lsp 服务池 + per-member pid 观测 row。Owner：wire writer。
- 不确定（见 §2-U2）：A3"服务器 OS 读中介"——matrix M-09 `depends_on` 把它挂在 W4 provider 装配面上，但 B4 记录"server 进程 OS 读不受 ctx.fs/沙箱中介、spawn spec 无 per-policy 约束参数"（P0-5 L4/L6 沿用）。两处口径冲突，**无法从现有在册判定该腿属装配可达还是同属上游缺**；按"禁猜"挂不确定，需 PoC 补腿证实。

### C-08 · M-13 Domain → **A**
- 原文：checklist:18。复验：jobs-gateway DORMANT 题注 = `packages/runtime/jobs-gateway/README.md:1,:9`（亲读）；live 装配已落 = `pr8/probes/runs/w8-w7-green/summary.json`（host @639ed01539、anchor pre/post hits=0、世界即删；亲读头段）；tsconfig 未接 = `wiring/WIRING-SURFACE.md:34`（"jobs-gateway tsconfig……F 不在本轮接线清单"）；缺腿 = matrix M-13 `missing_legs`（veto_matrix / veto_side_effects=0 / unresolved-domain-reference 负控，皆"Domain mock 未建"）+ registry `60-web-jobs-mcp-domain run:null` = `registry.mjs:61`。
- 判定：**A**——全部为 vNext 自有面（Domain 是 vNext 原生化对象模型，无 upstream 对应物，无 seam 缺项）。
- 步骤：① 建 Domain mock（CAS/模拟设备联锁，doc evidence_types 标"待建"；建议落 `tests/kits/` 或 `packages/testkit`，从 `tests/paths.mjs` 取路径）；② W7 装配面之上加 veto 三腿 kit row + receipt；③ GLUE：`packages/runtime/tsconfig*.json` include jobs-gateway（GLUE-1 先例=GLUE 队列在册项）+ registry suite 60 run 实现。
- 量：中～大（mock 新建为大头）。Owner：**kit/characterization writer（mock+三腿）+ GLUE owner（tsconfig/registry）**。

### C-09 · jobs pinned-host 面 → **A（无差距）**
- 原文：checklist:19。复验：absent-anchor 机检行 = `pr8-accept/acceptance-matrix.json:64`（M-11 notes"pinned 面仅 output/list/kill 无 job_start"）+ `pr8/matrix-machine.json:735`（absent anchor `job_start`）+ 复测在册 = `pr8/probes/receipts/M-13.receipt.json:15`（`job_start_present: false`）与 w8-w7-green anchor pre/post hits=0；本 reviewer 全树 grep：非注记性 `job_start` 实现命中 = 0。
- 判定：非缺件（pinned 版本本无此面），无需派工；维持机检行。操作注意：该腿在无构建运行时的新 worktree 判 NOT_RUN fail-closed（`ALPHA5-ACCEPTANCE-STATUS.md:44`）——复跑需带构建运行时环境（TEST_METHODS §2 链），属环境要求非差距。

### C-10 · OS 强制/provider 装配 → **A（附不确定子项）**
- 原文：checklist:20。复验：ENFORCE=fixture/子进程级判定 = `ALPHA5-ACCEPTANCE-STATUS.md:35`；spawn 未装配 = 同文 :37 + `wiring/WIRING-SURFACE.md:31`（agent-bindings 本轮零改动）+ 本 reviewer 亲 grep `packages/runtime/src/plugin/live/agent-bindings.mjs` 对 `createConfinedProcessProvider|sandbox-provider` = **0 引用**；kit 级真装配证据 = `pr8/probes/runs/w8-w4-pos/criteria.json`（在场，亲验文件）；三缺项在册 = `ALPHA5-ACCEPTANCE-STATUS.md:58`。
- 步骤：① 生产 glue：agent-bindings 接 provider spawn 行（GLUE 独占，IF-1 模式 = plugin row + 公开 barrel；正/负控判据已随 W4 kit 定型可直接复用）；② ENFORCE-PARTIAL 缺项 (1) OS 强制面随 ①+PR4 装配收敛；③ 缺项 (2)(3) 按"独立后续项"另卡（`ALPHA5-ACCEPTANCE-STATUS.md:58` 明言非 G-g 门槛）。
- 量：中（glue 小，负控复用 kit 判据）。Owner：**GLUE owner（agent-bindings）+ wire writer（判据行）**。
- 不确定（见 §2-U3）：三缺项之 (2) "trusted 输入 fixture-grade——trustedIdentities/nativeNames 非 OS 锚定"是否可在现公开 seam 内做到 OS 锚定，在册证据未证；派工前需一次 bounded PoC 定 A/升级。

### C-11 · search/shell → **A（小）**
- 原文：checklist:21。复验：Lane-D 三门 GREEN=lane 源级 = `wiring/WIRING-SURFACE.md:24-28`；不入 root vitest/emit/live registry = 同文 :17（a5p5 例外披露）+ :31；真实调用观测已落 = `pr8/probes/runs/w8-w5-gated/criteria.json`（在场）；口径"对 fixture 验证不宣称整链" = `ALPHA5-ACCEPTANCE-STATUS.md:41`。
- 步骤：GLUE/PR8-build 队列既定项（`pr8/matrix-machine.json` 各行 `anchor_contract` 尾句"runtime tsconfig include / registry run≠null 为 GLUE/PR8-build 后续工作项（review-W8prep F-6 披露）"）：a5p5 入 root vitest + tsconfig emit + registry 对应 suite run + `a5p5-dormant-audit` 同步放行（`WIRING-SURFACE.md:17` 已披露二者须同轮）。
- 量：小。Owner：**GLUE owner**（IF-5 全部为其持有文件）。真 Host "无未受限 rg/bash body" 门（`plan:134`，`ALPHA5-ACCEPTANCE-STATUS.md:41`）为装配后验收腿，同轮带上。

### C-12 · 取消/静默通道 → **B**
- 原文：checklist:22。复验：Body 实跑 = `dev/agent-workflow/evidence/alpha5-pr1r/g-g-probes/GATE-VERDICT.md:42`（`issued=0 cancelled=0`，非 fail-closed；行号亲验）；两维分判 = 同文 :46-48；受限支持上限+三缺项 = `ALPHA5-ACCEPTANCE-STATUS.md:58-59`；支持要求原文 = plan:21/plan:175（同文 :71 F2 引用并判"✗ 按原文只能落 UNSUPPORTED"）；措辞禁已代码化 = `scripts/lint-g-g-wording.mjs` 常跑（同文 :59）。
- 判定：缺的不是代码通道（协作式取消+响亮告警已 LIVE-CONFIRMED），而是**该类保证的 shipped 支持语义**未定——纯产品边界，归用户。
- **裁决问题（一句话）**：*"Alpha.5 对取消/静默通道的发布语义，按哪种口径收口？"*
  - **(a)** 接受受限支持为产品边界：协作式取消+响亮告警（ENFORCE-PARTIAL），永不作投递/取消/静默安全保证宣称（现状，措辞 lint 已代码化；行可按"UNSUPPORTED for 保证类宣称"落 final_declaration）；
  - **(b)** 要求先补齐 plan:175 姿态：实现"已订阅但永不投递"配置的**启动前确实拒绝**（team 侧装配期可检，属 A 工作量，随 PR1/装配轮另卡），再收口；
  - **(c)** 要求硬保证（OS 级取消/不投递保证）：触 **D-1** 上游缺——`bodyInvoked` 固定 Host 私有（`packages/core/tools/src/index.ts:1580`），三候选上游最小条件（per-call pre-body 事件 / 公开读点 / resolution-pinned Definition）在册**未选型**（`dev/agent-workflow/PENDING-GATES.md` D-1 块，恢复三件套见同块）＝该路线含 **C 面**，升级需按 CORE_SEAM_BLOCKER 固定格式走。
- 派工边界：裁决前仅 (a) 现状维持可继续；(b)/(c) 不得自行开工（(b) 亦不得由 worker 代裁）。

### C-13 · UI/投影/冷恢复 P 系列 → **A（无差距完整性行）**
- 原文：checklist:23。复验：`docs/migration/reuse-map.md:64-115`（亲验节界：§1.6 投影标题=:64、§1.7=:73、§1.8 客户端 UI=:84、§1.9 工作区耦合=:106、§1.10 标题=:115——引用范围恰覆盖 §1.6–§1.9 止于 §1.10 前，自洽）；"P 系列已落、正交"口径无冲突证据。本 reviewer 未复审 P 系列实现（checklist 自行声明不复审，与本件口径一致）。无需派工；W8 五行不依赖此行（checklist:23 原文）。

---

## 2. 不确定登记（禁猜，逐条给原因）

- **U1（C-03 引用勘正）**：`INTERFACES-v1.md` 正本不在分支（`wiring/WIRING-SURFACE.md:21` 明载协调者持有；分支仅跟踪 `INTERFACES-v1.1-ERRATUM.md`）。checklist 该格引文无法在本基线逐字复验；结论改以 `packages/contracts` 亲验支撑。**影响：仅引文形状，不改分类。**
- **U2（C-07 之 A3 腿）**："服务器 OS 读中介"在 matrix M-09 `depends_on`（视为 W4 装配可达）与 `SEAM-VERDICTS.md:59`（spawn spec 无 per-policy 参数、不受 ctx.fs 中介）之间口径冲突；在册无第三方证据裁哪边对。**处理：不分类该腿（随 C-07 行整体已判 C），建议补一 bounded PoC 腿（复用 p6b 夹具 + W4 provider 对照）后再定其归属。**
- **U3（C-10 之三缺项(2)）**：trusted 输入 OS 锚定的公开 seam 可行性无在册证据。**处理：派工时拆独立 bounded PoC，不并入 glue 承诺。**

## 3. 跨行 B 依赖登记（供排产，不与行级分类计数重复）

1. **OpenAtPort vs 永久窄 Profile**（限 C-04/C-05 的"任意树 Supported"宣称线，不阻塞其窄 Profile 装配派工）：问题见 C-04 格；权威在册 = `ALPHA5-ACCEPTANCE-STATUS.md:79`。
2. **D-1 三候选选型**：仅当 C-12 走 (c) 或取消语义硬需求出现时激活；在册 `PENDING-GATES.md` D-1 块（owner=d9da2f74 已指派，"待集成 owner 提名→用户确认"）。
3. **G-e（原 G1/G3/G7/YAML）**：既有用户待裁项（`PENDING-GATES.md:18`），非本 13 行产生，但位列 final_declaration 缺项最小集（`ALPHA5-ACCEPTANCE-STATUS.md:79`），排产收口轮须一并不需要新造问题。

## 4. 方法与边界声明

- 本件 reviewer 独立于 W8 writer；只读 + 本文件新增；分类只读对照，不触 matrix/registry（行级转态仍只走 matrix `pending_probe` + runner 双代码位，IF-7）。
- 所有行号以 `master@aece4f21` 工作树为准；`grep`/`sed`/`python` 只读复跑清单：registry run:null×3、str_replace_editor=0、job_start 实现命中=0、read_image 全命中集、tools.ts:10-14、admission-binding.ts:146、realm-evidence.ts:45、jobs-gateway README:1/9、SEAM-VERDICTS:28-33/43/58-60/85、GATE-VERDICT:42/46-48、matrix M-04/05/08/09/11/13 全字段、w8-probe-M-09.log、w8-w7-green/summary.json、reuse-map:52-63/64-68/153-162、inventory:16-17、D-1 块（PENDING-GATES.md:24-42）、WIRING-SURFACE 全文、agent-bindings 引用=0。

— writer/reviewer = alpha5-gap-classify（qwen3.8-flash-next；只读+本文件新增；零端口、零世界、:3080 未触碰）
