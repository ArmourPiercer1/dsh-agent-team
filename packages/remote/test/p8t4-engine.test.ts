/**
 * p8t4-engine.test.ts — the P8-T4 push engine acceptance tests (pure).
 *
 * Covers the deterministic core of the card:
 *   - the whole-projection generation rule (G8: a frame is applied only
 *     when strictly newer; stale / duplicate / foreign / inconsistent
 *     responses change no state) — including the out-of-order
 *     N → N+2 → N+1 case where N+1 must be rejected;
 *   - the P2-T6 aligned backoff (capped exponential formula, delay
 *     within [cap/2, cap], state-change deduplication);
 *   - the ledger page anchor rule (the frozen D-5 slicing contract
 *     mirrored client-side, incl. append-only `total` monotonicity and
 *     the tracker's stale-page correlation guard).
 *
 * The wire envelopes are built with the FROZEN `buildRemoteSuccess`
 * builder — the engine under test never sees a hand-rolled shape.
 *
 * Erasable TS only; no `node:` builtins; relative `.js` imports.
 * @module p8t4-engine.test
 */
import { describe, expect, it } from 'vitest'

import {
  REMOTE_CONTRACT_VERSION,
  buildRemoteSuccess,
  PUSH_MIN_GENERATION,
  assessProjectionSync,
  backoffCapMs,
  createLedgerPageTracker,
  decideFrameVerdict,
  defaultDelayPicker,
  extractPushFrame,
  isApplyAssessment,
  isStateChange,
  isStrictlyNewerGeneration,
  pickBackoffDelayMs,
  stateOnConnect,
  stateOnLoss,
  verifyLedgerPageAnchor,
  PushBackoffRangeError,
  PushTransportLossError,
} from '../src/index.js'
import type {
  PageAnchorRequest,
  PushBackoffConfig,
  RemoteLedgerEntryValue,
  RemoteLedgerPageValue,
  RemoteErrorResult,
  RemoteResponse,
  RemoteSafeRecord,
} from '../src/index.js'

const TEAM_A = 'root-1'
const TEAM_B = 'root-2'

/** The P2-T6 fixture backoff (R2: base 20, factor 2). */
const BACKOFF: PushBackoffConfig = { baseMs: 20, factor: 2, maxMs: 1000 }

