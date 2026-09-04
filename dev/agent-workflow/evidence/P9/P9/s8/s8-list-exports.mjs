// S8 helper — enumerate every export statement in a dist tree (full text).
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const root = process.argv[2]
const outFile = process.argv[3]
const out = []
function walk(d) {
  for (const e of readdirSync(d, { withFileTypes: true })) {
    const p = join(d, e.name)
    if (e.isDirectory()) { walk(p); continue }
    if (!e.name.endsWith('.js')) continue
    const lines = readFileSync(p, 'utf8').split('\n')
    for (let i = 0; i < lines.length; i++) {
      if (/^export\b/.test(lines[i])) {
        const rel = p.slice(root.length + 1).replace(/\\/g, '/')
        out.push(`${rel} :: L${i + 1} :: ${lines[i].trim().slice(0, 110)}`)
      }
    }
  }
}
walk(root)
writeFileSync(outFile, out.join('\n') + '\n')
console.log(`listed ${out.length} export statements -> ${outFile}`)
