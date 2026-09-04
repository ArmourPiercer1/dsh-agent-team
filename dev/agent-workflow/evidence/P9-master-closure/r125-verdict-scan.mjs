import { readFileSync, existsSync } from 'node:fs'
const ev = 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P9-MC/dev/agent-workflow/evidence/P9-master-closure'
const PATTERNS = [
  [/\?token=[A-Za-z0-9_-]{12,}/g, 'query-token'],
  [/(?:launchToken|bootToken|authToken|token|tokenValue)["'\s]*[:=]["'\s]*[A-Za-z0-9_-]{12,}/g, 'key-token-assign'],
  [/dsh-auth-[A-Za-z0-9._-]{8,}/g, 'dsh-auth-'],
  [/\bsk-[A-Za-z0-9_-]{12,}\b/g, 'sk-'],
]
let total = 0
for (let n = 1; n <= 12; n++) {
  const f = `${ev}/reviewer-${n}/verdict.md`
  if (!existsSync(f)) { console.log(`reviewer-${n}: MISSING`); continue }
  const t = readFileSync(f, 'utf8')
  const hits = []
  for (const [re, name] of PATTERNS) {
    const m = t.match(re)
    if (m) { hits.push(`${name} x${m.length}`); total += m.length }
  }
  console.log(`reviewer-${n}: ` + (hits.length ? hits.join(', ') : 'clean'))
}
console.log('TOTAL residual token hits in 12 verdicts:', total)
