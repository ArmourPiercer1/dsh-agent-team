/**
 * web-family/src/web-transport.mjs — the ONE transport port of the governed
 * WEB family (u7-f). Every byte this family puts on or takes off a socket
 * moves through this module and nothing else: the rows never touch
 * `node:https`, the executors never touch sockets, and the C1/C2 evidence
 * proves the law by replacing THIS port (an injected `webTransport` /
 * `webSearchTransport` at the kit seam) — a refusal arm that never reaches
 * the port proves zero network effect against the stub's request counter.
 *
 * WHAT THE PORT IS NOT: it owns NO policy. The scheme allowlist, the
 * userinfo ban, the destination identity and the redirect law all sit in
 * `web-mechanics.mjs` and run BEFORE admission; this port answers exactly
 * one bounded request for a URL the mechanics already gated, and it never
 * follows a redirect (the row drives hop-by-hop so every hop is a
 * mechanics-gated decision). The port fails CLOSED: a non-https URL handed
 * to the https port is a mechanics bug, thrown loudly, never fetched.
 *
 * THE BOUNDS are per call, injected by the executor: `maxBytes` (response
 * bytes counted AS THEY ARRIVE — the overrun destroys the socket and the
 * WHOLE response is refused, nothing partial is delivered) and a wall-time
 * deadline (`deadlineAt` — a typed `WEB_TIMEOUT`, the socket dies, nothing
 * is delivered). Call cancellation (the host abort signal) is forwarded to
 * the socket, and a cancel that lands first answers `cancelled`.
 *
 * THE LEAK LAW: a transport error is mapped to a closed code plus
 * `String(error.code ?? error.name)` — no URL, no query, no header, no
 * stack, never the peer's error body. The response carries back ONLY the
 * status, the `location` header (the redirect chain input) and the bytes;
 * no other response header is surfaced to the row, so a header-shaped
 * secret has no path into a result, an observe line or a refusal.
 *
 * Confinement honesty (u7 DECISION-3-ANSWER, verbatim limit): the host
 * sandbox claims FILE effects only — the bwrap profile carries no
 * `--unshare-net` and the local Landlock ABI is partial (no TCP rules).
 * This socket is therefore NOT confined by the local sandbox; what bounds
 * it is the Team authority chain around it (per-call PA over the connect
 * effect, the one-shot grant, these bounds) and the trusted scheme policy
 * in front of it. This file claims nothing else.
 *
 * @module web-family/web-transport
 */
import { request as httpsRequest } from 'node:https'
import { request as httpRequest } from 'node:http'
import { lookup as dnsLookup } from 'node:dns'
import { isLoopbackHost, literalHostScope, destinationLawForAddresses } from './web-mechanics.mjs'

export const WEB_TRANSPORT_ID = 'dsh.web-family/https-transport@v1'

/** The port's closed scheme acceptance, mirroring the mechanics gate
 *  (defense in depth, never a WIDER face than the gate): https always;
 *  plain http ONLY when this mount explicitly opted into
 *  `allowHttpLoopback` AND the host is loopback — the shape every offline
 *  evidence stub wears. A production mount opts into nothing. */
function transportAccepts(url, allowHttpLoopback) {
  if (url.protocol === 'https:') return true
  if (url.protocol === 'http:') return allowHttpLoopback === true && isLoopbackHost(url.hostname)
  return false
}

/** The default resolver: the runtime's own DNS, every answer (verbatim). */
function defaultResolver(hostname) {
  return new Promise((resolve, reject) => {
    dnsLookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
      if (error !== null && error !== undefined) reject(error)
      else resolve(addresses ?? [])
    })
  })
}

/**
 * RESOLVE ONCE — CHECK EVERY ANSWER — CONNECT TO THE CHECKED ADDRESS
 * (REVIEW-403 H-1 + H-2/M-1, the network twin of the symlink TOCTOU):
 * the hostname is resolved EXACTLY ONCE per hop; the non-public-destination
 * law runs over the WHOLE answer set (one private answer poisons the set);
 * the connect then receives the checked address through an injected
 * `lookup`, so re-resolution between check and connect is STRUCTURALLY
 * impossible — the rebinding window is not raced, it is deleted. TLS keeps
 * validating against the ORIGINAL hostname (node derives `servername` from
 * the request host), so pinning never weakens certificate checks. A
 * hostname that is a literal IP skips DNS (the bytes ARE the answer).
 * Refusals are typed and happen BEFORE any socket exists: zero wire.
 */
