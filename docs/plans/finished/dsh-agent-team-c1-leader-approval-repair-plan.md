# C1 Leader Approval Reachability Repair Plan

> **Repository:** `ArmourPiercer1/dsh-agent-team`  
> **Baseline:** `master` after PR #18, observed at `040f4107b5fe4e19185327c3c6a6a1e99b48d891`  
> **Host baseline:** `ArmourPiercer1/deepseek-harness@stable-1-0.1.5-rc.2` / `fb2c4b9e698e30edb738bca4cf0618587db7d203`  
> **Core patch budget:** **0-core** — no changes to DeepSeek Harness core/source tree  
> **Scope of this round:** fix **C1 only**. C2 (subagent permission escape) is recorded as a separate security backlog item and is **not** repaired in this round.

## 0. Executive decision

The C1 defect is a **reachability/liveness defect**, not an authority defect.

The durable control plane already has the correct authority semantics:

- a member-side parameter permission `ask` creates a durable `leader-approval` `ControlRequest`;
- `leader-approval` may be resolved by the Leader or human;
- `team_resolve_control` already exists and calls the same `ControlService.resolveControl`;
- the pre-execute adapter already waits for the durable decision and performs the exactly-once last-mile guard.

The missing pieces are:

1. the Leader has no read-only tool that can discover pending approval requests / obtain their exact `requestId`;
2. after a new `leader-approval` request is durably created, no plugin-owned liveness path informs the Leader that the request exists.

The repair therefore **must not change the resolver role model, decision authority, request scope, guard semantics, or durable ledger vocabulary**. It adds discovery + notification around the existing authority.

### Planned C1 surface

Create **one new Team tool**:

- `team_list_pending_control`

Reuse the existing Team tool:

- `team_resolve_control`

Add one **non-authority internal notification port**:

- `deliverRootControlNotification(...)`

No new approval/decision tool is required.

---

# 1. Current code facts and the exact defect

## 1.1 Existing control-plane path

Current parameter-permission `ask` behavior in:

- `packages/runtime/operation-permission/pre-execute-adapter.ts`

is:

```text
supported tool operation
    ↓
static permission = ask
    ↓
controlService.requestControl(...)
    kind =
      leader ? user-approval
             : leader-approval
    ↓
controlService.awaitControlDecision(...)
    ↓
decision allow
    ↓
controlService.guardOperation(...)
    ↓
tool body may execute
```

For a Team member, the durable request is therefore correctly created as:

```text
kind = leader-approval
```

The member tool call then waits silently in `awaitControlDecision()`.

## 1.2 Existing resolver authority is already correct

`packages/runtime/control/types.ts` defines:

```text
leader-approval    -> leader | human
user-approval      -> human
envelope-mutation  -> leader | human
```

A member is never a resolver.

`packages/runtime/control/service.ts::resolveControl()` already enforces request existence, first-decision-wins, resolver-role closure, `resolve-control` envelope, target staleness, external hard policy, and durable decision commit.

**Do not duplicate or weaken any of these checks.**

## 1.3 Existing model-facing Team tools are insufficient

`packages/tools/src/tools.ts::createTeamTools()` currently registers eleven tools, including:

- `team_request_control`
- `team_resolve_control`

but no control-state query.

`team_resolve_control` requires an exact:

```text
requestId
decision
```

so a Leader that has not been externally told the request id has no model-facing way to discover it.

## 1.4 Existing `ControlService.listControlState()` is sufficient as the read authority

`packages/runtime/control/service.ts` already exposes:

```ts
listControlState(rootSessionId)
```

which returns:

```ts
{
  requests: ControlRequestRecord[],
  decisions: ControlDecisionRecord[],
  consumptions: ControlConsumptionRecord[]
}
```

`ControlRequestRecord.status` is already derived as:

```text
pending | decided
```

Therefore C1 does **not** require a new durable table, new ledger fact, new repository, or new projection schema.

---

# 2. Tool work: create exactly one new Team tool

## 2.1 New tool: `team_list_pending_control`

### Purpose

Give the Leader a deterministic, read-only way to discover unresolved `leader-approval` requests and obtain their exact `requestId`.

### Authority

This tool is a **read**. It must not:

- write any control rows;
- consume allows;
- create requests;
- resolve requests;
- mutate member state.

It reads only `ControlService.listControlState(rootSessionId)`.

### Caller policy

For the model-facing Team tool surface, expose its meaningful result to the **Leader only**.

Recommended enforcement:

```text
caller.kind == instance
caller.instanceId == LEADER_INSTANCE_ID
```

A member must not use this tool to inspect other members' command/resource approval metadata.

Human/UI inspection remains a separate remote/UI concern and does not need this tool.

### Default query semantics

The first version should stay deliberately narrow:

```text
status == pending
kind == leader-approval
```

Return requests sorted by durable:

```text
requestSequence ascending
```

Do not add a generic query language in this round.

### Recommended arguments

Use the existing common Team-tool arguments:

```text
rootSessionId
requestToken
```

Add one optional bounded argument:

```text
limit?: integer
```

Recommended semantics:

```text
default = 50
min = 1
max = 100
```

No target/template/regex filters are necessary for C1.

### Recommended result shape

```json
{
  "status": "executed",
  "pending": [
    {
      "requestId": "ctl-...",
      "kind": "leader-approval",
      "requester": {
        "kind": "instance",
        "instanceId": "inst-implementer",
        "role": "member"
      },
      "targetInstanceId": "inst-implementer",
      "actionName": "tool-execute",
      "toolName": "bash",
      "correlation": "...",
      "summary": "bash [cwd=...] ...",
      "createdAt": "...",
      "requestSequence": 123
    }
  ],
  "count": 1,
  "truncated": false
}
```

The list may return the existing `ControlRequestRecord` projection directly if that keeps implementation simpler. Do not invent a second request-record DTO unless necessary for remote-safety.

### Tool description

Suggested wording:

> List unresolved `leader-approval` control requests for this Team. Read-only: it creates no request and grants no authority. Use the returned exact `requestId` with `team_resolve_control` to allow or deny a request.

---

# 3. Notification work: notify the Leader after a new durable request

The pending-list tool makes the state discoverable and restart-recoverable, but polling alone is poor liveness. Add a plugin-owned notification path for newly-created `leader-approval` requests.

## 3.1 Notification is not authority

The durable `ControlRequest` remains the sole authority.

The notification is only:

```text
"this durable request now exists"
```

A notification cannot approve, deny, change the request, change the resolver role set, or substitute for `team_resolve_control`.

If notification delivery fails, the durable request **must remain pending and discoverable** through `team_list_pending_control` and the GUI.

## 3.2 Notify only on first creation, not on idempotent retry

`requestControl()` is idempotent over its scope identity.

Required behavior:

```text
first requestControl for scope
    -> append request row
    -> notification eligible

retry with same logical scope
    -> return existing request
    -> DO NOT send another notification
```

## 3.3 Notification must happen after the control lock is released

This is a hard implementation rule.

Do **not** await a Leader model-visible delivery while holding the control service's per-team lock.

Incorrect:

```text
withTeamLock(...)
  append ControlRequest
  await deliverLeaderNotification()   <-- forbidden
```

because the Leader may respond by calling `team_resolve_control`, which needs the same control lock.

Required structure:

```ts
const outcome = await withTeamLock(...)
// outcome = { record, created }

if (outcome.created && outcome.record.kind === 'leader-approval') {
  await/bestEffortNotify(outcome.record)   // lock already released
}

return outcome.record
```

The test suite must include a re-entrant resolve case proving this does not deadlock.

## 3.4 Notification failure is non-fatal to `requestControl`

Durability occurs before liveness notification.

Required ordering:

```text
durable request commit
    ↓
returnable authority exists
    ↓
best-effort Leader notification
```

If notification fails:

- do not roll back the request;
- do not write a fake decision;
- do not report request creation as if it never happened;
- do not convert the member operation into an implicit allow;
- the pending-list tool remains the recovery path.

The implementation may record a diagnostic observation/log entry, but that observation is not authority.

---

# 4. New live port: `deliverRootControlNotification`

## 4.1 Why a dedicated port

Do not route this through `MessagingCoordinator.sendTeamMessage()`.

The messaging coordinator represents an ordinary Team coordination action and writes `team-coordination-recorded`, performs `send-message` admission/envelope checks, and has sender/recipient mediation semantics.

A control notification is not a user/member coordination message. Making it pass through `send-message` would create unrelated ledger facts and could make approval liveness depend on the sender's message envelope.

Instead, add a narrow live-agent port beside the existing root-input ports:

- `deliverRootContext`
- `deliverRootWork`

New:

- `deliverRootControlNotification`

All three may share the existing private `deliverRootInput(...)` mechanism.

## 4.2 Recommended port shape

```ts
deliverRootControlNotification(input: {
  rootSessionId: string
  requestId: string
  text: string
}): Promise<void>
```

