/**
 * a5x-planb-spike.mjs — minimal out-of-process boundary spike (PoC banner).
 *
 * Question: the wave-11 measurement shows Plan A (provider seam) cannot stop a
 * tool BODY that uses node:fs directly (a5x_evil read the secret in-process).
 * Plan B shape = the native tool runtime is HOSTED IN a restricted child
 * process behind a generic name/args/result transport (explicitly allowed by
 * A5-NATIVE-02: the transport is generic, no business logic is re-implemented).
 * This spike measures the boundary property, not the full architecture:
 *   1. generic line-JSON IPC round trip through spawn (transport viability);
 *   2. inside a bwrap-confined child (ro-bind / + tmpfs masking the secret
 *      dir): the SAME node:fs direct read that bypassed Plan A must fail;
 *   3. the in-scope read must still succeed (non-regression through IPC).
 *
 * Honest scope note: this proves the OS boundary closes what the provider seam
 * cannot; production Plan B additionally needs the real ToolRuntime, signals,
 * streaming, and output contract carried over the transport — not measured here.
 *
 * Usage: node a5x-planb-spike.mjs <rootA> <secretFile> <out.json>
 */
import { spawn } from 'node:child_process'
import { writeFileSync } from 'node:fs'

const [, , ROOT_A, SECRET, OUT] = process.argv
if (!ROOT_A || !SECRET || !OUT) throw new Error('args: <rootA> <secretFile> <out.json>')

const CHILD = `
const rl = require('readline').createInterface({ input: process.stdin })
rl.on('line', (l) => {
  let r
  try { r = JSON.parse(l) } catch { return }
  let out
  try { out = { ok: true, text: require('fs').readFileSync(r.args.path, 'utf8').slice(0, 60) } }
  catch (e) { out = { ok: false, err: String(e.code ?? e.message).slice(0, 80) } }
  process.stdout.write(JSON.stringify({ id: r.id, out }) + '\\n')
})
`

function confineArgv(childArgv, rootA) {
  // read scoping the host dialect lacks: whole tree ro, the secret dir hidden.
  const secretDir = SECRET.slice(0, SECRET.lastIndexOf('/'))
  return ['/usr/bin/bwrap', '--ro-bind', '/', '/', '--dev', '/dev', '--proc', '/proc',
    '--unshare-pid', '--die-with-parent', '--tmpfs', secretDir,
    '--bind', rootA, rootA, '--', ...childArgv]
}

function roundTrip(argv, calls) {
  return new Promise((resolve, reject) => {
    const t0 = Date.now()
    const p = spawn(argv[0], argv.slice(1), { stdio: ['pipe', 'pipe', 'pipe'] })
    const results = []
    let buf = ''
    p.stdout.on('data', (d) => {
      buf += String(d)
      let i
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i); buf = buf.slice(i + 1)
        if (line.trim() !== '') results.push(JSON.parse(line))
        if (results.length === calls.length) resolve({ results, ms: Date.now() - t0 })
      }
    })
    let err = ''
    p.stderr.on('data', (d) => { err += String(d) })
    p.on('error', reject)
    p.on('close', (code) => { if (results.length < calls.length) reject(new Error(`child exit ${code}: ${err.slice(0, 200)}`)) })
    for (const c of calls) p.stdin.write(JSON.stringify(c) + '\n')
  })
}

const main = async () => {
  const plain = ['/usr/bin/env', 'node', '-e', CHILD]
  const confined = confineArgv(['node', '-e', CHILD], ROOT_A)
  const calls = [
    { id: 'p1', args: { path: `${ROOT_A}/inside.md` } },
    { id: 'p2', args: { path: SECRET } },
  ]
  const plainRun = await roundTrip(plain, calls)
  const confinedRun = await roundTrip(confined, calls)
  const by = (r) => Object.fromEntries(r.results.map((x) => [x.id, x.out]))
  const report = {
    transport: { plainRoundTripMs: plainRun.ms, confinedRoundTripMs: confinedRun.ms, calls: calls.length },
    plainChild: by(plainRun),
    confinedChild: by(confinedRun),
    verdicts: {
      ipcRoundTripViable: plainRun.ms < 5000,
      evilReadDeniedUnderOsBoundary: by(confinedRun).p2?.ok !== true,
      inScopeStillWorks: by(confinedRun).p1?.ok === true && String(by(confinedRun).p1?.text ?? '').includes('INSIDE-OK'),
      plainChildProvesBypass: by(plainRun).p2?.ok === true,
    },
  }
  writeFileSync(OUT, JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report.verdicts))
}

main().catch((e) => { console.error('FATAL', e.message); process.exit(1) })
