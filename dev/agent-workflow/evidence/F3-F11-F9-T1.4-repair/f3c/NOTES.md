# F3-C (repair-r1) — evidence notes

Task: implement the F3-C package (the messaging coordinator's PRIVATE
per-team chain lock scope — INV-9.1 private-chain extension; the H2
sibling of F3-A) of the F3/F11/F9/T1.4 repair round.
Branch: `task/repair-r1-f3-messaging-sibling` (worktree
`.worktrees/repair-r1-f3c`, base `68ff124` = the F3-A tip).
Execution: 1/3.
CORE PATCH BUDGET = 0 honored — the only product change is
`packages/runtime/messaging/coordinator.ts` (+ its same-commit dist
rebuild) + the new persistent regression suite + this evidence dir.

## Root cause (verified)

The coordinator's OWN per-team lock map (the `withTeamLock` seam, the
module-local `teamLocks` — distinct from the facade's map and from the
shared `TeamOperationCoordinator` chains) was held across the WHOLE
delivery: plan + fresh target read, the `SessionInputPort` call, and
the confirmation commit. The production port (`src/plugin/live/
agent-bindings.mjs` L1364–1389) is `followup(message)` +
`await handle.agent.whenIdle()` — i.e. the RECIPIENT'S ENTIRE MODEL
TURN. Chains are NEVER re-entrant: a `team_send_message` issued by the
recipient inside the message-triggered turn re-enters this SAME
coordinator and, pre-fix, its delivery-phase acquisition queued behind
the outer send's own pending tail on the same non-re-entrant map:
permanent self-deadlock (the H2 hazard — latent: no round-1 mock data
hit it, but the T6.1 relay-turn in NOTES-V2 proves models DO call team
tools inside message-triggered turns).

## Implementation — the three lock-scope phases (INV-9.1, private chain)

`packages/runtime/messaging/coordinator.ts` — `deliverOne` is split
into three phases of the SAME private chain:

1. **Phase A — `prepareDeliveryLocked` (chain held, via `deliverOne`'s
   own `withTeamLock` acquisition):** the durable intent fact's plan is
   re-derived from `payload.caller` + `payload.recipientInstanceId` +
   the FRESH override records (R1, same pure rule as recovery); the
   delivery target is read fresh and must be work-accepting
   (CREATED/RUNNING/SETTLED), else `MESSAGING_TARGET_NOT_LIVE`; the
   relay attribution + text are rendered (pure). Reads + typed
   rejections only — no port call, no write. In the LIVE SEND path the
   intent fact read (the Phase A durable precondition) is its own brief
   acquisition before `deliverOne`.
2. **Phase B — `submitDeliveryInput` (NO chain held):** the port call
   ONLY. This is where the recipient's model execution runs — and a
   nested `team_send_message` (the H2 re-entry) now acquires the chain
   freely. Commit-or-throws; a rejection is
   `MESSAGING_DELIVERY_FAILED` and the intent fact stays durable
   (R2/R3 unchanged).
3. **Phase C — `commitConfirmationLocked` (the SAME chain
   re-acquired):** the confirmation fact commit. The sequence
   allocation is atomic on the domain write chain
   (`storage/repositories/ledger.ts` `allocateSequence`), so concurrent
   confirms can never interleave writes. NEW (the R3 amendment): if a
   confirmation for the SAME intent (requestToken + intent fact
   sequence) is already durable — the at-least-once redelivery race the
   released Phase B makes possible (two concurrent deliveries of the
   same pending intent) — the commit CONVERGES on the existing fact:
   exactly-one confirmation per pending intent on the TeamLedger, the
   duplicate session input stays the documented at-least-once residue
   (detectable through the correlation token). `commit` failure is
   `MESSAGING_LEDGER_WRITE_FAILED` (unchanged).

`recoverPendingDeliveries` keeps R3/R4/R5 with the same split shape:
the durable SCAN is one acquisition; each pending intent's R4
skip-vs-deliver verdict (fresh plan + fresh target view, no side
effects for a dead target) is its own brief acquisition; the delivery
goes through `deliverOne`'s three phases (the scan no longer holds the
chain across a recipient turn). R5's abort semantics are unchanged: a
delivery/confirmation failure propagates the typed error out of the
loop; earlier confirmations stay durable; the rest stay pending.

