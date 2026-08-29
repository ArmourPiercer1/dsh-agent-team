// Probe: replicate verify-zero-core's pnpm-workspace.yaml patchedDependencies parse
// against the fixture file, to understand why no finding is emitted for it.
import { readFileSync } from 'node:fs'

const p = process.argv[2]
const lines = readFileSync(p, 'utf8').split('\n')
let inBlock = false
for (let i = 0; i < lines.length; i++) {
  const line = lines[i]
  const head = /^patchedDependencies:\s*(#.*)?$/.test(line)
  let m = null
  if (inBlock) m = line.match(/^\s{2,}([^:\s][^:]*):\s*(.*)$/)
  if (head) {
    console.log(`line ${i + 1}: header -> inBlock=true`)
    inBlock = true
    continue
  }
  if (inBlock) {
    if (m === null) {
      const closed = /^\S/.test(line)
      console.log(`line ${i + 1}: no key match (closes=${closed}) raw=${JSON.stringify(line)}`)
      inBlock = closed ? false : inBlock
      continue
    }
    const key = m[1].trim().replace(/^['"]|['"]$/g, '')
    console.log(`line ${i + 1}: key=${JSON.stringify(key)} m1=${JSON.stringify(m[1])}`)
  }
}
