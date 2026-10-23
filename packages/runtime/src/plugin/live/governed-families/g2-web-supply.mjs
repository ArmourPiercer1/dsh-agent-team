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
