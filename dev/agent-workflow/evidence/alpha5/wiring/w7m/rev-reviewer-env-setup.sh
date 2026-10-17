set -euo pipefail
WT=/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5w7m-rev-w7m
SRC=/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-w7m-kit
BASE=/srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness
echo "[setup] shared baseline state (read-only source of truth)"
git -C "$BASE" rev-parse HEAD
git -C "$BASE" status --porcelain | wc -l
echo "[setup] rsync test-use (pristine runtime + its derived build outputs)"
rsync -a "$SRC/tests/deepseek-harness-test-use/" "$WT/tests/deepseek-harness-test-use/"
echo "[setup] rsync root node_modules"
rsync -a "$SRC/node_modules/" "$WT/node_modules/"
for p in domain client runtime; do
  echo "[setup] rsync packages/$p/node_modules"
  rsync -a "$SRC/packages/$p/node_modules/" "$WT/packages/$p/node_modules/"
done
echo "[setup] verify pinned pristine state of MY copy"
git -C "$WT/tests/deepseek-harness-test-use" rev-parse HEAD
echo -n "porcelain lines: "; git -C "$WT/tests/deepseek-harness-test-use" status --porcelain | wc -l
echo "[setup] rebuild packages/runtime dist FROM MY TREE (source @b8ac7acb)"
cd "$WT"
pnpm --filter @dsh-agent-team/runtime run build 2>&1 | tail -15
echo -n "barrel sha (mine): "; sha256sum packages/runtime/dist/packages/runtime/jobs-gateway/index.js
echo -n "barrel sha (writer): "; sha256sum "$SRC/packages/runtime/dist/packages/runtime/jobs-gateway/index.js"
echo "[setup] DONE"
