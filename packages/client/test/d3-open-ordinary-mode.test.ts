/**
 * d3-open-ordinary-mode.test.ts — D3 (Team D1-D6 repair v2, D6) REWIRED
 * for the C1 restart-0.1.7-rc.1 recovery (guide §10.2 + §13.5, verdict
 * gate-5): the client mount's EXPLICIT ordinary-mode fallback entry
 * (`openOrdinaryMode`) is now the AWAITED two-phase sequence — (a) the
 * v5 `team.prepareOrdinaryOpen` one-shot permit MUST settle BEFORE (b)
 * the existing native `openSession` + the `'ordinary'` per-root mark —
 * and the Team-mode entry (`openTeamMode`) reconciles the session state
 * after a successful takeover (gate-5, the Q2 finding).
 *
 * Coverage (C1 task card, client-mount half; the §13.5 C1–C5 tests):
 *  - C1 (two-phase ordering): a settled ordinary open issues EXACTLY ONE
 *    team.* carrier call — the v5-stamped `team.prepareOrdinaryOpen`
 *    `{ teamSessionId }` — BEFORE the native open (sequence: prepare →
 *    open), and the session is opened exactly once with the root id;
 *  - C2 (typed permit failure): a typed permit rejection (e.g.
 *    TEAM_REMOTE_FOREIGN_TEAM) throws the `${code}: ${message}` error to
 *    the UI's async error lane — the session is NOT opened, the mode is
 *    NOT marked, and a STALE 'ordinary' mark from a prior attempt of the
 *    same root is cleared (no silent failure, no swallowing);
 *  - C3 (native-open failure): a failed native open (unknown session id —
 *    the seam's own throw) leaves NO 'ordinary' mark, and the carrier log
 *    carries EXACTLY the one permit call — there is NO revoke RPC (the
 *    armed permit lapses by TTL);
 *  - C4 (zero-ensure / zero-side-effect semantics): the ONLY team.* call
 *    of an ordinary entry is the v5 permit — ZERO `team.ensureRootLive`,
 *    zero Team Agent side effects, NO list refresh (the entry promises
 *    "no Team ensure is performed / activated as an ordinary Session
 *    Agent" — it is NOT a tool-removal operation, and it is NOT "zero
 *    team.* remote calls" — the permit itself is a Team control-plane
 *    RPC);
 *  - C5 (the team → ordinary → team switch): each Team entry issues its
 *    v3 `team.ensureRootLive` (zero `team.prepareOrdinaryOpen` from the
 *    team entries); the ordinary entry issues its v5 permit; the mode
 *    badge fact follows the entry used (team → ordinary → team); and a
 *    settled team entry records exactly ONE `sessions.refresh` (gate-5);
 *  - gate-5 (the post-takeover reconcile): a successful `openTeamMode`
 *    records `openSession` + `sessions.refresh` IN ORDER (the composer
 *    reconciles WITHOUT a reload); a typed ensure failure opens nothing,
 *    refreshes nothing, and returns the typed `{ ok: false, code,
 *    message }` to the UI's explicit error lane;
 *  - the per-root open-mode state still reads `'ordinary'` after the
 *    entry and the session-switch reset drops the 'ordinary' mark too
 *    (per-root, client-local — no remote field, no push/event/polling).
 *
 * Shim-constrained spec (run-tests.mjs): the `it()` bodies are
 * synchronous assertions on captured scenario state; the async scenarios
 * run at module level (top-level await).
 *
 * Matchers used: toBe / toEqual / toThrow (+ .not) only.
 */

import { describe, expect, it } from 'vitest'

import {
  REMOTE_CONTRACT_VERSION,
  REMOTE_CONTRACT_VERSION_V3,
  REMOTE_CONTRACT_VERSION_V5,
  buildRemoteError,
  buildRemoteSuccess,
  type RemoteResponse,
} from '../../remote/src/index.js'
import {
  applyTeamMount,
  type TeamMountComponents,
  type TeamPluginClientContext,
  type TeamSessionListSnapshot,
  type TeamSessionSummary,
  type TeamSlots,
} from '../src/plugin/team-mount-core.js'
import type { TeamRpcCarrier } from '../src/transport/host-seams.js'
import type { NewTeamEntryProps } from '../src/ui/NewTeamEntry.js'
import type { TeamDockProps } from '../src/ui/TeamDock.js'
import type { TeamSettingsSectionProps } from '../src/ui/TeamSettingsSection.js'
import type { TeamViewInjected, TeamViewProps } from '../src/ui/TeamView.js'

