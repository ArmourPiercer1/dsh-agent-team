/**
 * a5sf-fs-contract-world.mjs — the host-free world for the FS face's LAYER B
 * (per-native-tool contract) arms.
 *
 * WHAT IS REAL HERE, and why each piece has to be:
 *
 *   provider      the PINNED baseline's `LocalFileSystem` (`fs-local`) — the
 *                 real atomic-write / expected-version / abort semantics. A
 *                 node:fs double would make the version-conflict arm test the
 *                 double's own `if`, which is the exact substitution this face
 *                 has been burned by before. The provider is wrapped ONCE by
 *                 {@link instrumentedFileSystemClass}, whose overrides only
 *                 COUNT calls and RECORD the typed error the real provider
 *                 threw; every call is still `super.<method>`.
 *   tool module   the PINNED baseline's real `@deepseek-ai/dsh-tool-fs` package
 *                 (lib entry, read-only import) — `read`/`write`/`edit`/
 *                 `read_image`, dispatched through the real
 *                 `@deepseek-ai/dsh-tools` runtime. No fixture tool stands in.
 *   observation   the PINNED baseline's `fs-observation-policy` plugin mounted
 *                 on the root: it is the ONLY source of the edit version guard
 *                 (`fs/edit-intent`). Without it the tool is unconditional by
 *                 upstream design, so the conflict arm must mount it or it would
 *                 pin a behaviour the default composition does not have.
 *   confinement   the PRODUCT seam: `mountMemberA5sfRealm` +
 *                 `attachA5sfNativeToolModules` (route C), i.e. the confined
 *                 subclass from `team-services/src/fs.ts` over the isolated
 *                 `ctx.isolate('fs', …)` scope.
 *
 * TWO COMPOSITIONS:
 *
 *   'route-c'    the product route (the exact call the live Member setup makes).
 *   'post-gap-1' the SAME realm and the SAME real module, mounted on the realm's
 *                isolated ctx through a ctx whose deferred `inject(...)` children
 *                also declare `fs` — the minimal diff proposed for
 *                GAP-FS-CONTRACT-1 (see the evidence README). It exists to pin
 *                `read_image`'s attachment contract, which the unpatched product
 *                route cannot reach at all. It is NOT a product claim: the arm
 *                that runs 'route-c' pins the failure.
 *
 * MUTATIONS are applied AFTER mounting, on the confined instance, and only ever
 * drop a forwarding argument (`expected`, `signal`) or under-report a stat size.
 * They are the load-bearing controls, not a second implementation.
 *
 * @module tests/world-factory/lib/a5sf-fs-contract-world
 */

import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createRequire, register } from 'node:module'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'
import { findTestRepoRoot, testUseTree } from '../../paths.mjs'

/** The Member identity every arm runs under. */
export const FS_CONTRACT_IDENTITY = Object.freeze({
  teamId: 'team-a5sf-fs-contract',
  memberInstanceId: 'member-a5sf-fs-contract',
  templateId: 'worker',
  instanceGeneration: 1,
})

/** The real upstream defaults these arms pin (read from the pinned module, not invented). */
export const FS_CONTRACT_LIMITS = Object.freeze({
  /** `STREAM_MIN_SIZE` in `tool-fs/src/read.ts`. */
  streamMinSize: 10 * 1024 * 1024,
  /** `READ_MAX_BYTES` in `tool-fs/src/read-render.ts`. */
  maxBytes: 50 * 1024,
  /** `READ_LIMIT` in `tool-fs/src/read.ts`. */
  limit: 2000,
})

/** One 199-char line + LF = 200 bytes, so the BYTE cap (not the line cap) binds. */
const BIG_LINE = `${'L'}${'x'.repeat(198)}\n`
const BIG_LINE_COUNT = 52_500
const BIG_TAIL = 'ZZ_A5SF_TAIL_TOKEN_NOT_IN_WINDOW\n'

/** A 1x1 RGBA PNG (70 bytes) whose IHDR carries width/height 1. */
export const PIXEL_PNG = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

const SEAM_CACHE = new Map()

/**
 * Load the repo seams and the PINNED module entries. Cached per repo root.
 * @param {string} repoRoot - workspace root (the tree under test).
 */
