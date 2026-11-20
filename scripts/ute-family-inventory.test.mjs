#!/usr/bin/env node
/**
 * ute-family-inventory.test.mjs — the mutation suite for the UTE-3 inventory gate.
 *
 * Every refusal in `scripts/ute-family-inventory.mjs` exists because a real
 * drift is possible; a gate that cannot be made red is a gate that is not
 * looking. So this suite does not assert "it passes" only: it MUTATES the
 * committed ledger and the tracked-file universe and requires the named control
 * to fire. The final test prints the machine-readable count:
 *
 *   UTE-INVENTORY-MUTANTS total=<n> red=<n>
 *
 * `red < total` is a failed suite (the assertion in the summary test), so the
 * line can never be a hand-written pass.
 *
 * The real tree is the fixture: the ledger, the census, the retirement ledger and
 * the git index are the committed artifacts, and every mutation is applied to an
 * in-memory clone. Nothing under the repository is written by this suite.
 *
 * Run: node --test scripts/ute-family-inventory.test.mjs
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  CENSUS_REL,
  LEDGER_REL,
  RETIREMENT_LEDGER_REL,
  checkInventory,
  defaultTrackedPaths,
  scanImports,
  tokenizeJs,
} from './ute-family-inventory.mjs'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const LEDGER = JSON.parse(readFileSync(join(ROOT, LEDGER_REL), 'utf8'))
const CENSUS = JSON.parse(readFileSync(join(ROOT, CENSUS_REL), 'utf8'))
const RETIREMENT = JSON.parse(readFileSync(join(ROOT, RETIREMENT_LEDGER_REL), 'utf8'))
const TRACKED = defaultTrackedPaths(ROOT)

const fsFamily = (ledger = LEDGER) => ledger.families.find((f) => f.familyId === 'dsh.fs-family')

/** Grade an in-memory ledger clone. `mutate(ledger)` edits the clone. */
function run(mutate, { trackedPaths = TRACKED, fileExists = (abs) => existsSync(abs) } = {}) {
  const copy = structuredClone(LEDGER)
  if (mutate !== undefined) mutate(copy)
  return checkInventory({
    inventory: copy,
    census: CENSUS,
    retirement: RETIREMENT,
    root: ROOT,
    trackedPaths,
    fileExists,
  })
}

const codesOf = (result) => [...new Set(result.findings.map((f) => f.code))].sort()

// The mutation battery. `red` counts mutations whose NAMED control fired;
// `total` counts mutations attempted. Both are printed by the summary test.
let mutants = 0
let red = 0

function mutant(name, expectedCode, mutate, options) {
  mutants += 1
  const result = run(mutate, options)
  const hit = result.findings.some((f) => f.code === expectedCode)
  if (hit) red += 1
  assert.ok(
    hit,
    `${name}: expected ${expectedCode} to fire; got ${JSON.stringify(codesOf(result))} (${JSON.stringify(result.findings.map((f) => f.detail).slice(0, 3))})`,
  )
  return result
}

// ── 1. the committed inventory is clean ────────────────────────────────────
test('the committed inventory grades clean (9 families, no findings)', () => {
  const result = run()
  assert.deepEqual(result.findings, [])
  assert.equal(result.families.length, 9)
  assert.equal(result.universe, 92)
  assert.deepEqual(result.shared.length, 14)
  const fs = result.families.find((f) => f.familyId === 'dsh.fs-family')
  assert.deepEqual(fs.readiness, { baseline: 'complete', newPath: 'complete', negativeControls: 'complete' })
  const probe = result.families.find((f) => f.familyId === 'dsh.u6-probe-family')
  assert.equal(probe.testOnly, true)
  assert.deepEqual(probe.members, ['u6arc_probe'])
  // WEB (UTE-3 B1) is measured the same way FS/SEARCH are: its declared
  // readiness must equal the readiness the artifacts derive, on EVERY axis,
  // including the `newPath: none` it does not have. Asserting the DERIVED copy
  // too means a ledger edit cannot satisfy this arm alone.
  const web = result.families.find((f) => f.familyId === 'dsh.web-family')
  assert.deepEqual(web.members, ['web_fetch', 'web_search'])
  assert.deepEqual(web.readiness, { baseline: 'complete', newPath: 'none', negativeControls: 'complete' })
  assert.deepEqual(web.derivedReadiness, { baseline: 'complete', newPath: 'none', negativeControls: 'complete' })
})

