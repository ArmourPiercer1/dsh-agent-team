/**
 * a5m2-spawn-bind-after-def-c1.test.ts — the A5M2 B-SPAWN bind-after-def
 * HOOK-ROUTE targeted regressions (root option-A ruling 2026-10-24, re-routed
 * by the root FINAL ruling 2026-10-24: same-layer registration is IMPOSSIBLE
 * — the natives already occupy the agent's own layer under the
 * `modelSelectionSettings: true` preset and the Host REFUSES a same-layer
 * duplicate — so governance NEVER registers a same-name def. It rides the
 * public `tools/execute` around-waterfall (core/tools index.ts :164,
 * :1601-1609; its terminal step :1578-1582 runs the resolved ORIGINAL def
 * with the fused abort signal, the bodyInvoked bookkeeping and the canonical
 * result normalization — the host itself). The governed flight reuses the
 * production schedule bind-after-def law (schedule-bind-after-def.mjs
 * :244-356): sameAgent gate, the SAME one-flight plane token ledger, the
 * row's OWN admission through `wiring.admitOnly` (safety block → classify →
 * PA open→edge → consumedProof; it enters NO body), post-await rechecks, and
 * EXACTLY ONE next(). The row's delegate is never called on this path:
 * delegate XOR next — a double body is structurally impossible.
 * The source-verified public shape stays as in option-A:
 *   - packages/core/scope/src/store.ts :249-265 — insert-then-notify, sync;
 *   - packages/core/tools/src/index.ts :199-208 + :835 — the PUBLIC
 *     `tools/change` (NO payload, NOT scope-filtered — wakes re-read through
 *     tools.get(name, agent));
 *   - tool-subagent src/index.ts :665-710 — defs SUPPLIED on agent/created.
 * THE LEGS (in the REAL public order):
 *   ① EARLY/absent worlds: a plane with NO pending arm answers the typed
 *      NOT_PENDING (the fast lane is byte-identical, no seat, no face); a
 *      pending plane that has NOT mounted yet answers NOT_MOUNTED; the arms
 *      stay a typed construction refusal.
 *   ② LATE registration (the preset world): the deny guard holds the family
 *      from BEFORE any call; a partial supply stays pending + denied; the
 *      full supply attaches (attach registers NOTHING — the mock would
 *      THROW on any same-layer duplicate), claims the family under the REAL
 *      NATIVE identities, installs the waterfall hook, and lifts deny only
 *      at the end. Governed dispatches then: PA-refused → the body enters
 *      ZERO times and next is NEVER called; the minting control leg → the
 *      ORIGINAL def executes EXACTLY once through the host's own next()
 *      (one-shot proof, single-flight replay refuses); the child-bearing
 *      safety row refuses BEFORE the PA walk; DRIFT and abort refuse with
 *      zero bodies.
 *   ③ TERMINAL law: a FAILED mount and a DISPOSED mount both end attach
 *      legality (typed TERMINAL); the one-shot attach stays spent (DONE).
 * WHAT IS REAL: the production plane assembly, the production spawn wiring
 * and adapters, the REAL published native definitions captured off the
 * pristine baseline (0.2.0-rc.2 @ 639ed015397), the plane's real
 * placementFeed / spawnPaSeat / paTokenLedger, the production
 * pa-mount-registry. WHAT STANDS IN (disclosed): the member agent ctx is a
 * faithful registration surface — it REFUSES same-layer duplicates exactly
 * like the Host, notifies after inserts, keeps a monotonic deny-only guard
 * and composes the tools/execute waterfall with the host's terminal-body
 * law; the dispatcher's own guard-stage ordering and the live agent
 * lifecycle stay window-scope, pinned by the SOURCE-PAIR leg (the binding
 * lane lives inside createAgentBindings, which no in-repo spec drives
 * without a live Host). NOT C2 — no Host, no ports, no network, no writes.
 *
 * @module @dsh-agent-team/runtime/test/a5m2-spawn-bind-after-def-c1
 */
import { describe, expect, it } from 'vitest'
import { createRequire } from 'node:module'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { findTestRepoRoot } from '../../../tests/paths.mjs'

type Definition = { name: string, description: string, inputSchema: Record<string, unknown>, execute: (...args: never[]) => unknown, [k: string]: unknown }
type Exec = { name: string, agent: unknown, arguments?: Record<string, unknown>, token?: Record<string, unknown>, signal?: AbortSignal, callId?: string }
type AttachResult = { ok: boolean, code?: string, detail?: string, message?: string }
type PlaneValue = {
  attachSpawn: (wiring: unknown) => AttachResult
  placementFeed: (name: string) => { definitionIdentity: string } | undefined
  spawnPaSeat?: unknown
  paTokenLedger?: { take: (token: unknown, key: string) => boolean, settle: (token: unknown) => void }
  mount: (agentCtx: unknown) => { ok: boolean; code?: string; dispose?: () => void }
  backends: Record<string, unknown>
}
type SpawnWiringValue = {
  definitions: readonly Definition[]
  familyRegistrations: () => ReadonlyArray<{ name: string, definitionIdentity: string, entry: { familyId: string, adapterRevision: number, providerIdentity: string } }>
  admitOnly: (name: string, exec: Record<string, unknown> | undefined) => Promise<{ ok: true, name: string }>
  drain: () => unknown
}
interface LegPlan { approvalCaseId: string, effectSetFingerprint: string, requiredAuthority?: string, deniedEffects?: unknown }
interface LegAssembly { issueApprovedGrant: (request: unknown, approval: unknown) => Promise<{ ok: boolean, value?: unknown, error?: { message?: string } }> }

