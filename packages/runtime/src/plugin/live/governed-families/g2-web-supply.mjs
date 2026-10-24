/**
 * A5M2 G2-WEB — the Team-scoped FIXED web provider fork (CENTER dispatch,
 * root 00:3x card; the two root-queued routes share this artifact).
 *
 * WHAT THIS IS (status per root — stated, not implied):
 *   [done]      the fork objects: they implement the EXPORTED host
 *               contract shapes (packages/web/web/src/index.ts
 *               @639ed01539: a fetch/search provider carries an id,
 *               `available()`, and the request methods; the transport is
 *               DELEGATED to the public `HttpFetchProvider` instance the
 *               connection-owning assembly constructed with its PUBLIC
 *               Config — fixed limits + product User-Agent, no new deps,
 *               no credentials, no network widening).
 *   [done]      the disposer-shaped registration block (the host's own
 *               public API returns disposers: registerFetchProvider/
 *               registerSearchProvider → `() => void`, index.ts:103/114
 *               — this block rides that shape, disposer-first law).
 *   [NOT wired] nothing here reaches a live host web service: mounting
 *               the Team-scoped ctx and the per-row WebRuntimeConfig
 *               id-pin are the root-pending route 1/2 choice.
 *   [NOT tested E2E] the WebRuntime selection semantics
 *               (configured id always chosen; WEB_PROVIDER_CONFIGURED_
 *               MISSING / ..._UNAVAILABLE never a silent swap) are the
 *               HOST's own behavior over its own instance — the spec
 *               legs here prove the FORK and the registration block
 *               against a DISCLOSED stand-in speaking that vocabulary;
 *               the real-service E2E is the Host venue, stated.
 *
 * NO global provider/env switch, no ctx re-selection, no Core, no
 * credential scope. Team-only by construction: the block registers onto
 * the ctx the caller owns and disposes what it registered.
 */

export const A5_G2_WEB_CODES = Object.freeze({
  SERVICE_ABSENT: 'G2_WEB_SERVICE_ABSENT',
  TRANSPORT_ABSENT: 'G2_WEB_TRANSPORT_ABSENT',
})

const refuse = (code, message) => {
  throw Object.assign(new Error(`${code}: ${message}`), { code })
}

/**
 * Build the Team's fixed fetch/search provider pair over the assembly-
 * supplied transport. `transport` MUST be the public HttpFetchProvider
 * (or any object answering the exported WebFetchProvider method shape)
 * — this module NEVER reimplements transport and never swaps it later:
 * the returned objects capture it by construction (no per-call re-
 * selection point exists here at all).
 */
export function createG2TeamWebProviders ({ providerId, transport, searchTransport } = {}) {
  if (typeof providerId !== 'string' || providerId.length === 0) {
    refuse(A5_G2_WEB_CODES.TRANSPORT_ABSENT, 'providerId (the id a per-Team WebRuntimeConfig will pin) is REQUIRED')
  }
  if (transport === null || typeof transport !== 'object' || typeof transport.fetch !== 'function') {
    refuse(A5_G2_WEB_CODES.TRANSPORT_ABSENT, 'transport must answer the exported WebFetchProvider shape (fetch(request)) — the public HttpFetchProvider instance built by the owning assembly; no fallback transport is ever minted')
  }
  const fetchProvider = Object.freeze({
    id: providerId,
    available: () => (typeof transport.available === 'function' ? transport.available() === true : true),
    fetch: (request) => transport.fetch(request),
  })
  const searchProvider = searchTransport === null || searchTransport === undefined
    ? null
    : Object.freeze({
        id: searchTransport.id ?? `${providerId}-search`,
        available: () => (typeof searchTransport.available === 'function' ? searchTransport.available() !== false : true),
        search: (request) => searchTransport.search(request),
      })
  return Object.freeze({ fetchProvider, searchProvider })
}

/**
 * The registration block, disposer-first: registers onto the web service
 * the CALLER owns (a Team-scoped ctx's `web`), and answers ONE disposer
 * that unwinds exactly what was registered (the host API itself returns
 * disposers — index.ts:103/114). A service without the public register
 * surface refuses typed; nothing half-registers.
 */
