/**
 * a5sf-web-transport.mjs — the COMPOSITION-OWNED web transport of a governed
 * Member's network face (PD-30, 2026-11-15).
 *
 * WHY THIS MODULE EXISTS. PD-27 put the model-visible `web_fetch`/`web_search`
 * names back on the governed preset and routed them through the Member's
 * confined `web` face, but the FACE had no transport: `a5sf-pd27-web-offer-row`
 * — a TEST driver row — supplied the compiled realm answer, and the boot driver
 * rewrote the preset's row name to a file URL. So the shipped product could
 * describe a governed network call and could not serve one. This module is the
 * missing half: a SHIPPED row that owns the transport, provides it as the
 * optional `teamA5sfWebTransport` service, and is read by the SAME product row
 * that reads `teamA5sfRealm` (`host.ts` → `createGovernedRealmProvider`). With
 * it installed, `a5sfGovernedRealm: true` yields a realm whose `web` face is the
 * confined face over a real transport — no driver row, no file URL, no rewrite.
 *
 * WHAT IT SUPPLIES, AND FROM WHERE. The transport is the PINNED HOST'S OWN
 * providers, loaded by their public package names (declared as `dependencies`
 * of this repository, never as peers — the audited host-provides contract stays
 * at its ten names):
 *
 *   fetch   `@deepseek-ai/dsh-web-fetch-http` `HttpFetchProvider`
 *   search  `@deepseek-ai/dsh-web-search-exa`  `ExaSearchProvider`
 *
 * Nothing here re-implements HTTP, parsing, redirect policy or a search API
 * shape: it constructs the host class and hands the confined face the
 * `{ fetch, search }` object the face already documents. The face decides
 * ADMISSION (one compiled lane, one fact per call, SSRF/request-shape legs);
 * this provider only runs the call that was admitted.
 *
 * THE SEARCH BACKEND IS A REAL BACKEND. `web_search` is served by the host's
 * Exa provider, which issues a real `POST {baseURL}/search` and PARSES the
 * answer into the seam's `{ sources, truncated }`. `baseURL` is configuration
 * (`search.baseURL`, default `https://api.exa.ai`), so a deployment may point
 * it at its own gateway, and the evidence suite points it at a local endpoint
 * to measure request-and-parse without an external account. When the provider
 * is NOT usable (no API key, unparseable endpoint) this module does not pretend:
 * it omits `search` / answers `searchAvailable() === false`, and the face
 * refuses with the typed `WEB_PROVIDER_UNAVAILABLE` — one fact, zero provider
 * entries. "No backend" is therefore a TYPED GAP, never a silent empty result.
 *
 * TEST ENDPOINTS, STATED PLAINLY. The face's SSRF leg refuses loopback/private/
 * metadata destinations. A local fixture is loopback, so the composition
 * declares it: `testEndpoints: ["http://127.0.0.1:<port>"]` is forwarded to the
 * face verbatim, matched by EXACT origin. That is the only exemption, it is
 * composition config (never a Member input), and a shipped deployment should
 * leave it empty. The fetch provider's own resolver is likewise the composition
 * decision: without `fetch.allowTestEndpoints` the host's public-only resolver
 * is used unchanged; with it, exactly the declared origins resolve to the
 * fixture host and every other non-public destination is still refused by the
 * host resolver (both layers are reported in the deployment record).
 *
 * CORE PATCH BUDGET = 0: no upstream tree is read or written; the host packages
 * are consumed through their published entry points only.
 *
 * @module @dsh-agent-team/runtime/plugin/live/a5sf-web-transport
 */

export const name = 'a5sf-web-transport'

/**
 * The service this row provides. The product row reads it lazily, exactly like
 * `teamA5sfRealm`; a deployment that does not mount this row keeps the
 * pre-PD-30 state byte-for-byte (a governed realm with `subprocess` + `terminal`
 * and NO web face).
 */
// Node's `URL` is the parser this row uses to normalise the composition's
// declared fixture origins. IMPORTED, never taken from the ambient global: this
// module needs no ambient global at all, so it adds no identity to the lint
// diff and needs no node-globals booking.
import { URL } from 'node:url'

export const A5SF_WEB_TRANSPORT_SERVICE = 'teamA5sfWebTransport'

/** The two host modules this row loads, by their PUBLIC package names. */
export const A5SF_WEB_FETCH_MODULE = '@deepseek-ai/dsh-web-fetch-http'
export const A5SF_WEB_SEARCH_MODULE = '@deepseek-ai/dsh-web-search-exa'

