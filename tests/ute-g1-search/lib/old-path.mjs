/**
 * old-path.mjs — capture the SEARCH family's (request → effect) pairs on the
 * CURRENT product composition, without booting and without touching it.
 *
 * WHAT "OLD PATH" MEANS HERE, precisely (measured in
 * `dev/agent-workflow/evidence/ute3-search-b1-20261120/composition-probe.txt`):
 *   host        `tests/deepseek-harness-test-use` — 0.2.0-rc.2 @ 639ed01539,
 *               the pinned legacy host (the real `@deepseek-ai/dsh-tool-fs-search`
 *               module, real Cordis registry/executor).
 *   governance  the PRODUCT route-C seam the live governed Member uses:
 *               `mountMemberA5sfRealm` + `attachA5sfNativeToolModules`
 *               (`packages/runtime/src/plugin/live/a5sf-realm-row.mjs`), i.e.
 *               the compiled `EffectiveIo` read lane + the confined
 *               `subprocess` face + the PD-16 search shadow
 *               (`confined-search-tool.mjs`) the attach places.
 *   dispatch    `ctx.tools.execute({...})` — the host registry's real model-call
 *               path (the same entry the PD-16 suite uses).
 *
 * It is a C1 (host-free, no boot) capture: the vector is an EFFECT record, so a
 * boot would add transport, not evidence. The diary says so instead of
 * implying a live run.
 *
 * @module tests/ute-g1-search/lib/old-path
 */
import { mkdtempSync, rmSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { DSH_BASELINE_VERSION, TEST_USE_BASELINE_SHA } from '../../paths.mjs'
import { CORPUS } from './corpus.mjs'
import { snapshotTree } from './effect-oracle.mjs'
import { applySetup, makeRecord, makeWorldDirs, runSteps, worldPath } from './scenario.mjs'
import { mountRouteCWorld } from './world.mjs'

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')

/** The old-path identity the fixture is bound to. */
export const OLD_PATH_IDENTITY = Object.freeze({
  hostVersion: DSH_BASELINE_VERSION,
  hostCommit: TEST_USE_BASELINE_SHA,
  seam: 'mountMemberA5sfRealm + attachA5sfNativeToolModules (route C, PD-16 search shadow)',
  dispatch: "ctx.tools.execute({'calls':[...]}) via the host registry execute()",
})

/** The scratch root every vector world is created under. */
const SCRATCH_ROOT = join(REPO_ROOT, '.artifacts', 'tmp', 'ute-g1-search')

/**
 * Capture one vector.
 * @param {object} vector
 * @param {object} [overrides] - negative-control only (see `mountRouteCWorld`).
 * @returns {Promise<object>} the normalized record.
 */
export async function captureVector(vector, overrides = {}) {
  mkdirSync(SCRATCH_ROOT, { recursive: true })
  const fixtureRoot = mkdtempSync(join(SCRATCH_ROOT, 'w-'))
  // `overrides.laneExtraRead` is the NEGATIVE CONTROL's widening: it changes the
  // declared AUTHORITY, never the implementation, so a refusal that disappears
  // under it was the lane's decision.
  const readRoots = [
    ...vector.lane.read.map((token) => worldPath(fixtureRoot, token)),
    ...(overrides.laneExtraRead ?? []).map((token) => worldPath(fixtureRoot, token)),
  ]
  const writeRoots = vector.lane.write.map((token) => worldPath(fixtureRoot, token))
  const cwdAbs = worldPath(fixtureRoot, vector.cwd)
  try {
    makeWorldDirs(fixtureRoot)
    applySetup(fixtureRoot, vector.setup)
    mkdirSync(cwdAbs, { recursive: true })
    const treeBefore = snapshotTree(fixtureRoot)
    const world = await mountRouteCWorld({
      label: vector.id.toLowerCase(),
      fixtureRoot,
      cwd: cwdAbs,
      readRoots,
      writeRoots,
      overrides: { dropSearchShadow: overrides.dropSearchShadow === true },
    })
    try {
      const { outcome, text, value } = await runSteps({
        root: fixtureRoot,
        steps: vector.steps,
        dispatch: (name, args, options) => world.dispatch(name, args, options),
      })
      const facts = await world.facts()
      return makeRecord({
        vector,
        fixtureRoot,
        cwdAbs,
        readRoots,
        outcome,
        text,
        value,
        facts,
        providerCalls: world.providerCalls().length,
        baseCalls: world.baseCalls(),
        treeBefore,
        // A widened/shadowless arm is EXPECTED to reach an out-of-lane path;
        // that is the defect the control plants, so the escape is recorded
        // instead of throwing. The golden capture never sets this.
        allowEscapedMatches: overrides.allowEscapedMatches === true,
      })
    } finally {
      await world.dispose()
    }
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true })
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
