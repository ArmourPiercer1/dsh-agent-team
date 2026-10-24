/**
 * A5M2 TGP real-chain supply (team-governed-provider.mjs after the root
 * C1/C2 rulings): the provider establishes children through the durable
 * fresh-member chain (childChain.ensureChild = the arm's wrapper over the
 * EXISTING childFactory + ensureLiveAgent + ensureMaterialized faces),
 * correlates PER-RUN BY CONSTRUCTION (no parentAgent WeakMap), derives the
 * child instance NAME deterministically from the PA-admitted child-call
 * identity inside the legal INSTANCE_ID_PATTERN namespace, and settles
 * ONLY through the frozen WorkDeliveryResult of the existing deliver
 * consumer. Author-side only: no boot, no Host, no engine.
 */
import { describe, it, expect } from 'vitest'
import { createTeamGovernedSubagentProvider, mapWorkDeliveryResult, childInstanceIdForAdmittedCall, A5_TGP_CODES } from '../src/plugin/live/governed-families/team-governed-provider.mjs'
import type { G2TgpInput, G2TgpProvider } from '../src/plugin/live/governed-families/team-governed-provider.d.mts'

const INSTANCE_ID_PATTERN = /^inst-[a-z0-9]{1,32}$/

const mustProvider = (built: G2TgpProvider & { ok?: undefined } | { ok: false, code: string, message: string }): G2TgpProvider => {
  if ('ok' in built && built.ok === false) throw new Error(`the factory refused its own harness: ${String(built.code)} ${String(built.message)}`)
  return built
}

const baseFactory = (): Record<string, unknown> => ({
  name: 'team-governed-spawn#r1',
  pa: Object.assign(async () => ({ kind: 'allow' }), { closePlan: (_c: string): void => undefined }),
  runContext: { callId: 'orch-call-1', parametersFingerprint: 'fp-parent-plan', realmId: 'realm-orch', toolName: 'workflow' },
  childChain: { ensureChild: async () => ({ childSessionId: 's', handle: {} }) },
  templateId: 'tpl-worker-1',
  settlement: {
    rootSessionId: 'team-root-1',
    workDelivery: { deliver: async () => ({ requestToken: 'x', status: 'succeeded', body: 'b' }) },
  },
})

const mkHarness = (opts: { paAnswer?: { kind?: string, cancelled?: boolean, detail?: string }, paThrows?: Error, childChainThrows?: Error, childChainAnswer?: Record<string, unknown> | null, settlement?: G2TgpInput['settlement'] | null, templateId?: string | null } = {}) => {
  const order: string[] = []
  const walked: Record<string, unknown>[] = []
  const ensured: Record<string, unknown>[] = []
  const delivered: Record<string, unknown>[] = []
  const parent = { id: 'member-sess-1' }
  const pa = Object.assign(async (walk: Record<string, unknown>) => {
    walked.push(walk)
    order.push('pa:walk')
    if (opts.paThrows !== undefined) throw opts.paThrows
    return opts.paAnswer ?? { kind: 'allow' }
  }, { closePlan: (callId: string) => { order.push(`closePlan:${callId}`) } })
  const childChain = {
    async ensureChild (args: Record<string, unknown>) {
      ensured.push(args)
      order.push('ensureChild:enter')
      if (opts.childChainThrows !== undefined) throw opts.childChainThrows
      if (opts.childChainAnswer === null) return {}
      return opts.childChainAnswer ?? {
        childSessionId: `sess-of-${String(args.instanceId).slice(5, 13)}`,
        handle: { agent: { id: `sess-of-${String(args.instanceId).slice(5, 13)}` }, dispose: async () => { order.push('handle:dispose') } },
      }
    },
  }
  const settlement = opts.settlement === null ? undefined : opts.settlement ?? {
    rootSessionId: 'team-root-1',
    workDelivery: {
      async deliver (args: Record<string, unknown>) {
        delivered.push(args)
        order.push('deliver:enter')
        return { requestToken: String(args.requestToken), status: 'succeeded', body: 'child settled' }
      },
    },
  }
  const factory = baseFactory()
  factory.pa = pa
  factory.childChain = childChain
  factory.settlement = settlement
  if (opts.templateId !== undefined) factory.templateId = opts.templateId ?? undefined
  const provider = mustProvider(createTeamGovernedSubagentProvider(factory as unknown as G2TgpInput))
  const request = { parent, signal: new AbortController().signal, prompt: [{ type: 'text', text: 'go' }] }
  return { provider, order, walked, ensured, delivered, request, parent }
}

