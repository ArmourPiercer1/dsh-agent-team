#!/bin/bash
out=.scratch/final-runs; mkdir -p $out
while read -r f; do
  rm -rf packages/testkit/test/.tmp-fault
  npx vitest run "$f" > "$out/$(basename ${f%.ts}).txt" 2>&1
  printf '%-56s %s | %s\n' "$(basename $f)" "$(grep -E '^ *Test Files ' "$out/$(basename ${f%.ts}).txt" | tail -1 | tr -s ' ')" "$(grep -E '^ *Tests ' "$out/$(basename ${f%.ts}).txt" | tail -1 | tr -s ' ')"
done < .scratch/final-list.txt
rm -rf packages/testkit/test/.tmp-fault
