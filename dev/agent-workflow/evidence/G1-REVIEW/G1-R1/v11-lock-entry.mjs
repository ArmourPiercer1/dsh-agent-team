import { readFileSync } from 'node:fs'
const m = JSON.parse(readFileSync('D:/AgentDev/dsh-plugins/dsh-agent-team/dev/agent-workflow/evidence/provenance/file-manifest.json','utf8'))
for (const f of m.files) if (f.path.includes('lock')) { console.log('PATH:', f.path); console.log(JSON.stringify(f, null, 2)) }
