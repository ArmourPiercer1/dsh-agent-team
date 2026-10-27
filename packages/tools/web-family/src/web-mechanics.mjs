/**
 * web-family/src/web-mechanics.mjs — the PURE mechanics of the governed WEB
 * family (u7-f, the first network-effect family). No `node:*`, no I/O, no
 * clock: everything that decides BEFORE the wire lives here, so every gating
 * law is testable without a socket and the transport stays one dumb,
 * audited port.
 *
 * THE THREE-AXIS HONESTY (u7 DECISION-3-ANSWER): the host sandbox claims
 * FILE effects only (its bwrap profile carries no `--unshare-net`; the
 * local Landlock ABI is partial and predates TCP rules). A network call is
 * therefore an effect the filesystem sandbox CANNOT contain, and this lane
 * never claims otherwise. What governs the effect is the Team authority
 * chain, not a local confinement claim: per-call PA over the effect set
 * `tool-invoke(web_fetch|web_search) + connect(network-destination)`, the
 * one-shot grant, and this file's closed gating law BEFORE the wire.
 * Execution boundary: trusted Host (the row's transport is the family-body
 * process's own socket); assurance: Team-enforced for the admission walk,
 * NOT confinement-enforced. The PR body states this verbatim.
 *
 * THE GATE LAW (evaluated before any PA walk, so a refusal consumes
 * nothing): the URL must parse; it must carry NO userinfo (a
 * user:pass@host URL is a credential in a model-shaped string — refused
 * whole, never stripped); its scheme must be on the trusted allowlist —
 * https only by DEFAULT, and `http` is admitted only when the trusted
 * construction opted into `httpLoopbackAllowed` AND the host is loopback
 * (the scheme allowlist is never a model argument, and production mounts
 * never opt in); the destination is the canonical origin
 * (`scheme://host[:port]`, WHATWG) — the ONE resource identity the frozen
 * effect vocabulary can bind a `connect` right to (`resource.ts`:
 * a destination never looks like a path, and the path is NOT part of the
 * destination identity; disclosed: the approved question is per-origin,
 * so path drift within an approved origin is inside the grant).
 *
 * THE REDIRECT LAW: the row never auto-follows. Each hop is re-gated here.
 * A redirect whose target is on the approved origin is the SAME approved
 * `connect` effect (same scheme, host and port — the origin IS the
 * approved resource identity); a redirect to ANY other origin is a NEW
 * network effect the per-call effect set never requested, hence an effect
 * no grant covers: typed refusal `WEB_REDIRECT_DENIED`, and the
 * disallowed host is never contacted. A hop chain longer than
 * `MAX_REDIRECT_HOPS` (a loop is exactly that shape) is
 * `WEB_REDIRECT_LIMIT`. No hop may change scheme away from the approved
 * scheme either (an https→http downgrade is a different origin and a
 * scheme-allowlist violation at once).
 *
 * @module web-family/web-mechanics
 */

export const WEB_FAMILY_ID = 'dsh.web-family'
/** The fixed native spellings the family claims (takeover law § CI-04: a
 *  governed row carries its NATIVE name; the jobs/fs precedent — never the
 *  configurable names map, so there is no Gate 0b surface to feed). */
export const WEB_FETCH_NATIVE_NAME = 'web_fetch'
export const WEB_SEARCH_NATIVE_NAME = 'web_search'

/** Bounded redirect hops: a loop is a hop chain, so the bound closes it. */
export const MAX_REDIRECT_HOPS = 5
/** The wall-time bound of ONE governed fetch call (deadline maths rides the
 *  transport port; this is the trusted default). */
export const DEFAULT_FETCH_TIMEOUT_MS = 30_000
/** The response-size bound of ONE governed fetch (bytes counted as they
 *  arrive; the bound overruns → the WHOLE response is refused, nothing is
 *  delivered). */
export const DEFAULT_MAX_FETCH_BYTES = 512 * 1024
/** The query cap of one governed web_search (argument bound, native
 *  parity: 1–8 queries). */
export const WEB_SEARCH_MAX_QUERIES = 8
/** The search-result bound carried to the provider port (the provider's
 *  own cap law; the row never invents results). */
export const WEB_SEARCH_MAX_RESULTS = 50

/** The default scheme allowlist: https ONLY. `http` enters only through
 *  the trusted construction AND only for loopback hosts. */
export const DEFAULT_ALLOWED_SCHEMES = Object.freeze(['https'])

const LOOPBACK_HOSTS = new Set(['127.0.0.1', '[::1]', 'localhost'])
export function isLoopbackHost(hostname) {
  return LOOPBACK_HOSTS.has(hostname)
  || hostname.endsWith('.localhost')
  || (/^\d+\.\d+\.\d+\.\d+$/.test(hostname) && hostname.startsWith('127.'))
}

/** The refusal grammar of this lane, verbatim-shaped like the fs family's:
 *  `refused-<class> <CODE> — <detail>`. Stable, model-visible, no stack,
 *  no headers, no URL query — detail strings are authored here from
 *  closed inputs only. */
export function webRefusal(refusalClass, code, detail) {
  return {
    kind: 'refused',
    refusalClass,
    code,
    text: `refused-${refusalClass} ${String(code)} — ${String(detail)}`,
  }
}

