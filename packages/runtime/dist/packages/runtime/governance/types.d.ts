/**
 * pre-alpha3 PR-A — the closed type surface of the production GOVERNANCE
 * MUTATION AUTHORITY (plan: `dsh-agent-team-pre-alpha3-refactor-plan`
 * PR-A "Governance convergence", ADR-03).
 *
 * This is the single production write authority for the two durable
 * governance truths of a TeamDomain:
 *
 * - the `overrides` store (durable governance overrides — the
 *   `override.set` / `override.reset` remote commands and the dev-harness
 *   row's HTTP route), and
 * - the PolicyState transitions (the `policyState.set` remote command) —
 *   the durable `ledger` fact rows plus the in-memory read cache.
 *
 * Every write path in the production composition is
 * `remote / tool -> GovernanceMutationService -> the shared per-team
 * operation chain -> TeamDomain`. The old forked authority surfaces
 * (the remote-side direct `admitGovernanceOverride` glue, the remote-side
 * reset delete, the production `MutationService` instance) are demoted:
 * `persistGovernanceOverride` (mutation/override-admission) is a narrow
 * persistence primitive, and the `MutationService` class stays a pure
 * kernel of the P7-T2 test worlds — neither is a production authority.
 *
 * The module is PURE with respect to the ports (no node: builtins, no
 * storage import, no DSH imports): the durable homes are injected (the
 * `overrides` repository, the `ledger` writer, the read-cache store), so
 * the concurrency / idempotence / authority tests run against in-memory
 * fakes and the production wiring is a thin adapter.
 *
 * @module @dsh-agent-team/runtime/governance/types
 */
import type { MemberIdentity, PolicyEntry, PolicyStateView } from '../../domain/policy/src/index.js';
import type { AdmittedGovernanceOverride, MutationAuthority, OverrideRecordView, OverrideStorePort } from '../mutation/override-admission.js';
import type { MutationActor, PolicyReader, PolicyStateTransitionRecord } from '../mutation/types.js';
import type { PermissionOverlayRepositoryPort } from '../permission-governance/port.js';
import type { PermissionOverlaySnapshot } from '../permission-governance/types.js';
import type { PermissionMutationEnvelope, PermissionMutationKind, PermissionMutationRule, PermissionStaticLayerFacts, SubtreeContains } from './permission-mutation.js';
/**
 * The per-team serialization seam the service serializes every mutation
 * through (the production wiring passes the shared
 * {@link TeamOperationCoordinator.run} — the ONE per-team chain the P8-S5B
 * coordination module owns; tests may pass any same-shaped chain).
 */
export interface GovernanceChainPort {
    /**
     * Run one unit of work serialized per root session id. A failing unit
     * never poisons the chain for later work.
     * @param rootSessionId - the team (root) session id.
     * @param work - the serialized unit of work.
     */
    run<T>(rootSessionId: string, work: () => Promise<T>): Promise<T>;
}
/**
 * The transition read/write seam the service consumes (pre-alpha3 PR-B,
 * plan §B.2): the READ is the durable ledger rows in COMMIT order (the
 * production wiring reads the ledger directly — the process-local cache is
 * no longer the read source of any production decision; the test worlds
 * pass their in-memory store), and the APPEND mirrors an admitted
 * transition into the process-local view (sync; the durable row was
 * already written by the commit port — commit-before-ack).
 */
export interface GovernanceTransitionCache {
    /** Mirror one admitted transition into the process-local view (sync). */
    appendTransition(teamSessionId: string, transition: PolicyStateTransitionRecord): void;
    /** The admitted transitions of one team, in COMMIT order. */
    listTransitions(teamSessionId: string): readonly PolicyStateTransitionRecord[];
}
/**
 * The durable PolicyState commit port (commit-before-ack): the service
 * AWAITs this write before it returns, so a durable transition fact is
 * stored before any caller observes the ack (the R2-1 fire-and-schedule
 * window is closed).
 */
export interface GovernanceTransitionCommit {
    /**
     * Durably write one admitted transition (one `ledger` fact row).
     * @param rootSessionId - the ADDRESSED TeamSession the switch targeted;
     *   the durable row is stamped with THIS root (the durable read is
     *   root-keyed — stamping the row's own boot root instead would make the
     *   committed state invisible to the addressed team and leak it to a
     *   foreign root; the overrides lane stamps `args.rootSessionId` the same
     *   way, service.ts:266/283).
     * @param transition - the admitted transition record (the payload is
     *   mirrored verbatim into the durable row).
     */
    commit(rootSessionId: string, transition: PolicyStateTransitionRecord): Promise<void>;
}
/**
 * The static policy reader the service consumes for the write-time checks
 * (the SAME port the P7-T2 mutation kernel uses — the bound Blueprint
 * snapshot's envelope, the member's template policy, the external hard
 * facts). Reused verbatim: the production root already builds one
 * (`policyReader` in root.ts).
 */
