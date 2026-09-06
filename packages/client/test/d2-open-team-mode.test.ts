/**
 * d2-open-team-mode.test.ts — D2 (Team D1-D6 repair v2, D6): the client
 * mount's explicit open-in-Team-mode entry (`openTeamMode`) and its
 * per-root client-local open-mode state.
 *
 * Coverage (D2 task card, client-mount half):
 *  - the AWAITED two-phase sequence (A3 Q1 live-first): (a) the v3
 *    `team.ensureRootLive` guarantee MUST complete BEFORE (b) the native
 *    `ctx.sessions.open`; the carrier log carries the v3-stamped envelope
 *    (`{ version: 3, params: { teamSessionId } }` on the frozen
 *    `/team-remote` channel);
 *  - SUCCESS: the session is opened exactly once with the root id and
 *    the per-root open-mode state reads `'team'`;
 *  - ENSURE FAILURE: the session is NOT opened (never a silent open,
 *    never a silent adoption — A3 Q1), the typed error (code + message)
 *    is returned for the UI's explicit error lane, and the open-mode
 *    state reads `null` (no stale 'team' mark);
 *  - RESET ON SESSION SWITCH: when the session-list current selection
 *    moves away from the root, the root's 'team' mark is cleared (the
 *    mode badge is a per-client-session fact; no remote field, no
 *    push/event/polling);
 *  - the mode read is per root: a second root without a completed
 *    openTeamMode reads `null`.
 *
 * Shim-constrained spec (run-tests.mjs): the `it()` bodies are
 * synchronous assertions on captured scenario state; the async scenarios
 * run at module level (top-level await).
 *
 * Matchers used: toBe / toEqual / toThrow (+ .not) only.
 */

import { describe, expect, it } from 'vitest'

import type { TeamSessionId } from '../../contracts/src/index.js'
import {
  REMOTE_CONTRACT_VERSION,
  REMOTE_CONTRACT_VERSION_V3,
  buildRemoteError,
  buildRemoteSuccess,
  type RemoteResponse,
} from '../../remote/src/index.js'
import {
  applyTeamMount,
  type TeamMountComponents,
  type TeamPluginClientContext,
  type TeamSlots,
} from '../src/plugin/team-mount-core.js'
import type { TeamRpcCarrier } from '../src/transport/host-seams.js'
import type { NewTeamEntryProps } from '../src/ui/NewTeamEntry.js'
import type { TeamDockProps } from '../src/ui/TeamDock.js'
import type { TeamSettingsSectionProps } from '../src/ui/TeamSettingsSection.js'
import type { TeamViewInjected, TeamViewProps } from '../src/ui/TeamView.js'
import type { TeamOpenModeOutcome } from '../src/plugin/team-mount-core.js'

const ROOT = 'root-session-d2-client'
const OTHER = 'plain-session-d2'

/** One ordered sequence entry (the two-phase ordering evidence). */
interface SequenceEntry {
  readonly op: 'ensure' | 'open'
  readonly id?: string
}

interface MountFixture {
  readonly ctx: TeamPluginClientContext
  readonly components: TeamMountComponents
  /** Every carrier call, with the FULL envelope payload (version stamping). */
  readonly log: Array<{ readonly channel: string; readonly endpoint: string; readonly payload: unknown }>
  readonly enqueue: (
    endpoint: string,
    responder: () => RemoteResponse | Promise<RemoteResponse>,
  ) => void
  readonly registers: Array<{ readonly options: Record<string, unknown>; readonly component: unknown }>
  readonly effects: Array<{ readonly label: string | undefined; readonly dispose: () => void }>
  readonly disposeAll: () => void
  /** The two-phase ordering evidence (ensure vs open, in call order). */
  readonly sequence: SequenceEntry[]
  readonly opened: string[]
  /** Move the session-list current selection (fires the list listeners). */
  readonly setCurrent: (sessionId: string | undefined) => void
  readonly viewFace: (sessionId: string) => TeamViewInjected
}

