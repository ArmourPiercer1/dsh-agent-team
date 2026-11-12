# PD41-ABORT-CLASS — every abort is classified by its settlement, not by a user-only bit

Task branch `task/pd41-abort-class-20261111`, base `origin/master` @
`b5df94c3f` (PD-41 landed as #719). Scope: the execution-fact classification in
`packages/tools/a5p5-tools/src/pipeline.ts` and the refusal typing of the
dispatch door in `packages/runtime/tool-dispatch/install.ts`. `CORE PATCH
BUDGET = 0`; no authority moves, no tag, no merge.

## 0. The claim under test

An independent audit of PD-41 (#719) found PD-41's claim true on the arms it
measured and false on one class. PD-41's helper decided "did the body complete?"
from the backend's **rendered** `outcome.cancelled` / `outcome.timedOut` bits.
The `settlement` was passed through the pipeline but never consulted, and
`shellCancelled()` (`packages/tools/process-family/src/shell-mechanics.mjs`)
mints the `cancelled` bit only for the `user` and `parent` cancel causes —
while the confined shell uses `settlement: {kind:'cancelled'}` for **every**
abort it terminated a body for.

So a body stopped by a forwarded inherited signal, by a host deadline
(`DOMException`), or by a plain `AbortError` came back to the pipeline as

```
ok: true, cancelled: false, timedOut: false, exitCode: null,
settlement: { kind: 'cancelled', event: ... }
```

and the old `result.ok ? 'succeeded' : 'failed'` wrote a durable
`control-execution-result` of **`succeeded`** — a completion nobody observed,
next to a shell line that already said `exit=not-observed`. This document
records the fix and its measurement.

## 1. The fix (classification only)

`observedCompletion()` now requires the backend's own settlement:

| backend answer | settlement | outcome now | outcome before |
| --- | --- | --- | --- |
| answered | `{kind:'completed'}` (any exit status, incl. non-zero) | `succeeded` | `succeeded` |
| answered | `{kind:'cancelled'}` — user/parent stop | `unknown` | `unknown` (PD-41) |
| answered | `{kind:'cancelled'}` — hook / disposed / inherited signal / deadline / AbortError | **`unknown`** | **`succeeded`** ← the defect |
| answered | `ok:false` | `failed` | `failed` |
| threw | abort-shaped (`name === 'AbortError'` or `code === 'ABORT_ERR'`) | **`unknown`** | **`failed`** |
| threw | anything else | `failed` | `failed` |

`LeaseSettlement` (`packages/tools/a5p5-tools/src/spill.ts:71-73`) has exactly
two members, `completed | cancelled`; there is no `timeout`/`exited` member.
The helper therefore tests `settlement.kind !== 'completed'`, which keeps
non-completions at `unknown` even if a future settlement member is added. A
completed settlement with a non-zero exit remains `succeeded` — an exit status
is an observed end, not a failure to observe one.

The thrown-body arm is deliberately `unknown` for abort-shaped throws: an abort
is not an observed execution failure, and `failed` would invite a retry of an
allow that was already consumed. No new outcome value, no moved consumption,
no replay, no new result: `unknown` is the ledger's existing value for
"admitted, end never observed".

## 2. Host-free proof

- `packages/tools/a5p5-tools/test/a5p5-execution-outcome.test.ts` — 13 tests.
  New `PD41-ABORT-CLASS` legs: inherited-signal abort → `unknown`; host-deadline
  `DOMException` → `unknown`; plain `AbortError` → `unknown`; a non-completed
  settlement over a mislabelled outcome (`cancelled:false, timedOut:false`) →
  `unknown`; a completed settlement with a non-zero exit → `succeeded`; an
  abort-shaped throw (`DOMException('deadline','AbortError')` and
  `{code:'ABORT_ERR'}`) → `unknown` while another `Error` stays `failed`; and a
  pipeline-level non-user abort → presented + observed `['unknown']`.
- `packages/runtime/test/pd41-allow-semantics.test.ts` — 5 tests. New
  `PD41-ABORT-CLASS B` legs: the kernel-table refusal is a typed
  `ToolDispatchRefusalError` (`TOOL_BINDING_UNVERIFIED` / `definition-drift`,
  sentence byte-identical, body not run), and the signal-wrapper refusal stays
  prose.

## 3. The live falsifier (real Host, n=1 decisive)

**Why a new arm was needed.** The WP3 fence arm stops the call through
`session/cancel`, which the host hard-wires to `agent.cancel({kind:'user'})` —
the one cause that already set `cancelled=true` and was already `unknown` after
PD-41. The audit's class needs a **non-user/non-parent** cause. The Team
lifecycle reaches the same parked call through `member.archive` →
`close-admission` → `interrupt` → `agent.cancel({kind:'hook',
reason:'team-member-interrupt'})`.

**Instrument (test-only, no product change).** Two env-gated additions to the
existing C1 kit:

- `C1_A6_STOP_VIA=archive` — the A6 Stop is a `member.archive` remote call
  (params `{teamSessionId, instanceId}`) instead of `session/cancel`; the cause
  is recorded as `timing.stopVia` in `a6-stop.json`.
- `C1_A6_STOP_CMD=linger` — the worker's body is the canonical allow command
  with `&& sleep 20` appended, so the body is still alive when the lifecycle
  interrupt lands. (The blade at the end is only `sleep`; the effect write is
  unchanged and still first, so the notification-summary routing that the mock
  relies on is untouched.)

WP3 driver `tests/kits/wp3-fence-timing/wp3-fence-timing.mjs`, pinned host
`tests/deepseek-harness-test-use` @ `639ed015397290b3745d163aafe02ffee4aa3f84`,
port base 17003/17053, fresh `DSH_HOME` under `tests/homes/` (removed at
teardown), evidence `runs/archive-r{2,3,4}/`.

### Runs

| run | tree | stop offset | stop after decision | consumption | shell line | durable `control-execution-result` |
| --- | --- | --- | --- | --- | --- | --- |
| archive-r1 (deleted) | dirty | +420 | — | — | — | none — the body command's summary lost `SUM_A6_ALLOW`, the mock routed the ask to the wrong root and resolved it `allow`, so no human leg ever existed; the kit waited out its 300 s discovery deadline (0/1 at the fence) |
| archive-r2 | dirty @ `b5df94c3f` | +420 | +146 ms | +106 ms | `exit=not-observed timedOut=false cancelled=false` | seq 16 `unknown` |
| archive-r3 | clean @ `8c178680e` | +600 | +326 ms | +127 ms | `exit=not-observed timedOut=false cancelled=false` | seq 16 `unknown` |
| archive-r4 | clean @ `8c178680e` | +1400 | +1124 ms | +112 ms | `exit=not-observed timedOut=false cancelled=false` | seq 16 `unknown` |

`archive-r4` is the decisive one: the stop lands 1.1 s after the declaration,
the archive's own steps are `close-admission, interrupt, drain-descendants,
wait-quiescence, release-residency, commit-settle, commit-archive`, and the
confined shell's own line is

```
a5g7-shell: confined-shell ran ... exit=not-observed timedOut=false cancelled=false
```

i.e. **the answered call whose rendered flags are both false** — the exact
shape the old helper called `succeeded`. The durable fact (`a6-stop.json` §
`ledger.executionResults`, classification `rows.executionResults`) is:

```
seq 16  control-execution-result  outcome "unknown"
```

with exactly one consumption (seq 15) on the same `requestId`, no abandonment,
and the late allow refused `CONTROL_REQUEST_DECIDED`. The execution fact is
written 2.3 s after the stop (when the interrupt's drain completed), i.e. it is
the abort's own result, not a boot settlement.

**Honest counting: n=1 decisive, 3 boots at the same shape.** Three boots
(`r2`, `r3`, `r4`) reached the target window — shell line `exit=not-observed
timedOut=false cancelled=false`, durable `unknown` — and `r1` is a failed
instrument run (1 of 4 boots did not produce the arm). Two of the three ran on
the committed tree (`r3`, `r4`); `archive-r4` is the published decisive run
because its stop lands latest after consumption. Nothing here claims a matrix
grade or `V@B`.

**Pre-fix counterfactual.** The old helper was
`result.ok ? 'succeeded' : 'failed'`. The shell's `ran` line is the executor's
own answer (it returns the outcome after its race settles; it did not throw),
and `ok` was `true` — so on this very run the pre-fix code wrote `succeeded`,
next to `exit=not-observed cancelled=false`. That is the audit's claim,
reproduced and closed.

## 4. Dispatch door — three more typed refusals, one deliberate prose

`install.ts` had four door refusals still throwing bare `Error` while PD-41's
notes claimed every dispatch refusal was typed. Now:

| refusal (decision, before the body) | thrown value |
| --- | --- |
| pinned definition became unreadable | `ToolDispatchRefusalError` `code:'TOOL_BINDING_UNVERIFIED'`, `reason:'definition-unreadable'` |
| kernel approval table no longer backs the live definition | `ToolDispatchRefusalError` `code:'TOOL_BINDING_UNVERIFIED'`, `reason:'definition-drift'` |
| two bodies under one call id (re-entry) | `ToolDispatchRefusalError` `code:'TOOL_BINDING_UNVERIFIED'`, `reason:'binding-unverified'` |
| host execution object cannot hold a cancellable signal | **still a bare `Error`** — the one disclosed exception |

Every sentence is byte-identical: the new constructor call passes the old
message body and the old bracket suffix separately (the class appends the
suffix with a space), and the tests assert the full sentence.

Why the fourth stays prose: it is not a Binding fact — the Binding verified and
the Body is fine; what failed is the host execution object's signal surface.
`TOOL_BINDING_UNVERIFIED` would send an operator to repair an intact Binding,
`TEAM_TOOL_UNGOVERNED` would call a governed name ungoverned, and
`ADAPTER_DRAINING` would claim a lifecycle state nobody observed. Until a code
exists for "this execution cannot be made cancellable", the honest form is the
sentence alone. It is named in the PR body, not hidden.

`isToolBindingRefusal()` (exported from `packages/runtime/tool-dispatch/index.ts`)
has **no production caller**. It is a library predicate for package consumers
and is pinned by the new test leg; no fake call site was invented to make the
claim "used in production" true.

## 5. Gates

- `pnpm typecheck` — 10/10 workspace packages.
- `pnpm vitest run` on the PD-41 specs + neighbours: `a5p5-execution-outcome`
  (13), `pd41-allow-semantics` (5), `a5p5-parity` (17), `a5r-cause-relay` (9).
- `packages/runtime/test/u6-arc-a-fitness.test.ts` — 12/12 after booking the
  `install.ts` override with the new digest.
- `node --test tests/world-factory/a5sf-debt-register.test.mjs` — 10/10; the
  PD-41 row's first two anchor line ranges moved mechanically (the helper grew
  and the one call site shifted), quoted substrings unchanged, and the row says
  so.
- `node scripts/check-artifacts-committed.mjs` — OK (`packages/runtime/dist`
  rebuilt and committed with the source).

## 6. What remains unproven

- **n=1 decisive** for the non-user/non-parent arm; the class is a closed
  union of causes (`hook` | `disposed` | inherited signal | deadline |
  `AbortError`) but only the `hook` cause was driven on a real Host.
- `disposed` (host disposal) and the raw `AbortError` throw are covered
  host-free only; their live end-to-end shape is argued from the same
  `settlement.kind` branch, not measured.
- The fourth door refusal staying prose is a judgement: it needs a §5 code
  ("execution cannot be made cancellable") before it can be typed honestly.
  The claim "all dispatch refusals are typed" is **false as of this branch**
  and is disclosed.
- The false record was never re-measured on the pre-fix binary in this lane
  (that would be PD-41's pre-merge tree); the counterfactual is argued from
  `result.ok` being true and the old one-line helper, and from the audit's own
  reproduction.
