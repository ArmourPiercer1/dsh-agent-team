#!/bin/bash
out=.scratch/base-consumers; mkdir -p $out
for h in bound-blueprint-persona-helpers p6t1-helpers p6t2-helpers p6t3-helpers p6t4-helpers; do
  npx vitest run $(cat .scratch/consumers-$h.txt | tr '\n' ' ') > $out/$h.txt 2>&1
  echo "$h | $(grep -E '^ *Test Files ' $out/$h.txt | tail -1) | $(grep -E '^ *Tests ' $out/$h.txt | tail -1)"
done
