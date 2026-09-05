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
import { MEMBER_LIFECYCLE_STATES } from '../../../contracts/src/index.js';
const { CREATED, RUNNING, SETTLED, ARCHIVED, DISPOSED } = MEMBER_LIFECYCLE_STATES;
/**
 * The frozen lifecycle operation vocabulary. Every legal §29 edge is covered
 * by exactly one operation; an operation is a named, semantically complete
 * durable transition (the runtime maps runtime procedures — quiesce, admit,
 * settle — onto these before committing the durable state change).
 */
export const LIFECYCLE_OPERATIONS = {
    /** Admit new work: `CREATED -> RUNNING` (§29 "new admitted work") or `SETTLED -> RUNNING` (§30.3 "Resume / new work"). */
    ADMIT_WORK: 'ADMIT_WORK',
    /** The current admitted work has finished: `RUNNING -> SETTLED` (§29 "turn/work settles"). */
    SETTLE: 'SETTLE',
    /** Move to ARCHIVED after quiescence: `SETTLED -> ARCHIVED` (§30.1; quiesce first, then commit). */
    ARCHIVE: 'ARCHIVE',
    /** Restore durable availability only: `ARCHIVED -> SETTLED` (§30.2 frozen 3A — never to RUNNING). */
    RESTORE: 'RESTORE',
    /** Terminal disposal from any non-terminal state: `-> DISPOSED` (§30.4; §29.5 terminal). */
    DISPOSE: 'DISPOSE',
};
/** Every operation value, for membership checks. */
export const LIFECYCLE_OPERATION_VALUES = Object.values(LIFECYCLE_OPERATIONS);
/** Type guard for the operation vocabulary. */
export function isLifecycleOperation(value) {
    return typeof value === 'string' && LIFECYCLE_OPERATION_VALUES.includes(value);
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
export const LIFECYCLE_OPERATION_RULES = {
    ADMIT_WORK: { sources: [CREATED, SETTLED], target: RUNNING },
    SETTLE: { sources: [RUNNING], target: SETTLED },
    ARCHIVE: { sources: [SETTLED], target: ARCHIVED },
    RESTORE: { sources: [ARCHIVED], target: SETTLED },
    DISPOSE: { sources: [CREATED, RUNNING, SETTLED, ARCHIVED], target: DISPOSED },
};
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
export const LIFECYCLE_TRANSITION_MATRIX = (() => {
    const matrix = {
        [CREATED]: [],
        [RUNNING]: [],
        [SETTLED]: [],
        [ARCHIVED]: [],
        [DISPOSED]: [],
    };
    for (const rule of Object.values(LIFECYCLE_OPERATION_RULES)) {
        for (const source of rule.sources) {
            if (!matrix[source].includes(rule.target)) {
                matrix[source].push(rule.target);
            }
        }
    }
    for (const state of Object.keys(matrix)) {
        matrix[state] = Object.freeze(matrix[state]);
    }
    return Object.freeze(matrix);
})();
//# sourceMappingURL=operations.js.map