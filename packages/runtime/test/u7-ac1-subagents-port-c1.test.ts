/**
 * U7 AC-1 C1 — the agent-control family re-targeted from the experimental
 * `agentTeams` face to the PUBLIC `subagents` service + `llm`, under the
 * Tier A ceiling (design: dev/agent-workflow/evidence/
 * u7-agentcontrol-design-20261027/DESIGN.md §2.1–2.4, lane AC-1).
 *
 * Scope (in): list_subagent_models, list_agents, subagent (one-shot),
 * subagent_fork (`subagents.start('fork')`). Out (unchanged): send_message,
 * interrupt_agent, workflow, continuable spawn.
 *
 * Every leg pairs its answer with a FACE FACT recorded by the fake host
 * services (the service lookups made, the `subagents.start` calls made, the
 * `dispose` calls made) — never a guard light alone.
 *
 * Host-face pins (tests/deepseek-harness-test-use @ 639ed01539):
 *   subagents.start(name, SubagentStartRequest) — subagent/subagent/src/index.ts:559
 *   subagents.listChildren(parentSessionId, signal) — index.ts:374
 *   subagents.listDescendants(rootSessionId, signal) — index.ts:393
 *   SubagentStartRequest.toolFilter / agentOptions — subagent/src/types.ts:171,192
 *   SubagentRun {id, localAgent, result, dispose} — types.ts:308-334
 *   tools.get(name, scope) / tools.schemas(scope), `run_code` iff mode≠native — core/tools/src/index.ts:1178-1262
 *
 * MUTATION CONTROLS (recorded in the lane evidence, mutation-controls.txt):
 *   M1 drop the forced `toolFilter` in the port → AC1-P3/AC1-P4/AC1-F3 RED.
 *   M2 resolve `agentTeams` again for a leg in scope → AC1-P8 RED.
 */
import { describe, it, expect } from 'vitest'
import { approvingControlLeg } from './a5-m1-control-legs.mjs'

const REALM = 'u7ac1-c1-realm'
const INSTANCE = 'u7ac1-instance'

type Rec = Record<string, unknown>
interface StartCall { provider: string; request: Rec }

interface FakeHost {
  lookups: string[]
  starts: StartCall[]
  disposes: string[]
  listCalls: Array<{ op: string; id: unknown; signal: unknown }>
  services: Record<string, unknown>
  hostService: (name: string) => unknown
}

/** A fake run: `childTools` is the CHILD's visible tool list (the toolview witness). */
const makeHost = (opts: { childTools?: (req: Rec) => string[]; output?: string; stopReason?: string; withAgentTeams?: boolean; models?: unknown[] } = {}): FakeHost => {
  const lookups: string[] = []
  const starts: StartCall[] = []
  const disposes: string[] = []
  const listCalls: Array<{ op: string; id: unknown; signal: unknown }> = []
  let seq = 0
  const subagents = {
    async start(provider: string, request: Rec) {
      starts.push({ provider, request })
      seq += 1
      const id = `child-${String(seq)}`
      // The real in-process providers apply the filter in the creation
      // window: an `allow: []` restriction masks EVERY inherited name.
      const filter = request.toolFilter as { allow?: string[] } | undefined
      const inherited = ['read', 'bash', 'subagent']
      const visible = opts.childTools !== undefined
        ? opts.childTools(request)
        : (filter !== undefined && Array.isArray(filter.allow) ? inherited.filter((n) => filter.allow?.includes(n)) : inherited)
      const childAgent = {
        id,
        ctx: { tools: { schemas: (scope: unknown) => (scope === childAgent ? visible.map((name) => ({ name })) : []), get: () => undefined } },
      }
      return {
        id,
        localAgent: childAgent,
        result: Promise.resolve({ output: [{ type: 'text', text: opts.output ?? 'PONG' }], stopReason: opts.stopReason ?? 'completed' }),
        dispose: async () => { disposes.push(id) },
      }
    },
    async listChildren(id: unknown, signal: unknown) {
      listCalls.push({ op: 'listChildren', id, signal })
      return [
        { id: 'child-c', createdAt: 1, mode: 'continuable', label: 'cont' },
        { id: 'child-o', createdAt: 2, mode: 'one-shot', label: 'once' },
      ]
    },
    async listDescendants(id: unknown, signal: unknown) {
      listCalls.push({ op: 'listDescendants', id, signal })
      return [{ id: 'child-c', createdAt: 1, mode: 'continuable', label: 'cont', parentId: id, depth: 1 }]
    },
  }
  const llm = {
    listProviders: () => [{ id: 'prov-a', name: 'Provider A' }],
    listModels: async () => opts.models ?? [{ id: 'model-1', name: 'Model One', reasoning: { efforts: [] } }],
  }
  const agentTeams = {
    listMembers: () => [{ id: 'teammate-x' }],
    spawnTeammate: async () => ({ id: 'teammate-new' }),
    sendMessage: async () => ({ ok: true }),
    interrupt: async () => ({ ok: true }),
  }
  const services: Record<string, unknown> = { subagents, llm, ...(opts.withAgentTeams === false ? {} : { agentTeams }) }
  return {
    lookups, starts, disposes, listCalls, services,
    hostService: (name: string) => { lookups.push(name); return services[name] },
  }
}

