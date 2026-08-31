/**
 * p4t5-corrupt-version — the REQUIRED corrupt-version sub-cases over the
 * FILE-BACKED seam (P4-T5, ruling R22). Every case consumes the committed
 * `committed-world` fixture (a deterministic pre-built durable-store
 * snapshot: it is COPIED into a fresh scratch dir, corrupted, then reopened
 * by a brand-new stack — the process-restart model) unless noted:
 *
 * - **(a) version tamper fails LOUDLY, never migrates** (SUPPORTED = [1],
 *   no built-in migration):
 *   - (a1) a tampered `schema_meta` stamp (store `ledger`, version 1→2) →
 *     `SCHEMA_STAMP_MISMATCH` naming the exact store, expected and found;
 *   - (a2) a tampered domain meta stamp (L1, version 1→2) → the seam's
 *     `version-mismatch` mapped by the facade to `SCHEMA_VERSION_MISMATCH`;
 * - **(b) corrupted record bodies produce TYPED errors, never silent**:
 *   - (b1) a truncated `member_instances.json` → the medium is
 *     `malformed-medium` at open → `SEAM_FAILURE` (seamCode surfaced);
 *   - (b2) a garbage record body (valid table JSON, row value not valid
 *     record JSON) → open succeeds, the hydration READ fails with
 *     `RECORD_INVALID` preserving contractsCode `MALFORMED_DTO`;
 *   - (b3) a record `schemaVersion` tampered 1→2 (canonical bytes kept) →
 *     open succeeds, the hydration READ fails with `RECORD_INVALID`
 *     preserving contractsCode `SCHEMA_VERSION_MISMATCH`;
 * - **(c) tmp garbage must NOT poison reopen**:
 *   - (c1) a planted crash-shaped `.tmp` file in the domain dir is ignored
 *     by the reopened seam (the committed world stays intact);
 *   - (c2) a REAL crash-leftover tmp (the seam fault fires at B9) is
 *     equally ignored: the restarted stack reopens, recovers with exactly
 *     1 seam write, and converges to the committed world.
 *
 * Top-level-await pattern; every scratch dir is destroyed in `finally` on
 * both success and failure; the `it` bodies are synchronous.
 *
 * @module p4t5-corrupt-version
 */

import { it, expect } from 'vitest'
import {
  P4T5_FIXTURE,
  P4T5_CHILD_SESSION_ID,
  P4T5_REQUEST,
  FAULT_DOMAIN_NAME,
  createFileRealm,
  reopenRealm,
  dropRealm,
  armCrashAt,
  capture,
  detailOf,
  operationIdFor,
  destroyScratch,
  copyFixtureIntoScratch,
  durableTablePath,
  durableMetaPath,
  canonicalStringify,
} from './p4t5-helpers.js'
import { listFiles, readText, writeText } from '../fault-injection/file-seam.mjs'
import {
  createMemberIdentity,
  memberIdentityKey,
  type MemberInstanceRecordDto,
} from '../../contracts/src/index.js'
import {
  PROVISIONING_STAGES,
  type ProvisionResult,
} from '../../storage/provisioning/index.js'

const ROOT = String(P4T5_FIXTURE.rootSessionId)
const INSTANCE = String(P4T5_FIXTURE.instanceId)
const CHILD = String(P4T5_CHILD_SESSION_ID)
const OP_ID = operationIdFor(ROOT, P4T5_REQUEST)
const MEMBER_KEY = memberIdentityKey(createMemberIdentity(P4T5_FIXTURE.rootSessionId, P4T5_FIXTURE.instanceId))

/** One captured `openTeamDomain` attempt (the process-restart over a scratch dir). */
interface OpenAttempt {
  readonly ok: boolean
  readonly errorCode: string | undefined
  readonly details: Record<string, unknown> | undefined
}

function codeOf(error: unknown): string | undefined {
  if (error === undefined) return undefined
  const code = (error as { code?: unknown }).code
  return typeof code === 'string' ? code : undefined
}

// ------------------------------------------------- (S0) fixture sanity

interface FixtureSanity {
  readonly openOk: boolean
  readonly openErrorCode: string | undefined
  readonly readWrites: number
  readonly stage: string
  readonly committed: boolean
  readonly diagnostic: string | undefined
  readonly memberCount: number
  readonly factCount: number
  readonly orphanCount: number
  readonly opPhase: string | undefined
  readonly bindingKind: string | undefined
  readonly bindingInstance: string | undefined
  readonly memberChild: string | undefined
  readonly recoverOk: boolean
  readonly recoverWrites: number
  readonly recoverCommitted: boolean
  readonly recoverSequence: number | undefined
}

