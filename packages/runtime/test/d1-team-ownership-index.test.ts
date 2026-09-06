/**
 * d1-team-ownership-index.test.ts — D1 (Team D1-D6 repair v2): the pure
 * durable ownership / root-identity index (`team-ownership-index.ts`).
 *
 * Must-covers (D1 task card, index half):
 *  - the index answers "which roots exist, with what blueprint identity,
 *    generation, creation time, and member/child-session attribution"
 *    from durable rows only — READ-ONLY (zero seam writes, pinned);
 *  - deterministic root order (repository sort) + attribution sort by
 *    instance id; the closed wire row of `toTeamRootWireRow`
 *    (`defaultWorkspace` key ABSENT when unset, NO attribution);
 *  - rebuild-identical: building twice over the same rows — including
 *    after closing and RE-OPENING the domain over the same medium —
 *    yields byte-identical `JSON.stringify` output;
 *  - Leader exclusion in BOTH the v2 leader record form (schemaVersion
 *    2, no childSessionId/lifecycle) and the legacy v1 harness form
 *    (instanceId `inst-leader` WITH a childSessionId);
 *  - documented NON-failures: a root record without its `team-root`
 *    binding row (fresh-root crash window) and a member child session
 *    without a binding row (attribution `kind` absent);
 *  - fail-closed (NEVER a silent empty/partial list): the three typed
 *    integrity codes — `TEAM_OWNERSHIP_INDEX_ROOT_BINDING_MISMATCH`
 *    (root bound as a non-team-root kind),
 *    `TEAM_OWNERSHIP_INDEX_MEMBER_BINDING_MISMATCH` (child bound as a
 *    non-team-member kind), `TEAM_OWNERSHIP_INDEX_MEMBER_BINDING_CONFLICT`
 *    (a team-member binding that disagrees with the member record) —
 *    each with its closed string `code` (the remote backing
 *    vocabulary, invariant 4b) and remote-safe `details`;
 *  - a corrupt (undecodable) row propagates the storage layer's own
 *    typed error (`RECORD_INVALID`) as-is — never swallowed, never
 *    re-coded.
 *
 * Test pattern of this repo: every async scenario (durable worlds over
 * the testkit `FileStorageSeam`) runs at MODULE level (top-level await)
 * and captures its results; the `it` bodies are pure synchronous
 * assertions. Scratch dirs are destroyed at module level after capture.
 *
 * Matchers: toBe/toEqual/toBeGreaterThan (+.not) only.
 */

import { describe, expect, it } from 'vitest'
import { join } from 'node:path'

import {
  createBlueprintSnapshotRef,
  parseBlueprintContentHash,
  parseBlueprintId,
  parseBlueprintRevision,
  parseChildSessionId,
  parseInstanceId,
  parseRootSessionId,
  parseTemplateId,
} from '../../contracts/src/index.js'
import type { MemberInstanceRecordInput } from '../../contracts/src/index.js'
import { createTeamDomain, openTeamDomain } from '../../storage/repositories/index.js'
import type { TeamDomain } from '../../storage/repositories/index.js'
import {
  destroyDir,
  FileStorageSeam,
  scratchDir,
  writeText,
} from '../../testkit/fault-injection/file-seam.mjs'
import {
  buildTeamRootOwnershipIndex,
  TEAM_OWNERSHIP_INDEX_ERROR_CODES,
  TeamOwnershipIndexError,
  toTeamRootWireRow,
} from '../src/team-ownership-index.js'

// ---------------------------------------------------------------------------
// Fixture identities (frozen contracts v1 branded ids, D1-prefixed)
// ---------------------------------------------------------------------------

const ROOT_A = parseRootSessionId('session-root-d1a')
const ROOT_B = parseRootSessionId('session-root-d1b')
const CHILD_A1 = parseChildSessionId('session-child-d1a1')
const CHILD_A2 = parseChildSessionId('session-child-d1a2')
const CHILD_B1 = parseChildSessionId('session-child-d1b1')
const INST_A1 = parseInstanceId('inst-d1alpha')
const INST_A2 = parseInstanceId('inst-d1beta')
const INST_B1 = parseInstanceId('inst-d1gamma')
const INST_CONFLICT = parseInstanceId('inst-d1conflict')
const LEADER = parseInstanceId('inst-leader')
const BP_A = parseBlueprintId('D1-BP-A')
const BP_B = parseBlueprintId('D1-BP-B')
const BP_HASH = parseBlueprintContentHash('sha256-d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1d1')
const TEMPLATE = parseTemplateId('d1worker')
const CREATED_AT = '2026-09-01T00:00:00Z'

