/**
 * permission-overlay-generation-conflict — Alpha.3 PR1 plan test 5
 * ("generation conflict").
 *
 * The persistence-boundary CAS: an append names the generation it commits AND
 * the snapshot it replaces (`previousSnapshotId`). Two appends racing on one
 * generation produce exactly one durable snapshot — the loser gets a TYPED
 * conflict and never an overwrite. A `previousSnapshotId` that does not name
 * the durable head is a conflict too: the caller's view of the chain is not
 * the durable chain.
 *
 * This is conflict DETECTION at the persistence boundary only. Mutation
 * SERIALIZATION and authority remain the future GovernanceMutationService's
 * (ADR §1); nothing here authorizes or refuses a caller.
 */

import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { writeText } from '../../testkit/fault-injection/file-seam.mjs'
import { PERMISSION_OVERLAY_STORE } from '../../storage/schema/permission-overlay.js'
import { TEAM_DOMAIN_NAME } from '../../storage/schema/index.js'
import {
  OTHER_INSTANCE_ID,
  capture,
  cloneRows,
  errorProblem,
  fixtureKey,
  openWorld,
  rawOverlayRows,
  snapshotInput,
} from './permission-overlay-helpers.js'

describe('permission-overlay generation conflict / CAS (PR1 plan test 5)', () => {
  it('serializes two concurrent appends at one generation: one wins, the loser gets a typed conflict', async () => {
    const world = await openWorld('cas-concurrent-same-generation')
    await world.port.append(snapshotInput(1))
    const rowsBefore = cloneRows(rawOverlayRows(world.dir))

    const [leader, human] = await Promise.all([
      capture(() => world.port.append(snapshotInput(2, { mutationId: 'mut-leader', actor: 'leader:inst-root' }))),
      capture(() => world.port.append(snapshotInput(2, { mutationId: 'mut-human', actor: 'human:operator' }))),
    ])
    const ok = [leader, human].filter((outcome) => outcome.ok)
    const failed = [leader, human].filter((outcome) => !outcome.ok)
    expect(ok).toHaveLength(1)
    expect(failed).toHaveLength(1)
    if (!failed[0]!.ok) {
      expect(failed[0]!.error).toMatchObject({ code: 'RECORD_DUPLICATE' })
      expect(errorProblem(failed[0]!.error)).toBe('generation-conflict')
    }

    // Exactly one durable generation-2 row, and it is the winner's bytes.
    const rows = rawOverlayRows(world.dir)
    expect(Object.keys(rows).filter((key) => key.endsWith('#2'))).toHaveLength(1)
    if (ok[0]!.ok) {
      expect(JSON.parse(rows[ok[0]!.value.snapshotId]!).provenance.mutationId).toBe(ok[0]!.value.provenance.mutationId)
    }
    // Generation 1 was untouched by the race.
    expect(rows[fixtureKey(1)]).toBe(rowsBefore[fixtureKey(1)])
    expect((await world.port.latest(world.identity))?.metadata.generation).toBe(2)
    world.destroy()
  })

  it('keeps the durable result a gapless, one-row-per-generation chain under concurrent appends', async () => {
    const world = await openWorld('cas-concurrent-chain')
    await world.port.append(snapshotInput(1))

    const outcomes = await Promise.all([
      capture(() => world.port.append(snapshotInput(2, { mutationId: 'mut-a' }))),
      capture(() => world.port.append(snapshotInput(2, { mutationId: 'mut-b' }))),
      capture(() => world.port.append(snapshotInput(3, { mutationId: 'mut-c' }))),
    ])
    // Whichever legal serialization the append critical section produces, the
    // durable result is a chain: one row per generation, every link naming the
    // row below it, nothing overwritten, no gap.
    const rows = rawOverlayRows(world.dir)
    const generations = Object.values(rows)
      .map((raw) => (JSON.parse(raw) as { metadata: { generation: number } }).metadata.generation)
      .sort((left, right) => left - right)
    expect(generations).toEqual([...new Set(generations)])
    expect(generations[0]).toBe(1)
    for (let index = 1; index < generations.length; index++) {
      expect(generations[index]).toBe(generations[index - 1]! + 1)
    }
    for (const raw of Object.values(rows)) {
      const row = JSON.parse(raw) as { metadata: { generation: number; previousSnapshotId: string | null } }
      const expected = row.metadata.generation === 1 ? null : fixtureKey(row.metadata.generation - 1)
      expect(row.metadata.previousSnapshotId).toEqual(expected)
    }
    const committed = Object.values(rows).map(
      (raw) => (JSON.parse(raw) as { provenance: { mutationId: string } }).provenance.mutationId,
    )
    for (const mutationId of committed) expect(['mut-1', 'mut-a', 'mut-b', 'mut-c']).toContain(mutationId)
    expect(outcomes.filter((outcome) => !outcome.ok)).toHaveLength(1)
    expect((await world.port.latest(world.identity))?.metadata.generation).toBe(generations[generations.length - 1])
    world.destroy()
  })

  it('rejects a previousSnapshotId that does not name the durable head', async () => {
    const world = await openWorld('cas-stale-head')
    await world.port.append(snapshotInput(1))
    await world.port.append(snapshotInput(2))
    const rowsBefore = cloneRows(rawOverlayRows(world.dir))

    // The caller believes generation 1 is still the head.
    const attempt = await capture(() => world.port.append(snapshotInput(3, { previousSnapshotId: fixtureKey(1) })))
    expect(attempt.ok).toBe(false)
    if (!attempt.ok) {
      expect(attempt.error).toMatchObject({ code: 'RECORD_DUPLICATE' })
      expect(errorProblem(attempt.error)).toBe('previous-snapshot-id-mismatch')
    }
    expect(rawOverlayRows(world.dir)).toEqual(rowsBefore)
    expect((await world.port.latest(world.identity))?.metadata.generation).toBe(2)
    world.destroy()
  })

  it('rejects a previousSnapshotId naming a snapshot that was never durable (no gaps)', async () => {
    const world = await openWorld('cas-gap')
    await world.port.append(snapshotInput(1))
    const rowsBefore = cloneRows(rawOverlayRows(world.dir))

    const attempt = await capture(() => world.port.append(snapshotInput(3, { previousSnapshotId: fixtureKey(2) })))
    expect(attempt.ok).toBe(false)
    if (!attempt.ok) {
      expect(attempt.error).toMatchObject({ code: 'RECORD_DUPLICATE' })
      expect(errorProblem(attempt.error)).toBe('predecessor-not-durable')
    }
    expect(rawOverlayRows(world.dir)).toEqual(rowsBefore)
    world.destroy()
  })

  it('rejects a first generation that names a predecessor (structural, RECORD_INVALID)', async () => {
    const world = await openWorld('cas-first-generation-link')
    const attempt = await capture(() => world.port.append(snapshotInput(1, { previousSnapshotId: fixtureKey(0) })))
    expect(attempt.ok).toBe(false)
    if (!attempt.ok) expect(attempt.error).toMatchObject({ code: 'RECORD_INVALID' })
    expect(rawOverlayRows(world.dir)).toEqual({})
    world.destroy()
  })

  it('still accepts the correct next append after conflicts (a conflict is not a wedge)', async () => {
    const world = await openWorld('cas-not-a-wedge')
    await world.port.append(snapshotInput(1))
    await capture(() => world.port.append(snapshotInput(1, { mutationId: 'mut-divergent' })))
    await capture(() => world.port.append(snapshotInput(2, { previousSnapshotId: 'wrong' })))

    const good = await world.port.append(snapshotInput(2))
    expect(good.metadata.generation).toBe(2)
    expect((await world.port.history(world.identity)).map((s) => s.metadata.generation)).toEqual([1, 2])
    world.destroy()
  })

  it('refuses a late append into a HOLE below the durable head (the head, not the row, is the chain)', async () => {
    const world = await openWorld('cas-hole-below-head')
    for (const generation of [1, 2, 3]) await world.port.append(snapshotInput(generation))
    const rows = rawOverlayRows(world.dir)
    await world.store.close()

    // One durable row vanishes off-medium (external damage). Regeneration is
    // NOT the persistence layer's job: the writer whose view ends at
    // generation 1 must get a typed conflict instead of filling the hole and
    // silently creating a second, hidden branch below the head.
    const damaged: Record<string, string> = {}
    for (const [key, value] of Object.entries(rows)) {
      if (key !== fixtureKey(2)) damaged[key] = value
    }
    writeText(join(world.dir, TEAM_DOMAIN_NAME, `${PERMISSION_OVERLAY_STORE}.json`), JSON.stringify(damaged))

    const reopened = await world.reopen()
    const attempt = await capture(() => reopened.port.append(snapshotInput(2)))
    expect(attempt.ok).toBe(false)
    if (!attempt.ok) {
      expect(attempt.error).toMatchObject({ code: 'RECORD_DUPLICATE' })
      expect(errorProblem(attempt.error)).toBe('previous-snapshot-id-mismatch')
    }
    // Nothing was written into the hole; the head is still generation 3.
    expect(rawOverlayRows(world.dir)).toEqual(damaged)
    expect((await reopened.port.latest(world.identity))?.metadata.generation).toBe(3)
    reopened.store.close()
    world.destroy()
  })

  it('keeps one MemberInstance’s CAS independent of another’s', async () => {
    const world = await openWorld('cas-per-instance-chain')
    await world.port.append(snapshotInput(1))
    await world.port.append(snapshotInput(1, { memberInstanceId: OTHER_INSTANCE_ID }))

    // beta sits at generation 1; alpha's chain does not unlock beta 3.
    const attempt = await capture(() => world.port.append(snapshotInput(3, { memberInstanceId: OTHER_INSTANCE_ID })))
    expect(attempt.ok).toBe(false)
    if (!attempt.ok) expect(errorProblem(attempt.error)).toBe('predecessor-not-durable')
    expect(
      (await world.port.latest({ teamSessionId: world.identity.teamSessionId, memberInstanceId: OTHER_INSTANCE_ID }))
        ?.metadata.generation,
    ).toBe(1)
    world.destroy()
  })
})
