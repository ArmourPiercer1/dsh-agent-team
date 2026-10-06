/**
 * A4-PR0 — the durable governance proposal substrate: append, read back,
 * reopen (plan Task 0 / A4-PR0, ADR A5-13 + A4-5, spec §8.4/§24.5).
 *
 * WHAT THIS PINS. PR0 adds a durable record with NO product surface: nothing
 * in `src/plugin/**` may call it (A4-6), so the only honest proof that the
 * substrate exists is a production writer, the REAL durable store, and a read
 * that goes back to those same rows. Every assertion runs against a real
 * TeamDomain over a scratch dir — never a fake repository — because the record
 * exists to be the authority base a later PR commits against, and a fake
 * cannot prove durability.
 *
 * THE FIELDS ARE NOT MINE TO CHOOSE. A5-13 freezes the record's field set and
 * its exact spelling, so this test pins the set EXACTLY: a missing key, an
 * extra key and a renamed key are all red here. PR5 "may extend the fingerprint
 * inputs but may not rename or retype a field" — that freedom is only
 * meaningful against a pinned baseline.
 *
 * WHY `targetMemberInstanceId` AND NOT `targetInstanceId` (A4-5). The four
 * `FACT_ADDRESSING_KEYS` of `src/plugin/projection-source.ts` drive the DISPOSED
 * retained-history digest attribution; a proposal addressed with
 * `targetInstanceId` would be pulled into a disposed member's bundle and move
 * a digest that has nothing to do with the proposal. S8 pins that consequence
 * from the write side: append against a DISPOSED member, and that member's
 * retained-history bundle is unchanged afterwards while the TEAM ledger
 * summary does gain the fact. S8 doubles as the category-registration proof —
 * the fold throws `TEAM_PROJECTION_SOURCE_LEDGER_CATEGORY_UNKNOWN` for any
 * unmapped fact type on EVERY projection read, so an unregistered
 * `governance-proposal-recorded` turns this leg red instead of being invisible.
 *
 * Test pattern of this repo (the plain-node shim's `it` is synchronous): the
 * scenario runs at module top level with `await`; the `it` bodies assert
 * captured values.
 */

import { describe, expect, it } from 'vitest'
import { createBlueprintSnapshotRef, parseRootSessionId } from '../../contracts/src/index.js'
import type { LedgerEntry } from '../../storage/schema/index.js'
import { TEAM_DOMAIN_SCHEMA_VERSION } from '../../storage/schema/stores.js'
import {
  PERMISSION_OVERLAY_EFFECT_VALUES,
  PERMISSION_OVERLAY_MAX_SNAPSHOT_ID_LENGTH,
  permissionOverlaySnapshotKey,
} from '../../storage/schema/permission-overlay.js'
import { OPERATION_ID_PATTERN } from '../../storage/schema/operation.js'
import { PERMISSION_PATH_MAX_LENGTH } from '../../domain/blueprint/src/schema.js'
import {
  P6T4_NOW,
  P6T4_ROOT,
  P6T4_SEEDS,
  createP6T4World,
  destroyP6T1World,
  flipLifecycle,
  restartP6T1World,
  writeRawControlFact,
} from './p6t4-helpers.js'
import type { P6T1World } from './p6t1-helpers.js'
import { createTeamDomainReadPort } from '../src/plugin/projection-source.js'
import {
  GOVERNANCE_PROPOSAL_FACT_TYPE,
  GOVERNANCE_PROPOSAL_LEDGER_SCHEMA_VERSION,
  GOVERNANCE_PROPOSAL_OPERATION_ID_PATTERN,
  GOVERNANCE_PROPOSAL_STATUSES,
  PROPOSAL_AUTHORITY_POSITIONS,
  createGovernanceProposalStore,
} from '../governance/proposal-store.js'
import type {
  GovernanceProposalDraft,
  GovernanceProposalLedgerRow,
  GovernanceProposalLedgerWriterPort,
  GovernanceProposalLedgerReaderPort,
  GovernanceProposalReadOutcome,
  GovernanceProposalRecord,
  ProposalReadRecord,
} from '../governance/proposal-store.js'
import {
  GOVERNANCE_PROPOSAL_ERROR_CODES,
  isGovernanceProposalError,
} from '../governance/proposal-codes.js'

const WORKER_ID = String(P6T4_SEEDS.worker.instanceId)

