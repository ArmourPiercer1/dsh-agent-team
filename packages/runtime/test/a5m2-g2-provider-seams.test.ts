/**
 * A5M2-G2-PROVIDER-SEAMS — the REAL M0 provider-seam implementations
 * (g2-provider-seams.mjs; ROOT ROUND-2 card + RE-REVIEW 502bc8316 + FINAL
 * NARROW RULING c0e) proven per seam:
 *
 *  - WEB pin (c0e-2): the seam is the Team-registered provider (public faces
 *    web/src/index.ts:103/:114 @639ed01539). METHOD identity is the frozen
 *    JS provider.search/provider.fetch FUNCTION OBJECT plus provider.id,
 *    re-verified immediately before the real call (a rebound method or moved
 *    id ⇒ IDENTITY_DRIFT, zero forwarding); the destination envelope is
 *    endpoint origin + immutable config identity from a REQUIRED live reader
 *    (origin alone cannot pass). Team-scope only — a noTeam install keeps
 *    ZERO seam effect (leg-proven).
 *  - MCP request lease (c0e-3): the runtime's request-time re-selection
 *    picks its OWN client (mcp-resources/src/index.ts:120-125 @639ed01539),
 *    so this OWNED-lane seam executes the generation-specific dispatch ON
 *    THE CAPTURED CLIENT OBJECT itself — never a forwarding re-selection,
 *    never an unobserved pass-through, never a self-proving getter string.
 *    stdio locks FULL args + cwd.
 *  - BROWSER governed lease (c0e-1), owner contract
 *    browser-use-runtime/src/index.ts @639ed01539: PA-before-launch is
 *    structural; a PENDING launch is in-flight from the moment it starts
 *    (:181); a late arrival closes itself (:186-197), and if that late close
 *    FAILS the handle is RETAINED and the SAME drainPromise REJECTS
 *    CLOSE_FAILED (never swallowed into a fake 'closed'); close is REQUIRED
 *    (:12-18); any failed close retains + rejects (:131-137); CLOSED is
 *    terminal.
 *  - TEAM-OWNED LAUNCH OWNER (c0e-4 — shipped, not a gap): createG2Browser
 *    LaunchOwner composes the real sequence (owned process FIRST, runtime
 *    open SECOND — browser-use-stagehand-native index.ts:105-117 pattern,
 *    native faces native.ts:95/:86) with factory-owned half-open rollback
 *    (runtime open fails ⇒ process closed BEFORE rejecting) and
 *    exactly-once retain-on-failure close. The lease's openResource is fed
 *    by this owner (integration leg). RESIDUAL (reported): the HOST's own
 *    lane constructs SessionResources plugin-internally (index.ts:100-113) —
 *    not interposable at this pin; the named gap is explicitly NOT the
 *    deliverable.
 *  - Consumption edge (card 4): consumeG2ApprovedPlan enforces the frozen
 *    actualArgs binding AT the edge; swapped args, rotated classify-time
 *    facts, or a moved row state refuse with zero native entry.
 *
 * Red-on-removal: ordering/capture/drain/rollback legs fail if the module's
 * sequencing is removed (this pass measured: swallowing the late-close
 * failure, forwarding through a re-selection instead of the captured client,
 * and deleting the launch-owner rollback each turn the matching legs RED).
 * Disclosed stand-ins: every provider/lease/native-primitive behind the
 * seams is a TEST-owned double — these legs are NOT C2 and prove no
 * real-Host dimension; the real faces they mirror are cited in the module
 * header. The real Host-validator fixed point (11 registration faces) stays
 * pinned in a5m2-g2-connector-adapters.test.ts; THIS module exposes no tool
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
  pinnedMethod: () => unknown
  registrationLaw: Record<string, unknown>
  lastDispatch: () => SeamFacts | null
  stats: () => { dispatchCount: number, driftRejects: number }
}
interface McpClient { request: (r: unknown, e: unknown) => Promise<unknown>, calls: Array<Record<string, unknown>> }
interface McpSeamResult {
  provider: { request: (r: unknown, e: unknown) => Promise<unknown> }
  serverName: string
  declaredSurface: Record<string, unknown>
  registrationLaw: Record<string, unknown>
  lastDispatch: () => SeamFacts | null
  stats: () => { dispatchCount: number, driftRejects: number }
}
interface OwnedHandle { value: unknown, close: () => Promise<void> }
interface LaunchOwnerResult { open: () => Promise<OwnedHandle>, opens: () => number, order: () => readonly string[], ownerSemantics: string }
interface LeaseSnapshot {
  state: string
  mode: string
  drainSemantics: string
  paDecisions: number
  paRefusals: number
  launchCount: number
  closeCount: number
  retainedUnclosed: number
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
interface MountFacts { endpointOrigin: string, configIdentity: string }

const S = (await import(new URL('../src/plugin/live/governed-families/g2-provider-seams.mjs', import.meta.url).href)) as {
  A5_G2_SEAM_REVISION: number
  A5_G2_SEAM_CODES: Record<
    | 'REAL_PROVIDER_ABSENT' | 'CONFIG_IDENTITY_MISMATCH' | 'ALREADY_WRAPPED' | 'IDENTITY_DRIFT'
    | 'PROVIDER_UNAVAILABLE' | 'ENDPOINT_DRIFT' | 'MOUNT_FACTS_INCOMPLETE'
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
  createG2BrowserLaunchOwner: (d: Record<string, unknown>) => LaunchOwnerResult
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
const SEARCH_FACTS: MountFacts = { endpointOrigin: 'https://search.deepseek.example', configIdentity: 'sha256:cfg-search-a1' }
const FETCH_FACTS: MountFacts = { endpointOrigin: 'https://fetch.deepseek.example', configIdentity: 'sha256:cfg-fetch-b2' }

function mcpSlot (): { generation: string } { return { generation: 'slot-1' } } // the registered slot's provider object
function mcpClient (): McpClient {
  const dbl: McpClient = { calls: [], request: async () => ({}) }
  dbl.request = async (r, e) => { dbl.calls.push({ request: r, exec: e }); return { served: 'captured-client' } }
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
  it('the seam IS the registered provider: verbatim forward through the FROZEN method function; destination envelope (origin+immutable config identity) re-read live every dispatch; per-lease facts from inside the selection stack; availability loss fails the lane CLOSED', async () => {
    const inner = webInner('deepseek-search')
    const seam = S.createG2WebProviderSeam({
      kind: 'search',
      providerId: 'deepseek-search',
      getRealProvider: () => inner,
      declared: { ...SEARCH_FACTS },
      readMountFacts: () => ({ ...SEARCH_FACTS }),
    })
    expect(seam.provider.id).toBe('deepseek-search')
    expect(seam.pinnedMethod()).toBe(inner.search) // method identity = the JS function OBJECT (c0e-2)
    expect(String(seam.registrationLaw['registerVia'])).toMatch(/registerSearchProvider.*index\.ts:103 @639ed01539/)
    expect(String(seam.registrationLaw['law'])).toMatch(/WEB_PROVIDER_CONFIGURED_MISSING/) // the pin fails CLOSED per :63-72,:172-190
    const req = { queries: ['governed search'] }
    await seam.provider.search?.(req)
    expect(inner.calls.length).toBe(1)
    expect(inner.calls[0]?.['request']).toBe(req) // the ORIGINAL object, verbatim
    const facts = seam.lastDispatch()
    expect(facts?.['capturedAt']).toBe('provider-dispatch-lease')
    expect(facts?.['destinationOrigin']).toBe('https://search.deepseek.example')
    expect(facts?.['configIdentity']).toBe('sha256:cfg-search-a1') // immutable config identity rides the lease facts
    expect(seam.stats()).toEqual({ dispatchCount: 1, driftRejects: 0 })
    inner.available = () => false // availability mirrors the REAL provider
    expect(seam.provider.available()).toBe(false)
    const err = await asyncError(() => seam.provider.search?.(req))
    expect(err.code).toBe(SC.PROVIDER_UNAVAILABLE)
    expect(inner.calls.length).toBe(1) // zero additional forwarding
  })

  it('METHOD identity is the frozen JS function + provider.id (c0e-2): a rebound provider.search and a moved provider.id are each caught BEFORE the real call — IDENTITY_DRIFT with zero forwarding; a wholesale provider swap likewise', async () => {
    const inner = webInner('deepseek-search')
    const seam = S.createG2WebProviderSeam({
      kind: 'search',
      providerId: 'deepseek-search',
      getRealProvider: () => inner,
      declared: { ...SEARCH_FACTS },
      readMountFacts: () => ({ ...SEARCH_FACTS }),
    })
    const req = { queries: ['q'] }
    await seam.provider.search?.(req) // the frozen function serves the first call
    expect(inner.calls.length).toBe(1)
    // same OBJECT, same id — but the METHOD FUNCTION is rebound under the pin:
    inner.search = async (r: unknown) => { inner.calls.push({ request: r, hijack: true }); return { hijacked: true } }
    const rebound = await asyncError(() => seam.provider.search?.(req))
    expect(rebound.code).toBe(SC.IDENTITY_DRIFT) // RED if the frozen-function check is removed
    expect(inner.calls.length).toBe(1) // the rebound function NEVER ran
    inner.id = 'renamed-search' // provider.id moves under the pin
    const moved = await asyncError(() => seam.provider.search?.(req))
    expect(moved.code).toBe(SC.IDENTITY_DRIFT)
    expect(inner.calls.length).toBe(1)
    inner.id = 'deepseek-search' // restore so seam3's BIND-time id check passes — only the swap must drift
    const swapped = webInner('deepseek-search')
    let current: WebInner = inner
    const seam3 = S.createG2WebProviderSeam({
      kind: 'search',
      providerId: 'deepseek-search',
      getRealProvider: () => current,
      declared: { ...SEARCH_FACTS },
      readMountFacts: () => ({ ...SEARCH_FACTS }),
    })
    current = swapped
    expect((await asyncError(() => seam3.provider.search?.(req))).code).toBe(SC.IDENTITY_DRIFT)
    expect(swapped.calls.length).toBe(0) // zero forwarding on every generation move
  })

  it('the destination envelope is re-verified live (c0e-2): origin drift ⇒ ENDPOINT_DRIFT; same-origin immutable-config drift ⇒ CONFIG_DRIFT; an origin-only reader ⇒ MOUNT_FACTS_INCOMPLETE — every one with zero forwarding', async () => {
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
    live = { endpointOrigin: 'https://rotated-search.example', configIdentity: SEARCH_FACTS.configIdentity }
    expect((await asyncError(() => seam.provider.search?.({ queries: ['q'] }))).code).toBe(SC.ENDPOINT_DRIFT)
    live = { endpointOrigin: SEARCH_FACTS.endpointOrigin, configIdentity: 'sha256:cfg-search-ROTATED' }
    expect((await asyncError(() => seam.provider.search?.({ queries: ['q'] }))).code).toBe(SC.CONFIG_DRIFT)
    live = { endpointOrigin: SEARCH_FACTS.endpointOrigin } // origin-only reader — never a pass
    expect((await asyncError(() => seam.provider.search?.({ queries: ['q'] }))).code).toBe(SC.MOUNT_FACTS_INCOMPLETE)
    expect(inner.calls.length).toBe(1) // none of the drifts forwarded
    expect(seam.stats().driftRejects).toBe(3)
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
    expect(syncError(() => S.createG2WebProviderSeam({ kind: 'fetch', providerId: 'x', getRealProvider: () => inner, declared: { endpointOrigin: FETCH_FACTS.endpointOrigin }, readMountFacts: () => ({ ...FETCH_FACTS }) })).message).toMatch(/configIdentity/) // origin-only envelope cannot build
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
  const httpCapture = (client: McpClient) => () => ({ transport: 'streamable-http', endpointOrigin: 'https://mcp.example', generation: 'gen-1', client })

  it('execution IS the captured client (c0e-3): request AND exec object identity reach the captured client\'s own request; nothing forwards through a re-selection; generation is captured once and re-verified at the edge; a capture without an executable client lets NO call through; the missing capture point cannot build', async () => {
    const slot = mcpSlot()
    const client = mcpClient()
    let captures = 0
    const seam = S.createG2McpProviderSeam({
      declaredSurfaceConfig: httpConfig,
      getRealProvider: () => slot,
      captureConnection: () => { captures += 1; return { transport: 'streamable-http', endpointOrigin: 'https://mcp.example', generation: 'gen-1', client } },
    })
    const req = { method: 'resources/list' }
    await seam.provider.request(req, EXEC)
    expect(captures).toBe(2) // capture once + execution-edge re-verify
    expect(client.calls.length).toBe(1) // the CAPTURED client executed…
    expect(client.calls[0]?.['request']).toBe(req) // …with the ORIGINAL request…
    expect(client.calls[0]?.['exec']).toBe(EXEC) // …and THIS call's exec, verbatim
    expect(String(seam.lastDispatch()?.['executedOn'])).toBe('captured-client')
    expect(seam.lastDispatch()?.['connectionIncarnation']).toBe('gen-1')
    // A capture that cannot execute is refused per call — no pass-through
    // (stable slot objects: a per-call NEW provider object would itself be
    // an identity drift, which the pin must and does refuse first):
    const slotA = mcpSlot(); const slotB = mcpSlot(); const slotC = mcpSlot()
    const noClient = S.createG2McpProviderSeam({ declaredSurfaceConfig: httpConfig, getRealProvider: () => slotA, captureConnection: () => ({ transport: 'streamable-http', endpointOrigin: 'https://mcp.example', generation: 'gen-1' }) })
    expect((await asyncError(() => noClient.provider.request({ method: 'resources/list' }, EXEC))).code).toBe(SC.CAPTURE_INCOMPLETE)
    const dumbClient = S.createG2McpProviderSeam({ declaredSurfaceConfig: httpConfig, getRealProvider: () => slotB, captureConnection: () => ({ transport: 'streamable-http', endpointOrigin: 'https://mcp.example', generation: 'gen-1', client: { noRequest: true } }) })
    expect((await asyncError(() => dumbClient.provider.request({ method: 'resources/list' }, EXEC))).code).toBe(SC.CAPTURE_INCOMPLETE)
    const noGen = S.createG2McpProviderSeam({ declaredSurfaceConfig: httpConfig, getRealProvider: () => slotC, captureConnection: () => ({ transport: 'streamable-http', endpointOrigin: 'https://mcp.example' }) })
    expect((await asyncError(() => noGen.provider.request({ method: 'resources/list' }, EXEC))).code).toBe(SC.CAPTURE_INCOMPLETE)
    // The missing capture point cannot even build the seam:
    expect(syncError(() => S.createG2McpProviderSeam({ declaredSurfaceConfig: httpConfig, getRealProvider: () => mcpSlot() })).message).toMatch(/captureConnection is REQUIRED/)
  })

  it('a rotation between the capture and the execution edge refuses with zero forwarding (RED if the edge re-verify is removed); generation pins, client swaps, endpoint re-points, slot-object swaps, unknown methods and stdio FULL args+cwd drift all refuse — and each new call executes on ITS OWN captured client', async () => {
    const slot = mcpSlot()
    const clientA = mcpClient()
    const clientB = mcpClient()
    let phase = 0
    const rotating = S.createG2McpProviderSeam({
      declaredSurfaceConfig: httpConfig,
      getRealProvider: () => slot,
      captureConnection: () => {
        phase += 1
        // entry capture: gen-1/client A; execution-edge re-capture: rotated ⇒ REFUSED
        return phase === 2
          ? { transport: 'streamable-http', endpointOrigin: 'https://mcp.example', generation: 'gen-2', client: clientB }
          : { transport: 'streamable-http', endpointOrigin: 'https://mcp.example', generation: 'gen-1', client: clientA }
      },
    })
    const drift = await asyncError(() => rotating.provider.request({ method: 'resources/read', uri: 'u:1' }, EXEC))
    expect(drift.code).toBe(SC.SURFACE_DRIFT)
    expect(clientA.calls.length).toBe(0) // RED if the edge re-verify is removed: the captured client would have executed
    expect(clientB.calls.length).toBe(0)
    // each call executes on ITS OWN captured generation's client:
    let currentClient = clientA
    const perCall = S.createG2McpProviderSeam({
      declaredSurfaceConfig: httpConfig,
      getRealProvider: () => slot,
      captureConnection: () => ({ transport: 'streamable-http', endpointOrigin: 'https://mcp.example', generation: currentClient === clientA ? 'gen-1' : 'gen-2', client: currentClient }),
    })
    await perCall.provider.request({ method: 'resources/list' }, EXEC)
    currentClient = clientB
    await perCall.provider.request({ method: 'resources/list' }, EXEC)
    expect(clientA.calls.length).toBe(1)
    expect(clientB.calls.length).toBe(1) // the SECOND call ran on the client captured for ITS lease
    expect(perCall.lastDispatch()?.['connectionIncarnation']).toBe('gen-2')
    // declared incarnation pin vs live rotation:
    let pinnedGen = 'gen-1'
    const pinned = S.createG2McpProviderSeam({
      declaredSurfaceConfig: { ...httpConfig, connectionIncarnation: 'gen-1' },
      getRealProvider: () => slot,
      captureConnection: () => ({ transport: 'streamable-http', endpointOrigin: 'https://mcp.example', generation: pinnedGen, client: clientA }),
    })
    await pinned.provider.request({ method: 'resources/list' }, EXEC)
    pinnedGen = 'gen-2'
    expect((await asyncError(() => pinned.provider.request({ method: 'resources/list' }, EXEC))).code).toBe(SC.SURFACE_DRIFT)
    // endpoint re-point under an approved surface:
    const rePointed = S.createG2McpProviderSeam({
      declaredSurfaceConfig: httpConfig,
      getRealProvider: () => slot,
      captureConnection: () => ({ transport: 'streamable-http', endpointOrigin: 'https://evil.example', generation: 'gen-1', client: clientA }),
    })
    expect((await asyncError(() => rePointed.provider.request({ method: 'resources/list' }, EXEC))).code).toBe(SC.SURFACE_DRIFT)
    // registered slot-object swap:
    let currentSlot: Record<string, unknown> = slot
    const swapped = S.createG2McpProviderSeam({
      declaredSurfaceConfig: httpConfig,
      getRealProvider: () => currentSlot,
      captureConnection: httpCapture(clientA),
    })
    currentSlot = { generation: 'slot-2' }
    expect((await asyncError(() => swapped.provider.request({ method: 'resources/list' }, EXEC))).code).toBe(SC.IDENTITY_DRIFT)
    // unknown method:
    const methodSeam = S.createG2McpProviderSeam({ declaredSurfaceConfig: httpConfig, getRealProvider: () => slot, captureConnection: httpCapture(clientA) })
    expect((await asyncError(() => methodSeam.provider.request({ method: 'resources/delete' }, EXEC))).code).toBe(SC.REQUEST_METHOD_UNKNOWN)
    // stdio: FULL args + cwd identity — a one-arg or cwd change is drift.
    const stdioClient = mcpClient()
    const stdioLive: { transport: string, spawn: Record<string, unknown>, generation: string } = {
      transport: 'stdio',
      spawn: { argv0: '/usr/local/bin/svc', args: ['--profile', 'prod'], cwd: '/srv/mcp' },
      generation: 'pid-7',
    }
    const stdio = S.createG2McpProviderSeam({
      declaredSurfaceConfig: { serverName: 'local-svc', transport: 'stdio', command: ['/usr/local/bin/svc', '--profile', 'prod'], cwd: '/srv/mcp' },
      getRealProvider: () => slot,
      captureConnection: () => ({ ...stdioLive, client: stdioClient }),
    })
    await stdio.provider.request({ method: 'resources/list' }, EXEC)
    expect(stdioClient.calls.length).toBe(1)
    expect((stdio.lastDispatch()?.['spawn'] as Record<string, unknown>)['args']).toEqual(['--profile', 'prod']) // FULL args ride the lease facts
    stdioLive.spawn = { argv0: '/usr/local/bin/svc', args: ['--profile', 'dev'], cwd: '/srv/mcp' }
    expect((await asyncError(() => stdio.provider.request({ method: 'resources/list' }, EXEC))).code).toBe(SC.SURFACE_DRIFT)
    stdioLive.spawn = { argv0: '/usr/local/bin/svc', args: ['--profile', 'prod'], cwd: '/tmp' }
    expect((await asyncError(() => stdio.provider.request({ method: 'resources/list' }, EXEC))).code).toBe(SC.SURFACE_DRIFT)
    expect(stdioClient.calls.length).toBe(1)
  })
})

/* ── TEAM-OWNED launch owner (c0e-4 — shipped) ────────────────────── */
describe('a5m2-g2-seams TEAM-OWNED launch owner', () => {
  interface OwnerDouble { owner: LaunchOwnerResult, order: string[], launches: number, runtimeOpens: number, procCloses: number, runtimeCloses: number }
  function ownerDouble (opts: { mode?: 'launch' | 'attach', failRuntime?: boolean, failProcClose?: boolean, failRuntimeClose?: boolean, failRollback?: boolean } = {}): OwnerDouble {
    const order: string[] = []
    let launches = 0
    let runtimeOpens = 0
    let procCloses = 0
    let runtimeCloses = 0
    const owner = S.createG2BrowserLaunchOwner({
      mode: opts.mode ?? 'launch',
      launchOwned: async () => {
        launches += 1
        order.push('proc:launch')
        return {
          close: async () => {
            procCloses += 1
            order.push('proc:close')
            if (opts.failRollback === true || opts.failProcClose === true) throw new Error('process refuses to die')
          },
        }
      },
      openRuntime: async () => {
        runtimeOpens += 1
        order.push('runtime:open')
        if (opts.failRuntime === true) throw new Error('CDP connect exploded')
        return {
          close: async () => {
            runtimeCloses += 1
            order.push('runtime:close')
            if (opts.failRuntimeClose === true) throw new Error('worker refuses to die')
          },
        }
      },
    })
    return { owner, order, get launches () { return launches }, get runtimeOpens () { return runtimeOpens }, get procCloses () { return procCloses }, get runtimeCloses () { return runtimeCloses } }
  }

  it('open() composes the REAL sequence (process FIRST, runtime SECOND — host pattern index.ts:105-117) and answers an OwnedSessionResource handle; close() closes runtime THEN process EXACTLY ONCE and is idempotent', async () => {
    const d = ownerDouble()
    const handle = await d.owner.open()
    expect(d.order).toEqual(['proc:launch', 'runtime:open']) // real order, RED if inverted/removed
    expect(typeof handle.close).toBe('function') // close REQUIRED (owner :12-18)
    expect(handle.value).toBeTruthy()
    expect(d.owner.order()).toContain('owner:ready')
    await handle.close()
    expect(d.runtimeCloses).toBe(1)
    expect(d.procCloses).toBe(1)
    expect(d.order.lastIndexOf('runtime:close')).toBeLessThan(d.order.indexOf('proc:close')) // runtime THEN process
    await handle.close() // cached — exactly once (owner entry.closing ??= idiom)
    expect(d.runtimeCloses).toBe(1)
    expect(d.procCloses).toBe(1)
  })

  it('factory-owned HALF-OPEN rollback (owner :23-30; host index.ts:117): a FAILED runtime open closes the already-launched process BEFORE the rejection escapes; nothing half-open survives; attach mode launches nothing', async () => {
    const d = ownerDouble({ failRuntime: true })
    const err = await asyncError(() => d.owner.open())
    expect(err.code).toBe(SC.LAUNCH_FAILED)
    expect(d.launches).toBe(1)
    expect(d.procCloses).toBe(1) // the half-open process was rolled back…
    expect(d.runtimeCloses).toBe(0) // …nothing else existed to close
    expect(d.order).toEqual(['proc:launch', 'runtime:open', 'proc:close']) // close BEFORE the rejection resolves
    expect(d.owner.order()).toEqual(['owner:launch', 'owner:runtime', 'owner:rollback', 'owner:rolled-back'])
    const attach = ownerDouble({ mode: 'attach' })
    const handle = await attach.owner.open()
    expect(handle.value).toBeTruthy()
    expect(attach.launches).toBe(0) // attach owns only the connection (NativeBrowserConfig.mode)
  })

  it('a rollback that ALSO fails RETAINS the process and rejects CLOSE_FAILED with both causes — never silently dropped; a throwing handle.close() REJECTS and RETAINS (owner :131-137), re-close re-rejects, never a fake closed', async () => {
    const rolled = ownerDouble({ failRuntime: true, failRollback: true })
    const err = await asyncError(() => rolled.owner.open())
    expect(err.code).toBe(SC.CLOSE_FAILED)
    expect(err.message).toMatch(/RETAINED/) // the process is not dropped
    expect(err.message).toMatch(/CDP connect exploded/) // BOTH causes ride the refusal
    expect(rolled.owner.order()).toContain('owner:rollback-failed')
    const d = ownerDouble({ failRuntimeClose: true })
    const handle = await d.owner.open()
    const closeErr = await asyncError(() => handle.close())
    expect(closeErr.code).toBe(SC.CLOSE_FAILED)
    const again = await asyncError(() => handle.close())
    expect(again.code).toBe(SC.CLOSE_FAILED) // cached rejection — never a later fake success
    expect(d.owner.order()).toContain('owner:close-failed')
    expect(d.owner.order()).not.toContain('owner:closed')
  })

  it('LEASE × LAUNCH OWNER integration (the Team lane end-to-end): PA refused ⇒ the owner never opens (zero launches); PA consumed ⇒ work runs on the owner handle and drain closes THROUGH the owner (runtime then process)', async () => {
    const d = ownerDouble()
    const lease = S.createG2BrowserResourceLease({
      mode: 'launch',
      openResource: async () => await d.owner.open(),
      consumeApproval: (facts: unknown) => ((facts as Record<string, unknown>)['deny'] === true ? 'refused' : 'consumed'),
    })
    const refused = await asyncError(() => lease.run({ toolName: 'stagehand_navigate', deny: true }, async () => 'never'))
    expect(refused.code).toBe(SC.PA_NOT_CONSUMED)
    expect(d.owner.opens()).toBe(0) // owner never touched — PA edge first
    const seen: unknown[] = []
    await lease.run({ toolName: 'stagehand_navigate' }, async (res) => { seen.push(res); return 'work' })
    expect(d.owner.opens()).toBe(1)
    expect(seen[0]).toBeTruthy() // work received the OWNER'S handle
    const snap = await lease.drain()
    expect(snap.state).toBe('closed')
    expect(d.runtimeCloses).toBe(1) // close flowed THROUGH the owner: runtime then process
    expect(d.procCloses).toBe(1)
    expect(d.order.lastIndexOf('runtime:close')).toBeLessThan(d.order.indexOf('proc:close'))
    expect(lease.launchOrder().indexOf('lease:pa:consumed')).toBeLessThan(lease.launchOrder().indexOf('lease:launch:launch'))
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
    const closed: number[] = []
    let handles = 0
    const lease = S.createG2BrowserResourceLease({
      mode: 'launch',
      openResource: async () => {
        await gate // the launch stays PENDING while drain runs
        handles += 1
        const mine = handles
        return { close: async () => { closed.push(mine) } }
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
    expect(snap.retainedUnclosed).toBe(0)
    expect(closed).toEqual([1])
    expect(lease.launchOrder()).toContain('resource:late-close')
    expect((await asyncError(() => lease.run({ toolName: 'stagehand_act' }, async () => 'never'))).code).toBe(SC.LEASE_CLOSED)
    expect(handles).toBe(1) // nothing relaunched post-CLOSED
  })

  it('c0e-1: a late arrival whose close FAILS is RETAINED and the SAME drainPromise REJECTS CLOSE_FAILED — allSettled does not swallow it into a fake closed, the resource is never dropped, the caller still refuses', async () => {
    let releaseOpen: (() => void) | undefined
    const gate = new Promise<void>((res) => { releaseOpen = res })
    const lease = S.createG2BrowserResourceLease({
      mode: 'launch',
      openResource: async () => {
        await gate // pending while drain runs
        return { close: async () => { throw new Error('late browser refuses to die') } } // its late close FAILS
      },
      consumeApproval: async () => 'consumed',
    })
    const r1 = lease.run({ toolName: 'stagehand_navigate' }, async () => 'never')
    await flush()
    const draining = lease.drain()
    await flush()
    releaseOpen?.()
    expect((await asyncError(() => r1)).code).toBe(SC.LEASE_CLOSED)
    const err = await asyncError(() => draining) // RED if the failure is swallowed: drain would resolve 'closed'
    expect(err.code).toBe(SC.CLOSE_FAILED)
    expect(err.message).toMatch(/RETAINED/)
    expect(lease.state()).toBe('close-failed')
    expect(lease.snapshot().retainedUnclosed).toBe(1) // the late handle is retained, not dropped
    expect(lease.launchOrder()).toContain('resource:late-close-failed')
    expect(lease.launchOrder()).not.toContain('lease:closed') // never a fake closed
    expect((await asyncError(() => lease.run({ toolName: 'stagehand_act' }, async () => 'never'))).code).toBe(SC.LEASE_CLOSED)
  })

  it('a close() that THROWS on the settled resource is NOT swallowed into "closed": per the owner dispose law (:131-137) drain REJECTS with CLOSE_FAILED, the entry is RETAINED, later runs refuse, and re-draining re-rejects', async () => {
    const d = leaseDouble({ throwingClose: true })
    await d.lease.run({ toolName: 'stagehand_act' }, async () => 'ok')
    const err = await asyncError(() => d.lease.drain())
    expect(err.code).toBe(SC.CLOSE_FAILED)
    expect(d.lease.state()).toBe('close-failed')
    expect(d.lease.snapshot().retainedUnclosed).toBe(1)
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
    expect(d.lease.snapshot().retainedUnclosed).toBe(1)
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

  it('a failed launch leaves NO half-open resource (the launch owner owns rollback, :23-30/:174) and retries only as a new call with a FRESH PA consumption', async () => {
    const d = leaseDouble({ failLaunch: true })
    const err = await asyncError(() => d.lease.run({ toolName: 'stagehand_act' }, async () => 'never'))
    expect(err.code).toBe(SC.LAUNCH_FAILED)
    expect(d.closes).toBe(0) // nothing to close — the owner rolled back; nothing half-open survived here
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
    expect(String(d.lease.governanceLaw['launchFactory'])).toMatch(/createG2BrowserLaunchOwner/) // the SHIPPED Team-owned launch owner (c0e-4)
    expect(String(d.lease.governanceLaw['ownerContract'])).toMatch(/late arrival whose close fails/)
    expect(S.A5_G2_SEAM_NAMED_GAPS.LAUNCH_OWNER).toMatch(/index\.ts:100-113/) // RESIDUAL host-lane gap stays reported
    expect(S.A5_G2_SEAM_NAMED_GAPS.LAUNCH_OWNER).toMatch(/SHIPPED in this file/) // but the owner itself ships
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
