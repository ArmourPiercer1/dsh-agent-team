/**
 * dispatch-settlement.ts — the S1 DISPATCH wrapper: a tool definition that
 * settles the physical execution it is about to enter.
 *
 * WHAT THIS IS. `docs/plans/memo/ute-g1-20261120/CONTRACT.md` §3.2 fixes one
 * ordering rule: a durable admission is written and VERIFIED before the tool
 * body may run (step 2 gates step 3). UTE-2 built the store and the fact-shaped
 * `ExecutionSettlementWriter` adapter; neither was driven by a real execution
 * chain. This module is that driver, at the earliest seam that owns both a
 * trusted call identity and the body call itself:
 *
 *   definition.execute(args, exec)          <-- the seam (exec.callId is the
 *                                               host's call identity)
 *     recordAdmission(...)   DURABLE, fsynced + parent-dir fsynced
 *     enterRunning(...)      dispatch entered (observed, not decided)
 *     definition.execute(...)  the REAL body — first possible effect
 *     terminal fact          COMPLETED / FAILED / UNKNOWN, or REFUSED (deny)
 *
 * WHY THIS SEAM AND NOT A LATER ONE. The Team-owned `tools/guard`,
 * `tools/pre-execute`, `tools/post-execute` and `tools/execute` arms
 * (`packages/runtime/tool-dispatch/install.ts`) are decision/observation
 * seams: `tools/execute` resolves after the Body is ENTERED, so an admission
 * written there is already too late, and `tools/post-execute` fires after the
 * result exists. Wrapping the definition's `execute` is the earliest point at
 * which the code that is about to produce an effect is still in front of us,
 * with the host's `callId` in hand. The existing precedent for wrapping a real
 * definition at exactly this point is `native-bash-tool.mjs`
 * (`registerWithAdmission`: admit -> `definition.execute` -> settle).
 *
 * WHAT IT IS NOT.
 *   - It is NOT mounted or registered anywhere. Nothing imports this module on
 *     a production path (see the suite's `UTE3-NOT-WIRED` arm); it is
 *     constructed only by a caller that passes an `ExecutionSettlementStore`.
 *   - It is NOT an authorization surface. It records the admission reference
 *     the caller's guard already produced; it never mints, allows, denies,
 *     consumes or revokes an approval. A `deny` reference is recorded as
 *     REFUSED and the body is never entered.
 *   - It does NOT change the tool result. The exact value the inner body
 *     returned is returned by reference; a thrown error is rethrown by
 *     identity. Settlement is observation, never a result transform.
 *
 * WHY IT DRIVES THE STORE'S TRANSITION SURFACE. The frozen four-method adapter
 * (`writer-adapter.ts`) is deliberately fact-shaped and cannot express two
 * things this ordering rule needs: (a) an OPEN `RUNNING` record (its `record()`
 * turns every dispatched fact into a terminal state) and (b) an `allow`/`deny`
 * admission verdict (it only writes reference-only admissions). The dispatch
 * ladder therefore calls `recordAdmission` / `enterRunning` / `settle`
 * directly, and attaches a `ContractExecutionFact` to every transition, so the
 * frozen reader surface (`read`, `listUnsettled`, `projectControlResult`) keeps
 * answering correctly. This is the settlement module composing its own state
 * machine — not a second public writer and not a second authority. If review
 * wants that ladder behind the frozen interface, §3.1 needs a fifth method; it
 * is stated here rather than papered over.
 *
 * S1 / S2 BOUNDARY (stated, never faked).
 *   S1 (PROVEN HERE): for a wrapped definition, a durable admission exists
 *   before the body may run; after a hard death the record is recoverable and
 *   becomes UNKNOWN with named missing evidence; no path can turn it into
 *   COMPLETED.
 *   S2 (NOT CLAIMED): "the durable commit is complete before the model sees
 *   `tool/result`". The wrapper awaits its terminal write before `execute`
 *   returns, but `execute` is not the model-visible result path: post-execute
 *   projections/rendering happen after it, and a host may emit result traffic
 *   while the body streams. Proving S2 needs an awaitable public seam before
 *   `tool/result`; none is known, so the honest output remains
 *   `CORE_SEAM_BLOCKER`, not a listener dressed up as an ordering proof.
 *
 * @module @dsh-agent-team/runtime/settlement
 */
