#!/usr/bin/env node
/**
 * A5M2 G5 window B — 07 STATIC IMPORT TARGET AUDIT (pure code, zero import,
 * zero spawn; verbatim reuse of the A-window tool, G3 lane, only the header
 * differs). The cold-import RC1 class — a statically imported file NOT
 * inside the packed placement — is the SAME failure class as the dist-mirror
 * P1. This audit walks the fixture plugin tree's RELATIVE static imports
 * transitively and answers the missing list — BEFORE the window, without
 * importing anything (module tops never execute).
 *
 * Usage: node 07-static-import-audit.mjs <plugin-pkg-dir>
 *   <plugin-pkg-dir> = <INSTALL_DIR>/node_modules/dsh-agent-team
 * Exit: 0 all static relative targets resolve; 1 missing list printed;
 *       3 usage/entry problems (fail-closed).
 */
import { existsSync, readFileSync, statSync } from 'node:fs'
import { dirname, resolve, join } from 'node:path'

const pkgDir = process.argv[2]
if (typeof pkgDir !== 'string' || !existsSync(pkgDir) || !statSync(pkgDir).isDirectory()) {
  console.error(JSON.stringify({ verdict: 'USAGE', reason: 'plugin package dir absent (fail-closed; never creates anything)' }))
  process.exit(3)
}
const entryManifest = join(pkgDir, 'package.json')
if (!existsSync(entryManifest)) { console.error(JSON.stringify({ verdict: 'USAGE', reason: `no package.json at ${pkgDir}` })); process.exit(3) }
const hostExport = JSON.parse(readFileSync(entryManifest, 'utf8'))?.exports?.['./host']
if (typeof hostExport !== 'string') { console.error(JSON.stringify({ verdict: 'USAGE', reason: 'exports["./host"] missing' })); process.exit(3) }
const entry = resolve(pkgDir, hostExport.replace(/^\.\//, ''))
if (!existsSync(entry)) { console.error(JSON.stringify({ verdict: 'MISSING', missing: [{ from: entryManifest, specifier: hostExport }] })); process.exit(1) }

// static import/export-from specifiers only (comment-stripped, line regex —
// the SAME dialect the earlier P1 audit used; dynamic import() is NOT a
// load-time binding and is intentionally out of scope)
const STATIC_RE = /(?:^|\n)\s*(?:import\s+(?:[\s\S]*?from\s*)?|export\s+(?:[\s\S]*?from\s*))['"]([^'"]+)['"]/g

function* specifiers(file) {
  const src = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
  for (const m of src.matchAll(STATIC_RE)) yield m[1]
}
/** node's resolution for a RELATIVE specifier, restricted to the extensions
 *  an ESM static import may omit in bundled/glue trees we actually ship. */
function resolves(baseFile, spec) {
  const p = resolve(dirname(baseFile), spec)
  for (const cand of [p, `${p}.mjs`, `${p}.js`, `${p}.json`, join(p, 'index.mjs'), join(p, 'index.js')]) {
    try { if (statSync(cand).isFile()) return true } catch { /* next */ }
  }
  return false
}

const seen = new Set()
const missing = []
const queue = [entry]
const CAP = 4000
while (queue.length > 0 && seen.size < CAP) {
  const file = queue.pop()
  if (seen.has(file)) continue
  seen.add(file)
  let isFile = false
  try { isFile = statSync(file).isFile() } catch { /* fallthrough */ }
  if (!isFile) { missing.push({ from: '<queue>', specifier: file, reason: 'queue target absent' }); continue }
  let text = false
  try { text = /\.(mjs|js)$/.test(file) } catch { /* */ }
  if (!text) continue
  for (const spec of specifiers(file)) {
    if (!spec.startsWith('.')) continue // package/builtin specifiers resolve through node_modules, not the placed-tree law
    if (resolves(file, spec)) {
      const target = resolve(dirname(file), spec)
      for (const cand of [target, `${target}.mjs`, `${target}.js`, join(target, 'index.mjs'), join(target, 'index.js')]) {
        if (existsSync(cand) && /\.(mjs|js)$/.test(cand)) { queue.push(cand); break }
      }
    } else {
      missing.push({ from: file, specifier: spec })
    }
  }
}
console.log(JSON.stringify({ verdict: missing.length === 0 ? 'OK' : 'MISSING', scanned: seen.size, entry, missing: missing.slice(0, 60) }, null, 2))
process.exit(missing.length === 0 ? 0 : 1)
