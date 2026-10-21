#!/usr/bin/env bash
# install-manifest-negative-controls.sh — canonical self-contained negative-control runner
# (intended repo home once ROOT approves: tests/checks/install-manifest-negative-controls.sh;
#  source/CI leg only, never in the published package). Replaces v1-v3 (kept untouched for
#  history under this probe dir). Creates ALL fixtures fresh inside a unique run dir every
#  execution: no persistent state, no reuse, NOTHING deleted.
# Discipline: BASE green hard-gate first; one mutation per case; assert exit code AND
# diagnostic; cumulative failures => non-zero runner exit; stdout teed to runner-stdout.txt.
set -u
# Canonical location: tests/checks/install-manifest-negative-controls.sh (source/CI leg).
HERE=$(cd "$(dirname "$0")" && pwd)
REPO=$(cd "$HERE/../.." && pwd)
C=$REPO/scripts/check-install-manifest.mjs   # the REAL committed checker, never a same-dir copy
N=$HERE/.nc-runs                             # runtime dir (untracked; recommend adding tests/checks/.nc-runs to .gitignore)
RUNDIR=$N/run-$(date -u +%Y%m%dT%H%M%SZ)-$$
mkdir -p "$RUNDIR"
exec > >(tee "$RUNDIR/runner-stdout.txt") 2>&1
FAILED=0
chk() { local name=$1 exp_exit=$2 exp_pat=$3 out=$4 ex=$5
  if [ "$ex" != "$exp_exit" ]; then echo "BAD  $name: exit=$ex expected=$exp_exit"; FAILED=$((FAILED+1)); return; fi
  if ! grep -qF -- "$exp_pat" "$out"; then echo "BAD  $name: exit ok but diagnostic '$exp_pat' absent"; FAILED=$((FAILED+1)); return; fi
  echo "PASS $name (exit=$ex, diagnostic ok)"; }
fresh() { mkdir -p "$RUNDIR/$1" && cp -a "$RUNDIR/base-hosted/." "$RUNDIR/$1/"; }

# ---------- build base fixture (fully self-contained) ----------
B=$RUNDIR/base-hosted; mkdir -p $B
cat > $B/package.json <<'EOF'
{
  "name": "nc-root", "version": "0.0.0", "type": "module", "files": [".agents/skills"],
  "exports": { ".": "./entry-shim.js", "./client": "./client.js", "./host": "./host.js" },
  "peerDependencies": { "@deepseek-ai/dsh": "0.2.0-rc.2", "@deepseek-ai/dsh-session": "0.2.0-rc.2" },
  "dependencies": { "yaml": "2.9.0" }
}
EOF
printf 'import { parse } from "yaml";\nimport type { X } from "@deepseek-ai/dsh-session";\nexport const shim = parse;\nvoid 0;\n' > $B/entry-shim.js
printf 'import shared from "./shared.js";\nexport const B = shared;\n' > $B/client.js
printf 'import React from "react";\nexport default React;\n' > $B/shared.js
printf 'import dep from "./hostdep.js";\nexport default dep;\n' > $B/host.js
printf 'export default { hostOnly: 1 };\n' > $B/hostdep.js
# NOTE: deliberately WITHOUT the blank line after `importers:` (harder than real pnpm output;
# the real-blank-line format is covered by case L1).
cat > $B/pnpm-lock.yaml <<'EOF'
lockfileVersion: '9.0'

importers:
  .:
    dependencies:
      yaml:
        specifier: 2.9.0
        version: 2.9.0
      '@deepseek-ai/dsh':
        specifier: 0.2.0-rc.2
        version: 0.2.0-rc.2
      '@deepseek-ai/dsh-session':
        specifier: 0.2.0-rc.2
        version: 0.2.0-rc.2

snapshots:

  yaml@2.9.0: {}

  '@deepseek-ai/dsh@0.2.0-rc.2': {}

  '@deepseek-ai/dsh-session@0.2.0-rc.2': {}
EOF

node $C $B > "$RUNDIR/base.out" 2>&1; BASE_EX=$?
if [ $BASE_EX -ne 0 ] || ! grep -qF "lock leg: PASS" "$RUNDIR/base.out"; then
  echo "ABORT BASE-green: baseline not GREEN (exit=$BASE_EX)"; cat "$RUNDIR/base.out"; exit 1
