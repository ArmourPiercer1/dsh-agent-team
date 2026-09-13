# Wave-1 派发草稿（B/C）— 主 Agent 在 A 合入 int 后发送

> 状态：草稿。发送前置条件 = A 已合入 int + int 树 re-gate 绿 + p4t6 pin 更新提交。
> 发送方式 = subagent_fork（继承本会话上下文），worktree 内先 rebase 到 int tip。

## B 派发 prompt（要点）

你是 multi-MCP 快速修复轮的 **Task B worker**（Multi-MCP live reconciler，
`agent-bindings.mjs` 唯一 owner）。

第一步（强制）：worktree 内读 AGENTS.md / docs/ROUTER_RULES.md / docs/TEST_METHODS.md。
然后读契约与任务卡（int worktree，只读）：
- /home/user/dsh-plugins/dsh-agent-team/.worktrees/multi-mcp-int/dev/agent-workflow/briefs/multi-mcp/00-contract.md（I4 全文适用）
- .../briefs/multi-mcp/b-runtime.md

worktree: /home/user/dsh-plugins/dsh-agent-team/.worktrees/multi-mcp-b-runtime
**先** `git rebase int/multi-mcp-quick-fix`（到含 A 的 tip；A 提供
`configuredMcpServers` @ packages/runtime/src/plugin/mcp-supply.ts — import
`'../mcp-supply.js'`）。

唯一 owned 源文件 = packages/runtime/src/plugin/live/agent-bindings.mjs
（+ evidence 目录）。I4 逐条执行：state per-server（mcpViews Record /
mcpFibers Map / mcpActivationErrors Map）、resolveConsumptionViews 返回
mcpViews、applyBoundaryRecords 全 view 聚合、reconcileMcpSet（deny-first +
temporary set + 失败 rollback 不恢复 denied + commit）、两处调用点 target
= templateAllowedNames.filter(name => mcpViews[name]?.allowed === true)、
coverage 顺序保持单次 reconcile 后拍 final snapshot、close 全 dispose、
observation 点名 server、文件头注释同步。

禁改：types.ts/host.ts/mcp-supply.ts（A 产物，只 import）、test 文件（C）、
harness（C）、I9 禁改面、p4t6、dist/**。

门禁（Must-6）：grep 自检零单值命中 + t4a/h1-nullable/p8s4b/t12a-b3 运行
记录（B 单独在树时预期因 C 未适配而失败 — 逐 case 归类形态，非逻辑回归）
+ a2c2-permission-coverage 记录 + runtime typecheck 0。

提交 1-3 commits（src/evidence）；I12 报告。

## C 派发 prompt（要点）

你是 multi-MCP 快速修复轮的 **Task C worker**（RED tests + bridge/harness
diagnostics，两阶段）。

第一步（强制）：worktree 内读 AGENTS.md / docs/ROUTER_RULES.md / docs/TEST_METHODS.md。
然后读契约与任务卡（int worktree，只读）：
- .../briefs/multi-mcp/00-contract.md（I5/I6/I7/I8 适用）
- .../briefs/multi-mcp/c-tests.md

worktree: /home/user/dsh-plugins/dsh-agent-team/.worktrees/multi-mcp-c-tests
**先** `git rebase int/multi-mcp-quick-fix`（到含 A 的 tip）。

阶段 1（RED，现在）：按 c-tests.md 写 multi-mcp-wiring.test.ts（6.1-6.11
全量）+ bridge 多 MCP 支持（plugins 按 options.serverName 分桶 + mcpFailures
注入面）+ t4a/h1-nullable 按 GREEN 目标形状适配 + plugin.mjs I5 诊断。
在含 A 不含 B 的 int tip 跑 focused，逐 case 记录失败形态（必须全部可归类
为旧 runtime 单值行为/旧 state 形状，否则停下上报）。提交 RED 证据。
**阶段 1 结束就停**（I12 报告，STATUS=DONE-PHASE1，等主 Agent 通知 B 已合入）。

阶段 2（GREEN，收到主 Agent send_message 后）：rebase 到含 B 的 int tip，
Gate A focused 全量全绿（含 mcp-supply-config），不得放宽断言迁就 B —
偏差上报等裁决。GREEN 证据 + 最终 I12 报告。
