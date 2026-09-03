# P9-T4 evidence — client: add ledger cursor store and vNext UI adapters

Plan authority: frozen P9 plan §6.4 (ledger cursor store) + S2-C/G2 (gate
invariants) + §7.1–§7.4 (UI adapters) + S3 (UI snapshot shape) + §5 (layout).
Branch `task/P9-ui-legacy-reuse`, worktree `.worktrees/P9`. CORE PATCH BUDGET
remains **0**; no frozen-contract edits; `references/deepseek-harness-test-use`
untouched (linked for type resolution only).

## Deliverables

Six new modules (2175 LOC) + four new specs (1304 LOC); 20 import-line swaps;
one test-kit pin update.

| file | LOC | role |
| --- | --- | --- |
| `packages/client/src/model/team-view-compat.ts` | 233 | legacy-faithful compat bridge (types + `resolveTeamView` value); `@deprecated`, removed end of T6 |
| `packages/client/src/model/team-ui-snapshot.ts` | 286 | S3-A/B UI snapshot types (§7 display model) |
| `packages/client/src/model/projection-adapter.ts` | 214 | wire `RemoteProjectionValue` → `TeamProjectionDto` → `TeamUiSnapshot` |
| `packages/client/src/model/ledger-adapter.ts` | 425 | ledger entries → rows/chains/messages/intervals/progress (§7.3/§7.4 gates) |
| `packages/client/src/state/team-session-resolution.ts` | 102 | `resolveTeamProjection(mirror, sessionId)` → `{team, perspective}` |
| `packages/client/src/state/team-ledger-store.ts` | 315 | `createTeamLedgerStore` — frozen-tracker-backed cursor store |
| `packages/client/test/team-session-resolution.test.ts` | 160 | 9 tests |
| `packages/client/test/projection-adapter.test.ts` | 331 | 14 tests |
| `packages/client/test/ledger-adapter.test.ts` | 412 | 23 tests |
| `packages/client/test/team-ledger-store.test.ts` | 401 | 13 tests |

## Design decisions (recorded for the gate)

1. **Compat bridge — Option C.** Legacy-faithful types plus the VALUE
   `resolveTeamView`; all 20 kept-file changes are import-line-only. Red-line
   distinction: the bridge lives in `packages/client` and types the KEPT
   verbatim UI; it does NOT copy legacy `packages/team` source into the root
   `packages/` (documented in the bridge header + this note).
2. **`RpcError` is an OPEN envelope** `{code: string; message: string;
   details?: unknown}` — not aliased to the frozen `RemoteErrorResult`: the
   frozen `RemoteErrorDetails` requires `method`/`endpoint`/
   `contractVersion`/`requestToken`, while the kept legacy bodies (and their
   spec stub shapes, incl. the `transportError: 'internal'` carrier) treat the
   error as an opaque `{code, message, details?}`. The store's typed path
   stores the frozen `RemoteResponse` envelope intact (identity-proven in
   tests); the bridge `RpcError` serves only the kept legacy bodies until
   T5/T6 migrate them off.
3. **`SessionId = string` (bare)** in the bridge — the kept legacy bodies use
   bare strings. Exactly ONE framework-branded boundary exists repo-wide in
   T4: the `viewProps` helper in `team-view.client.spec.tsx` casts
   `sessionId as TeamViewProps['sessionId']` because `PropsRuntime` carries
   the framework branded `SessionId` into the slot props (pre-T4 the
   unresolved-module `any` masked this).
4. **Contracts are type-only imports** (`../../contracts/src/index.js`,
   `../../remote/src/index.js` — the two-level depth from `test/`; the
   `../../../` depth is for `src/model/`/`src/state/`). Exactly TWO
   `as unknown as` boundary narrowings in all T4 code: `projectionFromWire`
   (wire mirror → DTO) and the store's page lift (`response.value.data` →
   `RemoteLedgerPageValue`). Both documented at the boundary.
5. **store-link devDep**: `@deepseek-ai/dsh-client-store` (link, prebuilt
   lib/types) added to `packages/client/devDependencies` — the bridge
   re-exports `ObservableSnapshot` (type-only) used by the kept legacy bodies;
   same link-devDep pattern the T1/T2 legacy copy already used for the other
   reference client packages.
6. **verifyLedgerPageAnchor reused via the tracker.** §6.4 mandates reuse of
   `createLedgerPageTracker()` + `verifyLedgerPageAnchor()`; the store
   implements ZERO cursor-validity logic of its own. Every page passes
   `tracker.applyPage` (correlation guard + anchor checks) before merge; a
   reject becomes `state.error = {ok:false, reason: PageRejectReason}` and
   the page is NEVER merged.
