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
import type { MemberInstanceRecordDto, MemberLifecycleState } from '../../contracts/src/index.js';
import type { TeamDomain } from '../../storage/repositories/index.js';
import type { ResidencyPort } from '../member-residency/index.js';
import type { LifecycleCommitPort } from '../admission/index.js';
/**
 * The composite member identity addressed by one lifecycle operation
 * (instanceId-first, invariant 19: no label/template addressing). Validated
 * fail-closed with the P5-T6 identity gate (`validateMemberIdentityInput`)
 * before any read or effect.
 */
export interface LifecycleTarget {
    /** The TeamSession (root session id) the member belongs to. */
    readonly rootSessionId: string;
    /** The member's stable instance id (unique within the team). */
    readonly instanceId: string;
}
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
export declare const LIFECYCLE_STEP_NAMES: {
    /** Step 1 — close new-work admission for the member (DevPlan §20.3 step 1). */
    readonly CLOSE_ADMISSION: "close-admission";
    /** Step 2 — cancel/interrupt the member's current activity (DevPlan §20.3 step 2). */
    readonly INTERRUPT: "interrupt";
    /** Step 3 — drain the resident generic descendants (DevPlan §20.3 step 3). */
    readonly DRAIN_DESCENDANTS: "drain-descendants";
    /** Step 4 — the quiescence observation (DevPlan §20.3 step 4). */
    readonly WAIT_QUIESCENCE: "wait-quiescence";
    /** Step 5 — release the resident Agent handle (DevPlan §20.3 step 5). */
    readonly RELEASE_RESIDENCY: "release-residency";
    /** Durable commit 1 (archive of a RUNNING member only) — the SETTLE. */
    readonly COMMIT_SETTLE: "commit-settle";
    /** Durable commit 2 — the ARCHIVED state (DevPlan §20.3 step 6). */
    readonly COMMIT_ARCHIVE: "commit-archive";
    /** The single Restore commit — ARCHIVED→SETTLED, durable only (§30.2 3A). */
    readonly COMMIT_RESTORE: "commit-restore";
    /** The single Dispose commit — the DISPOSED terminal state (§30.4). */
    readonly COMMIT_DISPOSE: "commit-dispose";
};
/** One procedure-step name. */
export type LifecycleStepName = (typeof LIFECYCLE_STEP_NAMES)[keyof typeof LIFECYCLE_STEP_NAMES];
/** Every step-name value, for membership checks. */
export declare const LIFECYCLE_STEP_NAME_VALUES: readonly string[];
/**
 * The ADMISSION-CLOSE port — DevPlan §20.3 step 1 ("close admission").
 *
 * The live first step of Archive and Dispose: from this call on, NO new
 * work may be admitted for the addressed member while the quiescence
 * procedure runs. In the real instance this is the live admission guard of
 * the P6 admission/activation pipeline (the durable COMMIT of the terminal
 * state is what durably blocks new work through the P6 work-accepting gate;
 * the live close covers the in-process window between the call and the
 * commit). Mock-first in this wave; the real binding is P7-T7.
 *
 * Contract (fail-loud): a fault propagates (the module maps it to
 * `LIFECYCLE_LIVE_EFFECT_FAILED` on step `close-admission`; no later step
 * runs, zero durable writes).
 */
export interface AdmissionClosePort {
    /**
     * Close new-work admission for one member.
     * @param target - the composite member identity.
     */
    closeNewWork(target: LifecycleTarget): Promise<void>;
}
/**
 * The MEMBER-ACTIVITY port — DevPlan §20.3 step 2 ("interrupt";
 * Architecture §30.1 "cancel/interrupt current Member activity").
 *
 * Cancels the member's current in-flight activity (the running turn). It
 * MUST be a no-op when no activity is in flight (a SETTLED/CREATED/ARCHIVED
 * member has nothing to interrupt — absence is not an error, mirroring the
 * P5-T6 residency "the handle may be absent" discipline).
 *
 * Contract (fail-loud): a fault propagates (mapped to
 * `LIFECYCLE_LIVE_EFFECT_FAILED` on step `interrupt`; no later step runs,
 * zero durable writes).
 */
export interface MemberActivityPort {
    /**
     * Interrupt the member's current activity (no-op when none is running).
     * @param target - the composite member identity.
     */
    interrupt(target: LifecycleTarget): Promise<void>;
}
/**
 * The observation of one descendant drain (DevPlan §20.3 step 3–4: "drain
 * descendants → wait quiescence").
 */
