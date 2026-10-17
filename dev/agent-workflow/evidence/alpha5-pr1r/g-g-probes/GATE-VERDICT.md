# GATE-VERDICT — G-g 门判定（独立 reviewer；qwen3.8-flash-next）

- **固定基线**：`master @ 46a406b9284f4f4add823319df91be8a2f2160fa`（origin/master 亲验同值）。判定分支 = `alpha5-g-g-gate`（基 = 46a406b9，本文件与 `gate-proposal-G-g.md` 为该分支唯一新增，改正本零）。
- **门（既定，不改）**：`dev/agent-workflow/evidence/alpha5-pr1r/g-g-support-contract.md` @46a406b9 —— §1 P1–P9 命题（:28-38）、§2.1 分级定义 E/D/UR/U（:42-49）、§4.1 判据式（:87-108）、§4.2 措辞禁则（:112-118）。
- **输入**：probes G-1..G-5 = `ced9254c`（#265；独立 review `bbaf45de` 可合/4 nit）+ 本报告 `runs/`；live 轮 = `0e0b605a`（#269，`evidence/alpha5/live/`；review ACCEPT `b90abc10` + reviewer 独立复跑捕获 `ead3f155`）；`PENDING-GATES.md:14/:19`；lint 挂载 = `scripts/lint-g-g-wording.mjs` + root-suite 包装。
- **独立复现（本 reviewer 亲跑，非转述）**：① kit `tests/kits/a5-pr1-guard-dispatch/a5p1r-rereg-window.mjs` 于 0.2.0-rc.2 pristine 运行时（`639ed01539`，只读借用）→ **18/18 PASS，exit 0**；② root vitest `a5p1r-change-abort.test.ts`+`a5p1r-gg-probes.test.ts`+`a5p1r-gg-wording-lint.test.ts` → **23/23 passed**；③ `node scripts/lint-g-g-wording.mjs .` → **scanned=713 md；PENDING-GATES=checked；violations=0；exit 0**（第二款在 master 树上已实际生效，非 absent）；④ live runs 原文抽核：`runs/g6-2026-10-16T22-06-50Z/criteria.json` 19/19、`g7-2026-10-16T22-06-58Z` 18/18、reviewer 复跑 `g6-2026-10-16T22-38-51Z`（= `ead3f155`）19/19，全部 ALL_GREEN；活体读数原文 `changeChannelStatus`：g6=`'proven'`、g7=`'armed'`。全部输出留 `runs/gate-review-20261017T0105Z/`。
- 端口纪律：本轮零自占端口、零新 world；:3080 未触碰。

## 1. 逐 P 门判定（分级按 §2.1；三态 = 关闭/部分关闭/开放+剩余条件）