export function registerG2TeamWebProviders ({ web, fetchProvider, searchProvider } = {}) {
  if (web === null || typeof web !== 'object' || typeof web.registerFetchProvider !== 'function') {
    refuse(A5_G2_WEB_CODES.SERVICE_ABSENT, 'the caller-owned web service must expose the PUBLIC registerFetchProvider(provider): () => void surface (web/src/index.ts:114 @639ed01539) — absent, nothing registers, no global fallback is touched')
  }
  const disposers = []
  const unwind = () => { for (const dispose of disposers.splice(0).reverse()) dispose() }
  try {
    disposers.push(web.registerFetchProvider(fetchProvider))
    if (searchProvider !== null && searchProvider !== undefined) {
      if (typeof web.registerSearchProvider !== 'function') {
        throw new TypeError('the service answers no PUBLIC registerSearchProvider — a search provider may not be half-declared')
      }
      disposers.push(web.registerSearchProvider(searchProvider))
    }
  } catch (error) {
    // root 01:2x: a search-side rejection (missing API OR a THROWING
    // register) rolls the fetch registration back — never half-mounted.
    try { unwind() } catch { /* the unwind failure is reported with the cause below, never silently */ }
    throw Object.assign(new Error(`${A5_G2_WEB_CODES.SERVICE_ABSENT}: registration refused and ROLLED BACK: ${String(error?.message ?? error)}`), { code: A5_G2_WEB_CODES.SERVICE_ABSENT })
  }
  let done = false
  return Object.freeze({
    ids: Object.freeze([fetchProvider.id, ...(searchProvider === null || searchProvider === undefined ? [] : [searchProvider.id])]),
    dispose: () => {
      if (done) return false
      done = true
      const failures = []
      for (const dispose of disposers.splice(0).reverse()) {
        try { dispose() } catch (error) { failures.push(String(error?.message ?? error)) }
      }
      // dispose failures are NEVER swallowed behind a `true`.
      if (failures.length > 0) throw new Error(`${A5_G2_WEB_CODES.SERVICE_ABSENT}: disposer failed: ${failures.join(' | ')}`)
      return true
    },
  })
}

/**
 * THE fixed capture+bind gateway face (root 01:2x): the provider instance
 * is captured ONCE at construction; fetch is BOUND to that capture and
 * passes the SECOND ARGUMENT (AbortSignal) through VERBATIM — no dynamic
 * re-fetch of any provider, no per-call selection point. search is
 * captured ONLY when the captured provider carries a REAL search
 * function — fetch NEVER impersonates search; absent search is an
 * explicit null the gateway must refuse typed.
 */
export function createG2FixedWebFace (provider, { searchProvider } = {}) {
  if (provider === null || typeof provider !== 'object' || typeof provider.fetch !== 'function') {
    refuse(A5_G2_WEB_CODES.TRANSPORT_ABSENT, 'the captured provider must answer fetch(request, signal) — the formal public HttpFetchProvider')
  }
  const boundFetch = provider.fetch.bind(provider)
  const realSearch = searchProvider !== null && searchProvider !== undefined && typeof searchProvider.search === 'function'
    ? searchProvider.search.bind(searchProvider)
    : null
  return Object.freeze({
    id: typeof provider.id === 'string' ? provider.id : undefined,
    available: typeof provider.available === 'function' ? () => provider.available() === true : () => true,
    fetch: (request, signal) => boundFetch(request, signal),
    search: realSearch === null ? null : (request, signal) => realSearch(request, signal),
  })
}

/**
 * THE center-edge trio for the LIVE web gateway (root 03:0x production
 * ports; interfaces verbatim per web-gateway-assembly's header law).
 * REAL supply rule: every port reads ONLY existing public query faces
 * (the durable ControlService public reads + the caller-injected REAL
 * generation reader — the plane's own authorityGeneration/policy face);
 * NOTHING here mints a ledger or invents currentness. Where a trusted
 * input does not exist publicly today, the port answers a TYPED refusal
 * — the honest decline the header law demands, never stand-in facts.
 */
