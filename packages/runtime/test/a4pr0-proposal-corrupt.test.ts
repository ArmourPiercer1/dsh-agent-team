/**
 * A4-PR0 — the proposal reader's corruption gate: the TWO LEGS ADR A4-7
 * requires (plan Task 0 / A4-PR0, ADR A4-7 + A4-3, spec §25.2).
 *
 * THE GATE IS TWO-LEGGED AND THE LEGS MAY NOT DEGRADE INTO EACH OTHER.
 *
 *  LEG 1 — PAYLOAD-LEVEL corruption. The durable row is a well-formed ledger
 *  entry; the PROPOSAL inside its payload is not (a missing field, an unknown
 *  key, a foreign enum member, a base pair that disagrees). `list()` reads the
 *  row happily, so the reader MUST report a typed corrupt outcome naming the
 *  sequence, the path and the field — and the row must STILL BE LISTED. A
 *  reader that drops the row hides the corruption, and the corruption then
 *  looks like "no proposal".
 *
 *  LEG 2 — ENTRY-LEVEL corruption. The row itself is not a valid ledger entry,
 *  so `LedgerRepository.list()` throws while deserializing it, BEFORE any
 *  proposal parser runs. The reader must let that throw propagate: an empty
 *  array here would be reported as "this team has no proposals", which is a
 *  fabrication about a team whose ledger cannot be read (spec §25.2: proposal
 *  reads never go through a lenient parser).
 *
 *  WHY BOTH LEGS ARE PINNED AGAINST EACH OTHER: the failure mode of this kind
 *  of gate is a `try { … } catch { return [] }` that satisfies leg 1's "never
 *  throws" by silently satisfying leg 2 with an empty read. C5 therefore
 *  asserts the empty read is NOT the corrupt signal, on a store whose rows are
 *  provably unreadable.
 *
 * The corruption is planted the way corruption arrives in production: through
 * the REAL ledger repository (a foreign/older writer, then a tampered durable
 * file), never by injecting a fake repository into the store under test.
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous): the
 * scenario runs at module top level with `await`; the `it` bodies assert
 * captured values.
 */

import { describe, expect, it } from 'vitest'
import { parseRootSessionId } from '../../contracts/src/index.js'
import { TEAM_DOMAIN_SCHEMA_VERSION } from '../../storage/schema/stores.js'
import { readText, writeText } from '../../testkit/fault-injection/file-seam.mjs'
import {
  P6T4_ROOT,
  P6T4_SEEDS,
  createP6T4World,
  destroyP6T1World,
  restartP6T1World,
} from './p6t4-helpers.js'
import {
  GOVERNANCE_PROPOSAL_FACT_TYPE,
  createGovernanceProposalStore,
} from '../governance/proposal-store.js'
import type {
  GovernanceProposalDraft,
  GovernanceProposalReadOutcome,
  ProposalReadCorrupt,
  ProposalReadRecord,
} from '../governance/proposal-store.js'
import { GOVERNANCE_PROPOSAL_ERROR_CODES } from '../governance/proposal-codes.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)
const PROPOSAL_NOW = '2026-10-07T00:00:00.000Z'

const DRAFT: GovernanceProposalDraft = {
  targetMemberInstanceId: WORKER_ID,
  baseGeneration: 0,
  baseSnapshotId: null,
  desiredEffect: 'deny',
  authorityEnvelopeAst: { kind: 'exact', path: 'shell.exec' },
  requiredAuthority: 'human-user',
  caseFingerprint: 'case-a4pr0-corrupt',
}

/** The durable payload of a sound draft, as the store writes it. */
function soundPayload(): Record<string, unknown> {
  return { ...DRAFT, status: 'pending', recordedAt: PROPOSAL_NOW }
}

/** One payload-corrupted row, written through the REAL repository (entry-valid
 *  by construction: `parseLedgerEntry` accepts it, only the proposal inside is
 *  wrong). That distinction is what makes this leg 1 and not leg 2. */
