/**
 * P9-T9 (P9-S6) — the unique client mount of the dsh-agent-team Cordis
 * client plugin.
 *
 * This module is the pure-TypeScript core of the client plugin (D-T9-13):
 * every seam binding, slot registration, and store wiring lives here so the
 * package's executed tests can load the mount WITHOUT value-importing a
 * `.tsx` module (the plain-node runner executes only `.test.ts` files and
 * resolves no `.tsx`/`.css` — see test/client-plugin-mount.test.ts). The
 * four `.tsx` components are referenced here TYPE-ONLY (erased at runtime —
 * the executed module graph stays `.tsx`-free) and enter the runtime graph
 * exclusively through `plugin/client.ts` (the thin glue).
 *
 * Registrations (plan §P9-S6; frozen seam map
 * dev/agent-workflow/evidence/P9/host-seam-map.md pinned at cd5ef814):
 *   - `conversation.view`       -> the TeamView "团队" tab (id `team`, order 20);
 *   - `conversation.input.dock` -> the TeamDock (id `team`, order 15);
 *   - `settings.section`        -> the minimal Team settings/help page
 *     (id `team`, order 50; the SlotMap entry is mirrored below from the
 *     ui-settings shell contract — that package is not linked into this
 *     package);
 *   - `sidebar.footer.action`   -> the global New Team entry (id `team-new`,
 *     order 10; the always-discoverable, session-independent creation entry
 *     — frozen UI design §3.1 MUST / the R118 gap; the SlotMap entry is
 *     mirrored below from the ui-sidebar shell contract).
 * Explicit non-registrations: NO `conversation.chat.node` team marker and
 * NO synthetic trajectory — a native Chat/Trajectory/fork stays exactly
 * what native DSH renders; the Team surfaces are slot entries only.
 *
 * Native integration: opening a root/member session goes through the
 * public `ctx.sessions` seam (Seam 3, RENAMED `open`/`create`); the New
 * Team entry creates its native root through the same seam (Seam 3) and
 * its workspace comes from the public preset/row config; projection sync
 * is the frozen "generation invalidation + team.getProjection pull" only
 * (plan §6.3 — no live push, the CLIENT_LOCAL policy owns the retry);
 * runtime presets arrive through the public `ctx.remote.agentPresets`
 * seam (Seam 6). No private DSH import anywhere (CORE PATCH BUDGET = 0).
 *
 * D-T9-1: `dshHome` arrives through the plugin row config
 * (`apply(ctx, config?)`); absent or blank after trim -> the parameterless
 * `legacyInspect` face is OMITTED (the T8 degraded zero-state path).
 * D-T9-4: `openTeamTab` is a documented degraded no-op (Seam 4 ABSENT —
 * cross-entry view activation; the seam map forbids private store reach,
 * DOM hacks, or a new framework extension).
 *
 * Pure module: no React value imports, no node: builtins, no I/O. Erasable
 * TS only. @module @dsh-agent-team/client/plugin/team-mount-core
 */
import { createSnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { ObservableSnapshot } from '@deepseek-ai/dsh-client-store'
import type { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
// Type-only: the conversation.view / conversation.input.dock slot
// declarations (declared by ui-conversation's session body) must be in the
// program for the register calls' slot-key inference.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SlotCore, SlotMap } from '@deepseek-ai/dsh-client-ui-slots'
import type { TeamSessionId } from '../../../contracts/src/index.js'
import type { RemoteResponse } from '../../../remote/src/index.js'
import { projectionFromWire } from '../model/projection-adapter.js'
import { createTeamLedgerStore } from '../state/team-ledger-store.js'
import type {
  TeamLedgerState,
  TeamLedgerStore,
} from '../state/team-ledger-store.js'
import { createTeamProjectionStore } from '../state/team-projection-store.js'
import type { TeamProjectionStore } from '../state/team-projection-store.js'
import { resolveTeamProjection } from '../state/team-session-resolution.js'
import type { TeamProjectionMirror } from '../state/team-session-resolution.js'
import { createTeamRemoteClient } from '../transport/team-remote-client.js'
import type { TeamRemoteClient } from '../transport/team-remote-client.js'
import type { TeamRpcCarrier } from '../transport/host-seams.js'
import { en, zh, type TeamKey } from '../ui/locales.js'
import type { NewTeamEntry, NewTeamEntryInjected } from '../ui/NewTeamEntry.js'
import type { TeamDock, TeamDockInjected } from '../ui/TeamDock.js'
import type { TeamCreationHandoffFace } from '../ui/TeamCreationPanel.js'
import type { TeamGovernanceFace } from '../ui/TeamGovernance.js'
import type { TeamMembersCommandFace } from '../ui/TeamMembers.js'
import type { TeamSettingsSection } from '../ui/TeamSettingsSection.js'
import type { TeamView, TeamViewCreationFace, TeamViewInjected } from '../ui/TeamView.js'

/**
 * Locale namespace + settings-slot declaration merges. The `team` namespace
 * (moved from the P1-T4 skeleton entry) and the `settings.section` entry
 * (mirrored from the ui-settings shell contract — upstream
 * `packages/client/ui-settings/src/client/contract/slots.ts` L54:
 * `{ kind: 'list'; scope: 'root'; owner: SettingsSectionOwnerProps }`,
 * where `SettingsSectionOwnerProps` (L123-126) is exactly the owner's
 * `close`; that package is not linked into this one, so the mirror is
 * local). The `sidebar.footer.action` entry (mirrored from the ui-sidebar
 * shell contract — upstream
 * `packages/client/ui-sidebar/src/client/contract/slots.ts` L46:
 * `{ kind: 'list'; scope: 'root'; owner: SidebarFooterActionOwnerProps }`,
 * where `SidebarFooterActionOwnerProps` (L83-86) is exactly `{ wide }`;
 * that package is not linked into this one either).
 */
declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Team UI copy: view tab, dock, members, tasks, timeline, ledger, settings. */
    team: TeamKey
  }
  interface SlotMap {
    /** One settings page per list entry (see the module-level note above). */
    'settings.section': { kind: 'list'; scope: 'root'; owner: TeamSettingsSectionOwner }
    /** The sidebar-foot action list (see the module-level note above). */
    'sidebar.footer.action': { kind: 'list'; scope: 'root'; owner: TeamNewTeamEntryOwner }
  }
}

/**
 * One slot-injection effect returned to the slot registry (mirrors the
 * ui-renderer `SlotInjectionEffect` — the ui-renderer package is not linked
 * into this package, so the mirror is local): a bare disposer or an
 * iterable of disposers.
 */
export type TeamPluginEffect = (() => void) | Iterable<() => void>

/**
 * The owner share of one settings section (mirrored from the ui-settings
 * shell contract `SettingsSectionOwnerProps` — the shell owns the open
 * state; the registrant only closes it).
 */
export interface TeamSettingsSectionOwner {
  /** Close the settings panel (the shell owns the open state). */
  close: () => void
}

/**
 * The owner share of the sidebar footer action list (mirrored from the
 * ui-sidebar shell contract `SidebarFooterActionOwnerProps` — the shell
 * owns the rail/wide state and passes it to every foot entry).
 */
export interface TeamNewTeamEntryOwner {
  /** Whether the sidebar renders wide content (false = 56px rail). */
  wide: boolean
}

/** The plugin row config (D-T9-1; the S8 composition row supplies the value). */
export interface TeamPluginClientConfig {
  /**
   * The DSH home directory the parameterless `legacyInspect` face binds.
   * Absent or blank after trim -> the face is omitted (the T8 degraded
   * zero-state path; the OS home dir is deliberately NOT a substitute —
   * `generation.host.home` is the OS homedir, not the DSH home).
   */
  readonly dshHome?: string
}

/** The plugin row config alias (the Cordis `Config` export). */
export type Config = TeamPluginClientConfig

/**
 * The connection generation face (Seam 5, SAME): snapshot + subscribe only.
 * The snapshot exposes the `id` field; the host info is deliberately
 * unread (D-T9-1).
 */
export interface TeamConnectionGeneration {
  /** The current generation snapshot; `undefined` while the channel is down. */
  getSnapshot(): { readonly id: number } | undefined
  /** Subscribe to generation changes; returns the unsubscribe function. */
  subscribe(listener: () => void): () => void
}

/** The public connection seam face (Seam 5, SAME): unary RPC + generation. */
export interface TeamConnection {
  /** The unary RPC carrier (structurally `ClientConnectionRpc`; only `call` is consumed). */
  readonly rpc: TeamRpcCarrier
  /** The connection generation (the plan §6.3 invalidation source). */
  readonly generation: TeamConnectionGeneration
}