/** A second TeamSession root: the ledger sequence counter is SHARED across the
 *  domain, so a proposal row from another team must not surface here. */
const FOREIGN_ROOT = 'session-root-a4pr0other'

/** The injected clock. `recordedAt` is the STORE's clock, never a
 *  caller-supplied durable stamp: a caller must not be able to write history
 *  at a time of its choosing. */
const PROPOSAL_NOW = '2026-10-07T00:00:00.000Z'

/** The template rows production injects through `readPortDeps`
 *  (`src/plugin/root.ts`); only the deps are supplied as at the composition
 *  root — every fact under test stays production-written. */
const PORT_DEPS = {
  templates: () =>
    [
      { kind: 'leader', templateId: 'leader', displayName: 'leader', contextPolicy: 'persistent' },
      { kind: 'member', templateId: 'worker', displayName: 'Worker', contextPolicy: 'persistent' },
    ] as never,
  policyState: () => 'default' as const,
}

/** One honest draft over an EMPTY overlay history: spec §24.5 makes that
 *  `baseSnapshotId: null` WITH `baseGeneration: 0` — the pair, not either
 *  half. The AST node is the A3-9 config shape, and the reviewer is Human
 *  User. */
const DRAFT: GovernanceProposalDraft = {
  targetMemberInstanceId: WORKER_ID,
  baseGeneration: 0,
  baseSnapshotId: null,
  desiredEffect: 'deny',
  authorityEnvelopeAst: { kind: 'exact', path: 'shell.exec' },
  requiredAuthority: 'human-user',
  caseFingerprint: 'case-a4pr0-1',
}

/** A multi-rule proposal is carried as MULTIPLE rows sharing one
 *  `caseFingerprint`, one A3-9 AST node per row (spec §8.4 lists the
 *  fingerprint INPUTS; it does not describe the row set). */
const DRAFT_SAME_CASE_SECOND_RULE: GovernanceProposalDraft = {
  ...DRAFT,
  authorityEnvelopeAst: { kind: 'subtree', path: 'fs.write' },
}

/** The nine fields A5-13 freezes, verbatim and sorted. */
const NINE_FIELDS = [
  'authorityEnvelopeAst',
  'baseGeneration',
  'baseSnapshotId',
  'caseFingerprint',
  'desiredEffect',
  'recordedAt',
  'requiredAuthority',
  'status',
  'targetMemberInstanceId',
]

// --- scenario ----------------------------------------------------------------

/** The durable rows of one fact type, in ledger order. */
function rowsOf(world: P6T1World, factType: string): LedgerEntry[] {
  return world.domain.repositories.ledger.list().filter((entry) => entry.factType === factType)
}

/** The record half of a read outcome (fails loudly on a corrupt outcome). */
function recordOf(outcome: GovernanceProposalReadOutcome): ProposalReadRecord {
  if (outcome.kind !== 'record') {
    throw new Error(`expected a record outcome, got '${outcome.kind}'`)
  }
  return outcome
}

type Captured = {
  readonly appendedSequence: number
  readonly lastAppendedSequence: number
  readonly appendedRecord: GovernanceProposalRecord
  readonly proposalRowCount: number
  readonly rowFactType: string
  readonly rowRootSessionId: string
  readonly rowSchemaVersion: number
  readonly rowCreatedAt: string
  readonly firstRowKeys: string[]
  readonly payloadKeys: string[]
  readonly readKinds: string[]
  readonly readRecord: GovernanceProposalRecord
  readonly readOperationIds: (string | undefined)[]
  readonly secondPayloadAst: unknown
  readonly secondPayloadCase: unknown
  readonly explicitUndefinedRowKeys: string[]
  readonly payloadHasUndefinedValue: boolean
  readonly surfacedKinds: string[]
  readonly foreignTeamSurfacedCount: number
  readonly foreignTeamSequenceVisibleHere: boolean
  readonly foreignTeamProposalRowDurable: boolean
  readonly refusalCode: string | undefined
  readonly refusalProblem: string | undefined
  readonly writesBeforeRefusal: number
  readonly writesAfterRefusal: number
  readonly rowsBeforeRefusal: number
  readonly rowsAfterRefusal: number
  readonly reopenedOutcomeCount: number
  readonly reopenedStable: boolean
  readonly disposedBundleBefore: unknown
  readonly disposedBundleAfter: unknown
  readonly teamPolicyFactsBefore: number
  readonly teamPolicyFactsAfter: number
  readonly projectionReadableAfterAppend: boolean
  readonly appendAfterDisposeSequence: number
  readonly derivedSnapshotId: string
}