import { createHash } from 'node:crypto';
/** The typed refusal a wrapper call raises before/after the body. */
export class DispatchSettlementRefusal extends Error {
    code;
    details;
    constructor(code, detail, details = {}) {
        super(`dispatch-settlement: ${code} — ${detail}`);
        this.name = 'DispatchSettlementRefusal';
        this.code = code;
        this.details = Object.freeze({ ...details });
    }
}
const TERMINAL_STATES = Object.freeze([
    'COMPLETED',
    'REFUSED',
    'FAILED',
    'CANCELLED',
    'UNKNOWN',
]);
const EFFECT_KINDS = Object.freeze([
    'file-create',
    'file-delete',
    'file-content',
    'file-metadata',
    'process-spawn',
    'process-exit',
    'network-connect',
    'binding-declared',
]);
const ISO_TIMESTAMP_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;
const SHA256_HEX_RE = /^[0-9a-f]{64}$/;
function isPlainObject(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function canonicalJson(value) {
    if (value === undefined)
        return 'null';
    if (value === null || typeof value !== 'object')
        return JSON.stringify(value);
    if (Array.isArray(value))
        return `[${value.map(canonicalJson).join(',')}]`;
    const record = value;
    const keys = Object.keys(record).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canonicalJson(record[key])}`).join(',')}}`;
}
function sha256Hex(text) {
    return createHash('sha256').update(text, 'utf8').digest('hex');
}
function digestOf(value) {
    return sha256Hex(canonicalJson(value));
}
function refuse(code, detail, details = {}) {
    throw new DispatchSettlementRefusal(code, detail, details);
}
function requireText(value, field, max = 512) {
    if (typeof value !== 'string' || value.length === 0) {
        refuse('A5_SETTLEMENT_INPUT_INVALID', `${field} must be a non-empty string`, { field });
    }
    if (value.length > max) {
        refuse('A5_SETTLEMENT_INPUT_INVALID', `${field} is longer than ${max} characters`, { field });
    }
    return value;
}
/** The refusal code a store refusal carries (the store is the only one that may refuse a write). */
function storeRefusalCode(error) {
    if (typeof error !== 'object' || error === null)
        return null;
    const code = error.code;
    return typeof code === 'string' ? code : null;
}
/**
 * Resolve and validate the trusted identity of THIS physical attempt. Throws
 * (fail closed) before any write if the host did not supply a call id or the
 * provenance resolver did not answer a root/agent.
 */
