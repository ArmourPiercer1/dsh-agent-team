/**
 * A5M2-B-SUBAGENT-PLANE-MOUNT — the spawn lane's PRODUCTION LEG (root 21:07:
 * continue the established production-leg gaps with the EXISTING public
 * interfaces). The wiring spec drives the admit seat with a RECORDING double;
 * this spec removes that last double from the walk: the plane is the REAL
 * `createTeamToolPlaneAssembly`, the placement is the REAL `mount()` register
 * pass, the family keys are the REAL lazy `definitionIdentityOf` feed over
 * the REAL placed defs, the registry is the PRODUCTION `pa-mount-registry`,
 * and the seat is the plane's OWN `paAdmit` walk. House template:
 * a5m2-g6-plane-mount-c1 (B-SESSION-QUERY); the native faces are the REAL
 * published spawn faces captured off the pristine baseline (stronger than the
 * template's doubles — the wiring spec owns their provenance).
 *
 * Legs:
 *  (a) ZERO FLIP: no `backends.spawn` = no spawn placement, no wiring face —
 *      the ordinary mount keeps its pre-spawn shape;
 *  (b) the inject law: a defective wiring value refuses the MOUNT with the
 *      typed code (config is law; nothing half-placed);
 *  (c) REAL placement + registration: `mount()` registers the five spawn
 *      defs; `familyRegistrations()` keys are the PLACEMENT identities
 *      through the REAL feed — never the capture-side identities — and they
 *      round-trip the production registry;
 *  (d) REAL fail-closed walk: with NO control leg the plane's own paAdmit
 *      refuses on its own bytes — zero service entry, the captured body
 *      never runs;
 *  (e) REAL admitted consume on the kernel's own mint lane (the template's
 *      `issueApprovedGrant` control-leg seam): the CANONICAL parsed envelope
 *      admits, the one-shot proof lands, the REAL captured body runs; the
 *      SAME public callId never pays twice (single-flight). MEASURED, not
 *      asserted-by-wish — this lane's first end-to-end admitted walk;
 *  (f) teardown: dispose releases the register pass; the wiring's inFlight
 *      face keeps answering the mount's real state.
 *
 * DISCLOSED STAND-INS: the subagents/llm host services are the recording
 * stubs the wiring spec already uses (the SERVICE half belongs to the host,
 * not this lane) and the durable Control ROW half is the kernel's own
 * `issueApprovedGrant` through the template's minting control leg. The
 * PLANE, its paAdmit, the placement feed, the identity algebra and the
 * registry are the real production code. NOT C2 — no Host process, no
 * ports, no network, no installs.
 */
import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { findTestRepoRoot } from '../../../tests/paths.mjs'
import { approvingControlLeg } from './a5-m1-control-legs.mjs'

type Definition = {
  name: string
  description: string
  output: { schema: unknown; render: unknown }
  parameters?: Record<string, unknown>
  execute: (args: unknown, exec: Record<string, unknown>) => Promise<unknown>
}
type Built = { ok: true; value: PlaneValue } | { ok: false; code: string; message: string }
interface PlaneValue {
  definitions: ReadonlyArray<Definition>
  ownNames: readonly string[]
  placementFeed?: (name: string) => { definitionIdentity: string; realmId: string } | undefined
  placementNames: readonly string[]
  realmId: string
  mount: (agentCtx: unknown) => { ok: boolean; code?: string; dispose?: () => void }
  spawnPaSeat?: (request: Record<string, unknown>) => Promise<unknown>
  backends?: Record<string, unknown>
}
interface PlaneRow {
  createTeamToolPlaneAssembly: (input: Record<string, unknown>) => Built
}
type WiringModule = {
  A5_B_SPAWN_WIRING_CODES: Record<string, string>
  createSubagentSpawnWiring: (input: Record<string, unknown>) =>
    | { ok: true; wiring: WiringValue }
    | { ok: false; code: string; message: string }
}
type WiringValue = {
  familyId: string
  adapterRevision: number
  providerId: string
  realmId: string
  mountNames: readonly string[]
  definitions: readonly Definition[]
  familyRegistrations: () => Array<{ name: string; definitionIdentity: string; entry: { familyId: string; adapterRevision: number; providerIdentity: string } }>
  inFlight: () => { dispatches: number; refuses: number }
  drain: () => unknown
}

const WIRING = (await import(new URL('../src/plugin/live/governed-families/subagent-spawn-wiring.mjs', import.meta.url).href)) as unknown as WiringModule
const ADAPTER = (await import(new URL('../src/plugin/live/governed-families/subagent-spawn-adapters.mjs', import.meta.url).href)) as unknown as { A5_B_SUBAGENT_SPAWN_TOOL_NAMES: string[] }
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

