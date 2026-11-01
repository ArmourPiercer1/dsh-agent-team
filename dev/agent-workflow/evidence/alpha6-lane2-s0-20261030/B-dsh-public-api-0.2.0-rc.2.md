# B — DSH PUBLIC (plugin-usable) HOST API AUDIT @ 0.2.0-rc.2

Read-only audit for the Alpha.6 S0 "single-flight review wake scheduler" design gate.

## 0. Baseline verification (done by this audit)

| item | value | how verified |
| --- | --- | --- |
| upstream tree | `/home/armourpiercer/deepseek-harness` | `git rev-parse HEAD` → **`639ed015397290b3745d163aafe02ffee4aa3f84`** |
| `git describe --tags` | `dsh-v0.1.7-rc.1-794-g639ed01539` (no official tag at this SHA — matches AGENTS.md "fork 无该 tag") | same |
| version | root `package.json` `"version": "0.2.0-rc.2"`; every audited package (`@deepseek-ai/dsh-agent`, `dsh-agent-loop`, `dsh-session`, `dsh-llm`, …) also `"0.2.0-rc.2"` | `cat package.json` |
| worktree cleanliness | `git status --porcelain` empty | same |
| team repo | `/home/armourpiercer/projects/dsh-agent-team-lane-2` @ `12cc9843e840849e7f831d513fdcd83b0813a921` | `git rev-parse HEAD` |
| writes | **zero** into either tree. Only this file was written (inside the lane-2 workspace, under `.artifacts/`). No builds run. | — |

All `path:line` citations below are **absolute paths in the upstream tree** unless prefixed `TEAM:` (= `/home/armourpiercer/projects/dsh-agent-team-lane-2`).

Convention used throughout:
* **PUBLIC** = exported from a package subpath listed in that package's `package.json` `exports` (or reachable from a `ctx.<service>` accessor / a `declare module '@deepseek-ai/cordis'` augmentation) → a plugin may use it.
* **INTERNAL** = not in `exports`, or an explicit `/internal` subpath.
* One structural fact dominates everything below: **a DSH plugin *is* trusted in-process code.** The plugin loader gives it the *same* `Context` object the host core uses (`vendor/cordis/src/context.ts:9-31`), and every host capability hangs off that Context. There is no plugin capability sandbox, so "public" in DSH means "reachable and documented", not "enforced-minimal". This makes almost every capability in the Alpha.6 wish-list reachable **without a host patch**.

---

## B1. The plugin-visible Agent handle / how a plugin reaches another session's Agent

### The seam: `ctx.agents` (`AgentRegistry`)

* `declare module '@deepseek-ai/cordis' { interface Context { agents: AgentRegistry } }` — `/home/armourpiercer/deepseek-harness/packages/core/agent/src/index.ts:27-30`. Package **`@deepseek-ai/dsh-agent`** (`packages/core/agent`, `exports["."] → lib/types/index.d.ts`).
* `export class AgentRegistry extends Service` — `.../packages/core/agent/src/index.ts:245`; default export at `:689`.

| member | signature | citation |
| --- | --- | --- |
| `get` | `get(id: SessionId): Agent \| undefined` | `.../packages/core/agent/src/index.ts:566` |
| `list` | `list(): Agent[]` (live, creation order) | `:586` |
| `roots` | `roots(): Agent[]` | `:596` |
| `create` | `create(options: CreateAgentOptions): Promise<AgentHandle>` | `:391` (options type `:63`) |
| `resume` | `resume(options: ResumeAgentOptions): Promise<AgentHandle>` | `:410` (options type `:125`) |
| `register` | `register(agent: Agent): ReturnType<Context['effect']>` (adopts a caller-constructed Agent, source `startup`) | `:437` (doc `:419`) |
| `isOwnedBy` | `isOwnedBy(id: SessionId, owner: Agent): boolean` | `:578` |
| `setFactory` | `setFactory(factory: AgentFactory): () => void` (returns disposer; throws if one is already registered) | `:358`, `:360` (type `:171`) |
| `enter`/`announce` | `enter(agent, owner): () => void` / `announce(agent, source, signal?): Promise<void>` | `:459`, `:537` |
| `AgentHandle` | `{ agent; release(): …; dispose(): Promise<void> }` | `:160-163` |

**No authorization, no capability check.** `get()` is a plain map lookup (`:566-568`); any plugin that holds a `Context` can obtain the *live mutable* `Agent` object for *any* session and drive it. `dispose` is the only real capability concept (`.../packages/core/agent/src/index.ts:146-152`: "The disposer is a CAPABILITY: among consumers, only the holder can tear this agent down"), and `isOwnedBy` is an *inspectable* owner relation, not a gate.

### The `Agent` face

Base identity: `export interface Agent { readonly id: SessionId }` — `/home/armourpiercer/deepseek-harness/packages/core/agent/src/types.ts:15-18` (merge target for the runtime face).

Runtime face (`declare module './types.ts' { interface Agent {…} }`) — `/home/armourpiercer/deepseek-harness/packages/core/agent/src/runtime-types.ts:163-243`:

```ts
readonly options: AgentOptions                    // :166
readonly session: Session                         // :168  ← durable log object
readonly inbox: Inbox                             // :170  ← pending input face
get status(): AgentStatus                         // :172  'idle' | 'running'  (:109)
readonly ctx: Context                             // :174  ← the agent's OWN scoped context
cancel(cause: AgentCancelCause, options?: CancelOptions): void   // :183
whenIdle(): Promise<void>                         // :191
runMaintenance<T>(task: (signal: AbortSignal) => Promise<T>): Promise<T>  // :202
send(message: UserMessage, target: InboxTarget, wakeup: boolean): void    // :215
followup(message: UserMessage): void              // :222
steer(message: UserMessage): void                 // :231
inject(message: UserMessage): void                // :241
```

`agent.ctx` deserves special note: it is the *agent's own* scoped Context (`/home/armourpiercer/deepseek-harness/packages/core/agent-loop/src/agent.ts:119` `readonly ctx = this.loopCtx.agentLoop.scope`, declared `runtime-types.ts:174`). A plugin that holds a foreign Agent therefore also holds that agent's scope carrier — it may register **scoped listeners scoped to the foreign agent** (`agent.ctx.on('agent/inbox/claimed', …)`) and even register scoped tools/hooks into it. That is the strongest observation seam in the whole API, and it is public.

### What the team plugin uses today

* Plugin host entry declares `inject` for `agents`, `storageDomain`, `sessions`, `workspaceRegistry` (+ lazy `sessionPersistence`) — `TEAM:packages/runtime/src/plugin/host.ts:14-27` (header) and the shim block at `:1284-1300`. The entry itself deliberately has **zero `@deepseek-ai/*` imports** (`TEAM:packages/runtime/src/plugin/host.ts:1282`).
* The glue bundle *does* import upstream packages: `TEAM:packages/runtime/src/plugin/live/agent-bindings.mjs:339-342` → `SessionId` from `@deepseek-ai/dsh-session`, `installModelSelection` from `@deepseek-ai/dsh-agent`, `ToolCallId, createUserMessage` from `@deepseek-ai/dsh-llm`, `@deepseek-ai/dsh-mcp-client`.
* `ensureLiveAgent(sessionId)` — `TEAM:packages/runtime/src/plugin/live/agent-bindings.mjs:4043`; single-flighted per session id via `singleFlightTeamActivation(ensureLiveAgentInFlight, sid, …)` (`:4062-4066`); the body `ensureLiveAgentOnce` (`:4076`) uses `agents.get(SessionId(sid))` to detect a foreign live owner (`:4096-4099`, fail-closed "already registered outside the Team glue"), then `resumeTeamAgent({sessionId, setup})` (`:4118-4128`) → `ctx.agents.resume`. **The plugin already caches `AgentHandle`s in a `liveAgents` map and already single-flights activations** — the scheduler's "at most one live handle per session" half exists.

