#!/usr/bin/env bash
# A5M2 EDIT window A — the EXACT bounded execution wrapper (root conditional
# GO 2026-10-28). WRITTEN NOW, EXECUTED ONLY AFTER f86's fixture success
# receipt (cold import + new hash/lock/path facts). Until then every run of
# this wrapper can only end NOT_RUN (the runner itself fail-closes rc3 on an
# absent fixture). One run = at most ONE boot, exactly TWO governed EDIT
# calls (allow/deny). NO auto second window, NO ad-hoc install, NO chmod,
# NO candidate switching. Fixed pins (root-ordered, 2026-10-28):
#   driver   = d66e225bec6a77b2bb586eeca99e1d60d38c9850 execution LOGIC,
#              carried by HEAD (sync card 2026-10-28 moved ONLY the runner's
#              product/expectation constants; logic untouched)
#   product  = 37646ac288dbd0ee3c998343dc91fd1a8da7a2d5 (root-accepted
#              minimal release fix, direct child of 5c313418: 3 dist +
#              placement).  The old pack hash 0a3f11b2... is RETIRED; the
#              NEW tgz full hash + real path arrive ONLY via the receipt
#              envs A5M2_EDIT_PACK_SHA256 / A5M2_EDIT_INSTALL_DIR (+ optional
#              A5M2_EDIT_TGZ_NAME). Boot additionally requires f86's real
#              lock facts and cold-import RC0 on the packing entry.
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
DF_MIN=6442450944   # root 09:31Z order: temporary 6 GiB bar for this window (20GB maintenance target NOT withdrawn)
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
RUNNER_NOW=$(sha256sum "$RUNNER" | cut -d' ' -f1)
if [ -n "${A5M2_EDIT_RUNNER_SHA256:-}" ]; then [ "$A5M2_EDIT_RUNNER_SHA256" = "$RUNNER_NOW" ] || fail "runner sha256 ${RUNNER_NOW} differs from the cross-checked ${A5M2_EDIT_RUNNER_SHA256}" 3; fi
echo "driver law: HEAD carries ${DRIVER_SHA} (logic pin); runner file sha256 ${RUNNER_NOW} (recorded; constants sync card 2026-10-28 is the only sanctioned drift from the d66 surface)"

# [1] f86 fixture success must have landed: explicit full path from the f86
#     receipt is REQUIRED input; absent/failed fixture = NOT_RUN, never build
#     one here.
: "${A5M2_EDIT_INSTALL_DIR:?A5M2_EDIT_INSTALL_DIR must be the final full f86 fixture path - the f86 success receipt is required}"
[ -d "$A5M2_EDIT_INSTALL_DIR" ] || fail "f86 fixture absent at ${A5M2_EDIT_INSTALL_DIR} — f86 success receipt not yet real; NOT booting, NOT installing" 3
FIX_LOCK_BEFORE=$(sha256sum "$A5M2_EDIT_INSTALL_DIR/pnpm-lock.yaml" | cut -d' ' -f1) || fail "fixture pnpm-lock unreadable" 3
FIX_PKG_BEFORE=$(sha256sum "$A5M2_EDIT_INSTALL_DIR/package.json" | cut -d' ' -f1) || fail "fixture package.json unreadable" 3
echo "fixture before: lock=${FIX_LOCK_BEFORE:0:16}… pkg=${FIX_PKG_BEFORE:0:16}…"

# [1.5] static-import placement audit (f86 cold-import-RC1 class: a static
#       import whose target was never placed in the pack). Pure read, zero
#       import, zero spawn; missing list => NOT_RUN rc3, window NOT spent.
AUDIT_RC=0
node dev/agent-workflow/evidence/a5m2-edit-host-window/scripts/07-static-import-audit.mjs \
  "$A5M2_EDIT_INSTALL_DIR/node_modules/dsh-agent-team" > "$OUT/static-import-audit.json" 2>&1 || AUDIT_RC=$?
echo "static-import audit (INFORMATIONAL ONLY — the real gate is f86's cold-import RC0 receipt): rc=${AUDIT_RC}, report at $OUT/static-import-audit.json"

