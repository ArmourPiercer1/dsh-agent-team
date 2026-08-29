// V11: emit single-class non-Team paths (GENERIC + UNRELATED) for blob comparison.
import { readFileSync, writeFileSync } from 'node:fs'
const m = JSON.parse(readFileSync('D:/AgentDev/dsh-plugins/dsh-agent-team/dev/agent-workflow/evidence/provenance/file-manifest.json', 'utf8'))
const KEEP = new Set(['GENERIC_FORK_CAPABILITY', 'UNRELATED_FORK_FEATURE'])
const sel = m.files.filter(f => KEEP.has(f.classification))
const lines = sel.map(f => `${f.classification}\t${f.disposition}\t${f.status}\t${f.path}`)
writeFileSync('D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/G1-R1/dev/g1-review/G1-R1/V11-d-nonteam-paths.tsv', lines.join('\n') + '\n', { encoding: 'utf8' })
console.log(`wrote ${lines.length} paths (GENERIC=${sel.filter(f=>f.classification==='GENERIC_FORK_CAPABILITY').length}, UNRELATED=${sel.filter(f=>f.classification==='UNRELATED_FORK_FEATURE').length})`)