const captured: Captured = await (async (): Promise<Captured> => {
  const world = await createP6T4World('a4pr0-proposal-store', ['leader', 'worker'])
  try {
    const ledger = world.domain.repositories.ledger
    const store = createGovernanceProposalStore({ ledger, now: () => PROPOSAL_NOW })

    // --- the append: two rows of ONE case, then a key-omission probe -------
    const first = await store.appendProposal({ teamSessionId: P6T4_ROOT, proposal: DRAFT })
    await store.appendProposal({
      teamSessionId: P6T4_ROOT,
      operationId: 'op-a4pr00001',
      proposal: DRAFT_SAME_CASE_SECOND_RULE,
    })
    // An explicit `operationId: undefined` must behave exactly like omitting
    // the key (A5-13's key-omitted optionality).
    const third = await store.appendProposal({
      teamSessionId: P6T4_ROOT,
      operationId: undefined,
      proposal: { ...DRAFT, caseFingerprint: 'case-a4pr0-2' },
    })

    const proposalRows = rowsOf(world, GOVERNANCE_PROPOSAL_FACT_TYPE)
    const firstRow = rowAt(proposalRows, 0)
    const secondRow = rowAt(proposalRows, 1)
    const thirdRow = rowAt(proposalRows, 2)

    const read = store.listProposals({ teamSessionId: P6T4_ROOT })

    // --- filtering: a foreign fact type, and a foreign team's proposal row --
    await writeRawControlFact(world, 'activity-progress-recorded', { note: 'not-a-proposal' })
    // A second TeamSession really exists, so the foreign row is a legitimate
    // stamped write and the ONLY reason it could be missed is the root filter.
    await world.domain.repositories.teamSessions.put({
      rootSessionId: parseRootSessionId(FOREIGN_ROOT),
      blueprint: createBlueprintSnapshotRef({
        blueprintId: world.blueprint.blueprintId,
        revision: world.blueprint.revision,
        contentHash: world.blueprint.contentHash,
      }),
      defaultWorkspace: '/a4pr0/foreign-team',
      createdAt: P6T4_NOW,
      generation: 1,
    })
    const foreignSequence = await ledger.allocateSequence()
    await ledger.put({
      schemaVersion: TEAM_DOMAIN_SCHEMA_VERSION,
      sequence: foreignSequence,
      rootSessionId: parseRootSessionId(FOREIGN_ROOT),
      factType: GOVERNANCE_PROPOSAL_FACT_TYPE,
      payload: { ...DRAFT, status: 'pending', recordedAt: PROPOSAL_NOW },
      createdAt: PROPOSAL_NOW,
    })
    const surfaced = store.listProposals({ teamSessionId: P6T4_ROOT })
    const foreignSurfaced = store.listProposals({ teamSessionId: FOREIGN_ROOT })

    // --- refusal before any write: a base pair that disagrees (A4-3) -------
    const writesBefore = world.seam.writeCount
    const rowsBefore = ledger.entryCount()
    let refusalCode: string | undefined
    let refusalProblem: string | undefined
    try {
      await store.appendProposal({
        teamSessionId: P6T4_ROOT,
        proposal: { ...DRAFT, baseGeneration: 0, baseSnapshotId: `${P6T4_ROOT}#${WORKER_ID}#7` },
      })
    } catch (error) {
      if (!isGovernanceProposalError(error)) {
        throw error
      }
      refusalCode = error.code
      refusalProblem = String(error.details['problem'])
    }
    const writesAfter = world.seam.writeCount
    const rowsAfter = ledger.entryCount()

    // --- reopen over the SAME scratch dir: no in-memory state is authority --
    const reopened = await restartP6T1World(world)
    try {
      const reopenedStore = createGovernanceProposalStore({
        ledger: reopened.domain.repositories.ledger,
        now: () => PROPOSAL_NOW,
      })
      const reopenedRead = reopenedStore.listProposals({ teamSessionId: P6T4_ROOT })
      const reopenedStable = JSON.stringify(reopenedRead) === JSON.stringify(surfaced)

      // --- the disposed-member digest leg (A4-5) ---------------------------
      await flipLifecycle(reopened, WORKER_ID, 'DISPOSED')
      const port = createTeamDomainReadPort(reopened.domain, PORT_DEPS)
      // The read PLANE's subject is `readProjectionSource`: that is where the
      // frozen category table is enforced (`ledgerSummaryOf`, and the
      // `TEAM_PROJECTION_SOURCE_LEDGER_CATEGORY_UNKNOWN` throw), exactly as
      // A4-PR0a's own closure test reads it. The p6t4 world is a control-plane
      // fixture whose Leader seed carries a `childSessionId` (invariant 14), so
      // the downstream DTO validation would assert the FIXTURE rather than this
      // fact type — the fold is a pass-through of `source.generation`
      // (`projection/fold.ts`) over this same source.
      const readProjection = () => port.readProjectionSource(parseRootSessionId(P6T4_ROOT))
      const before = readProjection()
      let readable = false
      let appendedAfterDispose = 0
      try {
        appendedAfterDispose = (
          await reopenedStore.appendProposal({ teamSessionId: P6T4_ROOT, proposal: DRAFT })
        ).sequence
        // The append must not break the projection read (the PR0a defect
        // class: an unmapped category throws on EVERY read, permanently).
        readProjection()
        readable = true
      } catch {
        readable = false
      }
      const after = readProjection()

      return {
        appendedSequence: first.sequence,
        // Three appends of the SAME base pair and case are three rows: the
        // substrate dedupes nothing and rewrites nothing (append-only).
        lastAppendedSequence: third.sequence,
        appendedRecord: first.record,
        proposalRowCount: proposalRows.length,
        rowFactType: firstRow.factType,
        rowRootSessionId: String(firstRow.rootSessionId),
        rowSchemaVersion: firstRow.schemaVersion,
        rowCreatedAt: firstRow.createdAt,
        firstRowKeys: Object.keys(firstRow).sort(),
        payloadKeys: Object.keys(firstRow.payload).sort(),
        readKinds: read.map((outcome) => outcome.kind),
        readRecord: recordOf(outcomeAt(read, 0)).proposal,
        readOperationIds: read.map((outcome) => recordOf(outcome).operationId),
        secondPayloadAst: secondRow.payload['authorityEnvelopeAst'],
        secondPayloadCase: secondRow.payload['caseFingerprint'],
        explicitUndefinedRowKeys: Object.keys(thirdRow).sort(),
        payloadHasUndefinedValue: Object.values(thirdRow.payload).some((v) => v === undefined),
        surfacedKinds: surfaced.map((outcome) => outcome.kind).sort(),
        foreignTeamSurfacedCount: foreignSurfaced.length,
        foreignTeamSequenceVisibleHere: surfaced
          .map((outcome) => outcome.sequence)
          .includes(foreignSequence),
        foreignTeamProposalRowDurable: rowsOf(reopened, GOVERNANCE_PROPOSAL_FACT_TYPE).some(
          (entry) => String(entry.rootSessionId) === FOREIGN_ROOT,
        ),
        refusalCode,
        refusalProblem,
        writesBeforeRefusal: writesBefore,
        writesAfterRefusal: writesAfter,
        rowsBeforeRefusal: rowsBefore,
        rowsAfterRefusal: rowsAfter,
        reopenedOutcomeCount: reopenedRead.length,
        reopenedStable,
        disposedBundleBefore: before.disposedHistory,
        disposedBundleAfter: after.disposedHistory,
        teamPolicyFactsBefore: before.ledger.byCategory['policy'] ?? -1,
        teamPolicyFactsAfter: after.ledger.byCategory['policy'] ?? -1,
        projectionReadableAfterAppend: readable,
        appendAfterDisposeSequence: appendedAfterDispose,
        derivedSnapshotId: permissionOverlaySnapshotKey(P6T4_ROOT, WORKER_ID, 3),
      }
    } finally {
      await destroyP6T1World(reopened)
    }
  } finally {
    await destroyP6T1World(world)
  }
})()

