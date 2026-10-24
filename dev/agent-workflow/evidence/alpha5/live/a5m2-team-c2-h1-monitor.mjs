#!/usr/bin/env node
/**
 * A5M2 B-TEAM window-1 EXTERNAL watchdog (root's GO, monitor item 1-6).
 * One small file, separate from the driver: it launches the runner in ITS OWN
 * new process group (setsid makes this process the group leader) and samples
 * every 1s. Any breach or monitor error => TERM this group only, <=5s grace,
 * then KILL only still-alive members of THIS group, then keep waiting.
 * Never touches another PGID, never touches 3080, deletes nothing.
 */
import { spawn, spawnSync } from 'node:child_process'
import { appendFileSync, existsSync, mkdirSync, openSync, readFileSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'
import { createConnection } from 'node:net'

const REPO = '/srv/workspace/dsh-plugins/dsh-agent-team/.worktrees/a5m2-wire-team'
const RUNNER = join(REPO, 'dev/agent-workflow/evidence/alpha5/live/a5m2-team-c2-runner.mjs')
const FIXTURE_LOCK = '/srv/workspace/dsh-plugins/dsh-agent-team/tests/homes/a5m2-sched-c2-dry-2026-10-23T22-56-05-203ZZ/install-c8dd3f07b/pnpm-lock.yaml'
const STAMP = process.env.A5M2_H1_STAMP
if (!/^[0-9TZ-]{8,}$/.test(String(STAMP))) { console.error('A5M2_H1_STAMP required'); process.exit(2) }
const HOME_ABS = join(REPO, 'tests/homes', `a5m2-team-c2-h1-${STAMP}`)
const OUT_DIR = join(REPO, 'dev/agent-workflow/evidence/alpha5/live', `a5m2-team-c2-h1-${STAMP}`)
mkdirSync(OUT_DIR, { recursive: true })
const WALL_MS = 300_000
const HOME_CEILING = 67_108_864
const MIN_FREE = 6_442_450_944
const PORTS = [3180, 3497, 3498]
const LOG = join(OUT_DIR, 'monitor.log')
const stampLine = (m) => appendFileSync(LOG, `${new Date().toISOString()} ${m}\n`)
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
const duBytes = (p) => { const r = spawnSync('du', ['-sb', p], { encoding: 'utf8' }); return r.status === 0 ? Number(String(r.stdout).split('\t')[0]) : Number.MAX_SAFE_INTEGER }
const dfAvail = () => { const r = spawnSync('df', ['-B1', '--output=avail', '/'], { encoding: 'utf8' }); return Number(String(r.stdout).split('\n')[1].trim()) }
const pgidOf = (pid) => { const r = spawnSync('ps', ['-o', 'pgid=', '-p', String(pid)], { encoding: 'utf8' }); return Number(String(r.stdout).trim()) }
const portFree = (port) => new Promise((resolve) => { const s = createConnection({ port, host: '127.0.0.1' }); const d = (v) => { s.destroy(); resolve(v) }; s.setTimeout(1500, () => d(false)); s.once('connect', () => d(false)); s.once('timeout', () => d(false)); s.once('error', () => d(true)) })
const members = (pgid) => { const r = spawnSync('ps', ['-o', 'pid=', '-g', String(pgid)], { encoding: 'utf8' }); return String(r.stdout).split('\n').map((v) => v.trim()).filter((v) => /^\d+$/.test(v)).map(Number) }

const facts = { stamp: STAMP, monitorPid: process.pid, monitorPgid: pgidOf(process.pid), homeAbs: HOME_ABS, outDir: OUT_DIR, limits: { WALL_MS, HOME_CEILING, MIN_FREE, PORTS }, samples: [], breaches: [], startedAt: new Date().toISOString() }
if (existsSync(HOME_ABS)) { facts.fatal = `HOME already exists: ${HOME_ABS}`; stampLine(`FATAL ${facts.fatal}`); process.exitCode = 1; process.exit(1) }
const fixtureLockBefore = sha256(FIXTURE_LOCK)
stampLine(`start pid=${String(facts.monitorPid)} pgid=${String(facts.monitorPgid)} home=${HOME_ABS} fixtureLock=${fixtureLockBefore.slice(0, 12)}`)

const out = openSync(join(OUT_DIR, 'runner.out'), 'a')
const err = openSync(join(OUT_DIR, 'runner.err'), 'a')
// detached:true makes the runner its OWN session/group leader via setsid(2)
// (the `setsid` CLI is absent in this environment), so its PGID is NEW and
// DISTINCT from the monitor's, and every kill below addresses ONLY that group.
const child = spawn(process.execPath, [RUNNER, '--live', '--port', '3180', '--run-stamp', STAMP], {
  cwd: REPO, detached: true, stdio: ['ignore', out, err],
  env: { ...process.env, A5M2_TEAM_C2_BOOT_GO: '1' },
})
const childPid = child.pid
const groupPgid = pgidOf(childPid)
facts.child = { pid: childPid, pgid: groupPgid, launchedAt: new Date().toISOString(), distinctFromMonitor: groupPgid === childPid && childPid !== facts.monitorPid && groupPgid !== facts.monitorPgid ? 'NEW group led by the runner itself, distinct from the monitor' : 'CHECK — do not trust the kill scope' }
if (facts.child.distinctFromMonitor.startsWith('CHECK')) { stampLine(`FATAL ${facts.child.distinctFromMonitor}`); process.exitCode = 1; process.exit(1) }
stampLine(`child pid=${String(childPid)} pgid=${String(groupPgid)} (monitor pgid ${String(facts.monitorPgid)})`)

let exitInfo = null
child.once('exit', (code, signal) => { exitInfo = { code, signal, at: new Date().toISOString() }; stampLine(`child exit code=${String(code)} signal=${String(signal)}`) })

const killGroup = async (reason) => {
  facts.breaches.push({ reason, at: new Date().toISOString(), sampledHomeBytes: lastHome, sampledDf: lastDf, elapsedMs: Date.now() - t0 })
  stampLine(`BREACH ${reason} -> TERM -${String(groupPgid)}`)
  try { process.kill(-groupPgid, 'SIGTERM') } catch (error) { stampLine(`TERM failed: ${String(error)}`) }
  const graceEnd = Date.now() + 5_000
  while (Date.now() < graceEnd && members(groupPgid).length > 0) await new Promise((r) => setTimeout(r, 250))
  const alive = members(groupPgid)
  if (alive.length > 0) { stampLine(`KILL only this group members: ${alive.join(',')}`); for (const pid of alive) { try { process.kill(pid, 'SIGKILL') } catch { /* already gone */ } } }
  while (members(groupPgid).length > 0) { stampLine(`waiting for group ${String(groupPgid)}: ${members(groupPgid).join(',')}`); await new Promise((r) => setTimeout(r, 1000)) }
  stampLine(`group ${String(groupPgid)} fully gone`)
}

const t0 = Date.now()
let lastHome = 0
let lastDf = dfAvail()
let verdict = 'ok'
while (exitInfo === null) {
  await new Promise((r) => setTimeout(r, 1000))
  const elapsed = Date.now() - t0
  lastHome = duBytes(HOME_ABS)
  lastDf = dfAvail()
  facts.samples.push({ elapsedMs: elapsed, homeBytes: lastHome, dfAvail: lastDf })
  if (facts.samples.length % 10 === 1) stampLine(`sample elapsed=${String(elapsed)}ms home=${String(lastHome)} df=${String(lastDf)}`)
  try {
    if (elapsed >= WALL_MS) { await killGroup(`WALL ${String(WALL_MS)}ms reached`); verdict = 'fail-wall'; break }
    if (lastHome > HOME_CEILING) { await killGroup(`HOME ${String(lastHome)}B > ${String(HOME_CEILING)}B`); verdict = 'fail-home-ceiling'; break }
    if (lastDf < MIN_FREE) { await killGroup(`df ${String(lastDf)}B < ${String(MIN_FREE)}B`); verdict = 'fail-disk'; break }
  } catch (error) {
    facts.breaches.push({ reason: `monitor error: ${String(error)}`, at: new Date().toISOString() })
    verdict = 'fail-monitor-error'
    try { await killGroup('monitor error') } catch { /* recorded */ }
    break
  }
}

const portsAfter = {}
for (const port of PORTS) portsAfter[String(port)] = await portFree(port)
const locks = existsSync(HOME_ABS) ? spawnSync('bash', ['-c', `ls -la ${HOME_ABS}/*.lock 2>/dev/null; ls -la ${HOME_ABS}.lock 2>/dev/null`], { encoding: 'utf8' }).stdout.trim() : 'HOME absent'
const fixtureLockAfter = sha256(FIXTURE_LOCK)
facts.end = { verdict, exitInfo, elapsedMs: Date.now() - t0, portsAfter, lockState: locks, fixtureLockBefore, fixtureLockAfter, fixtureLockUnchanged: fixtureLockBefore === fixtureLockAfter, finalHomeBytes: duBytes(HOME_ABS), groupMembers: members(groupPgid), endedAt: new Date().toISOString() }
facts.childExitEventAt = exitInfo?.at ?? null
appendFileSync(join(OUT_DIR, 'monitor-facts.json'), `${JSON.stringify(facts, null, 2)}\n`)
stampLine(`end verdict=${verdict} exit=${JSON.stringify(exitInfo)} ports=${JSON.stringify(portsAfter)} fixtureLockUnchanged=${String(facts.end.fixtureLockUnchanged)}`)
process.exitCode = verdict === 'ok' && exitInfo !== null && exitInfo.code === 0 ? 0 : 1
// Root's evidence requirement: the MONITOR's own exit code is captured by real
// observation at exit time (not inferred later), together with the child's exit
// event instant, and written back into monitor-facts.json.
process.on('exit', (code) => {
  try {
    const observed = code === null || code === undefined ? process.exitCode : code
    const patched = { ...facts, monitorExitCode: observed, monitorExitWasPlanned: observed === process.exitCode, monitorExitedAt: new Date().toISOString() }
    writeFileSync(join(OUT_DIR, 'monitor-facts.json'), `${JSON.stringify(patched, null, 2)}\n`)
    appendFileSync(LOG, `monitor own exit code=${String(observed)} at ${patched.monitorExitedAt} (child exit event at ${String(facts.childExitEventAt)})\n`)
  } catch { /* the log line above is the fallback record */ }
})
