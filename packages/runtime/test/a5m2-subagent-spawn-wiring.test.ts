/**
 * A5M2-SUBAGENT-SPAWN-WIRING — the PRODUCTION WIRING spec for the B-SUBAGENT
 * spawn side (records 39-43). The ROW laws are owned by
 * a5m2-subagent-spawn-adapters.test.ts and are NOT re-litigated here (root
 * ruling: no repeated component tests). This spec owns exactly the WIRING
 * facts:
 *  (a) the wiring assembly gates (placementFeed / paAdmit / realmId /
 *      captured REQUIRED — no unadmitted mount exists);
 *  (b) REAL captured definitions @639ed01539 travel through the wiring
 *      untouched (every face by reference, only execute replaced);
 *  (c) the admit seat → the PLANE'S PA WALK: the exact public envelope —
 *      toolName, the real exec.callId (never synthesized), the closed
 *      [{kind:'tool-invoke',toolName,resource:null}] effect vocabulary, the
 *      plan's OWN parametersFingerprint (never recomputed), and the four
 *      family P-adds with targetManifest === plan.target BY REFERENCE;
 *      ok:true admits and the REAL captured body then runs;
 *  (d) answer mapping WITHOUT rewriting verdicts: PA deny travels with
 *      PA's own code bytes; PA's own `allow+cancelled` answers the wiring's
 *      CALL_CANCELLED; no exec.callId fails closed before PA is even asked;
 *      an unrecognizable answer fails closed; a THROWING paAdmit propagates
 *      verbatim (the wiring catches nothing);
 *  (e) registration keys come from the PLANE FEED only (not the captured
 *      identity); an absent feed throws, never guesses;
 *  (f) the import closure: the wiring module imports exactly ONE project
 *      module — the adapter — and nothing else.
 *
 * HONEST DISCLOSURE: real published definitions + DOUBLE for the plane's
 * paAdmit + doubles for the subagents service = C1-grade real-surface
 * measurement, NOT C2 (the real PA walk's durable leg lives in the plane;
 * the named gaps of the adapter module are unchanged by wiring).
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { findTestRepoRoot } from '../../../tests/paths.mjs'
import { PA_FAMILY_TARGET_RULES, validatePaFamilyTarget } from '../control/types.js'
import { A5_B_SUBAGENT_SPAWN_CANONICAL_JSON, A5_B_SUBAGENT_SPAWN_NAMED_GAPS } from '../src/plugin/live/governed-families/subagent-spawn-adapters.mjs'

type Definition = {
  [face: string]: unknown
  name: string
  description: string
  output: { schema: unknown; render: unknown }
  parameters?: Record<string, unknown>
  execute: (args: unknown, exec: Record<string, unknown>) => Promise<unknown>
}
type PaRequest = {
  realmId?: string
  callId?: string
  parametersFingerprint?: string
  requestedEffects?: { effects: Array<{ kind: string; toolName?: string; resource: unknown }>; fingerprint?: string }
  toolName?: string
  signal?: unknown
  family?: { familyId?: string; adapterRevision?: number; providerIdentity?: string; definitionIdentity?: string; targetManifest?: unknown }
}
type SpawnTarget = { contract: string; parent: string; child: { claim: string | null; adjudication: string }; action: string; revision: string; effect: string; model: string; depth: string }
type WiringValue = {
  familyId: string
  adapterRevision: number
  wiringRevision: number
  providerId: string
  realmId: string
  mountNames: readonly string[]
  definitions: Definition[]
  declared: Array<{ name: string; recordIndex: number; status: string; reason: string }>
  rowOf: (name: string) => { classify: (args: unknown) => { ok: boolean; plan?: { parametersFingerprint: string; operation: string; target: SpawnTarget; args: Record<string, unknown>; namedGaps: Record<string, string> } } } | undefined
  familyRegistrations: () => Array<{ name: string; definitionIdentity: string; entry: { familyId: string; adapterRevision: number; providerIdentity: string } }>
  wiringCodes: Record<string, string>
}
type WiringModule = {
  A5_B_SPAWN_WIRING_REVISION: number
  A5_B_SPAWN_WIRING_CODES: Record<string, string>
  createSubagentSpawnWiring: (input?: Record<string, unknown>) => { ok: true; wiring: WiringValue } | { ok: false; code: string; message: string }
}

const WIRING = (await import(new URL('../src/plugin/live/governed-families/subagent-spawn-wiring.mjs', import.meta.url).href)) as unknown as WiringModule
const ADAPTER = (await import(new URL('../src/plugin/live/governed-families/subagent-spawn-adapters.mjs', import.meta.url).href)) as unknown as { A5_B_SUBAGENT_SPAWN_TOOL_NAMES: string[] }
const CODES = WIRING.A5_B_SPAWN_WIRING_CODES
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
if (new Set(CORDIS_PATHS).size !== 1) throw new Error('host module set splits across cordis copies; failing closed')
const LIST_MODELS_URL = createRequire(pathToFileURL(SPAWN_MINT_LIB)).resolve('@deepseek-ai/dsh-tool-subagent/src/list-models.ts')

const HOST_TOOLS = (await import(pathToFileURL(TOOLS_LIB).href)) as unknown as { default: unknown }
const HOST_CORDIS = (await import(pathToFileURL(CORDIS_PATHS[0] as string).href)) as unknown as { Context: new () => { plugin: (p: unknown, c?: Record<string, unknown>) => Promise<void>; provide: (n: string, v: unknown) => void; tools: { get: (n: string) => Record<string, unknown> | undefined } } }
const HOST_SYSTEM_PROMPT = ((await import(pathToFileURL(SYS_PROMPT_LIB).href)) as unknown as { default: unknown }).default
const HOST_SPAWN_MINT = (await import(pathToFileURL(SPAWN_MINT_LIB).href)) as unknown as { apply: (ctx: unknown, config: Record<string, unknown>, session?: unknown) => void }
const HOST_LIST_MODELS = (await import(pathToFileURL(LIST_MODELS_URL).href)) as unknown as { registerListSubagentModels: (ctx: unknown, policy: { routes: ReadonlyArray<{ provider: string; model: string }> }) => void }

const AGENT_REF: Record<string, unknown> = {
  id: 'agent-parent-wire-1',
  session: { id: 'session-parent-wire-1', requestHeader: () => undefined, append: () => undefined },
  options: {},
}
const CONTROLLER = new AbortController()

async function captureRealNatives(): Promise<Record<string, Definition>> {
  const ctx = new HOST_CORDIS.Context()
  await ctx.plugin(HOST_SYSTEM_PROMPT, {})
  await ctx.plugin(HOST_TOOLS.default, {})
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
    apply: (inner: { provide: (n: string, v: unknown) => void }) => {
      inner.provide('sessionProjections', { register: () => undefined })
      inner.provide('subagents', {
        getProvider: (name: string) => providers.get(name),
        resolveMaxDepth: (maxDepth: unknown) => (typeof maxDepth === 'number' ? maxDepth : undefined),
        start: async (name: string, request: Record<string, unknown>) => {
          SERVICE_STARTS.push({ provider: name, request })
          return { id: 'run-w1', result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: 'child done' }] }), dispose: () => undefined }
        },
        startContinuable: async (opts: Record<string, unknown>) => { CONTINUABLE.push(opts); return { childId: 'sub-77' } },
      })
      inner.provide('llm', { listProviders: () => [{ id: 'p1', name: 'P1' }], listModels: async () => [{ id: 'm1', name: 'M1' }], resolveModelInfo: async (_p: string, m: string) => ({ id: m, name: 'M1', reasoning: { efforts: [{ id: 'low', name: 'Low' }], defaultEffort: 'low' } }) })
    },
  }, {})
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
const SERVICE_STARTS: Array<{ provider: string; request: Record<string, unknown> }> = []
const CONTINUABLE: Array<Record<string, unknown>> = []
const REAL_NATIVES = await captureRealNatives()

// ── the wiring-side doubles: a RECORDING plane paAdmit + a plane feed ─────
// THE REAL PA PROTOCOL (root 20:41 fix 2): `ok:true` is NOT an answer the
// real walk ever produces — the spec answers with the plane's own shapes:
// {kind:'allow',consumedProof} / bare {kind:'allow'} / {kind:'allow',
// cancelled:true} / {kind:'deny',code,detail}.
const REAL_PROOF = { grant: 'grant-w-1', lease: 'lease-w-1', spentOnce: true }
const PA_CALLS: PaRequest[] = []
let paAnswer: Record<string, unknown> = { kind: 'allow', consumedProof: REAL_PROOF }
const recordingPaAdmit = async (request: PaRequest): Promise<Record<string, unknown>> => {
  PA_CALLS.push(request)
  return paAnswer
}
const PLANE_FEED = (name: string): { definitionIdentity: string; realmId: string } => ({ definitionIdentity: `def#4${name.length}-${name}`, realmId: 'a5-realm-wire' })

function wire(overrides: Record<string, unknown> = {}): WiringValue {
  const captured = Object.fromEntries(NAMES.map((name) => [name, { native: REAL_NATIVES[name] as Definition, definitionIdentity: `cap:${name}` }]))
  const delegates = Object.fromEntries(NAMES.map((name) => [name, (REAL_NATIVES[name] as Definition).execute]))
  const built = WIRING.createSubagentSpawnWiring({
    providerId: 'a5p5-plane',
    realmId: 'a5-realm-wire',
    captured,
    liveNative: (name: string) => REAL_NATIVES[name],
    spawnDelegates: delegates,
    liveSpawnDelegates: () => delegates,
    placementFeed: PLANE_FEED,
    paAdmit: recordingPaAdmit,
    ...overrides,
  })
  if (built.ok !== true) throw new Error(`wiring fixture refused: ${built.code} — ${built.message}`)
  return built.wiring
}

describe('a5m2-subagent-spawn-wiring (a) assembly gates', () => {
  it('placementFeed / paAdmit / realmId / captured are REQUIRED — no open mount is ever built', () => {
    const refuse = (overrides: Record<string, unknown>): string => {
      const captured = Object.fromEntries(NAMES.map((n) => [n, { native: REAL_NATIVES[n] as Definition, definitionIdentity: `cap:${n}` }]))
      const delegates = Object.fromEntries(NAMES.map((n) => [n, (REAL_NATIVES[n] as Definition).execute]))
      const built = WIRING.createSubagentSpawnWiring({
        realmId: 'a5-realm-wire',
        captured,
        liveNative: (n: string) => REAL_NATIVES[n],
        spawnDelegates: delegates,
        liveSpawnDelegates: () => delegates,
        placementFeed: PLANE_FEED,
        paAdmit: recordingPaAdmit,
        ...overrides,
      })
      if (built.ok === true) throw new Error('expected refusal')
      return built.code
    }
    expect(refuse({ paAdmit: undefined })).toBe(CODES.ADMISSION_ABSENT)
    expect(refuse({ placementFeed: undefined })).toBe(CODES.INPUT_INVALID)
    expect(refuse({ realmId: '' })).toBe(CODES.INPUT_INVALID)
    expect(refuse({ captured: undefined })).toBe(CODES.INPUT_INVALID)
  })
})

describe('a5m2-subagent-spawn-wiring (b) real faces travel untouched', () => {
  it('wiring adds NO definition shape: every REAL face by reference, only execute replaced', () => {
    const wiring = wire()
    expect(wiring.familyId).toBe('B-SUBAGENT')
    expect(wiring.adapterRevision).toBe(2) // the mount's registered generation (root 22:02)
    expect(wiring.wiringRevision).toBe(WIRING.A5_B_SPAWN_WIRING_REVISION)
    expect(wiring.definitions).toHaveLength(5)
    for (const definition of wiring.definitions) {
      const native = REAL_NATIVES[definition.name] as Definition
      expect(definition.description, definition.name).toBe(native.description)
      expect(definition.parameters, definition.name).toBe(native.parameters)
      expect(definition.output, definition.name).toBe(native.output)
      expect(definition.execute, definition.name).not.toBe(native.execute)
    }
  })
})

describe('a5m2-subagent-spawn-wiring (c) the admit seat → the plane PA walk', () => {
  it('ONE dispatched call walks PA with the exact public envelope, then runs the REAL captured body', async () => {
    PA_CALLS.length = 0
    SERVICE_STARTS.length = 0
    paAnswer = { kind: 'allow', consumedProof: REAL_PROOF }
    const wiring = wire()
    const def = wiring.definitions.find((d) => d.name === 'subagent')
    if (def === undefined) throw new Error('no def')
    const row = wiring.rowOf('subagent')
    if (row === undefined) throw new Error('no row')
    const classified = row.classify({ description: 'wire-me', prompt: 'go', run_in_background: false })
    if (classified.ok !== true || classified.plan === undefined) throw new Error('classify failed')
    const value = await def.execute({ description: 'wire-me', prompt: 'go', run_in_background: false }, { agent: AGENT_REF, callId: 'call-wire-9', token: {}, signal: CONTROLLER.signal })
    expect(PA_CALLS).toHaveLength(1)
    const req = PA_CALLS[0] as Required<PaRequest>
    expect(req.realmId).toBe('a5-realm-wire')
    expect(req.callId).toBe('call-wire-9') // the REAL public exec.callId, never synthesized
    expect(req.toolName).toBe('subagent')
    expect(req.requestedEffects.effects).toEqual([{ kind: 'tool-invoke', toolName: 'subagent', resource: null }])
    // THE CANONICAL DIGEST rides the parsed envelope (domain algebra, G6
    // precedent; the kernel reads request.requestedEffects.fingerprint at
    // admission-kernel.ts:215 — a hand-spelled envelope dies deeper in the
    // walk, measured by the spawn plane-mount spec).
    expect(String(req.requestedEffects?.fingerprint)).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(req.parametersFingerprint).toBe(classified.plan.parametersFingerprint) // the plan's OWN digest — the execute-call's internal classify re-mints an equal one; the digest IS the plan's identity (载荷法)
    expect(req.parametersFingerprint).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(req.family?.familyId).toBe('B-SUBAGENT')
    expect(req.family?.adapterRevision).toBe(2) // the mount's ACTUAL generation (root 22:02): registration/PA-block/face answer with ONE number
    expect(req.family?.providerIdentity).toBe('a5p5-plane')
    // THE IDENTITY THE CALL IS EXECUTING UNDER (production-leg law, house
    // G6-mount precedent (c)): the P-add names the plane feed's FRESH
    // placement identity — the very key the registration (and the PA gate's
    // binding lookup at pa-control-bridge :427) resolves — never the
    // capture-side constant.
    expect(req.family?.definitionIdentity).toBe(PLANE_FEED('subagent').definitionIdentity)
    // THE TYPED TARGET, PA-PROJECTED (root 20:41 fix 3; encoding per root
    // 21:01): the entry in PA_FAMILY_TARGET_RULES['B-SUBAGENT'] pairs exactly
    // these keys — childClaim rides the SIGNED 'nullableString' leaf, so the
    // target's null claim STAYS JSON null (no sentinel stand-in); every
    // other target fact names one manifest field, nothing re-spelled.
    const t = classified.plan.target
    expect(req.family?.targetManifest).toStrictEqual({
      operation: classified.plan.operation,
      contract: t.contract,
      parent: t.parent,
      childClaim: null,
      childAdjudication: t.child.adjudication,
      action: t.action,
      revision: t.revision,
      effect: t.effect,
      model: t.model,
      depth: t.depth,
      // the JOINT encoding's two full-value fields (root 21:20): canonical
      // JSON of the WHOLE call args and the WHOLE named-gaps record — the
      // lane's own canonicalizer, digests untouched beside them.
      argsCanonical: A5_B_SUBAGENT_SPAWN_CANONICAL_JSON(classified.plan.args),
      namedGapsCanonical: A5_B_SUBAGENT_SPAWN_CANONICAL_JSON(classified.plan.namedGaps),
    })
    expect(t.child.claim).toBeNull() // the sentinel encodes the CONST null claim
    expect(req.signal).toBe(CONTROLLER.signal)
    // admitted: the REAL captured body ran and the service double saw it
    expect(SERVICE_STARTS).toHaveLength(1)
    expect((SERVICE_STARTS[0] as { request: { label?: string } }).request.label).toBe('wire-me')
    expect(value).toMatchObject({ kind: 'foreground' })
  })
})

describe('a5m2-subagent-spawn-wiring (d) answer mapping without rewriting verdicts', () => {
  it('PA deny travels verbatim with PA own code; zero service entry', async () => {
    PA_CALLS.length = 0
    SERVICE_STARTS.length = 0
    paAnswer = { kind: 'deny', code: 'PA_TEST_DENY', detail: 'the envelope does not cover this spawn' }
    const wiring = wire()
    const def = wiring.definitions.find((d) => d.name === 'subagent')
    if (def === undefined) throw new Error('no def')
    const error = await def.execute({ description: 'd', prompt: 'p' }, { agent: AGENT_REF, callId: 'call-deny-1', signal: CONTROLLER.signal })
      .then(() => undefined, (e: unknown) => e as Error)
    expect(error?.message).toContain('PA_TEST_DENY') // PA's own bytes, verbatim
    expect(SERVICE_STARTS).toHaveLength(0)
  })
  it('PA OWN allow+cancelled answers the wiring CALL_CANCELLED (zero backend is the PA answer, the refusal is ours)', async () => {
    SERVICE_STARTS.length = 0
    paAnswer = { kind: 'allow', cancelled: true }
    const wiring = wire()
    const def = wiring.definitions.find((d) => d.name === 'subagent')
    if (def === undefined) throw new Error('no def')
    const error = await def.execute({ description: 'd', prompt: 'p' }, { agent: AGENT_REF, callId: 'call-cancel-1', signal: CONTROLLER.signal })
      .then(() => undefined, (e: unknown) => e as Error)
    expect(String(error?.message)).toContain(CODES.CALL_CANCELLED)
    expect(SERVICE_STARTS).toHaveLength(0)
  })
  it('a bare allow without the kernel consume witness refuses ADMIT_PROOF_ABSENT (self-attestation is not admission; zero service entry)', async () => {
    SERVICE_STARTS.length = 0
    paAnswer = { kind: 'allow' } // the plane's non-witness branch: the governed row DEMANDS the proof
    const wiring = wire()
    const def = wiring.definitions.find((d) => d.name === 'subagent')
    if (def === undefined) throw new Error('no def')
    const error = await def.execute({ description: 'd', prompt: 'p' }, { agent: AGENT_REF, callId: 'call-noproof-1', signal: CONTROLLER.signal })
      .then(() => undefined, (e: unknown) => e as Error)
    expect(String(error?.message)).toContain(CODES.ADMIT_PROOF_ABSENT)
    expect(SERVICE_STARTS).toHaveLength(0)
  })
  it('no public exec.callId fails closed BEFORE PA is asked; unrecognizable answers fail closed', async () => {
    PA_CALLS.length = 0
    SERVICE_STARTS.length = 0
    paAnswer = { kind: 'allow', consumedProof: REAL_PROOF }
    const wiring = wire()
    const def = wiring.definitions.find((d) => d.name === 'subagent')
    if (def === undefined) throw new Error('no def')
    const noId = await def.execute({ description: 'd', prompt: 'p' }, { agent: AGENT_REF, signal: CONTROLLER.signal })
      .then(() => undefined, (e: unknown) => e as Error)
    expect(String(noId?.message)).toContain(CODES.CALL_IDENTITY_ABSENT)
    expect(PA_CALLS).toHaveLength(0) // no synthetic correlation ever reaches the durable leg
    paAnswer = {} // no verdict at all
    const junk = await def.execute({ description: 'd', prompt: 'p' }, { agent: AGENT_REF, callId: 'call-junk-1', signal: CONTROLLER.signal })
      .then(() => undefined, (e: unknown) => e as Error)
    expect(String(junk?.message)).toContain(CODES.PA_ANSWER_UNRECOGNIZED)
    expect(SERVICE_STARTS).toHaveLength(0)
  })
  it('a THROWING paAdmit propagates VERBATIM (the wiring catches nothing)', async () => {
    SERVICE_STARTS.length = 0
    const wiring = wire({
      paAdmit: async () => { throw new Error('durable leg offline') },
    })
    const def = wiring.definitions.find((d) => d.name === 'subagent')
    if (def === undefined) throw new Error('no def')
    await expect(def.execute({ description: 'd', prompt: 'p' }, { agent: AGENT_REF, callId: 'call-throw-1', signal: CONTROLLER.signal }))
      .rejects.toThrow(/^durable leg offline$/)
    expect(SERVICE_STARTS).toHaveLength(0)
  })
})

describe('a5m2-subagent-spawn-wiring (e) registration keys = the PLANE FEED only', () => {
  it('a call whose PLACEMENT moved under the mount fails closed PLACEMENT_ABSENT — no PA walk opens, no body runs', async () => {
    SERVICE_STARTS.length = 0
    PA_CALLS.length = 0
    paAnswer = { kind: 'allow', consumedProof: REAL_PROOF }
    const wiring = wire({ placementFeed: () => undefined }) // the row dispatches; its placement no longer stands
    const def = wiring.definitions.find((d) => d.name === 'subagent')
    if (def === undefined) throw new Error('no def')
    const error = await def.execute({ description: 'd', prompt: 'p' }, { agent: AGENT_REF, callId: 'call-noplacement-1', signal: CONTROLLER.signal })
      .then(() => undefined, (e: unknown) => e as Error)
    expect(String(error?.message)).toContain(CODES.PLACEMENT_ABSENT)
    expect(PA_CALLS).toHaveLength(0)
    expect(SERVICE_STARTS).toHaveLength(0)
  })
  it('the JOINT encoding through the REAL eight-op table (root 21:20/22:02): five REAL minted manifests ACCEPT; crossed action and the pre-joint manifest deny with the grammar\u2019s measured bytes; revision 1\u21922 refusal-then-accept; CURRENTFIELDS restated; eight-op cross-check output', async () => {
    SERVICE_STARTS.length = 0
    PA_CALLS.length = 0
    paAnswer = { kind: 'allow', consumedProof: REAL_PROOF }
    const wiring = wire()
    // THE VALIDATOR OF RECORD is the REAL table: the joint entry landed by
    // merge from feat/a5m2-family-rules (fbebc3c52, 9d968-authored \u2014 the
    // spawn lane edited no table line). Handoff pairing law: the MINTED
    // object enters validatePaFamilyTarget; transcriptions discharge nothing.
    const OPS = ['subagent-spawn', 'subagent-fork-spawn', 'subagent-spawn-external-codex', 'subagent-spawn-external-claude-code', 'subagent-model-routes-read'] as const
    const CTRL_OPS = ['subagent-interrupt', 'subagent-list', 'subagent-send-message'] as const
    const tricky = { description: 'd1', prompt: 'full text\n with lines', opt_empty: '', keep_null: null, zeta_key: 'z', alpha_key: 7 }
    const ROWS = [['subagent', 'subagent-spawn'], ['subagent_fork', 'subagent-fork-spawn'], ['subagent_codex', 'subagent-spawn-external-codex'], ['subagent_claude_code', 'subagent-spawn-external-claude-code'], ['list_subagent_models', 'subagent-model-routes-read']] as const
    const byOp = new Map<string, Record<string, unknown>>()
    for (const [name, op] of ROWS) {
      const def = wiring.definitions.find((d) => d.name === name)
      if (def === undefined) throw new Error(`no def ${name}`)
      await def.execute(name === 'list_subagent_models' ? {} : { ...tricky }, { agent: AGENT_REF, callId: `call-joint-${name}`, signal: CONTROLLER.signal })
      const manifest = PA_CALLS[PA_CALLS.length - 1]?.family?.targetManifest as Record<string, unknown>
      expect(manifest.operation, name).toBe(op)
      // PAIRING LEG 1 (handoff, root 21:20): the REAL minted manifest
      // ACCEPTS at the REAL table \u2014 the flip from the pre-landing pin.
      expect(validatePaFamilyTarget('B-SUBAGENT', manifest), name).toBeUndefined()
      byOp.set(op, manifest)
    }
    expect(PA_CALLS).toHaveLength(5)
    const m0 = byOp.get('subagent-spawn') as Record<string, unknown>
    // REVISION CONSISTENCY (root 22:02): registration, every PA block and
    // the wiring face carry the mount\u2019s ACTUAL generation \u2014 the value
    // the real paths carry, not a bumped-but-unused constant.
    const regs = wiring.familyRegistrations()
    expect(regs).toHaveLength(5)
    for (const call of PA_CALLS) expect(call.family?.adapterRevision).toBe(2)
    for (const reg of regs) expect(reg.entry.adapterRevision).toBe(2)
    expect(wiring.adapterRevision).toBe(2)
    expect(wiring.wiringRevision).toBe(2)
    // (a) an OLD rev-1 approval presents a rev-1 family block; the bridge
    // family gate compares it against this rev-2 registration field-for-
    // field and refuses; (b) the NEW mint answers its own registration with
    // equal bytes and validates (above); (c) nothing translated: the
    // pre-joint manifest below dies at the table\u2019s required-loop byte.
    // A rev-1 block stamped for this mount is therefore refused at the
    // gate-law on the pair THIS spec owns end to end (the field-for-field
    // equality the bridge family gate applies): the rev-2 pair answers, a
    // rev-1 block against this rev-2 registration does not.
    const gateReg = regs[0]?.entry
    const gateBlock = PA_CALLS[0]?.family
    if (gateReg === undefined || gateBlock === undefined) throw new Error('no pair')
    expect(gateBlock.adapterRevision === gateReg.adapterRevision).toBe(true)
    expect({ ...gateBlock, adapterRevision: 1 }.adapterRevision === gateReg.adapterRevision).toBe(false)
    // EXACTLY TWELVE keys on the REAL minted manifest (shared 7 + spawn
    // adds 5; extras deny \u2014 the closed-key law is EXACT):
    expect(Object.keys(m0).sort()).toStrictEqual(['action', 'argsCanonical', 'childAdjudication', 'childClaim', 'contract', 'depth', 'effect', 'model', 'namedGapsCanonical', 'operation', 'parent', 'revision'])
    // action BOUND to the row\u2019s own operation; a crossed binding denies
    // with the REAL table\u2019s measured bytes (error-class pairing leg):
    expect(m0.action).toBe(m0.operation)
    expect(String(validatePaFamilyTarget('B-SUBAGENT', { ...m0, action: 'subagent-fork-spawn' }))).toBe("action: not the 'subagent-spawn' variant constant of the B-SUBAGENT typed plan")
    // FULL VALUES, not digests: argsCanonical parses back to the WHOLE call
    // (prompt whole, unknown-but-legal keys whole, null and \'\' distinct);
    // re-canonicalizing reproduces the string byte-for-byte; the named-gaps
    // record rides WHOLE.
    const carried = JSON.parse(String(m0.argsCanonical)) as Record<string, unknown>
    expect(carried).toStrictEqual(tricky)
    expect(A5_B_SUBAGENT_SPAWN_CANONICAL_JSON(carried)).toBe(String(m0.argsCanonical))
    expect(String(m0.argsCanonical)).not.toContain('sha256:')
    expect(JSON.parse(String(m0.namedGapsCanonical))).toStrictEqual(A5_B_SUBAGENT_SPAWN_NAMED_GAPS)
    expect(byOp.get('subagent-model-routes-read')?.argsCanonical).toBe('{}')
    // string family and missing key, REAL table, named:
    expect(String(validatePaFamilyTarget('B-SUBAGENT', { ...m0, argsCanonical: 42 }))).toBe('argsCanonical: not a string')
    const { namedGapsCanonical: _dropGaps, ...noGaps } = m0
    expect(String(validatePaFamilyTarget('B-SUBAGENT', noGaps))).toBe('namedGapsCanonical: required by the B-SUBAGENT typed plan, absent')
    // the SIGNED leaf survives untouched (root 21:01): null passes, any
    // string passes VERBATIM (the retired sentinel is one legal string among
    // all), \'\' is the third distinct outcome, 42 and a missing key deny:
    expect(validatePaFamilyTarget('B-SUBAGENT', { ...m0, childClaim: null })).toBeUndefined()
    expect(validatePaFamilyTarget('B-SUBAGENT', { ...m0, childClaim: 'service-mints-child-identity (claim not carried at this seam)' })).toBeUndefined()
    expect(validatePaFamilyTarget('B-SUBAGENT', { ...m0, childClaim: '' })).toBeUndefined()
    expect(String(validatePaFamilyTarget('B-SUBAGENT', { ...m0, childClaim: 42 }))).toContain('childClaim')
    const { childClaim: _dropClaim, ...noClaim } = m0
    expect(String(validatePaFamilyTarget('B-SUBAGENT', noClaim))).toContain('childClaim')
    // NO SILENT TRANSLATION (the handoff\u2019s EXACT byte, REAL table): the
    // PRE-JOINT 10-key manifest \u2014 what the superseded rev-1 mint carried
    // \u2014 dies at the required loop. Approved old rows cannot validate
    // against the joint entry, and the operationFingerprint moved with every
    // added leaf, so the durable rows cannot translate either.
    const { argsCanonical: _dropArgs, namedGapsCanonical: _dropGaps2, ...preJoint } = m0
    expect(String(validatePaFamilyTarget('B-SUBAGENT', preJoint))).toBe('argsCanonical: required by the B-SUBAGENT typed plan, absent')
    // CURRENTFIELDS [\'operation\',\'action\'] (the table\u2019s paired edge law):
    // the edge\u2019s CURRENT trusted facts restate exactly these two \u2014
    // dispatch-time constants of the row (record-spec identity, never model
    // text); a fresh classify restates them identically and the manifest
    // binds them equal.
    const rowS = wiring.rowOf('subagent')
    if (rowS === undefined) throw new Error('no row')
    const restated = rowS.classify({ ...tricky })
    if (restated.ok !== true || restated.plan === undefined) throw new Error('restate classify failed')
    expect(restated.plan.operation).toBe(m0.operation)
    expect(restated.plan.target.action).toBe(m0.action)
    // EIGHT-OP CROSS-CHECK OUTPUT (root 22:02 report): the table\u2019s OWN
    // discriminant map; the five SPAWN ops are answered by the REAL minted
    // manifests above; the three CONTROLS ops by TRANSOCRIBED card-shape
    // fixtures \u2014 cross-check output ONLY (the controls lane discharges
    // its own real-mint pairing legs; transcription discharges nothing).
    const jointEntry = PA_FAMILY_TARGET_RULES['B-SUBAGENT'] as unknown as { variant: { by: Record<string, unknown> } }
    expect(Object.keys(jointEntry.variant.by).sort()).toStrictEqual([...OPS, ...CTRL_OPS].sort())
    const ctrlShape = (op: string): Record<string, unknown> => ({ operation: op, contract: 'card-shape', revision: 'card-shape', effect: 'card-shape', depth: 'card-shape', argsCanonical: '{}', namedGapsCanonical: '{}', action: op, caller: 'agent-member-1', addressClaim: null, addressRelation: 'leader-to-member', addressAdjudication: 'card-shape', budget: 'card-shape', effectDelta: 'card-shape', recordIndex: 44 })
    for (const op of CTRL_OPS) expect(validatePaFamilyTarget('B-SUBAGENT', ctrlShape(op)), op).toBeUndefined()
    // THE REPORTED OUTPUT (root 22:02): one line, eight ops, the REAL
    // validator's answer each — the five SPAWN answers ride the REAL minted
    // manifests, the three CONTROLS answers the labeled card-shape (their
    // lane's real-mint legs discharge their own pairing).
    const probe: Record<string, string> = {}
    for (const op of OPS) probe[op] = String(validatePaFamilyTarget('B-SUBAGENT', byOp.get(op)))
    for (const op of CTRL_OPS) probe[op] = String(validatePaFamilyTarget('B-SUBAGENT', ctrlShape(op)))
    globalThis.console?.info(`[eight-op-probe] ${JSON.stringify(probe)}`)
    // list_models honesty (carried over, unchanged): it addresses NO child \u2014
    // its per-row truth rides childAdjudication, no manifest fact spells
    // "service-mints":
    const lmPlan = wiring.rowOf('list_subagent_models')?.classify({})
    if (lmPlan?.ok !== true || lmPlan.plan === undefined) throw new Error('list row did not classify')
    expect(lmPlan.plan.target.child.claim).toBeNull()
    expect(lmPlan.plan.target.child.adjudication).toContain('no child addressed')
    expect(JSON.stringify(lmPlan.plan.target)).not.toContain('service-mints')
  })
  it('registrations key on the fed def#N identities, never the captured ones; an absent feed throws', () => {
    const wiring = wire()
    const regs = wiring.familyRegistrations()
    expect(regs.map((r) => r.name)).toEqual([...NAMES])
    for (const reg of regs) {
      expect(reg.definitionIdentity).toBe(PLANE_FEED(reg.name).definitionIdentity)
      expect(reg.entry).toEqual({ familyId: 'B-SUBAGENT', adapterRevision: 2, providerIdentity: 'a5p5-plane' })
    }
    const openMount = () => wire({ placementFeed: () => undefined })
    expect(() => openMount().familyRegistrations()).toThrow(/P_B_SPAWN_PLACEMENT_KEY_ABSENT|PLACEMENT_KEY_ABSENT/)
  })
})

describe('a5m2-subagent-spawn-wiring (f) import closure', () => {
  it('the wiring imports EXACTLY ONE project module — the adapter', () => {
    const source = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'plugin', 'live', 'governed-families', 'subagent-spawn-wiring.mjs'), 'utf8')
    const code = source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, '')
    const statics = [...code.matchAll(/import\s+[\s\S]*?from\s+'([^']+)'/g)].map((m) => String(m[1]))
    // TWO statics, both published algebras: the lane's own adapter module
    // and the DOMAIN closed effect vocabulary (parseRequestedEffectSet —
    // the same import the G6 wiring obeys). No other project surface, no
    // dynamic import, no require.
    expect(statics).toEqual([
      './subagent-spawn-adapters.mjs',
      '../../../../../domain/tool-governance/src/index.js',
    ])
    expect(code).not.toContain('import(')
    expect(code).not.toMatch(/require\(/)
  })
})
