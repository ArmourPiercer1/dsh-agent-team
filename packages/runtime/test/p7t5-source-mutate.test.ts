/**
 * P7-T5 mandatory test 2 — "source mutate" (TaskDoc §11.8 P7-T5;
 * Architecture §34.3: "changes in A do not mutate B handoff"): after the
 * one-shot handoff is materialized, the source session keeps evolving —
 * new messages, a new title, new metadata — and NONE of those changes
 * may reach the frozen handoff context. The snapshot is a DETACHED deep
 * lossless-JSON copy: the live backing surface of the (mock-first)
 * source port visibly diverges from the frozen context, which proves
 * the context is a copy, not a live reference.
 *
 * Positive control: a FRESH operation (fresh token) started after the
 * mutations sees the mutated surface — the snapshot is taken from the
 * live surface at capture time; only the ALREADY-FROZEN context is
 * immune to later changes.
 *
 * Mock-first (ruling R28): the source surface fake returns its backing
 * object BY REFERENCE on read, so a service that failed to detach would
 * leak the mutations into the context and these tests would fail.
 *
 * Top-level-await pattern (plain-node shim: `it()` bodies are
 * synchronous): the scenario runs at module top level; the `it` bodies
 * assert only over the captured data.
 *
 * @module @dsh-agent-team/runtime/test/p7t5-source-mutate
 */

import { describe, expect, it } from 'vitest'
import { P7T5_FIXTURE, createP7T5World } from './p7t5-helpers.js'

// ---------------------------------------------------------------------------
// S1 — complete the handoff, capture a plain deep copy of the frozen
// context BEFORE the mutations, then mutate the live source; a replay
// and a fresh operation bracket the frozen state
// ---------------------------------------------------------------------------
let s1: {
  /** The frozen context (deep-frozen) exactly as the completed op returned it. */
  readonly context: unknown
  /** A plain deep copy of the context taken before any mutation. */
  readonly preCopy: unknown
  /** The live backing surface after the mutations (the fake's oracle). */
  readonly oracleAfterMutation: unknown
  readonly readCount: number
  readonly summarizeCount: number
  readonly creationCalls: number
  readonly replayKind: string
  readonly replayReplayed: boolean
  readonly replaySameContext: boolean
  readonly postReplayReadCount: number
  readonly freshKind: string
  readonly freshReadCount: number
  readonly freshSurfaceMessages: string[]
  readonly freshSurfaceTitle: string | null
  readonly freshSurfaceMetadata: unknown
} | undefined

{
  const world = createP7T5World()
  const state = await world.service.startTeamFromHere({
    requestToken: 'tok-p7t5-mut',
    sourceSessionId: P7T5_FIXTURE.sourceSessionId,
  })
  if (state.kind !== 'completed') {
    throw new Error(`S1: expected a completed operation, got '${state.kind}'`)
  }
  // Plain deep copy of the frozen context, taken BEFORE the mutations.
  const preCopy = JSON.parse(JSON.stringify(state.context)) as unknown

  // --- the source mutates after the handoff (changes in A) ---
  world.source.addMessage('user', 'follow-up after handoff')
  world.source.setTitle('Mutated title')
  world.source.setMetadata({ note: 'changed after handoff' })

  // A same-token replay must return the SAME frozen context (replayed).
  const replay = await world.service.startTeamFromHere({
    requestToken: 'tok-p7t5-mut',
    sourceSessionId: P7T5_FIXTURE.sourceSessionId,
  })
  const replaySameContext =
    replay.kind === 'completed' ? replay.context === state.context : false
  const readsAfterReplay = world.source.readCount

  // Positive control: a fresh token snapshots the MUTATED surface.
  const fresh = await world.service.startTeamFromHere({
    requestToken: 'tok-p7t5-mut2',
    sourceSessionId: P7T5_FIXTURE.sourceSessionId,
  })
  if (fresh.kind !== 'completed') {
    throw new Error(`S1: fresh operation expected to complete, got '${fresh.kind}'`)
  }

  s1 = {
    context: state.context,
    preCopy,
    oracleAfterMutation: world.source.snapshotOracle(),
    readCount: world.source.readCount,
    summarizeCount: world.summarizer.summarizeCount,
    creationCalls: world.creation.callCount,
    replayKind: replay.kind,
    replayReplayed: replay.replayed,
    replaySameContext,
    postReplayReadCount: readsAfterReplay,
    freshKind: fresh.kind,
    freshReadCount: world.source.readCount,
    freshSurfaceMessages: fresh.context.surface.messages.map((m) => m.role + ': ' + m.text),
    freshSurfaceTitle: fresh.context.surface.title,
    freshSurfaceMetadata: JSON.parse(JSON.stringify(fresh.context.surface.metadata)) as unknown,
  }
}

describe('p7t5 source-mutate', () => {
  it('S1: changes in the source do NOT mutate the frozen handoff context (Architecture §34.3)', () => {
    if (s1 === undefined) throw new Error('S1 did not run')
    // The frozen context is byte-identical to the pre-mutation deep copy.
    expect(s1.context).toEqual(s1.preCopy)
  })

  it('S1: the frozen context is a DETACHED copy — the live source visibly diverges from it', () => {
    if (s1 === undefined) throw new Error('S1 did not run')
    // The live backing surface now carries the mutation...
    const oracle = s1.oracleAfterMutation as {
      title: string | null
      messages: { role: string; text: string }[]
      metadata: { [key: string]: unknown }
    }
    expect(oracle.title).toBe('Mutated title')
    expect(oracle.messages.length).toBe(3)
    expect(oracle.metadata).toEqual({ note: 'changed after handoff' })
    // ...and therefore differs from the frozen context.
    expect(s1.oracleAfterMutation).not.toEqual(s1.context)
    // And the replay re-read nothing.
    expect(s1.replayKind).toBe('completed')
    expect(s1.replayReplayed).toBe(true)
    expect(s1.replaySameContext).toBe(true)
    expect(s1.postReplayReadCount).toBe(1)
  })

  it('S1: the original handoff still reads exactly once in total (snapshot once survives the mutations)', () => {
    if (s1 === undefined) throw new Error('S1 did not run')
    expect(s1.readCount).toBe(2)
    expect(s1.summarizeCount).toBe(2)
    expect(s1.creationCalls).toBe(2)
  })

  it('S1 (positive control): a fresh operation started after the mutations snapshots the MUTATED surface', () => {
    if (s1 === undefined) throw new Error('S1 did not run')
    expect(s1.freshKind).toBe('completed')
    expect(s1.freshReadCount).toBe(2)
    expect(s1.freshSurfaceMessages).toEqual([
      'user: build the baseline',
      'assistant: baseline committed',
      'user: follow-up after handoff',
    ])
    expect(s1.freshSurfaceTitle).toBe('Mutated title')
    expect(s1.freshSurfaceMetadata).toEqual({ note: 'changed after handoff' })
  })
})
