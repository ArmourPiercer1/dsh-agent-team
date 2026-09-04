#!/usr/bin/env node
// P9 G1 audit: (1) T1 byte-identity vs 506191b manifest, (2) client tsc error histogram, (3) full suite.
import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'

const P9 = 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/P9'
const sh = (args, cwd = P9) => execFileSync('git', args, { cwd, encoding: 'utf8' })

// (1) T1 byte-identity
const manifest = readFileSync(`${P9}/dev/agent-workflow/evidence/P9/legacy-ui-team-manifest-at-506191b.txt`, 'utf8')
const entries = []
for (const line of manifest.split('\n')) {
  const m = line.match(/^100644 blob ([0-9a-f]{40})\s+\d+\s+(.*)$/)
  if (m) entries.push({ sha: m[1], path: m[2] })
}
const byBase = new Map()
for (const e of entries) {
  const b = e.path.split('/').pop()
  if (byBase.has(b)) console.log(`WARN basename collision: ${b}`)
  byBase.set(b, e.sha)
}
const t1Files = sh(['show', '--name-only', '--format=', '9357a5b']).split('\n').filter(p => p.startsWith('packages/'))
let ok = 0, bad = 0
for (const p of t1Files) {
  const base = p.split('/').pop()
  const expected = byBase.get(base)
  if (!expected) { console.log(`MISSING-IN-MANIFEST ${p}`); bad++; continue }
  const actual = sh(['rev-parse', `9357a5b:${p}`]).trim()
  if (actual === expected) ok++
  else { console.log(`HASH-MISMATCH ${p}: expected=${expected} actual=${actual}`); bad++ }
}
console.log(`T1 BYTE-IDENTITY: ${ok}/${t1Files.length} copied files match 506191b blobs; mismatches=${bad}`)
const copiedBases = new Set(t1Files.map(p => p.split('/').pop()))
const notCopied = entries.filter(e => !copiedBases.has(e.path.split('/').pop())).map(e => e.path)
console.log(`not copied at T1 (${notCopied.length}): ` + notCopied.join(', '))

// (2) client tsc histogram (typecheck config)
let tscOut = ''
try { tscOut = execFileSync('node', ['node_modules/typescript/bin/tsc', '-p', 'packages/client/tsconfig.json'], { cwd: P9, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }) } catch (e) { tscOut = (e.stdout || '') + (e.stderr || '') }
const hist = {}
for (const line of tscOut.split('\n')) {
  const m = line.match(/error (TS\d+)/)
  if (m) hist[m[1]] = (hist[m[1]] || 0) + 1
}
console.log('CLIENT TSC TYPECHECK HISTOGRAM: ' + JSON.stringify(hist))
const ts2307 = tscOut.split('\n').filter(l => l.includes('TS2307')).map(l => (l.match(/Cannot find module '([^']+)'/) || [])[1])
const mods = {}
for (const m2 of ts2307) if (m2) mods[m2] = (mods[m2] || 0) + 1
console.log('TS2307 modules: ' + JSON.stringify(mods))

// (3) full suite
let suite = ''
try { suite = execFileSync('node', ['scripts/run-tests.mjs'], { cwd: P9, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 }) } catch (e) { suite = (e.stdout || '') + (e.stderr || '') }
const sum = suite.split('\n').filter(l => l.includes('run-tests (plain-node') || l.includes('RESULT'))
console.log('FULL SUITE: ' + sum.join(' | '))
