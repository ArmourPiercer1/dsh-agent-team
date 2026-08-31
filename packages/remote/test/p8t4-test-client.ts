/**
 * p8t4-test-client.ts — the P8-T4 test client: a deterministic,
 * transport-agnostic client fixture over the pure push engine.
 *
 * It binds the engine to an injected `RemotePushTransport` (the fake
 * server in `p8t4-server.ts`) and a deterministic clock, and provides
 * the observable surface the acceptance tests drive and assert on:
 *
 *   - whole-projection pull (`start` / `sync`) with the closed G8
 *     verdicts — a frame is applied only when strictly newer, so a
 *     stale response can never overwrite a new state;
 *   - reconnect (P2-T6 aligned): a transport loss moves the client to
 *     `reconnecting`, schedules the exponential capped backoff, and
 *     `advance(ms)` drives the clock until the retry lands;
 *   - duplicate invalidation: re-delivering the same generation is
 *     idempotent — the applied-state sink fires exactly once;
 *   - ledger page anchor: `fetchPage` walks the frozen D-5 slicer with
 *     the tracker's correlation guard (stale pages never move the
 *     cursor);
 *   - sink isolation (P2-T6 R4): a throwing sink is counted, never
 *     propagated — the loop completes regardless.
 *
 * Determinism: no real timers, no real I/O — the backoff is computed by
 * the engine and driven by `advance()` on the injected clock. Erasable
 * TS only; no `node:` builtins; relative `.js` imports.
 * @module p8t4-test-client
 */

import {
  REMOTE_CONTRACT_VERSION,
} from '../src/index.js'
import {
  PULL_PROJECTION_ENDPOINT,
  assessProjectionSync,
  backoffCapMs,
  extractPushFrame,
  isApplyAssessment,
  pickBackoffDelayMs,
  isStateChange,
  stateOnConnect,
  stateOnLoss,
  createLedgerPageTracker,
} from '../src/push/index.js'
import type {
  LedgerPageTracker,
  PageAnchorRequest,
  PageFetchReport,
  PushBackoffConfig,
  PushBackoffEntry,
  PushClientState,
  ProjectionSyncAssessment,
  ReconnectState,
  RemotePushFrame,
  RemotePushTransport,
  SeamClientRequest,
} from '../src/push/index.js'
import type {
  RemoteLedgerPageValue,
} from '../src/contracts/types.js'

/** The catalog endpoint that serves ledger pages (frozen). */
const PAGE_ENDPOINT = 'team.getLedgerPage'

/** The default page size (frozen default: 50). */
const DEFAULT_PAGE_LIMIT = 50

/** The client-observable statistics (mutable counters; the fixture owns them). */
export interface P8T4TestClientStats {
  framesApplied: number
  framesDuplicate: number
  framesStale: number
  framesForeign: number
  framesInconsistent: number
  rpcErrors: number
  transportLosses: number
  /** Transport rejections that were NOT the loss sentinel (violations). */
  unexpectedRejections: number
  /** Throwing sink counts by sink name (P2-T6 R4 isolation). */
  readonly sinkErrors: Record<string, number>
  pagesApplied: number
  pagesRejected: number
}

/** The sink surface (every sink is isolation-wrapped). */
export interface P8T4TestClientSinks {
  onConnected?: () => void
  onStateChange?: (next: ReconnectState) => void
  onFrameApplied?: (frame: RemotePushFrame) => void
  onFrameRejected?: (assessment: ProjectionSyncAssessment) => void
  onPageApplied?: (page: RemoteLedgerPageValue) => void
  onLoss?: () => void
}

/** The options of the test client. */
export interface P8T4TestClientOptions {
  readonly teamSessionId: string
  readonly transport: RemotePushTransport
  readonly backoff: PushBackoffConfig
  /** The delay picker within the frozen `[cap/2, cap]` window (default: lower bound). */
  readonly pickDelayMs?: (capMs: number) => number
  /** The default page size for `fetchPage` (default 50). */
  readonly pageLimit?: number
  readonly sinks?: P8T4TestClientSinks
}

