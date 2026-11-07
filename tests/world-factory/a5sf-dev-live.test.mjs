/**
 * a5sf-dev-live.test.mjs — the owner's 2026-11-09 workflow ruling, host-free.
 *
 * ZERO Host boots, ZERO ports, ZERO DSH_HOME, ZERO network. This file proves
 * the THREE negative controls the ruling requires, plus the scope separation
 * that keeps the candidate path untouched:
 *
 *   (a) a DEV-LIVE record used to claim `V@B=yes` is REFUSED
 *       (`DEV_LIVE_EVIDENCE_NOT_CANDIDATE`) — the one hard rule that makes the
 *       development-boot relaxation safe;
 *   (b) a dev-live start still writes its ledger rows (intent + start +
 *       outcome) and may repeat under the SAME scope authorisation — with no
 *       cumulative cap — while the C2 per-run grant semantics are unchanged;
 *   (c) the machine-wide concurrency cap refuses a THIRD concurrent dev Host
 *       (`DEV_LIVE_LIMIT_REACHED`), reusing the shared lease root + pid
 *       liveness (no new subsystem);
 *   (d) the two scopes never cross: a dev-live grant cannot pay for a
 *       candidate run and a candidate grant cannot authorise a dev boot; the
 *       record class must match the scope.
 *
 * Run: node --test tests/world-factory/a5sf-dev-live.test.mjs
 *
 * CORE PATCH BUDGET = 0. Nothing here touches `packages/**`,
 * `.github/**`, Q7, the CI required checks or the acceptance vocabulary.
 */
import test from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRunRecord } from './lib/run-record.mjs'
import { TEST_USE_BASELINE_SHA as HOST_SHA } from '../paths.mjs'
import {
  AcceptanceClaimError,
  DEFAULT_RECORD_CLASS,
  RECORD_CLASSES,
  assessCandidateClaim,
  assertCandidateClaim,
} from './lib/acceptance-claim.mjs'
import {
  DEAD_SLOT_GRACE_MS,
  DEV_LIVE_SLOT_LIMIT,
  DevLiveSlotError,
  acquireDevLiveSlot,
  assertDevLiveSlotHeld,
  currentPidNamespace,
  scanDevLiveSlots,
  sweepStaleDevLiveSlot,
} from './lib/dev-live-slots.mjs'
import {
  A5sfReadGateError,
  preRegisterBudget,
  preRegisterDevLiveBudget,
  preRegisterReadBudget,
  readBudgetGrant,
} from './suites/150-a5sf-read.mjs'

const HEAD = 'abcdef0123456789abcdef0123456789abcdef01'
const OTHER = '0123456789abcdef0123456789abcdef01234567'

const dirs = []
function tmp(label) {
  const dir = mkdtempSync(join(tmpdir(), `a5sf-dev-live-${label}-`))
  dirs.push(dir)
  return dir
}
test.after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
})

function grantFile(dir, grant) {
  const path = join(dir, 'grant.json')
  writeFileSync(path, `${JSON.stringify(grant, null, 2)}\n`)
  return path
}

const DEV_GRANT = Object.freeze({
  grantId: 'devlive-fs-search-1',
  scope: 'DEV-LIVE',
  grantedBy: 'self:capability-implementer (scope authorisation relayed by owner)',
  face: 'FS Provider',
  world: 'u5a5sfdev1',
})

const C2_GRANT = Object.freeze({
  grantId: 'cand-fs-search-1',
  maxStarts: 2,
  grantedBy: 'owner, 2026-11-06 (one start)',
  boundCommit: HEAD,
})

function devRecord(dir, { ledger = join(dir, 'ledger.jsonl'), leaseRoot } = {}) {
  return createRunRecord({
    runId: 'dev-live-run-1',
    suite: 'a5sf-read',
    selectedCases: ['read:allowed-inside-ceiling'],
    ledgerPath: ledger,
    recordClass: 'DEV-LIVE',
    bindings: { teamSha: HEAD, hostSha: HOST_SHA, leaseRoot: leaseRoot ?? join(dir, 'leases') },
  })
}

function c2Record(dir, { ledger = join(dir, 'ledger.jsonl'), claim = null } = {}) {
  return createRunRecord({
    runId: 'c2-run-1',
    suite: 'a5sf-read',
    selectedCases: ['read:allowed-inside-ceiling'],
    ledgerPath: ledger,
    ...(claim === null ? {} : { candidateClaim: claim }),
    bindings: { teamSha: HEAD, hostSha: HOST_SHA, authority: { pointerPath: 'dev/engineering/current-authority.json' } },
  })
}

