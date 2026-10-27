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

// ── THE NON-PUBLIC-DESTINATION LAW (REVIEW-403 H-1) ─────────────────────
// The scheme law and the per-origin approval answer WHO may be asked; they
// do NOT answer WHERE the socket lands: `https://` says nothing about the
// address, and a human approving "fetch https://<host>" is not approving
// an internal-network request when <host> resolves internally. So this law
// runs on the address itself — for EVERY scheme, on the RESOLVED address
// (transport), and on the literal spelling too (gate) — BEFORE any connect:
// refused scopes are loopback, RFC1918 private, CGNAT 100.64/10, link-local
// (169.254/16 — the cloud-metadata home — and fe80::/10), IPv6 ULA fc00::/7,
// the unspecified address, multicast, broadcast, the 0/8 and 240/4 reserved
// blocks, and EVERY IPv6 form that carries an IPv4 of one of those scopes
// (v4-mapped ::ffff:x, v4-compatible ::x, well-known NAT64 64:ff9b::/96).
// WHATWG URL parsing has already folded the decimal/octal/hex IPv4 spellings
// (`2130706433`, `0x7f000001`, `0177.0.0.1`) into dotted form before a host
// reaches this file, and the transport re-checks whatever bytes it is about
// to connect to, so no spelling survives. A trusted mount opt may re-admit
// LOOPBACK ONLY (offline-evidence stubs); private/CGNAT/link-local space is
// never re-admittable. Refusal code: `WEB_DESTINATION_NON_PUBLIC`, zero wire.
/** The address scopes this law refuses. */
export const NON_PUBLIC_DESTINATION_SCOPES = Object.freeze([
  'loopback', 'private', 'cgnat', 'link-local', 'unique-local',
  'unspecified', 'multicast', 'broadcast', 'reserved',
])

function parseIpv4Octets(text) {
  const parts = String(text).split('.')
  if (parts.length !== 4) return null
  const octets = []
  for (const part of parts) {
    if (!/^\d{1,3}$/.test(part)) return null
    const n = Number(part)
    if (n > 255) return null
    octets.push(n)
  }
  return octets
}

function v4Scope([a, b]) {
  if (a === 0) return 'unspecified'                       // 0.0.0.0/8 (incl. :0)
  if (a === 10) return 'private'                          // RFC1918
  if (a === 100 && b >= 64 && b <= 127) return 'cgnat'    // RFC6598
  if (a === 127) return 'loopback'                        // RFC1122
  if (a === 169 && b === 254) return 'link-local'         // RFC3927 — 169.254.169.254 lives here
  if (a === 172 && b >= 16 && b <= 31) return 'private'   // RFC1918
  if (a === 192 && b === 168) return 'private'            // RFC1918
  if (a === 224 || (a >= 225 && a <= 239)) return 'multicast' // 224/4
  if (a === 255 && b === 255) return 'broadcast'          // 255.255.0.0/16 (limited bcast included)
  if (a >= 240) return 'reserved'                         // 240/4
  return 'public'
}

/** Full/compact IPv6 text → 16 bytes (embedded IPv4 tail folded). Zone ids
 *  are refused (null): the law never follows a scope-less link-local. */
function parseIpv6Bytes(text) {
  const host = String(text).replace(/^\[/, '').replace(/\]$/, '')
  if (host.includes('%')) return null
  const tailV4 = /(\d{1,3}(?:\.\d{1,3}){3})$/.exec(host)
  let tail = null
  let head = host
  if (tailV4 !== null) {
    tail = parseIpv4Octets(tailV4[1])
    if (tail === null) return null
    head = host.slice(0, tailV4.index).replace(/\.$/, '')
  }
  const halves = head.split('::')
  if (halves.length > 2) return null
  const groups = (segment) => segment === ''
    ? []
    : segment.split(':').map((g) => (/^[0-9a-fA-F]{1,4}$/.test(g) ? Number(`0x${g}`) : Number.NaN))
  const left = groups(halves[0])
  const right = halves.length === 2 ? groups(halves[1]) : []
  if ([...left, ...right].some((g) => !Number.isInteger(g))) return null
  const tailWords = tail === null ? [] : [(tail[0] << 8) | tail[1], (tail[2] << 8) | tail[3]]
  const wordCount = left.length + right.length + tailWords.length
  const hasCompact = halves.length === 2
  const total = 8
  if (!hasCompact && wordCount !== total) return null
  if (hasCompact && wordCount > total - 1) return null
  const words = [...left, ...new Array(total - wordCount).fill(0), ...right, ...tailWords]
  const bytes = new Uint8Array(16)
  words.slice(0, 8).forEach((w, i) => { bytes[i * 2] = (w >> 8) & 0xff; bytes[i * 2 + 1] = w & 0xff })
  return bytes
}

