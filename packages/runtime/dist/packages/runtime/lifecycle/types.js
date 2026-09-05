/**
 * P7-T3 — MemberInstance lifecycle runtime (Archive / Restore / Dispose +
 * descendant drain): the port, request, result, and step vocabulary.
 *
 * Authority (frozen, verbatim):
 *
 * - DevPlan §20.3 — the four procedures:
 *
 *   ```text
 *   Archive:  close admission → interrupt → drain descendants
 *             → wait quiescence → release residency → commit ARCHIVED
 *   Restore:  ARCHIVED → SETTLED   (不得 resume Agent)
 *   Dispose:  quiesce → DISPOSED terminal   (历史不删除)
 *   ```
 *
 * - Architecture §29 (the MemberInstance FSM; CREATED/RUNNING/SETTLED/
 *   ARCHIVED/DISPOSED are MEMBER states, §8.6), §30.1 (quiesce FIRST, then
 *   the durable transition; the "write ARCHIVED then try to stop Agent"
 *   order is forbidden), §30.2 (Restore = frozen semantics 3A: durable
 *   availability only; no model call, no prompt, no turn, no live Agent
 *   residency, no direct RUNNING), §30.4 (Dispose: close admission →
 *   interrupt → quiesce/drain → release → commit DISPOSED; history is not
 *   deleted), §31 (lifecycle != residency).
 *
 * - G7 criterion (DevPlan §20.7): "Restore does not create/resume Agent".
 *
 * Design discipline (ruling R28, one injected interface per effect):
 * every live-runtime contact of this module is an INJECTED port — the
 * admission-close step, the member-activity interrupt, the public
 * descendant seam (P2-T2/P2-T5 characterized: generic descendant
 * enumeration / interrupt / drain over the public `subagents` + `agents`
 * API), and the P5-T6 {@link ResidencyPort} (residency release). The
 * durable authority is the injected TeamDomain (invariant 41). The real
 * DSH public-seam binding lands with the P7-T7 real-instance E2E; the unit
 * and integration layers bind mock-first fakes (this wave: NO real DSH
 * instance, H1 scope ruling).
 *
 * This module NEVER imports upstream code and NEVER reaches into the agent
 * runtime directly: the zero-core budget (CORE PATCH BUDGET = 0) and the
 * p4t6 vocabulary quarantine are enforced by the canonical chain.
 *
 * @module @dsh-agent-team/runtime/lifecycle/types
 */
/**
 * The closed, ORDERED procedure-step vocabulary (kebab names). Every
 * lifecycle operation returns the steps it executed, in execution order —
 * the trace is the machine-checkable evidence that the runtime honored the
 * frozen §20.3/§30.1 order (quiesce BEFORE the durable commit; Restore has
 * exactly one step: the durable commit).
 *
 * `commit-settle` exists because the frozen §29 FSM has no RUNNING→ARCHIVED
 * edge: archiving a RUNNING member durably settles the interrupted work
 * FIRST (RUNNING→SETTLED, "turn/work settles") and then archives
 * (SETTLED→ARCHIVED). The live quiescence (interrupt + drain) precedes
 * BOTH commits (§30.1).
 */
export const LIFECYCLE_STEP_NAMES = {
    /** Step 1 — close new-work admission for the member (DevPlan §20.3 step 1). */
    CLOSE_ADMISSION: 'close-admission',
    /** Step 2 — cancel/interrupt the member's current activity (DevPlan §20.3 step 2). */
    INTERRUPT: 'interrupt',
    /** Step 3 — drain the resident generic descendants (DevPlan §20.3 step 3). */
    DRAIN_DESCENDANTS: 'drain-descendants',
    /** Step 4 — the quiescence observation (DevPlan §20.3 step 4). */
    WAIT_QUIESCENCE: 'wait-quiescence',
    /** Step 5 — release the resident Agent handle (DevPlan §20.3 step 5). */
    RELEASE_RESIDENCY: 'release-residency',
    /** Durable commit 1 (archive of a RUNNING member only) — the SETTLE. */
    COMMIT_SETTLE: 'commit-settle',
    /** Durable commit 2 — the ARCHIVED state (DevPlan §20.3 step 6). */
    COMMIT_ARCHIVE: 'commit-archive',
    /** The single Restore commit — ARCHIVED→SETTLED, durable only (§30.2 3A). */
    COMMIT_RESTORE: 'commit-restore',
    /** The single Dispose commit — the DISPOSED terminal state (§30.4). */
    COMMIT_DISPOSE: 'commit-dispose',
};
/** Every step-name value, for membership checks. */
export const LIFECYCLE_STEP_NAME_VALUES = Object.values(LIFECYCLE_STEP_NAMES);
//# sourceMappingURL=types.js.map