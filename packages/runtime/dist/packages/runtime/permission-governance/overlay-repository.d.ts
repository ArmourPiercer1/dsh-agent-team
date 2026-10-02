/**
 * The runtime wiring of the PermissionOverlay port (Alpha.3 PR1).
 *
 * A thin adapter: it turns the durable {@link PermissionOverlayRepository}
 * (the storage package's append-only snapshot store) into the
 * {@link PermissionOverlayRepositoryPort} the governance layer consumes. It
 * adds no policy, no interpretation and no extra capability — the member set
 * stays exactly `append` / `latest` / `history`, which is what keeps the port
 * from being an alternative write path around the future
 * `GovernanceMutationService` (ADR §1).
 *
 * ## Where the persistence-boundary validation lives
 *
 * The structural gate — the ADR §2 section anatomy, the closed field sets,
 * the id grammars, the generation shape, the `previousSnapshotId` chain
 * shape, the provenance shapes — is enforced by the durable store itself
 * (`storage/schema/permission-overlay.ts` through
 * `storage/repositories/permission-overlays.ts#append`), so it holds for
 * EVERY caller of the store and cannot be skipped by choosing a different
 * entry point. This adapter therefore does not re-implement it; duplicating
 * the gate here would create a second place for the same rules to drift.
 *
 * The generation CAS (`generation-conflict`,
 * `previous-snapshot-id-mismatch`, `predecessor-not-durable`) is likewise
 * enforced once, at that boundary.
 *
 * ## What is intentionally absent
 *
 * No resolver, no `EffectivePermissionAssembler` (PR2), no
 * `GovernanceMutationService` / `PermissionMutation` / `MutationEnvelope`
 * (PR3), no grant/revoke/lifecycle (PR4), no notification or read projection
 * (PR5). Nothing in this module is wired into a tool, remote method, control
 * request, admission path or lifecycle transition: PR1 enables NO runtime
 * dynamic permission execution.
 *
 * @module @dsh-agent-team/runtime/permission-governance/overlay-repository
 */
import type { PermissionOverlayRepository } from '../../storage/repositories/permission-overlays.js';
import type { PermissionOverlayRepositoryPort } from './port.js';
/** The dependencies of the overlay port. */
export interface CreatePermissionOverlayRepositoryPortArgs {
    /**
     * The durable append-only snapshot store, opened by the caller
     * (`openPermissionOverlayStore`). The port holds no seam handle of its own
     * and cannot open, reopen or close the medium.
     */
    readonly repository: PermissionOverlayRepository;
}
/**
 * Build the {@link PermissionOverlayRepositoryPort} over one opened durable
 * store.
 * @param args - the durable store to persist through.
 * @returns an object exposing `append`, `latest` and `history` and nothing
 *   else: no authority, envelope, mutation, resolver, lifecycle or
 *   notification member.
 */
export declare function createPermissionOverlayRepositoryPort(args: CreatePermissionOverlayRepositoryPortArgs): PermissionOverlayRepositoryPort;
//# sourceMappingURL=overlay-repository.d.ts.map