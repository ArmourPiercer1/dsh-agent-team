/**
 * The TeamDomain SessionBinding integrity layer (TaskDoc §11.5 P4-T3).
 *
 * Built ON TOP of the P4-T1 store repositories (`session_bindings`,
 * `member_instances`, `team_sessions`) with no new storage surface:
 *
 * - `diagnostics` — the closed v1 binding-integrity diagnostic vocabulary
 *   (typed RESULTS, never rewrites: a self-contradictory TeamDomain fails
 *   closed, Architecture §15.3);
 * - `binding-service` — `SessionBindingService`: the cold-hydration
 *   resolve query (ordinary / team-root / team-member / unbound,
 *   Architecture §36.1) plus the cross-record creation rules (a team-root
 *   binding requires an existing TeamSession; a team-member binding
 *   requires the MemberInstanceRecord and never re-points the durable
 *   child, invariant 24 — which keeps ordinary forks team-free,
 *   Architecture §35.3);
 * - `reconciler` — `reconcileTeamBindings`: the bidirectional integrity
 *   check (Architecture §15.3) with orphan / missing / wrong-root /
 *   duplicate-claim diagnostics (Development Plan §17.4).
 *
 * No module in this package imports any host backend or live Agent: the
 * repositories (and through them the injected storage seam) are the only
 * state boundary, and tests exercise them against the in-memory fake
 * seam.
 *
 * @module @dsh-agent-team/storage/bindings
 */

export {
  BINDING_DIAGNOSTIC_CODES,
  BINDING_DIAGNOSTIC_CODE_VALUES,
  isBindingDiagnosticCode,
  createBindingDiagnostic,
} from './diagnostics.js'
export type { BindingDiagnostic, BindingDiagnosticCode } from './diagnostics.js'

export { SessionBindingService } from './binding-service.js'
export type { BindingResolution } from './binding-service.js'

export { reconcileTeamBindings } from './reconciler.js'
export type { TeamBindingReconciliationReport } from './reconciler.js'
