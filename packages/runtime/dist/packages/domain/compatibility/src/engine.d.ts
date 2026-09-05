/**
 * The compatibility engine (pure, deterministic, side-effect-free).
 *
 * Evaluates typed requirements against environment facts and produces the
 * stable typed {@link CompatibilityResult}. It classifies —it NEVER starts,
 * admits, or cancels any work (TaskDoc §11.4 P3-T5 acceptance: "不启动work").
 *
 * Classification semantics (Architecture §27.2, T5 rulings):
 *
 * - every required subject available => `PASS`
 * - some subject unavailable and the requirement is ordinary
 *   (tool / skill / mcpServer / modelRoute) => `WARNING`
 *   (ordinary capability mismatch, ack-able via "Continue Anyway")
 * - some subject unavailable and the requirement is structural
 *   (`teamStructure`, `persona`) => `FATAL`
 *   (structural Team contract cannot hold)
 * - `complete:true` unmet => `FATAL` **mandatory, no downgrade, no ack**
 *   (Architecture §13.5; for `persona` the engine reports the frozen
 *   contracts-v1 code `TEAM_PERSONA_COMPLETE_PRESET_CONFLICT`)
 *
 * Acknowledgements (Architecture §27.3) bind to the specific mismatch +
 * environment generation: a WARNING is satisfied only by an ack whose
 * requirementId, mismatch fingerprint, AND environment fingerprint all match
 * the re-derived values of this evaluation. Drift (any fingerprint change)
 * makes earlier results and their acks stale —see
 * {@link isCompatibilityResultValidForEnvironment}.
 *
 * Authority: Architecture §7.4, §13.5, §14.3 E, §19.1, §27, §28;
 * Development Plan §16.2 Compatibility, §20.1; TaskDoc §11.4 P3-T5.
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/domain/compatibility/engine
 */
import type { Requirement } from './requirement.js';
import type { RequirementInput } from './requirement.js';
import type { EnvironmentFact } from './environment-facts.js';
import type { WarningAcknowledgement } from './acknowledgement.js';
import type { CompatibilityResult } from './result.js';
/** The raw input of one compatibility evaluation (all three re-validated). */
export interface CompatibilityEvaluationInput {
    readonly requirements: readonly RequirementInput[];
    readonly environmentFacts: readonly EnvironmentFact[];
    readonly acknowledgements?: readonly WarningAcknowledgement[];
}
/**
 * Evaluate typed requirements against environment facts and produce the
 * stable typed compatibility result.
 *
 * Pure: the same input always yields a byte-identical canonical
 * serialization; inputs are never mutated; nothing is started, admitted, or
 * cancelled.
 *
 * @param input - requirements + environment facts (+ optional acks).
 * @returns the deep-frozen, canonical-JSON-serializable result.
 * @throws `MALFORMED_DTO` when any input value fails validation (including
 *   an unknown requirement type —fail loud, typed).
 */
export declare function evaluateCompatibility(input: CompatibilityEvaluationInput): CompatibilityResult;
/**
 * Drift check: is a previously stored compatibility result still valid for
 * the current (requirements, environment facts)?
 *
 * The result is bound to the fingerprint of the relevant environment facts
 * it was computed from (T5 ruling: "any drift (different fingerprint)
 * invalidates the previous result"; Architecture §14.3 E staleness/generation,
 * Development Plan §20.1 re-probe triggers). When the fingerprint differs — * availability flip, generation bump, new/removed relevant probe, or changed
 * requirements —the previous result and every ack bound to it are stale.
 *
 * @param result - the previous result.
 * @param requirements - the current requirements (raw; re-validated).
 * @param environmentFacts - the current environment facts (raw; re-validated).
 * @returns `true` iff the current relevant-facts fingerprint equals the
 *   fingerprint the result was bound to.
 */
export declare function isCompatibilityResultValidForEnvironment(result: CompatibilityResult, requirements: readonly Requirement[], environmentFacts: readonly EnvironmentFact[]): boolean;
//# sourceMappingURL=engine.d.ts.map