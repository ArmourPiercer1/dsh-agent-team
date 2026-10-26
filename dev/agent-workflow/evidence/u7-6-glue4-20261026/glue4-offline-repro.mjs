/**
 * glue4-offline-repro.mjs — U7-6 forensics (no Host boot): WHICH leg refuses a
 * governed search call on the production plane's PA edge, and which leg admits
 * the read/bash rows. Drives the SAME compiled dist faces the live mount loads
 * (packages/runtime/dist), with the plane's own wiring shape
 * (createProductionAdmissionAssembly, no requiredAssurance/assuranceProbe
 * injected — team-tool-plane.mjs:792-815 states exactly these fields).
 *
 * Legs:
 *  R1  arc-a CURRENT template (default deny, no rules) + team_grep effect set
 *  R2  run8 template (read ANY allow) + team_grep effect set
 *  R3  least-privilege template (read SUBTREE allow at the governed root) + grep
 *  R4  R3 + glob
 *  R5  R3 + the READ row's canonical effect set (regression: read still admissible)
 *  R6  bash ASK template + the bash row's effect set (regression: ask-lane)
 *  R7  R3 + grep with path /etc (the refusal leg's effect shape)
 * Print the decision kind, code, refusal tag, and the FIRST uncovered arm.
 */
import { pathToFileURL } from 'node:url'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = join(here, '..', '..', '..', '..')
const dist = join(repoRoot, 'packages', 'runtime', 'dist', 'packages')
const D = (p) => pathToFileURL(join(dist, p)).href

const { createProductionAdmissionAssembly } = await import(D('runtime/tool-admission/index.js'))
const { parseToolBinding, parseRequestedEffectSet } = await import(D('domain/tool-governance/src/index.js'))
const { parseGrepArgs, parseGlobArgs } = await import(D('tools/a5p5-tools/src/args.js'))
const { deriveToolEffectSet } = await import(D('tools/a5p5-tools/src/effects-schema.js'))
const { untestedAssurance } = await import(D('runtime/tool-dispatch/index.js'))

const REALM = 'glue4-realm'
const ROOT = '/srv/workspace/GLUE4/workspace'

const subtreeContains = (declared, observed) =>
  observed === declared || observed.startsWith(`${declared.replace(/\/+$/, '')}/`)

function bindingFor(toolName) {
  const parsed = parseToolBinding({
    bindingId: `plane-row:glue4:${toolName}`,
    agentScopeKey: 'plane:glue4',
    toolName,
    definitionIdentity: `plane:glue4:${toolName}`,
    providerId: 'a5p5-plane',
    implementationOrigin: 'team-trusted-extension',
    executionBoundary: 'confined-subprocess',
    assurance: untestedAssurance('team-trusted-extension', 'confined-subprocess', REALM),
    policyGeneration: 0,
    authorityGeneration: 0,
    revision: 1,
    status: 'ACTIVE',
  })
  if (!parsed.ok) throw new Error(`binding refused: ${JSON.stringify(parsed.problems)}`)
  return parsed.value
}

function assemblyFor(permissionPolicy, role = 'member') {
  const built = createProductionAdmissionAssembly({
    permissionPolicy,
    realmId: REALM,
    templateId: 'glue4-tpl',
    role,
    definitionOwnerAuthority: 'human-user',
    clock: () => Date.now(),
    authorityGeneration: () => 0,
    beneficiaryAuthority: role === 'leader' ? 'leader' : 'member',
    subtreeContains,
    onObserve: () => {},
  })
  if (built.ok !== true) throw new Error(`assembly refused: ${built.error.message}`)
  return built.value
}

function effectsOf(parsedArgs) {
  const d = deriveToolEffectSet(REALM, parsedArgs)
  if (!d.ok) throw new Error(`derive refused: ${JSON.stringify(d.problems)}`)
  return d.value
}

