# G8-REVIEW — Reviewer 1 (N=1) Report

- **Gate**: G8-REVIEW (Team-mode vNext, phase P8)
- **Reviewer**: 1
- **Worktree**: `.worktrees/G8-R1` (detached @ `93d2a96e3ded6a92820f78ee9de94eac9ea6fffb`)
- **Base for boundary diffs**: `959e36358ee7244ff8c7e1e0b8396e70dfef4562`
- **Pristine host tree**: `references/deepseek-harness-test-use` @ `cd5ef81481` (clean before and after)
- **Port**: 3181 (stable :3080 verified 200 before and after; never touched)
- **Method**: brief §0–§7 executed in order — detached worktree; six-step method; pristine-host browser-less remote e2e behind the external lockfile (`references/.dsh-test-g8.lock`, marker `G8-R1 <ISO>`, released on marker match).

## 1. Chain, typecheck, and boundary evidence

| Item | Result | Proof |
| --- | --- | --- |
| Chain run (plain-node, all 6 packages) | **1754 passed, 0 failed, 1754 total** (7127 ms) | `chain-rerun.log:198`, `CHAIN-DONE` at `:209` |
| tsc (separate `-p` per package) | contracts=0 domain=0 storage=0 runtime=0 testkit=0 remote=0 | `chain-rerun.log:202–207` |
| zero-core (a: node: imports in `packages/**/*.ts`) | **PASS** — 0 real imports in 461 files; the single mechanical hit is the synthetic positive-control string in `packages/runtime/test/p7t5-no-creation-scan.test.ts:42` (P7-T5 scanner test data, not an import) | `boundary-checks.log:7–11,138–142` |
| zero-core (b: patch/postinstall surface) | **PASS** — 0 mutation tokens, 0 lifecycle script keys, lockfile+root package.json diff vs base EMPTY | `boundary-checks.log:13–17,143–145` |
| zero-core (c: test-use upstream references) | **PASS** — 0 hits in .ts/.mts; all hits are .mjs harness/scan scripts carrying path strings, excluded by rule | `boundary-checks.log:19–54,146–149` |
| private-import | **PASS** — 0 import statements referencing upstream internals or the frozen fork; the 2 mechanical hits are doc comments in `packages/legacy/session-reader` (P7-T7) | `boundary-checks.log:150–152` |
| owned-boundary (base..HEAD, `packages/`) | **PASS with concern** — 74 changed files; 63 inside the brief's P8 globs; 11 new p8t1-/p8t2- **test** files outside the T1/T2 src-only globs (conventional placement, no cross-task write, program-wide precedent identical) — recorded as concern (7) | `boundary-checks.log:56–57,153–168` |
| Diff outside `packages/` | Only `dev/agent-workflow/evidence/P8-T*` additions (contents not read — blindness rule) | `boundary-checks.log:169–171` |
| Dependency scan (packages/remote) | S1 src/ purity **ALL PASS** (95 specifiers, all relative); S1.T **FAIL(2)** — exactly `packages/remote/test/p8t3-negative.test.ts` and `p8t4-negative.test.ts` → `../../testkit/fault-injection/session-event-scan.mjs` (test-only cross-package import, adjudicated concern (8)); S2.1 PASS (0 session-machinery code refs in src/); S3 PASS (12 ports, 11 handler modules); S4 PASS (closed catalog covers all UI-visible actions) | `dependency-scan.log:51–76` |

## 2. The six G8 criteria

### Criterion 1 — No SessionController Team mirror — **PASS**

Evidence (three independent proofs):
1. In-tree negative-scan suite (runs inside the 1754 chain): scans exactly the 28 `packages/remote/src` files; every import specifier relative; rules R1–R6 report zero violations; positive controls prove the scanner is non-vacuous; handler dependency surface pinned to exactly the 12 frozen `RemoteHandlerDeps` ports — "no SessionController mirror, no upstream session API" (`packages/remote/test/p8t3-negative.test.ts:1–17`).
2. Independent blind scan (this review): `PASS S2.1: zero CODE references to the session machinery in src/ (0)`; S2.2 = 0 doc-context mentions in src/; S2.3 = 4 test/config mentions, all classified `test-data-or-runner` (the p8t3 negative-scan suite itself) (`dependency-scan.log:51–58`).
3. E2E: every team capability was reachable only through the typed catalog endpoints on the pristine host; an uncatalogued endpoint returns `unknown-method` (run-7 `e2e-run.log:115–116`), i.e. there is no side door through a mirrored controller.

### Criterion 2 — Projection round-trip after reconnect — **PASS**

