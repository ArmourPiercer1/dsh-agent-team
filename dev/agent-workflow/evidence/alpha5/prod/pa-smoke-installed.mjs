#!/usr/bin/env node
/**
 * pa-smoke-installed.mjs — INSTALLED-FORM self-test (PR2/PR3 production-
 * assembly round, P-A writer; the CHECKLIST row "安装包态自测").
 *
 * WHAT IT PINS that lane tests cannot: the production classes are consumable
 * in the exact shape the evidence kits consume — a plain ESM `import` of the
 * COMPILED artifacts (file-URL, no lane tsconfig, no bundler). If this file
 * runs, GLUE-5's kit rewire (pa-CONTRACT §6) has an importable target.
 *
 * The compiled tree is produced by:
 *   npx tsc -p packages/runtime/tsconfig.build.json --outDir <root>
 * with <root> OUTSIDE the committed dist (this round: tests/homes/.pa-smoke/
 * out — gitignored scratch; the committed packages/runtime/dist is NEVER
 * written; dist regeneration is the GLUE single-writer's act).
 *
 * usage: node dev/agent-workflow/evidence/alpha5/prod/pa-smoke-installed.mjs <compiled-out-root>
 * exit 0 ⇔ every criterion PASSes. Real FS world under tests/homes/ (TEST_
 * METHODS §7 naming), destroyed in the final block.
 */
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..', '..', '..', '..')
const OUT = resolve(process.argv[2] ?? join(REPO, 'tests', 'homes', '.pa-smoke', 'out'))

const results = []
const ok = (name, cond) => {
  results.push([name, cond === true])
  console.log(`${cond === true ? 'PASS' : 'FAIL'}: ${name}`)
}

// ── 1. installed-form imports (the kit consumption shape) ──────────────────
const ta = await import(pathToFileURL(join(OUT, 'packages/runtime/tool-admission/index.js')).href)
const cf = await import(pathToFileURL(join(OUT, 'packages/runtime/controlled-fs/src/index.js')).href)
const tg = await import(pathToFileURL(join(OUT, 'packages/domain/tool-governance/src/index.js')).href)

ok('import compiled tool-admission barrel — production entry present',
  typeof ta.createProductionAdmissionAssembly === 'function' && typeof ta.deriveTeamPolicyAuthority === 'function')
ok('import compiled controlled-fs barrel — production provider present, law-4 pin intact',
  typeof cf.createProductionControlledFsProvider === 'function' && cf.ARBITRARY_TREE_PROFILE_PUBLISHED === false)

