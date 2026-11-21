/**
 * fixture-server.mjs — the LOOPBACK FIXTURE SERVER the web baseline talks to.
 *
 * WHY A REAL SERVER. The web family's effect is "bytes left the process and a
 * body came back". A fake provider would make the request log and the byte
 * counts properties of the fake, so this lane stands up a real `node:http`
 * server on `127.0.0.1` (sanctioned test band, port 3182 — never 3080, see
 * `tests/paths.mjs`) and records what it actually served:
 *
 *   log[]        one entry per request ARRIVAL, in order: method, path, seq;
 *   bytesWritten per completed response (the bytes the server really wrote);
 *   sockets      the accepted-connection count.
 *
 * The corpus pins those as effects, so "one fetch" is a served request, not a
 * claim about a provider object.
 *
 * DETERMINISM. Every route has a fixed body, a fixed content type and (where it
 * matters) a fixed declared `content-length`; nothing here reads the clock, the
 * environment or the hostname. The one time-dependent route (`/slow`) is only
 * used by the timeout vector, whose record deliberately excludes the response
 * bytes (the socket is destroyed first) and keeps the ARRIVAL count, which is
 * deterministic.
 *
 * TEARDOWN. `close()` cancels every pending route timer, destroys every accepted
 * socket and closes the listener, so a later vector binds the same port without
 * inheriting a straggler.
 *
 * @module tests/ute-g1-web/lib/fixture-server
 */
import { createServer } from 'node:http'

/** The sanctioned loopback port this lane binds (3180-band; never the stable 3080). */
export const FIXTURE_PORT = 3182

/** The fixture origin every declared URL in the corpus uses. */
export const FIXTURE_ORIGIN = `http://127.0.0.1:${String(FIXTURE_PORT)}`

/** The deterministic text body of `/text`. */
export const TEXT_BODY = 'UTE-WEB-B1 deterministic text body.\n'

/** The 500-character body of `/truncate` (the provider's character cap cuts it). */
export const TRUNCATE_BODY = `${'w'.repeat(499)}\n`

/** The 4096-byte body of `/big` (the provider's byte cap refuses it). */
export const BIG_BODY = `${'b'.repeat(4095)}\n`

/** The 404 body (an HTTP error status is DATA to `web_fetch`, not a refusal). */
export const NOT_FOUND_BODY = 'UTE-WEB-B1: the fixture has no such page.\n'

/** The HTML body `/html` renders through the pinned turndown conversion. */
export const HTML_BODY = [
  '<!doctype html><html><head><title>t</title><style>.x{color:red}</style></head><body>',
  '<h1>UTE Web B1</h1><p>Fixture <strong>paragraph</strong>.</p>',
  '<table><thead><tr><th>Left</th><th>Right</th></tr></thead>',
  '<tbody><tr><td>alpha</td><td>beta</td></tr></tbody></table>',
  '<script>console.log("dropped")</script>',
  '</body></html>',
].join('')

/** The JSON the fixture search API answers (five sources; the seam caps them). */
export const SEARCH_SOURCES = Object.freeze([
  Object.freeze({ title: 'One', url: 'https://source.test/one', snippet: 'alpha snippet' }),
  Object.freeze({ title: 'Two', url: 'https://source.test/two', snippet: 'beta snippet' }),
  Object.freeze({ title: 'Three', url: 'https://source.test/three', snippet: 'gamma snippet' }),
  Object.freeze({ title: 'Four', url: 'https://source.test/four', snippet: 'delta snippet' }),
  Object.freeze({ title: 'Five', url: 'https://source.test/five', snippet: 'epsilon snippet' }),
])

/**
 * Start the fixture server and answer its handle.
 *
 * @param {{port?: number, delayMs?: number}} [options] - `delayMs` is `/slow`'s hold.
 * @returns {Promise<{origin: string, port: number, log: object[], close: () => Promise<void>}>}
 */
