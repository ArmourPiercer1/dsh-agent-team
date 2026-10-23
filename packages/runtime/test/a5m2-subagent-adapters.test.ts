/**
 * A5M2-SUBAGENT-ADAPTERS — the B-SUBAGENT CONTROL-TRIO subset spec (census
 * records 44 interrupt_agent / 45 list_agents / 46 send_message; family
 * B-SUBAGENT, ownerRole SERVICE, mountCondition always; contract
 * M0-B-FAMILY-TARGET-CONTRACTS.md §B-SUBAGENT).
 *
 * The natives are the REAL published Host defineTool products @639ed01539:
 * the pristine dsh-tool-subagent-control lib's own apply() runs against the
 * REAL Context + SystemPrompt + ToolRuntime harness (the schedule spec's
 * idiom) and the trio is captured through ctx.tools.get — the production
 * capture seam. The SUBSET boundary is honest per root 17:51: the family
 * spans records 39–43 too (spawn side); they are NOT adapted (NAMED GAP
 * SPAWN_SIDE_CLOSED_WORLD carries the pre-spawn closed-world CENTER law),
 * and NOTHING here claims the service's lineage/budget/destroy semantics.
 *
 * Legs:
 *  (a) census facts + module closure (exactly ['node:crypto']);
 *  (b) the REAL captured definitions travel COMPLETE (every face === by
 *      reference, only execute replaced) AND the MEASURED marker law: the
 *      standard adjacent-Agent mark is a NON-ENUMERABLE symbol, a bare
 *      spread LOSES it (pinned: predicate false on {...native}), and the
 *      placed send_message definition carries it again (predicate TRUE —
 *      otherwise the continuation-delivery check would silently break);
 *  (c) assembly refusals: the marker-gate leg proves NON-RECOGNITION (a
 *      same-name UNMARKED send_message — the experimental Team trio case —
 *      is refused NON_HOST_SEND_MESSAGE), split service/registry, partial
 *      port, half/foreign captures, missing feeds;
 *  (d) the real compiled faces (required/properties per tool) and the thin
 *      dispatcher-shape mirror answering typed REFUSALS with zero port
 *      entry (the trio bodies answer NO typed argument VALUES — inventing
 *      lane values would be duck-law);
 *  (e) the byte-identical missing-caller THROW mirror per body (L4: the
 *      trio's refusal class is a THROW, contrast B-SCHEDULE's internal_error
 *      VALUE), zero port entry;
 *  (f) dispatch fidelity through the recorded REAL-service port: the live
 *      exec.agent REFERENCE as sender/authority.agent, the ContentBlock
 *      built from the plan snapshot, the live signal by reference,
 *      fire-and-forget interrupt, the exact list projection (one-shot
 *      OMITTED, diagnostic passed, running/inactive via the live registry,
 *      parent/depth only for descendants), service throws propagating
 *      verbatim (no error map);
 *  (g) plan memo (consumed/foreign/stale + the PINNED copy boundary),
 *  (h) the drift matrix (definition bytes, live service, rebound method,
 *      live registry) with ZERO port entry,
 *  (i) the required admit seat (deny throws the refusing side's bytes),
 *  (j) familyRegistrations placement-key law, drain, gap ledger.
 *
 * HONEST DISCLOSURE (per ruling): REAL captured definitions + DOUBLES for
 * the ctx.subagents service / ctx.agents registry / admit / placementFeed
 * = C1-grade real-surface measurement, NOT C2 (no Host session, no durable
 * child lineage store, no real delivery/continuation, no Windows run). The
 * family C2 obligations that live service-side (跨owner拒, 未安装治理child
 * 不得启动, cancel convergence) are the paired acceptance's, carried by the
 * named gaps — not this spec.
 */
