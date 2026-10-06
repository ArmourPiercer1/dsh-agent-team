# ADR: Alpha.4 Hard Governance, Authority Ceilings, and Approval Routing

**Status:** Accepted (2026-10-07; three review rounds executed — round 3 returned BLOCK on the ceiling model and SUPPLEMENT on executability; every blocking item is closed by ADR Amendment A5, and no fourth round was run per the A1.1 review cap. See `dev/agent-workflow/evidence/alpha4-governance-review/REVIEW-ROUND-3.md`)
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
- Alpha.3 envelope evaluation must be upgraded from existential coverage to effective-ceiling semantics **in the v3 code paths; the v1/v2 paths keep existential coverage until the A4-PR7 cutover (A2-4, A5-12).**
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

---

## Amendment A1 (2026-10-07) — Review Round 1 normative closures

**Status of this section**: normative. Where a clause below conflicts with the text above, **this section governs**. Provenance: independent review round 1 (four lanes: architecture/contract, adversarial security, executability, compatibility/migration) against `master@2b86ee42`; the security lane returned **BLOCK** on four items, all closed here. Full findings and dispositions: `dev/agent-workflow/evidence/alpha4-governance-review/REVIEW-ROUND-1.md`.

### Authority provenance (closes SEC-B1, SEC-B3, MAJOR-18)

- **A1-1** Every authority-bearing value entering the evaluator or any governance decision write — initiator authority, **beneficiary authority**, **operationClass**, reviewer principal — is **server-derived** from the host-authenticated session. They are never accepted as caller data. Ports replace the `authority` literal with a **server-minted principal token**; any call site that still receives authority-bearing data MUST assert `derived === supplied` and fail closed on mismatch. New security invariant **#16**.
- **A1-2** **No default principal derivation.** Every Remote/tool method able to write governance state has an explicit, per-method principal derivation; a closed-set table with an implicit fallback branch is forbidden. PR6 MUST own `packages/runtime/src/plugin/s6-principal.ts` and ship a **catalog-enumeration test** proving every method has an explicit entry, plus a negative test that a member/instance caller cannot obtain a human decision. (Precedent is recorded in that file: a fallback once handed every caller operator identity.)
- **A1-3** **The reviewer set is never derived from a caller-supplied field** (`kind`, `targetInstanceId`, any `asRole`-shaped field). Each decision write re-derives, at write time: caller principal == that leg's `reviewAuthority`; action ∈ freshly derived legal set; caller principal ≠ beneficiary principal. The same gate is authoritative on **both** `team.resolveControl` and `intervention.act` — one law, two entrances.

### Ceiling semantics made total (closes SEC-B4, MAJOR-5, MAJOR-6, MAJOR-7)

- **A1-4 Role split, and the meaning of "no matching rule".** The two envelope documents are **restriction-only on the concrete-operation approval plane**: on that plane the source of approval authority is the `RuntimeAuthority` ladder plus the `minimumAuthority` of the matched permission rule; a matching envelope rule can only **lower** what a given reviewer may approve, never raise it; **absence of a matching rule imposes no narrowing**. On the **durable-mutation (expansion) plane** the strict reading stands: no matching rule = no expansion authority, and `rules: []` = the Leader can expand nothing. Explicitly rejected alternative: overloading expansion-absence to mean "every `ask` requires Human Admin", which dead-locks every approval under the documented `teamHardEnvelope: { rules: [] }`.
- **A1-5** `EffectiveCeiling` gets a **total lattice**: `no-authority < deny < ask < allow`, with `undetermined` **absorbing** (any meet involving `undetermined` is `undetermined`). All nine pairings of the dual-envelope intersection are pinned by tests.
- **A1-6** Any same-`operationClass` rule whose containment cannot be decided (missing/degraded filesystem seam) forces **whole-scope `undetermined`**. Relevance-filtering of rules before evaluation is forbidden; the containment seam is mandatory whenever a class carries subtree rules.
- **A1-7** Both terminal vocabularies gain **`authority-undetermined`**, distinct from `denied` and from `authority-unavailable`. It MUST NOT carry `requiredAuthority: human-admin` and MUST NOT mint an admin-required InterventionItem (an fs failure must never be reported as a governance escalation).

### Approval and proposal integrity (closes MAJOR-8/9/10/11/12/13/15/17)

- **A1-8** Approval-requiring proposals bind **mandatorily** to base generation **and** base snapshot identity (`baseGeneration` + `baseSnapshotId`; A4-3 withdrew the earlier "base snapshot hash" — identity plus an immutable generation already pins content). Empty overlay history = `baseGeneration: 0` with `baseSnapshotId: null`, never a missing field (no "if present"). Commit validity = structural equality of the recomputed `(before, after, region-set)` **and** recomputed rise ≤ approved ceiling; any other result is `mutation-stale` with zero write.
- **A1-9** Caller-chosen `mutationId` and free-text reason are **provenance, not fingerprint**. A denied semantic fingerprint may not be re-proposed for the same `(team, target, baseGeneration)`; a new base generation is required to re-ask.
- **A1-10** Review-leg identity = `f(approvalCaseId, legOrdinal, previousRequestId)`; escalation never reuses the parent request id; an abandon mark applies to a **leg**, never to the case, and cannot silently bypass a reviewer the case was escalated past. Idempotency of `requestControl` is preserved by the leg ordinal.
- **A1-11** `escalate` must be **product-reachable**: `team_resolve_control` accepts it and the pending-approval list spans approval cases, not only the `leader-approval` carrier kind. `packages/tools/src/tools.ts` enters PR4's file list.
- **A1-12** **Unresolvable reviewer set terminates synchronously before any leg row is written**, with `authority-unavailable` naming the missing class. This covers absence of Leader, absence of Human User, and cases whose required authority is `human-admin` (unimplementable in Alpha.4). Such items MUST NOT use `responseBehavior: wait-for-response` or a non-null `blockScope`.
- **A1-13** Target lifecycle state is part of the frozen case/proposal identity: an expansion approved while the target is live and found `archived` at commit is `mutation-stale` (today only `disposed` is refused, and restore preserves the latest overlay — that combination must not become effective without a fresh decision).
- **A1-14** The **fresh authority recheck happens at the consumption point**: inside the operation guard, under the per-team lock, before the consumption fact is recorded — not only in the pre-execute adapter. The guard is never authority-blind.
- **A1-15** `operationFingerprint` is **mandatory** for v3 operation cases; an `allow` recorded without one may not be consumed.

### Intervention plane, warnings, and compatibility (closes MAJOR-14/16, F1/F2/F3/F4/F6/F9/F10, NOTE-25)

