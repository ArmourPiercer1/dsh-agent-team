# Task D — 双 mini-MCP real-host smoke kit（`d-smoke`）

> multi-mcp 快速修复轮 · Task D 交付（docs + smoke kit）。
> 契约：`dev/agent-workflow/briefs/multi-mcp/00-contract.md`（C1–C7 / I5 / I11）；
> 任务卡：`dev/agent-workflow/briefs/multi-mcp/d-docs-smoke.md`。
> 约束：`docs/TEST_METHODS.md`（§1-2 实例/启动链、§3 禁止项、§5 沙箱、§7 home 协议）。

## 1. 这是什么

`multi-mcp-real-host-smoke.mjs` —— 一个**自包含、可重复执行**的双 mini-MCP
real-host smoke kit（node ESM，零新依赖）。它在**真实 DSH host**
（`tests/deepseek-harness-test-use` @ 基线 `a66e470204`，pristine）上，用
**目标 repo 构建出的生产 dist**（`pnpm build && pnpm build:composition` 产物，
经 `file://` 行以公开 profile-patch seam 挂载）挂载**两个具名 mini-MCP
server**，并逐条断言 d-docs-smoke.md 的验收判据 1–7：

- 行配置（canonical 0..N + legacy null）：
  `mcpServers: [{name: mcp_signal, port: 3491}, {name: mcp_designer, port: 3492}]`
  + `mcpServer: null`（同一份 patch 在 base 树也能 boot：legacy null 校验通过、
  `mcpServers` 被忽略 —— 于是 base 干跑观察到**单值行为**形态而非配置拒）。
- blueprint（live-host 规模，leader + 2 member 模板，四子字段齐全）：
  leader `capabilities.mcp` allow `[mcp_signal, mcp_designer]`；
  worker-a allow `[mcp_signal]`；worker-b allow `[mcp_designer]`。
- 模型面：确定性本地 DeepSeek 兼容 mock（目标 repo 的
  `packages/tools/harness/mock-deepseek.mjs`，端口 3496）经启动 env
  （`DEEPSEEK_BASE_URL`/`DEEPSEEK_API_KEY`）注入 host —— 每次模型调用都走真实
  dsh-llm adapter + agent loop + durable session log（t12-vertical 先例）；
  mock 捕获的每个请求的 `tools` 数组 = **model-facing tool schema 证据**。
- mini-MCP A/B：kit 内置的最小 streamable-http JSON-RPC 端点
  （模式源 = `packages/runtime/root-binding/harness/mini-mcp.mjs`，P5-T5 实证）；
  **两个端点刻意暴露同名 tool `ping`** —— 挂载后唯一区分手段就是
  `mcp__<serverName>__` 前缀（判据 2 的最强形态）。

## 2. 用法

```bash
# 在目标 repo（int worktree 或任意 --repo 树）根目录：
node dev/agent-workflow/evidence/multi-mcp/d-smoke/multi-mcp-real-host-smoke.mjs \
  --repo /path/to/target-repo        # 默认 cwd；须含 tests/paths.mjs
                                     # 无 tests/deepseek-harness-test-use 的
                                     # worktree 会自动解析到最近的有它的祖先
                                     # （= 主树，测试基建唯一布局）
  # 可选：
  #   --keep              保留临时 home 作证据（summary.json 登记路径）
  #   --host-port 3181    固定 host 端口（默认自动选 3180..3186 第一个空闲；
  #                       3180 常被操作者自己的 DSH GUI 占用，见 RISK）
```

### 内部步骤（顺序）

1. pre-flight：`:3080` 只读探测（前后各一次，状态须一致）；test-use
   `git status --porcelain`/`git diff`/HEAD 基线（pre）；3180 族 + 3491/3492/3496
   端口空闲；fresh home 断言（非空即 fail-closed）。
2. 模块解析链接：目标树 `packages/runtime/node_modules` + `packages/node_modules`
   → test-use pnpm hoist 的 junction（worktree 本地、gitignored；host 树不动；
   t12-vertical 先例）。
