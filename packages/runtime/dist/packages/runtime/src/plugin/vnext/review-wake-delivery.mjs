/**
 * review-wake-delivery.mjs — the Alpha.6 review wake DELIVERED as an ordinary governed delivery.
 *
 * WHY THIS MODULE EXISTS (round 84). The routed review was already decided by the ONE shared routing
 * policy (the pure router lane), but the wake reached the Officer by a bespoke path: `deliverReviewWake` resolved the
 * live agent and called `followup`/`steer` with a hand-built message. That path skipped everything round
 * 83 built for `member.send` — the durable delivery intent fact, the correlation token, the
 * requirement-aware final-input verdict, the machine attribution that lets the A56 Sticky-Stop law tell
 * a machine input from a human interaction, and the confirmation fact. A review wake is INPUT to the
 * Officer's own session, so it must be delivered by the SAME mechanism. Anything else is a parallel
 * delivery path, and a parallel delivery path is a place where governance quietly stops applying.
 *
 * WHAT THIS MODULE IS.
 *  - It is a DELIVERY only. It executes no tool, admits nothing, decides who reviews: the routing
 *    decision is an input (`recipientInstanceId` came from the shared routing policy over the durable
 *    control row).
 *  - It writes the SAME two durable shapes round 83's `member.send` writes, in the SAME TeamDomain
 *    ledger, with the SAME correlation (logical token + intent fact sequence):
 *      `team-review-wake-routed`    — the delivery intent (who, which request, which session), and
 *      `team-review-wake-delivered` — the confirmation, written only after the session ACCEPTED it.
 *  - It delivers through the injected `SessionInputPort` (`submitAttributedInput`), i.e. ordinary
 *    attributed input into the recipient's own session; the recipient's own turn then runs its own
 *    governed tools under ITS binding. The success boundary is INBOX ACCEPTANCE — the port is not
 *    awaited to idle (a wake is an input primitive, not a work execution).
 *  - It is exactly-once per wake on the ledger and at-least-once on the session input: a crash between
 *    the acceptance and the confirmation leaves the intent durable, and a re-delivery converges on the
 *    existing confirmation instead of duplicating it (detectable through the correlation token).
 *
 * WHAT IT IS NOT. Not an admission point, not a policy, not a second authority. It never invents a
 * recipient: an unknown/archived recipient or a member row with no bound child session is a typed
 * refusal BEFORE any durable write (`REVIEW_WAKE_RECIPIENT_UNKNOWN`).
 *
 * @module packages/runtime/src/plugin/vnext/review-wake-delivery
 */

/** The delivery intent fact (written before the session sees anything). */
export const REVIEW_WAKE_FACT_ROUTED = 'team-review-wake-routed'
/** The delivery confirmation fact (written only after inbox acceptance). */
export const REVIEW_WAKE_FACT_DELIVERED = 'team-review-wake-delivered'
/** The closed action token both fact payloads carry (never the messaging one: this is not a member send). */
export const REVIEW_WAKE_ACTION = 'review-wake'

/** The closed refusal codes (a caller can branch without parsing prose). */
export const REVIEW_WAKE_ERRORS = Object.freeze({
  INPUT: 'REVIEW_WAKE_INPUT_INVALID',
  RECIPIENT_UNKNOWN: 'REVIEW_WAKE_RECIPIENT_UNKNOWN',
  LEDGER: 'REVIEW_WAKE_LEDGER_FAILED',
  DELIVERY: 'REVIEW_WAKE_DELIVERY_FAILED',
})

/**
 * @param {object} input
 * @param {string} input.code - one of {@link REVIEW_WAKE_ERRORS}.
 * @param {string} input.message
 * @param {object} [input.details]
 * @returns {Error & {code: string, details?: object}}
 */
function wakeError (code, message, details) {
  const error = new Error(`review-wake-delivery: ${message}`)
  error.name = 'ReviewWakeError'
  error.code = code
  if (details !== undefined) error.details = details
  return error
}

function nonEmptyString (value) {
  return typeof value === 'string' && value.trim().length > 0
}

/**
 * Build the ONE review-wake delivery port for a row.
 *
 * @param {object} input
 * @param {object} input.ledger - the TeamDomain ledger repository (`repositories.ledger`): the durable
 *   fact sink AND the atomic sequence allocator (`allocateSequence`), never a second ledger.
 * @param {(rootSessionId: string, instanceId: string) =>
 *   ({instanceId?: unknown, childSessionId?: unknown, lifecycle?: unknown} | undefined)} input.memberOf
 *   - the durable member read (identity: the wake can only target a real Member row of THIS team).
 * @param {{submitAttributedInput: (input: object) => Promise<void>}} input.sessionInput - the P6-T3
 *   `SessionInputPort`, the ONE channel to a session.
 * @param {() => string} [input.now] - the clock (ISO-8601); defaults to the real clock.
 * @returns {{ deliver: (input: object) => Promise<object>, readWakes: (rootSessionId: string) => object }}
 */
