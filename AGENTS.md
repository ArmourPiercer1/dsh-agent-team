# AGENTS.md — dsh-agent-team 仓库代理规则

本仓库是 DSH Team-mode **vNext** 的 authoritative repository。**CORE PATCH BUDGET = 0**：upstream DSH 保持 clean，全部能力通过外部插件 + 公开 seam 提供；任何需要 upstream source patch 的路径都是阻塞（`CORE_SEAM_BLOCKER`），不是待办。

## 会话开始必读（提示词注入要求）

在本仓库工作的一切 agent（主 Agent、任务子代理、review 子代理、workflow 拉起的任意代理），**会话/子任务开始后的第一步**必须读取：

1. `docs/ROUTER_RULES.md` — 无人值守执行协议：**先读 §0（当期计划优先裁决）**，其余条款为默认底线：blocker 类型与固定格式（含 `CORE_SEAM_BLOCKER`、禁止 patch upstream）、只追加执行日志、无人值守纪律、git 纪律（1 task=1 branch=1 worktree=1 writer、gated 历史禁止 force-push、master=alpha 线 / stable=已裁决 RC）。
2. 当期阶段计划（现为 `docs/plans/active/alpha4-permission-governance/alpha4-implementation-plan.md`）— 当期任务分解、并行 lane 与文件所有权、审查组成与顺序、每 PR 合并门、临时语义披露；与 ROUTER_RULES 冲突处以计划为准。
3. `docs/TEST_METHODS.md` — 测试基础设施约束：测试 DSH 源码 = `tests/deepseek-harness-test-use`（pristine upstream，基线 **0.2.0-rc.2 @ `639ed01539`**（2026-10-03 起，宿主升级轮；锚点 = fork 分支 `stable-3-0.2.0-rc.2` tip，fork 无该 tag；此前 0.1.7-rc.1 @ `46a7f68b09`（2026-09-24 … 2026-10-03）、0.1.5-rc.2 @ `fb2c4b9e69`（2026-09-17 起）；**DSH 0.1.2 不再支持**；版本/路径唯一来源 = `tests/paths.mjs`：`DSH_BASELINE_VERSION` / `TEST_USE_BASELINE_SHA` / `CLIENT_COMMIT_HASH`），DSH_HOME = `tests/homes/<world>`（**必须工作区内**，workspace-write 沙箱约束；命名/清理协议见其 §7），port = `3180` 族；构建/启动链与沙箱实测见其 §2/§5；**严禁影响稳定开发实例**（:3080 及其 DSH_HOME）。

读取之后才可执行任务；不得以"上下文已熟悉"为由跳过，不得违反其中禁止项。

## 文档权威序

upstream 公开契约 → `docs/plans/paused/` 四份 20260829 冻结文档（Architecture / UI / Development Plan / Task Decomposition，只读、语义唯一权威；2026-09-02 由 `docs/plans/active/` 移入 `docs/plans/paused/`，冻结基线地位不变）→ `docs/plans/active/` 当期执行计划 → `docs/ROUTER_RULES.md`（执行协议；其 **§0 = 当期计划优先**裁决）→ `docs/TEST_METHODS.md`（测试约束）→ `docs/migration/`（legacy inventory/reuse map，参考）→ legacy 代码（仅证据）→ 实现便利。冲突时按此序裁决，科学/设计理由需显式记录。

**当前阶段（2026-10-07）**：**Alpha.4 硬治理阶段**。当期计划集 = `docs/plans/active/alpha4-permission-governance/`（`ADR-alpha4-hard-governance.md` + `alpha4-permission-governance-spec.md` + `alpha4-implementation-plan.md`，A4-PR0…A4-PR7 串行（PR0 = 耐久治理提案基座，无产品行为变更），仅 PR4∥PR5 在 PR3 接口冻结后可并行）。**该计划自带的执行协议优先于 ROUTER_RULES 的过时条款**（用户 2026-10-07 明确裁决：模型路由解绑、每 Gate 三 reviewer 与每任务 ≤3 次上限由计划的 PR 级审查循环取代；见 `docs/ROUTER_RULES.md` §0）。CORE PATCH BUDGET = 0 与红线不受该裁决影响。实现机制按 superpowers 技能族执行（`subagent-driven-development` / `executing-plans` / `dispatching-parallel-agents` / `test-driven-development` / `using-git-worktrees` / `requesting-code-review` / `receiving-code-review` / `verification-before-completion`，2026-10-07 装入全局技能根 `$DSH_HOME/skills`）。

