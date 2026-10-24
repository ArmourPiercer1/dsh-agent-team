#!/usr/bin/env bash
# A5M2 CONTROL window — the EXACT bounded execution wrapper: A's proven outer
# supervisor (a5m2-wire-g3 06-run-window.sh) reused LOCAL-PARAMETER-EXACT,
# re-pointed ONLY at 3184/3499 + the B driver (root 2026-10-24: no new
# framework, no product change, no new audit gates). The wrapper adds NO GO:
# boot requires the CALLER's env A5M2_CONTROL_WINDOW=GRANTED (root's window
# GO) — absent, the runner itself fail-closes rc3 NOT_RUN.
#   driver   = 86d0e00c7094d2a12ce5a0264db6ebe96f682789 (root's B86d0 narrow
#              review signed this surface; later commits may only add
#              wrapper/evidence, never touch the runner logic — same law as A)
#   product  = 4a26ac9a904dc6ad1cef56b8b1c096ab88e131de pack (pins live in
#              the runner; INSTALL_DIR via env or the runner's pinned default
#              install-0d166410)
#   host     = 639ed01539 checkout (tests/deepseek-harness-test-use)
#   HOME     = tests/homes/a5m2-ctl-hw-<UTC>Z  budget 64 MiB (new bytes, links==1)
#   ports    = 3184 host + 3499 mock; PRE-CHECK ONLY, occupied => refuse (NEVER kill foreign)
#   outer    = setsid own group; 300s hard TERM to the OWN PGID + 20s KILL
#              grace (A's proven pure-bash watchdog — this host's timeout
#              build lacks --group, proven in A's windows); NOT per-stage
#              local timeouts; df avail >= 6 GiB (A's carried bar)
set -euo pipefail

REPO_WT=/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5m2-wire-g1
RUNNER=dev/agent-workflow/evidence/a5m2-control-host-window/scripts/05-control-window-runner.mjs
DRIVER_SHA=86d0e00c7094d2a12ce5a0264db6ebe96f682789
TS=$(date -u +%Y%m%dT%H-%M-%SZ)
OUT=dev/agent-workflow/evidence/a5m2-control-host-window/window-${TS}
DF_MIN=6442450944   # A's carried bar: 6 GiB
HOME_BUDGET=67108864   # 64 MiB of NEW bytes (nlink==1), fourth-window law

cd "$REPO_WT"
mkdir -p "$OUT"
exec > >(tee -a "$OUT/wrapper.log") 2>&1
echo "control window wrapper ${TS} driver=${DRIVER_SHA}"

fail() { echo "WRAPPER VERDICT: $1 (rc $2)"; exit "$2"; }

# [0] driver law: HEAD carries the signed driver commit; runner sha recorded.
HEAD_SHA=$(git rev-parse HEAD)
git merge-base --is-ancestor "$DRIVER_SHA" "$HEAD_SHA" || fail "HEAD ${HEAD_SHA} does not carry the driver pin ${DRIVER_SHA} (no candidate switching)" 3
RUNNER_NOW=$(sha256sum "$RUNNER" | cut -d' ' -f1)
if [ -n "${A5M2_CONTROL_RUNNER_SHA256:-}" ]; then [ "$A5M2_CONTROL_RUNNER_SHA256" = "$RUNNER_NOW" ] || fail "runner sha256 ${RUNNER_NOW} differs from the cross-checked ${A5M2_CONTROL_RUNNER_SHA256}" 3; fi
echo "driver law: HEAD carries ${DRIVER_SHA}; runner file sha256 ${RUNNER_NOW}"

# [1] fixture present (f86 receipt product; read-only reuse; NEVER installed here)
: "${A5M2_CONTROL_INSTALL_DIR:=/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/pack-int/install-0d166410}"
[ -d "$A5M2_CONTROL_INSTALL_DIR" ] || fail "fixture absent at ${A5M2_CONTROL_INSTALL_DIR} — NOT booting, NOT installing" 3
FIX_LOCK_BEFORE=$(sha256sum "$A5M2_CONTROL_INSTALL_DIR/pnpm-lock.yaml" | cut -d' ' -f1) || fail "fixture pnpm-lock unreadable" 3
FIX_PKG_BEFORE=$(sha256sum "$A5M2_CONTROL_INSTALL_DIR/package.json" | cut -d' ' -f1) || fail "fixture package.json unreadable" 3
echo "fixture before: lock=${FIX_LOCK_BEFORE:0:16}… pkg=${FIX_PKG_BEFORE:0:16}…"

