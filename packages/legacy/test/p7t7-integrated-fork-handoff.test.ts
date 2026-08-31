/**
 * p7t7-integrated-fork-handoff.test.ts — P7-T7 G7 criteria 6 + 7 + 8
 * (DevPlan §20.7), integrated over the REAL P7-T4 fork reconciler and
 * the REAL P7-T5 handoff service (TaskDoc §11.8 P7-T7: the
 * "fork/handoff/lifecycle/ACK integrated suite"):
 *
 * - criterion 6 (Root fork exact semantics): a fork of a team ROOT
 *   materializes a NEW TeamSession for the child (TeamSessionId = the
 *   child session id), bound to the SAME immutable Blueprint snapshot,
 *   with EMPTY MemberInstances, in exactly 2 durable writes in the
 *   crash-safe order (record before binding);
 * - criterion 7 (Member fork ordinary semantics): a fork of a MEMBER
 *   CHILD resolves as a plain member fork — no TeamSession record, no
 *   binding row, 0 durable writes, and the child is NOT adopted as a
 *   MemberInstance of the parent team;
 * - criterion 8 (handoff one-shot/no-live-link): start-team-from-here
 *   reads the source exactly ONCE and freezes one detached deep-frozen
 *   context; later source mutations never reach it; a same-token replay
 *   returns the SAME context object without re-reading; the staged
 *   TeamIntent carries the one-shot handoff provenance; and a fresh
 *   token starts a FRESH operation that sees the mutated live surface;
 * - in ALL THREE scenarios the legacy home inspected by the P7-T7
 *   reader is untouched (read-only isolation): identical inspection
 *   view before/after, byte-identical home, and a read-only port log.
 *
 * Top-level-await pattern (plain-node shim: `it()` bodies are
 * synchronous): each scenario runs at module top level, its
 * observables are captured into a plain snapshot, P7-T4 worlds are
 * destroyed in `finally` (the P7-T5 world is synchronous and needs no
 * teardown); the `it` bodies assert only over the captured data.
 *
 * @module @dsh-agent-team/legacy/test/p7t7-integrated-fork-handoff
 */

import { describe, expect, it } from 'vitest'
import { reconcileForkSidecar } from '../../runtime/fork-reconciliation/index.js'
import type { ForkReconciliationResult } from '../../runtime/fork-reconciliation/index.js'
import {
  P7T4_FIXTURE,
  assertOutcome,
  createForkWorld,
  destroyWorld,
  seedMemberChild,
  seedMemberInstance,
  seedTeamRoot,
} from '../../runtime/test/p7t4-helpers.js'
import type { P7T4World } from '../../runtime/test/p7t4-helpers.js'
import { P7T5_FIXTURE, createP7T5World } from '../../runtime/test/p7t5-helpers.js'
import { inspectLegacyTeam } from '../session-reader/index.js'
import {
  P7T7_REQUEST,
  buildP7T7LegacyHome,
  homeTreeSnapshot,
  isDeepFrozen,
  RecordingLegacyHomePort,
  viewJson,
} from './p7t7-helpers.js'

const ROOT = String(P7T4_FIXTURE.rootSessionId)
const CHILD = String(P7T4_FIXTURE.forkChildSessionId)
const MEMBER_CHILD = String(P7T4_FIXTURE.memberChildSessionId)
const INSTANCE_ID = String(P7T4_FIXTURE.instanceId)

/** One isolated legacy-home fixture (reader view + recording port). */
function makeLegacyHome() {
  const tree = buildP7T7LegacyHome()
  const port = new RecordingLegacyHomePort(tree)
  return {
    tree,
    port,
    viewBefore: inspectLegacyTeam(port, P7T7_REQUEST),
    homeBefore: homeTreeSnapshot(tree),
  }
}

/** One reconciler run: the result or the thrown error (never both). */
async function runReconcile(
  world: P7T4World,
  input: { parentSessionId: string; childSessionId: string },
): Promise<{ result: ForkReconciliationResult | undefined; error: unknown }> {
  const ports = { teamDomain: world.teamDomain, now: () => world.clock.now() }
  try {
    return { result: await reconcileForkSidecar(input, ports), error: undefined }
  } catch (error) {
    return { result: undefined, error }
  }
}

