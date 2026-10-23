/**
 * A5-M2 G2 PROVIDER SEAMS — the REAL M0 provider-seam implementations for the
 * three ungoverned connector families (ROOT ROUND-2 card; RE-REVIEW
 * 502bc8316; FINAL NARROW RULING c0e). The seams OWN ordering and per-lease
 * facts for the lane that registers through them. Component status: UNWIRED —
 * wiring stays the CENTER; no Host process, no network, no Windows legs; the
 * legs in a5m2-g2-provider-seams.test.ts are provider/lease DOUBLES, not
 * real-Host proof, and the ordering/capture legs go RED if the sequencing or
 * capture is removed.
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
 *         METHOD identity (c0e-2) is the JS `provider.search`/`provider.fetch`
 *         FUNCTION OBJECT plus `provider.id` — frozen at bind and re-verified
 *         immediately before the real call; the destination envelope is
 *         endpoint origin + immutable config identity, supplied by the REAL
 *         factory/config through a REQUIRED live reader (origin alone never
 *         passes; no HTTP-method string stand-in).
 *         The seam is INERT outside the Team scope: it registers nothing by
 *         itself; only a Team-scoped assembly effect puts it behind the
 *         configured id (a noTeam install registers the raw provider and the
 *         seam is never entered — leg-proven).
 *  - MCP  `McpResourceRuntime.register(server, provider)`
 *                                    mcp/mcp-resources/src/index.ts:80
 *         provider shape = `{request(request, exec)}` and NOTHING else
 *                                    mcp/mcp-resources/src/index.ts:26-33
 *         request union {resources/list, resources/templates/list,
 *         resources/read}                        mcp-resources/src/index.ts:21-24
 *         runtime internals are PRIVATE (layers :51, request :122) and the
 *         runtime's own request-time re-selection picks its OWN client —
 *         forwarding through it is therefore NOT client binding (c0e-3).
 *         This is the M0 OWNED-provider lane: the seam executes the captured
 *         GENERATION-SPECIFIC dispatch on the captured CLIENT OBJECT itself
 *         (the owning assembly's real client), never a re-selection, never a
 *         self-proving getter string. No call passes unobserved: a missing
 *         or incomplete capture point refuses.
 *  - BROWSER  the lease is written to the OWNER's real contract,
 *         browser-use-runtime/src/index.ts @639ed01539:
 *           · OwnedSessionResource = { value, close(): Promise<void> } —
 *             close is REQUIRED (:12-18); a handle without close is a
 *             contract breach, never a silently-"closed" resource.
 *           · open "rejects only after rolling back partial acquisition" —
 *             the FACTORY owns half-open rollback (:23-30; runtime comment
 *             :174; the real factory does exactly this: launchChromium then
 *             openBrowserWorker, and on connect failure await chromium.close()
 *             — browser-use-stagehand-native/src/index.ts:103-130).
 *           · a PENDING open counts as the entry the moment it starts
 *             (entries.set with `ready` pending, :181) and closeEntry AWAITS
 *             the pending open and closes whatever arrives (:186-197) —
 *             this lease does the same. c0e-1: when a late-arriving
 *             resource's close FAILS, the handle is RETAINED and the SAME
 *             drainPromise REJECTS CLOSE_FAILED — the lease never reports a
 *             fake 'closed' and the resource is never dropped.
 *           · a FAILED close retains the entry and REJECTS disposal
 *             (:131-137).
 *         TEAM-OWNED LAUNCH OWNER (c0e-4, shipped — a named gap is NOT the
 *         deliverable): createG2BrowserLaunchOwner below IS the real launch
 *         owner for a Team-owned provider lane, composing the real sequence
 *         (owned-process launch → runtime open per the native faces
 *         browser-use-stagehand-native/src/native.ts:95 openNativeBrowser /
 *         :86 close, host pattern index.ts:105-117) with factory-owned
 *         half-open rollback and retain-on-close-failure. RESIDUAL GAP
 *         (reported honestly, not this lane's to fake): the HOST's own six
 *         stagehand tools construct SessionResources PLUGIN-INTERNALLY
 *         (browser-use-stagehand-native/src/index.ts:100-113) with no public
 *         injection point for that factory — that lane cannot be
 *         interposed at this pin without an upstream seam.
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

export const A5_G2_SEAM_REVISION = 3

/** Typed refusal codes owned by this module (all prefixed P_G2_SEAM_). */
export const A5_G2_SEAM_CODES = Object.freeze({
  REAL_PROVIDER_ABSENT: 'P_G2_SEAM_REAL_PROVIDER_ABSENT',
  CONFIG_IDENTITY_MISMATCH: 'P_G2_SEAM_CONFIG_IDENTITY_MISMATCH',
  ALREADY_WRAPPED: 'P_G2_SEAM_ALREADY_WRAPPED',
  IDENTITY_DRIFT: 'P_G2_SEAM_IDENTITY_DRIFT',
  PROVIDER_UNAVAILABLE: 'P_G2_SEAM_PROVIDER_UNAVAILABLE',
  ENDPOINT_DRIFT: 'P_G2_SEAM_ENDPOINT_DRIFT',
  MOUNT_FACTS_INCOMPLETE: 'P_G2_SEAM_MOUNT_FACTS_INCOMPLETE',
  CONFIG_DRIFT: 'P_G2_SEAM_CONFIG_DRIFT',
  SURFACE_DRIFT: 'P_G2_SEAM_SURFACE_DRIFT',
  CAPTURE_INCOMPLETE: 'P_G2_SEAM_CAPTURE_INCOMPLETE',
  REQUEST_METHOD_UNKNOWN: 'P_G2_SEAM_REQUEST_METHOD_UNKNOWN',
  ARGUMENTS_REBIND: 'P_G2_SEAM_ARGUMENTS_REBIND',
  DESTINATION_INVALID: 'P_G2_SEAM_DESTINATION_INVALID',
  ASSEMBLY_FACTS_MISSING: 'P_G2_SEAM_ASSEMBLY_FACTS_MISSING',
  PA_NOT_CONSUMED: 'P_G2_SEAM_PA_NOT_CONSUMED',
  LEASE_DRAINING: 'P_G2_SEAM_LEASE_DRAINING',
  LEASE_CLOSED: 'P_G2_SEAM_LEASE_CLOSED',
  LAUNCH_FAILED: 'P_G2_SEAM_LAUNCH_FAILED',
  OPEN_CONTRACT_BREACH: 'P_G2_SEAM_OPEN_CONTRACT_BREACH',
  CLOSE_FAILED: 'P_G2_SEAM_CLOSE_FAILED',
  ARGS_REBOUND: 'P_G2_SEAM_ARGS_REBOUND',
  PLAN_UNUSABLE: 'P_G2_SEAM_PLAN_UNUSABLE',
})

