/**
 * a5sf-native-route-c.test.mjs — ROUTE C: the Member's isolated scope receives
 * the confined Provider AND the re-mounted NATIVE tool modules, so a
 * model-visible native `read` resolves the confined Provider.
 *
 * ZERO Host boots, ZERO ports, no DSH_HOME, no `tests/homes/**`, no pristine
 * host tree: every arm is an in-process Cordis unit root with `mkdtemp`
 * fixtures. CORE PATCH BUDGET = 0 — this suite never touches
 * `tests/deepseek-harness-test-use/`.
 *
 * WHAT THIS SUITE PINS, and what it does NOT:
 *   The upstream preset registry mounts a preset's tool rows under the preset's
 *   STANDING scope, which is an ANCESTOR of the agent scope
 *   (`createScope(registryCtx, generationKey)` + `bindScopeParent(agentKey,
 *   standingKey)`), so the definition the preset registers resolves the PRESET
 *   scope's `fs` (the base Provider). A registration made from the Member's
 *   isolated scope shadows it for THIS agent only, and its body resolves the
 *   confined Provider. The "native" tool module here is a fixture with the
 *   SHIPPED tool packages' injection shape (`inject: ['tools','fs',
 *   'systemPrompt']`, body resolving `ctx.fs`, a `tool:read` prompt section) —
 *   the real `@deepseek-ai/dsh-tool-fs` module is exercised by the probe in
 *   `dev/agent-workflow/evidence/a5sf-native-route-c/probe-route-c.mjs`, which
 *   is the measurement receipt for the real package.
 *
 *   N1  CONFIG READER — `a5sfNativeToolModules` absent ⇒ the block is
 *       byte-identical (no key); a valid list is frozen; a malformed list is a
 *       loud `TypeError` at row assembly.
 *   N2  ROUTE C CONFINEMENT (the discriminating pair) — before the realm mount
 *       the SAME native `read` is served by the BASE provider; after it, an
 *       outside read is REFUSED by the guard (`IO_READ_DENIED`), writes exactly
 *       ONE `a5sf-guard-consult/1` fact, and an inside read still succeeds. The
 *       model-visible surface is ONE `read` (shadowed, not duplicated) and ONE
 *       `tool:read` prompt section.
 *   N3  SURFACE-NEUTRAL OR REFUSED — a Member whose `builtinToolDeny` lane
 *       hides `read` (THE REAL `applyBuiltInToolDeny`) must NOT have it
 *       re-enabled by the re-mount: the attach is refused, no shadow remains,
 *       and the surface is unchanged.
 *   N4  TEARDOWN — disposing the realm removes the shadow (the preset's
 *       definition is visible again on the BASE provider): measured, so no
 *       reader over-claims that confinement survives the realm.
 *   N5  GLUE ORDER (the load-bearing arm) — the production glue attaches the
 *       shadow AFTER `applyBuiltInToolDeny` (structural pin of
 *       `agent-bindings.mjs`), and behaviorally: deny-then-attach refuses,
 *       while the REVERSE order measurably re-enables the denied tool. This
 *       arm is RED on the pre-fix head (the glue attached inside the realm
 *       mount, i.e. before the deny).
 *   N6  ONE MEMBER CEILING — `mountNativeToolModules` refuses a realm with two
 *       Member ceilings before registering anything (they share one scope key).
 *   N7  TEARDOWN ERRORS ARE REPORTED — a native fiber whose disposal throws
 *       rejects `realm.dispose()` (and the rest of the teardown still ran).
 *
 * Run: node --test tests/world-factory/a5sf-native-route-c.test.mjs
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
const { createScope, scopeOf, bindScopeParent } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-scope')).href)
/** The REAL capability mask adapter the product applies (packages/tools). */
const { applyBuiltInToolDeny } = await import('../../packages/tools/src/index.js')

// --- fixtures ---------------------------------------------------------------

