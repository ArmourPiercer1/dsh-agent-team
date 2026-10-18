#!/usr/bin/env bash
# rc-trial.sh — Alpha.5 最小试用脚本（release-candidate-r1；<20 行）。
# 前置：仓库根 = $(git rev-parse --show-toplevel)；宿主 = tests/deepseek-harness-test-use（pristine，已按 TEST_METHODS §2 构建）。
# 覆盖：真网络装固定 master SHA → 新 DSH_HOME=tests/homes/rc-trial-1 → 启动(3183, mock 3491, 3184 预留) →
#       建 team → create member → 委派（一个 bash 正写 + 一个越界负例）→ 看渲染 exit 真码（exit=0 / exit=1）→ 具名清理。
set -euo pipefail
R="$(git rev-parse --show-toplevel)"; SHA="$(git -C "$R" ls-remote origin refs/heads/master | cut -f1)"
git -C "$R" worktree add --detach "$R/.worktrees/rc-trial-audit" "$SHA" 2>/dev/null || true   # 审计树 @ 同一 SHA（launcher 部署输入提取用）
E="$R/dev/agent-workflow/evidence/alpha5/release-candidate-r1"
test ! -e "$R/tests/homes/rc-trial-1"   # 世界必须全新（存在即拒跑，fail-closed）
node "$E/rc-trial-kit.mjs" --repo "$R" --worktree "$R/.worktrees/rc-trial-audit" \
  --home "$R/tests/homes/rc-trial-1" --port 3183 --reserved-port 3184 --mock-port 3491 \
  --store-dir "$R/.pnpm-store-a5ie-r4-b2" --evidence-dir "$E/runs/$(date -u +%Y-%m-%dT%H-%M-%SZ)"
echo "KIT_EXIT=$?  (0=GREEN 2=RED 1=FATAL; 逐腿判定与 receipts 见 runs/<stamp>/criteria.json)"
# 逐腿判据：I1-I9 安装三零+面计数重数；B1-B3 启动/目录/建团；M1 create-member+list；M2 按实例委派；
# M3 正写渲染 exit=0；M4 落盘真字节；M5 越界渲染 exit=1+内核 stderr；M6 零泄露+cancelled 现状；
# M7/M8 宿主日志见证（placement/confined-shell/a5ptc census）；C1/C2 具名清理+:3080 未触。
