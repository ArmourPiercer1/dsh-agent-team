/**
 * permission-governance — the Alpha.3 Dynamic Permission Governance
 * foundation package (PR1 "PermissionOverlay Foundation").
 *
 * The Alpha.3 implementation plan splits the capability into five PRs; this
 * package contains PR1 and nothing else:
 *
 *   PR1 (this)  the durable PermissionOverlaySnapshot vocabulary, the
 *               persistence-only repository port, the durable store schema
 *               (append-only FULL snapshots, current authority = the
 *               highest generation, history audit-only, no event replay) and
 *               the generation / previousSnapshotId / provenance gate at the
 *               persistence boundary;
 *   PR2         EffectivePermissionAssembler (the runtime, NOT here);
 *   PR3         GovernanceMutationService, PermissionMutation,
 *               MutationEnvelope — the sole permission mutation authority
 *               (ADR §1: every mutation flows through it, never around it);
 *   PR4         grant/revoke/restore lifecycle;
 *   PR5         notification and the read projection.
 *
 * PR1 explicitly does NOT add (plan "Do NOT add"): resolver logic,
 * notification, UI, `EffectivePermissionAssembler`, `GovernanceMutationService`,
 * `MutationEnvelope`, or lifecycle/inheritance behavior. Nothing here is
 * wired into a tool, remote method, control request, admission path or
 * lifecycle transition, so PR1 enables no runtime dynamic permission
 * execution: the durable foundation exists and is tested, the capability is
 * not switched on.
 *
 * The one write path stays the one write path: when PR3 lands, the chain is
 * `Leader/Human request -> GovernanceMutationService -> this port -> durable
 * store` (ADR §1), and this port remains persistence-only — no authority
 * validation, no envelope checks, no bypass of mutation serialization, and
 * no alternative write path.
 *
 * @module @dsh-agent-team/runtime/permission-governance
 */
export type { PermissionOverlayRepositoryPort } from './port.js';
export type { CreatePermissionOverlayRepositoryPortArgs } from './overlay-repository.js';
export { createPermissionOverlayRepositoryPort } from './overlay-repository.js';
export type { PermissionOverlayEffect, PermissionOverlayIdentity, PermissionOverlayMetadata, PermissionOverlayProvenance, PermissionOverlayRule, PermissionOverlaySnapshot, PermissionOverlaySnapshotInput, PermissionOverlayState, } from './types.js';
export { PERMISSION_OVERLAY_EFFECT_VALUES, PERMISSION_OVERLAY_MAX_RULES, PERMISSION_OVERLAY_SCHEMA_VERSION, PERMISSION_OVERLAY_STORE, isPermissionOverlayEffect, permissionOverlaySnapshotKey, } from './types.js';
//# sourceMappingURL=index.d.ts.map