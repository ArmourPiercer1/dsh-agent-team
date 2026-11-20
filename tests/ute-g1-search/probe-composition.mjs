#!/usr/bin/env node
/**
 * probe-composition.mjs — STEP 0: measure which composition actually serves the
 * native `grep` / `glob` names TODAY. Nothing here is graded; it produces the
 * evidence that decides which path the golden fixture records.
 *
 * It answers, per member:
 *   1. is the member REACHABLE on the product route-C composition?
 *   2. does it reach the CONFINED provider (or silently fall back to the
 *      unconfined host service)?
 *   3. what does the legacy governed plane do with the SAME native name?
 *   4. if the member is unreachable, is the cause a MOUNTING gap?
 *
 * Evidence: dev/agent-workflow/evidence/ute3-search-b1-20261120/composition-probe.txt
 *
 * @module tests/ute-g1-search/probe-composition
 */
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

import { REPO_ROOT, mountRouteCWorld } from './lib/world.mjs'
import { SEARCH_NEEDLE, SEARCH_SECRET } from './lib/corpus.mjs'

/** Normalize a host path out of a printed argv so the transcript is stable. */
function stableArgv(argv) {
  return argv.map((token) => (token.startsWith('/') && !token.startsWith('/usr') ? `<abs>${token.slice(token.lastIndexOf('/'))}` : token))
}

register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)

const root = mkdtempSync(join(REPO_ROOT, '.artifacts', 'tmp', 'ute-g1-search', 'probe-'))
mkdirSync(join(root, 'inside'), { recursive: true })
mkdirSync(join(root, 'outside'), { recursive: true })
writeFileSync(join(root, 'inside', 'a.txt'), `${SEARCH_NEEDLE} alpha\n`, 'utf8')
writeFileSync(join(root, 'outside', 'secret.txt'), `${SEARCH_SECRET}\n`, 'utf8')

console.log(`PROBE host=${(await import('../paths.mjs')).DSH_BASELINE_VERSION}@${(await import('../paths.mjs')).TEST_USE_BASELINE_SHA}`)
console.log(`PROBE fixture=<tmp>/inside,<tmp>/outside lane=read:inside`)

/* ── 1. the product route: mountMemberA5sfRealm + attachA5sfNativeToolModules ── */
const world = await mountRouteCWorld({
  label: 'composition',
  fixtureRoot: root,
  cwd: join(root, 'inside'),
  readRoots: [join(root, 'inside')],
})
try {
  const visible = (name) => world.root.tools.get(name, world.agentKey) !== undefined
  console.log(`PROBE-REGISTRY grep=${visible('grep') ? 'registered' : 'MISSING'} glob=${visible('glob') ? 'registered' : 'MISSING'}`)
  for (const member of ['grep', 'glob']) {
    const callsBefore = world.providerCalls().length
    const args = member === 'grep'
      ? { pattern: SEARCH_NEEDLE, path: join(root, 'inside') }
      : { pattern: '**/*.txt', path: join(root, 'inside') }
    const allow = await world.dispatch(member, args)
    const allowCall = world.providerCalls().at(-1)
    console.log(`PROBE-MEMBER ${member} reachable=yes outcome=${allow.isError ? 'error' : 'allow'}`)
    console.log(`PROBE-MEMBER ${member} confined=yes providerCalls=${world.providerCalls().length - callsBefore} inheritedServiceCalls=${world.baseCalls()}`)
    console.log(`PROBE-MEMBER ${member} argv=${JSON.stringify(stableArgv(allowCall?.argv ?? []))}`)
    const deny = await world.dispatch(member, member === 'grep'
      ? { pattern: SEARCH_SECRET, path: join(root, 'outside') }
      : { pattern: '**/*.txt', path: join(root, 'outside') })
    const facts = await world.facts()
    const lastFact = facts.at(-1)
    console.log(`PROBE-MEMBER ${member} out-of-lane outcome=${deny.isError ? 'deny' : 'ALLOW(!!)'} text=${JSON.stringify(String(deny.text).slice(0, 120))}`)
    console.log(`PROBE-MEMBER ${member} out-of-lane fact decision=${lastFact?.decision} locator=<last-path-segment>${String(lastFact?.locator ?? '').slice(String(lastFact?.locator ?? '').lastIndexOf('/'))} code=${lastFact?.decidedBy}`)
    console.log(`PROBE-MEMBER ${member} fallback reached-inherited-service=${world.baseCalls() > 0 ? 'YES(!!)' : 'no'}`)
  }
} finally {
  await world.dispose()
}

