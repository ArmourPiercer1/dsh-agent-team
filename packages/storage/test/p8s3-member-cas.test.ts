/**
 * p8s3-member-cas — P8-S3 R4: the durable CAS lifecycle-transition commit
 * for MemberInstance records (`commitTransition`).
 *
 * Closes CR-10: the P8-S2-era `commitTransition` port args carried
 * (rootSessionId, instanceId, from, operation, to) with NO version check,
 * so two concurrent lifecycle writers could both "succeed" on a stale
 * read (last writer wins). The new repository method atomically
 * read-modify-writes on the domain write chain and validates:
 *
 * - the stored row's identity matches the requested identity;
 * - v2 leader rows (schemaVersion 2) are rejected loud (CAS is a v1
 *   member primitive — leaders are lifecycle-inoperable, invariant 13);
 * - `record.lifecycle === args.from` AND
 *   `record.activityVersion === args.expectedActivityVersion`
 *   (otherwise `RECORD_DUPLICATE` with `details.problem:
 *   'cas-mismatch'` — the closed v1 error set has no CAS-specific code;
 *   the conflict semantics of "someone else moved this row" is exactly
 *   what RECORD_DUPLICATE already carries for put races);
 * - a missing key surfaces the public seam `missing-key` as
 *   `SEAM_FAILURE` (same loud-failure rule as `advanceGeneration`: the
 *   closed v1 set has no RECORD_MISSING).
 *
 * On success the row's `lifecycle` is set to `args.to` and
 * `activityVersion` is bumped by exactly 1 (the domain FSM's version
 * discipline, mirrored in the durable layer).
 *
 * W8 (concurrent lifecycle version mismatch) is exercised here at the
 * storage layer with the in-memory seam's per-domain write chain
 * (deterministic serialization); exactly one of two writers with the
 * same expected version succeeds.
 *
 * @module @dsh-agent-team/storage/test/p8s3-member-cas
 */

import { describe, expect, it } from 'vitest'

import {
  createLeaderInstanceRecord,
  createMemberIdentity,
  memberIdentityKey,
  parseInstanceId,
  serializeMemberInstanceRecord,
} from '../../contracts/src/index.js'
import type { MemberInstanceRecordDto, MemberLifecycleState } from '../../contracts/src/index.js'
import { TEAM_DOMAIN_NAME } from '../schema/index.js'
import { createTeamDomain } from '../repositories/index.js'
import {
  InMemoryStorageSeam,
  P4_FIXTURE,
  asTeamDomainError,
  capture,
  detail,
  memberInstanceInput,
} from './p4-helpers.js'

const seam = new InMemoryStorageSeam()
const domain = await createTeamDomain(seam)
const repo = domain.repositories.memberInstances
const root = String(P4_FIXTURE.rootSessionId)
const alpha = 'inst-alpha'
const beta = String(P4_FIXTURE.secondInstanceId)
const raw = seam.rawRows(TEAM_DOMAIN_NAME, 'member_instances')

// --- seeds -----------------------------------------------------------------

// A RUNNING member at activityVersion 3 (CAS happy path subject).
await repo.put({
  ...memberInstanceInput(P4_FIXTURE.rootSessionId, P4_FIXTURE.instanceId, P4_FIXTURE.childSessionId, 3),
  lifecycle: 'RUNNING',
})

// A fresh CREATED member at activityVersion 1 (stale-version / wrong-from
// subjects; `memberInstanceInput` defaults lifecycle to CREATED).
await repo.put(memberInstanceInput(P4_FIXTURE.rootSessionId, P4_FIXTURE.secondInstanceId, P4_FIXTURE.secondChildSessionId, 1))

// A v2 leader row, seeded byte-direct at its identity key (the root-binding
// mint path is the production writer; the CAS guard only needs the bytes).
const leaderRow = createLeaderInstanceRecord({
  rootSessionId: P4_FIXTURE.rootSessionId,
  instanceId: parseInstanceId('inst-leader'),
  templateId: P4_FIXTURE.templateId,
  label: 'leader',
  createdAt: P4_FIXTURE.createdAt,
  activityVersion: 1,
})
raw.set(
  memberIdentityKey(createMemberIdentity(P4_FIXTURE.rootSessionId, parseInstanceId('inst-leader'))),
  serializeMemberInstanceRecord(leaderRow as unknown as MemberInstanceRecordDto),
)

// --- 1. happy path: RUNNING v3 -> SETTLED, activityVersion 3 -> 4 ----------