/**
 * Default limits for the fetch provider. Kept identical to the pinned host
 * package's own `Config` defaults so a governed Member's fetch is bounded by the
 * same numbers the standard preset uses.
 */
const DEFAULT_FETCH_LIMITS = Object.freeze({
  maxResponseBytes: 5_000_000,
  maxBodyChars: 100_000,
  timeoutMs: 30_000,
  maxRedirects: 5,
  userAgent: 'dsh-agent-team/governed-web',
})

/** Non-blank string or `undefined` (never a coerced value). */
function nonBlank(value) {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined
}

/** A positive finite number or the fallback. */
function positive(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : fallback
}

/** A non-negative integer or the fallback. */
function nonNegativeInteger(value, fallback) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 ? value : fallback
}

/**
 * The declared test endpoints, normalised to exact origins. A malformed entry
 * is DROPPED (fail closed: the target is then classified like any other), never
 * widened into a wildcard.
 */
export function normaliseTestEndpoints(raw) {
  const list = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(',') : []
  const origins = []
  for (const entry of list) {
    const text = nonBlank(entry)
    if (text === undefined) continue
    try {
      const url = new URL(text)
      if (url.protocol !== 'http:' && url.protocol !== 'https:') continue
      if (url.hostname === '') continue
      origins.push(url.origin)
    } catch {
      continue
    }
  }
  return Object.freeze([...new Set(origins)])
}

/**
 * Build the fetch resolver: the host's OWN public-only resolver, except that a
 * request whose origin is a DECLARED test endpoint resolves to that endpoint's
 * host. Any other hostname is handed to the host resolver unchanged, so
 * replacing this module cannot widen egress beyond the host's own policy.
 *
 * @param {object} input
 * @param {readonly string[]} input.testEndpoints - exact origins allowed to resolve locally.
 * @param {(hostname: string, signal?: AbortSignal) => Promise<unknown>} input.publicResolve - the host resolver.
 * @returns {(hostname: string, signal?: AbortSignal) => Promise<unknown>} the composed resolver.
 */
export function createFetchResolver({ testEndpoints, publicResolve }) {
  const localHosts = new Set()
  for (const origin of testEndpoints) {
    try {
      localHosts.add(new URL(origin).hostname.toLowerCase())
    } catch {
      continue
    }
  }
  if (localHosts.size === 0) return publicResolve
  return async function governedWebResolve(hostname, signal) {
    const host = String(hostname ?? '').toLowerCase().replace(/^\[|\]$/g, '')
    if (localHosts.has(host)) return [{ address: host === 'localhost' ? '127.0.0.1' : host, family: host.includes(':') ? 6 : 4 }]
    return publicResolve(hostname, signal)
  }
}

/**
 * Load the two host providers. The module specifiers are configuration so a
 * deployment (or a pinned test tree, whose install graph is the same shape a
 * package manager produces) can resolve them by name; the DEFAULT is the public
 * package name and nothing here embeds a filesystem path.
 *
 * @param {object} config - the row config.
 * @returns {Promise<{ fetchProvider: object, searchProvider: object|null, searchReason: string|null, modules: object }>}
 */
