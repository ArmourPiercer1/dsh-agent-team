/**
 * A5M2-WORKFLOW-ADAPTERS — the B-ORCHESTRATION family spec (census records
 * 47 workflow / 48 ralph; contract M0-B-FAMILY-TARGET-CONTRACTS.md
 * §B-ORCHESTRATION).
 *
 * DELEGATION mode (settled house law): the published bodies hand the whole
 * run to the abstract engine seam (`start()` is its ENTIRE published face —
 * measured), so the rows DELEGATE to the captured native execute and
 * re-implement nothing. The natives are the REAL published products
 * @639ed01539: the pristine dsh-tool-workflow / dsh-tool-ralph libs' own
 * apply() run against the REAL Context + SystemPrompt + ToolRuntime harness
 * (the published registration points at tool-workflow :328 / tool-ralph
 * :411). The workflowEngine and subagents SERVICES are DOUBLES — the
 * published engine face is abstract; the shipped concrete engine belongs to
 * CENTER. That is C1-grade real-surface measurement, NOT C2 (no real
 * fan-out ran, no Host, no Windows; every engine/CENTER obligation is a
 * named gap).
 *
 * Legs: (a) census facts + purity; (b) REAL capture completeness (per-record
 * compiled shapes, presentation faces by reference, distinct output unions);
 * (c) assembly refusals (pairing SPLIT, split/partial delegates, half /
 * foreign captures); (d) thin presence+type mirror with zero delegate
 * entry + target facts; (e) the PER-RECORD byte-identical identity throws
 * (they DIFFER: 'workflow tool…' vs 'Ralph tool…'); (f) delegation fidelity
 * through the REAL bodies (engine start gets the LIVE parent reference +
 * signal, the foreground answer passes through VERBATIM, the abort→
 * run.cancel bridge fires, the MEASURED pre-abort asymmetry pins, engine
 * sync throws and the body's own lane throws propagate, disabled
 * run_in_background and jobs-unavailable pass through); (g) the memo with
 * the RE-START-A-SECOND-RUN pin; (h) drift matrix + verified-handle feed
 * pin + bind-time snapshot; (i/j) admit seat, registration keys, drain,
 * the six named gaps.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { findTestRepoRoot } from '../../../tests/paths.mjs'

// ── the production module under spec (hand-cast, house idiom) ─────────────
type PlanTarget = { contract: string; parent: string; child: { claim: string | null; adjudication: string }; action: string; revision: string; effect: string; budget: string; script: string }
type Plan = { rowName: string; recordIndex: number; operation: string; target: PlanTarget; args: Record<string, unknown>; parametersFingerprint: string; namedGaps: Record<string, string> }
type ClassifyResult = { ok: boolean; code?: string; detail?: string; plan?: Plan }
type DelegateResult = { ok?: boolean; code?: string; detail?: string; settled?: string; value?: unknown }
type Row = {
  name: string
  recordIndex: number
  mountCondition: string
  active: boolean
  classify: (args: unknown) => ClassifyResult
  delegate: (plan: Plan, ctx?: { exec?: unknown }) => Promise<DelegateResult>
}
type Definition = {
  [face: string]: unknown
  name: string
  description: string
  output: { schema: Record<string, unknown>; render: unknown }
  parameters?: Record<string, unknown>
  presentCall?: unknown
  presentResult?: unknown
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
  A5_B_ORCHESTRATION_FAMILY_ID: string
  A5_B_ORCHESTRATION_ADAPTER_REVISION: number
  A5_B_ORCHESTRATION_RECORD_SPECS: Record<string, { recordIndex: number; mountCondition: string; operation: string }>
  A5_B_ORCHESTRATION_TOOL_NAMES: string[]
  A5_B_ORCHESTRATION_EFFECT_LABELS: Record<string, string>
  A5_B_ORCHESTRATION_CODES: Record<string, string>
  A5_B_ORCHESTRATION_NAMED_GAPS: Record<string, string>
  createWorkflowAdapterAssembly: (input?: Record<string, unknown>) => AssemblyResult
}

const ADAPTER = (await import(new URL('../src/plugin/live/governed-families/workflow-adapters.mjs', import.meta.url).href)) as AdapterModule
const CODES = ADAPTER.A5_B_ORCHESTRATION_CODES
const NAMES = ADAPTER.A5_B_ORCHESTRATION_TOOL_NAMES

// ── the REAL published faces from the pristine baseline (fail closed) ─────
const REPO_ROOT = findTestRepoRoot(dirname(fileURLToPath(import.meta.url)))
if (REPO_ROOT === null) throw new Error('no repo root carrying tests/deepseek-harness-test-use — failing closed')
const HOST_PKG = (...rel: string[]): string => join(REPO_ROOT, 'tests', 'deepseek-harness-test-use', 'packages', ...rel)
const TOOLS_LIB = HOST_PKG('core', 'tools', 'lib', 'index.js')
const SYS_PROMPT_LIB = HOST_PKG('core', 'system-prompt', 'lib', 'index.js')
const WF_TOOL_LIB = HOST_PKG('workflow', 'tool-workflow', 'lib', 'index.js')
const RALPH_TOOL_LIB = HOST_PKG('workflow', 'tool-ralph', 'lib', 'index.js')
if (!existsSync(TOOLS_LIB) || !existsSync(SYS_PROMPT_LIB) || !existsSync(WF_TOOL_LIB) || !existsSync(RALPH_TOOL_LIB)) {
  throw new Error('pristine tools/system-prompt/tool-workflow/tool-ralph libs absent; failing closed')
}
const CORDIS_PATHS = [TOOLS_LIB, SYS_PROMPT_LIB, WF_TOOL_LIB, RALPH_TOOL_LIB].map((lib) => createRequire(pathToFileURL(lib)).resolve('@deepseek-ai/cordis'))
if (new Set(CORDIS_PATHS).size !== 1) {
  throw new Error(`host module set splits across cordis copies (${CORDIS_PATHS.join(' != ')}); failing closed`)
}
type HostContext = {
  plugin: (plugin: unknown, config?: Record<string, unknown>) => Promise<void>
  provide: (name: string, value: unknown) => void
  tools: { register: (definition: Record<string, unknown>) => () => void; get: (name: string) => Record<string, unknown> | undefined }
}
const HOST_TOOLS = (await import(pathToFileURL(TOOLS_LIB).href)) as unknown as { default: unknown }
const HOST_CORDIS = (await import(pathToFileURL(CORDIS_PATHS[0] as string).href)) as unknown as { Context: new () => HostContext }
const HOST_SYSTEM_PROMPT = ((await import(pathToFileURL(SYS_PROMPT_LIB).href)) as unknown as { default: unknown }).default
const HOST_WF_MINT = (await import(pathToFileURL(WF_TOOL_LIB).href)) as unknown as { apply: (ctx: unknown, config: Record<string, unknown>) => void }
const HOST_RALPH_MINT = (await import(pathToFileURL(RALPH_TOOL_LIB).href)) as unknown as { apply: (ctx: unknown, config: Record<string, unknown>) => void }

// the recorder (measured tool-workflow lib :115-121) reads run.meta.name and
// appends through parent.session.append — the session double answers that
// public append face (disclosed double).
const AGENT_REF: Record<string, unknown> = { id: 'agent-parent-orch-1', session: { id: 'session-parent-orch-1', append: () => undefined } }
const CONTROLLER = new AbortController()
const EXEC = { agent: AGENT_REF, signal: CONTROLLER.signal }
/** the placed execute reaches the body through a few awaits (admit,
 *  delegate) — flush the microtask queue before observing the engine. */
