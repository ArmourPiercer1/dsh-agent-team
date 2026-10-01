#!/usr/bin/env bash
# NOTE: absolute paths below are the ones this environment uses; the probes are kept
# verbatim as the scripts that produced probe-rejections.log / probe-prb-accept.log.
# Fixture-parameterization validation probe: rejection paths ONLY (plus the
# "does it boot" negative check). No host boot, no browser leg: every case
# must exit at argument validation, before any port is bound.
set -u
WT=/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/test-infra-fixture-param
PRB="$WT/tests/kits/pr-b-effective-policy-smoke/pr-b-effective-policy-smoke.mjs"
TVS="$WT/tests/kits/team-view-sync-complete-e2e/browser-smoke-host.mjs"

run() { # run <label> <kit> <args...>
  local label="$1"; shift
  local kit="$1"; shift
  local out rc
  out=$(cd "$WT" && node "$kit" "$@" 2>&1); rc=$?
  local first
  first=$(printf '%s\n' "$out" | grep -m1 -E 'FATAL|requires a value' || true)
  printf '%-44s | exit=%s | %s\n' "$label" "$rc" "${first:-<no fatal line>}"
  if printf '%s\n' "$out" | grep -qE 'booting host|host [0-9] up|READY |mock model on|seeding world'; then
    printf '   !!! LEAK: a boot/seed line appeared for: %s\n' "$label"
  fi
}

echo "== pr-b rejections"
run 'empty value (--seed-world "")'          "$PRB" --seed-world ''
run 'missing world'                          "$PRB" --seed-world no-such-world-xyz
run 'dot-dot escape (--seed-world ..)'       "$PRB" --seed-world '..'
run 'dot-dot escape (--seed-world ../x)'     "$PRB" --seed-world '../homes/nope'
run 'world name with separators'             "$PRB" --seed-world 'a/b'
run 'absolute path outside homes (/etc)'     "$PRB" --seed-world /etc
run 'symlink escape (-> test-use tree)'      "$PRB" --seed-world paramprobe-escape
run 'symlink escape (-> /etc)'               "$PRB" --seed-world paramprobe-etc
run 'dot value'                              "$PRB" --seed-world '.'
run 'whitespace value'                       "$PRB" --seed-world ' '
run 'empty both path flags (first reported)' "$PRB" --seed-world '' --seed-blueprint-dir ''
run 'empty --seed-blueprint-dir alone'       "$PRB" --seed-blueprint-dir ''
run '--seed-blueprint-dir outside homes'     "$PRB" --seed-blueprint-dir /tmp
run '--seed-blueprint-dir dot-dot'           "$PRB" --seed-blueprint-dir '../../etc'
run '--t1 empty'                             "$PRB" --t1 ''
run '--t1 wrong shape (no prefix)'           "$PRB" --t1 'session-prb-t1-x'
run '--t1 truncated prefix only'             "$PRB" --t1 'session-mpr-t1-'
run '--t1 path-ish value'                    "$PRB" --t1 'session-mpr-t1-../../x'
run '--worker-instance empty'                "$PRB" --worker-instance ''
run '--worker-instance uppercase'            "$PRB" --worker-instance 'inst-1P8KQFL09BHR'
run '--worker-instance no prefix'            "$PRB" --worker-instance '1p8kqfl09bhr'
run '--worker-instance trailing sep'         "$PRB" --worker-instance 'inst-abc/'

echo
echo "== browser-smoke-host rejections"
run 'empty --seed-world'                     "$TVS" --seed-world ''
run 'dot-dot escape'                         "$TVS" --seed-world '../homes/nope'
run 'absolute outside homes'                 "$TVS" --seed-world /etc
run 'symlink escape (-> test-use tree)'      "$TVS" --seed-world paramprobe-escape
run 'world name with separators'             "$TVS" --seed-world 'x/y'
run 'missing world'                          "$TVS" --seed-world no-such-world-xyz
run 'dot value'                              "$TVS" --seed-world '.'
run '--t1 wrong shape'                       "$TVS" --t1 'session-tvs-t1-x'
run '--t1 empty'                             "$TVS" --t1 ''
