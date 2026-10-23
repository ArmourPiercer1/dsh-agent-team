/**
 * A5M2-G2-TEAM-ASSEMBLY — the two REAL Team assembly ports on the fixed Host
 * `639ed01539` PUBLIC entries (ruling 15:07 implement; lifecycle round 2 per
 * the assembly review of 6f9aec9782: no new architecture, no further wrapper
 * layers, the reviewed seam components stay closed and are only consumed).
 *
 * PORT 1 — BROWSER. `createG2TeamBrowserPort` wires the pinned PUBLIC faces
 * exactly where the host uses them (experimental/browser-use-stagehand-native
 * src/index.ts:105-117): `launchChromium` (src/launch.ts:24 → real
 * OwnedChromium { endpoint, close() }) supplies the owned process, and the
 * runtime opens through the PUBLIC WORKER entry `openBrowserWorker`
 * (src/worker-client.ts:15 — the entry the host's own wiring uses), NOT
 * through openNativeBrowser directly: the worker entry cancels acquisition on
 * the connection signal (abort mid-`ready` really terminates the Worker —
 * worker-client.ts:56-68), a failed Worker init (including the internal
 * connect→Stagehand.create) terminates instead of leaking a half-open CDP
 * connection (:58-69), and execute(method, args, operationSignal) honors the
 * operation signal by closing the connection on abort (:71-87) — cancellation
 * and half-open law the direct native entry lacks (native.ts execute ignores
 * the signal). A closed runtime is NOT silently reopened (host's lazy
 * reopen is its SessionResources lane; a Team retry is a new lease
 * acquisition). launch mode attaches the runtime to the endpoint reported by
 * THIS process; attach mode opens the configured endpoint and closes ONLY the
 * runtime — with no owned Chromium there is nothing to fake-clean.
 * Acquisition/rollback law is the reviewed createG2BrowserLaunchOwner;
 * admission is the reviewed governed lease (PA-before-open, drain, no fake
 * closed). PRE-EFFECT EXCLUSION: the host plugin's SessionResources admission
 * is never re-entered — exactly one owner/lease per port; this module imports
 * no host browser runtime package (leg-proven).
 *
 * PORT 2 — MCP. `createG2TeamMcpPort` is the same-source Team-owned
 * connection with SERIAL lifecycle: every connect/rotate/close runs through
 * ONE serial chain, so a pending connect is counted by close (close joins
 * the chain and then really closes every connecting/rotating generation),
 * concurrent reconnects cannot overwrite-and-leak a client, and a FAILED
 * connect rolls its own half-open generation closed while the current
 * generation (if any) stays live and owning nothing half-open. Close failures
 * are OWNED, never swallowed: a rotated-out generation that refuses to close
 * is retained (real reference), reported as CLOSE_FAILED at the rotation and
 * re-attempted/reported by close(), and `transport closed` is marked only
 * AFTER the real close succeeded (never early-true). The transport is built
 * by the port FROM the approved config: the factory receives only the
 * config-derived frozen target (full endpointUrl / spawn argv0+args+cwd) —
 * same-source by construction, no side-channel endpoint. Registration binds
 * the SCOPE: `mcpResources.register(server, provider)` runs against the face
 * instance passed at register (the Team scope-layered McpResourceRuntime the
 * host plugins also use, mcp-resources/src/index.ts:85-107), the disposer is
 * captured from THAT face and close() runs exactly that binding — isolation
 * is per face binding, not by server name (two scopes, same server name,
 * independent registrations). captureConnection answers the generation,
 * client object and timeout THIS port built (@modelcontextprotocol/client
 * 2.0.0, connection.ts:18/258 pattern; the host connection exposes no
 * capture point — recorded gap). No credentials created or escalated;
 * endpoints/commands/timeouts pass through the approved config only; nothing
 * global is read or written.
 *
 * WEB (ruled): FORBIDDEN routes are (a) flipping the global configured
 * provider id / DSH_WEB_SEARCH_PROVIDER|DSH_WEB_FETCH_PROVIDER env
 * (web/web/src/index.ts:92-93) and (b) a new per-realm composition as a
 * bypass. The Team-only route is a tool-level fork at the Team tool plane
 * calling the seam-pinned provider/factory DIRECTLY, never ctx.web
 * re-selection. The precise gap is exported below.
 *
 * STATUS: UNWIRED (wiring = CENTER via the shared bindings/plane, never
 * written here; the e78 wire branch a5m2-wire-g2 mounts plane/glue only and
 * must not duplicate these functions). Test doubles beyond the loaded real
 * modules prove wiring, not real browsers/servers: NOT C2. Windows:
 * NOT_RUN_WINDOWS_UNAUTHORIZED.
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

export const A5_G2_ASSEMBLY_REVISION = 3

/** Typed refusals owned by the assembly layer (P_G2_ASM_ prefixed). */
export const A5_G2_ASSEMBLY_CODES = Object.freeze({
  ENTRY_INCOMPLETE: 'P_G2_ASM_ENTRY_INCOMPLETE',
  CONFIG_INCOMPLETE: 'P_G2_ASM_CONFIG_INCOMPLETE',
  SCOPE_CLOSED: 'P_G2_ASM_SCOPE_CLOSED',
  ALREADY_REGISTERED: 'P_G2_ASM_ALREADY_REGISTERED',
  FACE_INCOMPLETE: 'P_G2_ASM_FACE_INCOMPLETE',
  CONNECT_FAILED: 'P_G2_ASM_MCP_CONNECT_FAILED',
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
 * partial ever reaches a port. The runtime entry is the PUBLIC WORKER entry
 * (src/worker-client.ts:15), the one the host's own wiring uses.
 *
 * @param deps {{ launchEntry: string, workerEntry: string, sdkClientEntry?: string }}
 */
export async function loadG2TeamAssemblyEntries ({ launchEntry, workerEntry, sdkClientEntry } = {}) {
  if (typeof launchEntry !== 'string' || typeof workerEntry !== 'string') {
    throw new G2SeamError(A5_G2_ASSEMBLY_CODES.ENTRY_INCOMPLETE, 'launchEntry/workerEntry paths are REQUIRED — Team lanes import the pinned public faces (browser-use-stagehand-native package "exports" map includes "./src/*": src/launch.ts + src/worker-client.ts), never hand-rolled lookalikes and never the host plugin internals')
  }
  const toUrl = (p) => p.startsWith('file://') ? p : pathToFileURL(p).href
  let launchMod
  let workerMod
  try {
    launchMod = await import(toUrl(launchEntry))
    workerMod = await import(toUrl(workerEntry))
  } catch (error) {
    throw new G2SeamError(A5_G2_ASSEMBLY_CODES.ENTRY_INCOMPLETE, `the pinned public entries failed to load (${String(error?.message ?? error).slice(0, 200)}) — the assembly refuses to run on substitutes`)
  }
  if (typeof launchMod.launchChromium !== 'function' || typeof workerMod.openBrowserWorker !== 'function') {
    throw new G2SeamError(A5_G2_ASSEMBLY_CODES.ENTRY_INCOMPLETE, 'launchChromium (src/launch.ts:24) and openBrowserWorker (src/worker-client.ts:15 — the host-used runtime entry with real acquisition cancel + failed-init terminate + operation-signal close) must be functions of the loaded pinned modules')
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
  return Object.freeze({ launchChromium: launchMod.launchChromium, openBrowserWorker: workerMod.openBrowserWorker, ...(Client === undefined ? {} : { Client }) })
}

/* ------------------------------------------------------------------ */
/* PORT 1 — Team browser port (worker entry + reviewed owner/lease).    */
/* ------------------------------------------------------------------ */

/**
 * @param deps {{
 *   mode: 'launch'|'attach',
 *   nativeConfig: object,                    // approved NativeBrowserConfig fields — passed through ONLY, never invented; cdpEndpoint REQUIRED for attach
 *   entries: { launchChromium: Function, openBrowserWorker: Function },
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
  if (entries === null || typeof entries !== 'object' || typeof entries.launchChromium !== 'function' || typeof entries.openBrowserWorker !== 'function') {
    throw new TypeError(`${A5_G2_ASSEMBLY_CODES.ENTRY_INCOMPLETE}: entries.launchChromium (src/launch.ts:24) and entries.openBrowserWorker (src/worker-client.ts:15) are REQUIRED — the host-used public faces; openNativeBrowser-direct is REJECTED (its execute ignores the operation signal and its internal connect→Stagehand.create failure has no cleanup; worker-client.ts owns both)`)
  }
  if (mode === 'attach' && typeof nativeConfig.cdpEndpoint !== 'string') {
    throw new G2SeamError(A5_G2_ASSEMBLY_CODES.CONFIG_INCOMPLETE, `attach mode needs the configured cdpEndpoint string from the approved config (host validates it at plugin config time) — the port will not invent or discover an endpoint`)
  }
  const scope = new globalThis['AbortController']() // node global via the repo's established access pattern (web-gateway-assembly.mjs:142)
  const calls = { launchChromium: 0, openBrowserWorker: 0, workerWarns: 0 }
  const owner = createG2BrowserLaunchOwner({
    mode,
    ...(mode === 'launch' ? {
      launchOwned: async () => {
        calls.launchChromium += 1
        return await entries.launchChromium(nativeConfig, scope.signal) // real signal: aborts BEFORE ownership transfers (launch.ts contract)
      },
    } : {}),
    openRuntime: async (owned) => {
      calls.openBrowserWorker += 1
      // The host's own endpoint flow (src/index.ts:105-110): launch mode
      // attaches the Worker runtime to the endpoint THIS process reported;
      // attach mode opens the configured endpoint. The worker entry carries
      // the real acquisition cancel (abort mid-ready terminates the Worker).
      const connectConfig = mode === 'launch'
        ? { ...nativeConfig, mode: 'attach', cdpEndpoint: owned.endpoint }
        : nativeConfig
      if (typeof connectConfig.cdpEndpoint !== 'string') {
        throw new G2SeamError(A5_G2_ASSEMBLY_CODES.CONFIG_INCOMPLETE, 'launchChromium answered no string endpoint on the OwnedChromium — refusing to open a runtime against nothing')
      }
      return await entries.openBrowserWorker(connectConfig, scope.signal, (message) => {
        calls.workerWarns += 1 // worker-client warn lane: SDK cleanup failure after termination → observe, never swallowed silently
        observe({ event: 'worker-warn', message: String(message) })
      })
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
    /** Scope dispose: cancel any pending acquisition for REAL (worker terminates), then drain the lease (terminal). */
    close: () => {
      if (closing !== null) return closing
      closing = (async () => {
        scope.abort(new Error('team browser scope closed')) // real abort: mid-ready acquisition terminates (worker-client.ts:56-68), a pending launch rejects per the launch.ts signal law
        return await lease.drain() // full close law: awaited work, exactly-once close, retained-failure boundary
      })()
      return closing
    },
    assemblyLaws: Object.freeze({
      entryFlow: 'launchChromium(nativeConfig, scopeSignal) → real OwnedChromium{endpoint, close()} → openBrowserWorker({...nativeConfig, mode:"attach", cdpEndpoint:<that process\'s endpoint>}, scopeSignal, warn) — host endpoint flow (src/index.ts:105-117) through the package\'s public faces (launch.ts:24, worker-client.ts:15 @639ed01539)',
      cancellation: 'acquisition: scope.signal abort mid-ready really terminates the Worker (worker-client.ts:56-68); operation: execute(method, args, operationSignal) abort CLOSES the connection (worker-client.ts:75-76) and a closed runtime is NEVER silently reopened — a Team retry is a new lease acquisition',
      halfOpen: 'failed Worker init (including the internal connect→Stagehand.create) terminates inside the entry; the reviewed owner then rolls back the owned process before rejecting; attach mode has NO owned process and its close is runtime-only — nothing is faked',
      preEffect: 'EXCLUDED — the host plugin\'s SessionResources admission is never re-entered by this port: exactly one owner + one lease per port, and this module imports no host browser runtime package',
    }),
  })
}

