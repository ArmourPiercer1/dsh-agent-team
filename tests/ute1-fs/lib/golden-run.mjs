/**
 * golden-run.mjs — run the G1-S1 corpus through the PRODUCT module on rc.5.
 *
 * The G1-S1 prototype was graded against 10 old-path golden vectors captured on
 * the legacy governed route (`tests/ute-g1-fs/golden/old-path.tsv`). Porting the
 * prototype into a product module is only honest if the SAME vectors still pass,
 * so this runner keeps the corpus, the effect oracle and the comparison rule
 * exactly as they were and replaces ONLY the binding under test: the lane is now
 * enforced by `packages/tools/src/native-fs-binding.ts`, mounted through
 * `mountNativeFsBinding` on the pinned rc.5 host, dispatched through the host's
 * own `ToolsService.execute` batch.
 *
 * Nothing here is a new oracle: `makeRecord`/`compareAll` are the reviewed test
 * assets of the prototype deliverable, imported unchanged.
 *
 * @module tests/ute1-fs/lib/golden-run
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { loadNextHostSurface } from './host.mjs'
import { mountNativeFsBinding } from '../../../packages/tools/src/native-fs-binding.ts'
import { CORPUS } from '../../ute-g1-fs/lib/corpus.mjs'
import { compareAll, parseGolden } from '../../ute-g1-fs/lib/compare.mjs'
import {
  applySetup, makeRecord, makeWorldDirs, resolveLane, runSteps,
} from '../../ute-g1-fs/lib/scenario.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))

/** The reviewed golden fixture (captured on the legacy route-C path). */
export const GOLDEN_PATH = resolve(HERE, '..', '..', 'ute-g1-fs', 'golden', 'old-path.tsv')

/** Scratch root inside the worktree (gitignored). */
const SCRATCH = join(process.cwd(), '.artifacts', 'tmp', 'ute1-fs-golden')

/**
 * Run one vector through the product binding.
 * @param {object} vector - corpus vector.
 * @param {object} host - loaded rc.5 surface.
 * @returns {Promise<object>} the normalized record.
 */
async function runVector(vector, host) {
  mkdirSync(SCRATCH, { recursive: true })
  const root = mkdtempSync(join(SCRATCH, `${vector.id.toLowerCase()}-`))
  const ctx = new host.Context()
  let binding
  try {
    makeWorldDirs(root)
    applySetup(root, vector.setup)
    const lane = resolveLane(root, vector.lane)
    await host.mountAgentLoopTestDependencies(ctx, { workingDirectory: true, tools: { mode: 'native' } })
    await ctx.plugin(host.observationPolicy)
    const harness = await host.mountAgentLoopTestHarness(ctx)
    binding = await mountNativeFsBinding({
      ctx,
      host,
      lane,
      expectedGeneration: host.generation,
      id: `golden-${vector.id}`,
      cwd: root,
      toolConfig: { applyPatch: false },
    })
    const agent = await harness.create(host.SessionId(`ute1-${vector.id}`), {}, { cwd: join(root, 'inside') })
    const signal = new AbortController().signal
    const toolSet = await ctx.tools.resolve({
      agent,
      modelSelection: { provider: 'mock', model: 'mock' },
      signal,
    })
    const { outcome, text, codes } = await runSteps({
      root,
      steps: vector.steps,
      dispatch: async (name, args) => {
        const result = await host.executeModelToolFixture(ctx, {
          callId: `ute1-${vector.id}-${name}`,
          name,
          arguments: args,
          signal,
          agent,
          toolSet,
        })
        const content = Array.isArray(result.content) ? result.content : []
        const resultText = content
          .map((part) => (part?.type === 'text' ? part.text : part?.type === 'image' ? '<image>' : ''))
          .join('')
        const typedCode = result.error?.info?.code
        return {
          isError: result.isError === true,
          text: `${resultText}\n${result.error?.message ?? ''}`,
          codes: typedCode === undefined ? [] : [typedCode],
        }
      },
    })
    return makeRecord({ vector, root, outcome, text, codes })
  } finally {
    if (binding !== undefined) await binding.dispose('golden-vector-done')
    await ctx.fiber.dispose()
    rmSync(root, { recursive: true, force: true })
  }
}

/**
 * Run the whole corpus through the product module and grade it.
 * @param {{repoRoot: string, only?: readonly string[]}} input
 * @returns {Promise<{records: object[], comparison: object, host: object}>}
 */
export async function runProductGolden({ repoRoot, only }) {
  const host = await loadNextHostSurface(repoRoot)
  const golden = parseGolden(readFileSync(GOLDEN_PATH, 'utf8'))
  // UTE-3 B1 added 6 `read_image` baselines to the SHARED corpus and golden.
  // This PRODUCT binding implements the read/write/edit members only; PR B2
  // reproduces the image rows on the PROTOTYPE provider lane, not by changing
  // the product module. The module therefore runs and is graded against the 10
  // vectors it claims, and the 6 image rows are returned as an EXPLICIT
  // excluded set (asserted by the suite) rather than silently dropped.
  // B2 removed `newPathPending`, so exclusion is now a property of THIS binding
  // claim, not a pending vector state.
  const imageExcluded = CORPUS.filter((vector) => vector.entry === 'read_image')
  const vectors = only === undefined
    ? CORPUS.filter((vector) => vector.entry !== 'read_image')
    : CORPUS.filter((vector) => only.includes(vector.id))
  const records = []
  for (const vector of vectors) records.push(await runVector(vector, host))
  const ranIds = new Set(vectors.map((vector) => vector.id))
  const applicableGolden = golden.filter((row) => ranIds.has(row.id))
  return { records, comparison: compareAll(applicableGolden, records), host, golden, imageExcluded }
}
