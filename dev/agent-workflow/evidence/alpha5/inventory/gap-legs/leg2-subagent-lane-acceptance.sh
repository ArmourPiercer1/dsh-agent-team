#!/usr/bin/env bash
# leg2-subagent-lane-acceptance.sh — DRAFT/未执行（执行归 A 线真装矩阵路）
# 目的：成员×subagent 一条端到端链 + strict 负控（GAP-LEGS 腿②）。
# 静态前提（R 已钉）：缺省挂载 base cordis.patch.yml:370/:383（fork）；codex/claude_code 仅 web presets:102/:110 且默认 disabled；
#   strict=KNOWN_SENSITIVE setup FATAL（permission-coverage.ts:153-154，注释原文 escapes MemberInstance governance）；
#   非 strict=per-call 直通（pre-execute-adapter.ts:1240-1242）；Team 唯一消费=drain（glue:4915/:4955-4962）。
set -euo pipefail
REPO=/srv/workspace/dsh-plugins/dsh-agent-team
WORLD=a5-sublane
# 正链（一条跑通即算）：
#  [1] 非 strict 蓝图（无 capabilities.permissions）建 TeamSession；
#  [2] Leader team_create_member + team_delegate 一任务；
#  [3] 成员会话内真调 host `subagent`（模型面可见=缺省挂载已证）→ 子代理完成、结果回成员；
#  [4] 成员 team_collect 带回；
#  [5] team_archive_member → **判定=drain 观察**：drainContinuableDescendants 计数归零、无活 job/子代理残留
#      （读 glue:4955-4962 typed 路径的 trace；subagents service absent → 应 typed 拒，作为服务缺位负控）。
# 负控（纯 setup 级，可先行）：
#  [6] 同蓝图加 capabilities.permissions → 预期 setup 即 FATAL：typed `alpha2-permission-coverage-unmanaged-tools`
#      点名 subagent/subagent_fork（读 agent-bindings.mjs:2678-2695 门错误 detail 的 sensitive 分类清单）。
# 预期红注：正链 PASS ≠ 车道治理成立（直通形，ADR:69 缺口仍在）；收口表述禁「subagent 已纳管」。
echo "DRAFT — 未执行。" >&2; exit 2
