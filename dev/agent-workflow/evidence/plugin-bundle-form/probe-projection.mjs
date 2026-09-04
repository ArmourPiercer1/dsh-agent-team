// One-shot diagnostic: query the LIVE D5 world-4 instance for the created
// Root's team projection (G3 zero-state investigation). Read-only RPC.
import { readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'

const ev = 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/PBF/dev/agent-workflow/evidence/plugin-bundle-form'
const state = JSON.parse(readFileSync(`${ev}/d5-state-2026-09-04T20-49-41.json`, 'utf8'))
const rootSessionId = 'session-46823b98-4811-45ae-9f29-6ec5b9678696' // from gentry team.create
const body = {
  type: 'client-request',
  rpcId: randomUUID(),
  method: 'team.getProjection',
  payload: { version: 1, params: { teamSessionId: rootSessionId } },
}
const res = await fetch(`http://127.0.0.1:3180/team-remote/team.getProjection`, {
  method: 'POST',
  headers: { 'content-type': 'application/json', cookie: state.cookie },
  body: JSON.stringify(body),
})
const text = await res.text()
console.log('status:', res.status)
console.log(text.slice(0, 2500))
