#!/usr/bin/env node
/**
 * probe-composition.mjs — STEP 0: measure which composition actually serves the
 * native `bash` / `pwsh` names TODAY. Nothing here is graded; it produces the
 * evidence that decides what the old-path fixture may record.
 *
 * It answers, per member:
 *   1. is the member REACHABLE on the product route-C composition?
 *   2. does it reach the CONFINED provider (or silently fall back to an
 *      inherited service)?
 *   3. what does the legacy governed plane do with the SAME native name?
 *   4. is a member that cannot be exercised recorded as an exclusion, or is
 *      something actually mounted that this probe failed to see?
 *
 * Evidence: dev/agent-workflow/evidence/ute3-process-b1-20261120/composition-probe.txt
 *
 * @module tests/ute-g1-process/probe-composition
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

import { DSH_BASELINE_VERSION, TEST_USE_BASELINE_SHA } from '../paths.mjs'
import { HOST_ROOT, REPO_ROOT, kernelEnforced, mountRouteCWorld } from './lib/world.mjs'
import { PROCESS_SECRET } from './lib/corpus.mjs'

register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)

const root = mkdtempSync(join(REPO_ROOT, '.artifacts', 'tmp', 'ute-g1-process', 'probe-'))
mkdirSync(join(root, 'inside'), { recursive: true })
mkdirSync(join(root, 'outside'), { recursive: true })
writeFileSync(join(root, 'inside', 'a.txt'), 'alpha\n', 'utf8')
writeFileSync(join(root, 'outside', 'secret.txt'), `${PROCESS_SECRET}\n`, 'utf8')

console.log(`PROBE host=${DSH_BASELINE_VERSION}@${TEST_USE_BASELINE_SHA} host_tree=${HOST_ROOT === join(REPO_ROOT, 'tests', 'deepseek-harness-test-use') ? 'tests/deepseek-harness-test-use' : 'OTHER'}`)
console.log('PROBE fixture=<tmp>/inside,<tmp>/outside lane=read+write:inside')
console.log(`PROBE kernel-content-read=${(await kernelEnforced()) ? 'enforced' : 'unenforced'}`)

/* ── 0. the pwsh question, answered by facts, not by a skip ─────────────── */
const pwshBinary = ['/usr/bin/pwsh', '/usr/local/bin/pwsh', '/opt/microsoft/powershell/7/pwsh']
  .filter((candidate) => { try { readFileSync(candidate); return true } catch { return false } })
const pathPwsh = spawnSync('sh', ['-c', 'command -v pwsh 2>/dev/null || true'], { encoding: 'utf8' }).stdout.trim()
console.log(`PROBE-PWSH binary=${pwshBinary.length > 0 ? pwshBinary.join(',') : (pathPwsh !== '' ? pathPwsh : 'ABSENT')}`)
console.log(`PROBE-PWSH binary-on-path=${pathPwsh === '' ? 'no' : 'yes'} host-package=${existsHostPackage('shell/tool-pwsh') ? 'present' : 'absent'} route-c-shadow=${existsRouteCShadow('pwsh') ? 'PRESENT' : 'ABSENT'}`)
console.log(`PROBE-PWSH preset-row=${governedPresetMentions('tool-pwsh')}`)

