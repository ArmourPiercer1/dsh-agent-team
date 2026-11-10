/**
 * run-record.mjs — the machine-readable RUN record (plan U5 bullet 5).
 *
 * One JSON per runner process, binding:
 *   Team SHA (git HEAD of the worktree) · Host SHA (test-use HEAD) ·
 *   profile/config digest (patch-layer text sha256 + canary plugin sha256 +
 *   provider base url) · World ID · selected tests · per-case verdict from
 *   {PASS, FAIL, REFUSED, ENV_BLOCK, SKIP, TIMEOUT, START_FAILED} ·
 *   effect receipts · cleanup receipts · host-start budget ledger position.
 *
 * THE SUMMARY RULE (hard): a runner summary NEVER prints PASS while any
 * selected case is non-PASS. `overall` is the worst verdict by severity; the
 * line format and exit code both derive from it. SKIP/REFUSED/ENV_BLOCK are
 * disclosures, never colours (plan §3: SKIP/REFUSED/ENV_BLOCK/UNKNOWN 不是 PASS).
 *
 * THE PARTIAL-RUN RULE (2026-11-05): a run that ABORTS is `FAIL` at the RUN
 * level even when every case it managed to observe passed, and the record says
 * `partial: true` + the abort stage. This is the other half of "never launder a
 * missing observation into a pass": the fail-closed duty moves from the CASE
 * verdict (which may legitimately be PASS/NOT_REACHED on what was measured) to
 * the RUN verdict (which may never be). `markAborted()` is the one place a
 * caller declares that, so no runner can hand-compute a softer overall.
 *
 * THE SUBSET RULE (2026-11-09): "not selected" is not "failed". A caller that
 * deliberately runs a subset of its declared cases (`--arms e2e`) declares the
 * full case set via `allCases`; `finalize()` records every unselected case with
 * the distinct `NOT_SELECTED` outcome and computes `overall` over the cases the
 * run actually selected. The record says `subset: true`, `arms`, `selected` and
 * `totalCases` so a subset can never be mistaken for a full run. A SELECTED
 * case that produces no verdict is still filled `FAIL` (fail-closed) — this
 * rule only removes the false FAILs on cases the caller never asked for.
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { appendCappedLine } from '../canary/ledger-cap.mjs'
import { DEFAULT_RECORD_CLASS, assertCandidateClaim, assertRecordClass, assessCandidateClaim } from './acceptance-claim.mjs'

/** FIX-T T3: the shared host-start budget ledger is a bounded artifact —
 *  1 MiB is ~4k entries against a per-session budget of single digits; past
 *  the cap rows are dropped with ONE in-file notice (never truncated). */
const BUDGET_LEDGER_CAP_BYTES = 1024 * 1024

/**
 * The ONE host-start budget gate and its default cap. It lives HERE, in the
 * ledger's own module, because both callers already import this file and
 * because importing `u5-canary-runner.mjs` from a collected suite would close a
 * top-level-await cycle (runner → loadSuites → suite → harness → runner) and
 * deadlock. `u5-canary-runner.mjs` (its pre-spawn gate and `parseArgs` default)
 * and `tests/world-factory/lib/a5sf-harness.mjs` both import these symbols; a
 * second copy of the formula or the default is the R2-b reclamation finding.
 *
 * @param {object} record the object `createRunRecord()` returned
 * @param {number} maxHostStarts positive integer cap
 * @returns {Readonly<{ledgerPath: string|null, used: number, max: number, remaining: number, exhausted: boolean}>}
 */
export const DEFAULT_MAX_HOST_STARTS = 15
export function hostStartBudgetPosition(record, maxHostStarts) {
  if (!Number.isInteger(maxHostStarts) || maxHostStarts < 1) {
    throw new Error(`bad maxHostStarts: ${JSON.stringify(maxHostStarts)} (positive integer required)`)
  }
  const used = record.ledgerStartCount()
  const ledgerPath = record?.record?.hostStarts?.ledgerPath ?? null
  return Object.freeze({
    ledgerPath,
    used,
    max: maxHostStarts,
    remaining: Math.max(0, maxHostStarts - used),
    exhausted: used >= maxHostStarts,
  })
}