export function createReviewWakeDelivery ({ ledger, memberOf, sessionInput, now } = {}) {
  if (ledger === undefined || ledger === null || typeof ledger.put !== 'function' || typeof ledger.allocateSequence !== 'function') {
    throw new TypeError('review-wake-delivery: the TeamDomain ledger repository is required (durable intent + confirmation facts)')
  }
  if (typeof memberOf !== 'function') {
    throw new TypeError('review-wake-delivery: memberOf is required (the recipient identity is never invented)')
  }
  if (sessionInput === undefined || sessionInput === null || typeof sessionInput.submitAttributedInput !== 'function') {
    throw new TypeError('review-wake-delivery: the P6-T3 SessionInputPort is required (the ONLY channel to a session)')
  }
  const clock = typeof now === 'function' ? now : () => new Date().toISOString()

  const factsOf = (rootSessionId) =>
    ledger.list().filter((entry) =>
      String(entry.rootSessionId) === String(rootSessionId) &&
      (entry.factType === REVIEW_WAKE_FACT_ROUTED || entry.factType === REVIEW_WAKE_FACT_DELIVERED))

  const intentFor = (rootSessionId, requestToken) =>
    factsOf(rootSessionId).find((entry) =>
      entry.factType === REVIEW_WAKE_FACT_ROUTED && entry.payload?.['requestToken'] === requestToken)

  const confirmationFor = (rootSessionId, requestToken) =>
    factsOf(rootSessionId).find((entry) =>
      entry.factType === REVIEW_WAKE_FACT_DELIVERED && entry.payload?.['requestToken'] === requestToken)

  return Object.freeze({
    /**
     * Deliver ONE routed review wake.
     *
     * @param {object} input
     * @param {string} input.rootSessionId - the TEAM root the review belongs to.
     * @param {string} input.wakeId - the logical delivery token (the notifier's `review:<requestId>`);
     *   it is the dedupe key and the correlation token.
     * @param {string} input.requestId - the durable control request this wake is about.
     * @param {string} input.recipientInstanceId - the ROUTED reviewer (an output of `routeReview`,
     *   never derived here).
     * @param {string} input.text - the rendered wake (deterministic, token-leading).
     * @param {string} [input.requesterInstanceId] - the asking Member, when the caller knows it (the
     *   attribution's sender; omitted rather than guessed).
     * @returns {Promise<{delivered: boolean, duplicate: boolean, requestToken: string,
     *   recipientInstanceId: string, targetSessionId: string, intentSequence: number,
     *   deliveredSequence?: number}>}
     */
    async deliver ({ rootSessionId, wakeId, requestId, recipientInstanceId, text, requesterInstanceId } = {}) {
      if (!nonEmptyString(rootSessionId) || !nonEmptyString(wakeId) || !nonEmptyString(requestId) ||
          !nonEmptyString(recipientInstanceId) || !nonEmptyString(text)) {
        throw wakeError(REVIEW_WAKE_ERRORS.INPUT, 'rootSessionId, wakeId, requestId, recipientInstanceId and text must all be non-empty strings')
      }
      const requestToken = String(wakeId)

      // EXACTLY-ONCE on the ledger: an already-confirmed wake is not sent again.
      const already = confirmationFor(rootSessionId, requestToken)
      if (already !== undefined) {
        return {
          delivered: false,
          duplicate: true,
          requestToken,
          recipientInstanceId: String(already.payload?.['recipientInstanceId'] ?? recipientInstanceId),
          targetSessionId: String(already.payload?.['deliveredToSessionId'] ?? ''),
          intentSequence: Number(already.payload?.['factSequence'] ?? 0),
          deliveredSequence: Number(already.sequence),
        }
      }

      // IDENTITY. The wake can only target a real Member row of THIS team with a bound child session;
      // there is no fallback recipient and no "materialize someone" branch.
      const member = memberOf(String(rootSessionId), String(recipientInstanceId))
      const targetSessionId = member === undefined ? '' : String(member?.childSessionId ?? '')
      if (targetSessionId === '') {
        throw wakeError(
          REVIEW_WAKE_ERRORS.RECIPIENT_UNKNOWN,
          `no Member row of team '${rootSessionId}' binds a child session for the routed reviewer '${recipientInstanceId}' — a review wake is never delivered to an invented recipient`,
          { rootSessionId, recipientInstanceId },
        )
      }

      // INTENT (durable BEFORE the session sees anything). A retry after a crash reuses the existing
      // intent: the correlation token must name the same ledger row.
      const existingIntent = intentFor(rootSessionId, requestToken)
      let intentSequence
      if (existingIntent !== undefined) {
        intentSequence = Number(existingIntent.sequence)
      } else {
        const at = clock()
        let sequence
        try {
          sequence = await ledger.allocateSequence()
        } catch (error) {
          throw wakeError(REVIEW_WAKE_ERRORS.LEDGER, `sequence allocation failed: ${String(error?.message ?? error)}`, { cause: error })
        }
        intentSequence = sequence
        try {
          await ledger.put({
            schemaVersion: 2,
            sequence,
            rootSessionId: String(rootSessionId),
            factType: REVIEW_WAKE_FACT_ROUTED,
            payload: {
              action: REVIEW_WAKE_ACTION,
              requestToken,
              requestId: String(requestId),
              recipientInstanceId: String(recipientInstanceId),
              deliveredToSessionId: targetSessionId,
              routeRole: 'officer',
              ...(nonEmptyString(requesterInstanceId) ? { fromInstanceId: String(requesterInstanceId) } : {}),
              at,
            },
            createdAt: at,
          })
        } catch (error) {
          throw wakeError(REVIEW_WAKE_ERRORS.LEDGER, `the delivery intent fact could not be committed: ${String(error?.message ?? error)}`, { cause: error })
        }
      }

      // DELIVERY — the P6-T3 port, i.e. ordinary attributed input into the recipient's own session.
      // A rejection means the input was NOT delivered: the intent stays pending (recoverable, R2/R3)
      // and NO confirmation is written.
      try {
        await sessionInput.submitAttributedInput({
          sessionId: targetSessionId,
          text: String(text),
          attribution: {
            kind: 'team-relay',
            ...(nonEmptyString(requesterInstanceId) ? { fromInstanceId: String(requesterInstanceId) } : {}),
            intendedForInstanceId: String(recipientInstanceId),
            correlation: { requestToken, factSequence: intentSequence },
          },
        })
      } catch (error) {
        throw wakeError(
          REVIEW_WAKE_ERRORS.DELIVERY,
          `the session input port rejected the wake for '${requestToken}' — the intent fact stays durable and the delivery is recoverable: ${String(error?.message ?? error)}`,
          { rootSessionId, requestToken, factSequence: intentSequence, targetSessionId, cause: error },
        )
      }

      // CONFIRMATION (durable AFTER acceptance). A concurrent re-delivery that already confirmed
      // converges on the existing row instead of writing a second one.
      const concurrent = confirmationFor(rootSessionId, requestToken)
      if (concurrent !== undefined) {
        return {
          delivered: false,
          duplicate: true,
          requestToken,
          recipientInstanceId: String(recipientInstanceId),
          targetSessionId,
          intentSequence,
          deliveredSequence: Number(concurrent.sequence),
        }
      }
      const at = clock()
      let deliveredSequence
      try {
        deliveredSequence = await ledger.allocateSequence()
        await ledger.put({
          schemaVersion: 2,
          sequence: deliveredSequence,
          rootSessionId: String(rootSessionId),
          factType: REVIEW_WAKE_FACT_DELIVERED,
          payload: {
            action: REVIEW_WAKE_ACTION,
            requestToken,
            factSequence: intentSequence,
            ...(nonEmptyString(requesterInstanceId) ? { fromInstanceId: String(requesterInstanceId) } : {}),
            recipientInstanceId: String(recipientInstanceId),
            deliveredToInstanceId: String(recipientInstanceId),
            deliveredToSessionId: targetSessionId,
            at,
          },
          createdAt: at,
        })
      } catch (error) {
        throw wakeError(REVIEW_WAKE_ERRORS.LEDGER, `the confirmation fact could not be committed after the session accepted the wake (at-least-once, detectable through '${requestToken}'): ${String(error?.message ?? error)}`, { cause: error, rootSessionId, requestToken, factSequence: intentSequence })
      }

      return {
        delivered: true,
        duplicate: false,
        requestToken,
        recipientInstanceId: String(recipientInstanceId),
        targetSessionId,
        intentSequence,
        deliveredSequence,
      }
    },

    /** The durable wake facts of one team root (read back by the caller/arms; never a decision input). */
    readWakes (rootSessionId) {
      return factsOf(rootSessionId).map((entry) => Object.freeze({
        factType: entry.factType,
        sequence: entry.sequence,
        payload: entry.payload,
      }))
    },
  })
}
