/**
 * pl-lsp-smoke-dist — installed-smoke for the P-LSP lane: imports the EMITTED
 * dist artifacts (not sources) and proves (1) the old face keys are exactly
 * the historical set PLUS the parallel-additive streaming entries, (2) a REAL
 * confined streaming round-trip runs through the COMPILED assembly + provider
 * (Landlock launcher, fixture server, ping, dispose, pid gone).
 * Run: node dev/agent-workflow/evidence/alpha5/prod/pl-lsp-smoke-dist.mjs
 */
import { createHash } from 'node:crypto'
import { copyFileSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = resolve(here, '../../../..','..')
const dist = join(repoRoot, 'packages/runtime/dist/packages/runtime/sandbox-provider')
const { createConfinedProcessProvider, createLspRealmAssembly } = await import(dist === undefined ? '' : `file://${join(dist, 'index.js')}`)

const results = []
const check = (name, ok, detail = '') => { results.push({ name, ok: Boolean(ok), detail }); console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ' — ' + detail : ''}`) }

const provider = createConfinedProcessProvider({
  realmId: 'smoke-realm',
  trustRoot: 'git:alpha5-prod-lsp:sandbox-provider/launcher',
  scratchRoot: repoRoot,
})
const keys = Object.keys(provider).sort()
const historical = ['execute', 'prepare', 'probe', 'requestCancellation', 'settleTermination', 'spawn']
check('face ⊇ historical (byte-untouched old API surface)', historical.every((k) => keys.includes(k)), keys.join(','))
check('face += spawnStreaming/executeStreaming (parallel-additive)', keys.includes('spawnStreaming') && keys.includes('executeStreaming'))

const launcherPath = join(repoRoot, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const launcherSha = createHash('sha256').update(readFileSync(launcherPath)).digest('hex')
const world = join(repoRoot, 'tests/homes', `a5lsp2-smoke-${new Date().toISOString().replace(/[:.]/g, '-')}`)
mkdirSync(world, { recursive: true })
const fixtureSrc = join(repoRoot, 'packages/runtime/test/a5lsp2-fixture-ping.mjs')
const fixtureDir = join(world, 'fixtures')
mkdirSync(fixtureDir, { recursive: true })
copyFileSync(fixtureSrc, join(fixtureDir, 'ping.mjs'))
const nodeBin = (globalThis.process?.execPath ?? '/usr/bin/node')
const nodeDir = dirname(realpathSync(nodeBin))
const assembly = createLspRealmAssembly({
  assembly: { launcherPath, launcherSha256: launcherSha, minAbiVersion: 3 },
  trustRoot: 'git:alpha5-prod-lsp:sandbox-provider/launcher',
  scratchRoot: world,
  readyTimeoutMs: 15_000,
  policyFor: (member, generation) => {
    const genRoot = join(world, 'ws', `${member}-${generation}`)
    mkdirSync(genRoot, { recursive: true })
    return {
      grantFingerprint: `sha256:smoke-${member}-${generation}`,
      bindingId: 'binding-smoke',
      argv: [nodeBin, join(fixtureDir, 'ping.mjs'), generation],
      cwd: genRoot,
      env: [['PATH', '/usr/bin:/bin']],
      allowPaths: [
        { path: nodeDir, accessBits: { execute: true, readFile: true, readDir: true } },
        { path: fixtureDir, accessBits: { readFile: true, readDir: true } },
        { path: genRoot, accessBits: { readFile: true, readDir: true } },
      ],
    }
  },
})
let exitCode = 0
try {
  const first = await assembly.ensure('smoke', 'g0')
  check('compiled assembly ensure(g0)', first.ok === true, first.ok ? `pid=${first.value.pid}` : JSON.stringify(first.error))
  if (first.ok) {
    const pid0 = first.value.pid
    const answered = await new Promise((resolve2) => {
      let buf = ''
      const onData = (c) => { buf += String(c); resolve2(buf.includes('"pong":1')) ; first.value.handle.stdout.off('data', onData) }
      first.value.handle.stdout.on('data', onData)
      first.value.handle.stdin.write('{"ping":1}\n')
      setTimeout(() => resolve2(false), 10_000)
    })
    check('compiled streaming ping round-trip', answered)
    const changed = await assembly.policyChange('smoke', 'g1')
    check('compiled policyChange g0→g1 (new pid)', changed.ok === true && changed.value.pid !== pid0, changed.ok ? `old=${pid0} new=${changed.value.pid}` : JSON.stringify(changed.error))
    const aliveOld = readdirSync('/proc').includes(String(pid0))
    check('old pid OS-gone after policyChange', !aliveOld)
    const gone = changed.ok ? changed.value : null
    if (gone) {
      const aliveNew = readdirSync('/proc').includes(String(gone.pid))
      check('new instance live', aliveNew)
    }
  }
  const all = await assembly.disposeAll()
  check('compiled disposeAll net-zero', all.ok === true && assembly.size() === 0, JSON.stringify(all.ok ? all.value.disposed : all.error))
} finally {
  rmSync(world, { recursive: true, force: true })
  const failed = results.filter((r) => !r.ok)
  console.log(`SMOKE: ${results.length - failed.length}/${results.length} PASS`)
  exitCode = failed.length === 0 ? 0 : 1
}
process.exit(exitCode)