const PLANE_ROW = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as unknown as {
  createTeamToolPlaneAssembly: (input: Record<string, unknown>) => { ok: true, value: PlaneValue } | { ok: false, code: string, message?: string }
}
const WIRING = (await import(new URL('../src/plugin/live/governed-families/subagent-spawn-wiring.mjs', import.meta.url).href)) as unknown as {
  createSubagentSpawnWiring: (input: Record<string, unknown>) => { ok: true, wiring: SpawnWiringValue } | { ok: false, code?: string, message?: string }
}
const ADAPTER = (await import(new URL('../src/plugin/live/governed-families/subagent-spawn-adapters.mjs', import.meta.url).href)) as unknown as { A5_B_SUBAGENT_SPAWN_TOOL_NAMES: readonly string[] }
const NAMES = ADAPTER.A5_B_SUBAGENT_SPAWN_TOOL_NAMES
const TD = (await import(new URL('../tool-dispatch/index.js', import.meta.url).href)) as unknown as { definitionIdentityOf: (target: unknown) => string | null }
const REGISTRY = (await import(new URL('../src/plugin/live/pa-mount-registry.mjs', import.meta.url).href)) as unknown as {
  registerA5GovernedFamily: (key: string, entry: { familyId: string, adapterRevision: number, providerIdentity: string }) => void
  a5GovernedFamilyFor: (key: string) => { familyId: string, adapterRevision: number, providerIdentity: string } | undefined
}

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

/** The recording service halves (disclosed stand-ins — the SERVICE half
 *  belongs to the host; the plane, seat, ledger and algebra are REAL). */
const SERVICE_STARTS: Array<{ provider: string, request: Record<string, unknown> }> = []
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
          return { id: 'run-bad-1', result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: 'child done' }] }), dispose: () => undefined }
        },
        startContinuable: async (request: Record<string, unknown>) => {
          CONTINUABLE.push({ request })
          return { childId: 'sub-bad-1' }
        },
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
function nativeOf(name: string): Definition {
  const def = REAL_NATIVES[name]
  if (def === undefined) throw new Error(`no REAL native for '${name}'`)
  return def
}

const AGENT: Record<string, unknown> = {
  id: 'agent-parent-bad-1',
  session: { id: 'session-parent-bad-1', requestHeader: () => undefined, append: () => undefined },
  options: {},
}
const REALM = 'a5bad-unit-realm'
const POLICY_ASK = Object.freeze({ default: 'ask', allow: [] as unknown[], ask: [] as unknown[], deny: [] as unknown[] })

function buildPlane(extra: Record<string, unknown>): { ok: true, value: PlaneValue } | { ok: false, code: string, message?: string } {
  return PLANE_ROW.createTeamToolPlaneAssembly({
    teamSessionId: 'a5bad-team',
    permissionPolicy: POLICY_ASK,
    realmId: REALM,
    templateId: 'a5bad-tpl',
    role: 'member',
    instanceId: 'a5bad-instance',
    onObserve: () => undefined,
    ...extra,
  })
}

/** The kernel's OWN landing (the template's minting leg, as in
 *  a5m2-subagent-spawn-plane-mount-c1 leg (e)): the durable Control ROW half
 *  stands in; the plane's Part A, the one-shot consume edge and the grant
 *  identity are REAL. */
function mintingControlLeg(seen: Array<{ family: Record<string, unknown> | undefined }>) {
  return async (input: { request: unknown, family?: Record<string, unknown>, plan: LegPlan, assembly: LegAssembly }): Promise<{ decision: string, detail?: string, requestId?: string, approval?: unknown, grant?: unknown, manifest?: undefined }> => {
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
    return { decision: 'approve', requestId: 'a5bad-spec-control-row-1', approval, grant: issued.value, manifest: undefined }
  }
}

/** The member registration surface — THE HOST LAWS, FAITHFUL (root d39
 *  narrow review 2026-10-24): the natives ALREADY occupy the agent's own
 *  layer (modelSelectionSettings:true registers them on candidate.ctx) and
 *  the Host REFUSES a same-layer duplicate name — no later-wins shadowing
 *  exists at that surface, so the mock THROWS on duplicates. Insert-then-
 *  notify (core/scope store.ts :249-265); monotonic DENY-ONLY guard
 *  (core/tools index.ts :1126-1135); the public `tools/change` carries NO
 *  payload and NO scope filter (:835); the `tools/execute` waterfall composes
 *  listeners around a terminal body step that resolves the CURRENT layer def
 *  and runs `def.execute(exec.arguments, exec)` exactly like the host's
 *  dispatchToolBody (:1578-1582). */
