/**
 * archive-race-arms.test.mjs — the archive gate at the PRODUCT order, and the
 * dispatch that races it.
 *
 * What this file replaces. `row6-rejudge.test.mjs` modelled the archive as
 * "commit the durable ARCHIVED row, then drop residency, then dispatch" —
 * commit-before-drop. That is the SAFE order for the durable gate and the
 * WRONG order for the product: `archive.ts` runs `quiesceMember()` (whose
 * step 5 is `residency.dropResidency`) and only THEN `commitDurable(ARCHIVE)`
 * (archive.ts:116 → quiesce.ts:143 → archive.ts:134-143). A dispatch that
 * lands in that drop→commit window sees a durable `SETTLED` row, cold-resumes
 * legally, and the resulting live handle then SURVIVES the commit: afterwards
 * `ensureLiveAgent` returns it from `liveAgents` before the gate is ever
 * consulted. The reversed arm could not see that.
 *
 * The arms (all host-free, the REAL glue through the t12a bridge, the REAL
 * lifecycle service over the REAL archive procedure):
 *
 *   RO1  SEQUENTIAL, PRODUCT ORDER: archive to completion, then dispatch.
 *        Must be 422 / 0 tool executions / not resident. (This is the arm the
 *        old evidence already had — it stays green; it is NOT the boundary.)
 *
 *   RO2  RACE (the arm this fix exists for): a dispatch issued inside the
 *        drop→commit window. Must be 422 / 0 tool executions / not resident.
 *
 *   RO3  RESUME AFTER THE COMMIT: a dispatch that started BEFORE the archive
 *        began, whose cold resume resolves only after the durable ARCHIVED
 *        commit. The post-resume durable re-read (fix b) must dispose the just
 *        resumed handle and refuse. Must be 422 / 0 tool executions / not
 *        resident.
 *
 *   RO4  HANDLE SURVIVES THE COMMIT: a dispatch that started before the
 *        archive, whose cold resume completes inside the window (durable is
 *        still SETTLED, so the resume is legal), with the durable commit
 *        landing afterwards. The post-commit residency re-drop (fix a) must
 *        remove that handle; a later dispatch must be 422. This is the arm the
 *        per-member admission close cannot cover (the dispatch was admitted
 *        before the close), so it is the load-bearing arm for (a).
 *
 * Every arm measures through the same public seams the product uses:
 * `binding.executeTool` (what `/__p6t6/tool` calls) and
 * `createLifecycleService(...).archiveMember` (what the s6-remote lifecycle
 * route calls). No Host, no port, no network.
 */
import { describe, expect, it } from 'vitest'

import { createLiveWorld } from '../../../../packages/runtime/test/t12a-live-bridge.mjs'
import { createLifecycleService } from '../../../../packages/runtime/lifecycle/index.js'

const ROOT = 'session-race-root'
const CHILD = 'session-race-child'
const INSTANCE = 'inst-racemember'

/**
 * One controllable suspension point. `wait()` signals `reached` and blocks
 * until `release()`.
 * @returns {{reached: Promise<void>, release: () => void, wait: () => Promise<void>}}
 */
function makeBarrier() {
  let releaseFn = () => {}
  let reachedFn = () => {}
  const released = new Promise((resolve) => { releaseFn = resolve })
  const reached = new Promise((resolve) => { reachedFn = resolve })
  return {
    reached,
    release: () => releaseFn(),
    async wait() {
      reachedFn()
      await released
    },
  }
}

/** The durable member row the product would hold (SETTLED, no-live-work). */
function memberRow() {
  return {
    rootSessionId: ROOT,
    instanceId: INSTANCE,
    childSessionId: CHILD,
    templateId: 'tpl-t12a',
    label: 'race-member',
    lifecycle: 'SETTLED',
    activityVersion: 2,
    createdAt: '2026-11-05T00:00:00.000Z',
  }
}

/**
 * The live world + the REAL lifecycle service wired the way the production
 * root wires it: `residency` IS the glue's residency port, the commit port
 * writes the durable row (this process is the single writer), and the
 * admission port is the glue's per-member admission close.
 * @param {{resumeGate?: () => Promise<void>, commitBarrier?: ReturnType<typeof makeBarrier>}} [hooks]
 */
