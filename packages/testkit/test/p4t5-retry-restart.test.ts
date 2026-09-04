/**
 * p4t5-retry-restart — double retry and process-restart semantics over the
 * FILE-BACKED fault-injection seam (P4-T5, ruling R22):
 *
 * - **double retry**: a crash at B2 / B9 is followed by `recover` #1
 *   (rolls forward with the remaining seam writes) and `recover` #2 (a
 *   0-write no-op) — BOTH retries converge to the same committed member and
 *   the SAME ledger sequence; exactly one committed MemberInstance exists;
 * - **committed-world restart**: the committed `committed-world` fixture is
 *   consumed by a RESTARTED realm (brand-new seam + stack over the same
 *   durable files): the read-back is 0 writes and `recover` is a 0-write
 *   no-op with the same ledger sequence;
 * - **pristine-domain restart**: a realm dropped right after the schema
 *   stamping (eight stamps + the seeded team_sessions row) restarts to
 *   stage `NONE` with the typed `member-not-provisioned` diagnostic (no
 *   orphan, no provisioning state durable yet) and a `recover` commits it
 *   with exactly 9 seam writes;
 * - **second member after restart**: a second instance (inst-beta) commits
 *   INDEPENDENTLY in the restarted realm (its own 8 seam writes — the
 *   ledger counter is already bootstrapped — its own ledger sequence 2,
 *   its own deterministic child), and both members survive a second
 *   restart.
 *
 * Top-level-await pattern; every scratch dir is destroyed in `finally` on
 * both success and failure; the `it` bodies are synchronous.
 *
 * @module p4t5-retry-restart
 */

import { it, expect } from 'vitest'
import {
  P4T5_FIXTURE,
  P4T5_CHILD_SESSION_ID,
  P4T5_REQUEST,
  STAMP_WRITE_COUNT,
  createFileRealm,
  reopenRealm,
  dropRealm,
  armCrashAt,
  capture,
  detailOf,
  operationIdFor,
  provisionRequest,
  destroyScratch,
  copyFixtureIntoScratch,
} from './p4t5-helpers.js'
import {
  deterministicToken,
  PROVISIONING_DIAGNOSTIC_CODES,
  PROVISIONING_STAGES,
  type ProvisionResult,
} from '../../storage/provisioning/index.js'

const ROOT = String(P4T5_FIXTURE.rootSessionId)
const CHILD = String(P4T5_CHILD_SESSION_ID)
const BETA_CHILD = `session-child-${deterministicToken(`${ROOT}\u0000${String(P4T5_FIXTURE.secondInstanceId)}`, 16)}`
const ALPHA_OP_ID = operationIdFor(ROOT, P4T5_REQUEST)

const BETA_REQUEST = provisionRequest({
  instanceId: P4T5_FIXTURE.secondInstanceId,
  label: 'Beta Researcher',
  allocationToken: 'p4t5-alloc-beta-2',
})
const BETA_OP_ID = operationIdFor(ROOT, BETA_REQUEST)

interface RetryData {
  readonly crashOffset: number
  readonly runOk: boolean
  readonly runErrorCode: string | undefined
  readonly runErrorProblem: unknown
  readonly crashWrites: number
  readonly recover1Ok: boolean
  readonly recover1Writes: number
  readonly recover1Committed: boolean
  readonly recover1Stage: string
  readonly recover1Child: string | undefined
  readonly recover1Sequence: number | undefined
  readonly recover2Ok: boolean
  readonly recover2Writes: number
  readonly recover2Sequence: number | undefined
  readonly finalMemberCount: number
  readonly finalFactCount: number
  readonly finalOrphanCount: number
  readonly finalOpPhase: string | undefined
  readonly finalCommitted: boolean
}

