#!/bin/bash
# SUPERSEDED — DO NOT RE-RUN AS IS. This is the script that produced
# transcripts/consumers-base/, and it is missing the scratch clean
# (rm -rf packages/testkit/test/.tmp-fault) before each run, so those transcripts are
# artifact runs: p6t1 79f|197p, p6t2 117f|38p, p6t4 65f|40p, with 116 / 79 / 92
# "team_domain already exists" lines. It is kept unfixed, next to the artifacts, so the
# mistake stays auditable; FINDINGS.md §5 and §9 carry the correction and the numbers.
# Use tools/consumers.sh instead.
out=.scratch/base-consumers; mkdir -p $out
for h in bound-blueprint-persona-helpers p6t1-helpers p6t2-helpers p6t3-helpers p6t4-helpers; do
  npx vitest run $(cat .scratch/consumers-$h.txt | tr '\n' ' ') > $out/$h.txt 2>&1
  echo "$h | $(grep -E '^ *Test Files ' $out/$h.txt | tail -1) | $(grep -E '^ *Tests ' $out/$h.txt | tail -1)"
done
