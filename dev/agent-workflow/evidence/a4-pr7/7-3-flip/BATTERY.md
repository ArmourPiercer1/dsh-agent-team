# §7.3 flip lane — BATTERY (measured on the tree this lane leaves behind)

Tree left behind = **base behaviour, narrowing withheld** (all-or-nothing; see FINDINGS §1).
`git diff --stat` after the revert: empty. Population reds are byte-identical to the base run
modulo the two declared `p6t1-parallel` flakes.

Every number below was produced by the command printed above it, on this tree, in this session.

| Check | Command | Result |
|---|---|---|
| Version-clean fence (from toplevel — it exits 2 elsewhere) | `node scripts/verify-blueprint-version-clean.mjs` | `unknown(0,0) advisory(8,10) refused(52,115) prose(5,5) adjudicated(16,24)` — **the required invariant values, unmoved** |
| Fence wrapper suite | `npx vitest run packages/testkit/test/a4p7-blueprint-version-clean.test.ts` | **60 passed / 60** |
| Identity lint (nonzero = STOP) | `node scripts/lint-identities.mjs --diff dev/agent-workflow/evidence/a4-lint-baseline/lint-identities-0237d487.txt` | `76 distinct; new 0, resolved 0` → **clean**, exit 0 |
| Session-event scan | `npx vitest run packages/testkit/test/p4t6-session-event-scan.test.ts` | **10 passed / 10** |
| Typecheck (bailing) | `pnpm -r run typecheck` | exit 0, **0 × `error TS`** |
| Typecheck (no-bail, reported separately) | `pnpm -r --no-bail run typecheck` | exit 0, **0 × `error TS`** |
| Population | `npx vitest run packages/{runtime,domain,legacy,storage,contracts}/test` | **18 failed / 5022 passed (5040)**, 8 files, 12.4s |
| Same population at base (`git stash`ed) | same | **20 failed** — the extra 2 are `p6t1-parallel` flakes, which fire and not fire across runs |
| Red-identity diff, mine vs base | `comm -13` on the two `FAIL` lists | **empty** → the narrowing introduced **no** new red |
| Red-identity delta from the §7.5 deletion | same | **+41 legs / 9 files** (39 real + 2 flakes) |

Base debt, reported by identity, **not absorbed**: `t1-capability-schema` (9,
`$.metadata must be a plain object, got null`), `p6t3-mediation` (5), `p6t3-restart` (2),
`d3-member-identity-context` (1), `t2-blueprint-hash` (1), `p6t1-parallel` (2, flaky), plus
file-level faults in `t12a-glue-handoff-ports`, `t12a-b2-child-identity`,
`p8s3b-result-effects`. `a4p7-merge-gate`'s 1 red is base debt needing `pnpm build` (testkit run).

## What was NOT run, because the tree that needed it does not exist any more

The §7.3-specific legs (`a4p7-blueprint-v3-governance` 20, `a4p7-v3-cutover-acceptance` 70,
`a4p7-v8-catalog-migration-state` 21, `a4f1-row-version-not-document-version` 16,
`p7t6-teammates-adapter` 22, `a3p4-r4-authority-binding` 17, `a3p4-pr4-production-entry-regression`
20, the 13 runtime grammar-carrier files, `t2-blueprint-v2-*`, `blueprint-v1-frozen-resume`) were all
run **green on the migrated tree** while it existed, per-file, and are green again only by
applying [`73-flip-full-migration.patch`](73-flip-full-migration.patch). They are red or
non-collecting on the tree I am leaving, because on this tree those fixtures are still v1 and the
tests still expect `[1, 2, 3]`. That is the expected shape of "narrowing withheld": nothing on this
tree is newer than base.

## The patch is NOT apply-as-is

`73-flip-full-migration.patch` (35 files, +1248/−469) bundles three separable things:

1. **The narrowing + its test/fixture migration + the skill example + the census fix + the fence
   comment fix** — measured to zero new reds, ready.
2. **`packages/legacy/teammates-adapter.ts`** — the one production site that *emits* a blueprint
   document (`:542`). Needs its own look: it changes the content hash of every legacy import.
3. **`packages/runtime/governance/permission-mutation.ts`** — the §7.5 deletion. **Do not apply
   without the 39-leg disposition** in FINDINGS §1; applying it alone turns ~23 documented
   refusals into commits in every root-direct test world, and leaves the shipped product's
   behaviour resting on a single line (`host.ts:2703`) that nothing in the corpus pins.

Split before merge. Items 1 and 2 can go together once §7.5's follow-up decides the ceiling wiring;
item 3 goes only with its test work, in the same commit.