import { describe, it, expect } from 'vitest'
import { existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { readFileSync } from 'node:fs'

import { findTestRepoRoot } from '../../../tests/paths.mjs'

// ── the production module under spec (hand-cast, house idiom) ─────────────
type PlanTarget = {
  contract: string
  parent: string
  child: { claim: string | null; adjudication: string }
  action: string
  revision: string
  effect: string
  depth: string
  budget: string
}
type Plan = { rowName: string; recordIndex: number; operation: string; target: PlanTarget; args: Record<string, unknown>; parametersFingerprint: string; namedGaps: Record<string, string> }
type ClassifyResult = { ok: boolean; code?: string; detail?: string; plan?: Plan }
type DelegateResult = { ok?: boolean; code?: string; detail?: string; settled?: string; value?: unknown }
type Row = {
  name: string
  familyId: string
  recordIndex: number
  active: boolean
  parameters: Record<string, unknown> | null
  classify: (args: unknown) => ClassifyResult
  delegate: (plan: Plan, ctx?: { exec?: unknown }) => Promise<DelegateResult>
  definitionIdentity: string | null
}
type Definition = {
  [face: string]: unknown
  name: string
  description: string
  output: { schema: unknown; render: unknown }
  parameters?: Record<string, unknown>
  execute: (args: unknown, exec: Record<string, unknown>) => Promise<unknown>
}
type Registration = { name: string; recordIndex: number; definitionIdentity: string; entry: { familyId: string; adapterRevision: number; providerIdentity: string } }
type AssemblyValue = {
  ok: true
  familyId: string
  revision: number
  mountCondition: string
  providerId: string
  subset: string
  definitions: Definition[]
  declared: Array<{ name: string; recordIndex: number; status: string; reason: string }>
  rows: Record<string, { status: string; row: Row }>
  rowOf: (name: string) => Row | undefined
  drain: () => { event: string }
  inFlight: () => { dispatches: number; refuses: number }
  familyRegistrations: () => Registration[]
}
type AssemblyResult = AssemblyValue | { ok: false; code: string; message: string }
type AdapterModule = {
  A5_B_SUBAGENT_FAMILY_ID: string
  A5_B_SUBAGENT_ADAPTER_REVISION: number
  A5_B_SUBAGENT_MOUNT_CONDITION: string
  A5_B_SUBAGENT_RECORD_SPECS: Record<string, { recordIndex: number; operation: string }>
  A5_B_SUBAGENT_TOOL_NAMES: string[]
  A5_B_SUBAGENT_SERVICE_METHODS: Record<string, { arity: number; signature: string }>
  A5_B_SUBAGENT_EFFECT_LABELS: Record<string, string>
  A5_B_SUBAGENT_CODES: Record<string, string>
  A5_B_SUBAGENT_NAMED_GAPS: Record<string, string>
  createSubagentAdapterAssembly: (input?: Record<string, unknown>) => AssemblyResult
}

const ADAPTER = (await import(new URL('../src/plugin/live/governed-families/subagent-adapters.mjs', import.meta.url).href)) as AdapterModule
const CODES = ADAPTER.A5_B_SUBAGENT_CODES
const NAMES = ADAPTER.A5_B_SUBAGENT_TOOL_NAMES

// ── the REAL published Host faces from the pristine baseline (fail closed) ─
const REPO_ROOT = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
if (REPO_ROOT === null) throw new Error('no repo root carrying tests/deepseek-harness-test-use — failing closed')
const HOST_PKG = (...rel: string[]): string => join(REPO_ROOT, 'tests', 'deepseek-harness-test-use', 'packages', ...rel)
const TOOLS_LIB = HOST_PKG('core', 'tools', 'lib', 'index.js')
const SYS_PROMPT_LIB = HOST_PKG('core', 'system-prompt', 'lib', 'index.js')
const CONTROL_LIB = HOST_PKG('subagent', 'tool-subagent-control', 'lib', 'index.js')
const LIST_LIB = HOST_PKG('subagent', 'tool-subagent-control', 'lib', 'types', 'list-agents.js')
const INTERNAL_LIB = HOST_PKG('subagent', 'subagent', 'lib', 'types', 'internal.js')
for (const lib of [TOOLS_LIB, SYS_PROMPT_LIB, CONTROL_LIB, LIST_LIB, INTERNAL_LIB]) {
  if (!existsSync(lib)) throw new Error(`pristine lib absent (${lib}); failing closed`)
}
// ONE consistent module set: every consumer must resolve the SAME cordis.
const CORDIS_PATHS = [TOOLS_LIB, SYS_PROMPT_LIB, CONTROL_LIB, LIST_LIB, INTERNAL_LIB].map((lib) => createRequire(pathToFileURL(lib)).resolve('@deepseek-ai/cordis'))
if (new Set(CORDIS_PATHS).size !== 1) {
  throw new Error(`host module set splits across cordis copies (${CORDIS_PATHS.join(' != ')}); failing closed`)
}
type HostContext = {
  plugin: (plugin: unknown, config?: Record<string, unknown>) => Promise<void>
  tools: { register: (definition: Record<string, unknown>) => () => void; get: (name: string) => Record<string, unknown> | undefined }
}
const HOST_TOOLS = (await import(pathToFileURL(TOOLS_LIB).href)) as unknown as { default: unknown }
const HOST_CORDIS = (await import(pathToFileURL(CORDIS_PATHS[0] as string).href)) as unknown as { Context: new () => HostContext }
const HOST_SYSTEM_PROMPT = ((await import(pathToFileURL(SYS_PROMPT_LIB).href)) as unknown as { default: unknown }).default
const HOST_CONTROL = (await import(pathToFileURL(CONTROL_LIB).href)) as unknown as { apply: (ctx: unknown) => void }
const HOST_LIST = (await import(pathToFileURL(LIST_LIB).href)) as unknown as { apply: (ctx: unknown) => void }
const HOST_INTERNAL = (await import(pathToFileURL(INTERNAL_LIB).href)) as unknown as {
  isAdjacentAgentSendMessageTool: (definition: unknown) => boolean
  markAdjacentAgentSendMessageTool: (definition: unknown) => unknown
}
const MARK_SYMBOL = Symbol.for('dsh.subagent.adjacentAgentSendMessageTool')

async function captureRealNatives(): Promise<Record<string, Definition>> {
  const ctx = new HOST_CORDIS.Context()
  await ctx.plugin(HOST_SYSTEM_PROMPT, {})
  await ctx.plugin(HOST_TOOLS.default, {})
  HOST_CONTROL.apply(ctx) // registers send_message + interrupt_agent
  HOST_LIST.apply(ctx) // registers list_agents
  const defs: Record<string, Definition> = {}
  for (const name of NAMES) {
    const def = ctx.tools.get(name)
    if (def === undefined) throw new Error(`the REAL host registered no tool '${name}' — baseline drift; failing closed`)
    defs[name] = def as unknown as Definition
  }
  return defs
}
const REAL_NATIVES = await captureRealNatives()

// ── lane-side doubles: the ctx.subagents-shaped port, ctx.agents registry,
//    admit, liveNative, placement feed ─────────────────────────────────────
const AGENT_REF: Record<string, unknown> = { id: 'agent-parent-live-1', session: { id: 'session-parent-1' } }
const SIGNAL = new AbortController().signal
const EXEC = { agent: AGENT_REF, signal: SIGNAL, callId: 'call-1' }

type Fixture = {
  calls: string[]
  service: Record<string, (...args: never[]) => unknown>
  registry: Map<string, { status: string }>
  lastSend: unknown[]
  lastInterrupt: unknown[]
  setChildren: (entries: readonly Record<string, unknown>[]) => void
  setDescendants: (entries: readonly Record<string, unknown>[]) => void
  setSendResult: (messageId: string) => void
  setServiceError: (error: Error | undefined) => void
}

function makeFixture(): Fixture {
  const calls: string[] = []
  const state = {
    children: [
      { id: 'agent-child-1', label: 'worker one', mode: 'continuable' },
      { id: 'agent-child-2', label: 'worker two', mode: 'continuable' },
      { id: 'agent-child-3', label: 'one-shot kid', mode: 'one-shot' },
      { id: 'agent-child-4', kind: 'diagnostic', reason: 'corrupt' },
    ] as Record<string, unknown>[],
    descendants: [
      { id: 'agent-child-1', label: 'worker one', mode: 'continuable', parentId: 'session-parent-1', depth: 1 },
      { id: 'agent-deep-9', label: 'deep kid', mode: 'continuable', parentId: 'session-child-1', depth: 2 },
    ] as Record<string, unknown>[],
    messageId: 'msg-ack-7',
    serviceError: undefined as Error | undefined,
  }
  const registry = new Map<string, { status: string }>([['agent-child-1', { status: 'running' }], ['agent-child-2', { status: 'idle' }]])
  const fixture: Fixture = {
    calls,
    registry,
    lastSend: [],
    lastInterrupt: [],
    service: {
      sendMessage: (async (...args: unknown[]) => {
        calls.push('sendMessage')
        fixture.lastSend = args
        if (state.serviceError !== undefined) throw state.serviceError
        return state.messageId
      }) as (...args: never[]) => unknown,
      interrupt: ((...args: unknown[]) => {
        calls.push('interrupt')
        fixture.lastInterrupt = args
        // Fire-and-forget like the published face (its return is void). The
        // double hands back a NEVER-SETTLING promise: a row that NAIVELY
        // awaited the return would hang and fail this leg — the honest
        // proof that nothing is awaited (no process pollution).
        return new Promise<never>(() => {})
      }) as (...args: never[]) => unknown,
      listChildren: (async (...args: unknown[]) => {
        calls.push('listChildren')
        if (state.serviceError !== undefined) throw state.serviceError
        void args
        return state.children
      }) as (...args: never[]) => unknown,
      listDescendants: (async () => {
        calls.push('listDescendants')
        if (state.serviceError !== undefined) throw state.serviceError
        return state.descendants
      }) as (...args: never[]) => unknown,
    },
    setChildren: (entries) => {
      state.children = [...entries]
    },
    setDescendants: (entries) => {
      state.descendants = [...entries]
    },
    setSendResult: (messageId) => {
      state.messageId = messageId
    },
    setServiceError: (error) => {
      state.serviceError = error
    },
  }
  return fixture
}

const CAPTURE_FOR = (overrides: Record<string, { native: Definition; definitionIdentity: string }> = {}): Record<string, { native: Definition; definitionIdentity: string }> =>
  Object.fromEntries([
    ...NAMES.map((name) => [name, { native: REAL_NATIVES[name] as Definition, definitionIdentity: `cap:${name}` }]),
    ...Object.entries(overrides),
  ])

function mount(fixture: Fixture, overrides: Record<string, unknown> = {}): AssemblyValue {
  const registry = { get: (id: unknown) => fixture.registry.get(String(id)) }
  const input: Record<string, unknown> = {
    captured: CAPTURE_FOR(),
    liveNative: (name: string) => REAL_NATIVES[name],
    subagentService: fixture.service,
    liveSubagentService: () => fixture.service,
    agentsRegistry: registry,
    liveAgentsRegistry: () => registry,
    isAdjacentAgentSendMessageTool: HOST_INTERNAL.isAdjacentAgentSendMessageTool,
    markAdjacentAgentSendMessageTool: HOST_INTERNAL.markAdjacentAgentSendMessageTool,
    placementFeed: (name: string) => ({ definitionIdentity: `placed-${name}` }),
    admit: async () => {
      fixture.calls.push('admit')
      return { ok: true }
    },
    ...overrides,
  }
  const result = ADAPTER.createSubagentAdapterAssembly(input)
  if (result.ok !== true) throw new Error(`mount fixture refused: ${result.code} — ${result.message}`)
  return result
}

// ── (a) frozen facts + purity ──────────────────────────────────────────────
describe('a5m2-subagent-adapters (a) frozen facts + purity', () => {
  it('census/contract trio facts (records 44/45/46; subset boundary explicit)', () => {
    expect(ADAPTER.A5_B_SUBAGENT_FAMILY_ID).toBe('B-SUBAGENT')
    expect(ADAPTER.A5_B_SUBAGENT_ADAPTER_REVISION).toBe(1)
    expect(ADAPTER.A5_B_SUBAGENT_MOUNT_CONDITION).toBe('always')
    expect([...NAMES].sort()).toEqual(['interrupt_agent', 'list_agents', 'send_message'])
    expect(Object.fromEntries(Object.entries(ADAPTER.A5_B_SUBAGENT_RECORD_SPECS).map(([k, v]) => [k, v.recordIndex]))).toEqual({
      interrupt_agent: 44, list_agents: 45, send_message: 46,
    })
    const indices = Object.keys(ADAPTER.A5_B_SUBAGENT_RECORD_SPECS)
    expect(indices).toHaveLength(3) // spawn side 39-43 NOT adapted (gap-carried)
  })
  it('module closure: exactly [node:crypto]; the marker symbol never lives in the module CODE (ledger comments may NAME it)', () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'plugin', 'live', 'governed-families', 'subagent-adapters.mjs'), 'utf8')
    // The comment-side ledger QUOTES the host internals (that is its whole
    // point); the LAW binds the CODE: comments are stripped, then scanned.
    const code = source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, '')
    const statics = [...code.matchAll(/^import .* from '(.+)'$/gm)].map((m) => String(m[1]))
    expect(statics).toEqual(['node:crypto'])
    expect(code).not.toContain('import(')
    expect(code).not.toMatch(/require\(/)
    // the marker identity is INJECTED, never hand-copied: the module CODE
    // must not mint the process symbol itself.
    expect(code).not.toContain('Symbol.for(')
  })
})

