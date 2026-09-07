/**
 * P9-T4 (S2-C / G2) — the forward-paging team ledger cursor store.
 *
 * Coverage (the frozen cursor rule via the reused `createLedgerPageTracker`
 * + `verifyLedgerPageAnchor`, and the plan §6.4 orchestration): the
 * catch-up episode pages forward from `afterSequence = 0` through the
 * frozen tracker — every page is gated, merged with sequence dedupe, and
 * the episode ends on the tail (no cursor); a lying server (a terminal
 * page whose `total` outruns the loaded count) ends the episode with an
 * honest `total` / count mismatch — NEVER a fetch loop;
 *
 * F11 (repair-r1): completion is a COUNT-domain rule (INV-9.2: sequence
 * and count are distinct numeric domains, never compared as
 * interchangeable scalars) — the loaded UNIQUE entry count against the
 * server's per-team `total`. The sequence frontier is never compared to
 * the total, so a shifted sequence base (69–136 / total 68, 7–11 /
 * total 5, 10000–…) pages to the real tail instead of stopping after the
 * first page (the silent-truncation regression tests + the nine-case
 * matrix below; the `total` known-vs-null verdict rule lives in
 * `ledger-adapter.test.ts`).
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
import { createTeamLedgerStore, type TeamLedgerState, type TeamLedgerStore } from '../src/state/team-ledger-store.js'

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
// F11 (repair-r1) — count-based completeness (INV-9.2) scenarios
// ---------------------------------------------------------------------------

/**
 * One deterministic forward-paging episode: `pages` maps the requested
 * `afterSequence` to `[sequences, cursor, total]`; an anchor absent from
 * the table answers an empty terminal page with `total 0` (the tracker
 * rejects the total regression, so a paging bug that re-requests past the
 * table ends in a typed error, never a silent loop).
 */
async function runPagingScenario(
  limit: number,
  pages: ReadonlyMap<number, [readonly number[], number | null, number]>,
): Promise<{ calls: Call[]; state: TeamLedgerState }> {
  const calls: Call[] = []
  const getLedgerPage = async (team: string, after: number, pageLimit: number): Promise<RemoteResponse> => {
    calls.push({ team, after, limit: pageLimit })
    const page = pages.get(after)
    return pageSuccess(
      page === undefined ? [] : page[0],
      page === undefined ? null : page[1],
      page === undefined ? 0 : page[2],
    )
  }
  const store: TeamLedgerStore = createTeamLedgerStore({ getLedgerPage, limit })
  await store.open('t1')
  return { calls, state: store.getState() }
}

/**
 * F11-T1 (RED pre-fix) — the dtestp6 shape from the round-1 world
 * (tests/mock/evidence/NOTES L235–240): team #2 of a shared domain — its
 * sequences START at 69 (team #1 owns 1–68), 68 entries (69–136), default
 * limit 50. Pre-fix: page 1 loads 69–118, frontier 118 >= total 68 → the
 * catch-up STOPS with 50 of 68 (the silent truncation). Count rule: 50 <
 * 68 → one more page, the tail at 136.
 */
const shiftedBaseScenario = await (async () => {
  const calls: Call[] = []
  const getLedgerPage = async (team: string, after: number, pageLimit: number): Promise<RemoteResponse> => {
    calls.push({ team, after, limit: pageLimit })
    if (after === 0) return pageSuccess([...Array(50)].map((_, index) => 69 + index), 118, 68)
    if (after === 118) return pageSuccess([...Array(18)].map((_, index) => 119 + index), null, 68)
    return pageSuccess([], null, 68)
  }
  const store: TeamLedgerStore = createTeamLedgerStore({ getLedgerPage }) // default limit 50
  await store.open('t2')
  return { calls, state: store.getState() }
})()

/**
 * F11-T2 (RED pre-fix, small) — sequences 7–11 of `total 5`, limit 2:
 * pre-fix stops after page 1 (frontier 8 >= 5); the count rule pages
 * 7-8 | 9-10 | 11.
 */
const smallShiftedBaseScenario = await runPagingScenario(
  2,
  new Map<number, [readonly number[], number | null, number]>([
    [0, [[7, 8], 8, 5]],
    [8, [[9, 10], 10, 5]],
    [10, [[11], null, 5]],
  ]),
)