/** Build one seam-double fixture (the five public seams, D2 edition). */
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
  // default empty success.
  const carrier: TeamRpcCarrier = {
    call: async (channel, endpoint, payload) => {
      log.push({ channel, endpoint, payload })
      if (endpoint === 'team.ensureRootLive') sequence.push({ op: 'ensure' })
      const queue = queues[endpoint]
      const next = queue !== undefined ? queue.shift() : undefined
      if (next !== undefined) return next()
      return buildRemoteSuccess({}, {
        method: endpoint,
        endpoint,
        contractVersion: REMOTE_CONTRACT_VERSION,
        requestToken: null,
      })
    },
  }

  // The public sessions seam double: `open` records the switch and moves
  // the list current selection (the real seam does this — the reset
  // effect observes it); unknown ids throw (the real `sessions.select`).
  const opened: string[] = []
  const knownSessions = new Set<string>([ROOT, OTHER])
  let current: string | undefined = undefined
  const listListeners = new Set<() => void>()
  const sessions = {
    create: async (): Promise<string> => {
      const id = `root-${opened.length + 1}`
      knownSessions.add(id)
      return id
    },
    open: (sessionId: string): void => {
      if (!knownSessions.has(sessionId)) {
        throw new Error(`sessions.select: unknown session ${sessionId}`)
      }
      opened.push(sessionId)
      sequence.push({ op: 'open', id: sessionId })
      current = sessionId
      for (const listener of [...listListeners]) listener()
    },
    refresh: async (): Promise<void> => undefined,
    list: {
      getSnapshot: () => ({ current }),
      subscribe: (listener: () => void): (() => void) => {
        listListeners.add(listener)
        return () => {
          listListeners.delete(listener)
        }
      },
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
      list: async (): Promise<{ ok: true; value: { presets: []; authorable: boolean } }> => ({
        ok: true,
        value: { presets: [], authorable: false },
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
    connection: { rpc: carrier, generation },
    remote,
    effect,
  }

  // The component doubles (never rendered: the mount only registers them).
  const components: TeamMountComponents = {
    view: (_props: TeamViewProps) => {
      throw new Error('D2 mount test: component must not render')
    },
    dock: (_props: TeamDockProps) => {
      throw new Error('D2 mount test: component must not render')
    },
    settings: (_props: TeamSettingsSectionProps) => {
      throw new Error('D2 mount test: component must not render')
    },
    newTeamEntry: (_props: NewTeamEntryProps) => {
      throw new Error('D2 mount test: component must not render')
    },
  }

  const disposeAll = (): void => {
    for (const entry of [...injects].reverse()) entry.dispose()
    for (const entry of [...effects].reverse()) entry.dispose()
  }

  const viewFace = (sessionId: string): TeamViewInjected => {
    const viewReg = registers.find((r) => (r.options as { name?: unknown }).name === 'conversation.view')
    if (viewReg === undefined) throw new Error('D2 mount test: conversation.view registration missing')
    const inject = (viewReg.options as { inject: (sessionId: string) => TeamViewInjected }).inject
    return inject(sessionId)
  }

  return {
    ctx,
    components,
    log,
    enqueue,
    registers,
    effects,
    disposeAll,
    sequence,
    opened,
    setCurrent: (sessionId: string | undefined) => {
      current = sessionId
      for (const listener of [...listListeners]) listener()
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

// ---------------------------------------------------------------------------
// Module-level scenarios (the shim's it() bodies are synchronous)
// ---------------------------------------------------------------------------

const successScenario = await (async () => {
  const fixture = makeMount()
  fixture.enqueue('team.ensureRootLive', () =>
    buildRemoteSuccess(
      { rootSessionId: ROOT, mode: 'team', live: true },
      {
        method: 'team.ensureRootLive',
        endpoint: 'team.ensureRootLive',
        contractVersion: REMOTE_CONTRACT_VERSION_V3,
        requestToken: null,
      },
    ),
  )
  const { face } = await mountedView(fixture)
  const openTeamMode = face.openTeamMode
  if (openTeamMode === undefined) throw new Error('D2 mount test: openTeamMode face missing')
  const result = await openTeamMode(ROOT)
  fixture.disposeAll()
  return { fixture, result, ensureLog: fixture.log.filter((c) => c.endpoint === 'team.ensureRootLive') }
})()

const failureScenario = await (async () => {
  const fixture = makeMount()
  fixture.enqueue('team.ensureRootLive', () =>
    buildRemoteError(
      'TEAM_REMOTE_TEAM_ROOT_LIVE_OUTSIDE_TEAM',
      `team.ensureRootLive: session '${ROOT}' is already live outside the Team glue — refusing to adopt it silently`,
      {
        method: 'team.ensureRootLive',
        endpoint: 'team.ensureRootLive',
        contractVersion: REMOTE_CONTRACT_VERSION_V3,
        requestToken: null,
      },
      { reason: 'domain-error' },
    ),
  )
  const { face } = await mountedView(fixture)
  const openTeamMode = face.openTeamMode
  if (openTeamMode === undefined) throw new Error('D2 mount test: openTeamMode face missing')
  const result = await openTeamMode(ROOT)
  const modeAfterFailure = face.teamOpenMode?.(ROOT)
  fixture.disposeAll()
  return { fixture, result, modeAfterFailure }
})()

const resetScenario = await (async () => {
  const fixture = makeMount()
  fixture.enqueue('team.ensureRootLive', () =>
    buildRemoteSuccess(
      { rootSessionId: ROOT, mode: 'team', live: true },
      {
        method: 'team.ensureRootLive',
        endpoint: 'team.ensureRootLive',
        contractVersion: REMOTE_CONTRACT_VERSION_V3,
        requestToken: null,
      },
    ),
  )
  const { face } = await mountedView(fixture)
  const openTeamMode = face.openTeamMode
  if (openTeamMode === undefined) throw new Error('D2 mount test: openTeamMode face missing')
  const teamOpenMode = face.teamOpenMode
  if (teamOpenMode === undefined) throw new Error('D2 mount test: teamOpenMode face missing')
  await openTeamMode(ROOT)
  const modeAfterOpen = teamOpenMode(ROOT)
  // a second root never completed openTeamMode: null
  const modeOtherRoot = teamOpenMode('root-session-d2-other')
  fixture.setCurrent(OTHER)
  const modeAfterSwitch = teamOpenMode(ROOT)
  fixture.disposeAll()
  return { modeAfterOpen, modeOtherRoot, modeAfterSwitch }
})()

// ---------------------------------------------------------------------------
// Assertions (synchronous it() bodies over the captured scenario state)
// ---------------------------------------------------------------------------

describe('D2 (client mount): openTeamMode two-phase sequence (A3 Q1 live-first)', () => {
  it('the v3 ensureRootLive is AWAITED before the native open (the ordering is pinned in the sequence)', () => {
    expect(successScenario.fixture.sequence.length).toBe(2)
    expect(successScenario.fixture.sequence[0]).toEqual({ op: 'ensure' })
    expect(successScenario.fixture.sequence[1]).toEqual({ op: 'open', id: ROOT })
  })

  it('the v3-stamped envelope rides the frozen channel (version 3, the closed { teamSessionId } param set)', () => {
    expect(successScenario.ensureLog.length).toBe(1)
    const call = successScenario.ensureLog[0]
    if (call === undefined) throw new Error('D2 mount test: ensureRootLive carrier call missing')
    expect(call.channel).toBe('/team-remote')
    expect(call.endpoint).toBe('team.ensureRootLive')
    expect(call.payload).toEqual({ version: REMOTE_CONTRACT_VERSION_V3, params: { teamSessionId: ROOT } })
    expect(call.payload).toEqual({ version: 3, params: { teamSessionId: ROOT } })
  })

  it('SUCCESS: the session is opened exactly once with the root id and the mode state reads team', () => {
    expect(successScenario.result).toEqual({ ok: true })
    expect(successScenario.fixture.opened).toEqual([ROOT])
  })
})

describe('D2 (client mount): the ensure-failure gate (never a silent open)', () => {
  it('a typed ensure failure: the session is NOT opened, the error is surfaced, the mode state reads null', () => {
    expect(failureScenario.fixture.opened).toEqual([])
    const result = failureScenario.result as TeamOpenModeOutcome
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.code).toBe('TEAM_REMOTE_TEAM_ROOT_LIVE_OUTSIDE_TEAM')
      expect(result.message).toContain('already live outside the Team glue')
    }
    expect(failureScenario.modeAfterFailure).toBeNull()
  })
})

describe('D2 (client mount): the per-root client-local open-mode state', () => {
  it('after a completed openTeamMode the root reads team; an unopened root reads null', () => {
    expect(resetScenario.modeAfterOpen).toBe('team')
    expect(resetScenario.modeOtherRoot).toBeNull()
  })

  it('a session switch away from the root resets the team mark', () => {
    expect(resetScenario.modeAfterSwitch).toBeNull()
  })
})