export async function startFixtureServer({ port = FIXTURE_PORT, delayMs = 1500 } = {}) {
  /** @type {{method: string, path: string, bytesWritten: number}[]} */
  const log = []
  const timers = new Set()
  const accepted = new Set()
  let sockets = 0

  const send = (res, status, contentType, body, extraHeaders = {}) => {
    const bytes = Buffer.byteLength(body, 'utf8')
    const entry = log.at(-1)
    res.writeHead(status, {
      'content-type': contentType,
      'content-length': String(bytes),
      ...extraHeaders,
    })
    res.end(body)
    if (entry !== undefined) entry.bytesWritten = bytes
  }

  const server = createServer((req, res) => {
    const path = new URL(req.url ?? '/', FIXTURE_ORIGIN).pathname
    log.push({ method: req.method ?? '<none>', path, bytesWritten: 0 })
    if (req.method === 'POST' && path === '/search-api') {
      const chunks = []
      req.on('data', (chunk) => chunks.push(Buffer.from(chunk)))
      req.on('end', () => {
        let query = null
        let maxResults = null
        try {
          const parsed = JSON.parse(Buffer.concat(chunks).toString('utf8'))
          query = typeof parsed.query === 'string' ? parsed.query : null
          maxResults = typeof parsed.maxResults === 'number' ? parsed.maxResults : null
        } catch {
          query = null
        }
        const payload = JSON.stringify({
          query,
          maxResults,
          content: `Fixture summary for ${String(query)}.`,
          sources: SEARCH_SOURCES,
          truncated: false,
        })
        send(res, 200, 'application/json; charset=utf-8', payload)
      })
      return
    }
    switch (path) {
      case '/text':
        send(res, 200, 'text/plain; charset=utf-8', TEXT_BODY)
        return
      case '/html':
        send(res, 200, 'text/html; charset=utf-8', HTML_BODY)
        return
      case '/r1':
        send(res, 302, 'text/plain; charset=utf-8', '', { location: '/r2' })
        return
      case '/r2':
        send(res, 302, 'text/plain; charset=utf-8', '', { location: '/final' })
        return
      case '/final':
        send(res, 200, 'text/plain; charset=utf-8', 'UTE-WEB-B1 redirect target.\n')
        return
      case '/loop':
        send(res, 302, 'text/plain; charset=utf-8', '', { location: '/loop' })
        return
      case '/missing':
        send(res, 404, 'text/plain; charset=utf-8', NOT_FOUND_BODY)
        return
      case '/binary':
        send(res, 200, 'application/octet-stream', 'binary-ish')
        return
      case '/big':
        send(res, 200, 'text/plain; charset=utf-8', BIG_BODY)
        return
      case '/truncate':
        send(res, 200, 'text/plain; charset=utf-8', TRUNCATE_BODY)
        return
      case '/slow': {
        res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8', 'content-length': String(Buffer.byteLength('late body\n')) })
        const timer = setTimeout(() => {
          timers.delete(timer)
          res.end('late body\n')
          const entry = log.at(-1)
          if (entry !== undefined) entry.bytesWritten = Buffer.byteLength('late body\n')
        }, delayMs)
        timers.add(timer)
        return
      }
      default:
        send(res, 404, 'text/plain; charset=utf-8', 'UTE-WEB-B1: unknown fixture route.\n')
    }
  })
  server.on('connection', (socket) => {
    sockets += 1
    accepted.add(socket)
    socket.on('close', () => accepted.delete(socket))
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen({ port, host: '127.0.0.1', exclusive: true }, () => {
      server.removeListener('error', reject)
      resolve()
    })
  })

  return Object.freeze({
    origin: `http://127.0.0.1:${String(port)}`,
    port,
    get log() {
      return log
    },
    sockets: () => sockets,
    async close() {
      for (const timer of timers) clearTimeout(timer)
      timers.clear()
      for (const socket of accepted) socket.destroy()
      accepted.clear()
      await new Promise((resolve) => server.close(() => resolve()))
    },
  })
}
