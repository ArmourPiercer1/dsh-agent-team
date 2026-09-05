/**
 * ForkReconciliation types (P7-T4): the native-fork fact, the injected
 * TeamDomain port, and the frozen outcome vocabulary.
 *
 * The module reconciles ONE observed native DSH Session fork (Architecture
 * §35) against the durable TeamDomain sidecar (invariant 41) and writes the
 * lazy root-fork sidecar when — and only when — the frozen semantics
 * require it:
 *
 * - **Root fork** (DevPlan §20.4, Architecture §35.1/§35.2): the parent is
 *   a Team root → a NEW TeamSession is recorded for the child with the SAME
 *   immutable Blueprint snapshot and EMPTY MemberInstances (no runtime
 *   MemberInstances, no Policy runtime activity, no child execution trees
 *   are copied);
 * - **Member fork** (DevPlan §20.4, Architecture §35.3, invariant 62): the
 *   parent is a member child session → the child stays an ordinary
 *   independent session; no Team binding is ever inferred;
 * - **Ordinary fork**: the parent carries no Team binding → the child has
 *   no team to reconcile; the sidecar stays untouched.
 *
 * `session.fork` is never patched (zero-core): the native fork itself is
 * performed by DSH; this module only performs the idempotent sidecar
 * recognition/reconciliation over the public TeamDomain binding surface,
 * fed by the public Session lineage/parent information (Architecture
 * §35.2). If that lineage were not observable, the blocker would be
 * `CORE_SEAM_BLOCKER: FORK_LINEAGE_VISIBILITY` — not an upstream change.
 *
 * @module @dsh-agent-team/runtime/fork-reconciliation/types
 */
import type { BlueprintSnapshotRef, MemberInstanceRecordDto, SessionBindingDto, TeamSessionRecordDto, TeamSessionRecordInput } from '../../contracts/src/index.js';
/**
 * The TeamDomain surface the fork reconciler reads and writes: the public
 * TeamDomain binding sidecar (invariant 41). Injected — the module never
 * reaches into a host backend or a live Agent, and the real adapter
 * (`createTeamDomainForkPort`) projects the P4 repositories onto exactly
 * these methods (the mirror of the P5-T5 root-binding write port).
 */
export interface ForkReconciliationTeamDomain {
    /**
     * Read one session binding row (cold-hydration kind resolution,
     * Architecture §36.1).
     * @returns the frozen binding, or `undefined` when the session is
     *   unbound (a session with no row carries no Team authority).
     */
    getSessionBinding(sessionId: string): SessionBindingDto | undefined;
    /**
     * Read one TeamSession record (keyed by root session id).
     * @returns the frozen record, or `undefined` when absent.
     */
    getTeamSession(rootSessionId: string): TeamSessionRecordDto | undefined;
    /**
     * List the durable MemberInstance records of one team (empty when none —
     * the "empty MemberInstances" side of a root fork, invariant 17/23).
     */
    listMemberInstances(rootSessionId: string): readonly MemberInstanceRecordDto[];
    /**
     * Durably put one TeamSession record. CRASH-SAFE ORDERING: this is the
     * FIRST write of the root-fork sidecar — the record commits before the
     * binding, so a crash between the two writes leaves a binding-less
     * record that a re-run completes (the mirror of the P5-T5 fresh-root
     * ordering).
     */
    putTeamSession(input: TeamSessionRecordInput): Promise<TeamSessionRecordDto>;
    /**
     * Durably put one session binding row. The SECOND write of the
     * root-fork sidecar (the `team-root` row of the fork child).
     */
    putSessionBinding(binding: SessionBindingDto): Promise<SessionBindingDto>;
}
/**
 * One observed native DSH Session fork: the public Session lineage/parent
 * information (Architecture §35.2) as a lossless-JSON fact. The parent is
 * the session that was natively forked; the child is the NEW session the
 * native fork minted (a native fork never reuses the parent id).
 */
export interface ForkReconciliationInput {
    /** The native parent session id (the forked session). */
    readonly parentSessionId: string;
    /** The native fork child session id (the newly minted session). */
    readonly childSessionId: string;
}
/**
 * One frozen fork-reconciliation outcome (the closed vocabulary).
 *
 * `durableWrites` counts the seam-level durable writes this call applied:
 * 0 for every no-sidecar outcome and for idempotent re-runs; 2 for a first
 * root-fork sidecar creation; 1 for a crash-window completion (the
 * binding-only roll-forward of a binding-less child record).
 */
export type ForkReconciliationResult = {
    /**
     * The parent carries no Team binding (unbound or explicit ordinary):
     * the child is an ordinary independent session; the sidecar is
     * untouched (no Team binding is ever inferred, invariant 62).
     */
    readonly outcome: 'ordinary-fork';
    /** The parent's resolved binding kind (`unbound` = no row). */
    readonly parentBinding: 'unbound' | 'ordinary';
    readonly durableWrites: 0;
} | /**
 * The parent is a member child session: the child is an ordinary
 * independent AgentSession — NOT a new MemberInstance, NOT a member of
 * the original Team, NOT a new TeamSession, NOT a Leader (Architecture
 * §35.3); no Team binding is inferred.
 */ {
    readonly outcome: 'member-fork';
    /** The team root the parent member belongs to (read, never written). */
    readonly parentRootSessionId: string;
    readonly durableWrites: 0;
} | /**
 * Root fork: the child TeamSession sidecar was (re)established — the new
 * TeamSession record carries the SAME immutable Blueprint snapshot as
 * the parent team and EMPTY MemberInstances; the child `team-root`
 * binding row was committed (or the crash-window completion wrote the
 * missing binding after an already-committed child record).
 */ {
    readonly outcome: 'root-fork-reconciled';
    /** The parent team root (the forked session; its TeamSession id). */
    readonly parentRootSessionId: string;
    /** The child TeamSession record (the child id IS the TeamSessionId, invariant 9). */
    readonly childTeamSession: TeamSessionRecordDto;
    /** The committed child `team-root` binding row. */
    readonly childBinding: SessionBindingDto;
    /** The immutable Blueprint snapshot shared with the parent team (invariant 10). */
    readonly blueprintSnapshot: BlueprintSnapshotRef;
    /** The child team's durable member count after reconciliation: always 0. */
    readonly memberCount: number;
    readonly durableWrites: number;
} | /**
 * Root fork re-run (idempotency, Architecture §35.2): the child already
 * carries the reconciled sidecar (record + `team-root` binding) with the
 * parent team's snapshot; zero writes.
 */ {
    readonly outcome: 'root-fork-already-reconciled';
    /** The parent team root. */
    readonly parentRootSessionId: string;
    /** The existing child TeamSession record (verified: same snapshot). */
    readonly childTeamSession: TeamSessionRecordDto;
    /** The immutable Blueprint snapshot shared with the parent team. */
    readonly blueprintSnapshot: BlueprintSnapshotRef;
    readonly durableWrites: 0;
};
/** The injected ports of `reconcileForkSidecar`. */
export interface ForkReconciliationPorts {
    /** The TeamDomain sidecar surface (read + the two sidecar writes). */
    readonly teamDomain: ForkReconciliationTeamDomain;
    /**
     * Deterministic clock for the child TeamSession `createdAt` stamp
     * (ISO-8601). Injected so the module stays pure; tests drive it.
     */
    readonly now: () => string;
}
//# sourceMappingURL=types.d.ts.map