#!/usr/bin/env bash
# NOTE: absolute paths below are the ones this environment uses; the probes are kept
# verbatim as the scripts that produced probe-rejections.log / probe-prb-accept.log.
# Acceptance / parameter-WIRING probes — EXPLICIT exact-path cleanup only.
# (A previous version of this probe used `find -newermt` for cleanup and
# deleted tracked historical evidence dirs; they were restored with
# `git restore` and verified byte-clean. Never again: every rm here is a
# literal path created by THIS run.)
#
# Neither probe boots a host and neither starts the mock: both are steered to
# fail on a deliberately-hollow probe fixture AFTER the kit consumed the
# overridden identity (the proof line is in the kit's own output).
set -u
WT=/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/test-infra-fixture-param
HOMES=/srv/workspace/dsh-plugins/dsh-agent-team/tests/homes
PRB="$WT/tests/kits/pr-b-effective-policy-smoke/pr-b-effective-policy-smoke.mjs"
TVS="$WT/tests/kits/team-view-sync-complete-e2e/browser-smoke-host.mjs"
OUT="$HOMES/.probe/out"
mkdir -p "$OUT" "$HOMES/paramprobe-browser/sessions"

clean() { # clean <stamp>
  local s="$1"
  rm -rf "$HOMES/prb-ep-$s" "$HOMES/tvs-smoke-$s" \
         "$WT/dev/agent-workflow/evidence/pre-alpha3-refactor/pr-b/host-smoke-$s-c3" \
         "$WT/dev/agent-workflow/evidence/team-view-sync-complete/wp9b-browser-smoke-tvs-smoke-$s"
}

stamp() { date -u +%Y-%m-%dT%H-%M-%S; }

echo "== worktree porcelain BEFORE (must be empty for the browser kit's gate)"
git -C "$WT" status --porcelain | head -3; echo "(end)"

S1=$(stamp)
echo
echo "== pr-b acceptance probe (--seed-world / --t1 / --worker-instance overridden; stamp $S1)"
cd "$WT" || exit 2
node "$PRB" --seed-world paramprobe-empty --t1 session-mpr-t1-paramprobe-accept --worker-instance inst-paramprobe1 >"$OUT/prb-accept.log" 2>&1
echo "exit=$?"
grep -nE 'world copied|FATAL|booting host|host [0-9] up|mock model on|mini-MCP' "$OUT/prb-accept.log" | head -6
grep -qE 'booting host|mock model on|mini-MCP' "$OUT/prb-accept.log" && echo '!!! LEAK: pr-b probe reached a boot'
clean "$S1"

S2=$(stamp)
echo
echo "== browser-smoke-host wiring probe (--seed-world / --t1 overridden; stamp $S2)"
node "$TVS" --seed-world paramprobe-browser --t1 session-mpr-t1-paramprobe-accept >"$OUT/tvs-accept.log" 2>&1
echo "exit=$?"
grep -nE 'seed from|commit binding|seeding world|removed stale|FATAL|READY|mock model|host spawn' "$OUT/tvs-accept.log" | head -8
grep -qE 'READY|host spawn|mock model' "$OUT/tvs-accept.log" && echo '!!! LEAK: browser probe reached a boot/mock'
clean "$S2"

echo
echo "== fixtures + probe artifacts removed"
rm -rf "$HOMES/paramprobe-empty" "$HOMES/paramprobe-browser" "$HOMES/paramprobe-escape" "$HOMES/paramprobe-etc"
ls -la "$HOMES" | head
echo "== worktree porcelain AFTER (must be empty):"
git -C "$WT" status --porcelain | head -5; echo "(end)"
