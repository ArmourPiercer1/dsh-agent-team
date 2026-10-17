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
/** The C-PROC phase closed set, in contract order. */
export const PROVIDER_PHASES = ['probe', 'prepare', 'execute', 'terminate'];
/** The frozen lease-status mirror (pinned against the frozen set by hygiene). */
export const LEASE_STATUS_MIRROR = ['active', 'cancelling', 'termination-unconfirmed', 'terminated'];
/** Is the name one of the four closed phases? */
function isPhase(name) {
    return PROVIDER_PHASES.includes(name);
}
const LEGAL = Object.freeze({
    probe: ['probe', 'prepare'], // re-probe is idempotent; advance to prepare
    prepare: ['execute', 'terminate'], // execute, or abort-before-exec (ZERO processes)
    execute: ['terminate'], // the settlement phase only
    terminate: [], // absorbing
});
/**
 * Advance the phase machine. `from` is trusted only as a phase the machine
 * itself produced; any other `from`/`to` pair is refused with collected
 * problems mirroring the frozen parse-util style.
 */
export function advancePhase(from, to) {
    if (!isPhase(from)) {
        return { ok: false, problems: [{ code: 'value-outside-closed-set', path: '$.from', detail: `'${String(from)}' is not a provider phase` }] };
    }
    if (!isPhase(to)) {
        return { ok: false, problems: [{ code: 'value-outside-closed-set', path: '$.to', detail: `'${String(to)}' is not a provider phase` }] };
    }
    if (from === 'terminate') {
        return { ok: false, problems: [{ code: 'phase-absorbed', path: '$.to', detail: 'terminate is absorbing; no move out of it exists' }] };
    }
    if (LEGAL[from].includes(to))
        return { ok: true, phase: to };
    return { ok: false, problems: [{ code: 'phase-skipped', path: '$.to', detail: `${from} → ${to} skips a required phase (closed set probe → prepare → execute → terminate)` }] };
}
/**
 * Settle a termination from the provider's confirmation. `confirmed: false`
 * records the HONEST state — the process may still be running somewhere —
 * and carries the §5 code; it is NOT a failure to hide behind a retry.
 */
export function settleTermination(confirmed) {
    if (confirmed) {
        return { settlement: 'settled-confirmed', leaseStatus: 'terminated', sideEffectUnknown: false };
    }
    return { settlement: 'settled-unconfirmed', leaseStatus: 'termination-unconfirmed', sideEffectUnknown: true, errorCode: 'EXECUTION_TERMINATION_UNCONFIRMED' };
}
//# sourceMappingURL=phases.js.map