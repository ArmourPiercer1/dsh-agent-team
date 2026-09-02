/**
 * P7-T5 mandatory test 1 — "snapshot once" (TaskDoc §11.8 P7-T5;
 * DevPlan §20.5; Architecture §34.2): the source canonical surface is
 * read EXACTLY ONCE per operation; the frozen handoff context is a
 * DETACHED, deep-frozen, pure lossless-JSON snapshot (no live handles,
 * no functions); the staged TeamIntent carries the one-shot handoff
 * provenance (Architecture §7.2); a same-token replay is idempotent and
 * re-reads NOTHING; a non lossless-JSON surface fails with
 * `HANDOFF_SOURCE_SURFACE_UNAVAILABLE` BEFORE any summary or team
 * creation and leaves no operation trace (a later same-token call is a
 * fresh operation).
 *
 * Mock-first (ruling R28): the source surface / summarizer / team
 * creation ports are fakes; the handoff service is REAL. The fakes'
 * call counters are the "snapshot once" evidence channel.
 *
 * Top-level-await pattern (plain-node shim: `it()` bodies are
 * synchronous): every scenario runs at module top level, its
 * observables are captured into a plain snapshot; the `it` bodies
 * assert only over the captured data.
 *
 * @module @dsh-agent-team/runtime/test/p7t5-snapshot-once
 */

import { describe, expect, it } from 'vitest'
import { isRemoteSafeJsonValue } from '../../contracts/src/index.js'
import type { RemoteSafeRecord } from '../../contracts/src/index.js'
import { HANDOFF_ERROR_CODES } from '../handoff/index.js'
import type { HandoffOperationState } from '../handoff/index.js'
import {
  DEFAULT_CLOCK,
  FakeSourceSurface,
  FakeSummarizer,
  FakeTeamCreation,
  P7T5_FIXTURE,
  assertHandoffCode,
  createP7T5World,
  expectedContextToken,
  expectedIntentToken,
  makeSurface,
} from './p7t5-helpers.js'

// ---------------------------------------------------------------------------
// S1 — happy path: one read, one summary, one delegated creation; the
// frozen context is a detached deep-frozen pure-data snapshot; replay is
// idempotent; a fresh token is a fresh operation
// ---------------------------------------------------------------------------
let s1: {
  readonly kind: string
  readonly replayed: boolean
  readonly readCount: number
  readonly summarizeCount: number
  readonly creationCalls: number
  readonly contextToken: string
  readonly capturedAt: string
  readonly summaryTitle: string
  readonly bullets: string[]
  readonly surfaceSessionId: string
  readonly surfaceMessages: string[]
  readonly surfaceTitle: string | null
  readonly contextFrozen: boolean
  readonly surfaceFrozen: boolean
  readonly messagesFrozen: boolean
  readonly firstMessageFrozen: boolean
  readonly summaryFrozen: boolean
  readonly summaryMutationThrew: boolean
  readonly surfaceMutationThrew: boolean
  readonly isRemoteSafe: boolean
  readonly intentToken: string | undefined
  readonly intentStagedJson: string
  readonly intentHandoff:
    | {
        readonly sourceSessionId: string
        readonly contextToken: string
        readonly capturedAt: string
      }
    | undefined
  readonly team: { readonly teamSessionId: string; readonly rootSessionId: string }
  readonly replayKind: string
  readonly replayReplayed: boolean
  readonly replaySameContext: boolean
  readonly postReplayReads: number
  readonly postReplaySummaries: number
  readonly postReplayCreations: number
  readonly freshKind: string
  readonly freshReads: number
  readonly freshSummaries: number
  readonly freshCreations: number
  readonly freshContextToken: string | undefined
} | undefined

