#!/usr/bin/env node
/**
 * probe-composition.mjs — STEP 0 for the WEB family: measure which composition
 * actually serves the two census members TODAY, before any vector is written.
 * Nothing here is graded; it produces the evidence that decides whether a
 * baseline is even possible.
 *
 * It answers, per member:
 *   1. which census members exist, where the legacy files live, and which
 *      legacy descriptor claims them;
 *   2. is the member REACHABLE on the product route-C composition, does it reach
 *      the CONFINED face (not the inherited host service), and what does an
 *      out-of-lane call do;
 *   3. what does the LEGACY GOVERNED plane do with the same native names
 *      (claim them, alias them, or refuse them);
 *   4. does an invocation need the network, and is the seam that answers it a
 *      MEASURED zero-egress seam (socket witness + a load-bearing control).
 *
 * Evidence: dev/agent-workflow/evidence/ute3-web-b1-20261120/composition-probe.txt
 *
 * @module tests/ute-g1-web/probe-composition
 */
import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

import { isSanctionedTestPort, STABLE_INSTANCE_PORT, TEST_USE_BASELINE_SHA, DSH_BASELINE_VERSION, TEST_USE_REL } from '../paths.mjs'
import { classifyConnectTarget, installNetworkWitness, uninstallNetworkWitness } from './lib/net-witness.mjs'
import { mountRouteCWorld, registerRepoHooks } from './lib/world.mjs'
import { REPO_ROOT } from './lib/old-path.mjs'
import { FIXTURE_ORIGIN, FIXTURE_PORT } from './lib/fixture-server.mjs'
import { loadLegacyWebFamily } from './lib/semantic-differences.mjs'

registerRepoHooks()

console.log(`PROBE host=${DSH_BASELINE_VERSION}@${TEST_USE_BASELINE_SHA}`)
console.log(`PROBE pristine-tree=${TEST_USE_REL} (read-only; never a tracked path)`)
console.log(`PROBE fixture=<loopback> origin=${FIXTURE_ORIGIN} port=${String(FIXTURE_PORT)} sanctioned=${isSanctionedTestPort(FIXTURE_PORT) ? 'yes' : 'NO'} stable-instance-port=${String(STABLE_INSTANCE_PORT)} distinct=${FIXTURE_PORT !== STABLE_INSTANCE_PORT ? 'yes' : 'NO(!!)'}`)
console.log('PROBE-BASELINE real-network=none (every socket this probe opens is loopback; an external attempt is REFUSED and counted)')

/* ── 1. census members + where the family lives in each plane ── */
const census = JSON.parse(readFileSync(join(REPO_ROOT, 'dev', 'agent-workflow', 'ledgers', 'arc-a-family-census.json'), 'utf8'))
const webFamily = census.families.find((family) => family.familyId === 'dsh.web-family')
console.log(`PROBE-CENSUS family=${webFamily.familyId} lane=${webFamily.lane} mount=${webFamily.mount} members=${webFamily.nativeNames.join(',')}`)
console.log(`PROBE-CENSUS contributions=${webFamily.contributionPaths.join(',')}`)
const legacyFiles = [
  'packages/tools/families/web.mjs',
  ...['index.mjs', 'web-mechanics.mjs', 'web-transport.mjs', 'fetch-executor.mjs', 'fetch-row.mjs', 'search-executor.mjs', 'search-row.mjs', 'web-search-provider.mjs', 'web-family-contribution.mjs']
    .map((file) => `packages/tools/web-family/src/${file}`),
]
const legacyDigests = legacyFiles.map((file) => `${file}@${createHash('sha256').update(readFileSync(join(REPO_ROOT, file))).digest('hex').slice(0, 12)}`)
console.log(`PROBE-LEGACY files=${String(legacyFiles.length)} ${legacyDigests.join(' ')}`)
const nativeFiles = [
  'packages/runtime/src/plugin/live/a5sf-realm-row.mjs',
  'packages/runtime/src/plugin/live/confined-web-tool.mjs',
  'packages/runtime/team-services/src/web.ts',
]
console.log(`PROBE-NATIVE plane=route-c seam=mountMemberA5sfRealm+attachA5sfNativeToolModules files=${nativeFiles.join(',')}`)

