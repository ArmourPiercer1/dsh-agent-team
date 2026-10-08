#!/bin/bash
# Head consumer runs for the five promoted helpers, clean scratch each time, so
# red NAMES can be diffed against the base run of the same set.
out=.scratch/head-consumers; mkdir -p $out
for h in bound-blueprint-persona-helpers p6t3-helpers p6t2-helpers p6t4-helpers p6t1-helpers; do
  rm -rf packages/testkit/test/.tmp-fault
  npx vitest run $(cat .scratch/consumers-$h.txt | tr '\n' ' ') > $out/$h.txt 2>&1
  echo "$h | $(grep -E '^ *Test Files ' $out/$h.txt | tail -1) | $(grep -E '^ *Tests ' $out/$h.txt | tail -1)"
done
rm -rf packages/testkit/test/.tmp-fault
