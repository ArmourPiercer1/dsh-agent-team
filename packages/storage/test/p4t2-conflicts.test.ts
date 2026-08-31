/**
 * p4t2-conflicts — the journal's failure and idempotency disciplines:
 *
 * - GENERATION CAS (mandatory P4-T2 test): `expectedGeneration` (0 = expect
 *   absent) vs the durable row → `stale-generation`, checked BEFORE any
 *   write and before the idempotency-identity check;
 * - IDEMPOTENCY CONFLICT: same operationId with a different idempotency
 *   key or a different canonical intent → `idempotency-conflict` (never a
 *   silent re-prepare);
 * - DUPLICATE LEDGER PREVENTION (mandatory P4-T2 test): re-driving a
 *   committed operation reuses the existing fact — exactly ONE fact per
 *   operationId, no sequence re-write, no gap creation, the original fact
 *   bytes are byte-stable;
 * - terminal immutability (`terminal-operation`), the staged child-session
 *   window (`child-session-conflict`), `operation-not-found`, effect error
 *   classification (typed pass-through vs `unclassified-effect-error`) and
 *   cross-team fact conflicts — and that EVERY conflict path performs zero
 *   writes.
 *
 * @module @dsh-agent-team/storage/test/p4t2-conflicts
 */

import { describe, expect, it } from 'vitest'

import { TEAM_DOMAIN_NAME, serializeOperationRecord, teamDomainError } from '../schema/index.js'
import { createOperationJournal } from '../operations/index.js'
import { InMemoryStorageSeam, P4_FIXTURE, asTeamDomainError, capture, detail } from './p4-helpers.js'
import { P4T2_PROVISION, createP4t2Journal, isSeamFailure, provisioningEffects, provisionRequest } from './p4t2-helpers.js'

const OP1 = P4T2_PROVISION.operationId
const OP2 = 'op-p4t2prov02'
const OP3 = 'op-p4t2prov03'
const P3_PAYLOAD = { childSessionId: 'session-child-2', instanceId: 'inst-beta' }

// ---------------------------------------------------------------- the world

const seam = new InMemoryStorageSeam()
const world = await createP4t2Journal(seam)
const journal = world.journal
const ledger = world.repositories.ledger
const root = P4_FIXTURE.rootSessionId

const r1 = await journal.execute(provisionRequest())
const factRow1Before = seam.rawRows(TEAM_DOMAIN_NAME, 'ledger').get('1')
const afterCommit1 = seam.writeCount

// ------------------------------------------------------------- generation CAS

const stale1 = await capture(() => journal.execute(provisionRequest(), { expectedGeneration: 1 }))
const stale2 = await capture(() => journal.drive(OP1, { expectedGeneration: 1 }))

const req2 = provisionRequest({ operationId: OP2, idempotencyKey: 'p4t2-provision-beta' })
const stale3 = await capture(() => journal.execute(req2, { expectedGeneration: 1 }))
const r2 = await journal.execute(req2, { expectedGeneration: 0 })
const afterCommit2 = seam.writeCount

const staleOk = await capture(() => journal.drive(OP2, { expectedGeneration: 2 }))
const stale4 = await capture(() => journal.drive(OP2, { expectedGeneration: 3 }))

// -------------------------------------------------------- idempotency conflicts

const beforeConflicts = seam.writeCount
const confKey = await capture(() => journal.execute(provisionRequest({ idempotencyKey: 'p4t2-provision-other' })))
const confIntent = await capture(() =>
  journal.execute(provisionRequest({ payload: { childSessionId: 'session-child-1', instanceId: 'inst-alpha', extra: 'x' } })),
)
const confOrdering = await capture(() => journal.execute(provisionRequest({ idempotencyKey: 'other' }), { expectedGeneration: 0 }))
const afterConflicts = seam.writeCount

// ---------------------------------------------------- terminal immutability (1)

const termChild = await capture(() => journal.recordChildSession(OP1, P4_FIXTURE.secondChildSessionId))
const termFail = await capture(() => journal.fail(OP1, 'late-failure'))
const termExec = await capture(() => journal.execute(provisionRequest({ childSessionId: P4_FIXTURE.secondChildSessionId })))
const afterTerminal = seam.writeCount

// -------------------------------------------------- staged child-session window

