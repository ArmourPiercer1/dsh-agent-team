# S7-R2 result — P8-S7-R2 Projection query surface (bounded repair)

Branch `task/P8-S7-R2-projection-views` @ worktree `.worktrees/P8S7-R2`, base int tip `15da6b555bf27aee61b0d4f2f7f970f1c2e02672`.
Commits: impl `e1689c8` (source+tests, 30 files); evidence = this file's commit (branch tip).
Test totals: base 1985 + 60 new = **2045** (R2-1: 8, R2-2: 19, R2-3: 16, R2-4: 0 new — mapped into the R2-2 workspace lane, R2-5: 7, R2-6: 10).

## Acceptance C1–C8

- **C1 (R2-1, BQ-10 durable PolicyState) — PASS.** Durable policy-state lane: `packages/runtime/src/plugin/durable-mutation-store.ts` (root no longer reports the hardcoded blueprint default). 8 tests: `packages/runtime/test/p8s7r2-policy-state-durable.test.ts`.
- **C2 (R2-2, BQ-08 resolved effective-config view) — PASS.** Closed resolved view (value/source/state + DURATIONAL-optional keys): `packages/runtime/src/plugin/effective-config-view.ts` + `packages/contracts/src/projection/effective-config.ts`. 19 tests: `packages/runtime/test/p8s7r2-effective-config.test.ts`.
- **C3 (R2-3, BQ-11 model-state view) — PASS.** `packages/runtime/src/plugin/model-state-view.ts`; contracts `packages/contracts/src/projection/model-state.ts::parseMemberModelState` (closed field set, availability REQUIRED). 16 tests: `packages/runtime/test/p8s7r2-model-state.test.ts`.
- **C4 (R2-4, F11 workspace source provenance + remote resolver) — PASS** (mapped into the R2-2 workspace lane; no separate suite) — workspace cell provenance in the R2-2 view; remote resolver in `s6-remote.ts`.
- **C5 (R2-5, F12 residency `resuming`) — PASS.** Live glue owns the ephemeral per-session marker (`packages/runtime/src/plugin/live/agent-bindings.mjs` `resumingSessions` + `isResuming`); overlay reports `resident > resuming > cold`: `packages/runtime/src/plugin/s6-live-overlay.ts`. 7 tests: `packages/runtime/test/p8s7r2-residency-resuming.test.ts`.
- **C6 (R2-6, D14 DISPOSED retained history) — PASS.** Additive DURATIONAL-optional top-level `disposedHistory?` on v2 `TeamProjectionDto` (`packages/contracts/src/projection/disposed-history.ts` + `projection.ts`); built in `packages/runtime/src/plugin/projection-source.ts::disposedHistoryOf` (reuses the root ledger list read — zero extra repo calls; C2.3d call order preserved). 10 named tests: `packages/runtime/test/p8s7r2-disposed-history.test.ts` (byte-identity, exact entries, attribution closure, four negatives).
- **C7 battery — (4 legs):**
  - fresh chain: **2045/0, exit 0** — `S7R2-full-chain.log`.
  - dist chain (wipe runtime dist + yaml junction → tsc legacy+runtime build → mklink junction → full chain): **2045/0, exit 0** — `S7R2-dist-chain.log`.
  - tsc 8-set (client/contracts/domain/remote/runtime/storage/testkit/tools): **8/8 exit 0** — `S7R2-tsc-8set.log`.
  - live E2E (17 frozen scenarios, port 3181, `--dsh-home .dsh-test-p8s7r2`): **PASS** — 17/17 pass=true, summary pass=true failures=[], test-use byte-clean, ports freed, :3080 200, lock released — `S7R2-live.log`, `S7R2-live/summary.json`.
- **C8** — this file + logs under `dev/agent-workflow/evidence/P8-S/` (worktree): `S7R2-{r21-verify,r22-runtime,r23-runtime,r25-runtime,r26-runtime,tsc-runtime-pre,full-chain,tsc-8set,dist-chain,live}.log`, `S7R2-live/` (scenario reports).

## RESIDUALS

- (a) R2-6 additive optional field vs new wire method: the frozen 23-method catalog and closed `team.getProjection` params forbid a new method/scope, hence presence-only normalizers both sides; key ABSENT iff zero DISPOSED rows.
- (b) R2-6 attribution is closed over the four addressing keys `{instanceId, targetInstanceId, recipientInstanceId, deliveredToInstanceId}`; future fact types with NEW payload keys would not be attributed (extension point); team-level facts never attributed.
- (c) R2-6 `disposedAt` ABSENT when not derivable from lifecycle facts (fail-soft; ISO-lexical max of `to === 'DISPOSED'` transitions).
- (d) R2-6 digests do not duplicate fact payloads (invariant 41); full facts via `team.getLedgerPage` over the entry's `firstSequence..lastSequence` span.
- (e) R2-6 `DISPOSED_CHILD_SESSION_ABSENT` is structurally unreachable (invariant 23: DISPOSED non-leaders require `childSessionId`) — retained as a fail-closed guard.
- (f) R2-5 the glue marker is not unit-testable in-chain (glue bundle's module-scope `@deepseek-ai/*` imports unresolvable in the test runner) — covered by the dist `node --check`/import smoke and the live E2E; the durable-child `childFactory` resume is intentionally unmarked.
- (g) R2-2 W2 approximation `lifecycle !== 'CREATED'` over-approximates the CREATED→DISPOSED edge (frozen lifecycle set).
- (h) R2-3 mutation-record-lane pending branch is production-unreachable; NOW-horizon origins unreachable at the pinned step 0; ND-03 out of scope by design.
- (i) tsc gate not run after prior-session R2 edits — latent type errors in owned files (contracts model-state literal, projection-source scope, three p8s7r2 tests); fixed this session, tsc 8/8 green.
- (j) Pre-existing flake: one full-chain run had `p6t1-parallel` 2/9 fail ("actual toBe 0 — actual: 1"); next run fully green (2045/0).
- (k) Cosmetic header note in `projection-source.ts` skipped (edit-tool match anomaly; no behavioral impact).

## Main-agent notes before cherry-pick

- **storage package: NO touch** — the existing port expressed every write; `packages/storage` diff is empty.
- Premise-updated (non-new) tests: `p8s6-remote-commands`, `p8t1-projection-negative`, `p8s6-projection` (three updates: R2-2 v2 entries, R2-3 modelState field set, R2-5 isResuming fakes), `p8s5a-stub-glue.mjs` (24-key surface), `p4t6-session-event-scan` (pin 525→535).
- **contracts v2: no CHANGELOG section added** — deferred to the main agent at cherry-pick (`packages/contracts/CHANGELOG.md` was frozen for this task).
- `capabilityValuesOf` behavior change: allow decisions with unspecified scope are dropped (observable only through the R2-2 view).
- R2-3 parse order: `availability` validated before `current`/`provenance` (type fix); observable only for multi-field-malformed inputs (not pinned).