/**
 * Exact gaps this module reports instead of faking (root re-review 4 + c0e-4
 * — the launch-owner gap is NARROWED to the host's own lane because the
 * Team-owned launch owner SHIPS here; the MCP gap explains why owned-lane
 * dispatch binds to the captured client instead of the runtime re-selection).
 */
export const A5_G2_SEAM_NAMED_GAPS = Object.freeze({
  LAUNCH_OWNER: 'RESIDUAL (host lane only): the six native stagehand tools launch from a PLUGIN-INTERNAL SessionResources construction (browser-use-stagehand-native/src/index.ts:100-113 @639ed01539); SessionResourceOptions.open is injectable only at construction (browser-use-runtime/src/index.ts:22-31) and no public face at this pin supplies/overrides that factory. The Team-owned provider lane does NOT need it: its real launch owner is SHIPPED in this file — createG2BrowserLaunchOwner composes the real sequence (launchOwned → openRuntime; native faces openNativeBrowser native.ts:95, close native.ts:86; host pattern index.ts:105-117) with factory-owned half-open rollback',
  MCP_LIVE_TRANSPORT: 'McpResourceProvider exposes only request() (mcp/mcp-resources/src/index.ts:26-33 @639ed01539); the runtime re-selects its OWN client at request time (:120-125, layers private :51) — forwarding through it cannot bind a captured client (c0e-3). The M0 OWNED-provider lane therefore executes the captured generation-specific dispatch ON THE CAPTURED CLIENT OBJECT; live generation/client identity is supplied by the connection-owning assembly via captureConnection, and no call passes unobserved',
})

/**
 * Seam-brand marker: a provider already wrapped by a G2 seam must never be
 * wrapped again (double pins freeze a frozen identity, not the real one).
 */
export const G2_SEAM_BRAND = Symbol.for('dsh.a5m2.g2.seam-wrapped')

/**
 * Drain semantics of the BROWSER LEASE — follows the owner's dispose law
 * (browser-use-runtime/src/index.ts:131-197 @639ed01539): new entries
 * refused; every in-flight promise the lease started — INCLUDING a PENDING
 * launch — is awaited; a late-arriving launch closes itself; close runs once
 * after quiescence; ANY failed close (of the settled resource OR of a late
 * arrival) RETAINS the handle and REJECTS the same drainPromise with
 * CLOSE_FAILED — this lease never reports a fake 'closed' (c0e-1).
 */
export const A5_G2_LEASE_DRAIN_SEMANTICS =
  'lease drain: new run refused from the moment drain begins; every promise the lease itself started (in-flight work AND any PENDING launch) is AWAITED; a launch arriving after the drain began closes itself and is never handed out — and if that late close FAILS, the late handle is RETAINED and the SAME drainPromise REJECTS with CLOSE_FAILED; close runs exactly once after quiescence; any close that THROWS retains the entry and rejects with CLOSE_FAILED — the lease never reports closed, and CLOSED is terminal with no resurrection path'

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

/** JSON-semantics deep equality (identity facts compare with it). */
function sameJson (a, b) {
  try {
    return canonicalJson(jsonClone(a)) === canonicalJson(jsonClone(b))
  } catch {
    return false
  }
}

/**
 * Frozen-args binding (root card 4 primitive): snapshot a value under JSON
 * semantics, deep-freeze it, and be able to RE-VERIFY a live value against
 * the snapshot's fingerprint at the REAL consumption edge.
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

/**
 * The destination envelope (root re-review 2 as narrowed by c0e-2): the
 * real factory/config must supply endpointOrigin AND the SAME-ORIGIN
 * immutable configIdentity through a live reader on every dispatch —
 * origin alone is not an envelope. (The METHOD identity is NOT part of this
 * envelope: it is the frozen JS provider[kind] FUNCTION OBJECT plus
 * provider.id, checked directly against the pinned provider below — never
 * an HTTP-method string stand-in.)
 */
function mountFactsProblem (facts, label) {
  if (facts === null || typeof facts !== 'object') {
    return `${label} did not answer an object ({endpointOrigin, configIdentity})`
  }
  const missing = []
  if (typeof facts.endpointOrigin !== 'string' || facts.endpointOrigin.length === 0) missing.push('endpointOrigin')
  if (typeof facts.configIdentity !== 'string' || facts.configIdentity.length === 0) missing.push('configIdentity')
  return missing.length > 0 ? `${label} is missing ${missing.join(', ')} — origin alone is not a destination envelope (c0e-2)` : null
}

/* ------------------------------------------------------------------ */
/* WEB seam — provider-level pin (root card 1 + re-review 2 + c0e-2).  */
/* ------------------------------------------------------------------ */

/**
 * Build the governed web provider the owning assembly registers via the
 * PUBLIC `ctx.web.registerSearchProvider` / `registerFetchProvider` faces
 * (web/src/index.ts:103/:114 @639ed01539) under the DECLARED id, with its
 * own web config naming that id — inside the Team scope ONLY. The seam
 * registers nothing itself: a noTeam install never sees it (inert import,
 * assembly-scoped registration — leg-proven).
 *
 * Every dispatch, inside the same stack the real call runs in, re-verifies
 * BEFORE the real call: pinned real-provider OBJECT identity → `provider.id`
 * still equals the declared id → the FROZEN `provider.search`/`provider.fetch`
 * FUNCTION OBJECT is still the one mounted (c0e-2: method identity is the JS
 * function, not a string) → availability mirror → the destination envelope
 * (endpoint origin + immutable config identity, live from the REQUIRED
 * reader) → fetch destination from the REAL request path → frozen request
 * binding — then hands the ORIGINAL request object to the REAL provider.
 * Zero forwarding on any drift.
 *
 * @param deps {{
 *   kind: 'search'|'fetch',
 *   providerId: string,
 *   getRealProvider: () => object,
 *   declared: {endpointOrigin: string, configIdentity: string},
 *   readMountFacts: () => {endpointOrigin: string, configIdentity: string},
 *   observe?: (event) => void
 * }}
 */
