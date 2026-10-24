#!/usr/bin/env bash
# A5M2 G5 window B — the EXACT bounded execution wrapper (root B-slot dispatch,
# 2026-10-28). PREP ONLY: this file WRITES nothing outside its own $OUT dir and
# EXECUTES the runner only when root's A/B-no-conflict GO env is supplied.
# Without GO the runner itself fail-closes NOT_RUN rc3 (no HOME boot, no spawn
# beyond… — dry path A5M2_G5_DRY=1 stops at the boot boundary, ZERO Host
# spawns). One run = at most ONE boot, exactly TWO governed G5 calls
# (get_goal allow / get_goal deny). NO auto second window, NO ad-hoc install,
# NO chmod, NO candidate switching. Fixed pins (center 2fb delivery 2026-10-24T135732Z):
#   product  = 71f03119136c286aa2cd01aef6629ecd2906b8d3 (placement fix; changed-file
#              test-only diff, dist subtree identical)
#   tgz      = .worktrees/pack-int/out-71f03119-20261024T145829Z/dsh-agent-team-0.1.1-alpha.2.tgz
#              sha256 0c71c8f9d36e2207f79e5fc1f502792ce58bf7c290246f12d6f3cf6969967bab
#              (4,348,702 B / 1,866 entries; entries vs 2fb +/-0; changed-file blob
#               3d75d1a6d2c234cb798a87f5a36a53cb5fc61c7e = team-tool-plane.mjs, src=dist)
#   fixture  = .worktrees/pack-int/install-0c71c8f9 (READ-ONLY; lock
#              d68e374b7bb5e4468293e57416155dc63bc54594e232534eb55a949d242cf5b4;
#              pkg 56e7e1ccd86bc95a…; cold-import authority = product receipts
#              logs-71f03119-20261024T145829Z 19-cold-* + 20-cold-necessary RC=0 —
#              read-only, NEVER rerun here. Pre-boot gates are IDENTITY-ONLY: the
#              exact dist quartet blob hashes + lock/pkg pins + REAL blueprint
#              parse (root review ruling: the source-keyword supply gate was
#              COMMENT-ONLY matching and is REMOVED; live behavior at boot is the
#              sole supply authority))
#   host     = 639ed01539 checkout (tests/deepseek-harness-test-use) — REUSED,
#              never cloned/installed/copied for this window
#   HOME     = tests/homes/a5m2-g5-hw-b-<UTCts>Z  budget 64 MiB (new bytes, links==1)
#   ports    = BORROWED SLOT (root FINAL scheduling 2026-10-24, supersedes both
#              the 3185/3500 pair and the earlier A-borrow): G5 borrows the B
#              slot (A5M2_G5_SLOT default B -> 3184/3499); G6 borrows A. B-Control's
#              own batches take PRIORITY — this window queues AFTER them. The
#              borrow is EXCLUSIVE and only valid while the slot owner runs no
#              Host: pre-check ONLY, occupied => refuse rc3 (occupant NEVER
#              killed — report the collision to the scheduler). Four drivers may
#              PREPARE in parallel; the two slots stay strictly exclusive at run
#              time. 3080 stable, 3180/3181 durable NEVER touched. Fresh small
#              HOME per window allowed; NO new host copies/deps/durable worlds.
#   outer    = 300s hard watchdog on the OWN process group; df bar: root-ruling
#              temporary 6442450944 B (6 GiB), mirroring the A monitor (38b81fff)
set -euo pipefail

REPO_WT=/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5m2-wire-g5
RUNNER=dev/agent-workflow/evidence/a5m2-g5-host-window-b/scripts/05-g5-window-runner.mjs
TS=$(date -u +%Y%m%dT%H-%M-%SZ)
OUT=dev/agent-workflow/evidence/a5m2-g5-host-window-b/window-${TS}
DF_MIN=6442450944   # TEMPORARY: the root ruling shared from the A monitor (g3 38b81fff, root 09:31Z: 18e9 -> 6 GiB); the 18e9 decimal law returns when root says so
HOME_BUDGET=67108864   # 64 MiB, unique-dev:inode bytes in this HOME — enforced IN FLIGHT by the watchdog (root budget card), not only post-exit
SAMPLE_EVERY=10        # DISCLOSURE (root card): 10s sampling is a STOP-LOSS — writes between samples are unchecked, so the window can transiently exceed the 64 MiB line before the breach fires; it is NOT a hard quota and was never claimed as one. Exact accounting is the post-exit figure.
PIN_TGZ_SHA=0c71c8f9d36e2207f79e5fc1f502792ce58bf7c290246f12d6f3cf6969967bab
PIN_LOCK_SHA=d68e374b7bb5e4468293e57416155dc63bc54594e232534eb55a949d242cf5b4
PIN_PKG_SHA=56e7e1ccd86bc95a7a55f902bfee5683a00d5db721e5d7da15f88e67e960bf99
PIN_COMPOSED=71f03119136c286aa2cd01aef6629ecd2906b8d3

