#!/usr/bin/env bash
# A5M2 EDIT window A — the EXACT bounded execution wrapper (root conditional
# GO 2026-10-28). WRITTEN NOW, EXECUTED ONLY AFTER f86's fixture success
# receipt (cold import + new hash/lock/path facts). Until then every run of
# this wrapper can only end NOT_RUN (the runner itself fail-closes rc3 on an
# absent fixture). One run = at most ONE boot, exactly TWO governed EDIT
# calls (allow/deny). NO auto second window, NO ad-hoc install, NO chmod,
# NO candidate switching. Fixed pins (root-ordered, 2026-10-28):
#   driver   = d66e225bec6a77b2bb586eeca99e1d60d38c9850   (this runner tree)
#   product  = 5c31341803318ab35465908bf93b1f77f5cad16a
#   tgz sha  = 0a3f11b2c07178cd5377debb11c221fac23d963c666a7a2688ba446168d50b6b
#   host     = 639ed01539 checkout (tests/deepseek-harness-test-use)
#   HOME     = tests/homes/a5m2-edit-hw-a-<UTCts>Z   budget 64 MiB (new bytes, links==1)
#   ports    = 3183 host + 3498 mock; PRE-CHECK ONLY, occupied => refuse (NEVER kill foreign)
#   outer    = 300s hard; df avail >= 18,000,000,000 B
set -euo pipefail

REPO_WT=/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5m2-wire-g3
RUNNER=dev/agent-workflow/evidence/a5m2-edit-host-window/scripts/05-edit-window-runner.mjs
DRIVER_SHA=d66e225bec6a77b2bb586eeca99e1d60d38c9850
TS=$(date -u +%Y%m%dT%H-%M-%SZ)
OUT=dev/agent-workflow/evidence/a5m2-edit-host-window/window-${TS}
DF_MIN=18000000000
HOME_BUDGET=67108864   # 64 MiB of NEW bytes (nlink==1), fourth-window law

cd "$REPO_WT"
mkdir -p "$OUT"
exec > >(tee -a "$OUT/wrapper.log") 2>&1
echo "window wrapper ${TS} driver=${DRIVER_SHA}"

fail() { echo "WRAPPER VERDICT: $1 (rc $2)"; exit "$2"; }

# [0] driver law: the runner file must be byte-identical to the signed d66
#     surface, and HEAD must carry the signed commit (later commits may only
#     add wrapper/evidence, never touch the runner).
HEAD_SHA=$(git rev-parse HEAD)
git merge-base --is-ancestor "$DRIVER_SHA" "$HEAD_SHA" || fail "HEAD ${HEAD_SHA} does not carry the driver pin ${DRIVER_SHA} (no candidate switching)" 3
RUNNER_AT_PIN=$(git show "${DRIVER_SHA}:${RUNNER}" | sha256sum | cut -d' ' -f1)
RUNNER_NOW=$(sha256sum "$RUNNER" | cut -d' ' -f1)
[ "$RUNNER_AT_PIN" = "$RUNNER_NOW" ] || fail "runner drifted from the d66 signed surface (pin ${RUNNER_AT_PIN} now ${RUNNER_NOW})" 3
echo "driver law: HEAD carries ${DRIVER_SHA}; runner byte-identical to the signed surface"

# [1] f86 fixture success must have landed: explicit full path from the f86
#     receipt is REQUIRED input; absent/failed fixture = NOT_RUN, never build
#     one here.
: "${A5M2_EDIT_INSTALL_DIR:?A5M2_EDIT_INSTALL_DIR must be the final full f86 fixture path - the f86 success receipt is required}"
[ -d "$A5M2_EDIT_INSTALL_DIR" ] || fail "f86 fixture absent at ${A5M2_EDIT_INSTALL_DIR} — f86 success receipt not yet real; NOT booting, NOT installing" 3
FIX_LOCK_BEFORE=$(sha256sum "$A5M2_EDIT_INSTALL_DIR/pnpm-lock.yaml" | cut -d' ' -f1) || fail "fixture pnpm-lock unreadable" 3
FIX_PKG_BEFORE=$(sha256sum "$A5M2_EDIT_INSTALL_DIR/package.json" | cut -d' ' -f1) || fail "fixture package.json unreadable" 3
echo "fixture before: lock=${FIX_LOCK_BEFORE:0:16}… pkg=${FIX_PKG_BEFORE:0:16}…"