const flush = () => new Promise((resolve) => setImmediate(resolve))

/** The published engine face is abstract (start() only) — this double
 *  answers EXACTLY that face (disclosed double). */
type Harness = {
  ctx: HostContext
  starts: Array<Record<string, unknown>>
  cancels: Array<string | undefined>
  disposed: string[]
  providers: Map<string, Record<string, unknown>>
  failNextStart: (error: Error) => void
  completeNext: (result: Record<string, unknown>) => void
  pendingCount: () => number
}

async function makeHarness(): Promise<Harness> {
  const ctx = new HOST_CORDIS.Context()
  await ctx.plugin(HOST_SYSTEM_PROMPT, {})
  await ctx.plugin(HOST_TOOLS.default, {})
  const starts: Harness['starts'] = []
  const cancels: Harness['cancels'] = []
  const disposed: string[] = []
  const pending: Array<(result: Record<string, unknown>) => void> = []
  let nextStartError: Error | undefined
  let runs = 0
  const providers = new Map<string, Record<string, unknown>>([
    // requireFreshProvider (measured law): registered + outputSchema + NOT
    // inheritsParentContext — the fresh-structured-child C1 guarantee.
    ['spawn', { name: 'spawn', capabilities: { outputSchema: true }, inheritsParentContext: false }],
  ])
  await ctx.plugin({
    name: 'stub-host-services',
    apply: (inner: HostContext) => {
      inner.provide('subagents', { getProvider: (name: string) => providers.get(name) })
      inner.provide('workflowEngine', {
        // the abstract published face is EXACTLY start(request): WorkflowRun
        start: (spec: Record<string, unknown>) => {
          if (nextStartError !== undefined) {
            const error = nextStartError
            nextStartError = undefined
            throw error // the engine's META_INVALID/SCRIPT_PARSE land synchronously
          }
          starts.push(spec)
          runs += 1
          const id = `wf-run-${runs}`
          let resolveFn: (result: Record<string, unknown>) => void = () => undefined
          // the real WorkflowRun carries its meta (measured: the plugin's
          // own recorder reads run.meta.name) — the double honors that face.
          const run = {
            id,
            meta: (spec.meta as Record<string, unknown>) ?? {},
            result: new Promise<Record<string, unknown>>((resolve) => {
              resolveFn = resolve
            }),
            cancel: (reason?: string) => {
              cancels.push(reason)
            },
            dispose: async () => {
              disposed.push(id)
            },
          }
          pending.push((result) => resolveFn(result))
          return run
        },
      })
    },
  }, {})
  return {
    ctx,
    starts,
    cancels,
    disposed,
    providers,
    failNextStart: (error) => {
      nextStartError = error
    },
    completeNext: (result) => {
      pending.shift()?.(result)
    },
    pendingCount: () => pending.length,
  }
}

const WF_CONFIG = { toolName: 'workflow', maxResultChars: 50_000, enableRunInBackground: true }
const RALPH_CONFIG = { subagentProvider: 'spawn', maxRounds: 64, maxHandoffChars: 16_384, maxResultChars: 16_384 }

/** THE PRODUCTION CAPTURE SEAM: the two REAL published plugins' own
 *  apply() (the registration points at tool-workflow :328 / tool-ralph :411)
 *  against the real registration harness. */
async function captureRealNatives(): Promise<Record<string, Definition>> {
  const harness = await makeHarness()
  HOST_WF_MINT.apply(harness.ctx, WF_CONFIG)
  HOST_RALPH_MINT.apply(harness.ctx, RALPH_CONFIG)
  const defs: Record<string, Definition> = {}
  for (const name of NAMES) {
    const def = harness.ctx.tools.get(name)
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
    workflowDelegates: delegates,
    liveWorkflowDelegates: () => delegates,
    placementFeed: (name: string) => ({ definitionIdentity: `placed-${name}` }),
    admit: async () => ({ ok: true }),
    ...overrides,
  }
  const result = ADAPTER.createWorkflowAdapterAssembly(input)
  if (result.ok !== true) throw new Error(`mount fixture refused: ${result.code} — ${result.message}`)
  return result
}

const RALPH_OK_VALUE = {
  status: 'complete',
  roundsStarted: 1,
  report: { status: 'complete', summary: 'objective met', evidence: ['tests green'], nextSteps: [], blocker: '' },
}

