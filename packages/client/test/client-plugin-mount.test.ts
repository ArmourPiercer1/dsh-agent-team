/**
 * P9-T9 (P9-S6) client mount behavior test: the unique client mount is
 * driven end-to-end through `applyTeamMount` (the core of
 * `src/plugin/client.ts`) against a structural double of the five public
 * seams (host-seam-map, dev/agent-workflow/evidence/P9/host-seam-map.md,
 * pinned cd5ef814) plus a frozen-channel dispatcher double.
 *
 * Shim constraints (same as the T4 store test, scripts/test-vitest-shim.mjs):
 * `it()` bodies are SYNCHRONOUS only — the async scenarios run at module
 * level (top-level await) and the `it` blocks assert on the captured data.
 * The executed graph stays `.tsx`-free: this file imports the core module
 * only (never `src/plugin/client.js`, whose value imports resolve the
 * four `.tsx` components the plain-node runner cannot load).
 *
 * Covered: the four slot registrations (specs, orders, labels, component
 * identity), the locale dictionary effect, the fiber effects, the view /
 * dock inject faces (hooks sources, the S5-A/B/C/D faces, the dshHome-bound
 * legacyInspect), the single-flight cold read (D-T9-5) with the frozen
 * `team.getProjection` endpoint shape, the first-frame ledger auto-open,
 * the ordinary-session typed failure (zero state), the preset mapping
 * (broken filtered, trust dropped — D-T9-9), the native sessions seam
 * members (D-T9-10), the generation rebaseline (D-T9-7: loss schedules the
 * CLIENT_LOCAL backoff retry, restore cancels it and fires exactly one
 * pull), teardown (no carrier call after dispose), and the D-T9-1
 * dshHome-absent/blank variants (the legacyInspect face omitted).
 * Explicitly NOT exercised here: the reconnection-state internals (the
 * T4 store unit test) and transport loss (the T3 remote-client test).
 */
import { describe, expect, it } from 'vitest'

import type { TeamSessionId } from '../../contracts/src/index.js'
import {
  REMOTE_CONTRACT_VERSION,
  buildRemoteError,
  buildRemoteSuccess,
  type RemoteResponse,
} from '../../remote/src/index.js'
import {
  applyTeamMount,
  type TeamAgentPresetRow,
  type TeamAgentPresetsListResult,
  type TeamMountComponents,
  type TeamPluginClientConfig,
  type TeamPluginClientContext,
  type TeamPluginEffect,
  type TeamSlots,
} from '../src/plugin/team-mount-core.js'
import type { TeamRpcCarrier } from '../src/transport/host-seams.js'
import { en, zh } from '../src/ui/locales.js'
import type { NewTeamEntryProps } from '../src/ui/NewTeamEntry.js'
import type { TeamDockInjected, TeamDockProps } from '../src/ui/TeamDock.js'
import type { TeamSettingsSectionProps } from '../src/ui/TeamSettingsSection.js'
import type { TeamViewInjected, TeamViewProps } from '../src/ui/TeamView.js'

// ---------------------------------------------------------------------------
// Fixtures (the T4 projection fixtures, verbatim shape)
// ---------------------------------------------------------------------------

const METHOD = 'team.getProjection'

/** One frozen `team.getProjection` success envelope (G8 provenance intact). */
function projectionSuccess(
  teamSessionId: string,
  generation: number,
  provenanceGeneration?: number,
): RemoteResponse {
  return buildRemoteSuccess(
    {
      projection: {
        schemaVersion: 1,
        teamSessionId,
        blueprint: { blueprintId: 'b1', blueprintRevision: 1 },
        generation,
        generatedAt: '2026-08-29T00:00:00.000Z',
        root: { rootSessionId: teamSessionId },
        templates: [],
        members: [],
        ledger: { total: 0 },
      },
    },
    {
      method: METHOD,
      endpoint: METHOD,
      contractVersion: REMOTE_CONTRACT_VERSION,
      requestToken: null,
      projectionGeneration: provenanceGeneration === undefined ? generation : provenanceGeneration,
    },
  )
}

/** One frozen typed RPC error envelope. */
function projectionError(code: string, message: string): RemoteResponse {
  return buildRemoteError(code, message, {
    method: METHOD,
    endpoint: METHOD,
    contractVersion: REMOTE_CONTRACT_VERSION,
    requestToken: null,
  })
}

