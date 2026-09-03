/**
 * P9-T4 (S2-C / G2) — the forward-paging team ledger cursor store.
 *
 * Coverage (the frozen cursor rule via the reused `createLedgerPageTracker`
 * + `verifyLedgerPageAnchor`, and the plan §6.4 orchestration): the
 * catch-up episode pages forward from `afterSequence = 0` through the
 * frozen tracker — every page is gated, merged with sequence dedupe, and
 * the episode ends on the tail (no cursor); a lying server (a terminal
 * page whose `total` outruns the loaded frontier) ends the episode with
 * an honest `total` / `completeThrough` mismatch — NEVER a fetch loop;
 * `refresh()` re-reads at the tracker's stable anchor and appends new
 * entries without reordering the loaded window (dedupe absorbs the
 * overlap); a team switch mid-flight drops the stale-team response
 * (G2: stale/foreign never overwrites) and starts the new team's own
 * episode (single-flight + queued restart); a tracker rejection
 * (G2: total cannot regress) is stored as the typed `LedgerPageReject`
 * and the rejected page never merges; a typed RPC error is stored
 * INTACT (G2: RPC errors remain typed, never exception-ified); a
 * transport-level rejection is stored as the closed-reason
 * `transport-loss`; a stale-team transport rejection never touches the
 * new team's state; `reset()` drops the binding and every entry; the
 * page size defaults to the frozen 50; the snapshot reference is stable
 * between changes and the subscriber is notified per published change
 * (and stopped by the disposer).
 *
 * Shim-constrained spec (run-tests.mjs): the `it()` bodies are
 * synchronous assertions on captured scenario state; the async episodes
 * run at module level (top-level await, the T3 round-trip pattern).
 * Gated pulls are fired WITHOUT awaiting, the gate is resolved, then the
 * episode promises are awaited (the deadlock trap pattern). No real
 * timers anywhere. Matchers used: toBe / toEqual (+ .not) only.
 */
import { describe, expect, it } from 'vitest'
import {
  REMOTE_CONTRACT_VERSION,
  buildRemoteError,
  buildRemoteSuccess,
  type RemoteLedgerEntryValue,
  type RemoteResponse,
} from '../../remote/src/index.js'
import { createTeamLedgerStore, type TeamLedgerStore } from '../src/state/team-ledger-store.js'

/**
 * Test-only narrowing: a missing row means the fixture or the store
 * contract broke, so throw (the shim exposes no toBeDefined matcher, and a
 * silently `undefined` row would mask the assertions that follow).
 */
