/**
 * centre-config.ts — the row-config rules the CENTRE adds, kept out of host.ts so they can be
 * exercised without booting the host composition.
 *
 * WHY A SEPARATE MODULE (2026-11-22): the rule below was first written inline in
 * `validateTeamPluginConfig`, and there is no way to test it from source — host.ts pulls the remote
 * handler tree through `.js` specifiers that only exist after a build. A rule that can only be
 * verified by a full build is a rule that silently stops being verified when the build is broken
 * (which it was). The pure function here is the whole rule; host.ts only decides how to fail.
 *
 * @module packages/runtime/src/plugin/vnext/centre-config
 */

import { isAbsolute } from 'node:path'

import { parseBlueprintV5 } from '../../../../domain/blueprint/src/blueprint-v5.js'
import { HOST_SURFACE_REFUSALS } from './host-surface-refusal.mjs'

/** The subset of the row config these rules read. Deliberately structural, not `TeamPluginConfig`. */
export interface CentreConfigFacts {
  readonly centreStatePath?: unknown
  readonly alpha6ReviewRouting?: unknown
  /** The durable wake-intent directory the latch requires (Alpha.6 opt-in only). */
  readonly alpha6WakeIntentPath?: unknown
  /** The bound bootstrap Blueprint source (Alpha.6 reads its authored v5 routing policy). */
  readonly blueprintSource?: unknown
}

/**
 * The Alpha.6 enablement PIECE codes (round 84). Every one is a REFUSAL code: a row is enabled only
 * when all three pieces are present, and a row that opts in without one is refused naming the exact
 * piece. They are deliberately NOT new members of the closed host-surface table: that table names
 * capabilities with no member I/O axis, and Alpha.6 no longer has that absence (the routing decision is
 * recorded as a delivery, and the Officer's calls are admitted by the centre). The `alpha6` TABLE code
 * stays the stable capability code every Alpha.6 row refusal carries (the recorded invocation-authority
 * fact and the recorded reason both start with it), and the piece code follows it in the same string so
 * a caller never has to parse prose to learn which piece was absent.
 */
export const ALPHA6_ENABLEMENT_PIECES = Object.freeze({
  /** No authored v5 `reviewRouting` policy: there is no decision to take, so nothing can be routed. */
  routing: 'ADMISSION_ALPHA6_ROUTING_REQUIRED',
  /** No durable centre: the routing/delivery facts and their settlement would have nowhere to live. */
  centre: 'ADMISSION_ALPHA6_CENTRE_REQUIRED',
  /** No absolute durable wake-intent directory: the latch would silently degrade to memory-only. */
  wakeIntentPath: 'ADMISSION_ALPHA6_WAKE_INTENT_PATH_REQUIRED',
} as const)

export type Alpha6EnablementPiece = (typeof ALPHA6_ENABLEMENT_PIECES)[keyof typeof ALPHA6_ENABLEMENT_PIECES]

/** One refused piece, as the gate names it (structural, so a caller can drive the gate directly). */
export interface Alpha6EnablementRefusal {
  readonly piece: Alpha6EnablementPiece
  readonly reason: string
}

/**
 * Is this row's authored Blueprint a v5 document carrying an ENABLED `reviewRouting` block?
 *
 * `false` for every other answer (absent source, a v3/v4 document, a malformed document, a v5 document
 * with no routing block, or a block with `enabled: false`): Alpha.6 has no implicit default, so a row
 * that names no policy is not routable. The parser is the domain's ONE v5 parser; a parse fault is a
 * refusal, never a pass.
 */
export function alpha6RoutingAuthored (blueprintSource: unknown): boolean {
  if (typeof blueprintSource !== 'string' || blueprintSource.length === 0) return false
  try {
    const parsed = parseBlueprintV5(blueprintSource)
    return parsed.schemaVersion === 5 && parsed.reviewRouting?.enabled === true
  } catch {
    return false
  }
}

/**
 * The Alpha.6 enablement rule (round 84): the row may run review routing exactly when the configured
 * pieces are COHERENT.
 *
 * WHY THE RULE CHANGED. Round 55 made the opt-in unconditionally unavailable because the routing
 * decision was taken outside the centre with no durable record (`ADM-99`). Round 84 removed that
 * absence by making the routed review an ordinary governed operation: the decision is a projection of
 * the centre's own durable control row through the ONE shared review policy, the wake is a DELIVERY
 * through the P6-T3 session-input mechanism (durable intent + confirmation facts, requirement gate,
 * machine attribution), and the Officer's approval/own tools are admitted by the centre under the
 * Officer's binding. What is still needed for that to be true is a configuration that can carry it, and
 * a row missing any piece would run a claim it cannot record — so each missing piece is refused by
 * name. Nothing here is an axis, a second authority or a default: `undefined` means "coherent", and
 * every other answer is a typed refusal.
 *
 * A row that never opts in is untouched (the first branch): Alpha.5 stays byte-identical.
 */
