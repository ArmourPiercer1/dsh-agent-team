/**
 * P8-T2 mandatory test 3 — LIVE overlay (UI §24). The projection overlays an
 * OPTIONAL live residency/activity snapshot onto the durable team:
 *
 * S4 (cold service, `overlay: null`): every member's `liveActivity` is `null`
 * (the nullable overlay lane, no live source at all).
 *
 * S5 (populated overlay, a `Map<InstanceId, MemberLiveActivityDto>`): members
 * PRESENT in the snapshot get exactly that live activity (the live lane is
 * populated); members ABSENT from the snapshot (including the LeaderInstance
 * and a plain worker) get `null`. The durable `activity` lane (if present)
 * stays distinct from `liveActivity`; a one-time snapshot read per projection
 * is the overlay's only touch (`snapshotCount` is 1 per `project`).
 *
 * The overlay NEVER changes the durable identity/generation/workspace — only
 * the `liveActivity` lane differs between the two worlds (asserted by the
 * byte-identical canonical JSON of the durable skeleton).
 *
 * Mock-first (ruling R28): the overlay port is a fake returning its map by
 * reference; the service and the pure fold are REAL.
 *
 * Top-level pattern (plain-node shim): scenarios run at module top level;
 * `it` bodies assert only over captured snapshots.
 *
 * @module @dsh-agent-team/runtime/test/p8t2-overlay
 */

import { describe, expect, it } from 'vitest'
import {
  isRemoteSafeJsonValue,
  serializeTeamProjection,
} from '../../contracts/src/index.js'
import type {
  InstanceId,
  MemberLiveActivityDto,
} from '../../contracts/src/index.js'
import { createP8T2World, makeSource } from './p8t2-helpers.js'

const residentActivity: MemberLiveActivityDto = {
  residency: 'resident',
  currentAction: 'implementing the projection fold',
  runningSince: '2026-08-29T12:09:00.000Z',
  lastActivityAt: '2026-08-29T12:10:00.000Z',
  admittedWorkCorrelation: 'corr-p8t2-live-1',
}
const resumingActivity: MemberLiveActivityDto = {
  residency: 'resuming',
}

interface OverlaySnapshot {
  readonly live: Record<string, MemberLiveActivityDto | null>
  readonly leaderLive: MemberLiveActivityDto | null
  readonly durableActivityKeysPresent: boolean
  readonly memberRowCount: number
  readonly generation: number
  readonly isLosslessJson: boolean
  readonly isFrozen: boolean
  /** Canonical JSON with every `liveActivity` null (the durable skeleton). */
  readonly skeletonCanonical: string
  /** The live lane's canonical JSON (the only thing the overlay may change). */
  readonly liveLaneJson: string
}

let s4: OverlaySnapshot | undefined
let s5: {
  readonly snapshot: OverlaySnapshot
  readonly snapshotCountAfterTwoProjects: number
  readonly overlayIsPresent: boolean
} | undefined

{
  // S4 — cold service (overlay: null).
  const source = makeSource({ memberCount: 3 })
  const coldWorld = createP8T2World({ source, overlay: null })
  const coldProjection = coldWorld.service.project(source.teamSessionId)
  const coldLive: Record<string, MemberLiveActivityDto | null> = {}
  for (const m of coldProjection.members) coldLive[m.instanceId] = m.liveActivity
  s4 = {
    live: coldLive,
    leaderLive: coldProjection.members.find((m) => m.instanceId === 'inst-leader')?.liveActivity ?? null,
    durableActivityKeysPresent: coldProjection.members.some((m) => 'activity' in m),
    memberRowCount: coldProjection.members.length,
    generation: coldProjection.generation,
    isLosslessJson: isRemoteSafeJsonValue(coldProjection),
    isFrozen: Object.isFrozen(coldProjection),
    skeletonCanonical: serializeTeamProjection(coldProjection),
    liveLaneJson: JSON.stringify(coldProjection.members.map((m) => m.liveActivity)),
  }
}

