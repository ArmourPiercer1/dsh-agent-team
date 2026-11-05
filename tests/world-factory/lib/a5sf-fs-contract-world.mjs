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
import {
  existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, readlinkSync, rmSync, statSync, writeFileSync,
} from 'node:fs'
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

/**
 * `GAP-FS-CONTRACT-1` — the KNOWN product gap this face pinned in the previous
 * increment and must NOT fix here: `mount.ts`'s `ROUTED_SERVICE_NAMES` omits
 * `fs`, so a routed (deferred) `read_image` child cannot resolve `ctx.fs` and
 * fails closed before any provider I/O. The image-route-gate arms must be
 * meaningful either way: under the proposed post-GAP-1 composition they pin the
 * tool's OWN route refusal; under the product route they pin THIS code instead
 * of silently passing.
 */
export const A5SF_FS_CONTRACT_GAP = 'GAP-FS-CONTRACT-1'

/** The two tool-binding identities the binding-realm arms mount. */
export const FS_CONTRACT_BINDINGS = Object.freeze({
  edit: 'a5sf.test/edit',
  write: 'a5sf.test/write',
  readImage: 'a5sf.test/read_image',
})

const SEAM_CACHE = new Map()

/**
 * WHERE the pinned entries live and WHAT the arms consume. Exported so the
 * suite's host gate can distinguish the two failure shapes the CI round proved:
 *
 *   root ABSENT                 -> a DECLARED REFUSAL (not-run), never a pass;
 *   root present, an entry gone -> a HARD FAILURE (a partial/older host is a pin
 *                                  violation, not an environment absence).
 *
 * The entries are `lib/` build outputs, and `lib/` is NOT committed in the pinned
 * tree (`git ls-tree <pin> packages/fs/tool-fs` has no `lib/`), so "the checkout
 * is there" is not by itself enough — a provisioned lane must build the host.
 */
export function fsContractHostLayout(repoRoot) {
  const root = testUseTree(findTestRepoRoot(repoRoot) ?? repoRoot)
  const pinnedFs = join(root, 'packages', 'fs')
  return {
    root,
    entries: {
      toolFs: join(pinnedFs, 'tool-fs', 'lib', 'index.js'),
      fsLocal: join(pinnedFs, 'fs-local', 'lib', 'index.js'),
      observationPolicy: join(pinnedFs, 'fs-observation-policy', 'lib', 'index.js'),
    },
  }
}

/**
 * Load the repo seams and the PINNED module entries. Cached per repo root.
 * @param {string} repoRoot - workspace root (the tree under test).
 */
