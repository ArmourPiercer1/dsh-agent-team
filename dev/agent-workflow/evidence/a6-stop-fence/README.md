A6-STOP-FENCE

# A6-STOP-FENCE — the cancellation fence at the durable consumption boundary

Owner ruling **A** (2026-11-09, "narrow cancellation barrier + disclosed residual window"),
implemented on `task/a6-stop-fence-20261109` from `master` @ `f31e3d9e2` (candidate content
`168266dbf`). This note is the implementation/evidence record; the PR body carries the same claims.

| field | value |
| --- | --- |
| tree | `master` @ `f31e3d9e2` (candidate content `168266dbf`) |
| branch / PR | `task/a6-stop-fence-20261109` / **draft PR #710** (base `master`, not merged) |
| host pin | `tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84` (DSH `0.2.0-rc.2`) — **not patched** (`CORE PATCH BUDGET = 0`) |
| mechanism note read | `dev/agent-workflow/evidence/a6-stop-race-mechanism/README.md` @ `task/a6-stop-race-20261109` |
| measurement read | `dev/agent-workflow/evidence/c2-adjudication/README.md` §11.2 @ `task/c2-adjudication-20261109` |
| tests | `packages/runtime/test/a6-stop-fence.test.ts` (9 arms, host-free, deterministic) + `packages/tools/test/a6-stop-fence-wiring.test.ts` (2 wiring arms) |
| boot | the earlier boots under this directory were instrument-defective (see §8); **no boot in this session** — the main agent boots the PR (repo rule) |

## 0. What was measured before this change (the fact being fixed)

`c2-adjudication` §11.2: over six boots the durable `allow` (seq 14) and the durable
`control-allow-consumed` (seq 15) landed **+81…+83 ms** apart; the Stop was acknowledged in the same
~10 ms, and the consumption was written in **4/6** boots (`0/6` executed). The mechanism note then
located the last cancellation read at `pa-control-bridge.ts:683` and the consumption write at
`control/service.ts:4395`, with four awaits and no probe between them.

## 1. The fence: exact linearisation point

`packages/runtime/control/service.ts#guardOperation`, inside `withTeamLock(...)`, in the
single-unconsumed-allow branch, **after** every existing check — team liveness, target lifecycle,
scope candidacy, `checkExternalOperation` (A2C-4), `recheckConsumedAuthority` (A1-14),
`paEffectsDenyReason` (A5-M1), the corrupt-sibling check — and **immediately before** the
`control-allow-consumed` write:

```
        if (corruptLeg !== undefined) return corruptLegVerdictOf(corruptLeg.payload)
        const consumptionSequence = await allocateSequence()      // last avoidable await, moved BEFORE the probe
        if (guardOptions?.signal?.aborted === true) {              // THE FINAL PROBE (synchronous read)
          await commitAbandonmentFact(root, requestId, 'invocation-cancelled-before-consumption')
          return { allowed: false, reason: 'invocation-cancelled', requestId, decisionSequence }
        }
        await putEntry({ sequence: consumptionSequence, factType: 'control-allow-consumed', ... })
```

**Why nothing avoidable awaits after the probe.** Every authority / external-policy / PA-manifest
await is behind the probe by construction (they are the checks above it). The *only* await that used
to sit between the last check and the probe was `allocateSequence()` inside the consumption
`putEntry` call; it is now hoisted above the probe. What remains after the probe is exactly one
await: `putEntry(...)` → `repositories.ledger.put(entry)` — the disclosed residual window (§4).
The trip path additionally awaits the terminal abandonment write, which is the effect the trip
exists to produce (not avoidable latency on the success path).

**Signal identity.** The probe reads the *same* signal the approval wait already consumes. THREE
production lanes hand it over, verified one by one (2026-11-11 correction — the earlier text named
only the bridge and implied the guarantee was global):

| lane | call site | signal |
| --- | --- | --- |
| PA control leg | `pa-control-bridge.ts` | combined `waitSignal` (wiring signal ⊕ `input.signal` ⊕ bounded-wait controller, `AbortSignal.any`) |
| A4/A5 parameter-permission ask | `pre-execute-adapter.ts` `guardOperation(scope, { signal })` | the invocation's own `exec.signal` — the SAME one passed to `awaitControlDecision` |
| `team_*` guarded tools | `tools.ts#executeGuarded` → `guard.ts#consultGuard` | `ctx.signal` = the host's `exec.signal` |

