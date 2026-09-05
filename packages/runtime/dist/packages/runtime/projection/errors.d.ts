/**
 * P8-T2 Projection Service — the closed service-level error contract
 * (TaskDoc §11.9 P8-T2; DevPlan §21).
 *
 * Error-surface split (frozen):
 *
 * - **Field-level and cross-field malformed-input rejection is delegated to
 *   the frozen P8-T1 DTO error surface.** Every field value, id shape,
 *   vocabulary (unknown lifecycle / admission / residency / context policy /
 *   ledger category), and the whole-projection invariants (one leader
 *   template, the LeaderInstance exactly once, unique instance ids, every
 *   non-leader referencing an existing member template, `totalEntries` ==
 *   `sum(byCategory)`, ...) are validated by `createTeamProjection` and its
 *   embedded record parsers, which throw `MALFORMED_DTO` (or the
 *   field-specific contract codes). This service adds NO second vocabulary.
 * - **This module owns only the service-level invariants that the DTO
 *   cannot see** — the one case today is the effective-workspace resolution:
 *   a member row carries no workspace AND the team carries no default
 *   workspace, so the fold (which must stamp a resolvable effective
 *   workspace on every projected member row) cannot proceed.
 *
 * Fail-closed: a service-level failure is THROWN as a {@link ProjectionError}
 * with a code from the CLOSED vocabulary below; it is never silently
 * pretended as a successful projection.
 *
 * Pure module: no I/O, no `node:` builtins.
 * @module @dsh-agent-team/runtime/projection/errors
 */
/** The closed projection service error-code vocabulary. */
export declare const PROJECTION_ERROR_CODES: {
    /**
     * A member row has no resolvable effective workspace: the row carried no
     * `workspace` AND the team carried no `defaultWorkspace`, so the
     * projection (which requires an effective workspace on every member row)
     * cannot be built. Details carry `instanceId` (and whether it is the
     * LeaderInstance) for diagnosis.
     */
    readonly MEMBER_WORKSPACE_UNRESOLVED: "PROJECTION_MEMBER_WORKSPACE_UNRESOLVED";
};
/** The closed projection service error-code type. */
export type ProjectionErrorCode = (typeof PROJECTION_ERROR_CODES)[keyof typeof PROJECTION_ERROR_CODES];
/**
 * A closed, service-level projection failure. Field-level / cross-field
 * malformed-input rejections are NOT this type — those are the frozen P8-T1
 * DTO contract errors (see the module docs).
 */
export declare class ProjectionError extends Error {
    /** The closed error code. */
    readonly code: ProjectionErrorCode;
    /** Opaque diagnostic details (no live references, no lossless-JSON hosts). */
    readonly details?: Record<string, unknown>;
    constructor(code: ProjectionErrorCode, message: string, details?: Record<string, unknown>);
}
/** Type guard: is `value` a {@link ProjectionError}? */
export declare function isProjectionError(value: unknown): value is ProjectionError;
//# sourceMappingURL=errors.d.ts.map