// ── (a) frozen facts + purity ──────────────────────────────────────────────
describe('a5m2-workflow-adapters (a) census facts + purity', () => {
  it('census/contract facts (47 always / 48 declared_mount; family B-ORCHESTRATION)', () => {
    expect(ADAPTER.A5_B_ORCHESTRATION_FAMILY_ID).toBe('B-ORCHESTRATION')
    expect(ADAPTER.A5_B_ORCHESTRATION_ADAPTER_REVISION).toBe(1)
    expect([...NAMES]).toEqual(['workflow', 'ralph'])
    const specs = Object.fromEntries(Object.entries(ADAPTER.A5_B_ORCHESTRATION_RECORD_SPECS).map(([k, v]) => [k, [v.recordIndex, v.mountCondition]]))
    expect(specs).toEqual({ workflow: [47, 'always'], ralph: [48, 'declared_mount'] })
    expect(ADAPTER.A5_B_ORCHESTRATION_EFFECT_LABELS.workflow).toContain('agent-fanout-multiplicative-cost')
    expect(ADAPTER.A5_B_ORCHESTRATION_EFFECT_LABELS.ralph).toContain('agent-loop-rounds-multiplicative-cost')
  })
  it('module closure: exactly [node:crypto] in the CODE (ledger comments may name host internals)', () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'plugin', 'live', 'governed-families', 'workflow-adapters.mjs'), 'utf8')
    const code = source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, '')
    const statics = [...code.matchAll(/^import .* from '(.+)'$/gm)].map((m) => String(m[1]))
    expect(statics).toEqual(['node:crypto'])
    expect(code).not.toContain('import(')
    expect(code).not.toMatch(/require\(/)
  })
})

// ── (b) REAL capture completeness ─────────────────────────────────────────
describe('a5m2-workflow-adapters (b) real capture', () => {
  it('every placed definition carries EVERY REAL face by reference; only execute is replaced', () => {
    const assembly = mount()
    expect(assembly.definitions).toHaveLength(2)
    expect(assembly.declared).toEqual([])
    for (const definition of assembly.definitions) {
      const native = REAL_NATIVES[definition.name] as Definition
      expect(definition.description, definition.name).toBe(native.description)
      expect(definition.parameters, definition.name).toBe(native.parameters)
      expect(definition.output, definition.name).toBe(native.output)
      expect(definition.presentCall, definition.name).toBe(native.presentCall) // presentation faces ride too
      expect(typeof definition.presentCall, definition.name).toBe('function')
      expect(definition.execute, definition.name).not.toBe(native.execute)
    }
  })
  it('the REAL minted faces differ exactly where the published mints differ', () => {
    const wf = REAL_NATIVES.workflow as Definition
    const ralph = REAL_NATIVES.ralph as Definition
    const wfParams = wf.parameters as { properties?: Record<string, unknown>; required?: string[] }
    expect([...(wfParams.required ?? [])].sort()).toEqual(['meta', 'script'])
    expect(Object.keys(wfParams.properties ?? {}).sort()).toEqual(['args', 'meta', 'run_in_background', 'script'])
    const ralphParams = ralph.parameters as { properties?: Record<string, unknown>; required?: string[] }
    expect([...(ralphParams.required ?? [])].sort()).toEqual(['objective'])
    expect(Object.keys(ralphParams.properties ?? {}).sort()).toEqual(['maxRounds', 'objective'])
    expect(Array.isArray(wf.output.schema.oneOf)).toBe(true) // background|foreground union
    expect(ralph.output.schema.additionalProperties).toBe(false) // closed object output
  })
})

// ── (c) assembly refusals ─────────────────────────────────────────────────
describe('a5m2-workflow-adapters (c) assembly refusals', () => {
  it('missing feeds, split/partial/mispaired delegates, half/foreign captures', () => {
    const delegates = DELEGATES_FOR()
    const base: Record<string, unknown> = {
      captured: CAPTURE_FOR(),
      liveNative: (name: string) => REAL_NATIVES[name],
      workflowDelegates: delegates,
      liveWorkflowDelegates: () => delegates,
      placementFeed: (name: string) => ({ definitionIdentity: `placed-${name}` }),
      admit: async () => ({ ok: true }),
    }
    const refuse = (overrides: Record<string, unknown>): string => {
      const result = ADAPTER.createWorkflowAdapterAssembly({ ...base, ...overrides })
      if (result.ok === true) throw new Error('expected refusal')
      return result.code
    }
    expect(refuse({ admit: undefined })).toBe(CODES.ADMISSION_ABSENT)
    expect(refuse({ placementFeed: undefined })).toBe(CODES.INPUT_INVALID)
    expect(refuse({ workflowDelegates: undefined })).toBe(CODES.DELEGATES_ABSENT)
    expect(refuse({ liveWorkflowDelegates: undefined })).toBe(CODES.INPUT_INVALID)
    expect(refuse({ liveWorkflowDelegates: () => ({ ...delegates }) })).toBe(CODES.DELEGATE_DRIFT)
    // LAW 2026-10-25 (root C2): captured-native-only is NO LONGER required —
    // a governed RUNNER ADAPTER delegate (it takes over the public engine
    // consumer call with the per-run subagentProvider override) is a legal,
    // RULED delegation, not a split. The rebinding/container laws below
    // (edgeIntegrity per-dispatch identity) remain fatal drift.
    const rebuilt = { ...delegates, workflow: async () => ({ kind: 'foreground', runId: 'rebuilt', agentsStarted: 0, result: null }) }
    expect(ADAPTER.createWorkflowAdapterAssembly({ ...base, workflowDelegates: rebuilt, liveWorkflowDelegates: () => rebuilt }).ok, 'an adapter delegate assembles as the ruled runner take-over').toBe(true)
    const partial: Record<string, Definition['execute']> = { ...delegates }
    delete partial.ralph
    expect(refuse({ workflowDelegates: partial, liveWorkflowDelegates: () => partial })).toBe(CODES.DELEGATE_METHOD_ABSENT)
    expect(refuse({ captured: { ...CAPTURE_FOR(), subagent: CAPTURE_FOR().workflow } })).toBe(CODES.NON_FAMILY_CAPTURE)
    const { output: _output, ...noOutput } = REAL_NATIVES.workflow as Record<string, unknown>
    expect(refuse({ captured: { workflow: { native: noOutput as unknown as Definition, definitionIdentity: 'cap:x' } } })).toBe(CODES.CAPTURE_INCOMPLETE)
    expect(refuse({ liveNative: undefined })).toBe(CODES.LIVE_NATIVE_ABSENT)
    expect(refuse({ stranger: 1 })).toBe(CODES.INPUT_INVALID)
  })
  it('no captures ⇒ two honest DECLARED-INACTIVE rows (per-record mount conditions), zero registrations', () => {
    const assembly = mount({ captured: undefined })
    expect(assembly.definitions).toEqual([])
    expect(assembly.declared).toHaveLength(2)
    expect(assembly.familyRegistrations()).toEqual([])
    const row = assembly.rowOf('ralph')
    if (row === undefined) throw new Error('no row')
    expect(row.active).toBe(false)
    expect(row.mountCondition).toBe('declared_mount')
    expect(row.classify({ objective: 'x' })).toMatchObject({ ok: false, code: CODES.CAPTURE_ABSENT })
  })
})