No new signal, no second cancellation registry. The signal is **not** durable identity: it is absent
from `ControlOperationScope`, the scope key, the PA manifest, the request identity, the
activity/ledger payloads and `options`. Callers that pass nothing get the historical behaviour
byte-for-byte.

The A4/A5 ask lane is the one the PR #710 review found unwired. It is live and consuming on a real
boot (`a6-human-discovery.json`: seq 6 `control-request-recorded` actionName
`parameter-permission` → seq 8 allow → seq 9 consumed), so the missing option was a real residual
window, not a dormant path. It is now wired and pinned host-free by S9.

## 2. Trip semantics (owner contract items 3 and 5)

On trip, under the same per-Team lock:

- **no** `control-allow-consumed` fact (zero consumption) and **no** tool execution;
- the durable `allow` decision row is left EXACTLY as the approver wrote it — no `deny`, no
  rewrite (a Stop is an execution-lifecycle event, not an approver decision);
- exactly **one** terminal `control-request-abandoned` fact, reason
  `invocation-cancelled-before-consumption` — a new, accurate lifecycle reason. The crash/
  engine-undetermined reason `invocation-abandoned` (A6-26 / A6 closing constraint 1) is
  deliberately NOT reused;
- the guard returns the new closed block reason `invocation-cancelled`;
- the prepared consumption sequence is BURNED (the abandonment allocates its own), so the ledger
  shows a gap at `decisionSequence + 1` and the terminal row at `decisionSequence + 2`. This is
  asserted by every trip arm (S1–S5, S9, W1) so a future reader does not "fix" the gap;
- a later replay finds the terminal mark and is refused as `request-abandoned` — it cannot
  re-consume **only while the abandonment row is durable**. `commitAbandonmentFact` is not
  best-effort: a durable write failure makes the guard THROW, the allow stays unspent and still
  spendable, and the consuming lane maps the throw to a deny/block. A failed trip is a failed
  fence, not a silent one.

If the consumption already committed (i.e. the cancel landed after the probe), the fact is **kept**;
the guard never rewrites a committed consumption as un-consumed. The execution edge still refuses
the body (pre-existing `cancelled` gate), and the pipeline's real outcome is recorded by the
existing execution-result path — this change adds no second outcome writer.

## 3. The deterministic test points (nine runtime arms + two wiring arms)

`packages/runtime/test/a6-stop-fence.test.ts`, all host-free: no sleeping 80–100 ms anywhere; every
cancel lands at a named await through a deferred barrier, and every barrier is *disarmed* during
world setup (request/allow) and armed only immediately before the guard call.

