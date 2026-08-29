// Regex isolation probe for verify-zero-core's workspace-yaml key matcher
import { readFileSync } from 'node:fs'

const p = process.argv[2]
const text = readFileSync(p, 'utf8')
const lines = text.split('\n')
for (let i = 5; i < 8 && i < lines.length; i++) {
  const line = lines[i]
  const codes = [...line.slice(0, 40)].map(c => c.codePointAt(0).toString(16)).join(' ')
  console.log(`line ${i + 1} first-40 codepoints: ${codes}`)
  console.log(`  full length=${line.length} last char code=${line.charCodeAt(line.length - 1).toString(16)}`)
  const m = line.match(/^\s{2,}([^:\s][^:]*):\s*(.*)$/)
  console.log(`  key-regex match: ${m ? `m1=${JSON.stringify(m[1])}` : 'NO MATCH'}`)
  const m2 = line.replace(/\r$/, '').match(/^\s{2,}([^:\s][^:]*):\s*(.*)$/)
  console.log(`  key-regex match (CR stripped): ${m2 ? `m1=${JSON.stringify(m2[1])}` : 'NO MATCH'}`)
}