// ── (d) thin mirror + targets ─────────────────────────────────────────────
describe('a5m2-workflow-adapters (d) thin mirror + targets', () => {
  it('presence+type mirror refuses typed with ZERO delegate entry; VALUE laws stay with the BODY/ENGINE', async () => {
    const assembly = mount()
    const wf = assembly.rowOf('workflow')
    const ralph = assembly.rowOf('ralph')
    if (wf === undefined || ralph === undefined) throw new Error('no rows')
    expect(wf.classify('nope')).toMatchObject({ ok: false, code: CODES.INPUT_INVALID })
    expect(wf.classify({ meta: { name: 'w', description: 'd' } })).toMatchObject({ ok: false, code: CODES.INPUT_INVALID })
    expect(wf.classify({ script: 7, meta: { name: 'w', description: 'd' } })).toMatchObject({ ok: false, code: CODES.INPUT_INVALID })
    expect(wf.classify({ script: 'return 1', meta: 'x' })).toMatchObject({ ok: false, code: CODES.INPUT_INVALID })
    expect(wf.classify({ script: 'return 1', meta: { name: 'w', description: 'd' }, run_in_background: 'yes' })).toMatchObject({ ok: false, code: CODES.INPUT_INVALID })
    // an EMPTY script is NOT refused here — META_INVALID/SCRIPT_PARSE are
    // the ENGINE throwing through the body (pinned in leg (f)); inventing
    // lane values for engine law would be duck-law.
    expect(wf.classify({ script: '', meta: { name: 'w', description: 'd' } }).ok).toBe(true)
    const plan = wf.classify({ script: 'return 1', meta: { name: 'demo', description: 'd' } }).plan
    if (plan === undefined) throw new Error('no plan')
    expect(plan.target.contract).toContain('§B-ORCHESTRATION')
    expect(plan.target.child.claim).toBeNull()
    expect(plan.target.child.adjudication).toContain('PRE_ENGINE_CHILD_FACTORY')
    expect(plan.target.script).toContain('never executes')
    expect(ralph.classify({ objective: 7 })).toMatchObject({ ok: false, code: CODES.INPUT_INVALID })
    expect(ralph.classify({ objective: 'x', maxRounds: '5' })).toMatchObject({ ok: false, code: CODES.INPUT_INVALID })
    const ralphPlan = ralph.classify({ objective: 'finish the migration' }).plan
    if (ralphPlan === undefined) throw new Error('no plan')
    expect(ralphPlan.target.budget).toContain('64') // the shipped preset ceiling is a BODY/deployment fact, named — not a row law
    expect(assembly.inFlight().dispatches).toBe(0)
  })
})

// ── (e) the live-caller law (per-record bytes DIFFER) ─────────────────────
describe('a5m2-workflow-adapters (e) live-caller law', () => {
  it('each row throws ITS OWN body\'s exact bytes (workflow vs Ralph — measured difference)', async () => {
    const assembly = mount()
    const wf = assembly.definitions.find((d) => d.name === 'workflow')
    const ralph = assembly.definitions.find((d) => d.name === 'ralph')
    if (wf === undefined || ralph === undefined) throw new Error('no defs')
    await expect(wf.execute({ script: 'return 1', meta: { name: 'w', description: 'd' } }, { signal: CONTROLLER.signal }))
      .rejects.toThrow(/^workflow tool requires a calling agent \(exec\.agent was undefined\)$/)
    await expect(ralph.execute({ objective: 'do it' }, { signal: CONTROLLER.signal }))
      .rejects.toThrow(/^Ralph tool requires a calling agent \(exec\.agent was undefined\)$/)
  })
})

