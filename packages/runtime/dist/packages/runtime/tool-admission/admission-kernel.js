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
 * PRODUCTION ASSEMBLY ENTRY (PR2/PR3 production-assembly round, P-A writer):
 * THE FILE ALSO CARRIES `deriveTeamPolicyAuthority` (template
 * `capabilities.permissions` → the PR0 policy document + R-1a deny sources —
 * the production replacement for the evidence kits' fixture-constant policy
 * arms) and `createProductionAdmissionAssembly` (the kernel admission
 * production entry class: derivation + kernel wiring + the default-deny gate
 * + the PR3 FS-admission port adapter). The kernel law above this marker is
 * byte-unchanged; the additions REUSE it, never restate it. The assembly
 * contract for the host (GLUE-5) lives at
 * `dev/agent-workflow/evidence/alpha5/prod/pa-CONTRACT.md`.
 *
 * @module @dsh-agent-team/runtime/tool-admission/admission-kernel
 */
import { canonicalJsonFingerprint, parseToolPolicyDocument, } from '../../domain/tool-governance/src/index.js';
import { openExecutionLease, requestLeaseCancellation, settleLeaseTermination, } from '../../domain/tool-governance/src/index.js';
// THE PRODUCTION AUTHORITY INPUT (PR2/PR3 production-assembly round): the
// blueprint domain's static template permission policy — the object the live
// glue reads off the bound template (`boundTemplate.capabilities?.permissions`).
// Imported from the blueprint LEAF modules: `schema.js` carries the closed
// value sets (no re-spelled membership lists), `types.js` the shapes; the
// blueprint BARREL would drag the YAML parser into this lane's installed-form
// graph, so it is deliberately not imported.
import { PERMISSION_PATH_MAX_LENGTH, PERMISSION_RESOURCE_KINDS, PERMISSION_RULE_FIELDS, PERMISSION_TOOL_NAMES, } from '../../domain/blueprint/src/schema.js';
// The Alpha.2 file/shell tool classification — the runtime's single source
// (`operation-permission/types.ts`), never a second membership list. (The
// shell-class membership decides the grammar branches below; the file class
// is carried by the effect-kind map `RESOURCE_EFFECT_KINDS` + the lsp arm,
// so only the shell list is cited here.) Alpha.5 M2 (root 20:05 limited
// card) adds the third classification sites below: the FILE list narrows
// the whole-tool deny law to TRULY file tools, and the INVOCATION-ONLY
// list (schedule_list / schedule_delete) accepts `any` in all three lanes
// and refuses exact/subtree — never shell, never file, no file matcher.
import { FILE_PERMISSION_TOOL_VALUES, INVOCATION_ONLY_PERMISSION_TOOL_VALUES, SHELL_PERMISSION_TOOL_VALUES, } from '../operation-permission/types.js';
import { requireFiniteClock } from './clock.js';
import { createStubAssuranceProbe, verifyAssuranceForHardProfile } from './assurance-runtime.js';
import { evaluateEffectSetExpansion, planEffectSetApproval, toolAskApprovalCaseId, verifyEffectSetApproval, } from './approval-case.js';
import { createGrantLedger, mintOperationGrant } from './grant-mint.js';
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
// ═══════════════════════════════════════════════════════════════════════════
// THE PRODUCTION ASSEMBLY ENTRY (PR2/PR3 production-assembly round)
// ═══════════════════════════════════════════════════════════════════════════
//
// WHAT IS SOLIDIFIED HERE (the sequence the accepted W5 / C-04/05 / C-08 /
// live-round evidence kits demonstrated, promoted from fixture builders to a
// production class — the kits' fixture-constant `policyArms` are REPLACED by
// the REAL authority input):
//
//   1. THE INPUT IS THE TEMPLATE'S OWN POLICY OBJECT. `permissionPolicy` is
//      the A1-normalized `TemplatePermissionPolicy` the glue reads off the
//      bound template (`agent-bindings.mjs`: `boundTemplate.capabilities?.
//      permissions`) — default + allow/ask/deny lanes of `{tool, resource}`
//      rules. The blueprint validator already ran at document parse; this
//      entry RE-VERIFIES the shape defensively and refuses (typed, fail
//      closed) anything outside the closed grammar.
//   2. THE PROJECTION (deriveTeamPolicyAuthority) maps each lane rule into
//      the PR0 closed document family (exact/subtree matchers only — there
//      is no `any` matcher, ever): every rule projects its `tool-invoke` arm
//      (`<realm>|tool:<name>`, the lane the kit's scopeKey law pins), and a
//      file-class resource rule projects the effect-kind companions
//      (read/read_image ⇒ read + meta, write/edit ⇒ write + meta — the meta
//      companion is the C-FS resolve/stat leg: without it, an ALLOWED read
//      would Ask at every stat, a documented functional break). A shape the
//      closed family CANNOT carry is never dropped in the loose direction:
//      an unprojectable DENY (whole-tool file deny, lsp resource deny) and
//      an uncanonicalizable ask/deny rule FAIL THE CONSTRUCTION; a skipped
//      allow only tightens (no-authority ⇒ Ask, never an invented allow) and
//      is recorded as a note.
//   3. R-1a DENY SOURCES come from the deny lane READ-TIME: owner = the
//      definition-owner rung the host declares, `sourceRef =
//      <templateId>#deny[<lane index>]`, `sourceVersion = authorityGeneration()`
//      at every read (so the kernel's version trust always matches the call's
//      generation, and ruling ①'s upgradable-Ask routing needs no invention).
//   4. `default: 'deny'` has no catch-all matcher to project — the assembly
//      gates it BEFORE the kernel: an effect no projection rule covers is
//      denied typed, with ZERO kernel side effects (same posture as H1).
//      `default: 'ask'` needs nothing: PR0's no-authority arm IS the Ask.
//   5. THE FS PORT is the kernel's own execution edge (`consumeForExecution`
//      — the one-shot law), shaped structurally to the C-FS lane's
//      `FsAdmissionPort`; the lane binds it to the PR1 canonical fingerprint
//      (`bindAdmissionRecheck` law, unchanged).
/** Effect-kind companions each file tool's resource rule projects (absent ⇒
 *  the tool carries no PR0 resource-effect mapping — its rules project the
 *  tool-invoke arm only; a DENY needing an absent mapping fails closed). */
