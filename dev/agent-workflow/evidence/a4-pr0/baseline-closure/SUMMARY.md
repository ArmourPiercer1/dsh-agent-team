# A4-PR0 — baseline closure capture (A1.2.3, only-downward proof)

Branch `feat/a4-pr0-proposal-substrate`, base `7af7e654` (master at the review round),
commit under review `6010de69` — the last source commit of the PR #68 review-fix round,
on which the captures in "Fix round" below were taken. Environment: node v24.21.0,
vitest 4.1.11, `CI=true`, workspace `XDG_*`, root suite (`pnpm vitest run`, include =
`packages/*/test/**/*.test.ts`).

**Provenance correction (reviewer SF-7), and the re-measurement it required.** The
header of this file originally read "base `5d646bd2`, docs commit `541cb812`, commit
under review `73569ea4`". Those SHAs are **pre-rebase twins**: the coordinator rebased
the branch onto `7af7e654` after PR #68 opened, and the six branch-only commits replayed
as `541cb812→c1d4d5b9`, `e3046466→ae0a87cf` (Lane C), `3d2395ee→08d8acda` (RED),
`73569ea4→7704fe87` (GREEN), `11dc86de→315ce3f5` (this file), `bebbec95→9c4e38a8`;
`73569ea4` no longer exists on this branch. The runs recorded below ("Round 1,
pre-rebase") were executed on that pre-rebase tree and are kept as what they are — they
were never taken on the branch as it now stands. Two things close that gap: the independent reviewer reproduced run 2 on
the **rebased** HEAD and reported the identity set byte-identical to mine, and the "Fix
round" section re-measures the rebased branch after the review fixes, twice, with the
same tool and the same protocol.

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

## Result — round 1 (pre-rebase tree, `73569ea4`)

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

## Result — fix round (rebased branch, `6010de69`, 2026-10-08)

The review round changed only lane/test sources, then the same protocol was run twice
on the rebased HEAD (`rm -rf packages/testkit/test/.tmp-fault/` before each):

| capture | identities | files | vs the pinned baseline (23 / 10) |
| --- | --- | --- | --- |
| `fixround` run 1 | **22 (19 TEST + 3 FILE)** | 9 | **FIXED 1, NEW 0** |
| `fixround` run 2 | **22 (19 TEST + 3 FILE)** | 9 | **FIXED 1, NEW 0** |

`fixround-run1-vs-run2.diff` is **empty**: the two captures are byte-identical, and
`sha256sum` puts both of them — and the pre-rebase run 2 above — on the same digest
`ed20c7776692104d5a1d9309c65bc81c1b661f17da4c75636f3ecb23049a91e3`. The named
`p6t1-parallel` flake pair did not appear in either fix-round run. `NEW=0` is the bar
the reviewer set, and the reference set is legitimately 22 / 9 today because this
branch's Lane C retired `rc2-kit-pin-hygiene::H2` (the single FIXED identity, explained
above); the pinned 23 stays the citable baseline and still moves only downward.

Totals: 461 files — unchanged, because the round added cases and no new spec file,
which is also why `p4t6`'s 978 pin needed no re-computation — and 5469 tests:

```
5469 = 5462 (round-1 capture) + 7
     = +3 (store B1, B2, B3) + 2 (corrupt C6b, C11) + 2 (the storage-edge leg's two cases)
```

Failed assertions 19 in both runs, against the baseline's 20. The independent reviewer's
reproduction on the rebased HEAD reported the same identity set before these fixes
landed, so the pre- and post-fix sets are comparable rather than merely similar.

## A4-PR0 gate evidence

- **RED captured before the module existed** (verbatim, per file):
  `Error: Cannot find module '../governance/proposal-store.js' imported from …/packages/runtime/test/a4pr0-proposal-store.test.ts`
  at `a4pr0-proposal-store.test.ts:57:1`, `a4pr0-proposal-corrupt.test.ts:50:1`,
  `a4pr0-proposal-generation.test.ts:80:1`, each reported as
  `Test Files 1 failed (1) / Tests no tests`.
  **Retained as files**: `../red-captures/red-capture-{store,corrupt,generation}.txt`
  carry the full verbatim run output with a provenance header. They are a
  RE-CAPTURE at the fix round's HEAD (module moved out of the tree for the run, i.e.
  the permanent state of `08d8acda`, which the reviewer confirmed), so their reported
  import line is a few lines off from the quote above — the specs changed in
  `bebbec95`. The failure itself is identical.
- **GREEN at round 1, six suites, 54 tests**: `a4pr0-proposal-store` 12 · `a4pr0-proposal-corrupt` 10 ·
  `a4pr0-proposal-generation` 8 · `a4pr0a-fact-type-closed-set` 9 ·
  `a4pr0a-abandon-projection-closure` 5 · `p4t6-session-event-scan` 10.
