#!/usr/bin/env node
/**
 * candidate-acceptance-gate.mjs — the CANDIDATE acceptance layer (review
 * `docs/reviews/20261124-1341.txt` §4.4: "put the key DEV-LIVE scenarios into
 * an executable, reviewable candidate gate").
 *
 * WHAT THIS IS. One command that runs the four D acceptance drivers
 * (`run-boot.mjs`, `run-boot-d2.mjs`, `run-boot-d3.mjs`,
 * `probe-d4-routed-wake.mjs`) with `--boots 2`, on the host generation the
 * existing `TEAM_TEST_HOST` selector names, and reduces their OWN emitted
 * artifacts to ONE machine-readable verdict plus a human summary.
 *
 * WHAT THIS IS NOT. It is NOT Required CI, it does NOT change
 * `ci-required`'s layer set, and it does NOT upgrade a capability row. A row
 * becomes gate-backed only when a gate is BOTH required and green; this layer
 * is deliberately non-required, so every row it covers keeps the level it had
 * (`DEV-LIVE`). See `.github/workflows/candidate-acceptance.yml` and
 * `dev/agent-workflow/evidence/ute-a1/D-ACCEPTANCE-REPORT.md`.
 *
 * IT DOES NOT RE-IMPLEMENT THE DRIVERS' JUDGES. Every verdict below is read
 * from what the driver itself wrote:
 *
 *   d/d2/d3  `runs/boot0N/run-record.json`   (case verdicts, the shipped RUN algebra)
 *            `agreement.json`                (the driver's own two-boot agreement)
 *   d4       `runs/boot0N/routed-judges.json` (the seven routed sub-judges + the conjunction)
 *            `results.json`                   (each boot's per-judge PROVEN/REFUTED proposition)
 *            `runs/boot0N/run-record.json`    (the same judges in RUN vocabulary)
 *            `agreement.json`
 *
 * The RUN records are graded by the SAME validator the hosted
 * `EB3-RUN-MANIFEST` leg runs (`scripts/eb3-run-manifest.mjs`), so a record
 * this gate accepts is one the repository accepts.
 *
 * THE ACCEPTANCE RULE (closed, no tolerance):
 *   1. every judge the driver declares is PRESENT, exactly the enumerated set;
 *   2. every judge verdict is PROVEN, EXCEPT the exact ids enumerated in
 *      `KNOWN_REFUTED` below, each carrying its citation (never a pattern);
 *   3. the two boots AGREE (`agreement.agreeing === true`, zero differing rows);
 *   4. every RUN record is VALID under `scripts/eb3-run-manifest.mjs`;
 *   5. no artifact is stale (each was written by THIS run).
 * Any other verdict — REFUTED not enumerated, ENV_BLOCK, SKIP, TIMEOUT,
 * NOT_REACHED, START_FAILED, a missing/extra judge, a disagreement, an invalid
 * record, a stale artifact — is a FAIL with the reason named.
 *
 * NO RETRIES. NO TIMEOUT WIDENING. One driver run per host; a driver that does
 * not finish inside `DRIVER_TIMEOUT_MS` is killed and reported as a FAIL whose
 * reason names that exact timeout.
 *
 *   node scripts/candidate-acceptance-gate.mjs [--hosts legacy|next|both]
 *                                              [--out <dir>]
 *
 * `--hosts` defaults to the host the existing selector resolves (unset or
 * `legacy` → rc.2, `next` → rc.5). `--hosts both` runs BOTH generations and
 * emits three verdict lines (one per host, one overall). Exit: 0 pass,
 * 1 fail, 2 could not grade (bad argv / descriptor).
 *
 * @module scripts/candidate-acceptance-gate
 */
import { execFileSync, spawn } from 'node:child_process'
import { copyFileSync, createWriteStream, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { context as runManifestContext, validateRunRecord } from './eb3-run-manifest.mjs'
import { testHostMode } from '../tests/next-host/host-select.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..')
const EVIDENCE_REL = 'dev/agent-workflow/evidence/candidate-acceptance-gate'
const OUTPUT_ROOT = join(ROOT, EVIDENCE_REL)
const DRIVER_TIMEOUT_MS = 45 * 60 * 1000
const BOOTS = 2

/** The host generations this layer can grade. `both` is a gate-level choice,
 *  not a `TEAM_TEST_HOST` value (the selector only knows legacy/next). */
const HOSTS = Object.freeze(['legacy', 'next'])

