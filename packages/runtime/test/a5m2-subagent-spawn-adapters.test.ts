/**
 * A5M2-SUBAGENT-SPAWN-ADAPTERS — the B-SUBAGENT SPAWN-SIDE subset spec
 * (census records 39 subagent / 40 subagent_fork / 41 subagent_codex /
 * 42 subagent_claude_code / 43 list_subagent_models; family B-SUBAGENT;
 * contract M0-B-FAMILY-TARGET-CONTRACTS.md §B-SUBAGENT).
 *
 * DELEGATION mode (settled B-TEAM house law): the published spawn bodies
 * own the service logic (provider resolution, route preflight, depth,
 * jobs, inbox acceptance), so the rows DELEGATE to the captured native
 * execute and re-implement nothing. The natives are the REAL published
 * products @639ed01539: the pristine dsh-tool-subagent lib's own apply()
 * runs against the REAL Context + SystemPrompt + ToolRuntime harness with a
 * provider present (the published mount path at index.ts :379), per-record
 * toolName/config — the production capture seam; list_subagent_models is
 * captured through the package's own exported registerListSubagentModels.
 * Provider stubs exist ONLY to satisfy the published mount gate; every
 * definition byte minted is the plugin's own.
 *
 * Legs: (a) census facts + purity; (b) REAL capture completeness (per-tool
 * wording differences included — fork wording, continuable wording);
 * (c) assembly refusals (pairing SPLIT, split/ partial delegates, half /
 * foreign captures); (d) thin dispatcher-shape mirror refusals with zero
 * delegate entry + target facts; (e) the byte-identical missing-caller
 * THROW for the four SPAWN bodies and its ABSENCE for the list read;
 * (f) delegation fidelity through the REAL captured bodies (continuable
 * inbox answer, foreground settle, live parent REFERENCE into the durable
 * request, abort, body throws propagating VERBATIM); (g) the memo with the
 * PINNED spawn copy boundary (a copy RE-SPAWNS — disclosed); (h) the drift
 * matrix + the verified-handle-IS-the-invoked-handle feed pin + the
 * bind-time parameters snapshot pin; (i/j) admit seat, registration keys,
 * drain, the five named gaps.
 *
 * HONEST DISCLOSURE (per ruling): REAL captured definitions + DOUBLES for
 * the subagents/llm services and the provider objects = C1-grade
 * real-surface measurement, NOT C2 (no real child, no external codex/claude
 * process, no Host, no Windows; the provider permission-enforceability and
 * pre-spawn closed-world obligations are named gaps, not this spec).
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { findTestRepoRoot } from '../../../tests/paths.mjs'

// ── the production module under spec (hand-cast, house idiom) ─────────────
type PlanTarget = { contract: string; parent: string; child: { claim: string | null; adjudication: string }; action: string; revision: string; effect: string; model: string; depth: string }
type Plan = { rowName: string; recordIndex: number; operation: string; target: PlanTarget; args: Record<string, unknown>; parametersFingerprint: string; namedGaps: Record<string, string> }
type ClassifyResult = { ok: boolean; code?: string; detail?: string; plan?: Plan }
type DelegateResult = { ok?: boolean; code?: string; detail?: string; settled?: string; value?: unknown }
type Row = {
  name: string
  recordIndex: number
  mountCondition: string
  active: boolean
  parameters: Record<string, unknown> | null
  classify: (args: unknown) => ClassifyResult
  delegate: (plan: Plan, ctx?: { exec?: unknown }) => Promise<DelegateResult>
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
  providerId: string
  subset: string
  definitions: Definition[]
  declared: Array<{ name: string; recordIndex: number; status: string; reason: string }>
  rowOf: (name: string) => Row | undefined
  drain: () => { event: string }
  inFlight: () => { dispatches: number; refuses: number }
  familyRegistrations: () => Registration[]
}
type AssemblyResult = AssemblyValue | { ok: false; code: string; message: string }
type AdapterModule = {
  A5_B_SUBAGENT_SPAWN_FAMILY_ID: string
  A5_B_SUBAGENT_SPAWN_ADAPTER_REVISION: number
  A5_B_SUBAGENT_SPAWN_RECORD_SPECS: Record<string, { recordIndex: number; mountCondition: string; operation: string }>
  A5_B_SUBAGENT_SPAWN_TOOL_NAMES: string[]
  A5_B_SUBAGENT_SPAWN_EFFECT_LABELS: Record<string, string>
  A5_B_SUBAGENT_SPAWN_CODES: Record<string, string>
  A5_B_SUBAGENT_SPAWN_NAMED_GAPS: Record<string, string>
  createSubagentSpawnAdapterAssembly: (input?: Record<string, unknown>) => AssemblyResult
}

const ADAPTER = (await import(new URL('../src/plugin/live/governed-families/subagent-spawn-adapters.mjs', import.meta.url).href)) as AdapterModule
const CODES = ADAPTER.A5_B_SUBAGENT_SPAWN_CODES
const NAMES = ADAPTER.A5_B_SUBAGENT_SPAWN_TOOL_NAMES

// ── the REAL published faces from the pristine baseline (fail closed) ─────
const REPO_ROOT = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
if (REPO_ROOT === null) throw new Error('no repo root carrying tests/deepseek-harness-test-use — failing closed')
const HOST_PKG = (...rel: string[]): string => join(REPO_ROOT, 'tests', 'deepseek-harness-test-use', 'packages', ...rel)
const TOOLS_LIB = HOST_PKG('core', 'tools', 'lib', 'index.js')
const SYS_PROMPT_LIB = HOST_PKG('core', 'system-prompt', 'lib', 'index.js')
const SPAWN_MINT_LIB = HOST_PKG('subagent', 'tool-subagent', 'lib', 'index.js')
if (!existsSync(TOOLS_LIB) || !existsSync(SYS_PROMPT_LIB) || !existsSync(SPAWN_MINT_LIB)) {
  throw new Error('pristine tools/system-prompt/tool-subagent libs absent; failing closed')
}
const CORDIS_PATHS = [TOOLS_LIB, SYS_PROMPT_LIB, SPAWN_MINT_LIB].map((lib) => createRequire(pathToFileURL(lib)).resolve('@deepseek-ai/cordis'))
if (new Set(CORDIS_PATHS).size !== 1) {
  throw new Error(`host module set splits across cordis copies (${CORDIS_PATHS.join(' != ')}); failing closed`)
}
// list-models is NOT a compiled export subpath, but the package PUBLISHES its
// source (exports "./src/*" — public); resolve it through the package's own
// self-reference so the mint is the package's own code.
const LIST_MODELS_URL = createRequire(pathToFileURL(SPAWN_MINT_LIB)).resolve('@deepseek-ai/dsh-tool-subagent/src/list-models.ts')
type HostContext = {
  plugin: (plugin: unknown, config?: Record<string, unknown>) => Promise<void>
  provide: (name: string, value: unknown) => void
  tools: { register: (definition: Record<string, unknown>) => () => void; get: (name: string) => Record<string, unknown> | undefined }
}
const HOST_TOOLS = (await import(pathToFileURL(TOOLS_LIB).href)) as unknown as { default: unknown }
const HOST_CORDIS = (await import(pathToFileURL(CORDIS_PATHS[0] as string).href)) as unknown as { Context: new () => HostContext }
const HOST_SYSTEM_PROMPT = ((await import(pathToFileURL(SYS_PROMPT_LIB).href)) as unknown as { default: unknown }).default
const HOST_SPAWN_MINT = (await import(pathToFileURL(SPAWN_MINT_LIB).href)) as unknown as { apply: (ctx: unknown, config: Record<string, unknown>, session?: unknown) => void }
const HOST_LIST_MODELS = (await import(pathToFileURL(LIST_MODELS_URL).href)) as unknown as {
  registerListSubagentModels: (ctx: unknown, policy: { routes: ReadonlyArray<{ provider: string; model: string }> }) => void
}

// the REAL spawn body reads parent.session.requestHeader()?.config (the
// latest-request route wins over creation options) and parent.options —
// the measured read surface of parentAgentOptionsForDelegation (subagent
// lib/index.js:414-424); the double answers "no request header yet".
const AGENT_REF: Record<string, unknown> = {
  id: 'agent-parent-spawn-1',
  session: { id: 'session-parent-spawn-1', requestHeader: () => undefined },
  options: {},
}
const CONTROLLER = new AbortController()
const EXEC = { agent: AGENT_REF, signal: CONTROLLER.signal }

/** What the captured REAL bodies touch at runtime — recorded doubles, the
 *  production ctx.subagents / llm surfaces (disclosed doubles). */
