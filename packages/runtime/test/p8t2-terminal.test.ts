/**
 * P8-T2 mandatory test 4 — TERMINAL states (Architecture §8.6, invariant 23).
 *
 * A team whose members sit in terminal lifecycle states (ARCHIVED / DISPOSED)
 * still projects into one valid, frozen `TeamProjectionDto`:
 *
 * S6: the terminal rows are projected verbatim (lifecycle preserved); every
 *     non-leader — INCLUDING ARCHIVED and DISPOSED members — still carries its
 *     durable childSessionId (invariant 23: the child Session binding survives
 *     terminal states; the leader still carries none, invariant 14); the
 *     service is COLD (`overlay: null`) so no live overlay is applied (every
 *     `liveActivity` is null, terminal or not); and the ledger summary is
 *     durable + self-consistent (`totalEntries` equals the sum of the eight
 *     `byCategory` counts).
 *
 * Mock-first (ruling R28): the TeamDomain source port is a fake; the service
 * and the pure fold are REAL.
 *
 * Top-level pattern (plain-node shim): the scenario runs at module top level;
 * `it` bodies assert only over the captured snapshot.
 *
 * @module @dsh-agent-team/runtime/test/p8t2-terminal
 */

import { describe, expect, it } from 'vitest'
import { isRemoteSafeJsonValue } from '../../contracts/src/index.js'
import {
  createP8T2World,
  makeSource,
  rawLeaderMember,
  rawLedger,
  rawMember,
} from './p8t2-helpers.js'

interface TerminalSnapshot {
  readonly lifecycleByInstance: Record<string, string>
  readonly archivedHasChild: boolean
  readonly disposedHasChild: boolean
  readonly runningHasChild: boolean
  readonly leaderHasChild: boolean
  readonly allLiveNull: boolean
  readonly memberRowCount: number
  readonly generation: number
  readonly ledger: {
    readonly latestSequence: number
    readonly totalEntries: number
    readonly pendingControlCount: number
    readonly byCategory: Record<string, number>
    readonly categoryCount: number
  }
  readonly isLosslessJson: boolean
  readonly isFrozen: boolean
}

let s6: TerminalSnapshot | undefined

{
  // A team with a SETTLED leader, one ARCHIVED, one DISPOSED, one RUNNING
  // member, over a non-empty, self-consistent durable ledger.
  const byCategory = { team: 2, lifecycle: 3, control: 1, member: 2 }
  const ledger = rawLedger({
    latestSequence: 42,
    pendingControlCount: 1,
    byCategory,
  })
  const source = makeSource({
    generation: 7,
    members: [
      rawLeaderMember({ lifecycle: 'SETTLED' }),
      rawMember(1, { lifecycle: 'ARCHIVED' }),
      rawMember(2, { lifecycle: 'DISPOSED' }),
      rawMember(3, { lifecycle: 'RUNNING' }),
    ],
    ledger,
  })
  const world = createP8T2World({ source, overlay: null })
  const projection = world.service.project(source.teamSessionId)

  const lifecycleByInstance: Record<string, string> = {}
  for (const m of projection.members) lifecycleByInstance[m.instanceId] = m.lifecycle
  const by = projection.ledger.byCategory

  s6 = {
    lifecycleByInstance,
    archivedHasChild:
      'childSessionId' in projection.members.find((m) => m.instanceId === 'inst-p8t2m1')! &&
      (projection.members.find((m) => m.instanceId === 'inst-p8t2m1')!.childSessionId ?? '') !== '',
    disposedHasChild:
      'childSessionId' in projection.members.find((m) => m.instanceId === 'inst-p8t2m2')! &&
      (projection.members.find((m) => m.instanceId === 'inst-p8t2m2')!.childSessionId ?? '') !== '',
    runningHasChild:
      'childSessionId' in projection.members.find((m) => m.instanceId === 'inst-p8t2m3')! &&
      (projection.members.find((m) => m.instanceId === 'inst-p8t2m3')!.childSessionId ?? '') !== '',
    leaderHasChild: 'childSessionId' in projection.members.find((m) => m.instanceId === 'inst-leader')!,
    allLiveNull: projection.members.every((m) => m.liveActivity === null),
    memberRowCount: projection.members.length,
    generation: projection.generation,
    ledger: {
      latestSequence: projection.ledger.latestSequence,
      totalEntries: projection.ledger.totalEntries,
      pendingControlCount: projection.ledger.pendingControlCount,
      byCategory: { ...by },
      categoryCount: Object.keys(by).length,
    },
    isLosslessJson: isRemoteSafeJsonValue(projection),
    isFrozen: Object.isFrozen(projection),
  }
}

describe('P8-T2 terminal states (ARCHIVED / DISPOSED), cold service', () => {
  it('S6.1: the terminal rows are projected with their lifecycle preserved', () => {
    if (s6 === undefined) throw new Error('S6 did not run')
    expect(s6.memberRowCount).toBe(4)
    expect(s6.lifecycleByInstance['inst-leader']).toBe('SETTLED')
    expect(s6.lifecycleByInstance['inst-p8t2m1']).toBe('ARCHIVED')
    expect(s6.lifecycleByInstance['inst-p8t2m2']).toBe('DISPOSED')
    expect(s6.lifecycleByInstance['inst-p8t2m3']).toBe('RUNNING')
  })

  it('S6.2: ARCHIVED + DISPOSED members keep their durable childSessionId (invariant 23)', () => {
    if (s6 === undefined) throw new Error('S6 did not run')
    expect(s6.archivedHasChild).toBe(true)
    expect(s6.disposedHasChild).toBe(true)
    expect(s6.runningHasChild).toBe(true)
    expect(s6.leaderHasChild).toBe(false)
  })

  it('S6.3: the cold service applies no live overlay (every liveActivity null)', () => {
    if (s6 === undefined) throw new Error('S6 did not run')
    expect(s6.allLiveNull).toBe(true)
  })

  it('S6.4: the ledger is durable and self-consistent (totalEntries == sum of 8 categories)', () => {
    if (s6 === undefined) throw new Error('S6 did not run')
    expect(s6.ledger.categoryCount).toBe(8)
    let sum = 0
    for (const key of Object.keys(s6.ledger.byCategory)) {
      sum += s6.ledger.byCategory[key] ?? 0
    }
    expect(s6.ledger.totalEntries).toBe(sum)
    expect(s6.ledger.latestSequence).toBe(42)
    expect(s6.ledger.pendingControlCount).toBe(1)
  })

  it('S6.5: the terminal projection is a lossless-JSON frozen DTO with the durable generation', () => {
    if (s6 === undefined) throw new Error('S6 did not run')
    expect(s6.isLosslessJson).toBe(true)
    expect(s6.isFrozen).toBe(true)
    expect(s6.generation).toBe(7)
  })
})
