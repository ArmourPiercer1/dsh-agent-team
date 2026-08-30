/**
 * p4t2-crash-recovery — the CRASH MATRIX (Development Plan §17.3): a crash
 * is possible between EVERY durable write of the protocol
 * (PREPARED row, each idempotent effect, the ledger allocation, the ledger
 * fact, the COMMITTED row). Every crash point below leaves a durable state
 * that RE-DRIVING the same operation converges to the same durable result:
 *
 * - C0  crash before the first write        → nothing durable; re-drive runs the full protocol
 * - C1  crash after the PREPARED row        → row only; effects run fresh
 * - C2  crash after effect 1 (binding)      → binding detected + SKIPPED, member runs
 * - C3  crash after effect 2 (member)       → both effects SKIPPED
 * - C4  crash after the sequence allocation → gap; re-drive allocates a NEW sequence, gap stays diagnosable
 * - C5  crash after the fact, before COMMIT → fact REUSED (same sequence), row completes
 * - G   staged: crash between prepare and recordChildSession (the external
 *       DSH Session/Agent creation window, Development Plan §17.4) → the
 *       orphan child is diagnosable (no TeamDomain reference); recovery
 *       records the child and rolls forward
 *
 * Global invariants: the protocol NEVER deletes (roll-forward only), every
 * target record and every fact is written EXACTLY ONCE across crash +
 * recovery, and the final ledger is gap-diagnosable via `gaps()`.
 *
 * @module @dsh-agent-team/storage/test/p4t2-crash-recovery
 */

import { describe, expect, it } from 'vitest'

import { TEAM_DOMAIN_NAME, serializeOperationRecord } from '../schema/index.js'
import { createMemberIdentity, memberIdentityKey, parseInstanceId } from '../../contracts/src/index.js'
import { InMemoryStorageSeam, P4_FIXTURE, asTeamDomainError, capture, detail } from './p4-helpers.js'
import { createP4t2Journal, durableOutcomeShape, isSeamFailure, provisionRequest, armCrashAt } from './p4t2-helpers.js'

const seam = new InMemoryStorageSeam()
const world = await createP4t2Journal(seam)
const journal = world.journal
const ledger = world.repositories.ledger
const bindings = world.repositories.sessionBindings
const members = world.repositories.memberInstances
const root = P4_FIXTURE.rootSessionId

const counterKey = '__ledger_sequence_counter'

function crashReq(opId: string, key: string, tag: string) {
  return provisionRequest({
    operationId: opId,
    idempotencyKey: key,
    payload: { childSessionId: `session-child-${tag}`, instanceId: `inst-${tag}` },
  })
}

// ------------------------------------------------- C0: crash before any write

const OP_A = 'op-p4t2crash01'
const aBase = seam.writeCount
armCrashAt(seam, aBase, 0)
const aCrash = await capture(() => journal.execute(crashReq(OP_A, 'p4t2-crash-a', 'ca')))
const aState = {
  row: world.repositories.operations.get(OP_A),
  binding: bindings.get('session-child-ca'),
  member: members.get(root, 'inst-ca'),
  entries: ledger.entryCount(),
}
seam.clearCrash()
const aAfterCrash = seam.writeCount
const aRecover = await journal.execute(crashReq(OP_A, 'p4t2-crash-a', 'ca'))
const aRecoverWrites = seam.writeCount - aAfterCrash
const aReverify = await journal.execute(crashReq(OP_A, 'p4t2-crash-a', 'ca'))
const aReverifyWrites = seam.writeCount - aAfterCrash - aRecoverWrites

// ------------------------------------------------- C1: crash after PREPARED row

const OP_B = 'op-p4t2crash02'
const bBase = seam.writeCount
armCrashAt(seam, bBase, 1)
const bCrash = await capture(() => journal.execute(crashReq(OP_B, 'p4t2-crash-b', 'cb')))
const bState = {
  row: world.repositories.operations.get(OP_B),
  binding: bindings.get('session-child-cb'),
  member: members.get(root, 'inst-cb'),
}
seam.clearCrash()
const bAfterCrash = seam.writeCount
const bRecover = await journal.execute(crashReq(OP_B, 'p4t2-crash-b', 'cb'))
const bRecoverWrites = seam.writeCount - bAfterCrash

