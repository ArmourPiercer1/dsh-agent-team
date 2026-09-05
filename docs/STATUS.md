# STATUS — Team vNext 当前状态总览

> **性质**：living 快照文档，**不是权威源**。权威 = `dev/agent-workflow/graph.yaml`（编排状态唯一来源）+
> `dev/agent-workflow/SESSION_ROUTER_LOG.md`（只追加执行日志，最新至 R126）。
> **更新纪律**：阶段收口 / 门禁裁决 / 用户指令变更后由主 Agent 同步刷新；文档与权威源冲突时以
> graph.yaml + 日志为准并当轮修正文档（R123 先例，AGENTS.md「状态与恢复」）。
> **最近更新**：2026-09-05（R127–R130：plugin-bundle-form 立项 → D5 垂直全绿 → Gate round 1 3/3 PASS → 推送执行、任务关闭）。

## 1. 一句话现状

**plugin-bundle-form 已收口：Gate Round 1 3/3 PASS → GATE PASS → 推送 origin（R129/R130，2026-09-05）**：
用户新机报告「`pnpm dsh plugin --profile web add github:ArmourPiercer1/dsh-agent-team` 后无 Team UI」
经裁决立项走完整 gate。根 package.json 增加 `dsh.bundle.patch` 声明 + 机器无关包内
`cordis.patch.yml`（glueUrl/seamUrl 从 host entry 自身位置推导、显式优先）+ exports 子路径 +
prepare 构建链 + 根级运行时依赖；**D5 五全新 DSH_HOME 世界走真实 CLI reconcile 路径**
（`plugin add` allowBuilds 放行 prepare → profile manifest 自动入 bundles → `dsh web` boot
S8-READY 等价全闸 → 浏览器 gentry G0–G4），最终世界（21-11-16 @ `5c4f903`）**全绿**
（G3 零态消失 = D9 defaultWorkspace 推导实证）。Gate round 1 三独立盲审（qwen3.8-27b，
范围冻结 `2f3f61b..a7bee2e` 7 commits）：**R1 产品+五闸+安装面消费者 = 通过** / **R2 host
契约链 = 通过** / **R3 D5 垂直证据 = 投机通过**（未验证 remainder 仅档案簿记）→ 3/3 PASS、
substantive 补充 0/2、执行 1/3。R128/R129 簿记合入后 int `e832d73`（= task `c20b8c5` 树等价）
fast-forward 进 master（`2f3f61b` → `e832d73`，106 文件 / +14550 −83）并推送 origin（R130，
`int/plugin-bundle-form` 新建 @ `e832d73`，零 force-push，ls-remote 复核一致）。**`dsh plugin
add github:` 至此直接可用**，用户原始报告的失败路径闭环。红线全程未破（CORE PATCH BUDGET=0、
test-use pristine @ `76fda72979`、3180 族端口、零 force-push）。下一步 = P10 加固 + G8-S 裁决，
均待用户指示。

