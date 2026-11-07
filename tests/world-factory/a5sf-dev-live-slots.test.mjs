/**
 * a5sf-dev-live-slots.test.mjs — the D1 leak pin + the cross-namespace slot
 * defences, host-free.
 *
 * ZERO Host boots, ZERO ports, ZERO DSH_HOME, ZERO network. Every case uses a
 * `mkdtemp` lease root and a stub boot thunk, so it exercises the REAL
 * `preRegisterDevLiveBudget` lease and the REAL `lib/dev-live-slots.mjs`
 * counter without touching the machine-wide counter.
 *
 * WHY THIS FILE EXISTS (the two 2026-11-13 recon findings):
 *
 *   D1  `drivers/a5sf-live-member/run-boot.mjs` ended each boot with
 *       `lease.release?.()`. The lease exposes `releaseSlot()` / `finish()`, so
 *       the optional call was a silent no-op and EVERY successful boot leaked
 *       one machine slot until the runner exited. With the then-limit of 2, the
 *       second boot of a pair hit `DEV_LIVE_LIMIT_REACHED` while the first
 *       Host was long gone (`evidence/a5sf-recon-external` D1, 16:04:20Z).
 *
 *   NS  Slot liveness was decided by `pidAlive(recordedPid)` — but `pid` is
 *       recorded in the ACQUIRER's PID namespace. The recon lanes' slots all
 *       said `pid: 3` while being different live processes, so a peer either
 *       saw a ghost as alive (capacity loss) or saw a live peer as dead and
 *       unlinked it between acquire and `assertDevLiveSlotHeld` (two of the
 *       three `DEV_LIVE_SLOT_REQUIRED` pre-boot refusals in the same round).
 *
 * The tests are ordered as the finding was: PIN the old failure mode (it stays
 * green and explains why the helper exists), then the regression arms that are
 * RED on the old code (a leaked slot refuses the next boot; a peer's fresh slot
 * is unlinked; an unjudgeable live slot is treated as dead).
 *
 * Run: node --test tests/world-factory/a5sf-dev-live-slots.test.mjs
 *
 * CORE PATCH BUDGET = 0. Nothing here touches `packages/**`, `.github/**`, Q7,
 * the CI required checks or the acceptance vocabulary.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { createRunRecord } from './lib/run-record.mjs'
import { TEST_USE_BASELINE_SHA as HOST_SHA } from '../paths.mjs'
import { preRegisterDevLiveBudget } from './suites/150-a5sf-read.mjs'
import {
  CROSS_NAMESPACE_GRACE_MS,
  DEV_LIVE_SLOT_LIMIT,
  DevLiveSlotError,
  acquireDevLiveSlot,
  currentPidNamespace,
  scanDevLiveSlots,
  settleDevLiveLease,
  sweepStaleDevLiveSlot,
} from './lib/dev-live-slots.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const ROOT = resolve(HERE, '..', '..')
const HEAD = 'abcdef0123456789abcdef0123456789abcdef01'

const dirs = []
function tmp(label) {
  const dir = mkdtempSync(join(tmpdir(), `a5sf-slots-${label}-`))
  dirs.push(dir)
  return dir
}
test.after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
})

const DEV_GRANT = Object.freeze({
  grantId: 'devlive-slots-1',
  scope: 'DEV-LIVE',
  grantedBy: 'self:capability-implementer (scope authorisation relayed by owner)',
  face: 'FS Provider',
  world: 'u5a5sfdev1',
})

function grantFile(dir) {
  const path = join(dir, 'grant.json')
  writeFileSync(path, `${JSON.stringify(DEV_GRANT, null, 2)}\n`)
  return path
}

function devRecord(dir, label, leaseRoot) {
  return createRunRecord({
    runId: `slots-${label}`,
    suite: 'a5sf-read',
    selectedCases: ['read:allowed-inside-ceiling'],
    ledgerPath: join(dir, `${label}.jsonl`),
    recordClass: 'DEV-LIVE',
    bindings: { teamSha: HEAD, hostSha: HOST_SHA, leaseRoot },
  })
}

/** A boot thunk that only writes the start row (no Host, no port, no spawn). */
const bootStub = (record, label) => () =>
  record.logHostStart({ world: 'u5a5sfdev1', phase: `slots-${label}`, suite: 'a5sf-read' })