// ── (b) REAL capture completeness + the MEASURED marker law ───────────────
describe('a5m2-subagent-adapters (b) real capture + marker law', () => {
  it('the placed definitions carry EVERY REAL face by reference; only execute is replaced', () => {
    const fixture = makeFixture()
    const assembly = mount(fixture)
    expect(assembly.definitions).toHaveLength(3)
    expect(assembly.declared).toEqual([])
    for (const definition of assembly.definitions) {
      const native = REAL_NATIVES[definition.name] as Definition
      expect(definition.description).toBe(native.description)
      expect(definition.parameters).toBe(native.parameters) // the REAL compiled parameters
      expect(definition.output).toBe(native.output)
      expect(definition.output.render).toBe(native.output.render) // the REAL render
      expect(definition.execute).not.toBe(native.execute) // ONLY execute
    }
  })
  it('MEASURED marker law: non-enumerable mark; a bare spread LOSES it; the placed def carries it again', () => {
    const fixture = makeFixture()
    const assembly = mount(fixture)
    const native = REAL_NATIVES.send_message as Definition
    const mark = Object.getOwnPropertyDescriptor(native, MARK_SYMBOL)
    expect(mark?.value, 'the REAL registered send_message carries the standard mark').toBe(true)
    expect(mark?.enumerable, 'the mark is NON-ENUMERABLE (measured — spread loses it)').toBe(false)
    // pin the consequence the law exists for:
    expect(HOST_INTERNAL.isAdjacentAgentSendMessageTool({ ...native })).toBe(false)
    // the ASSEMBLY's placed definition passes the REAL predicate again:
    const placed = assembly.definitions.find((d) => d.name === 'send_message')
    if (placed === undefined) throw new Error('no placed send_message')
    expect(HOST_INTERNAL.isAdjacentAgentSendMessageTool(placed)).toBe(true)
    expect(placed.execute).not.toBe(native.execute)
  })
})

