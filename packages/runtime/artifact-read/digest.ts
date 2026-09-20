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

import { createHash } from 'node:crypto'

/** Digest domain for the opaque fs TARGET-KEY token (identity). */
export const TARGET_KEY_DIGEST_DOMAIN = 'dsh-agent-team/artifact-target-key/v1'

/** Digest domain for the opaque fs VERSION token (freshness). */
export const VERSION_DIGEST_DOMAIN = 'dsh-agent-team/artifact-version/v1'

/** The digest format: algorithm tag + 64 lowercase hex chars. */
const DIGEST_PATTERN = /^sha256:[0-9a-f]{64}$/

/**
 * Domain-separated SHA-256 of a raw token.
 * @param domain - the digest domain (one of the two constants).
 * @param raw - the opaque token string.
 * @returns `sha256:<hex>`.
 */
function sha256Domain(domain: string, raw: string): string {
  const hash = createHash('sha256')
  // NUL separator: a domain can never bleed into the token prefix
  // (domains contain no NUL, tokens are single strings).
  hash.update(domain, 'utf8')
  hash.update('\u0000', 'utf8')
  hash.update(raw, 'utf8')
  return `sha256:${hash.digest('hex')}`
}

/**
 * The grant-side digest of an opaque fs targetKey (identity).
 * @param rawTargetKey - the opaque `FsTargetKey` string (never parsed).
 */
export function targetKeyDigest(rawTargetKey: string): string {
  return sha256Domain(TARGET_KEY_DIGEST_DOMAIN, rawTargetKey)
}

/**
 * The grant-side digest of an opaque fs version token (freshness).
 * @param rawVersion - the opaque `FsVersion` string (never parsed).
 */
export function versionDigest(rawVersion: string): string {
  return sha256Domain(VERSION_DIGEST_DOMAIN, rawVersion)
}

/**
 * Type guard: the value is a well-formed digest (`sha256:<64 hex>`).
 * Used by the fact parser to reject malformed durable rows.
 * @param value - the unknown input.
 */
export function isDigest(value: unknown): value is string {
  return typeof value === 'string' && DIGEST_PATTERN.test(value)
}
