# base 干跑 + int 树 GREEN 证据判读（multi-mcp real-host smoke kit）

- **kit**：`multi-mcp-real-host-smoke.mjs`（本目录）
- **host 树**：`tests/deepseek-harness-test-use` @ `a66e4702047846cdaa10c66c9d3df3951f5ea70d`（0.1.2-rc.1，pristine，全程 C7 复核）
- **目标树**：base 干跑 = `.worktrees/multi-mcp-d-docs` @ `b49f4239`（Task A/B 未合入，不支持 `mcpServers`）；GREEN 终跑 = `.worktrees/multi-mcp-int` @ `3ee3f72`（A+B+C+D 齐，含 Gate C 轮 1 归因提交）
- **日期**：2026-09-13（UTC）

## 结论（两句话）

1. **base 干跑**（`runs/mm-smoke-20260913T18-17-32Z`）：kit 在 base 树**全链路跑通**，
   按预期在 C1–C5 失败（legacy 单值形状 + 零 MCP 工具 = 单值行为签名），C6/C7
   通过，exit 2 —— 与任务卡「不追求 GREEN」一致，非 kit 缺陷。
2. **int 树 GREEN 终跑**（`runs/mm-smoke-20260913T18-45-41Z`）：修复 kit 两处设计
   缺口（durable seed 缺失 + 边界探针走错路径）后**七判据 33/33 全 PASS，exit
   0**。Gate C 轮 1 的首次 GREEN 运行（`runs/mm-smoke-20260913T18-36-43Z`，主
   Agent 执行）失败的每一条都被归因为 **kit 期望 vs 冻结契约的误读**，运行时
   （A/B/C）逐观测符合冻结契约；修复全部落在 kit 侧，**零运行时改动**。

## 六次运行（audit trail，全部保留在 `runs/`）

| run | 目标树 | 结果 | 说明 |
| --- | --- | --- | --- |
| `mm-smoke-20260913T18-12-54.165ZZ` | base | **kit-level FATAL**（exit 1），链路未开始 | kit 缺陷 #1：`captureGitState` 前未建 `git-pre/` 目录（ENOENT）；附带暴露 stamp 格式含毫秒+双 Z（已改为 `…T18-12-54Z` 形式）。**fail-loud 机制按设计工作**：非零退出 + 完整判据清单（全部 `not-run`）落盘。已修复。 |
| `mm-smoke-20260913T18-14-15Z` | base | **kit-level FATAL**（exit 1），host 已 boot、auth 前失败 | kit 缺陷 #2：boot URL 解析重构后 `authenticate(rec.origin, token)` 残留未定义变量 `token`（应为 `rec.token`）。同次运行暴露缺陷 #3：`instance.start()` 成功但行健康检查前失败时 host 进程未注册进 `liveHosts` → teardown 漏杀（孤儿进程占用 3181 → 该次 C6 FAIL）。均已修复。孤儿进程由操作方手动清理；孤儿在 kit 删除 home **之后**又重建了 `tests/homes/…18-14-15Z/storages`（20K 死世界残留，无 lock），已于提交前删除——homes 目录现仅剩非本任务的旧世界。 |
| `mm-smoke-20260913T18-17-32Z` | base | **预期终点**：C1–C5 FAIL / C6、C7 PASS，**exit 2** | 规范 base 干跑证据（下节）。 |
| `mm-smoke-20260913T18-36-43Z` | int @ 4feac8c | exit 2，C1 5/15、C2 2/3、C3 0/4、C4 2/3、C5 3/4、C6/C7 PASS | 主 Agent 执行的 Gate C 轮 1 GREEN 运行。**全部失败归因 = kit 两处设计缺口**（详下节），运行时逐观测符合冻结契约。 |
| `mm-smoke-20260913T18-45-08Z` | int @ 3ee3f72 | **七判据全 PASS**，但 summary 构造处 **kit-level FATAL**（exit 1） | 修复后的 kit 首跑：durable seed + 边界触发全部生效，33/33 判据 PASS；唯 `seedRec` 声明在 try 块内、summary 在 finally 块 → ReferenceError（kit 缺陷 #4，提升声明至外层作用域修复）。teardown/C6/C7/home 删除在该 fatal 之前已完成（世界无残留）。 |
| `mm-smoke-20260913T18-45-41Z` | int @ 3ee3f72 | **exit 0，33/33 全 PASS** | **规范 GREEN 证据**（下节）。 |

## base 干跑（`mm-smoke-20260913T18-17-32Z`）判读

### 链路（全部按设计执行）

1. pre-flight：`:3080` pre 探测 `unreachable`（本环境无 stable 实例——与 pre 一致的
   post 探测即 C7 的「未触碰」证据）；test-use pre pristine @ 基线。
2. 端口：3180 被操作者 DSH GUI 占用 → kit 自动选 **3181**（3180 族内，
   TEST_METHODS 允许；`--host-port` 可覆盖）。
