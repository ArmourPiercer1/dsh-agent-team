/**
 * team-session-activation-glue.test.ts — C1 (restart-recovery
 * 0.1.7-rc.1, guide §13.3): the live-glue × activation-fence integration
 * tests (G1–G6) + the guide §6.2 STATIC assertion (the bare agents.create /
 * agents.resume call sites are pinned at exactly one each — inside the
 * two ownership-guarded wrappers only).
 *
 * World shape: `createLiveWorld` WITH a real
 * `createTeamSessionActivationFence` — the bridge plays the host
 * stand-in (auto-wired fake `agent/created` → the AWAITED
 * `fence.beforeAgentCreated` veto, fake `agent/disposed` →
 * `fence.onAgentDisposed`), the fence's ownership resolver is the REAL
 * production algorithm (`resolveOwningTeamRoot` over the world's domain
 * double), and the glue receives the fence + the writer-handoff timeout
 * exactly like the production host wires them.
 *
 * Cases (guide §13.3, verbatim):
 *  - G1 ALL Team CREATEs are under the ownership guard (the fresh ROOT
 *    agent, a fresh member of the root, a boot-seed member) — an
 *    unguarded create of a Team-managed session would be intercepted by
 *    the fence's veto and reject the activation;
 *  - G2 ALL Team RESUME paths are under the ownership guard (the cold
 *    root agent, a cold member of the root, ensureLiveAgent, the dynamic
 *    root, the durable child factory) — same discriminator;
 *  - G3 the ownership guard's `finally` clears the guard even when the
 *    activation faults (a foreign activation of the same session is
 *    intercepted again AFTER the fault — the guard count is back at 0);
 *  - G4 the close race: a foreign rollback pending at close() —
 *    close() settles the barrier, the in-flight ensureLiveAgent REJECTS
 *    (its durable check fails after the barrier settles — "neither live
 *    nor durable"), NO new resume is started, and no late handle is
 *    installed;
 *  - G5 the recoverable writer-held race: the Team resume hits a
 *    writer-held rejection while an ordinary (foreign) activation of the
 *    SAME session is vetoed + disposed (the exact-generation rollback) —
 *    the fence confirms the rollback and the retry happens EXACTLY
 *    once (no while-loop, no sleep/backoff — guide §7.2);
 *  - G6 the unrecoverable writer-held: the fence's bounded
 *    confirmation window elapses with no foreign rollback — the ORIGINAL
 *    error propagates, no retry is started (resumes stay at 1).
 *
 * @module @dsh-agent-team/runtime/test/team-session-activation-glue
 */

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { createHash } from 'node:crypto'

import { describe, expect, it } from 'vitest'

import {
  createLiveWorld,
} from './t12a-live-bridge.mjs'
import {
  createTeamSessionActivationFence,
  TeamSessionActivationInterceptedError,
} from '../src/plugin/team-session-activation.js'
import type { TeamSessionActivationFence } from '../src/plugin/team-session-activation.js'
import { resolveOwningTeamRoot } from '../src/plugin/team-session-ownership.js'

/** The T12-B2 deterministic child session id (the glue's own formula). */
function childSidOf(rootSessionId: string, instanceId: string): string {
  const digest = createHash('sha256')
    .update(`${rootSessionId}\u0000${instanceId}`, 'utf8')
    .digest('hex')
  return `session-team-child-${digest.slice(0, 32)}`
}

/** A fake upstream session-layer writer-held rejection (guide §7.1: the
 *  typed name is the first marker — the message is the compatibility
 *  fallback only). */
function writerHeldError(sessionId: string): Error & { name: string } {
  return Object.assign(
    new Error(`session "${sessionId}" is already owned by an active write handle`),
    { name: 'SessionAlreadyOwnedError' },
  )
}

/** Await one promise, reporting whether it settled within the window. */
async function settles<T>(
  p: Promise<T>,
  windowMs = 1500,
): Promise<{ settled: boolean; value?: T; error?: unknown }> {
  return await new Promise((resolve) => {
    let done = false
    const timer = setTimeout(() => {
      if (!done) {
        done = true
        resolve({ settled: false })
      }
    }, windowMs)
    void p.then(
      (value) => {
        if (!done) {
          done = true
          clearTimeout(timer)
          resolve({ settled: true, value })
        }
      },
      (error: unknown) => {
        if (!done) {
          done = true
          clearTimeout(timer)
          resolve({ settled: true, error })
        }
      },
    )
  })
}

