/**
 * P6-T2 — TeamRuntime error vocabulary (the closed error contract of the
 * unified runtime/control action facade).
 *
 * Every rejection produced by the TeamRuntime facade is a {@link
 * TeamRuntimeError} with a stable closed `code` and optional lossless-JSON
 * `details`. Branch on `code` (and `details`), never on the message text.
 *
 * Fail-closed contract: every code is thrown during the RESOLUTION phase
 * (steps 1-5 of the documented enforcement order) OR during the EFFECT
 * commit (step 6). Resolution-phase codes always carry ZERO durable side
 * effects (no repository `put` has run yet). The single effect-phase code
 * is {@link TEAM_RUNTIME_ERROR_CODES.DURABLE_WRITE_FAILED}; its bounded
 * partial-commit semantics are documented in
 * `action-router/effects.ts` (state change first, evidence fact second;
 * the state change — when committed — is authoritative, the missing fact
 * is detectable and repairable).
 *
 * Code families (documented order of the pipeline that raises them):
 * - request/addressing: REQUEST_MALFORMED, ACTION_UNKNOWN,
 *   ACTION_ADDRESSING_REJECTED, INSTANCE_NOT_FOUND;
 * - team resolution: TEAM_SESSION_NOT_FOUND, TEAM_ROOT_BINDING_MISSING,
 *   BLUEPRINT_UNRESOLVED, BLUEPRINT_HASH_MISMATCH;
 * - caller resolution: CALLER_NOT_FOUND, CALLER_ROLE_STALE,
 *   CALLER_AUTHORITY_DENIED;
 * - authority/envelope: ENVELOPE_OUT_OF_BOUNDS;
 * - compatibility/admission: COMPATIBILITY_BLOCKED, WORK_STATE_REJECTED;
 * - quota (creation actions; enforced inside the ActivationProvider step 7
 *   and mapped here): QUOTA_EXCEEDED_TEAM_INSTANCES,
 *   QUOTA_EXCEEDED_TEAM_CONCURRENT, QUOTA_EXCEEDED_TEMPLATE_INSTANCES,
 *   QUOTA_EXCEEDED_TEMPLATE_CONCURRENT;
 * - delegation/lifecycle/policy: DELEGATION_TARGET_UNRESOLVED,
 *   LIFECYCLE_TRANSITION_REJECTED, LIFECYCLE_COMMIT_UNAVAILABLE,
 *   POLICY_RESOLUTION_FAILED;
 * - durable commit: DURABLE_WRITE_FAILED.
 */
