#!/usr/bin/env bash
# The remaining §7.6 gate legs this lane can publish: lint, lint-identities, typecheck, artifacts.
# Evidence-only lane: nothing here can change source; a red is a FINDING, reported not fixed
# (except reds caused by THIS lane's own evidence scripts, which are the lane's to clean up).
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
  } >> "$EV/transcripts/final-battery-legs.txt"
}

: > "$EV/transcripts/final-battery-legs.txt"
echo "final battery, HEAD=$(git rev-parse --short HEAD)" >> "$EV/transcripts/final-battery-legs.txt"
run lint pnpm run lint
run lint-identities node scripts/lint-identities.mjs
run typecheck pnpm run typecheck
run check-artifacts pnpm run check:artifacts
run smoke-composition pnpm run smoke:composition
echo "DONE" >> "$EV/transcripts/final-battery-legs.txt"
tail -c 2000 "$EV/transcripts/final-battery-legs.txt"