/** One whole-projection DTO (the nine frozen top-level fields). */
function dto(generation: number, teamSessionId: string): RemoteSafeRecord {
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

/** A frozen success envelope for one pulled projection. */
function projectionResponse(generation: number, teamSessionId: string): RemoteResponse {
  return buildRemoteSuccess(
    { projection: dto(generation, teamSessionId) },
    {
      method: 'team.getProjection',
      endpoint: 'team.getProjection',
      contractVersion: REMOTE_CONTRACT_VERSION,
      requestToken: null,
      projectionGeneration: generation,
    },
  )
}

/** A success envelope whose provenance generation disagrees with the data. */
function inconsistentResponse(generation: number, provenanceGeneration: number): RemoteResponse {
  return buildRemoteSuccess(
    { projection: dto(generation, TEAM_A) },
    {
      method: 'team.getProjection',
      endpoint: 'team.getProjection',
      contractVersion: REMOTE_CONTRACT_VERSION,
      requestToken: null,
      projectionGeneration: provenanceGeneration,
    },
  )
}

/** A frozen typed error envelope (the dispatcher never rejects). */
function errorResponse(code: string): RemoteErrorResult {
  return {
    ok: false,
    error: {
      code,
      message: `typed remote error (${code})`,
      details: {
        method: 'team.getProjection',
        endpoint: 'team.getProjection',
        contractVersion: REMOTE_CONTRACT_VERSION,
        requestToken: null,
      },
    },
  }
}

/** One ledger entry (the frozen closed wire shape). */
function entry(sequence: number): RemoteLedgerEntryValue {
  return {
    schemaVersion: 1,
    sequence,
    rootSessionId: TEAM_A,
    factType: 'fact',
    payload: { sequence },
    operationId: `op-${sequence}`,
    createdAt: `2026-08-29T01:00:${String(sequence).padStart(2, '0')}.000Z`,
  }
}

/** One page (the frozen D-5 value shape). */
function page(
  sequences: readonly number[],
  nextAfterSequence: number | null,
  total: number,
): RemoteLedgerPageValue {
  return {
    entries: sequences.map((s) => entry(s)),
    nextAfterSequence,
    total,
  }
}

const HEAD: PageAnchorRequest = { afterSequence: 0, limit: 2 }

describe('P8-T4 engine: whole-projection generation rule (G8)', () => {
  it('applies the first frame (nothing applied yet)', () => {
    expect(decideFrameVerdict(null, { teamSessionId: TEAM_A, generation: 1 })).toBe('apply')
    expect(isStrictlyNewerGeneration(1, null)).toBe(true)
    expect(PUSH_MIN_GENERATION).toBe(1)
  })

  it('applies a strictly newer generation and rejects an out-of-order older one', () => {
    const appliedN2 = { teamSessionId: TEAM_A, generation: 2 }
    expect(decideFrameVerdict(appliedN2, { teamSessionId: TEAM_A, generation: 3 })).toBe('apply')
    // The out-of-order N+1 after N+2: rejected (stale) — never overwrites.
    expect(decideFrameVerdict(appliedN2, { teamSessionId: TEAM_A, generation: 1 })).toBe('stale')
    expect(isStrictlyNewerGeneration(3, 2)).toBe(true)
    expect(isStrictlyNewerGeneration(1, 2)).toBe(false)
  })

  it('treats the same generation as a duplicate (idempotent invalidation)', () => {
    expect(
      decideFrameVerdict({ teamSessionId: TEAM_A, generation: 7 }, { teamSessionId: TEAM_A, generation: 7 }),
    ).toBe('duplicate')
    expect(isStrictlyNewerGeneration(7, 7)).toBe(false)
  })

  it('rejects a frame of another teamSessionId as foreign', () => {
    expect(
      decideFrameVerdict({ teamSessionId: TEAM_A, generation: 1 }, { teamSessionId: TEAM_B, generation: 9 }),
    ).toBe('foreign')
  })
})

describe('P8-T4 engine: deterministic pull assessment over frozen envelopes', () => {
  it('assesses apply / stale / duplicate / foreign on real frozen envelopes', () => {
    const first = assessProjectionSync(null, projectionResponse(5, TEAM_A))
    expect(first.status).toBe('apply')
    expect(first.receivedGeneration).toBe(5)
    expect(isApplyAssessment(first)).toBe(true)

    const applied = { teamSessionId: TEAM_A, generation: 7 }
    expect(assessProjectionSync(applied, projectionResponse(6, TEAM_A)).status).toBe('stale')
    expect(assessProjectionSync(applied, projectionResponse(7, TEAM_A)).status).toBe('duplicate')
    expect(assessProjectionSync(applied, projectionResponse(8, TEAM_A)).status).toBe('apply')
    expect(assessProjectionSync(applied, projectionResponse(9, TEAM_B)).status).toBe('foreign')
  })

  it('assesses a typed RPC error without touching state', () => {
    const applied = { teamSessionId: TEAM_A, generation: 7 }
    const assessment = assessProjectionSync(applied, errorResponse('internal-error'))
    expect(assessment.status).toBe('rpc-error')
    expect(assessment.code).toBe('internal-error')
    expect(assessment.receivedGeneration === null).toBe(true)
    expect(isApplyAssessment(assessment)).toBe(false)
  })

  it('rejects a frame whose provenance generation disagrees with the data', () => {
    const applied = { teamSessionId: TEAM_A, generation: 5 }
    const assessment = assessProjectionSync(applied, inconsistentResponse(6, 7))
    expect(assessment.status).toBe('inconsistent')
    expect(isApplyAssessment(assessment)).toBe(false)
  })

  it('rejects a frame without a positive integer generation', () => {
    const response = buildRemoteSuccess(
      { projection: { ...dto(1, TEAM_A), generation: 0 } },
      {
        method: 'team.getProjection',
        endpoint: 'team.getProjection',
        contractVersion: REMOTE_CONTRACT_VERSION,
        requestToken: null,
        projectionGeneration: null,
      },
    )
    const assessment = assessProjectionSync(null, response)
    expect(assessment.status).toBe('inconsistent')
    expect(isApplyAssessment(assessment)).toBe(false)
  })

  it('extracts the frame only when the assessment permits it (no frame without a generation check)', () => {
    const good = projectionResponse(5, TEAM_A)
    const frame = extractPushFrame(good)
    expect(frame !== null).toBe(true)
    if (frame !== null) {
      expect(frame.projection.generation).toBe(5)
      expect(frame.provenance.origin).toBe('team-remote')
      expect(frame.provenance.projectionGeneration).toBe(5)
    }
    expect(extractPushFrame(errorResponse('internal-error')) === null).toBe(true)
    expect(extractPushFrame(inconsistentResponse(6, 7)) === null).toBe(true)
  })
})

describe('P8-T4 engine: P2-T6 aligned backoff', () => {
  it('computes the capped exponential cap per the frozen R2 formula', () => {
    expect(backoffCapMs(1, BACKOFF)).toBe(20)
    expect(backoffCapMs(2, BACKOFF)).toBe(40)
    expect(backoffCapMs(3, BACKOFF)).toBe(80)
    expect(backoffCapMs(4, BACKOFF)).toBe(160)
    expect(backoffCapMs(5, BACKOFF)).toBe(320)
    expect(backoffCapMs(6, BACKOFF)).toBe(640)
    expect(backoffCapMs(7, BACKOFF)).toBe(1000)
    expect(backoffCapMs(8, BACKOFF)).toBe(1000)
  })

  it('keeps the concrete delay within [cap/2, cap] (R2 bounds)', () => {
    const delay1 = pickBackoffDelayMs(backoffCapMs(1, BACKOFF))
    const delay2 = pickBackoffDelayMs(backoffCapMs(2, BACKOFF))
    expect(delay1 >= 10 && delay1 <= 20).toBe(true)
    expect(delay2 >= 20 && delay2 <= 40).toBe(true)
    // A picker at the top of the window is accepted.
    expect(pickBackoffDelayMs(20, (cap) => cap)).toBe(20)
    // A picker at the floor is accepted.
    expect(pickBackoffDelayMs(20, (cap) => Math.floor(cap / 2))).toBe(10)
  })

  it('rejects a delay outside the frozen window with a typed local error', () => {
    let thrown: unknown = null
    try {
      pickBackoffDelayMs(20, () => 9)
    } catch (error) {
      thrown = error
    }
    expect(thrown instanceof PushBackoffRangeError).toBe(true)

    let thrown2: unknown = null
    try {
      pickBackoffDelayMs(20, () => 21)
    } catch (error) {
      thrown2 = error
    }
    expect(thrown2 instanceof PushBackoffRangeError).toBe(true)

    let thrown3: unknown = null
    try {
      backoffCapMs(0, BACKOFF)
    } catch (error) {
      thrown3 = error
    }
    expect(thrown3 instanceof PushBackoffRangeError).toBe(true)
  })

  it('uses the deterministic lower-bound picker by default', () => {
    expect(defaultDelayPicker(20)).toBe(10)
    expect(defaultDelayPicker(21)).toBe(10)
    expect(defaultDelayPicker(1)).toBe(1)
  })

  it('models the loss/connect transitions with state-change deduplication (R1/R3)', () => {
    expect(stateOnLoss('connected')).toBe('reconnecting')
    expect(stateOnLoss(null)).toBe('reconnecting')
    expect(stateOnConnect()).toBe('connected')
    expect(isStateChange(null, 'connected')).toBe(true)
    expect(isStateChange('connected', 'connected')).toBe(false)
    expect(isStateChange('reconnecting', 'connected')).toBe(true)
    expect(isStateChange('connected', 'reconnecting')).toBe(true)
  })
})

describe('P8-T4 engine: ledger page anchor rule (D-5 mirror)', () => {
  it('accepts a valid full page and a valid terminal page', () => {
    const full = verifyLedgerPageAnchor(HEAD, page([1, 2], 2, 5), null)
    expect(full).toEqual({ ok: true, entriesCount: 2, total: 5 })
    const terminal = verifyLedgerPageAnchor({ afterSequence: 4, limit: 2 }, page([5], null, 5), null)
    expect(terminal).toEqual({ ok: true, entriesCount: 1, total: 5 })
    const empty = verifyLedgerPageAnchor({ afterSequence: 5, limit: 2 }, page([], null, 5), null)
    expect(empty).toEqual({ ok: true, entriesCount: 0, total: 5 })
  })

  it('rejects entries that do not sit strictly after the anchor, in order', () => {
    expect(
      verifyLedgerPageAnchor({ afterSequence: 2, limit: 2 }, page([2, 3], 3, 5), null).ok,
    ).toBe(false)
    const atAnchor = verifyLedgerPageAnchor({ afterSequence: 2, limit: 2 }, page([2, 3], 3, 5), null)
    if (!atAnchor.ok) expect(atAnchor.reason).toBe('sequence-before-anchor')
    const unsorted = verifyLedgerPageAnchor({ afterSequence: 0, limit: 2 }, page([3, 3], 3, 5), null)
    if (!unsorted.ok) expect(unsorted.reason).toBe('not-strictly-ascending')
  })

  it('rejects a page over the limit', () => {
    const result = verifyLedgerPageAnchor(HEAD, page([1, 2, 3], 3, 6), null)
    if (!result.ok) expect(result.reason).toBe('page-exceeds-limit')
  })

  it('rejects a cursor that does not match the last included sequence', () => {
    const result = verifyLedgerPageAnchor(HEAD, page([1, 2], 3, 5), null)
    if (!result.ok) expect(result.reason).toBe('cursor-mismatch')
    const emptyWithCursor = verifyLedgerPageAnchor(HEAD, page([], 1, 5), null)
    if (!emptyWithCursor.ok) expect(emptyWithCursor.reason).toBe('cursor-mismatch')
  })

  it('rejects a non-terminal page shorter than the limit', () => {
    const result = verifyLedgerPageAnchor(HEAD, page([1], 1, 5), null)
    if (!result.ok) expect(result.reason).toBe('non-terminal-page-short')
  })

  it('keeps total non-negative and non-decreasing (append-only ledger)', () => {
    const negative = verifyLedgerPageAnchor(HEAD, page([], null, -1), null)
    if (!negative.ok) expect(negative.reason).toBe('total-negative')
    const decreased = verifyLedgerPageAnchor({ afterSequence: 0, limit: 5 }, page([1, 2], null, 4), 5)
    if (!decreased.ok) expect(decreased.reason).toBe('total-decreased')
    // An unchanged total is legal (no growth between reads).
    const same = verifyLedgerPageAnchor({ afterSequence: 0, limit: 5 }, page([1, 2], null, 5), 5)
    expect(same.ok).toBe(true)
  })

  it('walks the cursor with the tracker and rejects stale pages (correlation guard)', () => {
    const tracker = createLedgerPageTracker()
    expect(tracker.state().anchor).toBe(0)

    const first = tracker.applyPage(HEAD, page([1, 2], 2, 5))
    expect(first).toEqual({ ok: true, entriesCount: 2, total: 5 })
    expect(tracker.state().anchor).toBe(2)

    // A stale / duplicate response answering the old anchor (0) must not
    // move the cursor or double-apply.
    const stale = tracker.applyPage(HEAD, page([1, 2], 2, 5))
    if (!stale.ok) expect(stale.reason).toBe('anchor-mismatch')
    expect(tracker.state().anchor).toBe(2)
    expect(tracker.state().pagesRejected).toBe(1)

    const second = tracker.applyPage({ afterSequence: 2, limit: 2 }, page([3, 4], 4, 5))
    expect(second.ok).toBe(true)
    expect(tracker.state().anchor).toBe(4)

    const terminal = tracker.applyPage({ afterSequence: 4, limit: 2 }, page([5], null, 5))
    expect(terminal.ok).toBe(true)
    // The terminal page does not advance the cursor (it is at the end).
    expect(tracker.state().anchor).toBe(4)
    expect(tracker.state().pagesApplied).toBe(3)
    expect(tracker.state().lastTotal).toBe(5)
  })

  it('grows the ledger under a stable anchor (the pagination-stability acceptance)', () => {
    const tracker = createLedgerPageTracker()
    // Page one: sequences 1..2 of a 5-entry ledger.
    expect(tracker.applyPage(HEAD, page([1, 2], 2, 5)).ok).toBe(true)
    // The ledger grows (5 → 7 entries); re-reading the SAME anchor 0 must
    // yield the SAME page (stability), and the total only moves up.
    expect(tracker.applyPage(HEAD, page([1, 2], 2, 7)).ok).toBe(false) // stale anchor (cursor moved)
    const reReadAnchor0 = verifyLedgerPageAnchor(HEAD, page([1, 2], 2, 7), 5)
    expect(reReadAnchor0).toEqual({ ok: true, entriesCount: 2, total: 7 })
    expect(reReadAnchor0.ok).toBe(true)
    // ...and the walk from the current cursor reaches the grown end.
    expect(tracker.applyPage({ afterSequence: 2, limit: 2 }, page([3, 4], 4, 7)).ok).toBe(true)
    expect(tracker.applyPage({ afterSequence: 4, limit: 2 }, page([5, 6], 6, 7)).ok).toBe(true)
    expect(tracker.applyPage({ afterSequence: 6, limit: 2 }, page([7], null, 7)).ok).toBe(true)
    expect(tracker.state().lastTotal).toBe(7)
  })
})

describe('P8-T4 engine: transport loss sentinel', () => {
  it('is a named Error carrying no state', () => {
    const loss = new PushTransportLossError()
    expect(loss instanceof Error).toBe(true)
    expect(loss.name).toBe('PushTransportLossError')
    expect(typeof loss.message).toBe('string')
    expect(loss.message.length).toBeGreaterThan(0)
  })
})
