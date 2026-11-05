/**
 * a5sf-web-contract.test.mjs — LAYER B (native-tool contract) acceptance for the
 * Web capability face.
 *
 * WHY LAYER B. The BL-18 suites (`a5sf-web.test.mjs`, 12 arms; `a5sf-web-row.test.mjs`,
 * 10 arms) answer the layer-A question — is the LANE around a `web_fetch` call
 * correct, and is the face forwarded/configured by the product row. They do NOT
 * pin the contract INSIDE an admitted call: the guard/provider ORDER, the exact
 * wording discipline of the deny refusal, the POSITION at which the two typed
 * residuals stop mediating, the fetch-vs-search lane question, or the
 * authoring-time ambiguity of the two face sources. Those are the increments
 * below (one property per block, ten arms).
 *
 * WHAT IS REAL HERE: the PRODUCT route `mountA5sfRealm` / `mountMemberA5sfRealm`,
 * the REAL pinned `@deepseek-ai/dsh-tool-web` module mounted through the realm's
 * own route-C seam, the REAL compiled lane from `compileEffectiveIo`, the REAL
 * `probeNetworkDenial` of the subprocess face, and the REAL `a5sf-realm-row.mjs`
 * glue. The only fake is the NETWORK BOUNDARY (a recorder): no socket, no DNS,
 * no proxy, no egress of any kind, and no test starts a Host.
 *
 * WHAT IS NOT CLAIMED: see `dev/agent-workflow/evidence/a5sf-web-face/README.md`
 * §5. An arm never concludes "the network was confined". On `deny` this face
 * REFUSES before the provider; on `allow` it CALLS THROUGH unmediated. That is
 * the whole of the suite's claim, and §5 reuses the subprocess face's network
 * claim discipline verbatim.
 *
 * Run: node --test tests/world-factory/a5sf-web-contract.test.mjs
 */
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, test } from 'node:test'

import { DECLARED_URL, drive, effectiveOf, mountToolWeb, refusalCode, textOf } from './lib/a5sf-web-arms.mjs'
import {
  CONTRACT_REPO,
  REDIRECT_TARGET,
  contractBoundary,
  contractHostState,
  contractSeams,
  makeContractWorld,
  makeRowWorld,
  writeContractFaceFactory,
} from './lib/a5sf-web-contract-world.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const HOST = contractHostState(REPO)

/**
 * HOST PRECONDITION — the same three states the FS/subprocess faces declare.
 * `absent`/`incomplete` is a machine-readable refusal, never a silent skip; a
 * lane that is SUPPOSED to provision the host sets `A5SF_REQUIRE_PINNED_HOST=1`
 * and gets a hard failure instead.
 */
if (!HOST.ok) {
  console.log(`A5SF-WEB-CONTRACT-HOST-REFUSED ${HOST.reason ?? 'unknown'}`)
  if (process.env.A5SF_REQUIRE_PINNED_HOST === '1') {
    throw new Error(`A5SF-WEB-CONTRACT-HOST-INCOMPLETE: ${HOST.reason ?? 'unknown'}`)
  }
}

const seams = HOST.ok ? await contractSeams(REPO) : undefined
const TEST_OPTIONS = HOST.ok ? {} : { skip: `A5SF-WEB-CONTRACT-HOST-REFUSED: ${HOST.reason}` }
const arm = (name, fn) => test(name, TEST_OPTIONS, fn)

/** Dispose every world this file built (one place, reverse order). */
const CLEANUP = []
after(async () => {
  for (const step of CLEANUP.splice(0).reverse()) {
    try {
      await step()
    } catch {
      // The arm's own failure is the one reported.
    }
  }
})

async function world(options) {
  const built = await makeContractWorld(seams, options)
  CLEANUP.push(() => built.realm?.dispose())
  return built
}

function tempDir(label) {
  const dir = mkdtempSync(join(tmpdir(), `a5sf-web-contract-${label}-`))
  CLEANUP.push(() => rmSync(dir, { recursive: true, force: true }))
  return dir
}

/** The mounted confined `web` surface the product reports for this realm. */
function mountedWeb(built) {
  return built.realm.installation.members[0].faces.web
}

// ===========================================================================
// P1 — the `allow` lane POSITION: guard, then provider, with the declared URL
// ===========================================================================

