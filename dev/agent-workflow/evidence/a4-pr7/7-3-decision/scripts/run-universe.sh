#!/usr/bin/env bash
# usage: run-universe.sh <label> [extra vitest args...]
# Runs the blueprint-affected universe and writes:
#   transcripts/RUN-<label>-raw.txt        (full output)
#   transcripts/RUN-<label>-failing.txt    (sorted "file > test" identities)
# Exit code of vitest is echoed as `vitest_exit=` (never lost to a pipe).
set -u
cd "$(git rev-parse --show-toplevel)"
LABEL="$1"; shift
EV=dev/agent-workflow/evidence/a4-pr7/7-3-decision
rm -rf packages/testkit/test/.tmp-fault
FILES=$(grep -rl "teamRequirements\|V2_DOCUMENT_VERSION\|schemaVersion: 2" packages --include=*.test.ts \
  | grep -v node_modules | grep -v /dist/ | grep -v __probe | sort | tr '\n' ' ')
pnpm exec vitest run $FILES "$@" > "$EV/transcripts/RUN-$LABEL-raw.txt" 2>&1
VEXIT=$?
echo "vitest_exit=$VEXIT" >> "$EV/transcripts/RUN-$LABEL-raw.txt"
grep -E "^ *× " "$EV/transcripts/RUN-$LABEL-raw.txt" \
  | sed -E 's/^ *× //; s/ [0-9]+ms$//' | sort -u > "$EV/transcripts/RUN-$LABEL-failing.txt"
grep -E "Test Files|Tests +[0-9]" "$EV/transcripts/RUN-$LABEL-raw.txt" | tail -2
echo "failing_titles=$(wc -l < "$EV/transcripts/RUN-$LABEL-failing.txt")  log=$EV/transcripts/RUN-$LABEL-raw.txt"