## 4.3 Recommended visible text

Use a stable prefix:

```text
[team-control requestId=<REQUEST_ID>]
```

Then concise structured content:

```text
A Team member operation is waiting for Leader approval.

requester: inst-implementer
target: inst-implementer
tool: bash
summary: bash [cwd=/workspace/...] python ...

Review the request and call team_resolve_control with this exact requestId and decision allow|deny.
Use team_list_pending_control to recover or inspect pending requests.
```

Do **not** phrase the notification as "approve this request". It should ask the Leader to review and decide.

## 4.4 Delivery implementation

In:

- `packages/runtime/src/plugin/live/agent-bindings.mjs`

implement it as a thin adapter over the existing private:

```js
deliverRootInput({ rootSessionId, text })
```

Do not add a second root-agent input implementation.

---

# 5. Important liveness caveat: synchronous delegation

The current root input path:

```text
followup(message)
await agent.whenIdle()
```

is model-turn based.

A Leader can itself be busy in a **synchronous** `team_delegate` / `team_follow_up` call while the member it is waiting for reaches a `leader-approval` request. In that topology, a new Leader turn may not be immediately runnable until the current Leader turn/tool call can progress.

Therefore this C1 repair must **not claim** that push notification alone makes every synchronous delegation self-resolving.

### Required current-version behavior

1. `team_list_pending_control` is the durable recovery/discovery mechanism.
2. The notification is best-effort liveness.
3. For work likely to hit member approval gates, the Leader operations guidance should recommend:
   - `team_delegate(..., async: true)` / `team_follow_up(..., async: true)`;
   - handle approval notifications/pending requests;
   - resolve them;
   - use `team_collect` for the terminal member result.

### Required characterization test

Add a real-host test that distinguishes:

- Leader idle + member request -> notification processed;
- Leader busy in synchronous delegation + member request.

If the second case queues the notification until the Leader's current turn unwinds, document that as a **known scheduling limitation**. Do not create a second concurrent Leader execution lane or modify DSH core in this C1 round.

If a later design wants synchronous delegate calls to return early with `approval-required`, that is a separate work-unit/control orchestration feature, not part of this bounded C1 repair.

---

# 6. Code modules to touch

## 6.1 `packages/runtime/control/types.ts`

Add the notification-port type to the control-plane wiring, for example:

```ts
export interface ControlRequestNotificationPort {
  notifyLeaderRequest(request: ControlRequestRecord): Promise<void>
}
```

Extend `ControlServiceOptions` with an optional port:

```ts
readonly requestNotification?: ControlRequestNotificationPort
```

Optional is preferable because notification is liveness, not authority; factory/unit worlds should not need a live Leader Agent; pending-list discovery remains functional without the port.

Do not modify `ControlRequestRecord` unless implementation proves a new field is actually required.

## 6.2 `packages/runtime/control/service.ts`

Refactor `requestControl()` so the per-team critical section returns internally:

```ts
{
  record: ControlRequestRecord
  created: boolean
}
```

Behavior:

- existing idempotent request -> `{ created: false }`;
- new durable request append -> `{ created: true }`.

After `withTeamLock(...)` returns:

```text
if created && kind == leader-approval:
    attempt requestNotification.notifyLeaderRequest(record)
```

Catch notification failures as liveness diagnostics; do not alter the durable request outcome.

### Explicit non-changes

Do not change:

- resolver roles;
- request idempotency key;
- scope/fingerprint identity;
- `resolveControl`;
- `guardOperation`;
- allow consumption;
- external hard-policy rechecks;
- wait semantics.

## 6.3 Optional new pure module: `packages/runtime/control/leader-notification.ts`

Recommended to keep `service.ts` small.

Responsibilities:

- render the notification text from `ControlRequestRecord`;
- define stable bounded display rules;
- call the injected root-delivery port.

Suggested API:

```ts
createLeaderControlNotifier({
  deliver
}): ControlRequestNotificationPort
```

Do not put any durable state here.

## 6.4 `packages/runtime/src/plugin/live/agent-bindings.mjs`

Add:

```js
async function deliverRootControlNotification(input) { ... }
```

Reuse:

```js
deliverRootInput(...)
```

Return the new port from `createAgentBindings()`.

Add comments making clear that it is model-visible liveness input, carries no authority, and does not write TeamDomain state.

## 6.5 `packages/runtime/src/plugin/types.ts`

Extend `TeamAgentBindings` with:

```ts
deliverRootControlNotification?: (...)
```

Keep it optional for non-production/factory worlds.

If equivalent interface declarations also exist in `host.ts`, keep those structural mirrors synchronized.

## 6.6 `packages/runtime/src/plugin/root.ts`

At the production assembly point:

1. read `live.deliverRootControlNotification`;
2. build the notification adapter;
3. inject it into `createControlService(...)`.

Do not route it through `MessagingCoordinator`.

Production assembly should remain:

```text
live glue
    ↓
ControlService(requestNotification=...)
    ↓
Team tools + permission adapter consume same ControlService
```

No second ControlService instance.

## 6.7 `packages/tools/src/tools.ts`

Add:

```ts
listPendingControlSpec()
```

to the registered spec list.

Tool catalog count changes:

```text
11 -> 12
```

Implementation:

1. validate optional `limit`;
2. verify model caller is the Leader;
3. call `controlService.listControlState(rootSessionId)`;
4. filter:
   - `status === 'pending'`
   - `kind === 'leader-approval'`;
5. sort by `requestSequence`;
6. apply `limit`;
7. return stable read-only result.

Reuse existing `rejectFromError()` behavior.

Do not call `requestControl()` or `resolveControl()` from this tool.

## 6.8 `packages/tools/src/types.ts` / generated declarations

Touch only if the result union or tool-set type requires a new shape.

Rebuild tracked `dist/**` mirrors using the repository's normal build procedure; do not hand-edit dist.

## 6.9 `.agents/skills/team-leader-operations/SKILL.md`

Update:

- "eleven tools" -> "twelve tools";
- add `team_list_pending_control`;
- approval workflow becomes:

```text
notification or explicit pending-list read
    ↓
inspect requestId + summary
    ↓
team_resolve_control
```

Add the asynchronous-delegation guidance from §5.

## 6.10 `.agents/skills/team-blueprint-authoring/SKILL.md`

Update leader template guidance:

A Leader that must perform leader-level approvals should expose:

```yaml
teamTools:
  kind: allow
  items:
    - team_list_pending_control
    - team_resolve_control
```

and its Team envelope must still permit the existing `resolve-control` operation.

Do not imply that tool exposure alone grants resolver authority; the ControlService role closure remains authoritative.

---

# 7. C2 handling in this round

## 7.1 Scope decision

C2 is **not repaired** in this round.

Create/retain a backlog item similar to:

> **C2 — DSH subagent descendants do not inherit Team agent-local parameter permission / builtin deny governance.** A Team member can delegate to an in-process subagent that inherits the parent preset standing composition but not the Team member's agent-local permission listener/guard.

No hard plugin-level deny is added in this C1 PR.

## 7.2 Important correction: `builtinToolDeny: [subagent]` is not currently a reliable mitigation

The current repository's own authoring skill and the rc.2 composition code show a specific limitation:

- shipped non-minimal presets (`standard`, `cordis`, `ptc`) install the spawn `subagent` tool into the **agent's own tool layer** during/after publication;
- `builtinToolDeny` uses `agentCtx.tools.restrict(...)` over the restrictable inherited/global layer;
- the late own-layer `subagent` therefore is not reliably removed by adding `"subagent"` to `builtinToolDeny`;
- the current authoring skill explicitly records that doing so can fail setup as `unknown global tool "subagent"` while the model-facing `subagent` still appears later.

Therefore this C1 round must **not** change documentation to falsely promise:

```yaml
builtinToolDeny:
  - subagent
```

as a complete mitigation on the standard preset.

### Temporary safe authoring guidance while C2 remains open

Use one of:

1. a preset that does not mount the spawn `subagent` tool (the shipped `minimal` preset is the known example); or
2. a custom preset/composition that does not install `subagent`.

If the project intentionally keeps a standard/cordis/ptc preset with `subagent` visible, record C2 as an accepted temporary risk until the descendant-governance work is completed.

If a future rc.2-compatible plugin change makes `subagent` genuinely restrictable by `builtinToolDeny`, update this guidance only after a post-publication model-surface test proves it.

---

# 8. Concrete implementation sequence

## Task C1-0 — freeze evidence and baseline

Before editing:

```bash
git switch master
git pull --ff-only
git switch -c fix/c1-leader-approval-reachability
```

Record:

- current plugin HEAD;
- host pin `fb2c4b9e69`;
- one pre-fix live reproduction:
  - member `bash` hits ask;
  - durable `leader-approval` exists;
  - Leader has no request-id discovery tool.

