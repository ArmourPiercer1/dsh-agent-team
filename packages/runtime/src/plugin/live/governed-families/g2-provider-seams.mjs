/**
 * A5-M2 G2 PROVIDER SEAMS — the REAL M0 provider-seam implementations for the
 * three ungoverned connector families (ROOT ROUND-2 card). This module does
 * not disclose gaps any more: it OWNS the ordering and the per-lease facts
 * for the lane that registers through it. Component status: UNWIRED — wiring
 * stays the CENTER (census books these files at commit); no Host process, no
 * network, no Windows legs. The legs in a5m2-g2-provider-seams.test.ts are
 * provider/lease DOUBLES, not real-Host proof.
 *
 * PUBLIC-ENTRY HONESTY (all @639ed01539, pristine host checkout; these are
 * the ONLY host faces this module builds against — no private API, no patch,
 * and NO invented getter is fabricated onto any host object):
 *  - WEB  `WebRuntime.registerSearchProvider(provider)` web/web/src/index.ts:103
 *         `WebRuntime.registerFetchProvider(provider)`  web/web/src/index.ts:114
 *         selection law                                        index.ts:63-72
 *         `resolveProvider` (configured MISSING :177 /
 *         registered-but-unavailable UNAVAILABLE :180 /
 *         none-configured single-or-ambiguous :184-190)        index.ts:172-190
 *         provider shape `{id, available(), search|fetch(request, signal?)}`
 *                                                              web/web/src/types.ts:102-119
 *  - MCP  `McpResourceRuntime.register(server, provider)`
 *                                    mcp/mcp-resources/src/index.ts:80
 *         provider shape = `{request(request, exec)}` and NOTHING else
 *                                    mcp/mcp-resources/src/index.ts:26-33
 *         request union {resources/list, resources/templates/list,
 *         resources/read}                        mcp-resources/src/index.ts:21-24
 *         runtime internals are PRIVATE (layers :51, request :122) — which is
 *         exactly why the transport incarnation is only observable to the
 *         connection-OWNING assembly, injected here as getLiveConnection.
 *  - BROWSER  the host pre-effect hook web use stagehand index.ts:192-198 is
 *         what this lease STRUCTURALLY REPLACES in this lane: below,
 *         `openResource` is unreachable until the PA edge returns `consumed`
 *         — the lease owns the ordering, so no wrapper race exists.
 *         The real launch/attach factory the owning assembly injects as
 *         `openResource` is the native-browser face (browser-use-stagehand
 *         native.ts:95 `openNativeBrowser`).
 *
 * HOW THE WEB PIN WORKS (root card 1, provider level, no Core patch): the
 * owning assembly registers the SEAM as the provider under the declared id
 * and sets its own web config (`searchProvider`/`fetchProvider`, index.ts:55-59)
 * to that id. The host selection law then FAILS CLOSED around the pin: a
 * configured id not registered → WEB_PROVIDER_CONFIGURED_MISSING; registered
 * but the seam reports `available() === false` (mirroring the REAL provider)
 * → WEB_PROVIDER_CONFIGURED_UNAVAILABLE; the seam never substitutes. Inside
 * `search()/fetch()` — the SAME stack the real dispatch runs in — the seam
 * re-verifies the pinned real-provider identity, the endpoint envelope and
 * the frozen request binding, then hands the ORIGINAL request object to the
 * REAL provider. Per-lease facts are therefore captured from inside the
 * host's own selection stack (the seam's dispatch running IS the proof this
 * seam was selected for THIS call) — a ledger, not a getter.
 *
 * STATUS: UNWIRED; `final_declaration` stays null; host use for this lane
 * remains FOREVER-BANNED-FOR-THIS-LANE. Windows dimensions:
 * NOT_RUN_WINDOWS_UNAUTHORIZED.
 *
 * @module @dsh-agent-team/runtime/plugin/live/governed-families/g2-provider-seams
 */
import { createHash } from 'node:crypto'
import { URL } from 'node:url'

import { A5_G2_NAMED_BLOCKERS, classifyG2McpSurface } from './g2-connector-adapters.mjs'

export const A5_G2_SEAM_REVISION = 1

