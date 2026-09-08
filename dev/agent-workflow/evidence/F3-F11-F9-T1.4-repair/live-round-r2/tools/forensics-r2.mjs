// R2 live-round forensics helper (read-only; writes nothing to product/state).
// usage: node forensics-r2.mjs
import { loadDomain, ledgerFactsForRoot, teamMembers } from 'file:///D:/AgentDev/dsh-plugins/dsh-agent-team/tests/mock/scripts/common.mjs'

const root = process.argv[2] ?? 'session-dtestmts69xkr6b54'
const dom = loadDomain()
const ts = dom.row('team_sessions', root)
console.log('team_session:', JSON.stringify({ gen: ts?.generation, bp: ts?.blueprint ? ts.blueprint.blueprintId + '@' + ts.blueprint.revision : null, rootSessionId: ts?.rootSessionId }))
console.log('members:', JSON.stringify(teamMembers(dom, root)))
const facts = ledgerFactsForRoot(dom, root)
console.log('ledger facts total:', facts.length)
for (const f of facts) {
  const p = f.payload ?? {}
  console.log(
    'seq=' + f.sequence + ' ' + f.factType +
    ' rid=' + (p.requestId ?? '') +
    ' decision=' + (p.decision ?? '') +
    ' kind=' + (p.kind ?? '') +
    ' target=' + (p.targetInstanceId ?? '') +
    ' action=' + (p.actionName ?? '') +
    ' corr=' + (p.correlation ?? '') +
    ' reason=' + (p.reason ?? '') +
    ' decider=' + JSON.stringify(p.decider ?? null)
  )
}
