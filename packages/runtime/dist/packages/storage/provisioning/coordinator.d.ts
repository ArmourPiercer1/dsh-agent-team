/**
 * ProvisioningCoordinator — the durable provisioning state machine
 * (TaskDoc §11.5 P4-T4).
 *
 * A member provisioning is one durable protocol that drives the four
 * stages `ALLOCATED → CHILD_SESSION_CREATED → CHILD_BOUND →
 * INSTANCE_COMMITTED` (see `stages.ts`), each stage transition being a
 * DURABLE WRITE before the next external / effect step (Development Plan
 * §17.3 crash model, Architecture §18).
 *
 * **It is a DURABLE PROTOCOL ADAPTER, built by composition, not
 * re-implementation:**
 *
 * - the P4-T2 **operation journal** (`createOperationJournal`) is the
 *   operation backbone: the PREPARED row is the `ALLOCATED` reservation
 *   (the stable operation identity of Architecture §18.2), the
 *   `childSessionId` recorded on the row is the `CHILD_SESSION_CREATED`
 *   marker, and the journal's terminal (ledger fact + COMMITTED row,
 *   duplicate-prevented, roll-forward) is the `INSTANCE_COMMITTED` commit
 *   point. The coordinator NEVER re-implements the journal — it calls
 *   `prepare` / `drive` / `get`.
 * - the P4-T3 **SessionBindingService** owns the `CHILD_BOUND` stage
 *   (`createTeamMemberBinding`, with its cross-record rules).
 * - the P4-T1 **repositories** own the MemberInstance record write
 *   (`memberInstances.put`, check-then-apply) — the record MUST carry the
 *   child (invariant 23) and MUST exist before the binding (the binding
 *   service's precondition).
 * - the {@link AgentFactoryAdapter} is the ONE external effect (creating the
 *   child session); the fake is the only implementation in this task.
 *
 * **The stage is DERIVED from durable state** (no separate stage row): a
 * crash at any point leaves durable state, and re-deriving the stage from
 * it — then re-driving the remaining stages — is the recovery entry
 * (roll-forward, Development Plan §17.3; Architecture §18.3's five recovery
 * cases). That is what makes "re-drive from ANY stage converges to exactly
 * ONE committed MemberInstance" hold, and what makes a stuck provisioning a
 * DIAGNOSABLE ORPHAN (typed diagnostic) rather than a silent loss
 * (Development Plan §17.4).
 *
 * **Self-ensuring stages:** every stage method first ensures the preceding
 * stages are durably complete (idempotently), so the machine can be entered
 * from any point — a fresh `provision`, a retry, or a `recover` after a
 * crash — and always converges. A stage whose durable marker already exists
 * is SKIPPED, and a stage whose EXTERNAL effect already completed (child id
 * durably recorded) NEVER re-calls the adapter (no double effect).
 *
 * No module in this package imports any host backend or live Agent: the
 * repositories (and through them the injected storage seam) are the only
 * state boundary, and the adapter is the only external-effect boundary.
 *
 * @module @dsh-agent-team/storage/provisioning/coordinator
 */
import type { InstanceId, MemberInstanceRecordDto, RootSessionId, TemplateId } from '../../contracts/src/index.js';
import { type OperationJournal } from '../operations/index.js';
import type { TeamDomain } from '../repositories/index.js';
import type { OperationRecord } from '../schema/index.js';
import type { AgentFactoryAdapter } from './adapter.js';
import type { ProvisioningDiagnostic } from './diagnostics.js';
import { type ProvisioningStage } from './stages.js';
/** The intent type discriminator of a member provisioning operation. */
export declare const PROVISION_INTENT_TYPE = "provision-member-instance";
/**
 * The durable provisioning request: the member's runtime identity plus the
 * static creation identity, and the caller's ALLOCATION token (the logical
 * operation identity of Architecture §18.2). Re-submitting the SAME request
 * re-drives the SAME operation; a different `allocationToken` for the same
 * instance is a loud idempotency conflict.
 */
export interface ProvisionRequest {
    /** The member's stable instance id. */
    readonly instanceId: InstanceId | string;
    /** The static template identity the child Agent is built from. */
    readonly templateId: TemplateId | string;
    /** The human-facing member label (NOT a runtime identity). */
    readonly label: string;
    /** Opaque grouping metadata (optional; no state/lifecycle semantics). */
    readonly groupId?: string;
    /** The effective workspace (optional; absent means inherited). */
    readonly workspace?: string;
    /** The caller's allocation identity for this instance (idempotency key component). */
    readonly allocationToken: string;
}
/**
 * The derived provisioning state of one member: the stage, the durable
 * identities, and (when the provisioning is stuck) the typed orphan
 * diagnostic.
 */
export interface ProvisioningStatus {
    /** The derived stage. */
    readonly stage: ProvisioningStage;
    /** The durable operation id (always derivable from the member identity). */
    readonly operationId: string;
    /** The durably recorded child session id (present from CHILD_SESSION_CREATED). */
    readonly childSessionId: string | undefined;
    /** `true` exactly at the terminal stage (operation COMMITTED + ledger fact). */
    readonly committed: boolean;
    /** The typed diagnostic (an orphan, or `member-not-provisioned`), when applicable. */
    readonly diagnostic: ProvisioningDiagnostic | undefined;
}
/**
 * The durable result of a full provisioning drive (or a converged
 * re-drive): the committed member and the protocol's terminal facts.
 */
