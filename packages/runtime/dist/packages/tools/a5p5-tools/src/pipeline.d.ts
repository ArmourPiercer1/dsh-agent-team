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
import type { ParsedToolArgs, RenderedPresentation, SearchOutcome, ShellOutcome } from './types.js';
/** The admission verdict this lane consumes (the decision lives elsewhere — no second authorization fact). */
export type AdmissionVerdict = {
    readonly kind: 'allow';
} | {
    readonly kind: 'deny';
    readonly code: string;
};
/** M1 CENTER PA WIRING (frozen A): the ASYNC production admission edge. The
 *  synchronous lane `decide` above is a fast deny path, NEVER an ask stand-in:
 *  a call that survives it still has to pass `pa` — the injected PA kernel
 *  edge (admitCall → real Control ask when required → issueApprovedGrant →
 *  one-shot consume) — before ANY backend work starts. Pending/approval-denied
 *  answers here are denials with distinct codes; there is no silent allow and
 *  no second authorization fact below this seam. */
export type PaVerdict = {
    readonly kind: 'allow';
} | {
    readonly kind: 'deny';
    readonly code: string;
    readonly detail?: string;
};
export type PaAdmitEdge = (request: {
    readonly realmId: string;
    readonly callId: string;
    readonly parametersFingerprint: string;
    readonly requestedEffects: RequestedEffectSet;
}) => Promise<PaVerdict>;
export interface ToolCallRequest {
    readonly realmId: string;
    readonly callId: string;
    readonly parsedArgs: ParsedToolArgs;
    /** M1: the canonical parameter fingerprint (Alpha.2 canonical-operation law), computed by the assembly owner; the plane mount always states it, archived kit rows may omit it (the edge then falls back to the effect-set fingerprint — same fact for the same call, never a guess across calls). */
    readonly parametersFingerprint?: string;
    /** B3 ADDITIVE: the host cancel signal, carried to the backend untouched (the pipeline itself acts on NOTHING — cancel is the row's fact, not a second authorization here). */
    readonly signal?: ToolCancelSignal;
    /** 9e-1 ADDITIVE: the host execution CONTEXT the caller carries — its
     *  `tokenKey` is the ledger STRING standing for the real per-execution
     *  token (the token identity itself never travels as text). Carried like
     *  `signal`: consumers sit on the plane/backend side; the pipeline acts on
     *  NOTHING from it. */
    readonly exec?: {
        readonly tokenKey?: string;
    };
    /** U7-6 GLUE-4 ADDITIVE: the governed root of an ANCHORED row (trusted,
     *  assembly-injected — never model-visible). Present ⇒ the search arms of
     *  the derived set claim the governed walk surface (`effects-schema`
     *  anchored law); absent ⇒ the historical target-scoped derivation,
     *  byte-identical. The pipeline just forwards it to the derivation. */
    readonly effectAnchorRoot?: string;
}
export interface RunToolCallDeps {
    readonly request: ToolCallRequest;
    readonly decide: (effectSet: RequestedEffectSet) => AdmissionVerdict;
    /** M1 PA edge; ABSENT only for the archived pre-M1 kit rows — the plane production mount always injects it. */
    readonly pa?: PaAdmitEdge;
    readonly backend: ToolEffectBackend;
    readonly spill?: {
        readonly store: SpillStore;
    };
    /** Optional A6 execution-result observation: called ONCE after the backend
     *  answered (success or failure), with the callId. It observes only; it can
     *  never change the result. Refused paths (schema/admission/PA/cancel before
     *  the body) do not call it: no body was admitted, so there is no execution
     *  to report.
     *
     *  The outcome vocabulary is the Control ledger's own
     *  (`succeeded | failed | unknown`), and it means EXECUTION, not authorization:
     *  `succeeded` is reserved for a body whose end was observed; a cancelled or
     *  timed-out body reports `unknown` (it started, its end was never observed —
     *  separately from whether it produced side effects). */
    readonly onExecutionResult?: (input: {
        readonly callId: string;
        readonly outcome: 'succeeded' | 'failed' | 'unknown';
    }) => void;
}
/**
 * PD-41 (owner ruling 2026-11-11) — the execution-fact outcome of an ANSWERED
 * backend call. `result.ok` is the backend's "I answered" bit; it is NOT "the
 * body completed". A shell the host cancelled (or killed at its timeout)
 * answers `ok: true` with `cancelled: true` / `timedOut: true` and
 * `exitCode: null` — the payload never reported an end (see
 * `process-family/src/confined-shell-executor.mjs`, whose settlement for that
 * arm is `{kind:'cancelled'}`). Recording that as `succeeded` would state a
 * completion nobody measured: the measured shape was
 * `cancelled=true exit=not-observed` in the shell log next to a durable
 * `succeeded`, with no side effect on disk.
 *
 * The honest value is the ledger's existing `unknown` — the body was admitted
 * and may have had effects, but its end was never observed. This invents no
 * new outcome and changes no admission, consumption or replay behaviour.
 */
export declare function executionOutcomeOfAnsweredCall(result: {
    readonly ok: true;
    readonly outcome: SearchOutcome | ShellOutcome;
    /** Carried by the real backend answer; not consulted here (the outcome is). */
    readonly settlement?: unknown;
}): 'succeeded' | 'unknown';
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