/**
 * t12a-m3-recursive-drain.test.ts — T12-M3: the REAL recursive descendant
 * drain (stop + quiesce).
 *
 * The old glue swallowed every whenIdle rejection and returned
 * `{drained: 0, quiescent: true}` unconditionally: the member's descendant
 * tree was never drained, and quiescence was FAKED. T12-M3 replaces it with
 * the real sequence (reference: upstream acp session close —
 * packages/acp/acp/src/session.ts:431-461):
 *   (a) `await handle.agent.whenIdle()` (rejection propagates as a fault);
 *   (b) `await subagents.drainContinuableDescendants([handle.agent])` — an
 *       aggregate rejection after all branches settle is a DRAIN FAILURE
 *       (report `quiescent: false`, never a fake `quiescent: true`);
 *   (c) `await subagents.listDescendants(agent.session.id)` — the HONEST
 *       descendant count.
 *
 * Acceptance (the real glue over the subagents double):
 *   M3-1 a real descendant tree (N entries) drains to the actual count
 *        with `quiescent: true`; the drain is called with the member's
 *        exact Agent and the listing uses the member session id;
 *   M3-2 a drain REJECTION (aggregate after all branches) reports
 *        `{drained: <count>, quiescent: false}` — never quiescent:true;
 *   M3-3 the subagents service ABSENT -> the typed fail-closed
 *        recursive-drain-unavailable rejection (archive/dispose refuse);
 *   M3-4 no live agent for the session -> the same typed rejection
 *        (quiescence cannot be established);
 *   M3-5 a whenIdle rejection PROPAGATES as a fault before any drain call
 *        (step (a) runs first — no drain, no fake quiescence).
 *   M3-6 (ROUND 108) the 0.2.2-rc.5 PUBLIC name `drainDescendants` drives the
 *        same drain as the rc.2 name (the host renamed the method; the seam
 *        resolves it by name capability — measured live on rc.5 by
 *        `d2:remote-delivery`);
 *   M3-7 a service with `listDescendants` but neither public drain name is
 *        structurally unusable → the same typed fail-closed refusal.
 */
import { describe, expect, it } from 'vitest'
import { createAgentPresetsDouble, createLiveWorld, createSubagentsDouble } from './t12a-live-bridge.mjs'

const ROOT = 'session-t12a-m3-root'
const INSTANCE = 'inst-t12am3member'
const CHILD = 'session-team-child-m3seed'
const memberRow = { childSessionId: CHILD, instanceId: INSTANCE, templateId: 'tpl-t12a' }
const seed = [{ instanceId: INSTANCE, templateId: 'tpl-t12a', label: 'member M3', childSessionId: CHILD }]

async function buildWorld(options: Record<string, unknown>) {
  const world = await createLiveWorld({
    rootSessionId: ROOT,
    // D1 (v2): the member base-tool substrate (member paths fail closed
    // without it — every world here drives a seeded member).
    agentPresets: createAgentPresetsDouble(),
    members: [memberRow],
    configOverrides: { seedMembers: seed },
    ...options,
  })
  await world.binding.boot()
  return world
}

// M3-1: a real descendant tree (3 entries) drains clean.
const okSubagents = createSubagentsDouble({
  descendants: [{ sessionId: 'd1' }, { sessionId: 'd2' }, { sessionId: 'd3' }],
})
const okWorld = await buildWorld({ subagents: okSubagents })
const okReport = await okWorld.binding.drainDescendants(CHILD)

// M3-2: the drain rejects with an aggregate (all branches settled, one failed).
const failSubagents = createSubagentsDouble({
  drainBehavior: 'reject',
  drainErrorMessage: 'descendant branch d1 failed (aggregate)',
  descendants: [{ sessionId: 'd1' }, { sessionId: 'd2' }],
})
const failWorld = await buildWorld({ subagents: failSubagents })
const failReport = await failWorld.binding.drainDescendants(CHILD)

// M3-3: the subagents service is absent (the production host seam not wired
// yet — the typed fail-closed path).
const noSvcWorld = await buildWorld({})
let noSvcError: unknown
try {
  await noSvcWorld.binding.drainDescendants(CHILD)
} catch (error) {
  noSvcError = error
}

// M3-4: no live agent for the session (quiescence cannot be established).
let noAgentError: unknown
try {
  await okWorld.binding.drainDescendants('session-t12a-m3-unknown')
} catch (error) {
  noAgentError = error
}