/** One typed `team.getLedgerPage` error (the test double's default page). */
function ledgerPageError(): RemoteResponse {
  return buildRemoteError('ledger-page-denied', 'ledger page denied by the test double', {
    method: 'team.getLedgerPage',
    endpoint: 'team.getLedgerPage',
    contractVersion: REMOTE_CONTRACT_VERSION,
    requestToken: null,
  })
}

/** Drain microtasks (the shim has no fake timers; the default scheduler's 1s
 * backoff macro-tasks never fire inside a microtask drain). */
async function flush(turns = 16): Promise<void> {
  for (let i = 0; i < turns; i++) await Promise.resolve()
}

// ---------------------------------------------------------------------------
// The mount test double (five public seams + the fiber effect)
// ---------------------------------------------------------------------------

interface CarrierCall {
  readonly endpoint: string
  readonly params: Record<string, unknown>
}

interface MountFixture {
  readonly ctx: TeamPluginClientContext
  readonly config: TeamPluginClientConfig | undefined
  readonly components: TeamMountComponents
  /** Every carrier call, in order (endpoint + the frozen envelope params). */
  readonly log: CarrierCall[]
  /** Queue one FIFO responder for an endpoint (consumed before the default). */
  readonly enqueue: (
    endpoint: string,
    responder: () => RemoteResponse | Promise<RemoteResponse>,
  ) => void
  readonly localeRegs: Array<{ readonly ns: string; readonly dicts: unknown }>
  readonly injects: Array<{ readonly key: string; readonly dispose: () => void }>
  readonly registers: Array<{
    readonly options: Record<string, unknown>
    readonly component: unknown
  }>
  readonly effects: Array<{ readonly label: string | undefined; readonly dispose: () => void }>
  /** Dispose every inject entry, then every tracked effect (reverse order). */
  readonly disposeAll: () => void
  /** Drive the connection generation seam (the plan §6.3 invalidation). */
  readonly generation: {
    readonly set: (snapshot: { readonly id: number } | undefined) => void
  }
  readonly sessions: {
    readonly opened: string[]
    readonly created: Array<{ workspaceId?: string } | null>
    /** Park a host-created session id for the next `refresh` (D-3 lag). */
    readonly announceHostSession: (sessionId: string) => void
    /** The `refresh` call count (the creation-path re-pull lane). */
    readonly refreshCount: () => number
  }
}

