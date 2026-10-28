/**
 * U7-F C1 — the AGENT-CONTROL family over the REAL chain: plane mount →
 * FamilyAssembly seam → the seven governed rows (subagent, subagent_fork,
 * send_message, interrupt_agent, list_agents, list_subagent_models,
 * workflow) over a FAKE agent-runtime port that records EVERY call it
 * receives. The template law is `u7-9a-fs-mutation-c1.test.ts` (same
 * harness, same honesty discipline): the observe line
 * `agent-control-<row> RAN` appears ONLY when the port leg actually ran;
 * every refusal leg pairs the typed ANSWER with a PORT FACT (the fake's
 * recorded call list — zero entries means zero reach), never with a guard
 * light alone.
 *
 * THE U7-F LAWS THIS SUITE PINS:
 *  (a) enumeration ⊄ mutation — the DIRECT arm captures the ACTUAL PA
 *      requested-effect sets: the two enumeration rows carry ONLY
 *      tool-invoke + meta arms (never the domain-ref authority arm, and
 *      no mutation-shaped argument can enter through their closed
 *      grammar); the five mutation rows carry tool-invoke +
 *      domain-ref(dsh-agent-runtime), with the SAME constant the
 *      contribution declares (pinned equal here).
 *  (b) no amplification — a spawn/fork child route/tool/continuable arm
 *      outside the caller's own authority is refused BEFORE the PA edge
 *      and the fake spawner records ZERO spawn calls; a mount with no
 *      caller-authority snapshot spawns nothing (fail closed).
 *  (c) workflow ⊆ declared — the workflow driver reaches children ONLY
 *      through the executor's caller-bound delegates; an amplifying step
 *      is refused by the delegate and the fake records ZERO spawnChild
 *      calls under that workflow.
 *  (d) owner fence — send/interrupt targets outside the caller's own
 *      scope (structurally foreign, or off the durable roster) refuse
 *      typed with ZERO port calls; no roster → zero steer/interrupt
 *      (fail closed); the fence runs BEFORE the Control ask (the
 *      control-leg audit proves no Control row was opened).
 *  (e) fork context is DATA — a context source that smuggles
 *      authority-shaped keys refuses typed with zero fork; the positive
 *      fork carries the inherit-data marker and nothing that looks like
 *      a grant.
 * Plus: closed argument grammar (unknown fields refused whole), the
 * default-deny posture of the closed rule grammar (typed refusal, zero
 * port), the ONE-SHOT exec-token law (a settled token never spawns
 * twice — the second call refuses and the port stays at one call), the
 * deny-lane and cancelled PA arms (zero port), the zero-flip mount gate
 * (no agentControlEnabled ⇒ no rows at all), and the closed-schema
 * validation of the family contribution.
 */
import { describe, it, expect } from 'vitest'
import { approvingControlLeg, denyingControlLeg } from './a5-m1-control-legs.mjs'

const REALM = 'u7f-c1-realm'
const INSTANCE = 'u7f-instance'
const SCOPE_KEY = `${REALM}:${INSTANCE}`

interface PortCall { leg: string; caller?: Record<string, unknown>; spec?: Record<string, unknown>; targetId?: string; [k: string]: unknown }
interface FakePort {
  calls: PortCall[]
  callsFor: (leg: string) => PortCall[]
  listAgents: (c: Record<string, unknown>) => Promise<unknown>
  listModels: (c: Record<string, unknown>) => Promise<unknown>
  spawnChild: (c: Record<string, unknown>) => Promise<unknown>
  forkChild: (c: Record<string, unknown>) => Promise<unknown>
  steer: (c: Record<string, unknown>) => Promise<unknown>
  interrupt: (c: Record<string, unknown>) => Promise<unknown>
  runWorkflow: (c: Record<string, unknown>) => Promise<unknown>
}

const makeFakeRuntime = (opts: { workflowSteps?: Array<Record<string, unknown>> } = {}): FakePort => {
  const calls: PortCall[] = []
  const rec = (leg: string, args: Record<string, unknown>): PortCall => {
    const call: PortCall = { leg, ...args }
    calls.push(call)
    return call
  }
  return {
    calls,
    callsFor: (leg) => calls.filter((c) => c.leg === leg),
    listAgents: async (c) => { rec('listAgents', c); return [{ kind: 'child', id: 'member-alpha', label: 'alpha', status: 'running' }, { kind: 'child', id: 'member-beta', label: 'beta', status: 'inactive' }] },
    listModels: async (c) => { rec('listModels', c); return 'prov-a/model-1 — model-1' },
    spawnChild: async (c) => { rec('spawnChild', c); return { kind: 'foreground', runId: 'child-run-1', output: [{ type: 'text', text: 'child-1' }] } },
    forkChild: async (c) => { rec('forkChild', c); return { kind: 'foreground', runId: 'fork-run-1', output: [{ type: 'text', text: 'fork-1' }] } },
    steer: async (c) => { rec('steer', c); return { messageId: 'message-1' } },
    interrupt: async (c) => { rec('interrupt', c); return { accepted: true } },
    runWorkflow: async (c) => {
      rec('runWorkflow', c)
      const driver = c as unknown as { script: unknown; spawn: (s: Record<string, unknown>) => Promise<Record<string, unknown> | null>; steer: (s: Record<string, unknown>) => Promise<Record<string, unknown> | null>; enumerate: () => Promise<unknown> }
      const steps = opts.workflowSteps ?? [{ op: 'enumerate' }, { op: 'spawn', description: 'd', prompt: 'p' }]
      const results: Array<Record<string, unknown>> = []
      for (const [i, step] of steps.entries()) {
        let r: Record<string, unknown> | null = null
        if (step.op === 'spawn') r = await driver.spawn(step)
        else if (step.op === 'steer') r = await driver.steer(step)
        else r = (await driver.enumerate()) as Record<string, unknown>
        results.push({ step: i, r: r ?? { refused: true } })
        if (r !== null && typeof r === 'object' && r.ok === false) break
      }
      return { kind: 'foreground', runId: 'workflow-run-1', agentsStarted: results.length, result: { steps: results } }
    },
  }
}

const CALLER_AUTHORITY = { providers: ['prov-a'], models: ['model-1', 'model-2'], tools: ['read', 'grep'], continuable: true }
const AGENT_SCOPE = { scopeKey: SCOPE_KEY, members: ['member-alpha', 'member-beta'] }

