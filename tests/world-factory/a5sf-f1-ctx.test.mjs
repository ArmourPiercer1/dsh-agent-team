/**
 * a5sf-f1-ctx.test.mjs — F1 EFFECTIVE HALF (Alpha.5 P2 wiring, dated
 * 2026-11-03): the Member's TOOL PLANE is bound to the a5sf realm, so a
 * tool-invoked read is consulted by the confined guard and produces exactly one
 * `a5sf-guard-consult/1` fact in the transport sink.
 *
 * ZERO Host boots, ZERO ports bound, no DSH_HOME, no `tests/homes/**`, no
 * pristine host tree: the only Context created is an in-process Cordis unit
 * root, and every fixture/sink lives in a `mkdtemp` directory.
 *
 * Run: node --test tests/world-factory/a5sf-f1-ctx.test.mjs
 *
 * ROUTE (b) — what the arms prove, and what they deliberately do not:
 *   The mount installs the confined Provider into `root.isolate('fs', …)`
 *   (`team-services/src/install.ts:182`), so the Context handed in keeps the
 *   BASE provider. The product row therefore names the tool-plane scope with
 *   `a5sfToolPlaneOf()` and places the Member's tools on it (Team tool
 *   registrations + the governed plane), while routing the permission
 *   adapter's per-call fs seam through the SAME captured confined instance.
 *   These arms drive the REAL `mountMemberA5sfRealm` seam, the REAL
 *   `@deepseek-ai/dsh-tools` runtime (pre-policy → dispatch → result), and a
 *   tool definition of the SAME SHAPE a preset tool plugin has
 *   (`inject: ['tools','fs']`, body resolving the provider from the ctx it runs
 *   on).
 *
 *   F1-1  a5sfToolPlaneOf CONTRACT — `undefined` for a row with no realm; a
 *         loud TypeError for a malformed mount; otherwise a frozen
 *         `{ ctx, fs }` naming the realm's FIRST Member installation, where
 *         `fs` is the INSTALLED confined instance (captured, not a per-call
 *         `ctx.get`).
 *   F1-2  TOOL-INVOKED READ IS DENIED AND RECORDED — the tool-shaped
 *         definition placed on the tool-plane scope, dispatched through
 *         `ctx.tools.execute`, is refused with `IO_READ_DENIED` for a file
 *         outside the ceiling and the sink holds EXACTLY ONE
 *         `a5sf-guard-consult/1` fact for it (realm `member`, method
 *         `readText`, decision `deny`, the guard's own code in `decidedBy`).
 *   F1-3  CONTROL: THE SAME TOOL-SHAPED CALL THROUGH THE BASE PROVIDER IS
 *         ALLOWED AND WRITES NOTHING — the identical definition shape placed
 *         on the pre-F1 ctx (`agentCtx`) returns the file's text and adds ZERO
 *         facts. This is the discriminating pair: same call, same file, same
 *         registry, one authority changed.
 *   F1-4  the THREE-WAY SPLIT is measured, not asserted by comment: the agent
 *         ctx keeps the base provider, the tool-plane scope and the realm
 *         member ctx resolve the confined one, and the tool plane's `fs` IS
 *         the realm member's `fs` (one instance, no copy).
 *   F1-5  DEFAULT PATH — no realm ⇒ `a5sfToolPlaneOf(undefined) === undefined`,
 *         i.e. `toolPlaneCtx === agentCtx` / `toolPlaneFsBackend === fsBackend`
 *         for every unconfigured row; the read is allowed and no sink exists.
 *   F1-6  TEARDOWN (measured) — after the realm is disposed, a `ctx.get('fs')`
 *         lookup on the tool-plane scope answers `undefined` (the isolated
 *         label is gone AND it does not fall back to the base provider —
 *         fail-closed), while the CAPTURED instance the permission adapter
 *         holds still refuses. Stated so no reader over-claims teardown.
 *   F1-7  STRUCTURAL PIN — the glue call site (source) places the Team tools
 *         and the governed plane on `toolPlaneCtx`, uses `toolPlaneFsBackend`
 *         for all four permission-adapter reads, keeps the default-path
 *         ternaries, and leaves `presets.mount(agentCtx, …)` alone (the
 *         upstream preset registry mounts preset plugins under its own
 *         generation scope — see the module header of `a5sf-realm-row.mjs`).
 *   F1-8  NO FAIL-OPEN ON A MALFORMED REALM (review mutation M-g) — the glue
 *         does NOT wrap the naming call in try/catch (nor `??`/`||` it away),
 *         so a malformed mount RAISES instead of degrading to `undefined`
 *         (which would put the whole tool plane back on the base provider).
 *         Pinned both structurally (single call, clean window) and by replaying
 *         the glue's own expression.
 *   F1-9  THE PERMISSION ADAPTER, ROUTED, SHARES THE TOOL PLANE'S AUTHORITY
 *         (behavioural) — the accessor built from the glue's ternary returns
 *         the captured confined INSTANCE, its path algebra (`resolve`/
 *         `contains`, inherited from the base class and therefore un-guarded)
 *         still answers, and any EFFECT through it is the guarded one: an
 *         outside read is refused while an inside read succeeds on the base
 *         provider exactly once. See README §8.3 for what this does NOT prove
 *         (the four call sites' WIRING is structural-pin only).
 *
 * LIMITS (stated so no reader over-claims): this suite does NOT boot a Host,
 * does NOT run a live agent row, does NOT prove kernel/OS enforcement, and does
 * NOT prove the NATIVE preset `read` row is confined — the preset registry
 * eagerly mounts preset plugins under its own scope before any agent exists, so
 * that half is the P3 native takeover (BL-22), not this lane. The boot budget
 * is still 0.
 *
 * CORE PATCH BUDGET = 0. Nothing here touches `tests/deepseek-harness-test-use/`.
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

/** The helper under test — imported the way the glue imports it. */
const row = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs')).href)
/** `@deepseek-ai/cordis` + the REAL tool runtime are devDependencies of `packages/runtime` (pnpm strict). */
const runtimeRequire = createRequire(join(REPO_ROOT, 'packages', 'runtime', 'package.json'))
const { Context, Service } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href)
const ToolRuntime = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-tools')).href)).default
const SystemPrompt = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-system-prompt')).href)).default