**前序收口（背景）**：完整产品已入 master 并推送 origin（R125/R126，2026-09-05，
`int/P9-master-product-closure` 四轮盲审最终轮 3/3 通过 @ `d23c606` 后 ff 进 master；
fresh-machine 可安装性已验证，安装链见 `docs/INSTALL.md`）。

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
| P9 master product closure（R125，2026-09-05） | **GATE PASS @ `d23c606`**（四轮 × 3 独立盲审，12 份裁决；最终轮 3/3 通过；substantive 补充 2/3）→ ff 进 master（`2c1c200` → `4233816`）+ 推送 origin（R126）。产品面相对 `bd38827` 恰 7 文件（安装链 2 脚本 + runtime/client package.json + lockfile + eslint + 根 package.json）；**fresh-machine 安装链验证**：干净 clone 等价树（registry-only、0 外部 junction、4 件安装面产物与 R122 世界 byte-identical）+ 全新世界 boot S8-READY + 浏览器 vertical 零失败；五闸终态 install 0 / tsc 9/9 / test 2395+2630（恒等式）/ lint 0 / smoke S8-READY | `evidence/P9-master-closure/`（12 裁决、gate 日志复捕、merge-audit/byte-compare/gate-summary、fresh-clone-sim-r125/、r125-template-audit.*）；`docs/INSTALL.md`；`graph.yaml` p9_master_closure 块 |
| plugin-bundle-form（R127–R130，2026-09-05，**已关闭**） | **GATE PASS（round 1 3/3：R1 通过 / R2 通过 / R3 投机通过；substantive 补充 0/2、执行 1/3）→ 已推送 origin（R130）**：`dsh plugin add github:` 直接可用 —— 根 `dsh.bundle.patch` + 机器无关 `cordis.patch.yml`（glue/seam 位置推导）+ exports + prepare 构建链 + 根级运行时依赖；**D5 五全新 DSH_HOME 世界走真实 CLI reconcile 垂直**，最终世界（21-11-16 @ `5c4f903`）setup + boot D5-READY + 浏览器 gentry G0–G4 全绿（failures none，G3 零态消失 = D9 实证）+ 4 件安装面产物 byte-identical；五闸终态 install 0 / tsc 9/9 / test 2404 / lint 0 / smoke。int `e832d73`（R128/R129 簿记后 = task `c20b8c5` 树等价）ff 进 master（`2f3f61b` → `e832d73`）+ `int/plugin-bundle-form` 新建，均推 origin | `evidence/plugin-bundle-form/`（task-brief D1–D9 + 五世界运行记录 + d5-setup/boot/gentry kits + `gate/round-1-reviewer-{1,2,3}.md` + teardown/rerun 核验）；`graph.yaml` plugin_bundle_form 块；`docs/INSTALL.md` §2 快速安装 |

## 3. 当前基线（disk truth，2026-09-04 本会话核实）

