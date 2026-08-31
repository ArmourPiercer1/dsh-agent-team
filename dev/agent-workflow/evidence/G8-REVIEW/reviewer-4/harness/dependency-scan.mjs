// G8-R4 §4.5 / criterion-1 dependency scan (deterministic).
// 1. Enumerate every import/export-from specifier in packages/remote/**/*.ts
//    (and package root files) and classify them.
// 2. Zero-core: no node:* builtins anywhere in packages/remote; no bare
//    specifiers in src/** (src is pure relative); test/** may use vitest only.
// 3. No-mirror tokens (SessionController / session log / mirror / session
//    events / host-private modules) in code with comments stripped, plus a
//    specifier-level host-private import ban.
// 4. Structural surfaces: RemoteHandlerDeps has exactly the 12 frozen port
//    names; TeamDomainReadPort has exactly one method (readProjectionSource).
// Writes dependency-scan.log next to this script.
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join, dirname, relative, isAbsolute } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
let ROOT = HERE
for (let i = 0; i < 12; i += 1) {
  if (existsSync(join(ROOT, 'packages', 'remote', 'src', 'index.ts'))) break
  const parent = dirname(ROOT)
  if (parent === ROOT) break
  ROOT = parent
}
if (!existsSync(join(ROOT, 'packages', 'remote', 'src', 'index.ts'))) {
  console.error('dependency-scan: worktree root not found from', HERE)
  process.exit(2)
}
const REMOTE = join(ROOT, 'packages', 'remote')
const PROJ_TYPES = join(ROOT, 'packages', 'runtime', 'projection', 'types.ts')
const PORTS = join(REMOTE, 'src', 'handlers', 'ports.ts')

const lines = []
const log = (s = '') => lines.push(s)
let failures = 0
const fail = (s) => {
  failures += 1
  log(`FAIL  ${s}`)
}
const ok = (s) => log(`OK    ${s}`)

// --- 1. enumerate .ts files -------------------------------------------------
function listTs(dir, out = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue
    const full = join(dir, entry.name)
    if (entry.isDirectory()) listTs(full, out)
    else if (entry.name.endsWith('.ts')) out.push(full)
  }
  return out
}
const files = listTs(REMOTE).sort((a, b) => relative(REMOTE, a).localeCompare(relative(REMOTE, b)))
log(`# G8-R4 reviewer-4 dependency scan — ${new Date().toISOString()}`)
log(`# worktree: ${ROOT}`)
log(`# scope: packages/remote (**/*.ts + package root .ts) — ${files.length} files`)
log('')