**逐轮历史指针不再写在本文件**：原先在此行逐轮堆积的 current 指针（T12 关闭 / P9 UI GO / PR #26–#35 / pre-alpha3 收口 F.1–F.6 / PR #37–#56 / test-infra #51 / **Alpha.3 权限面 PR #57–#61** / **DSH 0.2.0-rc.2 宿主升级轮 PR #62**）已停止在此维护；逐轮事实唯一来源 = `dev/agent-workflow/SESSION_ROUTER_LOG.md`（只追加）+ `dev/agent-workflow/graph.yaml`，快照见 `docs/STATUS.md`；已完成计划归档于 `docs/plans/finished/`。

## 目录约定

| 路径 | 性质 |
| --- | --- |
| `docs/plans/active/` | 当期执行计划（**2026-10-07 起纳入 git 跟踪**；当前 = `alpha4-permission-governance/` 三份；用户/主 Agent 产物，禁 worker 改动；阶段完成即移入 `finished/`） |
| `docs/plans/finished/` | 已完成/已关闭计划与指南归档（tracked，2026-10-07 起；只追加历史，不再作为当期需求来源） |
| `docs/plans/issue-fix/` | 单点缺陷修复计划与复盘（tracked，2026-10-07 起） |
| `docs/plans/third-party/` | 第三方外部建议文档（tracked，2026-10-07 起；非需求来源，仅参考） |
| `docs/plans/paused/` | 20260829 冻结四份 + G8 审计报告 + P8-S 收束计划（**2026-10-07 起纳入 git 跟踪**；只读冻结基线，四份冻结文档仍为语义唯一权威） |
| `docs/ROUTER_RULES.md` / `docs/TEST_METHODS.md` | 执行协议 / 测试约束（用户裁决可改，改动需记录） |
| `docs/STATUS.md` | 当前状态总览（living 快照，非权威源；权威 = `dev/agent-workflow/graph.yaml` + `SESSION_ROUTER_LOG.md`） |
| `docs/contracts/` | contracts v1 冻结确认记录（P3-T6） |
| `docs/migration/` | legacy 行为清单、reuse map |
| `dev/agent-workflow/` | 编排状态 `graph.yaml`、只追加日志 `SESSION_ROUTER_LOG.md`、证据 `evidence/<task>/` |
| `references/deepseek-harness/` | 冻结 legacy fork 参考（只读；冻结点 = 分支 `feat/team-vnext-integration-20260829` tip 与 tag `legacy-agent-team-pre-vnext`，均锁 `a3ab319927...`（2026-09-05 复核未移动；2026-09-12 本环境再复核未移动；2026-09-17 rc2-repair 轮再复核未移动；2026-09-24 推送 stable-2 轮 ls-remote 再复核未移动；2026-09-28 文档系统对齐轮本地 tag peel + 远端 ls-remote 再复核未移动）；工作树 HEAD 现于 `stable-1-0.1.5-rc.2 @ fb2c4b9e69`（0.1.5-rc.2 官方发布点，2026-09-17 由用户切至本轮 rc.2 契约参考基线；此前本环境为 `master @ c291e7961a`（0.1.5 sync 迁移状态）；原 Windows 机为 `cd5ef814...` 基线对比检出）；**2026-09-24 用户指令**：新建分支 `stable-2-0.1.7-rc.1` @ `46a7f68b09`（upstream `deepseek-ai/deepseek-harness` 的 `dsh-v0.1.7-rc.1` 官方发布点，PR #5073；未 checkout，工作树 HEAD 不变）并连同 23 个官方 `dsh-v*` release tag 推送 origin（一次性授权，零 force-push；evidence `dev/agent-workflow/evidence/stable2-0.1.7-rc.1-sync/`）；禁止任何 vNext 开发；冻结锚点**不得移动**。**2026-10-03 复核（0.2.0-rc.2 宿主升级轮）**：`references/deepseek-harness` 在本环境不存在（`references/` 为 gitignored，环境迁移缺口，STATUS 2026-10-01 行已登记）→ 改以远端复核：`refs/heads/feat/team-vnext-integration-20260829` = `a3ab319927…` 且 tag `legacy-agent-team-pre-vnext` peel = 同 SHA，**未移动**；0.2.0-rc.2 的宿主源由**只读共享 baseline** `/srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness`（分支 `stable-3-0.2.0-rc.2` @ `639ed01539`，porcelain 空）承载，各 worktree 各自 `clone --local --no-hardlinks` 出独立 pristine 运行时，共享 baseline 从不被写入） |
| `tests/` | 测试基础设施（2026-09-12 标准化，test-infra-standardization）：`characterization/`（P2 harness）、`mock/`（mock model 部署 + 证据）、`kits/`（可复用 kit 归位，tracked）、`paths.mjs`（**测试路径、宿主版本与基线 pin 唯一来源**；kit 一律从此取基线，禁硬编码代次）、`deepseek-harness-test-use/`（pristine upstream 测试运行时 checkout，**gitignored**，自身 git 仓，detached @ `639ed015397290b3745d163aafe02ffee4aa3f84` = 0.2.0-rc.2 发布点（2026-10-03 起，宿主升级轮；此前 46a7f68b09 = 0.1.7-rc.1（2026-09-24 … 2026-10-03）、fb2c4b9e69 = 0.1.5-rc.2（2026-09-17 起）；0.1.2 不再支持）；唯一允许的运行时源码；基线代差注记与 home 协议见 TEST_METHODS.md §4.2/§7）、`homes/`（一切 DSH_HOME 世界，**gitignored**）；旧 `references/.dsh-test*` 世界不迁移 |
| `.worktrees/` | 任务 worktree（gitignored；一个任务一个） |
| 根 `packages/` | vNext 9-package 结构（contracts/domain/storage/runtime/tools/remote/client/legacy/testkit，TaskDoc §11 冻结；P0 骨架 → P1–P9 完整实现，P9 GO 2026-09-04）；**禁止**复制 legacy `packages/team` 源码进来 |