{
  const world = createP7T5World()
  const state = await world.service.startTeamFromHere({
    requestToken: 'tok-p7t5-once',
    sourceSessionId: P7T5_FIXTURE.sourceSessionId,
  })
  if (state.kind !== 'completed') {
    throw new Error(`S1: expected a completed operation, got '${state.kind}'`)
  }
  const context = state.context
  const intent = world.creation.intents[0]
  // Counters at the moment the fresh operation completed (snapshot once).
  const readsAfterFirst = world.source.readCount
  const summariesAfterFirst = world.summarizer.summarizeCount
  const creationsAfterFirst = world.creation.callCount

  // Deep-freeze proof: assigning into the frozen snapshot must throw.
  let summaryMutationThrew = false
  try {
    ;(context.summary as { title: string }).title = 'hacked'
  } catch {
    summaryMutationThrew = true
  }
  let surfaceMutationThrew = false
  try {
    ;(context.surface.messages as { role: string; text: string }[]).push({
      role: 'user',
      text: 'hacked',
    })
  } catch {
    surfaceMutationThrew = true
  }

  // Same-token replay: idempotent, re-reads nothing.
  const replay = await world.service.startTeamFromHere({
    requestToken: 'tok-p7t5-once',
    sourceSessionId: P7T5_FIXTURE.sourceSessionId,
  })
  const replaySameContext =
    replay.kind === 'completed' ? replay.context === context : false
  const postReplayReads = world.source.readCount
  const postReplaySummaries = world.summarizer.summarizeCount
  const postReplayCreations = world.creation.callCount

  // A fresh token is a fresh operation (reads again, creates again).
  const fresh = await world.service.startTeamFromHere({
    requestToken: 'tok-p7t5-fresh',
    sourceSessionId: P7T5_FIXTURE.sourceSessionId,
  })

  s1 = {
    kind: state.kind,
    replayed: state.replayed,
    readCount: readsAfterFirst,
    summarizeCount: summariesAfterFirst,
    creationCalls: creationsAfterFirst,
    contextToken: context.contextToken,
    capturedAt: context.capturedAt,
    summaryTitle: context.summary.title,
    bullets: context.summary.bullets.map((b) => b),
    surfaceSessionId: context.surface.sessionId,
    surfaceMessages: context.surface.messages.map((m) => m.role + ': ' + m.text),
    surfaceTitle: context.surface.title,
    contextFrozen: Object.isFrozen(context),
    surfaceFrozen: Object.isFrozen(context.surface),
    messagesFrozen: Object.isFrozen(context.surface.messages),
    firstMessageFrozen:
      context.surface.messages.length > 0
        ? Object.isFrozen(context.surface.messages[0])
        : false,
    summaryFrozen: Object.isFrozen(context.summary),
    summaryMutationThrew,
    surfaceMutationThrew,
    isRemoteSafe: isRemoteSafeJsonValue(context),
    intentToken: intent?.intentToken,
    intentStagedJson: JSON.stringify(intent?.staged),
    intentHandoff:
      intent?.handoff === undefined
        ? undefined
        : {
            sourceSessionId: intent.handoff.sourceSessionId,
            contextToken: intent.handoff.contextToken,
            capturedAt: intent.handoff.capturedAt,
          },
    team: {
      teamSessionId: state.team.teamSessionId,
      rootSessionId: state.team.rootSessionId,
    },
    replayKind: replay.kind,
    replayReplayed: replay.replayed,
    replaySameContext,
    postReplayReads,
    postReplaySummaries,
    postReplayCreations,
    freshKind: fresh.kind,
    freshReads: world.source.readCount,
    freshSummaries: world.summarizer.summarizeCount,
    freshCreations: world.creation.callCount,
    freshContextToken: fresh.kind === 'completed' ? fresh.context.contextToken : undefined,
  }
}

// ---------------------------------------------------------------------------
// S2 — non lossless-JSON surface: fails BEFORE summary and creation,
// leaves NO operation trace (the same token is a fresh operation later)
// ---------------------------------------------------------------------------
let s2: {
  readonly error: unknown
  readonly state: HandoffOperationState | undefined
  readonly readCount: number
  readonly summarizeCount: number
  readonly creationCalls: number
  readonly retryKind: string
  readonly retryReads: number
  readonly retrySummaries: number
  readonly retryCreations: number
} | undefined

{
  // The backing surface carries a live function → NOT lossless JSON.
  const raw = makeSurface()
  raw.metadata = {
    handle: () => undefined,
  } as unknown as RemoteSafeRecord
  const world = createP7T5World(
    new FakeSourceSurface(raw),
    new FakeSummarizer(),
    new FakeTeamCreation(),
  )
  let error: unknown
  let state: HandoffOperationState | undefined
  try {
    state = await world.service.startTeamFromHere({
      requestToken: 'tok-p7t5-badjson',
      sourceSessionId: P7T5_FIXTURE.sourceSessionId,
    })
  } catch (e) {
    error = e
  }
  // Counters at the moment the failed fresh operation threw.
  const readsAfterFailure = world.source.readCount
  const summariesAfterFailure = world.summarizer.summarizeCount
  const creationsAfterFailure = world.creation.callCount
  // Repair the live surface in place; the SAME token must now be a FRESH
  // operation (the failed read left no trace in the registry).
  raw.metadata = {}
  const retry = await world.service.startTeamFromHere({
    requestToken: 'tok-p7t5-badjson',
    sourceSessionId: P7T5_FIXTURE.sourceSessionId,
  })
  s2 = {
    error,
    state,
    readCount: readsAfterFailure,
    summarizeCount: summariesAfterFailure,
    creationCalls: creationsAfterFailure,
    retryKind: retry.kind,
    retryReads: world.source.readCount,
    retrySummaries: world.summarizer.summarizeCount,
    retryCreations: world.creation.callCount,
  }
}

