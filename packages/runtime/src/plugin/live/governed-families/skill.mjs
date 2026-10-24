/**
 * governed-families/skill.mjs — A5M2 B-SKILL family wiring (root 整族连续
 * 推进令, 2026-10-24; M0-B record 24 `skill`; proposed implementation path
 * per M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX.json = THIS file). The old lane
 * line "臂归属候根" is void — root assigned this family to this lane.
 *
 * Consumes the frozen g1-surface-adapters mount law (READ-ONLY territory)
 * exactly as human.mjs does: the trusted CONFIG five-face, the same-name
 * capture, the one-shot plan ledger, and the TRUSTED CATALOG CURRENT-facts
 * port (classify gates AND re-verifies at the consumption edge — a captured
 * snapshot can never justify a later get, per the row's own law).
 *
 * FAMILY LAW carried factually (M0-B §B-SKILL): 目标 I + S(skill catalog
 * namespace + skillId + version, read/load) + S(current session prompt,
 * inject, write); 加载内容是数据,不形成授权 — the loaded content is DATA;
 * every tool a skill later names still rides its own admission. The E
 * model-invocable double gate and the user-gesture boundary stay inside the
 * CAPTURED host body (verified @639ed01539: tool-skill/src/index.ts
 * defineTool @:81 register @:161, ctx.skills.list/get over the agent-scoped
 * lookup, isModelInvocable gates :138/:145 = skill/src/index.ts
 * invocation.modelInvocable) — the wiring never re-implements nor replaces
 * them; C1 "kind:user 不得模型伪造" is enforced by the host's OWN gate
 * behind the delegate, and a refusal THROWN there propagates unchanged
 * (the bridge swallows nothing).
 *
 * TIER: wiring only — 接线未测; no boot, no plane/bindings touch.
 */

import { A5_G1_ADAPTER_REVISION, mountG1SurfaceAdapter } from './g1-surface-adapters.mjs'

export const A5_G1_SKILL_FAMILY = 'B-SKILL'
export const A5_G1_SKILL_WIRING_REVISION = 1

export const A5_G1_SKILL_FAMILY_ENTRY = Object.freeze({
  familyId: A5_G1_SKILL_FAMILY,
  contractRef: 'M0-B-FAMILY-TARGET-CONTRACTS.md#B-SKILL',
  indexRef: 'M0-B-RECORD-FAMILY-ACCEPTANCE-INDEX.json record 24',
  records: Object.freeze({ skill: 24 }),
  implementationPathProposed: 'packages/runtime/src/plugin/live/governed-families/skill.mjs',
  consumedAdapter: Object.freeze({ module: 'governed-families/g1-surface-adapters.mjs', revision: A5_G1_ADAPTER_REVISION }),
  mountLaw: 'one-name-one-mount; the TRUSTED catalog CURRENT-facts port is a hard mount input',
})

export const A5_G1_SKILL_WIRING_CODES = Object.freeze({
  INPUT_INVALID: 'P_G1_SKILL_INPUT_INVALID',
  PORT_ABSENT: 'P_G1_SKILL_PORT_ABSENT',
  MOUNT_REFUSED: 'P_G1_SKILL_MOUNT_REFUSED',
  ADMISSION_CANCELLED: 'P_G1_SKILL_ADMISSION_CANCELLED',
  APPROVAL_NOT_LANDED: 'P_G1_SKILL_APPROVAL_NOT_LANDED',
  EDGE_CANCELLED: 'P_G1_SKILL_EDGE_CANCELLED',
  CONSUME_PROOF_MISSING: 'P_G1_SKILL_CONSUME_PROOF_MISSING',
  PLAN_DRIFT: 'P_G1_SKILL_PLAN_DRIFT',
})

const WIRING_INPUT_KEYS = Object.freeze(['realmId', 'providerId', 'name', 'native', 'definitionIdentity', 'trusted', 'bindingFacts', 'ports', 'pa', 'observe'])

const isRecord = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const refuse = (code, detail) => Object.freeze({ ok: false, code, detail })

