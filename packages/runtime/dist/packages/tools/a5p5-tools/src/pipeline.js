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
export async function runToolCall(deps) {
    const { request } = deps;
    const derived = deriveToolEffectSet(request.realmId, request.parsedArgs);
    if (!derived.ok)
        return deepFreezeContracts({ kind: 'refused-schema', problems: derived.problems });
    const verdict = deps.decide(derived.value);
    if (verdict.kind === 'deny') {
        // deny BEFORE backend: no sink opened, no backend call, no residue.
        return deepFreezeContracts({ kind: 'refused-admission', effectFingerprint: derived.value.fingerprint, denyCode: verdict.code });
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
    const result = await deps.backend.run({
        realmId: request.realmId,
        callId: request.callId,
        parsedArgs: request.parsedArgs,
        ...(request.signal === undefined ? {} : { signal: request.signal }),
    }, { lease, sink });
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