/**
 * F11-T6 — the nine-case matrix (rec. §3.9): sequence base 1 / 69 /
 * 10000, `total` < first sequence (no early completion), multi-page,
 * overlapping page replay, duplicate-sequence dedupe, cursor-null tail
 * (clean + lying), and `total` known-vs-null (the verdict-rule half
 * lives in `ledger-adapter.test.ts`). Key assertion everywhere:
 * completion stands on `loadedUniqueEntryCount == server total`, NEVER
 * `frontier >= total`.
 */
const matrixBase1Scenario = await runPagingScenario(
  2,
  new Map<number, [readonly number[], number | null, number]>([
    [0, [[1, 2], 2, 4]],
    [2, [[3, 4], null, 4]],
  ]),
)

const matrixBase69Scenario = await runPagingScenario(
  2,
  new Map<number, [readonly number[], number | null, number]>([
    [0, [[69, 70], 70, 4]],
    [70, [[71, 72], null, 4]],
  ]),
)

const matrixBase10000Scenario = await runPagingScenario(
  2,
  new Map<number, [readonly number[], number | null, number]>([
    [0, [[10000, 10001], 10001, 4]],
    [10001, [[10002, 10003], null, 4]],
  ]),
)

/** Case 4 — `total` (3) is below the first sequence (5): the count rule must NOT complete early (2 < 3) — the tail ends the episode. */
const matrixTotalBelowFirstSequenceScenario = await runPagingScenario(
  2,
  new Map<number, [readonly number[], number | null, number]>([
    [0, [[5, 6], 6, 3]],
    [6, [[7, 8], null, 3]],
  ]),
)

const matrixMultiPageScenario = await runPagingScenario(
  2,
  new Map<number, [readonly number[], number | null, number]>([
    [0, [[1, 2], 2, 9]],
    [2, [[3, 4], 4, 9]],
    [4, [[5, 6], 6, 9]],
    [6, [[7, 8], 8, 9]],
    [8, [[9], null, 9]],
  ]),
)

/** Case 6 — overlapping page replay: the frozen slicer re-yields the same page at a re-read anchor; the dedupe merge absorbs the overlap (no double count, no reorder). */
const matrixOverlappingReplayScenario = await (async () => {
  const calls: Call[] = []
  const getLedgerPage = async (team: string, after: number, pageLimit: number): Promise<RemoteResponse> => {
    calls.push({ team, after, limit: pageLimit })
    if (after === 0) return pageSuccess([1, 2], 2, 4)
    if (after === 2) return pageSuccess([3, 4], null, 4) // stable re-read: the same page again
    return pageSuccess([], null, 4)
  }
  const store: TeamLedgerStore = createTeamLedgerStore({ getLedgerPage, limit: 2 })
  await store.open('t1')
  const refreshCallsAt = calls.length
  await store.refresh()
  return { calls, refreshCallsAt, state: store.getState() }
})()

/** Case 7 — duplicate-sequence dedupe on an append: the server grows (total 5→6); the re-read re-yields 5 (already loaded) + 6 (new) — the unique count is the map size, not the page sum. */
const matrixDedupeAppendScenario = await (async () => {
  const calls: Call[] = []
  let phase = 1
  const getLedgerPage = async (team: string, after: number, pageLimit: number): Promise<RemoteResponse> => {
    calls.push({ team, after, limit: pageLimit })
    if (phase === 1) {
      if (after === 0) return pageSuccess([1, 2], 2, 5)
      if (after === 2) return pageSuccess([3, 4], 4, 5)
      if (after === 4) return pageSuccess([5], null, 5)
      return pageSuccess([], null, 5)
    }
    if (after === 4) return pageSuccess([5, 6], null, 6)
    return pageSuccess([], null, 6)
  }
  const store: TeamLedgerStore = createTeamLedgerStore({ getLedgerPage, limit: 2 })
  await store.open('t1')
  const refreshCallsAt = calls.length
  // The server appended seq 6 before the refresh (total grows 5→6).
  phase = 2
  await store.refresh()
  return { calls, refreshCallsAt, state: store.getState() }
})()

/** Case 8 (clean half) — a single full page IS the tail (cursor null): one call, count == total, complete. */
const matrixCleanTailScenario = await runPagingScenario(
  50,
  new Map<number, [readonly number[], number | null, number]>([
    [0, [[...Array(50)].map((_, index) => 1 + index), null, 50]],
  ]),
)

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
    // The completeness verdict stands on the COUNT domain (INV-9.2):
    // 3 loaded < total 7 → partial (the sequence frontier is never the
    // comparison — it happens to agree here; the count is the rule).
    expect(state.total !== null && state.entriesBySequence.size >= state.total).toBe(false)
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

