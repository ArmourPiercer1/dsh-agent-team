#!/usr/bin/env node
// zero-core import scan for the G6 delta (reviewer 1).
// Reads the delta name-status list, extracts every import/export-from specifier
// (multi-line from clauses included) and require() call from each A/M file in
// the worktree, and classifies the specifiers.
import { readFileSync } from 'node:fs'

const root = 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/G6-R1'
const listPath = `${root}/dev/agent-workflow/evidence/G6-REVIEW/reviewer-1/step2-delta-name-status.txt`

const lines = readFileSync(listPath, 'utf8').split(/\r?\n/).filter(Boolean)
const files = []
for (const line of lines) {
  const tab = line.indexOf('\t')
  if (tab < 0) continue
  const status = line.slice(0, tab)
  let path = line.slice(tab + 1)
  // rename rows: R100 old -> new
  if (status.startsWith('R') || status.startsWith('C')) {
    const parts = path.split('\t')
    path = parts[parts.length - 1]
  }
  if (status.startsWith('D')) continue
  files.push({ status, path })
}

const exts = ['ts', 'mts', 'js', 'mjs', 'cjs']
const targets = files.filter((f) => exts.includes(f.path.slice(f.path.lastIndexOf('.') + 1).toLowerCase()))

// specifier extraction: import ... from '...', export ... from '...',
// dynamic import('...'), require('...'). Multi-line from clauses handled by
// allowing whitespace/newlines between the keyword and the quoted string.
// multi-line from clauses: allow any char except ';' (statement end) and
// quotes between the keyword and `from`, with the s flag for newlines.
const reFrom = /(?:\bimport\b|\bexport\b)[^;'"]*?\bfrom\b\s*[\r\n\s]*['"]([^'"\r\n]+)['"]/gs
const reDynamic = /\bimport\s*\(\s*['"]([^'"\r\n]+)['"]/g
const reRequire = /\brequire\s*\(\s*['"]([^'"\r\n]+)['"]/g
const reImportBare = /(?:^|[\r\n])\s*import\s+['"]([^'"\r\n]+)['"]/g

const workspacePkgs = new Set(['contracts', 'domain', 'storage', 'runtime', 'tools', 'remote', 'client', 'legacy', 'testkit'])
// per-package self-import alias? none known; relative specifiers resolved manually below.

const report = []
const flagged = []
const specCount = { from: 0, dynamic: 0, require: 0, bare: 0 }

for (const f of targets) {
  let src
  try {
    src = readFileSync(`${root}/${f.path}`, 'utf8')
  } catch {
    report.push(`MISSING ${f.path}`)
    continue
  }
  const found = new Map() // spec -> [kinds]
  const collect = (re, kind) => {
    let m
    re.lastIndex = 0
    while ((m = re.exec(src)) !== null) {
      specCount[kind] += 1
      const arr = found.get(m[1]) ?? []
      if (!arr.includes(kind)) arr.push(kind)
      found.set(m[1], arr)
    }
  }
  collect(reFrom, 'from')
  collect(reImportBare, 'bare-import')
  collect(reDynamic, 'dynamic-import')
  collect(reRequire, 'require')

  for (const [spec, kinds] of [...found.entries()].sort()) {
    let cls
    let detail = ''
    if (spec.startsWith('.')) {
      // relative: resolve against the file dir, normalize, see where it lands
      const dir = f.path.slice(0, f.path.lastIndexOf('/'))
      const segs = (dir ? dir.split('/') : []).concat(spec.split('/'))
      const out = []
      for (const s of segs) {
        if (s === '.' || s === '') continue
        if (s === '..') out.pop()
        else out.push(s)
      }
      const resolved = out.join('/')
      const top = resolved.split('/')
      cls = 'relative'
      detail = `resolves to ${resolved}`
      if (!resolved.startsWith('packages/')) {
        cls = 'FLAG-ESCAPE'
        detail += ` (escapes packages/!)`
        flagged.push(`${f.path} -> ${spec} (${resolved})`)
      } else {
        const pkg = top[1]
        const owner = f.path.split('/')[1]
        if (pkg !== owner) {
          cls = `cross-pkg:${pkg}`
        }
      }
    } else if (spec.startsWith('@') || /^[a-z0-9@]/i.test(spec)) {
      const name = spec.startsWith('@') ? spec.split('/').slice(0, 2).join('/') : spec.split('/')[0]
      const internal = name.replace(/^@dsh-agent-team\//, '')
      if (workspacePkgs.has(name) || workspacePkgs.has(internal)) {
        cls = `workspace:${name}`
      } else {
        cls = `external:${name}`
        flagged.push(`${f.path} -> ${spec} (external package)`)
      }
    } else {
      cls = `unknown:${spec}`
      flagged.push(`${f.path} -> ${spec}`)
    }
    report.push(`${f.path}  [${kinds.join('+')}]  ${spec}   :: ${cls}${detail ? ' | ' + detail : ''}`)
  }
}

const out = []
out.push(`zero-core import scan (reviewer 1)`)
out.push(`delta: 11b05844..54950fb6, files scanned: ${targets.length}`)
out.push(`specifiers: from=${specCount.from} bare-import=${specCount.bare} dynamic=${specCount.dynamic} require=${specCount.require}`)
out.push('')
out.push('=== all specifiers ===')
out.push(...report)
out.push('')
out.push('=== flags (need human review) ===')
out.push(...(flagged.length ? flagged : ['(none)']))
console.log(out.join('\n'))
