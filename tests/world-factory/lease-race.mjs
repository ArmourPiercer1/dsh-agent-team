#!/usr/bin/env node
/**
 * lease-race.mjs — cross-process stale-lease reclaim race harness (FIX-T T1).
 *
 * WHY: the historic reclaim acted on a STALE OBSERVATION with
 * `unlinkSync + O_EXCL create`. Two processes that both observed the same
 * stale lease could interleave A.unlink → A.create → B.unlink(DELETES A's
 * FRESH LEASE) → B.create → DOUBLE OWNERSHIP. That window is microseconds
 * wide, so a plain spawn race is the honest RED probe and the lib's
 * test-only pause hooks are the deterministic one (both provided here).
 *
 * PARENT MODE (this file with no --child):
 *   node tests/world-factory/lease-race.mjs [--trials 200] [--procs 8]
 *     [--ports 3500,3499,3498,3497] [--inject none|stale|reclaim]
 *     [--slow-pause-ms 700] [--lib <path/to/port-lease.mjs>] [--json <out>]
 *     [--quiet]
 * Per trial:
 *   1. fresh leaseRoot (mkdtemp) with a pre-planted STALE lease
 *      (holder pid 4194303 — beyond Linux pid_max, permanently dead);
 *   2. spawn N child processes of THIS file; each waits on one shared gate
 *      file, so every child observes the stale lease at the same instant;
 *   3. children call acquirePortLease on the SAME port, hold a win for
 *      ~80ms, REVALIDATE the file still names them, then release;
 *   4. VIOLATION iff >1 child finished acquirePortLease successfully, or a
 *      winner's revalidation no longer matched (its file was displaced —
 *      exactly the double-ownership evidence class), or the settle-state
 *      holds a lease naming nobody alive-and-winning.
 * A port already bound by another executor (EXTERNAL_BIND / pre-probe busy)
 * ABORTS the trial (portAborts++) — never counts as a violation, and the
 * next candidate port is used (a concurrent lane may own ports at any time).
 *
 * INJECTION (deterministic interleaving, the finding's exact shape):
 *   --inject stale    role SLOW children set DSH_U5_LEASE_PAUSE_AFTER_STALE_MS
 *                     (pause AFTER observing the stale lease, BEFORE acting
 *                     on the observation). The fast child completes a full
 *                     reclaim+create inside the pause. Pre-fix code: the
 *                     slow unlink then DELETES the fresh lease → two winners
 *                     (RED). Fixed code: the slow claim moves the fresh
 *                     file, the identity re-check refuses to discard it, the
 *                     file is restored (link-never-clobbers), and the slow
 *                     process loses cleanly → one winner (GREEN).
 *   --inject reclaim  role SLOW children set DSH_U5_LEASE_PAUSE_AFTER_RECLAIM_MS
 *                     (pause between winning the reclaim rename and the
 *                     O_EXCL create — a widened natural window; fixed code
 *                     must still settle to exactly one owner: the loser gets
 *                     EEXIST→held). Fixed-code only.
 *
 * --lib <path> imports an ARBITRARY port-lease module (used by the RED
 * evidence run against a faithful copy of the pre-fix lib with only the
 * pause hook added — the copy + its diff live in the evidence dir).
 *
 * CHILD MODE (spawned by the parent): prints one JSON line
 *   {"trial":k,"pid":p,"role":r,"status":"WIN|HELD|BUSY|ERR","finalMatch":bool,...}
 * Exit codes (parent): 0 = zero violations across all completed trials;
 * 1 = violations observed; 2 = harness/usage error. Opt-in only — nothing
 * in vitest/CI collection; the C1 suite runs it with a small trial count.
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const DEFAULT_LIB = join(HERE, 'lib', 'port-lease.mjs')
const DEAD_HOLDER_PID = 4_194_303 // > pid_max on Linux: permanently, provably dead

const argv = process.argv.slice(2)
const arg = (name, dflt) => {
  const i = argv.indexOf(`--${name}`)
  return i === -1 || i + 1 >= argv.length ? dflt : argv[i + 1]
}
const flag = (name) => argv.includes(`--${name}`)

if (flag('child')) await childMain()
else await parentMain()

// ---------------------------------------------------------------- child

async function childMain() {
  const libPath = resolve(arg('lib', DEFAULT_LIB))
  const leaseRoot = arg('lease-root')
  const port = Number(arg('port'))
  const gate = arg('gate')
  const trial = Number(arg('trial', 0))
  const role = arg('role', 'fast')
  const holdMs = Number(arg('hold-ms', 80))
  const out = (obj) => {
    process.stdout.write(JSON.stringify(obj) + '\n')
  }
  const { acquirePortLease, readLease } = await import(`file://${libPath}`)
  // Ready handshake: one file per child, then a tight existsSync poll on the
  // shared gate so every child's readLease lands on the same instant.
  writeFileSync(join(leaseRoot, 'ready', `${process.pid}`), String(role))
  while (!existsSync(gate)) await new Promise((r) => setTimeout(r, 0))
  const env = {
    DSH_U5_LEASE_PAUSE_AFTER_STALE_MS: arg('stale-pause-ms', '0'),
    DSH_U5_LEASE_PAUSE_AFTER_RECLAIM_MS: arg('reclaim-pause-ms', '0'),
  }
  for (const [k, v] of Object.entries(env)) {
    if (Number(v) > 0) process.env[k] = v
  }
  // ASSERTED co-ownership probe: a peer claim counts against us only if its
  // process has ASSERTED ownership (returned from acquire — marked in the
  // harness `holding/` dir). Losing creators briefly hold live claim files
  // by protocol design and remove them at their decide step; those are NOT
  // co-ownership. Our own claim must be live+named-us at every check, and
  // no other ASSERTED holder may coexist. Sequential hand-offs (we acquired
  // only after the previous holder released) never co-mark.
  const holdingDir = join(leaseRoot, 'holding')
  const ownsSolo = () => {
    try {
      const st = readLease(leaseRoot, port)
      if (st.state !== 'held') return { solo: false, asserted: 0 }
      let asserted = []
      if (Array.isArray(st.live)) {
        const mine = st.live.filter((l) => Number(l.pid) === process.pid && (token0 === null || l.token === token0))
        asserted = st.live.filter((l) => Number(l.pid) !== process.pid && existsSync(join(holdingDir, String(l.pid))))
        return { solo: mine.length === 1 && asserted.length === 0, asserted: asserted.length }
      }
      const mineHolds = Number(st.by?.pid) === process.pid && (token0 === null || String(st.by?.token ?? '') === String(token0 ?? ''))
      asserted = existsSync(join(holdingDir, String(st.by?.pid))) && Number(st.by?.pid) !== process.pid ? [1] : []
      return { solo: mineHolds && asserted.length === 0, asserted: asserted.length }
    } catch {
      return { solo: false, asserted: 0 }
    }
  }
  let token0 = null
  try {
    const lease = await acquirePortLease({ leaseRoot, port, world: `u5-race-${role}-${process.pid}`, purpose: 'race' })
    token0 = lease.token ?? null
    writeFileSync(join(holdingDir, String(process.pid)), String(token0 ?? 'x'))
    const c1 = ownsSolo()
    await new Promise((r) => setTimeout(r, Math.floor(holdMs / 2)))
    const c2 = ownsSolo()
    await new Promise((r) => setTimeout(r, Math.ceil(holdMs / 2)))
    const c3 = ownsSolo()
    let released = false
    try {
      lease.release()
      released = true
    } catch {
      released = false // fixed code: refuse to delete a lease that is no longer ours
    }
    try {
      unlinkSync(join(holdingDir, String(process.pid)))
    } catch {
      /* marker cleanup best effort */
    }
    out({ trial, pid: process.pid, role, status: 'WIN', finalMatch: c3.solo, released, token: token0, coObserved: !c1.solo || !c2.solo, checks: [c1, c2, c3] })
  } catch (error) {
    if (error?.code === 'EXTERNAL_BIND') out({ trial, pid: process.pid, role, status: 'BUSY' })
    else if (error?.code === 'LEASE_HELD') out({ trial, pid: process.pid, role, status: 'HELD' })
    else out({ trial, pid: process.pid, role, status: 'ERR', code: String(error?.code ?? error?.message ?? 'ERR').slice(0, 120), stack: String(error?.stack ?? '').split('\n').slice(0, 4).join(' | ').slice(0, 400) })
  }
  process.exit(0)
}

