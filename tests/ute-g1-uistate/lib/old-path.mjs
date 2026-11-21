/**
 * old-path.mjs — capture the OLD PATH.
 *
 * The old path for these two families is the GOVERNED FAMILY BODY (the
 * implementation the product mounts behind `uiFamilyEnabled` /
 * `agentStateEnabled`). There is no second product route to compare it with:
 * Stage 0 measured that route-C serves neither family itself (probe
 * `composition-probe.txt`, tokens `PROBE-UISTATE … two-implementations=yes`),
 * so this lane freezes the governed behaviour as the BASELINE, exactly as the
 * web lane froze the host's web pair before its repair.
 *
 * @module tests/ute-g1-uistate/lib/old-path
 */
import { DSH_BASELINE_VERSION, TEST_USE_BASELINE_SHA, TEST_USE_REL } from './paths.mjs'
import { COVERED_MEMBERS, CORPUS } from './corpus.mjs'
import { classifyRecord } from './effect-oracle.mjs'
import { disposeFixtures, runVector } from './world.mjs'

/** The identity the golden fixture is bound to (printed in the meta file). */
export const OLD_PATH_IDENTITY = Object.freeze({
  host: `${DSH_BASELINE_VERSION}@${TEST_USE_BASELINE_SHA}`,
  hostTree: TEST_USE_REL,
  composition: 'governed family body via uiFamilyEnabled/agentStateEnabled -> descriptor.build(cap)',
  vectors: CORPUS.length,
  members: COVERED_MEMBERS,
})

/**
 * Capture every corpus vector on the old path, in table order.
 * @returns {Promise<Array<object>>} graded rows.
 */
export async function captureCorpus() {
  const records = []
  try {
    for (const vector of CORPUS) {
      const raw = await runVector(vector)
      records.push(classifyRecord(vector, raw))
    }
  } finally {
    disposeFixtures()
  }
  return records
}