describe('A5M2 TGP real-chain: PA before the durable chain, derived legal instance identity, settlement ONLY via the frozen DTO', () => {
  it('LAW 1 ADMISSION BEFORE CREATION: the walk (admitted callId#child-1) runs and ALLOWS before ensureChild; deny throws with ZERO children', async () => {
    const h = mkHarness()
    const run = await h.provider.start(h.request)
    expect(h.order.indexOf('pa:walk'), 'the PA walk runs first').toBeLessThan(h.order.indexOf('ensureChild:enter'))
    expect(h.walked[0]?.callId).toBe('orch-call-1#child-1')
    expect(String(h.walked[0]?.parametersFingerprint)).toContain('fp-parent-plan+child#1')
    const deny = mkHarness({ paAnswer: { kind: 'deny', detail: 'policy says no' } })
    await expect(deny.provider.start(deny.request)).rejects.toThrow(A5_TGP_CODES.DENIED)
    expect(deny.ensured.length, 'a deny creates nothing').toBe(0)
    expect(deny.delivered.length).toBe(0)
    const fault = mkHarness({ paThrows: new Error('funnel down') })
    await expect(fault.provider.start(fault.request)).rejects.toThrow(A5_TGP_CODES.PA_FAULT)
    expect(fault.order.some((o) => o.startsWith('closePlan:')), 'the refused plan is closed').toBe(true)
    expect(fault.ensured.length).toBe(0)
    expect(run.provider, 'the run names its governed provider').toBe('team-governed-spawn#r1')
  })
  it('LAW 3 PRECHECK: unbound settlement / empty prompt refuse BEFORE anything (zero PA, zero child); the factory refuses stand-ins for every real seam', async () => {
    // an unbound settlement is now a FACTORY-level refusal (the seam is
    // REQUIRED at the real-chain face) — the loop below pins every seam;
    // at start level only the prompt precheck remains BEFORE the admission.
    const noPrompt = mkHarness()
    await expect(noPrompt.provider.start({ parent: noPrompt.parent, prompt: [] })).rejects.toThrow(A5_TGP_CODES.DELIVERY_UNBOUND)
    expect(noPrompt.walked.length).toBe(0)
    for (const key of ['pa', 'runContext', 'childChain', 'templateId', 'settlement']) {
      const base = baseFactory()
      delete base[key]
      const built = createTeamGovernedSubagentProvider(base as unknown as G2TgpInput)
      expect(built.ok, `${key} REQUIRED`).toBe(false)
    }
  })
  it('LAW 2 DURABLE CHAIN: the child instance is the DETERMINISTIC derivation of the admitted child-call identity in the legal namespace (per-ordinal distinct, reproducible, NEVER the parent instance); the chain rides root/template/parent verbatim; a chain fault establishes nothing and delivers nothing', async () => {
    const h = mkHarness()
    const run = await h.provider.start(h.request)
    const e = h.ensured[0] as Record<string, unknown>
    expect(e.rootSessionId).toBe('team-root-1')
    expect(e.templateId).toBe('tpl-worker-1')
    expect(e.parentAgent === undefined, 'the REAL chain request carries NO parentAgent (attribution waits for root\'s identity contract — no drop-pretense)').toBe(true)
    expect(e.agentOptions === undefined && e.signal === undefined, 'no dropped fields ride the chain request either').toBe(true)
    expect(e.admittedCallId, 'the routing/lifecycle install identity rides (a reversible audit id, not a grant)').toBe('orch-call-1#child-1')
    expect(String(e.instanceId)).toMatch(INSTANCE_ID_PATTERN)
    expect(String(e.instanceId), 'the parent instance is NEVER reused as the child').not.toBe('member-inst-1')
    expect(String(e.instanceId), 'deterministic from the ADMITTED identity, no UUID').toBe(childInstanceIdForAdmittedCall('team-root-1', 'orch-call-1#child-1'))
    const again = mkHarness()
    await again.provider.start(again.request)
    expect((again.ensured[0] as Record<string, unknown>).instanceId, 'same admitted call => same durable name (the chain resumable law)').toBe(e.instanceId)
    const second = mkHarness()
    await second.provider.start(second.request)
    await second.provider.start(second.request)
    const ids = second.ensured.map((x) => String(x.instanceId))
    expect(new Set(ids).size, 'ordinals are distinct durable children').toBe(2)
    const fault = mkHarness({ childChainThrows: new Error('row commit exploded') })
    await expect(fault.provider.start(fault.request)).rejects.toThrow(A5_TGP_CODES.CREATE_FAULT)
    expect(fault.delivered.length, 'an unestablished child delivers nothing').toBe(0)
    expect(fault.order.some((o) => o.startsWith('closePlan:'))).toBe(true)
    const nameless = mkHarness({ childChainAnswer: null })
    await expect(nameless.provider.start(nameless.request)).rejects.toThrow(A5_TGP_CODES.CREATE_FAULT)
    expect(run.runId, 'the run rides the established child session').toBe(`sess-of-${String(e.instanceId).slice(5, 13)}`)
  })
  it('LAW 4 SETTLEMENT: deliver rides (root, DERIVED instance, childSession, echoed token, prompt); succeeded+body maps to completed ContentBlocks; failed/unavailable NEVER success; the DTO law holds; dispose releases the live handle', async () => {
    const h = mkHarness()
    const run = await h.provider.start(h.request)
    const d = h.delivered[0] as Record<string, unknown>
    const settledInstance = String((h.ensured[0] as Record<string, unknown>).instanceId)
    expect([d.rootSessionId, d.instanceId, d.childSessionId, d.prompt]).toEqual(['team-root-1', settledInstance, run.runId, 'go'])
    expect(typeof d.requestToken).toBe('string')
    expect(await run.result).toEqual({ output: [{ type: 'text', text: 'child settled' }], isError: false, stopReason: 'completed' })
    await run.dispose()
    expect(h.order).toContain('handle:dispose')
  })
  it('THE DTO LAW directly: succeeded-empty / failed / unavailable / unknown / mismatched echo all fail closed; only succeeded+non-empty maps', () => {
    expect(() => mapWorkDeliveryResult({ requestToken: 't1', status: 'succeeded', body: '' }, 't1')).toThrow(A5_TGP_CODES.DELIVERY_UNAVAILABLE)
    expect(() => mapWorkDeliveryResult({ requestToken: 't1', status: 'succeeded' }, 't1')).toThrow(A5_TGP_CODES.DELIVERY_UNAVAILABLE)
    let e1: Error | undefined
    try { mapWorkDeliveryResult({ requestToken: 't1', status: 'failed', error: { code: 'TURN_FAILED', message: 'boom' } }, 't1') } catch (e) { e1 = e as Error }
    expect(String(e1?.message)).toContain('TURN_FAILED')
    expect(String(e1?.message)).toContain('boom')
    expect(() => mapWorkDeliveryResult({ requestToken: 't1', status: 'unavailable', error: { code: 'NO_BODY', message: 'x' } }, 't1')).toThrow(A5_TGP_CODES.DELIVERY_UNAVAILABLE)
    expect(() => mapWorkDeliveryResult({ requestToken: 't1', status: 'settled' }, 't1')).toThrow(A5_TGP_CODES.DELIVERY_STATUS_UNKNOWN)
    expect(() => mapWorkDeliveryResult({ requestToken: 'other', status: 'succeeded', body: 'x' }, 't1')).toThrow(A5_TGP_CODES.DELIVERY_UNCORRELATED)
    expect(mapWorkDeliveryResult({ requestToken: 't1', status: 'succeeded', body: 'ok' }, 't1')).toEqual({ output: [{ type: 'text', text: 'ok' }], isError: false, stopReason: 'completed' })
  })
  it('CAPABILITIES HONESTY + identity laws: undeclared capabilities typed-refuse with zero PA/child; childInstanceIdForAdmittedCall is the ONE namespace and differs across admitted identities; no parent, no child', async () => {
    const h = mkHarness()
    expect(h.provider.capabilities.outputSchema).toBe(false)
    expect(h.provider.capabilities.depthLimit).toBe(false)
    expect(h.provider.capabilities.agentOptions, 'the chain face takes no agentOptions — declared FALSE, refused, never silently dropped').toBe(false)
    await expect(h.provider.start({ ...h.request, agentOptions: { tools: ['read'] } })).rejects.toThrow(A5_TGP_CODES.UNSUPPORTED_CAPABILITY)
    await expect(h.provider.start({ ...h.request, outputSchema: { type: 'object' } })).rejects.toThrow(A5_TGP_CODES.UNSUPPORTED_CAPABILITY)
    expect(h.walked.length).toBe(0)
    expect(h.ensured.length).toBe(0)
    expect(childInstanceIdForAdmittedCall('root-a', 'c#child-1')).toMatch(INSTANCE_ID_PATTERN)
    expect(childInstanceIdForAdmittedCall('root-a', 'c#child-1')).toBe(childInstanceIdForAdmittedCall('root-a', 'c#child-1'))
    expect(childInstanceIdForAdmittedCall('root-a', 'c#child-1')).not.toBe(childInstanceIdForAdmittedCall('root-b', 'c#child-1'))
    const noParent = mkHarness()
    await expect(noParent.provider.start({ prompt: [{ type: 'text', text: 'x' }] })).rejects.toThrow(A5_TGP_CODES.NO_PARENT_CONTEXT)
  })
})