/**
 * The session-list snapshot (the Seam 3 read face, narrowed to the current
 * selection).
 */
export interface TeamSessionListSnapshot {
  /** The currently selected session id; absent when no session is selected. */
  readonly current: string | undefined
}

/**
 * The public sessions seam face (Seam 3, RENAMED `open`/`create`, plus the
 * `list` read face the global New Team entry prefills from — R121).
 */
export interface TeamSessions {
  /**
   * The session-list snapshot (the Seam 3 read face, narrowed to the current
   * selection).
   */
  readonly list: ObservableSnapshot<TeamSessionListSnapshot>
  /**
   * Create one native root session.
   * @param opts - optional workspace binding.
   * @returns the new session id.
   */
  create(opts?: { readonly workspaceId?: string }): Promise<string>
  /** Open (switch to) the named session. */
  open(sessionId: string): void
  /**
   * Re-pull the host-authoritative session list (the public `ISessions
   * .refresh`). The creation path needs it: a host-created root session
   * may not be in the client list store when the `team.create` /
   * `handoff.create` response lands (the list increment rides the stream
   * and may lag the RPC).
   */
  refresh(): Promise<void>
}

/** One runtime AgentPreset row (Seam 6, SAME). */
export interface TeamAgentPresetRow {
  /** The preset id (the wire value, verbatim). */
  readonly id: string
  /** The trust lane the preset belongs to. */
  readonly trust: 'system' | 'user'
  /** The display name (absent for id-only rows). */
  readonly name?: string
  /** The description line (absent for id-only rows). */
  readonly description?: string
  /** True for the provider-flagged default row. */
  readonly isDefault: boolean
  /** Present on rows the trust check broke (filtered out at the mount). */
  readonly broken?: unknown
}

/**
 * The frozen public seam's `agentPresets/list` payload — the upstream
 * generated remote client answers `RemoteResult<AgentPresetRoster>` (the
 * gateway facade never unwraps): the roster rides in `value` and carries
 * the row list plus the `authorable` flag. The error side is the typed
 * Remote failure (`code` + `message`, e.g. `invocation-unavailable`).
 */
export type TeamAgentPresetsListResult =
  | {
      readonly ok: true
      readonly value: {
        readonly presets: readonly TeamAgentPresetRow[]
        readonly authorable: boolean
      }
    }
  | {
      readonly ok: false
      readonly error: { readonly code: string; readonly message: string }
    }

/** The public remote seam face (Seam 6, SAME): the agent-preset list only. */
export interface TeamRemote {
  /** The runtime agent preset rows. */
  readonly agentPresets: {
    /**
     * List the runtime agent preset rows.
     *
     * The upstream public contract answers the RemoteResult envelope (the
     * roster in `value`), not the row array — the seam-6 mapping that
     * follows unwraps it before the `broken` filter.
     */
    list(): Promise<TeamAgentPresetsListResult>
  }
}

/**
 * The public slots seam face: the typed `register` (preserved from the
 * linked ui-slots) plus the renderer's `inject` (mirrored — the ui-renderer
 * package is not linked into this one).
 */
export interface TeamSlots {
  /** Register one contribution into a declared slot; returns the disposer. */
  readonly register: SlotCore['register']
  /**
   * Register one contribution under a deferred declaration (waits on the
   * actual declaration, removes the contribution when it collapses, reruns
   * after redeclaration); returns the disposer.
   */
  readonly inject: (
    key: keyof SlotMap & string,
    callback: () => TeamPluginEffect,
  ) => () => void
}

/**
 * The minimal Cordis client plugin context the mount consumes (structural
 * mirror of the five public seams + the fiber effect; no DSH context type
 * import).
 */
export interface TeamPluginClientContext {
  /** The slot registry face (register + inject). */
  readonly slots: TeamSlots
  /** The locale runtime (register the dictionaries, bind one translator). */
  readonly locale: Pick<LocaleRuntime, 'register' | 'bind'>
  /** The public sessions seam (Seam 3). */
  readonly sessions: TeamSessions
  /** The public connection seam (Seam 5). */
  readonly connection: TeamConnection
  /** The public remote seam (Seam 6). */
  readonly remote: TeamRemote
  /** Track a disposer in the owning fiber so stop/update removes it. */
  effect(execute: () => TeamPluginEffect, label?: string): void
}