---

## B2. `followup` semantics, inbox target, back-to-back drain, dedupe key

Implementation: `/home/armourpiercer/deepseek-harness/packages/core/agent-loop/src/agent.ts`

```ts
send(message: UserMessage, target: InboxTarget, wakeup: boolean): void {          // :154
  const wakingAfterAbort = wakeup && this.phase.kind !== 'idle' && this.phase.abort.signal.aborted
  const resolvedTarget = wakingAfterAbort ? 'next-turn' : target
  this.inbox.splice(resolvedTarget, Infinity, 0, [message])                        // :159  → durable 'agent/inbox/spliced'
  if (wakeup) this.wakeDriver(wakingAfterAbort)                                    // :160
}
followup(input: UserMessage): void { this.send(input, 'next-turn', true) }         // :163-165
steer(input: UserMessage): void    { this.send(input, 'next-step', true) }         // :167-169
inject(input: UserMessage): void   { this.send(input, 'next-step', false) }        // :171-173
```

* **Target**: `followup` writes **`next-turn`** (never the current turn). Type: `export type InboxTarget = 'next-turn' | 'next-step'` — `/home/armourpiercer/deepseek-harness/packages/core/agent/src/types.ts:40`.
* **Return value**: `void`. No id, no receipt, no dedupe key parameter. (The id is a plugin problem — see B4/B5.)
* **Wake semantics**: `wakeDriver()` (`:214-233`) starts a driver when idle; if the phase is maintenance/aborted it *latches* `wakeRequested`. Documented invariant: "A wake submitted while already idle always opens its turn boundary, **even when its message is cleared before the driver claims it**" — `/home/armourpiercer/deepseek-harness/packages/core/agent/src/runtime-types.ts:206-210`.
* **Back-to-back drain — YES.** The driver is
  ```ts
  private async kick(): Promise<void> { try { while (await this.turn()) {} } … }   // :252-254
  ```
  and at the end of `turn()`:
  ```ts
  if (!this.inbox.hasPending) return false                                         // :390
  … this.setPhase({ kind:'running', … }); this.wakeDriver(); return true           // :393-395
  ```
  So after a turn ends, **any remaining pending input immediately opens another turn in the same driver**, with no idle window. Each turn claims **exactly one** `next-turn` message: `this.mutate('next-turn', 0, 1, [], false)` — `/home/armourpiercer/deepseek-harness/packages/core/agent-loop/src/inbox.ts:110-111`; the contract is stated as "The woken message is the sole ordinary message of its own turn" (`runtime-types.ts:294-296`).
  **Alpha.6 consequence: N followups = N leader turns, run back-to-back.** This is exactly the wake amplification the single-flight scheduler must prevent; the host provides no coalescing.
* **Dedupe/id key accepted**: none in the signature. **But there is an accidental single-flight primitive**: pending message ids must be unique, enforced twice —
  * in-memory pre-splice: `` throw new Error(`message "${message.id}" is already pending`) `` — `/home/armourpiercer/projects/…/inbox.ts:223-224` (and the same check inside the durable fold at `inbox.ts:47`);
  * so **submitting a `followup` whose `message.id` is already pending THROWS synchronously and writes nothing.** A plugin that mints a *deterministic* message id per wake slot gets host-enforced "at most one outstanding" for free (see B4 for how to mint it, and GAP-G1 for its limits).
* **Drain code quoted** (claim site): `/home/armourpiercer/deepseek-harness/packages/core/agent-loop/src/agent.ts:267-286` (`preStep`) → `const claimed = this.inbox.claim(target, position.turn)` (`:271`) → `this.inbox.claim` = `/home/armourpiercer/deepseek-harness/packages/core/agent-loop/src/inbox.ts:109-114`.

---

## B3. `send` / `steer` / `inject` / interrupt equivalents

| API | signature | target semantics | citation |
| --- | --- | --- | --- |
| `send` | `send(message, target: InboxTarget, wakeup: boolean): void` | raw primitive. `wakeup:true` = "starts/extends model work"; `wakeup:false` = durable only, "starts no driver and never wakes a resting Agent. Use it with `agent.inbox` management in the same callback." | `runtime-types.ts:205-215`; impl `agent.ts:154-161` |
| `followup` | `followup(message): void` | `send(m,'next-turn',true)` — starts a new turn when idle, queues durably when not idle. "It never enters the current turn's model request or pre-step decision." | `runtime-types.ts:217-222` |
| `steer` | `steer(message): void` | `send(m,'next-step',true)` — joins the **current turn** at the next step boundary. "Do not use it to wake a resting Agent: a queued next-step item does not start work unless another source wakes the Agent first." | `runtime-types.ts:224-231` |
| `inject` | `inject(message): void` | `send(m,'next-step',false)` — durable next-step context, no wake, no turn. | `runtime-types.ts:233-241` |
| `cancel` | `cancel(cause: AgentCancelCause, options?: CancelOptions): void` | **the only interrupt**. Clears the inbox unless `keepInbox`, then aborts the active turn. | `runtime-types.ts:175-183`, `:38-45`; impl `agent.ts:175-181` |
| `runMaintenance` | `runMaintenance<T>(task): Promise<T>` | exclusive background task in place of a turn; throws `already has active work` when not idle; a wake requested during maintenance is replayed at convergence. | `runtime-types.ts:193-202`; impl `agent.ts:183-203` |
| Remote `cancel` command | `@Remote('cancel') cancel(request: SessionCancelRequest): SessionCancelValue` → `agent.cancel({ kind: 'user' }, { keepInbox: true })` | the product Stop button path — **aborts the turn but PRESERVES queued input** | `/home/armourpiercer/deepseek-harness/packages/api/session-controller/src/index.ts:456-458`; `/home/armourpiercer/deepseek-harness/packages/api/session-controller/src/commands.ts:510-524` |

There is **no** `interrupt()` / `pause()` / `holdWake()` API. `agent/request` is a waterfall hook that *can* veto a model request (`runtime-types.ts:329-337`) — a plugin could in principle stall a turn there, but that is a veto hook, not a scheduler seam, and abusing it blocks the loop.

---

## B4. Inbox: list / read / claim / remove / clear

Public contract `export interface Inbox` — `/home/armourpiercer/deepseek-harness/packages/core/agent/src/runtime-types.ts:48-100` (reached from a plugin as `agent.inbox`, `runtime-types.ts:170`).

| member | signature | citation |
| --- | --- | --- |
| enumerate pending | `readonly nextTurn: readonly UserMessage[]` / `readonly nextStep: readonly UserMessage[]` | `:50`, `:52`; impl `agent-loop/src/inbox.ts:82-89` |
| `clear()` | `clear(): void` — "Durably cancel all pending input, clearing next-step before next-turn." | `:55`; impl `inbox.ts:98-100` |
| `append` / `prepend` | `(target: InboxTarget, message: UserMessage): void` | `:62`, `:69` |
| `replace` | `replace(messageId: MessageId, newMessage: UserMessage): boolean` — "whether the message was still pending" | `:77`; impl `inbox.ts:140-142` |
| **`remove`** | **`remove(messageId: MessageId): boolean`** — "Remove one pending message… whether the message was still pending." | **`:84`**; impl **`inbox.ts:152-154`** |
| `splice` | `(target, start, deleteCount, inserted): UserMessage[]` — durable, records normalized result | `:94`; impl `inbox.ts:167-243` |

