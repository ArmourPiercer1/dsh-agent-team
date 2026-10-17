/**
 * probe-clangd-confined — feasibility probe (NOT the acceptance kit):
 * spawn the REAL clangd through the PRODUCTION provider's streaming arm
 * (emitted dist artifacts, launcher self-lock + Landlock) and run the real
 * LSP handshake over the live pipes. Purpose: prove feasibility + discover
 * the exact allow-path set the real server needs BEFORE writing the kit.
 *
 * Run: node dev/agent-workflow/evidence/alpha5/wiring/real-lsp/probe-clangd-confined.mjs
 */
import { createHash } from 'node:crypto'
import { existsSync as require_fs_exists, mkdirSync, readFileSync, writeFileSync, readdirSync, realpathSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = (() => { let d = here; for (;;) { if (require_fs_exists(join(d, 'pnpm-workspace.yaml'))) return d; const up = dirname(d); if (up === d) throw new Error('repo root not found'); d = up } })()
const dist = join(repoRoot, 'packages/runtime/dist/packages/runtime/sandbox-provider')
const { createConfinedProcessProvider } = await import(`file://${join(dist, 'index.js')}`)

const launcherPath = join(repoRoot, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const launcherSha = createHash('sha256').update(readFileSync(launcherPath)).digest('hex')

const world = join(repoRoot, 'tests/homes', `a5reallsp-probeconf-${new Date().toISOString().replace(/[:.]/g, '-')}`)
const genRoot = join(world, 'ws', 'g0')
mkdirSync(genRoot, { recursive: true })
const SRC = `int compute_answer(void) {
  return 42;
}

int main(void) {
  int the_result = compute_answer();
  return the_result;
}
`
const file = join(genRoot, 'main.c')
writeFileSync(file, SRC)

const provider = createConfinedProcessProvider({
  realmId: 'probe-realm',
  trustRoot: 'git:alpha5-real-lsp:sandbox-provider/launcher',
  scratchRoot: world,
  assembly: { launcherPath, launcherSha256: launcherSha, minAbiVersion: 3 },
})
const probe = await provider.probe()
console.log('probe ok', probe.ok, probe.ok ? '' : JSON.stringify(probe.error))

const req = {
  grantFingerprint: 'sha256:probe-clangd',
  realmId: 'probe-realm',
  bindingId: 'binding-probe',
  memberScope: 'member/probe',
  argv: ['/usr/bin/clangd', '--background-index=false', '--pch-storage=memory', '--enable-config=false', '--log=error'],
  cwd: genRoot,
  env: [['PATH', '/usr/bin:/bin'], ['HOME', genRoot], ['XDG_CACHE_HOME', join(genRoot, '.cache')]],
  allowPaths: [
    { path: '/usr', accessBits: { execute: true, readFile: true, readDir: true } },
    { path: genRoot, accessBits: { execute: true, readFile: true, readDir: true, writeFile: true, makeReg: true, truncate: true, removeFile: true } },
  ],
}
const spawned = await provider.spawnStreaming(req, { handshakeTimeoutMs: 20_000 })
console.log('spawnStreaming ok', spawned.ok, spawned.ok ? `pid=${spawned.value.pid}` : JSON.stringify(spawned.error))
if (!spawned.ok) { console.log('WORLD', world); process.exit(1) }
const h = spawned.value
let stderrSeen = ''
h.stderr.on('data', (c) => { stderrSeen += String(c) })

// LSP client over the live confined pipes
let buf = ''
const pending = new Map()
h.stdout.on('data', (c) => {
  buf += c.toString('utf8')
  for (;;) {
    const idx = buf.indexOf('\r\n\r\n')
    if (idx < 0) return
    const m = /Content-Length: (\d+)/i.exec(buf.slice(0, idx))
    if (!m) { buf = buf.slice(idx + 4); continue }
    const len = Number(m[1])
    if (buf.length < idx + 4 + len) return
    const body = buf.slice(idx + 4, idx + 4 + len)
    buf = buf.slice(idx + 4 + len)
    let msg
    try { msg = JSON.parse(body) } catch { continue }
    if (typeof msg.id === 'number' && pending.has(msg.id)) { const r = pending.get(msg.id); pending.delete(msg.id); r(msg) }
    else if (process.env.VERBOSE) console.log('NOTE', body.slice(0, 240))
  }
})
const send = (obj) => { const j = JSON.stringify(obj); h.stdin.write(`Content-Length: ${Buffer.byteLength(j, 'utf8')}\r\n\r\n${j}`) }
const request = (id, method, params) => new Promise((res, rej) => {
  pending.set(id, res); send({ jsonrpc: '2.0', id, method, params })
  setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error(`timeout ${method}`)) } }, 30_000)
})

const uri = `file://${file}`
const init = await request(1, 'initialize', {
  processId: null,
  clientInfo: { name: 'a5reallsp-probe', version: '0' },
  rootUri: `file://${genRoot}`,
  workspaceFolders: [{ uri: `file://${genRoot}`, name: 'w' }],
  capabilities: { textDocument: { definition: { linkSupport: true }, hover: { contentFormat: ['plaintext'] }, completion: {} } },
})
console.log('INIT serverInfo', JSON.stringify(init.result?.serverInfo))
console.log('INIT capability count', Object.keys(init.result?.capabilities ?? {}).length)
send({ jsonrpc: '2.0', method: 'initialized', params: {} })
send({ jsonrpc: '2.0', method: 'textDocument/didOpen', params: { textDocument: { uri, languageId: 'c', version: 1, text: SRC } } })
await new Promise((r) => setTimeout(r, 2000))
const def = await request(2, 'textDocument/definition', { textDocument: { uri }, position: { line: 5, character: 19 } })
console.log('DEFINITION', JSON.stringify(def.result))
await request(3, 'shutdown', null)
send({ jsonrpc: '2.0', method: 'exit', params: {} })
const exitInfo = await Promise.race([h.exited, new Promise((r) => setTimeout(() => r('TIMEOUT'), 8000))])
console.log('EXIT', JSON.stringify(exitInfo))
console.log('pid gone after LSP exit?', readdirSync('/proc').includes(String(h.pid)))
console.log('--- stderr tail\n' + stderrSeen.slice(-1200))
const settled = await h.terminate({ graceMs: 1000, deadlineMs: 6000 })
console.log('terminate settle', settled.ok ? settled.value.status : JSON.stringify(settled.error))
console.log('WORLD', world)