/** Index a captured row, loudly (a missing row is a scenario failure, not a
 *  `undefined` that would make a later assertion vacuously true). */
function rowAt(rows: readonly LedgerEntry[], index: number): LedgerEntry {
  const row = rows[index]
  if (row === undefined) {
    throw new Error(`captured row ${String(index)} is absent (only ${String(rows.length)} rows)`)
  }
  return row
}

/** Index a read outcome, loudly. */
function outcomeAt(outcomes: readonly GovernanceProposalReadOutcome[], index: number): GovernanceProposalReadOutcome {
  const outcome = outcomes[index]
  if (outcome === undefined) {
    throw new Error(`read outcome ${String(index)} is absent (only ${String(outcomes.length)} outcomes)`)
  }
  return outcome
}

// --- assertions ---------------------------------------------------------------

describe('A4-PR0 governance proposal store (durable append / read / reopen)', () => {
  it('S1 one append writes exactly one governance-proposal-recorded ledger row', () => {
    expect(captured.proposalRowCount).toBe(3)
    expect(captured.rowFactType).toBe('governance-proposal-recorded')
    expect(captured.rowRootSessionId).toBe(P6T4_ROOT)
    expect(captured.appendedSequence).toBeGreaterThan(0)
  })

  it('S2 the payload is EXACTLY the nine frozen A5-13 fields — no more, no less', () => {
    expect(captured.payloadKeys).toEqual(NINE_FIELDS)
    // Team identity is the LEDGER ROW's rootSessionId, never a payload field:
    // adding `teamSessionId` would invent a tenth field.
    expect(captured.payloadKeys).not.toContain('teamSessionId')
    expect(captured.rowSchemaVersion).toBe(TEAM_DOMAIN_SCHEMA_VERSION)
    expect(captured.rowCreatedAt).toBe(PROPOSAL_NOW)
  })

  it('S3 the read returns the record the writer was given, key for key', () => {
    expect(captured.readKinds).toEqual(['record', 'record', 'record'])
    expect(captured.readRecord).toEqual({ ...DRAFT, status: 'pending', recordedAt: PROPOSAL_NOW })
    // The second row of the case differs ONLY in the AST node: one node per
    // row, `caseFingerprint` grouping them.
    expect(captured.secondPayloadAst).toEqual({ kind: 'subtree', path: 'fs.write' })
    expect(captured.secondPayloadCase).toBe('case-a4pr0-1')
  })

  it('S4 optionality is KEY-OMITTED — an explicit undefined is never durable (A5-13)', () => {
    // `assertRemoteSafeJsonValue` (`packages/storage/schema/ledger.ts:206` →
    // `packages/contracts/src/remote-safe.ts:70`) rejects `undefined`, and it
    // re-validates the DESERIALIZED row — so a written `undefined` key could
    // only ever read back silently absent. The writer omits the key instead.
    expect(captured.firstRowKeys).not.toContain('operationId')
    expect(captured.explicitUndefinedRowKeys).not.toContain('operationId')
    expect(captured.payloadHasUndefinedValue).toBe(false)
    expect(captured.readOperationIds).toEqual([undefined, 'op-a4pr00001', undefined])
  })

  it('S5 the read is root- and fact-type-filtered (the ledger counter is shared)', () => {
    expect(captured.surfacedKinds).toEqual(['record', 'record', 'record'])
    // The foreign Team reads EXACTLY its own row (the filter is a partition,
    // not a suppression), and its sequence never appears in this Team's read.
    expect(captured.foreignTeamSurfacedCount).toBe(1)
    expect(captured.foreignTeamSequenceVisibleHere).toBe(false)
    expect(captured.foreignTeamProposalRowDurable).toBe(true)
  })

  it('S1b every append takes its own sequence — nothing dedupes or rewrites', () => {
    expect(captured.lastAppendedSequence).toBeGreaterThan(captured.appendedSequence)
  })

  it('S6 a disagreeing base pair is refused before any write or allocation (A4-3)', () => {
    expect(captured.refusalCode).toBe(GOVERNANCE_PROPOSAL_ERROR_CODES.MALFORMED_PROPOSAL)
    expect(captured.refusalProblem).toBe('base-pair-disagreement')
    // Zero write AND zero sequence allocation: validation precedes the ledger.
    expect(captured.writesAfterRefusal).toBe(captured.writesBeforeRefusal)
    expect(captured.rowsAfterRefusal).toBe(captured.rowsBeforeRefusal)
  })

  it('S7 reopen: the record survives from the durable medium, byte-identical', () => {
    // The unit-restart model (invariant 45): re-open the repositories over the
    // SAME scratch dir; nothing in memory is authority.
    expect(captured.reopenedOutcomeCount).toBe(3)
    expect(captured.reopenedStable).toBe(true)
  })

  it('S8 a proposal against a DISPOSED member leaves the retained-history digest alone (A4-5)', () => {
    // `targetMemberInstanceId` is NOT one of the four FACT_ADDRESSING_KEYS, so
    // the row is attributed to the TEAM, not to the disposed member's bundle.
    expect(captured.appendAfterDisposeSequence).toBeGreaterThan(0)
    expect(captured.disposedBundleAfter).toEqual(captured.disposedBundleBefore)
    // …and the fact IS in the team's ledger summary: durable, just not the
    // member's attributed share.
    expect(captured.teamPolicyFactsAfter).toBe(captured.teamPolicyFactsBefore + 1)
    // Registering the category is what keeps the projection readable at all.
    expect(captured.projectionReadableAfterAppend).toBe(true)
  })

  it('S9 the authority field carries the four positions and the status set is closed (A5-1)', () => {
    // Coordinator ruling for PR0: PR0 PERSISTS the four positions ADR A5-1's
    // ladder names and interprets nothing — ranking is PR2's evaluator, and a
    // PR0 comparator would leave PR2's RED with nothing to backstop.
    expect(PROPOSAL_AUTHORITY_POSITIONS).toEqual(['member', 'leader', 'human-user', 'human-admin'])
    expect(GOVERNANCE_PROPOSAL_STATUSES).toEqual(['pending'])
    expect(captured.appendedRecord.status).toBe('pending')
    expect(captured.appendedRecord.requiredAuthority).toBe('human-user')
  })

  it('S10 the effect vocabulary is the canonical overlay effect set (A5-3)', () => {
    expect([...PERMISSION_OVERLAY_EFFECT_VALUES].sort()).toEqual(['allow', 'ask', 'deny'])
    expect(captured.appendedRecord.desiredEffect).toBe('deny')
  })

  it('S11 the mirrored ledger row version equals the storage constant, and the snapshot identity is the derived key', () => {
    // The lane mirrors (not imports) the durable row version — the same
    // discipline as the permission kernel's rule-set bound; the pin makes the
    // mirror checked rather than aspirational.
    expect(GOVERNANCE_PROPOSAL_LEDGER_SCHEMA_VERSION).toBe(TEAM_DOMAIN_SCHEMA_VERSION)
    // A4-3: the pair the base pair is checked against is the DERIVED overlay
    // snapshot identity, so a stored id that is not this string is corrupt.
    expect(captured.derivedSnapshotId).toBe(`${P6T4_ROOT}#${WORKER_ID}#3`)
  })
})