const BLUEPRINT_A = createBlueprintSnapshotRef({
  blueprintId: BP_A,
  revision: parseBlueprintRevision('17'),
  contentHash: BP_HASH,
})
const BLUEPRINT_B = createBlueprintSnapshotRef({
  blueprintId: BP_B,
  revision: parseBlueprintRevision('3'),
  contentHash: BP_HASH,
})

const ROOT_A_STR = String(ROOT_A)
const ROOT_B_STR = String(ROOT_B)
const CHILD_A1_STR = String(CHILD_A1)
const CHILD_A2_STR = String(CHILD_A2)
const CHILD_B1_STR = String(CHILD_B1)

// ---------------------------------------------------------------------------
// World seeding (durable TeamDomain over the testkit FileStorageSeam)
// ---------------------------------------------------------------------------

interface World {
  readonly dir: string
  readonly seam: FileStorageSeam
  readonly domain: TeamDomain
  /** The seam write count AFTER seeding (the zero-write baseline). */
  readonly writesAfterSeed: number
}

async function openWorld(basename: string): Promise<{ dir: string; seam: FileStorageSeam; domain: TeamDomain }> {
  const dir = scratchDir(basename)
  const seam = new FileStorageSeam(dir)
  const domain = await createTeamDomain(seam)
  return { dir, seam, domain }
}

function recordWrites(seam: FileStorageSeam): number {
  return seam.writeCount
}

/** The full two-root world (the happy-path + non-failure scenarios). */
async function seedFullWorld(basename: string): Promise<World> {
  const { dir, seam, domain } = await openWorld(basename)
  const repos = domain.repositories

  // Root A — generation 1, WITH defaultWorkspace, v2 leader record.
  await repos.teamSessions.put({
    blueprint: BLUEPRINT_A,
    createdAt: CREATED_AT,
    defaultWorkspace: 'C:/agent-team/work/d1a',
    generation: 1,
    rootSessionId: ROOT_A,
  })
  // Root B — generation 5, NO defaultWorkspace (the wire-row key-absence
  // scenario), legacy v1 harness leader row.
  await repos.teamSessions.put({
    blueprint: BLUEPRINT_B,
    createdAt: CREATED_AT,
    generation: 5,
    rootSessionId: ROOT_B,
  })

  // Root A members: the v2 Leader (schemaVersion 2, NO childSessionId /
  // lifecycle keys) + two plain members.
  // The documented contracts type-lie for v2 rows (root-binding
  // write-port.ts): the repository's declared v1 input/return types —
  // the contracts factory branches on the input shape and mints the
  // honest v2 leader record.
  await repos.memberInstances.put({
    activityVersion: 1,
    createdAt: CREATED_AT,
    instanceId: LEADER,
    label: 'd1a-leader',
    rootSessionId: ROOT_A,
    templateId: TEMPLATE,
  } as MemberInstanceRecordInput)
  await repos.memberInstances.put({
    activityVersion: 1,
    childSessionId: CHILD_A1,
    createdAt: CREATED_AT,
    instanceId: INST_A1,
    label: 'd1a-alpha',
    lifecycle: 'CREATED',
    rootSessionId: ROOT_A,
    templateId: TEMPLATE,
  })
  await repos.memberInstances.put({
    activityVersion: 2,
    childSessionId: CHILD_A2,
    createdAt: CREATED_AT,
    instanceId: INST_A2,
    label: 'd1a-beta',
    lifecycle: 'SETTLED',
    rootSessionId: ROOT_A,
    templateId: TEMPLATE,
  })

  // Root B members: the legacy v1 harness LEADER row (instanceId
  // `inst-leader` WITH a childSessionId — the pre-v2 shape that stays
  // parseable; production root.ts seeds exactly this form, childSessionId
  // = the root session itself) + one plain member.
  await repos.memberInstances.put({
    activityVersion: 1,
    childSessionId: parseChildSessionId(String(ROOT_B)),
    createdAt: CREATED_AT,
    instanceId: LEADER,
    label: 'd1b-leader',
    lifecycle: 'RUNNING',
    rootSessionId: ROOT_B,
    templateId: TEMPLATE,
  })
  await repos.memberInstances.put({
    activityVersion: 1,
    childSessionId: CHILD_B1,
    createdAt: CREATED_AT,
    instanceId: INST_B1,
    label: 'd1b-gamma',
    lifecycle: 'CREATED',
    rootSessionId: ROOT_B,
    templateId: TEMPLATE,
  })

  // Bindings — Root A: team-root + the A1 child binding; the A2 child is
  // deliberately UNBOUND (documented non-failure: kind absent).
  await repos.sessionBindings.put({ kind: 'team-root', schemaVersion: 1, sessionId: ROOT_A_STR })
  await repos.sessionBindings.put({
    instanceId: String(INST_A1),
    kind: 'team-member',
    rootSessionId: ROOT_A_STR,
    schemaVersion: 1,
    sessionId: CHILD_A1_STR,
  })
  // Root B: NO team-root binding (the fresh-root crash window — the
  // record is committed before the binding row; documented non-failure)
  // + the B1 child binding.
  await repos.sessionBindings.put({
    instanceId: String(INST_B1),
    kind: 'team-member',
    rootSessionId: ROOT_B_STR,
    schemaVersion: 1,
    sessionId: CHILD_B1_STR,
  })

  return { dir, seam, domain, writesAfterSeed: recordWrites(seam) }
}