# [2] capacity bar (A verbatim)
AVAIL=$(df -B1 --output=avail /srv/workspace/dsh-plugins/dsh-agent-team | tail -1 | tr -d ' ')
echo "df avail: ${AVAIL} B (min ${DF_MIN})"
[ "$AVAIL" -ge "$DF_MIN" ] || fail "capacity below the 6 GiB bar — no boot" 3

# [3] port pre-check: probe only; occupied refuses (foreign occupants NEVER killed)
for P in 3184 3499; do
  if ss -ltn "sport = :${P}" | grep -q LISTEN; then fail "port ${P} occupied by a foreign occupant — refuse, never kill" 3; fi
done
echo "ports 3184/3499 free (pre-check)"

# [4] ONE bounded run: OWN process group (setsid -w; $! IS the exec'd node
#     runner as session/group leader — A's measured real-spawn shape);
#     300s outer TERM to the OWN group, 20s grace, then KILL the OWN group
#     ONLY. GO arrives ONLY via the caller env — the wrapper NEVER fabricates
#     GRANTED; the runner fail-closes rc3 NOT_RUN without it (no HOME, no bind).
setsid -w env A5M2_CONTROL_HOME_POINTER="$OUT/home.txt" A5M2_CONTROL_INSTALL_DIR="$A5M2_CONTROL_INSTALL_DIR" node "$RUNNER" &
SPAWN_PID=$!
sleep 1
SPAWN_PGID=$(ps -o pgid= -p "$SPAWN_PID" 2>/dev/null | tr -d '[:space:]'); [ -n "$SPAWN_PGID" ] || SPAWN_PGID="$SPAWN_PID"
printf '{ "spawnPid": %s, "spawnPgid": "%s", "outerBound": "bash watchdog: TERM own group at 300s, KILL at 320s", "goGranted": %s, "startedUtc": "%s" }\n' \
  "$SPAWN_PID" "$SPAWN_PGID" "$([ "${A5M2_CONTROL_WINDOW:-}" = "GRANTED" ] && echo true || echo false)" "$(date -u +%FT%TZ)" > "$OUT/spawn-receipt.json"
echo "spawn receipt written: pid=${SPAWN_PID} pgid=${SPAWN_PGID} granted=$([ "${A5M2_CONTROL_WINDOW:-}" = "GRANTED" ] && echo true || echo false)"
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

# [5] post facts: ports free, explicit-HOME-pointer budget, fixture byte-stable
sleep 2
for P in 3184 3499; do
  ss -ltn "sport = :${P}" | grep -q LISTEN && fail "port ${P} still occupied after exit — runner cleanup fact FALSE" 1
done
echo "ports 3184/3499 free (post)"
if [ -s "$OUT/home.txt" ]; then WORLD=$(tr -d '\n' < "$OUT/home.txt"); else WORLD=""; echo "NOTE: no HOME pointer — runner died before the HOME stage (pre-boot fail-closes legitimately have no HOME)"; fi
NEWB=0
if [ -n "$WORLD" ]; then
  [ -d "$WORLD" ] || fail "pointed HOME absent at ${WORLD} — raw retention law broken?" 1
  echo "HOME (explicit pointer): ${WORLD}"
  [ -f "$WORLD/a5m2-ctl-hw-lock.json" ] && echo "world lock retained: $WORLD"
  NEWB=$(find "$WORLD" -type f -links 1 -printf '%s\n' 2>/dev/null | awk '{t+=$1} END {print t+0}')
fi
echo "HOME new bytes (nlink==1): ${NEWB} (budget ${HOME_BUDGET})"
FIX_LOCK_AFTER=$(sha256sum "$A5M2_CONTROL_INSTALL_DIR/pnpm-lock.yaml" | cut -d' ' -f1)
FIX_PKG_AFTER=$(sha256sum "$A5M2_CONTROL_INSTALL_DIR/package.json" | cut -d' ' -f1)
{ [ "$FIX_LOCK_BEFORE" = "$FIX_LOCK_AFTER" ] && [ "$FIX_PKG_BEFORE" = "$FIX_PKG_AFTER" ]; } \
  || fail "fixture CHANGED during the window — read-only reuse violated (before lock=${FIX_LOCK_BEFORE} pkg=${FIX_PKG_BEFORE}; after lock=${FIX_LOCK_AFTER} pkg=${FIX_PKG_AFTER})" 1
echo "fixture byte-stable across the window (lock/pkg hashes equal)"

cat > "$OUT/external-receipt.json" <<EOF
{
  "stamp": "${TS}", "driverSha": "${DRIVER_SHA}", "headAtRun": "${HEAD_SHA}",
  "runnerFileSha256": "${RUNNER_NOW}",
  "installDir": "${A5M2_CONTROL_INSTALL_DIR}",
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