// --- the contract-bounds scenario (review round SF-1, SF-2, SF-6) -----------
//
// The durable p6t4 world cannot express these three cases, and pretending
// otherwise would mean weakening them:
//
//  * a LEGAL MAXIMAL identity (a 255-char TeamSession id and a 37-char
//    MemberInstance id) whose derived snapshot identity is 295 chars — the case
//    a hand-picked 256 bound refuses (reviewer SF-1);
//  * an envelope path containing a SPACE, which the Blueprint grammar accepts;
//  * a refusal that must leave the sequence counter UNMOVED, which needs a
//    counter a durable repository does not expose without allocating one.
//
// All three belong to the writer/reader CONTRACT, and the structural ports exist
// precisely so the contract can be exercised without a storage world. Nothing
// here claims durability — `rows` is an in-memory array, and the durability half
// of the same contract is S1/S7 on the real repository.
type MemoryLedger = {
  readonly port: GovernanceProposalLedgerWriterPort & GovernanceProposalLedgerReaderPort
  readonly rows: GovernanceProposalLedgerRow[]
  allocations(): number
}

function memoryLedger(): MemoryLedger {
  const rows: GovernanceProposalLedgerRow[] = []
  let allocated = 0
  return {
    rows,
    allocations: () => allocated,
    port: {
      async allocateSequence(): Promise<number> {
        allocated += 1
        return 100 + allocated
      },
      async put(row: GovernanceProposalLedgerRow): Promise<unknown> {
        rows.push(row)
        return row
      },
      list: () => rows,
    },
  }
}