async function leg(name, { permissionPolicy, role, toolName, parsedArgs, memberEffects }) {
  const assembly = assemblyFor(permissionPolicy, role ?? 'member')
  const requestedEffects = memberEffects ?? effectsOf(parsedArgs)
  const request = {
    binding: bindingFor(toolName),
    member: { teamSessionId: 'session-glue4-team', instanceId: 'glue4-inst' },
    callId: `call-${name}`,
    realmId: REALM,
    parametersFingerprint: 'sha256:' + 'a'.repeat(64),
    requestedEffects,
  }
  const admitted = await assembly.admitCall(request)
  const arms = requestedEffects.effects.map((e) => e.kind === 'tool-invoke' ? `tool-invoke(${e.toolName})` : `${e.kind}(${e.resource?.canonicalLocator ?? ''})`)
  if (admitted.ok !== true) {
    console.log(`${name}: REFUSED error code=${admitted.error.code} refusal=${admitted.error.details?.refusal ?? '-'} :: ${admitted.error.message.slice(0, 220)}`)
  } else {
    const d = admitted.value
    if (d.kind === 'denied') {
      console.log(`${name}: denied code=${d.error.code} refusal=${d.error.details?.refusal ?? '-'} effectIndex=${String(d.error.details?.effectIndex ?? '-')} :: ${d.error.message.slice(0, 260)}`)
    } else {
      console.log(`${name}: ${d.kind}${d.kind === 'requires-approval' ? ` :: ${d.reason.slice(0, 200)}` : ''}`)
    }
  }
  console.log(`  arms: ${arms.join(', ')}`)
}

const T_EMPTY = { default: 'deny', allow: [], ask: [], deny: [] }
const T_READ_ANY = { default: 'deny', allow: [{ tool: 'read', resource: { kind: 'any' } }], ask: [], deny: [] }
const T_READ_SUBTREE = { default: 'deny', allow: [{ tool: 'read', resource: { kind: 'subtree', path: ROOT } }], ask: [], deny: [] }
const T_BASH_ASK = { default: 'deny', allow: [], ask: [{ tool: 'bash', resource: { kind: 'any' } }], deny: [] }

const grepIn = parseGrepArgs({ pattern: 'GLUE4_CLAIM', path: `${ROOT}/notes`, output_mode: 'content' })
const grepEtc = parseGrepArgs({ pattern: 'GLUE4_CLAIM', path: '/etc', output_mode: 'content' })
const globIn = parseGlobArgs({ pattern: '**/*.txt', path: ROOT })
if (!grepIn.ok || !grepEtc.ok || !globIn.ok) throw new Error('probe args refused by the parser')

await leg('R1 empty-template grep', { permissionPolicy: T_EMPTY, toolName: 'grep', parsedArgs: grepIn.value })
await leg('R2 read-any grep', { permissionPolicy: T_READ_ANY, toolName: 'grep', parsedArgs: grepIn.value })
await leg('R3 read-subtree grep', { permissionPolicy: T_READ_SUBTREE, toolName: 'grep', parsedArgs: grepIn.value })
await leg('R4 read-subtree glob', { permissionPolicy: T_READ_SUBTREE, toolName: 'glob', parsedArgs: globIn.value })

// R5: the READ row's canonical effect set (fs-family read-executor:216 shape)
const readEffects = parseRequestedEffectSet([
  { kind: 'tool-invoke', toolName: 'read', resource: null },
  { kind: 'read', resource: { realmId: REALM, kind: 'absolute-path', canonicalLocator: `${ROOT}/notes/a.txt`, rights: ['read'] } },
])
await leg('R5 read-subtree READ-row', {
  permissionPolicy: T_READ_SUBTREE, toolName: 'read',
  memberEffects: readEffects.ok ? readEffects.value : (() => { throw new Error(JSON.stringify(readEffects.problems)) })(),
})

// R6: the BASH row's effect set (tool-invoke(bash) only) against a bash ASK rule
const bashEffects = parseRequestedEffectSet([{ kind: 'tool-invoke', toolName: 'bash', resource: null }])
await leg('R6 bash-ask BASH-row', {
  permissionPolicy: T_BASH_ASK, toolName: 'bash',
  memberEffects: bashEffects.ok ? bashEffects.value : (() => { throw new Error(JSON.stringify(bashEffects.problems)) })(),
})

await leg('R7 read-subtree grep /etc', { permissionPolicy: T_READ_SUBTREE, toolName: 'grep', parsedArgs: grepEtc.value })
