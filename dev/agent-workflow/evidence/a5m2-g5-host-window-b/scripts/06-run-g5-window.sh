#!/usr/bin/env bash
# A5M2 G5 window B — the EXACT bounded execution wrapper (root B-slot dispatch,
# 2026-10-28). PREP ONLY: this file WRITES nothing outside its own $OUT dir and
# EXECUTES the runner only when root's A/B-no-conflict GO env is supplied.
# Without GO the runner itself fail-closes NOT_RUN rc3 (no HOME boot, no spawn
# beyond… — dry path A5M2_G5_DRY=1 stops at the boot boundary, ZERO Host
# spawns). One run = at most ONE boot, exactly TWO governed G5 calls
# (get_goal allow / get_goal deny). NO auto second window, NO ad-hoc install,
# NO chmod, NO candidate switching. Fixed pins (root B-slot dispatch):
#   product  = 37646ac288dbd0ee3c998343dc91fd1a8da7a2d5
#   tgz      = .worktrees/pack-int/out-37646ac2-20261024T085726Z/dsh-agent-team-0.1.1-alpha.2.tgz
#              sha256 3652b2ce19025d0d25d8b661fc08f0a3cb0737bb7b4fbc339fd61a12e2b5fd7c
#   fixture  = .worktrees/pack-int/install-0a3f11b2 (READ-ONLY; lock
#              7685317ff1ba675f6d3f6b012907360579c3c85bd1bc3319d0248483bde3c659;
#              cold-import 0 across the real 8 entries — logs-37646ac2-20261024T085726Z)
#   host     = 639ed01539 checkout (tests/deepseek-harness-test-use) — REUSED,
#              never cloned/installed/copied for this window
#   HOME     = tests/homes/a5m2-g5-hw-b-<UTCts>Z  budget 64 MiB (new bytes, links==1)
#   ports    = 3184 host + 3499 mock (A owns 3183/3498; 3080 stable, 3180/3181
#              durable NEVER touched); PRE-CHECK ONLY, occupied => refuse (never kill)
#   outer    = 300s hard watchdog on the OWN process group; df bar: root-ruling
#              temporary 6442450944 B (6 GiB), mirroring the A monitor (38b81fff)
set -euo pipefail

REPO_WT=/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5m2-wire-g5
RUNNER=dev/agent-workflow/evidence/a5m2-g5-host-window-b/scripts/05-g5-window-runner.mjs
AUDIT=dev/agent-workflow/evidence/a5m2-g5-host-window-b/scripts/07-static-import-audit.mjs
TS=$(date -u +%Y%m%dT%H-%M-%SZ)
OUT=dev/agent-workflow/evidence/a5m2-g5-host-window-b/window-${TS}
DF_MIN=6442450944   # TEMPORARY: the root ruling shared from the A monitor (g3 38b81fff, root 09:31Z: 18e9 -> 6 GiB); the 18e9 decimal law returns when root says so
HOME_BUDGET=67108864   # 64 MiB of NEW bytes (nlink==1)
PIN_TGZ_SHA=3652b2ce19025d0d25d8b661fc08f0a3cb0737bb7b4fbc339fd61a12e2b5fd7c
PIN_LOCK_SHA=7685317ff1ba675f6d3f6b012907360579c3c85bd1bc3319d0248483bde3c659
PIN_COMPOSED=37646ac288dbd0ee3c998343dc91fd1a8da7a2d5

cd "$REPO_WT"
mkdir -p "$OUT"
exec > >(tee -a "$OUT/wrapper.log") 2>&1
echo "g5 window B wrapper ${TS}"

fail() { echo "WRAPPER VERDICT: $1 (rc $2)"; exit "$2"; }

# [0] driver law: HEAD must carry this lane's prep commit and the runner file
#     must be byte-identical to the receipt-pinned sha256 (when provided).
HEAD_SHA=$(git rev-parse HEAD)
RUNNER_NOW=$(sha256sum "$RUNNER" | cut -d' ' -f1)
echo "driver: runner file sha256 ${RUNNER_NOW} @ HEAD ${HEAD_SHA}"
if [ -n "${A5M2_G5_RUNNER_SHA256:-}" ]; then [ "$A5M2_G5_RUNNER_SHA256" = "$RUNNER_NOW" ] || fail "runner sha256 ${RUNNER_NOW} differs from the cross-checked ${A5M2_G5_RUNNER_SHA256}" 3; fi

