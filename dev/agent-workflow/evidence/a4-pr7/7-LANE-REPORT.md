# A4-PR7 lane report — Tasks 7.0 → 7.6 (writer: the A4-PR7 subagent)

Branch `feat/a4-pr7-v3-cutover` (worktree `.worktrees/a4-pr7`, base `c7537872`).
**Nothing was pushed, no PR opened, nothing merged** — as instructed. Task 7.7 (human
acceptance) is not this lane's to perform; what it needs is recorded in §5.

## 1. The four facts, stated separately because they are four facts

| fact | state at this hand-off |
| --- | --- |
| PR7 merged | **NO.** Six local commits, unpushed, unreviewed. |
| Alpha.4 implementation complete | **NO.** Task 7.3's cutover is unexecuted and Task 7.4's fixture migration is not done; 7.5 is partial. Measured scope of what remains: `7-3-BLAST-RADIUS-AND-UNEXECUTED-FLIP.md`. |
| Alpha.4 human acceptance | **NOT_RUN / BLOCKED.** This environment cannot execute the Remote/real-host legs: no `tests/deepseek-harness-test-use/packages/cli/dist`, `tests/homes/.playwright-browsers` empty, no `/opt/google/chrome/chrome`. This is the same condition 7.7 was deferred for; the deferral must be re-issued with owner, trigger and a dated receipt — never silenced. |
| Stage closure | **PENDING** on all three rows above. |

**"PR merged" is not "Alpha.4 fully accepted", and must never be reported as such.**
Merging this branch would mean: Alpha.4's degraded-boot and migration-discovery
contract is real in-process, the fence that guards the cutover exists and is invoked,
and **the cutover itself has not happened** — no v3-only switch, so a v1/v2 Team still
runs and Alpha.4's migration obligation is not yet enforced in the product.

## 2. What landed (each commit is a green, self-contained unit)

| commit | what it is |
| --- | --- |
| `00809868` … `b8c76471`, `33efdbd7` | Task 7.0: A1-14 consumption-point revalidation, RED-first then production, plus the fixture carry of the persisted authority point. |
| `b4340c50` | Task 7.1: the three-state version algebra (CURRENT / RETIRED / UNREADABLE), derived retired set, inspection + catalog surfaced mutation-proved. |
| `d9703292` | Task 7.2: a refused Blueprint **degrades the host**; it never starts a Team. Entrance enumeration closed at four mechanisms, gates on the ports, ordering law (version leg before governance leg) pinned, 31 new behavioural tests (lane 54/54), 6-mutation bite check (5 red). |
| `9d3ca9ba`(see note) | Task 7.6 follow-up: the lint-identity leg found 2 new identities this lane had introduced (a dead `parseBlueprint` import in `root.ts`; a deleted-control leftover in the lane test), fixed without a mute, and the open-document `team.create` positive control replaced the dead variable. Lane 55/55, runtime typecheck clean. |
| `d6921d90`, `55482e4d` | Task 7.5 (partial): the v3-only fence `scripts/verify-blueprint-version-clean.mjs` **plus the test that calls it**, with a two-directional deferral list; `scripts/lint-identities.mjs` + root `lint:identities`; the fence's `.d.mts`; p4t6 pin moved by path. |
| `dad34225` | The 7.3 blast-radius measurement and the 7.6 receipts-as-run. |
| `60c300bc` | Task 7.6: the lint-identity leg found two identities this lane had introduced, fixed without a mute; `pnpm -r run typecheck` 8/8 with 0 `error TS`; the open-document `team.create` positive control replaces a deleted control (lane 55/55). |

## 3. What did not land, and exactly what is owed

1. **7.3 the flip.** Dry-run measured: `pnpm -r run typecheck` delta = 5 errors, all
   `=== 2` comparisons in `packages/runtime` that the narrowing proves dead
   (`activation/provider.ts:821`, `admission/requirement-gate.ts:460`,
   `compatibility/blueprint.ts:81`, `requirements/creation-preflight.ts:217`,
   `requirements/scope-requirements.ts:108`) — **none in Task 7's `Files:` rows**.
   Then 77 files that parse a v1/v2 document go red and 140 more keep a lying
   literal (measured with the plan's predicate: 217 files; pre-flight said 110/39 at
   `11e1609c`). Paying for it is Task 7.4.
2. **7.4 the fixtures.** The fence's deferral list is the machine-checked inventory
   for its own scope (20 files / 49 sites, each annotated with its lane); the wider
   77-file parser set is listed by path in `.scratch/gates/7-3-setB-red-refined.txt`.
   Compatibility-by-subject tests must be deleted or inverted, not retargeted.