async function openLease(dir, { label = 'lease', leaseRoot }) {
  const record = devRecord(dir, label, leaseRoot)
  const lease = await preRegisterDevLiveBudget({
    grantPath: grantFile(dir),
    headCommit: HEAD,
    runRecord: record,
    face: DEV_GRANT.face,
    world: DEV_GRANT.world,
    leaseRoot,
  })
  return { lease, record }
}

function slotFile(leaseRoot, slot = 0) {
  return join(leaseRoot, 'dev-live-hosts', `${String(slot)}.json`)
}

function writeRawSlot(leaseRoot, payload, slot = 0) {
  mkdirSync(join(leaseRoot, 'dev-live-hosts'), { recursive: true })
  writeFileSync(slotFile(leaseRoot, slot), `${JSON.stringify(payload, null, 2)}\n`)
}

// ─────────────────────────────────────────────────────────────────────────────
// D1 — pin the exact old failure mode, then the regression that closes it
// ─────────────────────────────────────────────────────────────────────────────
test('(d1-pin) the historical `lease.release?.()` is a silent no-op that keeps the slot', async () => {
  const dir = tmp('pin')
  const leaseRoot = join(dir, 'leases')
  const { lease } = await openLease(dir, { label: 'pin', leaseRoot })
  await lease.boot(bootStub(devRecord(dir, 'pin-boot', leaseRoot), 'pin'))
  assert.equal(scanDevLiveSlots({ leaseRoot }).live.length, 1, 'the boot holds one machine slot')

  // EXACTLY what run-boot.mjs used to do. No API is named `release`, so this
  // must not be mistaken for cleanup.
  lease.release?.()

  assert.equal(lease.holdsSlot(), true, 'the no-op did not release anything')
  assert.equal(scanDevLiveSlots({ leaseRoot }).live.length, 1, 'the slot is still counted: this is the leak D1 found')
  assert.equal(scanDevLiveSlots({ leaseRoot }).live[0].runId, 'slots-pin', 'the leaked slot is this run')

  // The real API, in one place: releases and proves the lease is no longer held.
  const settled = settleDevLiveLease(lease)
  assert.equal(settled.released, true)
  assert.equal(settled.held, false)
  assert.equal(scanDevLiveSlots({ leaseRoot }).live.length, 0, 'after the real API the counter is back to zero')
})

test('(d1-regression) a released boot admits the next boot instead of DEV_LIVE_LIMIT_REACHED', async () => {
  const dir = tmp('admit')
  const leaseRoot = join(dir, 'leases')

  // First boot: spend a slot, then settle like the driver's `finally` does.
  const first = await openLease(dir, { label: 'first', leaseRoot })
  await first.lease.boot(bootStub(first.record, 'first'))
  settleDevLiveLease(first.lease)
  assert.equal(scanDevLiveSlots({ leaseRoot }).live.length, 0, 'the first boot no longer leaks its slot')

  // Fill every remaining slot EXCEPT one. If the first boot had leaked, the
  // second boot below would be the (limit+1)th and must refuse.
  const fillers = []
  for (let i = 1; i < DEV_LIVE_SLOT_LIMIT; i += 1) {
    fillers.push(acquireDevLiveSlot({
      leaseRoot, runId: `filler-${String(i)}`, face: DEV_GRANT.face, world: `w${String(i)}`,
    }))
  }
  assert.equal(scanDevLiveSlots({ leaseRoot }).live.length, DEV_LIVE_SLOT_LIMIT - 1)

  const second = await openLease(dir, { label: 'second', leaseRoot })
  await second.lease.boot(bootStub(second.record, 'second'))
  assert.equal(scanDevLiveSlots({ leaseRoot }).live.length, DEV_LIVE_SLOT_LIMIT, 'the second boot was ADMITTED as the last slot')
  settleDevLiveLease(second.lease)
  for (const filler of fillers) filler.release()
  assert.equal(scanDevLiveSlots({ leaseRoot }).live.length, 0)
})