- **A1-16** Warnings: until acknowledged, the affected configuration operation (**publish** / **Leader activation**) waits — this makes explicit what ADR §24 left silent. Warning and intervention surfaces must serve **not-yet-live roots** (drift detected at cold resume must be ack-able before the root becomes live).
- **A1-17** Intervention boundary gets a mechanism, not just wording: no import edge from the evaluator / authority kernel / control service / operation guard to `intervention/**`; the administration read DTO strips authority-bearing and round-trippable decision fields; a lane-hygiene test pins both. `intervention.act` MUST enter the same request-idempotent `ControlService` entry point and never re-implement decisioning.
- **A1-18** `PermissionMutationEnvelope` / `PermissionEnvelopeRule` **aliases are deleted in PR7** (canonical `AuthorityEnvelope`), and PR7 re-pins the one golden contentHash literal in test code.
- **A1-19** Factual correction to spec §3.2: `permissionMutationEnvelope` is **optional today at every document version** (typed absent = no authority). v3 makes it **required** — a new hard requirement, not a retention. v1/v2 keep it optional through the PR1–PR6 bridge; PR1 adds the v3-missing-carrier RED test.
- **A1-20** Cold-resume cutover must: (a) **resolve and parse** the bound Blueprint, because durable rows carry only `{id, revision, contentHash}` and no document version; (b) treat pre-repair rows with **no blueprint reference** — which today resolve to the host boot anchor "by definition" — as **migration-required**, so a v3 boot anchor cannot let a v1-era Team resume on silently rebased authority; and (c) **not fail the entire host boot** for a v1/v2 boot-anchor Blueprint: PR7 migrates the boot anchor first and/or exposes a loud degraded boot that still reaches the live plane, because an operator who cannot boot cannot "migrate the Blueprint and create a new Team".
- **A1-21** Typed names stay distinct: `BLUEPRINT_SCHEMA_VERSION_UNSUPPORTED` / `BLUEPRINT_MIGRATION_REQUIRED` are new codes; overloading `SCHEMA_VERSION_UNSUPPORTED` / `SCHEMA_VERSION_MISMATCH` is forbidden.
- **A1-22** Shell-class ceilings are decided now rather than left to delivery pressure: shell rules remain fingerprint-only with exact-equality coverage, so **no broad shell allow/deny exists**; shell `ask`s route by the ladder per A1-4. Introducing broad shell ceilings requires a new ADR, not a matcher loosening inside Alpha.4.

---

## Amendment A2 (2026-10-07) — architecture and contract closures

Normative. Precedence is governed by **Global Precedence** at the end of this document, not by this preamble. Provenance: the architecture/contract review lane, which returned **BLOCK** on three items and explicitly cleared the filesystem-seam question (**not** a `CORE_SEAM_BLOCKER`).

### Three blocking defects

- **A2-1 Escalation is never an authorization value.** `escalate` MUST NOT enter `CONTROL_DECISION_VALUES`. It is recorded as an additive terminal-leg fact, and the last-mile guard becomes an exhaustive decision switch with a typed refusal for every non-`allow` value — the current shape (branch on `stale-denied`/`deny`, then a comment `// decision === 'allow'` and fall through to authorization) would otherwise turn the first `escalate` row into an implicit approval. Blocking RED test: *a leg decided `escalate` produces zero guard authorization*.
- **A2-2 Proposals are durable records with an owner.** Alpha.4 adds **Task 0 / A4-PR0 — Durable Governance Proposal Substrate**, landing before PR1. Storage stays **ledger-first** (a new `factType`, no new stamp, no store-rewrite) because the appended-last store bootstrap contract is frozen — but an authority-bearing payload MUST be read through a **strict parser with a typed corrupt outcome**. Reusing Control's lenient payload parser is forbidden: today a malformed row reads back as *absent*, and an absent proposal must never be a legal reading of a proposal row.
- **A2-3 The shared grammar lives in `domain`; canonicalization stays in `runtime`.** The envelope AST, matcher grammar, and effective-ceiling lattice live in `packages/domain` (the only legal dependency edge is runtime → domain, and `domain` depends on nothing but `yaml`). A thin runtime adapter supplies canonicalization/containment. `domain/blueprint`'s parser performs no path canonicalization and none will be added there; the duplicated Blueprint-side grammar is replaced by importing the shared grammar. There is no Blueprint-side canonicalizer to "unify with".

### Semantics and compatibility

- **A2-4 Which algebra, when.** A v1/v2-bound Team keeps **existential coverage** semantics until PR7; v3 uses effective-ceiling (`min`) semantics. This must be stated in the compatibility sections of every PR, and PR7's migration guidance must report, for a migrated Blueprint, the set of envelope cells whose decision changes under the new algebra. The swap is behaviour-visible on live blueprints and is currently untested: PR1's overlap/monotonicity matrix is a blocking RED-first test, and the tests whose *meaning* changes are named in PR1's file list.
- **A2-5 Indeterminable coverage does not annihilate authority on the new plane.** On v3, a non-canonicalizable subtree rule yields `undetermined` and the typed `authority-undetermined` outcome (A1-6/A1-7) — not a silent zero-authority refusal that retroactively voids a wide grant. v1/v2 keep today's `undeterminable ⇒ no authority` law until PR7.
- **A2-6 Whose basis (RETIRED as to document selection — see A3-1).** Only the canonicalization part of this clause survives: canonicalization uses the **beneficiary member's** workspace basis as it does today, never the initiator's. The claim that the beneficiary's carrier selects *which ceiling document applies* is withdrawn — under A1-4 both ceiling documents always narrow, for every reviewer and every beneficiary.
- **A2-9 Strict parsing is a hard requirement** for every authority-bearing durable payload (proposals, cases, legs, warnings): malformed ⇒ typed corrupt outcome ⇒ fail closed.
- **A2-10 Cutover blast radius is disclosed, not discovered.** PR7 owns `packages/runtime/src/plugin/host.ts`: the boot-anchor Blueprint is strong-parsed at **plugin construction**, so a v1/v2 anchor must be migrated before v3-only parsing lands; PR7 reuses the existing typed unsupported-version outcome already produced by `domain/blueprint/inspect.ts` and must never convert a per-Team migration condition into a plugin-wide boot failure.
- **A2-11 Version union and byte stability.** `SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS` widens to `1|2|3`; every new field is written only under the absent ⇒ key-omitted discipline; PR1 pins byte-identity of the v1/v2 hashable views with the new fields absent.
- **A2-12 Authority envelopes are not policy-referenceable** — asserted by a PR1 RED test, since today the exclusion is enforced but unpinned.

### Control-plane mechanics

