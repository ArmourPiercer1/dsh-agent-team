/**
 * P8-T2 Projection Service — module barrel (TaskDoc §11.9 P8-T2;
 * DevPlan §21).
 *
 * The whole-projection read service:
 *
 * - `types.ts`  — the two read ports (bounded TeamDomain source + optional
 *   live overlay) and the durable projection source vocabulary;
 * - `errors.ts` — the closed service-level error-code vocabulary (the
 *   field-level / cross-field malformed-input surface is the frozen P8-T1
 *   DTO's);
 * - `ledger.ts` — the ledger-summary fold (a separate concern; ledger
 *   pagination is NOT part of the projection fold);
 * - `fold.ts`   — the pure whole-projection fold (`projectTeam`);
 * - `service.ts`— the read-service facade wiring the ports to the fold.
 *
 * The module produces a frozen `TeamProjectionDto` (P8-T1 contract,
 * consumed read-only from `../../contracts`) from the durable TeamDomain
 * (invariant 41) plus an optional live overlay (DevPlan §21.2) — and by
 * construction NEVER scans `Root + all child Session logs` (the port has no
 * log read surface), so the projection's complexity is independent of child
 * Session log volume.
 *
 * @module @dsh-agent-team/runtime/projection
 */
export type { DurableLedgerSummary, DurableMemberRow, DurableTemplateRow, LiveResidencyOverlayPort, ProjectionClock, TeamDomainProjectionSource, TeamDomainReadPort, TeamRootFacts, } from './types.js';
export { PROJECTION_ERROR_CODES, ProjectionError, isProjectionError, } from './errors.js';
export type { ProjectionErrorCode } from './errors.js';
export { projectLedgerSummary } from './ledger.js';
export { projectTeam } from './fold.js';
export { createProjectionService } from './service.js';
export type { ProjectionService, ProjectionServiceOptions } from './service.js';
//# sourceMappingURL=index.d.ts.map