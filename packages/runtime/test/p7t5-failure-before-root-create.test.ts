/**
 * P7-T5 mandatory test 4 — "failure before root create" (TaskDoc §11.8
 * P7-T5; DevPlan §20.5; Architecture §34.4): every failure BEFORE the
 * delegated team creation entry is called leaves ZERO creation effects
 * and is surfaced EXPLICITLY — never silently pretended as a successful
 * handoff:
 *
 * - a failed one-shot summarization (thrown OR a non lossless-JSON
 *   summary) is carried on the observable `awaiting-decision` state with
 *   the verbatim §34.4 triad [retry, continue-without-handoff, cancel];
 * - `retry` re-summarizes the FROZEN snapshot (the source is NOT
 *   re-read) and creates the team only on success;
 * - `continue-without-handoff` creates the team WITHOUT the handoff
 *   provenance (the staged TeamIntent carries no `handoff` field,
 *   Architecture §7.2);
 * - `cancel` abandons the operation; a decision is ONE-SHOT
 *   (`HANDOFF_OPERATION_ALREADY_FINALIZED` afterwards);
 * - a failed team creation (AFTER the context was frozen) is carried on
 *   the explicit `creation-failed` state; a re-invocation retries the
 *   creation idempotently (same stable intentToken, Architecture §18.2)
 *   without re-reading the source; a decision against it is
 *   `HANDOFF_OPERATION_NOT_DECIDABLE`;
 * - a failed source read throws `HANDOFF_SOURCE_SURFACE_UNAVAILABLE`
 *   with zero summary/creation effects and leaves no operation trace;
 * - structurally malformed requests throw `HANDOFF_REQUEST_MALFORMED`
 *   with ZERO port calls.
 *
 * Mock-first (ruling R28); top-level-await pattern (plain-node shim):
 * the scenarios run at module top level; the `it` bodies assert only
 * over the captured data.
 *
 * @module @dsh-agent-team/runtime/test/p7t5-failure-before-root-create
 */

import { describe, expect, it } from 'vitest'
import {
  HANDOFF_DECISION_OPTIONS,
  HANDOFF_ERROR_CODES,
  createHandoffService,
} from '../handoff/index.js'
import type {
  HandoffDecisionOption,
  HandoffSummary,
  HandoffSummarizerPort,
  StartTeamFromHereRequest,
} from '../handoff/index.js'
import {
  DEFAULT_CLOCK,
  FakeSourceSurface,
  FakeTeamCreation,
  P7T5_FIXTURE,
  assertHandoffCode,
  createP7T5World,
  expectedContextToken,
  expectedIntentToken,
} from './p7t5-helpers.js'

// ---------------------------------------------------------------------------
// S1 — summarizer failure → explicit awaiting-decision (NO creation);
// invalid decision option rejected; unknown operation rejected; retry
// after recovery completes from the FROZEN snapshot (no re-read)
// ---------------------------------------------------------------------------
let s1: {
  readonly awaitingKind: string
  readonly failureCode: string | undefined
  readonly options: string[] | undefined
  readonly creationCallsAfterFailure: number
  readonly readCountAfterFailure: number
  readonly summarizeCountAfterFailure: number
  readonly badDecisionError: unknown
  readonly unknownOpError: unknown
  readonly retriedKind: string
  readonly retriedReplayed: boolean
  readonly postRetryReads: number
  readonly postRetrySummaries: number
  readonly postRetryCreations: number
  readonly retriedIntentHandoff:
    | { readonly sourceSessionId: string; readonly contextToken: string; readonly capturedAt: string }
    | undefined
} | undefined

