#!/usr/bin/env node
/**
 * G6-REVIEW reviewer-3 — zero-core delta import scanner.
 * Scans every delta file under packages/ for import/export-from specifiers,
 * including multi-line `from` clauses and dynamic import('...'), and
 * classifies each specifier. Flags anything that is not a node: builtin,
 * an allowed third-party (yaml, vitest), or a relative path.
 * Usage: node scan-imports.mjs <worktree-root> <delta-files-txt>
 */
import { readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import process from 'node:process'

const [worktree, listFile] = process.argv.slice(2)
if (!worktree || !listFile) {
  console.error('usage: node scan-imports.mjs <worktree> <delta-files-txt>')
  process.exit(2)
}

const files = readFileSync(listFile, 'utf8')
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter((l) => l.length > 0)
  .map((l) => l.split('\t').pop())
  .filter((f) => f.startsWith('packages/'))

const ALLOWED_EXTERNAL = new Set(['yaml', 'vitest'])

// Match: static import/export-from (multi-line from allowed), dynamic import(
const STATIC_RE = /(?:^|\n)\s*(?:import|export)\s+[\s\S]*?from\s+['"]([^'"]+)['"]/g
const DYNAMIC_RE = /import\s*\(\s*['"]([^'"]+)['"]\s*\)/g
const SIDE_EFFECT_RE = /(?:^|\n)\s*import\s+['"]([^'"]+)['"]/g

function specifiersOf(text) {
  const out = []
  for (const re of [STATIC_RE, DYNAMIC_RE, SIDE_EFFECT_RE]) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(text)) !== null) {
      out.push({ specifier: m[1], at: text.slice(0, m.index).split('\n').length })
    }
  }
  return out
}

const report = []
const flagged = []
let totalSpecs = 0
for (const f of files) {
  const text = readFileSync(join(worktree, f), 'utf8')
  const specs = specifiersOf(text)
  totalSpecs += specs.length
  for (const s of specs) {
    const kind = classify(s.specifier)
    report.push(`${f}:${s.at}\t${s.specifier}\t${kind}`)
    if (kind === 'FLAG') {
      flagged.push(`${f}:${s.at}  ${s.specifier}`)
    }
  }
}

function classify(spec) {
  if (spec.startsWith('node:')) return 'node-builtin'
  if (spec.startsWith('./') || spec.startsWith('../')) return 'relative'
  if (ALLOWED_EXTERNAL.has(spec)) return 'allowed-3p'
  if (/^@?[a-z]/.test(spec)) return 'FLAG'
  return 'FLAG'
}

console.log(`files scanned: ${files.length}`)
console.log(`specifiers found: ${totalSpecs}`)
console.log('--- all specifiers ---')
for (const line of report) console.log(line)
console.log('--- flagged (non-builtin/non-relative/non-yaml/non-vitest) ---')
console.log(flagged.length === 0 ? '(none)' : flagged.join('\n'))

// Also scan for patch/rewrite mechanisms in delta package.json + root
for (const p of ['package.json']) {
  const text = readFileSync(join(worktree, p), 'utf8')
  for (const token of ['patch-package', 'pnpm patch', 'postinstall', 'deepseek-harness']) {
    if (text.includes(token)) console.log(`MANIFEST-TOKEN: ${p} contains "${token}"`)
  }
}
