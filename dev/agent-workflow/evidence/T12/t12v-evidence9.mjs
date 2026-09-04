import { readFileSync } from 'node:fs'
const s = JSON.parse(readFileSync('D:/AgentDev/dsh-plugins/dsh-agent-team/dev/agent-workflow/evidence/T12/summary.json', 'utf8'))
const v3 = s.scenarios.V3
const out = []
out.push(`V3 pass=${v3.pass} durationMs=${v3.durationMs}`)
for (const [k, v] of Object.entries(v3.evidence ?? {})) {
  out.push(`ev.${k} = ${JSON.stringify(v).slice(0, 300)}`)
}
// epoch helpers
const t = (iso) => new Date(iso).getTime()
if (v3.evidence.denyTurnStartMs) {
  out.push(`turn/start ISO = ${new Date(v3.evidence.denyTurnStartMs).toISOString()}`)
}
// also V2 + LIFECYCLE + RESTART + HANDOFF evidence keys of interest
for (const name of ['V2', 'LIFECYCLE', 'RESTART', 'HANDOFF']) {
  const sc = s.scenarios[name]
  if (!sc) { out.push(`${name}: missing`); continue }
  out.push(`== ${name} pass=${sc.pass} durationMs=${sc.durationMs} checks=${sc.assertions?.filter(a => a.ok).length}/${sc.assertions?.length}`)
  for (const [k, v] of Object.entries(sc.evidence ?? {})) {
    out.push(`ev.${k} = ${JSON.stringify(v).slice(0, 220)}`)
  }
}
console.log(out.join('\n'))
