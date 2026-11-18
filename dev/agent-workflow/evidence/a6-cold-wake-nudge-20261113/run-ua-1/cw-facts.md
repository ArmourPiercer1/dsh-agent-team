# A6 COLD-WAKE NUDGE — run facts

- arm: `none`
- kill point: `after-decision`
- verdict: **PASS**
- detail: step1 user-approval: listed=true leaderProbeTyped=true leaderClosed=false humanDecided=true outcome=human-decided

```json
{
  "schema": "a6-cold-wake-nudge/1",
  "recordClass": "DEV-LIVE",
  "arm": "none",
  "killPoint": "after-decision",
  "flags": {
    "leaderProbe": false,
    "userApproval": true,
    "memberWork": false
  },
  "windowMs": 65000,
  "nudgeMarker": "C1MK_NUDGE_2026-11-13T15-12-10-h0-re9bf40",
  "runStamp": "2026-11-13T15-12-10-h0-re9bf40",
  "startedAt": "2026-11-13T15:12:20.372Z",
  "composition": {
    "hostBaseline": "0.2.0-rc.2",
    "hostPin": "639ed015397290b3745d163aafe02ffee4aa3f84",
    "planeTakeover": true,
    "alpha6ReviewRouting": true,
    "governedRealm": true,
    "wakeIntentPath": "/home/armourpiercer/projects/dsh-agent-team/.worktrees/a6-cold-wake-nudge-20261113/tests/homes/c1-smoke-2026-11-13T15-12-10-h0-re9bf40/alpha6-wake-intents",
    "createRoot": "session-a1-root-2026-11-13T15-12-10-h0-re9bf40",
    "blueprint": "v5 Team: memberIoCeilings + reviewRouting (reissue allow list)"
  },
  "timeline": [
    {
      "at": "2026-11-13T15:12:20.680Z",
      "phase": "team-create",
      "ok": true
    },
    {
      "at": "2026-11-13T15:12:20.918Z",
      "phase": "members-created",
      "officer": "inst-1mhrj4o1wefe",
      "officerSession": "session-team-child-014312bb4a1bc3d17036d571dfaae1f2",
      "worker": "inst-1p98ktw1miyx"
    },
    {
      "at": "2026-11-13T15:12:20.976Z",
      "phase": "pre-crash-delegate",
      "status": 200
    },
    {
      "at": "2026-11-13T15:12:21.077Z",
      "phase": "pre-crash-bash-call",
      "callId": "call-c1-c7e8rl6i"
    },
    {
      "at": "2026-11-13T15:12:21.179Z",
      "phase": "pre-crash-request",
      "requestId": "ctrl-1duy0iz0o1s0vy18x62sd03s",
      "actionName": "parameter-permission"
    },
    {
      "at": "2026-11-13T15:12:21.380Z",
      "phase": "pre-crash-decision",
      "requestId": "ctrl-1duy0iz0o1s0vy18x62sd03s",
      "decider": {
        "instanceId": "inst-1mhrj4o1wefe",
        "kind": "instance",
        "role": "member"
      },
      "wakeTurns": 3
    },
    {
      "at": "2026-11-13T15:12:42.479Z",
      "phase": "kill-point",
      "point": "after-decision",
      "consumed": null,
      "exec": null
    },
    {
      "at": "2026-11-13T15:12:42.530Z",
      "phase": "sigkill",
      "dead": true,
      "seqAtKill": 13,
      "wakeFilesAtKill": [
        "wake-3acf2c35.json"
      ],
      "point": "after-decision"
    },
    {
      "at": "2026-11-13T15:12:44.146Z",
      "phase": "cold-boot",
      "port": 13010,
      "seq": 13
    },
    {
      "at": "2026-11-13T15:12:56.149Z",
      "phase": "recovery-settled",
      "wakeFiles": 1,
      "seq": 13
    },
    {
      "at": "2026-11-13T15:12:56.149Z",
      "phase": "recovery-wake-turns",
      "count": 0
    },
    {
      "at": "2026-11-13T15:12:56.416Z",
      "phase": "user-approval-member",
      "instanceId": "inst-030kgum06xtp",
      "refusal": null
    },
    {
      "at": "2026-11-13T15:12:56.468Z",
      "phase": "user-approval-listed",
      "requestId": "ctrl-0rt9ztg15mnue11uqkvau1ab",
      "listed": true,
      "kind": "user-approval"
    },
    {
      "at": "2026-11-13T15:12:56.469Z",
      "phase": "user-approval-leader-probe",
      "status": 200,
      "refusal": "rejected: CONTROL_RESOLVER_NOT_AUTHORIZED ControlService: role 'leader' is not a resolver for kind 'user-approval' (allowed: [human])",
      "leaderDecision": null
    },
    {
      "at": "2026-11-13T15:12:56.505Z",
      "phase": "user-approval-operator",
      "status": 200,
      "code": null,
      "decider": {
        "humanId": "session-a1-root-2026-11-13T15-12-10-h0-re9bf40",
        "kind": "human"
      }
    }
  ],
  "wakeIntentSnapshots": [
    {
      "at": "2026-11-13T15:12:20.918Z",
      "label": "after-team-create",
      "rows": [],
      "raw": []
    },
    {
      "at": "2026-11-13T15:12:42.479Z",
      "label": "pre-kill",
      "rows": [
        {
          "name": "wake-3acf2c35.json",
          "status": "accepted",
          "wakeId": "review-wake:session-a1-root-2026-11-13T15-12-10-h0-re9bf40:inst-1mhrj4o1wefe:1:a6wake%3Av1%3A1%3Ad0beeaf0",
          "stopped": null,
          "targetSessionId": null
        }
      ],
      "raw": [
        {
          "name": "wake-3acf2c35.json",
          "bytes": 316,
          "body": {
            "key": {
              "rootSessionId": "session-a1-root-2026-11-13T15-12-10-h0-re9bf40",
              "reviewerInstanceId": "inst-1mhrj4o1wefe",
              "sessionGeneration": 1
            },
            "wakeId": "review-wake:session-a1-root-2026-11-13T15-12-10-h0-re9bf40:inst-1mhrj4o1wefe:1:a6wake%3Av1%3A1%3Ad0beeaf0",
            "workFingerprint": "a6wake:v1:1:d0beeaf0",
            "status": "accepted"
          }
        }
      ]
    },
    {
      "at": "2026-11-13T15:12:56.149Z",
      "label": "post-recovery",
      "rows": [
        {
          "name": "wake-3acf2c35.json",
          "status": "accepted",
          "wakeId": "review-wake:session-a1-root-2026-11-13T15-12-10-h0-re9bf40:inst-1mhrj4o1wefe:1:a6wake%3Av1%3A1%3Ad0beeaf0",
          "stopped": null,
          "targetSessionId": null
        }
      ],
      "raw": [
        {
          "name": "wake-3acf2c35.json",
          "bytes": 316,
          "body": {
            "key": {
              "rootSessionId": "session-a1-root-2026-11-13T15-12-10-h0-re9bf40",
              "reviewerInstanceId": "inst-1mhrj4o1wefe",
              "sessionGeneration": 1
            },
            "wakeId": "review-wake:session-a1-root-2026-11-13T15-12-10-h0-re9bf40:inst-1mhrj4o1wefe:1:a6wake%3Av1%3A1%3Ad0beeaf0",
            "workFingerprint": "a6wake:v1:1:d0beeaf0",
            "status": "accepted"
          }
        }
      ]
    },
    {
      "at": "2026-11-13T15:12:56.506Z",
      "label": "end",
      "rows": [
        {
          "name": "wake-3acf2c35.json",
          "status": "accepted",
          "wakeId": "review-wake:session-a1-root-2026-11-13T15-12-10-h0-re9bf40:inst-1mhrj4o1wefe:1:a6wake%3Av1%3A1%3Ad0beeaf0",
          "stopped": null,
          "targetSessionId": null
        }
      ],
      "raw": [
        {
          "name": "wake-3acf2c35.json",
          "bytes": 316,
          "body": {
            "key": {
              "rootSessionId": "session-a1-root-2026-11-13T15-12-10-h0-re9bf40",
              "reviewerInstanceId": "inst-1mhrj4o1wefe",
              "sessionGeneration": 1
            },
            "wakeId": "review-wake:session-a1-root-2026-11-13T15-12-10-h0-re9bf40:inst-1mhrj4o1wefe:1:a6wake%3Av1%3A1%3Ad0beeaf0",
            "workFingerprint": "a6wake:v1:1:d0beeaf0",
            "status": "accepted"
          }
        }
      ]
    }
  ],
  "officerWakeLogLines": [
    "[team-review-wake wakeId=review-wake:session-a1-root-2026-11-13T15-12-10-h0-re9bf40:inst-1mhrj4o1wefe:1:a6wake%3Av1%3A1%3Abc5f0056]",
    "New review work is ready.",
    "reviewer: inst-1mhrj4o1wefe",
    "rootSession: session-a1-root-2026-11-13T15-12-10-h0-re9bf40",
    "requestId:",
    "- ctrl-1duy0iz0o1s0vy18x62sd03s",
    "Decide or escalate with `team_resolve_control` using the EXACT requestId above; `team_list_pending_control` may be Leader-only for a delegated reviewer.",
    "<system-reminder>",
    "The following workspace instructions may be relevant to your work. Use them as guidance when applicable. More specific instructions take precedence over broader ones. They do not override system, developer, or direct user instructions.",
    "Instructions from: AGENTS.md",
    "# AGENTS.md — dsh-agent-team 仓库代理规则",
    "<!-- phase-baseline-ref: dev/engineering/current-authority.json — 当前基线唯一权威=该指针解析到的快照 baseline 字段；本文件只引用、不复制 SHA（tested/历史 SHA 不受此限） -->",
    "<!-- phase-identity: alpha5-sandbox-first -->",
    "本仓库是 DSH Team-mode **vNext** 的 authoritative repository。**CORE PATCH BUDGET = 0**：upstream DSH 保持 clean，全部能力通过外部插件 + 公开 seam 提供；任何需要 upstream source patch 的路径都是阻塞（`CORE_SEAM_BLOCKER`），不是待办。",
    "## 会话开始必读（提示词注入要求）",
    "在本仓库工作的一切 agent（主 Agent、任务子代理、review 子代理、workflow 拉起的任意代理），**会话/子任务开始后的第一步**必须读取：",
    "1. `docs/ROUTER_RULES.md` — 无人值守执行协议：**先读 §0（当期计划优先裁决）**，其余条款为默认底线：blocker 类型与固定格式（含 `CORE_SEAM_BLOCKER`、禁止 patch upstream）、只追加执行日志、无人值守纪律、git 纪律（1 task=1 branch=1 worktree=1 writer、gated 历史禁止 force-push、master=alpha 线 / stable=已裁决 RC）。",
    "2. 当期阶段计划（现为 `docs/plans/active/alpha5-sandbox-first/current-implementation-plan.md`；有效待办唯一入口 = 同目录 `ALPHA5-SANDBOX-BACKLOG.md`，逐工具验收 = 同目录 `TOOL-ACCEPTANCE-MATRIX.md`）— 当期任务分解、并行 lane 与文件所有权、审查组成与顺序、每 PR 合并门、临时语义披露；与 ROUTER_RULES 冲突处以计划为准。",
    "3. `docs/TEST_METHODS.md` — 测试基础设施约束：测试 DSH 源码 = `tests/deepseek-harness-test-use`（pristine upstream，基线 **0.2.0-rc.2 @ `639ed01539`**（2026-10-03 起，宿主升级轮；锚点 = fork 分支 `stable-3-0.2.0-rc.2` tip，fork 无该 tag；此前 0.1.7-rc.1 @ `46a7f68b09`（2026-09-24 … 2026-10-03）、0.1.5-rc.2 @ `fb2c4b9e69`（2026-09-17 起）；**DSH 0.1.2 不再支持**；版本/路径唯一来源 = `tests/paths.mjs`：`DSH_BASELINE_VERSION` / `TEST_USE_BASELINE_SHA` / `CLIENT_COMMIT_HASH`），DSH_HOME = `tests/homes/<world>`（**必须工作区内**，workspace-write 沙箱约束；命名/清理协议见其 §7），port = `3180` 族；构建/启动链与沙箱实测见其 §2/§5；**严禁影响稳定开发实例**（:3080 及其 DSH_HOME）。",
    "读取之后才可执行任务；不得以\"上下文已熟悉\"为由跳过，不得违反其中禁止项。",
    "## 文档权威序",
    "upstream 公开契约 → `docs/plans/finished/` 四份 20260829 冻结文档（Architecture / UI / Development Plan / Task Decomposition，只读、语义唯一权威；2026-09-02 由 `docs/plans/active/` 移入 `docs/plans/paused/`，2026-10-07 归档整理时随 G8 审计报告与 P8-S 收束计划一并移入 `docs/plans/finished/`（tracked，@ b5c8d1dab），冻结基线地位不变；路径引用以本行为准）→ `docs/plans/active/` 当期执行计划 → `docs/ROUTER_RULES.md`（执行协议；其 **§0 = 当期计划优先**裁决）→ `docs/TEST_METHODS.md`（测试约束）→ `docs/migration/`（legacy inventory/reuse map，参考）→ legacy 代码（仅证据）→ 实现便利。冲突时按此序裁决，科学/设计理由需显式记录。",
    "**当前阶段（2026-11-02）**：**Alpha.5 Sandbox-First 阶段**（Member × Tool 两轴上界编译进 Service 与 OS 两条真实执行路径；P1 机制已落地并有证据，逐工具验收 G2–G5 未开始，release BLOCKED）。当期计划集 = `docs/plans/active/alpha5-sandbox-first/`（`current-implementation-plan.md` + `ALPHA5-SANDBOX-BACKLOG.md` + `TOOL-ACCEPTANCE-MATRIX.md`），设计需求正本 = `docs/plans/memo/alpha5-sandbox-first-20261101/`。**当前合同六字段（phase_id / active_plan / backlog / matrix / baseline / baseline_collected）的唯一可编辑当前权威 = `dev/engineering/current-authority.json`**——两键指针 `{snapshot_version, content_digest}`，解析到 `dev/engineering/authority-snapshots/<version>.json` 不可变快照；读取唯一入口 `scripts/current-authority.mjs`（冻结 schema + F0 摘要校验，失败即关闭，绝不回退 graph.yaml 或派生视图），写指针唯一入口 `scripts/switch-authority.mjs`（旧指针字节前置条件 + 原子写 + 失败精确恢复）。原 `dev/agent-workflow/graph.yaml#current_contract` 块已于 2026-10-25 G2 switchover（同 commit set 移除）退役为历史引用；指针与该块并存 = TWO_CURRENT_AUTHORITY，各 gate 点名红；回滚 = `git revert` switch commit set（详见 `dev/engineering/README.md`）。本文件不保留 SHA 副本。**当期唯一实施计划 = `docs/plans/active/alpha5-sandbox-first/current-implementation-plan.md`；设计正本 = PR #531（`docs/plans/memo/alpha5-sandbox-first-20261101/`，2026-11-02 合并）。前一阶段（Alpha.5 工具 IO 治理 / PR #364）保留为历史与回归义务，不再是当期实施计划。**以下为前一阶段 **Alpha.4 硬治理阶段（2026-10-07，历史记录）**：当期计划集 = `docs/plans/active/alpha4-permission-governance/`（`ADR-alpha4-hard-governance.md` + `alpha4-permission-governance-spec.md` + `alpha4-implementation-plan.md`，A4-PR0…A4-PR7 串行（PR0 = 耐久治理提案基座，无产品行为变更），仅 PR4∥PR5 在 PR3 接口冻结后可并行）。**该计划自带的执行协议优先于 ROUTER_RULES 的过时条款**（用户 2026-10-07 明确裁决：模型路由解绑、每 Gate 三 reviewer 与每任务 ≤3 次上限由计划的 PR 级审查循环取代；见 `docs/ROUTER_RULES.md` §0）。CORE PATCH BUDGET = 0 与红线不受该裁决影响。实现机制按 superpowers 技能族执行（`subagent-driven-development` / `executing-plans` / `dispatching-parallel-agents` / `test-driven-development` / `using-git-worktrees` / `requesting-code-review` / `receiving-code-review` / `verification-before-completion`，2026-10-07 装入全局技能根 `$DSH_HOME/skills`）。",
    "**逐轮历史指针不再写在本文件**：原先在此行逐轮堆积的 current 指针（T12 关闭 / P9 UI GO / PR #26–#35 / pre-alpha3 收口 F.1–F.6 / PR #37–#56 / test-infra #51 / **Alpha.3 权限面 PR #57–#61** / **DSH 0.2.0-rc.2 宿主升级轮 PR #62**）已停止在此维护；逐轮事实唯一来源 = `dev/agent-workflow/SESSION_ROUTER_LOG.md`（只追加）+ `dev/agent-workflow/graph.yaml`，快照见 `docs/STATUS.md`；已完成计划归档于 `docs/plans/finished/`。",
    "## 目录约定",
    "| 路径 | 性质 |",
    "| --- | --- |",
    "| `docs/plans/active/` | 当期执行计划（**2026-10-07 起纳入 git 跟踪**；当前 = `alpha5-sandbox-first/` 三份当前态文件：current-implementation-plan.md / ALPHA5-SANDBOX-BACKLOG.md / TOOL-ACCEPTANCE-MATRIX.md，2026-11-02 起；前一阶段 `alpha5-tool-io-governance/` 与 `unified-baseline-alpha5/` 留存为历史；用户/主 Agent 产物，禁 worker 改动；阶段完成即移入 `finished/`） |",
    "| `docs/plans/memo/` | 阶段设计/选型 memo 集（tracked）：现期 = `alpha5-sandbox-first-20261101/`（ADR / ARCHITECTURE / IMPLEMENTATION-PLAN / TOOL-ADOPTION-MATRIX / TRANSITION-PLAN = 设计需求正本，各文件顶部 dated banner；当前态见 `active/alpha5-sandbox-first/` 入口）；`alpha5-tool-io-governance/` 与 `unified-baseline-alpha5-20261025/` 留存为历史 |",
    "| `docs/plans/finished/` | 已完成/已关闭计划与指南归档（tracked，2026-10-07 起；只追加历史，不再作为当期需求来源。**20260829 冻结四份 + G8 审计报告 + P8-S 收束计划现居此目录**——只读冻结基线，四份冻结文档仍为语义唯一权威） |",
    "| `docs/plans/issue-fix/` | 单点缺陷修复计划与复盘（tracked，2026-10-07 起） |",
    "| `docs/plans/third-party/` | 第三方外部建议文档（tracked，2026-10-07 起；非需求来源，仅参考） |",
    "| `docs/plans/paused/` | 历史暂停计划目录（tracked；现仅存 alpha.1 时代四份文件。20260829 冻结四份 + G8 审计报告 + P8-S 收束计划已于 2026-10-07 归档移入 `docs/plans/finished/`，只读冻结基线语义不变） |",
    "| `docs/ROUTER_RULES.md` / `docs/TEST_METHODS.md` | 执行协议 / 测试约束（用户裁决可改，改动需记录） |",
    "| `docs/STATUS.md` | 当前状态总览（living 快照，非权威源；权威 = `dev/agent-workflow/graph.yaml` + `SESSION_ROUTER_LOG.md`） |",
    "| `docs/contracts/` | contracts v1 冻结确认记录（P3-T6） |",
    "| `docs/migration/` | legacy 行为清单、reuse map |",
    "| `dev/agent-workflow/` | 编排状态 `graph.yaml`（current_phase / state_pointers / ready / blocked / 轮次记录；其 `current_contract` 块已于 2026-10-25 switchover 退役，见文档权威序）、只追加日志 `SESSION_ROUTER_LOG.md`、证据 `evidence/<task>/` |",
    "| `dev/engineering/` | **当前合同六字段唯一权威 = `current-authority.json` 指针 → `authority-snapshots/<version>.json` 不可变快照**（publisher 唯一写入快照，switch-authority 唯一移动指针，current-authority 唯一读取）；`registry.yaml` 决策登记 + `current-state.json` 生成视图（只读镜像，不得反推权威）；详见其 `README.md` |",
    "| `references/deepseek-harness/` | 冻结 legacy fork 参考（只读；冻结点 = 分支 `feat/team-vnext-integration-20260829` tip 与 tag `legacy-agent-team-pre-vnext`，均锁 `a3ab319927...`（2026-09-05 复核未移动；2026-09-12 本环境再复核未移动；2026-09-17 rc2-repair 轮再复核未移动；2026-09-24 推送 stable-2 轮 ls-remote 再复核未移动；2026-09-28 文档系统对齐轮本地 tag peel + 远端 ls-remote 再复核未移动）；工作树 HEAD 现于 `stable-1-0.1.5-rc.2 @ fb2c4b9e69`（0.1.5-rc.2 官方发布点，2026-09-17 由用户切至本轮 rc.2 契约参考基线；此前本环境为 `master @ c291e7961a`（0.1.5 sync 迁移状态）；原 Windows 机为 `cd5ef814...` 基线对比检出）；**2026-09-24 用户指令**：新建分支 `stable-2-0.1.7-rc.1` @ `46a7f68b09`（upstream `deepseek-ai/deepseek-harness` 的 `dsh-v0.1.7-rc.1` 官方发布点，PR #5073；未 checkout，工作树 HEAD 不变）并连同 23 个官方 `dsh-v*` release tag 推送 origin（一次性授权，零 force-push；evidence `dev/agent-workflow/evidence/stable2-0.1.7-rc.1-sync/`）；禁止任何 vNext 开发；冻结锚点**不得移动**。**2026-10-03 复核（0.2.0-rc.2 宿主升级轮）**：`references/deepseek-harness` 在本环境不存在（`references/` 为 gitignored，环境迁移缺口，STATUS 2026-10-01 行已登记）→ 改以远端复核：`refs/heads/feat/team-vnext-integration-20260829` = `a3ab319927…` 且 tag `legacy-agent-team-pre-vnext` peel = 同 SHA，**未移动**；0.2.0-rc.2 的宿主源由**只读共享 baseline** `/srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness`（分支 `stable-3-0.2.0-rc.2` @ `639ed01539`，porcelain 空）承载，各 worktree 各自 `clone --local --no-hardlinks` 出独立 pristine 运行时，共享 baseline 从不被写入） |",
    "| `tests/` | 测试基础设施（2026-09-12 标准化，test-infra-standardization）：`characterization/`（P2 harness）、`mock/`（mock model 部署 + 证据）、`kits/`（可复用 kit 归位，tracked）、`paths.mjs`（**测试路径、宿主版本与基线 pin 唯一来源**；kit 一律从此取基线，禁硬编码代次）、`deepseek-harness-test-use/`（pristine upstream 测试运行时 checkout，**gitignored**，自身 git 仓，detached @ `639ed015397290b3745d163aafe02ffee4aa3f84` = 0.2.0-rc.2 发布点（2026-10-03 起，宿主升级轮；此前 46a7f68b09 = 0.1.7-rc.1（2026-09-24 … 2026-10-03）、fb2c4b9e69 = 0.1.5-rc.2（2026-09-17 起）；0.1.2 不再支持）；唯一允许的运行时源码；基线代差注记与 home 协议见 TEST_METHODS.md §4.2/§7）、`homes/`（一切 DSH_HOME 世界，**gitignored**）；旧 `references/.dsh-test*` 世界不迁移 |",
    "| `.worktrees/` | 任务 worktree（gitignored；一个任务一个） |",
    "| 根 `packages/` | vNext 9-package 结构（contracts/domain/storage/runtime/tools/remote/client/legacy/testkit，TaskDoc §11 冻结；P0 骨架 → P1–P9 完整实现，P9 GO 2026-09-04）；**禁止**复制 legacy `packages/team` 源码进来 |",
    "## 红线（全局禁止 block）",
    "- 不得修改 upstream 源码；不得 import/使用 upstream 私有/内部 API；不得使用 patch-package / pnpm patch / postinstall 改写 upstream；不得 git apply Team patch 到 upstream/host 树；不得 vendored 修改过的 upstream 副本。",
    "- 不得把 legacy Team SessionEvent 词汇当 vNext 权威（vNext 无 Team SessionEvents；对象模型以 Architecture 文档为准：TeamBlueprint→TeamSession+TeamDomain→MemberInstance）。",
    "- 不得重写 legacy 历史；不得移动冻结分支 `feat/team-vnext-integration-20260829`。",
    "- 禁止 push（用户明确许可的一次性推送除外）；master / stable 的 push 由主 Agent 在对应 Gate 或发布裁决通过后执行；gated 历史不得 force-push。",
    "- **首个正式 release 之前的分支策略**：`master` 是 alpha 开发线，承载下一 alpha 的持续集成；`stable` 只跟踪已经裁决发布的 RC 基线。RC 修复先在独立 task/int 分支完成并过 Gate，再合入 `stable`；不得把未经 RC 裁决的 master alpha 提交直接推进到 stable。首个正式 release 之后必须通过新的发布决策重新定义长期分支策略。",
    "- 影响面必须可逆：任何对运行实例、worktree、远端的操作在 evidence 中留痕。",
    "## 等待纪律（用户裁决，真实 2026-10-30，直接指令）",
    "- 等待 subagent/后台任务时**用 `bash sleep` 在当前轮内等待，不空转 goal 轮次**：sleep 时长按被等任务实际复杂度设定（轻量审查 5 分钟级；boot、全量 CI、多包实现 10 分钟或更久），醒来后检查任务实际落点（证据文件/远端分支/agent registry 状态），未落定继续 sleep；落定即在本轮内处理。",
    "- 禁止以\"本轮无进展\"式短轮次反复唤醒协调者；goal 轮次保留给有实际新事实的工作。",
    "## 状态与恢复",
    "- 编排状态（阶段语句、恢复指针、ready/blocked、轮次记录）唯一来源：`dev/agent-workflow/graph.yaml`（不依赖会话记忆）；当前合同六字段唯一权威：`dev/engineering/current-authority.json` 指针解析到的不可变快照（读取经 `scripts/current-authority.mjs`，失败即关闭，不回退）；执行日志只追加：`dev/agent-workflow/SESSION_ROUTER_LOG.md`。",
    "- 会话恢复后：先读 graph.yaml 定位 current_phase 与 ready 任务，再读 SESSION_ROUTER_LOG.md 末尾若干条目，然后继续；不要重建已完成的工作。",
    "- 文档系统（`AGENTS.md` / `README.md` / `docs/STATUS.md` / `docs/ROUTER_RULES.md` / `docs/TEST_METHODS.md`）是快照而非权威：与 graph.yaml + 日志最新条目冲突时，以 graph.yaml + 日志为准，并在当轮修正文档（R123 文档对齐先例）。",
    "</system-reminder>",
    "Current runtime context. This snapshot supersedes earlier runtime-context snapshots.",
    "Current DSH file policy: danger-full-access. The DSH file sandbox does not restrict file modifications by available operations.",
    "Approval prompts are disabled in this session: actions that require approval are rejected automatically — do not request sandbox escalation (do not set `sandbox_permissions`).",
    "===",
    "[team-review-wake wakeId=review-wake:session-a1-root-2026-11-13T15-12-10-h0-re9bf40:inst-1mhrj4o1wefe:1:a6wake%3Av1%3A1%3Abc5f0056]",
    "New review work is ready.",
    "reviewer: inst-1mhrj4o1wefe",
    "rootSession: session-a1-root-2026-11-13T15-12-10-h0-re9bf40",
    "requestId:",
    "- ctrl-1duy0iz0o1s0vy18x62sd03s",
    "Decide or escalate with `team_resolve_control` using the EXACT requestId above; `team_list_pending_control` may be Leader-only for a delegated reviewer.",
    "<system-reminder>",
    "The following workspace instructions may be relevant to your work. Use them as guidance when applicable. More specific instructions take precedence over broader ones. They do not override system, developer, or direct user instructions.",
    "Instructions from: AGENTS.md",
    "# AGENTS.md — dsh-agent-team 仓库代理规则",
    "<!-- phase-baseline-ref: dev/engineering/current-authority.json — 当前基线唯一权威=该指针解析到的快照 baseline 字段；本文件只引用、不复制 SHA（tested/历史 SHA 不受此限） -->",
    "<!-- phase-identity: alpha5-sandbox-first -->",
    "本仓库是 DSH Team-mode **vNext** 的 authoritative repository。**CORE PATCH BUDGET = 0**：upstream DSH 保持 clean，全部能力通过外部插件 + 公开 seam 提供；任何需要 upstream source patch 的路径都是阻塞（`CORE_SEAM_BLOCKER`），不是待办。",
    "## 会话开始必读（提示词注入要求）",
    "在本仓库工作的一切 agent（主 Agent、任务子代理、review 子代理、workflow 拉起的任意代理），**会话/子任务开始后的第一步**必须读取：",
    "1. `docs/ROUTER_RULES.md` — 无人值守执行协议：**先读 §0（当期计划优先裁决）**，其余条款为默认底线：blocker 类型与固定格式（含 `CORE_SEAM_BLOCKER`、禁止 patch upstream）、只追加执行日志、无人值守纪律、git 纪律（1 task=1 branch=1 worktree=1 writer、gated 历史禁止 force-push、master=alpha 线 / stable=已裁决 RC）。",
    "2. 当期阶段计划（现为 `docs/plans/active/alpha5-sandbox-first/current-implementation-plan.md`；有效待办唯一入口 = 同目录 `ALPHA5-SANDBOX-BACKLOG.md`，逐工具验收 = 同目录 `TOOL-ACCEPTANCE-MATRIX.md`）— 当期任务分解、并行 lane 与文件所有权、审查组成与顺序、每 PR 合并门、临时语义披露；与 ROUTER_RULES 冲突处以计划为准。",
    "3. `docs/TEST_METHODS.md` — 测试基础设施约束：测试 DSH 源码 = `tests/deepseek-harness-test-use`（pristine upstream，基线 **0.2.0-rc.2 @ `639ed01539`**（2026-10-03 起，宿主升级轮；锚点 = fork 分支 `stable-3-0.2.0-rc.2` tip，fork 无该 tag；此前 0.1.7-rc.1 @ `46a7f68b09`（2026-09-24 … 2026-10-03）、0.1.5-rc.2 @ `fb2c4b9e69`（2026-09-17 起）；**DSH 0.1.2 不再支持**；版本/路径唯一来源 = `tests/paths.mjs`：`DSH_BASELINE_VERSION` / `TEST_USE_BASELINE_SHA` / `CLIENT_COMMIT_HASH`），DSH_HOME = `tests/homes/<world>`（**必须工作区内**，workspace-write 沙箱约束；命名/清理协议见其 §7），port = `3180` 族；构建/启动链与沙箱实测见其 §2/§5；**严禁影响稳定开发实例**（:3080 及其 DSH_HOME）。",
    "读取之后才可执行任务；不得以\"上下文已熟悉\"为由跳过，不得违反其中禁止项。",
    "## 文档权威序",
    "upstream 公开契约 → `docs/plans/finished/` 四份 20260829 冻结文档（Architecture / UI / Development Plan / Task Decomposition，只读、语义唯一权威；2026-09-02 由 `docs/plans/active/` 移入 `docs/plans/paused/`，2026-10-07 归档整理时随 G8 审计报告与 P8-S 收束计划一并移入 `docs/plans/finished/`（tracked，@ b5c8d1dab），冻结基线地位不变；路径引用以本行为准）→ `docs/plans/active/` 当期执行计划 → `docs/ROUTER_RULES.md`（执行协议；其 **§0 = 当期计划优先**裁决）→ `docs/TEST_METHODS.md`（测试约束）→ `docs/migration/`（legacy inventory/reuse map，参考）→ legacy 代码（仅证据）→ 实现便利。冲突时按此序裁决，科学/设计理由需显式记录。",
    "**当前阶段（2026-11-02）**：**Alpha.5 Sandbox-First 阶段**（Member × Tool 两轴上界编译进 Service 与 OS 两条真实执行路径；P1 机制已落地并有证据，逐工具验收 G2–G5 未开始，release BLOCKED）。当期计划集 = `docs/plans/active/alpha5-sandbox-first/`（`current-implementation-plan.md` + `ALPHA5-SANDBOX-BACKLOG.md` + `TOOL-ACCEPTANCE-MATRIX.md`），设计需求正本 = `docs/plans/memo/alpha5-sandbox-first-20261101/`。**当前合同六字段（phase_id / active_plan / backlog / matrix / baseline / baseline_collected）的唯一可编辑当前权威 = `dev/engineering/current-authority.json`**——两键指针 `{snapshot_version, content_digest}`，解析到 `dev/engineering/authority-snapshots/<version>.json` 不可变快照；读取唯一入口 `scripts/current-authority.mjs`（冻结 schema + F0 摘要校验，失败即关闭，绝不回退 graph.yaml 或派生视图），写指针唯一入口 `scripts/switch-authority.mjs`（旧指针字节前置条件 + 原子写 + 失败精确恢复）。原 `dev/agent-workflow/graph.yaml#current_contract` 块已于 2026-10-25 G2 switchover（同 commit set 移除）退役为历史引用；指针与该块并存 = TWO_CURRENT_AUTHORITY，各 gate 点名红；回滚 = `git revert` switch commit set（详见 `dev/engineering/README.md`）。本文件不保留 SHA 副本。**当期唯一实施计划 = `docs/plans/active/alpha5-sandbox-first/current-implementation-plan.md`；设计正本 = PR #531（`docs/plans/memo/alpha5-sandbox-first-20261101/`，2026-11-02 合并）。前一阶段（Alpha.5 工具 IO 治理 / PR #364）保留为历史与回归义务，不再是当期实施计划。**以下为前一阶段 **Alpha.4 硬治理阶段（2026-10-07，历史记录）**：当期计划集 = `docs/plans/active/alpha4-permission-governance/`（`ADR-alpha4-hard-governance.md` + `alpha4-permission-governance-spec.md` + `alpha4-implementation-plan.md`，A4-PR0…A4-PR7 串行（PR0 = 耐久治理提案基座，无产品行为变更），仅 PR4∥PR5 在 PR3 接口冻结后可并行）。**该计划自带的执行协议优先于 ROUTER_RULES 的过时条款**（用户 2026-10-07 明确裁决：模型路由解绑、每 Gate 三 reviewer 与每任务 ≤3 次上限由计划的 PR 级审查循环取代；见 `docs/ROUTER_RULES.md` §0）。CORE PATCH BUDGET = 0 与红线不受该裁决影响。实现机制按 superpowers 技能族执行（`subagent-driven-development` / `executing-plans` / `dispatching-parallel-agents` / `test-driven-development` / `using-git-worktrees` / `requesting-code-review` / `receiving-code-review` / `verification-before-completion`，2026-10-07 装入全局技能根 `$DSH_HOME/skills`）。",
    "**逐轮历史指针不再写在本文件**：原先在此行逐轮堆积的 current 指针（T12 关闭 / P9 UI GO / PR #26–#35 / pre-alpha3 收口 F.1–F.6 / PR #37–#56 / test-infra #51 / **Alpha.3 权限面 PR #57–#61** / **DSH 0.2.0-rc.2 宿主升级轮 PR #62**）已停止在此维护；逐轮事实唯一来源 = `dev/agent-workflow/SESSION_ROUTER_LOG.md`（只追加）+ `dev/agent-workflow/graph.yaml`，快照见 `docs/STATUS.md`；已完成计划归档于 `docs/plans/finished/`。",
    "## 目录约定",
    "| 路径 | 性质 |",
    "| --- | --- |",
    "| `docs/plans/active/` | 当期执行计划（**2026-10-07 起纳入 git 跟踪**；当前 = `alpha5-sandbox-first/` 三份当前态文件：current-implementation-plan.md / ALPHA5-SANDBOX-BACKLOG.md / TOOL-ACCEPTANCE-MATRIX.md，2026-11-02 起；前一阶段 `alpha5-tool-io-governance/` 与 `unified-baseline-alpha5/` 留存为历史；用户/主 Agent 产物，禁 worker 改动；阶段完成即移入 `finished/`） |",
    "| `docs/plans/memo/` | 阶段设计/选型 memo 集（tracked）：现期 = `alpha5-sandbox-first-20261101/`（ADR / ARCHITECTURE / IMPLEMENTATION-PLAN / TOOL-ADOPTION-MATRIX / TRANSITION-PLAN = 设计需求正本，各文件顶部 dated banner；当前态见 `active/alpha5-sandbox-first/` 入口）；`alpha5-tool-io-governance/` 与 `unified-baseline-alpha5-20261025/` 留存为历史 |",
    "| `docs/plans/finished/` | 已完成/已关闭计划与指南归档（tracked，2026-10-07 起；只追加历史，不再作为当期需求来源。**20260829 冻结四份 + G8 审计报告 + P8-S 收束计划现居此目录**——只读冻结基线，四份冻结文档仍为语义唯一权威） |",
    "| `docs/plans/issue-fix/` | 单点缺陷修复计划与复盘（tracked，2026-10-07 起） |",
    "| `docs/plans/third-party/` | 第三方外部建议文档（tracked，2026-10-07 起；非需求来源，仅参考） |",
    "| `docs/plans/paused/` | 历史暂停计划目录（tracked；现仅存 alpha.1 时代四份文件。20260829 冻结四份 + G8 审计报告 + P8-S 收束计划已于 2026-10-07 归档移入 `docs/plans/finished/`，只读冻结基线语义不变） |",
    "| `docs/ROUTER_RULES.md` / `docs/TEST_METHODS.md` | 执行协议 / 测试约束（用户裁决可改，改动需记录） |",
    "| `docs/STATUS.md` | 当前状态总览（living 快照，非权威源；权威 = `dev/agent-workflow/graph.yaml` + `SESSION_ROUTER_LOG.md`） |",
    "| `docs/contracts/` | contracts v1 冻结确认记录（P3-T6） |",
    "| `docs/migration/` | legacy 行为清单、reuse map |",
    "| `dev/agent-workflow/` | 编排状态 `graph.yaml`（current_phase / state_pointers / ready / blocked / 轮次记录；其 `current_contract` 块已于 2026-10-25 switchover 退役，见文档权威序）、只追加日志 `SESSION_ROUTER_LOG.md`、证据 `evidence/<task>/` |",
    "| `dev/engineering/` | **当前合同六字段唯一权威 = `current-authority.json` 指针 → `authority-snapshots/<version>.json` 不可变快照**（publisher 唯一写入快照，switch-authority 唯一移动指针，current-authority 唯一读取）；`registry.yaml` 决策登记 + `current-state.json` 生成视图（只读镜像，不得反推权威）；详见其 `README.md` |",
    "| `references/deepseek-harness/` | 冻结 legacy fork 参考（只读；冻结点 = 分支 `feat/team-vnext-integration-20260829` tip 与 tag `legacy-agent-team-pre-vnext`，均锁 `a3ab319927...`（2026-09-05 复核未移动；2026-09-12 本环境再复核未移动；2026-09-17 rc2-repair 轮再复核未移动；2026-09-24 推送 stable-2 轮 ls-remote 再复核未移动；2026-09-28 文档系统对齐轮本地 tag peel + 远端 ls-remote 再复核未移动）；工作树 HEAD 现于 `stable-1-0.1.5-rc.2 @ fb2c4b9e69`（0.1.5-rc.2 官方发布点，2026-09-17 由用户切至本轮 rc.2 契约参考基线；此前本环境为 `master @ c291e7961a`（0.1.5 sync 迁移状态）；原 Windows 机为 `cd5ef814...` 基线对比检出）；**2026-09-24 用户指令**：新建分支 `stable-2-0.1.7-rc.1` @ `46a7f68b09`（upstream `deepseek-ai/deepseek-harness` 的 `dsh-v0.1.7-rc.1` 官方发布点，PR #5073；未 checkout，工作树 HEAD 不变）并连同 23 个官方 `dsh-v*` release tag 推送 origin（一次性授权，零 force-push；evidence `dev/agent-workflow/evidence/stable2-0.1.7-rc.1-sync/`）；禁止任何 vNext 开发；冻结锚点**不得移动**。**2026-10-03 复核（0.2.0-rc.2 宿主升级轮）**：`references/deepseek-harness` 在本环境不存在（`references/` 为 gitignored，环境迁移缺口，STATUS 2026-10-01 行已登记）→ 改以远端复核：`refs/heads/feat/team-vnext-integration-20260829` = `a3ab319927…` 且 tag `legacy-agent-team-pre-vnext` peel = 同 SHA，**未移动**；0.2.0-rc.2 的宿主源由**只读共享 baseline** `/srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness`（分支 `stable-3-0.2.0-rc.2` @ `639ed01539`，porcelain 空）承载，各 worktree 各自 `clone --local --no-hardlinks` 出独立 pristine 运行时，共享 baseline 从不被写入） |",
    "| `tests/` | 测试基础设施（2026-09-12 标准化，test-infra-standardization）：`characterization/`（P2 harness）、`mock/`（mock model 部署 + 证据）、`kits/`（可复用 kit 归位，tracked）、`paths.mjs`（**测试路径、宿主版本与基线 pin 唯一来源**；kit 一律从此取基线，禁硬编码代次）、`deepseek-harness-test-use/`（pristine upstream 测试运行时 checkout，**gitignored**，自身 git 仓，detached @ `639ed015397290b3745d163aafe02ffee4aa3f84` = 0.2.0-rc.2 发布点（2026-10-03 起，宿主升级轮；此前 46a7f68b09 = 0.1.7-rc.1（2026-09-24 … 2026-10-03）、fb2c4b9e69 = 0.1.5-rc.2（2026-09-17 起）；0.1.2 不再支持）；唯一允许的运行时源码；基线代差注记与 home 协议见 TEST_METHODS.md §4.2/§7）、`homes/`（一切 DSH_HOME 世界，**gitignored**）；旧 `references/.dsh-test*` 世界不迁移 |",
    "| `.worktrees/` | 任务 worktree（gitignored；一个任务一个） |",
    "| 根 `packages/` | vNext 9-package 结构（contracts/domain/storage/runtime/tools/remote/client/legacy/testkit，TaskDoc §11 冻结；P0 骨架 → P1–P9 完整实现，P9 GO 2026-09-04）；**禁止**复制 legacy `packages/team` 源码进来 |",
    "## 红线（全局禁止 block）",
    "- 不得修改 upstream 源码；不得 import/使用 upstream 私有/内部 API；不得使用 patch-package / pnpm patch / postinstall 改写 upstream；不得 git apply Team patch 到 upstream/host 树；不得 vendored 修改过的 upstream 副本。",
    "- 不得把 legacy Team SessionEvent 词汇当 vNext 权威（vNext 无 Team SessionEvents；对象模型以 Architecture 文档为准：TeamBlueprint→TeamSession+TeamDomain→MemberInstance）。",
    "- 不得重写 legacy 历史；不得移动冻结分支 `feat/team-vnext-integration-20260829`。",
    "- 禁止 push（用户明确许可的一次性推送除外）；master / stable 的 push 由主 Agent 在对应 Gate 或发布裁决通过后执行；gated 历史不得 force-push。",
    "- **首个正式 release 之前的分支策略**：`master` 是 alpha 开发线，承载下一 alpha 的持续集成；`stable` 只跟踪已经裁决发布的 RC 基线。RC 修复先在独立 task/int 分支完成并过 Gate，再合入 `stable`；不得把未经 RC 裁决的 master alpha 提交直接推进到 stable。首个正式 release 之后必须通过新的发布决策重新定义长期分支策略。",
    "- 影响面必须可逆：任何对运行实例、worktree、远端的操作在 evidence 中留痕。",
    "## 等待纪律（用户裁决，真实 2026-10-30，直接指令）",
    "- 等待 subagent/后台任务时**用 `bash sleep` 在当前轮内等待，不空转 goal 轮次**：sleep 时长按被等任务实际复杂度设定（轻量审查 5 分钟级；boot、全量 CI、多包实现 10 分钟或更久），醒来后检查任务实际落点（证据文件/远端分支/agent registry 状态），未落定继续 sleep；落定即在本轮内处理。",
    "- 禁止以\"本轮无进展\"式短轮次反复唤醒协调者；goal 轮次保留给有实际新事实的工作。",
    "## 状态与恢复",
    "- 编排状态（阶段语句、恢复指针、ready/blocked、轮次记录）唯一来源：`dev/agent-workflow/graph.yaml`（不依赖会话记忆）；当前合同六字段唯一权威：`dev/engineering/current-authority.json` 指针解析到的不可变快照（读取经 `scripts/current-authority.mjs`，失败即关闭，不回退）；执行日志只追加：`dev/agent-workflow/SESSION_ROUTER_LOG.md`。",
    "- 会话恢复后：先读 graph.yaml 定位 current_phase 与 ready 任务，再读 SESSION_ROUTER_LOG.md 末尾若干条目，然后继续；不要重建已完成的工作。",
    "- 文档系统（`AGENTS.md` / `README.md` / `docs/STATUS.md` / `docs/ROUTER_RULES.md` / `docs/TEST_METHODS.md`）是快照而非权威：与 graph.yaml + 日志最新条目冲突时，以 graph.yaml + 日志为准，并在当轮修正文档（R123 文档对齐先例）。",
    "</system-reminder>",
    "Current runtime context. This snapshot supersedes earlier runtime-context snapshots.",
    "Current DSH file policy: danger-full-access. The DSH file sandbox does not restrict file modifications by available operations.",
    "Approval prompts are disabled in this session: actions that require approval are rejected automatically — do not request sandbox escalation (do not set `sandbox_permissions`).",
    "===",
    "[team-review-wake wakeId=review-wake:session-a1-root-2026-11-13T15-12-10-h0-re9bf40:inst-1mhrj4o1wefe:1:a6wake%3Av1%3A1%3Abc5f0056]",
    "New review work is ready.",
    "reviewer: inst-1mhrj4o1wefe",
    "rootSession: session-a1-root-2026-11-13T15-12-10-h0-re9bf40",
    "requestId:",
    "- ctrl-1duy0iz0o1s0vy18x62sd03s",
    "Decide or escalate with `team_resolve_control` using the EXACT requestId above; `team_list_pending_control` may be Leader-only for a delegated reviewer.",
    "<system-reminder>",
    "The following workspace instructions may be relevant to your work. Use them as guidance when applicable. More specific instructions take precedence over broader ones. They do not override system, developer, or direct user instructions.",
    "Instructions from: AGENTS.md",
    "# AGENTS.md — dsh-agent-team 仓库代理规则",
    "<!-- phase-baseline-ref: dev/engineering/current-authority.json — 当前基线唯一权威=该指针解析到的快照 baseline 字段；本文件只引用、不复制 SHA（tested/历史 SHA 不受此限） -->",
    "<!-- phase-identity: alpha5-sandbox-first -->",
    "本仓库是 DSH Team-mode **vNext** 的 authoritative repository。**CORE PATCH BUDGET = 0**：upstream DSH 保持 clean，全部能力通过外部插件 + 公开 seam 提供；任何需要 upstream source patch 的路径都是阻塞（`CORE_SEAM_BLOCKER`），不是待办。",
    "## 会话开始必读（提示词注入要求）",
    "在本仓库工作的一切 agent（主 Agent、任务子代理、review 子代理、workflow 拉起的任意代理），**会话/子任务开始后的第一步**必须读取：",
    "1. `docs/ROUTER_RULES.md` — 无人值守执行协议：**先读 §0（当期计划优先裁决）**，其余条款为默认底线：blocker 类型与固定格式（含 `CORE_SEAM_BLOCKER`、禁止 patch upstream）、只追加执行日志、无人值守纪律、git 纪律（1 task=1 branch=1 worktree=1 writer、gated 历史禁止 force-push、master=alpha 线 / stable=已裁决 RC）。",
    "2. 当期阶段计划（现为 `docs/plans/active/alpha5-sandbox-first/current-implementation-plan.md`；有效待办唯一入口 = 同目录 `ALPHA5-SANDBOX-BACKLOG.md`，逐工具验收 = 同目录 `TOOL-ACCEPTANCE-MATRIX.md`）— 当期任务分解、并行 lane 与文件所有权、审查组成与顺序、每 PR 合并门、临时语义披露；与 ROUTER_RULES 冲突处以计划为准。",
    "3. `docs/TEST_METHODS.md` — 测试基础设施约束：测试 DSH 源码 = `tests/deepseek-harness-test-use`（pristine upstream，基线 **0.2.0-rc.2 @ `639ed01539`**（2026-10-03 起，宿主升级轮；锚点 = fork 分支 `stable-3-0.2.0-rc.2` tip，fork 无该 tag；此前 0.1.7-rc.1 @ `46a7f68b09`（2026-09-24 … 2026-10-03）、0.1.5-rc.2 @ `fb2c4b9e69`（2026-09-17 起）；**DSH 0.1.2 不再支持**；版本/路径唯一来源 = `tests/paths.mjs`：`DSH_BASELINE_VERSION` / `TEST_USE_BASELINE_SHA` / `CLIENT_COMMIT_HASH`），DSH_HOME = `tests/homes/<world>`（**必须工作区内**，workspace-write 沙箱约束；命名/清理协议见其 §7），port = `3180` 族；构建/启动链与沙箱实测见其 §2/§5；**严禁影响稳定开发实例**（:3080 及其 DSH_HOME）。",
    "读取之后才可执行任务；不得以\"上下文已熟悉\"为由跳过，不得违反其中禁止项。",
    "## 文档权威序",
    "upstream 公开契约 → `docs/plans/finished/` 四份 20260829 冻结文档（Architecture / UI / Development Plan / Task Decomposition，只读、语义唯一权威；2026-09-02 由 `docs/plans/active/` 移入 `docs/plans/paused/`，2026-10-07 归档整理时随 G8 审计报告与 P8-S 收束计划一并移入 `docs/plans/finished/`（tracked，@ b5c8d1dab），冻结基线地位不变；路径引用以本行为准）→ `docs/plans/active/` 当期执行计划 → `docs/ROUTER_RULES.md`（执行协议；其 **§0 = 当期计划优先**裁决）→ `docs/TEST_METHODS.md`（测试约束）→ `docs/migration/`（legacy inventory/reuse map，参考）→ legacy 代码（仅证据）→ 实现便利。冲突时按此序裁决，科学/设计理由需显式记录。",
    "**当前阶段（2026-11-02）**：**Alpha.5 Sandbox-First 阶段**（Member × Tool 两轴上界编译进 Service 与 OS 两条真实执行路径；P1 机制已落地并有证据，逐工具验收 G2–G5 未开始，release BLOCKED）。当期计划集 = `docs/plans/active/alpha5-sandbox-first/`（`current-implementation-plan.md` + `ALPHA5-SANDBOX-BACKLOG.md` + `TOOL-ACCEPTANCE-MATRIX.md`），设计需求正本 = `docs/plans/memo/alpha5-sandbox-first-20261101/`。**当前合同六字段（phase_id / active_plan / backlog / matrix / baseline / baseline_collected）的唯一可编辑当前权威 = `dev/engineering/current-authority.json`**——两键指针 `{snapshot_version, content_digest}`，解析到 `dev/engineering/authority-snapshots/<version>.json` 不可变快照；读取唯一入口 `scripts/current-authority.mjs`（冻结 schema + F0 摘要校验，失败即关闭，绝不回退 graph.yaml 或派生视图），写指针唯一入口 `scripts/switch-authority.mjs`（旧指针字节前置条件 + 原子写 + 失败精确恢复）。原 `dev/agent-workflow/graph.yaml#current_contract` 块已于 2026-10-25 G2 switchover（同 commit set 移除）退役为历史引用；指针与该块并存 = TWO_CURRENT_AUTHORITY，各 gate 点名红；回滚 = `git revert` switch commit set（详见 `dev/engineering/README.md`）。本文件不保留 SHA 副本。**当期唯一实施计划 = `docs/plans/active/alpha5-sandbox-first/current-implementation-plan.md`；设计正本 = PR #531（`docs/plans/memo/alpha5-sandbox-first-20261101/`，2026-11-02 合并）。前一阶段（Alpha.5 工具 IO 治理 / PR #364）保留为历史与回归义务，不再是当期实施计划。**以下为前一阶段 **Alpha.4 硬治理阶段（2026-10-07，历史记录）**：当期计划集 = `docs/plans/active/alpha4-permission-governance/`（`ADR-alpha4-hard-governance.md` + `alpha4-permission-governance-spec.md` + `alpha4-implementation-plan.md`，A4-PR0…A4-PR7 串行（PR0 = 耐久治理提案基座，无产品行为变更），仅 PR4∥PR5 在 PR3 接口冻结后可并行）。**该计划自带的执行协议优先于 ROUTER_RULES 的过时条款**（用户 2026-10-07 明确裁决：模型路由解绑、每 Gate 三 reviewer 与每任务 ≤3 次上限由计划的 PR 级审查循环取代；见 `docs/ROUTER_RULES.md` §0）。CORE PATCH BUDGET = 0 与红线不受该裁决影响。实现机制按 superpowers 技能族执行（`subagent-driven-development` / `executing-plans` / `dispatching-parallel-agents` / `test-driven-development` / `using-git-worktrees` / `requesting-code-review` / `receiving-code-review` / `verification-before-completion`，2026-10-07 装入全局技能根 `$DSH_HOME/skills`）。",
    "**逐轮历史指针不再写在本文件**：原先在此行逐轮堆积的 current 指针（T12 关闭 / P9 UI GO / PR #26–#35 / pre-alpha3 收口 F.1–F.6 / PR #37–#56 / test-infra #51 / **Alpha.3 权限面 PR #57–#61** / **DSH 0.2.0-rc.2 宿主升级轮 PR #62**）已停止在此维护；逐轮事实唯一来源 = `dev/agent-workflow/SESSION_ROUTER_LOG.md`（只追加）+ `dev/agent-workflow/graph.yaml`，快照见 `docs/STATUS.md`；已完成计划归档于 `docs/plans/finished/`。",
    "## 目录约定",
    "| 路径 | 性质 |",
    "| --- | --- |",
    "| `docs/plans/active/` | 当期执行计划（**2026-10-07 起纳入 git 跟踪**；当前 = `alpha5-sandbox-first/` 三份当前态文件：current-implementation-plan.md / ALPHA5-SANDBOX-BACKLOG.md / TOOL-ACCEPTANCE-MATRIX.md，2026-11-02 起；前一阶段 `alpha5-tool-io-governance/` 与 `unified-baseline-alpha5/` 留存为历史；用户/主 Agent 产物，禁 worker 改动；阶段完成即移入 `finished/`） |",
    "| `docs/plans/memo/` | 阶段设计/选型 memo 集（tracked）：现期 = `alpha5-sandbox-first-20261101/`（ADR / ARCHITECTURE / IMPLEMENTATION-PLAN / TOOL-ADOPTION-MATRIX / TRANSITION-PLAN = 设计需求正本，各文件顶部 dated banner；当前态见 `active/alpha5-sandbox-first/` 入口）；`alpha5-tool-io-governance/` 与 `unified-baseline-alpha5-20261025/` 留存为历史 |",
    "| `docs/plans/finished/` | 已完成/已关闭计划与指南归档（tracked，2026-10-07 起；只追加历史，不再作为当期需求来源。**20260829 冻结四份 + G8 审计报告 + P8-S 收束计划现居此目录**——只读冻结基线，四份冻结文档仍为语义唯一权威） |",
    "| `docs/plans/issue-fix/` | 单点缺陷修复计划与复盘（tracked，2026-10-07 起） |",
    "| `docs/plans/third-party/` | 第三方外部建议文档（tracked，2026-10-07 起；非需求来源，仅参考） |",
    "| `docs/plans/paused/` | 历史暂停计划目录（tracked；现仅存 alpha.1 时代四份文件。20260829 冻结四份 + G8 审计报告 + P8-S 收束计划已于 2026-10-07 归档移入 `docs/plans/finished/`，只读冻结基线语义不变） |",
    "| `docs/ROUTER_RULES.md` / `docs/TEST_METHODS.md` | 执行协议 / 测试约束（用户裁决可改，改动需记录） |",
    "| `docs/STATUS.md` | 当前状态总览（living 快照，非权威源；权威 = `dev/agent-workflow/graph.yaml` + `SESSION_ROUTER_LOG.md`） |",
    "| `docs/contracts/` | contracts v1 冻结确认记录（P3-T6） |",
    "| `docs/migration/` | legacy 行为清单、reuse map |",
    "| `dev/agent-workflow/` | 编排状态 `graph.yaml`（current_phase / state_pointers / ready / blocked / 轮次记录；其 `current_contract` 块已于 2026-10-25 switchover 退役，见文档权威序）、只追加日志 `SESSION_ROUTER_LOG.md`、证据 `evidence/<task>/` |",
    "| `dev/engineering/` | **当前合同六字段唯一权威 = `current-authority.json` 指针 → `authority-snapshots/<version>.json` 不可变快照**（publisher 唯一写入快照，switch-authority 唯一移动指针，current-authority 唯一读取）；`registry.yaml` 决策登记 + `current-state.json` 生成视图（只读镜像，不得反推权威）；详见其 `README.md` |",
    "| `references/deepseek-harness/` | 冻结 legacy fork 参考（只读；冻结点 = 分支 `feat/team-vnext-integration-20260829` tip 与 tag `legacy-agent-team-pre-vnext`，均锁 `a3ab319927...`（2026-09-05 复核未移动；2026-09-12 本环境再复核未移动；2026-09-17 rc2-repair 轮再复核未移动；2026-09-24 推送 stable-2 轮 ls-remote 再复核未移动；2026-09-28 文档系统对齐轮本地 tag peel + 远端 ls-remote 再复核未移动）；工作树 HEAD 现于 `stable-1-0.1.5-rc.2 @ fb2c4b9e69`（0.1.5-rc.2 官方发布点，2026-09-17 由用户切至本轮 rc.2 契约参考基线；此前本环境为 `master @ c291e7961a`（0.1.5 sync 迁移状态）；原 Windows 机为 `cd5ef814...` 基线对比检出）；**2026-09-24 用户指令**：新建分支 `stable-2-0.1.7-rc.1` @ `46a7f68b09`（upstream `deepseek-ai/deepseek-harness` 的 `dsh-v0.1.7-rc.1` 官方发布点，PR #5073；未 checkout，工作树 HEAD 不变）并连同 23 个官方 `dsh-v*` release tag 推送 origin（一次性授权，零 force-push；evidence `dev/agent-workflow/evidence/stable2-0.1.7-rc.1-sync/`）；禁止任何 vNext 开发；冻结锚点**不得移动**。**2026-10-03 复核（0.2.0-rc.2 宿主升级轮）**：`references/deepseek-harness` 在本环境不存在（`references/` 为 gitignored，环境迁移缺口，STATUS 2026-10-01 行已登记）→ 改以远端复核：`refs/heads/feat/team-vnext-integration-20260829` = `a3ab319927…` 且 tag `legacy-agent-team-pre-vnext` peel = 同 SHA，**未移动**；0.2.0-rc.2 的宿主源由**只读共享 baseline** `/srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness`（分支 `stable-3-0.2.0-rc.2` @ `639ed01539`，porcelain 空）承载，各 worktree 各自 `clone --local --no-hardlinks` 出独立 pristine 运行时，共享 baseline 从不被写入） |",
    "| `tests/` | 测试基础设施（2026-09-12 标准化，test-infra-standardization）：`characterization/`（P2 harness）、`mock/`（mock model 部署 + 证据）、`kits/`（可复用 kit 归位，tracked）、`paths.mjs`（**测试路径、宿主版本与基线 pin 唯一来源**；kit 一律从此取基线，禁硬编码代次）、`deepseek-harness-test-use/`（pristine upstream 测试运行时 checkout，**gitignored**，自身 git 仓，detached @ `639ed015397290b3745d163aafe02ffee4aa3f84` = 0.2.0-rc.2 发布点（2026-10-03 起，宿主升级轮；此前 46a7f68b09 = 0.1.7-rc.1（2026-09-24 … 2026-10-03）、fb2c4b9e69 = 0.1.5-rc.2（2026-09-17 起）；0.1.2 不再支持）；唯一允许的运行时源码；基线代差注记与 home 协议见 TEST_METHODS.md §4.2/§7）、`homes/`（一切 DSH_HOME 世界，**gitignored**）；旧 `references/.dsh-test*` 世界不迁移 |",
    "| `.worktrees/` | 任务 worktree（gitignored；一个任务一个） |",
    "| 根 `packages/` | vNext 9-package 结构（contracts/domain/storage/runtime/tools/remote/client/legacy/testkit，TaskDoc §11 冻结；P0 骨架 → P1–P9 完整实现，P9 GO 2026-09-04）；**禁止**复制 legacy `packages/team` 源码进来 |",
    "## 红线（全局禁止 block）",
    "- 不得修改 upstream 源码；不得 import/使用 upstream 私有/内部 API；不得使用 patch-package / pnpm patch / postinstall 改写 upstream；不得 git apply Team patch 到 upstream/host 树；不得 vendored 修改过的 upstream 副本。",
    "- 不得把 legacy Team SessionEvent 词汇当 vNext 权威（vNext 无 Team SessionEvents；对象模型以 Architecture 文档为准：TeamBlueprint→TeamSession+TeamDomain→MemberInstance）。",
    "- 不得重写 legacy 历史；不得移动冻结分支 `feat/team-vnext-integration-20260829`。",
    "- 禁止 push（用户明确许可的一次性推送除外）；master / stable 的 push 由主 Agent 在对应 Gate 或发布裁决通过后执行；gated 历史不得 force-push。",
    "- **首个正式 release 之前的分支策略**：`master` 是 alpha 开发线，承载下一 alpha 的持续集成；`stable` 只跟踪已经裁决发布的 RC 基线。RC 修复先在独立 task/int 分支完成并过 Gate，再合入 `stable`；不得把未经 RC 裁决的 master alpha 提交直接推进到 stable。首个正式 release 之后必须通过新的发布决策重新定义长期分支策略。",
    "- 影响面必须可逆：任何对运行实例、worktree、远端的操作在 evidence 中留痕。",
    "## 等待纪律（用户裁决，真实 2026-10-30，直接指令）",
    "- 等待 subagent/后台任务时**用 `bash sleep` 在当前轮内等待，不空转 goal 轮次**：sleep 时长按被等任务实际复杂度设定（轻量审查 5 分钟级；boot、全量 CI、多包实现 10 分钟或更久），醒来后检查任务实际落点（证据文件/远端分支/agent registry 状态），未落定继续 sleep；落定即在本轮内处理。",
    "- 禁止以\"本轮无进展\"式短轮次反复唤醒协调者；goal 轮次保留给有实际新事实的工作。",
    "## 状态与恢复",
    "- 编排状态（阶段语句、恢复指针、ready/blocked、轮次记录）唯一来源：`dev/agent-workflow/graph.yaml`（不依赖会话记忆）；当前合同六字段唯一权威：`dev/engineering/current-authority.json` 指针解析到的不可变快照（读取经 `scripts/current-authority.mjs`，失败即关闭，不回退）；执行日志只追加：`dev/agent-workflow/SESSION_ROUTER_LOG.md`。",
    "- 会话恢复后：先读 graph.yaml 定位 current_phase 与 ready 任务，再读 SESSION_ROUTER_LOG.md 末尾若干条目，然后继续；不要重建已完成的工作。",
    "- 文档系统（`AGENTS.md` / `README.md` / `docs/STATUS.md` / `docs/ROUTER_RULES.md` / `docs/TEST_METHODS.md`）是快照而非权威：与 graph.yaml + 日志最新条目冲突时，以 graph.yaml + 日志为准，并在当轮修正文档（R123 文档对齐先例）。",
    "</system-reminder>",
    "Current runtime context. This snapshot supersedes earlier runtime-context snapshots.",
    "Current DSH file policy: danger-full-access. The DSH file sandbox does not restrict file modifications by available operations.",
    "Approval prompts are disabled in this session: actions that require approval are rejected automatically — do not request sandbox escalation (do not set `sandbox_permissions`).",
    "===",
    "[team-review-wake wakeId=review-wake:session-a1-root-2026-11-13T15-12-10-h0-re9bf40:inst-1mhrj4o1wefe:1:a6wake%3Av1%3A1%3Ad0beeaf0]",
    "New review work is ready.",
    "reviewer: inst-1mhrj4o1wefe",
    "rootSession: session-a1-root-2026-11-13T15-12-10-h0-re9bf40",
    "requestId:",
    "- ctrl-12iomnu1nbc2mv1yziwa81jb",
    "Decide or escalate with `team_resolve_control` using the EXACT requestId above; `team_list_pending_control` may be Leader-only for a delegated reviewer.",
    "===",
    "[team-review-wake wakeId=review-wake:session-a1-root-2026-11-13T15-12-10-h0-re9bf40:inst-1mhrj4o1wefe:1:a6wake%3Av1%3A1%3Ad0beeaf0]",
    "New review work is ready.",
    "reviewer: inst-1mhrj4o1wefe",
    "rootSession: session-a1-root-2026-11-13T15-12-10-h0-re9bf40",
    "requestId:",
    "- ctrl-12iomnu1nbc2mv1yziwa81jb",
    "Decide or escalate with `team_resolve_control` using the EXACT requestId above; `team_list_pending_control` may be Leader-only for a delegated reviewer.",
    "==="
  ],
  "leaderNotificationLogLines": [],
  "nudgeTurns": [],
  "postRestartModelTurns": [],
  "team": {
    "ok": true,
    "blueprintHash": "sha256:3092bef63fb7f81648d8d83b42c12f7cab615ad3d23e4ec1e340125c8482e973",
    "error": null
  },
  "officer": {
    "label": "cw-officer",
    "templateId": "officer",
    "instanceId": "inst-1mhrj4o1wefe",
    "childSessionId": "session-team-child-014312bb4a1bc3d17036d571dfaae1f2",
    "refusal": null,
    "raw": {
      "ok": true,
      "value": {
        "status": "executed",
        "action": "create-member",
        "rootSessionId": "session-a1-root-2026-11-13T15-12-10-h0-re9bf40",
        "callerRole": "leader",
        "effect": {
          "kind": "member-activated",
          "instanceId": "inst-1mhrj4o1wefe",
          "templateId": "officer",
          "childSessionId": "session-team-child-014312bb4a1bc3d17036d571dfaae1f2",
          "operationId": "op-0i7b1h61d2g9vb1i39asw184",
          "replayed": false,
          "ledgerSequence": 3,
          "admissionCode": "ADMISSION_OPEN"
        },
        "requestToken": "mc-cw-officer-2026-11-13T15-12-10-h0-re9bf40-awqyl"
      }
    }
  },
  "worker": {
    "label": "cw-w1",
    "templateId": "w-probe",
    "instanceId": "inst-1p98ktw1miyx",
    "childSessionId": "session-team-child-c0be5954762112874294aa7f99d4ee64",
    "refusal": null,
    "raw": {
      "ok": true,
      "value": {
        "status": "executed",
        "action": "create-member",
        "rootSessionId": "session-a1-root-2026-11-13T15-12-10-h0-re9bf40",
        "callerRole": "leader",
        "effect": {
          "kind": "member-activated",
          "instanceId": "inst-1p98ktw1miyx",
          "templateId": "w-probe",
          "childSessionId": "session-team-child-c0be5954762112874294aa7f99d4ee64",
          "operationId": "op-1o0mt9519dxf0o0y6a2nn0er",
          "replayed": false,
          "ledgerSequence": 4,
          "admissionCode": "ADMISSION_OPEN"
        },
        "requestToken": "mc-cw-w1-2026-11-13T15-12-10-h0-re9bf40-etkgo"
      }
    }
  },
  "preCrashDelegate": {
    "status": 200,
    "refusal": null,
    "body": {
      "ok": true,
      "value": {
        "status": "executed",
        "action": "delegate",
        "rootSessionId": "session-a1-root-2026-11-13T15-12-10-h0-re9bf40",
        "callerRole": "leader",
        "effect": {
          "kind": "work-admitted",
          "instanceId": "inst-1p98ktw1miyx",
          "fromLifecycle": "CREATED",
          "lifecycleCommitted": true,
          "sequence": 5,
          "settled": false,
          "workStatus": "admitted"
        },
        "requestToken": "cw-delegate1-2026-11-13T15-12-10-h0-re9bf40"
      }
    }
  },
  "preCrashCall": {
    "id": "call-c1-c7e8rl6i",
    "name": "bash",
    "at": "2026-11-13T15:12:21.077Z"
  },
  "preCrashRequest": {
    "sequence": 7,
    "factType": "control-request-recorded",
    "requestId": "ctrl-1duy0iz0o1s0vy18x62sd03s",
    "kind": "leader-approval",
    "toolName": "bash",
    "actionName": "parameter-permission",
    "targetInstanceId": "inst-1p98ktw1miyx",
    "correlation": "call-c1-c7e8rl6i",
    "approvalCaseId": "case-1hfoq2a0ww92ar0txohv41xe",
    "legOrdinal": 1,
    "reviewAuthority": "leader",
    "operationOwnerTemplateId": "w-probe",
    "operationToolOwner": "dsh-agent-team",
    "operationToolName": "bash",
    "operationToolDefinitionIdentity": "def#35",
    "authorityGeneration": 0,
    "blueprintContentHash": "sha256:3092bef63fb7f81648d8d83b42c12f7cab615ad3d23e4ec1e340125c8482e973",
    "blueprintRevision": "1",
    "perEffectRequiredAuthorities": [
      "leader"
    ],
    "createdAt": "2026-11-13T15:12:21.152Z"
  },
  "preCrashDecision": {
    "sequence": 8,
    "factType": "control-decision-recorded",
    "requestId": "ctrl-1duy0iz0o1s0vy18x62sd03s",
    "decision": "allow",
    "decider": {
      "instanceId": "inst-1mhrj4o1wefe",
      "kind": "instance",
      "role": "member"
    },
    "createdAt": "2026-11-13T15:12:21.346Z"
  },
  "preCrashWakeTurns": [
    {
      "seq": 7,
      "wakeToken": "review-wake:session-a1-root-2026-11-13T15-12-10-h0-re9bf40:inst-1mhrj4o1wefe:1:a6wake%3Av1%3A1%3Abc5f0056",
      "requestIds": [
        "ctrl-1duy0iz0o1s0vy18x62sd03s"
      ],
      "firstLine": "[team-review-wake wakeId=review-wake:session-a1-root-2026-11-13T15-12-10-h0-re9bf40:inst-1mhrj4o1wefe:1:a6wake%3Av1%3A1%3Abc5f0056]"
    },
    {
      "seq": 8,
      "wakeToken": "review-wake:session-a1-root-2026-11-13T15-12-10-h0-re9bf40:inst-1mhrj4o1wefe:1:a6wake%3Av1%3A1%3Abc5f0056",
      "requestIds": [
        "ctrl-1duy0iz0o1s0vy18x62sd03s"
      ],
      "firstLine": "[team-review-wake wakeId=review-wake:session-a1-root-2026-11-13T15-12-10-h0-re9bf40:inst-1mhrj4o1wefe:1:a6wake%3Av1%3A1%3Abc5f0056]"
    },
    {
      "seq": 9,
      "wakeToken": "review-wake:session-a1-root-2026-11-13T15-12-10-h0-re9bf40:inst-1mhrj4o1wefe:1:a6wake%3Av1%3A1%3Abc5f0056",
      "requestIds": [
        "ctrl-1duy0iz0o1s0vy18x62sd03s"
      ],
      "firstLine": "[team-review-wake wakeId=review-wake:session-a1-root-2026-11-13T15-12-10-h0-re9bf40:inst-1mhrj4o1wefe:1:a6wake%3Av1%3A1%3Abc5f0056]"
    }
  ],
  "kill": {
    "at": "2026-11-13T15:12:42.530Z",
    "dead": true,
    "seqAtKill": 13,
    "wakeFilesAtKill": [
      "wake-3acf2c35.json"
    ],
    "point": "after-decision"
  },
  "restart": {
    "at": "2026-11-13T15:12:44.146Z",
    "port": 13010,
    "seqAtRestart": 13,
    "restarted": true
  },
  "postRestartRecovery": {
    "at": "2026-11-13T15:12:56.149Z",
    "wakeFiles": [
      "wake-3acf2c35.json"
    ],
    "mockRequests": 13,
    "oldRequest": {
      "requestId": "ctrl-1duy0iz0o1s0vy18x62sd03s",
      "decision": {
        "sequence": 8,
        "factType": "control-decision-recorded",
        "requestId": "ctrl-1duy0iz0o1s0vy18x62sd03s",
        "decision": "allow",
        "decider": {
          "instanceId": "inst-1mhrj4o1wefe",
          "kind": "instance",
          "role": "member"
        },
        "createdAt": "2026-11-13T15:12:21.346Z"
      },
      "consumed": {
        "sequence": 9,
        "factType": "control-allow-consumed",
        "requestId": "ctrl-1duy0iz0o1s0vy18x62sd03s",
        "createdAt": "2026-11-13T15:12:21.481Z"
      },
      "execution": {
        "sequence": 14,
        "factType": "control-execution-result",
        "requestId": "ctrl-1duy0iz0o1s0vy18x62sd03s",
        "callId": "call-c1-c7e8rl6i",
        "outcome": "succeeded",
        "recordedAt": "2026-11-13T15:12:42.367Z",
        "createdAt": "2026-11-13T15:12:42.367Z"
      },
      "abandonment": null
    }
  },
  "recoveryWakeTurns": [],
  "freshMember": {
    "label": "cw-wu",
    "templateId": "w-probe",
    "instanceId": "inst-030kgum06xtp",
    "childSessionId": "session-team-child-1bafecce42b802503131c9b5d1f516f3",
    "refusal": null,
    "raw": {
      "ok": true,
      "value": {
        "status": "executed",
        "action": "create-member",
        "rootSessionId": "session-a1-root-2026-11-13T15-12-10-h0-re9bf40",
        "callerRole": "leader",
        "effect": {
          "kind": "member-activated",
          "instanceId": "inst-030kgum06xtp",
          "templateId": "w-probe",
          "childSessionId": "session-team-child-1bafecce42b802503131c9b5d1f516f3",
          "operationId": "op-0ff8kl616e3knz0kyi7os0uw",
          "replayed": false,
          "ledgerSequence": 15,
          "admissionCode": "ADMISSION_OPEN"
        },
        "requestToken": "mc-cw-wu-2026-11-13T15-12-10-h0-re9bf40-9raz2"
      }
    }
  },
  "userApproval": {
    "at": "2026-11-13T15:12:56.468Z",
    "create": {
      "status": 200,
      "refusal": null,
      "value": {
        "status": "control-requested",
        "request": {
          "requestId": "ctrl-0rt9ztg15mnue11uqkvau1ab",
          "rootSessionId": "session-a1-root-2026-11-13T15-12-10-h0-re9bf40",
          "ownerRootSessionId": "session-c1-smoke-root-2026-11-13T15-12-10-h0-re9bf40",
          "kind": "user-approval",
          "requester": {
            "kind": "instance",
            "instanceId": "inst-leader",
            "role": "leader"
          },
          "subject": {
            "kind": "instance",
            "instanceId": "inst-030kgum06xtp"
          },
          "targetInstanceId": "inst-030kgum06xtp",
          "actionName": "user-signoff",
          "correlation": "cw-user-approval-2026-11-13T15-12-10-h0-re9bf40",
          "status": "pending",
          "createdAt": "2026-11-13T15:12:56.447Z",
          "requestSequence": 16,
          "toolName": "bash",
          "summary": "post-restart user-approval probe (the human is the only resolver)"
        }
      }
    },
    "requestId": "ctrl-0rt9ztg15mnue11uqkvau1ab",
    "kind": "user-approval",
    "reviewAuthority": null,
    "listed": true,
    "listCount": 1,
    "listRequestIds": [
      "ctrl-0rt9ztg15mnue11uqkvau1ab"
    ],
    "leaderProbe": {
      "status": 200,
      "refusal": "rejected: CONTROL_RESOLVER_NOT_AUTHORIZED ControlService: role 'leader' is not a resolver for kind 'user-approval' (allowed: [human])",
      "body": {
        "ok": true,
        "value": {
          "status": "rejected",
          "code": "CONTROL_RESOLVER_NOT_AUTHORIZED",
          "message": "ControlService: role 'leader' is not a resolver for kind 'user-approval' (allowed: [human])",
          "details": {
            "rootSessionId": "session-a1-root-2026-11-13T15-12-10-h0-re9bf40",
            "requestId": "ctrl-0rt9ztg15mnue11uqkvau1ab",
            "kind": "user-approval",
            "role": "leader",
            "allowedRoles": [
              "human"
            ]
          }
        }
      }
    },
    "leaderDecision": null,
    "operatorResolve": {
      "at": "2026-11-13T15:12:56.505Z",
      "status": 200,
      "code": null,
      "body": {
        "type": "server-response",
        "rpcId": "cw-user-approval-operator-ncj5rb6es2",
        "result": {
          "ok": true,
          "value": {
            "data": {
              "decision": {
                "requestId": "ctrl-0rt9ztg15mnue11uqkvau1ab",
                "decision": "allow",
                "decider": {
                  "kind": "human",
                  "humanId": "session-a1-root-2026-11-13T15-12-10-h0-re9bf40"
                },
                "scope": {
                  "rootSessionId": "session-a1-root-2026-11-13T15-12-10-h0-re9bf40",
                  "subject": {
                    "kind": "instance",
                    "instanceId": "inst-030kgum06xtp"
                  },
                  "targetInstanceId": "inst-030kgum06xtp",
                  "actionName": "user-signoff",
                  "correlation": "cw-user-approval-2026-11-13T15-12-10-h0-re9bf40",
                  "toolName": "bash"
                },
                "requestSequence": 16,
                "decisionSequence": 17,
                "createdAt": "2026-11-13T15:12:56.500Z",
                "note": "a6-cold-wake-nudge: the human resolves the user-approval leg"
              }
            },
            "provenance": {
              "origin": "team-remote",
              "method": "team.resolveControl",
              "endpoint": "team.resolveControl",
              "contractVersion": 4,
              "requestToken": null,
              "projectionGeneration": null,
              "effectSequence": null
            }
          }
        }
      }
    },
    "operatorDecision": {
      "sequence": 17,
      "factType": "control-decision-recorded",
      "requestId": "ctrl-0rt9ztg15mnue11uqkvau1ab",
      "decision": "allow",
      "decider": {
        "humanId": "session-a1-root-2026-11-13T15-12-10-h0-re9bf40",
        "kind": "human"
      },
      "createdAt": "2026-11-13T15:12:56.489Z"
    }
  },
  "decidedBy": "operator",
  "outcome": "human-decided",
  "verdict": "PASS",
  "detail": "step1 user-approval: listed=true leaderProbeTyped=true leaderClosed=false humanDecided=true outcome=human-decided",
  "clauses": {
    "U-1": true,
    "U-2": true,
    "U-3": true,
    "U-4": true
  },
  "endedAt": "2026-11-13T15:12:56.505Z",
  "finalWakeIntents": [
    {
      "name": "wake-3acf2c35.json",
      "status": "accepted",
      "wakeId": "review-wake:session-a1-root-2026-11-13T15-12-10-h0-re9bf40:inst-1mhrj4o1wefe:1:a6wake%3Av1%3A1%3Ad0beeaf0",
      "stopped": null,
      "targetSessionId": null
    }
  ],
  "nudgeTurnLogLines": []
}
```

## timeline

| at | phase | detail |
| --- | --- | --- |
| 2026-11-13T15:12:20.680Z | team-create | {"ok":true} |
| 2026-11-13T15:12:20.918Z | members-created | {"officer":"inst-1mhrj4o1wefe","officerSession":"session-team-child-014312bb4a1bc3d17036d571dfaae1f2","worker":"inst-1p98ktw1miyx"} |
| 2026-11-13T15:12:20.976Z | pre-crash-delegate | {"status":200} |
| 2026-11-13T15:12:21.077Z | pre-crash-bash-call | {"callId":"call-c1-c7e8rl6i"} |
| 2026-11-13T15:12:21.179Z | pre-crash-request | {"requestId":"ctrl-1duy0iz0o1s0vy18x62sd03s","actionName":"parameter-permission"} |
| 2026-11-13T15:12:21.380Z | pre-crash-decision | {"requestId":"ctrl-1duy0iz0o1s0vy18x62sd03s","decider":{"instanceId":"inst-1mhrj4o1wefe","kind":"instance","role":"member"},"wakeTurns":3} |
| 2026-11-13T15:12:42.479Z | kill-point | {"point":"after-decision","consumed":null,"exec":null} |
| 2026-11-13T15:12:42.530Z | sigkill | {"dead":true,"seqAtKill":13,"wakeFilesAtKill":["wake-3acf2c35.json"],"point":"after-decision"} |
| 2026-11-13T15:12:44.146Z | cold-boot | {"port":13010,"seq":13} |
| 2026-11-13T15:12:56.149Z | recovery-settled | {"wakeFiles":1,"seq":13} |
| 2026-11-13T15:12:56.149Z | recovery-wake-turns | {"count":0} |
| 2026-11-13T15:12:56.416Z | user-approval-member | {"instanceId":"inst-030kgum06xtp","refusal":null} |
| 2026-11-13T15:12:56.468Z | user-approval-listed | {"requestId":"ctrl-0rt9ztg15mnue11uqkvau1ab","listed":true,"kind":"user-approval"} |
| 2026-11-13T15:12:56.469Z | user-approval-leader-probe | {"status":200,"refusal":"rejected: CONTROL_RESOLVER_NOT_AUTHORIZED ControlService: role 'leader' is not a resolver for kind 'user-approval' (allowed: [human])","leaderDecision":null} |
| 2026-11-13T15:12:56.505Z | user-approval-operator | {"status":200,"code":null,"decider":{"humanId":"session-a1-root-2026-11-13T15-12-10-h0-re9bf40","kind":"human"}} |
