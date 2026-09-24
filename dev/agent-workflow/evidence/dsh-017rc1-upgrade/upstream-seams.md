# U0.4 — Upstream public-seam inventory: DSH 0.1.5-rc.2 → 0.1.7-rc.1 (dsh-agent-team)

- **Date:** 2026-09-24
- **0.1.7-rc.1 reference:** tag `dsh-v0.1.7-rc.1` (official publish point, PR #5073), commit `46a7f68b0922371ce7144b668b90e377d8e799f4`
  - Tree: `/home/user/dsh-plugins/dsh-agent-team/tests/deepseek-harness-test-use` @ HEAD `46a7f68b09` (verified; pristine, unmodified)
- **0.1.5-rc.2 reference:** commit `fb2c4b9e69` (read-only via `git show fb2c4b9e69:<path>`; no checkout performed)
- **Method:** every 0.1.7 fact is quoted from the `src/` of the 0.1.7 tree (with `file:line`); every 0.1.5 fact from `git show fb2c4b9e69:<path>`. Stale `lib/` build artifacts of 0.1.5 inside the 0.1.7 worktree are **ignored** (they still document e.g. `agent/session-start` and would mislead). Plugin consumption = grep of `.worktrees/dsh-017rc1-upgrade` `packages/*/src` + root `cordis.patch.yml` (test/characterization files noted as records only). npm-registry facts cited from `registry.npmjs.org` package JSON (fetched 2026-09-24). No memory/release-notes inference; anything not verifiable is listed in §UNVERIFIED.

## Summary table

| Seam | Verdict | 0.1.7 package / path | Plugin consumption (src) | One-line upgrade impact |
|---|---|---|---|---|
| `agents.create` | CHANGED (docs/sequence; signature same) | `@deepseek-ai/dsh-agent` — `packages/core/agent/src/index.ts:391` | `runtime/src/plugin/live/agent-bindings.mjs` :2406,:2457,:2481,:2736 | Call shape unchanged; setup now completes before the awaited serial `agent/created` (stronger ordering) |
| `agents.resume` | CHANGED (docs; signature same) | `@deepseek-ai/dsh-agent` — `packages/core/agent/src/index.ts:410` | `agent-bindings.mjs` :2283,:2388,:2467,:2525,:2728 | Same as create; resume announce is awaited serial |
| `agent/created` | CHANGED (sync → async serial; payload +`source`+`signal`) | `@deepseek-ai/dsh-agent` — `packages/core/agent/src/index.ts:537,550-554`; `src/runtime-types.ts:125,261` | none (no `ctx.on('agent/created')` in plugin src) | If a listener is ever added it is awaited and can veto create/resume; payload now carries `source: 'startup'\|'resume'\|'clear'\|'compact'` |
| `session/created` | SAME | `@deepseek-ai/dsh-session` — `packages/core/session/src/index.ts:53,1134` | none | No action |
| `session/event` | SAME | `@deepseek-ai/dsh-session` — `packages/core/session/src/index.ts:75,757` | none | No action |
| `agent/session-start` | **ABSENT** | gone; replacement = `agent/created` payload `source` (public) | none | No code to migrate (never consumed); record the replacement for any future listener |
| `agentPresets.list/resolve/mount/composeFrom/composedPreset` | CHANGED (package split, class rename, methods removed/added) | `@deepseek-ai/dsh-agent-preset-registry` — `packages/preset/agent-preset-registry/src/index.ts` | `runtime/src/plugin/host.ts:785-810` (lazy `ctx.get('agentPresets')` → `mount`+`composedPreset`); `agent-bindings.mjs:1522-1556,1681` | `mount/composedPreset` call shape compatible; registry now `inject = ['loader','sessionProjections']` (host must provide projections); `roots/authorable/read/copy/remove` gone; new `register`/`acquireScope` |
| `remote.agentPresets.list` | CHANGED (roster shape) | `packages/preset/agent-preset-registry/src/index.ts:176-183`; `src/types.ts:12-31`; `src/preset.ts:5-12` | `client/src/plugin/team-mount-core.ts:326,636`; frozen `TeamAgentPresetRow`/`TeamAgentPresetsListResult` | `trust` removed, `authorable` → `modeSelectionEnabled`, `order` now on the wire → client roster mapping + frozen types must change |
| Preset registration authority | CHANGED (dir model → plugin-composition YAML) | `packages/preset/agent-preset/src/index.ts` (declaration plugin); `packages/bundle/web-app/cordis.patch.yml:540-545` + `presets/*.patch.yml` | none (plugin authors no presets; own composition stays in its root `cordis.patch.yml`) | `$DSH_HOME/.agent-presets/<id>/agent.cordis.yml` no longer exists in 0.1.7; presets are Cordis YAML rows of `@deepseek-ai/dsh-agent-preset` |
| `sessionProjections` | SAME | `@deepseek-ai/dsh-session-projection` — `packages/session/session-projection/src/index.ts:208` | none directly (now transitively required: preset registry `inject` includes it) | No action; host world must register it for the preset row |
| `sessionQuery` | SAME (consumed methods byte-identical) | `@deepseek-ai/dsh-session-query` — `packages/session-query/session-query/src/index.ts:106,251,310` | `runtime/src/plugin/root.ts:591-599,1327-1352,1845`; port `SessionQueryPort` (`handoff-surface.ts:85-98`) = `readSurface`+`readTitleSnapshots` | Compatible; note `SurfaceEventType` gained `developer/message` (V4) |
| `snapshotEvents`/`eventAt`/`ownEvents` | CHANGED (all three `@deprecated` in 0.1.7) | `@deepseek-ai/dsh-session` — `packages/core/session/src/index.ts:633,647,664` | `agent-bindings.mjs:453,522-536` (WORK-delivery read via `Session.ownEvents`) | Existing call still works; new calls prohibited; schedule migration (readSurface/projections) |
| Session log V3 → V4 | CHANGED (format version, new event types, new migration package) | `packages/core/session/src/types.ts:89`; `packages/session/session-format/src/filename.ts:16`; new `packages/session/session-format-v3-to-v4/` | none (plugin never parses log format; event-scan keys unchanged) | Old team worlds migrate on read (`session.v4.jsonl`); V4 adds `developer/message`, `forked`, lifted `toolCallId`, `error` field |
| `storageDomain` | SAME | `@deepseek-ai/dsh-storage-domain` — `packages/storage/storage-domain/src/index.ts` (byte-identical) | `runtime/src/plugin/host.ts:662` (hard inject), `:1119-1144` | No action |
| `spillStore` | SAME | `@deepseek-ai/dsh-spill` — `packages/spill/spill/src/index.ts:45-56` (byte-identical) | `runtime/src/plugin/team-spill-local.ts` (extends LocalSpillStore) | No action |
| `LocalSpillStore` | SAME | `@deepseek-ai/dsh-spill-local` — `packages/spill/spill-local/src/index.ts:65,66-69,83,149` (byte-identical) | `team-spill-local.ts` (`TeamAwareLocalSpillStore`) | No action |
| `SaveTextSpill` / `SpillRef` | SAME | `@deepseek-ai/dsh-spill` — `packages/spill/spill/src/types.ts` | `team-spill-local.ts:116` (`override saveText`), `artifact-grant-bridge.ts` | No action |
| `SpillSource` | SAME (still exactly 2 arms — no new arms) | `packages/spill/spill/src/types.ts:46-60` | `team-spill-local.ts:82-87` (exhaustive 2-arm switch + drift guard) | Drift guard will not fire; no change |
| spill-policy | CHANGED (`maxInlineBytes` → `maxInlineTokens`) | `@deepseek-ai/dsh-spill-policy` — `packages/spill/spill-policy/src/index.ts:26-31`; base bundle `packages/bundle/base/cordis.patch.yml:409` | none (plugin sets no spill-policy config) | Base default moves to `maxInlineTokens: 12500` (was `maxInlineBytes: 50000`); retention threshold semantics change (tokens, not bytes) |
| `@deepseek-ai/dsh-mcp-client` | CHANGED (MCP SDK v2, new exports, new optional config) | `packages/mcp/mcp-client/` — deps: `@modelcontextprotocol/client 2.0.0`; `src/index.ts:52,80,104`; `src/tools.ts:225`; `src/connection.ts:364-385` | `agent-bindings.mjs:328,1122` (`ctx.plugin(mcpClient, { transport:'streamable-http', serverName, url, headers, toolCallTimeoutMs, failOnStartupError })`); `runtime/package.json:21` already pins `0.1.7-rc.1` | Mount call still valid (fields all present); SDK swap is internal; new `createMcpToolDefinition`/`maxInstructionBytes`/resource pagination available but unused |
| Client sessions (multi-instance) | CHANGED (`open`/`clear`/`list.current` removed → ref-counted `retain`/`using`/`retainInfo`) | `@deepseek-ai/dsh-session-controller` (client) — `packages/api/session-controller/src/client/contract/sessions.ts:49,58,66,71`; `client/index.ts:80-88`; `client/sessions/service.ts:54` | `client/src/plugin/team-mount-core.ts:518,540,589` (`ctx.sessions.open`), `:571-572,843` (`.list.getSnapshot().current`), frozen `TeamSessions` port | **Breaks**: `open()` and `list.current` no longer exist → remap to `retain(target,{source})`/`using(...)` (+ new client source via declaration merge) |
| Plugin client support packages | CHANGED (minor, one breaking rename) | `@deepseek-ai/dsh-client-store` SAME; `-ui-slots` superset; `-locale` SAME; `-connection` (client side) SAME; `-ui-primitives` icon rename; `-ui-conversation` additive; `-ui-sidebar` SAME | `client/src/ui/*.tsx` (11 files) + `team-mount-core.ts` | **Breaks**: `IconUserOutline16` → `IconUserOutlineRegular`/`IconUserOutlineMedium` (`NewTeamEntry.tsx:24`); rest compatible |
| Plugin install/launch DSH version check | CHANGED (new in 0.1.7) | `packages/boot/app-boot/src/plugin-compatibility.ts`, `profile-compatibility.ts`, `compatibility-preflight.ts`; enforcement at preset mount `packages/preset/agent-preset-registry/src/mount.ts:263` + `packages/boot/plugin-manager/src/{operations.ts:291,423,index.ts:301,546,722}`; CLI `dsh plugin allow-version` (`apps/cli/src/plugin.ts:13-46`) | plugin `runtime/package.json` declares dsh deps as exact `0.1.7-rc.1` in `dependencies`/`devDependencies`, **empty `peerDependencies`** | No exemption needed today (check scans peerDependencies only); if dsh deps move to `peerDependencies` they must satisfy the host runtime or be exempted |
| Source launch / linked local plugin module resolution | CHANGED (new resolution layer in 0.1.7) | `packages/boot/app-boot/src/profile-resolution/resolver.ts:516-555` (`routeLinked`); docs `.agents/notes/implemented/architecture/2026-09-19-profile-resolution-lookup-order.md` | dsh-agent-team is itself a linked local plugin in dev worlds | Linked plugin's declared dsh **peers** now resolve to the running installation's copy (single instance) — favorable for the 0.1.7 linked upgrade; keep dsh deps declared as peers per the 0.1.7 dev guide |

---

## 1. Core agent lifecycle

### 1.1 `agents.create` — CHANGED (docs/sequence; signature identical)

0.1.7 (`packages/core/agent/src/index.ts`):
```ts
391:  async create(options: CreateAgentOptions): Promise<AgentHandle> {
```
0.1.5 (`git show fb2c4b9e69:packages/core/agent/src/index.ts`):
```ts
388:  async create(options: CreateAgentOptions): Promise<AgentHandle> {
```
`AgentHandle` (0.1.7 index.ts:160-163, same in 0.1.5):
```ts
export interface AgentHandle {
  agent: Agent
  dispose(): Promise<void>
}
```
`CreateAgentOptions` fields are unchanged between versions: `sessionId`, `parentAgent?`, `meta?` (`cwd?/parentSession?/isSeeded?/origin?:'subagent'/delegationDepth?/agentPreset?`), `inheritedEventCount?`, `agentOptions?`, `signal?`, `setup?: AgentSetup`. `AgentSetup` type unchanged (index.ts:51-54 in both).

**Delta (0.1.7):**
- Factory JSDoc (index.ts:175-188 vs 0.1.5 :172-185): creation now explicitly "…awaits serial `agent/created` listeners before releasing queued work. The sequence is rollback-covered, but notifications delivered before a later listener failure remain observable…".
- Setup JSDoc (index.ts:100-116 vs 0.1.5 :101-117): the pre-event ordering line loses `agent/session-start` — "Everything registered through `agentCtx` … exists before `session/created`, `agent/created`, and the first prompt assembly."
- Consequence: the `setup` callback now fully settles **before** the awaited serial `agent/created` announce (see 1.3); observers can no longer see a world mid-setup, and a failing serial listener rejects `create()`.

**Plugin consumption:** `runtime/src/plugin/live/agent-bindings.mjs` — `agents.create` at :2406 (subagent mint), :2457/:2481 (member create paths), :2736 (formal create-and-start primitive); all call with the same options object shape (`sessionId`, `parentAgent`, `meta`, `agentOptions`, `setup`). No signature change required.

**U2–U6 notes:** no code change; characterization tests that assert event *ordering* around create must account for the awaited serial announce (setup strictly before `agent/created` is now guaranteed).

### 1.2 `agents.resume` — CHANGED (docs; signature identical)

0.1.7 index.ts:410 vs 0.1.5 index.ts:407 — identical `async resume(options: ResumeAgentOptions): Promise<AgentHandle>`. Delta is the same JSDoc/sequence change (resume now opens/repairs the persisted log — which in 0.1.7 may be V3 and gets migrated, see §5 — and awaits the serial announce).

**Plugin consumption:** `agent-bindings.mjs` :2283 (member re-attach after idle), :2388 (resume path), :2467/:2525 (member resume branches), :2728 (retry re-attach through the same setup).

### 1.3 `agent/created` — CHANGED (sync → async serial; payload enlarged)

0.1.5 (`git show fb2c4b9e69:packages/core/agent/src/index.ts`):
```ts
533:  announce(agent: Agent): void {
      ...
545:    this.ctx.events.dispatch('emit', [carrier, 'agent/created', { agent }])   // sync emit
```
(sync dispatch: a synchronous listener throw vetoes publication; a rejected promise from a listener is only *logged as a warning*.)

0.1.7 (`packages/core/agent/src/index.ts`):
```ts
537:  async announce(agent: Agent, source: SessionStartSource, signal?: AbortSignal): Promise<void> {
      ...
550-554:   await this.ctx.serial(entry.carrier, 'agent/created',
                { agent, source, ...signal })     // Cordis async serial dispatch
```
**Await semantics (0.1.7):** `ctx.serial` runs listeners in order, awaiting each; a listener that throws or rejects **rejects `announce`**, and therefore rejects `create`/`resume`/`register` (veto now covers async listeners too). `register()` itself now awaits: 0.1.7 index.ts:440 `await this.announce(agent, 'startup')` vs 0.1.5 index.ts:434 `this.announce(agent)`.

Event contract (0.1.7 `packages/core/agent/src/runtime-types.ts`):
```ts
125: export type SessionStartSource = 'startup' | 'resume' | 'clear' | 'compact'
261: 'agent/created'(this: Scoped<Agent>, payload: { agent: Agent; source: SessionStartSource; signal?: AbortSignal }): undefined | Promise<undefined>
```
(0.1.5 contract: payload `{ agent }`, return `void`.)

Source values on the factory paths (0.1.7 `packages/core/agent-loop/src/index.ts`): create → `prepared.publish('startup')` (:664, :744); resume → `'resume'` (:879). `'clear'`/`'compact'` are the in-session re-drive sources.

First-party consumer pattern (the model for any listener): `packages/goal/goal/src/index.ts:255` — `ctx.on('agent/created', ({ agent }) => { ... })`.

**Plugin consumption:** none — grep of plugin src+tests finds zero `ctx.on('agent/created')`.

**U2–U6 notes:** if a team listener is ever added, it is now *awaited* (must not block on I/O longer than creation should take) and its rejection fails agent creation.

### 1.4 `session/created` — SAME

0.1.7 `packages/core/session/src/index.ts`:
```ts
53:   'session/created'(this: Scoped<Session>, session: Session): void
1134: const callbacks = collectSessionCallbacks(this.ctx, [entry.carrier, 'session/created', session])
```
Emit is synchronous inside `announce(session)`; a synchronous throw vetoes publication, an async listener rejection is logged (`session "…": session/created listener rejected: …`, index.ts:1140-1147). 0.1.5: declaration :50, emit :1095 — identical mechanism. **Plugin consumption:** none.

### 1.5 `session/event` — SAME

0.1.7 index.ts:
```ts
75:   'session/event'(this: Scoped<Session>, session: Session, event: SessionEvent): void
757:  callbacks = collectSessionCallbacks(entry.emitCtx, [entry.carrier, 'session/event', ...callbackArgs])
762:  invokeContainedSessionObservers(entry.emitCtx, 'session/event', entry.id, callbackArgs, callbacks)
```
0.1.5: declaration :72, emit :740 — identical. **Plugin consumption:** none.

### 1.6 `agent/session-start` — **ABSENT**

- 0.1.5 emit site: `git show fb2c4b9e69:packages/core/agent-loop/src/index.ts:675` — `emitAgentEvent(loopCtx, agent, 'agent/session-start', { source })`.
- 0.1.7: no emit site anywhere in `src/`, and no declaration in the dsh-agent event contract (grep of `packages/core/agent/src`, `packages/core/agent-loop/src` returns zero). The only occurrences in the 0.1.7 worktree are stale `lib/` build artifacts (ignored per method).
- **Closest public replacement:** the `agent/created` payload field `source: SessionStartSource` (`'startup' | 'resume' | 'clear' | 'compact'`) — the same source vocabulary the old event carried in `{ source }`, now delivered serially and awaited at creation/resume. First-party consumer: `packages/goal/goal/src/index.ts:255`.
- **PRIVATE_ONLY: NO** — the replacement is a public event payload field.
- **Plugin consumption:** none (zero occurrences in plugin src/tests) → nothing to migrate.

---

## 2. Preset / profile

### 2.1 `agentPresets.list/resolve/mount/composeFrom/composedPreset` — CHANGED

**0.1.5** (single package `@deepseek-ai/dsh-agent-presets`, `packages/preset/agent-presets/`):
`class AgentPresets extends TypertRemoteService` (`super(ctx, 'agentPresets')`); methods: `list()`, `@Remote('list') remoteExportList()`, `compositionInventory()`, `resolve(id?)`, `mount(agentCtx, id?)`, `composeFrom(agentCtx, parentCtx)`, `composedPreset(agentCtx)`, `roots()`, `authorable`, `read(id)`, `@Remote('read') readDocument`, `copy(...)` / `@Remote('copy')`, `remove(...)` / `@Remote('deletePreset')`, `serviceFor(agent, name)`, `recompose(agentCtx, id)`, `@Remote('select') select(agent, agentPreset)`.

**0.1.7** (package split):
- `@deepseek-ai/dsh-agent-preset` (`packages/preset/agent-preset/src/index.ts`, 30 lines) — the *declaration* plugin: `static inject = ['agentPresets']`; `Config = z.object({ id: z.string().required(), name?, description?, order?: z.number().int(), plugins: z.array(z.any()).required() })`; `async* [Service.init]() { yield await this.ctx.agentPresets.register(this.config) }`.
- `@deepseek-ai/dsh-agent-preset-registry` (`packages/preset/agent-preset-registry/src/index.ts`) — `class AgentPresetRegistry extends TypertRemoteService`, `super(ctx, 'agentPresets')`, `static inject = ['loader', 'sessionProjections']`, `static Config = z.object({ default: z.string().required(), selectedDefault: z.string().volatile(), modeSelectionEnabled: z.boolean().default(true).volatile() })`.

0.1.7 registry method map (with lines):
```
86:   async register(definition: PresetDefinition): Promise<() => Promise<void>>        (NEW)
159:  async list(): Promise<AgentPreset[]>
176:  @Remote('list') async remoteExportList(): Promise<AgentPresetRoster>
187:  async resolve(id?: string): Promise<AgentPreset>
200:  @Remote('read') readDocument(agentPreset: string): Promise<AgentPresetDocument>
264:  async mount(ctx: Context, id?: string): Promise<AgentPreset>
280:  composeFrom(ctx: Context, parent: Context): string | undefined
297:  composedPreset(ctx: Context): string | undefined
313:  async recompose(ctx: Context, id: string): Promise<AgentPreset>
325:  @Remote('select') async select(agent: Agent, agentPreset: string): Promise<string>
347:  async acquireScope(id?: string): Promise<{ key: ScopeKey } & AsyncDisposable>      (NEW)
361:  compositionInventory(): Promise<AgentPresetComposition[]>
```
`mount` (0.1.7 index.ts:264-273) still takes the setup callback's agent context, returns `Promise<AgentPreset>` = `{ id, name?, description?, order?, broken? }` (`src/preset.ts:5-12`) — the plugin reads `.id`. `composeFrom`/`composedPreset` signatures keep their two-context shape.

**Removed in 0.1.7:** `roots()`, `authorable`, `read(id)`, `copy`, `remove`, remotes `copy`/`deletePreset` (user-authoring moved to profile patches, see 2.3).
**Added in 0.1.7:** `register(definition)`, `acquireScope(id?)`; `select` now validates a turn boundary via `sessionProjections.stateOf(agent.session, 'turnBoundary')` and appends an `agent-preset/selected` event (index.ts:325-345).

**npm status (registry.npmjs.org, fetched 2026-09-24):** `@deepseek-ai/dsh-agent-presets` last published `0.1.5-rc.3` (2026-09-22, dist-tag `next`) — **not published for 0.1.6/0.1.7 (discontinued)**. New packages `@deepseek-ai/dsh-agent-preset` and `@deepseek-ai/dsh-agent-preset-registry` both published `0.1.7-rc.1` (2026-09-23).

**Plugin consumption:**
- `runtime/src/plugin/host.ts:785-810` — lazy accessor: `ctx.get('agentPresets')` per call, exposes `mount(agentCtx, presetId?)` and `composedPreset(agentCtx)`; fail-closed `TEAM_PLUGIN_SERVICE_MISSING` if absent. Deliberately NOT in the hard inject array.
- `runtime/src/plugin/live/agent-bindings.mjs:1522-1556, 1681` — calls `mount` inside the agent `setup` callback (agentPresets is an optional glue dep).
- Records (test-only): `runtime/test/issue2-real-preset-restriction.test.ts:72-73` imports `AgentPresets` from `@deepseek-ai/dsh-agent-presets` (**package gone in 0.1.7 → import breaks**, test-only); `createAgentPresetsDouble()` in many runtime tests (local doubles, fine); `runtime/test/t12a-live-bridge.mjs:1072-1092`.
- `client/src/plugin/client.ts:33` (wires `remote.agentPresets`).

**U2–U6 notes:** no change needed to the two consumed methods; the test importing the old package must be rewritten (U-later task, not U2-U6 blocking). New host-world requirement: the preset registry row now injects `sessionProjections` and `loader`, so the 0.1.7 world must have them (it does: base bundle ships both).

### 2.2 `remote.agentPresets.list` — CHANGED (roster shape)

0.1.5 wire (git show …/agent-presets/src/index.ts:261-275):
```ts
@Remote('list')
async remoteExportList(): Promise<AgentPresetRoster> {
  const defaultId = this.defaultId
  return {
    presets: (await this.list()).map(preset => ({
      id: preset.id,
      trust: preset.trust,                    // 'system' | 'user'
      isDefault: preset.id === defaultId,
      ...preset.name === undefined ? {} : { name: preset.name },
      ...preset.description === undefined ? {} : { description: preset.description },
      ...preset.broken === undefined ? {} : { broken: preset.broken },
    })),
    authorable: this.authorable,
  }
}
```
0.1.7 wire (`packages/preset/agent-preset-registry/src/index.ts:176-183`, verbatim):
```ts
@Remote('list')
async remoteExportList(): Promise<AgentPresetRoster> {
  const policy = this.policy()
  return { presets: (await this.list()).map(row => ({ ...row, isDefault: row.id === policy.defaultId })),
    modeSelectionEnabled: policy.enabled }
}
```
where `list()` rows are `{ id, name?, description?, order?, broken? }` (index.ts:159-171) — i.e. the 0.1.7 **wire row** is `{ id, name?, description?, order?, broken?, isDefault }` (note `order` is now on the wire via the spread; 0.1.5 deliberately omitted it), and **`trust` is gone**.

0.1.7 declared types (`src/types.ts`):
```ts
12-22: export interface AgentPresetRow {
        readonly id: string
        readonly isDefault: boolean
        readonly name?: string
        readonly description?: string
        readonly broken?: string
      }
24-31: export interface AgentPresetRoster {
        readonly presets: readonly AgentPresetRow[]
        readonly modeSelectionEnabled: boolean
      }
```
(`order` is present at runtime but not in the declared row type.)

**Plugin consumption (client):** `client/src/plugin/team-mount-core.ts:326` injects `remote.agentPresets`; `:636` calls `ctx.remote.agentPresets.list()`, unwraps the RemoteResult, filters `broken` rows, maps to `{ id, name, description, isDefault }`. Frozen types in the same file: `TeamAgentPresetRow { id, trust: 'system'|'user', name?, description?, isDefault, broken? }` and `TeamAgentPresetsListResult.value: { presets, authorable }` — **both stale**: `trust` no longer arrives, `authorable` no longer exists (use `modeSelectionEnabled`), `order` is newly available.

**U2–U6 notes:** client roster mapping + frozen types are a client-side change (U4/U5 client task), not a runtime task.

### 2.3 Preset registration authority — CHANGED (directory model → plugin-composition YAML)

0.1.5 (`git show fb2c4b9e69:packages/preset/agent-presets/src/discovery.ts`): `COMPOSITION_FILE = 'agent.cordis.yml'`, `USER_PRESET_DIR = '.agent-presets'` (user presets = `<id>/agent.cordis.yml` under roots incl. `$DSH_HOME/.agent-presets/`), `SHIPPED_PRESET_ROOT`; discovery scans those roots.

0.1.7: the directory model is gone — grep of all 0.1.7 `src/` finds **zero** `.agent-presets` occurrences. A preset is now one **Cordis YAML row** that loads `@deepseek-ai/dsh-agent-preset` with a `PresetDefinition` config (`packages/preset/agent-preset-registry/src/definition.ts`: `{ id, name?, description?, order?: number, plugins: readonly EntryOptions-like[] }`), registered into the `agentPresets` registry service via `register()`. Host-shipped presets: `packages/bundle/web-app/cordis.patch.yml:540-545` (registry insertion, `config: { default: standard }`) plus `packages/bundle/web-app/presets/{standard,ptc,minimal,cordis}.patch.yml` — e.g. standard:
```yaml
- id: preset-standard
  name: '@deepseek-ai/dsh-agent-preset'
  config: { id: standard, order: 1, plugins: [persona, agent-instructions, tool-bash, ...] }
```
(file comment: "Edits saved from the Web editor override this row's `config.plugins` by id from the profile patch" — i.e. user authoring now happens through profile patches, not `$DSH_HOME` preset dirs).

**Plugin consumption:** none — the plugin never authors presets; its own composition stays in the plugin's root `cordis.patch.yml` (bundle-manifest row). No action.

---

## 3. Session data plane

### 3.1 `sessionProjections` — SAME

`packages/session/session-projection/src/index.ts` — `SessionProjectionRegistry`, `super(ctx, 'sessionProjections')` (:208). Public methods identical in 0.1.5 and 0.1.7: `register` (overloads, :233-253), `stateOf` (:319), `onChanged`, `snapshot`, `cachedSnapshot`, `checkpoint`, `restoreFloor`, `viewCheckpoint`, `restore`, `hydrate`.
Context: `.agents/notes/implemented/architecture/2026-09-09-deprecate-synchronous-session-event-reads.md` names session projections (restored at resume) as the official replacement for the deprecated sync readers (§3.3).
**Plugin consumption:** none directly. Indirect: the 0.1.7 preset registry injects `sessionProjections` (`static inject = ['loader', 'sessionProjections']`), so it must be registered in any world that mounts presets — satisfied by the 0.1.7 base bundle.

### 3.2 `sessionQuery` — SAME (plugin-consumed methods verified identical)

`packages/session-query/session-query/src/index.ts` — `super(ctx, 'sessionQuery')` (:106). Public surface:
```ts
0.1.7: 140: observeSession(...)
        174: listSessions(signal?: AbortSignal): Promise<SessionRecord[]>
        251: async readTitleSnapshots(sessionIds: readonly SessionId[], signal?: AbortSignal): Promise<SessionTitleObservationResult[]>
        310: async readSurface(sessionId: SessionId): Promise<SessionSurfaceSnapshot>
0.1.5: same four methods (readTitleSnapshots :249, readSurface :308) — signatures byte-identical
```
Internal refactor to a `SessionCorpus` (`load`/`projectMany`) — not public.
**Plugin consumption:** `runtime/src/plugin/root.ts:591-599` (`getSessionQuery` port on the Root config), `:1327-1341` (lazy `resolveSessionQuery`, duck-checks `readSurface` is a function), `:1342-1352` (fail-closed `TEAM_HANDOFF_SOURCE_SURFACE_UNAVAILABLE`), `:1845` (handoff surface freeze). Port `SessionQueryPort` (`runtime/src/plugin/handoff-surface.ts:85-98`) = `readSurface(sessionId)` + `readTitleSnapshots(sessionIds)` — both present in 0.1.7 with identical signatures → **compatible, no change**.
**Note (V4):** `SurfaceEventType` (0.1.7 `packages/core/session/src/types.ts:439-445`) = `{ 'system/message', 'developer/message', 'user/message', 'assistant/message', 'tool/result' }` — 0.1.5 (:412-417) lacked `'developer/message'`. Handoff surface reads of V4 sessions may now contain `developer/message` events; the plugin digest's default branch maps unknown/non-prose events to `''`, so behavior stays safe (record for U-later digest review).

### 3.3 `snapshotEvents` / `eventAt` / `ownEvents` — CHANGED (all `@deprecated` in 0.1.7)

0.1.7 `packages/core/session/src/index.ts`:
```ts
633: eventAt(...)      @deprecated Existing logic may remain unmigrated for now, but new calls are prohibited.
647: snapshotEvents()  @deprecated (same text + Agent Note link)
664: ownEvents()       @deprecated (same text + Agent Note link)
```
0.1.5: same three methods at :621/:633/:648 **without** deprecation. The decision note (`.agents/notes/implemented/architecture/2026-09-09-deprecate-synchronous-session-event-reads.md`): all three sync readers deprecated, new wrappers prohibited; replacement = durable event fields + session projections restored at resume + explicit async pagination for on-demand history. Upstream's own internal call (`index.ts:1243`, fork snapshot read) keeps an `oxlint-disable typescript/no-deprecated — migration deferred`.
**Plugin consumption:** `runtime/src/plugin/live/agent-bindings.mjs:453` (comment) and `:522-536` — the WORK-delivery boundary reads the member child's session through `Session.ownEvents` (duck-typed: `typeof session.ownEvents === 'function'`, fail-closed `WORK_REPLAYED`-adjacent error if absent), then scans for `turn/start` / `turn/end` / `user/message` (requestToken prefix) to build the frozen `WorkDeliveryResult`. **Existing call → still works in 0.1.7** (the method remains; deprecation bans only *new* calls).
**U2–U6 notes:** migration of this read (to `sessionQuery.readSurface` or projections) is a future task; not U2–U6 blocking, but it must be noted in the upgrade plan as "known deprecated call, migration deferred" — mirroring upstream's own treatment.

### 3.4 Session log V3 → V4 — CHANGED

- Version constant: 0.1.7 `packages/core/session/src/types.ts:89` — `export const SESSION_FORMAT_VERSION = 4` (0.1.5 :88 — `= 3`).
- Filename: `packages/session/session-format/src/filename.ts:16` (identical both versions) — `generation === 0 ? 'session.jsonl' : \`session.v${generation}.jsonl\`` → a V4 log is **`session.v4.jsonl`** (zstd via `packages/session/session-persistence-jsonl/src/generation.ts:748`).
- V4 envelope deltas (0.1.7 `packages/core/session/src/types.ts`):
  - NEW event `developer/message` with `{ turn?, step?, message, headerSeq? }` (new exported `DeveloperMessage` type; `MESSAGE_ROLES` adds `'developer/message': 'developer'`).
  - NEW `forked: { kind: 'forked' }` marker event (fork rewrite: `_forkBoundary`/`buildForkSeed`; the `OPEN_TURN` error path was removed).
  - `tool/result`: `toolCallId` lifted to the data top level.
  - NEW `error?: { name; code; reason? }` field on event data.
  - request/header: `system?: never` (system messages are now `system/message` events; the header no longer carries `system`).
- NEW migration package (0.1.7-only): `packages/session/session-format-v3-to-v4/` — `migration.ts`: `sessionFormatV3ToV4 = defineSessionFormatMigration({ name: '@deepseek-ai/dsh-session-format-v3-to-v4', fromVersion: 3, toVersion: 4, ... })`; `createSessionFormatV3ToV4(children)` requires explicit historical child facts; `retired-syntax.ts` **hard-refuses** legacy `tool/code-dispatch-start`/`tool/code-dispatch` (unless ignorable), `request/header` carrying `data.header.system`, and tool-result wrapper blocks; `developer.ts` validates developer messages + tool-addition/tool-removal blocks.
- **Plugin consumption:** none — the plugin never parses the log format (all reads go through session seams). Its event-scan keys (`turn/start`, `turn/end`, `user/message`) are unchanged in V4. Old team worlds (V3 logs in `tests/homes/<world>`) migrate on read by the persistence layer; a team log that contained retired V3 syntax would refuse migration (none known in plugin-produced logs).

---

## 4. Storage & spill

### 4.1 `storageDomain` — SAME
`packages/storage/storage-domain/src/index.ts` (byte-identical to 0.1.5): service name `'storage-domain'`, `inject = ['storage']`, `Config { backend: string (required), routes?: Record<string, string> }`, `DomainFacility`; apply (:219) = `domainCtx.storage.mount('domain', facility)` + `domainCtx.provide('storageDomain', facility)`.
**Plugin consumption:** `runtime/src/plugin/host.ts:662` — `export const inject = ['agents', 'storageDomain', 'sessions', 'workspaceRegistry']` (hard inject); `:1119-1144` — `ctx.get('storageDomain')`, fail-closed if absent, then `seamModule.createRealStorageDomainSeam(storageDomain)` builds the row-owned seam from `seamUrl`. No action.

### 4.2 `spillStore` — SAME
`packages/spill/spill/src/index.ts:45-56` (byte-identical to 0.1.5):
```ts
export abstract class SpillStore extends Service {
  constructor(ctx) { super(ctx, 'spillStore') }
  abstract saveText(input: SaveTextSpill): Promise<SpillRef>
}
```

### 4.3 `LocalSpillStore` — SAME
`packages/spill/spill-local/src/index.ts` (byte-identical to 0.1.5):
```ts
65:  export class LocalSpillStore extends SpillStore {
66-69: static Config = z.object({
         root: z.string(),
         cleanupPeriodDays: z.number().step(1).min(0).default(30),
       })
83:    constructor(ctx: Context, config: Config) { ... }
149:   async saveText(input: SaveTextSpill): Promise<SpillRef> { ... }
```

### 4.4 `SaveTextSpill` / `SpillRef` — SAME
`packages/spill/spill/src/types.ts` (verbatim 0.1.7; diff vs 0.1.5 = one comment word):
```ts
export interface SpillOwner { readonly sessionId: SessionId }
export interface SaveTextSpill {
  readonly owner: SpillOwner
  readonly source: SpillSource
  readonly suggestedName: string
  readonly content: string
}
export interface SpillRef {
  readonly locator: SpillLocator
  readonly bytes: number
  readonly retrievalHint: string
}
```

### 4.5 `SpillSource` — SAME (exactly 2 arms; no new arms)
`packages/spill/spill/src/types.ts:46-60` (verbatim 0.1.7):
```ts
export type SpillSource =
  | { readonly kind: 'tool'; readonly toolName: string; readonly callId: ToolCallId; readonly label: string }
  | { readonly kind: 'session-reference'; readonly sessionId: SessionId; readonly label: string }
```
Verified: 0.1.5 had 2 arms, 0.1.7 has the same 2 arms — **no third arm was added**.
**Plugin consumption:** `runtime/src/plugin/team-spill-local.ts` — `TeamAwareLocalSpillStore extends LocalSpillStore` (imports `LocalSpillStore`, `Config`, `SaveTextSpill`, `SpillRef`); `toSpillStoreSource` (:82-87) exhaustively switches the 2-arm union with a drift guard `throw new Error('… the upstream source union has drifted …')`; `override async saveText(input: SaveTextSpill): Promise<SpillRef>` (:116). Also `artifact-grant-bridge.ts`, `host.ts:911,1630`; bundle override row in the plugin root `cordis.patch.yml` (`team-spill-local` row, `dsh-agent-team/spill-local` subpath). The drift guard will **not** fire. No action.

### 4.6 spill-policy — CHANGED (`maxInlineBytes` → `maxInlineTokens`)

- 0.1.7 `packages/spill/spill-policy/src/index.ts`:
  - Config (:26-28): `maxInlineTokens?: number` — "Omitted disables retention"; normalized `Config = z.object({ maxInlineTokens: z.number() })` (:31, no schema default). Image-block handling uses `ctx.get('llm')?.imageRequestPricing` + `estimateContent` from `@deepseek-ai/dsh-token-meter/estimate`.
  - Applying config (bundle row): 0.1.5 base bundle `maxInlineBytes: 50000` (git show fb2c4b9e69:packages/bundle/base/cordis.patch.yml:386) → 0.1.7 base bundle `maxInlineTokens: 12500` (`packages/bundle/base/cordis.patch.yml:409`).
- **Plugin consumption:** none — grep of plugin src + root `cordis.patch.yml` finds no `maxInline*`/`spill-policy` config (only comments in `team-spill-local.ts:27`, `artifact-grant-bridge.ts:14`). The 0.1.7 base default therefore applies as-is; the retention threshold is now token-based (~4× coarser unit), which changes *when* text is retained inline vs spilled — worth one characterization check in the upgrade world (U-later), no code change.

---

## 5. MCP client package

### 5.1 `@deepseek-ai/dsh-mcp-client` — CHANGED (SDK v2 + additive API)

- Dependency swap: 0.1.7 `packages/mcp/mcp-client/package.json` — `@modelcontextprotocol/client 2.0.0` (exact) vs 0.1.5 `@modelcontextprotocol/sdk ^1.12.0`.
- Config (0.1.7 `src/index.ts`): `StdioConfig` (:52) and `StreamableHttpConfig` (:80):
```ts
80:  export interface StreamableHttpConfig {
           transport: 'streamable-http'
86:     serverName: string            // [A-Za-z0-9_-]{1,32}, unique across live instances
90:     url: string
92:     headers: Record<string, string>
94:     toolCallTimeoutMs: number
96:     failOnStartupError: boolean
98:     maxInstructionBytes?: number  // NEW; default 32768 (connection.ts:49 DEFAULT_MAX_INSTRUCTION_BYTES)
100:    reconnect?: ReconnectConfig   // NEW (connection.ts:29)
        }
```
All fields used by the plugin's mount call are still present → **call compatible**.
- New export: `createMcpToolDefinition(ctx, options: McpToolDefinitionOptions): ToolDefinition` (`src/tools.ts:225`; options at :196 — `name/rawName/description/inputSchema/outputSchema?/taskRequired?/call(args, execution)`).
- New: `src/server-context.ts`; new dep `@deepseek-ai/dsh-mcp-resources` (`McpResourceProvider`/`McpResourceRuntime`).
- New: cursor-paginated resource routing in `src/connection.ts:364-385` — `resources/list` with `{ cursor }`, `resources/templates/list` with `{ cursor }`, `resources/read` with `{ uri }`.
- **Plugin consumption:** `runtime/src/plugin/live/agent-bindings.mjs:328` (`import * as mcpClient from '@deepseek-ai/dsh-mcp-client'`) and `:1122` (`state.mcpMountCtx.plugin(mcpClient, { transport: 'streamable-http', serverName, url, headers: {}, toolCallTimeoutMs: 15_000, failOnStartupError: true })`). `runtime/package.json:21` already pins `"@deepseek-ai/dsh-mcp-client": "0.1.7-rc.1"`. No code change; new capabilities unused.

---

## 6. Client side

### 6.1 Client Sessions — multi-instance — CHANGED (ref-counted retain replaces `open`/`clear`)

0.1.7 `packages/api/session-controller/src/client/contract/sessions.ts`:
```ts
49:  export interface ISessions {
49:    list: ObservableSnapshot<SessionListState>
58:    retain(target: SessionTarget, options: SessionRetainOptions): SessionReference
66:    using<T>(target: SessionTarget, options: SessionRetainOptions, operation: () => Promise<T>): Promise<T>
71:    retainInfo(id: SessionId): ObservableSnapshot<SessionRetainInfo>
       searchResultLimit, create(opts?: { workspaceId?, cwd?, sessionId? }), subagentAddress,
112:    refreshProjections(sessionId: SessionId), refresh(), search, fork, scope, scopeOf, sessionOf, binding
     }
```
**No `open`.** 0.1.5 had `list, searchResultLimit, create, open(id): void, openSubagent, subagentAddress, setSubagentCatalogOpen, refreshSubagents, clear(), refresh, search, fork, scope, scopeOf, sessionOf, binding` — `open`/`clear`/`openSubagent`/`setSubagentCatalogOpen`/`refreshSubagents` all removed.
0.1.7 `SessionListState` (`client/sessions/service.ts:54`): `{ ids, byId, phase, projectionsBySession: Readonly<Record<SessionId, SessionProjectionSnapshot>> }` — 0.1.5's `current: SessionId | undefined`, `subagentsByParent`, `jobsBySession` are **gone**.
Instance model: `SessionReference` (ref-counted), per-source `retainedBy` counts, `SessionReferenceSourceMap` (declaration-merge extensible, `client/index.ts:80-88`): host-declared sources `controllerOperation` + `gateway`; `mainView` declared by `packages/client/ui-session/src/client/index.ts:184`; navigation retains via `this.sessions.retain(target, { source: 'mainView' })` (`packages/client/ui-workspace/src/client/navigation.ts:387`). A plugin may add its own source by extending `SessionReferenceSourceMap` via declaration merging (public, no private seam needed).
**Plugin consumption (client):** `client/src/plugin/team-mount-core.ts` — inject `['slots','locale','sessions','connection','remote','remote.agentPresets']` (:326); **broken call sites in 0.1.7**: `ctx.sessions.open(...)` at :518, :540, :589; `ctx.sessions.list.getSnapshot().current` at :571-572 and :843. Frozen port `TeamSessions { list, create, open, refresh }` must be remapped (`open` → `retain`/`using` with a plugin source; "current session" → `retainInfo`/mainView semantics).
**U2–U6 notes:** this is the single hardest client-side break (U4/U5).

### 6.2 Client support packages consumed by the plugin client

| Package | Verdict | Evidence |
|---|---|---|
| `@deepseek-ai/dsh-client-store` | SAME | export surface (ObservableSnapshot/SnapshotStore) identical both versions |
| `@deepseek-ai/dsh-client-ui-slots` | CHANGED (superset) | `SlotCore` is a class in both (0.1.7 `index.ts:987` vs 0.1.5 :717); `SlotMap` :26, `LocaleNamespaceMap` :39, `PropsLocale` :93, `PropsRuntime` :251, `InjectFace` :584; 0.1.7 adds factory-slot machinery |
| `@deepseek-ai/dsh-client-locale` | SAME | `LocaleRuntime` class (0.1.7 `client/index.ts:165`); register overloads :389-400 + `bind` :448-455 same as 0.1.5 |
| `@deepseek-ai/dsh-client-connection` | SAME (client side) | `ClientConnectionRpc.call(channel, endpoint, payload, signal?): Promise<ConnectionRpcResult<unknown>>` identical (0.1.7 `rpc.ts:258-272`; `open?` optional in both); 0.1.7 adds host-side `ConnectionRpcAttachment` + handler `peer: PeerScope` (not consumed by the plugin) |
| `@deepseek-ai/dsh-client-ui-primitives` | **CHANGED (breaking rename)** | icon set re-baselined: 0.1.5 size-suffixed `IconUserOutline16` → 0.1.7 `IconUserOutlineRegular` / `IconUserOutlineMedium` (`icons/index.tsx:641-653`); **zero `*16` exports remain** (75 → 186 icon exports). Plugin: `client/src/ui/NewTeamEntry.tsx:24` imports `IconUserOutline16` → **import breaks**. `Tooltip`/`Modal`/`StateDot`+`StateDotState` present in both. |
| `@deepseek-ai/dsh-client-ui-conversation` | CHANGED (additive) | slots `conversation.view` + `conversation.input.dock` present in both (0.1.7 `apply.ts:317,277`; 0.1.5 :263,227); `ConversationSessionInjected` additive (0.1.7 adds `hooks.inspectCall`, `contract/slots.ts:337`) |
| `@deepseek-ai/dsh-client-ui-sidebar` | SAME | `sidebar.footer.action` identical both versions |

Plugin UI files consuming these: `client/src/ui/{NewTeamEntry,TeamDock,TeamView,TeamMembers,TeamGovernance,TeamLedger,TeamSettingsSection,TeamTimeline,TeamActivity,TeamCreationPanel,TeamMemberDialogs}.tsx`.

---

## 7. Plugin infrastructure (new in 0.1.7)

### 7.1 Plugin install/launch DSH version compatibility check — CHANGED (new mechanism; absent in 0.1.5)

0.1.5: `git ls-tree fb2c4b9e69 packages/boot/app-boot/src/` = `index.ts` + `profile.ts` only — **no compatibility mechanism existed**.

0.1.7:
- `packages/boot/app-boot/src/plugin-compatibility.ts` — `evaluatePluginCompatibility(manifest, exemptions?, runtimeVersion?)`: scans the plugin `package.json` **`peerDependencies`** for keys `@deepseek-ai/dsh` / `@deepseek-ai/dsh-*`; each is checked against the runtime version via `semver.satisfies(runtimeVersion, requirement, { includePrerelease: true })`; `workspace:^`/`workspace:~`/`workspace:*` ranges count as "current runtime" (always satisfied); returns `{ name, version, runtimeVersion, peers: <only unsatisfied>, exempted }` or `undefined` when compatible. `getDshRuntimeVersion()` reads the app-boot `package.json` version. `pluginCompatibilityWarning(issue)` renders the message referencing `dsh plugin allow-version`.
- `packages/boot/app-boot/src/profile-compatibility.ts` — profile-local `compatibility.json` (`PROFILE_COMPATIBILITY_FILENAME`): exact `package@version → string[] (exact DSH versions)`; `setProfileVersionExemption(profileDir, packageVersion, runtimeVersion, enabled, acceptRisk)` — granting requires an `--accept-risk` acknowledgement and `runtimeVersion` === current runtime.
- **Enforcement at launch:** `packages/boot/app-boot/src/compatibility-preflight.ts` — `prepareProfileEntries(ctx, entries, parentURL, binName)`: per row, resolve the plugin manifest, run `evaluatePluginCompatibility`; an incompatible + un-exempted row is **denied: `row.disabled = true`** (stderr: `dsh: disabling profile plugin <row>: <warning>`); malformed peer metadata refuses the row. Call sites: preset mount `packages/preset/agent-preset-registry/src/mount.ts:263` (`await tree.root.update(prepareProfileEntries(ctx, plugins, ctx.baseUrl))` — i.e. every preset child row is compatibility-checked at preset mount) and the plugin manager (`packages/boot/plugin-manager/src/operations.ts:291,423`; `src/index.ts:301,546,722`).
- CLI: `dsh plugin allow-version <package@version> --dsh-version <exact> --accept-risk` / `revoke-version` / `version-exemptions` (`apps/cli/src/plugin.ts:13-46`).
- **Plugin status:** `packages/runtime/package.json` declares its dsh deps in `dependencies` (exact `0.1.7-rc.1`) and `devDependencies` (exact `0.1.7-rc.1`) with an **empty `peerDependencies`** → the check finds no dsh peers → returns `undefined` (compatible) → **no exemption required today**. If the upgrade moves dsh deps to `peerDependencies` (recommended by the 0.1.7 dev guide, §7.2), they must be satisfiable by the host runtime or exempted.

### 7.2 Source launch / linked local plugin module resolution — CHANGED (new resolution layer; 0.1.5 had none)

0.1.5: app-boot had no profile-resolution layer (see §7.1 file listing).
0.1.7: new `packages/boot/app-boot/src/profile-resolution/` (`resolver.ts`, `service.ts`, `worker-bootstrap.ts`, `legacy-links.ts`). Commits: `3e7af9cfbb feat(boot): resolve linked plugin peers from the running installation`, `c9d4b7561d fix(boot): apply linked peers at each native lookup position`, `7252e5823b fix(boot): keep linked-root removal independent of relinking`, `15e07d2721 refactor(boot): rename the profile resolution generation to the runtime resolution`.

Behavior (`resolver.ts:516-555`, `routeLinked`): for importers inside a **linked** root (a symlinked/local plugin repo, e.g. a dev `npm link` install), when the module lookup walks the ancestor `node_modules` positions, any position whose manifest declares the requested bare name as a **peer** (`readPeerNames(directory).has(name)`) is "occupied" — the lookup is intercepted and routed to the **running installation's** copy of the package (`resolution.entries.get(name)`, the runtime resolution table). Physical copies at peer-occupied positions are skipped; undeclared names fall through to native Node lookup. Documented in `.agents/notes/implemented/architecture/2026-09-19-profile-resolution-lookup-order.md` (Part 2 matrix; Part 3.2 dev guide: declare dsh packages whose instances must be shared under **both** `peerDependencies` and `devDependencies`; works with npm-global, Desktop-bundled, and source-repo DSH).

**Plugin relevance:** dsh-agent-team is itself a linked local plugin in dev worlds; under 0.1.7 its dsh deps resolve to the running host installation (single module instance for stateful packages) — directly favorable to the 0.1.7 linked upgrade. Combined with §7.1, the 0.1.7 dev guide implies declaring shared dsh deps as peers (with the exact-host-version caveat of §7.1).

---

## ABSENT — replacement summary

| Absent seam (0.1.5) | Verdict | Closest public replacement (0.1.7) | PRIVATE_ONLY? |
|---|---|---|---|
| `agent/session-start` (event, emitted at `packages/core/agent-loop/src/index.ts:675` in 0.1.5) | ABSENT | `agent/created` payload `source: SessionStartSource` (`'startup'\|'resume'\|'clear'\|'compact'`) — same source vocabulary, delivered via the awaited serial announce (`packages/core/agent/src/index.ts:537,550-554`; contract `src/runtime-types.ts:261`). First-party consumer: `packages/goal/goal/src/index.ts:255`. | **No** (public event payload) |
| `ISessions.open` / `ISessions.clear` / `SessionListState.current` (client) | removed members, not a seam | `retain(target, { source })` / `using(target, { source }, op)` / `retainInfo(id)` with `SessionReferenceSourceMap` declaration-merge for a plugin source (`packages/api/session-controller/src/client/contract/sessions.ts:58,66,71`; `client/index.ts:80-88`) | **No** (public client contract + declared extension point) |
| `agentPresets.roots/authorable/read/copy/remove` (+ remotes `copy`/`deletePreset`) | removed members | user preset authoring moved to profile patches overriding preset rows' `config.plugins` (bundle comment, `packages/bundle/web-app/presets/*.patch.yml`); no per-preset copy/delete API exists — presets are declarations, not files | Partially: authoring is public (profile patches), but there is no 1:1 public API for copy/delete (they are intentionally gone, not private-replaced) |

## UNVERIFIED / open items

1. **`remote.agentPresets.list` exact runtime row in a live 0.1.7 process** — the wire shape is derived from the 0.1.7 source (verbatim code above); not captured from a live 0.1.7-rc.1 runtime (no 0.1.7 world launched yet in this inventory — that is U2's job). Reason: inventory scope is source-level; a live roster capture would need a launched 0.1.7 host.
2. **`@deepseek-ai/dsh-agent-preset-registry` npm `0.1.7-rc.1` integrity** — publish existence + dist-tags verified from registry JSON (2026-09-23 publish); tarball content not extracted. Low risk (source tree is authoritative for the seam facts).
3. **Plugin client `TeamSessions` remap target details** — the replacement `retain`/`using` semantics for the plugin's "open a team session" flows are established at the contract level here; the exact per-call-site mapping is U4/U5 client work (not an inventory question).
4. **Characterization-world session logs containing V3 retired syntax** — whether any `tests/homes/<world>` team log contains `tool/code-dispatch*` or header `system` (which would refuse V3→V4 migration) was not scanned; the v3-to-v4 `retired-syntax.ts` refusal is documented, per-world scan is a U2 smoke-test concern.
5. **`sessionQuery.observeSession` full parameter list** — the plugin does not call it (only `readSurface`/`readTitleSnapshots`, verified identical); the `observeSession` signature diff was not enumerated line-by-line because it is unconsumed.
