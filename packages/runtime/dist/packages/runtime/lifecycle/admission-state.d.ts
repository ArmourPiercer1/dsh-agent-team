/**
 * P7-T3 + PD20-B1 — the PROCESS-LOCAL "an archive/dispose has been requested
 * for this Member" state, published so the Member's ADMISSION LAYER can refuse
 * a NEW execution at the NEXT TOOL BOUNDARY instead of waiting for the
 * in-flight turn to end.
 *
 * WHY THIS MODULE EXISTS (measured, `dev/agent-workflow/evidence/a5sf-recon-shell`
 * defect B-1). `team_archive_member` runs the frozen quiesce (step 1
 * close-admission → … → commit), and `team_archive_member`'s description
 * promised that "its current work is interrupted". The measured behaviour was
 * narrower: the procedure's admission close had exactly ONE consumer — the Team
 * tool-dispatch route in the live bindings (`ensureLiveAgent` / `executeTool`).
 * A RUNNING Member's own turn does NOT pass through that route: it executes its
 * tool calls inside its live Agent, so after the archive request arrived it kept
 * obtaining NEW confined terminal sessions for as long as its turn lasted
 * (measured window 8.56 s / 8.72 s across two boots; a second `bash` started
 * 290 ms / 427 ms BEFORE the durable commit). Every one of those commands was
 * still lane-constrained — this was never an authority hole — but "archiving
 * stops the Member" was not true while the window was open.
 *
 * WHAT THIS MODULE IS. A map from the Member's child-session id / instance id to
 * the closed-admission stamp, written by the lifecycle QUIESCE PROCEDURE itself
 * right after `AdmissionClosePort` step 1 (`closeNewWork`) returns, and cleared by
 * the procedure's `reopenAdmission` on EVERY exit (committed, aborted, faulted).
 * Publishing it in the procedure — not in the port's live binding — keeps the
 * protected center untouched and makes the lifetime the procedure's own. The
 * reader is the Member's lane guard (`createMemberFsGuard`), which sits in front
 * of EVERY member execution face (confined `fs` / `subprocess` / `terminals` /
 * search / web): a tool the turn starts after the close is refused with the
 * typed `LIFECYCLE_ADMISSION_CLOSED` before any byte is read or any child is
 * spawned.
 *
 * WHAT THIS MODULE IS NOT. It is not a policy source (no rule, lane, ceiling or
 * vocabulary is held here), not a second strategy authority, and not durable
 * state: the durable MemberInstance row stays the authority before and after the
 * procedure. The window this covers is exactly the in-process one between the
 * close (step 1) and the durable commit, which no durable read can observe.
 *
 * @module @dsh-agent-team/runtime/lifecycle/admission-state
 */
/** The one code both halves of the close use (bindings and lane guard). */
export declare const LIFECYCLE_ADMISSION_CLOSED = "LIFECYCLE_ADMISSION_CLOSED";
/** The closed-admission stamp of one Member. */
export interface MemberAdmissionClose {
    /** The member instance the procedure is running for (the lane guard's key). */
    readonly instanceId: string;
    /** The Team root the procedure was requested under. */
    readonly rootSessionId: string;
    /** The Member's child session (the live binding's key). */
    readonly childSessionId: string;
}
/**
 * The typed refusal a closed admission raises. It is deliberately NOT a
 * `TeamIoDenial`: the closed lane vocabulary is about locators and modes, and
 * this refusal happens before any locator is even looked at. The code is the
 * same one the live bindings' in-process admission gate already used, so the
 * whole close keeps ONE vocabulary and one meaning.
 */
export declare class LifecycleAdmissionClosedError extends Error {
    readonly code = "LIFECYCLE_ADMISSION_CLOSED";
    readonly instanceId: string;
    readonly rootSessionId: string;
    readonly method: string;
    readonly target: string;
    constructor(closed: MemberAdmissionClose, method: string, target: string);
}
/**
 * Mark the Member's admission CLOSED (the live `AdmissionClosePort` step 1).
 * Idempotent: a repeated close for the same identity keeps the FIRST stamp, so
 * a retried procedure cannot shorten the window it observes.
 * @param input - the composite identity of the closing Member.
 * @param input.childSessionId - the Member's durable child session id.
 * @param input.instanceId - the Member instance id (the lane guard's key).
 * @param input.rootSessionId - the Team root the procedure runs under.
 * @returns the stamp now in force.
 */
export declare function markMemberAdmissionClosed(input: {
    readonly childSessionId: unknown;
    readonly instanceId: unknown;
    readonly rootSessionId: unknown;
}): MemberAdmissionClose;
/**
 * REOPEN the Member's admission (the live `reopenNewWork`, run on every exit of
 * the procedure). Idempotent: an unknown/never-closed session is a no-op — the
 * durable row is the authority from there on.
 * @param childSessionId - the Member's durable child session id.
 * @returns whether a stamp was cleared.
 */
export declare function clearMemberAdmissionClosed(childSessionId: unknown): boolean;
/**
 * REOPEN by INSTANCE id alone — the shape the lifecycle's `reopenAdmission`
 * has (it receives only the composite target, not the durable member record).
 * Idempotent, and identical in effect to {@link clearMemberAdmissionClosed}.
 * @param instanceId - the member instance id.
 * @returns whether a stamp was cleared.
 */
export declare function clearMemberAdmissionClosedForInstance(instanceId: unknown): boolean;
/**
 * The close stamp in force for one Member instance, if any (the lane guard's
 * read; `createMemberFsGuard` holds the compiled `MemberPolicy` whose
 * `memberIdentity` IS the instance id).
 * @param instanceId - the member instance id.
 * @returns the stamp, or `undefined` when admission is open.
 */
export declare function memberAdmissionCloseOf(instanceId: unknown): MemberAdmissionClose | undefined;
/**
 * The close stamp in force for one Member child session, if any (the live
 * tool-dispatch route's read).
 * @param childSessionId - the Member's child session id.
 * @returns the stamp, or `undefined` when admission is open.
 */
export declare function memberAdmissionCloseOfSession(childSessionId: unknown): MemberAdmissionClose | undefined;
/**
 * The typed tool-boundary refusal for a closed Member, or `null` when its
 * admission is open. Pure construction; the caller throws it.
 * @param input - the identity to test plus the refused operation's shape.
 * @param input.instanceId - the member instance id (preferred key).
 * @param input.childSessionId - the member child session id (fallback key).
 * @param input.method - the refused operation (e.g. `spawn`, `writeText`).
 * @param input.target - the refused target (a path, a cwd, a locator).
 * @returns the refusal, or `null`.
 */
export declare function memberAdmissionRefusal(input: {
    readonly instanceId?: unknown;
    readonly childSessionId?: unknown;
    readonly method: string;
    readonly target: string;
}): LifecycleAdmissionClosedError | null;
/**
 * Drop every stamp. TEST-ONLY: the production lifetime is owned by the
 * lifecycle procedure (`closeNewWork` / `reopenNewWork`); a suite that leaves a
 * stamp behind would silently close another member's lane in the same process.
 */
export declare function resetMemberAdmissionStateForTest(): void;
//# sourceMappingURL=admission-state.d.ts.map