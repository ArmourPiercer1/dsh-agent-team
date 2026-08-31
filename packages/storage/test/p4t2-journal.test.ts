/**
 * p4t2-journal — the OperationJournal happy path and RETRY SAME OPERATION
 * (mandatory P4-T2 test): PREPARED → effects → ledger → COMMITTED once,
 * then every re-submission of the same request (same operationId,
 * idempotency key, canonical intent) converges to the SAME durable result
 * with zero additional writes and exactly one ledger fact
 * (Development Plan §17.3 "重复执行收敛到同一 durable result").
 *
 * Also covers: `lastApplied()` / `factSequence()` (the
 * lastAppliedOperationId view = the fact's operationId link), `get`/`list`,
 * the effects-less journal, and TEAM scoping (a second team's journal sees
 * no facts of its own and fails loudly on a foreign fact).
 *
 * @module @dsh-agent-team/storage/test/p4t2-journal
 */

import { describe, expect, it } from 'vitest'

import { TEAM_DOMAIN_NAME, serializeOperationRecord } from '../schema/index.js'
import { createOperationJournal } from '../operations/index.js'
import { InMemoryStorageSeam, P4_FIXTURE, asTeamDomainError, capture, detail } from './p4-helpers.js'
import { P4T2_PROVISION, createP4t2Journal, durableOutcomeShape, provisioningEffects, provisionRequest } from './p4t2-helpers.js'

const OP1 = P4T2_PROVISION.operationId

// ---------------------------------------------------------------- the world

const seam = new InMemoryStorageSeam()
const world = await createP4t2Journal(seam)
const journal = world.journal
const ledger = world.repositories.ledger

const base0 = seam.writeCount
const r1 = await journal.execute(provisionRequest())
const afterCommit1 = seam.writeCount

// ------------------------------------------------------------------ retries

const r2 = await journal.execute(provisionRequest())
const r3 = await journal.drive(OP1)
const r4 = await journal.execute(provisionRequest())
const afterRetries = seam.writeCount

// -------------------------------------------------------------------- views

const row = journal.get(OP1)
const all = journal.list()
const facts = ledger.list()
const gapList = ledger.gaps()
const rawLedgerKeys = [...seam.rawRows(TEAM_DOMAIN_NAME, 'ledger').keys()].sort()
const rawOpsKeys = [...seam.rawRows(TEAM_DOMAIN_NAME, 'operations').keys()].sort()

const binding = world.repositories.sessionBindings.get('session-child-1')
const bindingMember = binding?.kind === 'team-member' ? binding : undefined
const member = world.repositories.memberInstances.get(P4_FIXTURE.rootSessionId, P4_FIXTURE.instanceId)

const lastApplied = journal.lastApplied()
const factSeq = journal.factSequence(OP1)

// ------------------------------------------- a journal without effects (B)

const seamB = new InMemoryStorageSeam()
const worldB = await createP4t2Journal(seamB, P4_FIXTURE.rootSessionId, undefined)
const rB = await worldB.journal.execute(
  provisionRequest({
    idempotencyKey: 'p4t2-note-1',
    intentType: 'note-append',
    payload: { note: 'no effects' },
  }),
)
const factB = worldB.repositories.ledger.list()

// -------------------------------------------------- a second team (root-2)

const journal2 = createOperationJournal(world, P4_FIXTURE.otherRootSessionId, provisioningEffects())
const lastApplied2 = journal2.lastApplied()
const foreignFact = await capture(() => journal2.factSequence(OP1))

// ------------------------------------------------------------------ asserts