fi
echo "PASS BASE-green(lock PASS; browser-only react) — baseline gate open; run dir $RUNDIR"

# ---------- core matrix (v1-v3 semantics) ----------
fresh m1
python3 -c "
import json,collections;p='$RUNDIR/m1/package.json';d=json.load(open(p),object_pairs_hook=collections.OrderedDict)
e=d['exports']; d['exports']=collections.OrderedDict((k,e[k]) for k in ['./client','.','./host'] if k in e)
json.dump(d,open(p,'w'),indent=2)"
printf 'import shared from "./shared.js";\nexport default shared;\n' > "$RUNDIR/m1/host.js"
node $C "$RUNDIR/m1" > "$RUNDIR/m1.out" 2>&1; chk "M1 dual-reach shared react: client-first enqueue, HOST still FAIL" 1 "browser-module-table import in HOST graph" "$RUNDIR/m1.out" $?

fresh m2; printf 'import dep from "./gone.js";\nexport default dep;\n' > "$RUNDIR/m2/host.js"
node $C "$RUNDIR/m2" > "$RUNDIR/m2.out" 2>&1; chk "M2 reachable file missing" 1 "missing local module: ./gone.js" "$RUNDIR/m2.out" $?

fresh m3; sed -i 's/^  yaml@2.9.0: {}$/  yaml@9.9.9-mutated: {}/' "$RUNDIR/m3/pnpm-lock.yaml"
node $C "$RUNDIR/m3" > "$RUNDIR/m3.out" 2>&1; chk "M3 dangling snapshot key" 1 "without snapshot key" "$RUNDIR/m3.out" $?
grep -qF "lock leg: FAILED" "$RUNDIR/m3.out" && echo "PASS M3b banner says lock leg FAILED" || { echo "BAD  M3b"; FAILED=$((FAILED+1)); }

fresh m4; python3 -c "
import json;p='$RUNDIR/m4/package.json';d=json.load(open(p));d['dependencies']['yaml']='2.8.0';json.dump(d,open(p,'w'))"
node $C "$RUNDIR/m4" > "$RUNDIR/m4.out" 2>&1; chk "M4 manifest yaml bump, lock untouched => specifier mismatch" 1 "specifier mismatch" "$RUNDIR/m4.out" $?

fresh m5; python3 -c "
import json;p='$RUNDIR/m5/package.json';d=json.load(open(p));del d['peerDependencies']['@deepseek-ai/dsh-session'];json.dump(d,open(p,'w'))"
node $C "$RUNDIR/m5" > "$RUNDIR/m5.out" 2>&1; chk "M5 required peer deleted => undeclared" 1 "undeclared bare import" "$RUNDIR/m5.out" $?

fresh m6; python3 -c "
import json;p='$RUNDIR/m6/package.json';d=json.load(open(p));d['peerDependencies']['@deepseek-ai/dsh-session']='0.2.0-rc.1';json.dump(d,open(p,'w'))"
node $C "$RUNDIR/m6" > "$RUNDIR/m6.out" 2>&1; chk "M6 peer version != dsh peer version" 1 "must equal the declared @deepseek-ai/dsh peer version" "$RUNDIR/m6.out" $?

fresh m7; python3 -c "
import json;p='$RUNDIR/m7/package.json';d=json.load(open(p));d['dependencies']['react']='18.0.0';json.dump(d,open(p,'w'))"
node $C "$RUNDIR/m7" > "$RUNDIR/m7.out" 2>&1; chk "M7 browser-table member as Node dependency" 1 "never be a Node dependency" "$RUNDIR/m7.out" $?

fresh m8; printf 'const s = ".mjs";\nexport const a = import("./hostdep.js" + s);\nconst e = Math.random();\nexport const b = import/*c*/(e ? "./hostdep.js" : "./shared.js");\nexport default 0;\n' > "$RUNDIR/m8/hostdep.js"
node $C "$RUNDIR/m8" > "$RUNDIR/m8.out" 2>&1; chk "M8a computed concat import rejected" 1 "computed import() rejected" "$RUNDIR/m8.out" $?
grep -qF 'expr="\"./hostdep.js\" + s"' "$RUNDIR/m8.out" && echo "PASS M8b rejection carries file:line + verbatim expr" || { echo "BAD  M8b"; FAILED=$((FAILED+1)); }