/** Build one seam-double fixture; the mount is applied by the caller. */
function makeMount(
  opts: {
    readonly config?: TeamPluginClientConfig
    readonly presets?: readonly TeamAgentPresetRow[]
  } = {},
): MountFixture {
  const log: CarrierCall[] = []
  const queues: Record<string, Array<() => RemoteResponse | Promise<RemoteResponse>>> = {}
  const enqueue = (
    endpoint: string,
    responder: () => RemoteResponse | Promise<RemoteResponse>,
  ): void => {
    const existing = queues[endpoint]
    if (existing === undefined) queues[endpoint] = [responder]
    else existing.push(responder)
  }

  // The carrier double: returns the RemoteResponse verbatim (the carrier
  // result IS the frozen dispatcher result — the T4 "no re-wrap" rule) and
  // records every call.
  const carrier: TeamRpcCarrier = {
    call: async (channel, endpoint, payload) => {
      if (channel !== '/team-remote') {
        throw new Error(`mount test: unexpected channel ${String(channel)}`)
      }
      const params = ((payload as { params?: unknown }).params ?? {}) as Record<string, unknown>
      log.push({ endpoint, params })
      const queue = queues[endpoint]
      const next = queue !== undefined ? queue.shift() : undefined
      let response: RemoteResponse
      if (next !== undefined) response = await next()
      else if (endpoint === 'team.getLedgerPage') response = ledgerPageError()
      else
        response = buildRemoteSuccess({}, {
          method: endpoint,
          endpoint,
          contractVersion: REMOTE_CONTRACT_VERSION,
          requestToken: null,
        })
      return response
    },
  }

  // The connection generation double (starts connected, id 1).
  let generationSnapshot: { readonly id: number } | undefined = { id: 1 }
  const generationListeners = new Set<() => void>()
  const generation = {
    getSnapshot: (): { readonly id: number } | undefined => generationSnapshot,
    subscribe: (listener: () => void): (() => void) => {
      generationListeners.add(listener)
      return () => {
        generationListeners.delete(listener)
      }
    },
    set: (snapshot: { readonly id: number } | undefined): void => {
      generationSnapshot = snapshot
      for (const listener of [...generationListeners]) listener()
    },
  }

  // The public sessions seam double (Seam 3, RENAMED open/create; the `list`
  // read face is the R121 prefill source — no current session in the
  // fixture, so `currentSessionId()` answers null). D-3: `open` throws for
  // an unknown id (the real `sessions.select` contract) — the host-created
  // root may not be in the client list store when the RPC lands, so the
  // double models the lag: `announceHostSession` parks an id that the next
  // `refresh` lands in the known set.
  const opened: string[] = []
  const created: Array<{ workspaceId?: string } | null> = []
  const knownSessions = new Set<string>(['m1'])
  const pendingHostSessions: string[] = []
  let refreshCount = 0
  const sessions = {
    create: async (o?: { readonly workspaceId?: string }): Promise<string> => {
      created.push(o ?? null)
      const id = `root-${created.length + 1}`
      knownSessions.add(id)
      return id
    },
    open: (sessionId: string): void => {
      if (!knownSessions.has(sessionId)) {
        throw new Error(`sessions.select: unknown session ${sessionId}`)
      }
      opened.push(sessionId)
    },
    refresh: async (): Promise<void> => {
      refreshCount++
      for (const id of pendingHostSessions.splice(0)) knownSessions.add(id)
    },
    list: {
      getSnapshot: () => ({ current: undefined }),
      subscribe: () => () => {},
    },
  }
  const announceHostSession = (sessionId: string): void => {
    pendingHostSessions.push(sessionId)
  }

  // The public remote seam double (Seam 6, SAME). The upstream public
  // contract answers the RemoteResult envelope (roster in `value`), so the
  // double wraps the rows accordingly.
  const presets: readonly TeamAgentPresetRow[] = opts.presets ?? []
  const remote = {
    agentPresets: {
      list: async (): Promise<TeamAgentPresetsListResult> => ({
        ok: true,
        value: { presets, authorable: false },
      }),
    },
  }

  // The locale runtime double (records registrations; bound translator
  // echoes `ns:key` so label assertions are exact).
  const localeRegs: Array<{ readonly ns: string; readonly dicts: unknown }> = []
  const locale = {
    // Rest-parameter signature: assignable to the real runtime's overloaded
    // generic `register` (both the namespace + dictionaries and the
    // ns/locale/dict forms) under strictFunctionTypes.
    register: (ns: string, ...rest: unknown[]): (() => void) => {
      localeRegs.push({ ns, dicts: rest[0] })
      return () => {}
    },
    bind: (ns: string) => (key: string): string => `${ns}:${key}`,
  }

  // The slots seam double: `register` records the option literal +
  // component; `inject` runs the callback immediately (the renderer
  // declaration-present path) and collects its effect.
  const registers: Array<{
    readonly options: Record<string, unknown>
    readonly component: unknown
  }> = []
  const injects: Array<{ readonly key: string; readonly dispose: () => void }> = []
  const slots: TeamSlots = {
    register: (options: object, component: unknown) => {
      registers.push({ options: options as Record<string, unknown>, component })
      return () => {}
    },
    inject: (key: string, callback: () => TeamPluginEffect) => {
      const entry: { key: string; dispose: () => void } = { key, dispose: () => {} }
      injects.push(entry)
      const effectResult = callback()
      if (typeof effectResult === 'function') {
        entry.dispose = effectResult
      } else {
        const disposers: Array<() => void> = [...effectResult]
        entry.dispose = () => {
          for (const dispose of disposers) dispose()
        }
      }
      return entry.dispose
    },
  }

  // The fiber effect double: runs the executor now; stores the disposer.
  const effects: Array<{ readonly label: string | undefined; readonly dispose: () => void }> = []
  const effect = (execute: () => TeamPluginEffect, label?: string): void => {
    const result = execute()
    let dispose: () => void
    if (typeof result === 'function') {
      dispose = result
    } else {
      const disposers: Array<() => void> = [...result]
      dispose = () => {
        for (const d of disposers) d()
      }
    }
    effects.push({ label, dispose })
  }

  const ctx: TeamPluginClientContext = {
    slots,
    locale,
    sessions,
    connection: { rpc: carrier, generation },
    remote,
    effect,
  }

  // The component doubles (never rendered: the mount only registers them).
  const components: TeamMountComponents = {
    view: (_props: TeamViewProps) => {
      throw new Error('mount test: component must not render')
    },
    dock: (_props: TeamDockProps) => {
      throw new Error('mount test: component must not render')
    },
    settings: (_props: TeamSettingsSectionProps) => {
      throw new Error('mount test: component must not render')
    },
    newTeamEntry: (_props: NewTeamEntryProps) => {
      throw new Error('mount test: component must not render')
    },
  }

  const disposeAll = (): void => {
    for (const entry of [...injects].reverse()) entry.dispose()
    for (const entry of [...effects].reverse()) entry.dispose()
  }

  return {
    ctx,
    config: opts.config,
    components,
    log,
    enqueue,
    localeRegs,
    injects,
    registers,
    effects,
    disposeAll,
    generation: { set: generation.set },
    sessions: { opened, created, announceHostSession, refreshCount: () => refreshCount },
  }
}

