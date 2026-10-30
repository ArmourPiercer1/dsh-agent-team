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
     *  `agentStateEnabled === true`, set the closed boolean keys on the ONE
     *  plane config — the enablement AND `testHomeGuard: true` (this is a
     *  test World: the shipped home law, live-`~/.dsh` refusal included,
     *  stays byte-for-byte in force; R-STATE-HOME-1 design (c) choke point);
     *  otherwise OMIT them entirely (ABSENT = FALSE). */
    teamRowsFor({ agentStateEnabled }) {
      const rows = JSON.parse(JSON.stringify(inner.teamRows()))
      if (agentStateEnabled === true) {
        rows[0].config.teamToolPlane.agentStateEnabled = true
        rows[0].config.teamToolPlane.testHomeGuard = true
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
  // A1 — zero flip: the ungoverned world mounts its plane exactly as
  // shipped (the placement-feed witness rows are the rows master mounts),
  // and NOTHING of the agent-state family appears anywhere.
  const aMounted = bootA.placementLines.length > 0
  const aFamilyFree = bootA.familyLines.length === 0
  const aNamesFree = bootA.placementLines.every((l) => !AGENT_STATE_LIVE_NAMES.some((n) => l.includes(n)))
  V.push(['agt:zero-flip-mount', aMounted && aFamilyFree && aNamesFree ? 'PASS' : 'FAIL', {
    placementFeedWitness: bootA.placementLines.map((l) => l.slice(0, 200)),
    agentStateLines: bootA.familyLines.map((l) => l.slice(0, 200)),
    placementNamesFree: aNamesFree,
    law: 'ABSENT key = FALSE: no rows, no family witness lines, shipped placement byte-comparable (zero flip)',
  }])
  // A2 — the surface is UNCHANGED: the shipped governed placements ride the
  // model surface (read/write/edit/read_image are real placements), the
  // anchored census-boot line shows the shipped boot signature completed,
  // and NONE of the five agent-state spellings appears in ANY captured
  // model request surface (leader or member).
  // (DISCLOSED truth measured here: the 0.2.0-rc.2 team-session surface
  // carries NO native `todo_write` at all — the native-ride premise of the
  // first design does not hold on this host generation, so the honest
  // witness is the NEGATIVE one: while disabled, the family contributes
  // zero names to every surface, and the shipped names ride unchanged.)
  const aShippedRide = ['read', 'write', 'edit', 'read_image'].every((n) => bootA.surfaceUnion.includes(n))
  const aZeroNames = bootA.surfaceUnion.filter((n) => AGENT_STATE_LIVE_NAMES.includes(n)).length === 0
  const aBootSignature = bootA.censusBootLines.length > 0
  V.push(['agt:surface-unchanged-witness', aShippedRide && aZeroNames && aBootSignature ? 'PASS' : 'FAIL', {
    shippedPlacementOnSurface: aShippedRide,
    agentStateNamesOnAnySurface: bootA.surfaceUnion.filter((n) => AGENT_STATE_LIVE_NAMES.includes(n)),
    censusBootWitness: bootA.censusBootLines.map((l) => l.slice(0, 160)),
    surfaceUnion: bootA.surfaceUnion,
    note: '0.2.0-rc.2 team sessions carry no native todo_write — disclosed, asserted as absence',
  }])
  // B1 — enabled WITHOUT the production store port: the mount refusal must
  // be WITNESSED by a typed code string in at least one observable channel
  // (host log / world-home persisted records / p6t6 state body / mock
  // transcript). Silence FAILS — the suite never claims the refusal it
  // cannot see.
  const typedHits = bootB.refusalHits.filter((l) => CODE_RE_TEST.test(l))
  V.push(['agt:enabled-mount-refused', typedHits.length > 0 ? 'PASS' : 'FAIL', {
    typedCodeHits: typedHits.map((l) => l.slice(0, 240)),
    allRefusalHits: bootB.refusalHits.map((l) => l.slice(0, 160)),
    law: 'an enabled agent-state family with no durable store port refuses the whole plane mount (fail closed) — production binder wires no store adapter and this lane added none',
  }])
  // B2 — the refused mount leaves NO governed trace: zero placement-feed
  // rows, zero census-boot boot signatures, zero family RAN witnesses.
  const zeroPlane = bootB.placementLines.length === 0 && bootB.censusBootLines.length === 0 && bootB.familyRanLines.length === 0
  V.push(['agt:enabled-zero-plane', zeroPlane ? 'PASS' : 'FAIL', {
    placementFeedLines: bootB.placementLines.length,
    censusBootLines: bootB.censusBootLines.length,
    familyRanLines: bootB.familyRanLines.length,
    note: 'the boot-A world shows both boot signatures (placement-feed + census-boot); their joint absence here is the mount-level halt witness, paired with B1 when B1 has its typed code',
  }])
  V.push(['agt:leak-check', leakOk ? 'PASS' : 'FAIL', { bothWorlds: true }])
  return V
}

const CODE_RE_TEST = /PLANE_AGENT_STATE_STORE_MISSING|plane_agent_state_store_missing/