- **A2-7 No new Control request kind.** Approval cases reuse the existing `leader-approval` / `user-approval` kinds; the Alpha.4 authority level is an additive payload field. `CONTROL_RESOLVER_ROLES` remains closed, so the Remote catalog, params, and client are untouched by the vocabulary change.
- **A2-8 `stale-denied` keeps its present meaning** (target terminal at decision time). Authority or identity drift gets a separate `terminalReason`; the existing reasons enum is not overloaded.
- **A2-13 What a frozen matcher freezes.** Per rule: `{ declaredPath, cwdBasis, contentHash, canonicalKey, fsVersion? }`. Drift is defined as `resolve(declaredPath).key !== frozenKey`; delete-and-recreate at the same path is invisible to realpath and is detected through `stat().version`. Acceptance criteria are phrased as **canonical-root retarget**, never as link-type detection (a Windows junction reports `type: 'directory'`).
- **A2-14 One canonicalization owner.** The permission plane's existing helpers remain the only canonicalization/containment owner (deliberately uncached); new evaluator and authority-fact modules delegate to them and never cache a canonical key.
- **A2-15 The Team-start governance gate has an owner or does not exist.** PR6 owns `activation/checks.ts` and `admission/requirement-gate.ts` with ensure-root-live tests; otherwise the gate is deferred post-Alpha.4 rather than shipped ownerless.
- **A2-16 The single durable authority writer is structurally pinned.** PR5 gate: a test asserting exactly one overlay `.append(` call site outside tests.
- **A2-17 Naming collisions are named, not improvised.** `teamHardEnvelope` sits beside the pre-existing, unrelated token envelopes `teamEnvelope` / `memberEnvelopes` — no abbreviation in docs or code. Two distinct `CONTROL_DECISION_VALUES` constants exist; Alpha.4 imports only the Control one, and a test pins the import.
- **A2-18 Model-facing text follows the algebra.** The tool descriptions that state "an EXPANSION requires explicit carrier coverage" are updated in the PR that changes the algebra, with the tools/remote description pins checked.

---

## Global Precedence (2026-10-07, A3)

Applies to every amendment in this document and to the spec/plan amendments:

1. **A5 > A4 > A3 > A2 > A1 > the amendment-free body.** An earlier preamble's "supersedes the text above" claim confers no extra authority; only position in this order does.
2. **Ceilings are never relaxed by ambiguity.** Where two clauses can be read so that one keeps a restriction and the other drops it, the **restriction-preserving** reading governs, and the conflict is a defect to be closed in place — never a choice an implementer makes.
3. **No amendment may be implemented by editing only itself.** Any clause that changes a semantic MUST be applied in place to the section an implementer reads as their task (spec §7.4, §21.4; plan task bodies), because a checkbox-driven implementer follows the task text, not the appendix.
4. **Verified facts outrank reviewer claims.** Two round-2 findings cited paths that do not exist (`packages/contracts/src/control.ts`, `packages/runtime/src/control/types.ts` for a decision-value union; the real durable vocabulary is `packages/runtime/control/types.ts:169` = `allow | deny | stale-denied`, and `'escalate'` appears nowhere in `packages/**` as a value). Cite, verify, then write.

## Amendment A3 (2026-10-07) — round-2 closures

Normative under Global Precedence. Provenance: round-2 independent verification (security lane **BLOCK**, narrowly; architecture lane **SUPPLEMENT**), plus the coordinator's own re-verification, which corrected both lanes on specific points.

### Blocking

- **A3-1 (F-N1) Both ceiling documents always narrow; the carrier never selects a document.** For every one-shot approval and every durable mutation, the applicable restriction set is **always** `teamHardEnvelope` **and** `permissionMutationEnvelope`, evaluated independently against the operation scope, regardless of who the reviewer is and regardless of whose carrier the rule came from. The beneficiary selects only the canonicalization **basis**. Rationale for the retirement of A2-6's selection clause: with a member beneficiary, the Alpha.3 carrier *is* the mutation envelope evaluated at the target's basis (`governance/permission-mutation.ts:1042`), so a literal implementation never consulted `teamHardEnvelope` when a Human User approved a member ask — voiding the hard ceiling for exactly the approvals A1-4 preserved it for. This is the canonical instance of Global Precedence rule 2.
- **A3-2 Required authority is derived, never declared.** Two functions, never `min()`'d together (this replaces §24.3's ill-typed formula):
  - `mayReview(reviewer, case)` — ladder + the case's `requiredAuthority` (A1-3, A1-12, A2-7); answers *who may act*.
  - `grantCeiling(reviewer, scope) = meet over { narrowing(d, scope) | d ∈ bindingDocs(reviewer) }` — **which documents bind is fixed by the reviewer's ladder position (A5-1)**, restriction-only per A1-4
  An approval is legal iff `mayReview(...)` **and** `desiredEffect ≤ grantCeiling(...)`. `requiredAuthority` rises only when `desiredEffect` exceeds the current reviewer's `grantCeiling`. **The dangling term "minimumAuthority of the matched permission rule" in A1-4 is struck**: it names no field in any schema and has zero code references; no such field may be introduced — a permission rule's own `deny`/`ask` lane plus the ladder is the whole of the source, as §7.2 already specifies.
- **A3-3 In-place semantic repair is part of the closure.** §7.4 and §21.4 of the spec, and plan Task 3's "Decision adds `escalate`" / lane A "Add `escalate` decision value", are corrected in place (done in this round), because they ordered the exact shape A2-1 forbids and the ceiling-routing deadlock A1-4 rejects. `escalate` is a **reviewer action** (ADR §12) recorded as an additive leg fact; the durable decision vocabulary stays `allow | deny | stale-denied` (`control/types.ts:169-182`).
- **A3-4 The exec dual-gate's v3 disposition, decided.** The Alpha.3 dual-gate (leader shell-class `allow` downgraded to `ask` when the mutation envelope lacks the exec fingerprint, `operation-permission/pre-execute-adapter.ts:1406-1443`) is **retained in v3 as a restriction of the effect plane, keyed on a matching shell rule**: when an envelope contains a shell-class rule, that rule caps exec to its fingerprint scope (A1-22), and a non-matching fingerprint narrows to `ask`; when an envelope contains **no** shell-class rule at all, it imposes no narrowing (A1-4) and the permission rule alone governs. Recorded residual risk, deliberately accepted: a Team whose envelope never mentions shell gets no envelope-derived exec ceiling — the ceiling is not the only control, the permission rule is. PR4 must enumerate this in the "no v1/v2 behaviour change" test **and** add a v3 test pinning both branches.

### Executability closures