| # | 判定 | 三态 | 一句依据（file:行 / run 路径，均可在本树复核） |
| --- | --- | --- | --- |
| P1 | **D** | **关闭**（按 §4.1 PASS(P1)=具名 kit 判据，达之） | 判据 `RW-INERT-ASSEMBLY-INDISTINGUISHABLE`（`tests/kits/a5-pr1-guard-dispatch/a5p1r-rereg-window.mjs:670`）本 reviewer 复跑 PASS `installOk=true publishedOk=true channelBeforeInjection=armed`；kit-only ⇒ 天花板 D（§2.1 明文），N3（installOk/publishedOk 为常量真）如实随附 |
| P2 | **E** | **关闭** | 完整谓词入常跑断言网：`packages/runtime/test/a5p1r-change-abort.test.ts:249-279`（`bodies===['V2.grep']` ∧ alarms=1 severity=alarm ∧ `:274-275` not.toContain(issued/cancelled) ∧ armed ∧ verified=false），对偶正控同网同文件（`:166 issued toHaveLength(1)`，观测面失明必红）；kit `RW-CHANGE-INERT-LOUD`（mjs:664）+ live G-7 同姿态 |
| P3 | **E** | **关闭** | 主字段（alarm=1/severity/armed/pinned≠current）`:267-270` + 事件流计数入常跑 `a5p1r-gg-probes.test.ts:134-142`（call-edge reason=definition-drift=1、binding-revised verified=false≥1、unverifiedReason 点名）；kit `RW-CHANGE-SWALLOWED-LOUD`（mjs:696）计数 PASS |
| P4 | **E + D** | **关闭**（原 U→收口硬前提满足） | 静默配置**自身**内的"下调后拒→re-bind 恢复"入常跑：`a5p1r-gg-probes.test.ts:146-177`（腿 A inert；腿 B :240-247 swallow 再测一遍，无跨臂外推）；kit 具名判据 `RW-CHANGE-INERT-PINNED-UNTIL-REBIND`（mjs:686）复跑 PASS。family 披露=恢复路径测于 `team-own:` 族（`bindOwnTools` 语义所限，probe-report §2 在册） |
| P5 | **D + E**（对照条款） | **关闭**（无收口义务，§1 P5 原文） | `RW-AFTER-DOOR-BODY-ZERO`（mjs:625）+ RED↔GREEN 对（`runs/kit-r1r-fix1/B3-after-door-*.json`，[followup] 线在册）+ unit ① `:142-197`；措辞仍受 §4.2 禁则 |
| P6 | **E** | **关闭**（机检层；live 佐证另列） | 正向半**首次成断言**：`a5p1r-change-abort.test.ts:170` `expect(handle.changeChannelStatus()).toBe('proven')`；反向半配对 `:279` + `a5p1r-gg-probes.test.ts:249`；kit `RW-CHANNEL-PROVEN-ON-FIRST-DELIVERY`（mjs:679）三臂配对 PASS；live 佐证 G-6 活体读 `'proven'`（`evidence/alpha5/live/runs/g6-2026-10-16T22-06-50Z/live-state.json`，row 现场执行非 JSON 回放） |
| P7 | **D** | **关闭**（按 §4.1 PASS(P7)=判据含零误报合取，达之） | `RW-AFTER-NO-CHANGE` 谓词已含 `executedUnvalidated===0`（mjs:636-640），本 reviewer 复跑 PASS `unvalidated=0 verifiedAfter=true`；记录级→判据（原 §2.2 缺口闭合）；kit-only ⇒ D |
| P8 | **E**（机检） | **部分关闭** | lint 已挂 root suite 且 CI 强制：`packages/runtime/test/a5p1r-gg-wording-lint.test.ts:65-72` 于常跑内扫全仓断言 violations=0 + 非空转 fixture（:35-56）+ 第二款 fixture（:58-63）；本 reviewer 树扫 `PENDING-GATES=checked`（第二款对 `PENDING-GATES.md:19` 真实生效）。**剩余合取 = PASS(P8) 的"G-g 行与分级表一致"**：G-g 行现文（`PENDING-GATES.md:19`）仍是收口前口径，须按 `gate-proposal-G-g.md`（本分支新文件）经守卫后续 PR 落文后方满足 ⇒ 在此之前 G-g 行按 §4.1 FAIL 处置保持"开放" |
| P9 | **UR** | **关闭**（UR 即该配置终态） | 拒装有 E+D 机检：unit `a5p1r-change-abort.test.ts:198-244` + kit `RW-NO-CHANGE-CHANNEL-UNSUPPORTED`（mjs:599）复跑 PASS（`code=IO_POLICY_UNSUPPORTED` 点名 `tools/change`）；分界照旧：**P9 不得给 P1–P4 顶替证据**（§1 P9 原文），本判定未顶替 |

**判定分布（P 级）**：E×6（P2/P3/P4/P5/P6/P8）· D×2（P1/P7）· UR×1（P9）· **U×0**；三态 = 关闭×8 · 部分关闭×1（P8）· 开放×0。
原 U 四项（P4/P6/P7/P8，契约 §2.2:65）全部离 U：P4→E+D、P6→E、P7→D、P8→E（机检在场，行一致待落文）。

## 2. live 轮判定（G-6/G-7；契约 §3:78-79 之 LIVE-WIRING-GATED 项）

- **G-6（proven 活体）= LIVE-CONFIRMED**：committed 19/19 + reviewer 独立复跑 19/19（`runs/g6-2026-10-16T22-38-51Z/`，值逐项全等）；投递臂活体 `changeChannelStatus='proven'`、`dispatcher-change-abort-issued`=1、`cancelled-before-body`=1、body 零执行、re-bind 恢复。**契约 §3 G-6 行原文注记不变：其计分项挂 G-d lane 集成确认，不计入 G-g**——本判定未把它计入，G-d 行不受本行影响仍开放。
- **G-7（静默姿态五件套）= LIVE-CONFIRMED**：18/18；生产观察面五件套逐项在场（unvalidated=1、alarm=1、call-edge-drift=1、binding-revised=1、issued=0、cancelled=0、终读 `'armed'`、control=2/proxy=2 证真实发射）。
- 两 run 的等级上限按 `evidence/alpha5/live/README.md:58-67` 原文 = **LIVE-CONFIRMED / ENFORCE-PARTIAL**，本 reviewer 复算成立、不改写。

## 3. ENFORCE 级不可宣称（缺项原样列出，不得抹平）

对"已订阅但永不投递"配置（及其 live 面），**ENFORCE-CONFIRMED 不可宣称**。缺项 = `README.md:60-67` 三项，原样转录：
1. **无 OS 强制面**：guard 与 gated lane 均为 in-process 构造，同特权绕过在本配置中不被 OS 阻断（landlock/sandbox 强制维度未测）；
2. **trusted 输入 fixture-grade**：`trustedIdentities`/`nativeNames` 系活体读取但来自 fixture-grade 装配假设（row-owned 名字），非 OS 锚定身份；
3. **取消是协作式**：swallow 注入按构造仅测试实例存在；loud posture 证明的是 **DETECTION + REPORT**，取消仍为 dispatcher 内部协作式。
kit-only 判据同受 §2.1 天花板（ENFORCE 不可达，`review-G-g-probes.md` §⑤）；live 判据继承同一天花板。**ENFORCE 增强（三缺项任何一项的补齐）= 独立后续项，非本轮 G-g 门槛。**