const happy = await capture(() =>
  repo.commitTransition({
    rootSessionId: root,
    instanceId: alpha,
    expectedActivityVersion: 3,
    from: 'RUNNING',
    operation: 'SETTLE',
    to: 'SETTLED',
  }),
)
const happyAfter = repo.get(root, alpha)

// --- 2. stale expectedActivityVersion --------------------------------------

const stale = await capture(() =>
  repo.commitTransition({
    rootSessionId: root,
    instanceId: beta,
    expectedActivityVersion: 2,
    from: 'CREATED',
    operation: 'ADMIT_WORK',
    to: 'RUNNING',
  }),
)
const staleAfter = repo.get(root, beta)

// --- 3. wrong from-state ----------------------------------------------------

const wrongFrom = await capture(() =>
  repo.commitTransition({
    rootSessionId: root,
    instanceId: beta,
    expectedActivityVersion: 1,
    from: 'RUNNING',
    operation: 'SETTLE',
    to: 'SETTLED',
  }),
)

// --- 4. v2 leader row is lifecycle-inoperable -------------------------------

const leaderCas = await capture(() =>
  repo.commitTransition({
    rootSessionId: root,
    instanceId: 'inst-leader',
    expectedActivityVersion: 1,
    from: 'RUNNING',
    operation: 'SETTLE',
    to: 'SETTLED',
  }),
)
const leaderAfter = repo.get(root, 'inst-leader')

// --- 5. missing key -> SEAM_FAILURE (loud, no RECORD_MISSING in v1) --------

const missing = await capture(() =>
  repo.commitTransition({
    rootSessionId: root,
    instanceId: 'inst-gamma',
    expectedActivityVersion: 1,
    from: 'CREATED',
    operation: 'ADMIT_WORK',
    to: 'RUNNING',
  }),
)

// --- 6. invalid target state -> validation rejection, no write --------------

const writesBeforeBadState = seam.writeLog.length
const badState = await capture(() =>
  repo.commitTransition({
    rootSessionId: root,
    instanceId: beta,
    expectedActivityVersion: 1,
    from: 'CREATED',
    operation: 'SETTLE',
    // deliberately outside the FSM union: the durable layer must validate
    // (type erasure at the JSON boundary), rejecting before any write
    to: 'GARBAGE' as MemberLifecycleState,
  }),
)
const writesAfterBadState = seam.writeLog.length

// --- 7. identity mismatch (corrupt row at the key) -> RECORD_INVALID -------

const betaRecord = repo.get(root, beta)
raw.set(
  memberIdentityKey(createMemberIdentity(P4_FIXTURE.rootSessionId, parseInstanceId(alpha))),
  serializeMemberInstanceRecord(betaRecord as MemberInstanceRecordDto),
)
const identityMismatch = await capture(() =>
  repo.commitTransition({
    rootSessionId: root,
    instanceId: alpha,
    expectedActivityVersion: 3,
    from: 'RUNNING',
    operation: 'SETTLE',
    to: 'SETTLED',
  }),
)

// --- 8. W8: two concurrent writers, same expected version ------------------

await repo.put({
  ...memberInstanceInput(P4_FIXTURE.rootSessionId, parseInstanceId('inst-omega'), P4_FIXTURE.childSessionId, 2),
  lifecycle: 'RUNNING',
})
const [w1, w2] = await Promise.all([
  capture(() =>
    repo.commitTransition({
      rootSessionId: root,
      instanceId: 'inst-omega',
      expectedActivityVersion: 2,
      from: 'RUNNING',
      operation: 'SETTLE',
      to: 'SETTLED',
    }),
  ),
  capture(() =>
    repo.commitTransition({
      rootSessionId: root,
      instanceId: 'inst-omega',
      expectedActivityVersion: 2,
      from: 'RUNNING',
      operation: 'SETTLE',
      to: 'SETTLED',
    }),
  ),
])
const omegaAfter = repo.get(root, 'inst-omega')

// --- 9. crash window: a CAS write that crashes leaves the row untouched ---

await repo.put({
  ...memberInstanceInput(P4_FIXTURE.rootSessionId, parseInstanceId('inst-delta'), P4_FIXTURE.childSessionId, 1),
  lifecycle: 'RUNNING',
})
seam.setCrashAfterWrites(seam.writeCount)
const crashCas = await capture(() =>
  repo.commitTransition({
    rootSessionId: root,
    instanceId: 'inst-delta',
    expectedActivityVersion: 1,
    from: 'RUNNING',
    operation: 'SETTLE',
    to: 'SETTLED',
  }),
)
const deltaAfterCrash = repo.get(root, 'inst-delta')
seam.clearCrash()
const deltaRetry = await capture(() =>
  repo.commitTransition({
    rootSessionId: root,
    instanceId: 'inst-delta',
    expectedActivityVersion: 1,
    from: 'RUNNING',
    operation: 'SETTLE',
    to: 'SETTLED',
  }),
)

