/**
 * Scratch discriminator (evidence only, NOT a nine-root spec).
 *
 * Question: the p6t1 red is a race between concurrent per-activation
 * compatibility re-probes. What makes the SAME interleaving sometimes green?
 *
 * `probe.ts:replaceState()` is `delete(row)` then `put(row)`; the repository's
 * `putRecord` is `{ if (existing === value) return; if (existing !== undefined)
 * onConflict() }` — identical stored BYTES are a no-op, different bytes are
 * `RECORD_DUPLICATE`. The stored record carries `computedAt: new Date()
 * .toISOString()`, so the two racing writers collide if and only if their
 * timestamps straddle a millisecond boundary.
 *
 * Legs:
 *   D1  cold row, two racing puts with DIFFERENT computedAt -> second rejects
 *   D2  cold row, two racing puts with IDENTICAL computedAt -> second is a no-op
 *   D3  the same race behind one serialized writer -> no duplicate, and the
 *       second reader sees the first writer's row already fresh
 */
import { expect, it } from 'vitest'
import { createCompatibilityAuthority } from '../../../../../../packages/runtime/compatibility/index.js'
import {
  P6T1_FIXTURE,
  createP6T1World,
  destroyP6T1World,
} from '../../../../../../packages/runtime/test/p6t1-helpers.js'

const ROOT = String(P6T1_FIXTURE.rootSessionId)

/**
 * Race two writers over ONE real durable compatibility row, staged exactly as
 * `probe.ts:replaceState()` stages it (`delete` then `put`). The row is the one
 * a real probe wrote, so the stored BYTES are production bytes; the only thing
 * the two writers differ in is `computedAt`.
 */
async function raceTwoPuts(basename: string, shiftBMs: number) {
  const world = await createP6T1World(basename)
  try {
    await createCompatibilityAuthority({
      repositories: world.domain.repositories,
      rootSessionId: ROOT,
      blueprint: world.blueprint,
      environmentFacts: world.ports.environmentFacts,
    }).evaluate()
    const repository = world.domain.repositories.compatibility
    const real = repository.get(ROOT)
    if (real === undefined) throw new Error('discriminator: no durable row after evaluate')
    const stamp = (ms: number): string =>
      new Date(new Date(real.computedAt).getTime() + ms).toISOString()
    const errors: (string | undefined)[] = []
    await Promise.all([
      (async () => {
        try {
          await repository.delete(ROOT)
          await repository.put({ ...real, computedAt: stamp(0) } as never)
          errors.push(undefined)
        } catch (error) {
          errors.push(String((error as { code?: unknown }).code ?? error))
        }
      })(),
      (async () => {
        try {
          await repository.delete(ROOT)
          await repository.put({ ...real, computedAt: stamp(shiftBMs) } as never)
          errors.push(undefined)
        } catch (error) {
          errors.push(String((error as { code?: unknown }).code ?? error))
        }
      })(),
    ])
    return errors
  } finally {
    await destroyP6T1World(world)
  }
}

it('D1/D2: the duplicate-vs-no-op split is the stored bytes, not the schedule', async () => {
  const different = await raceTwoPuts('disc-diff-1', 1)
  const identical = await raceTwoPuts('disc-same-1', 0)
  const summary = (e: (string | undefined)[]): string =>
    e.filter((x) => x !== undefined).join('+') || 'no-error'
  console.log(
    `DISCRIMINATOR differentBytes(+1ms)=${summary(different)} identicalBytes=${summary(identical)}`,
  )
  expect(different.some((e) => e !== undefined)).toBe(true)
  expect(identical.every((e) => e === undefined)).toBe(true)
})
