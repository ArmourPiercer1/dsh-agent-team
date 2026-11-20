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
import { Buffer } from 'node:buffer'

import { DSH_BASELINE_VERSION, TEST_USE_BASELINE_SHA } from '../../paths.mjs'
import { CORPUS } from './corpus.mjs'
import { imageResultEffect, noImageResultEffect, sha256Of } from './effect-oracle.mjs'
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
 * Observe one `read_image` step at the ATTACHMENT STORE seam: what bytes the
 * store actually received (byte length + sha256), and what model-facing result
 * the registry produced (block shape, image block ↔ store ref). Trusting the
 * tool's reported metadata would make the digest a self-report, so the bytes
 * are digested where they are committed.
 *
 * @param {object} settled - `world.dispatch` result.
 * @param {ReadonlyArray<{bytes: number, sha256: string}>} fresh - store calls made by THIS step.
 * @returns {object[]} zero or one synthetic result effect.
 */
function observeImageStep(settled, fresh) {
  if (settled.isError === true) {
    if (fresh.length !== 0) {
      throw new Error(`a refused read_image committed ${fresh.length} attachment(s); the oracle refuses to record that as a zero-effect refusal`)
    }
    return [noImageResultEffect()]
  }
  const image = settled.value?.image
  if (image === undefined || typeof image !== 'object') {
    throw new Error('an allowed read_image returned no image value; refusing to fabricate an attachment observation')
  }
  if (fresh.length !== 1) {
    throw new Error(`an allowed read_image must commit EXACTLY ONE attachment, observed ${fresh.length}`)
  }
  const committed = fresh[0]
  if (committed.bytes !== image.bytes) {
    throw new Error(`the store recorded ${committed.bytes} bytes but the tool value reports ${String(image.bytes)}`)
  }
  const content = Array.isArray(settled.content) ? settled.content : []
  const blockTypes = content.map((part) => part?.type)
  const imageBlocks = content.filter((part) => part?.type === 'image')
  if (imageBlocks.length !== 1 || imageBlocks[0]?.attachment?.attachmentId !== image.attachmentId) {
    throw new Error(`the model-facing result is not the committed attachment (blocks=${blockTypes.join('+') || 'none'}, attachmentId=${String(imageBlocks[0]?.attachment?.attachmentId)})`)
  }
  return [imageResultEffect({
    mediaType: String(image.mediaType),
    width: Number(image.width),
    height: Number(image.height),
    bytes: committed.bytes,
    sha256: committed.sha256,
    blocks: blockTypes.join('+'),
  })]
}

/**
 * Capture one vector on the legacy governed path.
 * @param {object} vector - corpus vector.
 * @param {object} [override] - negative-control only: replace `lane`, `steps`,
 *   `composition`, `llmModalities`, add post-mount `mutations`, or override
 *   `setup`. The corpus run passes no override.
 * @returns {Promise<object>} normalized record.
 */
export async function captureVector(vector, override = {}) {
  const { makeFsContractWorld } = await oldWorldBuilder()
  const effective = { ...vector, ...override, lane: override.lane ?? vector.lane }
  if (effective.lane.read === undefined || effective.lane.write === undefined) {
    throw new Error(`corpus vector ${effective.id} needs both lane axes`)
  }
  const world = await makeFsContractWorld({
    repoRoot: REPO_ROOT,
    label: `ute-g1-${effective.id.toLowerCase()}`,
    // The product route-C composition is the default. Image vectors that the
    // product route cannot reach declare `composition: 'post-gap-1'` in the
    // corpus (disclosed there and in golden/COVERAGE.md).
    composition: effective.composition ?? 'route-c',
    laneRoots: { read: effective.lane.read, write: effective.lane.write },
    ...(effective.llmModalities === undefined ? {} : { llmModalities: effective.llmModalities }),
    ...(override.mutations === undefined ? {} : { mutations: override.mutations }),
  })
  try {
    const root = world.fixtures.dir
    applySetup(root, effective.setup)
    // The lane the product compiler actually admitted, resolved for the record.
    resolveLane(root, effective.lane)
    // The recording attachment store is the module's own seam; wrapping it here
    // observes the committed bytes without changing what the tool does.
    const store = world.root.get('attachments')
    if (store === undefined || typeof store.saveImage !== 'function') {
      throw new Error('the world exposed no attachment store; read_image cannot be observed honestly')
    }
    const saved = []
    const originalSaveImage = store.saveImage.bind(store)
    store.saveImage = async (image) => {
      const data = Buffer.from(image.data)
      saved.push({ bytes: data.length, sha256: sha256Of(data) })
      return originalSaveImage(image)
    }
    const { outcome, text, codes, resultEffects } = await runSteps({
      root,
      steps: effective.steps,
      dispatch: async (name, args, options) => {
        const savedBefore = saved.length
        const settled = await world.dispatch(name, args, options?.signal === undefined ? {} : { signal: options.signal })
        const effects = name === 'read_image' ? observeImageStep(settled, saved.slice(savedBefore)) : []
        return {
          isError: settled.isError === true,
          text: `${settled.text ?? ''}\n${settled.errorMessage ?? ''}`,
          resultEffects: effects,
        }
      },
    })
    return makeRecord({ vector: effective, root, outcome, text, codes, resultEffects })
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
