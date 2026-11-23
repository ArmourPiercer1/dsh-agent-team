/**
 * root-delivery.mjs — the Root (Leader) input delivery ports.
 *
 * EXTRACTED VERBATIM FROM agent-bindings.mjs (2026-11-23, behaviour-preserving decomposition round;
 * no byte of the moved text changed). One factory per row instance.
 *
 * WHAT IT OWNS: `deliverRootInput` (the ONE shared real-input path: request-boundary reconciliation
 * under the root's own team truth, createUserMessage + followup, observe-to-idle, the persistence
 * materialization, the requirement-aware final-input verdict with the liveness-preserved class) and
 * its three thin callers — the B6 handoff context, the TCM-M3 creation-time initial work, and the
 * C1 control notification.
 *
 * DELIBERATELY LEFT IN agent-bindings.mjs: `deliverRootWorkCompletionNotification` (it reads the
 * row's `closing` primitive — a logic edit would be forced, so it stays), plus the review-wake
 * mailbox beside it.
 *
 * @module packages/runtime/src/plugin/vnext/root-delivery
 */

import { createUserMessage } from '@deepseek-ai/dsh-llm'
import { TEAM_PRODUCER_SOURCE } from '../live/input-provenance.mjs'

/**
 * Create the root-delivery ports over one row instance.
 * @param {object} input
 * @param {Function} input.ensureLiveAgent - the row's live-handle seam.
 * @param {Function} input.prepareAgentForRequest - the row's request-boundary reconciliation.
 * @param {object} input.sessionPersistence - the public session-persistence seam.
 * @param {object} input.machineInputs - the A56 machine-input ledger (mutated through `note`).
 * @returns {object} the four delivery ports.
 */