// ── 2. a real fixture world (TEST_METHODS §7: tests/homes/<world>, deleted) ─
const stamp = `${new Date().toISOString().slice(0, 19).replace(/[:]/g, '-')}Z-${createHash('sha256').update(`${Date.now()}:${Math.random()}`).digest('hex').slice(0, 6)}`
const world = join(REPO, 'tests', 'homes', `a5pa-smoke-${stamp}`)
let failed = false
try {
  const ctrl = join(world, 'controlled')
  mkdirSync(join(ctrl, 'public'), { recursive: true })
  mkdirSync(join(ctrl, 'out'), { recursive: true })
  const aFile = join(ctrl, 'public', 'a.txt')
  const writeTarget = join(ctrl, 'out', 'new.txt')
  const unnamed = join(ctrl, 'public', 'b.txt')
  writeFileSync(aFile, 'A-CONTENT\n')

  // ── 3. REAL authorization input: the template capabilities.permissions form ─
  const permissionPolicy = {
    default: 'deny', // deny-until-named — the template form the glue reads off boundTemplate
    allow: [
      { tool: 'read', resource: { kind: 'exact', path: aFile } },
      { tool: 'write', resource: { kind: 'exact', path: writeTarget } },
    ],
    ask: [],
    deny: [],
  }
  const built = ta.createProductionAdmissionAssembly({
    permissionPolicy,
    realmId: 'realm-1',
    templateId: 'tpl-smoke',
    definitionOwnerAuthority: 'human-user',
    role: 'member',
    clock: () => Date.now(),
    authorityGeneration: () => 1,
    beneficiaryAuthority: 'member',
  })
  ok('production assembly constructs from the template policy object', built.ok === true)
  if (!built.ok) {
    console.log('construction error:', JSON.stringify(built.error))
    throw new Error('assembly refused')
  }
  const assembly = built.value
  ok('projection notes empty (every rule carried)', assembly.projectionNotes.length === 0)

  // effect + binding fixtures THROUGH the compiled frozen parsers:
  const member = { teamSessionId: 'ts-smoke', instanceId: 'inst-1' }
  const mkEffects = (tool, kind, locator) => {
    const parsed = tg.parseRequestedEffectSet([
      { kind: 'tool-invoke', toolName: tool, resource: null },
      { kind, resource: { realmId: 'realm-1', kind: 'absolute-path', canonicalLocator: locator, rights: kind === 'read' ? ['read'] : ['write'] } },
    ])
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.problems))
    return parsed.value
  }
  const dims = ['content-read', 'directory-metadata', 'write', 'alias', 'network-destination', 'inherit-cancel']
  const assurance = { implementationOrigin: 'team-trusted-extension', executionBoundary: 'confined-subprocess', assurance: {} }
  for (const d of dims) assurance.assurance[d] = { level: 'untested', mechanism: null, realmId: 'realm-1', trustRoot: null, evidence: null }
  const mkBinding = (tool) => {
    const parsed = tg.parseToolBinding({
      bindingId: `bind-${tool}-smoke`, agentScopeKey: 'ts-smoke', toolName: tool, definitionIdentity: `def:${tool}`,
      providerId: 'team-adapter', implementationOrigin: assurance.implementationOrigin, executionBoundary: assurance.executionBoundary,
      assurance, policyGeneration: 1, authorityGeneration: 1, revision: 1, status: 'ACTIVE',
    })
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.problems))
    return parsed.value
  }
  const FP = 'sha256:' + 'f'.repeat(64)

  const provider = cf.createProductionControlledFsProvider({
    realmId: 'realm-1',
    instances: [{ fs: 'ctl', rootDir: ctrl, realmId: 'realm-1', kind: 'absolute-path' }],
    clock: () => Date.now(),
    authorityGeneration: () => 1,
    consumed: assembly.consumed,
  })
  const mkRef = (locator, rights) => {
    const parsed = tg.parseResourceRef({ realmId: 'realm-1', kind: 'absolute-path', canonicalLocator: locator, rights })
    if (!parsed.ok) throw new Error(JSON.stringify(parsed.problems))
    return parsed.value
  }

  // ── 4. the kit sequence on compiled classes: admit → port → gate → real read ─
  const readRequest = { binding: mkBinding('read'), member, callId: 'smoke-read-1', realmId: 'realm-1', parametersFingerprint: FP, requestedEffects: mkEffects('read', 'read', aFile) }
  const readDecision = await assembly.admitCall(readRequest)
  ok('admitCall admits the template-named read', readDecision.ok === true && readDecision.value.kind === 'admitted')
  const grant = readDecision.value.grant
  const lane = provider.gateCall({ admission: assembly.createFsAdmissionPort(readRequest, grant), parametersFingerprint: grant.parametersFingerprint })
  const readRes = await lane.fs.readText(grant, mkRef(aFile, ['read']), { offset: 0, limit: null })
  ok('gated lane reads REAL bytes through the compiled law chain', readRes.ok === true && readRes.value.text === 'A-CONTENT\n')
  ok('one-shot: the FS op spent the grant (assembly.consumed view)', assembly.consumed(grant.grantId) === true)
  const replay = await lane.fs.readText(grant, mkRef(aFile, ['read']), { offset: 0, limit: null })
  ok('one-shot replay refused (grant-consumed at the lane revalidate)', replay.ok === false && replay.error?.details?.cfReason === 'grant-consumed')

  // ── 5. default-deny gate + named write ─
  const unnamedRequest = { binding: mkBinding('write'), member, callId: 'smoke-deny-1', realmId: 'realm-1', parametersFingerprint: FP, requestedEffects: mkEffects('write', 'write', unnamed) }
  const denyDecision = await assembly.admitCall(unnamedRequest)
  ok('default:deny gates an unnamed effect BEFORE the kernel (typed, zero side effects)',
    denyDecision.ok === true && denyDecision.value.kind === 'denied' && denyDecision.value.error?.details?.refusal === 'template-default-deny')
  const writeRequest = { binding: mkBinding('write'), member, callId: 'smoke-write-1', realmId: 'realm-1', parametersFingerprint: FP, requestedEffects: mkEffects('write', 'write', writeTarget) }
  const writeDecision = await assembly.admitCall(writeRequest)
  ok('template-named write is admitted', writeDecision.ok === true && writeDecision.value.kind === 'admitted')
  const wgrant = writeDecision.value.grant
  const wlane = provider.gateCall({ admission: assembly.createFsAdmissionPort(writeRequest, wgrant), parametersFingerprint: wgrant.parametersFingerprint })
  const writeRes = await wlane.fs.writeText(wgrant, mkRef(writeTarget, ['write']), 'SMOKE-BYTES\n')
  ok('template-named write lands real bytes under the gate',
    writeRes.ok === true && readFileSync(writeTarget, 'utf8') === 'SMOKE-BYTES\n')

  // ── 6. derivation is exported and pure in installed form (fixture-arms replacement) ─
  const proj = ta.deriveTeamPolicyAuthority({
    permissionPolicy: { default: 'ask', allow: [{ tool: 'read', resource: { kind: 'exact', path: '/x' } }], ask: [], deny: [] },
    realmId: 'realm-1', templateId: 'tpl-x', definitionOwnerAuthority: 'human-user', role: 'member', sourceVersion: () => 1,
  })
  ok('deriveTeamPolicyAuthority usable standalone in installed form',
    proj.ok === true && proj.value.buildDocument().rules.length === 3)
} catch (error) {
  failed = true
  console.error('SMOKE CRASHED:', error)
} finally {
  rmSync(world, { recursive: true, force: true })
  console.log(`world teardown: ${world} ${existsSync(world) ? 'FAILED' : 'removed'}`)
}
const passed = results.filter(([, c]) => c).length
console.log(`CRITERIA ${passed}/${results.length} PASS${failed ? ' (+crash)' : ''}`)
process.exit(failed || passed !== results.length ? 1 : 0)