export function createG2WebProviderSeam ({ kind, providerId, getRealProvider, declared, readMountFacts, observe = () => {} } = {}) {
  if (kind !== 'search' && kind !== 'fetch') {
    throw new TypeError(`${A5_G2_SEAM_CODES.ASSEMBLY_FACTS_MISSING}: kind must be 'search' or 'fetch' (the two web capability kinds, web/src/types.ts:102-119 @639ed01539)`)
  }
  if (typeof providerId !== 'string' || providerId.length === 0) {
    throw new TypeError(`${A5_G2_SEAM_CODES.ASSEMBLY_FACTS_MISSING}: providerId is required — the assembly's web config must name this exact id (web/src/index.ts:55-59 @639ed01539)`)
  }
  if (typeof getRealProvider !== 'function') {
    throw new TypeError(`${A5_G2_SEAM_CODES.ASSEMBLY_FACTS_MISSING}: getRealProvider is required — the seam pins the REAL provider OBJECT; a name string is not a pin`)
  }
  // Re-review 2 + c0e-2: the envelope is declared IN FULL by the real
  // factory/config and the CURRENT reader is REQUIRED — omitting the reader
  // cannot build the seam; origin-only can never pass dispatch.
  const declaredProblem = mountFactsProblem(declared, 'declared mount facts (the destination envelope)')
  if (declaredProblem !== null) throw new TypeError(`${A5_G2_SEAM_CODES.ASSEMBLY_FACTS_MISSING}: ${declaredProblem}`)
  if (typeof readMountFacts !== 'function') {
    throw new TypeError(`${A5_G2_SEAM_CODES.ASSEMBLY_FACTS_MISSING}: readMountFacts is REQUIRED — a seam that cannot re-read the CURRENT endpoint/config identity per dispatch would freeze a string and call it a fact`)
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
  // c0e-2: the METHOD identity — the JS function OBJECT actually mounted —
  // is frozen here and re-verified (together with provider.id) immediately
  // before every real call. A rebound provider[kind] is drift, full stop.
  const pinnedMethod = pinned[kind]
  const frozenDeclared = deepFreeze(jsonClone(declared))
  const declaredOrigin = httpOriginOf(frozenDeclared.endpointOrigin, 'declared endpointOrigin', A5_G2_SEAM_CODES.ASSEMBLY_FACTS_MISSING)
  let lastDispatch = null
  let dispatchCount = 0
  let driftRejects = 0
  const refuse = (code, detail, facts) => {
    driftRejects += 1
    observe({ event: 'drift-refusal', kind, providerId, code, detail })
    throw new G2SeamError(code, detail, facts)
  }

  const dispatch = async (request, signal) => {
    const binding = createG2FrozenArgsBinding({ label: `web-${kind}-request`, value: request })
    const now = getRealProvider()
    if (now !== pinned) {
      refuse(A5_G2_SEAM_CODES.IDENTITY_DRIFT, `the pinned real ${kind} provider object is no longer the registered generation; refusing to serve under a stale pin — zero forwarding`, { providerId })
    }
    if (now.id !== providerId) {
      refuse(A5_G2_SEAM_CODES.IDENTITY_DRIFT, `the pinned provider's own id moved (${JSON.stringify(providerId)} declared, ${JSON.stringify(now.id)} live) before the call — zero forwarding`, { providerId })
    }
    if (now[kind] !== pinnedMethod) {
      refuse(A5_G2_SEAM_CODES.IDENTITY_DRIFT, `the ${kind} METHOD identity moved — the live provider.${kind} is no longer the frozen FUNCTION OBJECT the pin was built on (c0e-2: method identity is the JS function, and it changed underneath); zero forwarding`, { providerId })
    }
    if (now.available() !== true) {
      refuse(A5_G2_SEAM_CODES.PROVIDER_UNAVAILABLE, `the pinned real ${kind} provider reports unavailable — the host law makes the configured lane WEB_PROVIDER_CONFIGURED_UNAVAILABLE (web/src/index.ts:180 @639ed01539); the seam mirrors that, it never substitutes`, { providerId })
    }
    // Destination envelope, live, every dispatch (c0e-2): the real
    // factory/config supplies endpointOrigin + immutable configIdentity;
    // origin alone never passes.
    let live
    try {
      live = readMountFacts()
    } catch {
      refuse(A5_G2_SEAM_CODES.MOUNT_FACTS_INCOMPLETE, 'the CURRENT mount-facts reader threw — endpoint/config identity cannot be re-verified for this call; zero forwarding')
    }
    const liveProblem = mountFactsProblem(live, 'the CURRENT mount-facts reader')
    if (liveProblem !== null) refuse(A5_G2_SEAM_CODES.MOUNT_FACTS_INCOMPLETE, `${liveProblem}; zero forwarding`)
    if (live.endpointOrigin !== frozenDeclared.endpointOrigin) {
      refuse(A5_G2_SEAM_CODES.ENDPOINT_DRIFT, `the endpoint origin moved (${JSON.stringify(frozenDeclared.endpointOrigin)} pinned, ${JSON.stringify(live.endpointOrigin)} live) — the frozen destination envelope no longer describes the real one; zero forwarding`)
    }
    if (live.configIdentity !== frozenDeclared.configIdentity) {
      refuse(A5_G2_SEAM_CODES.CONFIG_DRIFT, `the immutable config identity moved (${JSON.stringify(frozenDeclared.configIdentity.slice(0, 24))}… pinned, ${JSON.stringify(live.configIdentity.slice(0, 24))}… live) — the mounted provider config is not the one the envelope was built on; zero forwarding`)
    }
    let destinationOrigin = declaredOrigin
    if (kind === 'fetch') {
      // fetch adds the per-request destination as a REAL REQUEST-PATH fact.
      destinationOrigin = httpOriginOf(request?.url, 'the actual fetch request url', A5_G2_SEAM_CODES.DESTINATION_INVALID)
    }
    const check = binding.verify(request)
    if (check.ok !== true) refuse(A5_G2_SEAM_CODES.ARGUMENTS_REBIND, `${check.detail}; zero forwarding`)
    dispatchCount += 1
    const facts = deepFreeze({
      seam: 'web',
      kind,
      capturedAt: 'provider-dispatch-lease', // inside the host's own selection stack
      providerId,
      destinationOrigin,
      endpointOrigin: live.endpointOrigin,
      configIdentity: live.configIdentity,
      requestFingerprint: binding.fingerprint,
    })
    lastDispatch = facts
    observe({ event: 'dispatch', facts })
    return await pinnedMethod.call(now, request, signal) // the FROZEN function, ORIGINAL request, verbatim
  }

  const available = () => {
    try {
      return getRealProvider() === pinned && pinned.id === providerId && pinned[kind] === pinnedMethod && pinned.available() === true
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
    pinnedMethod: () => pinnedMethod,
    registrationLaw: deepFreeze({
      registerVia: `ctx.web.${kind === 'search' ? 'registerSearchProvider' : 'registerFetchProvider'}(provider) — web/web/src/index.ts:${kind === 'search' ? '103' : '114'} @639ed01539`,
      configuredProviderIdMustEqual: providerId,
      scope: 'Team execution only — the seam registers nothing by itself; a Team assembly effect puts it behind the configured id. A noTeam install registers the raw provider and this module changes NOTHING there (import is inert; leg-proven zero seam effect)',
      law: 'web selection resolves AT EXECUTION TIME: configured id registered+available → this seam; configured id missing → WEB_PROVIDER_CONFIGURED_MISSING; registered but unavailable → WEB_PROVIDER_CONFIGURED_UNAVAILABLE; no id configured with multiple usable → WEB_PROVIDER_AMBIGUOUS (web/src/index.ts:63-72,172-190 @639ed01539) — the law fails CLOSED around the pin; the seam supplies per-lease facts from inside that same stack and substitutes on none of these paths',
    }),
    lastDispatch: () => lastDispatch,
    stats: () => Object.freeze({ dispatchCount, driftRejects }),
  })
}

/* ------------------------------------------------------------------ */
/* MCP seam — owned-provider captured-client execution                 */
/* (root card 2 + re-review 3 + c0e-3).                                */
/* ------------------------------------------------------------------ */

const MCP_METHODS = ['resources/list', 'resources/templates/list', 'resources/read']

/** Full stdio spawn identity (re-review 3): FULL args + cwd, not argv0 only. */
function stdioIdentity (command, cwd) {
  return deepFreeze({ argv0: command[0], args: command.slice(1), cwd: typeof cwd === 'string' ? cwd : '' })
}

/**
 * Build the governed `McpResourceProvider` the connection-OWNING assembly
 * registers via the PUBLIC `McpResourceRuntime.register(server, provider)`
 * (mcp-resources/src/index.ts:80 @639ed01539).
 *
 * c0e-3 — the runtime's own request-time re-selection (index.ts:120-125)
 * picks its OWN client, so forwarding through `provider.request` cannot bind
 * any captured client (claiming otherwise would be a lie, and a self-proving
 * getter string is forbidden). This is the M0 OWNED-provider lane: the
 * connection-owning assembly's `captureConnection` is REQUIRED and must
 * answer the live generation plus the actual CLIENT OBJECT whose `request`
 * IS the generation-specific dispatch. The seam executes ON THAT CAPTURED
 * CLIENT — same generation, same client, by construction, with no
 * re-selection and no unobserved pass-through.
 *
 * @param deps {{
 *   declaredSurfaceConfig: object,           // classified by classifyG2McpSurface
 *   getRealProvider: () => object,           // pins the registered slot's provider generation
 *   captureConnection: () => {transport: string, endpointOrigin?: string,
 *        spawn?: {argv0: string, args: string[], cwd: string},
 *        generation: string, client: {request: Function}},
 *   observe?: (event) => void
 * }}
 */
export function createG2McpProviderSeam ({ declaredSurfaceConfig, getRealProvider, captureConnection, observe = () => {} } = {}) {
  const declared = classifyG2McpSurface(declaredSurfaceConfig)
  if (typeof getRealProvider !== 'function') {
    throw new TypeError(`${A5_G2_SEAM_CODES.ASSEMBLY_FACTS_MISSING}: getRealProvider is required — the seam pins the REAL provider object in the registered slot (its generation, not a re-selection)`)
  }
  if (typeof captureConnection !== 'function') {
    throw new TypeError(`${A5_G2_SEAM_CODES.ASSEMBLY_FACTS_MISSING}: captureConnection is REQUIRED — ${A5_G2_SEAM_NAMED_GAPS.MCP_LIVE_TRANSPORT} (published family blocker: ${A5_G2_NAMED_BLOCKERS.MCP})`)
  }
  const pinned = getRealProvider()
  if (pinned === null || typeof pinned !== 'object') {
    throw new G2SeamError(A5_G2_SEAM_CODES.REAL_PROVIDER_ABSENT, `no real provider object stands behind getRealProvider in the registered slot — refusing to mount a pin around nothing`)
  }
  if (pinned[G2_SEAM_BRAND] === true) {
    throw new G2SeamError(A5_G2_SEAM_CODES.ALREADY_WRAPPED, 'the provider behind getRealProvider is itself a G2 seam — double-wrapping freezes a frozen identity instead of the real one')
  }
  const declaredSpawn = declared.transport === 'stdio'
    ? stdioIdentity(declaredSurfaceConfig.command, declaredSurfaceConfig.cwd)
    : null
  let lastDispatch = null
  let dispatchCount = 0
  let driftRejects = 0
  const refuse = (code, detail, facts) => {
    driftRejects += 1
    observe({ event: 'drift-refusal', server: declared.serverName, code, detail })
    throw new G2SeamError(code, detail, facts)
  }

  /** Validate one capture against completeness law + the declared surface. */
  const checkCapture = (cap) => {
    if (cap === null || typeof cap !== 'object') {
      refuse(A5_G2_SEAM_CODES.CAPTURE_INCOMPLETE, 'captureConnection did not answer a live-connection object — unobserved is NOT a pass (re-review 3); zero forwarding')
    }
    if (typeof cap.generation !== 'string' || cap.generation.length === 0) {
      refuse(A5_G2_SEAM_CODES.CAPTURE_INCOMPLETE, `the live connection carries no generation identity (${JSON.stringify(cap.generation ?? null)}) — a call without a locked generation is refused, not labelled "unobserved" and waved through; zero forwarding`)
    }
    if (cap.client === null || typeof cap.client !== 'object' || typeof cap.client.request !== 'function') {
      refuse(A5_G2_SEAM_CODES.CAPTURE_INCOMPLETE, 'the live connection carries no CLIENT OBJECT with a request() to execute on — c0e-3 binds execution to the captured client; a capture without one is refused, zero forwarding')
    }
    if (cap.transport !== declared.transport) {
      refuse(A5_G2_SEAM_CODES.SURFACE_DRIFT, `the LIVE connection says transport ${JSON.stringify(cap.transport ?? null)}, the declared surface says ${JSON.stringify(declared.transport)}; zero forwarding`)
    }
    if (declared.transport === 'streamable-http' && cap.endpointOrigin !== declared.endpointOrigin) {
      refuse(A5_G2_SEAM_CODES.SURFACE_DRIFT, `the LIVE endpoint ${JSON.stringify(cap.endpointOrigin ?? null)} differs from the classified surface origin ${JSON.stringify(declared.endpointOrigin)} — a re-pointed endpoint is refused, not re-approved silently; zero forwarding`)
    }
    if (declaredSpawn !== null && !sameJson(cap.spawn, declaredSpawn)) {
      refuse(A5_G2_SEAM_CODES.SURFACE_DRIFT, `the LIVE stdio spawn identity (full args + cwd) differs from the classified surface — a re-pointed local command is refused; zero forwarding`)
    }
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
        // CAPTURE ONCE under this lease — generation + the actual client…
        let captured
        try {
          captured = captureConnection()
        } catch {
          refuse(A5_G2_SEAM_CODES.CAPTURE_INCOMPLETE, 'captureConnection threw — the live connection cannot be observed for this call; zero forwarding')
        }
        checkCapture(captured)
        if (declared.connectionIncarnation !== 'unobserved' && captured.generation !== declared.connectionIncarnation) {
          refuse(A5_G2_SEAM_CODES.SURFACE_DRIFT, `the LIVE connection generation ${JSON.stringify(captured.generation)} differs from the declared incarnation ${JSON.stringify(declared.connectionIncarnation)}; zero forwarding`)
        }
        const check = binding.verify(request)
        if (check.ok !== true) refuse(A5_G2_SEAM_CODES.ARGUMENTS_REBIND, `${check.detail}; zero forwarding`)
        // …RE-VERIFY at the execution edge: the SAME generation, the SAME
        // client OBJECT — because execution then happens ON THAT OBJECT,
        // not on a re-selection (c0e-3).
        let recheck
        try {
          recheck = captureConnection()
        } catch {
          refuse(A5_G2_SEAM_CODES.CAPTURE_INCOMPLETE, 'the execution-edge re-capture threw — the captured lease cannot be confirmed at the forward point; zero forwarding')
        }
        if (recheck === null || typeof recheck !== 'object' || recheck.generation !== captured.generation || recheck.client !== captured.client) {
          refuse(A5_G2_SEAM_CODES.SURFACE_DRIFT, `the connection generation/client changed between the capture and the execution edge (generation ${JSON.stringify(captured.generation)} → ${JSON.stringify(recheck?.generation ?? null)}) — the captured lease does not execute on a rotated connection; zero forwarding`)
        }
        dispatchCount += 1
        const facts = deepFreeze({
          seam: 'mcp',
          capturedAt: 'provider-request-lease', // under the SAME lease as the real request
          server: declared.serverName,
          method: request.method,
          transport: declared.transport,
          ...(declared.transport === 'streamable-http' ? { endpointOrigin: declared.endpointOrigin } : { spawn: declaredSpawn }),
          connectionIncarnation: captured.generation,
          executedOn: 'captured-client', // c0e-3: the dispatch IS the captured client's request — no runtime re-selection
          requestFingerprint: binding.fingerprint,
        })
        lastDispatch = facts
        observe({ event: 'dispatch', facts })
        return await captured.client.request(request, exec) // the CAPTURED client executes — same generation, same client
      },
    },
  })

  return Object.freeze({
    provider,
    serverName: declared.serverName,
    declaredSurface: declared,
    registrationLaw: deepFreeze({
      registerVia: 'ctx.mcpResources.register(server, provider) — mcp/mcp-resources/src/index.ts:80 @639ed01539 (public registration face; returns the effect disposer)',
      law: 'the HOST runtime would re-select its own provider/client at request time (index.ts:120-125 @639ed01539) — that path cannot bind a captured client (c0e-3), so this OWNED-lane seam does not use it for execution: the seam was captured-under for THIS exec, and execution happens on the captured client object itself. No Core change; no self-proving getter',
    }),
    lastDispatch: () => lastDispatch,
    stats: () => Object.freeze({ dispatchCount, driftRejects }),
  })
}

