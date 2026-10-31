#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────────────────────────────────
# PR-I1a METHOD-LAW harness (F-I1a3-6) — the harness that RAN the mutations whose transcripts are committed
# beside it, so the law can be reviewed instead of taken on trust from a transcript.
#
# The law, in the order it is enforced. Every step below moves the exit code; a check that cannot fail the
# run is not printed.
#
#   1  PIN REFUSAL    the target's sha256 must equal the pinned sha256 or NOTHING is touched (exit 88). A
#                     run therefore cannot inherit mutated bytes: mutated bytes do not hash to the pin. That
#                     is the verification of the previous run's restore, taken before this run may begin.
#   2  INTENDED FILE  the target must be one of the two kit files, and the pinned bytes are cross-checked
#                     against the same file at HEAD of the tree so the run knows what it is grading.
#   3  BYTES PRINTED  the declared old line and new line are printed; a whole-file line diff must show
#                     exactly that one line changed (`law.mjs verify`), and the census of delimiters,
#                     quotes, markers, lines and bytes must equal the value PREDICTED from the declaration
#                     (`law.mjs expected`) — never a value read back out of the mutated file.
#   4  STRUCTURE      `node --check` on the mutated bytes, and a NUL-byte scan.
#   5  LEG REDDENED   the kit must exit 1 and its verdict line must name the leg this mutation claims to
#                     falsify; --expect-regex additionally requires the stated REASON (a refusal line, a
#                     FIELD PATH, the mutated arm bytes) in the transcript. A mutation that exits green, or
#                     reddens some other leg, proves nothing and fails the run.
#   6  RESTORE        a trap restores the bytes on EVERY exit path — normal end, assertion failure, SIGINT,
#                     SIGTERM — and the restore is verified by sha256 == pin, byte `cmp` against the backup
#                     and `node --check`. No exit 0 without that verification.
#
# The incident this file exists to prevent: the round-17 fix session's first-generation harness exited on a
# mid-run assertion failure WITH THE MUTATION STILL APPLIED, and the next two kit runs inherited the
# contaminated bytes; the two run directories it produced are not cited as evidence. The reviewer's round-3
# harness independently fixed the same two things (pin refusal, trap restore). This committed copy keeps
# both, replaces the hand-computed delta with a whole-file rebuild check, and emits the
# MUTATION-METHOD-LAW.txt format the committed reds use, so transcripts and harness stay comparable.
#
# Usage
#   PRI1A_TREE=<worktree> PRI1A_SCRATCH=<dir> ./mutrun.sh <label> <target-rel> <pin-sha256> <mode> \
#       <declared-old-line> <declared-new-line> <expected-failed-leg> [--expect-regex RE] [--pre-diff D] \
#       -- <kit command and its args…>
#
#   <mode>  diff:<path>        apply a committed MUTATION.diff with `git apply`, after asserting its own
#                              -/+ lines are exactly the declared lines
#           edit:<script.mjs>  run a plant script (env PRI1A_TARGET=<abs target>, PRI1A_NEW_LINE=<line>)
#                              that writes bytes no diff can express: a comment line that shifts an arm off
#                              its anchor, a duplicated label, a mutation of an arm's INPUT with the arm
#                              left pristine. Pass the empty string as <declared-old-line> for a plant that
#                              only adds a line.
#   --expect-regex RE    (repeatable) the transcript MUST contain this: the stated reason the leg went red
#   --expect-absent RE   (repeatable) the transcript MUST NOT contain this — e.g. the comment line a
#                              drifting plant inserted, which must never be quoted as a graded arm
#   --pre-diff D         a committed MUTATION.diff to apply BEFORE the plant, graded on its own terms first
#                              (its bytes printed, its own one-line rebuild check, its own census)
#
# Exit codes  0 the law held end to end · 88 bytes are not the pinned ones, nothing touched ·
#             87 usage or a refused target · 86 an assertion failed (bytes restored and verified on the way
#             out) · 85 the failed leg, or the stated reason, is not what was declared ·
#             84 the restore could not be verified · 83 the kit stayed green under the mutation.
#
# Defaults: PRI1A_TREE = `git rev-parse --show-toplevel`;
#           PRI1A_SCRATCH = $TREE/.artifacts/pri1a-mutation-scratch (gitignored scratch, never evidence).
# ─────────────────────────────────────────────────────────────────────────────────────────────────────────
set -u

