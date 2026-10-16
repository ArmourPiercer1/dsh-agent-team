/**
 * THE REALM / TRUST-ROOT EVIDENCE SURFACE — PR4's obligation from the PR2
 * freeze (COORDINATION: "PR4 必须以真实 probe 的 evidence/realmId/trustRoot
 * 校验先于 hard-profile 执行") and the PR0 review M-1 cross-law (an
 * `enforced` level with a null mechanism is a runtime refusal, not a schema
 * pass). This lane ships the EVIDENCE INTERFACE plus the negative controls
 * only: `HARD_PROFILE_ENABLED` is compiled OFF and nothing here turns a
 * verification ACCEPT into any runtime enablement — the verifier answers a
 * capability question, never grants (derivation law, design §1.4).
 *
 * The fabrication guard is the point: a row's `evidence` reference must
 * resolve to a RECORDED leg row — legs are recorded by the real probe runner
 * (`recordLegEvidence` is the single factory), so "enforced" cannot be typed
 * in by hand.
 *
 * Purity: no `node:*`, no I/O.
 *
 * @module @dsh-agent-team/runtime/sandbox-provider/realm-evidence
 */

import { refuse, type AssuranceDimension, type ProcessCapabilityRow, type ProviderResult } from './contract-stub.js'

/** Which leg produced a recorded verdict. */
export type EvidenceLegName = 'abi-version' | 'selective' | 'denyall' | 'badhandled' | 'fd-close' | 'confined-exec'

/** One recorded leg. Factories below are the ONLY honest construction path. */
export interface LegEvidenceRow {
  readonly leg: EvidenceLegName
  readonly verdict: string
  readonly rawEvidenceRef: string | null
  readonly argv: readonly string[]
  readonly capturedAt: string
}

/** One probe session, bound to ONE realm (Realm 不可混淆). */
export interface ProviderProbeEvidence {
  readonly realmId: string
  readonly trustRoot: string | null
  readonly abiVersion: number | null
  readonly legs: readonly LegEvidenceRow[]
  readonly capabilities: readonly ProcessCapabilityRow[]
}

/** The enablement constant of THIS lane: the gate exists, the switch does not. */
export const HARD_PROFILE_ENABLED = false

/** Record one real leg verdict (single factory; stamps capture time once). */
export function recordLegEvidence(
  leg: EvidenceLegName,
  verdict: string,
  rawEvidenceRef: string | null,
  argv: readonly string[],
  capturedAt = new Date().toISOString(),
): LegEvidenceRow {
  return Object.freeze({ leg, verdict, rawEvidenceRef, argv: Object.freeze([...argv]), capturedAt })
}

/** Verdicts a leg row may carry without tainting the hard-profile claim. */
function legIsClean(row: LegEvidenceRow): boolean {
  if (row.verdict === 'ENFORCE-CONFIRMED') return true
  // The badhandled leg's WHOLE PURPOSE is reproducing the false-ABSENT trap;
  // its confirming verdict is the DEMO one, never an enforcement claim.
  return row.leg === 'badhandled' && row.verdict === 'DEMO-CONFIRMED'
}

/** One hard-profile request: the realm the call runs in + the hard dimensions. */
export interface HardProfileCheck {
  readonly realmId: string
  readonly hardDimensions: readonly AssuranceDimension[]
}

/**
 * Verify the hard-profile evidence BEFORE acceptance. Every rule below is a
 * negative control pinned by `a5p4-realm-evidence`; an accept is a statement
 * about EVIDENCE, never a grant, and (in this lane) never an enablement.
 */
export function verifyHardProfileEvidence(evidence: ProviderProbeEvidence, check: HardProfileCheck): ProviderResult<readonly ProcessCapabilityRow[]> {
  if (evidence.realmId.trim().length === 0) {
    return refuse('IO_POLICY_UNSUPPORTED', 'hard-profile evidence states no realm — an assurance claim holds in a NAMED realm and travels to no other')
  }
  if (evidence.realmId !== check.realmId) {
    return refuse('IO_POLICY_UNSUPPORTED', `realm confusion: evidence was captured in realm '${evidence.realmId}', the call runs in '${check.realmId}' — a realm's evidence authorizes nothing elsewhere`)
  }
  const tainted = evidence.legs.filter((l) => !legIsClean(l))
  if (tainted.length > 0) {
    return refuse('IO_POLICY_UNSUPPORTED', `leg '${tainted[0]?.leg ?? '?'}' recorded verdict '${tainted[0]?.verdict ?? '?'}' — every recorded leg must confirm before any hard claim stands`)
  }
  const refs = new Set(evidence.legs.map((l) => l.rawEvidenceRef).filter((r): r is string => r !== null))
  const accepted: ProcessCapabilityRow[] = []
  for (const dimension of check.hardDimensions) {
    const row = evidence.capabilities.find((c) => c.dimension === dimension)
    if (row === undefined) {
      return refuse('IO_POLICY_UNSUPPORTED', `hard dimension '${dimension}' has no capability row — a missing row is a refusal, never an implicit untested`)
    }
    if (row.level !== 'enforced') {
      return refuse('IO_POLICY_UNSUPPORTED', `hard dimension '${dimension}' is '${row.level}' — hard demands enforced (design §1.4: partial/unsupported/untested never satisfy)`)
    }
    if (row.realmId !== check.realmId) {
      return refuse('IO_POLICY_UNSUPPORTED', `hard dimension '${dimension}' claims realm '${row.realmId}' while the call runs in '${check.realmId}'`)
    }
    if (row.mechanism === null) {
      return refuse('IO_POLICY_UNSUPPORTED', `hard dimension '${dimension}' claims enforced with mechanism null — the M-1 cross-law: a level never travels without its mechanism`)
    }
    const trustRoot = evidence.trustRoot
    if (trustRoot === null || trustRoot.trim().length === 0 || row.trustRoot === null) {
      return refuse('IO_POLICY_UNSUPPORTED', `hard dimension '${dimension}' has no named trustRoot — enforced means trusted CODE, which must name its root`)
    }
    if (row.evidence === null || !refs.has(row.evidence)) {
      return refuse('IO_POLICY_UNSUPPORTED', `hard dimension '${dimension}' cites evidence '${row.evidence ?? '<null>'}' that resolves to no recorded leg — enforced is measured, never typed in`)
    }
    accepted.push(row)
  }
  return { ok: true, value: Object.freeze([...accepted]) }
}
