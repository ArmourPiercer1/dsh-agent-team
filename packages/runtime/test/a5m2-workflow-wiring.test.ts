/**
 * A5M2 B-ORCHESTRATION execution consumer (workflow-wiring.mjs): the
 * REAL consumer arms behind supply — capture the REAL registration face
 * (host-plugin shape: tool-workflow/src/index.ts:329 ctx.tools.register
 * (defineTool(…))), one outer PA admission per call before the ORIGINAL
 * exec, ralph honest-DECLARED without a capture (zero-flip), and the
 * exact child-governance breakpoint CARRIED on the manifest
 * (runtime-types.ts:40-48 result/cancel/dispose; invariant.ts:53-54 the
 * only child census). Author-side only: no boot, no Host, no engine.
 */
import { describe, it, expect } from 'vitest'
import { createBOrchestrationExecutionWiring, A5_B_ORCH_WIRING_CODES } from '../src/plugin/live/governed-families/workflow-wiring.mjs'

const mkNative = (name, calls) => ({
  name,
  description: `the published ${name} tool body (registration-face capture)`,
  parameters: { script: { type: 'string', required: true }, meta: { type: 'object', required: true } },
  output: { schema: { type: 'object' }, render: () => 'x' },
  execute: async (args, exec) => { calls.push({ args, exec }); return { runId: 'run-1', agentsStarted: 2, result: 'settled' } },
})

const fixtures = (pa) => {
  const calls = []
  const workflow = mkNative('workflow', calls)
  const delegates = { workflow: workflow.execute }
  return {
    calls,
    input: {
      providerId: 'a5p5-plane',
      captured: Object.freeze({ workflow: Object.freeze({ native: workflow, definitionIdentity: 'wf-id-1' }) }),
      liveNative: (name) => (name === 'workflow' ? workflow : undefined),
      workflowDelegates: delegates,
      liveWorkflowDelegates: () => delegates,
      placementFeed: (name) => (name === 'workflow' ? { definitionIdentity: 'wf-id-1', realmId: 'realm-orch' } : undefined),
      pa,
    },
  }
}
const execFor = (callId = 'orch-call-1') => ({ callId, agent: { id: 'a1' }, signal: new AbortController().signal })
const ARGS = { script: 'return 1', meta: { name: 'wf', description: 'd' } }