const s0Dir = copyFixtureIntoScratch('committed-world', 'p4t5c-s0')
let s0: FixtureSanity | undefined
try {
  const realm = await reopenRealm(s0Dir)
  const status = realm.coordinator.status({ instanceId: P4T5_FIXTURE.instanceId })
  const member = realm.domain.repositories.memberInstances.get(ROOT, INSTANCE)
  const binding = realm.domain.repositories.sessionBindings.get(CHILD)
  const op = realm.domain.repositories.operations.get(OP_ID)
  const beforeRecover = realm.seam.writeCount
  const recover = await capture(() => realm.coordinator.recover(P4T5_REQUEST))
  const result = recover.ok && recover.value !== undefined ? (recover.value as ProvisionResult) : undefined
  s0 = {
    openOk: true,
    openErrorCode: undefined,
    readWrites: realm.seam.writeCount,
    stage: status.stage,
    committed: status.committed,
    diagnostic: status.diagnostic !== undefined ? status.diagnostic.code : undefined,
    memberCount: realm.domain.repositories.memberInstances.list(ROOT).length,
    factCount: realm.domain.repositories.ledger.entryCount(),
    orphanCount: realm.coordinator.listOrphans().length,
    opPhase: op?.phase,
    bindingKind: binding?.kind,
    bindingInstance: binding !== undefined && binding.kind === 'team-member' ? String(binding.instanceId) : undefined,
    memberChild: member !== undefined ? String(member.childSessionId) : undefined,
    recoverOk: recover.ok,
    recoverWrites: realm.seam.writeCount - beforeRecover,
    recoverCommitted: result?.committed ?? false,
    recoverSequence: result?.ledgerSequence,
  }
} catch (error) {
  s0 = {
    openOk: false,
    openErrorCode: codeOf(error),
    readWrites: -1,
    stage: '',
    committed: false,
    diagnostic: undefined,
    memberCount: -1,
    factCount: -1,
    orphanCount: -1,
    opPhase: undefined,
    bindingKind: undefined,
    bindingInstance: undefined,
    memberChild: undefined,
    recoverOk: false,
    recoverWrites: -1,
    recoverCommitted: false,
    recoverSequence: undefined,
  }
} finally {
  destroyScratch(s0Dir)
}

// ------------------------------------------------- (a1) schema_meta stamp tamper

const a1Dir = copyFixtureIntoScratch('committed-world', 'p4t5c-a1')
let a1: OpenAttempt | undefined
try {
  const path = durableTablePath(a1Dir, 'schema_meta')
  const table: Record<string, unknown> = JSON.parse(readText(path))
  const row = table['ledger']
  if (typeof row !== 'string') throw new Error('a1: expected the ledger stamp row to be a string')
  const tampered = row.replace(',"version":1}', ',"version":2}')
  if (tampered === row) throw new Error('a1: tamper anchor not found in the ledger stamp row')
  table['ledger'] = tampered
  writeText(path, JSON.stringify(table))
  const attempt = await capture(() => reopenRealm(a1Dir))
  a1 = attempt.ok ? { ok: true, errorCode: undefined, details: undefined } : { ok: false, errorCode: codeOf(attempt.error), details: detailOf(attempt.error) }
} finally {
  destroyScratch(a1Dir)
}

// ------------------------------------------------- (a2) domain meta tamper

const a2Dir = copyFixtureIntoScratch('committed-world', 'p4t5c-a2')
let a2: OpenAttempt | undefined
try {
  writeText(durableMetaPath(a2Dir), '{"version":2}')
  const attempt = await capture(() => reopenRealm(a2Dir))
  a2 = attempt.ok ? { ok: true, errorCode: undefined, details: undefined } : { ok: false, errorCode: codeOf(attempt.error), details: detailOf(attempt.error) }
} finally {
  destroyScratch(a2Dir)
}

// ------------------------------------------------- (b1) truncated record body

const b1Dir = copyFixtureIntoScratch('committed-world', 'p4t5c-b1')
let b1: OpenAttempt | undefined
try {
  const path = durableTablePath(b1Dir, 'member_instances')
  const text = readText(path)
  writeText(path, text.slice(0, Math.floor(text.length / 2))) // torn target — invalid JSON
  const attempt = await capture(() => reopenRealm(b1Dir))
  b1 = attempt.ok ? { ok: true, errorCode: undefined, details: undefined } : { ok: false, errorCode: codeOf(attempt.error), details: detailOf(attempt.error) }
} finally {
  destroyScratch(b1Dir)
}

// ------------------------------------------------- (b2) garbage record body

