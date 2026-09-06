# E1 — D4-A2 Design: Agent/Tool-Originated Team Mutation → Live Client Invalidation

**Task**: E1 (Team D1-D6 repair v2, plan §14 — design-only follow-up item D4-A2)
**Mode**: READ-ONLY DESIGN. No product code, no tests, no remote methods, no implementation.
**Base**: `e72796c286a25f4b69579146c94f8d31b5130e93` (worktree `.worktrees/team-d1-d6-v2-E1`, branch `task/team-d1-d6-v2-E1`)
**Upstream reference**: `references/deepseek-harness-test-use` @ `76fda729799fe9b3848dbe2c211d4b231032b81e` (pristine; verified before and after this task — see `E1Result.md`)
**Model route**: `qiyuan-self/qwen3.8-27b` (verified — see `E1Result.md`)

Citation convention: repo-relative `path:line` for `dsh-agent-team`;
`upstream: path:line` for `references/deepseek-harness-test-use` at the pinned SHA.

---

## 1. GOAL & BOUNDARY

**Problem.** A *team_\* tool call executed by a Leader or member agent* mutates TeamDomain
durable state **out-of-band from the browser**: the model invokes `team_delegate` /
`team_create_member` / `team_follow_up` / `team_send_message` / `team_report_progress` /
`team_request_control` / `team_resolve_control` inside an agent turn; the tool executes on
the host and commits durable writes (member rows, session bindings, TeamLedger facts,
compatibility state) while the Team UI in the browser sits on a stale projection. Nothing
in the browser observed the mutation, so no client-side trigger fires. The UI stays stale
until the next *user* action that happens to pull (a D4-A1 UI callback, a session switch,
a connection rebaseline, or an F5).

**What "Agent/tool-originated mutation" means here (closed set).**
The ten model-facing tools built by `createTeamTools`
(`packages/tools/src/tools.ts:907-923`), of which seven are mutating and three are
read-only:

| Tool | Delegates to | Durable effect (projection-relevant?) |
|---|---|---|
| `team_list_members` | facade list (`packages/tools/src/tools.ts:909`) | none (read) |
| `team_list_templates` | catalog read (`:910`) | none (read) |
| `team_inspect_config` | facade inspect (`:911`) | none (read) |
| `team_create_member` | `performAction` CREATE_MEMBER (`:912`) | member row + binding + `provision-member-instance` fact → **yes** |
| `team_delegate` | `performAction` DELEGATE (`:913`) | `team-work-admitted` fact (+ member creation in continue form) → **yes** |
| `team_follow_up` | `performAction` FOLLOW_UP (`:914`) | `team-work-admitted` fact → **yes** |
| `team_send_message` | messaging `sendTeamMessage` (`:915`) | `team-message-delivered` fact → **yes** |
| `team_report_progress` | activity `recordProgress` (`:916`) | activity fact rows → **yes** |
| `team_request_control` | control `requestControl` (`:917`) | `control-request-recorded` fact → **yes** |
| `team_resolve_control` | control `resolveControl` (`:918`) | `control-decision-recorded` fact (+ later `control-allow-consumed`) → **yes** |

(The read-only three are listed for completeness; they commit nothing.)

**What D4-A1 already covers.** Every *existing* Team UI mutation callback (member
create/send/followup/archive/restore/dispose, governance reprobe/policy/override set+
reset, the standard two-stage create flow, `handoff.create` terminal states) now pulls the
projection exactly once on success through the existing generation-safe
`pullProjection` (`packages/client/src/plugin/team-mount-core.ts:605-614`; audit in
`dev/agent-workflow/evidence/team-d1-d6-repair-v2/B3/B3Result.md` §Audit). D4-A1's
explicit boundary (plan §1.4; B3Result §scope): **it does not claim coverage of
Agent/tool mutations**, which bypass every React callback.

**The exact gap (D4-A2).** Between two user actions, a mutation committed by an agent
tool (or by a host-side durable write such as a compatibility re-probe) is invisible to
the client: the browser projection keeps the stale frame; the Team Events/ledger section,
the member list, the governance lanes can all disagree with durable state until an
unrelated trigger fires. D4-A1's `pullProjection` is the right *reaction* machinery
(generation-safe, single-flight, already frozen); what is missing is a **trigger source
for mutations that have no browser-side callback**.

