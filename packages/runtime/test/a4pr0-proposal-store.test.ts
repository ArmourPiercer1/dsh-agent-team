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
  permissionOverlaySnapshotKey,
} from '../../storage/schema/permission-overlay.js'
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
  GOVERNANCE_PROPOSAL_STATUSES,
  PROPOSAL_AUTHORITY_POSITIONS,
  createGovernanceProposalStore,
} from '../governance/proposal-store.js'
import type {
  GovernanceProposalDraft,
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
