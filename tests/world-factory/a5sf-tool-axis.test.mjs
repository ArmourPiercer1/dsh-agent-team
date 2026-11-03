/**
 * a5sf-tool-axis.test.mjs — the SECOND AXIS of the Alpha.5 invariant:
 * `EffectiveIo(member,tool,call) ⊆ MemberCeiling(member) ∩ ToolRestriction(member,tool)`.
 *
 * ZERO Host boots, ZERO ports bound, no DSH_HOME, no `tests/homes/**`: the only
 * Context created is an in-process Cordis unit root, and every fixture/sink
 * lives in a `mkdtemp` directory. The native tool package is the REAL
 * `@deepseek-ai/dsh-tool-fs` loaded from the PINNED baseline checkout
 * (`tests/deepseek-harness-test-use`, 0.2.0-rc.2 @ 639ed01539), and the tool
 * calls are dispatched through the REAL `@deepseek-ai/dsh-tools` ToolRuntime
 * over the REAL P1/P2 installers (`mountA5sfRealm`).
 *
 * Run: node --test tests/world-factory/a5sf-tool-axis.test.mjs
 *
 * WHAT THIS SUITE MEASURES:
 *
 *   TA1 THE REALM TOPOLOGY — `mountA5sfRealm` mounts ONE realm per Member
 *       ceiling AND one realm per admitted ToolBinding. Both are addressable
 *       through the mount result (`realm.installation.members[0]` and
 *       `realm.bindings[i]`), each with its OWN isolated `ctx` and confined
 *       `fs`. The Member tool plane (`a5sfToolPlaneOf`) still names the MEMBER
 *       realm: the tool plane is the Team-tool surface, not the routing table.
 *
 *   TA2 THE INVARIANT, NATIVE PATH (S-1 landed 2026-11-03) — with the real
 *       native `read` re-mounted through the product attach, a call the CEILING
 *       allows but the `read` TOOL RESTRICTION denies is **REFUSED**, and the
 *       sink carries exactly ONE `a5sf-guard-consult/1` fact, attributed to the
 *       BINDING realm (`realm:"binding"`, `toolBindingIdentity:"dsh.fs/read"`).
 *       The definition that served/refused the call closes over the binding
 *       realm ctx, so `EffectiveIo` is the lane that ran — never recomputed,
 *       never widened.
 *
 *   TA3 CONTROL — a call allowed by BOTH factors is allowed, so TA2 is not an
 *       artefact of a broken read path.
 *
 *   TA4 THE MECHANISM ITSELF — the compiled binding realm, driven directly,
 *       enforces the intersection: (a) ceiling allows + restriction denies =>
 *       DENY; (b) ceiling denies + restriction allows (a restriction WIDER than
 *       the ceiling) => DENY after `compileEffectiveIo` intersects; (c) both
 *       allow => allow. Each decision writes exactly ONE fact with realm
 *       `binding` and the binding identity.
 *
 *   TA5 STRUCTURAL PIN — `mount.ts` routes a binding-targeted mount to the
 *       binding realm (`binding?.ctx ?? memberTarget`) behind a registration
 *       router, the row expands one mount per (module × binding) plus the
 *       ceiling mount, and NEITHER module evaluates a lane: no
 *       `compileEffectiveIo`, no second policy compiler.
 *
 *   TA6 SIBLINGS (the rejected S-3, inverted) — with `dsh.fs/read` restricted
 *       and `dsh.fs/write` NOT bound, `write` executes on the CEILING realm: a
 *       write inside the ceiling succeeds, a write outside is REFUSED by the
 *       ceiling, and NOT ONE fact carries the read binding's identity. The
 *       restriction of one tool never reaches its siblings.
 *
 *   TA7 NO WIDENING on the native path — ceiling denies + a WIDER tool
 *       restriction must still DENY: the binding realm's guard is the compiled
 *       intersection (`compileEffectiveIo`), so a restriction can never widen.
 *
 *   TA8 UNBOUND TOOL — a Member with NO mounted binding keeps today's
 *       behaviour: the ceiling fiber registers `read`, the call is served inside
 *       the ceiling, exactly one MEMBER-realm fact, surface unchanged (one
 *       `read`).
 *
 *   TA9 SURFACE NEUTRALITY PER FIBER — the fibers partition the module's
 *       surface (each name/section registered by exactly one fiber, the union
 *       equals the preset surface), and a configured module that WOULD change
 *       the model-visible surface makes the attach refuse and dispose every
 *       fiber it mounted (no `x_a5sf_extra`, no shadow, no fact).
 *
 *   TA10 TEARDOWN — disposing the realm disposes every router fiber BEFORE the
 *       confined providers, and an error in one fiber does not leave the others
 *       mounted (the sibling fiber is disposed and the preset definition comes
 *       back).
 *
 * S-2 IS NOT USED: no per-call multiplexer, no AsyncLocalStorage, and the
 * effect boundary is untouched (a tool body still receives only
 * `exec.signal`; TA5 pins the absence structurally). The only new authority is
 * "which mounted realm a tool name belongs to", and that answer is the
 * `toolBindingIdentity` P1 already compiled.
 *
 * LIMITS (stated so no reader over-claims): this suite does NOT boot a Host,
 * does NOT prove kernel/OS enforcement, and does NOT prove a model-visible turn.
 * The ceiling half is proven live in `dev/agent-workflow/evidence/a5sf-live-native3/`;
 * the per-fiber teardown half is host-free only (the live teardown seam is still
 * NOT_REACHED — see the evidence README for this lane).
 *
 * CORE PATCH BUDGET = 0. Nothing here touches `tests/deepseek-harness-test-use/`
 * (it is read only) and no package source is modified.
 */
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire, register } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test, { after } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..')

/** The repo's EXISTING TS-under-plain-node hooks (no new loader). */
register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)

/** The row helper (the product call site) and the ONE mount/transport seam. */
const row = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs')).href)
const transports = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'team-services', 'src', 'guard-observability.ts')).href)
/** The REAL P1 compiler (P1-02) — this suite never re-implements the intersection. */
const policy = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'member-io-policy', 'src', 'index.ts')).href)