async function checkAndPin(target, { resolver, allowHttpLoopback }) {
  const hostname = target.hostname
  const stripped = hostname.replace(/^\[/, '').replace(/\]$/, '')
  // The plain-http leg of an opted mount dials LOOPBACK addresses ONLY:
  // the opt's own words, enforced on the RESOLVED bytes (a `localhost`
  // that re-resolves to a public address is refused HERE, not dialled).
  const loopbackOnly = target.protocol === 'http:'
  let answers
  const literal = literalHostScope(stripped)
  if (literal !== null) {
    answers = [{ address: stripped, family: stripped.includes(':') ? 6 : 4 }]
  } else {
    try {
      answers = await resolver(hostname)
    } catch {
      return { ok: false, code: 'WEB_TRANSPORT_FAILED', detail: 'the destination did not resolve; no connect was attempted' }
    }
  }
  const law = destinationLawForAddresses(Array.isArray(answers) ? answers : [], { loopbackAllowed: allowHttpLoopback, loopbackOnly })
  if (law.ok !== true) {
    const detail = law.scope === 'unresolvable'
      ? 'the destination resolved to no address; no connect was attempted'
      : law.scope === 'unparsable'
        ? 'the resolved answer was not a parseable address; no connect was attempted'
        : loopbackOnly
          ? `the plain-http opt dials loopback addresses ONLY and the resolved set is ${String(law.scope)}; zero wire`
          : `the resolved destination address is ${String(law.scope)} — the non-public-destination law refuses the connect (loopback is re-admitted by the trusted mount opt ONLY, private/CGNAT/link-local space never); zero wire`
    return { ok: false, code: 'WEB_DESTINATION_NON_PUBLIC', detail }
  }
  const first = typeof answers[0] === 'string' ? { address: answers[0], family: String(answers[0]).includes(':') ? 6 : 4 } : answers[0]
  // THE PIN: exactly one address may ever answer this connect — both
  // callback shapes node uses (all:true arrays and address+family).
  const pinFamily = Number(first.family) === 6 ? 6 : 4
  const lookup = (_host, opts, cb) => {
    if (opts === true || opts?.all === true) cb(null, [{ address: first.address, family: pinFamily }])
    else cb(null, first.address, pinFamily)
  }
  return { ok: true, lookup }
}

/** One bounded response OR a typed transport failure (closed code set). */
const TRANSPORT_CODES = new Set(['WEB_TIMEOUT', 'WEB_RESPONSE_TOO_LARGE', 'WEB_TRANSPORT_FAILED', 'WEB_DESTINATION_NON_PUBLIC', 'WEB_SEARCH_DESTINATION_DENIED', 'cancelled'])

/**
 * Build the production transport port. Trusted construction options only —
 * nothing here is model-visible.
 *
 * @param {{ connectTimeoutMs?: number, allowHttpLoopback?: boolean,
 *           resolver?: (hostname: string) => Promise<Array<{ address: string, family: number }>> }} [options]
 *   `connectTimeoutMs` is a construction default for the whole-call bound;
 *   the EXECUTOR's per-call `timeoutMs`/`deadlineAt` always wins.
 *   `allowHttpLoopback` is the trusted offline-evidence opt (loopback
 *   plain-http targets only); it can NEVER widen past loopback.
 *   `resolver` is the injected test seam for the resolve-once law
 *   (production uses the runtime DNS); the port resolves through NOTHING
 *   else, and it resolves EXACTLY ONCE per call.
 */