// --- fixtures: a compiled-shaped Member ceiling + a narrower binding ---------

const IDENTITY = Object.freeze({
  teamId: 'team-a5sf-f1',
  memberInstanceId: 'member-f1-a',
  templateId: 'worker',
  instanceGeneration: 4,
})
const BINDING = 'dsh.fs/read'
const MEMBER_REVISION = 'a5sf1:member-f1-a:g4'
const BINDING_REVISION = 'a5sf1:member-f1-a:g4:dsh.fs/read'

function lane(allow) {
  return Object.freeze({ mode: 'restricted', allow: Object.freeze([...allow]), ask: Object.freeze([]), deny: Object.freeze([]) })
}

function memberPolicy(allowRoot) {
  return Object.freeze({
    memberIdentity: IDENTITY.memberInstanceId,
    templateId: IDENTITY.templateId,
    instanceGeneration: IDENTITY.instanceGeneration,
    revision: MEMBER_REVISION,
    read: lane([allowRoot]),
    write: lane([allowRoot]),
    network: Object.freeze({ access: 'allow' }),
  })
}

function effectivePolicy(allowRoot) {
  return Object.freeze({
    memberIdentity: IDENTITY.memberInstanceId,
    toolBindingIdentity: BINDING,
    invocationId: 'call-f1-1',
    policyRevision: BINDING_REVISION,
    read: lane([allowRoot]),
    write: lane([allowRoot]),
    network: Object.freeze({ access: 'allow' }),
  })
}

/** Count base-Provider reads so "the base Provider was asked" is measurable. */
const baseReads = { count: 0 }