const RESOURCE_EFFECT_KINDS = Object.freeze({
    read: Object.freeze(['read', 'meta']),
    read_image: Object.freeze(['read', 'meta']),
    write: Object.freeze(['write', 'meta']),
    edit: Object.freeze(['write', 'meta']),
});
const isPlainRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value);
function projectionRefusal(code, refusalTag, message) {
    return { ok: false, error: { code, message, details: { refusal: refusalTag } } };
}
function matcherCovers(matcher, resource, subtreeContains) {
    if (matcher.kind === 'exact')
        return matcher.resource === resource;
    // A subtree matcher without the seam answers only for its own root — the
    // containment question stays unanswerable, which the default-deny gate
    // reads as NOT covered (denied): the fail-closed direction.
    return subtreeContains !== undefined ? subtreeContains(matcher.resource, resource) : matcher.resource === resource;
}
/**
 * PROJECT the template's static permission policy into the PR0 authority
 * arms — the production replacement for the kits' `allowPolicy(tg, arms)`
 * fixture constants. Deterministic: lane order allow → ask → deny, rules in
 * declaration order, duplicates kept (mirrors the A1 normalization law).
 * Refusals are typed and name the exact rule (path `lane[i]`), because the
 * consumer is a host assembly, not a model.
 */
export function deriveTeamPolicyAuthority(input) {
    if (typeof input.realmId !== 'string' || input.realmId.length === 0) {
        return projectionRefusal('TOOL_BINDING_UNVERIFIED', 'projection-input-malformed', 'projection refused: realmId must be a non-empty string');
    }
    if (typeof input.templateId !== 'string' || input.templateId.length === 0) {
        return projectionRefusal('TOOL_BINDING_UNVERIFIED', 'projection-input-malformed', 'projection refused: templateId must be a non-empty string (deny sources name their origin)');
    }
    if (input.role !== 'leader' && input.role !== 'member') {
        return projectionRefusal('TOOL_BINDING_UNVERIFIED', 'projection-input-malformed', 'projection refused: role must be the closed template role (leader | member)');
    }
    const policy = input.permissionPolicy;
    if (!isPlainRecord(policy)) {
        return projectionRefusal('TOOL_BINDING_UNVERIFIED', 'projection-input-malformed', 'projection refused: the template permission policy must be a record { default, allow, ask, deny }');
    }
    const templateDefault = policy['default'];
    if (templateDefault !== 'ask' && templateDefault !== 'deny') {
        return projectionRefusal('TOOL_BINDING_UNVERIFIED', 'projection-input-malformed', 'projection refused: policy.default must be ask | deny (default allow is rejected by the blueprint grammar — no silent privilege expansion)');
    }
    const lanes = { allow: policy['allow'], ask: policy['ask'], deny: policy['deny'] };
    for (const lane of ['allow', 'ask', 'deny']) {
        if (!Array.isArray(lanes[lane])) {
            return projectionRefusal('TOOL_BINDING_UNVERIFIED', 'projection-input-malformed', `projection refused: policy.${lane} must be an array (possibly empty)`);
        }
    }
    const entries = [];
    const denySources = [];
    const notes = [];
    let hasSubtree = false;
    for (const lane of ['allow', 'ask', 'deny']) {
        const rules = lanes[lane];
        for (let index = 0; index < rules.length; index += 1) {
            const path = `${lane}[${String(index)}]`;
            const rule = rules[index];
            if (!isPlainRecord(rule) || !Object.keys(rule).every((key) => PERMISSION_RULE_FIELDS.includes(key))) {
                return projectionRefusal('TOOL_BINDING_UNVERIFIED', 'projection-rule-malformed', `projection refused: rule ${path} must be a record with fields from {${PERMISSION_RULE_FIELDS.join(', ')}}`);
            }
            const tool = rule['tool'];
            if (typeof tool !== 'string' || !PERMISSION_TOOL_NAMES.includes(tool)) {
                return projectionRefusal('TOOL_BINDING_UNVERIFIED', 'projection-rule-malformed', `projection refused: rule ${path}.tool must be one of ${PERMISSION_TOOL_NAMES.join(' | ')}`);
            }
            const permissionTool = tool;
            const resource = rule['resource'];
            if (!isPlainRecord(resource)) {
                return projectionRefusal('TOOL_BINDING_UNVERIFIED', 'projection-rule-malformed', `projection refused: rule ${path}.resource must be a record { kind, path? }`);
            }
            const kind = resource['kind'];
            if (typeof kind !== 'string' || !PERMISSION_RESOURCE_KINDS.includes(kind)) {
                return projectionRefusal('TOOL_BINDING_UNVERIFIED', 'projection-rule-malformed', `projection refused: rule ${path}.resource.kind must be one of ${PERMISSION_RESOURCE_KINDS.join(' | ')}`);
            }
            const isShell = SHELL_PERMISSION_TOOL_VALUES.includes(permissionTool);
            const isFileTool = FILE_PERMISSION_TOOL_VALUES.includes(permissionTool);
            const isInvocationOnly = INVOCATION_ONLY_PERMISSION_TOOL_VALUES.includes(permissionTool);
            const invokeMatcher = { kind: 'exact', resource: `${input.realmId}|tool:${permissionTool}` };
            if (kind === 'any') {
                if (Object.keys(resource).some((key) => key !== 'kind')) {
                    return projectionRefusal('TOOL_BINDING_UNVERIFIED', 'projection-rule-malformed', `projection refused: rule ${path}.resource (kind 'any') must carry no field other than 'kind' (blueprint grammar)`);
                }
                if (lane === 'deny' && isFileTool) {
                    // A whole-tool file deny would need a resource-scope catch-all the
                    // PR0 closed family does not have. Dropping it would LOOSEN the
                    // deny — the one direction a projection may never take. Refuse.
                    // Alpha.5 M2 (root 20:05): this law is TRULY-FILE only (the old
                    // condition was "not shell", which swept the invocation-only
                    // pair in). An invocation-only whole-tool deny projects
                    // EXACTLY — its authority is the `tool-invoke` arm alone, the
                    // same arm the allow/ask lanes project, with the shared R-1a
                    // deny sources; nothing is dropped, nothing is weakened.
                    return projectionRefusal('IO_POLICY_UNSUPPORTED', 'projection-deny-unprojectable', `projection refused: a deny-lane whole-tool ('any') rule for the file-class tool '${permissionTool}' cannot be projected — the PR0 document family has no resource catch-all matcher, and a partial projection would silently weaken the deny (assembly refuses; move the rule to exact/subtree resources)`);
                }
                if (lane === 'allow' && isShell) {
                    if (input.role !== 'leader') {
                        return projectionRefusal('TOOL_BINDING_UNVERIFIED', 'projection-shell-allow-non-leader', `projection refused: rule ${path} is a shell-class ALLOW — the member grammar rejects it (A2C-1: no parameter-level allow for shell commands); a policy that reached here is not the policy this role owns`);
                    }
                    if (input.leaderExecTokenPresent === undefined) {
                        notes.push(`rule ${path} (${permissionTool} whole-tool allow): exec dual-gate reader not wired — projected as ASK, never as allow`);
                        entries.push({ ceiling: 'ask', effectKinds: Object.freeze(['tool-invoke']), matcher: invokeMatcher });
                    }
                    else {
                        entries.push({ ceiling: 'leader-exec-gate', effectKinds: Object.freeze(['tool-invoke']), matcher: invokeMatcher });
                    }
                    continue;
                }
                entries.push({ ceiling: lane, effectKinds: Object.freeze(['tool-invoke']), matcher: invokeMatcher });
                if (lane === 'deny')
                    denySources.push({ effectKind: 'tool-invoke', matcher: invokeMatcher, ruleIndex: index });
                // The tightening disclosure is a FILE-class fact (resource-scoped
                // effects fall to no-authority ⇒ Ask). The invocation-only class
                // HAS no resource-scoped effect to fall: the projected
                // `tool-invoke` arm IS the declared authority — nothing is
                // tighter than declared, so no note is due (root 20:05: reuse the
                // original algebra/denySources, add no new default-allow).
                if (!isShell && !isInvocationOnly)
                    notes.push(`rule ${path} (${permissionTool} whole-tool allow over ALL resources): only the tool-invoke arm projects — resource-scoped effects fall to no-authority ⇒ Ask (TIGHTER than declared, disclosed never silent)`);
                continue;
            }
            // exact | subtree — the file dimension. The shell class rejects these
            // at the blueprint grammar (A2C-1); re-verified here, fail closed.
            if (isShell) {
                return projectionRefusal('TOOL_BINDING_UNVERIFIED', 'projection-rule-malformed', `projection refused: rule ${path} gives the shell tool '${permissionTool}' a '${kind}' resource — the shell class keeps only the whole-tool 'any' resource (A2C-1)`);
            }
            // The invocation-only class likewise keeps only the whole-tool 'any'
            // resource (Alpha.5 M2, root 20:05): it carries no matchable resource
            // space at all, so an exact/subtree rule cannot be projected even
            // partially — re-verified here after the blueprint grammar, fail
            // closed, in every lane of every role.
            if (isInvocationOnly) {
                return projectionRefusal('TOOL_BINDING_UNVERIFIED', 'projection-rule-malformed', `projection refused: rule ${path} gives the invocation-only tool '${permissionTool}' a '${kind}' resource — the class carries no matchable resource space (no file matcher, no fingerprint exists for it), so the whole-tool 'any' rule is its only projectable shape`);
            }
            const declaredPath = resource['path'];
            const controlChar = typeof declaredPath === 'string' && [...declaredPath].some((ch) => (ch.codePointAt(0) ?? 0x20) < 0x20);
            if (typeof declaredPath !== 'string' || declaredPath.trim().length === 0 || declaredPath.trim().length > PERMISSION_PATH_MAX_LENGTH || controlChar) {
                return projectionRefusal('TOOL_BINDING_UNVERIFIED', 'projection-rule-malformed', `projection refused: rule ${path}.resource.path must be a non-empty printable string of at most ${String(PERMISSION_PATH_MAX_LENGTH)} characters`);
            }
            const trimmed = declaredPath.trim();
            const canonical = input.canonicalizeResource !== undefined
                ? input.canonicalizeResource(trimmed)
                : trimmed.startsWith('/') ? trimmed : null;
            if (typeof canonical !== 'string' || canonical.length === 0) {
                if (lane === 'allow') {
                    notes.push(`rule ${path} (${permissionTool}@${trimmed}): resource uncanonicalizable — allow SKIPPED (no-authority ⇒ Ask; an unlocatable path is never an invented allow)`);
                    continue;
                }
                return projectionRefusal('TOOL_BINDING_UNVERIFIED', 'projection-rule-uncanonicalizable', `projection refused: rule ${path} (${permissionTool}@${trimmed}) is an ${lane} rule whose resource cannot be canonicalized — dropping it would LOOSEN authority (a deny/ask that cannot locate is a broken authority, not an absent one; the assembly refuses)`);
            }
            if (kind === 'subtree')
                hasSubtree = true;
            const matcher = { kind: kind === 'subtree' ? 'subtree' : 'exact', resource: `${input.realmId}|${canonical}` };
            entries.push({ ceiling: lane, effectKinds: Object.freeze(['tool-invoke']), matcher: invokeMatcher });
            if (lane === 'deny')
                denySources.push({ effectKind: 'tool-invoke', matcher: invokeMatcher, ruleIndex: index });
            const effectKinds = RESOURCE_EFFECT_KINDS[permissionTool];
            if (effectKinds === undefined) {
                // Only the file-class tools can carry exact/subtree resources and the
                // only such tool without a PR0 resource-effect mapping is `lsp`.
                if (lane === 'deny') {
                    return projectionRefusal('IO_POLICY_UNSUPPORTED', 'projection-deny-unprojectable', `projection refused: rule ${path} denies '${permissionTool}@${trimmed}' — '${permissionTool}' has no PR0 resource-effect mapping, so a resource-scoped deny cannot be projected without weakening it`);
                }
                notes.push(`rule ${path} (${permissionTool}@${trimmed}): '${permissionTool}' has no PR0 resource-effect mapping — the tool-invoke arm projects, resource effects fall to the lane default (disclosed)`);
            }
            else {
                for (const effectKind of effectKinds) {
                    entries.push({ ceiling: lane, effectKinds: Object.freeze([effectKind]), matcher });
                    if (lane === 'deny')
                        denySources.push({ effectKind, matcher, ruleIndex: index });
                }
            }
        }
    }
    if (hasSubtree && input.subtreeContains === undefined) {
        return projectionRefusal('TOOL_BINDING_UNVERIFIED', 'projection-subtree-seam-missing', 'projection refused: the policy carries a subtree rule but no SubtreeContains seam was injected — subtree coverage is unanswerable without the planes containment law and is never guessed (same law as the C-FS wiring face)');
    }
    const buildDocument = () => {
        const rules = [];
        for (const entry of entries) {
            const ceiling = entry.ceiling === 'leader-exec-gate'
                ? (input.leaderExecTokenPresent !== undefined && input.leaderExecTokenPresent() ? 'allow' : 'ask')
                : entry.ceiling;
            for (const effectKind of entry.effectKinds) {
                rules.push({ realmId: input.realmId, effectKind, matcher: entry.matcher, maximumEffect: ceiling });
            }
        }
        const parsed = parseToolPolicyDocument({ rules });
        if (!parsed.ok) {
            // Construction validated the same shape; a failure here is a bug state,
            // never a silent fallback.
            throw new Error(`team-admission projection: the derived document failed the frozen parser (${parsed.problems.map((p) => `${p.path}: ${p.code}`).join('; ')})`);
        }
        return parsed.value;
    };
    try {
        buildDocument();
    }
    catch (error) {
        return projectionRefusal('TOOL_BINDING_UNVERIFIED', 'projection-document-rejected', `projection refused: ${String(error.message)}`);
    }
    return {
        ok: true,
        value: Object.freeze({
            templateDefault,
            buildDocument,
            denySources: () => denySources.map((arm) => Object.freeze({
                realmId: input.realmId,
                effectKind: arm.effectKind,
                matcher: arm.matcher,
                ownerAuthority: input.definitionOwnerAuthority,
                sourceRef: `${input.templateId}#deny[${String(arm.ruleIndex)}]`,
                sourceVersion: input.sourceVersion(),
            })),
            notes: Object.freeze([...notes]),
            coversEffect: (effect) => {
                const scoped = effect.kind === 'tool-invoke'
                    ? { kind: 'tool-invoke', resource: `${input.realmId}|tool:${effect.toolName}` }
                    : effect.kind === 'domain-ref'
                        ? { kind: 'domain-ref', resource: `${input.realmId}|domain:${effect.domainAuthorityId}` }
                        : { kind: effect.kind, resource: `${effect.resource.realmId}|${effect.resource.canonicalLocator}` };
                return entries.some((entry) => entry.effectKinds.includes(scoped.kind) && matcherCovers(entry.matcher, scoped.resource, input.subtreeContains));
            },
        }),
    };
}
/** The documented documents default: BOTH slots stated (never `undefined`),
 *  the hard envelope exists and narrows nothing, no mutation envelope —
 *  exactly the fact an unmoved Alpha.4 team carries. Hosts with real ceiling
 *  documents MUST inject `documents`. */