TREE=${PRI1A_TREE:-$(git rev-parse --show-toplevel 2>/dev/null || pwd)}
SCRATCH=${PRI1A_SCRATCH:-$TREE/.artifacts/pri1a-mutation-scratch}
HERE=$(cd "$(dirname "$0")" && pwd)
NL=$'\n'

if [ "$#" -lt 7 ]; then
  echo 'usage: mutrun.sh <label> <target-rel> <pin> <mode> <old-line> <new-line> <expect-leg> [--expect-regex RE] [--pre-diff D] -- <kit args…>' >&2
  exit 87
fi
LABEL=$1; RELFILE=$2; PIN=$3; MODE=$4; OLD_LINE=$5; NEW_LINE=$6; EXPECT_LEG=$7; shift 7
EXPECT_RE=''
EXPECT_ABSENT=''
PREDIFF=''
while [ "$#" -gt 0 ] && [ "$1" != '--' ]; do
  case $1 in
    --expect-regex) EXPECT_RE=${EXPECT_RE:+$EXPECT_RE$'\n'}${2:-}; shift 2 ;;
    --expect-absent) EXPECT_ABSENT=${EXPECT_ABSENT:+$EXPECT_ABSENT$'\n'}${2:-}; shift 2 ;;
    --pre-diff) PREDIFF=${2:-}; shift 2 ;;
    *) echo "unknown option: $1" >&2; exit 87 ;;
  esac
done
[ "${1:-}" = '--' ] && shift
if [ "$#" -lt 1 ]; then echo 'a kit command is required after --' >&2; exit 87; fi
KIT_CMD=("$@")

FILE="$TREE/$RELFILE"
mkdir -p "$SCRATCH/base"
BACKUP="$SCRATCH/base/$LABEL.$(basename "$RELFILE")"
STAGED="$SCRATCH/method-law-$LABEL.txt"
KIT_LOG="$SCRATCH/kit-$LABEL.log"
EVIDENCE="$TREE/dev/agent-workflow/evidence/alpha6-pri1a-real-host"
PLANTED=0
RESTORE_DONE=0
FAILED=0
RUN_DIR=''

sha_of() { sha256sum "$1" | cut -d' ' -f1; }
emit() { echo "$1" >> "$STAGED"; echo "$1"; }
fail() { FAILED=1; emit "ASSERT FAIL: $1"; exit 86; }

# The one restore path: normal end, assertion failure, or signal all arrive here.
finish() {
  local rc=$?
  trap - EXIT INT TERM
  if [ "$PLANTED" = '1' ] && [ "$RESTORE_DONE" = '0' ]; then
    emit '--- restore (exit path) ---'
    RESTORE_DONE=1
    if ! cp -f "$BACKUP" "$FILE"; then emit 'RESTORE FAILED: the backup could not be written back'; rc=84
    else
      local now; now=$(sha_of "$FILE")
      emit "restored from <scratch>/base/$(basename "$BACKUP"); sha256 now: $now"
      if [ "$now" != "$PIN" ]; then emit "RESTORE FAILED: sha256 $now != the pinned sha256"; rc=84
      elif ! cmp -s "$BACKUP" "$FILE"; then emit 'RESTORE FAILED: the restored bytes differ from the pre-mutation backup'; rc=84
      elif ! node --check "$FILE" >/dev/null 2>&1; then emit 'RESTORE FAILED: node --check on the restored bytes'; rc=84
      else
        emit 'cmp against the pre-mutation backup: identical bytes'
        emit 'node --check after restore: OK'
        emit 'restore verified inside the run, before the next mutation could inherit anything'
      fi
    fi
  fi
  if [ "$FAILED" = '1' ] || [ "$rc" -ne 0 ]; then emit "METHOD LAW VERDICT: fail (rc=$rc)"; else emit 'METHOD LAW VERDICT: pass'; fi
  if [ -n "$RUN_DIR" ] && [ -d "$EVIDENCE/$RUN_DIR" ]; then
    cp "$STAGED" "$EVIDENCE/$RUN_DIR/MUTATION-METHOD-LAW.txt"
    DIFF_SOURCE=''
    case "$MODE" in diff:*) DIFF_SOURCE=${MODE#diff:} ;; esac
    if [ -z "$DIFF_SOURCE" ] && [ -n "$PREDIFF" ]; then DIFF_SOURCE=$PREDIFF; fi
    if [ -n "$DIFF_SOURCE" ] && [ ! -e "$EVIDENCE/$RUN_DIR/MUTATION.diff" ]; then cp "$DIFF_SOURCE" "$EVIDENCE/$RUN_DIR/MUTATION.diff"; fi
    echo "MUTATION-METHOD-LAW.txt and MUTATION.diff written into $RUN_DIR"
  fi
  exit "$rc"
}
trap finish EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

