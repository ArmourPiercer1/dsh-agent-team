#!/usr/bin/env node
/**
 * dry-run.mjs — the ZERO-BOOT preflight for the P2-01 six-row live acceptance.
 *
 * Every check below runs without a Host process, without a port and without a
 * DSH_HOME of its own. It is the ONE command the go/no-go checklist names:
 *
 *   node dev/agent-workflow/evidence/a5sf-preflight/dry-run.mjs
 *
 * WHAT IT PROVES (each check is negative-control-bearing — a deliberate break of
 * the property makes THIS script fail; the control commands are in the
 * evidence README):
 *
 *   1. the shared three-way oracle (`tests/world-factory/lib/
 *      a5sf-acceptance-preflight.mjs`) is green under `node --test`, including
 *      the #575 split-root negative control and the NOT_REACHED/REFUTED/PASS
 *      discrimination for all eight cases (precondition + rows 1-3, 4a, 4b, 5, 6);
 *   2. the corrected driver carries NO second root literal, and its `team.create`
 *      precedes the state wait that asserts the SAME root;
 *   3. no row-verdict input is character-clipped in the driver;
 *   4. the World composes: factory create + patch emission + both blueprints
 *      parsed by the HOST's own dist facade + row-identity preflight + the
 *      product's lane algebra (A allow / B deny / C deny) + clean teardown;
 *   5. the six-row Member assembly MOUNTS against the real pinned
 *      `@deepseek-ai/dsh-tool-fs` with a real `attachments` provider, and the
 *      declaration arm refuses when it is absent (`mount-compat.json`);
 *   6. `packages/runtime/src/plugin/live/agent-bindings.mjs` is byte-identical to
 *      `origin/master` (CORE PATCH BUDGET = 0);
 *   7. the pinned World composition mounts `@deepseek-ai/dsh-attachment-local`
 *      (the `attachments` service the deferred `read_image` needs);
 *   8. THE THREE POST-LIVE CORRECTIONS are bound to their live evidence and to
 *      the product source, host-free: the read/write method partition equals
 *      `fs.ts`'s own `WRITE_METHODS`, the row-4b refusal prose matches the
 *      `IO_WRITE_REQUIRES_READ` call site, the row-6 bound is temporal over the
 *      REAL live stream, and the sandbox-policy pin restates the whole config of
 *      the row it replaces;
 *   9. each correction has a MUTATION-BASED NEGATIVE CONTROL (`negative-controls.mjs`):
 *      the lib is broken the way the defect broke it, the oracle suite must go
 *      red, and the original bytes are restored.
 *
 * WHAT IT CANNOT PROVE, STRUCTURALLY (stated in the README, printed here):
 *   - that the live Host runs the ACCEPTANCE blueprint's members (creation is a
 *     `team.create` RPC on a booted Host);
 *   - that the p6t6 directive it writes is the one the row reads (the directive
 *     path is World-internal and only exists after the boot);
 *   - that a row verdict is PASS on live data — the dry run proves the DECISION
 *     FUNCTION and the assembly, not the data.
 *
 * @module dev/agent-workflow/evidence/a5sf-preflight/dry-run
 */
import { spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  ACCEPTANCE_CASES,
  ACCEPTANCE_CASE_IDS,
  IO_WRITE_REQUIRES_READ_PROSE,
  WRITE_PATH_METHODS,
} from '../../../../tests/world-factory/lib/a5sf-acceptance-preflight.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..', '..', '..')
const LOG_LINES = []
const OUT = join(HERE, 'dry-run.json')

function log(message) {
  const line = `[${new Date().toISOString()}] ${message}`
  // eslint-disable-next-line no-console
  console.log(line)
  LOG_LINES.push(line)
}
function sha256File(path) {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}
function run(label, args, options = {}) {
  const started = Date.now()
  const result = spawnSync(process.execPath, args, { cwd: REPO_ROOT, encoding: 'utf8', timeout: 600_000, ...options })
  const entry = {
    label,
    argv: args.map((arg) => (arg.startsWith(REPO_ROOT) ? relative(REPO_ROOT, arg) : arg)),
    status: result.status,
    signal: result.signal ?? null,
    ms: Date.now() - started,
    stdout: result.stdout ?? '',
    stderr: result.stderr ?? '',
  }
  log(`${label}: status=${String(entry.status)} ms=${String(entry.ms)} stdout=${entry.stdout.split('\n').filter((l) => l.trim() !== '').length} lines stderr=${entry.stderr.split('\n').filter((l) => l.trim() !== '').length} lines`)
  return entry
}

const checks = []
function check(id, ok, detail) {
  checks.push({ id, ok: ok === true, detail })
  log(`CHECK ${ok === true ? 'PASS' : 'FAIL'} ${id}: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}`)
  return ok === true
}