/**
 * THE KNOWN-REFUTED ENUMERATION. An entry here is the ONLY way a non-PROVEN
 * judge may pass this gate. It is a literal id → citation map: a new REFUTED
 * judge does NOT inherit an exemption (nothing is matched by prefix, suffix or
 * pattern), and removing the entry makes the gate red until the enumeration is
 * deliberately edited in review.
 *
 * Today there is exactly one such judge. It is a DECLARED SCOPE, not a pending
 * fix: this generation promises allow/deny for Subprocess/PTY and explicitly
 * does NOT support per-call `ask` for process execution. The refusal is
 * fail-closed (no process created, zero bytes, settlement FAILED).
 *
 * @type {Readonly<Record<string, Readonly<{citation: string, review: string, reason: string}>>>}
 */
const KNOWN_REFUTED = Object.freeze({
  'd4:ask-execute-process': Object.freeze({
    citation: 'dev/agent-workflow/evidence/ute-a1/SCOPE-subprocess-ask.md §2 (what is explicitly NOT promised) and §4 (the exact current refusal evidence, both hosts)',
    review: 'docs/reviews/20261124-1341.txt §3.1 (the declared-scope ask) and §4.3 (product-scope close-out)',
    reason: 'This generation promises `allow`/`deny` for Subprocess/PTY; per-call `ask` for process execution is NOT supported and remains fail-closed. The process ask chain reaches a real durable ask → real Officer allow → one-shot grant, then the persistent-bash backend lookup fails because the v5 per-tool bash binding realm carries no PTY terminal spec: no process is created, zero bytes are produced, settlement is FAILED, and the receipt verifier is never reached. Zero bytes/no-process is the promise, not a pending product fix.',
  }),
})

/**
 * The judge set each driver DECLARES, pinned here so a driver that silently
 * drops or renames a judge cannot shrink the population this gate accepts.
 * These are case ids from the drivers' own records; the gate never invents a
 * judge and never computes one.
 */
const DRIVERS = Object.freeze([
  Object.freeze({
    id: 'd',
    script: 'tests/world-factory/drivers/d-boot-feasibility/run-boot.mjs',
    evidence: 'dev/agent-workflow/evidence/d-boot-feasibility',
    judges: Object.freeze([
      'd:member-read-admitted',
      'd:member-read-denied',
      'd:native-read-surface',
      'd:guard-facts',
      'd:centre-facts',
      'd:remote-creation',
    ]),
  }),
  Object.freeze({
    id: 'd2',
    script: 'tests/world-factory/drivers/d-boot-feasibility/run-boot-d2.mjs',
    evidence: 'dev/agent-workflow/evidence/d-boot-feasibility/d2',
    judges: Object.freeze([
      'd2:multi-member-concurrency',
      'd2:revocation',
      'd2:stop',
      'd2:remote-delivery',
    ]),
  }),
  Object.freeze({
    id: 'd3',
    script: 'tests/world-factory/drivers/d-boot-feasibility/run-boot-d3.mjs',
    evidence: 'dev/agent-workflow/evidence/d-boot-feasibility/d3',
    judges: Object.freeze([
      'd3:persistent-subprocess',
      'd3:crash-cold-recovery',
      'd3:work-delivery',
      'd3:alpha6',
    ]),
  }),
  Object.freeze({
    id: 'd4',
    script: 'tests/world-factory/drivers/d-boot-feasibility/probe-d4-routed-wake.mjs',
    evidence: 'dev/agent-workflow/evidence/d-boot-feasibility/d4',
    judges: Object.freeze([
      'd4:enablement',
      'd4:officer-up',
      'd4:officer-binding',
      'd4:routed-wake',
      'd4:case-created',
      'd4:router-officer',
      'd4:wake-delivered',
      'd4:officer-decides',
      'd4:ask-executes-after-review',
      'd4:duplicate-route',
      'd4:sticky-stop',
      'd4:refusal',
      'd4:ask-execute',
      'd4:ask-execute-2',
      'd4:ask-execute-process',
      'd4:ask-denied',
      'd4:ask-stopped',
    ]),
    routedSubJudges: Object.freeze([
      'caseCreated', 'routerOfficer', 'wakeDelivered', 'officerDecides',
      'askExecutesAfterReview', 'duplicateRoute', 'stickyStop',
    ]),
  }),
])

const argv = process.argv.slice(2)
// CLI parsing must not throw at module load: a usage error is a named
// `could-not-grade` verdict (exit 2), not an unhandled stack trace.
let CLI_ERROR = null
const OUT_DIR = (() => {
  try {
    const i = argv.indexOf('--out')
    if (i === -1) return join(OUTPUT_ROOT, utcStamp())
    if (typeof argv[i + 1] !== 'string' || argv[i + 1] === '') throw usage('--out needs a directory')
    return resolve(ROOT, argv[i + 1])
  } catch (error) {
    CLI_ERROR = error
    return join(OUTPUT_ROOT, utcStamp())
  }
})()

