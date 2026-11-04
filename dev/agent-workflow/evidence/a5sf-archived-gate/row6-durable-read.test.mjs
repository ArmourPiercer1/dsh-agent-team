/**
 * row6-durable-read.test.mjs — the durable-read COST measurement for the
 * row-6 lifecycle gate (`memberResumeRefusal` in agent-bindings.mjs).
 *
 * The question: does a steady-state tool call now pay a durable read?
 *
 * MEASURED here against the REAL glue (t12a bridge):
 *   1. STEADY STATE: once a member agent is live, `ensureLiveAgent` returns
 *      the resident handle from `liveAgents` before `ensureLiveAgentOnce`
 *      runs, so the gate is never reached — 0 `memberInstances.list` calls
 *      across N calls;
 *   2. COLD RESUME: the gate adds exactly ONE `list` (the ownership resolver
 *      that runs before it also reads one), i.e. 2 in-memory snapshot reads
 *      per cold resume — no new durable I/O (`StorageKvTable.get` reads
 *      memory: packages/storage/schema/seam.ts:65);
 *   3. BOOT: the resume loop passes the list it already holds, so the gate
 *      adds ZERO reads — boot does 1 `list` for any number of members.
 *
 * The measurement wraps `domain.repositories.memberInstances.list` with a
 * recorder (the same object the glue closure calls); it counts calls, not
 * time — the question is whether a read happens, not how long it takes.
 */
import { describe, expect, it } from 'vitest'

import { createLiveWorld } from '../../../../packages/runtime/test/t12a-live-bridge.mjs'

const ROOT = 'session-team-row6-cost'
const CHILD = 'session-child-row6-cost'
const STEADY_STATE_CALLS = 100

function worldWith(members, options = {}) {
  return createLiveWorld({
    rootSessionId: ROOT,
    members,
    persistence: { exists: () => true },
    ...options,
  })
}

/**
 * Wrap the domain repository's list() with a call recorder. Each call is
 * attributed to the gate when `memberResumeRefusal` is on its stack (the
 * stack is the only way to separate the gate's read from the ownership /
 * consumption reads that were already there).
 */
function recordListCalls(world) {
  const repo = world.domain.repositories.memberInstances
  const calls = []
  const original = repo.list
  repo.list = (root) => {
    const stack = new Error().stack ?? ''
    calls.push({ root: String(root), gate: stack.includes('memberResumeRefusal') })
    return original(root)
  }
  return {
    calls,
    gateCalls: () => calls.filter((call) => call.gate).length,
    restore() {
      repo.list = original
    },
  }
}

async function capture(fn) {
  try {
    return { value: await fn() }
  } catch (error) {
    return { error }
  }
}

describe('row 6 gate — durable-read cost', () => {
  it('steady state: 100 ensureLiveAgent calls on a live member add ZERO durable reads', async () => {
    const world = await worldWith([
      { instanceId: 'inst-cost', childSessionId: CHILD, templateId: 'tpl-t12a', lifecycle: 'SETTLED' },
    ])
    try {
      // one cold resume to get the member resident (its own reads are not measured)
      await world.binding.ensureLiveAgent(CHILD)
      const recorder = recordListCalls(world)
      try {
        for (let i = 0; i < STEADY_STATE_CALLS; i += 1) {
          const outcome = await capture(() => world.binding.ensureLiveAgent(CHILD))
          expect(outcome.error, 'the resident handle must be returned, not refused').toBeUndefined()
        }
      } finally {
        recorder.restore()
      }
      expect(recorder.calls, `steady-state ensureLiveAgent calls must not read the member repository (got ${JSON.stringify(recorder.calls)})`).toEqual([])
      expect(recorder.gateCalls(), 'the lifecycle gate must not run for a resident agent').toBe(0)
    } finally {
      await world.binding.close().catch(() => undefined)
    }
  })

  it('cold resume: the gate costs exactly ONE extra in-memory list (2 total incl. ownership)', async () => {
    const world = await worldWith([
      { instanceId: 'inst-cost', childSessionId: CHILD, templateId: 'tpl-t12a', lifecycle: 'SETTLED' },
    ])
    try {
      await world.binding.ensureLiveAgent(CHILD)
      const dropped = await world.binding.dropResidency(CHILD)
      expect(dropped.dropped).toBe(true)
      const recorder = recordListCalls(world)
      try {
        await world.binding.ensureLiveAgent(CHILD)
      } finally {
        recorder.restore()
      }
      // The gate's OWN read is exactly one per cold resume. The other reads
      // (ownership resolver + consumption/instance resolution) pre-date it.
      expect(recorder.gateCalls(), `cold resume gate list() calls: ${JSON.stringify(recorder.calls)}`).toBe(1)
      expect(recorder.calls.length, `cold resume total list() calls: ${JSON.stringify(recorder.calls)}`).toBe(4)
    } finally {
      await world.binding.close().catch(() => undefined)
    }
  })

  it('boot resume: one list for the whole member set (the gate reuses the loop rows)', async () => {
    const world = await createLiveWorld({
      rootSessionId: 'session-team-row6-cost-boot',
      members: [
        { instanceId: 'inst-boota', childSessionId: 'session-child-boota', templateId: 'tpl-t12a', lifecycle: 'SETTLED' },
        { instanceId: 'inst-bootb', childSessionId: 'session-child-bootb', templateId: 'tpl-t12a', lifecycle: 'SETTLED' },
        { instanceId: 'inst-bootc', childSessionId: 'session-child-bootc', templateId: 'tpl-t12a', lifecycle: 'ARCHIVED' },
      ],
      persistence: { exists: () => true },
      configOverrides: { bootPhase: 'resume' },
    })
    try {
      const recorder = recordListCalls(world)
      try {
        await world.binding.boot()
      } finally {
        recorder.restore()
      }
      // Measured total for this world: 1 boot list + 1 ownership read per
      // resumable member + the consumption reads — all pre-date the gate.
      // The gate's OWN contribution is ZERO because it receives the loop's
      // already-read rows.
      expect(recorder.gateCalls(), `the boot gate must reuse the loop rows (0 extra reads); all calls: ${JSON.stringify(recorder.calls)}`).toBe(0)
      const resumed = world.agents.resumes.map((row) => row.sessionId)
      expect(resumed).toContain('session-child-boota')
      expect(resumed).toContain('session-child-bootb')
      expect(resumed).not.toContain('session-child-bootc')
    } finally {
      await world.binding.close().catch(() => undefined)
    }
  })
})
