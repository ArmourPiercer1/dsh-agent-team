# DSH Agent Team Permission System Design

- **Target release:** `0.1.1-alpha.1`
- **Status:** Architecture closed for alpha; implementation pending
- **Related ADR:** `ADR-001-hierarchical-self-frozen-permission-governance.md`
- **Repository baseline used during design:** `ArmourPiercer1/dsh-agent-team` master around `3be0de1f0e56f37db85e83334f361d401e1e70c6`

## 1. Purpose

This document defines the complete parameter-aware permission model for DSH Agent Team.

The system must support:

- per-Template and per-MemberInstance permission state;
- parameter-aware access rules for selected built-in tools;
- Leader-mediated governance of Teammate permissions;
- Human authority above Leader governance;
- a Team hard-deny lane that Agents cannot bypass;
- a plugin-external hard ceiling;
- synchronous operation approval;
- one-shot approval and durable exact-resource grants;
- durable provenance;
- restart-safe and archive/restore-safe behavior;
- model-visible permission changes;
- no DSH core patch.

The design is intentionally smaller than a general authorization language.

## 2. Non-goals for alpha

The following are out of scope:

- arbitrary JSON predicate DSL;
- arbitrary multi-parameter conjunction rules;
- parameter-level MCP authorization;
- positive Bash command-pattern allow;
- custom path-scope editing inside an approval dialog;
- approval-derived Template-wide or Team-wide durable grants;
- asynchronous long-latency Human approval/retry;
- automatic semantic equivalence analysis between two tool payloads;
- `AGENTS.md` injection;
- OS sandbox replacement.

## 3. Concepts

### 3.1 Tool availability

Tool availability controls whether a tool exists on an Agent's tool surface.

Example:

```yaml
tools:
  allow:
    - read
    - write
    - bash
```

This does not answer whether a concrete call is allowed.

### 3.2 Operation permission

Operation permission is evaluated for a concrete invocation:

```text
tool + canonical security-relevant arguments
```

Example:

```text
Read(D:/project/private/key.txt)
```

### 3.3 Mutation authority

Mutation authority controls who may make durable changes to permission state.

It is independent from whether the operation itself is allowed.

### 3.4 Governance ceiling

`mutationEnvelope` is the Leader's maximum authority over the governed Member.

It does not grant any permission by itself and does not imply `ask`.

### 3.5 Hard boundaries

There are two hard-boundary classes:

```text
teamHardDeny
externalHard
```

`teamHardDeny` is hard against Agent/Leader autonomy but Human-overridable.

`externalHard` is outside Team-plugin authority and cannot be bypassed.

## 4. Authority model

### 4.1 Hierarchy

```text
External Hard / host substrate
            │
            ▼
          Human
            │
            ▼
     mutationEnvelope
            │
            ▼
          Leader
            │
            ▼
 MemberInstance permission state
            │
            ▼
         Teammate
```

### 4.2 Teammate

A Teammate is an execution entity.

It may:

- execute allowed operations;
- trigger an `ask`;
- fail on `deny`;
- fail/escalate on `teamHardDeny`;
- choose not to perform an operation;
- request a permission change from Leader.

It may not durably modify its own permission state.

### 4.3 Leader

Leader governs MemberInstance permission state inside `mutationEnvelope`.

Leader may:

- approve a Teammate `ask` when within envelope;
- issue `allow_once`;
- issue `grant_instance`;
- proactively alter a MemberInstance's ordinary permission policy inside the envelope;
- deny an operation;
- route a hard-boundary case to Human.

Leader may not:

- self-approve;
- approve outside its envelope;
- modify its own governance ceiling;
- bypass `teamHardDeny`;
- modify `teamHardDeny` as a means of expanding its own authority.

### 4.4 Human

Human is the final Team-plugin authority.

Human may:

- resolve `USER_APPROVAL`;
- issue one-shot approval;
- issue exact-resource durable instance override;
- modify broader policy through a future explicit policy-administration surface;
- change Leader governance ceilings;
- explicitly override Team hard deny.

Human may not bypass `externalHard`.

## 5. Policy representation

The generic policy system should no longer assume every capability has exactly the same `PolicyEntry` shape.

Conceptually:

```ts
type CapabilityPolicy = {
  model: GenericPolicyEntry
  tools: GenericPolicyEntry
  skills: GenericPolicyEntry
  mcp: GenericPolicyEntry
  permissions: PermissionPolicy
}
```

The exact type encoding may differ, but `permissions` needs a typed domain.

Conceptual alpha schema:

```yaml
permissions:
  default: ask

  allow:
    - Read(D:/project/src/**)

  ask:
    - Write(D:/project/out/**)
    - Bash(*)

  deny:
    - Read(D:/project/private/**)

  teamHardDeny:
    - Write(D:/release/**)
```