function must<T>(value: T | undefined, label: string): T {
  if (value === undefined) throw new Error(`missing: ${label}`)
  return value
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const METHOD = 'team.getLedgerPage'

/** One frozen ledger entry (the durable wire value). */
function pageEntry(sequence: number): RemoteLedgerEntryValue {
  return {
    schemaVersion: 1,
    sequence,
    rootSessionId: 'root-1',
    factType: 'team-work-admitted',
    payload: {},
    operationId: null,
    createdAt: '2026-08-29T00:00:00.000Z',
  }
}

/** One frozen `team.getLedgerPage` success envelope. */
function pageSuccess(sequences: readonly number[], cursor: number | null, total: number): RemoteResponse {
  return buildRemoteSuccess(
    { entries: sequences.map(pageEntry), nextAfterSequence: cursor, total },
    { method: METHOD, endpoint: METHOD, contractVersion: REMOTE_CONTRACT_VERSION, requestToken: null },
  )
}

/** One frozen typed RPC error envelope. */
function rpcError(code: string, message: string): RemoteResponse {
  return buildRemoteError(code, message, {
    method: METHOD,
    endpoint: METHOD,
    contractVersion: REMOTE_CONTRACT_VERSION,
    requestToken: null,
  })
}

interface Call {
  team: string
  after: number
  limit: number
}

// ---------------------------------------------------------------------------
// Module-level scenarios
// ---------------------------------------------------------------------------

const catchUpScenario = await (async () => {
  const calls: Call[] = []
  const getLedgerPage = async (team: string, after: number, limit: number): Promise<RemoteResponse> => {
    calls.push({ team, after, limit })
    if (after === 0) return pageSuccess([1, 2], 2, 5)
    if (after === 2) return pageSuccess([3, 4], 4, 5)
    if (after === 4) return pageSuccess([5], null, 5)
    return pageSuccess([], null, 5)
  }
  const store: TeamLedgerStore = createTeamLedgerStore({ getLedgerPage, limit: 2 })
  await store.open('t1')
  return { calls, state: store.getState(), store }
})()

const lyingTotalScenario = await (async () => {
  const calls: Call[] = []
  const getLedgerPage = async (team: string, after: number, limit: number): Promise<RemoteResponse> => {
    calls.push({ team, after, limit })
    if (after === 0) return pageSuccess([1, 2], 2, 7)
    if (after === 2) return pageSuccess([3], null, 7)
    return pageSuccess([], null, 7)
  }
  const store: TeamLedgerStore = createTeamLedgerStore({ getLedgerPage, limit: 2 })
  await store.open('t1')
  return { calls, state: store.getState() }
})()

const refreshAppendScenario = await (async () => {
  const calls: Call[] = []
  let phase = 1
  const getLedgerPage = async (team: string, after: number, limit: number): Promise<RemoteResponse> => {
    calls.push({ team, after, limit })
    if (phase === 1) {
      if (after === 0) return pageSuccess([1, 2], 2, 3)
      if (after === 2) return pageSuccess([3], null, 3)
      return pageSuccess([], null, 3)
    }
    if (after === 2) return pageSuccess([3, 4], 4, 4)
    if (after === 4) return pageSuccess([], null, 4)
    return pageSuccess([], null, 4)
  }
  const store: TeamLedgerStore = createTeamLedgerStore({ getLedgerPage, limit: 2 })
  await store.open('t1')
  const afterOpen = store.getState()
  phase = 2
  const refreshCallsAt = calls.length
  await store.refresh()
  return { calls, refreshCallsAt, afterOpen, state: store.getState() }
})()

const switchMidFlightScenario = await (async () => {
  const calls: Array<string> = []
  let resolveA: (value: RemoteResponse) => void = () => { throw new Error('gate A not armed') }
  const gateA = new Promise<RemoteResponse>(resolve => {
    resolveA = resolve
  })
  const getLedgerPage = (team: string, after: number): Promise<RemoteResponse> => {
    calls.push(`${team}:${after}`)
    if (team === 'A' && after === 0) return gateA
    if (team === 'A') return Promise.resolve(pageSuccess([], null, 0))
    if (team === 'B' && after === 0) return Promise.resolve(pageSuccess([10, 11], null, 11))
    return Promise.resolve(pageSuccess([], null, 0))
  }
  const store: TeamLedgerStore = createTeamLedgerStore({ getLedgerPage, limit: 2 })
  const openA = store.open('A')
  const aLoading = store.getState()
  const openB = store.open('B')
  resolveA(pageSuccess([1, 2], null, 2))
  await openB
  await openA
  return { calls, aLoading, state: store.getState() }
})()

const totalRegressionScenario = await (async () => {
  const getLedgerPage = async (team: string, after: number): Promise<RemoteResponse> => {
    if (after === 0) return pageSuccess([1, 2], 2, 5)
    if (after === 2) return pageSuccess([3, 4], 4, 4)
    return pageSuccess([], null, 4)
  }
  const store: TeamLedgerStore = createTeamLedgerStore({ getLedgerPage, limit: 2 })
  await store.open('t1')
  return { state: store.getState() }
})()

const pageExceedsLimitScenario = await (async () => {
  const getLedgerPage = async (team: string, after: number): Promise<RemoteResponse> => {
    if (after === 0) return pageSuccess([1, 2], 2, 4)
    if (after === 2) return pageSuccess([3, 4, 5], 5, 5)
    return pageSuccess([], null, 5)
  }
  const store: TeamLedgerStore = createTeamLedgerStore({ getLedgerPage, limit: 2 })
  await store.open('t1')
  return { state: store.getState() }
})()

const rpcErrorScenario = await (async () => {
  const envelope = rpcError('team-not-found', 'no such team')
  const getLedgerPage = async (): Promise<RemoteResponse> => envelope
  const store: TeamLedgerStore = createTeamLedgerStore({ getLedgerPage, limit: 2 })
  await store.open('t1')
  return { envelope, state: store.getState() }
})()

const transportLossScenario = await (async () => {
  const getLedgerPage = async (): Promise<RemoteResponse> => {
    throw new Error('channel closed')
  }
  const store: TeamLedgerStore = createTeamLedgerStore({ getLedgerPage, limit: 2 })
  await store.open('t1')
  return { state: store.getState() }
})()

const staleTransportLossScenario = await (async () => {
  let rejectA: (reason: Error) => void = () => { throw new Error('gate A not armed') }
  const gateA = new Promise<never>((_, reject) => {
    rejectA = reject
  })
  const getLedgerPage = (team: string, after: number): Promise<RemoteResponse> => {
    if (team === 'A' && after === 0) return gateA
    if (team === 'B' && after === 0) return Promise.resolve(pageSuccess([20], null, 20))
    return Promise.resolve(pageSuccess([], null, 0))
  }
  const store: TeamLedgerStore = createTeamLedgerStore({ getLedgerPage, limit: 2 })
  const openA = store.open('A')
  const openB = store.open('B')
  rejectA(new Error('channel closed'))
  await openB
  await openA
  return { state: store.getState() }
})()

const resetScenario = await (async () => {
  const calls: Call[] = []
  const getLedgerPage = async (team: string, after: number, limit: number): Promise<RemoteResponse> => {
    calls.push({ team, after, limit })
    return pageSuccess([1], null, 1)
  }
  const store: TeamLedgerStore = createTeamLedgerStore({ getLedgerPage, limit: 2 })
  await store.open('t1')
  // The map is published by reference (the store mutates in place): capture
  // the size, not the live map, before the reset clears it.
  const beforeSize = store.getState().entriesBySequence.size
  store.reset()
  const afterReset = store.getState()
  const callsAtReset = calls.length
  await store.refresh()
  return { calls, callsAtReset, beforeSize, afterReset }
})()

const defaultLimitScenario = await (async () => {
  const calls: Call[] = []
  const getLedgerPage = async (team: string, after: number, limit: number): Promise<RemoteResponse> => {
    calls.push({ team, after, limit })
    return pageSuccess([1], null, 1)
  }
  const store: TeamLedgerStore = createTeamLedgerStore({ getLedgerPage })
  await store.open('t1')
  return { calls }
})()

const sameTeamReOpenScenario = await (async () => {
  const calls: Array<string> = []
  const getLedgerPage = (team: string, after: number): Promise<RemoteResponse> => {
    calls.push(`${team}:${after}`)
    return Promise.resolve(pageSuccess([1], null, 1))
  }
  const store: TeamLedgerStore = createTeamLedgerStore({ getLedgerPage, limit: 2 })
  const first = store.open('t1')
  const second = store.open('t1')
  await first
  await second
  return { calls, state: store.getState() }
})()

const subscribeScenario = await (async () => {
  const getLedgerPage = async (team: string, after: number): Promise<RemoteResponse> => {
    if (after === 0) return pageSuccess([1], null, 1)
    return pageSuccess([], null, 1)
  }
  const store: TeamLedgerStore = createTeamLedgerStore({ getLedgerPage, limit: 2 })
  let notifications = 0
  const dispose = store.subscribe(() => {
    notifications += 1
  })
  const idle1 = store.getState()
  const idle2 = store.getState()
  await store.open('t1')
  const settled = store.getState()
  const notificationsAtDispose = notifications
  dispose()
  store.reset()
  const notificationsAfterReset = notifications
  return { idle1, idle2, settled, notificationsAtDispose, notificationsAfterReset }
})()

// ---------------------------------------------------------------------------
// G2 — catch-up episode (forward paging through the frozen tracker)
// ---------------------------------------------------------------------------

describe('createTeamLedgerStore — catch-up episode', () => {
  it('pages forward from afterSequence 0 to the tail (tracker-gated, limit honored)', () => {
    expect(catchUpScenario.calls).toEqual([
      { team: 't1', after: 0, limit: 2 },
      { team: 't1', after: 2, limit: 2 },
      { team: 't1', after: 4, limit: 2 },
    ])
    const state = catchUpScenario.state
    expect(state.teamSessionId).toBe('t1')
    expect(state.total).toBe(5)
    expect(state.completeThrough).toBe(5)
    expect(state.orderedSequences).toEqual([1, 2, 3, 4, 5])
    expect(state.entriesBySequence.size).toBe(5)
    expect(state.loading).toBe(false)
    expect(state.error).toBe(undefined)
  })

  it('a lying total (terminal page outruns the frontier) ends the episode — never a fetch loop', () => {
    expect(lyingTotalScenario.calls.length).toBe(2)
    const state = lyingTotalScenario.state
    expect(state.total).toBe(7)
    expect(state.completeThrough).toBe(3)
    expect(state.orderedSequences).toEqual([1, 2, 3])
    expect(state.loading).toBe(false)
    // The completeness verdict stands on the numbers: 3 < 7 → partial.
    expect(state.total !== null && state.completeThrough >= state.total).toBe(false)
  })

  it('the page size defaults to the frozen 50', () => {
    expect(must(defaultLimitScenario.calls[0], 'first call').limit).toBe(50)
  })
})

describe('createTeamLedgerStore — refresh (append without reorder)', () => {
  it('re-reads at the tracker anchor and appends new entries at the end of the window', () => {
    expect(refreshAppendScenario.afterOpen.orderedSequences).toEqual([1, 2, 3])
    const refreshCalls = refreshAppendScenario.calls.slice(refreshAppendScenario.refreshCallsAt)
    // The re-read at anchor 2 returns the grown page [3,4] with total 4:
    // the frontier reaches the total, so the episode ends there (no empty
    // tail fetch — the completeness verdict stands on the numbers).
    expect(refreshCalls).toEqual([{ team: 't1', after: 2, limit: 2 }])
    const state = refreshAppendScenario.state
    expect(state.orderedSequences).toEqual([1, 2, 3, 4])
    expect(state.entriesBySequence.size).toBe(4)
    expect(state.total).toBe(4)
    expect(state.completeThrough).toBe(4)
    expect(state.loading).toBe(false)
  })
})

describe('createTeamLedgerStore — team switch mid-flight (G2 stale/foreign drop)', () => {
  it('drops the stale-team response and runs the new team episode', () => {
    expect(switchMidFlightScenario.aLoading.teamSessionId).toBe('A')
    expect(switchMidFlightScenario.aLoading.loading).toBe(true)
    expect(switchMidFlightScenario.calls).toEqual(['A:0', 'B:0'])
    const state = switchMidFlightScenario.state
    expect(state.teamSessionId).toBe('B')
    expect(state.entriesBySequence.size).toBe(2)
    expect(state.entriesBySequence.has(1)).toBe(false)
    expect(state.entriesBySequence.has(10)).toBe(true)
    expect(state.orderedSequences).toEqual([10, 11])
    expect(state.total).toBe(11)
    expect(state.loading).toBe(false)
    expect(state.error).toBe(undefined)
  })

  it('a same-team re-open while in flight is queued and re-reads the stable tail', () => {
    expect(sameTeamReOpenScenario.calls).toEqual(['t1:0', 't1:0'])
    expect(sameTeamReOpenScenario.state.entriesBySequence.size).toBe(1)
    expect(sameTeamReOpenScenario.state.loading).toBe(false)
    expect(sameTeamReOpenScenario.state.error).toBe(undefined)
  })
})

describe('createTeamLedgerStore — tracker rejections (G2 page gates)', () => {
  it('a page total regression is stored as the typed reject; the page never merges', () => {
    const state = totalRegressionScenario.state
    expect(state.error).toEqual({ ok: false, reason: 'total-decreased' })
    expect(state.entriesBySequence.size).toBe(2)
    expect(state.total).toBe(5)
    expect(state.completeThrough).toBe(2)
    expect(state.loading).toBe(false)
  })

  it('an over-limit page is stored as the typed reject; the page never merges', () => {
    const state = pageExceedsLimitScenario.state
    expect(state.error).toEqual({ ok: false, reason: 'page-exceeds-limit' })
    expect(state.entriesBySequence.size).toBe(2)
    expect(state.total).toBe(4)
    expect(state.loading).toBe(false)
  })
})

describe('createTeamLedgerStore — typed failures (G2 RPC errors remain typed)', () => {
  it('a typed RPC error is stored intact (never exception-ified)', () => {
    expect(rpcErrorScenario.state.error).toBe(rpcErrorScenario.envelope)
    expect(rpcErrorScenario.state.entriesBySequence.size).toBe(0)
    expect(rpcErrorScenario.state.total).toBe(null)
    expect(rpcErrorScenario.state.loading).toBe(false)
  })

  it('a transport-level rejection is stored as the closed transport-loss reason', () => {
    expect(transportLossScenario.state.error).toEqual({ ok: false, reason: 'transport-loss' })
    expect(transportLossScenario.state.total).toBe(null)
    expect(transportLossScenario.state.loading).toBe(false)
  })

  it('a stale-team transport rejection never touches the new team state', () => {
    const state = staleTransportLossScenario.state
    expect(state.teamSessionId).toBe('B')
    expect(state.entriesBySequence.size).toBe(1)
    expect(state.entriesBySequence.has(20)).toBe(true)
    expect(state.error).toBe(undefined)
    expect(state.loading).toBe(false)
  })
})

describe('createTeamLedgerStore — reset and observability', () => {
  it('reset drops the binding and every entry; refresh on an unbound store is a no-op', () => {
    expect(resetScenario.beforeSize).toBe(1)
    const after = resetScenario.afterReset
    expect(after.teamSessionId).toBe(null)
    expect(after.entriesBySequence.size).toBe(0)
    expect(after.total).toBe(null)
    expect(after.completeThrough).toBe(0)
    expect(after.loading).toBe(false)
    expect(after.error).toBe(undefined)
    expect(resetScenario.calls.length).toBe(resetScenario.callsAtReset)
  })

  it('the snapshot reference is stable between changes and per-change notifications stop at dispose', () => {
    expect(subscribeScenario.idle1).toBe(subscribeScenario.idle2)
    expect(subscribeScenario.settled).not.toBe(subscribeScenario.idle1)
    // bound publish + loading publish + tail publish = exactly 3 changes.
    expect(subscribeScenario.notificationsAtDispose).toBe(3)
    expect(subscribeScenario.notificationsAfterReset).toBe(subscribeScenario.notificationsAtDispose)
  })
})