{
  const world = createP7T5World()
  world.summarizer.failNext = true
  const ref = {
    sourceSessionId: P7T5_FIXTURE.sourceSessionId,
    requestToken: 'tok-p7t5-fail',
  }
  const state = await world.service.startTeamFromHere({ ...ref })
  const awaiting = state.kind === 'awaiting-decision' ? state : undefined
  // Counters at the moment the failure was carried (NO team created).
  const readsAfterFailure = world.source.readCount
  const summariesAfterFailure = world.summarizer.summarizeCount
  const creationsAfterFailure = world.creation.callCount

  // §34.4: the failure is explicit; NO team was created.
  let badDecisionError: unknown
  try {
    await world.service.resolveHandoffDecision(ref, 'explode' as unknown as HandoffDecisionOption)
  } catch (e) {
    badDecisionError = e
  }
  let unknownOpError: unknown
  try {
    await world.service.resolveHandoffDecision(
      { sourceSessionId: P7T5_FIXTURE.sourceSessionId, requestToken: 'tok-p7t5-never-started' },
      HANDOFF_DECISION_OPTIONS.RETRY,
    )
  } catch (e) {
    unknownOpError = e
  }

  // Recovery: the retry re-summarizes the FROZEN snapshot (no re-read).
  const retried = await world.service.resolveHandoffDecision(ref, HANDOFF_DECISION_OPTIONS.RETRY)
  const retriedIntent = world.creation.intents[0]

  s1 = {
    awaitingKind: state.kind,
    failureCode: awaiting?.failure.code,
    options: awaiting?.options.map((o) => o),
    creationCallsAfterFailure: creationsAfterFailure,
    readCountAfterFailure: readsAfterFailure,
    summarizeCountAfterFailure: summariesAfterFailure,
    badDecisionError,
    unknownOpError,
    retriedKind: retried.kind,
    retriedReplayed: retried.replayed,
    postRetryReads: world.source.readCount,
    postRetrySummaries: world.summarizer.summarizeCount,
    postRetryCreations: world.creation.callCount,
    retriedIntentHandoff:
      retriedIntent?.handoff === undefined
        ? undefined
        : {
            sourceSessionId: retriedIntent.handoff.sourceSessionId,
            contextToken: retriedIntent.handoff.contextToken,
            capturedAt: retriedIntent.handoff.capturedAt,
          },
  }
}

// ---------------------------------------------------------------------------
// S2 — the explicit "continue without handoff" decision creates the team
// WITHOUT the handoff provenance
// ---------------------------------------------------------------------------
let s2: {
  readonly kind: string
  readonly team: { readonly teamSessionId: string; readonly rootSessionId: string }
  readonly creationCalls: number
  readonly readCount: number
  readonly intentTokens: string[]
  readonly intentHandoffPresent: boolean
} | undefined

{
  const world = createP7T5World()
  world.summarizer.failNext = true
  const ref = {
    sourceSessionId: P7T5_FIXTURE.sourceSessionId,
    requestToken: 'tok-p7t5-cwoh',
  }
  const state = await world.service.startTeamFromHere({ ...ref })
  if (state.kind !== 'awaiting-decision') {
    throw new Error(`S2: expected awaiting-decision, got '${state.kind}'`)
  }
  const cont = await world.service.resolveHandoffDecision(
    ref,
    HANDOFF_DECISION_OPTIONS.CONTINUE_WITHOUT_HANDOFF,
  )
  const intent = world.creation.intents[0]
  s2 = {
    kind: cont.kind,
    team:
      cont.kind === 'completed-without-handoff'
        ? {
            teamSessionId: cont.team.teamSessionId,
            rootSessionId: cont.team.rootSessionId,
          }
        : { teamSessionId: '', rootSessionId: '' },
    creationCalls: world.creation.callCount,
    readCount: world.source.readCount,
    intentTokens: world.creation.intents.map((i) => i.intentToken),
    intentHandoffPresent: intent?.handoff !== undefined,
  }
}

// ---------------------------------------------------------------------------
// S3 — the explicit "cancel" decision: no team, and the decision is
// one-shot
// ---------------------------------------------------------------------------
let s3: {
  readonly kind: string
  readonly creationCalls: number
  readonly readCount: number
  readonly secondDecisionError: unknown
  readonly replayKind: string
  readonly replayReplayed: boolean
  readonly postReplayCreations: number
} | undefined

{
  const world = createP7T5World()
  world.summarizer.failNext = true
  const ref = {
    sourceSessionId: P7T5_FIXTURE.sourceSessionId,
    requestToken: 'tok-p7t5-cancel',
  }
  await world.service.startTeamFromHere({ ...ref })
  const canceled = await world.service.resolveHandoffDecision(ref, HANDOFF_DECISION_OPTIONS.CANCEL)
  let secondDecisionError: unknown
  try {
    await world.service.resolveHandoffDecision(ref, HANDOFF_DECISION_OPTIONS.RETRY)
  } catch (e) {
    secondDecisionError = e
  }
  // The canceled operation replays as stored (replayed: true).
  const replay = await world.service.startTeamFromHere({ ...ref })
  s3 = {
    kind: canceled.kind,
    creationCalls: world.creation.callCount,
    readCount: world.source.readCount,
    secondDecisionError,
    replayKind: replay.kind,
    replayReplayed: replay.replayed,
    postReplayCreations: world.creation.callCount,
  }
}

