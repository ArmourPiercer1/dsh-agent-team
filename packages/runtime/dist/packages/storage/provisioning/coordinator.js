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
import { MEMBER_LIFECYCLE_STATES, parseChildSessionId, parseInstanceId, parseRootSessionId, parseTemplateId, } from '../../contracts/src/index.js';
import { createOperationJournal, } from '../operations/index.js';
import { SessionBindingService } from '../bindings/index.js';
import { OPERATION_PHASES } from '../schema/index.js';
import { createProvisioningDiagnostic, PROVISIONING_DIAGNOSTIC_CODES } from './diagnostics.js';
import { provisioningIdempotencyKey, provisioningOperationId } from './identity.js';
import { PROVISIONING_STAGES } from './stages.js';
/** The intent type discriminator of a member provisioning operation. */
export const PROVISION_INTENT_TYPE = 'provision-member-instance';
/**
 * Build the durable provisioning state machine of one TeamSession.
 * @param options - the domain, the team root, the adapter, and an optional journal.
 */
export function createProvisioningCoordinator(options) {
    const root = String(parseRootSessionId(options.rootSessionId));
    const domain = options.domain;
    const repositories = domain.repositories;
    const journal = options.journal ?? createOperationJournal(domain, root);
    const bindingService = new SessionBindingService(repositories);
    const adapter = options.adapter;
    // ---------------------------------------------------------------- helpers
    /** Resolve + validate one request into its durable identity. */
    function resolveRequest(request) {
        const instanceId = String(parseInstanceId(request.instanceId));
        const templateId = String(parseTemplateId(request.templateId));
        const payload = {
            label: request.label,
            instanceId,
            rootSessionId: root,
            templateId,
        };
        if (request.groupId !== undefined)
            payload.groupId = request.groupId;
        if (request.workspace !== undefined)
            payload.workspace = request.workspace;
        return {
            instanceId,
            templateId,
            operationId: provisioningOperationId(root, instanceId),
            idempotencyKey: provisioningIdempotencyKey(root, instanceId, request.allocationToken),
            intent: { type: PROVISION_INTENT_TYPE, payload },
        };
    }
    /**
     * Build the journal request for one resolved provisioning request. The
     * request NEVER carries the child session id: the child is allocated by
     * the external adapter and recorded afterwards through
     * `journal.recordChildSession` (the documented protocol path for
     * externally allocated children — prepare, create, recordChildSession,
     * drive).
     */
    function buildOperationRequest(resolved) {
        return {
            operationId: resolved.operationId,
            idempotencyKey: resolved.idempotencyKey,
            intent: resolved.intent,
        };
    }
    function nowIso() {
        return new Date().toISOString();
    }
    /** Does a ledger fact exist for this operation (the committed marker's half)? */
    function factExists(operationId) {
        return journal.factSequence(operationId) !== undefined;
    }
    /**
     * Derive the provisioning status of one member from durable state (the
     * read-only projection that makes the stage a pure function of durable
     * state).
     */
    function deriveStatus(resolved) {
        const op = repositories.operations.get(resolved.operationId);
        if (op === undefined) {
            return {
                stage: PROVISIONING_STAGES.NONE,
                operationId: resolved.operationId,
                childSessionId: undefined,
                committed: false,
                diagnostic: createProvisioningDiagnostic(PROVISIONING_DIAGNOSTIC_CODES.MEMBER_NOT_PROVISIONED, root, resolved.instanceId, PROVISIONING_STAGES.NONE, `no durable provisioning state for member '${resolved.instanceId}'`, { operationId: resolved.operationId }),
            };
        }
        const childSessionId = op.childSessionId !== undefined ? String(op.childSessionId) : undefined;
        const committed = op.phase === OPERATION_PHASES.COMMITTED && factExists(resolved.operationId);
        let stage;
        if (committed) {
            stage = PROVISIONING_STAGES.INSTANCE_COMMITTED;
        }
        else if (childSessionId === undefined) {
            stage = PROVISIONING_STAGES.ALLOCATED;
        }
        else {
            const binding = repositories.sessionBindings.get(childSessionId);
            const bound = binding !== undefined &&
                binding.kind === 'team-member' &&
                String(binding.rootSessionId) === root &&
                String(binding.instanceId) === resolved.instanceId;
            stage = bound ? PROVISIONING_STAGES.CHILD_BOUND : PROVISIONING_STAGES.CHILD_SESSION_CREATED;
        }
        let diagnostic;
        // NOTE: stage === NONE is unreachable here (the no-operation case returns
        // early above); committed is the only non-orphan stage reached at this
        // point.
        if (stage === PROVISIONING_STAGES.INSTANCE_COMMITTED) {
            diagnostic = undefined;
        }
        else if (childSessionId !== undefined) {
            // A child is durably recorded but the member is not committed: a
            // Diagnosable Orphan (Development Plan §17.4). Name the exact missing
            // pieces so it is diagnosable, never a silent loss.
            const record = repositories.memberInstances.get(root, resolved.instanceId);
            const binding = repositories.sessionBindings.get(childSessionId);
            const bound = binding !== undefined &&
                binding.kind === 'team-member' &&
                String(binding.rootSessionId) === root &&
                String(binding.instanceId) === resolved.instanceId;
            const missing = [];
            if (record === undefined)
                missing.push('record');
            if (!bound)
                missing.push('binding');
            missing.push('commit');
            diagnostic = createProvisioningDiagnostic(PROVISIONING_DIAGNOSTIC_CODES.ORPHANED_CHILD_SESSION, root, resolved.instanceId, stage, `child session '${childSessionId}' was created for member '${resolved.instanceId}' but provisioning stalled at '${stage}'`, {
                operationId: resolved.operationId,
                childSessionId,
                context: { missing },
            });
        }
        return { stage, operationId: resolved.operationId, childSessionId, committed, diagnostic };
    }
    // ------------------------------------------------------------- the stages
    async function allocate(request) {
        const resolved = resolveRequest(request);
        await journal.prepare(buildOperationRequest(resolved));
        return deriveStatus(resolved);
    }
    async function createChildSession(request) {
        const resolved = resolveRequest(request);
        // Ensure ALLOCATED (the PREPARED row exists) before the external effect.
        await journal.prepare(buildOperationRequest(resolved));
        const existing = repositories.operations.get(resolved.operationId);
        // If the child id is already durably recorded, the external effect
        // ALREADY completed: do NOT call the adapter again (no double effect).
        if (existing !== undefined && existing.childSessionId !== undefined) {
            await ensureMemberRecord(resolved, String(existing.childSessionId));
            return deriveStatus(resolved);
        }
        // The one external effect.
        const result = await adapter.createChildSession({
            rootSessionId: root,
            instanceId: resolved.instanceId,
            templateId: resolved.templateId,
            label: request.label,
            ...(request.workspace !== undefined ? { workspace: request.workspace } : {}),
        });
        // Durably record the child id (operation row generation bump) — this is
        // the CHILD_SESSION_CREATED durable marker, written BEFORE the next
        // effect step (the member record and the binding).
        await journal.recordChildSession(resolved.operationId, String(result.childSessionId));
        await ensureMemberRecord(resolved, String(result.childSessionId));
        return deriveStatus(resolved);
    }
    async function bindChildSession(request) {
        const resolved = resolveRequest(request);
        // Ensure CHILD_SESSION_CREATED (child recorded + member record written).
        await createChildSession(request);
        const op = repositories.operations.get(resolved.operationId);
        const childSessionId = op !== undefined && op.childSessionId !== undefined ? String(op.childSessionId) : undefined;
        if (childSessionId === undefined) {
            // Unreachable (createChildSession ensures the child), but fail loudly.
            throw new Error(`provisioning: no child session recorded for member '${resolved.instanceId}' before binding`);
        }
        const existing = repositories.sessionBindings.get(childSessionId);
        if (existing === undefined) {
            await bindingService.createTeamMemberBinding(root, resolved.instanceId, childSessionId);
        }
        else if (existing.kind !== 'team-member' ||
            String(existing.rootSessionId) !== root ||
            String(existing.instanceId) !== resolved.instanceId) {
            // The child is bound to something else: a loud typed conflict (the
            // repository/service would raise it; we name it here for clarity).
            throw new Error(`provisioning: child session '${childSessionId}' is already bound to another member; the durable child is never re-pointed`);
        }
        // else: already bound to us -> skipped (no write).
        return deriveStatus(resolved);
    }
    async function commitInstance(request) {
        const resolved = resolveRequest(request);
        // Ensure CHILD_BOUND (the binding is durable) before the terminal.
        await bindChildSession(request);
        const terminal = await journal.drive(resolved.operationId);
        const member = repositories.memberInstances.get(root, resolved.instanceId);
        if (member === undefined) {
            // Unreachable (bindChildSession ensures the record), but fail loudly.
            throw new Error(`provisioning: member record missing for '${resolved.instanceId}' at commit`);
        }
        const base = deriveStatus(resolved);
        return {
            ...base,
            member,
            ledgerSequence: terminal.ledgerSequence,
            effectsApplied: terminal.effectsApplied,
            effectsSkipped: terminal.effectsSkipped,
        };
    }
    async function provision(request) {
        await allocate(request);
        await createChildSession(request);
        await bindChildSession(request);
        return commitInstance(request);
    }
    async function recover(request) {
        // Roll-forward: derive the stage from durable state and drive the
        // REMAINING stages to completion (each stage is self-ensuring).
        return commitInstance(request);
    }
    function status(request) {
        // `status` needs only the member identity to derive the operation id and
        // read durable state; a full request is accepted for convenience.
        const resolved = 'templateId' in request ? resolveRequest(request) : { ...resolveForIdentityOnly(String(request.instanceId)) };
        return deriveStatus(resolved);
    }
    function listOrphans() {
        const orphans = [];
        for (const op of repositories.operations.list()) {
            if (op.intent.type !== PROVISION_INTENT_TYPE)
                continue;
            const payloadRoot = op.intent.payload['rootSessionId'];
            if (payloadRoot !== root)
                continue; // not this team
            const instanceId = op.intent.payload['instanceId'];
            if (typeof instanceId !== 'string')
                continue;
            const resolved = resolveForIdentityOnly(instanceId);
            const s = deriveStatus(resolved);
            if (s.diagnostic !== undefined && s.diagnostic.code === PROVISIONING_DIAGNOSTIC_CODES.ORPHANED_CHILD_SESSION) {
                orphans.push(s.diagnostic);
            }
        }
        orphans.sort((a, b) => (a.instanceId < b.instanceId ? -1 : a.instanceId > b.instanceId ? 1 : 0));
        return orphans;
    }
    // ------------------------------------------------------- internal helpers
    /**
     * Resolve a request that carries ONLY the instance id (for `status` on a
     * partial request and `listOrphans`): the operation id depends only on
     * (root, instanceId), and `deriveStatus` reads the child/binding/commit
     * from durable state (the label/template are not needed for the projection).
     */
    function resolveForIdentityOnly(instanceIdRaw) {
        const instanceId = String(parseInstanceId(instanceIdRaw));
        return {
            instanceId,
            templateId: '',
            operationId: provisioningOperationId(root, instanceId),
            idempotencyKey: '',
            intent: { type: PROVISION_INTENT_TYPE, payload: { instanceId, rootSessionId: root, templateId: '', label: '' } },
        };
    }
    /**
     * Write the MemberInstance record for one member (check-then-apply): a
     * record already present for (root, instance) with the SAME child is
     * SKIPPED (applied once, never re-written — invariant 24: the durable
     * child is never re-pointed); a record with a DIFFERENT child is a loud
     * conflict. The record MUST exist before the binding (the binding service's
     * precondition) and MUST carry the child (invariant 23).
     */
    async function ensureMemberRecord(resolved, childSessionId) {
        const existing = repositories.memberInstances.get(root, resolved.instanceId);
        if (existing !== undefined) {
            if (String(existing.childSessionId) !== childSessionId) {
                throw new Error(`provisioning: member ('${root}', '${resolved.instanceId}') is bound to child '${String(existing.childSessionId)}'; the durable child is never re-pointed`);
            }
            return; // identical record -> skipped
        }
        await repositories.memberInstances.put({
            rootSessionId: root,
            instanceId: resolved.instanceId,
            templateId: resolved.templateId,
            label: String(resolved.intent.payload['label']),
            ...(typeof resolved.intent.payload['groupId'] === 'string' ? { groupId: String(resolved.intent.payload['groupId']) } : {}),
            childSessionId: parseChildSessionId(childSessionId),
            ...(typeof resolved.intent.payload['workspace'] === 'string' ? { workspace: String(resolved.intent.payload['workspace']) } : {}),
            lifecycle: MEMBER_LIFECYCLE_STATES.CREATED,
            createdAt: nowIso(),
            activityVersion: 1,
        });
    }
    return {
        rootSessionId: root,
        adapter,
        journal,
        allocate,
        createChildSession,
        bindChildSession,
        commitInstance,
        provision,
        recover,
        status,
        listOrphans,
    };
}
//# sourceMappingURL=coordinator.js.map