// ---------------------------------------------------------------------------
// S6 — criterion 6: root fork exact semantics (the full positive path)
// ---------------------------------------------------------------------------
const s6 = await (async () => {
  const home = makeLegacyHome()
  const world = await createForkWorld('p7t7-fork-s6')
  try {
    await seedTeamRoot(world, ROOT, P7T4_FIXTURE.blueprint, {
      defaultWorkspace: P7T4_FIXTURE.defaultWorkspace,
    })
    const base = world.seam.writeCount
    const run = await runReconcile(world, { parentSessionId: ROOT, childSessionId: CHILD })
    const viewAfter = inspectLegacyTeam(home.port, P7T7_REQUEST)
    home.port.assertOnlyReadOps()
    return {
      run,
      writeDelta: world.seam.writeCount - base,
      lastWriteTables: world.seam.writeLog.slice(-2).map((entry) => entry.table),
      repoRecord: world.repositories.teamSessions.get(CHILD),
      repoBinding: world.repositories.sessionBindings.get(CHILD),
      repoChildMembers: world.repositories.memberInstances.list(CHILD).length,
      viewIdentical: viewJson(viewAfter) === viewJson(home.viewBefore),
      homeIdentical: JSON.stringify(homeTreeSnapshot(home.tree)) === JSON.stringify(home.homeBefore),
      portReadsOnly: true,
    }
  } finally {
    await destroyWorld(world)
  }
})()

// ---------------------------------------------------------------------------
// S7 — criterion 7: member fork ordinary semantics (the positive path)
// ---------------------------------------------------------------------------
const s7 = await (async () => {
  const home = makeLegacyHome()
  const world = await createForkWorld('p7t7-fork-s7')
  try {
    await seedTeamRoot(world, ROOT, P7T4_FIXTURE.blueprint)
    await seedMemberChild(world, ROOT, MEMBER_CHILD, INSTANCE_ID)
    await seedMemberInstance(world, ROOT, MEMBER_CHILD, INSTANCE_ID)
    const base = world.seam.writeCount
    const run = await runReconcile(world, {
      parentSessionId: MEMBER_CHILD,
      childSessionId: CHILD,
    })
    const viewAfter = inspectLegacyTeam(home.port, P7T7_REQUEST)
    home.port.assertOnlyReadOps()
    return {
      run,
      writeDelta: world.seam.writeCount - base,
      childBinding: world.repositories.sessionBindings.get(CHILD),
      childTeamSession: world.repositories.teamSessions.get(CHILD),
      teamMembers: world.repositories.memberInstances.list(ROOT).length,
      viewIdentical: viewJson(viewAfter) === viewJson(home.viewBefore),
      homeIdentical: JSON.stringify(homeTreeSnapshot(home.tree)) === JSON.stringify(home.homeBefore),
      portReadsOnly: true,
    }
  } finally {
    await destroyWorld(world)
  }
})()