/** The test Provider: a real Cordis Service over node:fs (unit-world double). */
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
    return { hostPath: path }
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
    return { lstat: { size: 0, mtimeMs: 0, mode: 0o644 } }
  }

  async lstat() {
    return { size: 0, mtimeMs: 0, mode: 0o644 }
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

function makeFixture(label) {
  const dir = mkdtempSync(join(tmpdir(), `a5sf-f1-${label}-`))
  const inside = join(dir, 'inside')
  mkdirSync(inside, { recursive: true })
  writeFileSync(join(inside, 'ok.txt'), 'ok\n', 'utf8')
  writeFileSync(join(dir, 'outside.txt'), 'outside\n', 'utf8')
  return { dir, inside, allowed: join(inside, 'ok.txt'), denied: join(dir, 'outside.txt') }
}

function tmpSink(label) {
  const dir = mkdtempSync(join(tmpdir(), `a5sf-f1-sink-${label}-`))
  return { dir, path: join(dir, 'consult.jsonl') }
}

const dirs = []
test.after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
})
function tracked(entry) {
  if (entry.dir !== undefined) dirs.push(entry.dir)
  return entry
}

/**
 * A TOOL-SHAPED definition: ONE plugin with the exact injection shape a preset
 * tool plugin has (`@deepseek-ai/dsh-tool-fs` is `inject: ['tools','fs',
 * 'systemPrompt']` and its read body calls `ctx.fs.resolve` / `ctx.fs.*Text`),
 * whose registered definition resolves the provider from the ctx it runs on.
 * Mounting it on the TOOL-PLANE scope is the whole point: the definition body
 * never names a provider, so the fs it gets is whatever its own ctx resolves.
 */
function toolShapedPlugin(toolName, filePath, seen) {
  return {
    name: `a5sf-f1-tool-${toolName}`,
    inject: ['tools', 'fs'],
    apply(ctx) {
      seen.constructor = ctx.get('fs').constructor.name
      ctx.effect(() => ctx.tools.register({
        name: toolName,
        description: 'a5sf F1 probe: a read tool body resolving fs from its own ctx',
        parameters: {
          type: 'object',
          properties: { filePath: { type: 'string' } },
          required: ['filePath'],
          additionalProperties: false,
        },
        output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: String(value) }] },
        execute: async (args) => {
          const fs = ctx.get('fs')
          const target = await fs.resolve(args.filePath)
          return await fs.readText(target)
        },
      }))
    },
  }
}

/** Dispatch one call through the REAL tool registry (the same path a model call takes). */
async function dispatch(root, toolName, filePath) {
  const settled = await root.tools.execute({
    signal: new AbortController().signal,
    callId: `a5sf-f1-${toolName}`,
    name: toolName,
    arguments: { filePath },
  })
  const text = Array.isArray(settled.content)
    ? settled.content.map((part) => (part?.type === 'text' ? part.text : '')).join('')
    : ''
  return { isError: settled.isError === true, text, value: settled.value }
}

function readFacts(sinkPath) {
  if (!existsSync(sinkPath)) return []
  return readFileSync(sinkPath, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line))
}

const compiledForFixture = (fixture) => () => ({
  compiledFor: () => ({
    members: [{ identity: IDENTITY, policy: { ok: true, value: memberPolicy(fixture.inside) } }],
    bindings: [{ identity: IDENTITY, toolBindingIdentity: BINDING, effective: effectivePolicy(fixture.inside) }],
    providerClass: TestFileSystem,
  }),
})

/** Mount the REAL product-row seam (the exact helper the live Member setup calls). */
async function mountRowRealm(agentCtx, fixture, sinkPath) {
  const a5sfConfig = row.a5sfRealmConfigOf({ a5sfEvidencePath: sinkPath })
  assert.ok(a5sfConfig !== undefined, 'the row config reader must yield the wiring block')
  const realm = await row.mountMemberA5sfRealm({
    root: agentCtx,
    a5sfConfig,
    provider: compiledForFixture(fixture),
    member: { sessionId: 'session-f1', instanceId: IDENTITY.memberInstanceId, teamRootSessionId: 'team-root', templateId: IDENTITY.templateId },
  })
  assert.ok(realm !== undefined, 'a configured row with a provider must mount a realm')
  return realm
}

// ===========================================================================
// F1-1 — the tool-plane scope contract
// ===========================================================================

