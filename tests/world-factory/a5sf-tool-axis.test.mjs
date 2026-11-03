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
 * WHAT THIS SUITE MEASURES (and why it is honest about the answer):
 *
 *   TA1 THE REALM TOPOLOGY — `mountA5sfRealm` mounts ONE realm per Member
 *       ceiling AND one realm per admitted ToolBinding. Both are addressable
 *       through the mount result (`realm.installation.members[0]` and
 *       `realm.bindings[i]`), each with its OWN isolated `ctx` and confined
 *       `fs`. The product row's ONE naming function for the execution scope
 *       (`a5sfToolPlaneOf`) names the MEMBER realm, never a binding realm.
 *
 *   TA2 THE SEAM (measured, not asserted by comment) — with the real native
 *       `read` re-mounted through the product attach (`attachA5sfNativeToolModules`
 *       -> `mountNativeToolModules`), a call the CEILING allows but the
 *       `read` TOOL RESTRICTION denies is **ALLOWED**, and the sink carries
 *       only Member-realm (`toolBindingIdentity: null`) allow facts. That is
 *       the missing half of the invariant, reproduced host-free.
 *
 *   TA3 CONTROL — a call allowed by BOTH factors is allowed, so TA2 is not an
 *       artefact of a broken read path.
 *
 *   TA4 THE MECHANISM ITSELF IS CORRECT — the compiled binding realm, driven
 *       directly, enforces the intersection: (a) ceiling allows + restriction
 *       denies => DENY; (b) ceiling denies + restriction allows (a restriction
 *       WIDER than the ceiling) => DENY after `compileEffectiveIo` intersects,
 *       so a restriction never widens; (c) both allow => allow. Each decision
 *       writes exactly ONE `a5sf-guard-consult/1` fact with realm `binding`
 *       and the binding identity, i.e. the sink needed for the live half
 *       already works per binding.
 *
 *   TA5 STRUCTURAL PIN — the attach targets `installation.members[0].ctx`
 *       (`mount.ts`) and no product source addresses `realm.bindings` for
 *       execution. This arm reads SOURCE; it pins the addressing fact that
 *       makes TA2 a design gap rather than a driver mistake.
 *
 * THE ANSWER THIS SUITE DOCUMENTS: the binding realm exists and is correct,
 * but the execution attach addresses the MEMBER realm only. A native tool
 * PACKAGE registers a whole tool suite over one Cordis context (the real
 * `dsh-tool-fs` registers read/write/edit/read_image), so mounting the module
 * into one binding realm would apply THAT binding's restriction to every
 * sibling tool — wrong for the siblings. The missing seam is per-TOOL
 * registration/execution routing, not a second policy compiler. See
 * `dev/agent-workflow/evidence/a5sf-tool-axis/README.md` for the proposal.
 *
 * LIMITS (stated so no reader over-claims): this suite does NOT boot a Host,
 * does NOT prove kernel/OS enforcement, and does NOT claim the leak is
 * acceptable. TA2's assertion encodes today's behaviour as a REGRESSION
 * SENTINEL: when the per-tool seam lands, TA2 must be inverted.
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

  async writeText() {
    return { version: 'v1' }
  }

  async editText() {
    return { version: 'v2' }
  }
}

/** One host-free unit root: system prompt + the REAL tool runtime + base fs. */
async function makeRoot() {
  const root = new Context()
  await root.plugin(SystemPrompt)
  await root.plugin(ToolRuntime)
  await root.plugin(TestFileSystem, {})
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
async function mountRealm({ root, ceiling, bindings = [], sinkPath }) {
  // The REAL preset topology the live Member row has: the native tool package
  // (the "preset" row) is mounted on a STANDING scope that is the PARENT of the
  // agent scope, exactly as `@deepseek-ai/dsh-agent-preset-registry` does. The
  // re-mounted shadow then registers into the AGENT's own layer, shadowing the
  // preset definition (the property route-C relies on), so the model-visible
  // surface is unchanged before/after and the attach's surface check passes.
  const standingKey = {}
  const standing = createScope(root, standingKey)
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

/** Dispatch one native call through the REAL tool registry (the model call path). */
async function dispatchRead(root, agentKey, filePath, callId = 'call-tool-axis-1') {
  const settled = await root.get('tools').execute({
    signal: new AbortController().signal,
    callId,
    agent: agentKey,
    name: 'read',
    arguments: { file_path: filePath },
  })
  const text = Array.isArray(settled.content)
    ? settled.content.map((part) => (part?.type === 'text' ? part.text : '')).join('')
    : ''
  return { isError: settled.isError === true, text, value: settled.value }
}

/** Read one locator through a mounted realm's OWN confined Provider (no tool runtime). */
async function readThrough(fs, filePath) {
  const target = await fs.resolve(filePath)
  return await fs.readText(target)
}

after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
})

