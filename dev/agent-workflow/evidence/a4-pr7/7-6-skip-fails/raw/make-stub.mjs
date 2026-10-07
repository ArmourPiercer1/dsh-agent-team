#!/usr/bin/env node
/**
 * Mutation helper (scratch, never part of the gate): make every upstream
 * package in the built client closure resolvable EXCEPT `clsx`, so the
 * closure-gated step prints `1 unresolvable: clsx` — the shape the reviewer
 * measured on an install surface where 22 of 23 resolve.
 *
 * Each stub is a real directory under `<worktree>/node_modules/<package>` with
 * a manifest and one module that exports exactly the names the closure imports
 * from it (so ESM linking gets past them and the only remaining failure is the
 * deliberately absent `clsx`).
 *
 * Usage: node make-stub.mjs collect   -> prints the specifier/importer table
 *        node make-stub.mjs write     -> writes the stubs
 *        node make-stub.mjs clean     -> deletes them
 */
import { mkdirSync, existsSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))

/** Walk up to the repo root instead of counting `..` segments by hand. */
function findRepoRoot(from) {
  let dir = from
  for (;;) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir
    const parent = dirname(dir)
    if (parent === dir) throw new Error(`no repo root above ${from}`)
    dir = parent
  }
}

const repoRoot = findRepoRoot(HERE)
const { scanModuleClosure } = await import(join(repoRoot, 'scripts/composition-smoke-closure.mjs'))
const entry = join(repoRoot, 'packages/client/dist/packages/client/src/plugin/client.js')
const HIDE = ['clsx']

const closure = scanModuleClosure({ entryFile: entry, repoRoot })
/** Keyed by SPECIFIER, because a subpath is its own module (`shiki/core`). */
const wanted = new Map()
for (const item of closure.upstreamUnresolved) {
  const pkg = item.package ?? item.specifier
  if (HIDE.includes(pkg)) continue
  if (!wanted.has(item.specifier)) wanted.set(item.specifier, { pkg, names: new Set(), hasDefault: false })
  const entryOf = wanted.get(item.specifier)
  let text = ''
  try {
    text = readFileSync(item.importer, 'utf8')
  } catch {
    continue
  }
  const esc = item.specifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  for (const match of text.matchAll(new RegExp(`import\\s+([^;]*?)\\s*from\\s*['"]${esc}['"]`, 'g'))) {
    const clause = match[1].trim()
    const braces = /\{([^}]*)\}/.exec(clause)
    if (braces) {
      for (const part of braces[1].split(',')) {
        const token = part.trim()
        if (token.length === 0) continue
        entryOf.names.add(token.split(/\s+as\s+/)[0].trim())
      }
    }
    if (/(^|})\s*[A-Za-z_$][\w$]*\s*(,|$)/.test(clause) || /^[A-Za-z_$][\w$]*$/.test(clause)) entryOf.hasDefault = true
  }
}

/**
 * Which packages the stub set touches. Read back from the receipt, NOT from a
 * fresh scan: once the stubs exist the scan no longer calls them unresolvable,
 * so a scan-derived clean list is empty and the mutation never rolls back.
 */
const RECEIPT = join(HERE, 'stub-receipt.json')

function stubbedPackages() {
  if (!existsSync(RECEIPT)) return []
  return JSON.parse(readFileSync(RECEIPT, 'utf8')).packages
}

if (process.argv[2] === 'clean') {
  for (const pkg of stubbedPackages()) rmSync(join(repoRoot, 'node_modules', pkg), { recursive: true, force: true })
  for (const pkg of HIDE) rmSync(join(repoRoot, 'node_modules', pkg), { recursive: true, force: true })
  rmSync(RECEIPT, { force: true })
  console.log(`cleaned ${stubbedPackages().length || 'the receipted'} stub package(s)`)
  process.exit(0)
}

const rows = [...wanted.entries()].map(([specifier, info]) => ({
  specifier,
  package: info.pkg,
  namedExports: [...info.names].sort(),
  default: info.hasDefault,
}))
if (process.argv[2] !== 'write') {
  console.log(JSON.stringify({
    unresolvableSpecifierCountAtBase: closure.upstreamUnresolved.length,
    hidden: HIDE,
    rows,
  }, null, 2))
  process.exit(0)
}

const perPackage = new Map()
for (const [specifier, info] of wanted) {
  if (!perPackage.has(info.pkg)) perPackage.set(info.pkg, [])
  perPackage.get(info.pkg).push([specifier, info])
}
let written = 0
for (const [pkg, entries] of perPackage) {
  const dir = join(repoRoot, 'node_modules', pkg)
  if (existsSync(dir)) throw new Error(`refusing to overwrite an existing package directory: ${dir}`)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'package.json'), JSON.stringify({
    name: pkg,
    version: '0.0.0-mutation-stub',
    type: 'module',
    exports: { '.': './index.js', './*': './*.js' },
  }, null, 2))
  for (const [specifier, info] of entries) {
    const rest = specifier.slice(pkg.length).split('/').filter(Boolean)
    const rel = rest.length === 0 ? ['index.js'] : [`${rest.map((part) => part.replace(/[^\w.-]/g, '_')).join('/')}.js`]
    const file = join(dir, ...rel)
    mkdirSync(dirname(file), { recursive: true })
    const body = [
      ...(info.hasDefault ? ['export default {}'] : []),
      ...[...info.names].sort().map((name) => `export const ${name} = {}`),
    ]
    writeFileSync(file, `${body.join('\n')}\n`)
    written += 1
  }
}
writeFileSync(RECEIPT, JSON.stringify({ packages: [...perPackage.keys()].sort(), hidden: HIDE }, null, 2))
console.log(`wrote ${written} stub module file(s) across ${perPackage.size} package(s); hidden: ${HIDE.join(', ')}; receipt ${RECEIPT}`)
