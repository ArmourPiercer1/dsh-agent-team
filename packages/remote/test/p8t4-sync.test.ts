/**
 * p8t4-sync.test.ts — the P8-T4 push client acceptance scenarios
 * (Brief required tests): out-of-order frames, reconnect, duplicate
 * invalidation, and the page anchor — driven by the deterministic test
 * client (`p8t4-test-client.ts`) over the fake server (`p8t4-server.ts`),
 * which speaks the REAL frozen P8-T3 dispatcher.
 *
 * The async scenarios run at MODULE level (top-level await, the P8-T3
 * round-trip pattern); the `it()` bodies are synchronous assertions on
 * the captured scenario state. No real timers anywhere: the backoff is
 * computed by the engine and driven by `advance()` on the deterministic
 * clock.
 *
 * Acceptance (Gate G8): a new state is never overwritten by a stale
 * response; pagination is stable (re-reading an anchor under ledger
 * growth yields the same page, the total only grows).
 *
 * Erasable TS only; no `node:` builtins; relative `.js` imports.
 * @module p8t4-sync.test
 */
import { describe, expect, it } from 'vitest'

import {
  REMOTE_CONTRACT_VERSION,
  REMOTE_CONTRACT_ERROR_CODES,
  buildRemoteSuccess,
  verifyLedgerPageAnchor,
} from '../src/index.js'
import type {
  PageFetchReport,
  ProjectionSyncAssessment,
  PushBackoffConfig,
  PushBackoffEntry,
  PushClientState,
  ReconnectState,
  RemoteLedgerPageValue,
  RemoteResponse,
  RemoteSafeRecord,
} from '../src/index.js'
import { createP8T4TestClient } from './p8t4-test-client.js'
import type { P8T4TestClient } from './p8t4-test-client.js'
import { createP8T4FakeServer } from './p8t4-server.js'
import type { P8T4FakeServer } from './p8t4-server.js'

const TEAM = 'root-1'
const BACKOFF: PushBackoffConfig = { baseMs: 20, factor: 2, maxMs: 1000 }

/** One whole-projection DTO (the nine frozen top-level fields). */
function syncDto(generation: number, teamSessionId: string): RemoteSafeRecord {
  return {
    schemaVersion: 1,
    teamSessionId,
    blueprint: { blueprintId: 'bp-1', revision: 2 },
    generation,
    generatedAt: `2026-08-29T00:00:${String(generation).padStart(2, '0')}.000Z`,
    root: { rootSessionId: teamSessionId },
    templates: [{ templateId: 'tpl-1' }],
    members: [],
    ledger: { latestSequence: 0, totalEntries: 0, byCategory: {}, pendingControlCount: 0 },
  }
}

/** A frozen success envelope for one pulled projection (scriptable). */
function projectionResponse(generation: number): RemoteResponse {
  return buildRemoteSuccess(
    { projection: syncDto(generation, TEAM) },
    {
      method: 'team.getProjection',
      endpoint: 'team.getProjection',
      contractVersion: REMOTE_CONTRACT_VERSION,
      requestToken: null,
      projectionGeneration: generation,
    },
  )
}

interface S1Result {
  startStatus: ProjectionSyncAssessment['status']
  startGeneration: number | null
  sync7Status: ProjectionSyncAssessment['status']
  sync7Generation: number | null
  staleStatus: ProjectionSyncAssessment['status']
  staleGeneration: number | null
  framesStale: number
  framesApplied: number
  newerFirstStatus: ProjectionSyncAssessment['status']
  olderSecondStatus: ProjectionSyncAssessment['status']
  newerFirstApplied: number | null
}

interface S2Result {
  lossStatus: ProjectionSyncAssessment['status']
  stateAfterLoss: PushClientState
  backoffEntry: PushBackoffEntry | null
  stateAtAdvance9: PushClientState
  pendingAtAdvance9: number | null
  finalState: PushClientState
  finalGeneration: number | null
  stateHistory: readonly ReconnectState[]
  connectedCount: number
  lateStaleStatus: ProjectionSyncAssessment['status']
  appliedAfterLateStale: number | null
}

interface S3Result {
  framesApplied: number
  framesDuplicate: number
  onFrameAppliedFires: number
  appliedGeneration: number | null
  redeliveredStatus: ProjectionSyncAssessment['status']
}

