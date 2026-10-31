# PENDING-GATES.md — 项目内延期项登记（not a promise to anybody outside this repo）
> **[2026-10-22 banner] historical / superseded-by `docs/plans/active/alpha5-tool-io-governance/current-execution-plan.md`** — 本文件"当前态"字段与 merge 指针按记录时点已过期；有效待办唯一入口=`docs/plans/active/alpha5-tool-io-governance/ALPHA5-EFFECTIVE-BACKLOG.md`。历史台账正本地位、红线、裁决原文与设计约束**仍有效**；正文未改动。

建立于 2026-10-16（PR #258 后续轮）。**为何新建本文件**：`452a04c0` 处仓库内不存在任何
PENDING/DEFERRED 登记文件，而裁决要求在 seam-record 处给出 "PENDING-GATES D-1 链接"。为避免悬空链接，
本轮建立此登记文件；此后延期项一律登记于此（只增不删，收口时写收口记录而非抹除条目）。

本登记**仅限项目内**：不构成对 Host upstream 或任何外部的请求；对外提交是将来须用户另行授权的动作。

| id | 项目 | 状态 | owner | 验收依据 |
| --- | --- | --- | --- | --- |
## G 门行（自 evidence 正本合并，G-b..G-g 完整）
| # | 项 | 状态 | 放行前动作 |
|---|---|---|---|
| G-a | PR257 取消语义 | **用户裁决 2026-10-16 17:52Z：接受扩大取消范围**（限定=工具 definition 变化/撤回→取消关联未执行调用+向关联已开始调用传播 abort 请求；不保证立即终止、不回滚已发生副作用；结果三分类：未执行/已执行可能有副作用/终止未确认）。**边界：不扩大为 provider 卸载自动杀全团队；G-g 不随之关闭；不回填为 17:02 合并时已批准**。运行接线验收自本裁决起可按门推进 | 文档落实=**#258 已合 18f53c99**（裁决 UTC 引本行） | 支持契约 @98ddbaa9+补测 G-1..G-5 **已合 master @ced9254c**（review bbaf45de/3ee77729，pr-gate=success）：P4/P6 达 D、G-6/G-7 已 LIVE-CONFIRMED（live 轮 runs+review ACCEPT，ENFORCE-PARTIAL 缺项如实）；G-g 保持开放至 live 项+落文双闭环 |
| G-b | PR257 seam-record/s12 必改点1（三事实+候选修法**仅项目内**+限定措辞） | follow-up 修复中（4d990c89） | 文档可先行；禁"已合规"措辞 |
| G-c | PR256 F-1 数组顺序决定结局⇒deny-source-ambiguous；F-2 issue 复证只比 MAX rung⇒扩展 provenance 对；日志明细 NIT | 修复中 | 修复+新 head 独立复核+CI **已完成**：#256 合 ae3dcf54；后继 D/E 修复轮 #260 d69bfc4b、#261 6ce62c25 各独立复核+CI 绿后合。状并 |
| G-d | 各 lane（B/C/D/E/F/G）对契约 v1.1 的**集成确认**（含 p4t6 pin +14、tsconfig include、接线注、F-3 PR3 义务、OpenAtPort 前禁宣称任意树 Supported） | 未开始 | **集成轮已执行**：wiring #268 9e75ee83（Lane-D 三门真修+条件 A/B/C 收口，review 3f0a3f15/4a560ba7）+live #269 0e0b605a（LIVE-CONFIRMED）+G-6 计分项入账。各 lane 交付方可计入验收 |
| G-e | 原 G1/G3/G7/YAML 待裁项 | 未裁 | 不默认旧提案 |
| **G-g** | **静默已订阅通道的排除门（用户：不得随取消范围裁决默认关闭）**。证据门**已收口**（GATE-VERDICT @alpha5-g-g-gate，master@46a406b9 基）：支持契约 §3 G-1..G-5 已合 master（ced9254c，独立 review bbaf45de）⇒ 分级 P1=D · P2=E · P3=E · P4=E+D（同配置恢复路径已测，"钉到 re-bind"允许口径自此成立）· P5=D+E（对照）· P6=E（armed⇒proven 已成断言）· P7=D · P8=E（措辞 lint 挂 root suite 常跑）· P9=UR；live 轮 G-6/G-7 已合（0e0b605a，review ACCEPT b90abc10 + 独立复跑 ead3f155）= **LIVE-CONFIRMED**（G-6 19/19×2 · G-7 18/18，G-6 计分项挂 G-d 不随本行） | 收口（证据级；**等级上限 LIVE-CONFIRMED/ENFORCE-PARTIAL**：缺 OS 强制面 · trusted 输入 fixture-grade · 取消协作式，三项原样在册 README:60-67，增强=独立后续项非本门）；静默失效**非 fail-closed**（G-7 实测被移 Body 实跑，证伪在案） | 无剩余证据动作；措辞禁则由 lint-g-g-wording 常跑执行；双维度（proven 可达 vs 静默响亮告警）禁合并措辞；引用带 GATE-VERDICT §3-§5 |
| G-f | census 非终态时禁称"全部 CI 绿" | 纪律 | 每次合并回报附 census 状态原文 |

**唯一权威声明**：本文件（dev/agent-workflow/PENDING-GATES.md）为合并/验收门清单唯一权威；dev/agent-workflow/evidence/alpha5/PENDING-GATES.md 降级为指针存根（G-d 集成义务明细仍在 evidence 侧 INTEGRATION-PLAN.md/PENDING-GATES 注记，以本文件行引用为准）。