arm('P1-GUARD-BEFORE-PROVIDER: one guard evaluation, completed BEFORE the provider is entered, and the provider sees the declared URL', async () => {
  const built = await world({ network: 'allow' })
  await mountToolWeb(built)
  const result = await drive(built, 'web_fetch', { url: DECLARED_URL }, 'web-contract-p1')
  assert.equal(result.isError, false, `the allow lane must admit the call: ${textOf(result)}`)

  // ORDER, MEASURED AT THE EDGE. `factsAtEntry` is the number of guard facts that
  // existed at the instant the provider was entered: it is 1 only if the guard
  // COMPLETED first. A future re-ordering (provider first, guard after) makes it
  // 0 without changing any counter, which is why the position — not the counts —
  // is the assertion.
  assert.equal(built.boundary.fetches.length, 1, 'exactly one provider fetch')
  const entry = built.boundary.fetches[0]
  assert.equal(entry.factsAtEntry, 1, 'the guard fact exists BEFORE the provider is entered')
  assert.equal(built.facts.length, 1, 'exactly one guard evaluation for one fetch')
  assert.equal(built.facts[0].method, 'web:fetch')
  assert.equal(built.facts[0].decision, 'allow')

  // The provider sees the DECLARED string — the same value the guard was
  // consulted with. (`argCount` / request-shape purity belong to the P3 proxy
  // position; keeping them out of P1 keeps the two controls disjoint.)
  assert.equal(entry.url, DECLARED_URL)
  assert.equal(entry.url, built.facts[0].locator, 'the guard and the provider saw the SAME declared URL')
})

arm('P1-DECLARED-URL-UNMUTATED: no normalization or rewrite happens between the model argument and the provider request', async () => {
  // A URL whose string form a normalizer/parser WOULD change (dot segment, a
  // percent-encoded slash, a fragment). The product must pass the declared
  // string through untouched: the guard is consulted on it and the provider
  // receives it byte-for-byte.
  const declared = 'https://example.test/legal/./page%2Fsub?q=1#frag'
  const built = await world({ network: 'allow' })
  await mountToolWeb(built)
  const result = await drive(built, 'web_fetch', { url: declared }, 'web-contract-p1-unmutated')
  assert.equal(result.isError, false, `the allow lane must admit the call: ${textOf(result)}`)

  assert.equal(built.boundary.fetches.length, 1)
  assert.equal(built.boundary.fetches[0].url, declared, 'the provider received the DECLARED string, not a normalized one')
  assert.equal(built.facts.length, 1)
  assert.equal(built.facts[0].locator, declared, 'the guard was consulted on the declared string')
  assert.equal(built.boundary.transport[0], declared, 'the first transport hop is the declared string')
})

// ===========================================================================
// P2 — the `deny` lane: capability refusal, zero calls, no observation claim
// ===========================================================================

/**
 * THE WORDING DISCIPLINE, reused from the subprocess face (its §7): a refusal
 * that claims an OBSERVATION is a different, false statement — the OS was never
 * asked, no socket existed, and our own admission code is what refused. Each
 * pattern below would make this arm FAIL if it appeared in the refusal.
 */
const OBSERVATION_CLAIMS = Object.freeze([
  /observed (?:zero|no) connections?/i,
  /observes? (?:zero|no)/i,
  /no traffic/i,
  /zero (?:connections?|sockets?|traffic)/i,
  /syscalls? (?:recorded|observed|denied)/i,
  /measured (?:zero|no) /i,
  /did not connect/i,
  /no (?:network|egress) (?:activity|traffic)/i,
  /network was (?:blocked|isolated|denied)/i,
  /seccomp|netns|iptables/i,
])

/**
 * A capability refusal NAMES THE CAPABILITY: the dimension, the level the
 * backend reported, and the fact that this is a probe answer rather than a
 * measurement. It also must not claim the OS was asked to deny anything.
 */
function assertCapabilityRefusal(message) {
  for (const pattern of OBSERVATION_CLAIMS) {
    assert.doesNotMatch(message, pattern, `a refusal must not claim an observation (${String(pattern)})`)
  }
  assert.match(message, /capability probe/i, 'the refusal names the probe as its source')
  assert.match(message, /network-destination/, 'the refusal names the capability dimension')
  assert.match(message, /unsupported/, 'the refusal reports the level the backend answered')
  assert.match(message, /refusing before any provider call/i, 'the refusal states its POSITION, not an observation')
}

