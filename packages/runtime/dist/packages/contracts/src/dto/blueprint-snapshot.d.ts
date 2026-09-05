/**
 * BlueprintSnapshotRef — the immutable identity of the Blueprint snapshot a
 * TeamSession binds.
 *
 * Frozen Architecture facts (invariant numbers refer to Architecture §42):
 *
 * - **One TeamSession binds exactly one immutable Blueprint snapshot**
 *   (invariant 10, §8.4): once bound, the snapshot cannot be replaced in
 *   place; switching blueprints means a new TeamIntent / new Root Session.
 * - **The snapshot freezes Blueprint-owned semantics, not the external
 *   environment** (invariant 12).
 * - The snapshot is identified by `blueprintId` + `revision` +
 *   `contentHash` (§5.2); the display form is `blueprintId@revision`
 *   (e.g. `AIUED-ALGO@17`, §8.4).
 *
 * The snapshot ref is an embedded value: the enclosing versioned record
 * owns the schema version, so the ref carries none of its own.
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/contracts/dto/blueprint-snapshot
 */
import type { BlueprintContentHash, BlueprintId, BlueprintRevision } from '../ids/blueprint-id.js';
/** The exact frozen fields of a blueprint snapshot ref. */
export declare const BLUEPRINT_SNAPSHOT_FIELDS: readonly string[];
/**
 * The immutable identity of the Blueprint snapshot bound to one TeamSession
 * (Architecture §5.2, §8.4).
 */
export interface BlueprintSnapshotRef {
    /** Stable logical identity of the blueprint. */
    readonly blueprintId: BlueprintId;
    /** Human-readable revision (e.g. `17`). */
    readonly revision: BlueprintRevision;
    /** Machine content identity of the blueprint content. */
    readonly contentHash: BlueprintContentHash;
}
/**
 * Parse and validate a blueprint snapshot ref from an untrusted value.
 * @param value - the unknown input.
 * @returns the frozen snapshot ref.
 * @throws `MALFORMED_DTO` for a malformed container/field set,
 *   `LEGACY_MEMBER_ID_REJECTED` for legacy fields, and the id-specific
 *   codes for malformed components.
 */
export declare function parseBlueprintSnapshotRef(value: unknown): BlueprintSnapshotRef;
/**
 * Build a blueprint snapshot ref from already-validated components
 * (use the `parse*` id functions first).
 * @param input - the three snapshot components.
 * @returns the frozen snapshot ref.
 */
export declare function createBlueprintSnapshotRef(input: {
    blueprintId: BlueprintId;
    revision: BlueprintRevision;
    contentHash: BlueprintContentHash;
}): BlueprintSnapshotRef;
/**
 * The stable display/serialization form of a snapshot ref:
 * `blueprintId@revision` (the architecture's `AIUED-ALGO@17` form, §8.4).
 * Unambiguous because neither component may contain `@`.
 * @param ref - the snapshot ref.
 * @returns the `blueprintId@revision` string.
 */
export declare function blueprintSnapshotKey(ref: BlueprintSnapshotRef): string;
/**
 * Parse a `blueprintId@revision` display key back into its two components
 * (the content hash is not recoverable from the display form; pass it
 * separately when a full ref is needed).
 * @param key - the display key string.
 * @returns the parsed components.
 * @throws `MALFORMED_DTO` when the key is not exactly one `@`-separated pair,
 *   and the id-specific codes when a component is malformed.
 */
export declare function parseBlueprintSnapshotKey(key: string): {
    blueprintId: BlueprintId;
    revision: BlueprintRevision;
};
//# sourceMappingURL=blueprint-snapshot.d.ts.map