# [1] the pinned fixture is REQUIRED, READ-ONLY input (never built here)
: "${A5M2_G5_INSTALL_DIR:?A5M2_G5_INSTALL_DIR must be the pinned fixture path}"
[ -d "$A5M2_G5_INSTALL_DIR" ] || fail "pinned fixture absent at ${A5M2_G5_INSTALL_DIR} — NOT booting, NOT installing" 3
FIX_LOCK_BEFORE=$(sha256sum "$A5M2_G5_INSTALL_DIR/pnpm-lock.yaml" | cut -d' ' -f1) || fail "fixture pnpm-lock unreadable" 3
FIX_PKG_BEFORE=$(sha256sum "$A5M2_G5_INSTALL_DIR/package.json" | cut -d' ' -f1) || fail "fixture package.json unreadable" 3
[ "$FIX_LOCK_BEFORE" = "$PIN_LOCK_SHA" ] || fail "fixture lock ${FIX_LOCK_BEFORE} is NOT the pinned ${PIN_LOCK_SHA}" 3
# the tgz behind the fixture pointer, verified at its real path
FIX_TARGET=$(python3 -c "import json;print(json.load(open('$A5M2_G5_INSTALL_DIR/package.json'))['dependencies']['dsh-agent-team'][5:])")
[ -f "$FIX_TARGET" ] || fail "fixture file: target absent: ${FIX_TARGET}" 3
FIX_TGZ_SHA=$(sha256sum "$FIX_TARGET" | cut -d' ' -f1)
[ "$FIX_TGZ_SHA" = "$PIN_TGZ_SHA" ] || fail "pack tgz sha ${FIX_TGZ_SHA} is NOT the pinned ${PIN_TGZ_SHA}" 3
echo "fixture before: lock=${FIX_LOCK_BEFORE:0:16}… pkg=${FIX_PKG_BEFORE:0:16}… tgz=${FIX_TGZ_SHA:0:16}… target=${FIX_TARGET}"

# [1.5] static-import placement audit (pure read, zero import, zero spawn;
#       INFORMATIONAL — the real gate is the fixture's cold-import 0 receipt)
AUDIT_RC=0
node "$AUDIT" "$A5M2_G5_INSTALL_DIR/node_modules/dsh-agent-team" > "$OUT/static-import-audit.json" 2>&1 || AUDIT_RC=$?
echo "static-import audit: rc=${AUDIT_RC}, report at $OUT/static-import-audit.json"

# [2] capacity
AVAIL=$(df -B1 --output=avail /srv/workspace/dsh-plugins/dsh-agent-team | tail -1 | tr -d ' ')
echo "df avail: ${AVAIL} B (min ${DF_MIN})"
[ "$AVAIL" -ge "$DF_MIN" ] || fail "capacity below the 18GB decimal bar — no boot" 3

# [3] port pre-check: probe only; occupied refuses (foreign occupants NEVER killed)
for P in 3184 3499; do
  if ss -ltn "sport = :${P}" | grep -q LISTEN; then fail "port ${P} occupied by a foreign occupant — refuse, never kill" 3; fi
done
echo "ports 3184/3499 free (pre-check)"

# [4] ONE bounded run: own process group; 300s TERM to the OWN group, 20s
#     grace, then KILL the OWN group only. The GO env is forwarded ONLY if the
#     operator exported it (root's separate A/B-no-conflict GO); absent => the
#     runner itself prints NOT_RUN and exits rc3 (window not spent).
if [ "${A5M2_G5_DRY:-}" = "1" ]; then
  setsid -w env A5M2_G5_DRY=1 A5M2_G5_INSTALL_DIR="$A5M2_G5_INSTALL_DIR" A5M2_G5_PACK_SHA256="sha256:${PIN_TGZ_SHA}" A5M2_G5_COMPOSED_SHA="$PIN_COMPOSED" A5M2_G5_HOME_POINTER="$OUT/home.txt" node "$RUNNER" &
else
  [ "${A5M2_G5_WINDOW:-}" = "GRANTED" ] || fail "A5M2_G5_WINDOW is not GRANTED — root GO pending; NOT booting (dry path: A5M2_G5_DRY=1)" 3
  setsid -w env A5M2_G5_WINDOW=GRANTED A5M2_G5_INSTALL_DIR="$A5M2_G5_INSTALL_DIR" A5M2_G5_PACK_SHA256="sha256:${PIN_TGZ_SHA}" A5M2_G5_COMPOSED_SHA="$PIN_COMPOSED" A5M2_G5_HOME_POINTER="$OUT/home.txt" node "$RUNNER" &