type Harness = {
  ctx: HostContext
  starts: Array<{ provider: string; request: Record<string, unknown> }>
  continuableStarts: Array<Record<string, unknown>>
}

async function makeHarness(): Promise<Harness> {
  const ctx = new HOST_CORDIS.Context()
  await ctx.plugin(HOST_SYSTEM_PROMPT, {})
  await ctx.plugin(HOST_TOOLS.default, {})
  const starts: Harness['starts'] = []
  const continuableStarts: Harness['continuableStarts'] = []
  const provider = (name: string, inherits: boolean, continuableCapable: boolean): Record<string, unknown> => ({
    name,
    capabilities: { depthLimit: true, agentOptions: true },
    inheritsParentContext: inherits,
    ...(continuableCapable ? { prepareContinuable: async () => ({}) } : {}),
  })
  const providers = new Map<string, Record<string, unknown>>([
    ['in-process-test', provider('in-process-test', false, true)],
    ['fork-test', provider('fork-test', true, false)],
    ['codex', provider('codex', false, false)],
    ['claude-code', provider('claude-code', false, false)],
  ])
  await ctx.plugin({
    name: 'stub-host-services',
    apply: (inner: HostContext) => {
      inner.provide('sessionProjections', { register: () => undefined })
      inner.provide('subagents', {
        getProvider: (name: string) => providers.get(name),
        resolveMaxDepth: (maxDepth: unknown) => (typeof maxDepth === 'number' ? maxDepth : undefined),
        start: async (name: string, request: Record<string, unknown>) => {
          starts.push({ provider: name, request })
          // 'completed' is the ONLY normal stopReason of the published
          // settle (stopReasonError: completed | aborted | error |
          // max-tokens | refusal; anything else = abnormal THROW).
          return { id: 'run-1', result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: 'child done' }] }), dispose: () => undefined }
        },
        startContinuable: async (opts: Record<string, unknown>) => {
          continuableStarts.push(opts)
          return { childId: 'sub-77' }
        },
      })
      inner.provide('llm', {
        listProviders: () => [{ id: 'p1', name: 'P1' }, { id: 'p2', name: 'P2' }],
        listModels: async () => [{ id: 'm1', name: 'M1' }],
        resolveModelInfo: async (_providerId: string, modelId: string) => ({ id: modelId, name: 'M1', reasoning: { efforts: [{ id: 'low', name: 'Low' }], defaultEffort: 'low' } }),
      })
    },
  }, {})
  return { ctx, starts, continuableStarts }
}