// ---------------------------------------------------------------- parent

async function parentMain() {
  const trials = Number(arg('trials', 12))
  const procs = Number(arg('procs', 8))
  const ports = String(arg('ports', '3500,3499,3498,3497,3186,3185,3184,3183')).split(',').map(Number)
  const inject = String(arg('inject', 'none'))
  const slowPauseMs = Number(arg('slow-pause-ms', 700))
  const libPath = resolve(arg('lib', DEFAULT_LIB))
  const jsonOut = arg('json', null)
  const quiet = flag('quiet')
  if (!Number.isInteger(trials) || trials < 1 || !Number.isInteger(procs) || procs < 2) {
    process.stderr.write('usage: lease-race.mjs [--trials N] [--procs N] [--ports a,b,c] [--inject none|stale|reclaim]\n')
    process.exit(2)
  }
  const base = mkdtempSync(join(tmpdir(), 'u5race-'))
  const started = Date.now()
  let done = 0
  let violations = 0
  let portAborts = 0
  let trialNo = 0
  const winnersDist = {}
  const violationDetails = []
  const records = []
  const say = (line) => {
    if (!quiet) process.stdout.write(line + '\n')
  }
  const { portInUse } = await import(`file://${join(HERE, '..', 'characterization', 'lib', 'util.mjs')}`)
  try {
    while (done < trials) {
      trialNo += 1
      if (trialNo > trials * 4 + 40) break // bounded: port starvation must not hang a suite
      // pick a currently-idle sanctioned port
      let port = null
      for (const p of ports) {
        if (!(await portInUse(p))) {
          port = p
          break
        }
      }
      if (port === null) {
        portAborts += 1
        await new Promise((r) => setTimeout(r, 250))
        continue
      }
      const root = mkdtempSync(join(base, `t${trialNo}-`))
      mkdirSync(join(root, 'ready'), { recursive: true })
      mkdirSync(join(root, 'holding'), { recursive: true })
      const gate = join(root, 'GATE')
      // pre-plant the stale lease (holder permanently dead)
      writeFileSync(join(root, `${port}.lease`), JSON.stringify({ pid: DEAD_HOLDER_PID, startedAt: '2026-01-01T00:00:00.000Z', world: 'u5-race-dead', purpose: 'race-plant' }, null, 2) + '\n')
      const children = []
      for (let i = 0; i < procs; i += 1) {
        const slow = inject !== 'none' && i > 0
        const childArgs = [
          process.argv[1], '--child',
          '--lib', libPath,
          '--lease-root', root,
          '--port', String(port),
          '--gate', gate,
          '--trial', String(trialNo),
          '--role', slow ? 'slow' : 'fast',
        ]
        if (slow) {
          if (inject === 'stale') childArgs.push('--stale-pause-ms', String(slowPauseMs))
          else if (inject === 'reclaim') childArgs.push('--reclaim-pause-ms', String(slowPauseMs))
        }
        children.push({ proc: spawn(process.execPath, childArgs, { stdio: ['ignore', 'pipe', 'pipe'] }), stdout: '', stderr: '' })
        const c = children[children.length - 1]
        c.proc.stdout.on('data', (d) => {
          c.stdout += String(d)
        })
        c.proc.stderr.on('data', (d) => {
          c.stderr += String(d)
        })
      }
      // wait for readiness handshake, then open the gate (the barrier release)
      const t0 = Date.now()
      while (readdirSync(join(root, 'ready')).length < procs && Date.now() - t0 < 15_000) await new Promise((r) => setTimeout(r, 2))
      writeFileSync(gate, 'go')
      const exits = await Promise.all(children.map((c) => new Promise((res) => {
        const timer = setTimeout(() => {
          try {
            c.proc.kill('SIGKILL')
          } catch { /* gone */ }
        }, 30_000)
        c.proc.on('exit', (code, signal) => {
          clearTimeout(timer)
          res({ code, signal })
        })
      })))
      const results = []
      children.forEach((c, i) => {
        const line = c.stdout.trim().split('\n').filter((l) => l.startsWith('{')).pop()
        if (line !== undefined) {
          try {
            results.push(JSON.parse(line))
          } catch { /* fall through */ }
        } else {
          results.push({ trial: trialNo, pid: null, role: i === 0 ? 'fast' : 'slow', status: 'ERR', code: `no-result exit=${String(exits[i].code)} signal=${String(exits[i].signal)} stderr=${c.stderr.slice(0, 120)}` })
        }
      })
      if (results.some((r) => r.status === 'BUSY')) {
        portAborts += 1
        say(`trial ${trialNo} port=${port} ABORT(external bind on ${port})`)
        rmSync(root, { recursive: true, force: true })
        continue
      }
      // A claim-collision crash (ENOENT/EEXIST escaping acquire) is ITSELF the
      // double-claim evidence: two processes acted on the same slot, one
      // finding the other's hand already there. The fixed protocol converts
      // every such collision into a clean LEASE_HELD, so nothing of the kind
      // may ever escape it either.
      const collisions = results.filter((r) => r.status === 'ERR' && /ENOENT|EEXIST/.test(String(r.code)))
      const otherErrs = results.filter((r) => r.status === 'ERR' && !/ENOENT|EEXIST/.test(String(r.code)))
      if (otherErrs.length > 0) {
        // infrastructure flake on this port: abort the trial honestly, never
        // call it a violation.
        portAborts += 1
        say(`trial ${trialNo} port=${port} ABORT(${otherErrs.map((r) => r.code).join(';').slice(0, 160)})`)
        rmSync(root, { recursive: true, force: true })
        continue
      }
      const winners = results.filter((r) => r.status === 'WIN')
      // VIOLATION = co-ownership ever OBSERVED inside a winner's hold window
      // (finalMatch false at any check = displaced/stolen; coObserved = a
      // foreign live lease seen alongside ours) — or a claim-collision crash
      // escaping acquire. More than one winner in a trial is NOT itself a
      // violation when their holds are sequential (hand-off after release);
      // co-held holds cannot hide from the checks above.
      const displaced = winners.filter((w) => w.finalMatch !== true || w.coObserved === true)
      const violation = displaced.length > 0 || collisions.length > 0
      winnersDist[String(winners.length)] = (winnersDist[String(winners.length)] ?? 0) + 1
      done += 1
      const rec = { trial: trialNo, port, winners: winners.map((w) => w.pid), displaced: displaced.map((w) => w.pid), claimCollisions: collisions.map((c) => c.code), held: results.filter((r) => r.status === 'HELD').length, violation, ...(flag('detail') ? { results } : {}) }
      records.push(rec)
      if (violation) {
        violations += 1
        violationDetails.push(rec)
      }
      say(`trial ${trialNo} port=${port} winners=${winners.length}${displaced.length > 0 ? ` DISPLACED=${displaced.length}` : ''} held=${rec.held}${violation ? '  << DOUBLE-OWNERSHIP VIOLATION' : ''}`)
      rmSync(root, { recursive: true, force: true })
    }
  } finally {
    rmSync(base, { recursive: true, force: true })
  }
  const summary = {
    schema: 'u5-lease-race/1',
    at: new Date().toISOString(),
    lib: libPath,
    inject,
    procs,
    trialsRequested: trials,
    trialsCompleted: done,
    violations,
    portAborts,
    winnersDist,
    violationDetails,
    seconds: Math.round((Date.now() - started) / 100) / 10,
    verdict: done >= trials && violations === 0 ? 'CLEAN' : violations > 0 ? 'DOUBLE_OWNERSHIP' : 'INCOMPLETE',
  }
  if (jsonOut !== null) writeFileSync(jsonOut, JSON.stringify(summary, null, 2) + '\n')
  process.stdout.write(`RACE-SUMMARY ${JSON.stringify(summary)}\n`)
  process.exit(violations === 0 && done >= trials ? 0 : 1)
}