| arm | where the cancel lands | asserted |
| --- | --- | --- |
| S1 | before entering the guard (pre-aborted signal) | terminal abandonment; zero consumption; zero execution; exactly one abandonment with the lifecycle reason; no deny decision; original allow unchanged (same sequence, still `allow`); replay refused `request-abandoned` |
| S2 | during the external-policy await (`externalPolicyFacts`) | same set |
| S3 | during the authority recheck await (`authorityRevalidation`, v3 operation case) | same set |
| S4 | during the PA-effects verifier await (`paEffectsVerifier`, strict PA manifest row, guard stage) | same set |
| S5 | after sequence preparation, before the final probe (gated `ledger.allocateSequence`) | same set |
| S6 | **control — the probe passes** (un-cancelled) | exactly one consumption, exactly one execution, one decision (allow), replay refused `allow-consumed` |
| S7 | inside the consumption write await (`putEntry` → `ledger.put`) | the **disclosed residual window**: consumption commits (1), no abandonment, verdict allowed, and the committed consumption stays committed (replay `allow-consumed`) |
| S8 | **regression** — caller passes NO options | plain allow consumes once and executes once; replay `allow-consumed`; plain deny blocks `decision-deny` with zero consumption and zero abandonment |
| S9 | **A5 ask lane WIRING** — the real `installParameterPermissionListener` pipeline, gated on the (4c') authority-facts await between the durable decision and the guard | zero consumption; zero `next()` body calls (a REAL body spy, not a verdict counter); exactly one terminal abandonment at the lifecycle reason; the allow untouched; the sequence gap; guard-verdict observation names `invocation-cancelled`. Verified RED against the unwired call |
| W1 | **team-tools lane WIRING** — `packages/tools/test/a6-stop-fence-wiring.test.ts`, pre-aborted signal through the registered tool | tool returns `blocked`/`invocation-cancelled`, `runtime.performAction` never called, zero consumption, one abandonment, allow untouched, sequence gap. Verified RED against the unwired call |
| W2 | **team-tools NO-SIGNAL default path** (S8 at the wiring level) | `consultGuard` receives NO options, one consumption, one execution |
| RED | S1–S5 against the pre-fence guard | the same suite fails (`the guard allowed a cancelled invocation`) — it is a discriminating test, not a tautology |

**"Zero execution" — read the counters correctly.** In S1–S7 the `executions` counter is incremented
only on `verdict.allowed`, so it means "the plane was never ASKED to execute". Only S9 and W1 drive a
real (faked) body (`next()` / `runtime.performAction`) and observe zero calls at that boundary.

## 4. Measured residual window (do not claim atomic Stop)

The window between the final probe and the durable write is owned by exactly one await:

```
await putEntry({ sequence: consumptionSequence, factType: 'control-allow-consumed', ... })
  -> repositories.ledger.put(entry)
```

Measured by S7, which holds that await open with a barrier and lands the cancel inside it:

- un-cancelled control (S6), natural consumption-write await: **≈0.3–0.6 ms in-process on the
  author/review hosts** (author runs ≈0.23–0.43 ms; the independent reviewer measured 0.585 ms).
  This is an order-of-magnitude statement, not a precise band, and it is a host-free in-process
  number, not production latency. The observed value is printed by the suite as
  `A6-STOP-FENCE naturalConsumptionPutMs`;
- S7, the window deliberately held open: the cancel landed while the write was pending and the
  write still committed. The suite prints the held duration as
  `A6-STOP-FENCE residualWindowMs` (≈1–2 ms on both hosts; it is the barrier's hold, not a claim
  about production latency).

**Claimed:** cancellation observed **by** the final consumption check ⇒ nothing consumed, terminal
abandonment, no tool execution. Earlier checkpoints return an ordinary block/undetermined verdict
with NO abandonment; the terminal row is the fence trip only. **Not claimed:** atomic Stop; a cancel
that arrives after the check may race the durable write, and if it commits the consumption is kept.
No per-invocation durable Stop state (ruling C) is implemented. The "replay cannot re-consume" claim
holds only while the abandonment row is durable (a failed `commitAbandonmentFact` throws; see §2).

## 5. Team-tools asymmetry — now fenced, and how reachability was verified

`packages/tools/src/tools.ts` (`executeGuarded`, the guarded `team_*` lane) consulted the guard with
**no** signal; only the runtime action received `ctx.signal`. It now forwards it:

- `consultGuard(service, scope, options?)` (`packages/tools/src/guard.ts`) forwards the optional
  guard argument; `executeGuarded` builds `{ signal: ctx.signal }` when the context carries one;
- `ctx.signal = exec.signal` (`packages/tools/src/tools.ts`, the `ToolCallContext` construction
  inside the tool `execute`), i.e. the host's `ToolExecutionInput.signal` — the same phase signal
  the approval wait and the runtime action already receive;
- so every guarded `team_*` call on a well-formed instance id is fenced at the same probe.
  Verified **host-free at the wiring level** (2026-11-11 correction: previously only static + boot
  evidence): `packages/tools/test/a6-stop-fence-wiring.test.ts` W1 drives the registered
  `team_follow_up` tool with a pre-aborted signal and observes the guard's second argument, the
  `blocked`/`invocation-cancelled` result, zero `runtime.performAction` calls, zero consumption and
  the terminal abandonment; W1 is RED against the unwired call. W2 pins the no-signal default path.
  **Not verified on a live boot** — that is the main agent's step.

No new signal is minted in the tool layer; absent `ctx.signal` the call is byte-identical to before.

### 5.1 Every `guardOperation` call site in the repository (2026-11-11 audit)

| # | call site | invocation signal in scope? | wired? |
| --- | --- | --- | --- |
| 1 | `packages/runtime/control/service.ts` — the definition itself | — | — |
| 2 | `packages/runtime/operation-permission/pa-control-bridge.ts` (`deps.controlService.guardOperation(scope, { signal: waitSignal })`) | yes (`waitSignal`) | **wired** |
| 3 | `packages/runtime/operation-permission/pre-execute-adapter.ts` (`guardOperation(scope, { signal })`) | yes (`exec.signal`, same as `awaitControlDecision`) | **wired in this round** |
| 4 | `packages/tools/src/guard.ts#consultGuard` — forwards `options` verbatim | yes (forwarded) | **wired** |
| 5 | `packages/tools/src/tools.ts#executeGuarded` — the only production caller of `consultGuard` | yes (`ctx.signal = exec.signal`) | **wired** |
| 6 | `packages/tools/test/p6t6-guard.test.ts:117` | no (spy) | not wired — test spy |
| 7 | `packages/tools/test/a4-corrupt-leg-guard.test.ts` (4 sites) | no | not wired — test fixtures |
| 8 | `packages/runtime/test/a5-m1-auth-bridge.test.ts` (multiple) | no (some are `guardOperation: (s) => …` spy adapters) | not wired — test doubles |
| 9 | every other `packages/runtime/test/*.test.ts` direct call | no | not wired — the tests construct durable state and call the guard directly |
| 10 | `packages/runtime/test/a6-stop-fence.test.ts` S1–S7 (and `packages/tools/test/a6-stop-fence-wiring.test.ts` via the tool) | yes (explicit `{ signal }`) | wired by the test, on purpose |

There is no other production call site. Sites 6–9 have no invocation signal in scope (they are test
doubles/fixtures); none of them can consume a real allow after a real decision, so no signal is
invented for them.

## 6. Gates run in this session

All on the committed tree (`d5c352c60` + the gate-log commit), from this worktree:

| command | verdict |
| --- | --- |
| `pnpm -r typecheck` | **PASS** (9 projects, exit 0) |
| `vitest run packages/runtime packages/tools` (full, `--no-file-parallelism`) | **6558 passed / 6559**, 533/535 files. The two non-green suites are ENVIRONMENTAL and reproduce identically on the untouched baseline: `a5sf-os-runner` P1-07 (no Landlock backend on this host) and `u7-f-agent-control-native-output-schema-c1` (needs the gitignored pristine `tests/deepseek-harness-test-use` checkout, absent in a worktree) |
| targeted suites (`a2c4`, `a4p7`, `control-guard-coupling`, `f9`, `p6t6-guard`, `a4-corrupt-leg-guard`, `a6-stop-fence`) | **87/87 PASS** |
| `eslint .` | **RED at baseline**: 130 errors, every one on untouched files (unused vars etc.); **zero** on any line this PR adds or changes (`control/service.ts` only flags its pre-existing lines 174/284) |
| `node scripts/doc-checks.mjs` | **PASS** |
| `node scripts/eb3-tool-acceptance.mjs` | **PASS** (`tools=31 L4-proven=19`) |
| `node scripts/lint-identities.mjs` | **PASS** (162 identity lines, 0 gitignored) |
| `node scripts/check-artifacts-committed.mjs` | **OK** (2082 files, tree == index) |
| `node scripts/check-artifacts-at-head.mjs --store-dir …` | **OK** — HEAD carries its own build (2082 compared, drift 0) |
| `node scripts/check-install-manifest.mjs` | **RED at baseline**: 14 computed `new URL()` / `import()` refusals inside committed `packages/runtime/dist` artifacts; issue count identical before/after this PR (a pre-existing finding, the lock leg passes) |

Notes that must survive review:

- `node scripts/check-install-manifest.mjs` is **RED on the untouched baseline too** (14 computed
  `new URL()` / `import()` refusals inside the committed `packages/runtime/dist` artifacts; the lock
  leg passes). Our change adds none and the issue count is identical before/after — a pre-existing
  finding, not a regression.
- the protected-center digest ledger `dev/agent-workflow/ledgers/arc-a-protected-center.json`
  correctly refused the change until four **named** override entries were booked (control/index.ts,
  control/service.ts, control/types.ts, operation-permission/pa-control-bridge.ts). This is an
  interface change to the consumption boundary, not a family addition; the PR title/body says so.
- dist artifacts were rebuilt from this tree (`pnpm -r run build`) because `packages/runtime/dist`
  is tracked and a host boot reads it.

### 6.1 Gates re-run in the review-fix round (2026-11-11, from this worktree)

| command | verdict |
| --- | --- |
| `pnpm -r typecheck` | **PASS** (9 projects) |
| fence + guard/approval/pre-execute suites (18 files: `a6-stop-fence`, `a6-stop-fence-wiring`, `p6t6-guard`, `a4-corrupt-leg-guard`, `control-guard-coupling`, `control-guard-leader`, `f9-control-exactly-once`, `a4p7-a1-14`, `a5a-pre-execute`, `a2c4-external-lastmile`, `a4p3-approval-case`, `a6a-production-wiring`, `a5sf-approval-takeover`, `control-inline-wait-abort`, `a4p4-operation-single-shot`, `a4p4-operation-approval-authority`, `control-abandon-without-resolve-envelope`, `control-inline-abandon`) | **310/310 PASS** |
| `u6-arc-a-fitness` (protected-center digest lock, with the new named override) | **PASS** (12/12) |
| `node scripts/doc-checks.mjs` | **PASS** |
| `node scripts/check-artifacts-committed.mjs` | **OK** after staging the rebuilt `dist` (tree == index) |
| RED discriminators | S9 fails against the unwired adapter call (1 failed / 8 passed); W1 fails against the unwired `executeGuarded` (1 failed / 1 passed) |

Known pre-existing reds were NOT re-litigated in this round (`eslint .`, `check:install-manifest`,
`u7-f`, `a5sf-os-runner` P1-07, `alpha5-search-backend` P8b); the sibling README rows above record
their untouched-baseline reproduction.

## 7. What this session did NOT do

- no merge, no end-to-end claim; no live boot (repo rule: the main agent boots the PR personally);
- no upstream/host edit, no patch-package, no vendored change (`CORE PATCH BUDGET = 0`);
- no durable per-invocation Stop state (ruling C declined by the owner);
- no claim that the A6-26 accepted-but-unclaimed review-wake abandonment changed — it is a
  separate defect and a separate disclosure.

## 8. Review-fix round, 2026-11-11 (append-only)

The independent review of PR #710 returned BLOCK. This section records what was changed and what
could not be made true.

**Fixed — the block: the A4/A5 ask lane was not wired.**
`pre-execute-adapter.ts#enforce` called `controlService.guardOperation({...scope})` with no options
while the invocation signal was already in scope (`const signal = exec.signal`, the same one passed
to `awaitControlDecision`). It now calls `guardOperation(scope, { signal })`. The lane is live and
consuming on a real boot (`a6-human-discovery.json`: seq 6 `control-request-recorded` actionName
`parameter-permission` → seq 8 allow → seq 9 consumed), so this was a real residual window. Host-free
regression: `a6-stop-fence.test.ts` S9 (gated (4c') authority-facts await between the decision and the
guard; on abort: no `control-allow-consumed`, exactly one terminal `control-request-abandoned`, the
real `next()` body never called, the sequence gap). S9 is verified RED against the unwired call.

**Fixed — measurement claims.** The residual-window text now reads "≈0.3–0.6 ms in-process on the
author/review hosts" (author ≈0.23–0.43 ms, reviewer 0.585 ms) and the held window ≈1–2 ms on both —
an order of magnitude, not a precise band (§4).

**Fixed — kit instrumentation (tracked test infra).**
`tests/kits/c1-leader-approval-smoke/c1-leader-approval-smoke.mjs`:
(a) `run-manifest.json#productSha` is now `git -C <--worktree> rev-parse HEAD` (it used
`process.cwd()`), and the manifest records `productTree`; (b) `a6-stop.json` now persists
`abandonments` (the full `final.abandonments` the kit already read) and `humanAbandonment`.

**Could NOT be made true in this session — stated plainly.**
- **No manifest binds the PR head.** The existing `run-manifest.json` files under this directory and
  `../a6-stop-fence-c2/` are **instrument-defective**: their `productSha` is the tree the kit process
  ran in, not the booted tree. They are marked so in `BOOT-2026-11-11.md`; the old values are not
  silently reinterpreted. Producing a manifest that binds the PR head requires a re-boot, which this
  session did not perform (explicit instruction: the main agent re-boots after the push).
- **No kept artifact contains the terminal `control-request-abandoned` row** the boot note claimed
  (`seq 16`, reason `invocation-cancelled-before-consumption`). The kept `a6-stop.json` carries no
  `abandonments` field (the older kit dropped it) and the discovery ledger page stops at seq 13. The
  reason/sequence is therefore **inferred** from the code path plus the `CONTROL_REQUEST_ABANDONED`
  refusal, and the dated CORRECTION block in `BOOT-2026-11-11.md` says so. The fixed kit will
  capture the row on the next boot.

**Also added (review's should-fix list).** Wiring-level arms W1/W2 (`a6-stop-fence-wiring.test.ts`);
the `consultGuard`/team-tools no-signal default path (W2); the sequence-gap assertion in every trip
arm; the `commitAbandonmentFact` fault path (§2 and `RELEASE-NOTES-0.1.6.md` §8); and an explicit
statement that "zero execution" in S1–S7 means "the plane was never asked to execute", with real body
spies in S9/W1.
