/**
 * tests/world-factory/a5sf-pd27-confined-web.test.mjs — PD-27: the governed
 * Member's `web_fetch`/`web_search` ride the realm's CONFINED `web` face, so
 * the network pair PD-18 removed fail-closed comes back served by the guard
 * instead of by the inherited base provider.
 *
 * WHY THIS SUITE EXISTS. PD-18 measured the preset's `@deepseek-ai/dsh-tool-web`
 * row resolving the INHERITED `ctx.web` — the real HTTP provider and the
 * process-wide proxy dispatcher — with ZERO `a5sf-guard-consult` facts, and
 * removed `tool-web` with a disclosed CAPABILITY REGRESSION plus the reason:
 * "the web face needs a composition-owned transport (the shipped layer has
 * none)". The face shipped in BL-18/PD-15 (`team-services/src/web.ts`); what was
 * missing was a way to place the model-visible NAMES on a context where `ctx.web`
 * IS that face. That is this lane's route-C shadow
 * (`src/plugin/live/confined-web-tool.mjs`).
 *
 * This suite is HOST-FREE (no boot, no DSH_HOME, no DSH port) and pins:
 *
 *   PIN          with A5SF_PD27_PIN=1 the recorded branch point (24d2cf760) is
 *                read out of git: its governed preset declares NO `tool-web`
 *                row, and a REAL tool registry answers the host router's typed
 *                `unknown tool` for both names. The CURRENT composition
 *                declares the row, so the pin is a measured before/after.
 *   SURFACE      the shipped preset restores the NAMES through THIS module and
 *                never through the host package (a host row on the preset scope
 *                is ordinary ungoverned egress — the hole PD-18 measured).
 *   PARITY       the definitions the shadow registers are the host package's
 *                OWN (delegated `apply`): name, description, parameter schema,
 *                output schema, `timeoutMs` and concurrency are compared
 *                field-for-field against a direct host `apply`, so "byte-equal
 *                by construction" is a measurement, not a claim.
 *   MARKER       the marker the shadow trusts and the marker the confined class
 *                sets are the SAME global symbol (the .mjs module is copied into
 *                the dist mirror, so the two sides share no import edge).
 *   REFUSE       on a non-confined scope both calls are a typed
 *                `NETWORK_UNCONFINED_REALM` with ZERO base-provider entries —
 *                the preset-scope answer, whatever transport the deployment has.
 *   E2E-ALLOW    through the REAL shadow -> REAL confined face -> REAL
 *                `HttpFetchProvider` transport -> a LOCAL HTTP SERVER: the known
 *                body comes back, the server counts exactly ONE connection, and
 *                exactly ONE allow fact is emitted.
 *   E2E-DENY     the same chain with `network: deny` and the SAME real transport
 *                present: a typed `NETWORK_UNCONFINED_REALM` refusal, ZERO
 *                connections at the server (the transport is never entered) and
 *                exactly ONE deny fact. This is PD-15's recorded residual closed:
 *                the deny claim is tested with a transport that WOULD connect.
 *   E2E-REDIRECT an allow-lane fetch that answers 302 to a DIFFERENT origin (a
 *                second local server) is NOT followed by the host provider: the
 *                302 is returned and the second server counts ZERO connections.
 *   E2E-SEARCH   the audit locator now names the declared query (PD-27 reads the
 *                singular `query` the host tool actually sends; PD-15 recorded
 *                `<search:malformed-request>` here).
 *
 * MUTATION CONTROL hooks (never set in CI):
 *   A5SF_PD27_WEB_MODULE=<path>     REFUSE/ALLOW read a MUTATED module copy (the
 *                                   marker check removed) so REFUSE must go red
 *   A5SF_PD27_COMPOSITION=<path>    SURFACE reads a mutated composition (the
 *                                   `tool-web` row dropped) so SURFACE must go red
 * `tests/world-factory/a5sf-pd27-mutation-controls.mjs` drives both plus a
 * guard mutation (deny replaced by a direct provider call) which must redden
 * E2E-DENY on the SERVER's own connection counter.
 *
 * What is fixture (disclosed): the local HTTP servers, the mutated copies and
 * the member/tool identity. The product code under test is the shadow module,
 * the confined `web` face, its guard, the marker, the shipped composition and
 * the PINNED host transport (`@deepseek-ai/dsh-web-fetch-http`).
 *
 * Run: node --test tests/world-factory/a5sf-pd27-confined-web.test.mjs
 */
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { appendFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { test } from 'node:test'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const COMPOSITION = process.env.A5SF_PD27_COMPOSITION ?? join(REPO, 'cordis.patch.yml')
const PIN = process.env.A5SF_PD27_PIN === '1'
const WEB_MODULE = process.env.A5SF_PD27_WEB_MODULE
  ?? join(REPO, 'packages', 'runtime', 'src', 'plugin', 'live', 'confined-web-tool.mjs')
const PRESET_ID = 'a5sf-governed-member'
/** The recorded branch point of this task (`origin/master` = the PD-26 merge). */
const BASE_COMMIT = '24d2cf760'
/** The two names this lane restores, and the row id that carries them. */
const RESTORED = Object.freeze(['web_fetch', 'web_search'])
const ROW_ID = 'tool-web'
/** The body the local server serves and the test asserts arrived verbatim. */
const KNOWN_BODY = 'A5SF_PD27_KNOWN_BODY_7f3c'

const runtimeRequire = createRequire(join(REPO, 'packages', 'runtime', 'package.json'))

// ── the local HTTP server (a REAL socket, and a REAL connection counter) ─────
/**
 * Start one local server. `connections` counts every accepted TCP connection, so
 * "the call never went out" is a counter, not an inference from a refusal text.
 *
 * @param {(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void} handler
 * @returns {Promise<{url: string, connections: () => number, requests: string[], close: () => Promise<void>}>}
 */
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

// ── the REAL host transport (the pinned baseline provider) ──────────────────
/**
 * The pinned baseline `HttpFetchProvider` — the SAME class the standard preset's
 * `web-fetch-http` row registers: real sockets, real HTTP parsing, its own
 * same-origin-only redirect policy, its own byte/char/time limits.
 *
 * ONE fixture is injected, and it is the provider's OWN documented seam: the
 * second constructor argument (`resolveAddresses`, "overridden only by focused
 * tests") is a resolver answering the loopback address, because the shipped
 * resolver refuses non-public destinations (SSRF policy) and this suite's
 * server is local. The socket, the request, the response parse and the redirect
 * decision are the shipped ones; only the DNS answer is canned.
 */
async function realTransport(seams, overrides = {}) {
  const { HttpFetchProvider } = await import(
    pathToFileURL(join(seams.pristine, 'packages', 'web', 'web-fetch-http', 'lib', 'index.js')).href
  )
  const loopbackResolver = async (hostname) => {
    assert.equal(String(hostname), '127.0.0.1', 'the only host this suite resolves is its own local server')
    return [{ address: '127.0.0.1', family: 4 }]
  }
  return new HttpFetchProvider({
    maxResponseBytes: 5_000_000,
    maxBodyChars: 100_000,
    timeoutMs: 10_000,
    maxRedirects: 5,
    userAgent: 'dsh-agent-team/pd27-test',
    ...overrides,
  }, loopbackResolver)
}

// ── the shadow module on a context ─────────────────────────────────────────
function toolsRegistryOf() {
  const registered = []
  return {
    registered,
    tools: { register: (definition) => { registered.push(definition); return () => undefined }, get: () => undefined },
  }
}
const SYSTEM_PROMPT = { section: () => {}, getSectionOrder: () => 0 }
const EXEC = { signal: new AbortController().signal }

async function mountShadow(web) {
  const module = await import(pathToFileURL(WEB_MODULE).href)
  const { tools, registered } = toolsRegistryOf()
  module.apply({ tools, systemPrompt: SYSTEM_PROMPT, web }, {})
  return { registered, module }
}

// ── evidence recording (opt-in, one JSONL line per measured arm) ───────────
/**
 * Append one measured arm to `$A5SF_PD27_EVIDENCE/host-free-runs.jsonl`. Unset
 * in CI; the lane's evidence run sets it. The numbers are the ones the
 * assertions above just made, so the file cannot drift from the test.
 */
function recordMeasurement(arm) {
  const dir = process.env.A5SF_PD27_EVIDENCE
  if (dir === undefined || dir.trim() === '') return
  const path = join(dir, 'host-free-runs.jsonl')
  appendFileSync(path, `${JSON.stringify({ schema: 'a5sf-pd27/host-free-arm/1', at: new Date().toISOString(), ...arm })}\n`)
}

/** The text a model would see for a settled tool result. */
function textOf(settled) {
  const parts = Array.isArray(settled?.content) ? settled.content : []
  return parts.map((part) => (part?.type === 'text' ? String(part.text) : '')).join('')
}

// ── composition helpers ────────────────────────────────────────────────────
function parseYaml(text) {
  const YAML = runtimeRequire('yaml')
  return YAML.parse(text.replace(/!!js /gu, ''))
}
function rowsOf(document) {
  const rows = Array.isArray(document) ? document : document === null || document === undefined ? [] : [document]
  return rows.flatMap((row) => (Array.isArray(row?.insert) ? rowsOf(row.insert) : [row]))
}
function flattenPlugins(list) {
  const out = []
  for (const row of list ?? []) {
    if (row?.group === true) { out.push(...flattenPlugins(row.config)); continue }
    if (row?.id !== undefined && row?.name !== undefined) out.push(row)
  }
  return out
}
function presetPlugins(text) {
  const presets = rowsOf(parseYaml(text)).filter((row) => row?.config?.id === PRESET_ID)
  assert.equal(presets.length, 1, `exactly one ${PRESET_ID} row must be declared`)
  return flattenPlugins(presets[0].config.plugins)
}

// A real tool registry + prompt service, so "unknown tool" is the host's answer.
async function realToolRouter() {
  const { Context } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href)
  const ToolRuntime = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-tools')).href)).default
  const SystemPrompt = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-system-prompt')).href)).default
  const root = new Context()
  await root.plugin(SystemPrompt)
  await root.plugin(ToolRuntime)
  return root.get('tools')
}
async function dispatch(tools, name, args) {
  const settled = await tools.execute({ signal: new AbortController().signal, callId: `pd27-${name}`, name, arguments: args, agent: {} })
  return { isError: settled.isError === true, text: textOf(settled) }
}