async function putCorruptPayload(
  world: Awaited<ReturnType<typeof createP6T4World>>,
  mutate: (payload: Record<string, unknown>) => void,
): Promise<number> {
  const ledger = world.domain.repositories.ledger
  const payload = soundPayload()
  mutate(payload)
  const sequence = await ledger.allocateSequence()
  await ledger.put({
    schemaVersion: TEAM_DOMAIN_SCHEMA_VERSION,
    sequence,
    rootSessionId: parseRootSessionId(P6T4_ROOT),
    factType: GOVERNANCE_PROPOSAL_FACT_TYPE,
    payload,
    createdAt: PROPOSAL_NOW,
  })
  return sequence
}

// --- scenario ----------------------------------------------------------------

/** The reader's corrupt outcome, pinned to the EXPORTED type: the shape an
 *  A4-7 gate reports is itself a contract (sequence + path + field + problem),
 *  so the assertions read the real record, not a copy of it. */
type CorruptShape = ProposalReadCorrupt

type Captured = {
  /** The sound row appended through the production writer. */
  readonly soundSequence: number
  /** Leg 1 — one probe per corruption shape. */
  readonly missingField: CorruptShape
  readonly missingFieldSequence: number
  readonly unknownKey: CorruptShape
  readonly foreignEffect: CorruptShape
  readonly foreignAuthority: CorruptShape
  readonly foreignStatus: CorruptShape
  readonly wrongType: CorruptShape
  readonly badAstKind: CorruptShape
  readonly astPathMissing: CorruptShape
  readonly nonStringFingerprint: CorruptShape
  readonly negativeGeneration: CorruptShape
  /** A4-3: a base pair that disagrees is CORRUPT, not stale. */
  readonly pairDisagreement: CorruptShape
  readonly nullSnapshotWithNonZeroGeneration: CorruptShape
  readonly zeroGenerationWithSnapshot: CorruptShape
  /** Leg 1 — the row survives its own corruption. */
  readonly kindsInOrder: string[]
  readonly listedSequences: number[]
  readonly durableProposalRowCount: number
  readonly soundRowStillReadable: boolean
  /** Leg 2 — entry-level corruption. */
  readonly entryLevelThrew: boolean
  readonly entryLevelErrorName: string
  readonly entryLevelLedgerListThrew: boolean
  readonly emptyReadIsNotTheSignal: boolean
  /** Leg 1's contrast: a Team with no proposal rows really does read `[]`. */
  readonly emptyReadIsAbsent: boolean
  /** The store never mutates what it reads. */
  readonly readIsPure: boolean
}

