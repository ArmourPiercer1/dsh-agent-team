---
name: team-leader-operations
description: Operate a DSH Agent Team as the Leader using the closed set of fifteen team tools — list members/templates, inspect config, create member, delegate, follow up, collect, send message, report progress, request/resolve control, list pending controls (team_list_pending_control), archive member, grant/revoke permission rules — including request-token discipline, sync vs async delegation, guard-blocked semantics, and instance addressing. Use when you are the team Leader (your session exposes team_* tools) and need to create members, delegate work, track results, coordinate with members, manage approval requests, move a member out of the active work set, or change a member's durable permission overlay.
---

# Team Leader Operations

Operate a DSH Agent Team from the Leader session. The Leader is the only agent
role that can create members, delegate work, and resolve leader-level
approvals. Everything below is the production behavior of the closed fifteen
`team_*` **coordination** tools — there are no other coordination tools and no
hidden side channels. They are NOT the whole `team_` namespace: a governed agent
whose host row carries `teamToolPlane` is additionally given the three
**effect-face** tools `team_grep` / `team_glob` / `team_bash` plus a
takeover-placed `read` (§2.1). That face is separately mounted and separately
lane-governed, none of the fifteen tools drives it, and its real-versus-refused
shape is a fact you must know before you promise a member's work will run.

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