export async function loadTransports(config) {
  const fetchSpecifier = nonBlank(config?.fetchModule) ?? A5SF_WEB_FETCH_MODULE
  const searchSpecifier = nonBlank(config?.searchModule) ?? A5SF_WEB_SEARCH_MODULE
  const fetchModule = await import(fetchSpecifier)
  if (typeof fetchModule?.HttpFetchProvider !== 'function') {
    throw new TypeError(`a5sf-web-transport: ${fetchSpecifier} exposes no HttpFetchProvider; refusing to mount a face with no transport`)
  }
  const limits = config?.fetch ?? {}
  const testEndpoints = normaliseTestEndpoints(config?.testEndpoints)
  const provider = new fetchModule.HttpFetchProvider(
    {
      maxResponseBytes: positive(limits.maxResponseBytes, DEFAULT_FETCH_LIMITS.maxResponseBytes),
      maxBodyChars: positive(limits.maxBodyChars, DEFAULT_FETCH_LIMITS.maxBodyChars),
      timeoutMs: positive(limits.timeoutMs, DEFAULT_FETCH_LIMITS.timeoutMs),
      maxRedirects: nonNegativeInteger(limits.maxRedirects, DEFAULT_FETCH_LIMITS.maxRedirects),
      userAgent: nonBlank(limits.userAgent) ?? DEFAULT_FETCH_LIMITS.userAgent,
    },
    createFetchResolver({ testEndpoints, publicResolve: fetchModule.publicHttpNetwork?.resolve }),
  )

  // ── the search backend ────────────────────────────────────────────────────
  // A LOAD FAILURE IS A RECORDED GAP, NOT A CRASH: a deployment whose install
  // graph has no search package still gets a working `web_fetch`, and every
  // `web_search` is the typed `WEB_PROVIDER_UNAVAILABLE` (0 provider entries).
  // That is exactly the "surface without backend" state, made visible.
  let searchProvider = null
  let searchReason = null
  let searchModule = null
  try {
    searchModule = await import(searchSpecifier)
  } catch (error) {
    searchReason = `the search provider module ${searchSpecifier} did not load: ${error instanceof Error ? error.message : String(error)}`
  }
  if (searchModule !== null) {
    if (typeof searchModule.ExaSearchProvider !== 'function') {
      searchReason = `${searchSpecifier} exposes no ExaSearchProvider`
    } else {
      const search = config?.search ?? {}
      const options = {
        apiKey: nonBlank(search.apiKey) ?? '',
        baseURL: nonBlank(search.baseURL) ?? searchModule.EXA_DEFAULT_BASE_URL ?? 'https://api.exa.ai',
        searchType: search.searchType ?? searchModule.EXA_DEFAULT_SEARCH_TYPE ?? 'auto',
        highlightsPerResult: positive(search.highlightsPerResult, searchModule.EXA_DEFAULT_HIGHLIGHTS_PER_RESULT ?? 1),
        ...(positive(search.numResults, undefined) === undefined ? {} : { numResults: positive(search.numResults, 1) }),
      }
      searchProvider = new searchModule.ExaSearchProvider(options)
      if (typeof searchProvider.available === 'function' && searchProvider.available() !== true) {
        searchReason = 'the composition installed a search provider that reports itself unavailable (its own available() answers false; today: no API key or an unparseable endpoint)'
      }
    }
  }
  return {
    fetchProvider: provider,
    searchProvider,
    searchReason,
    modules: Object.freeze({ fetch: fetchSpecifier, search: searchSpecifier }),
    testEndpoints,
  }
}

/**
 * Mount the transport row: load the providers ONCE and provide the optional
 * `teamA5sfWebTransport` service. `createProvider(member)` answers the object
 * the confined `web` face consumes (`fetch`, optional `search`,
 * `searchAvailable`, and the declared test endpoints for the face's SSRF leg).
 */
export async function apply(ctx, config) {
  const transports = await loadTransports(config)
  const { fetchProvider, searchProvider, searchReason, modules, testEndpoints } = transports
  const providers = new Map()

  /** The face-bound provider of one Member (cached: one object per identity). */
  function createProvider(member) {
    const identity = nonBlank(member?.memberIdentity) ?? nonBlank(member?.instanceId) ?? ''
    if (identity === '') {
      throw new TypeError('a5sf-web-transport: createProvider needs a member identity; a transport is never shared blind across Members')
    }
    const cached = providers.get(identity)
    if (cached !== undefined) return cached
    const provider = Object.freeze({
      async fetch(request, signal) {
        return fetchProvider.fetch(request, signal)
      },
      ...(searchProvider === null ? {} : {
        async search(request, signal) {
          return searchProvider.search(request, signal)
        },
        searchAvailable() {
          return typeof searchProvider.available === 'function' ? searchProvider.available() === true : true
        },
      }),
      ...(testEndpoints.length === 0 ? {} : { testEndpoints }),
      // NO capability probe and NO networkProof on purpose: the pinned host
      // transport proves nothing about an OS boundary, so a `network: deny`
      // lane is refused by the face (`NETWORK_UNCONFINED_REALM`) instead of
      // being admitted on a weaker claim.
    })
    providers.set(identity, provider)
    return provider
  }

  ctx.provide('teamA5sfWebTransport', Object.freeze({
    createProvider,
    /** What this composition loaded — read by the deployment evidence, decides nothing. */
    describe: () => Object.freeze({
      schema: 'a5sf-web-transport/1',
      fetch: modules.fetch,
      search: modules.search,
      searchBackend: searchProvider === null ? null : (typeof searchProvider.id === 'string' ? searchProvider.id : 'search'),
      searchAvailable: searchProvider === null ? false : (typeof searchProvider.available === 'function' ? searchProvider.available() === true : true),
      searchGap: searchReason,
      testEndpoints,
    }),
  }))
}

/** The service name, exported for the product row's lazy lookup. */
export default apply