/** Crash at `offset`, restart, then double-retry (recover #1 + #2). */
async function runDoubleRetry(scratchBase: string, offset: number): Promise<RetryData> {
  const realm = await createFileRealm(scratchBase)
  try {
    const base = realm.seam.writeCount
    armCrashAt(realm.seam, base, offset)
    const run = await capture(() => realm.coordinator.provision(P4T5_REQUEST))
    const crashWrites = realm.seam.writeCount - base
    await dropRealm(realm)
    const restarted = await reopenRealm(realm.dir)
    const before1 = restarted.seam.writeCount
    const recover1 = await capture(() => restarted.coordinator.recover(P4T5_REQUEST))
    const r1 = recover1.ok && recover1.value !== undefined ? (recover1.value as ProvisionResult) : undefined
    const recover1Writes = restarted.seam.writeCount - before1
    const before2 = restarted.seam.writeCount
    const recover2 = await capture(() => restarted.coordinator.recover(P4T5_REQUEST))
    const r2 = recover2.ok && recover2.value !== undefined ? (recover2.value as ProvisionResult) : undefined
    const recover2Writes = restarted.seam.writeCount - before2
    return {
      crashOffset: offset,
      runOk: run.ok,
      runErrorCode: run.ok || run.error === undefined ? undefined : (run.error as { code?: string }).code,
      runErrorProblem: run.ok || run.error === undefined ? undefined : detailOf(run.error)?.['problem'],
      crashWrites,
      recover1Ok: recover1.ok,
      recover1Writes,
      recover1Committed: r1?.committed ?? false,
      recover1Stage: r1?.stage ?? '',
      recover1Child: r1?.childSessionId,
      recover1Sequence: r1?.ledgerSequence,
      recover2Ok: recover2.ok,
      recover2Writes,
      recover2Sequence: r2?.ledgerSequence,
      finalMemberCount: restarted.domain.repositories.memberInstances.list(ROOT).length,
      finalFactCount: restarted.domain.repositories.ledger.entryCount(),
      finalOrphanCount: restarted.coordinator.listOrphans().length,
      finalOpPhase: restarted.domain.repositories.operations.get(ALPHA_OP_ID)?.phase,
      finalCommitted: restarted.coordinator.status({ instanceId: P4T5_FIXTURE.instanceId }).committed,
    }
  } finally {
    destroyScratch(realm.dir)
  }
}

const b2 = await runDoubleRetry('p4t5r-b2', 1)
const b9 = await runDoubleRetry('p4t5r-b9', 8)

// ------------------------------------------------- committed-world restart

interface CommittedRestartData {
  readonly openOk: boolean
  readonly openErrorCode: string | undefined
  readonly readWrites: number
  readonly stage: string
  readonly committed: boolean
  readonly memberCount: number
  readonly factCount: number
  readonly orphanCount: number
  readonly opPhase: string | undefined
  readonly opChild: string | undefined
  readonly memberChild: string | undefined
  readonly recoverOk: boolean
  readonly recoverWrites: number
  readonly recoverCommitted: boolean
  readonly recoverSequence: number | undefined
  readonly recoverEffectsApplied: number
  readonly recoverEffectsSkipped: number
}

const committedDir = copyFixtureIntoScratch('committed-world', 'p4t5r-committed')
let committed: CommittedRestartData | undefined
try {
  const realm = await reopenRealm(committedDir)
  const readWrites = realm.seam.writeCount // a pure read-back performs no writes
  const status = realm.coordinator.status({ instanceId: P4T5_FIXTURE.instanceId })
  const member = realm.domain.repositories.memberInstances.get(ROOT, String(P4T5_FIXTURE.instanceId))
  const op = realm.domain.repositories.operations.get(ALPHA_OP_ID)
  const beforeRecover = realm.seam.writeCount
  const recover = await capture(() => realm.coordinator.recover(P4T5_REQUEST))
  const result = recover.ok && recover.value !== undefined ? (recover.value as ProvisionResult) : undefined
  committed = {
    openOk: true,
    openErrorCode: undefined,
    readWrites,
    stage: status.stage,
    committed: status.committed,
    memberCount: realm.domain.repositories.memberInstances.list(ROOT).length,
    factCount: realm.domain.repositories.ledger.entryCount(),
    orphanCount: realm.coordinator.listOrphans().length,
    opPhase: op?.phase,
    opChild: op !== undefined && op.childSessionId !== undefined ? String(op.childSessionId) : undefined,
    memberChild: member !== undefined ? String(member.childSessionId) : undefined,
    recoverOk: recover.ok,
    recoverWrites: realm.seam.writeCount - beforeRecover,
    recoverCommitted: result?.committed ?? false,
    recoverSequence: result?.ledgerSequence,
    recoverEffectsApplied: result?.effectsApplied ?? -1,
    recoverEffectsSkipped: result?.effectsSkipped ?? -1,
  }
} catch (error) {
  committed = {
    openOk: false,
    openErrorCode: error instanceof Error ? (error as { code?: string }).code : undefined,
    readWrites: -1,
    stage: '',
    committed: false,
    memberCount: -1,
    factCount: -1,
    orphanCount: -1,
    opPhase: undefined,
    opChild: undefined,
    memberChild: undefined,
    recoverOk: false,
    recoverWrites: -1,
    recoverCommitted: false,
    recoverSequence: undefined,
    recoverEffectsApplied: -1,
    recoverEffectsSkipped: -1,
  }
} finally {
  destroyScratch(committedDir)
}

