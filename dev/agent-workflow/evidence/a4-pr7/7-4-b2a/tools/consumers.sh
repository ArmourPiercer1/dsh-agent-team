#!/bin/bash
# Consumer runs for the five promoted fixture modules.
#
# Usage: consumers.sh <label> [<file-list>...]
#   <label>        output subdir under transcripts/consumers-<label>/
#   no file lists  -> run every distinct consumer file (transcripts/…/consumers/distinct.txt)
#
# THE SCRATCH CLEAN IS NOT OPTIONAL. scratchDir() is
# packages/testkit/test/.tmp-fault/<basename> (packages/testkit/fault-injection/file-seam.mjs)
# and is SHARED across suites, so a leftover from the previous suite surfaces as
# "team_domain already exists (schema_meta holds N stamp row(s))" in the next run. A
# committed base run of this lane once reported 79f|197p / 117f|38p / 65f|40p with 116, 79
# and 92 of those errors: an artifact, not a measurement. Removed before every run AND after.
set -u
label="$1"; shift
E=dev/agent-workflow/evidence/a4-pr7/7-4-b2a
out=$E/transcripts/consumers-$label; mkdir -p "$out"
lists=("$@")
[ ${#lists[@]} -eq 0 ] && lists=("$E/tools/consumers/distinct.txt")
for f in "${lists[@]}"; do
  name=$(basename "${f%.txt}")
  rm -rf packages/testkit/test/.tmp-fault
  npx vitest run $(cat "$f" | tr '\n' ' ') > "$out/$name.txt" 2>&1
  printf '%-38s %s | %s\n' "$name" \
    "$(grep -E '^ *Test Files ' "$out/$name.txt" | tail -1 | tr -s ' ')" \
    "$(grep -E '^ *Tests '      "$out/$name.txt" | tail -1 | tr -s ' ')"
done
rm -rf packages/testkit/test/.tmp-fault