const ROOT = 'root-session-d3-client'
const OTHER = 'plain-session-d3'
const UNKNOWN = 'no-such-root-d3'

/** One ordered sequence entry (the two-phase ordering evidence, D2 style —
 *  C1: 'prepare' joins 'ensure' / 'open'; gate-5: 'refresh'). */
interface SequenceEntry {
  readonly op: 'prepare' | 'ensure' | 'open' | 'refresh'
  readonly id?: string
}

interface MountFixture {
  readonly ctx: TeamPluginClientContext
  readonly components: TeamMountComponents
  /** Every carrier call, with the FULL envelope payload (version stamping). */
  readonly log: Array<{ readonly channel: string; readonly endpoint: string; readonly payload: unknown }>
  /** The remote-client spy's `team.*` calls (the zero-ensure assertion; live view over the log). */
  readonly teamCalls: () => Array<{ readonly channel: string; readonly endpoint: string; readonly payload: unknown }>
  readonly enqueue: (
    endpoint: string,
    responder: () => RemoteResponse | Promise<RemoteResponse>,
  ) => void
  readonly registers: Array<{ readonly options: Record<string, unknown>; readonly component: unknown }>
  readonly effects: Array<{ readonly label: string | undefined; readonly dispose: () => void }>
  readonly disposeAll: () => void
  /** The ordering evidence (prepare / ensure vs open vs refresh, in call order). */
  readonly sequence: SequenceEntry[]
  readonly opened: string[]
  /** The `sessions.refresh` call count (the gate-5 reconcile lane). */
  readonly refreshCount: () => number
  /** Move the session-list current selection (fires the list listeners). */
  readonly setCurrent: (sessionId: string | undefined) => void
  readonly viewFace: (sessionId: string) => TeamViewInjected
}