/** `@deepseek-ai/cordis` + the real tool runtime are devDependencies of `packages/runtime`. */
const runtimeRequire = createRequire(join(REPO_ROOT, 'packages', 'runtime', 'package.json'))
const { Context, Service } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href)
const ToolRuntime = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-tools')).href)).default
const SystemPrompt = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-system-prompt')).href)).default
/** The SAME `@deepseek-ai/dsh-scope` instance the product glue uses (the Agent IS the scope key). */
const { bindScopeParent, createScope } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-scope')).href)

/** The PINNED baseline's own `@deepseek-ai/dsh-tool-fs` package entry. */
const BASELINE_TOOL_FS = join(REPO_ROOT, 'tests', 'deepseek-harness-test-use', 'packages', 'fs', 'tool-fs', 'lib', 'index.js')
assert.equal(
  existsSync(BASELINE_TOOL_FS),
  true,
  `the real native tool package must exist in the pinned baseline checkout (${BASELINE_TOOL_FS}); provision tests/deepseek-harness-test-use per docs/TEST_METHODS.md §1`,
)
const nativeToolModules = await import(pathToFileURL(BASELINE_TOOL_FS).href)

// ===========================================================================
// fixtures: a compiled Member ceiling + a STRICTLY NARROWER read restriction
// ===========================================================================

const IDENTITY = Object.freeze({
  teamId: 'team-a5sf-tool-axis',
  memberInstanceId: 'member-tool-axis-a',
  templateId: 'worker',
  instanceGeneration: 5,
})
const READ_BINDING = 'dsh.fs/read'
const MEMBER_REVISION = 'a5sf1:member-tool-axis-a:g5'
const BINDING_REVISION = `${MEMBER_REVISION}:${READ_BINDING}`

function lane(allow) {
  return Object.freeze({ mode: 'restricted', allow: Object.freeze([...allow]), ask: Object.freeze([]), deny: Object.freeze([]) })
}

function memberPolicy(readRoot, writeRoot = readRoot) {
  return Object.freeze({
    memberIdentity: IDENTITY.memberInstanceId,
    templateId: IDENTITY.templateId,
    instanceGeneration: IDENTITY.instanceGeneration,
    revision: MEMBER_REVISION,
    read: lane([readRoot]),
    write: lane([writeRoot]),
    network: Object.freeze({ access: 'allow' }),
  })
}

function readRestriction(readRoot) {
  return Object.freeze({
    bindingIdentity: READ_BINDING,
    read: lane([readRoot]),
    write: Object.freeze({ mode: 'all', allow: Object.freeze([]), ask: Object.freeze([]), deny: Object.freeze([]) }),
    network: 'allow',
  })
}

function invocationFor() {
  return Object.freeze({
    memberIdentity: IDENTITY.memberInstanceId,
    callId: 'call-tool-axis-1',
    policyRevision: MEMBER_REVISION,
    toolBindingIdentity: READ_BINDING,
    approvedOnce: false,
  })
}

/** Compile the intersection through the REAL P1-02 compiler; fail loudly on a refusal. */
function compileBinding(ceiling, restriction) {
  const effective = policy.compileEffectiveIo(ceiling, restriction, invocationFor())
  assert.equal(effective.ok, true, `compileEffectiveIo must admit this pair: ${JSON.stringify(effective)}`)
  return effective.value
}

/** The test Provider: a real Cordis Service over node:fs (unit-world double). */
const baseReads = { count: 0 }
const baseWrites = { count: 0 }

class TestFileSystem extends Service {
  constructor(ctx, config = {}) {
    super(ctx, 'fs')
    this.config = config
  }

  processPath(target) {
    return target.hostPath
  }

  contains(parent, child) {
    return this.processPath(child).startsWith(this.processPath(parent))
  }

  async resolve(path) {
    return { hostPath: path, displayPath: path }
  }

  async readText(target) {
    baseReads.count += 1
    return readFileSync(this.processPath(target), 'utf8')
  }

  async streamText(target) {
    const text = await this.readText(target)
    return (async function* stream() {
      yield text
    })()
  }

  async readBytes(target) {
    baseReads.count += 1
    return readFileSync(this.processPath(target))
  }

  async readByteRange(target, range) {
    baseReads.count += 1
    return readFileSync(this.processPath(target)).subarray(range.offset, range.offset + range.length)
  }

  async listDir() {
    return []
  }

  async stat() {
    return { type: 'file', size: 3, mtimeMs: 0, mode: 0o644 }
  }

  async lstat() {
    return { type: 'file', size: 3, mtimeMs: 0, mode: 0o644 }
  }

  async watch() {
    return async () => {}
  }

  async writeText(target, content) {
    baseWrites.count += 1
    const hostPath = this.processPath(target)
    const before = existsSync(hostPath) ? readFileSync(hostPath, 'utf8') : null
    return { operation: before === null ? 'create' : 'update', version: 'v1', before, after: String(content) }
  }

  async editText() {
    return { version: 'v2', before: '', after: '' }
  }
}

/**
 * A REAL-ish `attachments` service (the durable image store seam). Its presence
 * makes the pinned native `dsh-tool-fs` register `read_image` from a DEFERRED
 * `ctx.inject(['attachments'])` — the registration shape TA11 exists for.
 */
class TestAttachments extends Service {
  constructor(ctx) {
    super(ctx, 'attachments')
    this.saved = []
    this.imageLimits = {
      mediaTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
      maxImageBytes: 10_000_000,
      maxMessageImageBytes: 10_000_000,
      maxImageDimension: 8192,
      maxImagePixels: 40_000_000,
    }
  }

  async saveImage(image) {
    this.saved.push(image)
    return { id: `att-${this.saved.length}`, mediaType: image.mediaType, bytes: image.data?.length ?? 0 }
  }
}

