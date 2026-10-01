/**
 * permission-overlay-latest-generation — Alpha.3 PR1 plan test 2
 * ("latest generation").
 *
 * ADR §2: "Current authority: highest generation snapshot". The authority
 * read is derived from the generation VALUE — never from append order, row
 * order or scan order — and it is per (TeamSession, MemberInstance).
 */

import { writeText } from '../../testkit/fault-injection/file-seam.mjs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

import { PERMISSION_OVERLAY_DOMAIN_NAME, PERMISSION_OVERLAY_STORE } from '../../storage/schema/permission-overlay.js'
import {
  OTHER_INSTANCE_ID,
  fixtureKey,
  openWorld,
  rawOverlayRows,
  snapshotInput,
} from './permission-overlay-helpers.js'

describe('permission-overlay latest = highest generation (PR1 plan test 2)', () => {
  it('reports the highest generation as the current authority', async () => {
    const world = await openWorld('latest-highest')
    for (const generation of [1, 2, 3, 4, 5]) await world.port.append(snapshotInput(generation))

    const latest = await world.port.latest(world.identity)
    expect(latest?.metadata.generation).toBe(5)
    expect(latest?.provenance.mutationId).toBe('mut-5')
    world.destroy()
  })

  it('derives the authority from the generation VALUE, not from durable row order', async () => {
    const world = await openWorld('latest-not-row-order')
    for (const generation of [1, 2, 3]) await world.port.append(snapshotInput(generation))
    const before = rawOverlayRows(world.dir)
    expect(Object.keys(before)).toEqual([fixtureKey(1), fixtureKey(2), fixtureKey(3)])
    await world.store.close()

    // Re-write the medium with the SAME rows in reversed key order: a pure
    // read-order experiment — every row keeps its exact bytes.
    const reversed: Record<string, string> = {}
    for (const key of Object.keys(before).reverse()) reversed[key] = before[key]!
    expect(Object.keys(reversed)[0]).toBe(fixtureKey(3))
    writeText(join(world.dir, PERMISSION_OVERLAY_DOMAIN_NAME, `${PERMISSION_OVERLAY_STORE}.json`), JSON.stringify(reversed))

    const reopened = await world.reopen()
    const latest = await reopened.port.latest(world.identity)
    expect(latest?.metadata.generation).toBe(3)
    // The authority is still the byte-identical generation-3 row.
    expect(latest).toEqual(JSON.parse(before[fixtureKey(3)]!) as unknown)
    reopened.store.close()
    world.destroy()
  })

  it('is per MemberInstance: the highest generation is not shared across instances', async () => {
    const world = await openWorld('latest-per-instance')
    await world.port.append(snapshotInput(1))
    await world.port.append(snapshotInput(2))
    await world.port.append(snapshotInput(1, { memberInstanceId: OTHER_INSTANCE_ID }))

    expect((await world.port.latest(world.identity))?.metadata.generation).toBe(2)
    expect(
      (await world.port.latest({ teamSessionId: world.identity.teamSessionId, memberInstanceId: OTHER_INSTANCE_ID }))
        ?.metadata.generation,
    ).toBe(1)
    world.destroy()
  })

  it('reads history ascending by generation with its chain links (audit view)', async () => {
    const world = await openWorld('latest-history-order')
    for (const generation of [1, 2, 3]) await world.port.append(snapshotInput(generation))

    const history = await world.port.history(world.identity)
    expect(history.map((s) => s.metadata.generation)).toEqual([1, 2, 3])
    expect(history.map((s) => s.metadata.previousSnapshotId)).toEqual([null, fixtureKey(1), fixtureKey(2)])
    // History is audit-only: reading it never changes the authority.
    expect((await world.port.latest(world.identity))?.metadata.generation).toBe(3)
    world.destroy()
  })

  it('reads one snapshot at an exact generation (the durable audit point read)', async () => {
    const world = await openWorld('latest-point-read')
    for (const generation of [1, 2, 3]) await world.port.append(snapshotInput(generation))

    // `at` is the durable audit read; it is deliberately NOT on the port
    // (the port stays append/latest/history — see the port-surface spec).
    expect((await world.store.repository.at(world.identity.teamSessionId, world.identity.memberInstanceId, 2))?.metadata.generation).toBe(2)
    expect(await world.store.repository.at(world.identity.teamSessionId, world.identity.memberInstanceId, 99)).toBeUndefined()
    world.destroy()
  })

  it('never exposes the history fold as the authority: a missing middle row does not move the head', async () => {
    const world = await openWorld('latest-no-replay')
    for (const generation of [1, 2, 3]) await world.port.append(snapshotInput(generation))
    const rows = rawOverlayRows(world.dir)
    await world.store.close()

    // Corrupt one MIDDLE row away (delete it off-medium) to prove the head is
    // the highest durable snapshot, not a fold/replay over a complete chain.
    const withoutMiddle: Record<string, string> = {}
    for (const [key, value] of Object.entries(rows)) {
      if (key !== fixtureKey(2)) withoutMiddle[key] = value
    }
    writeText(join(world.dir, PERMISSION_OVERLAY_DOMAIN_NAME, `${PERMISSION_OVERLAY_STORE}.json`), JSON.stringify(withoutMiddle))

    const reopened = await world.reopen()
    expect((await reopened.port.latest(world.identity))?.metadata.generation).toBe(3)
    expect((await reopened.port.history(world.identity)).map((s) => s.metadata.generation)).toEqual([1, 3])
    reopened.store.close()
    world.destroy()
  })
})
