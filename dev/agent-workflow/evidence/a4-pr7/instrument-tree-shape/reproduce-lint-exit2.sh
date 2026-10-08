#!/usr/bin/env bash
# Task #2, item 3, resumed: contention (H1) vs vanishing universe (H2). Reuses the scratch
# worktree the first attempt left behind. Gitignored scratch only; no tracked file is touched.
set -u
. /home/user/dsh-plugins/dsh-agent-team/.tmp-faultscratch/clsx-env.sh
MAIN=/home/user/dsh-plugins/dsh-agent-team
LAB=$MAIN/.worktrees/tmp-73-lintlab
S=$MAIN/.tmp-faultscratch/lintlab
BASE=$MAIN/dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt
mkdir -p "$S"
say() { printf '\n=== %s ===\n' "$*"; }
err_of() { head -25 "$1" | grep -vE "^\s*$|npm warn" | head -14; }
cd "$LAB" || exit 1
[ -d node_modules ] || pnpm install --store-dir="$STORE" --ignore-scripts --config.confirmModulesPurge=false >/dev/null 2>&1
rm -rf packages/testkit/test/.tmp-fault
say "SETUP head=$(git rev-parse --short HEAD) node_modules=$(test -d node_modules && echo yes || echo NO)"

flicker() { # keep creating and deleting for as long as it is alive
  local dir=$1 i=0
  mkdir -p "$dir"
  while :; do
    i=$((i+1))
    printf 'export const a%s = %s\n' "$i" "$i" >"$dir/f$i.mjs"
    printf 'export const b%s = %s\n' "$i" "$i" >"$dir/g$i.mjs"
    rm -f "$dir/f$i.mjs"
    sleep 0.02
  done
}

say "E2 FLICKER (continuous): create/delete storm inside the lint universe for the whole scan"
for a in 1 2 3 4; do
  flicker packages/testkit/test/.tmp-fault/flicker & FP=$!
  npx eslint . --format json >"$S/e2-$a.json" 2>"$S/e2-$a.err"; EC=$?
  kill $FP 2>/dev/null; wait $FP 2>/dev/null; rm -rf packages/testkit/test/.tmp-fault
  echo "attempt$a eslint_exit=$EC json_bytes=$(wc -c <"$S/e2-$a.json") stderr_bytes=$(wc -c <"$S/e2-$a.err")"
  err_of "$S/e2-$a.err"
  [ "$EC" = "2" ] && { echo "!! exit 2 with no JSON — verbatim stderr:"; cat "$S/e2-$a.err"; }
done

say "E2b VANISHING SUBTREE: whole fixture directory removed mid-scan"
for a in 1 2 3; do
  mkdir -p packages/testkit/test/.tmp-fault/repo/scripts packages/testkit/test/.tmp-fault/repo/packages/client/dist
  for i in $(seq 1 40); do printf 'export const b%s = %s\n' "$i" "$i" >packages/testkit/test/.tmp-fault/repo/scripts/h"$i".mjs; done
  sync
  ( sleep 4; rm -rf packages/testkit/test/.tmp-fault ) &
  npx eslint . --format json >"$S/e2b-$a.json" 2>"$S/e2b-$a.err"; EC=$?
  wait; echo "attempt$a eslint_exit=$EC json_bytes=$(wc -c <"$S/e2b-$a.json") stderr_bytes=$(wc -c <"$S/e2b-$a.err")"
  err_of "$S/e2b-$a.err"
done

say "E3 CONTENTION: 4 concurrent root scans"
for i in $(seq 1 4); do npx eslint . --format json >"$S/e3-$i.json" 2>"$S/e3-$i.err" & eval "P$i=\$!"; done
for i in $(seq 1 4); do eval "wait \$P$i"; c=$?; echo "parallel$i exit=$c json_bytes=$(wc -c <"$S/e3-$i.json") stderr_bytes=$(wc -c <"$S/e3-$i.err") head=$(head -c 100 "$S/e3-$i.err" | tr '\n' ' ')"; done

