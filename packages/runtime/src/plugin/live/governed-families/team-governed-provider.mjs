/**
 * THE TEAM-GOVERNED SUBAGENT PROVIDER — GOVERNED SUPPLY behind the
 * standing blocks (supersedes the REJECTED candidate of e4389610; root
 * rulings 2026-10-25 C1/C2, CORRECTED 2026-10-26: the "children must
 * commit fresh durable Team-Member rows" reading was an ADDED
 * requirement and is WITHDRAWN — M0-B127 asks for a restricted child
 * factory, per-child independent admission, the full-tools CENTER
 * restriction and an owner-cancel budget, NOT new Team membership, and
 * the one shared child->owning-member/root identity contract is OWNED
 * BY ROOT (internal identity binding + setup/lifecycle/revocation short
 * flow; children hold NO independent member powers, no parent-envelope
 * widening, no parallel ledger). This module therefore treats child
 * establishment as the INJECTED childChain seam it is and makes NO
 * member-row architecture claim: whatever the identity contract lands
 * as, it swaps behind the SAME provider face without touching the
 * public-engine consumer takeover or the result protocol.) The
 * candidate's accepted defects stay fixed by construction: no raw
 * agents.create pairing (creation rides the injected childChain face);
 * no restrict-substitutes-setup (the child's world
 * is the ACTIVATED TEMPLATE — template-authorized capabilities, never an
 * unrestricted publish, never a widening); no parentAgent-WeakMap
 * correlation (the provider exists as a PER-RUN closure carrying the
 * admitted call's real context — root C2); no invented result face (the
 * settlement is the frozen WorkDeliveryResult of the existing deliver
 * consumer, normalized by mapWorkDeliveryResult only); no self-forged
 * UUIDs (the child instance id is a DETERMINISTIC derivation of the
 * PA-admitted child call identity, inside the existing
 * INSTANCE_ID_PATTERN namespace — a NAMING derivation only; no ledger
 * claim of any kind).
 *
 * The module is the SUPPLY behind the standing safety blocks (the
 * workflow constant seat and the 39/40 first-statement block still
 * refuse FIRST; unblocking is root's call at end-to-end supply). It is
 * NOT a production closure claim.
 *
 * THE ORDER IS THE LAW:
 *  1. ADMISSION BEFORE CREATION — start() opens with the per-child PA
 *     walk over the plane's ONE funnel (`parentCallId#child-N` derived
 *     from the admitted call identity — a reversible audit identity); a
 *     deny/fault/aborted answer throws before anything exists.
 *  2. CHAIN CREATION VIA THE INJECTED FACE — childChain.ensureChild
 *     (root, instance, template — the REAL accepted request; extras are
 *     typed-refused by the wrapper, never silently dropped) is the arm's
 *     wrapper over the existing childFactory + ensureLiveAgent +
 *     ensureMaterialized faces. The wrapper today routes the fresh-member
 *     path because that is a REAL restricted-factory face available now;
 *     it is an IMPLEMENTATION DETAIL behind the block, not a required
 *     architecture (root correction 2026-10-26).
 *  3. SETTLEMENT PRECHECK BEFORE CREATION — the per-run binding
 *     (rootSessionId + the real workDelivery port) and the activated
 *     templateId must be answerable BEFORE the child exists: a child
 *     whose result cannot ride the real deliver consumer is never
 *     established.
 *  4. THE RUN'S RESULT = the frozen WorkDeliveryResult of the existing
 *     consumer chain (prepare -> followup [team-work requestToken] ->
 *     whenIdle -> ensureMaterialized -> readDeliveredWorkTurn), echoed-
 *     verified by requestToken, mapped by mapWorkDeliveryResult ONLY
 *     (succeeded + non-empty body -> completed; failed/unavailable NEVER
 *     success). Cancellation rides the consumer's signal arm (child
 *     agent cancel). dispose releases the LIVE handle; the durable
 *     session persists per the member lifecycle law.
 *
 * Engines that route here by NAME: workflow-ptc per-run
 * WorkflowStartRequest.subagentProvider override (workflow-ptc/index.ts
 * :136; per-run closure registered/reclaimed by the arm's runner) and
 * ralph's FIXED Config.subagentProvider lane (its own registration — the
 * per-run names NEVER impersonate it).
 *
 * @module @dsh-agent-team/runtime/plugin/live/governed-families/team-governed-provider
 */
