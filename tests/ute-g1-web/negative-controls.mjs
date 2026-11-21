/**
 * negative-controls.mjs — one REAL control per census member, each paired with a
 * `-POSITIVE` arm that re-runs the UNMODIFIED composition and must reproduce its
 * golden row. A control that cannot go RED is not a control, and a control whose
 * positive arm does not reproduce is not evidence.
 *
 * The controls, and exactly what each turns red:
 *
 *   NC-MEMBER web_fetch        WIDEN the declared admission (declare 127.0.0.2 as
 *                              a fixture origin): the out-of-lane refusal must
 *                              DISAPPEAR and the fixture must serve the request.
 *                              Turns red if the refusal was not the declared
 *                              authority's decision.
 *   NC-MEMBER web_search       WIDEN the declared composition capability (make the
 *                              search provider available): the availability
 *                              refusal must DISAPPEAR. Turns red if the refusal
 *                              came from anywhere but the provider's own answer.
 *   NC-MEMBER-POSITIVE web_fetch   re-run WB-F1/WB-F11 unmodified → equal to golden.
 *   NC-MEMBER-POSITIVE web_search  re-run WB-S1/WB-S3 unmodified → equal to golden.
 *   NC-GOLDEN-MUTATION         flip one golden cell (status 200→201) and one
 *                              request cell → the comparator MUST report the diff.
 *                              Turns red if grading is vacuous.
 *   NC-CATEGORY-TOTAL          an invented code, the `unknown` bucket and the
 *                              residual `other` must all be refused; a mapped
 *                              code must classify. Turns red if the map defaults.
 *   NC-SHADOW-LOAD-BEARING     remove the route-C web shadow → the call reaches
 *                              the inherited host `web` tripwire (BL18_TRIPWIRE).
 *                              Turns red if the shadow is decorative.
 *   NC-NET-SHIM-LOAD-BEARING   remove the socket witness → the world REFUSES to
 *                              report a clean zero (NET_WITNESS_MISSING).
 *                              Turns red if "no egress" can be claimed unmeasured.
 *   NC-NET-COUNTER-POSITIVE    drive one non-loopback connect through the patched
 *                              prototype: the external counter MUST move, the real
 *                              connect MUST NOT run. Turns red if the zero in the
 *                              golden run is a constant.
 *   NC-CONCURRENT-NORMALIZATION the one concurrent vector's request witness MUST
 *                              declare itself `sorted`. Turns red if a
 *                              nondeterministic order were silently digested.
 *
 * Run: node tests/ute-g1-web/negative-controls.mjs
 *
 * @module tests/ute-g1-web/negative-controls
 */
import net from 'node:net'
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { CORPUS } from './lib/corpus.mjs'
import { checkDesignClaim, compareRecord, parseGolden } from './lib/compare.mjs'
import {
  assertVocabularyTotal,
  classifyWebRefusal,
  REFUSAL_CATEGORIES,
  RESIDUAL_CLASS,
  UNKNOWN_CATEGORY,
  VOCABULARY_INCOMPLETE,
} from './lib/effect-oracle.mjs'
import { classifyConnectTarget } from './lib/net-witness.mjs'
import { captureVector } from './lib/old-path.mjs'

const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..')
const GOLDEN = join(REPO_ROOT, 'tests', 'ute-g1-web', 'golden', 'old-path.tsv')
const golden = parseGolden(readFileSync(GOLDEN, 'utf8'))
const goldenById = new Map(golden.map((record) => [record.id, record]))

let controls = 0
let failed = 0

/** Report one control; `ok === false` fails the run. */
function verdict(name, ok, detail) {
  controls += 1
  if (!ok) {
    failed += 1
    console.error(`NC-FAIL ${name} ${detail}`)
    return
  }
  console.log(`NC-PASS ${name} ${detail}`)
}

/** Does a record match its golden row? */
function reproduces(record) {
  const expected = goldenById.get(record.id)
  if (expected === undefined) return { ok: false, detail: `no golden row for ${record.id}` }
  const comparison = compareRecord(expected, record)
  if (comparison.ok) return { ok: true, detail: `${record.id} reproduces its golden row` }
  return { ok: false, detail: `${record.id} differs: ${comparison.diffs.map((diff) => `${diff.field}: golden=${JSON.stringify(diff.expected)} observed=${JSON.stringify(diff.observed)}`).join('; ')}` }
}

const vectorOf = (id) => {
  const vector = CORPUS.find((candidate) => candidate.id === id)
  if (vector === undefined) throw new Error(`unknown vector ${id}`)
  return vector
}

