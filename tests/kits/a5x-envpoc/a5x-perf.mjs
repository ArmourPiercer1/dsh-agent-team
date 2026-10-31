/**
 * a5x-perf.mjs — PoC-PLAN §4 performance axes (PoC banner). Everything measured
 * on THIS host only; no numbers taken from any external writeup.
 * Run: node a5x-perf.mjs <evidence-dir>
 */
import { spawn, spawnSync } from 'node:child_process'
import { mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { join } from 'node:path'

const EV = process.argv[2]
if (!EV) throw new Error('usage: node a5x-perf.mjs <evidence-dir>')
const RG = '/home/armourpiercer/projects/dsh-agent-team/tests/deepseek-harness-test-use/node_modules/.pnpm/@vscode+ripgrep-linux-x64@1.18.0/node_modules/@vscode/ripgrep-linux-x64/bin/rg'
const HERE = import.meta.dirname
const T1000 = join(EV, 'tree1000')
const TBIG = join(EV, 'treebig')
const OUT = {}
const pct = (a, p) => { const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(s.length * p))] }
const stats = (a) => ({ n: a.length, p50: pct(a, 0.5), p95: pct(a, 0.95), p99: pct(a, 0.99), min: Math.min(...a), max: Math.max(...a) })
const ms = (f) => { const t = process.hrtime.bigint(); f(); return Number(process.hrtime.bigint() - t) / 1e6 }

function buildTrees() {
  mkdirSync(T1000, { recursive: true })
  mkdirSync(TBIG, { recursive: true })
  for (let i = 0; i < 1000; i++) writeFileSync(join(T1000, `f${String(i)}.txt`), 'noise '.repeat(400) + (i === 750 ? 'NEEDLE-750\n' : '\n'))
  const chunk = Buffer.alloc(1024 * 1024, 0x61) // 1 MiB of 'a'
  for (let i = 0; i < 200; i++) writeFileSync(join(TBIG, `b${String(i)}.bin.txt`), chunk.toString('latin1') + (i === 199 ? 'NEEDLE-BIG\n' : ''))
}
function bwrapArgv(inner, { net = false } = {}) {
  const a = ['/usr/bin/bwrap', '--ro-bind', '/', '/', '--dev', '/dev', '--proc', '/proc', '--unshare-pid', '--die-with-parent', '--tmpfs', '/tmp']
  if (!net) a.push('--unshare-net')
  a.push('--', ...inner)
  return a
}
function benchSpawn(label, argv, warm = 3, n = 30) {
  for (let i = 0; i < warm; i++) spawnSync(argv[0], argv.slice(1), { encoding: 'buffer' })
  const times = []
  for (let i = 0; i < n; i++) times.push(ms(() => spawnSync(argv[0], argv.slice(1), { encoding: 'buffer' })))
  OUT[label] = stats(times)
}

async function benchGuard() {
  const { makeRestrictedFs } = await import('./a5x-guard.mjs')
  const real = {
    async readText() { return 'x'.repeat(2048) },
    async readByteRange() { return Buffer.alloc(256 * 1024, 1) },
    async stat(p) { return { size: 2048, kind: 'file' } },
    async lstat(p) { return { size: 2048, kind: 'file' } },
    async listDir() { return [] }, async streamText() { return '' }, async writeText() { return {} }, async editText() { return {} },
  }
  const policy = { readRoots: [EV], writeRoots: [EV] }
  const g1 = makeRestrictedFs(real, policy, () => {}, {}) // resolve-guard + recompute (production class)
  const g2 = makeRestrictedFs(real, policy, () => {}, { recomputeAtUseTime: false })
  const t = { rawSmall: [], guardSmall: [], guardNoRecomputeSmall: [], guardNoLedgerSmall: [] }
  const targetKey = EV, displayPath = join(EV, 'tree1000', 'f0.txt')
  for (let i = 0; i < 300; i++) {
    t.rawSmall.push(await timed(() => real.readText({ targetKey, displayPath })))
    t.guardSmall.push(await timed(() => g1.readText({ targetKey, displayPath })))
    t.guardNoRecomputeSmall.push(await timed(() => g2.readText({ targetKey, displayPath })))
  }
  const g3 = makeRestrictedFs(real, policy, () => {}, { resolveGuard: false }) // identity-trust class
  for (let i = 0; i < 300; i++) t.guardNoLedgerSmall.push(await timed(() => g3.readText({ targetKey, displayPath })))
  const tBig = { raw: [], guard: [] }
  for (let i = 0; i < 30; i++) {
    tBig.raw.push(await timed(() => real.readByteRange({ targetKey, displayPath }, 1024 * 1024 * 8, 256 * 1024)))
    tBig.guard.push(await timed(() => g1.readByteRange({ targetKey, displayPath }, 1024 * 1024 * 8, 256 * 1024)))
  }
  OUT['axis-policy-check-small-read'] = { raw: stats(t.rawSmall), guarded: stats(t.guardSmall), guardedNoRecompute: stats(t.guardNoRecomputeSmall), guardedNoLedger: stats(t.guardNoLedgerSmall) }
  OUT['axis-policy-check-8MiB-offset-read'] = { raw: stats(tBig.raw), guarded: stats(tBig.guard) }
}
async function timed(f) { const t = process.hrtime.bigint(); await f(); return Number(process.hrtime.bigint() - t) / 1e6 }

