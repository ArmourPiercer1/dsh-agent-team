/**
 * Alpha.6 PR1 — deterministic `ReviewRouter`.
 *
 * It reads one current leg and returns a recipient/hold/no-work/unroutable
 * decision. It never mutates a case, never writes a wake, never mints a
 * Grant and never calls ControlService. The pure boundary is deliberate:
 * PR2c supplies current-leg/transfer facts from the durable service, and PR4
 * delivers the resulting wake.
 *
 * @module @dsh-agent-team/runtime/review-router/router
 */
import type { ReviewRoute, ReviewRouteInput } from './types.js';
/**
 * Route exactly one current leg. Priority is the frozen design §3.2 order:
 * terminal/no-work -> human -> fixed Leader -> transfer -> self-ask -> Leader
 * exception -> unavailable/ambiguous officer -> ordinary delegation.
 */
export declare function routeReview(input: ReviewRouteInput): ReviewRoute;
//# sourceMappingURL=router.d.ts.map