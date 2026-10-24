/**
 * a5m2-spawn-bind-after-def-c1.test.ts — the A5M2 B-SPAWN bind-after-def
 * (LATE-ATTACH) targeted regressions (root option-A ruling 2026-10-24, the
 * startup-timing fix: the census-'always' definitions register at
 * agent/created, which the host announces only AFTER AgentSetup resolves;
 * the source-verified public shape:
 *   - packages/core/scope/src/store.ts :249-265 — an effect INSERTS first and
 *     fires `onChange()` synchronously AFTER the insert (notify-after law),
 *     yielding the disposer;
 *   - packages/core/tools/src/index.ts :199-208 + :835 — every registration
 *     change emits the PUBLIC `tools/change` (NO arguments, NOT scope-filtered
 *     — a wake must re-read through tools.get(name, agent));
 *   - tool-subagent src/index.ts :665-710 — the defs are SUPPLIED on the
 *     agent/created event (documented synchronous re-entry).
 * THE THREE LEGS (root's list, in the REAL public order):
 *   ① EARLY registration — a def already present at setup keeps the fast lane
 *      byte-identical: the attach face refuses (NOT_PENDING), the build-time
 *      arm and the PA seat stay exactly as before, and spawn+spawnPending is
 *      a typed construction refusal.
 *   ② LATE registration — the first call must NOT bypass (the sameAgent deny
 *      guard holds the whole family from before any call), the event only
 *      TRIGGERS a same-scope re-read, the ONE attach lands the defs, the
 *      takeover is what the scoped face answers, and the guard lifts ONLY
 *      after the full path. A partial supply stays pending + denied.
 *   ③ CANCELLATION / UNLOAD — an owner that closes before supply never
 *      attaches and never lifts deny; the mount's dispose removes the
 *      ATTACHED defs exactly like the mount's own placements (the attached
 *      rows are unloaded, the prior face restored).
 * WHAT IS REAL: the production plane assembly, the production spawn wiring,
 * the REAL published native definitions captured from the pristine baseline
 * (0.2.0-rc.2 @ 639ed015397), the plane's real placementFeed and spawnPaSeat
 * seat. WHAT STANDS IN (disclosed): the member agent ctx is the same
 * registration surface the c1 specs mount against (insert-then-notify,
 * same-layer later-wins, monotonic deny-only guard — the host laws cited
 * above, reproduced verbatim); the dispatcher's bindOwnTools and the real
 * agent lifecycle live-announce stay window-scope (the binding-side ordering
 * is pinned by the SOURCE-PAIR leg below, per the established a5 idiom: the
 * registration site lives inside createAgentBindings, which no in-repo spec
 * has ever driven without a live Host).
 * NOT C2 — no Host, no ports, no worlds, no network, no writes.
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
type AttachResult = { ok: boolean, code?: string, detail?: string, message?: string, disposeAttached?: () => void }
type PlaneValue = {
  attachSpawn: (wiring: unknown) => AttachResult
  placementFeed: (name: string) => { definitionIdentity: string } | undefined
  spawnPaSeat?: unknown
  mount: (agentCtx: unknown) => { ok: boolean; code?: string; dispose?: () => void }
  backends: Record<string, unknown>
}

const PLANE_ROW = (await import(new URL('../src/plugin/live/team-tool-plane.mjs', import.meta.url).href)) as unknown as {
  createTeamToolPlaneAssembly: (input: Record<string, unknown>) => { ok: true, value: PlaneValue } | { ok: false, code: string, message?: string }
}
const WIRING = (await import(new URL('../src/plugin/live/governed-families/subagent-spawn-wiring.mjs', import.meta.url).href)) as unknown as {
  createSubagentSpawnWiring: (input: Record<string, unknown>) => { ok: true, wiring: Record<string, unknown> } | { ok: false, code?: string, message?: string }
}
const ADAPTER = (await import(new URL('../src/plugin/live/governed-families/subagent-spawn-adapters.mjs', import.meta.url).href)) as unknown as { A5_B_SUBAGENT_SPAWN_TOOL_NAMES: readonly string[] }
const NAMES = ADAPTER.A5_B_SUBAGENT_SPAWN_TOOL_NAMES
const TD = (await import(new URL('../tool-dispatch/index.js', import.meta.url).href)) as unknown as { definitionIdentityOf: (target: unknown) => string | null }

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
        start: async (name: string, request: Record<string, unknown>) => ({ id: 'run-bad-1', result: Promise.resolve({ stopReason: 'completed', output: [{ type: 'text', text: 'child done' }] }), dispose: () => undefined, ...(name === undefined || request === undefined ? {} : {}) }),
        startContinuable: async () => ({ childId: 'sub-bad-1' }),
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

const AGENT: Record<string, unknown> = { id: 'agent-parent-bad-1', session: { id: 'session-parent-bad-1' }, options: {} }
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

/** The member registration surface: the host laws REPRODUCED (each cited at
 *  the header) — insert-then-notify (core/scope store.ts :249-265), same-layer
 *  later-wins with the disposer restoring the prior face, the monotonic
 *  DENY-ONLY guard (core/tools index.ts :1126-1135), the public synchronous
 *  `tools/change` with NO payload and NO scope filter (:835). */