// ---------------------------------------------------- C2: crash after binding

const OP_C = 'op-p4t2crash03'
const cBase = seam.writeCount
armCrashAt(seam, cBase, 2)
const cCrash = await capture(() => journal.execute(crashReq(OP_C, 'p4t2-crash-c', 'cc')))
const cState = {
  row: world.repositories.operations.get(OP_C),
  binding: bindings.get('session-child-cc'),
  member: members.get(root, 'inst-cc'),
}
seam.clearCrash()
const cAfterCrash = seam.writeCount
const cRecover = await journal.execute(crashReq(OP_C, 'p4t2-crash-c', 'cc'))
const cRecoverWrites = seam.writeCount - cAfterCrash

// ---------------------------------------- C3: crash after both effects

const OP_D = 'op-p4t2crash04'
const dBase = seam.writeCount
armCrashAt(seam, dBase, 3)
const dCrash = await capture(() => journal.execute(crashReq(OP_D, 'p4t2-crash-d', 'cd')))
const dState = {
  row: world.repositories.operations.get(OP_D),
  binding: bindings.get('session-child-cd'),
  member: members.get(root, 'inst-cd'),
  counter: seam.rawRows(TEAM_DOMAIN_NAME, 'ledger').has(counterKey),
  fact4: ledger.get(4),
}
seam.clearCrash()
const dAfterCrash = seam.writeCount
const dRecover = await journal.execute(crashReq(OP_D, 'p4t2-crash-d', 'cd'))
const dRecoverWrites = seam.writeCount - dAfterCrash

// --------------------------------------------- C4: crash after allocation

const OP_E = 'op-p4t2crash05'
const eBase = seam.writeCount
armCrashAt(seam, eBase, 4)
const eCrash = await capture(() => journal.execute(crashReq(OP_E, 'p4t2-crash-e', 'ce')))
const eState = {
  row: world.repositories.operations.get(OP_E),
  fact5: ledger.get(5),
  gaps: ledger.gaps(),
}
seam.clearCrash()
const eAfterCrash = seam.writeCount
const eRecover = await journal.execute(crashReq(OP_E, 'p4t2-crash-e', 'ce'))
const eRecoverWrites = seam.writeCount - eAfterCrash

// ---------------------------------------- C5: crash after the fact, before COMMIT

const OP_F = 'op-p4t2crash06'
const fBase = seam.writeCount
armCrashAt(seam, fBase, 5)
const fCrash = await capture(() => journal.execute(crashReq(OP_F, 'p4t2-crash-f', 'cf')))
const fState = {
  row: world.repositories.operations.get(OP_F),
  fact7: ledger.get(7),
}
seam.clearCrash()
const fAfterCrash = seam.writeCount
const fRecover = await journal.execute(crashReq(OP_F, 'p4t2-crash-f', 'cf'))
const fRecoverWrites = seam.writeCount - fAfterCrash
const fReverify = await journal.execute(crashReq(OP_F, 'p4t2-crash-f', 'cf'))
const fReverifyWrites = seam.writeCount - fAfterCrash - fRecoverWrites

// ------------------------------------- G: staged crash (prepare → child → drive)

const OP_G = 'op-p4t2crash07'
const gPrepare = await journal.prepare(crashReq(OP_G, 'p4t2-crash-g', 'cg'))
armCrashAt(seam, seam.writeCount, 0)
const gCrash = await capture(() => journal.recordChildSession(OP_G, 'session-child-cg'))
const gOrphan = {
  binding: bindings.get('session-child-cg'),
  member: members.get(root, 'inst-cg'),
  row: world.repositories.operations.get(OP_G),
}
seam.clearCrash()
const gAfterCrash = seam.writeCount
const gChild = await journal.recordChildSession(OP_G, 'session-child-cg')
const gDrive = await journal.drive(OP_G)
const gRecoverWrites = seam.writeCount - gAfterCrash

// ------------------------------------------------------------------ final state

