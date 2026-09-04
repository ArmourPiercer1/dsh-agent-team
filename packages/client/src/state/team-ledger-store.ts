/**
 * P9-T4 (S2-C) — the cursor-safe durable-ledger store.
 *
 * REIMPLEMENT orchestration per plan §6.4; the cursor-validity algorithm
 * is REUSED, never reimplemented: every page passes through the frozen
 * `createLedgerPageTracker().applyPage`, which applies the frozen
 * `verifyLedgerPageAnchor` shape rule (total non-regression, anchor
 * ordering, strict ascending, limit bound, cursor consistency) ON TOP
 * of the correlation guard (a page answering an older anchor is
 * `anchor-mismatch`-rejected before any shape check). The store
 * implements NO cursor-validity logic of its own (plan §6.4: 禁止自己
 * 再实现 cursor validity; gate G2).
 *
 * Correctness-first forward paging (plan §6.4, frozen D-5 `sequence >
 * afterSequence` cursor — there is NO reverse-paging backend API):
 *   1. one tracker per team binding (recreated on a team switch — a new
 *      authority episode; a mid-episode tracker recreation would drop
 *      the `total` monotonicity guard, so the SAME tracker serves the
 *      whole episode);
 *   2. page-by-page merge with sequence dedupe (the map key IS the
 *      dedupe; re-reading an anchor re-yields the same page, frozen
 *      slicer stability);
 *   3. the tracker validates every page — a rejected page NEVER merges
 *      and publishes the typed `LedgerPageReject` reason;
 *   4. the store keeps catching up until the frozen slicer reports the
 *      tail (a page without a cursor); the UI-side window ("Load
 *      earlier") is client-visible state, never ledger authority;
 *   5. `completeThrough` is the HIGHEST LOADED sequence (the tracker's
 *      anchor advances only on cursor pages, so the store tracks the
 *      frontier itself); completeness = `total !== null &&
 *      completeThrough >= total` — a partial ledger is never presented
 *      as complete;
 *   6. a new event appends: `refresh()` re-pulls at the tracker's
 *      current anchor (the frozen stable re-read), and the dedupe merge
 *      keeps the loaded window un-reordered.
 *
 * Failure discipline: an RPC-level typed error is stored as `error`
 * (the frozen `RemoteErrorResult`, intact — never exception-ified,
 * never re-wrapped); a transport-level rejection (the frozen
 * `PushTransportLossError` is the only kind the seam carrier rejects
 * with) is stored as the closed `transport-loss` page-reject reason. A
 * rejected page stores its frozen `reason`. The catch-up episode ends
 * on any failure; nothing auto-retries (the pull is on-demand: `open` /
 * `refresh`).
 *
 * The store is React-free (data-object layer): a bare observable source
 * — stable snapshot between changes, `subscribe` — plus the pull
 * actions. One page pull at a time (single-flight); a team switch while
 * a pull is in flight binds immediately and the stale-team response is
 * dropped by the team guard (never merged).
 *
 * Pure module: no React, no node: builtins, no I/O. Erasable TS only.
 * @module @dsh-agent-team/client/state/team-ledger-store
 */

import {
  createLedgerPageTracker,
  type PageAnchorRequest,
  type PageRejectReason,
  type RemoteErrorResult,
  type RemoteLedgerEntryValue,
  type RemoteLedgerPageValue,
  type RemoteResponse,
} from '../../../remote/src/index.js'

/**
 * One frozen page rejection (shape violation or correlation failure —
 * the tracker's reject arm; `transport-loss` is the store's own arm for
 * a seam channel loss, from the same closed reason set).
 */
export type LedgerPageReject = { readonly ok: false; readonly reason: PageRejectReason }

/**
 * The published ledger state (plan §6.4 sketch; `teamSessionId` widened
 * to `string | null` for the unbound pre-`open` state).
 */