- **A3-5 PR0 is a first-class PR.** It enters the merge-order table, the review order, the per-PR gates (baseline-diff, `pnpm build` + `build:composition` + `check:artifacts` dist co-commit, RED-first, evidence dir, targeted security reviewer for the corrupt-read path), and the Expected-Stable-Plugin-State list. **PR0 receives the authority to recompute the `p4t6` scannable-inventory pin**, which the plan had assigned to PR1 — otherwise PR0 cannot satisfy its own gate without violating the plan's single-writer rule.
- **A3-6 No storage edit is needed, and PR0's named file was a no-op.** `factType` is an open hygienic string by contract (`packages/storage/schema/ledger.ts:15-17, 87-88`; `plugin/durable-mutation-store.ts:81` "open factType vocabulary") and the ledger repository whitelists nothing (`storage/repositories/ledger.ts:139, 241`). So PR0 names instead: `packages/runtime/governance/proposal-store.ts` (append + strict read + typed `corrupt-record` outcome), the factType name **`governance-proposal-recorded`** (append-only; supersession by a newer fact, never a mutation), and its error-code home: a **lane-local** table `governance/proposal-codes.ts` (A4-1 — the earlier "the plugin's typed code module" wording is withdrawn; no lane value-imports from `src/plugin/**`). The "no new store" rationale is verified: `TEAM_DOMAIN_ADDITIVE_STORES = ['permission_overlays']` is appended-last with empty-table-only bootstrap (`storage/schema/stores.ts:76-97`).
- **A3-7 A new factType MUST be registered in the projection category map, or the read plane fails closed.** `plugin/projection-source.ts:223` holds `FACT_TYPE_CATEGORY`, and an unmapped fact type throws `TEAM_PROJECTION_SOURCE_LEDGER_CATEGORY_UNKNOWN` — "refusing to misclassify" (`:766`) — which would break the ledger read plane for the whole Team, not merely render a row oddly. PR0 owns the mapping entry; the target is the existing **`policy`** category (a permission-state mutation proposal, not a ControlRequest/Decision), and the **eight frozen categories are not extended**; PR6 owns the client-side mapping (`client/src/model/ledger-adapter.ts:330-337`) so the row is never generic/uncategorized.
- **A3-8 Home adjudicated: a durable proposal is its own fact, not a Control payload.** The existing `reviewPayload`/`reviewPayloadDigest` on a Control request are a *request's* evidence; a mutation proposal must exist and be re-validatable before any Control row exists (A1-8/A1-9), so it gets its own fact family. Both are required to be strict-parsed (A2-9).
- **A3-9 Shared grammar: names, winner, and vocabulary.** The shared AST is the **Blueprint/config shape** `{ kind, path | fingerprint }`, because it is bound into the Blueprint contentHash (`blueprint/src/validate.ts:770, 1672-1679`) and the alternative would silently rewrite every existing hash (violating A2-11). The runtime `{ kind, resource }` shape (`governance/permission-mutation.ts:272-276`) becomes an **adapter** at the runtime boundary, with the lossy direction (resource → canonical path) documented and performed only through the injected containment seam. The effect vocabulary is **structurally re-declared in `packages/domain`** with a compile-time mutual-assignability test against `PermissionOverlayEffect` (`storage/schema/permission-overlay.ts:127-134`): no `domain → storage` edge, no edit to the frozen `contracts` package. Correcting A2-3's overstatement: `packages/domain`'s *package dependencies* are `yaml` only, and it imports `contracts` by relative path (41 sites); what it must never import is `runtime` or `storage`. Follow-ups are PR1's: the new module directory is added to `packages/domain/tsconfig.json` include (else `pnpm typecheck` never sees it) and the lane-hygiene walk's roots gain `domain` (roots are `['runtime','tools','remote','client']` today, `runtime/test/a3p3-governance-lane-hygiene.test.ts:118`).
- **A3-10 The single-writer test, restated truthfully.** A2-16's "exactly one `.append(` call site" is false on today's tree — there are two, the kernel (`governance/service.ts:707`) and the lane port adapter (`permission-governance/overlay-repository.ts:71`). The invariant is **one funnel**: exactly one kernel writer, the adapter as its only wrapper, and no third call site; the test asserts those three things.
- **A3-11 Cutover owners corrected.** The earliest construction-time anchor parse is `plugin/blueprint-authority.ts:232` (called from `plugin/host.ts:1695`), then `host.ts:1874`, then `plugin/root.ts:883`: PR7 owns **all three**. A2-10's "reuses the existing typed unsupported-version outcome from `inspect.ts`" is withdrawn — `inspect.ts` is the deliberately **weak** identity inspector whose unsupported-version is an *inspection reason*, while the strong parse throws `SCHEMA_VERSION_MISMATCH` (`validate.ts:1184`), the code A1-21 forbids reusing. PR7 therefore uses A1-21's `BLUEPRINT_SCHEMA_VERSION_UNSUPPORTED` / `BLUEPRINT_MIGRATION_REQUIRED`, and must keep `inspect.ts:169` able to **list** v1/v2 sources with that reason (it is the catalog-assisted migration surface: narrowing it would make the unmigrated set undiscoverable). Expressibility is confirmed and this is **not** a `CORE_SEAM_BLOCKER`: `apply()` already resolves and routes construction failure to the facade `ready`, and route registration needs only a constructed root.
- **A3-12 Escalation mechanics are specified, not implied.** (i) The inline waiter on an escalated leg terminates with the caller-visible typed outcome `escalated` — no authorization, no lingering `requestId` to poll, and the abort cascade is unchanged; §24.2's vocabulary gains that cell. (ii) The leg fact has a durable shape: factType **`control-escalation-recorded`**, fields `{ approvalCaseId, legOrdinal, previousRequestId, escalatedBy, reason }`, written by the same Control write path. (iii) `stale-denied` may **not** be reused for escalation even though it fails closed — it asserts a false fact (target-terminal) and the UI labels it "stale" (`client/src/ui/TeamLedger.tsx:200`). (iv) The blocking RED test is re-shaped, because as written it could never be RED: foreign decision values are dropped by the read gate (`control/service.ts:711-719`) and never reach the guard. The test instead injects the value at the **guard's own decision input** and asserts refusal — RED today (the guard falls through after two branches, `:2236-2252`), green after the exhaustive switch.
- **A3-13 The Team-start governance gate is on the real path.** `ensureRootLive` lives in `plugin/root.ts` and `plugin/s6-remote.ts` (both PR6-owned), not in `activation/checks.ts` (the activation chain) or `admission/requirement-gate.ts` (the compatibility gate). A2-15's deferred escape hatch is removed: spec §21.1's acceptance row ("Team start blocked when governance authority is unmet") is binding, so PR6 ships it or the row is struck by the user, not by an implementer.
- **A3-14 Dead names and dead pointers are defects.** Round-2 reported that these documents cited a Control request kind named `permission-envelope-mutation`; that string appears **nowhere** in the tree and, on re-check, no longer appeared in these documents either — the finding was reported against an intermediate draft. Recorded anyway, because the durable rule is what matters: the only real kind value is `'envelope-mutation'` (`control/types.ts:129`, resolver closure `:156`), these documents use exactly that spelling, and A2-17's ban on improvised naming binds the amendments themselves. Dead pointers that WERE real are fixed in place: the plan's `docs/plans/drafts/…` Spec/ADR pointers and its Alpha.3 user-facing document pointer (actual location: `dev/agent-workflow/evidence/alpha3-pr5-notification-projection/ALPHA3-PERMISSIONS-USER-FACING.md`). Plan pointers to `docs/plans/drafts/…` and to `docs/plans/active/alpha3-permission-governance/ALPHA3-PERMISSIONS-USER-FACING.md` are corrected (the latter lives at `dev/agent-workflow/evidence/alpha3-pr5-notification-projection/`). A2-17's ban on improvised naming applies to the amendments themselves.
- **A3-15 Relevance filtering is gone, in the body too.** §5.2's "potentially relevant subtree rule" is reworded to A1-6's law: containment is decided for **every** same-class subtree rule; nothing is filtered by guessed relevance.
- **A3-16 Fixture inventory, corrected and owned.** *(Inventory restated by A5-9: 18 files under a defined predicate; `packages/testkit/domain/src/scenario.ts` and `packages/tools/src/tools.ts:961` are struck as version sites.)* `scripts/fixtures/composition-smoke/team-blueprint.yaml` does not exist and `scripts/composition-smoke.mjs` contains no blueprint at all — both are struck from PR7's list. The verified inventory is **18 files (A5-9 predicate; two files struck)** carrying `schemaVersion: 1|2` across `tests/kits/**`, `scripts/blueprint-authoring.mjs:92` (the authoring helper *emits* v1 skeletons, pinned by `packages/testkit/test/bp1h-blueprint-authoring.test.ts:95,128,149`) and `packages/runtime/root-binding/harness/blueprint-source.mjs:30`; the golden contentHash pins are **two**, not one (`packages/runtime/test/a3p4-pr4-production-entry-regression.test.ts:2115` in-gate **and** `tests/kits/pr-f-closure-smoke/pr-f-closure-smoke.mjs:389` out-of-gate). Because those kits are exactly the live-host/Chrome lanes pre-adjudicated as environment-blocked (A1.5), **no runtime test can enforce this**: PR7 owns a static scan, `scripts/verify-blueprint-version-clean.mjs` (precedent: `scripts/verify-zero-core.mjs`), wired into the PR7 gate.
- **A3-17 Accepted-and-disclosed non-closure.** A1-9's denied-fingerprint suppression is bypassable by any self-tightening mutation that bumps `baseGeneration` (a leader may commit those directly per §18). It creates friction, never authority, so it is recorded rather than closed. Likewise the v1/v2 bridge teams retain the legacy self-request/self-resolve shape **by construction**; that is now named as a temporary security exception with a PR7 retirement, not left implicit.