/* ------------------------------------------------------------------ */
/* TEAM-OWNED LAUNCH OWNER (c0e-4 — the real deliverable, not a gap).  */
/* ------------------------------------------------------------------ */

/**
 * The REAL launch owner for a Team-owned provider lane, composing the host's
 * own real sequence with the OWNER's rollback law
 * (browser-use-runtime/src/index.ts:23-30 "reject only after rolling back
 * partial acquisition"; the real factory pattern
 * browser-use-stagehand-native/src/index.ts:105-117: launchChromium THEN
 * openBrowserWorker, and on connect failure `await chromium.close()`;
 * native faces: openNativeBrowser native.ts:95, its close() native.ts:86).
 *
 * `open()` resolves an OWNED_SESSION_RESOURCE-shaped handle
 * `{ value, close(): Promise<void> }` (close REQUIRED, :12-18):
 *  1. mode 'launch': `launchOwned()` acquires the owned Chromium process
 *     FIRST (attach skips this stage);
 *  2. `openRuntime(owned)` opens the runtime ON the owned process — the
 *     composition point where a half-open failure must roll back: the
 *     runtime open FAILING ⇒ `launchOwned`'s process is closed before the
 *     rejection escapes (factory-owned half-open cleanup, per contract);
 *  3. `handle.close()` closes runtime THEN owned process, EXACTLY ONCE
 *     (cached), and a throwing close REJECTS and RETAINS — never reports
 *     closed (owner dispose law :131-137).
 *
 * This is what the lease's `openResource` is fed by on the Team lane; the
 * lease owns PA ordering, this owns acquisition + rollback + close.
 *
 * @param deps {{
 *   mode: 'launch'|'attach',
 *   launchOwned?: () => Promise<{close: () => unknown}>,   // required for 'launch'
 *   openRuntime: (owned) => Promise<{close: () => unknown}>,
 *   observe?: (event) => void
 * }}
 */