| 项 | 值 |
| --- | --- |
| 测试 DSH 源码（pristine） | `references/deepseek-harness-test-use` @ **0.1.2-rc.1 / `76fda72979`**（TEST_METHODS.md §1；工作树 byte-clean 义务不变） |
| 稳定实例红线 | `D:\deepseek-harness\` + :3080 严禁触碰（本会话仅只读探测：当前 :3080 无监听，未做任何操作） |
| 测试端口 | 3180 族（3180–3186 / 3492–3500）；R129 gate 期 05:38:50 独立核验 **3180/3181/3182/3493 全部无监听**（`gate/teardown-verify-post-gate.txt`），所有测试实例已 stop；reviewer worktrees 已拆除（P9-MC 线 + R1 自拆 review-gate1/gate1-inner）；D5 五世界目录保留为证据（gitignored，原件未脱敏，仓内归档为脱敏版） |
| 证据原件备份 | 主仓 untracked 证据原件（含有效 token，未脱敏）已移至 `D:\AgentDev\dsh-plugins\evidence-originals-backup-20260905\`（可逆备份；仓内 `evidence/{P9,T12,upstream-rc1-compat}/` + `evidence/P9-master-closure/` 的脱敏版为 canonical 归档，R125(2)/(5) 入库） |
| master | **origin @ `e832d73`（R130 推送，2026-09-05；fast-forward `2f3f61b` → `e832d73`，106 文件 / +14550 −83 = plugin-bundle-form 8 commits）**；本地 master 领先 origin 1 提交（R130 簿记 commit，按 R124 先例由下次授权推送携带）。P9 产品全量早已落 master（R125/R126，`2c1c200` → `4233816`，1284 文件 / +85,679） |
| 已推送分支（R124 2026-09-04 + R126/R130 2026-09-05，全部 fast-forward/新建、零 force-push，ls-remote 复核一致） | **R130 新增**：`master`（`e832d73`，含 plugin-bundle-form）+ `int/plugin-bundle-form`（`e832d73`，新建）；**R126 新增**：`master`（时点 `4233816`）+ `int/P9-master-product-closure`（`4233816`）；R124 既有：`int/T12-production-closure`（`c455c43`）/ `int/P8-remote-projection`（`3fa4c1f`）/ `task/P9-ui-legacy-reuse`（`dc056d5`）/ `task/upstream-rc1-compat`（`bd38827`）/ `task/T12-vertical-slice`（`3e7da91`） |
| 仍留本地分支（裁决/惯例） | `task/P9-proto-real-backend`（`2a23f52`）+ `task/P9-proto-ui`（`0f001f5`）— R-PROTO-13「local-only 不 push」；`task/T12-lane-{a,b,c}`（`314ef42`/`c4806b8`/`eb7f891`，已 cherry-pick 入 int 线）；已 cherry-pick 的 task/P0–P8 系列 |
| P9 五闸（`0738b45` 树） | test 150/312/269/124/35/92/1070/471 · typecheck 9/9 · build 9/9 · lint 0 errors · smoke 2/2（R117）；RC1 树 vitest 2532 复跑（R122） |
| p4t6 扫描锁 pin | 601（P9 线终值，bug #7 修复 `3839476` 后；rc.1 适配未新增可扫文件） |
| 冻结 legacy 参考 | `references/deepseek-harness` @ `a3ab319927`（tag `legacy-agent-team-pre-vnext`，只读）未动 |

## 4. 待办 / 等待用户（按优先级）

1. ~~**推送授权**~~ — **三轮均已完成**：R124（2026-09-04，master + 5 refs）、R126（2026-09-05，master `2f3f61b` + `int/P9-master-product-closure`）、R130（2026-09-05，master `e832d73` + `int/plugin-bundle-form` 新建），各按用户一次性授权执行并 ls-remote 验证；**后续任何推送仍需新的显式授权**（红线不变），gated 历史禁 force-push。本地 master 领先 origin 1 提交（R130 簿记），随下次授权推送携带（R124 先例）。
2. ~~**P9 task 分支入 master**~~ — **已完成（R125 Gate PASS + R126，2026-09-05）**：`int/P9-master-product-closure` @ `d23c606`（gate）/ `4233816`（bookkeeping）ff 进 master 并推送；安装链产品化 + fresh-machine 验证随线入库（`docs/INSTALL.md`）。
3. **P10 加固**（P9 计划 L1789）：F-9 untracked-burst emitter 定位 + post-test-gate porcelain 检查；F-7 两个 excluded browser-surface specs；carry-over 清单 = UI_BACKEND_GAP（client node entry `packages/client/dist/plugin/client.js:50` 读 `ctx.slots` 未声明 inject，非规范路径）/ p6t1-parallel flake 类（~1/3，R125 轮 3/4 两位 reviewer 独立复现-隔离确认，建议降载加固）/ testkit `.tmp-fault` scratch 竞态（destroyDir Windows 重试）/ tsc build 内联发射卫生 / 360 s 窗口核心埋点（T12 记录，T12-V16 已修产品面，埋点留 P10）。
4. **G8-S / P8-S8 裁决**：原 P8-S 线的 S8（生产 E2E + race/crash/security 矩阵）与 G8-S gate 在 T12 GO 之后是否仍为必要条件，待用户裁决（T12 已实质覆盖生产垂直闭合；graph `blocked: [G8-S]` 保留）。
5. ~~**卫生/拆线**~~ — **已完成（R126 会话末）**：3180 族端口全释放、测试实例全 stop、reviewer worktrees 拆除、untracked 证据原件移至 `D:\AgentDev\dsh-plugins\evidence-originals-backup-20260905\`（可逆）、`references/.fresh-clone-*` 临时目录与 inert 测试 home 已清理；test-use 树 byte-clean @ `76fda72979` 复核。

## 5. 文档地图

| 文档 | 性质 |
| --- | --- |
| `AGENTS.md` | 仓库代理规则（必读序 / 权威序 / 目录约定 / 红线 / 状态与恢复） |
| `README.md` | 仓库定位、9-package 布局、对象模型摘要、插件入口（生产形态）、命令 |
| `docs/INSTALL.md` | **fresh-machine 安装与挂载指南**（R125 入库）：clone → install → build → build:composition → 按模板挂载 → dsh web；含配置校验 fail-closed 字段表与 blueprintSource frontmatter 契约 |
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