describe('A5M2 B-ORCH execution consumer: outer PA governance over the ORIGINAL exec', () => {
  it('arms workflow ALWAYS from the registration capture; ralph without a capture is the adapter\'s honest DECLARED row (zero-flip untouched)', () => {
    const { input } = fixtures(async () => ({ kind: 'allow' }))
    const w = createBOrchestrationExecutionWiring(input)
    expect(w.ok).toBe(true)
    if (w.ok !== true) return
    expect(w.placementNames).toEqual(['workflow'])
    expect(w.declared.some((d) => d.name === 'ralph' && String(d.status).includes('DECLARED'))).toBe(true)
    expect(w.familyId).toBe('B-ORCHESTRATION')
  })
  it('the admit seat is OWNED: an admit input is refused outright', () => {
    const { input } = fixtures(async () => ({ kind: 'allow' }))
    const w = createBOrchestrationExecutionWiring({ ...input, admit: async () => ({ ok: true }) })
    expect(w.ok).not.toBe(true)
    expect(w.code).toBe(A5_B_ORCH_WIRING_CODES.ADMISSION_SEAT_OWNED)
  })
  it('ONE outer admission per call: the walk carries realm/call/record-47 and the manifest CARRIES the child breakpoint; on allow the ORIGINAL exec runs verbatim', async () => {
    const walks = []
    const { input, calls } = fixtures(async (walk) => { walks.push(walk); return { kind: 'allow' } })
    const w = createBOrchestrationExecutionWiring(input)
    if (w.ok !== true) throw w
    const def = w.definitions.find((d) => d.name === 'workflow')
    const answer = await def.execute(ARGS, execFor())
    expect(answer).toEqual({ runId: 'run-1', agentsStarted: 2, result: 'settled' })
    expect(walks.length).toBe(1)
    const walk = walks[0]
    expect(walk.realmId).toBe('realm-orch')
    expect(walk.callId).toBe('orch-call-1')
    expect(walk.toolName).toBe('workflow')
    expect(walk.family.familyId).toBe('B-ORCHESTRATION')
    expect(walk.family.recordIndex).toBe(47)
    expect(walk.family.targetManifest.addressClaim).toBeNull()
    expect(walk.family.targetManifest.childGovernance).toContain('runtime-types.ts:40-48')
    expect(walk.family.targetManifest.childGovernance).toContain('invariant.ts:53-54')
    expect(walk.requestedEffects).toBeDefined() // the DOMAIN parser's canonical value, not a minted envelope
    expect(typeof walk.parametersFingerprint).toBe('string')
    expect(calls.length).toBe(1) // the ORIGINAL body ran exactly once…
    expect(calls[0].args).toEqual(ARGS) // …args byte-identical through the frozen plan (plan-frozen copy — the law)
  })
  it('deny / throw / pre-aborted all enter NOTHING and never the body; deny bytes ride VERBATIM', async () => {
    const cases = [
      { pa: async () => ({ kind: 'deny', detail: 'the leader said no' }), code: A5_B_ORCH_WIRING_CODES.DENIED, bodyCalls: 0, detail: 'the leader said no' },
      { pa: async () => { throw new Error('funnel down') }, code: A5_B_ORCH_WIRING_CODES.PA_FAULT, bodyCalls: 0, detail: 'funnel down' },
    ]
    for (const c of cases) {
      const { input, calls } = fixtures(c.pa)
      const w = createBOrchestrationExecutionWiring(input)
      if (w.ok !== true) throw w
      const def = w.definitions.find((d) => d.name === 'workflow')
      await expect(def.execute(ARGS, execFor('c2'))).rejects.toMatchObject({ code: c.code })
      expect(calls.length).toBe(c.bodyCalls)
      await expect(def.execute(ARGS, execFor('c2b'))).rejects.toMatchObject({ message: expect.stringContaining(c.detail) })
    }
    const ac = new AbortController()
    ac.abort()
    const { input, calls } = fixtures(async () => ({ kind: 'allow' }))
    const w = createBOrchestrationExecutionWiring(input)
    if (w.ok !== true) throw w
    const def = w.definitions.find((d) => d.name === 'workflow')
    await expect(def.execute(ARGS, { callId: 'c3', agent: { id: 'a1' }, signal: ac.signal })).rejects.toMatchObject({ code: A5_B_ORCH_WIRING_CODES.CANCELLED })
    expect(calls.length).toBe(0)
  })
  it('mount places on the REAL tools face with rollback handles; second mount refused; dispose drains FIRST and runs each disposer exactly once', async () => {
    const { input } = fixtures(async () => ({ kind: 'allow' }))
    const w = createBOrchestrationExecutionWiring(input)
    if (w.ok !== true) throw w
    const order = []
    const agentCtx = { tools: { register: (definition) => () => order.push(`off:${definition.name}`) } }
    const placed = w.mount(agentCtx)
    expect(placed.ok).toBe(true)
    expect((w.mount(agentCtx))).toMatchObject({ code: A5_B_ORCH_WIRING_CODES.MOUNT_ALREADY_PLACED })
    const d1 = w.dispose()
    expect(d1.disposers).toBe(1)
    expect(order).toEqual(['off:workflow'])
    const d2 = w.dispose()
    expect(String(d2.semantics)).toContain('already disposed')
    expect(order.length).toBe(1) // exactly once
    const def = w.definitions.find((d) => d.name === 'workflow')
    // dispose drains the adapter FIRST: new calls meet the DRAINING
    // new-call prohibition at the row level (adapter semantics verbatim)
    await expect(def.execute(ARGS, execFor('c4'))).rejects.toMatchObject({ code: 'P_B_ORCH_DRAINING' })
  })
})