// ── 2. census closure, both directions ─────────────────────────────────────
test('a census family missing from the inventory is INVENTORY_FAMILY_MISSING', () => {
  mutant('drop the web family', 'INVENTORY_FAMILY_MISSING', (ledger) => {
    ledger.families = ledger.families.filter((f) => f.familyId !== 'dsh.web-family')
  })
})

test('an inventory family the census does not book is INVENTORY_FAMILY_UNKNOWN', () => {
  mutant('invent a family', 'INVENTORY_FAMILY_UNKNOWN', (ledger) => {
    const clone = structuredClone(fsFamily(ledger))
    clone.familyId = 'dsh.invented-family'
    ledger.families.push(clone)
  })
})

// ── 3. members, lane, mount ────────────────────────────────────────────────
test('renaming a member is INVENTORY_MEMBER_DRIFT (the census is the unit)', () => {
  mutant('rename read_image to readImage', 'INVENTORY_MEMBER_DRIFT', (ledger) => {
    const fs = fsFamily(ledger)
    fs.members[3] = 'readImage'
  })
})

test('member ORDER is irrelevant (set equality, both directions)', () => {
  const result = run((ledger) => {
    const fs = fsFamily(ledger)
    fs.members.reverse()
    fs.definitions.reverse()
  })
  assert.deepEqual(result.findings, [], `reordering members/definitions must not be drift: ${JSON.stringify(codesOf(result))}`)
})

test('a lane that is not the census lane is INVENTORY_LANE_DRIFT', () => {
  mutant('move the fs lane', 'INVENTORY_LANE_DRIFT', (ledger) => {
    fsFamily(ledger).lane = 'packages/tools/not-fs'
  })
})

test('testOnly must agree with the census mount (INVENTORY_TESTONLY_DRIFT)', () => {
  mutant('call the probe lane product', 'INVENTORY_TESTONLY_DRIFT', (ledger) => {
    ledger.families.find((f) => f.familyId === 'dsh.u6-probe-family').testOnly = false
  })
})

// ── 4. definitions ─────────────────────────────────────────────────────────
test('a definition that is not a member is INVENTORY_DEFINITION_DRIFT', () => {
  mutant('rename the bash definition', 'INVENTORY_DEFINITION_DRIFT', (ledger) => {
    ledger.families.find((f) => f.familyId === 'dsh.process-family').definitions[0].name = 'shell'
  })
})

test('a bound-definition flag that contradicts the census is INVENTORY_DEFINITION_DRIFT', () => {
  mutant('unbind the fs read definition', 'INVENTORY_DEFINITION_DRIFT', (ledger) => {
    fsFamily(ledger).definitions[0].boundDefinition = false
  })
})

test('a declared symbol absent from its file is INVENTORY_DEFINITION_DRIFT', () => {
  mutant('invent a builder symbol', 'INVENTORY_DEFINITION_DRIFT', (ledger) => {
    fsFamily(ledger).definitions[0].symbol = 'buildTheRowOutOfThinAir'
  })
})

// ── 5. old-path files ──────────────────────────────────────────────────────
test('pointing at a deleted file is INVENTORY_PATH_MISSING', () => {
  mutant('declare a file that does not exist', 'INVENTORY_PATH_MISSING', (ledger) => {
    fsFamily(ledger).oldPath.files.push({ path: 'packages/tools/fs-family/src/deleted-in-a-ute4-pr.mjs', role: 'executor' })
  })
})

test('a declared file outside the git index is INVENTORY_PATH_UNTRACKED', () => {
  const declared = 'packages/tools/fs-family/src/edit-row.mjs'
  const withoutIt = new Set(TRACKED)
  withoutIt.delete(declared)
  mutant('drop a file from the tracked set', 'INVENTORY_PATH_UNTRACKED', undefined, { trackedPaths: withoutIt })
})

test('one file claimed by two families is INVENTORY_DUPLICATE_CLAIM', () => {
  mutant('give the fs family the bash row too', 'INVENTORY_DUPLICATE_CLAIM', (ledger) => {
    const processFamily = ledger.families.find((f) => f.familyId === 'dsh.process-family')
    const bashRow = processFamily.oldPath.files.find((f) => f.path.endsWith('bash-row.mjs'))
    fsFamily(ledger).oldPath.files.push(structuredClone(bashRow))
  })
})