say "E3b CONTENTION: one scan while a heavy vitest file runs"
npx vitest run packages/runtime/test/p6t1-parallel.test.ts >"$S/e3b-vitest.txt" 2>&1 &
VP=$!; sleep 5
npx eslint . --format json >"$S/e3b.json" 2>"$S/e3b.err"; echo "eslint exit=$? json_bytes=$(wc -c <"$S/e3b.json")"
err_of "$S/e3b.err"
wait $VP; echo "vitest: $(grep -E '^ *Tests ' "$S/e3b-vitest.txt" | tail -1)"

say "E4 END-TO-END: the 7.5 suite (builds/removes .tmp-fault) concurrent with lint-identities"
for a in 1 2; do
  npx vitest run packages/testkit/test/a4p75-composition-smoke-classification.test.ts >"$S/e4-$a-vitest.txt" 2>&1 &
  VP=$!
  sleep 2
  node scripts/lint-identities.mjs --diff "$BASE" >"$S/e4-$a-lint.txt" 2>&1; LE=$?
  wait $VP
  echo "attempt$a lintident_exit=$LE vitest_failing_legs=$(grep -cE '^ *× ' "$S/e4-$a-vitest.txt")"
  grep -E "lint-identities:" "$S/e4-$a-lint.txt" | head -3
done

say "E6 FIX CANDIDATE: does excluding **/.tmp-fault/** change the identity set?"
mkdir -p packages/testkit/test/.tmp-fault/probe && printf 'export const z = 1\n' >packages/testkit/test/.tmp-fault/probe/z.mjs
npx eslint . --format json >"$S/e6-with.json" 2>/dev/null
rm -rf packages/testkit/test/.tmp-fault
npx eslint . --format json >"$S/e6-without.json" 2>/dev/null
npx eslint . --ignore-pattern '**/.tmp-fault/**' --format json >"$S/e6-ignored.json" 2>/dev/null
node -e '
const fs=require("fs"),path=require("path");
const files=(p)=>new Set(JSON.parse(fs.readFileSync(p,"utf8")).map(x=>x.filePath));
const rules=(p)=>new Set(JSON.parse(fs.readFileSync(p,"utf8")).flatMap(x=>x.messages.filter(m=>m.ruleId).map(m=>m.ruleId+" "+path.basename(x.filePath))));
const a=files(process.argv[1]),b=files(process.argv[2]),c=files(process.argv[3]);
const ra=rules(process.argv[1]),rb=rules(process.argv[2]),rc=rules(process.argv[3]);
console.log("files linted: fixtures-present="+a.size+" fixtures-absent="+b.size+" ignore-pattern-applied="+c.size);
console.log("only-with-fixtures-present:",[...a].filter(x=>!b.has(x)).map(x=>x.replace(/.*tmp-73-lintlab\//,"")).slice(0,6).join(", ")||"(none)");
console.log("identity counts present/absent/ignored:",ra.size,rb.size,rc.size);
console.log("present vs absent identical:",ra.size===rb.size&&[...ra].every(x=>rb.has(x)));
console.log("absent vs ignore-pattern identical:",rb.size===rc.size&&[...rb].every(x=>rc.has(x)));
' "$S/e6-with.json" "$S/e6-without.json" "$S/e6-ignored.json"

say "E5 UNIVERSE AUDIT (this worktree)"
node -e '
const {execFileSync}=require("child_process");const fs=require("fs");
const j=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));let ignored=[],untracked=[];
for(const f of j){const rel=f.filePath.replace(process.cwd()+"/","");
 let gi=false;try{execFileSync("git",["check-ignore","-q","--",rel],{stdio:"ignore"});gi=true}catch{}
 let tr=false;try{execFileSync("git",["ls-files","--error-unmatch","--",rel],{stdio:"ignore"});tr=true}catch{}
 if(gi)ignored.push(rel); if(!tr&&!gi)untracked.push(rel);}
console.log("linted files:",j.length,"| gitignored-but-linted:",ignored.length,"| neither tracked nor ignored:",untracked.length);
console.log("ignored sample:",ignored.slice(0,10).join(", ")||"(none)");
console.log("untracked sample:",untracked.slice(0,10).join(", ")||"(none)");
' "$S/e6-without.json"
say DONE2