export function createWebTransport(options = {}) {
  const defaultTimeoutMs = Number.isFinite(options.connectTimeoutMs) && options.connectTimeoutMs > 0
    ? options.connectTimeoutMs
    : undefined
  const allowHttpLoopback = options.allowHttpLoopback === true
  const resolver = typeof options.resolver === 'function' ? options.resolver : defaultResolver

  /**
   * Fetch ONE response, bounded. Never follows redirects.
   *
   * @param {{ url: string, maxBytes: number, timeoutMs?: number, deadlineAt?: number,
   *           now?: () => number, signal?: AbortLike }} call
   * @returns {Promise<
   *   | { ok: true, statusCode: number, location?: string, contentType?: string,
   *       bodyBytes: Uint8Array, receivedBytes: number }
   *   | { ok: true, cancelled: true }
   *   | { ok: false, code: string, detail: string }
   * >}
   */
  const fetchBounded = async (call) => {
    if (typeof call?.url !== 'string') {
      return { ok: false, code: 'WEB_TRANSPORT_FAILED', detail: 'the transport was handed no url' }
    }
    let target
    try {
      target = new URL(call.url)
    } catch {
      return { ok: false, code: 'WEB_TRANSPORT_FAILED', detail: 'the transport was handed an unparseable url' }
    }
    if (!transportAccepts(target, allowHttpLoopback)) {
      // The mechanics gate https (or the opted-in loopback http) BEFORE
      // admission; anything else reaching the wire port is a broken
      // assembly — refuse loudly, fetch nothing.
      return { ok: false, code: 'WEB_TRANSPORT_FAILED', detail: `the transport refuses ${target.protocol} ${target.hostname} on this mount — the mechanics gate should have refused it before the wire` }
    }
    // H-1/H-2: resolve ONCE, check EVERY answer, pin the connect. Nothing
    // below this line may run against an unchecked address.
    const pinned = await checkAndPin(target, { resolver, allowHttpLoopback })
    if (pinned.ok !== true) return pinned
    return await new Promise((resolve) => {
    const maxBytes = Number.isInteger(call.maxBytes) && call.maxBytes > 0 ? call.maxBytes : Number.MAX_SAFE_INTEGER
    const timeoutMs = Number.isFinite(call.timeoutMs) && call.timeoutMs > 0
      ? call.timeoutMs
      : defaultTimeoutMs
    const started = typeof call.now === 'function' ? call.now() : Date.now()
    const deadline = typeof call.deadlineAt === 'number' && Number.isFinite(call.deadlineAt)
      ? call.deadlineAt
      : timeoutMs !== undefined ? started + timeoutMs : undefined

    let settled = false
    let socket = null
    let timer = null
    const finish = (outcome) => {
      if (settled) return
      settled = true
      if (timer !== null) clearTimeout(timer)
      // Destroy WITHOUT stripping the error listeners: a socket torn down
      // mid-stream reports ECONNRESET/ECONNABORTED through them a tick
      // later, and every handler below is settled-guarded — the silence is
      // intentional, and removing the listeners would turn that expected
      // report into an uncaught 'error' emission.
      if (socket !== null) socket.destroy()
      if (typeof call.signal?.removeEventListener === 'function') call.signal.removeEventListener('abort', onAbort)
      resolve(outcome)
    }
    const onAbort = () => {
      if (socket !== null) socket.destroy()
      finish({ ok: true, cancelled: true })
    }
    if (call.signal?.aborted === true) {
      finish({ ok: true, cancelled: true })
      return
    }
    if (call.signal && typeof call.signal.addEventListener === 'function') {
      call.signal.addEventListener('abort', onAbort, { once: true })
    }
    if (deadline !== undefined && (typeof call.now === 'function' ? call.now() : Date.now()) >= deadline) {
      finish({ ok: false, code: 'WEB_TIMEOUT', detail: 'the wall-time bound was already spent before the request left' })
      return
    }
    if (deadline !== undefined) {
      const remain = deadline - (typeof call.now === 'function' ? call.now() : Date.now())
      timer = setTimeout(() => {
        if (socket !== null) socket.destroy()
        finish({ ok: false, code: 'WEB_TIMEOUT', detail: 'the governed fetch exceeded its wall-time bound; nothing was delivered' })
      }, Math.max(remain, 0))
      if (typeof timer?.unref === 'function') timer.unref()
    }

    const chunks = []
    let received = 0
    let overran = false
    const requestImpl = target.protocol === 'http:' ? httpRequest : httpsRequest
    const req = requestImpl(target, {
      // No redirect following: the ROW drives every hop (a hop is a
      // mechanics-gated decision, and the hop chain is bounded there).
      // No credential material, no cookie jar: only the Host header Node
      // derives from the URL itself.
      headers: { accept: '*/*' },
      // THE PIN (H-2): this lookup is the only DNS answer this socket can
      // ever see — the address the law just checked, exactly.
      lookup: pinned.lookup,
      // The TLS defaults of the runtime stand: untrusted certificates are
      // refused (an operator that trusts a local test CA opts in through
      // the runtime's own trust store, never through this row). The
      // servername stays the URL's hostname, so certificate validation is
      // against the ORIGINAL host, never the pinned address.
      timeout: 0,
    }, (res) => {
      const statusCode = res.statusCode ?? 0
      const location = typeof res.headers?.location === 'string' ? res.headers.location : undefined
      const contentType = typeof res.headers?.['content-type'] === 'string' ? res.headers['content-type'] : undefined
      res.on('data', (chunk) => {
        received += chunk.length
        if (received > maxBytes) {
          overran = true
          res.destroy()
          finish({ ok: false, code: 'WEB_RESPONSE_TOO_LARGE', detail: `the response exceeds the ${String(maxBytes)}-byte bound; the whole response is refused and nothing is delivered` })
          return
        }
        chunks.push(chunk)
      })
      res.on('end', () => {
        if (overran || settled) return
        const bodyBytes = Buffer.concat(chunks)
        finish({
          ok: true,
          statusCode,
          ...(location === undefined ? {} : { location }),
          ...(contentType === undefined ? {} : { contentType }),
          bodyBytes,
          receivedBytes: received,
        })
      })
      res.on('error', (error) => {
        if (overran || settled) return
        finish({ ok: false, code: 'WEB_TRANSPORT_FAILED', detail: `the response stream failed (${sanitize(error)})` })
      })
    })
    socket = req
    req.on('error', (error) => {
      if (settled) return
      const code = error?.code === 'ABORTED' || call.signal?.aborted === true ? 'cancelled' : 'WEB_TRANSPORT_FAILED'
      if (code === 'cancelled') finish({ ok: true, cancelled: true })
      else finish({ ok: false, code: 'WEB_TRANSPORT_FAILED', detail: `the request failed (${sanitize(error)})` })
    })
    req.end()
  })
  }

  return Object.freeze({ id: WEB_TRANSPORT_ID, fetchBounded })
}

