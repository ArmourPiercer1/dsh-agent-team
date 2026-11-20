/**
 * new-path.mjs — run the SEARCH corpus on the PINNED NEXT HOST (rc.5) through
 * the PRODUCT route-C seam, with the host's own executor running the tool body.
 *
 * WHAT IS NEW HERE, AND WHY IT IS THE *NEW* PATH (not a second old path):
 *
 *   generation   the host is `tests/deepseek-harness-next` — `0.2.2-rc.5`
 *                (`tests/paths.mjs#NEXT_HOST`), NOT the legacy `0.2.0-rc.2`
 *                tree the product is installed against. Every host module is
 *                resolved from inside that tree (`lib/host-next.mjs`) and the
 *                resolution is contained, so the legacy copy cannot be
 *                substituted silently.
 *   definitions  the model-visible `grep`/`glob` definitions are the NEXT
 *                host's own `@deepseek-ai/dsh-tool-fs-search` module, mounted on
 *                the Member's isolated scope by the PRODUCT seam
 *                (`attachA5sfNativeToolModules` with a declared native module).
 *                Team contributes NO definition and no tool body: it only
 *                supplies the confined `subprocess` face the module resolves.
 *   execution    `executeModelToolFixture` — the host's own `ToolsService`
 *                batch (executor selection + pipeline stages). The tool body
 *                that runs is the host package's, not a re-implementation.
 *   governance   the SAME product route-C seam the old path measured:
 *                `mountMemberA5sfRealm` + `attachA5sfNativeToolModules`
 *                (`packages/runtime/src/plugin/live/a5sf-realm-row.mjs`), the
 *                compiled `EffectiveIo` read lane, the real
 *                `createConfinedProcessProvider` (Landlock launcher + packaged
 *                ripgrep) and the realm's `a5sf-guard-consult/1` facts. No
 *                test-only composition is introduced.
 *
 * EVERY vector gets a fresh rc.5 `Context`, a fresh harness agent and its own
 * `mkdtemp` under the worktree (never `/tmp`), so no vector can leak a
 * definition, an observation or a guard fact into another.
 *
 * ONE HONEST LIMIT (stated here because it is load-bearing): the agent cwd is
 * the vector's `cwd` token, exactly as on the old path, and every `path`
 * argument is materialized to an ABSOLUTE path before dispatch (same
 * `scenario.mjs` helper). The old and new paths therefore receive the SAME
 * request, which is what makes the comparison meaningful.
 *
 * @module tests/ute-g1-search/lib/new-path
 */
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { register } from 'node:module'
import { pathToFileURL } from 'node:url'

import { CORPUS } from './corpus.mjs'
import { loadNextSearchHost, nextSearchHostIdentity } from './host-next.mjs'
import { snapshotTree } from './effect-oracle.mjs'
import { applySetup, makeRecord, makeWorldDirs, runSteps, worldPath } from './scenario.mjs'

/** Repo root of the worktree this module lives in (`tests/ute-g1-search/lib`). */
export const REPO_ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..', '..', '..')

/** Scratch root: inside the worktree (workspace-write sandbox), gitignored. */
export const SCRATCH_ROOT = join(REPO_ROOT, '.artifacts', 'tmp', 'ute-g1-search', 'new-path')

const LAUNCHER = join(REPO_ROOT, 'packages/runtime/sandbox-provider/launcher/landlock-prelauncher.py')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')

/** The Member identity every new-path vector runs under (one world per vector). */
export const SEARCH_NEW_IDENTITY = Object.freeze({
  teamId: 'team-ute3-search-b2',
  memberInstanceId: 'member-ute3-search-b2',
  templateId: 'worker',
  instanceGeneration: 1,
})
export const SEARCH_NEW_REVISION = 'rev-ute3-search-b2'

