/**
 * acceptance-claim.mjs — the two record classes and the ONE hard rule that
 * keeps the 2026-11-09 development-boot relaxation safe.
 *
 * OWNER RULING (2026-11-09): development boots stop being a fixed-cumulative
 * budget and stop being an Integration-Owner-only activity, BUT every
 * isolation/evidence/acceptance requirement is preserved. The price of that
 * relaxation is this rule:
 *
 *   `DEV-LIVE` is an ENGINEERING RECORD LABEL, never a grade.
 *   A `DEV-LIVE` run may be used for development and PR review.
 *   A `DEV-LIVE` run may NEVER produce a `V@B=yes` claim (or any other
 *   frozen-candidate acceptance claim). Only `CANDIDATE-C2` may.
 *
 * `DEV-LIVE` is deliberately NOT added to the acceptance vocabulary
 * (`ENFORCE-PARTIAL`, `PROVEN`, `NEEDS_REVALIDATION`, …): the grade words stay
 * unchanged, and the matrix keeps its existing meanings. This module only
 * separates WHERE evidence came from, and refuses to let the development
 * class stand in for the formal class.
 *
 * `CANDIDATE-C2` remains bound to the existing C2 machinery: an immutable SHA,
 * the Authority snapshot, the real Host, the independent Oracle and the
 * independent adjudication. This module checks the CLASS only — it is a
 * necessary condition, never a replacement for those checks (`reason` says so
 * explicitly so a reader cannot mistake "class ok" for "candidate accepted").
 *
 * @module tests/world-factory/lib/acceptance-claim
 */

/** The two record classes. Order is stable: index 0 is the development class. */
export const RECORD_CLASSES = Object.freeze(['DEV-LIVE', 'CANDIDATE-C2'])

/** Records created without an explicit class keep the historical C2 behaviour. */
export const DEFAULT_RECORD_CLASS = 'CANDIDATE-C2'

/** The class that permits a `V@B=yes` / frozen-candidate claim. */
export const CANDIDATE_RECORD_CLASS = 'CANDIDATE-C2'

export const ACCEPTANCE_CLAIM_CODES = Object.freeze([
  /** a DEV-LIVE record was offered as evidence for a candidate acceptance claim */
  'DEV_LIVE_EVIDENCE_NOT_CANDIDATE',
  /** a record carries a class outside the closed set */
  'RECORD_CLASS_UNKNOWN',
])

export class AcceptanceClaimError extends Error {
  /**
   * @param {string} code one of {@link ACCEPTANCE_CLAIM_CODES}
   * @param {string} detail human-readable, never string-matched by callers
   * @param {object} [extra]
   */
  constructor(code, detail, extra = {}) {
    super(`${code}: ${detail}`)
    this.name = 'AcceptanceClaimError'
    this.code = code
    this.detail = detail
    Object.assign(this, extra)
  }
}

/** Validate a record class against the closed set (throws). */
export function assertRecordClass(recordClass) {
  if (!RECORD_CLASSES.includes(recordClass)) {
    throw new AcceptanceClaimError(
      'RECORD_CLASS_UNKNOWN',
      `recordClass ${JSON.stringify(recordClass)} is not one of ${RECORD_CLASSES.join(' | ')}; the closed set is what keeps a development run from being read as a formal one`,
      { recordClass },
    )
  }
  return recordClass
}

/**
 * Decide whether a record's CLASS may support a frozen-candidate claim
 * (`V@B=yes`). Pure, so it can be called by a validator, a test, or a future
 * matrix reader without any side effect.
 *
 * This is the negative-control surface of the ruling: for a `DEV-LIVE` record
 * the answer is a typed REFUSAL with the reason, never a silent `false`.
 *
 * @param {object} input
 * @param {string} input.recordClass
 * @param {object} [input.record] the run record (for a human-readable binding)
 * @returns {Readonly<{eligible:boolean, code:string|null, reason:string}>}
 */
export function assessCandidateClaim({ recordClass, record = null } = {}) {
  assertRecordClass(recordClass)
  if (recordClass !== CANDIDATE_RECORD_CLASS) {
    const runId = typeof record?.runId === 'string' ? record.runId : '(unknown run)'
    return Object.freeze({
      eligible: false,
      code: 'DEV_LIVE_EVIDENCE_NOT_CANDIDATE',
      reason: `run '${runId}' is recordClass=${recordClass}: a development-boot record may be used for development and PR review, but it may NOT satisfy a V@B=yes / frozen-candidate claim. Only recordClass=${CANDIDATE_RECORD_CLASS} (frozen SHA + Authority + Host + Oracle + independent adjudication) may.`,
    })
  }
  return Object.freeze({
    eligible: true,
    code: null,
    reason: `recordClass=${CANDIDATE_RECORD_CLASS}: the record class permits a candidate claim. The class is NECESSARY, NOT SUFFICIENT — the existing C2 checks (immutable SHA, Authority snapshot, real Host, independent Oracle, independent adjudication) still apply unchanged.`,
  })
}

/**
 * The refusing door. A caller that wants to attach a frozen-candidate claim to
 * a run MUST pass here; a `DEV-LIVE` record throws the typed code above.
 *
 * @param {object} input
 * @param {object} input.record the run record (`record.recordClass`)
 * @param {boolean} [input.verifiedAtBaseline] the claim being made
 * @returns {{eligible:boolean, code:string|null, reason:string}}
 */
export function assertCandidateClaim({ record, verifiedAtBaseline = false } = {}) {
  const recordClass = record?.recordClass ?? DEFAULT_RECORD_CLASS
  const verdict = assessCandidateClaim({ recordClass, record })
  if (verifiedAtBaseline !== true) return verdict
  if (!verdict.eligible) {
    throw new AcceptanceClaimError(verdict.code, verdict.reason, {
      recordClass,
      runId: record?.runId ?? null,
      candidateClaim: { verifiedAtBaseline: true },
    })
  }
  return verdict
}