Documented rulings updated in the module doc: step 4 (the three
phases + the INV-9.1 note), R3 (the Phase C convergence), R6 (the
decision/commit phases run under the private chain, the port call
runs released; the ledger sequence remains the team-order authority).
No public contract change: `sendTeamMessage` /
`recoverPendingDeliveries` signatures, the closed error-code set, the
two fact families, and the wire shapes are unchanged.

## Red-before-green (`f3c/red-before-green.txt`)

`packages/runtime/messaging/coordinator.ts` stashed (pre-fix `68ff124`
behavior), new test file in place, suite re-run via
`f3c/run-file.mjs`:

- **RED pre-fix (T1, the H2 deadlock):** `t1.resolved` = `false` — the
  deterministic microtask budget (200k pump iterations) exhausted with
  the outer send still pending: the nested send waited behind the
  outer's own pending tail on the non-re-entrant private map (a true
  self-deadlock, no wall clock involved).
- **RED pre-fix (T2, the masked race):** `t2.r2Recovered` = `0` — pre-fix
  the whole scan+delivery was ONE critical section, so the second
  concurrent recovery ran strictly AFTER the first (seeing no pending
  intent). Post-fix both scans see the intent; the R3 exactly-once
  ruling is what must be preserved (see T2 green below).

Stash restored; post-fix all green (`f3c/postimpl-focused.txt`).

## Focused post-fix (`f3c/postimpl-focused.txt`)

| suite | tests | result |
| --- | --- | --- |
| `f3c-messaging-sibling.test.ts` (new) | 2 | **2/2** (T1 re-entry, T2 exactly-once) |
| `p6t3-mediation.test.ts` | 7 | 7/7 |
| `p6t3-send-delivery.test.ts` | 8 | 8/8 (incl. R2/R3 recovery rows) |
| `p6t3-restart.test.ts` | 5 | 5/5 (R1–R5 recovery semantics preserved) |

Pre-fix baseline of the three p6t3 suites: green
(`f3c/baseline-focused.txt`).

## F3-A non-regression (`f3c/postimpl-f3a.txt`)

`f3a-lock-scope.test.ts` (the shared-chain INV-9.1 suite from the base
commit) re-run on top of F3-C: **7/7** green.

## Full runtime package (`f3c/postimpl-full-runtime.txt`)

