#!/usr/bin/env node
// scan-list.mjs <out.txt> — replicate the p4t6 scanner's file SELECTION and dump the list.
// Purpose: `filesScanned` is a filesystem-derived total, so when it moves the only honest answer is
// "which files moved it". This dumps the selected paths with sizes for a diffable snapshot.
import { readdirSync, statSync, writeFileSync } from 'node:fs'
import { join, basename } from 'node:path'

const packagesDir = new URL('../../../../../../packages', import.meta.url).pathname
const testkitTestDir = join(packagesDir, 'testkit', 'test')
const out = []
const cmp = (a, b) => (a < b ? -1 : a > b ? 1 : 0)
function walk(dir) {
  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true }).sort((a, b) => cmp(a.name, b.name))
  } catch {
    return
  }
  const files = []
  for (const e of entries) {
    const abs = join(dir, e.name)
    if (e.isDirectory()) {
      if (e.name === 'node_modules' || e.name === 'dist' || e.name === '.tmp-fault') continue
      walk(abs)
    } else {
      files.push(abs)
    }
  }
  for (const abs of files) {
    const base = basename(abs)
    if (!(base.endsWith('.ts') || base.endsWith('.mts') || base.endsWith('.mjs'))) continue
    if (dir === testkitTestDir && /^p4t6-.*\.test\.ts$/.test(base)) continue
    let size = -1
    try {
      size = statSync(abs).size
    } catch { /* unreadable */ }
    out.push(`${size}\t${abs}`)
  }
}
for (const e of readdirSync(packagesDir, { withFileTypes: true }).sort((a, b) => cmp(a.name, b.name))) {
  if (e.isDirectory()) walk(join(packagesDir, e.name))
}
out.sort()
writeFileSync(process.argv[2], out.join('\n') + '\n')
console.log(`${out.length} scannable files -> ${process.argv[2]}`)
