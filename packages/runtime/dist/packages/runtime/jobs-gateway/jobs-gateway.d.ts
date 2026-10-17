import type { LeaseWindow } from './lease-window.js';
import type { DispatchEvent, GatewayIdentitySource, GatewayRefusal, JobOutcome, JobOwner } from './types.js';
import type { WebJobView } from './web-projection.js';
/** A live definition read: {scope, name} → current identity. */
export type DefinitionIdentityProbe = (scopeKey: string, name: string) => {
    readonly ok: boolean;
    readonly identity: string;
};
export interface GatewayObservation {
    readonly event: string;
    readonly [rest: string]: unknown;
}
export interface GatewayJobRecord {
    readonly jobId: string;
    /** Canonical member-scope key bound at admission; immutable from here. */
    readonly ownerKey: string;
    /** The agent scope whose Definition the job was validated against. */
    readonly scopeKey: string;
    readonly toolName: string;
    /** Definition identity validated at admission — the attribution anchor. */
    readonly pinnedIdentity: string;
    state: 'leased' | 'settled';
    outcome: JobOutcome | null;
    /** The lane asked for this call's cancellation (C-BIND re-read said moved). */
    cancelRequested: boolean;
    readonly evidence: DispatchEvent[];
}
export interface JobsGateway {
    readonly lease: LeaseWindow;
    readonly admitJob: (input: {
        readonly jobId: string;
        readonly owner: JobOwner;
        readonly scopeKey: string;
        readonly toolName: string;
        /**
         * The execution-time definition identity this job attributes to. Omit
         * it when a `resolveDefinition` reader is injected: the gateway then
         * pins what the reader reports AT ADMISSION (unreadable ⇒ typed refusal
         * `mapping-rejected`). Providing it stays the explicit fixture shape.
         */
        readonly pinnedIdentity?: string;
    }) => {
        readonly ok: true;
        readonly job: GatewayJobRecord;
    } | GatewayRefusal;
    /** Feed one dispatch-plane event. Tokens are redacted AT COLLECTION. */
    readonly observeDispatchEvent: (event: DispatchEvent) => {
        readonly ok: true;
    } | GatewayRefusal;
    /** One `tools/change`: per in-flight job, re-read its OWN identity; cancel only what moved. */
    readonly onRegistryChange: (probe?: DefinitionIdentityProbe) => readonly {
        jobId: string;
        pinnedIdentity: string;
        currentIdentity: string;
    }[];
    readonly job: (jobId: string) => readonly GatewayJobRecord[];
    readonly projectFor: (viewer: JobOwner, jobId: string) => {
        readonly ok: true;
        readonly view: WebJobView;
    } | GatewayRefusal;
}
export interface CreateJobsGatewayOptions {
    /**
     * Live reader of `(scopeKey, name) → current definition identity`. Used
     * twice: as the admit-time pinner when an admission omits its
     * `pinnedIdentity`, and as the C-BIND re-read on `onRegistryChange`.
     */
    readonly resolveDefinition?: DefinitionIdentityProbe;
    readonly onObserve?: (observation: GatewayObservation) => void;
    /**
     * The host-injected durable-identity authority. Present ⇒ every admission
     * is confirmed against durable host state BEFORE the lease is taken; an
     * unconfirmed claim is refused `owner-not-durable` with zero state delta.
     */
    readonly identity?: GatewayIdentitySource;
    /**
     * The assembly-owned job-side lease window. Present ⇒ the gateway drives
     * THIS window (acquire/end/observe) and teardown acts on the same object;
     * the closed-world defaults to a private `createLeaseWindow` fed by the
     * gateway's own observation sink.
     */
    readonly lease?: LeaseWindow;
}
export declare function createJobsGateway(options?: CreateJobsGatewayOptions): JobsGateway;
//# sourceMappingURL=jobs-gateway.d.ts.map