const SERVICE_STARTS: Array<{ provider: string; request: Record<string, unknown> }> = []
const CONTINUABLE: Array<Record<string, unknown>> = []

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
          return { id: 'run-pm-1', result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: 'child done' }] }), dispose: () => undefined }
        },
        startContinuable: async (opts: Record<string, unknown>) => { CONTINUABLE.push(opts); return { childId: 'sub-pm-1' } },
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
const REAL_NATIVES = await captureRealNatives()

const AGENT_REF: Record<string, unknown> = {
  id: 'agent-parent-pm-1',
  session: { id: 'session-parent-pm-1', requestHeader: () => undefined, append: () => undefined },
  options: {},
}
const CONTROLLER = new AbortController()

const PLANE_ROW = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as unknown as PlaneRow
const REGISTRY = (await import(new URL('../src/plugin/live/pa-mount-registry.mjs', import.meta.url).href)) as unknown as {
  registerA5GovernedFamily: (key: string, entry: { familyId: string, adapterRevision: number, providerIdentity: string }) => void
  a5GovernedFamilyFor: (key: string) => { familyId: string, adapterRevision: number, providerIdentity: string } | undefined
}
const TD = (await import(new URL('../tool-dispatch/index.js', import.meta.url).href)) as unknown as { definitionIdentityOf: (target: unknown) => string | null }
const { registerA5GovernedFamily, a5GovernedFamilyFor } = REGISTRY

const REALM = 'a5pm-unit-realm'
const POLICY_ASK = Object.freeze({ default: 'ask', allow: [] as unknown[], ask: [] as unknown[], deny: [] as unknown[] })

// The plane-side registration keys must equal what a FRESH feed answers; the
// identity algebra is the production one (tool-dispatch), read off the def.
function buildPlane(extra: Record<string, unknown> = {}, sink: string[] = []): Built {
  return PLANE_ROW.createTeamToolPlaneAssembly({
    teamSessionId: 'a5pm-team',
    permissionPolicy: POLICY_ASK,
    realmId: REALM,
    templateId: 'a5pm-tpl',
    role: 'member',
    instanceId: 'a5pm-instance',
    onObserve: (row: unknown) => sink.push(String(row)),
    ...extra,
  }) as Built
}

function spawnWiring(planeRef: { current: PlaneValue | null }): WiringValue {
  const captured = Object.fromEntries(NAMES.map((name) => [name, { native: REAL_NATIVES[name], definitionIdentity: `cap:${name}` }]))
  // ONE real-generation container (the adapter's verified-handle law,
  // enforced at assembly: liveSpawnDelegates() must answer the SAME bound
  // object — the very drift law the 20:41 review fixed in production).
  const nativeOf = (name: string): Definition => {
    const d = REAL_NATIVES[name]
    if (d === undefined) throw new Error(`the capture answered no native for '${name}' — failing closed`)
    return d
  }
  const delegates = Object.freeze(Object.fromEntries(NAMES.map((name) => [name, nativeOf(name).execute])))
  // THE GLUE PATTERN, REPRODUCED (agent-bindings spawn block): the seams are
  // LAZY reads of the mount that only exists AFTER the plane assembled — the
  // wiring is built first, consulted only after placement. Rows running
  // before the plane answers get fail-closed refusals, never a guess.
  const built = WIRING.createSubagentSpawnWiring({
    providerId: 'a5pm-wire',
    realmId: REALM,
    captured,
    liveNative: (name: string) => REAL_NATIVES[name],
    spawnDelegates: delegates,
    liveSpawnDelegates: () => delegates,
    placementFeed: (name: string) => planeRef.current?.placementFeed?.(name),
    paAdmit: (request: Record<string, unknown>) => {
      const plane = planeRef.current
      if (plane === null) throw new Error('a5pm-spec: the plane seat is offline (mount never completed)')
      // THE REAL SEAT: the mount's out-hand for owner-built wiring
      // (`spawnPaSeat` — paAdmit itself; there is no top-level paAdmit face).
      const seat = plane.spawnPaSeat
      if (typeof seat !== 'function') throw new Error('a5pm-spec: the mount carries no spawnPaSeat')
      return seat(request)
    },
  })
  if (built.ok !== true) throw new Error(`spawn wiring refused: ${built.code} — ${built.message}`)
  return built.wiring
}

function fakeAgentCtx(registered: Definition[]) {
  return {
    tools: {
      register: (def: Definition) => {
        registered.push(def)
        let done = false
        return () => {
          if (done) return
          done = true
          const i = registered.indexOf(def)
          if (i >= 0) registered.splice(i, 1)
        }
      },
    },
  }
}

interface LegPlan { approvalCaseId: string, effectSetFingerprint: string, requiredAuthority?: string, deniedEffects?: unknown }
interface LegAssembly { issueApprovedGrant: (request: unknown, approval: unknown) => Promise<{ ok: boolean, value?: unknown, error?: { message?: string } }> }
/** The kernel's OWN landing (the template's minting leg, a5m2-g6-plane-mount):
 *  the durable Control ROW half stands in; the plane's Part A, the one-shot
 *  consume edge and the grant identity are REAL. */