/** THE PRODUCTION CAPTURE SEAM: the REAL published plugin's apply() with a
 *  provider present (the mount path at index.ts :379), per-record config;
 *  list_subagent_models through the package's own exported register call. */
async function captureRealNatives(): Promise<Record<string, Definition>> {
  const harness = await makeHarness()
  const ctx = harness.ctx
  HOST_SPAWN_MINT.apply(ctx, { provider: 'in-process-test', toolName: 'subagent', enableRunInBackground: true, backgroundMode: 'continuable', maxDepth: 'provider-managed' })
  HOST_SPAWN_MINT.apply(ctx, { provider: 'fork-test', toolName: 'subagent_fork', enableRunInBackground: true, backgroundMode: 'one-shot', maxDepth: 'provider-managed' })
  HOST_SPAWN_MINT.apply(ctx, { provider: 'codex', toolName: 'subagent_codex', enableRunInBackground: true, backgroundMode: 'one-shot', maxDepth: 'provider-managed' })
  HOST_SPAWN_MINT.apply(ctx, { provider: 'claude-code', toolName: 'subagent_claude_code', enableRunInBackground: true, backgroundMode: 'one-shot', maxDepth: 'provider-managed' })
  HOST_LIST_MODELS.registerListSubagentModels(ctx, { routes: [{ provider: 'p1', model: 'm1' }] })
  const defs: Record<string, Definition> = {}
  for (const name of NAMES) {
    const def = ctx.tools.get(name)
    if (def === undefined) throw new Error(`the REAL host registered no tool '${name}' — baseline drift; failing closed`)
    defs[name] = def as unknown as Definition
  }
  return defs
}
const REAL_NATIVES = await captureRealNatives()

// ── lane-side doubles: delegates (the captured executes), admit, feeds ────
const CAPTURE_FOR = (): Record<string, { native: Definition; definitionIdentity: string }> =>
  Object.fromEntries(NAMES.map((name) => [name, { native: REAL_NATIVES[name] as Definition, definitionIdentity: `cap:${name}` }]))

const DELEGATES_FOR = (): Record<string, Definition['execute']> =>
  Object.fromEntries(NAMES.map((name) => [name, (REAL_NATIVES[name] as Definition).execute]))

function mount(overrides: Record<string, unknown> = {}): AssemblyValue {
  const delegates = DELEGATES_FOR()
  const input: Record<string, unknown> = {
    captured: CAPTURE_FOR(),
    liveNative: (name: string) => REAL_NATIVES[name],
    spawnDelegates: delegates,
    liveSpawnDelegates: () => delegates,
    placementFeed: (name: string) => ({ definitionIdentity: `placed-${name}` }),
    admit: async () => ({ ok: true }),
    ...overrides,
  }
  const result = ADAPTER.createSubagentSpawnAdapterAssembly(input)
  if (result.ok !== true) throw new Error(`mount fixture refused: ${result.code} — ${result.message}`)
  return result
}

// ── (a) frozen facts + purity ──────────────────────────────────────────────
describe('a5m2-subagent-spawn-adapters (a) census facts + purity', () => {
  it('census/contract spawn-side facts (records 39-43; per-record mount conditions)', () => {
    expect(ADAPTER.A5_B_SUBAGENT_SPAWN_FAMILY_ID).toBe('B-SUBAGENT')
    expect(ADAPTER.A5_B_SUBAGENT_SPAWN_ADAPTER_REVISION).toBe(1)
    expect([...NAMES]).toEqual(['subagent', 'subagent_fork', 'subagent_codex', 'subagent_claude_code', 'list_subagent_models'])
    const specs = Object.fromEntries(Object.entries(ADAPTER.A5_B_SUBAGENT_SPAWN_RECORD_SPECS).map(([k, v]) => [k, [v.recordIndex, v.mountCondition]]))
    expect(specs).toEqual({
      subagent: [39, 'always'],
      subagent_fork: [40, 'always'],
      subagent_codex: [41, 'declared_mount'],
      subagent_claude_code: [42, 'declared_mount'],
      list_subagent_models: [43, 'declared_mount'],
    })
  })
  it('module closure: exactly [node:crypto] in the CODE (ledger comments may name host internals)', () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'plugin', 'live', 'governed-families', 'subagent-spawn-adapters.mjs'), 'utf8')
    const code = source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, '')
    const statics = [...code.matchAll(/^import .* from '(.+)'$/gm)].map((m) => String(m[1]))
    expect(statics).toEqual(['node:crypto'])
    expect(code).not.toContain('import(')
    expect(code).not.toMatch(/require\(/)
  })
})

