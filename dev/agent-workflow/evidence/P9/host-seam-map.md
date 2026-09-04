# P9 S0 — Public Host Seam Map (G0 output)

Timebox: plan §13 S0 box (T+12:00–T+12:45, 45 min). Characterized from
`references/deepseek-harness-test-use` @ `cd5ef814` (pristine upstream role, per
TEST_METHODS.md). No DSH architecture audit beyond the 8 plan §11 seams; per the
stop rule, any missing capability is recorded as ABSENT with its feature
degraded/blocked, not chased further.

Verdicts: SAME (public surface exists as needed) / RENAMED (exists, different
name/path than legacy) / ABSENT (no public surface; feature degrades or blocks).

---

## Seam 1 — Slot registration API

- **Need**: register Team UI entries (conversation view tab, input dock,
  settings rows, member session header chrome) into another package's slots
  with per-entry id/order/label, locale, children, store, inject face.
- **Public API / path**: `ctx.slots.register({ name, id?, order?, label?,
  locale?, children?, store?, inject? }, Component)` — the single slot API
  (packages/client AGENTS.md rule 1). Cross-package entries use
  `ctx.slots.inject(slotName, () => ctx.slots.register(...))`, which waits on
  the actual declaration and removes the contribution when it collapses
  (new-plugin checklist item 4). Reference registrations:
  `packages/client/ui-chat/src/client/apply.ts:98-116` (view tab with
  `id: 'chat', order: 0, label: () => t('view.chat')`),
  `packages/client/ui-conversation/src/client/queue/QueueDock.tsx:215-216`
  (`conversation.input.dock` list entry), `ui-conversation/src/client/
  skeleton/TodoPanel.tsx:137-138`.
- **Legacy equivalent**: ui-team registered `conversation.view` id `team`
  (order 20), `conversation.input.dock`, settings section, and chat.node
  markers through the monorepo conversation/sessions services.
- **Verdict**: SAME.
- **Action**: S6 (P9-T9) mounts Team entries through `slots.register` /
  `slots.inject` only. View tab id `team`, order 20, label via `t('view.team')`.
  `conversation.input.dock` entry props =
  `PropsRuntime<'conversation.input.dock'> & <inject face> &
  PropsLocale<'team'>` (legacy `TeamDockProps` shape is directly compatible).

## Seam 2 — Locale API

- **Need**: register the `team` locale namespace (zh/en, 60 keys from legacy
  `locales.ts`) and receive a typed translator in apply + components.
- **Public API / path**: `ctx.locale.register(NS, { zh, en })` installed as a
  `ctx.effect` + `ctx.locale.bind(NS)` → typed `t` (reference:
  `ui-chat/src/client/apply.ts:79-80`, `ui-conversation/src/client/apply.ts:
  102-103`); `ctx.locale.subscribe(fn)` for re-render on language switch;
  register calls accept `locale: NS`; component props include
  `PropsLocale<'team'>` after declaring the namespace in the merge-extensible
  `LocaleNamespaceMap` (`packages/client/ui-slots/src/index.ts`), type-only
  from `@deepseek-ai/dsh-client-locale/client`
  (`locale/src/client/index.ts` merges `Context { locale }` + events).
- **Legacy equivalent**: identical pattern — `inject: ['locale']`,
  `ctx.locale.register('team', { zh, en })`, `PropsLocale<'team'>`,
  `t: TeamKey → string`.
- **Verdict**: SAME.
- **Action**: copy `locales.ts` verbatim (P9-T1), keep `TeamKey` union;
  declare `team` in `LocaleNamespaceMap` via type-only augmentation from the
  vNext client package; register the dictionary in apply (P9-T9).

## Seam 3 — Native open-session / navigation API

- **Need**: select/open a member session (legacy `onSelectSession(sessionId)`
  in TeamFeed rows, TeamMembers current-session highlight) and read the
  session roster + current selection.
