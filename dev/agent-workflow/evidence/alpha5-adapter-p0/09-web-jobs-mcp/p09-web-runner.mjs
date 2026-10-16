#!/usr/bin/env node
/**
 * p09-web-runner.mjs — Alpha.5 P0-9 web family (fixture-level, loopback ONLY).
 *
 * WHAT THIS IS: a plain-node fixture over the PREBUILT public libs of the
 * pristine 0.2.0-rc.2 test-use checkout (639ed01539). Production modules
 * mounted DIRECTLY: dsh-web (ctx.web seam), dsh-tool-web (native web_fetch),
 * dsh-web-fetch-http (production 'http' provider). A synthetic HTTP fixture
 * server on 127.0.0.1:3187 (Team-owned) provides assertable pages; a second
 * 127.0.0.1:3188 listener is a tripwire for cross-origin redirect targets.
 * The Team-composed web_fetch Adapter (Agent A scope) implements its own
 * fetch with a host allow-list {127.0.0.1:3187}, same-origin redirect policy,
 * byte caps and a timeout — the adapter-side pre-fetch interception counters
 * are the primary evidence channel (plan §1.2), together with the fixture
 * server's access log (server-side zero-connection proof).
 *
 * SAFETY: loopback-only. globalThis.fetch is wrapped by a loopback tripwire
 * (any non-allowed target = recorded BLOCK + rejected, never issued). Proxy
 * env vars are deleted in-process (recorded). Denied-target legs (127.0.0.1:9,
 * 10.255.255.1) prove policy denial BEFORE any fetch call: interception
 * counter +0 fetch invocations, 0 fixture access-log rows, 0 tripwire
 * attempts. No DNS is ever issued for 10.255.255.1 (the policy check is a
 * hostname string check before the invoker).
 *
 * TEST DOUBLE disclosure: the Team Adapter's fetch path and the fixture
 * servers are Team-owned fixture code, NOT pinned production code; pinned
 * production code in this runner = the web seam, tool-web's native web_fetch,
 * and web-fetch-http's provider (used on the B leg where it fail-closes with
 * WEB_BLOCKED_URL for loopback). p00-fixture junctions reused; NO new
 * junctions (extra packages = absolute file-URL imports).
 *
 * Verdict discipline: fixture level only — family verdict is at most
 * INCONCLUSIVE (directional). No GO is writable here.
 *
 * Usage: node dev/agent-workflow/evidence/alpha5-adapter-p0/09-web-jobs-mcp/p09-web-runner.mjs
 * Exit 0 = every leg matched its pinned-before-run expectation; 1 = assertion
 * failure; 2 = environment. Idempotent (servers closed in finally; scratch
 * recreated).
 */
