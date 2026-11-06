/**
 * a5sf-web.test.mjs — BL-18 (P2-05) BACKEND arms: the confined `web` face's
 * network admission for the native `web_fetch` row.
 *
 * WHAT THIS PROVES (host-free). A governed Member's native `web_fetch` executes
 * through the confined `web` face mounted on its isolated scope:
 *
 *   - `network: allow` — the call reaches EXACTLY ONE provider call with the
 *     declared URL and the provider's bytes reach the model face; the ALLOW
 *     fact carries the typed redirect/proxy residual;
 *   - `network: deny` — the call is REFUSED BEFORE the provider is entered
 *     (`0` fetches, `0` DNS lookups, `0` connects, `0` proxy lookups), with the
 *     closed `NETWORK_UNCONFINED_REALM` code on the SAME guard-fact transport;
 *   - the sibling `web_search` is the SECOND call path on the same face and is
 *     refused identically;
 *   - a realm that mounts NO confined web face refuses the real pinned
 *     `tool-web` module at composition time, so the module can never resolve
 *     the inherited host `ctx.web`;
 *   - a non-governed host (no Alpha.5 realm) keeps fetching exactly as today.
 *
 * WHAT THIS DOES NOT PROVE (needs a Host boot, not authorised this round): real
 * egress, real DNS, a redirect chain against a live server, proxy-env behaviour,
 * and the model actually seeing the tool in a booted world. See
 * `dev/agent-workflow/evidence/a5sf-web/README.md` §8 for the one-shot
 * acceptance checklist of that half.
 *
 * Run: node --test tests/world-factory/a5sf-web.test.mjs
 */
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { after, test } from 'node:test'

import {
  DECLARED_URL,
  WEB_IDENTITY,
  drive,
  driveOrdinary,
  effectiveOf,
  fakeWebBoundary,
  loadWebSeams,
  makeFace,
  makeGovernedRealm,
  makeOrdinaryHost,
  mountToolWeb,
  refusalCode,
  textOf,
} from './lib/a5sf-web-arms.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..')
const seams = await loadWebSeams(REPO)

/** Every governed world built by an arm is disposed here (one place). */
const worlds = []
after(async () => {
  for (const world of worlds.splice(0).reverse()) {
    try {
      await world.realm?.dispose()
    } catch {
      // The arm's own failure is the one reported.
    }
  }
})

async function governed(options) {
  const world = await makeGovernedRealm(seams, options)
  worlds.push(world)
  return world
}

// ---------------------------------------------------------------------------
// 1. The ALLOW path — one provider call, with the declared URL, observable
// ---------------------------------------------------------------------------

test('ADMIT-ALLOW: a governed Member with network allow reaches EXACTLY ONE provider fetch with the declared URL', async () => {
  const world = await governed({ network: 'allow' })
  await mountToolWeb(world)
  const result = await drive(world, 'web_fetch', { url: DECLARED_URL })
  assert.equal(result.isError, false, `the admitted call must succeed: ${textOf(result)}`)

  // THE EFFECT WITNESS: the provider was entered exactly once, with this URL,
  // and its bytes reached the model-facing result.
  assert.equal(world.boundary.fetches.length, 1, 'exactly one provider fetch')
  assert.equal(world.boundary.fetches[0].url, DECLARED_URL, 'the declared URL is what the provider saw')
  assert.equal(world.boundary.dnsLookups, 1, 'the allow path performs the boundary lookup (the fake transport counts it)')
  assert.equal(world.boundary.connects, 1)
  assert.match(textOf(result), /BL18-MOCK-BODY/, 'the provider body is delivered to the model face')

  // ONE fact on the SAME transport the fs/subprocess faces use, on the method
  // that names the consulted call, carrying the typed residual of an admitted
  // network effect.
  const facts = world.facts.filter((fact) => fact.method.startsWith('web:'))
  assert.equal(facts.length, 1, 'exactly one web guard fact')
  assert.equal(facts[0].method, 'web:fetch')
  assert.equal(facts[0].decision, 'allow')
  assert.equal(facts[0].decidedBy, 'ALLOW')
  assert.equal(facts[0].locator, DECLARED_URL)
  assert.deepEqual(facts[0].annotations, [
    'WEB_REDIRECT_UNMEDIATED_ON_ALLOW',
    'WEB_PROXY_ENV_UNMEDIATED_ON_ALLOW',
  ], 'the admitted call discloses the dimensions this face does not mediate')
})