/* ── 1. per-member: the declared admission is what refused the destination ── */
{
  const baseline = await captureVector(vectorOf('WB-F11-destination-forbidden'))
  const widened = await captureVector(vectorOf('WB-F11-destination-forbidden'), {
    // Widening the DECLARED set only: the face, the provider and the pinned
    // policy are untouched. `localhost` is a local name the SSRF leg refuses
    // until the composition declares that exact origin.
    extraTestEndpoints: ['http://localhost:3182'],
  })
  const ok = baseline.outcome === 'deny'
    && baseline.refusal === 'denied-by-lane'
    && widened.outcome === 'allow'
    && widened.facts.fetches === 1
    && widened.net.loopback === 'yes'
  verdict('NC-MEMBER web_fetch', ok, `restricted=${baseline.outcome}/${baseline.refusal} widened=${widened.outcome} providerFetches=${widened.facts.fetches} (widening the DECLARED set flips the refusal)`)
}

/* ── 2. per-member: the search availability leg is the provider's own answer ── */
{
  const baseline = await captureVector(vectorOf('WB-S3-search-unavailable'))
  const widened = await captureVector(vectorOf('WB-S3-search-unavailable'), { searchMode: 'present' })
  const ok = baseline.outcome === 'deny'
    && baseline.refusal === 'route-unresolved'
    && widened.outcome === 'allow'
    && widened.facts.searches === 1
  verdict('NC-MEMBER web_search', ok, `unavailable=${baseline.outcome}/${baseline.refusal} available=${widened.outcome} providerSearches=${widened.facts.searches} (the provider's own available() is the decision)`)
}

/* ── 3/4. positive arms: the unmodified run still reproduces its rows ── */
{
  const records = [
    await captureVector(vectorOf('WB-F1-inline-text')),
    await captureVector(vectorOf('WB-F11-destination-forbidden')),
  ]
  const results = records.map((record) => reproduces(record))
  verdict('NC-MEMBER-POSITIVE web_fetch', results.every((result) => result.ok), results.map((result) => result.detail).join(' | '))
}
{
  const records = [
    await captureVector(vectorOf('WB-S1-search-single')),
    await captureVector(vectorOf('WB-S3-search-unavailable')),
  ]
  const results = records.map((record) => reproduces(record))
  verdict('NC-MEMBER-POSITIVE web_search', results.every((result) => result.ok), results.map((result) => result.detail).join(' | '))
}

/* ── 5. the comparator bites: mutate a golden cell ── */
{
  const fresh = await captureVector(vectorOf('WB-F1-inline-text'))
  const mutated = structuredClone(goldenById.get('WB-F1-inline-text'))
  const resultEffect = mutated.effects.find((effect) => effect.path === '@result')
  resultEffect.mode = resultEffect.mode.replace('status=200', 'status=201')
  const requestEffect = mutated.effects.find((effect) => effect.path === '@srv:requests')
  requestEffect.mode = 'arrival,list=GET /text+GET /ghost'
  const comparison = compareRecord(mutated, fresh)
  const fields = comparison.diffs.map((diff) => diff.field)
  const ok = comparison.ok === false && fields.includes('effects')
  verdict('NC-GOLDEN-MUTATION', ok, `mutated golden cells turn the comparator RED with fields=[${fields.join(',')}]`)
}

/* ── 6. the refusal mapping is total, and its residual buckets unreachable ── */
{
  const mapped = classifyWebRefusal({ outcome: 'deny', text: 'Error: web fetch timed out', facts: [] })
  let invented = null
  try {
    classifyWebRefusal({ outcome: 'deny', text: 'Error: something nobody decided', facts: [] })
  } catch (error) {
    invented = error?.code ?? 'no-code'
  }
  const totality = assertVocabularyTotal(['WEB_TOTALLY_NEW'])
  // `unknown` is a DECLARED vocabulary value (imported from the owner's module),
  // and neither it nor the residual class is reachable from the WEB map.
  const declaredUnknown = REFUSAL_CATEGORIES[UNKNOWN_CATEGORY]?.id === UNKNOWN_CATEGORY
  const declaredResidual = RESIDUAL_CLASS === 'other'
  const mapLandsInResidual = assertVocabularyTotal([]).ok
  const unknownUnreachable = declaredUnknown && declaredResidual && mapLandsInResidual && mapped !== UNKNOWN_CATEGORY
  const ok = mapped === 'cancelled'
    && invented === VOCABULARY_INCOMPLETE
    && totality.ok === false
    && unknownUnreachable === true
  verdict('NC-CATEGORY-TOTAL', ok, `mapped=${mapped} invented=${invented} totality-of-invented=${totality.ok ? 'WRONG' : 'refused'} unknown-reachable=${unknownUnreachable ? 'no' : 'YES(!!)'}`)
}

