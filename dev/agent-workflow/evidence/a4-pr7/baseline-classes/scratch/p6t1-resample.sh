#!/usr/bin/env bash
# p6t1-parallel re-sampling. The population baseline's PUBLISHED CORRECTION (round 38) says the
# "green solo 9/9" reading was a sample, not a property, and requires: "a red inside this family
# is dismissed only by at least three re-samples whose rate you publish". This lane publishes 8
# SOLO runs, each preceded by `rm -rf packages/testkit/test/.tmp-fault`, strictly one at a time.
# Also re-samples under census load later (see loadprobe note).
set -u
export CI=true
export XDG_CACHE_HOME=/home/user/dsh-plugins/dsh-agent-team/.tmp-xdg/cache
EV=dev/agent-workflow/evidence/a4-pr7/baseline-classes
cd /home/user/dsh-plugins/dsh-agent-team/.worktrees/a4-baseline-classes
N=${1:-8}
: > $EV/scratch/p6t1-solo-runs.tsv
for i in $(seq 1 "$N"); do
  rm -rf packages/testkit/test/.tmp-fault
  start=$(date -u +%FT%TZ)
  pnpm exec vitest run packages/runtime/test/p6t1-parallel.test.ts \
    --reporter=json --outputFile.json=$EV/raw/p6t1-solo-$i.json \
    > $EV/transcripts/p6t1-solo-$i.txt 2>&1
  rc=$?
  node -e '
    const fs=require("fs");
    const r=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
    let pass=0, fail=0; const names=[];
    for (const f of r.testResults ?? []) for (const a of f.assertionResults ?? []) {
      if (a.status==="passed") pass++;
      else if (a.status==="failed") { fail++; names.push((a.fullName??a.title).trim()); }
    }
    console.log([process.argv[2],pass,fail,names.join(" | ")].join("\t"));
  ' $EV/raw/p6t1-solo-$i.json "$i" >> $EV/scratch/p6t1-solo-runs.tsv
  echo "run $i rc=$rc $(tail -1 $EV/scratch/p6t1-solo-runs.tsv) $(date -u +%FT%TZ)"
done
echo "=== rate:"
awk -F'\t' '{f+=$3; p+=$2; if($3>0) bad++} END {print "runs="NR" red-runs="bad" red-legs="f" passed-legs="p}' $EV/scratch/p6t1-solo-runs.tsv