7. **Tracker anchor vs frontier (frozen-tracker semantics, discovered
   against the pin).** The frozen tracker advances its anchor ONLY when
   `page.nextAfterSequence !== null`; terminal pages (null cursor) leave the
   anchor at the request's `afterSequence`. The store therefore tracks
   `completeThrough` = highest sequence loaded (the frontier), not
   `tracker.anchor`; `complete` iff `total !== null &&
   completeThrough >= total` (guards lying servers whose total exceeds the
   deliverable page range — no fetch loop).
8. **`refresh()` re-reads at the tracker's current anchor** (stable re-read;
   sequence-keyed dedupe absorbs overlap), never from 0.
9. **`continuePaging` loading-flag fix (src bug caught by the new tests).**
   Episode exit via `nextComplete` (cursor present but frontier ≥ total) used
   to publish `loading: !tailReached` = true and return — loading stuck with
   no episode in flight. Fixed: `continuePaging = tailReached === false &&
   nextComplete === false`; publish `loading: continuePaging`; every exit
   publishes `false`.
10. **Publish-by-reference semantics.** `entriesBySequence` (ReadonlyMap) is
    published by reference and mutated in place; `notify` is the change
    signal, not a new-object signal. Tests must capture scalars before a
    mutating op (the reset spec captures `beforeSize` as a number before
    `reset()` — a live-map read after reset would read 0).
11. **State-sketch widening (deviation, documented).**
    `TeamLedgerState.teamSessionId: string | null` — null before first open /
    after reset; the plan sketch implies a bound team id. Documented in the
    module header; observable only pre-open/post-reset.
12. **Legacy `TeamView` → vNext surface mapping (T4):**

    | legacy (kept on bridge) | vNext (T4) |
    | --- | --- |
    | `TeamView` (leader-keyed) | `TeamUiSnapshot` (root projection + merged members + templates + perspective + ledger model) |
    | `TeamMemberView` | `TeamUiMemberInstance` (RAW lifecycle kept + derived `displayStatus`; live rows `fromHistory:false`) |
    | disposed history rows | merged into `members` (`fromHistory:true`, lifecycle `DISPOSED`, `liveActivity:null`) AND retained verbatim in `disposedHistory` (by reference) |
    | leader absent `childSessionId` | `null` (nav target = root session) |
    | `TeamApprovalView` | `TeamUiControlChain` (request + optional paired decision; `pending` flag) |
    | `TeamMessageView` | `TeamUiMessageRow` (delivered: NO `from`; coordination: `send-message` action only, `from`=caller) |
    | `TeamTaskView` | no T4 surface — progress facts surface as `TeamUiProgressRow` (complete-gated); task-board UI stays on the bridge until T5/T6 |
    | `TeamDelegationView` | no T4 surface — delegation facts surface as `TeamUiActivityIntervalRow` (correlation pairing) |

    `pendingControlCount`: projection level always `null` (§7.3 unknown until
    the ledger is known-complete); complete → per-instance count of unpaired
    control chains; partial → `null`. `progress` + `pendingControlByInstance`
    are complete-gated in `TeamUiLedgerModel`.

