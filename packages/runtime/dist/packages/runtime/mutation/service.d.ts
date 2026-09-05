/**
 * P7-T2 — the runtime mutation service (TaskDoc §11.8 P7-T2; Development
 * Plan §20.2).
 *
 * The service implements the frozen "Runtime mutation" contract as a PURE
 * state machine over its injected ports (clock / store / reader — see
 * {@link ./types.js}):
 *
 * - **Future-boundary mutation** (DevPlan §20.2, Architecture
 *   §21.3–§21.5): every admitted mutation — capability value, state
 *   transition, pre-first-RUNNING workspace change — takes effect from
 *   `effectiveFromStep = requestedAtStep + 1`. Already-captured in-flight
 *   work (`beginStep` captures) holds its step's frozen resolution and is
 *   NEVER re-pointed at a concurrent mutation.
 * - **Escalation intake** (Architecture §19.3, invariants 36/37): agent
 *   origins (leader / member) are checked against the frozen team autonomy
 *   envelope (blueprint ∩ template mutationEnvelope, via the P3-T4
 *   validator — never re-implemented); violations are REJECTED at the
 *   boundary with the frozen code strings (`MEMBER_SELF_ESCALATION` /
 *   `LEADER_OUT_OF_ENVELOPE`). Human origin is not envelope-bounded
 *   (invariant 34).
 * - **External hard facts** (Architecture §19.2, invariant 35): checked
 *   for EVERY origin (human included) — `capabilityExists === false`
 *   rejects an allow grant, an external hard `deny` rejects it, and a
 *   hard allow-list restricts the grantable items. No Team actor can
 *   bypass them.
 * - **PolicyState** (Architecture §20.4, invariant 40): transitions are
 *   admitted ONLY for explicit human / authorized-leader actors
 *   (`UNAUTHORIZED_TRANSITION` otherwise); they are future-boundary
 *   mutations; the suppression of stored allow overlays under a locked
 *   cell is recorded LAZELY at resolution time (non-destructive, §19.4 —
 *   the durable overlay record is never deleted and becomes effective
 *   again when the state relaxes).
 * - **Creation fields** (Architecture §21.2/§21.6): `contextPolicy` is
 *   immutable from registration (`IMMUTABLE_CREATION_FIELD` always);
 *   `workspace` is mutable until the instance's first RUNNING (the
 *   `beginStep` call marks it), immutable after.
 * - **Resolution** (DevPlan §20.2 "所有 effective config 都必须可解释
 *   provenance"): `resolveEffective` reuses the FROZEN P3-T4 resolver
 *   verbatim (the runtime never re-implements resolution); the
 *   `EffectiveConfiguration` output carries, beside the frozen
 *   per-cell provenance, the module's source chain — every provenance
 *   ledger entry in force at the step (`contributions`) — so every
 *   effective item resolves to an explainable source.
 *
 * Pure module: no I/O, no DSH imports, no ambient state.
 *
 * @module @dsh-agent-team/runtime/mutation/service
 */
import type { MemberIdentity, TeamSessionId } from '../../domain/policy/src/index.js';
import { activePolicyState } from '../policy-adapter.js';
import { MutationError } from './errors.js';
import type { CreationFieldMutationRequest, EffectiveConfigCapture, EffectiveConfiguration, MutationRequest, MutationStore, PolicyReader, PolicyStateTransitionRecord, PolicyStateTransitionRequest, StepClock, StoredMutationRecord } from './types.js';
/** The dependency bag of one {@link MutationService} (all ports injected). */
export interface MutationServiceDeps {
    readonly clock: StepClock;
    readonly store: MutationStore;
    readonly policy: PolicyReader;
    /** Custom id minting for durable records/ledger entries (defaults to a
     *  deterministic per-service counter). */
    readonly newRecordId?: (kind: 'mutation' | 'ledger' | 'transition') => string;
}
/**
 * The runtime mutation service of one TeamSession group. Stateless with
 * respect to the ports (all durable state lives in the store); the only
 * service-local state is the in-flight capture set (diagnostic) and the
 * default id counter.
 */