fi
SPAWN_PID=$!
sleep 1
SPAWN_PGID=$(ps -o pgid= -p "$SPAWN_PID" 2>/dev/null | tr -d '[:space:]' || true); [ -n "$SPAWN_PGID" ] || SPAWN_PGID="$SPAWN_PID"  # '|| true': a FAST-exiting runner (dry) can die before this probe; under set -e a failed substitution would abort the wrapper mid-window (measured on the first dry pass)
printf '{ "spawnPid": %s, "spawnPgid": "%s", "outerBound": "bash watchdog: TERM own group at 300s, KILL at 320s", "dry": "%s", "startedUtc": "%s" }\n' \
  "$SPAWN_PID" "$SPAWN_PGID" "${A5M2_G5_DRY:-0}" "$(date -u +%FT%TZ)" > "$OUT/spawn-receipt.json"
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

# [5] post facts
sleep 2
for P in 3184 3499; do
  ss -ltn "sport = :${P}" | grep -q LISTEN && fail "port ${P} still occupied after exit — runner cleanup fact FALSE" 1
done
echo "ports 3184/3499 free (post)"
if [ -s "$OUT/home.txt" ]; then WORLD=$(tr -d '\n' < "$OUT/home.txt"); else fail "no explicit HOME pointer from this run ($OUT/home.txt absent); nothing deleted, scene retained" 1; fi
[ -d "$WORLD" ] || fail "pointed HOME absent at ${WORLD} — raw retention law broken?" 1
echo "HOME (explicit pointer): ${WORLD}"
[ -f "$WORLD/a5m2-g5-hw-lock.json" ] && echo "world lock retained: $WORLD"
NEWB=$(find "$WORLD" -type f -links 1 -printf '%s\n' 2>/dev/null | awk '{t+=$1} END {print t+0}')
echo "HOME new bytes (nlink==1): ${NEWB} (budget ${HOME_BUDGET})"
FIX_LOCK_AFTER=$(sha256sum "$A5M2_G5_INSTALL_DIR/pnpm-lock.yaml" | cut -d' ' -f1)
FIX_PKG_AFTER=$(sha256sum "$A5M2_G5_INSTALL_DIR/package.json" | cut -d' ' -f1)
{ [ "$FIX_LOCK_BEFORE" = "$FIX_LOCK_AFTER" ] && [ "$FIX_PKG_BEFORE" = "$FIX_PKG_AFTER" ]; } \
  || fail "fixture CHANGED during the window — read-only reuse violated" 1
echo "fixture byte-stable across the window (lock/pkg hashes equal)"

cat > "$OUT/external-receipt.json" <<EOF
{
  "stamp": "${TS}", "runnerSha256": "${RUNNER_NOW}", "headAtRun": "${HEAD_SHA}",
  "composedSha": "${PIN_COMPOSED}", "installDir": "${A5M2_G5_INSTALL_DIR}",
  "packTgzSha256": "${FIX_TGZ_SHA}", "packTgzPath": "${FIX_TARGET}",
  "fixtureLockSha256Before": "${FIX_LOCK_BEFORE}", "fixtureLockSha256After": "${FIX_LOCK_AFTER}",
  "fixturePkgSha256Before": "${FIX_PKG_BEFORE}", "fixturePkgSha256After": "${FIX_PKG_AFTER}",
  "dfAvailBytes": ${AVAIL}, "runnerRc": ${RC}, "dry": "${A5M2_G5_DRY:-0}",
  "portsFreePost": true, "worldRetained": "${WORLD}", "homeNewBytes": ${NEWB},
  "homeBudget": ${HOME_BUDGET}
}
EOF

[ "$NEWB" -le "$HOME_BUDGET" ] || { echo "WRAPPER VERDICT: HOME budget breach (rc 1)"; exit 1; }
[ "$RC" -eq 0 ] || { echo "WRAPPER VERDICT: runner non-zero rc=${RC} — STOP (no second window without a fresh root order)"; exit "$RC"; }
echo "WRAPPER VERDICT: OK — raw + HOME retained at ${OUT} and ${WORLD}"
