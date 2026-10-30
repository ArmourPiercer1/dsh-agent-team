#!/usr/bin/env bash
# provision-testuse.sh — TEST_METHODS §2 + §6(2026-10-03) provisioning of a per-worktree
# pristine runtime checkout for the u7r3-xval controlled parallel-validation experiment.
#   $1 = worktree root (absolute)   $2 = log path (under the task evidence dir)
# Zero writes to the source (main checkout test-use) or the shared baseline
# (EF-04: it has no .git, so it is never a clone source here).
set -euo pipefail
WT="$1"
SRC=/srv/workspace/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use
PIN=639ed015397290b3745d163aafe02ffee4aa3f84
LOG="$2"
log() { echo "[$(date -u +%FT%TZ)] load=$(cut -d' ' -f1-3 /proc/loadavg) $*"; }
exec > >(tee -a "$LOG") 2>&1
log "provision start wt=$WT"

# preconditions on the clone source (read-only)
[ "$(git -C "$SRC" rev-parse HEAD)" = "$PIN" ] || { echo "FATAL: main test-use HEAD != pin"; exit 3; }
[ -z "$(git -C "$SRC" status --porcelain)" ] || { echo "FATAL: main test-use porcelain not empty"; exit 3; }
log "main test-use verified: HEAD==$PIN porcelain-empty"

DST="$WT/tests/deepseek-harness-test-use"
# RESUME-SAFE: an existing correctly-pinned clean clone skips the clone step.
if [ -d "$DST/.git" ] && [ "$(git -C "$DST" rev-parse HEAD 2>/dev/null)" = "$PIN" ] && [ -z "$(git -C "$DST" status --porcelain)" ]; then
  log "clone already in place (resume path), skipping"
else
  [ ! -e "$DST" ] || { echo "FATAL: $DST exists but is not the pinned clean tree"; exit 3; }
  t0=$(date +%s)
  git clone --local --no-hardlinks --no-checkout "$SRC" "$DST"
  git -C "$DST" checkout --detach "$PIN"
  log "clone+checkout done in $(( $(date +%s) - t0 ))s (EF: main test-use is a SHALLOW repo; git ignores --local for shallow sources)"
fi
[ "$(git -C "$DST" rev-parse HEAD)" = "$PIN" ] || { echo "FATAL: clone HEAD wrong"; exit 3; }
[ -z "$(git -C "$DST" status --porcelain)" ] || { echo "FATAL: clone porcelain not empty"; exit 3; }
# EF-04 disclosure: the shared baseline is NOT used as clone source (no .git).
ls /srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness/.git >/dev/null 2>&1 && echo "WARN: baseline unexpectedly has .git" || log "EF-04 confirmed: shared baseline has no .git (never a clone source)"

# pnpm state redirection: /home/user is a READ-ONLY filesystem here (EROFS on
# ~/.local/share/pnpm/store + ~/.npm + ~/.cache), so store/cache go to the
# workspace .artifacts/tmp. Integrity stays strict: --frozen-lockfile verifies
# every fetched package against the checked-in lockfile; --ignore-scripts per
# TEST_METHODS 2.
PNPMBASE=/srv/workspace/dsh-plugins/dsh-agent-team/.artifacts/tmp/xval-pnpm
mkdir -p "$PNPMBASE/store" "$PNPMBASE/npm-cache"
export npm_config_cache="$PNPMBASE/npm-cache"

t1=$(date +%s)
cd "$DST"
pnpm install --ignore-scripts --frozen-lockfile --config.store-dir="$PNPMBASE/store"
log "pnpm install done in $(( $(date +%s) - t1 ))s; porcelain: $(git status --porcelain | wc -l) lines"

t2=$(date +%s)
DSH_CLIENT_COMMIT_HASH=639ed01539 ESBUILD_WORKER_THREADS=1 pnpm run build
log "pnpm run build done in $(( $(date +%s) - t2 ))s"

[ -f "$DST/apps/cli/lib/bin.js" ] || { echo "FATAL: apps/cli/lib/bin.js missing after build"; exit 3; }
[ -z "$(git -C "$DST" status --porcelain)" ] || { echo "FATAL: porcelain not empty post-build"; exit 3; }
log "provision OK: bin present, HEAD==$PIN, porcelain empty"
