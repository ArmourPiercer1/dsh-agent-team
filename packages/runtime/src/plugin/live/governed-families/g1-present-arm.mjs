/**
 * governed-families/g1-present-arm.mjs — A5M2 G1 B-PRESENT resource-arm SLOT
 * (center REAL-GAP SOURCE CARD + TERRITORY PIN, 2026-10-24). NEW FILE by
 * ruling: the existing G1 semantic blocks (g1-surface-adapters record specs,
 * TOOL_NAME_BY_INDEX, the record-85 pure-query carve-out and its handover
 * law, g1-query-wiring seats) are READ-ONLY references — this module
 * CONSUMES them and edits nothing.
 *
 * WHAT THIS SLOT IS: the mount-time supply gate + typed refusal for the
 * B-PRESENT resource arm (record 51, `present`). It is NOT an arm: per the
 * frozen backlog row `G1 dependency/plugin/present 资源臂 | 未开发 | 治理实现
 * 仍实质缺口（无成熟适配可交付；禁冒升）` (ALPHA5-EFFECTIVE-BACKLOG.md:58)
 * no mature adaptation is deliverable today, so this slot exists ONLY to
 * make the gap mechanical: every mount attempt is answered by a typed,
 * citable refusal with ZERO native entry — never a silent native-Body
 * fallback, which PLAN-B-355 L15 (frozen copy: m0-closure-v3/
 * route-records-v3c.json, `present` record reqSrc "预设继承=分发入口;原生 Body
 * 回落=阻断项") names as the blocking item, and never a fake success.
 *
 * WHY NOT MATURE (factual, not taste): the present row's own commit law
 * (consumed from g1-surface-adapters.mjs record 51, effectDeltaNotes —
 * "the native promise resolving is NOT the commit; the SAME-EXEC session
 * append (deliverables/presented) carrying the exec callId AND the native
 * result's own turn witnesses it; an arbitrary integer is no witness")
 * requires a production consumer that mounts the tools/result listener and
 * the turn-boundary projection face. No such mount point is wired (the
 * whole g1-surface-adapters module is UNWIRED by ruling; the backlog row
 * is 未开发). Claiming an arm here would be 冒升 — forbidden.
 *
 * SUPPLY GATE = CONSUMED, NEVER RE-IMPLEMENTED: the closed shape law is
 * exactly `mountG1SurfaceAdapter('present', …)` from the existing block —
 * trusted five-face CONFIG, bindingFacts(), same-name native face WITH its
 * definitionIdentity. A TypeError there is a supply fact and is answered
 * typed here (the mount law is not rewritten, merely translated to the
 * refusal envelope this slot publishes).
 *
 * Record-spec SINGLE SOURCE: g1PresentArmRecordSpec() hands out the frozen
 * A5_G1_RECORD_SPECS['present'] object verbatim; this file defines no
 * second parameter table (anti-duplication pin in the spec suite).
 */

import { A5_G1_RECORD_SPECS, mountG1SurfaceAdapter } from './g1-surface-adapters.mjs'

export const A5_G1_PRESENT_ARM_REVISION = 1
export const A5_G1_PRESENT_ARM_FAMILY = 'B-PRESENT'

/** The closed refusal vocabulary of THIS slot (new namespaced codes; the
 *  consumed block's A5_G1_TYPED_CODES stay the single source for classify-
 *  time codes once a real arm exists — this slot never reaches classify). */
export const A5_G1_PRESENT_ARM_CODES = Object.freeze({
  SUPPLY_INVALID: 'P_G1_PRESENT_ARM_SUPPLY_INVALID',
  NOT_MATURE: 'P_G1_PRESENT_ARM_NOT_MATURE',
})

const ARM_DEPS_KEYS = Object.freeze(['native', 'providerId', 'definitionIdentity', 'trusted', 'bindingFacts', 'ports', 'observe'])

const refuse = (code, detail) => Object.freeze({ ok: false, code, detail })

/** The frozen record spec, SINGLE-SOURCED from the existing block. */
export function g1PresentArmRecordSpec () {
  return A5_G1_RECORD_SPECS.present
}

/**
 * The resource-arm mount. EVERY legal and illegal answer is
 * `{ok:false, …}` — there is no path that arms anything, by design, until
 * the commit-witness consumer exists (禁冒升). Never throws; never calls
 * into the native face.
 */
export function mountG1PresentSurfaceArm (deps = {}) {
  if (deps === null || typeof deps !== 'object' || Array.isArray(deps)) {
    return refuse(A5_G1_PRESENT_ARM_CODES.SUPPLY_INVALID, 'the arm takes exactly one plain deps record (the consumed mount law\'s shape)')
  }
  for (const key of Object.keys(deps)) {
    if (!ARM_DEPS_KEYS.includes(key)) {
      return refuse(A5_G1_PRESENT_ARM_CODES.SUPPLY_INVALID, `unknown deps key '${key}' — the consumed G1 mount face takes exactly {${ARM_DEPS_KEYS.join(', ')}}; nothing else may pose as supply`)
    }
  }
  let nativeEntered = false
  try {
    // CONSUME the existing mount law verbatim. The adapter it would return
    // is deliberately not surfaced: the slot refuses below regardless.
    const row = mountG1SurfaceAdapter('present', deps)
    nativeEntered = row !== undefined && row !== null
  } catch (error) {
    return refuse(A5_G1_PRESENT_ARM_CODES.SUPPLY_INVALID, `the consumed G1 mount law (g1-surface-adapters.mjs mountG1SurfaceAdapter) refused the supply face: ${String(error?.message ?? error).slice(0, 220)} — supply unverified, zero native entry`)
  }
  const spec = A5_G1_RECORD_SPECS.present
  return refuse(A5_G1_PRESENT_ARM_CODES.NOT_MATURE,
    `record ${String(spec.recordIndex)}·${A5_G1_PRESENT_ARM_FAMILY}·${String(deps.providerId ?? 'plugin')}: the B-PRESENT resource arm is NOT_MATURE — the supply gate above was PASSED and is recorded, but no arm is published: the frozen backlog row 'G1 dependency/plugin/present 资源臂 | 未开发 | 治理实现仍实质缺口（无成熟适配可交付；禁冒升）' (ALPHA5-EFFECTIVE-BACKLOG.md:58) is in force, and the row's own commit law ('commit law: the native promise resolving is NOT the commit; the SAME-EXEC session append (deliverables/presented) carrying the exec callId AND the native result's own turn witnesses it') has no mounted production consumer (tools/result listener + turn-boundary projection face). Per the frozen reqSrc '预设继承=分发入口;原生 Body 回落=阻断项' this slot refuses with${nativeEntered ? ' an inert supply row (never surfaced, never entered)' : ''} zero native entry and never falls back to the native Body.`)
}