const finalFacts = ledger.list()
const finalGaps = ledger.gaps()
const finalEntryCount = ledger.entryCount()
const finalLastApplied = journal.lastApplied()
const bindingWriteCounts = ['ca', 'cb', 'cc', 'cd', 'ce', 'cf', 'cg'].map((tag) => seam.writeLog.filter((e) => e.table === 'session_bindings' && e.key === `session-child-${tag}`).length)
const memberWriteCounts = ['ca', 'cb', 'cc', 'cd', 'ce', 'cf', 'cg'].map((tag) => {
  const key = memberIdentityKey(createMemberIdentity(root, parseInstanceId(`inst-${tag}`)))
  return seam.writeLog.filter((e) => e.table === 'member_instances' && e.key === key).length
})
const anyDelete = seam.writeLog.some((e) => e.op === 'delete')

// ------------------------------------------------------------------ asserts

describe('p4t2 crash C0: crash before the first write', () => {
  it('surfaces SEAM_FAILURE and left NOTHING durable', () => {
    expect(aCrash.ok).toBe(false)
    expect(isSeamFailure(aCrash.error)).toBe(true)
    expect(detail(asTeamDomainError(aCrash.error), 'problem')).toBe('unclassified-seam-error')
    expect(aState.row).toBe(undefined)
    expect(aState.binding).toBe(undefined)
    expect(aState.member).toBe(undefined)
    expect(aState.entries).toBe(0)
    expect(aAfterCrash).toBe(aBase)
  })

  it('re-driving runs the full protocol and converges (7 writes, one fact)', () => {
    expect(aRecover.phase).toBe('COMMITTED')
    expect(aRecover.effectsApplied).toBe(2)
    expect(aRecover.effectsSkipped).toBe(0)
    expect(aRecover.ledgerSequence).toBe(1)
    expect(aRecoverWrites).toBe(7)
  })

  it('the re-verification is a zero-write no-op on the same durable result', () => {
    expect(aReverifyWrites).toBe(0)
    expect(serializeOperationRecord(aReverify.record)).toBe(serializeOperationRecord(aRecover.record))
    expect(durableOutcomeShape(aReverify)).toEqual(durableOutcomeShape(aRecover))
  })
})

describe('p4t2 crash C1: crash after the PREPARED row', () => {
  it('left only the PREPARED row (no target, no fact)', () => {
    expect(bCrash.ok).toBe(false)
    expect(isSeamFailure(bCrash.error)).toBe(true)
    expect(bState.row?.phase).toBe('PREPARED')
    expect(bState.row?.generation).toBe(1)
    expect(bState.binding).toBe(undefined)
    expect(bState.member).toBe(undefined)
  })

  it('re-driving applies both effects and converges (5 writes, fact 2)', () => {
    expect(bRecover.phase).toBe('COMMITTED')
    expect(bRecover.effectsApplied).toBe(2)
    expect(bRecover.effectsSkipped).toBe(0)
    expect(bRecover.ledgerSequence).toBe(2)
    expect(bRecoverWrites).toBe(5)
  })
})

describe('p4t2 crash C2: crash after effect 1 (session binding)', () => {
  it('left the PREPARED row and the binding only', () => {
    expect(cCrash.ok).toBe(false)
    expect(cState.row?.phase).toBe('PREPARED')
    expect(cState.binding).not.toBe(undefined)
    expect(cState.member).toBe(undefined)
  })

  it('re-driving SKIPS the applied binding, runs the member effect, converges (4 writes, fact 3)', () => {
    expect(cRecover.phase).toBe('COMMITTED')
    expect(cRecover.effectsApplied).toBe(1)
    expect(cRecover.effectsSkipped).toBe(1)
    expect(cRecover.ledgerSequence).toBe(3)
    expect(cRecoverWrites).toBe(4)
  })
})

describe('p4t2 crash C3: crash after effect 2 (member instance)', () => {
  it('left the PREPARED row with BOTH targets, no fact, counter intact', () => {
    expect(dCrash.ok).toBe(false)
    expect(dState.row?.phase).toBe('PREPARED')
    expect(dState.binding).not.toBe(undefined)
    expect(dState.member).not.toBe(undefined)
    expect(dState.fact4).toBe(undefined)
    expect(dState.counter).toBe(true)
  })

  it('re-driving SKIPS both effects and converges (3 writes, fact 4)', () => {
    expect(dRecover.phase).toBe('COMMITTED')
    expect(dRecover.effectsApplied).toBe(0)
    expect(dRecover.effectsSkipped).toBe(2)
    expect(dRecover.ledgerSequence).toBe(4)
    expect(dRecoverWrites).toBe(3)
  })
})

