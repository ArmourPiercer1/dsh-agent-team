#!/usr/bin/env node
/**
 * m2w-c1-runner.mjs — M2-WEB-01 C1 fixture: web family negative/positive controls.
 *
 * WHAT THIS IS: a plain-node fixture (p00/p09 runner precedent — no new test
 * platform, no vitest file, no packages/** additions) over the PREBUILT public
 * libs of the pristine 0.2.0-rc.2 test-use checkout (tests/paths.mjs pin).
 * Pinned production code mounted DIRECTLY: dsh-web (ctx.web seam), dsh-tool-web
 * (native web_search + web_fetch), dsh-web-fetch-http (production 'http'
 * provider), dsh-web-search-deepseek (production 'deepseek-official' provider).
 * Shared helpers (ledger / tripwire / env strip / envHeader / libUrl) are
 * IMPORTED from the p09正本 (../../alpha5-adapter-p0/09-web-jobs-mcp/p09-shared.mjs)
 * and p00正本 (../alpha5-adapter-p0/00-baseline/p00-fixture.mjs) — no second
 * copy is made (root ruling 2026-10-23, M2-WEB-01 revision 1).
 *
 * PHASE N (negative, production provider): the production 'http' fetch provider
 * must refuse loopback / private-IP / credential-bearing / bad-scheme targets
 * with typed errors AT THE POLICY LAYER, before any transport starts (静态:
 * web-fetch-http policy.ts:31-36/47-52, network.ts:96-105; 实测: typed原文).
 * web_search with the production deepseek-official provider and NO API key
 * must refuse with WEB_PROVIDER_CREDENTIAL_MISSING before the endpoint call
 * (provider.ts authHeaders → apiKey() throw path).
 *
 * PHASE P (positive, OFFLINE provider stub): the seam's public registration
 * face (ctx.web.registerSearchProvider / registerFetchProvider — the same
 * public API the pinned production providers use) carries a Team-owned stub
 * pinned via the seam's OWN selection config (searchProvider/fetchProvider =
 * 'm2w-offline-stub'; production providers stay mounted but are never
 * selected). Success path proves tool-web's real schema/output machinery, and
 * the two-layer object: the search call's communication target is the stub
 * itself, while the RESULT URL (https://m2w-result.invalid/…) is never
 * contacted by anything — asserted through the observation surface below.
 *
 * OBSERVATION SURFACE (honest boundaries, root ruling revision 2):
 *  - loopback targets: server-side access log (+0 / +1) is REAL measured proof.
 *  - globalThis.fetch: tripwired (p09-shared installLoopbackTripwire) — every
 *    attempt recorded, non-allowed targets rejected without issuing. Covers
 *    the deepseek search provider (it calls fetch(endpoint)).
 *  - transport: net.Socket.prototype.connect is wrapped in-process; every TCP
 *    connect attempt is recorded, anything outside {127.0.0.1:3187} is
 *    destroyed before connecting (defense-in-depth tripwire, never silently
 *    passed). This is IN-PROCESS observation only.
 *  - 10.255.255.1 / *.invalid style targets CANNOT be tripwired externally
 *    (no sandbox-level syscall watch here, and the literal-IP path needs no
 *    DNS at all). For those legs the claim is ONLY: typed refusal (measured) +
 *    policy-before-transport (static, path:line) + zero in-process hook
 *    attempts (auxiliary, not an external zero-connection proof). Never
 *    written as "zero connections demonstrated".
 *
 * SAFETY: loopback-only server on 127.0.0.1:3187 (avoids Host-leg ports
 * 3183/3184; :3080 is NEVER touched — bound server check asserts 127.0.0.1).
 * Proxy env vars stripped in-process and recorded. DEEPSEEK_API_KEY is read
 * only to record presence and is deleted in-process BEFORE any plugin mounts,
 * so no leg can carry a real credential to a real endpoint; the search leg is
 * additionally guarded by the fetch tripwire (api.deepseek.com is not allowed).
 * No Host server is started; no port beyond 3187 is bound; the test-use tree
 * is never written (docs/TEST_METHODS.md §3).
 *
 * Verdict discipline: fixture level only. Real external endpoint, real search
 * provider certification, and web-preset real-Host re-run = ENV_BLOCK (no
 * authorization this round; see README). No GO is writable here.
 *
 * Usage: M2W_RUN_DIR=<dir> node dev/agent-workflow/evidence/alpha5/m2-web/m2w-c1-runner.mjs
 * (M2W_RUN_DIR defaults to ./runs/<UTC> under this file's dir.)
 * Exit 0 = every leg matched its pinned-before-run expectation; 1 = assertion
 * failure; 2 = environment (junction/pristine-lib/port problems).
 * Idempotent: the server is always closed in finally; result.json rewritten.
 */