// ===========================================================================
// PIN
// ===========================================================================
test('PD27-PIN: the branch point offers neither name and the host router answers typed `unknown tool`', { skip: !PIN }, async () => {
  const base = execFileSync('git', ['-C', REPO, 'show', `${BASE_COMMIT}:cordis.patch.yml`], { encoding: 'utf8' })
  const baseIds = presetPlugins(base).map((row) => row.id)
  assert.equal(baseIds.includes(ROW_ID), false, `BASE ${BASE_COMMIT} must NOT carry the '${ROW_ID}' row (this lane's premise)`)
  const tools = await realToolRouter()
  for (const name of RESTORED) {
    const settled = await dispatch(tools, name, name === 'web_fetch' ? { url: 'http://127.0.0.1:1/' } : { queries: ['pd27'] })
    assert.equal(settled.isError, true, `${name} must be a typed error on the pre-fix surface`)
    assert.match(settled.text, new RegExp(`unknown tool "${name}"`, 'u'), `${name} must be the host router's typed unknown-tool refusal`)
  }
  // ... while the SHIPPED composition DOES declare the row (read from the
  // committed file, so the composition mutation control reddens SURFACE only).
  const currentIds = presetPlugins(readFileSync(join(REPO, 'cordis.patch.yml'), 'utf8')).map((row) => row.id)
  assert.equal(currentIds.includes(ROW_ID), true, 'the composition under test must declare the tool-web row')
})

