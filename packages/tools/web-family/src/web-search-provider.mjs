/**
 * web-family/src/web-search-provider.mjs — the search PROVIDER law of the
 * governed WEB family (u7-f).
 *
 * THE LAW: `web_search` is a pluggable-provider row, and this file ships
 * the plug's SHAPE, not a plug. NO production provider is configured by
 * this PR — none is invented (the matrix row web_search stays
 * NOT_VERIFIED, and the row refuses typed `WEB_SEARCH_NO_PROVIDER` with
 * zero network effect whenever no trusted provider is mounted). The
 * provider arrives ONLY through the trusted mount (the kit seam
 * `injected.webSearchProvider` — the same reviewed `input.backends` face
 * the search/process families use for their backends); it is NEVER a model
 * argument, never a planeCfg value, and the row reads no provider from
 * config.
 *
 * THE CLOSED PORT (validated fail-closed at mount):
 *   id                string — the provider identity the contribution
 *                      binds; a provider change moves the family digest.
 *   destination()     () => string — the canonical origin
 *                      (`https://host[:port]`) the provider's calls leave
 *                      from. This is the effect TRUTH of the provider: the
 *                      row requests `connect` on exactly this destination
 *                      beside `tool-invoke(web_search)`, so the declared
 *                      effect set and the requested set cannot drift (the
 *                      PR #390 bug class, refused by shape here). A
 *                      provider whose calls touch more than one origin
 *                      must say so — `extraDestinations()` exists for
 *                      exactly that, and every listed origin enters the
 *                      per-call request. Over-claiming and
 *                      under-claiming are both mount-time refusals.
 *   search(input)     async ({ queries, maxResults, signal }) =>
 *                      { ok: true, content?, sources, truncated }
 *                    | { ok: false, code, detail }
 *                      The provider performs its own network against its
 *                      declared destination(s) through the bounded
 *                      search-port; it holds NO decision/admission face —
 *                      authority stays the kernel's (CI-06).
 *
 * The provider's assurance is PROVIDER-enforced (three-axis honesty,
 * DECISION-3): the Team chain governs WHO may ask (per-call PA over the
 * connect effect, one-shot grant) and the row bounds time/bytes at the
 * port; the provider is responsible for what its upstream service does
 * with the query. The PR body says this verbatim.
 *
 * @module web-family/web-search-provider
 */

/** The closed key set of a provider object. */
const PROVIDER_KEYS = ['id', 'destination', 'extraDestinations', 'search']

import { isLoopbackHost } from './web-mechanics.mjs'

const isOrigin = (value, allowHttpLoopback) => {
  if (typeof value !== 'string') return false
  try {
    const u = new URL(value)
    const httpsShape = u.protocol === 'https:' && u.origin === value
    const loopbackHttp = allowHttpLoopback === true && u.protocol === 'http:' && u.origin === value && isLoopbackHost(u.hostname)
    return (httpsShape || loopbackHttp) && u.username === '' && u.password === ''
  } catch {
    return false
  }
}

/**
 * Validate one trusted provider mount. Returns
 * `{ ok: true, provider, destinations }` (destinations = the frozen
 * effect-truth list) or `{ ok: false, detail }` — NEVER a repaired
 * provider. A present-but-invalid provider fails closed at MOUNT (the
 * family refuses to build), the same law as every other trusted backend.
 *
 * @param {unknown} candidate
 * @param {{ allowHttpLoopback?: boolean }} [options] the mount's scheme
 *   opt: a loopback-plain-http provider destination is a VALID effect
 *   truth only where the mount itself admits that shape (offline evidence
 *   mounts); production mounts never widen.
 */
export function validateWebSearchProvider(candidate, options = {}) {
  const allowHttpLoopback = options.allowHttpLoopback === true
  if (candidate === null || typeof candidate !== 'object' || Array.isArray(candidate)) {
    return { ok: false, detail: 'a web_search provider must be an object (or absent — the row then refuses typed)' }
  }
  for (const key of Object.keys(candidate)) {
    if (!PROVIDER_KEYS.includes(key)) return { ok: false, detail: `unknown provider key '${key}' (the port is closed)` }
  }
  if (typeof candidate.id !== 'string' || candidate.id.trim().length === 0) {
    return { ok: false, detail: 'provider.id must be a non-empty string' }
  }
  if (typeof candidate.destination !== 'function') {
    return { ok: false, detail: 'provider.destination() must be a function answering the canonical https origin' }
  }
  const primary = candidate.destination()
  if (!isOrigin(primary, allowHttpLoopback)) {
    return { ok: false, detail: 'provider.destination() must answer a canonical https origin (scheme://host[:port], no path, no userinfo; plain http only on a mount that opted into loopback http)' }
  }
  const destinations = [primary]
  if (candidate.extraDestinations !== undefined) {
    if (typeof candidate.extraDestinations !== 'function') {
      return { ok: false, detail: 'provider.extraDestinations must be a function or absent' }
    }
    const extra = candidate.extraDestinations()
    if (!Array.isArray(extra) || extra.some((d) => !isOrigin(d, allowHttpLoopback))) {
      return { ok: false, detail: 'provider.extraDestinations() must answer an array of canonical https origins' }
    }
    for (const d of extra) if (!destinations.includes(d)) destinations.push(d)
  }
  if (typeof candidate.search !== 'function') {
    return { ok: false, detail: 'provider.search() must be a function' }
  }
  return {
    ok: true,
    provider: Object.freeze({
      id: candidate.id,
      destination: candidate.destination,
      search: candidate.search,
    }),
    destinations: Object.freeze(destinations),
  }
}

/** The typed refusal of an unmounted provider — ZERO effects, ZERO PA,
 *  ZERO wire. Stable, model-visible, no stack. */
export function noProviderRefusal() {
  return {
    kind: 'refused',
    refusalClass: 'admission',
    code: 'WEB_SEARCH_NO_PROVIDER',
    text: 'refused-admission WEB_SEARCH_NO_PROVIDER — no web_search provider is configured on this mount: the row refuses (no provider is invented; this capability stays NOT_VERIFIED until a trusted provider is mounted)',
  }
}
