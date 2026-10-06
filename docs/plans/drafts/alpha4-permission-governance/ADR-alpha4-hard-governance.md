# ADR: Alpha.4 Hard Governance, Authority Ceilings, and Approval Routing

**Status:** Draft for review  
**Stage:** Alpha.4  
**Date:** 2026-10-07  
**Repository:** `ArmourPiercer1/dsh-agent-team`

## 1. Decision summary

Alpha.4 completes the Team permission-governance model by introducing a second runtime authority ceiling above the Leader, normalizing approval authority independently from the permission effect `ask`, and unifying runtime authority evaluation across one-shot approvals and durable permission mutations.

The central runtime authority hierarchy is:

```text
Human Admin
    >
Team Hard Envelope
    >
Human User
    >
Leader Permission Mutation Envelope
    >
Leader
    >
Member
```

This hierarchy is intentionally limited to the Team runtime governance plane. Host/runtime capability facts such as capability availability, environment restrictions, and the existing external capability facts are orthogonal. They answer whether an already-authorized operation can actually execute; they do not answer who has authority to approve it.

The historical Alpha.4 name `teamHardDeny` is retired. The canonical term is:

```text
teamHardEnvelope
```

It uses the same conceptual grammar as Alpha.3's `permissionMutationEnvelope`:

```ts
{
  operationClass,
  matcher,
  maximumEffect
}
```

Both envelopes are upgraded to an effective-ceiling algebra supporting broad grants with narrower restrictions.

## 2. Context

Alpha.2 introduced canonical operation permission resolution and synchronous exact-operation approval. Alpha.3 introduced durable `PermissionOverlaySnapshot` state, runtime permission mutation, and the Leader `permissionMutationEnvelope`.

The Alpha.3 implementation already contains the key primitives needed by Alpha.4:

- canonical operation/resource identities;
- exact/subtree/fingerprint matcher grammar;
- the effect ladder `deny < ask < allow`;
- effective before/after permission comparison;
- region partitioning for mutation rise classification;
- fail-closed handling when subtree containment cannot be established;
- append-only permission snapshots and generation/CAS semantics;
- durable ControlRequest / ControlDecision infrastructure.

However, Alpha.3 still couples several concepts that Alpha.4 must separate:

1. `ask` is currently routed directly from caller role to `leader-approval` or `user-approval`;
2. Leader expansion authority is represented by `permissionMutationEnvelope`, but there is no Human-User ceiling above it;
3. one-shot `allow_once` and durable mutation authority are not expressed through one common authority model;
4. warnings, approvals, and environment failures use separate UI/control concepts;
5. the historical `teamHardDeny` wording suggests a fourth permission lane, while the intended semantic role is a governance ceiling.

## 3. Configuration Plane vs Runtime Governance Plane

Alpha.4 formally separates two planes.

### 3.1 Configuration Plane

The Configuration Plane owns Blueprint creation, publication, and future Blueprint write authorization.

Alpha.4 does not implement Blueprint ACLs or a configuration-admin hierarchy. It only reserves a future Blueprint write-authority seam.

A Human Admin in the runtime model is not automatically identical to a future Blueprint administrator. These concepts must not be conflated.

### 3.2 Runtime Governance Plane

The runtime permission authority hierarchy is:

```text
Human Admin
    >
Team Hard Envelope
    >
Human User
    >
Leader Permission Mutation Envelope
    >
Leader
    >
Member
```

`Human Admin` is the highest authority inside this Team runtime governance model.

The current production system does not yet authenticate Human Admin. Existing trusted human/operator access is normalized to `human-user`.

`human-admin` therefore exists in the vocabulary and may be returned as a required authority, but Alpha.4 exposes no production path that can construct or claim such a principal.

Future Human Admin identity must be derived from a trusted host/authentication context. A Remote payload must never gain Admin authority by supplying a role field.

## 4. External runtime constraints are not permission authority

The existing external/host capability facts are not an additional Team mutation ceiling.

They represent actual runtime capability or environment reality, for example:

- a capability is unavailable;
- an MCP/tool/provider is absent;
- a host or deployment restriction prevents execution.

They do not reduce or redefine Team governance authority.

Accordingly:

- a durable permission mutation may pre-authorize an operation whose external capability is currently unavailable;
- an authorized concrete operation may still fail with a capability/environment error;
- external capability failure does not enter the approval chain;
- external capability failure does not produce a `requiredApprovalAuthority`;
- Alpha.4 does not model a hypothetical host security boundary that even a trusted administrator must never bypass.

The Team governance model assumes Human Admin is trusted and has full Team governance authority.

## 5. Blueprint schema v3 is mandatory

Alpha.4 is a breaking Blueprint schema change.

Supported Blueprint schema:

```text
v3 only
```

Schemas v1 and v2 are no longer accepted by Alpha.4.

A v1/v2 Blueprint is rejected with a typed unsupported/migration-required outcome rather than being silently interpreted under legacy semantics.

A TeamSession already bound to a v1/v2 Blueprint fails closed on cold resume:

- no Leader startup;
- no Member restoration;
- no implicit migration;
- no inferred `teamHardEnvelope`.

The operator must explicitly migrate the Blueprint and create a new Team.

### 5.1 Required v3 authority documents

Blueprint v3 requires:

```text
permissionMutationEnvelope
teamHardEnvelope
```

`teamHardEnvelope` is mandatory.

```yaml
teamHardEnvelope:
  rules: []
```

means Human User has no runtime expansion authority.

Field absence is never interpreted as an implicit wide grant.

## 6. Team-bound immutable authority documents

For Alpha.4, both authority envelopes are immutable for the lifetime of a TeamSession:

```text
permissionMutationEnvelope = immutable
teamHardEnvelope           = immutable
```

Runtime mutation changes permission state, not these authority ceilings.

If a future stage allows hot Blueprint rebinding, a Blueprint authority generation/content-hash change must invalidate all prior dynamic authority bindings, including:

- PermissionOverlay authority binding;
- approval cases;
- one-shot approvals;
- permission mutation proposals.

No old dynamic authorization may silently carry across a Blueprint authority-generation change.

## 7. Envelope grammar and effective-ceiling semantics

Both envelopes share one authority-ceiling grammar:

```ts
interface AuthorityEnvelopeRule {
  operationClass: string
  matcher: Exact | Subtree | Fingerprint
  maximumEffect: 'deny' | 'ask' | 'allow'
}
```

Effect order:

```text
deny < ask < allow
```

### 7.1 No matching rule means no expansion authority

For an authority envelope:

```text
no matching rule
= no expansion authority
```

This is fail-closed.

### 7.2 Overlapping rules monotonically tighten

For one concrete scope:

```text
effectiveCeiling(scope)
= minimum maximumEffect among all matching rules
```

For example:

```text
A/**             -> allow
A/private/**     -> deny
```

gives:

```text
A/public/x       -> allow
A/private/x      -> deny
```

A narrower rule may preserve or reduce authority, but never reopen a region already restricted by a broader rule.

Thus:

```text
A/**             -> deny
A/public/**      -> allow
```

still resolves to `deny` in `A/public/**`.

Adding a matching envelope rule is therefore monotonic with respect to authority: it can never increase effective authority.

### 7.3 Leader authority is a logical intersection

For a Leader operation/proposal:

```text
Leader effective ceiling(scope)
=
min(
  permissionMutationEnvelope.ceiling(scope),
  teamHardEnvelope.ceiling(scope)
)
```

This is a logical runtime intersection, not a precomputed path/resource set.

No implementation may expand the envelopes into a startup-time list of currently existing descendants and use that list as authority.

## 8. Live containment and frozen matcher identity

Authority relations are recomputed whenever an affected boundary is touched.

The caller/orchestration must freshly resolve:

- canonical resource identity;
- subtree containment through the pinned filesystem containment seam;
- current effective permission context where relevant.

A subtree matcher freezes its canonical root identity, not the current set of descendants.

Example:

```text
A/
└─ sub-A-1/

runtime later creates:

A/
├─ sub-A-1/
└─ sub-A-2/
```

If the root `A` retains the same canonical identity, `sub-A-2` is judged under the current live containment relation and may become covered by `A/**`.

If the canonical matcher root itself changes, for example through symlink/junction retargeting, a frozen proposal/case becomes stale.

## 9. Permission effect and approval authority are separate concepts

Permission effects remain:

```text
allow
ask
deny
```

Their normalized semantics are:

- `allow`: execute directly, subject to runtime capability/environment availability;
- `ask`: the operation is not directly authorized, but may enter an approval case;
- `deny`: terminal Team-policy prohibition; no automatic approval case.

`ask` does not encode who must approve.

The required approver is derived independently.

## 10. Runtime authority vocabulary

Alpha.4 defines:

```ts
type RuntimeAuthority =
  | 'member'
  | 'leader'
  | 'human-user'
  | 'human-admin'
```

with strict ordering:

```text
member < leader < human-user < human-admin
```

The current authenticated operator maps to `human-user`.

`human-admin` is a valid required authority but has no production resolver in Alpha.4.

## 11. Approval invariant: no self-approval

Approval requires a strictly higher authority than the beneficiary:

```text
approverAuthority > beneficiaryAuthority
```

Therefore:

- Member cannot approve itself;
- Leader cannot approve its own expansion;
- Human User cannot approve its own expansion;
- Human Admin is the terminal runtime authority.

This is independent of proposal initiation rights.

## 12. Approval chain and escalation

Approval routing proceeds upward:

```text
Member
  -> Leader
  -> Human User
  -> Human Admin
```

`requiredAuthority` means the minimum authority permitted to approve. It does not mean review must terminate at that level.

Legal actions are:

```text
current reviewer < required authority
-> deny | escalate

current reviewer >= required authority, and reviewer < Human Admin
-> allow | escalate | deny

Human Admin
-> allow | deny
```

A reviewer with sufficient authority may still escalate when the reviewer considers the decision inappropriate for that level.

Escalation is always terminal for the current leg. Once a reviewer escalates, that reviewer cannot later return to the same case and allow it.

Escalation never leaves the runtime authority hierarchy and never routes into the Configuration Plane.

## 13. Approval case is a linked immutable review-leg chain

One logical approval case may contain multiple immutable ControlRequest legs:

```text
ApprovalCase C1
  R1 Leader       -> escalate
  R2 Human User   -> escalate
  R3 Human Admin  -> allow
```

Each leg has a new request identity but preserves:

- `approvalCaseId`;
- operation/proposal fingerprint;
- correlation identity;
- beneficiary;
- requested effect.

`escalate` closes the current leg and grants zero execution/mutation authority.

Terminal decisions/outcomes do not append further review legs.

## 14. Human Admin unavailable in Alpha.4

If routing reaches Human Admin while no Admin resolver exists:

- do not create an impossible pending Admin ControlRequest;
- terminate the case as `authority-unavailable`;
- return a typed Admin-required outcome;
- expose an InterventionItem describing the unresolved authority requirement.

The current invocation/proposal ends. Alpha.4 does not wait indefinitely.

## 15. One-shot approval and durable mutation use the same ceiling model

A one-shot `ask -> allow` is an authority elevation.

It therefore cannot bypass the authority envelopes merely because it is not persistent.

Leader one-shot approval is bounded by:

```text
permissionMutationEnvelope ∩ teamHardEnvelope
```

Human User one-shot approval is bounded by:

```text
teamHardEnvelope
```

Durable permission mutation uses the same authority model.

## 16. Runtime mutation uses effective before/after semantics

Mutation direction is defined by effective permission change, not mutation verb.

Expansion:

```text
deny -> ask
deny -> allow
ask  -> allow
```

Tightening:

```text
allow -> ask
allow -> deny
ask   -> deny
```

Therefore revoke/reveal operations that expose a more permissive lower layer are expansions and require authority.

Alpha.3's effective before/after region-classification approach remains the foundation.