import { createHash } from 'node:crypto'
import { parseRequestedEffectSet } from '../../../../../domain/tool-governance/src/index.js'
import { A5_B_ORCHESTRATION_FAMILY_ID, A5_B_ORCHESTRATION_ADAPTER_REVISION } from './workflow-adapters.mjs'

export const A5_TGP_CODES = Object.freeze({
  INPUT_INVALID: 'P_TGP_INPUT_INVALID',
  NO_PARENT_CONTEXT: 'P_TGP_NO_PARENT_CONTEXT',
  CANCELLED: 'P_TGP_CANCELLED',
  PA_FAULT: 'P_TGP_PA_FAULT',
  DENIED: 'P_TGP_DENIED',
  CREATE_FAULT: 'P_TGP_CREATE_FAULT',
  UNSUPPORTED_CAPABILITY: 'P_TGP_UNSUPPORTED_CAPABILITY',
  DELIVERY_UNBOUND: 'P_TGP_DELIVERY_UNBOUND',
  DELIVERY_UNCORRELATED: 'P_TGP_DELIVERY_UNCORRELATED',
  DELIVERY_FAILED: 'P_TGP_DELIVERY_FAILED',
  DELIVERY_UNAVAILABLE: 'P_TGP_DELIVERY_UNAVAILABLE',
  DELIVERY_STATUS_UNKNOWN: 'P_TGP_DELIVERY_STATUS_UNKNOWN',
})

const CODES = A5_TGP_CODES

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

const tgpThrow = (code, detail) => Object.assign(new Error(`team-governed-provider refused: ${code} — ${detail}`), { code, tgpRefusal: { code, detail } })

export const A5_TGP_DEFAULT_PROVIDER_NAME = 'team-governed-spawn'

/** contracts/src/ids/instance-id.ts:32 — the ONE legal instance namespace. */
const INSTANCE_ID_PATTERN = /^inst-[a-z0-9]{1,32}$/

/**
 * The durable child-instance NAME for one admitted child call: a
 * deterministic derivation of the PA-admitted identity (rootSessionId +
 * childCallId) inside the existing legal namespace. NOT a minted UUID,
 * NOT a new ledger: the durable MemberInstance ROW commits through the
 * existing fresh-member activation chain (childFactory -> agentSetup
 * bindPath 'fresh-member'), exactly the chain boot seeds ride.
 */
export function childInstanceIdForAdmittedCall (rootSessionId, childCallId) {
  const hex = createHash('sha256').update(`${String(rootSessionId)}\u0000${String(childCallId)}`, 'utf8').digest('hex').slice(0, 32)
  const instanceId = `inst-${hex}`
  if (!INSTANCE_ID_PATTERN.test(instanceId)) throw tgpThrow(CODES.INPUT_INVALID, `derived instance identity '${instanceId}' violates the legal namespace law — this is a defect, not a fallback`)
  return instanceId
}

/**
 * C1 (root ruling 2026-10-25): the FROZEN WorkDeliveryResult (admission/
 * types.ts:559 — { requestToken, status: succeeded|failed|unavailable,
 * body?, error? }) maps to the run's settlement through THIS function and
 * nothing else. 'settled' alone never maps (the DTO law). succeeded maps
 * ONLY with a readable NON-EMPTY body (ContentBlock text); failed and
 * unavailable NEVER produce success — they throw carrying the DTO's own
 * error bytes. The requestToken echo is verified (corruption of the
 * correlation is fail-closed, not re-mapping). No runner is invented:
 * this is normalization of the real chain's answer (the existing consumer:
 * prepare -> followup([team-work requestToken=…]) -> whenIdle ->
 * ensureMaterialized -> readDeliveredWorkTurn).
 */
