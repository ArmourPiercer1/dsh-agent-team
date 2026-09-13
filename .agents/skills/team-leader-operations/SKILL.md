---
name: team-leader-operations
description: Operate a DSH Agent Team as the Leader using the closed set of eleven team tools — list members/templates, inspect config, create member, delegate, follow up, collect, send message, report progress, request/resolve control — including request-token discipline, sync vs async delegation, guard-blocked semantics, and instance addressing. Use when you are the team Leader (your session exposes team_* tools) and need to create members, delegate work, track results, coordinate with members, or manage approval requests.
---

# Team Leader Operations

Operate a DSH Agent Team from the Leader session. The Leader is the only agent
role that can create members, delegate work, and resolve leader-level
approvals. Everything below is the production behavior of the closed eleven
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

## 2. The eleven tools

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

Optional args worth knowing:

- `team_delegate` / `team_follow_up`: `async` (boolean), `attachedContext`
  (max 32768), `taskSummary` (max 512); create form also `groupId`,
  `workspace`.
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

## 3. Delegation: the standard loop

1. `team_list_templates` — see which templates the bound blueprint offers.
2. `team_delegate` with `delegationTemplateId` (create form): the call creates
   a new member from the template and admits the work unit on it.
   - `prompt` is **REQUIRED and self-contained**: the member receives no
     inherited context from you or from sibling transcripts. Put everything
     the member needs in `prompt` (+ `attachedContext` for bulky material).
3. Default is **synchronous**: the call returns when the work unit has
   settled and the member result is in the response.
4. For long work, pass `async: true`: the call returns as soon as the durable
   admission is committed (the response effect carries `workStatus:
   "admitted"`, `settled: false`, and NO result) and the work runs detached —
   your turn ending does not cancel it.
5. Read the terminal state back with `team_collect` using the same request
   token(s): each token reports either `running` (still in flight — or the
   chain crashed before settlement; a same-token re-delegate RESUMES the unit
   instead of admitting a second one) or the terminal result
   (`succeeded` / `failed` / `unavailable`, served verbatim from the durable
   settlement fact — it survives a restart).
6. Continue the same instance with `team_follow_up` (persistent delegation:
   the same bound child session is kept, so the member retains its context).
   Use `team_delegate` with `delegationInstanceId` for new work on an
   existing instance instead.

## 4. Inspecting configuration

`team_inspect_config` returns two distinct faces for one instance:

- `effective` — the legacy GENERIC capability policy view (per-capability
  values after overlay and external facts). Its `permissions` cell is a
  legacy generic cell and is **NOT** the operation-permission authority.
- `operationPermissions` — the ACTUAL static parameter-aware
  operation-permission policy enforced for this instance (the bound template's
  `capabilities.permissions`: default plus allow/ask/deny rules as stored,
  plus the `managedTools` and `resourceKinds` vocabulary). `mode: "absent"`
  when the template declares no permissions.

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
  3. the resolver records `team_resolve_control` (`allow` | `deny`). An
     `allow` authorizes the **exact scope exactly once** — it is consumed by
     the next guarded execution of that scope; it is not a standing grant.
  4. retry the gated operation with a fresh request token for the NEW logical
     execution (the same token only for retrying the same logical operation).
- `team_request_control` is idempotent over the scope identity: retrying with
  the same token returns the existing request.

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