const captured: Captured = await (async (): Promise<Captured> => {
  const world = await createP6T4World('a4pr0-proposal-corrupt', ['leader', 'worker'])
  try {
    const ledger = world.domain.repositories.ledger
    const store = createGovernanceProposalStore({ ledger, now: () => PROPOSAL_NOW })
    const sound = await store.appendProposal({ teamSessionId: P6T4_ROOT, proposal: DRAFT })

    const shape = (outcome: GovernanceProposalReadOutcome): CorruptShape => {
      if (outcome.kind !== 'corrupt-record') {
        throw new Error(`expected a corrupt-record outcome, got '${outcome.kind}'`)
      }
      return outcome
    }
    const probe = async (mutate: (payload: Record<string, unknown>) => void): Promise<[CorruptShape, number]> => {
      const sequence = await putCorruptPayload(world, mutate)
      const found = store
        .listProposals({ teamSessionId: P6T4_ROOT })
        .find((outcome) => outcome.sequence === sequence)
      if (found === undefined) {
        throw new Error(`the corrupt row at sequence ${String(sequence)} was NOT listed at all`)
      }
      return [shape(found), sequence]
    }

    const [missingField, missingFieldSequence] = await probe((payload) => {
      delete payload['desiredEffect']
    })
    const [unknownKey] = await probe((payload) => {
      payload['inventedField'] = 'nope'
    })
    const [foreignEffect] = await probe((payload) => {
      payload['desiredEffect'] = 'sometimes'
    })
    const [foreignAuthority] = await probe((payload) => {
      payload['requiredAuthority'] = 'team-bot'
    })
    const [foreignStatus] = await probe((payload) => {
      payload['status'] = 'approved'
    })
    const [wrongType] = await probe((payload) => {
      payload['baseGeneration'] = '0'
    })
    const [badAstKind] = await probe((payload) => {
      payload['authorityEnvelopeAst'] = { kind: 'regex', path: 'shell.*' }
    })
    const [astPathMissing] = await probe((payload) => {
      payload['authorityEnvelopeAst'] = { kind: 'exact' }
    })
    const [nonStringFingerprint] = await probe((payload) => {
      payload['caseFingerprint'] = 42
    })
    const [negativeGeneration] = await probe((payload) => {
      payload['baseGeneration'] = -1
    })
    const [pairDisagreement] = await probe((payload) => {
      payload['baseGeneration'] = 7
      payload['baseSnapshotId'] = `${P6T4_ROOT}#${WORKER_ID}#8`
    })
    const [nullSnapshotWithNonZeroGeneration] = await probe((payload) => {
      payload['baseGeneration'] = 4
      payload['baseSnapshotId'] = null
    })
    const [zeroGenerationWithSnapshot] = await probe((payload) => {
      payload['baseGeneration'] = 0
      payload['baseSnapshotId'] = `${P6T4_ROOT}#${WORKER_ID}#0`
    })

    // Leg 1's other half: the corrupt rows are STILL LISTED, and the sound row
    // is still readable among them.
    const read = store.listProposals({ teamSessionId: P6T4_ROOT })
    // What an ABSENCE legitimately looks like: a well-formed Team this world
    // has no rows for reads as `[]`. Pinning that keeps `[]` meaning "no
    // proposals" and nothing else — leg 2 must never borrow that shape.
    const emptyReadMeansAbsence = store.listProposals({
      teamSessionId: 'session-root-a4pr0-empty',
    })
    const listedSequences = read.map((outcome) => outcome.sequence).sort((a, b) => a - b)
    const durableRows = ledger
      .list()
      .filter((entry) => entry.factType === GOVERNANCE_PROPOSAL_FACT_TYPE)
    const soundRowStillReadable = read.some(
      (outcome) =>
        outcome.kind === 'record' &&
        (outcome as ProposalReadRecord).sequence === sound.sequence,
    )
    // Reading is pure: a second read returns the same outcomes and leaves the
    // durable rows byte-identical (a reader that "repaired" a row would be a
    // mutation path wearing a read port).
    const reread = store.listProposals({ teamSessionId: P6T4_ROOT })
    const durableAfterRead = ledger
      .list()
      .filter((entry) => entry.factType === GOVERNANCE_PROPOSAL_FACT_TYPE)
    const readIsPure =
      JSON.stringify(reread) === JSON.stringify(read) &&
      JSON.stringify(durableAfterRead) === JSON.stringify(durableRows)

    // --- Leg 2: entry-level corruption (the ROW is not a ledger entry). -----
    // Tamper the durable table file directly, then re-open: `list()` reads
    // every row, so the throw happens inside the durable read, before any
    // proposal parser can report anything.
    const reopened = await restartP6T1World(world)
    try {
      const reopenedLedger = reopened.domain.repositories.ledger
      const reopenedStore = createGovernanceProposalStore({
        ledger: reopenedLedger,
        now: () => PROPOSAL_NOW,
      })
      const stillListed = reopenedStore.listProposals({ teamSessionId: P6T4_ROOT })
      const ledgerFile = reopened.seam.pathFor('team_domain', 'ledger')
      const rows = JSON.parse(readText(ledgerFile)) as Record<string, unknown>
      const target = stillListed[0]
      if (target === undefined) {
        throw new Error('no row to tamper — the scenario lost its rows')
      }
      // Drop a REQUIRED entry field: the row is no longer a `LedgerEntry`,
      // while remaining valid JSON (so the medium opens fine and the failure
      // is unambiguously the row, not the file).
      const row = rows[String(target.sequence)]
      if (typeof row !== 'string') {
        throw new Error(`tamper precondition: row ${String(target.sequence)} is not a string`)
      }
      const parsed = JSON.parse(row) as Record<string, unknown>
      delete parsed['createdAt']
      rows[String(target.sequence)] = JSON.stringify(parsed)
      writeText(ledgerFile, JSON.stringify(rows))

      const reopenedTampered = await restartP6T1World(reopened)
      try {
        const tamperedStore = createGovernanceProposalStore({
          ledger: reopenedTampered.domain.repositories.ledger,
          now: () => PROPOSAL_NOW,
        })
        let threw = false
        let errorName = 'did-not-throw'
        let results: readonly GovernanceProposalReadOutcome[] = []
        try {
          results = tamperedStore.listProposals({ teamSessionId: P6T4_ROOT })
        } catch (error) {
          threw = true
          errorName = error instanceof Error ? error.name : String(error)
        }
        let ledgerListThrew = false
        try {
          reopenedTampered.domain.repositories.ledger.list()
        } catch {
          ledgerListThrew = true
        }
        return {
          soundSequence: sound.sequence,
          missingField,
          missingFieldSequence,
          unknownKey,
          foreignEffect,
          foreignAuthority,
          foreignStatus,
          wrongType,
          badAstKind,
          astPathMissing,
          nonStringFingerprint,
          negativeGeneration,
          pairDisagreement,
          nullSnapshotWithNonZeroGeneration,
          zeroGenerationWithSnapshot,
          kindsInOrder: read.map((outcome) => outcome.kind),
          listedSequences,
          durableProposalRowCount: durableRows.length,
          soundRowStillReadable,
          entryLevelThrew: threw,
          entryLevelErrorName: errorName,
          entryLevelLedgerListThrew: ledgerListThrew,
          // The empty array is the shape of "no proposals". A reader that
          // caught leg 2's throw would return exactly that, so an empty read
          // after tampering would BE the proof that the legs collapsed. On the
          // honest path the read never returned at all (`threw`), and the only
          // way this can be false is a reader that swallowed the throw.
          emptyReadIsNotTheSignal: threw ? true : results.length > 0,
          emptyReadIsAbsent: emptyReadMeansAbsence.length === 0,
          readIsPure,
        }
      } finally {
        await destroyP6T1World(reopenedTampered)
      }
    } finally {
      await destroyP6T1World(reopened)
    }
  } finally {
    await destroyP6T1World(world)
  }
})()