// ── 6. the file universe (no silent orphan of the old path) ────────────────
test('an implementation file no family claims is INVENTORY_FILE_UNOWNED', () => {
  const orphan = 'packages/tools/fs-family/src/orphan-helper.mjs'
  const withOrphan = new Set(TRACKED)
  withOrphan.add(orphan)
  mutant('add an unclaimed lane file', 'INVENTORY_FILE_UNOWNED', undefined, { trackedPaths: withOrphan })
})

test('the SAME orphan is accepted when the ledger explicitly declares it shared (with a reason)', () => {
  const orphan = 'packages/tools/fs-family/src/orphan-helper.mjs'
  const withOrphan = new Set(TRACKED)
  withOrphan.add(orphan)
  const result = run((ledger) => {
    ledger.shared.push({ path: orphan, shared: true, reason: 'a genuinely shared helper, declared explicitly rather than silently ignored' })
  }, { trackedPaths: withOrphan, fileExists: (abs) => existsSync(abs) || abs.endsWith('orphan-helper.mjs') })
  assert.deepEqual(result.findings, [], `an explicit shared declaration must satisfy the universe rule: ${JSON.stringify(codesOf(result))}`)
  mutants += 1 // this is the negative of the previous mutant: the exemption is explicit, not silent
  red += 1
})

test('a shared declaration without a reason is INVENTORY_SHARED_UNREASONED', () => {
  mutant('declare shared with no reason', 'INVENTORY_SHARED_UNREASONED', (ledger) => {
    ledger.shared.push({ path: 'packages/runtime/tool-dispatch/install.ts', shared: true })
  })
})

// ── 7. dependencies, parsed both directions ────────────────────────────────
test('dropping a declared dependency that is still imported is INVENTORY_DEPENDENCY_UNDECLARED', () => {
  mutant('drop node:crypto from the fs dependsOn', 'INVENTORY_DEPENDENCY_UNDECLARED', (ledger) => {
    const fs = fsFamily(ledger)
    fs.dependsOn = fs.dependsOn.filter((s) => s !== 'node:crypto')
  })
})

test('a declared dependency no file imports is INVENTORY_DEPENDENCY_UNKNOWN', () => {
  mutant('declare an unused host package', 'INVENTORY_DEPENDENCY_UNKNOWN', (ledger) => {
    fsFamily(ledger).dependsOn.push('@deepseek-ai/dsh-not-imported')
  })
})

test('a cross-repo relative import that is dropped is INVENTORY_DEPENDENCY_UNDECLARED', () => {
  mutant('drop the controlled-fs import declaration', 'INVENTORY_DEPENDENCY_UNDECLARED', (ledger) => {
    const fs = fsFamily(ledger)
    fs.importsAcrossRepo = fs.importsAcrossRepo.filter((s) => !s.includes('controlled-fs'))
  })
})

// ── 8. runtime path ────────────────────────────────────────────────────────
test('a runtime step naming a nonexistent file is INVENTORY_RUNTIME_PATH_BROKEN', () => {
  mutant('invent an executor step', 'INVENTORY_RUNTIME_PATH_BROKEN', (ledger) => {
    const step = fsFamily(ledger).runtimePath.find((s) => s.step === 'executor')
    step.file = 'packages/tools/fs-family/src/imaginary-executor.mjs'
    delete step.shared
    delete step.owner
  })
})

test('an external step that also names a repo file is INVENTORY_RUNTIME_PATH_BROKEN', () => {
  mutant('fabricate a file for the host step', 'INVENTORY_RUNTIME_PATH_BROKEN', (ledger) => {
    const step = fsFamily(ledger).runtimePath.find((s) => s.external === true)
    step.file = 'packages/runtime/src/plugin/live/team-tool-plane.mjs'
  })
})

test('a cross-family step that names the wrong owner is INVENTORY_RUNTIME_PATH_BROKEN', () => {
  mutant('mis-own the inspect port step', 'INVENTORY_RUNTIME_PATH_BROKEN', (ledger) => {
    const step = ledger.families.find((f) => f.familyId === 'dsh.inspect-family').runtimePath.find((s) => s.owner !== undefined)
    step.owner = 'dsh.process-family'
  })
})