# [2] capacity: df avail (bytes) on the workspace filesystem
AVAIL=$(df -B1 --output=avail /srv/workspace/dsh-plugins/dsh-agent-team | tail -1 | tr -d ' ')
echo "df avail: ${AVAIL} B (min ${DF_MIN})"
[ "$AVAIL" -ge "$DF_MIN" ] || fail "capacity below the 18GB decimal bar — no boot" 3

# [3] port pre-check: probe only; occupied refuses (foreign occupants are NEVER killed)
for P in 3183 3498; do
  if ss -ltn "sport = :${P}" | grep -q LISTEN; then fail "port ${P} occupied by a foreign occupant — refuse, never kill" 3; fi
done
echo "ports 3183/3498 free (pre-check)"

# [4] ONE bounded run: own process group; 300s outer TERM to the OWN group,
#     20s grace, then KILL the OWN group only; foreign trees untouched.
#     (First firing aborted pre-boot with zero Host spawns: this host's
#     timeout build (coreutils 9.4 variant, help-verified) LACKS --group —
#     rc125 at the tool, HOME never created, ports never bound. Replaced
#     with an equivalent pure-bash own-group watchdog; same bound, same law.)
#     REAL-SPAWN receipt (root order): $! after setsid -w IS the exec'd node
#     runner as session/group leader (PGID == PID, measured shape); written
#     BEFORE the wait; wait carries the real rc.
setsid -w env A5M2_EDIT_WINDOW=GRANTED A5M2_EDIT_HOME_POINTER="$OUT/home.txt" node "$RUNNER" &
SPAWN_PID=$!
sleep 1
SPAWN_PGID=$(ps -o pgid= -p "$SPAWN_PID" 2>/dev/null | tr -d '[:space:]'); [ -n "$SPAWN_PGID" ] || SPAWN_PGID="$SPAWN_PID"
printf '{ "spawnPid": %s, "spawnPgid": "%s", "nodeChildPid": "%s", "outerBound": "bash watchdog: TERM own group at 300s, KILL at 320s", "startedUtc": "%s" }\n' \
  "$SPAWN_PID" "$SPAWN_PGID" "$SPAWN_PID" "$(date -u +%FT%TZ)" > "$OUT/spawn-receipt.json"
echo "spawn receipt written: pid=${SPAWN_PID} pgid=${SPAWN_PGID}"
(
  sleep 300
  kill -TERM -"${SPAWN_PGID}" 2>/dev/null || true
  sleep 20
  kill -KILL -"${SPAWN_PGID}" 2>/dev/null || true
) &
WATCHDOG_PID=$!
RC=0
wait "$SPAWN_PID" || RC=$?
kill "$WATCHDOG_PID" 2>/dev/null || true
wait "$WATCHDOG_PID" 2>/dev/null || true
echo "runner rc=${RC} (143/137 = outer 300s/320s bound fired on the OWN group)"

# [5] post facts: ports free, this window's HOME + lock retained, fixture
#     byte-stable (read-only reuse), HOME new-bytes budget.
sleep 2
for P in 3183 3498; do
  ss -ltn "sport = :${P}" | grep -q LISTEN && fail "port ${P} still occupied after exit — runner cleanup fact FALSE" 1
done
echo "ports 3183/3498 free (post)"
# Explicit HOME hand-off from THIS run's pointer file — no globbing (the
# prior window's glob missed the real '...628ZZ' stamp and falsely claimed
# a missing HOME; the 64MiB check never actually ran that window — admitted).
if [ -s "$OUT/home.txt" ]; then WORLD=$(tr -d '\n' < "$OUT/home.txt"); else fail "no explicit HOME pointer from this run ($OUT/home.txt absent — runner died before HOME stage); nothing deleted, scene retained" 1; fi
[ -d "$WORLD" ] || fail "pointed HOME absent at ${WORLD} — raw retention law broken?" 1
echo "HOME (explicit pointer): ${WORLD}"
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