export function loadFsContractSeams(repoRoot) {
  if (SEAM_CACHE.has(repoRoot)) return SEAM_CACHE.get(repoRoot)
  const promise = (async () => {
    register(pathToFileURL(join(repoRoot, 'scripts', 'run-tests-hooks.mjs')).href)
    const row = await import(pathToFileURL(join(repoRoot, 'packages/runtime/src/plugin/live/a5sf-realm-row.mjs')).href)
    const runtimeRequire = createRequire(join(repoRoot, 'packages/runtime/package.json'))
    const { Context, Service } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href)
    const ToolRuntime = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-tools')).href)).default
    const SystemPrompt = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-system-prompt')).href)).default
    const { bindScopeParent, createScope } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-scope')).href)

    const pinnedFs = join(testUseTree(findTestRepoRoot(repoRoot) ?? repoRoot), 'packages', 'fs')
    const entries = {
      toolFs: join(pinnedFs, 'tool-fs', 'lib', 'index.js'),
      fsLocal: join(pinnedFs, 'fs-local', 'lib', 'index.js'),
      observationPolicy: join(pinnedFs, 'fs-observation-policy', 'lib', 'index.js'),
    }
    for (const [name, entry] of Object.entries(entries)) {
      if (!existsSync(entry)) {
        throw new Error(
          `the pinned baseline's ${name} entry is missing (${entry}); provision tests/deepseek-harness-test-use per docs/TEST_METHODS.md §1`,
        )
      }
    }
    const [nativeToolModules, fsLocal, observationPolicy] = await Promise.all([
      import(pathToFileURL(entries.toolFs).href),
      import(pathToFileURL(entries.fsLocal).href),
      import(pathToFileURL(entries.observationPolicy).href),
    ])
    return {
      row,
      Context,
      Service,
      ToolRuntime,
      SystemPrompt,
      bindScopeParent,
      createScope,
      nativeToolModules,
      observationPolicy,
      LocalFileSystem: fsLocal.LocalFileSystem,
      toolFsEntry: entries.toolFs,
    }
  })()
  SEAM_CACHE.set(repoRoot, promise)
  return promise
}

/**
 * The ONE provider wrapper: counts every managed call and records the typed
 * error the REAL provider threw. It never decides anything and never mutates an
 * argument; each override is `super.<method>(...)`.
 */
export function instrumentedFileSystemClass(LocalFileSystem) {
  return class InstrumentedFs extends LocalFileSystem {
    constructor(ctx, config) {
      super(ctx, config)
      this.calls = {
        stat: 0,
        lstat: 0,
        readText: 0,
        streamText: 0,
        readBytes: 0,
        writeText: 0,
        editText: 0,
      }
      /** Typed failures the REAL provider produced, in call order. */
      this.providerErrors = []
    }

    async stat(...args) {
      this.calls.stat += 1
      return super.stat(...args)
    }

    async lstat(...args) {
      this.calls.lstat += 1
      return super.lstat(...args)
    }

    async readText(...args) {
      this.calls.readText += 1
      return super.readText(...args)
    }

    async streamText(...args) {
      this.calls.streamText += 1
      return super.streamText(...args)
    }

    async readBytes(...args) {
      this.calls.readBytes += 1
      return super.readBytes(...args)
    }

    async writeText(...args) {
      this.calls.writeText += 1
      try {
        return await super.writeText(...args)
      } catch (error) {
        this.providerErrors.push({ op: 'writeText', code: error?.code, message: error?.message })
        throw error
      }
    }

    async editText(...args) {
      this.calls.editText += 1
      try {
        return await super.editText(...args)
      } catch (error) {
        this.providerErrors.push({ op: 'editText', code: error?.code, message: error?.message })
        throw error
      }
    }
  }
}

function lane(allow) {
  return Object.freeze({ mode: 'restricted', allow: Object.freeze([...allow]), ask: Object.freeze([]), deny: Object.freeze([]) })
}

function memberCeiling(readRoot, writeRoot) {
  return Object.freeze({
    memberIdentity: FS_CONTRACT_IDENTITY.memberInstanceId,
    templateId: FS_CONTRACT_IDENTITY.templateId,
    instanceGeneration: FS_CONTRACT_IDENTITY.instanceGeneration,
    revision: 'rev-a5sf-fs-contract',
    read: lane([readRoot]),
    write: lane([writeRoot]),
    network: Object.freeze({ access: 'allow' }),
  })
}

/**
 * A ctx whose DEFERRED `inject(...)` children also declare `fs` — the one-line
 * composition change proposed for GAP-FS-CONTRACT-1. Used only by the
 * 'post-gap-1' composition; the product route is measured unpatched.
 */
export function deferredFsContext(baseCtx, extra = ['fs']) {
  return baseCtx.extend({
    inject(names, callback) {
      let merged
      if (Array.isArray(names)) {
        merged = [...new Set([...names, ...extra])]
      } else {
        merged = { ...(names ?? {}) }
        for (const name of extra) if (!(name in merged)) merged[name] = null
      }
      const owner = this
      return owner.plugin({ inject: merged, apply: callback }, undefined)
    },
  })
}

/** Read a JSONL fact sink, tolerating "no facts yet". */
export function readFactsFile(path) {
  if (!existsSync(path)) return []
  const text = readFileSync(path, 'utf8').trim()
  if (text.length === 0) return []
  return text.split('\n').map((line) => JSON.parse(line))
}