// ── 9. authority ───────────────────────────────────────────────────────────
test('a product family whose authority omits ControlService is INVENTORY_AUTHORITY_INVALID', () => {
  mutant('drop ControlService from the process family', 'INVENTORY_AUTHORITY_INVALID', (ledger) => {
    const processFamily = ledger.families.find((f) => f.familyId === 'dsh.process-family')
    processFamily.authority.enforcedBy = ['governance-center kernel']
  })
})

test('authority UNKNOWN with invented files is INVENTORY_AUTHORITY_INVALID', () => {
  mutant('say UNKNOWN and keep the files', 'INVENTORY_AUTHORITY_INVALID', (ledger) => {
    const web = ledger.families.find((f) => f.familyId === 'dsh.web-family')
    web.authority.enforcedBy = ['UNKNOWN']
    web.authority.note = 'not visible on this tree'
  })
})

// ── 10. native path + roles ────────────────────────────────────────────────
test('nativePath none with files is INVENTORY_NATIVE_DRIFT', () => {
  mutant('claim native files with status none', 'INVENTORY_NATIVE_DRIFT', (ledger) => {
    const web = ledger.families.find((f) => f.familyId === 'dsh.web-family')
    web.nativePath = { status: 'none', files: ['packages/tools/src/native-fs-binding.ts'], note: 'wish' }
  })
})

test('a role outside the closed set is INVENTORY_ROLE_UNKNOWN', () => {
  mutant('invent a presentation role', 'INVENTORY_ROLE_UNKNOWN', (ledger) => {
    fsFamily(ledger).oldPath.files.find((f) => f.path.endsWith('read-presentation.mjs')).role = 'presentation'
  })
})

// ── 11. readiness is measured, not declared ────────────────────────────────
test('declaring a readiness the evidence does not support is INVENTORY_READINESS_DRIFT', () => {
  // The merged ledger derives `complete` for the FS baseline; declaring the
  // older `partial` is exactly the hand-edit this control exists to catch.
  mutant('hand-edit the fs baseline back to partial', 'INVENTORY_READINESS_DRIFT', (ledger) => {
    fsFamily(ledger).retirementReadiness.baseline = 'partial'
  })
})

test('the web baseline readiness is measured too (INVENTORY_READINESS_DRIFT)', () => {
  // A green SEARCH/FS row must not be able to carry a hand-written WEB row: the
  // WEB baseline becomes `complete` only because tests/ute-g1-web/golden/old-path.tsv
  // is a committed baseline whose `entry` column covers both members. Claiming
  // it BEFORE the evidence exists is the drift this control pins.
  mutant('hand-edit the web baseline to partial', 'INVENTORY_READINESS_DRIFT', (ledger) => {
    ledger.families.find((f) => f.familyId === 'dsh.web-family').retirementReadiness.baseline = 'partial'
  })
  mutant('claim a web new path that does not exist', 'INVENTORY_READINESS_DRIFT', (ledger) => {
    ledger.families.find((f) => f.familyId === 'dsh.web-family').retirementReadiness.newPath = 'complete'
  })
})

test('the retirement ledger may not name a file the inventory disowns (INVENTORY_RETIREMENT_PATH_DRIFT)', () => {
  mutant('drop a retirement old-path file from the inventory', 'INVENTORY_RETIREMENT_PATH_DRIFT', (ledger) => {
    const fs = fsFamily(ledger)
    fs.oldPath.files = fs.oldPath.files.filter((f) => !f.path.endsWith('write-row.mjs'))
  })
})

// ── 12. the parser cannot be fooled by strings/comments/templates ──────────
test('imports are tokenized: comments, strings and templates cannot fake one', () => {
  const text = [
    "// import fake from 'comment-fake'",
    "/* import fake2 from 'block-fake' */",
    "const s = \"import fake3 from 'string-fake'\"",
    "const t = `import fake4 from 'template-fake'`",
    'const rx = /[\'"]/g',
    "export { thing } from './real-export.mjs'",
    "import real from 'node:fs'",
    "const dyn = await import('./real-dynamic.mjs')",
    "const req = require('node:path')",
  ].join('\n')
  const specs = scanImports(text)
  assert.deepEqual(specs.sort(), ['./real-dynamic.mjs', './real-export.mjs', 'node:fs', 'node:path'])
  assert.ok(tokenizeJs(text).some((t) => t.t === 'str' && t.v === 'node:fs'))
})