3. 目标树增量构建：`pnpm build && pnpm build:composition` 通过，
   **check-artifacts-committed：1112 files 匹配**；dist host import probe
   `LOADED name=dsh-agent-team`。
4. mini-MCP A(3491, `mcp_signal`) / B(3492, `mcp_designer`)：直连 `tools/list`
   **两端点都只暴露 `ping`**（`mini-probes.json`）——判据 2 的 MCP 层直证。
5. profile init → patch + directive → HOST1 boot：裸 `GET /` → **401**，
   token 303+set-cookie → cookie；行健康 `toolCount=11`；**base host 接受带
   `mcpServers` 字段的行配置**（未知字段忽略 + `mcpServer: null` 通过 legacy
   校验），行 setup 无 setupError。
6. 真实 `team_create_member` ×2；10 次 model turn 全走真实 dsh-llm adapter
   （mock 端点 3496 捕获）；C4 instance-scope override 被接受；C5 同 home
   重启（boot 2, phase resume，3 liveSessions 恢复）→ 3 次 post-restart turn；
   teardown 全净。

### 判据结果与「单值行为」形态

| 判据 | 结果 | 观察到的形态（判读） |
| --- | --- | --- |
| C1 | **FAIL**（2/15） | 每 session 的 `mcp` 字段 = **legacy 单值形状** `{"mounted":false,"serverName":null}`（无 I5 `servers` map）——base 只认单 `mcpServer`，配置给了 null → 无 mount；model-facing schema 零 `mcp__*` 工具。2 个 PASS 为「什么都不挂」下的平凡负断言。 |
| C2 | **FAIL**（2/3） | MCP 层直证 PASS（两端点同名 `ping`）；leader schema 前缀分离 FAIL（无工具可分）。 |
| C3 | **FAIL**（0/4） | 全零形态，隔离断言无从谈起。 |
| C4 | **FAIL**（2/3） | override 被接受（durable 治理面 base 本就有）；「B 不 mounted」平凡 PASS；「A 仍在、B 消失」FAIL——A 也不在。 |
| C5 | **FAIL**（0/4） | 重启前后平凡相等（全零），但形状 ≠ I5 且 leader schema `[]` ≠ 期望 `[A]`。 |
| C6 / C7 | **PASS** | 端口全释放；test-use pristine；`:3080` pre==post。 |

**判读核心**：失败 detail 逐字记录了「`serverName: null` 单值形状 + 零 MCP
工具」——base 树（无 `mcpServers` 支持）的**单值行为**签名，非 kit 缺陷。

## int 树 GREEN：归因 → 修复 → 终跑

### Gate C 轮 1（`mm-smoke-20260913T18-36-43Z`，主 Agent 执行 @ int 4feac8c）

**通过面（证明 I5 集成 + 持久化语义全部工作）**：
- C1 形状：三个会话 `/__p6t6/state` 均 = **i5-servers**（`mcp.servers` map +
  完整 provenance：source/deniedBy/pendingNextBoundary/explanation）。
- C4：instance-scope override 被接受（`ovr-mcp-inst-leader-g0`），策略中生效
  （leader `mcp_signal: allowed=true, source={layer:"humanOverride"}`）。
- C5：restart 后 leader model-facing tools = `[mcp__mcp_signal__ping]` ——
  durable override 跨重启存活 + boot:2 setup 重建挂载；member-1/2 前后一致。
- C6/C7 全 PASS。

**失败面归因（逐条 = kit 期望 vs 冻结契约的误读，运行时契约忠实）**：

1. **C1/C2/C3 mount/schema 全空 = 基线 durable cell = unspecified（fail-closed，
   正确行为）**。state-after-c1 原文：全部
   `source={layer:"unspecified",origin:"static",recordId:null},
   deniedBy={by:"team",reason:"unspecifiedFailClosed"}`。冻结语义
   （`packages/runtime/agent-setup/capability/mcp-facet.ts` L12-18）：unspecified team cell = fail-closed NO mount。**blueprint 的
   `capabilities.mcp` 是静态模板门（selective filter），不 seed durable
   cell**——durable allow 需要治理记录。kit 的 world 从未 seed 过 → 零挂载是
   契约正确的。三交集公式（模板 ∩ 行配置 ∩ durable cell）没错，kit 只满足了
   前两个交集。
2. **C4/C1 的「next boundary」探针未触发 root 边界 reconcile**。MK_L2 用
   `/api/session/prompt`（root 原生 session 输入）——该路径在 base 与 int
   **完全相同**的 4 个 glue 调用点之外（`submitAttributedInput` /
   `workDelivery.deliver` / `deliverRootInput` / `executeTool`；base
   b49f4239 L1988/2020/2183/2627 = int L2079/2111/2274/2718，B 未增删调用点）
   → root 原生 prompt 不跑 `prepareAgentForRequest`（**pre-existing 布线，非 B
   回归**）。证据：c4 快照中 override 仍在 `pendingNextBoundary`（边界跑过会被
   `applyBoundaryRecords` 计入 applied → pending 应空），且 `allowed=true` 时
   `mounted` 仍 false。cell-provenance 冻结语义：effective = 当前策略
   （pending 只是 bookkeeping/诊断字段，非两级门）——C5 boot:2 即证明
   （applied=[] 时 allowed=true 直接挂载）。