/** The search transport face of the SAME port: a provider that talks HTTP
 *  rides `postJson`, bounded exactly like a fetch (bytes in, bytes out,
 *  wall time, closed errors, no headers back). The scheme acceptance
 *  mirrors the mount's opt (the provider law validated its destination
 *  against the SAME opt — one face, one law).
 *
 *  THE ENDPOINT PIN (REVIEW-403 H-3): a provider-supplied URL is an
 *  UNDECLARED, UNREQUESTED network effect unless the MOUNT declared it.
 *  So this port POSTs only to origins the trusted mount listed as the
 *  provider's destinations (`allowedOrigins` — the same frozen set the
 *  contribution declares and the PA requested set carries). Any other
 *  origin — from a provider response, a redirect body, anywhere — is
 *  refused typed `WEB_SEARCH_DESTINATION_DENIED` with zero wire. No
 *  declared origins means NOTHING is reachable (empty is fail-closed,
 *  never "anything goes"). */
export function createWebTransportSearchPort(transport, options = {}) {
  if (transport === null || typeof transport !== 'object' || typeof transport.fetchBounded !== 'function') {
    throw new TypeError('WEB_SEARCH_TRANSPORT_PORT_REQUIRED: the search port wraps the ONE web transport')
  }
  const allowHttpLoopback = options.allowHttpLoopback === true
  const allowedOrigins = Object.freeze(Array.isArray(options.allowedOrigins) ? [...options.allowedOrigins] : [])
  const resolver = typeof options.resolver === 'function' ? options.resolver : defaultResolver
  return Object.freeze({
    id: `${String(transport.id)}/search`,
    /**
     * One bounded POST of a JSON body; answers the parsed JSON object (or a
     * typed failure). Bodies above `maxBytes` are refused whole; a
     * non-JSON 2xx is a typed failure (the row never guesses).
     */
    postJson: async ({ url, json, maxBytes, timeoutMs, deadlineAt, now, signal }) => {
      let endpoint
      try {
        endpoint = new URL(String(url))
      } catch {
        return { ok: false, code: 'WEB_SEARCH_DESTINATION_DENIED', detail: 'the provider asked for a url this port cannot parse; the POST was refused, zero wire' }
      }
      if (!allowedOrigins.includes(endpoint.origin)) {
        return { ok: false, code: 'WEB_SEARCH_DESTINATION_DENIED', detail: `the provider asked for ${endpoint.origin}, which the trusted mount never declared as a provider destination; the POST was refused, zero wire` }
      }
      const payload = Buffer.from(JSON.stringify(json ?? {}), 'utf8')
      const outcome = await boundedPost({ url: endpoint, payload, maxBytes, timeoutMs, deadlineAt, now, signal, allowHttpLoopback, resolver })
      if (outcome.ok !== true) return outcome
      if (outcome.statusCode < 200 || outcome.statusCode >= 300) {
        return { ok: false, code: 'WEB_SEARCH_PROVIDER_STATUS', detail: `the provider answered ${String(outcome.statusCode)}` }
      }
      try {
        return { ok: true, json: JSON.parse(outcome.bodyBytes.toString('utf8')) }
      } catch {
        return { ok: false, code: 'WEB_SEARCH_PROVIDER_STATUS', detail: 'the provider answered with a body that is not JSON' }
      }
    },
  })
}