interface S4Result {
  page1: PageFetchReport
  anchorAfterPage1: number
  staleAnchorReason: string | null
  walk: readonly PageFetchReport[]
  reReadAnchor0Sequences: readonly number[]
  reReadAnchor0Total: number
  reReadCheckOk: boolean
  finalTotal: number | null
}

interface S5Result {
  finalState: PushClientState
  finalGeneration: number | null
  sinkErrorNames: readonly string[]
}

interface S6Result {
  connectedCount: number
  stateHistory: readonly ReconnectState[]
  stateAfterStop: PushClientState
  finalGeneration: number | null
}

interface S7Result {
  untypedStatus: ProjectionSyncAssessment['status']
  untypedCode: string | undefined
  domainCode: string | undefined
  stateAfter: PushClientState
  transportLosses: number
  appliedGeneration: number | null
}

/**
 * Run every scenario deterministically (module level, top-level await —
 * the P8-T3 round-trip pattern).
 */
const RT = await (async () => {
  // ------------------------------------------------------------------
  // S1 — out-of-order frames (N → N+2 → N+1: N+1 must be rejected)
  // ------------------------------------------------------------------
  const s1server: P8T4FakeServer = createP8T4FakeServer({ startGeneration: 5 })
  const s1client: P8T4TestClient = createP8T4TestClient({
    teamSessionId: TEAM,
    transport: s1server,
    backoff: BACKOFF,
  })
  const s1start = await s1client.start()
  const s1StartGeneration = s1client.lastAppliedGeneration()
  s1server.setGeneration(7)
  const s1sync7 = await s1client.sync()
  const s1Sync7Generation = s1client.lastAppliedGeneration()
  // A delayed response of the gen-6 state arrives after gen 7 was applied.
  s1server.scriptNext('team.getProjection', projectionResponse(6))
  const s1stale = await s1client.sync()
  const s1StaleGeneration = s1client.lastAppliedGeneration()
  const s1bserver: P8T4FakeServer = createP8T4FakeServer({ startGeneration: 8 })
  const s1bclient: P8T4TestClient = createP8T4TestClient({
    teamSessionId: TEAM,
    transport: s1bserver,
    backoff: BACKOFF,
  })
  const s1bstart = await s1bclient.start()
  // The older gen-7 response is delivered after the gen-8 frame.
  s1bserver.scriptNext('team.getProjection', projectionResponse(7))
  const s1bolder = await s1bclient.sync()
  const s1: S1Result = {
    startStatus: s1start.status,
    startGeneration: s1StartGeneration,
    sync7Status: s1sync7.status,
    sync7Generation: s1Sync7Generation,
    staleStatus: s1stale.status,
    staleGeneration: s1StaleGeneration,
    framesStale: s1client.stats().framesStale,
    framesApplied: s1client.stats().framesApplied,
    newerFirstStatus: s1bstart.status,
    olderSecondStatus: s1bolder.status,
    newerFirstApplied: s1bclient.lastAppliedGeneration(),
  }

  // ------------------------------------------------------------------
  // S2 — reconnect (loss → capped backoff → restore → converge)
  // ------------------------------------------------------------------
  const s2server: P8T4FakeServer = createP8T4FakeServer({ startGeneration: 1 })
  const s2client: P8T4TestClient = createP8T4TestClient({
    teamSessionId: TEAM,
    transport: s2server,
    backoff: BACKOFF,
  })
  await s2client.start()
  s2server.lose()
  const s2loss = await s2client.sync()
  const s2stateAfterLoss = s2client.state()
  // The server-side truth advances during the outage.
  s2server.setGeneration(2)
  s2server.restore()
  await s2client.advance(9)
  const s2stateAt9 = s2client.state()
  const s2pendingAt9 = s2client.pendingBackoffMs()
  await s2client.advance(1)
  s2server.scriptNext('team.getProjection', projectionResponse(1))
  const s2late = await s2client.sync()
  const backoffEntry = s2client.backoffLog()[0]
  const s2: S2Result = {
    lossStatus: s2loss.status,
    stateAfterLoss: s2stateAfterLoss,
    backoffEntry: backoffEntry === undefined ? null : { ...backoffEntry },
    stateAtAdvance9: s2stateAt9,
    pendingAtAdvance9: s2pendingAt9,
    finalState: s2client.state(),
    finalGeneration: s2client.lastAppliedGeneration(),
    stateHistory: [...s2client.stateHistory()],
    connectedCount: s2client.connectedCount(),
    lateStaleStatus: s2late.status,
    appliedAfterLateStale: s2client.lastAppliedGeneration(),
  }

  // ------------------------------------------------------------------
  // S3 — duplicate invalidation (idempotent: the apply sink fires once)
  // ------------------------------------------------------------------
  const s3server: P8T4FakeServer = createP8T4FakeServer({ startGeneration: 3 })
  let s3fires = 0
  const s3client: P8T4TestClient = createP8T4TestClient({
    teamSessionId: TEAM,
    transport: s3server,
    backoff: BACKOFF,
    sinks: { onFrameApplied: () => { s3fires += 1 } },
  })
  await s3client.start()
  await s3client.sync()
  // A literal re-delivery of the same gen-3 envelope (duplicate invalidation).
  s3server.scriptNext('team.getProjection', projectionResponse(3))
  const s3redeliver = await s3client.sync()
  const s3: S3Result = {
    framesApplied: s3client.stats().framesApplied,
    framesDuplicate: s3client.stats().framesDuplicate,
    onFrameAppliedFires: s3fires,
    appliedGeneration: s3client.lastAppliedGeneration(),
    redeliveredStatus: s3redeliver.status,
  }

  // ------------------------------------------------------------------
  // S4 — page anchor (stable paging under ledger growth)
  // ------------------------------------------------------------------
  const s4server: P8T4FakeServer = createP8T4FakeServer({ startGeneration: 1, initialLedger: 5 })
  const s4client: P8T4TestClient = createP8T4TestClient({
    teamSessionId: TEAM,
    transport: s4server,
    backoff: BACKOFF,
    pageLimit: 2,
  })
  await s4client.start()
  const s4p1 = await s4client.fetchPage(0, 2)
  // The ledger grows (5 → 7 entries) while the client sits on anchor 2.
  s4server.appendLedgerEntry()
  s4server.appendLedgerEntry()
  const s4stale = await s4client.fetchPage(0, 2)
  const s4p2 = await s4client.fetchPage()
  const s4p3 = await s4client.fetchPage()
  const s4p4 = await s4client.fetchPage()
  // Stability proof: re-reading the SAME anchor 0 on the grown ledger
  // yields the SAME page content (only the total moves up).
  const s4reRead = await s4server.send({
    rpcId: 9001,
    method: 'team.getLedgerPage',
    payload: {
      version: REMOTE_CONTRACT_VERSION,
      params: { teamSessionId: TEAM, afterSequence: 0, limit: 2 },
    },
  })
  const s4reReadPage = s4reRead.result.ok
    ? (s4reRead.result.value.data as unknown as RemoteLedgerPageValue)
    : null
  const s4reReadSequences =
    s4reReadPage === null ? [] : s4reReadPage.entries.map((e) => e.sequence)
  const s4reReadCheck =
    s4reReadPage === null
      ? false
      : verifyLedgerPageAnchor(
          { afterSequence: 0, limit: 2 },
          s4reReadPage,
          s4p1.page === null ? null : s4p1.page.total,
        ).ok
  const s4anchorAfterPage1 = s4client.pageAnchor()
  const s4: S4Result = {
    page1: s4p1,
    anchorAfterPage1: s4anchorAfterPage1,
    staleAnchorReason: s4stale.reason,
    walk: [s4p2, s4p3, s4p4],
    reReadAnchor0Sequences: s4reReadSequences,
    reReadAnchor0Total: s4reReadPage === null ? -1 : s4reReadPage.total,
    reReadCheckOk: s4reReadCheck,
    finalTotal: s4p4.page === null ? null : s4p4.page.total,
  }

  // ------------------------------------------------------------------
  // S5 — sink isolation (throwing sinks are counted, never propagated)
  // ------------------------------------------------------------------
  const s5server: P8T4FakeServer = createP8T4FakeServer({ startGeneration: 1 })
  const s5boom = (): void => {
    throw new Error('sink boom')
  }
  const s5client: P8T4TestClient = createP8T4TestClient({
    teamSessionId: TEAM,
    transport: s5server,
    backoff: BACKOFF,
    sinks: {
      onConnected: s5boom,
      onStateChange: s5boom,
      onFrameApplied: s5boom,
      onFrameRejected: s5boom,
      onPageApplied: s5boom,
      onLoss: s5boom,
    },
  })
  await s5client.start()
  s5server.lose()
  await s5client.sync()
  s5server.setGeneration(2)
  s5server.restore()
  await s5client.advance(10)
  await s5client.sync()
  const s5: S5Result = {
    finalState: s5client.state(),
    finalGeneration: s5client.lastAppliedGeneration(),
    sinkErrorNames: Object.keys(s5client.stats().sinkErrors).sort(),
  }

  // ------------------------------------------------------------------
  // S6 — stop / restart (P2-T6 R1: onConnected re-fires, zero state
  // events — the last seam state persists across the stop)
  // ------------------------------------------------------------------
  const s6server: P8T4FakeServer = createP8T4FakeServer({ startGeneration: 4 })
  const s6client: P8T4TestClient = createP8T4TestClient({
    teamSessionId: TEAM,
    transport: s6server,
    backoff: BACKOFF,
  })
  await s6client.start()
  s6client.stop()
  const s6stateAfterStop = s6client.state()
  await s6client.start()
  s6server.setGeneration(5)
  await s6client.sync()
  const s6: S6Result = {
    connectedCount: s6client.connectedCount(),
    stateHistory: [...s6client.stateHistory()],
    stateAfterStop: s6stateAfterStop,
    finalGeneration: s6client.lastAppliedGeneration(),
  }

  // ------------------------------------------------------------------
  // S7 — typed errors only across the wire (the dispatcher never
  // rejects; the client records, never applies)
  // ------------------------------------------------------------------
  let s7mode: 'none' | 'untyped' | 'domain' = 'none'
  const s7server: P8T4FakeServer = createP8T4FakeServer({
    startGeneration: 1,
    ports: {
      projection: {
        project(teamSessionId: string): RemoteSafeRecord {
          if (s7mode === 'untyped') {
            throw new Error('boom')
          }
          if (s7mode === 'domain') {
            const err = new Error('projection unavailable')
            ;(err as Error & { code: string }).code = 'team-projection-unavailable'
            throw err
          }
          return syncDto(1, teamSessionId)
        },
      },
    },
  })
  const s7client: P8T4TestClient = createP8T4TestClient({
    teamSessionId: TEAM,
    transport: s7server,
    backoff: BACKOFF,
  })
  await s7client.start()
  s7mode = 'untyped'
  const s7untyped = await s7client.sync()
  s7mode = 'domain'
  const s7domain = await s7client.sync()
  s7mode = 'none'
  await s7client.sync()
  const s7: S7Result = {
    untypedStatus: s7untyped.status,
    untypedCode: s7untyped.code,
    domainCode: s7domain.code,
    stateAfter: s7client.state(),
    transportLosses: s7client.stats().transportLosses,
    appliedGeneration: s7client.lastAppliedGeneration(),
  }

  return { s1, s2, s3, s4, s5, s6, s7 }
})()