{
  // S5 — populated overlay for two of the four rows (worker 1 + worker 3);
  // the leader and worker 2 are absent → null.
  const source = makeSource({ memberCount: 3 })
  const overlay = new Map<InstanceId, MemberLiveActivityDto>()
  overlay.set('inst-p8t2m1' as InstanceId, residentActivity)
  overlay.set('inst-p8t2m3' as InstanceId, resumingActivity)
  const warmWorld = createP8T2World({ source, overlay })
  const warmProjection = warmWorld.service.project(source.teamSessionId)
  const warmProjection2 = warmWorld.service.project(source.teamSessionId)
  const warmLive: Record<string, MemberLiveActivityDto | null> = {}
  for (const m of warmProjection.members) warmLive[m.instanceId] = m.liveActivity
  void warmProjection2
  s5 = {
    snapshot: {
      live: warmLive,
      leaderLive: warmProjection.members.find((m) => m.instanceId === 'inst-leader')?.liveActivity ?? null,
      durableActivityKeysPresent: warmProjection.members.some((m) => 'activity' in m),
      memberRowCount: warmProjection.members.length,
      generation: warmProjection.generation,
      isLosslessJson: isRemoteSafeJsonValue(warmProjection),
      isFrozen: Object.isFrozen(warmProjection),
      skeletonCanonical: serializeTeamProjection(warmProjection),
      liveLaneJson: JSON.stringify(warmProjection.members.map((m) => m.liveActivity)),
    },
    snapshotCountAfterTwoProjects: warmWorld.overlay?.snapshotCount ?? -1,
    overlayIsPresent: warmWorld.overlay !== null,
  }
}

describe('P8-T2 cold service (overlay null): the live lane is entirely null', () => {
  it('S4.1: every member (incl. the leader) has liveActivity null; no durable activity lane', () => {
    if (s4 === undefined) throw new Error('S4 did not run')
    expect(s4.memberRowCount).toBe(4)
    for (const id of Object.keys(s4.live)) expect(s4.live[id]).toBe(null)
    expect(s4.leaderLive).toBe(null)
    expect(s4.durableActivityKeysPresent).toBe(false)
  })

  it('S4.2: the cold projection is a lossless-JSON frozen DTO', () => {
    if (s4 === undefined) throw new Error('S4 did not run')
    expect(s4.isLosslessJson).toBe(true)
    expect(s4.isFrozen).toBe(true)
  })
})

describe('P8-T2 populated overlay: only the live lane is overlaid', () => {
  it('S5.1: members present in the snapshot get exactly that live activity', () => {
    if (s5 === undefined) throw new Error('S5 did not run')
    expect(s5.snapshot.live['inst-p8t2m1']).toEqual(residentActivity)
    expect(s5.snapshot.live['inst-p8t2m3']).toEqual(resumingActivity)
  })

  it('S5.2: members ABSENT from the snapshot (leader + worker 2) get null', () => {
    if (s5 === undefined) throw new Error('S5 did not run')
    expect(s5.snapshot.live['inst-leader']).toBe(null)
    expect(s5.snapshot.leaderLive).toBe(null)
    expect(s5.snapshot.live['inst-p8t2m2']).toBe(null)
    expect(s5.snapshot.memberRowCount).toBe(4)
  })

  it('S5.3: the durable lane is untouched (no durable `activity` key; identity + generation stable)', () => {
    if (s5 === undefined) throw new Error('S5 did not run')
    expect(s5.snapshot.durableActivityKeysPresent).toBe(false)
    expect(s5.snapshot.generation).toBe(1)
    // The durable skeleton (identity/workspace/child ids) is byte-identical
    // between the cold and warm projections — the overlay only fills the
    // live lane.
    if (s4 === undefined) throw new Error('S4 did not run')
    const strip = (json: string) =>
      json.replace(/"liveActivity":(null|\{[^}]*\})/g, '"liveActivity":null')
    expect(strip(s5.snapshot.skeletonCanonical)).toBe(strip(s4.skeletonCanonical))
    expect(s5.snapshot.liveLaneJson).not.toBe(s4.liveLaneJson)
  })

  it('S5.4: one snapshot read PER projection (two projects → snapshotCount 2)', () => {
    if (s5 === undefined) throw new Error('S5 did not run')
    expect(s5.overlayIsPresent).toBe(true)
    expect(s5.snapshotCountAfterTwoProjects).toBe(2)
  })

  it('S5.5: the populated projection is a lossless-JSON frozen DTO', () => {
    if (s5 === undefined) throw new Error('S5 did not run')
    expect(s5.snapshot.isLosslessJson).toBe(true)
    expect(s5.snapshot.isFrozen).toBe(true)
  })
})
