/**
 * A5M2-G2-PROVIDER-SEAMS — the REAL M0 provider-seam implementations
 * (g2-provider-seams.mjs, ROOT ROUND-2 card) proven per seam:
 *
 *  - WEB pin (provider level): the seam is the provider the assembly
 *    registers via the PUBLIC ctx.web.registerSearchProvider/
 *    registerFetchProvider faces (web/src/index.ts:103/:114 @639ed01539);
 *    every dispatch re-verifies the pinned REAL provider identity, the
 *    availability mirror, the endpoint envelope / real request-path
 *    destination, and the frozen request binding BEFORE forwarding — and a
 *    provider or endpoint that VARIES BETWEEN CALLS is caught, not served
 *    under a stale pin. Zero forwarding on any drift.
 *  - MCP request lease: the provider's request() runs inside the runtime's
 *    request-time selection (mcp-resources/src/index.ts:80/:120-125
 *    @639ed01539); per-lease facts (THIS call's exec + the owning assembly's
 *    live-connection reader) are captured under that lease and RE-VERIFIED
 *    against the classified surface — generation rotation, endpoint
 *    re-pointing, provider swap and unknown methods all refuse with zero
 *    forwarding; without the live reader the MCP named blocker rides the
 *    facts verbatim (the incarnation is never a factory-config guess).
 *  - BROWSER governed lease: the ordered log proves the PA edge is consumed
 *    BEFORE openResource is ever invoked (launch/attach structurally
 *    unreachable earlier); launch at most once; REAL drain — the lease
 *    awaits every work() it scheduled and closes exactly once after the
 *    last settles; a closed lease never resurrects.
 *  - Consumption edge (card 4): consumeG2ApprovedPlan enforces the frozen
 *    actualArgs binding AT the edge — swapped args after approval, rotated
 *    classify-time facts, and a moved row state all refuse there with zero
 *    native entry, while the clean path hands the ORIGINAL args object on.
 *
 * Disclosed stand-ins: every provider/lease behind the seams is a TEST-owned
 * double — these legs are NOT C2 and prove no real-Host dimension. The real
 * Host-validator fixed point (11 registration faces) stays pinned in
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
interface WebSeamResult {
  provider: { id: string, available: () => boolean, search?: (r: unknown, s?: unknown) => Promise<unknown>, fetch?: (r: unknown, s?: unknown) => Promise<unknown> }
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

const S = (await import(new URL('../src/plugin/live/governed-families/g2-provider-seams.mjs', import.meta.url).href)) as {
  A5_G2_SEAM_REVISION: number
  A5_G2_SEAM_CODES: Record<
    | 'REAL_PROVIDER_ABSENT' | 'CONFIG_IDENTITY_MISMATCH' | 'ALREADY_WRAPPED' | 'IDENTITY_DRIFT'
    | 'PROVIDER_UNAVAILABLE' | 'ENDPOINT_DRIFT' | 'SURFACE_DRIFT' | 'REQUEST_METHOD_UNKNOWN'
    | 'ARGUMENTS_REBIND' | 'DESTINATION_INVALID' | 'ASSEMBLY_FACTS_MISSING' | 'PA_NOT_CONSUMED'
    | 'LEASE_DRAINING' | 'LEASE_CLOSED' | 'LAUNCH_FAILED' | 'ARGS_REBOUND' | 'PLAN_UNUSABLE',
    string
  >
  G2_SEAM_BRAND: symbol
  A5_G2_LEASE_DRAIN_SEMANTICS: string
  createG2FrozenArgsBinding: (d: { label: string, value: unknown }) => { label: string, snapshot: unknown, fingerprint: string, verify: (live: unknown) => { ok: boolean, code?: string, detail?: string } }
  createG2WebProviderSeam: (d: Record<string, unknown>) => WebSeamResult
  createG2McpProviderSeam: (d: Record<string, unknown>) => McpSeamResult
  createG2BrowserResourceLease: (d: Record<string, unknown>) => LeaseResult
  consumeG2ApprovedPlan: (d: { row: RowFace, plan: unknown, args: unknown, exec?: unknown }) => Promise<Record<string, unknown>>
}
const A = (await import(new URL('../src/plugin/live/governed-families/g2-connector-adapters.mjs', import.meta.url).href)) as {
  A5_G2_TYPED_CODES: Record<'DRAINING' | 'INVALID_ARGUMENTS', string>
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
const flush = async (n = 12): Promise<void> => { for (let i = 0; i < n; i += 1) await Promise.resolve() }
const EXEC: Record<string, unknown> = { agent: { id: 'agent-g2-seams' } }

/* ── WEB seam ─────────────────────────────────────────────────────── */
describe('a5m2-g2-seams WEB pin', () => {
  it('the seam IS the registered provider (id + availability mirror): verbatim forward of the ORIGINAL request object; per-lease facts captured inside the selection stack; availability loss fails the lane CLOSED, never substitutes', async () => {
    const inner = webInner('deepseek-search')
    const seam = S.createG2WebProviderSeam({
      kind: 'search',
      providerId: 'deepseek-search',
      getRealProvider: () => inner,
      declaredSearchOrigin: 'https://search.deepseek.example',
    })
    expect(seam.provider.id).toBe('deepseek-search')
    expect(String(seam.registrationLaw['configuredProviderIdMustEqual'])).toBe('deepseek-search')
    expect(String(seam.registrationLaw['registerVia'])).toMatch(/registerSearchProvider.*index\.ts:103 @639ed01539/)
    expect(String(seam.registrationLaw['law'])).toMatch(/WEB_PROVIDER_CONFIGURED_MISSING/) // the pin fails CLOSED per :63-72,:172-190
    const req = { queries: ['governed search'] }
    await seam.provider.search?.(req)
    expect(inner.calls.length).toBe(1)
    expect(inner.calls[0]?.['request']).toBe(req) // the ORIGINAL object, verbatim
    const facts = seam.lastDispatch()
    expect(facts?.['capturedAt']).toBe('provider-dispatch-lease')
    expect(facts?.['destinationOrigin']).toBe('https://search.deepseek.example')
    expect(facts?.['providerId']).toBe('deepseek-search')
    expect(seam.stats()).toEqual({ dispatchCount: 1, driftRejects: 0 })
    // availability mirrors the REAL provider: down ⇒ the lane fails CLOSED
    inner.available = () => false
    expect(seam.provider.available()).toBe(false)
    const err = await asyncError(() => seam.provider.search?.(req))
    expect(err.code).toBe(SC.PROVIDER_UNAVAILABLE)
    expect(inner.calls.length).toBe(1) // zero additional forwarding
    expect(seam.stats().driftRejects).toBe(1)
  })

  it('a provider that VARIES BETWEEN CALLS is caught: the pinned REAL object is re-verified at EVERY dispatch — a rotated generation refuses IDENTITY_DRIFT with zero forwarding', async () => {
    const inner1 = webInner('team-fetch')
    const inner2 = webInner('team-fetch') // same id, DIFFERENT generation object
    let current: WebInner = inner1
    const seam = S.createG2WebProviderSeam({ kind: 'fetch', providerId: 'team-fetch', getRealProvider: () => current })
    await seam.provider.fetch?.({ url: 'https://a.example/x' })
    current = inner2 // the assembly re-registers a new generation underneath
    const err = await asyncError(() => seam.provider.fetch?.({ url: 'https://b.example' }))
    expect(err.code).toBe(SC.IDENTITY_DRIFT)
    expect(inner2.calls.length).toBe(0) // the new generation was never entered
    expect(inner1.calls.length).toBe(1)
  })

  it('a search endpoint that VARIES BETWEEN CALLS is caught: the CURRENT endpoint fact must equal the pinned envelope — ENDPOINT_DRIFT, zero forwarding', async () => {
    const inner = webInner('search-pin')
    let endpoint = 'https://search.deepseek.example'
    const seam = S.createG2WebProviderSeam({
      kind: 'search',
      providerId: 'search-pin',
      getRealProvider: () => inner,
      declaredSearchOrigin: 'https://search.deepseek.example',
      getSearchEndpointOrigin: () => endpoint,
    })
    await seam.provider.search?.({ queries: ['q'] })
    endpoint = 'https://rotated-search.example'
    const err = await asyncError(() => seam.provider.search?.({ queries: ['q'] }))
    expect(err.code).toBe(SC.ENDPOINT_DRIFT)
    expect(inner.calls.length).toBe(1)
  })

  it('fetch: the destination is captured from the REAL REQUEST PATH; a non-http(s) url refuses typed with zero forwarding; a request rebound mid-flight (getter flips the value between the snapshot and the edge) refuses ARGUMENTS_REBIND at the edge', async () => {
    const inner = webInner('fetch-pin')
    const seam = S.createG2WebProviderSeam({ kind: 'fetch', providerId: 'fetch-pin', getRealProvider: () => inner })
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

  it('assembly defects refuse typed: no real provider behind the pin, a double-wrapped pin, an id that is not the REAL provider\'s own id, a missing kind', () => {
    const inner = webInner('x-fetch')
    const seam = S.createG2WebProviderSeam({ kind: 'fetch', providerId: 'x-fetch', getRealProvider: () => inner })
    expect(syncError(() => S.createG2WebProviderSeam({ kind: 'fetch', providerId: 'x2', getRealProvider: () => null })).code).toBe(SC.REAL_PROVIDER_ABSENT)
    expect(syncError(() => S.createG2WebProviderSeam({ kind: 'fetch', providerId: 'x3', getRealProvider: () => seam.provider as unknown as WebInner })).code).toBe(SC.ALREADY_WRAPPED) // the brand marker blocks double-pinning
    expect((seam.provider as unknown as Record<symbol, unknown>)[S.G2_SEAM_BRAND]).toBe(true)
    expect(syncError(() => S.createG2WebProviderSeam({ kind: 'fetch', providerId: 'other-id', getRealProvider: () => inner })).code).toBe(SC.CONFIG_IDENTITY_MISMATCH)
    expect(syncError(() => S.createG2WebProviderSeam({ kind: 'cache', providerId: 'x', getRealProvider: () => inner })).message).toMatch(/ASSEMBLY_FACTS_MISSING/)
  })
})

/* ── MCP seam ─────────────────────────────────────────────────────── */
describe('a5m2-g2-seams MCP request lease', () => {
  const httpConfig = { serverName: 'remote-api', transport: 'streamable-http', endpointUrl: 'https://mcp.example/mcp' }

  it('request forwarded VERBATIM (request AND exec object identity) with facts captured under the provider-request-lease; without the live-connection reader the incarnation is honestly unobserved and the MCP named blocker rides the facts verbatim', async () => {
    const inner = mcpInner()
    const seam = S.createG2McpProviderSeam({ declaredSurfaceConfig: httpConfig, getRealProvider: () => inner })
    expect(seam.serverName).toBe('remote-api')
    expect(String(seam.registrationLaw['registerVia'])).toMatch(/register\(server, provider\).*mcp-resources\/src\/index\.ts:80 @639ed01539/)
    const req = { method: 'resources/list' }
    await seam.provider.request(req, EXEC)
    expect(inner.calls.length).toBe(1)
    expect(inner.calls[0]?.['request']).toBe(req)
    expect(inner.calls[0]?.['exec']).toBe(EXEC) // THIS call's ToolExecution, identity kept
    const facts = seam.lastDispatch()
    expect(facts?.['capturedAt']).toBe('provider-request-lease')
    expect(facts?.['connectionIncarnation']).toBe('unobserved')
    expect(facts?.['connectionIncarnationReason']).toBe(A.A5_G2_NAMED_BLOCKERS.MCP)
    expect(facts?.['execObserved']).toBe(true)
    expect(String(seam.registrationLaw['law'])).toMatch(/REQUEST time/)
  })

  it('facts that VARY BETWEEN CALLS are caught under the lease: live-generation rotation, endpoint re-pointing, provider swap and an unknown method each refuse with zero forwarding; the stdio spawn identity is re-verified the same way', async () => {
    const inner = mcpInner()
    const live = { transport: 'streamable-http', endpointOrigin: 'https://mcp.example', incarnation: 'gen-1' }
    const seam = S.createG2McpProviderSeam({
      declaredSurfaceConfig: { ...httpConfig, connectionIncarnation: 'gen-1' },
      getRealProvider: () => inner,
      getLiveConnection: () => ({ ...live }),
    })
    await seam.provider.request({ method: 'resources/read', uri: 'u:1' }, EXEC)
    expect(seam.lastDispatch()?.['connectionIncarnation']).toBe('gen-1')
    live.incarnation = 'gen-2' // the connection reconnects underneath the approval
    const drift = await asyncError(() => seam.provider.request({ method: 'resources/read', uri: 'u:1' }, EXEC))
    expect(drift.code).toBe(SC.SURFACE_DRIFT)
    expect(inner.calls.length).toBe(1)
    live.incarnation = 'gen-1'
    live.endpointOrigin = 'https://evil.example'
    const rePoint = await asyncError(() => seam.provider.request({ method: 'resources/list' }, EXEC))
    expect(rePoint.code).toBe(SC.SURFACE_DRIFT)
    const swapInner = mcpInner()
    let current: McpInner = inner
    const swap = S.createG2McpProviderSeam({ declaredSurfaceConfig: httpConfig, getRealProvider: () => current })
    current = swapInner
    expect((await asyncError(() => swap.provider.request({ method: 'resources/list' }, EXEC))).code).toBe(SC.IDENTITY_DRIFT)
    expect(swapInner.calls.length).toBe(0)
    const bad = S.createG2McpProviderSeam({ declaredSurfaceConfig: httpConfig, getRealProvider: () => mcpInner() })
    expect((await asyncError(() => bad.provider.request({ method: 'resources/delete' }, EXEC))).code).toBe(SC.REQUEST_METHOD_UNKNOWN)
    const stdioLive = { transport: 'stdio', spawn: { argv0: '/usr/local/bin/svc' }, incarnation: 'pid-7' }
    const stdioInner = mcpInner()
    const stdio = S.createG2McpProviderSeam({
      declaredSurfaceConfig: { serverName: 'local-svc', transport: 'stdio', command: ['/usr/local/bin/svc'] },
      getRealProvider: () => stdioInner,
      getLiveConnection: () => ({ ...stdioLive }),
    })
    await stdio.provider.request({ method: 'resources/list' }, EXEC)
    expect(stdio.lastDispatch()?.['spawnArgv0']).toBe('/usr/local/bin/svc')
    stdioLive.spawn = { argv0: '/tmp/evil-svc' }
    expect((await asyncError(() => stdio.provider.request({ method: 'resources/list' }, EXEC))).code).toBe(SC.SURFACE_DRIFT)
    expect(stdioInner.calls.length).toBe(1)
  })
})

/* ── BROWSER lease ────────────────────────────────────────────────── */
describe('a5m2-g2-seams BROWSER governed lease', () => {
  interface LeaseDouble { lease: LeaseResult, order: string[], launches: number, closes: number, resources: Array<Record<string, unknown>> }
  function leaseDouble (opts: { decision?: string, failLaunch?: boolean, approvalGate?: Promise<void> } = {}): LeaseDouble {
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
        const res: Record<string, unknown> = {
          close: async () => { closes += 1; order.push('factory:close') },
        }
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
    expect(d.order.slice(0, 3)).toEqual(['pa:ask', 'pa:consumed', 'factory:open']) // PA edge BEFORE openResource — proven by order
    expect(d.launches).toBe(1) // one lifecycle across calls
    expect(d.resources.length).toBe(1)
    expect(seen[0]).toBe(d.resources[0])
    expect(d.resources[0]).toBe(seen[1])
    const snap = await d.lease.drain()
    expect(snap.closeCount).toBe(1)
    expect(d.closes).toBe(1)
    expect(d.order[d.order.length - 1]).toBe('factory:close')
    const log = d.lease.launchOrder()
    // every work the lease scheduled settled BEFORE the lease closed anything:
    expect(log.lastIndexOf('lease:work:settle')).toBeLessThan(log.indexOf('resource:close'))
    expect(log.at(-1)).toBe('lease:closed')
    // and the lease's own ordering law is visible on its log: PA before launch
    expect(log.indexOf('lease:pa:consumed')).toBeLessThan(log.indexOf('lease:launch:launch'))
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

  it('a failed launch leaves NO half-open resource and retries only as a new call with a FRESH PA consumption', async () => {
    const d = leaseDouble({ failLaunch: true })
    const err = await asyncError(() => d.lease.run({ toolName: 'stagehand_act' }, async () => 'never'))
    expect(err.code).toBe(SC.LAUNCH_FAILED)
    expect(d.closes).toBe(0) // nothing to close — nothing half-open survived
    await d.lease.run({ toolName: 'stagehand_act' }, async () => 'ok') // second call: new PA (paDecisions 2), retry allowed
    expect(d.lease.snapshot().paDecisions).toBe(2)
    expect(d.launches).toBe(2)
  })

  it('REAL drain for what the lease controls: the in-flight work (which the lease itself scheduled) is AWAITED, not killed; new runs refuse DRAINING while draining and CLOSED after; the resource closes exactly once AFTER the last work settles; the snapshot states the boundary', async () => {
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
    const closeIdx = snap.order.indexOf('resource:close')
    expect(snap.order.lastIndexOf('lease:work:settle')).toBeLessThan(closeIdx) // close AFTER the last settle
    expect((await asyncError(() => d.lease.run({ toolName: 'stagehand_act' }, async () => 'never'))).code).toBe(SC.LEASE_CLOSED)
    const again = await d.lease.drain() // idempotent
    expect(again.state).toBe('closed')
    expect(snap.drainSemantics).toBe(S.A5_G2_LEASE_DRAIN_SEMANTICS)
    expect(snap.drainSemantics).toMatch(/AWAITED/)
    expect(snap.drainSemantics).toMatch(/never kills the inside/)
    expect(String(d.lease.governanceLaw['ordering'])).toMatch(/index\.ts:192-198/) // the pre-effect race it replaces
    expect(String(d.lease.governanceLaw['launchFactory'])).toMatch(/native\.ts:95/)
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
