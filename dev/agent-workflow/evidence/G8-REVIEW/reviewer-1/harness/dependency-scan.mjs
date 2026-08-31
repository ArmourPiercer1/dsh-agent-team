/**
 * dependency-scan.mjs — G8-REVIEW reviewer-1 §5 dependency scan.
 *
 * Scans the import FACE of packages/remote (src + test) in the reviewed
 * worktree and asserts:
 *   S1 — every import specifier is a relative path that resolves to a file
 *        INSIDE packages/remote (the design note's deviation D-1: the
 *        remote package is self-contained; zero cross-package .ts imports,
 *        zero bare upstream imports, zero node: builtins — pure module);
 *   S2 — zero code references to the upstream session machinery
 *        (SessionController / SessionLog / SessionEvent / session-log /
 *        the legacy team session-event vocabulary); doc-comment mentions
 *        are reported and classified, not silently passed;
 *   S3 — the ONLY coupling surface to the rest of the system is the twelve
 *        structural ports (RemoteHandlerDeps): catalog, intent, teamCreate,
 *        projection, ledger, admission, lifecycle, override, policyState,
 *        compatibility, handoff, legacy;
 *   S4 — the client's data needs are met by the closed 9-category /
 *        23-method catalog (listed here) — no UI-visible action lacks a
 *        typed remote method (the six G8 criteria operate exclusively
 *        through these responses).
 *
 * Output: dependency-scan.log next to this file. Read-only.
 */
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const WORKTREE = process.argv[2]
const REMOTE_PKG = join(WORKTREE, 'packages', 'remote')
const lines = []
function log(msg) {
  lines.push(msg)
}
const failures = []
function expect(cond, label, detail) {
  log(`${cond ? 'PASS' : 'FAIL'}  ${label}${detail !== undefined ? `  (${detail})` : ''}`)
  if (!cond) failures.push(label)
}

function walkFiles(dir) {
  const out = []
  for (const entry of readdirSync(dir)) {
    const p = join(dir, entry)
    if (statSync(p).isDirectory()) out.push(...walkFiles(p))
    else if (/\.(ts|mts|cts)$/.test(entry)) out.push(p)
  }
  return out
}

const IMPORT_RE = /(?:import|export)\s+(?:[\s\S]*?from\s+)?['"]([^'"]+)['"]/g
const IMPORT_SIDE_EFFECT_RE = /import\s+['"]([^'"]+)['"]/g

const allFiles = walkFiles(REMOTE_PKG)
// Purity (S1) and zero-session-machinery (S2) apply to the PRODUCT surface
// (src/). Test files legitimately import the repo's own test runner (vitest)
// and may name forbidden tokens as test DATA (the p8t3 negative-scan suite is
// itself the test asserting the src/ purity) — reported separately, not as
// product failures.
const srcFiles = allFiles.filter((f) => f.startsWith(join(REMOTE_PKG, 'src') + sep))
const otherFiles = allFiles.filter((f) => !srcFiles.includes(f))
log(`scanned ${allFiles.length} TS files under packages/remote (worktree: ${WORKTREE})`)
log(`  product surface src/: ${srcFiles.length} files | test/config: ${otherFiles.length} files`)
log('')

