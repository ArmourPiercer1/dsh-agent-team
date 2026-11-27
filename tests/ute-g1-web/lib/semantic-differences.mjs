/**
 * semantic-differences.mjs — the MEASURED differences between the legacy
 * governed WEB family and the product route-C composition that serves the same
 * two native names today.
 *
 * WHY THIS FILE IS NOT OPTIONAL. `terms.semanticDifferencesResolved` in
 * `dev/agent-workflow/ledgers/ute-retirement.json` is a four-term predicate the
 * owner owns. A term that is false because nobody looked is indistinguishable
 * from a term that is false because a difference is real, so the difference set
 * has to be enumerated and MEASURED. Each entry here is:
 *
 *   blocking   the difference changes what a model can observe or what an
 *              operator can attribute, so retirement would move behaviour;
 *   approval   `null` — NOBODY has approved this difference, in either direction.
 *
 * The three measured differences are not failures of this PR: they are the
 * honest reason `newPathVerified` and `semanticDifferencesResolved` stay false.
 *
 * @module tests/ute-g1-web/lib/semantic-differences
 */
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join, resolve } from 'node:path'

import { CORPUS } from './corpus.mjs'
import { typedCodeOf } from './effect-oracle.mjs'
import { mountRouteCWorld, registerRepoHooks } from './world.mjs'
import { startFixtureServer } from './fixture-server.mjs'

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

/** The legacy governed family descriptor under comparison. */
export const LEGACY_FAMILY_MODULE = join(REPO_ROOT, 'packages', 'tools', 'families', 'web.mjs')
/** The legacy mechanics module (typed refusals + the redirect hop constant). */
export const LEGACY_MECHANICS_MODULE = join(REPO_ROOT, 'packages', 'tools', 'web-family', 'src', 'web-mechanics.mjs')
/** The legacy transport module. */
export const LEGACY_TRANSPORT_MODULE = join(REPO_ROOT, 'packages', 'tools', 'web-family', 'src', 'web-transport.mjs')

/** Load the legacy modules (read-only; they are the OLD implementation). */
export async function loadLegacyWebFamily() {
  // The legacy family is TypeScript-era code whose internal imports are spelled
  // `.js` (NodeNext); the repo's existing hooks map them to the sources.
  registerRepoHooks()
  const [family, mechanics, transport] = await Promise.all([
    import(pathToFileURL(LEGACY_FAMILY_MODULE).href),
    import(pathToFileURL(LEGACY_MECHANICS_MODULE).href),
    import(pathToFileURL(LEGACY_TRANSPORT_MODULE).href),
  ])
  return { family, mechanics, transport }
}

/**
 * SD-WEB-1 — ONE NATIVE NAME, TWO CLAIMANTS.
 *
 * The legacy family claims the FIXED native spellings `web_fetch`/`web_search`
 * (opt-in by `webEnabled`), and the product route-C composition also serves
 * both names (measured: the world's registry + the corpus rows). So an install
 * with `webEnabled: true` has TWO producers of the same two names, and nothing
 * in either plane names the winner at the seam. Retirement cannot move a name
 * whose ownership is not yet single.
 */
export async function measureClaimCollision() {
  const { family } = await loadLegacyWebFamily()
  const assembly = family.familyAssembly
  const claims = assembly.claims()
  const enabledAbsent = assembly.enabled({ planeConfig: {} })
  const enabledOn = assembly.enabled({ planeConfig: { webEnabled: true } })
  const world = await mountRouteCWorld({ label: 'sd-claim' })
  try {
    const routeC = {
      visible: ['web_fetch', 'web_search'].filter((name) => world.visible(name)),
    }
    return {
      id: 'SD-WEB-1-native-name-claim-collision',
      title: 'the legacy governed family and the route-C composition both claim web_fetch/web_search',
      blocking: true,
      approval: null,
      legacy: { familyId: assembly.familyId, claims, enabledAbsent, enabledOn, disabledOwned: assembly.disabledOwned() },
      routeC,
      impact: 'an install with webEnabled:true has two producers of the same two native names; the seam names no winner, so a retirement move would have to decide name ownership first',
    }
  } finally {
    await world.dispose()
  }
}

/**
 * SD-WEB-2 — WHERE THE REDIRECT LAW LIVES.
 *
 * The legacy transport NEVER follows a redirect: it answers one bounded response
 * and the governed row drives the hops under `MAX_REDIRECT_HOPS`. The route-C
 * face hands the call to the pinned provider, which follows same-origin hops
 * itself under its own `maxRedirects`; the face discloses that as the ALLOW
 * residual `WEB_REDIRECT_UNMEDIATE_ON_ALLOW`. One tool call therefore produces
 * three wire requests in the new plane (measured) and exactly one in the legacy
 * transport (measured), which changes both the hop budget's owner and the number
 * of network effects an operator can attribute to one call.
 */