test('(d1-old-path-control) the old no-op cleanup still refuses the next boot — the failure D1 recorded', async () => {
  // This arm deliberately uses the HISTORICAL cleanup line, so it keeps
  // documenting the consequence even though the driver no longer does this:
  // a leaked slot + (limit-1) other Hosts = the next boot is refused.
  const dir = tmp('oldpath')
  const leaseRoot = join(dir, 'leases')
  const first = await openLease(dir, { label: 'old-first', leaseRoot })
  await first.lease.boot(bootStub(first.record, 'old-first'))
  first.lease.release?.() // the old run-boot cleanup: no-op
  assert.equal(first.lease.holdsSlot(), true, 'old cleanup leaked the slot (pinned)')

  const fillers = []
  for (let i = 1; i < DEV_LIVE_SLOT_LIMIT; i += 1) {
    fillers.push(acquireDevLiveSlot({
      leaseRoot, runId: `old-filler-${String(i)}`, face: DEV_GRANT.face, world: `w${String(i)}`,
    }))
  }
  const second = await openLease(dir, { label: 'old-second', leaseRoot })
  await assert.rejects(
    () => second.lease.boot(bootStub(second.record, 'old-second')),
    (error) => error instanceof DevLiveSlotError && error.code === 'DEV_LIVE_LIMIT_REACHED',
    'this is exactly the 16:04:20Z refusal: the second boot counted the first boot\'s leaked slot',
  )

  settleDevLiveLease(first.lease)
  for (const filler of fillers) filler.release()
})

test('(d1-fail-loud) a missing or ineffective release API is a typed ERROR, never "nothing to do"', () => {
  assert.throws(
    () => settleDevLiveLease({ release: () => true, holdsSlot: () => false }),
    (error) => error instanceof DevLiveSlotError && error.code === 'DEV_LIVE_SLOT_API_MISSING',
    'a lease that only has `release()` must refuse loudly (this is the historical bug)',
  )
  assert.throws(
    () => settleDevLiveLease(null),
    (error) => error instanceof DevLiveSlotError && error.code === 'DEV_LIVE_SLOT_API_MISSING',
  )
  assert.throws(
    () => settleDevLiveLease({ releaseSlot: () => true, holdsSlot: () => true }),
    (error) => error instanceof DevLiveSlotError && error.code === 'DEV_LIVE_SLOT_LEAKED',
    'a release that leaves the lease holding a slot must refuse loudly',
  )
  assert.deepEqual(
    settleDevLiveLease({ releaseSlot: () => true, holdsSlot: () => false }),
    { released: true, held: false },
  )
})

test('(d1-wiring) the live-member driver releases through the real API in its finally', () => {
  const source = readFileSync(join(ROOT, 'tests/world-factory/drivers/a5sf-live-member/run-boot.mjs'), 'utf8')
  assert.match(source, /import \{ settleDevLiveLease \} from '\.\.\/\.\.\/lib\/dev-live-slots\.mjs'/, 'the driver imports the one release obligation')
  assert.match(source, /settleDevLiveLease\(lease\)/, 'the driver settles the lease')
  assert.doesNotMatch(source, /\btry \{ lease\.release\?\.\(\) \}/, 'the silent no-op must not come back as code')
  assert.doesNotMatch(source, /\blease\.release\(\)/, 'a guessed release() method must not come back')
})

// ─────────────────────────────────────────────────────────────────────────────
// NS — cross-namespace stale judgement: never guess "dead", never delete a peer
// ─────────────────────────────────────────────────────────────────────────────
test('(ns-unknown) a slot from another PID namespace is NOT immediately reclaimed', () => {
  const dir = tmp('ns')
  const leaseRoot = join(dir, 'leases')
  const foreign = {
    slot: 0,
    token: 'foreign-token',
    pid: 3,
    pidNs: 'pid:[4026530000]',
    startedAt: new Date().toISOString(),
    runId: 'foreign-run',
    face: 'FS Provider',
    world: 'wforeign',
    headCommit: HEAD,
  }
  writeRawSlot(leaseRoot, foreign)

  const scan = scanDevLiveSlots({ leaseRoot, pidNamespace: 'pid:[4026531111]' })
  assert.equal(scan.entries.length, 1)
  assert.equal(scan.entries[0].liveness, 'unknown', 'a foreign pid number is not evidence of death')
  assert.equal(scan.entries[0].alive, false, 'and it is not evidence of life either')
  assert.equal(scan.stale.length, 0, 'it stays counted until the grace window passes')

  // The acquire path must not steal it either while it is young.
  const mine = acquireDevLiveSlot({
    leaseRoot, runId: 'mine', face: 'FS Provider', world: 'wmine', pidNamespace: 'pid:[4026531111]',
  })
  assert.notEqual(mine.slot, 0, 'the foreign slot was left alone; we took another slot')
  assert.equal(existsSync(slotFile(leaseRoot, 0)), true, 'the foreign slot file still exists')
  mine.release()
})

