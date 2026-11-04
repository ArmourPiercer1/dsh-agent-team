#!/usr/bin/env node
/**
 * negative-controls.mjs — prove that each of the three post-live oracle
 * corrections is LOAD-BEARING, by re-introducing the defect it repairs and
 * watching the oracle suite go red.
 *
 *   node dev/agent-workflow/evidence/a5sf-preflight/negative-controls.mjs
 *
 * WHY MUTATION AND NOT INSPECTION. A test that passes is not evidence that the
 * clause it pins exists: the first live run passed 25/25 oracle tests while the
 * oracle was asking three wrong questions. The only cheap, host-free proof is to
 * break the corrected clause the way the defect broke it and require the named
 * test to FAIL. Every control here is a SOURCE MUTATION that would have been a
 * plausible "fix" if the live FACT had not been read first:
 *
 *   NC1  row 2 filters facts to `method === 'readText'` again (the live stream
 *        then carries ZERO read-path facts for B, because a refused read is
 *        recorded at `stat`)                          -> C9 must fail;
 *   NC2a row 4a ignores a write fact on the read lane    -> C14 must fail;
 *   NC2b row 4b accepts ANY refusal instead of the read-coupling sentence
 *        (the live row-4 text WAS an error — a host sandbox denial)  -> C14;
 *   NC3a row 6 drops the temporal clause (back to "always true")     -> C15;
 *   NC3b row 6 stops requiring a parseable `observedAt`              -> C15;
 *   NC4  the write-method partition loses `editText`                 -> C16.
 *
 * SAFETY. The library is backed up byte-for-byte BEFORE the first mutation, a
 * stale backup from a crashed run is restored at START, and the original bytes
 * are restored after EVERY control with a sha256 verification. The script never
 * boots a Host, never touches `packages/**`, and refuses to leave the tree
 * mutated (exit code 2 if the final hash differs).
 *
 * @module dev/agent-workflow/evidence/a5sf-preflight/negative-controls
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..', '..', '..')
const LIB = join(REPO_ROOT, 'tests', 'world-factory', 'lib', 'a5sf-acceptance-preflight.mjs')
const SUITE = join(REPO_ROOT, 'tests', 'world-factory', 'a5sf-acceptance-preflight.test.mjs')
const BACKUP = join(HERE, '.negative-controls-lib.bak')
const LOG_LINES = []

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`
  // eslint-disable-next-line no-console
  console.log(line)
  LOG_LINES.push(line)
}
const sha256 = (buffer) => createHash('sha256').update(buffer).digest('hex')
const originalBytes = existsSync(BACKUP) ? readFileSync(BACKUP) : readFileSync(LIB)
const originalSha = sha256(originalBytes)

// A crash in a previous run must not leave the library mutated.
if (existsSync(BACKUP)) {
  writeFileSync(LIB, originalBytes)
  log(`restored a stale backup from a previous run (sha256=${originalSha})`)
}
if (sha256(readFileSync(LIB)) !== originalSha) {
  log(`FATAL: the library already differs from the backup (${sha256(readFileSync(LIB))} != ${originalSha})`)
  process.exitCode = 2
  throw new Error('refusing to mutate a library that differs from its last backup')
}
copyFileSync(LIB, BACKUP)
log(`backup written: ${relative(REPO_ROOT, BACKUP)} sha256=${originalSha}`)

/** Each control: an exact source edit, and the test names it MUST break. */
const CONTROLS = [
  {
    id: 'NC1-row2-readtext-only-filter',
    fix: 'correction 1 (read-PATH decision, not a readText count)',
    find: "  const readPathFacts = list.filter((fact) => isReadPathConsultation(fact))",
    replace: "  const readPathFacts = list.filter((fact) => String(fact?.method ?? '') === 'readText')",
    expectFailing: ['C9'],
    why: 'the live B stream has NO readText fact (the deny is at `stat`), so this filter silently counts zero and refutes a correct refusal',
  },
  {
    id: 'NC2a-row4a-accepts-any-write-fact',
    fix: 'correction 2 (4a: an allowed write must not cross channels)',
    find: '    everyWriteFactOnCeiling: writeFacts.length > 0 && ceilingFacts.length === writeFacts.length,',
    replace: '    everyWriteFactOnCeiling: writeFacts.length > 0,',
    expectFailing: ['C14'],
    why: 'a write-allow laundered onto the read lane would be credited as a clean 4a as soon as ANY write fact exists',
  },
  {
    id: 'NC2c-row4b-accepts-a-laundered-read-lane-allow',
    fix: 'correction 2 (4b: the refusal must not be laundered into the read lane)',
    find: '    noReadLaneWriteAllow: readLaneWriteAllowFacts.length === 0,',
    replace: '    noReadLaneWriteAllow: true,',
    expectFailing: ['C14'],
    why: 'a write-allow on the binding (read) realm is the one channel crossing 4b must refuse',
  },
  {
    id: 'NC2b-row4b-accepts-any-refusal',
    fix: 'correction 2 (4b: the refusal must BE the read coupling)',
    find: '    typedReadCouplingRefusal: IO_WRITE_REQUIRES_READ_PROSE.test(text),',
    replace: '    typedReadCouplingRefusal: true,',
    expectFailing: ['C14'],
    why: 'the live row-4 text WAS an error (host sandbox denial under the old root); only the write⇐read sentence makes it the asked question',
  },
  {
    id: 'NC3a-row6-drops-the-temporal-clause',
    fix: 'correction 3 (no fact AFTER the stop instant)',
    find: '    noFactAfterStop: afterStop.length === 0,',
    replace: '    noFactAfterStop: true,',
    expectFailing: ['C15'],
    why: 'with the clause always true, one injected fact with a later observedAt still PROVES',
  },
  {
    id: 'NC3b-row6-accepts-an-undated-fact',
    fix: 'correction 3 (fail-closed on an unparseable observedAt)',
    find: '    factsAreTimestamped: undated.length === 0,',
    replace: '    factsAreTimestamped: true,',
    expectFailing: ['C15'],
    why: 'a fact that cannot be shown to precede the stop must refute, not slip past the bound',
  },
  {
    id: 'NC4-write-partition-loses-editText',
    fix: 'the read/write partition equals the product WRITE_METHODS',
    find: "export const WRITE_PATH_METHODS = Object.freeze(['writeText', 'editText'])",
    replace: "export const WRITE_PATH_METHODS = Object.freeze(['writeText'])",
    expectFailing: ['C16'],
    why: 'editText would be miscounted as a read-path consultation (and the partition would silently drift from fs.ts)',
  },
]