/** Resolve the registered conversation.view inject face for one session. */
function viewFaceOf(fixture: MountFixture, sessionId: string): TeamViewInjected {
  const viewReg = fixture.registers.find(
    (r) => (r.options as { name?: unknown }).name === 'conversation.view',
  )
  if (viewReg === undefined) throw new Error('mount test: conversation.view registration missing')
  const inject = (viewReg.options as { inject: (sessionId: string) => TeamViewInjected }).inject
  return inject(sessionId)
}

/** Resolve the registered conversation.input.dock inject face. */
function dockFaceOf(fixture: MountFixture): TeamDockInjected {
  const dockReg = fixture.registers.find(
    (r) => (r.options as { name?: unknown }).name === 'conversation.input.dock',
  )
  if (dockReg === undefined) throw new Error('mount test: conversation.input.dock registration missing')
  return (dockReg.options as { inject: () => TeamDockInjected }).inject()
}

// ---------------------------------------------------------------------------
// Scenario A: the base mount (config dshHome + the preset rows)
// ---------------------------------------------------------------------------

const aScenario = await (async () => {
  const a = makeMount({
    config: { dshHome: '/dsh-home' },
    presets: [
      { id: 'a', trust: 'system', isDefault: false },
      { id: 'b', trust: 'user', name: 'B', isDefault: true, broken: { code: 'x' } },
      { id: 'team', trust: 'system', isDefault: false },
    ],
  })
  applyTeamMount(a.ctx, { config: a.config, components: a.components })

  const viewFace = viewFaceOf(a, 't1')
  const dockFace = dockFaceOf(a)
  // The mount always provides the creation face; narrow the optional type.
  const creation = viewFace.creation
  if (creation === undefined) throw new Error('mount test: creation face missing')
  // The mount starts from the zero state: before the first cold read the
  // published mirror is empty (captured here because the `it` blocks run
  // after every scenario, when the live store already holds scenario B).
  const mirrorBeforeColdRead = viewFace.hooks.projectionMirror.getSnapshot()

  // The S5-A catalog list (the frozen endpoint, empty params).
  await creation.listCatalog()

  // The cold read: the frozen projection endpoint for the session id.
  a.enqueue('team.getProjection', () => projectionSuccess('t1', 1))
  await viewFace.ensureProjection('t1')
  await flush()
  const mirrorAfterT1 = viewFace.hooks.projectionMirror.getSnapshot()
  const ledgerStatesAfterT1 = viewFace.hooks.teamLedgers.getSnapshot()
  const ledgerLogAfterT1 = a.log.filter((c) => c.endpoint === 'team.getLedgerPage').length

  // Concurrent cold reads single-flight on the resolved team id (the
  // responder hangs on purpose: the episode never settles in the test).
  a.enqueue('team.getProjection', () => new Promise<RemoteResponse>(() => {}))
  const pendingA = viewFace.ensureProjection('t2')
  const pendingB = viewFace.ensureProjection('t2')
  const t2Calls = a.log.filter(
    (c) => c.endpoint === 'team.getProjection' && c.params.teamSessionId === 't2',
  ).length

  // An ordinary session: the typed failure resolves the cold read and
  // leaves the mirror untouched.
  a.enqueue('team.getProjection', () => projectionError('team-not-found', 'no such team'))
  await viewFace.ensureProjection('ordinary-1')
  await flush()
  const mirrorAfterOrdinary = viewFace.hooks.projectionMirror.getSnapshot()
  const ordinaryAttempt = a.log.some(
    (c) => c.endpoint === 'team.getProjection' && c.params.teamSessionId === 'ordinary-1',
  )

  // The dshHome-bound legacyInspect face.
  await viewFace.legacyInspect?.()

  // The preset mapping (broken filtered, trust dropped).
  const presetsOut = await creation.listAgentPresets()

  // The ledger refresh re-requests the page (one more typed failure).
  a.enqueue('team.getLedgerPage', ledgerPageError)
  await viewFace.refreshTeamLedger()
  const ledgerLogAfterRefresh = a.log.filter((c) => c.endpoint === 'team.getLedgerPage').length

  // The native seam members (the public sessions seam) — D-3: the creation
  // face no longer pre-creates natively (createRootSession is gone; the
  // host mints the root during team.create). It carries the robust
  // creation-path open: the host list lag is modeled by the double
  // (open misses, ONE refresh lands the session, the retry open succeeds);
  // a session the host never creates rejects verbatim after the re-pull;
  // a known session opens without a re-pull.
  a.sessions.announceHostSession('host-root-1')
  let createdOpenOk = false
  await creation.openCreatedSession('host-root-1').then(() => {
    createdOpenOk = true
  })
  const refreshAfterLag = a.sessions.refreshCount()
  const failingOpenMessage = await creation
    .openCreatedSession('host-root-2')
    .then(
      () => 'RESOLVED (unexpected)',
      (error: unknown) => (error instanceof Error ? error.message : String(error)),
    )
  const refreshAfterFail = a.sessions.refreshCount()
  await creation.openCreatedSession('m1')
  const refreshAfterKnown = a.sessions.refreshCount()
  viewFace.openSession('m1')

  const settingsReg = a.registers.find(
    (r) => (r.options as { name?: unknown }).name === 'settings.section',
  )
  const viewReg = a.registers.find(
    (r) => (r.options as { name?: unknown }).name === 'conversation.view',
  )
  const dockReg = a.registers.find(
    (r) => (r.options as { name?: unknown }).name === 'conversation.input.dock',
  )
  const newTeamReg = a.registers.find(
    (r) => (r.options as { name?: unknown }).name === 'sidebar.footer.action',
  )

  return {
    fixture: a,
    localeReg: a.localeRegs[0],
    localeRegsCount: a.localeRegs.length,
    injectKeys: a.injects.map((e) => e.key),
    effectLabels: a.effects.map((e) => e.label),
    effectsCount: a.effects.length,
    settingsOptions: settingsReg?.options,
    settingsComponent: settingsReg?.component,
    viewOptions: viewReg?.options,
    viewComponent: viewReg?.component,
    dockOptions: dockReg?.options,
    dockComponent: dockReg?.component,
    newTeamOptions: newTeamReg?.options,
    newTeamComponent: newTeamReg?.component,
    components: a.components,
    viewFace,
    dockFace,
    catalogCall: a.log.find((c) => c.endpoint === 'catalog.list'),
    t1Call: a.log.find(
      (c) => c.endpoint === 'team.getProjection' && c.params.teamSessionId === 't1',
    ),
    mirrorBeforeColdRead,
    mirrorAfterT1,
    ledgerStatesAfterT1,
    ledgerLogAfterT1,
    singleFlightSame: pendingA === pendingB,
    t2Calls,
    mirrorAfterOrdinary,
    ordinaryAttempt,
    legacyCall: a.log.find((c) => c.endpoint === 'legacy.inspect'),
    presetsOut,
    ledgerLogAfterRefresh,
    createdOpenOk,
    refreshAfterLag,
    refreshAfterFail,
    refreshAfterKnown,
    failingOpenMessage,
    created: a.sessions.created,
    opened: a.sessions.opened,
  }
})()

