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
  disposers.push(web.registerFetchProvider(fetchProvider))
  if (searchProvider !== null && searchProvider !== undefined) {
    if (typeof web.registerSearchProvider !== 'function') {
      for (const dispose of disposers) { try { dispose() } catch { /* best-effort unwind */ } }
      refuse(A5_G2_WEB_CODES.SERVICE_ABSENT, 'a search provider was supplied but the service answers no PUBLIC registerSearchProvider — unwound what registered, nothing stays half-mounted')
    }
    disposers.push(web.registerSearchProvider(searchProvider))
  }
  let done = false
  return Object.freeze({
    ids: Object.freeze([fetchProvider.id, ...(searchProvider === null || searchProvider === undefined ? [] : [searchProvider.id])]),
    dispose: () => {
      if (done) return false
      done = true
      for (const dispose of disposers.splice(0).reverse()) { try { dispose() } catch { /* host disposer */ } }
      return true
    },
  })
}
