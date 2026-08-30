#!/usr/bin/env node
// G6-REVIEW reviewer-2: zero-core import scan over the delta code files.
// Extracts every module specifier from import/export-from (incl. multi-line
// from clauses), side-effect imports, and dynamic import(...).
// Classification:
//   BUILTIN    node:* builtins
//   WORKSPACE  @dsh-agent-team/* (9 vNext packages)
//   RELATIVE   ./ or ../ (intra-package)
//   THIRD_PARTY anything else resolvable from node_modules
//   SUSPECT    anything that looks like upstream DSH internal paths or
//              absolute/fs-ish paths
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import process from 'node:process'

const wt = 'D:/AgentDev/dsh-plugins/dsh-agent-team/.worktrees/G6-R2'
const listFile = join(wt, 'dev/agent-workflow/evidence/G6-REVIEW/reviewer-2/delta-files-code.txt')
const lines = readFileSync(listFile, 'utf8').split(/\r?\n/).filter(Boolean)
const files = lines.map((l) => {
  const [status, ...rest] = l.split('\t')
  return { status, path: rest.join('\t') }
})
if (files.length !== 75) throw new Error('expected 75 code files, got ' + files.length)

const WS = '@dsh-agent-team/'
const SUSPECT_PATTERNS = [
  /deepseek-harness/,
  /^apps\//,
  /references\//,
  /^\.\.\/+references/,
  /packages\/(bundle|cli|web-app|agent|sessions|tools|permission|remote|sandbox|model|host|ui|browser|web)\//,
  /^dsh\//,
  /node_modules\/deepseek/,
]

const findings = { BUILTIN: new Map(), WORKSPACE: new Map(), RELATIVE: 0, THIRD_PARTY: new Map(), SUSPECT: [] }

function record(spec, file, line) {
  if (spec.startsWith('node:')) {
    findings.BUILTIN.set(spec, (findings.BUILTIN.get(spec) || 0) + 1)
    return
  }
  if (spec.startsWith(WS)) {
    findings.WORKSPACE.set(spec, (findings.WORKSPACE.get(spec) || 0) + 1)
    return
  }
  if (spec.startsWith('./') || spec.startsWith('../')) {
    findings.RELATIVE++
    return
  }
  if (SUSPECT_PATTERNS.some((re) => re.test(spec))) {
    findings.SUSPECT.push({ spec, file, line })
    return
  }
  findings.THIRD_PARTY.set(spec, (findings.THIRD_PARTY.get(spec) || 0) + 1)
}

// Regexes (order matters; run over full file text):
//  1. from '<spec>' / from "<spec>" (covers static + export ... from, incl.
//     multi-line import blocks because it matches the terminal clause)
//  2. side-effect import '<spec>'
//  3. dynamic import('<spec>')
const RE_FROM = /(?:from|import)\s*\(?\s*(?:(['"])((?:\\.|(?!\1)[^\\])*)\1)/g
const RE_SIDE = /^\s*import\s*(?!\()(['"])([^'"\n]+)\1/gm
const RE_DYNAMIC = /import\s*\(\s*(?:['"])((?:\\.|(?!\1)[^\\])*)\1\s*\)/g

let scanned = 0
for (const f of files) {
  const abs = join(wt, f.path)
  const src = readFileSync(abs, 'utf8')
  scanned++
  let m
  RE_FROM.lastIndex = 0
  while ((m = RE_FROM.exec(src)) !== null) record(m[2], f.path, src.slice(0, m.index).split('\n').length)
  // side-effect imports: lines starting with import '<spec>' (no binding)
  for (const line of src.split('\n')) {
    const s = line.trim()
    if (s.startsWith('import ') && !s.startsWith('import(') && !/import\s*[A-Za-z_{\*]/.test(s)) {
      const sm = s.match(/^import\s*(['"])([^'"\n]+)\1/)
      if (sm) record(sm[2], f.path, 0)
    }
  }
  RE_DYNAMIC.lastIndex = 0
  while ((m = RE_DYNAMIC.exec(src)) !== null) record(m[1], f.path, src.slice(0, m.index).split('\n').length)
}

const out = []
out.push(`scanned files: ${scanned}`)
out.push(`BUILTIN: ${[...findings.BUILTIN.entries()].map(([k, v]) => k + ' x' + v).join(', ')}`)
out.push(`WORKSPACE: ${[...findings.WORKSPACE.entries()].map(([k, v]) => k + ' x' + v).join(', ')}`)
out.push(`RELATIVE: ${findings.RELATIVE}`)
out.push(`THIRD_PARTY: ${[...findings.THIRD_PARTY.entries()].map(([k, v]) => k + ' x' + v).join(', ') || '(none)'}`)
out.push(`SUSPECT: ${findings.SUSPECT.length === 0 ? '(none)' : JSON.stringify(findings.SUSPECT, null, 1)}`)
process.stdout.write(out.join('\n') + '\n')
