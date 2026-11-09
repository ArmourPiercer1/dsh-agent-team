/**
 * input-provenance.mjs — the ONE law for "who authored this model-visible
 * input", shared by the producer side (the live glue's delivery paths) and the
 * consumer side (the Alpha.6 Sticky Stop resume arbour in the Host wiring).
 *
 * WHY THIS FILE EXISTS. Two Alpha.5/Alpha.6 properties pull on the same wire:
 *
 *   1. A5 GOAL AUTHORITY (upstream `tool-goal/src/authority.ts` @ `639ed01539`,
 *      PR #691 gate-2 measurement): `create_goal` is authorized only for the
 *      exact live calling agent inside its active driver, on a runtime ROOT,
 *      and ONLY when the captured OPEN TURN contains a `user/message` session
 *      event whose `data.source.kind === 'user'`. A Member is a top-level
 *      agent (`agents.roots()` = "created without an owning agent context"),
 *      so the ONE thing that decides whether a governed Member may own a goal
 *      is the SOURCE KIND of the message that started its turn.
 *
 *   2. A6 STICKY STOP (the wake-intent lane in `packages/runtime/alpha6`, marker
 *      `alpha6/wake-intent*`): a durable stop marker set by the human's own
 *      cancellation (`turn/end` with
 *      `reason.kind === 'aborted' && reason.reason.kind === 'user'`) suspends
 *      every automatic activation until an EXPLICIT HUMAN interaction with the
 *      session clears it. The Host wiring's resume arbour reads the native
 *      inbox claim event (`agent/inbox/claimed`).
 *
 * A Team delivery that must carry A5 goal authority keeps the human
 * `kind: 'user'` attribution (there is no other way to obtain that authority
 * without re-implementing the upstream authority rule — forbidden: a limit the
 * constrained party raises for itself). But such a delivery is NOT a human
 * interaction, so the Sticky Stop arbour must not count it as one. The
 * distinction therefore cannot live in `source.kind` alone for work delivery;
 * it lives in this module, which answers BOTH questions from one place:
 *
 *   - `TEAM_MACHINE_ENVELOPES` — the frozen, model-visible provenance prefixes
 *     of the ONLY deliveries that carry the human `kind: 'user'` attribution
 *     (work delivery), which are therefore the only ones the durable fallback
 *     has to cover. Durable: they survive a restart, so a queued machine input
 *     claimed after a cold start is still classified machine.
 *   - `TEAM_PRODUCER_SOURCE` — the producer-owned `plugin:` source kind used by
 *     the deliveries that need NO goal authority (relays, wakes, control and
 *     completion notifications). Session Format v4 rejects the generic
 *     `kind: 'plugin'` wrapper, so the plugin identity is owned here.
 *   - `isTeamMachineInput` — the arbiter predicate: true when a claimed input
 *     is Team-originated (machine), i.e. it may NOT clear a human Sticky Stop.
 *
 * Pure: no imports, no host access, no authority of its own. It classifies; it
 * never decides whether something is ALLOWED.
 *
 * @module packages/runtime/src/plugin/live/input-provenance
 */

/** The producer-owned machine source kind (Session Format v4: producer-owned). */
export const TEAM_PRODUCER_SOURCE = Object.freeze({ kind: 'plugin:dsh-agent-team' })

/**
 * The frozen model-visible envelopes of the Team deliveries that DO carry the
 * human `kind: 'user'` attribution — i.e. exactly the inputs `isTeamMachineInput`
 * has to disambiguate from a real human interaction. Exact prefixes, verbatim
 * from the producers:
 *   - `[team-work requestToken=`            workDelivery.deliver (delegation/follow-up)
 *   - `[team-root-work requestToken=`       deliverRootWork (root initial work)
 *   - `handoff-context `                    deliverRootContext (B6 handoff context;
 *                                           `root.ts` renders `handoff-context <token>\n<json>`,
 *                                           token-leading but NOT bracketed)
 *
 * The handoff entry was missing from the first revision of this law and was
 * LATENT rather than exploitable: a handoff target is a freshly created root,
 * and a Sticky Stop marker exists only for a reviewer session with a wake
 * coordinator — so the misclassified claim had no marker to clear. It is listed
 * now because the durable text shape is the only restart-proof half.
 *
 * Deliberately ABSENT, and the reason each needs no entry:
 *   - relays (human vs machine share ONE envelope): a human `member.send`
 *     carries the same text shape, so an envelope rule here would classify the
 *     one human interaction Alpha.6 protects as machine; a machine relay is
 *     already machine by its producer kind;
 *   - control / completion notifications and review wakes: they carry the
 *     producer machine kind, never the human attribution.
 *
 * A human never types these; adding one here is a decision about a NEW
 * producer, and the classification suite pins the list against the producers.
 */
