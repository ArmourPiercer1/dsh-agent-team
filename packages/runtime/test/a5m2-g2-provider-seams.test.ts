/**
 * A5M2-G2-PROVIDER-SEAMS — the REAL M0 provider-seam implementations
 * (g2-provider-seams.mjs; ROOT ROUND-2 card + RE-REVIEW 502bc8316) proven
 * per seam:
 *
 *  - WEB pin (provider level, re-review 2): the seam is the provider the
 *    Team assembly registers via the PUBLIC ctx.web.registerSearchProvider/
 *    registerFetchProvider faces (web/src/index.ts:103/:114 @639ed01539).
 *    Every dispatch re-verifies the pinned REAL provider object, the
 *    availability mirror, and the FULL destination envelope — endpoint
 *    ORIGIN + HTTP-METHOD identity + immutable CONFIG identity, live from a
 *    REQUIRED reader (reader omitted cannot build; origin-only cannot
 *    pass) — plus the frozen request binding BEFORE forwarding. A noTeam
 *    install keeps ZERO seam effect (inert import; assembly-scoped
 *    registration — leg-proven). Zero forwarding on any drift.
 *  - MCP request lease (re-review 3): request() runs inside the runtime's
 *    request-time selection (mcp-resources/src/index.ts:80/:120-125
 *    @639ed01539). The connection-owning assembly's captureConnection is
 *    REQUIRED — capture ONCE at entry, re-verify generation+CLIENT at the
 *    execution edge; a missing/incomplete capture point lets NO call
 *    through (the "unobserved" pass-through is gone); stdio locks the FULL
 *    args + cwd identity.
 *  - BROWSER governed lease (re-review 1), written to the OWNER contract
 *    (browser-use-runtime/src/index.ts @639ed01539): PA-before-launch is
 *    structural (ordered log proves it); a PENDING launch counts in the
 *    in-flight set the moment it starts (:181) and a late arrival CLOSES
 *    ITSELF (:186-197) — CLOSED is terminal, no resurrection; close is
 *    REQUIRED (:12-18) — a missing close is OPEN_CONTRACT_BREACH and a
 *    throwing close RETAINS the entry and REJECTS with CLOSE_FAILED
 *    (:131-137) — never a fake 'closed'.
 *  - Consumption edge (card 4): consumeG2ApprovedPlan enforces the frozen
 *    actualArgs binding AT the edge; swapped args, rotated classify-time
 *    facts, or a moved row state refuse with zero native entry.
 *
 * Red-on-removal: every ordering/capture/drain leg fails if the sequencing
 * is removed from the module (the factory never logs before the PA edge;
 * drift calls assert ZERO forwarding; drain legs assert the late close /
 * retained entry the module actually performs). Disclosed stand-ins: every
 * provider/lease behind the seams is a TEST-owned double — these legs are
 * NOT C2 and prove no real-Host dimension. The real Host-validator fixed
 * point (11 registration faces) stays pinned in
 * a5m2-g2-connector-adapters.test.ts; THIS module exposes no tool
 * registration face, so no validator leg is duplicated here. Module status:
 * UNWIRED (wiring is the CENTER's); Windows dimensions:
 * NOT_RUN_WINDOWS_UNAUTHORIZED.
 *
 * Scope: NO Host process, NO network, NO mount.
 *
 * @module @dsh-agent-team/runtime/test/a5m2-g2-provider-seams
 */
import { describe, it, expect } from 'vitest'

// ── typed module faces ──────────────────────────────────────────────
interface SeamFacts { [key: string]: unknown }
interface SeamError extends Error { code?: string }
interface WebProviderLike { id: string, available: () => boolean, search?: (r: unknown, s?: unknown) => Promise<unknown>, fetch?: (r: unknown, s?: unknown) => Promise<unknown> }
interface WebSeamResult {
  provider: WebProviderLike
  registrationLaw: Record<string, unknown>
  lastDispatch: () => SeamFacts | null
  stats: () => { dispatchCount: number, driftRejects: number }
}
interface McpSeamResult {
  provider: { request: (r: unknown, e: unknown) => Promise<unknown> }
  serverName: string
  declaredSurface: Record<string, unknown>
  registrationLaw: Record<string, unknown>
  lastDispatch: () => SeamFacts | null
  stats: () => { dispatchCount: number, driftRejects: number }
}
interface LeaseSnapshot {
  state: string
  mode: string
  drainSemantics: string
  paDecisions: number
  paRefusals: number
  launchCount: number
  closeCount: number
  order: readonly string[]
}
interface LeaseResult {
  run: (callFacts: Record<string, unknown>, work: (resource: unknown, signal?: unknown) => Promise<unknown>, signal?: unknown) => Promise<unknown>
  drain: () => Promise<LeaseSnapshot>
  state: () => string
  snapshot: () => LeaseSnapshot
  launchOrder: () => readonly string[]
  governanceLaw: Record<string, unknown>
}
interface RowFace {
  classify: (args: unknown) => Record<string, unknown> | Promise<Record<string, unknown>>
  invoke: (args: unknown, exec?: unknown) => Promise<Record<string, unknown>>
  drain?: () => void
}
interface MountFacts { endpointOrigin: string, method: string, configIdentity: string }