export interface DescendantDrainReport {
    /** The number of descendants the drain stopped/settled (0 = none resident). */
    readonly drained: number;
    /**
     * Whether, after the drain, NO continuable descendant activity remains
     * (the quiescence observation, Architecture §30.1 "wait for quiescence").
     * `false` fails the procedure closed: the module does NOT commit any
     * durable transition (the forbidden "write then stop" order cannot occur).
     */
    readonly quiescent: boolean;
}
/**
 * The DESCENDANT-DRAIN port — the PUBLIC DESCENDANT SEAM (DevPlan §20.3
 * step 3; Architecture §30.1 "drain resident generic descendants").
 *
 * Real-world binding (P7-T7, over the P2-T2/P2-T5 characterized public
 * API): recursive enumeration of the member child session's descendants +
 * `subagents.interrupt` / `subagents.drainContinuableDescendants` — the
 * generic descendant machinery, never a Team-specific channel. Mock-first
 * in this wave.
 *
 * Contract (fail-loud): a fault propagates (mapped to
 * `LIFECYCLE_LIVE_EFFECT_FAILED` on step `drain-descendants`; no later step
 * runs, zero durable writes). A report with `quiescent: false` is NOT a
 * fault — it is the quiescence NEGATIVE (the procedure fails closed with
 * `LIFECYCLE_NOT_QUIESCENT`, zero durable writes, residency NOT released).
 */
export interface DescendantDrainPort {
    /**
     * Drain the resident generic descendants of one member child session.
     * @param childSessionId - the member's durable child session (the
     *   descendant root; invariant 23/24: the binding is never re-pointed).
     * @returns the drain + quiescence observation.
     */
    drainDescendants(childSessionId: string): Promise<DescendantDrainReport>;
}
/**
 * The injected port bundle of ONE lifecycle service instance.
 *
 * - `teamDomain` — the durable Team control-plane authority (invariant 41);
 *   this module reads the MemberInstance records through it and NEVER
 *   rewrites them itself: the `member_instances` store is append-only per
 *   record (P4: a different record at an occupied key is a conflict;
 *   member records are written exactly once by the ActivationProvider,
 *   invariant 26);
 * - `commit` — the P6-T2 {@link LifecycleCommitPort}: the durable commit
 *   of the FSM-validated lifecycle transition (this module's surface per
 *   the P6-T2 contract: "the durable commit of lifecycle transitions —
 *   including the Architecture §30 quiesce-then-commit procedures — is the
 *   P7-T3 lifecycle module's surface"). The commit carries the exact
 *   transition `{ rootSessionId, instanceId, from, operation, to }`;
 * - `admission` / `activity` / `descendants` — the live quiescence ports
 *   (the P2-T2 agent-lifecycle public surface, mock-first in this wave);
 * - `residency` — the P5-T6 {@link ResidencyPort} public surface (residency
 *   release; `hasResidency`/`dropResidency`).
 *
 * The RESTORE path NEVER consults `admission`, `activity`, `descendants`,
 * or `residency` — the G7 criterion "Restore does not create/resume Agent"
 * is structural here and asserted by the p7t3-restore-no-agent suite.
 *
 * `evidence` — the OPTIONAL durable evidence port: after each committed
 * standalone operation the service commits the `member-lifecycle-changed`
 * fact (UI doc §27.2). The ledger append is the generation-advancing
 * durable write — without it the member-row transition would never
 * advance the team generation, and the post-op projection pull would
 * return the pre-op generation: the client's frozen pull verdict would
 * classify the fresh data as a `duplicate` and drop the updated frame
 * (the S7 die of the attempt-31 vertical, bug #9). Absent → the service
 * commits no evidence (the P7-T3 test worlds without a ledger binding).
 */
/**
 * The evidence of one committed standalone lifecycle operation: the
 * pre-op `from` (the durable read under the same team lock) and the
 * committed `to` + the full step trace. The service passes exactly ONE
 * of these per successful operation — the RUNNING archive's settle +
 * archive are ONE operation, ONE fact.
 */
export interface LifecycleEvidenceArgs {
    readonly rootSessionId: string;
    readonly instanceId: string;
    /** Which service operation committed the transition. */
    readonly operation: 'archive' | 'restore' | 'dispose';
    /** The lifecycle before the operation (the pre-op durable read). */
    readonly from: MemberLifecycleState;
    /** The lifecycle after the operation (the committed record). */
    readonly to: MemberLifecycleState;
    /** The full executed trace, in order (live steps + commit step(s)). */
    readonly steps: readonly LifecycleStepName[];
}
/**
 * The durable evidence port for committed standalone lifecycle
 * operations (see the {@link LifecyclePorts} note). The production
 * binding commits the `member-lifecycle-changed` ledger fact; the append
 * advances the team generation, so the post-op projection is strictly
 * newer than any pre-op frame. The action-router effect and the work-
 * chain settlement commit their OWN facts through the UNLOCKED cores
 * and never call this port — no double append on either surface.
 */