// ===========================================================================
// TA1 — the realm topology and WHO the execution seam addresses
// ===========================================================================

test('TA1 one realm per Member AND one per ToolBinding; the product tool-plane naming addresses the MEMBER realm only', async () => {
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

    // The ONE execution-scope naming in the product row names the MEMBER realm.
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
// TA2 — THE SEAM: the live execution path ignores the tool restriction
// ===========================================================================

test('TA2 SEAM: a call the CEILING allows but the read RESTRICTION denies is ALLOWED by the native execution path (regression sentinel)', async () => {
  const root = await makeRoot()
  const fixture = makeFixture('seam')
  const sink = tmpSink('seam')
  const ceiling = memberPolicy(fixture.dir)
  const effective = compileBinding(ceiling, readRestriction(fixture.inside))
  const { realm, agentCtx, agentKey } = await mountRealm({ root, ceiling, bindings: [effective], sinkPath: sink.path })
  try {
    // The EXACT product attach the live Member setup calls (real native package).
    const fibers = await row.attachA5sfNativeToolModules(realm, agentCtx, row.a5sfRealmConfigOf({
      a5sfEvidencePath: sink.path,
      a5sfNativeToolModules: [BASELINE_TOOL_FS],
    }), agentKey)
    assert.equal(Array.isArray(fibers), true, 'the real native package was re-mounted into the Member scope')

    const before = baseReads.count
    const outcome = await dispatchRead(root, agentKey, fixture.ceilingOnly)
    assert.equal(outcome.isError, false, `TODAY the ceiling-only locator is served — the second axis is not consumed; got ${JSON.stringify(outcome.text)}`)
    assert.match(outcome.text, /CEILING_ONLY_CLAIM/, 'the denied-by-restriction bytes are returned to the model')
    assert.ok(baseReads.count > before, 'the native Provider served the call')

    const facts = readFacts(sink.path)
    assert.ok(facts.length > 0, 'the ceiling guard was consulted (the sink is live)')
    assert.equal(facts.every((f) => f.realm === 'member'), true, 'every fact is attributed to the MEMBER realm')
    assert.equal(facts.every((f) => f.toolBindingIdentity === null), true, 'no binding identity ever reaches the sink')
    assert.equal(facts.some((f) => f.realm === 'binding'), false, 'the mounted binding realm was never consulted')
    assert.equal(facts.some((f) => f.decision === 'deny'), false, 'nothing denied the ceiling-only call')
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
    await row.attachA5sfNativeToolModules(realm, agentCtx, row.a5sfRealmConfigOf({
      a5sfEvidencePath: sink.path,
      a5sfNativeToolModules: [BASELINE_TOOL_FS],
    }), agentKey)
    const outcome = await dispatchRead(root, agentKey, fixture.insideFile)
    assert.equal(outcome.isError, false)
    assert.match(outcome.text, /INSIDE_CLAIM/, 'the read path itself is healthy')
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
// TA5 — structural pin: WHERE the attach targets
// ===========================================================================

test('TA5 structural pin: the native attach targets installation.members[0].ctx and no product source addresses realm.bindings for execution', () => {
  const mountSource = readFileSync(join(REPO_ROOT, 'packages', 'runtime', 'team-services', 'src', 'mount.ts'), 'utf8')
  assert.match(
    mountSource,
    /const target = installation\.members\[0\]\?\.ctx/,
    'mountNativeToolModules targets the MEMBER realm ctx',
  )
  assert.doesNotMatch(
    mountSource,
    /bindings\[[^\]]*\]\??\.ctx/,
    'mount.ts never mounts a native module into a binding realm',
  )

  const rowSource = readFileSync(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs'), 'utf8')
  assert.match(rowSource, /const member = Array\.isArray\(members\) \? members\[0\] : undefined/, 'a5sfToolPlaneOf names members[0]')

  const glueSource = readFileSync(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs'), 'utf8')
  assert.doesNotMatch(glueSource, /\.bindings\b/, 'the product glue never reads the mounted binding realms')
  assert.match(glueSource, /attachA5sfNativeToolModules\(a5sfRealm, agentCtx/, 'the native attach is the ONE execution binding call')
})