interface ReadFailure {
  readonly openOk: boolean
  readonly readOk: boolean
  readonly readErrorCode: string | undefined
  readonly details: Record<string, unknown> | undefined
}

const b2Dir = copyFixtureIntoScratch('committed-world', 'p4t5c-b2')
let b2: ReadFailure | undefined
try {
  const path = durableTablePath(b2Dir, 'member_instances')
  const table: Record<string, unknown> = JSON.parse(readText(path))
  table[MEMBER_KEY] = 'garbage-not-json' // valid table JSON, invalid RECORD body
  writeText(path, JSON.stringify(table))
  const attempt = await capture(() => reopenRealm(b2Dir))
  if (!attempt.ok || attempt.value === undefined) {
    b2 = { openOk: false, readOk: false, readErrorCode: codeOf(attempt.error), details: detailOf(attempt.error) }
  } else {
    const realm = attempt.value
    const read = await capture(() => realm.domain.repositories.memberInstances.get(ROOT, INSTANCE))
    const value = read.ok && read.value !== undefined ? (read.value as MemberInstanceRecordDto) : undefined
    b2 = {
      openOk: true,
      readOk: read.ok,
      readErrorCode: read.ok ? undefined : codeOf(read.error),
      details: detailOf(read.error),
    }
    if (value !== undefined) throw new Error('b2: the garbage row unexpectedly deserialized')
  }
} finally {
  destroyScratch(b2Dir)
}

// ------------------------------------------------- (b3) record schemaVersion tamper

const b3Dir = copyFixtureIntoScratch('committed-world', 'p4t5c-b3')
let b3: ReadFailure | undefined
try {
  const path = durableTablePath(b3Dir, 'member_instances')
  const table: Record<string, unknown> = JSON.parse(readText(path))
  const row: Record<string, unknown> = JSON.parse(String(table[MEMBER_KEY]))
  row['schemaVersion'] = 2
  table[MEMBER_KEY] = canonicalStringify(row) // canonical bytes kept, only the version differs
  writeText(path, JSON.stringify(table))
  const attempt = await capture(() => reopenRealm(b3Dir))
  if (!attempt.ok || attempt.value === undefined) {
    b3 = { openOk: false, readOk: false, readErrorCode: codeOf(attempt.error), details: detailOf(attempt.error) }
  } else {
    const realm = attempt.value
    const read = await capture(() => realm.domain.repositories.memberInstances.get(ROOT, INSTANCE))
    const value = read.ok && read.value !== undefined ? (read.value as MemberInstanceRecordDto) : undefined
    b3 = {
      openOk: true,
      readOk: read.ok,
      readErrorCode: read.ok ? undefined : codeOf(read.error),
      details: detailOf(read.error),
    }
    if (value !== undefined) throw new Error('b3: the tampered row unexpectedly deserialized')
  }
} finally {
  destroyScratch(b3Dir)
}

// ------------------------------------------------- (c1) planted tmp garbage

interface TmpReopen {
  readonly openOk: boolean
  readonly stage: string
  readonly committed: boolean
  readonly memberCount: number
  readonly orphanCount: number
  readonly recoverOk: boolean
  readonly recoverWrites: number
  readonly tmpFilesBefore: string[]
  readonly tmpFilesAfter: string[]
}

const c1Dir = copyFixtureIntoScratch('committed-world', 'p4t5c-c1')
let c1: TmpReopen | undefined
try {
  const planted = `${c1Dir}/${FAULT_DOMAIN_NAME}/operations.json.999.42.tmp`
  writeText(planted, 'GARBAGE-TMP-NOT-JSON')
  const attempt = await capture(() => reopenRealm(c1Dir))
  if (!attempt.ok || attempt.value === undefined) {
    c1 = { openOk: false, stage: '', committed: false, memberCount: -1, orphanCount: -1, recoverOk: false, recoverWrites: -1, tmpFilesBefore: [], tmpFilesAfter: [] }
  } else {
    const realm = attempt.value
    const before = realm.seam.writeCount
    const recover = await capture(() => realm.coordinator.recover(P4T5_REQUEST))
    c1 = {
      openOk: true,
      stage: realm.coordinator.status({ instanceId: P4T5_FIXTURE.instanceId }).stage,
      committed: realm.coordinator.status({ instanceId: P4T5_FIXTURE.instanceId }).committed,
      memberCount: realm.domain.repositories.memberInstances.list(ROOT).length,
      orphanCount: realm.coordinator.listOrphans().length,
      recoverOk: recover.ok,
      recoverWrites: realm.seam.writeCount - before,
      tmpFilesBefore: listFiles(realm.seam.dirFor(FAULT_DOMAIN_NAME)).filter((f) => f.endsWith('.tmp')).sort(),
      tmpFilesAfter: listFiles(realm.seam.dirFor(FAULT_DOMAIN_NAME)).filter((f) => f.endsWith('.tmp')).sort(),
    }
  }
} finally {
  destroyScratch(c1Dir)
}