/** Capture an expected throw (the shim's `it` bodies cannot await). */
interface CapturedError {
  readonly ok: boolean
  readonly value?: unknown
  readonly error?: unknown
}

function captureError(fn: () => unknown): CapturedError {
  try {
    return { ok: true, value: fn() }
  } catch (error) {
    return { ok: false, error }
  }
}

function asOwnershipIndexError(error: unknown): { code: string; details: Record<string, unknown> } {
  if (!(error instanceof TeamOwnershipIndexError)) {
    throw new Error(
      `expected a TeamOwnershipIndexError, got: ${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}`,
    )
  }
  return { code: error.code, details: error.details as unknown as Record<string, unknown> }
}

// ---------------------------------------------------------------------------
// Module level (top-level await): seed the worlds, drive the index,
// capture every scenario result.
// ---------------------------------------------------------------------------

const RT = await (async () => {
  // (a) The full two-root world.
  const world = await seedFullWorld('d1-idx-full')
  const index1 = buildTeamRootOwnershipIndex(world.domain.repositories)
  const writesAfterBuild1 = recordWrites(world.seam)
  const index2 = buildTeamRootOwnershipIndex(world.domain.repositories)
  const json1 = JSON.stringify(index1)
  const json2 = JSON.stringify(index2)

  // Rebuild-identical AFTER closing and re-opening the domain over the
  // same medium (the process-restart model: a new seam, the same dir).
  await world.domain.close()
  const reopenedSeam = new FileStorageSeam(world.dir)
  const reopened = await openTeamDomain(reopenedSeam)
  const index3 = buildTeamRootOwnershipIndex(reopened.repositories)
  const json3 = JSON.stringify(index3)
  const writesAfterReopen = recordWrites(world.seam)
  await reopened.close()

  // The wire rows of the full world (the closed v3 shape).
  const wireRows = index1.map((row) => toTeamRootWireRow(row))
  const wireJson = JSON.stringify(wireRows)

  // (b) The fresh (empty) domain: a legitimate empty list.
  const emptyWorld = await openWorld('d1-idx-empty')
  const emptyIndex = buildTeamRootOwnershipIndex(emptyWorld.domain.repositories)
  await emptyWorld.domain.close()

  // (c) ROOT_BINDING_MISMATCH: a root record whose binding row exists as
  // `ordinary`.
  const mismatchRootWorld = await openWorld('d1-idx-root-mismatch')
  await mismatchRootWorld.domain.repositories.teamSessions.put({
    blueprint: BLUEPRINT_A,
    createdAt: CREATED_AT,
    generation: 1,
    rootSessionId: ROOT_A,
  })
  await mismatchRootWorld.domain.repositories.sessionBindings.put({
    kind: 'ordinary',
    schemaVersion: 1,
    sessionId: ROOT_A_STR,
  })
  const mismatchRoot = captureError(() => buildTeamRootOwnershipIndex(mismatchRootWorld.domain.repositories))
  await mismatchRootWorld.domain.close()

  // (d) MEMBER_BINDING_MISMATCH: a member child session bound as
  // `ordinary`.
  const mismatchMemberWorld = await openWorld('d1-idx-member-mismatch')
  const mmRepos = mismatchMemberWorld.domain.repositories
  await mmRepos.teamSessions.put({
    blueprint: BLUEPRINT_A,
    createdAt: CREATED_AT,
    generation: 1,
    rootSessionId: ROOT_A,
  })
  await mmRepos.sessionBindings.put({ kind: 'team-root', schemaVersion: 1, sessionId: ROOT_A_STR })
  await mmRepos.memberInstances.put({
    activityVersion: 1,
    childSessionId: CHILD_A1,
    createdAt: CREATED_AT,
    instanceId: INST_A1,
    label: 'd1a-alpha',
    lifecycle: 'CREATED',
    rootSessionId: ROOT_A,
    templateId: TEMPLATE,
  })
  await mmRepos.sessionBindings.put({ kind: 'ordinary', schemaVersion: 1, sessionId: CHILD_A1_STR })
  const mismatchMember = captureError(() => buildTeamRootOwnershipIndex(mmRepos))
  await mismatchMemberWorld.domain.close()

  // (e) MEMBER_BINDING_CONFLICT: a `team-member` binding that disagrees
  // with the member record (the bound instance id is another one).
  const conflictWorld = await openWorld('d1-idx-conflict')
  const cfRepos = conflictWorld.domain.repositories
  await cfRepos.teamSessions.put({
    blueprint: BLUEPRINT_A,
    createdAt: CREATED_AT,
    generation: 1,
    rootSessionId: ROOT_A,
  })
  await cfRepos.sessionBindings.put({ kind: 'team-root', schemaVersion: 1, sessionId: ROOT_A_STR })
  await cfRepos.memberInstances.put({
    activityVersion: 1,
    childSessionId: CHILD_A1,
    createdAt: CREATED_AT,
    instanceId: INST_A1,
    label: 'd1a-alpha',
    lifecycle: 'CREATED',
    rootSessionId: ROOT_A,
    templateId: TEMPLATE,
  })
  await cfRepos.sessionBindings.put({
    instanceId: String(INST_CONFLICT),
    kind: 'team-member',
    rootSessionId: ROOT_A_STR,
    schemaVersion: 1,
    sessionId: CHILD_A1_STR,
  })
  const conflict = captureError(() => buildTeamRootOwnershipIndex(cfRepos))
  await conflictWorld.domain.close()

  // (f) A corrupt (undecodable) team_sessions row: the storage layer's
  // own typed error propagates as-is (close → tamper the durable file →
  // re-open → build).
  const corruptWorld = await seedFullWorld('d1-idx-corrupt')
  await corruptWorld.domain.close()
  const corruptFile = join(corruptWorld.dir, 'team_domain', 'team_sessions.json')
  writeText(corruptFile, JSON.stringify({ [ROOT_A_STR]: 'not-json-at-all' }))
  const corruptSeam = new FileStorageSeam(corruptWorld.dir)
  const corruptDomain = await openTeamDomain(corruptSeam)
  const corruptIndex = captureError(() => buildTeamRootOwnershipIndex(corruptDomain.repositories))
  await corruptDomain.close()

  // Tear down every scratch dir (state captured; the assertions below
  // never re-read the medium).
  destroyDir(world.dir)
  destroyDir(emptyWorld.dir)
  destroyDir(mismatchRootWorld.dir)
  destroyDir(mismatchMemberWorld.dir)
  destroyDir(conflictWorld.dir)
  destroyDir(corruptWorld.dir)

  return {
    world,
    index1,
    json1,
    json2,
    json3,
    wireRows,
    wireJson,
    writesAfterBuild1,
    writesAfterReopen,
    emptyIndex,
    mismatchRoot,
    mismatchMember,
    conflict,
    corruptIndex,
  }
})()