// --- 2. specifier extraction + classification ------------------------------
const SPEC_RE = /(?:^|\n)\s*(?:import|export)[^'";]*?from\s*['"]([^'"]+)['"]|(?:^|\n)\s*import\s*['"]([^'"]+)['"]/g
const classify = (spec) => {
  if (spec.startsWith('./') || spec.startsWith('../')) return 'relative'
  if (spec.startsWith('node:')) return 'node-builtin'
  if (spec.startsWith('file:') || isAbsolute(spec) || /^[A-Za-z]:[\\/]/.test(spec)) return 'absolute'
  return 'bare'
}
const specCounts = { relative: 0, 'node-builtin': 0, absolute: 0, bare: 0 }
const bareSpecs = new Map() // spec -> [files]
const builtinSpecs = new Map()
log('## A. import-face classification (packages/remote)')
for (const file of files) {
  const rel = relative(REMOTE, file).split('\\').join('/')
  const text = readFileSync(file, 'utf8')
  let m
  SPEC_RE.lastIndex = 0
  while ((m = SPEC_RE.exec(text)) !== null) {
    const spec = m[1] ?? m[2]
    const cls = classify(spec)
    specCounts[cls] += 1
    if (cls === 'bare') {
      if (!bareSpecs.has(spec)) bareSpecs.set(spec, [])
      bareSpecs.get(spec).push(rel)
    }
    if (cls === 'node-builtin') {
      if (!builtinSpecs.has(spec)) builtinSpecs.set(spec, [])
      builtinSpecs.get(spec).push(rel)
    }
  }
}
log(`relative specifiers:   ${specCounts.relative}`)
log(`node:* builtins:       ${specCounts['node-builtin']}`)
log(`absolute/file: URLs:   ${specCounts.absolute}`)
log(`bare specifiers:       ${specCounts.bare}`)
if (bareSpecs.size > 0) {
  for (const [spec, where] of [...bareSpecs.entries()].sort()) {
    log(`  bare '${spec}' in ${where.length} file(s): ${where.slice(0, 5).join(', ')}${where.length > 5 ? '…' : ''}`)
  }
}
log('')

// --- 3. zero-core rules ------------------------------------------------------
log('## B. zero-core rules')
if (specCounts['node-builtin'] === 0) ok('no node:* builtin imports in packages/remote (any layer)')
else for (const [spec, where] of builtinSpecs) fail(`node builtin '${spec}' imported in: ${where.join(', ')}`)
if (specCounts.absolute === 0) ok('no absolute / file: URL imports in packages/remote')
else fail('absolute or file: URL import present in packages/remote')
const bareNonVitest = [...bareSpecs.keys()].filter((s) => !/^vitest(\/.*)?$/.test(s))
if (bareNonVitest.length === 0) ok("bare specifiers are test-only 'vitest' (dev dependency; src/** has none)")
else fail(`non-vitest bare specifiers: ${bareNonVitest.join(', ')}`)
// verify every bare usage is in test/ or a root config
let bareOutsideTest = false
for (const [spec, where] of bareSpecs) {
  for (const f of where) {
    if (!(f.startsWith('test/') || f.endsWith('vitest.config.ts'))) bareOutsideTest = true
  }
}
if (!bareOutsideTest) ok('all vitest imports are in test/ or vitest.config.ts')
else fail('vitest import found outside test/ or vitest.config.ts')
log('')

// --- 4. no-mirror tokens (code only: comments + string-literal contents blanked) ---
// Both variants blank characters (preserving newlines) so reported line
// numbers match the raw file. A mirror token inside a string literal or a
// comment is a MENTION, not coupling — it is reported as NOTE, not FAIL.
// (The specifier-level host-private ban below still runs on raw text, so a
// host-private IMPORT can never hide inside a string.)
function stripNonCode(src, blankStrings) {
  let out = ''
  let i = 0
  const n = src.length
  let quote = null
  const blank = (s) => s.replace(/[^\r\n]/g, ' ')
  while (i < n) {
    const ch = src[i]
    if (quote !== null) {
      if (ch === '\\') {
        out += blankStrings ? '  ' : src.slice(i, i + 2)
        i += 2
        continue
      }
      if (ch === quote) { quote = null; out += ch; i += 1; continue }
      out += blankStrings ? (ch === '\n' ? '\n' : ' ') : ch
      i += 1
      continue
    }
    if (ch === "'" || ch === '"' || ch === '`') {
      quote = ch
      out += ch
      i += 1
      continue
    }
    if (ch === '/' && src[i + 1] === '/') {
      const start = i
      while (i < n && src[i] !== '\n') i += 1
      out += blank(src.slice(start, i))
      continue
    }
    if (ch === '/' && src[i + 1] === '*') {
      const start = i
      i += 2
      while (i < n && !(src[i] === '*' && src[i + 1] === '/')) i += 1
      i = Math.min(n, i + 2)
      out += blank(src.slice(start, i))
      continue
    }
    out += ch
    i += 1
  }
  return out
}
const TOKENS = [
  ['SessionController', /SessionController/g],
  ['sessionLog (identifier)', /\bsessionLog\b/g],
  ['session-log (hyphen)', /session-log/g],
  ['session_log (underscore)', /session_log/g],
  ['SessionEvent (legacy vocab)', /SessionEvent/g],
  ['teamMirror / mirrorTeam', /\b(teamMirror|mirrorTeam)\b/g],
]
const HOST_PRIV_RE = /deepseek-harness|@deepseek|dsh-base|dsh-agent-team\/packages\/client|host\/webserver/
log('## C. no-mirror tokens (code only, packages/remote)')
log('# string-literal / comment mentions are non-binding (NOTE, not FAIL)')
let tokenHits = 0
let stringNotes = 0
for (const file of files) {
  const rel = relative(REMOTE, file).split('\\').join('/')
  const raw = readFileSync(file, 'utf8')
  const code = stripNonCode(raw, true)
  const codeStrings = stripNonCode(raw, false)
  for (const [label, re] of TOKENS) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(code)) !== null) {
      tokenHits += 1
      const lineNo = code.slice(0, m.index).split('\n').length
      fail(`token '${label}' in ${rel}:${lineNo} (code)`)
    }
    re.lastIndex = 0
    let m2
    while ((m2 = re.exec(codeStrings)) !== null) {
      const lineNo = codeStrings.slice(0, m2.index).split('\n').length
      const lineCode = code.split('\n')[lineNo - 1] ?? ''
      if (!new RegExp(re.source).test(lineCode)) {
        stringNotes += 1
        log(`NOTE  non-binding string-literal mention: '${label}' in ${rel}:${lineNo}`)
      }
    }
  }
  if (HOST_PRIV_RE.test(code)) {
    tokenHits += 1
    fail(`host-private reference in ${rel}`)
  }
}
if (stringNotes > 0) ok(`${stringNotes} string-literal mention(s) noted (non-binding)`)
// specifier-level host-private ban (comments never appear in specifiers)
for (const file of files) {
  const rel = relative(REMOTE, file).split('\\').join('/')
  const text = readFileSync(file, 'utf8')
  let m
  SPEC_RE.lastIndex = 0
  while ((m = SPEC_RE.exec(text)) !== null) {
    const spec = m[1] ?? m[2]
    if (HOST_PRIV_RE.test(spec)) {
      tokenHits += 1
      fail(`host-private specifier '${spec}' in ${rel}`)
    }
  }
}
if (tokenHits === 0) ok('zero SessionController / session-log / session-event / mirror / host-private tokens in code + specifiers')
log('')