## 4. 静默失效 ≠ fail-closed（实测在案）

G-7 live 实测**被移 Body 实跑**（判据 `L-G7-MOVED-BODY-RAN` PASS；journal drift-body-ran；`issued=0 cancelled=0`）⇒ 静默通道的机制结局是"名级降级 + 响亮上报 + 钉到 re-bind"，**不是** fail-closed、不是"恰一次暴露"（后者已撤回在册：`seam-record-post-door-resolution.md:99-122`）。禁则由 `lint-g-g-wording` root-suite 常跑机检执行（本树 713 md / 0 违例）。

## 5. 两个安全保证维度——分开判，禁合并为笼统"安全"

- **维度 A『proven 通道可达』**：交付时真投递 + 定向取消生效。判定 = **成立**（机检 E 级：P6 `:170`+配对；live 观察：G-6 19/19×2）。适用域=通道确实投递的配置；验收层计分挂 G-d，不由本行发放。
- **维度 B『静默姿态响亮告警』**：永不投递时不遮掩——每调用响亮 alarm、call-edge 降级、名级钉到 re-bind、零误报。判定 = **成立**（机检 E/D：P2/P3/P4/P7；live：G-7 18/18）。**不承诺任何取消效果**（协作式 + body 实跑，§4）。
- A 不可用于静默配置，B 不可用于宣称投递生效；任何对外措辞不得把两维合并。

## 6. G-g 行落文建议措辞（U→? 每子项）与"若关闭还需什么"

各子项离 U 后的**允许口径**（禁则 §4.2 继续全量有效）：
- **P4（U→E+D）**：可写"被漂移的名字在其下一次调用前被钉住（并响亮上报），**已在静默配置自身内测量**（kit 判据 + 常跑 unit 双腿）"；不得写"已强制/已合规"（禁则 §4.2）。
- **P6（U→E）**：可写"`armed⇒proven` 跃迁已被断言且与静默臂 `armed` 反向配对；live 面活体读数 `'proven'` 可作**维度 A（可达性）**证据引用"；不得写"通道已验证可用（整通道健康）"（诊断/可达性口径，禁则 §4.2）。
- **P7（U→D）**：可写"零误报已成判据（`RW-AFTER-NO-CHANGE` 含 `executedUnvalidated===0`）"；kit-only，不得写 CI 常跑级。
- **P8（U→E 机检）**：可写"措辞禁则已有 root-suite 常跑机检（含 PENDING-GATES 第二款）"；行一致合取待落文。
- **P1（记录级→D）/P2（D→E）/P3（主字段 E→全谓词 E）**：按 §1 表口径升级 ledger 括注即可。

**若 G-g 完全关闭还需（仅此一条属本轮门槛，其余非门槛）**：
1. 【唯一剩余】落文：`gate-proposal-G-g.md`（本分支）经守卫后续 PR 更新 `PENDING-GATES.md` G-g 行，使 PASS(P8) 的行一致合取成立；lint 第二款守卫（注意：落文行**不得**同时含 `G-a` 与 `CLOSED/已关闭` 字面，否则触发 `lint-g-g-wording.mjs:86-99` 的互斥检查——提案已按此写）。
2. 【非门槛】ENFORCE 增强（§3 三缺项）= 独立后续项；G-d 集成确认 = 独立行；G-6 计分项归 G-d。

## 7. 总判定

- **P 级**：全部 ≥D，U 清零（分布见 §1）；**live 级**：G-6/G-7 = LIVE-CONFIRMED（ENFORCE-PARTIAL 上限，缺项原样在案）。
- **G-g 门 = 部分关闭**：证据门实质要件（P1–P7 判据式 §4.1 全绿、live 项落地、lint 生效）均已独立复现；唯一未满足合取 = PASS(P8) 的 ledger 行一致，其完成动作是守卫落文 PR（非证据缺口）。
- **四裁决词映射**：**投机通过**（证据充分支持后续开发；残余 = 落文时序 + §3 三缺项披露义务 + 双维禁合并措辞纪律，按 ROUTER_RULES §6 入风险台账）。落文 PR 合并即转"通过/关闭"，无需再补证据。
- 本文件不构成对静默配置的任何 closed/compliant/fail-closed 宣称（§4.2 禁则全量有效，"不得"默认适用）；引用请连 §3/§4/§5 一起引。

— G-g 门判定 reviewer（独立会话；一次性 worktree `.worktrees/gg-gate-review`，只读+新增文件；token 扫描=本目录新增文件 `token=`/Bearer/长随机形态 0 命中；porcelain 提交前后空）