// ---------------------------------------------------------------------------
// S4 — team creation failure AFTER the context was frozen: explicit
// `creation-failed`; re-invocation retries idempotently (same stable
// intentToken) without re-reading the source
// ---------------------------------------------------------------------------
let s4: {
  readonly kind: string
  readonly failureCode: string | undefined
  readonly contextFrozen: boolean
  readonly creationCalls: number
  readonly readCount: number
  readonly notDecidableError: unknown
  readonly retriedKind: string
  readonly postRetryCreations: number
  readonly postRetryReads: number
  readonly intentTokens: string[]
  readonly retriedSameContext: boolean
} | undefined

{
  const world = createP7T5World()
  world.creation.failNext = true
  const ref = {
    sourceSessionId: P7T5_FIXTURE.sourceSessionId,
    requestToken: 'tok-p7t5-cfail',
  }
  const state = await world.service.startTeamFromHere({ ...ref })
  const failed = state.kind === 'creation-failed' ? state : undefined
  // Counters at the moment the creation failure was carried.
  const creationsAfterFailure = world.creation.callCount
  const readsAfterFailure = world.source.readCount
  let notDecidableError: unknown
  try {
    await world.service.resolveHandoffDecision(ref, HANDOFF_DECISION_OPTIONS.RETRY)
  } catch (e) {
    notDecidableError = e
  }
  // Re-invocation: the creation is retried idempotently (the injected
  // failure was one-shot, so the retry now succeeds).
  const retried = await world.service.startTeamFromHere({ ...ref })
  s4 = {
    kind: state.kind,
    failureCode: failed?.failure.code,
    contextFrozen: failed?.context === undefined ? false : Object.isFrozen(failed.context),
    creationCalls: creationsAfterFailure,
    readCount: readsAfterFailure,
    notDecidableError,
    retriedKind: retried.kind,
    postRetryCreations: world.creation.callCount,
    postRetryReads: world.source.readCount,
    intentTokens: world.creation.intents.map((i) => i.intentToken),
    retriedSameContext:
      failed?.context !== undefined && retried.kind === 'completed'
        ? retried.context === failed.context
        : false,
  }
}

// ---------------------------------------------------------------------------
// S5 — a summarizer that RETURNS a non lossless-JSON summary fails the
// same way as one that throws (the context must stay pure data)
// ---------------------------------------------------------------------------
let s5: {
  readonly kind: string
  readonly failureCode: string | undefined
  readonly creationCalls: number
  readonly readCount: number
} | undefined

{
  const badSummarizer: HandoffSummarizerPort = {
    summarize: async (): Promise<HandoffSummary> => ({
      title: 'looks fine',
      bullets: ['value', (() => undefined) as unknown as string],
    }),
  }
  const source = new FakeSourceSurface()
  const creation = new FakeTeamCreation()
  const worldService = createHandoffService({
    sourceSurface: source,
    summarizer: badSummarizer,
    teamCreation: creation,
    clock: () => DEFAULT_CLOCK,
  })
  const state = await worldService.startTeamFromHere({
    requestToken: 'tok-p7t5-live',
    sourceSessionId: P7T5_FIXTURE.sourceSessionId,
  })
  const awaiting = state.kind === 'awaiting-decision' ? state : undefined
  s5 = {
    kind: state.kind,
    failureCode: awaiting?.failure.code,
    creationCalls: creation.callCount,
    readCount: source.readCount,
  }
}

// ---------------------------------------------------------------------------
// S6 — a failed source read throws with ZERO summary/creation effects
// and leaves NO operation trace (same token = fresh operation)
// ---------------------------------------------------------------------------
let s6: {
  readonly error: unknown
  readonly readCount: number
  readonly summarizeCount: number
  readonly creationCalls: number
  readonly retryKind: string
  readonly retryReads: number
} | undefined

{
  const world = createP7T5World()
  world.source.failNextRead = true
  let error: unknown
  try {
    await world.service.startTeamFromHere({
      requestToken: 'tok-p7t5-noread',
      sourceSessionId: P7T5_FIXTURE.sourceSessionId,
    })
  } catch (e) {
    error = e
  }
  const beforeRetry = {
    reads: world.source.readCount,
    summaries: world.summarizer.summarizeCount,
    creations: world.creation.callCount,
  }
  const retry = await world.service.startTeamFromHere({
    requestToken: 'tok-p7t5-noread',
    sourceSessionId: P7T5_FIXTURE.sourceSessionId,
  })
  s6 = {
    error,
    readCount: beforeRetry.reads,
    summarizeCount: beforeRetry.summaries,
    creationCalls: beforeRetry.creations,
    retryKind: retry.kind,
    retryReads: world.source.readCount,
  }
}

