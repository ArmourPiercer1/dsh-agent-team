import type { LeaseWindow } from './lease-window.js';
import type { DispatchEvent, GatewayRefusal, JobOutcome, JobOwner } from './types.js';
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
        readonly pinnedIdentity: string;
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
export declare function createJobsGateway(options?: {
    readonly resolveDefinition?: DefinitionIdentityProbe;
    readonly onObserve?: (observation: GatewayObservation) => void;
}): JobsGateway;
//# sourceMappingURL=jobs-gateway.d.ts.map