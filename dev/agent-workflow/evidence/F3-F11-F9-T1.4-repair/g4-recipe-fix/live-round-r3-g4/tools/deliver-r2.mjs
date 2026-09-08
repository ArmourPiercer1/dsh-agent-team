// deliver-r2.mjs — R2 prompt delivery over the public session API (read the recipe file
// verbatim as UTF-8, queue one text prompt, print the wire result). Read-only w.r.t.
// product state: the ONLY effect is the queued model prompt (the intended model turn).
//
// usage: node deliver-r2.mjs <sessionId> <promptFile>
// env:   MOCK_DSH_HOME (for common.mjs DSH_HOME default; not needed for prompt itself)
import { readFileSync } from 'node:fs'
import { readBootState, readCookie, sessionPrompt } from 'file:///D:/AgentDev/dsh-plugins/dsh-agent-team/tests/mock/scripts/common.mjs'

const [sessionId, promptFile] = process.argv.slice(2)
if (!sessionId || !promptFile) {
  console.error('usage: node deliver-r2.mjs <sessionId> <promptFile>')
  process.exit(2)
}
const state = readBootState()
const cookie = readCookie()
const text = readFileSync(promptFile, 'utf8').replace(/^\uFEFF/, '').trim()
console.log(`[deliver] session=${sessionId} file=${promptFile} chars=${text.length}`)
console.log(`[deliver] prompt head: ${text.slice(0, 80).replace(/\n/g, ' ')}`)
const r = await sessionPrompt(state.origin, cookie, sessionId, text)
console.log(`[deliver] status=${r.status} ok=${r.ok}`)
if (r.ok) {
  console.log(`[deliver] value=${JSON.stringify(r.value).slice(0, 300)}`)
  process.exit(0)
}
console.log(`[deliver] error=${JSON.stringify(r.error ?? r.raw?.nonJson ?? '?').slice(0, 400)}`)
process.exit(1)