/** One lane axis in the A1 policy/compiled shape. */
function lane(allow) {
  return Object.freeze({ mode: 'restricted', allow: Object.freeze([...allow]), ask: Object.freeze([]), deny: Object.freeze([]) })
}

/**
 * Load the product seams (Team modules) from THIS repository: the product row,
 * the one policy compiler, the confined OS provider and the guard-fact reader.
 * They are the SAME modules the old path measured — only the host generation
 * differs, which is the point of the comparison. The legacy host packages are
 * deliberately NOT imported here: a new-path process that also loaded them
 * could substitute one without noticing.
 */
async function loadProductSeams() {
  register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)
  const row = await import(pathToFileURL(join(REPO_ROOT, 'packages/runtime/src/plugin/live/a5sf-realm-row.mjs')).href)
  const { compileEffectiveIo } = await import(pathToFileURL(join(REPO_ROOT, 'packages/runtime/member-io-policy/src/index.ts')).href)
  const { createConfinedProcessProvider } = await import(pathToFileURL(join(REPO_ROOT, 'packages/runtime/sandbox-provider/index.ts')).href)
  const { readGuardConsultFile } = await import(pathToFileURL(join(REPO_ROOT, 'packages/runtime/team-services/src/guard-observability.ts')).href)
  return Object.freeze({ row, compileEffectiveIo, createConfinedProcessProvider, readGuardConsultFile })
}

/** Load the pinned next host + the product seams ONCE per process. */
let surfacePromise
export function loadNewPathSurface() {
  surfacePromise ??= (async () => {
    const host = await loadNextSearchHost(REPO_ROOT)
    const seams = await loadProductSeams()
    return Object.freeze({ host, seams })
  })()
  return surfacePromise
}

/**
 * Mount the product route-C composition ON the pinned next host for one fixture.
 *
 * @param {object} input
 * @param {string} input.label - a stable, filesystem-safe world label.
 * @param {string} input.fixtureRoot - absolute world root (already populated).
 * @param {string} input.cwd - absolute agent session cwd (inside the read lane).
 * @param {readonly string[]} input.readRoots - absolute read-lane roots.
 * @param {readonly string[]} input.writeRoots - absolute write-lane roots.
 * @param {object} input.host - the loaded next-host surface.
 * @param {object} input.seams - the product seam modules.
 * @returns {Promise<object>} the world handle.
 */