// --- assertions ---------------------------------------------------------------

describe('A4-PR0 proposal corruption gate, leg 1 — typed corrupt outcome, row still listed (A4-7)', () => {
  it('C1 a missing field is a typed corrupt outcome naming sequence, path and field', () => {
    expect(captured.missingField.kind).toBe('corrupt-record')
    expect(captured.missingField.code).toBe(GOVERNANCE_PROPOSAL_ERROR_CODES.CORRUPT_RECORD)
    expect(captured.missingField.field).toBe('desiredEffect')
    expect(captured.missingField.path).toBe('payload.desiredEffect')
    expect(captured.missingField.problem).toBe('missing-field')
    expect(captured.missingField.sequence).toBe(captured.missingFieldSequence)
  })

  it('C2 an unknown key is corrupt — the record set is closed (A5-13)', () => {
    expect(captured.unknownKey.problem).toBe('unknown-field')
    expect(captured.unknownKey.field).toBe('inventedField')
  })

  it('C3 a foreign vocabulary member is corrupt in each closed set', () => {
    expect(captured.foreignEffect.field).toBe('desiredEffect')
    expect(captured.foreignEffect.problem).toBe('value-not-in-closed-set')
    expect(captured.foreignAuthority.field).toBe('requiredAuthority')
    expect(captured.foreignAuthority.problem).toBe('value-not-in-closed-set')
    // A decision-vocabulary word is NOT a proposal status: `approved` belongs
    // to the Control decision (spec §11.3 keeps `allow|deny|stale-denied`
    // separate), so a row claiming it is corrupt, not merely unusual.
    expect(captured.foreignStatus.field).toBe('status')
    expect(captured.foreignStatus.problem).toBe('value-not-in-closed-set')
  })

  it('C4 a wrong scalar type and a malformed AST node are corrupt at their path', () => {
    expect(captured.wrongType.field).toBe('baseGeneration')
    expect(captured.wrongType.problem).toBe('not-a-non-negative-integer')
    expect(captured.negativeGeneration.problem).toBe('not-a-non-negative-integer')
    expect(captured.badAstKind.field).toBe('authorityEnvelopeAst')
    expect(captured.badAstKind.path).toBe('payload.authorityEnvelopeAst.kind')
    expect(captured.astPathMissing.field).toBe('authorityEnvelopeAst')
    expect(captured.astPathMissing.path).toBe('payload.authorityEnvelopeAst.path')
    expect(captured.nonStringFingerprint.field).toBe('caseFingerprint')
  })

  it('C5 a disagreeing base pair is CORRUPT, not stale (A4-3)', () => {
    // "A recorded pair that disagrees is corrupt, not stale" — the reader has
    // no overlay here to compare against, and must not invent one.
    expect(captured.pairDisagreement.problem).toBe('base-pair-disagreement')
    expect(captured.pairDisagreement.field).toBe('baseSnapshotId')
    // The empty-overlay pair is (null, 0); each half alone is corrupt too.
    expect(captured.nullSnapshotWithNonZeroGeneration.problem).toBe('base-pair-disagreement')
    expect(captured.zeroGenerationWithSnapshot.problem).toBe('base-pair-disagreement')
  })

  it('C6 every corrupt row is STILL LISTED, and the sound row stays readable', () => {
    // The point of leg 1: reporting corruption must not hide the row.
    expect(captured.durableProposalRowCount).toBe(captured.kindsInOrder.length)
    expect(captured.kindsInOrder.filter((kind) => kind === 'corrupt-record').length).toBe(13)
    expect(captured.kindsInOrder.filter((kind) => kind === 'record')).toEqual(['record'])
    expect(captured.soundRowStillReadable).toBe(true)
    expect(captured.listedSequences.length).toBe(captured.durableProposalRowCount)
    expect(captured.listedSequences).toContain(captured.missingFieldSequence)
    expect(captured.listedSequences).toContain(captured.soundSequence)
  })

  it('C7 reading is pure: no read rewrites or removes a durable row', () => {
    expect(captured.readIsPure).toBe(true)
  })
})

describe('A4-PR0 proposal corruption gate, leg 2 — entry-level corruption throws (A4-7)', () => {
  it('C8 an unreadable ENTRY throws out of the read; it is never an empty list', () => {
    expect(captured.entryLevelThrew).toBe(true)
    expect(captured.entryLevelErrorName).not.toBe('did-not-throw')
  })

  it('C9 the throw is the durable read, before any proposal parser runs', () => {
    // `list()` deserializes EVERY row, so the failure is the ledger's, not the
    // proposal reader's — and the proposal reader must not swallow it.
    expect(captured.entryLevelLedgerListThrew).toBe(true)
  })

  it('C10 the two legs never collapse: an empty read is never the corrupt signal', () => {
    // A `catch { return [] }` would satisfy leg 1 while turning leg 2 into
    // "this team has no proposals" — a fabrication about a team whose ledger
    // cannot be read (spec §25.2: proposal reads never go through a lenient
    // parser).
    expect(captured.emptyReadIsNotTheSignal).toBe(true)
    // …and `[]` is not a shape leg 2 has to share: a Team without proposals
    // really does read as an empty list, which is exactly why swallowing the
    // throw would be a silent lie rather than a loud one.
    expect(captured.emptyReadIsAbsent).toBe(true)
  })
})