async function waitFor(cond: () => boolean, what: string, timeoutMs = 3000): Promise<void> {
  const deadline = Date.now() + timeoutMs
  while (!cond()) {
    if (Date.now() > deadline) {
      throw new Error(`G-test guard: timed out waiting for ${what}`)
    }
    await new Promise((resolve) => setTimeout(resolve, 1))
  }
}

/** Wrap the fence's veto point with a per-activation pass/reject record
 *  (the test's observability — the fence object is a plain record, the
 *  method reassignment is local to this world's fence instance). */
function recordVetoes(fence: TeamSessionActivationFence): Array<{
  sid: string
  passed: boolean
  error?: unknown
}> {
  const seen: Array<{ sid: string; passed: boolean; error?: unknown }> = []
  const original = fence.beforeAgentCreated.bind(fence)
  fence.beforeAgentCreated = (input) =>
    original(input).then(
      () => {
        seen.push({ sid: String(input.agent.id), passed: true })
      },
      (error: unknown) => {
        seen.push({ sid: String(input.agent.id), passed: false, error })
        throw error
      },
    )
  return seen
}

async function captureReject(fn: () => Promise<unknown>): Promise<unknown> {
  try {
    await fn()
  } catch (error) {
    return error
  }
  throw new Error('G-test guard: expected the call to reject')
}