---

## Amendment A4 (2026-10-07) — substrate rulings from the PR0 code-surface survey

Normative under **Global Precedence**. Provenance: the A4-PR0 code-surface survey plus the coordinator's own re-verification of each claim. The survey answered "what does the code already force on us"; the four questions it could not answer are ruled here.

- **A4-1 Error codes stay lane-local (ruling on survey C1).** A proposal store in `packages/runtime/governance/` MUST NOT take a value import from `src/plugin/**`: `src/plugin/types.ts` contains only type-only imports and no lane in the tree value-imports anything from `src/` (`governance/permission-mutation.ts:136` records the cycle reason, and the a3p3 leaf-only leg exists for it). The corrupt-record codes therefore live in a lane-local closed table (`governance/proposal-codes.ts`, shaped like `PERMISSION_MUTATION_ERROR_CODES`). If the plugin surface needs one of these codes at wire time (PR5/PR6), add ONE additive entry to `TEAM_PLUGIN_ERROR_CODES` then — never an upward edge now. This corrects A3-6's phrase "its typed error-code home (see A4-1: a lane-local table, **not** a module under `src/plugin/`)".
- **A4-2 A proposal append is generation-bearing, and that is safe.** Every new ledger fact advances `team_sessions.generation` (`repositories/ledger.ts:213-215` → `teamSessions.advanceGeneration`) under the frozen S1-A "state durable before stamp" rule, and a replay advances nothing. This does **not** weaken A1-9's re-ask discipline: there are **three** distinct live counters and they must never be conflated: (1) the team-session stamp `team_sessions.generation` (`storage/repositories/team-sessions.ts:119-141`), which only the projection surfaces (`runtime/projection/fold.ts:99`); (2) the **override slot-winner** generation, compared under `OVERRIDE_GENERATION_CONFLICT` at `governance/service.ts:295-305` over `selectSlotWinner(...)` — this is the one my first draft mislabelled, corrected here; (3) the **overlay snapshot** generation, compared under `PERMISSION_MUTATION_ERROR_CODES.GENERATION_CONFLICT` at `governance/service.ts:615-624` against `overlay.latest(...).metadata.generation`. **A proposal append advances only (1)**, which nothing compare-and-sets on, so it cannot disturb either guard. Disclosure: a new fact family makes the *displayed* session generation tick faster, so any test that counts generation after N facts will move. `putPreTeam` is not a way around this — it is reserved for pre-TeamSession rows and would break the appended-last stamp family (~15 pins). PR0's module doc block must state the counter distinction explicitly.
- **A4-3 `baseSnapshotHash` is withdrawn; the durable revalidation key is `baseSnapshotId` + `baseGeneration`.** A content digest would duplicate an invariant the durable layer already enforces with typed outcomes: `snapshotId` is the derived identity `<teamSessionId>#<memberInstanceId>#<generation>`, overlay history is immutable and byte-stable, so identity + generation already pins content, and the append path refuses a moved base with `previous-snapshot-id-mismatch` / `generation-conflict` (`repositories/permission-overlays.ts:46-51`, restart-pinned in `permission-overlay-restart-persistence.test.ts:62-77`). Withdrawal also avoids a pointless ownership question: hashing is not scarce — `node:crypto` already has three production owners (`domain/blueprint/src/hash.ts`, `domain/compatibility/src/fingerprint.ts`, `runtime/artifact-read/digest.ts`), the first of them lane-importable. My first draft of this clause claimed `digest.ts` was "the single sanctioned owner"; that was wrong and is corrected here. The decision never depended on it: identity plus an immutable generation is what makes a digest redundant. If a future requirement genuinely needs a content digest, whoever needs it proposes the digest domain and the `node:`-owner ruling at that time. The empty-overlay case is expressible without a hash: `baseSnapshotId = null` plus `baseGeneration = 0`. **`baseGeneration` is counter (3), the overlay snapshot generation** — never the team-session stamp and never the override slot winner. `baseSnapshotId` is the source of truth and `baseGeneration` is the value it embeds (`snapshotId = <teamSessionId>#<memberInstanceId>#<generation>`), so a recorded pair that disagrees is corrupt, not stale. And because the append-boundary refusals fire on **caller-supplied** values, a store that merely records the pair could commit against a head nobody re-checked: commit revalidation MUST read `overlay.latest(...)` and compare both recorded fields against the durable head before applying, terminating `mutation-stale` with zero write on any mismatch (A1-8).
- **A4-4 The category-map hazard gets its own PR, first.** `control-request-abandoned` is written to the ledger by merged Alpha.3 code (`control/service.ts:257`, `:1818-1826`) and is absent from `FACT_TYPE_CATEGORY` (`src/plugin/projection-source.ts:223-250`), while the fold throws `LEDGER_CATEGORY_UNKNOWN` for any unmapped fact type on **every** projection read (`:762-768`, called at `:403`) — so one abandoned inline request breaks `team.getProjection` for that Team permanently. The three abandonment tests never read a projection (verified: zero projection references), and the lanes that would catch it are the environment-blocked live-host ones. Fix = `A4-PR0a` (see `docs/plans/issue-fix/a4-pre0-ledger-category-closure.md`), which additionally lands a **closed-set guard test**: every fact type written by production sources must be registered in the host (and where applicable client) category maps, so a new fact type fails a test instead of a customer's projection. **The guard's derivation is specified to resolve identifiers, not literals** (round-3 N11): production writes its fact types through module constants (`control/service.ts:257,1244,1515,2331`, `durable-mutation-store.ts:297`, `src/plugin/host.ts:2575`, `messaging/coordinator.ts:565`, `readiness/telemetry.ts:195`), one lookup table (`activity/facts.ts:187 OP_TO_FACT_TYPE`) and one typed parameter (`requirements/facts.ts:333`); only six sites use inline literals. A literal-only scan would have missed the very defect this PR exists to fix, and would miss both Alpha.4 fact types, since both will be constants. The guard therefore resolves same-file and imported constant definitions and table values (the way `projection-source.ts` itself resolves them), and it MUST assert positively that its derived set **contains** `control-request-abandoned`, `governance-proposal-recorded` and `control-escalation-recorded` — a derivation that silently under-collects fails loudly instead of policing nothing. Verified positive to cite in the fix doc: an independent sweep of every production `factType` write against the resolved `FACT_TYPE_CATEGORY` key set found `control-request-abandoned` to be the **only** unregistered type (19 others map), so PR0a's green scope is one entry plus the guard. A4-PR0 depends on it.
- **A4-5 The proposal payload must not use a member-addressing key.** Retained-history attribution folds facts by **payload key**, not fact type (`FACT_ADDRESSING_KEYS = ['instanceId','targetInstanceId','recipientInstanceId','deliveredToInstanceId']`, `projection-source.ts:835-851`, fold `:870-915`), so naming a proposal's subject with any of those keys silently changes a DISPOSED member's digest. The proposal uses `targetMemberInstanceId`, and one test pins that disposed-member digests are unchanged by proposals. **Disclosed trade-off:** because the proposal is deliberately not attributed through the addressing keys, a disposed member's retained history will **not** list the proposals made about it — correct for digest stability, and PR6's audit surface must say so out loud rather than let the reader conclude the history is complete.
- **A4-6 PR0 does not reach `dist`.** Nothing in `src/` imports the proposal module during PR0, so the TypeScript program never reaches it and `check:artifacts` stays green with no dist churn; PR5 wires the substrate and co-commits the emitted files. (My first draft said `tsconfig.build.json` "names no lane directory" — wrong twice: it lists 21 lane directories and simply omits `governance`, and `include` would not gate emission of a transitively imported file anyway. The importer argument is the real one, and PR5's dist claim rests on it.) Corollary PR0 must own: **its own RED test is the only thing that type-checks the module** during PR0, so the test file must be inside the vitest include pattern (`packages/*/test/**/*.test.ts`). PR0 also imports neither `./permission-mutation.js` (a3p3's zero-consumer allow-list) nor any storage repository type at runtime — writer and reader are structural ports — and adds no method to `createGovernanceMutationService`, whose key set is pinned.
- **A4-7 "Corrupt never reads back as absent" is a two-leg gate.** Payload-level corruption of an entry-valid row is the only case any reader can report, because entry-level corruption throws inside `ledger.list()` before a parser runs (`repositories/base.ts:76-92,105-125`; `schema/ledger.ts:226`). PR0's gate therefore asserts BOTH: a typed corrupt outcome naming path/field/sequence, with the row still present in `list()`; and, for entry-level corruption, an asserted throw — never an empty result.

