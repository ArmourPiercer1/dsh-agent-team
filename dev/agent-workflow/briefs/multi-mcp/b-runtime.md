# Task B — Multi-MCP live reconciler（`agent-bindings.mjs` 唯一 owner）

> 共享契约见 `dev/agent-workflow/briefs/multi-mcp/00-contract.md`（**I4 全文适用**；
> I9/I11/I12 适用）。B 在 A 合入 int 后启动：worktree rebase 到 int tip
> （`git rebase int/multi-mcp-quick-fix`），在含 A 的树上实现。

## 目标

让每个 Agent 按 existing template policy + durable policy 收敛到自己的
MCP server set（C5/C6）：`mcpViews` per server、`mcpFibers`/`mcpActivationErrors`
Map、`reconcileMcpSet`（deny-first + 新挂载 rollback）、boundary records
全 view 聚合、close 全 dispose、request-boundary 逐 server 重解析。

## Own（唯一）

```
packages/runtime/src/plugin/live/agent-bindings.mjs
dev/agent-workflow/evidence/multi-mcp/b-runtime/      （证据）
```

**Do not**：types.ts/host.ts/mcp-supply.ts（A 产物，只 import 不修改）、
test 文件（C 拥有）、harness（C 拥有）、I9 禁改面、p4t6。
若实现中发现 A 的 helper 有 bug：不要改 A 的文件 — 在报告 DEVIATIONS 上报，
主 Agent 处置（可授权你临时改并记录）。

## 基线事实（主 Agent 已核验 @ b49f4239；行号以 rebase 后为准，内容一致）

- 文件 2739 行；`createAgentBindings(deps)` @ L525；`config` = 原始 validated row config（deps 注入）。
- `consumption = domain.consumption`（L540 区），`resolveDurableMcpFacet` 经
  `consumption.capability.resolveDurableMcpFacet({rootSessionId, instanceId,
  overrides, external, serverName, appliedRecordIds?}).view` 调用（现 L791-800 单 server 形态）。
- `filterMcpServers` 已 import（L299，自 `../../../agent-setup/capability/index.js`）。
- state Map `consumptionState`（L555-559 注释块 + Map 定义）：现形状
  `{ instanceId, ref, modelView, mcpView, mcpFiber, mcpActivationError, appliedRecordIds }`。
- `resolveConsumptionViews` L751-802（单 mcpView，`config.mcpServer === null ? null : ...`）。
- `applyBoundaryRecords` L813-819（单 view pending）。
- `reconcileMcp` L830-866（单 fiber mount/dispose；port-null throw L836-838；
  activation fail 记录 + dispose + rethrow；fiber options 形态 L840-846 原样保留）。
- agentSetup 内静态 gate + reconcile + boundary L1272-1289 区：
  现 `mcpTemplateAllowed = config.mcpServer !== null && filterMcpServers([config.mcpServer.name], capabilities.mcp).length > 0`
  + `mcpMountAllowed = mcpView !== null && mcpView.allowed && mcpTemplateAllowed`
  + `reconcileMcp(agentCtx, state, mcpMountAllowed)` + `applyBoundaryRecords(state, modelView, mcpView)`。
  **核对**：Permission Coverage（`evaluatePermissionCoverage` / pre-MCP snapshot →
  final snapshot）相对 reconcile 的顺序 — 保持"一次 reconcile 覆盖全部目标
  server 后再拍 final snapshot"（§2.7；classifier 零改动）。
- request-boundary 重解析 L1772-1791（`resolveConsumptionViews` 再调 +
  `templateAllowed` 重算 + `reconcileMcp` + `applyBoundaryRecords` + `state.mcpView = mcpView`）。
- `close()` L2688-2689 区：单 fiber dispose。
- 文件头注释（L557-559 等）引用单值形状 — 全部同步更新为 per-server 形状。
- dist 镜像：`scripts/place-dist-glue.mjs` 整文件复制 agent-bindings.mjs 到 dist；
  你只在 source 改，int 收束时主 Agent 跑 build:composition 重建（**不要**手工改 dist 文件；
  `packages/runtime/dist/**` 不得出现在你的 diff）。

## Must（I4 逐条，此处只列验收锚点）

1. `reconcileMcpSet(agentCtx, state, targetServerNames)` 按 I4 推荐时序 1-7
   （deny-first → configured 顺序 mount → temporary set → 失败 rollback
   不恢复 denied → commit）。
2. 两处调用点（agentSetup / request-boundary）target 计算逐字 I4：
   `templateAllowedNames.filter(name => mcpViews[name]?.allowed === true)`。
3. `resolveConsumptionViews` 返回 `mcpViews`（Record，空 configured → `{}`）；
   两处调用点 + 文件内其他消费点（`state.mcpView` 赋值 L1791 等）全部迁移。
   **grep 自检**：`grep -n "mcpFiber\b\|mcpActivationError\b\|\.mcpView\b" agent-bindings.mjs`
   完成后必须零命中（单值词汇全部消失；`mcpFibers`/`mcpViews`/`mcpActivationErrors`
   为唯一形态）。
4. close() 遍历全部 session 的全部 fibers。
5. observation 点名 server（I8）。
6. 证据（evidence 目录）：
   - `grep` 自检输出（零单值命中）；
   - `pnpm vitest run packages/runtime/test/t4a-capability-wiring.test.ts packages/runtime/test/t12a-h1-nullable-mcp.test.ts`
     — **预期**：B 单独在树（C 未合入）时这两个旧测试可能失败（它们断言单值
     bridge 行为/diagnostics）— 记录逐 case 形态（这是 C 的 GREEN 责任，
     B 只证明"失败原因 = 单值断言 vs per-server 现实"，非逻辑回归）；
     同时跑 `pnpm vitest run packages/runtime/test/p8s4b-mcp-facet.test.ts packages/runtime/test/t12a-b3-external-deny.test.ts`
     并记录（若经 bridge 单值断言失败，同属 C 适配范围）。
   - `pnpm --filter @dsh-agent-team/runtime typecheck`（.mjs 不受 tsc 约束，
     跑它证明 TS 面未破）exit 0。

## 行为验收锚点（主 Agent re-gate 时用 C 的测试 + 独立探针核对）

```
expert-1 -> A only；expert-2 -> B only；expert-3 -> A+B；expert-4 -> none
（同一 Team / 同一 production row，durable = allow {A,B}）
denied server 永不因另一 MCP 启动失败而继续暴露
本轮新挂载失败 → 本轮新 fibers 全 rollback，denied 不恢复，request 不继续
```

## Gates

- 见 Must-6；外加 `pnpm vitest run packages/runtime/test/a2c2-permission-coverage.test.ts`
  （coverage 分类器零改动 — 若此测试在 B 树上失败，属 C 适配或真实回归，
  报告 DEVIATIONS 单列，主 Agent 裁决）。

## 完成定义

- diff 恰好 1 个 owned 源文件 + evidence 目录（`git diff --stat` 逐文件核对；
  dist/ 零出现）。
- 报告按 I12（GATES 节逐条列出 Must-6 的 PASS/FAIL 与失败形态归类）。