const S = (await import(new URL('../src/plugin/live/governed-families/g2-provider-seams.mjs', import.meta.url).href)) as {
  A5_G2_SEAM_REVISION: number
  A5_G2_SEAM_CODES: Record<
    | 'REAL_PROVIDER_ABSENT' | 'CONFIG_IDENTITY_MISMATCH' | 'ALREADY_WRAPPED' | 'IDENTITY_DRIFT'
    | 'PROVIDER_UNAVAILABLE' | 'ENDPOINT_DRIFT' | 'MOUNT_FACTS_INCOMPLETE' | 'MOUNT_FACTS_DRIFT'
    | 'CONFIG_DRIFT' | 'SURFACE_DRIFT' | 'CAPTURE_INCOMPLETE' | 'REQUEST_METHOD_UNKNOWN'
    | 'ARGUMENTS_REBIND' | 'DESTINATION_INVALID' | 'ASSEMBLY_FACTS_MISSING' | 'PA_NOT_CONSUMED'
    | 'LEASE_DRAINING' | 'LEASE_CLOSED' | 'LAUNCH_FAILED' | 'OPEN_CONTRACT_BREACH' | 'CLOSE_FAILED'
    | 'ARGS_REBOUND' | 'PLAN_UNUSABLE',
    string
  >
  A5_G2_SEAM_NAMED_GAPS: Record<'LAUNCH_OWNER' | 'MCP_LIVE_TRANSPORT', string>
  G2_SEAM_BRAND: symbol
  A5_G2_LEASE_DRAIN_SEMANTICS: string
  createG2FrozenArgsBinding: (d: { label: string, value: unknown }) => { label: string, snapshot: unknown, fingerprint: string, verify: (live: unknown) => { ok: boolean, code?: string, detail?: string } }
  createG2WebProviderSeam: (d: Record<string, unknown>) => WebSeamResult
  createG2McpProviderSeam: (d: Record<string, unknown>) => McpSeamResult
  createG2BrowserResourceLease: (d: Record<string, unknown>) => LeaseResult
  consumeG2ApprovedPlan: (d: { row: RowFace, plan: unknown, args: unknown, exec?: unknown }) => Promise<Record<string, unknown>>
}
const A = (await import(new URL('../src/plugin/live/governed-families/g2-connector-adapters.mjs', import.meta.url).href)) as {
  A5_G2_TYPED_CODES: Record<'DRAINING', string>
  A5_G2_NAMED_BLOCKERS: Record<'WEB' | 'MCP' | 'BROWSER', string>
  createG2WebAdapters: (deps: Record<string, unknown>) => { web_fetch: RowFace & { drain: () => void }, web_search: RowFace & { drain: () => void } }
}
const SC = S.A5_G2_SEAM_CODES

/* ── doubles ──────────────────────────────────────────────────────── */
interface WebInner {
  id: string
  available: () => boolean
  calls: Array<Record<string, unknown>>
  search: (r: unknown, s?: unknown) => Promise<unknown>
  fetch: (r: unknown, s?: unknown) => Promise<unknown>
}
function webInner (id: string): WebInner {
  const dbl: WebInner = { id, available: () => true, calls: [], search: async () => ({}), fetch: async () => ({}) }
  dbl.search = async (r, s) => { dbl.calls.push({ request: r, signal: s }); return { served: 'search' } }
  dbl.fetch = async (r, s) => { dbl.calls.push({ request: r, signal: s }); return { served: 'fetch' } }
  return dbl
}
const SEARCH_FACTS: MountFacts = { endpointOrigin: 'https://search.deepseek.example', method: 'POST', configIdentity: 'sha256:cfg-search-a1' }
const FETCH_FACTS: MountFacts = { endpointOrigin: 'https://fetch.deepseek.example', method: 'GET', configIdentity: 'sha256:cfg-fetch-b2' }

interface McpInner { request: (r: unknown, e: unknown) => Promise<unknown>, calls: Array<Record<string, unknown>> }
function mcpInner (): McpInner {
  const dbl: McpInner = { calls: [], request: async () => ({ resources: [] }) }
  dbl.request = async (r, e) => { dbl.calls.push({ request: r, exec: e }); return { resources: [] } }
  return dbl
}
interface NativeDef { name: string, description: string, execute: (args: unknown, exec: unknown) => Promise<unknown>, calls: Array<Record<string, unknown>> }
function nativeDef (name: string): NativeDef {
  const dbl: NativeDef = { name, description: 'd', calls: [], execute: async () => ({ ok: 'native' }) }
  dbl.execute = async (args, exec) => { dbl.calls.push({ args, exec }); return { ok: 'native' } }
  return dbl
}

/** The async typed-refusal catcher — a success here is a spec failure. */
async function asyncError (fn: () => unknown): Promise<SeamError> {
  try {
    await fn()
  } catch (e) {
    const err = e as SeamError
    expect(err.message).toMatch(/P_G2_SEAM_/)
    return err
  }
  throw new Error('expected a typed P_G2_SEAM_ refusal — the call succeeded')
}
function syncError (fn: () => unknown): SeamError {
  try {
    fn()
  } catch (e) {
    const err = e as SeamError
    expect(err.message).toMatch(/P_G2_SEAM_|ASSEMBLY_FACTS_MISSING/)
    return err
  }
  throw new Error('expected a typed throw — the call returned normally')
}
const flush = async (n = 16): Promise<void> => { for (let i = 0; i < n; i += 1) await Promise.resolve() }
const EXEC: Record<string, unknown> = { agent: { id: 'agent-g2-seams' } }