export function createG2BrowserLaunchOwner ({ mode, launchOwned, openRuntime, observe = () => {} } = {}) {
  if (mode !== 'launch' && mode !== 'attach') {
    throw new TypeError(`${A5_G2_SEAM_CODES.ASSEMBLY_FACTS_MISSING}: mode must be 'launch' or 'attach' (NativeBrowserConfig.mode @browser-use-stagehand-native native.ts:38)`)
  }
  if (typeof openRuntime !== 'function') {
    throw new TypeError(`${A5_G2_SEAM_CODES.ASSEMBLY_FACTS_MISSING}: openRuntime is required — the runtime open (the native face is openNativeBrowser, browser-use-stagehand-native/src/native.ts:95 @639ed01539) that runs on the owned process`)
  }
  if (mode === 'launch' && typeof launchOwned !== 'function') {
    throw new TypeError(`${A5_G2_SEAM_CODES.ASSEMBLY_FACTS_MISSING}: launchOwned is required under 'launch' — the owned-Chromium acquisition the host pattern does FIRST (browser-use-stagehand-native/src/index.ts:105 launchChromium @639ed01539)`)
  }
  const log = []
  let opens = 0

  const open = async () => {
    opens += 1
    let owned = null
    if (mode === 'launch') {
      log.push('owner:launch')
      owned = await launchOwned()
      if (owned === null || typeof owned !== 'object' || typeof owned.close !== 'function') {
        log.push('owner:launch-breach')
        throw new G2SeamError(A5_G2_SEAM_CODES.OPEN_CONTRACT_BREACH, 'launchOwned resolved without a close()able process handle — nothing further may be acquired on top of a resource nobody can close')
      }
    }
    let runtime
    try {
      log.push('owner:runtime')
      runtime = await openRuntime(owned)
    } catch (cause) {
      // Factory-owned HALF-OPEN cleanup (owner contract :23-30; the real
      // factory does exactly this at stagehand-native index.ts:117): a
      // failed runtime open must roll back the already-acquired process
      // BEFORE the rejection escapes.
      if (owned !== null) {
        log.push('owner:rollback')
        try {
          await owned.close()
          log.push('owner:rolled-back')
        } catch (rollbackError) {
          log.push('owner:rollback-failed')
          observe({ event: 'rollback-failed', detail: String(rollbackError?.message ?? rollbackError) })
          throw new G2SeamError(A5_G2_SEAM_CODES.CLOSE_FAILED, `open failed (${String(cause?.message ?? cause).slice(0, 120)}) AND the half-open rollback ALSO failed (${String(rollbackError?.message ?? rollbackError).slice(0, 120)}) — the owned process is RETAINED, not dropped`, { mode })
        }
      }
      if (cause instanceof G2SeamError) throw cause
      throw new G2SeamError(A5_G2_SEAM_CODES.LAUNCH_FAILED, `${mode} open failed after full rollback (cause: ${String(cause?.message ?? cause).slice(0, 160)}) — a rejected acquisition leaves NO remaining resource (owner :174); a retry is a NEW open`, { mode })
    }
    if (runtime === null || typeof runtime !== 'object' || typeof runtime.close !== 'function') {
      if (owned !== null) {
        log.push('owner:rollback')
        try {
          await owned.close()
          log.push('owner:rolled-back')
        } catch {
          log.push('owner:rollback-failed')
        }
      }
      throw new G2SeamError(A5_G2_SEAM_CODES.OPEN_CONTRACT_BREACH, 'openRuntime resolved without an OwnedSessionResource-shaped handle (close REQUIRED, browser-use-runtime index.ts:12-18 @639ed01539)')
    }
    log.push('owner:ready')
    let closing = null
    return Object.freeze({
      value: runtime,
      close: () => {
        if (closing !== null) return closing // EXACTLY once (cached, like the owner's entry.closing ??=)
        closing = (async () => {
          log.push('owner:close')
          const failures = []
          try {
            await runtime.close()
          } catch (error) {
            failures.push(`runtime: ${String(error?.message ?? error).slice(0, 120)}`)
          }
          if (owned !== null) {
            try {
              await owned.close()
            } catch (error) {
              failures.push(`owned: ${String(error?.message ?? error).slice(0, 120)}`)
            }
          }
          if (failures.length > 0) {
            log.push('owner:close-failed')
            // Owner dispose law :131-137 — failed close RETAINS and REJECTS.
            throw new G2SeamError(A5_G2_SEAM_CODES.CLOSE_FAILED, `close FAILED (${failures.join(' | ')}) — the handle is RETAINED and disposal REJECTED; never reported closed`)
          }
          log.push('owner:closed')
        })()
        return closing
      },
    })
  }

  return Object.freeze({
    open,
    opens: () => opens,
    order: () => Object.freeze([...log]),
    ownerSemantics: 'Team-owned launch owner (c0e-4): launchOwned FIRST (host pattern index.ts:105), openRuntime SECOND (native.ts:95 face), connect failure ⇒ await launchOwned.close() BEFORE rejecting (host index.ts:117; owner contract :23-30); handle.close() closes runtime then process EXACTLY ONCE and a throwing close RETAINS + REJECTS CLOSE_FAILED (:131-137) — no fake closed',
  })
}