export const VERDICTS = Object.freeze(['PASS', 'FAIL', 'REFUSED', 'ENV_BLOCK', 'SKIP', 'TIMEOUT', 'START_FAILED', 'NOT_REACHED', 'NOT_SELECTED'])

/** Higher = worse. `overall` takes the max severity over the SELECTED cases;
 *  `NOT_SELECTED` is outside the algebra entirely (see the SUBSET RULE). */
export const VERDICT_SEVERITY = Object.freeze({
  PASS: 0,
  SKIP: 1,
  REFUSED: 2,
  ENV_BLOCK: 3,
  // R-ENVBLOCK-1: NOT_REACHED = the DRIVE never arrived at the asserted step.
  // A harness fact that hides a product unknown: it may never soften a record,
  // so it sits at TIMEOUT's level and never below ENV_BLOCK.
  NOT_REACHED: 4,
  TIMEOUT: 4,
  START_FAILED: 5,
  FAIL: 6,
  // Not an outcome at all: the caller never asked this case to run. It is
  // excluded from `overall` and may never appear for a SELECTED case.
  NOT_SELECTED: -1,
})

export function assertVerdict(v) {
  if (!VERDICTS.includes(v)) throw new Error(`not a RUN verdict: ${JSON.stringify(v)} (allowed: ${VERDICTS.join(',')})`)
  return v
}

/** The worst verdict over the cases that were actually SELECTED. `NOT_SELECTED`
 *  rows are disclosures, not outcomes: a subset run is graded on its selection,
 *  never punished for the cases it did not ask for. A run with no judged case at
 *  all (empty suite, or every row NOT_SELECTED) is still FAIL — a suite that
 *  selected nothing is a red suite, never a green one. */
export function overallVerdict(cases) {
  const judged = cases.filter((c) => c.verdict !== 'NOT_SELECTED')
  if (judged.length === 0) return 'FAIL'
  let worst = 'PASS'
  for (const c of judged) {
    assertVerdict(c.verdict)
    if (VERDICT_SEVERITY[c.verdict] > VERDICT_SEVERITY[worst]) worst = c.verdict
  }
  return worst
}

/**
 * @param {object} bindings
 * @param {string} bindings.runId
 * @param {string} bindings.suite
 * @param {string[]} bindings.selectedCases case ids this run intended to execute
 * @param {string[]} [bindings.allCases] every case the suite DECLARES (defaults to
 *        the selection, i.e. a full run). Cases in `allCases` but not in
 *        `selectedCases` are recorded `NOT_SELECTED` instead of FAIL.
 * @param {string[]|null} [bindings.arms] the arms/subset the caller requested
 *        (recorded verbatim so a subset run says what it is)
 * @param {object} bindings.bindings Team/Host/config/World digests
 * @param {string} [bindings.ledgerPath] host-start budget ledger (JSONL)
 * @param {string} [bindings.recordClass] `DEV-LIVE` | `CANDIDATE-C2` (default C2:
 *        every pre-2026-11-09 caller keeps its historical class)
 * @param {object} [bindings.candidateClaim] a frozen-candidate claim this run
 *        intends to make (e.g. `{ verifiedAtBaseline: true }`). `finalize()`
 *        REFUSES it when the record class is `DEV-LIVE` — the hard rule of the
 *        2026-11-09 ruling.
 */
/** A run record is evidence only when it says WHICH TREE and WHICH HOST produced
 *  it. The strict `EB3-RUN-MANIFEST --new` lane grades an unbound record
 *  `RUN_SOURCE_UNRESOLVED` + `RUN_SCHEMA`; three separate lanes shipped such
 *  records (each a DEV-LIVE run whose verdicts were real) before this existed,
 *  and every one of them was patched by hand afterwards. The writer is the right
 *  place: a record that cannot be bound never gets written, instead of being
 *  discovered by a gate two hours later.
 *
 *  `teamSha` = the tree under test (a git commit, not a branch name);
 *  `hostSha` = the pinned test-use HEAD. Both must be full 40-hex.
 *  `authority` is NOT required here: readers resolve the current pointer, and a
 *  record that names a stale pointer is still bound to a tree. */