# [2] capacity: df avail (bytes) on the workspace filesystem
AVAIL=$(df -B1 --output=avail /srv/workspace/dsh-plugins/dsh-agent-team | tail -1 | tr -d ' ')
echo "df avail: ${AVAIL} B (min ${DF_MIN})"
[ "$AVAIL" -ge "$DF_MIN" ] || fail "capacity below the 18GB decimal bar — no boot" 3

# [3] port pre-check: probe only; occupied refuses (foreign occupants are NEVER killed)
for P in 3183 3498; do
  if ss -ltn "sport = :${P}" | grep -q LISTEN; then fail "port ${P} occupied by a foreign occupant — refuse, never kill" 3; fi
done
echo "ports 3183/3498 free (pre-check)"

# [4] ONE bounded run: own process group, 300s outer TERM to the GROUP, 20s
#     grace, then KILL the GROUP only, then wait. Foreign trees untouched.
RC=0
A5M2_EDIT_WINDOW=GRANTED setsid timeout --group --kill-after=20s 300s \
  node "$RUNNER" || RC=$?
echo "runner rc=${RC} (124/137 = outer 300s bound fired on the OWN group)"

# [5] post facts: ports free, this window's HOME + lock retained, fixture
#     byte-stable (read-only reuse), HOME new-bytes budget.
sleep 2
for P in 3183 3498; do
  ss -ltn "sport = :${P}" | grep -q LISTEN && fail "port ${P} still occupied after exit — runner cleanup fact FALSE" 1
done
echo "ports 3183/3498 free (post)"
WORLD=$(ls -1d tests/homes/a5m2-edit-hw-a-*-Z 2>/dev/null | tail -1 || true)
[ -n "$WORLD" ] || fail "expected HOME for this window not found (raw retention law broken?)" 1
[ -f "$WORLD/a5m2-edit-hw-lock.json" ] && echo "world lock retained: $WORLD"
NEWB=$(find "$WORLD" -type f -links 1 -printf '%s\n' 2>/dev/null | awk '{t+=$1} END {print t+0}')
echo "HOME new bytes (nlink==1): ${NEWB} (budget ${HOME_BUDGET})"
FIX_LOCK_AFTER=$(sha256sum "$A5M2_EDIT_INSTALL_DIR/pnpm-lock.yaml" | cut -d' ' -f1)
FIX_PKG_AFTER=$(sha256sum "$A5M2_EDIT_INSTALL_DIR/package.json" | cut -d' ' -f1)
{ [ "$FIX_LOCK_BEFORE" = "$FIX_LOCK_AFTER" ] && [ "$FIX_PKG_BEFORE" = "$FIX_PKG_AFTER" ]; } \
  || fail "fixture CHANGED during the window — read-only reuse violated (before lock=${FIX_LOCK_BEFORE} pkg=${FIX_PKG_BEFORE}; after lock=${FIX_LOCK_AFTER} pkg=${FIX_PKG_AFTER})" 1
echo "fixture byte-stable across the window (lock/pkg hashes equal)"

cat > "$OUT/external-receipt.json" <<EOF
{
  "stamp": "${TS}", "driverSha": "${DRIVER_SHA}", "headAtRun": "${HEAD_SHA}",
  "installDir": "${A5M2_EDIT_INSTALL_DIR}",
  "fixtureLockSha256Before": "${FIX_LOCK_BEFORE}", "fixtureLockSha256After": "${FIX_LOCK_AFTER}",
  "fixturePkgSha256Before": "${FIX_PKG_BEFORE}", "fixturePkgSha256After": "${FIX_PKG_AFTER}",
  "dfAvailBytes": ${AVAIL}, "runnerRc": ${RC},
  "portsFreePost": true, "worldRetained": "${WORLD}", "homeNewBytes": ${NEWB},
  "homeBudget": ${HOME_BUDGET}
}
EOF

[ "$NEWB" -le "$HOME_BUDGET" ] || { echo "WRAPPER VERDICT: HOME budget breach (rc 1)"; exit 1; }
[ "$RC" -eq 0 ] || { echo "WRAPPER VERDICT: runner non-zero rc=${RC} — STOP (no second window without a fresh root order)"; exit "$RC"; }
echo "WRAPPER VERDICT: OK — raw + HOME retained at ${OUT} and ${WORLD}"