/**
 * The four registered components (TYPE-ONLY at the core — D-T9-13: the
 * concrete `.tsx` components enter the runtime graph exclusively through
 * the glue's `apply` wrapper). The real component types keep the register
 * call sites checked against the slot's full `ComposedProps` at compile
 * time; the imports are type-only and erased, so the executed module graph
 * stays `.tsx`-free.
 */
export interface TeamMountComponents {
  /** The TeamView "团队" tab (the `conversation.view` entry). */
  readonly view: typeof TeamView
  /** The TeamDock (the `conversation.input.dock` entry). */
  readonly dock: typeof TeamDock
  /** The minimal Team settings/help page (the `settings.section` entry). */
  readonly settings: typeof TeamSettingsSection
  /** The global New Team entry (the `sidebar.footer.action` entry). */
  readonly newTeamEntry: typeof NewTeamEntry
}

/**
 * The injected services (only the seams the mount actually reads — the
 * legacy precedent's `uiConversation` edge is dropped: vNext registers no
 * conversation chat node, so the marker event face is never consumed).
 * `remote.agentPresets` is the dotted traced-namespace service itself: a
 * `ctx.remote.<ns>` read is authorized by the context proxy under that
 * dotted key, so the bare `remote` service alone does not open the
 * namespace.
 */
export const inject = ['slots', 'locale', 'sessions', 'connection', 'remote', 'remote.agentPresets'] as const

/** Stable Cordis plugin name of the dsh-agent-team client half. */
export const name = 'dsh-agent-team-client'

/**
 * Mount the Team client on the public seams (the full P9-S6 body).
 *
 * @param ctx - the Cordis client plugin context (the five public seams + effect).
 * @param opts - the plugin row config (the `dshHome` bind) and the three
 *   concrete components (the `.tsx` entries).
 */
