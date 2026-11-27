# 08 — What the centre composes, and the only two things it owns

> Written after the first attempt at a centre module duplicated `member-io-policy` and was
> withdrawn (§8 of the A1 evidence note). The rule that came out of that is the rule this note
> applies: **before writing a centre module, find the product module that already answers the
> question.** The centre owns exactly two things product modules cannot: the *binding assembler*
> and the *admission point at the native dispatch seam*. Everything else it composes.

## Inventory (measured, not assumed)

| centre duty | existing authority | what the centre must NOT re-create |
| --- | --- | --- |
| `EffectiveIO ⊆ AgentCeiling ∩ ToolRestriction`, three axes | `packages/runtime/member-io-policy/src/compile.ts` (`compileMemberPolicy`, `compileEffectiveIo`, `projectToolIoRestriction`) + `path-rules.ts` (`coversLocator`, `keyCovers`, `matchLocator`) | any second algebra, any second path-containment predicate |
| one-shot Grant, generation, revocation | `member-io-policy/src/invocation.ts` (`createInvocationBinder`, `bindInvocation`, `consumeInvocation`, `revokeInvocation`, `bumpInvocationEpoch`, `toInvocationAuthority`) | a second grant ledger; epoch rules |
| approve / ask / deny lanes | `member-io-policy/src/approval-takeover.ts` (`APPROVAL_TAKEOVER_REFUSAL_CODES`, `resolveAskClassCall`) | a second approval state machine |
| action eligibility, envelopes, requirement gate | `packages/runtime/admission/` (`actionSpecOf`, `validateActionRequest`, `enforceEnvelope`, `evaluateAllScopes`) | a second action table |
| settlement + admission decision records | `packages/runtime/settlement/` (`createSettlementObservingDefinition`, `dispatchExecutionId`, `readDispatchSettlement`, `admissionDecision`, `isTerminalSettlementState`) | a second settlement writer; a second call-id scheme |
| provider/OS enforcement | `team-services/` (`installMemberIoProviders`), `controlled-fs/`, `sandbox-provider/` | a provider implementation, a PTY/process wrapper |
| lifecycle + Stop | `packages/runtime/src/control/`, `lifecycle/`, `alpha6/`, and the bindings' `interrupt()` | a second Stop path |
| tool dispatch itself | upstream `ToolsService` | any dispatch, any tool body |

## The two things the centre owns

**1. The binding assembler.** Per runtime Agent it produces the one `Binding` the rest of the
centre reads: identity (agent, session, instance generation), the compiled `EffectiveIO` (from
`member-io-policy`, never recomputed), the mounted realm (from `realm-lane.mjs`), the policy
generation, and the tool-definition identities it took over. It is a *record built once per
agent*, addressed by the runtime Agent object — not a lookup table keyed by session id, which is
how the old route ended up with two answers for one agent during a resume.

**2. The admission point.** Installed on the agent scope (`agent.ctx.tools.guard` plus a
`tools/pre-execute` verdict producer), it is the only place a call can be refused before its body
runs. Its inputs are the binding, the tool name, the arguments, and the invocation facts; its
outputs are the three decisions the contracts name (allow / ask / deny) plus the durable facts.
It refuses on a missing binding rather than falling through to the composition provider — the
"controlled call not yet wired must be explicitly refused" rule.

## Facts: what is recorded where

| fact | durability | key |
| --- | --- | --- |
| `InvocationAuthorityFacts` (agent, definition identity, requested op+params, bound blueprint, policy generation, owner) | durable, written by the centre at admission | `callId` + agent |
| `DurableAdmission` (decision, lane, grant consumed, generation) | durable | `callId` |
| `ExecutionFact` (one physical execution, outcome, provenance) | durable, one per execution | `callId`, `turn/step` |

The execution `token` is a per-execution `symbol` in the host pipeline and is **not durable**
(`pipeline.ts:119,715`), so nothing in the centre may key on it. Durable correlation is
`turn/step/callId` (`docs/subsystems/tools.md:535`).

## What this means for the next slice

B's admission point can be built and tested against the FS slice's world without any new
algebra: the binding supplies a compiled lane from `member-io-policy`; a denied call must produce
a refusal *and* an `InvocationAuthorityFacts` record; a missing binding must refuse rather than
allow. The negative controls are already available: remove the binding (must refuse), or replace
the lane with `no-additional-narrowing` (must allow), and assert the facts differ in exactly the
field that changed.
