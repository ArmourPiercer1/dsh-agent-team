/**
 * REJECTED CANDIDATE (root final e438 consolidation card, 2026-10-25) — NOT
 * a pairing, NOT ready, UNREACHABLE behind the restored workflow block
 * (1e731166). Defects accepted without contest: routing here keys on the
 * team plugin's self-declared name, not the engines' ACTUAL resolved
 * Config.provider/subagentProvider; setup supplies restrict, not the REAL
 * Team setup/Guard/PA/IO/durable ownership (production answers no
 * laneRecheck); parent.sessionId is WRONG (live identity = Agent.id) and
 * AgentHandle carries NO result face and no whenIdle on the handle itself (whenIdle lives on handle.agent — corrected per root; settlement must ride the subagents
 * service run law: followup/whenIdle/stopReason/cancel — never an invented
 * result); the parent WeakMap correlation is unsafe under concurrency and
 * the child fingerprint binds no real request; capabilities overclaim
 * (outputSchema/depthLimit are not enforced). The module is kept ONLY as
 * history for the root full-source re-pairing (real Team member create/run
 * chain + per-run seam); acceptance laws:
 * evidence/a5m2-g2-wire/e438-acceptance-laws-round88.md.
 */
/**
 * A5M2-WIRE-G2 THE TEAM-GOVERNED SUBAGENT PROVIDER (pairing A, root/center
 * cards after the c6a50abfa safety block): the named provider the engine
 * configs route to — workflow-ptc Config.provider
 * (workflow-ptc/src/index.ts:106, resolution :75-76/:136
 * ctx.subagents.getProvider) and ralph Config.subagentProvider
 * (tool-ralph Config :24-40, rides start() :445) — WITHOUT replacing the
 * global spawn service (providers coexist by name,
 * subagent/src/index.ts:7; registration is the public
 * subagents.registerProvider :512-527).
 *
 * THE ORDER IS THE LAW (the four pins of the center card):
 *  1. ADMISSION BEFORE CREATION — start() begins with the per-child PA
 *     walk over the plane's ONE funnel (callId derived from the governed
 *     parent call, `parentCallId#child-N` — reversible audit identity, not
 *     a fake UUID; parametersFingerprint rides the parent plan + child
 *     ordinal); a deny/fault/aborted answer throws BEFORE anything exists.
 *  2. RESTRICT BEFORE PUBLICATION — the child is established through the
 *     public agents.create({parentAgent, meta, setup}) (core/agent/src/
 *     index.ts:391, :71-72, :100-116): setup runs AFTER agentCtx is minted
 *     and BEFORE insert/announce, so the member's effective deny lane
 *     lands via the scoped tools.restrict (core/tools/src/index.ts:1097-
 *     1122) before `agent/created` exists; commit() re-validates at the
 *     publication boundary.
 *  3. THROW PUBLISHES NOTHING — setup/commit throw rolls the unpublished
 *     scope back (factory law, :108-116); pre-create refusals created
 *     nothing; a failed create closes the plan.
 *  4. ATTRIBUTION IS REAL — runtime ownership rides parentAgent = the LIVE
 *     member Agent (request.parent, types.ts); the activation rides the
 *     EXISTING Team funnel (runOwnedActivation + teamOwnedSetup/
 *     claimOwnedGeneration, lane agent-bindings :1262-1310); durable
 *     meta.origin 'subagent' + parentSession lineage. No fake member row,
 *     no new ledger, no filter-equivalence.
 *
 * The governed-parent-call context is the shared WeakMap the wiring seat
 * fills at admit (the seat's allow is what makes a dispatch governable);
 * an unknown parent = NO governed context = fail-closed refusal (a child
 * whose parent call cannot be named is never established).
 *
 * @module @dsh-agent-team/runtime/plugin/live/governed-families/team-governed-provider
 */
import { parseRequestedEffectSet } from '../../../../../domain/tool-governance/src/index.js'
import { A5_B_ORCHESTRATION_FAMILY_ID, A5_B_ORCHESTRATION_ADAPTER_REVISION } from './workflow-adapters.mjs'