function memberCtx(opts: { failRegister?: boolean } = {}) {
  const layer = new Map<string, Definition>()
  const guards: Array<(exec: Exec) => string | undefined> = []
  const handlers = new Map<string, Array<(exec: Exec, next: () => Promise<unknown>) => unknown>>()
  const emit = (event: string) => {
    for (const fn of [...(handlers.get(event) ?? [])]) void (fn as (exec: Exec, next: () => Promise<unknown>) => unknown)(undefined as unknown as Exec, async () => undefined)
  }
  return {
    tools: {
      register: (def: Definition) => {
        if (opts.failRegister === true) throw new Error('a5bad-spec: the placement surface refuses every register')
        if (layer.has(def.name)) throw new Error(`duplicate tool registration '${def.name}' in the same layer (host law)`)
        layer.set(def.name, def)
        emit('tools/change')
        let done = false
        return () => {
          if (done) return
          done = true
          layer.delete(def.name)
          emit('tools/change')
        }
      },
      get: (name: string, agent: unknown) => (agent === AGENT ? layer.get(name) : undefined),
      guard: (fn: (exec: Exec) => string | undefined) => {
        guards.push(fn)
        return () => {
          const at = guards.indexOf(fn)
          if (at >= 0) guards.splice(at, 1)
        }
      },
    },
    on: (event: string, fn: (exec: Exec, next: () => Promise<unknown>) => unknown) => {
      const list = handlers.get(event) ?? []
      list.push(fn)
      handlers.set(event, list)
      return () => {
        const at = list.indexOf(fn)
        if (at >= 0) list.splice(at, 1)
      }
    },
    /** test window: the CURRENT layer face identities (attach registers
     *  NOTHING — legs assert the layer is untouched by a successful attach). */
    layerNames: (): string[] => [...layer.keys()],
    layerFace: (name: string): Definition | undefined => layer.get(name),
    replaceFace: (name: string, def: Definition) => { layer.set(name, def); emit('tools/change') },
    /** ONE dispatch exactly like the dispatcher: the guard stage FIRST
     *  (deny-only, first denial wins), then the around-waterfall with the
     *  host's terminal body step. Returns whether `next` ran (the body
     *  carrier) — the delegate XOR next law measures through this. */
    dispatch: async (name: string, args: Record<string, unknown>, token: Record<string, unknown>, opts: { aborted?: boolean } = {}): Promise<{ denied?: string, value?: unknown, error?: Error, nextCalls: number }> => {
      const controller = new AbortController()
      if (opts.aborted === true) controller.abort()
      const exec: Exec = { name, agent: AGENT, arguments: args, token, callId: `call-${String(token['id'] ?? name)}`, signal: controller.signal }
      let nextCalls = 0
      const next = async (): Promise<unknown> => {
        nextCalls += 1
        const def = layer.get(name)
        if (def === undefined) throw new Error(`no face for '${name}'`)
        return await (def.execute as (a: unknown, e: unknown) => unknown)(args, exec)
      }
      for (const fn of guards) {
        const denial = fn(exec)
        if (typeof denial === 'string') return { denied: denial, nextCalls }
      }
      let call: () => Promise<unknown> = next
      for (const fn of [...(handlers.get('tools/execute') ?? [])].reverse()) {
        const inner = call
        call = async () => await (fn(exec, inner) as Promise<unknown>)
      }
      try {
        return { value: await call(), nextCalls }
      } catch (error) {
        return { error: error as Error, nextCalls }
      }
    },
  }
}

type MemberCtx = ReturnType<typeof memberCtx>

/** Build the SAME production wiring the deferred lane builds (the binding's
 *  spawnWire mirrors this exactly): the plane feed answers the REAL NATIVE
 *  identity in the hook world, the seat and the ledger are the plane's own. */
