# u7-r4091 (2026-10-27) — nlink re-check before the first byte change (R-409-1 defence-in-depth)

Branch `task/u7-r4091-nlink-recheck-20261027` / worktree `.worktrees/u7-r4091`, off
`origin/master` `a264d2df0` (#414 merge), single writer. No host boot; :3080 / ~/.dsh untouched.
CORE PATCH BUDGET untouched (zero upstream edits). Protected-center re-check:
`packages/runtime/controlled-fs/**` has **zero** entries in
`dev/agent-workflow/ledgers/arc-a-protected-center.json` (36 booked paths: control,
governance-center, operation-permission, admission-kernel — no controlled-fs files), so
no center-interface PR is needed and this lane edits freely.

## Residual R-409-1 (LOW, recorded on PR #409's merge ruling)

`verifyOpenedHandle` (open-at-exec.ts) observed `nlink === 1` ONCE at open time; the
write-class paths truncated/wrote on the SAME fd with no second observation:

- `post-consume-write.ts` — verify → `truncate(0)` → write loop;
- `post-consume-edit.ts` — verify → read half (several real awaits) → match law → `truncate(0)`;
- `controlled-fs.ts` `writeText` — the destructive branch: `safeOpen(... O_TRUNC, destructive: true)`
  verifies AFTER the open's kernel truncate, then writes with no second link observation.

An attacker planting a SECOND NAME for the verified inode between the open-time
observation and the first byte change mutated the outside file through the alias (RED log
`runs/RED-inert-seams.txt`: the outside names literally gained `OVERWRITTEN-THROUGH-ALIAS`,
`NEW-TEXT edit target`, `LANE-WRITTEN-THROUGH-ALIAS`).

## Fix (once, in the shared law module)

`recheckSingleLink(fd)` in `packages/runtime/controlled-fs/src/open-at-exec.ts`: one cheap
same-fd `fstat`; regular file with `nlink !== 1` answers the EXISTING `hardlinkAliasVerdict`
shape (closed reason set unchanged — `hardlink-alias`, class `denied`); directory exemption
of the law applies verbatim; a failed `fstat` answers `undeterminable` (the byte-changing
step must not run). Called by every write-class caller immediately BEFORE its first
byte-changing step — no per-family copies:

- post-consume write/edit: refuse with `cfsDenial('hardlink-alias', …)`; the truncate never
  runs, so zero bytes change through either name. An `undeterminable` answers the existing
  `exec-time-identity-drift` undetermined with `sideEffectPossible: false` (nothing changed).
- lane `writeText`: refusal with `cfsDenial('hardlink-alias', …)` + the honest statement that
  the O_TRUNC of the destructive open at open time stands as the lane's disclosed (approved)
  effect — NO content byte lands; an `undeterminable` rides the EXISTING destructive branch
  (`write-side-effect-unconfirmed`, `sideEffectPossible: true`).
- Reads left as-is per the ruling scope (byte-changing steps): the read callers have no
  separate verify→first-read site that is a one-line same-fd call outside the already
  governed `verifyOpenedHandle` step; the fs-family/search/image read paths read immediately
  after the shared verify with no additional lane step in between.
- `post-consume-create.ts` unchanged: its first content write is already preceded, without
  any intervening await, by `verifyOpenedHandle`'s nlink observation plus its own
  `fresh.nlink !== 1` belt-and-braces arm (post-merge #405 round) — the immediately-before-
  first-write observation the ruling asks for is already structurally present there.

### Test seams (no production knobs)

To make the verify→first-byte window deterministic the lane adds TWO lane-internal optional
probe seams, mirroring the existing PoC3 `onAfterPreCheckBeforeOpen` hook (which exists on
master for exactly this purpose):

- `PostConsumeWriteCallContext.onBeforeFirstByteChange` / `PostConsumeEditCallContext.onBeforeFirstByteChange`
- `LaneHooks.onAfterVerifiedBeforeWrite`

The sanctioned wiring (fs-family `write-executor.mjs` / `edit-executor.mjs`,
`admission-binding.ts`) passes NEITHER — pinned statically by the S-1 leg. Seam presence
alone changes no law (P-write passes with the seam present but inert).

## RED → GREEN → mutation

- `runs/RED-inert-seams.txt` — with ONLY the inert seams on the tree (no helper), all three
  H-legs show the byte mutation through the late alias (7 failed / 4 passed).
- `runs/GREEN.txt`, `runs/GREEN-after-mutation-revert.txt` — after the fix: 11/11 green.
- `runs/MUTATION-recheck-disabled.txt` — with the law disabled by probe env
  (`U7_R4091_MUTATE=1`): exactly R-2 + H-write + H-edit + H-lane RED (4 failed / 7 passed);
  mutation reverted (the helper file was re-written from the pre-mutation state; the shipped
  tree contains no mutation probe — verified by `Grep U7_R4091_MUTATE` = 0 hits).

## Suites (unchanged-green)

- u7-r4091 new suite: 11/11.
- controlled-fs lane suites (`packages/runtime/controlled-fs/test`), u7-fixfwd-hardlink-alias,
  a5-m1-read-c1c2, u7-9a-fs-mutation-c1, u7-9a-mutation-golden-vectors: 116/116 together
  (8 files) on the fixed tree.
- p4t6 scanner: RED unbooked measures `scanner counts 1383, ledger derives 983 + 399 = 1382`
  (`runs/p4t6-RED-unbooked-measure.txt`); with `packages/testkit/test/p4t6-bookings/u7r4091.json`
  booked: 20/20 green (`runs/p4t6-GREEN.txt`).
- Full root suite + `pnpm typecheck` + `ci-pr-gate`: counts recorded in README-gates section
  below (final staged tree).

## Gates (final staged tree; logs in `runs/`)

- Full root suite (`npx vitest run`, fixed tree): **642/643 files, 8379/8380 tests** — the
  single failure is `a4p7-merge-gate.test.ts`'s `check:artifacts` leg reading the git INDEX
  while this lane's source+dist were still UNSTAGED (content-drift against the staged blob).
  After staging source+dist together the file re-runs GREEN (exit 0). No product test failed.
- `pnpm typecheck`: all packages clean (tests included).
- `node scripts/check-artifacts-committed.mjs` (staged tree): `DSH-ARTIFACT-VERDICT …
  verdict=ok compared=1881 glue=98` — source + rebuilt dist in the SAME commit.
- `node scripts/ci-pr-gate.mjs --store-dir .tmp-pnpm-store` (`runs/ci-pr-gate-staged.txt`):
  `DSH-CI-VERDICT pass pass=7 fail=0 skip=1 skipped=census legs=8 refused=0` (~59 s; census is
  the named opt-in skip, same profile as the u7-fixfwd lane).
- `eb3-ci-required` findings=0; `eb3-ci-negative-controls` 24/24; `eb3-evidence-guard
  --new-since origin/master` findings=0 (bound 1 MiB respected); `eb3-family-boundaries` 0;
  `eb3-family-definitions` 0.