export declare class MutationService {
    private readonly deps;
    private idCounter;
    private readonly inflight;
    constructor(deps: MutationServiceDeps);
    /** The number of in-flight (unreleased) step captures (diagnostic). */
    inflightCount(): number;
    /**
     * Admit one capability mutation request (future-boundary). See the
     * module doc for the intake pipeline. Returns the durable record.
     *
     * @throws {@link MutationError} — `MALFORMED_MUTATION_INPUT` (request
     *   shape / stored facts), `IDENTITY_SCOPE_MISMATCH` (cross-team
     *   member), `EXTERNAL_HARD_REJECTED` (beyond the external hard facts,
     *   every origin), `MEMBER_SELF_ESCALATION` /
     *   `LEADER_OUT_OF_ENVELOPE` (agent origin beyond the autonomy
     *   envelope).
     */
    requestMutation(request: MutationRequest): StoredMutationRecord;
    /**
     * Admit one explicit PolicyState transition (future-boundary). Only
     * explicit human / authorized-leader actors are authorized
     * (`UNAUTHORIZED_TRANSITION` otherwise). The target state is validated
     * with the same structural rules the frozen resolver applies (closed
     * capability keys; cell = `{locked?, value?}` only).
     */
    switchPolicyState(request: PolicyStateTransitionRequest): PolicyStateTransitionRecord;
    /**
     * Register the creation fields of a MemberInstance (once). Records the
     * `workspace` (mutable until first RUNNING, §21.2) and the
     * `contextPolicy` (immutable from this moment, §21.6), and starts their
     * provenance ledger entries.
     */
    registerInstance(teamSessionId: TeamSessionId, member: MemberIdentity, fields: {
        readonly workspace: string;
        readonly contextPolicy: string;
    }): void;
    /**
     * Request a post-creation change of a creation field. `contextPolicy`
     * is ALWAYS rejected (`IMMUTABLE_CREATION_FIELD`, §21.6); `workspace`
     * is admitted only BEFORE the instance's first RUNNING (§21.2) and
     * rejected after. An unregistered instance is `UNKNOWN_INSTANCE`.
     */
    requestCreationFieldMutation(request: CreationFieldMutationRequest): void;
    /**
     * Begin one step of one member: mark first RUNNING (locks the
     * workspace, §21.2) and capture the effective configuration at the
     * step boundary. The capture is a frozen value — later mutations never
     * reach in-flight work (the DevPlan §20.2 future-boundary contract);
     * `release()` settles the step.
     *
     * @throws {@link MutationError} `UNKNOWN_INSTANCE` when the instance
     *   has no registered creation fields.
     */
    beginStep(member: MemberIdentity): EffectiveConfigCapture;
    /**
     * Resolve the EFFECTIVE CONFIGURATION of one member at one step (the
     * current step by default): the frozen resolver's fully-explained
     * `EffectivePolicy` + this module's source chain (every provenance
     * ledger entry effective at the step) + the stored-but-suppressed
     * overlays (new suppressions are recorded in the store here, lazily —
     * non-destructive, §19.4).
     *
     * @throws {@link MutationError} — the frozen resolver's typed errors
     *   mapped onto this module's closed surface (escalation / identity /
     *   malformed), plus the intake codes above.
     */
    resolveEffective(teamSessionId: TeamSessionId, member: MemberIdentity, atStep?: number): EffectiveConfiguration;
    private mintId;
    private appendLedger;
    private registeredMembers;
    /** The external hard facts check (every origin; see the module doc). */
    private checkExternalHard;
    /**
     * Record the fresh suppressions of one resolution (lazy, §19.4):
     * deduplicated on (capability, layer, policyStateId) against the store's
     * existing suppression trail; `recordedAtStep` = this step. The key is
     * the overlay LAYER (not the slot's `overlayId`) because a slot's id is
     * the latest contributing durable record overall and therefore changes
     * whenever a new record joins the slot — deduping on the slot id would
     * re-record the same logical suppression once per id drift. The
     * recorded record keeps the slot id it had at first recording.
     */
    private recordSuppressions;
}
/**
 * Map a frozen-domain {@link PolicyResolutionError} onto this module's
 * closed surface, preserving the code strings that belong to both
 * vocabularies (identity / escalation) verbatim and translating the
 * structural code. Non-policy errors become `MALFORMED_MUTATION_INPUT`.
 */
export declare function mapFrozenError(error: unknown, stage: string): MutationError;
export { activePolicyState };
export type { MutationStore, PolicyReader, StepClock };
//# sourceMappingURL=service.d.ts.map