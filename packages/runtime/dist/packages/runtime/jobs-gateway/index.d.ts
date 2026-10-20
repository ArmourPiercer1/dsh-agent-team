/**
 * `@dsh-agent-team/runtime/jobs-gateway` — the Alpha.5 PR7 lane (Lane F):
 * the DORMANT adaptation surface between the dispatch plane (PR1 Guard +
 * Scoped Dispatcher, PR1r pending-call cancellation) and the Web/Jobs view
 * (INTERFACES-v1 §C-GW / §C-BIND).
 *
 * DORMANT BY DESIGN: zero production consumers, no live wiring, no
 * registration into any assembly. The real stdio execution provider is
 * PR4's; this lane develops against the C-PROC-shaped fixture and consumes
 * the PR1r cancellation semantics as a documented contract fixture
 * (authority: `origin/alpha5-pr1r-residual-boundaries` @ bd6310ca). Per the
 * stack rule, what is verified here is "against the fixture/stack", never
 * "the whole chain".
 *
 * @module @dsh-agent-team/runtime/jobs-gateway
 */
export { jobOwnerKey, jobsBridgeScopeKey, gatewayRefusal, } from './types.js';
export type { JobOwner, GatewayIdentitySource, DispatchEvent, DispatchEventName, JobOutcome, JobOutcomeKind, GatewayRefusal, GatewayRefusalCode, } from './types.js';
export { createLeaseWindow } from './lease-window.js';
export type { LeaseWindow, LeaseWindowState, LeaseEndReason, LeaseToken } from './lease-window.js';
export { classifyDispatchEvent } from './cancellation-boundary.js';
export { createJobsGateway } from './jobs-gateway.js';
export type { JobsGateway, CreateJobsGatewayOptions, GatewayJobRecord, DefinitionIdentityProbe, GatewayObservation, } from './jobs-gateway.js';
export { projectJobForViewer, redactCredentials, REDACTION_MARKER } from './web-projection.js';
export type { WebJobView, ProjectionSource } from './web-projection.js';
//# sourceMappingURL=index.d.ts.map