test('SHADOW: the allow path resolves the CONFINED face, never the inherited host ctx.web (tripwire)', async () => {
  const world = await governed({ network: 'allow' })
  await mountToolWeb(world)
  const result = await drive(world, 'web_fetch', { url: DECLARED_URL })
  assert.equal(result.isError, false)
  assert.equal(world.HostWeb.calls, 0, 'the inherited host web service was never consulted')
  assert.equal(world.boundary.fetches.length, 1, 'the confined provider served the call')
})

// ---------------------------------------------------------------------------
// 2. The DENY path — refused BEFORE any connection attempt
// ---------------------------------------------------------------------------

test('DENY-PRE-REFUSAL: network deny refuses web_fetch before the provider: 0 fetch, 0 DNS, 0 connect, 0 proxy, one typed fact', async () => {
  const world = await governed({ network: 'deny' })
  await mountToolWeb(world)
  const result = await drive(world, 'web_fetch', { url: DECLARED_URL })
  assert.equal(result.isError, true, 'the deny lane must refuse the call')

  // POSITION, MEASURED: the fake boundary is the only place a socket/DNS/proxy
  // step could happen, and every one of its counters is zero.
  assert.equal(world.boundary.fetches.length, 0, 'zero provider fetches')
  assert.equal(world.boundary.dnsLookups, 0, 'zero DNS lookups')
  assert.equal(world.boundary.connects, 0, 'zero connects')
  assert.equal(world.boundary.proxyLookups, 0, 'zero proxy route resolutions')
  assert.equal(world.boundary.probeCalls, 1, "the backend's OWN probe was asked once (not assumed)")

  // ONE guard fact, on the same schema, carrying the closed code.
  const facts = world.facts.filter((fact) => fact.method.startsWith('web:'))
  assert.equal(facts.length, 1, 'exactly one web guard fact')
  assert.equal(facts[0].method, 'web:fetch')
  assert.equal(facts[0].decision, 'deny')
  assert.equal(facts[0].decidedBy, 'NETWORK_UNCONFINED_REALM')
  assert.equal(facts[0].locator, DECLARED_URL)
  assert.equal(facts[0].annotations, undefined, 'a deny fact never claims an admitted-call residual')
  assert.match(textOf(result), /NETWORK_UNCONFINED_REALM|network=deny/, 'the refusal is model-visible and names the lane')
})

test('DENY-TYPED-CODE: the confined face throws the typed NETWORK_UNCONFINED_REALM (not a message convention)', async () => {
  const effective = effectiveOf(seams, { network: 'deny' })
  const boundary = fakeWebBoundary()
  const { face, facts } = makeFace(seams, { effective, boundary })
  let error = null
  try {
    await face.fetch({ url: DECLARED_URL })
  } catch (caught) {
    error = caught
  }
  assert.equal(refusalCode(error), 'NETWORK_UNCONFINED_REALM')
  assert.equal(error.memberIdentity, WEB_IDENTITY.memberInstanceId)
  assert.equal(error.method, 'web:fetch')
  assert.equal(error.target, DECLARED_URL)
  assert.equal(boundary.fetches.length, 0)
  assert.equal(boundary.dnsLookups, 0)
  assert.equal(facts.length, 1)
  assert.equal(facts[0].decidedBy, 'NETWORK_UNCONFINED_REALM')
})

