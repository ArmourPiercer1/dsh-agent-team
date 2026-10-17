/**
 * probe-tsserver-confined — feasibility probe #2 (candidate face discovery):
 * the REAL typescript tsserver through the PRODUCTION confined streaming arm.
 * tsserver speaks the TypeScript stdio JSON protocol (Content-Length framed
 * output, line-JSON or framed input) — NOT the LSP framing; this probe
 * records exactly what the official face answers so the kit states the truth.
 *
 * Run: node dev/agent-workflow/evidence/alpha5/wiring/real-lsp/probe-tsserver-confined.mjs
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync, readdirSync, realpathSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
const repoRoot = (() => { let d = here; for (;;) { if (existsSync(join(d, 'pnpm-workspace.yaml'))) return d; const up = dirname(d); if (up === d) throw new Error('no root'); d = up } })()
const dist = join(repoRoot, 'packages/runtime/dist/packages/runtime/sandbox-provider')
const { createConfinedProcessProvider } = await import(`file://${join(dist, 'index.js')}`)

const launcherPath = join(repoRoot, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const launcherSha = createHash('sha256').update(readFileSync(launcherPath)).digest('hex')
const TS_ROOT = '/srv/workspace/dsh-plugins/dsh-agent-team/node_modules/typescript'
console.log('typescript version', JSON.parse(readFileSync(join(TS_ROOT, 'package.json'), 'utf8')).version)
const nodeBin = process.execPath

const world = join(repoRoot, 'tests/homes', `a5reallsp-probets-${new Date().toISOString().replace(/[:.]/g, '-')}`)
const genRoot = join(world, 'ws', 'g0')
mkdirSync(genRoot, { recursive: true })
const SRC = `export function computeAnswer(): number {\n  return 42;\n}\n\nconst theResult: number = computeAnswer();\nconsole.log(theResult);\n`
const file = join(genRoot, 'main.ts')
writeFileSync(file, SRC)
writeFileSync(join(genRoot, 'tsconfig.json'), JSON.stringify({ compilerOptions: { strict: true, target: 'ES2022' }, include: ['*.ts'] }, null, 2))

const provider = createConfinedProcessProvider({
  realmId: 'probe-ts-realm',
  trustRoot: 'git:alpha5-real-lsp:sandbox-provider/launcher',
  scratchRoot: world,
  assembly: { launcherPath, launcherSha256: launcherSha, minAbiVersion: 3 },
})
console.log('probe ok', (await provider.probe()).ok)
const req = {
  grantFingerprint: 'sha256:probe-tsserver',
  realmId: 'probe-ts-realm',
  bindingId: 'binding-probe-ts',
  memberScope: 'member/probe-ts',
  argv: [nodeBin, join(TS_ROOT, 'lib', 'tsserver.js'), '--serverMode', 'semantic', '--disableAutomaticTypingAcquisition', '--useSingleInferredProject'],
  cwd: genRoot,
  env: [['PATH', '/usr/bin:/bin'], ['HOME', genRoot], ['TSS_DEBUG', '']],
  allowPaths: [
    { path: dirname(realpathSync(nodeBin)), accessBits: { execute: true, readFile: true, readDir: true } },
    { path: realpathSync(TS_ROOT), accessBits: { readFile: true, readDir: true } },
    { path: genRoot, accessBits: { readFile: true, readDir: true, writeFile: true, makeReg: true, truncate: true, removeFile: true } },
  ],
}
const spawned = await provider.spawnStreaming(req, { handshakeTimeoutMs: 20_000 })
console.log('spawnStreaming ok', spawned.ok, spawned.ok ? `pid=${spawned.value.pid}` : JSON.stringify(spawned.error))
if (!spawned.ok) process.exit(1)
const h = spawned.value
let err = ''
h.stderr.on('data', (c) => { err += String(c) })
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
    if (typeof msg.request_seq === 'number' && pending.has(msg.request_seq)) { const r = pending.get(msg.request_seq); pending.delete(msg.request_seq); r(msg) }
    else if (process.env.VERBOSE) console.log('EV', body.slice(0, 200))
  }
})
let seq = 0
const request = (command, arguments_) => new Promise((res, rej) => {
  const id = ++seq
  pending.set(id, res)
  h.stdin.write(JSON.stringify({ seq: id, type: 'request', command, arguments: arguments_ ?? {} }) + '\n')
  setTimeout(() => { if (pending.has(id)) { pending.delete(id); rej(new Error(`timeout ${command}`)) } }, 30_000)
})
console.log('STATUS', JSON.stringify(await request('status')))
console.log('CONFIGURE', JSON.stringify(await request('configure', { hostInfo: 'a5reallsp-probe', formatOptions: {}, preferences: {} })).slice(0, 200))
console.log('OPEN', JSON.stringify(await request('open', { file, fileContent: SRC, scriptKindName: 'TS' })).slice(0, 200))
await new Promise((r) => setTimeout(r, 2000))
console.log('PROJECTINFO', JSON.stringify(await request('projectInfo', { file, needFileNameList: true })).slice(0, 400))
const callIdx = SRC.lastIndexOf('computeAnswer')
const line = SRC.slice(0, callIdx).split('\n').length
const offset = callIdx - (SRC.lastIndexOf('\n', callIdx - 1) + 1) + 1
console.log('DEFINITION', JSON.stringify((await request('definition', { file, line, offset })).body))
const comp = await request('completionInfo', { file, line: 6, offset: 1, kind: 'explicit', includeExternalModuleExports: false, includeInsertTextCompletions: false, triggerKind: 1 })
const items = comp.body?.entries ?? []
console.log('COMPLETION count', items.length, 'first5', JSON.stringify(items.slice(0, 5).map((i) => i.name)))
console.log('EXIT-cmd', JSON.stringify(await request('exit').catch((e) => ({ note: String(e.message) }))))
const exitInfo = await Promise.race([h.exited, new Promise((r) => setTimeout(() => r('TIMEOUT'), 8000))])
console.log('EXIT', JSON.stringify(exitInfo), 'pid gone?', !readdirSync('/proc').includes(String(h.pid)))
console.log('--- stderr tail\n' + err.slice(-600))
console.log('terminate', JSON.stringify((await h.terminate({ graceMs: 1000, deadlineMs: 6000 })).value?.status ?? 'refused'))
console.log('WORLD', world)
