import { readFileSync } from 'node:fs'
const audit = readFileSync('D:/AgentDev/dsh-plugins/dsh-agent-team/dev/agent-workflow/evidence/P9/reuse-audit.md', 'utf8')
const lines = audit.split(/\r?\n/)
const tableRows = lines.filter(l => /^\|\s/.test(l) || /^\|[^|]/.test(l))
const fileRows = tableRows.filter(l => /\.(tsx?|css|json|ya?ml|mjs)\b/.test(l))
console.log('total table-ish rows: ' + tableRows.length)
console.log('rows containing a filename: ' + fileRows.length)
// show first 3 file rows truncated
for (const l of fileRows.slice(0, 3)) console.log('  ' + l.slice(0, 160))
// sections present
for (const s of ['## §A', '## §B', '## §C', '## §D', '## §E', '## §F', '## §G']) {
  console.log(s + ' -> ' + (lines.findIndex(l => l.startsWith(s))) )
}
console.log('total lines: ' + lines.length)