test('DENY-SEARCH-SECOND-PATH: the sibling web_search on the same face is refused too (no second call path)', async () => {
  const world = await governed({ network: 'deny' })
  await mountToolWeb(world)
  const fetchResult = await drive(world, 'web_fetch', { url: DECLARED_URL })
  assert.equal(fetchResult.isError, true)
  const searchResult = await drive(world, 'web_search', { queries: ['bl18'] })
  assert.equal(searchResult.isError, true, 'web_search must not be a way around the deny lane')

  assert.equal(world.boundary.searches.length, 0, 'zero provider searches')
  assert.equal(world.boundary.fetches.length, 0)
  assert.equal(world.boundary.dnsLookups, 0, 'still zero DNS across both call paths')
  assert.equal(world.boundary.connects, 0)

  const facts = world.facts.filter((fact) => fact.method.startsWith('web:'))
  assert.deepEqual(facts.map((fact) => fact.method), ['web:fetch', 'web:search'])
  for (const fact of facts) assert.equal(fact.decidedBy, 'NETWORK_UNCONFINED_REALM')
})

test('DENY-PROBE-ABSENT: a backend with NO probe answers unsupported (closed), never a default allow', async () => {
  const world = await governed({ network: 'deny', probeLevel: 'absent' })
  await mountToolWeb(world)
  const result = await drive(world, 'web_fetch', { url: DECLARED_URL })
  assert.equal(result.isError, true)
  assert.equal(world.boundary.fetches.length, 0)
  const facts = world.facts.filter((fact) => fact.method === 'web:fetch')
  assert.equal(facts.length, 1)
  assert.equal(facts[0].decidedBy, 'NETWORK_UNCONFINED_REALM')
  assert.match(textOf(result), /capability probe/i)
})

test('PROBE-LOAD-BEARING: the refusal is the probe\'s ANSWER plus THIS face\'s proof — an `enforced` row with a web-face proof is admitted', async () => {
  // BL-17's law, narrowed by PD-15: `deny` is admitted only on an explicit
  // `enforced` row AND a face-bound proof minted for the face asking. No backend
  // in this tree reports either, which is why the product path above always
  // refuses; this arm proves the probe result (not a hardcoded string) decides,
  // and that a subprocess-face proof would NOT be accepted here (the dedicated
  // PD-15 arms pin that).
  const world = await governed({
    network: 'deny',
    probeLevel: 'enforced',
    networkProof: {
      face: 'web',
      mechanism: 'service-level web transport (in-process; no OS boundary)',
      evidence: 'evidence://fake/pd15-web-face',
      netNsInode: null,
      hostNetNsInode: null,
    },
  })
  await mountToolWeb(world)
  const result = await drive(world, 'web_fetch', { url: DECLARED_URL })
  assert.equal(result.isError, false, `an enforced backend with THIS face's proof admits the call: ${textOf(result)}`)
  assert.equal(world.boundary.probeCalls, 1, 'the probe was consulted')
  assert.equal(world.boundary.fetches.length, 1)
  const facts = world.facts.filter((fact) => fact.method === 'web:fetch')
  assert.equal(facts[0].decision, 'allow')
})

// ---------------------------------------------------------------------------
// 3. The composition boundary — a web consumer on a realm with no web face
// ---------------------------------------------------------------------------

test('UNCONFINED-REALM-MOUNT: the REAL tool-web module is refused on a realm that owns no confined web face', async () => {
  const world = await governed({ network: 'allow', withWebFace: false })
  let error = null
  try {
    await mountToolWeb(world)
  } catch (caught) {
    error = caught
  }
  assert.equal(refusalCode(error), seams.A5SF_NETWORK_UNCONFINED_REALM, 'typed composition-time refusal')
  assert.match(String(error?.detail ?? error?.message), /injects `web`/u)
  assert.match(String(error?.detail ?? error?.message), /inherited/u)
  // Before any tool definition exists: the name is not registered, the host
  // web service is never consulted, and no provider call happens.
  assert.equal(world.HostWeb.calls, 0)
  const result = await drive(world, 'web_fetch', { url: DECLARED_URL })
  assert.equal(result.isError, true, 'no web_fetch definition exists to run')
  assert.equal(world.boundary.fetches.length, 0)
})

