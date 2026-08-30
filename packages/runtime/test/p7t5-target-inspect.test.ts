/**
 * P7-T5 mandatory test 3 — "target inspect" (TaskDoc §11.8 P7-T5;
 * Architecture §34.3): after the one-shot handoff, the target team B
 * cannot `history_read(A)` and cannot search A — ANY target-side
 * attempt to query the source session through the handoff boundary is
 * ALWAYS rejected with `HANDOFF_SOURCE_HISTORY_ACCESS_DENIED`, for BOTH
 * query modes, and regardless of the presented context token (the token
 * is provenance/navigation metadata, NOT a read grant). The guard never
 * touches the source surface port: the read counter stays put. The
 * structural no-grant check proves the frozen context carries no
 * callable value anywhere — it is pure data, so it cannot be a read
 * path to the source.
 *
 * Negative controls: structurally invalid arguments fail validation
 * first with `HANDOFF_REQUEST_MALFORMED` (empty token; malformed
 * query) — the rejection vocabulary stays closed.
 *
 * Mock-first (ruling R28); top-level-await pattern (plain-node shim):
 * the scenario runs at module top level; the `it` bodies assert only
 * over the captured data.
 *
 * @module @dsh-agent-team/runtime/test/p7t5-target-inspect
 */

import { describe, expect, it } from 'vitest'
import { isRemoteSafeJsonValue } from '../../contracts/src/index.js'
import {
  HANDOFF_ERROR_CODES,
  HandoffError,
} from '../handoff/index.js'
import type { SourceHistoryQuery } from '../handoff/index.js'
import { P7T5_FIXTURE, assertHandoffCode, createP7T5World } from './p7t5-helpers.js'

/** True when `value` (or anything nested in it) is a function — the
 *  structural "no read grant" probe. */
function containsCallable(value: unknown): boolean {
  if (typeof value === 'function') return true
  if (value === null || typeof value !== 'object') return false
  if (Array.isArray(value)) return value.some((item) => containsCallable(item))
  return Object.values(value).some((item) => containsCallable(item))
}

// ---------------------------------------------------------------------------
// S1 — complete the handoff, then attempt every source-side query shape
// from the target's perspective
// ---------------------------------------------------------------------------
let s1: {
  readonly contextToken: string
  readonly historyReadError: unknown
  readonly searchError: unknown
  readonly unknownTokenError: unknown
  readonly emptyTokenError: unknown
  readonly badQueryError: unknown
  readonly deniedDetails: unknown
  readonly readCountBefore: number
  readonly readCountAfter: number
  readonly summarizeCount: number
  readonly creationCalls: number
  readonly isRemoteSafe: boolean
  readonly hasCallable: boolean
} | undefined

{
  const world = createP7T5World()
  const state = await world.service.startTeamFromHere({
    requestToken: 'tok-p7t5-tp',
    sourceSessionId: P7T5_FIXTURE.sourceSessionId,
  })
  if (state.kind !== 'completed') {
    throw new Error(`S1: expected a completed operation, got '${state.kind}'`)
  }
  const token = state.context.contextToken
  const readCountBefore = world.source.readCount

  // B cannot history_read(A) — always denied.
  let historyReadError: unknown
  try {
    await world.service.querySourceHistoryFromTarget(token, {
      mode: 'history-read',
      target: 'the full history of the source session',
    })
  } catch (e) {
    historyReadError = e
  }

  // B cannot search A — always denied.
  let searchError: unknown
  try {
    await world.service.querySourceHistoryFromTarget(token, {
      mode: 'search',
      target: 'baseline',
    })
  } catch (e) {
    searchError = e
  }

  // A context token that was never issued grants NOTHING either: the
  // rejection does not depend on the token.
  let unknownTokenError: unknown
  try {
    await world.service.querySourceHistoryFromTarget('handoff-ctx-never-issued', {
      mode: 'search',
      target: 'anything',
    })
  } catch (e) {
    unknownTokenError = e
  }

  // Negative controls: structurally invalid arguments.
  let emptyTokenError: unknown
  try {
    await world.service.querySourceHistoryFromTarget('', {
      mode: 'search',
      target: 'x',
    })
  } catch (e) {
    emptyTokenError = e
  }
  let badQueryError: unknown
  try {
    await world.service.querySourceHistoryFromTarget(token, {
      mode: 'search',
      target: 42,
    } as unknown as SourceHistoryQuery)
  } catch (e) {
    badQueryError = e
  }

  s1 = {
    contextToken: token,
    historyReadError,
    searchError,
    unknownTokenError,
    emptyTokenError,
    badQueryError,
    deniedDetails:
      historyReadError instanceof HandoffError ? (historyReadError.details as unknown) : undefined,
    readCountBefore,
    readCountAfter: world.source.readCount,
    summarizeCount: world.summarizer.summarizeCount,
    creationCalls: world.creation.callCount,
    isRemoteSafe: isRemoteSafeJsonValue(state.context),
    hasCallable: containsCallable(state.context),
  }
}

describe('p7t5 target-inspect', () => {
  it('S1: B cannot history_read(A) — the target-side history-read is ALWAYS denied (Architecture §34.3)', () => {
    if (s1 === undefined) throw new Error('S1 did not run')
    assertHandoffCode(s1.historyReadError, HANDOFF_ERROR_CODES.SOURCE_HISTORY_ACCESS_DENIED)
    expect(s1.deniedDetails).toEqual({
      contextToken: 'handoff-ctx-tok-p7t5-tp',
      mode: 'history-read',
    })
  })

  it('S1: B cannot search A — the target-side search is ALWAYS denied (Architecture §34.3)', () => {
    if (s1 === undefined) throw new Error('S1 did not run')
    assertHandoffCode(s1.searchError, HANDOFF_ERROR_CODES.SOURCE_HISTORY_ACCESS_DENIED)
  })

  it('S1: a never-issued context token grants NOTHING — the denial does not depend on the token', () => {
    if (s1 === undefined) throw new Error('S1 did not run')
    assertHandoffCode(s1.unknownTokenError, HANDOFF_ERROR_CODES.SOURCE_HISTORY_ACCESS_DENIED)
  })

  it('S1: structurally invalid arguments fail validation first with HANDOFF_REQUEST_MALFORMED', () => {
    if (s1 === undefined) throw new Error('S1 did not run')
    assertHandoffCode(s1.emptyTokenError, HANDOFF_ERROR_CODES.REQUEST_MALFORMED)
    assertHandoffCode(s1.badQueryError, HANDOFF_ERROR_CODES.REQUEST_MALFORMED)
  })

  it('S1: the guard never touches the source — the read/summarize/creation counters stay put', () => {
    if (s1 === undefined) throw new Error('S1 did not run')
    expect(s1.readCountBefore).toBe(1)
    expect(s1.readCountAfter).toBe(1)
    expect(s1.summarizeCount).toBe(1)
    expect(s1.creationCalls).toBe(1)
  })

  it('S1: the frozen context carries no read grant — it is pure data with no callable value anywhere', () => {
    if (s1 === undefined) throw new Error('S1 did not run')
    expect(s1.isRemoteSafe).toBe(true)
    expect(s1.hasCallable).toBe(false)
  })
})
