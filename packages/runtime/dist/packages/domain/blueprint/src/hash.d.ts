/**
 * Machine content identity for a TeamBlueprint.
 *
 * The domain is **closed**: no `node:` builtins are importable from `.ts`
 * (there is no `@types/node` in this workspace), so the content hash cannot
 * be taken from `node:crypto`. Instead this module provides a self-contained,
 * deterministic SHA-256 over the UTF-8 bytes of the blueprint's canonical
 * JSON string (the canonical encoding from contracts v1, which sorts object
 * keys so the digest is independent of property-insertion order).
 *
 * Authority:
 * - Architecture §5.2 — a blueprint's identity is `blueprintId` (stable
 *   logical identity) + `revision` (human-readable) + `contentHash`
 *   (machine content identity). Filesystem path, workspace path, cwd,
 *   displayName and AgentPreset id must NOT define the identity.
 * - Architecture §5.6 — the immutable snapshot freezes Blueprint-owned
 *   semantics; the snapshot is identified by the triple above.
 *
 * The digest is a plain lowercase hex string; the published
 * `BlueprintContentHash` is prefixed `sha256:` so the algorithm is
 * self-describing on the wire. Both the bare hex and the prefixed form
 * satisfy the contracts `contentHash` string rule (non-empty, ≤256 chars,
 * no whitespace/control chars).
 *
 * Verified in tests against the NIST vector SHA-256("abc").
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/domain/blueprint/hash
 */
import type { BlueprintContentHash } from '../../../contracts/src/index.js';
/**
 * Compute the SHA-256 digest of a UTF-8 string as a 64-char lowercase hex
 * string.
 * @param message - the input string.
 * @returns the hex digest.
 */
export declare function sha256Hex(message: string): string;
/**
 * Derive the `BlueprintContentHash` for a validated blueprint.
 *
 * The hash is computed over the blueprint's **canonical** serialization
 * (contracts `canonicalJsonStringify`: keys sorted, arrays ordered) of the
 * hashable projection — the full semantic content with the derived
 * `contentHash` field itself excluded, so identity never depends on itself.
 *
 * @param hashable - a lossless-JSON projection of the blueprint content.
 * @returns the `sha256:<hex>` content hash, validated against contracts.
 */
export declare function deriveContentHash(hashable: unknown): BlueprintContentHash;
//# sourceMappingURL=hash.d.ts.map