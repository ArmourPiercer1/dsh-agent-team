#!/usr/bin/env node
/**
 * review-LSP-probe-payload — the INDEPENDENT reviewer payload (not the lane's
 * fixture). It runs CONFINED (inside the launcher's Landlock domain) and
 * reports OS facts about itself:
 *
 *   fd3     — what FD 3 IS inside the payload: fstat outcome, its /proc symlink
 *             target, and what a read returns. The reviewer passes a MARKER file
 *             as the launcher's fd 3, so a crossing channel is RECOGNIZABLE
 *             (target = the marker path / read = the marker text). A number the
 *             payload runtime re-took is a different target — that is not the
 *             launcher's channel, and the target comparison says which it was.
 *   extra   — every fd above 2 with its target (fd-hygiene observation)
 *   denied  — read outcome of a path OUTSIDE every allow entry (EACCES proof)
 *   markerVisible — read outcome of the marker file BY NAME (must be EACCES:
 *             it sits in the denied directory, so only a leaked fd could show it)
 *   pid/gen/cwd — identity facts compared against the seam's claims
 *
 * Line-JSON protocol on the pipes: {"ping":N} -> {"pong":N,...}. Modes
 * (argv[5]): 'ignore-term' swallows SIGTERM (the escalation leg),
 * 'silent' never answers (the mid-change-failure leg).
 *
 * @module dev/agent-workflow/evidence/alpha5/prod/review-LSP-probe-payload
 */
import fs from 'node:fs'
import process from 'node:process'

const gen = String(process.argv[2] ?? 'g0')
const deniedPath = String(process.argv[3] ?? '')
const marker = String(process.argv[4] ?? '')
const mode = String(process.argv[5] ?? '')

function probeFd3() {
  const out = { st: 'unknown', target: 'unknown', read: 'unknown' }
  try {
    const st = fs.fstatSync(3)
    out.st = `OPEN ino:${st.ino}`
  } catch (error) {
    out.st = String(error && error.code ? error.code : 'ERR')
    return out
  }
  try {
    out.target = fs.readlinkSync('/proc/self/fd/3')
  } catch (error) {
    out.target = `readlink:${String(error && error.code ? error.code : 'ERR')}`
  }
  try {
    const buf = Buffer.alloc(64)
    const n = fs.readSync(3, buf, 0, 64, null)
    out.read = n > 0 ? JSON.stringify(buf.subarray(0, Math.min(n, 48)).toString('utf8')) : 'eof'
  } catch (error) {
    out.read = String(error && error.code ? error.code : 'ERR')
  }
  return out
}

const fd3 = probeFd3()

let fds = []
let extra = []
try {
  fds = fs.readdirSync('/proc/self/fd').filter((x) => /^\d+$/.test(x)).map(Number).sort((a, b) => a - b)
  extra = fds
    .filter((f) => f > 2)
    .map((f) => {
      try {
        return { fd: f, target: fs.readlinkSync(`/proc/self/fd/${f}`) }
      } catch {
        return { fd: f, target: 'gone' }
      }
    })
} catch {
  fds = ['unreadable']
}

let denied = 'not-asked'
if (deniedPath.length > 0) {
  try {
    fs.readFileSync(deniedPath, 'utf8')
    denied = 'READ-ALLOWED'
  } catch (error) {
    denied = String(error && error.code ? error.code : 'ERR')
  }
}

const markerVisible = marker.length === 0 ? 'not-asked' : (() => {
  try {
    fs.readFileSync(marker, 'utf8')
    return 'READ-MARKER-FILE'
  } catch (error) {
    return String(error && error.code ? error.code : 'ERR')
  }
})()

const facts = { fd3, fds, extra, denied, markerVisible, pid: process.pid, gen, cwd: process.cwd() }

if (mode === 'ignore-term') {
  process.on('SIGTERM', () => { /* stubborn: the terminate arm must escalate */ })
}

function out(obj) {
  process.stdout.write(JSON.stringify(obj) + '\n')
}

if (mode === 'silent') {
  setInterval(() => { /* alive, never answers */ }, 60_000)
} else {
  let buf = ''
  process.stdin.setEncoding('utf8')
  process.stdin.on('data', (chunk) => {
    buf += chunk
    for (;;) {
      const nl = buf.indexOf('\n')
      if (nl < 0) break
      const line = buf.slice(0, nl).trim()
      buf = buf.slice(nl + 1)
      if (line.length === 0) continue
      let msg
      try {
        msg = JSON.parse(line)
      } catch {
        continue
      }
      if (msg && typeof msg.ping === 'number') out({ pong: msg.ping, ...facts })
      if (msg && msg.method === 'exit') process.exit(0)
    }
  })
  process.stdin.on('end', () => process.exit(0))
  out({ hello: 1, ...facts })
}