/** A dispatch-provided caller Agent. `ptc` makes the public tool view
 *  present the reserved `run_code` transport for THIS agent's scope. */
const makeAgent = (opts: { ptc?: boolean; id?: string } = {}) => {
  const agent: Rec = { id: opts.id ?? 'session-member-1' }
  agent.ctx = {
    tools: {
      get: (name: string, scope: unknown) => (opts.ptc === true && name === 'run_code' && scope === agent ? { name: 'run_code' } : undefined),
    },
  }
  return agent
}
const SIGNAL = () => new AbortController().signal

let portMod: { createHostAgentRuntimePort: (i: Rec) => { legResolver: (leg: string) => ((a: Rec) => Promise<Rec>) | null } }
const loadPort = async () => {
  if (!portMod) portMod = (await import(new URL('../../tools/agent-control-family/src/agent-runtime-port.mjs', import.meta.url).href)) as typeof portMod
  return portMod
}
const portOver = async (host: FakeHost, observe: string[] = []) => (await loadPort()).createHostAgentRuntimePort({
  hostService: host.hostService, caller: {}, observe: (l: string) => { observe.push(l) },
})
const leg = async (host: FakeHost, name: string, observe: string[] = []) => {
  const fn = (await portOver(host, observe)).legResolver(name)
  if (fn === null) throw new Error(`leg ${name} unwired`)
  return fn
}

