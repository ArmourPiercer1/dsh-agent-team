# M-13 缺项台账更正提案（W7M-2，仅提案 — matrix-machine.json 未改动）

- 对象行：`dev/agent-workflow/evidence/alpha5/pr8/matrix-machine.json` rows[`row_id=M-13`]（读-only 检视于本 worktree；**本提案不修改该文件**，行变更需按其 `transition_rule`/lint 代码位与 Gate 流程由授权者执行）。
- 提出方：W7M-2（branch `alpha5-w7m2-covgate`，base `148c3f49`），证据 `dev/agent-workflow/evidence/alpha5/wiring/w7m2/`。

## 现状（读到的原文）

`pending_probe.transition_record = { verdict: "LIVE", round: "W-E2 (alpha5-wire-tools2) @master aece4f21 …", evidence_refs: [we2 gated-2026-10-17T04-01-07Z …] }`；行内**没有**任何字段区分"W-E2 判红的是 fixture 观测面三态"与"受治理团队装配（非 plain session）上的两 member 隔离/allow 真注册可列/deny 零注册三件"。台账读者可能把 LIVE 误读为三件已在受治理装配上全部成立。

## 建议更正（两处，均为加性字段建议，不改既有值）

1. **`transition_record.scope_note`（新增）**：
   > W-E2 LIVE 仅声明 M-13 判据在 criterion-level-fixture 面的三态（INTERFACES-v1 集成规则；行内 `acceptance_scope` 已如此限定）。受治理团队装配（声明 capabilities.permissions 的 strict 模板、非 plain session）上的三件结果由 W7M-2 独立入册：`dev/agent-workflow/evidence/alpha5/wiring/w7m2/runs/green/`（16/16，`t-iso.json` / `t-allow-row.json` / `t-deny-zero.json`；RED 对照 `runs/red-no-row/` 5/5）。

2. **`transition_record.missing_legs`（新增数组，当前应视为隐式 `[]`，现登记两条实测缺项）**：
   - `job-coverage-registration-unplanned`：`job_kill/job_list/job_output` 的 coverage 注册为**计划外**（① 定性），缺 reviewed authority owner（operations adapter）或等价 removal 路径；受治理 strict 团队默认含三件即启动 fatal。最小复现 = `runs/repro-jobs/fatal-capture.json`（entries 恰为三件，`unknown_unmanaged_present=false`）+ `runs/repro-standard/fatal-capture.json`。引用行：`packages/runtime/operation-permission/permission-coverage.ts:161/:138/:180`、`packages/runtime/src/plugin/live/agent-bindings.mjs:2435`、`packages/domain/blueprint/src/schema.ts:406`。处置：分腿保持（③），不借 M-13/W-E2/#284 任何引用升格。
   - `preset-bash-guard-binding-unverified`（本轮实测）：本宿主构建（@`639ed01539`）上每个 strict 受治理面（boot anchor 与 team.create leader 同文拒绝）模型驱动 `bash` 被 a5p1 closed-world Guard dispatch 拒绝——`the Tool Binding for "bash" cannot be verified at dispatch time (no fallback to the native body)`——受治理会话内模型驱动注册无法触达 `ctx.jobs`；宿主 jobs PLANE 正常（lane actuator 腿真注册 `a5cvg-1`→`completed`→readAt 原文）。证据：`runs/green/guard-binding-probe-anchor.json`、`runs/green/t-allow-model-verdict.json`。

## 边界声明

- 本提案**不**申请行级状态迁移（M-13 维持 `LIVE`/其行语义不动）；不申请 PASS/SUPPORTED；不触碰 probe receipt。
- 依据的公开面：`/team-remote team.create`、`POST /api/session/prompt`（含 member child session，g5 S4 先例）、row-local HTTP routes、repo dist 公开 barrel、宿主 `ctx.jobs` 公开 seam。零私有 API、零 lane 编辑、零 matrix 编辑。