// ── (c) assembly refusals (incl. NON-RECOGNITION marker gate) ─────────────
describe('a5m2-subagent-adapters (c) assembly refusals', () => {
  it('missing feeds, split mounts, partial port, foreign/half captures, UNMARKED same-name send_message', () => {
    const fixture = makeFixture()
    const registry = { get: (id: unknown) => fixture.registry.get(String(id)) }
    const base: Record<string, unknown> = {
      captured: CAPTURE_FOR(),
      liveNative: (name: string) => REAL_NATIVES[name],
      subagentService: fixture.service,
      liveSubagentService: () => fixture.service,
      agentsRegistry: registry,
      liveAgentsRegistry: () => registry,
      isAdjacentAgentSendMessageTool: HOST_INTERNAL.isAdjacentAgentSendMessageTool,
      markAdjacentAgentSendMessageTool: HOST_INTERNAL.markAdjacentAgentSendMessageTool,
      placementFeed: (name: string) => ({ definitionIdentity: `placed-${name}` }),
      admit: async () => ({ ok: true }),
    }
    const refuse = (overrides: Record<string, unknown>): string => {
      const result = ADAPTER.createSubagentAdapterAssembly({ ...base, ...overrides })
      if (result.ok === true) throw new Error('expected refusal')
      return result.code
    }
    expect(refuse({ admit: undefined })).toBe(CODES.ADMISSION_ABSENT)
    expect(refuse({ placementFeed: undefined })).toBe(CODES.INPUT_INVALID)
    expect(refuse({ liveSubagentService: undefined })).toBe(CODES.INPUT_INVALID)
    expect(refuse({ liveAgentsRegistry: undefined })).toBe(CODES.INPUT_INVALID)
    expect(refuse({ isAdjacentAgentSendMessageTool: undefined })).toBe(CODES.MARKER_ABSENT)
    expect(refuse({ subagentService: 'nope' })).toBe(CODES.PORT_ABSENT)
    expect(refuse({ liveSubagentService: () => ({ ...fixture.service }) })).toBe(CODES.PORT_DRIFT)
    const partial: Record<string, unknown> = { ...fixture.service }
    delete partial.listDescendants
    expect(refuse({ subagentService: partial, liveSubagentService: () => partial })).toBe(CODES.PORT_METHOD_ABSENT)
    expect(refuse({ liveAgentsRegistry: () => ({ get: () => undefined }) })).toBe(CODES.PORT_DRIFT)
    expect(refuse({ captured: { ...CAPTURE_FOR(), subagent: CAPTURE_FOR().send_message! } })).toBe(CODES.NON_FAMILY_CAPTURE)
    const { output: _output, ...noOutput } = REAL_NATIVES.list_agents as Record<string, unknown>
    expect(refuse({ captured: { list_agents: { native: noOutput as unknown as Definition, definitionIdentity: 'cap:x' } } })).toBe(CODES.CAPTURE_INCOMPLETE)
    expect(refuse({ liveNative: undefined })).toBe(CODES.LIVE_NATIVE_ABSENT)
    expect(refuse({ stranger: 1 })).toBe(CODES.INPUT_INVALID)
    // NON-RECOGNITION (contract: exact host-provider身份不得与上游实验Team
    // 同名trio互认): a same-name, shape-complete but UNMARKED send_message —
    // the experimental-Team-trio case — is refused by the REAL predicate.
    const unmarked = { name: 'send_message', description: 'same name, foreign provider', output: { schema: {}, render: () => [] }, execute: async () => ({}) }
    expect(HOST_INTERNAL.isAdjacentAgentSendMessageTool(unmarked)).toBe(false)
    expect(refuse({ captured: CAPTURE_FOR({ send_message: { native: unmarked as unknown as Definition, definitionIdentity: 'cap:foreign-send' } }) }))
      .toBe(CODES.NON_HOST_SEND_MESSAGE)
  })
  it('no captures ⇒ three honest DECLARED-INACTIVE rows, zero definitions, zero registrations', async () => {
    const fixture = makeFixture()
    const assembly = mount(fixture, { captured: undefined })
    expect(assembly.definitions).toEqual([])
    expect(assembly.declared).toHaveLength(3)
    expect(assembly.familyRegistrations()).toEqual([])
    const row = assembly.rowOf('send_message')
    if (row === undefined) throw new Error('no row')
    expect(row.active).toBe(false)
    expect(row.classify({ agent_id: 'a', message: 'm' })).toMatchObject({ ok: false, code: CODES.CAPTURE_ABSENT })
    expect(fixture.calls).toEqual([])
  })
})

