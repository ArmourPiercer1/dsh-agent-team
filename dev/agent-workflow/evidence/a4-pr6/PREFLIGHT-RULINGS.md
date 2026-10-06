# A4-PR6 pre-flight rulings

Audit: `43c8cbab`, read-only, tree `ded2b0cf`. **Verdict: Task 6 is not executable as written** by a writer who reads only Task 6. This file is the ruling record; the **operative `Files:` block in plan Task 6 is still unrepaired**, and per X11 it must be repaired *before* PR6 is dispatched. PR6 dispatch is gated on this file being folded into the plan text, not on reading this file.

## R1 — v8 reddens four test files, three named by no amendment (BLOCKING)

Adding contract version 8 breaks exact-equality version-set assertions in:

| file:line | assertion |
| --- | --- |
| `packages/remote/test/p8t3-version.test.ts:218` | `toEqual([1,2,3,4,5,6,7])`; negatives at `:99-103`, `:222` |
| `packages/remote/test/tcm-m1-remote-v2.test.ts:578` | `[1..7]` |
| `packages/remote/test/d1-remote-v3.test.ts:275` | `[1..7]` |
| `packages/runtime/test/t12m4-remote-mount.test.ts:281-283, 379-380` | `version: 8` → `contract-version-unsupported` |

Only `p8t3-version` appears in any amendment (`plan:798`); the other three are named nowhere, and Task 6's own gate step "Run Remote version regression 1-8" cannot pass without editing them. **Ruling: all four become unconditional `Files:` entries in Task 6.**

## R2 — `s6-principal.ts` and the A1-2 catalog-enumeration test (BLOCKING)

`plan:798` asserts in the past tense that the file list "gains" `packages/runtime/src/plugin/s6-principal.ts` — the X11 signature verbatim, fourth occurrence. The file exists (header `:2`). ADR A1-2 additionally mandates a catalog-enumeration test and a member-cannot-obtain-human-decision negative, with no checkbox and no named test file; `plan:806` requires invariant #16 to have "named tests, not prose". **Ruling: add `s6-principal.ts`, and name the negative test's home explicitly — `a4p6-remote-v8.test.ts` is the intended host.**

## R3 — client rendering layer: `INTERNAL_FACT_TYPES` is PR6's and is unlisted (BLOCKING)

`packages/client/src/model/team-ledger-model.ts` (`INTERNAL_FACT_TYPES` `:91-109`) and the renderer duty in `packages/client/src/model/ledger-adapter.ts` (`adaptEntry :343`, category lookup `:346`, abandoned-row case `:761`) are required by A5-7, A5-22 and `plan:861`, and are in neither Task 6 client block. Measured: **zero** tests reference `INTERNAL_FACT_TYPES` and zero pin proposal-row rendering, so a type registered in both category maps yet absent from `INTERNAL_FACT_TYPES` renders as a generic JSON-dumped Events row and **nothing goes red**. **Ruling: both files become unconditional entries; PR6 owes a renderer/visibility test for `governance-proposal-recorded` and for each new fact type it introduces.**

## R4 — `p4t6` and `tsconfig.build.json` duties absent (BLOCKING)

`p4t6-session-event-scan.test.ts:1782-1783` (`toBe(983)` ×2, derived pin `:1815`); scanner scope is `.ts/.mts/.mjs`, so Task 6's three new `.test.ts` files move the pin while its `.client.spec.tsx` files do not. `plan:300` assigns PR6 the `intervention/` dist include in `packages/runtime/tsconfig.build.json` plus its artifact co-commit; Task 6 names neither. **Ruling: both become entries.**

## R5 — files that must be *named*, not described

Task 6 currently says "Add … helpers" (`plan:528`) and a checkbox with no file (`plan:574`) for the Permission Administration view, and leaves `TeamInterventions.tsx`'s mount point unspecified (`TeamGovernance.tsx` is listed at `plan:527`; `TeamView.tsx:1359` is the mounting surface if top-level). Lane A's "runtime boundary observation hooks" (`plan:553`) names no file. **Ruling: PR6 dispatch requires every created file named in `Files:`; an unnamed Create is a plan defect, not writer latitude.** Conditional entries: `packages/runtime/governance/service.ts` (A5-14 pure diagnostic surface, if diagnostics do not live in `governance-warning/**`), `packages/client/src/ui/TeamLedger.tsx` (A5-20 disclosure), `packages/client/src/ui/TeamView.tsx`, and `a3p3-governance-lane-hygiene.test.ts` if new modules import the kernel.

## R6 — will-break client tests, two of them root-suite

`packages/client/test/team-governance.test.ts` and `ledger-adapter.test.ts` are **root-suite** `.test.ts` files — a red there is a root-gate red on a file the writer cannot edit. Also conditional: `team-d4-a1-ui-pull.client.spec.tsx`, `team-ledger-model.client.spec.ts`, `team-remote-categories.test.ts`. **Ruling: listed as conditional entries with the note that the first two are root-gate files.**

## R7 — nothing-would-go-red, PR6-specific

