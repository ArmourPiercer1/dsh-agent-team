/**
 * P8-T2 Projection Service — the read-service facade
 * (TaskDoc §11.9 P8-T2; DevPlan §21.2).
 *
 * {@link createProjectionService} wires the two read ports to the pure fold:
 *
 * ```text
 * teamSessionId
 *   → domain.readProjectionSource(teamSessionId)   (durable TeamDomain, §21.2)
 *   → overlay?.snapshot()                          (optional live overlay, UI §24)
 *   → projectTeam(source, overlaySnapshot, clock()) (the pure fold, fold.ts)
 *   → TeamProjectionDto
 * ```
 *
 * The service is the ONLY place that reads: it materializes the live overlay
 * snapshot ONCE per projection (a fresh read of the current live state) and
 * stamps the produced-at time from the injected clock. The fold itself is
 * pure (no I/O, no clock, no global). The generation is the durable one —
 * the live overlay never affects it, so the projection's generation makes
 * stale-overwrite detection possible downstream (DevPlan §21.4).
 *
 * There is no mutation path: the service reads the durable authority and the
 * read-only overlay and produces an immutable DTO. It does not write, does
 * not scan session logs, and does not touch the (ephemeral) SessionController
 * Team mirror.
 *
 * Pure module: no I/O, no `node:` builtins (the optional default clock uses
 * the ambient `Date`, as any host-side produced-at stamp must).
 * @module @dsh-agent-team/runtime/projection/service
 */
import { projectTeam } from './fold.js';
/** The host-side default clock (ambient `Date`, host runtime only). */
const DEFAULT_CLOCK = () => new Date().toISOString();
/**
 * Create a whole-projection read service over the given read ports.
 *
 * @param domain - the read-only TeamDomain source port (the durable
 *   authority, invariant 41; the §21.2 no-log red line is enforced by the
 *   port exposing no log surface).
 * @param overlay - the read-only live residency/activity overlay port, or
 *   `null` for a cold service (every projection is durable-only: all
 *   `liveActivity` are `null`).
 * @param options - optional service configuration (the produced-at clock).
 * @returns the read service.
 */
export function createProjectionService(domain, overlay, options = {}) {
    const clock = options.clock ?? DEFAULT_CLOCK;
    const schemaVersion = options.schemaVersion === 2 ? 2 : 1;
    return {
        project(teamSessionId) {
            const source = domain.readProjectionSource(teamSessionId);
            // A fresh live overlay snapshot per projection (the current live state);
            // `null` for a cold service. The fold treats `null` as "no live facts".
            const overlaySnapshot = overlay === null ? null : overlay.snapshot();
            return projectTeam(source, overlaySnapshot, clock(), schemaVersion);
        },
    };
}
//# sourceMappingURL=service.js.map