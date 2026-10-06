# Alpha.4 Permission Governance Detailed Design Spec

**Status:** Draft for review  
**Stage:** Alpha.4  
**Date:** 2026-10-07  
**Companion ADR:** `ADR-alpha4-hard-governance.md`

## 1. Scope

This spec defines the implementation contract for Alpha.4 hard governance and approval normalization.

The design is intentionally incremental:

- preserve existing Alpha.2/Alpha.3 runtime authorities where possible;
- reuse Alpha.3 permission-mutation algebra;
- add the missing Human-User hard ceiling;
- normalize approval authority without forcing immediate cleanup of historical Control vocabulary;
- expose the new model through Remote/UI with minimal architectural duplication;
- defer broad cleanup to post-Alpha.4.

This spec does not authorize implementation until reviewed.

## 2. Terminology

Canonical terms:

```text
permissionMutationEnvelope
  Leader expansion ceiling

teamHardEnvelope
  Human User expansion ceiling

RuntimeAuthority
  member | leader | human-user | human-admin

AuthorityCeilingEvaluator
  pure kernel that determines minimum authority for a desired elevation

ApprovalCase
  logical approval flow across one or more immutable ControlRequest review legs

InterventionItem
  unified observation/interaction projection over approval/warning/error sources
```

Historical term `teamHardDeny` is retired.

Historical request kinds `leader-approval` and `user-approval` remain temporarily for compatibility.

## 3. Blueprint schema v3

### 3.1 Version policy

Alpha.4 supports Blueprint schema v3 only.

```ts
SUPPORTED_BLUEPRINT_DOCUMENT_VERSIONS = [3]
```

v1/v2 parsing/admission must fail with a typed unsupported/migration-required error.

Cold resume of a Team bound to v1/v2 must fail closed before agent startup.

### 3.2 Required top-level fields

v3 extends the previous v2 shape with a required:

```yaml
teamHardEnvelope:
  rules: ...
```

and retains the existing required/normalized `permissionMutationEnvelope`.

No implicit default is permitted for `teamHardEnvelope`.

### 3.3 Shared envelope rule grammar

Recommended normalized source shape:

```ts
interface BlueprintAuthorityEnvelope {
  readonly rules: readonly BlueprintAuthorityEnvelopeRule[]
}

interface BlueprintAuthorityEnvelopeRule {
  readonly operationClass: string
  readonly matcher:
    | { readonly kind: 'exact'; readonly path: string }
    | { readonly kind: 'subtree'; readonly path: string }
    | { readonly kind: 'fingerprint'; readonly fingerprint: string }
  readonly maximumEffect: 'allow' | 'ask' | 'deny'
}
```

Class pairing remains:

- file-class operation: `exact | subtree`;
- shell-class operation: `fingerprint` only;
- no `any` matcher in authority envelopes.

### 3.4 Empty envelope

```yaml
teamHardEnvelope:
  rules: []
```

means no Human User runtime expansion authority.

The same fail-closed no-rule semantics apply to Leader expansion.

## 4. Runtime authority model

### 4.1 Vocabulary

```ts
type RuntimeAuthority =
  | 'member'
  | 'leader'
  | 'human-user'
  | 'human-admin'
```

Ordering:

```text
member < leader < human-user < human-admin
```

Utility functions should be pure:

```ts
authorityRank(authority): number
isHigherAuthority(candidate, beneficiary): boolean
```

### 4.2 Production principal mapping

Existing trusted human/operator access normalizes to:

```text
human-user
```

No Remote payload field may create `human-admin`.

Alpha.4 has no production Human Admin resolver.

Future authentication may inject trusted Human Admin identity through a dedicated server principal context seam.

## 5. Authority envelope runtime representation

### 5.1 Canonical runtime rule

```ts
interface AuthorityEnvelopeRule {
  readonly operationClass: string
  readonly matcher:
    | { readonly kind: 'exact'; readonly resource: string }
    | { readonly kind: 'subtree'; readonly resource: string }
    | { readonly kind: 'fingerprint'; readonly resource: string }
  readonly maximumEffect: PermissionOverlayEffect
}

interface AuthorityEnvelope {
  readonly rules: readonly AuthorityEnvelopeRule[]
}
```