/** Let the deferred-registration window settle (same bound discipline as the router). */
async function settleDeferred(getDefinition, rounds = 20) {
  for (let index = 0; index < rounds; index += 1) {
    if (getDefinition() !== undefined) return true
    await new Promise((resolve) => setImmediate(resolve))
  }
  return getDefinition() !== undefined
}

/**
 * Build one host-free world. Call `dispose()` in `finally`.
 *
 * @param {object} input
 * @param {string} input.repoRoot - the tree under test.
 * @param {string} input.label - mkdtemp label (one world per arm).
 * @param {'route-c'|'post-gap-1'} [input.composition] - which product composition.
 * @param {object} [input.mutations] - see {@link applyMutations}.
 */
export async function makeFsContractWorld({ repoRoot, label, composition = 'route-c', mutations = {} }) {
  const seams = await loadFsContractSeams(repoRoot)
  const {
    row, Context, Service, ToolRuntime, SystemPrompt,
    bindScopeParent, createScope, nativeToolModules, observationPolicy, LocalFileSystem, toolFsEntry,
  } = seams

  const dir = mkdtempSync(join(tmpdir(), `a5sf-fs-contract-${label}-`))
  const inside = join(dir, 'inside')
  const outside = join(dir, 'outside')
  mkdirSync(inside, { recursive: true })
  mkdirSync(outside, { recursive: true })
  const fixtures = {
    dir,
    inside,
    outside,
    doc: join(inside, 'doc.txt'),
    small: join(inside, 'small.txt'),
    big: join(inside, 'big.txt'),
    pixel: join(inside, 'pixel.png'),
    secretPng: join(outside, 'secret.png'),
    abort: join(inside, 'abort.txt'),
  }
  writeFileSync(fixtures.doc, 'alpha beta\n', 'utf8')
  writeFileSync(fixtures.small, 'small line\n', 'utf8')
  writeFileSync(fixtures.big, BIG_LINE.repeat(BIG_LINE_COUNT) + BIG_TAIL, 'utf8')
  writeFileSync(fixtures.pixel, PIXEL_PNG)
  writeFileSync(fixtures.secretPng, PIXEL_PNG)
  writeFileSync(fixtures.abort, 'ORIGINAL\n', 'utf8')

  const sinkPath = join(dir, 'guard-consult.jsonl')

  /** The recording attachment store: the module's own `saveImage` seam. */
  const attachments = { saved: [], record: null }
  class RecordingAttachments extends Service {
    constructor(ctx) {
      super(ctx, 'attachments')
      this.saved = attachments.saved
      this.imageLimits = {
        mediaTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
        maxImageBytes: 10_000_000,
        maxMessageImageBytes: 10_000_000,
        maxImageDimension: 8192,
        maxImagePixels: 40_000_000,
      }
    }

    async saveImage(image) {
      const data = Buffer.from(image.data)
      // PNG IHDR is authoritative for the metadata the tool reports; the real
      // store decodes the same way. This double RECORDS, it does not decide.
      const ref = {
        attachmentId: `att-${this.saved.length + 1}`,
        mediaType: image.mediaType,
        bytes: data.length,
        width: data.readUInt32BE(16),
        height: data.readUInt32BE(20),
        name: image.name,
      }
      this.saved.push(ref)
      return ref
    }
  }

  /** The route gate's `llm` seam: image-capable, so a refusal is the LANE's. */
  const llmResolutions = []
  class RecordingLlm extends Service {
    constructor(ctx) {
      super(ctx, 'llm')
    }

    async resolveModelInfo(provider, model) {
      llmResolutions.push({ provider, model })
      return { inputModalities: ['text', 'image'] }
    }
  }

  const root = new Context()
  await root.plugin(SystemPrompt)
  await root.plugin(ToolRuntime)
  await root.plugin(RecordingAttachments)
  await root.plugin(RecordingLlm)
  // The PRESET/base provider: the preset row resolves it before the shadow, and
  // its mere presence is what lets the native module's `inject` settle on the
  // preset scope.
  await root.plugin(LocalFileSystem, { cwd: dir, diffBasisMaxBytes: 10 * 1024 * 1024 })
  await root.plugin(observationPolicy)

  // The preset topology the live Member row has (route C relies on it).
  const standingKey = {}
  const standing = createScope(root, standingKey)
  await standing.ctx.plugin(nativeToolModules)

  const agentKey = {
    session: {
      header: { cwd: inside },
      requestHeader: () => ({ config: { provider: 'mock-provider', model: 'mock-model' } }),
    },
    options: {},
  }
  const agent = createScope(root, agentKey)
  bindScopeParent(agentKey, standingKey)

  const presetDefinition = root.get('tools').get('read_image', agentKey)

  const InstrumentedFs = instrumentedFileSystemClass(LocalFileSystem)
  const realm = await row.mountMemberA5sfRealm({
    root: agent.ctx,
    a5sfConfig: row.a5sfRealmConfigOf({ a5sfEvidencePath: sinkPath }),
    provider: () => ({
      compiledFor: () => ({
        members: [{
          identity: FS_CONTRACT_IDENTITY,
          policy: { ok: true, value: memberCeiling(inside, inside) },
          config: { cwd: dir, diffBasisMaxBytes: 10 * 1024 * 1024 },
        }],
        providerClass: InstrumentedFs,
      }),
    }),
    member: {
      sessionId: 'session-a5sf-fs-contract',
      instanceId: FS_CONTRACT_IDENTITY.memberInstanceId,
      teamRootSessionId: 'team-root-a5sf-fs-contract',
      templateId: FS_CONTRACT_IDENTITY.templateId,
    },
  })
  if (realm === undefined) throw new Error('the configured row must mount a realm')

  let fibers = []
  if (composition === 'route-c') {
    fibers = await row.attachA5sfNativeToolModules(
      realm,
      agent.ctx,
      row.a5sfRealmConfigOf({ a5sfEvidencePath: sinkPath, a5sfNativeToolModules: [pathToFileURL(toolFsEntry).href] }),
      agentKey,
    )
  } else if (composition === 'post-gap-1') {
    // The realm's isolated ctx, with the deferred-inject merge proposed for
    // GAP-FS-CONTRACT-1. Same real module, same confined provider.
    await deferredFsContext(realm.installation.members[0].ctx).plugin(nativeToolModules)
    await settleDeferred(() => root.get('tools').get('read_image', agentKey))
  } else {
    throw new Error(`unknown composition '${composition}'`)
  }

  const member = realm.installation.members[0]
  const provider = member.fs
  const routedDefinition = root.get('tools').get('read_image', agentKey)

  applyMutations(provider, fixtures, mutations)
  if (mutations.silentAttachment === true) {
    // M4: the store answers the tool but records NOTHING, so an arm that only
    // checked "saveImage was called" would stay green. The attachment arm must
    // assert the materialised record itself.
    const store = root.get('attachments')
    store.saveImage = async (image) => ({
      attachmentId: 'mutant-unrecorded',
      mediaType: image.mediaType,
      bytes: image.data.length,
      width: 1,
      height: 1,
    })
  }

  let disposed = false
  const world = {
    root,
    agentKey,
    agentCtx: agent.ctx,
    realm,
    member,
    provider,
    fibers,
    presetDefinition,
    routedDefinition,
    fixtures,
    sinkPath,
    attachments,
    llmResolutions,
    composition,
    calls: () => ({ ...provider.calls }),
    providerErrors: () => provider.providerErrors.map((error) => ({ ...error })),
    facts: () => readFactsFile(sinkPath),
    /** Dispatch one tool call through the REAL registry (the model call path). */
    async dispatch(name, args, { signal, callId } = {}) {
      const settled = await root.get('tools').execute({
        signal: signal ?? new AbortController().signal,
        callId: callId ?? `a5sf-fs-contract-${name}`,
        name,
        arguments: args,
        agent: agentKey,
      })
      const text = Array.isArray(settled.content)
        ? settled.content.map((part) => {
          if (part?.type === 'text') return part.text
          if (part?.type === 'image') return `<image ${part.attachment?.attachmentId}>`
          return ''
        }).join('')
        : ''
      return {
        isError: settled.isError === true,
        text,
        value: settled.value,
        content: settled.content,
        errorMessage: settled.error?.message,
      }
    },
    async dispose() {
      if (disposed) return
      disposed = true
      try {
        await realm.dispose()
      } finally {
        rmSync(dir, { recursive: true, force: true })
      }
    },
  }
  return world
}