arm('P2-DENY-CAPABILITY-REFUSAL: deny refuses with NETWORK_UNCONFINED_REALM, zero provider calls, and a refusal that names the capability — never an observation', async () => {
  const built = await world({ network: 'deny' })
  await mountToolWeb(built)
  const result = await drive(built, 'web_fetch', { url: DECLARED_URL }, 'web-contract-p2-fetch')
  assert.equal(result.isError, true, 'the deny lane must refuse the call')

  // ZERO EFFECTS: the boundary is the only place a request could exist.
  assert.equal(built.boundary.fetches.length, 0, 'zero provider fetches')
  assert.equal(built.boundary.searches.length, 0, 'zero provider searches')
  assert.equal(built.boundary.transport.length, 0, 'zero transport hops')
  assert.equal(built.boundary.dnsLookups, 0, 'zero DNS lookups')
  assert.equal(built.boundary.connects, 0, 'zero connects')
  assert.equal(built.boundary.proxyLookups, 0, 'zero proxy lookups')

  // ONE fact, the closed code, and the capability wording.
  assert.equal(built.facts.length, 1, 'exactly one web guard fact')
  assert.equal(built.facts[0].decision, 'deny')
  assert.equal(built.facts[0].decidedBy, 'NETWORK_UNCONFINED_REALM')
  assert.equal(built.facts[0].annotations, undefined, 'a deny fact carries no admitted-call residual')

  const message = textOf(result)
  assertCapabilityRefusal(message)
  // The precise negative control: a refusal that DID claim a measurement would
  // pass the loop above only if the pattern set were wrong, so the same helper
  // is asserted to reject a specimen here. A message change is therefore a test
  // change, which is the point.
  assert.throws(
    () => assertCapabilityRefusal('capability probe: network-destination unsupported; observed zero connections'),
    /must not claim an observation/,
    'the discipline is LIVE: an observation-claiming refusal fails this same helper',
  )
})

arm('P2-DENY-SEARCH-ALSO-CAPABILITY: the sibling web_search path refuses with the same code, zero provider calls, and the same wording discipline', async () => {
  const built = await world({ network: 'deny' })
  await mountToolWeb(built)
  const result = await drive(built, 'web_search', { queries: ['web contract deny'] }, 'web-contract-p2-search')
  assert.equal(result.isError, true, 'web_search must not be a way around the deny lane')

  assert.equal(built.boundary.searches.length, 0, 'zero provider searches')
  assert.equal(built.boundary.fetches.length, 0)
  assert.equal(built.boundary.transport.length, 0, 'no search transport hop exists')
  assert.equal(built.facts.length, 1)
  assert.equal(built.facts[0].method, 'web:search')
  assert.equal(built.facts[0].decidedBy, 'NETWORK_UNCONFINED_REALM')
  assertCapabilityRefusal(textOf(result))
})

// ===========================================================================
// P3 — the two named residuals as POSITIONS (where mediation stops)
// ===========================================================================

arm('P3-REDIRECT-POSITION: a redirect followed INSIDE the provider returns its final location to the caller with the guard never re-evaluating the new location', async () => {
  const built = await world({ network: 'allow', redirectTo: REDIRECT_TARGET })
  const declared = 'https://example.test/legal/redirecting-page'
  const response = await mountedWeb(built).fetch({ url: declared })

  // The provider took TWO transport hops (initial + redirect target) inside ONE
  // provider call.
  assert.deepEqual(built.boundary.transport, [declared, REDIRECT_TARGET], 'the hop happened inside the provider')
  assert.equal(built.boundary.fetches.length, 1, 'one provider call, not two')

  // THE POSITION: exactly ONE guard evaluation, on the DECLARED url. The hop
  // target never enters the guard. A future fix that re-evaluates the location
  // adds a second fact (or changes the consulted value) and reds this arm.
  assert.equal(built.facts.length, 1, 'the redirect target is NOT re-guarded')
  assert.equal(built.facts[0].locator, declared, 'the only mediated value is the declared URL')
  for (const fact of built.facts) {
    assert.ok(!String(fact.locator).includes('cdn.example.test'), 'no guard fact names the redirect target')
  }

  // The caller receives the provider's FINAL answer verbatim: mediation stops at
  // the declared URL, and the followed location is the provider's own effect.
  assert.equal(response, built.boundary.lastResponse, 'the provider response is returned unchanged (identity)')
  assert.equal(response.url, REDIRECT_TARGET, 'the caller observes the redirect target the guard never saw')

  // The residual rides the SAME single fact, so the disclosure and the position
  // are one statement.
  assert.deepEqual(built.facts[0].annotations, [
    'WEB_REDIRECT_UNMEDIATED_ON_ALLOW',
    'WEB_PROXY_ENV_UNMEDIATED_ON_ALLOW',
  ])
})

