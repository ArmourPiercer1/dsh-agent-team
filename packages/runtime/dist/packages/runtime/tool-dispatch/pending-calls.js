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
export function createPendingCallLedger() {
    const records = new Map();
    const arm = (input) => {
        const existing = records.get(input.callId);
        if (existing !== undefined)
            return { record: existing, reentry: true };
        const record = {
            callId: input.callId,
            scopeKey: input.scopeKey,
            name: input.name,
            pinnedIdentity: input.pinnedIdentity,
            abortIssuedBy: undefined,
            state: 'watched',
            controller: new AbortController(),
        };
        records.set(input.callId, record);
        return { record, reentry: false };
    };
    const raise = (record, currentIdentity) => {
        record.abortIssuedBy = 'lane-definition-move';
        record.state = 'abort-issued';
        try {
            record.controller.abort({ reason: `definition-moved: ${record.name}`, tool: record.name });
        }
        catch {
            // An AbortController that refuses a reason string still aborts; the reason
            // is diagnostic and never the mechanism.
        }
        return {
            callId: record.callId,
            scopeKey: record.scopeKey,
            name: record.name,
            pinnedIdentity: record.pinnedIdentity,
            currentIdentity,
        };
    };
    const onRegistryChange = (probe) => {
        const cancelled = [];
        for (const record of [...records.values()]) {
            if (record.state !== 'watched')
                continue;
            const now = probe(record);
            // Same identity ⇒ this call is exactly the one that was validated: leave it
            // alone. An unreadable identity is NOT "unchanged" — the closed world does
            // not credit a read it cannot make — so that call is cancelled too.
            if (now.ok && now.identity === record.pinnedIdentity)
                continue;
            cancelled.push(raise(record, now.ok ? now.identity : `unreadable:${now.identity}`));
        }
        return cancelled;
    };
    const settle = (callId) => {
        const record = records.get(callId);
        if (record === undefined)
            return undefined;
        records.delete(callId);
        const abortedByLane = record.abortIssuedBy !== undefined;
        record.state = 'settled';
        return { record, abortedByLane };
    };
    return {
        arm,
        onRegistryChange,
        settle,
        watched: () => [...records.values()],
        watchedCount: () => records.size,
        outstanding: () => [...records.values()].map((record) => ({ callId: record.callId, name: record.name, state: record.state })),
    };
}
//# sourceMappingURL=pending-calls.js.map