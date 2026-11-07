/**
 * Alpha.6 PR6 — the notifier replacement seam (pure composition).
 *
 * The legacy `ControlRequestNotificationPort` always wakes the LEADER. A6
 * routes an ordinary tool ask to the assigned Officer through the review-wake
 * delivery seam instead. This module composes the two WITHOUT changing the
 * durable ledger: it renders one model-visible hint and hands it to the wake
 * port; the pending list still reads durable state.
 *
 * @module @dsh-agent-team/runtime/alpha6/notifier
 */
import type { AssignedOfficerReviewFacts, AssignedOfficerReviewFactsQuery, ControlRequestNotificationPort, ControlRequestRecord } from '../control/types.js';
import type { Alpha6CompositionDecision } from './composition.js';
import type { ReviewRoute } from './root-router.js';
export interface WakeDeliveryPort {
    (input: {
        readonly targetSessionId: string;
        readonly wakeId: string;
        readonly text: string;
    }): Promise<void>;
}
/**
 * Render the Officer-facing wake. Deterministic per request; leads with the
 * dedup token; carries no decision and no case payload.
 */
export declare function renderOfficerReviewWake(request: ControlRequestRecord): string;
/**
 * Compose the legacy Leader notifier and the A6 Officer wake behind ONE port.
 *
 * - `legacy` decision → the legacy notifier is invoked unchanged.
 * - `alpha6` decision → exactly one wake to the resolved Officer session and
 *   NO Leader notification.
 * - A `refused` decision → throw; never the Leader fallback.
 */
export declare function createComposedControlNotifier(ports: {
    readonly decision: Alpha6CompositionDecision;
    readonly legacy: ControlRequestNotificationPort;
    readonly wake: WakeDeliveryPort;
    readonly recipientSessionId: string;
}): ControlRequestNotificationPort;
/** Resolve the CURRENT reviewer for one durable request (the trusted facts port). */
export interface Alpha6NotifierReviewerPort {
    (query: {
        readonly rootSessionId: string;
        readonly approvalCaseId: string;
        readonly currentLegRequestId: string;
        readonly legOrdinal: number;
    }): Promise<{
        readonly instanceId: string;
    } | null>;
}
/**
 * The root-level Alpha.6 notification path: a control request is resolved
 * through the SAME trusted facts port the decision path uses, then delivered
 * to that reviewer's live child session. There is NO Leader fallback:
 * unresolvable reviewer, missing case identity or a delivery failure throws
 * (the service's notification is fire-and-forget/liveness, so throwing cannot
 * change the durable outcome, but it must be visible).
 */
export declare function createAlpha6RootControlNotifier(ports: {
    readonly rootSessionId: string;
    readonly resolveCurrentReviewer: Alpha6NotifierReviewerPort;
    readonly memberSession: (rootSessionId: string, instanceId: string) => {
        readonly childSessionId?: string;
    } | undefined | Promise<{
        readonly childSessionId?: string;
    } | undefined>;
    readonly deliver: (rootSessionId: string, wake: Parameters<WakeDeliveryPort>[0]) => Promise<void>;
    /**
     * Optional trusted merge inputs. When BOTH are present, the notifier reads
     * the durable pending legs, keeps only those the SAME facts port proves are
     * delegable to the SAME reviewer, and delivers ONE wake for the group.
     */
    readonly readRequests?: (rootSessionId: string) => Promise<readonly ControlRequestRecord[]>;
    readonly reviewFacts?: (query: AssignedOfficerReviewFactsQuery) => Promise<AssignedOfficerReviewFacts | null>;
    /**
     * The ONE shared routing decision for a durable leg. When present it is the
     * ONLY recipient authority: a Leader/Human/held route is never delivered to
     * the current Officer merely because that Officer exists.
     */
    readonly route?: (requestId: string, rootSessionId?: string) => Promise<ReviewRoute | null>;
    /** The legacy Leader liveness notification, used for a LEGAL Leader route. */
    readonly notifyLeader?: (request: ControlRequestRecord) => Promise<void>;
    /** Coordinator seam: when present, delivery goes through the latch. */
    readonly dispatchWake?: (input: {
        readonly rootSessionId: string;
        readonly reviewerInstanceId: string;
        readonly targetSessionId: string;
        readonly currentLegIds: readonly string[];
    }) => Promise<void>;
}): ControlRequestNotificationPort;
/** One wake for a group of delegable pending legs; every id stays visible. */
export declare function renderMergedOfficerReviewWake(requests: readonly ControlRequestRecord[]): string;
export interface Alpha6DelegableLegsInput {
    readonly rootSessionId: string;
    readonly reviewerInstanceId: string;
    /** The already-trusted leg that triggered this read (included verbatim). */
    readonly seed?: ControlRequestRecord;
    readonly readRequests: (rootSessionId: string) => Promise<readonly ControlRequestRecord[]>;
    readonly reviewFacts: (query: AssignedOfficerReviewFactsQuery) => Promise<AssignedOfficerReviewFacts | null>;
    readonly resolveCurrentReviewer: (query: {
        readonly rootSessionId: string;
        readonly approvalCaseId: string;
        readonly currentLegRequestId: string;
        readonly legOrdinal: number;
    }) => Promise<{
        readonly instanceId: string;
    } | null>;
    /** The ONE shared router decision, when the caller has it. */
    readonly route?: (requestId: string, rootSessionId?: string) => Promise<ReviewRoute | null>;
}
/**
 * The ONE trusted pending-leg collector used by the notifier and by the Host
 * turn-end rescan. Every candidate is filtered by the same facts port and the
 * same reviewer resolution; nothing here decides authority.
 */
export declare function collectAlpha6DelegableLegs(input: Alpha6DelegableLegsInput): Promise<ControlRequestRecord[]>;
//# sourceMappingURL=notifier.d.ts.map