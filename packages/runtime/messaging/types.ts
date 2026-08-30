/**
 * P6-T3 — messaging-coordination types: the instance-addressed send/relay
 * surface built OVER the P6-T2 TeamRuntime facade (never beside it).
 *
 * The two-record split (TaskDoc P6-T3; Architecture §23/§24):
 *
 * (A) The TeamDomain LEDGER row — the team-wide coordination fact. The P6-T2
 *     facade records `team-coordination-recorded` (who → whom, instanceIds,
 *     the correlation token) under its own per-team lock after the full
 *     documented admission order (steps 0–5). This module NEVER re-implements
 *     admission: every send is routed through
 *     `TeamRuntime.performAction({ action: 'send-message', ... })`.
 *
 * (B) The target Session receives ONLY ordinary attributed input through the
 *     injected {@link SessionInputPort} (the real public Session input API
 *     integrates at P6-T6; unit tests use a recording fake). The attribution
 *     carries the correlation (`requestToken` + the intent fact's ledger
 *     `sequence`) so delivery/result correlation reconciles against the
 *     ledger; receiving a relay grants NO shared-history access (the input
 *     is ordinary first-person input in the target's own DSH Session).
 *
 * After a successful delivery the module commits a confirmation fact
 * (`team-message-delivered`) closing the delivery/result correlation in the
 * ledger. Durability semantics (documented rulings, see `coordinator.ts`):
 * exactly-once per logical delivery on the TeamLedger; at-least-once on the
 * session input (a crash between the input write and the confirmation commit
 * is redelivered by restart recovery and is detectable through the
 * correlation token).
 *
 * Message identity is instanceId-first (invariant 18/19):
 * `(rootSessionId, instanceId)` is the ONLY addressing vocabulary; a label
 * or template token is rejected by the facade (the module itself rejects
 * nothing the facade does not reject — it forwards the token and lets the
 * facade classify it).
 *
 * No Team-specific DSH SessionEvent vocabulary exists anywhere (invariant
 * 42): the records are (A) TeamLedger rows and (B) ordinary session input —
 * nothing else.
 *
 * Pure types: no I/O.
 * @module messaging (P6-T3)
 */

import type { ActionCaller, CallerRole, TeamRuntime } from '../admission/index.js'
import type { TeamDomain } from '../../storage/repositories/index.js'

// --- fact families -------------------------------------------------------------

/**
 * The intent fact family (recorded by the P6-T2 facade for `send-message`;
 * the module never writes this family itself).
 */
export const MESSAGING_FACT_COORDINATION = 'team-coordination-recorded'

/**
 * The delivery-confirmation fact family (recorded by THIS module after a
 * successful delivery; the delivery/result correlation row of the ledger).
 */
export const MESSAGING_FACT_DELIVERED = 'team-message-delivered'

// --- delivery modes ----------------------------------------------------------------

/** The two frozen delivery modes of the documented mediation rule. */
export const MESSAGING_DELIVERY_MODES = {
  /** The attributed input goes to the RECIPIENT's own bound session. */
  DIRECT: 'direct',
  /**
   * The attributed input goes to the LEADER's bound session (the mediated
   * default for ungranted member→member traffic; the leader acknowledges /
   * relays itself — the runtime never auto-forwards).
   */
  MEDIATED: 'mediated',
} as const

/** One of the frozen delivery modes. */
export type DeliveryMode =
  (typeof MESSAGING_DELIVERY_MODES)[keyof typeof MESSAGING_DELIVERY_MODES]

/**
 * The caller reference as it is durably stored in the facade's intent fact
 * payload (`payload.caller`) — the validated shape the mediation decision
 * and the relay attribution consume (lossless JSON, no live data).
 */
export type MessagingCallerRef =
  | { readonly kind: 'human'; readonly humanId: string }
  | {
      readonly kind: 'instance'
      readonly instanceId: string
      readonly role: 'leader' | 'member'
    }

// --- module input -----------------------------------------------------------------

/**
 * One instance-addressed team send (the module-level request).
 *
 * Addressing is instanceId-first (invariant 18/19): `recipientInstanceId`
 * is the ONLY target vocabulary. `requestToken` is the caller's stable
 * logical-operation token (distinct per logical operation; the audit /
 * correlation identity carried into both ledger rows).
 */