const EMPTY_NARROWING_DOCS = Object.freeze({
    teamHardEnvelope: Object.freeze({ rules: [] }),
    permissionMutationEnvelope: Object.freeze({ status: 'absent' }),
});
/**
 * THE KERNEL ADMISSION PRODUCTION ENTRY CLASS: derivation → kernel wiring →
 * default-deny gate → FS port, from the template's real policy object. A
 * construction failure is typed and complete (the host fails the AgentSetup
 * the same way a Guard install failure fails it — a permissions agent never
 * runs on a broken authority).
 */
export function createProductionAdmissionAssembly(config) {
    if (typeof config.clock !== 'function' || typeof config.authorityGeneration !== 'function') {
        return projectionRefusal('TOOL_BINDING_UNVERIFIED', 'assembly-input-malformed', 'assembly refused: clock and authorityGeneration are required trusted readers (the lane owns no clock, no generation)');
    }
    const projection = deriveTeamPolicyAuthority({
        permissionPolicy: config.permissionPolicy,
        realmId: config.realmId,
        templateId: config.templateId,
        definitionOwnerAuthority: config.definitionOwnerAuthority,
        role: config.role,
        ...(config.canonicalizeResource === undefined ? {} : { canonicalizeResource: config.canonicalizeResource }),
        ...(config.subtreeContains === undefined ? {} : { subtreeContains: config.subtreeContains }),
        ...(config.leaderExecTokenPresent === undefined ? {} : { leaderExecTokenPresent: config.leaderExecTokenPresent }),
        sourceVersion: config.authorityGeneration,
    });
    if (!projection.ok)
        return projection;
    const observe = config.onObserve ?? (() => { });
    const ledger = config.ledger ?? createGrantLedger();
    const kernel = createAdmissionKernel({
        clock: config.clock,
        authorityGeneration: config.authorityGeneration,
        documents: config.documents ?? (() => EMPTY_NARROWING_DOCS),
        policyDocument: projection.value.buildDocument,
        denySources: projection.value.denySources,
        beneficiaryAuthority: config.beneficiaryAuthority,
        assuranceProbe: config.assuranceProbe ?? createStubAssuranceProbe({}),
        requiredAssurance: config.requiredAssurance ?? (() => ({})),
        ledger,
        ...(config.subtreeContains === undefined ? {} : { subtreeContains: config.subtreeContains }),
        ...(config.grantExpiry === undefined ? {} : { grantExpiry: config.grantExpiry }),
        ...(config.onObserve === undefined ? {} : { onObserve: config.onObserve }),
    });
    for (const note of projection.value.notes)
        observe({ event: 'production-admission-note', note });
    observe({ event: 'production-admission-constructed', realmId: config.realmId, templateId: config.templateId, templateDefault: projection.value.templateDefault, notes: projection.value.notes.length });
    const admitCall = async (request) => {
        if (projection.value.templateDefault === 'deny') {
            const effects = request.requestedEffects.effects;
            for (let index = 0; index < effects.length; index += 1) {
                const effect = effects[index];
                if (effect !== undefined && !projection.value.coversEffect(effect)) {
                    observe({ event: 'production-admission-default-deny', effectIndex: index, effectKind: effect.kind });
                    return {
                        ok: true,
                        value: {
                            kind: 'denied',
                            error: {
                                code: 'IO_POLICY_UNSUPPORTED',
                                message: `admission refused: the template policy defaults to DENY and no rule covers this effect (${effect.kind}) — an effect the policy never names is not an effect the policy allows (the Ask lane belongs to named rules)`,
                                details: { refusal: 'template-default-deny', effectIndex: index },
                            },
                        },
                    };
                }
            }
        }
        return kernel.admit(request);
    };
    return {
        ok: true,
        value: Object.freeze({
            kernel,
            realmId: config.realmId,
            policyDocument: projection.value.buildDocument,
            denySources: projection.value.denySources,
            projectionNotes: projection.value.notes,
            consumed: (grantId) => ledger.view.isConsumed(grantId),
            admitCall,
            planApproval: kernel.planApproval,
            issueApprovedGrant: kernel.issueApprovedGrant,
            consumeForExecution: kernel.consumeForExecution,
            createFsAdmissionPort: (request, grant) => Object.freeze({
                recheckCall: async (intent) => {
                    if (ledger.view.isConsumed(grant.grantId))
                        return { ok: false, reason: 'grant-consumed' };
                    const outcome = kernel.consumeForExecution(grant, {
                        currentAuthorityGeneration: config.authorityGeneration(),
                        member: request.member,
                        callId: request.callId,
                        realmId: request.realmId,
                        bindingId: grant.bindingId,
                        bindingRevision: grant.bindingRevision,
                        parametersFingerprint: intent.parametersFingerprint,
                        requestedEffects: request.requestedEffects,
                        cancelRequested: config.cancelRequested?.(request.callId) ?? false,
                    });
                    return outcome.ok ? { ok: true } : { ok: false, reason: 'grant-invalid' };
                },
            }),
        }),
    };
}
//# sourceMappingURL=admission-kernel.js.map