Answers:
* **Is `inbox.remove(messageId)` publicly reachable from a plugin? YES.** `ctx.agents.get(sid).inbox.remove(MessageId(id))`. The product itself does exactly this from the remote layer: `agent.inbox.remove(request.itemId)` / `agent.inbox.replace(...)` — `/home/armourpiercer/deepseek-harness/packages/api/session-controller/src/commands.ts:482-496`.
* **Message id type**: `export type MessageId = Branded<'MessageId'>`, constructor `export function MessageId(id: string): MessageId` — `/home/armourpiercer/deepseek-harness/packages/llm/llm/src/brand.ts:17-26`; re-exported from `@deepseek-ai/dsh-llm` (`packages/llm/llm/src/index.ts:45`). Runtime form: non-empty string, validated only as `typeof id === 'string' && id !== ''` — `/home/armourpiercer/deepseek-harness/packages/core/session/src/index.ts:344-348`.
* **Is the id returned on submit?** No (`followup/send/steer/inject` return `void`). **But the plugin constructs the message, so it owns the id.** `createUserMessage` forbids an explicit id (`NewUserMessage = Omit<UserMessage,'id'|'role'>`, `MessageInput = T & { id?: never }` — `/home/armourpiercer/deepseek-harness/packages/llm/llm/src/message.ts:202`, `:239-253`) and mints `randomUUID()`. To pin a deterministic id, build the object literal and freeze it with the exported helper: `export function freezeMessage<T extends Message>(message: T): T` (`message.ts:212-219`), i.e.
  ```ts
  const m = freezeMessage<UserMessage>({ role: 'user', id: MessageId(`review-wake:${requestId}`),
                                         content: [...], source: { kind: 'plugin:dsh-agent-team', … } })
  agent.followup(m)   // throws `message "…" is already pending` if a wake with that id is still queued
  ```
* **Can a plugin enumerate currently pending entries?** Yes **while the agent is live**: `agent.inbox.nextTurn` / `.nextStep` (`inbox.ts:82-89`), or the live projection `ctx.sessionProjections.stateOf(session, 'inbox')` (`@deepseek-ai/dsh-session-projection`, `declare module … { interface Context { sessionProjections: SessionProjectionRegistry } }` — `/home/armourpiercer/deepseek-harness/packages/session/session-projection/src/index.ts:32-36`; state key registered by AgentLoop, `/home/armourpiercer/deepseek-harness/packages/core/agent/src/types.ts:81-91`). **For a cold (not-live) session there is no public "read the durable pending inbox" call** — the projection is driven only for live sessions — but the data is durable as `agent/inbox/spliced` events and upstream's own answer is to fold the suffix yourself, verbatim reference implementation at `/home/armourpiercer/deepseek-harness/packages/experimental/agent-team/src/session-message.ts:9-31` (`pendingInboxMessages` + `messageAccepted`).
* Removal also emits: discarded removals emit `agent/inbox/discarded {agent,message}` — `inbox.ts:236-238`.

---

## B5. Message SOURCE attribution (write and read)

### Schema

`/home/armourpiercer/deepseek-harness/packages/llm/llm/src/message.ts` (package **`@deepseek-ai/dsh-llm`**):

```ts
/** Producers extend this interface with their own source kind and required fields. */
export interface MessageSourceMap {                       // :110
  model: ModelMessageSource
  tool: ToolMessageSource
  'system-prompt': SystemPromptMessageSource
}
export type MessageSource = MessageSourceMap[keyof MessageSourceMap]   // :136
export interface MessageBase { readonly id: MessageId; readonly content: readonly ContentBlock[]
                               readonly source: MessageSource }        // :139-148
export interface UserMessage extends MessageBase { readonly role: 'user' }  // :162-164
```

* The doc comment is explicit (message.ts:118-128): "Merge-extensible sum type — each producer declares its own `kind` in its own module; **there is no shared catch-all `plugin` kind**… producers that merely *embed* a plugin id inside a shared kind are not merge-extension participants."
* **`'user'` is NOT in the map at all.** It is supplied by the product layer: `declare module '@deepseek-ai/dsh-llm' { interface MessageSourceMap { 'user-rpc': { kind:'user'; rpcId: SessionRequestId; clientTimeZone?: string } } }` — `/home/armourpiercer/deepseek-harness/packages/api/session-controller/src/types.ts:400-404`. So `'user'` is the *browser RPC* producer's kind; a plugin writing `{kind:'user'}` is forging that producer.
* **Enumerated producers actually shipped** (all merge-extension, all precedents for a plugin-owned kind): `agent-message` (`{kind:'agent-message', form:'relay', senderSessionId, senderName}` — `/home/armourpiercer/deepseek-harness/packages/subagent/subagent/src/continuation-messages.ts:40-52`), `team-message` (`{kind:'team-message', teamId, messageId, senderId, senderName}` — "Source retained by the target Session for **durable mailbox de-duplication**", `/home/armourpiercer/deepseek-harness/packages/experimental/agent-team/src/types.ts:137-148`), plus `compact-checkpoint`, `goal`, `skill-invocation`, `plan-mode`, `user-approval`, `webhook`, `schedule`, `time-context`, `agent-instructions`, `session-reference`, `ptc-mode`, `hooks-*`, and the migration-produced `plugin:<id>` shape (`/home/armourpiercer/deepseek-harness/packages/session/session-format-v3-to-v4/src/sources.ts:59-64`).
* Optional semantic form axis: `export type ContextForm = 'instructions'|'catalog'|'snapshot'|'notice'|'relay'|'recall'` (`message.ts:55-67`), mixed in via `ContextFormed` (`:86-101`). `'relay'` = "A message another agent addressed to this one" (`:64-65`) and `'notice'` = "A one-off account of something that just happened" (`:62-63`) — both fit a review wake.

### Runtime admission (write side)

`/home/armourpiercer/deepseek-harness/packages/core/session/src/index.ts:336-381` (`assertMessageEventShape`, called by `adoptSessionEvent` `:171-173` and by `Session.append` `:751`):

```ts
const source = messageRecord['source']
if (typeof source !== 'object' || source === null
  || typeof (source as Record<string, unknown>)['kind'] !== 'string'
  || (source as Record<string, unknown>)['kind'] === '') {
  throw new Error(`${subject} message has invalid source`)                // :354-359
}
```
For `user/message` that is the **whole** check: any non-empty `kind` string is admitted, extra fields are kept (append snapshots data losslessly, `:732-750`). Only `system/message`, `assistant/message`, `tool/result` have kind-specific checks (`:364-381`). The v4 format rule "requires a producer-owned source kind" (`/home/armourpiercer/deepseek-harness/packages/session/session-format-v3-to-v4/src/message-sources.ts:10`) is a **historical-migration** rule for lifting v3 `{kind:'plugin', plugin}` records, not a write-time allowlist. `plugin:dsh-agent-team` is literally the shape that migration produces for a plugin named `dsh-agent-team` (`sources.ts:64`).

### Read side

* Durable: `SessionEventMap['user/message'] = UserMessage` — the whole message **including `source`** is the event payload (`/home/armourpiercer/deepseek-harness/packages/core/session/src/types.ts:309`), delivered live on `ctx.on('session/event', (session, event) => …)` and visible to remote clients through the journal.
* Consumers already discriminate on it — proof the axis is usable end-to-end: `source.kind === 'user' && typeof rpcId === 'string'` = "durable shipped-Web **human** instruction" (`/home/armourpiercer/deepseek-harness/packages/experimental/auto-review/src/index.ts:177-181`); skill scanning only reads `kind === 'user'` (`packages/skill/tool-skill/src/index.ts:421`); session title / `lastPromptAt` ignore non-`user` (`packages/session/session-title/src/index.ts:132`, `packages/api/session-controller/src/list.ts:50`).