/* ------------------------------------------------------------------ */
/* PORT 2 — Team-owned MCP connection: serial, owned-failure lifecycle. */
/* ------------------------------------------------------------------ */

/**
 * @param deps {{
 *   declaredSurfaceConfig: object,           // the APPROVED surface config (classifyG2McpSurface)
 *   resourceServerName: string,              // Team-only server name
 *   entries: { Client: Function },           // the real @modelcontextprotocol/client 2.0.0 class
 *   makeTransport: (target) => object,       // factory receiving ONLY the frozen config-derived target {server, transport, endpointUrl?|spawn?}
 *   toolCallTimeoutMs: number,               // the original approved timeout CONFIG — REQUIRED, never defaulted here
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
    throw new TypeError(`${A5_G2_ASSEMBLY_CODES.CONFIG_INCOMPLETE}: makeTransport is REQUIRED — it receives ONLY the frozen target this port derives from the approved config (full endpointUrl or spawn argv0/args/cwd); no endpoint is invented, no credential is minted or escalated`)
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
  const liveEndpoint = typeof declaredSurfaceConfig.endpointUrl === 'string' ? declaredSurfaceConfig.endpointUrl : null
  /** The frozen SAME-SOURCE transport target: the ONLY thing a transport may be built from. */
  const transportTarget = Object.freeze({
    server: resourceServerName,
    transport: declared.transport,
    ...(liveEndpoint !== null ? { endpointUrl: liveEndpoint } : {}),
    ...(liveSpawn !== null ? { spawn: liveSpawn } : {}),
  })
  const liveEndpointOrigin = declared.transport === 'streamable-http' ? declared.endpointOrigin : null

  let generation = 0
  let client = null
  let disposed = false
  let registration = null // { face, dispose } — the SCOPE binding, captured at register
  let closing = null
  /** ONE serial chain: connects, rotations and close never interleave. */
  let chain = Promise.resolve()
  const inflight = new Set()
  const transportStates = [] // { closed (set only AFTER a real close succeeded), closeError }
  /** Generations connecting OR being rotated out — close() really closes every one. */
  const pendingGenerations = new Set()
  /** Real references whose close FAILED — owned, re-attempted at close, never swallowed. */
  const retainedGenerations = new Set()
  /** gen(client) → its transport state — close truth is measured at the REAL
   * transport wrapper: pin-verified, the SDK swallows transport.close failures
   * on the failed-connect path and later client.close() calls no-op there, so
   * a resolving client.close() is NOT proof the transport really closed. */
  const generationStates = new Map()
  const closeFailures = []

  const settleGenerationClose = async (gen, label, state = null) => {
    let clientCloseFailed = false
    try {
      await gen.close()
    } catch (error) {
      clientCloseFailed = true
      closeFailures.push(`${label}: ${String(error?.message ?? error).slice(0, 120)}`)
    }
    if (state !== null && state.closed !== true) {
      // a resolving client.close() over a transport that never really closed is a FAILURE here (SDK swallow law at this pin)
      if (!clientCloseFailed) closeFailures.push(`${label}: transport did not reach a real close (${String(state.closeError?.message ?? 'close never succeeded').slice(0, 120)})`)
      return false
    }
    return !clientCloseFailed
  }

  const buildTransport = () => {
    const transport = makeTransport(transportTarget) // config-derived target ONLY — same-source by construction
    if (transport === null || typeof transport !== 'object' || typeof transport.start !== 'function' || typeof transport.send !== 'function' || typeof transport.close !== 'function') {
      throw new G2SeamError(A5_G2_ASSEMBLY_CODES.FACE_INCOMPLETE, `makeTransport must return a Transport object (start/send/close) built from the frozen approved-config target it received (server ${transportTarget.server}, transport ${transportTarget.transport}) — got otherwise`)
    }
    const state = { closed: false, closeError: null }
    transportStates.push(state)
    const realClose = transport.close.bind(transport)
    transport.close = async () => {
      try {
        await realClose()
        state.closed = true // "closed" marks only AFTER the real close succeeded — never early-true
      } catch (error) {
        state.closeError = error
        throw error
      }
    }
    return { transport, state }
  }

  /** Connect (or rotate to) one REAL SDK generation — serialized with everything else. */
  const reconnect = () => {
    const step = chain.then(async () => {
      if (disposed) throw new G2SeamError(A5_G2_ASSEMBLY_CODES.SCOPE_CLOSED, 'the Team MCP scope is CLOSED — no generation is built over a disposed scope')
      const next = new entries.Client(
        { name: `dsh-agent-team-g2-${resourceServerName}`, version: '0.0.1' },
        { capabilities: {}, versionNegotiation: { mode: 'auto' } }, // host constructor pattern (connection.ts:258-261 @639ed01539)
      )
      const { transport, state: tsState } = buildTransport()
      generationStates.set(next, tsState) // close truth for THIS generation is measured on its real transport
      pendingGenerations.add(next)
      try {
        await next.connect(transport)
      } catch (cause) {
        // A failed connect owns its cleanup: the half-open generation REALLY
        // closes; the CURRENT generation (if any) stays live and untouched.
        const rolled = await settleGenerationClose(next, 'connect-rollback-close', tsState)
        pendingGenerations.delete(next)
        if (!rolled) retainedGenerations.add(next) // a half-open the rollback could NOT close keeps PERSISTENT real ownership — close() re-attempts it; never reduced to an error string
        throw new G2SeamError(A5_G2_ASSEMBLY_CODES.CONNECT_FAILED, `Team MCP generation connect failed (${String(cause?.message ?? cause).slice(0, 140)}) — rollback close ${rolled ? 'succeeded; the current generation (if any) stays live, nothing half-open survives' : 'FAILED — the half-open reference is RETAINED (real ownership in stats.retainedGenerations; close() re-attempts and reports it, never swallowed)'}`)
      }
      if (disposed) { // scope closed (queued behind us) while connecting — nothing survives
        pendingGenerations.delete(next)
        const raced = await settleGenerationClose(next, 'scope-race-close', tsState)
        if (!raced) retainedGenerations.add(next) // same persistent ownership law on the close-race path
        throw new G2SeamError(A5_G2_ASSEMBLY_CODES.SCOPE_CLOSED, 'the Team MCP scope closed while this generation was connecting — the connecting client was really closed')
      }
      next.onclose = () => { if (client === next) client = null }
      const previous = client
      client = next
      generation += 1
      pendingGenerations.delete(next)
      if (previous !== null) {
        pendingGenerations.add(previous)
        const closedOk = await settleGenerationClose(previous, 'rotated-generation-close', generationStates.get(previous) ?? null)
        pendingGenerations.delete(previous)
        if (!closedOk) {
          retainedGenerations.add(previous) // REAL reference held persistently — close() re-attempts and reports
          throw new G2SeamError(A5_G2_SEAM_CODES.CLOSE_FAILED, `generation rotated to gen-${generation}, but the PREVIOUS generation refused to close — it is RETAINED (real reference; close() re-attempts and reports; the port never claims it closed). Failure: ${closeFailures[closeFailures.length - 1] ?? 'unknown'}`)
        }
      }
      observe({ event: 'generation-up', server: resourceServerName, generation })
      return next
    })
    chain = step.then(() => {}, () => {}) // the chain survives failures; each CALLER still sees its own rejection
    return step
  }

  /** The SAME-SOURCE capture the reviewed seam executes on. */
  const captureConnection = () => {
    if (disposed || client === null) {
      throw new G2SeamError(A5_G2_SEAM_CODES.CAPTURE_INCOMPLETE, `no live Team-owned generation for "${resourceServerName}" (scope closed or generation down) — dispatch is refused, never attempted against a dead client`)
    }
    return {
      transport: declared.transport,
      ...(liveEndpointOrigin !== null ? { endpointOrigin: liveEndpointOrigin } : {}),
      ...(liveSpawn !== null ? { spawn: liveSpawn } : {}),
      generation: `gen-${generation}`,
      timeout: toolCallTimeoutMs, // the ORIGINAL approved config value (seam preserves it into options)
      client, // the very object THIS port constructed for the CURRENT generation
    }
  }

  // The registered slot object (port-owned identity): the seam pins it, so a
  // scope teardown invalidating it is caught as drift.
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
   * Register into the PASSED SCOPE's face: the public scope-layered
   * `mcpResources.register(server, provider)` face (mcp-resources/src/
   * index.ts:85-107 @639ed01539 — what ctx.inject(['mcpResources']) answers
   * inside the Team scope, cf. server-context.ts:29-31). The disposer is
   * bound to THAT face instance — isolation is the face binding, not the
   * server name (two scopes may host the same server name independently).
   */
  const register = (mcpResourcesFace) => {
    if (disposed) throw new G2SeamError(A5_G2_ASSEMBLY_CODES.SCOPE_CLOSED, 'the Team MCP scope is closed — nothing registers into a dead scope')
    if (mcpResourcesFace === null || typeof mcpResourcesFace !== 'object' || typeof mcpResourcesFace.register !== 'function') {
      throw new G2SeamError(A5_G2_ASSEMBLY_CODES.FACE_INCOMPLETE, 'the mcpResources face must carry register(server, provider) — the PUBLIC scope-layered McpResourceRuntime registration of the TEAM SCOPE; the port registers through no other channel and never resolves a face globally')
    }
    if (registration !== null) throw new G2SeamError(A5_G2_ASSEMBLY_CODES.ALREADY_REGISTERED, 'this port already holds its registration in its bound scope face — one port, one scope registration')
    const dispose = mcpResourcesFace.register(resourceServerName, Object.freeze({ request }))
    if (typeof dispose !== 'function') {
      throw new G2SeamError(A5_G2_ASSEMBLY_CODES.FACE_INCOMPLETE, 'mcpResources.register must return its disposer — scope teardown needs the REAL unregister handle from THIS face; the port refuses to hold an undismissable registration')
    }
    registration = Object.freeze({ face: mcpResourcesFace, dispose })
    observe({ event: 'registered', server: resourceServerName })
    return dispose
  }

  /**
   * Scope close. The ADMISSION CUTOFF is SYNCHRONOUS AT ENTRY: requests,
   * registrations and captures refuse immediately, and the BOUND scope face is
   * unregistered NOW — not after a pending connect happens to settle. The
   * teardown itself JOINS the serial chain (a pending connect settles first
   * and is then really closed): drain in-flight, then close the current +
   * every pending/retained generation. Anything that will not close KEEPS
   * real ownership in retainedGenerations — ownership is reduced only on a
   * close SUCCESS; owned failures re-surface, close never reports clean over
   * a failure.
   */
  const close = () => {
    if (closing !== null) return closing
    disposed = true // immediate cutoff: new requests/registrations/captures refuse while the chain unwinds
    const entryErrors = []
    let unregisterSettled = null
    if (registration !== null) {
      const bound = registration
      registration = null
      try {
        unregisterSettled = Promise.resolve(bound.dispose()) // the disposer captured from the REGISTERED face — the scope binding, not a name lookup
      } catch (error) {
        entryErrors.push(`unregister: ${String(error?.message ?? error).slice(0, 120)}`)
      }
    }
    closing = chain.then(async () => {
      const errors = [...entryErrors]
      if (unregisterSettled !== null) {
        try { await unregisterSettled } catch (error) { errors.push(`unregister: ${String(error?.message ?? error).slice(0, 120)}`) }
      }
      await Promise.allSettled([...inflight]) // drain: every dispatched request settles before the clients die
      const dying = [...pendingGenerations, ...retainedGenerations]
      if (client !== null) dying.push(client)
      client = null // ownership now lives in `dying` — nothing is pre-cleared; a generation that will not close stays retained (below)
      for (const gen of dying) {
        const ok = await settleGenerationClose(gen, 'scope-close-generation', generationStates.get(gen) ?? null)
        if (ok) { pendingGenerations.delete(gen); retainedGenerations.delete(gen) } // reduced ONLY on real success
        else retainedGenerations.add(gen) // failed objects keep REAL ownership — re-attemptable by a later close(), never dropped for an error string
      }
      for (const failure of closeFailures.splice(0)) errors.push(`retained-${failure}`) // failures owned from earlier rotations/connects/attempts
      if (errors.length > 0) {
        throw new G2SeamError(A5_G2_SEAM_CODES.CLOSE_FAILED, `Team MCP scope close FAILED (${errors.join(' | ')}) — never reported clean`)
      }
      observe({ event: 'scope-closed', server: resourceServerName })
    })
    chain = closing.then(() => {}, () => {})
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
      transportsBuilt: transportStates.length,
      transportsClosed: transportStates.filter((s) => s.closed).length, // only real successes count
      transportsCloseFailed: transportStates.filter((s) => s.closeError !== null).length,
      pendingGenerations: pendingGenerations.size,
      retainedGenerations: retainedGenerations.size, // PERSISTENT real ownership of generations not yet really closed
      scopeBound: registration !== null,
      dispatch: seam.stats(),
      lastDispatch: seam.lastDispatch(),
    }),
    assemblyLaws: Object.freeze({
      serial: 'connects, rotations and close run on ONE serial chain — a pending connect is counted by close, concurrent reconnects cannot overwrite-and-leak, and a failed connect rolls its own half-open generation closed while the current one stays live',
      failureOwnership: 'close failures are owned, never swallowed: SUCCESS is measured at the REAL transport state (pin-verified law — the SDK swallows transport.close failures on the failed-connect path and later client.close() calls no-op there, so a resolving client.close proves nothing); a refusing generation is RETAINED with PERSISTENT real reference (connect-rollback failure, rotation failure and failed scope-close attempt alike), reported CLOSE_FAILED where it happens, re-attempted/re-reported at close(), and dropped from ownership ONLY on a real transport-close success; transport "closed" marks only AFTER the real close succeeded',
      sameOrigin: 'the captured {generation, client, timeout} are built BY THIS PORT from the SAME approved config — new Client per generation (SDK 2.0.0, connection.ts:18/258 pattern), timeout = the original approved config value; the host connection exposes no capture point at this pin (recorded gap, not requested)',
      transportSource: 'the transport factory receives ONLY the frozen approved-config target {server, transport, full endpointUrl | spawn argv0/args/cwd} this port derives — same-source by construction; a non-Transport return refuses FACE_INCOMPLETE',
      registration: 'PUBLIC scope-layered mcpResources.register(server, provider) face bound at register (mcp-resources/src/index.ts:85-107 @639ed01539); the disposer binds to THAT face instance — scope isolation is the face binding, never the server name; close() unregisters exactly the bound face',
      credentialPolicy: 'no credentials created, escalated or transformed; endpoints/commands/cwd/timeouts pass through from the approved config; no global security or network configuration is read or written',
      scopeClose: 'SYNCHRONOUS admission cutoff at entry (requests/registrations/captures refuse NOW, the bound face is unregistered NOW), then the chain: drain in-flight → real close of current + every pending/retained generation; un-closed objects keep real ownership and re-surface; capture afterwards refuses CAPTURE_INCOMPLETE — no post-close dispatch',
    }),
  })
}