// ===========================================================================
// SURFACE
// ===========================================================================
test('PD27-SURFACE: the name is restored through the Team module, never through the host package row', () => {
  const plugins = presetPlugins(readFileSync(COMPOSITION, 'utf8'))
  const row = plugins.find((entry) => entry.id === ROW_ID)
  assert.ok(row, `the governed preset must declare '${ROW_ID}'`)
  assert.equal(String(row.name), 'dsh-agent-team/web-tool', 'the row must be THIS module (the fail-closed name holder)')
  assert.notEqual(String(row.name), '@deepseek-ai/dsh-tool-web', 'the host package row on the preset scope is ordinary ungoverned egress')
  for (const foreign of ['web-fetch-http', 'web-search-deepseek']) {
    assert.equal(plugins.some((entry) => String(entry.name).includes(foreign)), false, `the governed preset must not mount the host transport row '${foreign}'`)
  }
  // The retention list is untouched by this lane: these rows must still be here.
  for (const kept of ['tool-bash', 'tool-fs', 'tool-fs-search', 'tool-jobs', 'tool-skill', 'tool-present']) {
    assert.equal(plugins.some((entry) => entry.id === kept), true, `the governed preset must still declare '${kept}'`)
  }
})

// ===========================================================================
// PARITY — the definitions ARE the host package's own
// ===========================================================================
test('PD27-PARITY: the shadow registers the host package\'s own definitions, field for field', async () => {
  const host = await import(
    pathToFileURL(join(rebuildHostTree(), 'packages', 'web', 'tool-web', 'lib', 'index.js')).href
  )
  const hostRegistered = []
  const hostTools = { register: (definition) => { hostRegistered.push(definition); return () => undefined }, get: () => undefined }
  // The host's own `apply`, with the shipped defaults (what the standard preset does).
  host.apply({ tools: hostTools, systemPrompt: SYSTEM_PROMPT, web: { fetch: async () => ({}) } }, {
    search: true,
    fetch: true,
    searchMaxResults: host.WEB_SEARCH_MAX_RESULTS,
    searchMaxQueries: host.WEB_SEARCH_MAX_QUERIES,
    fetchTimeoutMs: host.DEFAULT_WEB_TOOL_TIMEOUT_MS,
    searchTimeoutMs: host.DEFAULT_WEB_TOOL_TIMEOUT_MS,
    fetchMaxOutputChars: host.DEFAULT_FETCH_MAX_OUTPUT_CHARS,
  })
  // The shadow, on a NON-confined scope (the refused branch: definitions only).
  const { registered } = await mountShadow({ fetch: async () => ({}), search: async () => ({}) })
  assert.equal(registered.length, hostRegistered.length, 'the shadow must place exactly the host package\'s two tools')
  for (let index = 0; index < hostRegistered.length; index += 1) {
    const mine = registered[index]
    const theirs = hostRegistered[index]
    assert.equal(mine.name, theirs.name, `tool #${String(index)} name must be the host spelling`)
    assert.equal(mine.description, theirs.description, `${String(mine.name)} description must be byte-equal to the host's`)
    assert.equal(JSON.stringify(mine.parameters), JSON.stringify(theirs.parameters), `${String(mine.name)} parameters must be byte-equal to the host's`)
    assert.equal(JSON.stringify(mine.output?.schema), JSON.stringify(theirs.output?.schema), `${String(mine.name)} output schema must be byte-equal to the host's`)
    assert.equal(mine.timeoutMs, theirs.timeoutMs, `${String(mine.name)} timeoutMs must be the host's`)
    assert.equal(mine.isConcurrencySafe?.(), theirs.isConcurrencySafe?.(), `${String(mine.name)} concurrency declaration must be the host's`)
    // The output object is the host's, key for key: the framework renders the
    // schema-shaped VALUE, so an extra renderer/presenter here would be a second
    // presentation source.
    assert.deepEqual(Object.keys(mine.output).sort(), Object.keys(theirs.output).sort(), `${String(mine.name)} output surface must be the host's`)
    assert.equal(JSON.stringify(mine.presentCall), JSON.stringify(theirs.presentCall), `${String(mine.name)} presentCall must be the host's`)
  }
  assert.deepEqual(registered.map((definition) => definition.name), RESTORED.slice().reverse(), 'both names, in the host package\'s order')
})