**Verdict: a plugin-submitted message CAN be marked plugin-originated and distinguished from real user input, on both write and read, with no host patch.** The only thing missing is a *registry* — attribution is a naming convention, not a validated identity (GAP-G5, cosmetic).

---

## B6. Lifecycle events for correlation, and their order

### Two event planes

1. **Live agent plane** — `declare module '@deepseek-ai/cordis' { interface Events {…} }` in `/home/armourpiercer/deepseek-harness/packages/core/agent/src/runtime-types.ts:256-394`, dispatched through the fused agent-scope dispatcher `agentEvents` (`packages/core/agent/src/dispatch.ts:113-140`). All payloads carry `agent`.

| event | payload | mode | citation |
| --- | --- | --- | --- |
| `agent/created` | `{agent, source: SessionStartSource, signal?}` | **serial** (awaited) | `:261` |
| `agent/disposed` | `{agent}` | emit | `:270` |
| `agent/status` | `{agent, status:'idle'\|'running'}` | emit | `:280` |
| `agent/inbox/inserted` | `{agent, message}` | emit | `:288` |
| **`agent/inbox/claimed`** | **`{agent, message, turn}`** — "The message left the pending Inbox… its `seq` is the durable insertion position." | emit | **`:299`** |
| `agent/inbox/discarded` | `{agent, message}` | emit | `:307` |
| `agent/pre-step` | `{agent, messages, turn, step, signal}` | **waterfall** | `:320` |
| `agent/request` / `agent/request-error` | `{agent, turn, step, request}` / `{…, error}` | waterfall | `:337`, `:353` |
| `agent/assistant-stream` | `{agent, frame}` | emit | `:363` |
| **`agent/turn-stopping`** | `{agent, turn, signal}` | **serial** | **`:381`** |
| `agent/error` | `{agent, turn, step, error}` | emit | `:393` |

2. **Durable session plane** — ONE cordis event carries the whole log:
   `'session/event'(this: Scoped<Session>, session: Session, event: SessionEvent): void` — `/home/armourpiercer/deepseek-harness/packages/core/session/src/index.ts:77` (**@mode emit**, post-commit, failures contained). Plus `session/created` `:55`, `session/disposed` `:65`, `session/flush` `:86` (parallel, awaited).
   Log catalog `SessionEventMap` — `/home/armourpiercer/deepseek-harness/packages/core/session/src/types.ts:281-428`: `turn/start {turn}` `:288`, `turn/end {turn, reason}` `:297`, `step/start` `:299`, `step/end` `:301`, `user/message: UserMessage` `:309`, `agent/inbox/spliced {target,start,removedCount?,inserted,outcome?}` (`packages/core/agent/src/types.ts:88-95`).

### Emission ORDER for one followup wake (verified in `agent.ts`)

```
followup(m)  → append 'agent/inbox/spliced' (durable)      agent.ts:159 → inbox.ts:235
             → emit  'agent/inbox/inserted' {message}      inbox.ts:239-241
             → [idle?] wakeDriver → emit 'agent/status' running   agent.ts:150,229-232
turn():      append 'turn/start' {turn}                    agent.ts:305
preStep():   claim → append 'agent/inbox/spliced' (removal) inbox.ts:110-111,235
             emit  'agent/inbox/claimed' {message, turn}    inbox.ts:112   ← (messageId ⇄ turn) BINDING
             waterfall 'agent/pre-step' {messages,turn,step} agent.ts:276
step():      append 'step/start'                            agent.ts:329
             append 'user/message' (the message, with source) agent.ts:421  ← durable, NO turn field
             waterfall 'agent/request' → model
retire:      serial 'agent/turn-stopping' {turn,signal}     agent.ts:360
             append 'step/end' / 'turn/end' {turn, reason}  agent.ts:356 / :385
             emit  'agent/status' idle                      agent.ts:149-151
```

### The three Alpha.6 questions, answered

* **(a) learn the message was claimed — YES, public.** `agent/inbox/claimed` carries `{agent, message, turn}` (`runtime-types.ts:299`, emitted `inbox.ts:112`); it carries **both** the message id (`message.id`) **and** the turn number. Durable alternative: the removing `agent/inbox/spliced` event (`removedCount` at the known start index) — weaker, needs the fold.
* **(b) bind it to a specific turn — YES, public, but LIVE-ONLY.** `agent/inbox/claimed.payload.turn` is the only place the binding exists as an explicit field. The durable log does **not** carry it: `SessionEventMap['user/message'] = UserMessage` has no `turn` field (`types.ts:309`) — durable binding must be reconstructed positionally (the `user/message` lies between its `turn/start` and `turn/end`), which is sound because a turn claims exactly one next-turn message. A plugin subscribing with the *foreign agent's own* context (`agent.ctx.on(...)`) gets these reliably; a global `ctx.on` also works because the payload carries `agent`.
* **(c) learn the turn ended — YES, public and durable.** `session/event` with `type === 'turn/end'` and `{turn, reason}`; `reason.kind` is `'completed'|'blocked'|'aborted'` (`types.ts:201-232`), and `'aborted'` carries the `TurnEndCancelCause`. Idle is also observable via `agent/status` (live), `api-session/status(sessionId, running)` (`packages/api/session-controller/src/types.ts:604`), or durably via the `turnBoundary` projection: `openTurnStartSeq === null` ⇒ no open turn (`packages/core/agent/src/types.ts:69-79`, fold `packages/core/agent-loop/src/index.ts:57-95`, key `'turnBoundary'` at `:58`).

**No GAP here.** The claim→turn→turn-end triangle is closed with public events. The only caveat: `agent/inbox/claimed` is process-local (not replayable after a restart); the durable reconstruction fallback exists and is cheap (fold `turn/start`, `turn/end`, `user/message`, `agent/inbox/spliced`).

---

## B7. Stop / Resume / Archive / Cancel

### What a user Stop does

`Agent.cancel(cause, options)` impl — `/home/armourpiercer/deepseek-harness/packages/core/agent-loop/src/agent.ts:175-181`:
```ts
cancel(cause: AgentCancelCause, options: CancelOptions = {}): void {
  if (!options.keepInbox) { this.inbox.clear(); if (this.phase.kind !== 'idle') this.phase.wakeRequested = false }
  if (this.phase.kind !== 'idle') this.phase.abort.abort(cause)
}
```
Two distinct product stops:
* **Stop button (Remote `cancel`)**: `agent.cancel({kind:'user'}, { keepInbox: true })` — **turn aborted, pending inbox PRESERVED** (`packages/api/session-controller/src/commands.ts:523`). A parked wake message therefore stays pending and will be drained by the next wake (B2 drain loop).
* **Archive-with-stop** (`workspace/session-stop`): `agent.cancel({ kind: 'user' })` — "without the stop button's `keepInbox`, so queued input is discarded with a logged inbox splice instead of waking the archived Session later" (`/home/armourpiercer/deepseek-harness/packages/core/agent/src/archive-admission.ts:16-22`, impl `:35-37`). Emits `agent/inbox/discarded` per dropped message (`inbox.ts:236-238`).
* Cause union is closed: `AgentCancelCause = {kind:'user'} | {kind:'parent'} | {kind:'disposed'} | {kind:'hook', reason:string}` — `/home/armourpiercer/deepseek-harness/packages/core/session/src/types.ts:189-194`. It lands verbatim in `turn/end` as `reason: {kind:'aborted', cause}` (`types.ts:214-221`).
* Turn settlement stays regular: `turn/end` is appended in `turn()`'s `finally` (`agent.ts:384-386`); driver errors/aborts are contained at `kick()` (`:255-264`).

### (i) detect Stop publicly — YES
`session/event` → `turn/end` with `data.reason.kind === 'aborted'` (`data.reason.cause.kind === 'user'`). This is durable, ordered, and cause-attributed. Closest live proxy: `agent/status` → idle, plus `agent/turn-stopping {signal}` (whose `signal.reason` is the cause).

