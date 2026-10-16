/**
 * Alpha.5 PR2 (plan §5, design §4.2/§4.3) — THE OPERATION ADMISSION KERNEL.
 *
 * THE POSITION (design §4.3, verbatim order):
 *
 *   per-call canonical effects → Team Admission + existing ApprovalCase →
 *   single-use OperationGrant → … → monotonic Guard → actual Dispatcher
 *
 * Admission sits BEFORE the body and decides exactly one of the three frozen
 * arms (PR0 `OperationAdmissionDecision`): `admitted` (carries the grant),
 * `requires-approval` (carries the WHOLE immutable effect set — the approver
 * legally covers all effects or none), `denied` (typed §5 error). There is no
 * arm meaning "run first, decide later", and the Guard stays the final
 * un-bypassable refusal BEHIND this door: a permission here never replaces the
 * Guard, and the Guard's abstention never replaces this decision.
 *
 * THE PER-CALL ORDER (each leg is pinned by `a5p2-admission-kernel`):
 *
 *  1. H1 clock gate (clock.ts) — before ANY authorization/expiry use; a
 *     non-finite clock denies with ZERO side effects: no probe, no plan, no
 *     mint, no ledger touch (`body = 0`).
 *  2. Identity/Realm/binding-legality checks (binding ACTIVE, realm of every
 *     effect = the call's Realm, generations current) — the same typed facts
 *     PR1's Guard established, same §5 codes.
 *  3. H2 assurance runtime verification (assurance-runtime.ts) — BEFORE any
 *     hard-profile consumption: the level never redeems alone; the record
 *     must be real and probe-matched. A denied assurance never reaches mint.
 *  4. The expansion plane (PR0 planes, realm-filtered), per the 2026-10-16
 *     ruling (问题2): `undetermined` poisons the WHOLE set (fail-closed,
 *     plan §5 unchanged); a decided policy `deny` is ROUTED, not refused —
 *     it enters the ONE ApprovalCase, whose rung is answered by the envelope
 *     WALK (the deny's owning authority), never by an invented short-circuit
 *     and never by a trusted assembler tag. Human Admin — the top rung
 *     inside envelope support — may approve once with no policy mutation;
 *     a deny whose walk cannot answer refuses as UNATTRIBUTED (ruling ③).
 *     externalHard capability facts and Domain answers are not policy rules:
 *     no approval changes facts (leg 3 gates them; ruling ②).
 *  5. Mint is LAST and only for a decided call: the ledger registers the
 *     grant; consumption stays a SEPARATE edge (`consumeForExecution`), so
 *     "admitted but never executed" cannot fake a spent approval, and
 *     "executed twice" is the one thing the ledger makes impossible.
 *
 * WHAT THE KERNEL NEVER DOES: no clock of its own (the host injects one per
 * call, gated by H1); no model-visible role or grant (every identity field is
 * a server-derived parameter — 无模型输入可信角色/Grant); no auto-narrowing,
 * no retry, no fallback (design §4.3: stale = refusal, full stop); no durable
 * store of its own (the ledger is the assembly's, the approval case stays in
 * Alpha.4's Control plane behind the caller-supplied plan/case identity).
 *
 * Purity: no `node:*`, no I/O, no timers. The `async` shape is the frozen
 * `OperationAdmission` seam, nothing more.
 *
 * @module @dsh-agent-team/runtime/tool-admission/admission-kernel
 */
import { canonicalJsonFingerprint, } from '../../domain/tool-governance/src/index.js';
import { openExecutionLease, requestLeaseCancellation, settleLeaseTermination, } from '../../domain/tool-governance/src/index.js';
import { requireFiniteClock } from './clock.js';
import { verifyAssuranceForHardProfile } from './assurance-runtime.js';
import { evaluateEffectSetExpansion, planEffectSetApproval, toolAskApprovalCaseId, verifyEffectSetApproval, } from './approval-case.js';
import { mintOperationGrant } from './grant-mint.js';
/** The deterministic grantId: the same call identity mints the same id, so a
 *  double mint registers against the SAME id (refused) — no replay surface. */
