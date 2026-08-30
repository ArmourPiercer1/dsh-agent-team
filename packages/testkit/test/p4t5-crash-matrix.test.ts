/**
 * p4t5-crash-matrix — the FILE-BACKED 10-boundary fault-injection matrix
 * (P4-T5, ruling R22). For every Development Plan §17.4 durable-write
 * boundary:
 *
 * 1. FRESH realm: file seam + `createTeamDomain` (8 stamp writes) over a
 *    fresh scratch dir;
 * 2. ARM the seam crash after `8 + offset` total writes; drive
 *    `provision` — the fault fires mid-atomic-write at that boundary
 *    (the `.tmp` file is left behind, the target keeps the old bytes);
 * 3. assert the durable state the crash leaves (per-store row counts from
 *    the durable files, the derived stage, the orphan diagnostic, the
 *    operation row, the crash-leftover tmp);
 * 4. PROCESS RESTART: drop the whole realm (all in-memory state lost) and
 *    reopen a BRAND-NEW seam + TeamDomain + fresh deterministic fake adapter
 *    + coordinator over the SAME scratch dir;
 * 5. `recover` must roll forward with exactly `8 - offset` seam writes to
 *    EXACTLY ONE committed MemberInstance (0 orphans, 1 fact, COMMITTED row);
 * 6. a second `recover` is a 0-write no-op with the same ledger sequence.
 *
 * Top-level-await pattern: every realm is built, crashed, restarted and
 * destroyed at module top level (the scratch dir is deleted in `finally`
 * on both success and failure); the `it` bodies are synchronous and assert
 * only over the captured data.
 *
 * @module p4t5-crash-matrix
 */

import { it, expect } from 'vitest'
import {
  BOUNDARIES,
  P4T5_FIXTURE,
  P4T5_CHILD_SESSION_ID,
  P4T5_REQUEST,
  STAMP_WRITE_COUNT,
  FAULT_DOMAIN_NAME,
  createFileRealm,
  reopenRealm,
  dropRealm,
  armCrashAt,
  capture,
  detailOf,
  isCrashFault,
  operationIdFor,
  destroyScratch,
  durableTablePath,
  type BoundarySpec,
} from './p4t5-helpers.js'
import { listFiles, readText } from '../fault-injection/file-seam.mjs'
import { PROVISIONING_DIAGNOSTIC_CODES, PROVISIONING_STAGES } from '../../storage/provisioning/index.js'

const ROOT = String(P4T5_FIXTURE.rootSessionId)
const CHILD = String(P4T5_CHILD_SESSION_ID)
const OP_ID = operationIdFor(ROOT, P4T5_REQUEST)

/** The table that owns the seam write each crashing boundary's fault fires in. */
const CRASH_TABLE: Record<string, string> = {
  B1: 'operations',
  B2: 'operations',
  B3: 'operations',
  B4: 'member_instances',
  B5: 'session_bindings',
  B6: 'ledger',
  B8: 'ledger',
  B9: 'operations',
}

/** The durable per-store row counts the crash of one offset leaves behind. */
function expectedRows(offset: number): { operations: number; member_instances: number; session_bindings: number; ledger: number } {
  return {
    operations: offset >= 1 ? 1 : 0,
    member_instances: offset >= 3 ? 1 : 0,
    session_bindings: offset >= 4 ? 1 : 0,
    ledger: offset < 5 ? 0 : offset < 7 ? 1 : 2,
  }
}