const report = {
  schema: 'a5sf-acceptance-preflight/dry-run/1',
  at: new Date().toISOString(),
  repoRoot: REPO_ROOT,
  head: null,
  checks,
  runs: {},
  agentBindings: null,
  negativeControls: null,
  liveStream: null,
  sandboxPin: null,
  caseIds: null,
  structurallyUnverifiable: [
    'a live `team.create` of the acceptance blueprint on the booted Host (it is an RPC against a running Host; no host-free entry point exists)',
    'that the p6t6 directive the driver writes is the one the row reads (the directive path is World-internal and materialises only during boot)',
    'that the seven rows are PASS on live data (the dry run proves the decision function and the assembly, not the data)',
    'that the Host\'s own teardown disposes the a5sf realm without a fault (the dispose observation channel is a live-State route)',
  ],
}

// ── 0. the driver and the shared contract, STATICALLY ───────────────────────
const DRIVER = join(HERE, 'run-boot.mjs')
const driverSource = readFileSync(DRIVER, 'utf8')
check('driver: no second root literal', !driverSource.includes("'session-a5sf-acceptance-root'") && !driverSource.includes("'session-a5sf-acceptance-team'") && !driverSource.includes('CREATE_ROOT'),
  'neither root literal appears in the driver; both come from P2_01_ACCEPTANCE_ROOTS')
check('driver: imports the shared contract', /P2_01_ACCEPTANCE_ROOTS/.test(driverSource) && /assertAcceptanceRootWiring/.test(driverSource) && /classifyDisposeFaults/.test(driverSource),
  'root identity + dispose classification are imported, not re-implemented')
check('driver: every case is judged by the shared oracle', ['judgePrecondition', 'judgeRow1', 'judgeRow2', 'judgeRow3', 'judgeRow4a', 'judgeRow4b', 'judgeRow5', 'judgeRow6'].every((name) => driverSource.includes(`${name}(`)),
  'all eight decisions call into a5sf-acceptance-preflight.mjs')
check('driver: row 4 is SPLIT, and the retired single-row id/judge is gone', driverSource.includes('judgeRow4a(') && driverSource.includes('judgeRow4b(') && !/judgeRow4\b(?!a|b)/.test(driverSource) && !driverSource.includes('live:row4-write-b-ceiling-allowed-no-read-lane-fact'),
  'the write the product allows (4a) and the write it refuses (4b) are two questions, two ids and two dispatches')
const createIndex = driverSource.indexOf("'team.create'")
const stateAssertIndex = driverSource.indexOf('st.body?.rootSessionId === ACCEPTANCE_ROOT')
check('driver: create precedes the state assertion on the SAME root', createIndex > 0 && stateAssertIndex > createIndex,
  `team.create@${String(createIndex)} < state(rootSessionId===ACCEPTANCE_ROOT)@${String(stateAssertIndex)}`)
const resultClips = [...driverSource.matchAll(/result[A-Za-z]*\.text[^\n]*\.slice\(0,\s*\d+\)/g)].map((m) => m[0])
check('driver: no row-verdict result is character-clipped', resultClips.length === 0,
  resultClips.length === 0 ? 'no `result*.text.slice(0, N)` anywhere in the driver' : `found ${JSON.stringify(resultClips)}`)