// ─────────────────────────────────────────────────────────────────────────
describe('AC-1 C1 port — the public subagents/llm faces, Tier A forced at the port', () => {
  it('AC1-P1 listAgents rides subagents.listChildren(caller.id, signal) and projects the native shape (continuable only)', async () => {
    const host = makeHost()
    const agent = makeAgent()
    const signal = SIGNAL()
    const r = await (await leg(host, 'listAgents'))({ caller: { agent }, signal })
    expect(host.listCalls).toEqual([{ op: 'listChildren', id: 'session-member-1', signal }])
    expect(r.ok).toBe(true)
    const agents = r.agents as Rec[]
    expect(agents.map((a) => a.id)).toEqual(['child-c'])
    expect(r.catalogSize).toBe(2)
  })

  it('AC1-P1b listAgents scope=descendants rides subagents.listDescendants', async () => {
    const host = makeHost()
    const r = await (await leg(host, 'listAgents'))({ caller: { agent: makeAgent() }, scope: 'descendants', signal: SIGNAL() })
    expect(host.listCalls.map((c) => c.op)).toEqual(['listDescendants'])
    expect((r.agents as Rec[])[0]).toMatchObject({ id: 'child-c', parent: 'session-member-1', depth: 1 })
  })

  it('AC1-P2 listModels rides llm.listProviders / llm.listModels and projects model objects to {id,name}', async () => {
    const host = makeHost()
    const providers = await (await leg(host, 'listModels'))({ caller: { agent: makeAgent() } })
    expect(providers.models).toEqual([{ provider: 'prov-a', name: 'Provider A' }])
    expect(providers.spawnRoutes).toBe('inherit-only')
    const models = await (await leg(host, 'listModels'))({ caller: { agent: makeAgent() }, provider: 'prov-a' })
    expect(models.models).toEqual([{ id: 'model-1', name: 'Model One' }])
  })

  it('AC1-P3 spawnChild = subagents.start("spawn") with toolFilter {allow:[]} FORCED, no agentOptions, no persona; result read back; run disposed', async () => {
    const host = makeHost()
    const agent = makeAgent()
    const signal = SIGNAL()
    const observe: string[] = []
    const r = await (await leg(host, 'spawnChild', observe))({ caller: { agent }, spec: { description: 'probe', prompt: 'reply PONG' }, signal })
    expect(host.starts).toHaveLength(1)
    const { provider, request } = host.starts[0]!
    expect(provider).toBe('spawn')
    expect(request.toolFilter).toEqual({ allow: [] })
    expect(request.parent).toBe(agent)
    expect(request.signal).toBe(signal)
    expect(request.prompt).toEqual([{ type: 'text', text: 'reply PONG' }])
    expect(request.label).toBe('probe')
    for (const k of ['agentOptions', 'persona', 'outputSchema']) expect(Object.prototype.hasOwnProperty.call(request, k), k).toBe(false)
    expect(Object.keys(request).sort()).toEqual(['label', 'parent', 'prompt', 'signal', 'toolFilter'])
    expect(r).toMatchObject({ ok: true, kind: 'foreground', runId: 'child-1', stopReason: 'completed', text: 'PONG' })
    expect(host.disposes).toEqual(['child-1'])
    expect(observe.some((l) => l.includes('child-toolview') && l.includes('tools=[]'))).toBe(true)
  })

  it('AC1-P4 forkChild = subagents.start("fork") with the SAME forced filter (the provider seeds the context; the family ships no context bytes)', async () => {
    const host = makeHost()
    const r = await (await leg(host, 'forkChild'))({ caller: { agent: makeAgent() }, spec: { description: 'fork', prompt: 'what token?' }, context: { kind: 'inherit-mount-conversation' }, signal: SIGNAL() })
    expect(host.starts.map((s) => s.provider)).toEqual(['fork'])
    expect(host.starts[0]!.request.toolFilter).toEqual({ allow: [] })
    expect(Object.keys(host.starts[0]!.request).sort()).toEqual(['label', 'parent', 'prompt', 'signal', 'toolFilter'])
    expect(r.ok).toBe(true)
  })

  it('AC1-P5 a route / background request reaching the port is refused TYPED (carry exactly or refuse) — zero start', async () => {
    for (const [field, value] of [['provider', 'prov-a'], ['model', 'model-1'], ['reasoning_effort', 'high'], ['run_in_background', true], ['tools', ['read']]] as const) {
      const host = makeHost()
      const r = await (await leg(host, 'spawnChild'))({ caller: { agent: makeAgent() }, spec: { description: 'd', prompt: 'p', [field]: value }, signal: SIGNAL() })
      expect(r.ok, field).toBe(false)
      expect(r.code, field).toBe('agent-runtime-tier-a-refused')
      expect(host.starts, field).toHaveLength(0)
    }
  })

  it('AC1-P6 a PTC-mode caller (run_code in its public tool view) is refused — zero start', async () => {
    const host = makeHost()
    for (const legName of ['spawnChild', 'forkChild']) {
      const r = await (await leg(host, legName))({ caller: { agent: makeAgent({ ptc: true }) }, spec: { description: 'd', prompt: 'p' }, signal: SIGNAL() })
      expect(r.ok, legName).toBe(false)
      expect(r.code, legName).toBe('agent-control-child-ptc-refused')
    }
    expect(host.starts).toHaveLength(0)
  })

  it('AC1-P7 a child whose visible tool list is NOT empty is disposed and refused (fail closed, Q1 witness)', async () => {
    const host = makeHost({ childTools: () => ['some_scoped_tool'] })
    const r = await (await leg(host, 'spawnChild'))({ caller: { agent: makeAgent() }, spec: { description: 'd', prompt: 'p' }, signal: SIGNAL() })
    expect(r.ok).toBe(false)
    expect(r.code).toBe('agent-runtime-child-toolview-nonempty')
    expect(host.disposes).toEqual(['child-1'])
  })

  it('AC1-P8 the in-scope legs never resolve the experimental agentTeams face (even when it is present)', async () => {
    const host = makeHost({ withAgentTeams: true })
    const agent = makeAgent()
    await (await leg(host, 'listAgents'))({ caller: { agent }, signal: SIGNAL() })
    await (await leg(host, 'listModels'))({ caller: { agent } })
    await (await leg(host, 'spawnChild'))({ caller: { agent }, spec: { description: 'd', prompt: 'p' }, signal: SIGNAL() })
    await (await leg(host, 'forkChild'))({ caller: { agent }, spec: { description: 'd', prompt: 'p' }, signal: SIGNAL() })
    expect(host.lookups).not.toContain('agentTeams')
    expect(host.lookups).toContain('subagents')
  })

  it('AC1-P9 without subagents the in-scope legs stay unwired (never a fallback to agentTeams)', async () => {
    const host = makeHost()
    delete host.services.subagents
    const port = await portOver(host)
    for (const l of ['listAgents', 'spawnChild', 'forkChild']) expect(port.legResolver(l), l).toBeNull()
  })

  it('AC1-P10 a non-completed child settles as a typed refusal carrying the stop reason (never success)', async () => {
    const host = makeHost({ stopReason: 'error', output: 'partial' })
    const r = await (await leg(host, 'spawnChild'))({ caller: { agent: makeAgent() }, spec: { description: 'd', prompt: 'p' }, signal: SIGNAL() })
    expect(r.ok).toBe(false)
    expect(r.code).toBe('agent-runtime-child-error')
    expect(host.disposes).toEqual(['child-1'])
  })
})

