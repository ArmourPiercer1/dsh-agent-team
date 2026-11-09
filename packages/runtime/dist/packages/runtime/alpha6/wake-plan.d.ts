/**
 * Alpha.6 — the authoritative wake PLAN (router → per-recipient merge).
 *
 * The direct per-request notifier is NOT the main path. This module runs every
 * pending leg through the shared `ReviewRouter`, then merges the recipient
 * routes into ONE plan per Agent session. A coordinator/dispatcher consumes
 * this plan; it never re-decides routing and never invents a recipient.
 *
 * @module @dsh-agent-team/runtime/alpha6/wake-plan
 */
import { type ReviewRouteInput } from '../review-router/index.js';
export interface PlannedWake {
    /** The latch/authority identity (Member instance id). */
    readonly reviewerInstanceId: string;
    /** The DSH session the inbox belongs to (durable childSessionId). */
    readonly targetSessionId: string;
    readonly templateId: string;
    readonly routeRole: 'officer' | 'leader';
    readonly currentLegIds: readonly string[];
}
export interface WakePlan {
    readonly wakes: readonly PlannedWake[];
    /** Human targets have no Agent inbox; they are surfaced, never woken. */
    readonly humanLegIds: readonly string[];
    readonly held: readonly {
        readonly requestId?: string;
        readonly reason: string;
    }[];
}
export interface WakePlanOptions {
    /** Composition-owned map from Member instance id to its durable DSH session. */
    readonly sessionIdFor: (instanceId: string) => string | undefined;
}
export declare function planReviewWakes(inputs: readonly ReviewRouteInput[], options: WakePlanOptions): WakePlan;
//# sourceMappingURL=wake-plan.d.ts.map