## 17. Mutation batches are atomic and width-conservative

If any affected region in a mutation or multi-rule batch requires authority beyond the approved ceiling, the whole mutation fails with zero write.

Alpha.4 does not:

- automatically subtract restricted subregions;
- rewrite the requested matcher;
- partially commit legal regions;
- return partial success.

## 18. Mutation initiation rights

Approval routing does not grant universal proposal-initiation rights.

### Member

A Member cannot initiate durable permission mutation.

A Member may trigger a one-shot approval only through a concrete operation that resolves to `ask`.

### Leader

A Leader may initiate Member permission-mutation proposals.

A Leader may also initiate mutation of its own permission state:

- self-tightening / identity may commit directly;
- self-expansion requires approval by a strictly higher authority.

### Human User

A Human User may initiate permission mutations, subject to `teamHardEnvelope`.

If the required authority is Human Admin, Alpha.4 terminates as authority-unavailable.

## 19. AuthorityCeilingEvaluator

Alpha.4 introduces one pure semantic authority kernel.

Its responsibility is narrowly defined:

> Given an already-canonicalized scope and a desired effect, determine the minimum runtime authority required to elevate to that effect and provide evidence of the relevant ceilings.

It must be deterministic and I/O-free.

It must not read:

- TeamDomain;
- filesystem state directly;
- ControlService;
- clocks;
- Remote/authentication state.

Live facts are obtained by orchestration before the call and injected as immutable inputs/seams.

The evaluator returns minimum authority, not resolver availability.

Whether a Human Admin resolver exists is orchestration state, not authority algebra.

## 20. Durable permission mutation approval

If a valid mutation proposal exceeds the initiator's direct authority, it enters the same approval chain.

Approval is bound to the exact immutable proposal. It does not grant temporary broad authority to the initiator.

After a reviewer records `allow`, the inline caller revalidates at the commit boundary:

- proposal identity;
- matcher root identity;
- target lifecycle;
- expected generation/CAS;
- effective before/after result;
- current authority requirement.

Only then may a new PermissionOverlaySnapshot be appended.

Any drift produces `mutation-stale` and zero write.

`allow` is a durable governance decision, not mutation authority by itself.

Mutation terminal outcomes include:

```text
mutation-committed
mutation-no-change
mutation-stale
denied
authority-unavailable
```

Alpha.4 does not retain reusable mutation-approval tokens after a failed inline commit.

## 21. Single-operation approval is single-shot

Alpha.4 does not implement operation retry/resume using a prior approval.

A concrete operation succeeds only if all of the following hold in one invocation:

```text
capability/environment preflight available
AND permission/authority approval succeeds
AND authority remains valid at last-mile
AND capability/environment remains available at last-mile
AND exact operation executes
```

Any failure terminates the approval case for that invocation.

A durable `ControlDecision = allow` records that a reviewer approved the request. It does not mean the operation executed.

Terminal operation-case outcomes include:

```text
execution-succeeded
execution-unavailable
stale
denied
authority-unavailable
```

An `allow` followed by a last-mile capability/environment failure is not reusable.

## 22. Capability/environment execution pipeline

Concrete operation order:

```text
canonicalize operation
-> capability/environment preflight
-> permission resolution
-> approval chain if needed
-> fresh authority recheck
-> capability/environment last-mile recheck
-> execute
```

If capability/environment preflight already proves the operation cannot execute, no approval case is created.

Durable permission mutation does not perform this execution-capability preflight and may represent pre-authorization of currently unavailable external capability.

## 23. Intervention model

Alpha.4 separates:

```text
kind
response behavior
block scope
```

Conceptual vocabulary:

```text
kind:
  approval | warning | error

responseBehavior:
  informational | wait-for-response

blockScope:
  none
  configuration-operation
  operation
  subject-new-work
  team-new-work
```

Intervention is an observation/interaction projection, not a second authority store.

Authority remains in the source domains:

- ControlRequest / ControlDecision;
- CompatibilityState and acknowledgement;
- GovernanceWarning and acknowledgement.