export interface LifecycleEvidencePort {
    /**
     * Commit the durable evidence of one committed standalone lifecycle
     * operation. Fail-closed: a durable write fault rejects the whole
     * call (the transition is already committed; the caller surfaces the
     * typed failure — never a silent evidence loss).
     */
    commitLifecycleChanged(args: LifecycleEvidenceArgs): Promise<number>;
}
export interface LifecyclePorts {
    /** The TeamDomain (durable authority, invariant 41; read-only for this module). */
    readonly teamDomain: TeamDomain;
    /** The durable lifecycle-transition commit port (the commit steps). */
    readonly commit: LifecycleCommitPort;
    /** The admission-close port (step `close-admission`). */
    readonly admission: AdmissionClosePort;
    /** The member-activity port (step `interrupt`). */
    readonly activity: MemberActivityPort;
    /** The descendant-drain port (step `drain-descendants` + quiescence). */
    readonly descendants: DescendantDrainPort;
    /** The P5-T6 residency port (step `release-residency`). */
    readonly residency: ResidencyPort;
    /** The durable evidence port (optional; see above). */
    readonly evidence?: LifecycleEvidencePort;
}
/**
 * The outcome of one quiescence procedure (the shared Archive/Dispose
 * pre-commit phase): the executed step trace + the drain observation + the
 * residency-release result.
 */
export interface QuiesceOutcome {
    /** The executed live steps, in order (close-admission … release-residency). */
    readonly steps: readonly LifecycleStepName[];
    /** The descendants the drain stopped/settled. */
    readonly drained: number;
    /** `true` when a live residency was dropped, `false` when the handle was already absent. */
    readonly residencyDropped: boolean;
}
/**
 * The result of one successful {@link archiveMember} (DevPlan §20.3 Archive).
 */
export interface ArchiveMemberResult {
    /** The committed MemberInstance record (lifecycle `ARCHIVED`). */
    readonly member: MemberInstanceRecordDto;
    /** The full executed trace (live steps + the durable commit(s)). */
    readonly steps: readonly LifecycleStepName[];
    /** `true` when a RUNNING member's settled work was durably committed first (the extra SETTLE). */
    readonly settledCommitted: boolean;
    /** The descendants the drain stopped/settled. */
    readonly drained: number;
    /** `true` when a live residency was dropped, `false` when the handle was already absent. */
    readonly residencyDropped: boolean;
}
/**
 * The result of one successful {@link restoreMember} (DevPlan §20.3 Restore;
 * Architecture §30.2 frozen 3A). `steps` is ALWAYS exactly
 * `[commit-restore]` — one durable commit and nothing else (no Agent
 * create/resume, no prompt, no turn, no residency contact).
 */
export interface RestoreMemberResult {
    /** The committed MemberInstance record (lifecycle `SETTLED`). */
    readonly member: MemberInstanceRecordDto;
    /** Exactly `[LIFECYCLE_STEP_NAMES.COMMIT_RESTORE]` — the structural G7 evidence. */
    readonly steps: readonly LifecycleStepName[];
}
/**
 * The result of one successful {@link disposeMember} (DevPlan §20.3 Dispose;
 * Architecture §30.4). The committed record REMAINS durably readable (the
 * DISPOSED record + the child Session/binding rows are never deleted —
 * "历史不删除" / §29.5).
 */
export interface DisposeMemberResult {
    /** The committed MemberInstance record (lifecycle `DISPOSED`, terminal). */
    readonly member: MemberInstanceRecordDto;
    /** The full executed trace (live steps + the dispose commit). */
    readonly steps: readonly LifecycleStepName[];
    /** The descendants the drain stopped/settled. */
    readonly drained: number;
    /** `true` when a live residency was dropped, `false` when the handle was already absent. */
    readonly residencyDropped: boolean;
}
/**
 * The lifecycle SERVICE — the public entry point. One instance owns ONE
 * per-team (rootSessionId-keyed) promise-chain lock (the P6-T1/P6-T2 lock
 * pattern, reused through the action-router `withTeamLock` seam): concurrent
 * lifecycle operations of one team are SERIALIZED, so a dispose race commits
 * exactly once and the loser observes the durable terminal state and fails
 * closed (no double commit, no lost `activityVersion` increment).
 *
 * The standalone {@link archiveMember} / {@link restoreMember} /
 * {@link disposeMember} functions are the unlocked cores; every concurrent
 * caller MUST go through one service instance.
 */
export interface LifecycleService {
    /** Archive the member (close admission → interrupt → drain → quiescence → release → commit ARCHIVED). */
    archiveMember(target: LifecycleTarget): Promise<ArchiveMemberResult>;
    /** Restore the member (ARCHIVED → SETTLED; durable availability only, NO Agent create/resume). */
    restoreMember(target: LifecycleTarget): Promise<RestoreMemberResult>;
    /** Dispose the member (quiesce → commit DISPOSED terminal; history preserved). */
    disposeMember(target: LifecycleTarget): Promise<DisposeMemberResult>;
}
//# sourceMappingURL=types.d.ts.map