/**
 * Shim that DRIVES this lane's plane-mount kit under a TS-aware resolver.
 * Why a shim: the kit's criteria are a kit artifact (evidence/alpha5/int-r3/), but the
 * production source graph it mounts (`team-tool-plane.mjs` -> a5p5-tools `src/index.js`
 * -> .ts) cannot be loaded by bare `node` in this repo, and `npx tsx` is not available
 * offline. vitest's resolver can, so the kit exports `runKit()` and this file runs it and
 * asserts the criteria — the kit still prints its own PASS/FAIL lines, so the receipt is
 * identical in shape to a standalone kit run (KIT_EXIT == this file's verdict).
 */
import { describe, it, expect } from 'vitest'

const KIT_URL = new URL(
  '../../../dev/agent-workflow/evidence/alpha5/int-r3/a5intr3-plane-mount-kit.mjs',
  import.meta.url,
).href

describe('a5int-r3 plane-mount kit (four tools x pos/neg + delta=[] + homes + :3080)', () => {
  it('KIT: every criterion PASSes on the flipped mount', async () => {
    const mod = (await import(KIT_URL)) as { runKit: () => Promise<{
      criteria: Array<{ id: string; ok: boolean }>
      failed: Array<{ id: string }>
      fatal: unknown
    }> }
    const { criteria, failed, fatal } = await mod.runKit()
    expect(fatal, `kit fatal: ${String(fatal)}`).toBeFalsy()
    expect(criteria.length, 'the kit must record all of A1..G criteria').toBeGreaterThanOrEqual(11)
    expect(failed.map((f) => f.id), 'failing criteria').toEqual([])
  }, 300_000)
})
