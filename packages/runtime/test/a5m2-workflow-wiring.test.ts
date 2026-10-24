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
  it('FAIL-CLOSED SAFETY BLOCK (root audit of 07bb0c95): every call refuses typed BEFORE the walk — zero PA consumption, zero body entry, the audit chain rides the refusal', async () => {
    const walks: Record<string, unknown>[] = []
    const { input, calls } = fixtures(async (walk) => { walks.push(walk); return { kind: 'allow' } })
    const w = createBOrchestrationExecutionWiring(input)
    if (w.ok !== true) throw w
    const def = w.definitions.find((d) => d.name === 'workflow')
    await expect(def.execute(ARGS, execFor())).rejects.toMatchObject({
      message: expect.stringContaining('P_B_ORCH_WIRE_CHILD_GOVERNANCE_UNGOVERNED'),
    })
    expect(walks.length, 'the PA funnel is never consumed for a call that cannot execute').toBe(0)
    expect(calls.length, 'the original body never enters').toBe(0)
    expect(w.walks()).toBe(0)
    await expect(def.execute(ARGS, execFor('c-detail'))).rejects.toMatchObject({
      message: expect.stringContaining('activationFence'),
    })
    await expect(def.execute(ARGS, execFor('c-detail2'))).rejects.toMatchObject({
      message: expect.stringContaining('agentSetup'),
    })
  })
  it('deny/throw/pre-aborted ALL meet the SAME fail-closed refusal first (no input reaches the walk machinery while the block stands)', async () => {
    for (const pa of [async () => ({ kind: 'deny', detail: 'x' }), async () => { throw new Error('funnel down') }]) {
      const { input, calls } = fixtures(pa)
      const w = createBOrchestrationExecutionWiring(input)
      if (w.ok !== true) throw w
      const def = w.definitions.find((d) => d.name === 'workflow')
      await expect(def.execute(ARGS, execFor('c2'))).rejects.toMatchObject({ message: expect.stringContaining('CHILD_GOVERNANCE_UNGOVERNED') })
      expect(calls.length).toBe(0)
    }
    const ac = new AbortController()
    ac.abort()
    const { input, calls } = fixtures(async () => ({ kind: 'allow' }))
    const w = createBOrchestrationExecutionWiring(input)
    if (w.ok !== true) throw w
    const def = w.definitions.find((d) => d.name === 'workflow')
    await expect(def.execute(ARGS, { callId: 'c3', agent: { id: 'a1' }, signal: ac.signal })).rejects.toMatchObject({ message: expect.stringContaining('CHILD_GOVERNANCE_UNGOVERNED') })
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
    // post-dispose the fail-closed block stands FIRST (and independently of
    // it the drain law would refuse too): zero body entry either way
    await expect(def.execute(ARGS, execFor('c4'))).rejects.toMatchObject({ message: expect.stringMatching(/CHILD_GOVERNANCE_UNGOVERNED|DRAINING/) })
  })
})
