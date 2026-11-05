/**
 * boot-seam-arms.test.mjs — the BOOT RESUME loop against a concurrent archive.
 *
 * The residual this file measures. `agent-bindings.mjs` `boot()` (resume
 * phase) reads the durable member rows ONCE, refuses the already-ARCHIVED
 * ones through `memberResumeRefusal` (SEAM 2), then for every remaining row
 * awaits `resumeTeamAgent` and `liveAgents.set`s the handle with NO
 * post-resume re-read. An archive whose durable commit lands WHILE that
 * resume is in flight therefore leaves a resident handle for a member that is
 * by then ARCHIVED. `ensureLiveAgent` returns a resident handle from
 * `liveAgents` before consulting any gate, so a subsequent tool dispatch is
 * served (200) on a resurrected Member.
 *
 * The arms (all host-free: the REAL glue through the t12a bridge, the REAL
 * lifecycle service over the REAL archive procedure — no Host, no port):
 *
 *   BS1  BOOT RACE (the residual, verbatim): the member's boot resume is in
 *        flight; the REAL archive procedure runs to completion (quiesce →
 *        residency release → durable ARCHIVED commit → post-commit re-drop);
 *        then the resume resolves. After boot returns the Member must NOT be
 *        resident and a tool dispatch must be 422 / NO_LIVE_AGENT with zero
 *        tool executions and no guard consult (no agent exists to consult
 *        one — measured as zero executions + zero fs ops on any handle).
 *
 *   BS2  BOOT INTERLEAVE (the in-memory half): the archive is held between
 *        its quiesce (admission closed, residency released) and its durable
 *        commit; the boot resume resolves INSIDE that window (durable is
 *        still SETTLED, so no durable read can refuse it). Boot must not
 *        publish a handle for a member whose quiesce has released residency
 *        — the in-memory admission close is the only authority that can see
 *        this, and it costs no durable read.
 *
 *   BS3  THE PRESERVED PROPERTY: the durable `list()` budget of a boot. One
 *        enumeration for the whole member set + at most ONE post-loop sweep,
 *        independent of member count. Measured with one and with two
 *        resolvable members; the two counts must be EQUAL (a per-member
 *        re-read would make the count grow) and equal the stated number.
 *
 * BS1 and BS2 are the RED arms on the pre-fix tree; BS3 is the property arm
 * (it fails on the pre-fix tree only in its stated number: 1, not 2).
 */
import { describe, expect, it } from 'vitest'

import { createLiveWorld } from '../../../../packages/runtime/test/t12a-live-bridge.mjs'
import { createLifecycleService } from '../../../../packages/runtime/lifecycle/index.js'

const ROOT = 'session-bootseam-root'
const CHILD = 'session-bootseam-child'
const CHILD_B = 'session-bootseam-child-b'
const INSTANCE = 'inst-bootseam'
const INSTANCE_B = 'inst-bootseamb'

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

/** The durable member row the product would hold (SETTLED, no live work). */
function memberRow(instanceId, childSessionId, label) {
  return {
    rootSessionId: ROOT,
    instanceId,
    childSessionId,
    templateId: 'tpl-t12a',
    label,
    lifecycle: 'SETTLED',
    activityVersion: 2,
    createdAt: '2026-11-05T00:00:00.000Z',
  }
}

/**
 * The live world at PRODUCT boot order (`bootPhase: 'resume'`) + the REAL
 * lifecycle service over it. The rows handed to `createLiveWorld` are the
 * SAME objects the commit port mutates, so the glue's durable reads and the
 * procedure observe one durable medium (this process is the single writer).
 *
 * @param {{resumeGate?: (req: object) => Promise<void>|undefined, commitBarrier?: ReturnType<typeof makeBarrier>, extraMembers?: object[]}} [hooks]
 */