/**
 * Apply the load-bearing mutants AFTER the real mount. Each mutant only DROPS a
 * forwarded argument or under-reports a stat size — the regressions this face's
 * forwarding is responsible for.
 */
export function applyMutations(provider, fixtures, mutations = {}) {
  if (mutations.dropVersionGuard === true) {
    const original = provider.editText.bind(provider)
    provider.editText = (target, edit, _expected, signal, policy) => original(target, edit, undefined, signal, policy)
  }
  if (mutations.dropWriteSignal === true) {
    const original = provider.writeText.bind(provider)
    provider.writeText = (target, content, expected, _signal, policy) => original(target, content, expected, undefined, policy)
  }
  if (mutations.underreportStatSize === true) {
    const original = provider.stat.bind(provider)
    provider.stat = async (target, signal) => {
      const info = await original(target, signal)
      if (info === undefined || info.size === undefined) return info
      const hostPath = provider.processPath(target)
      if (hostPath !== fixtures.big) return info
      return { ...info, size: 1 }
    }
  }
}


// ===========================================================================
// THE ARMS (shared by the node:test suite and the mutation control driver)
//
// Each arm asserts ORDER and IDENTITY: the fact delta's method sequence, the
// provider call delta, the typed code the REAL provider threw, and the bytes on
// disk. "It failed" is never the assertion.
// ===========================================================================