function usage(why) {
  const error = new Error(`${why}\nusage: node scripts/candidate-acceptance-gate.mjs [--hosts legacy|next|both] [--out <dir>]`)
  error.code = 'USAGE'
  return error
}

/** `--hosts` is EITHER a gate-level list (`both`) or a generation the existing
 *  selector understands. No third spelling is accepted, and an ambient typo is
 *  refused by `testHostMode()` rather than silently graded as legacy. */
function selectedHosts() {
  const i = argv.indexOf('--hosts')
  if (i === -1) return [testHostMode()]
  const value = argv[i + 1]
  if (value === 'both') return [...HOSTS]
  if (value === 'legacy' || value === 'next') return [value]
  throw usage(`--hosts=${JSON.stringify(value)} is not a host generation; use legacy, next or both`)
}

const KNOWN_FLAGS = new Set(['--hosts', '--out'])
for (const token of argv) {
  if (token.startsWith('--') && !KNOWN_FLAGS.has(token) && CLI_ERROR === null) {
    try { throw usage(`unknown flag ${JSON.stringify(token)}`) } catch (error) { CLI_ERROR = error }
  }
}

const STARTED_AT = new Date()
const HEAD = git(['rev-parse', 'HEAD'])
const BRANCH = git(['rev-parse', '--abbrev-ref', 'HEAD'])

function git(args) {
  try { return execFileSync('git', ['-C', ROOT, ...args], { encoding: 'utf8' }).trim() } catch { return null }
}

function utcStamp() {
  return new Date().toISOString().replace(/[:.]/gu, '-')
}

function readText(path) {
  try { return readFileSync(path, 'utf8') } catch { return null }
}
function readJson(path) {
  const text = readText(path)
  if (text === null) return { ok: false, path, error: 'missing' }
  try { return { ok: true, path, value: JSON.parse(text) } } catch (error) {
    return { ok: false, path, error: `invalid JSON: ${String(error?.message ?? error)}` }
  }
}
const rel = (path) => relative(ROOT, path).split('\\').join('/')

/** A fresh artifact must be written by THIS run, not left over from a previous
 *  acceptance round. A driver that archives nothing and writes nothing cannot
 *  pass on yesterday's bytes. */
function freshness(path, sinceMs) {
  try {
    const stat = statSync(path)
    return { ok: stat.mtimeMs >= sinceMs - 2000, mtime: new Date(stat.mtimeMs).toISOString() }
  } catch {
    return { ok: false, mtime: null }
  }
}

/** Map a RUN verdict to the proposition vocabulary this gate prints. Only PASS
 *  becomes PROVEN and only FAIL becomes REFUTED; every other shipped RUN
 *  verdict is carried through unchanged so an ENV_BLOCK can never be printed
 *  as a pass. This is a translation of the driver's own verdict word, never a
 *  second judgement of the proposition. */
function propositionOf(caseVerdict) {
  if (caseVerdict === 'PASS') return 'PROVEN'
  if (caseVerdict === 'FAIL') return 'REFUTED'
  return String(caseVerdict)
}

function envLimitedVerdict(verdict) {
  return verdict === 'ENV_BLOCK' || verdict === 'ENV_LIMITED'
}

function fail(reason) {
  return { ok: false, reason }
}

/** The two-boot agreement artifact every driver writes. */
function gradeAgreement(evidenceRoot) {
  const read = readJson(join(evidenceRoot, 'agreement.json'))
  if (!read.ok) return fail(`agreement.json ${read.error}`)
  const a = read.value
  // The d/d2/d3 drivers write `{agreeing, differing, boots, rows}`; the d4
  // probe writes `{agreeing, rows, text}` (its `differing` is only in the text
  // line). Both are the driver's own agreement artifact and both are graded
  // here — the second is never excused for having a different shape.
  const boots = a?.boots ?? (Array.isArray(a?.rows) && Array.isArray(a.rows[0]?.values) ? a.rows[0].values.length : null)
  const differing = Array.isArray(a?.differing)
    ? a.differing
    : Array.isArray(a?.rows)
      ? a.rows.filter((r) => new Set(r?.values ?? []).size > 1).map((r) => r?.key)
      : []
  if (a?.agreeing !== true) return fail(`agreement.json agreeing=${JSON.stringify(a?.agreeing)} (must be true) differing=${JSON.stringify(differing)}`)
  if (boots !== BOOTS) return fail(`agreement.json boots=${JSON.stringify(boots)} (must be ${String(BOOTS)})`)
  if (differing.length !== 0) return fail(`agreement.json differing=${JSON.stringify(differing)}`)
  return { ok: true, agreeing: true, boots, differing }
}

