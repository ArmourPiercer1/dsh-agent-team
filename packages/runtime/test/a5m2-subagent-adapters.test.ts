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
 *  (d) the real compiled faces (required/properties per tool) and the
 *      TYPE-ONLY admission mirror — the published schema is string/required
 *      with NO minLength (measured), so EMPTY strings are LEGAL and FLOW TO
 *      THE SERVICE (which owns the business refusal) while non-strings
 *      refuse typed with zero port entry — PLUS the MEASURED PASS-THROUGH
 *      law: non-record arguments (null/undefined/'nope'/array) go to the
 *      captured NATIVE uncoerced, whose object-root validator answers the
 *      Host's OWN ToolArgsError before any body (pinned byte-identical; no
 *      synthetic '{}' is ever validated) — and per root 19:24 the native is
 *      invoked ONLY through the edge-VERIFIED {def, execute} handles: full
 *      drift verification runs FIRST, a re-bound/foreign native refuses
 *      DEFINITION_DRIFT with ZERO native entry (no unadmitted fallback;
 *      invalid args provably never reach the native body); and the OPEN
 *      parameter root admits unknown keys (no added unknown-key denial);
 *  (e) the byte-identical missing-caller THROW mirror per body (L4: the
 *      trio's refusal class is a THROW, contrast B-SCHEDULE's internal_error
 *      VALUE), zero port entry;
 *  (f) dispatch fidelity through the recorded REAL-service port: the live
 *      exec.agent REFERENCE as sender/authority.agent, the ContentBlock
 *      built from the plan snapshot, the live signal by reference,
 *      fire-and-forget interrupt, the exact list projection (one-shot
 *      OMITTED, diagnostic passed, running/inactive via the live registry,
 *      parent/depth only for descendants), service throws propagating
 *      verbatim (no error map) and the REAL published SubagentError
 *      (dsh-subagent's own runtime bundle, which exports the class its
 *      throw sites instantiate) instanceof-able after pass-through:
 *      interrupt accepts unknown/absent/one-shot targets as no-ops and
 *      ONLY live cross-authority targets answer UNAUTHORIZED (measured);
 *  (g) plan memo (consumed/foreign/stale + the PINNED copy boundary),
 *  (h) the drift matrix (definition bytes, live service, rebound method,
 *      live registry) with ZERO port entry,
 *  (h2) the VERIFIED GET HANDLE law: the registry's get FUNCTION is
 *      captured at bind, re-verified at the edge and invoked as the SAME
 *      reference (verified === invoked); a same-object get swap BEFORE the
 *      dispatch refuses PORT_DRIFT, a swap DURING the list await never
 *      reaches the projection (zero poisoned hits), and the get property
 *      READ COUNT is pinned (no re-read at the projection site);
 *  (k) the measured send_message ADJACENCY law carried as PLAN FACTS ONLY
 *      (root 19:24 — the row performs NO business pre-adjudication and owns
 *      NO authority semantics): parent→child AND child→DIRECT PARENT are
 *      admitted (a resident continuable child may send to its parent — the
 *      relation is ADJACENT, not a universal parent→child quantifier);
 *      sibling/uncle targets are SERVICE-ADJUDICATED — EVEN WITH lineage
 *      facts sitting in the live registry, the row forwards the caller
 *      REFERENCE and the raw claim, and the Host-behavior service answers
 *      the REAL published SubagentError UNAUTHORIZED, verbatim;
 *      cold/unknown targets flow likewise; the lineage-bearing registry
 *      (id + session.header.parentSession, the measured Host shape) is a
 *      DOUBLE, disclosed as a double;
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
  caller: string
  address: { claim: string | null; relation: string; adjudication: string }
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
// The PUBLISHED SubagentError face (581-1 FIX 4): the dsh-subagent runtime
// BUNDLE index — the module that EXPORTS the class AND contains the throw
// sites instantiating it (measured: lib/index.js is a bundle carrying its
// own copy; the src face publishes it at packages/subagent/subagent/
// src/index.ts:117). The separate lib/types/error.js copy is NOT the
// identity production throws with — the pin rides the bundle index.
const SUBAGENT_LIB = HOST_PKG('subagent', 'subagent', 'lib', 'index.js')
for (const lib of [TOOLS_LIB, SYS_PROMPT_LIB, CONTROL_LIB, LIST_LIB, INTERNAL_LIB, SUBAGENT_LIB]) {
  if (!existsSync(lib)) throw new Error(`pristine lib absent (${lib}); failing closed`)
}
// ONE consistent module set: every consumer must resolve the SAME cordis.
const CORDIS_PATHS = [TOOLS_LIB, SYS_PROMPT_LIB, CONTROL_LIB, LIST_LIB, INTERNAL_LIB, SUBAGENT_LIB].map((lib) => createRequire(pathToFileURL(lib)).resolve('@deepseek-ai/cordis'))
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
const HOST_SUBAGENT = (await import(pathToFileURL(SUBAGENT_LIB).href)) as unknown as {
  SubagentError: new (message: string, code: string) => Error & { code: string; name: string }
}
const SUBAGENT_ERROR = HOST_SUBAGENT.SubagentError
if (typeof SUBAGENT_ERROR !== 'function' || SUBAGENT_ERROR.name !== 'SubagentError') {
  throw new Error('the published dsh-subagent bundle index answers no SubagentError class — baseline drift; failing closed')
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
const AGENT_REF: Record<string, unknown> = { id: 'agent-parent-live-1', session: { id: 'session-parent-1', header: {} } }
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
  setInterruptDenial: (error: Error | undefined) => void
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
    interruptDenial: undefined as Error | undefined,
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
        // Host-measured semantics: interrupt is SYNCHRONOUS void; a live
        // cross-authority target answers a thrown SubagentError UNAUTHORIZED
        // right here; an absent/one-shot/unknown target RETURNS (accepted
        // no-op) — the double models the no-op by simply not throwing.
        if (state.interruptDenial !== undefined) throw state.interruptDenial
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
    setInterruptDenial: (error) => {
      state.interruptDenial = error
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
  it('TYPE-ONLY admission mirrors the published schema (no minLength): type violations refuse typed, EMPTY strings are legal', async () => {
    const fixture = makeFixture()
    const assembly = mount(fixture)
    const send = assembly.rowOf('send_message')
    const list = assembly.rowOf('list_agents')
    const interrupt = assembly.rowOf('interrupt_agent')
    if (send === undefined || list === undefined || interrupt === undefined) throw new Error('no rows')
    expect(send.classify('nope')).toMatchObject({ ok: false, code: CODES.INPUT_INVALID })
    expect(send.classify({ agent_id: 'a-1', message: 7 })).toMatchObject({ ok: false, code: CODES.INPUT_INVALID })
    expect(send.classify({ agent_id: 'a-1' })).toMatchObject({ ok: false, code: CODES.INPUT_INVALID })
    expect(interrupt.classify({})).toMatchObject({ ok: false, code: CODES.INPUT_INVALID })
    expect(list.classify({ scope: 'siblings' })).toMatchObject({ ok: false, code: CODES.INPUT_INVALID })
    // FIX 1 (581-1): the published face is string/required with NO minLength
    // (measured on the REAL compiled parameters above) — the row must not
    // EXCEED it: empty strings classify AND dispatch to the service, which
    // owns the business refusal.
    expect(send.classify({ agent_id: '', message: '' }).ok).toBe(true)
    expect(interrupt.classify({ agent_id: '' }).ok).toBe(true)
    const definition = assembly.definitions.find((d) => d.name === 'send_message')
    if (definition === undefined) throw new Error('no def')
    const value = await definition.execute({ agent_id: '', message: '' }, EXEC)
    expect(value).toEqual({ messageId: 'msg-ack-7' }) // no lane refusal — the SERVICE sees the call
    const [, emptyTarget, emptyContent] = fixture.lastSend as [unknown, string, Array<{ text: string }>]
    expect(emptyTarget).toBe('')
    expect(emptyContent[0]?.text).toBe('')
    // plan target facts (measured ADJACENT law, FIX 3 wording):
    const ok = list.classify({})
    expect(ok.ok).toBe(true)
    expect(ok.plan?.target.contract).toContain('§B-SUBAGENT')
    expect(ok.plan?.target.address.claim).toBeNull()
    expect(ok.plan?.target.caller).toContain('LIVE exec.agent reference')
    expect(ok.plan?.target.budget).toContain('NOT claimed')
    const sendPlan = send.classify({ agent_id: 'agent-child-1', message: 'continue' })
    expect(sendPlan.plan?.target.address.claim).toBe('agent-child-1')
    expect(sendPlan.plan?.target.address.relation).toContain('DIRECT PARENT') // child→parent is legal
    expect(sendPlan.plan?.target.address.relation).toContain('siblings') // siblings NOT adjacent
    expect(fixture.calls).toEqual(['admit', 'sendMessage']) // only the empty-string dispatch reached the seam
  })
  it('PASS-THROUGH law (measured): non-record args answer the NATIVE\'S OWN ToolArgsError, never a coerced {} or a lane refusal', async () => {
    const fixture = makeFixture()
    const assembly = mount(fixture)
    const definition = assembly.definitions.find((d) => d.name === 'list_agents')
    if (definition === undefined) throw new Error('no def')
    const nativeList = REAL_NATIVES.list_agents as Definition | undefined
    if (nativeList === undefined) throw new Error('no real list_agents native')
    for (const bad of [null, undefined, 'nope', [1]]) {
      // Premise (REAL object): the Host-registered native refuses non-record
      // args with its compiled object-root validator BEFORE its body.
      const nativeError = await nativeList.execute(bad, EXEC).then(() => null, (e: unknown) => e as Error & { code?: string })
      if (nativeError === null) throw new Error('premise broken: the native accepted a non-record')
      expect(nativeError.name).toBe('ToolArgsError')
      expect(nativeError.code).toBe('INVALID_ARGS')
      // The placed definition answers the SAME published bytes (pass-through,
      // uncoerced) — never the module's own code, never a synthetic '{}'.
      const laneError = await definition.execute(bad, EXEC).then(() => null, (e: unknown) => e as Error & { code?: string; subagentRefusal?: unknown })
      if (laneError === null) throw new Error('the lane accepted a non-record')
      expect(laneError.subagentRefusal, 'not a lane refusal').toBeUndefined()
      expect(laneError.name).toBe('ToolArgsError')
      expect(laneError.code).toBe('INVALID_ARGS')
      expect(laneError.message).toBe(nativeError.message) // byte-identical to the Host-registered tool
    }
    expect(fixture.calls).toEqual([]) // ZERO port entry: the object root never admits a non-record
    // classify (the row's internal seat) refuses non-records TYPED — it never
    // coerces null/undefined to {} either.
    const row = assembly.rowOf('list_agents')
    if (row === undefined) throw new Error('no row')
    expect(row.classify(null)).toMatchObject({ ok: false, code: CODES.INPUT_INVALID })
    expect(row.classify(undefined)).toMatchObject({ ok: false, code: CODES.INPUT_INVALID })
  })
  it('the non-record ARGS REFUSAL rides the EDGE-VERIFIED handles (root 19:24): a re-bound or foreign native refuses DEFINITION_DRIFT with ZERO native entry — no unadmitted fallback', async () => {
    const fixture = makeFixture()
    const assembly = mount(fixture) // binds the CLEAN captured face
    const definition = assembly.definitions.find((d) => d.name === 'list_agents')
    if (definition === undefined) throw new Error('no def')
    const native = REAL_NATIVES.list_agents as Definition
    const poisoned = async () => 'POISON-args-accepted'
    // (a) SAME-OBJECT re-bind of the captured execute AFTER bind: the edge
    // catches the rebinding and the poison is NEVER invoked.
    const original = native.execute
    Object.defineProperty(native, 'execute', { value: poisoned, writable: true, configurable: true, enumerable: true })
    try {
      const error = await definition.execute(null, EXEC)
        .then(() => null, (e: unknown) => e as Error & { subagentRefusal?: { code?: string } })
      if (error === null) throw new Error('a drifted native answered the invalid-args call')
      expect(error.subagentRefusal?.code).toBe(CODES.DEFINITION_DRIFT)
      expect(error.message ?? '').not.toContain('POISON')
    } finally {
      Object.defineProperty(native, 'execute', { value: original, writable: true, configurable: true, enumerable: true })
    }
    expect(fixture.calls).toEqual([]) // zero port entry throughout
    // (b) FOREIGN OBJECT behind the live feed after bind (live !== bound.def).
    const fixture2 = makeFixture()
    let swapped = false
    const assembly2 = mount(fixture2, {
      liveNative: (name: string) => (swapped ? { ...(REAL_NATIVES[name] as Definition) } : (REAL_NATIVES[name] as Definition)),
    })
    const definition2 = assembly2.definitions.find((d) => d.name === 'list_agents')
    if (definition2 === undefined) throw new Error('no def 2')
    swapped = true
    const error2 = await definition2.execute('nope', EXEC)
      .then(() => null, (e: unknown) => e as Error & { subagentRefusal?: { code?: string } })
    if (error2 === null) throw new Error('a foreign definition answered the invalid-args call')
    expect(error2.subagentRefusal?.code).toBe(CODES.DEFINITION_DRIFT)
    expect(fixture2.calls).toEqual([])
  })
  it('OPEN parameter root (measured): unknown keys are NOT denied — they ride the plan to the service', () => {
    const fixture = makeFixture()
    const assembly = mount(fixture)
    const row = assembly.rowOf('list_agents')
    if (row === undefined) throw new Error('no row')
    const classified = row.classify({ scope: 'children', unknownKey: 42 })
    expect(classified.ok, 'no added unknown-key denial (the parameter root is open at Host)').toBe(true)
    expect(classified.plan?.args.unknownKey).toBe(42) // the snapshot carries it like Host carries it to the body
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
  it('ERROR REALITY (measured, FIX 4): interrupt accepts unknown/absent/one-shot targets as no-ops; ONLY live cross-authority targets answer the REAL published SubagentError UNAUTHORIZED — verbatim through the row', async () => {
    const fixture = makeFixture()
    const assembly = mount(fixture)
    const definition = assembly.definitions.find((d) => d.name === 'interrupt_agent')
    if (definition === undefined) throw new Error('no def')
    // Host-measured law (continuation-activation.ts): a target with NO live
    // Activation — one-shot or unknown id — is an ACCEPTED NO-OP: nothing
    // throws and {accepted:true} stands. The double models it by not
    // throwing (exactly what the service does: it returns).
    await expect(definition.execute({ agent_id: 'ghost-unknown-9' }, EXEC)).resolves.toEqual({ accepted: true })
    // Only a LIVE target whose recorded ancestry lacks the caller answers
    // the published class. The thrown instance is the REAL published
    // SubagentError (dsh-subagent's runtime bundle index — the module that
    // exports the class its own throw sites instantiate).
    const deny = new SUBAGENT_ERROR('subagent "agent-child-1" is not a live descendant of agent "agent-parent-live-1"', 'UNAUTHORIZED')
    fixture.setInterruptDenial(deny)
    const caught = await definition.execute({ agent_id: 'agent-child-1' }, EXEC).then(() => null, (e: unknown) => e)
    if (caught === null) throw new Error('the denial vanished — the row swallowed a service throw')
    expect(caught).toBeInstanceOf(SUBAGENT_ERROR) // instanceof the REAL published class
    expect((caught as Error & { code: string }).code).toBe('UNAUTHORIZED')
    expect(caught).toBe(deny) // verbatim: the exact instance, unmapped, unwrapped
    expect((caught as Error).name).toBe('SubagentError')
  })
  it('the published SubagentError face is real (premise pin): class identity, code carrier, Error lineage', () => {
    const probe = new SUBAGENT_ERROR('message delivery requires the exact live sender agent', 'UNAUTHORIZED')
    expect(probe).toBeInstanceOf(Error)
    expect(probe.name).toBe('SubagentError')
    expect(probe.code).toBe('UNAUTHORIZED')
    expect(new SUBAGENT_ERROR('x', 'UNAUTHORIZED')).not.toBeInstanceOf(TypeError)
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
  it('THE VERIFIED GET HANDLE IS THE INVOKED GET (FIX 2): captured at bind, re-verified at the edge, ZERO property re-reads at the projection site; a same-object get swap mid-flight never poisons the projection', async () => {
    const fixture = makeFixture()
    let getReads = 0
    let poisonHits = 0
    const invoked: unknown[] = []
    const good = (id: unknown) => {
      invoked.push(good)
      return fixture.registry.get(String(id))
    }
    const poison = () => {
      poisonHits += 1
      return { status: 'running' }
    }
    const impl = { current: good as (id: unknown) => unknown }
    const registry: Record<string, unknown> = {}
    Object.defineProperty(registry, 'get', {
      get: () => {
        getReads += 1
        return impl.current
      },
      set: (value: (id: unknown) => unknown) => {
        impl.current = value
      },
      configurable: true,
      enumerable: true,
    })
    // The swapped service performs the ATTACK while the list promise is in
    // flight (after the edge read, before any projection read): the registry
    // OBJECT stays the same, its get PROPERTY now answers the poison — the
    // exact pre-fix exposure at the per-row `agents.get` site.
    const innerListChildren = fixture.service.listChildren
    if (innerListChildren === undefined) throw new Error('no fixture listChildren')
    const listChildrenRide = innerListChildren as (...a: unknown[]) => Promise<readonly Record<string, unknown>[]>
    const swappedService = {
      ...fixture.service,
      listChildren: async (...args: unknown[]) => {
        const rows = await listChildrenRide(...args)
        impl.current = poison
        return rows
      },
    }
    const assembly = mount(fixture, {
      subagentService: swappedService,
      liveSubagentService: () => swappedService,
      agentsRegistry: registry,
      liveAgentsRegistry: () => registry,
    })
    expect(getReads, 'the assembly captures the get handle with EXACTLY one property read').toBe(1)
    const handedAtBind = impl.current // the function the bind verified
    const definition = assembly.definitions.find((d) => d.name === 'list_agents')
    const row = assembly.rowOf('list_agents')
    if (definition === undefined || row === undefined) throw new Error('no list row')
    const value = await definition.execute({}, EXEC) as readonly Record<string, unknown>[]
    expect(value).toEqual([
      { kind: 'child', id: 'agent-child-1', label: 'worker one', status: 'running' },
      { kind: 'child', id: 'agent-child-2', label: 'worker two', status: 'inactive' },
      { kind: 'diagnostic', id: 'agent-child-4', reason: 'corrupt' },
    ]) // the VERIFIED registry's data answered
    expect(poisonHits, 'the post-await property swap must never be invoked').toBe(0)
    expect(invoked.length).toBe(2) // exactly the two continuable rows
    expect(invoked.every((fn) => fn === handedAtBind), 'verified === invoked: ONE handle reference').toBe(true)
    expect(getReads, 'bind capture + the one edge read; ZERO reads at the projection site').toBe(2)
    // And a swap that lands BEFORE a dispatch refuses PORT_DRIFT at the edge
    // with ZERO service entry (the re-verification leg of the same handle law).
    impl.current = poison
    const plan = row.classify({}).plan
    if (plan === undefined) throw new Error('no plan')
    const before = fixture.calls.length
    expect(await row.delegate(plan, { exec: EXEC })).toMatchObject({ ok: false, code: CODES.PORT_DRIFT })
    expect(fixture.calls).toHaveLength(before)
    expect(poisonHits).toBe(0)
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
describe('a5m2-subagent-adapters (k) send_message ADJACENCY law as PLAN FACTS ONLY (root 19:24: no lane pre-adjudication; registry DOUBLE, disclosed as double)', () => {
  // The registry below carries the live Agent lineage shape EXACTLY as the
  // Host records it (measured: Agent.id IS the session id the bodies pass
  // around; session.header.parentSession is the recorded parent) — but for
  // root 19:24 the row reads NONE of it for send: the facts exist so the
  // legs can prove the row forwards non-adjacent targets to the SERVICE
  // anyway. The registry is a DOUBLE — disclosed as a double (C1
  // real-surface measurement, no Host session).
  const PARENT = { id: 'agent-parent-live-1', status: 'inactive', session: { id: 'session-parent-1', header: {} } }
  const CHILD = { id: 'agent-child-1', status: 'inactive', session: { id: 'session-child-1', header: { parentSession: 'agent-parent-live-1' } } }
  const SIBLING = { id: 'agent-sibling-2', status: 'inactive', session: { id: 'session-sibling-2', header: { parentSession: 'agent-parent-live-1' } } }
  const UNCLE = { id: 'agent-uncle-0', status: 'inactive', session: { id: 'session-uncle-0', header: { parentSession: 'agent-grand-1' } } }
  const COLD_CHILD = { id: 'agent-cold-3' } // live entry WITHOUT recorded lineage
  const liveAgents = new Map<string, Record<string, unknown>>([
    [PARENT.id, PARENT], [CHILD.id, CHILD], [SIBLING.id, SIBLING], [UNCLE.id, UNCLE], [COLD_CHILD.id, COLD_CHILD],
  ])
  const richRegistry = { get: (id: unknown) => liveAgents.get(String(id)) }
  const EXEC_CHILD = { agent: CHILD, signal: SIGNAL, callId: 'call-k-child' }
  const EXEC_PARENT = { agent: PARENT, signal: SIGNAL, callId: 'call-k-parent' }
  const mountK = (fixture: Fixture): AssemblyValue => mount(fixture, {
    agentsRegistry: richRegistry,
    liveAgentsRegistry: () => richRegistry,
  })

  it('parent→direct child AND resident child→DIRECT PARENT are admitted (the relation is ADJACENT, not a parent→child quantifier)', async () => {
    const fixture = makeFixture()
    const assembly = mountK(fixture)
    const definition = assembly.definitions.find((d) => d.name === 'send_message')
    if (definition === undefined) throw new Error('no def')
    await expect(definition.execute({ agent_id: 'agent-child-1', message: 'down' }, EXEC_PARENT)).resolves.toEqual({ messageId: 'msg-ack-7' })
    expect(fixture.lastSend[0]).toBe(PARENT)
    expect(fixture.lastSend[1]).toBe('agent-child-1')
    // child→parent — LEGAL for a resident continuable child (the residency
    // condition is the SERVICE's; the row never refuses a recorded parent):
    await expect(definition.execute({ agent_id: 'agent-parent-live-1', message: 'up' }, EXEC_CHILD)).resolves.toEqual({ messageId: 'msg-ack-7' })
    expect(fixture.lastSend[0]).toBe(CHILD) // the CHILD reference is the sender
    expect(fixture.lastSend[1]).toBe('agent-parent-live-1')
    // the bidirectional relation rides every send plan as a FACT:
    const row = assembly.rowOf('send_message')
    if (row === undefined) throw new Error('no row')
    const plan = row.classify({ agent_id: 'agent-parent-live-1', message: 'up' }).plan
    expect(plan?.target.address.relation).toContain('DIRECT PARENT')
    expect(plan?.target.address.relation).toContain('siblings')
    expect(plan?.target.address.adjudication).toContain('NO lineage pre-check')
  })
  it('sibling and uncle targets are SERVICE-ADJUDICATED (root 19:24): even with lineage facts in the live registry the row forwards the caller REFERENCE and raw claim; the REAL published SubagentError UNAUTHORIZED propagates VERBATIM — the row owns no adjacency code', async () => {
    const fixture = makeFixture()
    const assembly = mountK(fixture)
    const definition = assembly.definitions.find((d) => d.name === 'send_message')
    if (definition === undefined) throw new Error('no def')
    for (const [target, label] of [['agent-sibling-2', 'sibling'], ['agent-uncle-0', 'uncle']] as const) {
      const deny = new SUBAGENT_ERROR(`agent "${target}" is not addressable by sender "agent-child-1" (recorded lineage does not admit the address)`, 'UNAUTHORIZED')
      fixture.setServiceError(deny)
      const error = await definition.execute({ agent_id: target, message: 'x' }, EXEC_CHILD)
        .then(() => null, (e: unknown) => e as Error & { subagentRefusal?: unknown; code?: string })
      if (error === null) throw new Error(`the ${label} address vanished`)
      expect(error.subagentRefusal, `${label}: NO lane refusal — the SERVICE owns the deny`).toBeUndefined()
      expect(error).toBe(deny) // verbatim: the exact service instance, unmapped
      expect(error).toBeInstanceOf(SUBAGENT_ERROR) // instanceof the REAL published class
      expect(error.code).toBe('UNAUTHORIZED')
      expect(fixture.lastSend[0], 'the caller REFERENCE reached the service').toBe(CHILD)
      expect(fixture.lastSend[1], 'the raw claim reached the service').toBe(target)
      fixture.setServiceError(undefined)
    }
    // The closed code set carries NO adjacency authority (the 581-1
    // pre-check is deleted — target correction stays with the service):
    expect(Object.prototype.hasOwnProperty.call(CODES, 'NOT_ADJACENT')).toBe(false)
    expect(Object.values(CODES)).not.toContain('P_B_SUBAGENT_NOT_ADJACENT')
  })
  it('cold/unknown/unrecorded targets FLOW to the service (no positive grant is owned by the row; cold-resume is service-side)', async () => {
    const fixture = makeFixture()
    const assembly = mountK(fixture)
    const definition = assembly.definitions.find((d) => d.name === 'send_message')
    if (definition === undefined) throw new Error('no def')
    await expect(definition.execute({ agent_id: 'agent-cold-3', message: 'wake' }, EXEC_PARENT)).resolves.toEqual({ messageId: 'msg-ack-7' })
    await expect(definition.execute({ agent_id: 'ghost-not-live-77', message: 'durable child?' }, EXEC_PARENT)).resolves.toEqual({ messageId: 'msg-ack-7' })
    expect(fixture.calls.filter((c) => c === 'sendMessage')).toHaveLength(2)
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
    // FIX 3/4 wording (root 19:24): the gap carries the MEASURED adjacency
    // law as FACT with ALL authority service-side — the row pre-adjudicates
    // nothing, and the code set carries no authority addition.
    expect(ADAPTER.A5_B_SUBAGENT_NAMED_GAPS.LINEAGE_AUTHORITY).toContain('DIRECT PARENT')
    expect(ADAPTER.A5_B_SUBAGENT_NAMED_GAPS.LINEAGE_AUTHORITY).toContain('NO business pre-adjudication')
    expect(ADAPTER.A5_B_SUBAGENT_NAMED_GAPS.LINEAGE_AUTHORITY).toContain('UNAUTHORIZED')
    expect(ADAPTER.A5_B_SUBAGENT_NAMED_GAPS.LINEAGE_AUTHORITY).toContain('ACCEPTED NO-OP, not a deny')
    expect(ADAPTER.A5_B_SUBAGENT_NAMED_GAPS.UPSTREAM_NON_RECOGNITION).toContain('tool-agent-team')
    expect(Object.prototype.hasOwnProperty.call(ADAPTER.A5_B_SUBAGENT_CODES, 'NOT_ADJACENT')).toBe(false)
  })
})
