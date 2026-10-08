#!/usr/bin/env bash
# Reproduce the three-tree proof for the never-built / build-regressed split
# (a4-pr7/instrument-tree-shape, task #2).
#
# Every mutation is of GITIGNORED build output, each one is undone in the same block, and the
# tracked-file status is printed around each tree. Nothing here builds into the committed
# install surface: `pnpm --filter @dsh-agent-team/client run build` writes only
# `packages/client/dist`, which is neither tracked nor in either install surface.
#
# Run from the task worktree. Requires an installed workspace (`pnpm install`).
set -u
. /home/user/dsh-plugins/dsh-agent-team/.tmp-faultscratch/clsx-env.sh   # sets $STORE, XDG dirs
ENTRY=packages/client/dist/packages/client/src/plugin/client.js
BASE=dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt
clean() { sed 's/\x1b\[[0-9;]*m//g'; }
gate() { npx vitest run packages/testkit/test/a4p7-merge-gate.test.ts 2>&1 | clean | grep -E "^ *× |Test Files|^ *Tests "; }
cls()  { npx vitest run packages/testkit/test/a4p75-composition-smoke-classification.test.ts 2>&1 | clean | grep -E "^ *× |Test Files|^ *Tests |live leg"; }
prov() { node -e 'const p=await import("./scripts/a4-artifact-provenance.mjs");const c=p.classifyAbsentArtifact({repoRoot:process.cwd(),rel:process.argv[1],label:"client plugin (packages/client)"});console.log("provenance:",c.verdict,"| outputRoot:",c.prov.outputRoot,"| siblings:",c.prov.outputFileCount)' --input-type=module -- "$ENTRY"; }
tree() { echo "tracked-file status: $(git status --porcelain | grep -c .) line(s)"; }

echo "### TREE A — no build output (the shape of a fresh clone / fresh worktree)"
tree; mv packages/client/dist /tmp/dist-held; prov; gate; cls
mv /tmp/dist-held packages/client/dist

echo "### TREE B — healthy build output"
pnpm --filter @dsh-agent-team/client run build >/dev/null 2>&1; echo "build exit=$?"; tree; prov; gate; cls

echo "### TREE C — one artifact surgically removed, siblings left (must read FAILED)"
mv "$ENTRY" /tmp/entry-held; prov; gate; cls
mv /tmp/entry-held "$ENTRY"; tree

echo "### TREE D — one gitignored root-level scratch .mjs (the lint leg must name its universe)"
printf 'export const probeResult = someUndefinedGlobalFromAnEarlierInfraRound({ cwd: process.cwd() })\n' >.tmp-resolve-probe.mjs
node scripts/lint-identities.mjs --diff "$BASE"; echo "lint-identities exit=$?"
node scripts/check-artifacts-committed.mjs | tail -1
node scripts/verify-blueprint-version-clean.mjs | grep -E "scanned-in-scope|RESULT verdict"
rm -f .tmp-resolve-probe.mjs

echo "### the fourth state, with no tree mutation at all: the 'absent' fixture inside the 7.5 suite"
npx vitest run packages/testkit/test/a4p75-composition-smoke-classification.test.ts -t "names a never-built artifact" 2>&1 | clean | grep -E "^ *Tests "

echo "### eslint's exit 2 (vanishing directory, not contention): see reproduce-lint-exit2.sh"
