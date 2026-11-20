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
import { observeImageStep, sha256Of } from './effect-oracle.mjs'
import { loadHostSurface } from './host.mjs'
import { categoryOfNativeRefusal } from './refusal-categories.mjs'
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
    // The model route the corpus pins. `read_image` asks the host's own `llm`
    // service whether the CALLING route declares image input, so the prototype
    // must register a route adapter instead of inventing the capability check.
    // A vector that declares `llmModalities: ['text']` gets a text-only route
    // and must be refused by the HOST, before any read or attachment write.
    const modalities = vector.llmModalities === undefined ? ['text', 'image'] : [...vector.llmModalities]
    class MockRouteAdapter extends host.LlmAdapter {
      async resolveModel(provider, model) {
        return { provider, id: model, name: model, inputModalities: [...modalities] }
      }
    }
    ctx.llm.registerAdapter(['mock'], new MockRouteAdapter())
    // The host's REAL local attachment store, rooted in this vector's scratch
    // world. read_image is registered only while `attachments` is mounted
    // (tool-fs injects it), and the oracle observes the bytes THIS store
    // committed — never the tool's self-report.
    const saved = []
    class ObservedAttachmentStore extends host.LocalAttachmentStore {
      async saveImage(image) {
        const ref = await super.saveImage(image)
        // Read the bytes BACK from the store: the digest is over the committed
        // object, not the caller's buffer and not the ref's self-reported
        // metadata. (The store may normalize before publishing.)
        const stored = await this.readImage(ref)
        const committed = Buffer.from(stored.data)
        saved.push({ bytes: committed.length, sha256: sha256Of(committed) })
        return ref
      }
    }
    await ctx.plugin(ObservedAttachmentStore, { dshHome: root })
    const harness = await host.mountAgentLoopTestHarness(ctx)
    const binding = await installNativeFsBinding({
      ctx,
      lane,
      host,
      cwd: root,
      record: (fact) => facts.push(fact),
    })
    const agent = await harness.create(
      host.SessionId(`ute-g1-${vector.id}`),
      { provider: 'mock', model: 'mock' },
      { cwd: join(root, 'inside') },
    )
    const signal = new AbortController().signal
    const toolSet = await ctx.tools.resolve({ agent, modelSelection: { provider: 'mock', model: 'mock' }, signal })

    const { outcome, text, codes, resultEffects } = await runSteps({
      root,
      steps: vector.steps,
      dispatch: async (name, args, options) => {
        const savedBefore = saved.length
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
        // The SAME observation helper the old path uses: digest what the store
        // received, require exactly one committed attachment for an allow, and
        // require the model-facing image block to name that attachment.
        const resultEffects = name === 'read_image' ? observeImageStep(result, saved.slice(savedBefore)) : []
        return {
          isError: result.isError === true,
          text: `${resultText}\n${errorMessage}`,
          codes: typedCode === undefined ? [] : [typedCode],
          resultEffects,
        }
      },
    })
    // `resolveLane` is also the containment assertion the adapter used; keep the
    // call so a vector whose lane tokens no longer resolve fails here.
    void binding
    const record = makeRecord({ vector, root, outcome, text, codes, resultEffects })
    // PR #800's law: a new-path refusal MUST classify through the closed
    // vocabulary. An unmapped native code/class throws REFUSAL_VOCABULARY_
    // INCOMPLETE here (fail closed), never a default bucket.
    if (record.refusal !== null) {
      categoryOfNativeRefusal({ code: record.codes[0], refusal: record.refusal })
    }
    return { record, facts, refused: outcome === 'deny', root }
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
  // UTE-3 PR B2 removes the `newPathPending` channel entirely: every corpus
  // vector, including the six `read_image` rows, runs on the prototype. A
  // pending key left on a vector is a declared non-coverage and lane-suite
  // fails on its presence rather than quietly skipping it.
  const vectors = only === undefined ? CORPUS : CORPUS.filter((vector) => only.includes(vector.id))
  const records = []
  const facts = []
  for (const vector of vectors) {
    const run = await runVector(vector, host)
    records.push(run.record)
    facts.push(...run.facts.map((fact) => ({ ...fact, vector: vector.id })))
  }
  return { host, records, facts }
}