async function benchToolHost() {
  const RUNNER = `
const rl = require('readline').createInterface({ input: process.stdin })
rl.on('line', async (l) => {
  const r = JSON.parse(l)
  const fs = require('fs')
  let out, err
  try { out = fs.readFileSync(r.path, 'utf8').slice(0, 64) } catch (e) { err = String(e.code ?? e) }
  process.stdout.write(JSON.stringify({ id: r.id, out, err }) + '\\n')
})`
  const file = join(EV, 'ipc-target.txt')
  writeFileSync(file, 'IPC-OK')
  const argv = bwrapArgv(['node', '-e', RUNNER])
  // warm per-call RTT through one persistent confined child
  const warm = await new Promise((resolve) => {
    const p = spawn(argv[0], argv.slice(1), { stdio: ['pipe', 'pipe', 'ignore'] })
    const times = []
    let t0 = 0n, buf = ''
    p.stdout.on('data', (d) => {
      buf += String(d)
      let i
      while ((i = buf.indexOf('\n')) >= 0) {
        buf = buf.slice(0, i)
        times.push(Number(process.hrtime.bigint() - t0) / 1e6)
        if (times.length >= 100) { p.kill(); resolve(times); return }
        t0 = process.hrtime.bigint()
        p.stdin.write(JSON.stringify({ id: times.length, path: file }) + '\n')
      }
    })
    t0 = process.hrtime.bigint()
    p.stdin.write(JSON.stringify({ id: 0, path: file }) + '\n')
  })
  OUT['axis-ipc-warm-confined-toolhost-rtt'] = stats(warm)
  // cold tool-host: fresh confined child per call
  const cold = []
  for (let i = 0; i < 25; i++) {
    cold.push(await new Promise((resolve) => {
      const t = Date.now()
      const p = spawn(argv[0], argv.slice(1), { stdio: ['pipe', 'pipe', 'ignore'] })
      let buf = ''
      p.stdout.on('data', (d) => {
        buf += String(d)
        if (buf.includes('\n')) { p.kill(); resolve(Date.now() - t) }
      })
      p.stdin.write(JSON.stringify({ id: 1, path: file }) + '\n')
    }))
  }
  OUT['axis-toolhost-startup-cold-confined-child'] = stats(cold)
}
function benchHostBoot() {
  // host cold/warm boot measured separately by the kit runner; here we only
  // time `node -e '1'` under bwrap as the floor for tool-host startup.
  const a = bwrapArgv(['node', '-e', '1'])
  benchSpawn('floor-bwrap-node-eval', a, 3, 25)
}

async function main() {
  mkdirSync(EV, { recursive: true })
  buildTrees()
  benchSpawn('axis-bwrap-setup-noop', bwrapArgv(['/bin/true']), 5, 50)
  benchSpawn('axis-tool-process-rg-1000files-direct', [RG, 'NEEDLE-750', T1000])
  benchSpawn('axis-tool-process-rg-1000files-bwrap', bwrapArgv([RG, 'NEEDLE-750', T1000]))
  benchSpawn('axis-tool-process-rg-big200MiB-direct', [RG, 'NEEDLE-BIG', TBIG], 2, 10)
  benchSpawn('axis-tool-process-rg-big200MiB-bwrap', bwrapArgv([RG, 'NEEDLE-BIG', TBIG]), 2, 10)
  benchHostBoot()
  await benchGuard()
  await benchToolHost()
  OUT.disclosures = {
    coldCache: 'page-cache drop needs root; cold legs here = fresh spawn with untouched working set only',
    bigTree: 'planned 1 GB/1000-file tree reduced to 200 MiB/200 files (in-workspace evidence budget); disclosed',
    baselineRg: 'rg binary = @vscode/ripgrep-linux-x64@1.18.0 as installed by the pinned pristine runtime',
  }
  writeFileSync(join(EV, 'perf.json'), JSON.stringify(OUT, null, 2))
  console.log(JSON.stringify(Object.fromEntries(Object.entries(OUT).map(([k, v]) => [k, v.p50 !== undefined ? `p50=${v.p50}ms p95=${v.p95}ms` : (v.guarded ? `raw p50=${v.raw.p50} guarded p50=${v.guarded.p50}` : '—')]))))
}
main().catch((e) => { console.error('FATAL', e.stack ?? String(e)); process.exit(1) })