The runtime representation should be shared by Leader and Team Hard envelopes.

Avoid implementing separate grammar/parser/algebra copies.

### 5.2 Effective ceiling

```ts
type EffectiveCeiling =
  | { readonly status: 'decided'; readonly effect: PermissionOverlayEffect; readonly matchedRules: readonly number[] }
  | { readonly status: 'no-authority' }
  | { readonly status: 'undetermined'; readonly reason: string }
```

For one concrete matcher:

1. evaluate every same-operation-class envelope rule against the scope;
2. if containment is undetermined for a potentially relevant subtree rule, return `undetermined`;
3. if no rule matches, return `no-authority`;
4. otherwise take the minimum `maximumEffect` under `deny < ask < allow`.

No existential "one allow rule covers" semantics may remain.

### 5.3 Monotonic restriction property

The evaluator must satisfy:

```text
adding a matching rule cannot increase the effective ceiling
```

Test this property directly.

## 6. Live resource semantics

### 6.1 No descendant enumeration

Authority evaluation must not materialize a static set of covered descendants.

The authoritative relation is computed against current canonical identities and the injected containment seam.

### 6.2 Frozen root identity

A frozen proposal/case binds to:

- matcher kind;
- canonical root/exact identity or exec fingerprint;
- operation class;
- target MemberInstance;
- requested effect.

A subtree proposal does not bind to the then-current descendants.

### 6.3 Drift

If root canonical identity changes between proposal creation and commit/execution:

```text
proposal/case -> stale
```

If descendants change while root identity stays stable:

```text
proposal remains valid
containment is recomputed live
```

## 7. AuthorityCeilingEvaluator

### 7.1 Responsibility

The evaluator determines the minimum RuntimeAuthority required for an elevation.

It does not:

- plan mutation snapshots;
- read repositories;
- resolve filesystem paths;
- read host capability state;
- know resolver availability;
- write Control state.

### 7.2 Conceptual input

```ts
interface AuthorityEvaluationInput {
  readonly beneficiaryAuthority: RuntimeAuthority
  readonly operationClass: string
  readonly matcher: PermissionResourceMatcher
  readonly desiredEffect: PermissionOverlayEffect
  readonly permissionMutationEnvelope: AuthorityEnvelope
  readonly teamHardEnvelope: AuthorityEnvelope
  readonly subtreeContains?: SubtreeContains
}
```

### 7.3 Conceptual output

```ts
type AuthorityEvaluation =
  | {
      readonly outcome: 'direct'
      readonly minimumAuthority: RuntimeAuthority
      readonly leaderCeiling: EffectiveCeiling
      readonly teamHardCeiling: EffectiveCeiling
      readonly evidence: Readonly<Record<string, unknown>>
    }
  | {
      readonly outcome: 'approval-required'
      readonly minimumAuthority: RuntimeAuthority
      readonly leaderCeiling: EffectiveCeiling
      readonly teamHardCeiling: EffectiveCeiling
      readonly evidence: Readonly<Record<string, unknown>>
    }
  | {
      readonly outcome: 'undetermined'
      readonly evidence: Readonly<Record<string, unknown>>
    }
```

The evaluator does not return "admin unavailable"; that belongs to orchestration.

### 7.4 Minimum authority logic

For Member beneficiary:

- Leader may approve only if Leader effective ceiling reaches desired effect;
- else Human User may approve if Team Hard ceiling reaches desired effect;
- else minimum authority is Human Admin.

For Leader beneficiary:

- minimum approver is at least Human User;
- Human User may approve if Team Hard ceiling reaches desired effect;
- else Human Admin.

For Human User beneficiary:

- minimum approver is Human Admin.

Self/same-level approval is never legal.

## 8. Permission mutation integration

### 8.1 Reuse Alpha.3 rise classification

Keep Alpha.3's:

- complete latest-vs-planned comparison;
- static lower-layer context;
- closed-region partition;
- revoke/reveal classification;
- unknown-context fail-closed behavior.

