/**
 * p4-06 — operations (append-only journal) and ledger (append-only fact
 * stream) stores.
 *
 * Operations: idempotent phase progression under one idempotency key
 * (PREPARED → COMMITTED), terminal-phase immutability, idempotency
 * conflicts, strict generation monotonicity. Ledger: atomic sequence
 * allocation, unallocated/out-of-range sequence rejection, gap tolerance
 * with crash recovery (roll-forward via `gaps()`), counter-row exclusion
 * from entry views.
 *
 * @module @dsh-agent-team/storage/test/p4-06-journal
 */

import { describe, expect, it } from 'vitest'

import { TEAM_DOMAIN_NAME } from '../schema/index.js'
import { serializeOperationRecord } from '../schema/index.js'
import { createTeamDomain, openTeamDomain } from '../repositories/index.js'
import { InMemoryStorageSeam, P4_FIXTURE, asTeamDomainError, capture, detail, ledgerEntryRecord, operationRecord, teamSessionInput } from './p4-helpers.js'

// G8-S1 (R60): a new ledger fact also advances the TeamSession's generation
// stamp, and a fact for a missing team row is a loud SEAM_FAILURE (invariant:
// facts belong to an existing team). Every world below therefore seeds the
// fixture team row before any ledger fact is put.
const seam = new InMemoryStorageSeam()
const domain = await createTeamDomain(seam)
await domain.repositories.teamSessions.put(teamSessionInput())
const ops = domain.repositories.operations
const ledger = domain.repositories.ledger
const root = P4_FIXTURE.rootSessionId

const roundTrip = await ops.put(operationRecord('op-rt', 'idem-rt'))
const badOpId = await capture(() => ops.put(operationRecord('op-XYZ!', 'idem-x')))
const failedNoDiag = await capture(() => ops.put(operationRecord('op-b', 'idem-b', { phase: 'FAILED' })))
const committedWithDiag = await capture(() =>
  ops.put(operationRecord('op-c', 'idem-c', { phase: 'COMMITTED', failureDiagnostic: 'boom' })),
)

const prepared = await ops.put(operationRecord('op-alpha', 'idem-1'))
const gen2 = await capture(() => ops.put(operationRecord('op-alpha', 'idem-1', { generation: 2 })))
const committed = await capture(() => ops.put(operationRecord('op-alpha', 'idem-1', { generation: 3, phase: 'COMMITTED' })))
const afterTerminal = await capture(() =>
  ops.put(operationRecord('op-alpha', 'idem-1', { generation: 4, phase: 'FAILED', failureDiagnostic: 'late' })),
)

await ops.put(operationRecord('op-d', 'idem-d', { generation: 1 }))
const idemConflict = await capture(() => ops.put(operationRecord('op-d', 'idem-diff', { generation: 2 })))

const badChild = await capture(() => ops.put(operationRecord('op-e', 'idem-e', { childSessionId: 'Child Bad' })))

const s1 = await ledger.allocateSequence()
const s2 = await ledger.allocateSequence()
const s3 = await ledger.allocateSequence()
const entry1 = await ledger.put(ledgerEntryRecord(1, String(root)))
const entry2 = await ledger.put(ledgerEntryRecord(2, String(root), { operationId: 'op-alpha' }))
const ledgerList = ledger.list()
const ledgerRawKeys = [...seam.rawRows(TEAM_DOMAIN_NAME, 'ledger').keys()].sort()
const ledgerCount = ledger.entryCount()
const ledgerGaps = ledger.gaps()

const seamFresh = new InMemoryStorageSeam()
const freshDomain = await createTeamDomain(seamFresh)
await freshDomain.repositories.teamSessions.put(teamSessionInput())
const freshLedger = freshDomain.repositories.ledger
const putBeforeAlloc = await capture(() => freshLedger.put(ledgerEntryRecord(1, String(root))))
const f1 = await freshLedger.allocateSequence()
const unallocated = await capture(() => freshLedger.put(ledgerEntryRecord(2, String(root))))
const f2 = await freshLedger.allocateSequence()
await freshLedger.put(ledgerEntryRecord(2, String(root)))
await freshLedger.put(ledgerEntryRecord(1, String(root)))
const dupSeq = await capture(() => freshLedger.put(ledgerEntryRecord(1, String(root), { payload: { other: true } })))

const seamGap = new InMemoryStorageSeam()
const gapDomain = await createTeamDomain(seamGap)
await gapDomain.repositories.teamSessions.put(teamSessionInput())
const gapLedger = gapDomain.repositories.ledger
await gapLedger.allocateSequence()
await gapLedger.allocateSequence()
await gapLedger.allocateSequence()
await gapLedger.put(ledgerEntryRecord(1, String(root)))
seamGap.setCrashAfterWrites(seamGap.writeCount)
const gapCrash = await capture(() => gapLedger.put(ledgerEntryRecord(2, String(root))))
seamGap.clearCrash()
await gapDomain.close()
const gapReopened = await openTeamDomain(seamGap)
const gapsAfter = gapReopened.repositories.ledger.gaps()
await gapReopened.repositories.ledger.put(ledgerEntryRecord(2, String(root)))
await gapReopened.repositories.ledger.put(ledgerEntryRecord(3, String(root)))
const gapsFilled = gapReopened.repositories.ledger.gaps()