- **Public API / path**: `ctx.sessions` — the `ISessions` face from
  `@deepseek-ai/dsh-api-session-controller/client`
  (`packages/api/session-controller/src/client/contract/sessions.ts`):
  `list: ObservableSnapshot<SessionListState>` (rows + current selection,
  read face), `open(id: SessionId): void` (select as current; unknown ids
  fail loud), `create(opts?)`, `binding(id): SessionBinding | undefined`,
  `scopeOf(ctx)`, `sessionOf(ctx)`. Reference use: `ui-chat/src/client/
  apply.ts:111,121` (`ctx.sessions.binding(sessionId)?.session`,
  `ctx.sessions.list.getSnapshot().byId[sessionId]?.cwd`).
- **Legacy equivalent**: `ctx.sessions.teams.mirror` + `onSelectSession`
  callbacks threaded from TeamMirror (DROP list — the mirror is gone in
  vNext; selection itself is native).
- **Verdict**: RENAMED (legacy callback props `onSelectSession` /
  `currentSessionId` map onto `ctx.sessions.open` / `ctx.sessions.list`
  selection + session-scoped `sessionId` runtime prop; no separate
  navigation service exists or is needed).
- **Action**: P9-T5/T9 adapt the legacy callbacks: row click →
  `ctx.sessions.open(sessionId)` (inject a plain callback built in apply
  from `ctx.sessions`); current-session highlight from
  `PropsRuntime` session scope / `ctx.sessions.list.getSnapshot()`.

## Seam 4 — Conversation-view selection API

- **Need**: the legacy TeamDock "jump" entry (`openTeamTab` injected
  callback) switches the conversation area to the Team tab; the Team view
  itself is one registered `conversation.view` entry.