Refactor the final authority check so rising regions call the shared authority-ceiling evaluator.

### 8.2 Direct commit vs proposal

For every legal mutation initiator:

1. parse and validate mutation;
2. serialize inside the shared per-team chain;
3. read latest snapshot and CAS;
4. build planned full snapshot;
5. classify rising regions;
6. determine minimum authority over the whole batch;
7. if initiator can directly commit, append snapshot;
8. otherwise create an exact immutable mutation proposal and approval case.

### 8.3 Batch authority

For a multi-rule mutation, required authority is the maximum minimum authority across all rising regions.

If any region is undetermined:

```text
whole mutation -> fail closed / no write
```

No automatic clipping.

### 8.4 Mutation proposal identity

Bind proposal identity to:

- teamSessionId;
- target memberInstanceId;
- mutation kind;
- mutationId;
- canonicalized mutation rules;
- requested effects;
- expected generation if present;
- beneficiary authority;
- Blueprint contentHash / authority-generation anchor;
- reason/provenance.

The proposal fingerprint must not bind to a subtree's descendant enumeration.

### 8.5 Inline approval commit

After `allow`:

- re-enter shared team chain;
- revalidate target lifecycle;
- re-read latest generation;
- revalidate matcher root identities;
- reclassify before/after effects;
- recompute authority requirement;
- commit only if still valid.

Terminal results:

```text
mutation-committed
mutation-no-change
mutation-stale
denied
authority-unavailable
```

No reusable approval token after stale/failure.

## 9. Mutation initiation rules

### 9.1 Member

Member durable permission mutation initiation is rejected.

### 9.2 Leader targeting Member

Leader may initiate.

If required authority <= Leader and self-approval invariant is not implicated, direct commit is legal.

Otherwise create proposal.

### 9.3 Leader targeting self

Leader self-tightening/identity may commit directly.

Leader self-expansion may be proposed but minimum approver is Human User or Human Admin.

### 9.4 Human User

Human User may initiate Member/Leader permission mutation.

A mutation beyond `teamHardEnvelope` requires Human Admin.

## 10. Operation approval normalization

### 10.1 `ask` routing

Remove the semantic dependency:

```text
isLeader ? user-approval : leader-approval
```

from the core approval model.

Instead:

1. permission resolver returns `ask`;
2. authority resolver computes minimum approver;
3. routing chooses current review authority;
4. legacy request kind is filled as a compatibility carrier if needed.

### 10.2 `deny`

`deny` is terminal for that invocation.

No approval case is created.

A future permission mutation may change subsequent behavior.

## 11. ApprovalCase model

### 11.1 Stable case identity

Each logical flow has:

```ts
interface ApprovalCaseIdentity {
  readonly approvalCaseId: string
  readonly subject: ControlSubject
  readonly beneficiaryAuthority: RuntimeAuthority
  readonly requestedEffect: PermissionOverlayEffect
  readonly operationFingerprint?: string
  readonly mutationProposalFingerprint?: string
  readonly correlation: string
}
```

Exactly one of operation/mutation proposal fingerprints is present.

### 11.2 Review leg metadata

Additive fields on ControlRequest or an adjacent durable record:

```ts
approvalCaseId: string
reviewAuthority: RuntimeAuthority
requiredAuthorityAtCreation: RuntimeAuthority
previousRequestId?: string
```

`requiredAuthorityAtCreation` is provenance only.

Fresh projection recomputes current required authority.

### 11.3 Decision vocabulary

Extend durable Control decision semantics with:

```text
allow
deny
escalate
stale-denied
```

`escalate` grants zero operation/mutation authority.

### 11.4 Escalation

When `escalate` is chosen:

- current leg becomes terminal;
- new request leg is created for the next RuntimeAuthority;
- same `approvalCaseId`;
- same frozen case identity;
- old reviewer can no longer act on this case.

### 11.5 Legal actions

Derived fresh on server:

```text
reviewAuthority < requiredAuthority
-> deny | escalate

reviewAuthority >= requiredAuthority
AND reviewAuthority < human-admin
-> allow | escalate | deny

reviewAuthority = human-admin
-> allow | deny
```

### 11.6 Admin unavailable

If escalation target is `human-admin` and no Admin resolver exists:

- do not create a pending Admin leg;
- terminate case as `authority-unavailable`;
- surface typed Admin-required result and InterventionItem.

## 12. Single-operation execution state machine

Conceptual states:

```text
created
preflight-passed
pending-review
approved
execution-succeeded
execution-unavailable
stale
denied
authority-unavailable
```

The implementation may use derived state rather than one monolithic stored enum, but the projection must expose equivalent semantics.

### 12.1 Execution order

```text
canonicalize
-> environment/capability preflight
-> permission resolve
-> authority resolve
-> approval chain if ask
-> fresh authority recheck
-> environment/capability last-mile recheck
-> execute
```

### 12.2 Single-shot invariant

Any failure after case creation terminates that invocation.

An `allow` decision is never reusable by a later invocation.

## 13. Runtime capability/environment failures

External runtime constraints are modeled as execution capability/environment outcomes, not permission denial.

Recommended typed families:

```text
CAPABILITY_UNAVAILABLE
EXTERNAL_RUNTIME_RESTRICTION
HOST_ENVIRONMENT_UNAVAILABLE
```

Exact names may follow existing error conventions.

These outcomes:

- do not create approval cases;
- do not set `requiredAuthority`;
- do not expose `escalate`;
- may project to Intervention kind `warning` or `error`.

## 14. Intervention model

### 14.1 Projection type

Recommended contract:

```ts
interface InterventionItem {
  readonly interventionId: string

  readonly kind: 'approval' | 'warning' | 'error'

  readonly responseBehavior:
    | 'informational'
    | 'wait-for-response'

  readonly blockScope:
    | null
    | { readonly kind: 'configuration-operation'; readonly operationId: string }
    | { readonly kind: 'operation'; readonly operationFingerprint: string }
    | { readonly kind: 'subject-new-work'; readonly subject: ControlSubject }
    | { readonly kind: 'team-new-work'; readonly teamSessionId: string }

  readonly source: InterventionSource

  readonly status:
    | 'open'
    | 'acknowledged'
    | 'resolved'
    | 'authority-unavailable'
    | 'stale'

  readonly requiredAuthority?: RuntimeAuthority
  readonly currentReviewAuthority?: RuntimeAuthority

  readonly legalActions: readonly InterventionAction[]

  readonly fingerprint?: string
  readonly createdAt: string
  readonly updatedAt?: string
  readonly lastObservedAt?: string
  readonly observationCount?: number
}
```

### 14.2 Authority boundary

Intervention is never an authority source.

Projection fields cannot authorize execution or mutation.

## 15. Governance warning model

### 15.1 Purpose

Governance warnings represent envelope consistency diagnostics and other non-authoritative governance observations.

### 15.2 Consistency verdict

```text
consistent
mismatch
undetermined
```

### 15.3 Stages

Blueprint create/publish:

- structure + provable relation check;
- mismatch/undetermined -> warning;
- wait-for-response;
- block configuration operation only;
- acknowledgement allows publication.

Team start:

- repeat with concrete workspace/provider context;
- mismatch/undetermined -> warning;
- acknowledgement allows startup.

Runtime:

- recompute whenever a relevant authority boundary is touched;
- mismatch/undetermined updates warning;
- Team keeps running;
- individual undetermined authority decision fails closed.

### 15.4 Fingerprints

Configuration warning fingerprint should bind:

- warning kind;
- Blueprint contentHash;
- normalized Leader envelope;
- normalized Team Hard envelope;
- validation scope;
- canonicalization context identity when available.

Runtime warning fingerprint should additionally bind:

- TeamSession;
- MemberInstance;
- operation class;
- concrete canonical matcher/scope;
- relevant matching envelope rules;
- computed ceilings/verdict.

### 15.5 Acknowledgement

GovernanceWarning acknowledgement carries:

- warning id / fingerprint;
- acknowledgedBy;
- acknowledgedAt;
- optional note.

Acknowledgement affects reminder state only.

It never modifies authority.

## 16. Compatibility warning interaction

Do not force governance warning semantics into the existing CompatibilityState admission machine.

Compatibility remains authoritative for environment requirement admission.

Governance warnings use a separate durable source but reuse the fingerprinted-acknowledgement design pattern.

The Intervention projection may show both through one UI surface.

## 17. Remote contract v8

### 17.1 New category

Add:

```text
intervention
```

to the Remote category set in v8.

### 17.2 Methods

Recommended:

```text
intervention.list
intervention.get
intervention.act
```

### 17.3 `intervention.act`

Client parameters:

```ts
{
  teamSessionId,
  interventionId,
  action,
  note?
}
```

The client must not submit:

- review authority;
- required authority;
- legal actions;
- admin role.

The server must derive principal and current legal actions, then route to the authoritative source domain.

`intervention.act` is a command router, not a new state authority.

### 17.4 Existing endpoints retained

Keep:

- `team.resolveControl`;
- `compatibility.ack`;
- existing control request kinds;
- current v7 permission mutation/read endpoints.

They remain functional compatibility adapters.

Cleanup is post-Alpha.4.

### 17.5 Permission administration read

Add a wider read endpoint rather than breaking `override.getPermission`.

Recommended:

```text
override.getPermissionAdministration
```

It should expose:

- bound Blueprint id/revision/contentHash;
- static permission baseline;
- Leader permissionMutationEnvelope;
- Team teamHardEnvelope;
- current PermissionOverlaySnapshot;
- relevant provenance/history;
- effective permission summary;
- current envelope consistency diagnostics;
- related warning/intervention references.

This is read projection only.

## 18. UI requirements

### 18.1 Incremental extension

Do not rewrite TeamGovernance from scratch.

Add a Permission Administration area and unified Intervention list.

### 18.2 Permission Administration

Display at least:

- Blueprint v3 identity;
- static permission baseline;
- Leader envelope;
- Team Hard envelope;
- current overlay generation/provenance;
- effective permission;
- envelope consistency verdict;
- relevant approval/warning items.

Do not expand subtree rules into a frozen file tree.

Present declared rules directly.

### 18.3 Intervention list

Show:

- kind;
- status;
- source;
- summary;
- response behavior;
- block scope;
- required authority;
- current review authority;
- legal actions;
- observation metadata.

Use server-provided legal actions only.

### 18.4 Escalated leg UX

Once a leg escalates:

- mark it terminal;
- remove/disable further action on that leg;
- show the newly active higher-authority leg.

## 19. Legacy compatibility debt

Alpha.4 explicitly retains:

```text
leader-approval
user-approval
```

as historical durable/control vocabulary.

The implementation must document that these are compatibility carriers, not the source of reviewer semantics.

Add a post-Alpha.4 cleanup item to:

- migrate/remove implicit reviewer semantics;
- consider a generic approval request kind;
- consolidate `team.resolveControl` with `intervention.act`;
- simplify duplicated Control/Compatibility/Governance-warning UI/API surfaces;
- evaluate durable Control schema migration.

## 20. Migration behavior

### 20.1 Blueprint load

v1/v2 -> typed unsupported/migration-required.

### 20.2 Cold resume

If a TeamSession references v1/v2:

- stop before agent restoration;
- return migration-required;
- no implicit conversion.

### 20.3 Storage schema

Where additive fields suffice, preserve existing durable rows.

Do not force unrelated historical storage migration merely for cleanliness.

If ApprovalCase linkage cannot be represented safely with additive Control fields/facts, introduce a narrowly scoped additive durable record rather than rewriting existing history.

## 21. Acceptance matrix

### 21.1 Blueprint

- valid v3 accepted;
- missing Team Hard envelope rejected;
- malformed envelope rejected;
- v1 rejected;
- v2 rejected;
- old-Team cold resume rejected.

### 21.2 Effective ceiling