: > "$STAGED"
: > "$KIT_LOG"

case "$RELFILE" in
  tests/kits/pr-i1a-real-host/pr-i1a-real-host.mjs|tests/kits/pr-i1a-real-host/pri1a-probe-row.mjs) : ;;
  *) FAILED=1; echo "REFUSE: $RELFILE is not one of the two kit files this harness may touch" >&2; exit 87 ;;
esac
[ -f "$FILE" ] || { FAILED=1; echo "REFUSE: $FILE does not exist under $TREE" >&2; exit 87; }

emit "=== METHOD LAW — $LABEL ==="
emit "target            : $RELFILE"
emit "arm (FROM)        : $(printf '%s' "$OLD_LINE" | sed 's/^[[:space:]]*//')"
emit "replaced by       : $(printf '%s' "$NEW_LINE" | sed 's/^[[:space:]]*//')"
if [ -z "$OLD_LINE" ]; then emit 'plant             : a pure insertion — one line added, nothing removed'; fi

# 1 ─ the pinned bytes, or nothing. This is also the check that no earlier run left its mutation applied.
BEFORE=$(sha_of "$FILE")
emit "sha256 before     : $BEFORE"
emit "pinned sha256     : $PIN"
if [ "$BEFORE" != "$PIN" ]; then
  FAILED=1
  emit 'REFUSE: the target does not hash to the pinned sha256 — touching nothing. Either the pin is stale'
  emit 'REFUSE: for these bytes, or an earlier run died with a mutation applied. Nothing may be graded until'
  emit 'REFUSE: the bytes hash to the pin; re-measure and re-pin them instead of editing this check.'
  exit 88
fi
emit 'pre-flight        : the target hashes to the pin, so the previous mutation restore is verified before this one begins'
COMMITTED=$(git -C "$TREE" show "HEAD:$RELFILE" 2>/dev/null | sha256sum | cut -d' ' -f1)
if [ -n "$COMMITTED" ] && [ "$COMMITTED" = "$BEFORE" ]; then
  emit 'intended file     : the same file at HEAD of this tree hashes to the same sha256 — the pinned bytes are the committed bytes'
else
  emit 'intended file     : the copy at HEAD of this tree hashes differently (this round has uncommitted work); the run grades the bytes that hash to the pin above'
fi

cp -f "$FILE" "$BACKUP" || fail "could not back up $FILE to $BACKUP"
PLANTED=1
BASE=$BACKUP                        # the bytes THIS edit is graded against; restore always returns $BACKUP