function buildSpawnWiring(ctx: MemberCtx, plane: PlaneValue): SpawnWiringValue {
  const captured: Record<string, { native: Definition, definitionIdentity: string }> = {}
  const bodies: Record<string, (...args: never[]) => unknown> = {}
  for (const name of NAMES) {
    const face = ctx.layerFace(name)
    if (face === undefined) throw new Error(`face '${name}' is absent at wiring build`)
    const identity = TD.definitionIdentityOf(face)
    if (typeof identity !== 'string' || identity.length === 0) throw new Error(`face '${name}' carries no definition identity`)
    captured[name] = { native: face, definitionIdentity: identity }
    bodies[name] = face.execute
  }
  const delegates = Object.freeze({ ...bodies })
  const built = WIRING.createSubagentSpawnWiring({
    providerId: 'a5p5-plane',
    realmId: REALM,
    captured,
    liveNative: (spawnName: string) => ctx.layerFace(spawnName),
    spawnDelegates: delegates,
    liveSpawnDelegates: () => delegates,
    placementFeed: (spawnName: string) => {
      const fed = plane.placementFeed(spawnName)
      if (fed !== undefined) return fed
      const face = ctx.layerFace(spawnName)
      const identity = face === undefined ? null : TD.definitionIdentityOf(face)
      return typeof identity === 'string' && identity.length > 0
        ? Object.freeze({ definitionIdentity: identity, realmId: REALM })
        : undefined
    },
    paAdmit: (request: Record<string, unknown>) => {
      const seat = plane.spawnPaSeat
      if (typeof seat !== 'function') throw new Error('the mount carries no spawnPaSeat')
      return (seat as (r: Record<string, unknown>) => Promise<unknown>)(request)
    },
    observe: () => undefined,
  })
  if (built.ok !== true) throw new Error(`spawn wiring refused: ${String(built.code)} — ${String(built.message ?? '')}`)
  return built.wiring
}

/** MIRROR of the production deferred lane's bind (agent-bindings.mjs):
 *  attach → waterfall hook (sameAgent gate, the one-flight PLANE token,
 *  last-moment identity, the row's OWN admitOnly, post-await rechecks,
 *  EXACTLY ONE next) → family claim under the REAL NATIVE identities →
 *  readback → lift. The lane itself lives inside createAgentBindings (no
 *  in-repo spec drives it without a live Host); the SOURCE-PAIR leg pins
 *  that the production lane carries this exact law. */
function mirrorBind(ctx: MemberCtx, plane: PlaneValue): { wiring: SpawnWiringValue, governed: { value: boolean }, guardOff: () => void } {
  const wiring = buildSpawnWiring(ctx, plane)
  const attached = plane.attachSpawn(wiring)
  if (attached.ok !== true) throw new Error(`attach refused: ${String(attached.code)}`)
  const governed = { value: false }
  const governedNames = new Set(wiring.definitions.map((def) => def.name))
  void ctx.on('tools/execute', async (exec, next) => {
    if (exec.agent !== AGENT || !governedNames.has(exec.name)) return await next()
    if (!governed.value) throw new Error(`a5m2-spawn: '${exec.name}' is governed-PENDING/CLOSED — the native body does not execute unmanaged`)
    const ledger = plane.paTokenLedger
    if (typeof ledger?.take !== 'function' || ledger.take(exec.token, `plane-spawn:${REALM}:${exec.name}`) !== true) {
      throw new Error('the one-flight plane token was unavailable or replayed — this execution owns no governed flight')
    }
    try {
      const live = ctx.layerFace(exec.name)
      const capturedFace = REAL_NATIVES[exec.name]
      if (live === undefined || capturedFace === undefined || live !== capturedFace) {
        throw new Error(`a5m2-spawn: the live '${exec.name}' face is not the captured ORIGINAL — DRIFT refuses before the body`)
      }
      if (plane.backends['spawn'] !== wiring) throw new Error('DEAD-MOUNT refuses before the PA walk — the native body does not execute unmanaged')
      await wiring.admitOnly(exec.name, exec as unknown as Record<string, unknown>)
      if (!governed.value) throw new Error('the lane closed during the PA walk — the body is not entered')
      if (plane.backends['spawn'] !== wiring) throw new Error('the mount carrying this wiring died during the PA walk — the body is entered ZERO times and next is never called')
      if (exec.signal?.aborted === true) throw new Error('aborted after the PA walk — the consumption stands as ledger truth, the body is entered zero times')
      const after = ctx.layerFace(exec.name)
      if (after === undefined || capturedFace === undefined || after !== capturedFace) {
        throw new Error('the live face moved during the PA walk — the body is entered zero times')
      }
      return await next()
    } finally {
      try { ledger?.settle(exec.token) } catch { /* best-effort */ }
    }
  })
  for (const reg of wiring.familyRegistrations()) {
    if (REGISTRY.a5GovernedFamilyFor(reg.definitionIdentity) === undefined) {
      REGISTRY.registerA5GovernedFamily(reg.definitionIdentity, reg.entry)
    }
  }
  for (const name of governedNames) {
    if (ctx.layerFace(name) !== REAL_NATIVES[name]) throw new Error(`readback-refused:${name}`)
  }
  governed.value = true
  // the mirror's guard arming is installed by the leg itself; the bind
  // returns its lifter so the leg controls the lift ordering.
  return { wiring, governed, guardOff: () => undefined }
}

