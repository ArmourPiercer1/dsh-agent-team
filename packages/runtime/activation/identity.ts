/**
 * Activation identity allocation (TaskDoc §11.7 P6-T1; Architecture §18.2,
 * §42 invariants 17/18/19/25).
 *
 * The member's `instanceId` is allocated DETERMINISTICALLY from the
 * caller's LOGICAL OPERATION identity — never from the mutable creation
 * fields (label/templateId/groupId are NOT identity, invariant 19):
 *
 * ```
 * activationKey   = rootSessionId \u0000 source \u0000 requestToken
 * instanceId      = 'inst-' + deterministicToken(activationKey, 12)
 * operationId     = provisioningOperationId(rootSessionId, instanceId)   (P4-T4)
 * idempotencyKey  = provisioningIdempotencyKey(rootSessionId, instanceId, requestToken)
 * ```
 *
 * Why the LOGICAL token (and not the P5-T6 spec string): the same template
 * is instantiated 0..N times (invariant 17), often in PARALLEL with the same
 * label. A spec-derived id collides between those creates (the P5-T6
 * derivation is deterministic over the spec and therefore unsuitable as the
 * allocation for this entry point). A logical-operation token is:
 *
 * - STABLE across retries of one logical operation -> the same instanceId,
 *   the same operation id, the same idempotency key -> the journal
 *   protocol converges (Architecture §18.2: the stable operation identity
 *   prevents double-create on retry, invariant 46);
 * - DISTINCT per logical operation -> N parallel same-template creates
 *   allocate N distinct instance ids (invariant 17).
 *
 * The journal protocol then DURELY RESERVES the allocated id: the PREPARED
 * operation row (the ALLOCATED stage) is the reservation, and the reservation
 * happens INSIDE the journal protocol (task card requirement). The provider
 * additionally collision-checks the allocation against committed members
 * and in-flight reservations under the team lock before reserving.
 *
 * Pure module: no I/O, no `node:` builtins.
 * @module @dsh-agent-team/runtime/activation/identity
 */

import {
  LEADER_INSTANCE_ID,
  parseInstanceId,
  parseRootSessionId,
} from '../../contracts/src/index.js'
import {
  deterministicToken,
  provisioningIdempotencyKey,
  provisioningOperationId,
} from '../../storage/provisioning/index.js'
import { ActivationError, ACTIVATION_ERROR_CODES } from './errors.js'
import type { ActivationSource } from './types.js'

/** The maximum length of a logical-operation token (hygiene bound). */
export const ACTIVATION_TOKEN_MAX_LENGTH = 256

/**
 * The collision-proof activation key of one logical operation.
 *
 * `requestToken` is validated as a hygienic non-empty string (no NUL, bounded
 * length) so the key is canonical; the three components are NUL-joined so no
 * component value can mimic another component's boundary.
 *
 * @param rootSessionId - the TeamSession (root) session id.
 * @param source - the activation source (a closed-vocabulary discriminator).
 * @param requestToken - the caller's stable logical-operation token.
 * @returns the canonical activation key.
 * @throws {@link ActivationError} `ACTIVATION_REQUEST_MALFORMED` when the
 *   token or the root session id is malformed.
 */
export function activationOperationKey(
  rootSessionId: string,
  source: ActivationSource,
  requestToken: string,
): string {
  const root = parseRootSessionId(rootSessionId)
  if (
    typeof requestToken !== 'string' ||
    requestToken.length === 0 ||
    requestToken.length > ACTIVATION_TOKEN_MAX_LENGTH ||
    requestToken.includes('\u0000')
  ) {
    throw new ActivationError(
      ACTIVATION_ERROR_CODES.REQUEST_MALFORMED,
      `activation: requestToken must be a non-empty string of at most ${ACTIVATION_TOKEN_MAX_LENGTH} characters without NUL`,
      { source },
    )
  }
  return `${root}\u0000${source}\u0000${requestToken}`
}

/**
 * Allocate the member instance id for one logical operation.
 *
 * Deterministic (the same logical operation always allocates the same id —
 * the convergence property) and validated against the contracts v1
 * instance-id pattern. The reserved leader id can never be allocated by
 * construction is checked explicitly for a loud, typed failure.
 *
 * @param rootSessionId - the TeamSession (root) session id.
 * @param source - the activation source.
 * @param requestToken - the caller's stable logical-operation token.
 * @returns the allocated (branded) instance id.
 * @throws {@link ActivationError} `ACTIVATION_REQUEST_MALFORMED` (malformed
 *   token), `ACTIVATION_LEADER_INSTANCE_ID_RESERVED` (collision with the
 *   leader id — practically unreachable: 12 base36 chars of FNV-1a never
 *   equal the 9-char leader id, the check is a loud invariant guard).
 */
export function allocateActivationInstanceId(
  rootSessionId: string,
  source: ActivationSource,
  requestToken: string,
): string {
  const key = activationOperationKey(rootSessionId, source, requestToken)
  const instanceId = parseInstanceId(`inst-${deterministicToken(key, 12)}`)
  if (instanceId === LEADER_INSTANCE_ID) {
    throw new ActivationError(
      ACTIVATION_ERROR_CODES.LEADER_INSTANCE_ID_RESERVED,
      `activation: allocated instance id collides with the reserved leader id '${LEADER_INSTANCE_ID}'`,
      { rootSessionId, source },
    )
  }
  return instanceId
}

/**
 * The durable operation identity of one logical activation (the P4-T4
 * provisioning protocol triple inputs): the operation id, the idempotency
 * key (allocation token = the logical request token), and the allocated
 * instance id.
 *
 * @param rootSessionId - the TeamSession (root) session id.
 * @param source - the activation source.
 * @param requestToken - the caller's stable logical-operation token.
 * @returns the identity triple of the logical operation.
 */
export function activationOperationIdentity(
  rootSessionId: string,
  source: ActivationSource,
  requestToken: string,
): {
  readonly instanceId: string
  readonly operationId: string
  readonly idempotencyKey: string
} {
  const instanceId = allocateActivationInstanceId(rootSessionId, source, requestToken)
  return {
    instanceId,
    operationId: provisioningOperationId(rootSessionId, instanceId),
    idempotencyKey: provisioningIdempotencyKey(rootSessionId, instanceId, requestToken),
  }
}