3. **7.5 the one deletion.** `leaderEnvelopeCoverage`
   (`governance/permission-mutation.ts:1368`, called `:1339`) has **no production
   caller** — only three test files and one source-shape pin — so the sanctioned
   deletion is a test-surface change in files outside Task 7's rows.
   `effectiveAuthorityCeiling()` / `narrowingForApproval` untouched, as required.
4. **7.5 `clsx`.** `pnpm add clsx --filter @dsh-agent-team/client` cannot run here
   (pnpm cannot open its store index outside the writable workspace; approval prompts
   are disabled). Manifest and lockfile deliberately untouched — a hand-edited
   `pnpm-lock.yaml` would look done and break `--frozen-lockfile`. Consequence:
   `pnpm smoke:composition` was not run and nothing here claims the A1.2.7 leg is
   passable.
5. **7.6.** Run and passing: **`pnpm -r run typecheck` = 8/8 `typecheck: Done`, 0
   `error TS`, exit 0**; **the whole-repo lint identity diff = `new 0, resolved 0`** —
   and its FIRST run reported `new 2`, both authored by this lane (a dead
   `parseBlueprint` import in `root.ts`, a deleted-control leftover in the lane test),
   both fixed without a mute, which is the argument for the normaliser being a script.
   Whole-repo failed-test identities identical to baseline (19 = 19, same six files,
   same per-file counts); runtime suite identity-identical to its baseline; the three
   PR7 lanes green (55 / 9 / 10); the fence's own scan output. One new 0-test suite
   (`packages/tools/test/c1-list-pending-control.test.ts`, cause not claimed, details
   in the receipts note). **Not run:** root `pnpm test` twice, the client lane,
   `pnpm build` / `build:composition` / `check:artifacts` / `smoke:composition`,
   Remote 1–8.
6. **`docs/STATUS.md`** is in Task 7's `Files:` list but `docs/**` is off-limits to
   this writer → hand-off, not an omission.

## 4. Rulings the coordinator owes before the flip (not workarounds)

1. **Remote v8 catalog gap** (from 7.1): the catalog payload carries
   `{blueprintId, revisions}` with no `migrationRequired`
   (`s6-remote.ts:2398-2415`; `packages/remote/src/handlers/ports.ts:51-56` gets no
   protocol version; `p8t3-version.test.ts:62-90` pins byte-identity). Migration
   discoverability is real in-process and invisible over the wire until adjudicated.
2. **Wire representability of the document refusals** (from 7.2):
   `BLUEPRINT_MIGRATION_REQUIRED` is flattened to `internal-error`/`untyped-error` by
   the dispatcher's closed-code law. PR6's fourth governance arm
   (`TEAM_START_MIGRATION_REQUIRED`, reached by flipping `bridge` in host.ts's
   `createGovernanceWarningService`) is the designed wire path and should flip
   *together with* §3.1's constants.
3. **`Files:`-list widening**: the five `=== 2` runtime files, the A1-18 test files,
   the three `leaderEnvelopeCoverage` test files.
4. **`matcherCovers` disclosure** (carried from 7.0, still open): `routeOperationApproval`
   hardcodes `matcher: { kind: 'exact', resource: resourceKey }`, so a shell-class
   narrowing declared at fingerprint shape is invisible to the ASK and to the 7.0
   recheck that reuses the ask's point.

## 4b. Two operational hazards, recorded because they cost real time

- **The repository tracks a scratch artifact**:
  `.tmp-t12a-b2-home/sessions/test-profile/session-team-child-0921…/session.jsonl.zstd`
  is a tracked file inside a scratch directory, so the documented remedy for the
  `.tmp-fault` flake class — clear the scratch residue — deletes TRACKED content and
  surfaces as a working-tree deletion. Restored here (`git ls-files .tmp-t12a-b2-home`
  = 1, tree clean); hygiene should `git rm --cached` it. A committed scratch tree is a
  trap for every later writer and a plausible mechanism for the stale-medium failures.
- **`.tmp-fault` contains zero tracked files** (measured), so clearing it cannot
  explain the new `c1-list-pending` failure — stated to stop the next writer chasing
  that theory.

## 5. What Task 7.7 needs from a human

Re-issue the deferral with an owner, a trigger and a dated receipt; run the Remote and
real-host kits (Remote 1–8, the real-host smoke kits) in an environment that has the
test-use CLI dist, Playwright browsers and Chrome; and accept explicitly that until
7.3+7.4 land there is no v3-only product to accept. Record
`PR7 merged` / `Alpha.4 implementation` / `Alpha.4 human acceptance` / `stage closure`
as four separate lines, as in §1.