Intervention fields must never become authorization evidence.

## 24. Warning semantics

A hard-envelope consistency diagnostic has three states:

```text
consistent
mismatch
undetermined
```

At Blueprint create/publish and Team start, `mismatch` and `undetermined` may be acknowledged and do not permanently block the configuration once acknowledged.

At runtime, an individual authority decision that is itself undetermined still fails closed. A non-blocking warning does not convert uncertainty into authority.

### 24.1 Warning deduplication

Configuration warnings use a configuration-level fingerprint.

Runtime observations use a concrete-scope fingerprint.

Repeated observation of the same fingerprint updates observation metadata rather than creating duplicate items.

Acknowledgement changes reminder state only. It never caches an authority verdict.

## 25. Blueprint/start/runtime mismatch checks

Envelope mismatch is not computed once and frozen.

Checks occur:

1. at Blueprint create/publish where relations can be proven;
2. again at Team start with concrete workspace/provider context;
3. on each relevant runtime boundary touch.

Runtime authorization always recomputes the current containment/effective-ceiling relation.

## 26. Remote/UI compatibility policy

Alpha.4 favors incremental integration over cleanup.

The historical durable/control vocabulary:

```text
leader-approval
user-approval
```

is retained for compatibility.

Its implicit reviewer semantics are no longer the architecture source of truth. The new explicit authority fields/adapters determine runtime semantics.

Cleanup of this legacy vocabulary is explicitly deferred to post-Alpha.4.

Likewise, existing Control and Compatibility Remote endpoints remain available while a new Intervention read/action surface is added.

## 27. Non-goals and post-Alpha.4 work

Alpha.4 explicitly does not implement:

- real Human Admin authentication/resolution;
- Blueprint ACL / configuration-admin hierarchy;
- runtime Blueprint hot-rebind;
- asynchronous approval continuation;
- reusable operation approval tokens/retry;
- per-template/per-member `teamHardEnvelope`;
- mutation auto-clipping or partial commit;
- forced cleanup of `leader-approval` / `user-approval`;
- forced consolidation of old Control/Compatibility Remote APIs.

Post-Alpha.4 cleanup must include evaluation/removal of the legacy implicit reviewer vocabulary and duplicate command surfaces.

## 28. Consequences

### Positive

- Team runtime authority becomes explicit and reviewable.
- One-shot and durable expansion use one authority model.
- Human User and Human Admin semantics are separated without prematurely implementing Admin authentication.
- Envelope semantics support broad grants with narrow restrictions.
- Live filesystem changes cannot be incorrectly frozen into stale path lists.
- Approval escalation can represent both insufficient authority and voluntary upward review.
- Warning acknowledgement remains observation-only and cannot mint authority.

### Costs

- Blueprint v3 is intentionally breaking.
- Alpha.3 envelope evaluation must be upgraded from existential coverage to effective-ceiling semantics.
- ControlRequest/Decision contracts gain approval-case and authority metadata.
- Remote/UI gain a new Intervention surface while old surfaces remain temporarily duplicated.
- More runtime checks are intentionally repeated at authoritative boundaries.

## 29. Security invariants

Alpha.4 implementation must preserve at least the following:

1. no matching envelope rule grants no expansion authority;
2. adding an overlapping rule cannot increase authority;
3. Leader effective authority is never greater than either envelope;
4. authority is computed from live canonical/containment context, never startup path enumeration;
5. matcher-root identity drift invalidates frozen proposals;
6. `deny` never automatically becomes an approval request;
7. no principal may approve its own expansion;
8. escalation grants zero execution/mutation authority;
9. an escalated leg can never later approve the same case;
10. Member cannot initiate durable permission mutation;
11. mutation batches are all-or-nothing;
12. ControlDecision `allow` is not execution or mutation authority by itself;
13. Intervention state is never authorization evidence;
14. caller-supplied Remote role data can never create Human Admin authority;
15. v1/v2 Blueprint/Team runtime paths fail closed after the Alpha.4 breaking upgrade.