function mintingControlLeg(seen: Array<{ family: Record<string, unknown> | undefined }>) {
  return async (input: { request: unknown, family?: Record<string, unknown>, plan: LegPlan, assembly: LegAssembly }): Promise<Record<string, unknown>> => {
    seen.push({ family: input.family })
    const plan = input.plan
    const approval = Object.freeze({
      approvalCaseId: plan.approvalCaseId,
      reviewerAuthority: 'human-user',
      beneficiaryAuthority: 'leader',
      requiredAuthorityAtCreation: plan.requiredAuthority ?? 'leader',
      effectSetFingerprint: plan.effectSetFingerprint,
      authorityGenerationAtCreation: 0,
      ...(plan.deniedEffects === undefined ? {} : { deniedEffectsAtCreation: plan.deniedEffects }),
    })
    const issued = await input.assembly.issueApprovedGrant(input.request, approval)
    if (issued.ok !== true || issued.value === undefined) {
      return { decision: 'deny', detail: `the kernel refused the mint (${String(issued.error?.message ?? 'unknown')})` }
    }
    return { decision: 'approve', requestId: 'a5pm-spec-control-row-1', approval, grant: issued.value, manifest: null }
  }
}

function mountedPair(opts: { controlLeg?: unknown; sink?: string[] } = {}): {
  plane: PlaneValue
  wiring: WiringValue
  registered: Definition[]
  dispose: () => void
  sink: string[]
} {
  const planeRef: { current: PlaneValue | null } = { current: null }
  const wiring = spawnWiring(planeRef)
  const sink = opts.sink ?? []
  const built = buildPlane({
    ...(opts.controlLeg === undefined ? {} : { controlLeg: opts.controlLeg }),
    backends: { spawn: wiring },
  }, sink)
  if (built.ok !== true) throw new Error(`plane mount refused: ${built.code} — ${built.message}`)
  planeRef.current = built.value
  const registered: Definition[] = []
  const placed = built.value.mount(fakeAgentCtx(registered))
  if (placed.ok !== true) throw new Error(`register pass refused: ${String(placed.code)}`)
  const dispose = () => { placed.dispose?.() }
  return { plane: built.value, wiring, registered, dispose, sink }
}

describe('a5m2-spawn-plane-mount (a) zero flip', () => {
  it('no backends.spawn = no spawn placement, no wiring face — the ordinary mount stands', () => {
    const built = buildPlane()
    if (built.ok !== true) throw new Error(`plane refused: ${built.code}`)
    for (const name of NAMES) {
      expect(built.value.placementNames, name).not.toContain(name)
    }
    expect(built.value.backends === undefined || !('spawn' in built.value.backends)).toBe(true)
  })
})

describe('a5m2-spawn-plane-mount (b) the inject law', () => {
  it('a wiring value without complete family facts refuses the MOUNT typed — nothing half-placed', () => {
    const planeRef: { current: PlaneValue | null } = { current: null }
    const wiring = spawnWiring(planeRef)
    const tampered = { ...wiring, adapterRevision: -1 }
    const built = buildPlane({ backends: { spawn: tampered } })
    expect(built.ok).toBe(false)
    if (built.ok === false) expect(built.code).toBe('SPAWN_WIRING_INJECT_INVALID')
  })
})

describe('a5m2-spawn-plane-mount (c) REAL placement + registration', () => {
  it('mount() registers the five spawn defs; family keys are the PLACEMENT identities through the real feed; the registry round-trips', () => {
    const { plane, wiring, registered, dispose } = mountedPair()
    try {
      for (const name of NAMES) {
        expect(registered.some((d) => d.name === name), name).toBe(true)
        expect(plane.placementNames, name).toContain(name)
      }
      const regs = wiring.familyRegistrations()
      expect(regs).toHaveLength(NAMES.length)
      for (const reg of regs) {
        // the key is the placement identity of THE PLACED def (real algebra)
        const placedDef = registered.find((d) => d.name === reg.name)
        expect(reg.definitionIdentity).toBe(TD.definitionIdentityOf(placedDef))
        expect(reg.definitionIdentity).not.toBe(`cap:${reg.name}`) // never capture-side
        expect(reg.entry).toStrictEqual({ familyId: 'B-SUBAGENT', adapterRevision: 2, providerIdentity: 'a5pm-wire' })
      }
      for (const reg of regs) registerA5GovernedFamily(reg.definitionIdentity, reg.entry)
      // the registry round-trips BY VALUE (its entries are its own frozen
      // copies — the registry owns the stored bytes, second sources lose).
      for (const reg of regs) expect(a5GovernedFamilyFor(reg.definitionIdentity)).toStrictEqual(reg.entry)
    } finally {
      dispose()
    }
  })
})