### kit 修复（零运行时改动）

1. **seed durable allow**：boot:1 行健康后、member 创建前，发 **team-scope**
   `override.set`（capability mcp, allow [A,B], scope team → recordId
   `ovr-mcp-team-g0`）。效果：member 创建时 fresh setup 解析（applied=[]）看到
   allow → m1 经模板 [A] 门挂 A、m2 挂 B（C3 隔离 + C2 命名空间在创建相即
   成立）；leader 经一次**会跑边界的操作**挂 [A,B]。seed 被拒 = kit-level
   FATAL（前置条件，fail loud）。
2. **边界触发**：`POST /__p6t6/tool` 执行 `team_list_members`（as = root
   session）→ `executeTool` → `prepareAgentForRequest(root)` → reconcile。
   用于两处：C1 探针前（挂 [A,B]）与 C4 override 后（B deny-first dispose，
   A 保持 mounted）。tool 执行不产生 model 请求（mock seq 不受影响）。
3. 头注释 / README 增补「World design」节，记录上述冻结语义与根因注记
   （防止再次误读）。

（修复后又暴露 kit 缺陷 #4：`seedRec` 作用域错误致 summary 构造 fatal ——
`mm-smoke-20260913T18-45-08Z` 记录在案，见运行表；修复后终跑干净。）

### GREEN 终跑（`mm-smoke-20260913T18-45-41Z` @ int 3ee3f72）——**exit 0**

| 判据 | 结果 | 关键观测 |
| --- | --- | --- |
| C1 | **PASS**（15/15） | 三会话 i5-servers；leader schema **恰为** `[mcp__mcp_designer__ping, mcp__mcp_signal__ping]`，state 双 mounted=true（source=`humanOverride`/`ovr-mcp-team-g0`）；m1 恰 `[mcp__mcp_signal__ping]`、m2 恰 `[mcp__mcp_designer__ping]`；双证一致。 |
| C2 | **PASS**（3/3） | 两端点同名 `ping`（MCP 层直证）+ leader schema 两个前缀工具并存互异、无重名。 |
| C3 | **PASS**（4/4） | m1：A mounted / B 不 mounted（`allowed=true` 但模板门滤除）；m2 镜像——隔离 = 模板门 × durable 策略的真实组合。 |
| C4 | **PASS**（3/3） | instance-scope [A] 收紧被接受（`ovr-mcp-inst-leader-g0`）→ 边界触发后 B：`mounted=false, allowed=false`（deny-first dispose），A 保持 mounted；model schema B 消失、A 在。 |
| C5 | **PASS**（4/4） | 同 home 重启（boot 2, phase resume，3 liveSessions）后逐 agent effective 集与重启前**逐位相等**（含收紧后 A-only leader）；leader 重启后 schema 恰 `[mcp__mcp_signal__ping]`（durable 双记录跨重启存活）。 |
| C6 | **PASS**（1/1） | 3181/3491/3492/3496 全释放。 |
| C7 | **PASS**（3/3） | test-use porcelain 空 + HEAD `a66e4702…` pre==post；`:3080` pre==post。 |

`summary.json` 记录 durable seed（`seed.recordId=ovr-mcp-team-g0, scope=team`）
与成员/override 全量元数据。

## 对后续 GREEN 重跑（若有）的提示

- 命令不变：`node dev/agent-workflow/evidence/multi-mcp/d-smoke/multi-mcp-real-host-smoke.mjs --repo <int worktree>`；:3180 被占时自动选 3181；热树 ~15s，冷构建 +2–5min。
- C5 比较基准 = C4 收紧后的 pre-restart 集（leader A-only 是**设计内** durable 状态）。
- 两 mini 端点同名 `ping` 是**设计**（命名空间碰撞最强测试），非配置错误。
- durable seed（team-scope `ovr-mcp-team-g0`）是 world 的前置条件——若 runtime
  变更导致 seed 被拒，kit 会 fail-loud 报「precondition for the whole smoke」。

## 卫生复核（本目录）

- kit 对 test-use 树零写入（C7 pre/post 复核，六次运行全部成立）；对目标树仅
  构建产物（check-artifacts-committed 证明 dist 与已提交安装面逐字一致，无工作
  树漂移——base 与 int 两树均复核）。
- 临时 home 全部已删除（各 `summary.json` 记 `kept=false`；孤儿重建残留见运行表
  #2 说明）；lock 文件随之删除。
- 实例日志（`instances/*/instance-port3181.log`）含 boot 行的 launch token——
  与既有已提交证据（P6-T6 / G7-REVIEW / F3-F11 系列）同一先例：world 已销毁，
  token 不可再用，原样留档。