export interface TeamLedgerState {
  /** The bound TeamSession id (null before the first `open` / after `reset`). */
  readonly teamSessionId: string | null
  /**
   * The durable entries by sequence (sequence dedupe; the frozen wire
   * values, identity-stable). Published by reference: the store is the
   * mutation authority, the snapshot notification is the change signal.
   */
  readonly entriesBySequence: ReadonlyMap<number, RemoteLedgerEntryValue>
  /** The loaded sequences in ascending order (the store's order authority). */
  readonly orderedSequences: readonly number[]
  /** The last accepted ledger total (append-only monotone; null pre-page). */
  readonly total: number | null
  /** The highest loaded sequence (the catch-up frontier). */
  readonly completeThrough: number
  /** True while a catch-up episode is active (pages being fetched/merged). */
  readonly loading: boolean
  /**
   * The last typed failure: the frozen `RemoteErrorResult` (an RPC-level
   * error) or one `LedgerPageReject` (a page rejected by the tracker, or
   * a transport loss). Distinguish by the `reason` key.
   */
  readonly error?: RemoteErrorResult | LedgerPageReject
}

/** Store options (all dependencies injected; no hidden globals). */
export interface TeamLedgerStoreOptions {
  /**
   * The frozen ledger page pull (TeamRemoteClient.getLedgerPage):
   * `team.getLedgerPage { teamSessionId, afterSequence, limit }`.
   */
  readonly getLedgerPage: (
    teamSessionId: string,
    afterSequence: number,
    limit: number,
  ) => Promise<RemoteResponse>
  /** The page size (frozen bounds 1..500, frozen default 50). */
  readonly limit?: number
}

/** The store surface (observable source + pull actions). */
export interface TeamLedgerStore {
  /** The current snapshot (stable reference between changes). */
  getState(): TeamLedgerState
  /** Subscribe to snapshot changes; returns the disposer. */
  subscribe(listener: () => void): () => void
  /**
   * Bind the store to one TeamSession and catch up from the ledger head
   * (`afterSequence = 0` — the P9 correctness-first start; a known
   * durable anchor optimization is P10 tail-bootstrap). A team switch
   * recreates the tracker and drops every entry (a new authority
   * episode).
   * @returns settled when the catch-up episode for the bound team ends
   *   (tail reached, or a typed failure).
   */
  open(teamSessionId: string): Promise<void>
  /**
   * Append/re-pull over the current binding (plan §6.4.6): continues the
   * catch-up at the tracker's current anchor — a completed store re-reads
   * its tail page (the frozen stable re-read; the dedupe merge keeps the
   * loaded window un-reordered).
   * @returns settled as in {@link open}; a no-op (settled immediately)
   *   when unbound.
   */
  refresh(): Promise<void>
  /** Drop all state (view switch); an in-flight response is team-guarded. */
  reset(): void
}

/** The frozen default page size. */
const DEFAULT_LEDGER_PAGE_LIMIT = 50

/**
 * Create one ledger store bound to one ledger page pull.
 * @param options - the injected frozen page pull + CLIENT_LOCAL page size.
 * @returns the store (a bare observable source + actions).
 */