- no match -> no authority;
- broad allow + narrow ask -> ask;
- broad allow + narrow deny -> deny;
- broad deny + narrow allow -> deny;
- adding matching rule never increases authority.

### 21.3 Live filesystem

- broad subtree applies to descendant created after Team startup;
- narrow restriction applies after descendant creation;
- no startup-time descendant enumeration;
- canonical root retarget -> proposal stale;
- same root + changed descendants -> proposal remains valid.

### 21.4 Approval authority

- Member ask -> Leader when permitted;
- Member ask -> Human User when Leader ceiling insufficient;
- Member ask -> Human Admin when Team Hard ceiling insufficient;
- Leader self-expansion -> Human User/Admin;
- Human User self-expansion -> Human Admin;
- no self/same-level allow.

### 21.5 Escalation

- insufficient reviewer: deny/escalate only;
- sufficient non-admin reviewer: allow/escalate/deny;
- Admin: allow/deny only;
- escalation preserves case id;
- escalation creates new request id;
- escalated old leg cannot later allow;
- escalation grants zero execution authority.

### 21.6 Mutation

- Leader direct Member mutation in envelope;
- Leader proposal beyond Leader envelope but within Team Hard;
- Human User approval then inline commit;
- beyond Team Hard -> Admin required;
- Member mutation initiation rejected;
- Leader self-tightening direct;
- Leader self-expansion reviewed;
- revoke/reveal rise requires authority;
- one illegal region rejects entire batch;
- CAS drift after approval -> mutation-stale;
- lifecycle drift -> mutation-stale;
- root identity drift -> mutation-stale;
- no-change after approval -> mutation-no-change.

### 21.7 Concrete operation

- capability unavailable before approval -> no case;
- ask + valid authority -> case;
- approval allow + authority drift -> stale;
- approval allow + capability last-mile failure -> execution-unavailable;
- failed invocation approval cannot be reused;
- successful exact operation consumes authorization exactly once.

### 21.8 Runtime capability separation

- Team permission allow + environment unavailable -> environment/capability failure;
- no approval escalation for environment failure;
- durable mutation may pre-authorize currently unavailable external capability.

### 21.9 Warning/intervention

- Blueprint mismatch warning;
- Blueprint undetermined warning;
- Team-start mismatch warning;
- runtime mismatch warning;
- runtime undetermined decision fails closed;
- duplicate fingerprint updates count/time rather than adding item;
- acknowledgement does not alter authority;
- intervention projection failure cannot mint authority.

### 21.10 Persistence/restart

- pending review leg reconstructs;
- escalation chain reconstructs;
- terminal outcomes reconstruct;
- warning acknowledgement reconstructs;
- PermissionOverlay authority appears only after successful commit;
- Admin-required case does not reconstruct as a fake pending Admin request.

### 21.11 Isolation

- different MemberInstances do not share overlay/approval authority;
- different Teams do not share approval/warning identity;
- same matcher text under different canonical workspaces does not alias.

## 22. Implementation guidance

Recommended sequencing after spec approval:

1. Blueprint v3 + shared authority-envelope types;
2. effective-ceiling algebra and regression upgrade of Alpha.3 envelope semantics;
3. RuntimeAuthority + AuthorityCeilingEvaluator;
4. mutation integration and exact proposal flow;
5. approval-case metadata/escalation;
6. operation ask routing normalization;
7. governance warning + Intervention projection;
8. Remote v8 surfaces;
9. UI Permission Administration + Intervention;
10. migration/cold-resume handling;
11. full security/acceptance pass.

Detailed PR decomposition should be written only after this spec is reviewed.

## 23. Explicit non-goals

Not in Alpha.4:

- Human Admin authentication;
- Blueprint ACLs;
- runtime Blueprint hot-rebind;
- async approval continuation;
- reusable operation approval tokens;
- retry/resume of a failed single operation using prior approval;
- per-template/per-member Team Hard envelope;
- automatic mutation clipping;
- partial permission mutation commit;
- cleanup/removal of `leader-approval` / `user-approval`;
- broad Remote/UI cleanup unrelated to making Alpha.4 usable.
