# STATUS — Team vNext 当前状态总览

> **性质**：living 快照文档，**不是权威源**。权威 = `dev/agent-workflow/graph.yaml`（编排状态唯一来源）+
> `dev/agent-workflow/SESSION_ROUTER_LOG.md`（只追加执行日志，最新至 R122）。
> **更新纪律**：阶段收口 / 门禁裁决 / 用户指令变更后由主 Agent 同步刷新；文档与权威源冲突时以
> graph.yaml + 日志为准并当轮修正文档（R123 先例，AGENTS.md「状态与恢复」）。
> **最近更新**：2026-09-04（R122 之后，本会话核实）。

## 1. 一句话现状

后端（P0–P8-S）生产闭合完成，T12 生产垂直收束 **GO**（re-stamped @ `c455c43`），P9 UI（legacy
复用）**P9_VERDICT = GO**（S9 @ `0738b45` + post-GO 试用缺陷批次 P9-F1/F2 收口），测试基线已随
上游 in-place 升级适配至 **0.1.2-rc.1 @ `76fda72979`**（R122，五闸全绿）。当前**无在途开发任务**；
下一步 = P10 加固 + 各项推送等待用户授权。

## 2. 阶段总账

| 阶段 | 状态 | 关键证据 / 指针 |
| --- | --- | --- |
| P0–P8（G0–G7） | 全部 Gate PASS（3/3）；master 历史已推送至 push #7 | `graph.yaml` tasks 区；`dev/agent-workflow/evidence/<task>/` |
| P8-S backend closure | S0–S7 DONE（S7-FREEZE：`backend-contract-freeze.md` = P9 唯一 backend contract reference）；S8 / G8-S 未派发（**PAUSED**，用户指令 R83；T12 GO 后是否仍必要待用户裁决，见 §4） | `evidence/P8-S/`（S1A/B/C 审计、confirmed-repair-list、backend-contract-freeze.md） |
| G8-REVIEW | round-1 2/3（1 补充内容）→ G8-S1 实质性补充（1/3）→ round-2 **3/3 通过**（@ `3fa4c1f`） | `evidence/G8-REVIEW/reviewer-{4,5,6}/` |
| P9-PROTO（一次性真实后端原型，2026-09-02） | 终态 **PASS-core**（F1/F2 门全绿；PASS-full 的浏览器 DOM 渲染子证明 = ENV_RENDER_GAP，本沙箱证明性不可行；UI_BACKEND_GAP 记录 carry-over） | `graph.yaml` p9_prototype 区；`evidence/P9-prototype/` |
| T12 生产垂直收束（2026-09-03） | **VERDICT = GO（RE-STAMPED STRENGTHENED @ `c455c43`）**；360 s 窗口缺陷 T12-V16 根因 ROW-OWNED 闭合（零 core）；12/12 defects fixed | `evidence/T12/T12-decision.md` §13c |
| P9 UI（legacy 复用，当前阶段，2026-09-03→04） | **P9_VERDICT = GO**（S9 独立 reviewer `074f4458`，audited tip `0738b45`；DoD-15 = 15/15；reuse-audit 47/47 CONFIRMED / 0 CHALLENGED）；post-GO 试用缺陷 R118（冻结 UI §3.1 全局入口缺失）/ R119×2（创建恒灰 + 面板闪烁）/ R121（孤儿 workspace）经 **P9-F1**（`d199d4d6`）+ **P9-F2**（`dc056d5`）收口，gentry 三轮迭代后 `failures: []` 全绿 | `evidence/P9/s9-verdict.md`；`evidence/P9/reuse-audit.md`；`evidence/P9/s8/`（vertical S1–S9 全绿 attempt 32 证据） |
| 上游 rc.1 兼容（R122，2026-09-04） | **DONE**：五闸全绿（typecheck 8/8、vitest 2532、build 9/9、lint 0、smoke = 3180 vertical）+ 3180 全新世界 boot S8-READY / gentry `failures: []` / 干净世界冒烟 OK；唯一语义缝 `sessionPersistence.ensureMaterialized` → `sessions.flush`（上游 rc.1 自有替换，**非** CORE_SEAM_BLOCKER，在库适配 `bd38827`） | `evidence/upstream-rc1-compat/`（compat-matrix、L2 裁决、闸日志）；`TEST_METHODS.md` 基线行 |

## 3. 当前基线（disk truth，2026-09-04 本会话核实）