export function loadFsContractSeams(repoRoot) {
  if (SEAM_CACHE.has(repoRoot)) return SEAM_CACHE.get(repoRoot)
  const promise = (async () => {
    register(pathToFileURL(join(repoRoot, 'scripts', 'run-tests-hooks.mjs')).href)
    const row = await import(pathToFileURL(join(repoRoot, 'packages/runtime/src/plugin/live/a5sf-realm-row.mjs')).href)
    /** The REAL P1 two-axis compiler; a binding lane is never re-intersected here. */
    const memberIoPolicy = await import(pathToFileURL(join(repoRoot, 'packages/runtime/member-io-policy/src/index.ts')).href)
    const runtimeRequire = createRequire(join(repoRoot, 'packages/runtime/package.json'))
    const { Context, Service } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href)
    const ToolRuntime = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-tools')).href)).default
    const SystemPrompt = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-system-prompt')).href)).default
    const { bindScopeParent, createScope } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-scope')).href)

    const { entries } = fsContractHostLayout(repoRoot)
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
      memberIoPolicy,
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
 *
 * `instances` (optional) collects every constructed provider, so a world with
 * tool-binding realms can tell WHICH confined provider (`member.fs` or
 * `binding.fs`) actually served a call — the "narrower lane is what the provider
 * sees" assertion is an identity/count assertion, not a presence assertion.
 */
export function instrumentedFileSystemClass(LocalFileSystem, instances = null) {
  return class InstrumentedFs extends LocalFileSystem {
    constructor(ctx, config) {
      super(ctx, config)
      if (instances !== null) instances.push(this)
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
      const stream = await super.streamText(...args)
      const self = this
      // The typed failure of a STREAMED read happens during iteration, not at
      // the call: wrap the real iterable so the provider's own `FS_ABORTED`
      // (or any other typed fault) is recorded without changing a byte of its
      // behaviour.
      return (async function* observed() {
        try {
          yield* stream
        } catch (error) {
          self.providerErrors.push({ op: 'streamText', code: error?.code, message: error?.message })
          throw error
        }
      })()
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

function memberCeiling(readRoots, writeRoots) {
  return Object.freeze({
    memberIdentity: FS_CONTRACT_IDENTITY.memberInstanceId,
    templateId: FS_CONTRACT_IDENTITY.templateId,
    instanceGeneration: FS_CONTRACT_IDENTITY.instanceGeneration,
    revision: 'rev-a5sf-fs-contract',
    read: lane(readRoots),
    write: lane(writeRoots),
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
 * @param {'route-c'|'post-gap-1'|'binding-post-gap-1'} [input.composition] - which composition.
 * @param {object} [input.mutations] - see {@link applyMutations}; the two
 *   compile-time mutants ({@link widenReadLane}, {@link widenBindingTool}) are
 *   consumed HERE because a compiled lane cannot be re-opened after mount.
 * @param {ReadonlyArray<{ toolBindingIdentity: string, read: string[]|null, write: string[]|null }>} [input.bindings]
 *   - tool-binding restrictions. Each is intersected with the Member ceiling by
 *     the REAL P1 compiler (`compileEffectiveIo`) — this world never computes the
 *     intersection itself.
 * @param {string[]} [input.llmModalities] - what the route double declares as
 *   input modalities (`['text','image']` by default). A text-only route is what
 *   the `read_image` route-gate arm needs.
 * @param {{ read?: string[], write?: string[] }} [input.laneRoots] - the Member
 *   ceiling's allow subtrees (default: one root, `inside`, on both axes). A
 *   WRITE lane wider than the READ lane is the "write-only / no observation
 *   allowance" shape the create arms need.
 */
export async function makeFsContractWorld({
  repoRoot,
  label,
  composition = 'route-c',
  mutations = {},
  bindings = [],
  llmModalities = ['text', 'image'],
  laneRoots = {},
}) {
  const seams = await loadFsContractSeams(repoRoot)
  const {
    row, memberIoPolicy, Context, Service, ToolRuntime, SystemPrompt,
    bindScopeParent, createScope, nativeToolModules, observationPolicy, LocalFileSystem, toolFsEntry,
  } = seams

  const dir = mkdtempSync(join(tmpdir(), `a5sf-fs-contract-${label}-`))
  const inside = join(dir, 'inside')
  const outside = join(dir, 'outside')
  const bound = join(inside, 'bound')
  const observe = join(inside, 'observe')
  mkdirSync(inside, { recursive: true })
  mkdirSync(outside, { recursive: true })
  mkdirSync(bound, { recursive: true })
  mkdirSync(observe, { recursive: true })
  const fixtures = {
    dir,
    inside,
    outside,
    bound,
    observe,
    doc: join(inside, 'doc.txt'),
    small: join(inside, 'small.txt'),
    big: join(inside, 'big.txt'),
    pixel: join(inside, 'pixel.png'),
    secretPng: join(outside, 'secret.png'),
    abort: join(inside, 'abort.txt'),
    /** Two matches: the ambiguity arm needs >1, the replace_all arm needs all replaced. */
    multi: join(inside, 'multi.txt'),
    /** Inside the ceiling READ lane but never read: the createIfAbsent-onto-existing refusal. */
    unread: join(observe, 'unread.txt'),
    /** Does NOT exist: the `createIfAbsent` allow path. */
    createNew: join(inside, 'created-new.txt'),
    /** Inside the BINDING lane: allowed through the narrower realm. */
    boundEdit: join(bound, 'notes.txt'),
    boundPixel: join(bound, 'bound.png'),
  }
  writeFileSync(fixtures.doc, 'alpha beta\n', 'utf8')
  writeFileSync(fixtures.small, 'small line\n', 'utf8')
  writeFileSync(fixtures.big, BIG_LINE.repeat(BIG_LINE_COUNT) + BIG_TAIL, 'utf8')
  writeFileSync(fixtures.pixel, PIXEL_PNG)
  writeFileSync(fixtures.secretPng, PIXEL_PNG)
  writeFileSync(fixtures.abort, 'ORIGINAL\n', 'utf8')
  writeFileSync(fixtures.multi, 'tick tick tick\n', 'utf8')
  writeFileSync(fixtures.unread, 'UNREAD ORIGINAL\n', 'utf8')
  writeFileSync(fixtures.boundEdit, 'alpha beta\n', 'utf8')
  writeFileSync(fixtures.boundPixel, PIXEL_PNG)

  const sinkPath = join(dir, 'guard-consult.jsonl')

  // A lane entry may be an absolute path or the NAME of a fixture (`inside`,
  // `observe`, `bound`, …), so a test case table does not have to know the
  // mkdtemp prefix before the world exists.
  const rootOf = (value) => (typeof value === 'string' && Object.hasOwn(fixtures, value) ? fixtures[value] : value)
  const resolveRoots = (values) => (values ?? []).map(rootOf)

  // The ceiling's allow subtrees. `widenReadLane` recompiles the ceiling with
  // the WRITE roots on the read axis: the "the Team guard's write⇒read gate is
  // what refused, not the lane" control. It is a compile-time mutant because a
  // mounted realm's compiled lane is immutable by design.
  const writeRoots = laneRoots.write === undefined ? [inside] : resolveRoots(laneRoots.write)
  const readRoots = mutations.widenReadLane === true
    ? writeRoots
    : (laneRoots.read === undefined ? [inside] : resolveRoots(laneRoots.read))
  const ceiling = memberCeiling(readRoots, writeRoots)

  // One binding realm per admitted ToolBinding. The intersection is the PRODUCT
  // compiler's, never a second one: `widenBindingTool` recompiles that binding
  // with `no-additional-narrowing`, i.e. the restriction silently stopped
  // applying — the regression the binding arms must catch.
  const compiledBindings = bindings.map((spec) => {
    const widen = mutations.widenBindingTool === spec.toolBindingIdentity
    const laneOrNothing = (paths) => (widen || paths === null || paths === undefined ? 'no-additional-narrowing' : lane(resolveRoots(paths)))
    const restriction = {
      bindingIdentity: spec.toolBindingIdentity,
      read: laneOrNothing(spec.read),
      write: laneOrNothing(spec.write),
      network: 'allow',
    }
    const invocation = {
      memberIdentity: FS_CONTRACT_IDENTITY.memberInstanceId,
      callId: `call-${spec.toolBindingIdentity}`,
      policyRevision: ceiling.revision,
      toolBindingIdentity: spec.toolBindingIdentity,
      approvedOnce: false,
    }
    const compiled = memberIoPolicy.compileEffectiveIo(ceiling, restriction, invocation)
    if (compiled.ok !== true) {
      throw new Error(`compileEffectiveIo refused ${spec.toolBindingIdentity}: ${compiled.code} ${compiled.detail}`)
    }
    return Object.freeze({
      identity: FS_CONTRACT_IDENTITY,
      toolBindingIdentity: spec.toolBindingIdentity,
      effective: compiled.value,
      config: { cwd: dir, diffBasisMaxBytes: 10 * 1024 * 1024 },
    })
  })

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

  /**
   * The route gate's `llm` seam. Default is image-capable, so a refusal in the
   * legacy image arms is the LANE's; `llmModalities: ['text']` is what the route
   * gate's OWN refusal arm needs.
   */
  const llmResolutions = []
  const declaredModalities = [...llmModalities]
  class RecordingLlm extends Service {
    constructor(ctx) {
      super(ctx, 'llm')
    }

    async resolveModelInfo(provider, model) {
      llmResolutions.push({ provider, model })
      return { inputModalities: [...declaredModalities] }
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

  const fsInstances = []
  const InstrumentedFs = instrumentedFileSystemClass(LocalFileSystem, fsInstances)
  const realm = await row.mountMemberA5sfRealm({
    root: agent.ctx,
    a5sfConfig: row.a5sfRealmConfigOf({ a5sfEvidencePath: sinkPath }),
    provider: () => ({
      compiledFor: () => ({
        members: [{
          identity: FS_CONTRACT_IDENTITY,
          policy: { ok: true, value: ceiling },
          config: { cwd: dir, diffBasisMaxBytes: 10 * 1024 * 1024 },
        }],
        ...(compiledBindings.length === 0 ? {} : { bindings: compiledBindings }),
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
  } else if (composition === 'binding-post-gap-1') {
    // PROPOSED COMPOSITION (NOT the product route): the GAP-FS-CONTRACT-1
    // one-line inject merge applied to a BINDING realm's isolated ctx. It
    // exists only so `read_image` can be observed through a binding lane at
    // all; the product route's failure is pinned separately.
    if (realm.bindings.length === 0) throw new Error('binding-post-gap-1 needs at least one mounted binding')
    for (const binding of realm.bindings) {
      await deferredFsContext(binding.ctx).plugin(nativeToolModules)
    }
    await settleDeferred(() => root.get('tools').get('read_image', agentKey))
  } else {
    throw new Error(`unknown composition '${composition}'`)
  }

  const member = realm.installation.members[0]
  const provider = member.fs
  const bindingProviders = new Map(realm.bindings.map((binding) => [binding.toolBindingIdentity, binding.fs]))
  const routedDefinition = root.get('tools').get('read_image', agentKey)

  applyMutations(provider, fixtures, mutations)
  if (mutations.textOnlyRouteReportsImage === true) {
    // The route-gate mutant: a text-only route that claims image input. The gate
    // arm must go red, which is what makes it a gate assertion.
    const llm = root.get('llm')
    llm.resolveModelInfo = async () => ({ inputModalities: ['text', 'image'] })
  }
  if (mutations.silentAttachment === true) {
    // M4: the store answers the tool but records NOTHING, so an arm that only
    // checked "saveImage was called" would stay green. The attachment arm must
    // assert the materialised record itself. Conditional on the arm's OWN
    // fixture name, so the binding-image arm (a different file) stays green.
    const store = root.get('attachments')
    const originalSaveImage = store.saveImage.bind(store)
    store.saveImage = async (image) => {
      if (image.name !== 'pixel.png') return originalSaveImage(image)
      return {
        attachmentId: 'mutant-unrecorded',
        mediaType: image.mediaType,
        bytes: image.data.length,
        width: 1,
        height: 1,
      }
    }
  }

  const callsOf = (target) => ({ ...target.calls })
  const errorsOf = (target) => target.providerErrors.map((error) => ({ ...error }))

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
    ceiling,
    bindingProviders,
    /** The confined provider of one tool binding, or undefined when it was not mounted. */
    bindingProvider: (identity) => bindingProviders.get(identity),
    calls: () => callsOf(provider),
    callsOf,
    errorsOf,
    providerErrors: () => errorsOf(provider),
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
 * forwarded argument, under-reports a stat size, or forces the one flag the arm
 * under test claims — the regressions this face's forwarding is responsible for.
 *
 * The target-conditional mutants act ONLY on the fixture of their own arm, so a
 * control reds exactly that arm and never a sibling that happens to share the
 * same provider method.
 */
export function applyMutations(provider, fixtures, mutations = {}) {
  const hostPathOf = (target) => provider.processPath(target)
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
      if (hostPathOf(target) !== fixtures.big) return info
      return { ...info, size: 1 }
    }
  }
  if (mutations.forceReplaceIfVersion === true) {
    // CREATE-1's control: a create forced through the REPLACE guard. On a file
    // that does not exist the real provider then reports FS_STALE_VERSION, so
    // only the create arm reds — proving it pins the `createIfAbsent` path.
    const original = provider.writeText.bind(provider)
    provider.writeText = (target, content, expected, signal, policy) => {
      if (hostPathOf(target) !== fixtures.createNew) return original(target, content, expected, signal, policy)
      return original(target, content, { kind: 'replaceIfVersion', version: 'mutant:stale' }, signal, policy)
    }
  }
  if (mutations.dropWriteIntent === true) {
    // CREATE-3's control: the observation intent stops reaching the provider, so
    // the unobserved overwrite silently becomes an unconditional write.
    const original = provider.writeText.bind(provider)
    provider.writeText = (target, content, expected, signal, policy) => {
      if (hostPathOf(target) !== fixtures.unread) return original(target, content, expected, signal, policy)
      return original(target, content, undefined, signal, policy)
    }
  }
  if (mutations.forceReplaceAll === true || mutations.dropReplaceAll === true) {
    // The ambiguity pair's controls: the one flag the edit contract turns on.
    const force = mutations.forceReplaceAll === true
    const original = provider.editText.bind(provider)
    provider.editText = (target, edit, expected, signal, policy) => {
      if (hostPathOf(target) !== fixtures.multi) return original(target, edit, expected, signal, policy)
      return original(target, { ...edit, replaceAll: force }, expected, signal, policy)
    }
  }
  if (mutations.silentStreamAbort === true) {
    // The stream-abort control: the abort is swallowed and the partial stream
    // ends cleanly, so the tool would publish a truncated read as success.
    const original = provider.streamText.bind(provider)
    provider.streamText = async (target, signal) => {
      const stream = await original(target, signal)
      return (async function* silent() {
        try {
          yield* stream
        } catch (error) {
          if (error?.code === 'FS_ABORTED' || error?.name === 'AbortError') return
          throw error
        }
      })()
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

// ===========================================================================
// INCREMENT 2 — the five properties the previous round named as
// "neither layer proves, silently assumed".
// ===========================================================================

/**
 * FSB-CREATE-1 — `write` of a NEW file with the policy mounted: the
 * `createIfAbsent` path needs NO read and consults NO version.
 *
 * Upstream behaviour pinned:
 *   `fs-observation-policy/src/index.ts:65-71` — an unseen/confirmed-absent
 *   target yields `{ kind: 'createIfAbsent' }`, never a version.
 *   `fs-local/src/index.ts:202-242` — `writeText` probes once; the version
 *   guard is only evaluated for `replaceIfVersion` (`:214-219`), while
 *   `createIfAbsent` only checks that the file is ABSENT (`:220-223`). A
 *   non-existent file therefore has no version to compare and `writeFileAtomic`
 *   creates it.
 *   `team-services/src/fs.ts:114-153` — the Team guard's write⇒read check runs
 *   only when the target EXISTS, so a create in a WRITE lane that the READ lane
 *   does not cover still succeeds: "write does not imply read" is enforced on
 *   overwrite, not on create (the BL-38 shape at layer B).
 */
export async function armCreateNewFile(world) {
  const fixture = world.fixtures.createNew
  assert.equal(existsSync(fixture), false, 'the create fixture must not exist before the call')
  const before = world.facts().length
  const callsBefore = world.calls()
  world.provider.providerErrors.length = 0

  const created = await world.dispatch('write', { file_path: fixture, content: 'CREATED BY A5SF\n' }, { callId: 'fsb-create-new' })
  assert.equal(created.isError, false, `a create in the write lane must succeed: ${created.text}`)
  assert.match(created.text, /Created file/u, 'the operation is a CREATE, not an update')
  assert.equal(created.value?.operation, 'create', 'the structured outcome says create')
  assert.equal(readFileSync(fixture, 'utf8'), 'CREATED BY A5SF\n', 'the bytes really landed')

  assert.deepEqual(callDelta(callsBefore, world.calls()), {
    stat: 0, lstat: 0, readText: 0, streamText: 0, readBytes: 0, writeText: 1, editText: 0,
  }, 'exactly ONE writeText and NO read/stat: the create path neither reads nor probes a version through the provider')
  assert.deepEqual(world.providerErrors(), [], 'no version/no-observation error can exist on a create')

  const delta = factDelta(world, before)
  assert.deepEqual(delta.map((fact) => [fact.method, fact.decision, fact.decidedBy]), [
    ['writeText', 'allow', 'ALLOW'],
  ], 'the admission was consulted exactly once and ALLOWED — the create needs no read fact')
  assert.equal(delta[0].realm, 'member', 'no binding is involved; the ceiling realm admitted it')
  assertContiguous(world.facts())
}

/**
 * FSB-CREATE-2 — the refusal the create allow path is paired with: the SAME
 * write lane, an EXISTING target the READ (observation) lane does not cover.
 *
 * `team-services/src/fs.ts:124-153` — after the write lane allows, an existing
 * target additionally requires READ coverage; otherwise the Team guard throws
 * `IO_WRITE_REQUIRES_READ` BEFORE the provider runs. So "inside the allowed
 * lane but outside the observation allowance" behaves DIFFERENTLY for create
 * (allowed) and overwrite (refused). Exact provider call count: 0.
 */
export async function armOverwriteOutsideReadLane(world) {
  const fixture = world.fixtures.doc
  assert.equal(existsSync(fixture), true, 'the overwrite fixture must exist')
  const bytesBefore = readFileSync(fixture)
  const before = world.facts().length
  const callsBefore = world.calls()

  const refused = await world.dispatch('write', { file_path: fixture, content: 'BLIND OVERWRITE\n' }, { callId: 'fsb-create-refused' })
  assert.equal(refused.isError, true, 'an existing target outside the read lane must be refused')
  assert.match(refused.text, /write does not imply read/u, 'the typed reason is the write⇒read gate, not the lane')

  assert.deepEqual(callDelta(callsBefore, world.calls()), {
    stat: 0, lstat: 0, readText: 0, streamText: 0, readBytes: 0, writeText: 0, editText: 0,
  }, 'ZERO provider calls: the Team guard refused before super.writeText')
  assert.deepEqual(readFileSync(fixture), bytesBefore, 'the refused overwrite changed ZERO bytes')

  const delta = factDelta(world, before)
  assert.deepEqual(delta.map((fact) => [fact.method, fact.decision, fact.decidedBy]), [
    ['writeText', 'deny', 'IO_WRITE_REQUIRES_READ'],
  ], 'exactly ONE typed refusal, and it is the write⇒read gate')
  assert.equal(delta[0].realm, 'member')
  assertContiguous(world.facts())
}

/**
 * FSB-CREATE-3 — the OTHER refusal on the createIfAbsent path: the target
 * EXISTS, both lanes cover it, and it was never read. The policy's
 * `createIfAbsent` presence check (not a version compare) is what refuses.
 *
 * `fs-local/src/index.ts:220-223` — `createIfAbsent` onto an existing file
 * throws `FS_NOT_OBSERVED` ("a blind overwrite — require a read first");
 * `tool-fs/src/error.ts:23-29` replaces the provider wording with the stable
 * model-facing read remedy. The control half of the arm then READS the file and
 * the same write succeeds, so the refusal is identity ("not read"), not a
 * broken write path.
 */
export async function armOverwriteUnobservedExisting(world) {
  const fixture = world.fixtures.unread
  assert.equal(existsSync(fixture), true, 'the fixture must exist and be unread')
  const bytesBefore = readFileSync(fixture)
  const before = world.facts().length
  const callsBefore = world.calls()
  world.provider.providerErrors.length = 0

  const refused = await world.dispatch('write', { file_path: fixture, content: 'REPLACED WITHOUT READ\n' }, { callId: 'fsb-create-unobserved' })
  assert.equal(refused.isError, true, 'an unobserved overwrite must be refused')
  assert.match(refused.text, /file has not been read/u, 'the model-facing reason says the file was not read')
  assert.match(refused.text, /read the file, then retry/u, 'and gives the remedy')

  assert.deepEqual(callDelta(callsBefore, world.calls()), {
    stat: 0, lstat: 0, readText: 0, streamText: 0, readBytes: 0, writeText: 1, editText: 0,
  }, 'exactly ONE writeText provider call: the admission ALLOWED it and the provider\'s presence guard refused it')
  assert.deepEqual(world.providerErrors(), [{
    op: 'writeText',
    code: 'FS_NOT_OBSERVED',
    message: `cannot overwrite existing "${fixture}" without reading it first`,
  }], 'exactly ONE typed provider error, and it is FS_NOT_OBSERVED — NOT FS_STALE_VERSION')
  assert.deepEqual(readFileSync(fixture), bytesBefore, 'the refused overwrite changed ZERO bytes')
  assert.deepEqual(
    factDelta(world, before).map((fact) => [fact.method, fact.decision, fact.decidedBy]),
    [['writeText', 'allow', 'ALLOW']],
    'the admission was allowed (the policy/provider guard refuses, not the lane) — exactly one fact',
  )

  // CONTROL HALF: after the required read, the SAME write succeeds.
  world.provider.providerErrors.length = 0
  const read = await world.dispatch('read', { file_path: fixture }, { callId: 'fsb-create-unobserved-read' })
  assert.equal(read.isError, false, `the remediation read must succeed: ${read.text}`)
  const written = await world.dispatch('write', { file_path: fixture, content: 'REPLACED AFTER READ\n' }, { callId: 'fsb-create-unobserved-retry' })
  assert.equal(written.isError, false, `after the read the write must succeed: ${written.text}`)
  assert.match(written.text, /Updated file/u)
  assert.equal(readFileSync(fixture, 'utf8'), 'REPLACED AFTER READ\n', 'the remediated write published')
  assert.deepEqual(world.providerErrors(), [], 'the remediated write produced no provider error')
}

/** The fact fields a binding arm asserts: the narrow realm and its tool identity. */
function bindingFactShape(facts) {
  return facts.map((fact) => [fact.method, fact.decision, fact.decidedBy, fact.realm, fact.toolBindingIdentity])
}

/**
 * FSB-BIND-EDIT — `edit` under a BINDING realm (restriction strictly narrower
 * than the ceiling). The provider that serves the call is the BINDING realm's
 * confined provider (identity + call count), and a path the ceiling allows but
 * the binding excludes is refused with exactly ONE guard fact.
 *
 * Upstream/tool behaviour pinned: `tool-fs/src/edit.ts:127` asks for the intent,
 * `fs-local/src/index.ts:257-289` performs the guarded edit; the lane is the
 * compiled `EffectiveIo` of the binding realm (`install.ts:528-613`), i.e.
 * `ceiling ∩ restriction`, and `fs.ts:241-251` consults that guard on
 * `editText`.
 */
export async function armBindingEdit(world) {
  const identity = FS_CONTRACT_BINDINGS.edit
  const binding = world.bindingProvider(identity)
  assert.notEqual(binding, undefined, `the edit binding realm must be mounted (${identity})`)
  assert.notEqual(binding, world.provider, 'the binding realm has its OWN confined provider')

  // 1. ALLOWED through the narrower lane.
  const allowed = world.fixtures.boundEdit
  const readOk = await world.dispatch('read', { file_path: allowed }, { callId: 'fsb-bind-edit-read' })
  assert.equal(readOk.isError, false, `the setup read must succeed: ${readOk.text}`)
  const memberCallsBefore = world.calls()
  const bindingCallsBefore = world.callsOf(binding)
  const factsBefore = world.facts().length
  world.provider.providerErrors.length = 0
  const edited = await world.dispatch(
    'edit',
    { file_path: allowed, old_string: 'alpha beta', new_string: 'alpha delta' },
    { callId: 'fsb-bind-edit-allowed' },
  )
  assert.equal(edited.isError, false, `the in-binding edit must succeed: ${edited.text}`)
  assert.match(edited.text, /updated successfully/u)
  assert.equal(readFileSync(allowed, 'utf8'), 'alpha delta\n', 'the binding realm really wrote the file')
  assert.equal(callDelta(bindingCallsBefore, world.callsOf(binding)).editText, 1, 'the BINDING provider performed the edit')
  assert.equal(callDelta(memberCallsBefore, world.calls()).editText, 0, 'the CEILING provider did not serve the edit')
  assert.deepEqual(bindingFactShape(factDelta(world, factsBefore)), [
    ['editText', 'allow', 'ALLOW', 'binding', identity],
  ], 'exactly ONE fact, attributed to the binding realm and to the edit binding identity')

  // 2. REFUSED: the ceiling allows it, the binding restriction excludes it.
  const ceilingOnly = world.fixtures.doc
  const readDoc = await world.dispatch('read', { file_path: ceilingOnly }, { callId: 'fsb-bind-edit-read-doc' })
  assert.equal(readDoc.isError, false, `the ceiling-only setup read must succeed: ${readDoc.text}`)
  const bytesBefore = readFileSync(ceilingOnly)
  const refusedMemberCalls = world.calls()
  const refusedBindingCalls = world.callsOf(binding)
  const refusedAt = world.facts().length
  world.provider.providerErrors.length = 0

  const refused = await world.dispatch(
    'edit',
    { file_path: ceilingOnly, old_string: 'alpha beta', new_string: 'alpha delta' },
    { callId: 'fsb-bind-edit-refused' },
  )
  assert.equal(refused.isError, true, 'a path the binding excludes must be refused')
  assert.match(refused.text, /outside every allow subtree|IO_WRITE_DENIED/u, 'the binding lane\'s typed denial')
  assert.equal(callDelta(refusedBindingCalls, world.callsOf(binding)).editText, 0, 'ZERO binding provider calls')
  assert.equal(callDelta(refusedMemberCalls, world.calls()).editText, 0, 'ZERO ceiling provider calls')
  assert.deepEqual(readFileSync(ceilingOnly), bytesBefore, 'the refused edit changed ZERO bytes')
  assert.deepEqual(bindingFactShape(factDelta(world, refusedAt)), [
    ['editText', 'deny', 'IO_WRITE_DENIED', 'binding', identity],
  ], 'exactly ONE guard fact — no ceiling consultation was added to the binding decision')
}

/**
 * FSB-BIND-WRITE — the same two-sided property for `write`: the binding realm's
 * provider serves the in-lane write, and a ceiling-only path is refused by the
 * binding guard with exactly ONE fact.
 *
 * `team-services/src/fs.ts:226-239` consults the write axis on `writeText`;
 * `fs-local/src/index.ts:202-242` then applies the observation intent.
 */
export async function armBindingWrite(world) {
  const identity = FS_CONTRACT_BINDINGS.write
  const binding = world.bindingProvider(identity)
  assert.notEqual(binding, undefined, `the write binding realm must be mounted (${identity})`)
  assert.notEqual(binding, world.provider, 'the binding realm has its OWN confined provider')

  const allowed = world.fixtures.boundEdit
  const readOk = await world.dispatch('read', { file_path: allowed }, { callId: 'fsb-bind-write-read' })
  assert.equal(readOk.isError, false, `the setup read must succeed: ${readOk.text}`)
  const memberCallsBefore = world.calls()
  const bindingCallsBefore = world.callsOf(binding)
  const factsBefore = world.facts().length
  world.provider.providerErrors.length = 0
  const written = await world.dispatch('write', { file_path: allowed, content: 'BOUND WRITE\n' }, { callId: 'fsb-bind-write-allowed' })
  assert.equal(written.isError, false, `the in-binding write must succeed: ${written.text}`)
  assert.match(written.text, /Updated file/u)
  assert.equal(readFileSync(allowed, 'utf8'), 'BOUND WRITE\n', 'the binding realm really published the write')
  assert.equal(callDelta(bindingCallsBefore, world.callsOf(binding)).writeText, 1, 'the BINDING provider performed the write')
  assert.equal(callDelta(memberCallsBefore, world.calls()).writeText, 0, 'the CEILING provider did not serve the write')
  assert.deepEqual(bindingFactShape(factDelta(world, factsBefore)), [
    ['writeText', 'allow', 'ALLOW', 'binding', identity],
  ], 'exactly ONE fact, attributed to the binding realm and to the write binding identity')

  const ceilingOnly = world.fixtures.doc
  const readDoc = await world.dispatch('read', { file_path: ceilingOnly }, { callId: 'fsb-bind-write-read-doc' })
  assert.equal(readDoc.isError, false, `the ceiling-only setup read must succeed: ${readDoc.text}`)
  const bytesBefore = readFileSync(ceilingOnly)
  const refusedMemberCalls = world.calls()
  const refusedBindingCalls = world.callsOf(binding)
  const refusedAt = world.facts().length
  world.provider.providerErrors.length = 0

  const refused = await world.dispatch('write', { file_path: ceilingOnly, content: 'BOUND ESCAPE\n' }, { callId: 'fsb-bind-write-refused' })
  assert.equal(refused.isError, true, 'a path the binding excludes must be refused')
  assert.match(refused.text, /outside every allow subtree|IO_WRITE_DENIED/u, 'the binding lane\'s typed denial')
  assert.equal(callDelta(refusedBindingCalls, world.callsOf(binding)).writeText, 0, 'ZERO binding provider calls')
  assert.equal(callDelta(refusedMemberCalls, world.calls()).writeText, 0, 'ZERO ceiling provider calls')
  assert.deepEqual(readFileSync(ceilingOnly), bytesBefore, 'the refused write changed ZERO bytes')
  assert.deepEqual(bindingFactShape(factDelta(world, refusedAt)), [
    ['writeText', 'deny', 'IO_WRITE_DENIED', 'binding', identity],
  ], 'exactly ONE guard fact — the binding realm is the only consulted guard')
}

/**
 * FSB-BIND-IMAGE — `read_image` under a BINDING realm. The product route cannot
 * reach it at all (GAP-FS-CONTRACT-1, see FSB-IMG-4b), so this arm runs the
 * PROPOSED `binding-post-gap-1` composition: the SAME real module mounted on the
 * binding realm's isolated ctx with the one-line `fs` inject merge. It is not a
 * product claim; it is the only host-free way to observe the binding lane on
 * this tool today, and it is labelled as such.
 *
 * `tool-fs/src/read-image.ts:258-273` — the tool's `stat` + `readBytes` both go
 * through `ctx.fs`, so the binding realm's guard decides both, in order.
 */
export async function armBindingReadImage(world) {
  const identity = FS_CONTRACT_BINDINGS.readImage
  const binding = world.bindingProvider(identity)
  assert.notEqual(binding, undefined, `the read_image binding realm must be mounted (${identity})`)
  assert.notEqual(binding, world.provider, 'the binding realm has its OWN confined provider')
  assert.notEqual(world.routedDefinition, world.presetDefinition, 'the binding-mounted read_image really shadows the preset definition')

  const allowed = world.fixtures.boundPixel
  const memberCallsBefore = world.calls()
  const bindingCallsBefore = world.callsOf(binding)
  const factsBefore = world.facts().length
  const savedBefore = world.attachments.saved.length
  const outcome = await world.dispatch('read_image', { file_path: allowed }, { callId: 'fsb-bind-image-allowed' })
  assert.equal(outcome.isError, false, `the in-binding image read must succeed: ${outcome.text}`)
  assert.deepEqual(callDelta(bindingCallsBefore, world.callsOf(binding)), {
    stat: 1, lstat: 0, readText: 0, streamText: 0, readBytes: 1, writeText: 0, editText: 0,
  }, 'the BINDING provider performed exactly one stat + one readBytes')
  assert.deepEqual(callDelta(memberCallsBefore, world.calls()), {
    stat: 0, lstat: 0, readText: 0, streamText: 0, readBytes: 0, writeText: 0, editText: 0,
  }, 'the CEILING provider served NONE of the image read')
  assert.equal(world.attachments.saved.length, savedBefore + 1, 'exactly ONE attachment materialised')
  assert.deepEqual(bindingFactShape(factDelta(world, factsBefore)), [
    ['stat', 'allow', 'ALLOW', 'binding', identity],
    ['readBytes', 'allow', 'ALLOW', 'binding', identity],
  ], 'exactly the two provider reads, each admitted by the BINDING realm')

  const ceilingOnly = world.fixtures.pixel
  const refusedMemberCalls = world.calls()
  const refusedBindingCalls = world.callsOf(binding)
  const refusedAt = world.facts().length
  const savedAt = world.attachments.saved.length
  const bytesAt = world.attachments.saved.reduce((sum, ref) => sum + ref.bytes, 0)

  const refused = await world.dispatch('read_image', { file_path: ceilingOnly }, { callId: 'fsb-bind-image-refused' })
  assert.equal(refused.isError, true, 'a path the binding excludes must be refused')
  assert.match(refused.text, /outside every allow subtree|IO_READ_DENIED/u, 'the binding lane\'s typed denial')
  assert.deepEqual(callDelta(refusedBindingCalls, world.callsOf(binding)), {
    stat: 0, lstat: 0, readText: 0, streamText: 0, readBytes: 0, writeText: 0, editText: 0,
  }, 'ZERO binding provider reads')
  assert.deepEqual(callDelta(refusedMemberCalls, world.calls()), {
    stat: 0, lstat: 0, readText: 0, streamText: 0, readBytes: 0, writeText: 0, editText: 0,
  }, 'ZERO ceiling provider reads')
  assert.equal(world.attachments.saved.length, savedAt, 'no attachment was materialised')
  assert.equal(world.attachments.saved.reduce((sum, ref) => sum + ref.bytes, 0), bytesAt, 'ZERO attachment bytes')
  assert.deepEqual(bindingFactShape(factDelta(world, refusedAt)), [
    ['stat', 'deny', 'IO_READ_DENIED', 'binding', identity],
  ], 'exactly ONE guard fact — the binding realm refused, without a second consultation')
}

/**
 * FSB-EDIT-MULTI-1 — a multi-match `edit` WITHOUT `replace_all` is refused with
 * `FS_AMBIGUOUS_EDIT`, one provider call, and ZERO bytes changed.
 *
 * `fs-local/src/fsio.ts:818-833` — `applyLiteralEdit` counts occurrences,
 * throws `FS_AMBIGUOUS_EDIT` when `!replaceAll && replacements > 1`, and only
 * then writes; `fs-local/src/index.ts:276-283` calls it before
 * `writeFileAtomic`, so the refusal is atomic by construction.
 */
export async function armEditAmbiguous(world) {
  const fixture = world.fixtures.multi
  assert.equal(readFileSync(fixture, 'utf8'), 'tick tick tick\n', 'the fixture must carry three matches')
  const read = await world.dispatch('read', { file_path: fixture }, { callId: 'fsb-multi-read' })
  assert.equal(read.isError, false, `the setup read must succeed: ${read.text}`)
  const bytesBefore = readFileSync(fixture)
  const callsBefore = world.calls()
  const factsBefore = world.facts().length
  world.provider.providerErrors.length = 0

  const refused = await world.dispatch(
    'edit',
    { file_path: fixture, old_string: 'tick', new_string: 'tock' },
    { callId: 'fsb-multi-ambiguous' },
  )
  assert.equal(refused.isError, true, 'a multi-match edit without replace_all must be refused')
  assert.match(refused.text, /old_string matched 3 times/u, 'the refusal names the match count')
  assert.match(refused.text, /provide a more specific old_string or set replace_all to true/u, 'and the remedy')

  assert.deepEqual(world.providerErrors(), [{
    op: 'editText',
    code: 'FS_AMBIGUOUS_EDIT',
    message: `old_string matched 3 times in "${fixture}"; provide a more specific old_string or set replace_all to true`,
  }], 'exactly ONE typed provider error, and it is FS_AMBIGUOUS_EDIT')
  assert.equal(callDelta(callsBefore, world.calls()).editText, 1, 'exactly ONE editText provider call (no retry, no write)')
  assert.deepEqual(readFileSync(fixture), bytesBefore, 'the ambiguous edit changed ZERO bytes')
  assert.deepEqual(
    factDelta(world, factsBefore).map((fact) => [fact.method, fact.decision, fact.decidedBy]),
    [['editText', 'allow', 'ALLOW']],
    'the admission was allowed; the provider\'s literal-match guard is what refused',
  )

  // CONTROL HALF: the SAME read is still valid and `replace_all` succeeds.
  const replaced = await world.dispatch(
    'edit',
    { file_path: fixture, old_string: 'tick', new_string: 'tock', replace_all: true },
    { callId: 'fsb-multi-replace-all' },
  )
  assert.equal(replaced.isError, false, `the replace_all edit must succeed after the refused one: ${replaced.text}`)
  assert.match(replaced.text, /All occurrences were successfully replaced/u)
  assert.equal(readFileSync(fixture, 'utf8'), 'tock tock tock\n', 'replace_all replaced EVERY match')
  assert.equal(callDelta(callsBefore, world.calls()).editText, 2, 'one refused edit + one successful edit: exactly two editText calls')
}

/**
 * FSB-EDIT-MULTI-2 — the `replace_all` flag on the SAME multi-match fixture:
 * exactly ONE `editText` (one atomic write) and every occurrence replaced.
 *
 * `fs-local/src/fsio.ts:830-833` — with `replaceAll` the guard is skipped and
 * `content.split(old).join(new)` replaces all occurrences in one pass;
 * `fs-local/src/index.ts:279-281` writes that result exactly once.
 */
export async function armEditReplaceAll(world) {
  const fixture = world.fixtures.multi
  const read = await world.dispatch('read', { file_path: fixture }, { callId: 'fsb-replace-all-read' })
  assert.equal(read.isError, false, `the setup read must succeed: ${read.text}`)
  const callsBefore = world.calls()
  const factsBefore = world.facts().length
  world.provider.providerErrors.length = 0

  const replaced = await world.dispatch(
    'edit',
    { file_path: fixture, old_string: 'tick', new_string: 'tock', replace_all: true },
    { callId: 'fsb-replace-all' },
  )
  assert.equal(replaced.isError, false, `replace_all must succeed: ${replaced.text}`)
  assert.match(replaced.text, /All occurrences were successfully replaced/u)
  assert.equal(readFileSync(fixture, 'utf8'), 'tock tock tock\n', 'every occurrence was replaced')
  assert.equal(callDelta(callsBefore, world.calls()).editText, 1, 'exactly ONE editText: the whole file is one atomic write')
  assert.deepEqual(world.providerErrors(), [], 'no ambiguity error with replace_all')
  assert.deepEqual(
    factDelta(world, factsBefore).map((fact) => [fact.method, fact.decision]),
    [['editText', 'allow']],
    'one admitted editText',
  )
  assertContiguous(world.facts())
}

/** Resolve `/proc/self/fd` entries whose target is `path` (Linux). */
function openDescriptorsFor(path) {
  if (!existsSync('/proc/self/fd')) return null
  const hits = []
  for (const entry of readdirSync('/proc/self/fd')) {
    let target
    try {
      target = readlinkSync(join('/proc/self/fd', entry))
    } catch {
      continue
    }
    if (target === path || target === `${path} (deleted)`) hits.push({ fd: entry, target })
  }
  return hits
}

/**
 * FSB-READ-ABORT — cancelling a `streamText` read MID-STREAM yields the typed
 * abort, no success text, no leaked descriptor, and no partial window published
 * as a read result.
 *
 * `fs-local/src/fsio.ts:489-515` — `streamWholeText` iterates the real
 * `createReadStream` (created with the caller's signal) and maps a mid-stream
 * `AbortError` to `FsError('read aborted', 'FS_ABORTED')`; `:40-42`/`:54-56` are
 * the taxonomy and the pre-abort check. `tool-fs/src/read.ts:145-164` builds the
 * window and only THEN emits `fs/observed`, so an abort means no window and no
 * observation — the partial chunks never become a "complete" read.
 */
export async function armReadStreamAbort(world) {
  const fixture = world.fixtures.big
  const controller = new AbortController()
  const original = world.provider.streamText.bind(world.provider)
  let chunksConsumed = 0
  let abortFired = false
  world.provider.streamText = async (target, signal) => {
    const stream = await original(target, signal)
    return (async function* cancelling() {
      for await (const chunk of stream) {
        chunksConsumed += 1
        yield chunk
        if (!abortFired) {
          abortFired = true
          controller.abort()
        }
      }
    })()
  }

  const callsBefore = world.calls()
  const factsBefore = world.facts().length
  world.provider.providerErrors.length = 0
  let outcome
  try {
    outcome = await world.dispatch('read', { file_path: fixture }, { signal: controller.signal, callId: 'fsb-read-abort' })
  } finally {
    delete world.provider.streamText
    world.provider.streamText = original
  }

  assert.equal(abortFired, true, 'the abort really fired while the stream was open')
  assert.equal(chunksConsumed, 1, 'exactly one chunk was consumed: the cancellation is MID-STREAM, not pre-abort')
  assert.equal(outcome.isError, true, 'a cancelled read must be an error, never a partial success')
  assert.match(outcome.text, /read aborted/u, 'the typed abort reason reaches the caller')
  assert.equal(outcome.value, undefined, 'NO structured window is published for a cancelled read')
  assert.equal(/End of file|Output capped|<content>/u.test(outcome.text), false, 'no success/truncation envelope is reported')

  assert.deepEqual(world.providerErrors(), [{ op: 'streamText', code: 'FS_ABORTED', message: 'read aborted' }],
    'exactly ONE typed provider error, and it is FS_ABORTED')
  assert.deepEqual(callDelta(callsBefore, world.calls()), {
    stat: 1, lstat: 0, readText: 0, streamText: 1, readBytes: 0, writeText: 0, editText: 0,
  }, 'the tool stat-ed once and STREAMED once: it never fell back to buffering')
  assert.deepEqual(
    factDelta(world, factsBefore).map((fact) => [fact.method, fact.decision]),
    [['stat', 'allow'], ['streamText', 'allow']],
    'the admission was consulted for the reads it performed; there is no read-completion fact',
  )

  const leaked = openDescriptorsFor(fixture)
  if (leaked === null) {
    // Honest environment note rather than a silent pass: /proc is the only
    // host-free witness for an open descriptor count on this platform.
    process.stdout.write('A5SF-FS-CONTRACT-NOTE: /proc/self/fd unavailable; descriptor-leak half not measured\n')
  } else {
    // The stream's own teardown runs on the abort microtask chain; poll briefly.
    let open = leaked
    for (let attempt = 0; attempt < 100 && open.length > 0; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 5))
      open = openDescriptorsFor(fixture) ?? []
    }
    assert.deepEqual(open, [], 'the aborted stream leaked NO open descriptor on the fixture')
  }
}

/**
 * FSB-IMG-4a — `read_image`'s route gate on a TEXT-ONLY model: the refusal is
 * the tool's own, and it happens BEFORE any provider I/O or attachment write.
 *
 * `tool-fs/src/read-image.ts:119-130` — `assertImageCapableRoute` resolves the
 * calling route and throws when `inputModalities` omits `image`; `:256` calls it
 * before `:258` (resolve+stat) and `:263` (readBytes), so the ordering is a
 * property of the tool, not of the lane. The case runs under the proposed
 * post-GAP-1 composition ONLY because the product route cannot reach `execute`
 * at all (see FSB-IMG-4b).
 */
export async function armImageRouteGateTextOnly(world) {
  const fixture = world.fixtures.pixel
  const callsBefore = world.calls()
  const factsBefore = world.facts().length
  const savedBefore = world.attachments.saved.length
  const resolutionsBefore = world.llmResolutions.length

  const outcome = await world.dispatch('read_image', { file_path: fixture }, { callId: 'fsb-image-text-only' })
  assert.equal(outcome.isError, true, 'a text-only route must be refused')
  assert.match(outcome.text, /does not declare image input/u, 'the tool\'s own route-gate reason')
  assert.match(outcome.text, /switch to an image-capable model/u, 'and the remedy')

  assert.equal(world.llmResolutions.length, resolutionsBefore + 1, 'exactly ONE route resolution')
  assert.deepEqual(world.llmResolutions.at(-1), { provider: 'mock-provider', model: 'mock-model' },
    'the gate resolved the CALLING route, not a default')
  assert.deepEqual(callDelta(callsBefore, world.calls()), {
    stat: 0, lstat: 0, readText: 0, streamText: 0, readBytes: 0, writeText: 0, editText: 0,
  }, 'ZERO provider I/O: no stat, no readBytes')
  assert.equal(world.attachments.saved.length, savedBefore, 'ZERO attachments materialised')
  assert.equal(world.attachments.saved.reduce((sum, ref) => sum + ref.bytes, 0), 0, 'ZERO attachment bytes')
  assert.equal(factDelta(world, factsBefore).length, 0, 'ZERO guard facts: the lane was never consulted')
}

/**
 * FSB-IMG-4b — the SAME text-only route under the PRODUCT route (`route-c`).
 *
 * The round's premise was "the GAP makes this arm unreachable". MEASURED, it
 * does not — and that is the finding. The deferred child's undeclared `fs` is a
 * LAZY property access (`cannot get property "fs" without inject` happens only
 * when the body reaches `ctx.fs`), so `execute` runs and the route gate
 * (`read-image.ts:119-130`, called at `:256`) refuses BEFORE the first `ctx.fs`
 * access (`:258`). The GAP therefore blocks only the POSITIVE image path
 * (FSB-IMG-1 pins it with the inject text); the text-only refusal is fully
 * observable on the product route.
 *
 * This arm pins that ordering with a DISTINCT code from the GAP: a refusal here
 * is the gate's, and the inject fault must NOT appear. If a future composition
 * change makes the gate unreachable, the arm reds on the gate reason (never a
 * vacuous pass), and the GAP stays separately pinned by FSB-IMG-1.
 */
export async function armImageRouteGateUnderProductRoute(world) {
  const fixture = world.fixtures.pixel
  const callsBefore = world.calls()
  const factsBefore = world.facts().length
  const savedBefore = world.attachments.saved.length
  const resolutionsBefore = world.llmResolutions.length

  const outcome = await world.dispatch('read_image', { file_path: fixture }, { callId: 'fsb-image-text-only-product' })
  assert.equal(outcome.isError, true, 'a text-only route must be refused on the product route too')
  assert.match(outcome.text, /does not declare image input/u,
    'the TOOL route gate refused (TEXT-ONLY-GATE) — not the composition')
  assert.equal(/cannot get property "fs" without inject/u.test(outcome.text), false,
    `${A5SF_FS_CONTRACT_GAP} is a DISTINCT failure: the gate ran BEFORE the deferred child touched ctx.fs`)
  assert.equal(world.llmResolutions.length, resolutionsBefore + 1, 'exactly ONE route resolution on the product route')
  assert.deepEqual(callDelta(callsBefore, world.calls()), {
    stat: 0, lstat: 0, readText: 0, streamText: 0, readBytes: 0, writeText: 0, editText: 0,
  }, 'ZERO provider I/O: the refusal precedes resolve/stat/readBytes')
  assert.equal(world.attachments.saved.length, savedBefore, 'ZERO attachments materialised')
  assert.equal(factDelta(world, factsBefore).length, 0, 'ZERO guard facts: the lane was never consulted')

  // The POSITIVE path is what the GAP still blocks; this arm records the
  // distinction instead of implying the gate is unreachable.
  if (world.composition !== 'route-c') {
    throw new Error('FSB-IMG-4b must run on the product route (composition route-c)')
  }
}