export function mapWorkDeliveryResult (result, expectedRequestToken) {
  if (!isRecord(result) || typeof result.requestToken !== 'string' || typeof expectedRequestToken !== 'string' || result.requestToken !== expectedRequestToken) {
    throw tgpThrow(CODES.DELIVERY_UNCORRELATED, 'the WorkDeliveryResult requestToken does not echo the delivered request verbatim — correlation is broken and is NEVER re-mapped')
  }
  if (result.status === 'succeeded') {
    if (typeof result.body !== 'string' || result.body.length === 0) {
      // a 'succeeded' WITHOUT a readable non-empty body is not business
      // success (the DTO's own definition) — it must not map to success.
      throw tgpThrow(CODES.DELIVERY_UNAVAILABLE, 'the DTO answered succeeded with no readable non-empty body — business success requires the delivered turn\'s text; nothing is claimed')
    }
    return Object.freeze({ output: Object.freeze([Object.freeze({ type: 'text', text: result.body })]), isError: false, stopReason: 'completed' })
  }
  if (result.status === 'failed') {
    throw tgpThrow(CODES.DELIVERY_FAILED, `the delivered turn FAILED (durable): ${String(result.error?.code ?? 'unspecified')} — ${String(result.error?.message ?? 'no message').slice(0, 240)}`)
  }
  if (result.status === 'unavailable') {
    throw tgpThrow(CODES.DELIVERY_UNAVAILABLE, `the delivered turn is UNAVAILABLE (no readable body / seam undeterminable): ${String(result.error?.code ?? 'unspecified')} — ${String(result.error?.message ?? 'no message').slice(0, 240)}`)
  }
  throw tgpThrow(CODES.DELIVERY_STATUS_UNKNOWN, `status '${String(result.status)}' is outside the closed WorkDeliveryStatus set — an unknown settlement is fail-closed, never guessed`)
}

/**
 * Build the Team-governed provider (the per-run closure the arm registers
 * per admitted call). Input (all REQUIRED unless noted):
 * { name?, pa: walk=>Promise & {closePlan}, runContext: {callId,
 *   parametersFingerprint, realmId, toolName} (THE ADMITTED CALL — the
 *   correlation is per-run by construction, no WeakMap), childChain:
 *   { async ensureChild({ rootSessionId, instanceId, templateId,
 *   parentAgent, signal? }) => { childSessionId, handle } } (the arm's
 *   wrapper over the EXISTING childFactory + ensureLiveAgent +
 *   ensureMaterialized faces), templateId (the ACTIVATED template the run
 *   is authorized to spawn under — from locateTemplate, the existing
 *   fresh-create window face), settlement: { rootSessionId, workDelivery:
 *   { deliver } }, observe? }
 */
