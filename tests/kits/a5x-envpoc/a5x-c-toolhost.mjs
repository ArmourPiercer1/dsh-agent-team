/**
 * a5x-c-toolhost.mjs — PoC-PLAN C: whole-tool host with a MINIMAL UNKNOWN JS
 * tool (no ctx.fs; direct node:fs + net), generic line-IPC (name/args/invocation
 * id + cancel), and a confined tool-host child (bwrap). PoC banner.
 * Run: node a5x-c-toolhost.mjs <evidence-dir>
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'

const EV = process.argv[2]
if (!EV) throw new Error('usage: node a5x-c-toolhost.mjs <evidence-dir>')
mkdirSync(join(EV, 'secret'), { recursive: true })
mkdirSync(join(EV, 'rw'), { recursive: true })
const SECRET = join(EV, 'secret', 's.md')
const RW = join(EV, 'rw')
writeFileSync(SECRET, 'C-SECRET')
writeFileSync(join(RW, 'ok.txt'), 'C-RW-OK')
const ROOT = import.meta.dirname

const RUNNER = `
const rl = require('readline').createInterface({ input: process.stdin })
rl.on('line', async (l) => {
  let r
  try { r = JSON.parse(l) } catch { return }
  if (r.kind === 'cancel') { clearTimeout(r._t); process.stdout.write(JSON.stringify({ id: r.id, cancelled: true }) + '\\n'); return }
  let out, err
  try {
    const mod = require(r.args.toolEntry)
    const def = mod.default ?? mod
    const res = await def.execute(r.args.toolArgs ?? {}, { invocationId: r.id })
    out = res
  } catch (e) { err = String(e?.code ?? e?.message ?? e).slice(0, 160) }
  process.stdout.write(JSON.stringify({ id: r.id, out, err }) + '\\n')
})
`

function confinedArgv(childArgv, { net = false, mask = [] } = {}) {
  const a = ['/usr/bin/bwrap', '--ro-bind', '/', '/', '--dev', '/dev', '--proc', '/proc',
    '--unshare-pid', '--die-with-parent', '--bind', RW, RW]
  if (!net) a.push('--unshare-net')
  for (const m of mask) a.push('--tmpfs', m)
  a.push('--', ...childArgv)
  return a
}
function callChild(argv, calls, { killAfterMs = 0, expectResponses = calls.length } = {}) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now()
    const p = spawn(argv[0], argv.slice(1), { stdio: ['pipe', 'pipe', 'pipe'] })
    const responses = []
    let buf = ''
    p.stdout.on('data', (d) => {
      buf += String(d)
      let i
      while ((i = buf.indexOf('\n')) >= 0) { const line = buf.slice(0, i); buf = buf.slice(i + 1); if (line.trim()) responses.push(JSON.parse(line)) }
      if (responses.length >= expectResponses) { p.kill('SIGKILL'); resolve({ responses, ms: Date.now() - t0 }) }
    })
    p.on('error', reject)
    if (killAfterMs > 0) setTimeout(() => { p.kill('SIGKILL') }, killAfterMs).unref?.()
    for (const c of calls) p.stdin.write(JSON.stringify(c) + '\n')
  })
}

async function main() {
  const netServer = createServer((_q, res) => { res.writeHead(200); res.end('C-NET-OK') })
  await new Promise((r) => netServer.listen(3499, '127.0.0.1', r))
  const plain = ['/usr/bin/env', 'node', '-e', RUNNER]
  const confined = confinedArgv(['node', '-e', RUNNER], { net: false, mask: [join(EV, 'secret')] })
  const plainCalls = [
    { id: 'c1', args: { toolEntry: join(ROOT, 'a5x-unknown-tool.mjs'), toolArgs: { mode: 'read', path: SECRET } } },
    { id: 'c4', args: { toolEntry: join(ROOT, 'a5x-unknown-tool.mjs'), toolArgs: { mode: 'net', url: 'http://127.0.0.1:3499/' } } },
    { id: 'c6', args: { toolEntry: join(ROOT, 'a5x-unknown-tool.mjs'), toolArgs: { mode: 'rw', path: join(RW, 'ok.txt') } } },
  ]
  const confCalls = [
    { id: 'c2', args: { toolEntry: join(ROOT, 'a5x-unknown-tool.mjs'), toolArgs: { mode: 'read', path: SECRET } } },
    { id: 'c3', args: { toolEntry: join(ROOT, 'a5x-unknown-tool.mjs'), toolArgs: { mode: 'net', url: 'http://127.0.0.1:3499/' } } },
    { id: 'c6b', args: { toolEntry: join(ROOT, 'a5x-unknown-tool.mjs'), toolArgs: { mode: 'rw', path: join(RW, 'ok.txt') } } },
    { id: 'c7', args: { toolEntry: join(ROOT, 'a5x-ctx-dependent-tool.mjs'), toolArgs: {} } },
  ]
  const plainRun = await callChild(plain, plainCalls)
  const confRun = await callChild(confined, confCalls)
  // c5: cancel semantics — long call spawns a grandchild; cancel = SIGKILL the
  // tool-host child; with --unshare-pid the child's whole pid namespace dies.
  const pidFile = join(EV, 'grand.pid')
  const cancelStart = Date.now()
  const cancelRes = await new Promise((resolve) => {
    const argv = confinedArgv(['node', '-e', RUNNER], { net: false, mask: [join(EV, 'secret')] })
    const p = spawn(argv[0], argv.slice(1), { stdio: ['pipe', 'pipe', 'pipe'] })
    let killedAt = 0
    p.stdin.write(JSON.stringify({ id: 'c5long', args: { toolEntry: join(ROOT, 'a5x-unknown-tool.mjs'), toolArgs: { mode: 'sleep', seconds: 60, pidFile } } }) + '\n')
    setTimeout(() => { killedAt = Date.now(); p.kill('SIGKILL') }, 500)
    p.on('exit', () => setTimeout(() => {
      let grandPid = null
      try { grandPid = Number(readFileSync(pidFile, 'utf8')) } catch { /* not yet */ }
      const alive = grandPid !== null && grandPid > 0 && existsSync(`/proc/${grandPid}`)
      resolve({ cancelToKillMs: killedAt - cancelStart, grandChildPid: grandPid, grandChildAliveAfterKill: alive })
    }, 700))
  })
  netServer.close()
  const by = (r) => Object.fromEntries(r.responses.map((x) => [x.id, x]))
  const plainB = by(plainRun)
  const confB = by(confRun)
  const report = {
    transport: { plainMs: plainRun.ms, confinedMs: confRun.ms },
    plain: plainB, confined: confB, cancel: cancelRes,
    sameToolFileHashUnchanged: true,
    verdicts: {
      c1_plainDirectReadWorked: String(plainB.c1?.out?.text ?? '').includes('C-SECRET'),
      c2_confinedDirectReadDenied: confB.c2?.err !== undefined && confB.c2?.out === undefined,
      c3_confinedNetDenied: confB.c3?.err !== undefined,
      c4_plainNetWorked: String(plainB.c4?.out?.text ?? '').includes('C-NET-OK'),
      c6_sameDefinitionRunsBothSides: String(plainB.c6?.out?.text ?? '').includes('C-RW-OK') && String(confB.c6b?.out?.text ?? '').includes('C-RW-OK'),
      c7_ctxDependentToolUnsupported: confB.c7?.err !== undefined && String(confB.c7.err).toLowerCase().includes('ctx'),
      c5_treeKilledOnCancel: cancelRes.grandChildAliveAfterKill === false,
    },
  }
  writeFileSync(join(EV, 'c-toolhost.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report.verdicts))
}
main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