cd "$REPO_WT"
G5_SLOT=${A5M2_G5_SLOT:-B}   # root final scheduling: G5 = B slot (3184/3499); G6 holds A
case "$G5_SLOT" in
  A) G5_PORT_HOST=3183; G5_PORT_MOCK=3498 ;;
  B) G5_PORT_HOST=3184; G5_PORT_MOCK=3499 ;;
  *) echo "WRAPPER VERDICT: A5M2_G5_SLOT must be B (3184/3499, G5 default) or A (3183/3498) — an exclusive borrow of an IDLE slot serialized by the main scheduler; no third pair (rc 3)"; exit 3 ;;
esac
echo "borrowed slot: ${G5_SLOT} (host ${G5_PORT_HOST} / mock ${G5_PORT_MOCK}) — owner must run no Host; B-Control batches take priority, this window queues after"
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
[ "$FIX_PKG_BEFORE" = "$PIN_PKG_SHA" ] || fail "fixture pkg ${FIX_PKG_BEFORE} is NOT the pinned ${PIN_PKG_SHA}" 3
# the tgz behind the fixture pointer, verified at its real path
FIX_TARGET=$(python3 -c "import json;print(json.load(open('$A5M2_G5_INSTALL_DIR/package.json'))['dependencies']['dsh-agent-team'][5:])")
[ -f "$FIX_TARGET" ] || fail "fixture file: target absent: ${FIX_TARGET}" 3
FIX_TGZ_SHA=$(sha256sum "$FIX_TARGET" | cut -d' ' -f1)
[ "$FIX_TGZ_SHA" = "$PIN_TGZ_SHA" ] || fail "pack tgz sha ${FIX_TGZ_SHA} is NOT the pinned ${PIN_TGZ_SHA}" 3
echo "fixture before: lock=${FIX_LOCK_BEFORE:0:16}… pkg=${FIX_PKG_BEFORE:0:16}… tgz=${FIX_TGZ_SHA:0:16}… target=${FIX_TARGET}"

# [1.5] the OLD full-tree static audit is REMOVED (root order); the cold-import
#       authority is the product receipt (logs-71f03119-20261024T145829Z). The
#       runner's pre-boot gates are IDENTITY-ONLY (exact quartet hashes + lock/pkg
#       + REAL parse); the keyword "supply" gate was removed per root review —
#       comment-only needles proved nothing.

# [2] capacity
AVAIL=$(df -B1 --output=avail /srv/workspace/dsh-plugins/dsh-agent-team | tail -1 | tr -d ' ')
echo "df avail: ${AVAIL} B (min ${DF_MIN})"
[ "$AVAIL" -ge "$DF_MIN" ] || fail "capacity below the root-ruled bar ${DF_MIN} B — no boot" 3

# [3] port pre-check: probe only; occupied refuses (foreign occupants NEVER killed)
for P in "$G5_PORT_HOST" "$G5_PORT_MOCK"; do
  if ss -ltn "sport = :${P}" | grep -q LISTEN; then fail "port ${P} occupied by a foreign occupant — refuse, never kill" 3; fi
done
echo "borrowed slot ${G5_SLOT} ports ${G5_PORT_HOST}/${G5_PORT_MOCK} free (pre-check)"

# [4] ONE bounded run: own process group; 300s TERM to the OWN group, 20s
#     grace, then KILL the OWN group only. The GO env is forwarded ONLY if the
#     operator exported it (root's separate A/B-no-conflict GO); absent => the
#     runner itself prints NOT_RUN and exits rc3 (window not spent).
if [ "${A5M2_G5_DRY:-}" = "1" ]; then
  setsid -w env A5M2_G5_DRY=1 A5M2_G5_SLOT="$G5_SLOT" A5M2_G5_INSTALL_DIR="$A5M2_G5_INSTALL_DIR" A5M2_G5_PACK_SHA256="sha256:${PIN_TGZ_SHA}" A5M2_G5_COMPOSED_SHA="$PIN_COMPOSED" A5M2_G5_HOME_POINTER="$OUT/home.txt" node "$RUNNER" &