const IDENTITY = Object.freeze({
  teamId: 'team-a5sf-route-c',
  memberInstanceId: 'member-route-c-a',
  templateId: 'worker',
  instanceGeneration: 1,
})
const MEMBER_REVISION = 'a5sf1:member-route-c-a:g1'

function lane(allow) {
  return Object.freeze({ mode: 'restricted', allow: Object.freeze([...allow]), ask: Object.freeze([]), deny: Object.freeze([]) })
}

function memberPolicy(allowRoot, memberInstanceId = IDENTITY.memberInstanceId) {
  return Object.freeze({
    memberIdentity: memberInstanceId,
    templateId: IDENTITY.templateId,
    instanceGeneration: IDENTITY.instanceGeneration,
    revision: MEMBER_REVISION,
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

  async readBytes(target) {
    baseReads.count += 1
    return readFileSync(this.processPath(target))
  }

  async readByteRange(target, range) {
    baseReads.count += 1
    return readFileSync(this.processPath(target)).subarray(range.offset, range.offset + range.length)
  }

  async streamText(target) {
    baseReads.count += 1
    const text = readFileSync(this.processPath(target), 'utf8')
    return (async function* stream() { yield text })()
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

const dirs = []
function tracked(entry) {
  if (entry.dir !== undefined) dirs.push(entry.dir)
  return entry
}

function makeFixture(label) {
  const dir = mkdtempSync(join(tmpdir(), `a5sf-route-c-${label}-`))
  dirs.push(dir)
  const inside = join(dir, 'inside')
  mkdirSync(inside, { recursive: true })
  writeFileSync(join(inside, 'ok.txt'), 'ok\n', 'utf8')
  writeFileSync(join(dir, 'outside.txt'), 'outside\n', 'utf8')
  return { dir, inside, allowed: join(inside, 'ok.txt'), denied: join(dir, 'outside.txt') }
}

function tmpSink(label) {
  const dir = mkdtempSync(join(tmpdir(), `a5sf-route-c-sink-${label}-`))
  dirs.push(dir)
  return { dir, path: join(dir, 'consult.jsonl') }
}

/**
 * The FIXTURE native tool module, written as a real file so the row helper's
 * module-specifier path is exercised end to end. Shape = a shipped tool
 * package: injects tools/fs/systemPrompt, registers a prompt section and a
 * tool whose body resolves `ctx.fs` from the ctx it runs on.
 */
function writeNativeModuleFixture(label, toolName = 'read') {
  const dir = mkdtempSync(join(tmpdir(), `a5sf-route-c-mod-${label}-`))
  dirs.push(dir)
  const file = join(dir, 'native-tool.mjs')
  writeFileSync(file, `
export const name = 'fixture-native-tool'
export const inject = ['tools', 'fs', 'systemPrompt']
export function apply(ctx) {
  ctx.systemPrompt.section({ name: 'tool:${toolName}', order: 50, text: 'fixture native guidance' })
  ctx.tools.register({
    name: ${JSON.stringify(toolName)},
    description: 'fixture native read tool',
    parameters: {
      type: 'object',
      properties: { file_path: { type: 'string' } },
      required: ['file_path'],
      additionalProperties: false,
    },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: String(value) }],
    },
    async execute(args) {
      const fs = ctx.get('fs')
      return await fs.readText(await fs.resolve(args.file_path))
    },
  })
}
`, 'utf8')
  return pathToFileURL(file).href
}

/** A native read registered on the PRESET standing scope (the preset's own row). */
function nativeToolPlugin(toolName, filePath) {
  return {
    name: `fixture-preset-${toolName}`,
    inject: ['tools', 'fs', 'systemPrompt'],
    apply(ctx) {
      ctx.systemPrompt.section({ name: `tool:${toolName}`, order: 50, text: 'preset native guidance' })
      ctx.tools.register({
        name: toolName,
        description: 'preset native read tool',
        parameters: {
          type: 'object',
          properties: { file_path: { type: 'string' } },
          required: ['file_path'],
          additionalProperties: false,
        },
        output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: String(value) }] },
        async execute(args) {
          const fs = ctx.get('fs')
          return await fs.readText(await fs.resolve(args.file_path))
        },
      })
    },
  }
}

/**
 * The preset topology, built with the registry's OWN primitives: a standing
 * scope for the preset rows, an agent scope whose parent is that standing key,
 * and the Agent instance as the agent's ScopeKey (`agent-loop/src/agent.ts`).
 */
function presetTopology(root) {
  const standingKey = {}
  const standing = createScope(root, standingKey)
  const agentKey = {}
  const agent = createScope(root, agentKey)
  bindScopeParent(agentKey, standingKey)
  return { standingKey, standing, agentKey, agentCtx: agent.ctx }
}

/**
 * Apply the REAL product deny adapter. `applyBuiltInToolDeny` reads `ctx.tools`,
 * which a bare Context cannot do ("cannot get property tools without inject"),
 * so apply it from a one-shot plugin — the same shape the product's setup has.
 */
async function applyRealDeny(agentCtx, names) {
  let disposer
  await agentCtx.plugin({
    name: 'route-c-real-deny',
    inject: ['tools'],
    apply(ctx) { disposer = applyBuiltInToolDeny(ctx, names) },
  })
  assert.equal(typeof disposer?.dispose, 'function', 'the real deny adapter returned its disposer')
  return () => disposer.dispose()
}

function compileForFixture(fixture) {
  return () => ({
    compiledFor: () => ({
      members: [{ identity: IDENTITY, policy: { ok: true, value: memberPolicy(fixture.inside) } }],
      providerClass: TestFileSystem,
    }),
  })
}

const toolNames = (root, scope) => root.tools.schemas(scope).map((schema) => schema.name)
const sectionNames = async (root, scope) =>
  (await root.systemPrompt.assemble({ scope })).sections.map((section) => section.name)

async function dispatch(root, agent, name, args) {
  const settled = await root.tools.execute({
    signal: new AbortController().signal,
    callId: `a5sf-route-c-${name}`,
    name,
    arguments: args,
    agent,
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

after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
})

// ===========================================================================
// N1 — config reader
// ===========================================================================
test('N1 config reader: native module list absent ⇒ block unchanged; valid ⇒ frozen; malformed ⇒ loud', () => {
  assert.equal(row.a5sfRealmConfigOf({}), undefined)

  const base = row.a5sfRealmConfigOf({ a5sfEvidencePath: '/tmp/e.jsonl' })
  assert.deepEqual(base, { evidencePath: '/tmp/e.jsonl' })
  assert.equal('nativeToolModules' in base, false, 'the pre-route-C block stays byte-identical')

  const withModules = row.a5sfRealmConfigOf({
    a5sfEvidencePath: '/tmp/e.jsonl',
    a5sfNativeToolModules: ['/abs/path/to/native-tool.mjs', { url: 'file:///x.mjs', config: { a: 1 } }],
  })
  assert.equal(Object.isFrozen(withModules), true)
  assert.equal(Object.isFrozen(withModules.nativeToolModules), true)
  assert.deepEqual(withModules.nativeToolModules, [{ url: '/abs/path/to/native-tool.mjs' }, { url: 'file:///x.mjs', config: { a: 1 } }])

  assert.deepEqual(
    row.a5sfRealmConfigOf({ a5sfEvidencePath: '/tmp/e.jsonl', a5sfNativeToolModules: [] }).nativeToolModules,
    [],
  )

  for (const bad of ['x', 42, {}, [''], [null], [42], [{ url: '' }], [{ url: 'x', config: 3 }]]) {
    assert.throws(
      () => row.a5sfRealmConfigOf({ a5sfEvidencePath: '/tmp/e.jsonl', a5sfNativeToolModules: bad }),
      (error) => error instanceof TypeError && /a5sfNativeToolModules/.test(error.message),
      `a5sfNativeToolModules=${JSON.stringify(bad)} must refuse at assembly`,
    )
  }
})

// ===========================================================================
// N2 — route C confinement (the discriminating pair)
// ===========================================================================
test('N2 route C: the native read on the isolated scope resolves the CONFINED provider (before: BASE)', async () => {
  const root = await makeRoot()
  const { standingKey, standing, agentKey, agentCtx } = presetTopology(root)
  const fixture = makeFixture('n2')
  const sink = tmpSink('n2')

  // The preset row, on its standing scope: the BASE-serving native definition.
  await standing.ctx.plugin(nativeToolPlugin('read', fixture.denied))

  const before = {
    names: toolNames(root, agentKey),
    sections: await sectionNames(root, agentKey),
    read: await dispatch(root, agentKey, 'read', { file_path: fixture.denied }),
  }
  assert.deepEqual(before.names, ['read'])
  assert.equal(before.read.isError, false, 'BEFORE the mount the native read is served by the base provider')
  assert.equal(before.read.value, 'outside\n')

  const a5sfConfig = row.a5sfRealmConfigOf({
    a5sfEvidencePath: sink.path,
    a5sfNativeToolModules: [writeNativeModuleFixture('n2')],
  })
  const realm = await row.mountMemberA5sfRealm({
    root: agentCtx,
    a5sfConfig,
    provider: compileForFixture(fixture),
    member: { sessionId: 'session-route-c', instanceId: IDENTITY.memberInstanceId, teamRootSessionId: 'team-root', templateId: IDENTITY.templateId },
  })
  try {
    assert.ok(realm !== undefined, 'a configured row with a provider must mount a realm')
    assert.equal(realm.installation.members.length, 1)
    // The realm mount alone does NOT create the native shadow (route C attaches
    // it after the capability deny lane); prove that, then attach.
    assert.deepEqual(toolNames(root, agentKey), ['read'], 'the mount alone leaves the preset row in place')
    await row.attachA5sfNativeToolModules(realm, agentCtx, a5sfConfig)

    const after = {
      names: toolNames(root, agentKey),
      sections: await sectionNames(root, agentKey),
      denied: await dispatch(root, agentKey, 'read', { file_path: fixture.denied }),
      allowed: await dispatch(root, agentKey, 'read', { file_path: fixture.allowed }),
    }

    assert.deepEqual(after.names, ['read'], 'ONE model-visible read: the isolated registration SHADOWS the preset definition')
    assert.equal(after.sections.filter((name) => name === 'tool:read').length, 1, 'ONE tool:read prompt section survives (shadowed, not duplicated)')

    assert.equal(after.denied.isError, true, 'the native read outside the ceiling is REFUSED')
    assert.match(after.denied.text, /outside every allow subtree|IO_READ_DENIED/)
    assert.ok(!after.denied.text.includes('outside\n'), 'zero bytes of the denied file are disclosed')

    assert.equal(after.allowed.isError, false, 'an inside read still succeeds')
    assert.equal(after.allowed.value, 'ok\n')

    assert.deepEqual(after.names, before.names, 'the model-visible surface is UNCHANGED by the re-mount')

    const facts = readFacts(sink.path)
    assert.equal(facts.length, 2, `one fact per consultation (deny, then allow), got ${JSON.stringify(facts)}`)
    assert.equal(facts[0].schema, 'a5sf-guard-consult/1')
    assert.equal(facts[0].realm, 'member')
    assert.equal(facts[0].method, 'readText')
    assert.equal(facts[0].locator, fixture.denied)
    assert.equal(facts[0].decision, 'deny')
    assert.equal(facts[0].decidedBy, 'IO_READ_DENIED')
    assert.equal(facts[0].sequence, 1)
    assert.equal(facts[1].locator, fixture.allowed)
    assert.equal(facts[1].decision, 'allow')
    assert.equal(facts[1].sequence, 2)
  } finally {
    await realm.dispose()
  }
})

// ===========================================================================
// N3 — surface-neutral or refused
// ===========================================================================
test('N3 surface neutrality: a builtinToolDeny-hidden native tool is NOT re-enabled — the attach is refused', async () => {
  const root = await makeRoot()
  const { standing, agentKey, agentCtx } = presetTopology(root)
  const fixture = makeFixture('n3')
  const sink = tmpSink('n3')

  await standing.ctx.plugin(nativeToolPlugin('read', fixture.denied))
  // THE REAL product adapter (packages/tools) — not a hand-rolled restrict.
  const denyDisposer = await applyRealDeny(agentCtx, ['read'])
  assert.deepEqual(toolNames(root, agentKey), [], 'CONTROL: the agent cannot see the denied native tool')

  const a5sfConfig = row.a5sfRealmConfigOf({
    a5sfEvidencePath: sink.path,
    a5sfNativeToolModules: [writeNativeModuleFixture('n3')],
  })
  const realm = await row.mountMemberA5sfRealm({
    root: agentCtx,
    a5sfConfig,
    provider: compileForFixture(fixture),
    member: { sessionId: 'session-route-c', instanceId: IDENTITY.memberInstanceId, teamRootSessionId: 'team-root', templateId: IDENTITY.templateId },
  })

  try {
    await assert.rejects(
      () => row.attachA5sfNativeToolModules(realm, agentCtx, a5sfConfig),
      (error) => error instanceof TypeError
        && /CHANGE the Member's model-visible tool surface/.test(error.message)
        && /"read"/.test(error.message),
      'the attach must refuse to widen the post-deny surface',
    )
    assert.deepEqual(toolNames(root, agentKey), [], 'the refused attach left NO shadow behind')
    assert.deepEqual(readFacts(sink.path), [], 'and no guarded call was ever served')
  } finally {
    denyDisposer()
    await realm.dispose()
  }
})

// ===========================================================================
// N4 — teardown
// ===========================================================================
test('N4 teardown: disposing the realm removes the shadow (the preset definition is visible again on BASE)', async () => {
  const root = await makeRoot()
  const { standing, agentKey, agentCtx } = presetTopology(root)
  const fixture = makeFixture('n4')
  const sink = tmpSink('n4')
  await standing.ctx.plugin(nativeToolPlugin('read', fixture.denied))

  const a5sfConfig = row.a5sfRealmConfigOf({
    a5sfEvidencePath: sink.path,
    a5sfNativeToolModules: [writeNativeModuleFixture('n4')],
  })
  const realm = await row.mountMemberA5sfRealm({
    root: agentCtx,
    a5sfConfig,
    provider: compileForFixture(fixture),
    member: { sessionId: 'session-route-c', instanceId: IDENTITY.memberInstanceId, teamRootSessionId: 'team-root', templateId: IDENTITY.templateId },
  })
  await row.attachA5sfNativeToolModules(realm, agentCtx, a5sfConfig)
  assert.equal((await dispatch(root, agentKey, 'read', { file_path: fixture.denied })).isError, true, 'confined while mounted')

  await realm.dispose()

  const afterDispose = await dispatch(root, agentKey, 'read', { file_path: fixture.denied })
  assert.equal(afterDispose.isError, false, 'after disposal the preset definition is back')
  assert.equal(afterDispose.value, 'outside\n', 'and it is the BASE provider again: confinement does NOT outlive the realm')
  assert.equal(scopeOf(agentCtx), agentKey, 'the agent scope key is untouched by the realm teardown')
})

// ===========================================================================
// N5 — THE GLUE ORDER (load-bearing): deny BEFORE the shadow
// ===========================================================================
test('N5 glue order: the production glue attaches the native shadow AFTER applyBuiltInToolDeny; the reverse order re-enables the denied tool', async () => {
  // --- structural half: the order in the ONE production glue -----------------
  const glue = readFileSync(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs'), 'utf8')
  const denyAt = glue.indexOf('applyBuiltInToolDeny(agentCtx, capabilities.builtinToolDeny)')
  const attachAt = glue.indexOf('await attachA5sfNativeToolModules(a5sfRealm, agentCtx, a5sfRowConfig)')
  assert.notEqual(denyAt, -1, 'the glue applies the capability deny lane')
  assert.notEqual(attachAt, -1, 'the glue attaches the native shadow through the row helper')
  assert.ok(
    denyAt < attachAt,
    'THE ORDER IS THE LOCK: the native shadow must be created AFTER the capability deny lane '
    + '(an own-scope registration is outside the inherited tools.restrict filter)',
  )
  assert.equal(
    glue.includes('nativeToolModules:'),
    false,
    'the realm mount must not create the shadow (no native modules on the mount input)',
  )

  // --- behavioral half: DENY then ATTACH (the fixed order) -------------------
  {
    const root = await makeRoot()
    const { standing, agentKey, agentCtx } = presetTopology(root)
    const fixture = makeFixture('n5a')
    const sink = tmpSink('n5a')
    await standing.ctx.plugin(nativeToolPlugin('read', fixture.denied))
    const denyDisposer = await applyRealDeny(agentCtx, ['read'])
    const a5sfConfig = row.a5sfRealmConfigOf({
      a5sfEvidencePath: sink.path,
      a5sfNativeToolModules: [writeNativeModuleFixture('n5a')],
    })
    const realm = await row.mountMemberA5sfRealm({
      root: agentCtx,
      a5sfConfig,
      provider: compileForFixture(fixture),
      member: { sessionId: 'session-route-c', instanceId: IDENTITY.memberInstanceId, teamRootSessionId: 'team-root', templateId: IDENTITY.templateId },
    })
    try {
      await assert.rejects(
        () => row.attachA5sfNativeToolModules(realm, agentCtx, a5sfConfig),
        /CHANGE the Member's model-visible tool surface/,
        'deny-then-attach: the attach refuses (a denied native tool can never be re-enabled)',
      )
      assert.equal(toolNames(root, agentKey).includes('read'), false, 'the denied native tool stays invisible')
      const call = await dispatch(root, agentKey, 'read', { file_path: fixture.denied })
      assert.equal(call.isError, true, 'and it stays unexecutable')
      assert.match(call.text, /unknown tool/)
    } finally {
      denyDisposer()
      await realm.dispose()
    }
  }

  // --- behavioral half: the REVERSE order (shadow, then deny) is UNSAFE ------
  // This is the measured fact that makes the order load-bearing: it is asserted
  // HERE so no reader can "simplify" the glue back to mount-then-deny.
  {
    const root = await makeRoot()
    const { standing, agentKey, agentCtx } = presetTopology(root)
    const fixture = makeFixture('n5b')
    const sink = tmpSink('n5b')
    await standing.ctx.plugin(nativeToolPlugin('read', fixture.denied))
    const a5sfConfig = row.a5sfRealmConfigOf({
      a5sfEvidencePath: sink.path,
      a5sfNativeToolModules: [writeNativeModuleFixture('n5b')],
    })
    const realm = await row.mountMemberA5sfRealm({
      root: agentCtx,
      a5sfConfig,
      provider: compileForFixture(fixture),
      member: { sessionId: 'session-route-c', instanceId: IDENTITY.memberInstanceId, teamRootSessionId: 'team-root', templateId: IDENTITY.templateId },
    })
    try {
      await row.attachA5sfNativeToolModules(realm, agentCtx, a5sfConfig) // shadow FIRST
      const denyDisposer = await applyRealDeny(agentCtx, ['read']) // deny SECOND
      try {
        assert.equal(toolNames(root, agentKey).includes('read'), true, 'REVERSE ORDER: the deny cannot hide an own-scope registration')
        const call = await dispatch(root, agentKey, 'read', { file_path: fixture.denied })
        assert.equal(call.isError, true, 'the shadow is still the CONFINED row (denied by the realm guard, not by the mask)')
        assert.match(call.text, /IO_READ_DENIED|outside every allow subtree/)
        assert.deepEqual(readFacts(sink.path).map((f) => f.decidedBy), ['IO_READ_DENIED'])
      } finally {
        denyDisposer()
      }
    } finally {
      await realm.dispose()
    }
  }
})

// ===========================================================================
// N6 — exactly one Member ceiling per agent scope
// ===========================================================================
test('N6 one ceiling: mountNativeToolModules refuses a two-Member realm before registering anything', async () => {
  const root = await makeRoot()
  const { standing, agentKey, agentCtx } = presetTopology(root)
  const fixture = makeFixture('n6')
  const sink = tmpSink('n6')
  await standing.ctx.plugin(nativeToolPlugin('read', fixture.denied))

  const second = Object.freeze({ ...IDENTITY, memberInstanceId: 'member-route-c-b' })
  const provider = () => ({
    compiledFor: () => ({
      members: [
        { identity: IDENTITY, policy: { ok: true, value: memberPolicy(fixture.inside) } },
        { identity: second, policy: { ok: true, value: memberPolicy(fixture.inside, second.memberInstanceId) } },
      ],
      providerClass: TestFileSystem,
    }),
  })
  const a5sfConfig = row.a5sfRealmConfigOf({
    a5sfEvidencePath: sink.path,
    a5sfNativeToolModules: [writeNativeModuleFixture('n6')],
  })
  const realm = await row.mountMemberA5sfRealm({
    root: agentCtx,
    a5sfConfig,
    provider,
    member: { sessionId: 'session-route-c', instanceId: IDENTITY.memberInstanceId, teamRootSessionId: 'team-root', templateId: IDENTITY.templateId },
  })
  try {
    assert.equal(realm.installation.members.length, 2, 'two Member ceilings mounted')
    await assert.rejects(
      () => realm.mountNativeToolModules([{ module: { name: 'x', apply() {} } }]),
      (error) => error?.code === 'SERVICE_MOUNT_FAILED' && /exactly one Member ceiling/.test(error.message),
      'two Member realms share one agent scope key: the native re-mount is refused',
    )
    assert.deepEqual(toolNames(root, agentKey), ['read'], 'the preset row is untouched (nothing was registered)')
  } finally {
    await realm.dispose()
  }
})

// ===========================================================================
// N7 — teardown errors are reported, and never shorten the teardown
// ===========================================================================
test('N7 teardown: a native fiber whose disposal throws REJECTS realm.dispose() (not swallowed) and the rest still runs', async () => {
  const root = await makeRoot()
  const { standing, agentKey, agentCtx } = presetTopology(root)
  const fixture = makeFixture('n7')
  const sink = tmpSink('n7')
  await standing.ctx.plugin(nativeToolPlugin('read', fixture.denied))

  const a5sfConfig = row.a5sfRealmConfigOf({
    a5sfEvidencePath: sink.path,
    a5sfNativeToolModules: [writeNativeModuleFixture('n7')],
  })
  const realm = await row.mountMemberA5sfRealm({
    root: agentCtx,
    a5sfConfig,
    provider: compileForFixture(fixture),
    member: { sessionId: 'session-route-c', instanceId: IDENTITY.memberInstanceId, teamRootSessionId: 'team-root', templateId: IDENTITY.templateId },
  })
  const fibers = await row.attachA5sfNativeToolModules(realm, agentCtx, a5sfConfig)
  assert.equal(fibers.length, 1)

  // Cordis SWALLOWS a disposable effect's own error inside `fiber.dispose()`
  // (documented in cordis fiber.ts: "_unload swallows its work errors"), so the
  // only honest way to drive this seam is a disposer that throws HERE.
  fibers[0].dispose = async () => { throw new Error('native dispose boom') }

  await assert.rejects(
    () => realm.dispose(),
    /native dispose boom/,
    'the teardown failure is REPORTED (the old code swallowed it)',
  )
  // ... and the rest of the teardown still ran: the confined provider is gone.
  let fsAfter
  try {
    fsAfter = realm.installation.members[0].ctx.get('fs')
  } catch {
    fsAfter = undefined
  }
  assert.equal(fsAfter, undefined, 'the confined Provider fiber was disposed despite the native teardown failure')
  assert.equal(scopeOf(agentCtx), agentKey)
})
