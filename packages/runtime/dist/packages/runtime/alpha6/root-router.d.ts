/**
 * Alpha.6 — the ROOT-side trusted router input builder.
 *
 * The notification layer must never equate "the unique live Officer" with
 * "the reviewer of this leg". Leader exceptions, Officer self-asks, fixed
 * Leader/Human categories, current-leg transfers and availability states are
 * all decided by the ONE shared `routeReview` policy. This module turns the
 * durable Control row + live member rows into that policy's input; it decides
 * nothing itself.
 *
 * @module packages/runtime/alpha6/root-router
 */
import type { ReviewRouting } from '../../domain/blueprint/src/index.js';
import type { ControlRequestRecord, ControlStateSnapshot } from '../control/types.js';
import type { ReviewRoute } from '../review-router/index.js';
import type { AssignedOfficerMemberSnapshot } from './assigned-officer-facts.js';
export interface Alpha6RootRouting {
    readonly routing: ReviewRouting;
    readonly leaderTemplateId: string;
}
export interface Alpha6RootRouterInput {
    readonly rootSessionId: string;
    readonly routing: ReviewRouting;
    readonly leaderTemplateId: string;
    /**
     * The frozen v5 policy of a CREATED team root. Null refuses that root: the
     * boot policy is never reused for a root whose own Blueprint cannot be
     * resolved. Absent preserves the single-root/test composition.
     */
    readonly routingForRoot?: (rootSessionId: string) => Alpha6RootRouting | null;
    readonly control: {
        readonly readControlState: (rootSessionId: string) => Promise<ControlStateSnapshot>;
    };
    readonly members: {
        readonly list: (rootSessionId: string) => Promise<readonly AssignedOfficerMemberSnapshot[]> | readonly AssignedOfficerMemberSnapshot[];
    };
    readonly fixedLeaderOrHumanCategory: (input: {
        readonly kind: ControlRequestRecord['kind'];
        readonly rootSessionId?: string;
        readonly routing?: ReviewRouting;
    }) => boolean | null | Promise<boolean | null>;
}
export interface Alpha6RootRouter {
    /**
     * Route ONE durable leg; null when the row is absent/not a case leg.
     * `rootSessionId` is the REQUEST's team root (a created team may differ
     * from the boot root this composition was constructed under).
     */
    readonly route: (requestId: string, rootSessionId?: string) => Promise<ReviewRoute | null>;
}
export declare function createAlpha6RootRouter(input: Alpha6RootRouterInput): Alpha6RootRouter;
export type { ReviewRoute };
//# sourceMappingURL=root-router.d.ts.map