/** The deterministic test client. */
export interface P8T4TestClient {
  readonly teamSessionId: string
  /** The lifecycle state (`stopped` outside of a start/stop window). */
  readonly state: () => PushClientState
  /** The last emitted seam state (persists across stops — P2-T6 R1). */
  readonly lastState: () => ReconnectState | null
  /** The generation of the applied frame, or `null`. */
  readonly lastAppliedGeneration: () => number | null
  /** The applied frame (isolated clone), or `null`. */
  readonly appliedFrame: () => RemotePushFrame | null
  readonly stats: () => P8T4TestClientStats
  /** The emitted state-change sequence (deduplicated). */
  readonly stateHistory: () => readonly ReconnectState[]
  /** The scheduled backoffs, in order. */
  readonly backoffLog: () => readonly PushBackoffEntry[]
  /** The deterministic clock. */
  readonly clockMs: () => number
  /** The milliseconds of the pending backoff still to run, or `null`. */
  readonly pendingBackoffMs: () => number | null
  /** The current ledger page cursor (the anchor of the next page request). */
  readonly pageAnchor: () => number
  /** How many `onConnected` sinks fired. */
  readonly connectedCount: () => number
  /** How many seam requests the client sent. */
  readonly rpcCount: () => number
  /**
   * The initial connection + first projection pull (the seam
   * wait-for-ready). Returns the assessment of that pull.
   */
  start(): Promise<ProjectionSyncAssessment>
  /**
   * One invalidation pull: re-fetch the whole projection and apply it
   * only when strictly newer (G8). Returns the assessment.
   */
  sync(): Promise<ProjectionSyncAssessment>
  /**
   * Advance the deterministic clock; drive any due backoff retry until
   * the client is connected (or stays `reconnecting` with the next
   * backoff pending).
   */
  advance(ms: number): Promise<void>
  /**
   * One anchored ledger page pull. Defaults to the tracker's current
   * anchor and the configured page size. Stale pages (answering an
   * older anchor) are rejected by the tracker.
   */
  fetchPage(afterSequence?: number, limit?: number): Promise<PageFetchReport>
  /** Stop the client; the last seam state persists (P2-T6 R1). */
  stop(): void
}

/**
 * A minimal lossless-JSON clone (the frame DTOs are plain lossless
 * records — the client isolates its applied state from the transport's
 * buffers).
 * @param value - a lossless JSON value.
 * @returns the structural clone.
 */
function cloneLossless(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => cloneLossless(item))
  }
  if (typeof value === 'object' && value !== null) {
    const out: Record<string, unknown> = {}
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = cloneLossless(item)
    }
    return out
  }
  return value
}

/**
 * Create the deterministic test client.
 * @param options - the client options (see interface).
 * @returns the client.
 */
