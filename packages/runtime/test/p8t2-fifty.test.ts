/**
 * P8-T2 mandatory test 2 — FIFTY instances + COMPLEXITY GUARD (TaskDoc §11.9
 * P8-T2; DevPlan §21.2).
 *
 * S2 (scale): a team of 50 MemberInstances (+ the LeaderInstance = 51 member
 * rows) projects into one valid frozen `TeamProjectionDto` with exactly 51
 * unique instance ids, each non-leader keeping its durable childSessionId,
 * read from the durable source exactly once.
 *
 * S3 (complexity guard, the §21.2 red line): the projection's complexity is a
 * function of the durable team shape ONLY, never of the team's child Session
 * logs. Two worlds over the SAME 50-member source differ only in the backing
 * store's `childLogVolume` (0 vs 5,000,000) — a fact the port interface does
 * not expose to the fold. Their projections must be BYTE-IDENTICAL canonical
 * JSON, and the §21.2 trap counter must stay 0 in both: the fold is never
 * fed child logs, however large they are.
 *
 * Mock-first (ruling R28): the TeamDomain source port is a fake carrying the
 * (deliberately invisible) child-log volume; the service and the pure fold are
 * REAL.
 *
 * Top-level pattern (plain-node shim): scenarios run at module top level
 * (synchronous); `it` bodies assert only over the captured snapshots.
 *
 * @module @dsh-agent-team/runtime/test/p8t2-fifty
 */

import { describe, expect, it } from 'vitest'
import {
  isRemoteSafeJsonValue,
  serializeTeamProjection,
} from '../../contracts/src/index.js'
import type { TeamProjectionDto } from '../../contracts/src/index.js'
import { createP8T2World, makeSource } from './p8t2-helpers.js'

interface FiftySnapshot {
  readonly memberRowCount: number
  readonly leaderPresent: boolean
  readonly uniqueInstanceIds: number
  readonly nonLeaderAllHaveChild: boolean
  readonly readCount: number
  readonly childLogReadCount: number
  readonly isLosslessJson: boolean
  readonly isFrozen: boolean
  readonly canonical: string
  readonly childLogVolume: number
}

let s2: FiftySnapshot | undefined
let s3small: FiftySnapshot | undefined
let s3large: FiftySnapshot | undefined

{
  // S2 — a 50-member team (51 rows incl. the leader).
  const source = makeSource({ memberCount: 50, generation: 12 })
  const world = createP8T2World({ source, overlay: null })
  const projection = world.service.project(source.teamSessionId)
  const rows = projection.members
  s2 = {
    memberRowCount: rows.length,
    leaderPresent: rows.some((m) => m.instanceId === 'inst-leader'),
    uniqueInstanceIds: new Set(rows.map((m) => m.instanceId)).size,
    nonLeaderAllHaveChild: rows
      .filter((m) => m.instanceId !== 'inst-leader')
      .every((m) => 'childSessionId' in m && m.childSessionId !== undefined),
    readCount: world.domain.readCount,
    childLogReadCount: world.domain.childLogReadCount,
    isLosslessJson: isRemoteSafeJsonValue(projection),
    isFrozen: Object.isFrozen(projection),
    canonical: serializeTeamProjection(projection),
    childLogVolume: world.domain.childLogVolume,
  }
}

{
  // S3 — the SAME 50-member source, projected twice under a cold service,
  // differing ONLY in the backing store's child-log volume (0 vs 5,000,000).
  const source = makeSource({ memberCount: 50, generation: 12 })
  const smallWorld = createP8T2World({ source, overlay: null, childLogVolume: 0 })
  const largeWorld = createP8T2World({
    source,
    overlay: null,
    childLogVolume: 5_000_000,
  })
  const id = source.teamSessionId
  const smallProjection = smallWorld.service.project(id)
  const largeProjection = largeWorld.service.project(id)

  const capture = (
    world: {
      domain: {
        readCount: number
        childLogReadCount: number
        childLogVolume: number
      }
    },
    projection: TeamProjectionDto,
  ): FiftySnapshot => ({
    memberRowCount: projection.members.length,
    leaderPresent: projection.members.some((m) => m.instanceId === 'inst-leader'),
    uniqueInstanceIds: new Set(projection.members.map((m) => m.instanceId)).size,
    nonLeaderAllHaveChild: projection.members
      .filter((m) => m.instanceId !== 'inst-leader')
      .every((m) => 'childSessionId' in m && m.childSessionId !== undefined),
    readCount: world.domain.readCount,
    childLogReadCount: world.domain.childLogReadCount,
    isLosslessJson: isRemoteSafeJsonValue(projection),
    isFrozen: Object.isFrozen(projection),
    canonical: serializeTeamProjection(projection),
    childLogVolume: world.domain.childLogVolume,
  })

  s3small = capture(smallWorld, smallProjection)
  s3large = capture(largeWorld, largeProjection)
}

describe('P8-T2 fifty instances', () => {
  it('S2.1: a 50-member team projects to 51 rows (leader + 50 workers), all unique', () => {
    if (s2 === undefined) throw new Error('S2 did not run')
    expect(s2.memberRowCount).toBe(51)
    expect(s2.leaderPresent).toBe(true)
    expect(s2.uniqueInstanceIds).toBe(51)
  })

  it('S2.2: every non-leader keeps its durable childSessionId (invariant 23)', () => {
    if (s2 === undefined) throw new Error('S2 did not run')
    expect(s2.nonLeaderAllHaveChild).toBe(true)
  })

  it('S2.3: the 50-row projection is one lossless-JSON frozen DTO from one durable read', () => {
    if (s2 === undefined) throw new Error('S2 did not run')
    expect(s2.isLosslessJson).toBe(true)
    expect(s2.isFrozen).toBe(true)
    expect(s2.readCount).toBe(1)
    expect(s2.childLogReadCount).toBe(0)
  })
})

describe('P8-T2 complexity guard (child-log volume never reaches the fold, §21.2)', () => {
  it('S3.1: volume 0 vs 5,000,000 yield BYTE-IDENTICAL canonical projections', () => {
    if (s3small === undefined || s3large === undefined) throw new Error('S3 did not run')
    expect(s3small.childLogVolume).toBe(0)
    expect(s3large.childLogVolume).toBe(5_000_000)
    expect(s3small.canonical).toBe(s3large.canonical)
  })

  it('S3.2: the fold never reads a child log regardless of volume (trap stays 0)', () => {
    if (s3small === undefined || s3large === undefined) throw new Error('S3 did not run')
    expect(s3small.childLogReadCount).toBe(0)
    expect(s3large.childLogReadCount).toBe(0)
  })

  it('S3.3: the projection shape is a pure function of the durable team (51 rows, unique)', () => {
    if (s3small === undefined || s3large === undefined) throw new Error('S3 did not run')
    expect(s3small.memberRowCount).toBe(51)
    expect(s3large.memberRowCount).toBe(51)
    expect(s3small.uniqueInstanceIds).toBe(51)
    expect(s3large.uniqueInstanceIds).toBe(51)
    expect(s3small.nonLeaderAllHaveChild).toBe(true)
    expect(s3large.nonLeaderAllHaveChild).toBe(true)
  })
})