else
  [ "${A5M2_G5_WINDOW:-}" = "GRANTED" ] || fail "A5M2_G5_WINDOW is not GRANTED — root GO pending; NOT booting (dry path: A5M2_G5_DRY=1)" 3
  setsid -w env A5M2_G5_WINDOW=GRANTED A5M2_G5_SLOT="$G5_SLOT" A5M2_G5_INSTALL_DIR="$A5M2_G5_INSTALL_DIR" A5M2_G5_PACK_SHA256="sha256:${PIN_TGZ_SHA}" A5M2_G5_COMPOSED_SHA="$PIN_COMPOSED" A5M2_G5_HOME_POINTER="$OUT/home.txt" node "$RUNNER" &
fi
SPAWN_PID=$!
sleep 1
SPAWN_PGID=$(ps -o pgid= -p "$SPAWN_PID" 2>/dev/null | tr -d '[:space:]' || true); [ -n "$SPAWN_PGID" ] || SPAWN_PGID="$SPAWN_PID"  # '|| true': a FAST-exiting runner (dry) can die before this probe; under set -e a failed substitution would abort the wrapper mid-window (measured on the first dry pass)
printf '{ "spawnPid": %s, "spawnPgid": "%s", "outerBound": "bash watchdog: TERM own group at 300s, KILL at 320s", "dry": "%s", "startedUtc": "%s" }\n' \
  "$SPAWN_PID" "$SPAWN_PGID" "${A5M2_G5_DRY:-0}" "$(date -u +%FT%TZ)" > "$OUT/spawn-receipt.json"