interface Definition { name: string; execute: (raw: unknown, exec?: Record<string, unknown>) => Promise<Record<string, unknown>> }
interface PlaneValue { definitions: ReadonlyArray<Definition>; ownNames: readonly string[]; mount: (agentCtx: Record<string, unknown>) => { dispose: () => void } }
type Built = { ok: true; value: PlaneValue } | { ok: false; code: string; message?: string }

let row: { createTeamToolPlaneAssembly: (input: Record<string, unknown>) => Built }
const loadRow = async () => {
  if (!row) row = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as typeof row
  return row
}

const policyFor = (over: Record<string, unknown> = {}) => ({
  default: 'ask',
  allow: [],
  ask: [],
  deny: [],
  ...over,
})

interface BuildOpts {
  planeCfg?: Record<string, unknown>
  injected?: Record<string, unknown>
  /** The plane's controlLeg port; typed loosely so the shared JSDoc legs
   *  (a5-m1-control-legs.mjs) stay assignable (the u7-9a convention). */
  controlLeg?: unknown
  observe?: string[]
  policy?: Record<string, unknown>
}

async function buildAC(opts: BuildOpts = {}): Promise<PlaneValue> {
  const built = (await loadRow()).createTeamToolPlaneAssembly({
    dispatcherLifecycle: { inflight: () => 0 },
    teamSessionId: 'u7f-test-team-root',
    permissionPolicy: opts.policy ?? policyFor(),
    realmId: REALM,
    templateId: 'u7f-tpl',
    role: 'member',
    instanceId: INSTANCE,
    onObserve: (r: unknown) => { (opts.observe ?? []).push(String(r)) },
    fs: { subtreeContains: ({ parent, child }: { parent: string; child: string }) => child === parent || child.startsWith(parent + '/') },
    plane: { agentControlEnabled: true, ...(opts.planeCfg ?? {}) },
    ...(opts.injected === undefined ? {} : { backends: opts.injected }),
    ...(opts.controlLeg === undefined ? {} : { controlLeg: opts.controlLeg }),
  })
  if (built.ok !== true) throw new Error(`plane mount refused: ${built.code} ${built.message ?? ''}`)
  return built.value
}

const def = (plane: PlaneValue, name: string): Definition => {
  const d = plane.definitions.find((x) => x.name === name)
  if (d === undefined) throw new Error(`no ${name} definition`)
  return d
}
const attempt = async (fn: () => Promise<unknown>): Promise<{ ok: true; value: Record<string, unknown> } | { ok: false; msg: string }> => {
  try { return { ok: true as const, value: await fn() as Record<string, unknown> } }
  catch (e) { return { ok: false as const, msg: String((e as Error)?.message ?? e) } }
}
const ran = (observe: string[], rowName: string) => observe.filter((l) => l.includes(`agent-control-${rowName} RAN`))
const trustedInjected = (fake: FakePort, extra: Record<string, unknown> = {}): Record<string, unknown> => ({
  agentRuntime: fake,
  agentScope: AGENT_SCOPE,
  callerAuthority: CALLER_AUTHORITY,
  ...extra,
})

// ─────────────────────────────────────────────────────────────────────────
describe('u7-f C1 authority refusal confidentiality', () => {
  it('does not echo unauthorized provider or model sentinels in list-models refusals', async () => {
    const { createHostAgentRuntimePort } = await import(new URL('../../tools/agent-control-family/src/agent-runtime-port.mjs', import.meta.url).href) as { createHostAgentRuntimePort: (input: Record<string, unknown>) => Record<string, unknown> }
    const providerSentinel = 'unauthorized-provider-sentinel'
    const modelSentinel = 'unauthorized-model-sentinel'
    const port = createHostAgentRuntimePort({
      caller: {},
      callerAuthority: { providers: ['allowed-provider'], models: ['allowed-model'] },
      hostService: (name: string) => name === 'llm' ? {
        listProviders: () => [],
        listModels: async () => [],
        resolveModelInfo: async () => ({ id: 'allowed-model', name: 'allowed-model', reasoning: { efforts: [] } }),
      } : undefined,
    })
    const listModels = (port as { legResolver: (leg: string) => ((input: Record<string, unknown>) => Promise<unknown>) | null }).legResolver('listModels')
    if (listModels === null) throw new Error('listModels leg was not wired')
    const providerRefusal = await listModels({ provider: providerSentinel })
    const modelRefusal = await listModels({ provider: 'allowed-provider', model: modelSentinel })
    for (const refusal of [providerRefusal, modelRefusal]) {
      expect(refusal).toMatchObject({ ok: false, code: 'agent-runtime-authority-refused' })
      expect(JSON.stringify(refusal)).not.toContain(providerSentinel)
      expect(JSON.stringify(refusal)).not.toContain(modelSentinel)
    }
  })
})