// ---------------------------------------------------------------------------
// Assertions (synchronous `it` bodies over the captured results)
// ---------------------------------------------------------------------------

describe('D1 (ownership index): the full two-root world', () => {
  it('lists both roots in the repository sort order (by root session id)', () => {
    expect(RT.index1.length).toBe(2)
    expect(RT.index1[0]?.rootSessionId).toBe(ROOT_A_STR)
    expect(RT.index1[1]?.rootSessionId).toBe(ROOT_B_STR)
  })

  it('root A carries the exact durable identity (blueprint A@17, workspace, generation 1)', () => {
    const row = RT.index1[0]
    expect(row).toBeDefined()
    expect(row?.blueprintId).toBe(String(BP_A))
    expect(row?.revision).toBe('17')
    expect(row?.defaultWorkspace).toBe('C:/agent-team/work/d1a')
    expect(row?.createdAt).toBe(CREATED_AT)
    expect(row?.generation).toBe(1)
  })

  it('root B carries its durable identity and EXCLUDES the legacy v1 leader row (memberCount 1)', () => {
    const row = RT.index1[1]
    expect(row).toBeDefined()
    expect(row?.blueprintId).toBe(String(BP_B))
    expect(row?.revision).toBe('3')
    expect(row?.generation).toBe(5)
    // the legacy v1 leader row (childSessionId = the root itself) is NOT
    // a counted member
    expect(row?.memberCount).toBe(1)
    expect(row?.attribution.map((a) => a.instanceId)).toEqual([String(INST_B1)])
    expect(row?.attribution[0]?.childSessionId).toBe(CHILD_B1_STR)
    expect(row?.attribution[0]?.kind).toBe('team-member')
  })

  it('root A EXCLUDES the v2 leader record (memberCount 2, not 3)', () => {
    const row = RT.index1[0]
    expect(row?.memberCount).toBe(2)
    expect(row?.attribution.map((a) => a.instanceId)).toEqual([String(INST_A1), String(INST_A2)])
  })

  it('attribution carries the per-session kind where bound, and ABSENT kind where the child is unbound (non-failure)', () => {
    const row = RT.index1[0]
    expect(row?.attribution[0]?.kind).toBe('team-member')
    // the A2 child session has NO binding row — the kind is absent
    expect(row?.attribution[1]?.kind).toBeUndefined()
    expect(row?.attribution[1]?.childSessionId).toBe(CHILD_A2_STR)
  })

  it('the unbound root B (fresh-root crash window) is a documented non-failure', () => {
    // the full world BUILT without throwing (RT.index1 exists) proves the
    // absent team-root binding row of root B was not a failure.
    expect(RT.index1[1]?.rootSessionId).toBe(ROOT_B_STR)
  })
})

