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
import type { RequestedEffectSet } from '../../../domain/tool-governance/src/index.js';
import type { ToolContractProblem } from '../../../domain/tool-governance/src/parse-util.js';
import { type BackendFailure, type ToolCancelSignal, type ToolEffectBackend } from './backend-contract.js';
import { type LeaseSettlement, type SpillRefusal, type SpillStore } from './spill.js';
import type { ParsedToolArgs, RenderedPresentation } from './types.js';
/** The admission verdict this lane consumes (the decision lives elsewhere — no second authorization fact). */
export type AdmissionVerdict = {
    readonly kind: 'allow';
} | {
    readonly kind: 'deny';
    readonly code: string;
};
export interface ToolCallRequest {
    readonly realmId: string;
    readonly callId: string;
    readonly parsedArgs: ParsedToolArgs;
    /** B3 ADDITIVE: the host cancel signal, carried to the backend untouched (the pipeline itself acts on NOTHING — cancel is the row's fact, not a second authorization here). */
    readonly signal?: ToolCancelSignal;
}
export interface RunToolCallDeps {
    readonly request: ToolCallRequest;
    readonly decide: (effectSet: RequestedEffectSet) => AdmissionVerdict;
    readonly backend: ToolEffectBackend;
    readonly spill?: {
        readonly store: SpillStore;
    };
}
export interface SpillPointerFact {
    readonly spillId: string;
    readonly bytes: number;
}
export type ToolCallResult = {
    readonly kind: 'refused-schema';
    readonly problems: readonly ToolContractProblem[];
} | {
    readonly kind: 'refused-admission';
    readonly effectFingerprint: string;
    readonly denyCode: string;
} | {
    readonly kind: 'refused-spill';
    readonly refusal: SpillRefusal;
} | {
    readonly kind: 'backend-failed';
    readonly failure: BackendFailure;
    readonly settlement: LeaseSettlement;
} | {
    readonly kind: 'presented';
    readonly effectFingerprint: string;
    readonly settlement: LeaseSettlement;
    readonly rendered: RenderedPresentation;
    readonly spill: SpillPointerFact | null;
};
export declare function runToolCall(deps: RunToolCallDeps): Promise<ToolCallResult>;
//# sourceMappingURL=pipeline.d.ts.map