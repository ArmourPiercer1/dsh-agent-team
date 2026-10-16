# PENDING-GATES.md — 项目内延期项登记（not a promise to anybody outside this repo）

建立于 2026-10-16（PR #258 后续轮）。**为何新建本文件**：`452a04c0` 处仓库内不存在任何
PENDING/DEFERRED 登记文件，而裁决要求在 seam-record 处给出 "PENDING-GATES D-1 链接"。为避免悬空链接，
本轮建立此登记文件；此后延期项一律登记于此（只增不删，收口时写收口记录而非抹除条目）。

本登记**仅限项目内**：不构成对 Host upstream 或任何外部的请求；对外提交是将来须用户另行授权的动作。

| id | 项目 | 状态 | owner | 验收依据 |
| --- | --- | --- | --- | --- |
## G 门行（自 evidence 正本合并，G-b..G-g 完整）
| # | 项 | 状态 | 放行前动作 |
|---|---|---|---|
| G-a | PR257 取消语义 | **用户裁决 2026-10-16 17:52Z：接受扩大取消范围**（限定=工具 definition 变化/撤回→取消关联未执行调用+向关联已开始调用传播 abort 请求；不保证立即终止、不回滚已发生副作用；结果三分类：未执行/已执行可能有副作用/终止未确认）。**边界：不扩大为 provider 卸载自动杀全团队；G-g 不随之关闭；不回填为 17:02 合并时已批准**。运行接线验收自本裁决起可按门推进 | 文档落实=#258 分支更新中（裁决 UTC 引本行） |
| G-b | PR257 seam-record/s12 必改点1（三事实+候选修法**仅项目内**+限定措辞） | follow-up 修复中（4d990c89） | 文档可先行；禁"已合规"措辞 |
| G-c | PR256 F-1 数组顺序决定结局⇒deny-source-ambiguous；F-2 issue 复证只比 MAX rung⇒扩展 provenance 对；日志明细 NIT | 修复中 | 修复+新 head 独立复核+CI 后才谈 #256 合并 |
| G-d | 各 lane（B/C/D/E/F/G）对契约 v1.1 的**集成确认**（含 p4t6 pin +14、tsconfig include、接线注、F-3 PR3 义务、OpenAtPort 前禁宣称任意树 Supported） | 未开始 | PR3/PR7/PR8 集成会话逐 lane 确认后其交付方可计入验收 |
| G-e | 原 G1/G3/G7/YAML 待裁项 | 未裁 | 不默认旧提案 |
| **G-g** | **静默已订阅通道的排除门=独立开放项（用户：不得随 G-a 默认关闭）**：支持契约须明确"订阅成功但永不投递"配置在支持矩阵中的位置+所需证据（送达+生效原文）；现状=名字级降级+响亮 alarm（事实已证，契约文本未收口） | 开放 | 契约文本+证据清单收口前，该配置在验收矩阵中=UNSUPPORTED/待证，不得默认 SUPPORTED |
| G-f | census 非终态时禁称"全部 CI 绿" | 纪律 | 每次合并回报附 census 状态原文 |

**唯一权威声明**：本文件（dev/agent-workflow/PENDING-GATES.md）为合并/验收门清单唯一权威；dev/agent-workflow/evidence/alpha5/PENDING-GATES.md 降级为指针存根（G-d 集成义务明细仍在 evidence 侧 INTEGRATION-PLAN.md/PENDING-GATES 注记，以本文件行引用为准）。

**Owner 直接指派（17:54Z 授权，留名留证）**：D-1 恢复实施 owner=d9da2f74（PR1 dispatcher writer，qwen）；D-2 skills 执行 owner=4d990c89（followup 文档 writer，qwen），独立 reviewer=4dac3d04（≠writer）；G-g 技术证据收口 owner=4dac3d04 起草支持契约条款 + 4d990c89 落文；集成 owner（p4t6/tsconfig/接线）=协调者本人。均 qwen3.8-flash-next。

| D-1 | 严格『只取消未执行调用』属性（NO-ABORT-AFTER-BODY-START） | 延期（DEFERRED，非放弃） | 待集成 owner 提名 → 用户确认 | 见下 |
| D-2 | skills 文档与取消语义对齐（收尾必做） | 待收尾轮执行 | 待集成 owner 提名 → 用户确认 | 见下 |

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
