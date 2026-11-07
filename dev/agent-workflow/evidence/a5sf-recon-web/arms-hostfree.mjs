#!/usr/bin/env node
/**
 * arms-hostfree.mjs — A5SF recon D (Web face): HOST-FREE layer attribution.
 *
 * WHAT THIS IS. No Host, no boot, no port lease, no thousands of lines of
 * orchestration: it imports the SHIPPED compiled face
 * (`packages/runtime/dist/packages/runtime/team-services/src/web.js`) and the
 * SHIPPED compiler (`member-io-policy`), builds an `EffectiveIo` through the ONE
 * compiler, and drives the face against a CONTROLLED LOCAL HTTP ENDPOINT
 * (`127.0.0.1:0`). Every arm states WHICH LAYER answered:
 *
 *   allowed      the guard admitted AND the provider was entered (endpoint saw
 *                the request and bytes came back)
 *   refused      the guard refused BEFORE `provider.fetch` — the endpoint saw
 *                nothing, and the typed code is on the thrown TeamIoDenial
 *   not-entered  the face refused for a non-network reason before the guard
 *
 * WHY IT EXISTS: the live lane can only show the composition it boots. This
 * file is what separates "the guard refused" from "the provider refused" from
 * "the OS refused" WITHOUT a Host, so the boot's finding can be attributed even
 * if the boot fails. It makes no claim about a booted Host (that is
 * `run-boot.mjs`'s job) and NO networking-isolation claim of any kind: the
 * allow arms are ordinary in-process loopback egress, and the `deny-web-proof`
 * arm exists precisely to show that a deny lane with a (self-described) web-face
 * proof FETCHES — i.e. that this face has no OS-level containment to inherit.
 *
 * CORE PATCH BUDGET = 0: imports the committed dist only; writes only into this
 * evidence directory.
 *
 * @module dev/agent-workflow/evidence/a5sf-recon-web/arms-hostfree
 */
import { createServer } from 'node:http'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..')
const DIST = join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime')
const OUT = join(HERE, 'arms-hostfree.json')

const { createConfinedWebClass } = await import(pathToFileURL(join(DIST, 'team-services', 'src', 'web.js')).href)
const policy = await import(pathToFileURL(join(DIST, 'member-io-policy', 'src', 'index.js')).href)
const blueprint = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'domain', 'blueprint', 'src', 'index.js')).href)
const assembly = await import(pathToFileURL(join(DIST, 'team-services', 'src', 'product-assembly.js')).href)

const ALLOW_BYTES = 'A5SF_RECON_WEB_ALLOW_BYTES'
const SEARCH_BYTES = 'A5SF_RECON_WEB_SEARCH_BYTES'

// ── the controlled local endpoint ───────────────────────────────────────────
const endpoint = { requests: [], byPath: {} }
const server = createServer((req, res) => {
  const url = new URL(req.url ?? '/', 'http://127.0.0.1')
  endpoint.requests.push({ at: Date.now(), method: req.method, path: url.pathname, query: url.search, host: req.headers.host ?? null })
  endpoint.byPath[url.pathname] = (endpoint.byPath[url.pathname] ?? 0) + 1
  if (url.pathname === '/page') {
    res.writeHead(200, { 'content-type': 'text/plain', 'x-a5sf-recon': 'allow' })
    res.end(ALLOW_BYTES)
    return
  }
  if (url.pathname === '/search') {
    res.writeHead(200, { 'content-type': 'text/plain' })
    res.end(SEARCH_BYTES)
    return
  }
  if (url.pathname === '/redirect') {
    res.writeHead(302, { location: '/page' })
    res.end()
    return
  }
  res.writeHead(404, { 'content-type': 'text/plain' })
  res.end('not found')
})
await new Promise((done) => server.listen(0, '127.0.0.1', done))
const PORT = server.address().port
const ORIGIN = `http://127.0.0.1:${PORT}`
const endpointCount = () => endpoint.requests.length