describe('a5m2-spawn-bind-after-def ① EARLY/absent worlds keep the typed refusals', () => {
  it('no pending arm = attach NOT_PENDING, no seat, no face; a pending arm before mount answers NOT_MOUNTED; the arms refuse at construction', () => {
    const plain = buildPlane({})
    if (plain.ok !== true) throw new Error(`plain build refused: ${plain.code}`)
    expect(plain.value.attachSpawn({}).code).toBe('SPAWN_ATTACH_NOT_PENDING')
    expect(plain.value.spawnPaSeat).toBeUndefined()
    expect(plain.value.backends['spawn']).toBeUndefined()

    const pend = buildPlane({ backends: { spawnPending: { names: [...NAMES] } } })
    if (pend.ok !== true) throw new Error(`pending build refused: ${pend.code}`)
    // BEFORE mount(): the arm is legal ONLY after the mount placed.
    expect(pend.value.attachSpawn({}).code).toBe('SPAWN_ATTACH_NOT_MOUNTED')
    expect(pend.value.backends['spawn']).toBeUndefined()
    expect(typeof pend.value.spawnPaSeat).toBe('function')

    const both = buildPlane({ backends: { spawn: {}, spawnPending: { names: [...NAMES] } } })
    expect(both.ok).toBe(false)
    const badPending = buildPlane({ backends: { spawnPending: { names: [] } } })
    expect(badPending.ok).toBe(false)
  })
})

describe('a5m2-spawn-bind-after-def ② the preset world: natives occupy the layer, the hook governs', () => {
  it('deny-first; partial supply stays pending; the full supply attaches with ZERO registration, claims the REAL native identities, lifts last; PA-refused calls enter no body and never call next', async () => {
    const plane = buildPlane({ backends: { spawnPending: { names: [...NAMES] } } })
    if (plane.ok !== true) throw new Error(`pending build refused: ${plane.code}`)
    const ctx = memberCtx()
    const mounted = plane.value.mount(ctx)
    expect(mounted.ok, `mount refused: ${String(mounted.code)}`).toBe(true)
    // the sameAgent DENY GUARD arms BEFORE anything else (production lane:
    // the guard is armed at setup, before subscriptions, before attach).
    const guardOff = ctx.tools.guard((exec) => (exec.agent === AGENT && NAMES.includes(exec.name)
      ? `a5m2-spawn: '${exec.name}' bind-after-def is PENDING — governed deny`
      : undefined)) as () => void
    const tok = (n: string) => ({ id: `tok-${n}` })
    // FIRST call denies at the guard stage: no body, no waterfall entry.
    const first = await ctx.dispatch('subagent_codex', { description: 'd', prompt: 'p' }, tok('first'))
    expect(first.denied).toContain('PENDING')
    expect(first.nextCalls).toBe(0)
    // PARTIAL supply: two natives land — the arm stays PENDING, deny holds.
    const disposeA = ctx.tools.register(nativeOf('subagent'))
    ctx.tools.register(nativeOf('subagent_fork'))
    expect(plane.value.backends['spawn']).toBeUndefined()
    const stillPending = await ctx.dispatch('subagent_codex', { description: 'd', prompt: 'p' }, tok('partial'))
    expect(stillPending.denied).toContain('PENDING')
    // FULL supply: the re-read proves every face → the ONE attach lands.
    ctx.tools.register(nativeOf('subagent_codex'))
    ctx.tools.register(nativeOf('subagent_claude_code'))
    ctx.tools.register(nativeOf('list_subagent_models'))
    const namesBefore = ctx.layerNames().slice().sort()
    const bound = mirrorBind(ctx, plane.value)
    // attach registered NOTHING: the same-layer surface would have THROWN
    // on any duplicate — the layer is exactly the four host natives.
    expect(ctx.layerNames().slice().sort()).toEqual(namesBefore)
    for (const name of NAMES) expect(ctx.layerFace(name)).toBe(REAL_NATIVES[name])
    expect(plane.value.backends['spawn']).toBe(bound.wiring)
    // the family claim rides the REAL NATIVE identities (root: 真实native
    // identity登记原family/Guard), never a stand-in key.
    for (const reg of bound.wiring.familyRegistrations()) {
      const face = REAL_NATIVES[reg.name]
      if (face === undefined) throw new Error(`no native for ${reg.name}`)
      expect(reg.definitionIdentity).toBe(TD.definitionIdentityOf(face))
      expect(REGISTRY.a5GovernedFamilyFor(reg.definitionIdentity)).toStrictEqual(reg.entry)
      expect(reg.entry.familyId).toBe('B-SUBAGENT')
      expect(reg.entry.adapterRevision).toBe(2)
    }
    // ONLY NOW may the deny lift (the mirror leg's ordering; the production
    // lane's exact ordering is the SOURCE-PAIR leg below).
    guardOff()
    // Governed dispatch in the NO-CONTROL-LEG world: the row's OWN PA walk
    // refuses → the body entered ZERO times and next was NEVER called
    // (delegate XOR next: nothing ran at all — fail closed).
    const refused = await ctx.dispatch('subagent_codex', { description: 'd', prompt: 'p' }, tok('refused'))
    expect(refused.error).toBeInstanceOf(Error)
    expect(refused.nextCalls).toBe(0)
    expect(SERVICE_STARTS).toHaveLength(0)
    expect(CONTINUABLE).toHaveLength(0)
    // The child-bearing safety row refuses BEFORE the PA walk (zero
    // approval consumed), zero bodies (the URGENT SAFETY BLOCK law).
    const child = await ctx.dispatch('subagent', { description: 'd', prompt: 'p' }, tok('child'))
    expect(child.error).toBeInstanceOf(Error)
    expect(child.error?.message ?? '').toContain('CHILD_GOVERNANCE')
    expect(child.nextCalls).toBe(0)
    // DRIFT: the face moves under the governance → the last-moment identity
    // check refuses before admit, before the body.
    ctx.replaceFace('subagent_codex', { name: 'subagent_codex', description: 'decoy', inputSchema: {}, execute: async () => 'never' } as unknown as Definition)
    const drift = await ctx.dispatch('subagent_codex', { description: 'd', prompt: 'p' }, tok('drift'))
    expect(drift.error).toBeInstanceOf(Error)
    expect(drift.error?.message ?? '').toContain('DRIFT')
    expect(drift.nextCalls).toBe(0)
    expect(SERVICE_STARTS).toHaveLength(0)
    void disposeA
  })

  it('the minting control leg admits: the ORIGINAL def executes EXACTLY ONCE through the host next(), the proof lands, the same token never pays twice; the aborted call enters zero bodies', async () => {
    SERVICE_STARTS.length = 0
    CONTINUABLE.length = 0
    const seen: Array<{ family: Record<string, unknown> | undefined }> = []
    const plane = buildPlane({ backends: { spawnPending: { names: [...NAMES] } }, controlLeg: mintingControlLeg(seen) })
    if (plane.ok !== true) throw new Error(`pending build refused: ${plane.code}`)
    const ctx = memberCtx()
    const mounted = plane.value.mount(ctx)
    expect(mounted.ok).toBe(true)
    for (const name of NAMES) ctx.tools.register(nativeOf(name))
    mirrorBind(ctx, plane.value)
    const outcome = await ctx.dispatch('subagent_codex', { description: 'd', prompt: 'p' }, { id: 'tok-allow-1' })
    expect(outcome.error === undefined, `admitted walk refused: ${String(outcome.error?.message)}`).toBe(true)
    // THE one real original-def execution: exactly one service entry and
    // exactly ONE next() — the host's own body step ran the ORIGINAL def
    // (exact signature, receiver, fused abort carrier, canonical result).
    const entries = SERVICE_STARTS.length + CONTINUABLE.length
    expect(entries, 'the admitted walk entered a REAL service face exactly once').toBe(1)
    expect(outcome.nextCalls).toBe(1)
    expect(seen).toHaveLength(1)
    expect(seen[0]?.family?.['familyId']).toBe('B-SUBAGENT')
    // SINGLE-FLIGHT: the same token never owns a second governed flight.
    const replay = await ctx.dispatch('subagent_codex', { description: 'd', prompt: 'p' }, { id: 'tok-allow-1' })
    expect(replay.error).toBeInstanceOf(Error)
    expect(replay.nextCalls).toBe(0)
    expect(SERVICE_STARTS.length + CONTINUABLE.length).toBe(1)
    // MEASURED (this spec, first run): the ALREADY-ABORTED call is refused
    // EARLIER than the post-await law needs — the plane's walk answers the
    // cancelled flight at the governance edge and the wiring's own mapping
    // refuses typed P_B_SPAWN_WIRE_CALL_CANCELLED (zero backend, zero
    // consume, zero body, zero next). The post-await checks stay as
    // defense-in-depth, pinned by the SOURCE-PAIR leg.
    const aborted = await ctx.dispatch('subagent_codex', { description: 'd', prompt: 'p' }, { id: 'tok-allow-2' }, { aborted: true })
    expect(aborted.error).toBeInstanceOf(Error)
    expect(aborted.error?.message ?? '').toContain('P_B_SPAWN_WIRE_CALL_CANCELLED')
    expect(aborted.nextCalls).toBe(0)
    expect(SERVICE_STARTS.length + CONTINUABLE.length).toBe(1)
  })
})