export function createTeamGovernedSubagentProvider (input = {}) {
  if (!isRecord(input)) return Object.freeze({ ok: false, code: CODES.INPUT_INVALID, message: 'one input record' })
  for (const [key, check] of [
    ['pa', (v) => typeof v === 'function'],
    ['runContext', (v) => isRecord(v) && typeof v.callId === 'string' && v.callId.length > 0 && typeof v.parametersFingerprint === 'string' && typeof v.realmId === 'string'],
    ['childChain', (v) => isRecord(v) && typeof v.ensureChild === 'function'],
    ['templateId', (v) => typeof v === 'string' && v.length > 0],
    ['settlement', (v) => isRecord(v) && typeof v.workDelivery?.deliver === 'function' && typeof v.rootSessionId === 'string' && v.rootSessionId.length > 0],
  ]) {
    if (!check(input[key])) {
      return Object.freeze({ ok: false, code: CODES.INPUT_INVALID, message: `${key} is REQUIRED — the provider cannot run with a stand-in for the ${key} seam (admission, the admitted-call context, the durable child chain, the activated template and the real delivery port are all real faces)` })
    }
  }
  const name = typeof input.name === 'string' && input.name.length > 0 ? input.name : A5_TGP_DEFAULT_PROVIDER_NAME
  const observe = typeof input.observe === 'function' ? input.observe : () => {}
  const closePlan = (callId) => { try { input.pa.closePlan?.(callId) } catch { /* funnel best-effort */ } }
  const context = input.runContext
  const ordinalState = { n: 0 }

  return Object.freeze({
    name,
    // one-shot delegation only. CAPABILITIES HONESTY (root interface card
    // 2026-10-26): the durable chain face takes NO agentOptions (and the
    // wrapper would have to DROP them — dropping while claiming support is
    // pretending success, forbidden), so agentOptions is declared FALSE
    // and typed-REFUSED, exactly like outputSchema/depthLimit/toolFilter/
    // persona. Every false flag is a MUST-DELIVER item, never a silent
    // ignore in either direction.
    capabilities: Object.freeze({ agentOptions: false, outputSchema: false, depthLimit: false, toolFilter: false, persona: false }),
    inheritsParentContext: false,
    /** LAW 1: admission before creation; the correlation is this closure. */
    async start (request) {
      const parent = isRecord(request) ? request.parent : undefined
      if (parent === undefined || parent === null) throw tgpThrow(CODES.NO_PARENT_CONTEXT, 'request.parent is absent — a Team-governed child is attributed to the LIVE parent Agent, nothing else')
      const signal = request.signal
      if (request.agentOptions !== undefined || request.outputSchema !== undefined || request.maxDepth !== undefined || request.toolFilter !== undefined || request.persona !== undefined) {
        throw tgpThrow(CODES.UNSUPPORTED_CAPABILITY, 'this provider declares agentOptions/outputSchema/depthLimit/toolFilter/persona FALSE and enforces them nowhere — a request touching them is refused typed (the capability gap is a MUST-DELIVER item, never a silent ignore or a silent drop)')
      }
      if (signal?.aborted === true) throw tgpThrow(CODES.CANCELLED, 'the caller signal was already aborted before the child admission opened')
      // LAW 3 PRECHECK (before anything is admitted or created): the
      // settlement chain and the activated template must be real.
      const binding = input.settlement
      const promptText = Array.isArray(request.prompt) ? request.prompt.filter((b) => isRecord(b) && b.type === 'text').map((b) => String(b.text ?? '')).join('\n') : ''
      if (promptText.length === 0) throw tgpThrow(CODES.DELIVERY_UNBOUND, 'the delegation carried no model-visible text prompt - nothing can be delivered, so nothing is claimed')
      ordinalState.n += 1
      const childCallId = `${context.callId}#child-${ordinalState.n}`
      const parsed = parseRequestedEffectSet([{ kind: 'tool-invoke', toolName: context.toolName ?? 'workflow', resource: null }])
      if (parsed?.ok !== true) throw tgpThrow(CODES.PA_FAULT, `the domain parser refused the child effect request: ${String(parsed?.detail ?? 'unparsable')}`)
      const walk = Object.freeze({
        realmId: context.realmId,
        callId: childCallId,
        parametersFingerprint: `${context.parametersFingerprint}+child#${ordinalState.n}`,
        requestedEffects: parsed.value,
        toolName: context.toolName ?? 'workflow',
        family: Object.freeze({
          familyId: A5_B_ORCHESTRATION_FAMILY_ID,
          adapterRevision: A5_B_ORCHESTRATION_ADAPTER_REVISION,
          providerIdentity: context.providerIdentity ?? 'a5p5-plane',
          targetManifest: Object.freeze({
            addressClaim: null,
            childOf: context.callId,
            childOrdinal: ordinalState.n,
            attribution: 'live parent Agent (request.parent) + the admitted per-run call + the durable fresh-member chain row commit',
          }),
        }),
      })
      observe({ event: 'tgp:child-admit-open', callId: childCallId })
      let opened
      try {
        opened = await input.pa(walk)
      } catch (error) {
        closePlan(childCallId)
        observe({ event: 'tgp:child-admit-fault', callId: childCallId })
        throw tgpThrow(CODES.PA_FAULT, `the child PA walk THREW and is never an authorization: ${String(error?.message ?? error).slice(0, 180)}`)
      }
      if (opened?.cancelled === true) { closePlan(childCallId); throw tgpThrow(CODES.CANCELLED, `the PA walk answered this child cancelled (call ${childCallId}): zero creation`) }
      if (signal?.aborted === true) { closePlan(childCallId); throw tgpThrow(CODES.CANCELLED, `the signal aborted while the child PA walk was open (call ${childCallId}): zero creation`) }
      if (opened?.kind !== 'allow') {
        closePlan(childCallId)
        throw tgpThrow(CODES.DENIED, String(opened?.detail ?? opened?.reason ?? `the child PA walk did not answer allow for call ${childCallId}`))
      }
      observe({ event: 'tgp:child-admit-allow', callId: childCallId })
      // LAW 2: the durable chain. The child instance NAME is the
      // deterministic derivation of the admitted child-call identity;
      // the ROW commits through the existing fresh-member activation
      // chain inside ensureChild (childFactory -> agentSetup
      // 'fresh-member' -> durable MemberInstance commit -> liveAgents ->
      // ensureMaterialized). The parent's instance is NEVER reused as
      // the child's; no UUID, no new ledger.
      const instanceId = childInstanceIdForAdmittedCall(binding.rootSessionId, childCallId)
      let child
      try {
        // THE REAL accepted request of the chain face is exactly
        // { rootSessionId, instanceId, templateId } (+ the chain's own
        // workspace default law — agent-bindings childFactory: contract-
        // explicit workspace else the team's effective default). Sending
        // parentAgent/agentOptions/signal through a wrapper that drops
        // them would claim support the seam does not have; they are NOT
        // sent. (Cancellation still rides the delivery signal below; the
        // parent attribution law arrives with root's shared identity
        // contract — nothing is faked until it lands.)
        child = await input.childChain.ensureChild({
          rootSessionId: binding.rootSessionId,
          instanceId,
          templateId: input.templateId,
          // the routing/lifecycle install identity for the shared
          // bridge (root item A): the admitted child-call id — a
          // reversible audit identity, NOT a grant and NOT a token.
          admittedCallId: childCallId,
        })
      } catch (error) {
        closePlan(childCallId)
        observe({ event: 'tgp:create-fault', callId: childCallId })
        throw tgpThrow(CODES.CREATE_FAULT, `the governed durable-chain creation failed and established nothing: ${String(error?.message ?? error).slice(0, 180)}`)
      }
      const childSessionId = isRecord(child) ? String(child.childSessionId ?? '') : ''
      if (childSessionId.length === 0) {
        closePlan(childCallId)
        throw tgpThrow(CODES.CREATE_FAULT, 'the durable chain answered no childSessionId — an unnamed child is never treated as established')
      }
      observe({ event: 'tgp:child-established', callId: childCallId, childSessionId })
      // LAW 4: the settlement is the existing deliver consumer's frozen
      // DTO; the token is minted from THIS admitted child call and
      // echoed-verified, never re-mapped.
      const requestToken = `tgp:${childCallId}:${childSessionId}`
      const settlement = binding.workDelivery.deliver({
        rootSessionId: binding.rootSessionId,
        instanceId,
        childSessionId,
        requestToken,
        prompt: promptText,
        ...(signal === undefined ? {} : { signal }),
      }).then((dto) => mapWorkDeliveryResult(dto, requestToken))
      const handle = isRecord(child) ? child.handle : undefined
      return Object.freeze({
        runId: childSessionId,
        provider: name,
        id: childSessionId,
        local: true,
        localAgent: isRecord(handle) ? handle.agent : undefined,
        result: settlement,
        dispose: async () => {
          // the LIVE handle releases; the durable session persists per the
          // member lifecycle law (archive is a different, Leader-side act).
          if (typeof handle?.dispose === 'function') await handle.dispose()
        },
      })
    },
  })
}