describe('P8-T4 sync: out-of-order frames (G8)', () => {
  it('applies the initial frame and the strictly newer one, then rejects the delayed older one', () => {
    expect(RT.s1.startStatus).toBe('apply')
    expect(RT.s1.startGeneration).toBe(5)
    expect(RT.s1.sync7Status).toBe('apply')
    expect(RT.s1.sync7Generation).toBe(7)
    expect(RT.s1.staleStatus).toBe('stale')
    expect(RT.s1.staleGeneration).toBe(7)
    expect(RT.s1.framesStale).toBe(1)
    expect(RT.s1.framesApplied).toBe(2)
  })

  it('rejects the older response that arrives after the newer frame (newer-first)', () => {
    expect(RT.s1.newerFirstApplied).toBe(8)
    expect(RT.s1.olderSecondStatus).toBe('stale')
  })
})

describe('P8-T4 sync: reconnect (P2-T6 aligned)', () => {
  it('moves to reconnecting on loss, schedules the capped backoff, and converges after restore', () => {
    expect(RT.s2.lossStatus).toBe('transport-loss')
    expect(RT.s2.stateAfterLoss).toBe('reconnecting')
    expect(RT.s2.backoffEntry !== null).toBe(true)
    if (RT.s2.backoffEntry !== null) {
      const e: PushBackoffEntry = RT.s2.backoffEntry
      expect(e.attempt).toBe(1)
      expect(e.capMs).toBe(20)
      expect(e.delayMs >= 10 && e.delayMs <= 20).toBe(true)
      expect(e.atMs).toBe(0)
    }
  })

  it('stays reconnecting until the backoff elapses, then connects with the new state', () => {
    expect(RT.s2.stateAtAdvance9).toBe('reconnecting')
    expect(RT.s2.pendingAtAdvance9).toBe(1)
    expect(RT.s2.finalState).toBe('connected')
    expect(RT.s2.finalGeneration).toBe(2)
    expect(RT.s2.stateHistory).toEqual(['connected', 'reconnecting', 'connected'])
    expect(RT.s2.connectedCount).toBe(2)
  })

  it('rejects a late stale frame after the reconnect (round-trip after reconnect)', () => {
    expect(RT.s2.lateStaleStatus).toBe('stale')
    expect(RT.s2.appliedAfterLateStale).toBe(2)
  })
})