| 项 | 值 |
| --- | --- |
| 测试 DSH 源码（pristine） | `references/deepseek-harness-test-use` @ **0.1.2-rc.1 / `76fda72979`**（TEST_METHODS.md §1；工作树 byte-clean 义务不变） |
| 稳定实例红线 | `D:\deepseek-harness\` + :3080 严禁触碰（本会话仅只读探测：当前 :3080 无监听，未做任何操作） |
| 测试端口 | 3180 族（3180–3186 / 3492–3500）；本会话核 **3180 无监听** — R122 world #2 实例（pid 59496，job `pwsh-21`）已随其会话结束，home 可整体清理 |
| master | `c5ef6e6`（R122 bookkeeping）；**领先 origin 10，未 push — 待用户授权** |
| 未推送分支 | `task/P9-ui-legacy-reuse`（tip `dc056d5`）/ `task/upstream-rc1-compat`（`c6bae9c`+`bd38827`）/ `task/T12-vertical-slice`（runner-only V15/V20–V22，`3e7da91`，不入 int 裁决在案）/ P9-PROTO 线（`2a23f52`，local-only，R-PROTO-13 裁决） |
| P9 五闸（`0738b45` 树） | test 150/312/269/124/35/92/1070/471 · typecheck 9/9 · build 9/9 · lint 0 errors · smoke 2/2（R117）；RC1 树 vitest 2532 复跑（R122） |
| p4t6 扫描锁 pin | 601（P9 线终值，bug #7 修复 `3839476` 后；rc.1 适配未新增可扫文件） |
| 冻结 legacy 参考 | `references/deepseek-harness` @ `a3ab319927`（tag `legacy-agent-team-pre-vnext`，只读）未动 |

## 4. 待办 / 等待用户（按优先级）

1. **推送授权**（红线：无显式授权不 push）：master（领先 10）+ §3 所列 task 分支；gated 历史禁 force-push。
2. **P9 task 分支入 master**：cherry-pick -x → int 分支 → Gate → master → push（主 Agent 于 Gate 过后执行；现按会话政策**暂停待用户指示**）。
3. **P10 加固**（P9 计划 L1789）：F-9 untracked-burst emitter 定位 + post-test-gate porcelain 检查；F-7 两个 excluded browser-surface specs；carry-over 清单 = UI_BACKEND_GAP（client node entry `packages/client/dist/plugin/client.js:50` 读 `ctx.slots` 未声明 inject，非规范路径）/ p6t1-parallel flake 类（~1/3）/ testkit `.tmp-fault` scratch 竞态（destroyDir Windows 重试）/ tsc build 内联发射卫生 / 360 s 窗口核心埋点（T12 记录，T12-V16 已修产品面，埋点留 P10）。
4. **G8-S / P8-S8 裁决**：原 P8-S 线的 S8（生产 E2E + race/crash/security 矩阵）与 G8-S gate 在 T12 GO 之后是否仍为必要条件，待用户裁决（T12 已实质覆盖生产垂直闭合；graph `blocked: [G8-S]` 保留）。
5. **卫生/拆线**：3180 测试实例拆线（如仍存在：`job_kill pwsh-21` 或 `node s8-boot.mjs stop`；本会话核已无监听）；inert 旧 home 可删；`dev/agent-workflow/evidence/{P9,T12,upstream-rc1-compat}/` 目前**在 master 工作树 untracked**（未随 `c5ef6e6` 归档）— 归档路径（随 P9 分支合流 or 独立 bookkeeping 提交）待用户/主 Agent 定，避免双轨提交。

## 5. 文档地图

| 文档 | 性质 |
| --- | --- |
| `AGENTS.md` | 仓库代理规则（必读序 / 权威序 / 目录约定 / 红线 / 状态与恢复） |
| `README.md` | 仓库定位、9-package 布局、对象模型摘要、插件入口（生产形态）、命令 |
| `docs/ROUTER_RULES.md` | 无人值守执行路由与门禁协议（模型路由 / 执行上限 / 三 reviewer 裁决 / 阻塞语义 / 日志义务） |
| `docs/TEST_METHODS.md` | 测试实例与沙箱约束（基线 0.1.2-rc.1 @ `76fda72979`；port 3180；裁决历史） |
| `docs/STATUS.md`（本文） | 当前状态总览（快照，非权威） |
| `docs/contracts/` | contracts v1 冻结确认（P3-T6）+ G3 报告 |
| `docs/migration/` | legacy 行为清单 + reuse map（参考） |
| `docs/plans/paused/` | 20260829 冻结四份 + G8 审计报告 + P8-S 收束计划（local、gitignored、只读；四份冻结文档仍为语义唯一权威） |
| `docs/plans/active/` | 当期执行计划：T12 Production Vertical Closure（已关闭）/ P9 UI Legacy-Reuse（当前，GO）（local、gitignored） |
| `dev/agent-workflow/graph.yaml` | **编排状态唯一来源**（current_phase / 任务状态机 / 门禁 / 基线 / rulings） |
| `dev/agent-workflow/SESSION_ROUTER_LOG.md` | **只追加执行日志**（R1–R122；轮次 / Gate / 裁决 / 风险台账 / blocker / TODO） |
| `dev/agent-workflow/evidence/<phase>/` | 证据（早期 phase 已归档 master；P9/T12/rc1-compat 证据当前 untracked，见 §4.5） |

## 6. 红线速查（详见 AGENTS.md）

- CORE PATCH BUDGET = 0：不改 upstream、不用私有 API、不 patch-package、不 vendored 修改副本。
- 稳定实例（`D:\deepseek-harness\` + :3080）严禁触碰；测试只走 3180 族 + `references/.dsh-test*` home。
- 无显式授权不 push；gated 历史禁 force-push；1 task = 1 branch = 1 worktree = 1 writer。
