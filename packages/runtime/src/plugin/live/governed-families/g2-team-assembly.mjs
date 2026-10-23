/**
 * A5M2-G2-TEAM-ASSEMBLY — the two REAL Team assembly ports on the fixed Host
 * `639ed01539` PUBLIC entries (ruling 15:07: implement now, no new
 * architecture, no further wrapper layers). Consumes the reviewed seams
 * (g2-provider-seams.mjs) as-is; writes no shared face.
 *
 * PORT 1 — BROWSER. `createG2TeamBrowserPort` wires the pinned PUBLIC faces
 * exactly where the host uses them (experimental/browser-use-stagehand-native
 * src/index.ts:105-106 endpoint flow, via the package's public `./src/*`
 * exports): `launchChromium` (src/launch.ts:24 → real OwnedChromium
 * { endpoint, close() } that kills the owned process tree and removes the
 * profile) supplies the owned process, and `openNativeBrowser`
 * (src/native.ts:95 → NativeBrowserRuntime.close() :86) is opened on the
 * REAL endpoint reported by that exact process (launch mode) or on the
 * configured cdpEndpoint (attach mode). Acquisition/rollback/close law is the
 * reviewed createG2BrowserLaunchOwner (clean rollback stays recoverable;
 * retained failure holds + poisons); admission is the reviewed governed lease
 * (PA-before-open, drain, no fake closed — index.ts:186-197 race replaced).
 * PRE-EFFECT EXCLUSION: the host plugin's SessionResources admission path is
 * plugin-internal; this port never re-enters a second admission around it —
 * exactly ONE owner/lease exists per port, and the module never touches the
 * host browser runtime package (leg-proven).
 *
 * PORT 2 — MCP. `createG2TeamMcpPort` is the same-source Team-owned
 * connection: THIS port constructs the real SDK Client
 * (@modelcontextprotocol/client 2.0.0, the exact package the host's own
 * connection imports at connection.ts:18; constructor pattern connection.ts:258)
 * per generation and connects it over a config-supplied transport factory.
 * captureConnection therefore answers the generation, the client object and
 * the timeout that THIS port built from the SAME approved config — no capture
 * point exists on the host's own connection (recorded gap; not requested).
 * Registration goes through the PUBLIC scope-layered face
 * `mcpResources.register(server, provider)` shape
 * (mcp/mcp-resources/src/index.ts:47,:85-107 — the same face the host
 * mcp-client plugin uses, server-context.ts:29-31); scope close runs the real
 * close: register-dispose first, in-flight requests drained, then
 * client.close() — and capture afterwards refuses (no dispatch post-close).
 * No credentials are created or escalated; endpoints/commands/timeouts pass
 * through from the supplied approved config only; nothing global — no
 * security or network configuration is touched.
 *
 * WEB (ruled): FORBIDDEN routes are (a) flipping the global configured
 * provider id / DSH_WEB_SEARCH_PROVIDER|DSH_WEB_FETCH_PROVIDER env
 * (web/web/src/index.ts:92-93) and (b) a new per-realm composition as a
 * bypass. The Team-only route is a tool-level fork at the Team tool plane
 * that calls the seam-pinned provider/factory DIRECTLY — the host `ctx.web`
 * selection path re-resolves globally and may NOT be used for Team routing.
 * The precise gap is exported below.
 *
 * STATUS: UNWIRED (wiring = CENTER via the shared bindings/plane, which this
 * module never writes). Test doubles prove wiring, not real browsers or real
 * MCP servers: NOT C2. Windows dimensions: NOT_RUN_WINDOWS_UNAUTHORIZED.
 *
 * @module @dsh-agent-team/runtime/plugin/live/governed-families/g2-team-assembly
 */
import { pathToFileURL } from 'node:url'

import { classifyG2McpSurface } from './g2-connector-adapters.mjs'
import {
  A5_G2_SEAM_CODES,
  G2SeamError,
  createG2BrowserLaunchOwner,
  createG2BrowserResourceLease,
  createG2McpProviderSeam,
} from './g2-provider-seams.mjs'