function invocationFor(args, exec, options) {
    if (!isPlainObject(exec)) {
        refuse('A5_SETTLEMENT_CALL_ID_MISSING', 'the host execution context is not an object');
    }
    const rawCallId = exec.callId;
    const hostCallId = requireText(rawCallId, 'exec.callId', 512);
    const rawProvenance = typeof options.provenance === 'function'
        ? options.provenance(args, exec)
        : options.provenance;
    if (!isPlainObject(rawProvenance)) {
        refuse('A5_SETTLEMENT_PROVENANCE_MISSING', 'the provenance resolver did not return an object');
    }
    const rootSessionId = requireText(rawProvenance.rootSessionId, 'provenance.rootSessionId');
    const agentInstanceId = requireText(rawProvenance.agentInstanceId, 'provenance.agentInstanceId');
    const toolName = requireText(rawProvenance.toolName, 'provenance.toolName');
    const rawRequestIds = typeof options.controlRequestIds === 'function'
        ? options.controlRequestIds(exec)
        : options.controlRequestIds;
    const controlRequestIds = [];
    if (rawRequestIds !== undefined) {
        if (!Array.isArray(rawRequestIds)) {
            refuse('A5_SETTLEMENT_INPUT_INVALID', 'controlRequestIds must be an array of request ids');
        }
        for (let index = 0; index < rawRequestIds.length; index += 1) {
            controlRequestIds.push(requireText(rawRequestIds[index], `controlRequestIds[${index}]`));
        }
    }
    const decisionInput = options.admission?.(exec);
    let decision = null;
    let admission;
    if (decisionInput !== undefined) {
        if (!isPlainObject(decisionInput)) {
            refuse('A5_SETTLEMENT_INPUT_INVALID', 'the admission resolver must return an object');
        }
        if (decisionInput.decision !== 'allow' && decisionInput.decision !== 'deny') {
            refuse('A5_SETTLEMENT_INPUT_INVALID', "the admission decision must be 'allow' or 'deny'");
        }
        decision = decisionInput.decision;
        const decisionId = requireText(decisionInput.decisionId, 'admission.decisionId');
        const decisionDigest = requireText(decisionInput.decisionDigest, 'admission.decisionDigest', 64);
        if (!SHA256_HEX_RE.test(decisionDigest)) {
            refuse('A5_SETTLEMENT_INPUT_INVALID', 'admission.decisionDigest must be the 64-hex sha256 of the guard decision it references');
        }
        const decisionKind = requireText(decisionInput.decisionKind, 'admission.decisionKind');
        const decidedAt = decisionInput.decidedAt === undefined
            ? undefined
            : requireText(decisionInput.decidedAt, 'admission.decidedAt');
        if (decidedAt !== undefined && !ISO_TIMESTAMP_RE.test(decidedAt)) {
            refuse('A5_SETTLEMENT_INPUT_INVALID', 'admission.decidedAt must be ISO-8601 UTC');
        }
        admission = Object.freeze({
            admissionKind: 'control-decision',
            decisionId,
            decisionDigest,
            decision,
            decisionKind,
            subjectExecutionId: '',
            ...(decidedAt === undefined ? {} : { decidedAt }),
        });
    }
    else if (controlRequestIds.length > 0) {
        admission = Object.freeze({
            admissionKind: 'control-request-reference',
            decisionId: controlRequestIds[0],
            decisionDigest: '',
            decisionKind: 'control-request-reference',
            subjectExecutionId: '',
            requestIds: Object.freeze([...controlRequestIds]),
        });
    }
    else {
        admission = Object.freeze({
            admissionKind: 'no-control-request',
            decisionId: 'no-control-request',
            decisionDigest: '',
            decisionKind: 'no-control-request',
            subjectExecutionId: '',
        });
    }
    // The ExecutionId is minted from TRUSTED provenance, never from an argument
    // the model controls, and never from a bare callId (which can collide across
    // sessions). Same physical attempt -> same id -> the store refuses a replay.
    const executionId = `exec-${sha256Hex(canonicalJson({ rootSessionId, agentInstanceId, hostCallId })).slice(0, 40)}`;
    const admissionDigest = admission.admissionKind === 'control-decision'
        ? admission.decisionDigest
        : admission.admissionKind === 'control-request-reference'
            ? digestOf({
                kind: 'control-request-reference',
                subjectExecutionId: executionId,
                requestIds: controlRequestIds,
            })
            : digestOf({ kind: 'no-control-request', subjectExecutionId: executionId });
    const frozenAdmission = Object.freeze({
        ...admission,
        subjectExecutionId: executionId,
        decisionDigest: admissionDigest,
    });
    return Object.freeze({
        identity: Object.freeze({
            executionId,
            toolName,
            actorId: agentInstanceId,
            worldId: rootSessionId,
        }),
        admission: frozenAdmission,
        admissionDigest,
        executionId,
        hostCallId,
        rootSessionId,
        agentInstanceId,
        controlRequestIds: Object.freeze([...controlRequestIds]),
        decision,
        toolName,
    });
}
/** Build the contract fact for one transition of this attempt. */
function contractFactOf(invocation, at, fields) {
    return Object.freeze({
        executionId: invocation.executionId,
        rootSessionId: invocation.rootSessionId,
        agentInstanceId: invocation.agentInstanceId,
        hostCallId: invocation.hostCallId,
        controlRequestIds: invocation.controlRequestIds,
        dispatch: fields.dispatch,
        bodyOutcome: fields.bodyOutcome,
        effectEvidence: fields.effectEvidence,
        ...(fields.hostResult === undefined ? {} : { hostResult: fields.hostResult }),
        recordedAt: at,
    });
}
/** The reserved, not-started observation every admission carries. */
function admittedObservation(executionId) {
    return Object.freeze({
        executionId,
        dispatch: 'not-started',
        bodyOutcome: 'not-started',
        effectEvidence: 'none-confirmed',
        observedEffects: Object.freeze([]),
    });
}
/**
 * Validate an observer's claim. `observed` MUST carry at least one effect with a
 * real evidence id; nothing is ever synthesised. `possible`/`unknown` cannot be
 * carried by a COMPLETED body (the store refuses it), so a completed body
 * downgrades to the honest floor `none-confirmed` and the claim is reported.
 */