/** Typed refusal codes owned by this module (all prefixed P_G2_SEAM_). */
export const A5_G2_SEAM_CODES = Object.freeze({
  REAL_PROVIDER_ABSENT: 'P_G2_SEAM_REAL_PROVIDER_ABSENT',
  CONFIG_IDENTITY_MISMATCH: 'P_G2_SEAM_CONFIG_IDENTITY_MISMATCH',
  ALREADY_WRAPPED: 'P_G2_SEAM_ALREADY_WRAPPED',
  IDENTITY_DRIFT: 'P_G2_SEAM_IDENTITY_DRIFT',
  PROVIDER_UNAVAILABLE: 'P_G2_SEAM_PROVIDER_UNAVAILABLE',
  ENDPOINT_DRIFT: 'P_G2_SEAM_ENDPOINT_DRIFT',
  SURFACE_DRIFT: 'P_G2_SEAM_SURFACE_DRIFT',
  REQUEST_METHOD_UNKNOWN: 'P_G2_SEAM_REQUEST_METHOD_UNKNOWN',
  ARGUMENTS_REBIND: 'P_G2_SEAM_ARGUMENTS_REBIND',
  DESTINATION_INVALID: 'P_G2_SEAM_DESTINATION_INVALID',
  ASSEMBLY_FACTS_MISSING: 'P_G2_SEAM_ASSEMBLY_FACTS_MISSING',
  PA_NOT_CONSUMED: 'P_G2_SEAM_PA_NOT_CONSUMED',
  LEASE_DRAINING: 'P_G2_SEAM_LEASE_DRAINING',
  LEASE_CLOSED: 'P_G2_SEAM_LEASE_CLOSED',
  LAUNCH_FAILED: 'P_G2_SEAM_LAUNCH_FAILED',
  ARGS_REBOUND: 'P_G2_SEAM_ARGS_REBOUND',
  PLAN_UNUSABLE: 'P_G2_SEAM_PLAN_UNUSABLE',
})

/**
 * Seam-brand marker: a provider already wrapped by a G2 seam must never be
 * wrapped again (double pins freeze a frozen identity, not the real one).
 */
export const G2_SEAM_BRAND = Symbol.for('dsh.a5m2.g2.seam-wrapped')

/**
 * Drain semantics of the BROWSER LEASE — narrower and STRONGER than the row
 * drain string: the lease OWNS the scheduling of every `work()` it starts,
 * so `drain()` really awaits all in-flight work and closes the resource
 * after the last settles. It still cannot kill the inside of a running
 * native call and never claims to.
 */
export const A5_G2_LEASE_DRAIN_SEMANTICS =
  'lease drain: new run/acquire refused from the moment drain begins; every work() promise the lease itself started is AWAITED (the lease owns their scheduling) and the resource is closed exactly once after the last settles; the lease never kills the inside of a running call and never claims to'

/** Seam-local typed error (providers throw; hosts surface provider errors). */
export class G2SeamError extends Error {
  constructor (code, detail, facts) {
    super(`${code}: ${detail}`)
    this.name = 'G2SeamError'
    this.code = code
    if (facts !== undefined) this.facts = facts
  }
}

/* ------------------------------------------------------------------ */
/* JSON binding primitives (fail-closed, JSON semantics identical to   */
/* the row's actualArgs snapshot: JSON roundtrip + sorted-key digest). */
/* ------------------------------------------------------------------ */

function sha256 (text) {
  return createHash('sha256').update(text, 'utf8').digest('hex')
}

function canonicalJson (value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value) ?? 'null'
  if (Array.isArray(value)) return `[${value.map((v) => canonicalJson(v)).join(',')}]`
  const keys = Object.keys(value).sort()
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`
}

/** JSON-semantics clone (same as the row's snapshot: JSON roundtrip). */
function jsonClone (value) {
  return JSON.parse(JSON.stringify(value))
}

function deepFreeze (value) {
  if (value === null || typeof value !== 'object') return value
  for (const inner of Object.values(value)) deepFreeze(inner)
  return Object.freeze(value)
}

function httpOriginOf (raw, label, code) {
  if (typeof raw !== 'string' || raw.length === 0) {
    throw new G2SeamError(code, `${label} is missing — a destination is never invented here`)
  }
  let parsed
  try {
    parsed = new URL(raw)
  } catch {
    throw new G2SeamError(code, `${label} is not a parsable URL: ${JSON.stringify(raw).slice(0, 120)}`)
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
    throw new G2SeamError(code, `${label} must be http(s) (got ${parsed.protocol})`)
  }
  return `${parsed.protocol}//${parsed.host}`
}

/**
 * Frozen-args binding (root card 4 primitive): snapshot a value under JSON
 * semantics, deep-freeze it, and be able to RE-VERIFY a live value against
 * the snapshot's fingerprint at the REAL consumption edge. A Proxy or a
 * in-place mutation between plan time and the edge changes the digest and
 * fails closed.
 */