export async function mountNextHostRouteCWorld({ label, fixtureRoot, cwd, readRoots, writeRoots = readRoots, host, seams }) {
  const { row, compileEffectiveIo, createConfinedProcessProvider, readGuardConsultFile } = seams
  const sinkPath = join(fixtureRoot, `.guard-${label}.jsonl`)

  const ctx = new host.Context()
  // The BASE `subprocess` service: the NEXT host's own `LocalSubprocessRuntime`,
  // counted so "the inherited (unconfined) service never answered" stays an
  // observed fact. It exists only so the realm has a face to shadow.
  const base = { calls: 0 }
  class CountingLocalSubprocess extends host.LocalSubprocessRuntime {
    spawn(spec) {
      base.calls += 1
      return super.spawn(spec)
    }
  }
  try {
    await host.mountAgentLoopTestDependencies(ctx, { workingDirectory: true, tools: { mode: 'native' } })
    await ctx.plugin(CountingLocalSubprocess, {})
    // The PRESET topology: the next host's shipped search row on the standing
    // (root) scope — the definition the agent would resolve un-shadowed. The
    // attach below re-mounts the SAME package on the Member's isolated scope.
    await ctx.plugin(host.searchModule, { sampleOverCapGlobResults: false })
    const harness = await host.mountAgentLoopTestHarness(ctx)
    const agent = await harness.create(host.SessionId(`ute-g1-search-b2-${label}`), { provider: 'mock', model: 'mock' }, { cwd })

    const identity = SEARCH_NEW_IDENTITY
    const ceiling = Object.freeze({
      memberIdentity: identity.memberInstanceId,
      templateId: identity.templateId,
      instanceGeneration: identity.instanceGeneration,
      revision: SEARCH_NEW_REVISION,
      read: lane(readRoots),
      write: lane(writeRoots),
      network: Object.freeze({ access: 'allow' }),
    })
    // The ONE compiler: ceiling ∩ restriction (never re-derived here).
    const compiled = compileEffectiveIo(ceiling, {
      bindingIdentity: 'dsh.search/grep',
      read: lane(readRoots),
      write: lane(writeRoots),
      network: 'allow',
    }, {
      memberIdentity: identity.memberInstanceId,
      callId: `call-${label}`,
      policyRevision: SEARCH_NEW_REVISION,
      toolBindingIdentity: 'dsh.search/grep',
      approvedOnce: false,
    })
    if (compiled.ok !== true) throw new Error(`compileEffectiveIo refused: ${JSON.stringify(compiled)}`)

    const osProvider = createConfinedProcessProvider({
      realmId: `realm-${label}`,
      trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
      scratchRoot: join(fixtureRoot, '.scratch'),
      assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
    })
    // The observed-provider-facts seam: every SpawnRequest the CONFINED face
    // makes is counted and forwarded untouched.
    const confinedCalls = []
    const confined = {
      async spawnStreaming(request, streaming) {
        confinedCalls.push({ argv: [...(request?.argv ?? [])], cwd: String(request?.cwd ?? '') })
        return osProvider.spawnStreaming(request, streaming)
      },
    }

    const realm = await row.mountMemberA5sfRealm({
      root: agent.ctx,
      a5sfConfig: row.a5sfRealmConfigOf({ a5sfEvidencePath: sinkPath }),
      provider: () => ({
        compiledFor: () => ({
          members: [{ identity, policy: { ok: true, value: ceiling }, config: { cwd: fixtureRoot } }],
          subprocess: {
            effective: compiled.value,
            provider: confined,
            realmId: `realm-${label}`,
            bindingId: 'dsh.search/grep',
            memberScope: identity.memberInstanceId,
          },
        }),
      }),
      member: {
        sessionId: `session-${label}`,
        instanceId: identity.memberInstanceId,
        teamRootSessionId: 'team-root-ute3-search-b2',
        templateId: identity.templateId,
      },
    })
    if (realm === undefined) throw new Error('the configured row must mount a realm')

    // The NATIVE module is the NEXT host's own search package, declared by the
    // composition (not resolved by the seam). `expectedTools` is what keeps the
    // Team-owned PD-16 shadow silent: this composition declares the host's
    // package as the search owner, so exactly one definition serves the name.
    await row.attachA5sfNativeToolModules(
      realm,
      agent.ctx,
      row.a5sfRealmConfigOf({
        a5sfEvidencePath: sinkPath,
        a5sfNativeToolModules: [{
          url: pathToFileURL(host.searchModuleEntry).href,
          config: { sampleOverCapGlobResults: false },
          expectedTools: ['grep', 'glob'],
        }],
      }),
      agent,
    )

    const signal = new AbortController().signal
    const toolSet = await ctx.tools.resolve({ agent, modelSelection: { provider: 'mock', model: 'mock' }, signal })

    let disposed = false
    return Object.freeze({
      label,
      ctx,
      agent,
      realm,
      fixtureRoot,
      cwd,
      sinkPath,
      base,
      providerCalls: () => [...confinedCalls],
      facts: async () => (existsSync(sinkPath) ? readGuardConsultFile(sinkPath) : []),
      /** Dispatch one model-facing call through the NEXT host's own executor. */
      async dispatch(name, args, options = {}) {
        const result = await host.executeModelToolFixture(ctx, {
          callId: `ute3-search-b2-${label}-${name}-${Math.random().toString(36).slice(2, 8)}`,
          name,
          arguments: args,
          signal: options.signal ?? signal,
          agent,
          toolSet,
        })
        const content = Array.isArray(result.content) ? result.content : []
        const text = content
          .map((part) => (part?.type === 'text' ? part.text : ''))
          .join('')
        return {
          isError: result.isError === true,
          text: `${text}\n${result.error?.message ?? ''}`,
          value: result.value,
          code: result.error?.info?.code,
        }
      },
      async dispose() {
        if (disposed) return
        disposed = true
        // The realm owns the native + confined-provider fibers; the root owns
        // the host services. Realm first, then the context.
        await realm.dispose()
        await ctx.fiber.dispose()
      },
    })
  } catch (error) {
    await ctx.fiber.dispose().catch(() => undefined)
    throw error
  }
}