/* ── WEB seam ─────────────────────────────────────────────────────── */
describe('a5m2-g2-seams WEB pin', () => {
  it('the seam IS the registered provider: verbatim forward of the ORIGINAL request; the FULL mount envelope (origin+METHOD+config identity) re-read live every dispatch; per-lease facts from inside the selection stack; availability loss fails the lane CLOSED', async () => {
    const inner = webInner('deepseek-search')
    const seam = S.createG2WebProviderSeam({
      kind: 'search',
      providerId: 'deepseek-search',
      getRealProvider: () => inner,
      declared: { ...SEARCH_FACTS },
      readMountFacts: () => ({ ...SEARCH_FACTS }),
    })
    expect(seam.provider.id).toBe('deepseek-search')
    expect(String(seam.registrationLaw['registerVia'])).toMatch(/registerSearchProvider.*index\.ts:103 @639ed01539/)
    expect(String(seam.registrationLaw['law'])).toMatch(/WEB_PROVIDER_CONFIGURED_MISSING/) // the pin fails CLOSED per :63-72,:172-190
    const req = { queries: ['governed search'] }
    await seam.provider.search?.(req)
    expect(inner.calls.length).toBe(1)
    expect(inner.calls[0]?.['request']).toBe(req) // the ORIGINAL object, verbatim
    const facts = seam.lastDispatch()
    expect(facts?.['capturedAt']).toBe('provider-dispatch-lease')
    expect(facts?.['destinationOrigin']).toBe('https://search.deepseek.example')
    expect(facts?.['method']).toBe('POST') // METHOD identity rides the lease facts
    expect(facts?.['configIdentity']).toBe('sha256:cfg-search-a1') // immutable config identity rides too
    expect(seam.stats()).toEqual({ dispatchCount: 1, driftRejects: 0 })
    inner.available = () => false // availability mirrors the REAL provider
    expect(seam.provider.available()).toBe(false)
    const err = await asyncError(() => seam.provider.search?.(req))
    expect(err.code).toBe(SC.PROVIDER_UNAVAILABLE)
    expect(inner.calls.length).toBe(1) // zero additional forwarding
  })

  it('a provider that VARIES BETWEEN CALLS is caught: the pinned REAL object is re-verified at EVERY dispatch — a rotated generation refuses IDENTITY_DRIFT with zero forwarding', async () => {
    const inner1 = webInner('team-fetch')
    const inner2 = webInner('team-fetch') // same id, DIFFERENT generation object
    let current: WebInner = inner1
    const seam = S.createG2WebProviderSeam({
      kind: 'fetch',
      providerId: 'team-fetch',
      getRealProvider: () => current,
      declared: { ...FETCH_FACTS },
      readMountFacts: () => ({ ...FETCH_FACTS }),
    })
    await seam.provider.fetch?.({ url: 'https://a.example/x' })
    current = inner2 // the assembly re-registers a new generation underneath
    const err = await asyncError(() => seam.provider.fetch?.({ url: 'https://b.example' }))
    expect(err.code).toBe(SC.IDENTITY_DRIFT)
    expect(inner2.calls.length).toBe(0)
    expect(inner1.calls.length).toBe(1)
  })

  it('the FULL envelope is re-verified live (re-review 2): origin drift ⇒ ENDPOINT_DRIFT; same-origin METHOD drift ⇒ MOUNT_FACTS_DRIFT; immutable config drift ⇒ CONFIG_DRIFT; an origin-only reader ⇒ MOUNT_FACTS_INCOMPLETE — every one with zero forwarding', async () => {
    const inner = webInner('search-pin')
    let live: Record<string, unknown> = { ...SEARCH_FACTS }
    const seam = S.createG2WebProviderSeam({
      kind: 'search',
      providerId: 'search-pin',
      getRealProvider: () => inner,
      declared: { ...SEARCH_FACTS },
      readMountFacts: () => live,
    })
    await seam.provider.search?.({ queries: ['q'] })
    live = { ...SEARCH_FACTS, endpointOrigin: 'https://rotated-search.example' }
    expect((await asyncError(() => seam.provider.search?.({ queries: ['q'] }))).code).toBe(SC.ENDPOINT_DRIFT)
    live = { ...SEARCH_FACTS, method: 'GET' } // SAME origin, different method — origin alone is not enough
    expect((await asyncError(() => seam.provider.search?.({ queries: ['q'] }))).code).toBe(SC.MOUNT_FACTS_DRIFT)
    live = { ...SEARCH_FACTS, configIdentity: 'sha256:cfg-search-ROTATED' }
    expect((await asyncError(() => seam.provider.search?.({ queries: ['q'] }))).code).toBe(SC.CONFIG_DRIFT)
    live = { endpointOrigin: SEARCH_FACTS.endpointOrigin } // origin-only reader
    expect((await asyncError(() => seam.provider.search?.({ queries: ['q'] }))).code).toBe(SC.MOUNT_FACTS_INCOMPLETE)
    expect(inner.calls.length).toBe(1) // none of the drifts forwarded
    expect(seam.stats().driftRejects).toBe(4)
  })

  it('fetch: the destination is captured from the REAL REQUEST PATH; a non-http(s) url refuses typed with zero forwarding; a request rebound mid-flight (getter flips between snapshot and edge) refuses ARGUMENTS_REBIND at the edge', async () => {
    const inner = webInner('fetch-pin')
    const seam = S.createG2WebProviderSeam({
      kind: 'fetch',
      providerId: 'fetch-pin',
      getRealProvider: () => inner,
      declared: { ...FETCH_FACTS },
      readMountFacts: () => ({ ...FETCH_FACTS }),
    })
    await seam.provider.fetch?.({ url: 'https://docs.example/page?x=1' })
    expect(seam.lastDispatch()?.['destinationOrigin']).toBe('https://docs.example') // exact origin, no path, no invention
    const bad = await asyncError(() => seam.provider.fetch?.({ url: 'ftp://nope.example' }))
    expect(bad.code).toBe(SC.DESTINATION_INVALID)
    expect(inner.calls.length).toBe(1)
    let reads = 0
    const rebound: Record<string, unknown> = {}
    Object.defineProperty(rebound, 'url', {
      enumerable: true,
      configurable: true,
      get: () => { reads += 1; return reads === 1 ? 'https://approved.example/p' : 'https://evil.example/p' },
    })
    const err = await asyncError(() => seam.provider.fetch?.(rebound))
    expect(err.code).toBe(SC.ARGUMENTS_REBIND) // frozen snapshot vs live edge digest differ
    expect(inner.calls.length).toBe(1) // the swapped request NEVER reached the provider
  })

  it('Team-scope only — a noTeam install has ZERO seam effect: the import/construction is inert, the raw provider serves the noTeam scope untouched, and only the Team scope routes through the pin', async () => {
    const inner = webInner('search-shared')
    const seam = S.createG2WebProviderSeam({
      kind: 'search',
      providerId: 'search-shared',
      getRealProvider: () => inner,
      declared: { ...SEARCH_FACTS },
      readMountFacts: () => ({ ...SEARCH_FACTS }),
    })
    expect(seam.stats()).toEqual({ dispatchCount: 0, driftRejects: 0 }) // construction alone changed NOTHING
    // host selection law DOUBLE (Map id→provider + configured id, per
    // web/src/index.ts:63-72,:172-190 @639ed01539): two independent scopes.
    const resolve = (registry: Map<string, WebProviderLike>, configuredId: string): WebProviderLike => {
      const p = registry.get(configuredId)
      if (p === undefined) throw new Error('WEB_PROVIDER_CONFIGURED_MISSING')
      if (!p.available()) throw new Error('WEB_PROVIDER_CONFIGURED_UNAVAILABLE')
      return p
    }
    const noTeamScope = new Map<string, WebProviderLike>([[inner.id, inner]])
    const teamScope = new Map<string, WebProviderLike>([[seam.provider.id, seam.provider]])
    const served = await resolve(noTeamScope, 'search-shared').search?.({ queries: ['q'] })
    expect(served).toEqual({ served: 'search' }) // noTeam: the RAW provider serves
    expect(seam.stats()).toEqual({ dispatchCount: 0, driftRejects: 0 }) // seam NEVER entered — zero effect
    expect(noTeamScope.get('search-shared')).toBe(inner) // nothing was swapped globally
    await resolve(teamScope, 'search-shared').search?.({ queries: ['q'] })
    expect(seam.stats().dispatchCount).toBe(1) // only the Team scope routes through the pin
    expect(inner.calls.length).toBe(2) // both scopes ultimately reached the SAME real provider
  })

  it('assembly defects refuse typed: no reader (cannot build), origin-only declared envelope (cannot build), no real provider behind the pin, a double-wrapped pin, an id mismatch, a missing kind', () => {
    const inner = webInner('x-fetch')
    const ok = S.createG2WebProviderSeam({ kind: 'fetch', providerId: 'x-fetch', getRealProvider: () => inner, declared: { ...FETCH_FACTS }, readMountFacts: () => ({ ...FETCH_FACTS }) })
    expect(syncError(() => S.createG2WebProviderSeam({ kind: 'fetch', providerId: 'x', getRealProvider: () => inner, declared: { ...FETCH_FACTS } })).message).toMatch(/readMountFacts is REQUIRED/) // reader omitted ⇒ cannot pass
    expect(syncError(() => S.createG2WebProviderSeam({ kind: 'fetch', providerId: 'x', getRealProvider: () => inner, declared: { endpointOrigin: FETCH_FACTS.endpointOrigin }, readMountFacts: () => ({ ...FETCH_FACTS }) })).message).toMatch(/method, configIdentity/) // origin-only envelope cannot build
    expect(syncError(() => S.createG2WebProviderSeam({ kind: 'fetch', providerId: 'x2', getRealProvider: () => null, declared: { ...FETCH_FACTS }, readMountFacts: () => ({ ...FETCH_FACTS }) })).code).toBe(SC.REAL_PROVIDER_ABSENT)
    expect(syncError(() => S.createG2WebProviderSeam({ kind: 'fetch', providerId: 'x3', getRealProvider: () => ok.provider as unknown as WebInner, declared: { ...FETCH_FACTS }, readMountFacts: () => ({ ...FETCH_FACTS }) })).code).toBe(SC.ALREADY_WRAPPED)
    expect((ok.provider as unknown as Record<symbol, unknown>)[S.G2_SEAM_BRAND]).toBe(true)
    expect(syncError(() => S.createG2WebProviderSeam({ kind: 'fetch', providerId: 'other-id', getRealProvider: () => inner, declared: { ...FETCH_FACTS }, readMountFacts: () => ({ ...FETCH_FACTS }) })).code).toBe(SC.CONFIG_IDENTITY_MISMATCH)
    expect(syncError(() => S.createG2WebProviderSeam({ kind: 'cache', providerId: 'x', getRealProvider: () => inner, declared: { ...FETCH_FACTS }, readMountFacts: () => ({ ...FETCH_FACTS }) })).message).toMatch(/ASSEMBLY_FACTS_MISSING/)
  })
})