---

## Amendment A5 (2026-10-07) — round-3 closures: positional ceilings, exec gate preserved, escalation mechanics

Normative under **Global Precedence**; round-3 review (security lane BLOCK, architecture/feasibility lane SUPPLEMENT) is the provenance. Every clause below was re-verified against code or against this document's own frozen text before being written; one reviewer item is recorded as **refuted** rather than adopted.

### Ceiling model (closes F-N1 residual + F-N4)

- **A5-1 (BLOCK) Ceiling documents bind by the reviewer's ladder position, not by the beneficiary and not universally.** A3-1's "always evaluated" was correct; A3-2's formula over-generalised it into "binding for everyone", which contradicts this document's own §15 ("Human User one-shot approval is bounded by `teamHardEnvelope`" — alone), the §3.2 decision matrix (a Human Admin may always `allow`), spec §21.6 ("Leader proposal beyond Leader envelope but within Team Hard → Human User approval"; "beyond Team Hard → Admin required"), and the plan's own pinned expectations at Task 2 ("Pin Human User ceiling = Team Hard envelope"). Binding is therefore:
  - `bindingDocs(leader) = { teamHardEnvelope, permissionMutationEnvelope }`
  - `bindingDocs(human-user) = { teamHardEnvelope }`
  - `bindingDocs(human-admin) = { }` — the top of the ladder is bound by no envelope; if it were, the §3.2 row "Human Admin → allow | deny" would be unsatisfiable and every unapprovable case would dead-end with nobody able to act.
  - Member is not a reviewer (self/same-level approval never legal).
  Round-2's F-N1 hole **stays closed** by two independent laws: both documents are always *evaluated* (never selected by carrier or beneficiary), and a Human User approving a **Member** ask is still capped by `teamHardEnvelope` — which is exactly the ceiling round 2 found unconsumed. Worked example, §15 unchanged: hard `A/** = allow`, mutation `A/** = ask`, Member one-shot ask `ask → allow`: Leader's `grantCeiling = ask` (insufficient) → rises to Human User, whose only binding document is the hard ceiling = `allow` → the Human User approves. No dead-end, no Admin involvement.