describe('p8s3-member-cas commitTransition (R4 / CR-10 / W8)', () => {
  it('commits a matching transition and bumps activityVersion by exactly 1', () => {
    expect(happy.ok).toBe(true)
    expect(happy.value?.lifecycle).toBe('SETTLED')
    expect(happy.value?.activityVersion).toBe(4)
    expect(happyAfter?.lifecycle).toBe('SETTLED')
    expect(happyAfter?.activityVersion).toBe(4)
  })

  it('rejects a stale expectedActivityVersion with RECORD_DUPLICATE cas-mismatch and leaves the row untouched', () => {
    expect(stale.ok).toBe(false)
    const err = asTeamDomainError(stale.error)
    expect(err.code).toBe('RECORD_DUPLICATE')
    expect(detail(err, 'problem')).toBe('cas-mismatch')
    expect(detail(err, 'expectedActivityVersion')).toBe(2)
    expect(detail(err, 'foundActivityVersion')).toBe(1)
    expect(staleAfter?.activityVersion).toBe(1)
    expect(staleAfter?.lifecycle).toBe('CREATED')
  })

  it('rejects a wrong from-state with RECORD_DUPLICATE cas-mismatch (found lifecycle reported)', () => {
    expect(wrongFrom.ok).toBe(false)
    const err = asTeamDomainError(wrongFrom.error)
    expect(err.code).toBe('RECORD_DUPLICATE')
    expect(detail(err, 'problem')).toBe('cas-mismatch')
    expect(detail(err, 'expectedLifecycle')).toBe('RUNNING')
    expect(detail(err, 'foundLifecycle')).toBe('CREATED')
  })

  it('rejects v2 leader rows with RECORD_INVALID cas-leader-not-operable (invariant 13)', () => {
    expect(leaderCas.ok).toBe(false)
    const err = asTeamDomainError(leaderCas.error)
    expect(err.code).toBe('RECORD_INVALID')
    expect(detail(err, 'problem')).toBe('cas-leader-not-operable')
    // The v1 surface read still sees the untouched v2 row (cast surface):
    // activityVersion 1 proves the row was present and unmodified.
    expect(leaderAfter?.activityVersion).toBe(1)
  })

  it('surfaces a missing row as SEAM_FAILURE (loud; no RECORD_MISSING in the closed v1 set)', () => {
    expect(missing.ok).toBe(false)
    const err = asTeamDomainError(missing.error)
    expect(err.code).toBe('SEAM_FAILURE')
  })

  it('rejects an invalid target state up front and performs no write', () => {
    expect(badState.ok).toBe(false)
    const err = asTeamDomainError(badState.error)
    expect(err.code).toBe('RECORD_INVALID')
    expect(writesAfterBadState).toBe(writesBeforeBadState)
  })

  it('rejects an identity-mismatched (corrupt) row with RECORD_INVALID cas-identity-mismatch', () => {
    expect(identityMismatch.ok).toBe(false)
    const err = asTeamDomainError(identityMismatch.error)
    expect(err.code).toBe('RECORD_INVALID')
    expect(detail(err, 'problem')).toBe('cas-identity-mismatch')
  })

  it('W8: exactly one of two concurrent same-version writers succeeds; final version = seeded + 1', () => {
    expect(w1.ok !== w2.ok).toBe(true)
    const winner = w1.ok ? w1 : w2
    const loser = w1.ok ? w2 : w1
    expect(loser.ok).toBe(false)
    const err = asTeamDomainError(loser.error)
    expect(err.code).toBe('RECORD_DUPLICATE')
    expect(detail(err, 'problem')).toBe('cas-mismatch')
    expect(winner.value?.activityVersion).toBe(3)
    expect(omegaAfter?.activityVersion).toBe(3)
    expect(omegaAfter?.lifecycle).toBe('SETTLED')
  })

  it('crash during the CAS write rejects SEAM_FAILURE, leaves the row untouched, and a retry converges', () => {
    expect(crashCas.ok).toBe(false)
    expect(asTeamDomainError(crashCas.error).code).toBe('SEAM_FAILURE')
    expect(deltaAfterCrash?.lifecycle).toBe('RUNNING')
    expect(deltaAfterCrash?.activityVersion).toBe(1)
    expect(deltaRetry.ok).toBe(true)
    expect(deltaRetry.value?.lifecycle).toBe('SETTLED')
    expect(deltaRetry.value?.activityVersion).toBe(2)
  })
})