export type GovernancePolicyReader = PolicyReader;
/**
 * Alpha.3 PR3 — the OPTIONAL permission-lane dependencies of the ONE
 * governance mutation authority (coordinator D1: the existing class is
 * EXTENDED with the permission-mutation path; the legacy capability lanes
 * and their deps are byte-unchanged, so the production root.ts wiring
 * compiles and behaves exactly as before until a later PR wires this lane).
 *
 * When absent, {@link GovernanceMutationService.mutatePermission} fails with
 * the typed `PERMISSION_MUTATION_NOT_CONFIGURED` — the capability stays
 * dormant (PR3 scope: ZERO production wiring).
 */
export interface GovernancePermissionLaneDeps {
    /**
     * The PR1 persistence-only overlay port — the ONE durable write target of
     * the permission path (ADR §1: GovernanceMutationService → this port →
     * durable store). The port validates nothing about authority or the
     * envelope (its four MUST-NOTs) and the service never reaches past its
     * three members (pinned by `a3p3-governance-lane-hygiene.test.ts`).
     */
    readonly overlay: PermissionOverlayRepositoryPort;
    /**
     * The bound §6 MutationEnvelope for one team's addressed mutation (the
     * Leader's expansion authority; design §4 model, ADR §6 semantics). Absent
     * = NO envelope = no Leader expansion authority (tightenings unaffected) —
     * fail closed. The returned document is validated (typed refusal on a
     * malformed envelope, before any write).
     *
     * Round 4 (addressed-team binding): the reader is addressed by the SAME
     * (team, target member) the mutation names. The envelope's FILE matchers
     * are canonical keys and are compared against the rising cells the kernel
     * partitions from the target member's overlay + static layers — one
     * decision, ONE canonical key space — so a provider-backed reader
     * canonicalizes them at the TARGET member's documented envelope path basis
     * (the member's effective workspace), never a row-wide constant. A
     * provider-backed reader is ASYNC (canonicalization goes through the real
     * fs provider); a sync reader (a fixed document) stays valid — the service
     * awaits either. The parameter is ADDITIVE: a one-parameter reader keeps
     * working verbatim.
     * @param teamSessionId - the team whose bound envelope is read.
     * @param memberInstanceId - the target instance of the addressed mutation.
     */
    readonly permissionEnvelope?: (teamSessionId: string, memberInstanceId: string) => PermissionMutationEnvelope | Promise<PermissionMutationEnvelope>;
    /**
     * The LOWER-LAYER FACTS the Leader authorization compares effective
     * before/after against (design v2 — expansion is a property of the
     * EFFECTIVE decision, so removing/revealing rules is judged against the
     * declared template/blueprint, never against a guessed baseline). A pure
     * DATA reader on the same injection pattern as {@link permissionEnvelope}
     * — it grants no authority and is read ONCE inside the serialized
     * section, before the pure kernel pass. The states are DISTINCT: absent
     * reader (or a reader returning `undefined`) = UNKNOWN → regions whose
     * verdict depends on lower facts refuse EFFECT_CONTEXT_UNAVAILABLE; a
     * reader returning `{ layers: [] }` = DECLARED-NONE (known deny fallback)
     * → decidable. Never conflated.
     *
     * Round 4: the facts are the TARGET MEMBER'S OWN (canonicalized at its
     * actual effective workspace through the real provider), so the reader may
     * be ASYNC; the service awaits it inside the serialized section (the
     * reader itself re-validates its bindings across the await and abstains on
     * drift). A sync reader keeps working verbatim.
     * @param teamSessionId - the team whose static permission layers are read.
     * @param memberInstanceId - the instance the effective policy is for.
     */
    readonly staticLayers?: (teamSessionId: string, memberInstanceId: string) => PermissionStaticLayerFacts | undefined | Promise<PermissionStaticLayerFacts | undefined>;
    /**
     * PR4 round 4 (external review X1) — the ACTING LEADER's OWN static facts
     * for one team (the leader position's template layer, canonicalized by the
     * same addressed-team reader that serves members). Together with the
     * leader lane's durable overlay (read by the service through the SAME
     * overlay port), it forms the AUTHORITY CEILING checked against every
     * risen cell: a leader cannot grant a member an effect the leader does not
     * itself hold. ABSENT = the ceiling check stays inert (pre-round-4
     * envelope-only judgement — test/legacy lanes that hand-author envelopes
     * and inject no leader policy keep working byte-for-byte); a PRESENT
     * reader returning `undefined` = UNKNOWN leader facts → risen cells whose
     * grantor-side answer depends on them refuse EFFECT_CONTEXT_UNAVAILABLE
     * (an unknown grantor is never assumed to hold the effect).
     * @param teamSessionId - the team whose leader static facts are read.
     * @param targetMemberInstanceId - the mutation's target member: the
     *   leader's template rules are evaluated AS IF applied in the target's
     *   canonical key space (the ONE space the rising cells live in — an
     *   unknown-vs-mismatched grantor space can only make the ceiling
     *   STRICTER, never looser: fail closed).
     */
    readonly leaderAuthorityFacts?: (teamSessionId: string, targetMemberInstanceId: string) => PermissionStaticLayerFacts | undefined | Promise<PermissionStaticLayerFacts | undefined>;
    /**
     * The WHOLE-MATCHER containment predicate over two canonical identities
     * of the SAME backend namespace — the ONLY containment relation this lane
     * ever consults (region partition, subtree boundary nesting, envelope
     * coverage; the A2 `containsOperation` is a POINT judgement owned by the
     * live resolver and never enters here). Canonical keys are opaque (A2
     * contract), so this mirrors why the frozen Alpha.2 matcher never
     * `startsWith` — the containment verdict is the seam's. Absent → every
     * subtree-vs-boundary question fails closed.
     */
    readonly subtreeContains?: SubtreeContains;
}
/** The service dependencies (every durable home injected). */
export interface GovernanceMutationServiceDeps {
    /** The shared per-team operation chain (serialization authority). */
    readonly chain: GovernanceChainPort;
    /** The durable `overrides` store (the team_domain repository). */
    readonly overrides: OverrideStorePort;
    /** The transition read seam (production: the durable ledger rows in
     *  commit order; the service's no-change check reads through it). */
    readonly transitions: GovernanceTransitionCache;
    /** The durable transition commit (commit-before-ack). */
    readonly transitionCommit: GovernanceTransitionCommit;
    /** The static policy facts (envelope / template / external hard). */
    readonly policy: GovernancePolicyReader;
    /**
     * The registered member instances of one team (the leader envelope
     * intersection needs the full roster; the production wiring reads the
     * durable `member-instances` rows).
     * @param rootSessionId - the team to roster.
     */
    readonly registeredMembers: (rootSessionId: string) => Promise<readonly MemberIdentity[]>;
    /**
     * The bound blueprint's CLOSED PolicyState set for one team (the
     * `default` id plus every declared state id, declaration order).
     * @param rootSessionId - the team whose bound blueprint is read.
     */
    readonly policyStates: (rootSessionId: string) => readonly string[];
    /** The write clock (injected; ISO-8601 strings). */
    readonly now: () => string;
    /**
     * Alpha.3 PR3 (additive): the permission-mutation lane. OPTIONAL by
     * construction — the legacy lanes never read it and the production root
     * keeps constructing the service without it until a later PR wires the
     * permission plane (see {@link GovernancePermissionLaneDeps}).
     */
    readonly permissionLane?: GovernancePermissionLaneDeps;
}
/**
 * One requested durable override mutation (a SET of cells for one policy
 * slot). The authority is the §20.3/§20.4 channel (derived server-side
 * from the authenticated principal, never from payload claims); the slot
 * is CLOSED by the authority (see the module doc of {@link slot}):
 * leader -> team-scope autonomy overlay, member -> own instance-scope
 * autonomy overlay, operator -> human override (team or instance scope).
 */
