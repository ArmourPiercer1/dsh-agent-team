# S7-R4 result — P8-S7-R4 handoff/fork repair cluster (13 coverage-matrix rows)

Branch `task/P8-S7-R4-handoff-fork` @ worktree `.worktrees/P8S7-R4`, base int tip `f04f583c3207e1141bc41b2268678915f36af9db`.
Commits: impl (source + tests, 11 modified + 6 new files); evidence = this file's commit (branch tip).
Test totals: base **2058** (measured FRESH on the pristine base via stash — the task card's "2058+N" is confirmed; the 2058 figure is not stored in any repo artifact, only measurable) + **33 new** = **2091** (handoff-surface 7 + handoff-wiring 8 + bc22-idempotency 4 + bc23-24-no-mutation 4 + fork-describe 10).
CORE PATCH BUDGET 0 honored: no upstream change, no new remote method/category/factType (catalog stays v1-CLOSED 9 categories / 23 methods), nothing under `packages/remote/**`, `storage`, `domain`, `client`, `legacy`, `tools`, or `root-binding` touched.

## Work items

- **W1 (A28 un-fail-close)** — the THREE handoff production ports are wired in the single production assembly point (`createTeamProductionRoot`): `sourceSurface` (the DSH public `sessionQuery` read, verified at use time), `summarizer` (pure one-shot non-model digest), `teamCreation` (fresh-root binding path reused for handoffs). `packages/runtime/src/plugin/root.ts` L1018-L1037 (ports), L937-L955 (`resolveSessionQuery` — use-time check, fail-closed `TEAM_HANDOFF_SOURCE_SURFACE_UNAVAILABLE` when absent), L965-L1016 (`createHandoffTeam`: deterministic mint `session-handoff-<sha256(intentToken) hex40>` L975, conditional provenance pre-put L989, `bindFresh` L1003, no-durable-writes → `TEAM_HANDOFF_TEAM_CREATION_UNAVAILABLE` L1011).
- **W2 (BQ-17 read surface)** — `describeOperation` on the handoff service (pure registry read; unknown pair → `known: false`, not an error): `packages/runtime/handoff/service.ts` L343-L375, view type `HandoffOperationView` `packages/runtime/handoff/types.ts` L374; exposed on the root as `handoffRead.describe` joining the in-memory operation view with the durable provenance record: `root.ts` L1045-L1072 (join at L1060-L1061).
- **W3 (BQ-18 fork reconciliation read)** — `fork.describe` with the EXACT five states: `ordinary` / `root-fork-reconciled` / `root-fork-recovering` / `member-fork-ordinary` / `integrity-conflict`. `root.ts` L818-L920 (states at L919 ordinary, L882 reconciled, L891/L901 recovering record-only/not-reconciled, L912 member-fork-ordinary; conflicts at L829 binding-without-record, L840 parent-binding-without-record, L850 blueprint-mismatch, L873 reconciled-child-carries-members).
- **W4 (BQ-16 provenance)** — additive optional record field `handoffSourceSessionId`: `packages/contracts/src/dto/team-session-record.ts` L87 (interface field), L59 (closed field list), L24/L105 (doc); written once at handoff creation (`root.ts` L989); projected through `rootFactsOf` (`projection-source.ts` L400-L422, wired at L338) — see "P12 deviation" below.
- **W5 (BC-22 verify)** — retry/re-drive semantics verified and pinned: BC-22's retry is carried by `handoff.create` idempotency per `(sourceSessionId, requestToken)` — see below.
- **W6 (BC-23/BC-24 verify)** — the failure triad decisions are CLIENT-SIDE in v1; the module performs NO backend mutation on decision — see below.

## 13 coverage rows → anchors → tests

Rows from the frozen closure plan (`docs/plans/active/DSH_Agent_Team_vNext_P8-S_Backend_Closure_Plan_20260831.md` §M/§P/§Q, lines cited).

| Row | Plan line (behavior → required surface) | Item | Production anchor (worktree) | Pinning tests (suite › it) |
|---|---|---|---|---|
| M11 | L2200 handoff/fork provenance → BQ-16 | W4 | contracts dto `team-session-record.ts` L87/L59; `root.ts` L965+L979 (pre-put) + L989 (conditional provenance); `projection-source.ts` L338+L400-L422 | wiring › S3 (durable record carries provenance); bc22 › S1 (fresh op carries handoff provenance) |
| P02 | L2250 Start Team from Here → BC-21 | W1 | `root.ts` L1018-L1037 (A28 triad un-fail-closed; L1034 `createTeam → createHandoffTeam`); `service.ts` L195-L280 (`startTeamFromHere`) | wiring › S1 (completes end-to-end, no `HANDOFF_*UNAVAILABLE`); wiring › S7/S8 (absent service still fails closed, both codes) |
| P05 | L2253 one-shot source snapshot → backend handoff | W1 | `handoff-surface.ts` L154 (`readCanonicalSourceSurface` — EXACTLY-ONE freeze); `root.ts` L937-L955 (use-time `sessionQuery` check); `service.ts` L92-L95 + L219-L222 (same-token replay re-reads NOTHING) | surface › S1 (exactly-once read + model-visible mapping); wiring › S1 (`s1ReadCount` snapshot = 1); bc22 › S2 (zero re-read on replay) |
| P06 | L2254 summary preview/status → BQ-17 | W2 | `service.ts` L343-L375 (`describeOperation`, `context-frozen` status); `root.ts` L1045-L1072 (`handoffRead.describe`); `s6-remote.ts` L392-L398 + `root.ts` L1302 (`handoffPrepare` producer wired) | wiring › S2 (join of operation view + durable provenance) + S5 (remote prepare returns the deterministic digest); surface › S4/S5/S6/S7 (digest determinism + exact bullet literals) |
| P07 | L2255 Retry without reread → BC-22 | W5 | `service.ts` L282-L341 (`resolveHandoffDecision`); L323-L326 (RETRY → `summarizeAndCreate` from the FROZEN `record.surface`); L397-L446 (`summarizeAndCreate`); L224-L229 (creation-failed re-drives `createOnly(existing)` ONLY) | bc23-24 › S3 (retry re-summarizes once from the frozen snapshot; `readCount` stays 1); bc22 › S3 (creation-failed re-drive: same intentToken, no re-read, no re-summary) |
| P08 | L2256 Continue without handoff explicit → BC-23 | W6 | `service.ts` L327-L331 (CONTINUE_WITHOUT_HANDOFF → `creationMode='without-handoff'` → `createOnly` — no re-summarize); `service.ts` L490-L507 (`buildIntent` — the §7.2 `handoff` provenance is ABSENT on this path) | bc23-24 › S2 (completes without handoff; the staged intent has `handoff === undefined`) |
| P09 | L2257 Cancel → BC-24 | W6 | `service.ts` L332-L339 (CANCEL flips the in-memory state to `canceled` — the ONLY effect; the creation port is never invoked) | bc23-24 › S1 (cancel → `canceled`; `creation.callCount` snapshot + final = 0; finalized re-decision → `OPERATION_ALREADY_FINALIZED`; unknown → `OPERATION_UNKNOWN`) |
| P11 | L2259 new Root created → BC-03/BC-21 result | W1+W4 | `root.ts` L965-L1016 (deterministic mint L975; pre-put L979; `bindFresh` L1003 → record + team-root binding + v2 LeaderInstance) | wiring › S1 (mint matches `^session-handoff-[0-9a-f]{40}$`) + S6 (remote `handoff.create` mints the same root) |
| P12 | L2260 provenance visible → BQ-17/BQ-16 | W2+W4 | `root.ts` L1046-L1072 (`handoffRead.describe` spreads the durable `createdTeam` incl. `handoffSourceSessionId` L1060-L1061); `projection-source.ts` L338 | wiring › S2 (`createdTeam.handoffSourceSessionId` = source id) |
| Q02 | L2270 root fork same Blueprint snapshot → reconciliation + BQ-18 | W3 | `root.ts` L844-L864 (same-snapshot check `sameSnapshotRef`; mismatch → `integrity-conflict/blueprint-mismatch` with `details.parent`/`details.child` full refs) | fork-describe › S8 (mismatch conflict with both refs exact); wiring › S3 (the handoff root keeps the row's blueprint ref — no mismatch) |
| Q03 | L2271 root fork zero MemberInstances → BQ-04/BQ-18 | W3 | `root.ts` L867-L884 (memberless → `root-fork-reconciled {memberCount:0, durableWrites:2}`; member-carrying → `integrity-conflict/reconciled-child-carries-members {conflict, memberCount}` L873-L874) | fork-describe › S5 (reconciled, 0 members) + S9 (member-carrying conflict, memberCount 1); wiring › S4 (the handoff root — a FULL fresh team with the v2 LeaderInstance — is pinned as `reconciled-child-carries-members` memberCount 1, NOT `root-fork-reconciled`) |
| Q04 | L2272 transient recovering state → BQ-18/BQ-20 | W3 | `root.ts` L888-L902 (record without binding → `root-fork-recovering {phase:'record-only', durableWrites:1}`; binding without reconciled record → `{phase:'not-reconciled'}`) | fork-describe › S3 (record-only) + S4 (not-reconciled) |
| Q06 | L2274 member fork stays ordinary → BQ-01/BQ-18 | W3 | `root.ts` L905-L919 (team-member binding → `member-fork-ordinary {rootSessionId, instanceId}`; no binding → `ordinary {}`) | fork-describe › S2 (member-fork-ordinary) + S1 (ordinary) |

## W5 — BC-22 verification (retry carried by `handoff.create` idempotency)

Verified against `packages/runtime/handoff/service.ts` (citations above):

- Operation registry key = `(sourceSessionId, '\u0000', requestToken)` (`operationKey`, L650) — an in-memory map with NO durable state (`service.ts` L40-L46: "the module owns no durable state; TeamDomain … sole durable authority").
- Same-token replay set = `completed` / `completed-without-handoff` / `canceled` / `awaiting-decision` → `{...stored, replayed: true}` with ZERO re-read / re-summary / re-creation (L92-L95, L219-L222).
- `creation-failed` → re-drives `createOnly(existing)` ONLY (L224-L229): the frozen context is never re-summarized; the mint is a deterministic function of the stable `intentToken` (`root.ts` L975), so the re-drive lands on `bindFreshTeamRoot`'s existing-record branch (`root.ts` L963) — idempotent by construction.
- Remote level: `handoff.create` routes through the same service, so the remote surface inherits the idempotency (`s6-remote.ts` handoff routes; `root.ts` L1483-L1495).

Pinning tests: `p8s7r4-bc22-idempotency.test.ts` (S1 fresh: read 1 / summarize 1 / create 1 + provenance; S2 same-token replay: zero re-read/re-summary/duplicate, `replayed: true`; S3 creation-failed re-drive: `callCount` snapshot 1 → final 2, `readCount` 1, `summarizeCount` 1, both intents same token; S4 `describeOperation` known/unknown) and `p8s7r4-handoff-wiring.test.ts` S6 (remote `handoff.create` ×2 same token: first `replayed:false`, second `replayed:true` same root; source reads 1+1+1=3 total; exactly ONE durable record for the mint; store total 3 records).

## W6 — BC-23/BC-24 verification (client-side decisions, NO backend mutation)

Verified: the v1-CLOSED catalog (frozen `packages/remote/src/contracts/catalog.ts` L81-L82, L108: the handoff category is EXACTLY `handoff.prepare` + `handoff.create`; 9 categories / 23 methods; ZERO method names containing `resolve` or `decision` — asserted by `p8s7r4-bc23-24-no-mutation.test.ts` S4 against the live catalog object). Decisions therefore CANNOT cross the remote surface; they are client-side calls to the in-process `resolveHandoffDecision` (`service.ts` L282-L341):

- **BC-23 (P08 continue-without-handoff)**: `createOnly` with `creationMode='without-handoff'` (L327-L331) — the standard creation entry, the staged `TeamIntent` carries NO `handoff` provenance field (`buildIntent` L490-L507) → no handoff provenance enters the durable world. Test: bc23-24 › S2 (`intent.handoff === undefined`; one standard creation call).
- **BC-24 (P09 cancel)**: the decision flips the in-memory record to `canceled` (L332-L339) — the module's only team-adjacent effect channel (`teamCreation`) is never invoked. Test: bc23-24 › S1 (cancel after a failed summarization: `creation.callCount` 0 at snapshot AND final; replay stays `canceled`; second decision → `OPERATION_ALREADY_FINALIZED`; unknown op → `OPERATION_UNKNOWN`).
- One-shotness: finalized states reject re-decisions (L304-L312); `creation-failed` is NOT decidable — it demands a re-drive (L313-L318).

No backend mutation is possible from a decision: the registry is in-memory (no seam writes) and the only outbound effect channel is the creation port, which cancel never touches and continue-without-handoff touches only through the standard entry.

## W4 — BQ-16 provenance decision

Chosen: **additive optional record field `handoffSourceSessionId`** on the existing `TeamSessionRecord` DTO + `rootFactsOf` projection — NOT a new factType (the dispatch audit allowed "优先既有 factType + provenance 字段，非必须新 factType"). The handoff module keeps owning NO durable state; the field is written ONCE at creation (`root.ts` L989, conditional — present only when the intent carries `handoff` provenance) and read back through `handoffRead.describe` (W2) and the projection fold (P12 row).

## W3 note — a handoff root is NOT a fork sidecar (integrity-conflict pin)

`fork.describe(source, mintedHandoffRoot)` returns `integrity-conflict` / `reconciled-child-carries-members` (`memberCount: 1`), intentionally: a fork sidecar is memberless by construction (`root-fork-reconciled` = record + team-root binding, `durableWrites 2/2`, 0 members — `root.ts` L879-L884), while a handoff-created root is a FULL fresh team — `createHandoffTeam` pre-puts the record AND runs `bindFresh`, which mints the v2 LeaderInstance (one member). The distinction is pinned by `p8s7r4-handoff-wiring.test.ts` S4 so a future regression that conflates "handoff root" with "settled fork" fails loudly.

## P12 deviation (documented)

The OUTER `TeamDomainProjectionSource` return does NOT gain a top-level `handoffSourceSessionId` key (the type is undeclared there and the fold never reads it); only `rootFactsOf` (`projection-source.ts` L400-L422, wired at L338) carries the field, matching the plan row's "provenance visible" surface (BQ-17/BQ-16 are both served — the BQ-17 read surface is the primary channel). The site-1 comment at `projection-source.ts` L354-L356 records: "NOT exposed at the top level by design".

## Acceptance summary

1. **Fresh chain, pristine base** (stash → clean tree @ f04f583 → full chain → pop): **2058 passed / 0 failed** — `S7R4-chain-base.log`.
2. **Fresh chain, work**: **2091 passed / 0 failed** (= 2058 + 33) — `S7R4-chain-work.log`.
3. **tsc 8-set** (client, contracts, domain, remote, runtime, storage, testkit, tools; legacy has no `tsconfig.json`): **0 fails / 8** — `S7R4-tsc-8set.log`.
4. **DIST recipe**: runtime `dist` + yaml junction absent at start (nothing to wipe) → `tsc -p packages\legacy\tsconfig.build.json` exit 0 (legacy emits INTO `runtime/dist` by config; `packages/legacy/dist` stays ABSENT — verified) → `tsc -p packages\runtime\tsconfig.build.json` exit 0 → `mklink /J packages\runtime\node_modules\yaml packages\domain\node_modules\yaml` (reparse-point verified; files resolve through the junction — first attempt failed only because `packages\runtime\node_modules` did not exist in this worktree; created the parent, junction then created cleanly) → **full chain over rebuilt dist: 2091 / 0** — `S7R4-dist-chain.log`.
5. **LIVE** (`node packages/tools/harness/run.mjs --scenarios E1,E2,E3,E4,E5,E6,E7,W1,W2,W3,W5,W7,M1,M2,M3,M4,M5 --port 3181 --dsh-home .dsh-test-p8s7r4 --dsh-home-e .dsh-test-p8s7r4-e`, report dir `references\S7R4-live-report` fresh under `references\`): preflight :3080 = 200, homes fresh (verified absent pre-run), ports 3181-3186/3492-3495 free pre-run → **summary `pass: true`, 17/17 scenarios, 104/104 assertions, `failures: []`**; postflight :3080 = 200, lock released, ports freed — `S7R4-live.log` + `S7R4-live/summary.json` (report copied from `references\S7R4-live-report`).
6. **test-use**: `git -C references/deepseek-harness-test-use status --porcelain` EMPTY; HEAD unchanged at `cd5ef8148158c3a752a658978873241fdf8e2bbc` (verified pre-run AND post-run).
7. **p4t6 scan pin**: 537 → **543** (+6 files: `handoff-surface.ts` + 5 test files) — `packages/testkit/test/p4t6-session-event-scan.test.ts` (title + comment block + both asserts).
8. **Contract surface**: NO new remote method / category / factType; catalog v1-CLOSED 9/23 untouched; `packages/remote/**` byte-identical to base; NO `BLOCKER:CONTRACT_CHANGE_REQUEST` condition triggered.

## Changed files (vs `f04f583`)

Modified (11):
- `packages/contracts/src/dto/team-session-record.ts` (W4: optional `handoffSourceSessionId` — interface L87, field list L59, docs L24/L105)
- `packages/contracts/test/types.test.ts` (W4: field-set/roundtrip coverage for the new optional key)
- `packages/runtime/handoff/types.ts` (W2: `HandoffOperationView` L374 + `describeOperation` interface L161)
- `packages/runtime/handoff/service.ts` (W2/W5/W6: `describeOperation` impl L343-L375; decision/registry/re-drive paths verified at L92-L95, L219-L229, L282-L341, L397-L446, L454-L487, L490-L507, L650)
- `packages/runtime/handoff/index.ts` (W2: export surface)
- `packages/runtime/src/plugin/host.ts` (W1: `getSessionQuery` public-seam reader L464)
- `packages/runtime/src/plugin/root.ts` (W1/W2/W3/W4: A28 ports L1018-L1037, `resolveSessionQuery` L937-L955, `createHandoffTeam` L965-L1016, `handoffRead` L1045-L1072, `forkDescribe` L818-L920, `handoffPrepare` wiring L1302, facade L1458-L1488)
- `packages/runtime/src/plugin/s6-remote.ts` (W2: `handoffPrepare` producer option L392-L398)
- `packages/runtime/src/plugin/types.ts` (W2/W3: `fork.describe` + `handoffRead` on the root surface, L87-L90 + L395-L398)
- `packages/runtime/src/plugin/projection-source.ts` (W4: `rootFactsOf` conditional spread L400-L422 + wiring L338; top-level NOT exposed by design, L354-L356)
- `packages/testkit/test/p4t6-session-event-scan.test.ts` (pin 537→543 + P8-S7-R4 narrative)

New (6):
- `packages/runtime/src/plugin/handoff-surface.ts` (W1: pure module — `readCanonicalSourceSurface` L154, `summarizeSourceSurface` L212, `truncate`)
- `packages/runtime/test/p8s7r4-handoff-surface.test.ts` (7 its)
- `packages/runtime/test/p8s7r4-handoff-wiring.test.ts` (8 its)
- `packages/runtime/test/p8s7r4-bc22-idempotency.test.ts` (4 its)
- `packages/runtime/test/p8s7r4-bc23-24-no-mutation.test.ts` (4 its)
- `packages/runtime/test/p8s7r4-fork-describe.test.ts` (10 its)

No files added under `packages/runtime/handoff/` (the p7t5 4-file pin is preserved — `handoff-surface.ts` lives in `src/plugin/`).

## Residuals

- The `p4t6` narrative and the two count asserts were bumped in ONE commit with the impl (the scan would fail otherwise); no other cross-task file was touched.
- `references\S7R4-live-report\` and the `.dsh-test-p8s7r4`/`-e` homes remain under the gitignored `references\` (consistent with every prior P8-S task); a copy of the report is committed under `dev/agent-workflow/evidence/P8-S/S7R4-live/`.
- Test totals for this branch are measured, not inherited: the base figure 2058 is reproducible from `S7R4-chain-base.log` (stash-run on the clean tree).
- The vitest-shim constraint (all module-top-level scenarios run before any `it` body) is worked around with top-level count snapshots in the new suites; this is a test-infrastructure property, not a production concern (documented in each suite's header comment).