// ── (b) REAL capture completeness ─────────────────────────────────────────
describe('a5m2-subagent-spawn-adapters (b) real capture', () => {
  it('every placed definition carries EVERY REAL face by reference; only execute is replaced', () => {
    const assembly = mount()
    expect(assembly.definitions).toHaveLength(5)
    expect(assembly.declared).toEqual([])
    for (const definition of assembly.definitions) {
      const native = REAL_NATIVES[definition.name] as Definition
      expect(definition.description, definition.name).toBe(native.description)
      expect(definition.parameters, definition.name).toBe(native.parameters)
      expect(definition.output, definition.name).toBe(native.output)
      expect(definition.output.render, definition.name).toBe(native.output.render)
      expect(definition.execute, definition.name).not.toBe(native.execute)
    }
  })
  it('the REAL minted faces differ exactly where the published mint differs (fork wording, continuable wording, discovery tool)', () => {
    const sub = REAL_NATIVES.subagent as Definition
    const fork = REAL_NATIVES.subagent_fork as Definition
    const codex = REAL_NATIVES.subagent_codex as Definition
    const list = REAL_NATIVES.list_subagent_models as Definition
    expect(fork.description).toContain('inherits this conversation') // the fork providerWording branch
    expect(sub.description).not.toContain('inherits this conversation') // fresh-child wording
    expect(sub.description).toContain('background by default') // continuable background-default wording
    expect(codex.parameters).not.toBe(fork.parameters) // distinct compiled objects per mint
    expect(fork.description).toContain('waits')
    const listParameters = list.parameters as { properties?: Record<string, unknown>; required?: string[] }
    expect(Object.keys(listParameters.properties ?? {}).sort()).toEqual(['model', 'provider'])
    expect(listParameters.required).toBeUndefined() // no required fields on the read
    const subParameters = sub.parameters as { properties?: Record<string, unknown>; required?: string[] }
    expect([...(subParameters.required ?? [])].sort()).toEqual(['description', 'prompt'])
    expect(Object.keys(subParameters.properties ?? {}).sort()).toEqual(['description', 'prompt', 'run_in_background'])
  })
})

// ── (c) assembly refusals ─────────────────────────────────────────────────
describe('a5m2-subagent-spawn-adapters (c) assembly refusals', () => {
  it('missing feeds, split/partial/mispaired delegates, half/foreign captures', () => {
    const delegates = DELEGATES_FOR()
    const base: Record<string, unknown> = {
      captured: CAPTURE_FOR(),
      liveNative: (name: string) => REAL_NATIVES[name],
      spawnDelegates: delegates,
      liveSpawnDelegates: () => delegates,
      placementFeed: (name: string) => ({ definitionIdentity: `placed-${name}` }),
      admit: async () => ({ ok: true }),
    }
    const refuse = (overrides: Record<string, unknown>): string => {
      const result = ADAPTER.createSubagentSpawnAdapterAssembly({ ...base, ...overrides })
      if (result.ok === true) throw new Error('expected refusal')
      return result.code
    }
    expect(refuse({ admit: undefined })).toBe(CODES.ADMISSION_ABSENT)
    expect(refuse({ placementFeed: undefined })).toBe(CODES.INPUT_INVALID)
    expect(refuse({ spawnDelegates: undefined })).toBe(CODES.DELEGATES_ABSENT)
    expect(refuse({ liveSpawnDelegates: undefined })).toBe(CODES.INPUT_INVALID)
    expect(refuse({ liveSpawnDelegates: () => ({ ...delegates }) })).toBe(CODES.DELEGATE_DRIFT)
    const rebuilt = { ...delegates, subagent: async () => ({ kind: 'foreground', runId: 'rebuilt', output: [] }) }
    expect(refuse({ spawnDelegates: rebuilt, liveSpawnDelegates: () => rebuilt })).toBe(CODES.DELEGATE_SET_SPLIT)
    const partial: Record<string, Definition['execute']> = { ...delegates }
    delete partial.list_subagent_models
    expect(refuse({ spawnDelegates: partial, liveSpawnDelegates: () => partial })).toBe(CODES.DELEGATE_METHOD_ABSENT)
    expect(refuse({ captured: { ...CAPTURE_FOR(), send_message: CAPTURE_FOR().subagent } })).toBe(CODES.NON_FAMILY_CAPTURE)
    const { output: _output, ...noOutput } = REAL_NATIVES.subagent as Record<string, unknown>
    expect(refuse({ captured: { subagent: { native: noOutput as unknown as Definition, definitionIdentity: 'cap:x' } } })).toBe(CODES.CAPTURE_INCOMPLETE)
    expect(refuse({ liveNative: undefined })).toBe(CODES.LIVE_NATIVE_ABSENT)
    expect(refuse({ stranger: 1 })).toBe(CODES.INPUT_INVALID)
  })
  it('no captures ⇒ five honest DECLARED-INACTIVE rows (per-record mount conditions), zero registrations', async () => {
    const assembly = mount({ captured: undefined })
    expect(assembly.definitions).toEqual([])
    expect(assembly.declared).toHaveLength(5)
    expect(assembly.declared.find((d) => d.name === 'subagent_codex')?.reason).toBe('capture-absent')
    expect(assembly.familyRegistrations()).toEqual([])
    const row = assembly.rowOf('subagent_fork')
    if (row === undefined) throw new Error('no row')
    expect(row.active).toBe(false)
    expect(row.mountCondition).toBe('always')
    expect(row.classify({ description: 'd', prompt: 'p' })).toMatchObject({ ok: false, code: CODES.CAPTURE_ABSENT })
  })
})