async function createBootWorld(hooks = {}) {
  const row = memberRow(INSTANCE, CHILD, 'bootseam-member')
  const rows = [row, ...(hooks.extraMembers ?? [])]
  const world = await createLiveWorld({
    rootSessionId: ROOT,
    members: rows,
    persistence: { exists: () => true },
    configOverrides: { bootPhase: 'resume' },
    ...(hooks.resumeGate === undefined ? {} : { agents: { resumeGate: (req) => hooks.resumeGate(req) } }),
  })
  // Count tool executions across EVERY handle the glue publishes (a cold
  // resume mints a fresh ctx, so a per-handle counter would miss it).
  const handles = []
  const createAgent = world.agents.create.bind(world.agents)
  const resumeAgent = world.agents.resume.bind(world.agents)
  // BS3's ATTRIBUTION PROBE (not a name sniff): a member-set enumeration is a
  // `list()` issued while NO resume is in flight. The three per-resume
  // consumption reads happen INSIDE `agents.resume` (makeHandle →
  // resolveConsumptionViews / installPersonaForSetup), so the depth counter
  // separates them from the loop's enumeration and the post-loop sweep
  // WITHOUT depending on the helper's name — renaming or inlining
  // `listMemberRows` can no longer turn BS3 red for the wrong reason.
  const probe = { resumeDepth: 0 }
  world.agents.create = async (request) => {
    const handle = await createAgent(request)
    handles.push(handle)
    return handle
  }
  world.agents.resume = async (request) => {
    probe.resumeDepth += 1
    try {
      const handle = await resumeAgent(request)
      handles.push(handle)
      return handle
    } finally {
      probe.resumeDepth -= 1
    }
  }
  const toolExecutions = () => handles.reduce((total, handle) => total + handle.agent.ctx.toolExecutions.length, 0)
  /** Every fake-fs operation any handle ever performed (the guard's IO surface). */
  const fsOps = () =>
    handles.reduce((total, handle) => {
      const calls = handle.agent.ctx.fs.calls
      return total + Object.values(calls).reduce((n, list) => n + (Array.isArray(list) ? list.length : 0), 0)
    }, 0)
  const ports = {
    teamDomain: {
      repositories: {
        memberInstances: {
          // THE SAME durable rows the glue's gate reads (one medium).
          list: (root) => world.domain.repositories.memberInstances.list(root),
          get: (root, instanceId) => rows.find(
            (candidate) => String(root) === ROOT && String(instanceId) === String(candidate.instanceId),
          ),
        },
      },
    },
    commit: {
      async commitTransition(args) {
        // The durable commit of the REAL procedure: paused on demand so a
        // test can hold the procedure between quiesce and commit.
        if (hooks.commitBarrier !== undefined) await hooks.commitBarrier.wait()
        const target = rows.find((candidate) => String(candidate.instanceId) === String(args.instanceId))
        if (target === undefined) throw new Error(`boot-seam world: no durable row for instance '${args.instanceId}'`)
        target.lifecycle = args.to
        target.activityVersion = args.expectedActivityVersion + 1
      },
    },
    admission: hooks.admission === false
      // The PRE-#598 production shape (root.ts:2164): a no-op close and no
      // reopen, i.e. the glue gets NO in-process signal from the procedure.
      ? { async closeNewWork() {} }
      : {
          async closeNewWork(target) {
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
    rows,
    world,
    ports,
    service: createLifecycleService(ports),
    toolExecutions,
    fsOps,
    probe,
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

const PROBE = { name: 'grep', args: { pattern: 'A5SF_BOOTSEAM_NEEDLE', path: '/tmp/lane/inside' }, callId: 'bootseam-probe' }

/** Bounded wait for an observable predicate (never a fixed sleep as proof). */
async function waitFor(predicate, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (predicate() === true) return true
    await new Promise((resolve) => setTimeout(resolve, 2))
  }
  return predicate() === true
}

/**
 * Record every `memberInstances.list` call the glue (or the lifecycle ports)
 * makes, with the calling frame. The object is the one the glue's closure
 * calls, so substitution is exact.
 */
function recordListCalls(world, classify = () => ({})) {
  const repo = world.domain.repositories.memberInstances
  const calls = []
  const original = repo.list
  repo.list = (root) => {
    calls.push({ root: String(root), ...classify() })
    return original(root)
  }
  return {
    calls,
    restore() {
      repo.list = original
    },
  }
}

describe('boot resume against a concurrent archive', () => {
  it('BS1 BOOT RACE: the ARCHIVED commit lands while the resume is in flight -> not resident, 422, 0 executions', async () => {
    const resumeBarrier = makeBarrier()
    const { world, row, service, target, toolExecutions, fsOps } = await createBootWorld({
      // Only the MEMBER's resume is held (the root resume is the boot prologue).
      resumeGate: (req) => (String(req.resumeSessionId) === CHILD ? resumeBarrier.wait() : undefined),
    })
    try {
      const bootPromise = world.binding.boot()
      await resumeBarrier.reached
      expect(world.agents.resumes.map((entry) => entry.sessionId)).toContain(CHILD)

      // THE REAL PROCEDURE runs to completion while the member's boot resume
      // is suspended inside the agents double: close admission → interrupt →
      // drain → quiesce (release residency) → commit ARCHIVED → re-drop.
      await service.archiveMember(target)
      expect(row.lifecycle).toBe('ARCHIVED')

      resumeBarrier.release()
      await bootPromise

      const executionsBefore = toolExecutions()
      const fsBefore = fsOps()
      const reply = await routeReply(world.binding, CHILD, PROBE)
      const measured = {
        residentAfterBoot: world.binding.hasLive(CHILD),
        status: reply.status,
        toolExecutions: toolExecutions() - executionsBefore,
        fsOps: fsOps() - fsBefore,
      }
      expect(measured).toEqual({ residentAfterBoot: false, status: 422, toolExecutions: 0, fsOps: 0 })
      expect(reply.body.ok).toBeUndefined()
      expect(reply.body.error).toMatch(/ARCHIVED MemberInstance/u)
    } finally {
      await world.binding.close().catch(() => undefined)
    }
  })

  it('BS2 BOOT INTERLEAVE: the resume resolves inside the quiesce->commit window -> no handle deposited', async () => {
    const resumeBarrier = makeBarrier()
    const commitBarrier = makeBarrier()
    const { world, row, service, target, toolExecutions } = await createBootWorld({
      resumeGate: (req) => (String(req.resumeSessionId) === CHILD ? resumeBarrier.wait() : undefined),
      commitBarrier,
    })
    try {
      const bootPromise = world.binding.boot()
      await resumeBarrier.reached

      // The REAL procedure reaches its commit step and is HELD there: the
      // admission is closed and residency was released at quiesce step 5,
      // while the durable row still reads SETTLED (no durable read can
      // distinguish this window — that is the point of the arm).
      const archive = service.archiveMember(target)
      await commitBarrier.reached
      expect(row.lifecycle).toBe('SETTLED')

      // The in-flight resume now resolves INSIDE the window.
      resumeBarrier.release()
      await bootPromise
      const executionsBefore = toolExecutions()
      const reply = await routeReply(world.binding, CHILD, PROBE)
      const measured = {
        residentWhileQuiesced: world.binding.hasLive(CHILD),
        status: reply.status,
        toolExecutions: toolExecutions() - executionsBefore,
      }

      commitBarrier.release()
      await archive
      expect(row.lifecycle).toBe('ARCHIVED')
      expect(measured).toEqual({ residentWhileQuiesced: false, status: 422, toolExecutions: 0 })
      expect(world.binding.hasLive(CHILD)).toBe(false)
      const after = await routeReply(world.binding, CHILD, PROBE)
      expect(after.status).toBe(422)
    } finally {
      await world.binding.close().catch(() => undefined)
    }
  })

  it('BS4 PUBLISH WINDOW: a resume resolving AFTER a completed archive must not publish, even mid-boot', async () => {
    const resumeBarrierA = makeBarrier()
    const resumeBarrierB = makeBarrier()
    const { world, row, rows, service, toolExecutions } = await createBootWorld({
      extraMembers: [memberRow(INSTANCE_B, CHILD_B, 'bootseam-member-b')],
      resumeGate: (req) => {
        const sid = String(req.resumeSessionId)
        if (sid === CHILD) return resumeBarrierA.wait()
        if (sid === CHILD_B) return resumeBarrierB.wait()
        return undefined
      },
    })
    try {
      let bootSettled = false
      const bootPromise = world.binding.boot().finally(() => { bootSettled = true })
      await resumeBarrierA.reached
      expect(bootSettled).toBe(false)

      // The REAL procedure runs to COMPLETION while A's resume is suspended:
      // close admission → interrupt → drain → quiesce (release residency; no
      // handle exists yet) → commit ARCHIVED → post-commit re-drop (nothing to
      // drop) → finally REOPEN admission. After this point the in-memory
      // admission check cannot refuse the pending resume: the flag is OPEN.
      await service.archiveMember({ rootSessionId: ROOT, instanceId: INSTANCE })
      expect(row.lifecycle).toBe('ARCHIVED')

      // A's resume now resolves with the archive already finished. B is still
      // suspended, so the post-loop sweep has NOT run and boot is still
      // pending — the reviewer's interval, where `ensureLiveAgent`'s fast path
      // serves whatever this publish deposited.
      resumeBarrierA.release()
      await waitFor(() => world.binding.hasLive(CHILD), 300)
      const published = world.binding.hasLive(CHILD)
      const executionsBefore = toolExecutions()
      const reply = await routeReply(world.binding, CHILD, PROBE)
      const measured = {
        published,
        lifecycle: row.lifecycle,
        bootPending: bootSettled === false,
        status: reply.status,
        toolExecutions: toolExecutions() - executionsBefore,
      }

      resumeBarrierB.release()
      await bootPromise
      expect(rows.find((candidate) => candidate.instanceId === INSTANCE_B)?.lifecycle).toBe('SETTLED')
      // RED on the pre-fix tree: published=true, status=200, one execution.
      // GREEN after it: nothing is published (422, zero executions) and the
      // handle can never be served in the interval at all.
      expect(measured).toEqual({
        published: false,
        lifecycle: 'ARCHIVED',
        bootPending: true,
        status: 422,
        toolExecutions: 0,
      })
      expect(world.binding.hasLive(CHILD)).toBe(false)
      const after = await routeReply(world.binding, CHILD, PROBE)
      expect(after.status).toBe(422)
      expect(after.body.error).toMatch(/ARCHIVED MemberInstance/u)
    } finally {
      await world.binding.close().catch(() => undefined)
    }
  })

  it('BS5 UNWIRED ADMISSION PORT: the post-loop sweep is the only backstop (and the publish window is open there)', async () => {
    // The PRE-#598 production wiring (root.ts:2164): `closeNewWork` is a no-op
    // and there is no `reopenNewWork`, so the glue receives NO in-process
    // signal — neither the admission close (SEAM 5) nor the terminal marker
    // (SEAM 6) can exist. This arm CHARACTERISES that configuration instead of
    // letting the fix claim it:
    //   * mid-boot, after the archive completed and the resume resolved, the
    //     handle IS published and a dispatch executes a tool (200 / 1) — an
    //     EXECUTABLE window, stated plainly, not described as harmless;
    //   * after `boot()` the post-loop durable sweep has dropped it (422 / 0).
    // The production root wires both ports since #598, so this is the shape a
    // root must NOT have; M1 (sweep removed) turns this arm red, which is what
    // makes the sweep a measured backstop rather than an asserted one.
    const resumeBarrierA = makeBarrier()
    const resumeBarrierB = makeBarrier()
    const { world, row, service, toolExecutions } = await createBootWorld({
      admission: false,
      extraMembers: [memberRow(INSTANCE_B, CHILD_B, 'bootseam-member-b')],
      resumeGate: (req) => {
        const sid = String(req.resumeSessionId)
        if (sid === CHILD) return resumeBarrierA.wait()
        if (sid === CHILD_B) return resumeBarrierB.wait()
        return undefined
      },
    })
    try {
      let bootSettled = false
      const bootPromise = world.binding.boot().finally(() => { bootSettled = true })
      await resumeBarrierA.reached
      await service.archiveMember({ rootSessionId: ROOT, instanceId: INSTANCE })
      expect(row.lifecycle).toBe('ARCHIVED')
      resumeBarrierA.release()
      await waitFor(() => world.binding.hasLive(CHILD), 300)
      const executionsBeforeMid = toolExecutions()
      const midReply = await routeReply(world.binding, CHILD, PROBE)
      const midBoot = {
        published: world.binding.hasLive(CHILD),
        bootPending: bootSettled === false,
        status: midReply.status,
        toolExecutions: toolExecutions() - executionsBeforeMid,
      }
      resumeBarrierB.release()
      await bootPromise
      const afterReply = await routeReply(world.binding, CHILD, PROBE)
      // DOCUMENTED GAP (unwired configuration only): executable mid-boot.
      expect(midBoot).toEqual({ published: true, bootPending: true, status: 200, toolExecutions: 1 })
      // THE SWEEP'S GUARANTEE (what M1 removes): after boot, nothing resident.
      expect(world.binding.hasLive(CHILD)).toBe(false)
      expect(afterReply.status).toBe(422)
      expect(toolExecutions()).toBe(1)
    } finally {
      await world.binding.close().catch(() => undefined)
    }
  })

  it('BS3 LIST BUDGET: one enumeration for the member set + one sweep, independent of member count', async () => {
    const measure = async (memberCount) => {
      const extraMembers = memberCount === 2
        ? [memberRow(INSTANCE_B, CHILD_B, 'bootseam-member-b')]
        : []
      const { world, probe } = await createBootWorld({ extraMembers })
      try {
        const recorder = recordListCalls(world, () => ({ enumeration: probe.resumeDepth === 0 }))
        try {
          await world.binding.boot()
        } finally {
          recorder.restore()
        }
        const resumed = world.agents.resumes.map((entry) => entry.sessionId)
        expect(resumed).toContain(CHILD)
        if (memberCount === 2) expect(resumed).toContain(CHILD_B)
        return {
          total: recorder.calls.length,
          enumerations: recorder.calls.filter((call) => call.enumeration).length,
        }
      } finally {
        await world.binding.close().catch(() => undefined)
      }
    }
    const one = await measure(1)
    const two = await measure(2)
    // THE PRESERVED PROPERTY, in the exact numbers: the boot's own member-set
    // enumerations are the loop's ONE `list()` plus the ONE post-loop sweep =
    // 2, for ONE member and for TWO — i.e. independent of member count. A
    // future change that re-reads per member grows the 2-member count and
    // breaks this assertion instead of silently rotting the property.
    expect(two.enumerations, `two-member boot member-set enumerations: ${JSON.stringify(two)}`).toBe(2)
    expect(one.enumerations, `one-member boot member-set enumerations: ${JSON.stringify(one)}`).toBe(2)
    // The totals are reported too (the two-member boot on the fixed tree:
    // 2 member-set enumerations + 3 pre-existing per-resume consumption reads
    // per resolvable member = 8; the one-member boot = 5). The delta is the
    // PRE-EXISTING per-resume read, which is not the member-set budget.
    expect({ one: one.total, two: two.total }).toEqual({ one: 5, two: 8 })
    expect(two.total - one.total, `per-member consumption reads are pre-existing: ${JSON.stringify({ one, two })}`).toBe(3)
  })
})