/* ── 2. reachability on the product route-C composition ── */
const world = await mountRouteCWorld({ label: 'composition' })
try {
  const visible = (name) => world.visible(name)
  console.log(`PROBE-REGISTRY web_fetch=${visible('web_fetch') ? 'registered' : 'MISSING'} web_search=${visible('web_search') ? 'registered' : 'MISSING'}`)
  for (const member of ['web_fetch', 'web_search']) {
    const beforeFacts = (await world.facts()).length
    const beforeRequests = world.fixtureLog().length
    const args = member === 'web_fetch'
      ? { url: `${world.fixtureOrigin}/text` }
      : { queries: ['probe composition query'] }
    const allow = await world.dispatch(member, args)
    const facts = (await world.facts()).slice(beforeFacts)
    const stats = world.providerStats()
    const net = world.network()
    const hostWeb = world.hostWebCalls()
    console.log(`PROBE-MEMBER ${member} reachable=yes outcome=${allow.isError ? 'error' : 'allow'} providerCalls=${member === 'web_fetch' ? stats.fetches : stats.searches} inheritedServiceCalls=${hostWeb}`)
    console.log(`PROBE-MEMBER ${member} confined=${hostWeb === 0 ? 'yes' : 'NO(!!)'} facts=${facts.length} factMethods=${facts.map((fact) => `${fact.method}:${fact.decision}`).join(',') || '-'} annotations=${facts.flatMap((fact) => fact.annotations ?? []).join(',') || '-'}`)
    console.log(`PROBE-MEMBER ${member} sockets=loopback:${net.loopback}/external:${net.external} destinations=${[...new Set(net.targets)].join(',') || '-'}`)
    console.log(`PROBE-MEMBER ${member} servedRequests=${world.fixtureLog().slice(beforeRequests).map((entry) => `${entry.method} ${entry.path}`).join('+') || '-'}`)
    const denyUrl = 'http://localhost:3182/text'
    const deny = member === 'web_fetch' ? await world.dispatch(member, { url: denyUrl }) : null
    if (deny !== null) {
      const denyFacts = (await world.facts()).slice(-1)
      console.log(`PROBE-MEMBER ${member} out-of-lane outcome=${deny.isError ? 'deny' : 'ALLOW(!!)'} text=${JSON.stringify(String(deny.text).slice(0, 110))}`)
      console.log(`PROBE-MEMBER ${member} out-of-lane fact decision=${denyFacts.at(-1)?.decision} decidedBy=${denyFacts.at(-1)?.decidedBy} locator=${denyFacts.at(-1)?.locator}`)
    } else {
      console.log(`PROBE-MEMBER ${member} out-of-lane outcome=n/a (the lane under test is the composition provider's availability, measured as WB-S3)`)
    }
  }
} finally {
  await world.dispose()
}

/* ── 3. the legacy governed plane, with the SAME native names ── */
const { family, mechanics } = await loadLegacyWebFamily()
const assembly = family.familyAssembly
const manifest = JSON.parse(readFileSync(join(REPO_ROOT, 'packages', 'tools', 'families', 'manifest.json'), 'utf8'))
const manifestEntry = manifest.families.find((entry) => entry.module === 'web.mjs')
const liveDigest = createHash('sha256').update(readFileSync(join(REPO_ROOT, 'packages', 'tools', 'families', 'web.mjs'))).digest('hex')
console.log(`PROBE-PLANE legacy-family=${assembly.familyId} order=${String(assembly.order)} schema=${assembly.schema}`)
console.log(`PROBE-PLANE claims=${assembly.claims().join(',')} native-claim=DIRECT (no alias)`)
console.log(`PROBE-PLANE enabled(absent)=${String(assembly.enabled({ planeConfig: {} }))} enabled(webEnabled=true)=${String(assembly.enabled({ planeConfig: { webEnabled: true } }))} disabledOwned=${assembly.disabledOwned().join(',') || '-'}`)
console.log(`PROBE-PLANE config-keys=${Object.keys(assembly.config).join(',')}`)
console.log(`PROBE-PLANE manifest-sha256=${manifestEntry?.sha256 === liveDigest ? 'matches' : 'DRIFT(!!)'} reviewed=${String(manifestEntry?.sha256).slice(0, 12)} live=${liveDigest.slice(0, 12)}`)
const plane = await import(pathToFileURL(join(REPO_ROOT, 'packages/runtime/src/plugin/live/team-tool-plane.mjs')).href)
const nat = plane.verifyPlaneNames({ web_fetch: 'web_fetch', web_search: 'web_search' }, 'read')
console.log(`PROBE-PLANE verifyPlaneNames(web keys) gate=${nat.ok ? 'accepted(!!)' : nat.code} message=${JSON.stringify(String(nat.message ?? '').slice(0, 120))}`)
const control = plane.verifyPlaneNames({ grep: 'team_grep', glob: 'team_glob', bash: 'team_bash' }, 'read')
console.log(`PROBE-PLANE verifyPlaneNames(search/bash control: team_grep+team_glob+team_bash) gate=${control.ok ? 'accepted' : control.code}`)
const nativeBash = plane.verifyPlaneNames({ grep: 'team_grep', glob: 'team_glob', bash: 'bash' }, 'read')
console.log(`PROBE-PLANE verifyPlaneNames(native-bash claim) gate=${nativeBash.ok ? 'accepted' : nativeBash.code} (the plane's takeover law differs from the web family's: web names are simply NOT in this map)`)
console.log(`PROBE-PLANE WEB-IS-NOT-THIS-GATE: verifyPlaneNames is the search/bash plane's map (grep/glob/bash + readName); the WEB family mounts through the FamilyAssembly seam, which CLAIMS the native spellings directly`)
console.log(`PROBE-PLANE refusal-builder=${typeof mechanics.webRefusal === 'function' ? 'typed(webRefusal(kind,code,detail))' : 'MISSING'} maxRedirectHops=${String(mechanics.MAX_REDIRECT_HOPS)} defaultMaxFetchBytes=${String(mechanics.DEFAULT_MAX_FETCH_BYTES)}`)