// ── (d) thin mirror + targets ─────────────────────────────────────────────
describe('a5m2-subagent-spawn-adapters (d) thin mirror + targets', () => {
  it('dispatcher-shape mirror refuses typed with ZERO delegate entry; BODY laws stay with the BODY', async () => {
    const assembly = mount()
    const sub = assembly.rowOf('subagent')
    const list = assembly.rowOf('list_subagent_models')
    if (sub === undefined || list === undefined) throw new Error('no rows')
    expect(sub.classify('nope')).toMatchObject({ ok: false, code: CODES.INPUT_INVALID })
    expect(sub.classify({ prompt: 'p' })).toMatchObject({ ok: false, code: CODES.INPUT_INVALID })
    // REAL NATIVE DIFFERENCE (root review correction; the 639ed compiled
    // schema — tool-subagent params :390-399 + tools jsonschema :604 —
    // enforces required+type ONLY): an EMPTY description/prompt is LEGAL
    // native tool-layer input; the SERVICE owns any emptiness law, so the
    // row must NOT INPUT_INVALID first.
    expect(sub.classify({ description: 'd', prompt: '' }).ok).toBe(true)
    expect(sub.classify({ description: '', prompt: 'p' }).ok).toBe(true)
    expect(sub.classify({ description: 'd', prompt: 'p', provider: 7 })).toMatchObject({ ok: false, code: CODES.INPUT_INVALID })
    expect(sub.classify({ description: 'd', prompt: 'p', run_in_background: 'yes' })).toMatchObject({ ok: false, code: CODES.INPUT_INVALID })
    // provider WITHOUT model (and vice versa) is NOT refused here — the
    // pairing law is the BODY's ('model requires provider' is a body THROW,
    // pinned in leg (f)); inventing a lane value for it would be duck-law.
    expect(sub.classify({ description: 'd', prompt: 'p', provider: 'p1' }).ok).toBe(true)
    const plan = sub.classify({ description: 'ship', prompt: 'do the work' }).plan
    if (plan === undefined) throw new Error('no plan')
    expect(plan.target.contract).toContain('§B-SUBAGENT')
    expect(plan.target.child.claim).toBeNull() // the child identity is minted by the SERVICE
    expect(plan.target.child.adjudication).toContain('PRE_SPAWN_CLOSED_WORLD')
    expect(plan.target.model).toContain('row mirrors NONE')
    expect(list.classify({ model: 7 })).toMatchObject({ ok: false, code: CODES.INPUT_INVALID })
    expect(assembly.inFlight().dispatches).toBe(0) // every mirror answered with ZERO delegate entry
    // the native-acceptance PIN: empty strings ride THROUGH the captured
    // body to the SERVICE (the row never pre-refuses) — the body builds the
    // durable request with label ''/text '' and the service decides.
    const fork = assembly.rowOf('subagent_fork')
    if (fork === undefined) throw new Error('no fork row')
    const emptyPlan = fork.classify({ description: '', prompt: '' }).plan
    if (emptyPlan === undefined) throw new Error('empty strings must classify — the native accepts them')
    expect(await fork.delegate(emptyPlan, { exec: EXEC })).toMatchObject({ ok: true, settled: 'delegated' })
  })
})

// ── (e) the live-caller law (four SPAWN bodies THROW; the read does not) ──
describe('a5m2-subagent-spawn-adapters (e) live-caller law', () => {
  it('BLOCK SCOPED TO 39/40: the child-bearing rows refuse BEFORE the PA walk and BEFORE the body (module constant); 41/42 still throw the BODY\'S OWN bytes; list_subagent_models has no identity law', async () => {
    let admitCalls = 0
    const assembly = mount({ admit: async (ctx: Record<string, unknown>) => { admitCalls += 1; void ctx; return { ok: true } } })
    for (const name of ['subagent', 'subagent_fork']) {
      const definition = assembly.definitions.find((d) => d.name === name)
      if (definition === undefined) throw new Error('no def')
      // DUAL-PATH PIN (center card): the block precedes classify/admit, so
      // FOREGROUND-shaped AND background/continuable-shaped calls meet the
      // SAME refusal — the continuable path (manager create/resume, never
      // provider.start) is refused by this very ordering.
      for (const args of [{ description: 'd', prompt: 'p' }, { description: 'd', prompt: 'p', run_in_background: true }]) {
        await expect(definition.execute(args, { signal: CONTROLLER.signal }))
          .rejects.toThrow(/P_B_SPAWN_CHILD_GOVERNANCE_UNGOVERNED/)
      }
    }
    expect(admitCalls, 'the refusal precedes the PA walk: ZERO approval consumed').toBe(0)
    for (const name of ['subagent_codex', 'subagent_claude_code']) {
      const definition = assembly.definitions.find((d) => d.name === name)
      if (definition === undefined) throw new Error('no def')
      await expect(definition.execute({ description: 'd', prompt: 'p' }, { signal: CONTROLLER.signal }))
        .rejects.toThrow(/^subagent tool requires a calling agent \(exec\.agent was undefined\)$/)
    }
    // the list body reads, it does not delegate: NO exec.agent law (measured)
    const list = assembly.definitions.find((d) => d.name === 'list_subagent_models')
    if (list === undefined) throw new Error('no list def')
    const value = await list.execute({}, { signal: CONTROLLER.signal }) // no agent at all
    expect(typeof value).toBe('string') // answered by the captured body via the llm double
  })
})

