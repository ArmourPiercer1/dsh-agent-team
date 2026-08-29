/**
 * Legacy vocabulary quarantine.
 *
 * The legacy Team implementation (frozen fork, reference-only) addressed
 * members by a `memberId` that doubled as definition AND runtime identity,
 * and expressed Team coordination facts as Team-specific DSH SessionEvents
 * (`team/member-bound`, `team/progress`, `team/control-request`,
 * `team/control-decision`, `team/message`) written into the upstream
 * session log. Both are exactly what vNext must not do:
 *
 * - the legacy `memberId` authority is the acceptance-criterion anti-pattern
 *   of P3-T1 (contracts must not carry legacy MemberId authority);
 * - **no Team-specific DSH SessionEvent vocabulary** (invariant 42,
 *   Architecture §14.2): Team control-plane facts live in the TeamDomain
 *   durable sidecar (TeamLedger / operation journal), never in session events.
 *
 * What this module provides:
 *
 * - `LEGACY_FORBIDDEN_FIELDS` — field names that no vNext DTO may carry
 *   (`memberId`). DTO parsers reject them with `LEGACY_MEMBER_ID_REJECTED`.
 * - `LEGACY_TEAM_SESSION_EVENT_NAMES` — the legacy event vocabulary,
 *   frozen as DETECTION vocabulary only: it exists so the read-only legacy
 *   import path (invariant 65: existing legacy Team Sessions are read-only,
 *   never auto-migrated) can recognize legacy records, and so any attempt
 *   to emit a name from this list through a vNext surface fails with
 *   `LEGACY_TEAM_SESSION_EVENT_REJECTED`. vNext itself defines NO team
 *   session event names in this contract.
 *
 * Pure module: no I/O, no live Agent, no runtime environment assumptions.
 * @module @dsh-agent-team/contracts/legacy-vocabulary
 */

import type { RemoteSafeRecord } from './remote-safe.js'
import { toRemoteSafeDetail } from './remote-safe.js'
import { teamContractError } from './errors.js'

/**
 * Field names that no vNext DTO or record may carry. Their presence means
 * the value carries the legacy `memberId` identity authority.
 */
export const LEGACY_FORBIDDEN_FIELDS: readonly string[] = ['memberId']

/**
 * The legacy Team SessionEvent vocabulary (frozen fork `packages/team`).
 *
 * DETECTION ONLY. vNext has no Team SessionEvents (invariant 42); these
 * names appear in vNext code solely to recognize and reject legacy values
 * on the read-only import path.
 */
export const LEGACY_TEAM_SESSION_EVENT_NAMES: readonly string[] = [
  'team/member-bound',
  'team/progress',
  'team/control-request',
  'team/control-decision',
  'team/message',
]

/**
 * Does `name` belong to the legacy Team SessionEvent vocabulary?
 * @param name - the event name to check.
 * @returns `true` iff `name` is one of `LEGACY_TEAM_SESSION_EVENT_NAMES`.
 */
export function isLegacyTeamSessionEventName(name: unknown): boolean {
  return typeof name === 'string' && LEGACY_TEAM_SESSION_EVENT_NAMES.includes(name)
}

/**
 * Assert that `name` is not a legacy Team SessionEvent name.
 * @param name - the event name to check.
 * @throws `LEGACY_TEAM_SESSION_EVENT_REJECTED` when the name is a legacy
 *   Team SessionEvent name (vNext has no such vocabulary, invariant 42).
 */
export function assertNotLegacyTeamSessionEvent(name: unknown): void {
  if (isLegacyTeamSessionEventName(name)) {
    throw teamContractError(
      'LEGACY_TEAM_SESSION_EVENT_REJECTED',
      `legacy Team SessionEvent name ${JSON.stringify(name)} is not vNext vocabulary; Team control-plane facts belong to TeamDomain, not session events`,
      { name: toRemoteSafeDetail(name) },
    )
  }
}

/**
 * Assert that a DTO record carries no legacy-forbidden field (notably
 * `memberId`). Called by every DTO parser before field validation.
 * @param record - the plain record to check.
 * @param dtoName - the DTO name, used in the error message.
 * @throws `LEGACY_MEMBER_ID_REJECTED` when a forbidden legacy field is present.
 */
export function assertNoLegacyFields(record: RemoteSafeRecord, dtoName: string): void {
  for (const field of LEGACY_FORBIDDEN_FIELDS) {
    if (Object.hasOwn(record, field)) {
      throw teamContractError(
        'LEGACY_MEMBER_ID_REJECTED',
        `${dtoName} carries the legacy field '${field}'; vNext runtime identity is the composite (rootSessionId, instanceId), never a legacy memberId`,
        { field },
      )
    }
  }
}
