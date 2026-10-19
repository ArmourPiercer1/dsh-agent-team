# [F-ROUTE EXEC COPY] Original R draft untouched under .worktrees/a5-inventory (R writer face). In THIS copy the
# DRAFT self-refusal guard (echo "DRAFT — 未执行…" >&2; exit 2) is REMOVED per the F-route dispatch and kept
# below as a comment. The executable acceptance this copy maps to = run-a5-legs-live.mjs --leg=<leg>.
#!/usr/bin/env bash
# leg3-mcp-governance-posneg.sh — DRAFT/未执行（主责=PR7 行 writer/M31 同路；负控现状红账可归 A 线顺跑）
# 目的：MCP×per-call 治理面「结构性缺席」的现状复现 + 最小正负控（GAP-LEGS 腿③）。
# 静态前提（R 已钉，无需真装即成立，本脚本=把静态判定变成活体收据）：
#   setup=class-3 通过（permission-coverage.ts:304-306 + mcpIntroducedToolNames:388-394）；
#   per-call=直通：classifyPermissionTool 闭集 7 名（canonical-operation.ts:260-268）→ unsupported →
#   `return await next()`（pre-execute-adapter.ts:1240-1242）——canonicalize/规则/guard 全不进；
#   mcp__ 前缀 plane 钉（team-tool-plane.mjs:320）与供给校验（mcp-supply.ts:33,70）均非 per-call 治理。
# 判据出处（冻结计划）：ADR:69 dispatchable⊆governed（MCP 在列）；PLAN:70 未知工具 deny；
#   PLAN:74 NEG H6 「hc-dyn-observation.dynRan=true 必须变为 deny」；PLAN:150 允许如实 UNSUPPORTED/BOUNDED-DEFER。
set -euo pipefail
REPO=/srv/workspace/dsh-plugins/dsh-agent-team
WORLD=a5-mcp-gov
# [1] fixture stdio MCP server（testkit 域内合成，禁真实外部 server）暴露单工具 `mcp__a5probe__echo`（调用即回显+服务端计数）。
# [2] 负控（预期红=现状复现）：strict 蓝图（capabilities.permissions，lane 对 mcp__a5probe__echo 无任何显式 allow）
#     → 模型面调用该 MCP 工具 →
#     现状预期：执行成功、server 计数 +1（= dynRan=true 记账，PLAN:74 语义）；
#     目标态（PR7 收口后）：typed deny 且不触 server。两态差=缺口收据本体。
# [3] 正控 A：同世界 host `read` 对 deny 资源仍 typed deny（证明 listener 在位、直通仅 unsupported 闭集外，非全局失效）。
# [4] 正控 B：team_grep 别名行正常受 lane 支配不受 MCP 直通扰。
# [5] 负控 C（装配面）：蓝图 plane 以 mcp__ 前缀冒名 → PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED（:320 钉）。
# 收口纪律：本腿允许结局含「如实 BOUNDED-DEFER」（PLAN:150）；禁「MCP 治理已覆盖」表述；红账落执行路 evidence。
# [REMOVED BY F-ROUTE] echo "DRAFT — 未执行。" >&2; exit 2