function memberCtx() {
  const layer = new Map<string, Definition>()
  const guards: Array<(exec: Record<string, unknown>) => string | undefined> = []
  const listeners: Array<() => void> = []
  const emit = () => { for (const fn of [...listeners]) fn() } // notify AFTER the insert, synchronous (re-entrant-safe via array copy)
  return {
    tools: {
      register: (def: Definition) => {
        const hadPrev = layer.has(def.name)
        const prev = layer.get(def.name)
        layer.set(def.name, def)
        emit()
        let done = false
        return () => {
          if (done) return
          done = true
          if (hadPrev) layer.set(def.name, prev as Definition)
          else layer.delete(def.name)
          emit()
        }
      },
      get: (name: string, agent?: unknown) => (agent === AGENT ? layer.get(name) : undefined),
      guard: (fn: (exec: Record<string, unknown>) => string | undefined) => {
        guards.push(fn)
        return () => { const i = guards.indexOf(fn); if (i >= 0) guards.splice(i, 1) }
      },
    },
    on: (_event: string, fn: () => void) => {
      listeners.push(fn)
      return () => { const i = listeners.indexOf(fn); if (i >= 0) listeners.splice(i, 1) }
    },
    // the guard-gate a dispatch passes BEFORE any execute (first denial wins,
    // allow is not a guard outcome):
    deniedByGuard: (name: string) => guards.some((fn) => typeof fn({ name, agent: AGENT }) === 'string'),
    hasDefs: () => [...layer.keys()],
  }
}

/** The owner-built wiring over faces ACTUALLY READ from the member scope —
 *  the production glue pattern (agent-bindings spawn block): lazy plane
 *  seams, the real generation container, capture identities per law. */
function ownerWiring(faces: Record<string, Definition>, planeRef: { current: PlaneValue | null }): Record<string, unknown> {
  const captured = Object.fromEntries(NAMES.map((name) => [name, { native: faces[name], definitionIdentity: `cap:${name}` }]))
  const delegates = Object.freeze(Object.fromEntries(NAMES.map((name) => [name, faces[name].execute as never])))
  const built = WIRING.createSubagentSpawnWiring({
    providerId: 'a5bad-wire',
    realmId: REALM,
    captured,
    liveNative: (name: string) => faces[name],
    spawnDelegates: delegates,
    liveSpawnDelegates: () => delegates,
    placementFeed: (name: string) => planeRef.current?.placementFeed?.(name),
    paAdmit: (request: Record<string, unknown>) => {
      const seat = planeRef.current?.spawnPaSeat
      if (typeof seat !== 'function') throw new Error('a5bad-spec: the mount carries no spawnPaSeat')
      return (seat as (r: Record<string, unknown>) => unknown)(request)
    },
    observe: () => undefined,
  })
  if (built.ok !== true) throw new Error(`spawn wiring refused: ${String(built.code)} — ${String(built.message)}`)
  return built.wiring
}

