---
name: team-leader-operations
description: Operate a DSH Agent Team as the Leader using the closed set of fifteen team tools — list members/templates, inspect config, create member, delegate, follow up, collect, send message, report progress, request/resolve control, list pending approvals, archive member, grant/revoke permission rules — including request-token discipline, sync vs async delegation, guard-blocked semantics, and instance addressing. Use when you are the team Leader (your session exposes team_* tools) and need to create members, delegate work, track results, coordinate with members, manage approval requests, move a member out of the active work set, or change a member's durable permission overlay.
---

# Team Leader Operations

Operate a DSH Agent Team from the Leader session. The Leader is the only agent
role that can create members, delegate work, and resolve leader-level
approvals. Everything below is the production behavior of the closed fifteen
`team_*` tools — there are no other team tools, and no hidden side channels.

## 1. Preconditions

- Your session has the `team_*` tools registered (you are the Leader of a
  bound team session). A plain chat session has none of them — do not try to
  operate a team from a non-team session.
- **Every call requires two common arguments:**
  - `rootSessionId` — the TeamSession (root session) id the operation belongs to
    (from your session context; max 255 chars).
  - `requestToken` — a token unique to THIS logical operation (non-empty, max
    128 chars).
- `requestToken` discipline:
  - generate a fresh token for every new logical operation;
  - reuse the **exact same** token only when retrying the **same** logical
    operation after a transient failure (same-token replay is how exactly-once
    admission and async resume work);
  - never reuse a token for a different operation.
- Addressing: operations that target a member take the member **INSTANCE id**
  (e.g. `inst-...`). Labels and template ids are rejected by live resolution —
  always resolve ids from `team_list_members` first.

## 2. The fifteen tools