// ---------------------------------------------------------------------------
// S8 — criterion 8: handoff one-shot / no live link
// ---------------------------------------------------------------------------
const s8 = await (async () => {
  const home = makeLegacyHome()
  const world = createP7T5World()
  const state = await world.service.startTeamFromHere({
    requestToken: 'tok-p7t7-once',
    sourceSessionId: P7T5_FIXTURE.sourceSessionId,
  })
  if (state.kind !== 'completed') {
    throw new Error(`S8: expected a completed operation, got '${state.kind}'`)
  }
  // A plain deep copy of the frozen context, taken BEFORE any mutation.
  const preCopyJson = JSON.stringify(state.context)
  const surfaceMessagesJson = JSON.stringify(state.context.surface.messages)
  const surfaceTitle = state.context.surface.title
  const readCountAfterStart = world.source.readCount
  const summarizeCountAfterStart = world.summarizer.summarizeCount
  const creationCallsAfterStart = world.creation.callCount
  // The source keeps evolving AFTER the handoff is frozen.
  world.source.addMessage('user', 'post-handoff chatter')
  world.source.setTitle('retitled by source')
  const oracle = world.source.snapshotOracle()
  const contextJsonAfterMutation = JSON.stringify(state.context)
  // A same-token replay must return the SAME frozen context (replayed).
  const replay = await world.service.startTeamFromHere({
    requestToken: 'tok-p7t7-once',
    sourceSessionId: P7T5_FIXTURE.sourceSessionId,
  })
  const replayReplayed = replay.kind === 'completed' ? replay.replayed : false
  const replaySameContext = replay.kind === 'completed' ? replay.context === state.context : false
  const readCountAfterReplay = world.source.readCount
  // A FRESH operation (fresh token) starts after the mutations.
  const fresh = await world.service.startTeamFromHere({
    requestToken: 'tok-p7t7-fresh',
    sourceSessionId: P7T5_FIXTURE.sourceSessionId,
  })
  const freshCompleted = fresh.kind === 'completed'
  const intent = world.creation.intents[0]
  const viewAfter = inspectLegacyTeam(home.port, P7T7_REQUEST)
  home.port.assertOnlyReadOps()
  return {
    stateKind: state.kind,
    contextDeepFrozen: isDeepFrozen(state.context),
    preCopyJson,
    contextJsonAfterMutation,
    surfaceMessagesJson,
    surfaceTitle,
    readCountAfterStart,
    summarizeCountAfterStart,
    creationCallsAfterStart,
    oracleTitle: oracle.title,
    oracleMessageCount: oracle.messages.length,
    replayReplayed,
    replaySameContext,
    readCountAfterReplay,
    freshCompleted,
    freshSurfaceTitle: freshCompleted ? fresh.context.surface.title : undefined,
    freshSurfaceMessagesJson: freshCompleted ? JSON.stringify(fresh.context.surface.messages) : undefined,
    freshContextToken: freshCompleted ? fresh.context.contextToken : undefined,
    readCountAfterFresh: world.source.readCount,
    contextToken: state.context.contextToken,
    capturedAt: state.context.capturedAt,
    teamSessionId: state.team.teamSessionId,
    rootSessionId: state.team.rootSessionId,
    intentSourceSessionId: intent.handoff?.sourceSessionId,
    intentContextToken: intent.handoff?.contextToken,
    intentCapturedAt: intent.handoff?.capturedAt,
    viewIdentical: viewJson(viewAfter) === viewJson(home.viewBefore),
    homeIdentical: JSON.stringify(homeTreeSnapshot(home.tree)) === JSON.stringify(home.homeBefore),
    portReadsOnly: true,
  }
})()

// ===========================================================================
// Assertions
// ===========================================================================

describe('P7-T7 G7 criterion 6: Root fork exact semantics (integrated, P7-T4 real reconciler)', () => {
  it('resolves as a root fork: a NEW TeamSession for the child (invariant 9)', () => {
    expect(s6.run.error).toBe(undefined)
    const result = assertOutcome(s6.run.result, 'root-fork-reconciled')
    expect(result.parentRootSessionId).toBe(ROOT)
    expect(s6.repoRecord?.rootSessionId).toBe(CHILD)
    expect(s6.repoRecord?.generation).toBe(1)
  })

  it('binds the SAME immutable Blueprint snapshot and the inherited defaultWorkspace', () => {
    const result = assertOutcome(s6.run.result, 'root-fork-reconciled')
    expect(result.blueprintSnapshot).toEqual(P7T4_FIXTURE.blueprint)
    expect(s6.repoRecord?.blueprint).toEqual(P7T4_FIXTURE.blueprint)
    expect(result.childBinding.kind).toBe('team-root')
    expect(result.childBinding.sessionId).toBe(CHILD)
    expect(s6.repoBinding?.kind).toBe('team-root')
    expect(s6.repoBinding?.sessionId).toBe(CHILD)
    expect(s6.repoRecord?.defaultWorkspace).toBe(P7T4_FIXTURE.defaultWorkspace)
    expect(s6.repoRecord?.createdAt).toBe(P7T4_FIXTURE.forkCreatedAt)
  })

  it('leaves the child team EMPTY (no member copy) with exactly 2 crash-safe writes', () => {
    const result = assertOutcome(s6.run.result, 'root-fork-reconciled')
    expect(result.memberCount).toBe(0)
    expect(s6.repoChildMembers).toBe(0)
    expect(result.durableWrites).toBe(2)
    expect(s6.writeDelta).toBe(2)
    expect(s6.lastWriteTables).toEqual(['team_sessions', 'session_bindings'])
  })

  it('read-only isolation: the legacy home and the reader view are untouched', () => {
    expect(s6.viewIdentical).toBe(true)
    expect(s6.homeIdentical).toBe(true)
    expect(s6.portReadsOnly).toBe(true)
  })
})