describe('a5m2-spawn-bind-after-def-c1', () => {
  it('① EARLY registration keeps the fast lane byte-identical and the attach face inert', () => {
    const planeRef: { current: PlaneValue | null } = { current: null }
    const faces = Object.fromEntries(NAMES.map((n) => [n, REAL_NATIVES[n]])) as Record<string, Definition>
    const wiring = ownerWiring(faces, planeRef)
    const built = buildPlane({ backends: { spawn: wiring } })
    expect(built.ok).toBe(true)
    if (built.ok !== true) return
    planeRef.current = built.value
    // the build-time arm carries the face and the seat exactly as before:
    expect(built.value.backends.spawn).toBe(wiring)
    expect(typeof built.value.spawnPaSeat).toBe('function')
    // a fast mount has NOTHING for attachSpawn to do: typed refusal.
    expect(built.value.attachSpawn(wiring)).toMatchObject({ ok: false, code: 'SPAWN_ATTACH_NOT_PENDING' })
    // spawn + spawnPending at once is a typed construction refusal.
    const both = buildPlane({ backends: { spawn: wiring, spawnPending: { names: [...NAMES] } } })
    expect(both).toMatchObject({ ok: false, code: 'SPAWN_WIRING_INJECT_INVALID' })
    // a malformed pending list refuses the SAME way.
    const bad = buildPlane({ backends: { spawnPending: { names: [] } } })
    expect(bad).toMatchObject({ ok: false, code: 'SPAWN_WIRING_INJECT_INVALID' })
  })

  it('② LATE registration: deny-first, event-triggered same-scope re-read, ONE attach, takeover at the scoped face', () => {
    const pending = buildPlane({ backends: { spawnPending: { names: [...NAMES] } } })
    expect(pending.ok).toBe(true)
    if (pending.ok !== true) return
    const planeRef: { current: PlaneValue | null } = { current: null }
    // the PENDING arm: the PA seat is supplied early; the spawn FACE is not.
    expect(typeof pending.value.attachSpawn).toBe('function')
    expect(typeof pending.value.spawnPaSeat).toBe('function')
    expect(pending.value.backends.spawn).toBeUndefined()
    // attach is illegal before the mount placed.
    const earlyFaces = Object.fromEntries(NAMES.map((n) => [n, REAL_NATIVES[n]])) as Record<string, Definition>
    expect(pending.value.attachSpawn(ownerWiring(earlyFaces, planeRef))).toMatchObject({ ok: false, code: 'SPAWN_ATTACH_NOT_MOUNTED' })

    const ctx = memberCtx()
    const mounted = pending.value.mount(ctx)
    expect(mounted.ok).toBe(true)
    planeRef.current = pending.value

    // THE SAMEAGENT DENY GUARD IS ARMED FIRST — before any call is possible
    // (this is what closes the window the setup-time throw used to die on):
    const denied = new Set<string>(NAMES)
    const guardLift = ctx.tools.guard((exec) => (exec?.agent === AGENT && denied.has(String(exec?.name))
      ? 'a5bad-spec: bind-after-def PENDING — governed deny'
      : undefined))
    expect(ctx.deniedByGuard('subagent')).toBe(true)
    expect(ctx.deniedByGuard('subagent_fork')).toBe(true)

    // SUBSCRIBE FIRST, re-read ON THE SPOT: the event only TRIGGERS the
    // same-scope re-read; the re-read itself is the proof.
    let attached: { wiring: Record<string, unknown> } | null = null
    let attachCalls = 0
    // THE IN-FLIGHT GATE (the binding lane's own discipline, mirrored here):
    // the registrar's insert notifies SYNCHRONOUSLY, so the attach's own
    // registers re-enter this listener — a second attach may never start.
    let attachInFlight = false
    const recheck = () => {
      if (attached !== null || attachInFlight) return
      const faces: Record<string, Definition> = {}
      for (const name of NAMES) {
        const face = ctx.tools.get(name, AGENT)
        if (face === undefined || typeof (face as Definition).execute !== 'function') return // still pending — deny holds
        faces[name] = face as Definition
      }
      attachInFlight = true
      try {
        attachCalls += 1
        const result = pending.value.attachSpawn(ownerWiring(faces, planeRef))
        if (result.ok === true) attached = { wiring: ownerWiringRef(result) }
      } finally { attachInFlight = false }
    }
    // ownerWiringRef: attach returns { ok, disposeAttached }; the wiring was
    // the argument — re-derive by re-reading the plane face after attach.
    function ownerWiringRef(_result: AttachResult): Record<string, unknown> { return pending.value.backends.spawn as Record<string, unknown> }
    const off = ctx.on('tools/change', () => { try { recheck() } catch { /* never break the emitter */ } })
    // (the binding lane re-reads once immediately after subscribing — the
    // mount has placed but no family def exists yet: still pending.)
    recheck()
    expect(attached).toBeNull()
    expect(attachCalls).toBe(0)
    expect(ctx.deniedByGuard('subagent')).toBe(true)

    // THE PUBLIC SUPPLY ORDER: agent/created → the registrar inserts each def
    // and the store notifies AFTER the insert. A PARTIAL supply must stay
    // pending + denied (this is exactly window A's shape at setup):
    const nativeDisposers = NAMES.map((name) => ctx.tools.register(REAL_NATIVES[name]))
    // both landed via the synchronous per-insert events:
    expect(attached).not.toBeNull()
    expect(attachCalls).toBe(1) // ONE attach — event re-entry never double-binds

    // TAKEOVER: the scoped face now answers THIS MOUNT'S governed definition,
    // not the native; the backends face carries the attached wiring; the
    // placement feed (family-claim leg) answers both rows.
    const defs = (attached as unknown as { wiring: { definitions: Array<{ name: string }> & Record<string, unknown> } }).wiring.definitions
    for (const def of defs) {
      expect(ctx.tools.get(def.name, AGENT)).toBe(def)
      expect(pending.value.placementFeed(def.name)?.definitionIdentity).toBeTruthy()
    }
    expect(pending.value.backends.spawn).toBe(attached === null ? null : (attached as unknown as { wiring: unknown }).wiring)
    // the deny lifts ONLY after the full path — simulated exactly in that
    // order by the owner (this is where the binding lifts its guard):
    guardLift()
    expect(ctx.deniedByGuard('subagent')).toBe(false)

    // ONE attach ever: the arm is spent (never a retry, never a re-bind).
    expect(pending.value.attachSpawn(ownerWiring(earlyFaces, planeRef))).toMatchObject({ ok: false, code: 'SPAWN_ATTACH_DONE' })
    off()
    for (const dispose of nativeDisposers) dispose()
  })

  it('②b a PARTIAL supply stays pending + denied; removal before completion never attaches', () => {
    const pending = buildPlane({ backends: { spawnPending: { names: [...NAMES] } } })
    expect(pending.ok).toBe(true)
    if (pending.ok !== true) return
    const planeRef: { current: PlaneValue | null } = { current: null }
    const ctx = memberCtx()
    const mounted = pending.value.mount(ctx)
    expect(mounted.ok).toBe(true)
    planeRef.current = pending.value
    const denied = new Set<string>(NAMES)
    const guardLift = ctx.tools.guard((exec) => (exec?.agent === AGENT && denied.has(String(exec?.name)) ? 'pending deny' : undefined))
    let attachedSeen = false
    const off = ctx.on('tools/change', () => {
      const faces: Record<string, Definition> = {}
      for (const name of NAMES) {
        const face = ctx.tools.get(name, AGENT)
        if (face === undefined || typeof face.execute !== 'function') return
        faces[name] = face
      }
      if (pending.value.attachSpawn(ownerWiring(faces, planeRef)).ok === true) attachedSeen = true
    })
    // only ONE def supplied — still pending, still denied:
    const first = ctx.tools.register(REAL_NATIVES[NAMES[0] as string])
    expect(attachedSeen).toBe(false)
    expect(ctx.deniedByGuard('subagent')).toBe(true)
    expect(ctx.deniedByGuard('subagent_fork')).toBe(true)
    // then REMOVED before the pair ever completed: still pending, still
    // denied — an incomplete world never executes (root: 移除/身份漂移转拒绝):
    first()
    expect(attachedSeen).toBe(false)
    expect(pending.value.backends.spawn).toBeUndefined()
    guardLift() // the owner refuses THIS arm; the lane closes without ever
    off()      // having let a single unmanaged call through
  })

  it('③ CANCELLATION/UNLOAD: a closed owner never attaches; mount dispose unloads the attached rows', () => {
    const pending = buildPlane({ backends: { spawnPending: { names: [...NAMES] } } })
    expect(pending.ok).toBe(true)
    if (pending.ok !== true) return
    const planeRef: { current: PlaneValue | null } = { current: null }
    const ctx = memberCtx()
    const mounted = pending.value.mount(ctx)
    expect(mounted.ok).toBe(true)
    planeRef.current = pending.value
    // the owner closes BEFORE any supply (agent/disposed in production):
    const off = ctx.on('tools/change', () => { throw new Error('a5bad-spec: a closed owner must never be woken') })
    off()
    for (const name of NAMES) ctx.tools.register(REAL_NATIVES[name])
    expect(pending.value.backends.spawn).toBeUndefined() // nothing attached — the throw above never ran

    // UNLOAD after a real attach: the attached defs ride the mount's OWN
    // disposer list — mount.dispose() removes them and restores the prior
    // (native) faces, exactly like the mount's own placements.
    const faces = Object.fromEntries(NAMES.map((n) => [n, ctx.tools.get(n, AGENT)])) as unknown as Record<string, Definition>
    const wiring = ownerWiring(faces, planeRef)
    const attached = pending.value.attachSpawn(wiring)
    expect(attached.ok).toBe(true)
    for (const name of NAMES) expect(ctx.tools.get(name, AGENT)).toBe((wiring as unknown as { definitions: Array<{ name: string }> }).definitions.find((d) => d.name === name))
    expect(typeof mounted.dispose).toBe('function')
    ;(mounted.dispose as () => void)()
    for (const name of NAMES) expect(ctx.tools.get(name, AGENT)).toBe(REAL_NATIVES[name]) // rows unloaded, prior face restored
    // the attach stays SPENT across unload (no re-bind behind a dead mount):
    expect(pending.value.attachSpawn(ownerWiring(faces, planeRef))).toMatchObject({ ok: false, code: 'SPAWN_ATTACH_DONE' })
  })

  it('source-pair: the deferred lane in agent-bindings arms deny BEFORE subscribing, keeps deny on every refusal path, and lifts only after bind + family claim + readback', () => {
    const src = readFileSync(join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'plugin', 'live', 'agent-bindings.mjs'), 'utf8')
    const iGuard = src.indexOf('runtimeAgent.ctx.tools.guard(')
    const iSub = src.indexOf("agentCtx.on('tools/change'")
    const iDisarmed = src.indexOf('a5m2-spawn: DEFER-ARMED')
    expect(iGuard).toBeGreaterThan(-1)
    expect(iSub).toBeGreaterThan(iGuard) // deny guard is armed BEFORE the subscription
    expect(iDisarmed).toBeGreaterThan(iSub)
    // refuse keeps deny: the refuse helper unwinds LANDED defs but never the guard
    const refuseBody = src.slice(src.indexOf('const spawnDeferRefuse ='), src.indexOf('const spawnDeferRecheck ='))
    expect(refuseBody).toContain('disposeAttached')
    expect(refuseBody).not.toContain('guardDispose')
    // NOT_MOUNTED stays pending (never a wait, never a retry ladder):
    expect(src).toContain("=== 'SPAWN_ATTACH_NOT_MOUNTED') return")
    // cancellation keeps deny:
    const cancelBody = src.slice(src.indexOf('a5m2-spawn: DEFER-CANCELLED') - 900, src.indexOf('a5m2-spawn: DEFER-CANCELLED'))
    expect(cancelBody).not.toContain('guardDispose')
    // the LIFT is the LAST half of the full path: after the family claim and
    // the real assembly readback, inside the recheck:
    const iLift = src.indexOf('a5SpawnDefer.guardDispose?.() } catch')
    const iReadback = src.indexOf('assembly-readback-refused')
    const iFamily = src.indexOf('for (const spawnReg of wiring.familyRegistrations()) registerA5GovernedFamily(spawnReg.definitionIdentity, spawnReg.entry)')
    expect(iLift).toBeGreaterThan(iReadback)
    expect(iLift).toBeGreaterThan(iFamily)
    // the pending arm rides the plane build and the post-mount re-read:
    expect(src).toContain('a5SpawnWiring === null && a5SpawnDefer === null')
    expect(src).toContain('{ spawnPending: { names: a5SpawnDefer.pendingNames } }')
    expect(src.indexOf('spawnDeferPlane = built.value')).toBeLessThan(src.indexOf('const placed = built.value.mount(agentCtx)'))
    expect(src.indexOf('spawnDeferRecheckFn()')).toBeGreaterThan(src.indexOf('const placed = built.value.mount(agentCtx)'))
    // ONE family fill: the setup-side point skips a deferred mount (the
    // recheck filled it at attach time; a second claim would throw).
    expect(src).toContain('if (a5SpawnWiring !== null && a5SpawnDefer === null) {')
  })
})