test('F1-1 a5sfToolPlaneOf: absent realm is the legacy path; a malformed mount is loud; a real mount names ctx + captured fs', async () => {
  assert.equal(row.a5sfToolPlaneOf(undefined), undefined, 'no realm = no tool-plane scope (the unconfigured row)')
  assert.equal(row.a5sfToolPlaneOf(null), undefined)
  assert.throws(() => row.a5sfToolPlaneOf({}), TypeError, 'a mounted realm without a Member installation is a fault')
  assert.throws(() => row.a5sfToolPlaneOf({ installation: { members: [] } }), TypeError)
  assert.throws(() => row.a5sfToolPlaneOf({ installation: { members: [{ ctx: {}, fs: {} }] } }), TypeError)

  const root = await makeRoot()
  const fixture = tracked(makeFixture('contract'))
  const sink = tracked(tmpSink('contract'))
  const agentCtx = root.extend()
  const realm = await mountRowRealm(agentCtx, fixture, sink.path)
  try {
    const plane = row.a5sfToolPlaneOf(realm)
    assert.ok(Object.isFrozen(plane), 'the tool-plane scope is a frozen naming, not a mutable handle')
    assert.equal(plane.ctx, realm.installation.members[0].ctx, 'the scope IS the isolated Member realm ctx')
    assert.equal(plane.fs, realm.installation.members[0].fs, 'the fs is the INSTALLED confined instance (captured once)')
    assert.notEqual(plane.fs, root.get('fs'), 'the tool-plane fs is not the base provider')
  } finally {
    await realm.dispose()
  }
})

// ===========================================================================
// F1-2 / F1-3 — the discriminating pair: same tool shape, one authority changed
// ===========================================================================

test('F1-2 a tool-invoked read on the tool-plane scope is DENIED and writes exactly one a5sf-guard-consult/1 fact', async () => {
  const root = await makeRoot()
  const fixture = tracked(makeFixture('deny'))
  const sink = tracked(tmpSink('deny'))
  const agentCtx = root.extend()
  const realm = await mountRowRealm(agentCtx, fixture, sink.path)
  try {
    const plane = row.a5sfToolPlaneOf(realm)
    const seen = {}
    await plane.ctx.plugin(toolShapedPlugin('a5sf_f1_read', fixture.denied, seen))
    assert.equal(seen.constructor, 'TeamConfinedFileSystem', 'the tool BODY resolved the confined provider (the injection a preset tool uses)')

    const before = baseReads.count
    const outcome = await dispatch(root, 'a5sf_f1_read', fixture.denied)
    assert.equal(outcome.isError, true, 'the tool-invoked read is refused, never a pass-through')
    assert.match(outcome.text, /outside every allow subtree|IO_READ_DENIED/, 'the refusal is the guard\'s own decision')
    assert.ok(!outcome.text.includes('outside\n'), 'zero bytes of the denied file are disclosed')
    assert.equal(baseReads.count, before, 'the base Provider was NEVER asked for a denied call')

    const facts = readFacts(sink.path)
    assert.equal(facts.length, 1, `exactly one fact per consultation, got ${JSON.stringify(facts)}`)
    const [fact] = facts
    assert.equal(fact.schema, 'a5sf-guard-consult/1')
    assert.equal(fact.realm, 'member')
    assert.equal(fact.memberIdentity, IDENTITY.memberInstanceId)
    assert.equal(fact.toolBindingIdentity, null, 'the ceiling realm answers with a null tool binding')
    assert.equal(fact.method, 'readText')
    assert.equal(fact.decision, 'deny')
    assert.equal(fact.decidedBy, 'IO_READ_DENIED')
    assert.equal(fact.locator, fixture.denied)
    assert.equal(fact.sequence, 1)
  } finally {
    await realm.dispose()
  }
})

test('F1-3 CONTROL: the same tool-shaped call through the BASE provider is allowed and writes nothing', async () => {
  const root = await makeRoot()
  const fixture = tracked(makeFixture('control'))
  const sink = tracked(tmpSink('control'))
  const agentCtx = root.extend()
  const realm = await mountRowRealm(agentCtx, fixture, sink.path)
  try {
    // The SAME definition shape, placed on the PRE-F1 ctx (the agent row ctx).
    const seen = {}
    await agentCtx.plugin(toolShapedPlugin('a5sf_f1_read_base', fixture.denied, seen))
    assert.equal(seen.constructor, 'TestFileSystem', 'the control resolved the base provider, by construction')

    const before = baseReads.count
    const outcome = await dispatch(root, 'a5sf_f1_read_base', fixture.denied)
    assert.equal(outcome.isError, false, 'the base path allows the file (the pre-F1 behaviour, unchanged)')
    assert.equal(outcome.value, 'outside\n')
    assert.equal(baseReads.count, before + 1, 'the control read really went through the base provider exactly once')
    assert.deepEqual(readFacts(sink.path), [], 'the control contributed ZERO facts — the sink only carries realm consultations')
  } finally {
    await realm.dispose()
  }
})

