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

import type { TeamProjectionDto, TeamSessionId } from '../../contracts/src/index.js'
import { projectTeam } from './fold.js'
import type {
  LiveResidencyOverlayPort,
  ProjectionClock,
  TeamDomainReadPort,
} from './types.js'

/** The whole-projection read service for one set of read ports. */
export interface ProjectionService {
  /**
   * Produce the whole projection for one TeamSession.
   * @param teamSessionId - the TeamSession id (root DSH session id).
   * @returns the frozen whole `TeamProjectionDto`.
   * @throws the frozen P8-T1 DTO contract error when the durable source is
   *   malformed, or a {@link ProjectionError} on a service-level invariant
   *   failure (see `errors.ts`).
   */
  project(teamSessionId: TeamSessionId): TeamProjectionDto
}

/** Optional configuration of {@link createProjectionService}. */
export interface ProjectionServiceOptions {
  /**
   * The clock producing the projection `generatedAt` stamp (ISO-8601).
   * Defaults to the ambient `Date` (host-side produced-at). Tests inject a
   * deterministic clock.
   */
  readonly clock?: ProjectionClock
  /**
   * The projection schema version to stamp (S7-R2): `2` for the additive
   * repair fields (R2-2..R2-6), `1` (default) for the frozen v1 shape.
   */
  readonly schemaVersion?: 1 | 2
}

/** The host-side default clock (ambient `Date`, host runtime only). */
const DEFAULT_CLOCK: ProjectionClock = () => new Date().toISOString()

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
export function createProjectionService(
  domain: TeamDomainReadPort,
  overlay: LiveResidencyOverlayPort | null,
  options: ProjectionServiceOptions = {},
): ProjectionService {
  const clock = options.clock ?? DEFAULT_CLOCK
  const schemaVersion: 1 | 2 = options.schemaVersion === 2 ? 2 : 1
  return {
    project(teamSessionId: TeamSessionId): TeamProjectionDto {
      const source = domain.readProjectionSource(teamSessionId)
      // A fresh live overlay snapshot per projection (the current live state);
      // `null` for a cold service. The fold treats `null` as "no live facts".
      const overlaySnapshot = overlay === null ? null : overlay.snapshot()
      return projectTeam(source, overlaySnapshot, clock(), schemaVersion)
    },
  }
}