/**
 * Run one vector on the new path.
 * @param {object} vector
 * @param {object} surface - `{host, seams}` from `loadNewPathSurface()`.
 * @param {object} [options]
 * @param {readonly string[]} [options.laneExtraRead] - negative-control only:
 *   extra WORLD-RELATIVE read tokens appended to the READ lane, so the SAME
 *   out-of-lane call becomes admitted. Never used by the corpus run.
 * @returns {Promise<{record: object, witness: object}>} the normalized record and
 *   the executor-provenance witness (never serialized into the fixture).
 */
export async function runVector(vector, surface, { laneExtraRead, allowEscapedMatches = false } = {}) {
  mkdirSync(SCRATCH_ROOT, { recursive: true })
  const fixtureRoot = mkdtempSync(join(SCRATCH_ROOT, `${vector.id.toLowerCase()}-`))
  const readRoots = [...vector.lane.read, ...(laneExtraRead ?? [])].map((token) => worldPath(fixtureRoot, token))
  const writeRoots = vector.lane.write.map((token) => worldPath(fixtureRoot, token))
  const cwdAbs = worldPath(fixtureRoot, vector.cwd)
  try {
    makeWorldDirs(fixtureRoot)
    applySetup(fixtureRoot, vector.setup)
    mkdirSync(cwdAbs, { recursive: true })
    const treeBefore = snapshotTree(fixtureRoot)
    const world = await mountNextHostRouteCWorld({
      label: vector.id.toLowerCase(),
      fixtureRoot,
      cwd: cwdAbs,
      readRoots,
      writeRoots,
      host: surface.host,
      seams: surface.seams,
    })
    try {
      const { outcome, text, value } = await runSteps({
        root: fixtureRoot,
        steps: vector.steps,
        dispatch: (name, args, options) => world.dispatch(name, args, options),
      })
      const facts = await world.facts()
      const providerCalls = world.providerCalls()
      const record = makeRecord({
        vector,
        fixtureRoot,
        cwdAbs,
        readRoots,
        outcome,
        text,
        value,
        facts,
        providerCalls: providerCalls.length,
        baseCalls: world.base.calls,
        treeBefore,
        allowEscapedMatches,
      })
      return {
        record,
        witness: Object.freeze({
          vector: vector.id,
          entry: surface.host.searchModuleEntry,
          nextTree: surface.host.tree,
          spawns: providerCalls.map((call) => call.argv),
        }),
      }
    } finally {
      await world.dispose()
    }
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true })
  }
}

/**
 * Run the whole corpus on the new path (optionally a subset).
 * @param {{only?: readonly string[]}} [options]
 * @returns {Promise<{host: object, records: object[], identity: string}>}
 */
export async function runCorpus({ only } = {}) {
  const surface = await loadNewPathSurface()
  const vectors = only === undefined ? CORPUS : CORPUS.filter((vector) => only.includes(vector.id))
  const records = []
  const witnesses = []
  for (const vector of vectors) {
    const { record, witness } = await runVector(vector, surface)
    records.push(record)
    witnesses.push(witness)
  }
  return { host: surface.host, records, witnesses, identity: nextSearchHostIdentity(surface.host) }
}
