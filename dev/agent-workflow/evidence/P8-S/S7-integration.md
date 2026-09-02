# S7 integration gate — R1 + R2 into int/P8-S-backend-closure (R81, 2026-09-02)

Main-agent integration record. Base: int tip `15da6b5` (S6 integrated, 1985/1985,
pin 525). Sources: R1 `task/P8-S7-R1-creation-preflight` @ `85df4fb` (impl
`9ba5309`), R2 `task/P8-S7-R2-projection-views` @ `3ddf1fc` (impl `e1689c8`).
Ordering per R80: R1 first, then R2, then R4 on the new tip.

## Worker settlements (pre-integration)

- **R1 (S7-R1, attempt 1/3)** — worker PASS: C1–C5 green; 1998/1998 fresh+dist
  on branch; tsc 8-set clean; 17/17 live @3181 (home `.dsh-test-p8s7r1/-e`,
  pristine); ND-02 = NATIVE_PROVEN via public `remote.agentPresets` seam (no
  adapter, no projection change, catalog unchanged). Main audit: branch diff =
  exactly the 6 owned files (remote params.ts + team.ts, runtime s6-remote.ts,
  2 new tests, p4t6 pin); fresh chain 1998/1998 rc=0; tsc 0 fails.
- **R2 (S7-R2, attempt 1/3)** — worker PASS: C1–C8 green; 2045/2045 fresh+dist
  on branch; tsc 8-set clean; 17/17 live @3181 (home `.dsh-test-p8s7r2/-e`);
  storage ZERO touch. Main audit: branch diff = exactly the 30 owned files
  (contracts 9, runtime/projection 3, runtime/src/plugin 9, runtime/test 7,
  pin 1, stub-glue 1); no storage/domain/client/legacy/tools/remote. Fresh
  chain 2045/2045 rc=0; tsc 0 fails. Residuals (a)–(k) adjudicated ACCEPT
  (recorded R80/R81: (g) W2 `lifecycle !== 'CREATED'` over-approximation =
  MINOR, P10 tightening candidate; (f) glue marker in-chain untestable = known
  test-infra limit; rest documented design boundaries).

## Integration

1. `cherry-pick -x 9ba5309 85df4fb` (R1) — clean. int tip `0064041`; fresh
   chain 1998/1998 rc=0; tsc 8/8 (`s7-int-r1-fresh.log`).
2. `cherry-pick -x e1689c8` (R2 impl) — **one conflict**,
   `packages/testkit/test/p4t6-session-event-scan.test.ts` (the scanner-lock
   pin: R1 `527` vs R2 `535`, both branched from `525`). `s6-remote.ts`
   auto-merged.

   **Conflict resolution (main agent, bounded — documented deviation):** the
   conflict surface is the scanner-lock test only. The merged value `537` is
   arithmetically determined (525 + R1's 2 disjoint new files + R2's 10
   disjoint new files), not a design judgment; the description strings and
   comment block are the two workers' own narratives concatenated verbatim
   (R1 clause "P8-S7R1 adds its two initial-work test files (wire contract +
   runtime admission)" inserted before the R2 clause; R1 comment chunk
   `2 P8-S7R1 creation/preflight test files` with list-convention `) +`
   continuation). Resolution is self-verified by the pin test itself in the
   gate chain (a wrong count fails the chain, which would force a worker
   dispatch). No production code and no test-logic judgment touched. Recorded
   here per the ABSOLUTE-boundary exception trail.
3. `cherry-pick -x 3ddf1fc` (R2 evidence) — clean. int tip `87fe302`.
4. Contracts CHANGELOG projection-track v2 entry appended + committed as
   `f04f583` (main-agent doc work per R80; documents the additive v2 lanes,
   `TEAM_PROJECTION_FIELDS_V2` = v1 + `disposedHistory`,
   `MEMBER_PROJECTION_FIELDS_V2` = v1 + `modelState`, effective-config /
   model-state / disposed-history modules, remote catalog UNCHANGED 9/23
   v1-CLOSED, no new error codes). **Final int tip `f04f583c3207e1141bc41b2268678915f36af9db`.**

