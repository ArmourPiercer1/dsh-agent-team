/**
 * Fingerprint computation for the compatibility engine.
 *
 * The environment fingerprint is a stable identity for the *relevant*
 * environment facts (Architecture §14.3 E: "current compatibility
 * facts/fingerprint —staleness/generation"; §27.3: an acknowledgement binds
 * to a "requirement fingerprint" + "capability/environment fingerprint").
 * Two evaluations whose fingerprints differ observe a different environment
 * generation, so the earlier result —and every acknowledgement bound to it — * is stale and must not be trusted (drift invalidation).
 *
 * The algorithm is pure, deterministic, and dependency-free: two independent
 * FNV-1a-style 32-bit passes (different bases) over the canonical JSON of the
 * probe records. Canonical JSON (contracts `canonicalJsonStringify`) sorts
 * keys, so the fingerprint is independent of property-insertion order; the
 * probe records are sorted by (domain, subject), so it is also independent of
 * input array order. No hashing builtin (node:crypto) is used —the domain
 * package must stay pure ES2022.
 *
 * Authority: Architecture §14.3 E, §27.3, §28; Development Plan §16.2
 * Compatibility ("ack fingerprint"); TaskDoc §11.4 P3-T5 ("environment
 * fingerprint bound to the result; any drift invalidates the previous
 * result").
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/domain/compatibility/fingerprint
 */

import { canonicalJsonStringify } from '../../../contracts/src/index.js'
import type { RemoteSafeJsonValue } from '../../../contracts/src/index.js'

/** Version tag embedded in every emitted fingerprint (`fp-v1:<32 hex>`). */
export const FINGERPRINT_ALGORITHM_VERSION = 'v1'

/**
 * Probe-absence sentinel generation. A required (domain, subject) with no
 * environment fact at all is a probe that never ran; encoding it as
 * generation -1 keeps "never probed" distinguishable from "probed at
 * generation 0" in the fingerprint.
 */
export const NO_PROBE_GENERATION = -1

/** Standard FNV-1a 32-bit offset basis. */
const FNV_OFFSET_BASIS = 0x811c9dc5

/** Second independent basis (the FNV prime), for a second 32-bit pass. */
const FNV_SECOND_BASIS = 0x01000193

/** FNV-1a 32-bit prime. */
const FNV_PRIME = 0x01000193

/**
 * One 32-bit FNV-1a-style pass over a UTF-16 string. Each code unit is
 * folded in as two bytes (low then high) so non-ASCII subjects influence the
 * hash deterministically.
 * @param basis - the starting hash value.
 * @param text - the input text.
 * @returns 8 lowercase hex characters.
 */
function fnv1a32Hex(basis: number, text: string): string {
  let hash = basis >>> 0
  for (let i = 0; i < text.length; i += 1) {
    const code = text.charCodeAt(i)
    hash ^= code & 0xff
    hash = Math.imul(hash, FNV_PRIME) >>> 0
    hash ^= (code >>> 8) & 0xff
    hash = Math.imul(hash, FNV_PRIME) >>> 0
  }
  return hash.toString(16).padStart(8, '0')
}

/**
 * Compute a stable fingerprint of a lossless-JSON value.
 *
 * @param value - the value to fingerprint (typically the probe-record set).
 * @returns `fp-v1:<8 hex><8 hex>` —deterministic for a given value.
 */
export function computeFingerprint(value: RemoteSafeJsonValue): string {
  const text = canonicalJsonStringify(value)
  return `fp-${FINGERPRINT_ALGORITHM_VERSION}:${fnv1a32Hex(FNV_OFFSET_BASIS, text)}${fnv1a32Hex(FNV_SECOND_BASIS, text)}`
}
