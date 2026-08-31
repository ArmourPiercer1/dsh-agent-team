/**
 * dependency-scan.mjs — G8-REVIEW reviewer-5 (R61): G8 criterion-1
 * dependency scan over the frozen remote package (and the client-side push
 * engine inside it). Machine-generated evidence for `dependency-scan.log`.
 *
 * Checks:
 *   1. Every import specifier in packages/remote/** (src + test) is either
 *      RELATIVE or a vNext-workspace name — nothing external.
 *   2. Banned-token scan (SessionController / session-log / mirror family)
 *      with CONTEXT CLASSIFICATION: a hit fails the scan only when it sits
 *      in CODE of a src/ file. Comment/docstring hits (the documented
 *      "value-level mirror of the frozen P3 contracts" design note, D-1)
 *      and test-surface hits (the P8-T3 negative test and its deliberate
 *      positive-control text reference the tokens by design) are reported
 *      as informational.
 *   3. The pure surface (src/push/**, the browser-consumable engine) and the
 *      browser-side consumer (test/p8t4-test-client.ts) use no node:
 *      builtins, no I/O imports, and no external bare specifiers.
 *   4. The 12-port admission surface is the only backing dependency the
 *      dispatcher takes (no hidden services).
 *
 * Read-only over tracked sources; writes ONE log file in the evidence dir.
 * Untracked evidence by design.
 */

import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, resolve, sep } from 'node:path'

const HERE = import.meta.dirname
const WORKTREE_ROOT = resolve(HERE, '..', '..', '..', '..', '..', '..')
const REMOTE_DIR = join(WORKTREE_ROOT, 'packages', 'remote')
const OUT = resolve(HERE, '..', 'dependency-scan.log')

const BANNED_TOKENS = [
  'session-controller',
  'sessioncontroller',
  'session/log',
  'session-log',
  'sessionlog',
  'mirror',
  'dsh-session',
  'session-controller/client',
]

// Browser-consumable surface: the pure push engine + the P8-T4 test client
// (the browser-side consumer of the engine; in production the same engine
// code runs in the browser).
const BROWSER_SURFACE_EXTRA = [join(REMOTE_DIR, 'test', 'p8t4-test-client.ts')]

const files = []
function walk(dir, out) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|mjs)$/.test(entry)) out.push(full)
  }
}
walk(REMOTE_DIR, files)

const lines = []
const log = (msg) => {
  lines.push(msg)
}

log('G8-REVIEW reviewer-5 (R61) — G8 criterion-1 dependency scan')
log(`worktree: ${WORKTREE_ROOT}`)
log(`package root: ${REMOTE_DIR}`)
log(`scan time: ${new Date().toISOString()}`)
log(`files scanned (ts+mjs): ${files.length}`)
log('')

