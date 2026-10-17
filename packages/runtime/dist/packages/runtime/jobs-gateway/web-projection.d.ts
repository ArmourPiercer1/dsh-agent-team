import type { GatewayRefusal, JobOutcome } from './types.js';
export declare const REDACTION_MARKER = "[REDACTED]";
/** Deep redaction sweep: credential-shaped KEYS have their values replaced. */
export declare function redactCredentials<T>(value: T): T;
/** What a job looks like from the Web side. No plane internals, no tokens. */
export interface WebJobView {
    readonly jobId: string;
    readonly ownerKey: string;
    readonly toolName: string;
    readonly state: 'leased' | 'settled';
    readonly outcome: JobOutcome | null;
    readonly pinnedIdentity: string;
}
export interface ProjectionSource {
    readonly jobId: string;
    readonly ownerKey: string;
    readonly toolName: string;
    readonly pinnedIdentity: string;
    readonly state: 'leased' | 'settled';
    readonly outcome: JobOutcome | null;
}
/**
 * Project one job for one viewer member scope. The viewer is identified by
 * the same canonical member key as the owner; different keys never see the
 * record, and the refusal never carries the owner key itself.
 */
export declare function projectJobForViewer(viewerOwner: {
    readonly rootSessionId: string;
    readonly instanceId: string;
}, job: ProjectionSource): {
    readonly ok: true;
    readonly view: WebJobView;
} | GatewayRefusal;
//# sourceMappingURL=web-projection.d.ts.map