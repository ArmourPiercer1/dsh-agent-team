# 04 — The centre: seams, what Team must supply, and the five red proofs

> This is the "central capability" of the owner's plan step 2: it is graded **before** any
> tool family is bound, and it is graded on *system obligations*, not on a tool's useful
> output.

## 1. The seams that exist in the pinned next host (measured, not assumed)

`tests/deepseek-harness-next` = `dsh-v0.2.2-rc.5` `9c2670d3`:

| seam | where | what it gives Team |
| --- | --- | --- |
| `ToolExecutor` | `core/tools/src/executor.ts:64` | the interface whose `describe`/`execute` a Team-side executor or wrapper implements |
| `ToolExecutionPipeline` | `core/tools/src/pipeline.ts:63` | prepare → dispatch → complete, with overlapping dispatch |
| `executeToolBatch` | `core/tools/src/batch.ts:50` | batch semantics, parallel cap, abort/skip ordering |
| `NativeToolExecutor` | `core/tool-executor-native/src/index.ts` | the in-process native executor (the one the provider faces serve) |
| `PtcExecutor` | `core/tool-executor-ptc/src/index.ts` | the PTC executor — **no `ctx.*` provider call**, so its confinement is OS/worker-level, not provider-level |
| `ctx.fs` / `ctx.web` / `ctx.shell` / `ctx.terminals` / `ctx.subprocess` / `ctx.userQuestions` / `ctx.goals` / `ctx.sessionProjections` | host packages (counts in `02-SERVING-CENSUS.md §2`) | the faces Team must serve from the Member realm |

`CORE PATCH BUDGET = 0` still holds: this list is what the public surface already
provides. Anything the centre needs that is **not** on this list is a
`CORE_SEAM_BLOCKER` — written up and stopped, never patched into the host.

## 2. What Team must supply (the centre, in one table)

| centre component | obligation it discharges | UTE |
| --- | --- | --- |
| **Binding assembler** | one verified binding per `Scope × ToolName × Generation`; a name with two declarants is refused | UTE-01, UTE-03 |
| **Provider lanes** (`fs`, `web`, `shell`, `terminals`, `subprocess`, `userQuestions`, `goals`, `sessionProjections`) | enforcement lives in the service the host tool already calls; the lane is a *decision in front of the host provider*, delegating to `super` | UTE-06, UTE-08, UTE-12 |
| **Face completeness** | a tool whose required faces are not all bound is refused **whole**, not partially confined | UTE-07 |
| **Admission** (kept from the old route: guard, builtin-deny, selector) | the existed Alpha.4/6 authority wraps native calls through `native-tool-admission`'s publication slot | UTE-13 |
| **`InvocationAuthorityFacts`** (pre-execution contract) | agent, definition identity, requested operation + parameters, bound Blueprint, policy generation, owner — the things Control needs **before** it decides | UTE-13, approval revalidation |
| **`DurableAdmission`** | the recorded permission to enter execution, written before the body runs | UTE-14, UTE-15 |
| **`ExecutionFact`** (settlement, existing route) | one `ExecutionId`, one canonical fact; `unknown` allowed; `tools/result` emit is not a durable commit | UTE-15, UTE-16, UTE-17 |
| **Stop / lifecycle** (existing route, untouched) | stop persists first, then ends the OS domain; cold start restores facts and replays nothing | UTE-18 |

Note what is **not** in this table: a tool definition. The centre never declares a
model-visible tool. That is the structural difference from the route being retired.

## 3. The five red proofs (the centre's acceptance, no family required)

Each proof is a *pair*: an assertion that must be green, and a mutation that must turn it
red. A proof without its mutation is a claim, not a test.

**The fixture rule (owner ruling + A0 review P1).** Real, unmodified DSH native tools are the
default mechanism probes. `dsh.u6-probe-family` is **not** eligible: it builds its own
governance-centre faces (`tests/u6-arc-a-probe-family/src/probe-assembly.mjs:23`) and is
itself a consumer of a module A1 deletes. A purpose-built `ToolDefinition` registered through
the ordinary public API is allowed only for a centre property no native tool can exercise —
and never as a second execution channel.

| # | obligation | green assertion | must-red mutation |
| --- | --- | --- | --- |
| P1 | **Binding monotonicity** (UTE-06) | `EffectiveIO ⊆ AgentCeiling ∩ ToolRestriction` on every admitted call | widen one axis after approval; the same call must refuse |
| P2 | **Face completeness** (UTE-07) | a tool with all required faces bound executes; a tool missing one face is refused whole | bind `faces.web = null` and assert the whole tool refuses, not "runs without web" |
| P3 | **Fail-closed** (UTE-09) | provider absent ⇒ refuse | remove the provider and assert the call still refuses instead of falling back to the host default |
| P4 | **One fact** (UTE-15/17) | one `ExecutionId`, one canonical outcome per physical attempt; a crash between emit and return leaves a recoverable fact | kill the process after emit; assert recovery yields `unknown`/fact, never `succeeded` from memory |
| P5 | **Stop is durable and non-replaying** (UTE-18) | after stop + cold start, facts are restored and nothing re-executes | restart and assert the previous call is not resumed; a resume attempt must red |

Two of these (P4, P5) reuse the settlement and control routes that already exist; the new
work is P1–P3, which is the binding assembler plus the provider lanes.

## 4. Why the centre can be graded before any family is bound

Because every obligation above is a property of the *binding and settlement*, and the probe
family supplies the only thing a binding needs: a name, a schema, and an executor. The
`ctx.*` faces can be served by test doubles that record what was asked of them — and a
recording double is exactly what makes the negative controls real (the double can prove
"the tool asked the host provider for this path" instead of "the tool returned this text").

What the centre **cannot** be graded on, and must not pretend to: whether a real
`tool-fs` write is confined by the OS. That is wave-1 per-family effect evidence, and it is
where `CLAIM_NOT_OBSERVABLE` (read confinement under a snapshot instrument) stays written
down.

## 5. What this buys, in one sentence per item

- The centre's green is **independent of any tool**, so it cannot be blocked by a family's
  semantics, a host binary, or an owner signature.
- Wave-1 deletions become **pairings** (delete + bind), not negotiations: the pairing is
  what the centre already built.
- The "two declarants" failure mode gets a **machine** definition (`exactly one declarant
  per booked name`) instead of a document that asks people to remember.