### (ii) suppress auto-reactivation after Stop — NO host concept to suppress (this is a plugin-side requirement, not a host gap)
The host has no auto-reactivation of a stopped session. The only host-side reactivation is the **wake latch**: a `followup` that arrives during an aborted/maintenance phase sets `wakeRequested` and is replayed at convergence (`agent.ts:216-221`, `:262`), and "A wake submitted while already idle always opens its turn boundary, even when its message is cleared before the driver claims it" (`runtime-types.ts:206-210`). ⇒ *Suppressing post-Stop wakes is entirely under the plugin's control* (it is the one calling `followup`); the plugin must implement its own "stopped ⇒ do not re-wake" gate, and must be aware that removing the message **after** an idle `followup` still burns one empty turn. There is no public API to *withdraw a wake request* (GAP-G4).

### (iii) resume a session — YES, public
`ctx.agents.resume({ resumeSessionId, parentAgent?, agentOptions?, signal?, setup? })` — `/home/armourpiercer/deepseek-harness/packages/core/agent/src/index.ts:410` (options type `:125-144`), returns `AgentHandle` (`{agent, release, dispose}`, `:160-163`; `dispose()` = "stop and durably drain the Agent, close its Session, detach, and dispose the scoped context"). `source` reported to `agent/created` is `'resume'` (`runtime-types.ts:125`). The team glue already uses it (`TEAM:…/agent-bindings.mjs:4118`).

### (iv) detect archival / team close — YES
* `ctx.workspaceRegistry` (`declare module '@deepseek-ai/cordis'` at `/home/armourpiercer/deepseek-harness/packages/workspace/workspace/src/index.ts:113-116`): `get archivedSessionIds(): readonly SessionId[]` `:342`; `archiveSession(sessionId, options?): Promise<void>` `:363`; errors `WorkspaceActiveSessionArchiveError` (carries `activity`) `:59-70`, `WorkspaceArchivedSessionPinError` `:75`.
* Events: `'workspace/session-activity'(request, next)` **waterfall** — "Any non-empty result refuses the archive without a write" (`:129-136`) ⇒ a plugin can **veto an archive** (or report its own outstanding wake as activity, kind `'turn'` merged at `packages/core/agent/src/types.ts:21-26`); `'workspace/session-stop'(request)` **parallel** (`:147`).
* Process/lifetime edges: `agent/disposed` (`runtime-types.ts:270`), `session/disposed` (`packages/core/session/src/index.ts:65`), `api-session/removed(sessionId)` (`packages/api/session-controller/src/types.ts:612`).
* "Team close" is not a host concept — it is the plugin's own (`closing` flag in the glue, `TEAM:…/agent-bindings.mjs:4048-4050`).

---

## B8. `whenIdle` and the hook-await deadlock

```ts
async whenIdle(): Promise<void> {
  let activity: Promise<void>
  do { await (activity = this.activityDone) } while (activity !== this.activityDone)   // agent.ts:237-241
}
```
Definition: waits for the current **activity** (`activityDone` = the running driver *or* the current maintenance task, set at `agent.ts:229`, `:188`), and **re-checks in a loop**, so maintenance, continuation turns, and the wake released behind them are all followed ("`whenIdle()` follows both the task and any waking work released behind it", `runtime-types.ts:197`). Combined with the back-to-back drain (B2), **`whenIdle()` after a `followup` waits for the leader's *entire* queue to drain, not one turn.**

### Does awaiting it from a hook deadlock? YES for the awaited hook modes.

Host awaits plugin hooks at exactly these points (mode from the `@mode` tag; `serial`/`waterfall`/`parallel` are awaited, `emit` is not — dispatch semantics documented at `/home/armourpiercer/deepseek-harness/packages/core/agent/src/dispatch.ts:53-80`):

| awaited hook | where the host awaits it | consequence |
| --- | --- | --- |
| `agent/created` (serial) | `await this.ctx.serial(carrier,'agent/created',…)` in `AgentRegistry.announce` — `/home/armourpiercer/deepseek-harness/packages/core/agent/src/index.ts:550` | **explicit prohibition**: "listeners must not await `agent.whenIdle()` or their own setup initialization, because those waits can depend on this dispatch" — `/home/armourpiercer/deepseek-harness/packages/core/agent/src/runtime-types.ts:252-254` |
| `agent/pre-step` (waterfall) | `await this.dispatch.waterfall(...)` inside the turn loop — `/home/armourpiercer/deepseek-harness/packages/core/agent-loop/src/agent.ts:276` | the turn cannot proceed → `whenIdle` never resolves → deadlock |
| `agent/turn-stopping` (serial) | `await this.dispatch.serial('agent/turn-stopping', …)` — `agent.ts:360`, **before** `turn/end` and before the phase goes idle | deadlock (turn-end is gated on the listener) |
| `agent/request`, `agent/request-error`, `agent/compaction-start` (waterfall) | `agent.ts:~560`, `runtime-types.ts:337/:353/:249` | same class of hazard |
| `tools/pre-execute` etc. (waterfall/parallel) | `/home/armourpiercer/deepseek-harness/packages/core/tools/src/index.ts:153,164,176,198` | inside a tool call — same hazard |
| `session/flush` (parallel) | `SessionStore.flush` — `/home/armourpiercer/deepseek-harness/packages/core/session/src/index.ts:1194-1210` | awaited by whoever flushes |

**Safe for a scheduler:** every `emit`-mode event — `agent/inbox/claimed`, `agent/inbox/inserted`, `agent/inbox/discarded`, `agent/status`, `agent/error`, `agent/disposed`, `session/event`, `session/disposed`, `domain/changed`, `workspace/session-stop`, `api-session/status`. "Observer failures are logged and contained… without making the committed append fail" (`packages/core/session/src/index.ts:66-70`); a detached background subscriber (a task started from plugin init / `ctx.effect`, not from inside an awaited hook) is never on the turn's critical path. **Rule for Alpha.6: the wake scheduler subscribes to `emit`-mode events only, and never calls `whenIdle()` from inside `agent/created`, `agent/pre-step`, `agent/turn-stopping`, or any tool hook.** (The team glue already does the right thing: it fires the notifier fire-and-forget after the per-team lock is released — `TEAM:packages/runtime/control/service.ts:2535-2549`.)

---

## B9. Multi-writer, leases, and durable plugin checkpoint

### Leases / ownership / fencing — three real mechanisms, all public

1. **Live-agent uniqueness**: `AgentRegistry.enter` throws `agent "${id}" is already registered` — "This is the authoritative collision boundary. Concurrent create/resume operations may both prepare, but only one exact entry can publish." — `/home/armourpiercer/deepseek-harness/packages/core/agent/src/index.ts:465-467`. Same-id double-activation is impossible in one process.
2. **Cross-process durable write lease (a true fence)**: `ctx.sessionPersistence.open(id, 'write')` — "`write` atomically claims single-writer ownership; an existing active owner rejects… `@throws {SessionAlreadyOwnedError}`" — `/home/armourpiercer/deepseek-harness/packages/session/session-persistence/src/index.ts:151-163`; kernel `flock(2)` implementation with no expiry, `session.lock` beside the log — `/home/armourpiercer/deepseek-harness/packages/session/session-persistence-jsonl/src/lease.ts:1-27`, `:70-115`; error class `/home/armourpiercer/deepseek-harness/packages/session/session-persistence/src/errors.ts:31`. A plugin may use `open(id,'read')`/`stat` freely (readers never take the lock) and can use a `write` attempt as an *owner probe*. Caveat: a live Agent already holds the write handle, so a plugin must not try to *hold* it.
3. **No generic per-session lease/owner token is exposed.** There is no "session manager lease", no fencing token, no epoch. (`AgentRegistry.isOwnedBy` `:578` inspects the parent/child owner graph only.) ⇒ **GAP-G3**: two plugins (or two instances of one plugin) may both drive the same live Agent, and nothing tells them. Host has no concept of it. The durable state below is the only place to build it.

