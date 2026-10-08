#!/usr/bin/env bash
# End-to-end local simulation of .github/workflows/census-runtime.yml, minus the runner itself.
# Steps run IN ORDER, verbatim as extracted from the YAML, each WITH the `env:` the runner composes
# around it (extract-step.py) and with `$GITHUB_ENV` re-published between steps exactly as Actions
# does. Throwaway directory, real network: fetch the pinned SHA → build the host → point the
# worktree at THAT host → run the census.
#
#   bash dev/agent-workflow/evidence/a4-pr7/census-runtime/e2e-provision-run.sh
#
# ~6 minutes (host install ~62 s + host build ~162 s + census ~234 s). Restores the worktree's host
# symlink on every exit path: the shared pristine host at the other end of it is every other lane's
# runtime, and this lane has no business writing into it.
#
# Two things this harness had to get right, both learned by watching it fail:
#   * a `run:` block without its step `env:` is a different program — the first version exported
#     nothing, so HOST_URL was empty and the block built THIS repo while reporting success;
#   * `$GITHUB_ENV` must be sourced between steps, or a step reads an empty pin and the drift
#     assertion grades nothing.
# And one it reproduced by accident: a `#` comment between backslash-continued lines eats the rest
# of the logical line. It was in THIS script before the census leg it was meant to prove.
set -uo pipefail

HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../../../../.." && pwd)
cd "$REPO" || exit 1
WF=.github/workflows/census-runtime.yml
E2E=$REPO/.tmp-verify/e2e
RT=$REPO/.tmp-verify/runner-temp
HOST_DIR=tests/deepseek-harness-test-use
OUT=$HERE/E2E-PROVISION-THEN-CENSUS.txt
mkdir -p "$RT"

extract() { python3 "$HERE/extract-step.py" "$WF" census-runtime "$1" "$2" "$RT"; }
for i in 0 1 2 4 5; do extract "$i" "$E2E-step$i"; done

# runstep <prefix> [cwd]: the step's own env first, then its script; then publish $GITHUB_ENV for
# the next step, the way the runner does. No comment may sit inside the continuation below.
runstep() {
  local pre=$1 dir=${2:-$REPO} rc=0
  if [ -s "$E2E/github.env" ]; then
    set -a
    # shellcheck disable=SC1090
    . "$E2E/github.env"
    set +a
  fi
  ( cd "$dir" && export RUNNER_TEMP="$RT" GITHUB_ENV="$E2E/github.env" GITHUB_WORKSPACE="$dir" && . "$pre.env" && bash "$pre.sh" )
  rc=$?
  if [ -s "$E2E/github.env" ]; then
    set -a
    # shellcheck disable=SC1090
    . "$E2E/github.env"
    set +a
  fi
  return $rc
}

PREV_TARGET=$(readlink "$HOST_DIR" 2>/dev/null || true)
# Fail closed BEFORE touching anything. A killed earlier run of this script leaves the link pointing
# into its own scratch directory, and then `restore` below faithfully restores THE WRONG TARGET and
# reports success — which is how one run of this harness ended with the worktree linked at a stale
# throwaway host while the shared pristine host sat unused. If the link is already in scratch, or is
# not the pinned pristine host, refuse: this script has no business guessing where the real host is.
if [ -n "${PREV_TARGET:-}" ] && case "$PREV_TARGET" in "$REPO/.tmp-verify/"*) true ;; *) false ;; esac; then
  echo "REFUSING to run: $HOST_DIR already points into this script's own scratch ($PREV_TARGET)." >&2
  echo "An aborted run left it there. Restore it to the real pristine host first, then re-run." >&2
  exit 1
fi
if [ -n "${PREV_TARGET:-}" ]; then
  PIN=$(node -e "import('./tests/paths.mjs').then((m) => console.log(m.TEST_USE_BASELINE_SHA))")
  AT=$(git -C "$HOST_DIR" rev-parse HEAD 2>/dev/null || echo '<unreadable>')
  if [ "$AT" != "$PIN" ]; then
    echo "REFUSING to run: $HOST_DIR -> $PREV_TARGET is at $AT, not the pinned $PIN." >&2
    exit 1
  fi
  echo "start state: $HOST_DIR -> $PREV_TARGET @ $AT (pinned, porcelain $(git -C "$HOST_DIR" status --porcelain | wc -l))"