/** One host-free unit root: system prompt + the REAL tool runtime + base fs. */
async function makeRoot({ attachments = false } = {}) {
  const root = new Context()
  await root.plugin(SystemPrompt)
  await root.plugin(ToolRuntime)
  await root.plugin(TestFileSystem, {})
  if (attachments) await root.plugin(TestAttachments)
  return root
}

const dirs = []
function trackedDir(dir) {
  dirs.push(dir)
  return dir
}

function makeFixture(label) {
  const dir = trackedDir(mkdtempSync(join(tmpdir(), `a5sf-axis-${label}-`)))
  const inside = join(dir, 'inside')
  mkdirSync(inside, { recursive: true })
  writeFileSync(join(inside, 'ok.txt'), 'INSIDE_CLAIM\n', 'utf8')
  // Inside the CEILING, outside the READ BINDING's subtree: the discriminating
  // locator for the second axis.
  writeFileSync(join(dir, 'ceiling-only.txt'), 'CEILING_ONLY_CLAIM\n', 'utf8')
  return { dir, inside, insideFile: join(inside, 'ok.txt'), ceilingOnly: join(dir, 'ceiling-only.txt') }
}

function tmpSink(label) {
  const dir = trackedDir(mkdtempSync(join(tmpdir(), `a5sf-axis-sink-${label}-`)))
  return { dir, path: join(dir, 'consult.jsonl') }
}

/** Read the product sink back (the append-only JSONL transport). */
function readFacts(sinkPath) {
  if (!existsSync(sinkPath)) return []
  return readFileSync(sinkPath, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line))
}

/** Mount the REAL product seam (the exact helper the live Member setup calls). */
async function mountRealm({ root, ceiling, bindings = [], sinkPath, attachments = false }) {
  // The REAL preset topology the live Member row has: the native tool package
  // (the "preset" row) is mounted on a STANDING scope that is the PARENT of the
  // agent scope, exactly as `@deepseek-ai/dsh-agent-preset-registry` does. The
  // re-mounted shadow then registers into the AGENT's own layer, shadowing the
  // preset definition (the property route-C relies on), so the model-visible
  // surface is unchanged before/after and the attach's surface check passes.
  const standingKey = {}
  const standing = createScope(root, standingKey)
  if (attachments) {
    // The preset world with an image store: the module's own `apply` defers
    // `read_image` behind `ctx.inject(['attachments'])`.
    await root.plugin(TestAttachments)
  }
  await standing.ctx.plugin(nativeToolModules)
  // The Agent IS the scope key upstream; the real `dsh-tool-fs` also reads
  // `exec.agent.session.header.cwd`, so the key carries a minimal session stub
  // (the identity is what the registry compares, the stub only satisfies the
  // native read path's cwd lookup).
  const agentKey = { session: { header: {} } }
  const agent = createScope(root, agentKey)
  bindScopeParent(agentKey, standingKey)
  const agentCtx = agent.ctx
  const sink = transports.createGuardConsultFileSink({ path: sinkPath })
  const realm = await row.mountMemberA5sfRealm({
    root: agentCtx,
    a5sfConfig: row.a5sfRealmConfigOf({ a5sfEvidencePath: sinkPath }),
    provider: () => ({
      compiledFor: () => ({
        members: [{ identity: IDENTITY, policy: { ok: true, value: ceiling } }],
        ...(bindings.length === 0 ? {} : { bindings: bindings.map((effective) => ({ identity: IDENTITY, toolBindingIdentity: READ_BINDING, effective })) }),
        providerClass: TestFileSystem,
      }),
    }),
    member: {
      sessionId: 'session-tool-axis',
      instanceId: IDENTITY.memberInstanceId,
      teamRootSessionId: 'team-root-tool-axis',
      templateId: IDENTITY.templateId,
    },
  })
  assert.notEqual(realm, undefined, 'a configured row with a provider must mount a realm')
  assert.equal(realm.bindings.length, bindings.length, 'one binding realm per admitted ToolBinding')
  return { realm, agentCtx, agentKey, sink }
}

/** Dispatch one tool call through the REAL registry (the model call path). */
async function dispatch(root, agentKey, name, args, callId = 'call-tool-axis-1') {
  const settled = await root.get('tools').execute({
    signal: new AbortController().signal,
    callId,
    agent: agentKey,
    name,
    arguments: args,
  })
  const text = Array.isArray(settled.content)
    ? settled.content.map((part) => (part?.type === 'text' ? part.text : '')).join('')
    : ''
  return { isError: settled.isError === true, text, value: settled.value }
}

const dispatchRead = (root, agentKey, filePath, callId) => dispatch(root, agentKey, 'read', { file_path: filePath }, callId)
const dispatchWrite = (root, agentKey, filePath, content, callId) => dispatch(root, agentKey, 'write', { file_path: filePath, content }, callId)

const toolNames = (root, agentKey) => root.get('tools').schemas(agentKey).map((schema) => schema.name)
const sectionNames = async (root, agentKey) =>
  (await root.get('systemPrompt').assemble({ scope: agentKey })).sections.map((section) => section.name)

/** The per-fiber routing receipt the mount seam publishes on every router fiber. */
const routingsOf = (fibers) => fibers.map((fiber) => fiber.a5sfRegistrationRouting)

/** Read one locator through a mounted realm's OWN confined Provider (no tool runtime). */
async function readThrough(fs, filePath) {
  const target = await fs.resolve(filePath)
  return await fs.readText(target)
}

/** Attach the REAL native package through the PRODUCT call and return its fibers. */
async function attach(realm, agentCtx, sinkPath, runtimeAgent = agentCtx) {
  return await row.attachA5sfNativeToolModules(realm, agentCtx, row.a5sfRealmConfigOf({
    a5sfEvidencePath: sinkPath,
    a5sfNativeToolModules: [BASELINE_TOOL_FS],
  }), runtimeAgent)
}

after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
})

// ===========================================================================
// TA1 — the realm topology and WHO the tool plane names
// ===========================================================================