// ── (d) the real compiled faces + the thin mirror ─────────────────────────
describe('a5m2-subagent-adapters (d) real faces + thin mirror', () => {
  it('the REAL compiled parameter faces equal the published shape', () => {
    const parameters = (name: string): { properties?: Record<string, unknown>; required?: string[] } =>
      (REAL_NATIVES[name] as Definition).parameters as { properties?: Record<string, unknown>; required?: string[] }
    expect(Object.keys(parameters('send_message').properties ?? {}).sort()).toEqual(['agent_id', 'message'])
    expect([...(parameters('send_message').required ?? [])].sort()).toEqual(['agent_id', 'message'])
    expect(Object.keys(parameters('interrupt_agent').properties ?? {})).toEqual(['agent_id'])
    expect(parameters('interrupt_agent').required).toEqual(['agent_id'])
    expect(Object.keys(parameters('list_agents').properties ?? {})).toEqual(['scope'])
    expect(parameters('list_agents').required).toBeUndefined() // scope OPTIONAL (absent = children)
  })
  it('dispatcher-shape mirror refuses typed with ZERO port entry and mints no invented values', async () => {
    const fixture = makeFixture()
    const assembly = mount(fixture)
    const send = assembly.rowOf('send_message')
    const list = assembly.rowOf('list_agents')
    const interrupt = assembly.rowOf('interrupt_agent')
    if (send === undefined || list === undefined || interrupt === undefined) throw new Error('no rows')
    expect(send.classify('nope')).toMatchObject({ ok: false, code: CODES.INPUT_INVALID })
    expect(send.classify({ agent_id: '', message: 'm' })).toMatchObject({ ok: false, code: CODES.INPUT_INVALID })
    expect(send.classify({ agent_id: 'a-1', message: 7 })).toMatchObject({ ok: false, code: CODES.INPUT_INVALID })
    expect(send.classify({ agent_id: 'a-1' })).toMatchObject({ ok: false, code: CODES.INPUT_INVALID })
    expect(interrupt.classify({})).toMatchObject({ ok: false, code: CODES.INPUT_INVALID })
    expect(list.classify({ scope: 'siblings' })).toMatchObject({ ok: false, code: CODES.INPUT_INVALID })
    // empty strings are NOT lane VALUES here: the trio bodies answer no
    // typed argument values (inventing lane bytes would be duck-law) —
    // unknown-target deny stays the SERVICE's (NAMED GAP LINEAGE_AUTHORITY).
    const ok = list.classify({})
    expect(ok.ok).toBe(true)
    expect(ok.plan?.target.contract).toContain('§B-SUBAGENT')
    expect(ok.plan?.target.child.claim).toBeNull()
    expect(ok.plan?.target.parent).toContain('LIVE exec.agent reference')
    expect(ok.plan?.target.budget).toContain('NOT claimed')
    const sendPlan = send.classify({ agent_id: 'agent-child-1', message: 'continue' })
    expect(sendPlan.plan?.target.child.claim).toBe('agent-child-1')
    expect(fixture.calls).toEqual([])
  })
})