// M3-5: a whenIdle rejection propagates before any drain call.
const idleSubagents = createSubagentsDouble({ descendants: [] })
const idleWorld = await buildWorld({
  subagents: idleSubagents,
  agents: {
    whenIdleBehavior: () => Promise.reject(new Error('whenIdle fault (turn rejected)')),
  },
})
let idleError: unknown
try {
  await idleWorld.binding.drainDescendants(CHILD)
} catch (error) {
  idleError = error
}

// M3-6 (ROUND 108, rc.5 acceptance): the host renamed the PUBLIC drain method
// between generations (0.2.0-rc.2 `drainContinuableDescendants` →
// 0.2.2-rc.5 `drainDescendants`, same signature, same aggregate-after-settle
// contract). A double that exposes ONLY the rc.5 name must drive the SAME
// drain: before this arm the seam hard-required the rc.2 name and `archive`
// failed closed on rc.5, leaving the member SETTLED.
const nextNameSubagents = createSubagentsDouble({
  drainMethodName: 'drainDescendants',
  descendants: [{ sessionId: 'n1' }, { sessionId: 'n2' }],
})
const nextNameWorld = await buildWorld({ subagents: nextNameSubagents })
const nextNameReport = await nextNameWorld.binding.drainDescendants(CHILD)

// M3-7: a service that exposes `listDescendants` but NEITHER public drain name
// is structurally unusable — the seam must still refuse (never a silent drain
// that reports quiescence without draining anything).
const noDrainWorld = await buildWorld({
  subagents: { listDescendants: () => Promise.resolve([]) },
})
let noDrainError: unknown
try {
  await noDrainWorld.binding.drainDescendants(CHILD)
} catch (error) {
  noDrainError = error
}

describe('T12-M3 the real recursive descendant drain', () => {
  it('M3-1 a real descendant tree drains to the actual count (quiescent: true)', () => {
    expect(okReport.drained).toBe(3)
    expect(okReport.quiescent).toBe(true)
    expect(okSubagents.drainCalls.length).toBe(1)
    expect(okSubagents.drainCalls[0]!.length).toBe(1)
    expect(okSubagents.drainCalls[0]![0]).toBe(okWorld.agents.handles.get(CHILD)!.agent)
    expect(okSubagents.listCalls.length).toBe(1)
    expect(okSubagents.listCalls[0]).toBe(CHILD)
  })

  it('M3-2 a drain rejection reports the best-effort count with quiescent: false (never true)', () => {
    expect(failReport.drained).toBe(2)
    expect(failReport.quiescent).toBe(false)
    expect(failSubagents.drainCalls.length).toBe(1)
    expect(failSubagents.listCalls.length).toBe(1)
  })

  it('M3-3 the absent subagents service fails closed with the typed recursive-drain-unavailable error', () => {
    expect(noSvcError instanceof Error).toBe(true)
    expect((noSvcError as Error).message.includes('recursive-drain-unavailable')).toBe(true)
    expect((noSvcError as { code?: string }).code).toBe('recursive-drain-unavailable')
  })

  it('M3-4 no live agent for the session fails closed with the same typed error', () => {
    expect(noAgentError instanceof Error).toBe(true)
    expect((noAgentError as Error).message.includes('recursive-drain-unavailable')).toBe(true)
    expect((noAgentError as { code?: string }).code).toBe('recursive-drain-unavailable')
  })

  it('M3-5 a whenIdle rejection propagates as a fault before any drain call', () => {
    expect(idleError instanceof Error).toBe(true)
    expect((idleError as Error).message.includes('whenIdle fault')).toBe(true)
    expect(idleSubagents.drainCalls.length).toBe(0)
    expect(idleSubagents.listCalls.length).toBe(0)
  })

  it('M3-6 the 0.2.2-rc.5 public drain name (`drainDescendants`) drives the same drain', () => {
    expect(nextNameReport.quiescent).toBe(true)
    expect(nextNameReport.drained).toBe(2)
    expect(nextNameSubagents.drainCalls.length).toBe(1)
    expect(nextNameSubagents.drainCalls[0]!.length).toBe(1)
    expect(nextNameSubagents.drainCalls[0]![0]).toBe(nextNameWorld.agents.handles.get(CHILD)!.agent)
    expect(nextNameSubagents.listCalls.length).toBe(1)
    expect(nextNameSubagents.listCalls[0]).toBe(CHILD)
  })

  it('M3-7 a service with listDescendants but neither public drain name still fails closed', () => {
    expect(noDrainError instanceof Error).toBe(true)
    expect((noDrainError as Error).message.includes('recursive-drain-unavailable')).toBe(true)
    expect((noDrainError as { code?: string }).code).toBe('recursive-drain-unavailable')
  })
})