interface BoundaryData {
  readonly spec: BoundarySpec
  readonly base: number
  readonly runOk: boolean
  readonly runErrorCode: string | undefined
  readonly runErrorProblem: unknown
  readonly runErrorSeamCode: unknown
  readonly runErrorIsCrash: boolean
  readonly crashWrites: number
  readonly tmpFiles: string[]
  readonly postTmpFiles: string[]
  readonly preStage: string
  readonly preCommitted: boolean
  readonly preDiagnostic: string | undefined
  readonly preOrphanCount: number
  readonly preOrphanMissing: readonly string[]
  readonly preOpPhase: string | undefined
  readonly preOpChild: string | undefined
  readonly preRows: { operations: number; member_instances: number; session_bindings: number; ledger: number }
  readonly preMemberCount: number
  readonly preFactCount: number
  readonly recoverOk: boolean
  readonly recoverErrorCode: string | undefined
  readonly recoveryWrites: number
  readonly committed: boolean
  readonly stage: string
  readonly childSessionId: string | undefined
  readonly ledgerSequence: number | undefined
  readonly effectsApplied: number
  readonly effectsSkipped: number
  readonly postCreateCalls: number
  readonly postChildren: number
  readonly finalMemberCount: number
  readonly finalFactCount: number
  readonly finalOrphanCount: number
  readonly finalOpPhase: string | undefined
  readonly finalStage: string
  readonly finalCommitted: boolean
  readonly noOpOk: boolean
  readonly noOpWrites: number
  readonly noOpSequence: number | undefined
}

function tableRowCount(dir: string, table: string): number {
  const parsed: unknown = JSON.parse(readText(durableTablePath(dir, table)))
  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return 0
  return Object.keys(parsed).length
}

async function runBoundary(spec: BoundarySpec): Promise<BoundaryData> {
  const realm = await createFileRealm(`p4t5m-${spec.id}`)
  try {
    const base = realm.seam.writeCount
    if (spec.crashes) armCrashAt(realm.seam, base, spec.offset)
    const run = await capture(() => realm.coordinator.provision(P4T5_REQUEST))
    const crashWrites = realm.seam.writeCount - base
    const domainDir = realm.seam.dirFor(FAULT_DOMAIN_NAME)
    const tmpFiles = listFiles(domainDir).filter((f) => f.endsWith('.tmp')).sort()
    const preStatus = realm.coordinator.status({ instanceId: P4T5_FIXTURE.instanceId })
    const preOrphans = realm.coordinator.listOrphans()
    const orphan = preOrphans[0]
    const preOp = realm.domain.repositories.operations.get(OP_ID)
    const preRows = {
      operations: tableRowCount(realm.dir, 'operations'),
      member_instances: tableRowCount(realm.dir, 'member_instances'),
      session_bindings: tableRowCount(realm.dir, 'session_bindings'),
      ledger: tableRowCount(realm.dir, 'ledger'),
    }
    const preMemberCount = realm.domain.repositories.memberInstances.list(ROOT).length
    const preFactCount = realm.domain.repositories.ledger.entryCount()

    // ---- the crash has happened; now the PROCESS RESTARTS
    await dropRealm(realm)
    const restarted = await reopenRealm(realm.dir)
    const preRecoverWrites = restarted.seam.writeCount
    const recover = await capture(() => restarted.coordinator.recover(P4T5_REQUEST))
    const result = recover.ok && recover.value !== undefined ? (recover.value as {
      readonly committed: boolean
      readonly stage: string
      readonly childSessionId: string | undefined
      readonly ledgerSequence: number | undefined
      readonly effectsApplied: number
      readonly effectsSkipped: number
    }) : undefined
    const recoveryWrites = restarted.seam.writeCount - preRecoverWrites
    const noOp = await capture(() => restarted.coordinator.recover(P4T5_REQUEST))
    const noOpResult = noOp.ok && noOp.value !== undefined ? (noOp.value as { ledgerSequence: number | undefined }) : undefined
    const noOpWrites = restarted.seam.writeCount - preRecoverWrites - recoveryWrites
    const finalStatus = restarted.coordinator.status({ instanceId: P4T5_FIXTURE.instanceId })
    const finalOp = restarted.domain.repositories.operations.get(OP_ID)

    return {
      spec,
      base,
      runOk: run.ok,
      runErrorCode: run.ok || run.error === undefined ? undefined : (run.error as { code?: string }).code,
      runErrorProblem: run.ok || run.error === undefined ? undefined : detailOf(run.error)?.['problem'],
      runErrorSeamCode: run.ok || run.error === undefined ? undefined : detailOf(run.error)?.['seamCode'],
      runErrorIsCrash: run.ok || run.error === undefined ? false : isCrashFault(run.error),
      crashWrites,
      tmpFiles,
      postTmpFiles: listFiles(restarted.seam.dirFor(FAULT_DOMAIN_NAME)).filter((f) => f.endsWith('.tmp')).sort(),
      preStage: preStatus.stage,
      preCommitted: preStatus.committed,
      preDiagnostic: preStatus.diagnostic !== undefined ? preStatus.diagnostic.code : undefined,
      preOrphanCount: preOrphans.length,
      preOrphanMissing: orphan !== undefined && orphan.context !== undefined && Array.isArray(orphan.context['missing'])
        ? (orphan.context['missing'] as readonly string[])
        : [],
      preOpPhase: preOp !== undefined ? preOp.phase : undefined,
      preOpChild: preOp !== undefined && preOp.childSessionId !== undefined ? String(preOp.childSessionId) : undefined,
      preRows,
      preMemberCount,
      preFactCount,
      recoverOk: recover.ok,
      recoverErrorCode: recover.ok || recover.error === undefined ? undefined : (recover.error as { code?: string }).code,
      recoveryWrites,
      committed: result?.committed ?? false,
      stage: result?.stage ?? '',
      childSessionId: result?.childSessionId,
      ledgerSequence: result?.ledgerSequence,
      effectsApplied: result?.effectsApplied ?? -1,
      effectsSkipped: result?.effectsSkipped ?? -1,
      postCreateCalls: restarted.adapter.createCalls,
      postChildren: restarted.adapter.childrenCreated,
      finalMemberCount: restarted.domain.repositories.memberInstances.list(ROOT).length,
      finalFactCount: restarted.domain.repositories.ledger.entryCount(),
      finalOrphanCount: restarted.coordinator.listOrphans().length,
      finalOpPhase: finalOp !== undefined ? finalOp.phase : undefined,
      finalStage: finalStatus.stage,
      finalCommitted: finalStatus.committed,
      noOpOk: noOp.ok,
      noOpWrites,
      noOpSequence: noOpResult?.ledgerSequence,
    }
  } finally {
    destroyScratch(realm.dir)
  }
}

