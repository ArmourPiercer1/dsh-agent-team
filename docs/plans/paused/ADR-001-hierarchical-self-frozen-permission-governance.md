# ADR-001: Hierarchical Self-Frozen Permission Governance for DSH Agent Team

- **Status:** Accepted for `0.1.1-alpha.1`
- **Decision date:** 2026-09-09
- **Repository:** `ArmourPiercer1/dsh-agent-team`
- **Repository baseline used during the discussion:** `master` around `3be0de1f0e56f37db85e83334f361d401e1e70c6`
- **Supersedes:** the assumption that a Member may autonomously persist permission changes within its own mutation envelope
- **Defers:** asynchronous long-latency Human approval/retry semantics

## 1. Context

The current vNext architecture already has five policy capability domains:

- `model`
- `tools`
- `permissions`
- `skills`
- `mcp`

It also already has:

- Blueprint / PolicyState / Template / TemplateOverlay / InstanceOverlay / HumanOverride layers;
- a durable mutation ledger;
- a durable control plane with `leader-approval`, `user-approval`, and `envelope-mutation`;
- exact-once consumption of an allowed control decision;
- DSH public seams for tool pre-execution interception, tool visibility, skill registration, MCP mounting, model selection, and live Agent/session input;
- no need for DSH core patches.

However, the existing permission representation is too coarse. `PolicyEntry` is currently only:

```ts
{ kind: 'allow', items: string[] }
| { kind: 'deny' }
```

This can express capability-level allow/deny but cannot safely express parameter-aware rules such as:

```text
allow Read(D:/project/src/**)
deny  Read(D:/project/private/**)
ask   Write(D:/project/out/**)
```

The control architecture also needed a consistent authority model for:

- who may change a Member's permissions;
- who may change the Leader's authority boundary;
- what an `ask` means;
- what a hard denial means;
- how one-shot approval differs from durable permission mutation;
- how a permission change becomes visible to the affected Agent;
- how durable exact-resource grants behave across archive/restore;
- how approval is bound to the exact operation being authorized.

The design goal is not a generic policy language. The goal for `0.1.1-alpha.1` is a small, explicit, auditable permission system that is hard to bypass and can be iterated later.

## 2. Decision

### 2.1 Core authority principle: authority is frozen downward

The central invariant is:

> An execution entity cannot persistently modify the policy that constrains itself. A manager may modify the policy of the entity below it, but cannot modify the authority boundary that constrains its own governance. That boundary is controlled by the next higher authority.

The resulting hierarchy is:

```text
External Hard / DSH substrate
            │
            ▼
          Human
            │ controls
            ▼
   Leader governance authority
      (mutationEnvelope)
            │ controls
            ▼
 MemberInstance permission state
            │ constrains
            ▼
         Teammate
```

Consequences:

- A Teammate cannot persistently loosen **or tighten** its own permissions.
- A Teammate may choose not to execute an operation, but that behavioral choice is not a durable permission mutation.
- A Leader may modify a MemberInstance's permission state within the Leader's frozen `mutationEnvelope`.
- A Leader may not modify the `mutationEnvelope` that constrains that Leader's governance authority.
- A Leader may not self-approve its own operation.
- Human is the highest authority inside the Team plugin.
- `externalHard` remains above Human and cannot be bypassed by the plugin.

### 2.2 Separate tool availability, operation permission, and mutation authority

These are distinct concepts.

**Tool availability** answers:

> Is this tool visible/callable by this Agent?

**Permission evaluation** answers:

> Is this concrete operation with these concrete arguments allowed now?

**Mutation authority** answers:

> Who may persistently change how future operations are evaluated?

No one of these may be treated as a substitute for another.

### 2.3 Permission outcomes

The parameter-aware permission system has these outcomes:

```text
allow
ask
deny
teamHardDeny
externalHard
```

Semantics:

- `allow`: execute.
- `ask`: request a higher authority decision.
- `deny`: reject the operation immediately; do **not** create an approval request.
- `teamHardDeny`: Team Agents cannot override it; Human may override it explicitly.
- `externalHard`: absolute plugin-external ceiling; Human cannot override it through this plugin.