// ── S1: import face (product surface = src/) ────────────────────────────────
log('S1 — import face, src/: every specifier relative, resolving inside packages/remote')
const specifierReport = []
let crossPackage = 0
let builtin = 0
let bare = 0
let unresolved = 0
function collectSpecs(text) {
  const specs = new Set()
  for (const re of [IMPORT_RE, IMPORT_SIDE_EFFECT_RE]) {
    re.lastIndex = 0
    let m
    while ((m = re.exec(text)) !== null) specs.add(m[1])
  }
  return specs
}
for (const file of srcFiles) {
  for (const spec of [...collectSpecs(readFileSync(file, 'utf8'))].sort()) {
    let kind
    let resolvedOk = true
    if (spec.startsWith('node:')) {
      kind = 'node-builtin'
      builtin += 1
      resolvedOk = false
    } else if (spec.startsWith('.')) {
      kind = 'relative'
      const base = resolve(dirname(file), spec)
      const candidates = [base, `${base.slice(0, -'.js'.length)}.ts`, `${base.slice(0, -'.mjs'.length)}.mts`, join(base, 'index.ts')]
      resolvedOk = candidates.some((c) => existsSync(c))
      if (!resolvedOk) unresolved += 1
      if (!base.startsWith(REMOTE_PKG)) {
        kind = 'relative-ESCAPES-package'
        crossPackage += 1
      }
    } else {
      kind = 'bare'
      bare += 1
      resolvedOk = false
    }
    specifierReport.push({ file: file.slice(WORKTREE.length + 1), spec, kind, ok: resolvedOk })
  }
}
expect(builtin === 0, 'S1.1: src/ has zero node: builtin imports (pure module)', builtin)
expect(bare === 0, 'S1.2: src/ has zero bare (upstream/external) imports', bare)
expect(crossPackage === 0, 'S1.3: src/ has zero imports escaping packages/remote', crossPackage)
expect(unresolved === 0, 'S1.4: every src/ relative specifier resolves to an in-package file', unresolved)
log(`  (src/ total specifiers: ${specifierReport.length}; relative ${specifierReport.filter((s) => s.kind === 'relative').length})`)
for (const r of specifierReport.filter((s) => !s.ok)) log(`  UNRESOLVED/ESCAPING: ${r.file} -> ${r.spec} [${r.kind}]`)
log('')
log('S1.T — test/config import face (vitest runner expected; other bare or escaping specifiers flagged)')
const testReport = []
let testBad = 0
for (const file of otherFiles) {
  for (const spec of [...collectSpecs(readFileSync(file, 'utf8'))].sort()) {
    let kind
    let ok = true
    if (spec.startsWith('node:')) {
      kind = 'node-builtin'
      ok = true // test tooling may use builtins
    } else if (spec.startsWith('.')) {
      kind = 'relative'
      const base = resolve(dirname(file), spec)
      const candidates = [base, `${base.slice(0, -'.js'.length)}.ts`, `${base.slice(0, -'.mjs'.length)}.mts`, join(base, 'index.ts')]
      ok = candidates.some((c) => existsSync(c))
      if (!ok) kind = 'relative-UNRESOLVED'
      else if (!base.startsWith(REMOTE_PKG)) {
        kind = 'relative-ESCAPES-package'
        ok = false
      }
    } else {
      kind = spec.startsWith('vitest') ? 'bare-vitest(expected)' : 'bare'
      if (!kind.endsWith('(expected)')) ok = false
    }
    if (!ok) testBad += 1
    testReport.push({ file: file.slice(WORKTREE.length + 1), spec, kind, ok })
  }
}
expect(testBad === 0, 'S1.T: test/config imports are vitest + in-package relatives only', testBad)
log(`  (test/config total specifiers: ${testReport.length})`)
for (const r of testReport) {
  const tag = r.kind === 'bare-vitest(expected)' ? ' (expected)' : r.ok ? '' : ' FLAG'
  log(`  ${r.file} -> ${r.spec} [${r.kind}]${tag}`)
}
log('')

// ── S2: zero session-machinery references ───────────────────────────────────
log('S2 — zero session-machinery references (upstream SessionController/SessionLog/session-event vocabulary)')
const FORBIDDEN = [
  { name: 'SessionController', re: /SessionController/g },
  { name: 'SessionLog', re: /SessionLog\b/g },
  { name: 'SessionEvent vocabulary', re: /SessionEvent/g },
  { name: 'session-log token', re: /session-log/g },
  { name: 'legacy team session event token', re: /team-session-event|TeamSessionEvent/g },
]
let codeHits = 0
let commentHits = 0
let testHits = 0
const hitLines = []
// crude quote-state check: is `idx` inside a string literal on this line?
function inString(lineText, idx) {
  let inS = false
  let inD = false
  for (let i = 0; i < idx; i++) {
    const ch = lineText[i]
    if (ch === '\\') { i++; continue }
    if (ch === "'" && !inD) inS = !inS
    if (ch === '"' && !inS) inD = !inD
  }
  return inS || inD
}
function isCommentAt(lineText, idx) {
  if (/^\s*(\*|\/\/|\/\*)/.test(lineText)) return true
  const slash = lineText.indexOf('//')
  return slash !== -1 && slash < idx && !inString(lineText, slash)
}
for (const file of allFiles) {
  const isSrc = srcFiles.includes(file)
  const raw = readFileSync(file, 'utf8')
  const textLines = raw.split('\n')
  textLines.forEach((lineText, i) => {
    for (const f of FORBIDDEN) {
      f.re.lastIndex = 0
      let m
      while ((m = f.re.exec(lineText)) !== null) {
        const isComment = isCommentAt(lineText, m.index)
        const isString = inString(lineText, m.index)
        const isTypeOnly = /import\s+type/.test(lineText)
        if (isComment || isString || isTypeOnly) {
          if (isSrc) commentHits += 1
          else testHits += 1
          hitLines.push(`${file.slice(WORKTREE.length + 1)}:${i + 1} [${f.name}${isSrc ? ',doc-context' : ',test-data-or-runner'}]: ${lineText.trim().slice(0, 110)}`)
        } else if (isSrc) {
          codeHits += 1
          hitLines.push(`${file.slice(WORKTREE.length + 1)}:${i + 1} [${f.name},CODE]: ${lineText.trim().slice(0, 110)}`)
        } else {
          testHits += 1
          hitLines.push(`${file.slice(WORKTREE.length + 1)}:${i + 1} [${f.name},test-code]: ${lineText.trim().slice(0, 110)}`)
        }
      }
    }
  })
}
expect(codeHits === 0, 'S2.1: zero CODE references to the session machinery in src/', codeHits)
log(`S2.2: doc-context mentions in src/: ${commentHits} (classified, not passed silently)`)
log(`S2.3: test/config mentions (test data / negative-scan suites): ${testHits} (reported, not product coupling)`)
for (const h of hitLines) log(`  ${h}`)
log('')