export function createRootDelivery ({ ensureLiveAgent, prepareAgentForRequest, sessionPersistence, machineInputs }) {
  /**
   * The shared REAL Agent input path for one team root (TCM-M3: extracted
   * privately out of deliverRootContext — zero behavior change): the text
   * goes in as a REAL model-visible input turn on the same path the
   * delegate work uses: the request-boundary reconciliation under the
   * root's own team truth, createUserMessage + agent.followup,
   * observe-to-idle (a rejection PROPAGATES — the caller owns the
   * at-least-once/dedup contract), then the public persistence seam
   * materializes the durable log so the delivered turn is on disk before
   * the caller settles.
   * @param {{rootSessionId: string, text: string}} input
   * @param {{livenessOnly?: boolean, machineSource?: boolean}} [options]
   *   - `livenessOnly: true` marks the LIVENESS-PRESERVED notification
   *     class (the C1 control notification — the consolidated-revision
   *     P2a fix, the explicit final-input-boundary distinction between
   *     the control notification and normal root work): the boundary
   *     reconcile still runs (the mount attempt stays admissible) but
   *     the final-input verdict is NOT consulted — the notification is
   *     NOT model-visible work input (the frozen matrix's
   *     liveness-preserved class, the same family as the completion
   *     notification: the pending-approval leader must stay reachable
   *     even while the root's required mcp materialization is failed —
   *     a swallowed control notification is a liveness hole in the C1
   *     channel). NORMAL root work (the Root initial work, the B6
   *     context) passes NO such flag and REMAINS gated.
   *   - `machineSource: true` marks the NOTIFICATION provenance class: the
   *     turn carries the producer-owned machine source kind instead of the
   *     human attribution, so it can neither authorize a goal on the root nor
   *     be read as an explicit human interaction by the Alpha.6 Sticky Stop
   *     arbour. The WORK classes (handoff context, creation-time root work)
   *     keep the human attribution — a Root's `create_goal` authority is
   *     decided by it — and are classified machine through the machine-input
   *     ledger instead (A56-SEMANTICS).
   * @returns {Promise<void>}
   */
  async function deliverRootInput(input, options) {
    const livenessOnly = options !== undefined && options.livenessOnly === true
    // A56-SEMANTICS: the provenance class of THIS root input. `machineSource`
    // marks the notification classes (they must not read as human work); the
    // work classes keep the human attribution for goal authority and are
    // machine-classified through the ledger instead.
    const machineSource = options !== undefined && options.machineSource === true
    const sid = String(input?.rootSessionId ?? '')
    const text = String(input?.text ?? '')
    if (sid === '') {
      throw new Error('agent-bindings: deliverRootInput requires a non-empty rootSessionId')
    }
    if (text === '') {
      throw new Error('agent-bindings: deliverRootInput requires a non-empty text')
    }
    const handle = await ensureLiveAgent(sid)
    // The target root IS the team root of its own team — the boundary
    // reconciliation resolves under that root's durable truth.
    const prepared = await prepareAgentForRequest(sid, sid)
    // Finding F residual round (the requirement-aware FINAL-INPUT
    // verdict): the root input IS ACTUAL input on the root session — the
    // root's (the leader's) FINAL required-truth gates it exactly like
    // the work delivery (the cold-resume shape: the admission reads the
    // stale cold truth and admits; the failure stands where the first
    // model-visible input would go). A `blocked` verdict throws BEFORE
    // the followup: the root initial-work strategy maps the rejection to
    // WORK_DELIVERY_FAILED (the remote
    // TEAM_CREATE_ROOT_WORK_DELIVERY_FAILED) and keeps the durable
    // admission for the same-token retry (NO terminal root-work fact);
    // the B6 context caller owns its at-least-once contract over the
    // same throw. The C1 CONTROL notification is EXPLICITLY DISTINGUISHED
    // at this final-input boundary (the consolidated-revision P2a fix):
    // it is not model-visible work input, so it arrives on this path
    // with `livenessOnly: true` and is NOT gated by the verdict (the
    // frozen matrix's liveness-preserved class — same family as the
    // completion notification). The optional / no-requirement outage
    // degrades (the input delivers).
    if (prepared.verdict.blocked && !livenessOnly) {
      throw new Error(
        `root input delivery blocked before input: the root's required mcp materialization is failed after this boundary [${prepared.verdict.blockedServers.join(', ')}] — the materialization must succeed before real work (Finding F residual round: the requirement-aware final-input verdict)`,
      )
    }
    const message = createUserMessage({
      content: [{ type: 'text', text }],
      // A56-SEMANTICS — resolution (a), the same split as work delivery:
      //   - ROOT WORK (the handoff context, the creation-time initial work) is
      //     a work input: the target Root is a runtime root and its goal
      //     authority is decided by this turn's source kind, so it keeps the
      //     human attribution and is registered as MACHINE in the ledger (the
      //     Sticky Stop arbour therefore still refuses to read it as human);
      //   - a CONTROL notification (`machineSource`) is not work input at all:
      //     it carries the producer-owned machine kind, so it cannot authorize
      //     a goal and cannot resume a stopped session.
      source: machineSource ? TEAM_PRODUCER_SOURCE : { kind: 'user' },
    })
    machineInputs.note(sid, message)
    handle.agent.followup(message)
    await handle.agent.whenIdle()
    await sessionPersistence.ensureMaterialized(handle.agent.session)
  }

  /**
   * Deliver the frozen handoff context into the target Root Agent (the B6
   * at-least-once seam): `text` — token-leading, so the target side dedupes
   * on the contextToken — goes in as a REAL model-visible input turn on
   * the same path the delegate work uses (the shared deliverRootInput).
   * NO dedupe here: at-least-once is B6's durable contract.
   * @param {{rootSessionId: string, contextToken: string, text: string}} input
   * @returns {Promise<void>}
   */
  async function deliverRootContext(input) {
    const sid = String(input?.rootSessionId ?? '')
    const token = String(input?.contextToken ?? '')
    const text = String(input?.text ?? '')
    if (sid === '') {
      throw new Error('agent-bindings: deliverRootContext requires a non-empty rootSessionId')
    }
    if (token === '') {
      throw new Error('agent-bindings: deliverRootContext requires a non-empty contextToken')
    }
    if (text === '') {
      throw new Error('agent-bindings: deliverRootContext requires a non-empty text (the token-leading frozen context)')
    }
    await deliverRootInput({ rootSessionId: sid, text })
  }

  /**
   * TCM-M3 — deliver ONE creation-time Root initial work into the Root
   * Agent (the thin adapter over the shared deliverRootInput): the
   * model-visible text is token-leading — `[team-root-work
   * requestToken=<token>]` — so the model can dedupe the at-least-once
   * redelivery, followed by the exact prompt and (when present and
   * non-empty) the same `[attached-context]` block the member work
   * delivery uses. NO dedupe here: the Root initial-work strategy's
   * durable side (the `team-work-admitted` / `team-root-work-delivered`
   * facts) owns replay/retry — the glue only submits and propagates
   * rejections (the strategy maps the rejection to WORK_DELIVERY_FAILED
   * and keeps the durable admission for the same-token retry).
   * @param {{rootSessionId: string, requestToken: string, prompt: string, attachedContext?: string}} input
   * @returns {Promise<void>}
   */
  async function deliverRootWork(input) {
    const sid = String(input?.rootSessionId ?? '')
    const token = String(input?.requestToken ?? '')
    const prompt = String(input?.prompt ?? '')
    if (sid === '') {
      throw new Error('agent-bindings: deliverRootWork requires a non-empty rootSessionId')
    }
    if (token === '') {
      throw new Error('agent-bindings: deliverRootWork requires a non-empty requestToken')
    }
    if (prompt === '') {
      throw new Error('agent-bindings: deliverRootWork requires a non-empty prompt')
    }
    const attachedContext = input?.attachedContext !== undefined ? String(input.attachedContext) : undefined
    const body = attachedContext !== undefined && attachedContext.length > 0
      ? `${prompt}\n\n[attached-context]\n${attachedContext}`
      : prompt
    await deliverRootInput({
      rootSessionId: sid,
      text: `[team-root-work requestToken=${token}] ${body}`,
    })
  }

  /**
   * C1 (leader-approval reachability) — deliver ONE control-plane
   * liveness notification to the Root (Leader) Agent: a NEWLY-CREATED
   * durable `leader-approval` request becomes a model-visible input turn
   * on the SAME private root-input path the delegate work uses (the
   * shared deliverRootInput: boundary reconciliation + createUserMessage
   * + followup + whenIdle + materialization). NON-AUTHORITY by
   * construction: the glue writes no TeamDomain state, records no
   * decision, and the notification CANNOT approve/deny/alter the request
   * — the durable control row + `team_resolve_control` stay the
   * authority. At-least-once: the text is token-leading
   * (`[team-control requestId=<id>]`, deterministic per request) so a
   * redelivery is recognizable; the control service fires this
   * fire-and-forget AFTER the per-team lock is released (a delivery
   * failure is a liveness failure only — it never blocks the request
   * path and never changes the outcome). Consolidated-revision P2a:
   * this notification is the LIVENESS-PRESERVED class at the
   * final-input boundary (the shared deliverRootInput with
   * `livenessOnly: true`) — it is delivered even while the root's
   * REQUIRED mcp materialization is failed (the verdict does not gate
   * it), while normal root work on the same path REMAINS gated.
   * @param {{rootSessionId: string, requestId: string, text: string}} input
   * @returns {Promise<void>}
   */
  async function deliverRootControlNotification(input) {
    const sid = String(input?.rootSessionId ?? '')
    const requestId = String(input?.requestId ?? '')
    const text = String(input?.text ?? '')
    if (sid === '') {
      throw new Error('agent-bindings: deliverRootControlNotification requires a non-empty rootSessionId')
    }
    if (requestId === '') {
      throw new Error('agent-bindings: deliverRootControlNotification requires a non-empty requestId')
    }
    if (text === '') {
      throw new Error('agent-bindings: deliverRootControlNotification requires a non-empty text (the token-leading notification)')
    }
    // The consolidated-revision P2a fix: the control notification is
    // the LIVENESS-PRESERVED class at the final-input boundary — the
    // boundary reconcile still runs (the mount attempt stays admissible;
    // the failure stands on the slot) but the verdict does NOT gate it
    // (the pending-approval leader must stay reachable while the root's
    // required mcp materialization is failed). Normal root work stays
    // gated (no flag on those paths).
    await deliverRootInput(
      { rootSessionId: sid, text },
      { livenessOnly: true, machineSource: true },
    )
  }

  return {
    deliverRootInput,
    deliverRootContext,
    deliverRootWork,
    deliverRootControlNotification,
  }
}
