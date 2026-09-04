#!/usr/bin/env node
// S8 analysis: enumerate bare (non-relative) import specifiers in the
// client dist ESM + the module universe (all .js under the dist src tree).
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'

const [,, distClientSrc, remoteSrc] = process.argv
const roots = process.argv.slice(2).filter(Boolean)
if (roots.length === 0) {
  console.error('usage: node s8-analyze.mjs <dist-src-root> [<dist-src-root2> ...]')
  process.exit(2)
}

function walk(dir) {
  const out = []
  for (const e of readdirSync(dir)) {
    const full = join(dir, e)
    const st = statSync(full)
    if (st.isDirectory()) out.push(...walk(full))
    else if (e.endsWith('.js')) out.push(full)
  }
  return out
}

const files = roots.flatMap((r) => walk(r))
const bare = new Map()
const css = new Map()
const relUnresolved = []
for (const f of files) {
  const text = readFileSync(f, 'utf8')
  const lines = text.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const m = line.match(/^\s*(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]/)
    const side = line.match(/^\s*import\s+['"]([^'"]+)['"]/)
    const spec = m ? m[1] : side ? side[1] : null
    if (spec === null) continue
    if (spec.startsWith('.')) {
      // css imports land here too
      if (spec.endsWith('.css')) css.set(join(dirname(f), spec), spec)
      continue
    }
    bare.set(spec, (bare.get(spec) ?? 0) + 1)
  }
}
console.log(`module files: ${files.length}`)
console.log('--- bare imports (client dist) ---')
for (const [k, v] of [...bare.entries()].sort()) console.log(`${v}\t${k}`)
if (remoteSrc) {
  const b2 = new Map()
  for (const f of walk(remoteSrc)) {
    const text = readFileSync(f, 'utf8')
    for (const line of text.split('\n')) {
      const m = line.match(/^\s*(?:import|export)\s[^;]*?from\s+['"]([^'"]+)['"]/)
      const side = line.match(/^\s*import\s+['"]([^'"]+)['"]/)
      const spec = m ? m[1] : side ? side[1] : null
      if (spec === null || spec.startsWith('.')) continue
      b2.set(spec, (b2.get(spec) ?? 0) + 1)
    }
  }
  console.log('--- bare imports (remote dist) ---')
  for (const [k, v] of [...b2.entries()].sort()) console.log(`${v}\t${k}`)
}
console.log('--- css imports ---')
for (const [k, v] of [...css.entries()].sort()) console.log(v)