export function createG2FrozenArgsBinding ({ label, value } = {}) {
  if (typeof label !== 'string' || label.length === 0) {
    throw new TypeError('createG2FrozenArgsBinding: label is required')
  }
  let snapshot
  try {
    snapshot = deepFreeze(jsonClone(value))
  } catch {
    throw new G2SeamError(A5_G2_SEAM_CODES.ARGUMENTS_REBIND, `${label}: not losslessly JSON-cloneable at bind time — refusing to build a binding that cannot re-verify`)
  }
  const fingerprint = `sha256:${sha256(canonicalJson(snapshot))}`
  return Object.freeze({
    label,
    snapshot,
    fingerprint,
    /** Recompute the live value's digest; identical JSON ⇒ identical digest. */
    verify (liveValue) {
      try {
        if (`sha256:${sha256(canonicalJson(jsonClone(liveValue)))}` !== fingerprint) {
          return { ok: false, code: A5_G2_SEAM_CODES.ARGUMENTS_REBIND, detail: `${label}: the live value no longer matches the frozen bind-time snapshot (mutated or rebound)` }
        }
        return { ok: true }
      } catch {
        return { ok: false, code: A5_G2_SEAM_CODES.ARGUMENTS_REBIND, detail: `${label}: the live value is no longer JSON-cloneable — refusing, the digest cannot be re-verified` }
      }
    },
  })
}

/* ------------------------------------------------------------------ */
/* WEB seam — provider-level pin (root card 1).                        */
/* ------------------------------------------------------------------ */

/**
 * Build the governed web provider the owning assembly registers via the
 * PUBLIC `ctx.web.registerSearchProvider` / `registerFetchProvider` faces
 * (web/src/index.ts:103/:114 @639ed01539) under the DECLARED id, with its
 * own web config naming that id. Every dispatch re-verifies, inside the
 * same stack the real call runs in: pinned real-provider identity →
 * availability → endpoint envelope / request-path destination capture →
 * frozen request binding — then hands the ORIGINAL request object to the
 * REAL provider. Zero forwarding on any drift.
 *
 * @param deps {{
 *   kind: 'search'|'fetch',
 *   providerId: string,
 *   getRealProvider: () => {id: string, available(): boolean,
 *        search?: Function, fetch?: Function},
 *   declaredSearchOrigin?: string,       // search only: the pinned endpoint
 *   getSearchEndpointOrigin?: () => string, // optional CURRENT endpoint fact
 *   observe?: (event) => void
 * }}
 */
