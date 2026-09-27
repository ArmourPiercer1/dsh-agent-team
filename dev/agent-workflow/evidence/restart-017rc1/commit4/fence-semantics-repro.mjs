// Minimal fence-semantics repro against the ACTUAL dist module (read-only use).
import { createTeamSessionActivationFence } from '/home/user/dsh-plugins/dsh-agent-team/.worktrees/team-restart-017rc1/packages/runtime/dist/packages/runtime/src/plugin/team-session-activation.js'

const fence = createTeamSessionActivationFence()
fence.bindOwnershipResolver((sid) => (sid === 'root' ? 'root' : undefined))

// 1. owned activation (the glue's runOwned wrap) must PASS:
try {
  await fence.runOwned('root', async () => {
    await fence.beforeAgentCreated({ agent: { id: 'root' }, source: 'startup' })
  })
  console.log('TEST1 owned activation: PASS (no throw) — as designed')
} catch (e) {
  console.log(`TEST1 owned activation: THREW — fence guard broken: ${e.message}`)
}

// 2. foreign activation must REJECT with the production wording:
try {
  await fence.beforeAgentCreated({ agent: { id: 'root' }, source: 'startup' })
  console.log('TEST2 foreign activation: PASSED — fence broken')
} catch (e) {
  console.log(`TEST2 foreign activation: rejected — ${e.message}`)
}

// 3. ordinary (unmanaged) session must PASS:
try {
  await fence.beforeAgentCreated({ agent: { id: 'ordinary-1' }, source: 'startup' })
  console.log('TEST3 ordinary activation: PASS (no throw) — as designed')
} catch (e) {
  console.log(`TEST3 ordinary activation: THREW — fence over-reaches: ${e.message}`)
}