test('PROBE-REUSE: the web face calls BL-17\'s probeNetworkDenial — it does not own a second probe', () => {
  // A REGRESSION SENTINEL (the BL-17 "source fragment" pattern), not an
  // architecture law: two probes that can disagree is the dual-authority
  // defect this vertical keeps finding, so the import is pinned by source.
  const source = readFileSync(join(REPO, 'packages/runtime/team-services/src/web.ts'), 'utf8')
  assert.match(source, /import \{[^}]*probeNetworkDenial[^}]*\} from '\.\/subprocess\.js'/u, 'the ONE probe is imported from subprocess.ts')
  assert.doesNotMatch(source, /function\s+probeNetworkDenial/u, 'web.ts defines no probe of its own')
  assert.doesNotMatch(source, /\.probe\s*\(/u, 'web.ts never calls a probe directly (it goes through probeNetworkDenial)')
})

// ---------------------------------------------------------------------------
// 4. Ordinary DSH fetch — a non-governed host is unaffected
// ---------------------------------------------------------------------------

test('ORDINARY-DSH-FETCH: with NO Alpha.5 realm the host web_fetch fetches exactly as today', async () => {
  const world = await makeOrdinaryHost(seams)
  try {
    const result = await driveOrdinary(world, 'web_fetch', { url: DECLARED_URL })
    assert.equal(result.isError, false, `the ordinary host fetch must work: ${textOf(result)}`)
    assert.equal(world.boundary.fetches.length, 1, 'exactly one provider fetch on the ordinary path')
    assert.equal(world.boundary.fetches[0].url, DECLARED_URL)
    assert.match(textOf(result), /BL18-ORDINARY-BODY/)
    // No Alpha.5 guard fact can exist on this path: there is no realm and no
    // confined face. The ordinary path is byte-for-byte the shipped one.
    assert.equal(world.root.get('web')?.constructor?.name, 'WebRuntime')
  } finally {
    world.disposeProvider()
  }
})

test('UNCHANGED-SHAPE: a network-allow realm returns BYTE-IDENTICAL model text to the ordinary host path', async () => {
  // "普通 DSH fetch 不受影响" is asserted on two REAL composition paths with the
  // same provider bytes: the ungoverned host (no realm) and the governed
  // network-allow realm. Same URL, same body, same model-facing text — the
  // governed face adds an admission fact, not a different fetch.
  const ordinary = await makeOrdinaryHost(seams, { body: 'BL18-SAME-BODY' })
  const governedWorld = await governed({ network: 'allow', body: 'BL18-SAME-BODY' })
  try {
    await mountToolWeb(governedWorld)
    const ordinaryResult = await driveOrdinary(ordinary, 'web_fetch', { url: DECLARED_URL })
    const governedResult = await drive(governedWorld, 'web_fetch', { url: DECLARED_URL })
    assert.equal(ordinaryResult.isError, false)
    assert.equal(governedResult.isError, false)
    assert.equal(textOf(governedResult), textOf(ordinaryResult), 'the governed face changes admission, not the fetch result')
    assert.equal(ordinary.boundary.fetches.length, 1)
    assert.equal(governedWorld.boundary.fetches.length, 1)
  } finally {
    ordinary.disposeProvider()
  }
})

test('COMPOSITION: the web provider is a composition input, never a Member field', () => {
  const effective = effectiveOf(seams, { network: 'allow' })
  assert.equal('web' in effective, false, 'the effective lane carries no web face')
  assert.equal('provider' in effective, false, 'the effective lane carries no provider')
  assert.equal('network' in effective, true)
  assert.equal(effective.network.access, 'allow')
  // A face cannot be built without a composition-supplied provider (fail closed).
  assert.throws(() => seams.services.createConfinedWebClass(class {}, { effective, provider: undefined }), /provider/iu)
})