describe('P8-T4 sync: duplicate invalidation (idempotent)', () => {
  it('applies the frame exactly once and treats re-deliveries as duplicates', () => {
    expect(RT.s3.framesApplied).toBe(1)
    expect(RT.s3.framesDuplicate).toBe(2)
    expect(RT.s3.onFrameAppliedFires).toBe(1)
    expect(RT.s3.appliedGeneration).toBe(3)
    expect(RT.s3.redeliveredStatus).toBe('duplicate')
  })
})

describe('P8-T4 sync: page anchor (stable pagination)', () => {
  it('walks the ledger with the anchored cursor and rejects a stale anchor', () => {
    const p1: PageFetchReport = RT.s4.page1
    expect(p1.ok).toBe(true)
    expect(p1.reason === null).toBe(true)
    if (p1.page !== null) {
      expect(p1.page.entries.map((e) => e.sequence)).toEqual([1, 2])
      expect(p1.page.nextAfterSequence).toBe(2)
      expect(p1.page.total).toBe(5)
    }
    expect(RT.s4.staleAnchorReason).toBe('anchor-mismatch')
    const walkSequences = RT.s4.walk.map((r) =>
      r.page === null ? [] : r.page.entries.map((e) => e.sequence),
    )
    expect(walkSequences).toEqual([
      [3, 4],
      [5, 6],
      [7],
    ])
    expect(RT.s4.walk[2] !== undefined && RT.s4.walk[2].ok).toBe(true)
    if (RT.s4.walk[2] !== undefined && RT.s4.walk[2].page !== null) {
      expect(RT.s4.walk[2].page.nextAfterSequence === null).toBe(true)
    }
  })

  it('re-reads the same anchor under ledger growth with the same page (acceptance: pagination stable)', () => {
    expect(RT.s4.reReadAnchor0Sequences).toEqual([1, 2])
    expect(RT.s4.reReadAnchor0Total).toBe(7)
    expect(RT.s4.reReadCheckOk).toBe(true)
    expect(RT.s4.finalTotal).toBe(7)
  })
})