Evidence (run 7, `harness/e2e-run.log`):
- E1 first pull: `CHECK PASS E1: first frame verdict apply` / `applied generation 1` / `state connected` / `projection has exactly the nine frozen top-level fields` / `schemaVersion 1` / `teamSessionId echoes the root session` / `generation 1 (seeded)` / `generatedAt = the harness clock` / `blueprint snapshot ref present` / `blueprint id/revision` / `root compatibility BLOCKED_FATAL (seeded durable state)` / `root admission OPEN` / `creation budget 0` / `three templates` / `template ordering leader/worker/scout` / `two members (leader + worker)` / `leader member row WITHOUT childSessionId (invariant 14)` / `worker member row WITH childSessionId` / `both members RUNNING` / both members' `effectiveConfig carries the four frozen lanes` / ledger `latestSequence 7`, `totalEntries 7`, `sum(byCategory) === totalEntries`, `byCategory matches the seeded facts`, `pendingControlCount 1` / `frame provenance (origin/method/endpoint/version/token/generation)` (L24–50).
- E2 loss → reconnect: `loss verdict`, `state reconnecting after loss`, `transportLosses 1`, `backoff entry scheduled`; mutation while down still `200 ok (server unaffected)` (L52–56); `state connected after recovery`, `recovery applied generation 2`, `framesApplied 2`, `no unexpected rejections` (L64–67).
- Round-trip equality: `fresh raw pull shows generation 2` and **`applied projection deep-equals the fresh raw pull (round-trip)`** (L68–69); `no rpc-error assessments` (L70). `summary.json` sinkLog: `frame:1 → loss → frame:2 → frame:3`, `clientStats.framesApplied = 3`, `rpcErrors = 0`.

### Criterion 3 — Stale responses ignored — **PASS**

Evidence (E3, `e2e-run.log:71–79`): captured gen-2 frame → second append → `sync applies generation 3` → re-injected gen-2 frame verdict **stale** → `framesStale 1`, `applied generation unchanged (still 3)`, `rpcId correlation intact (no inconsistent)`, `framesApplied still 3`. Stale data is neither applied nor conflated with the live state; correlation integrity holds.

### Criterion 4 — Ledger pagination stable — **PASS**

Evidence (E4, `e2e-run.log:80–99`), pageLimit 3 over a 9-entry ledger, then growth to 10:
- Walk: `page 1 = seq 1-3` / `cursor 3` / `anchor advanced to 3`; `page 2 = seq 4-6, cursor 6` / `anchor advanced to 6`; `page 3 = seq 7-9, terminal cursor` / `anchor holds at 6 after the terminal page`; `tracker 3 applied / 0 rejected` (L82–91). Cursor semantics verified against the frozen handler (`packages/remote/src/handlers/team.ts:193–217`: `nextAfterSequence` = last sequence OF the page when more entries remain, else null).
- Growth: `growth append -> next sequence` (10); `off-anchor explicit re-read rejected by the tracker guard`; **`re-reading anchor 0 after growth yields the SAME page (stable slicer)`**; `total only moves up (append-only)`; `tracker rejected exactly the off-anchor page` (L92–96).
- Continuation: `cursor continues from anchor 6 and sees the growth page (next = last seq of page, 9)` / `anchor advanced to 9` / `the growth entry is served as its own terminal page` (L97–99). Stable under append; no page duplication or loss; the tracker guard rejects off-anchor pages by design.

### Criterion 5 — Typed error + provenance on every UI-visible action — **PASS**

Evidence — five domain/contract typed errors over the real pristine-host wire (run 7, exact JSON in `e2e-run.log:101–120`), plus the closed-catalog proof that every UI-visible action maps to a typed method:
- E5a `member.send` unknown instance → 200 `{"code":"TEAM_RUNTIME_INSTANCE_NOT_FOUND", …, "details":{"method":"member.send","endpoint":"member.send","contractVersion":1,"requestToken":"tok-g8r1-err1","reason":"domain-error","cause":{"code":"TEAM_RUNTIME_INSTANCE_NOT_FOUND", …, "details":{"rootSessionId":"session-root-g8r1","instanceId":"inst-missing9"}}}}` — domain code pass-through, source identity under `details.cause`, provenance folded in (L101–106).
- E5b `member.followup` new work under durable BLOCKED_FATAL → `TEAM_RUNTIME_COMPATIBILITY_BLOCKED` with gate details reporting the durable state (status/source/fingerprint) (L107–110).
- E5c over-255 `teamSessionId` → mirrored frozen P3 code `INVALID_ROOT_SESSION_ID` with `details.field = "teamSessionId"` (L111–112).
- E5d version 99 → `contract-version-unsupported` ("supported: [1]") (L113–114).
- E5e uncatalogued endpoint → `unknown-method`, `reason: "unknown-endpoint"` (L115–116).
- Success paths also carry provenance: E2 `provenance on the admission success (origin/method/requestToken echo)` (L62); E1 frame provenance (L50).
- Wire negatives (E6): no cookie → 401; wrong content-type → 415; method≠endpoint → 200 `bad-request` `method "member.send" does not match endpoint "team.getProjection"` `details:{issues:[]}` (L117–121). **GLOBAL: no HTTP 5xx anywhere in the run** (L122) and no unexpected transport rejections (L123).
- S4 scan: closed contract catalog covers all UI-visible actions (projections, ledger pages, admission effects send/follow-up, member lifecycle create/archive/restore/dispose) (`dependency-scan.log:66–74`).
- Positive enforcement observed while building this review: the frozen DTO rejected a harness-supplied empty template `displayName` with `MALFORMED_DTO` over the wire (preserved: `harness/e2e-run4-malformed-dto.log`) — the contract layer fails closed with provenance even against a non-conforming adapter.