describe('p7t5 snapshot-once', () => {
  it('S1: the happy path reads the source exactly once, summarizes once, and delegates one creation', () => {
    if (s1 === undefined) throw new Error('S1 did not run')
    expect(s1.kind).toBe('completed')
    expect(s1.replayed).toBe(false)
    expect(s1.readCount).toBe(1)
    expect(s1.summarizeCount).toBe(1)
    expect(s1.creationCalls).toBe(1)
  })

  it('S1: the frozen context is a detached, deep-frozen, pure lossless-JSON snapshot', () => {
    if (s1 === undefined) throw new Error('S1 did not run')
    expect(s1.contextFrozen).toBe(true)
    expect(s1.surfaceFrozen).toBe(true)
    expect(s1.messagesFrozen).toBe(true)
    expect(s1.firstMessageFrozen).toBe(true)
    expect(s1.summaryFrozen).toBe(true)
    expect(s1.summaryMutationThrew).toBe(true)
    expect(s1.surfaceMutationThrew).toBe(true)
    // Pure data: the whole context is a lossless-JSON value — no
    // functions, no live handles (the target gains no read grant,
    // Architecture §34.3).
    expect(s1.isRemoteSafe).toBe(true)
    expect(s1.contextToken).toBe(expectedContextToken(P7T5_FIXTURE.sourceSessionId, 'tok-p7t5-once'))
    expect(s1.capturedAt).toBe(DEFAULT_CLOCK)
    expect(s1.summaryTitle).toBe(`handoff:${P7T5_FIXTURE.sourceSessionId}`)
    expect(s1.bullets).toEqual(['user: build the baseline', 'assistant: baseline committed'])
    expect(s1.surfaceSessionId).toBe(P7T5_FIXTURE.sourceSessionId)
    expect(s1.surfaceMessages).toEqual(['user: build the baseline', 'assistant: baseline committed'])
    expect(s1.surfaceTitle).toBe('Baseline task')
  })

  it('S1: the staged TeamIntent carries the one-shot handoff provenance (Architecture §7.2)', () => {
    if (s1 === undefined) throw new Error('S1 did not run')
    expect(s1.intentToken).toBe(expectedIntentToken(P7T5_FIXTURE.sourceSessionId, 'tok-p7t5-once'))
    expect(s1.intentStagedJson).toBe('{}')
    expect(s1.intentHandoff).toEqual({
      sourceSessionId: P7T5_FIXTURE.sourceSessionId,
      contextToken: expectedContextToken(P7T5_FIXTURE.sourceSessionId, 'tok-p7t5-once'),
      capturedAt: DEFAULT_CLOCK,
    })
    // Invariant 9: TeamSessionId = RootSessionId.
    expect(s1.team).toEqual({
      teamSessionId: P7T5_FIXTURE.newRootSessionId,
      rootSessionId: P7T5_FIXTURE.newRootSessionId,
    })
  })

  it('S1: a same-token replay is idempotent, returns the SAME frozen context, and re-reads nothing', () => {
    if (s1 === undefined) throw new Error('S1 did not run')
    expect(s1.replayKind).toBe('completed')
    expect(s1.replayReplayed).toBe(true)
    expect(s1.replaySameContext).toBe(true)
    expect(s1.postReplayReads).toBe(1)
    expect(s1.postReplaySummaries).toBe(1)
    expect(s1.postReplayCreations).toBe(1)
  })

  it('S1: a fresh token is a fresh operation (reads once more, creates once more)', () => {
    if (s1 === undefined) throw new Error('S1 did not run')
    expect(s1.freshKind).toBe('completed')
    expect(s1.freshReads).toBe(2)
    expect(s1.freshSummaries).toBe(2)
    expect(s1.freshCreations).toBe(2)
    expect(s1.freshContextToken).toBe(expectedContextToken(P7T5_FIXTURE.sourceSessionId, 'tok-p7t5-fresh'))
  })

  it('S2: a non lossless-JSON surface fails with HANDOFF_SOURCE_SURFACE_UNAVAILABLE before summary and creation', () => {
    if (s2 === undefined) throw new Error('S2 did not run')
    assertHandoffCode(s2.error, HANDOFF_ERROR_CODES.SOURCE_SURFACE_UNAVAILABLE)
    expect(s2.state).toBe(undefined)
    expect(s2.readCount).toBe(1)
    expect(s2.summarizeCount).toBe(0)
    expect(s2.creationCalls).toBe(0)
  })

  it('S2: the failed surface read leaves NO operation trace — the same token is a fresh operation', () => {
    if (s2 === undefined) throw new Error('S2 did not run')
    expect(s2.retryKind).toBe('completed')
    expect(s2.retryReads).toBe(2)
    expect(s2.retrySummaries).toBe(1)
    expect(s2.retryCreations).toBe(1)
  })
})
