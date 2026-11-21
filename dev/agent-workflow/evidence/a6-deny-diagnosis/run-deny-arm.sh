#!/usr/bin/env bash
set -u
TAG=$1; WT=$2; HP=$3; MP=$4; EXTRA=${5:-}
REPO=/home/armourpiercer/projects/dsh-agent-team
EV=$REPO/dev/agent-workflow/evidence/a6-deny-diagnosis/runs/$TAG
mkdir -p "$EV"
printf 'tag=%s worktree=%s head=%s host=%s mock=%s extra=%s start=%s\n' "$TAG" "$WT" "$(git -C "$WT" rev-parse HEAD)" "$HP" "$MP" "$EXTRA" "$(date -u +%FT%TZ)" > "$EV/command.txt"
cd "$WT" || exit 9
env C1_ALPHA6_OFFICER=1 C1_PLANE_TAKEOVER=1 C1_A6_EXEC_NEG=1 ${EXTRA} \
  node "$WT/tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs" \
  --host-port "$HP" --mock-port "$MP" --evidence-dir "$EV" > "$EV/stdout.log" 2>&1
code=$?
printf 'exit=%s end=%s\n' "$code" "$(date -u +%FT%TZ)" >> "$EV/command.txt"
echo "EXIT $TAG $code"