const boundaryData: BoundaryData[] = []
for (const spec of BOUNDARIES) {
  boundaryData.push(await runBoundary(spec))
}

const row = (id: string): BoundaryData => {
  const found = boundaryData.find((d) => d.spec.id === id)
  if (found === undefined) throw new Error(`missing boundary row ${id}`)
  return found
}

const EXPECTED_PRE = {
  B1: { stage: PROVISIONING_STAGES.NONE, diagnostic: PROVISIONING_DIAGNOSTIC_CODES.MEMBER_NOT_PROVISIONED, orphans: 0, missing: [] as readonly string[] },
  B2: { stage: PROVISIONING_STAGES.ALLOCATED, diagnostic: undefined, orphans: 0, missing: [] as readonly string[] },
  B3: { stage: PROVISIONING_STAGES.ALLOCATED, diagnostic: undefined, orphans: 0, missing: [] as readonly string[] },
  B4: { stage: PROVISIONING_STAGES.CHILD_SESSION_CREATED, diagnostic: PROVISIONING_DIAGNOSTIC_CODES.ORPHANED_CHILD_SESSION, orphans: 1, missing: ['record', 'binding', 'commit'] as readonly string[] },
  B5: { stage: PROVISIONING_STAGES.CHILD_SESSION_CREATED, diagnostic: PROVISIONING_DIAGNOSTIC_CODES.ORPHANED_CHILD_SESSION, orphans: 1, missing: ['binding', 'commit'] as readonly string[] },
  B6: { stage: PROVISIONING_STAGES.CHILD_BOUND, diagnostic: PROVISIONING_DIAGNOSTIC_CODES.ORPHANED_CHILD_SESSION, orphans: 1, missing: ['commit'] as readonly string[] },
  B7: { stage: PROVISIONING_STAGES.INSTANCE_COMMITTED, diagnostic: undefined, orphans: 0, missing: [] as readonly string[] },
  B8: { stage: PROVISIONING_STAGES.CHILD_BOUND, diagnostic: PROVISIONING_DIAGNOSTIC_CODES.ORPHANED_CHILD_SESSION, orphans: 1, missing: ['commit'] as readonly string[] },
  B9: { stage: PROVISIONING_STAGES.CHILD_BOUND, diagnostic: PROVISIONING_DIAGNOSTIC_CODES.ORPHANED_CHILD_SESSION, orphans: 1, missing: ['commit'] as readonly string[] },
  B10: { stage: PROVISIONING_STAGES.INSTANCE_COMMITTED, diagnostic: undefined, orphans: 0, missing: [] as readonly string[] },
}