describe('a5m2-spawn-bind-after-def ③ TERMINAL and one-shot attach law', () => {
  it('a FAILED mount and a DISPOSED mount both end attach legality (TERMINAL, checked FIRST); a spent arm answers DONE', async () => {
    // failed mount: the placement surface refuses every register.
    const dead = buildPlane({ backends: { spawnPending: { names: [...NAMES] } } })
    if (dead.ok !== true) throw new Error('pending build refused')
    const failCtx = memberCtx({ failRegister: true })
    const failed = dead.value.mount(failCtx)
    expect(failed.ok).toBe(false)
    expect(failed.code).toBe('PLANE_PLACEMENT_CONFLICT')
    expect(dead.value.attachSpawn({}).code).toBe('SPAWN_ATTACH_MOUNT_TERMINAL')

    // disposed mount: attach lands ONCE (DONE afterwards), dispose ends it.
    const live = buildPlane({ backends: { spawnPending: { names: [...NAMES] } } })
    if (live.ok !== true) throw new Error('pending build refused')
    const ctx = memberCtx()
    const mounted = live.value.mount(ctx)
    expect(mounted.ok).toBe(true)
    for (const name of NAMES) ctx.tools.register(nativeOf(name))
    const wiring = buildSpawnWiring(ctx, live.value)
    expect(live.value.attachSpawn(wiring).ok).toBe(true)
    expect(live.value.attachSpawn(wiring).code).toBe('SPAWN_ATTACH_DONE')
    if (mounted.dispose === undefined) throw new Error('the mount carries no disposer')
    mounted.dispose()
    // TERMINAL outranks DONE: the mount is DEAD, nothing may arm on it.
    expect(live.value.attachSpawn(wiring).code).toBe('SPAWN_ATTACH_MOUNT_TERMINAL')
    // attach registered NOTHING (the layer still holds exactly the natives).
    for (const name of NAMES) expect(ctx.layerFace(name)).toBe(REAL_NATIVES[name])
    // TERMINAL drains the ATTACHED wiring (root terminal card): the face
    // stops answering and NEW calls meet the adapter's own drain refusal.
    expect(live.value.backends['spawn']).toBeUndefined()
    const late = await wiring.admitOnly('list_subagent_models', { callId: 'call-late-bad' }).then(() => null, (error: unknown) => error as Error)
    expect(late).toBeInstanceOf(Error)
    expect(late?.message ?? '').toContain('DRAINING')
  })
})

