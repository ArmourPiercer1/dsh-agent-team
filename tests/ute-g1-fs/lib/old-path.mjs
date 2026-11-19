/**
 * old-path.mjs — capture the FS family's (request → effect) pairs on the
 * CURRENT legacy governed path, without booting and without touching it.
 *
 * WHAT "OLD PATH" MEANS HERE, precisely:
 *   host        `tests/deepseek-harness-test-use` — 0.2.0-rc.2 @ 639ed01539,
 *               the pinned legacy host (real `LocalFileSystem`, real
 *               `@deepseek-ai/dsh-tool-fs` lib entry, real executor/registry).
 *   governance  the PRODUCT route-C seam the live governed Member setup uses:
 *               `mountMemberA5sfRealm` + `attachA5sfNativeToolModules`
 *               (`packages/runtime/src/plugin/live/a5sf-realm-row.mjs`), i.e.
 *               the P1 compiler's `EffectiveIo` ceiling + the confined provider
 *               subclass (`team-services/src/fs.ts`) + the native tool module
 *               re-mounted on the isolated `fs` scope.
 *   dispatch    `ctx.tools.execute({...})` — the host registry's real model-call
 *               path (the same entry the existing a5sf FS layer-B suite uses).
 *
 * It is a C1 (host-free, no boot) capture. That is a deliberate trade: it makes
 * the baseline reproducible and cheap enough to keep, and the vector is an
 * EFFECT record, so a boot would add transport, not evidence. The diary says so
 * instead of implying a live run.
 *
 * @module tests/ute-g1-fs/lib/old-path
 */
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import { DSH_BASELINE_VERSION, TEST_USE_BASELINE_SHA } from '../../paths.mjs'
import { CORPUS } from './corpus.mjs'
import { applySetup, makeRecord, resolveLane, runSteps, worldPath } from './scenario.mjs'

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

/** The old-path identity the fixture is bound to. */
export const OLD_PATH_IDENTITY = Object.freeze({
  hostVersion: DSH_BASELINE_VERSION,
  hostCommit: TEST_USE_BASELINE_SHA,
  seam: 'mountMemberA5sfRealm + attachA5sfNativeToolModules (route C)',
  dispatch: "ctx.tools.execute({'calls':[...]})",
})

let worldModule

/** Load the product route-C world builder once. */
async function oldWorldBuilder() {
  if (worldModule === undefined) worldModule = await import('../../world-factory/lib/a5sf-fs-contract-world.mjs')
  return worldModule
}

/**
 * Capture one vector on the legacy governed path.
 * @param {object} vector - corpus vector.
 * @returns {Promise<object>} normalized record.
 */
export async function captureVector(vector) {
  const { makeFsContractWorld } = await oldWorldBuilder()
  const world = await makeFsContractWorld({
    repoRoot: REPO_ROOT,
    label: `ute-g1-${vector.id.toLowerCase()}`,
    composition: 'route-c',
    laneRoots: { read: vector.lane.read, write: vector.lane.write },
  })
  try {
    const root = world.fixtures.dir
    applySetup(root, vector.setup)
    // The lane the product compiler actually admitted, resolved for the record.
    resolveLane(root, vector.lane)
    const { outcome, text, codes } = await runSteps({
      root,
      steps: vector.steps,
      dispatch: async (name, args) => {
        const settled = await world.dispatch(name, args)
        return { isError: settled.isError === true, text: `${settled.text ?? ''}\n${settled.errorMessage ?? ''}` }
      },
    })
    return makeRecord({ vector, root, outcome, text, codes })
  } finally {
    await world.dispose()
  }
}

/**
 * Capture the whole corpus (optionally a subset).
 * @param {{only?: readonly string[]}} [options]
 * @returns {Promise<object[]>}
 */
export async function captureCorpus({ only } = {}) {
  const vectors = only === undefined ? CORPUS : CORPUS.filter((vector) => only.includes(vector.id))
  const records = []
  for (const vector of vectors) records.push(await captureVector(vector))
  return records
}

/** A world-relative token helper re-exported for the runner's evidence lines. */
export { worldPath }
