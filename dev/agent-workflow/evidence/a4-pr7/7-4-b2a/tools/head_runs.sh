#!/bin/bash
out=.scratch/head-runs; mkdir -p $out
while read -r f; do
  rm -rf packages/testkit/test/.tmp-fault
  npx vitest run "packages/runtime/test/$f" > "$out/${f%.ts}.txt" 2>&1
  printf '%-52s %s\n' "$f" "$(grep -E '^ *Tests ' "$out/${f%.ts}.txt" | tail -1 | tr -s ' ')"
done < .scratch/roster.txt
rm -rf packages/testkit/test/.tmp-fault