// ── (f) delegation fidelity through the REAL captured bodies ──────────────
describe('a5m2-subagent-spawn-adapters (f) delegation fidelity', () => {
  it('continuable spawn (MECHANISM CARRIED ON THE UNBLOCKED RECORD 41 — the block covers 39/40 only): the durable request carries the LIVE parent REFERENCE; the inbox ack is the value', async () => {
    const harness = await makeHarness()
    // re-capture against THIS harness so the body's closure calls these doubles
    HOST_SPAWN_MINT.apply(harness.ctx, { provider: 'in-process-test', toolName: 'subagent_codex', enableRunInBackground: true, backgroundMode: 'continuable', maxDepth: 'provider-managed' })
    const native = harness.ctx.tools.get('subagent_codex') as unknown as Definition
    const delegates: Record<string, Definition['execute']> = { subagent_codex: native.execute }
    const assembly = mount({
      captured: { subagent_codex: { native, definitionIdentity: 'cap:codex-live' } },
      liveNative: () => native,
      spawnDelegates: delegates,
      liveSpawnDelegates: () => delegates,
    })
    const definition = assembly.definitions.find((d) => d.name === 'subagent_codex')
    if (definition === undefined) throw new Error('no def')
    const value = await definition.execute({ description: 'research', prompt: 'dig in' }, EXEC)
    expect(value).toEqual({ kind: 'continuable', subagentId: 'sub-77' })
    const call = harness.continuableStarts[0] as Record<string, unknown>
    expect(call.provider).toBe('in-process-test')
    const request = call.request as Record<string, unknown>
    expect(request.parent).toBe(AGENT_REF) // the LIVE reference into the durable request (L4)
    expect(request.label).toBe('research')
    expect(request.prompt).toEqual([{ type: 'text', text: 'dig in' }])
  })
  it('foreground spawn (carrier: the unblocked record 42): the settle answer passes through VERBATIM; abort reaches the body law', async () => {
    const harness = await makeHarness()
    HOST_SPAWN_MINT.apply(harness.ctx, { provider: 'fork-test', toolName: 'subagent_claude_code', enableRunInBackground: true, backgroundMode: 'one-shot', maxDepth: 'provider-managed' })
    const native = harness.ctx.tools.get('subagent_claude_code') as unknown as Definition
    const delegates: Record<string, Definition['execute']> = { subagent_claude_code: native.execute }
    const assembly = mount({
      captured: { subagent_claude_code: { native, definitionIdentity: 'cap:claude-live' } },
      liveNative: () => native,
      spawnDelegates: delegates,
      liveSpawnDelegates: () => delegates,
    })
    const definition = assembly.definitions.find((d) => d.name === 'subagent_claude_code')
    if (definition === undefined) throw new Error('no def')
    const value = await definition.execute({ description: 'review', prompt: 'read it' }, EXEC)
    expect(value).toEqual({ kind: 'foreground', runId: 'run-1', output: [{ type: 'text', text: 'child done' }] })
    expect(harness.starts[0]?.request.parent).toBe(AGENT_REF)
    const aborted = new AbortController()
    aborted.abort('user-cancel')
    await expect(definition.execute({ description: 'review', prompt: 'read it' }, { agent: AGENT_REF, signal: aborted.signal }))
      .rejects.toThrow() // exec.signal.throwIfAborted() — the BODY's law, verbatim
    expect(harness.starts).toHaveLength(1) // the second call never reached start
  })
  it('BODY throws propagate VERBATIM (no catch, no invented values): model-without-provider, empty provider, not-allowed provider', async () => {
    const harness = await makeHarness()
    HOST_LIST_MODELS.registerListSubagentModels(harness.ctx, { routes: [{ provider: 'p1', model: 'm1' }] })
    const native = harness.ctx.tools.get('list_subagent_models') as unknown as Definition
    const delegates: Record<string, Definition['execute']> = { list_subagent_models: native.execute }
    const assembly = mount({
      captured: { list_subagent_models: { native, definitionIdentity: 'cap:list-live' } },
      liveNative: () => native,
      spawnDelegates: delegates,
      liveSpawnDelegates: () => delegates,
    })
    const row = assembly.rowOf('list_subagent_models')
    if (row === undefined) throw new Error('no row')
    const plan = (row.classify({ model: 'm1' }).plan) as Plan // provider absent: the ROW allows (mirror), the BODY throws
    await expect(row.delegate(plan, { exec: { signal: CONTROLLER.signal } })).rejects.toThrow(/^`model` requires `provider`$/)
    const emptyProvider = (row.classify({ provider: '' }).plan) as Plan
    await expect(row.delegate(emptyProvider, { exec: { signal: CONTROLLER.signal } })).rejects.toThrow(/^`provider` must be non-empty$/)
    const notAllowed = (row.classify({ provider: 'nope' }).plan) as Plan
    await expect(row.delegate(notAllowed, { exec: { signal: CONTROLLER.signal } })).rejects.toThrow(/is not allowed for this Session$/)
  })
})