## 红线（全局禁止 block）

- 不得修改 upstream 源码；不得 import/使用 upstream 私有/内部 API；不得使用 patch-package / pnpm patch / postinstall 改写 upstream；不得 git apply Team patch 到 upstream/host 树；不得 vendored 修改过的 upstream 副本。
- 不得把 legacy Team SessionEvent 词汇当 vNext 权威（vNext 无 Team SessionEvents；对象模型以 Architecture 文档为准：TeamBlueprint→TeamSession+TeamDomain→MemberInstance）。
- 不得重写 legacy 历史；不得移动冻结分支 `feat/team-vnext-integration-20260829`。
- 禁止 push（用户明确许可的一次性推送除外）；master / stable 的 push 由主 Agent 在对应 Gate 或发布裁决通过后执行；gated 历史不得 force-push。
- **首个正式 release 之前的分支策略**：`master` 是 alpha 开发线，承载下一 alpha 的持续集成；`stable` 只跟踪已经裁决发布的 RC 基线。RC 修复先在独立 task/int 分支完成并过 Gate，再合入 `stable`；不得把未经 RC 裁决的 master alpha 提交直接推进到 stable。首个正式 release 之后必须通过新的发布决策重新定义长期分支策略。
- 影响面必须可逆：任何对运行实例、worktree、远端的操作在 evidence 中留痕。

## 状态与恢复

- 编排状态唯一来源：`dev/agent-workflow/graph.yaml`（不依赖会话记忆）；执行日志只追加：`dev/agent-workflow/SESSION_ROUTER_LOG.md`。
- 会话恢复后：先读 graph.yaml 定位 current_phase 与 ready 任务，再读 SESSION_ROUTER_LOG.md 末尾若干条目，然后继续；不要重建已完成的工作。
- 文档系统（`AGENTS.md` / `README.md` / `docs/STATUS.md` / `docs/ROUTER_RULES.md` / `docs/TEST_METHODS.md`）是快照而非权威：与 graph.yaml + 日志最新条目冲突时，以 graph.yaml + 日志为准，并在当轮修正文档（R123 文档对齐先例）。