function ledgerRows(path) {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8').split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l))
}

// ─────────────────────────────────────────────────────────────────────────────
// (a) the hard rule: DEV-LIVE may never produce V@B=yes
// ─────────────────────────────────────────────────────────────────────────────
test('(a-negative) a DEV-LIVE record claiming V@B=yes is refused at finalize', () => {
  const dir = tmp('claim')
  const record = devRecord(dir)
  record.addCase('read:allowed-inside-ceiling', 'PASS')
  // A caller cannot set the field after createRunRecord to dodge the rule.
  record.record.candidateClaim = { verifiedAtBaseline: true }
  assert.throws(
    () => record.finalize(),
    (error) => error instanceof AcceptanceClaimError && error.code === 'DEV_LIVE_EVIDENCE_NOT_CANDIDATE',
  )
})

test('(a-negative) assertCandidateClaim refuses a DEV-LIVE record directly', () => {
  const dir = tmp('claim2')
  const record = devRecord(dir)
  assert.throws(
    () => assertCandidateClaim({ record: record.record, verifiedAtBaseline: true }),
    (error) => error instanceof AcceptanceClaimError && error.code === 'DEV_LIVE_EVIDENCE_NOT_CANDIDATE',
  )
  const assessment = assessCandidateClaim({ recordClass: 'DEV-LIVE', record: record.record })
  assert.equal(assessment.eligible, false)
  assert.equal(assessment.code, 'DEV_LIVE_EVIDENCE_NOT_CANDIDATE')
})

test('(a-positive-control) the SAME claim is accepted on a CANDIDATE-C2 record — and the class is declared necessary, not sufficient', () => {
  const dir = tmp('claim3')
  const record = c2Record(dir, { claim: { verifiedAtBaseline: true } })
  record.addCase('read:allowed-inside-ceiling', 'PASS')
  const finalized = record.finalize()
  assert.equal(finalized.recordClass, 'CANDIDATE-C2')
  assert.equal(finalized.candidateClaimEligibility.eligible, true)
  assert.match(finalized.candidateClaimEligibility.reason, /NECESSARY, NOT SUFFICIENT/)
  assert.equal(assertCandidateClaim({ record: finalized, verifiedAtBaseline: true }).eligible, true)
})

test('(a-disclosure) every record carries its class and a machine-readable claim eligibility', () => {
  const dir = tmp('claim4')
  const record = devRecord(dir)
  record.addCase('read:allowed-inside-ceiling', 'PASS')
  const finalized = record.finalize()
  assert.equal(finalized.recordClass, 'DEV-LIVE')
  assert.equal(finalized.candidateClaimEligibility.eligible, false)
  assert.equal(finalized.candidateClaimEligibility.code, 'DEV_LIVE_EVIDENCE_NOT_CANDIDATE')
  // The default class keeps every pre-existing caller's behaviour.
  assert.equal(DEFAULT_RECORD_CLASS, 'CANDIDATE-C2')
  assert.deepEqual([...RECORD_CLASSES], ['DEV-LIVE', 'CANDIDATE-C2'])
})

