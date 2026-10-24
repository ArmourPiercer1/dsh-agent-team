/**
 * governed-families/present.mjs — A5M2 B-PRESENT family wiring (root 整族
 * 连续推进令, 2026-10-24; M0-B record 51 `present`; proposed implementation
 * path per M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX.json = THIS file).
 *
 * This is the RUNNABLE slice over the earlier g1-present-arm.mjs refusal
 * slot — the slot file is KEPT untouched as the anti-冒升 floor (this file
 * does not edit or replace it; the slot refuses mounts aimed at it, this
 * wiring is the explicit consumer path with the row's OWN commit law).
 *
 * WHAT MAKES THE WIRING HONEST (verified @639ed01539 read-only, deliverables
 * /tool-present/src/index.ts): the real body requires exec.agent (its own
 * session header cwd), ctx.sessionProjections.stateOf(session,'turnBoundary')
 * with an OPEN turn, 1..config.maxFiles files, ctx.fs lstat/resolve/stat per
 * file, and returns {turn: boundary.lastTurn, files}. THE COMMIT IS NOT THE
 * RESOLVE: the durable witness is the SAME-EXEC tools/result listener's
 * session.append('deliverables/presented') carrying the exec callId and the
 * native result's OWN turn. The consumed row exposes exactly that law
 * (delegate -> RESULT-PENDING-SESSION-APPEND + commitWitness(plan, witness)
 * with CODES.PRESENT_COMMIT_WITNESS_MISMATCH for any witness that is not
 * (planCallId, native turn, trusted sessionHeaderId)) — this wiring
 * CONSUMES it and surfaces the bound commitWitness on the result; it
 * invents no second commit channel.
 *
 * TRUSTED AGENT = MOUNT-TIME CONFIG FACE (input.agent), never a model
 * parameter (M0-B identity law; the family C1 path/audience validation
 * rides the row's resource-grammar effects + the host body's own fs gates).
 * Path legality grammar (relative → workspace, OS-absolute → GOVERNED
 * absolute-path effects decided by the approval lane — never a blanket
 * refuse, never a silent allow) is the CONSUMED row/classify law.
 *
 * TIER: wiring only — 接线未测; no boot; existing G1 blocks READ-ONLY.
 */

import { A5_G1_ADAPTER_REVISION, mountG1SurfaceAdapter } from './g1-surface-adapters.mjs'

export const A5_G1_PRESENT_FAMILY = 'B-PRESENT'
export const A5_G1_PRESENT_WIRING_REVISION = 1

export const A5_G1_PRESENT_FAMILY_ENTRY = Object.freeze({
  familyId: A5_G1_PRESENT_FAMILY,
  contractRef: 'M0-B-FAMILY-TARGET-CONTRACTS.md#B-PRESENT',
  indexRef: 'M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX.json record 51',
  records: Object.freeze({ present: 51 }),
  implementationPathProposed: 'packages/runtime/src/plugin/live/governed-families/present.mjs',
  consumedAdapter: Object.freeze({ module: 'governed-families/g1-surface-adapters.mjs', revision: A5_G1_ADAPTER_REVISION }),
  commitLaw: 'the native promise resolving is NOT the commit; the SAME-EXEC session append (deliverables/presented) carrying the exec callId AND the native result\'s own turn witnesses it — an arbitrary integer is no witness',
})

export const A5_G1_PRESENT_WIRING_CODES = Object.freeze({
  INPUT_INVALID: 'P_G1_PRESENT_WIRING_INPUT_INVALID',
  MOUNT_REFUSED: 'P_G1_PRESENT_WIRING_MOUNT_REFUSED',
  ADMISSION_CANCELLED: 'P_G1_PRESENT_WIRING_ADMISSION_CANCELLED',
  APPROVAL_NOT_LANDED: 'P_G1_PRESENT_WIRING_APPROVAL_NOT_LANDED',
  EDGE_CANCELLED: 'P_G1_PRESENT_WIRING_EDGE_CANCELLED',
  CONSUME_PROOF_MISSING: 'P_G1_PRESENT_WIRING_CONSUME_PROOF_MISSING',
  PLAN_DRIFT: 'P_G1_PRESENT_WIRING_PLAN_DRIFT',
})

const WIRING_INPUT_KEYS = Object.freeze(['realmId', 'providerId', 'name', 'native', 'definitionIdentity', 'trusted', 'bindingFacts', 'agent', 'pa', 'observe'])

const isRecord = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const refuse = (code, detail) => Object.freeze({ ok: false, code, detail })