describe('a5m2-spawn-bind-after-def ③b the REFUSAL GATE survives mount.dispose (terminal card)', () => {
  it('mount.dispose mid-PA: the flight that returns AFTER the dispose enters NO body; the next call meets DEAD-MOUNT at the gate — the hook is never removed to leave the native bare', async () => {
    SERVICE_STARTS.length = 0
    CONTINUABLE.length = 0
    const seen: Array<{ family: Record<string, unknown> | undefined }> = []
    let openGate!: () => void
    const gate = new Promise<void>((resolve) => { openGate = resolve })
    const inner = mintingControlLeg(seen)
    const plane = buildPlane({
      backends: { spawnPending: { names: [...NAMES] } },
      controlLeg: async (input: Parameters<typeof inner>[0]) => { await gate; return await inner(input) },
    })
    if (plane.ok !== true) throw new Error('pending build refused')
    const ctx = memberCtx()
    const mounted = plane.value.mount(ctx)
    expect(mounted.ok).toBe(true)
    for (const name of NAMES) ctx.tools.register(nativeOf(name))
    mirrorBind(ctx, plane.value)
    // ONE flight in flight while the control leg holds the PA walk open.
    const inflight = ctx.dispatch('subagent_codex', { description: 'd', prompt: 'p' }, { id: 'tok-inflight' })
    await new Promise((resolve) => { setTimeout(resolve, 0) })
    await new Promise((resolve) => { setTimeout(resolve, 0) })
    if (mounted.dispose === undefined) throw new Error('the mount carries no disposer')
    mounted.dispose()
    openGate()
    const outcome = await inflight
    expect(outcome.error).toBeInstanceOf(Error)
    expect(outcome.nextCalls).toBe(0)
    expect(SERVICE_STARTS.length + CONTINUABLE.length).toBe(0)
    // A NEW call after the dispose: the hook STILL listens and the SAME
    // live fact refuses at the gate (拒绝门保留 — a bare native never runs).
    const after = await ctx.dispatch('subagent_codex', { description: 'd', prompt: 'p' }, { id: 'tok-after-dispose' })
    expect(after.error).toBeInstanceOf(Error)
    expect(after.error?.message ?? '').toContain('DEAD-MOUNT')
    expect(after.nextCalls).toBe(0)
    expect(SERVICE_STARTS.length + CONTINUABLE.length).toBe(0)
  })
})