function v6Scope(bytes) {
  const w = (i) => (bytes[i] << 8) | bytes[i + 1]
  // Every IPv4-carrying form recurses: ::ffff:x (mapped), ::x (compatible),
  // 64:ff9b::/96 (well-known NAT64) — a mapped PRIVATE address is PRIVATE.
  const head96 = (prefix) => bytes.slice(0, 12).every((b, i) => b === prefix[i])
  const v4Tail = () => [bytes[12], bytes[13], bytes[14], bytes[15]]
  if (head96([0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0xff, 0xff])) return v4Scope(v4Tail())
  if (head96([0x00, 0x64, 0xff, 0x9b, 0, 0, 0, 0, 0, 0, 0, 0])) return v4Scope(v4Tail())
  if (bytes.slice(0, 12).every((b) => b === 0)) {
    const v4 = v4Tail()
    if (v4.some((o) => o !== 0) && !(v4[0] === 0 && v4[1] === 0 && v4[2] === 0 && v4[3] === 1)) return v4Scope(v4)
  }
  if (w(0) === 0 && w(2) === 0 && w(4) === 0 && w(6) === 0 && w(8) === 0 && w(10) === 0 && w(12) === 0 && bytes[14] === 0 && bytes[15] === 1) return 'loopback'
  if (bytes.every((b) => b === 0)) return 'unspecified'
  if ((bytes[0] & 0xfe) === 0xfc) return 'unique-local'   // fc00::/7
  if ((bytes[0] === 0xfe) && (bytes[1] & 0xc0) === 0x80) return 'link-local' // fe80::/10
  if (bytes[0] === 0xff) return 'multicast'               // ff00::/8
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x0d && bytes[3] === 0xb8) return 'reserved' // doc ranges never public
  return 'public'
}

/** Scope of ONE address text: dotted IPv4 or IPv6 (bracketed or not).
 *  A non-IP hostname answers `null` — its scope is decided after resolve. */
export function addressScope(addressText) {
  const text = String(addressText ?? '').trim().toLowerCase()
  if (text === '') return null
  if (text.includes(':')) {
    const bytes = parseIpv6Bytes(text)
    return bytes === null ? null : v6Scope(bytes)
  }
  const octets = parseIpv4Octets(text)
  return octets === null ? null : v4Scope(octets)
}

/** The scope of a URL HOSTNAME when it is a literal IP (WHATWG-normalized);
 *  null for real hostnames. */
export function literalHostScope(hostname) {
  return addressScope(String(hostname ?? '').replace(/^\[/, '').replace(/\]$/, ''))
}

export function isPublicDestinationAddress(addressText) {
  const scope = addressScope(addressText)
  return scope === 'public'
}

/**
 * THE law over a RESOLVED address set: EVERY answer must be public; a
 * mixed set (one public, one private) is refused whole, because the connect
 * could land on any of them. `loopbackAllowed` (the trusted mount opt)
 * re-admits scope `loopback` ONLY — never any other non-public scope.
 * `loopbackOnly` (the plain-http leg of an opted mount): the http opt is
 * LOOPBACK by its own words, so a hostname on that leg may only ever
 * resolve to loopback — `http://localhost` re-resolving to a public (or
 * any non-loopback) address is refused there, closing the drift where the
 * scheme gate's hostname check ('localhost') and the wire's address could
 * otherwise disagree after a rebind.
 */
export function destinationLawForAddresses(addresses, { loopbackAllowed = false, loopbackOnly = false } = {}) {
  const list = Array.isArray(addresses) ? addresses : []
  if (list.length === 0) {
    return { ok: false, scope: 'unresolvable', offending: null }
  }
  for (const entry of list) {
    const text = typeof entry === 'string' ? entry : entry?.address
    const scope = addressScope(text)
    if (scope === null) return { ok: false, scope: 'unparsable', offending: null }
    if (loopbackOnly === true) {
      if (scope === 'loopback') continue
      return { ok: false, scope, offending: text }
    }
    if (scope === 'public') continue
    if (scope === 'loopback' && loopbackAllowed === true) continue
    return { ok: false, scope, offending: text }
  }
  return { ok: true }
}

function nonPublicRefusal(detail) {
  return webRefusal('admission', 'WEB_DESTINATION_NON_PUBLIC', detail)
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
  // H-1 on the LITERAL spelling (the zero-cost first leg of the
  // non-public-destination law; the transport runs the same law again on
  // the RESOLVED address before it connects — a hostname that RESOLVES
  // non-public is refused there). WHATWG has folded decimal/octal/hex IPv4
  // spellings into dotted form already; IPv6 keeps its brackets here.
  const literalScope = literalHostScope(parsed.hostname)
  if (literalScope !== null && literalScope !== 'public') {
    if (literalScope === 'loopback' && httpLoopbackAllowed === true) {
      // the trusted opt re-admits loopback ONLY — fall through.
    } else {
      return { ok: false, refusal: nonPublicRefusal(`the literal destination address is ${literalScope} — a governed fetch never connects to loopback/private/CGNAT/link-local/unspecified/multicast space (the trusted mount opt re-admits loopback ONLY); zero wire`) }
    }
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