## Gate at `f04f583` (ALL GREEN)

| check | result |
| --- | --- |
| fresh chain | **2058/2058, 0 failed**, 12710 ms, rc=0 (`s7-int-final-fresh.log`) |
| dist recipe (wipe dist + junction, legacy+runtime build, re-link) | legacy rc=0, runtime rc=0, load artifact present, `packages/legacy/dist` absent |
| dist chain | **2058/2058, 0 failed**, 13047 ms, rc=0 (`s7-int-final-dist.log`) |
| tsc 8-set (client/contracts/domain/remote/runtime/storage/testkit/tools) | **0 fails** |
| p4t6 scanner pin | **537** (chain-enforced: the pin test passed inside 2058) |
| test-use pristine | 0 changed files, HEAD `cd5ef8148158c3a752a658978873241fdf8e2bbc` |
| diff scope `15da6b5..f04f583` (code, non-evidence) | 34 files = exact R1∪R2 union (pin + s6-remote.ts counted once); all within R80-owned scope; no storage/domain/client/legacy/tools; no new remote methods |
| live 17 scenarios (E1–E7,W1,W2,W3,W5,W7,M1–M5) | **pass=True, 17/17, assertions 104/104**, fresh homes `.dsh-test-p8s7/-e`, :3080=200 pre+post, bypassScan 25/0, rowMounted 4/4 (`S7-int-live/summary.json`) |

### Live EBUSY operational note (not a product failure)

First live launch failed at harness startup: `P8-S3 harness fatal: EBUSY ...
open '...\.p8s7-int-live\run.log'` — the main agent's console-capture
redirection (`Out-File run.log`) held the harness's own log file open. No
product code ran (failed at banner/log init; no homes created, no locks
left). Fix: console capture redirected to `console-capture.log` (distinct
from the harness's `run.log`); relaunch green. Rule carried: **never
redirect harness stdout to the harness's own `run.log` filename inside
`--report-dir`**.

### Premise-updated tests — weakening spot-check (main agent, disk)

- `p8s6-projection.test.ts`: 4-repo-call pin INTACT and doubly pinned —
  C2.3b asserts domain props exactly `['repositories']` and accessed repos
  exactly `{teamSessions, memberInstances, compatibility, ledger}`; C2.3c
  asserts the exact call sequence `['teamSessions.get','compatibility.get',
  'memberInstances.list','ledger.list']`. v2 premise updates:
  `MEMBER_PROJECTION_FIELDS_V2` closed-field validation, schemaVersion 2
  (top-level key set assertion unchanged), `isResuming` stub parity.
- `p8s6-remote-commands.test.ts`: R2-1 premise shift — malformed-command
  zero-write proofs now baseline against the C4.3 policy-state durable fact
  (`afterFollowupLedger` = `policyFactSettledLedger`, previously `0`);
  negative intent preserved.
- `p8t1-projection-negative.test.ts`: foreign-version test moved `2`→`3`
  (2 is now the genuine additive v2); mismatch code pin intact.
- `p8s5a-stub-glue.mjs`: 23→24 key parity (`isResuming: () => false`).

No assertion deleted or loosened; all changes are premise updates with
explicit R2 citations.

## Contracts lock bookkeeping

`locks.contracts` **remains `fba817c`** — it is the P3-T1 freeze-point
integration commit SHA (log L211), and the R51 precedent (P8-T1) kept it
unchanged through an owned additive extension with trail instead. Trail
here: contracts block → `core: v1, projection: v2`; CHANGELOG section
"projection v2" (commit `f04f583`); this file.

## Next

S7-R4 (handoff/fork/legacy repair cluster, 13 rows) to be dispatched on tip
`f04f583`; then S7-FREEZE (backend-contract-freeze.md), then P8-S8.