export function createP8T4TestClient(options: P8T4TestClientOptions): P8T4TestClient {
  const sinks = options.sinks ?? {}
  const tracker: LedgerPageTracker = createLedgerPageTracker(0)
  const pageLimit = options.pageLimit ?? DEFAULT_PAGE_LIMIT

  let stopped = true
  let lastState: ReconnectState | null = null
  let attempt = 0
  let rpcCounter = 0
  let clockMs = 0
  let pendingAt: number | null = null
  let connectedCount = 0
  // P2-T6 R1 semantics: onConnected is a connection-ESTABLISHMENT event —
  // initial start, post-loss reconnect, post-stop restart — not a per-round
  // trip ack while the connection stays open.
  let connectionOpen = false
  let appliedFrame: RemotePushFrame | null = null

  const stats: P8T4TestClientStats = {
    framesApplied: 0,
    framesDuplicate: 0,
    framesStale: 0,
    framesForeign: 0,
    framesInconsistent: 0,
    rpcErrors: 0,
    transportLosses: 0,
    unexpectedRejections: 0,
    sinkErrors: {},
    pagesApplied: 0,
    pagesRejected: 0,
  }
  const stateHistory: ReconnectState[] = []
  const backoffLog: PushBackoffEntry[] = []

  const fire = (name: string, sink: (() => void) | undefined): void => {
    if (sink === undefined) return
    try {
      sink()
    } catch {
      stats.sinkErrors[name] = (stats.sinkErrors[name] ?? 0) + 1
    }
  }
  const fireWith = <T>(name: string, sink: ((value: T) => void) | undefined, value: T): void => {
    if (sink === undefined) return
    try {
      sink(value)
    } catch {
      stats.sinkErrors[name] = (stats.sinkErrors[name] ?? 0) + 1
    }
  }

  const appliedIdentity = () =>
    appliedFrame === null
      ? null
      : {
          teamSessionId: options.teamSessionId,
          generation: appliedFrame.projection.generation,
        }

  const transitionTo = (next: ReconnectState): void => {
    if (isStateChange(lastState, next)) {
      lastState = next
      stateHistory.push(next)
      fireWith('onStateChange', sinks.onStateChange, next)
    }
  }

  const markConnected = (): void => {
    const next = stateOnConnect()
    transitionTo(next)
    attempt = 0
    pendingAt = null
    if (!connectionOpen) {
      connectionOpen = true
      connectedCount += 1
      fire('onConnected', sinks.onConnected)
    }
  }

  const markLoss = (): void => {
    transitionTo(stateOnLoss(lastState))
    connectionOpen = false
    attempt += 1
    const cap = backoffCapMs(attempt, options.backoff)
    const delay = pickBackoffDelayMs(cap, options.pickDelayMs)
    backoffLog.push({ attempt, capMs: cap, delayMs: delay, atMs: clockMs })
    pendingAt = clockMs + delay
    stats.transportLosses += 1
    fire('onLoss', sinks.onLoss)
  }

  const recordAssessment = (assessment: ProjectionSyncAssessment): void => {
    switch (assessment.status) {
      case 'apply':
        stats.framesApplied += 1
        break
      case 'duplicate':
        stats.framesDuplicate += 1
        break
      case 'stale':
        stats.framesStale += 1
        break
      case 'foreign':
        stats.framesForeign += 1
        break
      case 'inconsistent':
        stats.framesInconsistent += 1
        break
      case 'rpc-error':
        stats.rpcErrors += 1
        break
      case 'transport-loss':
        break
    }
  }

  const attemptOnce = async (): Promise<ProjectionSyncAssessment> => {
    const rpcId = ++rpcCounter
    const request: SeamClientRequest = {
      rpcId,
      method: PULL_PROJECTION_ENDPOINT,
      payload: {
        version: REMOTE_CONTRACT_VERSION,
        params: { teamSessionId: options.teamSessionId },
      },
    }
    let response
    try {
      response = await options.transport.send(request)
    } catch (error) {
      if (!(error instanceof Error) || error.name !== 'PushTransportLossError') {
        stats.unexpectedRejections += 1
      }
      markLoss()
      return { status: 'transport-loss', receivedGeneration: null }
    }
    if (response.rpcId !== rpcId) {
      // An uncorrelated response is never applied (defensive guard: the
      // seam correlation is part of the wire discipline).
      const assessment: ProjectionSyncAssessment = {
        status: 'inconsistent',
        receivedGeneration: null,
      }
      recordAssessment(assessment)
      fireWith('onFrameRejected', sinks.onFrameRejected, assessment)
      markConnected()
      return assessment
    }
    // The engine works on the frozen RemoteResponse envelope — unwrap the
    // seam wrapper (its only other field is the rpcId correlation, checked
    // above).
    const assessment = assessProjectionSync(appliedIdentity(), response.result)
    recordAssessment(assessment)
    if (isApplyAssessment(assessment)) {
      const frame = extractPushFrame(response.result)
      if (frame !== null) {
        appliedFrame = {
          projection: cloneLossless(frame.projection) as RemotePushFrame['projection'],
          provenance: { ...frame.provenance },
        }
        fireWith('onFrameApplied', sinks.onFrameApplied, appliedFrame)
      }
    } else {
      fireWith('onFrameRejected', sinks.onFrameRejected, assessment)
    }
    markConnected()
    return assessment
  }

  const start = async (): Promise<ProjectionSyncAssessment> => {
    if (!stopped) {
      return attemptOnce()
    }
    stopped = false
    return attemptOnce()
  }

  const sync = async (): Promise<ProjectionSyncAssessment> => {
    if (stopped) {
      throw new Error('p8t4 test client: sync() before start() or after stop()')
    }
    return attemptOnce()
  }

  const advance = async (ms: number): Promise<void> => {
    if (ms < 0 || !Number.isInteger(ms)) {
      throw new Error(`p8t4 test client: advance() takes a non-negative integer: ${ms}`)
    }
    clockMs += ms
    while (!stopped && pendingAt !== null && clockMs >= pendingAt) {
      pendingAt = null
      const assessment = await attemptOnce()
      if (assessment.status === 'transport-loss') {
        continue
      }
      break
    }
  }

  const fetchPage = async (
    afterSequence?: number,
    limit?: number,
  ): Promise<PageFetchReport> => {
    if (stopped) {
      throw new Error('p8t4 test client: fetchPage() before start() or after stop()')
    }
    const anchor = afterSequence ?? tracker.state().anchor
    const lim = limit ?? pageLimit
    const requestParams = {
      teamSessionId: options.teamSessionId,
      afterSequence: anchor,
      limit: lim,
    }
    const rpcId = ++rpcCounter
    const request: SeamClientRequest = {
      rpcId,
      method: PAGE_ENDPOINT,
      payload: { version: REMOTE_CONTRACT_VERSION, params: requestParams },
    }
    let response
    try {
      response = await options.transport.send(request)
    } catch (error) {
      if (!(error instanceof Error) || error.name !== 'PushTransportLossError') {
        stats.unexpectedRejections += 1
      }
      markLoss()
      return { rpcId, ok: false, reason: 'transport-loss', page: null }
    }
    if (response.rpcId !== rpcId) {
      stats.pagesRejected += 1
      return { rpcId, ok: false, reason: 'rpc-id-mismatch', page: null }
    }
    const remoteResult = response.result
    if (!remoteResult.ok) {
      stats.rpcErrors += 1
      return { rpcId, ok: false, reason: 'rpc-error', page: null }
    }
    // Wire-boundary structural extraction: the frozen dispatcher already
    // validated the lossless record; this cast is the client-side read of
    // the frozen `RemoteLedgerPageValue` shape.
    const page = remoteResult.value.data as unknown as RemoteLedgerPageValue
    const pageRequest: PageAnchorRequest = { afterSequence: anchor, limit: lim }
    const result = tracker.applyPage(pageRequest, page)
    if (result.ok) {
      stats.pagesApplied += 1
      fireWith('onPageApplied', sinks.onPageApplied, page)
    } else {
      stats.pagesRejected += 1
    }
    return {
      rpcId,
      ok: result.ok,
      reason: result.ok ? null : result.reason,
      page,
    }
  }

  const stop = (): void => {
    stopped = true
    pendingAt = null
    connectionOpen = false
  }

  const state = (): PushClientState => {
    if (stopped) return 'stopped'
    return lastState === null ? 'reconnecting' : lastState
  }

  return {
    teamSessionId: options.teamSessionId,
    state,
    lastState: () => lastState,
    lastAppliedGeneration: () =>
      appliedFrame === null ? null : appliedFrame.projection.generation,
    appliedFrame: () => appliedFrame,
    stats: () => ({ ...stats, sinkErrors: { ...stats.sinkErrors } }),
    stateHistory: () => [...stateHistory],
    backoffLog: () => [...backoffLog],
    clockMs: () => clockMs,
    pendingBackoffMs: () => (pendingAt === null ? null : pendingAt - clockMs),
    pageAnchor: () => tracker.state().anchor,
    connectedCount: () => connectedCount,
    rpcCount: () => rpcCounter,
    start,
    sync,
    advance,
    fetchPage,
    stop,
  }
}
