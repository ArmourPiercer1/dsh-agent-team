// §5.4 dependency scan (read-only):
//  1. packages/remote/** import face — every import specifier must be
//     relative or a node: builtin (zero third-party/bare deps).
//  2. packages/client/** import face — same rule.
//  3. Forbidden tokens across packages/remote and packages/client:
//     SessionController / session-log / mirror (the browser must need no
//     SessionController Team mirror; remote talks only through the
//     connection.rpc seam).
//  4. The 12-port surface: extract the port keys of RemotePorts from
//     packages/remote/src/contracts/ports.ts.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const WORKTREE = resolve(HERE, '..', '..', '..', '..', '..')
const OUT_LOG = join(HERE, 'dependency-scan.log')

const lines = []
const out = (s = '') => lines.push(s)

function walk(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) walk(p, acc)
    else if (/\.(ts|mts|cts|js|mjs)$/.test(entry.name)) acc.push(p)
  }
  return acc
}

const IMPORT_RE = /(?:import|export)[^'"]*?from\s+['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|^import\s+['"]([^'"]+)['"]/gm
function specifiersOf(text) {
  const specs = []
  let m
  IMPORT_RE.lastIndex = 0
  while ((m = IMPORT_RE.exec(text)) !== null) {
    const spec = m[1] ?? m[2] ?? m[3]
    if (spec !== undefined) specs.push(spec)
  }
  return specs
}

function scanPackage(pkgDir, label) {
  out(`=== ${label}: ${pkgDir} ===`)
  const files = walk(resolve(WORKTREE, pkgDir))
  out(`scanned ${files.length} source files`)
  const bare = []
  let rel = 0
  let builtin = 0
  for (const f of files) {
    const text = readFileSync(f, 'utf8')
    for (const spec of specifiersOf(text)) {
      if (spec.startsWith('.')) rel += 1
      else if (spec.startsWith('node:')) builtin += 1
      else bare.push({ file: f, spec })
    }
  }
  out(`relative import specifiers : ${rel}`)
  out(`node: builtin specifiers    : ${builtin}`)
  out(`bare/third-party specifiers : ${bare.length}`)
  for (const b of bare) out(`  BARE ${b.spec}  @  ${b.file}`)
  out(`RESULT: ${bare.length === 0 ? 'PASS (import face fully relative + node: builtins only)' : 'FAIL (bare specifiers found)'}`)
  out()
  return bare
}

const TOKENS = ['SessionController', 'session-controller', 'sessionLog', 'session-log', 'session_log', 'mirror', 'Mirror']
function tokenScan(pkgDir, label) {
  out(`=== ${label}: forbidden-token scan (${TOKENS.join(', ')}) ===`)
  const files = walk(resolve(WORKTREE, pkgDir))
  let total = 0
  for (const f of files) {
    const text = readFileSync(f, 'utf8')
    const toksInFile = TOKENS.filter((t) => text.includes(t))
    if (toksInFile.length === 0) continue
    const byTok = {}
    for (const t of toksInFile) {
      let count = 0
      let idx = 0
      while ((idx = text.indexOf(t, idx)) !== -1) { count += 1; idx += t.length }
      byTok[t] = count
      total += count
    }
    out(`  ${f} -> ${JSON.stringify(byTok)}`)
  }
  out(`total forbidden-token hits: ${total}`)
  out(`RESULT: ${total === 0 ? 'PASS (zero SessionController/session-log/mirror tokens)' : 'REVIEW (hits listed above)'}`)
  out()
  return total
}

// 1+2: import faces
const bareRemote = scanPackage('packages/remote', 'import face (packages/remote)')
const bareClient = scanPackage('packages/client', 'import face (packages/client)')

// 3: token scans
const tokRemote = tokenScan('packages/remote', 'forbidden tokens (packages/remote)')
const tokClient = tokenScan('packages/client', 'forbidden tokens (packages/client)')

// 4: the 12-port surface
out('=== 12-port surface (Remote*Port interfaces in packages/remote/src/handlers/ports.ts) ===')
const portsText = readFileSync(resolve(WORKTREE, 'packages/remote/src/handlers/ports.ts'), 'utf8')
const portKeys = []
const keyRe = /export interface (Remote\w*Port)\b/g
let pm
while ((pm = keyRe.exec(portsText)) !== null) portKeys.push(pm[1])
for (const k of portKeys) out(`  port: ${k}`)
out(`port count: ${portKeys.length}`)
out(`RESULT: ${portKeys.length === 12 ? 'PASS (12 ports)' : 'REVIEW (expected 12)'}`)
out()

out(`OVERALL: import-face-remote=${bareRemote.length === 0 ? 'PASS' : 'FAIL'} import-face-client=${bareClient.length === 0 ? 'PASS' : 'FAIL'} tokens-remote=${tokRemote} tokens-client=${tokClient} ports=${portKeys.length}`)

writeFileSync(OUT_LOG, lines.join('\n') + '\n')
console.log(lines.join('\n'))
