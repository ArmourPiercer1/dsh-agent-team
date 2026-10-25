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
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { appendCappedLine } from '../canary/ledger-cap.mjs'

/** FIX-T T3: the shared host-start budget ledger is a bounded artifact —
 *  1 MiB is ~4k entries against a per-session budget of single digits; past
 *  the cap rows are dropped with ONE in-file notice (never truncated). */
const BUDGET_LEDGER_CAP_BYTES = 1024 * 1024

export const VERDICTS = Object.freeze(['PASS', 'FAIL', 'REFUSED', 'ENV_BLOCK', 'SKIP', 'TIMEOUT', 'START_FAILED'])

/** Higher = worse. `overall` takes the max severity over selected cases. */
export const VERDICT_SEVERITY = Object.freeze({
  PASS: 0,
  SKIP: 1,
  REFUSED: 2,
  ENV_BLOCK: 3,
  TIMEOUT: 4,
  START_FAILED: 5,
  FAIL: 6,
})

export function assertVerdict(v) {
  if (!VERDICTS.includes(v)) throw new Error(`not a RUN verdict: ${JSON.stringify(v)} (allowed: ${VERDICTS.join(',')})`)
  return v
}

export function overallVerdict(cases) {
  if (cases.length === 0) return 'FAIL' // a suite that selected nothing is a red suite, never a green one
  let worst = 'PASS'
  for (const c of cases) {
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
 * @param {object} bindings.bindings Team/Host/config/World digests
 * @param {string} [bindings.ledgerPath] host-start budget ledger (JSONL)
 */
export function createRunRecord({ runId, suite, selectedCases, bindings, ledgerPath }) {
  const cases = new Map()
  const record = {
    schema: 'u5-run-record/1',
    runId,
    suite,
    startedAt: new Date().toISOString(),
    selectedCases: [...selectedCases],
    bindings,
    cases: [],
    hostStarts: { ledgerPath: ledgerPath ?? null, thisRunCount: 0, thisRunEntries: [] },
  }
  let finalized = null

  const logHostStart = (entry) => {
    const e = { at: new Date().toISOString(), runId, suite, ...entry }
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
      cases.set(id, { id, verdict, at: new Date().toISOString(), ...detail })
      return cases.get(id)
    },
    getCase(id) {
      return cases.get(id)
    },
    /**
     * Fold: every selected case must have a verdict; a selected case without
     * one is recorded FAIL (a case that never reported is not a pass).
     */
    finalize() {
      for (const id of record.selectedCases) {
        if (!cases.has(id)) cases.set(id, { id, verdict: 'FAIL', at: new Date().toISOString(), detail: { reason: 'selected case produced no verdict (fail-closed)' } })
      }
      record.cases = [...cases.values()]
      record.overall = overallVerdict(record.cases)
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
  return `RUN-SUMMARY run=${r.runId} suite=${r.suite} overall=${r.overall} cases=${r.cases.length} ${parts} worlds=${(r.bindings?.worldIds ?? []).join('|') || 'none'}`
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