const G = await (async () => {
  const state: Record<string, unknown> = {}

  // ── G1: every Team CREATE is under the ownership guard ──
  {
    const root = 'session-team-c1-g1-root'
    const seedInstance = 'inst-g1seed'
    const seedChild = childSidOf(root, seedInstance)
    const memberInstance = 'inst-g1member'
    const fence = createTeamSessionActivationFence()
    const world = await createLiveWorld({
      rootSessionId: root,
      activationFence: fence,
      // nothing durable — every activation in this world is a CREATE
      persistence: { exists: () => false },
      // the seed child is a durable member of the boot root (the fence's
      // real resolver classifies it as Team-managed — the guard is what
      // lets its created event through).
      members: [{ childSessionId: seedChild, instanceId: seedInstance, templateId: 'tpl-t12a' }],
      configOverrides: {
        seedMembers: [{ instanceId: seedInstance, childSessionId: seedChild, templateId: 'tpl-t12a' }],
      },
    })
    fence.bindOwnershipResolver((sid) => resolveOwningTeamRoot(world.domain, world.rootSessionId, sid))
    const seen = recordVetoes(fence)
    try {
      // the boot create phase: the fresh ROOT agent + the boot-seed
      // member (both Team-managed, both must pass under the guard).
      await world.binding.boot()
      // a FRESH member through the child factory (the third create leg).
      await world.binding.childFactory.createChildSession({
        instanceId: memberInstance,
        templateId: 'tpl-t12a',
        label: 'g1 member',
      })
      const memberChild = childSidOf(root, memberInstance)
      const allPassed = [root, seedChild, memberChild].every((sid) =>
        seen.some((s) => s.sid === sid && s.passed === true),
      )
      // NEGATIVE CONTROL: a foreign (unguarded) create of the live,
      // Team-managed root is INTERCEPTED — the discriminator proving the
      // fence vetoes unguarded activations of managed sessions.
      const foreign = await captureReject(() => world.agents.create({ sessionId: root }))
      const foreignIntercepted = foreign instanceof TeamSessionActivationInterceptedError
      state.g1 = {
        // 3 guarded Team creates + 1 RECORDED (but vetoed before any
        // handle exists) foreign create — the double records the request
        // before the veto point.
        createsCount: world.agents.creates.length,
        liveHandles: world.agents.handles.size,
        rootAndSeedsPassed: allPassed,
        noRejectionsSeen: seen.every((s) => s.passed === true || s.sid === root),
        interceptSeenForRoot: seen.some((s) => s.sid === root && s.passed === false),
        foreignIntercepted,
      }
    } finally {
      await world.binding.close().catch(() => undefined)
    }
  }

  // ── G2: every Team RESUME path is under the ownership guard ──
  {
    const leg = async <T>(run: (world: Awaited<ReturnType<typeof createLiveWorld>> & { activationFence?: TeamSessionActivationFence }) => Promise<T>, opts: Parameters<typeof createLiveWorld>[0]): Promise<T> => {
      const fence = createTeamSessionActivationFence()
      const world = await createLiveWorld({ ...opts, activationFence: fence })
      fence.bindOwnershipResolver((sid) => resolveOwningTeamRoot(world.domain, world.rootSessionId, sid))
      const seen = recordVetoes(fence)
      const result = await run(world)
      await world.binding.close().catch(() => undefined)
      return { ...result, seen }
    }

    // (a) the COLD root + a COLD member (bootPhase 'resume', both
    // durable — the boot's resume phase re-binds the domain's members).
    const g2aRoot = 'session-team-c1-g2a-root'
    const g2aInstance = 'inst-g2achild'
    const g2aChild = childSidOf(g2aRoot, g2aInstance)
    const g2a = await leg(
      async (world) => {
        await world.binding.boot()
        // NEGATIVE CONTROL: the foreign (unguarded) resume of the live,
        // managed root is intercepted.
        const foreign = await captureReject(() => world.agents.resume({ resumeSessionId: g2aRoot }))
        return {
          resumesCount: world.agents.resumes.length,
          foreignIntercepted: foreign instanceof TeamSessionActivationInterceptedError,
        }
      },
      {
        rootSessionId: g2aRoot,
        persistence: { exists: () => true },
        members: [{ childSessionId: g2aChild, instanceId: g2aInstance, templateId: 'tpl-t12a' }],
        configOverrides: { bootPhase: 'resume' },
      },
    )

    // (b) ensureLiveAgent on a non-booted world (the cold resume path).
    const g2bRoot = 'session-team-c1-g2b-root'
    const g2b = await leg(
      async (world) => {
        await world.binding.ensureLiveAgent(g2bRoot)
        return {
          resumesCount: world.agents.resumes.length,
          hasLive: world.binding.hasLive(g2bRoot),
        }
      },
      { rootSessionId: g2bRoot, persistence: { exists: () => true } },
    )

    // (c) the DYNAMIC root (createRootAgent on a durable root — the
    // domain carries its TeamSession row, the real resolver classifies
    // it as a team root of the domain).
    const g2cRoot = 'session-team-c1-g2c-root'
    const g2cDynroot = 'session-team-c1-g2c-dynroot'
    const g2c = await leg(
      async (world) => {
        await world.binding.createRootAgent(g2cDynroot)
        return {
          resumesCount: world.agents.resumes.length,
          hasLive: world.binding.hasLive(g2cDynroot),
        }
      },
      {
        rootSessionId: g2cRoot,
        persistence: { exists: () => true },
        teamSessions: [{ rootSessionId: g2cDynroot }],
      },
    )

    // (d) the DURABLE child factory (a child whose session artifact
    // exists — the factory's resume branch, guarded).
    const g2dRoot = 'session-team-c1-g2d-root'
    const g2dInstance = 'inst-g2dchild'
    const g2dChild = childSidOf(g2dRoot, g2dInstance)
    const g2d = await leg(
      async (world) => {
        const { childSessionId } = await world.binding.childFactory.createChildSession({
          instanceId: g2dInstance,
          templateId: 'tpl-t12a',
          label: 'g2d child',
        })
        return {
          childSessionId,
          resumesCount: world.agents.resumes.length,
          hasLive: world.binding.hasLive(g2dChild),
        }
      },
      {
        rootSessionId: g2dRoot,
        persistence: { exists: () => true },
        members: [{ childSessionId: g2dChild, instanceId: g2dInstance, templateId: 'tpl-t12a' }],
      },
    )

    state.g2a = g2a
    state.g2b = g2b
    state.g2c = g2c
    state.g2d = g2d
  }

  // ── G3: the guard's finally clears on fault ──
  {
    const root = 'session-team-c1-g3-root'
    const fault = new Error('the resume seam exploded (simulated)')
    const fence = createTeamSessionActivationFence()
    const world = await createLiveWorld({
      rootSessionId: root,
      activationFence: fence,
      persistence: { exists: () => true },
      agents: { resumeFaults: (sid) => (sid === root ? fault : undefined) },
    })
    fence.bindOwnershipResolver((sid) => resolveOwningTeamRoot(world.domain, world.rootSessionId, sid))
    try {
      const rejection = await captureReject(() => world.binding.ensureLiveAgent(root))
      // the ORIGINAL fault propagates (a writer-held shape would have
      // entered the recovery branch instead — this is a plain fault).
      const faultPropagated = rejection === fault
      // the guard is back at 0: a foreign activation of the same
      // session is intercepted again (a leaked guard would have let it
      // through).
      const foreign = await captureReject(() => world.agents.create({ sessionId: root }))
      state.g3 = {
        faultPropagated,
        foreignIntercepted: foreign instanceof TeamSessionActivationInterceptedError,
        resumesCount: world.agents.resumes.length,
      }
    } finally {
      await world.binding.close().catch(() => undefined)
    }
  }

  // ── G4: the close race (a foreign rollback pending at close) ──
  {
    const root = 'session-team-c1-g4-root'
    const fence = createTeamSessionActivationFence()
    const world = await createLiveWorld({
      rootSessionId: root,
      activationFence: fence,
      // NOT durable: after the barrier settles, the ensure path must
      // fail at the durable check (before any resume is started).
      persistence: { exists: () => false },
    })
    fence.bindOwnershipResolver((sid) => resolveOwningTeamRoot(world.domain, world.rootSessionId, sid))
    try {
      // (1) a FOREIGN (unguarded) resume of the managed root — the
      // fence vetoes it (the rollback record stays pending — the foreign
      // activation is never disposed in this simulation).
      const foreign = await captureReject(() => world.agents.resume({ resumeSessionId: root }))
      const foreignIntercepted = foreign instanceof TeamSessionActivationInterceptedError
      // (2) the in-flight ensureLiveAgent blocks on the rollback barrier.
      const p = world.binding.ensureLiveAgent(root)
      // (3) close — the barrier settles, the waiters terminate.
      fence.close()
      const settle = await settles(p)
      state.g4 = {
        foreignIntercepted,
        pSettled: settle.settled,
        pRejectedDurable:
          settle.error instanceof Error
            ? settle.error.message ===
              `p6t6: session '${root}' is neither live nor durable — no agent to execute a tool on`
            : false,
        resumesCount: world.agents.resumes.length,
        hasLive: world.binding.hasLive(root),
        // a fresh bounded wait after close settles immediately (no
        // dangling promise outlives the row).
        postCloseRecover: await fence.recoverWriterConflict(root),
      }
    } finally {
      await world.binding.close().catch(() => undefined)
    }
  }

  // ── G5: the recoverable writer-held race (EXACTLY one retry) ──
  {
    const root = 'session-team-c1-g5-root'
    const fence = createTeamSessionActivationFence()
    const world = await createLiveWorld({
      rootSessionId: root,
      activationFence: fence,
      persistence: { exists: () => true },
      // the bounded confirmation window (generous for the test's
      // driving; the fence's own default would also work).
      writerHandoffTimeoutMs: 2000,
      agents: {
        resumeFaults: (sid, call) => (sid === root && call === 0 ? writerHeldError(root) : undefined),
      },
    })
    fence.bindOwnershipResolver((sid) => resolveOwningTeamRoot(world.domain, world.rootSessionId, sid))
    try {
      // the Team resume (call 0) hits the writer-held rejection.
      const p = world.binding.ensureLiveAgent(root)
      // wait for the glue's resume#1 to be issued (the fault fired).
      await waitFor(() => world.agents.resumes.length >= 1, 'the glue resume#1 to be issued')
      // a FOREIGN (ordinary) activation of the SAME session — the fence
      // vetoes it (the rollback record appears).
      const foreign = await captureReject(() => world.agents.resume({ resumeSessionId: root }))
      const foreignIntercepted = foreign instanceof TeamSessionActivationInterceptedError
      // the upstream AgentLoop rollback (modeled): the EXACT vetoed
      // generation is disposed (the identity the created event carried —
      // the double's agentIdentities map is the last-write identity).
      const disposedIdentity = world.agents.agentIdentities.get(root)
      if (disposedIdentity === undefined) {
        throw new Error('G5 guard: the foreign resume minted no agent identity')
      }
      fence.onAgentDisposed(disposedIdentity)
      // the fence confirms the rollback → the retry (EXACTLY one).
      await p
      state.g5 = {
        foreignIntercepted,
        resumesCount: world.agents.resumes.length,
        hasLive: world.binding.hasLive(root),
      }
    } finally {
      await world.binding.close().catch(() => undefined)
    }
  }

  // ── G6: the unrecoverable writer-held (no retry) ──
  {
    const root = 'session-team-c1-g6-root'
    const fault = writerHeldError(root)
    const fence = createTeamSessionActivationFence()
    const world = await createLiveWorld({
      rootSessionId: root,
      activationFence: fence,
      persistence: { exists: () => true },
      // the bounded confirmation window is TINY: with no foreign
      // rollback appearing, the fence's bounded wait elapses → false.
      writerHandoffTimeoutMs: 50,
      agents: {
        resumeFaults: (sid) => (sid === root ? fault : undefined),
      },
    })
    fence.bindOwnershipResolver((sid) => resolveOwningTeamRoot(world.domain, world.rootSessionId, sid))
    try {
      const rejection = await captureReject(() => world.binding.ensureLiveAgent(root))
      state.g6 = {
        // the ORIGINAL error propagates (not a re-wrapped one).
        originalPropagated: rejection === fault,
        resumesCount: world.agents.resumes.length,
        hasLive: world.binding.hasLive(root),
      }
    } finally {
      await world.binding.close().catch(() => undefined)
    }
  }

  // ── G7: ensureLiveAgent ∥ ensureLiveAgent (same cold SID) — ONE
  // resume, ONE shared handle (S1, supplement INV-2 / guide §2.2-B) ──
  {
    const root = 'session-team-c1-g7-root'
    const fence = createTeamSessionActivationFence()
    let releaseGate: (() => void) | undefined
    const world = await createLiveWorld({
      rootSessionId: root,
      activationFence: fence,
      persistence: { exists: () => true },
      agents: {
        // gate the resume so BOTH callers are provably in flight on the
        // same cold SID before any of them settles.
        resumeGate: () =>
          new Promise<void>((resolve) => {
            releaseGate = resolve
          }),
      },
    })
    fence.bindOwnershipResolver((sid) => resolveOwningTeamRoot(world.domain, world.rootSessionId, sid))
    try {
      // caller A's synchronous prefix registers its promise in the
      // HIGH-level single-flight map before caller B's call runs — B
      // must JOIN A's promise, never re-enter the pre-resume flow.
      const pA = world.binding.ensureLiveAgent(root)
      const pB = world.binding.ensureLiveAgent(root)
      await waitFor(() => world.agents.resumes.length >= 1, 'G7 resume#1 to reach the gate')
      if (releaseGate === undefined) throw new Error('G7 guard: the resume gate never armed')
      releaseGate()
      const [hA, hB] = await Promise.all([pA, pB])
      state.g7 = {
        sameHandle: hA === hB,
        resumesCount: world.agents.resumes.length,
        hasLive: world.binding.hasLive(root),
      }
    } finally {
      await world.binding.close().catch(() => undefined)
    }
  }

  // ── G8: remote ensure ∥ work-delivery lazy ensure (same cold member) —
  // ONE resume, both paths succeed (S1, supplement guide §2.2-B/§2.2-E) ──
  {
    const root = 'session-team-c1-g8-root'
    const instance = 'inst-g8child'
    const child = childSidOf(root, instance)
    const fence = createTeamSessionActivationFence()
    let releaseGate: (() => void) | undefined
    const world = await createLiveWorld({
      rootSessionId: root,
      activationFence: fence,
      persistence: { exists: () => true },
      members: [{ childSessionId: child, instanceId: instance, templateId: 'tpl-t12a' }],
      agents: {
        // gate ONLY the member child's resume (the root's, if any,
        // passes — this world has no root resume).
        resumeGate: (req) =>
          String(req.resumeSessionId) === child
            ? new Promise<void>((resolve) => {
                releaseGate = resolve
              })
            : Promise.resolve(),
      },
    })
    fence.bindOwnershipResolver((sid) => resolveOwningTeamRoot(world.domain, world.rootSessionId, sid))
    try {
      // the remote-ensure path (the team.ensureRootLive port drives the
      // SAME live.ensureLiveAgent) ∥ the work-delivery lazy ensure (the
      // Leader's work delivered to the COLD member).
      const pEnsure = world.binding.ensureLiveAgent(child)
      const pDeliver = world.binding.workDelivery.deliver({
        childSessionId: child,
        prompt: 'g8 work',
        requestToken: 'g8-token',
      })
      await waitFor(() => world.agents.resumes.length >= 1, 'G8 the child resume to reach the gate')
      if (releaseGate === undefined) throw new Error('G8 guard: the resume gate never armed')
      releaseGate()
      const results = await Promise.allSettled([pEnsure, pDeliver])
      state.g8 = {
        bothFulfilled: results.every((r) => r.status === 'fulfilled'),
        resumesCount: world.agents.resumes.length,
        hasLive: world.binding.hasLive(child),
        followupsCount: world.agents.followups.length,
      }
    } finally {
      await world.binding.close().catch(() => undefined)
    }
  }

  // ── G9: Team activation IN FLIGHT ∥ foreign ordinary activation —
  // the foreign is VETOED (the temporal ownedDepth window is gone), the
  // Team's exact claimed generation PASSES (S1, supplement INV-3) ──
  {
    const root = 'session-team-c1-g9-root'
    const fence = createTeamSessionActivationFence()
    let gateArmed = false
    let releaseGate: (() => void) | undefined
    const world = await createLiveWorld({
      rootSessionId: root,
      activationFence: fence,
      persistence: { exists: () => true },
      agents: {
        // gate ONLY the Team resume (the first resume of the root); the
        // foreign resume sails through to its announce.
        resumeGate: (req) => {
          if (!gateArmed && String(req.resumeSessionId) === root) {
            gateArmed = true
            return new Promise<void>((resolve) => {
              releaseGate = resolve
            })
          }
          return Promise.resolve()
        },
      },
    })
    fence.bindOwnershipResolver((sid) => resolveOwningTeamRoot(world.domain, world.rootSessionId, sid))
    try {
      // (1) the Team activation starts: its resume is gated — IN FLIGHT
      // (the runOwned guard held, the setup/claim not yet run).
      const pTeam = world.binding.ensureLiveAgent(root)
      await waitFor(() => world.agents.resumes.length >= 1, 'G9 the team resume to reach the gate')
      // (2) the foreign (ordinary) activation of the SAME session
      // announces INSIDE the Team activation's in-flight window. The
      // pre-supplement temporal model (ownedDepth > 0 → pass) would have
      // let it steal the writer; the causal-claim model vetoes it.
      const foreignErr = await captureReject(() => world.agents.resume({ resumeSessionId: root }))
      // (3) the Team activation settles: its exact claimed generation
      // PASSES (the claim was minted under the still-held guard).
      if (releaseGate === undefined) throw new Error('G9 guard: the resume gate never armed')
      releaseGate()
      const handle = await pTeam
      state.g9 = {
        foreignIntercepted: foreignErr instanceof TeamSessionActivationInterceptedError,
        teamPassed: handle !== undefined && handle !== null,
        resumesCount: world.agents.resumes.length,
        hasLive: world.binding.hasLive(root),
      }
    } finally {
      await world.binding.close().catch(() => undefined)
    }
  }

  // ── G10: the completed-before-Team-catch TOCTOU (guide §4.2, exact
  // scripted timing):
  //     ordinary activation takes the writer → fence veto → dispose
  //     COMPLETES → the Team resume's writer-held rejection THEN enters
  //     its catch.
  // The baseline was snapshotted BEFORE the veto (0) — so what unlocks
  // the recovery is the TOMBSTONE (the record is already gone: the
  // pre-supplement delete-on-dispose model saw "no record →
  // unrecoverable" and propagated the error without retrying).
  // EXACTLY ONE retry must then succeed (S1, supplement INV-5) ──
  {
    const root = 'session-team-c1-g10-root'
    const fault = writerHeldError(root)
    const fence = createTeamSessionActivationFence()
    let teamGated = false
    let releaseGate: (() => void) | undefined
    let faultArmed = false
    let teamFaults = 0
    const world = await createLiveWorld({
      rootSessionId: root,
      activationFence: fence,
      persistence: { exists: () => true },
      agents: {
        // gate ONLY the Team resume (the one carrying the wrapped
        // agentSetup — the foreign raw resume has none): it suspends
        // AFTER the baseline snapshot, BEFORE its fault — the window the
        // foreign veto + completion runs through.
        resumeGate: (req) => {
          if (!teamGated && req.setup !== undefined) {
            teamGated = true
            return new Promise<void>((resolve) => {
              releaseGate = resolve
            })
          }
          return Promise.resolve()
        },
        // the scripted writer-held fault fires ONLY on the Team's first
        // resume and ONLY once the test arms it (call counting is
        // unreliable under the gate — the gate suspends before the
        // bridge's per-session call counter increments).
        resumeFaults: (sid) => {
          if (sid === root && faultArmed && teamFaults === 0) {
            teamFaults += 1
            return fault
          }
          return undefined
        },
      },
    })
    fence.bindOwnershipResolver((sid) => resolveOwningTeamRoot(world.domain, world.rootSessionId, sid))
    try {
      // (1) the Team's cold resume starts: the pre-resume barrier finds
      // no declared rollback, the epoch baseline snapshots 0, and the
      // resume suspends at the gate — its writer-held rejection has not
      // been minted yet.
      const pTeam = world.binding.ensureLiveAgent(root)
      await waitFor(() => releaseGate !== undefined, 'G10 the team resume to reach the gate')
      // (2) the ordinary (foreign) activation takes the writer: its
      // announce is VETOED by the fence (the rollback record, epoch 1)
      // and the exact foreign generation is disposed BEFORE the Team's
      // rejection can enter its catch (the scripted TOCTOU order).
      const foreignErr = await captureReject(() => world.agents.resume({ resumeSessionId: root }))
      const externalIdentity = world.agents.agentIdentities.get(root)
      if (externalIdentity === undefined) throw new Error('G10 guard: the foreign resume minted no agent identity')
      fence.onAgentDisposed(externalIdentity)
      if (fence.getRollbackEpoch(root) !== 1) throw new Error('G10 guard: the tombstone did not record epoch 1')
      // (3) the Team's resume then faults (the writer was held) and its
      // catch runs: the record is GONE — only the tombstone remains —
      // and `completedEpoch (1) > baseline (0)` confirms the handoff
      // IMMEDIATELY (the recovery never waited on a record that was
      // already deleted). EXACTLY ONE retry, which passes via the
      // Team's exact claim.
      faultArmed = true
      if (releaseGate === undefined) throw new Error('G10 guard: the resume gate never armed')
      releaseGate()
      const handle = await pTeam
      state.g10 = {
        foreignIntercepted: foreignErr instanceof TeamSessionActivationInterceptedError,
        resumed: handle !== undefined && handle !== null,
        resumesCount: world.agents.resumes.length,
        hasLive: world.binding.hasLive(root),
      }
    } finally {
      await world.binding.close().catch(() => undefined)
    }
  }

  return state
})()