// ─────────────────────────────────────────────────────────────────────────────
// (b) a dev-live start still writes a ledger row; repeated starts are allowed
// ─────────────────────────────────────────────────────────────────────────────
test('(b) a dev-live start registers intent + start + outcome rows and records the version', async () => {
  const dir = tmp('ledger')
  const ledger = join(dir, 'ledger.jsonl')
  const leaseRoot = join(dir, 'leases')
  const grantPath = grantFile(dir, DEV_GRANT)
  const record = devRecord(dir, { ledger, leaseRoot })

  const lease = await preRegisterDevLiveBudget({
    grantPath,
    headCommit: HEAD,
    runRecord: record,
    face: 'FS Provider',
    world: 'u5a5sfdev1',
    leaseRoot,
  })
  let rows = ledgerRows(ledger)
  assert.equal(rows.length, 1, 'the intent row is written before any spawn')
  assert.equal(rows[0].kind, 'budget-intent')
  assert.equal(rows[0].recordClass, 'DEV-LIVE')
  assert.equal(rows[0].scope, 'dev-live')
  assert.equal(rows[0].headCommit, HEAD)
  assert.equal(rows[0].face, 'FS Provider')

  await lease.boot(() => record.logHostStart({ world: 'u5a5sfdev1', phase: 'a5sf-read-boot1', suite: 'a5sf-read' }))
  rows = ledgerRows(ledger)
  assert.equal(rows.length, 2, 'the boot row is written even without a per-start human approval')
  assert.equal(rows[1].recordClass, 'DEV-LIVE')
  assert.equal(rows[1].world, 'u5a5sfdev1')
  assert.equal(lease.holdsSlot(), true)

  const outcome = lease.finish({
    overall: 'PASS',
    cases: [{ id: 'read:allowed-inside-ceiling', verdict: 'PASS' }],
    teardown: { homeDeleted: 'tests/homes/u5a5sfdev1', pidKilled: 4242 },
  })
  assert.equal(outcome.kind, 'dev-live-outcome')
  assert.equal(outcome.recordClass, 'DEV-LIVE')
  assert.equal(outcome.teardown.pidKilled, 4242)
  rows = ledgerRows(ledger)
  assert.equal(rows.length, 3)
  assert.equal(lease.holdsSlot(), false, 'finish releases the machine slot')

  // THE RETRY DISCIPLINE LIVES IN THE OPERATOR INSTRUCTION, NOT A COUNT: the
  // same authorisation can open a NEW lease later (no cumulative cap), and the
  // ledger grows instead of refusing.
  const again = await preRegisterDevLiveBudget({
    grantPath,
    headCommit: OTHER,
    runRecord: record,
    face: 'FS Provider',
    world: 'u5a5sfdev1',
    leaseRoot,
  })
  await again.boot(() => record.logHostStart({ world: 'u5a5sfdev1', phase: 'a5sf-read-boot2', suite: 'a5sf-read' }))
  assert.equal(ledgerRows(ledger).length, 5)
  assert.equal(again.holdsSlot(), true)
  again.releaseSlot()
})

test('(b-control) a dev-live record with no slot at the harness chokepoint is refused', async () => {
  const dir = tmp('noslot')
  const leaseRoot = join(dir, 'leases')
  const record = devRecord(dir, { ledger: join(dir, 'ledger.jsonl'), leaseRoot })
  assert.throws(
    () => assertDevLiveSlotHeld({ leaseRoot, runId: record.record.runId }),
    (error) => error instanceof DevLiveSlotError && error.code === 'DEV_LIVE_SLOT_REQUIRED',
  )
})