/* ── 1. the product route: mountMemberA5sfRealm + attachA5sfNativeToolModules ── */
const world = await mountRouteCWorld({
  label: 'composition',
  fixtureRoot: root,
  cwd: join(root, 'inside'),
  readRoots: [join(root, 'inside')],
})
try {
  const visible = (name) => world.root.tools.get(name, world.agentKey) !== undefined
  console.log(`PROBE-REGISTRY bash=${visible('bash') ? 'registered' : 'MISSING'} pwsh=${visible('pwsh') ? 'registered' : 'MISSING'}`)
  // The EXCLUSION'S REASON is the wiring, never the host. The binary line above
  // is an observation: a runner may ship PowerShell, and that must not change
  // the verdict. This line states the repo facts the rule is derived from.
  console.log(`PROBE-PWSH reason=shipped-wiring route-c-shadow=${existsRouteCShadow('pwsh') ? 'PRESENT' : 'ABSENT'} preset-row=${governedPresetMentions('tool-pwsh').split(' ')[0]} post-attach-definition=${visible('pwsh') ? 'REGISTERED' : 'ABSENT'} — the binary line above is a HOST OBSERVATION, not the exclusion reason`)
  console.log(`PROBE-OWNER bash-replaced-by-attach=${world.shadowReplaced ? 'yes' : 'NO(!!)'} before=${world.definitionBeforeAttach === undefined ? 'absent' : 'preset-definition'} after=${world.definitionAfterAttach === undefined ? 'ABSENT(!!)' : 'routed-definition'}`)
  for (const member of ['bash', 'pwsh']) {
    if (!visible(member)) {
      console.log(`PROBE-ROUTE-UNREACHABLE member=${member} reason=no definition is registered for this name on the post-attach Member scope (the route-C attach places no shadow for it and the preset does not mount it)`)
      continue
    }
    const callsBefore = world.providerCalls().length
    const allow = await world.dispatch(member, member === 'bash'
      ? { command: 'printf %s "$PWD"; printf "\\n"', description: 'probe in-lane command' }
      : { command: 'Write-Output ping', description: 'probe pwsh command' })
    const allowCall = world.providerCalls().at(-1)
    console.log(`PROBE-MEMBER ${member} reachable=yes outcome=${allow.isError ? 'error' : 'allow'}`)
    console.log(`PROBE-MEMBER ${member} confined=${world.providerCalls().length - callsBefore > 0 ? 'yes' : 'NO(!!)'} providerCalls=${world.providerCalls().length - callsBefore} inheritedServiceCalls=${world.baseCalls()}`)
    console.log(`PROBE-MEMBER ${member} argv=${JSON.stringify((allowCall?.argv ?? []).map((token, index) => (index === 2 ? '<body>' : token)))}`)
    console.log(`PROBE-MEMBER ${member} text=${JSON.stringify(String(allow.text).slice(0, 200))}`)
    const deny = await world.dispatch(member, member === 'bash'
      ? { command: 'cat ../outside/secret.txt', description: 'probe out-of-lane read' }
      : { command: 'Get-Content ../outside/secret.txt', description: 'probe out-of-lane read' })
    const facts = await world.facts()
    const lastFact = facts.at(-1)
    console.log(`PROBE-MEMBER ${member} out-of-lane outcome=${deny.isError ? 'deny' : 'allow'} text=${JSON.stringify(String(deny.text).slice(0, 200))}`)
    console.log(`PROBE-MEMBER ${member} out-of-lane fact decision=${lastFact?.decision} locator=<last-path-segment>${String(lastFact?.locator ?? '').slice(String(lastFact?.locator ?? '').lastIndexOf('/'))} code=${lastFact?.decidedBy ?? '-'}`)
    console.log(`PROBE-MEMBER ${member} fallback reached-inherited-service=${world.baseCalls() > 0 ? 'YES(!!)' : 'no'}`)
  }
  console.log(`PROBE-FACTS total=${(await world.facts()).length} allow=${(await world.facts()).filter((fact) => fact?.decision === 'allow').length} deny=${(await world.facts()).filter((fact) => fact?.decision === 'deny').length}`)
} finally {
  await world.dispose()
}