/** Grade the two RUN records the same way EB3-RUN-MANIFEST does. `rel` is
 *  carried for the validator's evidence binding; a finding is a FAIL, not a
 *  warning. */
function gradeRunRecords(evidenceRoot, driverId, sinceMs) {
  const ctx = runManifestContext(ROOT)
  const records = []
  for (let boot = 1; boot <= BOOTS; boot += 1) {
    const path = join(evidenceRoot, 'runs', `boot0${String(boot)}`, 'run-record.json')
    const fresh = freshness(path, sinceMs)
    if (!fresh.ok) {
      records.push({ boot, path: rel(path), valid: false, fresh: false, findings: [], reason: 'missing or stale (not written by this run)' })
      continue
    }
    const read = readJson(path)
    if (!read.ok) {
      records.push({ boot, path: rel(path), valid: false, fresh: true, findings: [], reason: read.error })
      continue
    }
    const { findings } = validateRunRecord({ record: read.value, rel: rel(path), ctx })
    records.push({ boot, path: rel(path), valid: findings.length === 0, fresh: true, findings: findings.map((f) => ({ code: f.code, detail: f.detail })), record: read.value })
  }
  const invalid = records.filter((r) => r.valid !== true)
  if (invalid.length !== 0) {
    return fail(`invalid RUN record(s): ${invalid.map((r) => `boot${String(r.boot)}=${r.reason ?? r.findings.map((f) => f.code).join(',')}`).join('; ')}`)
  }
  // A non-PASS `overall` is NOT graded here as a second, coarser failure: the
  // per-judge rule below already refuses every non-PROVEN verdict except an
  // exact known-refuted id, and it names the judge. Failing on `overall` first
  // would hide WHICH judge is red and make the printed counts lie (a driver
  // with one REFUTED judge would contribute zero judges to `proven=`).
  const partial = records.filter((r) => r.record?.partial === true || r.record?.subset === true)
  if (partial.length !== 0) return fail(`RUN record is partial/subset: ${partial.map((r) => `boot${String(r.boot)}`).join(',')}`)
  return { ok: true, records: records.map(({ record: _record, ...r }) => r), values: records.map((r) => r.record) }
}

/** The judge list from a RUN record. Every driver records each judge as a case,
 *  so the case set IS the driver's own judge set; the pinned `DRIVERS[].judges`
 *  is the declaration that it may not shrink. */
function judgesFromRecord(record, driverId) {
  const judges = []
  for (const c of record?.cases ?? []) {
    const id = String(c?.id ?? '')
    let verdict = propositionOf(c?.verdict)
    if (driverId === 'd4' && (c?.probeVerdict === 'PROVEN' || c?.probeVerdict === 'REFUTED')) {
      // The probe records its own proposition verdict next to the RUN verdict.
      // If they disagree, the record is internally inconsistent: fail rather
      // than pick a colour.
      if (c.probeVerdict !== verdict) {
        return fail(`case ${JSON.stringify(id)} contradicts itself: RUN verdict=${String(c?.verdict)} but probeVerdict=${String(c.probeVerdict)}`)
      }
      verdict = c.probeVerdict
    }
    judges.push({ id, verdict })
  }
  return { ok: true, judges }
}

/** d4's `routed-judges.json` is the probe's own sub-judge artifact. It must
 *  parse and its conjunction must agree with `results.json`; the gate does not
 *  re-evaluate any clause. */
function gradeRoutedJudges(evidenceRoot, sinceMs) {
  const perBoot = []
  for (let boot = 1; boot <= BOOTS; boot += 1) {
    const path = join(evidenceRoot, 'runs', `boot0${String(boot)}`, 'routed-judges.json')
    const fresh = freshness(path, sinceMs)
    if (!fresh.ok) return fail(`routed-judges.json boot${String(boot)} missing or stale`)
    const read = readJson(path)
    if (!read.ok) return fail(`routed-judges.json boot${String(boot)} ${read.error}`)
    const judges = read.value?.judges
    const routedWake = read.value?.routedWake
    if (judges === null || typeof judges !== 'object') return fail(`routed-judges.json boot${String(boot)} has no judges object`)
    if (routedWake === null || typeof routedWake !== 'object' || typeof routedWake.verdict !== 'string') return fail(`routed-judges.json boot${String(boot)} has no routedWake verdict`)
    perBoot.push({ boot, keys: Object.keys(judges).sort(), routedWakeVerdict: routedWake.verdict, judges })
  }
  return { ok: true, perBoot }
}