- **A5-2 The effect lattice is total over decided values, and `undetermined` is not a lattice element.** Ordering `deny < ask < allow`. If any binding document yields `undetermined` for the scope (containment undecidable, A1-6), `grantCeiling` **is** `undetermined`, the approval is not legal, and the outcome is the typed `authority-undetermined`; it is never coerced into `deny` or `ask`, and it never silently widens. §7.3's output carries `ceilingUndetermined` so a caller cannot mistake an absent ceiling for a permissive one.
- **A5-3 The effect vocabulary is named, once.** `desiredEffect` and every ceiling value are of the **approval-plane** effect vocabulary: `PermissionOverlayEffect` (`packages/storage/schema/permission-overlay.ts:128`) structurally re-declared in `packages/domain` per A3-9. The shell class is an **operation class**, never an effect value, and never appears in §7.2's input; the exec restriction of A5-4 is a capability-autonomy rule, not a ceiling (A2-17's naming discipline).
- **A5-4 (refuted-then-corrected) The exec dual-gate is preserved exactly as it behaves today; A3-4's narrowing-by-absence and its accepted residual are WITHDRAWN.** Re-derivation against the real identity: the gate keys on **tool-name tokens** — `execEnvelopeOps` is the exec-authorization token set of the leader's effective mutation envelope (`teamEnvelope ∩ leader template memberEnvelopes`), consumed as `execEnvelopeOps.includes(name)` (`packages/runtime/src/plugin/live/agent-bindings.mjs:2399-2416`, `packages/runtime/operation-permission/pre-execute-adapter.ts:1422-1427`) — and it is **already fail-closed**: an absent blueprint or absent team envelope yields *no* exec authorization, so a Leader shell-class call is downgraded to `ask`. Authority-envelope shell rules carry **fingerprints** (`packages/domain/blueprint/src/validate.ts:770,1672-1679`) which can never equal a tool name, so A3-4's "matching shell rule caps exec to its fingerprint scope" is unwritable, and its "no shell rule ⇒ no narrowing" branch would have **reversed** production behaviour: `{ rules: [] }` — the documents' own maximally restrictive Leader setting — contains no shell rule, so A3-4 as written would let a Leader `bash` rule execute with zero durable approval where today it fails closed (`packages/runtime/test/exec-contract-dual-gate.test.ts:278,314,547`). That was a real regression I nearly legislated, and the disclosed "residual" was the exploit itself. v3 keeps the gate as-is (fail-closed on token absence, tool-name identity), and A1-22's fingerprint-only rule governs **Blueprint authority-envelope** shell rules — a different document, never the mutation envelope's token set. PR4's test pins both branches of the existing behaviour.
- **A5-5 (N2/N4) Escalation mechanics are named, and they wake the waiter.** `awaitControlDecision` resolves a `ControlDecisionRecord` (`packages/runtime/control/types.ts:900-904`), so an escalation that writes only a leg fact **hangs the inline caller** — A3-12 was incomplete. Escalation is therefore two writes in one team-chain transaction: (i) the append-only leg fact `control-escalation-recorded` (A3-12(ii)), and (ii) a terminal decision row on the **closing** leg with `decision: deny` and the additive reason `escalated` — added to `CONTROL_DECISION_REASONS` (`packages/runtime/control/types.ts`, currently only `EXTERNAL_POLICY`; exported at `control/index.ts:117`), which is a closed **reason** vocabulary and explicitly not the decision vocabulary A2-1 protects. `deny` is already non-authorizing on both consumers (`control/service.ts` guard, `action-router/router.ts:615-624`), so no guard change is needed for safety; the exhaustive `switch` requirement stands as defence in depth. The next leg is a new ApprovalCase leg at the risen authority; `requiredAuthority` for the case never decreases.
  The RED test is now writable and is RED because no escalation path exists at all: resolve a Member ask with an escalate intent, then assert (a) the waiter resolves terminal with `deny` + reason `escalated`, (b) the guard authorizes nothing, (c) a leg exists at the higher authority, (d) no decision row carries a fourth decision value.
- **A5-6 (N1) A new fact type is registered in the same PR that writes it — enforced mechanically.** `control-escalation-recorded` gets its `FACT_TYPE_CATEGORY` entry (`policy`, same rationale as `governance-proposal-recorded`) **inside PR3**, and PR3's file list now names `packages/runtime/src/plugin/projection-source.ts`; the same PR must satisfy A4-4's closed-set guard test, which is what makes this class of omission a red test instead of a broken read plane. This was the exact shape of the A4-4 defect, and PR3 would have reproduced it.

### Ownership, inventory and pointer corrections