export const A5_G2_ASSEMBLY_REVISION = 1

/** Typed refusals owned by the assembly layer (P_G2_ASM_ prefixed). */
export const A5_G2_ASSEMBLY_CODES = Object.freeze({
  ENTRY_INCOMPLETE: 'P_G2_ASM_ENTRY_INCOMPLETE',
  CONFIG_INCOMPLETE: 'P_G2_ASM_CONFIG_INCOMPLETE',
  SCOPE_CLOSED: 'P_G2_ASM_SCOPE_CLOSED',
  ALREADY_REGISTERED: 'P_G2_ASM_ALREADY_REGISTERED',
  FACE_INCOMPLETE: 'P_G2_ASM_FACE_INCOMPLETE',
})

/** The precise WEB gap this module reports instead of faking a route. */
export const A5_G2_WEB_ROUTE_GAP = Object.freeze({
  decision: '15:07 — global configured provider id / env switch and per-realm composition BYPASSES are FORBIDDEN; Team routes at the tool plane with a direct fork.',
  publicFaces: 'ctx.web.registerSearchProvider/registerFetchProvider exist (web/web/src/index.ts:103/:114) and return real disposers, but selection reads a COMPOSITION-GLOBAL configured id (:92-93,:173-190) — a Team fork may NOT ride that selector (it re-resolves globally).',
  gap: 'CORE_SEAM_BLOCKER (recorded, not requested): no upstream per-realm provider-selection seam exists at 639ed01539. Until one lands, the Team-only tool-level fork must call the seam-pinned provider object directly from the Team tool-plane rows and never via ctx.web re-selection.',
})

/* ------------------------------------------------------------------ */
/* Real entry supply — dynamic imports of the pinned PUBLIC entries.    */
/* ------------------------------------------------------------------ */

/**
 * Load the REAL Team-lane entries from explicit pinned paths (file URLs or
 * absolute paths). CENTER wires the path values; a spec proves they load at
 * the pin. Entry absence or a non-function export refuses typed — nothing
 * partial ever reaches a port.
 *
 * @param deps {{ launchEntry: string, nativeEntry: string, sdkClientEntry?: string }}
 */
export async function loadG2TeamAssemblyEntries ({ launchEntry, nativeEntry, sdkClientEntry } = {}) {
  if (typeof launchEntry !== 'string' || typeof nativeEntry !== 'string') {
    throw new G2SeamError(A5_G2_ASSEMBLY_CODES.ENTRY_INCOMPLETE, 'launchEntry/nativeEntry paths are REQUIRED — Team lanes import the pinned public faces (browser-use-stagehand-native package "exports" map includes "./src/*"), never hand-rolled lookalikes')
  }
  const toUrl = (p) => p.startsWith('file://') ? p : pathToFileURL(p).href
  let launchMod
  let nativeMod
  try {
    launchMod = await import(toUrl(launchEntry))
    nativeMod = await import(toUrl(nativeEntry))
  } catch (error) {
    throw new G2SeamError(A5_G2_ASSEMBLY_CODES.ENTRY_INCOMPLETE, `the pinned public entries failed to load (${String(error?.message ?? error).slice(0, 200)}) — the assembly refuses to run on substitutes`)
  }
  if (typeof launchMod.launchChromium !== 'function' || typeof nativeMod.openNativeBrowser !== 'function') {
    throw new G2SeamError(A5_G2_ASSEMBLY_CODES.ENTRY_INCOMPLETE, 'launchChromium (src/launch.ts:24) and openNativeBrowser (src/native.ts:95) must be functions of the loaded pinned modules — got otherwise')
  }
  let Client
  if (sdkClientEntry !== undefined) {
    let sdkMod
    try {
      sdkMod = await import(toUrl(sdkClientEntry))
    } catch (error) {
      throw new G2SeamError(A5_G2_ASSEMBLY_CODES.ENTRY_INCOMPLETE, `the pinned SDK client entry failed to load (${String(error?.message ?? error).slice(0, 200)})`)
    }
    Client = sdkMod.Client
    if (typeof Client !== 'function') {
      throw new G2SeamError(A5_G2_ASSEMBLY_CODES.ENTRY_INCOMPLETE, '@modelcontextprotocol/client must answer a constructible Client class — the Team connection must be the REAL SDK generation, not a stand-in')
    }
  }
  return Object.freeze({ launchChromium: launchMod.launchChromium, openNativeBrowser: nativeMod.openNativeBrowser, ...(Client === undefined ? {} : { Client }) })
}