Do not spend time re-proving C2 in this branch.

## Task C1-1 — add the read-only pending-list tool first

Implement `team_list_pending_control` against existing `listControlState`.

Why first:

- it is sufficient to make durable state manually discoverable;
- it can be unit-tested without any live-agent notification path;
- if notification work has a host-seam problem, the C1 round still has a usable fallback.

Acceptance:

```text
Leader can obtain exact pending requestId from model-facing Team tools.
```

## Task C1-2 — add notification port and renderer

Implement:

```text
ControlRequestRecord
    ↓
leader-notification renderer
    ↓
deliverRootControlNotification
    ↓
existing deliverRootInput
```

Keep rendering pure and bounded.

Acceptance:

```text
one new leader-approval durable request -> one leader notification attempt
```

## Task C1-3 — refactor requestControl notification timing

Modify `requestControl()` internal flow to distinguish:

```text
created vs existing
```

Then call notification only:

```text
after lock release
AND created
AND kind == leader-approval
```

Notification failures are swallowed/logged as liveness failures.

Acceptance:

- no duplicate notification on idempotent retry;
- re-entrant Leader `team_resolve_control` does not deadlock;
- durable request survives notification failure.

## Task C1-4 — production wiring

Wire the port in `root.ts`.

Requirements:

- one ControlService only;
- no messaging-coordinator detour;
- no DSH core change;
- no new TeamDomain storage;
- no new SessionEvent vocabulary.

## Task C1-5 — update Leader/Blueprint skills

Update the tool count and documented approval workflow.

Add the async delegation recommendation for permission-gated members.

Update C2 warning accurately; do not claim `builtinToolDeny: [subagent]` works where the current rc.2 tool-layer topology proves otherwise.

## Task C1-6 — rebuild tracked artifacts

Run the canonical runtime build and update tracked `dist/**` output deterministically.

Do not mix unrelated cleanup or the characterization-probe migration into this PR.

---

# 9. Required tests

## 9.1 Tool unit tests

Create a focused suite, e.g.:

```text
packages/tools/test/c1-list-pending-control.test.ts
```

Required cases:

1. Leader + zero pending -> empty list.
2. Leader + one pending leader-approval -> exact request returned.
3. decided request excluded.
4. pending `user-approval` excluded.
5. pending `envelope-mutation` excluded in this first narrow tool.
6. multiple requests sorted by `requestSequence`.
7. limit truncates deterministically.
8. member caller rejected.
9. list causes zero ledger writes / zero decision / zero consumption.

## 9.2 Control-service notification tests

Create a focused suite, e.g.:

```text
packages/runtime/test/c1-control-notification.test.ts
```

Required cases:

1. new `leader-approval` -> one notifier call;
2. idempotent retry -> no second notifier call;
3. `user-approval` -> no Leader notifier call;
4. notifier throws -> requestControl still returns the durable request;
5. request remains visible as pending after notifier failure;
6. notifier runs after lock release:
   - notifier synchronously/asynchronously invokes `resolveControl`;
   - test completes without deadlock;
   - returned request is decided.

The last case is the key regression test.

## 9.3 Live glue tests

Test:

```text
deliverRootControlNotification
```

for:

- stable requestId prefix;
- correct root session target;
- reuse of root input seam;
- rejection propagation to the notifier layer, where it becomes non-fatal to request authority.

## 9.4 Production wiring integration

Test the real composition path:

```text
member permission ask
    ↓
request durable
    ↓
leader notification port invoked
    ↓
leader resolves existing request
    ↓
member pre-execute waiter observes allow
    ↓
guard consumes allow once
```

No direct test-only decision injection after the request is created; exercise the same `team_resolve_control` / `ControlService.resolveControl` authority.

## 9.5 Restart recovery

Create pending request, close/reopen durable TeamDomain, then:

```text
team_list_pending_control
```

must still return it.

No notification replay is required in this version; the list tool is the recovery mechanism.

## 9.6 Real-host smoke

Minimum smoke matrix on rc.2:

### S1 — pending discovery

- member triggers permission ask;
- verify durable request pending;
- Leader calls `team_list_pending_control`;
- exact `requestId` appears.

### S2 — Leader resolve

- Leader calls `team_resolve_control(requestId, allow)`;
- member operation proceeds;
- one consumption fact appears.

### S3 — deny

- same setup;
- Leader resolves deny;
- member operation has zero side effects.

### S4 — notification failure recovery