- **A5-7 (N5) Client ledger fan-out has two sites and one owner.** A new fact type must be added to the client category map at `packages/client/src/model/ledger-adapter.ts:89-129` (not `:330-337`, which is the lookup inside `adaptEntry`) **and** to `INTERNAL_FACT_TYPES` (`packages/domain/.../team-ledger-model.ts:91-108`), which decides Events visibility; **PR6 owns both**, because PR6 owns the client's governance surfacing. Between PR5 (first writer) and PR6 (client mapping) a proposal row renders as a generic uncategorised Event row — disclosed here and in PR5's temporary-semantics statement.
- **A5-8 (N7, refuted item) The `minimumAuthority` finding is refuted.** The two occurrences in this ADR are (a) the name of an existing Alpha.3 field on a matched permission rule and (b) my own striking of a phrase that names no field. Nothing is dangling; no change made. What *was* stale — spec §11.3's `escalate`, §24.3's `min()` formula, §11.5's legality derivation, §7.3's per-reviewer ceiling output — is repaired in place by this amendment.
- **A5-9 (N7) The PR7 fixture inventory is restated as 18, with a defined predicate.** The scan predicate is "a tracked file under `tests/kits/**` or a `scripts/**` / harness helper that constructs a **Blueprint** document literal with `schemaVersion`". That is 16 kit files + `scripts/blueprint-authoring.mjs:92` + `root-binding/harness/blueprint-source.mjs:30` = **18**. `packages/testkit/domain/src/scenario.ts:177,183` is struck — it parses a **SessionBinding** DTO (`parseSessionBinding`), and keying a Blueprint-version scan to it invites a storage-compatibility break; `packages/tools/src/tools.ts:961` is struck as a version site (it enumerates control-request **kinds**). Roughly 150 tracked files under `packages/**` embed v1/v2 Blueprint documents and are **out of scope by declaration**, because they are inside the vitest gate and are fixtures, not authored sources. `scripts/verify-blueprint-version-clean.mjs` must be invoked by name in PR7's gate list, since nothing runs `scripts/*.mjs` implicitly.
- **A5-10 (N3, dead pointer) §21.1 says the opposite of what A3-13 quoted.** There is no "Team start blocked when governance authority is unmet" row anywhere in the spec; spec §21.1 reads "mismatch/undetermined → warning; acknowledgement allows startup". A3-13's start-gate rule is therefore **new normative text**, not a quote, and it is reconciled thus: a governance-authority state that is merely **incompatible or unresolved** for a v1/v2 Team stays warning-and-acknowledgeable (a hard block would make every unmigrated Team unstartable, contradicting the migration plan); a governance authority that is **unreadable or corrupt** at start blocks start, because nothing downstream can be trusted. §21.1 gains both rows in place.
- **A5-11 (feasibility item 5) PR4 and PR5 both name `packages/tools/src/tools.ts`; they do not run in parallel.** PR4's A1.3 file list and PR5's task body collide, and the collision set named for the one concurrent pair did not include it. `packages/tools/src/tools.ts` is assigned to **PR4**, PR5 rebases onto PR4, and the file is added to the declared collision set and to the serialisation ranking.
- **A5-12 (feasibility item 2) The dual-algebra window is explicit and owned.** Between PR1 and PR7 the repository contains two envelope algebras on purpose: v1/v2 paths keep existential coverage, v3 paths use `grantCeiling`. The version switch lives in the single adapter that PR2 owns (`src/plugin/permission-plane.ts`, which already builds the config-shaped AST at `:499-530`), selected by the document's `schemaVersion`, and PR2 must pin **both** branches in one test file so nobody "helpfully" deletes the existential leg early. §5.2 and ADR §"Why this decision was forced" are scoped to v3 in place, because under Global Precedence rule 2 an implementer reading the unscoped sentence would have changed live v1/v2 decisions inside PR1 and broken PR1's own no-behaviour-change gate.
- **A5-13 (feasibility item 1) PR0's payload contract is frozen at PR0, and PR5 inherits it.** `packages/runtime/governance/proposal-store.ts` exports the record type in PR0 — subject `targetMemberInstanceId`, `baseGeneration: number`, `baseSnapshotId: string | null`, `desiredEffect`, `authorityEnvelopeAst` (the A3-9 AST), `requiredAuthority`, `caseFingerprint`, `status`, `recordedAt` — with **key-omitted optionality**, because the durable writer rejects `undefined` (`packages/storage/repositories/ledger.ts:202,206`: `assertPlainRecord` + `assertRemoteSafeJsonValue`). PR5 may extend the fingerprint inputs but may not rename or retype a field; if PR5 genuinely needs a different shape, that is a plan change, not an implementation detail. PR0's own files: `proposal-store.ts`, `proposal-codes.ts`, `packages/runtime/test/a4pr0-proposal-store.test.ts` (round-trip + restart), `a4pr0-proposal-corrupt.test.ts` (two-leg corrupt gate), `a4pr0-proposal-generation.test.ts` (A4-2 counter separation), branch `feat/a4-pr0-proposal-substrate`.
- **A5-14 Named acceptance targets where the plan had none.** PR7 lane D gains `packages/runtime/test/a4p7-v3-cutover-acceptance.test.ts`; PR6 names `packages/remote/src/handlers/team.ts` + `packages/remote/src/contracts/params.ts` (v8 `override.getPermissionAdministration`) and the pure diagnostic surface in `packages/runtime/governance/service.ts`.
- **A5-15 Heading and count hygiene.** The plan's A2/A3 addenda were nested as `###` under `## Amendment A1`, which reads as A1 ⊃ A2 ⊃ A3 against the stated flat precedence: they are promoted to `##`. The baseline heading "Before PR1 implementation" becomes "Before A4-PR0a" (the baseline-diff is a PR0a/PR0 gate), and "all seven PRs" becomes "all nine PRs (PR0a, PR0, PR1…PR7)".

### Round-3 addendum clauses (appended after both lanes returned)

- **A5-16 (N11) A guard test's derivation is part of its specification.** A closed-set guard that re-derives a set by a weaker method than the code it polices is a second hand-maintained copy, and here it would have been worse than nothing: a literal-only scan passes on the exact commit that contains the bug. Every guard/enumeration test in this stage must (i) resolve the same indirection the production code uses (constants, imports, lookup tables), (ii) assert **positively** that its derived set contains the members it exists to protect, and (iii) be proven non-vacuous once by mutation (break the production registration, watch the guard go red). PR0a's closed-set guard and PR0's "exactly one overlay writer" structural test both follow this shape.
- **A5-17 (N12) `p4t6` recompute authority moves to the first PR that adds a scannable file**, i.e. **A4-PR0a**, then continues with every subsequent PR; A3-5's "starting with PR0" wording is corrected in place. `p4t6` counts test files (its pin history is test-file increments 958→965→968→971), so a PR that adds a test file without the authority would violate the plan's own single-writer rule and be unable to run `pnpm test` green.
- **A5-18 (N13) `baseGeneration` names one counter and revalidation compares it.** Stated in the repaired A4-3: the overlay snapshot generation, `baseSnapshotId` authoritative over it, and commit revalidation reading `overlay.latest(...)` rather than trusting append-time refusal of caller-supplied values.
- **A5-19 (N14, N15) Two of my A4 premises were factually wrong and are corrected in place** — the "`node:crypto` has a single sanctioned owner" claim (there are three, one lane-importable) and the "`tsconfig.build.json` names no lane directory" claim (it lists 21 and omits `governance`; and `include` does not gate transitive emission). Neither changes a decision, and Global Precedence rule 4 is the reason both are corrected rather than left as commentary: an implementer executing from A4-6's wrong mechanism would look for a build-config edit that must not happen.
- **A5-20 (N18) Digest stability is bought with an audit gap, and the gap is surfaced.** Proposals are not attributed through `FACT_ADDRESSING_KEYS`, so a disposed member's retained history omits proposals about it; PR6's governance/audit surface states this in the UI contract rather than leaving readers to infer completeness.
- **A5-21 (N10) An inserted PR is inserted everywhere or nowhere.** A4-PR0a now has a roadmap row, a task body with branch/file list/checkboxes/gate, a place in the merge order, review order, per-PR gates, push authority, the dist/artifact gate sentence, and the `p4t6` authority; the amendment sections in the plan are flat `##` siblings in precedence order (A2, A3, A4, A5) rather than nested children of A1; the PR count reads nine; the baseline heading reads "Before A4-PR0a".
- **A5-22 (PR0a↔PR0 hazard) The writer of a fact type owns both category maps.** A4-PR0a's guard asserts host **and** client registration; if only a later PR may touch `packages/client/src/model/ledger-adapter.ts`, the PR that adds a fact type is red on a file it is forbidden to edit — which is precisely how the original defect survived. So: **every PR that writes a fact type registers it in both maps** (PR0a: abandonment; PR0: `governance-proposal-recorded`; PR3: `control-escalation-recorded`), and PR6 keeps what is actually its own — the rendering and Events-visibility layer (`INTERNAL_FACT_TYPES`, `TeamLedger.tsx`) plus the A5-20 audit-gap disclosure. PR6's file list shrinks by two one-line table entries and loses nothing it was for.

