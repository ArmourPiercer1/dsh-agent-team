#!/bin/bash
# Re-run of the two kits that fast-failed on the tracked probeStableInstance bug
# (r.text is not a function — :3180 not listening in this environment; the probe is
# red-line observation only). Runs the SCRATCH-copied kits (diff vs tracked = ONLY the
# probeStableInstance function, disclosed in-file); everything else (legs, asserts,
# ports, homes, evidence layout) is the tracked kit byte-for-byte.
# Waits for the main battery (bash-5440) to finish (its battery-99-post.log marker)
# to avoid port contention.
set -o pipefail
cd /srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/handoff-closure
E=dev/agent-workflow/evidence/pre-alpha3-refactor/closure
B=$E/realhost-battery-post-merge
MARKER="$B/battery-99-post.log"
HEAD=$(git rev-parse HEAD)
PORC=$(git status --porcelain)

echo "== waiting for the main battery to finish (marker: $MARKER) =="
for i in $(seq 1 480); do
  if [ -f "$MARKER" ]; then echo "marker present after $((i*30))s"; break; fi
  sleep 30
done
if [ ! -f "$MARKER" ]; then echo "TIMEOUT waiting for the main battery marker"; exit 2; fi
sleep 10  # margin for last port frees

kit_rerun() {
  n="$1"; kitdir="$2"; kit="$3"
  L="$B/$n.log"
  {
    echo "== $n (SCRATCH-ADAPTED RE-RUN — probeStableInstance fix only; see in-file disclosure; tracked kit unchanged) =="
    echo "HEAD: $HEAD (closure head; product tree byte-identical to merged master c19af1954239c6b3933e708fd9bdb0d50dbe1ea4)"
    echo "date: $(date -u +%FT%TZ)"
    echo "scratch kit: tests/kits-scratch/$kitdir/$kit.mjs (re-built layout: <worktree>/tests/kits-scratch/<kit>/ so ../../ = tests/ (real) and ../../../ = the closure worktree root) (diff vs tracked = ONLY probeStableInstance, disclosed)"
    echo "git status --porcelain:"
    echo "$PORC"
    echo "\$ diff tests/kits/$kitdir/$kit.mjs tests/kits-scratch/$kitdir/$kit.mjs   (the complete adaptation delta)"
    diff "tests/kits/$kitdir/$kit.mjs" "tests/kits-scratch/$kitdir/$kit.mjs"
    echo "DIFF_EXIT=$? (1 = the disclosed probe-only delta)"
    echo "\$ node tests/kits-scratch/$kitdir/$kit.mjs"
  } > "$L"
  node "tests/kits-scratch/$kitdir/$kit.mjs" >> "$L" 2>&1
  ec=$?
  echo "${n^^}_EXIT=$ec" >> "$L"
  echo "=== $n EXIT=$ec ==="
  sleep 5
}

kit_rerun battery-r1-prf-closure-rerun   pr-f-closure-smoke          pr-f-closure-smoke
kit_rerun battery-r2-ereq-recovery-rerun pr-e-requirement-recovery-smoke pr-e-requirement-recovery-smoke
echo RERUN_DONE