// ---------------------------------------------------------------------------
// Scenario B: the generation rebaseline (continuing A)
// ---------------------------------------------------------------------------

const bScenario = await (async () => {
  const a = aScenario.fixture
  const viewFace = aScenario.viewFace
  // The restore pull's response (the newer generation).
  a.enqueue('team.getProjection', () => projectionSuccess('t1', 2))
  // Loss: the bound projection store schedules the CLIENT_LOCAL backoff
  // retry (a 1s macro-task). Restore: the retry is cancelled and exactly
  // one pull fires (the frozen §6.3 guarantee — no live push).
  a.generation.set(undefined)
  a.generation.set({ id: 2 })
  await flush()
  const t1Calls = a.log.filter(
    (c) => c.endpoint === 'team.getProjection' && c.params.teamSessionId === 't1',
  ).length
  const mirrorT1 = viewFace.hooks.projectionMirror.getSnapshot()['t1' as TeamSessionId]
  // Ledger liveness: the applied frame advancing the generation (gen 1 ->
  // 2) re-pulls the ledger page at the tracker's anchor — one more call in
  // this double world (the default typed failure).
  const ledgerLogAfterGenAdvance = a.log.filter(
    (c) => c.endpoint === 'team.getLedgerPage',
  ).length
  return { t1Calls, mirrorT1, ledgerLogAfterGenAdvance }
})()