// ── (f) delegation fidelity through the REAL captured bodies ──────────────
describe('a5m2-workflow-adapters (f) delegation fidelity', () => {
  it('workflow foreground: engine start gets the LIVE parent REFERENCE + signal; the answer passes through VERBATIM; the run is disposed', async () => {
    const harness = await makeHarness()
    HOST_WF_MINT.apply(harness.ctx, WF_CONFIG)
    const native = harness.ctx.tools.get('workflow') as unknown as Definition
    const delegates: Record<string, Definition['execute']> = { workflow: native.execute }
    const assembly = mount({
      captured: { workflow: { native, definitionIdentity: 'cap:workflow-live' } },
      liveNative: () => native,
      workflowDelegates: delegates,
      liveWorkflowDelegates: () => delegates,
    })
    const definition = assembly.definitions.find((d) => d.name === 'workflow')
    if (definition === undefined) throw new Error('no def')
    const settled = definition.execute({ script: 'return 42', meta: { name: 'demo', description: 'd' }, args: { k: 1 } }, EXEC)
    await flush()
    const spec = harness.starts[0] as Record<string, unknown>
    expect(spec.parent).toBe(AGENT_REF) // the LIVE reference INTO the engine request (L4)
    expect(spec.signal).toBe(CONTROLLER.signal)
    expect(spec.script).toBe('return 42')
    expect((spec.meta as Record<string, unknown>).name).toBe('demo')
    harness.completeNext({ stopReason: 'completed', agentsStarted: 3, value: { total: 42 } })
    expect(await settled).toEqual({ kind: 'foreground', runId: 'wf-run-1', agentsStarted: 3, result: { total: 42 } })
    expect(harness.disposed).toEqual(['wf-run-1']) // finally-run dispose — the body's law
  })
  it('the abort→run.cancel bridge FIRES mid-flight; and the MEASURED pre-abort asymmetry pins (workflow has no immediate check, ralph does)', async () => {
    const harness = await makeHarness()
    HOST_WF_MINT.apply(harness.ctx, WF_CONFIG)
    HOST_RALPH_MINT.apply(harness.ctx, RALPH_CONFIG)
    const wfNative = harness.ctx.tools.get('workflow') as unknown as Definition
    const ralphNative = harness.ctx.tools.get('ralph') as unknown as Definition
    const wfDelegates: Record<string, Definition['execute']> = { workflow: wfNative.execute }
    const wfAssembly = mount({
      captured: { workflow: { native: wfNative, definitionIdentity: 'cap:wf-abort' } },
      liveNative: () => wfNative,
      workflowDelegates: wfDelegates,
      liveWorkflowDelegates: () => wfDelegates,
    })
    const wf = wfAssembly.definitions.find((d) => d.name === 'workflow')
    if (wf === undefined) throw new Error('no def')
    const mid = new AbortController()
    const inflight = wf.execute({ script: 'return 1', meta: { name: 'w', description: 'd' } }, { agent: AGENT_REF, signal: mid.signal })
    await flush()
    mid.abort('step-cancelled')
    expect(harness.cancels).toEqual(['parent step aborted']) // the bridge (measured :441-443)
    harness.completeNext({ stopReason: 'cancelled', error: 'parent step aborted', agentsStarted: 0, value: null })
    await expect(inflight).rejects.toThrow(/^workflow run was cancelled \(parent step aborted\)$/) // stopReasonError bytes, verbatim
    // BODY-LEVEL ASYMMETRY pinned AT THE NATIVE FACE DIRECTLY (bypassing
    // the row — the row itself fail-closes pre-aborted dispatches, see the
    // next leg): a PRE-aborted signal fires no listener for the workflow
    // body, while the ralph body cancels immediately.
    const preAborted = new AbortController()
    preAborted.abort('already')
    const before = harness.cancels.length
    const staleNative = wfNative.execute({ script: 'return 1', meta: { name: 'w', description: 'd' } }, { agent: AGENT_REF, signal: preAborted.signal })
    await flush()
    expect(harness.cancels).toHaveLength(before) // workflow body: no pre-abort check (measured)
    harness.completeNext({ stopReason: 'completed', agentsStarted: 0, value: null })
    expect(await staleNative).toMatchObject({ kind: 'foreground' })
    // the ralph body DOES check explicitly (`if (exec.signal.aborted)
    // run.cancel(...)` before awaiting run.result — measured): the cancel
    // fires while the native execute call is still running synchronously.
    const beforeRalph = harness.cancels.length
    const immediateNative = ralphNative.execute({ objective: 'loop it' }, { agent: AGENT_REF, signal: preAborted.signal })
    expect(harness.cancels.length).toBe(beforeRalph + 1)
    expect(harness.cancels[harness.cancels.length - 1]).toBe('parent step aborted')
    harness.completeNext({ stopReason: 'cancelled', error: 'parent step aborted', agentsStarted: 0, value: null })
    await expect(immediateNative).rejects.toThrow(/^Ralph workflow was cancelled \(parent step aborted\)$/)
  })
  it('an admit-PENDING abort FAIL-CLOSES at the seam BEFORE the native body (root 20:05 P1; zero delegate entry, no job started or touched)', async () => {
    const harness = await makeHarness()
    HOST_WF_MINT.apply(harness.ctx, WF_CONFIG)
    HOST_RALPH_MINT.apply(harness.ctx, RALPH_CONFIG)
    const wfNative = harness.ctx.tools.get('workflow') as unknown as Definition
    const ralphNative = harness.ctx.tools.get('ralph') as unknown as Definition
    const delegates: Record<string, Definition['execute']> = { workflow: wfNative.execute, ralph: ralphNative.execute }
    const assembly = mount({
      captured: {
        workflow: { native: wfNative, definitionIdentity: 'cap:wf-failclosed' },
        ralph: { native: ralphNative, definitionIdentity: 'cap:ralph-failclosed' },
      },
      liveNative: (name: string) => (name === 'workflow' ? wfNative : ralphNative),
      workflowDelegates: delegates,
      liveWorkflowDelegates: () => delegates,
      admit: async () => {
        await flush() // the admit AWAIT stays pending across a macrotask — the race window
        return { ok: true }
      },
    })
    const wf = assembly.definitions.find((d) => d.name === 'workflow')
    const ralph = assembly.definitions.find((d) => d.name === 'ralph')
    if (wf === undefined || ralph === undefined) throw new Error('no defs')
    const mid = new AbortController()
    // THE exact measured Host gap: the runtime checks the signal only
    // before execute(), and the workflow BACKGROUND branch would race
    // synchronously into jobs.start — so the abort must fail closed at the
    // seam, not open a background run.
    const opening = wf.execute({ script: 'return 1', meta: { name: 'w', description: 'd' }, run_in_background: true }, { agent: AGENT_REF, signal: mid.signal })
    mid.abort('cancelled-while-admitting') // lands WHILE the admit await is pending
    const err = await opening.then(() => undefined, (e: unknown) => e as Error & { orchestrationRefusal?: { code?: string } })
    expect(err?.orchestrationRefusal?.code).toBe(CODES.CANCELLED_BEFORE_DISPATCH)
    expect(harness.starts).toHaveLength(0) // jobs.start NEVER reached — nothing started, nothing to kill
    // a straight pre-aborted dispatch refuses the same way, for both records
    const stale = ralph.execute({ objective: 'loop it' }, { agent: AGENT_REF, signal: mid.signal })
    const staleErr = await stale.then(() => undefined, (e: unknown) => e as Error & { orchestrationRefusal?: { code?: string } })
    expect(staleErr?.orchestrationRefusal?.code).toBe(CODES.CANCELLED_BEFORE_DISPATCH)
    expect(harness.starts).toHaveLength(0)
    expect(harness.pendingCount()).toBe(0) // no run was ever opened for either refusal
  })
  it('engine sync throws + the body\'s own lane throws propagate VERBATIM (no catch, no invented values)', async () => {
    const harness = await makeHarness()
    HOST_WF_MINT.apply(harness.ctx, WF_CONFIG)
    HOST_RALPH_MINT.apply(harness.ctx, RALPH_CONFIG)
    const wfNative = harness.ctx.tools.get('workflow') as unknown as Definition
    const ralphNative = harness.ctx.tools.get('ralph') as unknown as Definition
    const delegates: Record<string, Definition['execute']> = { workflow: wfNative.execute, ralph: ralphNative.execute }
    const assembly = mount({
      captured: { workflow: { native: wfNative, definitionIdentity: 'cap:wf-passthru' }, ralph: { native: ralphNative, definitionIdentity: 'cap:ralph-passthru' } },
      liveNative: (name: string) => (name === 'workflow' ? wfNative : ralphNative),
      workflowDelegates: delegates,
      liveWorkflowDelegates: () => delegates,
    })
    const wfRow = assembly.rowOf('workflow')
    const ralphRow = assembly.rowOf('ralph')
    if (wfRow === undefined || ralphRow === undefined) throw new Error('no rows')
    // the ENGINE validates META/SCRIPT synchronously at start() (tool-workflow
    // comment :425-427 — the measured LAW); the concrete engine's exact error
    // bytes are CENTER-side, so this probe error is explicitly SYNTHESIZED:
    // what is under test is that the row neither catches nor masks it.
    harness.failNextStart(new Error('SYNTHESIZED-engine-refusal: passthrough probe'))
    const wfPlan = (wfRow.classify({ script: 'return 1', meta: { name: 'BAD NAME', description: 'd' } }).plan) as Plan
    await expect(wfRow.delegate(wfPlan, { exec: EXEC })).rejects.toThrow(/^SYNTHESIZED-engine-refusal: passthrough probe$/)
    // the RALPH body's OWN lane throws (measured bytes)
    await expect(ralphRow.delegate((ralphRow.classify({ objective: '   ' }).plan) as Plan, { exec: EXEC })).rejects.toThrow(/^Ralph objective must be a non-empty string$/)
    await expect(ralphRow.delegate((ralphRow.classify({ objective: 'x', maxRounds: 999 }).plan) as Plan, { exec: EXEC })).rejects.toThrow(/^Ralph maxRounds 999 exceeds the deployment ceiling 64$/)
    harness.providers.delete('spawn')
    await expect(ralphRow.delegate((ralphRow.classify({ objective: 'x' }).plan) as Plan, { exec: EXEC })).rejects.toThrow(/^Ralph subagent provider "spawn" is not registered$/)
    harness.providers.set('spawn', { name: 'spawn', capabilities: { outputSchema: true }, inheritsParentContext: false })
    // and the ralph HAPPY path: engine start carries maxTotalAgents = the
    // resolved cap; the terminal read passes through VERBATIM
    const ralphValue = ralphRow.delegate((ralphRow.classify({ objective: 'ship it', maxRounds: 2 }).plan) as Plan, { exec: EXEC })
    await flush()
    const spec = harness.starts[harness.starts.length - 1] as Record<string, unknown>
    expect(spec.maxTotalAgents).toBe(2)
    expect(spec.subagentProvider).toBe('spawn')
    harness.completeNext({ stopReason: 'completed', agentsStarted: 2, value: RALPH_OK_VALUE })
    // the four refusals above all threw BEFORE start() (measured body order:
    // objective → resolveMaxRounds → requireFreshProvider → start), so this
    // is the harness's FIRST run.
    expect(await ralphValue).toMatchObject({ ok: true, value: { runId: 'wf-run-1', agentsStarted: 2, result: { status: 'complete', roundsStarted: 1 } } })
  })
  it('background law pass-through: disabled config throws the body\'s bytes; enabled-without-jobs names the missing piece', async () => {
    const harness = await makeHarness()
    HOST_WF_MINT.apply(harness.ctx, { ...WF_CONFIG, enableRunInBackground: false })
    const disabledNative = harness.ctx.tools.get('workflow') as unknown as Definition
    const disabledParams = disabledNative.parameters as { properties?: Record<string, unknown> }
    expect(disabledParams.properties).not.toHaveProperty('run_in_background') // the mint itself drops the field
    const disabledDelegates: Record<string, Definition['execute']> = { workflow: disabledNative.execute }
    const disabled = mount({
      captured: { workflow: { native: disabledNative, definitionIdentity: 'cap:wf-dis' } },
      liveNative: () => disabledNative,
      workflowDelegates: disabledDelegates,
      liveWorkflowDelegates: () => disabledDelegates,
    })
    const disRow = disabled.rowOf('workflow')
    if (disRow === undefined) throw new Error('no row')
    await expect(disRow.delegate((disRow.classify({ script: 'return 1', meta: { name: 'w', description: 'd' }, run_in_background: true }).plan) as Plan, { exec: EXEC }))
      .rejects.toThrow(/^run_in_background is disabled for this tool$/)
    // enabled mint, NO jobs service in this harness → the missing piece is NAMED
    const harness2 = await makeHarness()
    HOST_WF_MINT.apply(harness2.ctx, WF_CONFIG)
    const native2 = harness2.ctx.tools.get('workflow') as unknown as Definition
    const delegates2: Record<string, Definition['execute']> = { workflow: native2.execute }
    const enabled = mount({
      captured: { workflow: { native: native2, definitionIdentity: 'cap:wf-jobs' } },
      liveNative: () => native2,
      workflowDelegates: delegates2,
      liveWorkflowDelegates: () => delegates2,
    })
    const row2 = enabled.rowOf('workflow')
    if (row2 === undefined) throw new Error('no row')
    await expect(row2.delegate((row2.classify({ script: 'return 1', meta: { name: 'w', description: 'd' }, run_in_background: true }).plan) as Plan, { exec: EXEC }))
      .rejects.toThrow(/^background jobs unavailable: load @deepseek-ai\/dsh-jobs and @deepseek-ai\/dsh-tool-jobs$/)
    expect(harness2.starts).toHaveLength(0) // the throw precedes start()
  })
})