// ------------------------------------------------- (c2) real crash-leftover tmp

const c2Realm = await createFileRealm('p4t5c-c2')
const c2Base = c2Realm.seam.writeCount
armCrashAt(c2Realm.seam, c2Base, 8) // the B9 boundary: the fact + stamp are durable, the COMMITTED row write crashes
const c2Run = await capture(() => c2Realm.coordinator.provision(P4T5_REQUEST))
const c2CrashWrites = c2Realm.seam.writeCount - c2Base
const c2TmpBefore = listFiles(c2Realm.seam.dirFor(FAULT_DOMAIN_NAME)).filter((f) => f.endsWith('.tmp')).sort()
await dropRealm(c2Realm)
let c2: TmpReopen & { readonly runOk: boolean; readonly crashWrites: number } | undefined
try {
  const realm = await reopenRealm(c2Realm.dir)
  const before = realm.seam.writeCount
  const recover = await capture(() => realm.coordinator.recover(P4T5_REQUEST))
  c2 = {
    runOk: c2Run.ok,
    crashWrites: c2CrashWrites,
    openOk: true,
    stage: realm.coordinator.status({ instanceId: P4T5_FIXTURE.instanceId }).stage,
    committed: realm.coordinator.status({ instanceId: P4T5_FIXTURE.instanceId }).committed,
    memberCount: realm.domain.repositories.memberInstances.list(ROOT).length,
    orphanCount: realm.coordinator.listOrphans().length,
    recoverOk: recover.ok,
    recoverWrites: realm.seam.writeCount - before,
    tmpFilesBefore: c2TmpBefore,
    tmpFilesAfter: listFiles(realm.seam.dirFor(FAULT_DOMAIN_NAME)).filter((f) => f.endsWith('.tmp')).sort(),
  }
} finally {
  destroyScratch(c2Realm.dir)
}

// ------------------------------------------------------------------- tests

it('(S0) the committed-world fixture reopens on a brand-new stack as the committed world (1 member, 1 fact, 0 orphans, COMMITTED row, team-member binding)', () => {
  expect(s0).not.toBe(undefined)
  expect(s0?.openOk).toBe(true)
  expect(s0?.readWrites).toBe(0)
  expect(s0?.stage).toBe(PROVISIONING_STAGES.INSTANCE_COMMITTED)
  expect(s0?.committed).toBe(true)
  expect(s0?.diagnostic).toBe(undefined)
  expect(s0?.memberCount).toBe(1)
  expect(s0?.factCount).toBe(1)
  expect(s0?.orphanCount).toBe(0)
  expect(s0?.opPhase).toBe('COMMITTED')
  expect(s0?.bindingKind).toBe('team-member')
  expect(s0?.bindingInstance).toBe(INSTANCE)
  expect(s0?.memberChild).toBe(CHILD)
})

it('(S0) the restarted committed world takes a 0-write no-op recover with the same ledger sequence', () => {
  expect(s0?.recoverOk).toBe(true)
  expect(s0?.recoverWrites).toBe(0)
  expect(s0?.recoverCommitted).toBe(true)
  expect(s0?.recoverSequence).toBe(1)
})

it('(a1) a tampered schema_meta stamp (ledger version 1→2) fails the reopen LOUDLY with SCHEMA_STAMP_MISMATCH naming the exact store (no built-in migration)', () => {
  expect(a1).not.toBe(undefined)
  expect(a1?.ok).toBe(false)
  expect(a1?.errorCode).toBe('SCHEMA_STAMP_MISMATCH')
  expect(a1?.details?.['store']).toBe('ledger')
  expect(a1?.details?.['expected']).toBe(1)
  expect(a1?.details?.['found']).toBe(2)
})

it('(a2) a tampered domain meta stamp (L1 version 1→2) fails the reopen LOUDLY with SCHEMA_VERSION_MISMATCH (the seam version-mismatch is mapped, never migrated)', () => {
  expect(a2).not.toBe(undefined)
  expect(a2?.ok).toBe(false)
  expect(a2?.errorCode).toBe('SCHEMA_VERSION_MISMATCH')
  expect(a2?.details?.['expected']).toBe(1)
  expect(a2?.details?.['found']).toBe(2)
  expect(a2?.details?.['seamCode']).toBe('version-mismatch')
})

