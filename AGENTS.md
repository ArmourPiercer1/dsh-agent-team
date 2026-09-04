# AGENTS.md — dsh-agent-team 仓库代理规则

本仓库是 DSH Team-mode **vNext** 的 authoritative repository。**CORE PATCH BUDGET = 0**：upstream DSH 保持 clean，全部能力通过外部插件 + 公开 seam 提供；任何需要 upstream source patch 的路径都是阻塞（`CORE_SEAM_BLOCKER`），不是待办。

## 会话开始必读（提示词注入要求）

在本仓库工作的一切 agent（主 Agent、任务子代理、review 子代理、workflow 拉起的任意代理），**会话/子任务开始后的第一步**必须读取：

1. `docs/ROUTER_RULES.md` — 无人值守执行协议：Phase DAG（P0→G0→…→P10→G10→RELEASE）、每任务 ≤3 次执行、Gate 三独立 reviewer 规则与四种裁决、blocker 类型与固定格式、git 纪律（1 task=1 branch=1 worktree=1 writer、cherry-pick -x 到 int 分支、Gate 过后才进 master）。
2. `docs/TEST_METHODS.md` — 测试基础设施约束：测试 DSH 源码 = `references/deepseek-harness-test-use`（pristine upstream），DSH_HOME = `references/.dsh-test`（**必须工作区内**，workspace-write 沙箱约束），port = `3180`；构建/启动绕行链与沙箱实测见其 §2/§5；**严禁影响稳定开发实例**（:3080 与 `D:\deepseek-harness\` 部署）。

读取之后才可执行任务；不得以"上下文已熟悉"为由跳过，不得违反其中禁止项。

## 文档权威序

upstream 公开契约 → `docs/plans/paused/` 四份 20260829 冻结文档（Architecture / UI / Development Plan / Task Decomposition，只读、语义唯一权威；2026-09-02 由 `docs/plans/active/` 移入 `docs/plans/paused/`，冻结基线地位不变）→ `docs/plans/active/` 当期执行计划（T12 Production Vertical Closure（已关闭，VERDICT GO @ c455c43）/ P9 UI Legacy-Reuse 实施计划（当前阶段，P9_VERDICT GO @ 0738b45，2026-09-04）；local、gitignored）→ `docs/ROUTER_RULES.md`（执行协议）→ `docs/TEST_METHODS.md`（测试约束）→ `docs/migration/`（legacy inventory/reuse map，参考）→ legacy 代码（仅证据）→ 实现便利。冲突时按此序裁决，科学/设计理由需显式记录。

## 目录约定

| 路径 | 性质 |
| --- | --- |
| `docs/plans/active/` | 当期执行计划（local、gitignored；T12 = 已关闭，P9 UI = 当前阶段；用户/主 Agent 产物，禁 worker 改动） |
| `docs/plans/paused/` | 20260829 冻结四份 + G8 审计报告 + P8-S 收束计划（local、gitignored；只读冻结基线，四份冻结文档仍为语义唯一权威） |
| `docs/ROUTER_RULES.md` / `docs/TEST_METHODS.md` | 执行协议 / 测试约束（用户裁决可改，改动需记录） |
| `docs/STATUS.md` | 当前状态总览（living 快照，非权威源；权威 = `dev/agent-workflow/graph.yaml` + `SESSION_ROUTER_LOG.md`） |
| `docs/contracts/` | contracts v1 冻结确认记录（P3-T6） |
| `docs/migration/` | legacy 行为清单、reuse map |
| `dev/agent-workflow/` | 编排状态 `graph.yaml`、只追加日志 `SESSION_ROUTER_LOG.md`、证据 `evidence/<task>/` |
| `references/deepseek-harness/` | 冻结 legacy fork 参考（只读；HEAD 锁 `a3ab319927...`，tag `legacy-agent-team-pre-vnext`；禁止任何 vNext 开发） |
| `references/deepseek-harness-test-use/` | 测试专用 DSH 源码（pristine upstream 角色；唯一允许的运行时源码；基线 0.1.2-rc.1 @ `76fda72979`（2026-09-04 in-place 升级，R122 留痕）；见 TEST_METHODS.md） |
| `.worktrees/` | 任务 worktree（gitignored；一个任务一个） |
| 根 `packages/` | vNext 9-package 结构（contracts/domain/storage/runtime/tools/remote/client/legacy/testkit，TaskDoc §11 冻结；P0 骨架 → P1–P9 完整实现，P9 GO 2026-09-04）；**禁止**复制 legacy `packages/team` 源码进来 |

## 红线（全局禁止 block）

- 不得修改 upstream 源码；不得 import/使用 upstream 私有/内部 API；不得使用 patch-package / pnpm patch / postinstall 改写 upstream；不得 git apply Team patch 到 upstream/host 树；不得 vendored 修改过的 upstream 副本。
- 不得把 legacy Team SessionEvent 词汇当 vNext 权威（vNext 无 Team SessionEvents；对象模型以 Architecture 文档为准：TeamBlueprint→TeamSession+TeamDomain→MemberInstance）。
- 不得重写 legacy 历史；不得移动冻结分支 `feat/team-vnext-integration-20260829`。
- 禁止 push（用户明确许可的一次性推送除外）；master 的 push 由主 Agent 在每个 Gate 通过后执行；gated 历史不得 force-push。
- 影响面必须可逆：任何对运行实例、worktree、远端的操作在 evidence 中留痕。

## 状态与恢复

- 编排状态唯一来源：`dev/agent-workflow/graph.yaml`（不依赖会话记忆）；执行日志只追加：`dev/agent-workflow/SESSION_ROUTER_LOG.md`。
- 会话恢复后：先读 graph.yaml 定位 current_phase 与 ready 任务，再读 SESSION_ROUTER_LOG.md 末尾若干条目，然后继续；不要重建已完成的工作。
- 文档系统（`AGENTS.md` / `README.md` / `docs/STATUS.md` / `docs/ROUTER_RULES.md` / `docs/TEST_METHODS.md`）是快照而非权威：与 graph.yaml + 日志最新条目冲突时，以 graph.yaml + 日志为准，并在当轮修正文档（R123 文档对齐先例）。
