#!/usr/bin/env bash
# run-all.sh — Alpha.5 P0 PoC fixture experiments, idempotent re-run entry.
# Run from anywhere; all paths self-locate. Requires: node >= 22, built
# pristine host checkout at tests/deepseek-harness-test-use @639ed01539
# (pnpm install + pnpm run build once; see TEST_METHODS §2), deps installed
# in this worktree. Exit 0 = every fixture leg matches its documented
# expectation. Writes only under dev/agent-workflow/evidence/**.
set -uo pipefail
cd "$(dirname "$0")/../../../.."   # -> worktree root
EV=dev/agent-workflow/evidence/alpha5-adapter-p0
fail=0
run() { # label script
  echo "=== $1 ==="
  t0=$(date +%s)
  node "$2"
  local ec=$?
  echo "--- $1 EXIT=$ec SECONDS=$(( $(date +%s) - t0 ))"
  [ "$ec" -eq 0 ] || fail=1
}
run P0-0 "$EV/00-baseline/p00-runner.mjs"
run P0-1 "$EV/01-routing/p01-runner.mjs"
[ -f "$EV/02-search/p02-search-runner.mjs" ] && run P0-2 "$EV/02-search/p02-search-runner.mjs" || echo "P0-2 runner absent (see notes)"
[ -f "$EV/03-fs/p03-fs-runner.mjs" ] && run P0-3 "$EV/03-fs/p03-fs-runner.mjs" || echo "P0-3 runner absent (see notes)"
if [ "${RUN_P04:-0}" = "1" ]; then bash "$EV/04-process/env-capability-probe.sh" || echo "--- P0-4 probe nonzero exit (ENV_BLOCK legs are expected; see matrix)"; else echo "P0-4 skipped (RUN_P04=1 to run OS capability probe)"; fi
[ -f "$EV/05-ptc/p05-runner.mjs" ] && run P0-5-ptc "$EV/05-ptc/p05-runner.mjs" || echo "P0-5 runner absent (see notes)"
[ -f "$EV/06-lsp/p05-runner.mjs" ] && run P0-5-lsp "$EV/06-lsp/p05-runner.mjs" || echo "P0-5 LSP runner absent (see notes)"
exit "$fail"