it('(b1) a truncated member_instances.json is a malformed medium: the reopen fails with SEAM_FAILURE surfacing the seam code (never a silent open)', () => {
  expect(b1).not.toBe(undefined)
  expect(b1?.ok).toBe(false)
  expect(b1?.errorCode).toBe('SEAM_FAILURE')
  expect(b1?.details?.['seamCode']).toBe('malformed-medium')
  expect(b1?.details?.['store']).toBe(FAULT_DOMAIN_NAME)
  expect(b1?.details?.['op']).toBe('open')
})

it('(b2) a garbage record body: the open SUCCEEDS (the table file is valid JSON) but the hydration read fails with TYPED RECORD_INVALID preserving contractsCode MALFORMED_DTO (never silent)', () => {
  expect(b2).not.toBe(undefined)
  expect(b2?.openOk).toBe(true)
  expect(b2?.readOk).toBe(false)
  expect(b2?.readErrorCode).toBe('RECORD_INVALID')
  expect(b2?.details?.['store']).toBe('member_instances')
  expect(b2?.details?.['key']).toBe(MEMBER_KEY)
  expect(b2?.details?.['contractsCode']).toBe('MALFORMED_DTO')
})

it('(b3) a record schemaVersion tampered 1→2 (canonical bytes kept): the open SUCCEEDS but the hydration read fails with TYPED RECORD_INVALID preserving contractsCode SCHEMA_VERSION_MISMATCH', () => {
  expect(b3).not.toBe(undefined)
  expect(b3?.openOk).toBe(true)
  expect(b3?.readOk).toBe(false)
  expect(b3?.readErrorCode).toBe('RECORD_INVALID')
  expect(b3?.details?.['store']).toBe('member_instances')
  expect(b3?.details?.['key']).toBe(MEMBER_KEY)
  expect(b3?.details?.['contractsCode']).toBe('SCHEMA_VERSION_MISMATCH')
})

it('(c1) a planted crash-shaped .tmp file in the domain dir does NOT poison the reopen: the committed world stays intact and recover is a 0-write no-op', () => {
  expect(c1).not.toBe(undefined)
  expect(c1?.openOk).toBe(true)
  expect(c1?.stage).toBe(PROVISIONING_STAGES.INSTANCE_COMMITTED)
  expect(c1?.committed).toBe(true)
  expect(c1?.memberCount).toBe(1)
  expect(c1?.orphanCount).toBe(0)
  expect(c1?.recoverOk).toBe(true)
  expect(c1?.recoverWrites).toBe(0)
  expect(c1?.tmpFilesBefore).toEqual(['operations.json.999.42.tmp'])
  // the planted tmp is ignored on open AND left alone (it is not part of the medium)
  expect(c1?.tmpFilesAfter).toEqual(['operations.json.999.42.tmp'])
})

it('(c2) a REAL crash-leftover tmp (the seam fault fired at B9) does NOT poison the reopen: the restarted stack reopens, recovers with exactly 1 seam write, and converges to the committed world', () => {
  expect(c2).not.toBe(undefined)
  expect(c2?.runOk).toBe(false)
  expect(c2?.crashWrites).toBe(8)
  expect(c2?.openOk).toBe(true)
  expect(c2?.stage).toBe(PROVISIONING_STAGES.INSTANCE_COMMITTED)
  expect(c2?.committed).toBe(true)
  expect(c2?.memberCount).toBe(1)
  expect(c2?.orphanCount).toBe(0)
  expect(c2?.recoverOk).toBe(true)
  expect(c2?.recoverWrites).toBe(1)
  // exactly one leftover tmp (the crashed COMMITTED-row write), ignored by the reopen
  expect(c2?.tmpFilesBefore.length).toBe(1)
  expect(c2?.tmpFilesAfter).toEqual(c2?.tmpFilesBefore)
})

it('error classification: the version-tamper failures are TeamDomainErrors on the closed code set', () => {
  // (a1)/(a2) surfaces were captured as codes above; assert membership
  expect(['SCHEMA_STAMP_MISMATCH', 'SCHEMA_VERSION_MISMATCH'].includes(a1?.errorCode ?? '')).toBe(true)
  expect(['SCHEMA_STAMP_MISMATCH', 'SCHEMA_VERSION_MISMATCH'].includes(a2?.errorCode ?? '')).toBe(true)
  // and they are NOT seam-classified failures
  expect(a1?.errorCode).not.toBe('SEAM_FAILURE')
  expect(a2?.errorCode).not.toBe('SEAM_FAILURE')
})