export function createG1SkillWiring (input = {}) {
  if (!isRecord(input)) return refuse(A5_G1_SKILL_WIRING_CODES.INPUT_INVALID, 'the skill wiring takes exactly one plain record')
  for (const key of Object.keys(input)) {
    if (!WIRING_INPUT_KEYS.includes(key)) {
      return refuse(A5_G1_SKILL_WIRING_CODES.INPUT_INVALID, `unknown wiring input key '${key}' — the block takes exactly {${WIRING_INPUT_KEYS.join(', ')}}`)
    }
  }
  const { realmId, providerId, name, native, definitionIdentity, trusted, bindingFacts, ports, pa, observe } = input
  if (typeof realmId !== 'string' || realmId.length === 0) return refuse(A5_G1_SKILL_WIRING_CODES.INPUT_INVALID, 'realmId must be a non-empty string — the PA walk is realm-bound')
  if (typeof providerId !== 'string' || providerId.length === 0) return refuse(A5_G1_SKILL_WIRING_CODES.INPUT_INVALID, 'providerId must be a non-empty string')
  if (name !== 'skill') {
    return refuse(A5_G1_SKILL_WIRING_CODES.INPUT_INVALID, `name must be 'skill' — B-SKILL carries exactly record 24 (one-name-one-mount)`)
  }
  if (!(typeof pa === 'function' && typeof pa.open === 'function' && typeof pa.edge === 'function' && typeof pa.closePlan === 'function')) {
    return refuse(A5_G1_SKILL_WIRING_CODES.INPUT_INVALID, 'pa is REQUIRED in its published shape — the plane\'s paAdmit face (a CALLABLE with open / edge / closePlan) — with no admission seat no governed call may enter the catalog')
  }
  // THE TRUSTED CATALOG PORT: CURRENT facts, mounted or the family refuses.
  if (!isRecord(ports) || !isRecord(ports.trustedCatalog) || typeof ports.trustedCatalog.current !== 'function') {
    return refuse(A5_G1_SKILL_WIRING_CODES.PORT_ABSENT, 'ports.trustedCatalog.current() is REQUIRED — the CURRENT trusted catalog facts gate classify AND the consumption edge; without the port the row would have to trust a captured snapshot (the row\'s own law)')
  }
  const observeLine = (event) => { if (typeof observe === 'function') observe(event) }

  let row
  try {
    row = mountG1SurfaceAdapter('skill', { native, providerId, definitionIdentity, trusted, bindingFacts, ports })
  } catch (error) {
    return refuse(A5_G1_SKILL_WIRING_CODES.MOUNT_REFUSED, `the consumed G1 mount law refused the supply face: ${String(error?.message ?? error).slice(0, 220)} — nothing mounted, zero native entry`)
  }

  async function execute (args, { callId, signal } = {}) {
    if (typeof callId !== 'string' || callId.length === 0) {
      return refuse(A5_G1_SKILL_WIRING_CODES.INPUT_INVALID, 'execute needs the call identity the PA edge binds to')
    }
    const classified = row.classify(args, callId)
    if (classified.ok !== true) {
      observeLine({ event: 'skill-wire:classify-REFUSED', name, callId, code: classified.code })
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
        return refuse(A5_G1_SKILL_WIRING_CODES.ADMISSION_CANCELLED, `${name}: cancelled at the PA open edge before admission — zero catalog load`)
      }
      if (opened?.kind === 'deny') return opened
      if (opened?.kind !== 'approved' || opened.grant === undefined || opened.grant === null) {
        return refuse(A5_G1_SKILL_WIRING_CODES.APPROVAL_NOT_LANDED, `${name}: the admission answered ${String(opened?.kind ?? 'unsettled')} without a landed grant — zero catalog load`)
      }
      const edge = await pa.edge(Object.freeze({
        ...walk,
        grant: opened.grant,
        ...(opened.request === undefined ? {} : { request: opened.request }),
        ...(opened.placementName === undefined ? {} : { placementName: opened.placementName }),
      }))
      if (edge?.cancelled === true) {
        return refuse(A5_G1_SKILL_WIRING_CODES.EDGE_CANCELLED, `${name}: cancelled at the execution edge — the approval stays unspent and is never replayed; zero catalog load`)
      }
      if (edge?.kind === 'deny') return edge
      const proof = edge?.consumedProof
      if (!isRecord(proof) || !isRecord(proof.grant) || typeof proof.grant.grantId !== 'string') {
        return refuse(A5_G1_SKILL_WIRING_CODES.CONSUME_PROOF_MISSING, `${name}: the execution edge answered allow without its one-shot consume witness — the bridge never self-attests consumption; nothing was loaded`)
      }
      const rebound = row.classify(classified.plan.classifiedArgs, callId)
      if (rebound.ok !== true || rebound.parametersFingerprint !== classified.parametersFingerprint) {
        observeLine({ event: 'skill-wire:plan-DRIFT', name, callId })
        return refuse(A5_G1_SKILL_WIRING_CODES.PLAN_DRIFT, `${name}: the plan facts moved between the approved plan and the body — the grant was issued for the frozen plan; zero catalog load`)
      }
      // THE HOST'S OWN GATE behind the delegate (isModelInvocable double
      // gate, user-gesture boundary): a throw there propagates UNCHANGED.
      const ran = await row.delegate(classified.plan, { exec: { callId, ...(signal === undefined ? {} : { signal }) } })
      if (ran?.ok !== true) {
        observeLine({ event: 'skill-wire:delegate-REFUSED', name, callId, code: ran?.code })
        return ran
      }
      observeLine({ event: 'skill-wire:EXECUTED', name, callId })
      return ran
    } finally {
      try { await pa.closePlan(Object.freeze({ ...walk, settled: true })) }
      catch (error) { observeLine({ event: 'skill-wire:closePlan-ERROR', name, callId, detail: String(error?.message ?? error).slice(0, 120) }) }
    }
  }

  return Object.freeze({
    ok: true,
    familyId: A5_G1_SKILL_FAMILY,
    wiringRevision: A5_G1_SKILL_WIRING_REVISION,
    name,
    recordIndex: 24,
    row,
    execute,
    familyEntry: A5_G1_SKILL_FAMILY_ENTRY,
  })
}