arm('P3-PROXY-POSITION: the provider inherits the ambient proxy environment unmodified and the face resolves no proxy of its own', async () => {
  const PROXY = 'http://proxy.sentinel.invalid:3128'
  const saved = { HTTP_PROXY: process.env.HTTP_PROXY, HTTPS_PROXY: process.env.HTTPS_PROXY, NO_PROXY: process.env.NO_PROXY }
  process.env.HTTP_PROXY = PROXY
  process.env.HTTPS_PROXY = PROXY
  delete process.env.NO_PROXY
  CLEANUP.push(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
  })

  const built = await world({ network: 'allow' })
  const declared = 'https://example.test/legal/proxied-page'
  const request = { url: declared }
  const before = JSON.stringify(request)
  await mountedWeb(built).fetch(request)

  const entry = built.boundary.fetches[0]
  // THE POSITION: the provider — not the face — is where the proxy policy
  // lives. The face neither scrubs nor overrides nor resolves it, so the
  // provider sees the process-wide environment exactly as it was.
  assert.equal(entry.httpProxy, PROXY, 'the provider inherits HTTP_PROXY unmodified (no scrub, no veto)')
  assert.equal(entry.httpsProxy, PROXY, 'the provider inherits HTTPS_PROXY unmodified')
  assert.equal(entry.noProxy, null, 'the face did not inject a NO_PROXY of its own')
  assert.equal(entry.argCount, 2, 'no dispatcher/proxy argument is handed to the provider')
  assert.deepEqual(entry.keys, ['url'], 'the provider receives the declared request shape, nothing appended')
  assert.equal(JSON.stringify(request), before, 'the face did not mutate the request to steer a proxy')
  assert.equal(built.boundary.proxyLookups, 1, 'the ONE proxy resolution belongs to the provider, not to the face')
  assert.equal(built.facts.length, 1, 'one guard evaluation — the face performs no proxy decision')
  assert.deepEqual(built.facts[0].annotations, [
    'WEB_REDIRECT_UNMEDIATED_ON_ALLOW',
    'WEB_PROXY_ENV_UNMEDIATED_ON_ALLOW',
  ])
})

// ===========================================================================
// P4 — fetch vs search: one lane, one guard instance, both call paths
// ===========================================================================

arm('P4-NO-PER-METHOD-LANE: the compiled network axis is a single closed binary, so "allow fetch / deny search" is NOT expressible', async () => {
  const compiled = seams.compileEffectiveIo(
    {
      memberIdentity: 'member-bl18-web',
      templateId: 'worker',
      instanceGeneration: 2,
      revision: 'rev-web-contract',
      read: { mode: 'restricted', allow: ['/tmp'], ask: [], deny: [] },
      write: { mode: 'restricted', allow: ['/tmp'], ask: [], deny: [] },
      network: { access: 'allow' },
    },
    { bindingIdentity: 'team/web', read: { mode: 'restricted', allow: ['/tmp'], ask: [], deny: [] }, write: { mode: 'restricted', allow: ['/tmp'], ask: [], deny: [] }, network: 'allow' },
    {
      memberIdentity: 'member-bl18-web',
      callId: 'call-web-contract-p4',
      policyRevision: 'rev-web-contract',
      toolBindingIdentity: 'team/web',
      approvedOnce: false,
    },
  )
  assert.equal(compiled.ok, true)
  const effective = compiled.value

  // ONE axis, ONE value, frozen: the face reads `effective.network.access` for
  // BOTH `web:fetch` and `web:search`. There is no per-method field anywhere in
  // the compiled policy, so a lane that admits fetch and refuses search cannot
  // be written — not "is not tested", NOT EXPRESSIBLE.
  assert.equal(Object.isFrozen(effective.network), true)
  assert.deepEqual(Object.keys(effective.network), ['access'], 'the network axis has exactly one field')
  assert.ok(['allow', 'deny'].includes(effective.network.access), 'the axis domain is the closed binary allow|deny')

  // The domain is CLOSED by construction, not merely by the type: an
  // out-of-domain lane value (here `ask`, the only disposition that could admit
  // a per-call difference) CANNOT survive the intersection — the effective axis
  // is computed as a conjunction of two `=== 'allow'` tests, so an unrecognized
  // disposition degenerates to the conservative `deny`, never to an allow.
  const ask = seams.compileEffectiveIo(
    {
      memberIdentity: 'member-bl18-web',
      templateId: 'worker',
      instanceGeneration: 2,
      revision: 'rev-web-contract',
      read: { mode: 'restricted', allow: ['/tmp'], ask: [], deny: [] },
      write: { mode: 'restricted', allow: ['/tmp'], ask: [], deny: [] },
      network: { access: 'ask' },
    },
    { bindingIdentity: 'team/web', read: { mode: 'restricted', allow: ['/tmp'], ask: [], deny: [] }, write: { mode: 'restricted', allow: ['/tmp'], ask: [], deny: [] }, network: 'ask' },
    {
      memberIdentity: 'member-bl18-web',
      callId: 'call-web-contract-p4-ask',
      policyRevision: 'rev-web-contract',
      toolBindingIdentity: 'team/web',
      approvedOnce: false,
    },
  )
  assert.equal(ask.ok, true, 'the compiler still answers a total policy for an out-of-domain input')
  assert.equal(ask.value.network.access, 'deny', 'an out-of-domain lane degenerates to deny — it can never become an allow')
  assert.deepEqual(Object.keys(ask.value.network), ['access'], 'the compiled effective axis stays the single closed field')

  // ONE face per Member realm, on ONE isolated scope: the binding realm mounts
  // `fs` only (`install.ts` isolates `fs` for a binding), so a second,
  // differently-laned web face per tool binding does not exist either.
  const built = await world({ network: 'allow' })
  const surfaces = [mountedWeb(built)]
  assert.equal(surfaces.length, 1)
  assert.equal(typeof surfaces[0].fetch, 'function')
  assert.equal(typeof surfaces[0].search, 'function')
})