describe('C1 (guide §13.3): the live glue under the activation fence', () => {
  it('G1 every Team CREATE is under the ownership guard (fresh root / fresh member / boot-seed member); a foreign create is intercepted', () => {
    const g1 = G.g1 as {
      createsCount: number
      liveHandles: number
      rootAndSeedsPassed: boolean
      noRejectionsSeen: boolean
      interceptSeenForRoot: boolean
      foreignIntercepted: boolean
    }
    expect(g1.createsCount).toBe(4) // 3 guarded Team creates + 1 recorded (vetoed) foreign create
    expect(g1.liveHandles).toBe(3) // only the guarded activations materialized a handle
    expect(g1.rootAndSeedsPassed).toBe(true)
    expect(g1.noRejectionsSeen).toBe(true)
    expect(g1.foreignIntercepted).toBe(true)
    expect(g1.interceptSeenForRoot).toBe(true)
  })

  it('G2(a) the COLD root + a COLD member boot through the guarded resume (a foreign resume is intercepted)', () => {
    const g2a = G.g2a as { resumesCount: number; foreignIntercepted: boolean; seen: Array<{ sid: string; passed: boolean }> }
    // 2 guarded glue resumes + 1 recorded (vetoed) foreign resume.
    expect(g2a.resumesCount).toBe(3)
    expect(g2a.seen.filter((s) => s.passed).length).toBe(2)
    expect(g2a.foreignIntercepted).toBe(true)
  })

  it('G2(b) ensureLiveAgent resumes through the guard (cold root, durable seam = true)', () => {
    const g2b = G.g2b as { resumesCount: number; hasLive: boolean; seen: Array<{ sid: string; passed: boolean }> }
    expect(g2b.resumesCount).toBe(1)
    expect(g2b.hasLive).toBe(true)
    expect(g2b.seen.filter((s) => s.passed).length).toBe(1)
  })

  it('G2(c) the dynamic root (createRootAgent) resumes through the guard (durable root of the domain)', () => {
    const g2c = G.g2c as { resumesCount: number; hasLive: boolean; seen: Array<{ sid: string; passed: boolean }> }
    expect(g2c.resumesCount).toBe(1)
    expect(g2c.hasLive).toBe(true)
    expect(g2c.seen.filter((s) => s.passed).length).toBe(1)
  })

  it('G2(d) the DURABLE child factory resumes through the guard', () => {
    const g2d = G.g2d as { childSessionId: string; resumesCount: number; hasLive: boolean; seen: Array<{ sid: string; passed: boolean }> }
    expect(g2d.childSessionId).toBe(childSidOf('session-team-c1-g2d-root', 'inst-g2dchild'))
    expect(g2d.resumesCount).toBe(1)
    expect(g2d.hasLive).toBe(true)
    expect(g2d.seen.filter((s) => s.passed).length).toBe(1)
  })

  it('G3 the guard finally clears on fault: the original fault propagates and a foreign activation is intercepted again', () => {
    const g3 = G.g3 as { faultPropagated: boolean; foreignIntercepted: boolean; resumesCount: number }
    expect(g3.faultPropagated).toBe(true)
    expect(g3.resumesCount).toBe(1)
    expect(g3.foreignIntercepted).toBe(true)
  })

  it('G4 the close race: the barrier settles at close, the in-flight ensure REJECTS (durable check fails), no new resume, no late handle', () => {
    const g4 = G.g4 as {
      foreignIntercepted: boolean
      pSettled: boolean
      pRejectedDurable: boolean
      resumesCount: number
      hasLive: boolean
      postCloseRecover: boolean
    }
    expect(g4.foreignIntercepted).toBe(true)
    expect(g4.pSettled).toBe(true)
    expect(g4.pRejectedDurable).toBe(true)
    expect(g4.resumesCount).toBe(1) // ONLY the foreign one — the ensure started no resume
    expect(g4.hasLive).toBe(false)
    expect(g4.postCloseRecover).toBe(false)
  })

  it('G5 the recoverable writer-held: the exact-generation rollback is confirmed and the retry happens EXACTLY once', () => {
    const g5 = G.g5 as { foreignIntercepted: boolean; resumesCount: number; hasLive: boolean }
    expect(g5.foreignIntercepted).toBe(true)
    // 2 glue resumes (resume#1 fault + the single retry) + 1 recorded
    // (vetoed) foreign resume — the glue itself resumed EXACTLY twice.
    expect(g5.resumesCount).toBe(3)
    expect(g5.hasLive).toBe(true)
  })

  it('G6 the unrecoverable writer-held: the bounded window elapses, the ORIGINAL error propagates, no retry', () => {
    const g6 = G.g6 as { originalPropagated: boolean; resumesCount: number; hasLive: boolean }
    expect(g6.originalPropagated).toBe(true)
    expect(g6.resumesCount).toBe(1)
    expect(g6.hasLive).toBe(false)
  })

  it('G7 ensureLiveAgent ∥ ensureLiveAgent (same cold SID): EXACTLY ONE resume, both callers get the SAME handle', () => {
    const g7 = G.g7 as { sameHandle: boolean; resumesCount: number; hasLive: boolean }
    expect(g7.resumesCount).toBe(1)
    expect(g7.sameHandle).toBe(true)
    expect(g7.hasLive).toBe(true)
  })

  it('G8 remote ensure ∥ work-delivery lazy ensure (same cold member): one resume, both paths succeed', () => {
    const g8 = G.g8 as { bothFulfilled: boolean; resumesCount: number; hasLive: boolean; followupsCount: number }
    expect(g8.resumesCount).toBe(1)
    expect(g8.bothFulfilled).toBe(true)
    expect(g8.hasLive).toBe(true)
    expect(g8.followupsCount).toBe(1)
  })

  it('G9 Team activation in flight ∥ foreign ordinary activation: the foreign is VETOED (the temporal window is gone), the Team PASSES', () => {
    const g9 = G.g9 as { foreignIntercepted: boolean; teamPassed: boolean; resumesCount: number; hasLive: boolean }
    // 1 Team resume + 1 recorded (vetoed) foreign resume.
    expect(g9.resumesCount).toBe(2)
    expect(g9.foreignIntercepted).toBe(true)
    expect(g9.teamPassed).toBe(true)
    expect(g9.hasLive).toBe(true)
  })

  it('G10 the completed-before-Team-catch TOCTOU: the tombstone (the record is gone) confirms the handoff and the retry happens EXACTLY once', () => {
    const g10 = G.g10 as { foreignIntercepted: boolean; resumed: boolean; resumesCount: number; hasLive: boolean }
    expect(g10.foreignIntercepted).toBe(true)
    // 1 foreign (vetoed) + 1 faulted Team resume + 1 retry.
    expect(g10.resumesCount).toBe(3)
    expect(g10.resumed).toBe(true)
    expect(g10.hasLive).toBe(true)
  })
})

