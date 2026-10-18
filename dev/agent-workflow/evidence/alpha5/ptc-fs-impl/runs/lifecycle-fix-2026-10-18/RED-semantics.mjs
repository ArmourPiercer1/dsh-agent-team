#!/usr/bin/env node
/**
 * RED-semantics — the measured production U-legs, unit-level mirror of the
 * live-kit reds of run live-2026-10-18T12-55-53, walked against WHICHEVER
 * ptc-escalation-row.mjs the DIST MIRROR carries (the exact face a
 * production install loads; plain node resolves the row's grant-mint.js
 * specifier there — the src copy is TS-adjacent and only loads through
 * vitest's resolver). One script, both trees:
 *
 *  SHIPPED (45717a9f, RED-semantics.log):
 *   U-1 / U-1b  `dropped=true … seenByRow=true` / `archived=true …
 *               seenByRow=true` — after the residency drop/dispose NOTHING
 *               unregisters the member (the unregister rode the row-stop
 *               drain; the host's agent/disposed event had NO listener on
 *               the row), so the row keeps claiming asks and opens a SECOND
 *               durable approval request for a torn-down member.
 *   U-2         the re-mount gate throws
 *               `member '…' is already registered (one face per session)`.
 *  FIXED (lifecycle-fix round, GREEN-semantics.log): the disposed mirror
 *   drops the entry (seenByRow=false) and the re-mount replaces cleanly.
 *
 * Exit 0 ALWAYS (this is a witness, not a gate): prints the measured facts.
 */
import { createPtcEscalationRowAssembly, createPtcEscalationRouter } from '../../../../../../../packages/runtime/dist/packages/runtime/src/plugin/live/ptc-escalation-row.mjs'

const esc = (mode) => `escalate sandbox to ${mode}: need to write under the workspace`
let controls = 0
const assembly = createPtcEscalationRowAssembly({
  rootSessionId: 'root-1',
  getControlService: () => ({
    async requestControl() {
      controls += 1
      return { requestId: `req-${String(controls)}` }
    },
    async awaitControlDecision() {
      return { decision: 'allow' }
    },
  }),
  now: () => Date.now(),
})
const router = createPtcEscalationRouter()
const fixed = typeof router.onAgentDisposed === 'function'
console.log(`tree face                 -> ${fixed ? 'FIXED (agent/disposed mirror present)' : 'SHIPPED 45717a9f (no lifecycle face)'}`)
const m = assembly.registerMember({ sessionId: 's-u1', instanceId: 'inst-u1', realmId: 'r1', isLeader: false })
const agent = { id: 's-u1' }
// The router's identity carrier changed with the fix (memberKey -> member
// handle); branch so the SAME witness walks both generations.
router.registerAgent(agent, fixed ? m : m.memberKey, assembly)
const next = async () => 'PASSTHROUGH'
const drive = async (callId) => await router.route({ agent, toolName: 'run_code', callId, reason: esc('workspace-write') }, next)

console.log(`baseline drive            -> ${await drive('call-1')} (controls=${String(controls)})`)
// RESIDENCY DROP / ARCHIVE happened upstream (handle disposed by the host).
// SHIPPED: NO listener existed on the row — NOTHING ran, exactly as in
// production between drop and row stop, so the next ask rides the stale
// registration. FIXED: the host's agent/disposed event reaches the mirror.
if (fixed) {
  const dropped = router.onAgentDisposed(agent)
  console.log(`disposed mirror           -> onAgentDisposed=${String(dropped)} liveCount=${String(router.liveCount())}`)
} else {
  console.log('disposed mirror           -> (no face exists — the event had no listener, nothing unregistered)')
}
console.log(`post-drop drive (U-1/1b)  -> ${await drive('call-2')} (controls=${String(controls)})  seenByRow=${String(controls > 1)}`)
// COLD RE-MOUNT (U-2): the mount gate re-runs registerMember for the session:
try {
  const m2 = assembly.registerMember({ sessionId: 's-u1', instanceId: 'inst-u1', realmId: 'r1', isLeader: false })
  console.log(`re-mount (U-2)            -> registered (no throw); membersLive=${String(assembly.census().membersLive)}`)
  if (fixed) router.registerAgent({ id: 's-u1' }, m2, assembly)
} catch (error) {
  console.log(`re-mount (U-2)            -> THREW: ${String(error?.message ?? error)}`)
}
