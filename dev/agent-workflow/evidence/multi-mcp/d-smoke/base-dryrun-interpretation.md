# base 树干跑证据判读（multi-mcp real-host smoke kit）

- **kit**：`multi-mcp-real-host-smoke.mjs`（本目录）
- **目标树（target repo）**：`.worktrees/multi-mcp-d-docs` @ `b49f4239`（base 树，**Task A/B 未合入**——不支持 `mcpServers`）
- **host 树**：`tests/deepseek-harness-test-use` @ `a66e4702047846cdaa10c66c9d3df3951f5ea70d`（0.1.2-rc.1，pristine）
- **日期**：2026-09-13（UTC）

## 结论（一句话）

kit 在 base 树上**全链路跑通**（构建 → 双 mini-MCP → profile seam 挂载 → 真实 host
boot → 行 setup → 真实 `team_create_member` → 10 次真实 model turn（真实 dsh-llm
adapter + 本地 mock 端点）→ durable override → 同 home 重启 → teardown），并按
**预期**在 C1–C5 失败（观察到 legacy 单值形状 / 零 MCP 工具），C6/C7 通过，
退出码 **2** —— 与任务卡「base 树干跑预期终点：链路全通 + 记录单值行为预期失败形态，
不追求 GREEN」完全一致。**这不是 kit 缺陷，是 base 树缺 `mcpServers` 支持的直接证据。**

## 三次运行（audit trail，全部保留在 `runs/`）

| run | 结果 | 说明 |
| --- | --- | --- |
| `runs/mm-smoke-20260913T18-12-54.165ZZ` | **kit-level FATAL**（exit 1），链路未开始 | kit 缺陷 #1：`captureGitState` 前未建 `git-pre/` 目录（ENOENT）；附带暴露 stamp 格式含毫秒+双 Z（`…18-12-54.165ZZ`，已改为 `…T18-12-54Z` 形式）。**fail-loud 机制按设计工作**：非零退出 + 完整判据清单（全部 `not-run`）落盘。已修复。 |
| `runs/mm-smoke-20260913T18-14-15Z` | **kit-level FATAL**（exit 1），host 已 boot、auth 前失败 | kit 缺陷 #2：boot URL 解析重构后 `authenticate(rec.origin, token)` 残留未定义变量 `token`（应为 `rec.token`）。同次运行还暴露缺陷 #3：`instance.start()` 成功但行健康检查前失败时 host 进程未注册进 `liveHosts` → teardown 漏杀（孤儿进程，端口 3181 占用 → 该次 C6 因此 FAIL）。三处均已修复（`rec.token`；`liveHosts.add` 提前到 `start()` 成功后）。该次运行本身同时**证明了 fail-loud + 完整清单**与 C7 pristine 复核在 kit 级失败下仍然执行。孤儿进程已由操作方手动清理（留痕：本文件）；孤儿在 kit 删除 home **之后**又重建了 `tests/homes/mm-smoke-20260913T18-14-15Z/storages`（20K，死世界的存储残留，无 lock 文件），已于提交前一并删除——homes 目录现仅剩非本任务的旧世界。 |
| `runs/mm-smoke-20260913T18-17-32Z` | **预期终点**：链路全通，C1–C5 FAIL / C6、C7 PASS，**exit 2** | 规范干跑证据（下节）。 |

## 规范干跑（`runs/mm-smoke-20260913T18-17-32Z`）逐判据判读

### 链路（全部按设计执行）

1. pre-flight：`:3080` pre 探测 `unreachable`（本环境无 stable 实例——与 pre 一致的
   post 探测即 C7 的「未触碰」证据）；test-use pre `statusEmpty=true diffEmpty=true
   head=a66e4702…`（pristine @ 基线）。
2. 端口：3180 被操作者 DSH GUI 占用 → kit 自动选 **3181**（3180 族内，
   TEST_METHODS 允许；`--host-port` 可覆盖）。3491/3492/3496 空闲。
3. 目标树增量构建：`pnpm build && pnpm build:composition` 通过，
   **check-artifacts-committed：1112 files 匹配**（安装面新鲜度闸，`build.log`）；
   dist host import probe `LOADED name=dsh-agent-team`（`build-import-probe.log`）。
4. mini-MCP A(3491, `mcp_signal`) / B(3492, `mcp_designer`) 起来；直连
   `tools/list`：**两端点都只暴露 `ping`**（`mini-probes.json`）——判据 2 的
   MCP 层直证：若无 `mcp__<serverName>__` 前缀隔离，两 server 必撞名。
5. profile init（throwaway boot ~1.3s）→ patch（生产行 + p6t6 行）+ directive
   (boot 1, phase create) → HOST1 boot ~1s：裸 `GET /` → **401**（launch-token
   闸），`?token=` 303+set-cookie → cookie。行健康：`toolCount=11`（11 个 team
   tools 全在），`state ready (teamSession=mm-smoke-bp-1 rev=1)`——**base host 接受
   了带 `mcpServers` 字段的行配置**（未知字段被忽略 + `mcpServer: null` 通过 legacy
   校验），行 setup 无 setupError（`instances/HOST1-CREATE/instance-port3181.log`：
   `remote mount: MOUNTED channel=/team-remote`）。