3. 目标 repo 构建：`pnpm build && pnpm build:composition`（含
   check-artifacts-committed 安装面新鲜度闸）+ dist host import probe。
4. 服务：mock model（3496，decide = 每 marker 一条纯文本 ack，无 tool call）；
   mini-MCP A（3491）/B（3492）；直连 `tools/list` 探针（C2 的 MCP 层直证）。
5. world：`ensureProfile`（首启 throwaway boot）→ 写 profile patch（生产行 +
   p6t6 观测行）→ 写 `p6t6-directive.json`（boot 1, phase create）→
   boot host（boot 行 + 裸 `GET /` 401 + token→cookie 303）→ 行健康
   （`/__p6t6/health` ok）→ `p6t6StateReady`（root+phase+teamSession）。
6. 成员创建：经 `POST /__p6t6/tool` 执行 shipped `team_create_member`
   （worker-a / worker-b 各一实例；anti-cheat：不 seed）。
7. 判据 C1–C5：每 agent 一次真实 turn（leader 走 `POST /api/session/prompt`，
   member 走 `/team-remote/member.send`）→ mock 捕获 model-facing tools +
   `GET /__p6t6/state` 快照 → 逐判据断言；C4 = `/team-remote/override.set`
   把 leader 的 durable mcp cell 从 allow[A,B] 收紧到 allow[A]，下一 boundary
   断言 B 真消失；C5 = 同 home 停启（boot 2, phase resume），逐 agent 再 turn，
   断言 effective 集与重启前**逐位相等**（含收紧后的 A-only leader）。
8. teardown：停 host → 关 mini A/B + mock → **C6** 端口释放（3491/3492/3496/
   host port）→ **C7** test-use porcelain 空 + HEAD 基线（post==pre==
   `a66e470204`）+ `:3080` 前后一致 → home 删除（或 `--keep` 登记）→
   `summary.json` + `criterion-list.json` 落盘 + stdout 打印。

## 3. 判据表（d-docs-smoke.md 验收判据 1–7 的落地）

| kit 判据 | 验收判据（任务卡原文） | 断言方式（双证） |
| --- | --- | --- |
| C1 | 1. 每个 Agent 的 model-facing tool schema 中 MCP tools 精确匹配（leader: A+B；member-1: 仅 A；member-2: 仅 B） | ① `GET /__p6t6/state` 的 I5 形状 `governance.sessions[<sid>].mcp.servers[<name>].mounted/allowed`（契约 I5）；② mock 捕获的该 turn model 请求 `tools` 中 `mcp__*` 集合与期望**集合相等**；两者交叉核对 |
| C2 | 2. A/B namespaces 不冲突（tool 名各自带 server 前缀，无碰撞） | mini 端点直连 `tools/list` 证明两端点暴露**同名** `ping`；leader schema 中 `mcp__mcp_signal__ping` 与 `mcp__mcp_designer__ping` 并存且互异、无重名 |
| C3 | 3. member isolation | member-1 schema/state：A mounted、B 不 mounted 且 B tool 不在 schema；member-2 镜像 |
| C4 | 4. deny/unmount 后 tool 真消失（durable override 收紧一次） | `override.set`（scope instance, target `inst-leader`, value allow[A]）→ 下一 leader turn：state B `mounted=false`（deny-first dispose）+ model schema 中 B tool **消失**、A 仍在 |
| C5 | 5. host restart（同 home 再启）后重建相同 effective set | 停启（boot 2, phase resume）→ 每 agent 再 turn → 逐 agent `servers` map 与重启前**逐位相等**（含 C4 收紧后的 A-only leader；durable override 存活于重启） |
| C6 | 6. teardown 后 3491/3492 端口释放 | `waitForPortFree` × {3491, 3492, 3496, host port} |
| C7 | 7. test-use worktree porcelain 空 + `:3080` 未触碰 | `git status --porcelain`/`git diff` 空 + HEAD == `a66e4702047846cdaa10c66c9d3df3951f5ea70d`（pre==post）；`:3080` 只读探测 pre==post |

