/**
 * new-path.mjs — run the corpus through the G1-FS prototype on the NEXT host.
 *
 * Everything the prototype touches is a PUBLIC entry of the pinned next host
 * (0.2.2-rc.5 @ 9c2670d3…): `Context`, the agent-loop/tool testkits, the
 * `LocalFileSystem` class, `FsError`, the observation-policy plugin and the
 * native `@deepseek-ai/dsh-tool-fs` module. The invocation is dispatched through
 * `executeModelToolFixture`, which is the host's own `ToolsService.execute`
 * batch (executor selection + pipeline stages), not a re-implementation.
 *
 * ONE DELIBERATE DIFFERENCE FROM THE OLD WORLD: every vector gets a fresh
 * Context and its own `mkdtemp` under the worktree (never `/tmp`), so vectors
 * cannot leak observations or versions into each other.
 *
 * @module tests/ute-g1-fs/lib/new-path
 */
import { mkdtempSync, rmSync } from 'node:fs'
import { join } from 'node:path'

import { CORPUS } from './corpus.mjs'
import { installNativeFsBinding } from './binding.mjs'
import { loadHostSurface } from './host.mjs'
import { applySetup, makeRecord, makeWorldDirs, resolveLane, runSteps } from './scenario.mjs'

/** Scratch root: inside the repo (workspace-write sandbox), gitignored. */
export const SCRATCH_ROOT = join(process.cwd(), '.artifacts', 'tmp', 'ute-g1-fs')

/**
 * Run one vector on the prototype.
 * @param {object} vector
 * @param {object} host - loaded host surface.
 * @param {object} [options]
 * @param {readonly string[]} [options.widenWriteTokens] - negative-control only:
 *   extra world-relative tokens appended to the WRITE lane, so the SAME call
 *   that was refused becomes allowed. Never used by the corpus run.
 * @returns {Promise<{record: object, facts: object[], refused: boolean, root: string}>}
 */
export async function runVector(vector, host, { widenWriteTokens } = {}) {
  const { mkdirSync } = await import('node:fs')
  mkdirSync(SCRATCH_ROOT, { recursive: true })
  const root = mkdtempSync(join(SCRATCH_ROOT, `${vector.id.toLowerCase()}-`))
  const facts = []
  const ctx = new host.Context()
  try {
    makeWorldDirs(root)
    applySetup(root, vector.setup)
    const lane = widenWriteTokens === undefined
      ? resolveLane(root, vector.lane)
      : resolveLane(root, { read: vector.lane.read, write: [...vector.lane.write, ...widenWriteTokens] })

    await host.mountAgentLoopTestDependencies(ctx, { workingDirectory: true, tools: { mode: 'native' } })
    // The observation policy is the HOST's own plugin: it is what makes
    // "write an existing unobserved file" a typed refusal instead of an
    // unconditional write. It is mounted on the root, exactly as the old world
    // mounts it.
    await ctx.plugin(host.observationPolicy)
    const harness = await host.mountAgentLoopTestHarness(ctx)
    const binding = await installNativeFsBinding({
      ctx,
      lane,
      host,
      cwd: root,
      record: (fact) => facts.push(fact),
    })
    const agent = await harness.create(host.SessionId(`ute-g1-${vector.id}`), {}, { cwd: join(root, 'inside') })
    const signal = new AbortController().signal
    const toolSet = await ctx.tools.resolve({ agent, modelSelection: { provider: 'mock', model: 'mock' }, signal })

    const { outcome, text, codes } = await runSteps({
      root,
      steps: vector.steps,
      dispatch: async (name, args, options) => {
        const result = await host.executeModelToolFixture(ctx, {
          callId: `ute-g1-${vector.id}-${name}`,
          name,
          arguments: args,
          signal: options?.signal ?? signal,
          agent,
          toolSet,
        })
        const content = Array.isArray(result.content) ? result.content : []
        const resultText = content
          .map((part) => (part?.type === 'text' ? part.text : part?.type === 'image' ? '<image>' : ''))
          .join('')
        const errorMessage = result.error?.message ?? ''
        const typedCode = result.error?.info?.code
        return {
          isError: result.isError === true,
          text: `${resultText}\n${errorMessage}`,
          codes: typedCode === undefined ? [] : [typedCode],
        }
      },
    })
    // `resolveLane` is also the containment assertion the adapter used; keep the
    // call so a vector whose lane tokens no longer resolve fails here.
    void binding
    return { record: makeRecord({ vector, root, outcome, text, codes }), facts, refused: outcome === 'deny', root }
  } finally {
    await ctx.fiber.dispose()
    rmSync(root, { recursive: true, force: true })
  }
}

/**
 * Run the corpus on the prototype.
 * @param {{only?: readonly string[]}} [options]
 * @returns {Promise<{host: object, records: object[], facts: object[]}>}
 */
export async function runCorpus({ only } = {}) {
  const host = await loadHostSurface()
  // `newPathPending` is a DECLARED, printed non-coverage for the vectors whose
  // prototype support lands in UTE-3 PR B2 (today: `read_image`). It is never a
  // silent skip: lane-suite.test.mjs asserts the pending set is exactly the
  // read_image member and that every pending id still has a baseline row.
  const available = CORPUS.filter((vector) => vector.newPathPending !== true)
  const vectors = only === undefined ? available : available.filter((vector) => only.includes(vector.id))
  const records = []
  const facts = []
  for (const vector of vectors) {
    const run = await runVector(vector, host)
    records.push(run.record)
    facts.push(...run.facts.map((fact) => ({ ...fact, vector: vector.id })))
  }
  return { host, records, facts }
}
