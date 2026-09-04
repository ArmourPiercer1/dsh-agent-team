// temp: strict YAML validate graph.yaml after edit
import { createRequire } from 'node:module'
const req = createRequire('D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P9/packages/runtime/package.json')
const YAML = req('yaml')
import { readFileSync } from 'node:fs'
const text = readFileSync('D:/AgentDev/dsh-plugins/dsh-agent-team/dev/agent-workflow/graph.yaml', 'utf8')
const doc = YAML.parseDocument(text)
if (doc.errors.length > 0) {
  for (const e of doc.errors) console.error('YAML ERROR:', e.message, '@ line', e.linePos && e.linePos[0] && e.linePos[0].line)
  process.exit(1)
}
const obj = doc.toJSON()
console.log('YAML OK; top keys:', Object.keys(obj).join(','))
console.log('p9 keys:', Object.keys(obj.p9).join(','))
console.log('s8 head:', String(obj.p9.s8).slice(0, 80))
console.log('next head:', String(obj.p9.next).slice(0, 80))