echo "spawn receipt written: pid=${SPAWN_PID} pgid=${SPAWN_PGID}"
# ONE watchdog, three duties (root budget-enforcement card + watchdog-drain card):
#   (a) 300s outer bound -> TERM the OWN group;
#   (b) IN-FLIGHT sampling every ${SAMPLE_EVERY}s on the EXPLICIT HOME pointer
#       ($OUT/home.txt, no globbing): HOME bytes (unique dev:inode, no
#       symlink-deref) over the 64 MiB budget, or df below the ${DF_MIN} B bar, or a sampling error => abort the
#       OWN group immediately (the budget is a HARD in-flight stop, not a
#       post-mortem; a broken monitor is treated as a breach — fail closed);
#   (c) once ANY termination is issued, the drain MUST finish: poll the OWN
#       PGID until the group is empty or 20s elapse, then KILL the group.
#   (d) CANCELLATION IS A REQUEST, NEVER A KILL (root ruling 2026-10-24). The
#       old protocol let the parent test the marker and then kill the watchdog;
#       that left a race — the parent saw "no marker", the watchdog armed and
#       TERM'd, and the parent's kill deleted the supervisor mid-drain. Now the
#       parent only touches $OUT/watchdog-cancel and WAITS; the watchdog tests
#       that request itself, at the top of each tick and again immediately
#       before arming. UNARMED + requested => the watchdog exits on its own
#       (rc 0). ARMED => the request is ignored and the drain runs to
#       completion. Only the watchdog can end the watchdog. Nothing here touches
#       foreign processes, any other world, or :3080.
(
  BREACH=""
  REASON=""
  DEADLINE=$(( $(date +%s) + 300 ))
  while :; do
    # a cancel request is honored ONLY while unarmed — checked by the watchdog
    # itself, so there is no parent-side test-then-kill window left.
    if [ -e "$OUT/watchdog-cancel" ] && [ ! -e "$OUT/watchdog-armed" ]; then
      echo "watchdog: cancel request honored while UNARMED — exiting, no signal was ever sent"
      exit 0
    fi
    if [ -s "$OUT/home.txt" ]; then
      W=$(tr -d '\n' < "$OUT/home.txt" 2>/dev/null) || BREACH="home-pointer read failed"
      if [ -z "$BREACH" ] && [ -n "$W" ] && [ -d "$W" ]; then
        # BUDGET ACCOUNTING LAW (root final口径): walk THIS HOME only, never
        # following symlinks (find does not dereference by default) — read-only
        # shared dependency targets (node_modules etc.) are never pulled in;
        # every real file counts ONCE BY UNIQUE %D:%i — find's DEVICE number
        # (%d is tree depth, not the device; root ruling 2026-10-24) plus inode
        # (plain du-style, no
        # deref), so links>1 files this run creates are NOT silently dropped the
        # way an nlink==1 filter dropped them. Shared links stay read-only;
        # runtime writes are real files inside HOME.
        # '|| BREACH=' is load-bearing: under set -e + pipefail an UNGUARDED
        # sampler that fails would KILL this subshell — no breach, no TERM, and
        # the parent's 'wait || true' swallows the death (root reliability card).
        NB=$(find "$W" -xdev -type f -printf '%D:%i %s\n' 2>/dev/null | sort -u -k1,1 | awk '{t+=$2} END {printf "%.0f\n", t}') || BREACH="HOME byte sampling failed"
        case "$NB" in ''|*[!0-9]*) if [ -z "$BREACH" ]; then BREACH="HOME sample not decimal: '${NB}'"; fi ;; esac
        if [ -z "$BREACH" ] && [ "$NB" -gt "$HOME_BUDGET" ]; then BREACH="HOME bytes (unique inodes) ${NB} exceeded budget ${HOME_BUDGET} (in-flight hard stop)"; fi
      fi
    fi
    if [ -z "$BREACH" ]; then
      # SAME decimal sampler as the pre-check (df -B1 --output=avail, plain
      # decimal bytes — never an awk product fed to -lt); guarded so failure is
      # a RECORDED breach flowing the recorded OWN-PGID finalization.
      AV2=$(df -B1 --output=avail "$REPO_WT" 2>/dev/null | tail -1 | tr -d ' ') || BREACH="df sampling failed (monitor broken => fail closed)"
      case "$AV2" in ''|*[!0-9]*) if [ -z "$BREACH" ]; then BREACH="df sample not decimal: '${AV2}'"; fi ;; esac
      if [ -z "$BREACH" ] && [ "$AV2" -lt "$DF_MIN" ]; then BREACH="df avail ${AV2} B fell below the ${DF_MIN} B bar"; fi
    fi
    if [ -n "$BREACH" ]; then
      printf '{ "breachAt": "%s", "reason": "%s" }\n' "$(date -u +%FT%TZ)" "$BREACH" > "$OUT/budget-breach.json"
      echo "watchdog: BUDGET/CAPACITY BREACH — ${BREACH}; terminating OWN group"
      REASON="breach"
      break
    fi
    NOW=$(date +%s)
    if [ "$NOW" -ge "$DEADLINE" ]; then REASON="timeout-300s"; break; fi
    sleep "$SAMPLE_EVERY"
  done
  # ROOT RULINGS (fa56 + today): the ARMED marker is persisted BEFORE the first
  # TERM on both paths; the CANCEL is honored only where standing down is safe:
  #  - BREACH outranks cancel: capacity/budget exceeded means the OWN group must
  #    be stopped no matter what the parent asked.
  #  - timeout + pending cancel: the parent files the request only after the
  #    runner returned, so the bound is moot — the watchdog stands down with no
  #    signal ever sent (a late cancel arriving AFTER this test is simply void:
  #    armed means the drain finishes; that ordering is race-safe).
  if [ "$REASON" != breach ] && [ -e "$OUT/watchdog-cancel" ]; then
    echo "watchdog: cancel honored at the bound (reason=${REASON}) — standing down, no signal ever sent"
    exit 0
  fi
  touch "$OUT/watchdog-armed"
  kill -TERM -"${SPAWN_PGID}" 2>/dev/null || true
  DRAIN_END=$(( $(date +%s) + 20 ))
  while [ "$(date +%s)" -lt "$DRAIN_END" ]; do
    pgrep -g "${SPAWN_PGID}" >/dev/null 2>&1 || break
    sleep 1
  done
  if pgrep -g "${SPAWN_PGID}" >/dev/null 2>&1; then
    kill -KILL -"${SPAWN_PGID}" 2>/dev/null || true
    echo "watchdog: OWN group still present after the 20s drain — KILL sent (foreign processes untouched)"
  fi
) &
WATCHDOG_PID=$!
RC=0
wait "$SPAWN_PID" || RC=$?
# REQUEST the cancellation, then wait: no signal is ever sent to the supervisor.
# Unarmed => the watchdog sees the request on its next tick and exits by itself;
# armed => the request is ignored and the drain/KILL finishes before it returns.
touch "$OUT/watchdog-cancel"
WRC=0
wait "$WATCHDOG_PID" || WRC=$?
echo "watchdog exited rc=${WRC} (armed=$( [ -e "$OUT/watchdog-armed" ] && echo yes || echo no), cancel requested)"
if [ -e "$OUT/watchdog-armed" ] && [ "$WRC" -ne 0 ] && [ "$WRC" -ne 143 ]; then
  echo "WRAPPER VERDICT: the ARMED watchdog did not complete its drain (rc ${WRC}) — supervision failed, refusing to certify cleanup (rc 1)"; exit 1