- **Public API / path**: view tabs are registered entries of the
  `conversation.view` list slot (`ui-conversation/src/client/contract/
  slots.ts:117`, `owner: ConvViewOwnerProps`); the shell projects
  `entries('conversation.view')` into tabs (`apply.ts:120-131`) and holds
  per-session selection in `ConversationStoreState { draft, view:
  string | null, viewRequest: ConversationViewRequest | null }`
  (`contract/views.ts`) with store actions `setView(view)`,
  `requestViewFocus(view, focus)`, `completeViewRequest()`
  (`stores.ts:8-28`). `openView(view, focus)` / `completeViewRequest()`
  are owner props of the `conversation.view` entries **themselves**
  (`ConvViewOwnerProps`, `contract/slots.ts:203-210`). The per-session
  provide from ui-conversation (`apply.ts:157-170`) exposes only
  `hooks: ['conversation', 'input']` + `props: ['inputActions']` — the view
  store is **not** exposed. `ui-layout` no longer owns view selection
  (`ui-layout/src/client/service.ts:5`: "per-session active view dissolved
  into ui-conversation's session store"). No public service, provide
  contribution, or slot lets another package (a `conversation.input.dock`
  entry) switch the active view or address focus.
- **Legacy equivalent**: `openTeamTab` injected into the dock (monorepo
  navigation).
- **Verdict**: ABSENT (cross-entry view activation). In-entry selection is
  SAME: the Team view registers as a tab and the shell's tab strip selects
  it; the view entry receives `openView`/`viewRequest` owner props.
- **Action**: per plan stop rule, degrade: the Team tab is reachable via the
  shell tab strip (registration suffices — no API needed to be shown); the
  TeamDock jump entry is hidden/disabled (CLIENT_LOCAL UI decision, recorded
  in reuse-audit as degraded, not a blocker). Do not attempt private store
  reach, DOM hacks, or new framework extension (AGENTS.md data-access
  ladder: "anything else is a new framework extension point and needs
  main-thread arbitration" — out of P9 scope, CORE PATCH BUDGET = 0).

## Seam 5 — Remote RPC client API / channel binding

- **Need**: browser → host calls on the frozen `/team-remote` channel (10
  queries + 13 commands, P8 contract) plus an invalidation/push path for
  projection sync.
- **Public API / path**:
  - Host side: `ctx.connection.rpc.handle(channel, handler)` —
    `HostConnectionRpc` (`packages/client/connection/src/rpc.ts:159-170`),
    registers an authenticated absolute channel with an async disposer;
    vNext P8 already binds `REMOTE_RPC_CHANNEL = '/team-remote'` through
    exactly this seam (`packages/remote/src/handlers/register.ts:36-93`,
    runtime wiring `packages/runtime/src/plugin/s6-remote.ts:1705`, host
    service validation `packages/runtime/src/plugin/host.ts:531-537`).
  - Client side: `ctx.connection` — `ConnectionHandle`
    (`packages/client/connection/src/client/index.ts:105-131`) with
    `rpc: ClientConnectionRpc` ("Generic logical RPC channels over the same
    Connection transport"). `ClientConnectionRpc.call(channel, endpoint,
    payload, signal) → Promise<ConnectionRpcResult<T>>`
    (`src/client/rpc.ts:31-40`); channel pattern
    `/^\/[A-Za-z0-9._~-]+$/` accepts `/team-remote`; endpoint segments
    accept dotted method names. Envelope `ConnectionRpcResult<T> =
    {ok:true,value} | {ok:false,error:{code,message,details}}`
    (`src/rpc.ts:18-28`); `RpcId` is a branded **string**, minted by the
    caller, echoed by the responder (rpcId strictly bidirectional — client
    AGENTS.md layering rule; wire `ClientRequest {type:'client-request',
    rpcId, ...}`).
  - Push/subscribable signals: `ClientConnectionRpc.open?` is optional and
    **absent in the served web app** (no `__DSH_TRANSPORT__` worker tunnel —
    `client/index.ts:95-98,148`); `ctx.remote.$on` is typed to
    `TypertRemoteEvent = Extract<TypertForwardableEvent, keyof
    TypertRemoteEventSelection>` where the selection "is declared once by
    the Host assembly" (`packages/typert/protocol/src/types.ts:106-123`) —
    vNext team events are not selectable without a host-assembly change;
    `ctx.remote.$stream` is gateway-supervised for generated stream methods.
    Public and subscribable: `ctx.connection.generation`
    (`ObservableSnapshot` of `ConnectionGeneration | undefined`) — physical
    reconnection is an observable invalidation trigger
    (`client/index.ts:113,173-179`).
- **Legacy equivalent**: TeamMirror push over monorepo internal transport
  (DROP list — no equivalent in vNext; replaced by frozen Remote v1).
- **Verdict**: SAME (unary command/query path, both directions, public,
  already bound on the host by P8). ABSENT (general-purpose browser-side
  stream subscription on `/team-remote`).
- **Action**: S2 (P9-T3) builds `TeamRemoteClient` on
  `ctx.connection.rpc.call('/team-remote', method, payload, signal)` with a
  typed wrapper over the frozen method catalog — no React, no transport
  assumptions. Live update per plan §6.3: characterisation = **no
  subscribable team invalidation signal on the public browser transport**;
  the only public invalidation trigger is a connection-generation change.
  Therefore the client sync policy is temporary pull (poll
  `team.getProjection`, verdict via `assessProjectionSync` in
  `@dsh-agent-team/remote`) plus immediate pull on generation change;
  polling interval is CLIENT_LOCAL transport policy — never authority.
  Authority always comes from fresh `team.getProjection` /
  `team.getLedgerPage` responses.

## Seam 6 — Public `remote.agentPresets` seam

- **Need**: New Team flow lists available agent presets (per-member preset
  choice) without host `ctx.agentPresets` access from the browser.
- **Public API / path**: `ctx.remote.agentPresets.list()` and
  `ctx.remote.agentPresets.select(sessionId, presetId)` — generated remote
  namespace on the `remote` service, consumed in production by
  `ui-agent-preset` (`packages/client/ui-agent-preset/src/client/
  section-store.ts:138,144-148` list rows `{id, trust, name?, description?,
  isDefault, broken?}` filtered on `broken === undefined`; `seat-store.ts:
  159` select). Typed failures include
  `agent-preset-not-found {agentPreset, available[]}`,
  `agent-preset-invalid`, `agent-preset-read-only`, `agent-preset-locked`
  (`connection/src/rpc.ts:31-40`, `session-controller/src/types.ts:196-197`).
  Frozen doc ND-02 (`remote.agentPresets` public seam, NATIVE_PROVEN) —
  confirmed against source.
- **Legacy equivalent**: monorepo preset picker via internal service.
- **Verdict**: SAME.
- **Action**: S5 (P9-T7) New Team flow reads `remote.agentPresets.list()`
  for the preset dropdown; preset id travels through frozen vNext Remote
  commands (`team.create` / `member.create` config fields) — the vNext host
  maps preset choice to composition; the client never touches
  `ctx.agentPresets`.

## Seam 7 — Client test runtime

- **Need**: run the 14 migrated ui-team specs (component + model tests)
  against the same fixture runtime the legacy suite already targets.
- **Public API / path**: `@deepseek-ai/dsh-client-test-runtime`
  (`packages/test-support/client-runtime`): "jsdom slot test runtime: a real
  small runtime — Cordis `Context`, the renderer-owned `SlotRegistry`, the
  `ui-session` adapter, and the UI renderer — assembled around test-owned
  session/workspace doubles" (module JSDoc, `src/index.ts:1-11`);
  `@testing-library/react` (`act`/`render`/`within`) for rendering; dev-only
  dependency for feature packages. Legacy `ui-team/package.json` devDeps
  already list `@deepseek-ai/dsh-client-test-runtime` — the suite was
  written for this runtime. Per client AGENTS.md: per-file
  `// @vitest-environment jsdom` pragma (shared config stays node-env);
  component specs feed props directly (`createXXXStore().create()` for store
  data, plain stubs for framework hooks) and assert user-visible behavior,
  not class names.
- **Legacy equivalent**: identical (same package, same react 18, same
  @testing-library).
- **Verdict**: SAME.
- **Action**: S7 (P9-T10) reuses the fixture runtime and
  @testing-library/react as-is; migrated component specs keep the legacy
  assertion style where it asserts visible behavior; model specs are
  environment-agnostic (node).

## Seam 8 — Current React / UI primitive package versions

- **Need**: pin the React/toolchain versions the vNext client package must
  compile and test against, and confirm the four legacy primitives exist.
- **Public API / path**: `react ^18.2.0`, `react-dom ^18.2.0`,
  `@types/react ~18.3.1`, `@types/react-dom ~18.3.0`
  (`packages/client/web/package.json`, `packages/client/ui-chat/
  package.json`); `@deepseek-ai/cordis 4.0.1` (vendored, `vendor/cordis/
  package.json`); `@testing-library/react ^16.3.2` (root devDependency).
  React is a baseline external for every dynamic browser bundle (seeded by
  `apps/web` `PLATFORM_MODULES`, `packages/client/web/src/platform.ts`) —
  the vNext package must not ship its own React runtime copy; React enters
  the package as peer + dev (types) only. Primitives confirmed present in
  `packages/client/ui-primitives/src`: `StateDot` (`StateDot.tsx:19`),
  `Tooltip` (`Tooltip.tsx:34`, props `{label, side, delayMs, disabled,
  maxWidth, children}`), `IconChevronDownOutline14` (`icons/index.tsx:161`),
  `IconChevronUpOutline14` (`icons/index.tsx:201`).
- **Legacy equivalent**: identical versions (legacy ui-team devDeps:
  `react ^18.2.0`, `@types/react ~18.3.1`, cordis `workspace:^`).
- **Verdict**: SAME.
- **Action**: S1 (P9-T2) declares `react`/`react-dom` peer + dev
  `@types/react*` at the exact DSH ranges; ui-primitives consumed as a
  baseline external (implicit — no manifest entry), types via type-only
  imports where needed.

---

## Consequences (stop-rule application)

1. **Seam 4 ABSENT (cross-entry view activation)** → TeamDock jump entry
   degraded (hidden); Team tab remains user-reachable via the shell tab
   strip. No framework extension requested; no DOM substitute.
2. **Seam 5 ABSENT (browser stream subscription)** → temporary pull policy
   for live update (poll + generation-change trigger); authority unchanged
   (fresh frozen-Remote pulls only). If S8 vertical smoke shows the typert
   contribution path viable for external packages, push may replace polling
   in a later task — recorded, not acted on.
3. No seam is a CORE_SEAM_BLOCKER: every frozen-contract capability
   (23 methods, error codes, projection v2, ledger cursor) is reachable
   through the public unary channel already bound by P8.
4. Dependency strategy note for S1: the vNext workspace does not include
   `references/` — DSH client packages resolve via `file:`/`link:` dev
   dependencies (or type-only + baseline-external at bundle time); decision
   recorded in the P9-T2 commit, not here.
