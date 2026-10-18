/**
 * `a5p5-tools` Phase 2 — the BACKEND CONTRACT this lane consumes: the closed
 * execution shape a Search/Shell provider (PR3 FS / PR4 confined process)
 * will speak, plus the scenario-fixture table that lets the lane develop its
 * PARITY claim now, against a stub, instead of waiting for those lanes
 * (INTERFACES-v1.md 集成规则: 上游未合 = 契约 fixture 开发；the claim is
 * "verified against the fixture", never "the whole chain is verified").
 *
 * C-PROC LAW (INTERFACES-v1.md): the stage set is the CLOSED sequence
 * probe → prepare → execute → terminate; `terminate ≠ cancel` — the terminal
 * fact of a run is carried SEPARATELY by the settlement (the PR1r/lease
 * plane in `spill.ts`), never by abusing the stage walk.
 *
 * C-FS LAW: every normalized backend failure carries the typed error class
 * from the closed triad denied / hidden / undetermined — a hidden leg is
 * still typed, never a silent result.
 *
 * Purity: no `node:*`, no I/O, no clock.
 *
 * @module @dsh-agent-team/tools/a5p5-tools/backend-contract
 */
import type { LeaseSettlement, SpillErrorClass, SpillLease, SpillSink } from './spill.js';
import type { ParsedToolArgs, SearchOutcome, ShellOutcome } from './types.js';
/** The C-PROC closed stage set, in transition order. */
export declare const BACKEND_STAGES: readonly ["probe", "prepare", "execute", "terminate"];
export type BackendStage = (typeof BACKEND_STAGES)[number];
/** A normalized C-FS-shaped failure: typed class, stable code, human detail. */
export interface BackendFailure {
    readonly class: SpillErrorClass;
    readonly code: string;
    readonly detail: string;
}
/**
 * The lane's STRUCTURAL view of the host's cooperative cancel signal (B3).
 * The host hands every tool call an `exec.signal: AbortSignal` (public
 * ToolExecutionInput; dispatch passes it verbatim and the host's own law
 * makes async work observe it) — but the lane names neither node nor host
 * types, so this closed four-member view is the WHOLE surface any backend
 * may read: `aborted`, an `unknown` reason it walks for a discriminator
 * alone, and the two listener methods. ABSENT on a call means the row was
 * never asked to cancel — the pre-B3 case, pinned by B2's X6 leg.
 */
export interface ToolCancelSignal {
    readonly aborted: boolean;
    readonly reason?: unknown;
    addEventListener(type: 'abort', listener: () => void, options?: {
        readonly once?: boolean;
    }): void;
    removeEventListener(type: 'abort', listener: () => void): void;
}
/** One call handed to a backend (realm/call identity is admission-injected). */
export interface BackendCall {
    readonly realmId: string;
    readonly callId: string;
    readonly parsedArgs: ParsedToolArgs;
    /** B3 ADDITIVE: the host cancel signal when the assembly carried one; a backend that grew no abort leg simply never reads it. */
    readonly signal?: ToolCancelSignal;
}
/** The execution I/O a backend may use: the lease and the spill sink (if any). */
export interface BackendRunIo {
    readonly lease: SpillLease;
    readonly sink: SpillSink | null;
}
export type BackendResult = {
    readonly ok: true;
    readonly outcome: SearchOutcome | ShellOutcome;
    readonly settlement: LeaseSettlement;
} | {
    readonly ok: false;
    readonly failure: BackendFailure;
};
/**
 * The backend seam. `execCount` counts BODIES actually executed (a pre-execute
 * refusal never counts); `lastStageTrace` is the C-PROC diagnostic plane —
 * deliberately OUTSIDE the parity-comparable result (a registered difference:
 * the contract path reports stages, a direct implementation reports none).
 */
export interface ToolEffectBackend {
    readonly backendId: string;
    run(call: BackendCall, io: BackendRunIo): Promise<BackendResult>;
    execCount(): number;
    readonly lastStageTrace: readonly BackendStage[];
}
/** One scenario of the fixture table (the shared truth for BOTH backends). */
export interface ScenarioFixture {
    /** The completed outcome (absent only for pre-execute failures). */
    readonly outcome?: SearchOutcome | ShellOutcome;
    /** Raw payload chunks the body streams WHILE EXECUTING (lease still ACTIVE). */
    readonly chunks?: readonly string[];
    /** The terminal fact of the run; absent means `{ kind: 'completed' }`. */
    readonly settlement?: LeaseSettlement;
    /** A pre-execute refusal leg: the C-FS denial happens at this stage. */
    readonly failAt?: 'probe' | 'prepare';
    readonly failure?: BackendFailure;
}
export type ScenarioTable = Readonly<Record<string, ScenarioFixture>>;
/** The settlement of a backend that never produced an outcome (C-PROC honest fact). */
export declare const UNREADABLE_SETTLEMENT: LeaseSettlement;
//# sourceMappingURL=backend-contract.d.ts.map