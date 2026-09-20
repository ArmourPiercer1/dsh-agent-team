/**
 * Strict-read + Core-spill — the opaque-identity digests.
 *
 * The DSH fs seams hand out OPACUE tokens (`FsTargetKey`, `FsVersion`):
 * branded strings whose format the consumer must never parse (they may
 * embed paths, inodes, or anything backend-specific). The grant stores
 * a DOMAIN-SEPARATED SHA-256 digest of each token so that:
 *
 * - a grant can never be satisfied by comparing raw tokens across
 *   backends or versions (digest = identity, token = transport);
 * - the two token kinds can never alias each other (separate domains);
 * - digests are stable, lossless-in-practice (collisions are
 *   cryptographically infeasible), and safe to persist in the ledger
 *   payload (no raw token — and therefore no raw path — ever enters a
 *   durable Team fact).
 *
 * The domain constants are the implementation guide §2.2 values; the
 * format is `sha256:<64 hex>` (lowercase).
 *
 * Pure module: `node:crypto` hashing only — no fs, no network, no
 * plugin globals.
 * @module @dsh-agent-team/runtime/artifact-read/digest
 */
/** Digest domain for the opaque fs TARGET-KEY token (identity). */
export declare const TARGET_KEY_DIGEST_DOMAIN = "dsh-agent-team/artifact-target-key/v1";
/** Digest domain for the opaque fs VERSION token (freshness). */
export declare const VERSION_DIGEST_DOMAIN = "dsh-agent-team/artifact-version/v1";
/**
 * The grant-side digest of an opaque fs targetKey (identity).
 * @param rawTargetKey - the opaque `FsTargetKey` string (never parsed).
 */
export declare function targetKeyDigest(rawTargetKey: string): string;
/**
 * The grant-side digest of an opaque fs version token (freshness).
 * @param rawVersion - the opaque `FsVersion` string (never parsed).
 */
export declare function versionDigest(rawVersion: string): string;
/**
 * Type guard: the value is a well-formed digest (`sha256:<64 hex>`).
 * Used by the fact parser to reject malformed durable rows.
 * @param value - the unknown input.
 */
export declare function isDigest(value: unknown): value is string;
//# sourceMappingURL=digest.d.ts.map