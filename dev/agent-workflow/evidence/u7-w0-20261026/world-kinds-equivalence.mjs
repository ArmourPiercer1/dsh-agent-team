#!/usr/bin/env node
/**
 * u7-w0 offline EQUIVALENCE receipt for the world-kind registry migration.
 *
 * For every World kind (and the plain canary World), drive startHost() of BOTH
 * the pre-u7-w0 factory (origin/master 88107ad71, materialised beside the new
 * one as tests/world-factory/lib/.u7w0-old-world-factory.mjs for the run and
 * deleted after) and the registry-driven factory, and compare:
 *   - the profile patch file bytes (cordis.patch.yml),
 *   - the copied probe row file names in the profile dir,
 *   - the env keys the boot sets (every U5_/U6*_/U7C_ key, values with the
 *     World-specific path segments normalised).
 * ZERO hosts, ZERO port binds: the mock and the host lease are fakes, and the
 * hostTree does not exist, so DshInstance.start's spawn fails with ENOENT before
 * any process exists; the patch file and env are written BEFORE that point.
 *
 * Run (re-materialise the old factory first, delete it after):
 *   git show 88107ad71:tests/world-factory/lib/world-factory.mjs > tests/world-factory/lib/.u7w0-old-world-factory.mjs
 *   node dev/agent-workflow/evidence/u7-w0-20261026/world-kinds-equivalence.mjs
 *   rm tests/world-factory/lib/.u7w0-old-world-factory.mjs
 */
import { mkdtempSync, readFileSync, readdirSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'

const REPO = resolve(import.meta.dirname, '..', '..', '..', '..')
const LIB = join(REPO, 'tests', 'world-factory', 'lib')
const OLD = await import(pathToFileURL(join(LIB, '.u7w0-old-world-factory.mjs')).href)
const NEW = await import(pathToFileURL(join(LIB, 'world-factory.mjs')).href)

const CASES = [
  ['plain', {}],
  ['u6Fs', { u6Fs: { rows: [{ id: 'team', name: '@x/team', config: { a: 1 } }] } }],
  ['u6Proc', { u6Proc: { rows: [{ id: 'team', name: '@x/team' }] } }],
  ['u6Jobs', { u6Jobs: { rows: [{ id: 'team', name: '@x/team', config: { jobsEnabled: true } }] } }],
  ['u6ArcA', { u6ArcA: { rows: [] } }],
  ['u6ArcD', { u6ArcD: { rows: [] } }],
  ['u7Census', { u7Census: { rows: [], autoSnapshotMs: [25000, 45000] } }],
  ['u7FsMut', { u7FsMut: { rows: [{ id: 'team', name: '@x/team' }] } }],
  ['centerShadow', { centerAssembly: 'shadow' }],
]
const ENV_RX = /^(U5_|U6|U7C_)/

async function drive(mod, opts, tag) {
  const root = mkdtempSync(join(tmpdir(), `u7w0-eq-${tag}-`))
  try {
    const factory = new mod.TestWorldFactory({ repoRoot: root, evidenceRoot: join(root, 'ev'), hostTree: join(root, 'no-such-host'), leaseRoot: join(root, 'leases') })
    const world = await factory.createWorld({ line: 'eq', ...opts })
    world.mock = { port: 1, requests: [], close: async () => {} }
    world.hostLease = { port: 3199, note() {}, release() {} }
    for (const k of Object.keys(process.env)) if (ENV_RX.test(k)) delete process.env[k]
    try { await world.startHost({ bootTimeoutMs: 3000 }) } catch { /* spawn ENOENT: expected */ }
    const norm = (v) => String(v).split(world.home).join('<HOME>').split(root).join('<ROOT>').split(world.id).join('<WORLD>').split(REPO).join('<REPO>')
    const env = Object.fromEntries(Object.entries(process.env).filter(([k]) => ENV_RX.test(k)).sort().map(([k, v]) => [k, norm(v)]))
    const patch = norm(readFileSync(world.instance.patchFile, 'utf8'))
    const profileFiles = readdirSync(world.instance.profileDir).filter((n) => n.endsWith('.mjs')).sort()
    return { env, patch, profileFiles }
  } finally {
    rmSync(root, { recursive: true, force: true })
  }
}

let bad = 0
for (const [label, opts] of CASES) {
  const a = await drive(OLD, opts, 'old')
  const b = await drive(NEW, opts, 'new')
  const same = { patch: a.patch === b.patch, env: JSON.stringify(a.env) === JSON.stringify(b.env), profileFiles: JSON.stringify(a.profileFiles) === JSON.stringify(b.profileFiles) }
  const ok = same.patch && same.env && same.profileFiles
  if (!ok) bad += 1
  console.log(`${ok ? 'SAME' : 'DIFF'} ${label.padEnd(13)} patch=${String(same.patch)} env=${String(same.env)}(${String(Object.keys(b.env).length)} keys) probeFiles=${String(same.profileFiles)} [${b.profileFiles.join(',')}]`)
  if (!ok) console.log(JSON.stringify({ old: a, new: b }, null, 1))
}
console.log(bad === 0 ? `EQUIVALENT: ${String(CASES.length)}/${String(CASES.length)} world shapes byte-identical (patch layer, env, mounted files)` : `NOT EQUIVALENT: ${String(bad)} shape(s) differ`)
process.exit(bad === 0 ? 0 : 1)
