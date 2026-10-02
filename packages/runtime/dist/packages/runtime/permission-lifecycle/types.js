/**
 * Alpha.3 PR4 — the permission LIFECYCLE lane: the closed vocabulary.
 *
 * The five-PR split of the Alpha.3 permission governance capability lands
 * here at PR4. PR1 shipped the durable `PermissionOverlaySnapshot` and its
 * persistence-only port; PR2 the `EffectivePermissionAssembler`; PR3 the ONE
 * mutation authority (`GovernanceMutationService.mutatePermission`) with the
 * pure kernel. PR4 is the PR the PR1 port doc already names
 * (`permission-governance/port.ts`: "the lifecycle rules (ADR §5, §8) belong
 * to the mutation service and to PR4"): it makes the durable authority
 *usable across the MemberInstance lifecycle WITHOUT owning any of it:
 *
 * - **NO second mutation authority.** `grant` / `revoke` here are typed
 *   ENTRY points that build a `GovernancePermissionMutationArgs` and hand it
 *   to `GovernanceMutationService.mutatePermission` — the sole permission
 *   mutation authority (ADR §1/§5). This lane performs ZERO durable writes
 *   of its own: it never touches the overlay port's `append`, and the port
 *   (three members: `append`/`latest`/`history`) stays the only durable
 *   write target. The `a3p3-governance-lane-hygiene` consumer pin therefore
 *   still holds in substance: one authority, one write path.
 * - **NO delete, NO replay, NO inheritance** (plan PR4 "revoke creates
 *   snapshot; no delete; no inheritance"; ADR §2 "History: audit only",
 *   "No event replay is used for execution"). Revoking appends a NEW FULL
 *   snapshot; nothing is ever removed, and no new MemberInstance ever reads
 *   another instance's overlay (the overlay identity is
 *   `(teamSessionId, memberInstanceId)` and the port reads per-identity).
 * - **Restore is a LIFECYCLE fact, not a permission write** (parent ruling,
 *   ADR §8): restore is the SAME MemberInstance returning from `ARCHIVED`;
 *   it KEEPS the CURRENT latest overlay. No historical snapshot is replayed,
 *   no revoked grant is resurrected, and NO decorative rule write happens
 *   "so that it went through a mutation". If — and only if — the rules must
 *   genuinely change at restore time, the caller submits that change as an
 *   ordinary `PermissionMutation` through the authority.
 * - **The read plane stays the merged two-stage plane** (ADR §3): this lane
 *   loads the LATEST overlay and hands it to PR2's
 *   `assembleEffectivePermissionPolicy` + `resolveEffectiveOperationPermission`,
 *   which call the FROZEN Alpha.2 `resolveOperationPermission`. This lane
 *   implements NO precedence of its own.
 *
 * Execution gating follows ADR §8 verbatim:
 *
 *     RUNNING   — overlay effective
 *     ARCHIVED  — overlay retained; execution disabled
 *     DISPOSED  — overlay historical only; never effective
 *     new instance — no inheritance
 *
 * The gate is therefore a refusal to EXECUTE, never a deletion or a rewrite:
 * an ARCHIVED instance's overlay is untouched and the SAME instance that
 * returns from ARCHIVED continues under the authority that is current at
 * that moment.
 *
 * Pure by construction: zero `node:` builtins, zero upstream imports, zero
 * I/O. Every durable/runtime fact arrives through an injected port.
 *
 * @module @dsh-agent-team/runtime/permission-lifecycle/types
 */
// ---------------------------------------------------------------------------
// The refusal vocabulary (typed, closed, never a silent no)
// ---------------------------------------------------------------------------
/**
 * The closed codes this lane may refuse with. Every one of them is a
 * fail-closed refusal with a ZERO-WRITE guarantee: the lane refuses BEFORE
 * it calls the mutation authority, BEFORE it calls the lifecycle path, or
 * (for the read plane) BEFORE any decision is reported.
 */
export const PERMISSION_LIFECYCLE_ERROR_CODES = Object.freeze({
    /** The addressed MemberInstance has no durable row in this TeamSession. */
    INSTANCE_UNKNOWN: 'PERMISSION_LIFECYCLE_INSTANCE_UNKNOWN',
    /** The addressed MemberInstance is DISPOSED: its overlay is historical
     *  only (ADR §8), so a NEW mutation against it is meaningless and refused. */
    TARGET_TERMINAL: 'PERMISSION_LIFECYCLE_TARGET_TERMINAL',
    /** Execution refused: the instance is ARCHIVED (overlay retained,
     *  execution disabled — ADR §8). */
    EXECUTION_ARCHIVED: 'PERMISSION_LIFECYCLE_EXECUTION_ARCHIVED',
    /** Execution refused: the instance is DISPOSED (terminal). */
    EXECUTION_TERMINAL: 'PERMISSION_LIFECYCLE_EXECUTION_TERMINAL',
    /** Execution refused: the instance lifecycle is UNKNOWN (no row). Unknown
     *  is never treated as RUNNING and never as ARCHIVED. */
    EXECUTION_STATE_UNKNOWN: 'PERMISSION_LIFECYCLE_EXECUTION_STATE_UNKNOWN',
    /** The restore path is not wired (no lifecycle port injected): restore is
     *  refused rather than performed by any substitute path. */
    RESTORE_UNCONFIGURED: 'PERMISSION_LIFECYCLE_RESTORE_UNCONFIGURED',
    /** The decision site supplied NO static permission facts. UNKNOWN lower
     *  layers are never conflated with a declared-none baseline (the PR3
     *  kernel's ruling), so no effective answer is reported. */
    STATIC_FACTS_UNKNOWN: 'PERMISSION_LIFECYCLE_STATIC_FACTS_UNKNOWN',
    /** A durable overlay rule's carrier cannot be projected onto the canonical
     *  matcher vocabulary for this decision. The rule is never silently
     *  dropped (a dropped deny would retire it) — the decision refuses. */
    OVERLAY_VIEW_UNDECODABLE: 'PERMISSION_LIFECYCLE_OVERLAY_VIEW_UNDECODABLE',
    /** The current authority carries an EXEC-class rule that would govern THIS
     *  decision, but the frozen Alpha.2 matcher is structurally inert for
     *  exec identities (`ruleMatches` requires a `kind:'file'` resource for an
     *  `exact` rule — the recorded bash ruling). Consuming it would need an
     *  exec-identity plane this PR does not own; the lane refuses typed
     *  instead of answering with a rule it cannot judge. */
    EXEC_PLANE_UNAVAILABLE: 'PERMISSION_EXEC_OVERLAY_PLANE_UNAVAILABLE',
    /** The PR2 assembler refused the assembly (a foreign snapshot, an
     *  incomplete view, a malformed section). Never guessed around. */
    ASSEMBLY_FAILED: 'PERMISSION_LIFECYCLE_ASSEMBLY_FAILED',
});
/** A typed refusal of this lane (never a bare `Error`, never a silent no). */
export class PermissionLifecycleError extends Error {
    code;
    details;
    constructor(code, message, details = {}) {
        super(message);
        this.name = 'PermissionLifecycleError';
        this.code = code;
        this.details = Object.freeze({ ...details });
    }
}
//# sourceMappingURL=types.js.map