/**
 * pending-calls.ts — the lane's ledger of calls that are IN FLIGHT and have not
 * reached a Body yet (the B3 mechanism: "when a Definition changes, cancel the
 * related calls that have not executed").
 *
 * WHY THIS EXISTS, AND WHY IT IS A SIGNAL AND NOT A VETO.
 * The pinned registry replaces a Definition's identity only at
 * `dispatchToolBody` → `resolveExecution` (`packages/core/tools/src/index.ts`
 * @ 639ed01539, `:1578`), which sits inside the registry's OWN innermost step —
 * after `tools/execute` and therefore after every listener this lane can mount.
 * No public seam is allowed to run in that last gap, so no public seam can
 * refuse a Body there. But the same step refuses it on a signal, BEFORE it
 * resolves anything:
 *
 *   1568  const wrapperSignal = exec.signal
 *   1569  const fused = fuseToolSignals(state.callerSignal, wrapperSignal)
 *   1572  if (isAborted(fused)) return toolAbortedBeforeDispatchResult()
 *   1578  const tool = this.resolveExecution(exec.name, exec.agent, …)
 *   1580  state.bodyInvoked = true
 *
 * and the `tools/execute` contract hands the lane exactly that handle
 * (`:155-159`, verbatim): "wrappers may change only `exec.signal`, while call
 * identity remains immutable. The registry re-fuses the original caller signal
 * before the body, so replacement cannot detach caller cancellation; wrappers
 * must still restore their signal and reach quiescence."
 *
 * So the lane installs a signal it can raise, and a legal re-registration that
 * arrives too late for any check is answered by the HOST's own before-dispatch
 * refusal — the native execute chain still runs, the Body is never resolved, and
 * nothing here touches Core.
 *
 * WHAT THE LEDGER MUST NOT DO. `tools/change` carries no arguments and is not
 * scope-filtered (`:203-206`), so it says only "something moved". Cancelling on
 * the event alone would cancel every in-flight call of every governed name
 * because one plugin refreshed one tool. Every record therefore carries its own
 * (scope, name, pinned identity) and is re-read before it is aborted: a call is
 * cancelled only when THE DEFINITION IT WAS VALIDATED AGAINST has moved, and
 * never because a neighbour's did.
 *
 * IT IS NOT A DRAIN TOOL. Teardown is a different question — a call racing a
 * teardown is turned away at the doors, and a call whose Body has already started
 * must not have its finished outcome rewritten to "aborted". So nothing here
 * aborts on drain: the ledger is armed by the dispatch door and disarmed at the
 * settled edge, and {@link PendingCallLedger.outstanding} is what a teardown may
 * legitimately ask about (an armed watch left behind is a leak worth reporting).
 *
 * AND WHAT IT MUST NOT CLAIM. An abort is an request, not a fact about the
 * Body. Whether a Body ran is decided by the Host and reported back through its
 * two shapes (`:1550-1556`, `:1958-1982`): `ABORTED_BEFORE_DISPATCH` with
 * `bodyInvoked` false means the Body was never resolved, while `ABORTED` means
 * it started or finished and its own result is preserved. This ledger records
 * the abort it ISSUED and nothing else; the classification of what actually
 * happened belongs to the settled edge, which is the only place with evidence.
 *
 * @module tool-dispatch/pending-calls
 */
/** One call between the dispatch door and its Body. */
export interface PendingCall {
    readonly callId: string;
    /** The Agent scope the call belongs to — the layer its Definition was read from. */
    readonly scopeKey: string;
    readonly name: string;
    /** The definition identity the door validated. Re-reads compare against THIS. */
    readonly pinnedIdentity: string;
    /** Whose cancellation this call is running under, once the lane has raised it. */
    abortIssuedBy: 'lane-definition-move' | undefined;
    state: 'watched' | 'abort-issued' | 'settled';
    readonly controller: AbortController;
}
/** What an abort was worth, per call: reported, never assumed. */
export interface CancelledCall {
    readonly callId: string;
    readonly scopeKey: string;
    readonly name: string;
    readonly pinnedIdentity: string;
    readonly currentIdentity: string;
}
export interface PendingCallLedger {
    /**
     * Take a watch on one call and hand back the signal to put on `exec.signal`.
     * Re-arming the same `callId` returns the existing record: a call is watched
     * once, and a second door on the same call must not silently swap the signal.
     */
    readonly arm: (input: {
        readonly callId: string;
        readonly scopeKey: string;
        readonly name: string;
        readonly pinnedIdentity: string;
    }) => {
        readonly record: PendingCall;
        readonly reentry: boolean;
    };
    /**
     * Answer one `tools/change`. `probe` says what a (scope, name) resolves to
     * RIGHT NOW; only records whose own identity moved are aborted.
     */
    readonly onRegistryChange: (probe: (record: PendingCall) => {
        readonly ok: boolean;
        readonly identity: string;
    }) => readonly CancelledCall[];
    /**
     * The settled edge. Returns the record and whether the lane had aborted it —
     * the caller still has to look at the Host's shape to know what happened.
     */
    readonly settle: (callId: string) => {
        readonly record: PendingCall;
        readonly abortedByLane: boolean;
    } | undefined;
    readonly watched: () => readonly PendingCall[];
    readonly watchedCount: () => number;
    /** Quiescence: how many watches the lane still holds. Drain asks this. */
    readonly outstanding: () => readonly {
        callId: string;
        name: string;
        state: PendingCall['state'];
    }[];
}
export declare function createPendingCallLedger(): PendingCallLedger;
//# sourceMappingURL=pending-calls.d.ts.map