export function createG2WebProviderSeam ({ kind, providerId, getRealProvider, declaredSearchOrigin, getSearchEndpointOrigin, observe = () => {} } = {}) {
  if (kind !== 'search' && kind !== 'fetch') {
    throw new TypeError(`${A5_G2_SEAM_CODES.ASSEMBLY_FACTS_MISSING}: kind must be 'search' or 'fetch' (the two web capability kinds, web/src/types.ts:102-119 @639ed01539)`)
  }
  if (typeof providerId !== 'string' || providerId.length === 0) {
    throw new TypeError(`${A5_G2_SEAM_CODES.ASSEMBLY_FACTS_MISSING}: providerId is required — the assembly's web config must name this exact id (web/src/index.ts:55-59 @639ed01539)`)
  }
  if (typeof getRealProvider !== 'function') {
    throw new TypeError(`${A5_G2_SEAM_CODES.ASSEMBLY_FACTS_MISSING}: getRealProvider is required — the seam pins the REAL provider OBJECT; a name string is not a pin`)
  }
  const pinned = getRealProvider()
  if (pinned === null || typeof pinned !== 'object' || typeof pinned.id !== 'string' || typeof pinned.available !== 'function' || typeof pinned[kind] !== 'function') {
    throw new G2SeamError(A5_G2_SEAM_CODES.REAL_PROVIDER_ABSENT, `no real ${kind} provider object stands behind getRealProvider (shape {id, available(), ${kind}(request, signal?)} @web/src/types.ts:102-119) — the seam refuses to mount a pin around nothing`)
  }
  if (pinned[G2_SEAM_BRAND] === true) {
    throw new G2SeamError(A5_G2_SEAM_CODES.ALREADY_WRAPPED, 'the provider behind getRealProvider is itself a G2 seam — double-wrapping freezes a frozen identity instead of the real one')
  }
  if (pinned.id !== providerId) {
    throw new G2SeamError(A5_G2_SEAM_CODES.CONFIG_IDENTITY_MISMATCH, `declared providerId ${JSON.stringify(providerId)} does not equal the REAL provider's own id ${JSON.stringify(pinned.id)} — the pin would serve one identity under another's name`)
  }
  let pinnedEndpoint = null
  if (kind === 'search') {
    pinnedEndpoint = httpOriginOf(declaredSearchOrigin, 'declaredSearchOrigin (the real search endpoint, config-bound family of web-gateway-assembly.boundSearchOriginSource)', A5_G2_SEAM_CODES.ASSEMBLY_FACTS_MISSING)
    if (getSearchEndpointOrigin !== undefined && typeof getSearchEndpointOrigin !== 'function') {
      throw new TypeError(`${A5_G2_SEAM_CODES.ASSEMBLY_FACTS_MISSING}: getSearchEndpointOrigin, when supplied, is the assembly's CURRENT endpoint fact reader`)
    }
  }
  let lastDispatch = null
  let dispatchCount = 0
  let driftRejects = 0
  const refuse = (code, detail, facts) => {
    driftRejects += 1
    observe({ event: 'drift-refusal', kind, providerId, code, detail })
    throw new G2SeamError(code, detail, facts)
  }

  const dispatch = async (request, signal) => {
    // The binding snapshots the request as RECEIVED at this real edge…
    const binding = createG2FrozenArgsBinding({ label: `web-${kind}-request`, value: request })
    // …identity re-verify against the bind-time REAL object (a swapped or
    // re-registered generation is refused, never silently served)…
    const now = getRealProvider()
    if (now !== pinned) {
      refuse(A5_G2_SEAM_CODES.IDENTITY_DRIFT, `the ${kind} provider registered at bind time is not the provider standing behind the seam now — serving a frozen pin under a rotated generation is refused; zero forwarding`, { providerId })
    }
    if (now.available() !== true) {
      refuse(A5_G2_SEAM_CODES.PROVIDER_UNAVAILABLE, `the pinned real ${kind} provider reports unavailable — the host law makes the configured lane WEB_PROVIDER_CONFIGURED_UNAVAILABLE (web/src/index.ts:180 @639ed01539); the seam mirrors that, it never substitutes`, { providerId })
    }
    let destinationOrigin
    if (kind === 'search') {
      destinationOrigin = pinnedEndpoint
      if (getSearchEndpointOrigin !== undefined) {
        const live = getSearchEndpointOrigin()
        if (live !== pinnedEndpoint) {
          refuse(A5_G2_SEAM_CODES.ENDPOINT_DRIFT, `the search endpoint moved (${JSON.stringify(pinnedEndpoint)} pinned, ${JSON.stringify(live)} live) — the frozen destination envelope no longer describes the real one; zero forwarding`)
        }
      }
    } else {
      // fetch: the destination is a REAL REQUEST-PATH fact, captured here
      // from the actual request object — never from a factory string.
      destinationOrigin = httpOriginOf(request?.url, 'the actual fetch request url', A5_G2_SEAM_CODES.DESTINATION_INVALID)
    }
    // …frozen-request re-verify at the edge (a rebound request is refused)…
    const check = binding.verify(request)
    if (check.ok !== true) refuse(A5_G2_SEAM_CODES.ARGUMENTS_REBIND, `${check.detail}; zero forwarding`)
    dispatchCount += 1
    const facts = deepFreeze({
      seam: 'web',
      kind,
      capturedAt: 'provider-dispatch-lease', // inside the host's own selection stack
      providerId,
      destinationOrigin,
      requestFingerprint: binding.fingerprint,
    })
    lastDispatch = facts
    observe({ event: 'dispatch', facts })
    return await now[kind](request, signal) // the ORIGINAL request object, verbatim
  }

  const available = () => {
    try {
      return getRealProvider() === pinned && pinned.available() === true
    } catch {
      return false
    }
  }
  const provider = kind === 'search'
    ? { id: providerId, available, search: (request, signal) => dispatch(request, signal) }
    : { id: providerId, available, fetch: (request, signal) => dispatch(request, signal) }
  Object.defineProperty(provider, G2_SEAM_BRAND, { value: true })

  return Object.freeze({
    provider,
    registrationLaw: deepFreeze({
      registerVia: `ctx.web.${kind === 'search' ? 'registerSearchProvider' : 'registerFetchProvider'}(provider) — web/web/src/index.ts:${kind === 'search' ? '103' : '114'} @639ed01539`,
      configuredProviderIdMustEqual: providerId,
      law: 'web selection resolves AT EXECUTION TIME: configured id registered+available → this seam; configured id missing → WEB_PROVIDER_CONFIGURED_MISSING; registered but unavailable → WEB_PROVIDER_CONFIGURED_UNAVAILABLE; no id configured with multiple usable → WEB_PROVIDER_AMBIGUOUS (web/src/index.ts:63-72,172-190 @639ed01539) — the law fails CLOSED around the pin; the seam supplies per-lease facts from inside that same stack and substitutes on none of these paths',
    }),
    lastDispatch: () => lastDispatch,
    stats: () => Object.freeze({ dispatchCount, driftRejects }),
  })
}

/* ------------------------------------------------------------------ */
/* MCP seam — request-lease capture (root card 2).                     */
/* ------------------------------------------------------------------ */