describe('P7-T7 G7 criterion 7: Member fork ordinary semantics (integrated, P7-T4 real reconciler)', () => {
  it('resolves as a plain member fork: 0 durable writes', () => {
    expect(s7.run.error).toBe(undefined)
    const result = assertOutcome(s7.run.result, 'member-fork')
    expect(result.parentRootSessionId).toBe(ROOT)
    expect(result.durableWrites).toBe(0)
    expect(s7.writeDelta).toBe(0)
  })

  it('creates NOTHING for the child (no TeamSession record, no binding row)', () => {
    expect(s7.childTeamSession).toBe(undefined)
    expect(s7.childBinding).toBe(undefined)
  })

  it('does NOT adopt the child into the parent team (still exactly 1 member)', () => {
    expect(s7.teamMembers).toBe(1)
  })

  it('read-only isolation: the legacy home and the reader view are untouched', () => {
    expect(s7.viewIdentical).toBe(true)
    expect(s7.homeIdentical).toBe(true)
    expect(s7.portReadsOnly).toBe(true)
  })
})

describe('P7-T7 G7 criterion 8: handoff one-shot/no-live-link (integrated, P7-T5 real service)', () => {
  it('completes as a one-shot: the source is read exactly ONCE, one summary, one creation call', () => {
    expect(s8.stateKind).toBe('completed')
    expect(s8.readCountAfterStart).toBe(1)
    expect(s8.summarizeCountAfterStart).toBe(1)
    expect(s8.creationCallsAfterStart).toBe(1)
  })

  it('the frozen context is deep-frozen pure data', () => {
    expect(s8.contextDeepFrozen).toBe(true)
  })

  it('source mutations AFTER capture never reach the frozen context (no live link)', () => {
    expect(s8.contextJsonAfterMutation).toBe(s8.preCopyJson)
    expect(s8.oracleTitle).toBe('retitled by source')
    expect(s8.oracleMessageCount).toBe(3)
  })

  it('a same-token replay re-reads NOTHING and returns the SAME context object', () => {
    expect(s8.replayReplayed).toBe(true)
    expect(s8.replaySameContext).toBe(true)
    expect(s8.readCountAfterReplay).toBe(1)
  })

  it('the staged TeamIntent carries the one-shot handoff provenance; the team identity is the new root', () => {
    expect(s8.intentSourceSessionId).toBe(P7T5_FIXTURE.sourceSessionId)
    expect(s8.intentContextToken).toBe(s8.contextToken)
    expect(s8.intentCapturedAt).toBe(s8.capturedAt)
    expect(s8.teamSessionId).toBe(P7T5_FIXTURE.newRootSessionId)
    expect(s8.rootSessionId).toBe(P7T5_FIXTURE.newRootSessionId)
  })

  it('a fresh token starts a FRESH operation that sees the mutated live surface', () => {
    expect(s8.freshCompleted).toBe(true)
    expect(s8.readCountAfterFresh).toBe(2)
    expect(s8.freshContextToken).not.toBe(s8.contextToken)
    expect(s8.freshSurfaceTitle).toBe('retitled by source')
    expect(s8.freshSurfaceMessagesJson).not.toBe(s8.surfaceMessagesJson)
  })

  it('read-only isolation: the legacy home and the reader view are untouched', () => {
    expect(s8.viewIdentical).toBe(true)
    expect(s8.homeIdentical).toBe(true)
    expect(s8.portReadsOnly).toBe(true)
  })
})
