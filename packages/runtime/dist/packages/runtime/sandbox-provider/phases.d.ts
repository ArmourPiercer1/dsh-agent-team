/**
 * THE PHASE CLOSED SET — C-PROC (INTERFACES-v1): `probe → prepare → execute →
 * terminate`, closed, typed, with the C-GW-aligned separation of CANCELLATION
 * (a lease REQUEST) from TERMINATION (the settled terminal state).
 *
 * Laws encoded here (plan §7 / PR0 lease law / PR1r B3(ii) abort-before-exec):
 *  - the set is CLOSED: no phase outside the four exists, and a name outside
 *    it is a typed refusal, never an implicit accept;
 *  - `terminate` is ABSORBING (a confirmed stop never reopens);
 *  - phases never skip: `probe → execute` is exactly the "run first, decide
 *    later" move the frozen admission law forbids;
 *  - `prepare → terminate` is the ABORT-BEFORE-EXEC leg: legal, and by
 *    construction ZERO-PROCESS (nothing ran, `sideEffectUnknown` cannot apply);
 *  - cancellation is a REQUEST carried on the lease (`cancelling`), never a
 *    phase and never a settlement; only `settleTermination` decides, and an
 *    unconfirmed settlement keeps the §5 `EXECUTION_TERMINATION_UNCONFIRMED`
 *    honesty (`sideEffectUnknown: true`).
 *
 * Purity: no `node:*`, no I/O.
 *
 * @module @dsh-agent-team/runtime/sandbox-provider/phases
 */
import type { ProviderErrorCode } from './contract-stub.js';
/** The C-PROC phase closed set, in contract order. */
export declare const PROVIDER_PHASES: readonly ["probe", "prepare", "execute", "terminate"];
/** One provider phase. */
export type ProviderPhase = (typeof PROVIDER_PHASES)[number];
/** A phase-move outcome: accepted phase, or collected typed problems. */
export type PhaseAdvance = {
    readonly ok: true;
    readonly phase: ProviderPhase;
} | {
    readonly ok: false;
    readonly problems: readonly {
        code: string;
        path: string;
        detail: string;
    }[];
};
/** The frozen lease-status mirror (pinned against the frozen set by hygiene). */
export declare const LEASE_STATUS_MIRROR: readonly ["active", "cancelling", "termination-unconfirmed", "terminated"];
/**
 * Advance the phase machine. `from` is trusted only as a phase the machine
 * itself produced; any other `from`/`to` pair is refused with collected
 * problems mirroring the frozen parse-util style.
 */
export declare function advancePhase(from: ProviderPhase, to: ProviderPhase): PhaseAdvance;
/** How a terminate-phase settlement resolved. */
export type TerminationSettlement = 'settled-confirmed' | 'settled-unconfirmed';
/** The settlement mapping — the single site where the §5 honesty is decided. */
export interface SettlementOutcome {
    readonly settlement: TerminationSettlement;
    readonly leaseStatus: 'terminated' | 'termination-unconfirmed';
    readonly sideEffectUnknown: boolean;
    readonly errorCode?: ProviderErrorCode;
}
/**
 * Settle a termination from the provider's confirmation. `confirmed: false`
 * records the HONEST state — the process may still be running somewhere —
 * and carries the §5 code; it is NOT a failure to hide behind a retry.
 */
export declare function settleTermination(confirmed: boolean): SettlementOutcome;
//# sourceMappingURL=phases.d.ts.map