// ── fixtures ────────────────────────────────────────────────────────────────
function lane(allow) {
  return Object.freeze({ mode: 'restricted', allow: Object.freeze([...allow]), ask: Object.freeze([]), deny: Object.freeze([]) })
}
const ROOT = '/tmp/a5sf-recon-web'
function effectiveOf(access, { instanceId = 'inst-recon-web', revision = 'recon-web:g1' } = {}) {
  const memberPolicy = Object.freeze({
    memberIdentity: instanceId,
    templateId: 'weballow',
    instanceGeneration: 1,
    revision,
    read: lane([ROOT]),
    write: lane([ROOT]),
    network: Object.freeze({ access }),
  })
  const compiled = policy.compileEffectiveIo(
    memberPolicy,
    { bindingIdentity: 'team/web', read: lane([ROOT]), write: lane([ROOT]), network: access },
    { memberIdentity: instanceId, callId: `recon:${instanceId}:team/web`, policyRevision: revision, toolBindingIdentity: 'team/web', approvedOnce: false },
  )
  if (compiled.ok !== true) throw new Error(`the ONE compiler refused the fixture lane: ${JSON.stringify(compiled)}`)
  return compiled.value
}

function httpGet(target, { follow = false, hops = 0 } = {}) {
  return new Promise((done, fail) => {
    const url = new URL(target)
    const req = createServerRequest(url, fail, done, { follow, hops })
    req()
  })
  function createServerRequest(url, fail, done, { follow, hops }) {
    return () => {
      import('node:http').then(({ request }) => {
        const r = request({ host: url.hostname, port: url.port, path: `${url.pathname}${url.search}`, method: 'GET', headers: { connection: 'close' } }, (res) => {
          const chunks = []
          res.on('data', (c) => chunks.push(c))
          res.on('end', () => {
            const status = res.statusCode ?? 0
            if (follow && status >= 300 && status < 400 && hops < 2) {
              const next = new URL(String(res.headers.location ?? '/'), url)
              httpGet(next.href, { follow, hops: hops + 1 }).then(done, fail)
              return
            }
            done({ status, headers: res.headers, body: Buffer.concat(chunks).toString('utf8') })
          })
        })
        r.setTimeout(4000, () => r.destroy(new Error('A5SF_RECON_WEB_TIMEOUT')))
        r.on('error', fail)
        r.end()
      }, fail)
    }
  }
}

/**
 * The composition-owned transport. It is a REAL socket to the local endpoint
 * (so an admitted call is observable ON THE WIRE) and it records every entry on
 * the five channels the admission-refusal contract names.
 */
function makeProvider({ probe = 'unsupported', proof = null, search = true, follow = false, probeExtras = {} } = {}) {
  const entries = { fetch: 0, search: 0, transport: 0, dns: 0, connect: 0, proxy: 0 }
  const calls = []
  const provider = {
    entries,
    calls,
    probeCalls: 0,
    proofCalls: 0,
    async fetch(request) {
      entries.fetch += 1
      entries.transport += 1
      entries.dns += 1
      entries.connect += 1
      calls.push({ channel: 'fetch', request })
      const target = typeof request?.url === 'string' ? request.url : `${ORIGIN}/page`
      const response = await httpGet(target, { follow })
      return { ok: true, status: response.status, url: target, body: response.body, headers: response.headers }
    },
    async probe() {
      provider.probeCalls += 1
      if (probe === 'unsupported') {
        return { ok: true, value: [{ dimension: 'network-destination', level: 'unsupported', note: 'this host\'s providers report no enforced network capability (recon fixture)' }] }
      }
      return {
        ok: true,
        value: [{
          dimension: 'network-destination',
          level: 'enforced',
          mechanism: 'recon-fixture mechanism (NOT applied to any process)',
          evidence: 'evidence://a5sf-recon-web/fixture-only',
          note: 'RECON FIXTURE: this row is authored, not measured; it exists to reach the PD-15 arm',
          ...probeExtras,
        }],
      }
    },
  }
  if (proof !== null) {
    provider.networkProof = async () => {
      provider.proofCalls += 1
      return proof
    }
  }
  if (search) {
    provider.search = async (request) => {
      entries.search += 1
      entries.transport += 1
      entries.dns += 1
      entries.connect += 1
      calls.push({ channel: 'search', request })
      const body = await httpGet(`${ORIGIN}/search`)
      return { ok: true, status: body.status, body: body.body }
    }
  }
  return provider
}