// ------------------------------------------------- pristine-domain restart

interface PristineRestartData {
  readonly openOk: boolean
  readonly base: number
  readonly stage: string
  readonly committed: boolean
  readonly diagnostic: string | undefined
  readonly orphanCount: number
  readonly memberCount: number
  readonly opPresent: boolean
  readonly recoverOk: boolean
  readonly recoverWrites: number
  readonly recoverCommitted: boolean
  readonly recoverSequence: number | undefined
  readonly noOpWrites: number
  readonly postMemberCount: number
}

const pristineRealm = await createFileRealm('p4t5r-pristine')
const pristineBase = pristineRealm.seam.writeCount
await dropRealm(pristineRealm)
let pristine: PristineRestartData | undefined
try {
  const realm = await reopenRealm(pristineRealm.dir)
  const reopenedBase = realm.seam.writeCount // a restart performs no writes (the stamps are already durable)
  const status = realm.coordinator.status({ instanceId: P4T5_FIXTURE.instanceId })
  const op = realm.domain.repositories.operations.get(ALPHA_OP_ID)
  const preOrphans = realm.coordinator.listOrphans().length
  const preMembers = realm.domain.repositories.memberInstances.list(ROOT).length
  const beforeRecover = realm.seam.writeCount
  const recover = await capture(() => realm.coordinator.recover(P4T5_REQUEST))
  const result = recover.ok && recover.value !== undefined ? (recover.value as ProvisionResult) : undefined
  const beforeNoOp = realm.seam.writeCount
  const noOp = await capture(() => realm.coordinator.recover(P4T5_REQUEST))
  pristine = {
    openOk: true,
    base: reopenedBase,
    stage: status.stage,
    committed: status.committed,
    diagnostic: status.diagnostic !== undefined ? status.diagnostic.code : undefined,
    orphanCount: preOrphans,
    memberCount: preMembers,
    opPresent: op !== undefined,
    recoverOk: recover.ok,
    recoverWrites: realm.seam.writeCount - beforeRecover,
    recoverCommitted: result?.committed ?? false,
    recoverSequence: result?.ledgerSequence,
    noOpWrites: noOp.ok ? realm.seam.writeCount - beforeNoOp : -1,
    postMemberCount: realm.domain.repositories.memberInstances.list(ROOT).length,
  }
} finally {
  destroyScratch(pristineRealm.dir)
}

// ------------------------------------------------- second member after restart

interface SecondMemberData {
  readonly alphaCommitted: boolean
  readonly alphaSequence: number
  readonly restartOpenOk: boolean
  readonly betaRunOk: boolean
  readonly betaWrites: number
  readonly betaCommitted: boolean
  readonly betaSequence: number | undefined
  readonly betaChild: string | undefined
  readonly memberCount: number
  readonly factCount: number
  readonly orphanCount: number
  readonly alphaOpPhase: string | undefined
  readonly betaOpPhase: string | undefined
  readonly secondRestartOpenOk: boolean
  readonly secondMemberCount: number
  readonly secondOrphanCount: number
  readonly secondAlphaCommitted: boolean
  readonly secondBetaCommitted: boolean
  readonly secondAlphaNoOpWrites: number
  readonly secondBetaNoOpWrites: number
}