const MCP_METHODS = ['resources/list', 'resources/templates/list', 'resources/read']

/**
 * Build the governed `McpResourceProvider` the connection-OWNING assembly
 * registers via the PUBLIC `McpResourceRuntime.register(server, provider)`
 * (mcp-resources/src/index.ts:80 @639ed01539). Inside `request()` — the SAME
 * execution lease as the real call — the seam captures the CURRENT facts
 * from the real request path (`exec` of THIS call + the owning assembly's
 * live-connection reader) and RE-VERIFIES them against the declared surface
 * before forwarding. A factory-config string never serves as the
 * incarnation: `getLiveConnection()` supplies the live transport facts and
 * their generation; without it the incarnation is honestly `unobserved` and
 * the MCP named blocker rides the per-lease facts VERBATIM.
 *
 * @param deps {{
 *   declaredSurfaceConfig: object,           // classified by classifyG2McpSurface
 *   getRealProvider: () => {request: Function},
 *   getLiveConnection?: () => {transport: string, endpointOrigin?: string,
 *        spawn?: {argv0: string}, incarnation?: string},
 *   observe?: (event) => void
 * }}
 */
export function createG2McpProviderSeam ({ declaredSurfaceConfig, getRealProvider, getLiveConnection, observe = () => {} } = {}) {
  const declared = classifyG2McpSurface(declaredSurfaceConfig) // canonical classifier (shared family file; not modified)
  if (typeof getRealProvider !== 'function') {
    throw new TypeError(`${A5_G2_SEAM_CODES.ASSEMBLY_FACTS_MISSING}: getRealProvider is required — the seam pins the REAL provider object, registered under the same server name`)
  }
  const pinned = getRealProvider()
  if (pinned === null || typeof pinned !== 'object' || typeof pinned.request !== 'function') {
    throw new G2SeamError(A5_G2_SEAM_CODES.REAL_PROVIDER_ABSENT, `no real McpResourceProvider stands behind getRealProvider (shape {request(request, exec)} @mcp-resources/src/index.ts:26-33) — refusing to mount a pin around nothing`)
  }
  if (pinned[G2_SEAM_BRAND] === true) {
    throw new G2SeamError(A5_G2_SEAM_CODES.ALREADY_WRAPPED, 'the provider behind getRealProvider is itself a G2 seam — double-wrapping freezes a frozen identity instead of the real one')
  }
  if (getLiveConnection !== undefined && typeof getLiveConnection !== 'function') {
    throw new TypeError(`${A5_G2_SEAM_CODES.ASSEMBLY_FACTS_MISSING}: getLiveConnection, when supplied, is the CONNECTION-OWNING assembly's live-facts reader (transport/endpoint/generation of the actual live connection)`)
  }
  let lastDispatch = null
  let dispatchCount = 0
  let driftRejects = 0
  const refuse = (code, detail, facts) => {
    driftRejects += 1
    observe({ event: 'drift-refusal', server: declared.serverName, code, detail })
    throw new G2SeamError(code, detail, facts)
  }

  const provider = Object.defineProperties({}, {
    [G2_SEAM_BRAND]: { value: true },
    request: {
      value: async (request, exec) => {
        const binding = createG2FrozenArgsBinding({ label: 'mcp-request', value: request })
        if (request === null || typeof request !== 'object' || !MCP_METHODS.includes(request.method)) {
          refuse(A5_G2_SEAM_CODES.REQUEST_METHOD_UNKNOWN, `request.method ${JSON.stringify(request?.method ?? null)} is outside the McpResourceRequest union {resources/list, resources/templates/list, resources/read} (mcp-resources/src/index.ts:21-24 @639ed01539); zero forwarding`)
        }
        const now = getRealProvider()
        if (now !== pinned) {
          refuse(A5_G2_SEAM_CODES.IDENTITY_DRIFT, `the resource provider registered at bind time is not the provider behind the seam now — server "${declared.serverName}" generation rotated underneath the pin; zero forwarding`, { server: declared.serverName })
        }
        // CURRENT transport facts, captured UNDER THIS LEASE from the real
        // request path (not the factory config): exec is THIS call's, the
        // live-connection reader answers for the actual connection.
        let connectionIncarnation = 'unobserved'
        let connectionIncarnationReason
        if (getLiveConnection !== undefined) {
          const live = getLiveConnection()
          if (live === null || typeof live !== 'object' || live.transport !== declared.transport) {
            refuse(A5_G2_SEAM_CODES.SURFACE_DRIFT, `the LIVE connection says transport ${JSON.stringify(live?.transport ?? null)}, the declared surface says ${JSON.stringify(declared.transport)} — the surface a request rides must match what the live connection actually is; zero forwarding`)
          }
          if (declared.transport === 'streamable-http' && live.endpointOrigin !== declared.endpointOrigin) {
            refuse(A5_G2_SEAM_CODES.SURFACE_DRIFT, `the LIVE endpoint ${JSON.stringify(live.endpointOrigin ?? null)} differs from the classified surface origin ${JSON.stringify(declared.endpointOrigin)} — a re-pointed endpoint is refused, not re-approved silently; zero forwarding`)
          }
          if (declared.transport === 'stdio' && (live.spawn?.argv0 ?? null) !== declared.spawn.argv0) {
            refuse(A5_G2_SEAM_CODES.SURFACE_DRIFT, `the LIVE spawn argv0 ${JSON.stringify(live.spawn?.argv0 ?? null)} differs from the classified surface ${JSON.stringify(declared.spawn.argv0)}; zero forwarding`)
          }
          if (declared.connectionIncarnation !== 'unobserved' && live.incarnation !== declared.connectionIncarnation) {
            refuse(A5_G2_SEAM_CODES.SURFACE_DRIFT, `the LIVE connection generation ${JSON.stringify(live.incarnation ?? null)} differs from the declared incarnation ${JSON.stringify(declared.connectionIncarnation)} — a reconnected generation under an approved incarnation is refused; zero forwarding`)
          }
          if (typeof live.incarnation === 'string' && live.incarnation.length > 0) connectionIncarnation = live.incarnation
        } else {
          connectionIncarnationReason = A5_G2_NAMED_BLOCKERS.MCP
        }
        const check = binding.verify(request)
        if (check.ok !== true) refuse(A5_G2_SEAM_CODES.ARGUMENTS_REBIND, `${check.detail}; zero forwarding`)
        dispatchCount += 1
        const facts = deepFreeze({
          seam: 'mcp',
          capturedAt: 'provider-request-lease', // under the SAME lease as the real request
          server: declared.serverName,
          method: request.method,
          transport: declared.transport,
          ...(declared.transport === 'streamable-http' ? { endpointOrigin: declared.endpointOrigin } : { spawnArgv0: declared.spawn.argv0 }),
          connectionIncarnation,
          ...(connectionIncarnationReason !== undefined ? { connectionIncarnationReason } : {}),
          execObserved: exec !== undefined, // THIS call's ToolExecution rode the lease
          requestFingerprint: binding.fingerprint,
        })
        lastDispatch = facts
        observe({ event: 'dispatch', facts })
        return await now.request(request, exec) // request AND exec forwarded VERBATIM
      },
    },
  })

  return Object.freeze({
    provider,
    serverName: declared.serverName,
    declaredSurface: declared,
    registrationLaw: deepFreeze({
      registerVia: 'ctx.mcpResources.register(server, provider) — mcp/mcp-resources/src/index.ts:80 @639ed01539 (public registration face; returns the effect disposer)',
      law: 'the runtime re-selects the provider at REQUEST time from the live exec.agent scope + server (index.ts:120-125 @639ed01539); this seam runs INSIDE that selection — its request() executing for THIS exec is the lease-time proof it served this call, and every transport fact above was captured under that same lease',
    }),
    lastDispatch: () => lastDispatch,
    stats: () => Object.freeze({ dispatchCount, driftRejects }),
  })
}

