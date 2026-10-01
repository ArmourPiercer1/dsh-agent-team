/**
 * The PermissionOverlaySnapshot vocabulary of the governance layer
 * (Alpha.3 PR1; ADR §2).
 *
 * The record itself is a TeamDomain-owned durable row, so its single
 * definition lives in `storage/schema/permission-overlay.ts` — this module
 * re-exports the vocabulary the runtime consumes, so callers of the overlay
 * port never import the storage package to name a type. Re-export (not
 * re-declaration) is deliberate: two definitions of the overlay record would
 * drift, and the durable shape is the authority.
 *
 * PR1 scope (implementation plan "Do NOT add"): no resolver logic, no
 * notification, no UI, no `EffectivePermissionAssembler`, no
 * `GovernanceMutationService`, no `MutationEnvelope`, no lifecycle or
 * inheritance behavior. This package is the durable foundation only.
 *
 * @module @dsh-agent-team/runtime/permission-governance/types
 */
export { PERMISSION_OVERLAY_EFFECT_VALUES, PERMISSION_OVERLAY_MAX_RULES, PERMISSION_OVERLAY_SCHEMA_VERSION, PERMISSION_OVERLAY_STORE, isPermissionOverlayEffect, permissionOverlaySnapshotKey, } from '../../storage/schema/permission-overlay.js';
//# sourceMappingURL=types.js.map