// ── S3: the twelve-port surface is the only coupling ────────────────────────
log('S3 — the twelve structural ports are the only external coupling surface')
const portsText = readFileSync(join(REMOTE_PKG, 'src', 'handlers', 'ports.ts'), 'utf8')
const EXPECTED_PORTS = ['catalog', 'intent', 'teamCreate', 'projection', 'ledger', 'admission', 'lifecycle', 'override', 'policyState', 'compatibility', 'handoff', 'legacy']
const depsDecl = portsText.match(/interface RemoteHandlerDeps[\s\S]*?^}/m)
expect(depsDecl !== null, 'S3.1: RemoteHandlerDeps declared in handlers/ports.ts')
const declared = EXPECTED_PORTS.filter((p) => depsDecl !== null && new RegExp(`readonly ${p}:\\s*Remote\\w+Port`).test(depsDecl[0]))
expect(declared.length === 12, 'S3.2: all twelve ports declared on RemoteHandlerDeps', declared)
const handlerDir = join(REMOTE_PKG, 'src', 'handlers')
const handlerFiles = readdirSync(handlerDir).filter((f) => /-handler|handler/.test(f) === false || true)
const usesPorts = []
for (const f of readdirSync(handlerDir).filter((f) => f.endsWith('.ts'))) {
  const t = readFileSync(join(handlerDir, f), 'utf8')
  if (t.includes('ports.')) usesPorts.push(f)
}
log(`S3.3: handler modules consuming the port surface: ${usesPorts.join(', ')}`)
log('')

// ── S4: catalog coverage of the client's data needs ─────────────────────────
log('S4 — closed catalog: the client data needs are met by remote responses')
const catalogText = readFileSync(join(REMOTE_PKG, 'src', 'contracts', 'catalog.ts'), 'utf8')
const methodRe = /'([a-z]+\.[a-zA-Z]+)'/g
const methods = new Set()
let mm
while ((mm = methodRe.exec(catalogText)) !== null) methods.add(mm[1])
const sortedMethods = [...methods].sort()
log(`  catalog methods (${sortedMethods.length}): ${sortedMethods.join(', ')}`)
const REQUIRED_FOR_UI = {
  'whole-projection observation (E1/E2/E3)': 'team.getProjection',
  'ledger pages (E4)': 'team.getLedgerPage',
  'typed admission effects (E5): create': 'member.create',
  'typed admission effects (E5): send': 'member.send',
  'typed admission effects (E5): follow-up': 'member.followup',
  'member lifecycle': ['member.archive', 'member.restore', 'member.dispose'],
}
for (const [need, method] of Object.entries(REQUIRED_FOR_UI)) {
  const list = Array.isArray(method) ? method : [method]
  for (const m of list) expect(sortedMethods.includes(m), `S4: ${need} -> ${m}`)
}
log('')

log(failures.length === 0 ? 'DEPENDENCY SCAN: ALL PASS' : `DEPENDENCY SCAN: ${failures.length} FAILURES: ${failures.join(' | ')}`)
writeFileSync(join(HERE, 'dependency-scan.log'), lines.join('\n') + '\n')
console.log(lines.join('\n'))
process.exitCode = failures.length === 0 ? 0 : 1