export function createG1PresentWiring (input = {}) {
  if (!isRecord(input)) return refuse(A5_G1_PRESENT_WIRING_CODES.INPUT_INVALID, 'the present wiring takes exactly one plain record')
  for (const key of Object.keys(input)) {
    if (!WIRING_INPUT_KEYS.includes(key)) {
      return refuse(A5_G1_PRESENT_WIRING_CODES.INPUT_INVALID, `unknown wiring input key '${key}' — the block takes exactly {${WIRING_INPUT_KEYS.join(', ')}}`)
    }
  }
  const { realmId, providerId, name, native, definitionIdentity, trusted, bindingFacts, agent, pa, observe } = input
  if (typeof realmId !== 'string' || realmId.length === 0) return refuse(A5_G1_PRESENT_WIRING_CODES.INPUT_INVALID, 'realmId must be a non-empty string — the PA walk is realm-bound')
  if (typeof providerId !== 'string' || providerId.length === 0) return refuse(A5_G1_PRESENT_WIRING_CODES.INPUT_INVALID, 'providerId must be a non-empty string')
  if (name !== 'present') {
    return refuse(A5_G1_PRESENT_WIRING_CODES.INPUT_INVALID, 'name must be \'present\' — B-PRESENT carries exactly record 51 (one-name-one-mount)')
  }
  if (!(typeof pa === 'function' && typeof pa.open === 'function' && typeof pa.edge === 'function' && typeof pa.closePlan === 'function')) {
    return refuse(A5_G1_PRESENT_WIRING_CODES.INPUT_INVALID, 'pa is REQUIRED in its published shape — the plane\'s paAdmit face (a CALLABLE with open / edge / closePlan) — with no admission seat nothing may be exposed')
  }
  // THE TRUSTED AGENT CONFIG FACE: the member's own agent (session header
  // cwd + the durable append channel). NEVER a model parameter.
  if (!isRecord(agent) || !isRecord(agent.session) || typeof agent.session.append !== 'function') {
    return refuse(A5_G1_PRESENT_WIRING_CODES.INPUT_INVALID, 'agent is REQUIRED as the mount-time trusted member agent CONFIG face (carrying session.append for the durable deliverables/presented commit) — a model-named session never poses here (C1 只准当前会话/owner)')
  }
  const observeLine = (event) => { if (typeof observe === 'function') observe(event) }

  let row
  try {
    row = mountG1SurfaceAdapter('present', { native, providerId, definitionIdentity, trusted, bindingFacts })
  } catch (error) {
    return refuse(A5_G1_PRESENT_WIRING_CODES.MOUNT_REFUSED, `the consumed G1 mount law refused the supply face: ${String(error?.message ?? error).slice(0, 220)} — nothing mounted, zero native entry`)
  }

  async function execute (args, { callId, signal } = {}) {
    if (typeof callId !== 'string' || callId.length === 0) {
      return refuse(A5_G1_PRESENT_WIRING_CODES.INPUT_INVALID, 'execute needs the call identity the PA edge AND the commit witness both bind to')
    }
    const classified = row.classify(args, callId)
    if (classified.ok !== true) {
      observeLine({ event: 'present-wire:classify-REFUSED', name, callId, code: classified.code })
      return classified
    }
    const walk = Object.freeze({
      realmId,
      callId,
      parametersFingerprint: classified.parametersFingerprint,
      requestedEffects: classified.effects,
      toolName: name,
      family: classified.reviewPayload,
      ...(signal === undefined ? {} : { signal }),
    })
    try {
      const opened = await pa.open(walk)
      if (opened?.cancelled === true) {
        return refuse(A5_G1_PRESENT_WIRING_CODES.ADMISSION_CANCELLED, `${name}: cancelled at the PA open edge before admission — zero exposure`)
      }
      if (opened?.kind === 'deny') return opened
      if (opened?.kind !== 'approved' || opened.grant === undefined || opened.grant === null) {
        return refuse(A5_G1_PRESENT_WIRING_CODES.APPROVAL_NOT_LANDED, `${name}: the admission answered ${String(opened?.kind ?? 'unsettled')} without a landed grant — zero exposure`)
      }
      const edge = await pa.edge(Object.freeze({
        ...walk,
        grant: opened.grant,
        ...(opened.request === undefined ? {} : { request: opened.request }),
        ...(opened.placementName === undefined ? {} : { placementName: opened.placementName }),
      }))
      if (edge?.cancelled === true) {
        return refuse(A5_G1_PRESENT_WIRING_CODES.EDGE_CANCELLED, `${name}: cancelled at the execution edge — the approval stays unspent and is never replayed; zero exposure`)
      }
      if (edge?.kind === 'deny') return edge
      const proof = edge?.consumedProof
      if (!isRecord(proof) || !isRecord(proof.grant) || typeof proof.grant.grantId !== 'string') {
        return refuse(A5_G1_PRESENT_WIRING_CODES.CONSUME_PROOF_MISSING, `${name}: the execution edge answered allow without its one-shot consume witness — the bridge never self-attests consumption; nothing was exposed`)
      }
      const rebound = row.classify(classified.plan.classifiedArgs, callId)
      if (rebound.ok !== true || rebound.parametersFingerprint !== classified.parametersFingerprint) {
        observeLine({ event: 'present-wire:plan-DRIFT', name, callId })
        return refuse(A5_G1_PRESENT_WIRING_CODES.PLAN_DRIFT, `${name}: the plan facts moved between the approved plan and the body — the grant was issued for the frozen plan; zero exposure`)
      }
      const ran = await row.delegate(classified.plan, { exec: { callId, signal, agent } })
      if (ran?.ok !== true) {
        observeLine({ event: 'present-wire:delegate-REFUSED', name, callId, code: ran?.code })
        return ran
      }
      observeLine({ event: 'present-wire:DELEGATED-PENDING-APPEND', name, callId })
      return ran
    } finally {
      try { await pa.closePlan(Object.freeze({ ...walk, settled: true })) }
      catch (error) { observeLine({ event: 'present-wire:closePlan-ERROR', name, callId, detail: String(error?.message ?? error).slice(0, 120) }) }
    }
  }

  return Object.freeze({
    ok: true,
    familyId: A5_G1_PRESENT_FAMILY,
    wiringRevision: A5_G1_PRESENT_WIRING_REVISION,
    name,
    recordIndex: 51,
    row,
    execute,
    familyEntry: A5_G1_PRESENT_FAMILY_ENTRY,
  })
}