### Durable per-plugin checkpoint — YES, first-class and public

`declare module '@deepseek-ai/cordis' { interface Context { storageDomain: DomainFacility } }` — `/home/armourpiercer/deepseek-harness/packages/storage/storage-domain/src/index.ts:35-39` (package `@deepseek-ai/dsh-storage-domain`).

```ts
const domain = await ctx.storageDomain.open(spec)      // :101  (single-open per domain name, :102-104)
const table: KvTable<K, V> = domain.table(name)        // domain.ts:217
table.get(key): V | undefined                          // domain.ts:48
table.entries() / table.keys()                         // domain.ts:55 / :61
await table.put(key, value): Promise<void>             // domain.ts:72
await table.delete(key): Promise<boolean>              // domain.ts:80
await table.update(key, fn): Promise<V>                // domain.ts:89   ← read-modify-write primitive
await domain.global.set(v) / domain.global.get()       // domain.ts:19-40
await domain.close()                                   // domain.ts:118
```
Declaration helper: `export function defineDomain<S extends DomainSpec>(spec: S): S` (`/home/armourpiercer/deepseek-harness/packages/storage/storage-domain/src/spec.ts:107`); spec fields `name/version/layout:'single'|'per-record'/global/tables/compatibleVersions/invalidRecords` (`:35-71`); table helper `domainTable<K,V>(zodSchema)` (`:91`). Change feed: `'domain/changed'(change: DomainChanged)` **emit**, "emitted once per write strictly after the backend acknowledged durability… in its write-chain order" — `/home/armourpiercer/deepseek-harness/packages/storage/storage-domain/src/events.ts:35-46`. Durable across restarts; backend chosen by config route (`index.ts:49-62`). Working precedent of a plugin-owned domain: `packages/schedule/schedule/src/index.ts:126` and `packages/session/session-projection-cache/src/index.ts:118`; the team plugin already injects `storageDomain` (`TEAM:packages/runtime/src/plugin/host.ts:16-18`).

Secondary options: `ctx.settings.update/replace/mutate(ns, patch, expectedRevision)` writes the plugin's volatile config with optimistic-concurrency (`SettingsConflictError`) — `/home/armourpiercer/deepseek-harness/packages/settings/settings/src/index.ts:347,357,367` — usable but it is *configuration*, not state.

⇒ **No CORE_SEAM_BLOCKER for the checkpoint.** Single-flight state (target session id → outstanding wake `{messageId, requestId, seq}`) is exactly a `KvTable` row keyed by session id.

---

## B10. Cross-check: what the team repo does today

| item | file:line | what it actually does |
| --- | --- | --- |
| trigger | `TEAM:packages/runtime/control/service.ts:2535-2549` | `if (outcome.created && record.kind === LEADER_APPROVAL)` → `port.notifyLeaderRequest(record)` fired **fire-and-forget** after the per-team lock; failures are liveness-only. ⇒ **exactly one `notify` per created approval request.** |
| notifier | `TEAM:packages/runtime/control/leader-notification.ts:157-171` | `createLeaderControlNotifier` → `deliver({ rootSessionId, requestId, text: renderLeaderApprovalNotification(request) })`; text is a `[team-control requestId=<id>]`-leading human-readable block (`:100-124`). Pure render, no state, no dedupe. |
| wiring | `TEAM:packages/runtime/src/plugin/root.ts:2384-2390` | `requestNotification: createLeaderControlNotifier({ deliver: live.deliverRootControlNotification })` |
| delivery | `TEAM:packages/runtime/src/plugin/live/agent-bindings.mjs:5124-5144` | `deliverRootControlNotification` → validates → `await deliverRootInput({ rootSessionId, text }, { livenessOnly: true })` |
| shared path | `TEAM:…/agent-bindings.mjs:4991-5035` | `ensureLiveAgent(sid)` `:5001` → `prepareAgentForRequest(sid, sid)` `:5004` (final-input verdict skipped when `livenessOnly`, `:4992`) → `createUserMessage({ content:[text], source: { kind:'user' } })` **`:5028-5031`** → `handle.agent.followup(message)` **`:5032`** → **`await handle.agent.whenIdle()` :5033** → `await sessionPersistence.ensureMaterialized(handle.agent.session)` `:5034` |
| persistence shim | `TEAM:packages/runtime/src/plugin/host.ts:1284-1297` | `ensureMaterialized` is a **plugin-local** adapter over the public `ctx.get('sessions').flush(session)` — not an upstream API (upstream has no `ensureMaterialized` at rc.2; verified by grep: zero hits in `/home/armourpiercer/deepseek-harness/packages/`) ⇒ compliant |
| **precedent already in repo** | `TEAM:…/agent-bindings.mjs:5203-5256` | `deliverRootWorkCompletionNotification`: **acceptance-only** ("success boundary is the followup/steer ACCEPTANCE only… does NOT await `whenIdle`", `:5158-5164`), `status==='idle' ? followup : steer` (`:5236`), and **`createUserMessage({ …, source: { kind: 'plugin:dsh-agent-team' } })`** (`:5246-5248`) with the comment "Distinct from the `kind: 'user'` human-input attribution" (`:5243-5245`). **Both (i) and (iii) are therefore already proven in this codebase — only the control-notification path has not been migrated.** |

### Which Alpha.6 requirement is violated by the current control path, precisely

