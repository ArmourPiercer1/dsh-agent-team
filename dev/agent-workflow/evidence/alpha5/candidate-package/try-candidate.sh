#!/usr/bin/env bash
# try-candidate.sh — candidate-package trial orchestrator (thin, auditable).
#
# WHAT IT RUNS (the three minimal trial chains, prepared but FULL RUN belongs
# to the final assembly with the final receipt — root 22:39Z order):
#   LEG A  team.create -> team_create_member -> team_list_members
#          -> team_delegate(instance) -> member team_bash positive -> team_collect
#   LEG B  globEnabled:false world: team_glob typed shut verbatim + no fallback
#   LEG C  out-of-bounds bash negative control (exit=1 + kernel refusal verbatim)
#   LEG P  (fastest, the pre-assembly smoke) boot the installed face only:
#          boot marker + 401/303 token gate + --dump-config composition.
#
# Modes:
#   ./try-candidate.sh --dry-run    syntax + wiring + plan only (no boot, no worlds)
#   ./try-candidate.sh --probe      fastest leg only (pre-assembly smoke)
#   ./try-candidate.sh --pin        PIN-TABLE receipt leg (3 reserved-name claims + control)
#   ./try-candidate.sh              ALL THREE LEGS — run at FINAL assembly only
#
# LAW: CANDIDATE_SHA must equal tests/homes/candidate-INSTALLED.json (recorded
# install). Worlds are tests/homes/candidate-<mode>-<stamp>, ports auto-picked
# from the 3180/349x families WITH free-probes (3080 never), teardown by exact
# names. Mock only at the LLM position; for a human trial swap the mock for a
# real provider by pointing staticModel at a real model (README).
set -euo pipefail
Toplevel="$(git rev-parse --show-toplevel 2>/dev/null || true)"
[ -n "$Toplevel" ] || { echo "FATAL: run from inside a dsh-agent-team checkout" >&2; exit 1; }
PKG_DIR="$Toplevel/dev/agent-workflow/evidence/alpha5/candidate-package"
BASE="${CANDIDATE_BASE:-$Toplevel/tests/homes}"
STATE="$BASE/candidate-INSTALLED.json"
MODE="full"
EXTRA=()
for a in "$@"; do
  case "$a" in
    --dry-run) MODE="dry" ;;
    --probe) MODE="probe" ;;
    --pin) MODE="pin" ;;
    --keep) EXTRA+=("--keep") ;;
    *) echo "FATAL: unknown arg: $a (allowed: --dry-run | --probe | --pin | --keep)" >&2; exit 1 ;;
  esac
done

# self syntax check (every time, cheap): bash -n on the package scripts,
# node --check on the drivers — a syntactically broken package never runs.
bash -n "$PKG_DIR/install-candidate.sh" "$PKG_DIR/rollback-candidate.sh" "$PKG_DIR/try-candidate.sh"
for f in try-candidate-kit.mjs face-check.mjs; do node --check "$PKG_DIR/$f"; done
echo "[try-candidate] syntax self-check OK (bash -n x3, node --check x2)"

[ -f "$STATE" ] || { echo "FATAL: no INSTALLED.json at $STATE — run: CANDIDATE_SHA=<full-sha> ./install-candidate.sh" >&2; exit 1; }
SHA="${CANDIDATE_SHA:-$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).sha)' "$STATE")}"
RECORDED="$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).sha)' "$STATE")"
[ "$SHA" = "$RECORDED" ] || { echo "FATAL: CANDIDATE_SHA=$SHA != installed sha $RECORDED — the trial never drifts from the recorded install" >&2; exit 1; }
STAMP="$(date -u +%Y-%m-%dT%H-%M-%SZ)"
EVIDENCE_DIR="${EVIDENCE_DIR:-$PKG_DIR/runs/trial-$STAMP}"
TEST_USE="${TEST_USE:-$Toplevel/tests/deepseek-harness-test-use}"
export CANDIDATE_SHA="$SHA"

RC=0
case "$MODE" in
  dry)
    node "$PKG_DIR/try-candidate-kit.mjs" --repo "$Toplevel" --sha "$SHA" --state "$STATE" \
      --legs=probe,pos,bash-b2,glob-off,pin-table --dry-run --testuse "$TEST_USE" --evidence-dir "$EVIDENCE_DIR" "${EXTRA[@]+"${EXTRA[@]}"}" || RC=$?
    ;;
  probe)
    node "$PKG_DIR/try-candidate-kit.mjs" --repo "$Toplevel" --sha "$SHA" --state "$STATE" \
      --legs=probe --testuse "$TEST_USE" --evidence-dir "$EVIDENCE_DIR" "${EXTRA[@]+"${EXTRA[@]}"}" || RC=$?
    ;;
  pin)
    echo "[try-candidate] PIN-TABLE RECEIPT — reserved-native impersonation claims + control rename."
    node "$PKG_DIR/try-candidate-kit.mjs" --repo "$Toplevel" --sha "$SHA" --state "$STATE" \
      --legs=pin-table --testuse "$TEST_USE" --evidence-dir "$EVIDENCE_DIR" "${EXTRA[@]+"${EXTRA[@]}"}" || RC=$?
    ;;
  full)
    echo "[try-candidate] FULL THREE-LEG CHAIN — this is the FINAL-ASSEMBLY receipt run."
    echo "[try-candidate] evidence → $EVIDENCE_DIR"
    node "$PKG_DIR/try-candidate-kit.mjs" --repo "$Toplevel" --sha "$SHA" --state "$STATE" \
      --legs=pos,bash-b2,glob-off --testuse "$TEST_USE" --evidence-dir "$EVIDENCE_DIR" "${EXTRA[@]+"${EXTRA[@]}"}" || RC=$?
    ;;
esac
echo "KIT_EXIT=$RC  (0=GREEN 2=RED 1=FATAL; per-leg receipts: $EVIDENCE_DIR/criteria.json)"
exit "$RC"