/* ------------------------------------------------------------------ */
/* BROWSER seam — governed resource LEASE with PA-before-launch (3).   */
/* ------------------------------------------------------------------ */

/**
 * The governed browser resource lease. `openResource` (the real launch/attach
 * factory the owning assembly injects — e.g. wrapping native.ts:95
 * openNativeBrowser @639ed01539) is STRUCTURALLY unreachable until the PA
 * edge has returned 'consumed' for THIS call: the ordering is owned here, so
 * the host pre-effect hook race (web use stagehand index.ts:192-198) simply
 * does not exist in this lane. Drain is real for what the lease controls:
 * it schedules every work() itself, so drain awaits them all and closes the
 * resource exactly once after the last settles.
 *
 * @param deps {{
 *   mode: 'launch'|'attach',
 *   openResource: (ctx) => Promise<{close?: () => unknown}>,
 *   consumeApproval: (callFacts) => Promise<'consumed'|'refused'|'unavailable'> | 'consumed'|'refused'|'unavailable',
 *   launchEnvelope?: object,   // declared origins (cdp/model/…) frozen into facts
 *   observe?: (event) => void
 * }}
 */
export function createG2BrowserResourceLease ({ mode, openResource, consumeApproval, launchEnvelope, observe = () => {} } = {}) {
  if (mode !== 'launch' && mode !== 'attach') {
    throw new TypeError(`${A5_G2_SEAM_CODES.ASSEMBLY_FACTS_MISSING}: mode must be 'launch' or 'attach' (stagehand Config.mode @639ed01539)`)
  }
  if (typeof openResource !== 'function') {
    throw new TypeError(`${A5_G2_SEAM_CODES.ASSEMBLY_FACTS_MISSING}: openResource is required — the real ${mode} factory this lease sequences AFTER the PA edge`)
  }
  if (typeof consumeApproval !== 'function') {
    throw new TypeError(`${A5_G2_SEAM_CODES.ASSEMBLY_FACTS_MISSING}: consumeApproval is required — the PA consumption edge the lease runs BEFORE any ${mode}`)
  }
  const envelope = launchEnvelope === undefined ? null : deepFreeze(jsonClone(launchEnvelope))
  const log = []
  const running = new Set()
  let state = 'idle' // idle | launching | active | draining | failed | closed
  let resource = null
  let init = null
  let paDecisions = 0
  let paRefusals = 0
  let launchCount = 0
  let closeCount = 0

  const disposeOnce = async (reason) => {
    if (resource !== null && closeCount === 0) {
      closeCount += 1
      log.push('resource:close')
      try {
        await resource.close?.()
      } catch {
        observe({ event: 'close-error', reason }) // honest: close failed is observed, never hidden
      }
    }
    resource = null
    init = null
  }

  const ensure = async () => {
    if (init === null) {
      launchCount += 1
      state = 'launching'
      log.push(`lease:launch:${mode}`)
      init = (async () => {
        try {
          const opened = await openResource({ mode, envelope })
          if (opened === null || typeof opened !== 'object') {
            throw new Error('openResource resolved without a resource handle')
          }
          log.push('lease:ready')
          return opened
        } catch (cause) {
          log.push('lease:launch-failed')
          state = 'failed'
          init = null
          throw new G2SeamError(A5_G2_SEAM_CODES.LAUNCH_FAILED, `${mode} failed under the lease (cause: ${String(cause?.message ?? cause).slice(0, 160)}); a failed launch leaves NO half-open resource — a retry is a NEW call and re-consumes PA`, { mode })
        }
      })()
    }
    resource = await init
    state = 'active'
    return resource
  }

  /**
   * The ONE entry to the browser resource: PA edge first — openResource is
   * never reached unless the decision is 'consumed' — then launch/attach at
   * most once, then the caller's work under the lease.
   */
  const run = async (callFacts, work, signal) => {
    if (typeof work !== 'function') {
      throw new TypeError(`${A5_G2_SEAM_CODES.ASSEMBLY_FACTS_MISSING}: run(callFacts, work) needs the work body to sequence under the lease`)
    }
    if (state === 'draining') throw new G2SeamError(A5_G2_SEAM_CODES.LEASE_DRAINING, 'the lease is draining — no new run enters; in-flight work is awaited, not killed')
    if (state === 'closed') throw new G2SeamError(A5_G2_SEAM_CODES.LEASE_CLOSED, 'the lease is closed and its resource disposed — a new lifecycle is a new lease, never a resurrection')
    // PA EDGE — BEFORE any launch/attach, structurally:
    const facts = deepFreeze(jsonClone({ mode, envelope, ...(callFacts === null || typeof callFacts !== 'object' ? {} : callFacts) }))
    const decision = await consumeApproval(facts)
    paDecisions += 1
    log.push(`lease:pa:${String(decision)}`)
    if (decision !== 'consumed') {
      paRefusals += 1
      observe({ event: 'pa-refusal', decision })
      throw new G2SeamError(A5_G2_SEAM_CODES.PA_NOT_CONSUMED, `the PA edge answered ${JSON.stringify(String(decision))} for this call — under ${mode} mode NOTHING launched and NOTHING attached; a later retry is a new call with a fresh PA consumption`, { mode, decision: String(decision) })
    }
    // The decision awaited: re-verify the lease state (drain may have begun
    // WHILE the PA edge was in flight — that is the same lease, honoured).
    if (state === 'draining') throw new G2SeamError(A5_G2_SEAM_CODES.LEASE_DRAINING, 'drain began while the PA edge was in flight — the consumed call does not enter a draining lease')
    if (state === 'closed') throw new G2SeamError(A5_G2_SEAM_CODES.LEASE_CLOSED, 'the lease closed while the PA edge was in flight')
    const opened = await ensure() // launch/attach at most once; shared across calls
    const task = (async () => {
      log.push('lease:work:enter')
      try {
        return await work(opened, signal)
      } finally {
        log.push('lease:work:settle')
      }
    })()
    running.add(task)
    try {
      return await task
    } finally {
      running.delete(task)
    }
  }

  /** Real drain for what the lease controls (see A5_G2_LEASE_DRAIN_SEMANTICS). */
  const drain = async () => {
    if (state === 'closed') return snapshot()
    state = 'draining'
    log.push('lease:drain')
    while (running.size > 0) await Promise.allSettled([...running])
    await disposeOnce('drain')
    state = 'closed'
    log.push('lease:closed')
    return snapshot()
  }

  const snapshot = () => Object.freeze({
    state,
    mode,
    drainSemantics: A5_G2_LEASE_DRAIN_SEMANTICS,
    paDecisions,
    paRefusals,
    launchCount,
    closeCount,
    order: Object.freeze([...log]),
  })

  return Object.freeze({
    run,
    drain,
    state: () => state,
    snapshot,
    launchOrder: () => Object.freeze([...log]),
    governanceLaw: deepFreeze({
      ordering: 'consumeApproval(callFacts) is awaited BEFORE openResource is ever invoked — the lease owns the order, so the host pre-effect hook race (browser-use-stagehand-native index.ts:192-198 @639ed01539, which can launch/attach before next()) does not exist on this path',
      launchFactory: 'openResource is the assembly-injected real factory (native-browser face openNativeBrowser, native.ts:95 @639ed01539 when the assembly is the §5.5 owned provider); the lease sequences it, it never launches anything itself',
      drain: A5_G2_LEASE_DRAIN_SEMANTICS,
    }),
  })
}