export interface SendTeamMessageRequest {
  /** The TeamSession (root session id, invariant 9). */
  readonly rootSessionId: string
  /** The calling authority (exactly one form: human or instance caller). */
  readonly caller: ActionCaller
  /** The recipient, addressed BY INSTANCE ID (a label/template token is
   *  rejected by the facade with the closed addressing code). */
  readonly recipientInstanceId: string
  /** The message body (required, non-empty; stored verbatim in the intent
   *  fact and rendered into the attributed input text). */
  readonly body: string
  /** The optional subject (non-empty when present; verbatim in the fact
   *  and the input text). */
  readonly subject?: string
  /** The stable logical-operation token (non-empty). */
  readonly requestToken: string
}

// --- the session input port ---------------------------------------------------------

/**
 * The attribution carried with one relay delivery (lossless JSON).
 *
 * Receiving a relay grants NO shared-history access: the fields above are
 * the entire context the target session learns from the relay.
 */
export interface TeamRelayAttribution {
  /** Always `team-relay` (the attribution kind discriminator). */
  readonly kind: 'team-relay'
  /** The sending instance (instance caller only; exactly one of the two). */
  readonly fromInstanceId?: string
  /** The sending human principal (human caller only). */
  readonly fromHumanId?: string
  /** The intended recipient instance id (always the recipient of the
   *  coordination — equals the delivery target for direct mode, differs
   *  for mediated mode where the leader session receives it). */
  readonly intendedForInstanceId: string
  /** The correlation back to the durable intent fact. */
  readonly correlation: {
    /** The logical-operation token (the request token). */
    readonly requestToken: string
    /** The ledger sequence of the intent fact. */
    readonly factSequence: number
  }
}

/** One ordinary attributed input submitted to a target session. */
export interface AttributedSessionInput {
  /** The bound child session id of the delivery target. */
  readonly sessionId: string
  /** The relay text (ordinary first-person input for the target). */
  readonly text: string
  /** The relay attribution (the correlation context). */
  readonly attribution: TeamRelayAttribution
}

/**
 * The injected port that delivers attributed input to target sessions.
 *
 * The REAL implementation is the public Session input API (integrated at
 * P6-T6); unit tests inject a recording fake (with fault injection). The
 * port is the only channel by which a send ever touches a session: the
 * module holds no session handles itself.
 *
 * A rejection (throw) means the input was NOT delivered (the fake and the
 * intended real implementation both commit-or-throw); the coordinator maps
 * it to `MESSAGING_DELIVERY_FAILED` and the intent fact stays pending for
 * recovery.
 */
export interface SessionInputPort {
  /**
   * Submit one ordinary attributed input to a session.
   * @param input - the relay delivery (lossless JSON shape).
   * @throws when the input could not be delivered.
   */
  submitAttributedInput(input: AttributedSessionInput): Promise<void>
}

// --- outcomes -----------------------------------------------------------------------

/** The successful outcome of one send (lossless JSON). */
export interface SendTeamMessageOutcome {
  /** Always `delivered`; rejections are typed errors. */
  readonly status: 'delivered'
  /** The team (root) session id. */
  readonly rootSessionId: string
  /** The facade action that recorded the intent (always `send-message`). */
  readonly action: 'send-message'
  /** The resolved caller role (from the facade). */
  readonly callerRole: CallerRole
  /** The intended recipient instance id (the coordination target). */
  readonly recipientInstanceId: string
  /** The delivery mode that was executed (direct | mediated). */
  readonly deliveryMode: DeliveryMode
  /** The instance whose bound session received the attributed input. */
  readonly deliveredToInstanceId: string
  /** The bound child session id that received the attributed input. */
  readonly deliveredToSessionId: string
  /** The ledger sequence of the intent fact (`team-coordination-recorded`). */
  readonly factSequence: number
  /** The ledger sequence of the confirmation fact
   *  (`team-message-delivered`). */
  readonly deliveredSequence: number
  /** The request token echoed (audit / correlation identity). */
  readonly requestToken: string
}