fi
restore() {
  if [ -n "${PREV_TARGET:-}" ]; then
    ln -sfn "$PREV_TARGET" "$HOST_DIR"
    echo "restored $HOST_DIR -> $PREV_TARGET @ $(git -C "$HOST_DIR" rev-parse HEAD 2>/dev/null)"
  fi
}
trap restore EXIT

{
  echo "E2E local simulation of census-runtime.yml  ($(date -u +%Y-%m-%dT%H:%M:%SZ))"
  echo "repo=$REPO  node=$(node --version)  pnpm=$(pnpm --version)"
  echo "Every step: the YAML's own text + the YAML's own env + Actions' \$GITHUB_ENV plumbing."
  echo

  T0=$(date +%s)
  echo "=== STEP 'Resolve the pinned pristine host from tests/paths.mjs' ==="
  runstep "$E2E-step0"
  echo "[exit $?]  cumulative=$(( $(date +%s) - T0 ))s"
  echo "published onward: TEST_USE_SHA=${TEST_USE_SHA:-<unset>} TEST_USE_VERSION=${TEST_USE_VERSION:-<unset>}"

  echo
  echo "=== STEP 'Provision the pinned pristine test host' (fresh dir, real network) ==="
  rm -rf "$E2E/host"
  mkdir -p "$E2E/host"
  T=$(date +%s)
  runstep "$E2E-step1" "$E2E/host"
  echo "[exit $? seconds=$(( $(date +%s) - T ))]"

  echo
  echo "=== STEP 'Build the pristine host (TEST_METHODS §2 chain)' ==="
  T=$(date +%s)
  runstep "$E2E-step2" "$E2E/host" > "$E2E/host-build.log" 2>&1
  RC=$?
  echo "[exit $RC seconds=$(( $(date +%s) - T )) — full log: .tmp-verify/e2e/host-build.log]"
  tail -1 "$E2E/host-build.log"
  echo "host tree after build: porcelain=$(git -C "$E2E/host/$HOST_DIR" status --porcelain | wc -l) line(s)," \
       "HEAD=$(git -C "$E2E/host/$HOST_DIR" rev-parse --short HEAD 2>/dev/null)," \
       "version=$(node -p "require('$E2E/host/$HOST_DIR/package.json').version" 2>/dev/null)," \
       "size=$(du -sh "$E2E/host/$HOST_DIR" 2>/dev/null | cut -f1)"

  echo
  echo "=== point the worktree at the FRESHLY BUILT host and run the census leg ==="
  ln -sfn "$E2E/host/$HOST_DIR" "$HOST_DIR"
  echo "$HOST_DIR -> $(readlink "$HOST_DIR")"
  T=$(date +%s)
  ( cd "$REPO" && . "$E2E-step4.env" && export CI=true RUNNER_TEMP="$RT" && mkdir -p "$RT/xdg-cache" && \
    XDG_CACHE_HOME="$RT/xdg-cache" DSH_CI_STORE_DIR="$REPO/.pnpm-store" \
    node scripts/ci-pr-gate.mjs --full --only census --census-captures 2 --census-test-timeout 20000 \
      --store-dir "$REPO/.pnpm-store" --transcript-dir "$RT/census-transcripts" \
      > "$E2E/census-full.txt" 2>&1; echo "[gate exit $?]" )
  grep -E '^DSH-CI-' "$E2E/census-full.txt" | cut -c1-470
  echo "[census seconds=$(( $(date +%s) - T ))]"

  echo
  echo "=== the re-grade step over that transcript (verbatim) ==="
  cp "$E2E/census-full.txt" "$RT/census-run.txt"
  runstep "$E2E-step5"
  echo "[exit $?]"
  echo "TOTAL cumulative=$(( $(date +%s) - T0 ))s"
} > "$OUT" 2>&1
cat "$OUT"