/* ── MCP seam ─────────────────────────────────────────────────────── */
describe('a5m2-g2-seams MCP request lease', () => {
  const httpConfig = { serverName: 'remote-api', transport: 'streamable-http', endpointUrl: 'https://mcp.example/mcp' }

  it('request forwarded VERBATIM (request AND exec object identity); generation+client CAPTURED once and re-verified at the execution edge; the missing capture point cannot build and an incomplete capture lets NO call through (no unobserved pass-through)', async () => {
    const inner = mcpInner()
    const client = { liveConnection: 1 }
    let captures = 0
    const seam = S.createG2McpProviderSeam({
      declaredSurfaceConfig: httpConfig,
      getRealProvider: () => inner,
      captureConnection: () => { captures += 1; return { transport: 'streamable-http', endpointOrigin: 'https://mcp.example', generation: 'gen-1', client } },
    })
    const req = { method: 'resources/list' }
    await seam.provider.request(req, EXEC)
    expect(inner.calls.length).toBe(1)
    expect(inner.calls[0]?.['request']).toBe(req)
    expect(inner.calls[0]?.['exec']).toBe(EXEC) // THIS call's ToolExecution, identity kept
    expect(captures).toBe(2) // capture once + execution-edge re-verify — BOTH happen
    const facts = seam.lastDispatch()
    expect(facts?.['capturedAt']).toBe('provider-request-lease')
    expect(facts?.['verifiedAt']).toBe('execution-edge')
    expect(facts?.['connectionIncarnation']).toBe('gen-1')
    expect(facts?.['clientBound']).toBe(true)
    // The "unobserved" pass-through is gone: no capture point ⇒ the seam
    // cannot even build; an incomplete capture ⇒ per-call refusal.
    expect(syncError(() => S.createG2McpProviderSeam({ declaredSurfaceConfig: httpConfig, getRealProvider: () => mcpInner() })).message).toMatch(/captureConnection is REQUIRED/)
    const noGen = S.createG2McpProviderSeam({
      declaredSurfaceConfig: httpConfig,
      getRealProvider: () => inner,
      captureConnection: () => ({ transport: 'streamable-http', endpointOrigin: 'https://mcp.example' }), // generation unobserved
    })
    expect((await asyncError(() => noGen.provider.request({ method: 'resources/list' }, EXEC))).code).toBe(SC.CAPTURE_INCOMPLETE)
    const noClient = S.createG2McpProviderSeam({
      declaredSurfaceConfig: httpConfig,
      getRealProvider: () => inner,
      captureConnection: () => ({ transport: 'streamable-http', endpointOrigin: 'https://mcp.example', generation: 'gen-1' }), // no client object
    })
    expect((await asyncError(() => noClient.provider.request({ method: 'resources/list' }, EXEC))).code).toBe(SC.CAPTURE_INCOMPLETE)
    expect(inner.calls.length).toBe(1) // both incomplete captures refused with zero forwarding
  })

  it('the captured generation+client LOCK the execution: a rotation between capture and the execution edge refuses with zero forwarding; declared-incarnation pins, endpoint re-points, provider swaps, unknown methods and stdio FULL args+cwd drift all refuse', async () => {
    const inner = mcpInner()
    const client = { conn: 'A' }
    let phase = 0
    const rotating = S.createG2McpProviderSeam({
      declaredSurfaceConfig: httpConfig,
      getRealProvider: () => inner,
      captureConnection: () => {
        phase += 1
        // entry capture: gen-1/client A; execution-edge re-capture: rotated ⇒ REFUSED
        return phase === 2
          ? { transport: 'streamable-http', endpointOrigin: 'https://mcp.example', generation: 'gen-2', client: { conn: 'B' } }
          : { transport: 'streamable-http', endpointOrigin: 'https://mcp.example', generation: 'gen-1', client }
      },
    })
    const drift = await asyncError(() => rotating.provider.request({ method: 'resources/read', uri: 'u:1' }, EXEC))
    expect(drift.code).toBe(SC.SURFACE_DRIFT) // RED if the execution-edge re-verify is removed
    expect(inner.calls.length).toBe(0)
    // declared incarnation pin vs live rotation (between calls):
    const pinnedInner = mcpInner()
    let pinnedGen = 'gen-1'
    const pinned = S.createG2McpProviderSeam({
      declaredSurfaceConfig: { ...httpConfig, connectionIncarnation: 'gen-1' },
      getRealProvider: () => pinnedInner,
      captureConnection: () => ({ transport: 'streamable-http', endpointOrigin: 'https://mcp.example', generation: pinnedGen, client }),
    })
    await pinned.provider.request({ method: 'resources/list' }, EXEC)
    pinnedGen = 'gen-2'
    expect((await asyncError(() => pinned.provider.request({ method: 'resources/list' }, EXEC))).code).toBe(SC.SURFACE_DRIFT)
    expect(pinnedInner.calls.length).toBe(1)
    // endpoint re-point under an approved surface:
    const rePointed = S.createG2McpProviderSeam({
      declaredSurfaceConfig: httpConfig,
      getRealProvider: () => inner,
      captureConnection: () => ({ transport: 'streamable-http', endpointOrigin: 'https://evil.example', generation: 'gen-1', client }),
    })
    expect((await asyncError(() => rePointed.provider.request({ method: 'resources/list' }, EXEC))).code).toBe(SC.SURFACE_DRIFT)
    // provider-generation swap:
    const swapInner = mcpInner()
    let current: McpInner = inner
    const swap = S.createG2McpProviderSeam({
      declaredSurfaceConfig: httpConfig,
      getRealProvider: () => current,
      captureConnection: () => ({ transport: 'streamable-http', endpointOrigin: 'https://mcp.example', generation: 'gen-1', client }),
    })
    current = swapInner
    expect((await asyncError(() => swap.provider.request({ method: 'resources/list' }, EXEC))).code).toBe(SC.IDENTITY_DRIFT)
    expect(swapInner.calls.length).toBe(0)
    // unknown method:
    const methodSeam = S.createG2McpProviderSeam({
      declaredSurfaceConfig: httpConfig,
      getRealProvider: () => inner,
      captureConnection: () => ({ transport: 'streamable-http', endpointOrigin: 'https://mcp.example', generation: 'gen-1', client }),
    })
    expect((await asyncError(() => methodSeam.provider.request({ method: 'resources/delete' }, EXEC))).code).toBe(SC.REQUEST_METHOD_UNKNOWN)
    // stdio: FULL args + cwd identity — a one-arg or cwd change is drift.
    const stdioInner = mcpInner()
    const stdioLive: { transport: string, spawn: Record<string, unknown>, generation: string } = {
      transport: 'stdio',
      spawn: { argv0: '/usr/local/bin/svc', args: ['--profile', 'prod'], cwd: '/srv/mcp' },
      generation: 'pid-7',
    }
    const stdioClient = { pid: 7 }
    const stdio = S.createG2McpProviderSeam({
      declaredSurfaceConfig: { serverName: 'local-svc', transport: 'stdio', command: ['/usr/local/bin/svc', '--profile', 'prod'], cwd: '/srv/mcp' },
      getRealProvider: () => stdioInner,
      captureConnection: () => ({ ...stdioLive, client: stdioClient }),
    })
    await stdio.provider.request({ method: 'resources/list' }, EXEC)
    expect((stdio.lastDispatch()?.['spawn'] as Record<string, unknown>)['args']).toEqual(['--profile', 'prod']) // FULL args ride the lease facts
    stdioLive.spawn = { argv0: '/usr/local/bin/svc', args: ['--profile', 'dev'], cwd: '/srv/mcp' }
    expect((await asyncError(() => stdio.provider.request({ method: 'resources/list' }, EXEC))).code).toBe(SC.SURFACE_DRIFT)
    stdioLive.spawn = { argv0: '/usr/local/bin/svc', args: ['--profile', 'prod'], cwd: '/tmp' }
    expect((await asyncError(() => stdio.provider.request({ method: 'resources/list' }, EXEC))).code).toBe(SC.SURFACE_DRIFT)
    expect(stdioInner.calls.length).toBe(1)
  })
})