/* ------------------------------------------------------------------ */
/* PORT 1 — Team browser port (public faces + reviewed owner/lease).    */
/* ------------------------------------------------------------------ */

/**
 * @param deps {{
 *   mode: 'launch'|'attach',
 *   nativeConfig: object,                    // approved NativeBrowserConfig fields (model/headless/timeouts/…; cdpEndpoint REQUIRED for attach) — passed through ONLY, never invented
 *   entries: { launchChromium: Function, openNativeBrowser: Function },
 *   consumeApproval: (facts) => unknown,     // the Team PA edge (plane-owned)
 *   launchEnvelope?: object,
 *   observe?: (event) => void
 * }}
 */
export function createG2TeamBrowserPort ({ mode, nativeConfig, entries, consumeApproval, launchEnvelope, observe = () => {} } = {}) {
  if (mode !== 'launch' && mode !== 'attach') {
    throw new TypeError(`${A5_G2_ASSEMBLY_CODES.CONFIG_INCOMPLETE}: mode must be 'launch' or 'attach' (NativeBrowserConfig.mode @639ed01539)`)
  }
  if (nativeConfig === null || typeof nativeConfig !== 'object') {
    throw new TypeError(`${A5_G2_ASSEMBLY_CODES.CONFIG_INCOMPLETE}: nativeConfig must be the approved config object — the port invents no browser settings, no endpoints, no credentials`)
  }
  if (entries === null || typeof entries !== 'object' || typeof entries.launchChromium !== 'function' || typeof entries.openNativeBrowser !== 'function') {
    throw new TypeError(`${A5_G2_ASSEMBLY_CODES.ENTRY_INCOMPLETE}: entries.launchChromium and entries.openNativeBrowser are REQUIRED — the pinned public faces (src/launch.ts:24 / src/native.ts:95 via the package "./src/*" export), never lookalikes`)
  }
  if (mode === 'attach' && typeof nativeConfig.cdpEndpoint !== 'string') {
    throw new G2SeamError(A5_G2_ASSEMBLY_CODES.CONFIG_INCOMPLETE, `attach mode needs the configured cdpEndpoint string from the approved config (host validates it at plugin config time) — the port will not invent or discover an endpoint`)
  }
  const scope = new globalThis['AbortController']() // node global via the repo's established access pattern (web-gateway-assembly.mjs:142)
  const calls = { launchChromium: 0, openNativeBrowser: 0, runtimeConfigChecks: 0 }
  const owner = createG2BrowserLaunchOwner({
    mode,
    ...(mode === 'launch' ? {
      launchOwned: async () => {
        calls.launchChromium += 1
        return await entries.launchChromium(nativeConfig, scope.signal) // real signal: aborts BEFORE ownership transfers (launch.ts contract)
      },
    } : {}),
    openRuntime: async (owned) => {
      calls.openNativeBrowser += 1
      // The host's own endpoint flow (src/index.ts:105-106): the runtime is
      // opened against the endpoint reported by THIS process in launch mode;
      // attach mode opens the configured endpoint directly. Public face only.
      const connectConfig = mode === 'launch'
        ? { ...nativeConfig, mode: 'attach', cdpEndpoint: owned.endpoint }
        : nativeConfig
      if (typeof connectConfig.cdpEndpoint !== 'string') {
        throw new G2SeamError(A5_G2_ASSEMBLY_CODES.CONFIG_INCOMPLETE, 'launchChromium answered no string endpoint on the OwnedChromium — refusing to open a runtime against nothing')
      }
      calls.runtimeConfigChecks += 1
      return await entries.openNativeBrowser(connectConfig)
    },
    observe,
  })
  const lease = createG2BrowserResourceLease({
    mode,
    openResource: async () => await owner.open(),
    consumeApproval,
    ...(launchEnvelope === undefined ? {} : { launchEnvelope }),
    observe,
  })
  let closing = null
  return Object.freeze({
    run: lease.run,
    state: lease.state,
    snapshot: lease.snapshot,
    stats: () => Object.freeze({ ...calls, opens: owner.opens(), retained: owner.retained().length, poisoned: owner.poisoned() }),
    /** Scope dispose: interrupt any still-pending acquisition, then drain the lease (terminal). */
    close: () => {
      if (closing !== null) return closing
      closing = (async () => {
        scope.abort(new Error('team browser scope closed')) // real abort of a pending launch (launch.ts signal contract)
        return await lease.drain() // full close law: awaited work, exactly-once close, retained-failure boundary
      })()
      return closing
    },
    assemblyLaws: Object.freeze({
      entryFlow: 'launchChromium(nativeConfig, scopeSignal) → real OwnedChromium{endpoint, close()} → openNativeBrowser({...nativeConfig, mode:"attach", cdpEndpoint:<that process\'s endpoint>}) — host endpoint flow (src/index.ts:105-106) through the package\'s public faces only (launch.ts:24, native.ts:95 @639ed01539)',
      preEffect: 'EXCLUDED — the host plugin\'s SessionResources admission is never re-entered by this port: exactly one owner + one lease per port, no second admission around the host runtime, this module imports no host browser runtime package',
      cleanup: 'half-open rollback, retain+poison, PA-before-open, drain terminality all come from the reviewed owner/lease — this port adds wiring, never new lifecycle law',
    }),
  })
}

