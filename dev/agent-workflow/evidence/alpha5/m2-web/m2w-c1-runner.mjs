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

  /* ============ PHASE G — production import edge: landed DIST glue row over the
     REAL provider chain (root 07:18 discipline: 正负控 on the assembled production
     path; observable zero-call counts; real-egress legs = explicit ENV_BLOCK) ==== */
  {
    const glueUrl = new URL('../../../../../packages/runtime/dist/packages/runtime/src/plugin/live/web-gateway-assembly.mjs', import.meta.url).href
    const glue = await import(glueUrl)
    phases.G = {
      import_edge: 'packages/runtime/dist/packages/runtime/src/plugin/live/web-gateway-assembly.mjs (byte-placed) → ../../../web-gateway/src/index.js (tsc-emitted mirror)',
      env_block: [
        'allow-positive through the REAL web-fetch-http provider to a real public destination — needs real external network (authorization ENV_BLOCK)',
        'real DeepSeek search provider auth — needs DEEPSEEK_API_KEY + external network (ENV_BLOCK)',
        'real-Host web-preset rerun / real DNS legs — owned by the integration owner Host schedule (ENV_BLOCK)',
      ],
    }

    const REALM_G = 'realm-m2w-g'
    const bindingFor = (toolName) => ({ bindingId: 'bind-m2w-g', toolName, definitionIdentity: `def:${toolName}` })
    const grantFor = (toolName, locator) => ({
      grantId: 'grant-m2w-g', realmId: REALM_G, bindingId: 'bind-m2w-g', callId: 'call-m2w-g',
      parametersFingerprint: 'sha256:m2w-g-material', singleUse: true, issuedAt: Date.now(), expiresAt: null,
      effects: { effects: [
        { kind: 'tool-invoke', toolName, resource: null },
        { kind: 'connect', resource: { realmId: REALM_G, kind: 'network-destination', canonicalLocator: locator, rights: ['connect'] } },
      ] },
    })
    const reqFor = (toolName, operation, locator) => ({
      grant: grantFor(toolName, locator), binding: bindingFor(toolName),
      target: { webOperation: operation }, payloadFingerprint: 'sha256:m2w-g-fp',
    })

    // REAL chain: production providers, production selection config (mirror of
    // cordis.patch.yml:472-490). No tool-web needed: the row speaks ctx.web.
    const g = await makeFixture()
    await g.ctx.plugin(dshWeb.default, { searchProvider: 'deepseek-official', fetchProvider: 'http' })
    await g.ctx.plugin(webSearchDeepseek, {})
    await g.ctx.plugin(webFetchHttp, {})
    const searchOrigin = () => 'https://api.deepseek.com/anthropic/v1' // authority: host web-search-deepseek provider.ts:34 DEEPSEEK_DEFAULT_BASE_URL (the real installed config value; N-origin = its origin, path is transport detail)

    // G1 default-off on the PRODUCTION row: unarmed, calls typed-refuse, zero counters.
    {
      const t0 = tripCount(); const k0 = tcpCount(); const a0 = accessLog.length
      const row = glue.createLiveWebGatewayAssembly({ ctxWeb: g.ctx.web, resolveSearchOrigin: searchOrigin })
      const res = await row.callWeb(reqFor('web_fetch', { kind: 'web.fetch', url: `http://127.0.0.1:${PORT}/page` }, `http://127.0.0.1:${PORT}`))
      expect('G1.production-row-default-off', row.active === false && row.code === 'web-not-enabled'
        && res.ok === false && res.error?.code === 'IO_POLICY_UNSUPPORTED'
        && tripCount() === t0 && tcpCount() === k0 && accessLog.length === a0,
        `row.active=${String(row.active)} code=${String(row.code)} refusal=${String(res.error?.code)}; 零调用观测: fetch钩子 +${String(tripCount() - t0)} TCP +${String(tcpCount() - k0)} accessLog +${String(accessLog.length - a0)}`)
    }
    // G2 non-boolean enable key + missing deps: typed refusals on the production row.
    {
      const r1 = glue.createLiveWebGatewayAssembly({ webEnabledRaw: 'true', ctxWeb: g.ctx.web, resolveSearchOrigin: searchOrigin })
      const r2 = glue.createLiveWebGatewayAssembly({ webEnabledRaw: 1, ctxWeb: g.ctx.web, resolveSearchOrigin: searchOrigin })
      const r3 = glue.createLiveWebGatewayAssembly({ webEnabledRaw: true, ctxWeb: null })
      const r4 = glue.createLiveWebGatewayAssembly({ webEnabledRaw: true, ctxWeb: g.ctx.web })
      expect('G2.closed-key-and-deps-typed-refusals', r1.code === 'web-config-not-boolean' && r2.code === 'web-config-not-boolean'
        && r3.code === 'web-seam-absent' && r4.code === 'search-origin-resolver-missing',
        `strings=${String(r1.code)}/${String(r2.code)} seam=${String(r3.code)} resolver=${String(r4.code)} (构造即校验 deps，缺依赖 typed 拒)`)
    }
    // G3 armed production row; belt-negative through the row: observable ZERO
    // counts at THREE layers (fetch hook / TCP hook / server accessLog).
    {
      const row = glue.createLiveWebGatewayAssembly({ webEnabledRaw: true, ctxWeb: g.ctx.web, resolveSearchOrigin: searchOrigin })
      const t0 = tripCount(); const k0 = tcpCount(); const a0 = accessLog.length
      const res = await row.callWeb(reqFor('web_fetch', { kind: 'web.fetch', url: `http://127.0.0.1:${PORT}/page` }, `http://127.0.0.1:${PORT}`))
      expect('G3.armed-row-belt-negative-zero-calls', row.active === true && res.ok === false
        && res.error?.code === 'DOMAIN_DENIED' && /belt/.test(String(res.error?.message))
        && tripCount() === t0 && tcpCount() === k0 && accessLog.length === a0,
        `refusal=${String(res.error?.code)} msg=${JSON.stringify(String(res.error?.message).slice(0, 110))}; 零调用: fetch钩子 +${String(tripCount() - t0)} TCP +${String(tcpCount() - k0)} accessLog +${String(accessLog.length - a0)} — 可观察计数为证`)
      // G4 REAL-provider negative through the row: credentials URL to a
      // NON-literal host → production policy (policy.ts:35-36) refuses BEFORE
      // DNS; the row maps typed, seam code verbatim. Zero counts observable.
      const t1 = tripCount(); const k1 = tcpCount(); const a1 = accessLog.length
      const res4 = await row.callWeb(reqFor('web_fetch', { kind: 'web.fetch', url: 'https://user:pass@m2w-badcred.test/p' }, 'https://m2w-badcred.test'))
      expect('G4.real-provider-policy-negative-through-row', res4.ok === false && res4.error?.code === 'DOMAIN_DENIED'
        && typeof res4.error?.details?.seamCode === 'string'
        && tripCount() === t1 && tcpCount() === k1 && accessLog.length === a1,
        `refusal=${String(res4.error?.code)} seamCode=${String(res4.error?.details?.seamCode)} msg=${JSON.stringify(String(res4.error?.message).slice(0, 120))}; 零调用: fetch钩子 +${String(tripCount() - t1)} TCP +${String(tcpCount() - k1)} accessLog +${String(accessLog.length - a1)} (校验前置=复用生产 policy.ts:35-36，非本 lane 复制)`)
      // G5 unknown top-level keys on the production row: envelope/target/payload.
      const sneakyEnv = { ...reqFor('web_fetch', { kind: 'web.fetch', url: 'https://m2w-x.test/p' }, 'https://m2w-x.test'), sneakyTopKey: 1 }
      const sneakyTarget = reqFor('web_fetch', { kind: 'web.fetch', url: 'https://m2w-x.test/p' }, 'https://m2w-x.test')
      sneakyTarget.target.sneakyTopKey = 1
      const sneakyPayload = reqFor('web_fetch', { kind: 'web.fetch', url: 'https://m2w-x.test/p', sneakyTopKey: 1 }, 'https://m2w-x.test')
      const e1 = await row.callWeb(sneakyEnv); const e2 = await row.callWeb(sneakyTarget); const e3 = await row.callWeb(sneakyPayload)
      expect('G5.unknown-top-level-keys-typed-refused-production-row',
        e1.ok === false && e2.ok === false && e3.ok === false
        && e1.error?.code === 'TOOL_BINDING_UNVERIFIED' && /closed/.test(String(e2.error?.message)) && /closed/.test(String(e3.error?.message)),
        `envelope=${String(e1.error?.code)} target=${String(e2.error?.code)} payload=${String(e3.error?.code)} (与 P3/P4 宿主工具面当前形态分层: 网关行=生产治理面 typed 拒)`)
      // G6 frozen contract face: payload-less envelope refuses, never guesses.
      const bare = await row.call({ grant: grantFor('web_fetch', 'https://m2w-x.test'), binding: bindingFor('web_fetch'), target: {}, payloadFingerprint: 'sha256:m2w-g-fp' })
      expect('G6.contract-face-no-payload-refuses', bare.ok === false && /operation-payload-absent/.test(String(bare.error?.message)),
        `refusal=${String(bare.error?.code)} msg=${JSON.stringify(String(bare.error?.message).slice(0, 100))}`)
      // G7 REAL search-provider chain through the row: production provider is
      // SELECTED (config-pinned 'deepseek-official'), key stripped in-process →
      // typed credential refusal, seam code verbatim, zero counts. (The allow
      // positive on THIS chain = ENV_BLOCK — see phases.G.env_block.)
      const t7 = tripCount(); const k7 = tcpCount()
      const res7 = await row.callWeb(reqFor('web_search', { kind: 'web.search', query: 'm2w production-row search negative' }, 'https://api.deepseek.com'))
      expect('G7.real-search-provider-refusal-through-row', res7.ok === false && res7.error?.code === 'IO_POLICY_UNSUPPORTED'
        && res7.error?.details?.seamCode === 'WEB_PROVIDER_CREDENTIAL_MISSING'
        && tripCount() === t7 && tcpCount() === k7 && tripTo('deepseek') === 0,
        `refusal=${String(res7.error?.code)} seamCode=${String(res7.error?.details?.seamCode)}; fetch钩子 +${String(tripCount() - t7)} (deepseek 目标 ${String(tripTo('deepseek'))}) TCP +${String(tcpCount() - k7)}`)
      phases.G.refusal_typed_texts = {
        G3: String(res.error?.message).slice(0, 160), G4: String(res4.error?.message).slice(0, 160),
        G7: String(res7.error?.message).slice(0, 200),
      }
    }
    // G8 ALLOW positive on the assembled production row with the ENDPOINT
    // STUBBED (C2 "装配真实 + 端点桩"; 披露: 真实外网段 = ENV_BLOCK, 不用 fixture 顶替真实段).
    {
      const g2 = await makeFixture()
      await g2.ctx.plugin(dshWeb.default, { searchProvider: 'm2w-g8-stub', fetchProvider: 'm2w-g8-stub' })
      const g8stub = Object.assign(async (ctx) => {
        ctx.web.registerFetchProvider({
          id: 'm2w-g8-stub', available: () => true,
          async fetch(request) {
            observations.stub_records.fetch.push({ saw_url: request.url, via: 'G8-stub' })
            return { url: request.url, statusCode: 200, body: { kind: 'text', content: TOKEN }, truncated: false }
          },
        })
        ctx.web.registerSearchProvider({
          id: 'm2w-g8-stub', available: () => true,
          async search(request) {
            observations.stub_records.search.push({ saw_query: request.query, via: 'G8-stub' })
            return { sources: [{ url: RESULT_URL }], truncated: false }
          },
        })
      }, { inject: ['web'] })
      await g2.ctx.plugin(g8stub, {})
      const row = glue.createLiveWebGatewayAssembly({ webEnabledRaw: true, ctxWeb: g2.ctx.web, resolveSearchOrigin: searchOrigin })
      const t8 = tripCount(); const k8 = tcpCount(); const a8 = accessLog.length
      const res8 = await row.callWeb(reqFor('web_fetch', { kind: 'web.fetch', url: 'https://m2w-fixture.test/page' }, 'https://m2w-fixture.test'))
      const v8 = res8.ok ? res8.value : null
      expect('G8.allow-positive-assembled-row-stubbed-endpoint', row.active === true && res8.ok === true
        && /^sha256:[0-9a-f]{64}$/.test(String(v8?.outcomeFingerprint)) && v8?.domainVeto === 'not-applicable'
        && observations.stub_records.fetch.some((r) => r.saw_url === 'https://m2w-fixture.test/page' && r.via === 'G8-stub')
        && tripCount() === t8 && tcpCount() === k8 && accessLog.length === a8,
        `ok receipt: fingerprint=${String(v8?.outcomeFingerprint).slice(0, 22)}… domainVeto=${String(v8?.domainVeto)}; 桩命中精确 URL=true; 真实出口零计数: fetch钩子 +${String(tripCount() - t8)} TCP +${String(tcpCount() - k8)} accessLog +${String(accessLog.length - a8)} — 端点桩=披露, 真实外网 allow=ENV_BLOCK`)
    }
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
