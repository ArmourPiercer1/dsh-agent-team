/**
 * `a5p5-tools` Phase 2 — the ONE pipeline both backend paths share:
 * derive effects (read-time, Phase 1) → admission verdict (injected) →
 * execute against a backend → settle the lease → spill attribution →
 * render (Phase 1). Because there is exactly ONE pipeline, backend choice can
 * NEVER change a judgement or a rendering — and `test/a5p5-parity.test.ts`
 * pins that claim over the fixture matrix, direct vs contract stub.
 *
 * ORDER LAWS pinned here:
 *  - schema refusal / policy deny happen BEFORE anything else runs: no sink
 *    is opened, the backend is not called (deny-before-backend, the same
 *    shape as the PR5 host law "deny-before-spawn");
 *  - the lease settles exactly once with the backend's settlement fact; a
 *    backend that produced no outcome settles `outcome-unreadable` (the
 *    honest "no fact" class), never a fake completion;
 *  - the spill sink is written ONLY by the executing body while the lease is
 *    ACTIVE; the pipeline records the terminal fact (finalize) and closes;
 *  - the presentation is drawn by the Phase 1 renderer alone — raw payload
 *    bytes reach the model surface only through it, the spill file being
 *    DATA behind a read-time authorization re-check.
 *
 * Purity: no `node:*`, no I/O, no clock (the backend does its own).
 *
 * @module @dsh-agent-team/tools/a5p5-tools/pipeline
 */
import { deepFreezeContracts } from '../../../domain/tool-governance/src/parse-util.js';
import { UNREADABLE_SETTLEMENT } from './backend-contract.js';
import { deriveToolEffectSet } from './effects-schema.js';
import { RenderClosedValueViolation, renderSearchResult, renderShellResult } from './render.js';
import { createSpillLease } from './spill.js';
/**
 * PD-41 / PD41-ABORT-CLASS (owner ruling 2026-11-11; audit follow-up) — the
 * execution-fact outcome of an ANSWERED backend call. `result.ok` is the
 * backend's "I answered" bit; it is NOT "the body completed".
 *
 * THE OBSERVATION THAT DECIDES is the SETTLEMENT the backend returned, not only
 * the outcome's two convenience flags. The settlement union
 * (`spill.ts` `LeaseSettlement`) has exactly two members — `completed` and
 * `cancelled` — and the confined shell uses `cancelled` for EVERY abort it
 * terminated a body for: a `user`/`parent` Stop, a `hook`/`disposed` cause, a
 * forwarded inherited signal, a host deadline, an `AbortError`. The rendered
 * `cancelled` bit is narrower: `shellCancelled()` mints it only for the
 * `user`/`parent` arms of the host's closed cancel-cause union. So a
 * non-`user`/`parent` abort answers `ok:true, cancelled:false, timedOut:false,
 * exitCode:null, settlement:{kind:'cancelled'}` — and reading only the two
 * flags wrote that "end never observed" body as `succeeded`. Consulting the
 * settlement closes the whole class, not just the measured `user` arm.
 *
 * CLASSIFICATION (the ledger's closed `succeeded | failed | unknown`):
 *  - `settlement.kind !== 'completed'` (today: `cancelled`, whatever its
 *    reason) → `unknown` — the body was admitted, its end was never observed;
 *  - a `cancelled`/`timedOut` outcome → `unknown` too (defence in depth: even
 *    a backend that mislabels its settlement cannot make a cancel a success);
 *  - an observed completion (`settlement.kind === 'completed'`, i.e. the
 *    payload reported its own end) with exit code 0 → `succeeded`; a
 *    NON-ZERO shell exit is `failed` (PD-42, owner ruling 2026-11-13: the
 *    durable fact must record a refused/failed command as `failed`, not claim
 *    the execution succeeded — the pre-PD-42 "the code is data" reading made
 *    the ledger lie about an OS refusal);
 *  - a missing settlement keeps the historical flag-only reading (the
 *    archived fixture backends predate the settlement field).
 *
 * This invents no new outcome value and changes no admission, consumption or
 * replay behaviour.
 */