describe('p4t2 journal: PREPARED → effects → ledger → COMMITTED (happy path)', () => {
  it('drives one operation to COMMITTED with both effects applied', () => {
    expect(r1.phase).toBe('COMMITTED')
    expect(r1.record.operationId).toBe(OP1)
    expect(r1.record.generation).toBe(2)
    expect(r1.effectsApplied).toBe(2)
    expect(r1.effectsSkipped).toBe(0)
    expect(r1.ledgerSequence).toBe(1)
  })

  it('issues exactly the protocol writes: prepare, 2 effects, counter boot, counter update, fact, stamp advance, commit', () => {
    expect(afterCommit1 - base0).toBe(8)
  })

  it('persisted exactly one operation row and one ledger fact (plus the counter row)', () => {
    expect(rawOpsKeys).toEqual([OP1])
    expect(rawLedgerKeys).toEqual(['1', '__ledger_sequence_counter'])
    expect(ledger.entryCount()).toBe(1)
    expect(gapList).toEqual([])
    expect(facts.length).toBe(1)
    expect(facts[0]!.operationId).toBe(OP1)
    expect(String(facts[0]!.factType)).toBe('create-member-instance')
    expect(facts[0]!.payload).toEqual({ childSessionId: 'session-child-1', instanceId: 'inst-alpha' })
    expect(String(facts[0]!.rootSessionId)).toBe('session-root-1')
  })

  it('applied the target records exactly once (binding + member instance)', () => {
    expect(binding).not.toBe(undefined)
    expect(String(binding?.kind)).toBe('team-member')
    expect(bindingMember).not.toBe(undefined)
    expect(String(bindingMember?.rootSessionId)).toBe('session-root-1')
    expect(member).not.toBe(undefined)
    expect(String(member?.instanceId)).toBe('inst-alpha')
  })
})

describe('p4t2 journal: retry same operation (mandatory)', () => {
  it('re-executing the same request is a no-op: same durable result, zero writes', () => {
    expect(r2.phase).toBe('COMMITTED')
    expect(r2.effectsApplied).toBe(0)
    expect(r2.effectsSkipped).toBe(0)
    expect(r2.ledgerSequence).toBe(1)
    expect(serializeOperationRecord(r1.record)).toBe(serializeOperationRecord(r2.record))
    expect(afterRetries).toBe(afterCommit1)
  })

  it('driving the committed operation re-verifies the same durable result', () => {
    expect(r3.phase).toBe('COMMITTED')
    expect(r3.effectsApplied).toBe(0)
    expect(r3.ledgerSequence).toBe(1)
    expect(serializeOperationRecord(r1.record)).toBe(serializeOperationRecord(r3.record))
  })

  it('the fourth submission (execute again) still converges to the same durable result', () => {
    expect(r4.phase).toBe('COMMITTED')
    expect(r4.ledgerSequence).toBe(1)
    expect(afterRetries).toBe(afterCommit1)
    expect(durableOutcomeShape(r1)).toEqual(durableOutcomeShape(r4))
  })

  it('get/list expose the single durable row', () => {
    expect(serializeOperationRecord(row!)).toBe(serializeOperationRecord(r1.record))
    expect(all.length).toBe(1)
    expect(all[0]!.operationId).toBe(OP1)
  })

  it('lastApplied() and factSequence() surface the operation fact link', () => {
    expect(lastApplied).toBe(OP1)
    expect(factSeq).toBe(1)
  })
})

describe('p4t2 journal: effects-less journal and team scoping', () => {
  it('an operation with no resolved effects commits a fact of its intent type', () => {
    expect(rB.phase).toBe('COMMITTED')
    expect(rB.effectsApplied).toBe(0)
    expect(rB.effectsSkipped).toBe(0)
    expect(rB.ledgerSequence).toBe(1)
    expect(factB.length).toBe(1)
    expect(String(factB[0]!.factType)).toBe('note-append')
  })

  it('a second team sees no lastApplied fact of its own', () => {
    expect(lastApplied2).toBe(undefined)
  })

  it('reading a foreign fact through the second team fails with idempotency-conflict', () => {
    expect(foreignFact.ok).toBe(false)
    const error = asTeamDomainError(foreignFact.error)
    expect(error.code).toBe('RECORD_DUPLICATE')
    expect(detail(error, 'problem')).toBe('idempotency-conflict')
    expect(detail(error, 'expected')).toBe('session-root-2')
    expect(detail(error, 'found')).toBe('session-root-1')
  })
})