test('TA1 one realm per Member AND one per ToolBinding; the Member tool plane still names the Member realm', async () => {
  const root = await makeRoot()
  const fixture = makeFixture('topology')
  const sink = tmpSink('topology')
  const ceiling = memberPolicy(fixture.dir)
  const effective = compileBinding(ceiling, readRestriction(fixture.inside))
  const { realm } = await mountRealm({ root, ceiling, bindings: [effective], sinkPath: sink.path })
  try {
    // Both kinds of realm really were mounted...
    assert.equal(realm.installation.members.length, 1, 'ONE Member ceiling realm')
    assert.equal(realm.bindings.length, 1, 'ONE realm for the admitted ToolBinding')
    const member = realm.installation.members[0]
    const binding = realm.bindings[0]

    // ...and both are addressable, with DISTINCT isolated providers.
    assert.notEqual(binding.ctx, member.ctx, 'the binding realm has its OWN isolated ctx')
    assert.notEqual(binding.fs, member.fs, 'the binding realm has its OWN confined fs instance')
    assert.equal(binding.toolBindingIdentity, READ_BINDING)
    assert.equal(binding.policyRevision, effective.policyRevision)

    // The Member TOOL PLANE (the Team-tool surface) still names the Member
    // realm; the per-TOOL routing is a separate, narrower answer (TA2).
    const plane = row.a5sfToolPlaneOf(realm)
    assert.equal(plane.ctx, member.ctx, 'a5sfToolPlaneOf names installation.members[0].ctx')
    assert.equal(plane.fs, member.fs)
    assert.notEqual(plane.ctx, binding.ctx, 'the tool plane is NOT the binding realm')

    // The binding realm's own lane is strictly narrower than the ceiling: this
    // is the pair the execution path has to consume.
    assert.deepEqual(Array.from(effective.read.allow), [fixture.inside], 'the compiled read lane IS the restriction subtree')
    assert.deepEqual(Array.from(ceiling.read.allow), [fixture.dir], 'the ceiling is wider than the restriction')
  } finally {
    await realm.dispose()
  }
})

// ===========================================================================
// TA2 — THE INVARIANT on the native path (S-1): restriction-denied is REFUSED
// ===========================================================================

test('TA2 INVARIANT: a call the CEILING allows but the read RESTRICTION denies is REFUSED by the native path, one binding fact', async () => {
  const root = await makeRoot()
  const fixture = makeFixture('seam')
  const sink = tmpSink('seam')
  const ceiling = memberPolicy(fixture.dir)
  const effective = compileBinding(ceiling, readRestriction(fixture.inside))
  const { realm, agentCtx, agentKey } = await mountRealm({ root, ceiling, bindings: [effective], sinkPath: sink.path })
  try {
    // The EXACT product attach the live Member setup calls (real native package).
    const fibers = await attach(realm, agentCtx, sink.path, agentKey)
    assert.equal(Array.isArray(fibers), true, 'the real native package was re-mounted into the Member scope')
    assert.equal(fibers.length, 2, 'ONE ceiling fiber + ONE fiber for the admitted read binding')

    const before = baseReads.count
    const outcome = await dispatchRead(root, agentKey, fixture.ceilingOnly)
    assert.equal(
      outcome.isError,
      true,
      `the ceiling-only locator must be REFUSED by the read binding's lane; got ${JSON.stringify(outcome.text)}`,
    )
    assert.match(outcome.text, /outside every allow subtree|IO_READ_DENIED/, 'the refusal is the guard\'s TYPED denial')
    assert.equal(outcome.text.includes('CEILING_ONLY_CLAIM'), false, 'zero bytes of the denied file reach the model')
    assert.equal(baseReads.count, before, 'the base Provider never served the refused call')

    const facts = readFacts(sink.path)
    assert.equal(facts.length, 1, `exactly ONE guard fact, got ${JSON.stringify(facts)}`)
    assert.equal(facts[0].schema, 'a5sf-guard-consult/1')
    assert.equal(facts[0].realm, 'binding', 'the fact is attributed to the BINDING realm')
    assert.equal(facts[0].toolBindingIdentity, READ_BINDING, 'the fact names the tool binding')
    assert.equal(facts[0].decision, 'deny')
    assert.equal(facts[0].decidedBy, 'IO_READ_DENIED')
    assert.equal(facts[0].locator, fixture.ceilingOnly)
  } finally {
    await realm.dispose()
  }
})

// ===========================================================================
// TA3 — control: both factors allow => the call passes
// ===========================================================================

test('TA3 CONTROL: a call allowed by BOTH the ceiling and the restriction is allowed', async () => {
  const root = await makeRoot()
  const fixture = makeFixture('control')
  const sink = tmpSink('control')
  const ceiling = memberPolicy(fixture.dir)
  const effective = compileBinding(ceiling, readRestriction(fixture.inside))
  const { realm, agentCtx, agentKey } = await mountRealm({ root, ceiling, bindings: [effective], sinkPath: sink.path })
  try {
    await attach(realm, agentCtx, sink.path, agentKey)
    const outcome = await dispatchRead(root, agentKey, fixture.insideFile)
    assert.equal(outcome.isError, false, `inside read failed: ${outcome.text}`)
    assert.match(outcome.text, /INSIDE_CLAIM/, 'the read path itself is healthy')
    const facts = readFacts(sink.path)
    assert.ok(facts.length > 0, 'the binding guard was consulted')
    assert.equal(facts.every((fact) => fact.realm === 'binding'), true, 'every fact is a binding fact')
    assert.equal(facts.some((fact) => fact.decision === 'deny'), false, 'nothing denied the inside read')
  } finally {
    await realm.dispose()
  }
})

// ===========================================================================
// TA4 — the binding realm mechanism enforces the intersection (a)(b)(c)
// ===========================================================================

