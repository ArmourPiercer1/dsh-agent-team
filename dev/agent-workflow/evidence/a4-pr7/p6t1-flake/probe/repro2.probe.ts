/**
 * Scratch repro #2 (evidence only, NOT a nine-root spec): the defect at the
 * PROVIDER seam, where the admission family actually drives it.
 *
 * Same construction as `restartP6T1World` (a provider wired over the world's
 * ports) with ONE addition: a monotonic `now`, so every inline freshness
 * re-probe is stamped in a distinct millisecond. That removes the
 * same-millisecond byte-identity coincidence which is the only thing that can
 * make the lost write invisible on the default clock.
 */
import { expect, it } from 'vitest'
import { createActivationProvider } from '../../../../../../packages/runtime/activation/index.js'
import type { ActivationResult } from '../../../../../../packages/runtime/activation/index.js'
import {
  P6T1_FIXTURE,
  createP6T1World,
  destroyP6T1World,
  makeRequest,
} from '../../../../../../packages/runtime/test/p6t1-helpers.js'

const ROOT = String(P6T1_FIXTURE.rootSessionId)

it('provider seam: parallel activations of one cold team, distinct probe stamps', async () => {
  const tally = new Map<string, number>()
  for (let batch = 0; batch < 6; batch += 1) {
    const world = await createP6T1World(`repro2-batch-${batch}`)
    try {
      let tick = 0
      const provider = createActivationProvider({
        teamDomain: world.domain,
        blueprintCatalog: world.catalog,
        environmentFacts: world.ports.environmentFacts,
        externalPolicyFacts: world.ports.externalPolicyFacts,
        staticModel: world.ports.staticModel,
        childSessionFactory: world.childFactory,
        sessionDurability: world.durability,
        surface: world.surface,
        now: () => new Date(Date.UTC(2026, 7, 30, 8, 0, 0, (tick += 1))).toISOString(),
      })
      const settled = await Promise.all(
        [1, 2].map((n) =>
          provider.activate(makeRequest({ requestToken: `repro2-${batch}-${String(n)}` })),
        ),
      )
      for (const r of settled) {
        tally.set(`ok:${(r as ActivationResult).kind}`, (tally.get(`ok:${(r as ActivationResult).kind}`) ?? 0) + 1)
      }
    } catch (error) {
      const record = (error ?? {}) as { name?: unknown; code?: unknown }
      const key = `throw:${String(record.name ?? 'n/a')}/${String(record.code ?? 'n/a')}`
      tally.set(key, (tally.get(key) ?? 0) + 1)
    } finally {
      await destroyP6T1World(world)
    }
  }
  console.log(`REPRO2 inventory=${JSON.stringify([...tally.entries()])}`)
  expect(true).toBe(true)
})