export const TEAM_MACHINE_ENVELOPES = Object.freeze([
  '[team-work requestToken=',
  '[team-root-work requestToken=',
  'handoff-context ',
])

/**
 * Whether one model-visible text carries a Team-originated machine envelope.
 * @param {unknown} text
 * @returns {boolean}
 */
export function isTeamMachineText(text) {
  if (typeof text !== 'string' || text === '') return false
  // A leading provenance envelope only: the convention is token-leading (the
  // model derives "why was I activated" from the first line), so a mid-body
  // occurrence (a Member quoting a delivery) is NOT an envelope.
  const head = text.startsWith('\n') ? text.replace(/^\n+/u, '') : text
  return TEAM_MACHINE_ENVELOPES.some((prefix) => head.startsWith(prefix))
}

/**
 * Whether one CLAIMED inbox message is a Team machine input — the Sticky Stop
 * arbiter's question. Human attribution is necessary but not sufficient: a
 * Team delivery that carries the human `kind: 'user'` attribution (it must, to
 * keep A5 goal authority) is still machine-originated.
 *
 * @param {{source?: {kind?: unknown}, content?: readonly {type?: string, text?: unknown}[]} | undefined | null} message
 * @returns {boolean}
 */
export function isTeamMachineInput(message) {
  if (message === undefined || message === null || typeof message !== 'object') return true
  const kind = message.source?.kind
  // Any non-human source kind is machine by construction (a durable Sticky Stop
  // may only be cleared by an explicit human interaction).
  if (kind !== 'user') return true
  const parts = Array.isArray(message.content) ? message.content : []
  for (const part of parts) {
    if (part?.type !== 'text') continue
    if (isTeamMachineText(part.text)) return true
  }
  return false
}

/**
 * A bounded, process-local ledger of the messages THIS process delivered as
 * machine input. It is the primary classification (it needs no agreement about
 * text shape, so a producer that renders a new envelope cannot silently become
 * "human"); `TEAM_MACHINE_ENVELOPES` stays the durable fallback for input that
 * a restart queued before the ledger existed.
 */
export function createMachineInputLedger(limit = 1024) {
  /** @type {Map<string, true>} */
  const seen = new Map()
  return {
    /** Record one delivered message as machine-originated. */
    note(sessionId, message) {
      const id = message?.id
      if (id === undefined || id === null) return
      const key = `${String(sessionId)}\u0000${String(id)}`
      if (seen.has(key)) return
      seen.set(key, true)
      while (seen.size > limit) {
        const oldest = seen.keys().next()
        if (oldest.done === true) break
        seen.delete(oldest.value)
      }
    },
    /** Current ledger length (bounded; diagnostics + tests only). */
    size() {
      return seen.size
    },
    /** Whether one claimed message was delivered by this process as machine input. */
    has(sessionId, message) {
      const id = message?.id
      if (id === undefined || id === null) return false
      return seen.has(`${String(sessionId)}\u0000${String(id)}`)
    },
  }
}

/**
 * Whether the consumer-side resume arbour may treat one claim as the explicit
 * human interaction that clears a Sticky Stop.
 *
 * @param {unknown} message
 * @param {{has: (sessionId: string, message: unknown) => boolean}} [ledger]
 * @param {string} [sessionId]
 * @returns {boolean}
 */
export function isHumanInteractionClaim(message, ledger, sessionId) {
  if (ledger !== undefined && ledger !== null && typeof ledger.has === 'function'
    && ledger.has(String(sessionId ?? ''), message)) {
    return false
  }
  return isTeamMachineInput(message) === false
}
