// E3 standalone replica (debug helper for the kit closure+probe; not a gate).
import { execFileSync, spawnSync } from 'node:child_process'
import { mkdirSync, readdirSync, existsSync, readFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { pathToFileURL } from 'node:url'
const WT = process.cwd()
const EXP = join(WT, '..', '.a5g7-e3-check')
execFileSync('rm', ['-rf', EXP])
mkdirSync(EXP, { recursive: true })
execFileSync('sh', ['-c', 'git archive HEAD -- packages/runtime/dist packages/runtime/package.json .agents/skills | tar -x -C ' + EXP])
const DEPS_SRC = join(WT, 'packages', 'runtime', 'node_modules')
const DEPS_STORE = resolve(DEPS_SRC, '..', '..', '..', 'node_modules', '.pnpm')
const nm = join(EXP, 'node_modules')
mkdirSync(nm, { recursive: true })
const storeDirs = readdirSync(DEPS_STORE)
const findSource = (name) => {
  const direct = join(DEPS_SRC, ...name.split('/'))
  if (existsSync(direct)) return { dir: direct, from: 'direct' }
  const flat = name.replace('/', '+')
  const plain = name.startsWith('@') ? name.split('/')[1] ?? name : name
  const cands = storeDirs.filter((d) => d.startsWith(flat + '@') || d.startsWith(plain + '@') || d.includes('+' + plain + '@'))
  const w = cands.find((d) => existsSync(join(DEPS_STORE, d, 'node_modules', name)))
  return w === undefined ? null : { dir: join(DEPS_STORE, w, 'node_modules', name), from: 'store' }
}
const pkg = JSON.parse(readFileSync(join(EXP, 'packages', 'runtime', 'package.json'), 'utf8'))
const queue = ['dependencies', 'peerDependencies', 'optionalDependencies'].flatMap((k) => Object.keys(pkg[k] ?? {}))
const OPTIONAL_ONLY = new Set(Object.keys(pkg.optionalDependencies ?? {}))
const seen = new Set()
let miss = null
for (let g = 0; g < 240 && queue.length > 0; g += 1) {
  const name = queue.shift()
  if (seen.has(name)) continue
  seen.add(name)
  const src = findSource(name)
  if (src === null) { if (OPTIONAL_ONLY.has(name)) { continue } miss = 'no source ' + name; break }
  const dst = join(nm, ...name.split('/'))
  mkdirSync(dirname(dst), { recursive: true })
  const cp = spawnSync('cp', ['-aL', src.dir, dst], { timeout: 120_000 })
  if (cp.status !== 0) { miss = 'cp ' + name; break }
  const pj = join(dst, 'package.json')
  if (existsSync(pj)) {
    try {
      const j = JSON.parse(readFileSync(pj, 'utf8'))
      for (const d of Object.keys(j.optionalDependencies ?? {})) OPTIONAL_ONLY.add(d)
      for (const d of Object.keys(j.dependencies ?? {})) OPTIONAL_ONLY.delete(d)
      for (const d of Object.keys(j.peerDependencies ?? {})) OPTIONAL_ONLY.delete(d)
      for (const key of ['dependencies', 'peerDependencies', 'optionalDependencies']) for (const d of Object.keys(j[key] ?? {})) if (!seen.has(d)) queue.push(d)
    } catch { /* probe reports */ }
  }
}
console.log('BFS done miss=' + (miss ?? 'none') + ' seen=' + seen.size)
const rows = ['src/plugin/live/team-tool-plane.mjs', 'src/plugin/live/plane-effect-backends.mjs', 'src/plugin/live/agent-bindings.mjs', 'src/plugin/host.js']
  .map((r) => join(EXP, 'packages', 'runtime', 'dist', 'packages', 'runtime', r))
let out = ''
for (let a = 0; a < 32; a += 1) {
  const probe = spawnSync(process.execPath, ['-e', `
const rows = ${JSON.stringify(rows.map((r) => pathToFileURL(r).href))}
const missing = []
let hard = null
for (const r of rows) {
  try { await import(r) } catch (e) {
    const m = /Cannot find (?:package|module) '([^']+)'/.exec(String(e?.message ?? e))
    if (m !== null) { const pkg = m[1].startsWith('@') ? m[1].split('/').slice(0, 2).join('/') : m[1].split('/')[0]; if (!missing.includes(pkg)) missing.push(pkg); continue }
    hard = String(e?.message ?? e).slice(0, 300); break
  }
}
if (hard !== null) { console.log('HARD ' + hard); process.exit(2) }
if (missing.length > 0) { console.log('MISSING ' + missing.join(',')); process.exit(3) }
console.log('OK')
`], { encoding: 'utf8', timeout: 120_000 })
  out = `${probe.stdout ?? ''}`.trim()
  if (out.startsWith('OK')) break
  if (!out.startsWith('MISSING')) break
  for (const miss2 of out.slice(8).split(',').filter((s) => s !== '')) {
    const src = findSource(miss2)
    if (src === null) { out = 'NOSRC ' + miss2; break }
    const dst = join(nm, ...miss2.split('/'))
    mkdirSync(dirname(dst), { recursive: true })
    spawnSync('cp', ['-aL', src.dir, dst], { timeout: 120_000 })
  }
}
console.log('probe result: ' + out.slice(0, 240))
