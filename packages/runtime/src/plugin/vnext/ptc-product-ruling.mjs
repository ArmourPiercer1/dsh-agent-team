/**
 * ptc-product-ruling.mjs — PTC (`run_code`) is NOT SUPPORTED in this generation, BY PRODUCT RULING.
 *
 * THE DECISION IS THE OWNER'S, NOT A PACKAGE'S. Owner ruling `docs/reviews/20261124-0151.txt` §PTC
 * (2026-11-24) formally closes PTC / `run_code` for this generation: governed Team Members are never
 * offered the tool, the host-retained entry point is refused TYPED with zero worker start, and the
 * capability is no longer a delivery blocker. The durable record of that decision — the measured
 * basis (the rc.2/rc.5 worker-policy gap), what is NOT affected, and how it could be revisited — is
 * `dev/agent-workflow/evidence/ute-a1/ADR-ptc-unsupported.md`.
 *
 * WHY A DECLARED STATUS AND NOT A SKIP. The two PTC POSITIVE arms (B ladder rung 6, and the
 * declared-world positive the ladder header used to say was "no longer contract-blocked") can never
 * become green under this ruling: there is no supported positive to run. They are therefore reported
 * as `NOT APPLICABLE — PRODUCT UNSUPPORTED`, never as "skipped pending a fix": a pending-fix skip
 * reads as debt that a later round may pay, while this is a scope the product does not ship. The
 * REFUSAL side is untouched and stays a real negative control (`ADM-76`, `ADM-87`): `run_code` is
 * admitted nowhere, the body never runs, no worker is started, and both durable shapes close
 * REFUSED / `not-started`.
 *
 * MACHINE-VISIBLE, NOT PROSE. Every not-applicable arm emits a `VNEXT-PTC-PRODUCT-UNSUPPORTED` line
 * through {@link reportProductUnsupported}, and a companion arm in the SAME suite asserts the line
 * was emitted with this marker and status (see {@link productUnsupportedReport}). A silent skip
 * cannot pass those assertions; a deleted arm cannot either, because the arm list here is closed and
 * the assertion requires each enumerated arm to have reported.
 *
 * @module packages/runtime/src/plugin/vnext/ptc-product-ruling
 */

/** The distinct status the refusal fact/report carries. NOT "missing provider", NOT "misconfigured". */
export const PTC_UNSUPPORTED_STATUS = 'unsupported-by-product-ruling'

/** The human-visible marker a not-applicable arm's title/skip reason MUST start with. */
export const PTC_NOT_APPLICABLE_MARKER = 'NOT APPLICABLE — PRODUCT UNSUPPORTED'

/**
 * The ruling, as one closed declaration. `notApplicableArms` is the ENUMERATION of the PTC positive
 * claims this generation refuses to run; the refusal controls that stay are NOT listed here because
 * they are not not-applicable — they are proven negatives.
 */
export const PTC_PRODUCT_RULING = Object.freeze({
  status: PTC_UNSUPPORTED_STATUS,
  marker: PTC_NOT_APPLICABLE_MARKER,
  /** The owner ruling this declaration implements. */
  ruling: 'docs/reviews/20261124-0151.txt §PTC (owner ruling, 2026-11-24)',
  /** The amendment document that cites the frozen A0 contract instead of editing it. */
  adr: 'dev/agent-workflow/evidence/ute-a1/ADR-ptc-unsupported.md',
  /** The AMENDED A0 B-ladder positive scope (PTC removed). */
  supportedPositiveLadder: Object.freeze(['read', 'write', 'grep', 'web_fetch', 'bash']),
  /** The ONLY verification PTC gets in this generation: the refusal chain, end to end. */
  refusalVerification: Object.freeze(['run_code', 'typed-refusal', 'zero-worker-execution', 'REFUSED/not-started']),
  /** The two PTC POSITIVE arms, now not-applicable. Order is stable (assertions read it). */
  notApplicableArms: Object.freeze([
    Object.freeze({
      id: 'ADM-69',
      suite: 'packages/runtime/test/vnext-b-probe-ladder.test.mjs',
      claim: 'B ladder rung 6 positive: `run_code` executes in the governed Member world, the body runs and the effect is observed',
    }),
    Object.freeze({
      id: 'ADM-147',
      suite: 'packages/runtime/test/vnext-admission.test.mjs',
      claim: 'the governed PTC POSITIVE on a world that DECLARES the process authorization (the ADM-125 shape applied to `run_code`)',
    }),
  ]),
  /** The negative controls that MUST stay (and are asserted to still exist by the marker arms). */
  refusalControls: Object.freeze(['ADM-76', 'ADM-87']),
})

/** Lines emitted in this process, in arm order. The marker assertion reads THIS, not a log. */
const emitted = []

/**
 * Report one not-applicable arm and return the exact machine-readable line.
 *
 * FAIL-CLOSED: an arm id outside {@link PTC_PRODUCT_RULING.notApplicableArms} throws, so a new
 * "temporarily skipped" PTC positive cannot borrow this status by accident; it must be added to the
 * ruling declaration (and therefore to the amendment) first.
 *
 * @param {{id?: string}|string} arm - the arm entry (or its id).
 * @returns {string} the `VNEXT-PTC-PRODUCT-UNSUPPORTED …` line for stdout.
 */
export function reportProductUnsupported (arm) {
  const id = typeof arm === 'string' ? arm : arm?.id
  const known = PTC_PRODUCT_RULING.notApplicableArms.some((entry) => entry.id === id)
  if (!known) {
    throw new TypeError(`ptc-product-ruling: arm ${JSON.stringify(String(id))} is not one of the ruled not-applicable arms (${PTC_PRODUCT_RULING.notApplicableArms.map((entry) => entry.id).join(', ')}); a new PTC positive cannot be parked here without a ruling amendment`)
  }
  const line = `VNEXT-PTC-PRODUCT-UNSUPPORTED arm=${String(id)} marker="${PTC_PRODUCT_RULING.marker}" status=${PTC_PRODUCT_RULING.status} verdict=NOT_APPLICABLE ruling=${PTC_PRODUCT_RULING.ruling} adr=${PTC_PRODUCT_RULING.adr}`
  emitted.push(Object.freeze({ arm: String(id), line }))
  return line
}

/** Every not-applicable report this process emitted, in arm order (frozen copy). */
export function productUnsupportedReport () {
  return Object.freeze(emitted.map((entry) => Object.freeze({ ...entry })))
}