`teamHardDeny` should be structurally distinguishable from ordinary rules and provenance-visible.

## 6. Supported parameter adapters

### 6.1 File/path tools

At least the following DSH built-ins must pass through one consistent path permission adapter:

```text
read(file_path)
read_image(file_path)
write(file_path, content)
edit(file_path, old_string, new_string, ...)
lsp(..., file_path, ...)
```

`lsp` is included conservatively because it may reveal restricted file information.

Path evaluation must use the DSH filesystem resolution seam.

Do not implement authorization with:

```ts
rawPath.startsWith(...)
```

Canonical evaluation should derive a stable resolved resource identity.

### 6.2 Bash

For alpha, Bash parameter-aware policy supports:

```text
ask
deny
teamHardDeny
```

No strong parameter-level positive allow is added.

Tool-level availability can still expose or hide Bash.

Reason: positive shell authorization requires shell-aware decomposition, redirect analysis, command substitution awareness, and compound-command semantics.

### 6.3 MCP

No parameter-level MCP permission in alpha.

MCP policy remains at:

- server availability;
- tool-name availability where the DSH/MCP surface permits it.

### 6.4 Generic parameter predicates

No generic top-level predicate is trusted to establish positive access in alpha.

Future generic guards, if added, should default to tightening rather than granting.

## 7. Canonical operation identity

Before permission/control evaluation, convert the raw tool call into a canonical security identity.

For file operations this should contain at least:

```text
toolName
canonical resource identity
operation class
```

For control-plane binding, also include an operation fingerprint.

Example conceptual structure:

```ts
interface CanonicalOperation {
  toolName: string
  primaryResource?: string
  primaryArgumentKind: 'path' | 'command' | 'none'
  fingerprint: string
}
```

The fingerprint should be deterministic over the security-relevant payload.

A one-shot approval for one canonical operation must not authorize another.

## 8. Resolution algorithm

### 8.1 High-level pipeline

```text
raw tool call
   ↓
tool availability
   ↓
canonicalize primary security parameter
   ↓
external hard
   ↓
Team hard lane
   ↓
ordinary operation-local policy
   ↓
allow / ask / deny
   ↓
control flow if ask/hard escalation
   ↓
live external-hard recheck
   ↓
dispatch
```

### 8.2 Team hard lane

Accumulate applicable `teamHardDeny` restrictions from Team governance layers.

If a Team hard rule matches:

- Member cannot bypass;
- Leader cannot bypass;
- ordinary more-specific allow cannot bypass;
- Human explicit override may bypass;
- external hard still wins.

### 8.3 Ordinary operation-local precedence

For the concrete operation:

```text
HumanOverride
InstanceOverlay
TemplateOverlay
Template
PolicyState
Blueprint
```

Search from high to low.

The first layer with a matching ordinary rule determines the ordinary outcome.

### 8.4 Same-layer conflict

If multiple ordinary rules in the same layer match:

```text
deny > ask > allow
```

There is no specificity-based exception in alpha.

### 8.5 No match

If no ordinary rule matches, apply the Template `default`:

```text
deny | ask
```

A missing/invalid default should fail closed.

## 9. Why `deny` does not create approval

Example:

```yaml
deny:
  - Read(D:/project/private/**)
```

Call:

```text
Read(D:/project/private/public.txt)
```

Result:

```text
deny
→ reject
```

There is no Leader approval request.

This prevents a Teammate from slowly converting a denied subtree into many exact grants by repeatedly asking.

If a higher authority intentionally wants to override an ordinary lower-layer deny, it must proactively write a lawful higher-layer policy mutation.

## 10. Mutation model

### 10.1 Self-frozen permission state

Member cannot create permission mutations.

This includes tightening changes.

A behavior such as "I will not call Bash anymore" is allowed.

A durable mutation such as:

```text
deny Bash(*)
```

is governance and requires Leader.

### 10.2 Leader mutation

Leader may mutate a specific MemberInstance's ordinary permission snapshot within `mutationEnvelope`.

Examples:

```text
allow exact resource
ask resource
deny resource
remove a previously granted ordinary rule
change ordinary default if the governance model allows that field
```

Any mutation that expands Leader authority itself is out of bounds.

### 10.3 Human mutation

Human may mutate Member permission state without the Leader envelope ceiling, but remains bounded by external hard facts.

Approval-derived durable Human grants are instance+exact-resource only in alpha.

Broader Human policy administration is a separate future surface.

### 10.4 Snapshot storage

For alpha, store a complete permission rule-set snapshot at the mutated layer.

Flow:

```text
read current layer permission snapshot
→ apply mutation
→ validate
→ append new complete snapshot record
```

Do not introduce per-rule delta events in alpha.

The append-only ledger still preserves historical provenance.

## 11. Synchronous approval flows

### 11.1 Member ordinary ask

```text
Member operation
   ↓
ask
   ↓
LEADER_APPROVAL
   ↓
Leader
 ├─ deny
 ├─ allow_once
 ├─ grant_instance
 └─ escalate_to_user when Leader lacks authority
```

Leader `allow_once` and `grant_instance` require the operation to be within `mutationEnvelope`.

### 11.2 Member ordinary deny

```text
Member operation
   ↓
deny
   ↓
reject
```

No approval request.

### 11.3 Member Team hard deny

```text
Member operation
   ↓
teamHardDeny
   ↓
Leader review
 ├─ deny
 └─ escalate_to_user
       ↓
    USER_APPROVAL
```

Leader must not authorize through Team hard deny.

### 11.4 Leader's own ask

```text
Leader operation
   ↓
ask
   ↓
USER_APPROVAL
   ↓
Human
```

Leader cannot resolve its own request.

### 11.5 Human approval

Human may:

```text
deny
allow_once
grant exact resource for current instance
```

subject to live external hard policy.

## 12. One-shot vs durable grant

### 12.1 `allow_once`

`allow_once` authorizes exactly one concrete canonical operation and is consumed once.

It does not mutate future permission state.

### 12.2 `grant_instance`

For synchronous approval:

```text
grant_instance
=
allow_once(current blocked operation)
+
durable exact-resource grant
```

The durable grant applies from the future permission boundary.

The current call proceeds because of the separate one-shot authorization.

### 12.3 Exact scope

A durable approval for:

```text
Read(D:/project/tests/a.txt)
```

must not become:

```text
Read(D:/project/tests/**)
```

No automatic scope widening.

## 13. Control operation scope

The existing control scope must be extended.

Conceptually:

```ts
interface ControlOperationScope {
  rootSessionId: string
  targetInstanceId: string
  actionName: string
  toolName?: string
  capabilityDomain?: CapabilityName

  canonicalResource?: string
  operationFingerprint: string

  correlation: string
}
```

The exact names may differ.

Requirements:

- correlation identifies the logical request;
- fingerprint/resource identity binds the approval to the payload;
- one-shot consumption is exact;
- changed payload does not reuse the old authorization.

## 14. Permission mutation notification

### 14.1 Invariant

Any durable permission mutation that affects a live Agent must be visible to that Agent no later than the model step at which the mutation becomes effective.

### 14.2 Two channels

Use both:

```text
runtime-context snapshot
+
agent.inject(delta notice)
```

The runtime-context snapshot is authoritative explanatory context.

`agent.inject` is a transition notification.

### 14.3 Why both are needed

Crash scenario:

```text
commit durable permission
→ process crashes
→ inject was never emitted
```

After restart, the runtime-context snapshot still exposes the current permission truth.

Therefore injected notices cannot be the only model-visible representation.

### 14.4 Example injected delta

A minimal notice may look conceptually like:

```text
[Team permission update]
Leader granted permission to read <canonical resource>.
This permission is effective from the current/next permission boundary.
```

or:

```text
[Team permission update]
Leader revoked permission to write <canonical resource>.
```

The exact prose is presentation, not authority data.

## 15. Future-boundary semantics

Durable mutation does not rewrite an already captured in-flight step.

Example:

```text
Step N captures permission P0
Leader commits P1
Step N continues under P0
Step N+1 resolves P1
Step N+1 sees the injected transition notice
```

The runtime guard must be designed so this boundary is deterministic.

## 16. Lifecycle semantics

### 16.1 Archive

`ARCHIVED` stops work admission.

Instance-scoped grants remain durable but inactive because the instance is not executing.

### 16.2 Restore

Restoring the same MemberInstance reactivates its instance-scoped permission state.

### 16.3 Dispose

`DISPOSED` permanently terminates the grant's effective authority.

Ledger/provenance rows remain available for audit.

## 17. External hard policy

External hard policy is checked:

- when admitting relevant Team-side mutations where applicable;
- when deciding approvals;
- again immediately before final tool dispatch.

The last-mile recheck is mandatory.

A previously recorded Team/Human allow must not bypass a newly tightened external restriction.

## 18. Runtime-context shape

Alpha should expose a concise current permission view, not necessarily every historical rule.

Potential fields:

```text
permission default
effective ordinary rule summary
hard-boundary summary
mutation authority statement
pending/active exact grants as needed
```

The context must not mislead the model into assuming more authority than the runtime guard actually provides.

