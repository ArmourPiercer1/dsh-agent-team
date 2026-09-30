/**
 * pre-alpha3 PR-F (plan §F.2) — the TEST-WORLD mutation service kernel
 * (internal): the P7-T2 future-boundary mutation state machine, RETIRED
 * from the production authority by pre-alpha3 PR-A (the production
 * writer is {@link @dsh-agent-team/runtime/governance}) and pulled OFF
 * the public module surface by PR-F — it is the direct test seam of the
 * P7-T2 test family (p7t2-*) and of the legacy integrated admission
 * world (p7t7) only.
 *
 * This is NOT a production code path: no production module imports it
 * (the zero-core / p6t6 scans treat it as a test-world kernel). The
 * pure kernels it composes (`normalizePolicyEntry`, `normalizeStateView`,
 * `checkExternalHardFacts` from {@link ../service.js} and the frozen
 * P3-T4 resolver) stay on the production path, shared with the
 * governance authority — ONE vocabulary, no duplicate assembly.
 *
 * What lives here (moved from the former public surface, unchanged):
 *
 * - {@link StepClock} — the step-boundary clock port (test-world driver;
 *   the production step clock was retired as a decision source by PR-B,
 *   pinned 0/1);
 * - {@link MutationService} — the frozen "Runtime mutation" state
 *   machine over its injected ports (future-boundary mutation,
 *   escalation intake, external hard facts, PolicyState transitions,
 *   creation fields, provenance-carrying resolution);
 * - the structural intake validators + the frozen-error mapper it needs.
 *
 * Pure module: no I/O, no DSH imports, no ambient state.
 *
 * @module @dsh-agent-team/runtime/mutation/internal/mutation-service
 */
import type { MemberIdentity, TeamSessionId } from '../../../domain/policy/src/index.js';
import { MutationError } from '../errors.js';
import type { CreationFieldMutationRequest, EffectiveConfigCapture, EffectiveConfiguration, MutationRequest, MutationStore, PolicyReader, PolicyStateTransitionRecord, PolicyStateTransitionRequest, StoredMutationRecord } from '../types.js';
/**
 * The STEP-BOUNDARY clock (moved here from the public `types.ts` by
 * PR-F): the mutation plane never advances it (steps are driven by the
 * harness / admission pipeline); it only reads it. `0` = before the
 * first step. The PRODUCTION step clock was retired as a decision
 * source by pre-alpha3 PR-B (pinned 0/1) — this port drives the
 * test-world kernel only.
 */
export interface StepClock {
    /** The step currently in progress (0 before the first step). */
    currentStep(): number;
}
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
//# sourceMappingURL=mutation-service.d.ts.map