/* ------------------------------------------------------------------ */
/* BROWSER seam — governed resource LEASE (card 3 + re-review 1 +      */
/* c0e-1). openResource is fed by createG2BrowserLaunchOwner on the    */
/* Team lane (c0e-4).                                                  */
/* ------------------------------------------------------------------ */

/**
 * The governed browser resource lease, written to the OWNER's real contract
 * (browser-use-runtime/src/index.ts @639ed01539 — quoted in this file's
 * header). Highlights:
 *  · PA edge before launch: `openResource` is STRUCTURALLY unreachable
 *    until consumeApproval answers 'consumed' for THIS call.
 *  · A PENDING launch counts in the in-flight set the moment it starts
 *    (owner: entries.set happens with `ready` pending, :181); drain awaits
 *    it, and a launch arriving after the drain began CLOSES ITSELF
 *    (owner closeEntry: the close sequence awaits the pending open and
 *    closes whatever arrives, :186-197) — CLOSED is terminal, no
 *    resurrection. c0e-1: if that late close FAILS, the late handle is
 *    RETAINED and the SAME drainPromise REJECTS with CLOSE_FAILED — the
 *    failure is never swallowed and the lease never reports 'closed'.
 *  · close is REQUIRED on the handle (owner OwnedSessionResource, :12-18);
 *    a handle without close is OPEN_CONTRACT_BREACH and the lease never
 *    becomes active; a close that THROWS retains the entry and rejects with
 *    CLOSE_FAILED (owner dispose law, :131-137) — never a fake 'closed'.
 *  · Failed open rollback is the FACTORY's contract ("reject only after
 *    rolling back partial acquisition", :23-30, :174 — the Team lane's
 *    factory IS createG2BrowserLaunchOwner above, which performs it); the
 *    lease deletes its entry and surfaces LAUNCH_FAILED; a retry is a NEW
 *    call re-consuming PA.
 *
 * @param deps {{
 *   mode: 'launch'|'attach',
 *   openResource: (ctx) => Promise<object>, // handle MUST carry close()
 *   consumeApproval: (callFacts) => Promise<'consumed'|'refused'|'unavailable'> | 'consumed'|'refused'|'unavailable',
 *   launchEnvelope?: object,
 *   observe?: (event) => void
 * }}
 */
