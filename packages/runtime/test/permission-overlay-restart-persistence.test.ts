/**
 * permission-overlay-restart-persistence — Alpha.3 PR1 plan test 3
 * ("restart persistence").
 *
 * A restart is modelled exactly as the governance restart specs model it: a
 * NEW FileStorageSeam object over the SAME scratch directory (a fresh
 * process), never a reused handle. Snapshots and the current authority must
 * come off the medium.
 */

import { describe, expect, it } from 'vitest'

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

describe('permission-overlay restart persistence (PR1 plan test 3)', () => {
  it('reopens over the same durable store and reports the same authority and history', async () => {
    const world = await openWorld('restart-same-authority')
    await world.port.append(snapshotInput(1))
    await world.port.append(snapshotInput(2))
    const appended = await world.port.append(snapshotInput(3))
    const rowsBefore = cloneRows(rawOverlayRows(world.dir))
    await world.store.close()

    // RESTART: new seam object, new store handle, new port — same directory.
    const reopened = await world.reopen()
    expect(await reopened.port.latest(world.identity)).toEqual(appended)
    expect((await reopened.port.history(world.identity)).map((s) => s.metadata.generation)).toEqual([1, 2, 3])
    expect((await reopened.port.history(world.identity)).map((s) => s.snapshotId)).toEqual([
      fixtureKey(1),
      fixtureKey(2),
      fixtureKey(3),
    ])
    // Re-opening never rewrote the medium.
    expect(rawOverlayRows(world.dir)).toEqual(rowsBefore)
    reopened.store.close()
    world.destroy()
  })

  it('resumes the chain after a restart (generation and previous link come from the medium)', async () => {
    const world = await openWorld('restart-resume-chain')
    await world.port.append(snapshotInput(1))
    await world.port.append(snapshotInput(2))
    await world.store.close()

    const reopened = await world.reopen()
    const third = await reopened.port.append(snapshotInput(3))
    expect(third.metadata).toEqual({ generation: 3, previousSnapshotId: fixtureKey(2) })
    expect((await reopened.port.latest(world.identity))?.metadata.generation).toBe(3)
    reopened.store.close()
    world.destroy()
  })

  it('still refuses a stale generation after a restart (the head is durable, not process state)', async () => {
    const world = await openWorld('restart-stale-generation')
    await world.port.append(snapshotInput(1))
    await world.port.append(snapshotInput(2))
    const rowsBefore = cloneRows(rawOverlayRows(world.dir))
    await world.store.close()

    const reopened = await world.reopen()
    const stale = await capture(() => reopened.port.append(snapshotInput(2, { mutationId: 'mut-replayed' })))
    expect(stale.ok).toBe(false)
    if (!stale.ok) {
      expect(stale.error).toMatchObject({ code: 'RECORD_DUPLICATE' })
      expect(errorProblem(stale.error)).toBe('generation-conflict')
    }
    expect((await reopened.port.latest(world.identity))?.metadata.generation).toBe(2)
    expect(rawOverlayRows(world.dir)).toEqual(rowsBefore)
    reopened.store.close()
    world.destroy()
  })

  it('restarts with per-identity isolation intact', async () => {
    const world = await openWorld('restart-per-identity')
    await world.port.append(snapshotInput(1))
    await world.port.append(snapshotInput(2))
    await world.port.append(snapshotInput(1, { memberInstanceId: OTHER_INSTANCE_ID }))
    await world.store.close()

    const reopened = await world.reopen()
    expect((await reopened.port.latest(world.identity))?.metadata.generation).toBe(2)
    expect(
      (await reopened.port.latest({ teamSessionId: world.identity.teamSessionId, memberInstanceId: OTHER_INSTANCE_ID }))
        ?.metadata.generation,
    ).toBe(1)
    reopened.store.close()
    world.destroy()
  })

  it('adopts an already-stamped medium instead of initializing it away', async () => {
    const world = await openWorld('restart-adopts-medium')
    await world.port.append(snapshotInput(1))
    const rowsBefore = cloneRows(rawOverlayRows(world.dir))
    await world.store.close()

    // Sequential re-opens (the domain is opened by name, one holder at a
    // time), each of which must ADOPT the durable rows.
    for (const _attempt of [1, 2]) {
      const reopened = await world.reopen()
      expect((await reopened.port.latest(world.identity))?.metadata.generation).toBe(1)
      expect(rawOverlayRows(world.dir)).toEqual(rowsBefore)
      reopened.store.close()
    }
    world.destroy()
  })
})