**Owner 直接指派（17:54Z 授权，留名留证）**：D-1 恢复实施 owner=d9da2f74（PR1 dispatcher writer，qwen）；D-2 skills 执行 owner=4d990c89（followup 文档 writer，qwen），独立 reviewer=4dac3d04（≠writer）；G-g 技术证据收口 owner=4dac3d04 起草支持契约条款 + 4d990c89 落文；集成 owner（p4t6/tsconfig/接线）=协调者本人。均 qwen3.8-flash-next。

| D-1 | 严格『只取消未执行调用』属性（NO-ABORT-AFTER-BODY-START） | 延期（DEFERRED，非放弃） | 待集成 owner 提名 → 用户确认 | 见下 |
| D-2 | skills 文档与取消语义对齐（收尾必做） | **已执行+已独立终验 9/9**（#270 SKILL.md §8/§7；终验清单 9 PASS/0 FAIL：11 exec-level/1 record-level/1 裁决边界） | 执行=65dfcbf0（4d990c89 名义）；审查+终验=77c128db/236d1ecd（4dac3d04 名义） | SKILL.md @d6b57e55 + D2-closeout-verification.md @alpha5-d2-verify(545fc00e) |

## D-1 — NO-ABORT-AFTER-BODY-START（延期）

- **内容**：Body 已开始的调用不得被本 lane 发 abort；其结果一律按已执行上报。
- **为何延期**：需要**公开可信**的 body-start / pre-body 检查。固定 Host 上 `bodyInvoked` 为私有字段
  （`packages/core/tools/src/index.ts:1580`），raise 现场无从判定；从结果码反推为时已晚。
- **上游最小条件（候选三件，选型待接口实际可用后验证）**：① per-call pre-body 事件；② `bodyInvoked`
  的公开读点；③ resolution-pinned Definition（消除重解析窗口）。三者中 ③ 覆盖 ①②，①最直接；
  **本轮不选型**。
- **恢复条件**：其一在固定 Host 上实际公开，且 lane 在 raise 现场可读到并据此不 raise。
- **回归（缺一不得宣布恢复）**：1) `packages/runtime/test/a5p1r-change-abort.test.ts` 增『已开始不取消』
  硬门腿；2) 隔离反例（同名两调用，一已开始一未执行 ⇒ 只取消未执行者）；3) kit 判据
  `RW-ABORT-INSIDE-BODY-IS-TERMINATION` 由『abort 传播至已开始 Body』翻为『不向已开始 Body 发 abort』。
- **详情与出处**：`dev/agent-workflow/evidence/alpha5-pr1r/seam-record-post-door-resolution.md`
  §DEFERRED；`dev/agent-workflow/evidence/alpha5-pr1r/s12-residual-evidence.md` §(k)。

## D-2 — skills 文档对齐（收尾必做）

- **路径**：`.agents/skills/team-leader-operations/SKILL.md`（如 blueprint 语义受影响则含
  `.agents/skills/team-blueprint-authoring/SKILL.md`）。
- **时点**：本阶段完成后的收尾轮；提出本轮（#258）**不触碰**该文件。
- **验收**：见 `s12-residual-evidence.md` §(l)（三分类一致；不得残留两种旧口径；由 review 逐条比对）。


## census 失败身份落文（G-f，20:3xZ，诊断 91bd0381）
夜间 4 个 census-runtime FAILURE 身份一致且确定性复现（a5p0-layer-audit×2 + p4t6×1，宿主 pin 639ed01539 实测跑通、refused=0）：alpha.5 PR3/PR5 未登记 tool-governance 消费者与可扫文件台账，#262/#265 为 master 已入库红的继承，非环境抖动、非 flake；修复=alpha5-int-wiring 台账轮（消费者登记+census baseline 重录）。
**合并纪律（自本条生效）**：census-runtime=failure 时即使 required pr-gate=success 也须先诊断身份再合并——本分支新增红=阻断；继承红=登记随台账 PR 收口。

- 事件缺口注记（G-f）：20:25–22:06Z 本仓库 pull_request 类事件未产生任何 run（只读核对：workflow active、非 draft、base/paths 无限制、actions 权限正常、触发/未触发 head 的作者与 verified 形态相同——原因未定位，不称全局停摆）；受影响 #258/#267 恢复后各做一次常规重试（267 close/reopen、258 常规文档推送），run 出现在最终 head 前不合。

## Alpha.6 定时唤醒载体递延（2026-10-31，Lane 2）

用户裁决（2026-10-31）：Alpha.6 PR-I2 的 **floor-delayed 定时唤醒**子能力**递延**，登记为具名
`CORE_SEAM_BLOCKER`，scope 严格限定为该子能力本身。理由与证据见
`docs/plans/memo/alpha6-review-separation/rulings-20261031-timed-wake-and-pr-i1.md` §1.1 与
`docs/plans/memo/alpha6-review-separation/s0-addendum-timed-wake-carrier-20261031.md`（S0 补遗命题 N-1）；台账条目
`dev/agent-workflow/blockers/alpha6-pr-i2-timed-wake-carrier-20261031.md`。**项目内递延，不构成对 upstream 的
任何请求**（对外提交需另行授权）。递延期间硬要求：缺时间触发源的 floor-delayed 请求必须显式拒绝（不得
`accepted: true`、不得静默丢弃），不得自建第二套持久化 timer/scheduler，PR #509 defer 面保持 DORMANT。
