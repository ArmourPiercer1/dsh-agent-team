#!/usr/bin/env bash
# usage: run-universe.sh <label>
# Re-derivation of the 7.3-decision universe predicate on THIS tree. Same predicate as
# dev/agent-workflow/evidence/a4-pr7/7-3-decision/scripts/run-universe.sh (verbatim), so
# the population is comparable to the dossier's 52 files / 777 tests.
# Vitest's exit code is captured into a variable before any pipe consumes it.
set -u
cd "$(git rev-parse --show-toplevel)"
LABEL="$1"
EV=dev/agent-workflow/evidence/a4-pr7/7-3-relax
rm -rf packages/testkit/test/.tmp-fault
grep -rl "teamRequirements\|V2_DOCUMENT_VERSION\|schemaVersion: 2" packages --include=*.test.ts \
  | grep -v node_modules | grep -v /dist/ | grep -v __probe | sort > "$EV/transcripts/UNIVERSE-$LABEL-files.txt"
FILES=$(tr '\n' ' ' < "$EV/transcripts/UNIVERSE-$LABEL-files.txt")
pnpm exec vitest run $FILES > "$EV/transcripts/RUN-$LABEL-raw.txt" 2>&1
VEXIT=$?
echo "vitest_exit=$VEXIT" >> "$EV/transcripts/RUN-$LABEL-raw.txt"
grep -E "^ *× " "$EV/transcripts/RUN-$LABEL-raw.txt" \
  | sed -E 's/^ *× //; s/ [0-9]+ms$//' | sort -u > "$EV/transcripts/RUN-$LABEL-failing.txt"
echo "universe_files=$(wc -l < "$EV/transcripts/UNIVERSE-$LABEL-files.txt") failing_titles=$(wc -l < "$EV/transcripts/RUN-$LABEL-failing.txt")"