export function applyTeamMount(
  ctx: TeamPluginClientContext,
  opts: {
    readonly config?: TeamPluginClientConfig
    readonly components: TeamMountComponents
  },
): void {
  const { config, components } = opts

  // (1) The team locale dictionaries (the renderer rebinds on locale change).
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'dsh-agent-team: dictionaries')
  const t = ctx.locale.bind(NS)

  // (2) The frozen Remote client on the one seam channel.
  const teamRemote: TeamRemoteClient = createTeamRemoteClient(ctx.connection.rpc)

  // (3) The per-team store registries + the teardown effect (disposers run
  // in reverse registration order; reset cancels pending backoff retries so
  // a stopped mount issues no stray carrier call).
  const projectionStores = new Map<string, TeamProjectionStore>()
  const ledgerStores = new Map<string, TeamLedgerStore>()
  const storeDisposers: Array<() => void> = []
  const ledgerOpened = new Set<string>()
  // Last applied projection generation per team (drives the ledger re-pull:
  // a generation advance means the durable ledger may hold new entries).
  const ledgerRefreshGeneration = new Map<string, number>()
  ctx.effect(
    () => () => {
      for (const dispose of storeDisposers.splice(0).reverse()) dispose()
      for (const store of projectionStores.values()) store.reset()
      for (const store of ledgerStores.values()) store.reset()
      ledgerRefreshGeneration.clear()
    },
    'dsh-agent-team: store teardown',
  )

  // (4) The two published observables (the inject `hooks` compartment):
  // the team-keyed projection mirror and the per-team ledger states.
  const mirrorStore = createSnapshotStore<TeamProjectionMirror>({})
  const ledgerStatesStore =
    createSnapshotStore<Readonly<Record<string, TeamLedgerState>>>({})

  // (5) The lazy per-team ledger store (published onto the ledger-states
  // observable; the page pull rides the frozen Remote client).
  const ledgerStoreOf = (teamSessionId: string): TeamLedgerStore => {
    const existing = ledgerStores.get(teamSessionId)
    if (existing !== undefined) return existing
    const store = createTeamLedgerStore({
      getLedgerPage: (id, afterSequence, limit) =>
        teamRemote.getLedgerPage(id, afterSequence, limit),
    })
    const dispose = store.subscribe(() => {
      const snapshot = store.getState()
      const current = ledgerStatesStore.getSnapshot()
      // The ledger store publishes `entriesBySequence` by reference (the
      // T4 "published by reference" contract: the store stays the
      // mutation authority). The snapshot store's `set()` deep-freezes
      // state outside production, so the bridge republishes a Map copy:
      // the published state is freeze-safe and the live Map — the one
      // object the store mutates (page merge, team switch, reset) — is
      // never embedded, so `reset()` cannot die on a frozen collection.
      ledgerStatesStore.set({
        ...current,
        [teamSessionId]: {
          ...snapshot,
          entriesBySequence: new Map(snapshot.entriesBySequence),
        },
      })
    })
    storeDisposers.push(dispose)
    ledgerStores.set(teamSessionId, store)
    return store
  }

  // (6) The lazy per-team projection store (publishes the applied frame onto
  // the mirror; the first applied frame opens the team's ledger store —
  // `open` never rejects; a typed failure settles into `state.error`).
  const projectionStoreOf = (teamSessionId: string): TeamProjectionStore => {
    const existing = projectionStores.get(teamSessionId)
    if (existing !== undefined) return existing
    const store = createTeamProjectionStore({
      getProjection: (id) => teamRemote.getProjection(id),
    })
    const dispose = store.subscribe(() => {
      const frame = store.getState().frame
      if (frame === null) return
      const dto = projectionFromWire(frame.projection)
      const current = mirrorStore.getSnapshot()
      // Status-only store changes keep the same frame reference: skip the
      // republish so the mirror snapshot stays identity-stable between
      // changes (client AGENTS reactive rule 5).
      if (current[teamSessionId as TeamSessionId] === dto) return
      // The ONE documented boundary cast in the mount (house style of
      // team-session-resolution: plain string wire ids, branded mirror keys).
      mirrorStore.set({ ...current, [teamSessionId as TeamSessionId]: dto })
      if (!ledgerOpened.has(teamSessionId)) {
        ledgerOpened.add(teamSessionId)
        void ledgerStoreOf(teamSessionId).open(teamSessionId)
      }
      // Ledger liveness (UI doc §27.2/§27.5: the Team Events section is the
      // Team-wide aggregate chronology and real-time new events append to
      // it): an applied frame advancing the generation means the durable
      // ledger may hold new entries (member.create, member.send, lifecycle,
      // policy…). Refresh re-reads at the tracker's current anchor (frozen
      // stable re-read; the dedupe merge keeps the loaded window
      // un-reordered; single-flight coalesces bursts). The first frame's
      // catch-up from the head already covers everything up to it, so no
      // refresh is issued there.
      const appliedGeneration = store.getState().appliedGeneration
      if (appliedGeneration !== null) {
        const lastGeneration = ledgerRefreshGeneration.get(teamSessionId)
        if (lastGeneration !== undefined && appliedGeneration > lastGeneration) {
          void ledgerStoreOf(teamSessionId).refresh()
        }
        ledgerRefreshGeneration.set(teamSessionId, appliedGeneration)
      }
    })
    storeDisposers.push(dispose)
    projectionStores.set(teamSessionId, store)
    return store
  }

  // (7) The single-flight cold read (plan §6.1: the mirror wins; the
  // invariant-9 candidate-root probe — an unresolved session id is itself
  // the TeamSession id to pull).
  const inflightPulls = new Map<string, Promise<void>>()
  const ensureProjection = (sessionId: string): Promise<void> => {
    const resolution = resolveTeamProjection(mirrorStore.getSnapshot(), sessionId)
    const teamSessionId = resolution?.team.teamSessionId ?? sessionId
    const existing = inflightPulls.get(teamSessionId)
    if (existing !== undefined) return existing
    const pull = projectionStoreOf(teamSessionId)
      .pull(teamSessionId)
      .then(() => undefined)
    inflightPulls.set(teamSessionId, pull)
    void pull.finally(() => inflightPulls.delete(teamSessionId))
    return pull
  }

  // (8) The per-session ledger refresh (no-op when the session resolves to
  // no team or the team's ledger store was never opened).
  const refreshTeamLedgerFor =
    (sessionId: string): (() => Promise<void>) =>
    () => {
      const resolution = resolveTeamProjection(mirrorStore.getSnapshot(), sessionId)
      if (resolution === undefined) return Promise.resolve()
      const store = ledgerStores.get(resolution.team.teamSessionId)
      if (store === undefined) return Promise.resolve()
      return store.refresh()
    }

  // (9) Native session switch (Seam 3; the public `open` path).
  const openSession = (sessionId: string): void => {
    ctx.sessions.open(sessionId)
  }

  // (9.1) The creation-path session open (D-3): the host mints the root
  // session during `team.create` / `handoff.create`, and its list
  // increment may land AFTER the RPC response — a bare `open` of an
  // unknown id throws. Try the plain open; on failure re-pull the
  // host-authoritative list once, then retry. A failure that survives the
  // retry rethrows (the panel's typed error lane keeps it loud).
  const openCreatedSession = (sessionId: string): Promise<void> => {
    try {
      ctx.sessions.open(sessionId)
      return Promise.resolve()
    } catch {
      return ctx.sessions.refresh().then(() => {
        ctx.sessions.open(sessionId)
      })
    }
  }

  // (10) D-T9-4 degraded no-op: Seam 4 (cross-entry view activation) is
  // ABSENT in the served web app, and the seam map forbids private store
  // reach, DOM hacks (the legacy tab click), or a new framework extension.
  // The dock's jump button is its title button; clicking it activates the
  // dock entry's own session context through the ordinary renderer path.
  const openTeamTab = (): void => {}

  // (11) The post-success projection pull (the final-state authority).
  const pullProjection = (teamSessionId: string): Promise<unknown> =>
    projectionStoreOf(teamSessionId).pull(teamSessionId)

  // (12) The S5-A New Team creation face (frozen Remote wrappers + the
  // native seam members; the seam-6 preset mapping filters the `broken`
  // rows and drops the trust field before the UI sees it).
  const creation: TeamViewCreationFace = {
    listCatalog: () => teamRemote.catalogList(),
    getCatalog: (params) => teamRemote.catalogGet(params),
    probeCompatibility: (params) => teamRemote.intentProbe(params),
    teamCreate: (params) => teamRemote.teamCreate(params),
    openCreatedSession,
    listAgentPresets: async () => {
      // The frozen public seam answers the RemoteResult envelope (the roster
      // rides in `value` — the gateway facade never unwraps), so unwrap
      // before the seam-6 row mapping. A refused envelope rejects: the
      // panel's catch degrades to the empty-roster state, the same failure
      // treatment the upstream `ui-agent-preset` consumer applies.
      const result = await ctx.remote.agentPresets.list()
      if (result.ok === false) {
        throw new Error(`agentPresets/list: ${result.error.code} ${result.error.message}`)
      }
      return result.value.presets
        .filter((row) => row.broken === undefined)
        .map((row) => ({
          id: row.id,
          name: row.name,
          description: row.description,
          isDefault: row.isDefault,
        }))
    },
  }

  // (13) The S5-B member command face (frozen Remote wrappers verbatim).
  const memberCommands: TeamMembersCommandFace = {
    memberCreate: (params) => teamRemote.memberCreate(params),
    memberSend: (params) => teamRemote.memberSend(params),
    memberFollowup: (params) => teamRemote.memberFollowup(params),
    memberArchive: (params) => teamRemote.memberArchive(params),
    memberRestore: (params) => teamRemote.memberRestore(params),
    memberDispose: (params) => teamRemote.memberDispose(params),
    pullProjection,
  }

  // (14) The S5-C governance face (frozen Remote wrappers verbatim; the
  // compat-ack wire gap stays UI-disabled on the T8 surface).
  const governance: TeamGovernanceFace = {
    compatibilityGet: (params) => teamRemote.compatibilityGet(params),
    compatibilityAck: (params) => teamRemote.compatibilityAck(params),
    compatibilityReprobe: (params) => teamRemote.compatibilityReprobe(params),
    policyStateGet: (params) => teamRemote.policyStateGet(params),
    policyStateSet: (params) => teamRemote.policyStateSet(params),
    overrideGet: (params) => teamRemote.overrideGet(params),
    overrideSet: (params) => teamRemote.overrideSet(params),
    overrideReset: (params) => teamRemote.overrideReset(params),
    pullProjection,
  }

  // (15) The S5-D handoff face (frozen Remote wrappers verbatim).
  const handoff: TeamCreationHandoffFace = {
    prepare: (params) => teamRemote.handoffPrepare(params),
    create: (params) => teamRemote.handoffCreate(params),
  }

  // (16) D-T9-1: the parameterless legacyInspect face binds the `dshHome`
  // closure here; absent/blank config -> the face is omitted (the T8
  // degraded zero-state path).
  const dshHome = (config?.dshHome ?? '').trim()
  const legacyInspect =
    dshHome === ''
      ? undefined
      : (): Promise<RemoteResponse> => teamRemote.legacyInspect({ dshHome })

  // (17) The connection-generation rebaseline (plan §6.3: the frozen
  // guarantee is generation invalidation + the team.getProjection pull
  // only — no live push). `undefined` -> markConnectionLost on every bound
  // PROJECTION store (schedules the CLIENT_LOCAL backoff retry); defined ->
  // markConnectionRestored (cancels the pending retry, fires the pull).
  // Both are no-ops on an unbound store, so no initial-snapshot read is
  // taken (the maps are empty at apply time; stores self-bind on their
  // first pull). Ledger stores are deliberately NOT rebaselined: the
  // frozen guarantee covers the projection pull only — a ledger page
  // failure surfaces in `state.error` and is re-requested through
  // `refreshTeamLedger`.
  ctx.effect(
    () => {
      const unsubscribe = ctx.connection.generation.subscribe(() => {
        const snapshot = ctx.connection.generation.getSnapshot()
        for (const store of projectionStores.values()) {
          if (snapshot === undefined) store.markConnectionLost()
          else store.markConnectionRestored()
        }
      })
      return unsubscribe
    },
    'dsh-agent-team: generation rebaseline',
  )

  // (18) The injected faces (the `hooks` compartment carries the two bare
  // observable sources; everything else is plain data + callbacks).
  const viewInject = (sessionId: string): TeamViewInjected => ({
    hooks: { projectionMirror: mirrorStore, teamLedgers: ledgerStatesStore },
    ensureProjection,
    refreshTeamLedger: refreshTeamLedgerFor(sessionId),
    openSession,
    creation,
    memberCommands,
    governance,
    handoff,
    ...(legacyInspect === undefined ? {} : { legacyInspect }),
  })
  const dockInject = (): TeamDockInjected => ({
    hooks: { projectionMirror: mirrorStore },
    ensureProjection,
    openTeamTab,
  })

  // (19) The four slot registrations (inline option literals: the slot
  // key is inferred from `name` per call; the legacy orders/labels are
  // preserved verbatim).
  ctx.slots.inject('settings.section', () =>
    ctx.slots.register(
      {
        name: 'settings.section',
        id: 'team',
        order: 50,
        locale: NS,
        label: () => t('nav'),
      },
      components.settings,
    ),
  )
  ctx.slots.inject('conversation.view', () =>
    ctx.slots.register(
      {
        name: 'conversation.view',
        id: 'team',
        order: 20,
        locale: NS,
        label: () => t('view.team'),
        inject: (sessionId) => viewInject(sessionId),
      },
      components.view,
    ),
  )
  ctx.slots.inject('conversation.input.dock', () =>
    ctx.slots.register(
      {
        name: 'conversation.input.dock',
        id: 'team',
        order: 15,
        locale: NS,
        inject: (): TeamDockInjected => dockInject(),
      },
      components.dock,
    ),
  )
  // (19.1) The global New Team entry (frozen UI design §3.1 MUST / the R118
  // gap): the session-independent creation entry fixed at the sidebar foot.
  // Root scope -> the inject factory receives no session argument; the face
  // is the S5-A creation face plus the robust creation-path session open
  // (D-3 — no handoff face or source: the overlay panel is the T7 surface
  // only). R121: the face also carries the Seam 3 `list` current-selection
  // read, which the entry uses to prefill the fresh draft's workspace.
  ctx.slots.inject('sidebar.footer.action', () =>
    ctx.slots.register(
      {
        name: 'sidebar.footer.action',
        id: 'team-new',
        order: 10,
        locale: NS,
        label: () => t('entry.label'),
        inject: (): NewTeamEntryInjected => ({
          listCatalog: creation.listCatalog,
          getCatalog: creation.getCatalog,
          probeCompatibility: creation.probeCompatibility,
          teamCreate: creation.teamCreate,
          openCreatedSession: creation.openCreatedSession,
          listAgentPresets: creation.listAgentPresets,
          currentSessionId: () => ctx.sessions.list.getSnapshot().current ?? null,
        }),
      },
      components.newTeamEntry,
    ),
  )
}

/** The locale namespace owned by this plugin (literal type preserved). */
const NS = 'team'
