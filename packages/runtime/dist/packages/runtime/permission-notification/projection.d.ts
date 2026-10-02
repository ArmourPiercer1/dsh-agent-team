/**
 * Alpha.3 PR5 — the permission READ PROJECTION over the durable overlay
 * snapshots + their history audit (plan PR5; ADR §2 "History: audit only").
 *
 * The projection is a pure read surface with exactly two views, both
 * reached through the EXISTING access boundaries of the PR1 port:
 *
 * - {@link PermissionReadProjection.readAuthority} mirrors the CURRENT
 *   AUTHORITY (the highest-generation durable snapshot that `latest`
 *   returns — the port never folds or replays, and neither does the
 *   projection);
 * - {@link PermissionReadProjection.readHistoryAudit} mirrors the
 *   ascending audit rows of `history` — presented as audit, NEVER folded
 *   into an effective state (a fold would fork the read model away from
 *   the durable authority, which ADR §2 forbids for execution).
 *
 * Boundaries pinned by `test/a3p5-permission-read-projection.test.ts`:
 * - the injected port type is `Pick<PermissionOverlayRepositoryPort,
 *   'latest' | 'history'>` — `append` is not nameable here; the spec wraps
 *   the real port in a Proxy that THROWS on any member beyond the two, so
 *   the walk is pinned at runtime too;
 * - every returned view is a deep-frozen COPY: no caller can mutate a
 *   projection into a write, and the durable medium is never reached past
 *   the port;
 * - the projection answers questions, it decides nothing: nothing exported
 *   here is consumable as an authorization/decision/mutation input (the
 *   hygiene spec pins the closed export vocabulary and the import graph).
 *
 * @module @dsh-agent-team/runtime/permission-notification/projection
 */
import type { PermissionOverlayRepositoryPort } from '../permission-governance/port.js';
import type { PermissionReadProjection } from './types.js';
/** The projection factory dependencies. */
export interface CreatePermissionReadProjectionDeps {
    /**
     * The existing PR1 access boundaries, NARROWED by the type to the two
     * read members. `append` is structurally absent from this seam.
     */
    readonly overlay: Pick<PermissionOverlayRepositoryPort, 'latest' | 'history'>;
}
/**
 * Build the read projection over one durable overlay world.
 * @param deps - the two-member read seam.
 * @returns the two pure-read views; frozen outputs; zero writes; zero
 *   decision output.
 */
export declare function createPermissionReadProjection(deps: CreatePermissionReadProjectionDeps): PermissionReadProjection;
//# sourceMappingURL=projection.d.ts.map