// ---------------------------------------------------------------------------
// Scenario C: the teardown (continuing B)
// ---------------------------------------------------------------------------

const cScenario = await (async () => {
  const a = aScenario.fixture
  const logBefore = a.log.length
  a.disposeAll()
  a.generation.set({ id: 3 })
  await flush()
  return { carrierUnchanged: a.log.length === logBefore }
})()

// ---------------------------------------------------------------------------
// Scenario D: the dshHome variants (absent + blank -> face omitted)
// ---------------------------------------------------------------------------

const dScenario = await (async () => {
  const d1 = makeMount()
  applyTeamMount(d1.ctx, { components: d1.components })
  const d1Face = viewFaceOf(d1, 't1')
  const d2 = makeMount({ config: { dshHome: '   ' } })
  applyTeamMount(d2.ctx, { config: d2.config, components: d2.components })
  const d2Face = viewFaceOf(d2, 't1')
  return {
    d1HasLegacy: d1Face.legacyInspect !== undefined,
    d2HasLegacy: d2Face.legacyInspect !== undefined,
    d1InjectKeys: d1.injects.map((e) => e.key),
    d1EffectsCount: d1.effects.length,
  }
})()

// ---------------------------------------------------------------------------
// Assertions (synchronous; the scenarios above are captured)
// ---------------------------------------------------------------------------