arm('P4-SHARED-GUARD-BOTH-PATHS: fetch and search consult the SAME guard instance (one sequence counter) and record their own method', async () => {
  const built = await world({ network: 'allow' })
  await mountToolWeb(built)
  const fetchResult = await drive(built, 'web_fetch', { url: DECLARED_URL }, 'web-contract-p4-fetch')
  const searchResult = await drive(built, 'web_search', { queries: ['web contract search'] }, 'web-contract-p4-search')
  assert.equal(fetchResult.isError, false, `the allow lane admits fetch: ${textOf(fetchResult)}`)
  assert.equal(searchResult.isError, false, `the allow lane admits search: ${textOf(searchResult)}`)

  assert.equal(built.boundary.fetches.length, 1)
  assert.equal(built.boundary.searches.length, 1)

  // ONE guard instance serves both paths: `sequence` is the observed wrapper's
  // per-guard counter, so it is monotone 1→2 across the two methods. Two
  // separate guards would each start at 1.
  assert.deepEqual(built.facts.map((fact) => fact.method), ['web:fetch', 'web:search'])
  assert.deepEqual(built.facts.map((fact) => fact.sequence), [1, 2], 'one guard instance, two consultations')
  assert.deepEqual(built.facts.map((fact) => fact.decidedBy), ['ALLOW', 'ALLOW'], 'the SAME lane decided both')
  assert.equal(new Set(built.facts.map((fact) => fact.policyRevision)).size, 1, 'both paths report the same compiled policy revision')

  // The search request shape the REAL pinned module sends is `{ query,
  // maxResults }` — and the recorded locator is the face's stable marker for a
  // request it does not recognize, NOT the query text. That is the honest
  // current position (and `GAP-WEB-CONTRACT-1` in the face README: the
  // `queries:N` branch in `declaredUrlOf` is unreachable for this shape).
  assert.deepEqual(built.boundary.searches[0].keys, ['query', 'maxResults'], 'the provider received the pinned module\'s request shape')
  assert.equal(built.facts[1].locator, '<search:malformed-request>', 'the search locator is a marker, never the query text')
  assert.ok(!String(built.facts[1].locator).includes('web contract search'), 'the query text is not leaked into the fact stream')
})

// ===========================================================================
// P5 — `a5sfWebFace` composition: fail-closed at authoring time
// ===========================================================================