export interface GovernanceOverrideSetArgs {
    /** The acting authority. */
    readonly authority: MutationAuthority;
    /** The owning TeamSession (clean id). */
    readonly rootSessionId: string;
    /**
     * The requested scope (closed by the authority; an operator may choose
     * team or instance, agent origins ignore it and it is rejected when
     * inconsistent with the authority's fixed scope).
     */
    readonly scope: 'team' | 'instance';
    /** Required exactly when scope is 'instance'. */
    readonly instanceId?: string;
    /**
     * The cell changes (non-empty; closed capability vocabulary ->
     * PolicyEntry). Unmentioned capabilities keep the slot winner's
     * current values (full slot re-issue).
     */
    readonly cells: Record<string, PolicyEntry>;
    /**
     * Optional optimistic-concurrency guard: the generation the caller
     * believes is the current slot winner. Mismatch -> typed conflict.
     */
    readonly expectedGeneration?: number;
}
/**
 * The set outcome. `changed: true` — a new full-slot record was durably
 * committed BEFORE the ack (the admitted record, backend truth).
 * `changed: false` — the desired state already holds (the merged slot
 * values equal the current winner's values): NO write, NO generation
 * bump (idempotence); the current winner is reported (null when the slot
 * is empty — an empty-cells request cannot reach this branch).
 */