// ── (e) the byte-identical missing-caller THROW mirror (L4) ───────────────
describe('a5m2-subagent-adapters (e) live-caller law', () => {
  it('a missing exec.agent throws the BODY\'S OWN bytes (not an invented internal_error), zero port entry', async () => {
    const fixture = makeFixture()
    const assembly = mount(fixture)
    for (const name of NAMES) {
      const definition = assembly.definitions.find((d) => d.name === name)
      if (definition === undefined) throw new Error('no def')
      const args = name === 'list_agents' ? {} : { agent_id: 'agent-child-1', message: 'm' }
      await expect(definition.execute(args, {})).rejects.toThrow(new RegExp(`^${name} requires a calling agent \\(exec\\.agent was undefined\\)$`))
      await expect(definition.execute(args, { signal: SIGNAL })).rejects.toThrow(/requires a calling agent/)
    }
    expect(fixture.calls).toEqual(['admit', 'admit', 'admit', 'admit', 'admit', 'admit']) // admits ran; ZERO port entry
  })
})

// ── (f) dispatch fidelity through the recorded REAL-service port ──────────
describe('a5m2-subagent-adapters (f) dispatch fidelity', () => {
  it('send_message: the caller REFERENCE, snapshot content, live signal; the ack is the value', async () => {
    const fixture = makeFixture()
    const assembly = mount(fixture)
    const definition = assembly.definitions.find((d) => d.name === 'send_message')
    if (definition === undefined) throw new Error('no def')
    const value = await definition.execute({ agent_id: 'agent-child-2', message: 'resume the lane' }, EXEC)
    expect(value).toEqual({ messageId: 'msg-ack-7' })
    const [sender, targetId, content, options] = fixture.lastSend as [unknown, string, unknown[], { signal?: unknown }]
    expect(sender).toBe(AGENT_REF) // the SAME live Agent reference (L4)
    expect(targetId).toBe('agent-child-2')
    expect(content).toEqual([{ type: 'text', text: 'resume the lane' }])
    expect(options.signal).toBe(SIGNAL) // live signal by reference
  })
  it('interrupt_agent: fire-and-forget with the ancestor authority REFERENCE; {accepted:true} answers without awaiting', async () => {
    const fixture = makeFixture()
    const assembly = mount(fixture)
    const definition = assembly.definitions.find((d) => d.name === 'interrupt_agent')
    if (definition === undefined) throw new Error('no def')
    const value = await definition.execute({ agent_id: 'agent-child-1' }, EXEC)
    expect(value).toEqual({ accepted: true }) // request acceptance ONLY (gap: not stopped, not destroyed)
    const [targetId, authority] = fixture.lastInterrupt as [string, { kind: string; agent: unknown }]
    expect(targetId).toBe('agent-child-1')
    expect(authority.kind).toBe('ancestor')
    expect(authority.agent).toBe(AGENT_REF) // the live caller REFERENCE goes to the SERVICE
  })
  it('list_agents: the exact projection mirror (one-shot OMITTED, diagnostic passed, live status, no parent/depth for children)', async () => {
    const fixture = makeFixture()
    const assembly = mount(fixture)
    const definition = assembly.definitions.find((d) => d.name === 'list_agents')
    if (definition === undefined) throw new Error('no def')
    const value = await definition.execute({}, EXEC) as readonly Record<string, unknown>[]
    expect(value).toEqual([
      { kind: 'child', id: 'agent-child-1', label: 'worker one', status: 'running' },
      { kind: 'child', id: 'agent-child-2', label: 'worker two', status: 'inactive' },
      { kind: 'diagnostic', id: 'agent-child-4', reason: 'corrupt' },
    ]) // the one-shot row is OMITTED exactly like the published projection
    expect(fixture.calls).toContain('listChildren')
  })
  it('list_agents descendants: parent/depth ride; the descendants feed answers', async () => {
    const fixture = makeFixture()
    const assembly = mount(fixture)
    const definition = assembly.definitions.find((d) => d.name === 'list_agents')
    if (definition === undefined) throw new Error('no def')
    const value = await definition.execute({ scope: 'descendants' }, EXEC) as readonly Record<string, unknown>[]
    expect(value).toEqual([
      { kind: 'child', id: 'agent-child-1', label: 'worker one', status: 'running', parent: 'session-parent-1', depth: 1 },
      { kind: 'child', id: 'agent-deep-9', label: 'deep kid', status: 'inactive', parent: 'session-child-1', depth: 2 },
    ])
    expect(fixture.calls).toContain('listDescendants')
  })
  it('service throws propagate VERBATIM (no catch, no invented error values)', async () => {
    const fixture = makeFixture()
    fixture.setServiceError(new Error('cross-owner lineage deny (service-side)'))
    const assembly = mount(fixture)
    const definition = assembly.definitions.find((d) => d.name === 'send_message')
    if (definition === undefined) throw new Error('no def')
    await expect(definition.execute({ agent_id: 'agent-child-1', message: 'm' }, EXEC)).rejects.toThrow(/cross-owner lineage deny/)
  })
})