fresh m9; printf 'import { x } from "yaml\n' > "$RUNDIR/m9/entry-shim.js"
node $C "$RUNDIR/m9" > "$RUNDIR/m9.out" 2>&1; chk "M9 parser syntax diagnostics fail-closed" 1 "syntax diagnostics" "$RUNDIR/m9.out" $?

fresh m10; mkdir -p "$RUNDIR/m10-lock-removed"; mv "$RUNDIR/m10/pnpm-lock.yaml" "$RUNDIR/m10-lock-removed/pnpm-lock.yaml"
node $C "$RUNDIR/m10" > "$RUNDIR/m10.out" 2>&1; chk "M10 no lock under root => SKIPPED, no lock claim" 0 "lock leg: SKIPPED (lock leg did not run" "$RUNDIR/m10.out" $?

fresh m11; python3 -c "
import json;p='$RUNDIR/m11/package.json';d=json.load(open(p));d['exports']['./client']={'import':'./client.js'};json.dump(d,open(p,'w'),indent=2)"
node $C "$RUNDIR/m11" > "$RUNDIR/m11.out" 2>&1; chk "M11 ./client[import] inherits browser identity" 0 "inherits ./client browser identity" "$RUNDIR/m11.out" $?

fresh m12; printf 'const seamUrl = rowConfig.seamUrl ?? resolveDefaultSeamUrl(import.meta.url);\nexport const m = await import(seamUrl);\nfunction resolveDefaultSeamUrl(u){ return u; }\n' > "$RUNDIR/m12/hostdep.js"
node $C "$RUNDIR/m12" > "$RUNDIR/m12.out" 2>&1; chk "M12 same var name wrong file/structure => rejected" 1 "computed import() rejected" "$RUNDIR/m12.out" $?

fresh m13; printf 'function __extReq(spec) { return require(spec); }\nexport const r = __extReq("react");\n' > "$RUNDIR/m13/hostdep.js"
node $C "$RUNDIR/m13" > "$RUNDIR/m13.out" 2>&1; chk "M13 require(spec) outside audited bundle site => rejected" 1 "computed require() rejected" "$RUNDIR/m13.out" $?

# ---------- ROOT predicate counterexamples (real audited paths, forged internals) ----------
HR=packages/runtime/dist/packages/runtime/src/plugin
mk_host_fixture() { # $1 = dirname; writes exports + host.js at REAL audited relative path
  fresh $1
  mkdir -p "$RUNDIR/$1/$HR"
  python3 -c "
import json;p='$RUNDIR/$1/package.json';d=json.load(open(p))
d['exports']['./host']='./$HR/host.js';json.dump(d,open(p,'w'),indent=2)"
}

# C1 predicate-1: left side is rowConfig.<something else> than seamUrl => must NOT match startsWith
mk_host_fixture c1
cat > "$RUNDIR/c1/$HR/host.js" <<'EOF'
export function defaultSeamUrlCandidates(hostModuleUrl) {
  return [new URL('../../root-binding/harness/seam.mjs', hostModuleUrl).href];
}
function resolveDefaultSeamUrl(u) { return defaultSeamUrlCandidates(u)[0]; }
export async function boot(rowConfig) {
  const seamUrl = rowConfig.somethingElse ?? resolveDefaultSeamUrl(import.meta.url);
  return await import(seamUrl);
}
EOF
node $C "$RUNDIR/c1" > "$RUNDIR/c1.out" 2>&1; chk "C1 rowConfig.<other> ?? default must NOT satisfy seamUrl binding (exact-prop predicate)" 1 "computed import() rejected" "$RUNDIR/c1.out" $?

# C2 predicate-2: sole import(candidate) present in the same function with the literal
#      array, but the for-of statement does NOT contain the site (loop var renamed and
#      `candidate` re-bound after the loop) => the handler must not consume it.
mk_host_fixture c2
cat > "$RUNDIR/c2/${HR}/host.js" <<'EOF'
export async function loadLegacyInspect() {
  const legacyEntryCandidates = ['./hostdep.js'];
  for (const legacyIter of legacyEntryCandidates) { void legacyIter; }
  const candidate = legacyEntryCandidates[0];
  return await import(candidate);
}
EOF
node $C "$RUNDIR/c2" > "$RUNDIR/c2.out" 2>&1; chk "C2 for-of must CONTAIN the site with initializer const-candidate (same-function else not enough)" 1 "computed import() rejected" "$RUNDIR/c2.out" $?