export type GovernanceOverrideSetResult = {
    readonly changed: true;
    readonly record: AdmittedGovernanceOverride;
} | {
    readonly changed: false;
    readonly reason: 'no-change';
    /** The current slot winner (undefined when the slot is empty). */
    readonly current: OverrideRecordView | undefined;
};
/**
 * One requested durable override RESET (revoke the addressed slot). The
 * reset is a higher-generation TOMBSTONE re-issue (an empty `values`
 * record that wins the slot by generation) — never a storage delete
 * (audit-preserving; the read-side slot selection then contributes
 * nothing for the slot, which is exactly "no override").
 */
export interface GovernanceOverrideResetArgs {
    /** The acting authority (closes the same slot it could set). */
    readonly authority: MutationAuthority;
    /** The owning TeamSession (clean id). */
    readonly rootSessionId: string;
    /** The addressed scope (closed by the authority). */
    readonly scope: 'team' | 'instance';
    /** Required exactly when scope is 'instance'. */
    readonly instanceId?: string;
    /** Optional optimistic-concurrency guard (same semantics as set). */
    readonly expectedGeneration?: number;
}
/**
 * The reset outcome. `removed: true` — a tombstone was durably committed
 * BEFORE the ack. `removed: false` — the slot had no winner (nothing to
 * revoke; no write).
 */
export type GovernanceOverrideResetResult = {
    readonly removed: true;
    readonly tombstone: AdmittedGovernanceOverride;
} | {
    /** No durable write: the slot was empty, or its winner is already a
     *  tombstone (the desired state holds — idempotent reset). */
    readonly removed: false;
    /** Present when the no-op found an already-tombstoned slot (the
     *  standing tombstone record). */
    readonly current?: AdmittedGovernanceOverride;
};
/**
 * One requested explicit PolicyState transition (Architecture §20.4,
 * invariant 40: ONLY explicit human / authorized-leader transitions
 * exist). The target must be in the team's bound blueprint CLOSED state
 * set; a self-transition (target == active state) is a typed no-op.
 */
export interface GovernancePolicyStateSetArgs {
    /** The acting actor (TeamSession-level; member is unauthorized). */
    readonly actor: MutationActor;
    /** The owning TeamSession (clean id). */
    readonly rootSessionId: string;
    /** The target state (closed shape; validated here). */
    readonly target: PolicyStateView;
}
/**
 * The switch outcome. `changed: true` — the durable ledger row was
 * committed BEFORE the ack (commit-before-ack) and the transition record
 * is the admitted fact. `changed: false` — the target state is already
 * the active state (no new row, no write).
 */
export type GovernancePolicyStateSetResult = {
    readonly changed: true;
    readonly transition: PolicyStateTransitionRecord;
} | {
    readonly changed: false;
    readonly reason: 'no-change';
    /** The state already active (the target, validated). */
    readonly state: PolicyStateView;
};
/**
 * One requested PermissionMutation (Alpha.3 PR3; plan PR3, design §3.4): the
 * unified model — `grant_instance` / `update_permission` / `revoke_permission`
 * are ONE shape, and every accepted mutation produces ONE NEW
 * PermissionOverlaySnapshot through the PR1 persistence-only port (ADR §5).
 *
 * The authority closes the actor exactly like the legacy methods
 * (`MutationAuthority`, derived server-side, never payload-claimed): `leader`
 * acts inside the §6 envelope; `operator` is the Human surface (ADR §7 — may
 * exceed the envelope, records Human provenance, creates no permanent
 * priority); an ordinary `member` is unauthorized on this lane. The target
 * MemberInstance is ADDRESSED (a Leader mutation addresses the instance the
 * overlay belongs to; the durable row keeps the (teamSessionId,
 * memberInstanceId) identity of ADR §2).
 */
