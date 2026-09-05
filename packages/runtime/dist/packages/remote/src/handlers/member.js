/**
 * The `member` category handler (design note §3): member admission
 * actions (create / send / follow-up) over the P6-T2 TeamRuntime facade,
 * and member lifecycle (archive / restore / dispose) over the P7-T3
 * LifecycleService.
 *
 * The admission outcome's durable effect sequence (when the effect carries
 * one) rides in the reply's provenance (`effectSequence`).
 *
 * Pure module: no I/O, no node: builtins, no runtime environment
 * assumptions.
 * @module @dsh-agent-team/remote/handlers/member
 */
/**
 * The durable effect sequence of an admission outcome, when its effect
 * carries one. The effect is the P6-T2 `RuntimeActionEffect` closed union
 * (runtime/admission/types.ts); the canonical sequence field per kind:
 *
 *  - `fact-recorded`, `work-admitted`, `lifecycle-changed` → `sequence`
 *    (the durable ledger fact sequence — always written for these kinds);
 *  - `member-activated` → `ledgerSequence` (the provider's durable ledger
 *    sequence, when carried; absent otherwise);
 *  - `none`, `config-inspected`, `members-listed`, `templates-listed` →
 *    no sequence (read effects).
 *
 * Any other shape (unknown or absent `kind`, non-object effect,
 * non-safe-integer value) yields no provenance sequence (the wire cell is
 * `null` — the frozen Remote contract v1 surface is unchanged).
 */
function admissionEffectSequence(outcome) {
    const effect = outcome['effect'];
    if (effect === null || typeof effect !== 'object' || Array.isArray(effect))
        return undefined;
    const effectRecord = effect;
    let candidate;
    switch (typeof effectRecord['kind'] === 'string' ? effectRecord['kind'] : '') {
        case 'fact-recorded':
        case 'work-admitted':
        case 'lifecycle-changed':
            candidate = effectRecord['sequence'];
            break;
        case 'member-activated':
            candidate = effectRecord['ledgerSequence'];
            break;
        default:
            // `none`, `config-inspected`, `members-listed`, `templates-listed`,
            // or an unknown/absent kind: the effect carries no sequence.
            return undefined;
    }
    if (typeof candidate === 'number' && Number.isSafeInteger(candidate)) {
        return candidate;
    }
    return undefined;
}
/**
 * The member category handler (`member.create`, `member.send`,
 * `member.followup`, `member.archive`, `member.restore`, `member.dispose`).
 */
export function createRemoteMemberHandler(ports) {
    return (method, params) => {
        switch (method) {
            case 'member.create': {
                const createParams = params;
                const request = {
                    rootSessionId: createParams.teamSessionId,
                    action: 'create-member',
                    caller: createParams.caller,
                    requestToken: createParams.requestToken,
                    ...(createParams.delegationTemplateId !== undefined
                        ? { delegationTemplateId: createParams.delegationTemplateId }
                        : {}),
                    ...(createParams.delegationInstanceId !== undefined
                        ? { delegationInstanceId: createParams.delegationInstanceId }
                        : {}),
                    ...(createParams.payload !== undefined ? { payload: createParams.payload } : {}),
                };
                const outcome = ports.admission.performAction(request);
                return {
                    data: { outcome },
                    effectSequence: admissionEffectSequence(outcome),
                };
            }
            case 'member.send': {
                const sendParams = params;
                const request = {
                    rootSessionId: sendParams.teamSessionId,
                    action: 'send-message',
                    caller: sendParams.caller,
                    requestToken: sendParams.requestToken,
                    targetInstanceId: sendParams.recipientInstanceId,
                    body: sendParams.body,
                    ...(sendParams.subject !== undefined ? { subject: sendParams.subject } : {}),
                    ...(sendParams.payload !== undefined ? { payload: sendParams.payload } : {}),
                };
                const outcome = ports.admission.performAction(request);
                return {
                    data: { outcome },
                    effectSequence: admissionEffectSequence(outcome),
                };
            }
            case 'member.followup': {
                const followupParams = params;
                const request = {
                    rootSessionId: followupParams.teamSessionId,
                    action: 'follow-up',
                    caller: followupParams.caller,
                    requestToken: followupParams.requestToken,
                    targetInstanceId: followupParams.targetInstanceId,
                    ...(followupParams.payload !== undefined ? { payload: followupParams.payload } : {}),
                };
                const outcome = ports.admission.performAction(request);
                return {
                    data: { outcome },
                    effectSequence: admissionEffectSequence(outcome),
                };
            }
            case 'member.archive': {
                const lifecycleParams = params;
                const result = ports.lifecycle.archive(lifecycleParams.teamSessionId, lifecycleParams.instanceId);
                return { data: result };
            }
            case 'member.restore': {
                const lifecycleParams = params;
                const result = ports.lifecycle.restore(lifecycleParams.teamSessionId, lifecycleParams.instanceId);
                return { data: result };
            }
            case 'member.dispose': {
                const lifecycleParams = params;
                const result = ports.lifecycle.dispose(lifecycleParams.teamSessionId, lifecycleParams.instanceId);
                return { data: result };
            }
            default:
                throw new Error(`member handler routed an unknown method: ${method}`);
        }
    };
}
//# sourceMappingURL=member.js.map