// ─────────────────────────────────────────────────────────────────────────────
// (c) the 2-concurrent cap refuses a third dev Host
// ─────────────────────────────────────────────────────────────────────────────
test('(c-negative) the (limit+1)th concurrent dev Host is refused; stale (dead-pid) slots are reclaimed', async () => {
  const dir = tmp('slots')
  const leaseRoot = join(dir, 'leases')
  // The NUMBER is not the law, but it is pinned in ONE place: the owner raised it
  // from 2 to 6 on 2026-11-13 after measuring this machine (30 GiB RAM / 16 vCPU,
  // well under 1 GiB per dev Host). Moving it must be a deliberate edit here too.
  assert.equal(DEV_LIVE_SLOT_LIMIT, 6)
  const held = []
  for (let i = 0; i < DEV_LIVE_SLOT_LIMIT; i += 1) {
    held.push(acquireDevLiveSlot({ leaseRoot, runId: `r${String(i)}`, face: 'FS Provider', world: `w${String(i)}` }))
  }
  assert.equal(new Set(held.map((slot) => slot.slot)).size, DEV_LIVE_SLOT_LIMIT, 'every concurrent slot gets its own number')
  assert.equal(scanDevLiveSlots({ leaseRoot }).live.length, DEV_LIVE_SLOT_LIMIT)
  assert.throws(
    () => acquireDevLiveSlot({ leaseRoot, runId: 'over', face: 'FS Provider', world: 'wover' }),
    (error) => error instanceof DevLiveSlotError && error.code === 'DEV_LIVE_LIMIT_REACHED',
  )
  // Release one → the refused call is admitted on retry.
  assert.equal(held[0].release(), true)
  const retried = acquireDevLiveSlot({ leaseRoot, runId: 'over', face: 'FS Provider', world: 'wover' })
  assert.equal(scanDevLiveSlots({ leaseRoot }).live.length, DEV_LIVE_SLOT_LIMIT)
  retried.release()
  for (const slot of held.slice(1)) slot.release()

  // Crash recovery: a slot whose pid is dead IN OUR OWN NAMESPACE is stale once
  // it is older than `DEAD_SLOT_GRACE_MS` (the union law with E1's fix: the
  // judgement is authoritative, but a writer that has not been scheduled since
  // it created the file must not lose it). The fixture is therefore aged past
  // the grace instead of being reclaimed from a just-written file. A bare pid
  // from a file with no `pidNs` is unjudgeable — see the e1 arms below and
  // a5sf-dev-live-slots.test.mjs.
  const deadPid = 999_999
  const deadPath = join(leaseRoot, 'dev-live-hosts', '0.json')
  writeFileSync(deadPath, JSON.stringify({
    slot: 0, token: 'dead', pid: deadPid, pidNs: currentPidNamespace(), startedAt: new Date(0).toISOString(), runId: 'dead', face: 'FS Provider', world: 'wdead', headCommit: HEAD,
  }))
  const aged = new Date(Date.now() - (DEAD_SLOT_GRACE_MS + 60_000))
  utimesSync(deadPath, aged, aged)
  const scan = scanDevLiveSlots({ leaseRoot })
  assert.equal(scan.live.length, 0)
  assert.equal(scan.stale.length, 1)
  assert.equal(scan.stale[0].liveness, 'dead')
  const reclaimed = acquireDevLiveSlot({ leaseRoot, runId: 'reclaim', face: 'FS Provider', world: 'wreclaim' })
  assert.equal(scanDevLiveSlots({ leaseRoot }).live.length, 1)
  reclaimed.release()
})

// ─────────────────────────────────────────────────────────────────────────────
// E1 — a slot is never deleted on liveness this process cannot judge
// ─────────────────────────────────────────────────────────────────────────────
test('(e1-foreign-namespace) a slot written in ANOTHER pid namespace is never swept on liveness, and its owner is not locked out', () => {
  const dir = tmp('e1foreign')
  const leaseRoot = join(dir, 'leases')
  const slotDir = join(leaseRoot, 'dev-live-hosts')
  mkdirSync(slotDir, { recursive: true })
  const own = currentPidNamespace()
  const foreign = own !== null && own !== 'pid:[4026532416]' ? 'pid:[4026532416]' : 'pid:[4026532417]'
  const path = join(slotDir, '0.json')
  writeFileSync(path, JSON.stringify({
    slot: 0, token: 'peer', pid: 999_999, pidNs: foreign, startedAt: new Date().toISOString(), runId: 'peer-run', face: 'Subprocess', world: 'wpeer', headCommit: HEAD,
  }))
  const scan = scanDevLiveSlots({ leaseRoot })
  assert.equal(scan.entries.length, 1)
  assert.equal(scan.entries[0].alive, false, 'the raw pidAlive answer is still recorded')
  assert.equal(scan.entries[0].liveness, 'unknown', 'a pid from another namespace is NOT a verdict')
  assert.equal(scan.stale.length, 0, 'a pid we cannot judge is never evidence of death')
  assert.equal(scan.live.length, 1, 'it keeps its capacity until the cross-namespace grace')
  assert.equal(sweepStaleDevLiveSlot(scan.entries[0]), false, 'the sweep refuses a slot it cannot judge')
  assert.equal(existsSync(path), true, "the peer's slot file survived")
  // The peer's own boot chokepoint check passes: it is counted as live.
  const held = assertDevLiveSlotHeld({ leaseRoot, runId: 'peer-run', pid: 999_999 })
  assert.equal(held.slot, 0)
  // A NEW boot takes a DIFFERENT slot: the foreign slot is not stolen.
  const mine = acquireDevLiveSlot({ leaseRoot, runId: 'mine', face: 'Subprocess', world: 'wmine' })
  assert.notEqual(mine.slot, 0)
  assert.equal(scanDevLiveSlots({ leaseRoot }).live.length, 2)
  mine.release()
  // A legacy slot (no `pidNs`) is equally unjudgeable — the same rule, so an
  // old-code peer is never the victim of a new-code sweep while it is fresh.
  writeFileSync(path, JSON.stringify({
    slot: 0, token: 'legacy', pid: 999_999, startedAt: new Date().toISOString(), runId: 'legacy-run', face: 'Subprocess', world: 'wlegacy', headCommit: HEAD,
  }))
  const legacy = scanDevLiveSlots({ leaseRoot })
  assert.equal(legacy.entries[0].liveness, 'unknown')
  assert.equal(legacy.stale.length, 0)
})