describe('P9-T9 (P9-S6) client mount — base mount (scenario A)', () => {
  it('registers the team locale dictionaries once under the team namespace', () => {
    expect(aScenario.localeRegsCount).toBe(1)
    expect(aScenario.localeReg).toEqual({ ns: 'team', dicts: { zh, en } })
  })

  it('injects exactly the four expected slot keys, in order', () => {
    expect(aScenario.injectKeys).toEqual([
      'settings.section',
      'conversation.view',
      'conversation.input.dock',
      'sidebar.footer.action',
    ])
  })

  it('tracks exactly three fiber effects, in mount order', () => {
    expect(aScenario.effectsCount).toBe(3)
    expect(aScenario.effectLabels).toEqual([
      'dsh-agent-team: dictionaries',
      'dsh-agent-team: store teardown',
      'dsh-agent-team: generation rebaseline',
    ])
  })

  it('registers the settings.section entry (id team, order 50, nav label, no inject)', () => {
    const options = aScenario.settingsOptions
    expect(options !== undefined).toBe(true)
    const o = options as Record<string, unknown>
    expect(o.name).toBe('settings.section')
    expect(o.id).toBe('team')
    expect(o.order).toBe(50)
    expect(o.locale).toBe('team')
    expect(typeof o.label).toBe('function')
    expect((o.label as () => string)()).toBe('team:nav')
    expect('inject' in o).toBe(false)
    expect(aScenario.settingsComponent).toBe(aScenario.components.settings)
  })

  it('registers the conversation.view entry (id team, order 20, view label + inject)', () => {
    const options = aScenario.viewOptions
    expect(options !== undefined).toBe(true)
    const o = options as Record<string, unknown>
    expect(o.name).toBe('conversation.view')
    expect(o.id).toBe('team')
    expect(o.order).toBe(20)
    expect(o.locale).toBe('team')
    expect(typeof o.label).toBe('function')
    expect((o.label as () => string)()).toBe('team:view.team')
    expect(typeof o.inject).toBe('function')
    expect(aScenario.viewComponent).toBe(aScenario.components.view)
  })

  it('registers the conversation.input.dock entry (id team, order 15, inject, no label)', () => {
    const options = aScenario.dockOptions
    expect(options !== undefined).toBe(true)
    const o = options as Record<string, unknown>
    expect(o.name).toBe('conversation.input.dock')
    expect(o.id).toBe('team')
    expect(o.order).toBe(15)
    expect(o.locale).toBe('team')
    expect(typeof o.inject).toBe('function')
    expect('label' in o).toBe(false)
    expect(aScenario.dockComponent).toBe(aScenario.components.dock)
  })

  it('registers the sidebar.footer.action entry (id team-new, order 10, entry label + inject — R118)', () => {
    const options = aScenario.newTeamOptions
    expect(options !== undefined).toBe(true)
    const o = options as Record<string, unknown>
    expect(o.name).toBe('sidebar.footer.action')
    expect(o.id).toBe('team-new')
    expect(o.order).toBe(10)
    expect(o.locale).toBe('team')
    expect(typeof o.label).toBe('function')
    expect((o.label as () => string)()).toBe('team:entry.label')
    expect(typeof o.inject).toBe('function')
    expect(aScenario.newTeamComponent).toBe(aScenario.components.newTeamEntry)
    // The injected face: the S5-A creation face members plus the
    // creation-path session open (D-3). NO handoff face — the overlay is
    // the T7 surface (frozen UI design §3.1: the global entry is
    // session-independent).
    const inject = (o.inject as () => Record<string, unknown>)()
    expect(typeof inject.listCatalog).toBe('function')
    expect(typeof inject.getCatalog).toBe('function')
    expect(typeof inject.probeCompatibility).toBe('function')
    expect(typeof inject.teamCreate).toBe('function')
    expect(typeof inject.openCreatedSession).toBe('function')
    expect(typeof inject.listAgentPresets).toBe('function')
    expect(typeof inject.currentSessionId).toBe('function')
    expect('openSession' in inject).toBe(false)
    expect('createRootSession' in inject).toBe(false)
    // R121: the prefill read face answers the Seam 3 current selection
    // (null in the fixture — no session is selected).
    expect((inject.currentSessionId as () => string | null)()).toBeNull()
    expect('handoff' in inject).toBe(false)
  })

  it('the view inject face carries the full P9-S6 face set (legacyInspect bound)', () => {
    const face = aScenario.viewFace
    expect(aScenario.mirrorBeforeColdRead).toEqual({})
    expect(typeof face.ensureProjection).toBe('function')
    expect(typeof face.refreshTeamLedger).toBe('function')
    expect(typeof face.openSession).toBe('function')
    expect(typeof face.creation).toBe('object')
    const creation = face.creation
    if (creation === undefined) throw new Error('mount test: creation face missing')
    expect(typeof creation.listCatalog).toBe('function')
    expect(typeof creation.openCreatedSession).toBe('function')
    expect(typeof creation.listAgentPresets).toBe('function')
    expect(typeof face.memberCommands).toBe('object')
    expect(typeof face.governance).toBe('object')
    expect(typeof face.handoff).toBe('object')
    expect(typeof face.legacyInspect).toBe('function')
  })

  it('the dock inject face shares the view projection mirror source (D-T9-4 no-op jump)', () => {
    expect(aScenario.dockFace.hooks.projectionMirror).toBe(aScenario.viewFace.hooks.projectionMirror)
    expect(typeof aScenario.dockFace.ensureProjection).toBe('function')
    expect(typeof aScenario.dockFace.openTeamTab).toBe('function')
    // D-T9-4: the degraded no-op must be side-effect-free (no carrier call).
    const callsBefore = aScenario.fixture.log.length
    aScenario.dockFace.openTeamTab()
    expect(aScenario.fixture.log.length).toBe(callsBefore)
  })

  it('the catalog list rides the frozen channel endpoint with empty params', () => {
    expect(aScenario.catalogCall).toEqual({ endpoint: 'catalog.list', params: {} })
  })

  it('the cold read pulls the frozen projection endpoint for the session', () => {
    expect(aScenario.t1Call).toEqual({
      endpoint: 'team.getProjection',
      params: { teamSessionId: 't1' },
    })
  })

  it('the applied frame lands in the published projection mirror', () => {
    const t1 = aScenario.mirrorAfterT1['t1' as TeamSessionId]
    expect(t1 !== undefined).toBe(true)
    expect(t1?.teamSessionId).toBe('t1')
    expect(t1?.generation).toBe(1)
  })

  it('the first frame auto-opens the team ledger store (typed failure settles)', () => {
    expect(aScenario.ledgerLogAfterT1).toBe(1)
    const ledgerState = aScenario.ledgerStatesAfterT1['t1']
    expect(ledgerState !== undefined).toBe(true)
    expect(ledgerState?.teamSessionId).toBe('t1')
    expect(ledgerState?.loading).toBe(false)
    expect(ledgerState?.error !== undefined).toBe(true)
  })

  it('concurrent cold reads single-flight on the resolved team id', () => {
    expect(aScenario.singleFlightSame).toBe(true)
    expect(aScenario.t2Calls).toBe(1)
  })

  it('an ordinary session cold read resolves typed failure with the mirror untouched', () => {
    expect(aScenario.ordinaryAttempt).toBe(true)
    expect('ordinary-1' in aScenario.mirrorAfterOrdinary).toBe(false)
    // Snapshot identity stability: the failed pull republished nothing.
    expect(aScenario.mirrorAfterOrdinary).toBe(aScenario.mirrorAfterT1)
  })

  it('the legacyInspect face binds the dshHome closure (D-T9-1)', () => {
    expect(aScenario.legacyCall).toEqual({
      endpoint: 'legacy.inspect',
      params: { dshHome: '/dsh-home' },
    })
  })

  it('the preset face filters the broken rows and drops the trust lane', () => {
    expect(aScenario.presetsOut).toEqual([
      { id: 'a', name: undefined, description: undefined, isDefault: false },
      { id: 'team', name: undefined, description: undefined, isDefault: false },
    ])
  })

  it('refreshTeamLedger re-requests the team ledger page', () => {
    expect(aScenario.ledgerLogAfterRefresh).toBe(2)
  })

  it('the creation-path open re-pulls the host list once for a lagging host-created root (D-3)', () => {
    expect(aScenario.createdOpenOk).toBe(true)
    // Exactly ONE re-pull for the lagging root; a known session opens
    // without one (the plain path is untouched).
    expect(aScenario.refreshAfterLag).toBe(1)
    expect(aScenario.refreshAfterKnown).toBe(aScenario.refreshAfterFail)
    // The lag path: the retry open lands after the refresh; the plain D9
    // open lane still works for a known session.
    expect(aScenario.opened).toEqual(['host-root-1', 'm1', 'm1'])
    // D-3: no native pre-creation anywhere in the mount (the host mints
    // the root during team.create).
    expect(aScenario.created).toEqual([])
  })

  it('a creation-path open that survives the re-pull rejects verbatim (D-3)', () => {
    expect(aScenario.failingOpenMessage).toBe('sessions.select: unknown session host-root-2')
    // The failed open still consumed exactly one re-pull attempt.
    expect(aScenario.refreshAfterFail).toBe(aScenario.refreshAfterLag + 1)
  })
})