const SHA40_RE = /^[0-9a-f]{40}$/
export class UnboundRunRecordError extends Error {
  constructor(problems) {
    super(`unbound run record: ${problems.join('; ')} (a record without teamSha/hostSha is not evidence — see EB3-RUN-MANIFEST strict lane)`)
    this.name = 'UnboundRunRecordError'
    this.code = 'RUN_RECORD_UNBOUND'
    this.problems = Object.freeze([...problems])
  }
}
export function assertBoundRecord(record) {
  const b = record?.bindings ?? {}
  const problems = []
  if (!SHA40_RE.test(String(b.teamSha ?? ''))) problems.push(`bindings.teamSha=${JSON.stringify(b.teamSha)} is not a full 40-hex commit id`)
  if (!SHA40_RE.test(String(b.hostSha ?? ''))) problems.push(`bindings.hostSha=${JSON.stringify(b.hostSha)} is not a full 40-hex commit id`)
  if (problems.length > 0) throw new UnboundRunRecordError(problems)
  return record
}

export function createRunRecord({ runId, suite, selectedCases, allCases = selectedCases, arms = null, bindings, ledgerPath, recordClass = DEFAULT_RECORD_CLASS, candidateClaim = null }) {
  const cases = new Map()
  const declaredCases = [...allCases]
  const selectedSet = new Set(selectedCases)
  const record = {
    schema: 'u5-run-record/1',
    runId,
    suite,
    recordClass: assertRecordClass(recordClass),
    startedAt: new Date().toISOString(),
    selectedCases: [...selectedCases],
    allCases: declaredCases,
    arms: arms === null ? null : [...arms],
    subset: selectedCases.length < declaredCases.length,
    selected: selectedCases.length,
    totalCases: declaredCases.length,
    bindings,
    cases: [],
    hostStarts: { ledgerPath: ledgerPath ?? null, thisRunCount: 0, thisRunEntries: [] },
  }
  if (arms === null) delete record.arms
  if (candidateClaim !== null) record.candidateClaim = candidateClaim
  let finalized = null
  /** Set by `markAborted()`; a non-null value makes `finalize()` refuse to
   *  compute anything softer than FAIL for `overall`. */
  let abort = null

  const logHostStart = (entry) => {
    // The record class is stamped on EVERY ledger row (intent + start), and it
    // comes from the RECORD, never from the entry: a caller cannot label one
    // row DEV-LIVE and another CANDIDATE-C2 inside one run.
    const e = { at: new Date().toISOString(), runId, suite, recordClass: record.recordClass, ...entry, recordClass: record.recordClass }
    record.hostStarts.thisRunCount += 1
    record.hostStarts.thisRunEntries.push(e)
    if (ledgerPath !== undefined && ledgerPath !== null) {
      mkdirSync(dirname(ledgerPath), { recursive: true })
      appendCappedLine(ledgerPath, e, BUDGET_LEDGER_CAP_BYTES)
    }
    return e
  }

  return {
    record,
    logHostStart,
    /** Count of ALL host starts recorded in the shared budget ledger. */
    ledgerStartCount() {
      if (ledgerPath === undefined || ledgerPath === null || !existsSync(ledgerPath)) return 0
      return readFileSync(ledgerPath, 'utf8').split('\n').filter((l) => l.trim() !== '').length
    },
    addCase(id, verdict, detail = {}) {
      assertVerdict(verdict)
      // "not selected" is a bookkeeping outcome written by finalize(), never a
      // judgement a caller may stamp on a case it did select.
      if (verdict === 'NOT_SELECTED' && selectedSet.has(id)) {
        throw new Error(`case ${JSON.stringify(id)} is selected: NOT_SELECTED is only for cases this run did not ask for`)
      }
      cases.set(id, { id, verdict, at: new Date().toISOString(), ...detail })
      return cases.get(id)
    },
    getCase(id) {
      return cases.get(id)
    },
    /**
     * Declare that this run ABORTED. The run-level verdict becomes FAIL even if
     * every observed case passed, and the record carries `partial: true`, the
     * stage that aborted and the abort detail. Cases already judged keep their
     * verdicts: judging what was measured is not the same as passing the run.
     *
     * @param {{stage: string, detail?: string|null, error?: string|null}} where
     */
    markAborted({ stage, detail = null, error = null } = {}) {
      if (typeof stage !== 'string' || stage.trim() === '') throw new Error('markAborted requires a non-empty stage')
      abort = Object.freeze({ stage, detail, error })
      record.partial = true
      record.abortedAt = stage
      record.abort = abort
      return abort
    },
    isAborted() {
      return abort !== null
    },
    /**
     * Fold: every SELECTED case must have a verdict; a selected case without
     * one is recorded FAIL (a case that never reported is not a pass). Every
     * DECLARED case the caller did not select is recorded NOT_SELECTED and is
     * excluded from `overall` — a subset run is not a failed full run.
     */
    finalize() {
      // Fail closed at the WRITER, not at the gate: see assertBoundRecord().
      assertBoundRecord(record)
      for (const id of record.selectedCases) {
        if (!cases.has(id)) cases.set(id, { id, verdict: 'FAIL', at: new Date().toISOString(), detail: { reason: 'selected case produced no verdict (fail-closed)' } })
      }
      for (const id of declaredCases) {
        if (selectedSet.has(id) || cases.has(id)) continue
        cases.set(id, {
          id,
          verdict: 'NOT_SELECTED',
          at: new Date().toISOString(),
          detail: { reason: 'case not selected for this run (subset invocation); NOT a failure and excluded from overall' },
        })
      }
      record.cases = [...cases.values()]
      // The subset metadata is recomputed here, not merely echoed from the
      // constructor: a caller may record a case outside `allCases` (an arm-only
      // probe), and `selected <= totalCases` must stay true or the summary lies.
      record.selected = record.selectedCases.length
      record.totalCases = Math.max(declaredCases.length, record.cases.length)
      record.subset = record.selected < record.totalCases
      // The record-class claim rule (owner ruling 2026-11-09): a DEV-LIVE run
      // may never satisfy a V@B=yes / frozen-candidate claim. This is checked
      // on the record's OWN declared claim and disclosed on EVERY record, so a
      // downstream matrix reader has a machine-readable refusal instead of
      // having to know the class rule.
      const claimVerdict = record.candidateClaim === undefined
        ? assessCandidateClaim({ recordClass: record.recordClass, record })
        : assertCandidateClaim({ record, verifiedAtBaseline: record.candidateClaim?.verifiedAtBaseline === true })
      record.candidateClaimEligibility = claimVerdict
      // The abort override: an aborted run is FAIL, no matter how its cases read.
      record.overall = abort === null ? overallVerdict(record.cases) : 'FAIL'
      record.partial = abort !== null
      if (abort !== null) {
        record.abortedAt = abort.stage
        record.abort = abort
        record.judgedCases = record.cases.filter((entry) => entry.status === 'judged').map((entry) => entry.id)
        record.neverObserved = record.cases.filter((entry) => entry.verdict === 'NOT_REACHED').map((entry) => entry.id)
      }
      record.finishedAt = new Date().toISOString()
      finalized = record
      return record
    },
    write(path) {
      const r = finalized ?? this.finalize()
      mkdirSync(dirname(path), { recursive: true })
      writeFileSync(path, JSON.stringify(r, null, 2) + '\n')
      return path
    },
  }
}