function normaliseObservation(raw, bodyOutcome) {
    const fallback = bodyOutcome === 'completed' ? 'none-confirmed' : 'unknown';
    if (raw === undefined || raw === null) {
        return { effectEvidence: fallback, observedEffects: [], refusedClaim: null };
    }
    if (!isPlainObject(raw)) {
        return {
            effectEvidence: fallback,
            observedEffects: [],
            refusedClaim: {
                code: 'A5_SETTLEMENT_OBSERVATION_REFUSED',
                detail: 'the observer returned a non-object observation',
            },
        };
    }
    const grade = raw.effectEvidence;
    const list = raw.observedEffects;
    if (grade !== undefined && grade !== 'observed' && grade !== 'none-confirmed' && grade !== 'possible' && grade !== 'unknown') {
        return {
            effectEvidence: fallback,
            observedEffects: [],
            refusedClaim: {
                code: 'A5_SETTLEMENT_OBSERVATION_REFUSED',
                detail: `effectEvidence '${String(grade)}' is not a contract evidence grade`,
            },
        };
    }
    if (grade === 'observed') {
        if (!Array.isArray(list) || list.length === 0) {
            return {
                effectEvidence: fallback,
                observedEffects: [],
                refusedClaim: {
                    code: 'EFFECT_CLAIM_WITHOUT_OBSERVATION',
                    detail: "effectEvidence 'observed' was claimed with no observed effect",
                },
            };
        }
        const effects = [];
        for (let index = 0; index < list.length; index += 1) {
            const effect = list[index];
            if (!isPlainObject(effect)) {
                return {
                    effectEvidence: fallback,
                    observedEffects: [],
                    refusedClaim: {
                        code: 'A5_SETTLEMENT_OBSERVATION_REFUSED',
                        detail: `observedEffects[${index}] is not an object`,
                    },
                };
            }
            if (typeof effect.kind !== 'string' || !EFFECT_KINDS.includes(effect.kind)) {
                return {
                    effectEvidence: fallback,
                    observedEffects: [],
                    refusedClaim: {
                        code: 'A5_SETTLEMENT_OBSERVATION_REFUSED',
                        detail: `observedEffects[${index}].kind '${String(effect.kind)}' is not a known effect kind`,
                    },
                };
            }
            if (typeof effect.target !== 'string' || effect.target.length === 0) {
                return {
                    effectEvidence: fallback,
                    observedEffects: [],
                    refusedClaim: {
                        code: 'A5_SETTLEMENT_OBSERVATION_REFUSED',
                        detail: `observedEffects[${index}].target is empty`,
                    },
                };
            }
            if (typeof effect.evidenceId !== 'string' || effect.evidenceId.length === 0) {
                return {
                    effectEvidence: fallback,
                    observedEffects: [],
                    refusedClaim: {
                        code: 'A5_SETTLEMENT_OBSERVATION_REFUSED',
                        detail: `observedEffects[${index}].evidenceId is empty — an effect without a witness id is not observed`,
                    },
                };
            }
            effects.push(Object.freeze({
                kind: effect.kind,
                target: effect.target,
                evidenceId: effect.evidenceId,
            }));
        }
        return { effectEvidence: 'observed', observedEffects: Object.freeze(effects), refusedClaim: null };
    }
    if (Array.isArray(list) && list.length > 0) {
        return {
            effectEvidence: fallback,
            observedEffects: [],
            refusedClaim: {
                code: 'EFFECT_CLAIM_WITHOUT_OBSERVATION',
                detail: `an observation list of ${list.length} effect(s) was reported as '${String(grade)}', not 'observed'`,
            },
        };
    }
    if (bodyOutcome === 'completed' && (grade === 'possible' || grade === 'unknown')) {
        return {
            effectEvidence: 'none-confirmed',
            observedEffects: [],
            refusedClaim: {
                code: 'A5_SETTLEMENT_OBSERVATION_REFUSED',
                detail: `a COMPLETED body cannot carry effectEvidence '${grade}' — recorded as none-confirmed`,
            },
        };
    }
    return {
        effectEvidence: (grade ?? fallback),
        observedEffects: [],
        refusedClaim: null,
    };
}
function errorCodeOf(error) {
    if (isPlainObject(error) || typeof error === 'object') {
        const code = error.code;
        if (typeof code === 'string' && code.length > 0)
            return code;
        const errName = error.name;
        if (typeof errName === 'string' && errName.length > 0)
            return errName;
    }
    return 'Error';
}
/**
 * Turn ONE tool definition into a settlement-observing definition.
 *
 * The returned definition carries every other field of the input by reference
 * (name, description, parameter schema, render, …); only `execute` is wrapped.
 * The wrapper is inert unless a caller constructs it with a store — no
 * production path imports this module.
 */