function faceFor({ access, provider, instanceId = 'inst-recon-web' }) {
  const facts = []
  const Base = class Base {}
  const Confined = createConfinedWebClass(Base, {
    effective: effectiveOf(access, { instanceId }),
    provider,
    onGuardConsult: (fact) => facts.push(fact),
    realm: 'member',
    toolBindingIdentity: 'team/web',
  })
  return { Confined, facts }
}

async function arm(id, { access, provider, call, instanceId = 'inst-recon-web' }) {
  const before = endpointCount()
  const { Confined, facts } = faceFor({ access, provider, instanceId })
  const face = new Confined(undefined)
  const started = Date.now()
  let outcome
  try {
    const value = await call(face)
    outcome = { kind: 'returned', value }
  } catch (error) {
    outcome = {
      kind: 'threw',
      name: String(error?.name ?? 'Error'),
      code: String(error?.code ?? ''),
      message: String(error?.message ?? error),
      details: error?.details ?? null,
    }
  }
  const record = {
    id,
    at: new Date().toISOString(),
    durationMs: Date.now() - started,
    lane: { networkAccess: access, providerProbe: provider === undefined ? null : (provider.probe === undefined ? 'absent' : 'present') },
    layer: outcome.kind === 'returned'
      ? (provider.entries.fetch + provider.entries.search > 0 ? 'guard-admitted+provider-entered' : 'guard-admitted+provider-not-entered')
      : (provider.entries.fetch + provider.entries.search > 0 ? 'provider-entered-then-threw' : 'guard-refused' ),
    outcome,
    guardFacts: facts,
    guardFactCount: facts.length,
    providerEntries: { ...provider.entries },
    providerCalls: provider.calls,
    probeCalls: provider.probeCalls ?? 0,
    proofCalls: provider.proofCalls ?? 0,
    endpoint: {
      requestsDuringArm: endpoint.requests.slice(before),
      countDuringArm: endpointCount() - before,
      totalSoFar: endpointCount(),
    },
    osLevelNetworkIsolationClaimed: false,
  }
  return record
}

const arms = []

// ── A1: network ALLOW, web_fetch reaches the wire and the bytes come back ────
{
  const provider = makeProvider()
  arms.push(await arm('A1-allow-fetch', {
    access: 'allow',
    provider,
    call: (face) => face.fetch({ url: `${ORIGIN}/page` }),
  }))
}

// ── A2: network ALLOW, web_search reaches the wire (both request shapes) ─────
// Two providers so each arm's entry counter is its own (the previous shared
// feed made A2b's counter read cumulative).
{
  arms.push(await arm('A2a-allow-search-queries-array', {
    access: 'allow',
    provider: makeProvider(),
    call: (face) => face.search({ queries: ['a5sf recon d web'] }),
  }))
  arms.push(await arm('A2b-allow-search-query-singular', {
    access: 'allow',
    provider: makeProvider(),
    call: (face) => face.search({ query: 'a5sf recon d web', maxResults: 3 }),
  }))
}

// ── A3: network DENY, provider probe unsupported, no proof ─────────────────
{
  const provider = makeProvider({ probe: 'unsupported' })
  arms.push(await arm('A3-deny-unsupported', {
    access: 'deny',
    provider,
    call: (face) => face.fetch({ url: `${ORIGIN}/page` }),
  }))
}

// ── A4: network DENY, probe enforced, proof minted for the SUBPROCESS face ──
{
  const provider = makeProvider({
    probe: 'enforced',
    proof: { face: 'subprocess', mechanism: 'netns CLONE_NEWUSER|CLONE_NEWNET (fixture)', evidence: 'evidence://a5sf-recon-web/fixture-only', netNsInode: 4026532, hostNetNsInode: 4026531 },
  })
  arms.push(await arm('A4-deny-subprocess-face-proof', {
    access: 'deny',
    provider,
    call: (face) => face.fetch({ url: `${ORIGIN}/page` }),
  }))
}