export function createTeamLedgerStore(options: TeamLedgerStoreOptions): TeamLedgerStore {
  const limit: number = options.limit === undefined ? DEFAULT_LEDGER_PAGE_LIMIT : options.limit

  let tracker = createLedgerPageTracker(0)
  const entriesBySequence = new Map<number, RemoteLedgerEntryValue>()
  let state: TeamLedgerState = {
    teamSessionId: null,
    entriesBySequence,
    orderedSequences: [],
    total: null,
    completeThrough: 0,
    loading: false,
  }
  const listeners = new Set<() => void>()
  let inFlight = false
  let pendingStart = false
  let settleResolvers: Array<() => void> = []

  const publish = (next: TeamLedgerState): void => {
    state = next
    for (const listener of [...listeners]) listener()
  }

  const orderedSnapshot = (): readonly number[] =>
    [...entriesBySequence.keys()].sort((a, b) => a - b)

  const notifySettled = (): void => {
    const resolvers = settleResolvers
    settleResolvers = []
    for (const resolve of resolvers) resolve()
  }

  /** Settled when no catch-up episode is in flight (or one becomes idle). */
  const nextSettled = (): Promise<void> => {
    if (inFlight === false && pendingStart === false) return Promise.resolve()
    return new Promise(resolve => {
      settleResolvers.push(resolve)
    })
  }

  /**
   * The catch-up loop: fetch page at the tracker's anchor, gate it
   * through the frozen tracker, merge on accept, continue while the
   * frozen slicer reports a cursor. Ends on: the tail (no cursor), a
   * tracker rejection, an RPC error, a transport loss, or a stale team.
   */
  const runCatchUp = async (): Promise<void> => {
    inFlight = true
    try {
      while (true) {
        const team = state.teamSessionId
        if (team === null) return
        const anchor = tracker.state().anchor
        const request: PageAnchorRequest = { afterSequence: anchor, limit }
        if (state.loading === false) publish({ ...state, loading: true })
        let response: RemoteResponse
        try {
          response = await options.getLedgerPage(team, anchor, limit)
        } catch {
          // Transport-level rejection (frozen: PushTransportLossError is
          // the only kind the seam carrier rejects with).
          if (state.teamSessionId === team) {
            publish({ ...state, loading: false, error: { ok: false, reason: 'transport-loss' } })
          }
          return
        }
        // Team guard: a stale-team response is dropped, never merged.
        if (state.teamSessionId !== team) return
        if (response.ok === false) {
          // Typed RPC error: stored intact (never exception-ified).
          publish({ ...state, loading: false, error: response })
          return
        }
        // The ONE documented boundary narrowing of a page value: the seam
        // data is `RemoteSafeJsonValue` (structurally no overlap with the
        // page shape, hence the two-step lift); at the wire it is the
        // frozen `RemoteLedgerPageValue` (lossless-JSON checked). Same
        // pattern as `projectionFromWire` (see the P9-T4 evidence note).
        const page = response.value.data as unknown as RemoteLedgerPageValue
        const check = tracker.applyPage(request, page)
        if (check.ok === false) {
          // Frozen gate: a rejected page never merges (G2 hard invariant).
          publish({ ...state, loading: false, error: { ok: false, reason: check.reason } })
          return
        }
        // Merge with sequence dedupe (the map key IS the dedupe).
        let frontier = state.completeThrough
        for (const entry of page.entries) {
          entriesBySequence.set(entry.sequence, entry)
          if (entry.sequence > frontier) frontier = entry.sequence
        }
        const total = check.total
        const nextComplete = total !== null && frontier >= total
        const tailReached = page.nextAfterSequence === null
        // `loading` mirrors the loop: true only while another page will be
        // fetched, so every episode exit publishes loading: false.
        const continuePaging = tailReached === false && nextComplete === false
        publish({
          ...state,
          loading: continuePaging,
          error: undefined,
          total,
          completeThrough: frontier,
          entriesBySequence,
          orderedSequences: orderedSnapshot(),
        })
        // The frozen slicer sets the cursor only while more entries
        // remain: the tail ends the catch-up episode (the completeness
        // verdict stands on the numbers, a total/frontier mismatch is
        // reported by the `partial` marker, never by a fetch loop).
        if (continuePaging === false) return
      }
    } finally {
      inFlight = false
      const wantsMore = pendingStart
      pendingStart = false
      if (wantsMore && state.teamSessionId !== null) {
        void runCatchUp()
      } else {
        notifySettled()
      }
    }
  }

  /** Single-flight request for a catch-up episode (queue one restart). */
  const requestCatchUp = (): void => {
    if (inFlight) {
      pendingStart = true
      return
    }
    void runCatchUp()
  }

  const open = (teamSessionId: string): Promise<void> => {
    if (state.teamSessionId !== teamSessionId) {
      // A new authority episode: a fresh tracker (anchor 0), no entries.
      tracker = createLedgerPageTracker(0)
      entriesBySequence.clear()
      publish({
        teamSessionId,
        entriesBySequence,
        orderedSequences: [],
        total: null,
        completeThrough: 0,
        loading: false,
        error: undefined,
      })
    }
    requestCatchUp()
    return nextSettled()
  }

  const refresh = (): Promise<void> => {
    if (state.teamSessionId === null) return Promise.resolve()
    requestCatchUp()
    return nextSettled()
  }

  const reset = (): void => {
    tracker = createLedgerPageTracker(0)
    entriesBySequence.clear()
    publish({
      teamSessionId: null,
      entriesBySequence,
      orderedSequences: [],
      total: null,
      completeThrough: 0,
      loading: false,
      error: undefined,
    })
  }

  const getState = (): TeamLedgerState => state

  const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener)
    return () => {
      listeners.delete(listener)
    }
  }

  return { getState, subscribe, open, refresh, reset }
}