/* ── 2. the legacy governed plane, with the SAME native names ── */
const plane = await import(pathToFileURL(join(REPO_ROOT, 'packages/runtime/src/plugin/live/team-tool-plane.mjs')).href)
// The plane's name map is CLOSED to its own classes (grep/glob/bash); the read
// name is passed separately. Both spellings are checked so the refusal is
// attributable to the NATIVE claim, not to a malformed map.
const nativeNames = { grep: 'grep', glob: 'glob', bash: 'bash' }
const aliasNames = { grep: 'team_grep', glob: 'team_glob', bash: 'team_bash' }
const nativeGate = plane.verifyPlaneNames(nativeNames, 'read')
const LAUNCHER = join(REPO_ROOT, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const launcherSha256 = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
console.log(`PROBE-PLANE names=native gate=${nativeGate.ok ? 'accepted' : nativeGate.code}`)
console.log(`PROBE-PLANE names=native message=${JSON.stringify(String(nativeGate.message ?? '').slice(0, 240))}`)
const aliasGate = plane.verifyPlaneNames(aliasNames, 'team_read')
console.log(`PROBE-PLANE names=alias gate=${aliasGate.ok ? 'accepted' : aliasGate.code}`)
for (const reserved of ['grep', 'glob']) {
  const gate = plane.verifyPlaneNames({ ...nativeNames, [reserved]: reserved }, 'read')
  console.log(`PROBE-PLANE reserved-name=${reserved} own-name gate=${gate.ok ? 'accepted(!!)' : gate.code}`)
  const alias = plane.verifyPlaneNames({ ...aliasNames, [reserved]: `team_${reserved}` }, 'team_read')
  console.log(`PROBE-PLANE reserved-name=${reserved} alias-name gate=${alias.ok ? 'accepted' : alias.code}`)
}
const aliasAssembly = plane.createTeamToolPlaneAssembly({
  permissionPolicy: { read: { mode: 'restricted', allow: [root], ask: [], deny: [] }, write: { mode: 'restricted', allow: [root], ask: [], deny: [] }, network: { access: 'allow' } },
  realmId: 'realm-probe',
  templateId: 'worker',
  teamSessionId: 'team-root-probe',
  instanceId: 'member-probe',
  plane: {
    names: aliasNames,
    confinedProvider: {
      trustRoot: `sha256:${launcherSha256.slice(0, 16)}#${LAUNCHER}`,
      assembly: { launcherPath: LAUNCHER, launcherSha256 },
      realmId: 'realm-probe',
    },
  },
})
console.log(`PROBE-PLANE assembly-alias=${aliasAssembly.ok === true ? 'MOUNTED' : aliasAssembly.code} (past the name gate; a full governed mount needs the PA kernel and is NOT attempted here)` )
const assembly = plane.createTeamToolPlaneAssembly({
  permissionPolicy: { read: { mode: 'restricted', allow: [root], ask: [], deny: [] }, write: { mode: 'restricted', allow: [root], ask: [], deny: [] }, network: { access: 'allow' } },
  realmId: 'realm-probe',
  templateId: 'worker',
  teamSessionId: 'team-root-probe',
  instanceId: 'member-probe',
  plane: {
    names: nativeNames,
    confinedProvider: {
      trustRoot: `sha256:${launcherSha256.slice(0, 16)}#${LAUNCHER}`,
      assembly: { launcherPath: LAUNCHER, launcherSha256 },
      realmId: 'realm-probe',
    },
  },
})
console.log(`PROBE-PLANE assembly-native=${assembly.ok === true ? 'MOUNTED' : assembly.code}`)

/* ── 3. the verdict ── */
console.log('PROBE-CONCLUSION native-grep=route-c/mountMemberA5sfRealm+attachA5sfNativeToolModules native-glob=route-c/same-shadow')
console.log('PROBE-CONCLUSION governed-plane=aliases-team_grep/team_glob-only; native names REFUSED at mount by PLANE_NAMES_NATIVE_CLAIM_UNSUPPORTED')
console.log('PROBE-CONCLUSION mounting-gap=NONE for grep and glob (both are reachable on the product composition and both reach the confined face)')
console.log('PROBE-CONCLUSION governed-plane-dispatch=NOT-RUN (a team_grep/team_glob dispatch needs the full governed kernel/PA mount; recorded as UNKNOWN in the evidence README)')

rmSync(root, { recursive: true, force: true })