async function createRaceWorld(hooks = {}) {
  const row = memberRow()
  const world = await createLiveWorld({
    rootSessionId: ROOT,
    members: [row],
    persistence: { exists: () => true },
    ...(hooks.resumeGate === undefined ? {} : { agents: { resumeGate: () => hooks.resumeGate() } }),
  })
  // Count tool executions across EVERY handle the glue ever publishes: a cold
  // resume mints a fresh agent ctx, so a per-handle counter would miss the
  // resumed one (the pre-fix race runs the tool on exactly that handle).
  const handles = []
  const createAgent = world.agents.create.bind(world.agents)
  const resumeAgent = world.agents.resume.bind(world.agents)
  world.agents.create = async (request) => {
    const handle = await createAgent(request)
    handles.push(handle)
    return handle
  }
  world.agents.resume = async (request) => {
    const handle = await resumeAgent(request)
    handles.push(handle)
    return handle
  }
  const toolExecutions = () => handles.reduce((total, handle) => total + handle.agent.ctx.toolExecutions.length, 0)
  const ports = {
    teamDomain: {
      repositories: {
        memberInstances: {
          // The gate's read and the service's pre-read both go through here.
          list: () => [row],
          get: (root, instanceId) => (String(root) === ROOT && String(instanceId) === INSTANCE ? row : undefined),
        },
      },
    },
    commit: {
      async commitTransition(args) {
        // The durable commit of the REAL procedure: paused on demand so the
        // arm can dispatch inside the drop→commit window, then applied to the
        // same in-memory durable row the gate reads.
        if (hooks.commitBarrier !== undefined) await hooks.commitBarrier.wait()
        row.lifecycle = args.to
        row.activityVersion = args.expectedActivityVersion + 1
      },
    },
    admission: {
      async closeNewWork(target) {
        // The product wiring: the per-member admission close (the glue flag).
        // Absent on the pre-fix tree — then this is a no-op, exactly like the
        // production no-op at root.ts:2164.
        world.binding.closeAdmission?.(target)
      },
      async reopenNewWork(target) {
        world.binding.reopenAdmission?.(target)
      },
    },
    activity: { async interrupt() {} },
    descendants: { async drainDescendants() { return { drained: 0, quiescent: true } } },
    residency: world.binding.residency,
  }
  return {
    row,
    world,
    ports,
    service: createLifecycleService(ports),
    toolExecutions,
    target: { rootSessionId: ROOT, instanceId: INSTANCE },
  }
}

/** The exact `/__p6t6/tool` status/body mapping (packages/tools/harness/plugin.mjs:383-404). */
async function routeReply(binding, sessionId, request) {
  try {
    const outcome = await binding.executeTool(sessionId, request)
    if (outcome.isError === true) {
      return { status: 200, body: { ok: false } }
    }
    return { status: 200, body: { ok: true } }
  } catch (error) {
    if (error?.code === 'NO_LIVE_AGENT') return { status: 422, body: { error: error.message } }
    if (error?.code === 'CONSUMPTION_BOUNDARY') return { status: 500, body: { error: error.message } }
    return { status: 500, body: { error: String(error?.message ?? error) } }
  }
}

const PROBE = { name: 'grep', args: { pattern: 'A5SF_RACE_NEEDLE', path: '/tmp/lane/inside' }, callId: 'race-probe' }