// ── (g) memo with the second-run boundary ─────────────────────────────────
describe('a5m2-workflow-adapters (g) plan memo + the second-run boundary', () => {
  it('consumed/foreign/stale refuse with zero delegate entry; a COPIED plan RE-STARTS a SECOND RUN (disclosed, pinned)', async () => {
    const harness = await makeHarness()
    HOST_WF_MINT.apply(harness.ctx, WF_CONFIG)
    const native = harness.ctx.tools.get('workflow') as unknown as Definition
    const delegates: Record<string, Definition['execute']> = { workflow: native.execute }
    const assembly = mount({
      captured: { workflow: { native, definitionIdentity: 'cap:wf-memo' } },
      liveNative: () => native,
      workflowDelegates: delegates,
      liveWorkflowDelegates: () => delegates,
    })
    const row = assembly.rowOf('workflow')
    if (row === undefined) throw new Error('no row')
    const plan = (row.classify({ script: 'return 1', meta: { name: 'w', description: 'd' } }).plan) as Plan
    const first = row.delegate(plan, { exec: EXEC })
    await flush()
    harness.completeNext({ stopReason: 'completed', agentsStarted: 1, value: null })
    expect(await first).toMatchObject({ ok: true, settled: 'delegated' })
    expect(await row.delegate(plan, { exec: EXEC })).toMatchObject({ ok: false, code: CODES.ALREADY_DISPATCHED })
    expect(harness.starts).toHaveLength(1) // same-object replay refused, zero entry
    const copied = { ...plan }
    const second = row.delegate(copied, { exec: EXEC })
    await flush()
    harness.completeNext({ stopReason: 'completed', agentsStarted: 1, value: null })
    expect(await second).toMatchObject({ ok: true, settled: 'delegated' })
    // PINNED HONEST BOUNDARY (NAMED GAP PLAN_ONCE_MEMO): the copy RE-STARTED
    // a SECOND FULL RUN (N more children). No idempotency carrier at this
    // seam — a disclosure, not a mitigation.
    expect(harness.starts).toHaveLength(2)
    expect(await row.delegate({ ...plan, rowName: 'ralph' }, { exec: EXEC })).toMatchObject({ ok: false, code: CODES.NOT_OWN_PLAN })
    expect(await row.delegate({ ...plan, parametersFingerprint: 'sha256:deadbeef' }, { exec: EXEC })).toMatchObject({ ok: false, code: CODES.PLAN_STALE })
  })
})

