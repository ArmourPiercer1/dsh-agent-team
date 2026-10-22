# ALPHA.5 阶段验收清单（ALPHA5-ACCEPTANCE-STATUS）
> **[2026-10-22 banner] historical / superseded-by `docs/plans/active/alpha5-tool-io-governance/current-execution-plan.md`** — 本文件"当前态"字段与 merge 指针按记录时点已过期；有效待办唯一入口=`docs/plans/active/alpha5-tool-io-governance/ALPHA5-EFFECTIVE-BACKLOG.md`。历史台账正本地位、红线、裁决原文与设计约束**仍有效**；正文未改动。

- 基线 = `origin/master @ d5fda5df`（ls-remote 亲验；PR#274 **未合**——`76b08372` 仅为 `alpha5-g-g-landing` tip 的行文刷新）。计划正本 = `docs/plans/memo/alpha5-tool-io-governance/alpha5-s0-pr0-pr8-implementation-plan.md`（下称 plan）+ `post-poc-technical-design.md`（下称 design）。台账正本 = `dev/agent-workflow/PENDING-GATES.md`（下称 PG）。
- 四类口径：**DONE**（合并+计划该阶段自身证据门）/ **MERGED-NOT-WIRED (DORMANT)** / **WIRED-NOT-PRODUCTION-ACCEPTED** / **DEFERRED·UNSUPPORTED**（含原计划支持要求未满足的精确边界）。不确定 = OPEN 不猜。writer=qwen3.8-flash-next，只读+本文件新增；机检复跑（只读、零端口）：`PASS=24/FAIL=0/NOT_RUN=3/RLW=5`，与折叠轮在册原文一致（`pr8/runner/runs/fold-doc-matrix-negative-run.log`；27/0/0/5 系自带构建运行时的正式轮 worktree，`pr8/README.md:49`）。

## 1. 逐条判定（PR/子交付 × 四类）

