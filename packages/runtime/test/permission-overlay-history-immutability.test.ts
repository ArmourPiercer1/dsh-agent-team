/**
 * permission-overlay-history-immutability — Alpha.3 PR1 plan test 4
 * ("immutable history").
 *
 * Two halves, both required by the plan:
 *
 * 1. NO update/delete API EXISTS — checked on the surfaced objects, not on
 *    prose: the durable repository and the runtime port expose append /
 *    latest / history (plus the `at` audit read on the durable side) and
 *    nothing that could rewrite or remove a stored snapshot;
 * 2. an append at an ALREADY-DURABLE generation is rejected, and the earlier
 *    snapshots stay BYTE-STABLE (their stored bytes are compared across
 *    later appends).
 */

import { describe, expect, it } from 'vitest'

import { PermissionOverlayRepository } from '../../storage/repositories/permission-overlays.js'
import {
  capture,
  cloneRows,
  errorProblem,
  openWorld,
  rawOverlayRows,
  snapshotInput,
} from './permission-overlay-helpers.js'

/** Every verb that could rewrite or remove a durable snapshot. */
const WRITE_BYPASS_VERBS: readonly string[] = [
  'update',
  'put',
  'set',
  'overwrite',
  'replace',
  'write',
  'delete',
  'remove',
  'drop',
  'erase',
  'purge',
  'clear',
  'truncate',
  'reset',
  'replay',
  'compact',
  'prune',
  'patch',
  'amend',
  'revise',
  'mutate',
  'handle',
  'seam',
  'table',
]

/** Public surface: own members plus the prototype's members. */
function surface(value: object): string[] {
  const names = new Set<string>(Object.getOwnPropertyNames(value))
  const proto = Object.getPrototypeOf(value) as object | null
  if (proto !== null && proto !== Object.prototype) {
    for (const name of Object.getOwnPropertyNames(proto)) names.add(name)
  }
  names.delete('constructor')
  return [...names].sort()
}

describe('permission-overlay history immutability (PR1 plan test 4)', () => {
  it('exposes no update/delete/overwrite surface on the durable repository', async () => {
    const world = await openWorld('immutable-repo-surface')
    const exposed = surface(PermissionOverlayRepository.prototype)
    for (const verb of WRITE_BYPASS_VERBS) expect(exposed).not.toContain(verb)
    // The whole surface is the append-only contract, nothing else.
    expect(exposed).toEqual(['append', 'at', 'history', 'latest', 'store'])
    // And no raw seam/table handle is reachable through it.
    expect(surface(world.store.repository)).toEqual(['append', 'at', 'history', 'latest', 'store'])
    expect(world.store.repository instanceof PermissionOverlayRepository).toBe(true)
    world.destroy()
  })

  it('exposes no update/delete/overwrite surface on the runtime port', async () => {
    const world = await openWorld('immutable-port-surface')
    const exposed = surface(world.port)
    for (const verb of WRITE_BYPASS_VERBS) expect(exposed).not.toContain(verb)
    expect(exposed).toEqual(['append', 'history', 'latest'])
    world.destroy()
  })

  it('keeps every earlier snapshot byte-stable across later appends', async () => {
    const world = await openWorld('immutable-byte-stable')
    const first = await world.port.append(snapshotInput(1))
    const second = await world.port.append(snapshotInput(2))
    const rowsAfterTwo = cloneRows(rawOverlayRows(world.dir))
    const firstBytes = rowsAfterTwo[first.snapshotId]
    const secondBytes = rowsAfterTwo[second.snapshotId]

    await world.port.append(snapshotInput(3))
    await world.port.append(snapshotInput(4))

    const rowsAfterFour = rawOverlayRows(world.dir)
    expect(rowsAfterFour[first.snapshotId]).toBe(firstBytes)
    expect(rowsAfterFour[second.snapshotId]).toBe(secondBytes)
    expect(Object.keys(rowsAfterFour)).toHaveLength(4)
    world.destroy()
  })

  it('rejects an append at an already-durable generation and leaves the row untouched', async () => {
    const world = await openWorld('immutable-occupied-generation')
    const first = await world.port.append(snapshotInput(1))
    const rowsBefore = cloneRows(rawOverlayRows(world.dir))

    const attempt = await capture(() =>
      world.port.append(
        snapshotInput(1, { mutationId: 'mut-divergent', rules: [{ operation: 'exec', resource: 'rm -rf /', effect: 'deny' }] }),
      ),
    )
    expect(attempt.ok).toBe(false)
    if (!attempt.ok) {
      expect(attempt.error).toMatchObject({ code: 'RECORD_DUPLICATE' })
      expect(errorProblem(attempt.error)).toBe('generation-conflict')
    }
    expect(rawOverlayRows(world.dir)).toEqual(rowsBefore)
    // The surviving row is still the original one, byte for byte.
    const survived = await world.store.repository.at(world.identity.teamSessionId, world.identity.memberInstanceId, 1)
    expect(survived?.provenance.mutationId).toBe('mut-1')
    expect(rawOverlayRows(world.dir)[first.snapshotId]).toBe(rowsBefore[first.snapshotId])
    world.destroy()
  })

  it('re-accepts the identical snapshot at a durable generation as a no-op (idempotence is not an update)', async () => {
    const world = await openWorld('immutable-idempotent')
    const input = snapshotInput(1)
    const first = await world.port.append(input)
    const rowsBefore = cloneRows(rawOverlayRows(world.dir))

    expect((await world.port.append(input)).snapshotId).toBe(first.snapshotId)
    expect(rawOverlayRows(world.dir)).toEqual(rowsBefore)
    world.destroy()
  })

  it('never removes a row: the durable row count only ever grows', async () => {
    const world = await openWorld('immutable-row-count')
    const counts: number[] = []
    counts.push(Object.keys(rawOverlayRows(world.dir)).length)
    for (const generation of [1, 2, 3]) {
      await world.port.append(snapshotInput(generation))
      counts.push(Object.keys(rawOverlayRows(world.dir)).length)
    }
    // A rejected append does not remove or replace anything either.
    await capture(() => world.port.append(snapshotInput(2, { mutationId: 'mut-divergent' })))
    counts.push(Object.keys(rawOverlayRows(world.dir)).length)
    expect(counts).toEqual([0, 1, 2, 3, 3])
    world.destroy()
  })
})