/** The pristine pinned host tree (the transport + tool definitions under test). */
function rebuildHostTree() {
  const { testUseTree, findTestRepoRoot } = runtimeRequire(join(REPO, 'tests', 'paths.mjs'))
  return testUseTree(findTestRepoRoot(REPO) ?? REPO)
}

// ===========================================================================
// MARKER — one global symbol, spelled on both sides
// ===========================================================================
test('PD27-MARKER: the marker the shadow trusts is the symbol the confined class sets', async () => {
  const shadow = await import(pathToFileURL(WEB_MODULE).href)
  const dist = await import(
    pathToFileURL(join(REPO, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'team-services', 'src', 'web.js')).href
  )
  assert.equal(shadow.A5SF_CONFINED_WEB_MARK, dist.A5SF_CONFINED_WEB_MARK, 'both sides must resolve the SAME registry symbol')
  assert.equal(dist.isConfinedWebFace({}), false)
  assert.equal(dist.isConfinedWebFace(undefined), false)
})

// ===========================================================================
// REFUSE — the preset-scope answer, with a base provider that would answer
// ===========================================================================
test('PD27-REFUSE: on a non-confined scope both names refuse typed and enter no provider', async () => {
  const entries = []
  const baseWeb = {
    fetch: async (request) => { entries.push(['fetch', request]); return { url: String(request?.url), statusCode: 200, body: { kind: 'text', content: 'BASE_EGRESS' }, truncated: false } },
    search: async (request) => { entries.push(['search', request]); return { sources: [], truncated: false } },
  }
  const { registered } = await mountShadow(baseWeb)
  const byName = new Map(registered.map((definition) => [definition.name, definition]))
  for (const [name, args] of [['web_fetch', { url: 'http://127.0.0.1:1/x' }], ['web_search', { queries: ['pd27'] }]]) {
    const definition = byName.get(name)
    await assert.rejects(
      () => definition.execute(args, EXEC),
      (error) => {
        assert.match(String(error?.message), /^NETWORK_UNCONFINED_REALM: /u, `${name} must be TYPED in the model-visible message`)
        assert.equal(error?.code, 'NETWORK_UNCONFINED_REALM', `${name} must carry the typed code`)
        return true
      },
    )
  }
  assert.deepEqual(entries, [], 'the base provider must never be entered on a non-confined scope')
})