export interface GovernancePermissionMutationArgs {
    /** The acting authority (leader / operator; member is refused). */
    readonly authority: MutationAuthority;
    /** The owning TeamSession (ADR §2 identity). */
    readonly teamSessionId: string;
    /** The addressed MemberInstance (ADR §2 identity). */
    readonly memberInstanceId: string;
    /** The unified mutation kind (design §3.4). */
    readonly kind: PermissionMutationKind;
    /** The caller-chosen mutation id (ADR §2 provenance.mutationId; it is the
     *  replay idempotency key: the same desired state twice is a no-op). */
    readonly mutationId: string;
    /** The audit reason (provenance.reason; <= 512, may be empty). */
    readonly reason: string;
    /** The addressed rule set (non-empty; the unified rule shape). */
    readonly rules: readonly PermissionMutationRule[];
    /**
     * Optional optimistic-concurrency guard: the overlay generation the caller
     * believes is current (0 = none yet). Mismatch -> the typed
     * `PERMISSION_OVERLAY_GENERATION_CONFLICT`, zero partial write (plan PR3
     * "CAS conflict" — the same guard discipline as the legacy
     * `expectedGeneration`, types L176/213 lineage).
     */
    readonly expectedGeneration?: number;
}
/**
 * The mutation outcome. `changed: true` — ONE new FULL snapshot was appended
 * through the PR1 port BEFORE the ack (commit-before-ack, unchanged from
 * PR-A); the snapshot is the backend truth. `changed: false` — the desired
 * state already holds (same desired effect, or a revoke of pairs that never
 * existed): NO snapshot, NO generation bump.
 */
export type GovernancePermissionMutationResult = {
    readonly changed: true;
    readonly snapshot: PermissionOverlaySnapshot;
} | {
    readonly changed: false;
    readonly reason: 'no-change';
    /** The current authority snapshot (undefined when none exists). */
    readonly current: PermissionOverlaySnapshot | undefined;
};
/**
 * The production governance mutation authority (ADR-03): the single
 * write surface for durable governance overrides + PolicyState
 * transitions of one production root. Constructed once per production
 * root (root.ts); the remote ports and the dev-harness row call it —
 * nothing else writes those durable truths.
 */
export interface GovernanceMutationService {
    /**
     * Set (merge) the cells of one policy slot. Serialized per team on the
     * shared chain; validates authority/scope, the closed cell vocabulary,
     * the write-time envelope (agent origins) and the external hard facts
     * (every origin), applies the desired-state no-op, then durably
     * re-issues the full slot (commit-before-ack).
     * @throws {@link MutationError} — see the service module doc for the
     *   closed vocabulary of reachable codes.
     */
    setOverride(args: GovernanceOverrideSetArgs): Promise<GovernanceOverrideSetResult>;
    /**
     * Reset (revoke) the addressed policy slot: a higher-generation
     * tombstone re-issue (commit-before-ack); no-op when the slot is empty.
     * @throws {@link MutationError} — authority/scope/shape failures.
     */
    resetOverride(args: GovernanceOverrideResetArgs): Promise<GovernanceOverrideResetResult>;
    /**
     * Switch the team PolicyState (explicit human / authorized-leader
     * only): closed-set check, self-transition no-op, durable commit
     * BEFORE the ack, then the in-memory cache append.
     * @throws {@link MutationError} — `UNAUTHORIZED_TRANSITION`,
     *   `POLICY_STATE_UNKNOWN`, `MALFORMED_MUTATION_INPUT`.
     */
    switchPolicyState(args: GovernancePolicyStateSetArgs): Promise<GovernancePolicyStateSetResult>;
    /**
     * Alpha.3 PR3 (additive): mutate a MemberInstance permission overlay —
     * the SOLE permission mutation authority path (ADR §1/§5, design §2).
     * The unified pipeline: authenticate authority (leader / operator — the
     * same derived-server-side vocabulary as the legacy methods) → validate
     * the PermissionMutation and, for every Leader EXPANSION, the §6
     * MutationEnvelope (tightening needs no expansion authority — ADR §6) →
     * serialize on the SAME shared per-team chain with the
     * expectedGeneration CAS → commit ONE new FULL PermissionOverlaySnapshot
     * THROUGH the PR1 persistence-only repository port (commit-before-ack) →
     * provenance (actor / mutationId / timestamp / reason).
     * A refusal is typed and performs ZERO writes; Human mutations may exceed
     * the envelope and record Human provenance without any permanent
     * resolver priority (ADR §7).
     * @throws PermissionMutationError — the closed code vocabulary of
     *   `./permission-mutation.js` (branch on `code` + `details.problem`).
     */
    mutatePermission(args: GovernancePermissionMutationArgs): Promise<GovernancePermissionMutationResult>;
}
//# sourceMappingURL=types.d.ts.map