describe('u7-f C1 mount gate — the zero-flip law and the seven claims', () => {
  it('AC-1 gate ABSENT: zero rows, zero flip (the native agent-control tools ride untouched)', async () => {
    const plane = await buildAC({ planeCfg: { agentControlEnabled: undefined } })
    for (const n of ['subagent', 'subagent_fork', 'send_message', 'interrupt_agent', 'list_agents', 'list_subagent_models', 'workflow']) {
      expect(plane.definitions.some((d) => d.name === n), n).toBe(false)
      expect(plane.ownNames).not.toContain(n)
    }
  })

  it('AC-2 gate TRUE: all seven rows mount as ONE family claim set', async () => {
    const fake = makeFakeRuntime()
    const plane = await buildAC({ injected: trustedInjected(fake) })
    for (const n of ['subagent', 'subagent_fork', 'send_message', 'interrupt_agent', 'list_agents', 'list_subagent_models', 'workflow']) {
      expect(plane.ownNames, n).toContain(n)
      expect(plane.definitions.some((d) => d.name === n), n).toBe(true)
    }
  })

  it('AC-3 non-boolean gate: the seam refuses the mount (a config defect, never a silent default)', async () => {
    const built = (await loadRow()).createTeamToolPlaneAssembly({
      dispatcherLifecycle: { inflight: () => 0 },
      teamSessionId: 'u7f-test-team-root',
      permissionPolicy: policyFor(),
      realmId: REALM, templateId: 'u7f-tpl', role: 'member', instanceId: INSTANCE,
      onObserve: () => {},
      fs: { subtreeContains: () => true },
      plane: { agentControlEnabled: 'yes' },
    })
    expect(built.ok).toBe(false)
    if (built.ok === false) expect(built.code).toContain('PLANE_CONFIG_INCOMPLETE')
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('u7-f C1 positives — every governed leg RANS through the fake port (observed, not assumed)', () => {
  const approve = async (opts: { injected?: Record<string, unknown>; steps?: Array<Record<string, unknown>> } = {}) => {
    const observe: string[] = []
    const fake = makeFakeRuntime(opts.steps === undefined ? {} : { workflowSteps: opts.steps })
    const audit: string[] = []
    const plane = await buildAC({
      observe,
      controlLeg: approvingControlLeg(audit),
      injected: opts.injected ?? trustedInjected(fake),
    })
    return { plane, fake, observe, audit }
  }

  it('AC-10 list_agents POSITIVE: enumeration RAN through the port once; the caller is mount-trusted', async () => {
    const { plane, fake, observe } = await approve()
    const r = await attempt(() => def(plane, 'list_agents').execute({}))
    expect(r.ok).toBe(true)
    expect(fake.callsFor('listAgents')).toHaveLength(1)
    expect(fake.callsFor('listAgents')[0]?.caller).toMatchObject({ realmId: REALM, instanceId: INSTANCE })
    expect(ran(observe, 'list_agents')).toHaveLength(1)
    // enumeration never touches a mutation face:
    expect(fake.calls.filter((c) => ['spawnChild', 'forkChild', 'steer', 'interrupt'].includes(c.leg))).toHaveLength(0)
  })

  it('AC-11 list_subagent_models POSITIVE: route enumeration RAN once', async () => {
    const { plane, fake, observe } = await approve()
    const r = await attempt(() => def(plane, 'list_subagent_models').execute({ provider: 'prov-a' }))
    expect(r.ok).toBe(true)
    expect(fake.callsFor('listModels')).toHaveLength(1)
    expect(fake.callsFor('listModels')[0]?.provider).toBe('prov-a')
    expect(ran(observe, 'list_subagent_models')).toHaveLength(1)
  })

  it('AC-12 subagent POSITIVE: a within-authority spawn spawns through the port exactly once', async () => {
    const { plane, fake, observe } = await approve()
    const r = await attempt(() => def(plane, 'subagent').execute({ description: 'task', prompt: 'do it', provider: 'prov-a', model: 'model-1' }))
    expect(r.ok).toBe(true)
    expect(fake.callsFor('spawnChild')).toHaveLength(1)
    const call = fake.callsFor('spawnChild')[0]
    expect(call?.spec).toMatchObject({ description: 'task', prompt: 'do it' })
    expect((call?.caller as Record<string, unknown>)?.realmId).toBe(REALM)
    expect(ran(observe, 'subagent')).toHaveLength(1)
  })

  it('AC-13 subagent_fork POSITIVE: the child receives INHERIT-DATA context, never an authority object', async () => {
    const { plane, fake, observe } = await approve()
    const r = await attempt(() => def(plane, 'subagent_fork').execute({ description: 'continue', prompt: 'build on it' }))
    expect(r.ok).toBe(true)
    const call = fake.callsFor('forkChild')[0]
    expect(call?.context).toEqual({ kind: 'inherit-mount-conversation' })
    expect(JSON.stringify(call ?? {})).not.toMatch(/"(grant|approval|permission|tokenKey)"/)
    expect(ran(observe, 'subagent_fork')).toHaveLength(1)
  })

  it('AC-14 send_message POSITIVE (in-roster target): the steer leg RAN once', async () => {
    const { plane, fake, observe } = await approve()
    const r = await attempt(() => def(plane, 'send_message').execute({ agent_id: 'member-alpha', message: 'hello' }))
    expect(r.ok).toBe(true)
    expect(fake.callsFor('steer')).toHaveLength(1)
    expect(fake.callsFor('steer')[0]?.targetId).toBe('member-alpha')
    expect(ran(observe, 'send_message')).toHaveLength(1)
  })

  it('AC-15 interrupt_agent POSITIVE (in-roster target): the interrupt leg RAN once', async () => {
    const { plane, fake, observe } = await approve()
    const r = await attempt(() => def(plane, 'interrupt_agent').execute({ agent_id: 'member-beta', reason: 'budget' }))
    expect(r.ok).toBe(true)
    expect(fake.callsFor('interrupt')).toHaveLength(1)
    expect(ran(observe, 'interrupt_agent')).toHaveLength(1)
  })

  it('AC-16 workflow POSITIVE: the driver spawns only through the caller-bound delegate (one observed spawnChild)', async () => {
    const { plane, fake, observe } = await approve()
    const r = await attempt(() => def(plane, 'workflow').execute({ description: 'orchestrate', prompt: 'fan out' }))
    expect(r.ok).toBe(true)
    expect(fake.callsFor('runWorkflow')).toHaveLength(1)
    expect(fake.callsFor('spawnChild')).toHaveLength(1) // the in-authority scripted step
    const sc = fake.callsFor('spawnChild')[0]
    expect((sc?.spec as Record<string, unknown>)?.viaWorkflow).toBeTruthy()
    expect(ran(observe, 'workflow')).toHaveLength(1)
  })
})

// ─────────────────────────────────────────────────────────────────────────
describe('u7-f C1 refusals — typed answers with ZERO port calls (the fake records nothing)', () => {
  const setup = async (opts: { injected?: Record<string, unknown> | undefined; policy?: Record<string, unknown>; controlLeg?: unknown; steps?: Array<Record<string, unknown>> } = {}) => {
    const fake = makeFakeRuntime(opts.steps === undefined ? {} : { workflowSteps: opts.steps })
    const audit: string[] = []
    const plane = await buildAC({
      ...(opts.policy === undefined ? {} : { policy: opts.policy }),
      ...(opts.controlLeg === undefined ? { controlLeg: approvingControlLeg(audit) } : { controlLeg: opts.controlLeg }),
      ...(opts.injected === undefined ? { injected: trustedInjected(fake) } : { injected: opts.injected }),
    })
    return { plane, fake, audit }
  }

  it('AC-20 FOREIGN-scope send_message: typed refusal, zero port, ZERO Control row opened (fence before PA)', async () => {
    const { plane, fake, audit } = await setup()
    const r = await attempt(() => def(plane, 'send_message').execute({ agent_id: 'other-scope:agent-9', message: 'x' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toContain('agent-control-scope-foreign')
    expect(fake.calls).toHaveLength(0)
    expect(audit).toHaveLength(0) // nothing reached the Control ask
  })

  it('AC-21 FOREIGN-scope interrupt: typed refusal, zero reach', async () => {
    const { plane, fake, audit } = await setup()
    const r = await attempt(() => def(plane, 'interrupt_agent').execute({ agent_id: 'other-scope:agent-9' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toContain('agent-control-scope-foreign')
    expect(fake.calls).toHaveLength(0)
    expect(audit).toHaveLength(0)
  })

  it('AC-22 off-roster bare target: scope-foreign refusal with zero port (roster is trusted data, never a probe)', async () => {
    const { plane, fake } = await setup()
    const r = await attempt(() => def(plane, 'send_message').execute({ agent_id: 'not-my-agent', message: 'x' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toContain('agent-control-scope-foreign')
    expect(fake.calls).toHaveLength(0)
  })

  it('AC-23 no roster wired: steer/interrupt FAIL CLOSED (membership unprovable = membership not held), zero port', async () => {
    const fake = makeFakeRuntime()
    const { plane } = await setup({ injected: { agentRuntime: fake, callerAuthority: CALLER_AUTHORITY } })
    const r = await attempt(() => def(plane, 'interrupt_agent').execute({ agent_id: 'member-alpha' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toContain('agent-control-scope-unresolved')
    expect(fake.calls).toHaveLength(0)
  })

  it('AC-24 AMPLIFYING spawn (provider outside the caller): typed refusal, ZERO spawnChild', async () => {
    const { plane, fake, audit } = await setup()
    const r = await attempt(() => def(plane, 'subagent').execute({ description: 'd', prompt: 'p', provider: 'forbidden-provider' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toContain('agent-control-amplification-refused')
    expect(fake.calls).toHaveLength(0)
    expect(audit).toHaveLength(0) // refused before the PA edge: no grant was ever asked
  })

  it('AC-25 AMPLIFYING continuable child (caller not continuable): refused, zero spawn', async () => {
    const fake = makeFakeRuntime()
    const { plane } = await setup({ injected: trustedInjected(fake, { callerAuthority: { providers: ['prov-a'], continuable: false } }) })
    const r = await attempt(() => def(plane, 'subagent').execute({ description: 'd', prompt: 'p', run_in_background: true }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toContain('agent-control-amplification-refused')
    expect(fake.calls).toHaveLength(0)
  })

  // AC-1 (design F3(a)): the production build no longer runs with NO
  // snapshot — it runs under the build-time TIER A CEILING (a ceiling ≤ every
  // caller: no route override, no tools, one-shot). The fail-closed law now
  // applies to a snapshot that is present but NOT a bounded record.
  it('AC-26a no injected snapshot ⇒ the Tier A ceiling admits a route-free spawn (the ceiling is a ceiling, not an absence)', async () => {
    const fake = makeFakeRuntime()
    const { plane } = await setup({ injected: { agentRuntime: fake, agentScope: AGENT_SCOPE } })
    const r = await attempt(() => def(plane, 'subagent').execute({ description: 'd', prompt: 'p' }))
    expect(r.ok).toBe(true)
    expect(fake.callsFor('spawnChild')).toHaveLength(1)
  })

  it('AC-26b a NON-RECORD caller-authority snapshot fails closed: typed refusal, zero port', async () => {
    const fake = makeFakeRuntime()
    const { plane } = await setup({ injected: { agentRuntime: fake, agentScope: AGENT_SCOPE, callerAuthority: 'not-a-record' } })
    const r = await attempt(() => def(plane, 'subagent').execute({ description: 'd', prompt: 'p' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toContain('agent-control-amplification-refused')
    expect(fake.calls).toHaveLength(0)
  })

  it('AC-26c the Tier A ceiling REFUSES every route/effort/background arm (no provider/model/effort/tools, one-shot)', async () => {
    for (const arm of [{ provider: 'prov-a' }, { model: 'model-1' }, { reasoning_effort: 'high' }, { run_in_background: true }]) {
      const fake = makeFakeRuntime()
      const { plane } = await setup({ injected: { agentRuntime: fake, agentScope: AGENT_SCOPE } })
      const r = await attempt(() => def(plane, 'subagent').execute({ description: 'd', prompt: 'p', ...arm }))
      expect(r.ok, JSON.stringify(arm)).toBe(false)
      if (!r.ok) expect(r.msg).toContain('agent-control-amplification-refused')
      expect(fake.calls, JSON.stringify(arm)).toHaveLength(0)
    }
  })

  it('AC-27 WORKFLOW amplifying step (law (c)): the delegate refuses and the fake records ZERO spawnChild under the workflow', async () => {
    const { plane, fake } = await setup({ steps: [{ op: 'spawn', description: 'd', prompt: 'p', provider: 'forbidden-provider' }] })
    const r = await attempt(() => def(plane, 'workflow').execute({ description: 'orchestrate', prompt: 'fan out' }))
    // The workflow call itself was admitted (its declared domain-ref arm
    // covers spawn); the STEP refused inside the caller-bound delegate:
    expect(r.ok).toBe(true)
    const steps = (r.ok ? ((r.value as { result?: { steps?: Array<{ r?: { ok?: boolean; code?: string } }> } }).result?.steps ?? []) : [])
    expect(steps[0]?.r?.code).toBe('agent-control-amplification-refused')
    expect(fake.callsFor('spawnChild')).toHaveLength(0)
    expect(fake.calls.filter((c) => c.leg === 'runWorkflow')).toHaveLength(1)
  })

  it('AC-28 fork context carrying AUTHORITY-SHAPED keys (law (e)): refused, zero fork', async () => {
    const fake = makeFakeRuntime()
    const { plane } = await setup({
      injected: trustedInjected(fake, { forkContextProvider: () => ({ transcript: 'data…', grant: 'g-1', approvals: ['a'] }) }),
    })
    const r = await attempt(() => def(plane, 'subagent_fork').execute({ description: 'd', prompt: 'p' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toContain('agent-control-context-authority-refused')
    expect(fake.calls).toHaveLength(0)
  })

  it('AC-29 closed grammar: an unknown field is refused WHOLE (zero port) — on a mutation row AND on an enumeration row (mutation-shaped request cannot enter)', async () => {
    const { plane, fake } = await setup()
    const m = await attempt(() => def(plane, 'subagent').execute({ description: 'd', prompt: 'p', escalate: true }))
    expect(m.ok).toBe(false)
    if (!m.ok) expect(m.msg).toContain('agent-control-schema-refused')
    const e = await attempt(() => def(plane, 'list_agents').execute({ agent_id: 'member-alpha', message: 'shaped-like-a-steer' }))
    expect(e.ok).toBe(false)
    if (!e.ok) expect(e.msg).toContain('agent-control-schema-refused')
    expect(fake.calls).toHaveLength(0)
  })

  it('AC-30 default-DENY template: every row answers the typed rule-grammar refusal with zero port', async () => {
    const { plane, fake } = await setup({ policy: policyFor({ default: 'deny' }) })
    for (const [name, args] of [
      ['list_agents', {}], ['subagent', { description: 'd', prompt: 'p' }],
      ['send_message', { agent_id: 'member-alpha', message: 'x' }],
    ] as Array<[string, Record<string, unknown>]>) {
      const r = await attempt(() => def(plane, name).execute(args))
      expect(r.ok, name).toBe(false)
      if (!r.ok) expect(r.msg, name).toContain('template-default-deny')
    }
    expect(fake.calls).toHaveLength(0)
  })

  it('AC-31 ask lane with NO control leg: no fake approval is invented — typed refusal, zero port', async () => {
    const fake = makeFakeRuntime()
    const plane = await buildAC({ injected: trustedInjected(fake) })
    const r = await attempt(() => def(plane, 'subagent').execute({ description: 'd', prompt: 'p' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toContain('APPROVAL_REQUEST_UNAVAILABLE')
    expect(fake.calls).toHaveLength(0)
  })

  it('AC-32 ONE-SPAWN law: the same exec token spawns ONCE; the replayed call refuses and the port stays at one call', async () => {
    const { plane, fake } = await setup()
    const first = await attempt(() => def(plane, 'subagent').execute({ description: 'd', prompt: 'p' }, { tokenKey: 'exec-token-1' }))
    expect(first.ok).toBe(true)
    const second = await attempt(() => def(plane, 'subagent').execute({ description: 'd', prompt: 'p' }, { tokenKey: 'exec-token-1' }))
    expect(second.ok).toBe(false)
    if (!second.ok) expect(second.msg).toContain('agent-control-replay-refused')
    expect(fake.callsFor('spawnChild')).toHaveLength(1)
  })

  it('AC-33 a different exec token is a different execution: it spawns again (the ledger keys executions, not tools)', async () => {
    const { plane, fake } = await setup()
    const a = await attempt(() => def(plane, 'interrupt_agent').execute({ agent_id: 'member-alpha' }, { tokenKey: 'tk-a' }))
    const b = await attempt(() => def(plane, 'interrupt_agent').execute({ agent_id: 'member-alpha' }, { tokenKey: 'tk-b' }))
    expect(a.ok).toBe(true)
    expect(b.ok).toBe(true)
    expect(fake.callsFor('interrupt')).toHaveLength(2)
  })

  it('AC-34 DENY control leg: the PA denial settles before the body — typed refusal, zero port', async () => {
    const fake = makeFakeRuntime()
    const audit: string[] = []
    const plane = await buildAC({ controlLeg: denyingControlLeg(audit), injected: trustedInjected(fake) })
    const r = await attempt(() => def(plane, 'subagent').execute({ description: 'd', prompt: 'p' }))
    expect(r.ok).toBe(false)
    expect(fake.calls).toHaveLength(0)
    expect(audit.length).toBeGreaterThan(0) // the ask really opened and really denied
  })

  it('AC-35 cancel-before-body: an aborted signal settles cancelled — zero port', async () => {
    const { plane, fake } = await setup()
    const ac = new AbortController()
    ac.abort()
    const r = await attempt(() => def(plane, 'send_message').execute({ agent_id: 'member-alpha', message: 'x' }, { signal: ac.signal }))
    expect(r.ok).toBe(false) // native output schemas have no cancellation envelope; cancellation is an error result
    expect(fake.calls).toHaveLength(0)
  })

  it('AC-36 no port wired at all (and no host face mounted): every leg is a typed UNWIRED refusal, zero fake, zero bypass', async () => {
    const plane = await buildAC({ injected: { agentScope: AGENT_SCOPE, callerAuthority: CALLER_AUTHORITY }, controlLeg: approvingControlLeg([]) })
    const r = await attempt(() => def(plane, 'subagent').execute({ description: 'd', prompt: 'p' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toContain('agent-runtime-leg-unwired')
  })

  // ── F-3 (review R1): EXACTLY what the fence enforces at this pin ──
  // The fence is a DURABLE-ROSTER MEMBERSHIP fence over the CALLER'S OWN
  // MOUNT SCOPE: (arm 1) an explicit `scope:` prefix must equal the mount's
  // own scopeKey byte-for-byte; (arm 2) the remaining id must appear
  // VERBATIM in the assembly-injected `agentScope.members` list — exact
  // string equality, no trim/fold. It is NOT subtree containment (a
  // descendant chain spanning mounts is not expressible in this data at
  // this pin — disclosed, not implied) and it is NOT a liveness gate: LIVE
  // STATE belongs to the runtime (steering an in-roster but inactive member
  // is the host face's DOCUMENTED resume semantics; an ARCHIVED member is
  // gone from the durable roster, and removal from that list IS how
  // archived leaves the fence's data).
  it('AC-37 an archived member (removed from the durable roster): scope-foreign, zero port', async () => {
    const fake = makeFakeRuntime()
    const { plane } = await setup({
      injected: trustedInjected(fake, { agentScope: { scopeKey: SCOPE_KEY, members: ['member-beta'] } }),
    })
    // member-alpha was archived: the durable roster no longer names it —
    // membership the roster cannot prove is membership not held.
    const r = await attempt(() => def(plane, 'interrupt_agent').execute({ agent_id: 'member-alpha' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toContain('agent-control-scope-foreign')
    expect(fake.calls).toHaveLength(0)
  })

  it('AC-38 a SIBLING member\'s child (off this roster, however named): scope-foreign, zero port', async () => {
    const { plane, fake } = await setup()
    // Shaped like a descendant id of member-alpha — the fence never reads
    // ids for lineage; a descendant lives in ITS OWN mount's roster data,
    // not this mount's, so it is off-roster here (and subtree reach across
    // mounts is NOT claimed at this pin — see the disclosure).
    const r = await attempt(() => def(plane, 'send_message').execute({ agent_id: 'member-alpha/child-7', message: 'x' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toContain('agent-control-scope-foreign')
    const r2 = await attempt(() => def(plane, 'interrupt_agent').execute({ agent_id: 'member-alpha-child-7' }))
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.msg).toContain('agent-control-scope-foreign')
    expect(fake.calls).toHaveLength(0)
  })

  it('AC-38b identity is EXACT strings: case and whitespace variants refuse with zero port; an inactive-but-rostered member rides the fence (runtime owns liveness)', async () => {
    const { plane, fake } = await setup()
    for (const variant of ['Member-Alpha', 'MEMBER-ALPHA', ' member-alpha', 'member-alpha ', 'member-alph a']) {
      const r = await attempt(() => def(plane, 'send_message').execute({ agent_id: variant, message: 'x' }))
      expect(r.ok, `variant ${JSON.stringify(variant)} must NOT be admitted`).toBe(false)
      if (!r.ok) expect(r.msg).toContain('agent-control-scope-foreign')
    }
    expect(fake.calls).toHaveLength(0)
    // An in-roster member the roster lists (status is NOT fence data at
    // this pin): the fence ADMITS and the runtime's own lifecycle governs —
    // the host face documents inactive targets RESUME on send_message.
    const ok = await attempt(() => def(plane, 'send_message').execute({ agent_id: 'member-beta', message: 'x' }))
    expect(ok.ok).toBe(true)
    expect(fake.callsFor('steer')).toHaveLength(1)
    expect(fake.callsFor('steer')[0]?.targetId).toBe('member-beta')
  })

  it('AC-39 the explicit-scope arm is byte-exact: a differently-cased own-scope prefix is FOREIGN, zero port', async () => {
    const { plane, fake } = await setup()
    const r = await attempt(() => def(plane, 'send_message').execute({ agent_id: `U7F-C1-REALM:member-alpha`, message: 'x' }))
    expect(r.ok).toBe(false)
    if (!r.ok) expect(r.msg).toContain('agent-control-scope-foreign')
    const r2 = await attempt(() => def(plane, 'send_message').execute({ agent_id: ` ${SCOPE_KEY}:member-alpha`, message: 'x' }))
    expect(r2.ok).toBe(false)
    if (!r2.ok) expect(r2.msg).toContain('agent-control-scope-foreign')
    expect(fake.calls).toHaveLength(0)
  })
})

// ─────────────────────────────────────────────────────────────────────────
// THE DIRECT ARM (the u7-9a M-arm pattern): the REAL executors driven with
// a recording PA mirror — this captures the ACTUAL per-call requested
// effect sets. The enumeration/mutation split is pinned from these
// requests, not from a re-reading of the declaration.
describe('u7-f C1 effect-split arm — the PA requested sets ARE the law (a)', () => {
  interface PaCall { requestedEffects?: { effects?: Array<Record<string, unknown>>; fingerprint?: string }; callId?: string }
  const directExecutors = async (injected: Record<string, unknown>, sets: PaCall[]) => {
    const lane = await import(new URL('../../tools/agent-control-family/src/index.mjs', import.meta.url).href) as {
      createAgentControlExecutors: (i: Record<string, unknown>) => Record<string, ((raw: unknown, corr?: Record<string, unknown>) => Promise<Record<string, unknown>>) | undefined>
    }
    // The fake the PORT is wired to is the fake the assertions read —
    // one object, no parallel recording face.
    const fake = injected.agentRuntime as FakePort
    const executors = createExec(lane, injected, sets, fake)
    const exec = (name: string) => {
      const f = executors[name]
      if (typeof f !== 'function') throw new Error(`no executor ${name}`)
      return f
    }
    return { exec, fake }
  }
  const createExec = (lane: Record<string, unknown>, injected: Record<string, unknown>, sets: PaCall[], _fake: FakePort) => {
    const create = (lane as unknown as { createAgentControlExecutors: (i: Record<string, unknown>) => Record<string, ((raw: unknown, corr?: Record<string, unknown>) => Promise<Record<string, unknown>>) | undefined> }).createAgentControlExecutors
    return create({
      realmId: REALM, templateId: 'u7f-tpl', instanceId: INSTANCE,
      mountScope: { scopeKey: SCOPE_KEY },
      permissionPolicy: policyFor(),
      decide: () => ({ kind: 'allow' }),
      pa: async (c: PaCall) => { sets.push(c); return { kind: 'allow' } },
      port: normalize(injected),
      scopeFence: AGENT_SCOPE,
      callerAuthority: CALLER_AUTHORITY,
      observe: () => {},
    })
  }
  const normalize = (injected: Record<string, unknown>) => {
    const p = injected.agentRuntime as FakePort
    return { staticLegs: Object.freeze({
      listAgents: p.listAgents, listModels: p.listModels, spawnChild: p.spawnChild,
      forkChild: p.forkChild, steer: p.steer, interrupt: p.interrupt, runWorkflow: p.runWorkflow,
    }), legResolver: () => null }
  }

  // The center's canonicalizer re-orders the arms (one canonical order for
  // the fingerprint): assertions bind the SET of kinds and locate arms by
  // kind, never by arrival order.
  const kindsOf = (effects: Array<Record<string, unknown>>) => effects.map((e) => String(e.kind)).slice().sort()
  const armOf = (effects: Array<Record<string, unknown>>, kind: string) => effects.find((e) => e.kind === kind)

  it('AC-40 enumeration PA sets carry NO domain-ref arm and no mutation kind — list_agents', async () => {
    const sets: PaCall[] = []
    const { exec } = await directExecutors({ agentRuntime: makeFakeRuntime() }, sets)
    await exec('list_agents')({}, {})
    expect(sets).toHaveLength(1)
    const effects = sets[0]?.requestedEffects?.effects ?? []
    expect(kindsOf(effects)).toEqual(['meta', 'tool-invoke'])
    expect(effects.some((e) => e.kind === 'domain-ref')).toBe(false)
    expect(armOf(effects, 'tool-invoke')?.toolName).toBe('list_agents')
    const meta = armOf(effects, 'meta')?.resource as Record<string, unknown>
    expect(meta.canonicalLocator).toBe('agent-roster')
    expect(meta.kind).toBe('metadata')
  })

  it('AC-41 enumeration PA sets carry NO domain-ref arm — list_subagent_models', async () => {
    const sets: PaCall[] = []
    const { exec } = await directExecutors({ agentRuntime: makeFakeRuntime() }, sets)
    await exec('list_subagent_models')({ provider: 'prov-a' }, {})
    const effects = sets[0]?.requestedEffects?.effects ?? []
    expect(kindsOf(effects)).toEqual(['meta', 'tool-invoke'])
    expect(((armOf(effects, 'meta')?.resource ?? {}) as Record<string, unknown>).canonicalLocator).toBe('model-routes')
  })

  it('AC-42 mutation PA sets DO carry the single domain-ref(dsh-agent-runtime) arm — and fingerprint stably', async () => {
    const sets: PaCall[] = []
    const { exec } = await directExecutors({ agentRuntime: makeFakeRuntime() }, sets)
    await exec('subagent')({ description: 'd', prompt: 'p' }, {})
    await exec('send_message')({ agent_id: 'member-alpha', message: 'x' }, {})
    await exec('subagent_fork')({ description: 'd', prompt: 'p' }, {})
    const spawnArms = sets[0]?.requestedEffects?.effects ?? []
    expect(kindsOf(spawnArms)).toEqual(['domain-ref', 'tool-invoke'])
    expect(armOf(spawnArms, 'domain-ref')?.domainAuthorityId).toBe('dsh-agent-runtime')
    const steerArms = sets[1]?.requestedEffects?.effects ?? []
    expect(kindsOf(steerArms)).toEqual(['domain-ref', 'tool-invoke'])
    // fork discloses its context as a META read next to the authority arm:
    const forkArms = sets[2]?.requestedEffects?.effects ?? []
    expect(kindsOf(forkArms)).toEqual(['domain-ref', 'meta', 'tool-invoke'])
    expect(((armOf(forkArms, 'meta')?.resource ?? {}) as Record<string, unknown>).canonicalLocator).toBe('mount-conversation-context')
    // Fingerprint law, stated honestly: the domain-ref arm carries NO
    // resource (that is the closed vocabulary — "Domain Authority decides
    // at commit"), so the fingerprint keys the EFFECT WORLD of the call,
    // not its payload. Two same-kind spawns fingerprint identically
    // (deterministic, cross-mount stable); the fingerprint law pins
    // determinism + cross-kind distinctness, and payload discrimination is
    // the runtime's commit-time job (one-shot consumption forces EVERY
    // call through the edge — no durable rule can ride the fingerprint).
    const sets2: PaCall[] = []
    const { exec: ex2 } = await directExecutors({ agentRuntime: makeFakeRuntime() }, sets2)
    await ex2('subagent')({ description: 'd', prompt: 'p' }, {})
    expect(sets2[0]?.requestedEffects?.fingerprint).toBe(sets[0]?.requestedEffects?.fingerprint)
    await ex2('send_message')({ agent_id: 'member-alpha', message: 'x' }, {})
    // same KIND of set (tool-invoke name differs → distinct fingerprint):
    expect(sets2[1]?.requestedEffects?.fingerprint).not.toBe(sets[0]?.requestedEffects?.fingerprint)
    // and the enumeration set fingerprints differently from any mutation set:
    const sets3: PaCall[] = []
    const { exec: ex3 } = await directExecutors({ agentRuntime: makeFakeRuntime() }, sets3)
    await ex3('list_agents')({}, {})
    expect(sets3[0]?.requestedEffects?.fingerprint).not.toBe(sets[0]?.requestedEffects?.fingerprint)
  })

  it('AC-43 the PA replay mirror: a settled exec token asks the PA edge ONCE, the second call refuses at the family ledger', async () => {
    const sets: PaCall[] = []
    const sharedFake = makeFakeRuntime()
    const { exec, fake } = await directExecutors({ agentRuntime: sharedFake }, sets)
    const corr = { correlation: 'exec-one-shot-1' }
    const a = await exec('subagent')({ description: 'd', prompt: 'p' }, corr)
    const b = await exec('subagent')({ description: 'd', prompt: 'p' }, corr)
    expect(a.kind).toBe('ok')
    expect(b.kind).toBe('refused')
    if (b.kind === 'refused') expect(b.text).toContain('agent-control-replay-refused')
    expect(sets).toHaveLength(1)
    expect(fake.callsFor('spawnChild')).toHaveLength(1)
  })

  it('AC-44 the PA deny arm: typed refusal with zero port reach', async () => {
    const lane = await import(new URL('../../tools/agent-control-family/src/index.mjs', import.meta.url).href) as Record<string, unknown>
    const fake = makeFakeRuntime()
    const execMap = (lane as unknown as { createAgentControlExecutors: (i: Record<string, unknown>) => Record<string, ((raw: unknown, c?: Record<string, unknown>) => Promise<Record<string, unknown>>) | undefined> }).createAgentControlExecutors({
      realmId: REALM, templateId: 'u7f-tpl', instanceId: INSTANCE,
      mountScope: { scopeKey: SCOPE_KEY },
      permissionPolicy: policyFor(),
      decide: () => ({ kind: 'allow' }),
      pa: async () => ({ kind: 'deny', code: 'approval-denied', detail: 'the control leg denied' }),
      port: normalizePortFromFake(fake),
      scopeFence: AGENT_SCOPE,
      callerAuthority: CALLER_AUTHORITY,
      observe: () => {},
    })
    const exec44 = execMap['subagent']
    if (typeof exec44 !== 'function') throw new Error('no subagent executor')
    const r = await exec44({ description: 'd', prompt: 'p' }, {})
    expect(r.kind).toBe('refused')
    expect(fake.calls).toHaveLength(0)
  })

  const normalizePortFromFake = (fake: FakePort) => ({ staticLegs: Object.freeze({
    listAgents: fake.listAgents, listModels: fake.listModels, spawnChild: fake.spawnChild,
    forkChild: fake.forkChild, steer: fake.steer, interrupt: fake.interrupt, runWorkflow: fake.runWorkflow,
  }), legResolver: () => null })

  it('AC-45 the contribution is schema-valid, claims the seven names, and declares the SAME authority constant the PA sets carry', async () => {
    const center = await import(new URL('../governance-center/index.ts', import.meta.url).href) as {
      validateFamilyContribution: (c: unknown, manifest: { capabilities: Record<string, { backsExecution?: string }> }) => { ok: boolean; contribution?: unknown; code?: string; detail?: string }
    }
    const lane = await import(new URL('../../tools/agent-control-family/src/index.mjs', import.meta.url).href) as Record<string, unknown>
    const L = lane as unknown as Record<string, (...a: unknown[]) => unknown>
    const mk = (name: string) => Object.freeze({
      name,
      parameters: { type: 'object', properties: {}, required: [] },
      execute: async () => ({}),
      output: { schema: { type: 'object' } },
    })
    const buildContribution = L['buildAgentControlContribution'] as (i: Record<string, unknown>) => Record<string, unknown>
    const contribution = buildContribution({
      spawnDefinition: mk('subagent'), forkDefinition: mk('subagent_fork'),
      steerDefinition: mk('send_message'), interruptDefinition: mk('interrupt_agent'),
      listAgentsDefinition: mk('list_agents'), listModelsDefinition: mk('list_subagent_models'),
      workflowDefinition: mk('workflow'),
      executors: Object.fromEntries(['subagent', 'subagent_fork', 'send_message', 'interrupt_agent', 'list_agents', 'list_subagent_models', 'workflow'].map((n) => [n, async () => ({})])),
      mechanics: await import(new URL('../../tools/agent-control-family/src/agent-control-mechanics.mjs', import.meta.url).href),
      portModule: await import(new URL('../../tools/agent-control-family/src/agent-runtime-port.mjs', import.meta.url).href),
      executorModule: await import(new URL('../../tools/agent-control-family/src/agent-control-executor.mjs', import.meta.url).href),
      cancelBoundary: 'test',
    }) as Record<string, Record<string, unknown>>
    const v = center.validateFamilyContribution(contribution, { capabilities: { 'agent-control': { backsExecution: 'family-body' } } })
    expect(v.ok === true, `${String(v.code)} ${String(v.detail ?? '')}`).toBe(true)
    expect((contribution.visibility as Record<string, unknown>).nativeNames).toEqual(['subagent', 'subagent_fork', 'send_message', 'interrupt_agent', 'list_agents', 'list_subagent_models', 'workflow'])
    expect((contribution.effects as Record<string, string[]>).targets).toContain('dsh-agent-runtime')
    expect((contribution.effects as Record<string, unknown>).kinds).toEqual(['tool-invoke', 'meta', 'domain-ref'])
  })

  // F-2 (review R1): declared == requested for the MUTATION rows, pinned as
  // the EXACT requested set per row — every arm's full spelling, the arm
  // COUNT, and the single domain-ref arm. A dropped (or added) arm in the
  // derivation trips this by construction; the mutation-control run of this
  // file (evidence u7-f-agentA-20261026/mutation-controls-r1.txt) shows the
  // trip is REAL: deleting one arm from the derivation turns AC-51 RED.
  it('AC-51 every MUTATION row requests its EXACT declared set (spawn/fork/send/interrupt/workflow)', async () => {
    const exactArms = (effects: Array<Record<string, unknown>>) => effects
      .map((e) => e.kind === 'meta'
        ? { kind: 'meta', canonicalLocator: String((e.resource as Record<string, unknown> | undefined)?.canonicalLocator) }
        : e.kind === 'domain-ref'
          ? { kind: 'domain-ref', domainAuthorityId: String(e.domainAuthorityId), resource: e.resource ?? null }
          : { kind: 'tool-invoke', toolName: String(e.toolName) })
      .sort((a, b) => a.kind.localeCompare(b.kind))
    const AUTHORITY = { kind: 'domain-ref', domainAuthorityId: 'dsh-agent-runtime', resource: null }
    const rows: Array<[string, Record<string, unknown>, Array<Record<string, unknown>>]> = [
      ['subagent', { description: 'd', prompt: 'p' }, [AUTHORITY, { kind: 'tool-invoke', toolName: 'subagent' }]],
      ['subagent_fork', { description: 'd', prompt: 'p' }, [AUTHORITY, { kind: 'meta', canonicalLocator: 'mount-conversation-context' }, { kind: 'tool-invoke', toolName: 'subagent_fork' }]],
      ['send_message', { agent_id: 'member-alpha', message: 'x' }, [AUTHORITY, { kind: 'tool-invoke', toolName: 'send_message' }]],
      ['interrupt_agent', { agent_id: 'member-alpha' }, [AUTHORITY, { kind: 'tool-invoke', toolName: 'interrupt_agent' }]],
      ['workflow', { description: 'w', prompt: 'p' }, [AUTHORITY, { kind: 'tool-invoke', toolName: 'workflow' }]],
    ]
    for (const [rowName, args, expected] of rows) {
      const sets: PaCall[] = []
      const { exec } = await directExecutors({ agentRuntime: makeFakeRuntime() }, sets)
      const out = await exec(rowName)(args, {})
      expect(out.kind, `${rowName} walk outcome`).toBe('ok')
      expect(sets, `${rowName} PA calls`).toHaveLength(1)
      const effects = sets[0]?.requestedEffects?.effects ?? []
      expect(exactArms(effects), `${rowName} exact requested set`).toEqual(expected)
      expect(effects.filter((e) => e.kind === 'domain-ref')).toHaveLength(1)
    }
  })
})

// ─────────────────────────────────────────────────────────────────────────
// F-1 (review R1) RETARGETED (AC-1): the PRODUCTION port factory is now
// driven against the PUBLIC `subagents` face (SubagentStartRequest:
// subagent/subagent/src/types.ts:145-198). The #406 `face-cannot-carry`
// legs pinned the EXPERIMENTAL `agentTeams` SpawnTeammateRequest, whose
// six-field shape is what made provider-required / model-unexpressible
// look like a law; on `subagents` every one of those fields is
// first-class, and the Tier A law replaces the whole arm. The port-level
// AC-1 laws live in `u7-ac1-subagents-port-c1.test.ts` (AC1-P1…P10): forced
// `toolFilter`, no agentOptions/persona, the typed route/PTC refusals and
// the child-toolview witness. Nothing here re-pins the wrong face.