const req3 = provisionRequest({ operationId: OP3, idempotencyKey: 'p4t2-provision-gamma', payload: P3_PAYLOAD })
const pre3 = await journal.prepare(req3)
const afterPre3 = seam.writeCount
const pre3Again = await journal.prepare(req3)
const child3 = await journal.recordChildSession(OP3, P4_FIXTURE.secondChildSessionId)
const afterChild3 = seam.writeCount
const child3Again = await journal.recordChildSession(OP3, P4_FIXTURE.secondChildSessionId)
const childConflict = await capture(() => journal.recordChildSession(OP3, P4_FIXTURE.childSessionId))
const childPrepareConflict = await capture(() =>
  journal.prepare(provisionRequest({ operationId: OP3, idempotencyKey: 'p4t2-provision-gamma', payload: P3_PAYLOAD, childSessionId: P4_FIXTURE.childSessionId })),
)
const r3 = await journal.drive(OP3)
const afterDrive3 = seam.writeCount
const reExec3 = await journal.execute(
  provisionRequest({ operationId: OP3, idempotencyKey: 'p4t2-provision-gamma', payload: P3_PAYLOAD, childSessionId: P4_FIXTURE.secondChildSessionId }),
)
const lastApplied3 = journal.lastApplied()

// ---------------------------------------------------------- operation-not-found

const nfDrive = await capture(() => journal.drive('op-missing01'))
const nfFail = await capture(() => journal.fail('op-missing01', 'boom'))
const nfChild = await capture(() => journal.recordChildSession('op-missing01', P4_FIXTURE.childSessionId))
const nfGet = journal.get('op-missing01')

// ---------------------------------------------------------- effect classification

const seamB = new InMemoryStorageSeam()
const worldB = await createP4t2Journal(seamB, root, undefined)
const boomEffect = {
  name: 'boom',
  apply: async () => {
    throw new Error('kaboom')
  },
}
const journalBoom = createOperationJournal(worldB, root, () => [boomEffect])
const reqFx1 = provisionRequest({ operationId: 'op-p4t2fx01', idempotencyKey: 'p4t2-fx-alpha' })
const bad1 = await capture(() => journalBoom.execute(reqFx1))
const fxRowAfterBad = worldB.repositories.operations.get('op-p4t2fx01')
const fxEntryAfterBad = worldB.repositories.ledger.entryCount()
const journalGood = createOperationJournal(worldB, root, provisioningEffects())
const good1 = await journalGood.drive('op-p4t2fx01')
const journalTyped = createOperationJournal(worldB, root, () => [
  {
    name: 'typed',
    apply: async () => {
      throw teamDomainError('RECORD_DUPLICATE', 'typed effect conflict', { store: 'session_bindings', key: 'session-child-9', problem: 'session-already-bound' })
    },
  },
])
const reqFx2 = provisionRequest({ operationId: 'op-p4t2fx02', idempotencyKey: 'p4t2-fx-beta' })
const typed1 = await capture(() => journalTyped.execute(reqFx2))
const good2 = await journalGood.drive('op-p4t2fx02')

// ------------------------------------------------------------------- cross-team

const seamC = new InMemoryStorageSeam()
const worldC = await createP4t2Journal(seamC, root, provisioningEffects())
const journalC1 = worldC.journal
const journalC2 = createOperationJournal(worldC, P4_FIXTURE.otherRootSessionId, provisioningEffects())
const crossReq = provisionRequest({ operationId: 'op-p4t2xteam1', idempotencyKey: 'p4t2-cross-team' })
const ca1 = await journalC1.execute(crossReq)
const cb1 = await capture(() => journalC2.execute(crossReq))
const cb2 = await capture(() => journalC2.drive('op-p4t2xteam1'))
const lastAppliedC2 = journalC2.lastApplied()

// ------------------------------------------------------------------ asserts

describe('p4t2 conflicts: generation CAS (mandatory)', () => {
  it('a stale expectedGeneration on the committed operation fails with stale-generation', () => {
    expect(stale1.ok).toBe(false)
    const error = asTeamDomainError(stale1.error)
    expect(error.code).toBe('RECORD_INVALID')
    expect(detail(error, 'problem')).toBe('stale-generation')
    expect(detail(error, 'expected')).toBe(1)
    expect(detail(error, 'found')).toBe(2)
  })

  it('drive with a stale expectedGeneration fails the same way', () => {
    expect(stale2.ok).toBe(false)
    const error = asTeamDomainError(stale2.error)
    expect(error.code).toBe('RECORD_INVALID')
    expect(detail(error, 'problem')).toBe('stale-generation')
    expect(detail(error, 'found')).toBe(2)
  })

  it('expectedGeneration 1 on a FRESH operation fails (the row is absent)', () => {
    expect(stale3.ok).toBe(false)
    const error = asTeamDomainError(stale3.error)
    expect(detail(error, 'problem')).toBe('stale-generation')
    expect(detail(error, 'expected')).toBe(1)
    expect(detail(error, 'found')).toBe(null)
  })

  it('expectedGeneration 0 on a fresh operation succeeds (the CAS for first prepare)', () => {
    expect(r2.phase).toBe('COMMITTED')
    expect(r2.effectsApplied).toBe(0)
    expect(r2.effectsSkipped).toBe(2)
    expect(r2.ledgerSequence).toBe(2)
    // G8-S1: counter bump, fact, generation-stamp advance, COMMITTED row
    expect(afterCommit2 - afterCommit1).toBe(5)
  })

  it('matching and further-stale expectedGeneration on the second operation', () => {
    expect(staleOk.ok).toBe(true)
    expect(staleOk.value?.phase).toBe('COMMITTED')
    expect(staleOk.value?.ledgerSequence).toBe(2)
    expect(stale4.ok).toBe(false)
    const error = asTeamDomainError(stale4.error)
    expect(detail(error, 'problem')).toBe('stale-generation')
    expect(detail(error, 'expected')).toBe(3)
    expect(detail(error, 'found')).toBe(2)
  })
})