function observedCompletion(result) {
    if (result.settlement !== undefined && result.settlement.kind !== 'completed')
        return false;
    const outcome = result.outcome;
    return outcome.cancelled !== true && outcome.timedOut !== true;
}
/**
 * PD-42 — a completed shell body that reported a non-zero exit FAILED. The
 * structured `exitCode` is available on this lane (unlike the native tool's
 * text trailer), so it is read directly. `null`/absent exit codes keep the
 * historical completed reading (search rows carry no exit code at all).
 *
 * The runtime twin of this law is the terminal classifier in
 * `packages/runtime/operation-permission/pre-execute-adapter.ts` (PD-42). This
 * lane cannot import it without inverting the tools -> runtime layering, so the
 * pure predicate is duplicated here; keep the two in step.
 */
function failedExit(result) {
    const exitCode = result.outcome.exitCode;
    return typeof exitCode === 'number' && exitCode !== 0;
}
/** The execution fact of an ANSWERED call (see the classification above). */
export function executionOutcomeOfAnsweredCall(result) {
    if (!observedCompletion(result))
        return 'unknown';
    return failedExit(result) ? 'failed' : 'succeeded';
}
/**
 * A THROW from the backend is not automatically an execution FAILURE. An
 * abort-shaped throw (`AbortError` / `code: 'ABORT_ERR'`, e.g. a DOMException
 * raised by a deadline or a forwarded inherited signal) says the call was
 * stopped, not that the body reported a failure: nothing was observed about
 * its end, so `failed` would state an execution failure nobody measured and
 * would invite a retry of an already-consumed allow. It is recorded `unknown`
 * (the ledger's "admitted, end never observed"), exactly like an answered
 * cancel. Every other throw keeps `failed`.
 */