| 项 | 判定 | 证据（merge SHA / run / file:行，≤2行） |
|---|---|---|
| S0 选型矩阵 | **DONE**（文档阶段自身门） | `e89cf2b8`(#251)；总状态固定 `P0 NOT CLOSED / 非产品 GO`（`S0-SELECTION-MATRIX.md:3`）；12 NEG/supersession 表在册 |
| PR0 纯契约 | **DONE**（验收=零生产行为变化，按计划 §3 `plan:62`） | `abda8dbd`(#254)；review PASS 0B/0M（`pr0/review-PR0.md:8`）；DORMANT 复核 shipped 零 import（同文 :46） |
| PR1 Guard+Dispatcher | **WIRED-NOT-PRODUCTION-ACCEPTED** | `db5cb5f7`(#255, FAIL→delta PASS `pr1/review-PR1-delta.md:7`)；生产装配已接：`packages/runtime/src/plugin/live/agent-bindings.mjs:433/:2261/:2489`（guard per-agent 装填、发布失败拒发 Agent）；整链验收未发（G-d 开放 + ENFORCE-PARTIAL，见 §2-⑤） |
| PR1r 残余边界 | **DONE**（17:52Z 用户裁决落地+落文） | `452a04c0`(#257) + `18f53c99`(#258)；裁决原文 PG:14；B1/B2 阻断（`pr1r/review-PR1r.md:14-15`）由裁决+D-1 拆分处置；D-1 单列 DEFERRED（§2-⑥） |
| PR2 Admission+Grant | **MERGED-NOT-WIRED (DORMANT)**（已进编译面） | `ae3dcf54`(#256)；review PASS（`pr2/review-PR2-final.md`）；生产 glue 无 importer（agent-bindings 仅 import tool-dispatch）；一次性消费/one-shot 已有**测试侧活体**证明（live s1s2，`live/README.md:25-30`，非产品装配） |
| PR3 ControlledFs | **MERGED-NOT-WIRED (DORMANT)**（编译面+root vitest 已接；live 仅测试侧切片） | `74d947a3`(#259)；`vitest.config.ts:23` 入 root；PoC3 A/B/B2/C/D/E 全 PASS（fixture/子进程级，`pr3/POC3-RESULTS.md`）；`createAdmissionGatedControlledFs` 活体读经测试 plugin row（`live/README.md:22-24`）；OpenAtPort 未落 ⇒ arbitrary-tree profile 恒禁发布（`wiring/WIRING-SURFACE.md:14`） |
| PR4 OS Provider | **MERGED-NOT-WIRED (DORMANT)** + 内置 UNSUPPORTED 子项（§2-①） | `2cd5185f`(#264)；PoC4 六腿 ENFORCE-CONFIRMED=fixture/子进程级（`pr4/lane-c-notes.md:22-33`）；装配=tsconfig+barrel 工厂 only，spawn 路径零 live 消费者（`wiring/WIRING-SURFACE.md:31`） |
| PR5 search/shell | **MERGED-NOT-WIRED (DORMANT)**（三门修后仍 DORMANT，§2-②） | `d69bfc4b`(#260)；Lane-D 三门全 GREEN=lane 源级（`wiring/WIRING-SURFACE.md:24-28`）；lane 不入 root vitest（`vitest.config.ts:17`）；未进任何 live 面 |
| PR6 PTC/LSP | **DEFERRED/UNSUPPORTED**（evidence-only 已合） | `6ce62c25`(#261)；PoC6a=中间分支（窄固定策略；Strict 启用需 PR4 OS 强制=未装配，`pr6/SEAM-VERDICTS.md:33/:85`）；PoC6b=主问通过但 policyGeneration 逐出缺口+服务器 OS 读未中介 ⇒ Strict LSP 维持拒（同文 :59/:85） |
| PR7 Jobs/Web/MCP/Domain | **MERGED-NOT-WIRED (DORMANT)**（连编译面都未接） | `fc9f4a07`(#262) 题注 DORMANT；tsconfig include 未落（`wiring/WIRING-SURFACE.md:34`）；lane 32/32+4 RED 探针（`pr7/RED-GREEN-20261016.md`）；review=G-d 可/投机通过（`pr7/review-LaneF.md:69`） |
| PR8 矩阵+runner | **DONE**（机检设施）；行级验收=DEFERRED | `3b2c23c5`(#266)+`46a406b9`(#267)+`11d3374a`(#263)+`f1697829`(#272)；32 行双向 1:1、`final_declaration` 恒 null（`pr8/README.md:12`）；27 PASS 全为 **fixture/记录级 D**，反升格声明在册（`pr8/runner/runs/final-matrix-run.human.log` 尾段）；行验收解锁三闸未满足（`pr8/README.md:41`） |
| 接线轮（compile-plane） | **DONE**（阶段自身门；零验收宣称） | `9e75ee83`(#268)；NEW=0、p4t6 清偿、census pass（`wiring/FINAL-GATES.txt`）；性质=接线准备非 live（`wiring/WIRING-SURFACE.md:5`） |
| Live 轮（G-6/G-7/PR3 切片） | **DONE**（证据级 LIVE-CONFIRMED，上限 ENFORCE-PARTIAL） | `0e0b605a`(#269)；19/19×2+18/18+18/18，独立复跑+ACCEPT（`live/review-LiveRound.md:5/:17`）；三缺项原样在册（`live/README.md:60-67`，见 §2-⑤） |
| G-a 取消语义 | **DONE**（裁决+落文+证据闭环；其行面关闭字面更新挂 PR#274） | PG:14（17:52Z 裁决原文+边界）；支持契约 `ced9254c`(#265)+live `0e0b605a`；G-6 计分项挂 G-d 不随本行（GATE-VERDICT §2） |
| G-d 集成确认 | **OPEN**（未开始） | PG:17；各 lane review 判"G-d 集成会话可（投机通过+条件）"（LaneC :51/LaneD :39/LaneF :69/LaneG :6）≠已确认；G-6 计分项挂此行（GATE-VERDICT §2） |
| G-b/G-c | **OPEN**（修复中） | PG:15/:16（PR257 三事实修法 / PR256 F-1 F-2 修复+新 head 复核后才谈 #256） |
| G-g 静默通道排除门 | **证据门 CLOSED ≠ 产品支持** ⇒ 该配置按原计划支持要求 = **UNSUPPORTED（受限支持上限 LIVE-CONFIRMED/ENFORCE-PARTIAL）**，精确边界见 §2-⑤ | `d5fda5df`(#273)；GATE-VERDICT 8 closed/1 partial（`g-g-probes/GATE-VERDICT.md:23/:65-67`）；三缺项原样（同文 §3=README:60-67） |
| G-e 旧 G1/G3/G7/YAML | **OPEN = 用户待裁项**（不默认旧提案） | PG:18 |
| D-1 NO-ABORT-AFTER-BODY-START | **DEFERRED（有主，非放弃）** | PG:24 owner=d9da2f74；PG:29-42（延期原因=Host `bodyInvoked` 私有 @`packages/core/tools/src/index.ts:1580`；恢复条件+回归三件套在册） |
| D-2 skills 对齐 | **DONE**（执行+独立终验 9/9） | `d6b57e55`(#270)+终验 `420ed3ee`(#271)；PG:27 |
| PR#274 行文刷新轮 | **OPEN**（分支 `alpha5-g-g-landing` @`76b08372` 未合） | 内容=G-a/G-c/G-d 行刷新至 merge ground truth；lint 716md/0；本清单不代关 |
| LSP 生产装配（真实语言服务器最小交互） | **ACCEPTED-VERIFIED**（真实语言服务器最小交互维度=**真服务器经 P-LSP 生产面跑通**：clangd **18.1.3**（真 LSP：`initialize`→31 capability keys+`serverInfo`+clangd 专有 `executeCommandProvider`；真 `definition`/`documentSymbol`；LSP `shutdown`+`exit`→自发退出 code 0→`/proc` pid 消失→租约 `terminated`）+ typescript **6.0.3 tsserver**（官方 stdio JSON 面：真 `definition`+`completionInfo` 1042 项，跨 member 双服务器双 pid 隔离腿）；**限定 realm 粒度**（per member×策略代际 own realm+own confined OS process），`wiring/real-lsp/README.md` 披露项**全量保留**（clangd 本环境 hover 10s 无应答/completion 空列表→原文记录不计判据；tsserver 无 LSP 模式故不承载 initialize/shutdown 判据；无网络零安装）。**非族级 GO、非 Strict-LSP 产品支持、非本清单四类口径词表项**——其四类映射见右列装配依赖 | 证据 `wiring/real-lsp/`（README 判据台账 + `runs/2026-10-17T10-48-19-580Z` 与复现 `runs/2026-10-17T10-50-20-653Z`，30/30×2 EXIT=0，跑在**已提交 emit** 上）；**测量基线（现行）= `master@77ffb187`（#304 R-1/R-2 已合）经 `b5c06f09` 并入本支（其上含 #307 `eb56f805`）／本支 head `1d0d03d0`**：合并后生产面复测两跑 **30/30 ×2**（`runs/2026-10-17T11-30-28-891Z` + `runs/2026-10-17T11-31-16-782Z`，EXIT=0；机读记录 `runs/retest-merged-face.json`），且复测面与旧基线**逐字节同**（`lsp-assembly.ts 8f396feb…`／`provider.ts cdadeed5…`／launcher `e66a8cf7…`＋两 dist `5705c33b…`／`34ca58b3…` sha 全 SAME）⇒ 复测证明的是「**已合 master 的产物确实跑得起真服务器交互**」，不是「改动后仍跑」；**历史基线行（旧测量原文不动）**= 原 30/30×2（`runs/2026-10-17T10-48-19-580Z` + `10-50-20-653Z`）测于 **#304 分支 `alpha5-prod-lsp` @ `7962022e`**（当时 master 尚无 `lsp-assembly`；README 原「Baseline / prerequisite」节保留为历史并注明已消）；GLUE 去重**已完成** = `1d0d03d0`（原 PENDING 行→DEDUPLICATED→本行）。**族级 GO 仍不宣称**。 |
| LSP 生产装配（prod-lsp 轮，R-1/R-2） | **DEDUPLICATED → 上行 ACCEPTED-VERIFIED**（原 PENDING 缺项行；阻塞条件已由真实服务器测量满足；测量基线钉见上行与 § 注） | 现证据=REAL-Landlock 下 provider/assembly seam 全绿 + 独立 review PASS（`prod-lsp/README.md` 12 判据表；reviewer kit 53/53 @`1e76cd2c`）——**payload 是 fixture，只证 seam，不证任何真实语言服务器交互/编辑器产品行为**（措辞红线在册）；真实语言服务器最小交互（真 LSP server 进程 over 同一 confined stream seam：initialize→didOpen→语义请求→policyChange 存续）= **未做，待人工/后续轮验收**；本行未闭合前 LSP 面禁族级 GO 宣称 |

## 2. 用户点名覆盖

### ① PR4 OS provider：Landlock 强制面现状 + spawn 装配
- 实测面（本宿主 Linux 6.8.0-142-generic、非 root、harness bwrap 内）：ABI **v4 available**（裸 syscall GET_VERSION rc=4/errno=0）；selective/denyall 两鉴别器 **ENFORCE-CONFIRMED**（新 open 全 EACCES）、fork+exec 继承、fd-close-all-undeclared **CONFIRMED**、confined-exec 零泄漏——但判定层级明文 = **fixture/子进程级 OS_ENFORCED**（规则由 lane 代码编译），真实 runtime 集成属装配阶段（`pr4/lane-c-notes.md:20-33`）。
- 原计划支持要求未满足的精确边界（fail-closed 姿态已代码化，能力本身未获）：**严格 metadata 隔离**不主张——`directory-metadata` 恒 unsupported，仅发布内容读写窄子能力（PoC-4a 分支二，`pr4/lane-c-notes.md:54`）；**network:deny/restricted** 恒 spawn 前 `IO_POLICY_UNSUPPORTED`，TCP-bits≠无网络（PoC-4b，`lane-c-notes.md:13/:54`）；**PoC-4c PTY/Managed-Range 全保真**未证，归 PR5 装配轮（`lane-c-notes.md:55`）；`HARD_PROFILE_ENABLED=false`（realm 证据面负控 only）。无 unconfined 回退是构造性的（`pr4/review-LaneC.md:31`）。
- **spawn 路径装配状态 = 未装配**：`createConfinedProcessProvider` 仅编译面+barrel 工厂导出，provider spawn 路径保持显式调用，agent-bindings 零改动（`wiring/WIRING-SURFACE.md:31`）；audit 消费者集零新增（`wiring/FINAL-GATES.txt`）。ENFORCE-PARTIAL 三缺项（§2-⑤）同样约束任何 OS 宣称。

### ② PR5 search/shell：三门修后状态
- **仍 DORMANT，未进任何 live 面**。三门（①六事件名全前缀 ②openSink 复用拒 `spill-id-in-use` ③render outputMode 闭集）在 lane 源上 RED→GREEN（`wiring/WIRING-SURFACE.md:26-28`，Lane-D 修复 68/68），但 a5p5-tools 不入 root vitest、不入 tsconfig emit、不入 live registry（`vitest.config.ts:17`、`WIRING-SURFACE.md:31`）；live 轮 fixtures 仅 import controlled-fs/tool-admission/tool-dispatch/domain 四路，无 a5p5（`live/README.md:12`、`live/*.mjs` 零 a5p5 引用）。
- spill/parity 判定口径=**对 fixture 验证，不宣称整链**（`pr5/note-phase2.md:29`）；host 验收=后续切片（未做）；"无未受限 rg/bash body"的真 Host 门（`plan:134`）未跑。

### ③ PR7 jobs：pinned absent-anchor + adapters 状态
- pinned host（0.2.0-rc.2）Job 模型面 = 仅 `job_output`/`job_kill`（tool-bash）+ `job_list`（api/job-controller）；**absent-anchor `job_start` 全树 grep 零命中**为机检行（M-11/SUP-08，`pr8/matrix-machine.json:487/:867`；reviewer 亲跑 0 命中 `pr8/review-PR8-formal-delta.md:29`）；语义源=design:72"不杜撰 job_start"。注意：该腿在无构建运行时的新 worktree 判 NOT_RUN（fail-closed），本环境即此形态。
- adapters（lease 状态机/JobOwner fence/C-BIND 链/vnext 映射）= **DORMANT**：`fc9f4a07` 题注定死；jobs-gateway tsconfig/接线未落（`WIRING-SURFACE.md:34`）；owner-scoped 腿、重启恢复、真实 producer 子进程未测（doc M-11 `untested_carried_over`）。

### ④ PR8 机检矩阵 32 行现状 + 5 个 REQUIRES-LIVE 行
- 32 行 = M-01..M-14（工具族）+ SUP-01..18（supersession），双向 1:1（`pr8/README.md:12`）。当前分布（本树复跑+在册 fold 轮一致）：**PASS=24 / FAIL=0 / NOT_RUN=3（M-06/M-11/SUP-08，缺构建运行时之 fail-closed 腿）/ RLW=5**；正式轮带构建运行时 = **27/0/0/5**。27 PASS 全部 `lvl=D`（fixture/记录级观测：断言网/在册记录/kit 重跑），**非行验收、非整链、非 SUPPORTED**（反升格声明逐 run 尾注；review-LaneG 投机通过条件①，`pr8/review-LaneG.md:6`）。`final_declaration` 全 32 行显式 null（代码位强制：缺键即红+非空即红）。
- **M-04 str_replace_editor**：缺 = G-d 集成确认与 live 装配；子命令级 I/O 映射无任何可挂钩机检断言（判据=不可精确映射者 typed 默认拒）；editor view/insert/delete 全谱+undo 历史 I/O 未测；OpenAtPort 前禁 arbitrary-tree Supported；registry suite 20-controlled-fs run=null。
- **M-05 read_image**：缺 = G-d；03-fs 未测清单**全链**携带；suite 20 run=null；同上 OpenAtPort 边界。
- **M-08 run_code(PTC)**：缺 = Strict Profile 启用需 PoC-6a 之外层的 **OS 强制实证（D3/D5）= PR4 provider 装配**（现 DORMANT）+ G-d；现状仅"窄固定 session-Realm 策略"分支可谈，per-call 精确注入的 OS 拒绝负控未做；G-6/G-7 live 门已关但其计分挂 G-d。
- **M-09 lsp**：缺 = 池键含 policyGeneration 的逐出/重建机制（公开面无策略输入通道，`pr6/SEAM-VERDICTS.md:59`）+ 服务器自身 OS 读走 Confined（未装配）+ G-d；每 Member 独立 pid 已证（PoC6b 主问=通过）不足以转 LIVE。
- **M-13 Domain**：缺 = 整行 `s0-not-run-structural`——registry suite 60-web-jobs-mcp-domain run=null、Domain mock 待建、G-d；veto=0-side-effects 判据无观测面。
- （共性：五行 `lvl=U`、`automatable=false`，runner 对每行输出 LIVE-GATED 依据原文，不产通过性结论。）

### ⑤ G-g 精确措辞（纪律条款）
- **证据门关闭 ≠ 该配置获得产品支持。** 原计划支持要求（`plan:21` UNSUPPORTED=正确拒绝；`plan:175` Unsupported 须运行时**确实拒绝**；design §1.5 无回退律）在"已订阅但永不投递"配置上**未被满足**：G-7 live 实测被移 Body **实跑**（`issued=0 cancelled=0`，`GATE-VERDICT.md:42`）⇒ 机制结局=名级降级+响亮告警+钉到 re-bind，**非 fail-closed、非恰一次暴露**（后者撤回在册）。
- 现状精确边界：**协作式取消 + 响亮告警（LIVE-CONFIRMED，G-6 19/19×2 / G-7 18/18）但非 OS 强制**，等级上限 LIVE-CONFIRMED/**ENFORCE-PARTIAL**，三缺项原样（`live/README.md:60-67` ≡ `GATE-VERDICT.md:34-38`）：(1) **无 OS 强制面**——guard/gated lane 均 in-process，同特权绕过不被 OS 阻断；(2) **trusted 输入 fixture-grade**——trustedIdentities/nativeNames 非 OS 锚定；(3) **取消协作式**——loud posture 证明的是 DETECTION+REPORT。kit/live 判据同受 ENFORCE 天花板；三缺项增强=独立后续项非 G-g 门槛。
- 因此按原计划原始支持要求判：该配置 = **受限支持（维度A proven 可达 / 维度B 响亮告警，分判禁合并，`GATE-VERDICT.md:46-48`）+ 对"投递保证/取消保证/静默安全"类宣称维持 UNSUPPORTED**；**不得用 lint 登记/证据门收口替代产品支持**（措辞禁由 `scripts/lint-g-g-wording.mjs` 常跑执行，715md/0 @`d5fda5df`）。M-06/M-12/M-14 恒"UNSUPPORTED/待证"（`pr8/README.md:21`）。

### ⑥ D-1 / G-e / pinned host 事实
- **D-1**：DEFERRED **有主**（恢复实施 owner=d9da2f74，17:54Z 授权留名，PG:24；PG:26 表行"待集成 owner 提名"由该行覆盖登记，两文并存不抹）。延期根因=固定 Host 上 `bodyInvoked` 私有（`packages/core/tools/src/index.ts:1580`）；恢复条件三候选本轮不选型；回归三件套缺一不得宣布恢复（PG:38-40）。
- **G-e**：**未裁 = 用户决策项**（PG:18，不默认旧提案；本清单不代裁）。
- **pinned host 事实**：DSH Host pin = **0.2.0-rc.2 @ `639ed015397290b3745d163aafe02ffee4aa3f84`**（plan:4；`tests/paths.mjs` 唯一来源；live/GATE-VERDICT 均实证 porcelain=0 复用）；OS=Linux 6.8.0-142-generic、node 24.21.0、非 root、harness bwrap 内；Landlock **ABI4 可用+文件域 OS_ENFORCED**（PoC4），但 **bwrap/mount/netns/uid_map 在本嵌套宿主受阻**（plan:112、design:117——不引申为全平台无能力）；`landlock-run` 缺件对 P1/P2 裸 syscall 路线**非硬阻塞**（`lane-c-notes.md:50`）；`:3080` 稳定实例全程只读探针未触碰。

## 3. final_declaration 条件评估表（计划既定条件 vs 当前）

| # | 计划既定条件（原文行） | 当前满足？ |
|---|---|---|
| F1 | `plan:21` 阶段结果按族判 SUPPORTED（**全证**），不得由一 PR 推他族 GO | ✗ 无任何族达"全证"（S0 明言非产品 GO；矩阵无行解锁） |
| F2 | `plan:175` 所有 Supported 可独立复跑@固定HEAD；所有 Unsupported 运行时**确实拒绝**；P0 fixture 成功不抵 PR8 门 | ✗ 27 PASS 全为 fixture/记录级 D；G-7 证静默配置"确实拒绝"不成立（Body 实跑）⇒ 按原文只能落 UNSUPPORTED |
| F3 | `plan:177` PR8 合并≠人工验收/发布；Alpha.4 收口状态不被偷改 | 未触发（人工阶段验收未做）；Alpha.4 收口未见被改 |
| F4 | `plan:204` DoD·架构：无未治理 body、正/负控+并发+取消/重启**真 Host** 验证 | ✗ 仅 guard/dispatcher+gated-fs 有测试侧 LIVE 证据；PR3/4/5/7 未 live 装配 |
| F5 | `plan:206` DoD·执行：每个 Supported 限制在真实执行边界生效；不支持限制启动前拒绝 | 部分：启动前拒绝姿态已代码化（network/realm）；"每个 Supported"尚不存在 |
| F6 | `plan:209-210` DoD·验证/发布：独立 Reviewer 真实负例复跑+人类阶段验收/产品 Gate 后才可声称 Alpha.5 成果 | ✗ 人工验收未进行 |
| F7 | `design:224` 入 Supported Matrix 七条件（真实 pinned Host 正负控/并发/冷恢复/独立复现…） | ✗ 无行满足（多为 fixture 级或 RLW） |
| F8 | 机检三闸（`pr8/README.md:41`）：①PENDING-GATES 全行 closed ②行经 pending_update 显式登记 ③90-final-matrix-gate 复跑 | ✗ ①G-b/G-c 修复中、G-d 未开始、G-e 未裁；②pending_update 未登记候选值；③分布含 RLW=5 ⇒ 代码位恒 null |

**结论：final_declaration MUST REMAIN NULL。** 缺项（最小集）：G-d 逐 lane 集成确认与 live 装配轮（含 PR4 spawn/PR5 tools/PR7 jobs-gateway 的 tsconfig+registry 接线）→ 5 个 RLW 行各自上表缺项 → PR3 OpenAtPort（或永久窄 Profile 裁定）→ PR6 Strict 启用两缺口 → D-1 恢复三条件之一公开 → PR#274 行文刷新合并 → G-e 用户裁决 → 人工阶段验收/产品 Gate。以上任一未闭合，任何行 `final_declaration` 非 null 即为 runner 判红+违规升格。

## 4. 判定分布（本清单 §1 共 23 行）

DONE=8（S0/PR0/PR1r/PR8设施/接线轮/live轮/G-a/D-2）· MERGED-NOT-WIRED(DORMANT)=5（PR2/PR3/PR4/PR5/PR7）· WIRED-NOT-PRODUCTION-ACCEPTED=1（PR1）· DEFERRED/UNSUPPORTED=2（PR6、G-g 配置边界）· OPEN=5（G-b/G-c、G-d、G-e、PR#274）——其中 G-g 同时受"证据门 CLOSED≠产品支持"条款约束，不随 #273 计入族级 GO。另 **ACCEPTED-VERIFIED=1**（行「LSP 生产装配（真实语言服务器最小交互）」，root 2026-10-17 指示按事实另立口径，**不折进上述四类计数**：其宣称面只覆盖"真实语言服务器最小交互"这一维度，任何 WIRED/DONE 语义都不由本行取得，族级 GO 亦不宣称）· **DEDUPLICATED=1**（行「LSP 生产装配（prod-lsp 轮，R-1/R-2）」=原 PENDING 缺项行，#304 合并后由 `1d0d03d0` 去重指向上行）。

本段之前那版在此处写的「历史注」是**节引**却自称逐字（＝声称失真，独立复测审 ⑤ 判 FAIL）；两条原始分布段的**逐字全文**现列于下块，出处与核法=`git show 1d0d03d0:dev/agent-workflow/evidence/alpha5/ALPHA5-ACCEPTANCE-STATUS.md`。

**历史原文（逐字全文，来源 = `git show 1d0d03d0:dev/agent-workflow/evidence/alpha5/ALPHA5-ACCEPTANCE-STATUS.md` §4 的两条原始分布段；本节上一版把二者写成节引却自称「逐字保留」＝**声称失真**，本轮以全文替换（独立复测审 ⑤ FAIL 的修复），见 `SESSION_ROUTER_LOG.md` 2026-10-17 11:5xZ 条与本轮 commit message。两条原文一字未改；其时效性各由上方注记说明，不构成对本行判据或任何测量的改动。）**

原段①（写于 #304 尚未合入 master 之时；其「仍**未合**」条件现由 `77ffb187` 关闭，其所记测量本身不变）：

```text
DONE=8（S0/PR0/PR1r/PR8设施/接线轮/live轮/G-a/D-2）· MERGED-NOT-WIRED(DORMANT)=5（PR2/PR3/PR4/PR5/PR7）· WIRED-NOT-PRODUCTION-ACCEPTED=1（PR1）· DEFERRED/UNSUPPORTED=2（PR6、G-g 配置边界）· OPEN=5（G-b/G-c、G-d、G-e、PR#274）——其中 G-g 同时受"证据门 CLOSED≠产品支持"条款约束，不随 #273 计入族级 GO。另 **ACCEPTED-VERIFIED=1**（新增行「LSP 生产装配（真实语言服务器最小交互）」，root 2026-10-17 指示按事实另立口径，**不折进上述四类计数**：其宣称面只覆盖"真实语言服务器最小交互"这一维度，所依赖的 R-1/R-2 装配面在 master 仍**未合**（#304 正 rebase），故任何 WIRED/DONE 语义都不由本行取得，族级 GO 亦不宣称）。
```

原段②（#304 分支原段；其「真实语言服务器最小交互未做，现 fixture 仅证 seam」缺项条件已由真实语言服务器测量满足并由 `1d0d03d0` 去重，其原测量记录仍在其证据目录不变）：

```text
DONE=8（S0/PR0/PR1r/PR8设施/接线轮/live轮/G-a/D-2）· MERGED-NOT-WIRED(DORMANT)=5（PR2/PR3/PR4/PR5/PR7）· WIRED-NOT-PRODUCTION-ACCEPTED=1（PR1）· DEFERRED/UNSUPPORTED=2（PR6、G-g 配置边界）· OPEN=5（G-b/G-c、G-d、G-e、PR#274）· PENDING-ACCEPTANCE=1（LSP 生产装配轮：真实语言服务器最小交互未做，现 fixture 仅证 seam）——其中 G-g 同时受"证据门 CLOSED≠产品支持"条款约束，不随 #273 计入族级 GO。
```


— writer=qwen3.8-flash-next（只读+本文件新增；机检复跑仅读+已清除自产 capture；零端口、零世界、:3080 未触碰）
