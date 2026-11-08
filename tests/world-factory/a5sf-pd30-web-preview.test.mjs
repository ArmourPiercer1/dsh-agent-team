/**
 * tests/world-factory/a5sf-pd30-web-preview.test.mjs — PD-30: does the SHIPPED
 * composition give a governed Member a real, governed web capability, and are
 * the negative paths refused BEFORE the wire?
 *
 * WHAT PD-27 LEFT OPEN (its README §7): the `web` face had no transport that
 * shipped — a TEST driver row supplied the compiled realm answer and the boot
 * driver rewrote the preset row name to a file URL — and `web_search` had no
 * backend (only the name, the dispatch and the fact). This suite measures the
 * two halves that close those gaps, HOST-FREE (real sockets, real provider
 * code, real guard facts, no boot):
 *
 *   TRANSPORT  the shipped row (`a5sf-web-transport.mjs`) loads the pinned
 *              host's OWN providers by their public package names and answers
 *              the `{ fetch, search }` object the confined face consumes;
 *   SEARCH     a real `POST {baseURL}/search` is issued by the host's Exa
 *              provider against a LOCAL endpoint, and its answer is PARSED into
 *              the seam's `{ sources }` — the result COUNT is the witness;
 *   NEGATIVES  SSRF (loopback/RFC1918/link-local/ULA/metadata literals and
 *              metadata hostnames), malformed URLs (scheme/host/length/query),
 *              a missing provider, and an unavailable one — each TYPED, each
 *              with one deny fact and ZERO provider entries;
 *   CEILING    the "base web fallback" is a COUNTER: a provider that would
 *              answer is installed as the face's transport, and the refusals
 *              must never enter it; the allow arms must reach the REAL one.
 *
 * The distinction the SSRF leg needs is stated in the arms, not assumed: the
 * local fixture is a loopback address, so the composition DECLARES it
 * (`testEndpoints`, exact origin). Every other loopback/private target is a
 * forbidden destination. A different port, a different spelling, or a redirect
 * off the fixture does not match.
 *
 * MUTATION CONTROLS live in `a5sf-pd30-mutation-controls.mjs` (a suite that
 * cannot go red is not evidence).
 *
 * Run: node --test tests/world-factory/a5sf-pd30-web-preview.test.mjs
 *
 * CORE PATCH BUDGET = 0. No boot, no host tree write, no external network.
 *
 * @module tests/world-factory/a5sf-pd30-web-preview.test
 */