/**
 * The summary line. `overall=PASS` appears ONLY when every case is PASS —
 * the function cannot produce a PASS token otherwise, by construction.
 */
export function formatSummary(record) {
  const r = finalizedCopy(record)
  const counts = {}
  for (const c of r.cases) counts[c.verdict] = (counts[c.verdict] ?? 0) + 1
  const parts = Object.entries(counts).sort().map(([k, v]) => `${k}:${v}`).join(' ')
  // u7-sbx: a native-confinement run whose HOST backend probed unusable says
  // so on the summary line. It is a disclosure, not a colour: it never changes
  // `overall`, and it never turns anything into a PASS.
  const native = r.bindings?.nativeConfinementBackend
  const marker = native === 'unusable' || native === 'unknown' ? ` nativeBackend=${native}` : ''
  // A partial run says so on the summary line: `overall=PASS` is already
  // impossible for it, and a reader must not have to open the JSON to learn that
  // the grade covers only the cases the run reached.
  const partial = r.partial === true ? ` partial=true abortedAt=${String(r.abortedAt ?? r.abort?.stage ?? 'unknown')}` : ''
  // A SUBSET run says so on the summary line: its `overall` grades only the
  // selected cases, so a reader must never mistake `overall=PASS` for a full run.
  const subset = r.subset === true
    ? ` subset=true arms=${(r.arms ?? ['<unspecified>']).join(',')} selected=${String(r.selected ?? r.selectedCases?.length ?? 0)}/${String(r.totalCases ?? r.cases.length)}`
    : ''
  // A development-boot record says so on the summary line (CANDIDATE-C2 adds
  // nothing, so every pre-existing line keeps its exact shape).
  const classTag = r.recordClass === 'DEV-LIVE' ? ' recordClass=DEV-LIVE (not candidate evidence)' : ''
  return `RUN-SUMMARY run=${r.runId} suite=${r.suite} overall=${r.overall} cases=${r.cases.length} ${parts} worlds=${(r.bindings?.worldIds ?? []).join('|') || 'none'}${marker}${partial}${subset}${classTag}`
}