import net from 'node:net'
import { mkdirSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { makeFixture, tag } from '../../alpha5-adapter-p0/00-baseline/p00-fixture.mjs'
import { envHeader, installLoopbackTripwire, libUrl, makeLedger, stripProxyEnv } from '../../alpha5-adapter-p0/09-web-jobs-mcp/p09-shared.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const PORT = 3187 // Team-owned fixture port; 3183/3184 are Host legs; :3080 untouched.
const TOKEN = 'ALPHA5-M2W-C1PAGE-4f9d'
const ALLOWED = new Set([`127.0.0.1:${PORT}`])
const STUB_ID = 'm2w-offline-stub'
const RESULT_URL = 'https://m2w-result.invalid/page'

const { results, expect } = makeLedger('M2W')
const observations = { tcp_log: [], tripwire_attempts: [], tripwire_blocked: [], env_stripped: {}, stub_records: { fetch: [], search: [] }, raw_typed: {} }

/* ---------------- instrumentation BEFORE any production import ---------------- */
observations.env_stripped.proxy = stripProxyEnv()
observations.env_stripped.DEEPSEEK_API_KEY_present_before_strip = process.env.DEEPSEEK_API_KEY !== undefined
delete process.env.DEEPSEEK_API_KEY

const tripwire = installLoopbackTripwire(ALLOWED)
observations.tripwire_attempts = tripwire.attempts
observations.tripwire_blocked = tripwire.blocked

const tcpLog = observations.tcp_log
let origConnect = null
function installTcpTripwire() {
  origConnect = net.Socket.prototype.connect
  net.Socket.prototype.connect = function patched(...connectArgs) {
    // undici (node internal HTTP client) invokes this apply-style with a
    // single array argument; flatten one level before parsing.
    if (connectArgs.length === 1 && Array.isArray(connectArgs[0])) connectArgs = connectArgs[0]
    let host = '?'
    let port = '?'
    const first = connectArgs[0]
    const argTypes = connectArgs.map((a) => (a === null ? 'null' : Array.isArray(a) ? 'array' : typeof a)).join(',')
    if (first !== null && typeof first === 'object' && !Array.isArray(first)) {
      host = String(first.host ?? (typeof first.path === 'string' ? `pipe:${first.path}` : '?'))
      port = String(first.port ?? '')
    } else if (typeof first === 'number') {
      host = String(typeof connectArgs[1] === 'string' ? connectArgs[1] : '127.0.0.1')
      port = String(first)
    } else if (typeof first === 'string' && first.length > 0) {
      // (host, port[, cb]) form
      host = first
      port = typeof connectArgs[1] === 'number' ? String(connectArgs[1]) : '?'
    }
    const target = `${host}:${port}`
    const entry = { at: Date.now(), target, host, port, argTypes }
    tcpLog.push(entry)
    if (host !== '127.0.0.1' || !ALLOWED.has(target)) {
      entry.blocked = true
      this.destroy(new Error(`M2W_TCP_BLOCKED ${target} (fixture allows only ${[...ALLOWED].join(', ')})`))
      return this
    }
    return origConnect.apply(this, connectArgs)
  }
}
installTcpTripwire()

/* ---------------- fixture HTTP server (Team-owned, 127.0.0.1 only) ---------------- */
const accessLog = []
const PAGE_HTML = `<!doctype html><html><head><title>m2w</title></head><body><h1>${TOKEN}</h1><p>deterministic synthetic page for M2-WEB-01 C1.</p></body></html>`
function serve() {
  const main = createServer((req, res) => {
    accessLog.push({ at: Date.now(), method: req.method, url: req.url, host: req.headers.host ?? '' })
    if (req.url === '/page') { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(PAGE_HTML) }
    else { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('m2w-fixture-not-found') }
  })
  return new Promise((resolve, reject) => {
    main.once('error', reject)
    main.listen(PORT, '127.0.0.1', () => resolve(main))
  })
}

const tcpCount = () => tcpLog.length
const tcpTo = (hostOrPort) => tcpLog.filter((e) => e.target.includes(hostOrPort)).length
const tripCount = () => tripwire.attempts.length
const tripTo = (needle) => tripwire.attempts.filter((a) => String(a.target).includes(needle) || String(a.href).includes(needle)).length

let server = null
let exitCode = 0
const phases = {}
try {
  server = await serve()
  if (server.address().address !== '127.0.0.1') throw new Error('M2W: server bound to a non-loopback address (fatal path)')

  const dshWeb = await import(libUrl('web', 'web'))
  const toolWeb = await import(libUrl('web', 'tool-web'))
  const webFetchHttp = await import(libUrl('web', 'web-fetch-http'))
  const webSearchDeepseek = await import(libUrl('web', 'web-search-deepseek'))

  /* ================= PHASE N — production providers, fail-closed negatives ============ */
  {
    const f = await makeFixture()
    // Production assembly mirrors packages/bundle/base/cordis.patch.yml:472-490
    await f.ctx.plugin(dshWeb.default, { searchProvider: 'deepseek-official', fetchProvider: 'http' })
    await f.ctx.plugin(webSearchDeepseek, {})
    await f.ctx.plugin(webFetchHttp, {})
    await f.ctx.plugin(toolWeb, { search: true, fetch: true })
    const A = await f.mintScope('agent-A')
    const schemas = f.ctx.tools.schemas().map((s) => s.name)
    const nativeFetch = f.ctx.tools.get('web_fetch')
    if (nativeFetch) { try { tag(nativeFetch, 'NATIVE.web_fetch') } catch { /* frozen def */ } }

    const call = async (name, args, seq) => {
      const res = await f.ctx.tools.execute({ signal: new AbortController().signal, callId: f.ToolCallId(`m2w-n${String(seq)}`), name, arguments: args, agent: A.key })
      return res
    }
    const textOf = (r) => (r.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('')

    expect('N0.mount-and-schemas', typeof f.ctx.web?.fetch === 'function' && typeof f.ctx.web?.search === 'function'
      && schemas.includes('web_fetch') && schemas.includes('web_search'),
      `ctx.web.fetch=${typeof f.ctx.web?.fetch} ctx.web.search=${typeof f.ctx.web?.search} schemas=${JSON.stringify(schemas)} (production tool-web, both tools on)`)

    // N1 loopback target through the PRODUCTION http provider → refused before transport.
    let logBase = accessLog.length
    const tcpBase = tcpCount()
    const tripBase = tripCount()
    const r1 = await call('web_fetch', { url: `http://127.0.0.1:${PORT}/page` }, 1)
    const t1 = textOf(r1)
    observations.raw_typed.N1 = { isError: r1.isError === true, code: r1.error?.info?.code, text: t1.slice(0, 300) }
    expect('N1.loopback-blocked-before-transport', r1.isError === true && /WEB_BLOCKED_URL|non-public IP/.test(t1 + String(r1.error?.info?.code ?? ''))
      && accessLog.length === logBase && tcpCount() === tcpBase && tripCount() === tripBase,
      `typed原文=${JSON.stringify(t1.slice(0, 120))}; 实测(loopback): fixture accessLog +${String(accessLog.length - logBase)}, TCP钩子 +${String(tcpCount() - tcpBase)}, fetch钩子 +${String(tripCount() - tripBase)} — 服务端 access-log +0 为实证`)

    // N2 private literal → typed refusal. Zero-connection claim is NOT made here
    // (外部零连接无法在本环境实证); claim = typed原文(实测) + 校验前置(静态:
    // policy.ts:31-36/47-52 先于 network; network.ts 字面 IP 无 DNS，验证先于连接).
    logBase = accessLog.length
    const tcpBase2 = tcpCount()
    const r2 = await call('web_fetch', { url: 'http://10.255.255.1/' }, 2)
    const t2 = textOf(r2)
    observations.raw_typed.N2 = { isError: r2.isError === true, code: r2.error?.info?.code, text: t2.slice(0, 300) }
    expect('N2.private-ip-typed-refusal-static-prefix', r2.isError === true && /WEB_BLOCKED_URL|non-public IP/.test(t2 + String(r2.error?.info?.code ?? ''))
      && tcpCount() === tcpBase2 && accessLog.length === logBase,
      `typed原文=${JSON.stringify(t2.slice(0, 120))}; 辅助观测(仅进程内): TCP钩子 +${String(tcpCount() - tcpBase2)}; 边界声明: 非 loopback 外部零连接不可实证 — 断言=typed(实测)+校验前置(静态 path:line)`)

    // N3 credentials-in-URL → policy refusal before anything else (policy.ts:35-36).
    logBase = accessLog.length
    const r3 = await call('web_fetch', { url: `http://user:pass@127.0.0.1:${PORT}/page` }, 3)
    const t3 = textOf(r3)
    observations.raw_typed.N3 = { isError: r3.isError === true, code: r3.error?.info?.code, text: t3.slice(0, 300) }
    expect('N3.credentials-blocked', r3.isError === true && /WEB_BLOCKED_URL|credentials in URLs are not allowed/.test(t3 + String(r3.error?.info?.code ?? ''))
      && accessLog.length === logBase,
      `typed原文=${JSON.stringify(t3.slice(0, 120))}; accessLog +${String(accessLog.length - logBase)}`)

    // N4 non-http(s) scheme → typed invalid-scheme refusal (policy.ts:31-33).
    const tcpBase4 = tcpCount()
    const r4 = await call('web_fetch', { url: 'ftp://example.invalid/x' }, 4)
    const t4 = textOf(r4)
    observations.raw_typed.N4 = { isError: r4.isError === true, code: r4.error?.info?.code, text: t4.slice(0, 300) }
    expect('N4.bad-scheme-refusal', r4.isError === true && /WEB_INVALID_URL|unsupported URL scheme|invalid URL/i.test(t4 + String(r4.error?.info?.code ?? ''))
      && tcpCount() === tcpBase4,
      `typed原文=${JSON.stringify(t4.slice(0, 140))}; TCP钩子 +${String(tcpCount() - tcpBase4)}`)

    // N6 malformed URL string → typed invalid-URL refusal (policy.ts:26-30).
    // (No unresolvable-hostname leg: a real lookup of *.invalid would itself
    // be a network action and real-network authorization is ENV_BLOCK.)
    const tcpBase6 = tcpCount()
    const r6 = await call('web_fetch', { url: 'not-a-url' }, 6)
    const t6 = textOf(r6)
    observations.raw_typed.N6 = { isError: r6.isError === true, code: r6.error?.info?.code, text: t6.slice(0, 300) }
    expect('N6.malformed-url-typed-refusal', r6.isError === true && /WEB_INVALID_URL|invalid URL/i.test(t6 + String(r6.error?.info?.code ?? ''))
      && tcpCount() === tcpBase6,
      `typed原文=${JSON.stringify(t6.slice(0, 120))}; TCP钩子 +${String(tcpCount() - tcpBase6)} (无 DNS 发起：解析失败在字符串层)`)

    // N5 web_search with the production deepseek-official provider, key stripped
    // in-process → typed WEB_PROVIDER_CREDENTIAL_MISSING before the endpoint call
    // (provider.ts apiKey() throw). Tripwire would also block api.deepseek.com.
    const tripBase5 = tripCount()
    const tcpBase5 = tcpCount()
    const r5 = await call('web_search', { queries: ['m2w negative probe — must not reach network'] }, 5)
    const t5 = textOf(r5)
    observations.raw_typed.N5 = { isError: r5.isError === true, code: r5.error?.info?.code, text: t5.slice(0, 300) }
    expect('N5.search-credential-missing-before-endpoint', r5.isError === true && /WEB_PROVIDER_CREDENTIAL_MISSING|no API key/.test(t5 + String(r5.error?.info?.code ?? ''))
      && tripTo('deepseek') === 0 && tcpCount() === tcpBase5 && tripCount() === tripBase5,
      `typed原文=${JSON.stringify(t5.slice(0, 160))}; fetch钩子对 deepseek 目标=${String(tripTo('deepseek'))}, 本腿 fetch/TCP 增量=+${String(tripCount() - tripBase5)}/+${String(tcpCount() - tcpBase5)}`)

    phases.N = { providers: ['deepseek-official (available=true, credential-missing at use)', 'http (production fetch provider)'] }
  }

  /* ============ PHASE P — production tools + seam, OFFLINE stub providers ============== */
  {
    const f = await makeFixture()
    const stubFetch = {
      id: STUB_ID,
      available: () => true,
      async fetch(request, signal) {
        observations.stub_records.fetch.push({ saw_url: request.url })
        const res = await fetch(request.url, { signal, redirect: 'error' }) // tripwired; only 127.0.0.1:3187 is allowed
        const content = await res.text()
        const kind = (res.headers.get('content-type') ?? '').includes('html') ? 'html' : 'text'
        return { url: request.url, statusCode: res.status, body: { kind, content }, truncated: false }
      },
    }
    const stubSearch = {
      id: STUB_ID,
      available: () => true,
      async search(request, _signal) {
        observations.stub_records.search.push({ saw_query: request.query, maxResults: request.maxResults ?? null, target: 'in-process-stub-call' })
        return { content: 'M2W-OFFLINE-ANSWER', sources: [{ url: RESULT_URL, title: 'm2w result stub' }], truncated: false }
      },
    }
    // Mount the seam with its OWN selection config pinning the stub ids; the
    // production providers are mounted too (present-but-unselected), so the
    // leg also proves selection determinism is config-driven, not order-driven.
    await f.ctx.plugin(dshWeb.default, { searchProvider: STUB_ID, fetchProvider: STUB_ID })
    await f.ctx.plugin(webSearchDeepseek, {})
    await f.ctx.plugin(webFetchHttp, {})
    const stubPlugin = (inner) => {
      inner.web.registerFetchProvider(stubFetch)
      inner.web.registerSearchProvider(stubSearch)
    }
    // NB: function `name` is read-only — only `inject` is assignable (p00
    // mintScope precedent uses exactly this shape).
    await f.ctx.plugin(Object.assign(stubPlugin, { inject: ['web'] }), {})
    await f.ctx.plugin(toolWeb, { search: true, fetch: true })
    const A = await f.mintScope('agent-P')
    const schemas = f.ctx.tools.schemas().map((s) => s.name)

    const call = async (name, args, seq) => {
      const res = await f.ctx.tools.execute({ signal: new AbortController().signal, callId: f.ToolCallId(`m2w-p${String(seq)}`), name, arguments: args, agent: A.key })
      return res
    }
    const textOf = (r) => (r.content ?? []).filter((b) => b.type === 'text').map((b) => b.text).join('')

    expect('P0.stub-selection-mounted', schemas.includes('web_fetch') && schemas.includes('web_search')
      && observations.stub_records.fetch.length === 0,
      `schemas=${JSON.stringify(schemas)}; seam config searchProvider/fetchProvider=${STUB_ID}; production providers mounted-but-unselected`)

    // P1 success path: production tool-web + seam + stub provider fetches the
    // loopback synthetic page end-to-end (200 + token + real output schema).
    const logBase = accessLog.length
    const r1 = await call('web_fetch', { url: `http://127.0.0.1:${PORT}/page` }, 1)
    const v1 = r1.value ?? {}
    observations.raw_typed.P1 = { isError: r1.isError === true, code: r1.error?.info?.code, text: textOf(r1).slice(0, 300) }
    expect('P1.offline-stub-fetch-success', r1.isError !== true && v1.statusCode === 200 && v1.body?.kind === 'html'
      && String(v1.body?.content ?? '').includes(TOKEN) && v1.truncated === false
      && observations.stub_records.fetch.length === 1 && observations.stub_records.fetch[0].saw_url === `http://127.0.0.1:${PORT}/page`
      && accessLog.length === logBase + 1,
      `成功路径: statusCode=${String(v1.statusCode)} kind=${String(v1.body?.kind)} token命中=${String(String(v1.body?.content ?? '').includes(TOKEN))} truncated=${String(v1.truncated)}; 桩命中=${String(observations.stub_records.fetch.length)} saw_url=${String(observations.stub_records.fetch[0]?.saw_url)}; accessLog +${String(accessLog.length - logBase)} (服务端实证)`)

    // P2 two-layer object: the SEARCH call's communication target is the stub
    // (in-process record); the RESULT URL is never contacted. Observation means
    // (stated, root ruling revision 2): global-fetch tripwire attempts + TCP
    // connect hook — BOTH in-process; undici-internal getaddrinfo is NOT
    // hookable here (systemLookup is a destructured import), so the residual
    // for "never contacted" is: no connect attempt recorded + no fetch attempt
    // recorded + accessLog +0; external network level is NOT observed (limit).
    const tripBase2 = tripCount()
    const tcpBase2 = tcpCount()
    const logBase2 = accessLog.length
    const r2 = await call('web_search', { queries: ['alpha5 m2w two-layer probe'] }, 2)
    const t2 = textOf(r2)
    const v2 = r2.value ?? {}
    expect('P2.search-two-layer-target-vs-result-url', r2.isError !== true
      && observations.stub_records.search.length === 1
      && observations.stub_records.search[0].saw_query === 'alpha5 m2w two-layer probe'
      && observations.stub_records.search[0].maxResults === 8
      && Array.isArray(v2.sources) && v2.sources.length === 1 && v2.sources[0].url === RESULT_URL
      && t2.includes(RESULT_URL)
      && tripTo('m2w-result.invalid') === 0 && tcpTo('m2w-result.invalid') === 0 && tcpTo(':443') === 0
      && tripCount() === tripBase2 && tcpCount() === tcpBase2 && accessLog.length === logBase2,
      `两层对象: 搜索目标=${JSON.stringify(observations.stub_records.search[0])} ≠ 结果URL=${RESULT_URL}; 结果URL 观测(进程内): fetch钩子=${String(tripTo('m2w-result.invalid'))} TCP钩子=${String(tcpTo('m2w-result.invalid'))} :443=${String(tcpTo(':443'))} accessLog +${String(accessLog.length - logBase2)}; 限制: undici 内部 DNS 不可钩 (destructured import)，外部网络层未观测`)

    // P3/P4 — BASE.C1 family cross-check (todo 先例), CURRENT SHAPE, offline stubs.
    // Host parameter ROOT compiles implicit-open (witness: formal test C1-8, host
    // schema.ts:450-458). Empirical face: an UNDECLARED top-level argument key is
    // not rejected and the operation still runs (fetch still reaches the allowed
    // fixture origin; search still hits the stub). 钉"当前形态"，不判正确。
    const logBase3 = accessLog.length
    const r3 = await call('web_fetch', { url: `http://127.0.0.1:${PORT}/page`, m2wEvilTopKey: 'undeclared-top-level' }, 3)
    const v3 = r3.value ?? {}
    expect('P3.current-shape-unknown-top-level-key-still-runs-web_fetch', r3.isError !== true
      && v3.statusCode === 200 && String(v3.body?.content ?? '').includes(TOKEN)
      && accessLog.length === logBase3 + 1,
      `当前形态(不判正确): 未声明顶层键 m2wEvilTopKey 未被拒，fetch 照常执行到允许目的地; statusCode=${String(v3.statusCode)} token命中=${String(String(v3.body?.content ?? '').includes(TOKEN))} accessLog +${String(accessLog.length - logBase3)}`)

    const logBase4 = accessLog.length
    const r4 = await call('web_search', { queries: ['m2w current-shape probe'], m2wEvilTopKey: 'undeclared-top-level' }, 4)
    const v4 = r4.value ?? {}
    expect('P4.current-shape-unknown-top-level-key-still-runs-web_search', r4.isError !== true
      && Array.isArray(v4.sources) && v4.sources.length === 1 && v4.sources[0].url === RESULT_URL
      && observations.stub_records.search.length === 2 && accessLog.length === logBase4,
      `当前形态(不判正确): 未声明顶层键未被拒，search 照常命中桩; 桩命中=${String(observations.stub_records.search.length)}; 结果 URL 仍零接触(accessLog +${String(accessLog.length - logBase4)})`)

    phases.P = { stub_id: STUB_ID, providers_present: ['deepseek-official', 'http', STUB_ID], selection: 'config-pinned' }
  }
} catch (err) {
  exitCode = 2
  observations.fatal = String(err?.stack ?? err)
  console.log(`FATAL(environment) ${String(err?.message ?? err)}`)
} finally {
  if (server !== null) {
    await new Promise((resolve) => { server.close(() => resolve()) })
  }
  const listenersReleased = server === null ? true : server.listening === false
  observations.listeners = { port: PORT, bind: '127.0.0.1', released: listenersReleased }
  const runDir = process.env.M2W_RUN_DIR ?? join(HERE, 'runs', new Date().toISOString().replace(/[:.]/g, '-').replace(/Z$/, 'Z'))
  mkdirSync(runDir, { recursive: true })
  const fails = results.filter((r) => r.verdict === 'FAIL').length
  const out = {
    header: envHeader({
      runner: 'm2w-c1-runner (M2-WEB-01 C1)',
      port_main: PORT,
      ports_avoided: '3183/3184 (Host legs) — :3080 never touched',
      allowed_targets: [...ALLOWED],
      stub_id: STUB_ID,
      deepley_note: 'DEEPSEEK_API_KEY presence recorded then deleted in-process before mounts',
    }),
    phases,
    legs: results,
    summary: { total: results.length, pass: results.length - fails, fail: fails },
    observations,
    disclosures: {
      test_doubles: 'stub fetch/search providers (registered over the seam public API) and the 127.0.0.1:3187 synthetic page are Team-owned fixture code; pinned production code = dsh-web seam, tool-web, web-fetch-http, web-search-deepseek prebuilt libs of the test-use checkout at the pinned SHA.',
      zero_connection_boundary: 'loopback legs: server-side access-log (+0/+1) is measured proof; non-loopback legs (10.255.255.1, m2w-result.invalid): claim = typed refusal (measured) + policy-before-transport (static, path:line) + in-process hook counters (auxiliary). External-network-level zero is NOT observable here.',
      hook_limits: 'net.Socket.prototype.connect hook and globalThis.fetch tripwire are IN-PROCESS; undici-internal DNS resolution (systemLookup destructured import in network.ts) is not hookable; no sandbox-level syscall watch.',
      env_block: [
        '真实外网 web_fetch（无授权）',
        '真实 search provider（DeepSeek/Exa/Perplexity）端点认证（无授权）',
        'web preset 真实 Host 装配复跑（交 CENTER 排唯一 Host owner）',
      ],
      shared_helpers: 'ledger/tripwire/envHeader/libUrl from p09-shared.mjs; makeFixture/tag from p00-fixture.mjs (read-only import, no copies; p00 ensureResolvable() creates the 5 gitignored node_modules/@deepseek-ai junctions).',
    },
  }
  writeFileSync(join(runDir, 'result.json'), JSON.stringify(out, null, 2) + '\n')
  console.log(`RESULT_JSON ${join(runDir, 'result.json')}`)
  console.log(`SUMMARY total=${String(results.length)} pass=${String(results.length - fails)} fail=${String(fails)} exit=${String(exitCode === 0 && fails > 0 ? 1 : exitCode)}`)
  if (exitCode === 0 && fails > 0) exitCode = 1
}
process.exit(exitCode)