function runSuite() {
  const started = Date.now()
  const result = spawnSync(process.execPath, ['--test', SUITE], { cwd: REPO_ROOT, encoding: 'utf8', timeout: 300_000 })
  const text = `${result.stdout ?? ''}\n${result.stderr ?? ''}`
  const failing = [...text.matchAll(/^✖ (.+?) \(/gm)].map((m) => m[1])
  const pass = Number(/(?:#|ℹ) pass (\d+)/.exec(text)?.[1] ?? NaN)
  const fail = Number(/(?:#|ℹ) fail (\d+)/.exec(text)?.[1] ?? NaN)
  return { status: result.status, ms: Date.now() - started, failing, pass, fail, tail: text.split('\n').slice(-12).join('\n') }
}

const controls = []
let ok = true
for (const control of CONTROLS) {
  const before = readFileSync(LIB, 'utf8')
  if (!before.includes(control.find)) {
    ok = false
    controls.push({ ...control, applied: false, error: 'the anchor text was not found in the library (the correction may have been renamed)' })
    log(`CONTROL BROKEN ${control.id}: anchor not found`)
    continue
  }
  const mutated = before.replace(control.find, control.replace)
  writeFileSync(LIB, mutated)
  log(`control ${control.id}: applied (${control.why})`)
  const suite = runSuite()
  writeFileSync(LIB, originalBytes)
  const restoredSha = sha256(readFileSync(LIB))
  const expectedBroken = control.expectFailing.every((id) => suite.failing.some((name) => name.startsWith(id)))
  const behaved = suite.status !== 0 && expectedBroken && restoredSha === originalSha
  if (!behaved) ok = false
  const entry = {
    id: control.id,
    fix: control.fix,
    why: control.why,
    mutation: { find: control.find, replace: control.replace },
    suiteStatus: suite.status,
    suitePass: suite.pass,
    suiteFail: suite.fail,
    failingTests: suite.failing,
    expectFailing: control.expectFailing,
    expectedTestFailed: expectedBroken,
    restoredSha256: restoredSha,
    restoredVerbatim: restoredSha === originalSha,
    behaved,
  }
  controls.push(entry)
  log(`control ${control.id}: suite status=${String(suite.status)} pass=${String(suite.pass)} fail=${String(suite.fail)} failing=${JSON.stringify(suite.failing)} expected=${JSON.stringify(control.expectFailing)} restored=${String(restoredSha === originalSha)} -> ${behaved ? 'AS EXPECTED' : 'UNEXPECTED'}`)
}

// The library must be green again, and byte-identical, once every control is done.
const finalSuite = runSuite()
const finalSha = sha256(readFileSync(LIB))
if (finalSuite.status !== 0 || finalSha !== originalSha) ok = false
log(`after all controls: suite status=${String(finalSuite.status)} pass=${String(finalSuite.pass)} fail=${String(finalSuite.fail)} libSha256=${finalSha} pristine=${String(finalSha === originalSha)}`)

const report = {
  schema: 'a5sf-acceptance-preflight/negative-controls/1',
  at: new Date().toISOString(),
  library: relative(REPO_ROOT, LIB),
  librarySha256Before: originalSha,
  librarySha256After: finalSha,
  libraryPristineAfter: finalSha === originalSha,
  suiteAfter: { status: finalSuite.status, pass: finalSuite.pass, fail: finalSuite.fail },
  allControlsBehaved: ok,
  controls,
}
writeFileSync(join(HERE, 'negative-controls.json'), JSON.stringify(report, null, 2) + '\n')
writeFileSync(join(HERE, 'negative-controls.log'), LOG_LINES.join('\n') + '\n')
if (finalSha === originalSha) rmSync(BACKUP, { force: true })
log(`wrote negative-controls.json; controls=${String(controls.length)} allControlsBehaved=${String(ok)}`)
process.exitCode = ok ? 0 : 1