/** CLOSED argument parse of the governed web_fetch row (mirrors the native
 *  web_fetch surface: exactly one required `url`). An unknown parameter is
 *  a refusal — the governed row carries NO escalation lane. */
export function parseGovernedWebFetchArgs(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, refusal: webRefusal('schema', 'WEB_ARGS_INVALID', 'web_fetch arguments must be an object') }
  }
  const keys = Object.keys(raw)
  if (keys.length !== 1 || keys[0] !== 'url') {
    return {
      ok: false,
      refusal: webRefusal('schema', 'closed-args-violation', `web_fetch takes exactly { url } — got [${keys.sort().join(',')}]`),
    }
  }
  if (typeof raw.url !== 'string' || raw.url.trim().length === 0) {
    return { ok: false, refusal: webRefusal('schema', 'WEB_ARGS_INVALID', 'url must be a non-empty string') }
  }
  return { ok: true, url: raw.url }
}

/** CLOSED argument parse of the governed web_search row (native parity:
 *  `queries`, 1–WEB_SEARCH_MAX_QUERIES non-empty strings). */
export function parseGovernedWebSearchArgs(raw) {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, refusal: webRefusal('schema', 'WEB_ARGS_INVALID', 'web_search arguments must be an object') }
  }
  const keys = Object.keys(raw)
  if (keys.length !== 1 || keys[0] !== 'queries') {
    return {
      ok: false,
      refusal: webRefusal('schema', 'closed-args-violation', `web_search takes exactly { queries } — got [${keys.sort().join(',')}]`),
    }
  }
  const queries = raw.queries
  if (!Array.isArray(queries) || queries.length === 0 || queries.length > WEB_SEARCH_MAX_QUERIES
    || queries.some((q) => typeof q !== 'string' || q.trim().length === 0)) {
    return {
      ok: false,
      refusal: webRefusal('schema', 'WEB_ARGS_INVALID', `queries must be 1–${String(WEB_SEARCH_MAX_QUERIES)} non-empty strings`),
    }
  }
  return { ok: true, queries: Object.freeze([...queries]) }
}

/**
 * Gate one URL BEFORE the wire and derive the approved network
 * destination (the canonical origin). Every refusal here is zero-wire.
 *
 * @param {string} rawUrl
 * @param {{ allowedSchemes?: readonly string[], httpLoopbackAllowed?: boolean }} policy
 *   the TRUSTED scheme policy of this mount (construction config, never a
 *   model argument). `httpLoopbackAllowed` admits `http` for loopback hosts
 *   ONLY (the offline-stub shape the C1/C2 evidence runs); any other http
 *   target is refused even when it is on.
 */
export function gateWebUrl(rawUrl, policy = {}) {
  const allowedSchemes = policy.allowedSchemes ?? DEFAULT_ALLOWED_SCHEMES
  const httpLoopbackAllowed = policy.httpLoopbackAllowed === true
  let parsed
  try {
    parsed = new URL(rawUrl)
  } catch {
    return { ok: false, refusal: webRefusal('schema', 'WEB_URL_INVALID', 'the url is not an absolute URL this row can gate') }
  }
  if (parsed.username !== '' || parsed.password !== '') {
    // Credentials never ride: the URL is refused whole (never stripped —
    // a stripped-then-fetched URL would silently change the effect).
    return { ok: false, refusal: webRefusal('admission', 'WEB_URL_USERINFO_FORBIDDEN', 'the url carries userinfo — a governed fetch never sends credentials embedded in a URL') }
  }
  const scheme = parsed.protocol.replace(/:$/, '').toLowerCase()
  if (!allowedSchemes.includes(scheme)) {
    return { ok: false, refusal: webRefusal('admission', 'WEB_SCHEME_NOT_ALLOWED', `scheme '${scheme}' is not on this mount's allowlist [${allowedSchemes.join(',')}]`) }
  }
  if (scheme === 'http' && !(httpLoopbackAllowed && isLoopbackHost(parsed.hostname))) {
    return { ok: false, refusal: webRefusal('admission', 'WEB_SCHEME_NOT_ALLOWED', 'http is refused — the trusted scheme allowlist of this mount is https-only') }
  }
  const destination = parsed.origin
  if (typeof destination !== 'string' || destination === '' || destination === 'null') {
    return { ok: false, refusal: webRefusal('schema', 'WEB_URL_INVALID', 'the url has no canonical origin to gate (opaque-origin URLs are never fetchable)') }
  }
  return { ok: true, url: parsed, destination, scheme }
}

/** Is `target` a redirect target that stays INSIDE the approved
 *  destination (same canonical origin)? Redirects are resolved against the
 *  hop's URL before this question is asked. */
export function redirectStaysInDestination(base, location, approvedDestination) {
  let resolved
  try {
    resolved = new URL(location, base)
  } catch {
    return { ok: false, reason: 'unresolvable' }
  }
  if (resolved.username !== '' || resolved.password !== '') {
    return { ok: false, reason: 'userinfo' }
  }
  return resolved.origin === approvedDestination
    ? { ok: true, url: resolved }
    : { ok: false, reason: 'off-destination' }
}
