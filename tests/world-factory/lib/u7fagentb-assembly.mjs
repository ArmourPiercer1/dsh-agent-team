/**
 * u7fagentb-assembly.mjs — world materialization for the `u7-fagentb` C2
 * suite (U7-F B): the AGENT-STATE family's live mount law.
 *
 * The World is the PROVEN u7-fs-mut shape (production row, profile-patch
 * layer, /team-remote HTTP, mock provider) with ONE controlled delta:
 * `teamRowsFor({ agentStateEnabled })` returns the production row whose
 * `config.teamToolPlane` either OMITS the closed boolean key (ABSENT =
 * FALSE — the zero-flip world: every shipped mount shape rides byte-
 * identical) or sets it TRUE (the fail-closed world: production wiring
 * passes no agent-state store port — the binder has no such seam and this
 * lane edits no binder line — so the ENABLED family must refuse the whole
 * plane mount with `PLANE_AGENT_STATE_STORE_MISSING`).
 *
 * DISCLOSED (never a PASS, never silently dropped — the suite evidence and
 * the PR carry this verbatim): the ENABLED-AND-STORE-MOUNTED positive legs
 * (authorized read, authorized mutation with the durable fact read back,
 * refused cross-scope write with zero reach) have NO production seam on
 * this tree: `agent-bindings.mjs` wires `backends` for the jobs bridge
 * only, and adding the agent-state store adapter is a separate named
 * binder lane, not a family self-wiring. Those legs are PROVEN at C1 over
 * the real plane + real kernel grant (packages/runtime/test/
 * u7-f-agentb-agent-state-c1.test.ts); on this live suite they are
 * DISCLOSED-NO-SEAM, and the suite instead proves what IS reachable: the
 * zero flip, the native ride, and the typed fail-closed mount refusal at
 * the real host.
 *
 * @module tests/world-factory/lib/u7fagentb-assembly
 */
import { createFsMutAssembly } from './u7-fsmut-assembly.mjs'

/** The five governed spellings this family would claim IF enabled. */
export const AGENT_STATE_LIVE_NAMES = Object.freeze(['todo_write', 'create_goal', 'get_goal', 'update_goal', 'exit_plan_mode'])

/** Wrap the proven fs-mut assembly with the ONE controlled plane delta. */
export function createFAgentBAssembly(opts) {
  const inner = createFsMutAssembly(opts)
  return {
    ...inner,
    /** Deep-plain clone of the production rows; when
     *  `agentStateEnabled === true`, set the closed boolean key on the ONE
     *  plane config; otherwise OMIT it entirely (ABSENT = FALSE). */
    teamRowsFor({ agentStateEnabled }) {
      const rows = JSON.parse(JSON.stringify(inner.teamRows()))
      if (agentStateEnabled === true) {
        rows[0].config.teamToolPlane.agentStateEnabled = true
      }
      return rows
    },
  }
}

/** Pure verdicts over COLLECTED facts (no I/O): every PASS names its
 *  witnesses; the fail-closed case REQUIRES the typed code string, silence
 *  fails. */
export function judgeU7FAgentB({ bootA, bootB, leakOk }) {
  const V = []
  const has = (hits, re) => hits.some((l) => re.test(l))
  // A1 — zero flip: the ungoverned world mounts its plane exactly as
  // before (placement-feed witness), and NOTHING of the agent-state family
  // appears (no family line, no governed name in any placement row).
  const aMounted = bootA.placementLines.length > 0
  const aFamilyFree = bootA.familyLines.length === 0
  const aNamesFree = bootA.placementLines.every((l) => !AGENT_STATE_LIVE_NAMES.some((n) => l.includes(n)))
  V.push(['agt:zero-flip-mount', aMounted && aFamilyFree && aNamesFree ? 'PASS' : 'FAIL', {
    placementFeedWitness: bootA.placementLines.map((l) => l.slice(0, 200)),
    agentStateLines: bootA.familyLines.map((l) => l.slice(0, 200)),
    placementNamesFree: aNamesFree,
    law: 'ABSENT key = FALSE: no rows, no family witness lines, shipped placement byte-comparable (zero flip)',
  }])
  // A2 — the native ride: todo_write exists on the model surface as the
  // HOST NATIVE (the family claims nothing while disabled).
  const nativeRide = bootA.surface.includes('todo_write')
  V.push(['agt:native-ride-witness', nativeRide ? 'PASS' : 'FAIL', {
    todoWriteOnSurface: nativeRide,
    surfaceSample: bootA.surface.filter((n) => ['todo_write', 'read', 'write', 'bash'].includes(n)),
    governedPlacementOfNativeNames: bootA.placementLines.filter((l) => l.includes('todo_write')).map((l) => l.slice(0, 160)),
  }])
  // B1 — enabled WITHOUT the production store port: the real host answers
  // the typed mount refusal (never silence, never a degraded mount).
  const refused = bootB.refusalHits.length > 0
  const typedCode = bootB.refusalHits.some((l) => /PLANE_AGENT_STATE_STORE_MISSING|plane_agent_state_store_missing/.test(l))
  V.push(['agt:enabled-mount-refused', refused && typedCode ? 'PASS' : 'FAIL', {
    refusalHits: bootB.refusalHits.map((l) => l.slice(0, 240)),
    law: 'an enabled agent-state family with no durable store port refuses the whole plane mount (fail closed) — production binder wires no store adapter and this lane added none',
  }])
  // B2 — the refused mount leaves NO governed trace: zero placement-feed
  // lines, zero family RAN witnesses (nothing mounted, nothing ran).
  const zeroPlane = bootB.placementLines.length === 0 && bootB.familyRanLines.length === 0
  V.push(['agt:enabled-zero-plane', zeroPlane ? 'PASS' : 'FAIL', {
    placementFeedLines: bootB.placementLines.length,
    familyRanLines: bootB.familyRanLines.length,
  }])
  V.push(['agt:leak-check', leakOk ? 'PASS' : 'FAIL', { bothWorlds: true }])
  return V
}