describe('C1 (guide §6.2): the static assertion — the bare activation call sites', () => {
  const glueSource = readFileSync(
    fileURLToPath(new URL('../src/plugin/live/agent-bindings.mjs', import.meta.url).href),
    'utf8',
  )
  const createSites = (glueSource.match(/agents\.create\(\{/g) ?? []).length
  const resumeSites = (glueSource.match(/agents\.resume\(\{/g) ?? []).length
  const createWrapper = glueSource.indexOf('async function createTeamAgent')
  const resumeWrapper = glueSource.indexOf('async function resumeTeamAgent')

  it('exactly ONE agents.create call site — inside the createTeamAgent wrapper', () => {
    expect(createSites).toBe(1)
    expect(createWrapper).toBeGreaterThan(-1)
    expect(glueSource.indexOf('agents.create({') > createWrapper).toBe(true)
  })

  it('exactly ONE agents.resume call site — inside the resumeTeamAgent wrapper', () => {
    expect(resumeSites).toBe(1)
    expect(resumeWrapper).toBeGreaterThan(-1)
    expect(glueSource.indexOf('agents.resume({') > resumeWrapper).toBe(true)
  })

  it('nothing before the earlier wrapper carries a bare activation call site', () => {
    const firstWrapper = Math.min(createWrapper, resumeWrapper)
    expect(firstWrapper).toBeGreaterThan(-1)
    const preamble = glueSource.slice(0, firstWrapper)
    expect(preamble.includes('agents.create({')).toBe(false)
    expect(preamble.includes('agents.resume({')).toBe(false)
  })
})