// ── (h) drift matrix + verified-handle + snapshot ─────────────────────────
describe('a5m2-workflow-adapters (h) drift + verified-handle + snapshot', () => {
  it('definition drift, delegate-set drift, rebound delegate — all refused before the body', async () => {
    let mode = 'bound'
    const delegates = DELEGATES_FOR()
    const assembly = mount({
      workflowDelegates: delegates,
      liveNative: (name: string) => {
        const native = REAL_NATIVES[name] as Definition
        return mode === 'def-drift' ? { ...native } : native
      },
      liveWorkflowDelegates: () => (mode === 'set-drift' ? { ...delegates } : delegates),
    })
    const row = assembly.rowOf('workflow')
    if (row === undefined) throw new Error('no row')
    const plan = (row.classify({ script: 'return 1', meta: { name: 'w', description: 'd' } }).plan) as Plan
    mode = 'def-drift'
    expect(await row.delegate(plan, { exec: EXEC })).toMatchObject({ ok: false, code: CODES.DEFINITION_DRIFT })
    mode = 'set-drift'
    expect(await row.delegate(plan, { exec: EXEC })).toMatchObject({ ok: false, code: CODES.DELEGATE_DRIFT })
    mode = 'bound'
    const rebound = delegates.workflow
    Object.defineProperty(delegates, 'workflow', { value: async () => ({ kind: 'foreground', runId: 'POISON', agentsStarted: 0, result: null }), writable: true, configurable: true, enumerable: true })
    expect(await row.delegate(plan, { exec: EXEC })).toMatchObject({ ok: false, code: CODES.DELEGATE_DRIFT })
    Object.defineProperty(delegates, 'workflow', { value: rebound, writable: true, configurable: true, enumerable: true })
    // (each ok:false refusal record above proves zero body entry: an
    //  entered body answers ok:true or throws — never a refusal record)
  })
  it('THE VERIFIED READ IS THE INVOKED READ — a feed turning over to a second set is never invoked', async () => {
    const harness = await makeHarness()
    HOST_WF_MINT.apply(harness.ctx, WF_CONFIG)
    const native = harness.ctx.tools.get('workflow') as unknown as Definition
    const good: Record<string, Definition['execute']> = { workflow: native.execute }
    let poisonHits = 0
    const poisoned: Record<string, Definition['execute']> = { workflow: (async () => {
      poisonHits += 1
      return { kind: 'foreground', runId: 'POISON', agentsStarted: 99, result: null }
    }) as Definition['execute'] }
    let reads = 0
    const assembly = mount({
      captured: { workflow: { native, definitionIdentity: 'cap:wf-handle' } },
      liveNative: () => native,
      workflowDelegates: good,
      liveWorkflowDelegates: () => {
        reads += 1
        return reads <= 2 ? good : poisoned // read 1 = assembly split-check, read 2 = the edge
      },
    })
    const definition = assembly.definitions.find((d) => d.name === 'workflow')
    if (definition === undefined) throw new Error('no def')
    const settled = definition.execute({ script: 'return 1', meta: { name: 'w', description: 'd' } }, EXEC)
    await flush()
    harness.completeNext({ stopReason: 'completed', agentsStarted: 1, value: 'ok' })
    expect(await settled).toMatchObject({ kind: 'foreground', runId: 'wf-run-1' }) // the VERIFIED body answered
    expect(poisonHits).toBe(0)
    expect(reads).toBe(2)
  })
  it('the BIND-TIME canonical snapshot catches IN-PLACE mutation; the reference-presentation law stands', async () => {
    const assembly = mount()
    const row = assembly.rowOf('workflow')
    if (row === undefined) throw new Error('no row')
    const plan = (row.classify({ script: 'return 1', meta: { name: 'w', description: 'd' } }).plan) as Plan
    const before = assembly.inFlight()
    const liveParams = (REAL_NATIVES.workflow as Definition).parameters as Record<string, unknown>
    expect(Object.isFrozen(liveParams), 'premise (measured): the compiled parameters object is live and mutable').toBe(false)
    liveParams.inPlaceMutation = true
    expect(await row.delegate(plan, { exec: EXEC })).toMatchObject({ ok: false, code: CODES.DEFINITION_DRIFT })
    expect(assembly.inFlight().dispatches).toBe(before.dispatches) // ZERO entries
    delete liveParams.inPlaceMutation
  })
})