## 4. 退出码（fail loud，判据清单绝不吞错）

| code | 语义 |
| --- | --- |
| 0 | 七判据全 PASS（GREEN —— int 树 B+C 合入后的期望形态） |
| 2 | 链路完整跑完，但 ≥1 判据 FAIL（base 树干跑的预期形态；或 int 树真回归） |
| 1 | kit 级 FATAL（构建/boot/基建断链），部分判据清单 |

三种情况都打印/落盘完整判据清单（`summary.json` + `criterion-list.json`）。

## 5. 端口 / home / 清理协议（TEST_METHODS §1/§3/§7）

- **端口**：host = 3180 族（3180..3186 自动选空闲，或 `--host-port` 固定）；
  mini-MCP A = 3491、B = 3492（3491-3500 族）；mock model = 3496；
  **严禁 3080**（stable 实例 —— 只读探测，前后状态一致断言 = C7）。
  开跑前断言全部运行端口空闲，占用即拒跑。
- **home**：`<hostRepoRoot>/tests/homes/mm-smoke-<UTC 时间戳>`（如
  `mm-smoke-20260913T18-30-00Z`）；一世界一目录；`<home>.lock` 同处；
  非空 home 即 fail-closed。teardown 默认**删除** home（含 launch token，
  永不提交）；`--keep` 保留并在 `summary.json` 登记路径（§7 证据保留条款）。
- **test-use**：运行后复核 `git status --porcelain` 空 + HEAD 基线（C7）；
  本 kit 对 test-use 树**零写入**（启动链 = 构建产物入口 `apps/cli/lib/bin.js`，
  不跑其构建脚本）。
- **DSH_HOME 位置**：恒在会话工作区内（`tests/homes/` 下）。

## 6. base 树干跑预期形态（本目录 `runs/` 的干跑证据）

base 树（`b49f4239`，B 未合入）不支持 `mcpServers`：行配置中
`mcpServers` 是未知字段（被忽略）、`mcpServer: null` 通过 legacy 校验 →
**行正常 boot**，但无任何 MCP mount。于是：

- C1–C5 **FAIL**，detail = 观察到 `/__p6t6/state` 的 **legacy 单值形状**
  （`mcp: {mounted:false, serverName:null}`，无 `servers` map）+ model schema
  零 `mcp__*` tools —— 这正是"单值行为"预期失败形态（判读见
  `base-dryrun-interpretation.md`）；
- C6/C7 **PASS**（teardown 与 pristine 复核对基线树恒成立）。
- kit 退出码 = 2（链路全通、判据按预期失败）。

**不要在 base 树追求 GREEN**；GREEN 由主 Agent 在 int 树（A+B+C 合入后）执行
同一 kit 产出。

## 7. 证据文件（每次运行 = `runs/<stamp>/` 一目录）

| 文件 | 内容 |
| --- | --- |
| `summary.json` | 运行元数据 + 七判据完整清单 + exit code（`--keep` 时含 home 路径） |
| `criterion-list.json` | 判据清单（同 summary 内 criteria） |
| `run.log` | 全程时间线 |
| `build.log` | 目标 repo `pnpm build` / `build:composition` 输出 |
| `build-import-probe.log` | dist host import probe |
| `instances/<label>/instance-port*.log` | host 进程 stdout/stderr（boot 行、remote-mount、setup） |
| `instances/<label>/dump-config.txt` | 组合后 profile（行挂载证据） |
| `mini-probes.json` | 两端点 `tools/list` 直连探针（C2 MCP 层直证） |
| `state-after-c1.json` / `state-after-c4.json` / `state-after-c5.json` | `/__p6t6/state` 全量快照（I5/legacy 形状原始证据） |
| `git-pre/` + `git-post/` + `testuse-pre.json` / `testuse-post.json` | test-use pristine 复核（C7） |
| `port3080-pre.txt` / `port3080-post.txt` | `:3080` 只读探测（C7） |