// ── A5: network DENY, probe enforced, SELF-DESCRIBED web-face proof ─────────
// THIS IS THE NEGATIVE CONTROL, NOT A PRODUCT STATE. It shows the guard admits
// on a web-face proof and the in-process transport then connects: the denial is
// a service-level statement, and a deny lane that is admitted is ordinary egress.
{
  const provider = makeProvider({
    probe: 'enforced',
    proof: { face: 'web', mechanism: 'recon-fixture service-level only (NOT an OS mechanism)', evidence: 'evidence://a5sf-recon-web/fixture-only', netNsInode: null, hostNetNsInode: null },
  })
  arms.push(await arm('A5-deny-web-face-proof-admitted', {
    access: 'deny',
    provider,
    call: (face) => face.fetch({ url: `${ORIGIN}/page` }),
  }))
}

// ── A9: network DENY, probe enforced, NO proof at all ─────────────────────
{
  const provider = makeProvider({ probe: 'enforced' })
  arms.push(await arm('A9-deny-enforced-without-proof', {
    access: 'deny',
    provider,
    call: (face) => face.fetch({ url: `${ORIGIN}/page` }),
  }))
}

// ── A10: network DENY, a web-face proof but an UNSUPPORTED probe ───────────
// Ordering check: the capability probe answers first, so a proof alone never
// rescues an unenforced backend.
{
  const provider = makeProvider({
    probe: 'unsupported',
    proof: { face: 'web', mechanism: 'recon-fixture service-level only', evidence: 'evidence://a5sf-recon-web/fixture-only', netNsInode: null, hostNetNsInode: null },
  })
  arms.push(await arm('A10-deny-web-proof-but-unsupported-probe', {
    access: 'deny',
    provider,
    call: (face) => face.fetch({ url: `${ORIGIN}/page` }),
  }))
}

// ── A6: search with a provider that exposes no search ──────────────────────
{
  const provider = makeProvider({ search: false })
  arms.push(await arm('A6-allow-search-provider-without-search', {
    access: 'allow',
    provider,
    call: (face) => face.search({ queries: ['a5sf recon d web'] }),
  }))
}

// ── A7: transport error propagates unchanged on an ALLOW lane ──────────────
{
  const provider = makeProvider()
  const dead = createServer(() => {})
  await new Promise((done) => dead.listen(0, '127.0.0.1', done))
  const deadPort = dead.address().port
  await new Promise((done) => dead.close(done))
  provider.fetch = async (request) => {
    provider.entries.fetch += 1
    provider.entries.transport += 1
    provider.entries.connect += 1
    provider.calls.push({ channel: 'fetch', request, note: 'closed port' })
    return httpGet(`http://127.0.0.1:${deadPort}/page`)
  }
  arms.push(await arm('A7-allow-transport-error', {
    access: 'allow',
    provider,
    call: (face) => face.fetch({ url: `http://127.0.0.1:${deadPort}/page` }),
  }))
}

// ── A8: redirect on an ALLOW lane — one guard fact, two wire requests ──────
{
  const provider = makeProvider({ follow: true })
  arms.push(await arm('A8-allow-redirect-followed-by-provider', {
    access: 'allow',
    provider,
    call: (face) => face.fetch({ url: `${ORIGIN}/redirect` }),
  }))
}