### Criterion 6 — Remote contract versioned + tested — **PASS**

Evidence:
- Version discipline: `REMOTE_CONTRACT_VERSION = 1` and `SUPPORTED_REMOTE_CONTRACT_VERSIONS = [1]`, frozen by P8-T3, with the documented bump rule (add, never edit) (`packages/remote/src/contracts/version.ts:29–35`); every response (success or error) echoes the serving `contractVersion` in provenance/error details (module doc, `version.ts:16–17` — observed on every E1/E2/E5 wire response in run 7).
- Tested in-tree (part of the 1754 chain): p8t3 negative/version suites and p8t4 sync/transport suites; `packages/remote/test/remote.test.ts`.
- Tested on the wire (run 7): E5d `contract-version-unsupported` for version 99 with `supported: [1]` echoed (L113–114); E5e closed-catalog enforcement (L115–116); E6 auth/CT/mismatch negatives (L117–121).

## 3. Harness duties (this review's e2e harness)

| Duty | What the harness did |
| --- | --- |
| **H1** `ports.projection` / `ports.catalog` / `ports.memberInstances` | Real read path: `createProjectionService(domain, null, {clock: () => NOW})` over a `readProjectionSource` backed by the seeded storage repos + the real `p6t1.createP6T1Catalog()` (fixture-backed, `packages/runtime/test/p6t1-helpers.ts`); templates/members/compat/ledger summary assembled from durable rows (leader WITHOUT childSessionId per invariant 14; four-lane effectiveConfig view). Fixture gap handled: the P6T1 fixture leader template omits `displayName` (`p6t1-helpers.ts:101–103`) while the frozen DTO rejects `''` — adapter capitalizes the templateId (Leader/Worker/Scout), matching the canonical P8-T2 durable row (`p8t2-helpers.ts:160`). Documented choice, not a repo defect. |
| **H2** generation owner | No production code bumps `TeamSession.generation` at this SHA (write-once durable store); harness provides a mirror-only override of the `team_sessions` row and advances the live health-route generation. Recorded as concern (5). |
| **H3** effectiveConfig | Four-lane view (model/workspace/permissions/autonomy) with frozen state values (inherited/locked/denied/suppressed/…). |
| **H4** admission | Real steps 1–5 (`validateActionRequest` → `resolveTeamAndTarget` → `resolveCaller` → `checkCallerRoleAuthority` → envelope) plus the real `admission.enforceCompatibilityGate` for new-work admission; send-message path uses the real target-liveness/token resolution. Nine remaining ports are `G8R1_PORT_NOT_WIRED` proxies (fail loud, never faked). |
| **H5** sync executor | Wraps the async TeamRuntime facade in the sync port surface the frozen ports require (concern (2): `ports.ts:11–13` claims sync but the facade is async; no production sync adapter exists at this SHA). |
| **H6** durability mirror | `mirrorSeam` wrapping every `KvTable` (get/entries/keys/size merged mirror-over-base; put/delete/update tracked) so the FINAL durability audit (40/40 settled, 0 failed) reflects real on-disk writes through the pristine host store. |

Transport fidelity: the seam transport mints a **string** wire rpcId per the upstream Connection contract (`g8r1-seam-<n>`), echoing the test client's numeric request rpcId back across the boundary — see concern (1). The wire `result` is the `RemoteResponse` ok-envelope verbatim; no unwrapping in the transport.

## 4. Findings and concerns (none blocking)