describe('p4t2 conflicts: idempotency identity', () => {
  it('same operationId with a different idempotency key fails with idempotency-conflict', () => {
    expect(confKey.ok).toBe(false)
    const error = asTeamDomainError(confKey.error)
    expect(error.code).toBe('RECORD_DUPLICATE')
    expect(detail(error, 'problem')).toBe('idempotency-conflict')
    expect(detail(error, 'expected')).toBe('p4t2-provision-alpha')
    expect(detail(error, 'found')).toBe('p4t2-provision-other')
  })

  it('same operationId with a different canonical intent fails with idempotency-conflict', () => {
    expect(confIntent.ok).toBe(false)
    const error = asTeamDomainError(confIntent.error)
    expect(error.code).toBe('RECORD_DUPLICATE')
    expect(detail(error, 'problem')).toBe('idempotency-conflict')
    expect(detail(error, 'intentChanged')).toBe(true)
  })

  it('the generation CAS is checked before the identity checks (stale-generation wins)', () => {
    expect(confOrdering.ok).toBe(false)
    const error = asTeamDomainError(confOrdering.error)
    expect(detail(error, 'problem')).toBe('stale-generation')
  })

  it('every conflict path performed zero writes', () => {
    expect(afterConflicts).toBe(beforeConflicts)
  })
})

describe('p4t2 conflicts: duplicate ledger prevention (mandatory)', () => {
  it('exactly one fact per operation, no gap, counter row excluded from entries', () => {
    expect(ledger.entryCount()).toBe(3)
    expect(ledger.gaps()).toEqual([])
    expect(ledger.get(1)?.operationId).toBe(OP1)
    expect(ledger.get(2)?.operationId).toBe(OP2)
    expect(ledger.get(3)?.operationId).toBe(OP3)
    const ops = [...ledger.list()].filter((f) => f.operationId === OP1)
    expect(ops.length).toBe(1)
  })

  it('the first operation fact is byte-stable across all later drives and conflicts', () => {
    expect(seam.rawRows(TEAM_DOMAIN_NAME, 'ledger').get('1')).toBe(factRow1Before)
  })

  it('raw ledger keys are exactly the three facts plus the counter row', () => {
    expect([...seam.rawRows(TEAM_DOMAIN_NAME, 'ledger').keys()].sort()).toEqual(['1', '2', '3', '__ledger_sequence_counter'])
  })
})

describe('p4t2 conflicts: terminal immutability', () => {
  it('recordChildSession / fail / execute with a new child on a COMMITTED operation all fail with terminal-operation', () => {
    for (const result of [termChild, termFail, termExec]) {
      expect(result.ok).toBe(false)
      const error = asTeamDomainError(result.error)
      expect(error.code).toBe('RECORD_DUPLICATE')
      expect(detail(error, 'problem')).toBe('terminal-operation')
      expect(detail(error, 'phase')).toBe('COMMITTED')
    }
  })

  it('terminal rejections performed zero writes', () => {
    expect(afterTerminal).toBe(afterConflicts)
  })
})