describe('p4t2 crash C4: crash after the sequence allocation', () => {
  it('left a GAP at the allocated sequence (no fact, no counter regression)', () => {
    expect(eCrash.ok).toBe(false)
    expect(eState.row?.phase).toBe('PREPARED')
    expect(eState.fact5).toBe(undefined)
    expect(eState.gaps).toEqual([5])
  })

  it('re-driving allocates a NEW sequence, fills the fact, converges (3 writes, fact 6)', () => {
    expect(eRecover.phase).toBe('COMMITTED')
    expect(eRecover.effectsApplied).toBe(0)
    expect(eRecover.effectsSkipped).toBe(2)
    expect(eRecover.ledgerSequence).toBe(6)
    expect(eRecoverWrites).toBe(3)
  })
})

describe('p4t2 crash C5: crash after the fact, before COMMITTED', () => {
  it('left the fact durable (sequence 7) but the row still PREPARED', () => {
    expect(fCrash.ok).toBe(false)
    expect(fState.row?.phase).toBe('PREPARED')
    expect(fState.fact7?.operationId).toBe(OP_F)
  })

  it('re-driving REUSES the existing fact (no allocation) and commits (1 write)', () => {
    expect(fRecover.phase).toBe('COMMITTED')
    expect(fRecover.effectsApplied).toBe(0)
    expect(fRecover.effectsSkipped).toBe(2)
    expect(fRecover.ledgerSequence).toBe(7)
    expect(fRecoverWrites).toBe(1)
  })

  it('the re-verification is a zero-write no-op on the same durable result', () => {
    expect(fReverifyWrites).toBe(0)
    expect(serializeOperationRecord(fReverify.record)).toBe(serializeOperationRecord(fRecover.record))
  })
})

describe('p4t2 crash G: staged window (prepare → external child → drive)', () => {
  it('prepare landed, the child-session recording crashed, leaving a diagnosable orphan child', () => {
    expect(gPrepare.phase).toBe('PREPARED')
    expect(gPrepare.generation).toBe(1)
    expect(gPrepare.childSessionId).toBe(undefined)
    expect(gCrash.ok).toBe(false)
    expect(isSeamFailure(gCrash.error)).toBe(true)
    // The externally created child has NO TeamDomain reference: no binding, no member, no child recorded on the row.
    expect(gOrphan.binding).toBe(undefined)
    expect(gOrphan.member).toBe(undefined)
    expect(gOrphan.row?.childSessionId).toBe(undefined)
  })

  it('recovery records the child and rolls forward to COMMITTED (6 writes, fact 8)', () => {
    expect(gChild.phase).toBe('PREPARED')
    expect(gChild.generation).toBe(2)
    expect(String(gChild.childSessionId)).toBe('session-child-cg')
    expect(gDrive.phase).toBe('COMMITTED')
    expect(gDrive.effectsApplied).toBe(2)
    expect(gDrive.ledgerSequence).toBe(8)
    expect(gRecoverWrites).toBe(6)
  })
})

describe('p4t2 crash: global invariants (roll-forward, write-once, gap-diagnosable)', () => {
  it('the final ledger holds one fact per operation: seven entries, exactly one gap (5)', () => {
    expect(finalEntryCount).toBe(7)
    expect(finalFacts.length).toBe(7)
    expect(finalGaps).toEqual([5])
    const sequences = finalFacts.map((f) => f.sequence).sort((a, b) => a - b)
    expect(sequences).toEqual([1, 2, 3, 4, 6, 7, 8])
    expect(finalLastApplied).toBe(OP_G)
  })

  it('every target record was written EXACTLY ONCE across crash + recovery', () => {
    expect(bindingWriteCounts).toEqual([1, 1, 1, 1, 1, 1, 1])
    expect(memberWriteCounts).toEqual([1, 1, 1, 1, 1, 1, 1])
  })

  it('the protocol never deletes (roll-forward, never rollback)', () => {
    expect(anyDelete).toBe(false)
  })
})