// ===========================================================================
// E2E — the real chain: shadow -> confined face -> guard -> REAL transport
// ===========================================================================
async function e2eFace({ network, provider }) {
  const { loadWebSeams, effectiveOf, makeFace } = await import(pathToFileURL(join(HERE, 'lib', 'a5sf-web-arms.mjs')).href)
  const seams = await loadWebSeams(REPO)
  const effective = effectiveOf(seams, { network })
  const { face, facts } = makeFace(seams, { effective, boundary: provider })
  // MUTATION-CONTROL HOOK (never set in CI): the bypass module
  // (a5sf-pd27-mutation-controls.mjs M3) needs a direct transport to retry
  // against once the face has refused. Publishing it here is what makes the
  // deny arm measurable as EGRESS instead of as a refusal string.
  if (process.env.A5SF_PD27_DENY_BYPASS === '1') globalThis.__A5SF_PD27_DIRECT_TRANSPORT__ = provider
  return { face, facts, seams }
}

test('PD27-E2E-ALLOW: a real fetch through the confined face reaches a local server and returns its body', async () => {
  const server = await localServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })
    res.end(KNOWN_BODY)
  })
  try {
    const { loadWebSeams } = await import(pathToFileURL(join(HERE, 'lib', 'a5sf-web-arms.mjs')).href)
    const seams = await loadWebSeams(REPO)
    const transport = await realTransport(seams)
    const { face, facts } = await e2eFace({ network: 'allow', provider: transport })
    const { registered } = await mountShadow(face)
    const definition = registered.find((entry) => entry.name === 'web_fetch')
    const url = `${server.url}/known`
    const settled = await definition.execute({ url }, EXEC)
    assert.equal(settled.statusCode, 200, 'the settled result must carry the HTTP status')
    assert.equal(String(settled.url), url, 'the settled result must carry the fetched URL')
    assert.equal(settled.body?.kind, 'text', 'the local server answers text/plain')
    assert.equal(settled.body?.content, KNOWN_BODY, 'the bytes the server served must arrive verbatim')
    // The MODEL-VISIBLE text is the schema-shaped value the framework serialises
    // (the host tool defines a schema, not a renderer).
    const text = JSON.stringify(settled)
    assert.match(text, new RegExp(KNOWN_BODY, 'u'), 'the model-visible text must carry the server body')
    assert.equal(server.connections(), 1, `exactly ONE connection may be established (got ${String(server.connections())})`)
    assert.deepEqual(server.requests, ['GET /known'], 'the server must see exactly the one GET the model asked for')
    const bytes = Buffer.byteLength(String(text), 'utf8')
    assert.ok(bytes > KNOWN_BODY.length, `the rendered result must be at least the body (got ${String(bytes)} bytes)`)
    assert.equal(facts.length, 1, 'exactly ONE guard fact per call')
    assert.equal(facts[0].decision, 'allow', 'the fact must record the ALLOW decision')
    assert.equal(facts[0].method, 'web:fetch', 'the fact must name the consulted method')
    assert.equal(facts[0].locator, url, 'the fact must name the declared URL')
    recordMeasurement({
      arm: 'allow',
      transport: '@deepseek-ai/dsh-web-fetch-http (pinned baseline HttpFetchProvider, real socket)',
      url,
      sourceHost: '127.0.0.1',
      bodyBytes: Buffer.byteLength(KNOWN_BODY, 'utf8'),
      renderedBytes: bytes,
      serverConnections: server.connections(),
      serverRequests: server.requests,
      guardFacts: facts.length,
      decision: facts[0].decision,
      statusCode: settled.statusCode,
    })
  } finally {
    await server.close()
  }
})

