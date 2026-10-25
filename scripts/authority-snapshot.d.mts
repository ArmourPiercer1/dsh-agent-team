/**
 * The type surface for `authority-snapshot.mjs`, following the repository convention for a
 * `.mjs` tool that a TypeScript test imports (sibling `.d.mts`; precedent:
 * `scripts/ci-pr-gate.d.mts`). Only what the importing tests use is declared; nothing is
 * widened to `any`.
 */

/** Path of the frozen snapshot schema (dev/engineering/authority-snapshot.schema.json). */
export declare const FROZEN_SCHEMA_PATH: string
/** Repo-relative directory of published immutable snapshots. */
export declare const SNAPSHOT_DIR_REL: string

export declare function loadFrozenSchema(path?: string): Record<string, unknown>

/** F0 canonical serialization: recursively key-sorted, compact, raw non-ASCII, no 0x0A. */
export declare function canonicalBytes(obj: unknown): Buffer

/** `sha256:<lowercase hex>` over the F0 canonical bytes of the whole object. */
export declare function canonicalDigest(obj: unknown): string

/** `sha256:<lowercase hex>` over the F0 canonical bytes of the snapshot MINUS content_digest. */
export declare function snapshotDigest(snapshot: unknown): string

export interface ShapeResult { ok: boolean; errors: string[] }

export declare function validateShape(obj: unknown, schema?: Record<string, unknown>): ShapeResult
export declare function checkSnapshotObject(obj: unknown, schema?: Record<string, unknown>): ShapeResult
