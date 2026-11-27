/**
 * work-turn-reader.mjs — read one delivered turn through the public session seam and normalize it
 * into the frozen WorkDeliveryResult.
 *
 * EXTRACTED FROM agent-bindings.mjs (2026-11-22, external architecture review). These functions never
 * touched the binding closure's state: they take a Session and a request token and answer. Moving
 * them out is not a file shuffle - it is the first piece of the delivery law that a reviewer can read
 * without opening a 5,300-line composition, and it is the piece whose failure modes (no log seam,
 * absent delivery, aborted turn) are worth testing on their own.
 *
 * The correlation rule is unchanged and deliberate: the glue writes the delivered user message with
 * the deterministic `[team-work requestToken=<token>]` prefix, so the LAST `user/message` event
 * carrying that prefix IS this delivery's input, and the authoritative outcome is the `turn/end`
 * reason of the turn that encloses it.
 *
 * @module packages/runtime/src/plugin/vnext/work-turn-reader
 */

const WORK_RESULT_CODE_NO_BODY = 'WORK_NO_ASSISTANT_BODY'
/** The delivered turn was aborted (a cancellation request interrupted it). */
const WORK_RESULT_CODE_TURN_ABORTED = 'WORK_TURN_ABORTED'
/** The delivered turn hit its output-token ceiling. */
const WORK_RESULT_CODE_TURN_MAX_TOKENS = 'WORK_TURN_MAX_TOKENS'
/** The delivered turn was blocked. */
const WORK_RESULT_CODE_TURN_BLOCKED = 'WORK_TURN_BLOCKED'
/** The delivered turn failed (no structured LlmFailure code carried). */
const WORK_RESULT_CODE_TURN_ERROR = 'WORK_TURN_ERROR'
/** The delivered turn was closed after a crash (cold-read closer; defensive). */
const WORK_RESULT_CODE_TURN_INTERRUPTED = 'WORK_TURN_INTERRUPTED'
/** The delivered turn cannot be attributed/read in the session log (defensive). */
const WORK_RESULT_CODE_TURN_UNREADABLE = 'WORK_TURN_UNREADABLE'

/**
 * The readable text of one message (the join of its `type === 'text'`
 * content blocks — the upstream text-block convention).
 * @param {object|undefined} message - a UserMessage/AssistantMessage (or a
 *   shape-compatible log payload).
 * @returns {string} the concatenated text (empty when no text block).
 */
function workMessageText(message) {
  const content = message !== null && typeof message === 'object' ? message.content : undefined
  if (!Array.isArray(content)) return ''
  let text = ''
  for (const block of content) {
    if (block !== null && typeof block === 'object' && block.type === 'text' && typeof block.text === 'string') {
      text += block.text
    }
  }
  return text
}

/**
 * v2 D2 (task C2): read the delivered turn of one work request through the
 * public session seam and normalize it into the frozen WorkDeliveryResult.
 *
 * Correlation is EXACT: the glue builds the delivered user message itself
 * with the deterministic `[team-work requestToken=<token>]` prefix, so the
 * LAST `user/message` event whose text starts with that prefix IS this
 * delivery's input (the A4 correlation point — a resume redelivers, and
 * the fresh delivery is the one this call observes). The authoritative
 * outcome is the `turn/end` reason of the delivered message's enclosing
 * turn; the business body is that turn's last non-empty
 * `assistant/message` text (succeeded only).
 *
 * An unreadable log (the token-prefixed message or its turn/end is
 * absent) is a defensive case: the result is explicit `unavailable` —
 * never `succeeded`, never a throw (the control plane has already closed
 * the turn; the fail-closed throw contract is reserved for faults of the
 * delivery/observation itself, which reject before this read). The same
 * explicit `unavailable` mapping covers a handle whose session object
 * exposes no log-read seam at all (a seam regression must degrade to an
 * explicit "the seam cannot determine the outcome", never to a crashed
 * settlement or a disguised success).
 *
 * @param {object} session - the member child's Session (the live face).
 * @param {string} requestToken - the token the Leader used (echoed verbatim).
 * @returns {object} the frozen WorkDeliveryResult.
 */