/** New facts since an index, with their sequence numbers made contiguous. */
function factDelta(world, before) {
  return world.facts().slice(before)
}

function callDelta(before, after) {
  const delta = {}
  for (const key of Object.keys(after)) delta[key] = after[key] - before[key]
  return delta
}

function assertContiguous(facts) {
  for (let index = 1; index < facts.length; index += 1) {
    assert.equal(
      facts[index].sequence,
      facts[index - 1].sequence + 1,
      `guard facts must be contiguous in order; got ${JSON.stringify(facts.map((fact) => [fact.method, fact.sequence]))}`,
    )
  }
}

/**
 * FSB-EDIT-1 — a stale edit is REFUSED by the real provider's version guard,
 * writes nothing, reports the remediated typed error, and consults the guard
 * exactly once.
 *
 * Upstream behaviour pinned: `fs-local/src/index.ts` `editText` compares
 * `existing.version !== expected.version` → `FsError(..., 'FS_STALE_VERSION')`
 * BEFORE `readForEdit`/`writeFileAtomic`; `fs-observation-policy` supplies
 * `expected` from the prior read's observed version (`fs/edit-intent`); the
 * tool's `remediateFsError` appends the re-read remedy.
 */
export async function armEditStaleConflict(world) {
  const fixture = world.fixtures.doc
  const before = world.facts().length
  const callsBefore = world.calls()
  world.provider.providerErrors.length = 0

  const read = await world.dispatch('read', { file_path: fixture }, { callId: 'fsb-edit-read' })
  assert.equal(read.isError, false, `the setup read must succeed: ${read.text}`)
  assert.deepEqual(
    factDelta(world, before).map((fact) => [fact.method, fact.decision]),
    [['stat', 'allow'], ['readText', 'allow']],
    'one stat then one readText — no other consultation',
  )

  // The external change the observation cannot know about: a real second write
  // to the same inode, so the provider's version really differs.
  writeFileSync(fixture, 'alpha GAMMA\n', 'utf8')
  const changedBytes = readFileSync(fixture)
  const staleAt = world.facts().length

  const stale = await world.dispatch(
    'edit',
    { file_path: fixture, old_string: 'alpha beta', new_string: 'alpha delta' },
    { callId: 'fsb-edit-stale' },
  )

  assert.equal(stale.isError, true, 'a stale edit must be an error, never a silent write')
  assert.match(stale.text, /file changed since it was read/u, 'the model-facing reason names the staleness')
  assert.match(stale.text, /re-read the file, then retry/u, 'the remediated remedy is present')

  assert.deepEqual(
    world.providerErrors(),
    [{ op: 'editText', code: 'FS_STALE_VERSION', message: `cannot edit "${fixture}": file changed since it was read` }],
    'exactly ONE typed provider error, and it is FS_STALE_VERSION',
  )
  assert.deepEqual(callDelta(callsBefore, world.calls()), {
    stat: 1, lstat: 0, readText: 1, streamText: 0, readBytes: 0, writeText: 0, editText: 1,
  }, 'exactly one read pair + one editText provider call (no retry, no extra probe)')

  assert.deepEqual(readFileSync(fixture), changedBytes, 'the refused edit changed ZERO bytes')

  const delta = factDelta(world, staleAt)
  assert.deepEqual(delta.map((fact) => [fact.method, fact.decision, fact.decidedBy]), [
    ['editText', 'allow', 'ALLOW'],
  ], 'the ADMISSION was allowed (it is the version guard, not the lane, that refuses) — exactly one fact')
  assert.equal(delta[0].locator, fixture, 'the fact names the edited locator')
  assert.equal(delta[0].toolBindingIdentity, null, 'the ceiling realm admits it; no binding is invented')
  assertContiguous(world.facts())
}

/** FSB-EDIT-2 — the control: a fresh edit (read → edit, no external change) still succeeds. */
export async function armEditFreshControl(world) {
  const fixture = world.fixtures.doc
  const before = world.facts().length
  const callsBefore = world.calls()
  world.provider.providerErrors.length = 0

  const read = await world.dispatch('read', { file_path: fixture }, { callId: 'fsb-edit-control-read' })
  assert.equal(read.isError, false, `the control read must succeed: ${read.text}`)
  const fresh = await world.dispatch(
    'edit',
    { file_path: fixture, old_string: 'alpha beta', new_string: 'alpha delta' },
    { callId: 'fsb-edit-control-edit' },
  )
  assert.equal(fresh.isError, false, `a fresh edit must still succeed: ${fresh.text}`)
  assert.match(fresh.text, /has been updated successfully/u)
  assert.equal(readFileSync(fixture, 'utf8'), 'alpha delta\n', 'the control edit really wrote')

  assert.deepEqual(callDelta(callsBefore, world.calls()).editText, 1, 'one editText provider call')
  assert.deepEqual(world.providerErrors(), [], 'no version error on a fresh edit')
  assert.deepEqual(
    factDelta(world, before).map((fact) => [fact.method, fact.decision]),
    [['stat', 'allow'], ['readText', 'allow'], ['editText', 'allow']],
    'the order is stat → readText → editText',
  )
  assertContiguous(world.facts())
}