// ===========================================================================
// F1-4 — the three-way split, measured
// ===========================================================================

test('F1-4 three-way split: agent ctx = BASE, tool-plane scope = CONFINED, realm member ctx = CONFINED (one instance)', async () => {
  const root = await makeRoot()
  const fixture = tracked(makeFixture('split'))
  const sink = tracked(tmpSink('split'))
  const agentCtx = root.extend()
  const realm = await mountRowRealm(agentCtx, fixture, sink.path)
  try {
    const plane = row.a5sfToolPlaneOf(realm)
    const readThrough = async (ctx) => {
      try {
        const fs = ctx.get('fs')
        return `ALLOWED:${JSON.stringify(await fs.readText(await fs.resolve(fixture.denied)))}`
      } catch (error) {
        return String(error.code ?? error.message)
      }
    }
    assert.equal(agentCtx.get('fs').constructor.name, 'TestFileSystem')
    assert.equal(await readThrough(agentCtx), 'ALLOWED:"outside\\n"', 'the agent ctx is UNCHANGED (the base provider)')
    assert.equal(plane.ctx.get('fs').constructor.name, 'TeamConfinedFileSystem')
    assert.equal(await readThrough(plane.ctx), 'IO_READ_DENIED', 'the tool-plane scope consults the confined guard')
    assert.equal(realm.installation.members[0].ctx.get('fs').constructor.name, 'TeamConfinedFileSystem')
    assert.equal(await readThrough(realm.installation.members[0].ctx), 'IO_READ_DENIED')
    assert.equal(plane.fs, realm.installation.members[0].fs, 'the plane and the realm share ONE confined instance (no copy, no second mount)')
    assert.equal(readFacts(sink.path).length, 2, 'the two realm-scope reads wrote one fact each')
  } finally {
    await realm.dispose()
  }
})

// ===========================================================================
// F1-5 — the default path (a row that never configures the realm)
// ===========================================================================

test('F1-5 DEFAULT PATH: no realm ⇒ no tool-plane scope ⇒ the tool plane stays the agent ctx and writes nothing', async () => {
  const root = await makeRoot()
  const fixture = tracked(makeFixture('default'))
  const agentCtx = root.extend()
  try {
    const plane = row.a5sfToolPlaneOf(undefined)
    assert.equal(plane, undefined)
    // The glue's ternaries, verbatim: toolPlaneCtx === agentCtx, toolPlaneFsBackend === fsBackend.
    const toolPlaneCtx = plane === undefined ? agentCtx : plane.ctx
    assert.equal(toolPlaneCtx, agentCtx)

    const seen = {}
    await toolPlaneCtx.plugin(toolShapedPlugin('a5sf_f1_read_default', fixture.denied, seen))
    const outcome = await dispatch(root, 'a5sf_f1_read_default', fixture.denied)
    assert.equal(outcome.isError, false)
    assert.equal(outcome.value, 'outside\n', 'the unconfigured row keeps the pre-F1 read path byte-identically')
    assert.equal(seen.constructor, 'TestFileSystem')
    assert.equal(existsSync(join(fixture.dir, 'consult.jsonl')), false, 'no sink is created on the default path')
  } finally {
    // The unit root is in-process and never boots anything; the fixtures are
    // removed by the after() hook.
  }
})

// ===========================================================================
// F1-6 — teardown window, measured (a disclosure, not a guarantee)
// ===========================================================================