// --- 5. structural surfaces ---------------------------------------------------
log('## D. structural surfaces')
const portsText = readFileSync(PORTS, 'utf8')
const depsBlock = portsText.match(/export interface RemoteHandlerDeps \{([\s\S]*?)\n\}/)
if (depsBlock === null) fail('RemoteHandlerDeps interface not found in ports.ts')
else {
  const keys = [...depsBlock[1].matchAll(/^\s{2}readonly ([A-Za-z0-9]+):/gm)].map((k) => k[1])
  const EXPECTED = [
    'catalog', 'intent', 'teamCreate', 'projection', 'ledger', 'admission',
    'lifecycle', 'override', 'policyState', 'compatibility', 'handoff', 'legacy',
  ]
  if (keys.length === 12 && EXPECTED.every((k) => keys.includes(k)) && new Set(keys).size === 12) {
    ok(`RemoteHandlerDeps has exactly the 12 frozen port names: ${keys.join(', ')}`)
  } else {
    fail(`RemoteHandlerDeps keys mismatch: got [${keys.join(', ')}] expected 12 names`)
  }
}
const projText = readFileSync(PROJ_TYPES, 'utf8')
const readPortBlock = projText.match(/export interface TeamDomainReadPort \{([\s\S]*?)\n\}/)
if (readPortBlock === null) fail('TeamDomainReadPort interface not found in runtime/projection/types.ts')
else {
  const methods = [...readPortBlock[1].matchAll(/^\s{2}([A-Za-z0-9_]+)\s*\(/gm)].map((k) => k[1])
  if (methods.length === 1 && methods[0] === 'readProjectionSource') {
    ok('TeamDomainReadPort has exactly one method: readProjectionSource (no session-log / child-log read surface)')
  } else {
    fail(`TeamDomainReadPort methods mismatch: [${methods.join(', ')}]`)
  }
}
log('')

// --- 6. test-client data needs ------------------------------------------------
log('## E. P8-T4 test client import face')
const tcRel = 'test/p8t4-test-client.ts'
const tcText = readFileSync(join(REMOTE, tcRel), 'utf8')
const tcSpecs = [...tcText.matchAll(SPEC_RE)].map((m) => m[1] ?? m[2])
for (const spec of tcSpecs) {
  const cls = classify(spec)
  if (cls !== 'relative') fail(`p8t4-test-client.ts non-relative specifier '${spec}' (${cls})`)
}
if (tcSpecs.every((s) => classify(s) === 'relative')) {
  ok(`p8t4-test-client.ts imports only relative modules: ${[...new Set(tcSpecs)].join(', ')}`)
}
log('')
log(failures === 0 ? 'DEPENDENCY-SCAN-PASS' : `DEPENDENCY-SCAN-FAIL failures=${failures}`)

writeFileSync(join(HERE, '..', 'dependency-scan.log'), lines.join('\n') + '\n', 'utf8')
process.stdout.write(lines.join('\n') + '\n')
process.exit(failures === 0 ? 0 : 1)