/* ── BROWSER lease ────────────────────────────────────────────────── */
describe('a5m2-g2-seams BROWSER governed lease', () => {
  interface LeaseDouble { lease: LeaseResult, order: string[], launches: number, closes: number, resources: Array<Record<string, unknown>> }
  function leaseDouble (opts: { decision?: string, failLaunch?: boolean, approvalGate?: Promise<void>, noClose?: boolean, throwingClose?: boolean } = {}): LeaseDouble {
    const order: string[] = []
    const resources: Array<Record<string, unknown>> = []
    let launches = 0
    let closes = 0
    const lease = S.createG2BrowserResourceLease({
      mode: 'launch',
      openResource: async () => {
        launches += 1
        order.push('factory:open')
        if (opts.failLaunch === true && launches === 1) throw new Error('launch exploded')
        const res: Record<string, unknown> = opts.noClose === true
          ? { handle: 'unclosable' }
          : { close: async () => { closes += 1; order.push('factory:close'); if (opts.throwingClose === true) throw new Error('browser refuses to die') } }
        resources.push(res)
        return res
      },
      consumeApproval: async () => {
        order.push('pa:ask')
        if (opts.approvalGate !== undefined) await opts.approvalGate
        order.push(`pa:${opts.decision ?? 'consumed'}`)
        return opts.decision ?? 'consumed'
      },
      launchEnvelope: { modelOrigin: 'https://model.example' },
    })
    return { lease, order, get launches () { return launches }, get closes () { return closes }, resources }
  }

  it('PA-before-launch is STRUCTURAL: the ordered log proves the PA consumption precedes the factory; launch at most once across calls; work receives the resource handle; close exactly once on drain', async () => {
    const d = leaseDouble()
    const seen: unknown[] = []
    await d.lease.run({ toolName: 'stagehand_navigate' }, async (res) => { seen.push(res) })
    await d.lease.run({ toolName: 'stagehand_act' }, async (res) => { seen.push(res) })
    expect(d.order.slice(0, 3)).toEqual(['pa:ask', 'pa:consumed', 'factory:open']) // RED if ordering is removed
    expect(d.launches).toBe(1) // one lifecycle across calls
    expect(seen[0]).toBe(d.resources[0])
    expect(d.resources[0]).toBe(seen[1])
    const snap = await d.lease.drain()
    expect(snap.closeCount).toBe(1)
    expect(snap.state).toBe('closed')
    const log = d.lease.launchOrder()
    expect(log.lastIndexOf('lease:work:settle')).toBeLessThan(log.indexOf('resource:close'))
    expect(log.indexOf('lease:pa:consumed')).toBeLessThan(log.indexOf('lease:launch:launch'))
  })

  it('a PENDING launch counts in the lease the moment it starts (owner entries.set with ready pending, :181): drain() AWAITS it, the late arrival CLOSES ITSELF (:186-197), the caller is refused, CLOSED is terminal — no resurrection', async () => {
    let releaseOpen: (() => void) | undefined
    const gate = new Promise<void>((res) => { releaseOpen = res })
    const order: string[] = []
    const closed: number[] = []
    let handles = 0
    const lease = S.createG2BrowserResourceLease({
      mode: 'launch',
      openResource: async () => {
        await gate // the launch stays PENDING while drain runs
        handles += 1
        order.push('factory:open')
        const mine = handles
        return { close: async () => { closed.push(mine); order.push('factory:close') } }
      },
      consumeApproval: async () => 'consumed',
    })
    const r1 = lease.run({ toolName: 'stagehand_navigate' }, async () => 'never-handed-out')
    await flush()
    expect(lease.state()).toBe('launching') // the pending launch already holds the lease
    const draining = lease.drain()
    await flush()
    expect(lease.state()).toBe('draining') // drain is WAITING on the pending launch, not closing around it
    releaseOpen?.()
    const err = await asyncError(() => r1)
    expect(err.code).toBe(SC.LEASE_CLOSED)
    const snap = await draining // RED if the pending launch is not counted: drain would settle with closeCount 0 and a leaked handle
    expect(snap.state).toBe('closed')
    expect(snap.closeCount).toBe(1) // the late arrival closed ITSELF
    expect(closed).toEqual([1])
    expect(lease.launchOrder()).toContain('resource:late-close')
    expect((await asyncError(() => lease.run({ toolName: 'stagehand_act' }, async () => 'never'))).code).toBe(SC.LEASE_CLOSED)
    expect(handles).toBe(1) // nothing relaunched post-CLOSED
  })

  it('a close() that THROWS is NOT swallowed into "closed": per the owner dispose law (:131-137) drain REJECTS with CLOSE_FAILED, the entry is RETAINED, later runs refuse, and re-draining re-rejects — the lease never reports closed', async () => {
    const d = leaseDouble({ throwingClose: true })
    await d.lease.run({ toolName: 'stagehand_act' }, async () => 'ok')
    const err = await asyncError(() => d.lease.drain())
    expect(err.code).toBe(SC.CLOSE_FAILED)
    expect(d.lease.state()).toBe('close-failed')
    expect((await asyncError(() => d.lease.run({ toolName: 'stagehand_act' }, async () => 'never'))).code).toBe(SC.LEASE_CLOSED) // entry retained, never silently reused
    const again = await asyncError(() => d.lease.drain())
    expect(again.code).toBe(SC.CLOSE_FAILED) // cached rejection (owner disposing ??=)
    expect(d.lease.state()).toBe('close-failed')
    expect(d.lease.launchOrder()).toContain('resource:close-failed')
  })

  it('a RESOLVED handle WITHOUT close() is OPEN_CONTRACT_BREACH (owner OwnedSessionResource requires close, :12-18): the lease never becomes active, drain REJECTS with CLOSE_FAILED, the breach is logged — never a fake closed', async () => {
    const d = leaseDouble({ noClose: true })
    const err = await asyncError(() => d.lease.run({ toolName: 'stagehand_screenshot' }, async () => 'never'))
    expect(err.code).toBe(SC.OPEN_CONTRACT_BREACH)
    expect(d.lease.state()).toBe('close-failed') // retained: the lease cannot close what it cannot call
    const drained = await asyncError(() => d.lease.drain())
    expect(drained.code).toBe(SC.CLOSE_FAILED)
    expect(d.lease.launchOrder()).toContain('lease:open-contract-breach')
    expect((await asyncError(() => d.lease.run({ toolName: 'stagehand_act' }, async () => 'never'))).code).toBe(SC.LEASE_CLOSED)
  })

  it('PA refused or unavailable ⇒ NOTHING launched and NOTHING attached; a later retry is a NEW call that re-consumes the edge', async () => {
    const d = leaseDouble({ decision: 'refused' })
    const err = await asyncError(() => d.lease.run({ toolName: 'stagehand_navigate' }, async () => 'never'))
    expect(err.code).toBe(SC.PA_NOT_CONSUMED)
    expect(d.launches).toBe(0)
    expect(d.order).toEqual(['pa:ask', 'pa:refused']) // no factory entry exists
    expect(d.lease.snapshot().paRefusals).toBe(1)
    const ok = leaseDouble()
    await ok.lease.run({ toolName: 'stagehand_screenshot' }, async () => 'shot')
    expect(ok.launches).toBe(1)
  })

  it('a failed launch leaves NO half-open resource (owner: open() owns rollback, :23-30/:174) and retries only as a new call with a FRESH PA consumption', async () => {
    const d = leaseDouble({ failLaunch: true })
    const err = await asyncError(() => d.lease.run({ toolName: 'stagehand_act' }, async () => 'never'))
    expect(err.code).toBe(SC.LAUNCH_FAILED)
    expect(d.closes).toBe(0) // nothing to close — nothing half-open survived
    await d.lease.run({ toolName: 'stagehand_act' }, async () => 'ok') // second call: new PA (paDecisions 2), retry allowed
    expect(d.lease.snapshot().paDecisions).toBe(2)
    expect(d.launches).toBe(2)
  })

  it('REAL drain for what the lease controls: the in-flight work is AWAITED, not killed; new runs refuse DRAINING while draining and CLOSED after; the resource closes exactly once AFTER the last work settles; the snapshot states the boundary', async () => {
    let release: (() => void) | undefined
    const gate = new Promise<void>((res) => { release = () => { res() } })
    const d = leaseDouble()
    const running = d.lease.run({ toolName: 'stagehand_extract' }, async () => { await gate; return 'settled-truthfully' })
    await flush()
    expect(d.lease.launchOrder()).toContain('lease:work:enter') // the work body is inside
    const draining = d.lease.drain()
    await flush()
    expect((await asyncError(() => d.lease.run({ toolName: 'stagehand_act' }, async () => 'never'))).code).toBe(SC.LEASE_DRAINING)
    release?.()
    expect(await running).toBe('settled-truthfully') // in-flight settles honestly — NOT cleared
    const snap = await draining
    expect(snap.state).toBe('closed')
    expect(snap.closeCount).toBe(1)
    expect(snap.order.lastIndexOf('lease:work:settle')).toBeLessThan(snap.order.indexOf('resource:close'))
    expect((await asyncError(() => d.lease.run({ toolName: 'stagehand_act' }, async () => 'never'))).code).toBe(SC.LEASE_CLOSED)
    const again = await d.lease.drain() // idempotent
    expect(again.state).toBe('closed')
    expect(snap.drainSemantics).toBe(S.A5_G2_LEASE_DRAIN_SEMANTICS)
    expect(snap.drainSemantics).toMatch(/PENDING launch/)
    expect(snap.drainSemantics).toMatch(/never reports closed/)
    expect(String(d.lease.governanceLaw['ordering'])).toMatch(/index\.ts:192-198/) // the pre-effect race it replaces
    expect(String(d.lease.governanceLaw['launchFactory'])).toMatch(/native\.ts:95/)
    expect(String(d.lease.governanceLaw['ownerContract'])).toMatch(/close RETAINS|retains the entry/)
    expect(S.A5_G2_SEAM_NAMED_GAPS.LAUNCH_OWNER).toMatch(/index\.ts:100-113/) // reported gap, not a faked launch owner
  })

  it('drain begun WHILE the PA edge is in flight: the consumed call re-verifies the lease state and does NOT enter a draining/closed lease — still zero launches', async () => {
    let releaseApproval: (() => void) | undefined
    const gate = new Promise<void>((res) => { releaseApproval = res })
    const d = leaseDouble({ approvalGate: gate })
    const entered = d.lease.run({ toolName: 'stagehand_act' }, async () => 'never')
    await flush()
    expect(d.launches).toBe(0) // still at the PA edge — factory unreachable
    await d.lease.drain()
    releaseApproval?.()
    const err = await asyncError(() => entered)
    expect(err.code).toBe(SC.LEASE_CLOSED) // PA was consumed, the lease closed meanwhile — honest refusal
    expect(d.launches).toBe(0)
  })
})