describe('p4-06 operations + ledger stores', () => {
  it('a PREPARED operation round-trips at the operationId key', () => {
    expect(roundTrip.operationId).toBe('op-rt')
    expect(roundTrip.phase).toBe('PREPARED')
    expect(roundTrip.schemaVersion).toBe(1)
    expect(ops.get('op-rt')).toEqual(roundTrip)
    expect(seam.rawRows(TEAM_DOMAIN_NAME, 'operations').get('op-rt')).toBe(serializeOperationRecord(roundTrip))
  })

  it('an invalid operationId is rejected with bad-operation-id', () => {
    expect(badOpId.ok).toBe(false)
    const error = asTeamDomainError(badOpId.error)
    expect(error.code).toBe('RECORD_INVALID')
    expect(detail(error, 'problem')).toBe('bad-operation-id')
  })

  it('a FAILED operation without failureDiagnostic is rejected', () => {
    expect(failedNoDiag.ok).toBe(false)
    const error = asTeamDomainError(failedNoDiag.error)
    expect(error.code).toBe('RECORD_INVALID')
    expect(detail(error, 'problem')).toBe('failureDiagnostic-required-for-failed')
  })

  it('a COMMITTED operation with failureDiagnostic is rejected', () => {
    expect(committedWithDiag.ok).toBe(false)
    const error = asTeamDomainError(committedWithDiag.error)
    expect(error.code).toBe('RECORD_INVALID')
    expect(detail(error, 'problem')).toBe('failureDiagnostic-forbidden-outside-failed')
  })

  it('phase progression under one idempotency key ends in a terminal-immutable operation', () => {
    expect(prepared.phase).toBe('PREPARED')
    expect(gen2.ok).toBe(true)
    expect(committed.ok).toBe(true)
    expect(committed.value?.phase).toBe('COMMITTED')
    expect(afterTerminal.ok).toBe(false)
    const error = asTeamDomainError(afterTerminal.error)
    expect(error.code).toBe('RECORD_DUPLICATE')
    expect(detail(error, 'problem')).toBe('terminal-operation')
    expect(detail(error, 'phase')).toBe('COMMITTED')
  })

  it('a different idempotency key for the same operation raises idempotency-conflict', () => {
    expect(idemConflict.ok).toBe(false)
    const error = asTeamDomainError(idemConflict.error)
    expect(error.code).toBe('RECORD_DUPLICATE')
    expect(detail(error, 'problem')).toBe('idempotency-conflict')
    expect(detail(error, 'expected')).toBe('idem-d')
    expect(detail(error, 'found')).toBe('idem-diff')
  })

  it('an invalid childSessionId is rejected with INVALID_CHILD_SESSION_ID', () => {
    expect(badChild.ok).toBe(false)
    const error = asTeamDomainError(badChild.error)
    expect(error.code).toBe('RECORD_INVALID')
    expect(detail(error, 'contractsCode')).toBe('INVALID_CHILD_SESSION_ID')
  })

  it('allocateSequence returns strictly increasing sequences 1, 2, 3', () => {
    expect([s1, s2, s3]).toEqual([1, 2, 3])
  })

  it('ledger entries round-trip at their sequence keys', () => {
    expect(ledger.get(1)).toEqual(entry1)
    expect(ledger.get(2)).toEqual(entry2)
    expect(entry2.operationId).toBe('op-alpha')
    expect(ledger.get(3)).toBe(undefined)
  })

  it('a ledger put before any allocation is rejected with sequence-not-allocated', () => {
    expect(putBeforeAlloc.ok).toBe(false)
    const error = asTeamDomainError(putBeforeAlloc.error)
    expect(error.code).toBe('RECORD_INVALID')
    expect(detail(error, 'problem')).toBe('sequence-not-allocated')
  })

  it('an unallocated sequence is rejected, may be filled after allocation, and duplicates are rejected', () => {
    expect([f1, f2]).toEqual([1, 2])
    expect(unallocated.ok).toBe(false)
    const error = asTeamDomainError(unallocated.error)
    expect(error.code).toBe('RECORD_INVALID')
    expect(detail(error, 'problem')).toBe('unallocated-sequence')
    expect(detail(error, 'counter')).toBe(1)
    expect(detail(error, 'found')).toBe(2)
    expect(dupSeq.ok).toBe(false)
    const dupError = asTeamDomainError(dupSeq.error)
    expect(dupError.code).toBe('RECORD_DUPLICATE')
    expect(detail(dupError, 'problem')).toBe('duplicate-ledger-entry')
  })

  it('a crash after allocation leaves gaps that are diagnosed and can be filled (roll-forward)', () => {
    expect(gapCrash.ok).toBe(false)
    expect(asTeamDomainError(gapCrash.error).code).toBe('SEAM_FAILURE')
    expect(gapsAfter).toEqual([2, 3])
    expect(gapsFilled).toEqual([])
  })

  it('the counter row is excluded from entry views; keys are decimal strings', () => {
    expect(ledgerList.length).toBe(2)
    expect(ledgerList.map((e) => e.sequence)).toEqual([1, 2])
    expect(ledgerRawKeys).toEqual(['1', '2', '__ledger_sequence_counter'])
    expect(ledgerCount).toBe(2)
    expect(ledgerGaps).toEqual([3])
  })
})