1. **rpcId number-vs-string seam/wire gap (material for the future vNext client transport).** `packages/remote/src/push/types.ts:46,56` types `SeamClientRequest.rpcId` as **number** ("monotonic per client"), while the only host binding lands on the upstream Connection RPC channel whose wire schema requires a **string** rpcId (`packages/client/connection/src/rpc-schema.ts`: `rpcIdSchema = z.string()`; the frozen P2-T6 probe mints strings — `tests/characterization/probes/remote-client/index.mjs:299`), and `types.ts:62–63` states "a real deployment binds this to the host seam (the `REMOTE_RPC_CHANNEL` connection)". A literal seam client (numeric rpcId) gets 200 `{rpcId:'invalid-request', ok:false, bad-request}` on **every** request — observed directly in run 2 before the adapter bijection was added. The binding must perform a lossless number↔string bijection (as this harness does); recommend the contract layer own that mapping explicitly rather than leaving it to each adapter.
2. **Sync-port claim vs async facade.** `packages/remote/src/handlers/ports.ts:11–13` states port methods are synchronous ("the vNext runtime services and storage repositories are in-process and synchronous"), but the real `TeamRuntime` facade this gate exercised is async; no production sync adapter exists at this SHA (ports.ts:5–6 defers host wiring to "a later P8 harness task"). The gate's H5 wrapper closes the gap for the review only.
3. **member.send/follow-up payload duplication quirk.** `packages/runtime/src/action-router/effects.ts:172,185–186` (and `coordinator.ts:322`) read `ctx.request.payload['recipientInstanceId'|'subject'|'body']`, while the remote handler passes top-level `targetInstanceId`/`body` (`packages/remote/src/handlers/member.ts:84–95`) — a conforming wire client must duplicate fields into `payload`. Works, but the dual location is a trap.
4. **effectSequence naming mismatch.** `packages/remote/src/handlers/member.ts:39–52` (`admissionEffectSequence`) reads `effect.factSequence` / `effect.deliveredSequence` (the messaging effect shapes), but the action-router coordination effect carries `sequence` (`effects.ts:190`) — so wire `effectSequence` is systematically `null` for fact-recorded admission effects (observed run 7 E2 L63, asserted as a documented nuance, not a failure).
5. **No durable generation owner.** No production code bumps `TeamSession.generation` at this SHA; the harness's mirror-only override (base row stays gen 1 by write-once store design) is what advances it. A future task must own this.
6. **owned-boundary placement concern.** 11 new `p8t1-`/`p8t2-` test files sit outside the brief's T1/T2 src-only globs (63/74 changed files are in-glob). Conventional test placement, no cross-task write, program-wide precedent identical — PASS with concern.
7. **Dependency-scan S1.T.** Exactly two test-only cross-package imports: `packages/remote/test/p8t3-negative.test.ts` and `p8t4-negative.test.ts` → `../../testkit/fault-injection/session-event-scan.mjs`. Test-suite reuse of the frozen P4-T6 scanner; src/ purity itself is fully green (S1 all PASS).
8. **H1 fixture gap (harness-side, recorded for the record).** P6T1 fixture leader template omits `displayName`; the frozen DTO rejects `''` (`MALFORMED_DTO`, observed run 4 — preserved at `harness/e2e-run4-malformed-dto.log`); the canonical P8-T2 durable row supplies `'Leader'`. Harness adapter capitalizes the templateId. This failure mode is itself positive criterion-5 evidence: the contract layer failed closed with full provenance over the real wire.

**Positive note**: criterion-5 enforcement was observed working exactly as specified — every UI-visible failure (E5a–E6c) carried typed code + full provenance (method/endpoint/contractVersion/requestToken/reason/cause) over the real pristine-host wire with **zero 5xx**.

## 5. E2E run record (final)

- `harness/e2e-run.log` (run 7, 2026-08-31T08:46:42Z): **`RESULT: e2e=RUN(PASS) checks=104/104`**, attempts 1, preflight green (worktree clean, test-use clean, :3080 200, 3181 free), lock acquired/released by marker match, postflight green (test-use still clean, fresh DSH_HOME removed, :3080 still 200).
- `harness/harness-output/summary.json`: `healthFinal = {ready: true, generation: 4, durability: {pending: 40, settled: 40, failed: 0}}`; `clientStats = {framesApplied: 3, framesStale: 1, transportLosses: 1, rpcErrors: 0, …}`; httpLog ends with `GET http://127.0.0.1:3080/ → 200`.
- Preserved intermediate evidence: `e2e-run4-malformed-dto.log` (+`summary-rerun4.json`), `e2e-run6-e5-e6-typed-errors.log` (+`summary-rerun6.json`), console logs `boot-console*.log`.
- Environment after the run: lockfile absent, port 3181 free, `references/.dsh-test-g8-r1` removed, worktree clean except this reviewer's untracked evidence dir (verified post-run).

## 6. Verdict

All six criteria PASS with direct wire-level evidence; chain 1754/1754; tsc 0/6; zero-core / private-import / owned-boundary all PASS (owned-boundary with recorded concern); e2e RUN(PASS) 104/104. Eight concerns recorded, none blocking (the rpcId number/string gap is the most material and should be addressed when the production client transport binds the host seam).

**Verdict: 通过**