test('(e1-same-namespace) a provably dead pid is swept only after the write grace, and never after a token change', () => {
  const dir = tmp('e1dead')
  const leaseRoot = join(dir, 'leases')
  const slotDir = join(leaseRoot, 'dev-live-hosts')
  mkdirSync(slotDir, { recursive: true })
  const path = join(slotDir, '0.json')
  writeFileSync(path, JSON.stringify({
    slot: 0, token: 't1', pid: 999_999, pidNs: currentPidNamespace(), startedAt: new Date().toISOString(), runId: 'r1', face: 'Subprocess', world: 'w1', headCommit: HEAD,
  }))
  // Fresh write: dead, but inside the grace window → NOT stale (a writer that
  // has not yet been scheduled must not lose its own slot).
  const fresh = scanDevLiveSlots({ leaseRoot })
  assert.equal(fresh.entries[0].liveness, 'dead')
  assert.equal(fresh.stale.length, 0, 'inside DEAD_SLOT_GRACE_MS nothing is swept')
  // Past the grace window the same slot IS stale and IS swept.
  const later = Date.now() + DEAD_SLOT_GRACE_MS + 1_000
  const agedScan = scanDevLiveSlots({ leaseRoot, now: later })
  assert.equal(agedScan.stale.length, 1)
  assert.equal(sweepStaleDevLiveSlot(agedScan.entries[0], { now: later }), true, 'the sweep re-reads and re-classifies with the same clock')
  assert.equal(existsSync(path), false)
  // Token re-check: a slot re-written by a peer after our scan is not ours to
  // delete, even when the entry we classified is stale.
  writeFileSync(path, JSON.stringify({
    slot: 0, token: 't2', pid: 999_999, pidNs: currentPidNamespace(), startedAt: new Date().toISOString(), runId: 'r2', face: 'Subprocess', world: 'w2', headCommit: HEAD,
  }))
  const pre = scanDevLiveSlots({ leaseRoot, now: Date.now() + DEAD_SLOT_GRACE_MS + 2_000 })
  writeFileSync(path, JSON.stringify({
    slot: 0, token: 't3', pid: process.pid, pidNs: currentPidNamespace(), startedAt: new Date().toISOString(), runId: 'r3', face: 'Subprocess', world: 'w3', headCommit: HEAD,
  }))
  assert.equal(sweepStaleDevLiveSlot(pre.entries[0], { now: Date.now() + DEAD_SLOT_GRACE_MS + 2_000 }), false, 'a changed token means a new owner')
  assert.equal(existsSync(path), true)
  assert.equal(JSON.parse(readFileSync(path, 'utf8')).token, 't3')
})

test('(c-lease) the cap applies through the dev-live gate, not just the counter', async () => {
  const dir = tmp('leasecap')
  const leaseRoot = join(dir, 'leases')
  const grantPath = grantFile(dir, DEV_GRANT)
  const bootStub = (record) => () => record.logHostStart({ world: 'u5a5sfdev1', phase: 'boot', suite: 'a5sf-read' })
  const leased = []
  for (let i = 0; i < DEV_LIVE_SLOT_LIMIT; i += 1) {
    const record = devRecord(dir, { ledger: join(dir, `r${String(i)}.jsonl`), leaseRoot })
    const lease = await preRegisterDevLiveBudget({ grantPath, headCommit: HEAD, runRecord: record, face: 'FS Provider', world: 'u5a5sfdev1', leaseRoot })
    await lease.boot(bootStub(record))
    leased.push(record)
  }
  const over = devRecord(dir, { ledger: join(dir, 'over.jsonl'), leaseRoot })
  const refused = await preRegisterDevLiveBudget({ grantPath, headCommit: HEAD, runRecord: over, face: 'FS Provider', world: 'u5a5sfdev1', leaseRoot })
  await assert.rejects(
    () => refused.boot(bootStub(over)),
    (error) => error instanceof DevLiveSlotError && error.code === 'DEV_LIVE_LIMIT_REACHED',
  )
  assert.equal(ledgerRows(join(dir, 'over.jsonl')).length, 1, 'the refused boot wrote only its intent row, never a start row')
})