export function createG2BrowserResourceLease ({ mode, openResource, consumeApproval, launchEnvelope, observe = () => {} } = {}) {
  if (mode !== 'launch' && mode !== 'attach') {
    throw new TypeError(`${A5_G2_SEAM_CODES.ASSEMBLY_FACTS_MISSING}: mode must be 'launch' or 'attach' (stagehand Config.mode @639ed01539)`)
  }
  if (typeof openResource !== 'function') {
    throw new TypeError(`${A5_G2_SEAM_CODES.ASSEMBLY_FACTS_MISSING}: openResource is required — the Team lane feeds the REAL launch owner's open (createG2BrowserLaunchOwner, c0e-4); this lease sequences it AFTER the PA edge`)
  }
  if (typeof consumeApproval !== 'function') {
    throw new TypeError(`${A5_G2_SEAM_CODES.ASSEMBLY_FACTS_MISSING}: consumeApproval is required — the PA consumption edge the lease runs BEFORE any ${mode}`)
  }
  const envelope = launchEnvelope === undefined ? null : deepFreeze(jsonClone(launchEnvelope))
  const log = []
  const inflight = new Set() // EVERY promise this lease started: pending launches AND work
  const retained = [] // handles that could NOT be closed — never dropped (c0e-1)
  let lateCloseFailure = null // a late arrival whose close failed during drain
  let state = 'idle' // idle | launching | active | draining | failed | close-failed | closed
  let resource = null
  let init = null
  let drainPromise = null
  let paDecisions = 0
  let paRefusals = 0
  let launchCount = 0
  let closeCount = 0

  const tracked = (promise) => {
    inflight.add(promise)
    // Owner idiom :180 — the lease keeps tracking settlement even when no
    // caller is watching (a swallowed rejection must not strand the set).
    void promise.catch(() => {}).then(() => { inflight.delete(promise) })
    return promise
  }

  const closeHandle = async (handle, why) => {
    // close is REQUIRED by the owner contract; a non-callable close here is
    // itself a breach and must surface, never resolve quietly.
    if (typeof handle.close !== 'function') {
      throw new G2SeamError(A5_G2_SEAM_CODES.OPEN_CONTRACT_BREACH, `the handle carries no close() (owner OwnedSessionResource requires it, browser-use-runtime index.ts:12-18 @639ed01539) — the resource is retained, NOT reported closed (${why})`)
    }
    closeCount += 1
    log.push('resource:close')
    await handle.close()
  }

  const ensure = async () => {
    if (init === null) {
      launchCount += 1
      state = 'launching'
      log.push(`lease:launch:${mode}`)
      // The PENDING launch is counted the moment it starts — a pending
      // launch is an in-flight launch (owner: the entry exists with `ready`
      // pending, :181).
      init = tracked((async () => {
        let opened
        try {
          opened = await openResource({ mode, envelope })
        } catch (cause) {
          // Owner contract: open() owns partial-acquisition rollback
          // (:23-30, :174) — the Team lane's open IS createG2BrowserLaunchOwner,
          // which rolled back (or retained and said so); on rejection nothing
          // further remains for the lease to close.
          log.push('lease:launch-failed')
          state = 'failed'
          init = null
          if (cause instanceof G2SeamError) throw cause
          throw new G2SeamError(A5_G2_SEAM_CODES.LAUNCH_FAILED, `${mode} failed under the lease (cause: ${String(cause?.message ?? cause).slice(0, 160)}); the launch owner owns rollback, so a rejected acquisition leaves NO remaining resource — a retry is a NEW call re-consuming PA`, { mode })
        }
        if (opened === null || typeof opened !== 'object') {
          log.push('lease:launch-failed')
          state = 'failed'
          init = null
          throw new G2SeamError(A5_G2_SEAM_CODES.OPEN_CONTRACT_BREACH, `the ${mode} factory resolved without an OwnedSessionResource-shaped handle (owner contract {value, close()} @browser-use-runtime index.ts:12-18 @639ed01539)`)
        }
        if (typeof opened.close !== 'function') {
          // Factory-failure HALF-OPEN cleanup per the OWNER's contract:
          // open promised rollback on rejection; here it RESOLVED a
          // non-closable handle — a breach the lease cannot roll back (no
          // close exists). The entry is RETAINED (close-failed), never
          // swallowed into 'closed'.
          log.push('lease:open-contract-breach')
          state = 'close-failed'
          retained.push(opened)
          init = Promise.resolve(opened)
          drainPromise = Promise.reject(new G2SeamError(A5_G2_SEAM_CODES.CLOSE_FAILED, 'the retained handle has no close() — disposal is REJECTED per the owner dispose law (:131-137 @639ed01539); the lease never reports closed'))
          void drainPromise.catch(() => {}) // the rejection stays observable, never unhandled
          throw new G2SeamError(A5_G2_SEAM_CODES.OPEN_CONTRACT_BREACH, `the ${mode}ed handle carries no close() (owner OwnedSessionResource, :12-18 @639ed01539) — the lease cannot close what it cannot call; the handle is retained and the lease moved to close-failed, never active`)
        }
        if (state === 'draining' || state === 'closed' || state === 'close-failed') {
          // A late arrival after the drain began CLOSES ITSELF and is never
          // handed out (owner closeEntry: the close sequence awaits the
          // pending open and closes whatever arrives, :186-197). If that
          // late close FAILS (c0e-1): RETAIN the handle, remember the
          // failure so the drainPromise rejects CLOSE_FAILED, and refuse
          // the caller — never drop the resource, never fake closed.
          log.push('resource:late-close')
          try {
            await closeHandle(opened, 'late arrival after drain')
          } catch (closeError) {
            retained.push(opened)
            lateCloseFailure = String(closeError?.message ?? closeError)
            state = 'close-failed'
            log.push('resource:late-close-failed')
            observe({ event: 'late-close-failed', detail: lateCloseFailure })
            init = null
            throw new G2SeamError(A5_G2_SEAM_CODES.LEASE_CLOSED, `the ${mode} completed after the lease had begun closing and its late close FAILED (${lateCloseFailure.slice(0, 120)}) — the handle is RETAINED and the drain rejects CLOSE_FAILED; the lease never reports closed`)
          }
          init = null
          throw new G2SeamError(A5_G2_SEAM_CODES.LEASE_CLOSED, `the ${mode} completed after the lease had begun closing — the late-arriving resource closed itself and was never handed out; CLOSED is terminal`)
        }
        log.push('lease:ready')
        return opened
      })())
    }
    const opened = await init
    resource = opened
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
    if (state === 'draining') throw new G2SeamError(A5_G2_SEAM_CODES.LEASE_DRAINING, 'the lease is draining — no new run enters; in-flight work AND pending launches are awaited, not killed')
    if (state === 'closed') throw new G2SeamError(A5_G2_SEAM_CODES.LEASE_CLOSED, 'the lease is closed and its resource disposed — CLOSED is terminal; a new lifecycle is a new lease, never a resurrection')
    if (state === 'close-failed') throw new G2SeamError(A5_G2_SEAM_CODES.LEASE_CLOSED, 'a prior close/open-contract failure RETAINS this entry (owner dispose law: a failed close rejects disposal and preserves exclusive ownership, browser-use-runtime index.ts:131-137 @639ed01539) — the lease stays refused, never silently reused')
    const facts = deepFreeze(jsonClone({ mode, envelope, ...(callFacts === null || typeof callFacts !== 'object' ? {} : callFacts) }))
    const decision = await consumeApproval(facts)
    paDecisions += 1
    log.push(`lease:pa:${String(decision)}`)
    if (decision !== 'consumed') {
      paRefusals += 1
      observe({ event: 'pa-refusal', decision })
      throw new G2SeamError(A5_G2_SEAM_CODES.PA_NOT_CONSUMED, `the PA edge answered ${JSON.stringify(String(decision))} for this call — under ${mode} mode NOTHING launched and NOTHING attached; a later retry is a new call with a fresh PA consumption`, { mode, decision: String(decision) })
    }
    // Re-verify AFTER the awaited edge: drain/close/close-fail may have
    // begun WHILE the PA edge was in flight — same lease, honoured.
    if (state === 'draining') throw new G2SeamError(A5_G2_SEAM_CODES.LEASE_DRAINING, 'drain began while the PA edge was in flight — the consumed call does not enter a draining lease')
    if (state === 'closed' || state === 'close-failed') throw new G2SeamError(A5_G2_SEAM_CODES.LEASE_CLOSED, 'the lease closed (or close failed and retained the entry) while the PA edge was in flight')
    const opened = await ensure()
    const task = tracked((async () => {
      log.push('lease:work:enter')
      try {
        return await work(opened, signal)
      } finally {
        log.push('lease:work:settle')
      }
    })())
    return await task
  }

  /**
   * Real drain per the owner's dispose law: stop admission, await EVERY
   * promise the lease started (work AND pending launches — the inflight
   * set), close exactly once after quiescence; ANY failed close — of the
   * settled resource OR of a late arrival whose close threw during the wait
   * (c0e-1) — RETAINS the handle and rejects THIS drainPromise with
   * CLOSE_FAILED (cached, like the owner's `disposing ??=`).
   */
  const drain = () => {
    if (drainPromise !== null) return drainPromise
    drainPromise = (async () => {
      if (state === 'closed') return snapshot()
      state = 'draining'
      log.push('lease:drain')
      while (inflight.size > 0) await Promise.allSettled([...inflight])
      // A late arrival whose close failed during the wait (allSettled does
      // NOT swallow it into silence — c0e-1): the handle is retained above,
      // the drain REJECTS, the lease never reports closed.
      if (lateCloseFailure !== null) {
        log.push('lease:close-failed')
        throw new G2SeamError(A5_G2_SEAM_CODES.CLOSE_FAILED, `a late-arriving resource could not be closed (${lateCloseFailure.slice(0, 160)}) — the handle is RETAINED and disposal REJECTED (owner dispose law :131-137 @639ed01539); the lease never reports closed`)
      }
      if (resource !== null) {
        const closing = resource
        try {
          await closeHandle(closing, 'drain')
        } catch (error) {
          // Owner law :131-137 — failed close RETAINS the entry and rejects
          // disposal. Honest state, honest rejection, no fake 'closed'.
          state = 'close-failed'
          retained.push(closing)
          log.push('resource:close-failed')
          observe({ event: 'close-failed', detail: String(error?.message ?? error) })
          if (error instanceof G2SeamError) throw error
          throw new G2SeamError(A5_G2_SEAM_CODES.CLOSE_FAILED, `close() THREW (${String(error?.message ?? error).slice(0, 160)}) — the entry is RETAINED and disposal REJECTED; the lease never reports closed`)
        }
        resource = null
      }
      state = 'closed'
      log.push('lease:closed')
      return snapshot()
    })()
    return drainPromise
  }

  const snapshot = () => Object.freeze({
    state,
    mode,
    drainSemantics: A5_G2_LEASE_DRAIN_SEMANTICS,
    paDecisions,
    paRefusals,
    launchCount,
    closeCount,
    retainedUnclosed: retained.length,
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
      launchFactory: 'openResource is the TEAM-OWNED LAUNCH OWNER\'s open — createG2BrowserLaunchOwner in this file composes the real faces (openNativeBrowser native.ts:95, close native.ts:86) with factory-owned half-open rollback (host pattern index.ts:105-117); the lease sequences it and never launches anything itself. RESIDUAL host-lane gap only: ' + A5_G2_SEAM_NAMED_GAPS.LAUNCH_OWNER,
      drain: A5_G2_LEASE_DRAIN_SEMANTICS,
      ownerContract: 'browser-use-runtime/src/index.ts @639ed01539 — OwnedSessionResource.close REQUIRED (:12-18); open owns partial-acquisition rollback (:23-30,:174); a pending open counts as the entry (:181) and closeEntry awaits AND CLOSES it (:186-197); a failed close retains the entry and REJECTS disposal (:131-137) — including a late arrival whose close fails (c0e-1): retained, drain rejects, never fake closed',
    }),
  })
}

/* ------------------------------------------------------------------ */
/* Consumption-edge enforcement (root card 4).                          */
/* ------------------------------------------------------------------ */

/**
 * Enforce the FROZEN actualArgs binding AT THE REAL CONSUMPTION EDGE.
 * `plan` is the previously-PRODUCED (and, in the lane, PA-approved) plan
 * from a g2-connector row; `args` are the live arguments about to be
 * consumed. Before ANY native entry this checks, fail-closed:
 *  1. the live args still deep-equal the plan's frozen actualArgs snapshot;
 *  2. a fresh pure classify of the live args reproduces the plan's exact
 *     parametersFingerprint (also catches CURRENT-facts movement);
 *  3. only then delegates to row.invoke(args, exec), handing the ORIGINAL
 *     args object to the row.
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
    return { ok: false, code: A5_G2_SEAM_CODES.ARGS_REBOUND, detail: 'a fresh classify of the SAME args now produces a DIFFERENT fingerprint than the approved plan — the classify-time facts moved (provider/destination rotation) since approval; the frozen facts bind at the edge, not the plan alone; zero native entry' }
  }
  return await row.invoke(args, exec) // ORIGINAL args object, identity preserved
}
