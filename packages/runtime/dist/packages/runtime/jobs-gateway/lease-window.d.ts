import type { GatewayRefusal } from './types.js';
export type LeaseWindowState = 'ACTIVE' | 'DRAINING' | 'RELEASED' | 'GIVEN_UP';
export type LeaseEndReason = 'settled' | 'refused';
export interface LeaseToken {
    readonly callId: string;
    readonly jobKey: string;
}
export interface LeaseObservation {
    readonly event: string;
    readonly [rest: string]: unknown;
}
export interface LeaseWindow {
    readonly state: () => LeaseWindowState;
    readonly active: () => boolean;
    /** Take one lease for an admitted job. ACTIVE only; re-arm of a live callId is a refusal. */
    readonly acquire: (token: LeaseToken) => {
        readonly ok: true;
    } | GatewayRefusal;
    /**
     * End one lease by callId. `'settled'` is accepted only while ACTIVE;
     * `'refused'` ends in any live state. Cross-boundary settles are typed
     * refusals and leave the token outstanding.
     */
    readonly end: (callId: string, reason?: LeaseEndReason) => {
        readonly ok: true;
    } | GatewayRefusal;
    /** ACTIVE→DRAINING. New leases and cross-boundary settles stop being accepted. */
    readonly drain: () => {
        readonly ok: true;
    } | GatewayRefusal;
    /** DRAINING→RELEASED, only at self-counted zero. */
    readonly release: () => {
        readonly ok: true;
    } | GatewayRefusal;
    /** Hand in the decision to stop waiting: terminal, release refuses forever. */
    readonly giveUp: (reason: string) => {
        readonly ok: true;
    } | GatewayRefusal;
    /** What a teardown may legitimately ask: the outstanding self-count. */
    readonly outstanding: () => readonly LeaseToken[];
}
export declare function createLeaseWindow(onObserve?: (observation: LeaseObservation) => void): LeaseWindow;
//# sourceMappingURL=lease-window.d.ts.map