- intentionally make notification delivery unavailable/fail;
- request remains durable;
- pending-list still discovers it;
- Leader can resolve it.

### S5 — idempotent retry

- retry same request scope/correlation;
- same requestId;
- no duplicate notification.

### S6 — Leader busy/synchronous delegation characterization

- reproduce a member approval while Leader is blocked in synchronous delegation;
- record whether root notification is immediately processable or queued;
- verify no plugin deadlock caused by holding a control lock during delivery;
- if immediate Leader decision is not schedulable, document:
  - use `async: true` for approval-capable work;
  - pending-list remains the durable recovery path.

This test is characterization, not a requirement to create concurrent Leader turns.

---

# 10. Acceptance criteria

C1 is complete when all are true:

1. `team_list_pending_control` exists and is model-facing to the Leader.
2. It reads only durable control state and performs zero writes.
3. It returns exact pending `leader-approval` request IDs.
4. Existing `team_resolve_control` resolves those requests without a new authority path.
5. New durable `leader-approval` requests attempt a Leader notification.
6. Notification is emitted only for newly-created requests, not idempotent retries.
7. Notification delivery occurs only after the control lock is released.
8. Notification failure does not remove/deny/allow the durable request.
9. Restart recovery works through the pending-list tool.
10. A real rc.2 smoke proves member ask -> Leader discover -> Leader resolve -> guarded execution.
11. No DSH core file is changed.
12. C2 runtime behavior is unchanged and explicitly remains backlog.
13. Documentation does not claim `builtinToolDeny: [subagent]` is effective where current rc.2 composition proves it is not.

---

# 11. Explicit non-goals / forbidden fixes

Do **not** in this C1 PR:

- change `leader-approval` into `user-approval`;
- let the Leader resolve `user-approval`;
- auto-allow any request;
- bypass `team_resolve_control`;
- create a parallel approval ledger;
- create a second ControlService;
- route control notification through ordinary Team messaging admission;
- hold the control team-lock while driving a Leader model turn;
- change exact-scope / operation-fingerprint semantics;
- change allow-once consumption;
- implement subagent governance inheritance;
- add a hard plugin-level `subagent` deny;
- modify DeepSeek Harness core;
- bundle the characterization-probe migration or unrelated alpha work.

---

# 12. Suggested commits

```text
feat(tools): add leader pending-control query
feat(control): notify leader on newly-created approval requests
feat(runtime): wire root control notifications through live input
test(control): cover leader approval reachability and recovery
docs(skills): document pending approvals and deferred subagent risk
```

If implementation needs a temporary probe/instrumentation commit, squash or drop it before merge.

---

# 13. Recommended PR summary

Suggested PR title:

```text
fix(control): make leader approval requests discoverable and reachable
```

Suggested scope statement:

> This PR fixes C1 only. It adds a read-only Leader pending-control tool and a best-effort Leader notification after a newly-created durable `leader-approval` request. The existing ControlService remains the sole authority; `team_resolve_control` remains the sole model-facing decision tool. No DSH core changes and no subagent-governance changes are included. C2 remains a separate security backlog item.

---

# 14. Handoff instructions for the local coding agent

Use this exact implementation order:

1. Read current `master` and verify the host pin remains rc.2.
2. Implement `team_list_pending_control` over `ControlService.listControlState`.
3. Add leader-only caller enforcement and focused unit tests.
4. Add a narrow root control-notification port using the existing `deliverRootInput` path.
5. Refactor `requestControl()` only enough to know `created` vs `existing`.
6. Invoke notification only after the per-team lock is released, only for newly-created `leader-approval`.
7. Make notification failure non-authoritative/non-fatal.
8. Wire the production root; do not use MessagingCoordinator for this signal.
9. Add the re-entrant resolve/no-deadlock test.
10. Add restart/pending-list recovery test.
11. Run the rc.2 real-host smoke, including the synchronous-delegation characterization.
12. Update `team-leader-operations` and blueprint authoring docs.
13. Keep C2 as backlog. Do not implement descendant permission inheritance or a runtime hard deny in this PR.
14. Do not document `builtinToolDeny: [subagent]` as a working standard-preset mitigation unless a post-publication rc.2 surface test first proves it actually removes the tool.

The final implementation report must include:

- changed files;
- new tool schema/result example;
- notification delivery ordering;
- proof the notifier runs outside the control lock;
- idempotent retry behavior;
- notification-failure recovery evidence;
- rc.2 real-host smoke evidence;
- C2 backlog statement and temporary authoring guidance.