A key security consequence is:

```text
deny Read(D:/project/private/**)
```

means a Teammate call to `Read(D:/project/private/a.txt)` is rejected directly. It does not enter `ask`, and therefore cannot be gradually pierced by repeatedly requesting exact-file approvals.

### 2.4 Ordinary deny and Team hard deny are different

An ordinary `deny` is a normal Team policy value. A lawful higher Team policy layer may override a lower ordinary deny.

A `teamHardDeny` is a separate monotonic Team-governance lane:

- Member cannot override it.
- Leader cannot override it.
- Leader cannot create/delete/modify it as a way to change its own authority ceiling.
- Human may explicitly override it.
- External hard policy still wins.

If a Template says:

```text
deny Read(D:/private/**)
```

a higher InstanceOverlay created by an authorized Leader may deliberately allow a specific resource.

If the intended meaning is instead:

> The Leader must not be able to grant this.

the correct construct is:

```text
teamHardDeny Read(D:/private/**)
```

### 2.5 `mutationEnvelope` is the Leader's governance ceiling

`mutationEnvelope` is not a Member self-mutation range.

It means:

> The maximum durable permission authority the Leader may exercise over the governed Member.

Leader `allow_once` and Leader durable grant share the same ceiling.

If an operation is `ask` but outside the Leader's `mutationEnvelope`, the Leader cannot approve it. The Leader may only deny or escalate to Human.

The Leader may also proactively change a MemberInstance's permissions inside the envelope. Such a change does not require a prior Member request.

### 2.6 Teammate permission state is self-frozen

For the `permissions` domain, a Teammate may not persistently:

- add `allow`;
- add `ask`;
- add `deny`;
- remove any rule;
- change `default`;
- change `teamHardDeny`;
- change `mutationEnvelope`.

All durable permission mutations must be performed by a higher authority.

Existing member-origin mutation support in the generic runtime may remain for other capability domains if needed, but it must not be an authorization path for parameter-level permission mutation.

### 2.7 Alpha permission structure

Conceptually:

```yaml
permissions:
  default: deny | ask
  allow:
    - ...
  ask:
    - ...
  deny:
    - ...
  teamHardDeny:
    - ...
```

`ask` and `mutationEnvelope` are orthogonal.

`ask` says:

> This operation requires an approval flow.

`mutationEnvelope` says:

> This is the maximum range within which the Leader is authorized to approve/mutate.

### 2.8 Operation-local policy resolution

Parameter-aware permissions do not use whole-cell winner-takes-all resolution.

For a concrete operation, ordinary Team policy layers are examined from high to low:

```text
HumanOverride
InstanceOverlay
TemplateOverlay
Template
PolicyState
Blueprint
```

The first layer containing an ordinary rule that matches the concrete operation determines the ordinary outcome.

Within the **same layer**, if multiple ordinary rules match:

```text
deny > ask > allow
```

There is no "most-specific matcher wins" rule in `0.1.1-alpha.1`.

`teamHardDeny` is evaluated as a separate hard lane and is not bypassed by a more specific ordinary Team rule.

If no ordinary rule matches, use the Template permission `default`:

```text
deny | ask
```

### 2.9 Alpha supports one primary security parameter per supported tool

No arbitrary predicate DSL and no multi-argument conjunction system are introduced.

The first supported built-ins are expected to include at least:

```text
read(file_path)
read_image(file_path)
write(file_path, ...)
edit(file_path, ...)
lsp(..., file_path, ...)
```

For these tools, path semantics must use DSH's public filesystem resolution seam rather than raw prefix/string checks.

`bash(command)` may support parameter-level:

```text
ask
deny
teamHardDeny
```

but does **not** receive a parameter-level strong positive `allow` in alpha because safe positive shell authorization requires shell-aware parsing and effect analysis.

MCP receives no parameter-level permission system in alpha. MCP remains server/tool-name level only.

### 2.10 Exact-resource durable grants