One process per test file via `f3c/full-sweep.ps1` + `f3c/run-file.mjs`
(the d5 top-level crash kills any single-process run — same house rule
as F3-A's evidence). Final clean-scratch result: **135 files, ok=128,
bad=7** — the SAME pre-existing shim-surface failure set as F3-A's
`f3/` evidence (their 134-file run at this base: ok=127, bad=7):
`d1-member-base-tools` (3/6), `d1-s6-remote-v3` (6/14),
`d1-team-ownership-index` (5/16), `d2-s6-ensure-root-live` (5/10),
`d3-member-identity-context` (1/5), `d5-instance-contract` (2/9,
top-level crash), `pbf-default-artifact-urls` (3/9) — plus the new
`f3c-messaging-sibling` (2/2) and `f3a-lock-scope` (7/7) GREEN. No new
failures.

### p7t3-descendant-drain scratch-collision investigation

One intermediate sweep (not the evidence file above) showed an 8th
failure: `p7t3-descendant-drain.test.ts` dying at import with
`malformed-medium — domain 'team_domain' is missing table file
'schema_meta.json'`. Root cause: that pre-existing suite destroys its
worlds at TOP LEVEL (`await destroyWorld(world)`, no finally blocks)
and does not self-clean at module start, so ONE interrupted/failed
evaluation left a PARTIAL scratch dir (`packages/testkit/test/
.tmp-fault/p7t3-d1` with a half-written `team_domain` store) that broke
every subsequent run of the deterministic basename. Verified:
- the p7t3 suite does NOT touch the messaging module (grep: no
  `messaging` / `sendTeamMessage` references in any `p7t3-*` file) —
  F3-C cannot affect it;
- after deleting the stale dir, `p7t3-descendant-drain` PASSES 5/5 on
  this commit with fresh scratch, and a green run leaves NO scratch
  behind (`f3c/p7t3-verify.ps1` reproduces both facts).
- the final evidence sweep above was run on the clean scratch state.
Pre-existing hygiene gap of that suite (same class F3-A documented for
its own suite and netted with module-start self-cleanup); no fix made
here (out of this leaf's file scope — flagged for the gate).

## Typecheck / build (worktree `packages/runtime`)

- `tsc -p tsconfig.json` → exit 0
- `tsc -p tsconfig.build.json` → exit 0

## Blockers / notes for the gate

1. **`vitest run` cannot execute in this sandbox session** (same
   blocker F3-A recorded): vite 8 config load → `windowsSafeRealPathSync`
   → child-process spawn EPERM under workspace-write. All suite
   evidence here is via the repo's plain-node fallback
   (`scripts/run-tests-hooks.mjs` + `scripts/test-vitest-shim.mjs` +
   the per-file runner `f3c/run-file.mjs`, copied from F3-A's `f3/`
   artifact). **Obligation: re-run the runtime package under real
   vitest in an unrestricted environment** (the shim runs the identical
   test bodies; the 7 pre-existing shim-surface red files use matchers
   outside the shim and pass under vitest in prior rounds' evidence).
   The new `f3c-messaging-sibling.test.ts` is written strictly on the
   shim surface (`toBe` / `toEqual` / `toBeGreaterThan`).
2. Scratch hygiene: `packages/testkit/test/.tmp-fault/f3c-*` scratch
   dirs are destroyed in each scenario's `finally`; the suite
   additionally self-cleans its two basenames at module start
   (deterministic basenames collide on re-run after any crashed
   process — one such stale dir was observed during this round's
   red-check sequence and is covered by the net). Test scratch is
   gitignored.
3. Build artifacts: `packages/runtime/dist` is TRACKED in this repo and
   the house rule is the same-commit rebuild. This branch carries the
   rebuilt runtime dist alongside the source (both tsc runs exit 0).

## Determinism notes (F3C-T2)

The T2 interleave is deterministic under the recording fakes: the
private-chain discipline + `withTeamLock`'s registration-order
continuations order the phases strictly
R1-scan < R2-scan < R1-R4 < R2-R4 < R1-PhaseA < R2-PhaseA < R1-PhaseC
< R2-PhaseC (both scans see the pending intent before either Phase C
commits; the first Phase C commits the single confirmation, the second
converges on it and reports the same `deliveredSequence`).

## Deliverables (this branch)

- `packages/runtime/messaging/coordinator.ts` (three lock-scope phases,
  INV-9.1 private-chain extension, R3 Phase C convergence, module doc
  step 4 / R3 / R6)
- `packages/runtime/test/f3c-messaging-sibling.test.ts` (F3C-T1/T2, new)
- `packages/runtime/dist/**` (rebuilt runtime dist — same-commit
  rebuild rule; only the messaging coordinator's dist changed)
- this evidence dir: `run-file.mjs`, `full-sweep.ps1`,
  `p7t3-verify.ps1`, `baseline-focused.txt`, `red-before-green.txt`,
  `postimpl-focused.txt`, `postimpl-f3a.txt`,
  `postimpl-full-runtime.txt`, `NOTES.md`

## Re-run notes (environment)

- All suite evidence was produced with the plain-node per-file runner
  (`f3c/run-file.mjs`) — `vitest run` is unusable in this sandbox
  (blocker 1). The sweep script (`f3c/full-sweep.ps1`) is the canonical
  re-run path for the full-runtime evidence (run from the worktree
  root on a CLEAN scratch state — see the p7t3 investigation above).
- Note for re-runs from a delegated subagent session: this session's
  harness wrapper corrupted bare `$`-variable ASSIGNMENTS in INLINE
  `pwsh` command strings (e.g. `$out = ...` lost its `$`), which broke
  one early evidence capture. All durable evidence commands here were
  therefore driven through `.ps1` script files or `$`-variable-free
  inline commands.
- `postimpl-full-runtime.txt` (like F3-A's `f3/postimpl-full-runtime.txt`
  artifact) carries a few non-UTF-8 console bytes on the suite-name
  lines (the machine's active code page re-encodes the em-dash glyphs of
  the PASS lines); every line is still extractable and all 135 result
  lines verify (128 PASS each with a `(N tests)` count, 7 FAIL, plus
  SUMMARY/BAD).

Not pushed (per red line; the main agent pushes after the gate).