// ---------------------------------------------------------------------------
// S7 — structurally malformed requests: HANDOFF_REQUEST_MALFORMED with
// ZERO port calls
// ---------------------------------------------------------------------------
let s7: {
  readonly errors: unknown[]
  readonly readCount: number
  readonly summarizeCount: number
  readonly creationCalls: number
} | undefined

{
  const world = createP7T5World()
  const attempts: readonly StartTeamFromHereRequest[] = [
    {
      requestToken: 'tok-p7t5-mal1',
      sourceSessionId: 'bad id with a space',
    } as unknown as StartTeamFromHereRequest,
    {
      requestToken: '',
      sourceSessionId: P7T5_FIXTURE.sourceSessionId,
    } as unknown as StartTeamFromHereRequest,
    {
      requestToken: 'a'.repeat(256),
      sourceSessionId: P7T5_FIXTURE.sourceSessionId,
    } as unknown as StartTeamFromHereRequest,
    {
      requestToken: 'tok\u0000control',
      sourceSessionId: P7T5_FIXTURE.sourceSessionId,
    } as unknown as StartTeamFromHereRequest,
    {
      requestToken: 'tok-p7t5-mal2',
      sourceSessionId: P7T5_FIXTURE.sourceSessionId,
      staged: { fn: () => undefined },
    } as unknown as StartTeamFromHereRequest,
    {
      requestToken: 'tok-p7t5-mal3',
      sourceSessionId: P7T5_FIXTURE.sourceSessionId,
      staged: [1, 2],
    } as unknown as StartTeamFromHereRequest,
    {
      requestToken: undefined,
      sourceSessionId: P7T5_FIXTURE.sourceSessionId,
    } as unknown as StartTeamFromHereRequest,
    {
      requestToken: 'tok-p7t5-mal4',
      sourceSessionId: undefined,
    } as unknown as StartTeamFromHereRequest,
  ]
  const errors: unknown[] = []
  for (const attempt of attempts) {
    try {
      await world.service.startTeamFromHere(attempt)
      errors.push(undefined) // a malformed request must never resolve
    } catch (e) {
      errors.push(e)
    }
  }
  s7 = {
    errors,
    readCount: world.source.readCount,
    summarizeCount: world.summarizer.summarizeCount,
    creationCalls: world.creation.callCount,
  }
}