**Fifteen is the closed count — and a mounted copy of this text can lag it.**
The production factory materialises exactly fifteen definitions: thirteen static
specs plus the `permissionSpec('grant')` / `permissionSpec('revoke')` pair
(`packages/tools/src/tools.ts:1524-1541` — the pair is invisible to a
`name: 'team_*'` grep, which is how the count drifted in the first place). The
same count is recorded independently in the host-upgrade evidence
`dev/agent-workflow/evidence/dsh-020rc2-upgrade/03-team-tool-deny-least-privilege.md`
("the plugin registers **15** team tools … plus the pair a `name: 'team_*'` grep
misses"). A copy of this skill that was **mounted into a host skill directory,
or checked out on an older branch/tree, is a snapshot**: the Alpha.3-era copy
still summarizes "the closed set of **thirteen** team tools" (it predates
`team_grant_permission` / `team_revoke_permission`; e.g.
`.worktrees/dsh-020rc2-upgrade/.agents/skills/team-leader-operations/SKILL.md:3`
in this repo is exactly that stale copy). When the mounted text and your live
session disagree, the **live registered `team_*` surface is the authority** and
the text is stale — re-copy it from this repo file, and do not conclude from a
thirteen-name summary that grant/revoke do not exist.

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

### 2.1 The effect-face tools: what a governed agent can actually execute

The fifteen tools above move **team state**. File / search / shell effects run
through a different, separately governed plane, mounted per agent (Leader or
member) ONLY when that agent's host row carries `teamToolPlane` in its config —
an absent row means none of these tools exists at all (mount gate:
`packages/runtime/src/plugin/live/agent-bindings.mjs`, the GLUE-5 row; assembly:
`packages/runtime/src/plugin/live/team-tool-plane.mjs`). The names are
`team_grep` / `team_glob` / `team_bash` (`DEFAULT_PLANE_NAMES`,
`team-tool-plane.mjs:82` at `0e59140b`), plus the native `read`, which is
takeover-placed with its placement-feed rows into the Guard.

Production behavior of that face **as delivered on master** (backend assembly
row `0e59140b`, PR #323, which carried the reviewed GLUE-7 work of the closed
#321):

- `team_grep` — a REAL anchored **read-only `grep(1)`** search over the row's
  governed fs root (`grepArgv` = `-rIn --binary-files=without-match`;
  multiline is refused by name, never reinterpreted:
  `packages/runtime/src/plugin/live/plane-effect-backends.mjs:109,:177`), and
  ONLY when the row configured `plane.fsInstance.rootDir`
  (`createAnchoredSearchBackend`). Do not promise rg semantics (ignore/hidden
  handling, binary shape, error shape) from this row — the plan's rg-parity
  regression baseline is a separate open item.
- `team_bash` — a REAL confined process provider (kernel-confined, launcher
  double byte gate + `trustRoot` pairing), and ONLY when the row configured
  `plane.confinedProvider`.
- `team_glob` — **LIVE on the current master line** (product freeze `d5de7497…`,
  #343): the row runs the real confined-rg walker, verdict **rc-first** on a
  trusted exit record, with the scratch law — plan/record files live in a
  sibling of the governance root (assembly default engaged by the compatibility
  fix at `097fccf9…`; an explicit empty or relative `scratchRoot` is a typed
  refusal, never a cwd fallback). The mount expression is
  `globDisabledShut ?? realGlob ?? shut` (`team-tool-plane.mjs:672`), so the
  typed refusal `IO_POLICY_UNSUPPORTED` still exists and means exactly one of:
  the realm config set `plane.globEnabled: false` (kill switch, PR #342 @
  `46e48218…` — explicit `false` routes to the shut landing with **no**
  fallback, renamed plane names do not recover the row, and a non-boolean
  `globEnabled` refuses the whole mount as a config defect), the row is
  unconfigured, or a scratch-law violation. Do not describe the row as "shut on
  master": that claim expired with #343. Mount evidence, kept separate from the
  module story: default-form install-face positive control **GREEN 32/32
  (+4 booked, 18 shape-N/A honestly excluded)** at `097fccf9`
  (`dev/agent-workflow/evidence/alpha5/a5ie-r5/`, run 23-39-12Z), kill-switch
  install-face acceptance in `dev/agent-workflow/evidence/alpha5/glob-off-install/`
  (7407 root-readable files), and the r5 full install battery 40/41 whose one
  red is the C1 wire-render law (host-side, registered as CORE_SEAM_BLOCKER #1 —
  not a glob defect). The module's own closed laws — **A7** (exactly one
  `sink.write`, positioned after the verdict; a refused walk writes **0**
  bytes) and **A8** (no string→`detail` echo; wording from the frozen
  `GLOB_REFUSAL_TEXT` table; `internalLog` default-OFF and never wired to
  io / result / observe) — carry the adversarial record of **6600 real-rg
  races** with zero exoteric-channel leaks
  (`dev/agent-workflow/evidence/alpha5/glob-backend/adversarial-counters.json`).
  The two historical failure rounds stay on record as CLOSED — the spill round
  (results before the verdict, measured **184/5100**, closed by A7 at
  `c0714492`) and the detail-echo round (7 source×sink cells, measured
  **351/3600**, closed by A8 at `ee9b30d5`) — and the archived GLUE-7 inline
  attempt's **name-class 3/10700** figure is a DIFFERENT subject (factory
  never entered production; its `runtime_base` `'/'` READ_DIR half was closed
  at `0e59140b`, PR #323). None of these may be re-reported as an open bug.
- Any class whose row is unconfigured keeps that same typed shut landing —
  the closed world invents no fallback. A shut landing is a LANDING, not
  evidence of a policy denial.
- The template lane denies **before** any backend runs (`28d31f2a`, G1): a
  denied effect call executes nothing and leaves zero side effects.

What that means for you: `IO_POLICY_UNSUPPORTED` from a member's `team_glob`
means the kill switch (`plane.globEnabled: false`), an unconfigured row, or a
scratch-law violation — and from `team_grep` / `team_bash` a missing backend;
in every case it is a **configuration fact, not a pending approval** — no
`team_resolve_control` answer unlocks it. Change the configuration, and report
the refusal verbatim instead of retrying it.

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
- Reading a definition-change cancellation as a guaranteed stop or a rollback: cancellation of
  unexecuted calls, an abort REQUEST for started calls, and the three-way outcome classification
  are different facts — see §8 (and do not read §8's guarantees into the G-g silent-subscription
  configuration or the D-1 deferred strict property).

## 8. Cancellation semantics when a tool definition changes or is withdrawn

User ruling 2026-10-16 17:52Z (PENDING-GATES G-a; recorded after the fact — it is NOT to be read
back into the 17:02 merge). As Leader you need exactly four facts to reason about an in-flight
delegation whose underlying tool definition drifts or is withdrawn:

1. **Trigger and affected set (exact scope).** A definition change/withdrawal for a governed
   `(scope, name)` cancels the *unexecuted* calls associated with THAT name and propagates an
   abort REQUEST to the *already-started* calls associated with the same name. Nothing else is
   touched: neighbouring tools keep executing (measured: only the drifted name is named —
   `RW-ISOLATION-NEIGHBOUR-TOOL`). A whole-generation MCP withdrawal + re-bind follows the same
   rule: in-flight unexecuted calls are cancelled, the name is withdrawn until re-bind
   (`RW-MCP-RESYNC-CANCELS-AND-REBIND-RESTORES`).

2. **Cancellation is not termination.** Unexecuted calls are cancelled at the dispatch door
   (canonical code `ABORTED_BEFORE_DISPATCH`). Calls whose Body has already started receive an
   abort REQUEST — if it lands, that is a TERMINATION (`ABORTED`, `terminated=1`;
   `RW-ABORT-INSIDE-BODY-IS-TERMINATION`), and the ruling does NOT promise immediate termination.
   On the pinned Host a caller-side cancellation raised while a Body is in flight is not visible
   at the result edge of a direct execute() call (measured without any lane); the implementation
   distinguishes the two canonical codes the Host does emit and does not claim a cancellation it
   cannot observe.

3. **No rollback.** Side effects of already-started calls are NEVER rolled back. Every affected
   call reports in the closed three-way outcome classification — **not executed** / **executed,
   possibly with side effects (original value preserved)** / **termination unconfirmed**
   (`EXECUTION_TERMINATION_UNCONFIRMED` stays its own class: never folded into "not executed"
   nor into "executed"). Treat an unconfirmed-termination result as an open question about the
   external world, not as a clean cancel.

4. **Plugin/provider unload is a different operation — three distinctions.**
   (a) Provider unload does NOT auto-kill the whole team — that is an explicit boundary of the
   ruling; team work continues under the remaining governed definitions.
   (b) Unload/teardown is ORDERED and ledger-clean: in-flight calls are drained via ordered
   teardown to `RELEASED` with an empty ledger (`RW-TEARDOWN-NO-LEAK`), not by mass abort.
   (c) When the change-notification channel cannot be subscribed at all (missing `on` / subscribe
   throws), assembly itself is refused pre-spawn with a typed refusal (`IO_POLICY_UNSUPPORTED`) —
   the system refuses to mount a weak configuration rather than pretending drift is inert.

Do not read these guarantees into the silent-subscription configuration (channel subscribed but
never delivering): that configuration's support-matrix position is NOT closed (gate G-g; alarm +
name-level withdrawal only, in-flight calls unaffected — `RW-CHANGE-INERT-LOUD`). And do not
claim the strict "cancel only un-executed calls" property: `NO-ABORT-AFTER-BODY-START` is
DEFERRED (gate D-1) — today an abort request IS propagated to started calls (see point 2), and
restoring the strict property requires a publicly trustworthy body-start check plus its own
regression legs first. This deferral is a project-internal registration only: no request has
been filed with the Host upstream or anyone outside this repo, and filing one is a separate
future action requiring explicit user authorization.

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
  pending approval appears, `team_list_pending_control` will not show it, and
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
