#!/usr/bin/env node
/**
 * a5p3f-diag — PoC3 leg-E(fd) flake diagnostic.
 *
 * READ-ONLY toward the lane and the suite: this file lives in the evidence
 * tree, imports the lane sources plus the PoC3 fixture builder, and never
 * edits either. It replays the exact shape of the leg
 *
 *   'GUARDED: the lane holds no standing fd — a presented fd of a closed call
 *    is refused'        (poc3-probes.test.ts LEG E, the `toBe('fd-closed')` line)
 *
 * over and over, and for every trial records BOTH observations of the same
 * kernel object:
 *
 *   preOwner  — what /proc/self/fd/<captured> says right BEFORE the test hands
 *               the stale descriptor to the lane (the test's own view);
 *   laneView  — what the lane's own refusal message says /proc showed at the
 *               instant of ITS check;
 *   reason    — the cfReason the lane answered.
 *
 * `driftWindows` counts trials where preOwner and laneView DISAGREE: that is
 * the race, measured instead of inferred, with the worst window duration.
 * `labelInconsistent` counts trials where the lane's ANSWER disagrees with the
 * /proc view the lane itself published — the discriminator between
 * "the label path is wrong" and "the test's precondition was externally
 * violated".
 *
 * Modes:
 *   --churn 1        an in-process worker_threads hammer opens/closes a real
 *                    file. Worker threads share the process fd table, which is
 *                    exactly the condition the nine-root census creates when
 *                    sibling test FILES run in parallel. No child_process.
 *   --reserve W      candidate fix (a), measured before it is written into the
 *                    suite: hold a wall of W low numbers so the lane's open
 *                    lands at W+, then RELEASE the wall once the number N is
 *                    captured. The kernel gives the lowest free number, so a
 *                    foreign opener lands in the freed band strictly below N
 *                    and never reaches N.
 *
 * Usage: node a5p3f-diag.mjs [--trials N] [--churn 0|1] [--reserve W] [--json F]
 */