describe('D1 (ownership index): the closed v3 wire row (toTeamRootWireRow)', () => {
  it('the wire row is exactly { rootSessionId, blueprintId, revision, defaultWorkspace?, createdAt, generation, memberCount } — no attribution', () => {
    const [wireA, wireB] = RT.wireRows
    expect(Object.keys(wireA ?? {}).sort()).toEqual([
      'blueprintId',
      'createdAt',
      'defaultWorkspace',
      'generation',
      'memberCount',
      'revision',
      'rootSessionId',
    ])
    expect(wireA).toEqual({
      rootSessionId: ROOT_A_STR,
      blueprintId: String(BP_A),
      revision: '17',
      defaultWorkspace: 'C:/agent-team/work/d1a',
      createdAt: CREATED_AT,
      generation: 1,
      memberCount: 2,
    })
    // root B never set a defaultWorkspace — the KEY is absent, not undefined
    expect(wireB).toBeDefined()
    expect(wireB?.['defaultWorkspace']).toBeUndefined()
    expect(Object.prototype.hasOwnProperty.call(wireB ?? {}, 'defaultWorkspace')).toBe(false)
    expect(wireB).toEqual({
      rootSessionId: ROOT_B_STR,
      blueprintId: String(BP_B),
      revision: '3',
      createdAt: CREATED_AT,
      generation: 5,
      memberCount: 1,
    })
  })
})

describe('D1 (ownership index): determinism (rebuild-identical)', () => {
  it('rebuilding twice over the same rows is byte-identical', () => {
    expect(RT.json1).toBe(RT.json2)
  })

  it('rebuilding after close + re-open over the same medium is byte-identical', () => {
    expect(RT.json3).toBe(RT.json1)
  })

  it('the wire rows are lossless-JSON stable across rebuilds', () => {
    expect(RT.wireJson.length).toBeGreaterThan(0)
    expect(RT.wireJson).toBe(JSON.stringify(RT.wireRows))
  })
})

