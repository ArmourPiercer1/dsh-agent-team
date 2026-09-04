/**
 * P7-T5 Start Team from Here — the one-shot handoff facade
 * (TaskDoc §11.8 P7-T5; DevPlan §20.5; Architecture §34).
 *
 * The frozen flow (DevPlan §20.5):
 *
 * ```text
 * ordinary Session A
 * → freeze canonical surface
 * → one-shot summary
 * → new TeamIntent
 * → new Root B
 * ```
 *
 * B gains NO live history/search on A (Architecture §34.3): the handoff
 * is a one-shot context, never a cross-session memory link.
 *
 * Composition:
 *   - `types.ts`  — the port + record vocabulary (the closed contract)
 *   - `errors.ts` — the closed handoff error-code vocabulary
 *   - `service.ts`— the one-shot orchestration (snapshot once →
 *     one-shot summary → delegated team creation; the explicit §34.4
 *     failure triad; the target-side source-history guard)
 *
 * The module owns no MemberInstance/TeamSession creation path of its
 * own: team creation is delegated to the injected public Team creation
 * entry (the P6-T1 ActivationProvider public entry in production), and
 * the committed static scan `packages/runtime/test/p7t5-no-creation-
 * scan.mjs` proves on every run that the module source imports no
 * creation path.
 */

export { HANDOFF_DECISION_OPTIONS } from './types.js'
export type {
  HandoffContext,
  HandoffDecisionOption,
  HandoffFailure,
  HandoffOperationRef,
  HandoffOperationState,
  HandoffOperationView,
  HandoffPorts,
  HandoffProvenance,
  HandoffSourceSurfacePort,
  HandoffSummary,
  HandoffSummarizerPort,
  HandoffTeamCreationPort,
  HandoffTeamIntent,
  SourceCanonicalMessage,
  SourceCanonicalSurface,
  SourceHistoryQuery,
  StartTeamFromHereRequest,
  TeamCreationOutcome,
} from './types.js'

export {
  HANDOFF_ERROR_CODES,
  HANDOFF_ERROR_CODE_VALUES,
  HandoffError,
  isHandoffError,
} from './errors.js'
export type { HandoffErrorCode } from './errors.js'

export { createHandoffService } from './service.js'
export type { HandoffService } from './service.js'