const MAX_LENGTH_TEAM = `session-root-${'a'.repeat(255 - 'session-root-'.length)}`
const MAX_LENGTH_INSTANCE = `inst-${'a'.repeat(32)}`
/** team(255) + '#' + instance(37) + '#' + generation digits(1). */
const MAX_LENGTH_SNAPSHOT_ID = `${MAX_LENGTH_TEAM}#${MAX_LENGTH_INSTANCE}#3`

type Bounds = {
  readonly longSnapshotIsLegal: boolean
  readonly longSnapshotLength: number
  readonly longPairReadKind: string
  readonly longPairSnapshotId: string | null
  readonly spacePathProblem: string | undefined
  readonly spacePathRoundTrips: boolean
  readonly blankPathProblem: string | undefined
  readonly controlCharPathProblem: string | undefined
  readonly maxPathAccepted: boolean
  readonly overLongPathProblem: string | undefined
  readonly badOperationIdCode: string | undefined
  readonly badOperationIdProblem: string | undefined
  readonly badOperationIdAllocations: number
  readonly badOperationIdRows: number
}

const bounds = await (async (): Promise<Bounds> => {
  const fresh = (): { store: ReturnType<typeof createGovernanceProposalStore>; ledger: MemoryLedger } => {
    const ledger = memoryLedger()
    return {
      ledger,
      store: createGovernanceProposalStore({ ledger: ledger.port, now: () => PROPOSAL_NOW }),
    }
  }

  // SF-1: a maximal legal identity, whose base pair is legitimately derivable.
  const longLedger = fresh()
  let longProblem: string | undefined
  try {
    await longLedger.store.appendProposal({
      teamSessionId: MAX_LENGTH_TEAM,
      operationId: 'op-a4pr0maximal',
      proposal: {
        targetMemberInstanceId: MAX_LENGTH_INSTANCE,
        baseGeneration: 3,
        baseSnapshotId: MAX_LENGTH_SNAPSHOT_ID,
        desiredEffect: 'allow',
        authorityEnvelopeAst: { kind: 'exact', path: 'shell.exec' },
        requiredAuthority: 'human-admin',
        caseFingerprint: 'case-a4pr0-maximal',
      },
    })
  } catch (error) {
    longProblem = isGovernanceProposalError(error)
      ? String(error.details['problem'])
      : `threw ${String(error)}`
  }
  const longRead = longLedger.store.listProposals({ teamSessionId: MAX_LENGTH_TEAM })
  const longOutcome = longRead[0]

  // SF-2: the path grammar is the Blueprint grammar, not the id grammar.
  const pathProblems: Record<string, string | undefined> = {}
  const pathAccepted: Record<string, boolean> = {}
  const probePath = async (name: string, path: string): Promise<void> => {
    const probe = fresh()
    try {
      await probe.store.appendProposal({
        teamSessionId: P6T4_ROOT,
        proposal: { ...DRAFT, authorityEnvelopeAst: { kind: 'exact', path } },
      })
      pathAccepted[name] = true
      pathProblems[name] = undefined
    } catch (error) {
      pathAccepted[name] = false
      pathProblems[name] = isGovernanceProposalError(error)
        ? String(error.details['problem'])
        : `threw ${String(error)}`
    }
  }
  await probePath('space', 'fs.write:/My Documents/a report.txt')
  await probePath('blank', '   ')
  await probePath('control', 'fs.write:/tmp/\u0007bell')
  await probePath('maxLength', `fs.write:/${'d'.repeat(PERMISSION_PATH_MAX_LENGTH - 'fs.write:/'.length)}`)
  await probePath('overMaxLength', `fs.write:/${'d'.repeat(PERMISSION_PATH_MAX_LENGTH - 'fs.write:/'.length + 1)}`)
  const spaceRead = await (async (): Promise<readonly GovernanceProposalReadOutcome[]> => {
    const probe = fresh()
    await probe.store.appendProposal({
      teamSessionId: P6T4_ROOT,
      proposal: { ...DRAFT, authorityEnvelopeAst: { kind: 'exact', path: 'fs.write:/My Documents/a report.txt' } },
    })
    return probe.store.listProposals({ teamSessionId: P6T4_ROOT })
  })()
  const spaceRecord = spaceRead[0]

  // SF-6: a malformed operationId is THIS lane's refusal, and it allocates nothing.
  const opLedger = fresh()
  let opCode: string | undefined
  let opProblem: string | undefined
  try {
    await opLedger.store.appendProposal({
      teamSessionId: P6T4_ROOT,
      operationId: 'op-A4PR0-0001',
      proposal: DRAFT,
    })
  } catch (error) {
    opCode = isGovernanceProposalError(error) ? error.code : undefined
    opProblem = isGovernanceProposalError(error)
      ? String(error.details['problem'])
      : `threw ${String(error)}`
  }

  return {
    longSnapshotIsLegal: longProblem === undefined,
    longSnapshotLength: MAX_LENGTH_SNAPSHOT_ID.length,
    longPairReadKind: longOutcome?.kind ?? 'no-outcome',
    longPairSnapshotId:
      longOutcome !== undefined && longOutcome.kind === 'record'
        ? longOutcome.proposal.baseSnapshotId
        : null,
    spacePathProblem: pathProblems['space'],
    spacePathRoundTrips:
      spaceRecord !== undefined &&
      spaceRecord.kind === 'record' &&
      spaceRecord.proposal.authorityEnvelopeAst.kind === 'exact' &&
      spaceRecord.proposal.authorityEnvelopeAst.path === 'fs.write:/My Documents/a report.txt',
    blankPathProblem: pathProblems['blank'],
    controlCharPathProblem: pathProblems['control'],
    maxPathAccepted: pathAccepted['maxLength'] === true,
    overLongPathProblem: pathProblems['overMaxLength'],
    badOperationIdCode: opCode,
    badOperationIdProblem: opProblem,
    badOperationIdAllocations: opLedger.ledger.allocations(),
    badOperationIdRows: opLedger.ledger.rows.length,
  }
})()

