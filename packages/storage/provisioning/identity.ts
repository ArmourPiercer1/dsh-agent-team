/**
 * Deterministic identity helpers for the provisioning state machine
 * (TaskDoc §11.5 P4-T4).
 *
 * The frozen operation row key is `op-<1..32 [a-z0-9]>` (P4-T1
 * `OPERATION_ID_PATTERN`) and the operations store is GLOBAL across teams
 * (the journal is team-scoped, but the row key is not). A member's
 * operation identity therefore must incorporate BOTH components of the
 * member runtime identity (invariant 18: `(rootSessionId, instanceId)`) so
 * that the same instance id under two different teams never collides in the
 * global operations store.
 *
 * Session ids are opaque (up to 255 chars) and cannot be concatenated into
 * the 32-char operation suffix, so a SHORT DETERMINISTIC TOKEN of the
 * identity is used. The token is a base36 (i.e. `[a-z0-9]`) rendering of an
 * iterated FNV-1a 32-bit hash: pure, dependency-free (no `node:` builtin,
 * no `crypto`), stable across processes and restarts, and collision-safe
 * for the identity space of one TeamSession.
 *
 * These helpers are the ONLY place the operation/idempotency identity is
 * derived: the coordinator (and the tests) must go through them so that a
 * re-drive of the same logical provisioning ALWAYS reconstructs the same
 * durable identity (Architecture §18.2 stable operation identity).
 *
 * Pure module: no I/O.
 * @module @dsh-agent-team/storage/provisioning/identity
 */

import { parseInstanceId, parseRootSessionId } from '../../contracts/src/index.js'

/** The base36 alphabet (exactly the `[a-z0-9]` charset the id patterns allow). */
const BASE36 = '0123456789abcdefghijklmnopqrstuvwxyz'

/** The FNV-1a 32-bit prime. */
const FNV_PRIME = 0x01000193
/** The FNV-1a 32-bit offset basis. */
const FNV_OFFSET = 0x811c9dc5

/**
 * One 32-bit FNV-1a pass over `s`, seeded with `seed ^ FNV_OFFSET`,
 * returned as an unsigned 32-bit integer.
 */
function fnv1a32(s: string, seed: number): number {
  let h = (seed ^ FNV_OFFSET) >>> 0
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i) & 0xff
    h = Math.imul(h, FNV_PRIME) >>> 0
  }
  return h >>> 0
}

/**
 * Encode an unsigned 32-bit integer as exactly `width` base36 characters
 * (zero-padded on the left, most-significant digit first).
 */
function base36Encode32(value: number, width: number): string {
  let out = ''
  let n = value >>> 0
  for (let k = 0; k < width; k++) {
    out = BASE36.charAt(n % 36) + out
    n = Math.floor(n / 36)
  }
  return out
}

/**
 * A deterministic `[a-z0-9]` token of `s`: the concatenation of several
 * FNV-1a passes (different seeds) rendered in base36, truncated to
 * `length`. Pure and stable; NOT cryptographic (identity disambiguation
 * only, within one TeamSession's member space).
 * @param s - the string to tokenize.
 * @param length - the token length (must be >= 1 and <= 56 for this scheme).
 */
export function deterministicToken(s: string, length: number): string {
  if (length < 1 || length > 56) {
    throw new RangeError(`deterministicToken: length must be in [1,56], got ${length}`)
  }
  let out = ''
  // 7 passes x 7 base36 chars = 49 chars available; up to 56 needs 8 passes.
  const passes = Math.ceil(length / 7)
  for (let seed = 0; seed < passes && out.length < length; seed++) {
    out += base36Encode32(fnv1a32(s, seed), 7)
  }
  return out.slice(0, length)
}

/**
 * The durable operation id of one member provisioning: `op-` + a
 * deterministic 24-char token of the member runtime identity
 * `(rootSessionId, instanceId)`. Incorporating the root prevents cross-team
 * collision in the global operations store.
 * @param rootSessionId - the team (root session id).
 * @param instanceId - the member instance id.
 */
export function provisioningOperationId(rootSessionId: string, instanceId: string): string {
  // Validate both components (loud on malformed ids; branded or not).
  parseRootSessionId(rootSessionId)
  parseInstanceId(instanceId)
  return `op-${deterministicToken(`${rootSessionId}\u0000${instanceId}`, 24)}`
}

/**
 * The idempotency key of one member provisioning: the caller's logical
 * operation identity (Architecture §18.2). It binds the member identity to
 * the ALLOCATION token so that re-driving the same logical allocation
 * reconstructs the same key, while a DIFFERENT allocation of the same
 * instance (a different token) is a loud `idempotency-conflict` (the journal
 * rejects the same operationId under a different key).
 * @param rootSessionId - the team (root session id).
 * @param instanceId - the member instance id.
 * @param allocationToken - the caller's allocation identity for this instance.
 */
export function provisioningIdempotencyKey(
  rootSessionId: string,
  instanceId: string,
  allocationToken: string,
): string {
  if (typeof allocationToken !== 'string' || allocationToken.length === 0) {
    throw new TypeError('provisioningIdempotencyKey: allocationToken must be a non-empty string')
  }
  return `provision:${rootSessionId}:${instanceId}:${allocationToken}`
}
