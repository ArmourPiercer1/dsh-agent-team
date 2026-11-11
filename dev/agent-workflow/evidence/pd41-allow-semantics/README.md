# PD-41 — allow semantics, typed Binding refusal, and the execution-fact classification (2026-11-11)

Register row: **PD-41 (EXEC-FACT)** in `docs/plans/active/alpha5-sandbox-first/PRODUCT-DEBT-REGISTER.md`.

Status: **DEV-LIVE** engineering record. Branch `task/pd41-allow-semantics-20261111`, base
`origin/master` @ `1dfc6d37c`. No `V@B`, no matrix grade, no candidate claim, no authority move.
`CORE PATCH BUDGET = 0` (every change is in this repository's own plugin packages).

## 0. The adopted semantics (one paragraph)

A human `allow` authorises **one constrained dispatch attempt**, not a guarantee of execution. Its
durable consumption (`control-allow-consumed`) therefore means *"the one-shot authorisation was
consumed"* and never *"execution succeeded"*; the two facts are written by different components at
different times and either can exist without the other. A Tool Binding failure is an explicit **typed
refusal**, not a silent no-op: the call is refused before its body, and the refusal carries
`TOOL_BINDING_UNVERIFIED` (separate from `TEAM_TOOL_UNGOVERNED` and `ADAPTER_DRAINING`) so the
operator can read the recovery instruction — inspect for absence of side effects, repair the Binding,
raise a **new** approval request. A consumed allow is **never** auto-replayed. With no observed
execution completion, the durable execution fact must not say `succeeded`: a cancelled or timed-out
body records `unknown` (admitted, end never observed) and `succeeded` is reserved for a body whose end
was observed. The owner ruled that the consumption **order** is kept; only these semantics and the
classification were changed.

## 1. The lead finding — the `succeeded`-without-result observation was a REAL mis-report

**Verdict: real.** A cancelled/not-observed execution was durably recorded as `succeeded`. It was not
a misread of two different facts, and it was not a correct classification.

The pre-fix code path is one expression:

| where | what it did |
| --- | --- |
| `packages/tools/a5p5-tools/src/pipeline.ts:196` (**pre-fix**) | `deps.onExecutionResult?.({ callId, outcome: result.ok ? 'succeeded' : 'failed' })` |
| `packages/tools/process-family/src/confined-shell-executor.mjs:238-262` | a host-cancelled shell returns `{ ok: true, outcome: { cancelled: true, exitCode: null, … }, settlement: { kind: 'cancelled' } }` |

`result.ok` is the backend's **"I answered"** bit, not **"the body completed"**. The shell executor
answers `ok: true` for the cancelled arm, so the pipeline wrote `succeeded` for a body whose own
outcome said `cancelled` and whose end was never observed. The same reader
(`packages/runtime/src/plugin/live/agent-bindings.mjs:3232`) forwarded that value verbatim into
`ControlService.recordExecutionResult`, which is a closed `succeeded | failed | unknown` vocabulary.

Measured evidence of the pre-fix shape (WP3 lane, candidate `bb3c158eb`, 29/29 boots):

- `dev/agent-workflow/evidence/wp3-fence-timing/run-residual-s373/wp3-classification.json` —
  durable `control-execution-result` at sequence 16, `outcome: "succeeded"`, for the request whose
  sequence 15 is the consumption.
- `dev/agent-workflow/evidence/wp3-fence-timing/run-residual-s373/instance.log:20` —
  `a5g7-shell: confined-shell ran … pid=1495 exit=not-observed timedOut=false cancelled=true`.
- `dev/agent-workflow/evidence/wp3-fence-timing/run-residual-s373/kit.stdout.log:17` — `consumed=true
  file=""` (the side-effect file never landed).

So the two facts were about the **same call** (`callId`
`team-inst-…-bash:hexec:…`), not two different instruments. Recording `succeeded` there also
contradicted the presentation the same row rendered (`bash · cancelled`, `exit=not-observed`).

### The fix (classification only — no invented result)

- `packages/tools/a5p5-tools/src/pipeline.ts#L100-L127` — new
  `executionOutcomeOfAnsweredCall()`: a `cancelled` or `timedOut` outcome is `unknown`; anything else
  that answered is `succeeded`. A non-zero exit stays `succeeded` (the run completed; the code is
  data).
- `packages/tools/a5p5-tools/src/pipeline.ts#L235-L241` — the one call site uses it.
- `packages/tools/a5p5-tools/src/register.ts#L143-L149` — the hook's type widened to the ledger's
  own three values (the assembly in `agent-bindings.mjs` already accepted them).
- Nothing else moved: no admission, no consumption, no replay, no new outcome value. `failed` (an
  answered failure or a throw) and `succeeded` (a completed run) are unchanged; the recovery path in
  `packages/runtime/src/plugin/root.ts#L2892-L2910` already treated `unknown` as "consumed, outcome
  unknown, do not replay".

### The fix, re-measured on THIS tree (real host)

One real boot of the same instrument, same offset family, fresh `DSH_HOME` under `tests/homes/`
(created and deleted by the kit; `tests/homes` empty afterwards, no host left running), ports
`17001/17051`, loopback only, `:3080` untouched:

```
node tests/kits/wp3-fence-timing/wp3-fence-timing.mjs --worktree "$PWD" \
  --testuse <main checkout>/tests/deepseek-harness-test-use \
  --evidence-dir dev/agent-workflow/evidence/pd41-allow-semantics/wp3-remeasure-373 \
  --host-port 17001 --mock-port 17051 --resolve-ms 120 --stop-ms 373 --trials 1 --label pd41-s373
```

Result (`wp3-remeasure-373/pd41-s373/`): verdict `residual-consumed` (a *finding* for WP3, not a
crash), **1 consumption**, shell line
`confined-shell ran … exit=not-observed timedOut=false cancelled=true`, `file=""` and
`zeroSideEffect: true`, and the durable execution fact is now:

```json
{ "sequence": 16, "factType": "control-execution-result", "outcome": "unknown" }
```

Pre-fix the same shape recorded `succeeded`. This is the direct A/B on this tree: same arm, same
offset family, only the classification differs. (The run's `productSha` is the branch base because
the product change was still uncommitted at run time; `--keep` was not used and the run manifest
records the tree path.)

**Second run, on the committed tree** (`wp3-committed-373/pd41-committed/`, `productSha`
`9ac471678d54`, same flags, ports `17002/17052`): verdict `residual-consumed`, **1 consumption**,
shell line `exit=not-observed timedOut=false cancelled=true`, and the durable execution fact
`{"sequence": 16, "outcome": "unknown"}`. In THIS run the effect file **was** written before the
cancellation landed (`file="c1-a6-allow-…"`, so the instrument's zero-side-effect requirement
fails for the trial), unlike run 1 where it was absent (`file=""`). That difference is the point
rather than a contradiction: the two runs bracket "the body may or may not have got far enough",
and the fact says `unknown` in **both** — it claims neither a completion (`succeeded`) nor the
absence of an effect. Pre-fix both shapes would have said `succeeded`.

## 2. Condition 2 — the typed Binding refusal (shipped)

Two additive pieces, no decision changed, no message re-worded:

- `packages/runtime/tool-dispatch/closed-world-guard.ts#L632-L676` — `GuardDenial` (message + §5 code
  + measured reason + governed name), `ToolDispatchRefusalError` (an `Error` that also carries those
  fields), `isToolBindingRefusal()` (the one predicate a recovery path asks), `dispatchRefusalOf()`.
- `packages/runtime/tool-dispatch/scoped-dispatcher.ts#L116-L131` — `dispatcher.denial(exec)`: the
  SAME decision and the SAME observation as `guard(exec)`, returned typed; `guard()` is now
  `denial()?.message`, so the host seam's `string | undefined` contract is untouched.
- `packages/runtime/tool-dispatch/install.ts#L989-L1008` — the dispatch door throws
  `ToolDispatchRefusalError` instead of a bare `Error`.
- `packages/runtime/tool-dispatch/install.ts#L666-L680` — the not-ACTIVE refusal (`refuse()`) is the
  same typed family with `code: ADAPTER_DRAINING`, `reason: dispatcher-not-active`.

The exact refusal text (unchanged, the sentence worlds already met, plus the existing positional
suffix on the door form):

```
team tool guard: the Tool Binding for "bash" cannot be verified at dispatch time (no fallback to the native body) [refused at the dispatch door, the stage nearest the Body]
```

Typed fields measured by `packages/runtime/test/pd41-allow-semantics.test.ts#L139-L206`: `code:
'TOOL_BINDING_UNVERIFIED'`, `reason: 'binding-unverified'`, `toolName: 'bash'`. Distinguishability:
`ghost` (never governed) → `TEAM_TOOL_UNGOVERNED`; a draining dispatcher → `ADAPTER_DRAINING` /
`dispatcher-not-active`; the Binding failure is the only one for which `isToolBindingRefusal()` is
true.

### Consumption with no execution fact and no side effect

The ordering the ruling keeps is: **the one-shot authorisation is consumed first; the dispatch-time
Binding verification then refuses.** Two things are measured and one is inherited, stated separately:

1. **Inherited, unchanged by this diff:** `dev/agent-workflow/evidence/v016-packaged-acceptance/`
   (candidate `bb3c158eb`) measured the F-4 path at **1 consumption / 0 execution results / 0 side
   effects** with the same refusal sentence. This commit does not move the consumption, the refusal
   position, or the guard; it only types the refusal. Re-booting the packaged no-plane arm would need
   a new driver arm (the packaged driver hard-codes the plane config), and that was not done — see
   §5.
2. **Re-measured on this tree (host-free, real assembly, no shortcut):** a refused call never reaches
   a backend, so no `onExecutionResult` observation exists for it and no side effect can be produced
   (`packages/runtime/test/pd41-allow-semantics.test.ts` asserts `bodyExecs() === 0` on all three refusal classes). The
   typed refusal is thrown at the dispatch door, which is after the durable allow/consumption in the
   product order and before any body.
3. **Re-measured on this tree (real host, twice):** the consumed-allow arms in §1 each show 1
   consumption, and — because a body *did* start and was cancelled, once before and once after
   writing its effect file — `unknown` rather than `succeeded`. That is the "never say succeeded
   without an observed completion" half of condition 3, measured live.

## 3. Condition 3 — "no execution fact ⇒ not `succeeded`"

Satisfied twice over: (a) the classification fix above (an existing fact can no longer claim a
completion the body contradicts); (b) on the binding-failure path **no execution fact is written at
all** (the pipeline never runs), and nothing in the read/projection surface promotes a consumption to
a success — the ledger reader reports what it holds (`ControlService.listControlState`) and the
recovery settlement writes `unknown`, never `succeeded`. The tool result the model receives is the
typed refusal, not a success.

## 4. The pre-approval preflight — **DEFERRED** (one sentence)

Deferred because refusing an already-unverified tool before the approval request exists would require
the approval-request creator — the parameter-permission leg in
`packages/runtime/operation-permission/pre-execute-adapter.ts#L1948` (`controlService.requestControl`)
— to read the closed-world Binding surface owned by `packages/runtime/tool-dispatch/` and wired at a
different assembly point (`agent-bindings.mjs`), i.e. a new cross-component port (a second resolver
for the same question), which the ruling forbids at that size; the final dispatch-time verification is
unchanged, and no no-replay rule moved.

## 5. What remains unproven (read this before citing the lane)

- **No fresh no-plane packaged boot on this tree.** The 1-consumption / 0-execution number is the
  packaged acceptance's F-4 measurement on the candidate; this branch adds the typed refusal and the
  classification fix but does not re-boot that arm (the in-tree packaged driver has no no-plane
  switch; writing one is a new instrument, deferred). Anyone needing that number on this exact tree
  must run such a boot.
- **n=1 on the §1 re-measurement.** One boot at one stop offset is an existence-and-shape measurement
  (the pre-fix arm is 29/29 in WP3), not a rate claim.
- **Not a fix for the WP3 fence window.** The consumption that precedes a Stop is still possible; this
  lane changes what the *fact* says about such an execution, not whether the fence trips.
- **Timed-out bodies** are now `unknown` like cancelled ones. That is a deliberate classification
  choice (the end was never observed); no boot measured a timeout on this tree.
- **Alpha.6 routing/allocation** is untouched by this lane other than disclosure (F-2/F-3/F-5/F-6 in
  `RELEASE-NOTES-0.1.6.md`); nothing here makes Alpha.6 stable.

## 6. Gates run

| gate | result |
| --- | --- |
| `pnpm typecheck` | PASS (10/10 workspace projects) |
| `node_modules/.bin/vitest run packages/tools/a5p5-tools/test/a5p5-execution-outcome.test.ts packages/runtime/test/pd41-allow-semantics.test.ts` | PASS 6/6 + 3/3 (9) |
| affected suites (`a5p5-tools/test` incl. `a5p5-parity` + the dormant audit, `a5p1-guard-install`, `a5p1-scoped-dispatcher`, `a5pbr2-binding-feed`, `a5natexe-native-takeover`, `a5mcp-native-trust-filter`, `a5-m1-auth-bridge`, the two PD-41 specs, `p4t6-session-event-scan`) | PASS 16 files / 169 tests, and the booking suite 20/20 |
| real-host WP3 probe (above, two runs) | ran; `unknown` measured in both (exit 3 = a consumed trial is a finding, by the instrument's contract) |
| `node scripts/doc-checks.mjs` | see the commit message / PR body |
| `node --test tests/world-factory/a5sf-debt-register.test.mjs` | see the commit message / PR body |
| `node scripts/check-artifacts-committed.mjs` | required (tracked `packages/runtime/dist` rebuilt in this commit) |
| `eslint .`, `check:install-manifest`, `u7-f`, `a5sf-os-runner` P1-07 | known pre-existing reds, not in scope |

## 7. Files in this directory

| path | what it is |
| --- | --- |
| `wp3-remeasure-373/SUMMARY-pd41-s373.json` | driver aggregate for the one real-host boot |
| `wp3-remeasure-373/pd41-s373/` | run 1 (pre-commit tree) durable classification (`wp3-classification.json`), seq table, `instance.log`, `kit.stdout.log`, manifest |
| `wp3-committed-373/pd41-committed/` | run 2 on the committed tree (`productSha` `9ac471678d54`) — same verdict, `unknown`, effect file present |

Register: the row this record is cited by is **PD-41 (EXEC-FACT)** in
`docs/plans/active/alpha5-sandbox-first/PRODUCT-DEBT-REGISTER.md`; the p4t6 booking for the two new
spec files is `packages/testkit/test/p4t6-bookings/pd41.json` (1504 → 1506).