for (const id of ['B1', 'B2', 'B3', 'B4', 'B5', 'B6', 'B7', 'B8', 'B9', 'B10'] as const) {
  it(`boundary ${id} (${row(id).spec.boundary}): file-backed crash → process restart → exactly one committed MemberInstance`, () => {
    const d = row(id)
    const spec = d.spec
    const pre = EXPECTED_PRE[id]
    const rows = expectedRows(spec.offset)

    // -- the fresh realm: exactly the eight schema_meta stamp writes
    expect(d.base).toBe(STAMP_WRITE_COUNT)

    if (spec.crashes) {
      // -- the drive stopped at the armed boundary, classified as SEAM_FAILURE
      expect(d.runOk).toBe(false)
      expect(d.runErrorCode).toBe('SEAM_FAILURE')
      expect(d.runErrorProblem).toBe('unclassified-seam-error')
      expect(d.runErrorSeamCode).toBe(undefined)
      expect(d.runErrorIsCrash).toBe(false)
      // exactly the offset writes committed before the fault fired
      expect(d.crashWrites).toBe(spec.offset)
      // exactly ONE crash-leftover tmp, owned by the crashed write's table
      expect(d.tmpFiles.length).toBe(1)
      expect(d.tmpFiles[0]).not.toBe(undefined)
      expect(d.tmpFiles[0]?.startsWith(`${CRASH_TABLE[spec.id]}.json.`)).toBe(true)
      // the durable state the crash leaves
      expect(d.preRows).toEqual(rows)
      expect(d.preStage).toBe(spec.expectedPostCrashStage)
      expect(d.preStage).toBe(pre.stage)
      expect(d.preCommitted).toBe(false)
      expect(d.preDiagnostic).toBe(pre.diagnostic)
      expect(d.preOrphanCount).toBe(pre.orphans)
      expect(d.preOrphanMissing).toEqual(pre.missing)
      expect(d.preMemberCount).toBe(rows.member_instances)
      expect(d.preFactCount).toBe(spec.id === 'B9' ? 1 : spec.id === 'B7' || spec.id === 'B10' ? 1 : 0)
      if (spec.offset >= 1) {
        expect(d.preOpPhase).toBe('PREPARED')
      } else {
        expect(d.preOpPhase).toBe(undefined)
      }
      if (spec.offset >= 2) {
        expect(d.preOpChild).toBe(CHILD)
      } else {
        expect(d.preOpChild).toBe(undefined)
      }
    } else {
      // -- the no-crash boundaries: the drive committed end-to-end
      expect(d.runOk).toBe(true)
      expect(d.crashWrites).toBe(8)
      expect(d.tmpFiles.length).toBe(0)
      expect(d.preStage).toBe(spec.expectedPostCrashStage)
      expect(d.preStage).toBe(pre.stage)
      expect(d.preCommitted).toBe(true)
      expect(d.preDiagnostic).toBe(undefined)
      expect(d.preOrphanCount).toBe(0)
      expect(d.preMemberCount).toBe(1)
      expect(d.preFactCount).toBe(1)
      expect(d.preOpPhase).toBe('COMMITTED')
    }

    // -- after the process restart + recover: EXACTLY ONE committed instance
    expect(d.recoverOk).toBe(true)
    expect(d.recoveryWrites).toBe(spec.expectedRecoveryWrites)
    expect(d.committed).toBe(true)
    expect(d.stage).toBe(PROVISIONING_STAGES.INSTANCE_COMMITTED)
    expect(d.childSessionId).toBe(CHILD)
    expect(d.ledgerSequence).toBe(1)
    expect(d.effectsApplied).toBe(0)
    expect(d.effectsSkipped).toBe(0)
    expect(d.finalMemberCount).toBe(1)
    expect(d.finalFactCount).toBe(1)
    expect(d.finalOrphanCount).toBe(0)
    expect(d.finalOpPhase).toBe('COMMITTED')
    expect(d.finalStage).toBe(PROVISIONING_STAGES.INSTANCE_COMMITTED)
    expect(d.finalCommitted).toBe(true)
    // the restarted deterministic adapter re-mints the child only when the
    // child was NOT yet durably recorded (B1–B3), and reuses it otherwise
    expect(d.postCreateCalls).toBe(spec.offset >= 2 ? 0 : 1)
    expect(d.postChildren).toBe(spec.offset >= 2 ? 0 : 1)

    // -- a second recover is a 0-write no-op with the same ledger sequence
    expect(d.noOpOk).toBe(true)
    expect(d.noOpWrites).toBe(0)
    expect(d.noOpSequence).toBe(1)

    // -- the crash-leftover tmp survived the restart and was IGNORED
    // (the final world is still exactly one committed instance)
    if (spec.crashes) {
      expect(d.postTmpFiles).toEqual(d.tmpFiles)
    } else {
      expect(d.postTmpFiles.length).toBe(0)
    }
  })
}

