# A4-PR0 — baseline closure capture (A1.2.3, only-downward proof)

Branch `feat/a4-pr0-proposal-substrate`, base `5d646bd2` (PR #65 merged; the branch
carries its own docs commit `541cb812`), commit under review `73569ea4`. Environment:
node v24.21.0, vitest 4.1.11, `CI=true`, workspace `XDG_*`, root suite
(`pnpm vitest run`, include = `packages/*/test/**/*.test.ts`).
`origin/master` had already moved to `7af7e654` (PR #67, docs/records only) at capture
time; per instruction the branch was NOT rebased onto it, so the comparison subject is
the tree of `73569ea4`.

## Protocol

Per A1.2.3 the scratch world is deleted before every capture and the capture is taken TWICE:

```
rm -rf packages/testkit/test/.tmp-fault/
pnpm vitest run --reporter=json --outputFile=root-vitest-pr0-<i>.json
node dev/agent-workflow/evidence/alpha4/baseline/fail-set-normalize.mjs root-vitest-pr0-<i>.json
```

The identity diffs below were produced with the lane-carried tool
(`scripts/fail-set.mjs diff <baseline> <current>`, carried byte-identically from
`chore/a4-fail-set-tool` @ `5710eff6`, blob `9bbde4a9b9f9806d17706ff2093f1781dc59d089`,
`--self-test` PASS), whose format contract is the one the pinned baseline is written in.

## Result

| capture | identities | files | vs citable baseline (`failing-identities-2b86ee42.txt`, 23 identities / 10 files) |
| --- | --- | --- | --- |
| run 1 | 24 (21 TEST + 3 FILE) | 10 | **FIXED 1** (`rc2-kit-pin-hygiene::H2`), NEW = exactly the two `p6t1-parallel.test.ts` identities |
| run 2 | **22 (19 TEST + 3 FILE)** | 9 | **FIXED 1, NEW 0** — the failing set moved DOWNWARD |

`run1-vs-pinned-baseline.diff`, `run2-vs-pinned-baseline.diff` and `run1-vs-run2.diff`
are retained beside this file. `run1-vs-run2.diff` contains ONLY the two
`p6t1-parallel.test.ts` identities, which is the direct evidence that they are the
named flake pair and not a real regression: run 2 ran the same tree, the same 461 files
and the same 5462 tests, and that pair passed.

Both captures therefore satisfy the plan's rule — movement only downward, with the sole
permitted addition being the named `p6t1-parallel` flake pair (which appeared once and
is additive-only). Nothing else in the tree broke, and no baseline identity disappeared
unexplained.

### The one identity this branch legitimately fixes

`TEST packages/testkit/test/rc2-kit-pin-hygiene.test.ts::H2 … only tests/paths.mjs
assigns the baseline constants` is a pinned-baseline failure whose entire cause is the
scanning bug this branch repairs: the two whole-tree hygiene scanners walked the
filesystem from `findTestRepoRoot(process.cwd())`, which in a linked worktree resolves
to the PARENT checkout, and enumerated its gitignored `tests/homes/**` DSH_HOME worlds
(~954 generated durable-store files) as if they were kit sources. Scoping both walks to
`git ls-files` from the worktree under review makes H2 pass in a worktree and in the
main checkout alike, without changing what any tracked file is checked for. This is the
downward move; it is not the flake allowance doing work.

### Totals arithmetic (exact)

- Files: `461 = 458` (A4-PR0a's capture, whose two guard files are in master today) `+ 3`
  (`a4pr0-proposal-store`, `a4pr0-proposal-corrupt`, `a4pr0-proposal-generation`).
- Tests: `5462 = 5431` (A4-PR0a's capture) `+ 1` (PR #65 `456c2560` added the guard's
  `C1c` case) `+ 30` (this branch: 12 + 10 + 8, the per-suite counts verified by the
  targeted runs below).
- Failed assertions: `21` (run 1, carrying the flake pair) / `19` (run 2, without it),
  against the baseline's `20`. The `3 FILE` entries are the three pre-existing
  `COLLECTION-OR-UNHANDLED` files, unchanged in both runs.

## A4-PR0 gate evidence

- **RED captured before the module existed** (verbatim, per file):
  `Error: Cannot find module '../governance/proposal-store.js' imported from …/packages/runtime/test/a4pr0-proposal-store.test.ts`
  at `a4pr0-proposal-store.test.ts:57:1`, `a4pr0-proposal-corrupt.test.ts:50:1`,
  `a4pr0-proposal-generation.test.ts:80:1`, each reported as
  `Test Files 1 failed (1) / Tests no tests`.
- **GREEN, six suites, 54 tests**: `a4pr0-proposal-store` 12 · `a4pr0-proposal-corrupt` 10 ·
  `a4pr0-proposal-generation` 8 · `a4pr0a-fact-type-closed-set` 9 ·
  `a4pr0a-abandon-projection-closure` 5 · `p4t6-session-event-scan` 10.
- **Corrupt gate has both legs** (ADR A4-7): thirteen planted payload corruptions return a
  typed `corrupt-record` outcome naming path/field/sequence while every row stays listed
  and the sound row stays readable, and reading stays byte-identical across re-reads; the
  second leg tampers the durable ledger file at the ENTRY level and asserts the read
  THROWS (`listProposals` and `ledger.list()` both), never returning `[]` — with the
  contrast pinned that `[]` really is the shape of "this Team has no proposals".
- **A proposal append advances the session stamp and leaves the overlay CAS intact**
  (ADR A4-2/A4-3, all three counters live at once): the override slot winner is driven to
  3 and the overlay chain to 2 while the per-team stamp is pushed past both; after the
  append the stamp is +1 in the repository AND in the projection, the slot winner and its
  `OVERRIDE_GENERATION_CONFLICT.actualGeneration` are unchanged, the overlay generation /
  snapshot id / history length and `GENERATION_CONFLICT.actualGeneration` are unchanged,
  `baseGeneration` equals the OVERLAY generation and provably neither the stamp nor the
  slot, and the two CAS refusals produce ZERO durable writes while the append itself
  demonstrably produced some.
- **Plugin behaviour byte-identical (no product surface change)**: nothing in
  `src/plugin/**` imports the lane, `governance/index.ts` is untouched (its pinned key set
  stays `mutatePermission / resetOverride / setOverride / switchPolicyState`), and
  `pnpm build` emits NOTHING new from the governance lane
  (`git status --porcelain packages/*/dist` after a fresh build contains zero governance
  paths and zero untracked files). The only source edit under `src/plugin/**` is the
  category-table registration that the A4-PR0a defect class requires, plus its client
  mirror in the same commit (ADR A5-22).
- **Artifacts**: `pnpm build` and `pnpm build:composition` green; `pnpm run
  check:artifacts` → `OK: 1444 files; committed install-surface artifacts match the fresh
  build (incl. 1 glue placement(s))`. The four artifacts the rebuild moved
  (`runtime/dist/.../projection-source.{js,js.map,d.ts.map}` and
  `client/composition-shim/client-bundle.js`) are committed with their source, on the
  A4-PR0a precedent (PR #64 / `9c6edb42`).
- **Plan rule 10**: `pnpm -r run typecheck` green for all nine projects, and
  `pnpm exec eslint` clean on every created or modified file (`proposal-store.ts`,
  `proposal-codes.ts`, `src/plugin/projection-source.ts`,
  `client/src/model/ledger-adapter.ts`, the three new specs,
  `a4pr0a-fact-type-closed-set.test.ts`, both `rc2-kit-*` scanners, `scripts/fail-set.mjs`).
  No pre-existing failure was reported or needed, because none appeared.
- **p4t6 pin**: `973 -> 978`, five scannable files (two lane sources + three specs), the
  arithmetic written in the comment, exact equality (no tolerance), and the five paths
  asserted present by path rather than inferred from the total.

## Housekeeping this capture produced

The two `p6t1-parallel` identities reappeared in one of two runs, reconfirming that the
allowance describes a real flake rather than a stale note. One baseline identity left the
set for a reason this branch owns and can point at. The JSON captures
(`root-vitest-pr0-1.json`, `root-vitest-pr0-2.json`) were deleted after normalization —
identity lists and diffs are the retained form, per the PR0a precedent.