arm('P5-AMBIGUOUS-FAIL-CLOSED: the compiled `web` AND `a5sfWebFace` refuse at AUTHORING time with REALM_DECLARATION_INVALID naming both sources, before any request', async () => {
  const dir = tempDir('ambiguous')
  const sink = join(dir, 'consult.jsonl')
  const factory = writeContractFaceFactory('ambiguous')
  CLEANUP.push(() => rmSync(factory.dir, { recursive: true, force: true }))
  const boundary = contractBoundary()
  const built = await makeRowWorld(seams, {
    network: 'allow',
    compiledWeb: {},
    configWebFace: { url: factory.url, config: { effective: effectiveOf(seams, { network: 'allow' }), provider: boundary } },
    evidencePath: sink,
    boundary,
  })

  assert.notEqual(built.error, undefined, 'both web-face sources for one realm must refuse')
  assert.equal(refusalCode(built.error), 'REALM_DECLARATION_INVALID')
  assert.equal(built.realm, undefined, 'no realm is mounted from an ambiguous declaration')

  // BOTH SOURCES NAMED: the actor must be able to see which two things forked.
  const message = String(built.error.message)
  assert.match(message, /compiled realm answer carries a `web` face/, 'the compiled source is named')
  assert.match(message, /a5sfWebFace/, 'the config source is named')
  assert.match(message, /exactly one/, 'the resolution is stated')
  assert.equal(built.error.reveal ?? built.error.detail, 'a5sfWebFace', 'the refusal is attributed to the config key')

  // AUTHORING TIME, NOT REQUEST TIME: no provider call, no guard consultation,
  // and the evidence sink was never even created. A refusal that happened on
  // the first request would already have a lead-in path.
  assert.equal(boundary.fetches.length, 0, 'zero provider calls')
  assert.equal(boundary.searches.length, 0)
  assert.equal(boundary.state.dnsLookups + boundary.state.connects + boundary.state.proxyLookups, 0)
  assert.equal(existsSync(sink), false, 'the guard-fact sink was never created: nothing was consulted')
  assert.equal(built.HostWeb.calls, 0, 'the inherited host web service was never consulted either')
})

arm('P5-EXACTLY-ONE-SOURCE: each source ALONE mounts a working confined face (compiled-only and config-only), and the denial still holds', async () => {
  // (a) compiled-only — the pre-existing path, still works.
  const compiledBoundary = contractBoundary()
  const compiledSink = join(tempDir('compiled-only'), 'consult.jsonl')
  const fromCompiled = await makeRowWorld(seams, {
    network: 'deny',
    compiledWeb: {},
    evidencePath: compiledSink,
    boundary: compiledBoundary,
  })
  CLEANUP.push(() => fromCompiled.realm?.dispose())
  assert.equal(fromCompiled.error, undefined, `compiled-only must mount: ${String(fromCompiled.error?.message ?? '')}`)
  const compiledFace = fromCompiled.realm.installation.members[0].faces.web
  assert.notEqual(compiledFace, null, 'the compiled source supplied the face')
  await assert.rejects(async () => compiledFace.fetch({ url: DECLARED_URL }), (error) => {
    assert.equal(refusalCode(error), 'NETWORK_UNCONFINED_REALM')
    return true
  })

  // (b) config-only — the `a5sfWebFace` factory path, same shape, same outcome.
  const configBoundary = contractBoundary()
  const configSink = join(tempDir('config-only'), 'consult.jsonl')
  const factory = writeContractFaceFactory('single')
  CLEANUP.push(() => rmSync(factory.dir, { recursive: true, force: true }))
  const fromConfig = await makeRowWorld(seams, {
    network: 'deny',
    configWebFace: {
      url: factory.url,
      config: { effective: effectiveOf(seams, { network: 'deny' }), provider: configBoundary },
    },
    evidencePath: configSink,
    boundary: configBoundary,
  })
  CLEANUP.push(() => fromConfig.realm?.dispose())
  assert.equal(fromConfig.error, undefined, `config-only must mount: ${String(fromConfig.error?.message ?? '')}`)
  const configFace = fromConfig.realm.installation.members[0].faces.web
  assert.notEqual(configFace, null, 'the config source supplied the face')
  await assert.rejects(async () => configFace.fetch({ url: DECLARED_URL }), (error) => {
    assert.equal(refusalCode(error), 'NETWORK_UNCONFINED_REALM')
    return true
  })

  // The config-only face must be the CONFINED one the row mounted, not a
  // fallback: the inherited host tripwire is untouched on both paths.
  assert.equal(fromCompiled.HostWeb.calls, 0)
  assert.equal(fromConfig.HostWeb.calls, 0)
})
