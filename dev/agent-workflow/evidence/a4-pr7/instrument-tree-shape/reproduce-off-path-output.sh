#!/usr/bin/env bash
# F1 / F2 proofs across the trees, at the merged head, after the fix round.
# Every `mv` is into workspace scratch and every tree is handed back; the script asserts the
# handback instead of assuming it.
set -u
. /home/user/dsh-plugins/dsh-agent-team/.tmp-faultscratch/clsx-env.sh
LAB=/home/user/dsh-plugins/dsh-agent-team/.worktrees/a4-tree-shape
H=/home/user/dsh-plugins/dsh-agent-team/.tmp-faultscratch/hold
O=/home/user/dsh-plugins/dsh-agent-team/.tmp-faultscratch/merged
ENTRY=packages/client/dist/packages/client/src/plugin/client.js
mkdir -p "$H" "$O"
cd "$LAB" || exit 1
clean() { sed 's/\x1b\[[0-9;]*m//g'; }
gate() { npx vitest run packages/testkit/test/a4p7-merge-gate.test.ts 2>&1 | clean | grep -E "^ *× |Test Files|^ *Tests |composition-smoke leg:|lint-visibility:"; }
cls()  { npx vitest run packages/testkit/test/a4p75-composition-smoke-classification.test.ts 2>&1 | clean | grep -E "^ *× |Test Files|^ *Tests |live leg"; }

{
  echo "### trees at $(git rev-parse --short HEAD) (merged), fix round applied"
  echo "### dist files at start: $(find packages/client/dist -type f | wc -l)   entry: $(test -e "$ENTRY" && echo present || echo ABSENT)"
  echo
  echo "==================== TREE A: never built (dist moved aside) ===================="
  mv packages/client/dist "$H/dist"
  echo "--- instrument (exit without a pipe)"
  node scripts/composition-smoke.mjs > "$O/A-instrument.txt" 2>&1; echo "exit=$?"
  echo "PASS=$(grep -c '^PASS' "$O/A-instrument.txt")  FAIL(steps)=$(grep -c '^FAIL .*plugin' "$O/A-instrument.txt")  footer=$(grep -E '^(PASS|FAIL) composition-smoke$' "$O/A-instrument.txt" | head -1)"
  echo "--- FULL GATE in tree A: the composition leg must be RED, and say why"
  gate
  echo "--- classifier suite in tree A"
  cls
  mv "$H/dist" packages/client/dist
  echo "handed back: $(test -e "$ENTRY" && echo entry-present || echo NO)  files=$(find packages/client/dist -type f | wc -l)"
  echo
  echo "==================== TREE C: entry removed, 399 siblings remain ===================="
  mv "$ENTRY" "$H/entry"
  echo "entry: $(test -e "$ENTRY" && echo present || echo REMOVED)   siblings: $(find packages/client/dist -type f | wc -l)"
  node scripts/composition-smoke.mjs > "$O/C-instrument.txt" 2>&1; echo "instrument exit=$?"
  gate
  mv "$H/entry" "$ENTRY"
  echo "handed back: $(test -e "$ENTRY" && echo entry-present || echo NO)  files=$(find packages/client/dist -type f | wc -l)"
  echo
  echo "==================== TREE E: the reviewer's hole — whole build output moved OFF the declared path ===================="
  mkdir -p packages/client/out
  mv packages/client/dist packages/client/out/dist
  echo "declared root: $(test -d packages/client/dist && echo present || echo ABSENT)   moved root files: $(find packages/client/out/dist -type f | wc -l)"
  echo "gitignored? $(git check-ignore -q packages/client/out/dist/ && echo YES || echo no)   tracked? $(git ls-files packages/client/out | wc -l) file(s)   git status lines: $(git status --porcelain | grep -c .)"
  echo "--- check:artifacts is blind to it:"
  node scripts/check-artifacts-committed.mjs 2>&1 | tail -1
  echo "--- lint: does it see the moved tree? (expect the out/dist path ignored by **/dist/**)"
  node scripts/lint-identities.mjs --diff /home/user/dsh-plugins/dsh-agent-team/dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt 2>&1 | grep -E "identity lines|universe|baseline "
  echo "--- FULL GATE in tree E: F1 must make it red even though every other leg is green"
  gate
  echo "--- the refusal text itself (bounded claim, no 'never produced' overclaim):"
  node -e '
    import("./scripts/a4-artifact-provenance.mjs").then((m) => {
      const p = m.artifactProvenance({ repoRoot: process.cwd(), rel: "packages/client/dist/packages/client/src/plugin/client.js", label: "client plugin (packages/client)" })
      const v = m.absentArtifactVerdict({ ...p, treeShape: m.treeShape({ repoRoot: process.cwd() }) })
      console.log(`verdict: ${v.verdict}`)
      console.log(v.why)
    })'
  mv packages/client/out/dist packages/client/dist
  rmdir packages/client/out
  echo "handed back: $(test -e "$ENTRY" && echo entry-present || echo NO)  files=$(find packages/client/dist -type f | wc -l)  out dir: $(test -d packages/client/out && echo STILL-THERE || echo removed)"
  echo
  echo "==================== TREE F: the same move to a NON-gitignored path ===================="
  mkdir -p packages/client/build
  mv packages/client/dist/* packages/client/build/
  rmdir packages/client/dist
  echo "declared root: $(test -d packages/client/dist && echo present || echo ABSENT)   moved files: $(find packages/client/build -type f | wc -l)"
  echo "gitignored? $(git check-ignore -q packages/client/build/ && echo YES || echo 'no — the moved files are in the lint universe')"
  node scripts/lint-identities.mjs --diff /home/user/dsh-plugins/dsh-agent-team/dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt > "$O/F-lint.txt" 2>&1; echo "lint exit=$?"; grep -E "identity lines|universe|baseline |NEW IDENTITIES" "$O/F-lint.txt" | head -4
  gate
  mkdir -p packages/client/dist
  mv packages/client/build/* packages/client/dist/
  rmdir packages/client/build
  echo "handed back: $(test -e "$ENTRY" && echo entry-present || echo NO)  files=$(find packages/client/dist -type f | wc -l)"
  echo
  echo "==================== HANDOVER ===================="
  echo "git status lines: $(git status --porcelain | grep -c .)"
  git status --porcelain | head -8
  echo "dist files: $(find packages/client/dist -type f | wc -l)   residue dirs: $(ls -d packages/client/out packages/client/build 2>/dev/null | tr '\n' ' ')(none expected)"
} > "$O/trees-after-F1.txt" 2>&1
echo "script exit=$?"