fi
echo "runner rc=${RC} (143/137 = outer 300s bound or an in-flight budget/capacity breach fired on the OWN group)"

# [5] post facts
sleep 2
for P in "$G5_PORT_HOST" "$G5_PORT_MOCK"; do
  ss -ltn "sport = :${P}" | grep -q LISTEN && fail "port ${P} still occupied after exit — runner cleanup fact FALSE" 1
done
echo "borrowed slot ${G5_SLOT} ports ${G5_PORT_HOST}/${G5_PORT_MOCK} free (post)"
if [ -s "$OUT/home.txt" ]; then WORLD=$(tr -d '\n' < "$OUT/home.txt"); else fail "no explicit HOME pointer from this run ($OUT/home.txt absent); nothing deleted, scene retained" 1; fi
[ -d "$WORLD" ] || fail "pointed HOME absent at ${WORLD} — raw retention law broken?" 1
echo "HOME (explicit pointer): ${WORLD}"
[ -f "$WORLD/a5m2-g5-hw-lock.json" ] && echo "world lock retained: $WORLD"
NEWB=$(find "$WORLD" -xdev -type f -printf '%D:%i %s\n' 2>/dev/null | sort -u -k1,1 | awk '{t+=$2} END {printf "%.0f\n", t}') || NEWB="sampling-failed"
case "$NEWB" in ''|*[!0-9]*) fail "HOME byte accounting failed ('${NEWB}') — cannot certify the budget law" 1 ;; esac
echo "HOME bytes (unique dev:inode, no symlink-deref): ${NEWB} (budget ${HOME_BUDGET})"
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
  "dfAvailBytes": ${AVAIL}, "dfMin": ${DF_MIN}, "runnerRc": ${RC}, "dry": "${A5M2_G5_DRY:-0}",
  "borrowedSlot": "${G5_SLOT}", "slotPorts": [${G5_PORT_HOST}, ${G5_PORT_MOCK}],
  "fixturePkgShaPin": "${PIN_PKG_SHA}", "coldImportAuthority": "logs-71f03119-20261024T145829Z (19-cold-* + 20-cold-necessary RC=0; read-only)",
  "portsFreePost": true, "worldRetained": "${WORLD}", "homeNewBytes": ${NEWB},
  "homeBudget": ${HOME_BUDGET}
}
EOF

[ "$NEWB" -le "$HOME_BUDGET" ] || { echo "WRAPPER VERDICT: HOME budget breach (rc 1)"; exit 1; }
[ ! -e "$OUT/budget-breach.json" ] || { echo "WRAPPER VERDICT: in-flight budget/capacity BREACH recorded — window FAILED (see $OUT/budget-breach.json)"; exit 1; }
if [ "${A5M2_G5_DRY:-}" = "1" ]; then
  # ROOT ORDER: DRY is NOT_RUN (rc3), never a business PASS. rc3 = the pre-proof did
  # its job; rc0 from a dry runner would be the runner MISREPORTING a PASS => fail.
  [ "$RC" -eq 3 ] || { echo "WRAPPER VERDICT: dry path exited rc=${RC}, expected NOT_RUN rc3 — runner law broken, treat as FAILURE"; exit 1; }
  echo "WRAPPER VERDICT: NOT_RUN (dry pre-proof rc3: pins/identity/validator/patch to the boot boundary; NO boot, NO business claim) — raw + HOME retained at ${OUT} and ${WORLD}"
  exit 3
fi
[ "$RC" -eq 0 ] || { echo "WRAPPER VERDICT: runner non-zero rc=${RC} — STOP (no second window without a fresh root order)"; exit "$RC"; }
echo "WRAPPER VERDICT: OK — raw + HOME retained at ${OUT} and ${WORLD}"