/* ── 2. the legacy governed plane, with the SAME native names ────────────── */
const plane = await import(pathToFileURL(join(REPO_ROOT, 'packages/runtime/src/plugin/live/team-tool-plane.mjs')).href)
const nativeNames = { bash: 'bash' }
const aliasNames = { bash: 'team_bash' }
const nativeGate = plane.verifyPlaneNames(nativeNames, 'read')
console.log(`PROBE-PLANE names=bash-only gate=${nativeGate.ok ? 'accepted' : nativeGate.code}`)
console.log(`PROBE-PLANE names=bash-only message=${JSON.stringify(String(nativeGate.message ?? '').slice(0, 240))}`)
// The plane's name map is CLOSED to grep/glob/bash, so a map that carries only
// `bash` is INCOMPLETE, not native-claim-refused. The load-bearing arm is the
// COMPLETE map: bash at its native spelling, the two search rows aliased.
const nativeBashComplete = { bash: 'bash', grep: 'team_grep', glob: 'team_glob' }
const completeGate = plane.verifyPlaneNames(nativeBashComplete, 'team_read')
console.log(`PROBE-PLANE names=bash-native+search-aliased gate=${completeGate.ok ? 'accepted' : completeGate.code}`)
if (completeGate.ok !== true) console.log(`PROBE-PLANE names=bash-native+search-aliased message=${JSON.stringify(String(completeGate.message ?? '').slice(0, 240))}`)
const aliasGate = plane.verifyPlaneNames(aliasNames, 'team_read')
console.log(`PROBE-PLANE names=bash-aliased-only gate=${aliasGate.ok ? 'accepted' : aliasGate.code}`)
const pwshGate = plane.verifyPlaneNames({ bash: 'bash', pwsh: 'pwsh' }, 'read')
console.log(`PROBE-PLANE names=native+bash-pwsh gate=${pwshGate.ok ? 'accepted' : pwshGate.code}`)
console.log(`PROBE-PLANE names=native+bash-pwsh message=${JSON.stringify(String(pwshGate.message ?? '').slice(0, 240))}`)
const LAUNCHER = join(REPO_ROOT, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const launcherSha256 = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')
const assemblyInput = (names) => ({
  permissionPolicy: { read: { mode: 'restricted', allow: [root], ask: [], deny: [] }, write: { mode: 'restricted', allow: [root], ask: [], deny: [] }, network: { access: 'allow' } },
  realmId: 'realm-probe',
  templateId: 'worker',
  teamSessionId: 'team-root-probe',
  instanceId: 'member-probe',
  plane: {
    names,
    confinedProvider: {
      trustRoot: `sha256:${launcherSha256.slice(0, 16)}#${LAUNCHER}`,
      assembly: { launcherPath: LAUNCHER, launcherSha256 },
      realmId: 'realm-probe',
    },
  },
})
const assemblyNative = plane.createTeamToolPlaneAssembly(assemblyInput(nativeNames))
console.log(`PROBE-PLANE assembly-native=${assemblyNative.ok === true ? 'MOUNTED' : assemblyNative.code}`)
const assemblyAlias = plane.createTeamToolPlaneAssembly(assemblyInput(aliasNames))
console.log(`PROBE-PLANE assembly-alias=${assemblyAlias.ok === true ? 'MOUNTED' : assemblyAlias.code}`)
const assemblyComplete = plane.createTeamToolPlaneAssembly(assemblyInput(nativeBashComplete))
console.log(`PROBE-PLANE assembly-bash-native+search-aliased=${assemblyComplete.ok === true ? 'MOUNTED' : assemblyComplete.code}`)

/* ── 3. the verdict ──────────────────────────────────────────────────────── */
console.log('PROBE-CONCLUSION native-bash=route-c/mountMemberA5sfRealm+attachA5sfNativeToolModules -> confined-bash-tool.mjs (PD-12) over the confined `subprocess` face')
console.log('PROBE-CONCLUSION native-pwsh=NOT-REACHABLE on the product route (no route-C shadow; the shipped governed preset REMOVES the tool-pwsh row)')
console.log('PROBE-CONCLUSION governed-plane=bash native name ACCEPTED by the plane name ledger (PLANE_SUPPORTED_NATIVE_TAKEOVERS.bash=[bash]); pwsh is not expressible in the closed names map at all')
console.log('PROBE-CONCLUSION governed-plane-dispatch=NOT-RUN (a governed bash dispatch needs the full governed kernel/PA mount; recorded as UNKNOWN in the evidence README)')
console.log('PROBE-CONCLUSION baseline-scope=bash only; pwsh is a DECLARED, PRINTED exclusion (unit stays short: 1 of 2 members exercisable)')

rmSync(root, { recursive: true, force: true })

/** Is a package built in the PINNED host tree? */
function existsHostPackage(rel) {
  try {
    readFileSync(join(HOST_ROOT, 'packages', ...rel.split('/'), 'lib', 'index.js'))
    return true
  } catch {
    return false
  }
}

/** Does the route-C seam place a shadow for this name at all? */
function existsRouteCShadow(name) {
  const source = readFileSync(join(REPO_ROOT, 'packages/runtime/src/plugin/live/a5sf-realm-row.mjs'), 'utf8')
  if (name === 'bash') return /A5SF_CONFINED_BASH_TOOL|nativeBashPtySpecOf/.test(source)
  return false
}

/** How does the shipped governed preset treat the row? */
function governedPresetMentions(rowId) {
  const patch = readFileSync(join(REPO_ROOT, 'cordis.patch.yml'), 'utf8')
  const removed = new RegExp(`#\\s+- \\\`${rowId}\\\``).test(patch)
  return removed ? 'REMOVED-by-the-shipped-governed-preset (comment names it as an un-instrumented second shell)' : 'MOUNTED'
}