1. **Warning computed, never reaches the client** — no red; only PR6's own tests can see it.
2. **v8 field dropped at the wire seam** — `s6-remote.ts:2968-2970` copies only `changed`/`code`/`reason` through a closed whitelist (the PR5 finding, drifted +2 lines); client readers are fail-safe. **Assert at wire level, not service level.**
3. **`INTERNAL_FACT_TYPES` omission** — no red (see R3).
4. **One-map-only registration is NOT silent** — host miss throws (`projection-source.ts:798-801`); client miss is caught by guard C3 (`a4pr0a-fact-type-closed-set.test.ts:480`, root suite). Verified both directions.
5. **GovernanceWarning minted as a Control request/case, or a non-blocking stage returning `wait-for-response` and halting the Team** — no red; PR6 owns these tests.
6. **Start gate on the wrong path** — `activation/checks.ts` and `admission/requirement-gate.ts` exist and contain **zero** references to `ensureRootLive`/`startRootAgent`; a gate wired there gates nothing and nothing goes red.
7. **A ninth ledger category** moves `team-ledger.client.spec.tsx:400` (`toHaveLength(9)`) — **client-lane-only**, invisible to the root gate.

## R8 — A5-10 start-gate placement, verified placeable

Real path: `team.create` v1 `s6-remote.ts:2192` / v2 `:2334` → durable binding `:2280-2298` → `await startRootAgent(...)` at **`:2306` / `:2415`** (port `root.ts:3143`); resume path `team.ensureRootLive` (fail-closed preflight `s6-remote.ts:1687`, impl `root.ts:3155`). **Ruling: pin `:2306`/`:2415` and the `ensureRootLive` path into the brief**, because the wrong-path alternative is invisible (R7.6). `packages/testkit/domain/src/*` has zero production import edges — no testkit path is acceptable.

## R9 — human acceptance now has an owner

`A1.6` makes the Alpha.3 nine-step human pass (`ALPHA3-PERMISSIONS-USER-FACING.md` §8, `doc:193-240`) an Alpha.4 acceptance item executed against the PR6 Permission Administration surface, and "merge is not deployment" holds until recorded. Measured: **no Task 6 and no Task 7 checkbox executes it**.

**Ruling: assigned to Task 7's final gate** (PR7 is titled Full Alpha.4 Acceptance and already owns `evidence/alpha4-final/`) — execute §8's nine steps against the merged tree on a 3180-family instance, translating steps 4-5's v7 legs to v8 while **retaining the v7 compatibility leg**, with a dated human-executed receipt per step plus performer, or an A1.5-style non-blocking receipt for a live leg the environment blocks; PR6 owns only the precondition that the surface exists and is drivable. Declaring PR7 machine-only instead would ship Alpha.4 with an un-executed deferred precondition.

## R10 — dead text and citation drift to repair in place

- `plan:882` still ends "the Team-start governance gate is deferred (A2-15)" though A2-15's assignment is struck (A3-13, A5-10); dead text, dispatch poison.
- `plan:862` still says "the verified 19-file fixture inventory" against X10's measured **20** (and A5-9's 18).
- Task 3's "pin 983 at `:1783-1764`" is a reversed/garbled range → `:1782-1783`.
- ADR A5-7 cites `packages/domain/…/team-ledger-model.ts:91-108`; real path is `packages/client/src/model/team-ledger-model.ts:91-109` (lines right, package wrong).
- Drifted: `projection-source.ts:223`→**`:249`**, throw `:766`→**`:798-801`**, `FACT_ADDRESSING_KEYS :835-851`→**`:870+`**; `ledger-adapter.ts:330-337`→lookup **`:346`**, `:748`→**`:761`**; `p4t6 :1735-1736`→**`:1782-1783`**.

## R11 — client-lane brief text (verified correct)

Command `pnpm --filter @dsh-agent-team/client run test` is correct and sufficient (`packages/client/package.json:21` + `vitest.config.ts:185-189`, 4 legacy specs excluded `:195-198`). Capture client-lane counts **before and after** in PR6's own worktree; baseline 53 files / 853 tests, 3 pre-existing failures, of which exactly one lives in a file Task 6 updates — record the two `team-creation-panel` failures as **inherited, not inherited-blame**. State the tree (s3 spike is worktree-location-dependent; do not "fix" it). Close by the three names + no-new-failures, **not** by identity diff (`fail-set.mjs` has no client mode). Task 6's inline gate omits `pnpm build`, which shared rule 8 requires, and says "composition smoke" without naming `pnpm smoke:composition`; both fixed in the brief.

**Gate-script check:** no Task 6 step names a non-existent script. `build`, `build:composition`, `check:artifacts`, `smoke:composition`, `lint`, `typecheck`, `test` all exist; `check:composition` does not and is named by nothing except the refutation record.

## Audit scope limits (stated by the auditor, accepted)

No tests or client lane executed (read-only brief), so the 3-failure baseline is cited from the evidence README rather than re-measured; the t12m4/p8t3 reds were verified by reading assertions, not running them; the host map's exact end line, the `:403` fold call-site, and whether `packages/remote/src/contracts/semantic.ts` needs a v8 entry were not verified (no test pins `REMOTE_CATEGORIES`). No previously-refuted phantom is cited.