/** One recovered pending delivery (lossless JSON). */
export interface RecoveredDelivery {
  /** The logical-operation token of the coordination. */
  readonly requestToken: string
  /** The ledger sequence of the intent fact. */
  readonly factSequence: number
  /** The delivery mode executed at recovery. */
  readonly deliveryMode: DeliveryMode
  /** The instance whose bound session received the input. */
  readonly deliveredToInstanceId: string
  /** The ledger sequence of the confirmation fact committed at recovery. */
  readonly deliveredSequence: number
}

/** The closed skip reasons of the restart-recovery scan. */
export const PENDING_DELIVERY_SKIP_REASONS = {
  /** The (re-derived) delivery target record no longer exists. */
  DELIVERY_TARGET_MISSING: 'delivery-target-missing',
  /** The delivery target exists but is not work-accepting (ARCHIVED/
   *  DISPOSED). A later restore + recovery delivers it; a DISPOSED target
   *  is skipped permanently (the intent fact is the durable record). */
  DELIVERY_TARGET_NOT_LIVE: 'delivery-target-not-live',
} as const

/** One skip reason of the restart-recovery scan. */
export type PendingDeliverySkipReason =
  (typeof PENDING_DELIVERY_SKIP_REASONS)[keyof typeof PENDING_DELIVERY_SKIP_REASONS]

/** One skipped pending delivery (lossless JSON). */
export interface SkippedDelivery {
  /** The logical-operation token of the coordination. */
  readonly requestToken: string
  /** The ledger sequence of the intent fact. */
  readonly factSequence: number
  /** Why the delivery was skipped (closed reason). */
  readonly reason: PendingDeliverySkipReason
}

/** The outcome of one restart-recovery scan (lossless JSON). */
export interface PendingDeliveryRecoveryResult {
  /** The team (root) session id scanned. */
  readonly rootSessionId: string
  /** The pending deliveries that were re-delivered and confirmed, in
   *  intent-fact sequence order. */
  readonly recovered: readonly RecoveredDelivery[]
  /** The pending deliveries whose delivery target is missing or not live
   *  (skipped, stay pending for a later recovery). */
  readonly skipped: readonly SkippedDelivery[]
}

// --- the coordinator -----------------------------------------------------------------

/** The injected wiring of the messaging coordinator. */
export interface MessagingCoordinatorOptions {
  /** The P6-T2 TeamRuntime facade — the ONLY admission/authority path (the
   *  module routes every send through `performAction`). */
  readonly teamRuntime: TeamRuntime
  /** The open TeamDomain (the durable control-plane authority, invariant
   *  41): the coordinator reads the member/override records fresh and
   *  commits the confirmation fact through its repositories. */
  readonly teamDomain: TeamDomain
  /** The session input port (the ONLY channel to target sessions). */
  readonly sessionInput: SessionInputPort
  /** The deterministic clock (ISO-8601) for durable fact timestamps. */
  readonly now: () => string
}

/**
 * The P6-T3 messaging-coordination surface: instance-addressed send/relay
 * over the P6-T2 facade with the two-record split (ledger row + ordinary
 * attributed session input) and the restart-recovery scan.
 */
export interface MessagingCoordinator {
  /**
   * Send one instance-addressed team message: facade admission + durable
   * intent fact, then delivery of ordinary attributed input to the
   * (direct or mediated) target session and the durable confirmation fact.
   * @throws {@link import('./errors.js').MessagingError} for the closed
   *   messaging-surface codes, or an UNMAPPED facade TeamRuntimeError for
   *   any admission rejection (zero durable writes on those).
   */
  sendTeamMessage(request: SendTeamMessageRequest): Promise<SendTeamMessageOutcome>
  /**
   * Scan the durable ledger for `send-message` coordination intents that
   * have no confirmation fact yet and re-deliver them (the restart /
   * crash recovery, Architecture §24.2: roll forward, never roll back).
   * Missing/not-live delivery targets are skipped (closed reasons); a
   * delivery or confirmation failure aborts the scan with the typed error
   * (already-confirmed deliveries in the run stay durable).
   */
  recoverPendingDeliveries(rootSessionId: string): Promise<PendingDeliveryRecoveryResult>
}