test('(ns-legacy) a legacy slot with no pidNs is unjudgeable, then reclaimed after the grace window', () => {
  const dir = tmp('legacy')
  const leaseRoot = join(dir, 'leases')
  const legacy = {
    slot: 0,
    token: 'legacy-token',
    pid: 999_999, // dead in THIS namespace — but the file does not say which one
    startedAt: new Date().toISOString(),
    runId: 'legacy-run',
    face: 'FS Provider',
    world: 'wlegacy',
    headCommit: HEAD,
  }
  writeRawSlot(leaseRoot, legacy)

  const fresh = scanDevLiveSlots({ leaseRoot })
  assert.equal(fresh.entries[0].liveness, 'unknown', 'without pidNs a bare pid is not a verdict')
  assert.equal(fresh.stale.length, 0, 'a fresh legacy file is not deleted immediately')

  const old = new Date(Date.now() - CROSS_NAMESPACE_GRACE_MS - 5_000)
  utimesSync(slotFile(leaseRoot), old, old)
  const aged = scanDevLiveSlots({ leaseRoot })
  assert.equal(aged.stale.length, 1, 'after the grace window it is residue and may be swept')
  assert.equal(sweepStaleDevLiveSlot(aged.stale[0]), true)
  assert.equal(existsSync(slotFile(leaseRoot)), false)
})

test('(ns-token) a peer re-acquiring the same slot is never unlinked by a stale scan', () => {
  const dir = tmp('token')
  const leaseRoot = join(dir, 'leases')
  writeRawSlot(leaseRoot, {
    slot: 0,
    token: 'old-token',
    pid: 3,
    pidNs: 'pid:[4026530000]',
    startedAt: new Date().toISOString(),
    runId: 'old',
    face: 'FS Provider',
    world: 'wold',
    headCommit: HEAD,
  })
  const old = new Date(Date.now() - CROSS_NAMESPACE_GRACE_MS - 5_000)
  utimesSync(slotFile(leaseRoot), old, old)
  const staleEntry = scanDevLiveSlots({ leaseRoot }).stale[0]
  assert.ok(staleEntry, 'the old file looks stale to this prober')

  // A peer releases and re-acquires the SAME slot before our sweep runs.
  writeRawSlot(leaseRoot, {
    slot: 0,
    token: 'peer-token',
    pid: process.pid,
    pidNs: currentPidNamespace() ?? 'pid:[unknown]',
    startedAt: new Date().toISOString(),
    runId: 'peer',
    face: 'FS Provider',
    world: 'wpeer',
    headCommit: HEAD,
  })

  assert.equal(sweepStaleDevLiveSlot(staleEntry), false, 'token re-read refuses to delete a peer\'s fresh slot')
  const onDisk = JSON.parse(readFileSync(slotFile(leaseRoot), 'utf8'))
  assert.equal(onDisk.token, 'peer-token', 'the peer still owns the slot after our sweep attempt')
})

test('(ns-heartbeat) touch() keeps a live cross-namespace slot out of the grace window', () => {
  const dir = tmp('beat')
  const leaseRoot = join(dir, 'leases')
  const mine = acquireDevLiveSlot({
    leaseRoot, runId: 'beat', face: 'FS Provider', world: 'wbeat', pidNamespace: 'pid:[4026532222]',
  })
  assert.equal(JSON.parse(readFileSync(mine.path, 'utf8')).pidNs, 'pid:[4026532222]', 'acquire records its namespace')

  // Age the file past the grace, as an idle owner would.
  const old = new Date(Date.now() - CROSS_NAMESPACE_GRACE_MS - 5_000)
  utimesSync(mine.path, old, old)
  const peerView = { leaseRoot, pidNamespace: 'pid:[4026531111]' }
  assert.equal(scanDevLiveSlots(peerView).stale.length, 1, 'a silent cross-namespace owner would be reclaimed')
  assert.equal(mine.touch(), true)
  assert.equal(scanDevLiveSlots(peerView).stale.length, 0, 'the heartbeat keeps the live slot fresh')

  mine.release()
})
