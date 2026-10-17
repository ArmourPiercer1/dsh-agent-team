/**
 * lease-window.ts — the gateway's view of the dispatcher lease
 * (INTERFACES-v1 C-GW: "Lease lifecycle ACTIVE→DRAINING boundary = settled
 * edge"). DORMANT adaptation layer; the decision authority stays with the
 * PR1 Scoped Dispatcher — this window is the JOB-side mirror that the
 * Web/Jobs surface reads, and it keeps the same two laws:
 *
 *  1. SELF-COUNTED. Every admitted job holds one lease token here; release
 *     happens only at a self-counted zero, never because some teardown
 *     callback returned (PR1: "a promise returning is not termination
 *     evidence").
 *  2. THE BOUNDARY IS THE SETTLED EDGE. `drain()` moves ACTIVE→DRAINING:
 *     new admissions are refused from the first instant, and a `'settled'`
 *     callback that CROSSes the boundary is not completion evidence — it is
 *     refused typed and the token stays outstanding. A `'refused'` end (the
 *     call provably never took the lease path, or a door refusal) ends the
 *     token in ANY state, because it claims nothing about a Body.
 *
 * Giving up a drain (an external decision this window does not time on its
 * own) is terminal: after it, release REFUSES permanently and the window
 * never reports RELEASED — the caller's mask/Guard stay armed upstream.
 *
 * @module runtime/jobs-gateway/lease-window
 */
import { gatewayRefusal } from './types.js';
export function createLeaseWindow(onObserve = () => { }) {
    let state = 'ACTIVE';
    let giveUpReason = null;
    const tokens = new Map();
    const observe = (event, rest = {}) => {
        onObserve({ event, ...rest });
    };
    return {
        state: () => state,
        active: () => state === 'ACTIVE',
        acquire: (token) => {
            if (state !== 'ACTIVE') {
                observe('gateway-lease-acquire-refused', { callId: token.callId, state });
                return gatewayRefusal('gateway-not-active', `cannot acquire a lease while ${state}: new work is refused from the first instant of the drain`);
            }
            if (tokens.has(token.callId)) {
                // A second door on the same callId must not silently double-count the
                // self-held total (PR1's re-entry rule).
                observe('gateway-lease-acquire-reentry', { callId: token.callId });
                return gatewayRefusal('duplicate-job', `lease ${token.callId} is already outstanding`);
            }
            tokens.set(token.callId, token);
            return { ok: true };
        },
        end: (callId, reason = 'settled') => {
            const token = tokens.get(callId);
            if (token === undefined) {
                return gatewayRefusal('unknown-job', `no outstanding lease for ${callId}`);
            }
            if (reason === 'settled' && state !== 'ACTIVE') {
                // The callback crossed the ACTIVE→DRAINING boundary. Crossing is not
                // settling: the token stays outstanding and the crossing is loud.
                observe('gateway-lease-settle-refused-across-boundary', {
                    callId,
                    state,
                    severity: 'alarm',
                });
                return gatewayRefusal('late-settle-across-boundary', `a settled callback arrived while ${state}; a callback crossing the drain boundary is not completion evidence`);
            }
            if (state === 'RELEASED') {
                // A released window reached a self-counted ZERO: nothing is left to end.
                return gatewayRefusal('unknown-job', 'window is RELEASED; no lease is outstanding');
            }
            tokens.delete(callId);
            observe(reason === 'refused' ? 'gateway-lease-ended-refused' : 'gateway-lease-ended-settled', {
                callId,
            });
            return { ok: true };
        },
        drain: () => {
            if (state !== 'ACTIVE') {
                return gatewayRefusal('gateway-not-active', `cannot drain while ${state}`);
            }
            state = 'DRAINING';
            // Mirrors PR1: the mask is deliberately untouched at the boundary; only
            // the self-count is reported.
            observe('gateway-drain-inflight', { outstanding: tokens.size });
            return { ok: true };
        },
        release: () => {
            if (giveUpReason !== null) {
                observe('gateway-release-refused', { reason: 'drain-given-up', detail: giveUpReason });
                return gatewayRefusal('drain-given-up', `cannot release: the drain was given up (${giveUpReason}) without proof that every Body terminated; this window never reports RELEASED`);
            }
            if (tokens.size > 0) {
                observe('gateway-release-refused', { outstanding: [...tokens.keys()] });
                return gatewayRefusal('release-with-outstanding', `cannot release: ${tokens.size} self-counted lease(s) still outstanding (${[...tokens.keys()].join(', ')})`);
            }
            if (state !== 'DRAINING') {
                return gatewayRefusal('gateway-not-active', `release needs a completed drain (state ${state})`);
            }
            state = 'RELEASED';
            observe('gateway-released', { releasedWithZeroInFlight: true });
            return { ok: true };
        },
        giveUp: (reason) => {
            if (state !== 'DRAINING') {
                return gatewayRefusal('gateway-not-active', `giveUp needs a live drain (state ${state})`);
            }
            giveUpReason = reason;
            state = 'GIVEN_UP';
            observe('gateway-drain-given-up', { reason });
            return { ok: true };
        },
        outstanding: () => [...tokens.values()],
    };
}
//# sourceMappingURL=lease-window.js.map