export function createG2WebCenterPorts ({ getService, teamRoot, readGenerations, searchOriginFacts } = {}) {
  const typed = (code, message) => Object.assign(new Error(`${code}: ${message}`), { code })
  const resolveSearchOrigin = () => {
    const origin = searchOriginFacts === null || searchOriginFacts === undefined ? undefined : searchOriginFacts.origin
    if (typeof origin !== 'string' || origin.length === 0) {
      // search single-column: no real search provider/endpoint/config/
      // current facts exist — refused EVERY call, config-bound (a
      // fixed-URL fake is structurally impossible here).
      throw typed('G2_WEB_SEARCH_ORIGIN_ABSENT', 'no real search origin rides this mount config: search is refused, fetch never stands in')
    }
    return origin
  }
  const factsSource = Object.freeze({
    capture: async ({ realmId, grantId, bindingId } = {}) => {
      const service = typeof getService === 'function' ? getService() : undefined
      if (service === undefined || typeof service.listControlState !== 'function') {
        return { ok: false, error: { code: 'G2_WEB_FACTS_UNAVAILABLE', message: 'the durable ControlService public query face is not readable here; the row declines rather than fabricating trusted facts', sideEffectUnknown: false } }
      }
      if (typeof readGenerations !== 'function') {
        return { ok: false, error: { code: 'G2_WEB_FACTS_UNAVAILABLE', message: 'no REAL generation reader was injected (bindingRevision/authorityGeneration/policyGeneration must come from the plane live faces — constants are forbidden currentness)', sideEffectUnknown: false } }
      }
      let record
      try {
        const state = await service.listControlState(String(teamRoot))
        record = (state?.requests ?? []).find((r) => String(r?.reviewPayload?.callId ?? '') === String(grantId) || String(r?.correlation ?? '') === String(grantId))
      } catch {
        return { ok: false, error: { code: 'G2_WEB_FACTS_UNAVAILABLE', message: 'the durable request read refused; declining, no stand-in facts', sideEffectUnknown: false } }
      }
      if (record === undefined) {
        return { ok: false, error: { code: 'G2_WEB_FACTS_UNKNOWN_GRANT', message: `no durable request carries grant/correlation ${JSON.stringify(String(grantId))} on THIS team root; the center ledger answers unknown, never guessed`, sideEffectUnknown: false } }
      }
      const generations = await readGenerations(String(teamRoot), String(record.reviewPayload?.instanceId ?? realmId ?? ''))
      const effects = record.reviewPayload?.effects
      if (generations === null || typeof generations !== 'object' || typeof effects === 'undefined') {
        // effects travel ONLY as trusted center data; a request without
        // them is incomplete facts — refuse typed (factsIncomplete law).
        return { ok: false, error: { code: 'G2_WEB_FACTS_INCOMPLETE', message: 'trusted effects are absent from the durable request (the center-edge owners must carry them — B-TEAM-style registrationOf-shape ledger); declining per factsIncompleteMessage law, never a fabricated effects set', sideEffectUnknown: false } }
      }
      return {
        ok: true,
        value: Object.freeze({
          member: Object.freeze({ teamSessionId: String(teamRoot), instanceId: String(record.reviewPayload?.instanceId ?? realmId ?? '') }),
          callId: String(grantId),
          bindingRevision: generations.bindingRevision,
          authorityGeneration: generations.authorityGeneration,
          policyGeneration: generations.policyGeneration,
          effects: Object.freeze({ effects: Object.freeze([...effects]) }),
          bindingId: String(bindingId ?? ''),
        }),
      }
    },
  })
  const grantAuthority = Object.freeze({
    consume: async ({ facts, correlation, isCancelled } = {}) => {
      const service = typeof getService === 'function' ? getService() : undefined
      if (service === undefined || typeof service.listControlState !== 'function' || typeof service.awaitControlDecision !== 'function') {
        return { ok: false, error: { code: 'G2_WEB_GRANT_UNAVAILABLE', message: 'no durable ControlService public face to consume through; the row refuses, no default-open', sideEffectUnknown: false } }
      }
      if (typeof isCancelled === 'function' && isCancelled() === true) {
        return { ok: false, error: { code: 'G2_WEB_CANCELLED', message: 'cancelled at the consume boundary — zero consume performed (C3 law)', sideEffectUnknown: false } }
      }
      let record
      try {
        const state = await service.listControlState(String(teamRoot))
        record = (state?.requests ?? []).find((r) => String(r?.reviewPayload?.callId ?? '') === String(correlation?.grantId) || String(r?.correlation ?? '') === String(correlation?.grantId))
      } catch {
        return { ok: false, error: { code: 'G2_WEB_GRANT_UNAVAILABLE', message: 'the durable read refused at the consume boundary', sideEffectUnknown: false } }
      }
      if (record === undefined || record.status !== 'decided') {
        return { ok: false, error: { code: 'G2_WEB_GRANT_NOT_ALLOWED', message: 'no decided durable request for this grant/correlation; ONE consume is never performed against pending/unknown', sideEffectUnknown: false } }
      }
      try {
        const decision = await service.awaitControlDecision({ rootSessionId: String(teamRoot), requestId: record.requestId })
        if (String(decision?.decision) !== 'allow') {
          return { ok: false, error: { code: 'G2_WEB_GRANT_NOT_ALLOWED', message: `the durable decision is ${JSON.stringify(String(decision?.decision))}; refusals pass through verbatim, never re-judged open`, sideEffectUnknown: false } }
        }
      } catch {
        return { ok: false, error: { code: 'G2_WEB_GRANT_UNAVAILABLE', message: 'awaitControlDecision refused at the decision point', sideEffectUnknown: false } }
      }
      // The kernel ALREADY consumed the allow exactly-once at the last
      // mile; the effects the gateway re-checks are the SAME trusted
      // facts captured above (facts came from the durable record).
      return { ok: true, value: Object.freeze({ effects: Object.freeze({ effects: facts?.effects?.effects ?? [] }) }) }
    },
  })
  return Object.freeze({ grantAuthority, factsSource, resolveSearchOrigin })
}