/**
 * FSB-READ-1 — at/above the streaming threshold the native read STREAMS and
 * renders a byte-capped window with the continuation footer; it never buffers
 * the whole file and never refuses or spills.
 *
 * Upstream behaviour pinned: `tool-fs/src/read.ts` routes `size >=
 * readStreamMinSize` to `ctx.fs.streamText`, and `read-render.ts` caps the
 * window at `readMaxBytes` and reports `truncatedByBytes` with
 * `(Output capped. Showing lines a-b. Use offset=b+1 to continue.)`.
 */
export async function armReadStreamBoundary(world) {
  const fixture = world.fixtures.big
  const size = statSync(fixture).size
  assert.ok(size >= FS_CONTRACT_LIMITS.streamMinSize, `the fixture must CROSS the threshold: ${size}`)
  assert.ok(size > FS_CONTRACT_LIMITS.maxBytes, 'the fixture is larger than the byte cap')
  const totalLines = BIG_LINE_COUNT + 1

  const before = world.facts().length
  const callsBefore = world.calls()
  const read = await world.dispatch('read', { file_path: fixture }, { callId: 'fsb-read-boundary' })
  assert.equal(read.isError, false, `the boundary read must succeed, not refuse: ${read.text}`)

  assert.deepEqual(callDelta(callsBefore, world.calls()), {
    stat: 1, lstat: 0, readText: 0, streamText: 1, readBytes: 0, writeText: 0, editText: 0,
  }, 'the tool STREAMED (streamText exactly once, readText zero) after one stat')

  assert.equal(read.value?.totalLines, totalLines, 'the whole stream was scanned for an EXACT total')
  assert.ok(read.value.lines.length < FS_CONTRACT_LIMITS.limit, 'the byte cap bound the window before the line cap')
  const last = read.value.lines.at(-1).number
  const footer = new RegExp(`Output capped\\. Showing lines 1-${last}\\. Use offset=${last + 1} to continue\\.`, 'u')
  assert.match(read.text, footer, 'the truncation MARKER (not a refusal, not a spill) is exact')

  assert.equal(read.text.includes('ZZ_A5SF_TAIL_TOKEN_NOT_IN_WINDOW'), false, 'bytes past the window never reach the model')
  assert.deepEqual(
    factDelta(world, before).map((fact) => [fact.method, fact.decision]),
    [['stat', 'allow'], ['streamText', 'allow']],
    'the guard admits stat then streamText, in that order',
  )
  assertContiguous(world.facts())

  // Continuation: the next window is a SECOND stream, not a buffered tail.
  const callsMid = world.calls()
  const next = await world.dispatch('read', { file_path: fixture, offset: last + 1 }, { callId: 'fsb-read-boundary-next' })
  assert.equal(next.isError, false, `the continuation read must succeed: ${next.text}`)
  assert.equal(next.value?.lines[0]?.number, last + 1, 'the continuation starts at the advertised line')
  assert.equal(callDelta(callsMid, world.calls()).streamText, 1, 'the continuation also STREAMS')
  assert.equal(callDelta(callsMid, world.calls()).readText, 0)
}

/** FSB-READ-2 — the control: BELOW the threshold the same tool buffers (`readText`). */
export async function armReadSmallControl(world) {
  const fixture = world.fixtures.small
  assert.ok(statSync(fixture).size < FS_CONTRACT_LIMITS.streamMinSize)
  const callsBefore = world.calls()
  const read = await world.dispatch('read', { file_path: fixture }, { callId: 'fsb-read-small' })
  assert.equal(read.isError, false, `the small read must succeed: ${read.text}`)
  assert.deepEqual(callDelta(callsBefore, world.calls()), {
    stat: 1, lstat: 0, readText: 1, streamText: 0, readBytes: 0, writeText: 0, editText: 0,
  }, 'below the threshold the tool BUFFERS (readText once, streamText zero)')
  assert.match(read.text, /\(End of file - total 1 lines\)/u)
}

/**
 * FSB-ABORT-1 — an abort after the staged bytes are written but BEFORE
 * publication leaves the target byte-identical, removes the staging directory,
 * and is reported as a failure.
 *
 * Upstream behaviour pinned: `fs-local/src/fsio.ts` `writeFileAtomic` calls
 * `throwIfAborted(signal, 'write')` after `handle.sync()`/`inspectTemp` and
 * before `rename`, maps the abort to `FsError('write aborted', 'FS_ABORTED')`,
 * and removes the staging dir; the confined provider forwards `signal`.
 */
