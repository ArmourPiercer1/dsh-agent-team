// Print the persona-relevant lines from a request's system prompt.
import { readFileSync } from 'node:fs'
const cap = JSON.parse(readFileSync(process.argv[2], 'utf8'))
const seq = Number(process.argv[3])
const r = cap.requests.find((x) => x.seq === seq)
if (!r) { console.log('no req ' + seq); process.exit(1) }
const sys = (r.messages ?? []).find((m) => m.role === 'system')
const text = typeof sys?.content === 'string' ? sys.content : JSON.stringify(sys?.content ?? '')
console.log(`req${seq} system chars=${text.length}`)
const lines = text.split('\n')
lines.forEach((ln, i) => {
  if (/persona|T12V/i.test(ln)) console.log(`  L${i + 1}: ${ln.slice(0, 300)}`)
})