import { createServer } from 'node:http'
import { writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { makeFixture, countingTool, tag } from '../00-baseline/p00-fixture.mjs'
import { HERE, envHeader, makeLedger, installLoopbackTripwire, stripProxyEnv, libUrl, scratch } from './p09-shared.mjs'

const PORT = 3187
const TRIP_PORT = 3188
const TOKEN = 'ALPHA5-P09-WEBPAGE-7c31'
const ADAPTER_MAX_BYTES = 65536
const ADAPTER_TIMEOUT_MS = 800
const ADAPTER_ALLOWED = new Set([`127.0.0.1:${PORT}`])

const { results, expect } = makeLedger('W')
const observations = {}

/* ---------------- fixture HTTP servers (Team-owned) ---------------- */
const accessLog = []
const tripLog = []
const PAGE_HTML = `<!doctype html><html><head><title>p09</title></head><body><h1>${TOKEN}</h1><p>deterministic synthetic page for Alpha.5 P0-9 web fixture leg.</p></body></html>`

function serve(scratchDir) {
  const main = createServer((req, res) => {
    accessLog.push({ at: Date.now(), method: req.method, url: req.url, host: req.headers.host ?? '' })
    const url = req.url ?? '/'
    if (url === '/page') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
      res.end(PAGE_HTML)
    } else if (url === '/redirect-same') {
      res.writeHead(302, { location: '/page' })
      res.end()
    } else if (url === '/redirect-cross') {
      res.writeHead(302, { location: `http://127.0.0.1:${TRIP_PORT}/landmine` })
      res.end()
    } else if (url === '/big-declared') {
      res.writeHead(200, { 'content-type': 'text/plain', 'content-length': String(300000) })
      // declared length lies above the adapter cap; stream a short body (client must
      // refuse on the DECLARED cap before reading, mirroring provider.ts readCapped)
      res.end('x'.repeat(1024))
    } else if (url === '/big-stream') {
      res.writeHead(200, { 'content-type': 'text/plain' }) // chunked, no content-length
      let sent = 0
      const chunk = 'y'.repeat(16384)
      const pump = () => {
        while (sent < 300000) {
          sent += chunk.length
          if (!res.write(chunk)) { res.once('drain', pump); return }
        }
        res.end()
      }
      pump()
    } else if (url === '/missing') {
      res.writeHead(404, { 'content-type': 'text/plain' })
      res.end('fixture-not-found')
    } else if (url === '/slow') {
      setTimeout(() => { if (!res.writableEnded) { res.writeHead(200, { 'content-type': 'text/plain' }); res.end('slow-arrived') } }, 1500)
    } else {
      res.writeHead(400, { 'content-type': 'text/plain' })
      res.end('bad-route')
    }
  })
  const trip = createServer((req, res) => {
    tripLog.push({ at: Date.now(), method: req.method, url: req.url })
    res.writeHead(200); res.end('tripwire-hit')
  })
  return new Promise((resolve, reject) => {
    let ready = 0
    const done = () => { ready += 1; if (ready === 2) resolve({ main, trip }) }
    main.once('error', reject)
    trip.once('error', reject)
    main.listen(PORT, '127.0.0.1', done)
    trip.listen(TRIP_PORT, '127.0.0.1', done)
  })
}

