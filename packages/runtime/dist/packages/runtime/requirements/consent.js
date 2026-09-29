/**
 * pre-alpha3 PR-E (plan §E.6/§E.11) — the DegradationConsent model.
 *
 * A {@link DegradationConsent} is the DURABLE human consent to run DEGRADED
 * with one OPTIONAL requirement unmet. It:
 *
 * - covers an OPTIONAL requirement only (`complete` must be `false`); a
 *   consent targeting a required (complete) requirement is rejected
 *   (`CONSENT_TARGET_NOT_OPTIONAL`);
 * - is ORTHOGONAL to the governance policy (authority negative #8:
 *   **consent ≠ governance allow** — consenting to a degraded optional
 *   capability does NOT turn a denied/ask operation into an allowed one;
 *   the per-operation policy is the effective-policy plane, independent of
 *   this requirement consent);
 * - SURVIVES restart (it is durable), while the live readiness (probe
 *   verdicts) RESETS to `unknown` on restart (authority negative #10) — the
 *   consent persists, the readiness is re-probed.
 *
 * Pure module: no I/O, no `node:` builtins.
 * @module @dsh-agent-team/runtime/requirements/consent
 */
import { REQUIREMENT_ERROR_CODES, RequirementError } from './errors.js';
/**
 * Validate that a consent targets an OPTIONAL requirement that is actually
 * unmet in the current evaluation.
 *
 * @param consent - the consent to validate.
 * @param verdicts - the current verdicts for the scope the requirement is in.
 * @throws {@link RequirementError} `CONSENT_TARGET_NOT_OPTIONAL` when the
 *   requirement is required (complete) — a consent cannot cover a required
 *   requirement. `CONSENT_TARGET_SATISFIED` when the requirement is not
 *   unmet (there is nothing to consent to).
 */
export function validateConsent(consent, verdicts) {
    const verdict = verdicts.find((v) => v.requirementId === consent.requirementId);
    if (verdict === undefined) {
        // Not in the current evaluation: nothing to validate against (the consent
        // is durable; it may predate the current evaluation). Allow it through.
        return;
    }
    if (verdict.complete === true) {
        throw new RequirementError(REQUIREMENT_ERROR_CODES.CONSENT_TARGET_NOT_OPTIONAL, `consent targets a REQUIRED requirement '${consent.requirementId}' (a consent covers an OPTIONAL requirement only)`, { requirementId: consent.requirementId });
    }
    if (verdict.outcome === 'pass') {
        throw new RequirementError(REQUIREMENT_ERROR_CODES.CONSENT_TARGET_SATISFIED, `consent targets a SATISFIED requirement '${consent.requirementId}' (there is nothing to consent to)`, { requirementId: consent.requirementId });
    }
}
/** Whether a consent covers a given requirementId. */
export function isConsented(consents, requirementId) {
    return consents.some((c) => c.requirementId === requirementId);
}
/**
 * The durable consents that are still RELEVANT to the current evaluation
 * (target an OPTIONAL, unmet requirement). A consent whose target is now
 * satisfied is stale (kept durable, but not counted as coverage).
 */
export function relevantConsents(consents, verdicts) {
    return consents.filter((c) => {
        const verdict = verdicts.find((v) => v.requirementId === c.requirementId);
        if (verdict === undefined)
            return false;
        return verdict.complete === false && verdict.outcome === 'warning';
    });
}
//# sourceMappingURL=consent.js.map