test('F1-6 TEARDOWN: after dispose the scope lookup answers undefined (no BASE fallback), the CAPTURED instance still refuses', async () => {
  const root = await makeRoot()
  const fixture = tracked(makeFixture('teardown'))
  const sink = tracked(tmpSink('teardown'))
  const agentCtx = root.extend()
  const realm = await mountRowRealm(agentCtx, fixture, sink.path)
  const plane = row.a5sfToolPlaneOf(realm)
  assert.equal(plane.ctx.get('fs').constructor.name, 'TeamConfinedFileSystem')
  await realm.dispose()

  // Measured: the isolated provider fiber is gone and the isolated label no
  // longer resolves — the lookup answers `undefined`, it does NOT fall back to
  // the base provider (fail-closed). The row captures `plane.fs` so the
  // permission adapter is not exposed to this window at all.
  assert.equal(plane.ctx.get('fs'), undefined, 'no silent fallback to the base provider after the unmount')
  await assert.rejects(
    (async () => plane.fs.readText(await plane.fs.resolve(fixture.denied)))(),
    (error) => error.code === 'IO_READ_DENIED',
    'the CAPTURED confined instance keeps refusing after the unmount (no silent widening for the adapter path)',
  )
})

// ===========================================================================
// F1-7 — structural pin of the glue call site (source, not a live setup)
// ===========================================================================

