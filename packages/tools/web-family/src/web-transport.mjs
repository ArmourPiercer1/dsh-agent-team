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
import { isLoopbackHost } from './web-mechanics.mjs'

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

/** One bounded response OR a typed transport failure (closed code set). */
const TRANSPORT_CODES = new Set(['WEB_TIMEOUT', 'WEB_RESPONSE_TOO_LARGE', 'WEB_TRANSPORT_FAILED', 'cancelled'])

/**
 * Build the production transport port. Trusted construction options only —
 * nothing here is model-visible.
 *
 * @param {{ connectTimeoutMs?: number, allowHttpLoopback?: boolean }} [options]
 *   `connectTimeoutMs` is a construction default for the whole-call bound;
 *   the EXECUTOR's per-call `timeoutMs`/`deadlineAt` always wins.
 *   `allowHttpLoopback` is the trusted offline-evidence opt (loopback
 *   plain-http targets only); it can NEVER widen past loopback.
 */
export function createWebTransport(options = {}) {
  const defaultTimeoutMs = Number.isFinite(options.connectTimeoutMs) && options.connectTimeoutMs > 0
    ? options.connectTimeoutMs
    : undefined
  const allowHttpLoopback = options.allowHttpLoopback === true

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
  const fetchBounded = (call) => new Promise((resolve) => {
    if (typeof call?.url !== 'string') {
      resolve({ ok: false, code: 'WEB_TRANSPORT_FAILED', detail: 'the transport was handed no url' })
      return
    }
    let target
    try {
      target = new URL(call.url)
    } catch {
      resolve({ ok: false, code: 'WEB_TRANSPORT_FAILED', detail: 'the transport was handed an unparseable url' })
      return
    }
    if (!transportAccepts(target, allowHttpLoopback)) {
      // The mechanics gate https (or the opted-in loopback http) BEFORE
      // admission; anything else reaching the wire port is a broken
      // assembly — refuse loudly, fetch nothing.
      resolve({ ok: false, code: 'WEB_TRANSPORT_FAILED', detail: `the transport refuses ${target.protocol} ${target.hostname} on this mount — the mechanics gate should have refused it before the wire` })
      return
    }
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
      // The TLS defaults of the runtime stand: untrusted certificates are
      // refused (an operator that trusts a local test CA opts in through
      // the runtime's own trust store, never through this row).
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

  return Object.freeze({ id: WEB_TRANSPORT_ID, fetchBounded })
}

/** The search transport face of the SAME port: a provider that talks HTTP
 *  rides `postJson`, bounded exactly like a fetch (bytes in, bytes out,
 *  wall time, closed errors, no headers back). The scheme acceptance
 *  mirrors the mount's opt (the provider law validated its destination
 *  against the SAME opt — one face, one law). */
export function createWebTransportSearchPort(transport, options = {}) {
  if (transport === null || typeof transport !== 'object' || typeof transport.fetchBounded !== 'function') {
    throw new TypeError('WEB_SEARCH_TRANSPORT_PORT_REQUIRED: the search port wraps the ONE web transport')
  }
  const allowHttpLoopback = options.allowHttpLoopback === true
  return Object.freeze({
    id: `${String(transport.id)}/search`,
    /**
     * One bounded POST of a JSON body; answers the parsed JSON object (or a
     * typed failure). Bodies above `maxBytes` are refused whole; a
     * non-JSON 2xx is a typed failure (the row never guesses).
     */
    postJson: async ({ url, json, maxBytes, timeoutMs, deadlineAt, now, signal }) => {
      const payload = Buffer.from(JSON.stringify(json ?? {}), 'utf8')
      const outcome = await boundedPost({ url, payload, maxBytes, timeoutMs, deadlineAt, now, signal, allowHttpLoopback })
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
 *  the fetch law). */
async function boundedPost({ url, payload, maxBytes, timeoutMs, deadlineAt, now, signal }) {
  // The fetch port's bound law, reused through its own gate: re-enter the
  // https module directly with a body. Deliberately parallel code — one
  // audited socket module, two entry points, no policy.
  let target
  try {
    target = new URL(url)
  } catch {
    return { ok: false, code: 'WEB_TRANSPORT_FAILED', detail: 'the transport was handed an unparseable url' }
  }
  if (target.protocol !== 'https:') {
    return { ok: false, code: 'WEB_TRANSPORT_FAILED', detail: `the https transport refuses ${target.protocol}` }
  }
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
    const req = httpsRequest(target, {
      method: 'POST',
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