# C3 predicate-3: two literal URLs in resolveTeamSkillsDir but WRONG specs => must NOT pass as skills assets
fresh c3
SR=packages/runtime/dist/packages/runtime/src/plugin
mkdir -p "$RUNDIR/c3/$SR"
mkdir -p "$RUNDIR/c3/.agents/skills/skill-a" && printf -- '---\nname: skill-a\n---\n' > "$RUNDIR/c3/.agents/skills/skill-a/SKILL.md"
python3 -c "
import json;p='$RUNDIR/c3/package.json';d=json.load(open(p))
d['exports']['./host']='./$SR/team-skills.js';json.dump(d,open(p,'w'),indent=2)"
cat > "$RUNDIR/c3/$SR/team-skills.js" <<'EOF'
export function resolveTeamSkillsDir(entryUrl) {
  const candidates = [
    new URL('./wrong/one', entryUrl).href,
    new URL('./wrong/two', entryUrl).href,
  ];
  return candidates;
}
EOF
node $C "$RUNDIR/c3" > "$RUNDIR/c3.out" 2>&1; chk "C3 two URLs with wrong specs must NOT be consumed as S5/S6" 1 "unaudited non-js/mjs relative target" "$RUNDIR/c3.out" $?

# L1: real pnpm format (blank line after importers:) must also pass the lock leg
fresh l1; python3 - "$RUNDIR/l1/pnpm-lock.yaml" <<'PYL1'
import sys
p = sys.argv[1]; t = open(p).read()
open(p, "w").write(t.replace("importers:\n  .:", "importers:\n\n  .:", 1))
PYL1
node $C "$RUNDIR/l1" > "$RUNDIR/l1.out" 2>&1; chk "L1 lock with real blank line after importers: => PASS" 0 "lock leg: PASS" "$RUNDIR/l1.out" $?

# S1 audited site: fully legal const positive on a dedicated fixture (real targets exist), then ONLY const->let flips to rejection
HR2=packages/runtime/dist/packages/runtime/src/plugin
mk_s1() { mkdir -p "$RUNDIR/$1/$HR2"; cp "$RUNDIR/base-hosted/package.json" "$RUNDIR/$1/package.json"
  python3 -c "
import json;p='$RUNDIR/$1/package.json';d=json.load(open(p))
d['exports']={'.':'./entry-shim.js','./host':'./$HR2/host.js'};json.dump(d,open(p,'w'),indent=2)"
  cp "$RUNDIR/base-hosted/entry-shim.js" "$RUNDIR/$1/entry-shim.js"; cp "$RUNDIR/base-hosted/pnpm-lock.yaml" "$RUNDIR/$1/pnpm-lock.yaml"
  printf 'export const legacy = { inspectLegacyTeam(x) { return x; } };\n' > "$RUNDIR/$1/$HR2/sibling.js"
  cat > "$RUNDIR/$1/$HR2/host.js" <<EOF
export async function loadLegacyInspect() {
  const legacyEntryCandidates = ['./sibling.js'];
  for (const candidate of legacyEntryCandidates) {
    return await import(candidate);
  }
  throw new Error('no legacy entry candidate found');
}
EOF
}
mk_s1 s1pos
node $C "$RUNDIR/s1pos" > "$RUNDIR/s1pos.out" 2>&1; chk "S1-POS fully legal const site consumes (same fixture as C5)" 0 "audited site S1 consumed" "$RUNDIR/s1pos.out" $?
mk_s1 s1let
sed -i 's/for (const candidate of/for (let candidate of/' "$RUNDIR/s1let/$HR2/host.js"
node $C "$RUNDIR/s1let" > "$RUNDIR/s1let.out" 2>&1; chk "C5 ONLY const->let flips (all else legal incl. existing target) => rejected" 1 "computed import() rejected" "$RUNDIR/s1let.out" $?


echo "runner v4 failures=$FAILED (run dir kept: $RUNDIR; stdout: $RUNDIR/runner-stdout.txt)"
[ $FAILED -eq 0 ] && echo "RUNNER PASS" || echo "RUNNER FAIL"
exit $FAILED
