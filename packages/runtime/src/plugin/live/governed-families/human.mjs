/**
 * governed-families/human.mjs — A5M2 B-HUMAN family wiring (root 整族连续
 * 推进令, 2026-10-24; M0-B records 49 `ask_user_question` / 50
 * `exit_plan_mode`; proposed implementation path per
 * M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX.json = THIS file).
 *
 * ONE-NAME-ONE-MOUNT vertical slice: each wiring instance arms EXACTLY ONE
 * family record (input.name), consumed row-for-row from the frozen
 * g1-surface-adapters mount law (READ-ONLY territory: nothing existing is
 * edited; the row's classify/delegate law, the trusted five-face CONFIG, the
 * same-name capture rule and the one-shot plan ledger are CONSUMED, never
 * re-implemented). This slice arms `ask_user_question` first; the contract
 * (M0-B §B-HUMAN) is carried as the family table entry below.
 *
 * FAMILY LAW carried factually (M0-B-FAMILY-TARGET-CONTRACTS.md §B-HUMAN):
 * 目标 I + S(owner session + question/mode incarnation, ask/exit-plan),
 * 问题/选项 digest, 退出所需现 Host approval; owner SERVICE; P = Team 前置
 * 准入之后保留 Host 人类交互门 — the Team PA gate (open/edge/closePlan
 * below) runs BEFORE the captured native ask, and the native/host human
 * gate is KEPT, never replaced; 用户回答只属于对应问题 (the row's one-shot
 * plan ledger + the callId-bound question are the mechanical carriers —
 * an answer is data for THAT question, never a tool allow); C1 只准当前
 * 会话 (the trusted.sessionHeaderId rides the plan's targetManifest from
 * the CONFIG face — no model parameter can name another session).
 *
 * REAL-MINT verified @639ed01539 (read-only base, cited per face):
 *  ask_user_question  packages/interaction/tool-ask-user/src/index.ts:
 *    register @:36 (defineTool), parameters.questions array (id/question
 *    required; header/options/multi_select optional), body
 *    ctx.userQuestions.ask({questions(multi_select→multiSelect),
 *    agent?, signal}) @:100-113; answer face {answers:[{id,selected[],
 *    custom?}]}. user-questions seam: ask(request) @user-questions/src/
 *    index.ts:287.
 *  exit_plan_mode     packages/plan/plan-mode/src/index.ts: const
 *    EXIT_PLAN_MODE @:67, register @:278; gates: calling agent REQUIRED,
 *    loggedActive session gate, '# heading' plan shape, review rides
 *    ctx.get('userQuestions').ask with intent {kind:'plan-review',
 *    approve, callId} — plan-review rides the SAME human channel, scoped
 *    to THIS callId.
 *
 * TIER: wiring only — 接线未测 until a real Host acceptance; no boot, no
 * plane edit, no shared-seam touch (CENTER single-writer law).
 */

import { A5_G1_ADAPTER_REVISION, mountG1SurfaceAdapter } from './g1-surface-adapters.mjs'

export const A5_G1_HUMAN_FAMILY = 'B-HUMAN'
export const A5_G1_HUMAN_WIRING_REVISION = 1

/** The family table entry (M0-B carriers; read-only facts, cited). */
export const A5_G1_HUMAN_FAMILY_ENTRY = Object.freeze({
  familyId: A5_G1_HUMAN_FAMILY,
  contractRef: 'M0-B-FAMILY-TARGET-CONTRACTS.md#B-HUMAN',
  indexRef: 'M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX.json records 49/50',
  records: Object.freeze({ ask_user_question: 49, exit_plan_mode: 50 }),
  implementationPathProposed: 'packages/runtime/src/plugin/live/governed-families/human.mjs',
  consumedAdapter: Object.freeze({ module: 'governed-families/g1-surface-adapters.mjs', revision: A5_G1_ADAPTER_REVISION }),
  mountLaw: 'one-name-one-mount — every wiring instance arms exactly ONE record; family table entries are contract facts, not mount fan-out',
})