| Tool | What it does | Required args (besides the two common ones) |
| --- | --- | --- |
| `team_list_members` | List every member instance: template id, label, lifecycle state, bound child session id | — |
| `team_list_templates` | List the member templates of the bound blueprint (template id, display name, context policy) | — |
| `team_inspect_config` | Inspect ONE member instance's effective policy | `targetInstanceId` |
| `team_create_member` | Create a NEW member instance from a template (explicit creation) | `delegationTemplateId`, `label` |
| `team_delegate` | Delegate a work unit: create a new member from a template AND delegate, OR delegate to an existing instance | exactly one of `delegationTemplateId` / `delegationInstanceId`, `label` (create form), `prompt` |
| `team_follow_up` | Admit a follow-up work unit on an EXISTING instance (persistent: same bound child session is kept) | `targetInstanceId`, `prompt` |
| `team_collect` | Read the durable state of admitted work units by request token (async read-back) | `requestTokens` (1..64) |
| `team_send_message` | Send one message to a member instance (relay policy mediates through the Leader where required) | `recipientInstanceId`, `body` (max 8192) |
| `team_report_progress` | Record progress on one work subject of an instance | `instanceId`, `subject`, `progress` |
| `team_request_control` | Request approval for one operation scope (idempotent over the scope identity) | `kind`, `targetInstanceId`, `actionName` |
| `team_resolve_control` | Record an allow/deny decision on a pending control request | `requestId`, `decision` |
| `team_list_pending_control` | List the team's unresolved `leader-approval` requests with their exact `requestId`s (read-only, Leader-only) | — |
| `team_archive_member` | Archive ONE member instance — move it out of the active work set (durable, Leader-only) | `targetInstanceId` |
| `team_grant_permission` | Grant durable permission-overlay rules to ONE member instance (Leader-only; the ONE governance mutation authority). Tightenings apply immediately; an EXPANSION needs explicit carrier coverage on the bound Blueprint and, on a schemaVersion-3 Blueprint, must also stay inside BOTH authority ceilings (`teamHardEnvelope` and the Leader's own carrier, evaluated separately, never merged). A rise above either refuses typed as `PERMISSION_AUTHORITY_CEILING_INSUFFICIENT` — **needing higher authority is a refusal, never a pending request** — and an unreadable ceiling document refuses as a context fault rather than being treated as absent. A rule-set-equal replay commits nothing. Does NOT change the Leader's own permissions. | `targetInstanceId`, `rules` (1..n closed `{operationClass, matcher, effect}`) |
| `team_revoke_permission` | Remove previously granted overlay rules from ONE member instance; the next pre-execute decision falls back to the lower layers. **A removal can itself be an EXPANSION** — where a revoke lets a looser remaining rule ANSWER (a reveal), it is gated exactly like a grant (carrier coverage, and on v3 both ceilings). A rule-set-equal replay commits nothing. | `targetInstanceId`, `rules` (1..n closed `{operationClass, matcher, effect}`) |

The grant/revoke pair is one specification materialised twice (`permissionSpec('grant')` /
`permissionSpec('revoke')`), so their argument grammar is identical by construction — that is
why this table shows them with the same required args. See the section at the end of this file
on why narrowing a shell-class rule below `allow` is the one mutation you should think twice
about before issuing.

Optional args worth knowing:

- `team_delegate` / `team_follow_up`: `async` (boolean, **default true
  when omitted** — the work runs async unless you explicitly opt out with
  `async: false`), `attachedContext` (max 32768), `taskSummary` (max 512);
  create form also `groupId`, `workspace`.
- `team_create_member`: `groupId`, `workspace`.
- `team_send_message`: `subject` (max 256).
- `team_report_progress`: `progress` is a closed enum
  `in-progress | completed | blocked`; plus `summary`, `lastAction`,
  `correlation`.
- `team_request_control`: `kind` is a closed enum
  `leader-approval | user-approval | envelope-mutation`; plus `toolName`,
  `summary`.
- `team_resolve_control`: `decision` is a closed enum `allow | deny`; plus
  `note`.
- `team_list_pending_control`: optional `limit` (integer, default 50,
  maximum 100). It returns ONLY pending `leader-approval` requests
  (sorted by durable request sequence) — `user-approval` and
  `envelope-mutation` requests are NOT listed; the GUI remains the
  inspection surface for those.
- `team_archive_member`: no optional args. For a legal archive target
  (RUNNING or SETTLED), the lifecycle authority QUIESCES the member
  first (its current work is interrupted and its resident descendants
  drained) and then commits durably: a SETTLED member takes ONE durable
  ARCHIVE commit (no intermediate SETTLE transition is needed — the
  quiesce still runs); a RUNNING member is durably SETTLED FIRST and
  then durably ARCHIVED (two durable commits — the frozen lifecycle
  FSM has no RUNNING → ARCHIVED edge). CREATED, ARCHIVED, and DISPOSED
  targets are rejected before any live effect (they are never
  quiesced). The archived member no longer accepts new Team work until
  it is explicitly restored. Like other guarded instance-targeted
  mutations, it is guarded on the target: a pending control request for
  the scope blocks it. A member caller is rejected
  (`TEAM_TOOL_ARCHIVE_NOT_LEADER`) before any effect.

## 3. Delegation: the standard loop

1. `team_list_templates` — see which templates the bound blueprint offers.
2. `team_delegate` with `delegationTemplateId` (create form): the call creates
   a new member from the template and admits the work unit on it.
   - `prompt` is **REQUIRED and self-contained**: the member receives no
     inherited context from you or from sibling transcripts. Put everything
     the member needs in `prompt` (+ `attachedContext` for bulky material).
3. Default is **asynchronous**: with no `async` argument the call returns
   as soon as the durable admission is committed (the response effect
   carries `workStatus: "admitted"`, `settled: false`, and NO result) and
   the work runs detached — your turn ending does not cancel it.
4. For the terminal state, read it back with `team_collect` using the same
   request token: each token reports either `running` (still in flight — or
   the chain crashed before settlement; a same-token re-delegate RESUMES the
   unit instead of admitting a second one) or the terminal result
   (`succeeded` / `failed` / `unavailable`, served verbatim from the durable
   settlement fact — it survives a restart).
5. Pass `async: false` for **synchronous** behavior (opt-in): the call
   returns when the work unit has settled and the member result is in the
   response. Use it only for work you know will not wait on a leader
   approval (see §5.1).
6. Continue the same instance with `team_follow_up` (persistent delegation:
   the same bound child session is kept, so the member retains its context).
   Use `team_delegate` with `delegationInstanceId` for new work on an
   existing instance instead.

## 4. Inspecting configuration

`team_inspect_config` is a PURE READ (zero side effects) and returns the
SAME-SOURCE view the runtime authority uses — no re-probe, nothing invented:

- `effective` — the generic capability policy view for the closed set
  `model` / `tools` / `skills` / `mcp` (per-capability values after
  governance overrides + external facts). The generic `permissions` cell is
  NOT surfaced (it is not an authority) — the operation-permission
  authority is the independent field below.
- `operationPermissions` — the ACTUAL static parameter-aware
  operation-permission policy enforced for this instance (the bound template's
  `capabilities.permissions`: default plus allow/ask/deny rules as stored,
  plus the `managedTools` and `resourceKinds` vocabulary). `mode: "absent"`
  when the template declares no permissions.
- `policyState` — the COMMITTED policy state: `source` is
  `"blueprint-default"` (the implicit `default` state, no durable
  transition ever committed) or `"durable-transition"` (the last durable
  transition: `stateId` + `cells` + the `entryId`/`origin` of the row).
- `requirement` — the durable requirement facts: the compatibility verdict
  (status/fingerprint/generation/outcomes/acknowledgements, verbatim; absent
  if never probed), the latest optional-requirement consent per
  requirement, and the latest template-availability fact per template.
- `recovery` — DERIVED from the durable incident facts (no live probe):
  `openIncidents` (scopes whose latest incident fact is `opened`),
  `lastClosed` (the durable exit records), and `active` (true iff any
  incident is open). A `closed` fact is history, not live state.

## 5. Approvals, guard, and blocked results

- Work operations addressed to an existing, well-formed instance id consult
  the last-mile guard IMMEDIATELY before execution. A blocked verdict returns
  a `blocked` result with a closed `reason` (and the pending `requestId`) and
  zero side effects — the operation never runs.
- When an operation is approval-gated:
  1. the call (or a pre-check) yields `blocked` with a `requestId`, or
  2. you explicitly `team_request_control` for the scope — `kind`:
     - `leader-approval` — resolved by Leader or human;
     - `user-approval` — resolved by the human only;
     - `envelope-mutation` — resolved by Leader or human.
     A member is **never** a resolver.
  3. **discover the requestId**: when a member's operation waits on a
     `leader-approval`, the durable request carries the `requestId` and a
     model-visible Leader notification arrives on your session for NEW
     requests. When no `requestId` is at hand (e.g. after a restart —
     notifications are at-least-once liveness, never a recovery
     mechanism), read `team_list_pending_control` for the exact
     `requestId` + summary. It is a pure read: it creates no request,
     grants no authority, and writes nothing.
  4. the resolver records `team_resolve_control` (`allow` | `deny`) with
     that EXACT `requestId`. An `allow` authorizes the **exact scope
     exactly once** — it is consumed by the next guarded execution of
     that scope; it is not a standing grant.
  5. retry the gated operation with a fresh request token for the NEW
     logical execution (the same token only for retrying the same
     logical operation).
- `team_request_control` is idempotent over the scope identity: retrying
  with the same token returns the existing request (and does NOT re-notify
  you — one durable request, at most one notification).

### 5.1 Approvals and delegation: keep approval-gated work on the async default

A **synchronous** `team_delegate` / `team_follow_up` (explicit
`async: false`) blocks your turn on the member's work unit. If that member
then hits an approval gate (`leader-approval`), the liveness notification
for the request is queued until your current turn can progress — and your
current turn is the one waiting on that member. That topology is a known
scheduling limitation of this release (documented, not a deadlock of the
request path: the request stays durable and the human resolver channel
stays open, but you cannot decide it yourself from inside the blocked turn).

The delegation default is now ASYNCHRONOUS (2026-09-27 ruling), so the
safe path is the plain default:

1. `team_delegate(...)` / `team_follow_up(...)` — no `async` argument —
   the admission returns immediately;
2. handle the approval when it surfaces: the Leader notification (or a
   `team_list_pending_control` read), inspect the `requestId` + summary,
   then `team_resolve_control`;
3. `team_collect` for the terminal member result.

Explicit `async: false` (synchronous) delegation stays fine for work you
know will not ask.

## 6. Reading results

Every tool settles as a lossless JSON result, not an exception. The `status`
field is a closed vocabulary:

- `executed` — the runtime action ran (carries `action`, `callerRole`,
  `effect`, `requestToken`, and the target instance when applicable).
- `rejected` — a typed business rejection (carries `code` + `message`, e.g.
  addressing, quota, envelope, or malformed-argument rejections).
- `blocked` — the guard stopped the operation (carries `reason`,
  `requestId` when a control request exists).
- `delivered` — a message was delivered (carries the recipient and delivery
  face).
- `progress-recorded` / `control-requested` / `control-resolved` — the
  activity/control records.
- `pending-control-listed` — the `team_list_pending_control` read (carries
  the `pending` request records, `count`, and `truncated`).

Treat `rejected` and `blocked` as normal control flow: read the `code` /
`reason`, fix the input or resolve the approval, then act again. Only
unexpected errors surface as tool errors.

## 7. Common mistakes

- Calling team tools from a session that is not a team Leader session.
- Reusing a `requestToken` across different logical operations.
- Targeting a member by label or template id instead of the instance id.
- Writing a delegated `prompt` that assumes the member "knows" the surrounding
  conversation — nothing is inherited; be explicit and complete.
- Expecting `team_collect` to return a result for a unit that is still
  `running` — poll again later; it is a pure read (writes nothing, delivers
  nothing).
- Assuming a `team_resolve_control` allow is a standing permission — it
  authorizes the exact scope exactly once.
- Resolving a `user-approval` request as the Leader — the human is the only
  resolver for that kind.
- Passing explicit `async: false` for approval-gated member work — the
  request's liveness notification is queued behind your blocked turn;
  stay on the async default (no `async` argument) and resolve via the
  notification / `team_list_pending_control` (see §5.1).
- Treating the Leader notification as a recovery mechanism — it is
  best-effort liveness for NEW requests; the durable request + the pending
  list are the recovery path (notifications are not replayed after a
  restart).

---

## Do not narrow a shell-class permission below `allow` (Alpha.4, 2026-10-08)

`team_grant_permission` / `team_revoke_permission` (and the operator-side
`override.mutatePermission`) will happily **narrow** a shell-class rule from
`allow` to `ask`: the mutation is authorized inside the hard envelope, it
commits, and the write leg reports `changed: true`.

What you must know before you do it: an `ask` on a shell-class command requires
approval from the rung that owns the envelope — **Human Admin** — and Alpha.4
ships **no Human Admin resolver** (`CONTROL_UNRESOLVABLE_AUTHORITIES =
['human-admin']`). The control case terminates **synchronously** as
`authority-unavailable`, writing a leg row that is *born terminal* together with
its terminal deny (ADR A1-12). Consequences you will observe:

- the member's affected command is **permanently unavailable at runtime** — no
  pending approval appears, `team_list_pending_approvals` will not show it, and
  nothing retries or unblocks it;
- there is **no UI affordance** to release it; `team_resolve_control` cannot
  answer a case whose reviewer cannot exist;
- the audit trail is intact and awaitable — the refusal is recorded, it is not a
  silent failure. Fail-closed is the correct security outcome; the gap is
  recoverability, not safety.

If you must reduce a member's shell capability, reduce it by **removing the
capability** (deny, or narrowing the resource so the command is simply outside
the member's reach) rather than by routing it through `ask`. Escalating an
existing `allow` to `ask` is reserved for a future Human Admin resolver and is
**tracked as a post-Alpha.4 item**; until then treat `ask` on shell-class
resources as authoring-time intent only, never as a Leader-runtime operation.