function isAbortShapedThrow(error) {
    if (error === null || typeof error !== 'object')
        return false;
    const shape = error;
    return shape.name === 'AbortError' || shape.code === 'ABORT_ERR';
}
export async function runToolCall(deps) {
    const { request } = deps;
    const derived = deriveToolEffectSet(request.realmId, request.parsedArgs, request.effectAnchorRoot);
    if (!derived.ok)
        return deepFreezeContracts({ kind: 'refused-schema', problems: derived.problems });
    const verdict = deps.decide(derived.value);
    if (verdict.kind === 'deny') {
        // deny BEFORE backend: no sink opened, no backend call, no residue.
        return deepFreezeContracts({ kind: 'refused-admission', effectFingerprint: derived.value.fingerprint, denyCode: verdict.code });
    }
    if (deps.pa !== undefined) {
        // 9e fix-1 (A2 law at the trio edge): an ALREADY-aborted invocation is
        // settled `cancelled` BEFORE the PA edge — zero PA touch, zero
        // consumption, zero backend (the plane's paAdmit pre-leg answers the
        // same fact; a caller that never reaches the plane honors it here).
        const preAborted = request.signal?.aborted === true;
        const pa = preAborted ? { kind: 'allow', cancelled: true } : await deps.pa({
            realmId: request.realmId,
            callId: request.callId,
            parametersFingerprint: request.parametersFingerprint ?? derived.value.fingerprint,
            requestedEffects: derived.value,
            // PR358 fix-4: the host cancel signal rides the PA edge too — the
            // approval wait and the pre-consume check must honor the same
            // invocation cancellation the backend row honors.
            ...(request.signal === undefined ? {} : { signal: request.signal }),
        });
        if (pa.kind === 'allow' && pa.cancelled === true) {
            // PR358 fix-4: cancelled at the PA edge — zero backend, zero PA
            // consumption. The settled fact is rendered through the row's OWN
            // cancel renderer (empty stdout = nothing was observed; the a5p5-meta
            // tail stays on the wire — the presentation law does not fork).
            return deepFreezeContracts({
                kind: 'presented',
                settlement: { kind: 'cancelled', event: 'dispatcher-call-cancelled-before-body' },
                rendered: request.parsedArgs.tool === 'bash'
                    ? renderShellResult({ exitCode: null, stdout: '', stderr: '', timedOut: false, cancelled: true, truncated: false })
                    : renderSearchResult({
                        // the cancelled search wears the request's OWN output mode
                        outputMode: request.parsedArgs.tool === 'glob' ? 'files_with_matches' : request.parsedArgs.outputMode,
                        matches: [],
                        counts: [],
                        files: [],
                        totalMatches: 0,
                        truncated: false,
                        cancelled: true,
                    }),
                spill: null,
                effectFingerprint: derived.value.fingerprint,
            });
        }
        if (pa.kind === 'deny') {
            // PA denial BEFORE the backend — pending approval, a refused approval
            // and a policy deny are all ZERO-body facts; the code distinguishes
            // them on the audit line, never the wire shape.
            return deepFreezeContracts({ kind: 'refused-admission', effectFingerprint: derived.value.fingerprint, denyCode: pa.code });
        }
    }
    const lease = createSpillLease();
    let sink = null;
    if (deps.spill) {
        const spillId = `${request.parsedArgs.tool}-${request.callId}`;
        const opened = deps.spill.store.openSink({ spillId, lease, attribution: { realmId: request.realmId, tool: request.parsedArgs.tool, callId: request.callId } });
        if (!opened.ok)
            return deepFreezeContracts({ kind: 'refused-spill', refusal: opened.refusal });
        sink = opened.sink;
    }
    let result;
    try {
        result = await deps.backend.run({
            realmId: request.realmId,
            callId: request.callId,
            parsedArgs: request.parsedArgs,
            ...(request.signal === undefined ? {} : { signal: request.signal }),
        }, { lease, sink });
    }
    catch (error) {
        // A THROW is a terminal execution outcome too: the call was admitted and
        // consumed, and the backend refused/aborted before answering. Report it
        // ONCE (observation only), then rethrow unchanged — the row's own
        // presentation error stays the caller's fact.
        //
        // PD41-ABORT-CLASS: an ABORT-SHAPED throw is not an observed execution
        // failure, so it is `unknown` (see `isAbortShapedThrow`). Anything else
        // keeps the historical `failed`.
        deps.onExecutionResult?.({ callId: request.callId, outcome: isAbortShapedThrow(error) ? 'unknown' : 'failed' });
        throw error;
    }
    // PD-41 / PD41-ABORT-CLASS: an ANSWERED call is not automatically a COMPLETED
    // one — the helper reads the backend's SETTLEMENT, so every abort reason
    // (not only the rendered `cancelled` bit) stays at `unknown` instead of
    // claiming a completion its own rendered shape contradicts.
    deps.onExecutionResult?.({
        callId: request.callId,
        outcome: result.ok ? executionOutcomeOfAnsweredCall(result) : 'failed',
    });
    const settlement = result.ok ? result.settlement : UNREADABLE_SETTLEMENT;
    const settled = lease.settle(settlement);
    if (!settled.ok)
        return deepFreezeContracts({ kind: 'refused-spill', refusal: settled.refusal });
    if (sink)
        sink.finalize(settlement);
    lease.close();
    if (!result.ok)
        return deepFreezeContracts({ kind: 'backend-failed', failure: result.failure, settlement });
    const pointer = sink && sink.bytes() > 0 ? { spillId: sink.spillId, bytes: sink.bytes() } : null;
    let rendered;
    try {
        rendered = 'outputMode' in result.outcome
            ? renderSearchResult(result.outcome, { spill: pointer ?? undefined })
            : renderShellResult(result.outcome, { spill: pointer ?? undefined });
    }
    catch (error) {
        // Lane D ③ (wiring gate): a backend result carrying a value outside a
        // renderer closed set is a CLOSED-SET violation, not a crash and not a
        // presentation — typed `denied`, nothing presented, the settled residue
        // (if any) stays where the cancel law put it.
        if (error instanceof RenderClosedValueViolation) {
            return deepFreezeContracts({
                kind: 'backend-failed',
                failure: { class: 'denied', code: 'outcome-outside-closed-set', detail: error.message },
                settlement,
            });
        }
        throw error;
    }
    return deepFreezeContracts({ kind: 'presented', effectFingerprint: derived.value.fingerprint, settlement, rendered, spill: pointer });
}
//# sourceMappingURL=pipeline.js.map