/* ------------------------------------------------------------------ */
/* PORT 2 — Team-owned MCP connection (same-source capture) + register. */
/* ------------------------------------------------------------------ */

/**
 * @param deps {{
 *   declaredSurfaceConfig: object,           // the APPROVED surface config (classifyG2McpSurface shape)
 *   resourceServerName: string,              // Team-only server name (slot the host plugins do not own)
 *   entries: { Client: Function },           // the real @modelcontextprotocol/client 2.0.0 class
 *   makeTransport: () => object,             // transport factory for the SAME approved config (command/url pass-through)
 *   toolCallTimeoutMs: number,               // the original approved timeout CONFIG (connection.ts:370 counterpart) — REQUIRED, never defaulted here
 *   consumeNothing?: undefined,              // (no PA here — resources are read-only operations under the plane)
 *   observe?: (event) => void
 * }}
 */
export function createG2TeamMcpPort ({ declaredSurfaceConfig, resourceServerName, entries, makeTransport, toolCallTimeoutMs, observe = () => {} } = {}) {
  if (typeof resourceServerName !== 'string' || resourceServerName.length === 0) {
    throw new TypeError(`${A5_G2_ASSEMBLY_CODES.CONFIG_INCOMPLETE}: resourceServerName is REQUIRED — a Team-only server name; the port never takes over a host-owned server slot`)
  }
  if (entries === null || typeof entries !== 'object' || typeof entries.Client !== 'function') {
    throw new TypeError(`${A5_G2_ASSEMBLY_CODES.ENTRY_INCOMPLETE}: entries.Client must be the real @modelcontextprotocol/client class — the captured generation has to BE the SDK object the Team lane constructed, not a stand-in`)
  }
  if (typeof makeTransport !== 'function') {
    throw new TypeError(`${A5_G2_ASSEMBLY_CODES.CONFIG_INCOMPLETE}: makeTransport is REQUIRED — built by the Team assembly from the SAME approved config (stdio command/cwd or http endpoint pass-through); no endpoint is invented, no credential is minted or escalated`)
  }
  if (typeof toolCallTimeoutMs !== 'number' || !(toolCallTimeoutMs > 0)) {
    throw new TypeError(`${A5_G2_ASSEMBLY_CODES.CONFIG_INCOMPLETE}: toolCallTimeoutMs must be the positive approved CONFIG value (connection.ts:370 counterpart) — the port never defaults a timeout it cannot name as config`)
  }
  const declared = classifyG2McpSurface(declaredSurfaceConfig)
  if (declared.serverName !== resourceServerName) {
    throw new G2SeamError(A5_G2_ASSEMBLY_CODES.CONFIG_INCOMPLETE, `approved config server "${declared.serverName}" does not equal the registered Team server "${resourceServerName}" — same-source means SAME name at both ends, no cross-mount`)
  }
  const liveSpawn = declared.transport === 'stdio'
    ? Object.freeze({ argv0: declaredSurfaceConfig.command[0], args: Object.freeze([...declaredSurfaceConfig.command.slice(1)]), cwd: typeof declaredSurfaceConfig.cwd === 'string' ? declaredSurfaceConfig.cwd : '' })
    : null
  const liveEndpoint = declared.transport === 'streamable-http' ? declared.endpointOrigin : null

  let generation = 0
  let client = null
  let disposed = false
  let registerDispose = null
  let closing = null
  const inflight = new Set()
  const transportStates = []

  /** Connect (or reconnect) one REAL SDK generation; old generation truly closes. */
  const reconnect = async () => {
    if (disposed) throw new G2SeamError(A5_G2_ASSEMBLY_CODES.SCOPE_CLOSED, 'the Team MCP scope is CLOSED — no generation is built over a disposed scope')
    const next = new entries.Client(
      { name: `dsh-agent-team-g2-${resourceServerName}`, version: '0.0.1' },
      { capabilities: {}, versionNegotiation: { mode: 'auto' } }, // host constructor pattern (connection.ts:258-261 @639ed01539)
    )
    const transport = makeTransport()
    const state = { closed: false }
    transportStates.push(state)
    const realClose = transport.close.bind(transport)
    transport.close = async () => { state.closed = true; return await realClose() }
    const previous = client
    await next.connect(transport)
    if (disposed) { // scope closed while connecting — nothing survives
      await next.close().catch(() => {})
      throw new G2SeamError(A5_G2_ASSEMBLY_CODES.SCOPE_CLOSED, 'the Team MCP scope closed while a generation was connecting — the half-open client was closed, nothing survives')
    }
    next.onclose = () => { if (client === next) client = null }
    client = next
    generation += 1
    if (previous !== null) await previous.close().catch(() => {}) // the rotated generation REALLY closes
    observe({ event: 'generation-up', server: resourceServerName, generation })
    return next
  }

  /** The SAME-SOURCE capture the reviewed seam executes on. */
  const captureConnection = () => {
    if (disposed || client === null) {
      throw new G2SeamError(A5_G2_SEAM_CODES.CAPTURE_INCOMPLETE, `no live Team-owned generation for "${resourceServerName}" (scope closed or generation down) — dispatch is refused, never attempted against a dead client`)
    }
    return {
      transport: declared.transport,
      ...(liveEndpoint !== null ? { endpointOrigin: liveEndpoint } : {}),
      ...(liveSpawn !== null ? { spawn: liveSpawn } : {}),
      generation: `gen-${generation}`,
      timeout: toolCallTimeoutMs, // the ORIGINAL approved config value (seam preserves it into options)
      client, // the very object THIS port constructed for the CURRENT generation
    }
  }

  // The registered slot object (port-owned identity): the seam pins it, so a
  // re-registration or scope teardown invalidating it is caught as drift.
  const slotGuard = Object.freeze({ teamServer: resourceServerName })
  const seam = createG2McpProviderSeam({ declaredSurfaceConfig, getRealProvider: () => slotGuard, captureConnection, observe })

  /** Provider-facing request with in-flight tracking (drain-on-close truth). */
  const request = async (req, exec) => {
    if (disposed) throw new G2SeamError(A5_G2_ASSEMBLY_CODES.SCOPE_CLOSED, `the Team MCP scope "${resourceServerName}" is closed — the registered provider serves nothing after scope close`)
    const pending = seam.provider.request(req, exec)
    inflight.add(pending)
    try {
      return await pending
    } finally {
      inflight.delete(pending)
    }
  }

  /**
   * Register through the PUBLIC scope-layered face — `mcpResources.register(
   * server, provider)` shape (mcp-resources/src/index.ts:85-107 @639ed01539,
   * the same face server-context.ts:29-31 uses). CENTER passes the value it
   * obtained via ctx.inject(['mcpResources']); this port never reaches for
   * it and never touches global state.
   */
  const register = (mcpResourcesFace) => {
    if (disposed) throw new G2SeamError(A5_G2_ASSEMBLY_CODES.SCOPE_CLOSED, 'the Team MCP scope is closed — nothing registers into a dead scope')
    if (mcpResourcesFace === null || typeof mcpResourcesFace !== 'object' || typeof mcpResourcesFace.register !== 'function') {
      throw new G2SeamError(A5_G2_ASSEMBLY_CODES.FACE_INCOMPLETE, 'the mcpResources face must carry register(server, provider) — the PUBLIC McpResourceRuntime registration shape; the port registers through no other channel')
    }
    if (registerDispose !== null) throw new G2SeamError(A5_G2_ASSEMBLY_CODES.ALREADY_REGISTERED, `server "${resourceServerName}" is already registered by this port — one slot, one registration`)
    registerDispose = mcpResourcesFace.register(resourceServerName, Object.freeze({ request }))
    if (typeof registerDispose !== 'function') {
      throw new G2SeamError(A5_G2_ASSEMBLY_CODES.FACE_INCOMPLETE, 'mcpResources.register must return its disposer — scope teardown needs the REAL unregister handle')
    }
    observe({ event: 'registered', server: resourceServerName })
    return registerDispose
  }

  /** Scope close: unregister first (no new entry), drain in-flight, then the REAL client.close(). */
  const close = () => {
    if (closing !== null) return closing
    closing = (async () => {
      disposed = true
      const errors = []
      if (registerDispose !== null) {
        try { await registerDispose() } catch (error) { errors.push(`unregister: ${String(error?.message ?? error).slice(0, 120)}`) }
      }
      await Promise.allSettled([...inflight]) // drain: every dispatched request settles before the client dies
      const dying = client
      client = null
      if (dying !== null) {
        try { await dying.close() } catch (error) { errors.push(`client.close: ${String(error?.message ?? error).slice(0, 120)}`) }
      }
      if (errors.length > 0) {
        throw new G2SeamError(A5_G2_SEAM_CODES.CLOSE_FAILED, `Team MCP scope close FAILED (${errors.join(' | ')}) — never reported clean`)
      }
      observe({ event: 'scope-closed', server: resourceServerName })
    })()
    return closing
  }

  return Object.freeze({
    request,
    provider: Object.freeze({ request }),
    register,
    reconnect,
    close,
    captureConnection,
    stats: () => Object.freeze({
      server: resourceServerName,
      generation: generation === 0 ? null : `gen-${generation}`,
      connected: client !== null,
      disposed,
      inflight: inflight.size,
      transportsClosed: transportStates.filter((s) => s.closed).length,
      transportsBuilt: transportStates.length,
      dispatch: seam.stats(),
      lastDispatch: seam.lastDispatch(),
    }),
    assemblyLaws: Object.freeze({
      sameOrigin: 'the captured {generation, client, timeout} are built BY THIS PORT from the SAME approved config — new Client per generation (SDK 2.0.0, connection.ts:18/258 pattern), timeout = the original approved config value; the host connection exposes no capture point at this pin (recorded gap, not requested)',
      registration: 'PUBLIC scope-layered mcpResources.register(server, provider) face only (mcp-resources/src/index.ts:85-107 @639ed01539), Team-only server name, disposer honored; never a global re-selection, never a host-owned slot',
      credentialPolicy: 'no credentials created, escalated or transformed; endpoints/commands/cwd/timeouts pass through from the approved config; no global security or network configuration is read or written',
      scopeClose: 'unregister → drain in-flight → REAL client.close() (transport teardown follows); capture afterwards refuses CAPTURE_INCOMPLETE — no post-close dispatch',
    }),
  })
}