apply_graded_prediff() {            # $1=diff — a committed mutation the plant sits on top of, graded on its own terms
  local DIFF=$1
  local HUNKS MINUS PLUS DIFF_OLD DIFF_NEW PRED NOWC
  HUNKS=$(grep -c '^@@' "$DIFF")
  MINUS=$(grep -c '^-' "$DIFF")
  PLUS=$(grep -c '^+' "$DIFF")
  [ "$HUNKS" = '1' ] || fail "$DIFF is $HUNKS hunks, not one localized edit"
  [ "$((MINUS + PLUS))" = '4' ] || fail "$DIFF is not a one-line replacement ($MINUS removed / $PLUS added lines, headers included)"
  DIFF_OLD=$(grep '^-' "$DIFF" | sed -n '2p' | cut -c2-)
  DIFF_NEW=$(grep '^+' "$DIFF" | sed -n '2p' | cut -c2-)
  printf '%s\n' "$DIFF_OLD" > "$SCRATCH/prediff-old.txt"
  printf '%s\n' "$DIFF_NEW" > "$SCRATCH/prediff-new.txt"
  emit "planted: <$DIFF_OLD>"
  emit "planted: <$DIFF_NEW>"
  git -C "$TREE" apply --check "$DIFF" || fail "git apply --check on $DIFF"
  git -C "$TREE" apply "$DIFF" || fail "git apply of $DIFF"
  node "$HERE/law.mjs" verify "$BACKUP" "$FILE" "$DIFF_OLD" "$DIFF_NEW" >> "$STAGED" 2>&1 \
    || fail 'the whole-file rebuild check on the pre-diff (see the line above)'
  PRED=$(node "$HERE/law.mjs" expected "$BACKUP" "$SCRATCH/prediff-old.txt" "$SCRATCH/prediff-new.txt")
  NOWC=$(node "$HERE/law.mjs" counts "$FILE")
  [ "$NOWC" = "$PRED" ] || fail 'the pre-diff moved the census by something other than its own bytes'
  emit "pre-diff counts : $NOWC (predicted from its own -/+ lines: match)"
  emit 'pre-diff confirmed: one line replaced, exactly its own bytes, nothing else in the file moved'
}

if [ -n "$PREDIFF" ]; then
  emit '--- exact bytes planted by the pre-diff (a committed mutation this plant sits on top of) ---'
  apply_graded_prediff "$PREDIFF"
  BASE="$SCRATCH/baseline-$LABEL.$(basename "$RELFILE")"
  cp -f "$FILE" "$BASE" || fail 'could not snapshot the plant baseline'
  emit "plant baseline    : the plant below is graded against the bytes the pre-diff produced; the restore at the end still returns the pinned bytes"
fi

printf '%s\n' "$OLD_LINE" > "$SCRATCH/old-line-$LABEL.txt"
printf '%s\n' "$NEW_LINE" > "$SCRATCH/new-line-$LABEL.txt"
if [ -z "$OLD_LINE" ]; then OLD_ARG='-'; else OLD_ARG="$SCRATCH/old-line-$LABEL.txt"; fi
emit '--- exact bytes planted ---'
if [ -n "$OLD_LINE" ]; then emit "planted: <$OLD_LINE>"; fi
emit "planted: <$NEW_LINE>"

# 2/3/4 ─ plant, then confirm the mutation from the BYTES rather than from an exit code.
case "$MODE" in
  diff:*)
    DIFF=${MODE#diff:}
    [ -f "$DIFF" ] || { FAILED=1; emit "REFUSE: $DIFF does not exist"; exit 87; }
    DIFF_OLD=$(grep '^-' "$DIFF" | sed -n '2p' | cut -c2-)
    DIFF_NEW=$(grep '^+' "$DIFF" | sed -n '2p' | cut -c2-)
    [ "$DIFF_OLD" = "$OLD_LINE" ] || fail "the diff removes a different line than the declared one: <$DIFF_OLD>"
    [ "$DIFF_NEW" = "$NEW_LINE" ] || fail "the diff adds a different line than the declared one: <$DIFF_NEW>"
    git -C "$TREE" apply --check "$DIFF" || fail "git apply --check on $DIFF"
    git -C "$TREE" apply "$DIFF" || fail "git apply of $DIFF"
    ;;
  edit:*)
    SCRIPT=${MODE#edit:}
    [ -f "$SCRIPT" ] || { FAILED=1; emit "REFUSE: plant script $SCRIPT does not exist"; exit 87; }
    PRI1A_TARGET="$FILE" PRI1A_NEW_LINE="$NEW_LINE" node "$SCRIPT" >> "$STAGED" 2>&1 \
      || fail "the plant script exited nonzero — see the lines above (bytes restored on the way out)"
    ;;
  *) FAILED=1; emit 'REFUSE: mode must be diff:<path> or edit:<script.mjs>'; exit 87 ;;
esac

