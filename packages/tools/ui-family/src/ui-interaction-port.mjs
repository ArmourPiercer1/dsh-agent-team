/**
 * ui-family/src/ui-interaction-port.mjs — the INJECTED interaction port: the
 * ONE face through which the governed `ask_user_question` / `present` rows
 * touch a human (u7-f).
 *
 * OWNER ROLE (family lane, §4 Execution boundary): the family holds NO UI
 * face of its own. Every interaction effect runs through the port the
 * TRUSTED MOUNT supplies (`input.backends.ui`, resolved by the descriptor);
 * absent or face-incomplete = the row answers a typed refusal with ZERO
 * port calls — the fail-closed law, not a fallback. This is the same shape
 * as the image row's attachment store: no port mounted = no interaction
 * path at all.
 *
 * PORT CONTRACT (closed; validated before use, never duck-typed at call):
 *   ask({ questions, signal?, wait? })        → Promise<{ answers }>
 *       suspends until the human answers the batch (or the mount's wait
 *       arm settles it). `wait: { callId }` keys the card for reopening
 *       (host timed.ts: the timed tool's indefinite form is KEYED, the
 *       legacy tool's request stays unkeyed — the mirror keeps that
 *       distinction).
 *   askTimed({ questions, signal? }, callId, timeoutMs)
 *                                             → Promise<{ answers } | { pending: true }>
 *       the bounded foreground wait. The expiry outcome is `pending` —
 *       NEVER a synthesized answer batch (the timeout law).
 *   present({ files, signal?, callId })       → Promise<{ turn: number }>
 *       publishes the verified, post-consume file list and MUST return the
 *       mount's session `turn` — the host result schema REQUIRES an integer
 *       turn (tool-present/src/index.ts:61; :79 refuses an unopened turn),
 *       and the executor enforces it: a turn-less receipt is a typed
 *       UI_PRESENT_RECEIPT_INVALID refusal (review F-405-3), never a silent
 *       success.
 *
 * `createUserQuestionsPort` adapts the pinned host `userQuestions` service
 * (index.ts:287/234 @639ed01539: `ask(request)` / `askTimed(request,
 * callId, timeoutMs)`) into this contract. The host has NO session-facing
 * service for deliverables (`present` writes its own Session append from
 * the tool row), so the adapter deliberately answers NO `present` face —
 * a present row mounted through this adapter fails closed on its port
 * check. That is honest: the governed plane reaches no Session face it was
 * not given.
 *
 * Purity: no authority, no clock of its own (timeoutMs arrives from the
 * row), no I/O.
 *
 * @module ui-family/ui-interaction-port
 */

/** The three faces one complete governed UI mount can serve. */
export const UI_PORT_FACES = Object.freeze(['ask', 'askTimed', 'present'])

/**
 * Is `value` a usable interaction port, and does it carry the named face?
 * A port is an object exposing at least the `ask` function; each row asks
 * for ITS face by name (`hasUiPortFace(port, 'askTimed')`).
 */
export function hasUiPortFace(port, face) {
  return port !== null && typeof port === 'object' && typeof port[face] === 'function'
}

/** The faces the UI family's rows require to serve BOTH rows fully (the
 *  descriptor uses this only for observation lines — a partial port is
 *  legal and refuses only the row whose face is missing, per call). */
export function uiPortFacesOf(port) {
  return UI_PORT_FACES.filter((face) => hasUiPortFace(port, face))
}

/**
 * Wrap the host's pinned `userQuestions` service in the family port
 * contract (ask + askTimed faces; NO present face — see the header).
 *
 * @param {unknown} userQuestions - `ctx.get('userQuestions')` from the
 *   trusted mount (undefined anywhere the service is not mounted).
 * @param {{ agent?: () => unknown }} [binding] - the mount's OWN live
 *   agent, resolved lazily when the mount has one (host askTimed requires
 *   it: 'timed questions require a live agent'). A mount without a live
 *   root agent leaves it off — the service then answers its own typed
 *   CALLER_NOT_LIVE/DELEGATED_CALLER refusal, which the row surfaces
 *   verbatim (the service's ownership law is the service's, never
 *   second-guessed here).
 * @returns {object|null} the adapter port, or null when the service does
 *   not answer the two public faces (fail closed — never a half-port).
 */
export function createUserQuestionsPort(userQuestions, { agent = undefined } = {}) {
  if (userQuestions === null || typeof userQuestions !== 'object') return null
  const { ask, askTimed } = userQuestions
  if (typeof ask !== 'function' || typeof askTimed !== 'function') return null
  const withAgent = (request) => {
    const live = typeof agent === 'function' ? agent() : undefined
    return live === undefined ? request : { ...request, agent: live }
  }
  return Object.freeze({
    ask: (request) => ask.call(userQuestions, withAgent(request)),
    askTimed: (request, callId, timeoutMs) => askTimed.call(userQuestions, withAgent(request), callId, timeoutMs),
  })
}