// ─────────────────────────────────────────────────────────────────────────
// The FAMILY over the real plane chain with NO injected port and NO injected
// caller authority: production resolves through cap.hostService, and the
// Tier A ceiling is the build-time default.
interface Definition { name: string; execute: (raw: unknown, exec?: Rec) => Promise<Rec> }
interface PlaneValue { definitions: ReadonlyArray<Definition>; ownNames: readonly string[]; mount: (agentCtx: Rec) => { ok: boolean; dispose: () => void } }
type Built = { ok: true; value: PlaneValue } | { ok: false; code: string; message?: string }
let row: { createTeamToolPlaneAssembly: (input: Rec) => Built }
const loadRow = async () => {
  if (!row) row = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as typeof row
  return row
}

async function mountFamily(host: FakeHost, opts: { injected?: Rec } = {}) {
  const audit: string[] = []
  const observe: string[] = []
  const built = (await loadRow()).createTeamToolPlaneAssembly({
    dispatcherLifecycle: { inflight: () => 0 },
    teamSessionId: 'u7ac1-team-root',
    permissionPolicy: { default: 'ask', allow: [], ask: [], deny: [] },
    realmId: REALM,
    templateId: 'u7ac1-tpl',
    role: 'member',
    instanceId: INSTANCE,
    onObserve: (r: unknown) => { observe.push(String(r)) },
    fs: { subtreeContains: () => true },
    plane: { agentControlEnabled: true },
    ...(opts.injected === undefined ? {} : { backends: opts.injected }),
    controlLeg: approvingControlLeg(audit),
  })
  if (built.ok !== true) throw new Error(`plane mount refused: ${built.code}`)
  const plane = built.value
  const placed = plane.mount({ tools: { register: () => () => {} }, get: (n: string) => host.hostService(n) })
  expect(placed.ok).toBe(true)
  const def = (name: string) => {
    const d = plane.definitions.find((x) => x.name === name)
    if (d === undefined) throw new Error(`no ${name}`)
    return d
  }
  return { plane, def, audit, observe }
}
const attempt = async (fn: () => Promise<unknown>): Promise<{ ok: true; value: Rec } | { ok: false; msg: string }> => {
  try { return { ok: true as const, value: await fn() as Rec } } catch (e) { return { ok: false as const, msg: String((e as Error)?.message ?? e) } }
}
let tok = 0
const exec = (agent: Rec) => { tok += 1; return { agent, signal: SIGNAL(), tokenKey: `tok-${String(tok)}` } }