emit '--- structure assertions, run BEFORE the result is trusted ---'
COUNTS_BEFORE=$(node "$HERE/law.mjs" counts "$BASE")
COUNTS_AFTER=$(node "$HERE/law.mjs" counts "$FILE")
COUNTS_EXPECT=$(node "$HERE/law.mjs" expected "$BASE" "$OLD_ARG" "$SCRATCH/new-line-$LABEL.txt")
emit "counts before : $COUNTS_BEFORE"
emit "counts after  : $COUNTS_AFTER"
emit "expected after: $COUNTS_EXPECT"
[ "$COUNTS_AFTER" = "$COUNTS_EXPECT" ] || fail 'the census moved by something other than the declared bytes'
node "$HERE/law.mjs" verify "$BASE" "$FILE" "$OLD_LINE" "$NEW_LINE" >> "$STAGED" 2>&1 \
  || fail 'the whole-file rebuild check (see the line above)'
tail -2 "$STAGED"
node "$HERE/law.mjs" nul "$FILE" >> "$STAGED" 2>&1 || fail 'the NUL-byte scan'
tail -1 "$STAGED"
node --check "$FILE" || fail 'node --check on the mutated bytes — the structure no longer parses'
emit 'node --check on the mutated bytes: OK (the structure parses and it is the intended file)'
emit "sha256 mutated    : $(sha_of "$FILE")"
case "$MODE" in
  diff:*)
    emit '--- exact bytes changed (the committed diff, verbatim) ---'
    cat "$DIFF" >> "$STAGED"
    cp "$DIFF" "$SCRATCH/MUTATION-$LABEL.diff"
    ;;
esac

# 5 ─ the kit must redden the leg this mutation names, for the reason it states.
emit "--- running the kit on the mutated bytes (${KIT_CMD[*]}) ---"
( cd "$TREE" && "${KIT_CMD[@]}" ) > "$KIT_LOG" 2>&1
KIT_RC=$?
emit "kit exit code: $KIT_RC"
VERDICT=$(grep -E '^DSH-PRI1A-REALHOST(-SELFTEST)? verdict=' "$KIT_LOG" | tail -1)
[ -n "$VERDICT" ] || fail 'the kit printed no DSH-PRI1A-REALHOST verdict line at all'
emit "$VERDICT"
RUN_DIR=$(grep -oE 'alpha6-pri1a-real-host/a6pri1a-[^ /]+' "$KIT_LOG" | tail -1 | sed 's#.*/##')
if [ "$KIT_RC" = '0' ]; then
  FAILED=1
  emit 'MUTATION DID NOT REDDEN THE KIT — the leg this mutation claims to falsify stayed green, so this'
  emit 'MUTATION DID NOT REDDEN THE KIT — transcript is evidence of nothing. Fix the mutation, not the claim.'
  emit "run directory created by this run: ${RUN_DIR:-none}"
  exit 83
fi
[ "$KIT_RC" = '1' ] || fail "the kit exited $KIT_RC (1 is a graded red; any other code is an instrument fault)"
grep -qE "^DSH-PRI1A-REALHOST verdict=fail .* failed=$EXPECT_LEG\$" "$KIT_LOG" \
  || { FAILED=1; emit "the kit did not name $EXPECT_LEG as the failed leg — it said: $VERDICT"; exit 85; }
emit "named red leg as stated: $EXPECT_LEG"
if [ -n "$EXPECT_RE" ]; then
  while IFS= read -r RE; do
    [ -n "$RE" ] || continue
    grep -qE "$RE" "$KIT_LOG" || { FAILED=1; emit "the transcript does not carry the stated reason: $RE"; exit 85; }
    emit "stated reason present in the transcript: $RE"
    grep -E "$RE" "$KIT_LOG" | head -3 | sed 's/^/  /' >> "$STAGED"
  done <<< "$EXPECT_RE"
fi
if [ -n "$EXPECT_ABSENT" ]; then
  while IFS= read -r RE; do
    [ -n "$RE" ] || continue
    if grep -qE "$RE" "$KIT_LOG"; then
      FAILED=1
      emit "the transcript quotes bytes that must not be quoted: $RE"
      grep -E "$RE" "$KIT_LOG" | head -3 | sed 's/^/  /' >> "$STAGED"
      exit 85
    fi
    emit "stated absence holds — these bytes appear nowhere in the transcript: $RE"
  done <<< "$EXPECT_ABSENT"
fi
emit "run directory created by this run: ${RUN_DIR:-none}"
exit 0