// ─────────────────────────────────────────────────────────────────────────────
// (d) scope separation: the C2 path is not weakened
// ─────────────────────────────────────────────────────────────────────────────
test('(d-negative) a dev-live grant cannot pay for a CANDIDATE-C2 run', async () => {
  const dir = tmp('scope1')
  const grantPath = grantFile(dir, DEV_GRANT)
  const ledger = join(dir, 'ledger.jsonl')
  const record = c2Record(dir, { ledger })
  await assert.rejects(
    () => preRegisterReadBudget({ grantPath, headCommit: HEAD, runRecord: record }),
    (error) => error instanceof A5sfReadGateError && error.code === 'BUDGET_NOT_GRANTED' && error.reason === 'GRANT_SCOPE_MISMATCH',
  )
  assert.equal(ledgerRows(ledger).length, 0, 'a refused scope mismatch writes nothing')
})

test('(d-negative) a CANDIDATE-C2 grant cannot authorise a dev boot', async () => {
  const dir = tmp('scope2')
  const grantPath = grantFile(dir, C2_GRANT)
  const record = devRecord(dir, { ledger: join(dir, 'ledger.jsonl'), leaseRoot: join(dir, 'leases') })
  await assert.rejects(
    () => preRegisterDevLiveBudget({ grantPath, headCommit: HEAD, runRecord: record, face: 'FS Provider', world: 'u5a5sfdev1' }),
    (error) => error instanceof A5sfReadGateError && error.reason === 'GRANT_SCOPE_MISMATCH',
  )
})

test('(d-negative) the record class must match the grant scope', async () => {
  const dir = tmp('class')
  const devGrant = grantFile(dir, DEV_GRANT)
  const c2 = c2Record(dir, { ledger: join(dir, 'ledger.jsonl') })
  await assert.rejects(
    () => preRegisterDevLiveBudget({ grantPath: devGrant, headCommit: HEAD, runRecord: c2, face: 'FS Provider', world: 'u5a5sfdev1', leaseRoot: join(dir, 'leases') }),
    (error) => error instanceof A5sfReadGateError && error.reason === 'RECORD_CLASS_MISMATCH',
  )
  const dir2 = tmp('class2')
  const c2Grant = grantFile(dir2, C2_GRANT)
  const dev = devRecord(dir2, { ledger: join(dir2, 'ledger.jsonl'), leaseRoot: join(dir2, 'leases') })
  await assert.rejects(
    () => preRegisterReadBudget({ grantPath: c2Grant, headCommit: HEAD, runRecord: dev }),
    (error) => error instanceof A5sfReadGateError && error.reason === 'RECORD_CLASS_MISMATCH',
  )
})

test('(d-negative) a dev-live authorisation does not widen to another face or world', async () => {
  const dir = tmp('face')
  const grantPath = grantFile(dir, DEV_GRANT)
  const record = devRecord(dir, { ledger: join(dir, 'ledger.jsonl'), leaseRoot: join(dir, 'leases') })
  await assert.rejects(
    () => preRegisterDevLiveBudget({ grantPath, headCommit: HEAD, runRecord: record, face: 'Web', world: 'u5a5sfdev1', leaseRoot: join(dir, 'leases') }),
    (error) => error instanceof A5sfReadGateError && error.reason === 'GRANT_FACE_MISMATCH',
  )
  await assert.rejects(
    () => preRegisterDevLiveBudget({ grantPath, headCommit: HEAD, runRecord: record, face: 'FS Provider', world: 'somebody-elses-world', leaseRoot: join(dir, 'leases') }),
    (error) => error instanceof A5sfReadGateError && error.reason === 'GRANT_WORLD_MISMATCH',
  )
})

test('(d-compat) a pre-2026-11-09 grant (no scope field) still reads as the per-run C2 grant', () => {
  const dir = tmp('compat')
  const parsed = readBudgetGrant(grantFile(dir, C2_GRANT))
  assert.equal(parsed.ok, true)
  assert.equal(parsed.grant.scope, 'CANDIDATE-C2')
  assert.equal(parsed.grant.maxStarts, 2)
  assert.equal(parsed.grant.boundCommit, HEAD)
})