| Alpha.6 requirement | current `deliverRootControlNotification` | verdict |
| --- | --- | --- |
| **(i) acceptance-only** (return without awaiting the model turn) | `await handle.agent.whenIdle()` at `:5033` — and per B2/B8 that waits for the **whole drain**, i.e. the leader's entire queued backlog, plus a durability flush at `:5034`. The caller already fires it fire-and-forget, so nothing blocks the *request* path — but the *delivery* promise is a full-turn wait, which is exactly the coupling Alpha.6 removes. | **VIOLATED** |
| **(ii) single-flight dedupe** | none. One `followup` per approval request; N concurrent approvals ⇒ N messages ⇒ N back-to-back leader turns (`agent.ts:252-254`, `:390`). The in-process `ensureLiveAgent` single-flight (`:4062`) dedupes *activation*, never *wake*. No message id is pinned (`createUserMessage` mints a fresh UUID, `message.ts:251`), no source id, no durable checkpoint of "one wake outstanding for this root". | **VIOLATED** |
| **(iii) attributable plugin origin** | `source: { kind: 'user' }` at `:5030` — the message is indistinguishable from a browser human prompt except by the absence of `rpcId` (the human marker is `kind:'user' && typeof rpcId === 'string'`, `packages/experimental/auto-review/src/index.ts:178-182`). Provenance is only in the *body text* (`[team-control requestId=…]`), which the host treats as opaque and which every `source.kind === 'user'` consumer (skill scan, session title, `lastPromptAt`, auto-review's "human instruction") misclassifies as human. | **VIOLATED** |

---

## Capability table

| # | capability | public? | exact API | citation | Alpha.6 usability verdict |
| --- | --- | --- | --- | --- | --- |
| 1 | get another session's live Agent | **PUBLIC** | `ctx.agents.get(id): Agent \| undefined` | `packages/core/agent/src/index.ts:566`; Context decl `:29` | USE. No authz, no lease — pair with plugin-side owner state. |
| 2 | resume a cold session as live Agent | **PUBLIC** | `ctx.agents.resume({resumeSessionId, setup?}): Promise<AgentHandle>` | `.../index.ts:410`, `:125-144` | USE (glue already wraps it). |
| 3 | enqueue wake for a later turn | **PUBLIC** | `agent.followup(m): void` (=`send(m,'next-turn',true)`) | `runtime-types.ts:222`; `agent-loop/src/agent.ts:163` | USE. Acceptance is synchronous+durable; returns nothing. |
| 4 | enqueue wake into current turn | **PUBLIC** | `agent.steer(m): void` | `runtime-types.ts:231`; `agent.ts:167` | USE as busy-path, with documented retire-race. |
| 5 | durable context without waking | **PUBLIC** | `agent.inject(m)` / `agent.send(m,target,false)` | `runtime-types.ts:241`, `:215` | AVAILABLE (useful for non-waking notices). |
| 6 | host auto-runs queued next-turn back-to-back | n/a (behavior) | `while (await this.turn()) {}` + `if (!inbox.hasPending) return false` | `agent.ts:252-254`, `:390` | **AMPLIFIER**: N wakes = N turns, no coalescing. Scheduler must dedupe. |
| 7 | dedupe key on submit | **NO API** | `followup/send` take only the message; no id/idempotency param | `runtime-types.ts:215-241` | **PROXY**: deterministic `message.id` + host's "already pending" throw (`inbox.ts:223`) = de-facto single-flight. See GAP-G1. |
| 8 | enumerate pending inbox | **PUBLIC (live only)** | `agent.inbox.nextTurn / .nextStep`; `ctx.sessionProjections.stateOf(session,'inbox')` | `runtime-types.ts:50-52`; `inbox.ts:82-89`; `session-projection/src/index.ts:32-36` | USE for live; cold sessions need manual fold (`agent-team/src/session-message.ts:9-31`). |
| 9 | remove an unclaimed wake by exact id | **PUBLIC** | `agent.inbox.remove(messageId): boolean` | `runtime-types.ts:84`; `inbox.ts:152-154`; product use `session-controller/src/commands.ts:488` | USE. Only while pending; emits `agent/inbox/discarded`. |
| 10 | clear/replace pending | **PUBLIC** | `inbox.clear()`, `inbox.replace(id,msg)`, `inbox.splice(...)` | `runtime-types.ts:55,77,94` | AVAILABLE. |
| 11 | receive submitted message id | **NO API** (returns `void`) | plugin owns the id: `MessageId(string)` + `freezeMessage` (`createUserMessage` forbids `id`) | `llm/src/brand.ts:23`; `llm/src/message.ts:212,239-253` | USE plugin-minted ids — required design. |
| 12 | mark message plugin-originated (write) | **PUBLIC, merge-extensible** | `declare module '@deepseek-ai/dsh-llm' { interface MessageSourceMap { 'plugin:dsh-agent-team': {…} } }` | `llm/src/message.ts:110-136`; precedents `agent-team/src/types.ts:137-148`, `subagent/src/continuation-messages.ts:40-52` | USE. Runtime admits any non-empty `kind` (`session/src/index.ts:354-359`). |
| 13 | distinguish plugin vs human (read) | **PUBLIC** | `event.data.source.kind` on `user/message` via `ctx.on('session/event')` | `session/src/types.ts:309`; `session/src/index.ts:77`; human marker = `kind:'user' && rpcId` (`auto-review/src/index.ts:178-182`) | USE. |
| 14 | observe "message was claimed" + turn number | **PUBLIC, live only** | `agent/inbox/claimed {agent, message, turn}` | `runtime-types.ts:288-299`; emit site `inbox.ts:112` | USE. Not replayable after restart → durable fallback = fold. |
| 15 | observe turn start/end | **PUBLIC + durable** | `session/event`: `turn/start{turn}`, `turn/end{turn,reason}` | `session/src/types.ts:288,297`; `session/src/index.ts:77`; emit `agent.ts:305,385` | USE. `reason.kind==='aborted'` ⇒ Stop. |
| 16 | durable "is a turn open?" read | **PUBLIC** | `ctx.sessionProjections.stateOf(session,'turnBoundary').openTurnStartSeq` | `agent/src/types.ts:69-79`; fold `agent-loop/src/index.ts:57-95` | USE for restart reconciliation. |
| 17 | agent status / running | **PUBLIC** | `agent.status`; `agent/status` event; `api-session/status` | `runtime-types.ts:172,280`; `session-controller/src/types.ts:604` | USE (racy alone; use as hint). |
| 18 | detect user Stop | **PUBLIC** | `turn/end.reason = {kind:'aborted', cause:{kind:'user'}}` | `session/src/types.ts:189-194,214-221` | USE. |
| 19 | Stop preserves pending input? | behavior | Stop button `keepInbox:true`; archive-stop discards + splices | `session-controller/src/commands.ts:523`; `agent/src/archive-admission.ts:16-22,36` | ACCOUNT FOR IT: parked wake survives a Stop. |
| 20 | suppress auto-reactivation after Stop | **NO API / not a host concept** | host has no auto-reactivation; only the wake latch `wakeRequested` + "idle wake always opens a turn boundary" | `agent.ts:216-221,262`; `runtime-types.ts:206-210` | Plugin-side gate required. **GAP-G4** for the "already-idle wake cannot be recalled" edge. |
| 21 | detect archive / veto archive | **PUBLIC** | `ctx.workspaceRegistry.archivedSessionIds`, `archiveSession()`; `workspace/session-activity` (waterfall, can refuse), `workspace/session-stop` | `workspace/src/index.ts:113-147,342,363` | USE. |
| 22 | detect agent/session teardown | **PUBLIC** | `agent/disposed`, `session/disposed`, `api-session/removed` | `runtime-types.ts:270`; `session/src/index.ts:65`; `session-controller/src/types.ts:612` | USE. |
| 23 | `whenIdle` semantics | **PUBLIC** | loops `activityDone`; follows maintenance + released wakes | `agent.ts:237-241`; `runtime-types.ts:188-191` | **AVOID on the wake path** (whole-queue wait). |
| 24 | deadlock hazard: host awaits hooks | behavior | `agent/created` serial; `agent/pre-step` waterfall; `agent/turn-stopping` serial | `agent/src/index.ts:550`; `agent.ts:276,360`; prohibition `runtime-types.ts:252-254` | **CONSTRAINT**: subscribe to `emit` events only; never `whenIdle()` in an awaited hook. |
| 25 | live double-activation guard | **PUBLIC** | `enter()` throws `already registered` | `agent/src/index.ts:465-467` | USE. |
| 26 | cross-process per-session write lease | **PUBLIC (sharp edge)** | `ctx.sessionPersistence.open(id,'write')` → `SessionAlreadyOwnedError` | `session-persistence/src/index.ts:151-163`; `…-jsonl/src/lease.ts:70-115` | USE ONLY as a probe; the live Agent owns it. |
| 27 | generic per-session lease/fencing token | **NO PUBLIC API** | — | — | **GAP-G3** (buildable on #28; no host patch needed). |
| 28 | durable per-plugin checkpoint | **PUBLIC** | `ctx.storageDomain.open(defineDomain({…}))` → `KvTable.put/update/delete/entries`, `domain.global`; `domain/changed` event | `storage-domain/src/index.ts:35-39,101`; `spec.ts:107`; `domain.ts:42-95`; `events.ts:46` | USE — this is the scheduler's durable single-flight state. |
| 29 | durability barrier | **PUBLIC** | `await ctx.sessions.flush(session)` | `session/src/index.ts:1183-1210` | USE (this is what the glue's `ensureMaterialized` shim already calls). |
| 30 | message-id-keyed durable idempotency pattern | **PUBLIC precedent** | fold `user/message` + `agent/inbox/spliced`, match on `source.<producerField>` | `agent-team/src/session-message.ts:9-31`; `mailbox.ts:273-306` | USE verbatim as the restart-safe dedupe oracle. |

---

## GAPS — CORE_SEAM_BLOCKER candidates

Order = severity. **Conclusion up front: none of the Alpha.6 requirements is a hard `CORE_SEAM_BLOCKER` at 0.2.0-rc.2.** All three (acceptance-only, single-flight, attributable origin) are implementable with the public API plus two host *behaviors* that must be designed around, not patched. The items below are ranked by how close they come to that label.

* **GAP-G1 — no idempotency key on submit (SEVERE, but a gap-*shaped workaround* exists; NOT a blocker).**
  `followup/steer/inject/send` accept only a `UserMessage` and return `void` (`runtime-types.ts:215-241`). There is no "enqueue if no message with key K is outstanding" primitive, and no way to atomically check-and-enqueue.
  *Workaround (host-endorsed shape)*: mint a deterministic `MessageId` per wake slot → the host's own pending-uniqueness check throws `message "<id>" is already pending` (`inbox.ts:223-224`, mirrored in the durable fold `inbox.ts:43-48`), giving atomic in-process "already outstanding". For restart, recover the outstanding set durably by folding `user/message` + `agent/inbox/spliced` and matching a producer-owned source field — the exact algorithm upstream ships at `agent-team/src/session-message.ts:24-31` + `mailbox.ts:273-306`.
  *Residual risk (why it is listed)*: the uniqueness check covers **pending** messages only. Once a wake is *claimed*, the same id may be enqueued again even though the previous turn is still running; and two hosts in two processes each run their own check. ⇒ the durable fold (#30) plus a `KvTable` checkpoint (#28) are **mandatory**, not optional, for true single-flight.
* **GAP-G2 — no wake coalescing / no "collapse N pending wakes into one turn" (SEVERE behavior gap, NOT a patch blocker).** The driver drains pending input back-to-back, one `next-turn` message per turn (`agent.ts:252-254`, `:390`; `inbox.ts:110-111`). If the plugin ever lets two wakes coexist, the leader runs twice; the host will not help. Mitigation is purely plugin-side dedupe + optional `inbox.remove` of the loser (`runtime-types.ts:84`). A host-side "collapse equal-source pending wakes" would be nice-to-have, never required.
* **GAP-G3 — no public per-session lease / fencing / multi-writer arbitration (MODERATE; buildable, not a host patch).** `ctx.agents.get` is unguarded (#1); the only owner concepts are registry collision (#25), the durable flock write lease (#26, held by the live agent — a plugin cannot take it without evicting the agent), and `isOwnedBy` (graph inspection). Two writers of one root must be arbitrated by plugin-authored state in `storageDomain` (#28) or by the team's existing ownership module. Flag it, but do not open a CORE_SEAM_BLOCKER: nothing in Alpha.6 needs the host to arbitrate.
* **GAP-G4 — a wake already handed to an idle agent cannot be recalled (MODERATE).** `remove()` only touches *pending* messages (`runtime-types.ts:84`), and "a wake submitted while already idle always opens its turn boundary even when its message is cleared before the driver claims it" (`runtime-types.ts:206-210`). So Stop-after-submit can still cost one empty turn (which then ends `reason:{kind:'completed'}` with no work — `agent.ts:324-326`). No public API withdraws a *wake request* (as opposed to the message). Design consequence: the scheduler must gate *before* `followup`, never plan to un-wake afterwards.
* **GAP-G5 — message source kinds have no registry/validation of producer identity (LOW).** Admission is "non-empty string" (`session/src/index.ts:354-359`); nothing stops a second plugin writing `kind:'plugin:dsh-agent-team'` or `kind:'user'`. Attribution is convention. (The only true human marker is the session-controller's `rpcId`, `session-controller/src/types.ts:403` — an absence check, not a signature.) Cosmetic; recommend a producer-owned kind carrying `{ requestId, teamRootSessionId, messageId }`.
* **GAP-G6 — `agent/inbox/claimed` is not durable (LOW).** The message↔turn binding exists only as a live event (`inbox.ts:112`); `user/message` carries no `turn` field (`session/src/types.ts:309`). Post-restart reconciliation must fold the log or use the `turnBoundary` projection (#16). Not a blocker — the fold is small and upstream provides the code.
* **GAP-G7 — no cold-session pending-inbox read API (LOW).** The `inbox` projection is driven for live sessions only (`inbox.ts:177-188` fails loud without an active write handle); cold reads need the manual fold. Cosmetic.
* **Explicit NON-gaps, to stop re-litigation:** plugin-attributed origin (B5 — closed), claim/turn-end observability (B6 — closed), durable plugin state (B9 — closed), archive/stop detection (B7 — closed), remove-by-id (B4 — closed), resume (B7-iii — closed). The three Alpha.6 violations in B10 are **all** plugin-side code choices, and two of them are already solved elsewhere in the same glue file (`agent-bindings.mjs:5203-5256`).

### UNVERIFIED

* **U1** — whether the plugin loader (as configured in the shipped web profile) imposes any *additional* isolation (Cordis `isolate`/`intercept`, `vendor/cordis/src/context.ts:22-31`) on the team plugin's `Context` such that `ctx.agents` is a filtered view. The type-level and registry-level code imposes none; I did not trace the production profile's isolation table. Affects #1/#12 only in principle.
* **U2** — exact wire behaviour when a client renders a `user/message` with an unknown `source.kind` (client UI message-source rendering surface was not located; grep over `packages/client`/`packages/web` for `source.kind` produced no rendering hits). Read-side attribution is verified at the log/event layer; UI presentation of a `plugin:*` kind is **UNVERIFIED**.
* **U3** — whether `agent/compaction-start` (`runtime-types.ts:249`) is dispatched by the rc.2 loop and whether it too is awaited; I confirmed the awaited-hook set for `created`/`pre-step`/`turn-stopping`/`request`/`tools/pre-execute` only.
* **U4** — behavior of `steer` on a subagent-addressed session (`session-controller/src/types.ts:406-413` `SessionAddress.kind==='subagent'`) — the team plugin addresses roots and members; I did not verify the subagent steering path (`steerHostSubagentPrompt` is imported from the **internal** subpath `@deepseek-ai/dsh-subagent/internal` at `packages/experimental/agent-team/src/mailbox.ts:12`, i.e. upstream itself uses an internal seam there).
* **U5** — the Alpha.6 S0 requirement text itself: no Alpha.6 plan document was found in this repo (`.artifacts/alpha6-s0/` contained only `D-ci-and-resource-isolation.md` + logs at audit time), so requirements (i)/(ii)/(iii) are taken as stated in the audit brief, not from a repo source of truth.

---

## Appendix — INTERNAL / not plugin-reachable (do not use)

| item | status |
| --- | --- |
| `@deepseek-ai/dsh-subagent/internal` (`steerHostSubagentPrompt`) | internal subpath; used by upstream `agent-team` but not a supported plugin seam |
| `ReactLoopAgent`, `ReactLoopInbox`, `Phase`, `InboxCoordinator` | exported from `@deepseek-ai/dsh-agent-loop` for driver providers/focused tests — **do not construct**; plugins consume the `Agent`/`Inbox` interfaces from `@deepseek-ai/dsh-agent` |
| `Session` append publication hooks / `collectSessionCallbacks` | module-private (`packages/core/session/src/index.ts:686-689`) — use `ctx.on('session/event')` |
| `sessionPersistence` write handle for a live session | owned by the live Agent (`lease.ts`); a plugin taking it evicts the agent |
| `AgentRegistry.enter` / `announce` | public but factory-internal in practice (`:459`, `:537`) — use `create`/`resume`/`register` |