test('the C2 probe lane\'s URL-based public seams are read as imports', () => {
  const contribution = scanImports(readFileSync(join(ROOT, 'tests/u6-arc-a-probe-family/src/probe-contribution.mjs'), 'utf8'))
  const assembly = scanImports(readFileSync(join(ROOT, 'tests/u6-arc-a-probe-family/src/probe-assembly.mjs'), 'utf8'))
  assert.ok(contribution.includes('../../../packages/contracts/src/index.js'), JSON.stringify(contribution))
  assert.ok(assembly.includes('../../../packages/runtime/governance-center/index.js'), JSON.stringify(assembly))
})

// ── 13. CLI: exit codes + --json, and the required-leg wiring ───────────────
test('CLI: exit 0 on the committed ledger and a parseable --json verdict', () => {
  const script = join(ROOT, 'scripts/ute-family-inventory.mjs')
  const plain = spawnSync(process.execPath, [script], { cwd: ROOT, encoding: 'utf8' })
  assert.equal(plain.status, 0, plain.stderr)
  assert.match(plain.stdout, /UTE-FAMILY-INVENTORY-SUMMARY families=9 files=92 findings=0/)
  const json = spawnSync(process.execPath, [script, '--json'], { cwd: ROOT, encoding: 'utf8' })
  assert.equal(json.status, 0, json.stderr)
  const payload = JSON.parse(json.stdout)
  assert.equal(payload.schema, 'ute-family-inventory-verdict/1')
  assert.equal(payload.summary.families, 9)
  assert.equal(payload.summary.findings, 0)
})

test('CLI: a mutated ledger exits 1 with the named finding', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ute3-inventory-'))
  const mutated = structuredClone(LEDGER)
  mutated.families[0].members[0] = 'renamed-member'
  const file = join(dir, 'mutated-ledger.json')
  writeFileSync(file, JSON.stringify(mutated))
  const out = spawnSync(process.execPath, [join(ROOT, 'scripts/ute-family-inventory.mjs'), '--ledger', file], { cwd: ROOT, encoding: 'utf8' })
  assert.equal(out.status, 1, out.stderr)
  assert.match(out.stdout, /INVENTORY_MEMBER_DRIFT/)
  mutants += 1
  if (out.status === 1 && /INVENTORY_MEMBER_DRIFT/.test(out.stdout)) red += 1
})

test('CLI: a schema error exits 2 (cannot grade is not a pass)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'ute3-inventory-'))
  const file = join(dir, 'bad-schema.json')
  writeFileSync(file, JSON.stringify({ schema: 'something-else/9', families: [] }))
  const out = spawnSync(process.execPath, [join(ROOT, 'scripts/ute-family-inventory.mjs'), '--ledger', file], { cwd: ROOT, encoding: 'utf8' })
  assert.equal(out.status, 2, out.stdout + out.stderr)
  assert.match(out.stderr, /INVENTORY_SCHEMA/)
})

test('the required CI leg invokes the inventory (no new workflow line, no new manifest leg)', async () => {
  const { checkInventoryArm } = await import('./eb3-family-definitions.mjs')
  const arm = checkInventoryArm({ root: ROOT, trackedPaths: TRACKED })
  assert.equal(arm.findings.length, 0, JSON.stringify(arm.findings))
  assert.equal(arm.families.length, 9)
  assert.ok(arm.families.includes('dsh.fs-family'))
  const leg = spawnSync(process.execPath, [join(ROOT, 'scripts/eb3-family-definitions.mjs')], { cwd: ROOT, encoding: 'utf8' })
  assert.equal(leg.status, 0, leg.stderr)
  assert.match(leg.stdout, /EB3-FAMILY-DEFINITIONS pass files=\d+ findings=0/)
})

// ── 14. the mutation count is printed by the suite, never hand-written ─────
test('UTE-INVENTORY-MUTANTS summary', () => {
  // The count is printed, never asserted by hand: `red < total` fails above.
  console.log(`UTE-INVENTORY-MUTANTS total=${String(mutants)} red=${String(red)}`)
  assert.ok(mutants >= 6, `the battery must contain at least six real mutations, has ${String(mutants)}`)
  assert.equal(red, mutants, `${String(mutants - red)} mutation(s) did not turn their named control red`)
})