/** The closed TeamRuntime error codes. */
export declare const TEAM_RUNTIME_ERROR_CODES: {
    /** The action request is malformed (bad ids, missing/unknown fields). */
    readonly REQUEST_MALFORMED: "TEAM_RUNTIME_REQUEST_MALFORMED";
    /** The action name is outside the closed action vocabulary. */
    readonly ACTION_UNKNOWN: "TEAM_RUNTIME_ACTION_UNKNOWN";
    /**
     * Instance-first addressing violation: the target token is not an
     * instance id — it is a template id or a member label (or does not parse
     * as an instance id at all). Labels/templates are display vocabulary,
     * never action addressing (invariant 19).
     */
    readonly ACTION_ADDRESSING_REJECTED: "TEAM_RUNTIME_ACTION_ADDRESSING_REJECTED";
    /**
     * The target token parses as a valid instance id but no member record
     * exists for it in the team (unknown instance).
     */
    readonly INSTANCE_NOT_FOUND: "TEAM_RUNTIME_INSTANCE_NOT_FOUND";
    /** No TeamSession record for the root session id. */
    readonly TEAM_SESSION_NOT_FOUND: "TEAM_RUNTIME_TEAM_SESSION_NOT_FOUND";
    /** The TeamSession record exists but the team-root binding is missing. */
    readonly TEAM_ROOT_BINDING_MISSING: "TEAM_RUNTIME_TEAM_ROOT_BINDING_MISSING";
    /** The bound blueprint revision cannot be resolved from the catalog. */
    readonly BLUEPRINT_UNRESOLVED: "TEAM_RUNTIME_BLUEPRINT_UNRESOLVED";
    /** The resolved blueprint content hash differs from the bound ref. */
    readonly BLUEPRINT_HASH_MISMATCH: "TEAM_RUNTIME_BLUEPRINT_HASH_MISMATCH";
    /** The instance caller has no member record in the team. */
    readonly CALLER_NOT_FOUND: "TEAM_RUNTIME_CALLER_NOT_FOUND";
    /**
     * The caller's member record exists but its lifecycle is DISPOSED or
     * ARCHIVED: a stale caller cannot exercise any action (invariant 37
     * spirit: no unrestricted post-mortem authority).
     */
    readonly CALLER_ROLE_STALE: "TEAM_RUNTIME_CALLER_ROLE_STALE";
    /**
     * Role-level authority denial (e.g. the `delegate` action from a
     * non-leader caller, or a provider source-authority rejection surfaced
     * by the ActivationProvider).
     */
    readonly CALLER_AUTHORITY_DENIED: "TEAM_RUNTIME_CALLER_AUTHORITY_DENIED";
    /**
     * The action's mutation operation is outside the caller's effective
     * mutation envelope (fail closed: an absent envelope or an absent
     * operation = out-of-bounds, Architecture §5.4/§19.3).
     */
    readonly ENVELOPE_OUT_OF_BOUNDS: "TEAM_RUNTIME_ENVELOPE_OUT_OF_BOUNDS";
    /**
     * The compatibility gate blocks NEW WORK admission (invariant 50):
     * `details.status` is `BLOCKED_FATAL` or `BLOCKED_WARNING`.
     */
    readonly COMPATIBILITY_BLOCKED: "TEAM_RUNTIME_COMPATIBILITY_BLOCKED";
    /**
     * The work target's lifecycle is not work-accepting (CREATED/RUNNING/
     * SETTLED). ARCHIVED targets need an explicit restore first (invariant
     * 53); DISPOSED targets are gone.
     */
    readonly WORK_STATE_REJECTED: "TEAM_RUNTIME_WORK_STATE_REJECTED";
    /** Team-wide maxInstances exceeded (count+1 > limit, deterministic). */
    readonly QUOTA_EXCEEDED_TEAM_INSTANCES: "TEAM_RUNTIME_QUOTA_EXCEEDED_TEAM_INSTANCES";
    /** Team-wide maxConcurrent exceeded (count+1 > limit, deterministic). */
    readonly QUOTA_EXCEEDED_TEAM_CONCURRENT: "TEAM_RUNTIME_QUOTA_EXCEEDED_TEAM_CONCURRENT";
    /** Per-template maxInstances exceeded (count+1 > limit, deterministic). */
    readonly QUOTA_EXCEEDED_TEMPLATE_INSTANCES: "TEAM_RUNTIME_QUOTA_EXCEEDED_TEMPLATE_INSTANCES";
    /** Per-template maxConcurrent exceeded (count+1 > limit, deterministic). */
    readonly QUOTA_EXCEEDED_TEMPLATE_CONCURRENT: "TEAM_RUNTIME_QUOTA_EXCEEDED_TEMPLATE_CONCURRENT";
    /**
     * A delegation resolved to no admissible target (e.g. the explicit
     * instance is DISPOSED; invariant 25 / DevPlan M1-M5).
     */
    readonly DELEGATION_TARGET_UNRESOLVED: "TEAM_RUNTIME_DELEGATION_TARGET_UNRESOLVED";
    /** The requested lifecycle transition is illegal (domain/lifecycle). */
    readonly LIFECYCLE_TRANSITION_REJECTED: "TEAM_RUNTIME_LIFECYCLE_TRANSITION_REJECTED";
    /**
     * A lifecycle action (archive/restore/dispose) was admitted by every
     * gate, but no lifecycle commit port is injected (the P6-T2 default
     * wiring): the durable transition commit is the P7-T3 lifecycle
     * module's surface (TaskDoc P7-T3). Fail closed with ZERO durable
     * writes.
     */
    readonly LIFECYCLE_COMMIT_UNAVAILABLE: "TEAM_RUNTIME_LIFECYCLE_COMMIT_UNAVAILABLE";
    /**
     * The P7-T3 lifecycle procedure could not reach quiescence before the
     * durable commit (the frozen §30.1 order: quiesce/drain FIRST, then
     * commit): the live steps failed closed with ZERO durable writes.
     * `details` carries the P7-T3 lifecycle code and step trace.
     */
    readonly LIFECYCLE_NOT_QUIESCENT: "TEAM_RUNTIME_LIFECYCLE_NOT_QUIESCENT";
    /**
     * A live lifecycle step (interrupt/drain/residency release) faulted
     * after partial execution; the procedure aborted before any durable
     * commit (ZERO durable writes). `details` carries the P7-T3 lifecycle
     * code and step trace.
     */
    readonly LIFECYCLE_LIVE_EFFECT_FAILED: "TEAM_RUNTIME_LIFECYCLE_LIVE_EFFECT_FAILED";
    /** Effective policy resolution failed (fail closed). */
    readonly POLICY_RESOLUTION_FAILED: "TEAM_RUNTIME_POLICY_RESOLUTION_FAILED";
    /**
     * A durable effect commit faulted (seam/repository fault). Bounded
     * partial-commit semantics: see `action-router/effects.ts`.
     */
    readonly DURABLE_WRITE_FAILED: "TEAM_RUNTIME_DURABLE_WRITE_FAILED";
    /**
     * The admitted work unit's model-visible delivery to the member's child
     * session failed (P8-S3 work chain, R6): the chain has already settled
     * fail-closed (RUNNING -> SETTLED through the lifecycle commit port; the
     * settlement fact carries `workOutcome: 'delivery-failed'`) — no fake
     * RUNNING success is left behind, and the frozen FSM has no
     * RUNNING -> CREATED edge. `details.cause` carries the delivery fault.
     */
    readonly WORK_DELIVERY_FAILED: "TEAM_RUNTIME_WORK_DELIVERY_FAILED";
};
/** One of the closed TeamRuntime error codes. */
export type TeamRuntimeErrorCode = (typeof TEAM_RUNTIME_ERROR_CODES)[keyof typeof TEAM_RUNTIME_ERROR_CODES];
/** Every TeamRuntime error code value, for membership checks. */
export declare const TEAM_RUNTIME_ERROR_CODE_VALUES: readonly string[];
/**
 * The fail-closed TeamRuntime error.
 *
 * Branch on `code` (and `details`), never on the message text.
 */
export declare class TeamRuntimeError extends Error {
    /** The stable closed error code. */
    readonly code: TeamRuntimeErrorCode;
    /** Stable, lossless-JSON diagnostic details (optional). */
    readonly details?: Record<string, unknown>;
    constructor(code: TeamRuntimeErrorCode, message: string, details?: Record<string, unknown>);
}
/** Type guard: is `value` a {@link TeamRuntimeError}? */
export declare function isTeamRuntimeError(value: unknown): value is TeamRuntimeError;
//# sourceMappingURL=errors.d.ts.map