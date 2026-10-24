/**
 * A5M2 B-ORCHESTRATION execution consumer (workflow-wiring.mjs): the
 * REAL consumer arms behind supply — capture the REAL registration face
 * (host-plugin shape: tool-workflow/src/index.ts:329 ctx.tools.register
 * (defineTool(…))), one outer PA admission per call before the ORIGINAL
 * exec, ralph honest-DECLARED without a capture (zero-flip), and the
 * exact child-governance breakpoint CARRIED on the manifest
 * (runtime-types.ts:40-48 result/cancel/dispose; invariant.ts:53-54 the
 * only child census). Author-side only: no boot, no Host, no engine.
 * Types are the .d.mts surface (G2OrchWiringInput/G2OrchWiringOk); every
 * narrowing is a branch on the union, never an as-any.
 */
import { describe, it, expect } from 'vitest'
import { createBOrchestrationExecutionWiring, A5_B_ORCH_WIRING_CODES } from '../src/plugin/live/governed-families/workflow-wiring.mjs'
import type { G2OrchWiringInput, G2OrchWiringOk, G2OrchWiringRefusal } from '../src/plugin/live/governed-families/workflow-wiring.d.mts'

type OrchExecute = (args: unknown, exec: unknown) => Promise<unknown>
type OrchCall = { args: unknown, exec: unknown }
interface OrchNative {
  name: string
  description: string
  parameters: Record<string, unknown>
  output: { schema: Record<string, unknown>, render: () => string }
  execute: OrchExecute
}

const mkNative = (name: string, calls: OrchCall[]): OrchNative => ({
  name,
  description: `the published ${name} tool body (registration-face capture)`,
  parameters: { script: { type: 'string', required: true }, meta: { type: 'object', required: true } },
  output: { schema: { type: 'object' }, render: () => 'x' },
  execute: async (args, exec) => { calls.push({ args, exec }); return { runId: 'run-1', agentsStarted: 2, result: 'settled' } },
})

const allowPa = (sink?: OrchWalk[]): G2OrchWiringInput['pa'] => {
  const fn = async (walk: Record<string, unknown>): Promise<{ kind?: string }> => {
    sink?.push(walk)
    return { kind: 'allow' }
  }
  return Object.assign(fn, { closePlan: (_callId: string): void => undefined })
}
type OrchWalk = Record<string, unknown>

const fixtures = (pa: G2OrchWiringInput['pa']): { calls: OrchCall[], input: G2OrchWiringInput } => {
  const calls: OrchCall[] = []
  const workflow = mkNative('workflow', calls)
  const delegates: Record<string, OrchExecute> = { workflow: workflow.execute }
  const input: G2OrchWiringInput = {
    providerId: 'a5p5-plane',
    captured: Object.freeze({ workflow: Object.freeze({ native: workflow, definitionIdentity: 'wf-id-1' }) }),
    liveNative: (name: string): object | undefined => (name === 'workflow' ? workflow : undefined),
    workflowDelegates: delegates,
    liveWorkflowDelegates: (): Record<string, unknown> => delegates, // THE CONTAINER IDENTITY the adapter compares (a fresh copy is honest DELEGATE_DRIFT)
    placementFeed: (name: string) => (name === 'workflow' ? { definitionIdentity: 'wf-id-1', realmId: 'realm-orch' } : undefined),
    pa,
  }
  return { calls, input }
}
const execFor = (callId = 'orch-call-1'): Record<string, unknown> => ({ callId, agent: { id: 'a1' }, signal: new AbortController().signal })
const ARGS: Record<string, unknown> = { script: 'return 1', meta: { name: 'wf', description: 'd' } }

// NARROWING HELPERS (branches, not casts): the union and the unknown-face
// definitions of the .d.mts surface resolve through THESE, once.
const mustBuild = (built: G2OrchWiringOk | G2OrchWiringRefusal): G2OrchWiringOk => {
  if (built.ok !== true) throw new Error(`the wiring refused its own fixture: ${built.code} ${String(built.detail ?? built.message ?? '')}`)
  return built
}
const mustRefuse = (built: G2OrchWiringOk | G2OrchWiringRefusal): G2OrchWiringRefusal => {
  if (built.ok === true) throw new Error('the fixture expected a refusal')
  return built
}
const defExecute = (w: G2OrchWiringOk, name: string): OrchExecute => {
  const def = w.definitions.find((d) => d.name === name)
  if (def === undefined) throw new Error(`no definition '${name}'`)
  const fn: unknown = def.execute
  if (typeof fn !== 'function') throw new Error(`'${name}' answers no execute face`)
  return fn as OrchExecute // the ONE declared narrowing: Record face -> the tool's published (args, exec) => Promise law
}