export const A5_G1_HUMAN_WIRING_CODES = Object.freeze({
  INPUT_INVALID: 'P_G1_HUMAN_INPUT_INVALID',
  MOUNT_REFUSED: 'P_G1_HUMAN_MOUNT_REFUSED',
  ADMISSION_CANCELLED: 'P_G1_HUMAN_ADMISSION_CANCELLED',
  APPROVAL_NOT_LANDED: 'P_G1_HUMAN_APPROVAL_NOT_LANDED',
  EDGE_CANCELLED: 'P_G1_HUMAN_EDGE_CANCELLED',
  CONSUME_PROOF_MISSING: 'P_G1_HUMAN_CONSUME_PROOF_MISSING',
  PLAN_DRIFT: 'P_G1_HUMAN_PLAN_DRIFT',
})

const WIRING_INPUT_KEYS = Object.freeze(['realmId', 'providerId', 'name', 'native', 'definitionIdentity', 'trusted', 'bindingFacts', 'pa', 'observe'])

const isRecord = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const refuse = (code, detail) => Object.freeze({ ok: false, code, detail })

/**
 * Arm ONE B-HUMAN record. Every refusal is typed; a defective supply face
 * never half-mounts; there is no silent native fallback anywhere (the only
 * path to the native body runs through the consumed row's own one-shot plan
 * ledger AFTER the PA edge landed its consume witness).
 */