const secondRealm = await createFileRealm('p4t5r-beta')
const secondAlpha = await secondRealm.coordinator.provision(P4T5_REQUEST)
const secondAlphaSequence = secondAlpha.ledgerSequence ?? -1
await dropRealm(secondRealm)
let second: SecondMemberData | undefined
try {
  const restarted = await reopenRealm(secondRealm.dir)
  const beforeBeta = restarted.seam.writeCount
  const betaRun = await capture(() => restarted.coordinator.provision(BETA_REQUEST))
  const betaResult = betaRun.ok && betaRun.value !== undefined ? (betaRun.value as ProvisionResult) : undefined
  const beforeNoOp = restarted.seam.writeCount
  await capture(() => restarted.coordinator.recover(P4T5_REQUEST))
  const alphaNoOpWrites = restarted.seam.writeCount - beforeNoOp
  await capture(() => restarted.coordinator.recover(BETA_REQUEST))
  const betaNoOpWrites = restarted.seam.writeCount - beforeNoOp - alphaNoOpWrites
  await dropRealm(restarted)
  const again = await reopenRealm(secondRealm.dir)
  second = {
    alphaCommitted: secondAlpha.committed,
    alphaSequence: secondAlphaSequence,
    restartOpenOk: true,
    betaRunOk: betaRun.ok,
    betaWrites: restarted.seam.writeCount - beforeBeta,
    betaCommitted: betaResult?.committed ?? false,
    betaSequence: betaResult?.ledgerSequence,
    betaChild: betaResult?.childSessionId,
    memberCount: again.domain.repositories.memberInstances.list(ROOT).length,
    factCount: again.domain.repositories.ledger.entryCount(),
    orphanCount: again.coordinator.listOrphans().length,
    alphaOpPhase: again.domain.repositories.operations.get(ALPHA_OP_ID)?.phase,
    betaOpPhase: again.domain.repositories.operations.get(BETA_OP_ID)?.phase,
    secondRestartOpenOk: true,
    secondMemberCount: again.domain.repositories.memberInstances.list(ROOT).length,
    secondOrphanCount: again.coordinator.listOrphans().length,
    secondAlphaCommitted: again.coordinator.status({ instanceId: P4T5_FIXTURE.instanceId }).committed,
    secondBetaCommitted: again.coordinator.status({ instanceId: P4T5_FIXTURE.secondInstanceId }).committed,
    secondAlphaNoOpWrites: alphaNoOpWrites,
    secondBetaNoOpWrites: betaNoOpWrites,
  }
} finally {
  destroyScratch(secondRealm.dir)
}

// ------------------------------------------------------------------- tests

it('double retry at B2 (crash after op prepare): recover#1 writes the 8 remaining seam writes, recover#2 is a 0-write no-op, same ledger sequence', () => {
  expect(b2.runOk).toBe(false)
  expect(b2.runErrorCode).toBe('SEAM_FAILURE')
  expect(b2.runErrorProblem).toBe('unclassified-seam-error')
  expect(b2.crashWrites).toBe(1)
  expect(b2.recover1Ok).toBe(true)
  expect(b2.recover1Writes).toBe(8)
  expect(b2.recover1Committed).toBe(true)
  expect(b2.recover1Stage).toBe(PROVISIONING_STAGES.INSTANCE_COMMITTED)
  expect(b2.recover1Child).toBe(CHILD)
  expect(b2.recover1Sequence).toBe(1)
  expect(b2.recover2Ok).toBe(true)
  expect(b2.recover2Writes).toBe(0)
  expect(b2.recover2Sequence).toBe(1)
})

it('double retry at B9 (crash before the COMMITTED row, fact + stamp already durable): recover#1 writes exactly 1 seam write, recover#2 is a 0-write no-op, same ledger sequence', () => {
  expect(b9.runOk).toBe(false)
  expect(b9.crashWrites).toBe(8)
  expect(b9.recover1Ok).toBe(true)
  expect(b9.recover1Writes).toBe(1)
  expect(b9.recover1Committed).toBe(true)
  expect(b9.recover1Sequence).toBe(1)
  expect(b9.recover2Ok).toBe(true)
  expect(b9.recover2Writes).toBe(0)
  expect(b9.recover2Sequence).toBe(1)
})

it('both double-retry worlds converge to EXACTLY ONE committed MemberInstance (1 member, 1 fact, 0 orphans, COMMITTED row)', () => {
  for (const data of [b2, b9]) {
    expect(data.finalMemberCount).toBe(1)
    expect(data.finalFactCount).toBe(1)
    expect(data.finalOrphanCount).toBe(0)
    expect(data.finalOpPhase).toBe('COMMITTED')
    expect(data.finalCommitted).toBe(true)
  }
})

