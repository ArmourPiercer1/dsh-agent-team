/**
 * Scratch repro (evidence only, NOT a nine-root spec): does a cold-generation
 * compatibility re-probe race deterministically?
 *
 * Two authorities over ONE repositories object, both facing a cold (absent)
 * compatibility row — exactly the state five parallel activations of a fresh
 * team face at step 6. Run 12 times; report the outcome inventory.
 */
import { expect, it } from 'vitest'
import { createCompatibilityAuthority } from '../../../../../../packages/runtime/compatibility/index.js'
import {
  P6T1_FIXTURE,
  createP6T1World,
  destroyP6T1World,
} from '../../../../../../packages/runtime/test/p6t1-helpers.js'

const ROOT = String(P6T1_FIXTURE.rootSessionId)

it('concurrent cold-generation re-probe: outcome inventory', async () => {
  const tally = new Map<string, number>()
  for (let round = 0; round < 12; round += 1) {
    const world = await createP6T1World(`repro-cold-${round}`)
    try {
      // A monotonic clock: removes the same-millisecond byte-identity
      // coincidence that silently rescues the race on the default clock.
      let tick = 0
      const mk = () =>
        createCompatibilityAuthority({
          repositories: world.domain.repositories,
          rootSessionId: ROOT,
          blueprint: world.blueprint,
          environmentFacts: world.ports.environmentFacts,
          now: () => new Date(Date.UTC(2026, 7, 30, 8, 0, 0, tick += 1)).toISOString(),
        })
      const [a, b] = await Promise.all([mk().evaluate(), mk().evaluate()])
      for (const r of [a, b]) {
        const key = r.chainOk ? `chainOk:${r.status}` : `chainFail:${String(r.reprobeReason)}`
        tally.set(key, (tally.get(key) ?? 0) + 1)
      }
    } finally {
      await destroyP6T1World(world)
    }
  }
  console.log(`REPRO inventory=${JSON.stringify([...tally.entries()])}`)
  expect(true).toBe(true)
})