// ── (g) memo with the PINNED spawn copy boundary ──────────────────────────
describe('a5m2-subagent-spawn-adapters (g) plan memo + the spawn copy boundary', () => {
  it('consumed/foreign/stale refuse with zero delegate entry; a COPIED plan RE-SPAWNS (disclosed, pinned)', async () => {
    const harness = await makeHarness()
    HOST_SPAWN_MINT.apply(harness.ctx, { provider: 'fork-test', toolName: 'subagent_fork', enableRunInBackground: true, backgroundMode: 'one-shot', maxDepth: 'provider-managed' })
    const native = harness.ctx.tools.get('subagent_fork') as unknown as Definition
    const delegates: Record<string, Definition['execute']> = { subagent_fork: native.execute }
    const assembly = mount({
      captured: { subagent_fork: { native, definitionIdentity: 'cap:fork-memo' } },
      liveNative: () => native,
      spawnDelegates: delegates,
      liveSpawnDelegates: () => delegates,
    })
    const row = assembly.rowOf('subagent_fork')
    if (row === undefined) throw new Error('no row')
    const plan = (row.classify({ description: 'one', prompt: 'work' }).plan) as Plan
    expect(await row.delegate(plan, { exec: EXEC })).toMatchObject({ ok: true, settled: 'delegated' })
    const afterFirst = harness.starts.length
    expect(await row.delegate(plan, { exec: EXEC })).toMatchObject({ ok: false, code: CODES.ALREADY_DISPATCHED })
    expect(harness.starts).toHaveLength(afterFirst) // same-object replay refused, zero entry
    const copied = { ...plan }
    expect(await row.delegate(copied, { exec: EXEC })).toMatchObject({ ok: true, settled: 'delegated' })
    // PINNED HONEST BOUNDARY (NAMED GAP PLAN_ONCE_MEMO): the copy RE-SPAWNED
    // a SECOND child — spawn is non-idempotent and there is NO idempotency
    // carrier at this seam. This is a disclosure, not a mitigation.
    expect(harness.starts).toHaveLength(afterFirst + 1)
    expect(await row.delegate({ ...plan, rowName: 'subagent' }, { exec: EXEC })).toMatchObject({ ok: false, code: CODES.NOT_OWN_PLAN })
    expect(await row.delegate({ ...plan, parametersFingerprint: 'sha256:deadbeef' }, { exec: EXEC })).toMatchObject({ ok: false, code: CODES.PLAN_STALE })
  })
})

// ── (h) drift matrix + verified-handle + bind-time snapshot ───────────────
describe('a5m2-subagent-spawn-adapters (h) drift + verified-handle + snapshot', () => {
  it('definition drift, delegate-set drift, rebound delegate — ZERO delegate entry', async () => {
    let mode = 'bound'
    const delegates = DELEGATES_FOR()
    const assembly = mount({
      spawnDelegates: delegates,
      liveNative: (name: string) => {
        const native = REAL_NATIVES[name] as Definition
        return mode === 'def-drift' ? { ...native } : native
      },
      liveSpawnDelegates: () => (mode === 'set-drift' ? { ...delegates } : delegates),
    })
    const row = assembly.rowOf('subagent')
    if (row === undefined) throw new Error('no row')
    const plan = (row.classify({ description: 'd', prompt: 'p' }).plan) as Plan
    // Every drift below answers with a REFUSAL RECORD (not a throw, not a
    // value): had the call reached a REAL body, the FIRST capture's dead
    // doubles would surface a body error or a spawn instead — a refusal
    // record with ok:false IS the zero-delegate-entry proof.
    mode = 'def-drift'
    expect(await row.delegate(plan, { exec: EXEC })).toMatchObject({ ok: false, code: CODES.DEFINITION_DRIFT })
    mode = 'set-drift'
    expect(await row.delegate(plan, { exec: EXEC })).toMatchObject({ ok: false, code: CODES.DELEGATE_DRIFT })
    mode = 'bound'
    const rebound = delegates.subagent
    Object.defineProperty(delegates, 'subagent', { value: async () => ({ kind: 'continuable', subagentId: 'POISON' }), writable: true, configurable: true, enumerable: true })
    expect(await row.delegate(plan, { exec: EXEC })).toMatchObject({ ok: false, code: CODES.DELEGATE_DRIFT })
    Object.defineProperty(delegates, 'subagent', { value: rebound, writable: true, configurable: true, enumerable: true })
    // (each ok:false refusal record above already proves zero body entry:
    //  an entered body answers ok:true or throws — never a refusal record)
  })
  it('THE VERIFIED READ IS THE INVOKED READ — a feed turning over to a second set is never invoked', async () => {
    const harness = await makeHarness()
    HOST_SPAWN_MINT.apply(harness.ctx, { provider: 'fork-test', toolName: 'subagent_claude_code', enableRunInBackground: true, backgroundMode: 'one-shot', maxDepth: 'provider-managed' })
    const native = harness.ctx.tools.get('subagent_claude_code') as unknown as Definition
    const good: Record<string, Definition['execute']> = { subagent_claude_code: native.execute }
    let poisonHits = 0
    const poisoned: Record<string, Definition['execute']> = { subagent_claude_code: (async () => {
      poisonHits += 1
      return { kind: 'continuable', subagentId: 'POISON' }
    }) as Definition['execute'] }
    let reads = 0
    const assembly = mount({
      captured: { subagent_claude_code: { native, definitionIdentity: 'cap:claude-handle' } },
      liveNative: () => native,
      spawnDelegates: good,
      liveSpawnDelegates: () => {
        reads += 1
        return reads <= 2 ? good : poisoned // read 1 = assembly split-check, read 2 = the edge
      },
    })
    const definition = assembly.definitions.find((d) => d.name === 'subagent_claude_code')
    if (definition === undefined) throw new Error('no def')
    const value = await definition.execute({ description: 'd', prompt: 'p' }, EXEC)
    expect(value).toMatchObject({ kind: 'foreground', runId: 'run-1' }) // the VERIFIED body answered
    expect(poisonHits).toBe(0)
    expect(reads).toBe(2)
  })
  it('the BIND-TIME canonical snapshot catches IN-PLACE mutation of a captured face; the reference-presentation law stands', async () => {
    const assembly = mount()
    const row = assembly.rowOf('subagent')
    if (row === undefined) throw new Error('no row')
    const plan = (row.classify({ description: 'd', prompt: 'p' }).plan) as Plan
    const before = assembly.inFlight()
    const liveParams = (REAL_NATIVES.subagent as Definition).parameters as Record<string, unknown>
    expect(Object.isFrozen(liveParams), 'premise (measured): the compiled parameters object is live and mutable').toBe(false)
    liveParams.inPlaceMutation = true
    expect(await row.delegate(plan, { exec: EXEC })).toMatchObject({ ok: false, code: CODES.DEFINITION_DRIFT })
    expect(assembly.inFlight().dispatches).toBe(before.dispatches) // ZERO entries
    delete liveParams.inPlaceMutation
  })
})