export function grantIdForCall(request, authorityGeneration) {
    const digest = canonicalJsonFingerprint({
        callId: request.callId,
        teamSessionId: request.member.teamSessionId,
        instanceId: request.member.instanceId,
        bindingId: request.binding.bindingId,
        bindingRevision: request.binding.revision,
        realmId: request.realmId,
        parametersFingerprint: request.parametersFingerprint,
        effectsFingerprint: request.requestedEffects.fingerprint,
        authorityGeneration,
    });
    return `grant:${digest.slice('sha256:'.length, 'sha256:'.length + 32)}`;
}
function denied(error) {
    return { ok: true, value: { kind: 'denied', error } };
}
/**
 * Create the kernel for one Team Agent assembly (per-closure state: only the
 * ledger, and only because consumption has to live SOMEWHERE in-process until
 * PR7's durable store lands behind the same view).
 */
export function createAdmissionKernel(options) {
    const observe = options.onObserve ?? (() => { });
    const ledger = options.ledger;
    const clockGate = (usage) => {
        // THE H1 PIN: `options.clock()` is an untrusted input exactly like a
        // model argument would be. Read once, gate once, use the gated value.
        const raw = options.clock();
        return requireFiniteClock(raw, usage);
    };
    const identityChecks = (request) => {
        const authorityGeneration = options.authorityGeneration();
        if (request.binding.status !== 'ACTIVE') {
            return {
                ok: false,
                error: {
                    code: 'ADAPTER_DRAINING',
                    message: `admission refused: binding ${request.binding.bindingId} is ${request.binding.status}, not ACTIVE — no admission on a non-active binding (PR1 state machine stands)`,
                    details: { refusal: 'binding-not-active', status: request.binding.status },
                },
            };
        }
        if (request.binding.authorityGeneration !== authorityGeneration) {
            return {
                ok: false,
                error: {
                    code: 'TOOL_BINDING_UNVERIFIED',
                    message: `admission refused: binding ${request.binding.bindingId} was validated at authority generation ${String(request.binding.authorityGeneration)}, current is ${String(authorityGeneration)} (stale generation: re-assembly, not admission)`,
                    details: { refusal: 'authority-generation-drift' },
                },
            };
        }
        const foreign = request.requestedEffects.effects.find((effect) => effect.resource !== null && effect.resource.realmId !== request.realmId);
        if (foreign !== undefined) {
            return {
                ok: false,
                error: {
                    code: 'TOOL_BINDING_UNVERIFIED',
                    message: 'admission refused: an effect targets a Realm other than this call\'s Realm (Realms never confuse each other; a cross-Realm effect set is a forged scope, not a wider request)',
                    details: { refusal: 'realm-mismatch' },
                },
            };
        }
        return { ok: true, value: { authorityGeneration } };
    };
    const assuranceGate = (request) => {
        const required = options.requiredAssurance(request);
        const outcome = verifyAssuranceForHardProfile(request.binding.assurance, required, options.assuranceProbe, request.binding);
        if (!outcome.ok)
            return outcome;
        return { ok: true, value: undefined };
    };
    const mintFor = (request, authorityGeneration, now) => {
        const issuedAt = now;
        const expiresAt = options.grantExpiry === undefined ? null : options.grantExpiry(issuedAt);
        if (expiresAt !== null && (typeof expiresAt !== 'number' || !Number.isFinite(expiresAt) || expiresAt < issuedAt)) {
            return {
                ok: false,
                error: {
                    code: 'TOOL_BINDING_UNVERIFIED',
                    message: 'admission refused: the grant expiry policy produced a non-finite or pre-issuance expiry (a broken expiry clock fails closed; `null` is the only way to state "no expiry")',
                    details: { refusal: 'grant-expiry-policy-defective' },
                },
            };
        }
        const minted = mintOperationGrant({
            grantId: grantIdForCall(request, authorityGeneration),
            member: request.member,
            callId: request.callId,
            realmId: request.realmId,
            bindingId: request.binding.bindingId,
            bindingRevision: request.binding.revision,
            authorityGeneration,
            parametersFingerprint: request.parametersFingerprint,
            effects: request.requestedEffects,
            issuedAt,
            expiresAt,
        });
        if (!minted.ok)
            return minted;
        const registered = ledger.register(minted.value);
        if (!registered.ok)
            return registered;
        observe({ event: 'admission-grant-minted', callId: request.callId, grantId: minted.value.grantId, effects: request.requestedEffects.effects.length });
        return minted;
    };
    const plan = (request) => {
        const expansion = evaluateEffectSetExpansion(request.requestedEffects, request.realmId, options.policyDocument(), options.subtreeContains);
        if (expansion.unapprovable !== null) {
            const reason = expansion.unapprovable;
            return {
                ok: false,
                error: {
                    code: reason.plane === 'expansion' ? 'IO_POLICY_UNSUPPORTED' : 'APPROVAL_STALE',
                    message: `admission refused: the request is not approvable as a whole (${reason.detail})`,
                    details: { refusal: reason.plane === 'expansion' ? 'effect-set-undetermined' : 'approval-unapprovable', effectIndex: reason.effectIndex },
                },
            };
        }
        if (expansion.needsApproval.length === 0) {
            return {
                ok: false,
                error: { code: 'APPROVAL_STALE', message: 'admission refused: planApproval asked for a plan no effect needs', details: { refusal: 'nothing-to-plan' } },
            };
        }
        const planned = planEffectSetApproval({
            effects: request.requestedEffects,
            needApproval: expansion.needsApproval,
            ...(expansion.policyDenied.length === 0 ? {} : { policyDenied: new Set(expansion.policyDenied) }),
            ...(options.denySources === undefined ? {} : { denySources: options.denySources() }),
            realmId: request.realmId,
            beneficiaryAuthority: options.beneficiaryAuthority,
            documents: options.documents(),
            authorityGeneration: options.authorityGeneration(),
            teamSessionId: request.member.teamSessionId,
            instanceId: request.member.instanceId,
            ...(options.subtreeContains === undefined ? {} : { subtreeContains: options.subtreeContains }),
        });
        if (!planned.ok) {
            const reason = planned.unapprovable;
            // Ruling ③: over a DENIED effect an unanswerable walk is an
            // UNATTRIBUTED deny source — an unproven authority, so §5's unverified
            // code fits, and the message says exactly that instead of costumes.
            if (reason.sourceUnattributed === true) {
                return {
                    ok: false,
                    error: {
                        code: 'TOOL_BINDING_UNVERIFIED',
                        message: `admission refused: a DENIED effect's owning authority could not be established — deny-source-unattributed (${reason.detail})`,
                        details: { refusal: 'deny-source-unattributed', effectIndex: reason.effectIndex },
                    },
                };
            }
            if (reason.noUpperRung === true) {
                // R-2a: authority known, ladder exhausted — its own leg, with the
                // honest suggestion (the permanent path), never a retry hook.
                return {
                    ok: false,
                    error: {
                        code: 'APPROVAL_STALE',
                        message: `admission refused: ${reason.detail}`,
                        details: { refusal: 'ask-has-no-upper-rung', effectIndex: reason.effectIndex },
                    },
                };
            }
            if (reason.sourceDiagnosis === 'ambiguous') {
                // F-1: coexisting sources over one deny — which owns it is not this
                // lane's to guess; a binding-plane refusal, never an order pick.
                return {
                    ok: false,
                    error: {
                        code: 'TOOL_BINDING_UNVERIFIED',
                        message: `admission refused: ${reason.detail}`,
                        details: { refusal: 'deny-source-ambiguous', effectIndex: reason.effectIndex },
                    },
                };
            }
            if (reason.sourceDiagnosis === 'version-drift') {
                return {
                    ok: false,
                    error: {
                        code: 'APPROVAL_STALE',
                        message: `admission refused: ${reason.detail}`,
                        details: { refusal: 'deny-source-version-drift', effectIndex: reason.effectIndex },
                    },
                };
            }
            if (reason.sourceDiagnosis === 'owner-above-ladder') {
                return {
                    ok: false,
                    error: {
                        code: 'APPROVAL_STALE',
                        message: `admission refused: ${reason.detail}`,
                        details: { refusal: 'deny-owner-above-ladder', effectIndex: reason.effectIndex },
                    },
                };
            }
            return {
                ok: false,
                error: {
                    code: 'APPROVAL_STALE',
                    message: `admission refused: no ApprovalCase may open for this effect set (${reason.detail})`,
                    details: { refusal: 'approval-unapprovable', effectIndex: reason.effectIndex },
                },
            };
        }
        return { ok: true, value: planned.value };
    };
    const admit = async (request) => {
        // 1. H1 — FIRST, before any authorization/expiry leg (zero side effects).
        const clock = clockGate(`admission of call ${request.callId}`);
        if (!clock.ok) {
            observe({ event: 'admission-clock-refused', callId: request.callId });
            return { ok: true, value: { kind: 'denied', error: clock.error } };
        }
        // 2. Identity / Realm / binding legality.
        const identity = identityChecks(request);
        if (!identity.ok)
            return denied(identity.error);
        // 3. H2 — assurance runtime verification BEFORE any hard-profile use.
        const assurance = assuranceGate(request);
        if (!assurance.ok)
            return denied(assurance.error);
        // 4. Two planes over the WHOLE effect set.
        const expansion = evaluateEffectSetExpansion(request.requestedEffects, request.realmId, options.policyDocument(), options.subtreeContains);
        if (expansion.unapprovable !== null) {
            const reason = expansion.unapprovable;
            return denied({
                code: 'IO_POLICY_UNSUPPORTED',
                message: `admission refused: the effect set is not executable as a whole (${reason.detail})`,
                details: { refusal: 'effect-set-undetermined', effectIndex: reason.effectIndex, plane: reason.plane },
            });
        }
        if (expansion.needsApproval.length > 0) {
            const planned = plan(request);
            if (!planned.ok)
                return denied(planned.error);
            observe({ event: 'admission-requires-approval', callId: request.callId, approvalCaseId: planned.value.approvalCaseId, requiredAuthority: planned.value.requiredAuthority, deniedEffects: planned.value.deniedEffects });
            return {
                ok: true,
                value: {
                    kind: 'requires-approval',
                    requestedEffects: request.requestedEffects,
                    reason: `one Alpha.4 ApprovalCase (${planned.value.approvalCaseId}) at rung ${planned.value.requiredAuthority} must legally cover ALL ${request.requestedEffects.effects.length} effects; per-effect rungs: ${planned.value.perEffectRequired.map((r, i) => (r === undefined ? String(i) : `${i}:${r}`)).join(', ')}`,
                },
            };
        }
        // 5. Policy allowed EVERY effect: mint the single-use grant. The body
        //    still has to pass Guard + consumeForExecution before it runs.
        const minted = mintFor(request, identity.value.authorityGeneration, clock.value);
        if (!minted.ok)
            return denied(minted.error);
        observe({ event: 'admission-admitted', callId: request.callId, grantId: minted.value.grantId });
        return { ok: true, value: { kind: 'admitted', grant: minted.value } };
    };
    const issueApprovedGrant = async (request, approval) => {
        const clock = clockGate(`approval finalization for call ${request.callId}`);
        if (!clock.ok)
            return { ok: false, error: clock.error };
        const identity = identityChecks(request);
        if (!identity.ok)
            return { ok: false, error: identity.error };
        const assurance = assuranceGate(request);
        if (!assurance.ok)
            return { ok: false, error: assurance.error };
        // F-1 (PR2 review round 1): the ApprovalCase identity binds the MEMBER —
        // recompute the case THIS request opens from the request's own member and
        // effect set, at the generation the presentation claims, and compare with
        // the presented id. A case computed for another member (or another set)
        // is a foreign object: typed refusal, before any legality algebra runs.
        // (The fingerprint/generation legs inside verify stay for the
        // presentation's OWN claim-set; this leg closes the member leg, which
        // verify could not see — the case identity is minted per member.)
        const expectedCaseId = toolAskApprovalCaseId({
            teamSessionId: request.member.teamSessionId,
            instanceId: request.member.instanceId,
            effectSetFingerprint: request.requestedEffects.fingerprint,
            authorityGeneration: approval.authorityGenerationAtCreation,
        });
        if (approval.approvalCaseId !== expectedCaseId) {
            observe({ event: 'admission-approval-stale', callId: request.callId, caseId: approval.approvalCaseId, detail: 'foreign case identity' });
            return {
                ok: false,
                error: {
                    code: 'APPROVAL_STALE',
                    message: `admission refused: the presented case ${approval.approvalCaseId} is not the case THIS request opens (${expectedCaseId}) — an ApprovalCase binds its member and its effect set`,
                    details: { refusal: 'approval-case-identity-mismatch', presented: approval.approvalCaseId, expected: expectedCaseId },
                },
            };
        }
        const verified = verifyEffectSetApproval({
            effects: request.requestedEffects,
            realmId: request.realmId,
            approval,
            currentAuthorityGeneration: identity.value.authorityGeneration,
            documents: options.documents(),
            ...(options.subtreeContains === undefined ? {} : { subtreeContains: options.subtreeContains }),
        });
        if (!verified.ok) {
            observe({ event: 'admission-approval-stale', callId: request.callId, caseId: approval.approvalCaseId, detail: verified.error.message });
            return verified;
        }
        // Between approval and this instant the expansion plane may have MOVED to
        // deny for some effect (an envelope change): re-run it — a grant never
        // issues over a freshly-denied effect.
        const expansion = evaluateEffectSetExpansion(request.requestedEffects, request.realmId, options.policyDocument(), options.subtreeContains);
        if (expansion.unapprovable !== null) {
            return {
                ok: false,
                error: {
                    code: 'IO_POLICY_UNSUPPORTED',
                    message: `admission refused: between approval and issue, effect ${String(expansion.unapprovable.effectIndex)} became non-executable (${expansion.unapprovable.detail}) — stale is a refusal, never a retry`,
                    details: { refusal: 'effect-set-undetermined-at-issue', effectIndex: expansion.unapprovable.effectIndex },
                },
            };
        }
        if (expansion.policyDenied.length > 0) {
            // R-1a AT ISSUE: a deny in the set must re-prove its source NOW —
            // the plan-time proof is re-run, never trusted from memory. A grant
            // never mints over a deny whose owning authority cannot be shown
            // (unwired/drift/top-owned presentations all land here).
            const reproof = plan(request);
            if (!reproof.ok) {
                observe({ event: 'admission-approval-stale', callId: request.callId, caseId: approval.approvalCaseId, detail: reproof.error.message });
                return { ok: false, error: reproof.error };
            }
            const approvedDenials = approval.deniedEffectsAtCreation ?? [];
            const reproofDenials = reproof.value.deniedEffects;
            const denialsMoved = reproofDenials.length !== approvedDenials.length
                || reproofDenials.some((pair, i) => {
                    const seen = approvedDenials[i];
                    return seen === undefined || pair.effectIndex !== seen.effectIndex || pair.requiredAuthority !== seen.requiredAuthority;
                });
            if (denialsMoved) {
                // F-2: the MAX rung can stay put while a SECOND effect's deny arrives
                // (or an existing one's provenance moves its pair) below it — that is
                // a different case than the one approved. The pairs the presentation
                // pinned are the case's per-effect provenance; moved = stale, never
                // a mint, and never a retry.
                observe({ event: 'admission-approval-stale', callId: request.callId, caseId: approval.approvalCaseId, detail: 'per-effect deny provenance moved' });
                return {
                    ok: false,
                    error: {
                        code: 'APPROVAL_STALE',
                        message: `admission refused: the deny provenance of THIS case moved between approval and issue (approved over [${approvedDenials.map((p) => `${String(p.effectIndex)}:${p.requiredAuthority}`).join(', ') || 'none'}], now [${reproofDenials.map((p) => `${String(p.effectIndex)}:${p.requiredAuthority}`).join(', ') || 'none'}]) — a late or moved per-effect deny is a different case, stale is a refusal`,
                        details: { refusal: 'deny-provenance-moved', effectSetFingerprint: request.requestedEffects.fingerprint },
                    },
                };
            }
            if (reproof.value.requiredAuthority !== approval.requiredAuthorityAtCreation) {
                observe({ event: 'admission-approval-stale', callId: request.callId, caseId: approval.approvalCaseId, detail: 'deny provenance moved the rung' });
                return {
                    ok: false,
                    error: {
                        code: 'APPROVAL_STALE',
                        message: `admission refused: the deny's provenance now puts this case at rung ${reproof.value.requiredAuthority}, not the rung ${approval.requiredAuthorityAtCreation} the approval was granted at — the presentation is stale`,
                        details: { refusal: 'approval-case-stale', effectSetFingerprint: request.requestedEffects.fingerprint },
                    },
                };
            }
        }
        const minted = mintFor(request, identity.value.authorityGeneration, clock.value);
        if (!minted.ok)
            return minted;
        observe({ event: 'admission-approved-grant-issued', callId: request.callId, caseId: approval.approvalCaseId, grantId: minted.value.grantId });
        return minted;
    };
    const consumeForExecution = (grant, call) => {
        const clock = clockGate(`execution consumption of grant ${grant.grantId}`);
        if (!clock.ok)
            return { ok: false, error: clock.error };
        if (call.cancelRequested === true) {
            // Cancel BEFORE the edge: the grant stays unconsumed, the ledger is
            // untouched — a cancelled call never spends an approval (plan §5,
            // Cancel-first).
            return {
                ok: false,
                error: {
                    code: 'APPROVAL_STALE',
                    message: `admission refused: cancellation was requested before the execution edge of grant ${grant.grantId}; the approval stays unspent and is never replayed implicitly`,
                    details: { refusal: 'cancelled-before-execution' },
                },
            };
        }
        const { cancelRequested: _c, executionKind, leaseId, ...fields } = call;
        const outcome = ledger.consume(grant.grantId, { ...fields, now: clock.value });
        if (!outcome.ok) {
            return { ok: false, error: { code: outcome.errorCode, message: outcome.message, details: { refusal: outcome.reason } } };
        }
        if (executionKind === undefined)
            return { ok: true, value: { grant: outcome.grant, lease: null } };
        const lease = openExecutionLease({
            leaseId: leaseId ?? `lease:${grant.grantId}`,
            grant: outcome.grant,
            executionKind,
            scope: outcome.grant.effects,
        });
        if (!lease.ok) {
            // The consume ALREADY happened — the execution may now not start, and
            // honesty requires saying so: the approval is spent, the side effect
            // status is unknown to us.
            return {
                ok: false,
                error: {
                    code: 'EXECUTION_TERMINATION_UNCONFIRMED',
                    message: `admission: the grant was consumed but no lease could be opened (${lease.problems.map((p) => p.detail).join('; ')}); the execution must not start, and the spent approval is not silently restored`,
                    sideEffectUnknown: true,
                    details: { refusal: 'lease-open-refused-after-consume' },
                },
            };
        }
        observe({ event: 'admission-grant-consumed', grantId: grant.grantId, callId: call.callId, leaseId: lease.value.leaseId });
        return { ok: true, value: { grant: outcome.grant, lease: lease.value } };
    };
    return {
        admit,
        planApproval: plan,
        issueApprovedGrant,
        consumeForExecution,
        requestCancellation: (lease) => {
            const advanced = requestLeaseCancellation(lease);
            return advanced.ok ? { ok: true, value: advanced.lease } : { ok: false, error: { code: 'EXECUTION_TERMINATION_UNCONFIRMED', message: advanced.problems.map((p) => p.detail).join('; '), sideEffectUnknown: true } };
        },
        settleTermination: (lease, confirmed) => {
            const advanced = settleLeaseTermination(lease, confirmed);
            return advanced.ok ? { ok: true, value: advanced.lease } : { ok: false, error: { code: 'EXECUTION_TERMINATION_UNCONFIRMED', message: advanced.problems.map((p) => p.detail).join('; '), sideEffectUnknown: true } };
        },
    };
}
//# sourceMappingURL=admission-kernel.js.map