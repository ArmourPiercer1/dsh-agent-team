#!/usr/bin/env node
/**
 * G8-R4 private-import / zero-core import-face audit (reviewer-owned harness).
 *
 * Walks every *.ts under packages/ in the worktree, extracts all static
 * import/export specifiers and dynamic import() specifiers, and classifies
 * each as:
 *   RELATIVE   ./ or ../ (intra-repo)
 *   VITEST     vitest (test-only, allowed)
 *   INTRA      @dsh-agent-team/* (this repo's own workspace packages)
 *   NODE_BUILTIN  node:*  (zero-core violation in .ts)
 *   BARE       anything else (potential upstream/private import)
 * Exits 0 and prints a per-file list of anything not RELATIVE/VITEST/INTRA.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import process from 'node:process'

const ROOT = process.argv[2]
const PKGS = join(ROOT, 'packages')

const files = []
function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules') continue
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) walk(p)
    else if (p.endsWith('.ts')) files.push(p)
  }
}
walk(PKGS)

const reStatic = /(?:^|\n)\s*(?:import|export)\s[^'\"]*?from\s+['\"]([^'\"]+)['\"]/g
const reSideEffect = /(?:^|\n)\s*import\s+['\"]([^'\"]+)['\"]/g
const reDynamic = /import\(\s*['\"]([^'\"]+)['\"]/g

let violations = 0
const stats = { RELATIVE: 0, VITEST: 0, INTRA: 0, NODE_BUILTIN: 0, BARE: 0, TOTAL: 0 }
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  const specs = new Set()
  for (const re of [reStatic, reSideEffect, reDynamic]) {
    let m
    re.lastIndex = 0
    while ((m = re.exec(src)) !== null) specs.add(m[1])
  }
  for (const s of [...specs].sort()) {
    stats.TOTAL++
    let cls
    if (s.startsWith('./') || s.startsWith('../')) cls = 'RELATIVE'
    else if (s === 'vitest') cls = 'VITEST'
    else if (s.startsWith('@dsh-agent-team/')) cls = 'INTRA'
    else if (s.startsWith('node:')) cls = 'NODE_BUILTIN'
    else cls = 'BARE'
    stats[cls]++
    if (cls === 'NODE_BUILTIN' || cls === 'BARE') {
      violations++
      console.log(`VIOLATION [${cls}] ${relative(ROOT, f)} :: ${s}`)
    }
  }
}
console.log('---')
console.log('import-specifier audit stats:', JSON.stringify(stats))
console.log(violations === 0 ? 'AUDIT: CLEAN (no node: builtins, no bare/upstream specifiers in any packages/**/*.ts)' : `AUDIT: ${violations} VIOLATIONS`)
process.exit(violations === 0 ? 0 : 1)