export async function armWriteAbort(world) {
  const fixture = world.fixtures.abort
  const before = world.facts().length
  // The observation policy requires a prior read before an overwrite.
  const read = await world.dispatch('read', { file_path: fixture }, { callId: 'fsb-abort-read' })
  assert.equal(read.isError, false, `the setup read must succeed: ${read.text}`)
  const abortAt = world.facts().length
  const callsBefore = world.calls()
  world.provider.providerErrors.length = 0

  const controller = new AbortController()
  // Deterministic mid-write abort: the real provider calls `inspectTemp` AFTER
  // the staged file is written and synced, and BEFORE the signal check that
  // guards publication.
  world.provider.internals.inspectTemp = async () => { controller.abort() }
  let aborted
  try {
    aborted = await world.dispatch(
      'write',
      { file_path: fixture, content: 'REPLACEMENT\n' },
      { signal: controller.signal, callId: 'fsb-abort-write' },
    )
  } finally {
    delete world.provider.internals.inspectTemp
  }

  assert.equal(aborted.isError, true, 'an aborted write must be reported as an error')
  assert.match(aborted.text, /aborted/iu)
  assert.equal(/Updated file|Created file/u.test(aborted.text), false, 'an aborted write is never reported as success')
  assert.equal(readFileSync(fixture, 'utf8'), 'ORIGINAL\n', 'the target is byte-identical (no partial write)')
  assert.deepEqual(
    readdirSync(world.fixtures.inside).filter((name) => name.includes('.tmpdir')), [],
    'the staging directory was removed (no residue)',
  )
  assert.deepEqual(
    world.providerErrors(),
    [{ op: 'writeText', code: 'FS_ABORTED', message: 'write aborted' }],
    'exactly ONE typed provider error, and it is FS_ABORTED',
  )
  assert.equal(callDelta(callsBefore, world.calls()).writeText, 1, 'exactly one writeText provider call')
  assert.deepEqual(
    factDelta(world, abortAt).map((fact) => [fact.method, fact.decision, fact.decidedBy]),
    [['writeText', 'allow', 'ALLOW']],
    'the admission was consulted exactly once (the abort is the write path, not the lane)',
  )
  assertContiguous(world.facts())
}

/** FSB-ABORT-2 — the control: the same write without an abort publishes. */
export async function armWriteControl(world) {
  const fixture = world.fixtures.abort
  const before = world.facts().length
  const read = await world.dispatch('read', { file_path: fixture }, { callId: 'fsb-write-control-read' })
  assert.equal(read.isError, false, `the control read must succeed: ${read.text}`)
  const callsBefore = world.calls()
  world.provider.providerErrors.length = 0
  const written = await world.dispatch(
    'write',
    { file_path: fixture, content: 'REPLACEMENT\n' },
    { callId: 'fsb-write-control-write' },
  )
  assert.equal(written.isError, false, `the control write must succeed: ${written.text}`)
  assert.match(written.text, /Updated file/u)
  assert.equal(readFileSync(fixture, 'utf8'), 'REPLACEMENT\n', 'the control write published')
  assert.equal(callDelta(callsBefore, world.calls()).writeText, 1)
  assert.deepEqual(world.providerErrors(), [])
  assert.deepEqual(
    factDelta(world, before).map((fact) => [fact.method, fact.decision]),
    [['stat', 'allow'], ['readText', 'allow'], ['writeText', 'allow']],
    'the order is stat → readText → writeText',
  )
  assertContiguous(world.facts())
}

/**
 * FSB-IMG-1 — the PRODUCT route-C composition, measured as it is
 * (GAP-FS-CONTRACT-1): the routed `read_image` definition is a DIFFERENT object
 * from the preset one (the shadow really took), and its deferred fiber cannot
 * resolve `fs`, so a call fails CLOSED with ZERO provider reads and ZERO
 * attachment bytes.
 *
 * This is a layer-B fact in its own right ("a refused read materialises
 * nothing") but it is NOT the lane refusing, and it must never be written up as
 * if it were.
 */
export async function armReadImageRouteCRefusal(world) {
  assert.notEqual(world.routedDefinition, undefined, 'the routed mount must expose read_image')
  assert.notEqual(world.presetDefinition, undefined, 'the preset definition exists')
  assert.notEqual(
    world.routedDefinition, world.presetDefinition,
    'IDENTITY: the routed definition shadows the preset one (otherwise the call below would run on the BASE provider)',
  )

  const factsBefore = world.facts().length
  const callsBefore = world.calls()
  const savedBefore = world.attachments.saved.length

  const outcome = await world.dispatch('read_image', { file_path: world.fixtures.pixel }, { callId: 'fsb-img-route-c' })
  assert.equal(outcome.isError, true, 'the routed read_image fails closed today')
  assert.match(outcome.text, /cannot get property "fs" without inject/u, 'the observed GAP-1 failure, verbatim')

  assert.deepEqual(callDelta(callsBefore, world.calls()), {
    stat: 0, lstat: 0, readText: 0, streamText: 0, readBytes: 0, writeText: 0, editText: 0,
  }, 'ZERO provider reads: no stat, no readBytes')
  assert.equal(world.attachments.saved.length, savedBefore, 'ZERO attachments were materialised')
  assert.equal(factDelta(world, factsBefore).length, 0, 'ZERO guard facts: the lane was never consulted')
}