describe('a5m2-spawn-bind-after-def ④ the production lane carries the same law (source pair)', () => {
  const BINDINGS = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/plugin/live/agent-bindings.mjs'), 'utf8')
  const PLANE = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '../src/plugin/live/team-tool-plane.mjs'), 'utf8')
  const laneStart = BINDINGS.indexOf('THE DEFERRED LANE')
  const laneEnd = BINDINGS.indexOf('B-SCHEDULE (root', laneStart)
  const lane = laneStart >= 0 && laneEnd > laneStart ? BINDINGS.slice(laneStart, laneEnd) : ''

  it('deny guard arms BEFORE the subscriptions; refusals never lift it; NOT_MOUNTED stays pending; the lift is the LAST step', () => {
    expect(lane.length > 2000, 'the deferred lane was found').toBe(true)
    expect(lane.indexOf('runtimeAgent?.ctx?.tools?.guard')).toBeGreaterThanOrEqual(0)
    expect(lane.indexOf('guard-seam-unavailable')).toBeGreaterThan(0)
    expect(lane.indexOf('tools.guard')).toBeLessThan(lane.indexOf("agentCtx.on('tools/change'"))
    const refuse = lane.slice(lane.indexOf('const spawnDeferRefuse'), lane.indexOf('const spawnDeferRecheck'))
    expect(refuse).not.toContain('guardDispose')
    expect(lane).toContain("=== 'SPAWN_ATTACH_NOT_MOUNTED') return")
    expect(lane.indexOf('readback-refused')).toBeLessThan(lane.indexOf('DEFER-GUARD-LIFT-FAULT'))
    expect(lane.indexOf('DEFER-GUARD-LIFT-FAULT')).toBeLessThan(lane.lastIndexOf('spawnDeferClose()'))
  })

  it('the lane is the HOOK route: ctx.on(tools/execute), admitOnly, post-await rechecks, exactly one next() — and NEVER the delegate on that path', () => {
    const hook = lane.slice(lane.indexOf("ctx.on('tools/execute'"), lane.indexOf('THE FAMILY CLAIM'))
    expect(hook.length > 1000, 'the hook block was found').toBe(true)
    expect(hook).toContain('exec?.agent !== runtimeAgent')
    expect(hook).toContain('await wiring.admitOnly(exec?.name, exec)')
    expect(hook).toContain('return await next()')
    // delegate XOR next: the row's DELEGATE face is never touched here.
    expect(hook).not.toContain('delegate(')
    expect(hook).not.toContain('.execute(')
    expect(hook).toContain('governed !== true')
    expect(hook).toContain('aborted after the PA walk')
    expect(hook).toContain('face moved during the PA walk')
    expect(hook).toContain('plane-spawn:')
    // the family claim rides the REAL native identities through the ONE
    // registration table; the readback is identity-bound to the ORIGINAL.
    expect(lane).toContain('registerA5GovernedFamily(spawnReg.definitionIdentity, spawnReg.entry)')
    expect(lane).toContain('liveFace !== spawnCaptured[spawnName]?.native')
    // the deferred feed answers the REAL NATIVE identity, never a guess.
    expect(BINDINGS).toContain('真实native identity登记原family')
  })

  it('the plane registers NOTHING on attach, rejects TERMINAL FIRST, and ends legality at the failed/disposed mount entries', () => {
    const attach = PLANE.slice(PLANE.indexOf('attachSpawn: (wiring) =>'), PLANE.indexOf('mount: (agentCtx)'))
    expect(attach).not.toContain('tools.register')
    expect(attach).toContain('registers NOTHING')
    expect(attach.indexOf('SPAWN_ATTACH_MOUNT_TERMINAL')).toBeGreaterThanOrEqual(0)
    expect(attach.indexOf('SPAWN_ATTACH_MOUNT_TERMINAL')).toBeLessThan(attach.indexOf('SPAWN_ATTACH_DONE'))
    const mount = PLANE.slice(PLANE.indexOf('mount: (agentCtx) =>'), PLANE.indexOf('observe(`a5-plane: placed'))
    expect(mount).toContain('spawnMountTerminal = true')
    expect(mount).toContain('spawnMountMounted = false')
    // CATCH ENTRY FIRST (root limited ruling 2026-10-24): the terminal flag
    // lands BEFORE any rollback disposer fires tools/change synchronously.
    expect(PLANE.indexOf('spawnMountTerminal = true')).toBeLessThan(PLANE.indexOf('disposers.reverse()'))
    const dispose = PLANE.slice(PLANE.indexOf('observe(`a5-plane: placed'))
    expect(dispose.indexOf('spawnMountTerminal = true')).toBeLessThan(dispose.indexOf('A5-M2: no hand-off survives'))
    // TERMINAL drains the ATTACHED wiring and flips the live face the hook
    // reads (root terminal card): the refusal gate stays, never a bare run.
    expect(dispose).toContain('spawnAttachedWiring?.drain?.()')
    expect(dispose.indexOf('spawnMountTerminal = true')).toBeLessThan(dispose.indexOf('spawnAttachedWiring?.drain?.()'))
    expect(dispose).toContain('spawnAttachedWiring = null')
    // the hook reads the SAME live fact before AND after the PA walk.
    const hookBlock = lane.slice(lane.indexOf("ctx.on('tools/execute'"), lane.indexOf('THE FAMILY CLAIM'))
    expect(hookBlock.split('backends?.spawn !== wiring').length - 1).toBe(2)
    expect(hookBlock).toContain('DEAD-MOUNT refuses before the PA walk')
    expect(hookBlock).toContain('died during the PA walk')
  })

  it('the plane build keeps the single conjunct + the pending arm row; the family fill stays SINGLE', () => {
    expect(BINDINGS).toContain('a5SpawnWiring === null && a5SpawnDefer === null')
    expect(BINDINGS).toContain("spawnPending: { names: a5SpawnDefer.pendingNames }")
    expect(BINDINGS).toContain('if (a5SpawnWiring !== null && a5SpawnDefer === null) {')
    expect(BINDINGS).toContain('spawnDeferPlane = built.value')
    expect(BINDINGS).toContain('spawnDeferRecheckFn()')
  })
})