**In scope for this design**: the signal, its owner, the host→client wire, generation
semantics, reconnect/duplicate/out-of-order handling, compatibility/versioning, and the
focused test matrix (plan §14's six dimensions).
**Out of scope**: implementation (plan §14: "本计划只产出 design/evidence，不实现"),
any new remote method / contract version bump, any upstream change (CORE PATCH BUDGET = 0).

---

## 2. MUTATION SOURCE INVENTORY (current codebase @ e72796c)

Every entry point that can change projection-relevant durable TeamDomain state, with the
origin class (Leader-initiated / member-initiated / UI-initiated / host-internal) and the
durable write it commits. "Stamp-covered" = the write advances `team_sessions.generation`
today (see §5 for the two production stamp sites).

### 2.1 Model-driven tools (executed by an agent on the host)

All ten tools share ONE execution funnel: the tool definitions delegate to the runtime
satellites, and every work/lifecycle action goes through
`TeamRuntime.performAction` (`packages/runtime/action-router/router.ts:78-146`) —
"Every later Team tool (P6-T6) and the UI Remote (P8) expresses its action as a call
through `performAction` — there is no second admission path"
(`packages/runtime/action-router/router.ts:2-9`). Durable writes happen only in the
effect phase, under the per-team lock (`router.ts:37-38`, `router.ts:96-133`), via
`commitDurableFact` (`packages/runtime/action-router/effects.ts:802-822`:
`ledger.allocateSequence()` + `ledger.put(entry)`).

| Entry | Origin | Durable write(s) | Stamp-covered |
|---|---|---|---|
| `team_create_member` → `performAction` CREATE_MEMBER → ActivationProvider | **Leader** (members cannot create/delegate — invariant 37, `router.ts:26-31`) | member row, session binding, `provision-member-instance` fact (`packages/runtime/src/plugin/projection-source.ts:153` fact table; provisioning coordinator is the only producer) | yes (ledger hook A) |
| `team_delegate` / `team_follow_up` → `performAction` | **Leader** (creation form) / **member** (follow-up on own instance, SD-GUARD) | `team-work-admitted` fact (`packages/runtime/action-router/effects.ts:85`, `:388`; `work-execution.ts:93`, `:429`) | yes |
| lifecycle effects (archive/restore/dispose forms reach here via member commands) | Leader / UI | `member-lifecycle-changed` fact (`effects.ts:86`, `:514`, `:553`; `work-execution.ts:94`, `:616`, `:639`) | yes |
| `team_send_message` → messaging coordinator | any admitted sender (leader or member; guard-checked) | `team-message-delivered` fact via `ledger.allocateSequence()`/`put` (`packages/runtime/messaging/coordinator.ts:299-301`, `:431`, `:447`) | yes |
| `team_report_progress` → activity ledger | the reporting **member** | activity fact rows via `ledger.allocateSequence()`/`put` (`packages/runtime/activity/ledger.ts:29-30`, `:348`, `:368`) | yes |
| `team_request_control` / `team_resolve_control` → control service | any member (request) / resolver role (resolve) | `control-request-recorded`, `control-decision-recorded`, `control-allow-consumed` facts (produced by the runtime/control service per the closed fact table, `packages/runtime/src/plugin/projection-source.ts:153-155`) | yes |
| compatibility gate inside `performAction` (new-work admissions re-probe inline, `router.ts:96-132`) | host-internal (during any Leader/member new-work action) | durable compatibility-state replace + hook B stamp (`packages/runtime/compatibility/probe.ts:250`) | yes (hook B) |

Note: the *operation journal* store (`packages/storage/operations/journal.ts`,
`repositories/operations.ts`) is the **idempotency** store (re-put with strictly higher
`generation` per `operations.ts:47`, `:82-86`), not a mutation-observation point — it
records provisioning intents and is not a signal owner (see §3).

### 2.2 UI-driven remote methods (executed by the browser via `/team-remote`)

Dispatch switch: `packages/runtime/src/plugin/s6-remote.ts:2206-2513`.

| Method (dispatch line) | Durable write | Stamp-covered |
|---|---|---|
| `member.create`/`send`/`followup`/`archive`/`restore`/`dispose` (`s6-remote.ts:2322-2398` → `ports.admission.performAction`, `:2339`, `:2383`) | same effect facts as 2.1 | yes |
| `policyState.set` (`:2457`) | `policy-state-transitioned` ledger fact via the durable mutation lane (`packages/runtime/src/plugin/durable-mutation-store.ts:94`, `:198-199`) | yes |
| `compatibility.ack` (`:2480`) / `compatibility.reprobe` (`:2493`) | compatibility-state replace at generation+1 + hook B (`packages/runtime/compatibility/probe.ts:250`) | yes |
| `team.create` (`:2206`), `team.admitInitialWork` (`:2232`), `handoff.create` (`:2513`) | fresh team row (generation 1) + admitted-work facts (`root-initial-work.ts:495`, `:515`, `:523`) | yes (facts) / n/a (new row) |
| **`override.set`** (`:2414` → handler `:1892-1899`) / **`override.reset`** (`:2430`) | `overrides` repository put only (`packages/runtime/src/plugin/root.ts:1304-1305` — `repos.overrides.put(record)`) — **NO ledger fact, NO stamp advance** | **NO — the gap** |
| `team.getProjection` (`:2278`), `team.getLedgerPage` (`:2288`), `team.listRoots` (`:2249` → `root.ts:1564-1565`, read-only `buildTeamRootOwnershipIndex`), `catalog.*`, `intent.probe`, `compatibility.get`, `policyState.get`, `override.get`, `legacy.*`, `handoff.prepare` | none (reads; `intent.probe` may re-probe → hook B) | n/a |
| `team.ensureRootLive` (`:2261` → `root.ts:1553-1556` `live.ensureLiveAgent`) | agent resume only — **no TeamDomain write** | n/a (no projection change) |

### 2.3 Host-internal durable writes (no browser origin at all)

- Compatibility re-probes from the new-work admission gate (2.1) — already stamp-covered.
- Boot-time world seeding (`root.ts:1618+` `seedBootWorld`) — fixture-mode only, pre-UI;
  the first client pull is a cold fill (applied identity `null` → `apply`), so seeding is
  not a staleness case.
- Fork/reconciliation legacy surfaces (`packages/storage/bindings/`) — legacy handoff
  world, out of vNext runtime scope.

**Inventory conclusion.** There is exactly ONE projection-relevant durable write lane that
does not advance the generation today: **`override.set` / `override.reset`** (§5 details
why this matters even for the UI-pull path). Everything else the model or host can write
already advances the stamp. Therefore the D4-A2 design needs (a) a host-side one-lane
stamp fix (Team-owned, no contract change) and (b) a client-side trigger for the
agent-turn cases — no new durable lane, no new store, no new fact vocabulary.

---

## 3. SIGNAL OWNER

**Candidates evaluated** (per plan §14 "mutation signal owner"):

1. **The action router, after each effect settles** (`router.ts:135-145` return point).
   Complete for the `performAction` lane (tools 2.1 + remote `member.*`) but misses the
   satellite lanes that bypass the router: `team_report_progress` (activity ledger),
   `team_send_message` (messaging coordinator), `team_request_control` /
   `team_resolve_control` (control service), and every remote-only mutation
   (`override.*`, `policyState.set`, `compatibility.*`). Wiring an observer here means
   4+ additional per-satellite wrap points — duplicated signal emission, exactly what the
   ownership rule forbids.
2. **The live glue, after each team tool execution** (`packages/runtime/src/plugin/live/agent-bindings.mjs`
   — tools are filled into `teamToolsRef` at `packages/runtime/src/plugin/root.ts:1590-1597`
   and registered in the agent setup). Covers only the model-driven ten tools; misses the
   UI remote lane and host-internal re-probes. Also: wrapping at the glue splits the
   signal decision into two owners (glue for tools, ??? for remote).
3. **The operation journal observer** (`packages/storage/operations/journal.ts`). The
   `team_operation` store is the idempotency ledger (re-put discipline,
   `repositories/operations.ts:47`, `:82-86`), populated only for provisioning intents —
   not every mutation writes an operation row, so it cannot serve as a complete
   observer. Rejected.
4. **The generation-stamp write itself** — the two (soon three) production
   `advanceGeneration` sites. **Chosen.**

**Ownership rule (frozen by this design).**
The invalidation signal **IS** the `team_sessions.generation` stamp advance, and its
single owner is the **TeamDomain storage write chain** — specifically the
`teamSessions.advanceGeneration` repository method
(`packages/storage/repositories/team-sessions.ts:119-142`), invoked *by the durable write
itself*, after the write is durable (never stamp-first):

- **Hook A** — every TeamLedger fact `put` advances the stamp by exactly one
  (`packages/storage/repositories/ledger.ts:130` doc, `:158-167` pre-read/never-stamp-
  first, `:182` call).
- **Hook B** — every durable compatibility-state replace advances the stamp by exactly
  one (`packages/runtime/compatibility/probe.ts:250`).
- **Hook C (new, required by this design)** — every durable `overrides` put/reset
  advances the stamp by exactly one (wire-up in the production root,
  `packages/runtime/src/plugin/root.ts:1290-1305` `admitGovernanceOverride` durable
  resolver; the call site is the `put` closure at `root.ts:1305`). This is a
  **Team-repo host-side change**: no upstream, no remote contract, no new store/field.

Why this owner is the right one:

- **Completeness.** §2 proves every projection-relevant durable write funnels through a
  TeamLedger fact, a compatibility replace, or an override put. Three hooks, one
  repository method, no per-caller observers.
- **One owner, no duplicated signals.** No component outside the storage write chain may
  emit an invalidation signal. The client-side triggers (D4-A1 pulls, the §4 wire
  trigger, the rebaseline) are *consumers* of the stamp, not emitters: each one simply
  re-pulls, and the frozen verdict engine decides whether the response may apply. Two
  triggers racing for the same team coalesce into one in-flight pull
  (`packages/client/src/plugin/team-mount-core.ts:487-502` single-flight), so
  duplication is structurally impossible at the store level.
- **Crash-safe by construction.** The stamp is a durable fact, not an in-memory event: a
  crash between "fact durable" and "stamp advanced" leaves a documented at-most-one-lag
  (`packages/storage/repositories/ledger.ts:17-28`, adjudicated R60), which the pull
  verdicts absorb (`duplicate` → state untouched → next trigger catches up, §6c). An
  in-memory event bus would lose signals on crash with no recovery path; the stamp has
  one.
- **No new wire needed on the host side.** The host already *is* the signal; only the
  client needs to learn *when to look* (§4).

**Explicitly NOT an owner**: the action router, the live glue, the operation journal, and
any future "Team event emitter" host service — they may *read* the stamp (e.g. to answer
`team.getProjection`), never *emit* invalidation.

---

## 4. WIRE (host/runtime → remote/client invalidation)

Evaluated **against the public surface only**. The Team client today sits on five public
seams (`packages/client/src/plugin/team-mount-core.ts:283-296`): `slots`, `locale`,
`sessions` (Seam 3), `connection` (Seam 5), `remote` (Seam 6) + `ctx.effect`. Seam 5 is
the unary-only connection carrier: `TeamRpcCarrier.call` with the doc
"the optional `open` stream face is absent in the served web app (Seam 5)"
(`packages/client/src/transport/host-seams.ts:58-79`, `:31-34` — "No browser-side stream
subscription exists on this channel ... so projection sync is invalidation + pull
(frozen backend guarantee; plan Trap B response)"). Upstream confirms:
`ClientConnectionRpc.open` is an **optional** facet — "Browser transports omit this
method; API Gateway owns their WebSocket mux"
(`upstream: packages/client/connection/src/rpc.ts:225-238`; the web app builds the RPC
without a worker-local stream carrier, `upstream: packages/client/connection/src/client/index.ts:78-86`).

### (a) Client already-pulling generation model — no new wire

Trigger points exist today: D4-A1 post-mutation pulls
(`team-mount-core.ts:605-614`), the mount cold fill (`ensureProjection`,
`:487-502`), the connection-generation rebaseline (`:704-727`), and the store's
reconnect retry (`packages/client/src/state/team-projection-store.ts:19-34`).
**Verdict: insufficient alone.** The staleness window for an agent-tool mutation is
*unbounded* (until the next user action in the team's UI). This is the status quo D4-A1
left in place deliberately; (a) is the *backstop*, not the fix.

### (b) Client-poll trigger channel ("any changes since generation N?")

Would require a NEW remote method (e.g. `team.changedSince`) — a remote contract version
bump (v4), plus a recurring timer in the client = **new polling**. Plan §14 stance:
"本计划禁止新增隐式 push/event/polling" (plan line 435). **Rejected** — it is the worst
option on every axis (new contract, new wire semantics, timer lifecycle, and the
answer is a byte-string of "yes/no" for which a pull immediately follows, i.e. two
round trips where one suffices).

### (c) EXISTING host→client event stream in upstream, consumable publicly — INVESTIGATED

Investigation of `references/deepseek-harness-test-use` @ `76fda729` (pristine) found
**three** cross-plane channels, and ONE of them is a working public host→client event
stream usable by a client plugin **without any upstream change**:

**(c1) Forwarded Host events via `ctx.remote.$on` — EXISTS, PUBLIC, NO CHANGE NEEDED.**

- The client context of EVERY client plugin (built-in or external — one root `Context`,
  `upstream: packages/client/web/src/boot.ts:77`) carries the `remote` service
  (`ClientRemote`), declared on the Cordis `Context` itself:
  `upstream: packages/api/gateway/src/client/index.ts:125-130`
  (`declare module '@deepseek-ai/cordis' { interface Context { remote: ClientRemote } }`),
  service installed at `:143-161` (`super(ctx, 'remote')`).
- `ClientRemote.$on(event, listener)` is a public method
  (`upstream: packages/api/gateway/src/client/index.ts:211-216`): it subscribes the
  calling plugin's fiber to one forwarded event and returns a disposer
  (`upstream: packages/api/gateway/src/client/remote-events.ts:87-97` — listener
  registered on the caller's ctx under a private key; fiber disposal removes it).
- Delivery is a live WebSocket-carried stream: the Host `api-remotes` assembly registers
  the **sole** forwarded-event source
  (`upstream: packages/api/remotes/src/index.ts:37-42` →
  `ctx.typertGateway.registerRemoteEvents(...)`; the gateway enforces the single
  source, `upstream: packages/api/gateway/src/index.ts:242-244` — a second
  `registerRemoteEvents` throws), queues allowlisted host events
  (`upstream: packages/api/remotes/src/index.ts:48-73`), broadcasts them over the
  internal `$events` stream on the `/api/remote.mux` WebSocket
  (`upstream: packages/api/gateway/src/stream-protocol.ts:9`, `:6`), and the client owner
  re-opens the stream **per connection generation** and dispatches to subscribers
  (`upstream: packages/api/gateway/src/client/remote-events.ts:77`
  `connection.registerGenerationSource(this.runGeneration)`; delivery `:106-119`).
  Reconnect handling is built in.
- The legal event key set is the static allowlist
  `API_REMOTE_FORWARDED_EVENTS` — "both the Host dispatch strategy and the legal key set
  of `ctx.remote.$on`" (`upstream: packages/api/remotes/src/remote-events.ts:12-35`,
  18 entries). **A plugin cannot add its own event name** (single-source throw + the
  array is consumed only inside `api-remotes`) — a plugin-owned `team/*` forwarded event
  would require an upstream edit = `CORE_SEAM_BLOCKER` shape. (Documented for the record;
  NOT the recommended path.)
- **The Team-relevant allowlisted event: `api-session/status`**
  (`upstream: packages/api/remotes/src/remote-events.ts:23`). It is emitted by the
  session controller on every agent status transition:
  `ctx.on('agent/status', ({ agent, status }) => ctx.emit('api-session/status', agent.id, status === 'running'))`
  (`upstream: packages/api/session-controller/src/index.ts:151-152`; event signature
  `(sessionId: SessionId, updatedAt-ish: boolean)` at `:542`
  — `api-session/activity(sessionId, updatedAt)` at `:542`; the status event carries
  `(agentId, running: boolean)`). Agents are keyed by session id
  (`upstream: packages/api/session-controller/src/agent.ts:39-40` —
  `this.ctx.agents.get(sessionId)`, per A3Result Q1(1)), so `agent.id` IS the session id.
  It is already forwarded to every browser client today (the built-in session list uses
  the same `$on` seam, `upstream: packages/api/session-controller/src/client/index.ts:92-100`).

  **Why `api-session/status` is a sufficient trigger for D4-A2 scope.** Every
  agent-tool mutation (2.1) happens *inside an agent turn* of the root or a member
  session; a turn begins (`running: true`) and ends (`running: false`) with a status
  transition on that session. A client that maps "session id → owning team" and re-pulls
  on **any** status transition of a team-owned session observes, at latest at the end of
  the mutating turn, a trigger that covers every mutation committed during the turn.
  The staleness bound becomes **≤ the remaining duration of the mutating agent turn**
  (instead of unbounded). Per-mutation push is NOT achievable through the allowlist
  (there is no per-tool-call event in it — the raw `session/event` stream is
  host-internal, `upstream: packages/api/session-controller/src/index.ts:157-169` only
  derives the allowlisted events); that is an accepted, documented bound for this design
  (open question Q1, §9).

**(c2) Plugin-owned stream method on its own remote namespace** —
`TypertRemoteService` + `@Remote({mode:'stream'})`
(`upstream: packages/typert/protocol/src/index.ts:101-105`, `:155-203`); the gateway
claims endpoints of any host service carrying a `typertRemote` binding
(`upstream: packages/api/gateway/src/index.ts:266-273`, `:275-290`); the typert loader
auto-registers the `./typert` artifact of loader-entry packages
(`upstream: packages/typert/loader/src/index.ts:1-12`, `:383`); the client opens it via
`ctx.remote.$mount(...)` + the generated namespace
(`upstream: packages/api/gateway/src/client/index.ts:201-209`, `:457-473`). This WOULD
give per-mutation push with no upstream change, **but**: it is a *new push surface* for
the Team plan (a host→client stream the plan itself creates — the §14 stance prohibits
"新增隐式 push" in this plan), it requires the plugin package to emit typert generated
artifacts (a build-tooling step this design cannot verify at design time), and its
in-repo precedent is the experimental `agent-team` prototype
(`upstream: packages/experimental/agent-team/src/index.ts:59`, `:242-267`;
`upstream: packages/experimental/client-ui-agent-team/src/client/mount.ts:84-101`) —
pattern evidence only, private prototypes excluded from releases. **Recorded as the
future alternative** if Q1 resolves against turn-boundary latency; NOT the
recommendation.

**(c3) `session/follow` per team session** — callable by any plugin client
(`upstream: packages/api/session-controller/lib/typert.remote-client.d.ts:20`;
`ctx.remote.session` is a first-class client-ctx service
`upstream: packages/api/gateway/src/client/index.ts:532-549`, `:659-661`), delivers the
full transcript **including `tool/call` / `tool/result` / `turn/*`**
(`upstream: packages/core/session/src/types.ts:268-320`). Per-tool-call granularity, but
it means following N session streams (root + every member) and pattern-matching
transcript frames to *derive* an invalidation whose effect is still just "re-pull" —
more bytes, more state, more failure surface than (c1), for a trigger the frozen
"invalidation + pull" model
(`packages/client/src/transport/host-seams.ts:31-34`) already anticipates in cheaper
form. **Recorded as rejected**; a hybrid (follow only when a turn-boundary proves
insufficient in one session) is Q1's escalation path.

### (d) NEW remote subscription/push method (contract v4)

Cost: a new catalog entry + params + handler (the closed 26-method catalog
`packages/remote/src/contracts/catalog.ts:66-100` is versioned — a 27th method is a
contract v4 bump, `catalog.ts:57-64`), a client-side subscription lifecycle, and a host
side that would have to *store and deliver* a per-client subscription — i.e. the plan
would own a push channel end-to-end. **Plan v2 stance (plan §14, line 435): new implicit
push/event/polling is prohibited in this plan.** This design therefore does NOT
recommend (d); had (a)-(c) all been impossible, this document would have said so
explicitly and recorded (d) as the future task requiring user approval. That case does
not arise: (c1) is buildable on the public surface today.

### RECOMMENDATION (exactly one)

> **Option (c1): consume the existing, already-forwarded `api-session/status` event
> through the public `ctx.remote.$on` seam as the D4-A2 trigger, feeding the EXISTING
> generation-gated single-flight `pullProjection`. No new wire, no new remote method,
> no new contract version, no polling, no upstream change, no new host push.**

Public-seam citations proving buildability without upstream changes:
client subscription `upstream: packages/api/gateway/src/client/index.ts:211-216` +
`:125-130` (Context declaration); event delivery & per-generation reopen
`upstream: packages/api/gateway/src/client/remote-events.ts:77`, `:87-97`, `:106-119`;
event emission & allowlist `upstream: packages/api/session-controller/src/index.ts:151-152`,
`upstream: packages/api/remotes/src/remote-events.ts:23`; host-side registration already
happens in the stock web composition (`upstream: packages/api/remotes/src/index.ts:37-42`)
— nothing the Team plan adds on the host except the §5 Hook C stamp call.

**Shape of the (client-side, future-task) change** — named for implementability:

1. Extend the Seam 6 structural mirror `TeamRemote`
   (`packages/client/src/plugin/team-mount-core.ts:244-257`) with a `$on` face:
   `$on(event: 'api-session/status', listener: (sessionId: string, running: boolean) => void): () => void`
   (structural mirror of the public `ClientRemote.$on`, house style of the five existing
   mirrors; `remote` is already in the plugin `inject` list, `:326`).
2. In `applyTeamMount`, add one `ctx.effect` ("dsh-agent-team: agent-activity
   invalidation trigger") that (i) subscribes via the new face; (ii) maintains a
   `Map<sessionId, teamSessionId>` reverse index fed by the applied projection frames —
   key = the team's root session id (the Leader agent's session, invariant 14: the
   Leader IS the Root session) + every member's `childSessionId`
   (the projection member rows carry `childSessionId` for every non-leader member,
   `packages/contracts/src/projection/member.ts:120`, `:214-228`, `:270`); (iii) on a
   status event for an indexed session, calls the existing
   `pullProjection(teamSessionId)` (`:613-614`); (iv) dedupes by VALUE (same
   `running` as last seen for that session → no pull); (v) disposes the subscription on
   fiber stop (the returned disposer, tracked like every other effect).
3. Host side: Hook C only (§5.3). Nothing else.

**Staleness bound (frozen statement).** For an agent-tool mutation: the client applies
a frame covering it within one `pullProjection` round trip after the *next*
`api-session/status` transition of the mutating session — at latest the end of the
mutating agent turn. Backstops unchanged and still effective: D4-A1 UI pulls, the
connection-generation rebaseline (`:704-727`), mount cold fill (`:487-502`), and the
store's reconnect retry (`team-projection-store.ts:19-34`). For UI-initiated mutations
the bound stays "immediately after the RPC success" (D4-A1, now with the frame
guaranteed applicable once Hook C lands — §5.4).

**No-CONTRACT_CHANGE_REQUEST / no-CORE_SEAM_BLOCKER statement.** (c1) needs no upstream
change and no remote contract change. The two shapes that WOULD be blockers are
documented and rejected: a plugin-owned forwarded event name (requires an
`API_REMOTE_FORWARDED_EVENTS` edit upstream — `CORE_SEAM_BLOCKER` shape if ever needed)
and any new remote method (contract v4 — `CONTRACT_CHANGE_REQUEST` shape, plan §14
prohibition).

---

## 5. GENERATION ADVANCEMENT SEMANTICS

### 5.1 The generation fact (where it lives)

- **Durable source of truth**: `team_sessions.generation` — the TeamSession record
  field, "Record version/generation counter (starts at 1, monotonically increases)"
  (`packages/contracts/src/dto/team-session-record.ts:77-78`); advanced ONLY through
  `TeamSessionsRepository.advanceGeneration(rootSessionId)`
  (`packages/storage/repositories/team-sessions.ts:119-142` — one atomic `update` on the
  domain write chain; two advances serialize, monotonic; missing row fails LOUD with
  the seam `missing-key` code, `:111-115`).
- **Whole-projection stamp**: the projection service carries the row's stamp verbatim as
  `TeamProjection.generation` — "the whole-projection monotonic generation (>= 1,
  DevPlan §21.4)" (`packages/contracts/src/projection/projection.ts:117-118`); the
  production read port copies `generation: row.generation`
  (`packages/runtime/src/plugin/projection-source.ts:361`).
- **Wire**: `team.getProjection` returns the frame + provenance; the client cross-checks
  data generation vs `provenance.projectionGeneration` before any verdict
  (`packages/remote/src/push/pull.ts:86-92`).
- **Client-side guard (frozen)**: `isStaleTeamProjection` —
  `incoming.generation <= current.generation` is stale
  (`packages/contracts/src/projection/projection.ts:435-453`); the push mirror
  `decideFrameVerdict`: first frame → `apply`, foreign team → `foreign`, strictly
  greater → `apply`, equal → `duplicate`, lower → `stale`
  (`packages/remote/src/push/generation.ts:38-80`, `:46-54`); the store writes ONLY on
  `apply` (`packages/client/src/state/team-projection-store.ts:4-11`).

### 5.2 When generation advances (the completed invariant)

**Invariant (frozen by this design).** Every projection-relevant durable write to a
team's TeamDomain advances `team_sessions.generation` by exactly one, durably, AFTER the
write is durable (state-durable-before-stamp by construction; stamp-first is never used,
`packages/storage/repositories/ledger.ts:17-28`).

Coverage at e72796c and the fix:

| Lane | Advances today? | Mechanism |
|---|---|---|
| Every TeamLedger fact write (work-admitted, lifecycle, coordination, provision, activity, message, control, policy-transition facts) | yes | Hook A — `ledger.put` chain calls `teamSessions.advanceGeneration` after the entry write is durable (`packages/storage/repositories/ledger.ts:130`, `:158-167`, `:182`) |
| Compatibility-state durable replace (reprobe, ack) | yes | Hook B — `probe.ts:250` `advanceGeneration` per durable write |
| `overrides` put/reset (override.set / override.reset) | **NO** | **Hook C (new)** — see 5.3 |
| Fresh team row (create/handoff) | n/a | row seeded at generation 1 (`team-session-record.ts:157-171`); first client pull is a cold `apply` |

### 5.3 Hook C — the override stamp fix (required host-side change, Team-owned)

**The gap, precisely.** `override.set` / `override.reset` durably write the `overrides`
repository through the production root's admission resolver
(`packages/runtime/src/plugin/root.ts:1304-1305`, `put: (record) => repos.overrides.put(record)`;
remote dispatch `s6-remote.ts:2414`, `:1892-1899`), and the `overrides` rows are
**projection content**: the production `effectiveConfig` resolver folds
`repos.overrides.list(rootSessionId)` into every member's effective-config lane
(`root.ts:1406-1420`, overrides at `:1420`). Since no ledger fact is written, the stamp
does not advance — and under the frozen client guard, a response at the EQUAL generation
is a `duplicate` and is never applied (`packages/remote/src/push/generation.ts:76-78`).

**Consequence at e72796c (named, for the record).** D4-A1's post-`override.set` pull
(`team-mount-core.ts:605-614` fires it) receives a frame with the SAME generation and
the store keeps the old frame — the UI's autonomy/override lanes can stay stale even for
the UI's own mutation. B3's audit marked the lane "already covered" because the pull
*fires*; the frame *applying* was outside B3's assertion surface. Hook C closes this.

**The change (design, not implementation).** In the production root's durable
`overrides` resolver (`root.ts:1290-1305`), after a **successful, state-changing**
`repos.overrides.put`/reset commit, call
`await repos.teamSessions.advanceGeneration(rootSessionId)` — the same lag-tolerant,
durable-before-stamp discipline as Hooks A/B, on the same team-chain lock the mutation
already holds (the A23 admission runs under the team's coordinator chain, per the P8-S5B
CR-8 wiring, `packages/runtime/action-router/router.ts:71-75`). Idempotency rule: a
re-put of byte-identical content must NOT double-advance (compare serialized current
row before/after, or skip when the admission returned "unchanged" — the admission
service's own no-op path; pinned by test T1). Failure rule: if the stamp advance fails
after a successful override write, fail the mutation typed (do not silently return
success with a stale stamp) — the loud-failure precedent is `advanceGeneration`'s own
doc (`team-sessions.ts:111-115`).

No new store, no new field, no new fact type, no contract change.

### 5.4 How the client compares

Strictly-greater test, everywhere, always: a frame is applied IFF
`incoming.generation > applied.generation` (same team) —
`isStrictlyNewerGeneration` (`packages/remote/src/push/generation.ts:46-54`), lifted onto
the response by `assessProjectionSync` (`packages/remote/src/push/pull.ts:107-124`).
The client never compares wall clocks, never trusts the trigger to carry a generation,
and never "forces" an apply: a trigger's only job is to cause a pull; the stamp decides.

### 5.5 Interaction with the D1 `listRoots` wire

The v3 root rows **already carry** `generation`: `TeamRootOwnershipRow` has
"`generation` — The TeamSession record generation (starts at 1)"
(`packages/runtime/src/team-ownership-index.ts:145-157`), and the wire row builder
copies it (`:353-358`, `:332`). `team.listRoots` is read-only and is NOT part of the
invalidation trigger (the trigger is the §4 wire); the row's `generation` is simply the
same durable fact a client could compare if it chose to poll `listRoots` (it does not —
plan §14 prohibits new polling). **No future contract change is needed** for generation
visibility on the root rows; nothing in this design adds a field to `listRoots`.

---

## 6. RECONNECT / DUPLICATE / OUT-OF-ORDER

All three are properties of the frozen pull/verdict machinery, not of the trigger.
The §4 trigger is just another pull initiator, so it inherits them; the design freezes
the expected behavior per case.

### 6a. Invalidation signals lost to a disconnect → full re-pull on reconnect, generation-gated

Two layers already do this; the design keeps both as-is:

1. **Trigger-layer loss is harmless.** If the `api-session/status` event is dropped
   while the WebSocket is down, the client loses only a *nudge* — never state. The
   event stream itself re-opens per connection generation on the client
   (`upstream: packages/api/gateway/src/client/remote-events.ts:77`, `:106-112`
   — the subscription pump re-runs on every generation), so no subscription state is
   lost across reconnects; missed events in the gap are not replayed (and do not need
   to be — see 2).
2. **State-layer recovery is the existing rebaseline.** The mount's
   connection-generation effect marks every team store lost/restored on the carrier
   going down/coming up, and `markConnectionRestored` fires the invalidation pull
   (`packages/client/src/plugin/team-mount-core.ts:704-727`; store reconnect policy
   `packages/client/src/state/team-projection-store.ts:19-34` — "a transport loss or a
   rejected pull enters `reconnecting` and schedules ONE retry ...
   `markConnectionRestored` fires the invalidation pull"). The re-pulled frame is
   applied only if strictly newer (5.4) — a full re-pull on reconnect is
   generation-gated by construction: if nothing changed, the verdict is `duplicate` and
   the applied frame is untouched.

**Frozen behavior.** After any channel loss, every team with an open store issues ≤ 1
rebaseline pull; a trigger event arriving during `reconnecting` adds no extra pull
(single-flight, 6b); the trigger subscription auto-resumes with the new connection
generation (upstream pump) and needs no client re-subscribe — the mount's single
`$on` registration (whose disposer is fiber-scoped) survives because the *service*
re-pumps, not the listener.

### 6b. Duplicate signals → idempotent single-flight pull (existing machinery)

- Mount level: `ensureProjection`/`pullProjection` coalesce concurrent pulls per team on
  the `inflightPulls` map — "single-flight cold read"
  (`packages/client/src/plugin/team-mount-core.ts:487-502`).
- Store level: a second in-flight pull for the same team is queued by the store's
  transport action; the verdict engine then classifies each response: a repeated frame
  at the applied generation is `duplicate` — "a frame is applied IFF it is strictly
  newer, so a delayed / duplicated / out-of-order response can never overwrite a newer
  state" (`packages/remote/src/push/generation.ts:21-23`; store hard invariant
  `packages/client/src/state/team-projection-store.ts:4-11`).
- Trigger level (new, §4 shape step 2(iv)): value-dedupe — a status event whose
  `running` equals the last seen value for that session issues no pull. A burst of
  true→false→true transitions still yields at most one in-flight pull per generation
  change.

**Frozen behavior.** N duplicate/rapid triggers for one team ⇒ exactly 1 in-flight
`team.getProjection` at a time; zero state writes from `duplicate`/`stale`/`foreign`
frames; `lastError` only from typed RPC errors (never from verdicts).

### 6c. Out-of-order → generation monotonicity; only advance on strictly greater; ignore stale

- A late response at generation G arriving after G+1 was applied is `stale`
  (`packages/remote/src/push/generation.ts:79` — "incoming.generation <
  applied.generation → stale") and is dropped with the state untouched.
- **The S1-A one-lag window (accepted residual, cited):** the stamp advances after the
  fact is durable, inside the same write chain; a pull racing that window reads
  fact-durable + stamp-one-behind. The frozen rule: "a re-pull at the equal stamp
  returns `duplicate` and the state is untouched; the stamp catches up at the next
  mutation" (`packages/storage/repositories/ledger.ts:24-28`; adjudicated R60,
  exercised by `packages/runtime/test/g8s1-generation-stamp.test.ts:19-25`). With the
  §4 trigger, the "next" nudge arrives at the next status transition (≤ next turn
  boundary), so a lagged mutation converges within one more turn. This is a documented,
  gate-adjudicated property of the storage layer — the design **does not** attempt to
  close it (closing it would require stamp-first ordering, which is explicitly
  forbidden, `ledger.ts:26`).
- Multi-tab: each browser tab runs its own mount/stores; tab A applying G+1 does not
  affect tab B's verdict (per-client applied identity); both tabs converge on the next
  pull of each. No cross-tab coordination is added.

---

## 7. COMPATIBILITY / VERSIONING

### 7.1 Client versions without the new trigger vs old clients

- **Old client bundle (no `$on` subscription) + fixed host (Hook C):** behaves EXACTLY
  as today — D4-A1 pulls, rebaseline, cold fill. The only observable difference: the
  generation now advances on override writes too; old clients only ever *compare*
  generations (strictly-greater accept), so a higher generation can only make a frame
  more applicable, never less. No breakage path.
- **New client bundle + old host (no Hook C):** the subscription works (the event is
  stock upstream); override mutations still lag one pull (pre-fix behavior) — graceful
  degradation to today's semantics; no error lane involved.
- **New client + deployments without the allowlisted event** (a hypothetical
  composition without the `api-remotes` assembly): `$on` simply never fires → the mount
  degrades to exactly today's trigger set. The subscription must be fail-soft: if the
  `remote.$on` face is absent (older upstream / different bundle), the effect is a
  documented no-op (house precedent: the `legacyInspect` face is omitted when
  unbindable, `packages/client/src/plugin/client.ts:38-40`).

### 7.2 Remote contract versioning impact

**None.** (c1) reuses `team.getProjection` (and nothing else); the closed 26-method
catalog (`packages/remote/src/contracts/catalog.ts:66-100`) is unchanged; no v4. The
Host side changes nothing on the wire (it already forwards `api-session/status` to all
clients). Named for the record: the rejected option (d) would have been
`REMOTE_CONTRACT_VERSION = 4`; option (c2) would need no contract bump but IS a new push
surface (plan §14 prohibition — future task only, with user approval).

### 7.3 Rollout order (future implementation task)

1. **Hook C (host, storage-facing, in `packages/runtime` root wiring + a focused
   storage/runtime test).** Independent, safe, backward-compatible by 7.1. Deployable
   alone; immediately fixes the override-pull no-op for existing clients.
2. **Client trigger (mount `$on` face + effect + tests).** Additive, fail-soft by 7.1;
   deployable alone; closes the agent-mutation staleness bound when both halves are
   present.
3. No ordering dependency between 1 and 2; no upstream deployment; no contract
   negotiation; no client/host minimum-version coupling beyond "new client works with
   any host ≥ e72796c semantics."

---

## 8. FOCUSED TEST MATRIX (acceptance spec for the future implementation task)

Layer key: **S** = storage repo, **H** = host glue/plugin root (runtime package,
in-process), **R** = remote handler (s6-remote over the production root), **C** =
client store (pure), **M** = client mount (seam-mocked), **U** = upstream
characterization on the test-use instance (`:3180`, per TEST_METHODS.md).

| # | Test (name) | Layer | Pins |
|---|---|---|---|
| T1 | `override-stamp-advance.test.ts` — "override.set advances team_sessions.generation by exactly one, durably, after the put" | S/H | Hook C core: pre-read gen G, `override.set`, post-read G+1; the override row is durable before the stamp (re-read after simulated crash-at-stamp keeps the override row — lag model, `ledger.ts:17-28` precedent) |
| T2 | same file — "override.set re-put of byte-identical content advances NOTHING" | S/H | Idempotency rule 5.3: no double-advance; zero new seam writes on the no-op path |
| T3 | same file — "override.set for a missing root fails loud (SEAM_FAILURE, seam missing-key code) and advances nothing" | S/H | Loud-failure rule 5.3 (`team-sessions.ts:111-115` precedent); typed failure surfaces to `override.set` as the frozen typed error, NOT success |
| T4 | `g8s1-style-stamp-walk` (extend `packages/runtime/test/g8s1-generation-stamp.test.ts` pattern) — "delegate ×3 → 1→2→3→4 in lockstep; replay → replayed:true, stamp unchanged; override.set between delegates → +1; compatibility.ack → +1" | R/H | The completed invariant (5.2) end-to-end: every projection-relevant write, exactly one advance, monotonic, idempotent replay no-op |
| T5 | `remote-projection-after-override.test.ts` (R) — "override.set success response, then team.getProjection: frame.generation > pre-mutation frame.generation, effectiveConfig lane reflects the override, provenance.projectionGeneration == frame.generation" | R | Closes the B3-visible gap (5.3 consequence): the D4-A1 pull after override.set now VERDICTS `apply`, not `duplicate` |
| T6 | `api-session-status-on-member-turn.test.ts` — "member agent turn start/end emits api-session/status(memberChildSessionId, true/false); leader turn emits api-session/status(rootSessionId, ...)" | U (characterize, then H regression) | **Pins the upstream behavior the whole trigger depends on** (subagent §3/§4: agents keyed by session id; member agents are live agents in the registry). MUST pass on the pinned test-use SHA before the client wiring is accepted; if member-agent status events do NOT fire (subagent ambiguity), the design's trigger set shrinks to the root session and this test records the shrink — no silent behavior. |
| T7 | `team-projection-store.test.ts` (extend) — "trigger sequence: apply(G) → pull → duplicate(G) → pull → apply(G+1) → late response(G) → stale, state untouched" | C | 5.4 + 6c at store level: the lag window (6c) and late frames never overwrite |
| T8 | `client-plugin-mount.test.ts` (extend) — "status event for the team root id triggers exactly one pullProjection; status event for a member childSessionId (from the applied frame) triggers a pull for the owning team; status event for a foreign session triggers zero pulls; same-value repeat event triggers zero pulls; event during an in-flight pull coalesces (one round trip)" | M | The §4 trigger contract, all five behaviors, over the seam-mocked `connection`/`remote` |
| T9 | `client-plugin-mount.test.ts` (extend) — "channel loss (rpc reject) → markConnectionLost; generation change back → markConnectionRestored → one rebaseline pull per open team; a status event during `reconnecting` adds no extra in-flight pull" | M | 6a: lost-signal recovery = existing rebaseline, single-flight preserved |
| T10 | `client-plugin-mount.test.ts` (extend) — "subscription face absent (old upstream ctx without `$on`) → mount applies cleanly, all other triggers work, zero console/typed errors" | M | 7.1 fail-soft degradation |
| T11 | `catalog-unchanged.test.ts` (R/contracts, extend existing catalog assertions) — "REMOTE_METHOD_CATALOG is still exactly the 26 v1/v2/v3 methods; no subscription/push method exists" | R | 7.2: this feature adds no contract surface |
| T12 | `d4-a2-restart-reopen.mjs`-style real-host smoke (per TEST_METHODS.md `:3180`) — "open team in Team mode; Leader `team_delegate` via a real model turn with browser idle; assert the TeamView member/ledger lanes update without F5 and without any user click within one turn boundary; then `override.set` from the UI; assert the lane updates immediately" | U (E2E) | The user-observable D4-A2 acceptance: agent-mutation staleness bounded by the turn; override-mutation staleness gone |

Do NOT implement any of T1–T12 in this task (plan §14). T6 is the designated
verification gate for the one upstream-behavior assumption the design leans on.

---

## 9. OPEN QUESTIONS & EXPLICIT NON-GOALS

### Open questions (decision owners)

- **Q1 — Is turn-boundary latency acceptable as the frozen staleness bound?** (owner:
  user, before the implementation task is opened.) Default: YES for v2 — the bound is
  "≤ remaining mutating-turn duration", every trigger is a cheap generation-gated pull,
  and the UI's existing backstops still apply. If NO: the escalation path is the
  recorded alternative (c2) — a plugin-owned `@Remote({mode:'stream'})` changes stream
  with per-mutation items (public seam proven:
  `upstream: packages/typert/protocol/src/index.ts:101-105`, `:155-203`;
  `upstream: packages/api/gateway/src/index.ts:266-290`;
  `upstream: packages/typert/loader/src/index.ts:1-12`; precedent
  `upstream: packages/experimental/agent-team/src/index.ts:242-267`) — which is a NEW
  push surface and therefore requires explicit user approval under plan §14's
  prohibition, plus verification of the plugin-side typert artifact build step (not
  verifiable at design time). (c3) `session/follow`-based derivation remains the
  intermediate alternative (per-tool granularity, N streams, transcript pattern-matching).
- **Q2 — Does `agent/status` fire for subagent-owned member agents with `agent.id` =
  the member's child session id?** (owner: the future task, resolved by T6 on the
  pinned upstream SHA; the design already handles the negative case — trigger set
  shrinks to root-session events, member-mutation staleness then falls to the next
  leader-turn boundary or a UI action; documented, not silent.)
- **Q3 — `compatibility.ack` UI-disabled wire gap** (B3 input, B3Result row #11):
  enabling the ack action + its success callback is new UI, outside D4-A2 (it is a
  D4-A1-adjacent UI task); when it is built, it plugs into the same
  `pullProjection` and needs nothing from this design.

### Explicit non-goals (frozen by this design, per plan §14)

1. **No implementation in this plan** — no product code, no tests, no remote methods,
   no composition change (plan §14: "本计划只产出 design/evidence，不实现"; signal /
   owner / version / tests are frozen HERE, implementation is a future single-writer
   task owned by whoever G5 dispatches it).
2. **No new wire in this plan** — no new remote method, no contract v4, no polling
   timer, no plugin-owned push stream, no plugin-owned forwarded event (plan §14 line
   435; CORE PATCH BUDGET = 0).
3. **No upstream change, ever, for this feature** — (c1) is proven buildable on the
   stock public surface; the two shapes that would need upstream (plugin forwarded
   event name; anything in `ClientConnectionRpc` beyond the stock web carrier) are
   declared `CORE_SEAM_BLOCKER` territory and NOT designed.
4. **No change to the D4-A1 behavior** — existing UI callbacks keep their exact pull
   semantics; this design only ADDS a trigger and fixes the override stamp.
5. **No per-mutation push, no transcript mirroring, no new team event vocabulary, no
   new ledger fact type, no new store/field** — the generation stamp remains the single
   signal; the allowlisted `api-session/status` remains the single new trigger.
6. **No cross-tab or multi-window coordination**, no server-side subscription registry,
   no QoS/acking on the trigger path — triggers are best-effort nudges; the stamp is
   the authority.

---

*Design complete. Every public-seam claim above cites `references/deepseek-harness-test-use`
@ `76fda729799fe9b3848dbe2c211d4b231032b81e` (pristine, verified at task start and end).
All in-repo citations are against base `e72796c` (worktree `.worktrees/team-d1-d6-v2-E1`).*