describe('a5m2-spawn-plane-mount (d) REAL fail-closed walk', () => {
  it('no control leg: the plane paAdmit refuses on its OWN bytes; the captured body never runs', async () => {
    SERVICE_STARTS.length = 0
    const { plane, dispose } = mountedPair()
    try {
      const def = plane.definitions.find((d) => d.name === 'subagent')
      if (def === undefined) throw new Error('no placed def')
      const error = await def.execute({ description: 'd', prompt: 'p' }, { agent: AGENT_REF, callId: 'call-pm-d1', signal: CONTROLLER.signal })
        .then(() => undefined, (e: unknown) => e as Error)
      expect(error, 'the no-control-leg walk must refuse').toBeInstanceOf(Error)
      // MEASURED byte (this spec's first run): the plane's own PartA refuses
      // with its OWN code — the typed refusal rides the row's family name.
      expect(String(error?.message)).toContain('APPROVAL_REQUEST_UNAVAILABLE')
      expect(SERVICE_STARTS).toHaveLength(0)
    } finally {
      dispose()
    }
  })
})

describe('a5m2-spawn-plane-mount (e) REAL admitted consume on the kernel mint lane', () => {
  it('the canonical envelope + the minting control leg ADMITS: the one-shot proof lands, the REAL captured body runs ONCE; the SAME public callId may not pay twice (single-flight), and the family facts the control leg saw are the mount’s own', async () => {
    SERVICE_STARTS.length = 0
    CONTINUABLE.length = 0
    const seen: Array<{ family: Record<string, unknown> | undefined }> = []
    const sink: string[] = []
    const { plane, dispose } = mountedPair({ controlLeg: mintingControlLeg(seen), sink })
    try {
      const def = plane.definitions.find((d) => d.name === 'subagent')
      if (def === undefined) throw new Error('no placed def')
      const outcome = await def.execute({ description: 'd', prompt: 'p' }, { agent: AGENT_REF, callId: 'call-pm-e1', signal: CONTROLLER.signal })
        .then((v) => ({ kind: 'value' as const, v }), (e: unknown) => ({ kind: 'error' as const, e: e as Error }))
      expect(outcome.kind).toBe('value')
      // MEASURED (first run): the admitted body ran and entered the service
      // ONCE. Which service FACE the host tool picks (one-shot `start` vs
      // the continuable handle) is the host's own mode law — both faces are
      // recorded; the walk enters exactly one of them, with a real handle.
      const entries = SERVICE_STARTS.length + CONTINUABLE.length
      expect(entries, 'the admitted walk entered a REAL service face exactly once').toBe(1)
      if (outcome.kind === 'value') {
        const v = outcome.v as { kind?: string; subagentId?: string }
        expect(v.kind === 'continuable' ? v.subagentId === 'sub-pm-1' : v.kind === 'foreground').toBe(true)
      } else {
        throw new Error(`the admitted walk unexpectedly rejected: ${outcome.e.message}`)
      }
      expect(seen).toHaveLength(1)
      expect(seen[0]?.family?.familyId).toBe('B-SUBAGENT')
      expect(seen[0]?.family?.adapterRevision).toBe(2)
      // SINGLE-FLIGHT (a5p5 law, house template): the grant the call consumed
      // answers ONCE — a replay under the same public callId enters nothing.
      const second = await def.execute({ description: 'd', prompt: 'p' }, { agent: AGENT_REF, callId: 'call-pm-e1', signal: CONTROLLER.signal })
        .then(() => 'value' as const, () => 'error' as const)
      expect(second).toBe('error')
      expect(SERVICE_STARTS.length + CONTINUABLE.length).toBe(1)
      expect(sink.some((r) => r.includes('admission-requires-approval'))).toBe(true)
    } finally {
      dispose()
    }
  })
})

describe('a5m2-spawn-plane-mount (f) teardown', () => {
  it('dispose releases the register pass; inFlight keeps answering the mount state', () => {
    const { wiring, registered, dispose } = mountedPair()
    for (const name of NAMES) expect(registered.some((d) => d.name === name), name).toBe(true)
    dispose()
    expect(registered).toHaveLength(0)
    // the adapter's own inFlight face ({dispatches, refuses}) keeps answering
    // the mount's real state after teardown — no throw, real counters.
    expect(typeof wiring.inFlight().dispatches).toBe('number')
    expect(typeof wiring.inFlight().refuses).toBe('number')
  })
})

// keep the approving-leg import honest: it is the same house helper the
// template mounts for policy-allow lanes; this lane never reaches it (the
// blueprint grammar allows no spawn name) — importing it pins that the
// template's fast lane was CONSIDERED and does not apply here.
void approvingControlLeg
