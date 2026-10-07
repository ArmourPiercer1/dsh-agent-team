#!/bin/bash
# Final gate battery, re-derived on the MERGED tree (this branch + origin/master 14ea8717).
# Every roster file is committed before this runs: a script that ends with
# `git show HEAD:<path> > <path>` must never be run over an uncommitted edit (it silently
# reverted this lane's p8s3b comment once). Restores and sha256-verifies at the end.
set -u
E=dev/agent-workflow/evidence/a4-pr7/7-4-b2a
OUT=$E/transcripts/FINAL-GATES-MERGED.txt
: > "$OUT"
say(){ printf '%s\n' "$*" | tee -a "$OUT"; }
mapfile -t ALL < <(grep '^packages/runtime/test/' $E/tools/touched-files.txt)
mkdir -p .scratch   # scratch lives inside the worktree (/tmp is not shared between calls)
git show a4ef2a6b:packages/testkit/test/p4t6-session-event-scan.test.ts > .scratch/p4t6-base.ts 2>/dev/null || true

say "# Final gates on the merged tree — head $(git rev-parse --short HEAD), master 14ea8717, base a4ef2a6b"
say
# (no backticks in this header: a quoted `say` line would command-substitute them)
say "## 0. install sanity (a partial cp -al install produces phantom TS7026/TS2307)"
printf '  root node_modules: %s entries ; .pnpm store: %s ; package-level node_modules: %s of %s\n' \
  "$(ls node_modules | wc -l)" "$(ls node_modules/.pnpm 2>/dev/null | wc -l)" \
  "$(ls -d packages/*/node_modules 2>/dev/null | wc -l)" "$(ls -d packages/*/ | wc -l)" | tee -a "$OUT"

say
say "## 1. fence, twice, byte-identical"
node scripts/verify-blueprint-version-clean.mjs > $E/transcripts/fence-merged-1.txt 2>&1; r1=$?
node scripts/verify-blueprint-version-clean.mjs > $E/transcripts/fence-merged-2.txt 2>&1; r2=$?
grep '^RESULT' $E/transcripts/fence-merged-1.txt | sed 's/^/  /' | tee -a "$OUT"
cmp -s $E/transcripts/fence-merged-1.txt $E/transcripts/fence-merged-2.txt \
  && say "  two runs: BYTE-IDENTICAL (exit $r1 / $r2)" || say "  two runs DIFFER — investigate"

say
say "## 2. by-path movement, and the 7 files that stay dirty"
grep -oE 'OFFENDING +[^ ]+' $E/transcripts/fence-merged-1.txt | awk '{print $2}' | sort -u > .scratch/dirty-now.txt
say "  dirty paths in the fence output: $(wc -l < .scratch/dirty-now.txt)"
git show 14ea8717:packages/testkit/test/a4p7-blueprint-version-clean.test.ts \
  | python3 -c "
import re,sys
src=sys.stdin.read(); i=src.index('DEFERRALS'); i=src.index('[',i); d=0
for j in range(i,len(src)):
    d += src[j]=='[' ; d -= src[j]==']'
    if d==0: break