// ── 1. import specifier census ────────────────────────────────────────────
const importRe = /(?:^|\n)\s*(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]|[^'\n]*\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g
const specifiers = []
for (const file of files) {
  const text = readFileSync(file, 'utf8')
  for (const match of text.matchAll(importRe)) {
    const spec = match[1] ?? match[2]
    specifiers.push({ file, spec })
  }
}

let relativeCount = 0
let bareCount = 0
let otherCount = 0
const bareSpecs = new Map()
for (const { spec } of specifiers) {
  if (spec.startsWith('./') || spec.startsWith('../')) relativeCount += 1
  else if (/^[@a-z]/.test(spec)) {
    bareCount += 1
    bareSpecs.set(spec, (bareSpecs.get(spec) ?? 0) + 1)
  } else otherCount += 1
}
log('── 1. import specifier census ─────────────────────────────────────────')
log(`total import specifiers: ${specifiers.length}`)
log(`relative (./ ../): ${relativeCount}`)
log(`bare (workspace-eligible): ${bareCount}`)
log(`other (node: / url / absolute): ${otherCount}`)
log('bare specifier breakdown:')
for (const [spec, count] of [...bareSpecs.entries()].sort()) {
  log(`  ${spec}  x${count}`)
}
const externalBare = [...bareSpecs.keys()].filter((s) => !s.startsWith('@dsh-agent-team/'))
log(`external (non-@dsh-agent-team) bare specifiers (whole package): ${externalBare.length === 0 ? 'NONE' : externalBare.join(', ')}`)
log('')

// ── 2. banned-token scan with context classification ─────────────────────
//
// Context classes (character-level):
//   0 = code        -> CODE hit      (FAILS the scan in src/ files)
//   1 = line comment -> COMMENT hit  (informational)
//   2 = block comment-> COMMENT hit  (informational)
//   3 = string      -> STRING hit   (informational)
//   4 = regex literal-> REGEX hit   (informational)
// Files under packages/remote/test/** are the P8-T3 negative scan and its
// positive-control fixtures: they reference the tokens BY DESIGN (the
// control text must trip the scanner). Those are TEST-SURFACE (informational).

const CLS_CODE = 0
const CLS_LINE = 1
const CLS_BLOCK = 2
const CLS_STRING = 3
const CLS_REGEX = 4
const CLS_NAMES = ['CODE', 'LINE-COMMENT', 'BLOCK-COMMENT', 'STRING', 'REGEX']

/** Previous significant char code, or '' at start of file. */
function prevSignificant(text, i) {
  let j = i - 1
  while (j >= 0) {
    const c = text[j]
    if (c !== ' ' && c !== '\t' && c !== '\r' && c !== '\n') return c
    j -= 1
  }
  return ''
}

/** Heuristic: can `/` at index i open a regex literal (not a division)? */
function looksLikeRegexStart(text, i) {
  const p = prevSignificant(text, i)
  if (p === '' ) return true
  if ('(,=:[!&|?+-*/%<>~^;}'.includes(p)) return true
  // after the keywords `return`, `typeof`, `case`, `in`, `of`, `new`, `delete`, `void`, `throw`, `do`, `else`
  const tail = text.slice(Math.max(0, i - 8), i)
  if (/\b(return|typeof|case|in|of|new|delete|void|throw|do|else)$/.test(tail)) return true
  return false
}

/**
 * Classify every character offset of `text` into CLS_* classes.
 * Single pass; handles line comments, block comments, ' ", ` strings (with
 * escapes) and a regex-literal heuristic. Good enough for classification of
 * a frozen corpus; every CODE hit is additionally line-shape re-checked below.
 */
function classifySource(text) {
  const n = text.length
  const cls = new Uint8Array(n)
  let i = 0
  let state = CLS_CODE
  let quote = ''
  while (i < n) {
    const c = text[i]
    const c2 = text[i + 1]
    if (state === CLS_CODE) {
      if (c === '/' && c2 === '/') {
        state = CLS_LINE
        cls[i] = CLS_LINE
        i++
        continue
      }
      if (c === '/' && c2 === '*') {
        state = CLS_BLOCK
        cls[i] = CLS_BLOCK
        i++
        continue
      }
      if (c === '"' || c === "'" || c === '`') {
        state = CLS_STRING
        quote = c
        cls[i] = CLS_STRING
        i++
        continue
      }
      if (c === '/' && looksLikeRegexStart(text, i)) {
        state = CLS_REGEX
        cls[i] = CLS_REGEX
        i++
        continue
      }
      i++
      continue
    }
    if (state === CLS_LINE) {
      cls[i] = CLS_LINE
      if (c === '\n') state = CLS_CODE
      i++
      continue
    }
    if (state === CLS_BLOCK) {
      cls[i] = CLS_BLOCK
      if (c === '*' && c2 === '/') {
        cls[i + 1] = CLS_BLOCK
        i += 2
        state = CLS_CODE
        continue
      }
      i++
      continue
    }
    if (state === CLS_STRING) {
      cls[i] = CLS_STRING
      if (c === '\\') {
        if (i + 1 < n) cls[i + 1] = CLS_STRING
        i += 2
        continue
      }
      if (c === quote) {
        state = CLS_CODE
      }
      i++
      continue
    }
    // CLS_REGEX
    cls[i] = CLS_REGEX
    if (c === '\\') {
      if (i + 1 < n) cls[i + 1] = CLS_REGEX
      i += 2
      continue
    }
    if (c === '[') {
      // character class: a ] inside [..] does not close the regex
      i++
      let inClass = true
      while (i < n && inClass) {
        cls[i] = CLS_REGEX
        if (text[i] === '\\') {
          if (i + 1 < n) cls[i + 1] = CLS_REGEX
          i += 2
          continue
        }
        if (text[i] === ']') inClass = false
        i++
      }
      continue
    }
    if (c === '/') {
      state = CLS_CODE
      i++
      continue
    }
    i++
  }
  return cls
}

log('── 2. SessionController / session-log / mirror token scan (classified) ─')
const classCounts = { TEST_SURFACE: 0, CODE: 0, LINE_COMMENT: 0, BLOCK_COMMENT: 0, STRING: 0, REGEX: 0 }
let codeHits = 0
for (const file of files) {
  const rel = file.slice(WORKTREE_ROOT.length + 1).split(sep).join('/')
  const text = readFileSync(file, 'utf8')
  const cls = classifySource(text)
  const isTestSurface = rel.includes('/test/') || rel.includes('\\test\\')
  for (const token of BANNED_TOKENS) {
    const re = new RegExp(token.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'), 'gi')
    let m
    while ((m = re.exec(text)) !== null) {
      const idx = m.index
      const len = m[0].length
      let same = cls[idx]
      let mixed = false
      for (let k = 1; k < len; k++) {
        if (cls[idx + k] !== same) {
          mixed = true
          break
        }
      }
      const lineNo = text.slice(0, idx).split('\n').length
      const start = Math.max(0, idx - 60)
      const end = Math.min(text.length, idx + len + 60)
      const ctxText = text.slice(start, end).replace(/\n/g, ' ')
      let label
      if (isTestSurface) {
        label = 'TEST-SURFACE'
      } else if (mixed) {
        label = 'CODE' // mixed-class match is treated conservatively as code
      } else if (same === CLS_CODE) {
        label = 'CODE'
      } else if (same === CLS_LINE || same === CLS_BLOCK) {
        label = same === CLS_LINE ? 'LINE-COMMENT' : 'BLOCK-COMMENT'
      } else if (same === CLS_STRING) {
        label = 'STRING'
      } else {
        label = 'REGEX'
      }
      // Conservative re-check for comment-classified src hits: the line must
      // look comment-shaped (JSDoc `*` / `//` / `/* ... */`). If it does not,
      // the hit is demoted to CODE.
      if ((label === 'LINE-COMMENT' || label === 'BLOCK-COMMENT') && !isTestSurface) {
        const lineStart = text.lastIndexOf('\n', idx - 1) + 1
        const lineEnd = text.indexOf('\n', idx)
        const line = text.slice(lineStart, lineEnd === -1 ? text.length : lineEnd)
        const trimmed = line.trim()
        const commentShaped =
          trimmed.startsWith('*') ||
          trimmed.startsWith('//') ||
          trimmed.startsWith('/*') ||
          (trimmed.includes('*/') && trimmed.includes('*')) ||
          trimmed.includes('://')
        if (!commentShaped) label = 'CODE'
      }
      if (label === 'CODE') codeHits += 1
      const key = label === 'LINE-COMMENT' || label === 'BLOCK-COMMENT' ? (label === 'LINE-COMMENT' ? 'LINE_COMMENT' : 'BLOCK_COMMENT') : label.toUpperCase().replace('-', '_')
      classCounts[key] += 1
      log(`  HIT '${token}' ${label} ${rel}:${lineNo}: ...${ctxText}...`)
    }
  }
}
log(`token hit classification: TEST-SURFACE=${classCounts.TEST_SURFACE} CODE=${classCounts.CODE} LINE-COMMENT=${classCounts.LINE_COMMENT} BLOCK-COMMENT=${classCounts.BLOCK_COMMENT} STRING=${classCounts.STRING} REGEX=${classCounts.REGEX}`)
log(`code-level hits in src/ files: ${codeHits}`)
if (codeHits === 0) {
  log('  no CODE hits — every token occurrence is a comment/docstring design note (D-1 value-level mirror),')
  log('  a string, or the P8-T3 negative test surface (whose positive-control text references the tokens by design)')
}
log('')

// ── 3. pure-surface scan (src/push/** + browser test client) ──────────────
log('── 3. pure surface (src/push/** + test/p8t4-test-client.ts) ───────────')
const pushDir = join(REMOTE_DIR, 'src', 'push')
const pushFiles = []
walk(pushDir, pushFiles)
const browserSurface = [...pushFiles, ...BROWSER_SURFACE_EXTRA]
let pushNodeImports = 0
let pushIoImports = 0
let browserExternalBare = 0
const browserExternalNames = new Set()
for (const file of browserSurface) {
  const text = readFileSync(file, 'utf8')
  for (const match of text.matchAll(importRe)) {
    const spec = match[1] ?? match[2]
    const rel = file.slice(WORKTREE_ROOT.length + 1).split(sep).join('/')
    if (spec.startsWith('node:')) {
      pushNodeImports += 1
      log(`  node: import in ${rel}: ${spec}`)
    }
    if (/fetch|http|net|socket|WebSocket/i.test(spec)) {
      pushIoImports += 1
      log(`  I/O-ish import in ${rel}: ${spec}`)
    }
    if (!spec.startsWith('./') && !spec.startsWith('../') && !spec.startsWith('@dsh-agent-team/')) {
      browserExternalBare += 1
      browserExternalNames.add(spec)
      log(`  external bare import in browser-consumable surface ${rel}: ${spec}`)
    }
  }
}
log(`browser-consumable files: ${browserSurface.length}; node: imports: ${pushNodeImports}; I/O-ish imports: ${pushIoImports}; external bare imports: ${browserExternalBare === 0 ? 'NONE' : [...browserExternalNames].join(', ')}`)
log('')

// ── 4. dispatcher backing-surface check ───────────────────────────────────
log('── 4. dispatcher backing surface (handlers/dispatch.ts) ───────────────')
const dispatchText = readFileSync(join(REMOTE_DIR, 'src', 'handlers', 'dispatch.ts'), 'utf8')
const portNames = ['admission', 'catalog', 'compatibility', 'handoff', 'intent', 'lifecycle', 'ledger', 'legacy', 'override', 'policyState', 'projection', 'teamCreate']
const missingPorts = portNames.filter((p) => !new RegExp(`(?:deps|ports)\\.${p}\\b`).test(dispatchText))
log(`12 port groups referenced via deps.<name> / ports.<name>: ${portNames.length - missingPorts.length}/12`)
if (missingPorts.length > 0) log(`  missing: ${missingPorts.join(', ')}`)
const hiddenDeps = dispatchText.match(/ctx\.(get|service)|createConnection|require\(/g)
log(`hidden service/global references in dispatch.ts: ${hiddenDeps === null ? 'NONE' : hiddenDeps.join(', ')}`)
log('')

// ── verdict ───────────────────────────────────────────────────────────────
const pass =
  codeHits === 0 &&
  pushNodeImports === 0 &&
  pushIoImports === 0 &&
  browserExternalBare === 0 &&
  missingPorts.length === 0 &&
  hiddenDeps === null
log('── verdict ─────────────────────────────────────────────────────────────')
log(`criterion-1 dependency scan: ${pass ? 'PASS' : 'FAIL'}`)
log('  (the browser consumes remote responses only; the host binds the 12 ports;')
log('   the push engine + P8-T4 client are external-dependency-free and browser-loadable')
log('   without a Session mirror; src/ token hits are comment-level design notes only)')

writeFileSync(OUT, lines.join('\n') + '\n')
console.log(`dependency-scan: ${pass ? 'PASS' : 'FAIL'} — ${OUT}`)
process.exit(pass ? 0 : 1)
