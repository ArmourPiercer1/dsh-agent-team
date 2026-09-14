# Task D — Docs + 双 mini-MCP real-host smoke kit

> 共享契约见 `dev/agent-workflow/briefs/multi-mcp/00-contract.md`（I5/I11/I12 适用；
> 本轮 D 不写生产代码，故 I9 禁改面全部适用 — 只动 docs/cordis.patch.yml/新 kit）。

## 目标

1. 用户可复制的 multi-MCP 配置文档（`mcpServers` 0..N + per-template 子集示例）；
2. 一个**可重复执行**的双 mini-MCP real-host smoke kit（脚本自包含，接受
   目标 repo 路径参数 — 主 Agent 会在 B+C 合入后的 int 树上执行；你负责
   编写 + 在 base 树做 dry-run 自检到"预期失败形态"为止）。

## Own（允许修改/新增）

```
docs/INSTALL.md                                （改：§MCP 配置节）
cordis.patch.yml                               （改：config 模板 mcpServer → mcpServers）
dev/agent-workflow/evidence/multi-mcp/d-smoke/multi-mcp-real-host-smoke.mjs   （新：smoke kit）
dev/agent-workflow/evidence/multi-mcp/d-smoke/README.md                       （新：执行说明）
dev/agent-workflow/evidence/multi-mcp/d-smoke/                                （其他证据）
.agents/skills/team-blueprint-authoring/SKILL.md   （可选小改：仅当其中出现单 mcpServer
                                                   配置示例且改为 mcpServers 是纯增量
                                                   一行级修正；先读全文判断，拿不准就不动）
```

**Do not**：任何 `packages/` 源码/测试、p4t6、历史 evidence。

## 基线事实（主 Agent 已核验 @ b49f4239）

- `docs/INSTALL.md` L169：config 模板含 `mcpServer: null`；L244：`mcpServer` 列入
  必填字段说明（改为 `mcpServer`(legacy) / `mcpServers`(canonical) 双字段说明，
  必填语义不变：至少一行校验通过即可，两者皆缺/皆 null 合法 = 无 MCP）。
- `cordis.patch.yml` L82：`mcpServer: null`（用户可复制模板 → 改 `mcpServers: []`）。
- real-host 测试实例（TEST_METHODS.md §1-2）：
  - 源码 `tests/deepseek-harness-test-use`（pristine @ a66e470204，**不得写入**）；
  - 构建/启动链（§2）：`DSH_CLIENT_COMMIT_HASH=a66e470204 ESBUILD_WORKER_THREADS=1 node scripts/build.ts`，
    启动 `DSH_HOME=<repo>/tests/homes/<world> node apps/cli/lib/bin.js web --port 3180 --no-open`；
  - home 协议 §7：临时世界命名 `<line>-<UTC 时间戳>`，teardown 删除（除非作证据登记）；
  - 端口：host 3180 族；mini-MCP server 用 3491-3500 族；**严禁 3080**；
  - 启动后验证：boot 行出现 + `GET /` 401 + 运行后 test-use `git status --porcelain` 空。
- 现有单 MCP live kit 参考（读，不改）：`dev/agent-workflow/evidence/alpha1-capability-live/`
  与 `packages/tools/harness/t12-vertical.mjs`、`tests/kits/`（可复用原语）。
- mini-MCP server 的最小实现参考：现有 harness 世界如何起 mini-mcp
  （bridge 用 test double；real-host kit 需要一个真实 streamable-http mini MCP
  端点 — 查 `tests/mock/` 与既有 real-host evidence 中是否有现成 mini-mcp 脚本可复用；
  没有则写最小 http 端点（node 内置 http + 最小 MCP JSON-RPC 响应即可，
  只需能让 `dsh-mcp-client` 完成 connect + list tools 并暴露 1 个命名 tool）。
- 生产 team row 如何挂载：`cordis.patch.yml` 的 row config 模板 +
  `docs/INSTALL.md` 的挂载流程；smoke world 需要 1 leader + 2 members 的
  blueprint（template capabilities.mcp 分别为 allow [A] / allow [B]；leader allow [A,B]）
  + row config `mcpServers: [{name: <A>, port: 3491}, {name: <B>, port: 3492}]`。
- **注意**：D 在 base 树 dry-run 时，生产 runtime 尚不支持 mcpServers（B 未合入）—
  dry-run 的预期终点 = "host boot 成功 + 诊断显示仅单值行为/或配置校验拒"，
  记录该形态即可（这是 kit 自身的 smoke 自检，证明脚本链路可运行）；
  真正的 GREEN 由主 Agent 在 int 树执行（届时你会被 send_message 通知，
  若你仍在线则按通知执行 int 树 GREEN run 并补证据）。

## Smoke kit 验收判据（int 树 GREEN run 时，主 Agent 核对）

1. 每个 Agent 的 model-facing tool schema 中 MCP tools 精确匹配
   （leader: A+B 的 tools；member-1: 仅 A；member-2: 仅 B）—
   经 `/__p6t6/state`（I5 形状 `mcp.servers.<name>.mounted/allowed`）
   与/或 model-facing schemas 双证；
2. A/B namespaces 不冲突（tool 名各自带 server 前缀，无碰撞）；
3. member isolation；
4. deny/unmount 后 tool 真消失（可用 durable override 收紧一次）；
5. host restart（同 home 再启）后重建相同 effective set；
6. teardown 后 3491/3492 端口释放；
7. test-use worktree porcelain 空 + `:3080` 未触碰（状态前后一致）。

## Must

1. `docs/INSTALL.md`：MCP 配置节改写为 0..N（legacy 注记 + ambiguous 行为 +
   示例：`mcpServers: [{name: mcp_signal, port: 3494}, {name: mcp_designer, port: 3495}]`
   + blueprint per-template 子集示例（计划 §Task D 的 yaml 原样可用））。
2. `cordis.patch.yml`：L82 区 `mcpServer: null` → `mcpServers: []`（含注释行同步）。
3. smoke kit 脚本（node ESM，零新依赖）：`multi-mcp-real-host-smoke.mjs`，
   参数 `--repo <目标 repo 根>`（默认 cwd）+ `--keep`（保留 home 作证据）；
   内部：目标 repo 先 `pnpm build && pnpm build:composition`（生产 plugin 的
   dist 镜像含 agent-bindings.mjs，挂载前必须新建于该树）→ mini-mcp A/B 起停
   （child http server）→ 构建/启动 test-use host（§2 链）
   → 挂 row（临时 home 世界，blueprint 2 members）→ 逐判据断言 → 输出
   PASS/FAIL 清单 JSON → teardown（端口释放 + home 删除/保留登记）。
   **kit 失败必须 fail loud（非零退出 + 判据清单），不得吞错。**
4. base 树 dry-run：跑 kit，记录"预期失败形态"（B 未合入）到 evidence。
5. 报告按 I12。

## Gates

- 无 focused 测试（D 不写 runtime 测试）；
- `docs/INSTALL.md` 与 `cordis.patch.yml` 改动 diff 人工可审（小）；
- kit dry-run 输出 + 脚本 `node --check` 语法自检。