/* ---------------- Team-composed web_fetch Adapter (fixture code) ---------------- */
import { defineTool } from '@deepseek-ai/dsh-tools'
function teamWebFetchAdapter(obs) {
  const counters = { bodyRuns: 0, intercepted: 0, fetchInvocations: 0, redirectsFollowed: 0, redirectsDenied: 0 }
  // fetch invoker (counted; the ONLY place this adapter can touch a socket)
  async function fetchWithPolicy(startUrl) {
    let current = startUrl
    for (let hops = 0; hops <= 2;) {
      counters.fetchInvocations += 1
      const ac = new AbortController()
      const timer = setTimeout(() => ac.abort(new Error('TEAM_ADAPTER_TIMEOUT')), ADAPTER_TIMEOUT_MS)
      let res
      try {
        res = await fetch(current.toString(), { redirect: 'manual', signal: ac.signal })
      } catch (err) {
        clearTimeout(timer)
        if (ac.signal.aborted) throw new Error('TEAM_ADAPTER_TIMEOUT after budget')
        throw err
      }
      clearTimeout(timer)
      const status = res.status
      if ([301, 302, 303, 307, 308].includes(status)) {
        const loc = res.headers.get('location')
        await res.body?.cancel().catch(() => {})
        if (loc === null) throw new Error('TEAM_ADAPTER_REDIRECT_NO_LOCATION')
        const target = new URL(loc, current)
        const tport = target.port !== '' ? target.port : target.protocol === 'https:' ? '443' : '80'
        const cport = current.port !== '' ? current.port : current.protocol === 'https:' ? '443' : '80'
        if (target.protocol !== current.protocol || target.hostname !== current.hostname || tport !== cport) {
          counters.redirectsDenied += 1
          throw new Error(`TEAM_ADAPTER_REDIRECT_DENIED cross-origin:${target.hostname}:${tport}`)
        }
        if (!ADAPTER_ALLOWED.has(`${target.hostname}:${tport}`)) { counters.intercepted += 1; throw new Error(`TEAM_ADAPTER_DENY redirect-host:${target.hostname}:${tport}`) }
        counters.redirectsFollowed += 1
        current = target
        hops += 1
        continue
      }
      const declared = res.headers.get('content-length')
      if (declared !== null && Number(declared) > ADAPTER_MAX_BYTES) {
        await res.body?.cancel().catch(() => {})
        throw new Error(`TEAM_ADAPTER_TOO_LARGE declared:${declared}>cap:${ADAPTER_MAX_BYTES}`)
      }
      const reader = res.body?.getReader()
      const chunks = []
      let total = 0
      let truncated = false
      if (reader) {
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          const room = ADAPTER_MAX_BYTES - total
          if (value.byteLength > room) { chunks.push(value.subarray(0, room)); total += room; truncated = true; await reader.cancel().catch(() => {}); break }
          chunks.push(value); total += value.byteLength
        }
      }
      const content = Buffer.concat(chunks).toString('utf8')
      const kind = (res.headers.get('content-type') ?? '').includes('html') ? 'html' : 'text'
      return { url: current.toString(), statusCode: status, kind, content, truncated }
    }
    throw new Error('TEAM_ADAPTER_REDIRECT_LOOP')
  }
  const def = defineTool({
    name: 'web_fetch',
    description: 'Team-composed web_fetch adapter (P0-9 fixture): loopback allow-list fetch.',
    parameters: { url: { type: 'string', required: true, description: 'The HTTP(S) URL to fetch.' } },
    output: {
      schema: {
        type: 'object',
        additionalProperties: false,
        properties: {
          url: { type: 'string', required: true },
          statusCode: { type: 'integer', required: true },
          body: { type: 'object', required: true, additionalProperties: false, properties: { kind: { type: 'string', required: true }, content: { type: 'string', required: true } } },
          truncated: { type: 'boolean', required: true },
        },
      },
      render: (_args, value) => [{ type: 'text', text: `${value.statusCode} ${value.url}\n${value.body.content.slice(0, 400)}${value.truncated ? '\n[truncated]' : ''}` }],
    },
    async execute(args, exec) {
      counters.bodyRuns += 1
      obs.push({ event: 'body', name: 'web_fetch', identity: 'ADAPTER.web_fetch', scopeId: exec?.agent?.id ?? '(agentless)', callId: String(exec?.callId ?? '?') })
      // --- policy gate BEFORE any network call (interception counters) ---
      let url
      try { url = new URL(String(args.url)) } catch { counters.intercepted += 1; throw new Error('TEAM_ADAPTER_DENY invalid-url') }
      if (url.protocol !== 'http:' && url.protocol !== 'https:') { counters.intercepted += 1; throw new Error(`TEAM_ADAPTER_DENY scheme:${url.protocol}`) }
      const port = url.port !== '' ? url.port : url.protocol === 'https:' ? '443' : '80'
      if (!ADAPTER_ALLOWED.has(`${url.hostname}:${port}`)) {
        counters.intercepted += 1
        throw new Error(`TEAM_ADAPTER_DENY host-not-allowed:${url.hostname}:${port} (allow-list = {${[...ADAPTER_ALLOWED].join(',')}})`)
      }
      const fetched = await fetchWithPolicy(url)
      return { url: fetched.url, statusCode: fetched.statusCode, body: { kind: fetched.kind, content: fetched.content }, truncated: fetched.truncated }
    },
  })
  Object.defineProperty(def, '__p09counters', { value: counters })
  return tag(def, 'ADAPTER.web_fetch')
}