// ---------------------------------------------------------------------------
// F11 (repair-r1) — count-based completeness (INV-9.2)
// ---------------------------------------------------------------------------

describe('createTeamLedgerStore — F11 count-based completeness (INV-9.2)', () => {
  it('F11-T1: a shifted base (69–136, total 68, limit 50) pages to the real tail — exactly 2 calls, 68 loaded', () => {
    expect(shiftedBaseScenario.calls).toEqual([
      { team: 't2', after: 0, limit: 50 },
      { team: 't2', after: 118, limit: 50 },
    ])
    const state = shiftedBaseScenario.state
    expect(state.teamSessionId).toBe('t2')
    expect(state.total).toBe(68)
    expect(state.completeThrough).toBe(136)
    expect(state.orderedSequences.length).toBe(68)
    expect(state.entriesBySequence.size).toBe(68)
    expect(state.loading).toBe(false)
    expect(state.error).toBe(undefined)
    // The completeness verdict stands on the COUNT domain: loaded unique
    // count 68 == server total 68 (the frontier 136 is a sequence, never
    // the comparison).
    expect(state.total !== null && state.entriesBySequence.size >= state.total).toBe(true)
  })

  it('F11-T2: a small shifted base (7–11, total 5, limit 2) pages 7-8 | 9-10 | 11 — all 5 loaded', () => {
    expect(smallShiftedBaseScenario.calls).toEqual([
      { team: 't1', after: 0, limit: 2 },
      { team: 't1', after: 8, limit: 2 },
      { team: 't1', after: 10, limit: 2 },
    ])
    const state = smallShiftedBaseScenario.state
    expect(state.orderedSequences).toEqual([7, 8, 9, 10, 11])
    expect(state.total).toBe(5)
    expect(state.completeThrough).toBe(11)
    expect(state.entriesBySequence.size).toBe(5)
    expect(state.loading).toBe(false)
    expect(state.error).toBe(undefined)
    expect(state.total !== null && state.entriesBySequence.size >= state.total).toBe(true)
  })

  describe('F11-T6 nine-case matrix (the store paging axis)', () => {
    it('case 1 — base 1 (frontier ≡ count): pages to the tail, count-complete', () => {
      const { calls, state } = matrixBase1Scenario
      expect(calls.map(call => call.after)).toEqual([0, 2])
      expect(state.entriesBySequence.size).toBe(4)
      expect(state.total).toBe(4)
      expect(state.completeThrough).toBe(4)
      expect(state.loading).toBe(false)
      expect(state.error).toBe(undefined)
      expect(state.total !== null && state.entriesBySequence.size >= state.total).toBe(true)
    })

    it('case 2 — base 69: no early completion (frontier 70 >= total 4 must not stop the catch-up)', () => {
      const { calls, state } = matrixBase69Scenario
      expect(calls.map(call => call.after)).toEqual([0, 70])
      expect(state.orderedSequences).toEqual([69, 70, 71, 72])
      expect(state.entriesBySequence.size).toBe(4)
      expect(state.total).toBe(4)
      expect(state.loading).toBe(false)
      expect(state.error).toBe(undefined)
      expect(state.total !== null && state.entriesBySequence.size >= state.total).toBe(true)
    })

    it('case 3 — base 10000: the same count rule at a large base', () => {
      const { calls, state } = matrixBase10000Scenario
      expect(calls.map(call => call.after)).toEqual([0, 10001])
      expect(state.orderedSequences).toEqual([10000, 10001, 10002, 10003])
      expect(state.entriesBySequence.size).toBe(4)
      expect(state.total).toBe(4)
      expect(state.loading).toBe(false)
      expect(state.error).toBe(undefined)
      expect(state.total !== null && state.entriesBySequence.size >= state.total).toBe(true)
    })

    it('case 4 — total < first sequence (3 < 5): no early completion; the tail ends the episode, the loaded count outruns the (stale) total', () => {
      const { calls, state } = matrixTotalBelowFirstSequenceScenario
      expect(calls.map(call => call.after)).toEqual([0, 6])
      expect(state.orderedSequences).toEqual([5, 6, 7, 8])
      expect(state.entriesBySequence.size).toBe(4)
      expect(state.total).toBe(3)
      expect(state.loading).toBe(false)
      expect(state.error).toBe(undefined)
      // Count domain: 4 loaded >= total 3 → complete (the tail was
      // reached; the loaded set IS the whole ledger the server has).
      expect(state.total !== null && state.entriesBySequence.size >= state.total).toBe(true)
    })

    it('case 5 — multi-page (5 pages to the tail): every page gated, 9/9 loaded', () => {
      const { calls, state } = matrixMultiPageScenario
      expect(calls.map(call => call.after)).toEqual([0, 2, 4, 6, 8])
      expect(state.entriesBySequence.size).toBe(9)
      expect(state.total).toBe(9)
      expect(state.completeThrough).toBe(9)
      expect(state.loading).toBe(false)
      expect(state.error).toBe(undefined)
      expect(state.total !== null && state.entriesBySequence.size >= state.total).toBe(true)
    })

    it('case 6 — overlapping page replay (stable re-read at the anchor): dedupe absorbs, no double count', () => {
      const { calls, refreshCallsAt, state } = matrixOverlappingReplayScenario
      expect(calls.slice(0, refreshCallsAt).map(call => call.after)).toEqual([0, 2])
      expect(calls.slice(refreshCallsAt).map(call => call.after)).toEqual([2])
      expect(state.orderedSequences).toEqual([1, 2, 3, 4])
      expect(state.entriesBySequence.size).toBe(4)
      expect(state.total).toBe(4)
      expect(state.loading).toBe(false)
      expect(state.error).toBe(undefined)
      expect(state.total !== null && state.entriesBySequence.size >= state.total).toBe(true)
    })

    it('case 7 — duplicate-sequence append on refresh (total grows 5→6): the unique count is the map size', () => {
      const { calls, refreshCallsAt, state } = matrixDedupeAppendScenario
      expect(calls.slice(0, refreshCallsAt).map(call => call.after)).toEqual([0, 2, 4])
      expect(calls.slice(refreshCallsAt).map(call => call.after)).toEqual([4])
      // 5 (re-read duplicate) + 6 (new): the map size is 6, not 5 + 2.
      expect(state.orderedSequences).toEqual([1, 2, 3, 4, 5, 6])
      expect(state.entriesBySequence.size).toBe(6)
      expect(state.total).toBe(6)
      expect(state.loading).toBe(false)
      expect(state.error).toBe(undefined)
      expect(state.total !== null && state.entriesBySequence.size >= state.total).toBe(true)
    })

    it('case 8 — cursor-null tail: the clean tail completes (50/50); the lying tail (3 loaded of total 7) stays partial', () => {
      const { calls, state: clean } = matrixCleanTailScenario
      expect(calls.map(call => call.after)).toEqual([0])
      expect(clean.entriesBySequence.size).toBe(50)
      expect(clean.total).toBe(50)
      expect(clean.completeThrough).toBe(50)
      expect(clean.total !== null && clean.entriesBySequence.size >= clean.total).toBe(true)
      // The lying-total episode (existing scenario): the tail ends it with
      // 3 loaded of total 7 — partial, never a fetch loop, never complete.
      expect(lyingTotalScenario.state.entriesBySequence.size).toBe(3)
      expect(lyingTotalScenario.state.total).toBe(7)
      expect(lyingTotalScenario.state.total !== null && lyingTotalScenario.state.entriesBySequence.size >= lyingTotalScenario.state.total).toBe(false)
    })

    it('case 9 — total known vs null: the unbound store carries a null total and no completeness claim (the verdict-rule half is in ledger-adapter.test.ts)', () => {
      // The store never publishes a loaded page without a numeric total
      // (the frozen wire shape), so the null-total half of the matrix is
      // the ADAPTER verdict rule: `total === null` never claims complete
      // (ledger-adapter.test.ts, F11-T6 case 9). Here: the unbound state
      // (total null) is the pre-page boundary.
      const unbound = createTeamLedgerStore({ getLedgerPage: async () => pageSuccess([], null, 0) }).getState()
      expect(unbound.teamSessionId).toBe(null)
      expect(unbound.total).toBe(null)
      expect(unbound.entriesBySequence.size).toBe(0)
      expect(unbound.orderedSequences).toEqual([])
    })
  })
})