export const A5_TGP_CODES = Object.freeze({
  INPUT_INVALID: 'P_TGP_INPUT_INVALID',
  NO_PARENT_CONTEXT: 'P_TGP_NO_PARENT_CONTEXT',
  CANCELLED: 'P_TGP_CANCELLED',
  PA_FAULT: 'P_TGP_PA_FAULT',
  DENIED: 'P_TGP_DENIED',
  LANE_ABSENT: 'P_TGP_LANE_ABSENT',
  CREATE_FAULT: 'P_TGP_CREATE_FAULT',
  UNSUPPORTED_CAPABILITY: 'P_TGP_UNSUPPORTED_CAPABILITY',
  DELIVERY_UNBOUND: 'P_TGP_DELIVERY_UNBOUND',
  DELIVERY_UNCORRELATED: 'P_TGP_DELIVERY_UNCORRELATED',
  DELIVERY_FAILED: 'P_TGP_DELIVERY_FAILED',
  DELIVERY_UNAVAILABLE: 'P_TGP_DELIVERY_UNAVAILABLE',
  DELIVERY_STATUS_UNKNOWN: 'P_TGP_DELIVERY_STATUS_UNKNOWN',
  LANE_MOVED_AT_COMMIT: 'P_TGP_LANE_MOVED_AT_COMMIT',
})

const CODES = A5_TGP_CODES

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

const tgpThrow = (code, detail) => Object.assign(new Error(`team-governed-provider refused: ${code} — ${detail}`), { code, tgpRefusal: { code, detail } })

export const A5_TGP_DEFAULT_PROVIDER_NAME = 'team-governed-spawn'

/**
 * C1 (root ruling 2026-10-25): the FROZEN WorkDeliveryResult (admission/
 * types.ts:559 — { requestToken, status: succeeded|failed|unavailable,
 * body?, error? }) maps to the run's settlement through THIS function and
 * nothing else. 'settled' alone never maps (the DTO law). succeeded maps
 * ONLY with a readable NON-EMPTY body (ContentBlock text); failed and
 * unavailable NEVER produce success — they throw carrying the DTO's own
 * error bytes. The requestToken echo is verified (corruption of the
 * correlation is fail-closed, not re-mapping). No runner is invented:
 * this is normalization of the real chain's answer (the existing consumer
 * at agent-bindings :8012-8095: prepare -> followup([team-work
 * requestToken=…]) -> whenIdle -> ensureMaterialized -> readDeliveredWorkTurn).
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
 * Build the Team-governed provider. Input (all REQUIRED unless noted):
 * { name?, agents: {create}, pa: walk=>Promise & {closePlan}, teamActivation:
 *   {runOwned(sid, operation), wrapSetup(sid, setup)}, laneResolver:
 *   (memberAgent) => { deny: string[] } | null, activeCalls: WeakMap (shared
 *   with the wiring seat), laneRecheck?: () => boolean, observe? }
 */
