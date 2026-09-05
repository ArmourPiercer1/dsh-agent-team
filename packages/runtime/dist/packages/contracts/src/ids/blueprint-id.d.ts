/**
 * Blueprint identity contract: the stable identity of a TeamBlueprint and
 * of the immutable snapshot a TeamSession binds.
 *
 * Frozen Architecture facts (invariant numbers refer to Architecture §42):
 *
 * - **Blueprint identity** (§5.2): `blueprintId` (stable logical identity)
 *   + `revision` (human-readable) + `contentHash` (machine content
 *   identity). Filesystem path, workspace path, cwd, displayName, and
 *   AgentPreset id must NOT define blueprint identity; moving a blueprint
 *   file or renaming its display name must not change `blueprintId`.
 * - **One TeamSession binds exactly one immutable Blueprint snapshot**
 *   (invariant 10, §8.4): the binding cannot be replaced in place —
 *   `AIUED-ALGO@17` cannot become `AIEO@4` (the `blueprintId@revision`
 *   display form used in the architecture text).
 * - **A valid blueprint contains exactly one complete LeaderTemplate**
 *   (invariant 13) — that validation is the P3-T2 domain's job; this module
 *   freezes only the identity fields.
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/contracts/ids/blueprint-id
 */
import type { Brand } from './brand.js';
/** Structural max length of a blueprint id. */
export declare const BLUEPRINT_ID_MAX_LENGTH = 128;
/** Structural max length of a human-readable blueprint revision. */
export declare const BLUEPRINT_REVISION_MAX_LENGTH = 64;
/** Structural max length of a blueprint content hash. */
export declare const BLUEPRINT_CONTENT_HASH_MAX_LENGTH = 256;
/**
 * The stable logical identity of a TeamBlueprint.
 *
 * Not a filesystem path, not a display name, not an AgentPreset id
 * (Architecture §5.2). `@` is reserved (it delimits the
 * `blueprintId@revision` snapshot display form, §8.4) and is forbidden.
 */
export type BlueprintId = string & Brand<'BlueprintId'>;
/** Human-readable blueprint revision (e.g. `17` in `AIUED-ALGO@17`). */
export type BlueprintRevision = string;
/** Machine content identity of the blueprint content. */
export type BlueprintContentHash = string;
/**
 * Parse and validate a blueprint id.
 * @param raw - the unknown input.
 * @returns the branded `BlueprintId`.
 * @throws `INVALID_BLUEPRINT_ID` when the value is empty, over 128 chars,
 *   contains control characters or whitespace, or contains the reserved `@`.
 */
export declare function parseBlueprintId(raw: unknown): BlueprintId;
/**
 * Parse and validate a human-readable blueprint revision.
 * @param raw - the unknown input.
 * @returns the revision string.
 * @throws `INVALID_BLUEPRINT_REVISION` when the value is empty, over 64
 *   chars, contains control characters or whitespace, or contains `@`.
 */
export declare function parseBlueprintRevision(raw: unknown): BlueprintRevision;
/**
 * Parse and validate a blueprint content hash.
 * @param raw - the unknown input.
 * @returns the content hash string.
 * @throws `INVALID_BLUEPRINT_CONTENT_HASH` when the value is empty, over
 *   256 chars, or contains control characters or whitespace.
 */
export declare function parseBlueprintContentHash(raw: unknown): BlueprintContentHash;
/** Type guard for the blueprint id rule. */
export declare function isBlueprintId(raw: unknown): raw is BlueprintId;
//# sourceMappingURL=blueprint-id.d.ts.map