If the exact grant list becomes too large, summarize conservatively and rely on the guard as authority.

## 19. Provenance requirements

Every effective permission decision should be explainable in terms of:

- canonical operation;
- matched hard rule if any;
- matched ordinary rule;
- winning layer;
- origin;
- record ID;
- effective-from boundary;
- approval/control request if applicable;
- control decision if applicable;
- one-shot consumption if applicable;
- durable grant mutation if applicable;
- external-hard result.

The rule engine should expose enough structured diagnostics to generate this explanation without reconstructing it from free text.

## 20. Error/fail-closed behavior

Fail closed on:

- malformed permission policy;
- unsupported permission adapter;
- missing canonicalization result;
- ambiguous matching state;
- missing MemberInstance;
- stale/disposed target;
- control scope mismatch;
- already-consumed allow;
- external-hard rejection;
- missing approval answerer when synchronous approval is required;
- inability to reconcile live policy at a request boundary.

## 21. Current-code adaptation

### 21.1 Generic `PolicyEntry`

Current generic policy types only support whole-cell allow/deny and cannot represent the new permission domain.

Introduce a dedicated permission policy type rather than encoding parameter rules as opaque strings inside the old generic entry.

### 21.2 Mutation actor/scope coupling

Current code conceptually couples:

```text
leader → template overlay
member → instance overlay
```

Permission governance requires:

```text
leader-origin InstanceOverlay
member-origin permission mutation forbidden
```

The record model should keep `origin` and `scope` orthogonal.

### 21.3 Control scope

Add canonical argument/resource identity and operation fingerprint.

### 21.4 Envelope mutation naming

Current `envelope-mutation` vocabulary risks conflating:

- mutation **inside** an envelope;
- mutation **of** the envelope itself.

These must be distinguished.

Changing the Leader governance ceiling is Human authority.

### 21.5 Live-agent reconciliation

Reuse the existing request-boundary reconciliation mechanism.

Permission views must join the existing model/MCP consumption reconciliation without creating a separate live truth.

## 22. Security test matrix

At minimum test:

1. allowed exact file succeeds;
2. denied subtree rejects without approval;
3. ask enters Leader approval;
4. ask outside Leader envelope cannot be Leader-approved;
5. Leader cannot self-approve;
6. Team hard deny cannot be Leader-approved;
7. Team hard deny can be escalated to Human;
8. Human override cannot bypass external hard;
9. `grant_instance` current call succeeds;
10. subsequent same exact resource succeeds without asking;
11. sibling file does not inherit exact grant;
12. relative/absolute path aliases resolve to the same canonical resource;
13. path traversal cannot escape matcher semantics;
14. changed canonical resource cannot consume an old one-shot approval;
15. one-shot approval cannot be consumed twice;
16. proactive Leader grant becomes visible at next model step;
17. proactive Leader revoke becomes visible at next model step;
18. crash after durable commit but before inject still restores correct runtime-context truth;
19. archive prevents execution;
20. restore reactivates the same instance grant;
21. dispose terminates its effect;
22. live external-hard tightening blocks a previously approved operation;
23. Bash cannot gain parameter-level strong allow through unsupported syntax;
24. MCP argument restrictions are not accidentally implied by tool-name policy;
25. same-layer `deny` beats `ask` and `allow`;
26. higher ordinary layer may override lower ordinary deny;
27. ordinary allow cannot bypass Team hard deny.

## 23. Deferred async Human approval design

Do not implement this in `0.1.1-alpha.1`.

Future target:

```text
long-latency Human ask
→ Agent may continue unrelated work
→ Human result arrives
→ inject result / permission change
→ Agent decides whether to retry
```

For a retry:

- if payload/canonical operation is fully equivalent to the approved operation, it may be eligible for automatic acceptance;
- if payload changed, route to Leader;
- Leader compares old and new payload, behavior boundary, and expected impact;
- Leader decides whether the new operation is equivalent or close enough to inherit the original Human intent.

This requires a formal operation-equivalence contract and impact-diff UX.

It is explicitly not part of alpha.

## 24. Summary

The alpha permission architecture is:

```text
tool visibility
   ↓
typed parameter adapter
   ↓
canonical operation
   ↓
external hard
   ↓
Team hard lane
   ↓
operation-local ordinary policy
   ↓
allow / ask / deny
   ↓
Leader/Human synchronous control
   ↓
exact one-shot / exact durable grant
   ↓
live external-hard recheck
   ↓
DSH tool dispatch
```

The governance architecture is:

```text
Human
  controls Leader governance ceiling

Leader
  controls Member permission state within that ceiling

Member
  executes but cannot persistently rewrite its own authority
```

This is the alpha system of record.