describe('A5M2 B-ORCH execution consumer: outer PA governance over the ORIGINAL exec', () => {
  it('arms workflow ALWAYS from the registration capture; ralph without a capture is the adapter\'s honest DECLARED row (zero-flip untouched)', () => {
    const { input } = fixtures(allowPa())
    const w = mustBuild(createBOrchestrationExecutionWiring(input))
    expect(w.placementNames).toEqual(['workflow'])
    expect(w.declared.some((d) => d.name === 'ralph' && String(d.status).includes('DECLARED'))).toBe(true)
    expect(w.familyId).toBe('B-ORCHESTRATION')
  })
  it('the admit seat is OWNED: an admit input is refused outright', () => {
    const { input } = fixtures(allowPa())
    const w = mustRefuse(createBOrchestrationExecutionWiring({ ...input, admit: async () => ({ ok: true }) }))
    expect(w.code).toBe(A5_B_ORCH_WIRING_CODES.ADMISSION_SEAT_OWNED)
  })
  it('FAIL-CLOSED SAFETY BLOCK (root audit of 07bb0c95): every call refuses typed BEFORE the walk — zero PA consumption, zero body entry, the audit chain rides the refusal', async () => {
    const walks: OrchWalk[] = []
    const { input, calls } = fixtures(allowPa(walks))
    const w = mustBuild(createBOrchestrationExecutionWiring(input))
    const execute = defExecute(w, 'workflow')
    await expect(execute(ARGS, execFor())).rejects.toMatchObject({
      message: expect.stringContaining('P_B_ORCH_WIRE_CHILD_GOVERNANCE_UNGOVERNED'),
    })
    expect(walks.length, 'the PA funnel is never consumed for a call that cannot execute').toBe(0)
    expect(calls.length, 'the original body never enters').toBe(0)
    expect(w.walks()).toBe(0)
    await expect(execute(ARGS, execFor('c-detail'))).rejects.toMatchObject({
      message: expect.stringContaining('activationFence'),
    })
    await expect(execute(ARGS, execFor('c-detail2'))).rejects.toMatchObject({
      message: expect.stringContaining('agentSetup'),
    })
  })
  it('deny/throw/pre-aborted ALL meet the SAME fail-closed refusal first (no input reaches the walk machinery while the block stands)', async () => {
    const refusalPas: G2OrchWiringInput['pa'][] = [
      Object.assign(async (_walk: Record<string, unknown>): Promise<{ kind?: string, detail?: string }> => ({ kind: 'deny', detail: 'x' }), { closePlan: (_c: string): void => undefined }),
      Object.assign(async (_walk: Record<string, unknown>): Promise<never> => { throw new Error('funnel down') }, { closePlan: (_c: string): void => undefined }),
    ]
    for (const pa of refusalPas) {
      const { input, calls } = fixtures(pa)
      const w = mustBuild(createBOrchestrationExecutionWiring(input))
      await expect(defExecute(w, 'workflow')(ARGS, execFor('c2'))).rejects.toMatchObject({ message: expect.stringContaining('CHILD_GOVERNANCE_UNGOVERNED') })
      expect(calls.length).toBe(0)
    }
    const ac = new AbortController()
    ac.abort()
    const { input, calls } = fixtures(allowPa())
    const w = mustBuild(createBOrchestrationExecutionWiring(input))
    await expect(defExecute(w, 'workflow')(ARGS, { callId: 'c3', agent: { id: 'a1' }, signal: ac.signal })).rejects.toMatchObject({ message: expect.stringContaining('CHILD_GOVERNANCE_UNGOVERNED') })
    expect(calls.length).toBe(0)
  })
  it('NO READINESS PROOF BY REGISTRATION (root review of e4389610): a registered, isActive, self-declared-routed governed provider STILL meets the restored constant block — typed refusal, zero PA, zero body, zero active-call hand-off', async () => {
    const paCalls: OrchWalk[] = []
    const f = fixtures(allowPa(paCalls))
    const activeCalls = new WeakMap<object, Record<string, unknown>>()
    const w = mustBuild(createBOrchestrationExecutionWiring({
      ...f.input,
      governedProvider: { name: 'team-governed-spawn', isActive: (): boolean => true, activeCalls },
    }))
    const parentAgent = { id: 'agent-live-parent' }
    await expect(defExecute(w, 'workflow')(ARGS, { callId: 'ctx-gp-1', agent: parentAgent, signal: new AbortController().signal }))
      .rejects.toMatchObject({ message: expect.stringContaining('CHILD_GOVERNANCE_UNGOVERNED') })
    expect(f.calls.length, 'the block precedes everything: zero body entry even with a live provider').toBe(0)
    expect(paCalls.length, 'zero PA consumption').toBe(0)
    expect(activeCalls.has(parentAgent), 'the admitted-call hand-off never runs behind the block').toBe(false)
  })
  it('mount places on the REAL tools face with rollback handles; second mount refused; dispose drains FIRST and runs each disposer exactly once', async () => {
    const { input } = fixtures(allowPa())
    const w = mustBuild(createBOrchestrationExecutionWiring(input))
    const order: string[] = []
    const agentCtx = { tools: { register: (definition: { name: string }): (() => void) => () => order.push(`off:${definition.name}`) } }
    const placed = w.mount(agentCtx)
    expect(placed.ok).toBe(true)
    expect(String(w.mount(agentCtx).ok)).toBe('false')
    const d1 = w.dispose()
    expect(d1.disposers).toBe(1)
    expect(order).toEqual(['off:workflow'])
    const d2 = w.dispose()
    expect(String(d2.semantics)).toContain('already disposed')
    expect(order.length).toBe(1) // exactly once
    // post-dispose the fail-closed block stands FIRST (and independently of
    // it the drain law would refuse too): zero body entry either way
    await expect(defExecute(w, 'workflow')(ARGS, execFor('c4'))).rejects.toMatchObject({ message: expect.stringMatching(/CHILD_GOVERNANCE_UNGOVERNED|DRAINING/) })
  })
})