print('\n'.join(sorted(set(re.findall(r\"\[\s*'([^']+)'\", src[i:j+1])))))" > .scratch/master-dirty.txt
say "  DEFERRALS rows on master (its dirty set): $(wc -l < .scratch/master-dirty.txt)"
say "  gone (dirty on master, clean now): $(comm -23 .scratch/master-dirty.txt .scratch/dirty-now.txt | wc -l)"
say "  added (dirty now, not dirty on master): $(comm -13 .scratch/master-dirty.txt .scratch/dirty-now.txt | wc -l)"
say "  of which belonging to this lane: $(comm -13 .scratch/master-dirty.txt .scratch/dirty-now.txt | grep -cxF -f .scratch/roster34.txt || true)"
say "  remaining 7:"; sed 's/^/    /' .scratch/dirty-now.txt | tee -a "$OUT"

say
say "## 3. wrapper and scan-count ratchet"
rm -rf packages/testkit/test/.tmp-fault
npx vitest run packages/testkit/test/a4p7-blueprint-version-clean.test.ts > $E/transcripts/wrapper-merged.txt 2>&1
say "  wrapper: $(grep -E '^ *(Test Files|Tests) ' $E/transcripts/wrapper-merged.txt | tr -s ' ' | paste -sd' ' -)"
say "  wrapper vs master: $(git diff --numstat 14ea8717 -- packages/testkit/test/a4p7-blueprint-version-clean.test.ts | tr -s ' ')"
npx vitest run packages/testkit/test/p4t6-session-event-scan.test.ts > $E/transcripts/p4t6-merged.txt 2>&1
say "  p4t6: $(grep -E '^ *(Test Files|Tests) ' $E/transcripts/p4t6-merged.txt | tr -s ' ' | paste -sd' ' -)"
git diff --quiet 14ea8717 -- packages/testkit/test/p4t6-session-event-scan.test.ts \
  && say "  p4t6: BLOB-IDENTICAL to master's" || say "  p4t6: DIFFERS from master's — investigate"
python3 $E/tools/scan_count_derivation.py | tee -a "$OUT"

say
say "## 4. typecheck (real install)"
pnpm -r run typecheck > $E/transcripts/typecheck-merged.txt 2>&1
say "  pnpm -r run typecheck: exit $? ; TS7026/TS2307 occurrences: $(grep -cE 'TS7026|TS2307' $E/transcripts/typecheck-merged.txt)"

say
say "## 5. eslint on the 34 roster files — identity multiset, head vs base"
npx eslint -f json -o $E/transcripts/eslint-head-merged.json "${ALL[@]}" > $E/transcripts/eslint-head-merged.txt 2>&1; eh=$?
for p in "${ALL[@]}"; do git show "a4ef2a6b:$p" > "$p"; done
npx eslint -f json -o $E/transcripts/eslint-base-merged.json "${ALL[@]}" > $E/transcripts/eslint-base-merged.txt 2>&1; eb=$?
for p in "${ALL[@]}"; do git show "HEAD:$p" > "$p"; done
say "  exit: head $eh / base $eb  (1 = problems present, expected: these files carry pre-existing errors)"
say "  problem totals (from -f json): head $(python3 -c "import json;print(sum(len(r['messages']) for r in json.load(open('$E/transcripts/eslint-head-merged.json'))))") / base $(python3 -c "import json;print(sum(len(r['messages']) for r in json.load(open('$E/transcripts/eslint-base-merged.json'))))")"
say "  error/warning split (head): $(python3 -c "
import json;d=json.load(open('$E/transcripts/eslint-head-merged.json'))
m=[x for r in d for x in r['messages']];print(sum(x['severity']==2 for m_ in [0] for x in m), 'errors,', sum(x['severity']==1 for x in m), 'warnings')")"
python3 - <<'PY' | tee -a "$OUT"
import collections, json
def ident(p):
    out=collections.Counter()
    for r in json.load(open(p)):
        for m in r['messages']:
            # an unused eslint-disable directive reports ruleId None and carries the silenced
            # rule in the message; key it by the message's rule so it stays a stable identity
            key = m['ruleId'] or "unused-disable(" + (m['message'].split("'")[-2]
                                                      if "'" in m['message'] else '?') + ")"
            out[(r['filePath'].split('/')[-1], key)] += 1
    return out
b=ident('dev/agent-workflow/evidence/a4-pr7/7-4-b2a/transcripts/eslint-base-merged.json')
h=ident('dev/agent-workflow/evidence/a4-pr7/7-4-b2a/transcripts/eslint-head-merged.json')
print(f"  identity multiset (file, rule) -> count: base {sum(b.values())} problems / {len(b)} identities, "
      f"head {sum(h.values())} problems / {len(h)} identities, IDENTICAL={b==h}")
for k in sorted(set(b) | set(h)):
    if b[k] != h[k]: print(f"    DIFF {k}: base {b[k]} head {h[k]}")
PY

say
say "## 6. lint identities against the reviewed baseline"
node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt > $E/transcripts/lint-identities-merged.txt 2>&1
say "  exit $?; $(grep -iE 'new|resolved' $E/transcripts/lint-identities-merged.txt | tr '\n' ' ')"
say "  baseline line counts: $(wc -l < dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt) lines; current $(wc -l < $E/transcripts/lint-identities-merged.txt)"

say
say "## 7. element-set census on the merged tree (+ its own self-test)"
python3 $E/tools/element-set-census.py --self-test > $E/transcripts/census-self-test-merged.txt 2>&1
say "  self-test exit $? : $(grep -cE '^  PASS' $E/transcripts/census-self-test-merged.txt) PASS, $(grep -cE '^  FAIL' $E/transcripts/census-self-test-merged.txt) FAIL"
python3 $E/tools/element-set-census.py a4ef2a6b "${ALL[@]}" > $E/transcripts/element-set-census.txt 2>&1
say "  census exit $? : $(grep -E '^files ' $E/transcripts/element-set-census.txt)"
say "  positive control (base = c46bfa34^, the tree where the a2c7 metadata drop shipped): "
say "    $(python3 $E/tools/element-set-census.py c46bfa34^ packages/runtime/test/a2c7-subtree-matcher.test.ts | grep -E '^(files|  !!)' | tr '\n' '|') "

say
say "## 8. tree integrity after every swap"
git status --porcelain -- packages runtime scripts tests | grep -v '^$' | sed 's/^/  UNEXPECTED: /' | tee -a "$OUT"
n=$(git status --porcelain -- packages | wc -l)
[ "$n" = 0 ] && say "  packages/: working tree matches HEAD (all restores clean)" || say "  packages/: $n modified paths — investigate"