function readDeliveredWorkTurn(session, requestToken) {
  const prefix = `[team-work requestToken=${requestToken}] `
  const ownEvents =
    session !== null && typeof session === 'object' && typeof session.ownEvents === 'function'
      ? session.ownEvents
      : undefined
  if (ownEvents === undefined) {
    return {
      requestToken,
      status: 'unavailable',
      error: {
        code: WORK_RESULT_CODE_TURN_UNREADABLE,
        message: 'the session log read seam (Session.ownEvents) is unavailable on the live session handle',
      },
    }
  }
  const events = ownEvents.call(session)
  const unavailable = (code, message) => ({ requestToken, status: 'unavailable', error: { code, message } })
  const failed = (code, message) => ({ requestToken, status: 'failed', error: { code, message } })
  // Locate the delivered message and the turn opened around it.
  let currentTurn
  let deliveredIndex = -1
  let deliveredTurn
  for (let i = 0; i < events.length; i++) {
    const event = events[i]
    if (event.type === 'turn/start') {
      currentTurn = event.data.turn
    } else if (event.type === 'turn/end') {
      if (currentTurn === event.data.turn) currentTurn = undefined
    } else if (event.type === 'user/message' && workMessageText(event.data).startsWith(prefix)) {
      deliveredIndex = i
      deliveredTurn = currentTurn
    }
  }
  if (deliveredIndex === -1) {
    return unavailable(
      WORK_RESULT_CODE_TURN_UNREADABLE,
      `no delivered user message for requestToken '${requestToken}' found in the child session log`,
    )
  }
  // The end of the delivered turn (its own turn number; the first closing
  // end after the message when the start marker was lost).
  let endIndex = -1
  for (let j = deliveredIndex + 1; j < events.length; j++) {
    const event = events[j]
    if (event.type !== 'turn/end') continue
    if (deliveredTurn === undefined || event.data.turn === deliveredTurn) {
      endIndex = j
      break
    }
  }
  if (endIndex === -1) {
    return unavailable(
      WORK_RESULT_CODE_TURN_UNREADABLE,
      `the delivered turn of requestToken '${requestToken}' has no turn/end in the child session log`,
    )
  }
  const reason = events[endIndex].data.reason
  const kind = reason !== null && typeof reason === 'object' ? reason.kind : undefined
  if (kind === 'completed') {
    // succeeded ONLY with a readable non-empty business body (the turn's
    // last non-empty assistant message; an empty-content turn is NOT a
    // success — it is explicit unavailable).
    let body
    for (let j = deliveredIndex + 1; j < endIndex; j++) {
      const event = events[j]
      if (event.type !== 'assistant/message') continue
      if (deliveredTurn !== undefined && event.data.turn !== deliveredTurn) continue
      const text = workMessageText(event.data.message)
      if (text.length > 0) body = text
    }
    if (body !== undefined) return { requestToken, status: 'succeeded', body }
    return unavailable(
      WORK_RESULT_CODE_NO_BODY,
      'the delivered turn completed but carries no non-empty assistant text',
    )
  }
  if (kind === 'error') {
    const failure = reason.error
    const hasFailure = failure !== null && typeof failure === 'object'
    const code = hasFailure && typeof failure.code === 'string' && failure.code !== ''
      ? failure.code
      : WORK_RESULT_CODE_TURN_ERROR
    const message = hasFailure && typeof failure.message === 'string' && failure.message !== ''
      ? failure.message
      : 'the member turn failed'
    return failed(code, message)
  }
  if (kind === 'aborted') {
    return failed(WORK_RESULT_CODE_TURN_ABORTED, 'the member turn was aborted before completion')
  }
  if (kind === 'max-tokens') {
    return failed(WORK_RESULT_CODE_TURN_MAX_TOKENS, 'the member turn hit its output token ceiling')
  }
  if (kind === 'blocked') {
    return failed(WORK_RESULT_CODE_TURN_BLOCKED, 'the member turn was blocked')
  }
  if (kind === 'interrupted') {
    // Defensive: the loop never emits this marker live (crash-orphan
    // closer / cold-read synthesis) — the live read sees it only if the
    // log was closed after a crash. Never succeeded, never failed.
    return unavailable(
      WORK_RESULT_CODE_TURN_INTERRUPTED,
      'the member turn was closed after a crash (no live outcome)',
    )
  }
  return unavailable(
    WORK_RESULT_CODE_TURN_UNREADABLE,
    `the delivered turn of requestToken '${requestToken}' ended with an unrecognized reason kind '${String(kind)}'`,
  )
}