export interface ProvisionResult extends ProvisioningStatus {
    /** The committed MemberInstance record. */
    readonly member: MemberInstanceRecordDto;
    /** The ledger sequence of the operation's fact (present once committed). */
    readonly ledgerSequence: number | undefined;
    /** Effects durably written by the final drive (0 on a no-op replay). */
    readonly effectsApplied: number;
    /** Effects detected as already applied and skipped by the final drive. */
    readonly effectsSkipped: number;
}
/**
 * The durable provisioning state machine of ONE TeamSession (team-scoped,
 * like the journal it composes).
 */
export interface ProvisioningCoordinator {
    /** The team (root session id) this coordinator is scoped to. */
    readonly rootSessionId: string;
    /** The injected external-effect adapter (the fake in this task). */
    readonly adapter: AgentFactoryAdapter;
    /** The team-scoped operation journal (the operation backbone). */
    readonly journal: OperationJournal;
    /**
     * Stage 1 — `ALLOCATED`: durably reserve the operation (the PREPARED row).
     * Idempotent: an existing row is returned as-is (no write, no generation
     * bump). Ensures nothing (it is the first stage).
     */
    allocate(request: ProvisionRequest): Promise<ProvisioningStatus>;
    /**
     * Stage 2 — `CHILD_SESSION_CREATED`: run the ONE external effect (create
     * the child session, unless the child id is already durably recorded — in
     * which case the adapter is NOT called again) and durably record it
     * (operation row) plus write the MemberInstance record (which must carry
     * the child, invariant 23). Ensures `allocate`.
     */
    createChildSession(request: ProvisionRequest): Promise<ProvisioningStatus>;
    /**
     * Stage 3 — `CHILD_BOUND`: durably create the team-member SessionBinding
     * linking the child session <-> (rootSessionId, instanceId) through the
     * P4-T3 binding service (skipped when the binding already exists).
     * Ensures `createChildSession`.
     */
    bindChildSession(request: ProvisionRequest): Promise<ProvisioningStatus>;
    /**
     * Stage 4 — `INSTANCE_COMMITTED`: the terminal commit. Drives the
     * operation to COMMITTED (the journal appends the duplicate-prevented
     * ledger fact and writes the COMMITTED row). Idempotent: a COMMITTED row
     * short-circuits (no writes). Ensures `bindChildSession`.
     */
    commitInstance(request: ProvisionRequest): Promise<ProvisionResult>;
    /**
     * A fresh full provisioning drive: `allocate → createChildSession →
     * bindChildSession → commitInstance`. Because every stage is
     * self-ensuring, this also serves as the re-drive entry for a member that
     * was already partially provisioned.
     */
    provision(request: ProvisionRequest): Promise<ProvisionResult>;
    /**
     * The recovery / re-drive entry (Development Plan §17.3 roll-forward):
     * derive the current stage from durable state and drive the REMAINING
     * stages to completion, converging to exactly one committed MemberInstance
     * (or surfacing a diagnosable orphan when the external effect cannot
     * complete). Equivalent in effect to {@link provision} for a member in any
     * stage; named separately so recovery call sites read as recovery.
     */
    recover(request: ProvisionRequest): Promise<ProvisionResult>;
    /**
     * Derive the current provisioning state of one member from durable state
     * (read-only). This is the "stage is a pure function of durable state"
     * projection that makes the machine a durable protocol adapter.
     */
    status(request: ProvisionRequest | {
        readonly instanceId: InstanceId | string;
    }): ProvisioningStatus;
    /**
     * Scan the team's durable provisioning operations and return every
     * DIAGNOSABLE ORPHAN (a child session durably recorded for a member whose
     * provisioning did not reach `INSTANCE_COMMITTED`), sorted deterministically.
     * Read-only; produces typed diagnostics, never rewrites.
     */
    listOrphans(): ProvisioningDiagnostic[];
}
/** The options accepted by {@link createProvisioningCoordinator}. */
export interface CreateProvisioningCoordinatorOptions {
    /** The open TeamDomain (the sole sidecar state boundary). */
    readonly domain: TeamDomain;
    /** The team (root session id) the coordinator is scoped to. */
    readonly rootSessionId: RootSessionId | string;
    /** The injected external-effect adapter (the fake in this task). */
    readonly adapter: AgentFactoryAdapter;
    /**
     * An optional pre-built team-scoped operation journal. When omitted, one
     * is created over `domain` + `rootSessionId` with NO effects (the stage
     * work is done directly by the coordinator; the journal provides the
     * PREPARED row, the child-id recording, and the terminal ledger+COMMITTED).
     */
    readonly journal?: OperationJournal;
}
/**
 * Build the durable provisioning state machine of one TeamSession.
 * @param options - the domain, the team root, the adapter, and an optional journal.
 */
export declare function createProvisioningCoordinator(options: CreateProvisioningCoordinatorOptions): ProvisioningCoordinator;
/** Re-export for consumers that want the operation record type. */
export type { OperationRecord as ProvisioningOperationRecord };
//# sourceMappingURL=coordinator.d.ts.map