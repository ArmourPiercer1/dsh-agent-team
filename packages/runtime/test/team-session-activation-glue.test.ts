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