// ── (i/j) admit + registration + drain + gaps ────────────────────────────
describe('a5m2-workflow-adapters (i/j) admit + registration + drain + gaps', () => {
  it('admit DENY throws the refusing side\'s own bytes with zero delegate entry', async () => {
    let seen: Record<string, unknown> = {}
    const assembly = mount({
      admit: async (ctx: Record<string, unknown>) => {
        seen = ctx
        return { ok: false, code: 'PA_DENY', detail: 'walk stopped' }
      },
    })
    const definition = assembly.definitions.find((d) => d.name === 'ralph')
    if (definition === undefined) throw new Error('no def')
    const error = await definition.execute({ objective: 'do it' }, EXEC).then(() => undefined, (e: unknown) => e as Error & { orchestrationRefusal?: { code?: string } })
    expect(error?.orchestrationRefusal?.code).toBe('PA_DENY')
    expect(seen).toMatchObject({ name: 'ralph', recordIndex: 48, familyId: 'B-ORCHESTRATION' })
    expect(seen.exec).toBe(EXEC)
  })
  it('familyRegistrations: placement keys only (2 records); ABSENT/MOVED throw; drain = new-call prohibition', () => {
    const assembly = mount()
    const registrations = assembly.familyRegistrations()
    expect(registrations.map((r) => [r.name, r.recordIndex])).toEqual([['workflow', 47], ['ralph', 48]])
    expect(registrations[0]?.entry).toEqual({ familyId: 'B-ORCHESTRATION', adapterRevision: 1, providerIdentity: 'b-orchestration' })
    const absent = mount({ placementFeed: () => undefined })
    expect(() => absent.familyRegistrations()).toThrow(new RegExp(`^${CODES.PLACEMENT_KEY_ABSENT}:`))
    let tick = 0
    const floating = mount({ placementFeed: (name: string) => ({ definitionIdentity: `placed-${name}-${(tick += 1)}` }) })
    floating.familyRegistrations()
    expect(() => floating.familyRegistrations()).toThrow(new RegExp(`^${CODES.PLACEMENT_KEY_MOVED}:`))
    assembly.drain()
    const row = assembly.rowOf('workflow')
    if (row === undefined) throw new Error('no row')
    expect(row.classify({ script: 'return 1', meta: { name: 'w', description: 'd' } })).toMatchObject({ ok: false, code: CODES.DRAINING })
  })
  it('the six named gaps ride every plan, never faked closed', () => {
    expect(Object.keys(ADAPTER.A5_B_ORCHESTRATION_NAMED_GAPS).sort()).toEqual([
      'CANCEL_BUDGET', 'CHILD_ADMISSION', 'PLAN_ONCE_MEMO', 'PRE_ENGINE_CHILD_FACTORY', 'RALPH_BOUND', 'SCRIPT_CAPS',
    ])
    expect(ADAPTER.A5_B_ORCHESTRATION_NAMED_GAPS.PRE_ENGINE_CHILD_FACTORY).toContain('受限child工厂')
    expect(ADAPTER.A5_B_ORCHESTRATION_NAMED_GAPS.CHILD_ADMISSION).toContain('nested Ask停在子body前')
    expect(ADAPTER.A5_B_ORCHESTRATION_NAMED_GAPS.PLAN_ONCE_MEMO).toContain('SECOND FULL RUN')
    const assembly = mount()
    const row = assembly.rowOf('workflow')
    if (row === undefined) throw new Error('no row')
    const plan = row.classify({ script: 'return 1', meta: { name: 'w', description: 'd' } }).plan
    if (plan === undefined) throw new Error('no plan')
    expect(plan.namedGaps).toBe(ADAPTER.A5_B_ORCHESTRATION_NAMED_GAPS)
  })
})