/**
 * a5w-bindseam (dated 2026-10-31T00:00Z, real UTC): THE subtree containment
 * seam the alpha.5 Team tool plane is assembled WITH (passed as
 * `fs.subtreeContains` at the GLUE-5 mount below).
 *
 * THE GAP THIS CLOSES (bw5 evidence, dev/agent-workflow/evidence/
 * a5w-bootwave-20261030/c2/run-bw5.json trace[4]): this assembly path never
 * passed `fs` to createTeamToolPlaneAssembly, so a member template carrying
 * ANY subtree rule hit the admission kernel's fail-closed projection law
 * (`projection-subtree-seam-missing`, tool-admission/admission-kernel.ts)
 * and the mount was refused with TOOL_BINDING_UNVERIFIED. The kernel law is
 * correct and stays untouched: subtree coverage is answered by an injected
 * containment predicate or never.
 *
 * THE LAW (the one the kernel refusal names — "same law as the C-FS wiring
 * face"): child === root, or child lies UNDER the root — child.startsWith
 * (root with trailing slashes stripped + '/'). This is byte-equivalent to
 * the C-FS lane's own no-seam default arm (controlled-fs.ts `effectCovers`)
 * and to the a5p2 projection pin. A sibling sharing the root's prefix
 * (`/root-evil` under a `/root` rule) is NEVER covered: the separator
 * decides the boundary, never the prefix alone.
 *
 * THREE CONSUMER FACES, ONE PREDICATE (the plane feeds ALL of them this
 * function — see team-tool-plane.mjs `input.fs.subtreeContains`):
 *  · the kernel lanes (projection `matcherCovers`, the effect-set expansion,
 *    the deny-source walks) call it POSITIONALLY over realm-joined keys
 *    (`<realmId>|<canonical>` on BOTH sides — the shared prefix is inert for
 *    the law, the separator still decides);
 *  · the lane re-check (`createLaneDecide`) calls it POSITIONALLY over the
 *    raw rule path vs the effect's canonicalLocator;
 *  · the governed fs-family rows call it with ONE object argument
 *    `{ realmId, parent, child }` (raw paths).
 * Anything that is not two strings THROWS: an unanswerable containment is
 * UNKNOWN coverage, never a guessed verdict — every caller maps the throw to
 * its own typed fail-closed arm (the lane tightens, the kernel refuses).
 * EXPORTED for the C1 suite (packages/runtime/test/a5w-bindseam-subtree-
 * seam-c1.test.ts); the production wiring below is its only in-tree consumer.
 */

export {
  WORK_RESULT_CODE_NO_BODY,
  WORK_RESULT_CODE_TURN_ABORTED,
  WORK_RESULT_CODE_TURN_MAX_TOKENS,
  WORK_RESULT_CODE_TURN_BLOCKED,
  WORK_RESULT_CODE_TURN_ERROR,
  WORK_RESULT_CODE_TURN_INTERRUPTED,
  WORK_RESULT_CODE_TURN_UNREADABLE,
  readDeliveredWorkTurn,
  workMessageText,
}