describe('p7t5 failure-before-root-create', () => {
  it('S1: a failed summarization is carried EXPLICITLY as awaiting-decision with the §34.4 triad — and NO team is created', () => {
    if (s1 === undefined) throw new Error('S1 did not run')
    expect(s1.awaitingKind).toBe('awaiting-decision')
    expect(s1.failureCode).toBe(HANDOFF_ERROR_CODES.SUMMARIZATION_FAILED)
    expect(s1.options).toEqual(['retry', 'continue-without-handoff', 'cancel'])
    expect(s1.creationCallsAfterFailure).toBe(0)
    expect(s1.readCountAfterFailure).toBe(1)
    expect(s1.summarizeCountAfterFailure).toBe(1)
  })

  it('S1: an invalid decision option is HANDOFF_REQUEST_MALFORMED; an unknown operation is HANDOFF_OPERATION_UNKNOWN', () => {
    if (s1 === undefined) throw new Error('S1 did not run')
    assertHandoffCode(s1.badDecisionError, HANDOFF_ERROR_CODES.REQUEST_MALFORMED)
    assertHandoffCode(s1.unknownOpError, HANDOFF_ERROR_CODES.OPERATION_UNKNOWN)
  })

  it('S1: the retry re-summarizes the FROZEN snapshot (the source is NOT re-read) and completes the handoff', () => {
    if (s1 === undefined) throw new Error('S1 did not run')
    expect(s1.retriedKind).toBe('completed')
    expect(s1.retriedReplayed).toBe(false)
    expect(s1.postRetryReads).toBe(1)
    expect(s1.postRetrySummaries).toBe(2)
    expect(s1.postRetryCreations).toBe(1)
    expect(s1.retriedIntentHandoff).toEqual({
      sourceSessionId: P7T5_FIXTURE.sourceSessionId,
      contextToken: expectedContextToken(P7T5_FIXTURE.sourceSessionId, 'tok-p7t5-fail'),
      capturedAt: DEFAULT_CLOCK,
    })
  })

  it('S2: "continue without handoff" completes as completed-without-handoff with NO handoff provenance on the staged TeamIntent', () => {
    if (s2 === undefined) throw new Error('S2 did not run')
    expect(s2.kind).toBe('completed-without-handoff')
    expect(s2.team).toEqual({
      teamSessionId: P7T5_FIXTURE.newRootSessionId,
      rootSessionId: P7T5_FIXTURE.newRootSessionId,
    })
    expect(s2.creationCalls).toBe(1)
    expect(s2.readCount).toBe(1)
    expect(s2.intentTokens).toEqual([expectedIntentToken(P7T5_FIXTURE.sourceSessionId, 'tok-p7t5-cwoh')])
    expect(s2.intentHandoffPresent).toBe(false)
  })

  it('S3: "cancel" abandons the operation with NO team; the decision is one-shot', () => {
    if (s3 === undefined) throw new Error('S3 did not run')
    expect(s3.kind).toBe('canceled')
    expect(s3.creationCalls).toBe(0)
    expect(s3.readCount).toBe(1)
    assertHandoffCode(s3.secondDecisionError, HANDOFF_ERROR_CODES.OPERATION_ALREADY_FINALIZED)
    expect(s3.replayKind).toBe('canceled')
    expect(s3.replayReplayed).toBe(true)
    expect(s3.postReplayCreations).toBe(0)
  })

  it('S4: a failed team creation is carried EXPLICITLY as creation-failed (the frozen context stays)', () => {
    if (s4 === undefined) throw new Error('S4 did not run')
    expect(s4.kind).toBe('creation-failed')
    expect(s4.failureCode).toBe(HANDOFF_ERROR_CODES.TEAM_CREATION_FAILED)
    expect(s4.contextFrozen).toBe(true)
    expect(s4.creationCalls).toBe(1)
    expect(s4.readCount).toBe(1)
  })

  it('S4: a decision against creation-failed is HANDOFF_OPERATION_NOT_DECIDABLE; the re-invocation retries idempotently (same stable intentToken) without re-reading the source', () => {
    if (s4 === undefined) throw new Error('S4 did not run')
    assertHandoffCode(s4.notDecidableError, HANDOFF_ERROR_CODES.OPERATION_NOT_DECIDABLE)
    expect(s4.retriedKind).toBe('completed')
    expect(s4.postRetryCreations).toBe(2)
    expect(s4.postRetryReads).toBe(1)
    expect(s4.intentTokens).toEqual([
      expectedIntentToken(P7T5_FIXTURE.sourceSessionId, 'tok-p7t5-cfail'),
      expectedIntentToken(P7T5_FIXTURE.sourceSessionId, 'tok-p7t5-cfail'),
    ])
    expect(s4.retriedSameContext).toBe(true)
  })

  it('S5: a non lossless-JSON summary is a summarization failure too — awaiting-decision, NO team created', () => {
    if (s5 === undefined) throw new Error('S5 did not run')
    expect(s5.kind).toBe('awaiting-decision')
    expect(s5.failureCode).toBe(HANDOFF_ERROR_CODES.SUMMARIZATION_FAILED)
    expect(s5.creationCalls).toBe(0)
    expect(s5.readCount).toBe(1)
  })

  it('S6: a failed source read throws HANDOFF_SOURCE_SURFACE_UNAVAILABLE with ZERO summary/creation effects', () => {
    if (s6 === undefined) throw new Error('S6 did not run')
    assertHandoffCode(s6.error, HANDOFF_ERROR_CODES.SOURCE_SURFACE_UNAVAILABLE)
    expect(s6.readCount).toBe(1)
    expect(s6.summarizeCount).toBe(0)
    expect(s6.creationCalls).toBe(0)
  })

  it('S6: the failed source read leaves NO operation trace — the same token is a fresh operation', () => {
    if (s6 === undefined) throw new Error('S6 did not run')
    expect(s6.retryKind).toBe('completed')
    expect(s6.retryReads).toBe(2)
  })

  it('S7: every structurally malformed request is HANDOFF_REQUEST_MALFORMED with ZERO port calls', () => {
    if (s7 === undefined) throw new Error('S7 did not run')
    expect(s7.errors.length).toBe(8)
    for (const e of s7.errors) {
      assertHandoffCode(e, HANDOFF_ERROR_CODES.REQUEST_MALFORMED)
    }
    expect(s7.readCount).toBe(0)
    expect(s7.summarizeCount).toBe(0)
    expect(s7.creationCalls).toBe(0)
  })
})
