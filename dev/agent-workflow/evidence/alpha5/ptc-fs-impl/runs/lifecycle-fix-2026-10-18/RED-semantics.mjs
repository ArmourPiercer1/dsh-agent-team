#!/usr/bin/env node
/**
 * RED-semantics — the measured production U-legs reproduced against the
 * SHIPPED ptc-escalation-row.mjs at 45717a9f (no fix, no new API), the
 * unit-level mirror of the live-kit reds of run live-2026-10-18T12-55-53:
 *
 *  U-1 / U-1b  `dropped=true … seenByRow=true` / `archived=true …
 *              seenByRow=true` — after the residency drop/dispose NOTHING
 *              unregisters the member (the unregister rides the row-stop
 *              drain), so the row keeps claiming asks and opens durable
 *              approval requests for a torn-down member.
 *  U-2         the re-mount gate throws
 *              `member '…' is already registered (one face per session)`.
 *
 * Exit 0 ALWAYS (this is a witness, not a gate): prints the measured facts.
 * The import rides the DIST MIRROR — the exact face a production install
 * loads (plain node resolves the row's grant-mint.js specifier there; the
 * src copy is TS-adjacent and only loads through vitest's resolver).
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
const m = assembly.registerMember({ sessionId: 's-u1', instanceId: 'inst-u1', realmId: 'r1', isLeader: false })
const agent = { id: 's-u1' }
router.registerAgent(agent, m.memberKey, assembly)
const next = async () => 'PASSTHROUGH'
const drive = async (callId) => await router.route({ agent, toolName: 'run_code', callId, reason: esc('workspace-write') }, next)

console.log(`baseline drive            -> ${await drive('call-1')} (controls=${String(controls)})`)
// RESIDENCY DROP / ARCHIVE happened upstream (handle disposed by the host):
// the shipped mount carries NO lifecycle face — NOTHING ran here, exactly as
// in production between drop and row stop.
console.log(`post-drop drive (U-1/1b)  -> ${await drive('call-2')} (controls=${String(controls)})  seenByRow=${String(controls > 1)}`)
// COLD RE-MOUNT (U-2): the mount gate re-runs registerMember for the session:
try {
  assembly.registerMember({ sessionId: 's-u1', instanceId: 'inst-u1', realmId: 'r1', isLeader: false })
  console.log('re-mount (U-2)            -> registered (no throw)')
} catch (error) {
  console.log(`re-mount (U-2)            -> THREW: ${String(error?.message ?? error)}`)
}