/** Minimal bounded POST over the same https module (kept beside the port
 *  so the ONE socket module owns both legs; response bound + deadline copy
 *  the fetch law). Carries the SAME resolve-once/check-all/pin law as the
 *  fetch leg — the search wire is not a second, ungated socket. */
async function boundedPost({ url: target, payload, maxBytes, timeoutMs, deadlineAt, now, signal, allowHttpLoopback, resolver }) {
  if (target.protocol !== 'https:') {
    if (!(allowHttpLoopback === true && target.protocol === 'http:' && isLoopbackHost(target.hostname))) {
      return { ok: false, code: 'WEB_TRANSPORT_FAILED', detail: `the transport refuses ${target.protocol} ${target.hostname} on this mount` }
    }
  }
  // H-1/H-2 on the provider leg too: one resolve, whole-set check, pinned
  // connect — a provider calling a rebinding host is refused exactly like
  // a governed fetch would be.
  const pinned = await checkAndPin(target, { resolver, allowHttpLoopback })
  if (pinned.ok !== true) return pinned
  const cap = Number.isInteger(maxBytes) && maxBytes > 0 ? maxBytes : Number.MAX_SAFE_INTEGER
  const started = typeof now === 'function' ? now() : Date.now()
  const deadline = Number.isFinite(deadlineAt) ? deadlineAt : Number.isFinite(timeoutMs) && timeoutMs > 0 ? started + timeoutMs : undefined
  return await new Promise((resolve) => {
    let settled = false
    let socket = null
    let timer = null
    const finish = (outcome) => {
      if (settled) return
      settled = true
      if (timer !== null) clearTimeout(timer)
      if (socket !== null) socket.destroy()
      if (typeof signal?.removeEventListener === 'function') signal.removeEventListener('abort', onAbort)
      resolve(outcome)
    }
    const onAbort = () => {
      if (socket !== null) socket.destroy()
      finish({ ok: true, cancelled: true })
    }
    if (signal?.aborted === true) {
      finish({ ok: true, cancelled: true })
      return
    }
    if (signal && typeof signal.addEventListener === 'function') signal.addEventListener('abort', onAbort, { once: true })
    if (deadline !== undefined) {
      const remain = deadline - (typeof now === 'function' ? now() : Date.now())
      if (remain <= 0) {
        finish({ ok: false, code: 'WEB_TIMEOUT', detail: 'the wall-time bound was already spent before the request left' })
        return
      }
      timer = setTimeout(() => {
        if (socket !== null) socket.destroy()
        finish({ ok: false, code: 'WEB_TIMEOUT', detail: 'the governed search exceeded its wall-time bound; nothing was delivered' })
      }, remain)
      if (typeof timer?.unref === 'function') timer.unref()
    }
    const chunks = []
    let received = 0
    const requestImpl = target.protocol === 'http:' ? httpRequest : httpsRequest
    const req = requestImpl(target, {
      method: 'POST',
      // THE PIN again (H-2 on the search leg): the checked address only.
      lookup: pinned.lookup,
      headers: { 'content-type': 'application/json', 'content-length': String(payload.length) },
    }, (res) => {
      const statusCode = res.statusCode ?? 0
      res.on('data', (chunk) => {
        received += chunk.length
        if (received > cap) {
          res.destroy()
          finish({ ok: false, code: 'WEB_RESPONSE_TOO_LARGE', detail: `the provider response exceeds the ${String(cap)}-byte bound; refused whole` })
          return
        }
        chunks.push(chunk)
      })
      res.on('end', () => finish({ ok: true, statusCode, bodyBytes: Buffer.concat(chunks), receivedBytes: received }))
      res.on('error', (error) => finish({ ok: false, code: 'WEB_TRANSPORT_FAILED', detail: `the provider stream failed (${sanitize(error)})` }))
    })
    socket = req
    req.on('error', (error) => {
      if (signal?.aborted === true) finish({ ok: true, cancelled: true })
      else finish({ ok: false, code: 'WEB_TRANSPORT_FAILED', detail: `the provider request failed (${sanitize(error)})` })
    })
    req.end(payload)
  })
}

/** Closed sanitization of a socket error: the error's own machine code or
 *  name, nothing else — no URL (a query can carry a key), no peer body. */
function sanitize(error) {
  const code = typeof error?.code === 'string' ? error.code : ''
  const name = typeof error?.name === 'string' ? error.name : 'Error'
  return code !== '' ? code : name
}

/** The closed transport-code vocabulary (the executor refuses anything
 *  outside it fail-closed — a code no review read is never relayed). */
export function isTransportCode(code) {
  return TRANSPORT_CODES.has(String(code))
}