describe('the archive boundary at the product order', () => {
  it('RO1 SEQUENTIAL (product order): archive completes, then dispatch -> 422, 0 executions, not resident', async () => {
    const { world, row, service, target, toolExecutions } = await createRaceWorld()
    try {
      // Live in SETTLED before the archive (the pre-archive state).
      await world.binding.ensureLiveAgent(CHILD)
      expect(world.binding.hasLive(CHILD)).toBe(true)
      const executionsBefore = toolExecutions()

      // THE REAL PROCEDURE: close → interrupt → drain → wait → release
      // residency → commit ARCHIVED (the product order, not the reverse).
      await service.archiveMember(target)
      expect(row.lifecycle).toBe('ARCHIVED')

      const reply = await routeReply(world.binding, CHILD, PROBE)
      expect(reply.status).toBe(422)
      expect(toolExecutions() - executionsBefore).toBe(0)
      expect(world.binding.hasLive(CHILD)).toBe(false)
    } finally {
      await world.binding.close().catch(() => undefined)
    }
  })

  it('RO2 RACE: a dispatch issued inside the drop->commit window -> 422, 0 executions, not resident', async () => {
    const commitBarrier = makeBarrier()
    const { world, row, service, target, toolExecutions } = await createRaceWorld({ commitBarrier })
    try {
      await world.binding.ensureLiveAgent(CHILD)
      expect(world.binding.hasLive(CHILD)).toBe(true)
      const executionsBefore = toolExecutions()
      const resumesBefore = world.agents.resumes.length

      const archive = service.archiveMember(target)
      // The window is OPEN here: quiesce is complete (residency dropped) and
      // the durable ARCHIVED commit has NOT landed yet.
      await commitBarrier.reached
      expect(world.binding.hasLive(CHILD)).toBe(false)
      expect(row.lifecycle).toBe('SETTLED')

      const reply = await routeReply(world.binding, CHILD, PROBE)

      commitBarrier.release()
      await archive
      expect(row.lifecycle).toBe('ARCHIVED')

      expect(reply.status).toBe(422)
      expect(toolExecutions() - executionsBefore).toBe(0)
      expect(world.agents.resumes.length - resumesBefore).toBe(0)
      expect(world.binding.hasLive(CHILD)).toBe(false)
    } finally {
      await world.binding.close().catch(() => undefined)
    }
  })

  it('RO3 RESUME AFTER THE COMMIT: an in-flight resume resolving after ARCHIVED -> 422, no handle', async () => {
    const resumeBarrier = makeBarrier()
    const { world, row, service, target, toolExecutions } = await createRaceWorld({
      resumeGate: () => resumeBarrier.wait(),
    })
    try {
      const executionsBefore = toolExecutions()
      // The dispatch starts BEFORE the archive, so the admission close cannot
      // see it: it is admitted, SEAM 1 reads SETTLED, and its cold resume is
      // suspended inside the agents double.
      const dispatch = routeReply(world.binding, CHILD, PROBE)
      await resumeBarrier.reached
      expect(world.agents.resumes).toHaveLength(1)

      // The whole REAL procedure runs to completion while the resume is in
      // flight (fix a's post-commit re-drop finds no handle: none exists yet).
      await service.archiveMember(target)
      expect(row.lifecycle).toBe('ARCHIVED')

      // The resume now resolves. The post-resume durable re-read (fix b) is
      // the only thing that can still refuse it.
      resumeBarrier.release()
      const reply = await dispatch

      expect(reply.status).toBe(422)
      expect(toolExecutions() - executionsBefore).toBe(0)
      expect(world.binding.hasLive(CHILD)).toBe(false)
    } finally {
      await world.binding.close().catch(() => undefined)
    }
  })

  it('RO4 HANDLE SURVIVES THE COMMIT: a resume completing inside the window is dropped AFTER the commit', async () => {
    const resumeBarrier = makeBarrier()
    const commitBarrier = makeBarrier()
    const { world, row, service, target, toolExecutions } = await createRaceWorld({
      resumeGate: () => resumeBarrier.wait(),
      commitBarrier,
    })
    try {
      // The dispatch is admitted BEFORE the archive (it passes the admission
      // check and SEAM 1 while the row is still SETTLED) and its resume is
      // suspended.
      const dispatch = routeReply(world.binding, CHILD, PROBE)
      await resumeBarrier.reached

      const archive = service.archiveMember(target)
      await commitBarrier.reached
      // The durable row is still SETTLED, so this resume is LEGAL: fix b
      // cannot refuse it (there is nothing to refuse yet).
      resumeBarrier.release()
      await new Promise((resolve) => setTimeout(resolve, 50))
      expect(world.binding.hasLive(CHILD)).toBe(true)

      // The commit lands. Fix a's post-commit re-drop is what removes the
      // handle the window let in.
      commitBarrier.release()
      await archive
      expect(row.lifecycle).toBe('ARCHIVED')
      expect(world.binding.hasLive(CHILD)).toBe(false)

      const executionsBefore = toolExecutions()
      const reply = await routeReply(world.binding, CHILD, PROBE)
      expect(reply.status).toBe(422)
      expect(toolExecutions() - executionsBefore).toBe(0)
      expect(world.binding.hasLive(CHILD)).toBe(false)
      // The racing dispatch itself may only complete as a refusal.
      expect((await dispatch).status).toBe(422)
    } finally {
      await world.binding.close().catch(() => undefined)
    }
  })
})