test('F1-7 the glue places the Member tool plane on the realm scope and routes the adapter fs seam through it', () => {
  const source = readFileSync(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs'), 'utf8')
  const pins = [
    // P01-PLANE-REALM (2026-11-11) added three names to this SAME import: the
    // surface snapshot, the forwarded-name reader and the one admission
    // predicate. Additive again - the mount, the naming call and the disposer
    // are untouched; the pin tracks the import because the import is the claim.
    // ROUTE C (2026-11-03) added `attachA5sfNativeToolModules` to this SAME
    // import: the native shadow is attached AFTER the capability deny lane, on
    // the realm object this mount returns. Additive: the ONE mount, the naming
    // call and the safe disposer factory are unchanged.
    ["import { a5sfAgentToolSurface, a5sfAttachedToolNames, a5sfBindableRealmNames, a5sfRealmConfigOf, a5sfToolPlaneOf, attachA5sfNativeToolModules, createA5sfRealmRowDisposer, freshCreateHintAdmits, mountMemberA5sfRealm } from './a5sf-realm-row.mjs'", 'the tool-plane naming import'],
    ['a5sfToolPlane = a5sfToolPlaneOf(a5sfRealm)', 'the per-setup tool-plane assignment'],
    ['const toolPlaneCtx = a5sfToolPlane === undefined ? agentCtx : a5sfToolPlane.ctx', 'the default-path ternary (ctx)'],
    ['const toolPlaneFsBackend = a5sfToolPlane === undefined ? fsBackend : () => a5sfToolPlane.fs', 'the default-path ternary (fs)'],
    ['toolDisposers.push(toolPlaneCtx.tools.register(def))', 'the Team tools are placed on the tool-plane scope'],
    ['const placed = built.value.mount(toolPlaneCtx)', 'the governed plane mounts on the tool-plane scope'],
  ]
  for (const [needle, why] of pins) assert.ok(source.includes(needle), `${why}: missing \`${needle}\``)
  assert.equal(
    (source.match(/toolPlaneFsBackend\(agentCtx\)/g) ?? []).length,
    4,
    'all four permission-adapter fs reads (setup containment check, resolveTarget, containsTargets, containOverlayKeys) use the routed accessor',
  )
  assert.equal((source.match(/fsBackend\(agentCtx\)/g) ?? []).length, 0, 'no permission-adapter read is left on the unrouted accessor')
  assert.ok(source.includes('presets.mount(agentCtx,'), 'the preset mount stays on the agent ctx (the preset registry owns its plugin fibers — route (a) is not implementable here)')
})

// ===========================================================================
// F1-8 — a malformed realm must RAISE, never fail open (review mutation M-g)
// ===========================================================================

test('F1-8 the glue does NOT swallow a malformed-realm fault: no try/catch, no ?? / || fallback', () => {
  const source = readFileSync(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs'), 'utf8')
  const call = 'a5sfToolPlane = a5sfToolPlaneOf(a5sfRealm)'
  assert.equal(source.split(call).length - 1, 1, 'the naming call appears exactly once')
  const idx = source.indexOf(call)
  const window = source.slice(Math.max(0, idx - 400), idx + 300)
  // M-g: `try { a5sfToolPlane = a5sfToolPlaneOf(...) } catch { a5sfToolPlane = undefined }`
  // — or `?? undefined` / `|| undefined` on the same statement — would make a
  // MALFORMED mount fail OPEN: `undefined` means "no realm mounted", so the
  // whole tool plane (Team tools, governed plane, adapter seam) would silently
  // go back to the BASE provider. That is the regression this arm kills.
  assert.doesNotMatch(window, /\btry\b|\bcatch\b|\?\?|\|\|/, 'nothing may catch or default the naming call')
  // Behavioural replay of the SAME expression the glue evaluates: a malformed
  // mount raises out of the setup (which rolls the agent back) — it does not
  // become "no realm".
  const glueMapping = (realm) => row.a5sfToolPlaneOf(realm)
  assert.throws(() => glueMapping({ installation: { members: [] } }), TypeError)
  assert.throws(() => glueMapping({ installation: { members: [{ ctx: {}, fs: {} }] } }), TypeError)
  assert.throws(() => glueMapping({}), TypeError)
  assert.equal(glueMapping(undefined), undefined, 'the ONLY sanctioned `undefined` is "this row mounted no realm"')
})

// ===========================================================================
// F1-9 — the routed permission-adapter accessor, behavioured
// ===========================================================================

test('F1-9 the permission adapter, routed, canonicalizes AND effects on the tool plane\'s one provider', async () => {
  const root = await makeRoot()
  const fixture = tracked(makeFixture('adapter'))
  const sink = tracked(tmpSink('adapter'))
  const agentCtx = root.extend()
  const realm = await mountRowRealm(agentCtx, fixture, sink.path)
  try {
    const plane = row.a5sfToolPlaneOf(realm)
    // The pre-F1 accessor (host.ts `fsBackend`): the ctx's own provider.
    const fsBackend = (ctx) => ctx.get('fs')
    // The glue's EXACT ternary, replayed (agent-bindings.mjs).
    const toolPlaneFsBackend = plane === undefined ? fsBackend : () => plane.fs
    const routed = toolPlaneFsBackend(agentCtx)

    // (a) IDENTITY: the adapter's backend IS the captured confined instance,
    // not the live base service the row would otherwise resolve.
    assert.equal(routed, plane.fs)
    assert.notEqual(routed, root.get('fs'))
    assert.equal(routed.constructor.name, 'TeamConfinedFileSystem')

    // (b) CANONICALIZATION still answers: `resolve`/`contains` are INHERITED
    // from the base provider class (the confined class guards EFFECTS only), so
    // the adapter's path algebra keeps working — and consults no guard, which
    // is measured as "writes no fact". Routing them is therefore about ONE
    // authority, NOT about new refusals on the canonicalization path.
    const factsBefore = readFacts(sink.path).length
    const outsideTarget = await routed.resolve(fixture.denied)
    const insideTarget = await routed.resolve(fixture.allowed)
    const dirTarget = await routed.resolve(fixture.dir)
    assert.equal(outsideTarget.hostPath, fixture.denied)
    assert.equal(routed.contains(dirTarget, outsideTarget), true, 'subtree containment answers through the routed backend')
    assert.equal(routed.contains(insideTarget, outsideTarget), false, 'a narrower subtree excludes the outside file')
    assert.equal(readFacts(sink.path).length, factsBefore, 'resolve/contains are inherited path algebra: no consultation, no fact')

    // (c) EFFECT: the SAME instance the adapter canonicalizes against is the
    // guarded one — an outside read is refused, an inside read succeeds on the
    // base provider exactly once. Adapter and effect now share one authority.
    const before = baseReads.count
    await assert.rejects(routed.readText(outsideTarget), (error) => error.code === 'IO_READ_DENIED')
    assert.equal(baseReads.count, before, 'the denied adapter-path effect never reached the base provider')
    assert.equal(await routed.readText(insideTarget), 'ok\n')
    assert.equal(baseReads.count, before + 1)
    // The base path still allows the outside file: the split is the ROUTING,
    // not a global lockdown.
    assert.equal(await fsBackend(agentCtx).readText(outsideTarget), 'outside\n')
  } finally {
    await realm.dispose()
  }
})