/* ── 7. the route-C web shadow is load-bearing ── */
{
  // Deliberately NOT through `captureVector`: this arm observes a TEST-ONLY
  // tripwire (`BL18_TRIPWIRE`), which is not a product refusal and therefore
  // must never enter the closed corpus vocabulary.
  const { mountRouteCWorld } = await import('./lib/world.mjs')
  const world = await mountRouteCWorld({ label: 'nc-no-shadow', overrides: { dropWebShadow: true } })
  let withoutShadow
  try {
    const settled = await world.dispatch('web_fetch', { url: `${world.fixtureOrigin}/text` })
    withoutShadow = {
      isError: settled.isError,
      text: settled.text,
      hostWeb: world.hostWebCalls(),
      requests: world.fixtureLog().length,
      fetches: world.providerStats().fetches,
    }
  } finally {
    await world.dispose()
  }
  const positive = reproduces(await captureVector(vectorOf('WB-F1-inline-text')))
  const ok = withoutShadow.isError === true
    && withoutShadow.text.includes('BL18_TRIPWIRE')
    && withoutShadow.hostWeb === 1
    && withoutShadow.fetches === 0
    && withoutShadow.requests === 0
    && positive.ok
  verdict('NC-SHADOW-LOAD-BEARING', ok, `without-shadow=error/hostweb=${withoutShadow.hostWeb}/providerFetches=${withoutShadow.fetches}/requests=${withoutShadow.requests}; with-shadow=${positive.ok ? 'reproduces' : 'DIFFERS'}`)
}

/* ── 8. the socket witness is load-bearing (a missing witness is not a zero) ── */
{
  let missing = null
  const world = await import('./lib/world.mjs').then((module) => module.mountRouteCWorld({ label: 'nc-no-witness', overrides: { withWitness: false } }))
  try {
    await world.dispatch('web_fetch', { url: `${world.fixtureOrigin}/text` })
    try {
      world.network()
    } catch (error) {
      missing = error?.code ?? 'no-code'
    }
  } finally {
    await world.dispose()
  }
  const positive = await captureVector(vectorOf('WB-F1-inline-text'))
  const ok = missing === 'NET_WITNESS_MISSING' && positive.net.external === 0 && positive.net.loopback === 'yes'
  verdict('NC-NET-SHIM-LOAD-BEARING', ok, `without-witness=${missing ?? 'REPORTED A ZERO(!!)'}; with-witness external=${positive.net.external} loopback=${positive.net.loopback}`)
}

/* ── 9. the outbound counter can be non-zero, and the shim still opens no socket ── */
{
  const { installNetworkWitness, uninstallNetworkWitness } = await import('./lib/net-witness.mjs')
  const counters = installNetworkWitness()
  let refused = null
  try {
    const socket = new net.Socket()
    await new Promise((resolvePromise) => {
      socket.once('error', (error) => {
        refused = error?.code ?? 'no-code'
        resolvePromise()
      })
      // `example.com` never resolves here: the witness refuses on the TARGET,
      // before `original.connect`, so no DNS and no packet are involved.
      socket.connect({ host: 'example.com', port: 443 })
      setTimeout(() => resolvePromise(), 1_000).unref()
    })
    socket.destroy()
  } finally {
    uninstallNetworkWitness()
  }
  const snapshot = counters.snapshot()
  const installed = net.Socket.prototype.connect !== undefined
  uninstallNetworkWitness()
  const classifier = classifyConnectTarget({ kind: 'tcp', host: 'example.com', port: 443, label: 'example.com:443' })
  const ok = refused === 'EGRESS_REFUSED'
    && snapshot.external === 1
    && snapshot.forwarded === 0
    && classifier === 'external'
    && installed
  verdict('NC-NET-COUNTER-POSITIVE', ok, `external=${snapshot.external} forwarded=${snapshot.forwarded} real-connect-ran=${snapshot.forwarded === 0 ? 'no' : 'YES(!!)'} refused=${refused} classifier(example.com:443)=${classifier} witness-installed=${installed ? 'yes' : 'no'}`)
}

/* ── 10. the one concurrent vector declares its request witness sorted ── */
{
  const record = await captureVector(vectorOf('WB-S2-search-multi'))
  const requests = record.effects.find((effect) => effect.path === '@srv:requests')
  const ok = String(requests?.mode ?? '').startsWith('sorted,')
  verdict('NC-CONCURRENT-NORMALIZATION', ok, `WB-S2-search-multi request witness mode=${JSON.stringify(String(requests?.mode ?? '').split(',')[0])}`)
}

/* ── family-level: every golden row still satisfies its design claim ── */
{
  const problems = []
  for (const record of golden) {
    const problemsForVector = checkDesignClaim(vectorOf(record.id), record)
    for (const problem of problemsForVector) problems.push(`${record.id}: ${problem}`)
  }
  verdict('NC-GOLDEN-DESIGN-CLAIMS', problems.length === 0, problems.length === 0 ? `all ${String(golden.length)} golden rows satisfy their corpus claim` : problems.join('; '))
}

if (failed > 0) {
  console.error(`NC-VERDICT RED controls=${controls} failed=${failed}`)
  process.exitCode = 1
} else {
  console.log(`NC-VERDICT GREEN controls=${controls} failed=0`)
}
