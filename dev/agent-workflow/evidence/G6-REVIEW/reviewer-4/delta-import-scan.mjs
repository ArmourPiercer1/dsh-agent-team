#!/usr/bin/env node
/**
 * delta-import-scan (reviewer 4, G6-REVIEW) — enumerates every module
 * specifier in the delta code files and classifies it:
 *
 *   relative  -> must resolve inside the worktree, never under references/
 *   bare      -> collected uniquely (checked against package.json deps by hand)
 *   absolute  -> flagged
 *
 * Extraction covers: static import declarations (incl. multi-line
 * specifier lists before `from`), `export ... from`, side-effect imports,
 * dynamic import(), and require().
 *
 * Usage: node delta-import-scan.mjs <worktreeRoot> <fileList> <reportOut>
 * (No child processes; plain fs reads only.)
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, isAbsolute, join, resolve } from 'node:path'

const [rootArg, listArg, outArg] = process.argv.slice(2)
if (!rootArg || !listArg || !outArg) {
  console.error('usage: node delta-import-scan.mjs <worktreeRoot> <fileList> <reportOut>')
  process.exit(2)
}
const root = resolve(rootArg)
const files = readFileSync(listArg, 'utf8').split(/\r?\n/).map(s => s.trim()).filter(Boolean)

const PATTERNS = [
  // export ... from 'x'  /  import ... from 'x'  (multi-line allowed)
  { re: /(?:import|export)\s+[\s\S]*?from\s*(['"])([^'"\n]+)\1/g, kind: 'from' },
  // side-effect import 'x'
  { re: /import\s*(['"])([^'"\n]+)\1/g, kind: 'side-effect' },
  // dynamic import('x')
  { re: /import\s*\(\s*(['"])([^'"\n]+)\1\s*\)/g, kind: 'dynamic' },
  // require('x')
  { re: /require\s*\(\s*(['"])([^'"\n]+)\1\s*\)/g, kind: 'require' },
]

const bare = new Map()
const relTargets = new Map()
const flagged = []
let totalSpecs = 0
let filesScanned = 0

for (const rel of files) {
  const abs = join(root, rel)
  let text
  try { text = readFileSync(abs, 'utf8') } catch { continue }
  filesScanned += 1
  const seen = new Set() // dedupe identical spec at same line (from+side-effect overlap)
  for (const { re, kind } of PATTERNS) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(text)) !== null) {
      const spec = m[2]
      const line = text.slice(0, m.index).split('\n').length
      const key = `${line}:${spec}`
      if (seen.has(key)) continue
      seen.add(key)
      totalSpecs += 1
      if (spec.startsWith('.')) {
        const target = resolve(dirname(abs), spec)
        relTargets.set(target, (relTargets.get(target) ?? 0) + 1)
        const insideRoot = target.startsWith(root + '\\') || target.startsWith(root + '/')
        const touchesReferences = /(^|\\|\/)references(\\|\/)/.test(target)
        if (!insideRoot) flagged.push(`ESCAPES-WORKTREE ${rel}:${line} ${spec} -> ${target}`)
        if (touchesReferences) flagged.push(`TOUCHES-REFERENCES ${rel}:${line} ${spec} -> ${target}`)
      } else if (spec.startsWith('/')) {
        flagged.push(`ABSOLUTE ${rel}:${line} ${spec}`)
      } else {
        bare.set(spec, (bare.get(spec) ?? 0) + 1)
      }
    }
  }
}

const lines = []
lines.push(`delta-import-scan (reviewer-4) root=${root}`)
lines.push(`files listed: ${files.length}, files scanned: ${filesScanned}, specifiers extracted: ${totalSpecs}`)
lines.push('')
lines.push('--- bare specifiers (unique) ---')
for (const [k, v] of [...bare.entries()].sort()) lines.push(`${v}x  ${k}`)
lines.push('')
lines.push('--- relative targets (resolved, unique) ---')
for (const [k, v] of [...relTargets.entries()].sort()) lines.push(`${v}x  ${k}`)
lines.push('')
lines.push('--- flagged ---')
lines.push(flagged.length ? flagged.join('\n') : 'NONE')

writeFileSync(outArg, lines.join('\n'), 'utf8')
console.log(`report: ${outArg}`)
console.log(`files=${filesScanned} specs=${totalSpecs} bare=${bare.size} relTargets=${relTargets.size} flagged=${flagged.length}`)
if (flagged.length > 0) process.exit(1)
process.exit(0)
