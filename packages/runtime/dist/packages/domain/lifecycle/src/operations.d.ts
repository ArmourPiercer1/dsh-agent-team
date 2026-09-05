/**
 * MemberInstance lifecycle operations and the §29 transition matrix.
 *
 * Authority (Architecture, frozen):
 *
 * - **§29 FSM** — the single source for the legal edges:
 *
 *   ```text
 *   CREATED --new admitted work--> RUNNING --turn/work settles--> SETTLED
 *   SETTLED --new work / Resume--> RUNNING
 *   SETTLED --Archive------------> ARCHIVED --Restore--> SETTLED
 *   CREATED | RUNNING | SETTLED | ARCHIVED --Dispose--> DISPOSED (terminal)
 *   ```
 *
 * - **§30.1 Archive** — "必须先 quiesce，再 durable transition" (quiesce first,
 *   then commit): the durable edge to ARCHIVED exists only from the quiescent
 *   SETTLED state; there is no RUNNING→ARCHIVED edge.
 * - **§30.2 Restore (final frozen semantics 3A)** — Restore is ONLY
 *   `ARCHIVED -> SETTLED`; it restores durable availability only and MUST NOT
 *   transition directly to RUNNING (no model call, no prompt, no turn, no live
 *   Agent residency).
 * - **§30.3 Resume / new work** — `SETTLED -> RUNNING` is admitted new work
 *   (same edge as `CREATED -> RUNNING`: ADMIT_WORK).
 * - **§30.4 Dispose** — any non-terminal state may be disposed; §29.5 makes
 *   DISPOSED terminal.
 *
 * The matrix is DERIVED from the operation rules (single source of truth), so
 * the (from, to) matrix and the operation API cannot drift apart.
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/domain/lifecycle/operations
 */
import type { MemberLifecycleState } from '../../../contracts/src/index.js';
/**
 * The frozen lifecycle operation vocabulary. Every legal §29 edge is covered
 * by exactly one operation; an operation is a named, semantically complete
 * durable transition (the runtime maps runtime procedures — quiesce, admit,
 * settle — onto these before committing the durable state change).
 */
export declare const LIFECYCLE_OPERATIONS: {
    /** Admit new work: `CREATED -> RUNNING` (§29 "new admitted work") or `SETTLED -> RUNNING` (§30.3 "Resume / new work"). */
    readonly ADMIT_WORK: "ADMIT_WORK";
    /** The current admitted work has finished: `RUNNING -> SETTLED` (§29 "turn/work settles"). */
    readonly SETTLE: "SETTLE";
    /** Move to ARCHIVED after quiescence: `SETTLED -> ARCHIVED` (§30.1; quiesce first, then commit). */
    readonly ARCHIVE: "ARCHIVE";
    /** Restore durable availability only: `ARCHIVED -> SETTLED` (§30.2 frozen 3A — never to RUNNING). */
    readonly RESTORE: "RESTORE";
    /** Terminal disposal from any non-terminal state: `-> DISPOSED` (§30.4; §29.5 terminal). */
    readonly DISPOSE: "DISPOSE";
};
/** A lifecycle operation name. */
export type LifecycleOperation = (typeof LIFECYCLE_OPERATIONS)[keyof typeof LIFECYCLE_OPERATIONS];
/** Every operation value, for membership checks. */
export declare const LIFECYCLE_OPERATION_VALUES: readonly string[];
/** Type guard for the operation vocabulary. */
export declare function isLifecycleOperation(value: unknown): value is LifecycleOperation;
/** One rule of the lifecycle FSM: which source states may perform the operation, and where it lands. */
export interface LifecycleOperationRule {
    /** The lifecycle states from which the operation is legal. */
    readonly sources: readonly MemberLifecycleState[];
    /** The single target state the operation commits to. */
    readonly target: MemberLifecycleState;
}
/**
 * The frozen operation rules (the §29 FSM in operation form).
 *
 * - ADMIT_WORK: sources `CREATED`, `SETTLED`; target `RUNNING`.
 * - SETTLE: source `RUNNING`; target `SETTLED`.
 * - ARCHIVE: source `SETTLED` only (§30.1 — a running member must quiesce to
 *   SETTLED before the durable ARCHIVED commit; no RUNNING→ARCHIVED edge).
 * - RESTORE: source `ARCHIVED` only, target `SETTLED` (§30.2 frozen 3A:
 *   Restore is ONLY ARCHIVED→SETTLED and never transitions to RUNNING).
 * - DISPOSE: sources `CREATED`, `RUNNING`, `SETTLED`, `ARCHIVED`; target
 *   `DISPOSED` (§30.4; §29.5 terminal).
 */
export declare const LIFECYCLE_OPERATION_RULES: Readonly<Record<LifecycleOperation, LifecycleOperationRule>>;
/**
 * The derived (from, to) transition matrix: for each source state, the exact
 * set of legal target states. Derived from {@link LIFECYCLE_OPERATION_RULES}
 * so the two views are consistent by construction.
 *
 * Frozen content (9 legal edges of 25 possible pairs):
 *
 * | from     | to                                    |
 * |----------|---------------------------------------|
 * | CREATED  | RUNNING, DISPOSED                     |
 * | RUNNING  | SETTLED, DISPOSED                     |
 * | SETTLED  | RUNNING, ARCHIVED, DISPOSED           |
 * | ARCHIVED | SETTLED, DISPOSED                     |
 * | DISPOSED | (none — terminal)                     |
 */
export declare const LIFECYCLE_TRANSITION_MATRIX: Readonly<Record<MemberLifecycleState, readonly MemberLifecycleState[]>>;
//# sourceMappingURL=operations.d.ts.map