/* ------------------------------------------------------------------ */
/* Consumption-edge enforcement (root card 4).                          */
/* ------------------------------------------------------------------ */

/**
 * Enforce the FROZEN actualArgs binding AT THE REAL CONSUMPTION EDGE.
 * `plan` is the previously-PRODUCED (and, in the lane, PA-approved) plan from
 * a g2-connector row; `args` are the live arguments about to be consumed.
 * Before ANY native entry this checks, fail-closed:
 *  1. the live args still deep-equal the plan's frozen actualArgs snapshot
 *     (a swapped/mutated args object since approval is refused here);
 *  2. a fresh pure classify of the live args reproduces the plan's exact
 *     parametersFingerprint — this also catches CURRENT-facts movement
 *     (provider rotation etc.) between approval and consumption, because the
 *     fingerprint covers the classify-time facts;
 *  3. only then delegates to row.invoke(args, exec), handing the ORIGINAL
 *     args object to the row (rows still call native with the original
 *     object — the binding is enforced here, at the edge, not just asserted
 *     on the plan).
 * Refusals are row-shaped ({ok:false, code, detail}) with ZERO native entry.
 */
export async function consumeG2ApprovedPlan ({ row, plan, args, exec } = {}) {
  if (row === null || typeof row !== 'object' || typeof row.invoke !== 'function' || typeof row.classify !== 'function') {
    throw new TypeError('consumeG2ApprovedPlan: row must be a g2-connector adapter face (classify + invoke)')
  }
  if (plan === null || typeof plan !== 'object' || plan.ok !== true || typeof plan.parametersFingerprint !== 'string' || plan.actualArgs === undefined) {
    return { ok: false, code: A5_G2_SEAM_CODES.PLAN_UNUSABLE, detail: 'the consumed plan is absent, a refusal, or carries no frozen actualArgs snapshot — nothing to bind against; zero native entry' }
  }
  const binding = createG2FrozenArgsBinding({ label: 'approved-plan-actualArgs', value: plan.actualArgs })
  const bound = binding.verify(args)
  if (bound.ok !== true) {
    return { ok: false, code: A5_G2_SEAM_CODES.ARGS_REBOUND, detail: `${bound.detail} — the args handed to the consumption edge are NOT the approved call; zero native entry` }
  }
  let fresh
  try {
    fresh = await row.classify(args)
  } catch {
    return { ok: false, code: A5_G2_SEAM_CODES.ARGS_REBOUND, detail: 'the edge re-classify threw — the row state moved underneath the approved plan; zero native entry' }
  }
  if (fresh.ok !== true) {
    return { ok: false, code: fresh.code ?? A5_G2_SEAM_CODES.ARGS_REBOUND, detail: `the edge re-classify now refuses (${String(fresh.detail ?? '').slice(0, 200)}); an approved plan does not outlive the row's current state; zero native entry` }
  }
  if (fresh.parametersFingerprint !== plan.parametersFingerprint) {
    return { ok: false, code: A5_G2_SEAM_CODES.ARGS_REBOUND, detail: 'a fresh classify of the SAME args now produces a DIFFERENT fingerprint than the approved plan — the classify-time facts moved (provider/destination rotation) since approval; the frozen facts bound at the edge, not the plan alone; zero native entry' }
  }
  return await row.invoke(args, exec) // ORIGINAL args object, identity preserved
}
