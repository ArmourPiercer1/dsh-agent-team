#!/usr/bin/env bash
# Legs 3-5 of the battery. Run as a HARNESS BACKGROUND JOB: a `cmd &` launched from a tool call
# dies with that call's PID namespace (bwrap --unshare-pid), which is also why `ps` is blind here.
set -u
export CI=true
export XDG_CACHE_HOME=/home/user/dsh-plugins/dsh-agent-team/.tmp-xdg/cache
cd /home/user/dsh-plugins/dsh-agent-team/.worktrees/a4-76-closure
EV=dev/agent-workflow/evidence/a4-pr7/7-6-closure
run () {
  local name="$1"; shift
  {
    echo "=== $name"
    echo "\$ $*"
    echo "start $(date -u +%FT%TZ)"
    "$@" 2>&1 | tail -60
    echo "[exit ${PIPESTATUS[0]}] end $(date -u +%FT%TZ)"
    echo
  } >> "$EV/transcripts/final-battery-legs-2.txt"
}
run typecheck pnpm run typecheck
run check-artifacts pnpm run check:artifacts
run smoke-composition pnpm run smoke:composition
run lint-identities-diff node scripts/lint-identities.mjs --out "$EV/scratch/lint-identities-final.txt" --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt
echo "DONE-2" >> "$EV/transcripts/final-battery-legs-2.txt"
