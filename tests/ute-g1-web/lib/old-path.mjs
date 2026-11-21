/**
 * old-path.mjs — capture the WEB family's (request → effect) pairs on the
 * CURRENT product composition, without booting and without touching it.
 *
 * WHAT "OLD PATH" MEANS HERE, precisely (measured in
 * `dev/agent-workflow/evidence/ute3-web-b1-20261120/composition-probe.txt`):
 *   host        `tests/deepseek-harness-test-use` — 0.2.0-rc.2 @ 639ed01539, the
 *               pinned legacy host (the real `@deepseek-ai/dsh-tool-web`
 *               definitions, real Cordis registry/executor).
 *   governance  the PRODUCT route-C seam the live governed Member uses:
 *               `mountMemberA5sfRealm` + `attachA5sfNativeToolModules`
 *               (`packages/runtime/src/plugin/live/a5sf-realm-row.mjs`), i.e.
 *               the confined `web` face (BL-18/PD-30 admission + one guard fact
 *               per call) and PD-27's `confined-web-tool.mjs` shadow.
 *   transport   the composition-owned provider (`lib/fixture-provider.mjs`): the
 *               PINNED `HttpFetchProvider` pointed at the loopback fixture
 *               through its own resolver argument, plus a bounded JSON POST for
 *               search. The face ships no transport by design.
 *   wire        a real `node:http` fixture server on 127.0.0.1:3182 and the
 *               process-wide socket witness (`lib/net-witness.mjs`).
 *   dispatch    `ctx.tools.execute({...})` — the host registry's real model-call
 *               path.
 *
 * It is a C1 (host-free, no boot) capture: a vector is an EFFECT record, so a
 * boot would add transport, not evidence. The diary says so instead of implying
 * a live run.
 *
 * @module tests/ute-g1-web/lib/old-path
 */
import { mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { DSH_BASELINE_VERSION, TEST_USE_BASELINE_SHA } from '../../paths.mjs'
import { CORPUS } from './corpus.mjs'
import { makeRecord, runSteps } from './scenario.mjs'
import { mountRouteCWorld } from './world.mjs'

export const REPO_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..')
/** The pinned commit the fixture is bound to (read from the one source of truth). */
export const TEST_USE_BASELINE_SHA_FULL = TEST_USE_BASELINE_SHA

/** The old-path identity the fixture is bound to. */
export const OLD_PATH_IDENTITY = Object.freeze({
  hostVersion: DSH_BASELINE_VERSION,
  hostCommit: TEST_USE_BASELINE_SHA_FULL,
  seam: 'mountMemberA5sfRealm + attachA5sfNativeToolModules (route C, BL-18 confined web face + PD-27 web shadow)',
  transport: 'composition provider: pinned @deepseek-ai/dsh-web-fetch-http HttpFetchProvider (injected loopback resolver) + bounded JSON search POST',
  dispatch: "ctx.tools.execute({'calls':[...]}) via the host registry execute()",
  port: 3182,
})

/** The scratch root the capture's guard sinks live under. */
const SCRATCH_ROOT = join(REPO_ROOT, '.artifacts', 'tmp', 'ute-g1-web')

/**
 * Capture one vector.
 *
 * @param {object} vector - the corpus vector.
 * @param {object} [overrides] - negative-control only (see `mountRouteCWorld`).
 * @returns {Promise<object>} the normalized record.
 */
export async function captureVector(vector, overrides = {}) {
  mkdirSync(SCRATCH_ROOT, { recursive: true })
  const world = await mountRouteCWorld({
    label: vector.id,
    overrides: {
      ...(vector.limits === undefined ? {} : { fetchLimits: vector.limits }),
      ...(vector.searchMode === undefined ? {} : { searchMode: vector.searchMode }),
      ...(vector.fixtureDelayMs === undefined ? {} : { fixtureDelayMs: vector.fixtureDelayMs }),
      ...overrides,
    },
  })
  try {
    // The guard sink is per label; a previous run's facts would be stale
    // evidence, so the record only ever reads what THIS world wrote.
    const before = (await world.facts()).length
    const { outcome, text, value } = await runSteps({
      origin: world.fixtureOrigin,
      steps: vector.steps,
      dispatch: (name, args, options) => world.dispatch(name, args, options),
    })
    const facts = (await world.facts()).slice(before)
    return makeRecord({
      vector,
      origin: world.fixtureOrigin,
      outcome,
      text,
      value,
      facts,
      requests: world.fixtureLog(),
      stats: world.providerStats(),
      network: world.network(),
      hostWebCalls: world.hostWebCalls(),
    })
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
