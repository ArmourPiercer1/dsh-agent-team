/**
 * d3-open-ordinary-mode.test.ts — D3 (Team D1-D6 repair v2, D6): the
 * client mount's EXPLICIT ordinary-mode fallback entry
 * (`openOrdinaryMode`, v2 plan §1.1.3 / §12.D3) and the `'ordinary'`
 * value of the per-root client-local open-mode state (the D2 map gains
 * the value; reset on session switch as with D2).
 *
 * Coverage (D3 task card, client-mount half):
 *  - the ordinary entry is the EXISTING `openSession` verbatim (Seam 3,
 *    the pure `ctx.sessions.open` — A3 Q3): the session is opened exactly
 *    once with the root id and the remote-client spy records ZERO
 *    `team.*` calls (no `team.ensureRootLive`, no other team-remote
 *    method, no `session/create`-with-preset equivalent, no ensure-live
 *    step, no list refresh);
 *  - the per-root open-mode state reads `'ordinary'` after the entry and
 *    the session-switch reset drops the 'ordinary' mark too (per-root,
 *    client-local — no remote field, no push/event/polling);
 *  - SEMANTICS (A3 Q1 caveat 2, pinned): the ordinary entry is a promise
 *    of "no Team ensure is performed / team_* tools are NOT guaranteed" —
 *    NOT a tool-removal operation. The client-observable pin for the
 *    team → ordinary → team switch: the carrier log carries EXACTLY the
 *    two `team.ensureRootLive` calls of the two team entries and NO other
 *    team-remote method — the ordinary steps contribute zero carrier
 *    calls, so no TeamDomain repository write can ride the switch (the
 *    client's only authority over TeamDomain is the remote surface;
 *    `team.ensureRootLive` is the glue's agent-registry ensure-live, not
 *    a TeamDomain repository mutation — the handler side is pinned by
 *    D2). No duplicate agent registration is possible: the ordinary path
 *    performs no `agents.resume` at all — the glue map is host-side, the
 *    observable proxy here is the ABSENT `team.ensureRootLive` carrier
 *    call of every ordinary step (the AgentRegistry collision guard,
 *    A3 Q1 item 3, is the structural host-side guarantee);
 *  - idempotent repeat: the same entry twice opens twice, no error, the
 *    mode stays 'ordinary';
 *  - a FAILED ordinary open (unknown session id — the seam's own throw)
 *    leaves the prior mode mark intact (open first, mark after: a failed
 *    switch is no switch).
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

const ROOT = 'root-session-d3-client'
const OTHER = 'plain-session-d3'
const UNKNOWN = 'no-such-root-d3'

/** One ordered sequence entry (the two-phase ordering evidence, D2 style). */
interface SequenceEntry {
  readonly op: 'ensure' | 'open'
  readonly id?: string
}

interface MountFixture {
  readonly ctx: TeamPluginClientContext
  readonly components: TeamMountComponents
  /** Every carrier call, with the FULL envelope payload (version stamping). */
  readonly log: Array<{ readonly channel: string; readonly endpoint: string; readonly payload: unknown }>
  /** The remote-client spy's `team.*` calls (the zero-team-call assertion; live view over the log). */
  readonly teamCalls: () => Array<{ readonly channel: string; readonly endpoint: string; readonly payload: unknown }>
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
  /** The `sessions.refresh` call count (the creation-path re-pull lane). */
  readonly refreshCount: () => number
  /** Move the session-list current selection (fires the list listeners). */
  readonly setCurrent: (sessionId: string | undefined) => void
  readonly viewFace: (sessionId: string) => TeamViewInjected
}

/** Build one seam-double fixture (the five public seams, D3 edition). */
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
  let refreshCount = 0
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
    refresh: async (): Promise<void> => {
      refreshCount++
    },
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

// ---------------------------------------------------------------------------
// Module-level scenarios (the shim's it() bodies are synchronous)
// ---------------------------------------------------------------------------

const ordinaryScenario = await (async () => {
  const fixture = makeMount()
  const { face } = await mountedView(fixture)
  const openOrdinaryMode = face.openOrdinaryMode
  if (openOrdinaryMode === undefined) throw new Error('D3 mount test: openOrdinaryMode face missing')
  const teamOpenMode = face.teamOpenMode
  if (teamOpenMode === undefined) throw new Error('D3 mount test: teamOpenMode face missing')
  openOrdinaryMode(ROOT)
  const mode = teamOpenMode(ROOT)
  fixture.disposeAll()
  return { fixture, mode }
})()

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
  openOrdinaryMode(ROOT)
  const modeAfterOrdinary = teamOpenMode(ROOT)
  const result2 = await openTeamMode(ROOT)
  const modeAfterTeam2 = teamOpenMode(ROOT)
  fixture.disposeAll()
  return { fixture, result1, result2, modeAfterTeam1, modeAfterOrdinary, modeAfterTeam2 }
})()

const idempotentScenario = await (async () => {
  const fixture = makeMount()
  const { face } = await mountedView(fixture)
  const openOrdinaryMode = face.openOrdinaryMode
  if (openOrdinaryMode === undefined) throw new Error('D3 mount test: openOrdinaryMode face missing')
  const teamOpenMode = face.teamOpenMode
  if (teamOpenMode === undefined) throw new Error('D3 mount test: teamOpenMode face missing')
  openOrdinaryMode(ROOT)
  openOrdinaryMode(ROOT)
  const mode = teamOpenMode(ROOT)
  fixture.disposeAll()
  return { fixture, mode }
})()