// ── A11: the ASSEMBLY layer — a product blueprint that says network=deny ──
// This is the layer ABOVE the guard: the governed product path derives the
// Member declaration from the bound blueprint and REFUSES a narrowed network
// lane before any realm exists, so a Member on such a blueprint never reaches a
// model turn, a guard consult or a provider.
const assemblyArm = (() => {
  const laneDoc = (mode) => ({ mode, default: 'deny' })
  const document = {
    schemaVersion: 4,
    blueprintId: 'team.a5sf.recon.web.deny.assembly',
    revision: '1',
    leader: { templateId: 'leader', persona: 'assembly-layer probe leader' },
    members: [{ templateId: 'webdeny', persona: 'assembly-layer probe member' }],
    requirements: [],
    memberEnvelopes: [],
    policyStates: [],
    permissionMutationEnvelope: { rules: [] },
    teamHardEnvelope: { rules: [] },
    metadata: {},
    memberIoCeilings: [{
      templateId: 'webdeny',
      io: {
        read: { mode: 'restricted', allow: [ROOT], ask: [], deny: [] },
        write: { mode: 'restricted', allow: [ROOT], ask: [], deny: [] },
        network: laneDoc('deny'),
      },
    }],
  }
  const parsed = blueprint.parseBlueprint(`---\n${JSON.stringify(document, null, 2)}\n---\n`)
  const out = { id: 'A11-assembly-network-deny-blueprint', at: new Date().toISOString(), parsedOk: parsed?.ok !== false, layers: [] }
  const capture = (label, fn) => {
    try {
      const value = fn()
      out.layers.push({ label, kind: 'returned', value })
    } catch (error) {
      out.layers.push({
        label,
        kind: 'threw',
        name: String(error?.name ?? 'Error'),
        code: String(error?.code ?? ''),
        message: String(error?.message ?? error),
        where: error?.details?.where ?? error?.where ?? null,
      })
    }
  }
  // (1) the GOVERNED path the shipped preset uses
  capture('deriveProductRealmPlanFromBlueprint', () => assembly.deriveProductRealmPlanFromBlueprint({
    blueprint: parsed.blueprint ?? parsed,
    authority: { revision: 'recon-authority:1', admitted: true },
    instanceGenerations: { webdeny: 1 },
  }))
  // (2) the DECLARED path (a5sfMemberPolicies row config)
  capture('parseProductRealmDeclaration', () => assembly.parseProductRealmDeclaration({
    schema: 'a5sf-product-member-policies/1',
    teamId: 'team.a5sf.recon.web.deny.assembly',
    blueprintRevision: '1',
    authority: { revision: 'recon-authority:1', admitted: true },
    members: [{
      templateId: 'webdeny',
      instanceGeneration: 1,
      ceiling: {
        read: { mode: 'restricted', allow: [ROOT], ask: [], deny: [] },
        write: { mode: 'restricted', allow: [ROOT], ask: [], deny: [] },
        network: laneDoc('deny'),
      },
    }],
  }, { blueprintSource: `---\n${JSON.stringify(document, null, 2)}\n---\n` }))
  out.observation = 'a network=deny ceiling is refused by the PRODUCT ASSEMBLY, above the web guard: no realm, no Member turn, no guard fact, no provider entry'
  out.osLevelNetworkIsolationClaimed = false
  return out
})()
arms.push(assemblyArm)

server.close()

const report = {
  schema: 'a5sf-recon-web/arms-hostfree/1',
  at: new Date().toISOString(),
  question: 'Which layer answers a governed Member\'s web_fetch/web_search: the guard (admission), the composition provider, or the OS?',
  repo: { sha: process.env.A5SF_RECON_SHA ?? null, dist: DIST },
  endpoint: { origin: ORIGIN, port: PORT, requests: endpoint.requests, byPath: endpoint.byPath },
  verifier: {
    face: 'packages/runtime/dist/packages/runtime/team-services/src/web.js',
    compiler: 'packages/runtime/dist/packages/runtime/member-io-policy/src/index.js',
    note: 'the SHIPPED compiled face and the ONE compiler; the provider and the fixture capability rows are THIS FILE\'s composition and are labelled as such',
  },
  arms,
  limits: {
    wording: 'Refusing to fetch is a statement about our own admission code, made before the OS was asked. An admitted fetch is ordinary in-process loopback egress. Nothing here is network confinement or isolation, and no booted Host is exercised.',
    osLevelNetworkIsolationClaimed: false,
  },
}
mkdirSync(HERE, { recursive: true })
writeFileSync(OUT, `${JSON.stringify(report, null, 2)}\n`)
// eslint-disable-next-line no-console
console.log(`arms-hostfree: ${arms.length} arms -> ${OUT}`)
for (const a of arms) {
  if (Array.isArray(a.layers)) {
    // eslint-disable-next-line no-console
    console.log(`${a.id.padEnd(42)} ${'assembly-layer'.padEnd(36)} layers=${a.layers.map((l) => `${l.label}:${l.code || l.kind}`).join(',')}`)
    continue
  }
  // eslint-disable-next-line no-console
  console.log(`${a.id.padEnd(42)} ${a.layer.padEnd(36)} facts=${a.guardFactCount} entries=${a.providerEntries.fetch + a.providerEntries.search} endpoint=${a.endpoint.countDuringArm} ${a.outcome.code || a.outcome.kind}`)
}