check('driver: full teardown observations are persisted', !/observations\.slice\(-/.test(driverSource) && !/observationsAfterDrop\.slice\(-/.test(driverSource),
  'teardown.json carries the entire observation array, no tail-N window')
check('driver: declares expectedTools on the row', driverSource.includes('a5sfExpectedTools'),
  'the live attach refuses (A5SF_EXPECTED_TOOLS_UNSHADOWED) instead of silently keeping a preset read_image')
// THE BOOT PATH IS NOT REACHABLE HOST-FREE, so a missing import, an out-of-scope variable or a
// use-before-define inside it can only fail after an intent row (or a Host start) is spent —
// measured three times on 2026-11-04: `relative is not defined` before the spawn, `homePin` after
// the intent row, and an `oracleSamples` shadow that would have thrown with the Host already up.
// A no-undef + no-use-before-define lint over the drivers is the only static net over that path.
const lintTargets = [
  join(HERE, 'run-boot.mjs'),
  join(HERE, 'dry-run.mjs'),
  join(HERE, 'go-no-go.mjs'),
  join(HERE, 'negative-controls.mjs'),
  join(REPO_ROOT, 'tests', 'world-factory', 'lib', 'a5sf-acceptance-preflight.mjs'),
]
const eslintBin = join(REPO_ROOT, 'node_modules', '.bin', 'eslint')
const lintConfig = join(HERE, 'no-undef.config.mjs')
let lintResult = { ok: false, detail: 'eslint binary not found' }
if (existsSync(eslintBin)) {
  const run = spawnSync(eslintBin, ['--config', lintConfig, ...lintTargets], { encoding: 'utf8' })
  const errors = String(run.stdout ?? '').split('\n').filter((line) => /\s+error\s/.test(line))
  lintResult = {
    ok: run.status === 0 && errors.length === 0,
    detail: errors.length === 0
      ? `exit=${String(run.status)} no undefined/use-before-define errors across ${String(lintTargets.length)} boot-path files`
      : errors.slice(0, 4).join(' | '),
  }
}
check('boot path: no undefined identifiers in the driver or the oracle', lintResult.ok, lintResult.detail)

// The lint is only worth its runtime if a probe that reproduces the 08:11Z shape is REFUSED: a
// rule that silently stopped applying would leave this green forever.
let tdzResult = { ok: false, detail: 'eslint binary not found' }
if (existsSync(eslintBin)) {
  const probe = join(HERE, '.tdz-probe.mjs')
  writeFileSync(probe, 'function f(){ return late }\nconst late = 1\nexport default f\n')
  try {
    const run = spawnSync(eslintBin, ['--config', lintConfig, probe], { encoding: 'utf8' })
    const caught = /no-use-before-define/.test(String(run.stdout ?? '')) && run.status !== 0
    tdzResult = {
      ok: caught,
      detail: caught ? 'the use-before-define probe is refused, so the TDZ rule is load-bearing' : 'the probe passed lint, so the TDZ rule is NOT active',
    }
  } finally {
    try { rmSync(probe) } catch { /* the probe is disposable */ }
  }
}
check('boot path: a use-before-define in a driver is refused (the homePin shape)', tdzResult.ok, tdzResult.detail)

check('driver: the boot-mode run-record bindings are exercised host-free', /function runBindings\(/.test(driverSource) && /bindings: runBindings\(head, grant\)/.test(driverSource) && /runBindings: runBindings\(/.test(driverSource),
  'a broken binding literal (e.g. a missing import used only by those strings) must fail in --plan, not after a start is spent')
check('driver: an abort after the Host is reached is a FAIL, never NOT_REACHED', driverSource.includes('RUN_ABORTED_AFTER_HOST_REACHED') && /add\(id, hostReached \? 'FAIL' : 'NOT_REACHED'/.test(driverSource),
  'post-boot aborts are labelled UNJUDGED and FAIL; only pre-boot aborts are NOT_REACHED')
const LIB = join(REPO_ROOT, 'tests', 'world-factory', 'lib', 'a5sf-acceptance-preflight.mjs')
const libSource = readFileSync(LIB, 'utf8')
check('oracle: row 2 asserts a DECISION on every read-path consultation (never a count)', libSource.includes('isReadPathConsultation') && libSource.includes('everyReadPathConsultationDenied') && libSource.includes('everyReadPathFactOnBindingLane') && !libSource.includes("const readFacts = facts.filter((fact) => String(fact?.method ?? '') === 'readText')"),
  'live defect 1: a refused read is recorded at `stat` (the denied target never reaches `readText`); the old name filter counted zero facts and refuted a correct refusal')
check('oracle: the read/write partition is the PRODUCT\'s closed write set', /WRITE_PATH_METHODS\s*=\s*Object\.freeze\(\['writeText', 'editText'\]\)/.test(libSource),
  'any other method (including a future one) is counted as a read-path consultation — fail-closed, never silently ignored')
check('oracle: row 5/6 cannot launder an answered refusal into NOT_REACHED', ['INVALIDATION_NOT_RAISED', 'INVALIDATION_TRIGGER_FAILED', 'ARCHIVE_REFUSED'].every((reason) => libSource.includes(reason)),
  'review B2: asked-and-contradicted is REFUTED; only a never-dispatched step is NOT_REACHED')
check('oracle: row 5 requires the NAME-KEYED code, not the blanket realm freeze', libSource.includes("REALM_INVALIDATED_CODE = 'A5SF_MEMBER_REALM_INVALIDATED'") && libSource.includes('BLANKET_INVALIDATION_ONLY') && libSource.includes('notBlanketFreeze'),
  'E8/#580: a blanket A5SF_MEMBER_REALM_INVALIDATED-only refusal is REFUTED (pinned by C12)')
// PRECEDENCE IN THE PRODUCT, read host-free: the covered-name branch must be
// taken BEFORE the blanket realm-freeze refusal in the same admission hook.
const mountSource = readFileSync(join(REPO_ROOT, 'packages', 'runtime', 'team-services', 'src', 'mount.ts'), 'utf8')
const admission = mountSource.slice(mountSource.indexOf('const admitCoveredTool'))
const coveredBranch = admission.indexOf('expectedDefinitions.has(name)')
const nameKeyedReturn = admission.indexOf('refusalOf(name, record)')
const blanketReturn = admission.indexOf('realmFreezeRefusalOf(record)')
check('product: a COVERED name gets the name-keyed refusal before the blanket freeze', mountSource.includes("A5SF_MEMBER_REALM_INVALIDATED = 'A5SF_MEMBER_REALM_INVALIDATED'") && coveredBranch !== -1 && nameKeyedReturn !== -1 && blanketReturn !== -1 && nameKeyedReturn < blanketReturn,
  blanketReturn === -1
    ? 'the blanket E8 code is not in mount.ts yet'
    : 'mount.ts admitCoveredTool: covered branch +' + coveredBranch + ' -> refusalOf(name, record) +' + nameKeyedReturn + ' precedes realmFreezeRefusalOf(record) +' + blanketReturn)
check('oracle: root identity includes the production row + directive values', libSource.includes('productionRowRoot') && libSource.includes('directiveRoot !== first'),
  'review B3: the two product-side values are asserted, not just the constants')
check('oracle: the #575 stream is a real committed fixture', existsSync(join(REPO_ROOT, 'tests', 'world-factory', 'fixtures', 'a5sf-575-teardown-observations.json')),
  'review B4: 20 observations / 27 old-filter lines, extracted from the committed teardown.json')

// The untouched product seam (CORE PATCH BUDGET = 0).
const BINDINGS = join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs')
const bindingsHead = sha256File(BINDINGS)
const baseShow = spawnSync('git', ['show', 'origin/master:packages/runtime/src/plugin/live/agent-bindings.mjs'], { cwd: REPO_ROOT, encoding: 'utf8' })
const bindingsBase = baseShow.status === 0 ? createHash('sha256').update(baseShow.stdout).digest('hex') : null
report.agentBindings = { path: relative(REPO_ROOT, BINDINGS), sha256Head: bindingsHead, sha256OriginMaster: bindingsBase, untouched: bindingsBase === bindingsHead }
check('agent-bindings.mjs is untouched vs origin/master', bindingsBase !== null && bindingsBase === bindingsHead,
  `${bindingsHead} == ${String(bindingsBase)}`)

// ── 0b. THE THREE POST-LIVE CORRECTIONS, bound host-free ────────────────────
// Each check below ties an oracle decision to the PRODUCT bytes it describes (or
// to the committed live transcript), so the correction cannot drift into a
// private convention: if the product renames its write set or re-words the
// refusal, this script goes red instead of the oracle quietly certifying a
// different question.
const FS_SRC = join(REPO_ROOT, 'packages', 'runtime', 'team-services', 'src', 'fs.ts')
const fsSource = readFileSync(FS_SRC, 'utf8')
const productWriteMethods = (() => {
  const found = /const WRITE_METHODS: ReadonlySet<string> = new Set\(\[([^\]]*)\]\)/.exec(fsSource)
  return found === null ? null : [...found[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
})()
report.productWriteMethods = productWriteMethods
check('lib: the read/write partition EQUALS the product\'s WRITE_METHODS', productWriteMethods !== null && JSON.stringify(productWriteMethods) === JSON.stringify([...WRITE_PATH_METHODS]),
  `fs.ts WRITE_METHODS=${JSON.stringify(productWriteMethods)} lib WRITE_PATH_METHODS=${JSON.stringify([...WRITE_PATH_METHODS])} (a third product write method would make the oracle mis-scope facts)`)

// The row-4b witness is a SENTENCE, so bind it to the ONE call site that emits
// it: the write⇒read coupling's first arm (target outside the read rule set).
const omitArm = (() => {
  const start = fsSource.indexOf('if (!locatorWithinRuleSet(policy.read, hostPath)) {')
  // 700 chars covers that arm's whole throw (5 lines) and cannot reach the
  // second arm's DIFFERENT sentence (the pattern has no `s` flag, so `.` stops
  // at the newline).
  return start === -1 ? null : fsSource.slice(start, start + 700)
})()
report.row4bWitness = {
  callSite: 'team-services/src/fs.ts: if (!locatorWithinRuleSet(policy.read, hostPath)) -> TeamIoDenial(IO_WRITE_REQUIRES_READ, …)',
  matched: omitArm === null ? null : IO_WRITE_REQUIRES_READ_PROSE.test(omitArm),
  sentence: omitArm === null ? null : (omitArm.match(/must read[^`]*write does not imply read/) ?? [null])[0],
}
check('lib: the row-4b refusal prose IS the product\'s IO_WRITE_REQUIRES_READ sentence', report.row4bWitness.matched === true,
  report.row4bWitness.sentence ?? 'the call site was not found in fs.ts')
check('lib: a SECOND IO_WRITE_REQUIRES_READ arm exists with different wording (the row must not credit it)', (fsSource.match(/IO_WRITE_REQUIRES_READ/g) ?? []).length === 2 && fsSource.includes('and the read axis refused it'),
  'the "outside the read rule set" arm is the one row 4b asks for; the "read axis refused it" arm is a different answer')

// the case list
report.caseIds = [...ACCEPTANCE_CASES]
check('contract: eight cases, and row 4 is two of them', ACCEPTANCE_CASES.length === 8 && ACCEPTANCE_CASES.includes(ACCEPTANCE_CASE_IDS.row4a) && ACCEPTANCE_CASES.includes(ACCEPTANCE_CASE_IDS.row4b) && ACCEPTANCE_CASES.includes(ACCEPTANCE_CASE_IDS.row2) && ACCEPTANCE_CASE_IDS.row2.includes('read-path'),
  ACCEPTANCE_CASES.join(' | '))
check('contract: the renamed/retired ids are gone from the contract', !ACCEPTANCE_CASES.some((id) => /exactly-one-fact|row4-write-b/.test(id)),
  'the old id NAMED an assertion the oracle no longer makes, so it could not stay')

// the live stream + the temporal bound, re-measured here
const LIVE_STREAM = join(HERE, 'consultations.jsonl')
const LIVE_RUN_LOG = join(HERE, 'run.log')
const liveFacts = readFileSync(LIVE_STREAM, 'utf8').split('\n').filter((line) => line.trim() !== '').map((line) => JSON.parse(line))
const stopFromLog = (() => {
  const line = readFileSync(LIVE_RUN_LOG, 'utf8').split('\n').find((l) => l.includes('archive via product tool route'))
  return line === undefined ? null : (/^\[(\d{4}-\d{2}-\d{2}T[0-9:.]+Z)\]/.exec(line)?.[1] ?? null)
})()
const liveAfter = stopFromLog === null ? null : liveFacts.filter((fact) => Date.parse(fact.observedAt) > Date.parse(stopFromLog))
report.liveStream = {
  path: relative(REPO_ROOT, LIVE_STREAM),
  facts: liveFacts.length,
  stopInstantFromRunLog: stopFromLog,
  factsAfterStop: liveAfter === null ? null : liveAfter.length,
  newestObservedAt: liveFacts.map((f) => f.observedAt).sort().at(-1) ?? null,
  injectedReplay: liveAfter === null ? null : [...liveFacts, { ...liveFacts[0], observedAt: new Date(Date.parse(stopFromLog) + 1000).toISOString() }].filter((fact) => Date.parse(fact.observedAt) > Date.parse(stopFromLog)).length,
}
check('row6: the REAL live stream carries NO fact after the stop instant', liveFacts.length === 5 && stopFromLog !== null && liveAfter !== null && liveAfter.length === 0,
  `facts=${String(liveFacts.length)} stop=${String(stopFromLog)} newest=${String(report.liveStream.newestObservedAt)} afterStop=${String(report.liveStream.factsAfterStop)}`)
check('row6: injecting ONE later observedAt makes the same bound fail (the control)', report.liveStream.injectedReplay === 1,
  `afterStop=${String(report.liveStream.injectedReplay)} (the assertion is load-bearing, not vacuous)`)
check('oracle: row 6 no longer checks a fact COUNT', libSource.includes('noFactAfterStop: afterStop.length === 0') && libSource.includes('NO_STOP_INSTANT') && libSource.includes('factsAreTimestamped') && !libSource.includes('noFactAfterStop: sinkDelta === 0'),
  'live defect 3: an append-only file makes `sinkDelta === 0` structurally unable to express "nothing after the stop"; the old clause refuted a clean stream')

report.oracleLibSha256Before = sha256File(LIB)
report.oracleLibPath = relative(REPO_ROOT, LIB)

// ── 1. the oracle test suite ────────────────────────────────────────────────
report.runs.oracleTests = run('oracle-tests', ['--test', join(REPO_ROOT, 'tests', 'world-factory', 'a5sf-acceptance-preflight.test.mjs')])
const testText = report.runs.oracleTests.stdout + report.runs.oracleTests.stderr
const passMatch = /(?:#|ℹ) pass (\d+)/.exec(testText)
const failMatch = /(?:#|ℹ) fail (\d+)/.exec(testText)
report.oracleTests = { pass: passMatch === null ? null : Number(passMatch[1]), fail: failMatch === null ? null : Number(failMatch[1]) }
check('oracle suite is green', report.runs.oracleTests.status === 0 && report.oracleTests.fail === 0 && (report.oracleTests.pass ?? 0) > 0,
  `pass=${String(report.oracleTests.pass)} fail=${String(report.oracleTests.fail)}`)

// The correction-specific tests must EXIST and pass, not merely "some tests".
const correctionTests = ['C9', 'C13', 'C14', 'C15', 'C16']
const missingCorrectionTests = correctionTests.filter((id) => !new RegExp(`^✔ ${id} `, 'm').test(testText))
check('oracle: the correction replays are present and green', missingCorrectionTests.length === 0,
  `passing: ${correctionTests.join(',')}${missingCorrectionTests.length === 0 ? '' : ` MISSING ${JSON.stringify(missingCorrectionTests)}`}`)

// ── 1b. the mutation-based negative controls (each correction is load-bearing) ─
report.runs.negativeControls = run('negative-controls', [join(HERE, 'negative-controls.mjs')])
const negative = existsSync(join(HERE, 'negative-controls.json'))
  ? JSON.parse(readFileSync(join(HERE, 'negative-controls.json'), 'utf8'))
  : null
report.negativeControls = negative === null ? null : {
  allControlsBehaved: negative.allControlsBehaved,
  controls: negative.controls.map((entry) => ({ id: entry.id, behaved: entry.behaved, failingTests: entry.failingTests, expectFailing: entry.expectFailing })),
  libraryPristineAfter: negative.libraryPristineAfter,
  librarySha256Before: negative.librarySha256Before,
  librarySha256After: negative.librarySha256After,
}
check('negative controls: every correction, when re-broken, makes the oracle suite FAIL', negative !== null && negative.allControlsBehaved === true && negative.controls.length >= 7,
  negative === null ? 'negative-controls.json was not written' : `controls=${String(negative.controls.length)} behaved=${String(negative.controls.filter((c) => c.behaved === true).length)}`)
check('negative controls: the oracle library is left byte-identical (no mutation survives)', negative !== null && negative.libraryPristineAfter === true && negative.librarySha256After === report.oracleLibSha256Before,
  negative === null ? null : `${String(negative.librarySha256Before)} -> ${String(negative.librarySha256After)}`)
check('negative controls: the suite is green again after the last restore', report.runs.negativeControls.status === 0 && negative?.suiteAfter?.fail === 0,
  negative === null ? null : negative.suiteAfter)

// ── 2. the World plan (composition + config + lane algebra) ─────────────────
// Plan mode APPENDS to run.log, and run.log is the COMMITTED live transcript of
// the first real acceptance run. The previous version of this script deleted it
// (`rmSync`) and renamed the result to plan.log — i.e. re-running the preflight
// destroyed the very evidence the preflight cites. The live transcript is now
// preserved BYTE-FOR-BYTE: the pre-existing prefix is restored after the plan,
// and only the plan's own appended suffix becomes plan.log.
const RUN_LOG = join(HERE, 'run.log')
const PLAN_LOG = join(HERE, 'plan.log')
const preservedRunLog = existsSync(RUN_LOG) ? readFileSync(RUN_LOG, 'utf8') : null
report.preserved = {
  runLogBytes: preservedRunLog === null ? null : Buffer.byteLength(preservedRunLog),
  runLogSha256: preservedRunLog === null ? null : createHash('sha256').update(preservedRunLog).digest('hex'),
  consultationsSha256: sha256File(join(HERE, 'consultations.jsonl')),
}
report.runs.plan = run('plan', [DRIVER, '--plan'])
const afterPlanRunLog = existsSync(RUN_LOG) ? readFileSync(RUN_LOG, 'utf8') : ''
if (preservedRunLog !== null) {
  const appended = afterPlanRunLog.startsWith(preservedRunLog) ? afterPlanRunLog.slice(preservedRunLog.length) : afterPlanRunLog
  writeFileSync(PLAN_LOG, appended)
  writeFileSync(RUN_LOG, preservedRunLog)
} else if (afterPlanRunLog !== '') {
  writeFileSync(PLAN_LOG, afterPlanRunLog)
  rmSync(RUN_LOG)
}
report.preserved.runLogRestoredVerbatim = preservedRunLog === null
  ? null
  : (existsSync(RUN_LOG) && readFileSync(RUN_LOG, 'utf8') === preservedRunLog)
report.preserved.planLogBytes = existsSync(PLAN_LOG) ? statSync(PLAN_LOG).size : null
const plan = JSON.parse(readFileSync(join(HERE, 'plan.json'), 'utf8'))
check('plan: root wiring', plan.rootWiring?.ok === true, plan.rootWiring)
check('plan: attachments provider composed', plan.attachmentsProvider?.mounted === true, plan.attachmentsProvider?.evidence ?? null)
check('plan: both blueprints ingest through the host facade', plan.blueprints?.anchor?.ok === true && plan.blueprints?.main?.ok === true, plan.blueprints)
check('plan: patch layer carries the boot root + expectedTools', plan.patch?.containsBootRoot === true && plan.patch?.containsExpectedTools === true, { bytes: plan.patch?.bytes, sha256: plan.patch?.sha256 })
check('plan: row identity preflight', plan.rowIdentity?.ok === true, plan.rowIdentity?.rows ?? null)
const disposition = Object.fromEntries((plan.lane?.dispositions ?? []).map((entry) => [entry.locator.split('/').pop(), entry.effective]))
check('plan: lane algebra A allow / B deny / C deny', disposition['a.txt'] === 'allow' && disposition['b.txt'] === 'deny' && disposition['c.txt'] === 'deny', disposition)
check('plan: world torn down', plan.world?.teardown?.homeDeleted !== undefined && !existsSync(String(plan.world?.home ?? '')), { home: plan.world?.home, teardown: plan.world?.teardown })
check('preflight: the committed LIVE transcript is preserved byte-for-byte', report.preserved.runLogRestoredVerbatim === true,
  `run.log bytes=${String(report.preserved.runLogBytes)} sha256=${String(report.preserved.runLogSha256)} plan.log bytes=${String(report.preserved.planLogBytes)}`)

// ── 2b. the sandbox-policy pin (fixture correction, README §12.4) ───────────
// Bound to the row it REPLACES: a patch entry replaces an entry's whole config,
// so a pin that restated only one field would silently drop the other. The base
// bundle is read from the PINNED host tree, and its exact keys must be ours.
const BASE_BUNDLE = join(REPO_ROOT, 'tests', 'deepseek-harness-test-use', 'packages', 'bundle', 'base', 'cordis.patch.yml')
const baseBundleText = existsSync(BASE_BUNDLE) ? readFileSync(BASE_BUNDLE, 'utf8') : ''
const baseRow = (() => {
  const start = baseBundleText.indexOf('- id: sandbox-policy')
  if (start === -1) return null
  // Stop at the NEXT row: a fixed-width slice ran into `bash-sandbox` and would
  // have demanded restating a `timeoutMs` that belongs to another plugin.
  const next = baseBundleText.indexOf('\n    - id:', start)
  return baseBundleText.slice(start, next === -1 ? undefined : next)
})()
const baseKeys = baseRow === null ? null : [...baseRow.matchAll(/^ {8}(\w+):/gm)].map((m) => m[1])
const pinnedKeys = plan.homePatch === null || plan.homePatch === undefined
  ? null
  : [...String(plan.homePatch.yaml).matchAll(/^ {4}(\w+):/gm)].map((m) => m[1])
report.sandboxPin = {
  baseRow: baseRow === null ? null : baseRow.split('\n').slice(0, 6).join('\n'),
  baseConfigKeys: baseKeys,
  pinnedConfigKeys: pinnedKeys,
  baseWorkspaceRootExpression: baseRow === null ? null : (/workspaceRoot: (!!js [^\n]+)/.exec(baseRow) ?? [null, null])[1],
  pin: plan.homePatch === null || plan.homePatch === undefined ? null : {
    path: plan.homePatch.path,
    mode: plan.homePatch.mode,
    workspaceRoot: plan.homePatch.workspaceRoot,
    insideWorldHome: plan.homePatch.insideWorldHome,
    isNotTheProfilePatch: plan.homePatch.isNotTheProfilePatch,
    pathIsNotUnderProfiles: !String(plan.homePatch.path).includes('/profiles/'),
    sha256: plan.homePatch.sha256,
  },
}
check('pin: the replacement RESTATES every key the base row sets', baseKeys !== null && pinnedKeys !== null && JSON.stringify([...baseKeys].sort()) === JSON.stringify([...pinnedKeys].sort()),
  `base=${JSON.stringify(baseKeys)} pinned=${JSON.stringify(pinnedKeys)}`)
check('pin: the deployment root the base row uses IS the defect (process.cwd of the spawned host)', report.sandboxPin.baseWorkspaceRootExpression === '!!js process.cwd()',
  String(report.sandboxPin.baseWorkspaceRootExpression))
check('pin: the home-level layer is inside the World home and is NOT the profile patch', plan.homePatch?.insideWorldHome === true && (plan.homePatch?.isNotTheProfilePatch === true || report.sandboxPin.pin?.pathIsNotUnderProfiles === true),
  JSON.stringify(report.sandboxPin.pin))
check('pin: the pinned root is the World workspace the write rows write into', plan.homePatch?.workspaceRoot === plan.world?.workspace,
  `pinned=${String(plan.homePatch?.workspaceRoot)} world=${String(plan.world?.workspace)}`)
// Keep the plan World's emitted composition PLUS every directory that carries a
// LIVE transcript (`instance-port*.log` or a composed profile). The previous
// version pruned everything but the newest directory, which would have deleted
// the first live run's `instance-port3183.log` — evidence the README quotes.
const LOGS = join(HERE, 'logs')
const isLiveTranscript = (dir) => {
  try {
    return readdirSync(dir).some((file) => /^instance-port\d+\.log$/.test(file) || /^composed-profile-.*\.patch\.yml$/.test(file))
  } catch {
    return false
  }
}
const prunedDirs = []
if (existsSync(LOGS)) {
  for (const entry of readdirSync(LOGS)) {
    const dir = join(LOGS, entry)
    if (!statSync(dir).isDirectory() || entry === plan.world?.id || isLiveTranscript(dir)) continue
    rmSync(dir, { recursive: true, force: true })
    prunedDirs.push(entry)
  }
}
const keptLogs = existsSync(LOGS) ? readdirSync(LOGS).filter((entry) => statSync(join(LOGS, entry)).isDirectory()) : []
report.logs = { kept: keptLogs, pruned: prunedDirs, liveTranscriptsPreserved: keptLogs.filter((entry) => isLiveTranscript(join(LOGS, entry))) }
check('plan: the plan World plus every LIVE transcript directory is kept', keptLogs.includes(String(plan.world?.id)) && report.logs.liveTranscriptsPreserved.length >= 1,
  report.logs)

// ── 3. the mount-compatibility measurement ──────────────────────────────────
report.runs.mountProbe = run('mount-probe', [join(HERE, 'probe-mount-compat.mjs')])
const mount = JSON.parse(readFileSync(join(HERE, 'mount-compat.json'), 'utf8'))
const armOf = (label) => mount.arms.find((arm) => arm.label === label) ?? null
const armA = armOf('A-real-attachment-store')
const armB = armOf('B-stub-attachments')
const armC = armOf('C-no-attachments-declared')
const armD = armOf('D-no-attachments-undeclared')
const allForwarded = ['read', 'write', 'edit', 'read_image']
const armOk = (arm) => arm !== null && arm.mounted === true && allForwarded.every((name) => (arm.forwardedUnion ?? []).includes(name)) && allForwarded.every((name) => (arm.surface ?? []).includes(name))
check('mount: real attachments -> MOUNTED, 4/4 forwarded AND visible', armOk(armA), armA === null ? null : { forwarded: armA.forwardedUnion, surface: armA.surface, routing: armA.routing })
check('mount: stub attachments -> MOUNTED, 4/4', armOk(armB), armB === null ? null : { forwarded: armB.forwardedUnion, surface: armB.surface })
check('mount: no attachments + declaration -> typed REFUSAL naming read_image', armC !== null && armC.mounted === false && armC.error?.code === 'A5SF_EXPECTED_TOOLS_UNSHADOWED',
  armC === null ? null : { code: armC.error?.code, message: String(armC.error?.message ?? '').slice(0, 400) })
check('mount: no attachments + undeclared -> MOUNTED with read_image absent (the refused-name premise)', armD !== null && armD.mounted === true && (armD.forwardedUnion ?? []).includes('read_image') === false,
  armD === null ? null : { forwarded: armD.forwardedUnion })

// ── 4. the exact head this preflight certifies ─────────────────────────────
const head = spawnSync('git', ['rev-parse', 'HEAD'], { cwd: REPO_ROOT, encoding: 'utf8' })
report.head = head.status === 0 ? String(head.stdout).trim() : null
report.base = String(spawnSync('git', ['rev-parse', 'origin/master'], { cwd: REPO_ROOT, encoding: 'utf8' }).stdout ?? '').trim() || null
// The PRODUCT tree (everything outside this evidence directory): a dirty product
// tree means the run certified different bytes than the ones a boot would execute.
// The evidence files themselves are the run's output, so they are excluded.
report.productStatusPorcelain = String(spawnSync('git', ['status', '--porcelain', '--untracked-files=no', '--', ':!dev/agent-workflow/evidence'], { cwd: REPO_ROOT, encoding: 'utf8' }).stdout ?? '').trim()
report.productTreeClean = report.productStatusPorcelain === ''
/**
 * The product tree the run certifies, as a digest that survives evidence-only
 * commits. A committed `dry-run.json` is necessarily written before the commit
 * that carries it, so the raw HEAD is one behind; the PRODUCT digest is not.
 * `go-no-go.mjs` refuses when the digest of the tree it runs on differs from
 * the digest the dry run measured (review B5).
 */
export function productTreeDigest() {
  const r = spawnSync('git', ['ls-tree', '-r', 'HEAD', '--', 'packages', 'scripts', 'tests', 'docs/plans', 'docs/contracts', 'dev/engineering', 'package.json', 'pnpm-lock.yaml', 'pnpm-workspace.yaml'], { cwd: REPO_ROOT, encoding: 'utf8' })
  return createHash('sha256').update(String(r.stdout ?? '').trim()).digest('hex')
}
report.productTreeDigest = productTreeDigest()
report.pinnedHost = (() => { try { return readFileSync(join(REPO_ROOT, 'tests', 'paths.mjs'), 'utf8').match(/TEST_USE_BASELINE_SHA\s*=\s*'([0-9a-f]+)'/)?.[1] ?? null } catch { return null } })()
report.goNoGo = checks.every((entry) => entry.ok === true)
writeFileSync(OUT, JSON.stringify(report, null, 2) + '\n')
writeFileSync(join(HERE, 'dry-run.log'), LOG_LINES.join('\n') + '\n')
log(`wrote ${OUT}; checks=${String(checks.length)} failed=${String(checks.filter((entry) => entry.ok !== true).length)} goNoGo=${String(report.goNoGo)}`)
log('STRUCTURALLY UNVERIFIABLE WITHOUT A BOOT: ' + report.structurallyUnverifiable.join(' | '))
process.exitCode = report.goNoGo ? 0 : 1