13. **Per-file import disposition (23 modified files).** 20 import-line
    swaps only (4 src/model, 6 src/ui, 10 test — `@dsh/dsh-client-runtime/
    client` → `./team-view-compat.js` / `../model/team-view-compat.js` /
    `../src/model/team-view-compat.js`); 1 spec additionally carries the one
    branded-boundary cast (#3); plus `packages/client/package.json` (+2
    devDeps), `pnpm-lock.yaml`, and the p4t6 pin (#15). The 4 excluded specs
    (`client-bundle`, `team-plugin`, `team-marker`,
    `team-marker-definition`) keep the legacy runtime import by design (T10
    drops them).

## G2 gate mapping (ledger-side)

| G2 invariant | enforced by | store behavior |
| --- | --- | --- |
| stale never overwrites | team guard (per-page team id check) | stale page dropped silently, never merged |
| foreign never overwrites | same team guard (binding on `teamSessionId`) | dropped |
| duplicate no-op | `entriesBySequence` Map key (sequence) | `map.set` merge — no reorder |
| page anchor mismatch rejected | tracker correlation guard (frozen) | unreachable via the store — the store always requests at the tracker's anchor; covered at frozen-module level by the P8 remote tests |
| page total cannot regress | tracker reject `total-decreased` (frozen) | reject → `state.error`, no merge |
| page exceeds limit rejected | tracker reject `page-exceeds-limit` (frozen) | reject → `state.error`, no merge |
| entry sequence deduped | Map key | same row as duplicate no-op |
| RPC errors remain typed | store stores the `RemoteErrorResult` intact | identity-proven in tests (`toBe`) |
| transport loss typed | store catch → `{ok:false, reason:'transport-loss'}` | only when the team is unchanged |

Provenance mismatch is projection-store-level (T3) — ledger pages carry no
provenance field, so it has no ledger-side counterpart.

## p4t6 pin update (DEC-1, per T3 precedent)

`packages/testkit/test/p4t6-session-event-scan.test.ts`: P9-T4 enumeration
block appended (+10 files: the six src + four test .ts) and the two count
assertions bumped 577 → 587. The it-title line was NOT touched (T3
precedent — it still reads "537 files scanned"). The frozen 21-entry
quarantine adjudication is UNCHANGED.

First full run flagged 5 denylist event-string tokens — all in JSDoc
comments I wrote in `team-view-compat.ts` (`team/progress` ×2,
`team/control-request`, `team/message`, `team/control-decision`); none in
type definitions or values. Decision: scrub the comments to neutral wording
("progress event" / "control request" / "message count" / "control
decision") rather than extend the frozen quarantine adjudication — the red
line + the T1/T3 precedent require new P9 scannable files to carry zero
denylist vocabulary, and JSDoc is not part of the faithful-shape contract
(types + `resolveTeamView` value remain 1:1). Note: the kept `.tsx` copy
(`TeamTasks.tsx` comment) is outside the frozen scanner's extension set and
stays verbatim. After the scrub all ten new files scan clean.

## Test strict-null clearance (new test files)

The four new specs were written after the last green full-face tsc run; the
runtime runner transpiles without type-checking and the cross-package test
imports were type-only (erased at runtime), so the suite ran green while tsc
was red. Clearance (89 → 0 errors):

- **(a) wrong relative depth ×3**: from `packages/client/test/`,
  `../../../remote|contracts/src/index.js` resolves to the workspace root;
  corrected to `../../…` (matches the T3 `team-projection-store.test.ts`
  depth). No runtime impact (type-only imports).
- **(b) `strict` + `noUncheckedIndexedAccess`** at ~25 index/`find` sites in
  three files: added a per-file `must<T>(value, label)` narrowing helper
  (explicit undefined-guard with throw — the repo test convention, cf.
  `packages/domain/compatibility/test/t5-complete-true.test.ts`
  `ackFor`/inline guards).
- **(c) TS2454** on the gated `let resolveA/rejectA` (switch-mid-flight
  scenario): throwing initializers — an un-armed gate is a test bug.
- **(d) TS2339** `wire.disposedHistory`: the frozen
  `RemoteProjectionValue` is the exact 9-field value and has no
  `disposedHistory` (v2-only, absent when none); the spec now holds the
  fixture array in a `history` const and asserts identity against it
  directly (also removes an `as never` cast; identical runtime assertion).

## Staged-red clearance (carried from earlier in T4)

Pre-swap staged tsc: 35 errors → 0 after the swaps: 23×TS2307 (legacy
`@dsh/dsh-client-runtime/client` unresolved) + 12 class-B strict
dissolutions via the bridge types; 2 genuine errors fixed (TS2352 store page
lift → documented two-step `as unknown as`; TS2322 the one branded-boundary
cast, #3).

## Gate results

- client runner-discovered specs: **87/87** (7 files: client 3,
  ledger-adapter 23, projection-adapter 14, team-ledger-store 13,
  team-projection-store 14, team-remote-client 11,
  team-session-resolution 9).
- full repo suite: **2254 passed / 0 failed**.
- tsc full face (`packages/client/tsconfig.json`): **0 errors**; tsc build
  face (`tsconfig.build.json`): **0 errors** (emitted gitignored `dist`
  removed).
- p4t6 scan suite: 10/10 (587 files scanned; zero violations outside the
  frozen 21-entry quarantine).
- jsdom `.client.spec.*` specs: untouched except the import swaps + the one
  spec-helper cast; they run out-of-sandbox (S8) only.

## No-silent-edit attestation

Frozen `packages/remote` contract untouched; `packages/contracts` untouched;
no CORE patches (budget 0); `references/deepseek-harness-test-use` pristine
(link-devDep resolution only); no pushes.