6. 真实 `team_create_member`（经 `/team-remote`，非 seed）：
   member-1 `inst-1907o4o0i4ou`（worker-a）、member-2 `inst-0mk99qt032eo`（worker-b）。
7. 10 次 model turn 全走真实 dsh-llm adapter（mock 端点 3496 捕获，
   `run.log` 中 `mock: N text reply` 行；每 turn 的模型请求 `tools` 数组 =
   model-facing schema 证据，seq 1/3/5/7/8/9/10 = 各 agent turn）。
8. C4：`/team-remote/override.set` 被接受（`recordId=ovr-mcp-inst-leader-g0`，
   `kind=human-override scope=instance values.mcp={kind:allow,items:[mcp_signal]}`
   `instanceId=inst-leader`）→ leader 下一 turn（seq 7）。
9. C5：HOST1 stop（`killed=true portFree=true`）→ 同 home 写 patch
   （bootPhase=resume）+ directive（boot 2, phase resume）→ HOST2 boot → 行健康
   `liveSessions` = 3（root + 两 child，durable 世界完整恢复）→ 3 次 post-restart
   turn（seq 8/9/10）。
10. teardown：host stop、mini A/B 关、mock 关、home 删除（含 lock 文件）。

### 判据结果与「单值行为」形态

| 判据 | 结果 | 观察到的形态（判读） |
| --- | --- | --- |
| C1 | **FAIL**（2/15） | `/__p6t6/state` 每个 session 的 `mcp` 字段 = **legacy 单值形状** `{"mounted":false,"serverName":null}`（`state-after-c1.json` 原文；**没有** I5 的 `servers` map）——base 树只认单 `mcpServer` 字段，本配置给了 `mcpServer: null` → 无 server → 无 mount。model-facing schema 中 **零 `mcp__*` 工具**（leader/member 均 `[]`）。2 个 PASS 是**负断言**（member-1 不见 B、member-2 不见 A 在「什么都不挂」下平凡成立）——无信息量增益，不影响判读。 |
| C2 | **FAIL**（2/3） | MCP 层直证 **PASS**（两端点同名 `ping`）；leader schema 前缀分离检查 FAIL（`[]`，无工具可分）。无碰撞检查平凡 PASS。 |
| C3 | **FAIL**（0/4） | 无任何 MCP 工具/挂载 → 隔离断言无从谈起（全零形态）。 |
| C4 | **FAIL**（2/3） | override **被接受**（PASS，durable 治理面与 MCP 无关，base 树本就有）；「B 不 mounted」平凡 PASS（什么都不挂）；「A 仍在、B 消失」**FAIL**——A 也不在：base 树没有多 server 概念，无从 unmount 单个 server。 |
| C5 | **FAIL**（0/4） | 重启前后 effective 集**平凡相等**（全零），但形状 = `legacy-single` ≠ I5，且 leader 重启后 schema `[]` ≠ 期望 `[A]`（durable 收紧无从作用于不存在的 mount）。 |
| C6 | **PASS**（1/1） | 3491/3492/3496/3181 全部释放。 |
| C7 | **PASS**（3/3） | test-use post：`statusEmpty=true diffEmpty=true`，HEAD pre==post==`a66e4702…`；`:3080` pre==post（`unreachable`）。 |

**判读核心**：C1–C5 的失败 detail 逐字记录了「观察到 `mcp.serverName: null` 单值形状 +
零 MCP 工具」——这正是 base 树（无 `mcpServers` 支持）的**单值行为**签名。int 树
（A+B 合入后）同一 kit 应看到：state 变为 I5 `servers` map、leader schema
`[mcp__mcp_signal__ping, mcp__mcp_designer__ping]`、member 各自单 server、C4 后
leader 收敛到 A-only、C5 逐位相等 → 七判据全 PASS（exit 0）。

## 对 GREEN 运行（主 Agent，int 树）的提示

- 同一 kit、同一命令：`node dev/agent-workflow/evidence/multi-mcp/d-smoke/multi-mcp-real-host-smoke.mjs --repo <int worktree>`（kit 位于本任务分支，int 树 cherry-pick 后路径相同）。
- 若 :3180 被占，kit 自动选 3180 族下一个空闲端口（本环境实测 3181）。
- 干跑耗时 ~12s（热树增量构建）；冷树（全新构建）预计 +2–5 分钟。
- C5 的比较基准 = C4 收紧后的 pre-restart 集（leader A-only 属**设计内** durable 状态）。
- 两 mini 端点同名 `ping` 是**设计**（命名空间碰撞的最强测试），不是配置错误。

## 卫生复核（本目录）

- kit 对 test-use 树零写入（C7 pre/post 复核）；对目标树仅构建产物（
  check-artifacts-committed 证明 dist 与已提交安装面逐字一致，无工作树漂移）。
- 临时 home 已删除（`summary.json` 记 `kept=false`）；lock 文件随之删除。
- 实例日志（`instances/*/instance-port3181.log`）含 boot 行的 launch token——
  与既有已提交证据（P6-T6 / G7-REVIEW / F3-F11 系列）同一先例：world 已销毁，
  token 不可再用，原样留档。