/* ── consumption edge (card 4) ────────────────────────────────────── */
describe('a5m2-g2-seams consumption edge', () => {
  function webFetchRow () {
    const def = nativeDef('web_fetch')
    const rows = A.createG2WebAdapters({ realmId: 'realm-g2', providerId: 'test-assembly', readNative: (name: string) => (name === def.name ? def : undefined) })
    return { row: rows.web_fetch, def }
  }

  it('clean path: the approved plan binds, and the ORIGINAL args OBJECT reaches the native (identity preserved)', async () => {
    const { row, def } = webFetchRow()
    const args = { url: 'https://a.example' }
    const plan = await row.classify(args)
    const out = await S.consumeG2ApprovedPlan({ row, plan, args, exec: EXEC })
    expect(out['ok']).toBe(true)
    expect(def.calls.length).toBe(1)
    expect(def.calls[0]?.['args']).toBe(args) // the same reference, not a copy
  })

  it('swapped args after approval refuse AT THE EDGE with zero native entry; a plan that is not consumable refuses PLAN_UNUSABLE', async () => {
    const { row, def } = webFetchRow()
    const args: { url: string } = { url: 'https://a.example' }
    const plan = await row.classify(args)
    args.url = 'https://evil.example' // rebound between approval and consumption
    const out = await S.consumeG2ApprovedPlan({ row, plan, args, exec: EXEC })
    expect(out['ok']).not.toBe(true)
    expect(out['code']).toBe(SC.ARGS_REBOUND)
    expect(def.calls.length).toBe(0)
    const badPlan = await row.classify({ url: 'not-a-url' }) // a refusal plan
    const out2 = await S.consumeG2ApprovedPlan({ row, plan: badPlan, args: {}, exec: EXEC })
    expect(out2['code']).toBe(SC.PLAN_UNUSABLE)
    expect(def.calls.length).toBe(0)
  })

  it('CURRENT facts that MOVED since approval refuse the edge too (identical args, rotated provider facts ⇒ fresh fingerprint differs); a row state that moved (drained) refuses with its own typed code', async () => {
    const def = nativeDef('web_search')
    let providerNow = 'deepseek-v1'
    const rows = A.createG2WebAdapters({
      realmId: 'realm-g2',
      providerId: 'test-assembly',
      readNative: (name: string) => (name === def.name ? def : undefined),
      searchOrigin: 'https://search.deepseek.example',
      readProviderFacts: () => ({ searchProviderId: providerNow }),
    })
    const args = { queries: ['same question'] }
    const plan = await rows.web_search.classify(args)
    providerNow = 'exa-v2' // the mounted provider generation rotates after approval
    const out = await S.consumeG2ApprovedPlan({ row: rows.web_search, plan, args, exec: EXEC })
    expect(out['ok']).not.toBe(true)
    expect(out['code']).toBe(SC.ARGS_REBOUND) // same args, MOVED facts — the frozen facts bind at the edge
    expect(def.calls.length).toBe(0)
    const { row: row2, def: def2 } = webFetchRow()
    const args2 = { url: 'https://b.example' }
    const plan2 = await row2.classify(args2)
    row2.drain() // the row state moves
    const out2 = await S.consumeG2ApprovedPlan({ row: row2, plan: plan2, args: args2, exec: EXEC })
    expect(out2['code']).toBe(A.A5_G2_TYPED_CODES.DRAINING)
    expect(def2.calls.length).toBe(0)
  })

  it('the binding primitive itself: a deep-frozen snapshot re-verifies equal values and refuses a mutated live value', () => {
    const binding = S.createG2FrozenArgsBinding({ label: 'unit', value: { a: 1, b: ['x', { c: 2 }] } })
    expect(binding.fingerprint).toMatch(/^sha256:[0-9a-f]{64}$/)
    expect(binding.verify({ a: 1, b: ['x', { c: 2 }] }).ok).toBe(true)
    const mutated = { a: 1, b: ['x', { c: 3 }] }
    expect(binding.verify(mutated).ok).toBe(false)
    expect(() => binding.verify(1n)).not.toThrow() // non-cloneable live value ⇒ refusal, not a throw
    expect(binding.verify(1n).ok).toBe(false)
  })
})
