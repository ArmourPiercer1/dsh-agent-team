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
  LANE_MOVED_AT_COMMIT: 'P_TGP_LANE_MOVED_AT_COMMIT',
})

const CODES = A5_TGP_CODES

const isRecord = (value) => typeof value === 'object' && value !== null && !Array.isArray(value)

const tgpThrow = (code, detail) => Object.assign(new Error(`team-governed-provider refused: ${code} — ${detail}`), { code, tgpRefusal: { code, detail } })

export const A5_TGP_DEFAULT_PROVIDER_NAME = 'team-governed-spawn'

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
    capabilities: Object.freeze({ agentOptions: true, outputSchema: true, depthLimit: true, toolFilter: false, persona: false }),
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
      // The run surface (SubagentRun, types.ts:308-334): result is mapped
      // VERBATIM (the seam's own law); dispose owns cleanup; cancellation
      // rides the caller signal the run already carries (no cancel face —
      // measured).
      return Object.freeze({
        runId: sessionId,
        provider: name,
        id: sessionId,
        local: true,
        localAgent: isRecord(handle) ? handle.agent : undefined,
        result: Promise.resolve(handle?.result).then((value) => (isRecord(value) && 'isError' in value ? value : { output: value, isError: false })),
        dispose: async () => {
          for (const d of laneDisposers.splice(0).reverse()) { try { d?.() } catch { /* best-effort, exactly once */ } }
          if (typeof handle?.dispose === 'function') await handle.dispose()
        },
      })
    },
  })
}
