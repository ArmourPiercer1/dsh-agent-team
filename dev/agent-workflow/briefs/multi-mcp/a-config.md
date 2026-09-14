# Task A — MCP config cardinality（config 契约 + normalization）

> 共享契约见 `dev/agent-workflow/briefs/multi-mcp/00-contract.md`（I1/I2/I3/I9-I12 全部适用）。

## 目标

将 `TeamPluginConfig` 的 MCP supply 从 legacy 0|1 扩展为 0..N（C1），
serverName 唯一且为 identity（C2），legacy `mcpServer` 本 alpha 继续接受（C7），
ambiguous 双配置 fail closed，建立唯一 canonical 读取路径。

## Own（允许修改/新增，逐文件）

```
packages/runtime/src/plugin/types.ts          （I2）
packages/runtime/src/plugin/mcp-supply.ts     （I1，新文件）
packages/runtime/src/plugin/host.ts           （I3）
packages/runtime/test/mcp-supply-config.test.ts   （新文件，config validation 测试）
dev/agent-workflow/evidence/multi-mcp/a-config/   （证据，新目录）
```

**Do not**：`agent-bindings.mjs`、`packages/tools/harness/*`、test bridge、
domain/policy/storage/contracts（I9）、p4t6（I11）。

## 基线事实（主 Agent 已核验 @ b49f4239）

- `types.ts` L205-210：`mcpServer: { name: string; port: number | null } | null`（singular，必填字段区）。
- `host.ts` L388-394：现有单值 fail-closed 检查；`fail()`（L341-345）抛
  `TeamPluginError(TEAM_PLUGIN_CONFIG_INVALID, 'dsh-agent-team row config: <detail>')`。
- host 校验序列：`mcpServer` 检查位于 `deniedSelection`（L379-387）之后、
  `environmentFacts`（L395）之前 — **原位替换**。

## Must

1. I2：`TeamPluginMcpServer` 接口 + `TeamPluginConfig.mcpServers?: readonly TeamPluginMcpServer[]`
   （JSDoc 注明 canonical 0..N + legacy 兼容期）。
2. I1：`mcp-supply.ts` 纯模块，`configuredMcpServers` + `mcpSupplyValidationIssue`
   （检查顺序与 message 逐字按 I1）。
3. I3：host.ts 原位替换为 `mcpSupplyValidationIssue` + `fail(detail)`。
4. 新测试 `mcp-supply-config.test.ts`（vitest，纯单测，不经 bridge）：
   - normalization 四规则（mcpServers present / absent+legacy / absent+null / both absent → []）；
   - duplicate name 拒（detail 点名）；
   - malformed array / entry（非 array、entry 非 object、name 空串、port 类型错）；
   - ambiguous 双非空拒；
   - legacy 单值各形态（valid / name 非 string / port 类型错 / null）— 现状语义不回归
     （含现状不拒空 name 的 legacy 行为）;
   - `configuredMcpServers` 返回拷贝（mutate 返回数组不回灌 config）；
   - host 集成面：用 `host.ts` 导出的 config 校验入口（找到现有 host validation 测试的
     挂法，同族新增 host-level 断言：mcpServers 合法通过 / duplicate 被拒为
     TEAM_PLUGIN_CONFIG_INVALID）。若 host 校验入口不可单测（私有函数），
     通过现有 host 测试同文件同模式的挂点接入，并在报告说明。
5. 证据：`pnpm vitest run packages/runtime/test/mcp-supply-config.test.ts` 输出 +
   `pnpm --filter @dsh-agent-team/runtime typecheck` 输出 → evidence 目录。

## Gates

- focused：`pnpm vitest run packages/runtime/test/mcp-supply-config.test.ts`（全绿）
- 回归（防 host 校验破坏）：`pnpm vitest run packages/runtime/test/t4a-capability-wiring.test.ts packages/runtime/test/team-skills.test.ts`
  （team-skills = PR #15 新增 host 面，防意外）
- `pnpm --filter @dsh-agent-team/runtime typecheck` exit 0

## 完成定义

- 新文件恰好 2（mcp-supply.ts + mcp-supply-config.test.ts）+ 2 个 owned 修改（types.ts/host.ts）+ evidence。
- `git diff --stat b49f4239..HEAD` 逐文件核对 = owned 集（p4t6 不得出现）。
- 报告按 I12 格式。