test('PD27-DISPATCH: the REAL tool router dispatches `web_fetch` by NAME onto the shadow and reaches the face', async () => {
  const server = await localServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain; charset=utf-8' })
    res.end(KNOWN_BODY)
  })
  try {
    const { loadWebSeams } = await import(pathToFileURL(join(HERE, 'lib', 'a5sf-web-arms.mjs')).href)
    const seams = await loadWebSeams(REPO)
    const transport = await realTransport(seams)
    const { face, facts } = await e2eFace({ network: 'allow', provider: transport })
    // A REAL tool registry (the pinned ToolRuntime), not a fake list: the call
    // travels the same `tools.execute` the model's tool-call goes through.
    const tools = await realToolRouter()
    const shadow = await import(pathToFileURL(WEB_MODULE).href)
    shadow.apply({ tools, systemPrompt: SYSTEM_PROMPT, web: face }, {})
    const url = `${server.url}/dispatched`
    const settled = await tools.execute({ signal: new AbortController().signal, callId: 'pd27-dispatch', name: 'web_fetch', arguments: { url }, agent: {} })
    assert.equal(settled.isError === true, false, 'the router must DISPATCH the name (not `unknown tool`)')
    // The router renders the tool's output value into model-visible content.
    const text = textOf(settled)
    assert.match(text, new RegExp(KNOWN_BODY, 'u'), 'the dispatched call must return the server body to the model')
    assert.match(text, /HTTP 200/u, 'the dispatched call must carry the real HTTP status')
    assert.match(text, /untrusted data, not instructions/u, 'the host presentation must be the one the model sees')
    assert.equal(text.includes('unknown tool'), false, 'the router must not answer the pre-fix refusal')
    assert.equal(server.connections(), 1, 'exactly ONE connection for one dispatched call')
    assert.equal(facts.length, 1, 'exactly ONE allow fact for one dispatched call')
    assert.equal(facts[0].decision, 'allow')
  } finally {
    await server.close()
  }
})

