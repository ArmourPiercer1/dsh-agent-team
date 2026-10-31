/**
 * a5x-b3.mjs — PoC-PLAN B3 OS-testable subset (PoC banner): authority grants
 * are NEW confined domains; an existing confined domain never widens.
 * (Alpha.4 admission plane: one-shot grants UI, HMR policy swap, kill/drain →
 * NOT_TESTED(ENV); reason recorded in POC-RESULTS.md.)
 * Run: node a5x-b3.mjs <evidence-dir>
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const EV = process.argv[2]
if (!EV) throw new Error('usage: node a5x-b3.mjs <evidence-dir>')
const RA = join(EV, 'rootA')
const RB = join(EV, 'rootB')
mkdirSync(RA, { recursive: true })
mkdirSync(RB, { recursive: true })
const RUNNER = `
const rl = require('readline').createInterface({ input: process.stdin })
rl.on('line', async (l) => {
  const r = JSON.parse(l)
  const fs = require('fs')
  let out, err
  try { fs.writeFileSync(r.path, r.data ?? 'written'); out = 'wrote:' + r.path } catch (e) { err = String(e.code ?? e.message ?? e).slice(0, 120) }
  process.stdout.write(JSON.stringify({ id: r.id, out, err }) + '\\n')
})`
function confined(rwRoots) {
  const a = ['/usr/bin/bwrap', '--ro-bind', '/', '/', '--dev', '/dev', '--proc', '/proc', '--unshare-pid', '--unshare-net', '--die-with-parent', '--tmpfs', '/tmp']
  for (const r of rwRoots) a.push('--bind', r, r)
  a.push('--', 'node', '-e', RUNNER)
  return a
}
function oneCall(argv, call, ms = 8000) {
  return new Promise((resolve) => {
    const p = spawn(argv[0], argv.slice(1), { stdio: ['pipe', 'pipe', 'ignore'] })
    let buf = ''
    const to = setTimeout(() => { p.kill(); resolve({ timeout: true }) }, ms)
    p.stdout.on('data', (d) => {
      buf += String(d)
      const nl = buf.indexOf('\n')
      if (nl >= 0) { clearTimeout(to); p.kill(); resolve(JSON.parse(buf.slice(0, nl))) }
    })
    p.stdin.write(JSON.stringify(call) + '\n')
  })
}

async function main() {
  const persistent = spawn(confined([RA])[0], confined([RA]).slice(1), { stdio: ['pipe', 'pipe', 'ignore'] })
  let buf = ''
  const lines = []
  persistent.stdout.on('data', (d) => { buf += String(d); let i; while ((i = buf.indexOf('\n')) >= 0) { lines.push(JSON.parse(buf.slice(0, i))); buf = buf.slice(i + 1) } })
  const write = (id, path) => new Promise((r) => { const n = lines.length; const iv = setInterval(() => { if (lines.length > n) { clearInterval(iv); r(lines[lines.length - 1]) } }, 50); setTimeout(() => { clearInterval(iv); r({ timeout: true }) }, 6000)
    persistent.stdin.write(JSON.stringify({ id, path, data: 'from-persistent' }) + '\n') })
  // 1. persistent domain (rw=RA only): own root OK
  const pOwn = await write('p1', join(RA, 'own.txt'))
  // 2. persistent domain writes RB: must fail (domain is what it is)
  const pCross = await write('p2', join(RB, 'via-persistent.txt'))
  // 3. NEW grant = new confined domain (rw=RA+RB): writes RB OK
  const newDomain = await oneCall(confined([RA, RB]), { id: 'n1', path: join(RB, 'via-new.txt'), data: 'from-new-domain' })
  // 4. pre-existing persistent domain STILL cannot write RB afterwards (no widening)
  const pCrossAgain = await write('p3', join(RB, 'via-persistent2.txt'))
  persistent.kill()
  const report = {
    persistentOwnRoot: pOwn,
    persistentCrossBefore: pCross,
    newDomainWrite: newDomain,
    persistentCrossAfter: pCrossAgain,
    verdicts: {
      ownRootOk: String(pOwn.out ?? '').startsWith('wrote:'),
      crossRefusedInPersistent: pCross.err !== undefined,
      newDomainWiderGrantOk: String(newDomain.out ?? '').startsWith('wrote:'),
      existingDomainNeverWidened: pCrossAgain.err !== undefined && existsSync(join(RB, 'via-new.txt')) === true,
    },
  }
  writeFileSync(join(EV, 'b3-os.json'), JSON.stringify(report, null, 2))
  console.log(JSON.stringify(report.verdicts))
}
main().catch((e) => { console.error('FATAL', e.stack ?? String(e)); process.exit(1) })