/** d4's `results.json` is one entry per boot with the proposition verdicts.
 *  Cross-check it against the RUN records: a probe that wrote two different
 *  answers in two artifacts is not evidence. */
function gradeD4Results(evidenceRoot, sinceMs, records, driver) {
  const path = join(evidenceRoot, 'results.json')
  const fresh = freshness(path, sinceMs)
  if (!fresh.ok) return fail('results.json missing or stale')
  const read = readJson(path)
  if (!read.ok) return fail(`results.json ${read.error}`)
  if (!Array.isArray(read.value) || read.value.length !== BOOTS) return fail(`results.json boots=${Array.isArray(read.value) ? String(read.value.length) : 'not-an-array'} (must be ${String(BOOTS)})`)
  const perBoot = []
  for (const [index, result] of read.value.entries()) {
    const verdicts = result?.verdicts
    if (verdicts === null || typeof verdicts !== 'object') return fail(`results.json boot${String(index + 1)} has no verdicts object`)
    if (result?.failed === true) return fail(`results.json boot${String(index + 1)} failed: ${String(result?.error ?? 'unknown')}`)
    const expectedKeys = driver.judges
      .map((id) => id.slice(id.indexOf(':') + 1).replace(/-([a-z0-9])/gu, (_m, ch) => ch.toUpperCase()))
      .sort()
    const got = Object.keys(verdicts).sort()
    const missing = expectedKeys.filter((k) => !got.includes(k))
    const extra = got.filter((k) => !expectedKeys.includes(k))
    if (missing.length !== 0 || extra.length !== 0) return fail(`results.json boot${String(index + 1)} judge set differs: missing=${JSON.stringify(missing)} extra=${JSON.stringify(extra)}`)
    perBoot.push({ boot: index + 1, verdicts })
  }
  // The two artifacts must say the same thing, judge by judge.
  for (const [index, result] of perBoot.entries()) {
    const record = records[index]
    const recordJudges = new Map((record?.cases ?? []).map((c) => [String(c?.id ?? ''), propositionOf(c?.verdict)]))
    for (const [caseId, verdict] of recordJudges) {
      const judgeKey = caseId.includes(':') ? caseId.slice(caseId.indexOf(':') + 1) : caseId
      // `d4:ask-execute-2` keeps the same kebab spelling as the judge key
      // `askExecute2`; map kebab → camel for the comparison only.
      const camel = judgeKey.replace(/-([a-z0-9])/gu, (_m, ch) => ch.toUpperCase())
      const resultVerdict = result.verdicts[camel]?.verdict
      if (resultVerdict !== undefined && resultVerdict !== verdict) {
        return fail(`artifact disagreement boot${String(index + 1)} judge=${caseId}: results.json=${String(resultVerdict)} run-record=${String(verdict)}`)
      }
    }
  }
  return { ok: true, perBoot }
}

/** The host-dependent driver command. `--boots 2` is not configurable: a
 *  single-boot development iteration is not an agreeing pair. */
function driverCommand(driver) {
  return [join(ROOT, driver.script), '--boots', String(BOOTS)]
}

function runDriver(driver, host, logPath) {
  return new Promise((resolvePromise) => {
    const command = driverCommand(driver)
    const child = spawn(process.execPath, command, {
      cwd: ROOT,
      env: { ...process.env, TEAM_TEST_HOST: host },
      stdio: ['ignore', 'pipe', 'pipe'],
    })
    const out = createWriteStream(logPath, { flags: 'w' })
    let tail = ''
    let timedOut = false
    const take = (chunk) => {
      const text = chunk.toString()
      tail = (tail + text).slice(-20000)
      out.write(text)
    }
    child.stdout.on('data', take)
    child.stderr.on('data', take)
    const timer = setTimeout(() => {
      timedOut = true
      child.kill('SIGKILL')
    }, DRIVER_TIMEOUT_MS)
    child.on('error', (error) => {
      clearTimeout(timer)
      out.end()
      resolvePromise({ code: null, signal: null, timedOut, tail, spawnError: String(error?.message ?? error) })
    })
    child.on('close', (code, signal) => {
      clearTimeout(timer)
      out.end()
      resolvePromise({ code, signal, timedOut, tail, spawnError: null })
    })
  })
}

function resultLineOf(tail) {
  const lines = String(tail ?? '').split('\n').filter((l) => /\bRESULT\b/u.test(l))
  return lines.length === 0 ? null : lines[lines.length - 1].trim()
}