export function createSettlementObservingDefinition(definition, options) {
    if (!isPlainObject(definition) || typeof definition.execute !== 'function') {
        refuse('A5_SETTLEMENT_INPUT_INVALID', 'createSettlementObservingDefinition needs a definition carrying execute()');
    }
    if (!isPlainObject(options)) {
        refuse('A5_SETTLEMENT_INPUT_INVALID', 'createSettlementObservingDefinition needs an options object');
    }
    const store = options.store;
    if (store === undefined ||
        store === null ||
        typeof store.recordAdmission !== 'function' ||
        typeof store.enterRunning !== 'function' ||
        typeof store.settle !== 'function' ||
        typeof store.read !== 'function') {
        refuse('A5_SETTLEMENT_INPUT_INVALID', 'options.store must be a live ExecutionSettlementStore');
    }
    const clock = options.clock ?? (() => new Date().toISOString());
    if (typeof clock !== 'function') {
        refuse('A5_SETTLEMENT_INPUT_INVALID', 'options.clock must be a function returning an ISO-8601 timestamp');
    }
    // THE SINGLE-WRITER BINDING: the store is captured here, once. No call may
    // reach a different store, so one execution can never be split across roots
    // by mutating the options object afterwards.
    const bound = Object.freeze({ store, clock });
    function now() {
        const at = bound.clock();
        if (typeof at !== 'string' || !ISO_TIMESTAMP_RE.test(at)) {
            refuse('A5_SETTLEMENT_INPUT_INVALID', 'the clock must return an ISO-8601 UTC timestamp ending in Z');
        }
        return at;
    }
    function report(error, context) {
        if (typeof options.onSettlementError !== 'function')
            return;
        try {
            options.onSettlementError(error, Object.freeze({ ...context }));
        }
        catch {
            // An observer fault must never change the tool result or mask the body.
        }
    }
    /** Step 2 of §3.2: the admission is durable before anything else may proceed. */
    function writeAdmission(invocation) {
        const at = now();
        try {
            bound.store.recordAdmission({
                identity: invocation.identity,
                admission: invocation.admission,
                at,
                reason: invocation.decision === 'deny'
                    ? 'dispatch-admission-denied'
                    : invocation.decision === 'allow'
                        ? 'dispatch-admission-allow'
                        : 'dispatch-admission-reference',
                contractFact: contractFactOf(invocation, at, {
                    dispatch: 'not-started',
                    bodyOutcome: 'unknown',
                    effectEvidence: 'none-confirmed',
                }),
            });
        }
        catch (error) {
            const code = storeRefusalCode(error);
            report(error, { phase: 'admission', executionId: invocation.executionId, toolName: invocation.toolName });
            refuse(code ?? 'A5_SETTLEMENT_ADMISSION_NOT_DURABLE', 'the durable admission could not be written, so the body was NOT entered (fail closed)', { executionId: invocation.executionId, cause: error instanceof Error ? error.message : String(error) });
        }
    }
    /** Step 3 of §3.2: dispatch entered — an observation, never a decision. */
    function enterRunning(invocation) {
        const at = now();
        try {
            bound.store.enterRunning({
                executionId: invocation.executionId,
                observation: Object.freeze({
                    executionId: invocation.executionId,
                    dispatch: 'started',
                    bodyOutcome: 'unknown',
                    effectEvidence: 'possible',
                    observedEffects: Object.freeze([]),
                }),
                at,
                contractFact: contractFactOf(invocation, at, {
                    dispatch: 'started',
                    bodyOutcome: 'unknown',
                    effectEvidence: 'possible',
                }),
            });
        }
        catch (error) {
            const code = storeRefusalCode(error);
            report(error, { phase: 'running', executionId: invocation.executionId, toolName: invocation.toolName });
            refuse(code ?? 'A5_SETTLEMENT_DISPATCH_NOT_ENTERED', 'dispatch could not be entered, so the body was NOT called', {
                executionId: invocation.executionId,
                cause: error instanceof Error ? error.message : String(error),
            });
        }
    }
    /** Write a terminal fact, and NEVER leave the record RUNNING silently. */
    function settleTerminal(invocation, write) {
        try {
            bound.store.settle({
                executionId: invocation.executionId,
                state: write.state,
                observation: write.observation,
                at: now(),
                reason: write.reason,
                ...(write.missingEvidence === undefined ? {} : { missingEvidence: write.missingEvidence }),
                contractFact: write.contractFact,
            });
            return;
        }
        catch (error) {
            report(error, { phase: 'terminal', executionId: invocation.executionId, toolName: invocation.toolName });
        }
        // The truthful terminal fact could not be written. The ONE remaining honest
        // answer is UNKNOWN — not a fabricated success and not a silent RUNNING.
        const at = now();
        try {
            bound.store.settle({
                executionId: invocation.executionId,
                state: 'UNKNOWN',
                observation: Object.freeze({
                    executionId: invocation.executionId,
                    dispatch: 'termination-unconfirmed',
                    bodyOutcome: 'unknown',
                    effectEvidence: 'unknown',
                    observedEffects: Object.freeze([]),
                }),
                at,
                reason: 'terminal-write-refused',
                missingEvidence: Object.freeze(['terminal-observation', 'host-result', 'effect-evidence']),
                contractFact: contractFactOf(invocation, at, {
                    dispatch: 'termination-unconfirmed',
                    bodyOutcome: 'unknown',
                    effectEvidence: 'unknown',
                }),
            });
        }
        catch (error) {
            // Nothing else can be written. This is reported (never silent); the tool
            // result is still returned unchanged.
            report(error, { phase: 'fallback', executionId: invocation.executionId, toolName: invocation.toolName });
        }
    }
    const execute = async (args, exec) => {
        const invocation = invocationFor(args, exec, options);
        // ONE CANONICAL FACT: a terminal (or in-flight) record is never re-driven.
        // This is also the replay arm of the SIGKILL recovery proof: a recovered
        // UNKNOWN can never become a PASS by calling the tool again.
        const existing = bound.store.read(invocation.executionId);
        if (existing !== null && existing.state !== 'ADMITTED') {
            const terminal = TERMINAL_STATES.includes(existing.state);
            refuse(terminal ? 'A5_SETTLEMENT_REPLAY_REFUSED' : 'A5_SETTLEMENT_IN_FLIGHT', terminal
                ? 'this physical execution already has a terminal fact; a replay is not a second execution'
                : 'this physical execution is already RUNNING; this call is not a second attempt', { executionId: invocation.executionId, state: existing.state });
        }
        // ---- ORDERING ANCHOR (S1): durable intent BEFORE any body call ----------
        writeAdmission(invocation);
        if (invocation.decision === 'deny') {
            // The guard denied. The admission is durable; the body is never entered.
            const at = now();
            settleTerminal(invocation, {
                state: 'REFUSED',
                reason: 'admission-denied',
                observation: admittedObservation(invocation.executionId),
                contractFact: contractFactOf(invocation, at, {
                    dispatch: 'not-started',
                    bodyOutcome: 'failed',
                    effectEvidence: 'none-confirmed',
                }),
            });
            refuse('A5_SETTLEMENT_ADMISSION_DENIED', 'the referenced admission decision is deny; the body was not entered', {
                executionId: invocation.executionId,
                decisionId: invocation.admission.decisionId,
            });
        }
        enterRunning(invocation);
        let value;
        try {
            value = await definition.execute(args, exec);
        }
        catch (error) {
            const aborted = exec?.signal?.aborted === true;
            const bodyOutcome = aborted ? 'unknown' : 'failed';
            const normalised = normaliseObservation(options.observe?.({ args, exec, error }), bodyOutcome);
            if (normalised.refusedClaim !== null) {
                report(new DispatchSettlementRefusal(normalised.refusedClaim.code, normalised.refusedClaim.detail), {
                    phase: 'observation',
                    executionId: invocation.executionId,
                    toolName: invocation.toolName,
                });
            }
            const at = now();
            if (aborted) {
                settleTerminal(invocation, {
                    state: 'UNKNOWN',
                    reason: 'body-aborted-without-terminal-observation',
                    observation: Object.freeze({
                        executionId: invocation.executionId,
                        dispatch: 'termination-unconfirmed',
                        bodyOutcome: 'unknown',
                        effectEvidence: normalised.effectEvidence === 'none-confirmed' ? 'unknown' : normalised.effectEvidence,
                        observedEffects: normalised.observedEffects,
                    }),
                    missingEvidence: Object.freeze([
                        'terminal-observation',
                        'host-result',
                        ...(normalised.effectEvidence === 'observed' ? [] : ['effect-evidence']),
                    ]),
                    contractFact: contractFactOf(invocation, at, {
                        dispatch: 'termination-unconfirmed',
                        bodyOutcome: 'unknown',
                        effectEvidence: normalised.effectEvidence === 'none-confirmed' ? 'unknown' : normalised.effectEvidence,
                    }),
                });
            }
            else {
                settleTerminal(invocation, {
                    state: 'FAILED',
                    reason: 'body-threw',
                    observation: Object.freeze({
                        executionId: invocation.executionId,
                        dispatch: 'quiesced',
                        bodyOutcome: 'failed',
                        effectEvidence: normalised.effectEvidence,
                        observedEffects: normalised.observedEffects,
                    }),
                    contractFact: contractFactOf(invocation, at, {
                        dispatch: 'quiesced',
                        bodyOutcome: 'failed',
                        effectEvidence: normalised.effectEvidence,
                        hostResult: { isError: true, errorCode: errorCodeOf(error) },
                    }),
                });
            }
            // The result contract: the SAME error, unchanged.
            throw error;
        }
        const normalised = normaliseObservation(options.observe?.({ args, exec, value }), 'completed');
        if (normalised.refusedClaim !== null) {
            report(new DispatchSettlementRefusal(normalised.refusedClaim.code, normalised.refusedClaim.detail), {
                phase: 'observation',
                executionId: invocation.executionId,
                toolName: invocation.toolName,
            });
        }
        const at = now();
        settleTerminal(invocation, {
            state: 'COMPLETED',
            reason: 'body-returned',
            observation: Object.freeze({
                executionId: invocation.executionId,
                dispatch: 'quiesced',
                bodyOutcome: 'completed',
                effectEvidence: normalised.effectEvidence,
                observedEffects: normalised.observedEffects,
            }),
            contractFact: contractFactOf(invocation, at, {
                dispatch: 'quiesced',
                bodyOutcome: 'completed',
                effectEvidence: normalised.effectEvidence,
                hostResult: { isError: false },
            }),
        });
        // The model-facing value is the body's own value, by reference. Settlement
        // never adds a field, wraps the value or replaces it.
        return value;
    };
    return Object.freeze({ ...definition, execute });
}
/** The ExecutionId this wrapper would mint for a physical attempt (for tests/diagnostics). */
export function dispatchExecutionId(provenance, hostCallId) {
    const root = requireText(provenance.rootSessionId, 'provenance.rootSessionId');
    const agent = requireText(provenance.agentInstanceId, 'provenance.agentInstanceId');
    const call = requireText(hostCallId, 'hostCallId');
    return `exec-${sha256Hex(canonicalJson({ rootSessionId: root, agentInstanceId: agent, hostCallId: call })).slice(0, 40)}`;
}
/** The states a wrapper will not re-drive (exported so a caller can pre-check). */
export function isTerminalSettlementState(state) {
    return TERMINAL_STATES.includes(state);
}
/** Read-through helper: the record a wrapped call produced (for diagnostics/tests). */
export function readDispatchSettlement(store, executionId) {
    return store.read(executionId);
}
//# sourceMappingURL=dispatch-settlement.js.map