it('seam-write arithmetic: offset + recoveryWrites === 8 for every crashing boundary; the no-crash boundaries write all 8', () => {
  for (const d of boundaryData) {
    if (d.spec.crashes) {
      expect(d.spec.offset + d.spec.expectedRecoveryWrites).toBe(8)
      expect(d.crashWrites + d.recoveryWrites).toBe(8)
    } else {
      expect(d.spec.offset).toBe(8)
      expect(d.crashWrites).toBe(8)
      expect(d.recoveryWrites).toBe(0)
    }
  }
})

it('every crash boundary left the crashed table file VALID (the target kept the old bytes — no torn target)', () => {
  for (const d of boundaryData.filter((b) => b.spec.crashes)) {
    // the target file of the crashed write must not contain the new row:
    // re-derived from the captured durable row counts (the tmp carried the
    // new document, the target kept the previous one)
    const rows = expectedRows(d.spec.offset)
    expect(d.preRows).toEqual(rows)
    // and the operation row, when present before W8, is still PREPARED
    if (d.spec.offset >= 1 && d.spec.offset < 8) {
      expect(d.preOpPhase).toBe('PREPARED')
    }
  }
})

it('shared seam states: B2/B3 (offset 1) and B6/B8 (offset 4) leave identical durable worlds', () => {
  const b2 = row('B2')
  const b3 = row('B3')
  expect(b2.crashWrites).toBe(b3.crashWrites)
  expect(b2.preRows).toEqual(b3.preRows)
  expect(b2.recoveryWrites).toBe(b3.recoveryWrites)
  expect(b2.preOpChild).toBe(b3.preOpChild)
  const b6 = row('B6')
  const b8 = row('B8')
  expect(b6.crashWrites).toBe(b8.crashWrites)
  expect(b6.preRows).toEqual(b8.preRows)
  expect(b6.recoveryWrites).toBe(b8.recoveryWrites)
  expect(b6.preOpChild).toBe(b8.preOpChild)
})