const SNAPSHOT_FILES = Object.freeze({
  d: ['agreement.json', 'agreement.txt', 'driver-digest.json', 'driver.log', 'host-tree-porcelain.txt', 'runs/boot01/run-record.json', 'runs/boot02/run-record.json'],
  d2: ['agreement.json', 'agreement.txt', 'driver-digest.json', 'driver.log', 'host-tree-porcelain.txt', 'runs/boot01/run-record.json', 'runs/boot02/run-record.json'],
  d3: ['agreement.json', 'agreement.txt', 'driver-digest.json', 'driver.log', 'host-tree-porcelain.txt', 'runs/boot01/run-record.json', 'runs/boot02/run-record.json'],
  d4: ['agreement.json', 'agreement.txt', 'results.json', 'probe-digest.json', 'probe.log', 'run-record-self-check.json', 'host-tree-porcelain.txt', 'runs/boot01/run-record.json', 'runs/boot01/routed-judges.json', 'runs/boot02/run-record.json', 'runs/boot02/routed-judges.json'],
})

function snapshot(driver, host, runDir) {
  const source = join(ROOT, driver.evidence)
  const dest = join(runDir, host, driver.id)
  const copied = []
  for (const file of SNAPSHOT_FILES[driver.id] ?? []) {
    const from = join(source, file)
    if (!existsSync(from)) continue
    const to = join(dest, file)
    mkdirSync(dirname(to), { recursive: true })
    copyFileSync(from, to)
    copied.push(rel(to))
  }
  return copied
}

function gradeDriver(driver, host, runDir, startedMs) {
  const evidenceRoot = join(ROOT, driver.evidence)
  const problems = []

  const agreement = gradeAgreement(evidenceRoot)
  if (!agreement.ok) problems.push(agreement.reason)

  const records = gradeRunRecords(evidenceRoot, driver.id, startedMs)
  if (!records.ok) problems.push(records.reason)

  let judges = []
  if (records.ok) {
    const perBoot = []
    for (const [index, record] of records.values.entries()) {
      const got = judgesFromRecord(record, driver.id)
      if (!got.ok) { problems.push(`boot${String(index + 1)}: ${got.reason}`); continue }
      perBoot.push(got.judges)
    }
    if (perBoot.length === records.values.length) {
      const expected = [...driver.judges].sort()
      for (const [index, got] of perBoot.entries()) {
        const ids = got.map((j) => j.id).sort()
        const missing = expected.filter((id) => !ids.includes(id))
        const extra = ids.filter((id) => !expected.includes(id))
        if (missing.length !== 0 || extra.length !== 0) {
          problems.push(`boot${String(index + 1)} judge set differs from the declared set: missing=${JSON.stringify(missing)} extra=${JSON.stringify(extra)}`)
          continue
        }
        for (const judge of got) {
          const first = perBoot[0].find((j) => j.id === judge.id)
          if (first !== undefined && first.verdict !== judge.verdict) {
            problems.push(`boots disagree on ${judge.id}: boot1=${first.verdict} boot${String(index + 1)}=${judge.verdict}`)
          }
          // Every verdict must be PROVEN or an EXACT known-refuted id.
          const known = Object.prototype.hasOwnProperty.call(KNOWN_REFUTED, judge.id)
          if (judge.verdict === 'PROVEN') continue
          if (judge.verdict === 'REFUTED' && known) continue
          problems.push(`unexpected verdict ${judge.id}=${judge.verdict}${known ? ' (enumerated as known-refuted, but the record does not say REFUTED)' : ''}`)
        }
      }
      judges = perBoot[0] ?? []
    }
  }

  let routed = null
  let d4Results = null
  if (driver.id === 'd4' && records.ok) {
    routed = gradeRoutedJudges(evidenceRoot, startedMs)
    if (!routed.ok) problems.push(routed.reason)
    else {
      const expectedKeys = [...driver.routedSubJudges].sort()
      for (const boot of routed.perBoot) {
        const missing = expectedKeys.filter((k) => !boot.keys.includes(k))
        const extra = boot.keys.filter((k) => !expectedKeys.includes(k))
        if (missing.length !== 0 || extra.length !== 0) problems.push(`routed-judges boot${String(boot.boot)} sub-judge set differs: missing=${JSON.stringify(missing)} extra=${JSON.stringify(extra)}`)
      }
    }
    d4Results = gradeD4Results(evidenceRoot, startedMs, records.values, driver)
    if (!d4Results.ok) problems.push(d4Results.reason)
    else {
      // The conjunction and each sub-judge must also agree between boots.
      const routedWake = d4Results.perBoot.map((boot) => boot.verdicts.routedWake?.verdict)
      if (routedWake.some((v) => v !== routedWake[0])) problems.push(`boots disagree on routedWake: ${JSON.stringify(routedWake)}`)
    }
  }

  // The driver's own stdout RESULT line, recorded for the human reader; the
  // artifacts above are what decide. A missing line is not a fail by itself.
  const resultLine = resultLineOf(readText(join(runDir, 'logs', `${driver.id}.log`)) ?? '')
  const copied = snapshot(driver, host, runDir)

  const counts = {
    judges: judges.length,
    proven: judges.filter((j) => j.verdict === 'PROVEN').length,
    knownRefuted: judges.filter((j) => j.verdict === 'REFUTED' && Object.prototype.hasOwnProperty.call(KNOWN_REFUTED, j.id)).length,
    envLimited: judges.filter((j) => envLimitedVerdict(j.verdict)).length,
  }
  return {
    id: driver.id,
    script: driver.script,
    evidence: driver.evidence,
    command: `TEAM_TEST_HOST=${host} node ${driver.script} --boots ${String(BOOTS)}`,
    resultLine,
    verdict: problems.length === 0 ? 'pass' : 'fail',
    reasons: problems,
    agreement: agreement.ok ? { agreeing: true, boots: agreement.boots, differing: agreement.differing } : { agreeing: false, error: agreement.reason },
    records: records.ok ? records.records : [],
    judges,
    counts,
    routed: routed === null ? null : { subJudges: driver.routedSubJudges, boots: routed.perBoot.map((b) => ({ boot: b.boot, routedWake: b.routedWakeVerdict })) },
    snapshot: copied,
  }
}