/* ---------------- run ---------------- */
const proxyRemoved = stripProxyEnv()
const tripwire = installLoopbackTripwire(ADAPTER_ALLOWED)
let servers = null
let header = null
try {
  servers = await serve(scratch('web'))
  header = envHeader({ port_main: PORT, port_tripwire: TRIP_PORT, proxy_env_removed: proxyRemoved, adapter: { allow: [...ADAPTER_ALLOWED], maxBytes: ADAPTER_MAX_BYTES, timeoutMs: ADAPTER_TIMEOUT_MS } })

  const f = await makeFixture()
  const dshWeb = await import(libUrl('web', 'web'))
  const toolWeb = await import(libUrl('web', 'tool-web'))
  const webFetchHttp = await import(libUrl('web', 'web-fetch-http'))
  observations.inject_surfaces = { web: 'dsh-web = WebRuntime Service (ctx.web)', toolWeb: toolWeb.inject, webFetchHttp: webFetchHttp.inject }

  await f.ctx.plugin(dshWeb.default, { fetchProvider: 'http' })
  await f.ctx.plugin(webFetchHttp, {})
  await f.ctx.plugin(toolWeb, { search: false, fetch: true })
  const A = await f.mintScope('agent-A')
  const B = await f.mintScope('agent-B')
  const nativeDef = f.ctx.tools.get('web_fetch')
  if (nativeDef) { try { tag(nativeDef, 'NATIVE.web_fetch') } catch { /* frozen guard — resolution name stays 'untagged' */ } }
  expect('W1.mount-and-registers-native', typeof f.ctx.web?.fetch === 'function' && f.ctx.tools.schemas().map((s) => s.name).join(',') === 'web_fetch',
    `ctx.web=${typeof f.ctx.web?.fetch} schemas=${JSON.stringify(f.ctx.tools.schemas().map((s) => s.name))} (search disabled by config)`)

  // W2 restrict-first + same-name adapter (P0-1 frozen assembly)
  const lift = A.scope.ctx.tools.restrict({ deny: ['web_fetch'] })
  const masked = f.resolution('web_fetch', A.key) === 'UNKNOWN'
  const adapter = teamWebFetchAdapter(f.obs)
  const disposeAdapter = A.scope.ctx.tools.register(adapter)
  expect('W2.restrict-first-then-adapter', masked && f.resolution('web_fetch', A.key) === 'ADAPTER.web_fetch' && f.resolution('web_fetch', B.key) === (nativeDef ? 'NATIVE.web_fetch' : 'untagged'),
    `masked=${String(masked)} A=${f.resolution('web_fetch', A.key)} B=${f.resolution('web_fetch', B.key)}`)

  const call = async (name, args, agent, seq) => {
    const res = await f.ctx.tools.execute({ signal: new AbortController().signal, callId: f.ToolCallId(`p09w-${String(seq)}`), name, arguments: args, ...(agent ? { agent } : {}) })
    return res
  }
  const textOf = (r) => (r.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('')

  // W3 A→adapter fetches synthetic page
  let logBase = accessLog.length
  const rA = await call('web_fetch', { url: `http://127.0.0.1:${PORT}/page` }, A.key, 1)
  expect('W3.A-adapter-gets-synthetic-page', rA.isError !== true && textOf(rA).includes(TOKEN)
    && f.counters('ADAPTER.web_fetch') === 1 && accessLog.length === logBase + 1,
    `A ran ADAPTER (count=${String(f.counters('ADAPTER.web_fetch'))}), page token present=${String(textOf(rA).includes(TOKEN))}, fixture accessLog +${String(accessLog.length - logBase)}`)

  // W4 deny legs: policy BEFORE fetch; zero connections initiated
  logBase = accessLog.length
  const tripBase = tripLog.length
  const invokerBase = adapter.__p09counters.fetchInvocations
  const interceptBase = adapter.__p09counters.intercepted
  const rDeny9 = await call('web_fetch', { url: 'http://127.0.0.1:9/' }, A.key, 2)
  const rDenyExt = await call('web_fetch', { url: 'http://10.255.255.1/' }, A.key, 3)
  const deniedText9 = textOf(rDeny9) + String(rDeny9.threw ?? '')
  const deniedTextExt = textOf(rDenyExt) + String(rDenyExt.threw ?? '')
  const attemptsToDenied = tripwire.attempts.filter((a) => a.target === '127.0.0.1:9' || a.target === '10.255.255.1:80').length
  expect('W4.deny-not-allowed-no-connection', rDeny9.isError === true && rDenyExt.isError === true
    && deniedText9.includes('TEAM_ADAPTER_DENY') && deniedTextExt.includes('TEAM_ADAPTER_DENY')
    && adapter.__p09counters.fetchInvocations === invokerBase
    && adapter.__p09counters.intercepted === interceptBase + 2
    && accessLog.length === logBase && tripLog.length === tripBase && attemptsToDenied === 0,
    `deny(:9)=${JSON.stringify(deniedText9.slice(0, 80))} deny(10.255.255.1)=${JSON.stringify(deniedTextExt.slice(0, 90))}; adapter fetchInvocations +${String(adapter.__p09counters.fetchInvocations - invokerBase)} [expect 0], intercepted +${String(adapter.__p09counters.intercepted - interceptBase)} [expect 2]; fixture accessLog +${String(accessLog.length - logBase)}, tripwire attempts-to-denied=${String(attemptsToDenied)} (never issued, never DNS'd — pre-invoker hostname check)`)

  // W5 redirects: same-origin followed; cross-origin denied, tripwire silent
  logBase = accessLog.length
  const rR = await call('web_fetch', { url: `http://127.0.0.1:${PORT}/redirect-same` }, A.key, 4)
  const sameOk = rR.isError !== true && textOf(rR).includes(TOKEN) && accessLog.length === logBase + 2
  logBase = accessLog.length
  const rX = await call('web_fetch', { url: `http://127.0.0.1:${PORT}/redirect-cross` }, A.key, 5)
  expect('W5.redirect-same-and-cross', sameOk && rX.isError === true && textOf(rX).includes('TEAM_ADAPTER_REDIRECT_DENIED') && tripLog.length === 0 && accessLog.length === logBase + 1,
    `same-origin followed=${String(sameOk)} (log +2); cross-origin denied=${String(rX.isError === true && textOf(rX).includes('REDIRECT_DENIED'))}, tripwire(:${TRIP_PORT}) hits=${String(tripLog.length)}`)

  // W6 oversize: declared cap refusal + stream truncation
  const rBigD = await call('web_fetch', { url: `http://127.0.0.1:${PORT}/big-declared` }, A.key, 6)
  const rBigS = await call('web_fetch', { url: `http://127.0.0.1:${PORT}/big-stream` }, A.key, 7)
  const bigSValue = rBigS.value ?? {}
  expect('W6.oversize-declared-refused-stream-truncated', rBigD.isError === true && String(textOf(rBigD)).includes('TEAM_ADAPTER_TOO_LARGE')
    && rBigS.isError !== true && bigSValue.truncated === true && (bigSValue.body?.content ?? '').length === ADAPTER_MAX_BYTES,
    `declared(300000>cap)=${JSON.stringify(String(textOf(rBigD)).slice(0, 60))}; stream truncated=${String(bigSValue.truncated)} contentLen=${String((bigSValue.body?.content ?? '').length)} (cap ${String(ADAPTER_MAX_BYTES)})`)

  // W7 404 is a result, not an error (seam semantics mirrored by the adapter)
  const r404 = await call('web_fetch', { url: `http://127.0.0.1:${PORT}/missing` }, A.key, 8)
  expect('W7.404-as-result', r404.isError !== true && r404.value?.statusCode === 404 && (r404.value?.body?.content ?? '').includes('fixture-not-found'),
    `statusCode=${String(r404.value?.statusCode)} isError=${String(r404.isError === true)}`)

  // W8 slow endpoint: adapter timeout aborts (server logged the attempt)
  logBase = accessLog.length
  const t0 = Date.now()
  const rSlow = await call('web_fetch', { url: `http://127.0.0.1:${PORT}/slow` }, A.key, 9)
  const dt = Date.now() - t0
  expect('W8.slow-endpoint-timeout', rSlow.isError === true && String(textOf(rSlow)).includes('TEAM_ADAPTER_TIMEOUT') && dt < 1400 && accessLog.length === logBase + 1,
    `timeout after ${String(dt)}ms (budget ${String(ADAPTER_TIMEOUT_MS)}ms), server logged the attempt (+${String(accessLog.length - logBase)}), error=${JSON.stringify(String(textOf(rSlow)).slice(0, 60))}`)

  // W9 B unaffected: B still dispatches the NATIVE definition; production
  // provider fail-closes loopback with WEB_BLOCKED_URL before any socket/DNS.
  const logB = accessLog.length
  const rB = await call('web_fetch', { url: `http://127.0.0.1:${PORT}/page` }, B.key, 10)
  const bText = textOf(rB)
  const adapterRunsBeforeB = f.counters('ADAPTER.web_fetch')
  expect('W9.B-native-unaffected-and-loopback-failclosed', rB.isError === true && /non-public|WEB_BLOCKED_URL/.test(bText) && accessLog.length === logB && f.counters('ADAPTER.web_fetch') === adapterRunsBeforeB,
    `B→NATIVE web_fetch ran and production provider refused loopback pre-socket: ${JSON.stringify(bText.slice(0, 110))}; fixture accessLog +${String(accessLog.length - logB)}; adapter count unchanged`)

  // W10 unload order: adapter disposed, mask lives → UNKNOWN, zero new fetches
  logBase = accessLog.length
  disposeAdapter()
  const resAfter = await call('web_fetch', { url: `http://127.0.0.1:${PORT}/page` }, A.key, 11)
  expect('W10.safe-unload-order', f.resolution('web_fetch', A.key) === 'UNKNOWN'
    && (resAfter.threw !== undefined || resAfter.isError === true || String(textOf(resAfter)).includes('unknown tool'))
    && accessLog.length === logBase,
    `afterUnload A=${f.resolution('web_fetch', A.key)} outcome=${JSON.stringify((resAfter.threw ?? textOf(resAfter)).slice(0, 60))} accessLog +${String(accessLog.length - logBase)}`)
  void lift

  observations.access_log = accessLog
  observations.tripwire = { attempts: tripwire.attempts, blocked: tripwire.blocked }
  observations.tripwire_server_hits = tripLog
  observations.body_counters = { adapter: f.counters('ADAPTER.web_fetch'), native_tagged: f.counters('NATIVE.web_fetch') }
} catch (err) {
  console.error('P09_WEB_ENV_FAIL', err?.stack ?? String(err))
  const out = { header: header ?? envHeader({}), error: String(err?.stack ?? err), results }
  writeFileSync(join(HERE, 'p09-web-result.json'), JSON.stringify(out, null, 2))
  process.exitCode = 2
} finally {
  tripwire.restore()
  if (servers) {
    servers.main.closeAllConnections()
    servers.trip.closeAllConnections()
    await new Promise((r) => servers.main.close(() => r()))
    await new Promise((r) => servers.trip.close(() => r()))
  }
}

if (process.exitCode !== 2) {
  const out = {
    header,
    observations,
    assertions: results,
    verdict: {
      family: 'web (ctx.web seam + tool-web web_fetch + web-fetch-http provider)',
      level: 'FIXTURE-LEVEL (loopback mock; NOT a real-host proof — no GO writable)',
      assembly: 'restrict-first + A-scope same-name adapter (P0-1 frozen interface) — reproduced on the web injection path',
      directional: results.every((r) => r.verdict === 'PASS')
        ? 'INCONCLUSIVE(方向性: supports composed Adapter) — A→Adapter 闭环拿合成页; 名单外 URL 在 fetch 调用前被拒且三路零连接证明(access-log=0/adapter 无 fetch 调用/tripwire 零尝试); B 原生面不受影响且生产 provider 对回环 fail-closed (WEB_BLOCKED_URL, 预 socket); 重定向/超限/404/超时语义闭环'
        : 'INCONCLUSIVE(fixtures not all green, see legs)',
      NOT_RUN: ['真实宿主 (cordis.yml 装配 + 真实 web_search provider)', 'spill/取消在 web 体上的表现', 'HTTP proxy 语义下的 Team 策略交互'],
    },
  }
  writeFileSync(join(HERE, 'p09-web-result.json'), JSON.stringify(out, null, 2))
  const pass = results.filter((r) => r.verdict === 'PASS').length
  console.log(`\nWRITTEN p09-web-result.json (${String(pass)}/${String(results.length)} PASS)`)
  process.exit(results.every((r) => r.verdict === 'PASS') ? 0 : 1)
}
