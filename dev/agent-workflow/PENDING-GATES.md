# PENDING-GATES.md — 项目内延期项登记（not a promise to anybody outside this repo）

建立于 2026-10-16（PR #258 后续轮）。**为何新建本文件**：`452a04c0` 处仓库内不存在任何
PENDING/DEFERRED 登记文件，而裁决要求在 seam-record 处给出 "PENDING-GATES D-1 链接"。为避免悬空链接，
本轮建立此登记文件；此后延期项一律登记于此（只增不删，收口时写收口记录而非抹除条目）。

本登记**仅限项目内**：不构成对 Host upstream 或任何外部的请求；对外提交是将来须用户另行授权的动作。

| id | 项目 | 状态 | owner | 验收依据 |
| --- | --- | --- | --- | --- |
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