test('TA4a ceiling allows + restriction denies => the binding realm DENIES with exactly one fact', async () => {
  const root = await makeRoot()
  const fixture = makeFixture('a')
  const sink = tmpSink('a')
  const ceiling = memberPolicy(fixture.dir)
  const effective = compileBinding(ceiling, readRestriction(fixture.inside))
  const { realm } = await mountRealm({ root, ceiling, bindings: [effective], sinkPath: sink.path })
  try {
    const before = baseReads.count
    await assert.rejects(
      () => readThrough(realm.bindings[0].fs, fixture.ceilingOnly),
      (error) => error.code === 'IO_READ_DENIED',
      'the ceiling-only locator is refused by the binding realm',
    )
    assert.equal(baseReads.count, before, 'the base Provider was never asked for the refused call')
    const facts = readFacts(sink.path)
    assert.equal(facts.length, 1, `exactly one fact, got ${JSON.stringify(facts)}`)
    assert.equal(facts[0].realm, 'binding')
    assert.equal(facts[0].toolBindingIdentity, READ_BINDING)
    assert.equal(facts[0].method, 'readText')
    assert.equal(facts[0].decision, 'deny')
    assert.equal(facts[0].decidedBy, 'IO_READ_DENIED')
    assert.equal(facts[0].locator, fixture.ceilingOnly)
  } finally {
    await realm.dispose()
  }
})

test('TA4b ceiling denies + a WIDER restriction allows => compileEffectiveIo intersects and the binding realm DENIES (no widening)', async () => {
  const root = await makeRoot()
  const fixture = makeFixture('b')
  const sink = tmpSink('b')
  // The ceiling covers ONLY `inside`; the tool binding is WIDER (the whole dir).
  const ceiling = memberPolicy(fixture.inside)
  const effective = compileBinding(ceiling, readRestriction(fixture.dir))
  assert.deepEqual(Array.from(effective.read.allow), [fixture.inside], 'the compiled lane is the ceiling side of the intersection, never the wider tool lane')
  const { realm } = await mountRealm({ root, ceiling, bindings: [effective], sinkPath: sink.path })
  try {
    await assert.rejects(
      () => readThrough(realm.bindings[0].fs, fixture.ceilingOnly),
      (error) => error.code === 'IO_READ_DENIED',
      'a wider tool restriction cannot widen the ceiling at runtime either',
    )
    const facts = readFacts(sink.path)
    assert.equal(facts.length, 1)
    assert.equal(facts[0].realm, 'binding')
    assert.equal(facts[0].decision, 'deny')
    assert.equal(facts[0].decidedBy, 'IO_READ_DENIED')
  } finally {
    await realm.dispose()
  }
})

test('TA4c both allow => the binding realm ALLOWS with exactly one fact', async () => {
  const root = await makeRoot()
  const fixture = makeFixture('c')
  const sink = tmpSink('c')
  const ceiling = memberPolicy(fixture.dir)
  const effective = compileBinding(ceiling, readRestriction(fixture.inside))
  const { realm } = await mountRealm({ root, ceiling, bindings: [effective], sinkPath: sink.path })
  try {
    const text = await readThrough(realm.bindings[0].fs, fixture.insideFile)
    assert.equal(text, 'INSIDE_CLAIM\n')
    const facts = readFacts(sink.path)
    assert.equal(facts.length, 1)
    assert.equal(facts[0].realm, 'binding')
    assert.equal(facts[0].toolBindingIdentity, READ_BINDING)
    assert.equal(facts[0].decision, 'allow')
    assert.equal(facts[0].decidedBy, 'ALLOW')
  } finally {
    await realm.dispose()
  }
})

// ===========================================================================
// TA5 — structural pins: WHERE the attach routes, and what it must NOT contain
// ===========================================================================