describe('P8-T4 sync: sink isolation (P2-T6 R4)', () => {
  it('completes the whole loop with every sink throwing', () => {
    expect(RT.s5.finalState).toBe('connected')
    expect(RT.s5.finalGeneration).toBe(2)
    const names = RT.s5.sinkErrorNames
    expect(names.includes('onConnected')).toBe(true)
    expect(names.includes('onStateChange')).toBe(true)
    expect(names.includes('onFrameApplied')).toBe(true)
    expect(names.includes('onLoss')).toBe(true)
  })
})

describe('P8-T4 sync: stop / restart (P2-T6 R1)', () => {
  it('re-fires onConnected with zero state-change events on restart', () => {
    expect(RT.s6.connectedCount).toBe(2)
    expect(RT.s6.stateHistory).toEqual(['connected'])
    expect(RT.s6.stateAfterStop).toBe('stopped')
    expect(RT.s6.finalGeneration).toBe(5)
  })
})

describe('P8-T4 sync: typed errors only across the wire', () => {
  it('maps untyped and domain throws to typed results; the client records, never applies', () => {
    expect(RT.s7.untypedStatus).toBe('rpc-error')
    expect(RT.s7.untypedCode).toBe(REMOTE_CONTRACT_ERROR_CODES.INTERNAL_ERROR)
    expect(RT.s7.domainCode).toBe('team-projection-unavailable')
    expect(RT.s7.stateAfter).toBe('connected')
    expect(RT.s7.transportLosses).toBe(0)
    expect(RT.s7.appliedGeneration).toBe(1)
  })
})