async function gradeHost(host, runDir) {
  const startedAt = new Date()
  const drivers = []
  for (const driver of DRIVERS) {
    const logDir = join(runDir, 'logs')
    mkdirSync(logDir, { recursive: true })
    const logPath = join(logDir, `${driver.id}.log`)
    const driverStart = Date.now()
    const run = await runDriver(driver, host, logPath)
    const expectedCodes = driver.id === 'd4' ? [0, 3] : [0]
    let graded
    if (run.spawnError !== null) {
      graded = { id: driver.id, script: driver.script, verdict: 'fail', reasons: [`could not spawn driver: ${run.spawnError}`], counts: { judges: 0, proven: 0, knownRefuted: 0, envLimited: 0 } }
    } else if (run.timedOut) {
      graded = { id: driver.id, script: driver.script, verdict: 'fail', reasons: [`driver TIMEOUT after ${String(DRIVER_TIMEOUT_MS)} ms (candidate-acceptance-gate.mjs DRIVER_TIMEOUT_MS); killed with SIGKILL — no retry`], counts: { judges: 0, proven: 0, knownRefuted: 0, envLimited: 0 } }
    } else {
      graded = gradeDriver(driver, host, runDir, driverStart)
      if (!expectedCodes.includes(run.code)) {
        graded.verdict = 'fail'
        graded.reasons.push(`driver exit=${String(run.code)} signal=${String(run.signal)} (accepted: ${expectedCodes.join(' or ')})`)
      }
    }
    graded.exitCode = run.code
    graded.signal = run.signal
    graded.timedOut = run.timedOut
    graded.timeoutMs = DRIVER_TIMEOUT_MS
    graded.log = rel(logPath)
    graded.resultLine = graded.resultLine ?? resultLineOf(run.tail)
    drivers.push(graded)
    // One driver run, no retries: the next driver starts only after this one
    // has been graded. A failed driver does not stop the host's other drivers:
    // the verdict must say what the whole set measured, not just the first red.
  }
  const judges = drivers.flatMap((d) => d.judges)
  const counts = {
    judges: judges.length,
    proven: judges.filter((j) => j.verdict === 'PROVEN').length,
    knownRefuted: judges.filter((j) => j.verdict === 'REFUTED' && Object.prototype.hasOwnProperty.call(KNOWN_REFUTED, j.id)).length,
    envLimited: judges.filter((j) => envLimitedVerdict(j.verdict)).length,
  }
  const reasons = drivers.flatMap((d) => d.reasons.map((r) => `${d.id}: ${r}`))
  return {
    host,
    selectorEnv: `TEAM_TEST_HOST=${host}`,
    verdict: reasons.length === 0 && drivers.every((d) => d.verdict === 'pass') ? 'pass' : 'fail',
    reasons,
    drivers,
    counts,
    startedAt: startedAt.toISOString(),
  }
}