export function createG1HumanWiring (input = {}) {
  if (!isRecord(input)) return refuse(A5_G1_HUMAN_WIRING_CODES.INPUT_INVALID, 'the human wiring takes exactly one plain record')
  for (const key of Object.keys(input)) {
    if (!WIRING_INPUT_KEYS.includes(key)) {
      return refuse(A5_G1_HUMAN_WIRING_CODES.INPUT_INVALID, `unknown wiring input key '${key}' — the block takes exactly {${WIRING_INPUT_KEYS.join(', ')}}`)
    }
  }
  const { realmId, providerId, name, native, definitionIdentity, trusted, bindingFacts, pa, observe } = input
  if (typeof realmId !== 'string' || realmId.length === 0) return refuse(A5_G1_HUMAN_WIRING_CODES.INPUT_INVALID, 'realmId must be a non-empty string — the PA walk is realm-bound')
  if (typeof providerId !== 'string' || providerId.length === 0) return refuse(A5_G1_HUMAN_WIRING_CODES.INPUT_INVALID, 'providerId must be a non-empty string')
  if (!Object.hasOwn(A5_G1_HUMAN_FAMILY_ENTRY.records, name)) {
    return refuse(A5_G1_HUMAN_WIRING_CODES.INPUT_INVALID, `name must be ONE B-HUMAN record (${Object.keys(A5_G1_HUMAN_FAMILY_ENTRY.records).join(' | ')}) — one-name-one-mount; other families ride their own wiring (cross-family fan-out forbidden)`)
  }
  // THE REAL SEAT: paAdmit itself — a CALLABLE carrying open/edge/closePlan
  // (the consumed G1/G6 seat law; nothing else poses as admission).
  if (!(typeof pa === 'function' && typeof pa.open === 'function' && typeof pa.edge === 'function' && typeof pa.closePlan === 'function')) {
    return refuse(A5_G1_HUMAN_WIRING_CODES.INPUT_INVALID, 'pa is REQUIRED in its published shape — the plane\'s paAdmit face (a CALLABLE with open / edge / closePlan) — with no admission seat no governed call may enter the human channel')
  }
  const observeLine = (event) => { if (typeof observe === 'function') observe(event) }

  let row
  try {
    // CONSUME the frozen mount law verbatim (trusted CONFIG five-face,
    // same-name capture, definitionIdentity, one-shot ledger — all enforced
    // THERE; a TypeError is a supply fact translated below, never a fallback).
    row = mountG1SurfaceAdapter(name, { native, providerId, definitionIdentity, trusted, bindingFacts })
  } catch (error) {
    return refuse(A5_G1_HUMAN_WIRING_CODES.MOUNT_REFUSED, `the consumed G1 mount law refused the supply face: ${String(error?.message ?? error).slice(0, 220)} — nothing mounted, zero native entry`)
  }

  /**
   * The governed single call: classify (the row's closed-shape law) → PA
   * open (approval) → PA edge (one-shot consume witness) → fingerprint
   * re-bind → the row's OWN delegate → closePlan settlement. The native
   * human gate (userQuestions.ask behind the captured body) runs LAST and
   * stays KEPT — Team PA never stands in for the human answer.
   */
  async function execute (args, { callId, signal } = {}) {
    if (typeof callId !== 'string' || callId.length === 0) {
      return refuse(A5_G1_HUMAN_WIRING_CODES.INPUT_INVALID, 'execute needs the call identity the PA edge binds to')
    }
    const classified = row.classify(args, callId)
    if (classified.ok !== true) {
      observeLine({ event: 'human-wire:classify-REFUSED', name, callId, code: classified.code })
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
        return refuse(A5_G1_HUMAN_WIRING_CODES.ADMISSION_CANCELLED, `${name}: cancelled at the PA open edge before admission — zero question delivered`)
      }
      if (opened?.kind === 'deny') return opened
      if (opened?.kind !== 'approved' || opened.grant === undefined || opened.grant === null) {
        return refuse(A5_G1_HUMAN_WIRING_CODES.APPROVAL_NOT_LANDED, `${name}: the admission answered ${String(opened?.kind ?? 'unsettled')} without a landed grant — internal state never substitutes for the kernel answer; zero question delivered`)
      }
      const edge = await pa.edge(Object.freeze({
        ...walk,
        grant: opened.grant,
        ...(opened.request === undefined ? {} : { request: opened.request }),
        ...(opened.placementName === undefined ? {} : { placementName: opened.placementName }),
      }))
      if (edge?.cancelled === true) {
        return refuse(A5_G1_HUMAN_WIRING_CODES.EDGE_CANCELLED, `${name}: cancelled at the execution edge — the approval stays unspent and is never replayed; zero question delivered`)
      }
      if (edge?.kind === 'deny') return edge
      const proof = edge?.consumedProof
      if (!isRecord(proof) || !isRecord(proof.grant) || typeof proof.grant.grantId !== 'string') {
        return refuse(A5_G1_HUMAN_WIRING_CODES.CONSUME_PROOF_MISSING, `${name}: the execution edge answered allow without its one-shot consume witness — the bridge never self-attests consumption; the question was not delivered`)
      }
      // RE-BIND before the body: the CURRENT classify of the frozen
      // approved args must still answer the approved fingerprint — a plan
      // that moved between the grant and the body refuses, zero native entry.
      const rebound = row.classify(classified.plan.classifiedArgs, callId)
      if (rebound.ok !== true || rebound.parametersFingerprint !== classified.parametersFingerprint) {
        observeLine({ event: 'human-wire:plan-DRIFT', name, callId })
        return refuse(A5_G1_HUMAN_WIRING_CODES.PLAN_DRIFT, `${name}: the plan facts moved between the approved plan and the body — the grant was issued for the frozen plan; zero question delivered`)
      }
      const ran = await row.delegate(classified.plan, { exec: { callId, ...(signal === undefined ? {} : { signal }) } })
      if (ran?.ok !== true) {
        observeLine({ event: 'human-wire:delegate-REFUSED', name, callId, code: ran?.code })
        return ran
      }
      observeLine({ event: 'human-wire:EXECUTED', name, callId })
      return ran
    } finally {
      try { await pa.closePlan(Object.freeze({ ...walk, settled: true })) }
      catch (error) { observeLine({ event: 'human-wire:closePlan-ERROR', name, callId, detail: String(error?.message ?? error).slice(0, 120) }) }
    }
  }

  return Object.freeze({
    ok: true,
    familyId: A5_G1_HUMAN_FAMILY,
    wiringRevision: A5_G1_HUMAN_WIRING_REVISION,
    name,
    recordIndex: A5_G1_HUMAN_FAMILY_ENTRY.records[name],
    row,
    execute,
    familyEntry: A5_G1_HUMAN_FAMILY_ENTRY,
  })
}