test('TA5 structural pin: a binding-targeted mount routes into the binding realm behind a registration router; no second compiler, no ALS', () => {
  const mountSource = readFileSync(join(REPO_ROOT, 'packages', 'runtime', 'team-services', 'src', 'mount.ts'), 'utf8')
  assert.match(
    mountSource,
    /const target = binding\?\.ctx \?\? memberTarget/,
    'a binding-targeted mount targets that binding realm; an unbound mount falls back to the Member ceiling',
  )
  assert.match(mountSource, /createRegistrationRouters\(/, 'registration is routed, not re-registered wholesale')
  assert.match(mountSource, /NATIVE_REGISTRATION_ROUTING/, 'the per-fiber partition is observable')
  assert.doesNotMatch(mountSource, /compileEffectiveIo/, 'the mount seam NEVER recompiles a lane (EffectiveIo is consumed, never recomputed)')
  assert.doesNotMatch(mountSource, /AsyncLocalStorage/, 'S-2 is not used: no call-scoped ambient tool identity')
  assert.doesNotMatch(mountSource, /\.execute\s*[=(]/, 'S-2 is not used: no per-call execute wrapper')

  const rowSource = readFileSync(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs'), 'utf8')
  assert.match(rowSource, /nativeToolMountsOf\(nativeToolModules, realm\)/, 'the row expands one mount per (module × binding) plus the ceiling mount')
  assert.match(rowSource, /uncoveredShadowedTools\(/, 'the row verifies COVERAGE by definition identity, not just the name set')
  assert.match(rowSource, /beforeDefinitions/, 'the coverage check compares against the pre-attach definitions')
  assert.match(rowSource, /toolBindingIdentity/, 'the expansion keys on the compiled binding identity')
  assert.doesNotMatch(rowSource, /AsyncLocalStorage/, 'S-2 is not used in the row either')
  assert.doesNotMatch(rowSource, /compileEffectiveIo/, 'the row does not compile a lane')

  const glueSource = readFileSync(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs'), 'utf8')
  assert.match(glueSource, /attachA5sfNativeToolModules\(a5sfRealm, agentCtx/, 'the native attach is the ONE execution binding call')
})

// ===========================================================================
// TA6 — siblings: a restriction never reaches the tools that are not bound
// ===========================================================================

test('TA6 SIBLINGS: with read restricted and write unbound, write runs on the CEILING realm and no read-lane fact appears', async () => {
  const root = await makeRoot()
  const fixture = makeFixture('siblings')
  const outsideDir = trackedDir(mkdtempSync(join(tmpdir(), 'a5sf-axis-outside-')))
  const sink = tmpSink('siblings')
  const ceiling = memberPolicy(fixture.dir)
  const effective = compileBinding(ceiling, readRestriction(fixture.inside))
  const { realm, agentCtx, agentKey } = await mountRealm({ root, ceiling, bindings: [effective], sinkPath: sink.path })
  try {
    const fibers = await attach(realm, agentCtx, sink.path, agentKey)
    const routing = routingsOf(fibers)
    const ceilingFiber = routing.find((entry) => entry.realm === 'ceiling')
    const readFiber = routing.find((entry) => entry.realm === 'binding')
    assert.deepEqual(readFiber.forwarded, ['read'], 'the binding fiber owns ONLY the read tool')
    assert.equal(ceilingFiber.forwarded.includes('write'), true, 'the ceiling fiber owns the UNBOUND write tool')
    assert.equal(ceilingFiber.forwarded.includes('read'), false, 'the ceiling fiber does not re-register the bound read tool')
    assert.equal(readFiber.forwarded.includes('write'), false, 'read\'s lane is never applied to write')

    // (1) A write INSIDE the ceiling succeeds on the CEILING lane.
    const factsBefore = readFacts(sink.path).length
    const inside = await dispatchWrite(root, agentKey, join(fixture.dir, 'created.txt'), 'CREATED\n', 'call-write-inside')
    assert.equal(inside.isError, false, `inside write failed: ${inside.text}`)
    const insideFacts = readFacts(sink.path).slice(factsBefore)
    assert.equal(insideFacts.length, 1, `one ceiling fact for the inside write, got ${JSON.stringify(insideFacts)}`)
    assert.equal(insideFacts[0].realm, 'member', 'write runs on the MEMBER ceiling realm')
    assert.equal(insideFacts[0].toolBindingIdentity, null, 'write carries no binding identity')
    assert.equal(insideFacts[0].decision, 'allow')

    // (2) A write OUTSIDE the ceiling is REFUSED BY THE CEILING.
    const factsBeforeDeny = readFacts(sink.path).length
    const outside = await dispatchWrite(root, agentKey, join(outsideDir, 'refused.txt'), 'NOPE\n', 'call-write-outside')
    assert.equal(outside.isError, true, 'a write outside the ceiling is refused')
    assert.match(outside.text, /outside every allow subtree|IO_WRITE_DENIED/, 'the ceiling\'s typed denial is the one reported')
    const denyFacts = readFacts(sink.path).slice(factsBeforeDeny)
    assert.equal(denyFacts.length, 1, `one ceiling fact for the refused write, got ${JSON.stringify(denyFacts)}`)
    assert.equal(denyFacts[0].realm, 'member', 'the refusal is the CEILING realm\'s')
    assert.equal(denyFacts[0].decidedBy, 'IO_WRITE_DENIED')

    // (3) NO read-lane fact ever appears for a write.
    const all = readFacts(sink.path)
    assert.equal(all.some((fact) => fact.toolBindingIdentity === READ_BINDING), false, 'not one fact carries the read binding identity')
    assert.equal(all.some((fact) => fact.realm === 'binding'), false, 'the read binding realm was never consulted by write')
    assert.equal(baseWrites.count, 1, 'only the inside write reached the base Provider')
  } finally {
    await realm.dispose()
  }
})

// ===========================================================================
// TA7 — no widening on the native path
// ===========================================================================

test('TA7 NO WIDENING: ceiling denies + a WIDER restriction allows => the native read is still DENIED on the binding lane', async () => {
  const root = await makeRoot()
  const fixture = makeFixture('widening')
  const sink = tmpSink('widening')
  // The ceiling covers ONLY `inside`; the tool binding is WIDER (the whole dir).
  const ceiling = memberPolicy(fixture.inside)
  const effective = compileBinding(ceiling, readRestriction(fixture.dir))
  assert.deepEqual(Array.from(effective.read.allow), [fixture.inside], 'the compiled lane is the ceiling side, never the wider tool lane')
  const { realm, agentCtx, agentKey } = await mountRealm({ root, ceiling, bindings: [effective], sinkPath: sink.path })
  try {
    await attach(realm, agentCtx, sink.path, agentKey)
    const before = baseReads.count
    const outcome = await dispatchRead(root, agentKey, fixture.ceilingOnly)
    assert.equal(outcome.isError, true, 'a wider tool restriction cannot widen the ceiling')
    assert.match(outcome.text, /outside every allow subtree|IO_READ_DENIED/)
    assert.equal(baseReads.count, before, 'the base Provider was never asked')
    const facts = readFacts(sink.path)
    assert.equal(facts.length, 1, `exactly one fact, got ${JSON.stringify(facts)}`)
    assert.equal(facts[0].realm, 'binding')
    assert.equal(facts[0].toolBindingIdentity, READ_BINDING)
    assert.equal(facts[0].decision, 'deny')
    assert.equal(facts[0].decidedBy, 'IO_READ_DENIED')
  } finally {
    await realm.dispose()
  }
})

// ===========================================================================
// TA8 — an unbound tool keeps the ceiling behaviour
// ===========================================================================

test('TA8 UNBOUND: a tool with no binding falls back to the ceiling realm (one read, one member fact, allowed)', async () => {
  const root = await makeRoot()
  const fixture = makeFixture('unbound')
  const sink = tmpSink('unbound')
  const ceiling = memberPolicy(fixture.dir)
  const { realm, agentCtx, agentKey } = await mountRealm({ root, ceiling, bindings: [], sinkPath: sink.path })
  try {
    const beforeSurface = toolNames(root, agentKey)
    const fibers = await attach(realm, agentCtx, sink.path, agentKey)
    assert.equal(fibers.length, 1, 'no binding realm means ONE ceiling fiber')
    const routing = routingsOf(fibers)[0]
    assert.equal(routing.realm, 'ceiling')
    assert.equal(routing.toolBindingIdentity, null)
    assert.deepEqual([...routing.forwarded].sort(), ['edit', 'read', 'write'], 'the ceiling fiber registers the whole suite')

    const afterSurface = toolNames(root, agentKey)
    assert.deepEqual(afterSurface, beforeSurface, 'the model-visible surface is unchanged')
    assert.equal(afterSurface.filter((name) => name === 'read').length, 1, 'exactly ONE read')

    const outcome = await dispatchRead(root, agentKey, fixture.ceilingOnly)
    assert.equal(outcome.isError, false, `an unbound tool runs on the ceiling lane: ${outcome.text}`)
    assert.match(outcome.text, /CEILING_ONLY_CLAIM/)
    const facts = readFacts(sink.path)
    assert.equal(facts.length, 2, `the ceiling lane is consulted for stat and readText, got ${JSON.stringify(facts)}`)
    assert.deepEqual(facts.map((fact) => fact.method), ['stat', 'readText'])
    assert.equal(facts.every((fact) => fact.realm === 'member'), true, 'the ceiling realm is the lane for an unbound tool')
    assert.equal(facts.every((fact) => fact.toolBindingIdentity === null), true)
    assert.equal(facts.every((fact) => fact.decision === 'allow'), true)
    assert.equal((await sectionNames(root, agentKey)).filter((name) => name === 'tool:read').length, 1, 'ONE tool:read prompt section')
  } finally {
    await realm.dispose()
  }
})

// ===========================================================================
// TA9 — surface neutrality per fiber, and refusal disposes what it mounted
// ===========================================================================

test('TA9a SURFACE PER FIBER: the fibers partition the module surface; the union is the preset surface exactly once', async () => {
  const root = await makeRoot()
  const fixture = makeFixture('surface')
  const sink = tmpSink('surface')
  const ceiling = memberPolicy(fixture.dir)
  const effective = compileBinding(ceiling, readRestriction(fixture.inside))
  const { realm, agentCtx, agentKey } = await mountRealm({ root, ceiling, bindings: [effective], sinkPath: sink.path })
  try {
    const beforeNames = toolNames(root, agentKey)
    const beforeSections = await sectionNames(root, agentKey)
    const fibers = await attach(realm, agentCtx, sink.path, agentKey)
    const routing = routingsOf(fibers)
    assert.equal(routing.length, 2, 'one ceiling fiber + one binding fiber')

    // Every name is forwarded by EXACTLY ONE fiber: the partition is disjoint...
    const forwarded = routing.flatMap((entry) => entry.forwarded)
    assert.equal(new Set(forwarded).size, forwarded.length, 'no tool name is registered by two fibers (the scope layer would collide)')
    // ...and its union IS the model-visible surface.
    assert.deepEqual([...new Set(forwarded)].sort(), [...beforeNames].sort(), 'the union of the fibers is the pre-mount surface')

    // The prompt sections follow their tools, one owner each.
    const sections = routing.flatMap((entry) => entry.forwardedSections)
    assert.equal(new Set(sections).size, sections.length, 'no prompt section is registered by two fibers')
    const afterSections = await sectionNames(root, agentKey)
    assert.deepEqual(afterSections.sort(), beforeSections.sort(), 'the prompt surface is unchanged')
    assert.equal(afterSections.filter((name) => name === 'tool:read').length, 1, 'exactly ONE tool:read section')
    assert.equal(afterSections.filter((name) => name === 'tool:write').length, 1, 'exactly ONE tool:write section')
  } finally {
    await realm.dispose()
  }
})

test('TA9b SURFACE REFUSAL: a module that would change the model-visible surface is refused and its fibers disposed', async () => {
  const root = await makeRoot()
  const fixture = makeFixture('surface-refusal')
  const sink = tmpSink('surface-refusal')
  const ceiling = memberPolicy(fixture.dir)
  // NO binding: this arm isolates the SURFACE gate (with a binding mounted, the
  // binding-targeted mount of the extra module would be refused earlier for a
  // different reason — that refusal is TA2's fail-closed check).
  const { realm, agentCtx, agentKey } = await mountRealm({ root, ceiling, bindings: [], sinkPath: sink.path })
  try {
    // A real second module that registers a NEW tool: the attach must refuse.
    const extraPath = join(sink.dir, 'extra-tool-module.mjs')
    writeFileSync(extraPath, [
      'export const name = "a5sf-extra-tool-probe"',
      'export const inject = ["tools"]',
      'export function apply(ctx) {',
      '  ctx.tools.register({',
      '    name: "x_a5sf_extra",',
      '    description: "surface-change probe",',
      '    parameters: {},',
      '    output: { schema: { type: "object", properties: {} }, render: () => [] },',
      '    async execute() { return {} },',
      '  })',
      '}',
      '',
    ].join('\n'), 'utf8')
    const beforeNames = toolNames(root, agentKey)
    const factsBefore = readFacts(sink.path).length
    const config = row.a5sfRealmConfigOf({
      a5sfEvidencePath: sink.path,
      a5sfNativeToolModules: [BASELINE_TOOL_FS, extraPath],
    })
    await assert.rejects(
      () => row.attachA5sfNativeToolModules(realm, agentCtx, config, agentKey),
      /would CHANGE the Member's model-visible tool surface/,
      'the configured module set must not add a tool',
    )
    assert.deepEqual(toolNames(root, agentKey), beforeNames, 'the surface is UNCHANGED after the refusal')
    assert.equal(toolNames(root, agentKey).includes('x_a5sf_extra'), false, 'the added tool never stays visible')
    assert.equal(readFacts(sink.path).length, factsBefore, 'the refusal wrote no fact')

    // "disposes what it mounted": no router fiber survives, so the preset
    // definition is the one that serves again (BASE provider, no guard fact).
    const definition = root.get('tools').get('read', agentKey)
    assert.notEqual(definition, undefined, 'the preset read row is still there')
    const readsBefore = baseReads.count
    const settled = await dispatchRead(root, agentKey, fixture.ceilingOnly, 'call-after-refusal')
    assert.equal(settled.isError, false, 'the base path still works')
    assert.ok(baseReads.count > readsBefore, 'the BASE provider served it: the shadow is gone')
    assert.equal(readFacts(sink.path).length, factsBefore, 'no new fact after the refused attach')
  } finally {
    await realm.dispose()
  }
})

// ===========================================================================
// TA10 — teardown: router fibers first, one failure never strands the rest
// ===========================================================================

test('TA10 TEARDOWN: router fibers are disposed before the confined providers, and one throwing fiber strands nothing', async () => {
  // --- structural half: the disposal ORDER (a swap is a silent fail-open) ----
  const mountSource = readFileSync(join(REPO_ROOT, 'packages', 'runtime', 'team-services', 'src', 'mount.ts'), 'utf8')
  const disposeBlock = mountSource.slice(mountSource.indexOf('dispose: async (): Promise<void> => {'))
  const nativeAt = disposeBlock.indexOf('await disposeNative()')
  const mountedAt = disposeBlock.indexOf('await disposeMounted()')
  const installAt = disposeBlock.indexOf('await installation.dispose()')
  assert.notEqual(nativeAt, -1, 'the realm dispose disposes the router fibers')
  assert.notEqual(mountedAt, -1, 'the realm dispose disposes the binding realms')
  assert.notEqual(installAt, -1, 'the realm dispose disposes the Member installation')
  assert.ok(nativeAt < mountedAt, 'router fibers BEFORE the binding realms')
  assert.ok(nativeAt < installAt, 'router fibers BEFORE the confined provider fiber')

  const root = await makeRoot()
  const fixture = makeFixture('teardown')
  const sink = tmpSink('teardown')
  const ceiling = memberPolicy(fixture.dir)
  const effective = compileBinding(ceiling, readRestriction(fixture.inside))
  const { realm, agentCtx, agentKey } = await mountRealm({ root, ceiling, bindings: [effective], sinkPath: sink.path })
  const presetRead = root.get('tools').get('read', agentKey)
  const fibers = await attach(realm, agentCtx, sink.path, agentKey)
  assert.equal(fibers.length, 2, 'ceiling + binding fiber')
  assert.notEqual(root.get('tools').get('read', agentKey), presetRead, 'the binding shadow owns read while mounted')

  // Cordis SWALLOWS a disposable effect's own error inside `fiber.dispose()`
  // (cordis fiber.ts: "_unload swallows its work errors"), so the only honest
  // way to drive this seam is a disposer that throws HERE.
  fibers[0].dispose = async () => { throw new Error('router dispose boom') }
  await assert.rejects(
    () => realm.dispose(),
    /router dispose boom/,
    'the teardown failure is REPORTED (never swallowed)',
  )
  // ... and the rest of the teardown still ran: the SIBLING fiber is disposed
  // and the confined Provider is gone.
  assert.equal(fibers[1].uid, null, 'the sibling fiber was disposed despite the failing one')
  let fsAfter
  try {
    fsAfter = realm.installation.members[0].ctx.get('fs')
  } catch {
    fsAfter = undefined
  }
  assert.equal(fsAfter, undefined, 'the confined Provider fiber was disposed despite the router teardown failure')
  assert.equal(root.get('tools').get('read', agentKey), presetRead, 'the preset definition is visible again: no shadow survives')
})

// ===========================================================================
// TA11 — DEFERRED registration (read_image) is refused, never silently on BASE
// ===========================================================================

test('TA11 DEFERRED: a module that registers read_image from ctx.inject([attachments]) is REFUSED, never left on the unshadowed preset path', async () => {
  const root = await makeRoot({ attachments: false })
  const fixture = makeFixture('deferred')
  const sink = tmpSink('deferred')
  const ceiling = memberPolicy(fixture.dir)
  const effective = compileBinding(ceiling, readRestriction(fixture.inside))
  // `attachments` is mounted for the agent world: the pinned module now really
  // registers `read_image` — from a DEFERRED `ctx.inject` child, after `apply`.
  const { realm, agentCtx, agentKey } = await mountRealm({ root, ceiling, bindings: [effective], sinkPath: sink.path, attachments: true })
  try {
    assert.equal(toolNames(root, agentKey).includes('read_image'), true, 'the preset world really exposes read_image')
    const presetReadImage = root.get('tools').get('read_image', agentKey)
    const presetRead = root.get('tools').get('read', agentKey)

    // THE ARM: the attach must refuse. Accepting would leave `read_image`
    // executing on the BASE provider with ZERO guard facts while every name
    // stayed equal (the leak the reviewer measured).
    await assert.rejects(
      () => attach(realm, agentCtx, sink.path, agentKey),
      (error) => {
        assert.match(
          error.message,
          /registers asynchronously|deferred registration/,
          `the refusal must name the deferred registration, got: ${error.message}`,
        )
        return true
      },
      'a module whose deferred registration cannot run inside the routed mount must be refused',
    )

    // Fail-closed, not fail-dirty: the surface is unchanged and the preset
    // definitions are the ones that remain — no half-mounted shadow survives.
    assert.deepEqual(toolNames(root, agentKey).sort(), ['edit', 'read', 'read_image', 'write'], 'the surface is restored exactly')
    assert.equal(root.get('tools').get('read', agentKey), presetRead, 'no shadow survives the refusal')
    assert.equal(root.get('tools').get('read_image', agentKey), presetReadImage, 'read_image is still the preset definition')
    assert.equal(readFacts(sink.path).length, 0, 'the refused attach wrote no guard fact')

    // The unshadowed path consults NOTHING: the preset `read` serves the
    // ceiling-only locator on the BASE provider and writes ZERO guard facts.
    // That is exactly the leak the refusal prevents from being the live path
    // (accepting the attach would have left read_image — and its siblings once a
    // deferred child errors — on this same unguarded definition).
    const outcome = await dispatchRead(root, agentKey, fixture.ceilingOnly, 'call-deferred-read')
    assert.equal(outcome.isError, false, `the preset path still runs: ${outcome.text}`)
    assert.match(outcome.text, /CEILING_ONLY_CLAIM/)
    assert.equal(readFacts(sink.path).length, 0, 'zero guard facts on the unshadowed path: this is exactly what the attach refuses to leave behind')
  } finally {
    await realm.dispose()
  }
})

// Keep the unused binding revision fixture referenced so a future arm can pin it.
void BINDING_REVISION
