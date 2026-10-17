set -euo pipefail
WT=/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5-w7m-kit
# workspace-write sandbox: $HOME read-only ⇒ pnpm default store CANTOPEN
# (2026-09-12 log precedent, SESSION_ROUTER_LOG ~line 3644). Workspace-local
# store + XDG_DATA_HOME; reuse the shared workspace store (v11, hardlinks).
MAIN=/srv/workspace/dsh-plugins/dsh-agent-team
export XDG_DATA_HOME="$WT/.xdg-data"
mkdir -p "$XDG_DATA_HOME" "$WT/.pnpm-cache"
STORE="$MAIN/.pnpm-store-wt"
INSTALL="pnpm install --ignore-scripts --store-dir $STORE --cache-dir $WT/.pnpm-cache"
echo "[setup] $(date -Is) clone host"
if [ ! -d "$WT/tests/deepseek-harness-test-use/.git" ]; then
git clone --local --no-hardlinks /srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness "$WT/tests/deepseek-harness-test-use" 2>&1 | tail -1
git -C "$WT/tests/deepseek-harness-test-use" checkout --detach 639ed015397290b3745d163aafe02ffee4aa3f84 2>&1 | tail -1
fi
git -C "$WT/tests/deepseek-harness-test-use" rev-parse HEAD
git -C "$WT/tests/deepseek-harness-test-use" status --porcelain | wc -l
echo "[setup] $(date -Is) host pnpm install"
cd "$WT/tests/deepseek-harness-test-use"
$INSTALL 2>&1 | tail -3
echo "[setup] $(date -Is) host build"
DSH_CLIENT_COMMIT_HASH=639ed01539 ESBUILD_WORKER_THREADS=1 pnpm run build 2>&1 | tail -5
ls apps/cli/lib/bin.js && echo "[setup] $(date -Is) HOST_BUILD_OK"
echo "[setup] $(date -Is) repo pnpm install"
cd "$WT"
$INSTALL 2>&1 | tail -3
ls node_modules/typescript/bin/tsc && echo "[setup] $(date -Is) REPO_INSTALL_OK"