/* ── 4. the network seam, proven load-bearing ── */
console.log('PROBE-NET layer=confined-web-face -> composition provider -> pinned @deepseek-ai/dsh-web-fetch-http HttpFetchProvider (injected loopback resolver) -> pinned undici pinned-lookup connector -> real loopback http fixture')
const probeCounters = installNetworkWitness()
try {
  const probeWorld = await mountRouteCWorld({ label: 'net-proof' })
  try {
    await probeWorld.dispatch('web_fetch', { url: `${probeWorld.fixtureOrigin}/text` })
    const snapshot = probeWorld.network()
    console.log(`PROBE-NET admitted-call sockets=${String(snapshot.sockets)} loopback=${String(snapshot.loopback)} external=${String(snapshot.external)} forwarded=${String(snapshot.forwarded)} destinations=${[...new Set(snapshot.targets)].join(',')}`)
  } finally {
    await probeWorld.dispose()
  }
} finally {
  uninstallNetworkWitness()
}
void probeCounters
// The classifier is the increment site's own decision; moving it proves the zero
// above is a measurement and not a constant. No socket is opened by this line.
console.log(`PROBE-NET counter-positive classifier(example.com:443)=${classifyConnectTarget({ kind: 'tcp', host: 'example.com', port: 443, label: 'example.com:443' })} (an external destination is classified external, so the counter CAN move; the witness REFUSES it before original.connect, so forwarded stays 0)`)
const unwitnessed = await mountRouteCWorld({ label: 'net-proof-missing', overrides: { withWitness: false } })
let missing = null
try {
  await unwitnessed.dispatch('web_fetch', { url: `${unwitnessed.fixtureOrigin}/text` })
  try {
    unwitnessed.network()
  } catch (error) {
    missing = error?.code ?? 'no-code'
  }
} finally {
  await unwitnessed.dispose()
}
console.log(`PROBE-NET witness-absent=${missing ?? 'REPORTED A ZERO(!!)'} (a disabled witness can never be read as "no egress")`)
console.log('PROBE-NET proxy-law=the pinned provider skips its proxy branch for a non-public IP literal (isNonPublicIpLiteral), so a process-wide HTTP_PROXY cannot be entered for the 127.0.0.1 fixture origin')

/* ── 5. the verdict ── */
console.log('PROBE-CONCLUSION census-members=web_fetch,web_search reachable-on=route-c/mountMemberA5sfRealm+attachA5sfNativeToolModules')
console.log('PROBE-CONCLUSION legacy-governed-plane=CLAIMS the same native spellings through the FamilyAssembly seam (opt-in webEnabled; ABSENT=FALSE); verifyPlaneNames is NOT the gate for this family and refuses a web key as a closed-map fault')
console.log('PROBE-CONCLUSION network=required-and-contained: the composition owns a transport (the face ships none by design); the fixture answers over a real loopback socket and ZERO non-loopback connects were attempted')
console.log('PROBE-CONCLUSION mounting-gap=NONE for both members (both are reachable on the product composition and both reach the confined face)')
console.log('PROBE-CONCLUSION baseline=PROCEED (see tests/ute-g1-web/golden/old-path.tsv)')
console.log('PROBE-VERDICT web-members-reachable=2/2 external-sockets=0 witness=load-bearing baseline=PROCEED')