describe('AC-1 C1 family — production port + Tier A ceiling over the real plane chain', () => {
  it('AC1-F1 list_subagent_models RAN through llm (one landing, one RAN)', async () => {
    const host = makeHost()
    const { def, audit, observe } = await mountFamily(host)
    const r = await attempt(() => def('list_subagent_models').execute({}, exec(makeAgent())))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.models).toEqual([{ provider: 'prov-a', name: 'Provider A' }])
    expect(audit).toHaveLength(1)
    expect(observe.filter((l) => l.includes('agent-control-list_subagent_models RAN'))).toHaveLength(1)
  })

  it('AC1-F2 list_agents RAN through subagents.listChildren keyed by the DISPATCH agent id (Q4)', async () => {
    const host = makeHost()
    const { def } = await mountFamily(host)
    const r = await attempt(() => def('list_agents').execute({}, exec(makeAgent({ id: 'session-q4' }))))
    expect(r.ok).toBe(true)
    expect(host.listCalls.map((c) => c.id)).toEqual(['session-q4'])
    const r2 = await attempt(() => def('list_agents').execute({ scope: 'descendants' }, exec(makeAgent())))
    expect(r2.ok).toBe(true)
    const bad = await attempt(() => def('list_agents').execute({ scope: 'everyone' }, exec(makeAgent())))
    expect(bad.ok).toBe(false)
    if (!bad.ok) expect(bad.msg).toContain('agent-control-schema-refused')
  })

  it('AC1-F3 subagent POSITIVE under the build-time Tier A ceiling: one start("spawn"), toolFilter {allow:[]}, child text read back', async () => {
    const host = makeHost({ output: 'PONG-AC1' })
    const { def, audit } = await mountFamily(host)
    const r = await attempt(() => def('subagent').execute({ description: 'probe', prompt: 'reply PONG' }, exec(makeAgent())))
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.text).toBe('PONG-AC1')
    expect(host.starts).toHaveLength(1)
    expect(host.starts[0]!.request.toolFilter).toEqual({ allow: [] })
    expect(audit).toHaveLength(1)
  })

  it('AC1-F4 subagent_fork POSITIVE: one start("fork"), forced filter', async () => {
    const host = makeHost()
    const { def } = await mountFamily(host)
    const r = await attempt(() => def('subagent_fork').execute({ description: 'fork', prompt: 'token?' }, exec(makeAgent())))
    expect(r.ok).toBe(true)
    expect(host.starts.map((s) => [s.provider, s.request.toolFilter])).toEqual([['fork', { allow: [] }]])
  })

  it('AC1-F5 Tier A refusals are typed and land BEFORE the PA edge: zero Control landing, zero start', async () => {
    const cases: Array<[string, Rec, string]> = [
      ['subagent', { description: 'd', prompt: 'p', provider: 'prov-a' }, 'agent-control-amplification-refused'],
      ['subagent', { description: 'd', prompt: 'p', model: 'model-1' }, 'agent-control-amplification-refused'],
      ['subagent', { description: 'd', prompt: 'p', reasoning_effort: 'high' }, 'agent-control-amplification-refused'],
      ['subagent', { description: 'd', prompt: 'p', run_in_background: true }, 'agent-control-amplification-refused'],
      ['subagent', { description: 'd', prompt: 'p', tools: ['read'] }, 'agent-control-schema-refused'],
      ['subagent_fork', { description: 'd', prompt: 'p', run_in_background: true }, 'agent-control-amplification-refused'],
      ['subagent_fork', { description: 'd', prompt: 'p', tools: ['read'] }, 'agent-control-schema-refused'],
    ]
    for (const [name, args, code] of cases) {
      const host = makeHost()
      const { def, audit } = await mountFamily(host)
      const r = await attempt(() => def(name).execute(args, exec(makeAgent())))
      expect(r.ok, `${name} ${JSON.stringify(args)}`).toBe(false)
      if (!r.ok) expect(r.msg, JSON.stringify(args)).toContain(code)
      expect(audit, JSON.stringify(args)).toHaveLength(0)
      expect(host.starts, JSON.stringify(args)).toHaveLength(0)
    }
  })

  it('AC1-F6 a PTC-mode caller is refused BEFORE the PA edge (zero landing, zero start)', async () => {
    for (const name of ['subagent', 'subagent_fork']) {
      const host = makeHost()
      const { def, audit } = await mountFamily(host)
      const r = await attempt(() => def(name).execute({ description: 'd', prompt: 'p' }, exec(makeAgent({ ptc: true }))))
      expect(r.ok, name).toBe(false)
      if (!r.ok) expect(r.msg, name).toContain('agent-control-child-ptc-refused')
      expect(audit, name).toHaveLength(0)
      expect(host.starts, name).toHaveLength(0)
    }
  })

  it('AC1-F7 out of lane, unchanged: send_message / interrupt_agent still refuse without a roster; workflow still unwired', async () => {
    const host = makeHost()
    const { def } = await mountFamily(host)
    const s = await attempt(() => def('send_message').execute({ agent_id: 'child-c', message: 'hi' }, exec(makeAgent())))
    expect(s.ok).toBe(false)
    if (!s.ok) expect(s.msg).toContain('agent-control-scope-unresolved')
    const w = await attempt(() => def('workflow').execute({ description: 'd', prompt: 'p' }, exec(makeAgent())))
    expect(w.ok).toBe(false)
    if (!w.ok) expect(w.msg).toContain('agent-runtime-leg-unwired')
  })
})