export function alpha6EnablementRefusal (config: CentreConfigFacts): Alpha6EnablementRefusal | undefined {
  if (config.alpha6ReviewRouting !== true) return undefined
  if (config.alpha6WakeIntentPath !== undefined
    && (typeof config.alpha6WakeIntentPath !== 'string' || config.alpha6WakeIntentPath.length === 0)) {
    return {
      piece: ALPHA6_ENABLEMENT_PIECES.wakeIntentPath,
      reason: 'alpha6WakeIntentPath must be a non-empty string when present',
    }
  }
  if (!alpha6RoutingAuthored(config.blueprintSource)) {
    return {
      piece: ALPHA6_ENABLEMENT_PIECES.routing,
      reason: 'alpha6ReviewRouting needs a v5 Blueprint whose authored `reviewRouting` block is enabled — with no authored policy there is no routing decision to take, and Alpha.6 has no implicit default',
    }
  }
  if (typeof config.centreStatePath !== 'string' || config.centreStatePath.length === 0) {
    return {
      piece: ALPHA6_ENABLEMENT_PIECES.centre,
      reason: 'alpha6ReviewRouting needs a durable centre (centreStatePath): the routed decision, its delivery facts and its settlement are the centre\'s own records, and a row without the centre would run the reviewer-routing plane with nowhere governed to record it',
    }
  }
  if (typeof config.alpha6WakeIntentPath !== 'string' || !isAbsolute(config.alpha6WakeIntentPath)) {
    return {
      piece: ALPHA6_ENABLEMENT_PIECES.wakeIntentPath,
      reason: 'alpha6ReviewRouting needs an ABSOLUTE non-empty alpha6WakeIntentPath (the durable wake-intent directory): without it a crash between "decided" and "inbox accepted" is unrecoverable and the single-flight latch silently degrades to memory-only — the wake must ship with crash-safe single-flight state',
    }
  }
  return undefined
}

/**
 * R3 (round 35): a member whose row is CONFIGURED for the centre but gets no confined-provider realm
 * would otherwise run its native tools with no admission decision, no ledger line and no settlement
 * record — unmediated and unreported. That is not "an unwired controlled call is refused"; it is the
 * call being outside the centre.
 *
 * The rule is narrow ON PURPOSE: it fires only when the row asked for governance (`centreStatePath`) and
 * the member did not get a centre. A row that never configured the centre keeps its current behaviour, so
 * this cannot turn a wiring gap into a product-wide outage — but a row that DID ask can no longer be
 * silently unmediated.
 *
 * @param mountedRealm - whether a confined-provider realm was actually mounted for this member.
 * @returns the refusal message, or `undefined` when there is nothing to refuse.
 */
export function memberCentreUnwiredViolation (
  config: CentreConfigFacts | null | undefined,
  member: { readonly instanceId?: unknown; readonly mountedRealm: boolean },
): string | undefined {
  const asked = config !== null && typeof config === 'object' && typeof config.centreStatePath === 'string' && config.centreStatePath.length > 0
  if (!asked || member.mountedRealm) return undefined
  const who = typeof member.instanceId === 'string' && member.instanceId !== '' ? member.instanceId : '<unnamed>'
  return `MEMBER_CENTRE_UNWIRED: member ${JSON.stringify(who)} is configured for the centre (centreStatePath is set) but no confined-provider realm was mounted, so its controlled calls would run with no admission decision, no durable fact and no settlement — this row asked for governance and cannot have it, so the member is refused instead of running unmediated`
}

/**
 * The FIRST rule violation, or `undefined` when the centre-related config is coherent.
 *
 * R1 (external review 2026-11-22, C6/C7 deferral; settled round 55): Alpha.6 review routing decides
 * who may review whom. The earlier shape of this rule accepted the opt-in when `centreStatePath` was
 * present ("it records its decisions somewhere durable"). Round 55 measured what that bought: the
 * decisions are written by the Alpha.6 composition, NOT by the centre, and no centre call ever
 * receives a review-routing decision — so an enabled router is still a governance claim whose
 * adjudication sits outside the ONE admission authority. Round 55 therefore refused the opt-in on
 * every row.
 *
 * ROUND 84 — THE POSITIVE PATH, ON THE SAME LAW. The absence round 55 named is closed by making the
 * routed review an ordinary governed operation rather than by inventing an axis (see
 * `ALPHA6-FORMAL-ROUTING.md`): the routing decision is a projection of the centre's own durable control
 * row, the wake is a delivery through the P6-T3 session-input mechanism with durable intent +
 * confirmation facts, and the Officer's approval and own tool calls are admitted by the centre under
 * the Officer's binding. What remains is a CONFIGURATION question, and it is answered by
 * `alpha6EnablementRefusal` above: a coherent row is enabled, an incoherent one is refused naming the
 * missing piece. The refusal string still STARTS with the closed table's `alpha6` code, so the host
 * entry's recorder (`row-refusal-entry.ts`) still records every Alpha.6 row refusal with the same
 * capability, axis and subject it always used.
 */
export function centreConfigViolation (config: CentreConfigFacts | null | undefined): string | undefined {
  if (config === null || typeof config !== 'object') return undefined
  if (config.centreStatePath !== undefined && (typeof config.centreStatePath !== 'string' || config.centreStatePath.length === 0)) {
    return 'centreStatePath must be a non-empty string when present (the centre\'s durable facts and settlement directory)'
  }
  const alpha6 = alpha6EnablementRefusal(config)
  if (alpha6 !== undefined) {
    return `${HOST_SURFACE_REFUSALS.alpha6.code}: ${alpha6.piece} — ${alpha6.reason}. ${HOST_SURFACE_REFUSALS.alpha6.missing}`
  }
  return undefined
}