- **GREEN after the review round, nine suites, 91 tests**: store 15 · corrupt 12 ·
  generation 8 · `a4pr0a-fact-type-closed-set` 9 · `a4pr0a-abandon-projection-closure` 5 ·
  `p4t6-session-event-scan` 10 · `rc2-kit-pin-hygiene` 7 · `rc2-kit-preset-seam` 15 ·
  `a3p3-governance-lane-hygiene` 10 (was 8; the storage-edge leg added two).
- **The record can express the vocabulary it persists** (review SF-1/SF-2/SF-6):
  a maximal legal identity — 255-char TeamSession id, 37-char MemberInstance id, the
  derived 295-char snapshot id — appends and reads back SOUND against the owner's
  derived bound (`PERMISSION_OVERLAY_MAX_SNAPSHOT_ID_LENGTH`, 310; PR0's mirrored 256
  refused it); an envelope path with a space is SOUND and blank / control-character /
  over-1024 paths are refused against the Blueprint grammar
  (`PERMISSION_PATH_MAX_LENGTH`); a malformed `operationId` is a lane refusal
  (`MALFORMED_PROPOSAL` / `bad-operation-id`) with the sequence counter and the row
  list provably unmoved, pinned against the owner's `OPERATION_ID_PATTERN`.
- **Corrupt gate has both legs** (ADR A4-7): thirteen planted payload corruptions return a
  typed `corrupt-record` outcome naming path/field/sequence while every row stays listed
  and the sound row stays readable, and reading stays byte-identical across re-reads; the
  second leg tampers the durable ledger file at the ENTRY level and asserts the read
  THROWS (`listProposals` and `ledger.list()` both), never returning `[]` — with the
  contrast pinned that `[]` really is the shape of "this Team has no proposals".
  Three sharpenings from the review: the throw's IDENTITY is asserted
  (`TeamDomainError` / `RECORD_INVALID`, SF-4); the single sound row is appended in the
  MIDDLE of the corrupt rows and the read's sequence order must equal the append order
  and the durable order, with the sound outcome at index 5 (SF-3 — read order is what
  the "newer sequence supersedes" rule consumes, and nothing may re-sort it); and the
  report path is TOTAL — a BigInt, a cycle and a key-present-with-`undefined` payload
  all come back as typed corrupt outcomes instead of a `TypeError` from the message
  builder (SF-5), driven through the reader port PR5 will wire. The empty-Team contrast
  fixture is now a seeded, real TeamSession rather than an absent root (SF-6d).
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
  A4-PR0a precedent (PR #64 / `9c6edb42`). After the review round the same three
  commands run green with **zero** artifact drift — the round touched lane sources and
  tests only, and the lane still emits nothing.
- **Plan rule 10**: `pnpm -r run typecheck` green (exit 0) for the eight packages that
  declare a `typecheck` script — all nine packages except `packages/legacy`, which
  declares none; this line said "nine projects" in the first round, which was the wrong
  count and is corrected here rather than left in place:
  `pnpm exec eslint` clean on every created or modified file (`proposal-store.ts`,
  `proposal-codes.ts`, `src/plugin/projection-source.ts`,
  `client/src/model/ledger-adapter.ts`, the three new specs,
  `a4pr0a-fact-type-closed-set.test.ts`, both `rc2-kit-*` scanners, `scripts/fail-set.mjs`).
  No pre-existing failure was reported or needed, because none appeared. Re-run after
  the review round on the four files it touched (`proposal-store.ts`,
  `a4pr0-proposal-store.test.ts`, `a4pr0-proposal-corrupt.test.ts`,
  `a3p3-governance-lane-hygiene.test.ts`): typecheck Done for all eight such packages, eslint
  clean.
- **p4t6 pin**: `973 -> 978`, five scannable files (two lane sources + three specs), the
  arithmetic written in the comment, exact equality (no tolerance), and the five paths
  asserted present by path rather than inferred from the total.

## Housekeeping this capture produced

The two `p6t1-parallel` identities reappeared in one of two runs, reconfirming that the
allowance describes a real flake rather than a stale note. One baseline identity left the
set for a reason this branch owns and can point at. The JSON captures
(`root-vitest-pr0-1.json`, `root-vitest-pr0-2.json`, and the fix round's
`root-vitest-fixround-1.json` / `-2.json`) were deleted after normalization — identity
lists and diffs are the retained form, per the PR0a precedent. The fix-round identity
lists were produced with the carried tool itself
(`node scripts/fail-set.mjs capture <json> --out <file>`), not with
`fail-set-normalize.mjs`, so the capture and the diff are the same program's two views
of one format contract; `--self-test` still reports PASS.