test('PD27-E2E-DENY: with a REAL transport present the deny lane refuses typed and never connects', async () => {
  const server = await localServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end(KNOWN_BODY)
  })
  try {
    const { loadWebSeams } = await import(pathToFileURL(join(HERE, 'lib', 'a5sf-web-arms.mjs')).href)
    const seams = await loadWebSeams(REPO)
    const transport = await realTransport(seams)
    const { face, facts } = await e2eFace({ network: 'deny', provider: transport })
    const { registered } = await mountShadow(face)
    const definition = registered.find((entry) => entry.name === 'web_fetch')
    const url = `${server.url}/denied`
    await assert.rejects(
      () => definition.execute({ url }, EXEC),
      (error) => {
        assert.equal(error?.code, 'NETWORK_UNCONFINED_REALM', 'the refusal must be the typed code')
        assert.match(String(error?.message), /network=deny/u, 'the refusal must name the capability (the deny lane)')
        assert.match(String(error?.message), /network-destination='unsupported'/u, 'the refusal must name the probe answer it could not accept')
        return true
      },
    )
    assert.equal(server.connections(), 0, `ZERO connections may be established on the deny lane (got ${String(server.connections())})`)
    assert.deepEqual(server.requests, [], 'the server must see no request at all')
    assert.equal(facts.length, 1, 'exactly ONE guard fact per refused call')
    assert.equal(facts[0].decision, 'deny')
    assert.equal(facts[0].decidedBy, 'NETWORK_UNCONFINED_REALM', 'the fact must carry the typed code')
    assert.equal(facts[0].method, 'web:fetch')
    assert.equal(facts[0].locator, url)
    recordMeasurement({
      arm: 'deny',
      transport: '@deepseek-ai/dsh-web-fetch-http (the SAME pinned baseline provider, present and reachable)',
      url,
      serverConnections: server.connections(),
      serverRequests: server.requests,
      guardFacts: facts.length,
      decision: facts[0].decision,
      decidedBy: facts[0].decidedBy,
      providerProbe: 'unsupported (no probe on the transport)',
    })
  } finally {
    await server.close()
  }
})

test('PD27-E2E-REDIRECT: an allow-lane cross-origin redirect is NOT followed (no second-host egress)', async () => {
  const target = await localServer((_req, res) => { res.writeHead(200); res.end('SECOND_HOST_BODY') })
  const redirector = await localServer((_req, res) => {
    res.writeHead(302, { location: `${target.url}/landing` })
    res.end()
  })
  try {
    const { loadWebSeams } = await import(pathToFileURL(join(HERE, 'lib', 'a5sf-web-arms.mjs')).href)
    const seams = await loadWebSeams(REPO)
    const transport = await realTransport(seams)
    const { face } = await e2eFace({ network: 'allow', provider: transport })
    const { registered } = await mountShadow(face)
    const definition = registered.find((entry) => entry.name === 'web_fetch')
    await assert.rejects(
      () => definition.execute({ url: `${redirector.url}/start` }, EXEC),
      (error) => {
        // The host provider's OWN policy: a cross-origin hop is refused, never
        // followed. The face adds nothing and removes nothing here.
        assert.equal(error?.code, 'WEB_REDIRECT_BLOCKED', 'the host provider must refuse the cross-origin hop with its typed code')
        assert.match(String(error?.message), /cross-origin redirect/u)
        return true
      },
    )
    assert.equal(redirector.connections(), 1, 'the declared origin is fetched once')
    assert.equal(target.connections(), 0, 'the REDIRECT TARGET must never be connected to')
    assert.deepEqual(target.requests, [], 'the redirect target must see no request at all')
    recordMeasurement({
      arm: 'redirect-cross-origin',
      declaredServerConnections: redirector.connections(),
      targetServerConnections: target.connections(),
      code: 'WEB_REDIRECT_BLOCKED',
    })
  } finally {
    await redirector.close()
    await target.close()
  }
})

test('PD27-E2E-SEARCH: the audit locator names the singular query the host tool sends', async () => {
  const { loadWebSeams } = await import(pathToFileURL(join(HERE, 'lib', 'a5sf-web-arms.mjs')).href)
  const seams = await loadWebSeams(REPO)
  // A provider with a `search` that answers (no probe -> the deny lane refuses,
  // so this arm uses the ALLOW lane: the locator is the thing under test).
  const transport = {
    fetch: async () => ({ url: 'http://example.test/', statusCode: 200, body: { kind: 'text', content: '' }, truncated: false }),
    search: async (request) => ({ content: `provider:${String(request?.query)}`, sources: [], truncated: false }),
  }
  const { face, facts } = await e2eFace({ network: 'allow', provider: transport })
  const { registered } = await mountShadow(face)
  const definition = registered.find((entry) => entry.name === 'web_search')
  const settled = await definition.execute({ queries: ['pd27 locator query'] }, EXEC)
  assert.ok(Array.isArray(settled.sources), 'the search result must be the host shape')
  assert.equal(facts.length, 1, 'exactly ONE guard fact per search')
  assert.equal(facts[0].method, 'web:search')
  assert.equal(facts[0].locator, 'query:pd27 locator query', 'the locator must name the declared query, not the malformed marker')
})