import { closeSync, openSync, readlinkSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'node:module'
import { Worker, isMainThread, workerData } from 'node:worker_threads'

const HERE = dirname(fileURLToPath(import.meta.url))

// ---------------------------------------------------------------------------
// worker side: real open/close churn INSIDE the same process (shared fd table)
// ---------------------------------------------------------------------------
if (!isMainThread) {
  const { file } = workerData
  const stopAt = Date.now() + 60_000
  while (Date.now() < stopAt) {
    const fd = openSync(file, 'r')
    closeSync(fd)
  }
  process.exit(0) // worker only: never fall through into the main-side body
}

const REPO = process.env.A5P3F_REPO ?? join(HERE, '..', '..', '..', '..', '..')
const PKG = join(REPO, 'packages', 'runtime', 'controlled-fs')
register(pathToFileURL(join(REPO, 'scripts', 'run-tests-hooks.mjs')).href, import.meta.url)

const { createControlledFsLane } = await import(pathToFileURL(join(PKG, 'src', 'controlled-fs.ts')).href)
const { createPoc3World, destroyPoc3World, fileRef, makeGrant, MEM_A } =
  await import(pathToFileURL(join(PKG, 'test', 'poc3-harness.ts')).href)

const argv = process.argv.slice(2)
const opt = (k, d) => {
  const i = argv.indexOf(`--${k}`)
  return i >= 0 ? Number(argv[i + 1]) : d
}
const TRIALS = opt('trials', 400)
const CHURN = opt('churn', 0) === 1
const RESERVE = opt('reserve', 0)
const JSON_OUT = argv.includes('--json') ? argv[argv.indexOf('--json') + 1] : null

const FULL = { offset: 0, limit: null }

/** Kernel truth about one fd number in THIS process, observed right now. */
function procOwner(fd) {
  try {
    return readlinkSync(`/proc/self/fd/${fd}`)
  } catch {
    return null
  }
}

const world = createPoc3World()
const churnFile = join(world.outside, 'churn-victim.txt')
writeFileSync(churnFile, 'CHURN\n')

const mkLane = (hooks) => createControlledFsLane({
  instances: [{ fs: 'ctl', rootDir: world.ctrl, realmId: 'realm-1', kind: 'absolute-path' }],
  visibility: () => 'visible',
  currentAuthorityGeneration: 1,
  consumed: () => false,
  hooks,
})

let captured = -1
const captureLane = mkLane({
  onFdOpened: (info) => {
    if (info.locator.endsWith('/public/a.txt')) captured = info.fd
  },
})
const probeLane = mkLane(undefined)

const ref = fileRef(world, 'public/a.txt', ['read'])
const grant = makeGrant({ member: MEM_A, effects: [{ kind: 'read', resource: ref }] })

let churner = null
if (CHURN) {
  churner = new Worker(new URL(import.meta.url), { workerData: { file: churnFile } })
  await new Promise((r) => setTimeout(r, 30))
}

const events = []
let drift = 0
let inconsistent = 0
let nClosed = 0
let nRecycled = 0
let nOther = 0
let windowNsMax = 0
let fdMin = Infinity
let fdMax = 0

for (let t = 0; t < TRIALS; t++) {
  // candidate fix (a): wall FIRST, so the lane's own open lands above it …
  const wall = []
  if (RESERVE > 0) for (let i = 0; i < RESERVE; i++) wall.push(openSync(churnFile, 'r'))

  captured = -1
  const first = await captureLane.fs.readText(grant, ref, FULL)
  if (!(first.ok && first.value.text === 'A-CONTENT\n')) throw new Error('baseline read failed')
  const fd = captured

  // … then the wall is released: a band of free slots strictly BELOW the
  // leg's number, which is where the kernel sends every later opener.
  for (const w of wall) closeSync(w)

  const tClose = process.hrtime.bigint()
  const preOwner = procOwner(fd)
  const stale = { fs: 'ctl', path: 'public/a.txt', fd }
  const res = await probeLane.fs.readDescriptor(grant, stale, FULL)
  const tLane = process.hrtime.bigint()
  if (res.ok) throw new Error('a closed fd SERVED bytes — that is a GUARD failure, not a flake')

  const reason = res.error.details?.['cfReason']
  // A denial carries its /proc observation in the message body (cf-errors:
  // only hidden-reasons get a cfDiagnostic detail).
  const laneViewRaw = /\/proc view: (.*) \(a closed fd/.exec(res.error.message)?.[1] ?? ''
  const laneSaysAbsent = laneViewRaw === 'no such fd'
  if (reason === 'fd-closed') nClosed += 1
  else if (reason === 'fd-recycled') nRecycled += 1
  else nOther += 1

  // Does the lane's answer agree with the /proc view the lane ITSELF saw?
  const agrees = (reason === 'fd-closed') === laneSaysAbsent
  if (!agrees) inconsistent += 1

  const spanNs = Number(tLane - tClose)
  const disagreesWithTestView = (preOwner === null) !== laneSaysAbsent
  if (disagreesWithTestView) {
    drift += 1
    if (spanNs > windowNsMax) windowNsMax = spanNs
  }
  if (fd < fdMin) fdMin = fd
  if (fd > fdMax) fdMax = fd
  if (disagreesWithTestView || reason === 'fd-recycled' || events.length < 2) {
    events.push({ trial: t, fd, preOwner, laneView: laneViewRaw, reason, windowNs: spanNs })
  }
}

if (churner) await churner.terminate()
rmSync(churnFile, { force: true })
destroyPoc3World(world.world)

const summary = {
  head: process.env.A5P3F_HEAD ?? 'unknown',
  node: process.version,
  trials: TRIALS,
  churn: CHURN,
  reserve: RESERVE,
  answeredFdClosed: nClosed,
  answeredFdRecycled: nRecycled,
  otherReasons: nOther,
  driftWindows: drift,
  labelInconsistentWithOwnView: inconsistent,
  worstWindowNs: windowNsMax,
  capturedFdRange: [fdMin, fdMax],
  pid: process.pid,
}
console.log(JSON.stringify(summary))
if (JSON_OUT && !String(JSON_OUT).startsWith('--')) {
  writeFileSync(JSON_OUT, JSON.stringify({ summary, events: events.slice(0, 60) }, null, 2))
}