describe('P9-T9 (P9-S6) client mount — generation rebaseline (scenario B)', () => {
  it('loss then restore fires exactly one rebaseline pull (the retry is cancelled)', () => {
    // Scenario A made one t1 cold read; the restore adds exactly one pull.
    expect(bScenario.t1Calls).toBe(2)
  })

  it('the restore pull applies the newer generation to the mirror', () => {
    expect(bScenario.mirrorT1?.generation).toBe(2)
  })

  it('the generation advance re-pulls the ledger page (ledger liveness)', () => {
    // Scenario A: the open catch-up + the manual refresh = 2 calls; the
    // gen 1 -> 2 applied frame adds exactly one refresh re-read at the
    // tracker's current anchor (the UI doc §27.5 real-time append).
    expect(bScenario.ledgerLogAfterGenAdvance).toBe(3)
  })
})

describe('P9-T9 (P9-S6) client mount — teardown (scenario C)', () => {
  it('teardown unsubscribes the generation seam and resets the stores', () => {
    // After disposeAll, a generation change issues no carrier call.
    expect(cScenario.carrierUnchanged).toBe(true)
  })
})

describe('P9-T9 (P9-S6) client mount — dshHome variants (scenario D)', () => {
  it('absent config omits the legacyInspect face (the T8 degraded zero state)', () => {
    expect(dScenario.d1HasLegacy).toBe(false)
  })

  it('blank config omits the legacyInspect face', () => {
    expect(dScenario.d2HasLegacy).toBe(false)
  })

  it('the registration shape is unchanged without the legacyInspect face', () => {
    expect(dScenario.d1InjectKeys).toEqual([
      'settings.section',
      'conversation.view',
      'conversation.input.dock',
      'sidebar.footer.action',
    ])
    expect(dScenario.d1EffectsCount).toBe(3)
  })
})
