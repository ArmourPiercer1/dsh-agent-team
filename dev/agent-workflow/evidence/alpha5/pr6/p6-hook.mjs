/**
 * p6-hook.mjs — ESM resolve hook for the Alpha.5 PR6 PoC6a/PoC6b runners (Team-owned, PoC only).
 *
 * Mechanism-identical to alpha5-adapter-p0/05-ptc/p05-ai-hook.mjs (the established P0
 * pattern, copied here so this evidence dir is self-contained): every bare
 * '@deepseek-ai/<name>' import (including transitive imports inside the built libs)
 * resolves to the pristine test-use checkout's own built entry file URL.
 * Nothing is written into T; nothing is linked into any node_modules.
 * TEST-HARNESS concern only — the pinned host never uses it.
 *
 * The tree root arrives via register(..., { data: { testUse } }); env P6_TEST_USE is
 * the worker-side fallback.
 * @module evidence/alpha5/pr6/p6-hook
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

let testUse = undefined
let map = undefined

/** Scan vendor/ + packages/<group>/<pkg>/ manifests once; map package name -> dir. */
function buildMap() {
  const out = new Map()
  const scanDirs = []
  const vendor = join(testUse, 'vendor')
  for (const name of safeReaddir(vendor)) scanDirs.push(join(vendor, name))
  const groups = join(testUse, 'packages')
  for (const group of safeReaddir(groups)) {
    const gdir = join(groups, group)
    for (const pkg of safeReaddir(gdir)) scanDirs.push(join(gdir, pkg))
  }
  for (const dir of scanDirs) {
    const manifest = join(dir, 'package.json')
    if (!existsSync(manifest)) continue
    try {
      const j = JSON.parse(readFileSync(manifest, 'utf8'))
      if (typeof j.name === 'string' && j.name.startsWith('@deepseek-ai/') && !out.has(j.name)) out.set(j.name, dir)
    } catch { /* unreadable manifest: not addressable */ }
  }
  return out
}

function safeReaddir(dir) {
  try { return readdirSync(dir) } catch { return [] }
}

/** Entry file for '.' export of a scanned package dir (built lib plane only). */
function entryOf(dir) {
  let j
  try { j = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8')) } catch { j = {} }
  const dot = j.exports && j.exports['.']
  let rel = undefined
  if (typeof dot === 'string') rel = dot
  else if (dot && typeof dot === 'object') rel = dot.default ?? dot.import ?? dot.require
  if (typeof rel === 'string') {
    const p = join(dir, rel)
    if (existsSync(p)) return p
  }
  for (const cand of ['lib/index.js', 'index.js']) {
    if (existsSync(join(dir, cand))) return join(dir, cand)
  }
  throw new Error(`p6-hook: no built entry found for ${dir} (is the test-use checkout built?)`)
}

export function initialize(data) {
  testUse = data && data.testUse ? data.testUse : process.env.P6_TEST_USE
  if (!testUse) throw new Error('p6-hook: testUse root not provided')
}

export function resolve(specifier, context, nextResolve) {
  if (specifier === '@deepseek-ai/cordis' || specifier.startsWith('@deepseek-ai/dsh-') || specifier.startsWith('@deepseek-ai/schemastery')) {
    map ??= buildMap()
    const dir = map.get(specifier)
    if (dir !== undefined) return { url: pathToFileURL(entryOf(dir)).href, shortCircuit: true, format: 'module' }
  }
  return nextResolve(specifier, context)
}