describe('A4-PR0 contract bounds: the record can express the vocabulary it persists', () => {
  it('B1 a maximal legal snapshot identity (295 chars) appends and reads back SOUND (SF-1)', () => {
    // The bound a proposal record applies to `baseSnapshotId` must be the
    // OWNER'S derived sum, not a hand-picked number: the value is derived as
    // teamSessionId(<=255) + '#' + instanceId(<=37) + '#' + generation, and a
    // smaller bound refuses a legal identity at append while a durable row of it
    // would read back `corrupt-record` — a latent contract break, not a
    // tightening (`storage/schema/permission-overlay.ts:195-219` says exactly
    // this, and this is the test that would have caught PR0's 256).
    expect(capturedLongFact()).toBe(310)
    expect(bounds.longSnapshotLength).toBe(295)
    expect(bounds.longSnapshotLength).toBeGreaterThan(256)
    expect(bounds.longSnapshotIsLegal).toBe(true)
    expect(bounds.longPairReadKind).toBe('record')
    expect(bounds.longPairSnapshotId).toBe(MAX_LENGTH_SNAPSHOT_ID)
    expect(bounds.longPairSnapshotId).toBe(
      permissionOverlaySnapshotKey(MAX_LENGTH_TEAM, MAX_LENGTH_INSTANCE, 3),
    )
  })

  it('B2 an envelope path with a space is SOUND; blank and control-char paths are refused (SF-2)', () => {
    // A3-9 makes the Blueprint/config shape authoritative, and the Blueprint path
    // grammar rejects control characters, a blank-after-trim, and lengths over
    // PERMISSION_PATH_MAX_LENGTH — nothing else. `fs.write:/My Documents/x` is a
    // path the Blueprint accepts, so a proposal record that cannot carry it is a
    // broken substrate.
    expect(bounds.spacePathProblem).toBeUndefined()
    expect(bounds.spacePathRoundTrips).toBe(true)
    expect(bounds.blankPathProblem).toBe('bad-path')
    expect(bounds.controlCharPathProblem).toBe('bad-path')
    expect(bounds.maxPathAccepted).toBe(true)
    expect(bounds.overLongPathProblem).toBe('bad-path')
  })

  it('B3 a malformed operationId is a lane refusal that allocates nothing (SF-6)', () => {
    // `parseLedgerEntry` would catch this too — one step too late, AFTER
    // `allocateSequence()`, and with a storage error instead of a lane code.
    expect(bounds.badOperationIdCode).toBe(GOVERNANCE_PROPOSAL_ERROR_CODES.MALFORMED_PROPOSAL)
    expect(bounds.badOperationIdProblem).toBe('bad-operation-id')
    expect(bounds.badOperationIdAllocations).toBe(0)
    expect(bounds.badOperationIdRows).toBe(0)
    // The mirror is checked, not aspirational (the kernel's discipline).
    expect(GOVERNANCE_PROPOSAL_OPERATION_ID_PATTERN.source).toBe(OPERATION_ID_PATTERN.source)
  })
})

/** The owner's derived bound, asserted as a number so a silent change to ANY of
 *  its four components (255 + 1 + 37 + 1 + 16) turns this red rather than
 *  quietly invalidating B1. */
function capturedLongFact(): number {
  return PERMISSION_OVERLAY_MAX_SNAPSHOT_ID_LENGTH
}