export function createTeamGovernedSubagentProvider (input = {}) {
  if (!isRecord(input)) return Object.freeze({ ok: false, code: CODES.INPUT_INVALID, message: 'one input record' })
  for (const [key, check] of [
    ['agents', (v) => isRecord(v) && typeof v.create === 'function'],
    ['pa', (v) => typeof v === 'function'],
    ['teamActivation', (v) => isRecord(v) && typeof v.runOwned === 'function' && typeof v.wrapSetup === 'function'],
    ['laneResolver', (v) => typeof v === 'function'],
    ['activeCalls', (v) => v instanceof WeakMap],
  ]) {
    if (!check(input[key])) {
      return Object.freeze({ ok: false, code: CODES.INPUT_INVALID, message: `${key} is REQUIRED — the provider cannot run with a stand-in for the ${key} seam (admission, creation, the Team funnel, the lane, and the parent-call context are all real faces)` })
    }
  }
  const name = typeof input.name === 'string' && input.name.length > 0 ? input.name : A5_TGP_DEFAULT_PROVIDER_NAME
  const observe = typeof input.observe === 'function' ? input.observe : () => {}
  const closePlan = (callId) => { try { input.pa.closePlan?.(callId) } catch { /* funnel best-effort */ } }

  return Object.freeze({
    name,
    // one-shot delegation only; the truthful descriptive facts: the child
    // world is the RESTRICTED composition, not the parent's completed prefix.
    // CAPABILITIES HONESTY (root ruling): a provider declares ONLY what its
    // start() actually enforces — outputSchema/depthLimit are NOT
    // implemented, so they are declared FALSE and any request touching them
    // is typed-refused below (the functional gaps stay on the MUST-DELIVER
    // list, not on the capabilities face).
    capabilities: Object.freeze({ agentOptions: true, outputSchema: false, depthLimit: false, toolFilter: false, persona: false }),
    inheritsParentContext: false,
    /** PIN 1 — admission before creation; PIN 4 — attribution from the request. */
    async start (request) {
      const parent = isRecord(request) ? request.parent : undefined
      if (parent === undefined || parent === null) throw tgpThrow(CODES.NO_PARENT_CONTEXT, 'request.parent is absent — a Team-governed child is attributed to the LIVE parent Agent, nothing else')
      const entry = input.activeCalls.get(parent)
      if (!isRecord(entry) || typeof entry.callId !== 'string' || typeof entry.parametersFingerprint !== 'string' || typeof entry.realmId !== 'string') {
        // fail-closed: a child whose governing parent call cannot be named
        // is never established (no governed context = no child).
        throw tgpThrow(CODES.NO_PARENT_CONTEXT, 'the parent Agent carries no governed call context — children start only under an admitted B-ORCHESTRATION call on this exact parent')
      }
      const signal = request.signal
      if (request.outputSchema !== undefined || request.maxDepth !== undefined || request.toolFilter !== undefined || request.persona !== undefined) {
        // undeclared capability demanded: refuse BEFORE anything exists
        throw tgpThrow(CODES.UNSUPPORTED_CAPABILITY, 'this provider declares outputSchema/depthLimit/toolFilter/persona FALSE and enforces them nowhere — a request touching them is refused typed (the capability gap is a MUST-DELIVER item, never a silent ignore)')
      }
      if (signal?.aborted === true) throw tgpThrow(CODES.CANCELLED, 'the caller signal was already aborted before the child admission opened')
      entry.ordinal = (entry.ordinal ?? 0) + 1
      const childCallId = `${entry.callId}#child-${entry.ordinal}`
      const parsed = parseRequestedEffectSet([{ kind: 'tool-invoke', toolName: entry.toolName, resource: null }])
      if (parsed?.ok !== true) throw tgpThrow(CODES.PA_FAULT, `the domain parser refused the child effect request: ${String(parsed?.detail ?? 'unparsable')}`)
      const walk = Object.freeze({
        realmId: entry.realmId,
        callId: childCallId,
        parametersFingerprint: `${entry.parametersFingerprint}+child#${entry.ordinal}`,
        requestedEffects: parsed.value,
        toolName: entry.toolName,
        family: Object.freeze({
          familyId: A5_B_ORCHESTRATION_FAMILY_ID,
          adapterRevision: A5_B_ORCHESTRATION_ADAPTER_REVISION,
          providerIdentity: entry.providerIdentity ?? 'a5p5-plane',
          targetManifest: Object.freeze({
            addressClaim: null,
            childOf: entry.callId,
            childOrdinal: entry.ordinal,
            attribution: 'live parent Agent (request.parent) + runOwned activation + durable origin/lineage',
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
      // PIN 4: the lane comes from the Team's own permission facts; without
      // lane facts there is NO publish (no unrestricted child, ever).
      // SETTLEMENT PRECHECK (C1 + root C2 ruling 2026-10-25): publish only
      // when the settlement chain is real and bound. The per-run closure
      // (registered per exec.token, reclaimed at the run's settlement /
      // dispose - NEVER at the outer tool return) carries the
      // ACTIVATION-COMMITTED facts: rootSessionId, the admitted member s
      // durable instanceId (durableMemberInstance is committed by activation
      // - nothing here may invent one), and the real workDelivery port (the
      // existing consumer chain: prepare, followup [team-work requestToken],
      // whenIdle, ensureMaterialized, readDeliveredWorkTurn). Unbound means
      // typed refusal BEFORE creation: no invented runner, no handle.result
      // fiction, no fabricated instanceId direct to childFactory.
      const binding = isRecord(input.settlement) ? input.settlement : null
      if (binding === null || typeof binding.workDelivery?.deliver !== 'function' || typeof binding.rootSessionId !== 'string' || binding.rootSessionId.length === 0 || typeof binding.instanceId !== 'string' || binding.instanceId.length === 0) {
        closePlan(childCallId)
        throw tgpThrow(CODES.DELIVERY_UNBOUND, 'the settlement binding (activation-committed rootSessionId + durable member instanceId + the real workDelivery port) is unanswerable for this run - a child whose result cannot ride the REAL chain is never published')
      }
      const promptText = Array.isArray(request.prompt) ? request.prompt.filter((b) => isRecord(b) && b.type === 'text').map((b) => String(b.text ?? '')).join('\n') : ''
      if (promptText.length === 0) {
        closePlan(childCallId)
        throw tgpThrow(CODES.DELIVERY_UNBOUND, 'the delegation carried no model-visible text prompt - nothing can be delivered, so nothing is claimed')
      }
      const lane = input.laneResolver(parent)
      if (!isRecord(lane) || !Array.isArray(lane.deny) || lane.deny.some((n) => typeof n !== 'string' || n.length === 0)) {
        closePlan(childCallId)
        throw tgpThrow(CODES.LANE_ABSENT, 'the member lane (effective deny lane) cannot be answered — an ungoverned child surface is never published')
      }
      const laneDisposers = []
      const sessionId = globalThis.crypto?.randomUUID?.() ?? `tgp-${childCallId}`
      const setup = async (childCtx, _childAgent) => {
        // PIN 2: restrict lands BEFORE publication (setup runs pre-insert/
        // announce by the factory's own law, core/agent :100-116).
        if (lane.deny.length > 0) {
          if (typeof childCtx?.tools?.restrict !== 'function') throw tgpThrow(CODES.LANE_ABSENT, 'the child scoped context answers no tools.restrict face — the lane cannot be installed before publication')
          laneDisposers.push(childCtx.tools.restrict({ deny: [...lane.deny] }))
        }
        observe({ event: 'tgp:lane-installed', callId: childCallId, denies: lane.deny.length })
        return {
          commit () {
            // the publication-boundary re-check (core/agent :39-45): the
            // lane must still be the one the parent call was admitted under.
            if (typeof input.laneRecheck === 'function' && input.laneRecheck() !== true) {
              throw tgpThrow(CODES.LANE_MOVED_AT_COMMIT, 'the lane moved while the child was being composed — publication rolls back (PIN 3: nothing is announced)')
            }
          },
        }
      }
      // PIN 4: the creation rides the EXISTING Team activation funnel
      // (runOwned + teamOwnedSetup/claimOwnedGeneration), PIN 2 setup rides
      // the public create seam. PIN 3: any throw publishes nothing (the
      // factory rolls the unpublished scope back; lane disposers of an
      // unpublished scope die with it).
      let handle
      try {
        handle = await input.teamActivation.runOwned(sessionId, () => input.agents.create({
          sessionId,
          parentAgent: parent,
          meta: Object.freeze({
            origin: 'subagent',
            ...(typeof parent.sessionId === 'string' && parent.sessionId.length > 0 ? { parentSession: parent.sessionId } : {}),
          }),
          ...(isRecord(request.agentOptions) ? { agentOptions: request.agentOptions } : {}),
          ...(signal === undefined ? {} : { signal }),
          setup: input.teamActivation.wrapSetup(sessionId, setup),
        }))
      } catch (error) {
        closePlan(childCallId)
        observe({ event: 'tgp:create-fault', callId: childCallId })
        if (error instanceof Error && error.code === CODES.LANE_MOVED_AT_COMMIT) throw error
        throw tgpThrow(CODES.CREATE_FAULT, `the governed create failed and published nothing: ${String(error?.message ?? error).slice(0, 180)}`)
      }
      observe({ event: 'tgp:child-published', callId: childCallId, sessionId })
      // SETTLEMENT (C1): the frozen WorkDeliveryResult of the REAL chain,
      // normalized by mapWorkDeliveryResult; the token is minted from THIS
      // run's own closure and echoed-verified, never re-mapped.
      const requestToken = `tgp:${childCallId}:${sessionId}`
      const settlement = binding.workDelivery.deliver({
        rootSessionId: binding.rootSessionId,
        instanceId: binding.instanceId,
        childSessionId: sessionId,
        requestToken,
        prompt: promptText,
        ...(signal === undefined ? {} : { signal }),
      }).then((dto) => mapWorkDeliveryResult(dto, requestToken))
      return Object.freeze({
        runId: sessionId,
        provider: name,
        id: sessionId,
        local: true,
        localAgent: isRecord(handle) ? handle.agent : undefined,
        result: settlement,
        dispose: async () => {
          for (const d of laneDisposers.splice(0).reverse()) { try { d?.() } catch { /* best-effort, exactly once */ } }
          if (typeof handle?.dispose === 'function') await handle.dispose()
        },
      })
    },
  })
}