describe('D1 (ownership index): purity (zero writes)', () => {
  it('building the index (twice) and re-opening never performs a seam write', () => {
    expect(RT.writesAfterBuild1).toBe(RT.world.writesAfterSeed)
    expect(RT.writesAfterReopen).toBe(RT.world.writesAfterSeed)
  })
})

describe('D1 (ownership index): fail-closed integrity failures (never a silent empty list)', () => {
  it('a root bound as `ordinary` → TEAM_OWNERSHIP_INDEX_ROOT_BINDING_MISMATCH with remote-safe details', () => {
    expect(RT.mismatchRoot.ok).toBe(false)
    const err = asOwnershipIndexError(RT.mismatchRoot.error)
    expect(err.code).toBe(TEAM_OWNERSHIP_INDEX_ERROR_CODES.ROOT_BINDING_MISMATCH)
    expect(err.code).toBe('TEAM_OWNERSHIP_INDEX_ROOT_BINDING_MISMATCH')
    expect(err.details['rootSessionId']).toBe(ROOT_A_STR)
    expect(err.details['foundKind']).toBe('ordinary')
    expect(err.details['expectedKind']).toBe('team-root')
  })

  it('a member child bound as `ordinary` → TEAM_OWNERSHIP_INDEX_MEMBER_BINDING_MISMATCH with remote-safe details', () => {
    expect(RT.mismatchMember.ok).toBe(false)
    const err = asOwnershipIndexError(RT.mismatchMember.error)
    expect(err.code).toBe(TEAM_OWNERSHIP_INDEX_ERROR_CODES.MEMBER_BINDING_MISMATCH)
    expect(err.code).toBe('TEAM_OWNERSHIP_INDEX_MEMBER_BINDING_MISMATCH')
    expect(err.details['rootSessionId']).toBe(ROOT_A_STR)
    expect(err.details['instanceId']).toBe(String(INST_A1))
    expect(err.details['childSessionId']).toBe(CHILD_A1_STR)
    expect(err.details['foundKind']).toBe('ordinary')
    expect(err.details['expectedKind']).toBe('team-member')
  })

  it('a team-member binding disagreeing with the member record → TEAM_OWNERSHIP_INDEX_MEMBER_BINDING_CONFLICT with remote-safe details', () => {
    expect(RT.conflict.ok).toBe(false)
    const err = asOwnershipIndexError(RT.conflict.error)
    expect(err.code).toBe(TEAM_OWNERSHIP_INDEX_ERROR_CODES.MEMBER_BINDING_CONFLICT)
    expect(err.code).toBe('TEAM_OWNERSHIP_INDEX_MEMBER_BINDING_CONFLICT')
    expect(err.details['rootSessionId']).toBe(ROOT_A_STR)
    expect(err.details['instanceId']).toBe(String(INST_A1))
    expect(err.details['childSessionId']).toBe(CHILD_A1_STR)
    expect(err.details['bindingInstanceId']).toBe(String(INST_CONFLICT))
    expect(err.details['bindingSessionId']).toBe(CHILD_A1_STR)
  })
})

describe('D1 (ownership index): corrupt rows propagate the storage typed error as-is', () => {
  it('an undecodable team_sessions row → the storage layer RECORD_INVALID (not re-coded, not swallowed)', () => {
    expect(RT.corruptIndex.ok).toBe(false)
    const error = RT.corruptIndex.error
    expect(error).toBeInstanceOf(Error)
    // NOT an ownership-index error — the storage typed error passes through
    expect(error).not.toBeInstanceOf(TeamOwnershipIndexError)
    const code = (error as Error & { code?: unknown }).code
    expect(code).toBe('RECORD_INVALID')
  })
})

describe('D1 (ownership index): the empty domain is a legitimate empty list', () => {
  it('no rows → an empty array (the fail-closed contract is about inconsistencies, not emptiness)', () => {
    expect(RT.emptyIndex).toEqual([])
    expect(JSON.stringify(RT.emptyIndex)).toBe('[]')
  })
})
