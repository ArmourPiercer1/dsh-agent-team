# UTE-1 lifecycle: the disposal finding, the state machine, and what each race proves

Review: `docs/reviews/20261120-1700.txt` §3.3 — "UTE-1 的 Scope Disposal 不等于执行排空".
Round: 2026-11-20, branch `task/ute1-fs-binding-20261120`.

## The finding, restated as measurement

`dispose()` used to be one synchronous step: set `disposed`, then release the tool and provider
fibers, swallowing release errors. That conflated three separate facts:

| question | old answer |
| --- | --- |
| are NEW operations refused? | yes (one `scope-disposed` name) |
| did ADMITTED operations finish? | unproven — an admitted call parked in an async `super.stat()` could still land its effect after the receipt |
| is RESOURCE RELEASE confirmed? | not expressible — a swallowed fiber error still produced a receipt that read as success |

## The state machine now

```
active ──dispose()──► draining ──drain complete + release resolved──► released
                               └──timeout, or a release step threw──► termination-unconfirmed
```

Monotonic and idempotent. The first `dispose()` performs the transition and memoises its receipt;
later calls return the same terminal facts with `changed:false, alreadyDisposed:true`. A binding
that ended `termination-unconfirmed` NEVER later reports `released`.

## The receipt separates the facts

| field | means | does NOT mean |
| --- | --- | --- |
| `state` | the terminal lifecycle state (`released` \| `termination-unconfirmed`) | that no OS effect happened |
| `drained` | every ADMITTED, promise-shaped operation finished before the receipt | that a stream/watch the binding did not admit stopped |
| `newOperationsRefused` | calls arriving later are refused by name | that an in-flight call was cancelled |
| `releaseConfirmed` | the mount's fibers were disposed and no disposer threw (only possible with `state: released`) | that the provider's own internal state is gone |
| `refusalCode` | the name a NEW call receives now (`scope-draining` before terminal, then `scope-disposed` / `scope-termination-unconfirmed`) | an error code for the operation that finished |
| `reason`, `releaseErrors`, `inFlightAtDispose`, `drainTimeoutMs` | why the state was reached, and what was measured on the way | a retryable error |

Refusal names are distinct on purpose: a caller can tell "stop has begun, my work is not admitted"
(`scope-draining`) from "the binding is gone" (`scope-disposed`) from "the binding could not confirm
it stopped" (`scope-termination-unconfirmed`).

## Responsibility boundary (contract)

The binding owns exactly two things: (a) refusing new operations once disposal starts and (b)
counting and draining the operations it admitted. Terminating a provider that will not drain is the
**host/lifecycle owner's** job unless that provider honours the injected abort signal — this binding
does not kill fibers out from under a parked call. A receipt is evidence about the BINDING, never
proof that an OS effect did not happen.

## What each arm/race measures (`receipts.txt`, `suite.txt`, `mutation-transcript.txt`)

| id | measures | required observation |
| --- | --- | --- |
| `a8-drain-waits` / race A | dispose waits for a parked admitted write | `status: draining, inFlight: 1` while parked; receipt `released / drained:true / releaseConfirmed:true / inFlightAtDispose:1`; bytes and file set unchanged 40 ms AFTER the receipt |
| `a9-drain-timeout` / race B | a bound shorter than the park | `termination-unconfirmed / drained:false / releaseConfirmed:false`, `reason` names `drain-timeout`, NO fiber release attempted, and a late-finishing operation does not flip the state |
| `a10-refusal-codes` / race C | the two refusal names | during drain `scope-draining`; after release `scope-disposed` (never the other); no file effect; the lane-fact stream does not grow |
| `a4-double-dispose` / race D | idempotence | second/third call: same `state`, `drained`, `releaseConfirmed`, `refusalCode`; `changed:false` |
| `a11-record-is-diagnostic` / race D (record arm) | a throwing `record` callback | operation still succeeds and lands; recorder offered the fact once, delivered nothing, not retried; the binding's own fact buffer is independent |
| `a12-release-must-be-confirmed` | a throwing fiber disposer | `termination-unconfirmed`, `drained:true`, `releaseConfirmed:false`, `releaseErrors` non-empty |
| `a1`–`a7` | the pre-existing lane/lifecycle arms | unchanged green |

## Mutations (11) — every new invariant has one that turns it RED

| mutation | removed behaviour | expected red |
| --- | --- | --- |
| `M1-remove-lifecycle-guard` | `assertLive` consults the state | `a3` (+ `a6`, `a10`) |
| `M2-lane-admits-everything` | lane containment | `a2` (+ `a5`, `a6`) |
| `M3-dispose-never-terminates` | the terminal-state assignment | `a4` (+ `a3`, `a6`, `a9`, `a10`, `a12`) |
| `M4-shared-lane-across-scopes` | per-scope lane | `a5` |
| `M5-drop-generation-pin` | the generation pin | `a7` |
| `M6-retain-previous-lane` | the fresh lane of a re-mount | `a6` (+ `a5`) |
| `M7-ignore-the-drain` | the drain wait | `a8` (+ `a9`, `a10`) |
| `M8-claim-release-without-confirmation` | `releaseConfirmed` tied to the state | `a9`, `a12` |
| `M9-one-refusal-code-for-every-stop` | distinct draining/released names | `a10` |
| `M10-swallow-release-failure` | release failure ⇒ unconfirmed | `a12` |
| `M11-record-failure-becomes-fatal` | the recorder being swallowed | `a11` |

Verdict line: `MUTATION-TRANSCRIPT-VERDICT GREEN mutations=11 arms=12`.

## Pass / finish semantics (what a caller may rely on)

* While `draining`, the binding admits nothing new and tells the caller exactly that.
* `state: released` means: everything admitted before `dispose()` finished, and every fiber this
  mount created was disposed without error. It is the ONLY receipt shape that may be read as
  "the binding is stopped".
* `state: termination-unconfirmed` means: at least one of those two facts could not be established.
  The receipt names which (`drain-timeout: …` or `release-failed: …`) and never claims release.
  Recovery (kill the process, abort the provider, escalate) belongs to the lifecycle owner.
* Neither terminal state is a claim about the operating system: a completed write remains a
  completed write, and a stream already handed to a consumer is outside the counter.