/** Build one seam-double fixture (the five public seams, C1 edition). */
function makeMount(): MountFixture {
  const log: MountFixture['log'] = []
  const sequence: SequenceEntry[] = []
  const queues: Record<string, Array<() => RemoteResponse | Promise<RemoteResponse>>> = {}
  const enqueue = (
    endpoint: string,
    responder: () => RemoteResponse | Promise<RemoteResponse>,
  ): void => {
    const existing = queues[endpoint]
    if (existing === undefined) queues[endpoint] = [responder]
    else existing.push(responder)
  }

  // The carrier double: records channel + endpoint + the FULL payload
  // (the version stamping evidence), answers queued responders, then the
  // default responder: the v5 permit success for `team.prepareOrdinaryOpen`
  // (the host's one-shot permit fact — echo the requested teamSessionId)
  // and the empty v1 success for anything else.
  const carrier: TeamRpcCarrier = {
    call: async (channel, endpoint, payload) => {
      log.push({ channel, endpoint, payload })
      if (endpoint === 'team.prepareOrdinaryOpen') sequence.push({ op: 'prepare' })
      if (endpoint === 'team.ensureRootLive') sequence.push({ op: 'ensure' })
      const queue = queues[endpoint]
      const next = queue !== undefined ? queue.shift() : undefined
      if (next !== undefined) return next()
      if (endpoint === 'team.prepareOrdinaryOpen') {
        const envelope = payload as { params?: { teamSessionId?: unknown } }
        return buildRemoteSuccess(
          { rootSessionId: envelope.params?.teamSessionId ?? ROOT, permitted: true },
          {
            method: endpoint,
            endpoint,
            contractVersion: REMOTE_CONTRACT_VERSION_V5,
            requestToken: null,
          },
        )
      }
      return buildRemoteSuccess({}, {
        method: endpoint,
        endpoint,
        contractVersion: REMOTE_CONTRACT_VERSION,
        requestToken: null,
      })
    },
  }

  // The public sessions seam double (0.1.7 shape): the main-view open moved
  // to `uiWorkspace.openSession` and the `list.current` pointer became the
  // byId row's `retainedBy.mainView` count (the host's replaceMain releases
  // the previous row and retains the new one — modeled here). The reset
  // effect observes the list re-publish; unknown ids throw (the real 0.1.7
  // `resolveTarget`).
  const opened: string[] = []
  const knownSessions = new Set<string>([ROOT, OTHER])
  let refreshCount = 0
  const byId: Record<string, TeamSessionSummary> = {
    [ROOT]: { id: ROOT, retainedBy: {} },
    [OTHER]: { id: OTHER, retainedBy: {} },
  }
  const listListeners = new Set<() => void>()
  const publishList = (): void => {
    for (const listener of [...listListeners]) listener()
  }
  const setMainView = (sessionId: string | undefined): void => {
    for (const id of Object.keys(byId)) {
      byId[id] = { id, retainedBy: id === sessionId ? { mainView: 1 } : {} }
    }
  }
  const sessions = {
    create: async (): Promise<string> => {
      const id = `root-${opened.length + 1}`
      knownSessions.add(id)
      return id
    },
    refresh: async (): Promise<void> => {
      refreshCount++
      sequence.push({ op: 'refresh' })
    },
    list: {
      getSnapshot: (): TeamSessionListSnapshot => ({ byId }),
      subscribe: (listener: () => void): (() => void) => {
        listListeners.add(listener)
        return () => {
          listListeners.delete(listener)
        }
      },
    },
    retainInfo: () => ({
      getSnapshot: () => ({ referenceCount: 0, retainedBy: {} }),
      subscribe: () => () => {},
    }),
  }
  // The 0.1.7 navigation seam double (0.1.5: `sessions.open`).
  const uiWorkspace = {
    openSession: (sessionId: string): void => {
      if (!knownSessions.has(sessionId)) {
        throw new Error(`sessions.retain: unknown session ${sessionId}`)
      }
      opened.push(sessionId)
      sequence.push({ op: 'open', id: sessionId })
      setMainView(sessionId)
      publishList()
    },
  }

  // The connection generation double (static: connected, id 1).
  const generation = {
    getSnapshot: () => ({ id: 1 }) as { readonly id: number } | undefined,
    subscribe: (listener: () => void): (() => void) => {
      void listener
      return () => undefined
    },
  }

  // The public remote seam double (Seam 6, SAME — no presets needed).
  const remote = {
    agentPresets: {
      list: async (): Promise<{ ok: true; value: { presets: []; modeSelectionEnabled: boolean } }> => ({
        ok: true,
        value: { presets: [], modeSelectionEnabled: false },
      }),
    },
  }

  // The locale runtime double (echoes `ns:key` so label assertions are exact).
  const locale = {
    register: (ns: string, ...rest: unknown[]): (() => void) => {
      void ns
      void rest
      return () => undefined
    },
    bind: (ns: string) => (key: string): string => `${ns}:${key}`,
  }

  // The slots seam double: records the option literal + component.
  const registers: MountFixture['registers'] = []
  const injects: Array<{ readonly key: string; readonly dispose: () => void }> = []
  const slots: TeamSlots = {
    register: (options: object, component: unknown) => {
      registers.push({ options: options as Record<string, unknown>, component })
      return () => undefined
    },
    inject: (key: string, callback: () => unknown) => {
      const entry: { key: string; dispose: () => void } = { key, dispose: () => undefined }
      injects.push(entry)
      const effectResult = callback()
      if (typeof effectResult === 'function') {
        entry.dispose = effectResult as unknown as () => void
      } else {
        const disposers: Array<() => void> = [...(effectResult as unknown as Array<() => void>)]
        entry.dispose = () => {
          for (const dispose of disposers) dispose()
        }
      }
      return entry.dispose
    },
  }

  // The fiber effect double: runs the executor now; stores the disposer.
  const effects: MountFixture['effects'] = []
  const effect = (execute: () => unknown, label?: string): void => {
    const result = execute()
    let dispose: () => void
    if (typeof result === 'function') {
      dispose = result as () => void
    } else {
      const disposers: Array<() => void> = [...(result as unknown as Array<() => void>)]
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
    uiWorkspace,
    connection: { rpc: carrier, generation },
    remote,
    effect,
  }

  // The component doubles (never rendered: the mount only registers them).
  const components: TeamMountComponents = {
    view: (_props: TeamViewProps) => {
      throw new Error('D3 mount test: component must not render')
    },
    dock: (_props: TeamDockProps) => {
      throw new Error('D3 mount test: component must not render')
    },
    settings: (_props: TeamSettingsSectionProps) => {
      throw new Error('D3 mount test: component must not render')
    },
    newTeamEntry: (_props: NewTeamEntryProps) => {
      throw new Error('D3 mount test: component must not render')
    },
  }

  const disposeAll = (): void => {
    for (const entry of [...injects].reverse()) entry.dispose()
    for (const entry of [...effects].reverse()) entry.dispose()
  }

  const viewFace = (sessionId: string): TeamViewInjected => {
    const viewReg = registers.find((r) => (r.options as { name?: unknown }).name === 'conversation.view')
    if (viewReg === undefined) throw new Error('D3 mount test: conversation.view registration missing')
    const inject = (viewReg.options as { inject: (sessionId: string) => TeamViewInjected }).inject
    return inject(sessionId)
  }

  return {
    ctx,
    components,
    log,
    teamCalls: () => log.filter((c) => c.endpoint.startsWith('team.')),
    enqueue,
    registers,
    effects,
    disposeAll,
    sequence,
    opened,
    refreshCount: () => refreshCount,
    setCurrent: (sessionId: string | undefined) => {
      setMainView(sessionId)
      publishList()
    },
    viewFace,
  }
}

/** Apply the mount and resolve the view inject face for the root. */
async function mountedView(
  fixture: MountFixture,
): Promise<{ fixture: MountFixture; face: TeamViewInjected }> {
  applyTeamMount(fixture.ctx, { components: fixture.components })
  return { fixture, face: fixture.viewFace(ROOT) }
}

/** One v3 `team.ensureRootLive` success envelope (the D2 wire shape). */
function ensureLiveSuccess(): RemoteResponse {
  return buildRemoteSuccess(
    { rootSessionId: ROOT, mode: 'team', live: true },
    {
      method: 'team.ensureRootLive',
      endpoint: 'team.ensureRootLive',
      contractVersion: REMOTE_CONTRACT_VERSION_V3,
      requestToken: null,
    },
  )
}

/** One typed v5 permit rejection envelope (C2). */
function permitRejection(): RemoteResponse {
  return buildRemoteError(
    'TEAM_REMOTE_FOREIGN_TEAM',
    'root is not inside this team session',
    {
      method: 'team.prepareOrdinaryOpen',
      endpoint: 'team.prepareOrdinaryOpen',
      contractVersion: REMOTE_CONTRACT_VERSION_V5,
      requestToken: null,
    },
  )
}

/** One typed v3 ensure rejection envelope (gate-5 failure lane). */
function ensureRejection(): RemoteResponse {
  return buildRemoteError(
    'TEAM_REMOTE_TEAM_ROOT_LIVE_PORT_UNAVAILABLE',
    'ensure port unavailable',
    {
      method: 'team.ensureRootLive',
      endpoint: 'team.ensureRootLive',
      contractVersion: REMOTE_CONTRACT_VERSION_V3,
      requestToken: null,
    },
  )
}

// ---------------------------------------------------------------------------
// Module-level scenarios (the shim's it() bodies are synchronous)
// ---------------------------------------------------------------------------

// C1 + C4: one settled ordinary open — the awaited two-phase sequence.
const ordinaryScenario = await (async () => {
  const fixture = makeMount()
  const { face } = await mountedView(fixture)
  const openOrdinaryMode = face.openOrdinaryMode
  if (openOrdinaryMode === undefined) throw new Error('D3 mount test: openOrdinaryMode face missing')
  const teamOpenMode = face.teamOpenMode
  if (teamOpenMode === undefined) throw new Error('D3 mount test: teamOpenMode face missing')
  await openOrdinaryMode(ROOT)
  const mode = teamOpenMode(ROOT)
  fixture.disposeAll()
  return { fixture, mode }
})()

// C2: a typed permit rejection — never open, never mark (stale mark
// cleared too), the typed error rides the async error lane.
const permitRejectionScenario = await (async () => {
  const fixture = makeMount()
  const { face } = await mountedView(fixture)
  const openOrdinaryMode = face.openOrdinaryMode
  if (openOrdinaryMode === undefined) throw new Error('D3 mount test: openOrdinaryMode face missing')
  const teamOpenMode = face.teamOpenMode
  if (teamOpenMode === undefined) throw new Error('D3 mount test: teamOpenMode face missing')
  // Arm a stale 'ordinary' mark first (a prior successful attempt).
  await openOrdinaryMode(ROOT)
  const modeBefore = teamOpenMode(ROOT)
  fixture.enqueue('team.prepareOrdinaryOpen', permitRejection)
  let threw = false
  let message = ''
  try {
    await openOrdinaryMode(ROOT)
  } catch (error: unknown) {
    threw = true
    message = error instanceof Error ? error.message : String(error)
  }
  const modeAfter = teamOpenMode(ROOT)
  fixture.disposeAll()
  return { fixture, modeBefore, threw, message, modeAfter }
})()

// C3: a failed native open (unknown session id) — no mark, EXACTLY the one
// permit call on the wire (there is NO revoke RPC — the permit lapses by
// TTL).
const nativeOpenRejectionScenario = await (async () => {
  const fixture = makeMount()
  const { face } = await mountedView(fixture)
  const openOrdinaryMode = face.openOrdinaryMode
  if (openOrdinaryMode === undefined) throw new Error('D3 mount test: openOrdinaryMode face missing')
  const teamOpenMode = face.teamOpenMode
  if (teamOpenMode === undefined) throw new Error('D3 mount test: teamOpenMode face missing')
  let threw = false
  let message = ''
  try {
    await openOrdinaryMode(UNKNOWN)
  } catch (error: unknown) {
    threw = true
    message = error instanceof Error ? error.message : String(error)
  }
  const unknownMark = teamOpenMode(UNKNOWN)
  const rootMark = teamOpenMode(ROOT)
  fixture.disposeAll()
  return { fixture, threw, message, unknownMark, rootMark }
})()

// C5: the team → ordinary → team switch — each team entry issues its v3
// ensure (zero permits from the team entries); the ordinary entry issues
// its v5 permit; gate-5 records one refresh per settled team entry.
const switchScenario = await (async () => {
  const fixture = makeMount()
  fixture.enqueue('team.ensureRootLive', ensureLiveSuccess)
  fixture.enqueue('team.ensureRootLive', ensureLiveSuccess)
  const { face } = await mountedView(fixture)
  const openTeamMode = face.openTeamMode
  const openOrdinaryMode = face.openOrdinaryMode
  const teamOpenMode = face.teamOpenMode
  if (openTeamMode === undefined) throw new Error('D3 mount test: openTeamMode face missing')
  if (openOrdinaryMode === undefined) throw new Error('D3 mount test: openOrdinaryMode face missing')
  if (teamOpenMode === undefined) throw new Error('D3 mount test: teamOpenMode face missing')
  const result1 = await openTeamMode(ROOT)
  const modeAfterTeam1 = teamOpenMode(ROOT)
  await openOrdinaryMode(ROOT)
  const modeAfterOrdinary = teamOpenMode(ROOT)
  const result2 = await openTeamMode(ROOT)
  const modeAfterTeam2 = teamOpenMode(ROOT)
  fixture.disposeAll()
  return { fixture, result1, result2, modeAfterTeam1, modeAfterOrdinary, modeAfterTeam2 }
})()

// The idempotent ordinary repeat (C1 ordering twice, C4 zero-ensure twice).
const idempotentScenario = await (async () => {
  const fixture = makeMount()
  const { face } = await mountedView(fixture)
  const openOrdinaryMode = face.openOrdinaryMode
  if (openOrdinaryMode === undefined) throw new Error('D3 mount test: openOrdinaryMode face missing')
  const teamOpenMode = face.teamOpenMode
  if (teamOpenMode === undefined) throw new Error('D3 mount test: teamOpenMode face missing')
  await openOrdinaryMode(ROOT)
  await openOrdinaryMode(ROOT)
  const mode = teamOpenMode(ROOT)
  fixture.disposeAll()
  return { fixture, mode }
})()

// The session-switch reset (the D2 reset effect covers the ordinary mark
// too).
const resetScenario = await (async () => {
  const fixture = makeMount()
  const { face } = await mountedView(fixture)
  const openOrdinaryMode = face.openOrdinaryMode
  if (openOrdinaryMode === undefined) throw new Error('D3 mount test: openOrdinaryMode face missing')
  const teamOpenMode = face.teamOpenMode
  if (teamOpenMode === undefined) throw new Error('D3 mount test: teamOpenMode face missing')
  await openOrdinaryMode(ROOT)
  const modeAfterOpen = teamOpenMode(ROOT)
  fixture.setCurrent(OTHER)
  const modeAfterSwitch = teamOpenMode(ROOT)
  fixture.disposeAll()
  return { modeAfterOpen, modeAfterSwitch }
})()

// gate-5: a successful Team-mode takeover records openSession +
// sessions.refresh IN ORDER (the reconcile — no reload needed).
const gate5SuccessScenario = await (async () => {
  const fixture = makeMount()
  fixture.enqueue('team.ensureRootLive', ensureLiveSuccess)
  const { face } = await mountedView(fixture)
  const openTeamMode = face.openTeamMode
  if (openTeamMode === undefined) throw new Error('D3 mount test: openTeamMode face missing')
  const teamOpenMode = face.teamOpenMode
  if (teamOpenMode === undefined) throw new Error('D3 mount test: teamOpenMode face missing')
  const result = await openTeamMode(ROOT)
  const mode = teamOpenMode(ROOT)
  fixture.disposeAll()
  return { fixture, result, mode }
})()

// gate-5: a typed ensure failure opens nothing, refreshes nothing, and
// returns the typed outcome (the UI's explicit error lane).
const gate5FailureScenario = await (async () => {
  const fixture = makeMount()
  fixture.enqueue('team.ensureRootLive', ensureRejection)
  const { face } = await mountedView(fixture)
  const openTeamMode = face.openTeamMode
  if (openTeamMode === undefined) throw new Error('D3 mount test: openTeamMode face missing')
  const teamOpenMode = face.teamOpenMode
  if (teamOpenMode === undefined) throw new Error('D3 mount test: teamOpenMode face missing')
  const result = await openTeamMode(ROOT)
  const mode = teamOpenMode(ROOT)
  fixture.disposeAll()
  return { fixture, result, mode }
})()

// ---------------------------------------------------------------------------
// Assertions (synchronous it() bodies over the captured scenario state)
// ---------------------------------------------------------------------------

describe('C1 (client mount): the ordinary entry is the awaited two-phase sequence (guide §10.2)', () => {
  it('the ordering is pinned: the v5 permit settles BEFORE the native open (prepare → open)', () => {
    expect(ordinaryScenario.fixture.sequence).toEqual([
      { op: 'prepare' },
      { op: 'open', id: ROOT },
    ])
  })

  it('EXACTLY ONE team.* call rides the entry: the v5-stamped team.prepareOrdinaryOpen { teamSessionId } (the permit is a Team control-plane RPC)', () => {
    const teamCalls = ordinaryScenario.fixture.teamCalls()
    expect(teamCalls.length).toBe(1)
    const call = teamCalls[0]
    if (call === undefined) throw new Error('missing captured team call')
    expect(call.channel).toBe('/team-remote')
    expect(call.endpoint).toBe('team.prepareOrdinaryOpen')
    expect(call.payload).toEqual({
      version: REMOTE_CONTRACT_VERSION_V5,
      params: { teamSessionId: ROOT },
    })
  })

  it('the root session is opened exactly once with the root id (openSession verbatim)', () => {
    expect(ordinaryScenario.fixture.opened).toEqual([ROOT])
  })

  it('the per-root open-mode state reads ordinary (the D2 state map gains the value)', () => {
    expect(ordinaryScenario.mode).toBe('ordinary')
  })
})

describe('C4 (client mount): zero-ensure / zero-side-effect semantics', () => {
  it('ZERO team.ensureRootLive calls ride the ordinary entry (the ONLY team.* call is the v5 permit — not "zero team.* calls", but zero Team ensure)', () => {
    for (const call of ordinaryScenario.fixture.teamCalls()) {
      expect(call.endpoint).not.toBe('team.ensureRootLive')
    }
    expect(ordinaryScenario.fixture.teamCalls().filter(c => c.endpoint === 'team.prepareOrdinaryOpen').length).toBe(1)
  })

  it('no list refresh rides the ordinary open (no reconcile, no reload — the ordinary path is the native open)', () => {
    expect(ordinaryScenario.fixture.refreshCount()).toBe(0)
  })

  it('the ordinary entry never issues a create / mutation / admit endpoint (zero Team Agent side effects)', () => {
    const endpoints = ordinaryScenario.fixture.teamCalls().map(c => c.endpoint)
    expect(endpoints.includes('team.create')).toBe(false)
    expect(endpoints.includes('team.admitInitialWork')).toBe(false)
    expect(endpoints.includes('team.ensureRootLive')).toBe(false)
  })
})

describe('C2 (client mount): a typed permit rejection (the async error lane, never swallowed)', () => {
  it('the rejection throws the `${code}: ${message}` error verbatim', () => {
    expect(permitRejectionScenario.threw).toBe(true)
    expect(permitRejectionScenario.message).toBe('TEAM_REMOTE_FOREIGN_TEAM: root is not inside this team session')
  })

  it('the session is NOT opened (no second open) and NO mark is set — a STALE ordinary mark from a prior attempt is cleared', () => {
    expect(permitRejectionScenario.fixture.opened).toEqual([ROOT])
    expect(permitRejectionScenario.modeBefore).toBe('ordinary')
    expect(permitRejectionScenario.modeAfter).toBeNull()
  })

  it('EXACTLY the two permit calls ride the wire (the rejection settles the phase; no open, no revoke, no refresh)', () => {
    const teamCalls = permitRejectionScenario.fixture.teamCalls()
    expect(teamCalls.length).toBe(2)
    for (const call of teamCalls) {
      expect(call.endpoint).toBe('team.prepareOrdinaryOpen')
    }
    expect(permitRejectionScenario.fixture.refreshCount()).toBe(0)
  })
})

describe('C3 (client mount): a failed native open (open first, mark after — a failed switch is no switch)', () => {
  it('the seam throw propagates (the typed message rides the async error lane)', () => {
    expect(nativeOpenRejectionScenario.threw).toBe(true)
    expect(nativeOpenRejectionScenario.message).toContain('unknown session')
  })

  it('NO mark is set for the failed root (and none for the root)', () => {
    expect(nativeOpenRejectionScenario.unknownMark).toBeNull()
    expect(nativeOpenRejectionScenario.rootMark).toBeNull()
  })

  it('the carrier log carries EXACTLY the one permit call — there is NO revoke RPC (the armed permit lapses by TTL)', () => {
    const teamCalls = nativeOpenRejectionScenario.fixture.teamCalls()
    expect(teamCalls.length).toBe(1)
    const call = teamCalls[0]
    if (call === undefined) throw new Error('missing captured team call')
    expect(call.endpoint).toBe('team.prepareOrdinaryOpen')
    expect(call.payload).toEqual({
      version: REMOTE_CONTRACT_VERSION_V5,
      params: { teamSessionId: UNKNOWN },
    })
  })
})

describe('C5 (client mount): the team → ordinary → team switch', () => {
  it('the mode badge fact follows the ENTRY used: team → ordinary → team', () => {
    expect(switchScenario.modeAfterTeam1).toBe('team')
    expect(switchScenario.modeAfterOrdinary).toBe('ordinary')
    expect(switchScenario.modeAfterTeam2).toBe('team')
  })

  it('the team entries issue EXACTLY their two v3 team.ensureRootLive calls (ZERO team.prepareOrdinaryOpen from the team entries) and the ordinary entry issues its one v5 permit', () => {
    const teamCalls = switchScenario.fixture.teamCalls()
    expect(teamCalls.length).toBe(3)
    const first = teamCalls[0]
    const second = teamCalls[1]
    const third = teamCalls[2]
    if (first === undefined || second === undefined || third === undefined) {
      throw new Error('missing captured team call')
    }
    expect(first.endpoint).toBe('team.ensureRootLive')
    expect(first.payload).toEqual({
      version: REMOTE_CONTRACT_VERSION_V3,
      params: { teamSessionId: ROOT },
    })
    expect(second.endpoint).toBe('team.prepareOrdinaryOpen')
    expect(second.payload).toEqual({
      version: REMOTE_CONTRACT_VERSION_V5,
      params: { teamSessionId: ROOT },
    })
    expect(third.endpoint).toBe('team.ensureRootLive')
    expect(third.payload).toEqual({
      version: REMOTE_CONTRACT_VERSION_V3,
      params: { teamSessionId: ROOT },
    })
  })

  it('the ordering is pinned: ensure → open → refresh for each team entry (gate-5), prepare → open for the ordinary step', () => {
    expect(switchScenario.fixture.sequence).toEqual([
      { op: 'ensure' },
      { op: 'open', id: ROOT },
      { op: 'refresh' },
      { op: 'prepare' },
      { op: 'open', id: ROOT },
      { op: 'ensure' },
      { op: 'open', id: ROOT },
      { op: 'refresh' },
    ])
  })

  it('the root session is opened once per entry (three entries, three opens) and each settled team entry returns { ok: true }', () => {
    expect(switchScenario.fixture.opened).toEqual([ROOT, ROOT, ROOT])
    expect(switchScenario.result1).toEqual({ ok: true })
    expect(switchScenario.result2).toEqual({ ok: true })
  })

  it('gate-5: exactly ONE sessions.refresh per settled team entry (two team entries → two refreshes; the ordinary step refreshes nothing)', () => {
    expect(switchScenario.fixture.refreshCount()).toBe(2)
  })
})

describe('C1/C4 (client mount): the idempotent ordinary repeat', () => {
  it('the same entry twice: two permits + two opens (the prepare → open ordering twice), no error, the mode stays ordinary', () => {
    expect(idempotentScenario.fixture.sequence).toEqual([
      { op: 'prepare' },
      { op: 'open', id: ROOT },
      { op: 'prepare' },
      { op: 'open', id: ROOT },
    ])
    expect(idempotentScenario.fixture.opened).toEqual([ROOT, ROOT])
    expect(idempotentScenario.mode).toBe('ordinary')
    const teamCalls = idempotentScenario.fixture.teamCalls()
    expect(teamCalls.length).toBe(2)
    for (const call of teamCalls) {
      expect(call.endpoint).toBe('team.prepareOrdinaryOpen')
      expect(call.payload).toEqual({
        version: REMOTE_CONTRACT_VERSION_V5,
        params: { teamSessionId: ROOT },
      })
    }
  })
})

describe('D3 (client mount): the session-switch reset (the D2 reset effect covers the ordinary mark too)', () => {
  it('after an ordinary open the root reads ordinary; a switch away drops the ordinary mark', () => {
    expect(resetScenario.modeAfterOpen).toBe('ordinary')
    expect(resetScenario.modeAfterSwitch).toBeNull()
  })
})

describe('gate-5 (client mount): the post-takeover session-state reconcile', () => {
  it('a successful Team-mode takeover records openSession + sessions.refresh IN ORDER (the composer reconciles WITHOUT a reload)', () => {
    expect(gate5SuccessScenario.result).toEqual({ ok: true })
    expect(gate5SuccessScenario.fixture.sequence).toEqual([
      { op: 'ensure' },
      { op: 'open', id: ROOT },
      { op: 'refresh' },
    ])
    expect(gate5SuccessScenario.fixture.opened).toEqual([ROOT])
    expect(gate5SuccessScenario.fixture.refreshCount()).toBe(1)
    expect(gate5SuccessScenario.mode).toBe('team')
  })

  it('a typed ensure failure opens nothing, refreshes nothing, and returns the typed { ok: false, code, message } (no error swallowing)', () => {
    expect(gate5FailureScenario.result).toEqual({
      ok: false,
      code: 'TEAM_REMOTE_TEAM_ROOT_LIVE_PORT_UNAVAILABLE',
      message: 'ensure port unavailable',
    })
    expect(gate5FailureScenario.fixture.opened).toEqual([])
    expect(gate5FailureScenario.fixture.refreshCount()).toBe(0)
    expect(gate5FailureScenario.mode).toBeNull()
    // the ensure rejection still rides the wire exactly once (the typed
    // outcome is the RPC result, not a swallow)
    const teamCalls = gate5FailureScenario.fixture.teamCalls()
    expect(teamCalls.length).toBe(1)
    const call = teamCalls[0]
    if (call === undefined) throw new Error('missing captured team call')
    expect(call.endpoint).toBe('team.ensureRootLive')
  })
})
