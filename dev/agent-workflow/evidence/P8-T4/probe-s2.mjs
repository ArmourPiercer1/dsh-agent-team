import { register } from 'node:module'

register('../../../../scripts/run-tests-hooks.mjs', import.meta.url)

const { createP8T4FakeServer } = await import('../../../../packages/remote/test/p8t4-server.ts')
const { createP8T4TestClient } = await import('../../../../packages/remote/test/p8t4-test-client.ts')

const BACKOFF = { baseMs: 20, factor: 2, maxMs: 1000 }
const TEAM = 'team-s1'

function syncDto(generation, teamSessionId) {
  return {
    schemaVersion: 1,
    teamSessionId,
    blueprint: { blueprintId: 'bp-1', revision: 2 },
    generation,
    generatedAt: `2026-08-29T00:00:${String(generation).padStart(2, '0')}.000Z`,
    root: { rootSessionId: teamSessionId },
    templates: [{ templateId: 'tpl-1' }],
    members: [{ instanceId: 'inst-1', templateId: 'tpl-1', childSessionId: 'child-1' }],
    ledger: { latestSequence: 0, totalEntries: 0, byCategory: {}, pendingControlCount: 0 },
  }
}
function projectionResponse(generation) {
  const { buildRemoteSuccess } = moduleState
  return buildRemoteSuccess(
    { projection: syncDto(generation, TEAM) },
    {
      method: 'team.getProjection',
      endpoint: 'team.getProjection',
      contractVersion: moduleState.REMOTE_CONTRACT_VERSION,
      requestToken: null,
      projectionGeneration: generation,
    },
  )
}
const { buildRemoteSuccess, REMOTE_CONTRACT_VERSION } = await import('../../../../packages/remote/src/index.ts')
const moduleState = { buildRemoteSuccess, REMOTE_CONTRACT_VERSION }

// --- S1 replica (exact test order) ---
const s1server = createP8T4FakeServer({ startGeneration: 5 })
const s1client = createP8T4TestClient({ teamSessionId: TEAM, transport: s1server, backoff: BACKOFF })
const s1start = await s1client.start()
s1server.setGeneration(7)
const s1sync7 = await s1client.sync()
s1server.scriptNext('team.getProjection', projectionResponse(6))
const s1stale = await s1client.sync()
console.log('S1:', s1start.status, s1sync7.status, s1stale.status, '| final gen', s1client.lastAppliedGeneration())
const s1bserver = createP8T4FakeServer({ startGeneration: 8 })
const s1bclient = createP8T4TestClient({ teamSessionId: TEAM, transport: s1bserver, backoff: BACKOFF })
const s1bstart = await s1bclient.start()
s1bserver.scriptNext('team.getProjection', projectionResponse(7))
const s1bolder = await s1bclient.sync()
console.log('S1b:', s1bstart.status, s1bolder.status, '| final gen', s1bclient.lastAppliedGeneration())

// --- S2 replica (exact test order) ---
const server = createP8T4FakeServer({ startGeneration: 1 })
const client = createP8T4TestClient({
  teamSessionId: TEAM,
  transport: server,
  backoff: BACKOFF,
})

const a1 = await client.start()
console.log('after start:', a1.status, '| gen', client.lastAppliedGeneration(), '| state', client.state(), '| conn', client.connectedCount())
server.lose()
const a2 = await client.sync()
console.log('after loss sync:', a2.status, '| gen', client.lastAppliedGeneration(), '| state', client.state(), '| backoffLog', JSON.stringify(client.backoffLog()))
server.setGeneration(2)
server.restore()
await client.advance(9)
console.log('after advance(9): | state', client.state(), '| pending', client.pendingBackoffMs(), '| gen', client.lastAppliedGeneration())
await client.advance(1)
console.log('after advance(1): | state', client.state(), '| gen', client.lastAppliedGeneration(), '| conn', client.connectedCount())
server.scriptNext('team.getProjection', projectionResponse(1))
const s2late = await client.sync()
console.log('after late gen1 sync:', s2late.status, '| gen', client.lastAppliedGeneration())
console.log('requests:', server.requests.map((r) => r.method).join(','))