it('committed-world restart (fixture consumed): the restarted realm reads back the committed world with 0 seam writes', () => {
  expect(committed).not.toBe(undefined)
  expect(committed?.openOk).toBe(true)
  expect(committed?.readWrites).toBe(0)
  expect(committed?.stage).toBe(PROVISIONING_STAGES.INSTANCE_COMMITTED)
  expect(committed?.committed).toBe(true)
  expect(committed?.memberCount).toBe(1)
  expect(committed?.factCount).toBe(1)
  expect(committed?.orphanCount).toBe(0)
  expect(committed?.opPhase).toBe('COMMITTED')
  expect(committed?.opChild).toBe(CHILD)
  expect(committed?.memberChild).toBe(CHILD)
})

it('committed-world restart: recover is a 0-write no-op with the SAME ledger sequence (nothing is re-applied)', () => {
  expect(committed?.recoverOk).toBe(true)
  expect(committed?.recoverWrites).toBe(0)
  expect(committed?.recoverCommitted).toBe(true)
  expect(committed?.recoverSequence).toBe(1)
  expect(committed?.recoverEffectsApplied).toBe(0)
  expect(committed?.recoverEffectsSkipped).toBe(0)
})

it('pristine-domain restart: process death before ANY provisioning write leaves a stamped domain (the seeded team row is the only durable row) that restarts to NONE + member-not-provisioned (no orphan, no provisioning state)', () => {
  expect(pristine).not.toBe(undefined)
  expect(pristineBase).toBe(STAMP_WRITE_COUNT + 1) // createFileRealm stamped the eight stores plus the seeded team_sessions row (G8-S1)
  expect(pristine?.openOk).toBe(true)
  expect(pristine?.base).toBe(0) // the restarted seam counts no writes (fresh stack)
  expect(pristine?.stage).toBe(PROVISIONING_STAGES.NONE)
  expect(pristine?.committed).toBe(false)
  expect(pristine?.diagnostic).toBe(PROVISIONING_DIAGNOSTIC_CODES.MEMBER_NOT_PROVISIONED)
  expect(pristine?.orphanCount).toBe(0)
  expect(pristine?.memberCount).toBe(0)
  expect(pristine?.opPresent).toBe(false)
})

it('pristine-domain restart: recover commits the member with exactly 9 seam writes, then a 0-write no-op', () => {
  expect(pristine?.recoverOk).toBe(true)
  expect(pristine?.recoverWrites).toBe(9)
  expect(pristine?.recoverCommitted).toBe(true)
  expect(pristine?.recoverSequence).toBe(1)
  expect(pristine?.noOpWrites).toBe(0)
  expect(pristine?.postMemberCount).toBe(1) // the recovered commit is the ONLY durable member
})

it('second member commits INDEPENDENTLY after a restart: inst-beta drives its own 8 seam writes (the ledger counter is already bootstrapped) to ledger sequence 2 with its own deterministic child', () => {
  expect(second).not.toBe(undefined)
  expect(second?.alphaCommitted).toBe(true)
  expect(second?.alphaSequence).toBe(1)
  expect(second?.restartOpenOk).toBe(true)
  expect(second?.betaRunOk).toBe(true)
  expect(second?.betaWrites).toBe(8)
  expect(second?.betaCommitted).toBe(true)
  expect(second?.betaSequence).toBe(2)
  expect(second?.betaChild).toBe(BETA_CHILD)
  expect(second?.memberCount).toBe(2)
  expect(second?.factCount).toBe(2)
  expect(second?.orphanCount).toBe(0)
  expect(second?.alphaOpPhase).toBe('COMMITTED')
  expect(second?.betaOpPhase).toBe('COMMITTED')
  expect(second?.secondAlphaNoOpWrites).toBe(0)
  expect(second?.secondBetaNoOpWrites).toBe(0)
})

it('second restart: BOTH members survive (2 committed members, 0 orphans, both statuses committed)', () => {
  expect(second?.secondRestartOpenOk).toBe(true)
  expect(second?.secondMemberCount).toBe(2)
  expect(second?.secondOrphanCount).toBe(0)
  expect(second?.secondAlphaCommitted).toBe(true)
  expect(second?.secondBetaCommitted).toBe(true)
})

it('the fresh realm always starts at exactly the eight schema_meta stamp writes', () => {
  expect(STAMP_WRITE_COUNT).toBe(8)
})