// ── (g/h/i/j) memo, drift, admit, registration, drain, gaps ───────────────
describe('a5m2-subagent-adapters (g) plan memo', () => {
  it('consumed/foreign/stale refuse with zero port entry; the COPY boundary is pinned honestly', async () => {
    const fixture = makeFixture()
    const assembly = mount(fixture)
    const row = assembly.rowOf('list_agents')
    if (row === undefined) throw new Error('no row')
    const plan = (row.classify({}).plan) as Plan
    const first = await row.delegate(plan, { exec: EXEC })
    expect(first).toMatchObject({ ok: true, settled: 'service' })
    const before = fixture.calls.length
    expect(await row.delegate(plan, { exec: EXEC })).toMatchObject({ ok: false, code: CODES.ALREADY_DISPATCHED })
    expect(fixture.calls).toHaveLength(before)
    const copied = { ...plan }
    expect(await row.delegate(copied, { exec: EXEC })).toMatchObject({ ok: true, settled: 'service' })
    expect(fixture.calls).toHaveLength(before + 1) // PINNED: copies RE-dispatch (real idempotency is the service's)
    expect(await row.delegate({ ...plan, rowName: 'send_message' }, { exec: EXEC })).toMatchObject({ ok: false, code: CODES.NOT_OWN_PLAN })
    expect(await row.delegate({ ...plan, parametersFingerprint: 'sha256:deadbeef' }, { exec: EXEC })).toMatchObject({ ok: false, code: CODES.PLAN_STALE })
  })
})
describe('a5m2-subagent-adapters (h) drift matrix (L3/L7)', () => {
  it('definition drift, live-service replacement, rebound method, live-registry replacement — all ZERO port entry', async () => {
    const fixture = makeFixture()
    let mode = 'bound'
    const registry = { get: (id: unknown) => fixture.registry.get(String(id)) }
    const result = ADAPTER.createSubagentAdapterAssembly({
      captured: CAPTURE_FOR(),
      liveNative: (name: string) => {
        const native = REAL_NATIVES[name] as Definition
        return mode === 'def-drift' ? { ...native } : native
      },
      subagentService: fixture.service,
      liveSubagentService: () => (mode === 'service-drift' ? { ...fixture.service } : fixture.service),
      agentsRegistry: registry,
      liveAgentsRegistry: () => (mode === 'registry-drift' ? { get: () => undefined } : registry),
      isAdjacentAgentSendMessageTool: HOST_INTERNAL.isAdjacentAgentSendMessageTool,
      markAdjacentAgentSendMessageTool: HOST_INTERNAL.markAdjacentAgentSendMessageTool,
      placementFeed: (name: string) => ({ definitionIdentity: `placed-${name}` }),
      admit: async () => ({ ok: true }),
    })
    if (result.ok !== true) throw new Error('mount failed')
    const row = result.rowOf('list_agents')
    if (row === undefined) throw new Error('no row')
    const plan = (row.classify({}).plan) as Plan
    const before = fixture.calls.length
    mode = 'def-drift'
    expect(await row.delegate(plan, { exec: EXEC })).toMatchObject({ ok: false, code: CODES.DEFINITION_DRIFT })
    mode = 'service-drift'
    expect(await row.delegate(plan, { exec: EXEC })).toMatchObject({ ok: false, code: CODES.PORT_DRIFT })
    mode = 'registry-drift'
    expect(await row.delegate(plan, { exec: EXEC })).toMatchObject({ ok: false, code: CODES.PORT_DRIFT })
    mode = 'bound'
    const rebound = fixture.service.listChildren
    Object.defineProperty(fixture.service, 'listChildren', { value: async () => [], writable: true, configurable: true, enumerable: true })
    expect(await row.delegate(plan, { exec: EXEC })).toMatchObject({ ok: false, code: CODES.PORT_DRIFT })
    Object.defineProperty(fixture.service, 'listChildren', { value: rebound, writable: true, configurable: true, enumerable: true })
    expect(fixture.calls).toHaveLength(before) // ZERO service entry on every drift
  })
  it('THE VERIFIED FEED READ IS THE INVOKED READ — a feed that turns over to a second service after the edge check is never entered (settled house law from the B-TEAM review)', async () => {
    const fixture = makeFixture()
    let poisonHits = 0
    const poison: Record<string, (...args: never[]) => unknown> = {
      ...fixture.service,
      sendMessage: (async () => {
        poisonHits += 1
        return 'POISON-messageId'
      }) as (...args: never[]) => unknown,
    }
    let reads = 0
    const assembly = mount(fixture, {
      // read 1 = the assembly split-check, read 2 = the dispatch edge; ANY
      // later read answers the second service. The B-TEAM pre-fix pattern
      // performed exactly such a later read on the dispatch path.
      liveSubagentService: () => {
        reads += 1
        return reads <= 2 ? fixture.service : poison
      },
    })
    const definition = assembly.definitions.find((d) => d.name === 'send_message')
    if (definition === undefined) throw new Error('no def')
    const value = await definition.execute({ agent_id: 'agent-child-2', message: 'verified handle only' }, EXEC)
    expect(value).toEqual({ messageId: 'msg-ack-7' }) // the VERIFIED service answered
    expect(poisonHits).toBe(0)
    expect(reads).toBe(2) // assembly check + the one edge read the call rides
    expect(fixture.lastSend[0]).toBe(AGENT_REF)
  })
  it('the BIND-TIME canonical snapshot catches an IN-PLACE mutation of the shared compiled-parameters object; the reference-presentation law stands', async () => {
    const fixture = makeFixture()
    const assembly = mount(fixture)
    const row = assembly.rowOf('list_agents')
    const native = REAL_NATIVES.list_agents as Definition
    if (row === undefined) throw new Error('no row')
    expect(Object.isFrozen(native.parameters), 'premise (measured): the compiled parameters object is live and mutable').toBe(false)
    const plan = row.classify({}).plan
    if (plan === undefined) throw new Error('no plan')
    const before = fixture.calls.length
    const liveParams = native.parameters as Record<string, unknown>
    liveParams.inPlaceMutation = true
    expect(await row.delegate(plan, { exec: EXEC })).toMatchObject({ ok: false, code: CODES.DEFINITION_DRIFT })
    expect(fixture.calls).toHaveLength(before) // ZERO service entry on the mutated shared object
    expect(row.parameters).toBe(native.parameters) // presentation law STANDS (same live reference)
    const placed = assembly.definitions.find((d) => d.name === 'list_agents')
    if (placed === undefined) throw new Error('no placed definition')
    expect(placed.parameters).toBe(native.parameters)
    delete liveParams.inPlaceMutation
    expect(await row.delegate(plan, { exec: EXEC })).toMatchObject({ ok: true, settled: 'service' }) // bytes restored → serves again
  })
})
describe('a5m2-subagent-adapters (i/j) admit + registration + drain + gaps', () => {
  it('admit DENY throws the refusing side\'s own bytes with zero port entry; the envelope is the governed one', async () => {
    const fixture = makeFixture()
    let seen: Record<string, unknown> = {}
    const assembly = mount(fixture, {
      admit: async (ctx: Record<string, unknown>) => {
        seen = ctx
        return { ok: false, code: 'PA_DENY', detail: 'walk stopped' }
      },
    })
    const definition = assembly.definitions.find((d) => d.name === 'send_message')
    if (definition === undefined) throw new Error('no def')
    const error = await definition.execute({ agent_id: 'agent-child-1', message: 'm' }, EXEC).then(() => undefined, (e: unknown) => e as Error & { subagentRefusal?: unknown })
    expect((error?.subagentRefusal as { code: string } | undefined)?.code).toBe('PA_DENY')
    expect(seen).toMatchObject({ name: 'send_message', recordIndex: 46, familyId: 'B-SUBAGENT' })
    expect(seen.exec).toBe(EXEC)
    expect(fixture.calls.filter((c) => !c.startsWith('admit'))).toEqual([])
  })
  it('familyRegistrations: placement keys only; ABSENT/MOVED throw; drain = new-call prohibition', () => {
    const fixture = makeFixture()
    const assembly = mount(fixture)
    const registrations = assembly.familyRegistrations()
    expect(registrations.map((r) => [r.name, r.recordIndex, r.definitionIdentity]).sort()).toEqual([
      ['interrupt_agent', 44, 'placed-interrupt_agent'],
      ['list_agents', 45, 'placed-list_agents'],
      ['send_message', 46, 'placed-send_message'],
    ])
    expect(registrations[0]?.entry).toEqual({ familyId: 'B-SUBAGENT', adapterRevision: 1, providerIdentity: 'b-subagent' })
    const absent = mount(fixture, { placementFeed: () => undefined })
    expect(() => absent.familyRegistrations()).toThrow(new RegExp(`^${CODES.PLACEMENT_KEY_ABSENT}:`))
    let tick = 0
    const floating = mount(fixture, { placementFeed: (name: string) => ({ definitionIdentity: `placed-${name}-${(tick += 1)}` }) })
    floating.familyRegistrations()
    expect(() => floating.familyRegistrations()).toThrow(new RegExp(`^${CODES.PLACEMENT_KEY_MOVED}:`))
    assembly.drain()
    const row = assembly.rowOf('interrupt_agent')
    if (row === undefined) throw new Error('no row')
    expect(row.classify({ agent_id: 'agent-child-1' })).toMatchObject({ ok: false, code: CODES.DRAINING })
  })
  it('the six named gaps ride every plan, never faked closed', () => {
    expect(Object.keys(ADAPTER.A5_B_SUBAGENT_NAMED_GAPS).sort()).toEqual([
      'DELIVERY_CONTINUATION', 'INTERRUPT_COMPLETION', 'LINEAGE_AUTHORITY', 'PLAN_ONCE_MEMO', 'SPAWN_SIDE_CLOSED_WORLD', 'UPSTREAM_NON_RECOGNITION',
    ])
    expect(ADAPTER.A5_B_SUBAGENT_NAMED_GAPS.SPAWN_SIDE_CLOSED_WORLD).toContain('不能先spawn再补Guard')
    expect(ADAPTER.A5_B_SUBAGENT_NAMED_GAPS.INTERRUPT_COMPLETION).toContain('REQUEST ACCEPTANCE')
    expect(ADAPTER.A5_B_SUBAGENT_NAMED_GAPS.LINEAGE_AUTHORITY).toContain('adjudicates nothing')
    expect(ADAPTER.A5_B_SUBAGENT_NAMED_GAPS.UPSTREAM_NON_RECOGNITION).toContain('tool-agent-team')
  })
})