/**
 * FSB-IMG-2 — the attachment contract on a REAL module + REAL confined provider
 * under the post-GAP-1 composition: an allowed read materialises EXACTLY ONE
 * attachment with the file's real metadata after exactly one stat + one
 * readBytes, in that order.
 */
export async function armReadImageAllowed(world) {
  const fixture = world.fixtures.pixel
  const factsBefore = world.facts().length
  const callsBefore = world.calls()
  const savedBefore = world.attachments.saved.length

  const outcome = await world.dispatch('read_image', { file_path: fixture }, { callId: 'fsb-img-allowed' })
  assert.equal(outcome.isError, false, `the allowed image read must succeed: ${outcome.text}`)

  assert.deepEqual(callDelta(callsBefore, world.calls()), {
    stat: 1, lstat: 0, readText: 0, streamText: 0, readBytes: 1, writeText: 0, editText: 0,
  }, 'exactly one stat + one readBytes through the CONFINED provider')

  assert.equal(world.attachments.saved.length, savedBefore + 1, 'EXACTLY ONE attachment')
  const ref = world.attachments.saved.at(-1)
  assert.deepEqual(
    { mediaType: ref.mediaType, bytes: ref.bytes, width: ref.width, height: ref.height, name: ref.name },
    { mediaType: 'image/png', bytes: PIXEL_PNG.length, width: 1, height: 1, name: 'pixel.png' },
    'the attachment metadata is the file\'s real metadata',
  )
  assert.deepEqual(
    {
      mediaType: outcome.value?.image?.mediaType,
      bytes: outcome.value?.image?.bytes,
      width: outcome.value?.image?.width,
      height: outcome.value?.image?.height,
      attachmentId: outcome.value?.image?.attachmentId,
    },
    { mediaType: 'image/png', bytes: PIXEL_PNG.length, width: 1, height: 1, attachmentId: ref.attachmentId },
    'the tool value is the SAME single attachment (no second materialisation)',
  )
  const imageBlocks = (outcome.content ?? []).filter((part) => part?.type === 'image')
  assert.equal(imageBlocks.length, 1, 'exactly one image content block')
  assert.equal(imageBlocks[0].attachment?.attachmentId, ref.attachmentId)

  assert.deepEqual(
    factDelta(world, factsBefore).map((fact) => [fact.method, fact.decision, fact.decidedBy]),
    [['stat', 'allow', 'ALLOW'], ['readBytes', 'allow', 'ALLOW']],
    'the order is stat → readBytes, each admitted once',
  )
  assertContiguous(world.facts())
}

/**
 * FSB-IMG-3 — the lane refuses the image BEFORE any bytes or attachment work:
 * one `stat` deny fact, ZERO readBytes, ZERO attachment bytes.
 */
export async function armReadImageDenied(world) {
  const fixture = world.fixtures.secretPng
  const factsBefore = world.facts().length
  const callsBefore = world.calls()
  const savedBefore = world.attachments.saved.length
  const bytesBefore = world.attachments.saved.reduce((sum, ref) => sum + ref.bytes, 0)

  const outcome = await world.dispatch('read_image', { file_path: fixture }, { callId: 'fsb-img-denied' })
  assert.equal(outcome.isError, true, 'an out-of-lane image must be refused')
  assert.match(outcome.text, /outside every allow subtree/u, 'the lane\'s own refusal reason')

  assert.deepEqual(callDelta(callsBefore, world.calls()), {
    stat: 0, lstat: 0, readText: 0, streamText: 0, readBytes: 0, writeText: 0, editText: 0,
  }, 'ZERO provider reads: the guard refused before super.stat and readBytes never ran')
  assert.equal(world.attachments.saved.length, savedBefore, 'no attachment was materialised')
  assert.equal(world.attachments.saved.reduce((sum, ref) => sum + ref.bytes, 0), bytesBefore, 'ZERO attachment bytes')

  assert.deepEqual(
    factDelta(world, factsBefore).map((fact) => [fact.method, fact.decision, fact.decidedBy, fact.locator]),
    [['stat', 'deny', 'IO_READ_DENIED', fixture]],
    'exactly ONE refused consultation: stat, denied, on the requested locator',
  )
  assertContiguous(world.facts())
}