function verdictLine(hostResult) {
  const c = hostResult.counts
  return `CANDIDATE-GATE ${hostResult.verdict} host=${hostResult.host} judges=${String(c.judges)} proven=${String(c.proven)} known-refuted=${String(c.knownRefuted)} env-limited=${String(c.envLimited)} drivers=${String(hostResult.drivers.length)} records=${String(hostResult.drivers.reduce((n, d) => n + (d.records?.length ?? 0), 0))} agreement=${String(hostResult.drivers.every((d) => d.agreement?.agreeing === true))}${hostResult.verdict === 'fail' ? ` reasons=${hostResult.reasons.join(' | ').replace(/\s+/gu, ' ').slice(0, 1200)}` : ''}`
}

function summaryText(report) {
  const lines = []
  lines.push(`CANDIDATE-GATE ${report.verdict.toUpperCase()} at ${report.at}`)
  lines.push(`head=${String(report.head)} hosts=${report.hosts.join(',')} timeout=${String(DRIVER_TIMEOUT_MS)}ms boots=${String(BOOTS)}`)
  lines.push('')
  for (const host of report.perHost) {
    lines.push(verdictLine(host))
    for (const d of host.drivers) {
      const c = d.counts
      lines.push(`  ${d.id.padEnd(3)} ${d.verdict.padEnd(4)} judges=${String(c.judges)} proven=${String(c.proven)} known-refuted=${String(c.knownRefuted)} env-limited=${String(c.envLimited)} exit=${String(d.exitCode)} ${d.resultLine ?? ''}`.trimEnd())
      for (const reason of d.reasons) lines.push(`        reason: ${reason}`)
    }
    lines.push('')
  }
  const total = report.totals
  lines.push(`CANDIDATE-GATE ${report.verdict} hosts=${report.hosts.join(',')} judges=${String(total.judges)} proven=${String(total.proven)} known-refuted=${String(total.knownRefuted)} env-limited=${String(total.envLimited)}`)
  return `${lines.join('\n')}\n`
}

async function main() {
  if (CLI_ERROR !== null) throw CLI_ERROR
  const hosts = selectedHosts()
  const at = STARTED_AT.toISOString()
  mkdirSync(OUT_DIR, { recursive: true })
  const perHost = []
  for (const host of hosts) {
    console.log(`CANDIDATE-GATE start host=${host} drivers=${DRIVERS.map((d) => d.id).join(',')} boots=${String(BOOTS)} timeout=${String(DRIVER_TIMEOUT_MS)}ms`)
    perHost.push(await gradeHost(host, OUT_DIR))
  }
  const totals = perHost.reduce((acc, h) => ({
    judges: acc.judges + h.counts.judges,
    proven: acc.proven + h.counts.proven,
    knownRefuted: acc.knownRefuted + h.counts.knownRefuted,
    envLimited: acc.envLimited + h.counts.envLimited,
  }), { judges: 0, proven: 0, knownRefuted: 0, envLimited: 0 })
  const verdict = perHost.every((h) => h.verdict === 'pass') ? 'pass' : 'fail'
  const report = {
    schema: 'candidate-acceptance-gate/1',
    at,
    head: HEAD,
    branch: BRANCH,
    hosts,
    verdict,
    layer: 'candidate-acceptance (NON-REQUIRED; never Required CI)',
    bootsPerDriver: BOOTS,
    timeoutMs: DRIVER_TIMEOUT_MS,
    knownRefuted: KNOWN_REFUTED,
    drivers: DRIVERS.map((d) => ({ id: d.id, script: d.script, judges: d.judges })),
    totals,
    perHost,
    note: 'No row becomes PRODUCT-PROVEN from this gate. A row becomes gate-backed only when the gate is REQUIRED by branch protection AND green; this layer is deliberately non-required.',
  }
  const verdictPath = join(OUT_DIR, 'verdict.json')
  const summaryPath = join(OUT_DIR, 'summary.txt')
  writeFile(verdictPath, `${JSON.stringify(report, null, 2)}\n`)
  writeFile(summaryPath, summaryText(report))
  console.log(summaryText(report).trimEnd())
  console.log(`CANDIDATE-GATE verdict=${verdict} machine=${rel(verdictPath)} summary=${rel(summaryPath)}`)
  return verdict === 'pass' ? 0 : 1
}

function writeFile(path, text) {
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, text)
}

main()
  .then((code) => { process.exitCode = code })
  .catch((error) => {
    const detail = error?.code === 'USAGE' ? String(error.message) : String(error?.stack ?? error)
    console.error(`CANDIDATE-GATE FAIL could-not-grade: ${detail}`)
    process.exitCode = error?.code === 'USAGE' ? 2 : 1
  })
