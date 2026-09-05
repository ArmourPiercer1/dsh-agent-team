/**
 * The persona overlay's typed error channel (TaskDoc §11.5 P5-T2; DevPlan
 * §18.3; Architecture §13.5).
 *
 * The persona slot's FATAL gate throws {@link TeamPersonaOverlayError}
 * carrying the FROZEN contracts-v1 code
 * `TEAM_PERSONA_COMPLETE_PRESET_CONFLICT` (Architecture §13.5: AgentPreset
 * effective persona `complete:true` ⇒ structural FATAL, no Continue
 * Anyway). The binder then wraps the thrown error as its own closed
 * `BINDER_OVERLAY_FAILED` (the T1 slot contract: "a THROWN apply fails the
 * whole bind fail-closed before work"), preserving this error on `cause` —
 * so the frozen code travels to the caller through the cause chain while
 * the binder's closed 5-code vocabulary (P5-T1, frozen) stays untouched.
 *
 * Consumers MUST branch on `code` (and the {@link isTeamPersonaOverlayError}
 * guard), never on message text — the same discipline as the frozen
 * contracts v1 and binder error codes.
 *
 * Pure module: no I/O, no runtime environment assumptions.
 * @module @dsh-agent-team/runtime/agent-setup/persona/errors
 */
import { TeamContractErrorCode } from '../../../contracts/src/index.js';
/**
 * The closed error-code vocabulary of the persona overlay (P5-T2).
 *
 * The single code re-uses the contracts-v1 frozen constant VERBATIM — the
 * architecture-named code, so a caller branching on the contracts
 * vocabulary recognizes the conflict without knowing this module.
 */
export const PERSONA_OVERLAY_ERROR_CODES = {
    /**
     * The target's AgentPreset effective persona is `complete:true`
     * (Architecture §13.5): the Blueprint persona cannot be composed
     * without a core seam — structural FATAL before work. Frozen contracts
     * v1 constant, re-exported verbatim.
     */
    TEAM_PERSONA_COMPLETE_PRESET_CONFLICT: TeamContractErrorCode.TEAM_PERSONA_COMPLETE_PRESET_CONFLICT,
};
/**
 * The structural FATAL error of the persona overlay.
 *
 * Thrown by the persona slot's `apply` BEFORE the binder's admission
 * decision point, so a complete-preset conflict can never reach work:
 * the binder's fail-closed wrap (BINDER_OVERLAY_FAILED, this error on
 * `cause`) aborts the bind with no later slot, no surface install effect,
 * no recorded event, and no bound registration.
 */
export class TeamPersonaOverlayError extends Error {
    /** The closed persona-overlay error code (frozen contracts v1 constant). */
    code;
    /**
     * Lossless-JSON structured context (no live references): the target's
     * root session id, the conflicting preset id, the bind path, and the
     * compatibility engine's stable detail line.
     */
    details;
    constructor(details) {
        super(`TEAM_PERSONA_COMPLETE_PRESET_CONFLICT: AgentPreset '${details.presetId}' effective persona is complete:true; ` +
            `the Team Blueprint persona cannot be composed for root session '${details.rootSessionId}' during ` +
            `'${details.path}' bind (structural FATAL before work, no Continue Anyway)`);
        this.name = 'TeamPersonaOverlayError';
        this.code = PERSONA_OVERLAY_ERROR_CODES.TEAM_PERSONA_COMPLETE_PRESET_CONFLICT;
        this.details = {
            rootSessionId: details.rootSessionId,
            presetId: details.presetId,
            path: details.path,
            detail: details.detail,
        };
    }
}
/**
 * Type guard: `true` iff `value` is an `Error` carrying one of the closed
 * persona-overlay codes.
 * @param value - the value to check.
 */
export function isTeamPersonaOverlayError(value) {
    if (!(value instanceof Error))
        return false;
    const code = value.code;
    return (code === PERSONA_OVERLAY_ERROR_CODES.TEAM_PERSONA_COMPLETE_PRESET_CONFLICT);
}
//# sourceMappingURL=errors.js.map