const resetScenario = await (async () => {
  const fixture = makeMount()
  const { face } = await mountedView(fixture)
  const openOrdinaryMode = face.openOrdinaryMode
  if (openOrdinaryMode === undefined) throw new Error('D3 mount test: openOrdinaryMode face missing')
  const teamOpenMode = face.teamOpenMode
  if (teamOpenMode === undefined) throw new Error('D3 mount test: teamOpenMode face missing')
  openOrdinaryMode(ROOT)
  const modeAfterOpen = teamOpenMode(ROOT)
  fixture.setCurrent(OTHER)
  const modeAfterSwitch = teamOpenMode(ROOT)
  fixture.disposeAll()
  return { modeAfterOpen, modeAfterSwitch }
})()

const failedSwitchScenario = await (async () => {
  const fixture = makeMount()
  fixture.enqueue('team.ensureRootLive', ensureLiveSuccess)
  const { face } = await mountedView(fixture)
  const openTeamMode = face.openTeamMode
  const openOrdinaryMode = face.openOrdinaryMode
  const teamOpenMode = face.teamOpenMode
  if (openTeamMode === undefined) throw new Error('D3 mount test: openTeamMode face missing')
  if (openOrdinaryMode === undefined) throw new Error('D3 mount test: openOrdinaryMode face missing')
  if (teamOpenMode === undefined) throw new Error('D3 mount test: teamOpenMode face missing')
  await openTeamMode(ROOT)
  let threw = false
  let message = ''
  try {
    openOrdinaryMode(UNKNOWN)
  } catch (error: unknown) {
    threw = true
    message = error instanceof Error ? error.message : String(error)
  }
  const modeAfterFailedSwitch = teamOpenMode(ROOT)
  fixture.disposeAll()
  return { fixture, threw, message, modeAfterFailedSwitch }
})()

// ---------------------------------------------------------------------------
// Assertions (synchronous it() bodies over the captured scenario state)
// ---------------------------------------------------------------------------

describe('D3 (client mount): the ordinary entry is the pure native open (A3 Q3 Seam 3)', () => {
  it('opens the root session exactly once with the root id (openSession verbatim)', () => {
    expect(ordinaryScenario.fixture.opened).toEqual([ROOT])
  })

  it('NO team-remote method is called (the remote client spy has zero team.* calls — no ensure, no create, no mutation)', () => {
    expect(ordinaryScenario.fixture.teamCalls()).toEqual([])
    expect(ordinaryScenario.fixture.log).toEqual([])
  })

  it('no list refresh rides the ordinary open (the creation-path re-pull lane is not used)', () => {
    expect(ordinaryScenario.fixture.refreshCount()).toBe(0)
  })

  it('the per-root open-mode state reads ordinary (the D2 state map gains the value)', () => {
    expect(ordinaryScenario.mode).toBe('ordinary')
  })
})

describe('D3 (client mount): the team → ordinary → team switch (A3 Q1 caveat 2 semantics)', () => {
  it('the mode badge fact follows the ENTRY used: team → ordinary → team', () => {
    expect(switchScenario.modeAfterTeam1).toBe('team')
    expect(switchScenario.modeAfterOrdinary).toBe('ordinary')
    expect(switchScenario.modeAfterTeam2).toBe('team')
  })

  it('the switch issues EXACTLY the two team.ensureRootLive calls (one per team entry) and NO other team-remote method — the ordinary steps contribute zero carrier calls, so no TeamDomain repository write can ride the switch', () => {
    expect(switchScenario.fixture.teamCalls().length).toBe(2)
    for (const call of switchScenario.fixture.teamCalls()) {
      expect(call.channel).toBe('/team-remote')
      expect(call.endpoint).toBe('team.ensureRootLive')
      expect(call.payload).toEqual({
        version: REMOTE_CONTRACT_VERSION_V3,
        params: { teamSessionId: ROOT },
      })
    }
  })

  it('the ordering is pinned: ensure → open for each team entry, plain open only for the ordinary step (no agents.resume on the ordinary path — the glue map sees no ordinary resume)', () => {
    expect(switchScenario.fixture.sequence).toEqual([
      { op: 'ensure' },
      { op: 'open', id: ROOT },
      { op: 'open', id: ROOT },
      { op: 'ensure' },
      { op: 'open', id: ROOT },
    ])
  })

  it('the root session is opened once per entry (three entries, three opens; the repeated opens are the SAME pure native open — idempotent, no duplicate registration surface)', () => {
    expect(switchScenario.fixture.opened).toEqual([ROOT, ROOT, ROOT])
    expect(switchScenario.result1).toEqual({ ok: true })
    expect(switchScenario.result2).toEqual({ ok: true })
  })
})

describe('D3 (client mount): the idempotent ordinary repeat', () => {
  it('the same entry twice: two plain opens, no error, the mode stays ordinary, still zero team.* calls', () => {
    expect(idempotentScenario.fixture.opened).toEqual([ROOT, ROOT])
    expect(idempotentScenario.mode).toBe('ordinary')
    expect(idempotentScenario.fixture.teamCalls()).toEqual([])
  })
})

describe('D3 (client mount): the session-switch reset (the D2 reset effect covers the ordinary mark too)', () => {
  it('after an ordinary open the root reads ordinary; a switch away drops the ordinary mark', () => {
    expect(resetScenario.modeAfterOpen).toBe('ordinary')
    expect(resetScenario.modeAfterSwitch).toBeNull()
  })
})

describe('D3 (client mount): the failed ordinary switch (open first, mark after)', () => {
  it('an unknown session id: the seam throw propagates, no open happens, and the prior team mark is left intact (a failed switch is no switch)', () => {
    expect(failedSwitchScenario.threw).toBe(true)
    expect(failedSwitchScenario.message).toContain('unknown session')
    expect(failedSwitchScenario.fixture.opened).toEqual([ROOT])
    expect(failedSwitchScenario.modeAfterFailedSwitch).toBe('team')
  })
})