// ── (i/j) admit + registration + drain + gaps ────────────────────────────
describe('a5m2-subagent-spawn-adapters (i/j) admit + registration + drain + gaps', () => {
  it('admit DENY throws the refusing side\'s own bytes with zero delegate entry', async () => {
    let seen: Record<string, unknown> = {}
    const assembly = mount({
      admit: async (ctx: Record<string, unknown>) => {
        seen = ctx
        return { ok: false, code: 'PA_DENY', detail: 'walk stopped' }
      },
    })
    const definition = assembly.definitions.find((d) => d.name === 'subagent_codex')
    if (definition === undefined) throw new Error('no def')
    const error = await definition.execute({ description: 'd', prompt: 'p' }, EXEC).then(() => undefined, (e: unknown) => e as Error & { spawnRefusal?: { code?: string } })
    expect(error?.spawnRefusal?.code).toBe('PA_DENY')
    expect(seen).toMatchObject({ name: 'subagent_codex', recordIndex: 41, familyId: 'B-SUBAGENT' })
    expect(seen.exec).toBe(EXEC)
  })
  it('familyRegistrations: placement keys only (5 records); ABSENT/MOVED throw; drain = new-call prohibition', () => {
    const assembly = mount()
    const registrations = assembly.familyRegistrations()
    expect(registrations.map((r) => [r.name, r.recordIndex]).sort()).toEqual([
      ['list_subagent_models', 43], ['subagent', 39], ['subagent_claude_code', 42], ['subagent_codex', 41], ['subagent_fork', 40],
    ])
    expect(registrations[0]?.entry).toEqual({ familyId: 'B-SUBAGENT', adapterRevision: 1, providerIdentity: 'b-subagent-spawn' })
    const absent = mount({ placementFeed: () => undefined })
    expect(() => absent.familyRegistrations()).toThrow(new RegExp(`^${CODES.PLACEMENT_KEY_ABSENT}:`))
    let tick = 0
    const floating = mount({ placementFeed: (name: string) => ({ definitionIdentity: `placed-${name}-${(tick += 1)}` }) })
    floating.familyRegistrations()
    expect(() => floating.familyRegistrations()).toThrow(new RegExp(`^${CODES.PLACEMENT_KEY_MOVED}:`))
    assembly.drain()
    const row = assembly.rowOf('subagent_fork')
    if (row === undefined) throw new Error('no row')
    expect(row.classify({ description: 'd', prompt: 'p' })).toMatchObject({ ok: false, code: CODES.DRAINING })
  })
  it('the five named gaps ride every plan, never faked closed', () => {
    expect(Object.keys(ADAPTER.A5_B_SUBAGENT_SPAWN_NAMED_GAPS).sort()).toEqual([
      'FORK_SEED', 'MODEL_ROUTES_FRESHNESS', 'PLAN_ONCE_MEMO', 'PRE_SPAWN_CLOSED_WORLD', 'PROVIDER_ENVELOPE',
    ])
    expect(ADAPTER.A5_B_SUBAGENT_SPAWN_NAMED_GAPS.PRE_SPAWN_CLOSED_WORLD).toContain('不能先spawn再补Guard')
    expect(ADAPTER.A5_B_SUBAGENT_SPAWN_NAMED_GAPS.PROVIDER_ENVELOPE).toContain('zero tool registration')
    expect(ADAPTER.A5_B_SUBAGENT_SPAWN_NAMED_GAPS.PLAN_ONCE_MEMO).toContain('RE-SPAWNS')
    const assembly = mount()
    const row = assembly.rowOf('subagent_codex')
    if (row === undefined) throw new Error('no row')
    const plan = row.classify({ description: 'd', prompt: 'p' }).plan
    if (plan === undefined) throw new Error('no plan')
    expect(plan.namedGaps).toBe(ADAPTER.A5_B_SUBAGENT_SPAWN_NAMED_GAPS)
  })
})