/**
 * u7-sbx: bind the pre-flight NATIVE SANDBOX verdict into a run record. One
 * home for every runner (same role as `readAuthorityBinding`): the pre-flight
 * is measured by `preflightHostSandbox()` in
 * `lib/host-sandbox-assets.mjs` BEFORE the first Host start, and this is the
 * only place it is normalised into bindings.
 *
 * What it makes visible: the backend verdict the HOST's own `probe()`
 * answered, the launcher digest, and the provisioning provenance — plus a
 * standing disclosure on the record and the summary line whenever the backend
 * is not usable. Ordering of `overallVerdict` is untouched: an unusable
 * backend does not soften any FAIL, and it never produces a PASS; it is the
 * reason a native-confinement leg may legitimately be judged ENV_BLOCK.
 */
export function bindSandboxPreflight(bindings, preflight) {
  if (bindings === null || typeof bindings !== 'object') return bindings
  if (preflight === null || preflight === undefined) return bindings
  bindings.sandboxPreflight = preflight
  bindings.nativeConfinementBackend = String(preflight.backend ?? 'unknown')
  if (bindings.nativeConfinementBackend !== 'full') {
    bindings.nativeConfinementDisclosure = `native (non-governed) confinement legs ran on a host whose sandbox probe answered "${bindings.nativeConfinementBackend}" — recorded as a pre-flight verdict, never as a product PASS (see docs/TEST_METHODS.md §9 and bindings.sandboxPreflight)`
  }
  return bindings
}

function finalizedCopy(record) {
  if (record.overall !== undefined) return record
  // Defensive: computing overall here uses the same worst-of rule.
  return { ...record, overall: overallVerdict(record.cases ?? []) }
}

/** Exit code: 0 only for an all-PASS suite. */
export function exitCodeFor(record) {
  const r = finalizedCopy(record)
  return r.overall === 'PASS' ? 0 : 1
}

const sha256OfText = (s) => createHash('sha256').update(s).digest('hex')

/**
 * The `bindings.authority` stamp every RUN record carries (EB3 RUN rule:
 * a NEW record must bind the live authority generation). One home for both
 * the u5 canary runner and the standalone u7-4a jobs runner (u7-w0b R1:
 * moved here verbatim from u5-canary-runner.mjs so the second runner stops
 * omitting it).
 */
export function readAuthorityBinding(repoRoot) {
  const pointerPath = 'dev/engineering/current-authority.json'
  try {
    const text = readFileSync(join(repoRoot, pointerPath), 'utf8')
    const pointer = JSON.parse(text)
    let snapshotDigest = 'snapshot-unreadable'
    try {
      snapshotDigest = sha256OfText(readFileSync(join(repoRoot, 'dev', 'engineering', 'authority-snapshots', `${pointer.snapshot_version}.json`), 'utf8'))
    } catch {
      /* keep sentinel */
    }
    return { pointerPath, pointer, pointerSha256: sha256OfText(text), snapshotDigest }
  } catch (error) {
    return { pointerPath, error: String(error?.message ?? error) }
  }
}