Leader `grant_instance` grants only:

```text
current MemberInstance
+
current canonical exact resource
```

It does not promote an `ask` glob and does not infer a directory scope.

Example:

```text
Read(D:/project/tests/a.txt)
```

durable grant becomes an exact authorization for the canonical resolved resource corresponding to `a.txt`, not:

```text
Read(D:/project/tests/**)
```

Human approval-derived durable override follows the same rule in alpha:

```text
current MemberInstance + exact resource
```

Broader Template/Team/custom-scope policy editing belongs to a future policy-administration surface, not the approval dialog.

### 2.11 `grant_instance` is a composite action

For the current synchronous approval flow:

```text
grant_instance
=
allow_once(current blocked operation)
+
durable exact-resource grant(future operations)
```

These remain two separate auditable authority facts even if one UI action creates both.

This preserves future-boundary mutation semantics while avoiding a confusing "approved but current call still failed; please retry" behavior.

### 2.12 Human and Leader approval routing

For a Teammate:

```text
allow
→ execute

ask
→ Leader

deny
→ reject

teamHardDeny
→ Leader review
    ├─ deny
    └─ escalate_to_user
```

A Leader must not `allow_once` or durable-grant through `teamHardDeny`.

Leader escalation is not authorization. It creates or transitions into a Human-only `USER_APPROVAL` path.

For the Leader's own operation:

```text
allow
→ execute

ask
→ Human

deny
→ reject

teamHardDeny
→ Human authority path
```

The Leader cannot self-approve.

### 2.13 Synchronous approval remains the alpha behavior

For `0.1.1-alpha.1`, an `ask` that requires Leader or Human approval remains blocking at the relevant pre-execution path until resolved.

The proposed asynchronous long-latency Human approval/retry model is explicitly **deferred**.

### 2.14 Permission changes must be model-visible at the effective boundary

A durable permission mutation affecting a live lower-level Agent must become model-visible no later than the model step in which the new permission becomes effective.

Use the same general pattern as DSH's own live approval-policy switch:

```text
durable permission mutation
+
runtime-context current snapshot
+
agent.inject(permission-change notice)
```

`agent.inject(...)` carries the transition notice to the next model step.

The runtime-context snapshot carries the current truth and is required for restart/crash correctness.

The durable policy, not the injected text, is authoritative.

### 2.15 Future-boundary semantics are retained

Already-captured in-flight work is not reinterpreted under a concurrent durable policy mutation.

The mutation becomes effective at the next boundary.

Conceptually:

```text
Step N starts with P0
Leader commits P1 during Step N
Step N remains P0
Step N+1 sees P1 + injected change notice
```

### 2.16 Instance grant lifetime

An instance-scoped grant is bound to the identity of the MemberInstance.

```text
RUNNING
→ ARCHIVED
→ RESTORE
```

restores the same grant because it is still the same MemberInstance.

`DISPOSED` permanently ends the grant's effective authority.

Append-only history may remain for provenance/audit.

### 2.17 One-shot approvals must bind to the exact operation

The current control scope is not sufficient if it contains only:

```text
rootSessionId
targetInstanceId
actionName
toolName?
capabilityDomain?
correlation
```

The control operation identity must additionally bind the security-relevant canonical argument/resource identity and/or an operation fingerprint.

An approval for:

```text
Read(a.txt)
```

must not authorize:

```text
Read(b.txt)
```

One-shot allow remains exactly-once consumed.

### 2.18 External hard policy is checked at the last mile

External hard facts may change after an approval is recorded.

Therefore a live external-hard check must occur before final dispatch, even if a Leader/Human control decision already says `allow`.

No stale Team-side approval may pierce a newly tightened external ceiling.

## 3. Deferred decision: asynchronous Human approval and retry

The following concept is recorded for a future version and must not be implemented as alpha behavior.

Desired direction:

1. a long-latency Human approval should eventually allow the Agent to continue other work instead of blocking indefinitely;
2. when the Human result arrives, inject the approval result and any permission change;
3. do not automatically execute the abandoned operation;
4. let the Agent retry if still needed;
5. if the retry payload is exactly equivalent to the approved payload, it may be treated as the approved operation;
6. if the payload changed, route the retry to the Leader so the Leader can compare the old/new payload and decide whether behavior, boundary, and impact are still equivalent or sufficiently close.

The important semantic interpretation is:

> "Allow once" approves a concrete operation and assumes responsibility for its concrete impact. It is not an unlimited one-shot right over a resource object.

This future design requires an explicit notion of operation/payload/effect equivalence and therefore is deferred.

## 4. Rejected or deferred alternatives

### 4.1 Member autonomous permission tightening

Rejected.

Even a restrictive durable change is governance. A Member may behaviorally choose not to act, but may not persistently rewrite its own future authority.

### 4.2 Member autonomous expansion inside `mutationEnvelope`

Rejected.

It collapses `ask → Leader` because the Member could simply grant itself the permission.

### 4.3 `ask` implied by `mutationEnvelope`

Rejected.

Approval routing and governance authority are separate axes.

### 4.4 Most-specific matcher wins

Rejected for alpha.

It permits surprising same-layer holes where an exact allow pierces a broad deny.

Same-layer ordinary conflicts are resolved conservatively:

```text
deny > ask > allow
```

### 4.5 Durable grant promotes the matched `ask` glob

Rejected.

A single approval must not silently widen into a directory/subtree permission.

### 4.6 Approval dialog chooses custom durable scope

Deferred.

It would turn the approval UI into a general policy editor.

### 4.7 MCP parameter-level permission DSL

Deferred.

MCP tool naming/argument semantics are not stable enough for the alpha security surface, and many MCP-side restrictions are better enforced by the server itself.

### 4.8 Bash command positive allow

Deferred.

Positive command authorization without a shell-aware parser is unsafe.

### 4.9 Arbitrary generic predicate DSL

Rejected for alpha.

The initial design is deliberately typed and narrow.

## 5. Consequences

### Positive

- Clear authority chain.
- No Member self-escalation or self-locking governance mutation.
- `deny`, `ask`, `teamHardDeny`, and `externalHard` have non-overlapping meanings.
- Exact-resource durable grants minimize accidental privilege expansion.
- Approval and policy mutation remain separate auditable facts.
- Current DSH public seams are sufficient; no core patch is required.
- Model-visible mutation notifications align with DSH's existing live-policy behavior.
- Archive/restore semantics naturally preserve instance-local authority.
- Security semantics remain understandable enough to test exhaustively.

### Negative / cost

- `permissions` can no longer share the current generic `PolicyEntry` representation without a typed extension.
- Current leader→template/member→instance mutation assumptions need partial refactoring for permissions.
- Control operation scope must be extended with canonical argument/resource identity.
- A runtime-context permission snapshot must be added.
- Hard-deny escalation needs an explicit Leader-review-to-Human transition.
- Exact-resource grants may create many fine-grained instance rules, although this is acceptable because their effective lifetime is instance-scoped.
- Alpha keeps blocking Human approval, which can cause long waits.

## 6. Required invariants

The implementation and test suite should treat the following as hard invariants:

1. Member cannot persistently mutate its own permission state.
2. Leader cannot mutate its own governance ceiling.
3. Leader cannot self-approve.
4. `deny` never enters an approval flow.
5. `teamHardDeny` cannot be bypassed by Member/Leader.
6. Human may explicitly bypass Team hard deny but not external hard.
7. Leader approval and durable grant never exceed `mutationEnvelope`.
8. `grant_instance` means current-call allow-once plus future exact-resource durable grant.
9. One-shot authorization is bound to the exact canonical operation and consumed once.
10. A permission mutation is authoritative in durable state, not in injected text.
11. The affected Agent sees the new permission no later than its effective model step.
12. Archive/restore preserves instance-local grants; dispose terminates their effect.
13. External hard is rechecked at final dispatch.
14. All effective permission decisions remain explainable through provenance.
15. `CORE PATCH BUDGET = 0`.