import assert from 'node:assert/strict'
import { appendFileSync, readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import test from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..')
const runtimeRequire = createRequire(join(REPO, 'package.json'))

const DIST = join(REPO, 'packages', 'runtime', 'dist', 'packages', 'runtime')
const WEB_FACE_MODULE = process.env.A5SF_PD30_WEB_FACE_MODULE ?? join(DIST, 'team-services', 'src', 'web.js')
// MUTATION-CONTROL HOOK (unset in CI; the controls module sets it): the suite
// must be runnable against ONE mutated artefact at a time.
const TRANSPORT_MODULE = process.env.A5SF_PD30_TRANSPORT_MODULE ?? join(DIST, 'src', 'plugin', 'live', 'a5sf-web-transport.mjs')

const KNOWN_BODY = 'A5SF_PD30_KNOWN_BODY_BYTES'
/** The Exa-shaped answer the local endpoint serves: THREE snippets, one blank (dropped by the provider). */
const EXA_ANSWER = Object.freeze({
  results: [
    { url: 'https://example.test/a', title: 'Alpha', publishedDate: '2026-11-01', highlights: ['first snippet'] },
    { url: 'https://example.test/b', title: 'Beta', highlights: ['   ', 'second snippet'] },
    { url: 'https://example.test/c', highlights: [] },
    { url: 'https://example.test/d', title: 'Delta', highlights: ['third snippet'] },
  ],
})

/** A local fixture server with its OWN connection/request counters. */
async function localServer(handler) {
  let connections = 0
  const requests = []
  const server = createServer((req, res) => {
    requests.push(`${req.method ?? '?'} ${req.url ?? '?'}`)
    handler(req, res)
  })
  server.on('connection', () => { connections += 1 })
  await new Promise((done) => server.listen(0, '127.0.0.1', done))
  const address = server.address()
  const port = typeof address === 'object' && address !== null ? address.port : 0
  return {
    url: `http://127.0.0.1:${String(port)}`,
    connections: () => connections,
    requests,
    close: () => new Promise((done) => { server.closeAllConnections?.(); server.close(() => done()) }),
  }
}

/** A provider that WOULD answer and counts every entry (the "did it go out" witness). */
function countedBase(body = 'BASE_EGRESS_WOULD_ANSWER') {
  const entries = { fetch: 0, search: 0 }
  return {
    entries,
    provider: {
      async fetch(request) {
        entries.fetch += 1
        return { url: String(request?.url ?? ''), statusCode: 200, body: { kind: 'text', content: body }, truncated: false }
      },
      async search() {
        entries.search += 1
        return { sources: [], truncated: false }
      },
    },
  }
}

/** The ONE compiler's effective lane, under the fixed web identity. */
async function effectiveLane(network = 'allow') {
  const arms = await import(pathToFileURL(join(HERE, 'lib', 'a5sf-web-arms.mjs')).href)
  const seams = await arms.loadWebSeams(REPO)
  return { seams, effective: arms.effectiveOf(seams, { network }) }
}

/**
 * Mount the confined face over a transport, exactly as the realm does.
 * @returns {Promise<{ face: object, facts: object[], web: object }>}
 */
async function mountFace({ network = 'allow', provider, testEndpoints }) {
  const { effective } = await effectiveLane(network)
  // The SHIPPED artifact (the committed dist mirror), not the TS source: the
  // face and its denial vocabulary must be the bytes a Host loads.
  const shipped = await import(pathToFileURL(WEB_FACE_MODULE).href)
  const facts = []
  class BareWeb {}
  const Confined = shipped.createConfinedWebClass(BareWeb, {
    effective,
    provider,
    onGuardConsult: (fact) => facts.push(fact),
    ...(testEndpoints === undefined ? {} : { testEndpoints }),
  })
  return { face: new Confined({}), facts, effective }
}

/** The shipped transport row's own loader, with the deployment config the boot would use. */
async function shippedTransport({ testEndpoints, search }) {
  const module = await import(pathToFileURL(TRANSPORT_MODULE).href)
  const loaded = await module.loadTransports({
    ...(testEndpoints === undefined ? {} : { testEndpoints }),
    ...(search === undefined ? {} : { search }),
  })
  return { module, ...loaded }
}

/**
 * One typed refusal: the code, exactly ONE deny fact (counted from `from`, the
 * fact index BEFORE the call), and ZERO provider entries.
 */
/**
 * Mount the SHIPPED transport ROW (its own `apply`) on a minimal context stub
 * and answer the `teamA5sfWebTransport` service it provides. This is the object
 * the product row reads, so the positive arms measure the SHIPPED assembly and
 * not a test-built provider.
 */
async function shippedService(config) {
  const module = await import(pathToFileURL(TRANSPORT_MODULE).href)
  const provided = {}
  await module.apply({ provide: (serviceName, value) => { provided[serviceName] = value } }, config)
  const service = provided[module.A5SF_WEB_TRANSPORT_SERVICE]
  assert.ok(service, `the shipped row must provide ${module.A5SF_WEB_TRANSPORT_SERVICE}`)
  return { module, service, describe: service.describe() }
}

/**
 * A `base web` service double (the INHERITED host `ctx.web` a fallback would
 * reach), with its own counters. The shipped transport never names it; the M2
 * mutation does, which is what makes the zero a MEASURED ceiling.
 */
function baseWebService() {
  const counter = countedBase()
  globalThis.__PD30_BASE_WEB__ = counter.provider
  return counter
}

async function expectRefusal({ face, facts, from = 0, counter, run, code, label }) {
  let refusal
  try {
    await run()
  } catch (error) {
    refusal = error
  }
  if (refusal === undefined) {
    // The ADMITTED shape names the transport's own counter, so a suite that
    // lost an admission leg fails with "it went out", not with a bare
    // "expected a rejection".
    const entered = counter === undefined
      ? 'not measured on this arm'
      : `transport entries: ${String(counter.entries.fetch + counter.entries.search)}`
    assert.fail(`${label}: expected ${code}, but the call was ADMITTED (${entered})`)
  }
  assert.equal(refusal?.code, code, `${label}: the refusal must carry the typed code (got ${String(refusal?.code)}: ${String(refusal?.message)})`)
  const written = facts.slice(from)
  assert.equal(written.length, 1, `${label}: exactly ONE guard fact per consult (got ${String(written.length)})`)
  assert.equal(written[0].decision, 'deny', `${label}: the fact must record a deny`)
  assert.equal(written[0].decidedBy, code, `${label}: the fact must name the code that refused`)
  if (counter !== undefined) {
    assert.equal(counter.entries.fetch + counter.entries.search, 0, `${label}: the transport must NOT be entered`)
  }
}

/** Append one measured arm to `$A5SF_PD30_EVIDENCE/host-free-runs.jsonl`. */
function recordMeasurement(arm) {
  const dir = process.env.A5SF_PD30_EVIDENCE
  if (dir === undefined || dir.trim() === '') return
  appendFileSync(join(dir, 'host-free-runs.jsonl'), `${JSON.stringify({ schema: 'a5sf-pd30/host-free-arm/1', at: new Date().toISOString(), ...arm })}\n`)
}

// ===========================================================================
// COMPOSITION — the shipped rows carry the transport, and no driver does
// ===========================================================================
test('PD30-COMPOSITION: the SHIPPED layer declares the transport row and the preset names our module (no file URL)', () => {
  const text = readFileSync(join(REPO, 'cordis.patch.yml'), 'utf8')
  const YAML = runtimeRequire('yaml')
  const document = YAML.parse(text.replace(/!!js .*/gu, 'null'))
  const rows = (Array.isArray(document) ? document : [document]).flatMap((row) => (Array.isArray(row?.insert) ? row.insert : [row]))
  const transport = rows.find((row) => row?.id === 'a5sf-web-transport')
  assert.ok(transport, 'the shipped bundle layer must mount the composition-owned transport row')
  assert.equal(String(transport.name), 'dsh-agent-team/web-transport', 'the row must name THIS package\'s subpath export')
  const preset = rows.find((row) => row?.config?.id === 'a5sf-governed-member')
  const plugins = (preset?.config?.plugins ?? []).flatMap((row) => (row?.group === true ? row.config : [row]))
  const web = plugins.find((row) => row?.id === 'tool-web')
  assert.ok(web, 'the governed preset must still declare the network pair')
  assert.equal(String(web.name), 'dsh-agent-team/web-tool', 'the network row must be the shipped Team module')
  const manifest = JSON.parse(readFileSync(join(REPO, 'package.json'), 'utf8'))
  assert.equal(manifest.exports['./web-transport'], './packages/runtime/dist/packages/runtime/src/plugin/live/a5sf-web-transport.mjs')
  assert.equal(manifest.exports['./web-tool'], './packages/runtime/dist/packages/runtime/src/plugin/live/confined-web-tool.mjs')
  // The host providers are DEPENDENCIES, never peers: the audited host-provides
  // contract is a frozen ten and this lane does not widen it.
  for (const name of ['@deepseek-ai/dsh-web-fetch-http', '@deepseek-ai/dsh-web-search-exa']) {
    assert.equal(manifest.dependencies[name], '0.2.0-rc.2', `${name} must be a dependency of this package`)
    assert.equal(manifest.peerDependencies[name], undefined, `${name} must NOT be added to the frozen peer census`)
  }
  assert.equal(Object.keys(manifest.peerDependencies).length, 10, 'the audited host-provides contract stays at its ten names')
})

// ===========================================================================
// TRANSPORT — the shipped loader answers the face's provider object
// ===========================================================================
test('PD30-TRANSPORT: the shipped row loads the host providers by name and reports the backend it owns', async () => {
  const server = await localServer((_req, res) => { res.writeHead(200, { 'content-type': 'text/plain' }); res.end(KNOWN_BODY) })
  try {
    const { module, fetchProvider, searchProvider, searchReason, modules } = await shippedTransport({
      testEndpoints: [server.url],
      search: { baseURL: server.url, apiKey: 'pd30-test-key' },
    })
    assert.equal(modules.fetch, module.A5SF_WEB_FETCH_MODULE, 'the fetch provider must be the pinned host package, by its public name')
    assert.equal(modules.search, module.A5SF_WEB_SEARCH_MODULE, 'the search provider must be the pinned host package, by its public name')
    assert.equal(typeof fetchProvider.fetch, 'function')
    assert.ok(searchProvider, `the search provider must load (${String(searchReason)})`)
    assert.equal(searchProvider.id, 'exa', 'the search backend must be the host Exa provider')
    assert.equal(searchProvider.available(), true)
    assert.deepEqual(module.normaliseTestEndpoints([`${server.url}/deep/path`, 'not a url', 'ftp://x/']), [server.url],
      'a test endpoint is normalised to its ORIGIN; a malformed/!http entry is dropped, never widened')
    recordMeasurement({ arm: 'transport', fetch: modules.fetch, search: modules.search, backend: searchProvider.id, testEndpoints: [server.url] })
  } finally {
    await server.close()
  }
})

// ===========================================================================
// ALLOW — real socket, body verbatim, one allow fact
// ===========================================================================
test('PD30-E2E-ALLOW: a governed fetch reaches the declared fixture over a real socket and returns its body verbatim', async () => {
  const server = await localServer((_req, res) => { res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' }); res.end(KNOWN_BODY) })
  try {
    const { fetchProvider } = await shippedTransport({ testEndpoints: [server.url], search: { baseURL: server.url, apiKey: 'k' } })
    const counter = countedBase()
    const { face, facts } = await mountFace({
      provider: {
        fetch: async (request, signal) => { counter.entries.fetch += 1; return fetchProvider.fetch(request, signal) },
        search: async (request, signal) => { counter.entries.search += 1; return fetchProvider.search(request, signal) },
        testEndpoints: [server.url],
      },
      testEndpoints: [server.url],
    })
    const url = `${server.url}/known`
    const result = await face.fetch({ url })
    assert.equal(result.statusCode, 200, 'the result must carry the HTTP status')
    assert.equal(result.body?.kind, 'text')
    assert.equal(result.body?.content, KNOWN_BODY, 'the bytes the server served must arrive VERBATIM')
    assert.equal(server.connections(), 1, `exactly ONE connection may be opened (got ${String(server.connections())})`)
    assert.deepEqual(server.requests, ['GET /known'])
    assert.equal(facts.length, 1, 'exactly ONE guard fact per admitted call')
    assert.equal(facts[0].decision, 'allow')
    assert.equal(facts[0].method, 'web:fetch')
    assert.equal(facts[0].locator, url, 'the fact names the DECLARED URL')
    recordMeasurement({
      arm: 'allow',
      url,
      bodyBytes: Buffer.byteLength(KNOWN_BODY, 'utf8'),
      renderedBytes: Buffer.byteLength(JSON.stringify(result), 'utf8'),
      serverConnections: server.connections(),
      serverRequests: server.requests,
      guardFacts: facts.length,
      decision: facts[0].decision,
      statusCode: result.statusCode,
    })
  } finally {
    await server.close()
  }
})

// ===========================================================================
// SEARCH — a REAL request and a REAL parse (the count is the witness)
// ===========================================================================
test('PD30-E2E-SEARCH: the host Exa provider issues a real POST and PARSES the answer into sources', async () => {
  let seen = null
  const exa = await localServer((req, res) => {
    let raw = ''
    req.on('data', (chunk) => { raw += String(chunk) })
    req.on('end', () => {
      seen = { method: req.method, url: req.url, authorization: req.headers.authorization, body: raw === '' ? null : JSON.parse(raw) }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(EXA_ANSWER))
    })
  })
  try {
    const { searchProvider } = await shippedTransport({ search: { baseURL: exa.url, apiKey: 'pd30-test-key' } })
    const counter = countedBase()
    const { face, facts } = await mountFace({
      provider: {
        fetch: async () => { counter.entries.fetch += 1; throw new Error('unreachable') },
        search: async (request, signal) => { counter.entries.search += 1; return searchProvider.search(request, signal) },
        searchAvailable: () => searchProvider.available() === true,
      },
    })
    const result = await face.search({ query: 'pd30 governed search', maxResults: 2 })
    // The REAL request the shipped provider issued:
    assert.ok(seen !== null, 'the local endpoint must have received a request')
    assert.equal(seen.method, 'POST', 'the Exa provider issues POST /search')
    assert.equal(seen.url, '/search')
    assert.equal(seen.authorization, 'Bearer pd30-test-key', 'the configured credential is sent as a bearer token')
    assert.equal(seen.body?.query, 'pd30 governed search', 'the DECLARED query is what the provider sent')
    assert.equal(seen.body?.contents?.highlights?.highlightsPerUrl, 1)
    // The REAL parse: four results, one with no usable highlight (dropped), one
    // with a blank highlight first (the first NON-BLANK wins), capped to 2 by
    // the seam's own `maxResults` enforcement.
    assert.equal(exa.connections(), 1, 'exactly ONE connection to the search endpoint')
    assert.equal(Array.isArray(result.sources), true)
    assert.equal(result.sources.length, 2, `the seam must cap to maxResults=2 (got ${String(result.sources.length)})`)
    assert.equal(result.truncated, true, 'the provider over-returned, so the seam must mark the result truncated')
    assert.equal(result.sources[0].url, 'https://example.test/a')
    assert.equal(result.sources[0].snippet, 'first snippet')
    assert.equal(result.sources[0].publishedAt, '2026-11-01')
    assert.equal(result.sources[1].snippet, 'second snippet', 'a blank highlight is skipped, the next one is used')
    assert.equal(facts.length, 1, 'exactly ONE guard fact for the search')
    assert.equal(facts[0].decision, 'allow')
    assert.equal(facts[0].method, 'web:search')
    assert.equal(facts[0].locator, 'query:pd30 governed search', 'the fact names the DECLARED query')
    recordMeasurement({
      arm: 'search',
      endpoint: `${exa.url}/search`,
      backend: searchProvider.id,
      requestMethod: seen.method,
      sentQuery: seen.body?.query,
      answerResults: EXA_ANSWER.results.length,
      parsedSources: result.sources.length,
      truncated: result.truncated,
      guardFacts: facts.length,
      decision: facts[0].decision,
    })
  } finally {
    await exa.close()
  }
})

// ===========================================================================
// DENY — the compiled lane refuses BEFORE the transport (0 entries)
// ===========================================================================
test('PD30-DENY: a `network: deny` lane refuses typed with the transport present and reachable', async () => {
  const server = await localServer((_req, res) => { res.writeHead(200, { 'content-type': 'text/plain' }); res.end(KNOWN_BODY) })
  try {
    const { fetchProvider, searchProvider } = await shippedTransport({ testEndpoints: [server.url], search: { baseURL: server.url, apiKey: 'k' } })
    const counter = countedBase()
    const { face, facts } = await mountFace({
      network: 'deny',
      provider: {
        fetch: async (request, signal) => { counter.entries.fetch += 1; return fetchProvider.fetch(request, signal) },
        search: async (request, signal) => { counter.entries.search += 1; return searchProvider.search(request, signal) },
        testEndpoints: [server.url],
      },
      testEndpoints: [server.url],
    })
    await expectRefusal({
      face, facts, counter,
      run: () => face.fetch({ url: `${server.url}/denied` }),
      code: 'NETWORK_UNCONFINED_REALM',
      label: 'deny/fetch',
    })
    await expectRefusal({
      face, facts, from: 1, counter,
      run: () => face.search({ query: 'deny lane search' }),
      code: 'NETWORK_UNCONFINED_REALM',
      label: 'deny/search',
    })
    assert.equal(server.connections(), 0, 'the deny lane must open ZERO connections')
    assert.deepEqual(server.requests, [], 'the deny lane must issue ZERO requests')
    recordMeasurement({
      arm: 'deny', url: `${server.url}/denied`,
      serverConnections: server.connections(), serverRequests: server.requests,
      providerEntries: counter.entries, guardFacts: facts.length,
      codes: facts.map((fact) => fact.decidedBy),
    })
  } finally {
    await server.close()
  }
})

// ===========================================================================
// SSRF — the destination leg, on an ALLOW lane, before the transport
// ===========================================================================
test('PD30-SSRF: loopback/private/link-local/ULA/metadata targets are refused on an ALLOW lane with 0 provider entries', async () => {
  // The fixture the composition DID stand up: its origin is the ONLY exemption.
  const fixture = await localServer((_req, res) => { res.writeHead(200); res.end(KNOWN_BODY) })
  try {
    const counter = countedBase()
    const { face, facts } = await mountFace({
      provider: counter.provider,
      testEndpoints: [fixture.url],
    })
    const targets = [
      ['loopback by name', 'http://localhost:9/x'],
      ['loopback subdomain', 'http://localtest.localhost:9/x'],
      ['loopback literal', 'http://127.0.0.1:9/x'],
      ['loopback alias range', 'http://127.1.2.3:9/x'],
      ['RFC1918 10/8', 'http://10.1.2.3/x'],
      ['RFC1918 172.16/12', 'http://172.16.5.5/x'],
      ['RFC1918 192.168/16', 'http://192.168.1.1/x'],
      ['carrier NAT 100.64/10', 'http://100.64.0.1/x'],
      ['link-local (metadata range)', 'http://169.254.169.254/latest/meta-data/'],
      ['AWS/Azure metadata literal', 'http://169.254.169.254/'],
      ['GCP metadata name', 'http://metadata.google.internal/computeMetadata/v1/'],
      ['IPv6 loopback', 'http://[::1]/x'],
      ['IPv6 ULA', 'http://[fd00::1]/x'],
      ['IPv6 link-local', 'http://[fe80::1]/x'],
      ['unroutable 0/8', 'http://0.0.0.0/x'],
    ]
    let index = 0
    for (const [label, url] of targets) {
      const before = facts.length
      await expectRefusal({
        face, facts, from: before, counter,
        run: () => face.fetch({ url }),
        code: 'WEB_DESTINATION_FORBIDDEN',
        label: `ssrf/${label}`,
      })
      index += 1
    }
    assert.equal(index, targets.length)
    assert.equal(counter.entries.fetch, 0, 'NO SSRF target may reach the transport')
    assert.equal(fixture.connections(), 0, 'the fixture must not be contacted by any SSRF arm')
    // The counter-check that the fixture is NOT the reason: the DECLARED
    // endpoint on the same face, same provider, IS admitted.
    const admitted = await face.fetch({ url: `${fixture.url}/ok` })
    assert.equal(admitted.statusCode, 200, 'the declared test endpoint must be admitted on the SAME face/provider')
    assert.equal(counter.entries.fetch, 1, 'the admitted call is the FIRST and only provider entry')
    // The fake provider answers without a socket ON PURPOSE: this arm is about
    // the ADMISSION boundary, and the fixture server counts what a REAL
    // transport would have opened (zero, since only the fake was installed).
    assert.equal(fixture.connections(), 0, 'the fixture is never contacted through the fake provider')
    recordMeasurement({
      arm: 'ssrf', targets: targets.map(([label, url]) => ({ label, url })),
      refused: targets.length, providerEntries: counter.entries, fixtureConnections: fixture.connections(),
      admittedAfterwards: `${fixture.url}/ok`,
    })
  } finally {
    await fixture.close()
  }
})

// ===========================================================================
// MALFORMED — scheme / host / length / query, before the transport
// ===========================================================================
test('PD30-MALFORMED: illegal scheme, empty host, over-long URL and a query-less search are refused typed', async () => {
  const counter = countedBase()
  const { face, facts } = await mountFace({ provider: counter.provider })
  const cases = [
    ['file scheme', () => face.fetch({ url: 'file:///etc/passwd' })],
    ['gopher scheme', () => face.fetch({ url: 'gopher://example.test/1' })],
    ['javascript scheme', () => face.fetch({ url: 'javascript:alert(1)' })],
    ['empty host', () => face.fetch({ url: 'http://:80/no-host' })],
    ['relative URL', () => face.fetch({ url: '/just/a/path' })],
    ['no URL at all', () => face.fetch({})],
    ['over-long URL', () => face.fetch({ url: `https://example.test/${'a'.repeat(9000)}` })],
  ]
  for (const [label, run] of cases) {
    const before = facts.length
    await expectRefusal({ face, facts, from: before, counter, run, code: 'WEB_REQUEST_MALFORMED', label: `malformed/${label}` })
  }
  const before = facts.length
  await expectRefusal({
    face, facts, from: before, counter,
    run: () => face.search({}),
    code: 'WEB_REQUEST_MALFORMED',
    label: 'malformed/no query',
  })
  assert.equal(counter.entries.fetch + counter.entries.search, 0, 'a malformed request never reaches the transport')
  recordMeasurement({
    arm: 'malformed', cases: cases.map(([label]) => label).concat('search with no query'),
    refused: cases.length + 1, providerEntries: counter.entries,
  })
})

// ===========================================================================
// MISSING / UNAVAILABLE PROVIDER — the honest "no backend" shape
// ===========================================================================
test('PD30-NO-PROVIDER: a face with no search and an unavailable provider are BOTH typed gaps, not empty results', async () => {
  // (a) the provider exposes no `search` at all.
  const counter = countedBase()
  const noSearch = await mountFace({ provider: { fetch: counter.provider.fetch } })
  await expectRefusal({
    face: noSearch.face, facts: noSearch.facts, counter,
    run: () => noSearch.face.search({ query: 'no backend' }),
    code: 'WEB_PROVIDER_UNAVAILABLE',
    label: 'no-search-method',
  })
  // (b) the provider HAS search but reports itself unavailable (today: no key).
  const unavailable = await shippedTransport({ search: { apiKey: '' } })
  assert.equal(unavailable.searchProvider.available(), false, 'an empty credential makes the host provider unavailable')
  const gap = await mountFace({
    provider: {
      fetch: async () => { throw new Error('unreachable') },
      search: async () => { throw new Error('the provider must not be entered') },
      searchAvailable: () => unavailable.searchProvider.available() === true,
    },
  })
  await expectRefusal({
    face: gap.face, facts: gap.facts,
    run: () => gap.face.search({ query: 'unavailable backend' }),
    code: 'WEB_PROVIDER_UNAVAILABLE',
    label: 'unavailable-provider',
  })
  recordMeasurement({
    arm: 'no-provider',
    shapes: ['provider exposes no search', 'provider.available() === false (empty credential)'],
    codes: ['WEB_PROVIDER_UNAVAILABLE', 'WEB_PROVIDER_UNAVAILABLE'],
    providerEntries: counter.entries,
    searchReason: unavailable.searchReason,
  })
})

// ===========================================================================
// BASE WEB FALLBACK — the ceiling is a counter
// ===========================================================================
test('PD30-BASE-FALLBACK-ZERO: every refusal leaves a transport that WOULD answer completely untouched', async () => {
  const counter = countedBase()
  const { face, facts } = await mountFace({ provider: counter.provider, testEndpoints: [] })
  const refusals = [
    ['ssrf', () => face.fetch({ url: 'http://169.254.169.254/' }), 'WEB_DESTINATION_FORBIDDEN'],
    ['malformed', () => face.fetch({ url: 'file:///etc/passwd' }), 'WEB_REQUEST_MALFORMED'],
  ]
  for (const [label, run, code] of refusals) {
    const before = facts.length
    await expectRefusal({ face, facts, from: before, counter, run, code, label })
  }
  assert.equal(counter.entries.fetch, 0, 'the inherited/base transport must be entered ZERO times on refusals')
  assert.equal(counter.entries.search, 0, 'and neither search path')
  recordMeasurement({ arm: 'base-fallback-zero', refusals: refusals.map(([label]) => label), providerEntries: counter.entries })
})

// ===========================================================================
// THE SHIPPED SERVICE — the row's own `apply`, end to end
// ===========================================================================
test('PD30-SHIPPED-SERVICE: the row\'s own service object serves the allow lane over a real socket and refuses SSRF', async () => {
  const fixture = await localServer((_req, res) => { res.writeHead(200, { 'content-type': 'text/plain' }); res.end(KNOWN_BODY) })
  try {
    const { service, describe } = await shippedService({
      testEndpoints: [fixture.url],
      search: { baseURL: fixture.url, apiKey: 'shipped-key' },
    })
    assert.equal(describe.schema, 'a5sf-web-transport/1')
    assert.equal(describe.searchBackend, 'exa', 'the service reports the backend it really loaded')
    assert.equal(describe.searchGap, null)
    assert.deepEqual(describe.testEndpoints, [fixture.url], 'the declared fixture origins are exactly the composition\'s list')
    const provider = service.createProvider({ memberIdentity: 'member-shipped', templateId: 'worker', instanceGeneration: 1 })
    assert.equal(provider.testEndpoints?.[0], fixture.url, 'the SSRF exemption travels WITH the provider, from the row config')
    const { face, facts } = await mountFace({ provider, testEndpoints: [fixture.url] })
    const result = await face.fetch({ url: `${fixture.url}/shipped` })
    assert.equal(result.statusCode, 200)
    assert.equal(result.body?.content, KNOWN_BODY, 'the shipped transport returns the served bytes verbatim')
    assert.equal(fixture.connections(), 1, 'exactly ONE real connection')
    assert.equal(facts.length, 1)
    assert.equal(facts[0].decision, 'allow')
    // The same shipped provider, an SSRF target: refused before the wire.
    const before = facts.length
    await expectRefusal({
      face, facts, from: before,
      run: () => face.fetch({ url: 'http://169.254.169.254/latest/meta-data/' }),
      code: 'WEB_DESTINATION_FORBIDDEN',
      label: 'shipped-service/ssrf',
    })
    assert.equal(fixture.connections(), 1, 'the SSRF arm added NO connection')
    recordMeasurement({
      arm: 'shipped-service', describe, fixtureConnections: fixture.connections(),
      allowFacts: 1, refusedFacts: facts.length - 1, bodyBytes: Buffer.byteLength(KNOWN_BODY, 'utf8'),
    })
  } finally {
    await fixture.close()
  }
})

// ===========================================================================
// BASE WEB FALLBACK — through the SHIPPED transport, still zero
// ===========================================================================
test('PD30-NO-BASE-FALLBACK: the shipped transport never consults the inherited base web service', async () => {
  const fixture = await localServer((_req, res) => { res.writeHead(200, { 'content-type': 'text/plain' }); res.end(KNOWN_BODY) })
  try {
    const base = baseWebService()
    const { service } = await shippedService({ testEndpoints: [fixture.url], search: { baseURL: fixture.url, apiKey: 'k' } })
    const { face, facts } = await mountFace({
      provider: service.createProvider({ memberIdentity: 'member-no-base' }),
      testEndpoints: [fixture.url],
    })
    await face.fetch({ url: `${fixture.url}/ok` })
    let before = facts.length
    await expectRefusal({
      face, facts, from: before,
      run: () => face.fetch({ url: 'http://10.0.0.7/' }),
      code: 'WEB_DESTINATION_FORBIDDEN',
      label: 'no-base/ssrf',
    })
    before = facts.length
    await expectRefusal({
      face, facts, from: before,
      run: () => face.fetch({ url: 'file:///etc/passwd' }),
      code: 'WEB_REQUEST_MALFORMED',
      label: 'no-base/malformed',
    })
    assert.equal(base.entries.fetch + base.entries.search, 0, 'the inherited base web service must be consulted ZERO times')
    recordMeasurement({
      arm: 'no-base-fallback',
      baseServiceEntries: base.entries,
      arms: ['allow', 'ssrf', 'malformed'],
      fixtureConnections: fixture.connections(),
    })
  } finally {
    delete globalThis.__PD30_BASE_WEB__
    await fixture.close()
  }
})