describe('p4t2 conflicts: staged child-session window', () => {
  it('prepare (no child) then recordChildSession then drive rolls forward to COMMITTED', () => {
    expect(pre3.phase).toBe('PREPARED')
    expect(pre3.generation).toBe(1)
    expect(pre3.childSessionId).toBe(undefined)
    expect(afterPre3).toBe(afterCommit2 + 1)
    expect(serializeOperationRecord(pre3Again)).toBe(serializeOperationRecord(pre3))
    expect(child3.phase).toBe('PREPARED')
    expect(child3.generation).toBe(2)
    expect(String(child3.childSessionId)).toBe('session-child-2')
    expect(afterChild3).toBe(afterPre3 + 1)
    expect(serializeOperationRecord(child3Again)).toBe(serializeOperationRecord(child3))
    expect(r3.phase).toBe('COMMITTED')
    expect(r3.effectsApplied).toBe(2)
    expect(r3.effectsSkipped).toBe(0)
    expect(r3.ledgerSequence).toBe(3)
    // G8-S1: member, binding, counter bump, fact, generation-stamp advance, COMMITTED row
    expect(afterDrive3).toBe(afterChild3 + 6)
    expect(lastApplied3).toBe(OP3)
  })

  it('a different recorded child fails with child-session-conflict (recordChildSession and prepare alike)', () => {
    expect(childConflict.ok).toBe(false)
    const error = asTeamDomainError(childConflict.error)
    expect(error.code).toBe('RECORD_DUPLICATE')
    expect(detail(error, 'problem')).toBe('child-session-conflict')
    expect(detail(error, 'expected')).toBe('session-child-2')
    expect(detail(error, 'found')).toBe('session-child-1')
    expect(childPrepareConflict.ok).toBe(false)
    const error2 = asTeamDomainError(childPrepareConflict.error)
    expect(detail(error2, 'problem')).toBe('child-session-conflict')
  })

  it('re-executing the full staged request after COMMITTED is a no-op on the same durable result', () => {
    expect(reExec3.phase).toBe('COMMITTED')
    expect(reExec3.effectsApplied).toBe(0)
    expect(reExec3.ledgerSequence).toBe(3)
    expect(seam.writeCount).toBe(afterDrive3)
  })
})

describe('p4t2 conflicts: operation-not-found', () => {
  it('drive / fail / recordChildSession on an absent operation fail with operation-not-found', () => {
    for (const result of [nfDrive, nfFail, nfChild]) {
      expect(result.ok).toBe(false)
      const error = asTeamDomainError(result.error)
      expect(error.code).toBe('RECORD_INVALID')
      expect(detail(error, 'problem')).toBe('operation-not-found')
    }
    expect(nfGet).toBe(undefined)
  })
})

describe('p4t2 conflicts: effect error classification', () => {
  it('an untyped effect error becomes SEAM_FAILURE/unclassified-effect-error and the row stays PREPARED', () => {
    expect(bad1.ok).toBe(false)
    const error = bad1.error
    expect(isSeamFailure(error)).toBe(true)
    const td = asTeamDomainError(error)
    expect(detail(td, 'problem')).toBe('unclassified-effect-error')
    expect(detail(td, 'effect')).toBe('boom')
    expect(fxRowAfterBad?.phase).toBe('PREPARED')
    expect(fxEntryAfterBad).toBe(0)
  })

  it('re-driving the same operation through a healthy effect set converges to COMMITTED', () => {
    expect(good1.phase).toBe('COMMITTED')
    expect(good1.effectsApplied).toBe(2)
    expect(good1.ledgerSequence).toBe(1)
  })

  it('a typed TeamDomainError from an effect passes through UNWRAPPED', () => {
    expect(typed1.ok).toBe(false)
    const error = asTeamDomainError(typed1.error)
    expect(error.code).toBe('RECORD_DUPLICATE')
    expect(detail(error, 'problem')).toBe('session-already-bound')
    expect(detail(error, 'store')).toBe('session_bindings')
  })

  it('the typed-failure operation also converges on re-drive (skipping already-applied targets)', () => {
    expect(good2.phase).toBe('COMMITTED')
    expect(good2.effectsApplied).toBe(0)
    expect(good2.effectsSkipped).toBe(2)
    expect(good2.ledgerSequence).toBe(2)
  })
})

describe('p4t2 conflicts: cross-team fact conflict', () => {
  it('team A commits the shared operationId first', () => {
    expect(ca1.phase).toBe('COMMITTED')
    expect(ca1.ledgerSequence).toBe(1)
  })

  it('team B re-submitting the same request fails with idempotency-conflict (foreign fact)', () => {
    expect(cb1.ok).toBe(false)
    const error = asTeamDomainError(cb1.error)
    expect(error.code).toBe('RECORD_DUPLICATE')
    expect(detail(error, 'problem')).toBe('idempotency-conflict')
    expect(detail(error, 'expected')).toBe('session-root-2')
    expect(detail(error, 'found')).toBe('session-root-1')
    expect(cb2.ok).toBe(false)
    const error2 = asTeamDomainError(cb2.error)
    expect(detail(error2, 'problem')).toBe('idempotency-conflict')
    expect(lastAppliedC2).toBe(undefined)
  })
})

describe('p4t2 conflicts: the protocol never deletes', () => {
  it('no delete operation was ever issued on the team_domain sidecar', () => {
    expect(seam.writeLog.every((entry) => entry.op !== 'delete')).toBe(true)
    expect(seamB.writeLog.every((entry) => entry.op !== 'delete')).toBe(true)
    expect(seamC.writeLog.every((entry) => entry.op !== 'delete')).toBe(true)
  })
})
