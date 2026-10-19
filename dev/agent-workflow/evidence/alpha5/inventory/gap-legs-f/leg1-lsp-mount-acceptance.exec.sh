# [F-ROUTE EXEC COPY] Original R draft untouched under .worktrees/a5-inventory (R writer face). In THIS copy the
# DRAFT self-refusal guard (echo "DRAFT — 未执行…" >&2; exit 2) is REMOVED per the F-route dispatch and kept
# below as a comment. The executable acceptance this copy maps to = run-a5-legs-live.mjs --leg=<leg>.
#!/usr/bin/env bash
# leg1-lsp-mount-acceptance.sh — DRAFT/未执行（R 起草，禁真装；执行归 prod-lsp 装面 writer 或 A 线并跑）
# 目的：驱动「host lsp 挂载 + Team 世界 + per-call 车道」组合首证（GAP-LEGS 腿①）。
# 静态前提（R 已钉）：lsp ∈ per-call file-class（operation-permission/types.ts:59-65、canonical-operation.ts:699、listener glue:3019）；
#   tool-lsp shipped 零 preset 行（主检出 packages/bundle/**/*.yml 亲 grep）；plane 无 lsp 行且不可有（team-tool-plane.mjs:321-325/:327-330）。
set -euo pipefail
REPO=/srv/workspace/dsh-plugins/dsh-agent-team   # 主检出（paths.mjs 唯一路径源）
WORLD=a5-lsp-mount                                # TEST_METHODS §7 命名/清理协议
WORLD_DIR="$REPO/tests/homes/$WORLD"
# [1] 世界 = 宿主 profile patch 显式加 tool-lsp 行（rev3 亲核的 opt-in 启用形）：
#     - insert: {id: tool-lsp, name: '@deepseek-ai/dsh-tool-lsp'}   # 条目形按宿主 README §opt-in 同款
# [2] Team 蓝图：capabilities.permissions 声明 lsp lane —— allow 资源 R_allow（workspace 内项目）/ deny 资源 R_deny（禁区路径）；
#     另备 strict 变体做 setup 门正走（class-1 应通过，coverage 不 FATAL——lsp 非 sensitive）。
# [3] 起停链（TEST_METHODS §2/§5，端口 3180 族，禁 3080）：
#     cd "$REPO/tests/deepseek-harness-test-use" && DSH_HOME="$WORLD_DIR" node apps/cli/lib/bin.js web --port 3181 --no-open
# [4] 判定读（三处全读才算过）：
#     a) deny 腿：模型面对 R_deny 发 lsp 调用 → typed deny verbatim（读 session trace `observe stage='canonicalized' tool='lsp'`
#        + guard-verdict/deny 字符串；参照 pre-execute-adapter.ts:1985-2010 deny 文案形）。
#     b) allow 腿：R_allow 上 lsp 调用 → 真 clangd 应答（clangd 在位=试用机 #306 已证）。
#     c) 反冒名负控：蓝图 plane 若以 'lsp' 冒名挂载 → PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED（装配期拒，team-tool-plane.mjs:321-325 区）。
# [5] 红不销案注：本腿 PASS ≠ 全键池（PolicyGeneration 键=CORE_SEAM_BLOCKER，LSP-rulings-brief.md:24-25，只登记不启动）。
# [6] 产物：runs/<UTC>/ 收据落执行路 evidence（勿落 R inventory）；receipt 字段按 PLAN:150 如实写粒度。
# [REMOVED BY F-ROUTE] echo "DRAFT — 未执行；本脚本由归属 writer 展开为 kit 后运行。" >&2; exit 2