export async function measureRedirectOwnership() {
  const { mechanics, transport } = await loadLegacyWebFamily()
  const fixture = await startFixtureServer()
  let legacyAnswer
  let legacyHops
  try {
    const legacyTransport = transport.createWebTransport({ allowHttpLoopback: true })
    legacyAnswer = await legacyTransport.fetchBounded({
      url: `${fixture.origin}/r1`,
      maxBytes: 4096,
      timeoutMs: 5_000,
    })
    legacyHops = fixture.log.map((entry) => `${entry.method} ${entry.path}`)
  } finally {
    // The two measurements bind the same sanctioned port, so the legacy server
    // must be down before the route-C world stands its own fixture up.
    await fixture.close()
  }
  const world = await mountRouteCWorld({ label: 'sd-redirect' })
  try {
    await world.dispatch('web_fetch', { url: `${world.fixtureOrigin}/r1` })
    const routeCHops = world.fixtureLog().map((entry) => `${entry.method} ${entry.path}`)
    const facts = await world.facts()
    return {
      id: 'SD-WEB-2-redirect-ownership',
      title: 'the legacy transport answers one hop and the row drives the chain; the route-C pinned provider follows the chain itself',
      blocking: true,
      approval: null,
      legacy: {
        maxRedirectHops: mechanics.MAX_REDIRECT_HOPS,
        transportNeverFollows: legacyAnswer.ok === true && legacyAnswer.location === '/r2',
        answeredStatus: legacyAnswer.ok === true ? legacyAnswer.statusCode : legacyAnswer.code,
        answeredLocation: legacyAnswer.ok === true ? legacyAnswer.location ?? null : null,
        requests: legacyHops.length,
        hopList: legacyHops,
      },
      routeC: {
        requests: routeCHops.length,
        hopList: routeCHops,
        residual: (facts[0]?.annotations ?? []).filter((annotation) => annotation.startsWith('WEB_REDIRECT_')),
      },
      impact: 'one tool call is one network effect in the legacy plane and N (here 3) in the route-C plane; the hop budget moved from the row to the provider',
    }
  } finally {
    await world.dispose()
  }
}

/**
 * SD-WEB-3 — THE REFUSAL SURFACE.
 *
 * The legacy mechanics raise TYPED refusals (`webRefusal(kind, code, detail)`),
 * so a governed consumer keys on a code. On the route-C path the body/format/
 * deadline refusals are the PINNED provider's `WebError`s, which the tool
 * renders as prose: the model sees `Error: unsupported content type "…"` with
 * no code, and the guard fact for the call says ALLOW (the call WAS admitted).
 * This lane's mapping therefore had to name the prose patterns in a closed
 * table (`PINNED_WEB_ERROR_TEXT`) to classify three of its own rows — measured
 * here, not asserted.
 */
export async function measureRefusalSurface() {
  const { mechanics } = await loadLegacyWebFamily()
  const sample = mechanics.webRefusal('transport', 'WEB_RESPONSE_TOO_LARGE', 'measured sample')
  const affected = ['WB-F6-content-type-refused', 'WB-F7-body-byte-cap', 'WB-F9-timeout']
  const rows = []
  for (const id of affected) {
    const vector = CORPUS.find((candidate) => candidate.id === id)
    const world = await mountRouteCWorld({
      label: `sd-refusal-${id}`,
      overrides: { fetchLimits: vector.limits },
    })
    try {
      const url = world.fixtureOrigin + (id === 'WB-F6-content-type-refused' ? '/binary' : id === 'WB-F7-body-byte-cap' ? '/big' : '/slow')
      const settled = await world.dispatch('web_fetch', { url })
      const facts = await world.facts()
      rows.push({
        id,
        modelText: settled.text,
        typedCodeInText: typedCodeOf(settled.text),
        factDecision: facts.at(-1)?.decision ?? null,
        factDecidedBy: facts.at(-1)?.decidedBy ?? null,
      })
    } finally {
      await world.dispose()
    }
  }
  return {
    id: 'SD-WEB-3-refusal-surface',
    title: 'the legacy row raises typed web refusals; the route-C provider refusals reach the model as prose over an ALLOW fact',
    blocking: true,
    approval: null,
    legacy: {
      hasTypedRefusalBuilder: typeof mechanics.webRefusal === 'function',
      sample: { ok: sample?.ok ?? null, code: sample?.code ?? null },
    },
    routeC: { rows },
    impact: 'a consumer that keys on a refusal code cannot tell a size/content-type/deadline refusal from a transport fault on the route-C plane, and the call carries an ALLOW fact',
  }
}

/**
 * THE DECLARED DIFFERENCES (round 81). Measurement lived on the deleted legacy
 * family (`packages/tools/families/web.mjs` + `web-family/src/*`, cut by
 * `93ba0a1d1`), so the MEASURED cells below are the values the B1 instrument
 * recorded in `dev/agent-workflow/evidence/ute3-web-b1-20261120/semantic-differences.txt`
 * and are asserted as the HISTORICAL record. What must stay live is the
 * declaration: all three remain blocking and UNAPPROVED, so this family can
 * never be retired on the strength of them.
 */
export const SEMANTIC_DIFFERENCES = Object.freeze([
  Object.freeze({
    id: 'SD-WEB-1-native-name-claim-collision',
    blocking: true,
    approval: null,
    retiredMeasurement: '93ba0a1d1 (packages/tools/families/web.mjs)',
    historical: Object.freeze({ collision: 'both planes claim the native web_fetch/web_search names' }),
  }),
  Object.freeze({
    id: 'SD-WEB-2-redirect-ownership',
    blocking: true,
    approval: null,
    retiredMeasurement: '5d1349767+93ba0a1d1',
    historical: Object.freeze({
      legacy: Object.freeze({ requests: 1 }),
      routeC: Object.freeze({ requests: 3, residual: Object.freeze(['WEB_REDIRECT_UNMEDIATED_ON_ALLOW']) }),
    }),
  }),
  Object.freeze({
    id: 'SD-WEB-3-refusal-surface',
    blocking: true,
    approval: null,
    retiredMeasurement: '5d1349767+93ba0a1d1',
    historical: Object.freeze({ typedCodeInText: null, factDecision: 'ALLOW' }),
  }),
])

/** Measure every difference (each one boots its own world; serial by design). */
export async function measureAll() {
  const differences = []
  differences.push(await measureClaimCollision())
  differences.push(await measureRedirectOwnership())
  differences.push(await measureRefusalSurface())
  return differences
}
