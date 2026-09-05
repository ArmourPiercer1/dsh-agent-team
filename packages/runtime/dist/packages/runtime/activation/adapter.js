/**
 * The activation child-session adapter (TaskDoc §11.7 P6-T1, step 13 of the
 * DevPlan §19.2 order).
 *
 * The P4-T4 provisioning coordinator takes its one external effect through
 * the narrow {@link AgentFactoryAdapter}. This module adapts the
 * ActivationProvider's {@link ChildSessionFactoryPort} to that seam and
 * makes the SESSION-DURABILITY BARRIER part of the effect: the barrier runs
 * UNCONDITIONALLY between the factory's external effect and the durable
 * recording of the child id (the DevPlan §17.3/§18.5 "Session durable"
 * postcondition — the child artifact is durable BEFORE the MemberInstance
 * record is written, and `ensureDurable` is never called conditionally).
 *
 * Crash-window semantics (Architecture §18, DevPlan §17.3):
 *
 * - factory success + barrier success → the coordinator durably records the
 *   child id (the CHILD_SESSION_CREATED marker);
 * - factory success + barrier FAULT → the adapter throws (mapped to
 *   `ACTIVATION_BARRIER_REJECTED`); the durable recording never happens, so
 *   the operation stays PREPARED; a re-drive of the SAME logical operation
 *   re-calls the factory (its idempotency contract returns the SAME child)
 *   and re-runs the barrier — no second child, no orphan marker;
 * - factory FAULT → `ACTIVATION_CHILD_SESSION_CREATION_FAILED`; the
 *   operation stays PREPARED (nothing durable was written).
 *
 * The adapter is stateless; its idempotency is inherited from the factory
 * port contract (idempotent on `(rootSessionId, instanceId)`).
 *
 * @module @dsh-agent-team/runtime/activation/adapter
 */
import { parseChildSessionId } from '../../contracts/src/index.js';
import { ACTIVATION_ERROR_CODES, ActivationError, } from './errors.js';
/**
 * Build the activation child-session adapter over the factory + durability
 * ports.
 *
 * @param factory - the child-session factory (the one external effect;
 *   idempotent on `(rootSessionId, instanceId)`).
 * @param durability - the session-durability barrier (UNCONDITIONAL on the
 *   fresh-create path).
 * @returns the P4-T4 adapter the provisioning coordinator consumes.
 */
export function createActivationChildAdapter(factory, durability) {
    return {
        async createChildSession(request) {
            let childSessionId;
            try {
                const result = await factory.createChildSession({
                    rootSessionId: request.rootSessionId,
                    instanceId: request.instanceId,
                    templateId: request.templateId,
                    label: request.label,
                    ...(request.workspace !== undefined ? { workspace: request.workspace } : {}),
                });
                childSessionId = result.childSessionId;
            }
            catch (error) {
                throw new ActivationError(ACTIVATION_ERROR_CODES.CHILD_SESSION_CREATION_FAILED, `activation: child-session creation failed for member '${request.instanceId}': ${String(error)}`, { rootSessionId: request.rootSessionId, instanceId: request.instanceId });
            }
            try {
                await durability.ensureDurable(childSessionId);
            }
            catch (error) {
                throw new ActivationError(ACTIVATION_ERROR_CODES.BARRIER_REJECTED, `activation: the session-durability barrier rejected child session '${childSessionId}' (unconditional barrier — the child artifact must be durable before the member record): ${String(error)}`, { childSessionId });
            }
            return { childSessionId: parseChildSessionId(childSessionId) };
        },
    };
}
//# sourceMappingURL=adapter.js.map