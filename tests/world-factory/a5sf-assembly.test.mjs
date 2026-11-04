/**
 * a5sf-assembly.test.mjs — the ASSEMBLY GAPS an external review found by
 * reading S-1's routing (2026-11-03):
 *
 *   GAP 1 (a real bug): `nativeToolMountsOf` built the CARTESIAN PRODUCT of
 *       every configured native module × every ToolBinding identity. A
 *       binding-targeted mount must register the tool its identity names, so
 *       configuring `dsh-tool-fs` (owns `read`) WITH a second module that does
 *       NOT own `read` demanded that the second module's binding fiber
 *       register `read` — it cannot, and the WHOLE attach was refused. The fix
 *       must assign a binding only to the module that actually OWNS the tool,
 *       determined from what each module registers (not from a table, not from
 *       the specifier), and keep the failure typed when no module owns it.
 *
 *   GAP 2 (coverage): (a) the row SKIPPED the definition-identity check when
 *       the tools row had no `get()` — fine for a double, NOT fine on the
 *       product path; a composition that declares managed native modules and a
 *       tools row that cannot answer identity must REFUSE. (b) the mount
 *       settled with ONE `setTimeout(0)`, so a routed surface change AFTER the
 *       window (a late service arrival / hot update / fiber teardown) left a
 *       managed tool on the unshadowed preset path with no record. A
 *       post-settle re-verification plus continuous verification (the public
 *       `tools/change` event) must DISPOSE the shadow and RECORD the event.
 *
 * ZERO Host boots, ZERO ports, no DSH_HOME, no `tests/homes/**`: every arm is
 * an in-process Cordis unit root with `mkdtemp` fixtures. CORE PATCH BUDGET = 0
 * — this suite never touches `tests/deepseek-harness-test-use/`.
 *
 * Run: node --test tests/world-factory/a5sf-assembly.test.mjs
 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire, register } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { after } from 'node:test'
import test from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..')

/** The repo's EXISTING TS-under-plain-node hooks (no new loader). */
register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)

const row = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs')).href)
const policy = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'member-io-policy', 'src', 'index.ts')).href)

const runtimeRequire = createRequire(join(REPO_ROOT, 'packages', 'runtime', 'package.json'))
const { Context, Service } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href)
const ToolRuntime = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-tools')).href)).default
const SystemPrompt = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-system-prompt')).href)).default
const transports = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'team-services', 'src', 'guard-observability.ts')).href)
const { bindScopeParent, createScope } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-scope')).href)

// --- fixtures ---------------------------------------------------------------

const IDENTITY = Object.freeze({
  teamId: 'team-a5sf-assembly',
  memberInstanceId: 'member-assembly-a',
  templateId: 'worker',
  instanceGeneration: 3,
})
const READ_BINDING = 'dsh.fs/read'
const ARCHIVE_BINDING = 'dsh.fs/archive'
const MEMBER_REVISION = 'a5sf1:member-assembly-a:g3'

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

function restrictionOf(bindingIdentity, readRoot) {
  return Object.freeze({
    bindingIdentity,
    read: lane([readRoot]),
    write: Object.freeze({ mode: 'all', allow: Object.freeze([]), ask: Object.freeze([]), deny: Object.freeze([]) }),
    network: 'allow',
  })
}

function invocationFor(bindingIdentity) {
  return Object.freeze({
    memberIdentity: IDENTITY.memberInstanceId,
    callId: `call-assembly-${bindingIdentity}`,
    policyRevision: MEMBER_REVISION,
    toolBindingIdentity: bindingIdentity,
    approvedOnce: false,
  })
}

function compileBinding(ceiling, bindingIdentity, readRoot) {
  const effective = policy.compileEffectiveIo(ceiling, restrictionOf(bindingIdentity, readRoot), invocationFor(bindingIdentity))
  assert.equal(effective.ok, true, `compileEffectiveIo must admit this pair: ${JSON.stringify(effective)}`)
  return effective.value
}

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
    const { readFileSync } = await import('node:fs')
    return readFileSync(this.processPath(target), 'utf8')
  }

  async readBytes(target) {
    const { readFileSync } = await import('node:fs')
    return readFileSync(this.processPath(target))
  }

  async readByteRange(target, range) {
    const { readFileSync } = await import('node:fs')
    return readFileSync(this.processPath(target)).subarray(range.offset, range.offset + range.length)
  }

  async streamText(target) {
    const text = await this.readText(target)
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
  const dir = trackedDir(mkdtempSync(join(tmpdir(), `a5sf-assembly-${label}-`)))
  const inside = join(dir, 'inside')
  mkdirSync(inside, { recursive: true })
  writeFileSync(join(inside, 'ok.txt'), 'INSIDE\n', 'utf8')
  writeFileSync(join(dir, 'ceiling-only.txt'), 'CEILING_ONLY\n', 'utf8')
  return { dir, inside, insideFile: join(inside, 'ok.txt'), ceilingOnly: join(dir, 'ceiling-only.txt') }
}

/**
 * Write a REAL fixture native module (the row's module-specifier path is
 * exercised end to end). Shape = a shipped tool package: injects
 * tools/fs/systemPrompt, registers one prompt section per tool, and a tool
 * whose body resolves `ctx.get('fs')` from the ctx it runs on.
 *
 * @param {string} label - unique fixture label.
 * @param {readonly {name: string, reads?: boolean, constant?: string}[]} tools
 * @returns {string} file: URL.
 */
function writeNativeModule(label, tools) {
  const dir = trackedDir(mkdtempSync(join(tmpdir(), `a5sf-assembly-mod-${label}-`)))
  const file = join(dir, 'native-tool.mjs')
  const registrations = tools.map((tool) => `
  ctx.systemPrompt.section({ name: 'tool:${tool.name}', order: 50, text: '${label} ${tool.name} guidance' })
  ctx.tools.register({
    name: ${JSON.stringify(tool.name)},
    description: ${JSON.stringify(`fixture ${label} ${tool.name}`)},
    parameters: { type: 'object', properties: { file_path: { type: 'string' } }, additionalProperties: false },
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: String(value) }] },
    async execute(args) {
      ${tool.reads === true ? 'const fs = ctx.get(\'fs\')\n      return await fs.readText(await fs.resolve(args.file_path))' : `return ${JSON.stringify(tool.constant ?? 'ok')}`}
    },
  })`).join('\n')
  writeFileSync(file, `
export const name = ${JSON.stringify(`fixture-assembly-${label}`)}
export const inject = ['tools', 'fs', 'systemPrompt']
export function apply(ctx) {
${registrations}
}
`, 'utf8')
  return pathToFileURL(file).href
}

/**
 * A module whose `apply` registers its tool only on the FIRST call and is
 * consumed by the ownership probe, reproducing the C1 fail-open: the real
 * mount forwards nothing while the model-visible name set still matches.
 */
function writeOneShotModule(label, toolName) {
  const dir = trackedDir(mkdtempSync(join(tmpdir(), `a5sf-assembly-oneshot-${label}-`)))
  const file = join(dir, 'one-shot.mjs')
  writeFileSync(file, `
let consumed = false
export const name = ${JSON.stringify(`fixture-one-shot-${label}`)}
export const inject = ['tools', 'fs', 'systemPrompt']
export function apply(ctx) {
  if (consumed) return
  consumed = true
  ctx.systemPrompt.section({ name: 'tool:${toolName}', order: 50, text: '${label} ${toolName} guidance' })
  ctx.tools.register({
    name: ${JSON.stringify(toolName)},
    description: ${JSON.stringify(`one-shot ${label} ${toolName}`)},
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: String(value) }] },
    async execute() { return 'one-shot' },
  })
}
`, 'utf8')
  return pathToFileURL(file).href
}

/**
 * A module that records its LIVE instances through a real Cordis effect: each
 * `apply` increments a global and registers the matching decrement. Probe
 * disposal is therefore observable as an exact live count (C2).
 */
function writeEffectModule(label, toolName, counterKey) {
  const dir = trackedDir(mkdtempSync(join(tmpdir(), `a5sf-assembly-effect-${label}-`)))
  const file = join(dir, 'effect.mjs')
  writeFileSync(file, `
export const name = ${JSON.stringify(`fixture-effect-${label}`)}
export const inject = ['tools', 'fs', 'systemPrompt']
export function apply(ctx) {
  const key = ${JSON.stringify(counterKey)}
  globalThis[key] = (globalThis[key] ?? 0) + 1
  ctx.effect(() => () => { globalThis[key] -= 1 })
  ctx.systemPrompt.section({ name: 'tool:${toolName}', order: 50, text: '${label} ${toolName} guidance' })
  ctx.tools.register({
    name: ${JSON.stringify(toolName)},
    description: ${JSON.stringify(`effect ${label} ${toolName}`)},
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: String(value) }] },
    async execute() { return 'effect' },
  })
}
`, 'utf8')
  return pathToFileURL(file).href
}

/**
 * A module that returns ACTIVE with NO registration, then registers `toolName`
 * from a 30 ms timer (the same already-active fiber). The timer runs AFTER the
 * bounded settle window, so this is the `a5sf-s1` §3.2 late-registration shape:
 * the router forwards it (live and confined), but the attach's receipt was
 * already built. `toolName` must exist on the PRESET surface (and not be
 * forwarded by the attach) so the name-set gate cannot see the change.
 */
function writeLateModule(label, toolName, delayMs = 30) {
  const dir = trackedDir(mkdtempSync(join(tmpdir(), `a5sf-assembly-late-${label}-`)))
  const file = join(dir, 'late.mjs')
  writeFileSync(file, `
export const name = ${JSON.stringify(`fixture-late-${label}`)}
export const inject = ['tools', 'fs', 'systemPrompt']
export function apply(ctx) {
  setTimeout(() => {
    try {
      ctx.tools.register({
        name: ${JSON.stringify(toolName)},
        description: ${JSON.stringify(`late ${label} ${toolName}`)},
        parameters: { type: 'object', properties: {}, additionalProperties: false },
        output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: String(value) }] },
        async execute() { return 'late' },
      })
    } catch {}
  }, ${String(delayMs)})
}
`, 'utf8')
  return pathToFileURL(file).href
}

/** The PRESET row for one tool, mounted on the standing (parent) scope. */
function presetPlugin(toolName, options = {}) {
  return {
    name: `fixture-preset-${toolName}`,
    inject: ['tools', 'fs', 'systemPrompt'],
    apply(ctx) {
      ctx.systemPrompt.section({ name: `tool:${toolName}`, order: 50, text: 'preset guidance' })
      ctx.tools.register({
        name: toolName,
        description: `preset ${toolName}`,
        parameters: { type: 'object', properties: { file_path: { type: 'string' } }, additionalProperties: false },
        output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: String(value) }] },
        async execute(args) {
          if (options.reads === true) {
            const fs = ctx.get('fs')
            return await fs.readText(await fs.resolve(args.file_path))
          }
          return 'preset'
        },
      })
    },
  }
}

/** The preset topology the real registry builds: standing scope -> agent scope. */
async function presetTopology(root, presetTools) {
  const standingKey = {}
  const standing = createScope(root, standingKey)
  for (const tool of presetTools) await standing.ctx.plugin(presetPlugin(tool.name, tool))
  const agentKey = { session: { header: {} } }
  const agent = createScope(root, agentKey)
  bindScopeParent(agentKey, standingKey)
  return { standingKey, standing, agentKey, agentCtx: agent.ctx }
}

function toolNames(root, scope) {
  return root.get('tools').schemas(scope).map((schema) => schema.name)
}

function definitionOf(root, scope, name) {
  return root.get('tools').get(name, scope)
}

async function dispatch(root, scope, name, args) {
  const settled = await root.get('tools').execute({
    signal: new AbortController().signal,
    callId: `call-assembly-${name}`,
    agent: scope,
    name,
    arguments: args,
  })
  const text = Array.isArray(settled.content)
    ? settled.content.map((part) => (part?.type === 'text' ? part.text : '')).join('')
    : ''
  // P0 (2026-11-03): a refusal must be TYPED, not just an error string. The
  // registry materializes a denied tool as `{ isError, error: { message, info? } }`;
  // expose `info` so an arm can pin the stable code instead of matching text.
  const info = settled.error?.info
  return { isError: settled.isError === true, text, info }
}

/**
 * Assemble one world: preset rows (read/write/x_assembly_probe) on the
 * standing scope, a compiled realm (ceiling + the requested bindings), and the
 * configured native modules ready to attach.
 */
async function makeWorld(label, { bindingIdentities = [READ_BINDING], modules }) {
  const root = await makeRoot()
  const fixture = makeFixture(label)
  const sinkPath = join(trackedDir(mkdtempSync(join(tmpdir(), `a5sf-assembly-sink-${label}-`))), 'consult.jsonl')
  const topology = await presetTopology(root, [
    { name: 'read', reads: true },
    { name: 'write' },
    { name: 'x_assembly_probe' },
  ])
  const ceiling = memberPolicy(fixture.dir)
  // The mount input is kept as a closure so an arm can prove the P0 recovery
  // rule: eligibility may only return after a FULL re-assembly (a new realm
  // mount + a new native attach that passes verification again).
  const mountRealm = () => row.mountMemberA5sfRealm({
    root: topology.agentCtx,
    a5sfConfig: row.a5sfRealmConfigOf({ a5sfEvidencePath: sinkPath }),
    provider: () => ({
      compiledFor: () => ({
        members: [{ identity: IDENTITY, policy: { ok: true, value: ceiling } }],
        ...(bindingIdentities.length === 0
          ? {}
          : {
              bindings: bindingIdentities.map((bindingIdentity) => ({
                identity: IDENTITY,
                toolBindingIdentity: bindingIdentity,
                effective: compileBinding(ceiling, bindingIdentity, fixture.inside),
              })),
            }),
        providerClass: TestFileSystem,
      }),
    }),
    member: {
      sessionId: 'session-assembly',
      instanceId: IDENTITY.memberInstanceId,
      teamRootSessionId: 'team-root-assembly',
      templateId: IDENTITY.templateId,
    },
  })
  const realm = await mountRealm()
  assert.notEqual(realm, undefined)
  return {
    root,
    fixture,
    sinkPath,
    realm,
    remountRealm: mountRealm,
    agentCtx: topology.agentCtx,
    standingCtx: topology.standing.ctx,
    agentKey: topology.agentKey,
    config: row.a5sfRealmConfigOf({ a5sfEvidencePath: sinkPath, a5sfNativeToolModules: modules }),
  }
}

function routingsOf(fibers) {
  return fibers.map((fiber) => fiber.a5sfRegistrationRouting)
}

/** Wait (bounded) for the realm to record a post-settle invalidation. */
async function waitForInvalidation(realm, timeoutMs = 1500) {
  const deadline = Date.now() + timeoutMs
  while ((realm.nativeInvalidation ?? null) === null) {
    if (Date.now() > deadline) return realm.nativeInvalidation ?? null
    await new Promise((resolve) => setTimeout(resolve, 5))
  }
  return realm.nativeInvalidation ?? null
}

after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
})

// ===========================================================================
// GAP 1a — module A + a binding for A's tool mounts AND routes
// ===========================================================================

test('GAP1a a binding is assigned to the module that OWNS its tool; the composition mounts and routes', async () => {
  const moduleA = writeNativeModule('a', [{ name: 'read', reads: true }, { name: 'write', constant: 'written' }])
  const moduleB = writeNativeModule('b', [{ name: 'x_assembly_probe', constant: 'probe-ok' }])
  const world = await makeWorld('gap1a', { modules: [moduleA, moduleB] })
  const { root, fixture, realm, agentCtx, agentKey, config, sinkPath } = world
  try {
    const fibers = await row.attachA5sfNativeToolModules(realm, agentCtx, config, agentKey)
    const routing = routingsOf(fibers)
    // ONE ceiling mount per module + ONE binding mount for the OWNING module.
    // The pre-fix cartesian product also added a binding mount for module B,
    // which cannot register `read`, and refused the whole attach.
    assert.equal(fibers.length, 3, `expected 2 ceiling + 1 binding fibers, got ${JSON.stringify(routing)}`)
    const readFiber = routing.find((entry) => entry.toolBindingIdentity === READ_BINDING)
    assert.notEqual(readFiber, undefined, 'the read binding has a fiber')
    assert.equal(readFiber.realm, 'binding')
    assert.deepEqual(readFiber.forwarded, ['read'], 'the binding fiber owns ONLY its tool')
    const probeFiber = routing.find((entry) => entry.forwarded.includes('x_assembly_probe'))
    assert.equal(probeFiber.realm, 'ceiling', 'module B is mounted in the CEILING partition')

    // The routed read executes on the binding lane: a ceiling-allowed but
    // restriction-denied locator is REFUSED with a BINDING fact.
    const routed = await dispatch(root, agentKey, 'read', { file_path: fixture.ceilingOnly })
    assert.equal(routed.isError, true, `the binding lane must refuse the ceiling-only locator: ${routed.text}`)
    const facts = transports.readGuardConsultFile
      ? await transports.readGuardConsultFile(sinkPath)
      : []
    assert.equal(facts.length, 1, 'exactly ONE guard fact for the refused read')
    assert.equal(facts[0].realm, 'binding')
    assert.equal(facts[0].toolBindingIdentity, READ_BINDING)
  } finally {
    await realm.dispose()
  }
})

// ===========================================================================
// GAP 1b — module B rides in the ceiling partition and does not break attach
// ===========================================================================

test('GAP1b module B is ceiling-only, its tool still executes, and it never takes the binding lane', async () => {
  const moduleA = writeNativeModule('a2', [{ name: 'read', reads: true }, { name: 'write', constant: 'written' }])
  const moduleB = writeNativeModule('b2', [{ name: 'x_assembly_probe', constant: 'probe-ok' }])
  const world = await makeWorld('gap1b', { modules: [moduleA, moduleB] })
  const { root, realm, agentCtx, agentKey, config, fixture } = world
  try {
    const fibers = await row.attachA5sfNativeToolModules(realm, agentCtx, config, agentKey)
    const routing = routingsOf(fibers)
    const bFiber = routing.find((entry) => entry.forwarded.includes('x_assembly_probe'))
    assert.notEqual(bFiber, undefined, 'module B registered its tool')
    assert.equal(bFiber.realm, 'ceiling')
    assert.equal(bFiber.toolBindingIdentity, null)
    // The unrelated tool really serves, on the ceiling (no restriction applies).
    const probe = await dispatch(root, agentKey, 'x_assembly_probe', {})
    assert.equal(probe.isError, false, `module B's tool must execute: ${probe.text}`)
    assert.equal(probe.text, 'probe-ok')
    // Sibling read is still routed: the ceiling-only locator refuses.
    const routed = await dispatch(root, agentKey, 'read', { file_path: fixture.ceilingOnly })
    assert.equal(routed.isError, true, 'the read tool is still routed to its binding')
    // Surface neutrality: the composition adds and removes nothing.
    assert.deepEqual(
      toolNames(root, agentKey).sort(),
      ['read', 'write', 'x_assembly_probe'].sort(),
    )
  } finally {
    await realm.dispose()
  }
})

// ===========================================================================
// GAP 1c — a binding naming a tool NO configured module owns is refused typed
// ===========================================================================

test('GAP1c a binding whose tool NO module owns is REFUSED with a typed error and mounts nothing', async () => {
  const moduleA = writeNativeModule('a3', [{ name: 'read', reads: true }, { name: 'write', constant: 'written' }])
  const moduleB = writeNativeModule('b3', [{ name: 'x_assembly_probe', constant: 'probe-ok' }])
  const world = await makeWorld('gap1c', { bindingIdentities: [ARCHIVE_BINDING], modules: [moduleA, moduleB] })
  const { root, realm, agentCtx, agentKey, config } = world
  try {
    const presetRead = definitionOf(root, agentKey, 'read')
    await assert.rejects(
      () => row.attachA5sfNativeToolModules(realm, agentCtx, config, agentKey),
      (error) => {
        assert.equal(error.code, 'A5SF_BINDING_OWNER_UNRESOLVED', `expected the typed ownership refusal, got ${error.name}: ${error.message}`)
        assert.match(error.message, /archive/)
        return true
      },
      'a binding no module owns must fail closed',
    )
    // Nothing was mounted: the preset definitions are the ones resolved.
    assert.equal(definitionOf(root, agentKey, 'read'), presetRead, 'no shadow was left behind')
    assert.deepEqual(toolNames(root, agentKey).sort(), ['read', 'write', 'x_assembly_probe'].sort())
    assert.equal(realm.nativeInvalidation ?? null, null, 'a pre-mount refusal is not an invalidation event')
  } finally {
    await realm.dispose()
  }
})

// ===========================================================================
// GAP 2a — a tools row that cannot answer definition identity must REFUSE
// ===========================================================================

test('GAP2a a get()-less tools row REFUSES the configged native mount (coverage is never silently skipped)', async () => {
  const moduleA = writeNativeModule('a4', [{ name: 'read', reads: true }])
  const names = ['read']
  const toolsRow = { schemas: () => names.map((name) => ({ name })) } // surface-only double, NO get()
  const fakeRoot = { get: (name) => (name === 'tools' ? toolsRow : undefined) }
  let mountCalls = 0
  const fakeRealm = {
    mountNativeToolModules: async () => {
      mountCalls += 1
      return Object.freeze([{
        a5sfRegistrationRouting: {
          realm: 'ceiling',
          toolBindingIdentity: null,
          forwarded: Object.freeze(['read']),
          dropped: Object.freeze([]),
          forwardedSections: Object.freeze([]),
        },
      }])
    },
  }
  const config = row.a5sfRealmConfigOf({ a5sfEvidencePath: '/tmp/a5sf-assembly-coverage.jsonl', a5sfNativeToolModules: [moduleA] })
  await assert.rejects(
    () => row.attachA5sfNativeToolModules(fakeRealm, fakeRoot, config, {}),
    (error) => {
      assert.equal(error.code, 'A5SF_COVERAGE_UNDEFINED', `expected the typed coverage refusal, got ${error.name}: ${error.message}`)
      return true
    },
    'a name-set-only check cannot prove the router shadowed each forwarded tool',
  )
  assert.equal(mountCalls, 0, 'the refusal happens BEFORE mounting anything')
})

// ===========================================================================
// GAP 2b — a routed surface CHANGE after the settle window invalidates
// ===========================================================================

test('GAP2b a routed shadow removed AFTER the settle window is detected, disposed and RECORDED', async () => {
  const moduleA = writeNativeModule('a5', [{ name: 'read', reads: true }, { name: 'write', constant: 'written' }])
  const moduleB = writeNativeModule('b5', [{ name: 'x_assembly_probe', constant: 'probe-ok' }])
  const world = await makeWorld('gap2b', { modules: [moduleA, moduleB] })
  const { root, realm, agentCtx, agentKey, config } = world
  try {
    const presetRead = definitionOf(root, agentKey, 'read')
    const presetWrite = definitionOf(root, agentKey, 'write')
    const presetProbe = definitionOf(root, agentKey, 'x_assembly_probe')
    const fibers = await row.attachA5sfNativeToolModules(realm, agentCtx, config, agentKey)
    assert.equal(realm.nativeInvalidation ?? null, null, 'no invalidation while the routed surface is intact')
    // Let the bounded post-settle rounds finish WITHOUT a change: they must not
    // invalidate a healthy mount.
    await new Promise((resolve) => setTimeout(resolve, 20))
    assert.equal(realm.nativeInvalidation ?? null, null, 'an intact routed surface is never invalidated by the settle rounds')

    // THE LATE CHANGE: one routed fiber is torn down after the window, which
    // leaves `read` on the UNSHADOWED preset definition while the siblings stay
    // shadowed. Pre-fix nothing notices (no event, no re-verification).
    const readFiber = fibers.find((fiber) => fiber.a5sfRegistrationRouting?.toolBindingIdentity === READ_BINDING)
    assert.notEqual(readFiber, undefined)
    await readFiber.dispose()

    const record = await waitForInvalidation(realm)
    assert.notEqual(record, null, 'the post-settle verification must record the invalidation')
    // The event is recorded BEFORE the asynchronous teardown; wait for it so the
    // restored preset surface is observable.
    await realm.whenNativeVerificationSettled()
    assert.equal(record.schema, 'a5sf-native-invalidation/1')
    assert.deepEqual([...record.uncovered], ['read'], 'the unshadowed managed tool is named in the event')
    assert.equal(typeof record.observedAt, 'string')

    // The shadow fibers are disposed (the preset surface is restored) BUT the
    // Member is out of service: the preset definition being VISIBLE must not
    // mean it MAY SERVE. P0 (2026-11-03): every managed name is refused at the
    // Member admission check until a full re-assembly verifies a new shadow.
    assert.equal(definitionOf(root, agentKey, 'write'), presetWrite, 'the sibling preset definition is restored')
    assert.equal(definitionOf(root, agentKey, 'x_assembly_probe'), presetProbe, 'module B preset definition is restored')
    assert.equal(definitionOf(root, agentKey, 'read'), presetRead, 'the routed read is gone; the preset read definition is visible again')
    for (const name of ['read', 'write', 'x_assembly_probe']) {
      const refused = await dispatch(root, agentKey, name, { file_path: world.fixture.ceilingOnly })
      assert.equal(refused.isError, true, `managed '${name}' must be REFUSED after invalidation, not served by the preset: ${refused.text}`)
      assert.equal(refused.info?.code, 'A5SF_NATIVE_SHADOW_INVALIDATED', `managed '${name}' refusal must be TYPED (got ${JSON.stringify(refused.info)})`)
      assert.equal(refused.text.includes('CEILING_ONLY'), false, `no denied bytes may reach the model through '${name}'`)
    }

    // Fail closed after invalidation: no second shadow can be attached.
    await assert.rejects(
      () => realm.mountNativeToolModules([{ module: { name: 'x', apply() {} } }]),
      /invalidated/i,
      'an invalidated realm refuses further native mounts',
    )
  } finally {
    await realm.dispose()
  }
})

// ===========================================================================
// GAP 2b — a NEW name after settle is a surface change, not an unrelated event
// ===========================================================================

test('GAP2b-late-new-name a tool that APPEARS after the settle window invalidates (S-1 +30 ms escape)', async () => {
  const moduleA = writeNativeModule('a6', [{ name: 'read', reads: true }, { name: 'write', constant: 'written' }])
  const moduleB = writeNativeModule('b6', [{ name: 'x_assembly_probe', constant: 'probe-ok' }])
  // No binding on purpose: the +30 ms escape is a SURFACE gate hole, not a
  // routing one, so the arm must prove it with a healthy unbind attach too.
  const world = await makeWorld('gap2b-late-name', { bindingIdentities: [], modules: [moduleA, moduleB] })
  const { root, realm, agentCtx, agentKey, config } = world
  try {
    const fibers = await row.attachA5sfNativeToolModules(realm, agentCtx, config, agentKey)
    assert.equal(realm.nativeInvalidation ?? null, null, 'healthy after attach')
    // LATE means a LATER MACROTASK: the first macrotask is still the caller's
    // own setup turn (the glue registers the Team tools synchronously right
    // after the attach), which the baseline deliberately absorbs.
    await new Promise((resolve) => setTimeout(resolve, 10))
    // S-1's measured hole (a): a brand-new tool name at +30 ms changes the
    // model-visible surface AFTER the attach-time gate ran. It must NOT be
    // accepted silently.
    await agentCtx.plugin({
      name: 'fixture-late-unrelated',
      inject: ['tools'],
      apply(ctx) {
        ctx.tools.register({
          name: 'x_assembly_late_unrelated',
          description: 'later unrelated registration',
          parameters: { type: 'object', properties: {}, additionalProperties: false },
          output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: String(value) }] },
          async execute() {
            return 'late'
          },
        })
      },
    })
    const record = await waitForInvalidation(realm)
    assert.notEqual(record, null, 'a late NEW name is a surface change and must invalidate')
    await realm.whenNativeVerificationSettled()
    assert.equal(record.schema, 'a5sf-native-invalidation/1')
    assert.deepEqual([...record.uncovered], [], 'no routed definition was lost')
    assert.deepEqual([...record.surfaceAdded], ['x_assembly_late_unrelated'], 'the late name is named in the event')
    assert.deepEqual([...record.surfaceRemoved], [])
    assert.equal(fibers.every((fiber) => fiber.state >= 4), true, 'the shadow is disposed, never left live')
    await assert.rejects(
      () => realm.mountNativeToolModules([{ module: { name: 'x', apply() {} } }]),
      /invalidated/i,
    )
  } finally {
    await realm.dispose()
  }
})

// ===========================================================================
// GAP 2b control — the caller's OWN same-turn setup additions are absorbed
// ===========================================================================

test('GAP2b-control same-turn setup additions (the Team tools) do not invalidate', async () => {
  const moduleA = writeNativeModule('a8', [{ name: 'read', reads: true }, { name: 'write', constant: 'written' }])
  const world = await makeWorld('gap2b-same-turn', { bindingIdentities: [], modules: [moduleA] })
  const { root, realm, agentCtx, agentKey, config } = world
  try {
    const fibers = await row.attachA5sfNativeToolModules(realm, agentCtx, config, agentKey)
    // The product glue's shape: register on the SAME setup turn, synchronously
    // after the attach returns. This is legitimate setup, not a late change.
    const tools = agentCtx.get('tools')
    tools.register({
      name: 'x_assembly_team_tool',
      description: 'same-turn product registration',
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: String(value) }] },
      async execute() {
        return 'team'
      },
    })
    await new Promise((resolve) => setTimeout(resolve, 30))
    assert.equal(realm.nativeInvalidation ?? null, null, 'same-turn setup additions are part of the baseline')
    assert.equal(fibers.every((fiber) => fiber.state === 2), true, 'every routed fiber is still active')
  } finally {
    await realm.dispose()
  }
})

// ===========================================================================
// GAP 2b control — a name that was ALREADY on the surface never invalidates
// ===========================================================================

test('GAP2b-control a tool already on the surface at arm time does not invalidate the routed shadow', async () => {
  const moduleA = writeNativeModule('a7', [{ name: 'read', reads: true }, { name: 'write', constant: 'written' }])
  const moduleB = writeNativeModule('b7', [{ name: 'x_assembly_probe', constant: 'probe-ok' }])
  // Unbound on purpose: this control exercises the NAME-SET baseline only.
  const world = await makeWorld('gap2b-control', { bindingIdentities: [], modules: [moduleA, moduleB] })
  const { root, realm, agentCtx, agentKey, config } = world
  try {
    // Register BEFORE the attach: the name is part of the expected surface, so
    // seeing it later (e.g. another tools/change) is not a surface change.
    await agentCtx.plugin({
      name: 'fixture-pre-existing',
      inject: ['tools'],
      apply(ctx) {
        ctx.tools.register({
          name: 'x_assembly_late_unrelated',
          description: 'pre-existing registration',
          parameters: { type: 'object', properties: {}, additionalProperties: false },
          output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: String(value) }] },
          async execute() {
            return 'pre'
          },
        })
      },
    })
    const fibers = await row.attachA5sfNativeToolModules(realm, agentCtx, config, agentKey)
    await new Promise((resolve) => setTimeout(resolve, 30))
    assert.equal(realm.nativeInvalidation ?? null, null, 'a name already in the baseline surface never invalidates')
    assert.equal(fibers.every((fiber) => fiber.state === 2), true, 'every routed fiber is still active')
  } finally {
    await realm.dispose()
  }
})

// ===========================================================================
// C1 — the REAL mount must reproduce what the ownership probe observed
// ===========================================================================

test('C1 a ONE-SHOT module is REFUSED when the probe consumed its only registration', async () => {
  const moduleA = writeNativeModule('a9', [{ name: 'read', reads: true }])
  const oneShot = writeOneShotModule('c1', 'write')
  const world = await makeWorld('gap-c1', { modules: [moduleA, oneShot] })
  const { root, realm, agentCtx, agentKey, config } = world
  try {
    const presetWrite = definitionOf(root, agentKey, 'write')
    await assert.rejects(
      () => row.attachA5sfNativeToolModules(realm, agentCtx, config, agentKey),
      (error) => {
        assert.equal(
          error.code,
          'A5SF_MODULE_OBSERVATION_UNREPRODUCED',
          `a one-shot module must fail closed, got ${error.name}: ${error.message}`,
        )
        assert.match(error.message, /write/)
        return true
      },
      'the real mount forwards nothing after the probe consumed the only registration',
    )
    // The preset write is the one the agent resolves: no unguarded shadow.
    assert.equal(definitionOf(root, agentKey, 'write'), presetWrite, 'no unguarded preset-shadow was accepted')
  } finally {
    await realm.dispose()
  }
})

// ===========================================================================
// C2 — probe fibers are DISPOSED (mutation-pinned)
// ===========================================================================

test('C2 the ownership probes are disposed before the real mounts (live-effect count)', async () => {
  const key = '__a5sf_c2_probe_live'
  delete globalThis[key]
  const moduleA = writeNativeModule('a10', [{ name: 'read', reads: true }])
  // B does not own the binding, so its REAL mount is exactly one ceiling fiber;
  // its probe is a second apply. A leaked probe leaves the live count at 2.
  const moduleB = writeEffectModule('c2', 'x_assembly_probe', key)
  const world = await makeWorld('gap-c2', { modules: [moduleA, moduleB] })
  const { realm, agentCtx, agentKey, config } = world
  try {
    await row.attachA5sfNativeToolModules(realm, agentCtx, config, agentKey)
    assert.equal(globalThis[key], 1, 'exactly one live apply: the real mount; the probe fiber is disposed')
    await realm.dispose()
    assert.equal(globalThis[key], 0, 'realm disposal tears the real fiber down too')
  } finally {
    delete globalThis[key]
    if (realm?.nativeInvalidation === null) await realm.dispose()
  }
})

// ===========================================================================
// P0 (2026-11-03) — NoStaleShadow ≠ NoUnconfinedExecution
//
// The defect an independent review found: invalidation disposed the shadow and
// restored the preset surface, and the ALREADY-RUNNING Member's next call was
// then served by the PRESET definition with ZERO guard facts. The Member was
// declared managed but silently fell back to unconstrained execution. These
// arms pin the closure: a managed name is REFUSED (typed) at the Member
// admission check while the realm is invalid — even though the preset
// definition is visible — and eligibility returns only after a FULL re-assembly
// that passes verification again.
// ===========================================================================

test('P0-1 the SAME out-of-lane read is REFUSED after invalidation, never served by the visible preset', async () => {
  const moduleA = writeNativeModule('p0a', [{ name: 'read', reads: true }, { name: 'write', constant: 'written' }])
  const moduleB = writeNativeModule('p0b', [{ name: 'x_assembly_probe', constant: 'probe-ok' }])
  const world = await makeWorld('p0-invalidation', { modules: [moduleA, moduleB] })
  const { root, fixture, realm, agentCtx, agentKey, config } = world

  // 1. THE SHADOW WORKS: the confined native `read` serves INSIDE the lane.
  await row.attachA5sfNativeToolModules(realm, agentCtx, config, agentKey)
  await realm.whenNativeVerificationSettled()
  assert.equal(realm.nativeInvalidation ?? null, null, 'a healthy attach never invalidates')
  const insideBefore = await dispatch(root, agentKey, 'read', { file_path: fixture.insideFile })
  assert.equal(insideBefore.isError, false, `the confined in-lane read must succeed: ${insideBefore.text}`)
  assert.equal(insideBefore.text, 'INSIDE\n', 'the shadow serves the in-lane file')

  // 2. The lane is REAL BEFORE the invalidation: the same read OUT of lane is
  //    refused by the binding realm's guard (one guard fact; not asserted here).
  const outsideBefore = await dispatch(root, agentKey, 'read', { file_path: fixture.ceilingOnly })
  assert.equal(outsideBefore.isError, true, `the binding lane must refuse the ceiling-only locator: ${outsideBefore.text}`)
  assert.equal(outsideBefore.text.includes('CEILING_ONLY'), false, 'no out-of-lane bytes before invalidation')

  try {
    // 3. INVALIDATE with a late name change (S-1's measured +30 ms shape).
    await new Promise((resolve) => setTimeout(resolve, 10))
    await agentCtx.plugin({
      name: 'fixture-p0-late',
      inject: ['tools'],
      apply(ctx) {
        ctx.tools.register({
          name: 'x_p0_late_unrelated',
          description: 'a late name registers after the settle window',
          parameters: { type: 'object', properties: {}, additionalProperties: false },
          output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: String(value) }] },
          async execute() {
            return 'late'
          },
        })
      },
    })
    const record = await waitForInvalidation(realm)
    assert.notEqual(record, null, 'the late name must invalidate the shadow')
    assert.equal(record.schema, 'a5sf-native-invalidation/1')
    assert.deepEqual([...record.surfaceAdded], ['x_p0_late_unrelated'])
    await realm.whenNativeVerificationSettled()

    // The PRESET definition is now visible again — the old fallback path.
    assert.notEqual(definitionOf(root, agentKey, 'read'), undefined, 'the preset read definition is visible after teardown')

    // 4. THE SAME read, out of lane: REFUSED. The forbidden bytes never reach
    //    the model, and the refusal is TYPED and names the Member/realm/reason.
    const outsideAfter = await dispatch(root, agentKey, 'read', { file_path: fixture.ceilingOnly })
    assert.equal(outsideAfter.isError, true, `the SAME out-of-lane read must be REFUSED after invalidation: ${outsideAfter.text}`)
    assert.equal(outsideAfter.text.includes('CEILING_ONLY'), false, 'THE LEAK: the preset must not return the denied bytes')
    assert.equal(outsideAfter.info?.code, 'A5SF_NATIVE_SHADOW_INVALIDATED', `the refusal must be typed: ${JSON.stringify(outsideAfter.info)}`)
    assert.match(outsideAfter.text, /member-assembly-a/, 'the refusal names the affected Member')
    assert.match(outsideAfter.text, /dsh\.fs\/read/, 'the refusal names the realm/binding that lost its shadow')
    assert.equal(outsideAfter.text.includes(record.reason), true, 'the refusal carries the invalidation reason')

    // 5. An IN-LANE read is likewise refused: the Member is OUT OF SERVICE, not
    //    silently less governed (never "the confined path stopped, so serve the
    //    unconfined one").
    const insideAfter = await dispatch(root, agentKey, 'read', { file_path: fixture.insideFile })
    assert.equal(insideAfter.isError, true, `an in-lane read after invalidation must also be refused: ${insideAfter.text}`)
    assert.equal(insideAfter.text.includes('INSIDE'), false, 'no bytes at all while the Member is invalid')
    assert.equal(insideAfter.info?.code, 'A5SF_NATIVE_SHADOW_INVALIDATED')

    // 6. A ceiling-partition managed tool is refused too, naming the ceiling realm.
    const writeAfter = await dispatch(root, agentKey, 'write', { file_path: fixture.insideFile })
    assert.equal(writeAfter.isError, true, 'a ceiling-partition managed tool is refused after invalidation')
    assert.equal(writeAfter.info?.code, 'A5SF_NATIVE_SHADOW_INVALIDATED')
    assert.match(writeAfter.text, /ceiling/, 'the refusal names the ceiling realm')

    // 7. NO SILENT / PARTIAL RESTORATION: the same realm refuses a re-attach.
    await assert.rejects(
      () => realm.mountNativeToolModules([{ module: { name: 'x', apply() {} } }]),
      /invalidated/i,
      'an invalidated realm refuses a partial re-attach',
    )

    // 8. ELIGIBILITY RETURNS ONLY AFTER A FULL RE-ASSEMBLY: dispose the realm,
    //    mount a fresh one and attach again; the new attach passes verification
    //    and the confined lane works. (Proven on the SAME agent/tool plane.)
    await realm.dispose()
    const realm2 = await world.remountRealm()
    try {
      await row.attachA5sfNativeToolModules(realm2, agentCtx, config, agentKey)
      await realm2.whenNativeVerificationSettled()
      assert.equal(realm2.nativeInvalidation ?? null, null, 'the re-assembled realm is verified, not invalid')
      const insideAgain = await dispatch(root, agentKey, 'read', { file_path: fixture.insideFile })
      assert.equal(insideAgain.isError, false, `the re-assembled confined read must work again: ${insideAgain.text}`)
      assert.equal(insideAgain.text, 'INSIDE\n')
      const outsideAgain = await dispatch(root, agentKey, 'read', { file_path: fixture.ceilingOnly })
      assert.equal(outsideAgain.isError, true, 'the re-assembled lane still refuses out-of-lane reads')
      assert.equal(outsideAgain.text.includes('CEILING_ONLY'), false)
    } finally {
      await realm2.dispose()
    }
  } finally {
    await realm.dispose()
  }
})

test('P0-2 a managed attach whose verification listener cannot attach is REFUSED (fail closed, typed)', async () => {
  const moduleA = writeNativeModule('p0c', [{ name: 'read', reads: true }])
  const world = await makeWorld('p0-listener', { bindingIdentities: [], modules: [moduleA] })
  const { root, realm, agentCtx, agentKey, config } = world
  const memberCtx = realm.installation.members[0].ctx
  const originalOn = memberCtx.on
  try {
    const presetRead = definitionOf(root, agentKey, 'read')
    // The public `tools/change` contract is what continuous verification rides.
    // If it cannot be attached, the old code silently degraded to the two
    // bounded rounds; P0 refuses the managed attach instead.
    Object.defineProperty(memberCtx, 'on', {
      configurable: true,
      value(event, ...rest) {
        if (event === 'tools/change') throw new Error('tools/change listener unavailable')
        return originalOn.call(memberCtx, event, ...rest)
      },
    })
    await assert.rejects(
      () => row.attachA5sfNativeToolModules(realm, agentCtx, config, agentKey),
      (error) => {
        assert.equal(error.code, 'SERVICE_MOUNT_FAILED', `expected the typed attach refusal, got ${error.name}: ${error.message}`)
        assert.match(error.message, /tools\/change/, 'the refusal names the listener it could not attach')
        assert.match(error.message, /bounded|cannot attach/, 'the refusal states why it did not degrade silently')
        return true
      },
      'a managed attach must not run on the bounded rounds alone',
    )
    // Rolled back: nothing is mounted, the preset definition is untouched and
    // the realm recorded no invalidation (this is a REFUSAL, not an event).
    assert.equal(definitionOf(root, agentKey, 'read'), presetRead, 'the failed attach left the preset definition untouched')
    assert.equal(realm.nativeInvalidation ?? null, null, 'a refused attach is not an invalidation')
  } finally {
    Object.defineProperty(memberCtx, 'on', { configurable: true, value: originalOn })
    await realm.dispose()
  }
})

test('P0-3 disposing EVERY shadow fiber invalidates and denies — never a silent preset fallback', async () => {
  // C1 (review, 2026-11-03): the invalidation check used to bail out whenever no
  // routed fiber was still active, so an external holder of the returned fibers
  // could tear down the WHOLE shadow and the Member fell back to the preset with
  // no record and no deny — the exact P0 leak class. A one-fiber world makes
  // "some fiber active" and "this attach is alive" disagree immediately.
  const moduleA = writeNativeModule('p0d', [{ name: 'read', reads: true }, { name: 'write', constant: 'written' }])
  const world = await makeWorld('p0-all-fibers', { bindingIdentities: [], modules: [moduleA] })
  const { root, fixture, realm, agentCtx, agentKey, config } = world
  try {
    const fibers = await row.attachA5sfNativeToolModules(realm, agentCtx, config, agentKey)
    await realm.whenNativeVerificationSettled()
    assert.equal(fibers.length, 1, 'the unbound world mounts exactly one ceiling fiber')
    assert.equal(realm.nativeInvalidation ?? null, null, 'healthy after attach')
    const before = await dispatch(root, agentKey, 'read', { file_path: fixture.insideFile })
    assert.equal(before.isError, false, `the shadow serves the in-lane file: ${before.text}`)
    assert.equal(before.text, 'INSIDE\n')

    // THE ATTACK: an in-process holder disposes the LAST active shadow fiber.
    await fibers[0].dispose()

    const after = await dispatch(root, agentKey, 'read', { file_path: fixture.insideFile })
    assert.equal(after.isError, true, `every managed read must be REFUSED after the whole shadow is torn down: ${after.text}`)
    assert.equal(after.text.includes('INSIDE'), false, 'the preset must not serve the bytes')
    assert.equal(after.info?.code, 'A5SF_NATIVE_SHADOW_INVALIDATED', `the refusal must be typed: ${JSON.stringify(after.info)}`)

    const record = await waitForInvalidation(realm)
    assert.notEqual(record, null, 'tearing down EVERY shadow fiber must be RECORDED as an invalidation')
    assert.ok(record.uncovered.includes('write'), `the event names the lost route(s): ${JSON.stringify(record.uncovered)}`)
    // EVERY covered name is denied, including one whose definition identity still
    // matches the attach (the deny is keyed on the attach's name set, not on the
    // uncovered subset the event happens to report).
    const writeAfter = await dispatch(root, agentKey, 'write', { file_path: fixture.insideFile, content: 'x' })
    assert.equal(writeAfter.isError, true, `the covered write must be REFUSED too: ${writeAfter.text}`)
    assert.equal(writeAfter.info?.code, 'A5SF_NATIVE_SHADOW_INVALIDATED')
    await realm.whenNativeVerificationSettled()
  } finally {
    await realm.dispose()
  }
})

test('C3 (review 2026-11-03) a registration by an ALREADY-ACTIVE fiber AFTER the settle window is FOLDED IN and INVALIDATES — never an unrecorded live shadow', async () => {
  // Measured pre-fix shape: an ACTIVE module fiber registers from a 30 ms timer.
  // The router forwards it (live, confined), but the attach's receipt is already
  // built, and `x_assembly_probe` is on the PRESET surface, so the name set does
  // not change either. Result was ACCEPT; live; unrecorded; invalidation null —
  // and after any later teardown the name resolved to the PRESET definition while
  // the admission deny (keyed on the attach's managed names) did not cover it, so
  // the preset body executed. The mount now folds a late forwarded name into the
  // managed set and invalidates, so the deny covers it.
  const lateModule = writeLateModule('c3', 'x_assembly_probe')
  const world = await makeWorld('late-registration', { bindingIdentities: [], modules: [lateModule] })
  const { root, realm, agentCtx, agentKey, config } = world
  try {
    const presetProbe = definitionOf(root, agentKey, 'x_assembly_probe')
    await row.attachA5sfNativeToolModules(realm, agentCtx, config, agentKey)
    await realm.whenNativeVerificationSettled()
    assert.equal(realm.nativeInvalidation ?? null, null, 'the ATTACH itself is accepted; the late registration has not landed yet')

    const record = await waitForInvalidation(realm)
    assert.notEqual(record, null, 'a post-settle registration by an ACTIVE fiber must be RECORDED, not accepted silently')
    assert.deepEqual([...record.lateRegistrations], ['x_assembly_probe'], `the record must name the late registration: ${JSON.stringify(record)}`)
    assert.match(record.reason, /after the mount settled/, 'the reason states the post-settle rule')
    assert.deepEqual([...record.surfaceAdded], [], 'the surface name set did not change — the fold, not the surface gate, caught it')
    assert.deepEqual([...record.uncovered], [], 'the late registration was live when caught, so nothing was "uncovered"')

    // THE DENY COVERS IT: folded in BEFORE the teardown, so the preset body that
    // becomes visible again may not serve this Member.
    const after = await dispatch(root, agentKey, 'x_assembly_probe', {})
    assert.equal(after.isError, true, `the late-registered name must be REFUSED at admission: ${after.text}`)
    assert.equal(after.info?.code, 'A5SF_NATIVE_SHADOW_INVALIDATED', `the refusal must be typed: ${JSON.stringify(after.info)}`)
    assert.equal(after.text.includes('late'), false, 'neither the late body nor the preset body may serve it')
    assert.equal(definitionOf(root, agentKey, 'x_assembly_probe'), presetProbe, 'the preset definition is visible again (and denied) after the teardown')
    await realm.whenNativeVerificationSettled()
  } finally {
    await realm.dispose()
  }
})

// ===========================================================================
// E3 (2026-11-03, event-driven shape) — a fixed EventTarget contract:
// `subagent/provider-added` registers the managed tool AND the preset plane's
// own listener registers the same name, in the SAME synchronous emission.
// ===========================================================================

/**
 * A module shaped like the pinned `dsh-tool-subagent`: it registers NOTHING in
 * `apply`; its only registration runs from an event listener, after the attach
 * has settled. This is the third registration shape (not `apply`, not a
 * deferred child fiber), and the one the settle window cannot see.
 */
function writeEventModule(label, toolName, eventName) {
  const dir = trackedDir(mkdtempSync(join(tmpdir(), `a5sf-assembly-event-${label}-`)))
  const file = join(dir, 'event.mjs')
  writeFileSync(file, `
export const name = ${JSON.stringify(`fixture-event-${label}`)}
export const inject = ['tools', 'fs', 'systemPrompt']
export function apply(ctx) {
  ctx.on(${JSON.stringify(eventName)}, () => {
    ctx.tools.register({
      name: ${JSON.stringify(toolName)},
      description: ${JSON.stringify(`managed event ${label} ${toolName}`)},
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: String(value) }] },
      async execute() { return 'managed-event-body' },
    })
  })
}
`, 'utf8')
  return pathToFileURL(file).href
}

test('E3 (event-driven 2026-11-03) a preset-plane registration inside the SAME emission must not abort the managed one; the late name is folded and DENIED', async () => {
  // MEASURED with the real pinned `dsh-tool-subagent` (probe-event-driven E3b):
  // the preset plane's listener registers first, the surface gate invalidates,
  // and the router used to be torn down WHILE the managed module's listener for
  // the same event had not run yet. That registration then threw Cordis
  // `INACTIVE_EFFECT` out of the emitter, the provider registration was rolled
  // back, and the name vanished — the attach's own event contract was broken by
  // its teardown. The teardown is now deferred one microtask (the record is
  // still set FIRST) and the admission deny folds a name that lands in that
  // turn, so the emitter completes and the name can never be served by the
  // visible preset definition.
  const EVENT = 'assembly/provider-added'
  const managedModule = writeEventModule('e3', 'x_event_probe', EVENT)
  const world = await makeWorld('event-driven-same-emission', { bindingIdentities: [], modules: [managedModule] })
  const { root, realm, agentCtx, agentKey, config } = world
  const presetPlane = {
    name: 'fixture-preset-event-plane-e3',
    inject: ['tools'],
    apply(ctx) {
      ctx.on(EVENT, () => {
        ctx.tools.register({
          name: 'x_event_plane_probe',
          description: 'preset plane event body',
          parameters: { type: 'object', properties: {}, additionalProperties: false },
          output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: String(value) }] },
          async execute() { return 'preset-plane-body' },
        })
      })
    },
  }
  try {
    // Applied BEFORE the attach, so its listener runs first (the product order:
    // the preset composition exists when the Member is assembled).
    await agentCtx.plugin(presetPlane)
    const fibers = await row.attachA5sfNativeToolModules(realm, agentCtx, config, agentKey)
    await realm.whenNativeVerificationSettled()
    assert.equal(realm.nativeInvalidation ?? null, null, 'the attach itself is accepted (the event has not fired)')
    assert.deepEqual(routingsOf(fibers)[0].forwarded, [], 'the event-driven module registered nothing during apply')

    // THE EMISSION. Pre-fix this THREW `INACTIVE_EFFECT` from the managed
    // listener after the preset-plane registration had already invalidated.
    assert.doesNotThrow(() => root.emit(EVENT), 'the managed registration must not be aborted by its own teardown')

    const record = await waitForInvalidation(realm)
    assert.notEqual(record, null, 'the surface change inside the emission must be RECORDED')
    assert.ok([...record.surfaceAdded].includes('x_event_plane_probe'), `the record names the preset plane's newly visible name: ${JSON.stringify(record)}`)
    assert.deepEqual([...record.uncovered], [], 'the managed registration was live, so nothing was "uncovered"')

    // The preset plane's definition is what stays visible; the managed one was
    // folded into the deny before the teardown, so NEITHER body may serve.
    assert.notEqual(definitionOf(root, agentKey, 'x_event_probe'), undefined, 'the preset definition is visible after the teardown')
    const after = await dispatch(root, agentKey, 'x_event_probe', {})
    assert.equal(after.isError, true, `the name must be REFUSED at admission: ${after.text}`)
    assert.equal(after.info?.code, 'A5SF_NATIVE_SHADOW_INVALIDATED', `the refusal must be typed: ${JSON.stringify(after.info)}`)
    assert.equal(after.text.includes('preset-plane-body'), false, 'no preset body may serve the managed name')
    assert.equal(after.text.includes('managed-event-body'), false, 'the managed body must not serve either')
    await realm.whenNativeVerificationSettled()
  } finally {
    await realm.dispose()
  }
})

// ===========================================================================
// EXPECT (2026-11-03, opt-in) — `expectedTools` declares what the composition
// BELIEVES a managed module provides. It grants nothing: its only power is to
// turn "declared, but never shadowed" into a typed refusal instead of a
// silently accepted zero-shadow attach whose declared name falls back to a
// preset definition with zero guard facts.
// ===========================================================================

test('EXPECT-1 a declared module that FORWARDS its declared tool is ACCEPTED and the deny covers it like any observed name', async () => {
  const moduleA = writeNativeModule('exp1', [{ name: 'read', reads: true }])
  const world = await makeWorld('expected-forwarded', {
    bindingIdentities: [],
    modules: [{ url: moduleA, expectedTools: ['read'] }],
  })
  const { root, fixture, realm, agentCtx, agentKey, config } = world
  try {
    const fibers = await row.attachA5sfNativeToolModules(realm, agentCtx, config, agentKey)
    assert.deepEqual([...routingsOf(fibers)[0].forwarded], ['read'], 'the declared tool is the forwarded one')
    const served = await dispatch(root, agentKey, 'read', { file_path: fixture.insideFile })
    assert.equal(served.isError, false, `a declared-and-shadowed tool serves on the routed lane: ${served.text}`)
    assert.equal(served.text, 'INSIDE\n')
    assert.equal(realm.nativeInvalidation ?? null, null, 'a satisfied declaration arms nothing')
  } finally {
    await realm.dispose()
  }
})

test('EXPECT-2 a declared module that forwards NOTHING is REFUSED, typed, naming the missing name — the divergent composition', async () => {
  // The event-driven module with a provider that never appears: it registers
  // nothing by the settle boundary, so the preset definition stays the one the
  // agent resolves. Declared `expectedTools` turns that into a refusal.
  const silent = writeEventModule('exp2', 'x_assembly_probe', 'never/fired')
  const world = await makeWorld('expected-unshadowed', {
    bindingIdentities: [],
    modules: [{ url: silent, expectedTools: ['x_assembly_probe'] }],
  })
  const { root, realm, agentCtx, agentKey, config } = world
  try {
    const presetProbe = definitionOf(root, agentKey, 'x_assembly_probe')
    await assert.rejects(
      () => row.attachA5sfNativeToolModules(realm, agentCtx, config, agentKey),
      (error) => {
        assert.equal(error.code, 'A5SF_EXPECTED_TOOLS_UNSHADOWED', `expected the typed declaration refusal, got ${error.name}: ${error.message}`)
        assert.match(error.message, /x_assembly_probe/, 'the refusal NAMES the declared-but-unshadowed tool')
        assert.match(error.message, /expectedTools/, 'the refusal names the declaration')
        return true
      },
      'a declared tool that no routed fiber shadows must refuse the attach',
    )
    // The refusal released the routers and recorded NO invalidation (it is a
    // caller refusal, not a late-change event), and it did not touch the preset.
    assert.equal(realm.nativeInvalidation ?? null, null, 'a refused attach is not an invalidation')
    assert.equal(definitionOf(root, agentKey, 'x_assembly_probe'), presetProbe, 'the failed attach left the preset definition untouched')
    assert.deepEqual(toolNames(root, agentKey).sort(), ['read', 'write', 'x_assembly_probe'].sort(), 'surface neutral after the refusal')
  } finally {
    await realm.dispose()
  }
})

test('EXPECT-3 ABSENT expectedTools keeps today\'s behaviour: a zero-registration attach is still ACCEPTED (merged C3/A7 contract untouched)', async () => {
  const silent = writeEventModule('exp3', 'x_assembly_probe', 'never/fired')
  const world = await makeWorld('expected-absent', { bindingIdentities: [], modules: [silent] })
  const { root, realm, agentCtx, agentKey, config } = world
  try {
    const presetProbe = definitionOf(root, agentKey, 'x_assembly_probe')
    const fibers = await row.attachA5sfNativeToolModules(realm, agentCtx, config, agentKey)
    assert.deepEqual([...routingsOf(fibers)[0].forwarded], [], 'nothing is forwarded')
    assert.equal(realm.nativeInvalidation ?? null, null, 'no declaration, no refusal, no invalidation')
    assert.equal(definitionOf(root, agentKey, 'x_assembly_probe'), presetProbe, 'the preset definition is untouched (the pre-declaration behaviour)')
  } finally {
    await realm.dispose()
  }
})

test('E3-fold (event-driven 2026-11-03) the OTHER order: the MANAGED listener registers first — the fold path names the late registration', async () => {
  // Same shape as E3, opposite listener order (the managed module is attached
  // BEFORE the preset-plane listener is applied). This is the order where the
  // realm's own verification is still attached when the registration lands, so
  // the record must name it in `lateRegistrations` — the fold path, not the
  // surface gate. Pinning BOTH orders keeps the record from being "sometimes
  // folds": each order has its own named mechanism and its own assertion.
  const EVENT = 'assembly/provider-added-fold'
  const managedModule = writeEventModule('e3fold', 'x_event_probe', EVENT)
  const world = await makeWorld('event-driven-managed-first', { bindingIdentities: [], modules: [managedModule] })
  const { root, realm, agentCtx, agentKey, config } = world
  const presetPlane = {
    name: 'fixture-preset-event-plane-e3fold',
    inject: ['tools'],
    apply(ctx) {
      ctx.on(EVENT, () => {
        ctx.tools.register({
          name: 'x_event_plane_probe',
          description: 'preset plane event body (fold order)',
          parameters: { type: 'object', properties: {}, additionalProperties: false },
          output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: String(value) }] },
          async execute() { return 'preset-plane-body' },
        })
      })
    },
  }
  try {
    // MANAGED first: the module's listener is registered by the attach, then the
    // preset-plane listener is applied, so the managed registration lands first.
    await row.attachA5sfNativeToolModules(realm, agentCtx, config, agentKey)
    await realm.whenNativeVerificationSettled()
    await agentCtx.plugin(presetPlane)
    assert.doesNotThrow(() => root.emit(EVENT), 'the fold path must not throw either')

    const record = await waitForInvalidation(realm)
    assert.notEqual(record, null, 'the post-settle registration must be RECORDED')
    assert.deepEqual([...record.lateRegistrations], ['x_event_probe'], `the record names the late registration: ${JSON.stringify(record)}`)
    assert.match(record.reason, /after the mount settled/, 'the reason states the post-settle rule')
    assert.deepEqual([...record.uncovered], [], 'the folded definition was live when caught')

    const after = await dispatch(root, agentKey, 'x_event_probe', {})
    assert.equal(after.isError, true, `the folded name must be REFUSED at admission: ${after.text}`)
    assert.equal(after.info?.code, 'A5SF_NATIVE_SHADOW_INVALIDATED', `the refusal must be typed: ${JSON.stringify(after.info)}`)
    assert.equal(after.text.includes('managed-event-body'), false, 'the managed body must not serve after invalidation')
    // ── SUPERSEDED BOUNDARY — DISCLOSED, NOT SILENTLY FLIPPED ────────────────
    // The merged arm asserted (verbatim, before 2026-11-03):
    //
    //   // The preset plane's own (unmanaged) name is outside the declaration and
    //   // outside this attach's managed set: it is NOT denied, and that is expected.
    //   const plane = await dispatch(root, agentKey, 'x_event_plane_probe', {})
    //   assert.equal(plane.isError, false, `an unmanaged name is not the deny's business: ${plane.text}`)
    //   assert.equal(plane.text, 'preset-plane-body')
    //
    // The E8 ruling (2026-11-03) deliberately SUPERSEDES that boundary: an
    // invalidated Member's realm refuses EVERY new invocation at the same
    // `tools/pre-execute` admission point, because the boundary has failed and
    // nothing further may execute. The alternative — freeze everything except
    // preset-plane names — is undecidable at admission (the plane that registered
    // a name is not evidence available there) and would recreate the very
    // intra-emission window E8 measures. So this arm now pins BOTH halves of the
    // new contract: the unmanaged name is DENIED with the blanket freeze code,
    // AND a covered managed name still yields its SPECIFIC name-keyed code.
    const plane = await dispatch(root, agentKey, 'x_event_plane_probe', {})
    assert.equal(plane.isError, true, `an unmanaged name is ALSO refused while the realm is frozen: ${plane.text}`)
    assert.equal(plane.info?.code, 'A5SF_MEMBER_REALM_INVALIDATED', `the blanket refusal is typed: ${JSON.stringify(plane.info)}`)
    assert.equal(plane.text.includes('preset-plane-body'), false, 'the unmanaged preset body must not serve either')
    // Precedence, re-asserted AFTER the blanket case: a covered name is not
    // swallowed by the freeze — it keeps the specific shadow code.
    const coveredAgain = await dispatch(root, agentKey, 'x_event_probe', {})
    assert.equal(coveredAgain.isError, true, 'the covered name stays refused')
    assert.equal(coveredAgain.info?.code, 'A5SF_NATIVE_SHADOW_INVALIDATED', `a covered name keeps its specific code: ${JSON.stringify(coveredAgain.info)}`)
    assert.equal(coveredAgain.text.includes('managed-event-body'), false, 'the covered body must not serve either')
  } finally {
    await realm.dispose()
  }
})

/**
 * A CONFIG-DRIVEN module: its `apply` registers the tool only when the
 * composition passed `config.enabled === true`. This is the shape the review's
 * ATK4 measured with the real `dsh-tool-subagent`: the entry carries a `config`,
 * the condition is NOT met, and the module forwards nothing — so the row cannot
 * verify what the name would resolve to.
 */
function writeConditionalModule(label, toolName) {
  const dir = trackedDir(mkdtempSync(join(tmpdir(), `a5sf-assembly-cond-${label}-`)))
  const file = join(dir, 'conditional.mjs')
  writeFileSync(file, `
export const name = ${JSON.stringify(`fixture-conditional-${label}`)}
export const inject = ['tools', 'fs', 'systemPrompt']
export function apply(ctx, config = {}) {
  if (config.enabled !== true) return
  ctx.tools.register({
    name: ${JSON.stringify(toolName)},
    description: ${JSON.stringify(`conditional ${label} ${toolName}`)},
    parameters: { type: 'object', properties: {}, additionalProperties: false },
    output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: String(value) }] },
    async execute() { return 'conditional-body' },
  })
}
`, 'utf8')
  return pathToFileURL(file).href
}

test('C2-a (review 2026-11-03) a CONFIGURED module with an EMPTY routed frontier is REFUSED — the natural composition cannot silently leave a preset definition serving', async () => {
  // The review's ATK4: the preset plane serves the name on its own provider, the
  // Member's managed entry configures a condition that is not met ("one Member
  // needs the tool, another declares it managed-absent"). The row cannot read the
  // preset plane's module config (measured: §7 of the evidence README), so the
  // default is fail closed for every CONFIGURED module that forwards nothing.
  const conditional = writeConditionalModule('c2a', 'x_assembly_probe')
  const world = await makeWorld('configured-empty-frontier', {
    bindingIdentities: [],
    modules: [{ url: conditional, config: { enabled: false } }],
  })
  const { root, realm, agentCtx, agentKey, config } = world
  try {
    const presetProbe = definitionOf(root, agentKey, 'x_assembly_probe')
    await assert.rejects(
      () => row.attachA5sfNativeToolModules(realm, agentCtx, config, agentKey),
      (error) => {
        assert.equal(error.code, 'A5SF_MANAGED_FRONTIER_EMPTY', `expected the typed empty-frontier refusal, got ${error.name}: ${error.message}`)
        assert.match(error.message, /fixture-conditional-c2a/, 'the refusal NAMES the configured module')
        assert.match(error.message, /allowEmpty/, 'the refusal names the escape hatch')
        return true
      },
      'a configured module that shadows nothing must refuse the attach',
    )
    assert.equal(realm.nativeInvalidation ?? null, null, 'a refused attach is not an invalidation')
    assert.equal(definitionOf(root, agentKey, 'x_assembly_probe'), presetProbe, 'the refusal left the preset definition untouched (it was never executed)')
  } finally {
    await realm.dispose()
  }
})

test('C2-b (review 2026-11-03) `allowEmpty: true` is the EXPLICIT opt-out: the same composition attaches and records nothing', async () => {
  const conditional = writeConditionalModule('c2b', 'x_assembly_probe')
  const world = await makeWorld('configured-empty-allowed', {
    bindingIdentities: [],
    modules: [{ url: conditional, config: { enabled: false }, allowEmpty: true }],
  })
  const { realm, agentCtx, agentKey, config } = world
  try {
    const fibers = await row.attachA5sfNativeToolModules(realm, agentCtx, config, agentKey)
    assert.deepEqual([...routingsOf(fibers)[0].forwarded], [], 'the opt-out accepts the empty frontier')
    assert.equal(realm.nativeInvalidation ?? null, null, 'no invalidation: nothing changed the surface')
  } finally {
    await realm.dispose()
  }
})

test('C2-c (review 2026-11-03) the top-level `a5sfExpectedTools` map declares on a STRING entry — accepted when forwarded, deny covers the name', async () => {
  const moduleA = writeNativeModule('c2c', [{ name: 'x_assembly_probe' }])
  const world = await makeWorld('map-declared-forwarded', { bindingIdentities: [], modules: [moduleA] })
  const { root, realm, agentCtx, agentKey, sinkPath } = world
  const config = row.a5sfRealmConfigOf({
    a5sfEvidencePath: sinkPath,
    a5sfNativeToolModules: [moduleA],
    a5sfExpectedTools: { [moduleA]: ['x_assembly_probe'] },
  })
  try {
    const fibers = await row.attachA5sfNativeToolModules(realm, agentCtx, config, agentKey)
    assert.deepEqual([...routingsOf(fibers)[0].forwarded], ['x_assembly_probe'], 'the string entry is managed and shadowed')
    const served = await dispatch(root, agentKey, 'x_assembly_probe', {})
    assert.equal(served.isError, false, `the shadowed name serves on the routed lane: ${served.text}`)
    assert.equal(served.text, 'ok', 'the fixture body served (not a preset body)')
  } finally {
    await realm.dispose()
  }
})

test('C2-d (review 2026-11-03) the map declaration on a STRING entry that forwards NOTHING is REFUSED, typed', async () => {
  const silent = writeEventModule('c2d', 'x_assembly_probe', 'never/fired')
  const world = await makeWorld('map-declared-unshadowed', { bindingIdentities: [], modules: [silent] })
  const { realm, agentCtx, agentKey, sinkPath } = world
  const config = row.a5sfRealmConfigOf({
    a5sfEvidencePath: sinkPath,
    a5sfNativeToolModules: [silent],
    a5sfExpectedTools: { [silent]: ['x_assembly_probe'] },
  })
  try {
    await assert.rejects(
      () => row.attachA5sfNativeToolModules(realm, agentCtx, config, agentKey),
      (error) => {
        assert.equal(error.code, 'A5SF_EXPECTED_TOOLS_UNSHADOWED', `expected the declaration refusal, got ${error.name}: ${error.message}`)
        assert.match(error.message, /x_assembly_probe/)
        return true
      },
      'the string-entry declaration must be enforced like the object form',
    )
  } finally {
    await realm.dispose()
  }
})

test('C2-e (review 2026-11-03) an `a5sfExpectedTools` specifier that no entry names is a configuration fault (a typo cannot declare nothing)', async () => {
  const moduleA = writeNativeModule('c2e', [{ name: 'x_assembly_probe' }])
  assert.throws(
    () => row.a5sfRealmConfigOf({
      a5sfEvidencePath: '/tmp/a5sf-assembly-c2e.jsonl',
      a5sfNativeToolModules: [moduleA],
      a5sfExpectedTools: { 'file:///typo/other-module.mjs': ['x_assembly_probe'] },
    }),
    (error) => error instanceof TypeError && /a5sfExpectedTools/.test(error.message) && /no .*a5sfNativeToolModules entry/.test(error.message),
    'an orphan declaration must refuse at assembly',
  )
})

test('C3-a (review 2026-11-03) `expectedTools` VALIDATION: a non-array is a configuration fault', async () => {
  assert.throws(
    () => row.a5sfRealmConfigOf({ a5sfEvidencePath: '/tmp/e.jsonl', a5sfNativeToolModules: [{ url: 'file:///x.mjs', expectedTools: 'read' }] }),
    (error) => error instanceof TypeError && /expectedTools must be an array/.test(error.message),
  )
})

test('C3-b `expectedTools` VALIDATION: an EMPTY array is a contradiction, not an opt-out', async () => {
  assert.throws(
    () => row.a5sfRealmConfigOf({ a5sfEvidencePath: '/tmp/e.jsonl', a5sfNativeToolModules: [{ url: 'file:///x.mjs', expectedTools: [] }] }),
    (error) => error instanceof TypeError && /must not be empty/.test(error.message),
  )
})

test('C3-c `expectedTools` VALIDATION: a BLANK name is a fault', async () => {
  assert.throws(
    () => row.a5sfRealmConfigOf({ a5sfEvidencePath: '/tmp/e.jsonl', a5sfNativeToolModules: [{ url: 'file:///x.mjs', expectedTools: ['read', '  '] }] }),
    (error) => error instanceof TypeError && /non-blank tool-name strings/.test(error.message),
  )
})

test('C3-d `expectedTools` VALIDATION: a NON-STRING name is a fault', async () => {
  assert.throws(
    () => row.a5sfRealmConfigOf({ a5sfEvidencePath: '/tmp/e.jsonl', a5sfNativeToolModules: [{ url: 'file:///x.mjs', expectedTools: ['read', 7] }] }),
    (error) => error instanceof TypeError && /non-blank tool-name strings/.test(error.message),
  )
})

test('C3-e `expectedTools` VALIDATION: a DUPLICATE name is a fault', async () => {
  assert.throws(
    () => row.a5sfRealmConfigOf({ a5sfEvidencePath: '/tmp/e.jsonl', a5sfNativeToolModules: [{ url: 'file:///x.mjs', expectedTools: ['read', 'read'] }] }),
    (error) => error instanceof TypeError && /more than once/.test(error.message),
  )
})

test('C3-f `expectedTools` VALIDATION: the top-level map refuses the same faults (empty map, non-array entry)', async () => {
  assert.throws(
    () => row.a5sfRealmConfigOf({ a5sfEvidencePath: '/tmp/e.jsonl', a5sfNativeToolModules: ['file:///x.mjs'], a5sfExpectedTools: {} }),
    (error) => error instanceof TypeError && /at least one module specifier/.test(error.message),
  )
  assert.throws(
    () => row.a5sfRealmConfigOf({ a5sfEvidencePath: '/tmp/e.jsonl', a5sfNativeToolModules: ['file:///x.mjs'], a5sfExpectedTools: { 'file:///x.mjs': 'read' } }),
    (error) => error instanceof TypeError && /must be an array/.test(error.message),
  )
})

// ===========================================================================
// E8 (freeze 2026-11-03) — THE INTRA-EMISSION DISPATCH WINDOW.
//
// Measured on the base tree (`evidence/a5sf-event-driven` probe E8): the preset
// plane's listener registers the managed name INSIDE the synchronous
// `provider-added` emission, the surface gate sets the invalidation record and
// detaches verification, the teardown is deferred one microtask — and a dispatch
// issued by ANOTHER listener in the SAME emission is ADMITTED, because the
// managed registration has not landed yet and the deny only covered the names
// `expectedDefinitions` already knew. The body that then ran was the PRESET
// definition: exactly the definition the record exists to refuse.
//
// THE FIX (user ruling, 2026-11-03): while a Member's managed realm is
// invalidated, refuse EVERY tool invocation at the existing `tools/pre-execute`
// admission stage — not only the covered names. The record is the realm's own
// state; the admission point already exists. Nothing further executes after the
// boundary has failed; the deny lifts only on a full verified re-assembly.
// ===========================================================================

/** A preset-plane listener that registers `toolName` from `eventName`. */
function writePresetEventPlane(label, toolName, eventName, body) {
  const dir = trackedDir(mkdtempSync(join(tmpdir(), `a5sf-assembly-preset-event-${label}-`)))
  const file = join(dir, 'preset-event.mjs')
  writeFileSync(file, `
export const name = ${JSON.stringify(`fixture-preset-event-${label}`)}
export const inject = ['tools']
export function apply(ctx) {
  ctx.on(${JSON.stringify(eventName)}, () => {
    ctx.tools.register({
      name: ${JSON.stringify(toolName)},
      description: ${JSON.stringify(`preset event plane ${label} ${toolName}`)},
      parameters: { type: 'object', properties: {}, additionalProperties: false },
      output: { schema: { type: 'string' }, render: (_args, value) => [{ type: 'text', text: String(value) }] },
      async execute() { return ${JSON.stringify(body)} },
    })
  })
}
`, 'utf8')
  return pathToFileURL(file).href
}

test('E8 (freeze 2026-11-03) a dispatch issued inside the boundary emission is REFUSED by the frozen realm; neither body serves', async () => {
  const EVENT = 'assembly/e8-provider-added'
  const MANAGED = 'x_e8_managed'
  const window = {}
  const managedModule = writeEventModule('e8', MANAGED, EVENT)
  const presetPlane = writePresetEventPlane('e8', MANAGED, EVENT, 'preset-e8-body')
  const world = await makeWorld('e8-freeze', { bindingIdentities: [], modules: [managedModule] })
  const { root, realm, agentCtx, agentKey, config } = world
  try {
    // Product order: the preset plane exists BEFORE the Member is assembled, so
    // its listener runs FIRST in the boundary emission.
    await world.standingCtx.plugin(await import(presetPlane))
    // The "another listener" of the measured shape: mounted between the preset
    // plane and the managed attach, it dispatches INSIDE the same emission.
    await agentCtx.plugin({
      name: 'fixture-e8-window-spy',
      inject: ['tools'],
      apply(ctx) {
        ctx.on(EVENT, () => {
          if (window.dispatch !== undefined) return
          window.issued = true
          window.dispatch = dispatch(root, agentKey, MANAGED, {})
        })
      },
    })
    const fibers = await row.attachA5sfNativeToolModules(realm, agentCtx, config, agentKey)
    await realm.whenNativeVerificationSettled()
    assert.equal(realm.nativeInvalidation ?? null, null, 'the attach itself is healthy before the event')
    assert.deepEqual([...routingsOf(fibers)[0].forwarded], [], 'the event-driven module registered nothing during apply')
    // BOUNDED: the freeze is set ONLY by an invalidation record — a healthy
    // realm admits the very same unmanaged name that will be denied below.
    assert.equal(realm.nativeInvalidation ?? null, null, 'no record, no freeze')
    const healthy = await dispatch(root, agentKey, 'x_assembly_probe', {})
    assert.equal(healthy.isError, false, `a healthy realm admits normally: ${healthy.text}`)
    assert.equal(healthy.text, 'preset')

    // THE MEASURED SEQUENCE. Pre-fix: the emission completed, the window
    // dispatch was ADMITTED and served `preset-e8-body` (the definition the
    // record exists to refuse).
    assert.doesNotThrow(() => root.emit(EVENT), 'the boundary emission must complete')
    assert.equal(window.issued, true, 'the window dispatch was actually issued inside the emission')
    const inWindow = await window.dispatch
    const record = await waitForInvalidation(realm)
    assert.notEqual(record, null, 'the preset-plane registration inside the emission invalidates the realm')
    assert.ok([...record.surfaceAdded].includes(MANAGED), `the record names the name that appeared: ${JSON.stringify(record)}`)

    // THE FREEZE: the in-window call is REFUSED with the realm-freeze code, and
    // the typed name-keyed code is NOT what answered (the name was not yet a
    // covered name when the dispatch passed admission).
    assert.equal(inWindow.isError, true, `a dispatch inside the invalidated boundary must be REFUSED: ${inWindow.text}`)
    assert.equal(inWindow.info?.code, 'A5SF_MEMBER_REALM_INVALIDATED', `the window refusal must carry the freeze code: ${JSON.stringify(inWindow.info)}`)
    assert.equal(inWindow.text.includes('preset-e8-body'), false, 'the preset definition must never run')
    assert.equal(inWindow.text.includes('managed-event-body'), false, 'the managed body must not serve either')
    assert.match(inWindow.text, /re-assembl/, 'the refusal states what un-freezes the Member')

    // NAME-KEYED PRECEDENCE: once the managed registration has landed and been
    // folded, the covered name yields the SPECIFIC shadow code (the merged E3/
    // E3-fold/P0 contract), not the generic freeze.
    const covered = await dispatch(root, agentKey, MANAGED, {})
    assert.equal(covered.isError, true, 'the covered name is refused after the emission too')
    assert.equal(covered.info?.code, 'A5SF_NATIVE_SHADOW_INVALIDATED', `a KNOWN covered name keeps its specific code: ${JSON.stringify(covered.info)}`)
    assert.match(covered.text, /x_e8_managed/, 'the name-keyed refusal names the tool')

    // REGISTRATION STILL COMPLETES (registration semantics unchanged): the
    // managed listener ran during the invalidation, its registration landed on
    // the still-live router, and admission FOLDED it into the managed set —
    // that fold is exactly why the dispatch above answered with the SPECIFIC
    // name-keyed code instead of the freeze code. (The fiber's receipt is an
    // attach-time snapshot, so it correctly still shows nothing.)
    assert.deepEqual([...routingsOf(fibers)[0].forwarded], [], 'the routing receipt is the attach-time snapshot; the name landed afterwards')
    assert.notEqual(definitionOf(root, agentKey, MANAGED), undefined, 'a definition of the managed name is visible after the teardown')

    // EVERY call is refused while frozen: a name this attach never managed
    // (the preset row's `x_assembly_probe`, zero I/O) is denied too. That cost is
    // accepted: the boundary failed, so nothing further executes.
    const unmanaged = await dispatch(root, agentKey, 'x_assembly_probe', {})
    assert.equal(unmanaged.isError, true, `an unmanaged name is refused while the realm is frozen: ${unmanaged.text}`)
    assert.equal(unmanaged.info?.code, 'A5SF_MEMBER_REALM_INVALIDATED', `the blanket refusal is typed: ${JSON.stringify(unmanaged.info)}`)
    assert.equal(unmanaged.text.includes('preset'), false, 'no preset body serves an unmanaged name either')

    // BOUNDED LIFT: the caller's own native-attach release does NOT lift the
    // freeze (an invalid realm keeps the deny; only a whole-realm re-assembly
    // does — the E8-lift arm proves that half). A Member that can never be
    // re-assembled therefore stays frozen permanently; that is reported through
    // `nativeInvalidation` (and the invalidation log), NOT a Member-status
    // surface — the frozen glue has none (see the evidence README).
    await realm.disposeNativeToolModules()
    const stillFrozen = await dispatch(root, agentKey, 'x_assembly_probe', {})
    assert.equal(stillFrozen.isError, true, 'releasing the native attach must not lift the freeze')
    assert.equal(stillFrozen.info?.code, 'A5SF_MEMBER_REALM_INVALIDATED', `still the blanket code: ${JSON.stringify(stillFrozen.info)}`)
    assert.equal(realm.nativeInvalidation !== null, true, 'the record that froze the realm is still observable')
  } finally {
    await realm.dispose()
  }
})

test('E8-lift (freeze 2026-11-03) the freeze lifts ONLY on a full verified re-assembly — a fresh mount + attach admits calls again', async () => {
  const EVENT = 'assembly/e8-lift-provider-added'
  const MANAGED = 'x_e8_lift_managed'
  const managedModule = writeEventModule('e8lift', MANAGED, EVENT)
  const world = await makeWorld('e8-freeze-lift', { bindingIdentities: [], modules: [managedModule] })
  const { root, realm, agentCtx, agentKey, config } = world
  try {
    // 1. Invalidate through the same intra-emission shape (a preset plane
    //    listener registering the managed name is enough; no spy needed).
    await world.standingCtx.plugin(await import(writePresetEventPlane('e8lift', MANAGED, EVENT, 'preset-e8-lift-body')))
    await row.attachA5sfNativeToolModules(realm, agentCtx, config, agentKey)
    await realm.whenNativeVerificationSettled()
    assert.doesNotThrow(() => root.emit(EVENT))
    const record = await waitForInvalidation(realm)
    assert.notEqual(record, null, 'the realm is invalidated')
    const frozen = await dispatch(root, agentKey, 'x_assembly_probe', {})
    assert.equal(frozen.info?.code, 'A5SF_MEMBER_REALM_INVALIDATED', 'the Member is frozen')

    // 2. A PARTIAL restoration is refused: the invalid realm cannot re-attach.
    await assert.rejects(
      () => realm.mountNativeToolModules([{ module: { name: 'x-partial', apply() {} } }]),
      /invalidated/i,
      'no partial re-attach can lift the freeze',
    )

    // 3. A FULL re-assembly — dispose the Member realm and mount + attach a NEW
    //    one on the same agent/tool plane — passes verification and admits.
    await realm.dispose()
    const realm2 = await world.remountRealm()
    try {
      await row.attachA5sfNativeToolModules(realm2, agentCtx, config, agentKey)
      await realm2.whenNativeVerificationSettled()
      assert.equal(realm2.nativeInvalidation ?? null, null, 'the re-assembled realm is verified, not invalid')
      const admitted = await dispatch(root, agentKey, 'x_assembly_probe', {})
      assert.equal(admitted.isError, false, `calls are admitted again after a full re-assembly: ${admitted.text}`)
      assert.equal(admitted.text, 'preset', 'the unmanaged preset row serves normally again')
    } finally {
      await realm2.dispose()
    }
  } finally {
    await realm.dispose()
  }
})

test('ACK-1 (allowEmpty 2026-11-03) an acknowledged-empty attach carries the flag explicitly; a non-empty attach does not', async () => {
  const conditional = writeConditionalModule('ack1', 'x_assembly_probe')
  const empty = await makeWorld('ack-empty', {
    bindingIdentities: [],
    modules: [{ url: conditional, config: { enabled: false }, allowEmpty: true }],
  })
  try {
    await row.attachA5sfNativeToolModules(empty.realm, empty.agentCtx, empty.config, empty.agentKey)
    const record = empty.realm.nativeAttachRecord ?? null
    assert.notEqual(record, null, 'a successful attach publishes its record')
    assert.equal(record.schema, 'a5sf-native-attach/1')
    assert.equal(record.emptyFrontierAcknowledged, true, 'the opt-out is RECORDED, not inferred away')
    assert.deepEqual([...record.emptyFrontierModules], ['fixture-conditional-ack1'], 'the acknowledged module is named')
    assert.deepEqual([...record.emptyFrontierSpecifiers], [conditional], 'the ROW-CONFIG specifier is recorded, so an operator can trace the acceptance')
    assert.deepEqual([...record.acknowledgedNames], [], 'nothing was declared on this entry')
  } finally {
    await empty.realm.dispose()
  }

  const moduleA = writeNativeModule('ack2', [{ name: 'read', reads: true }, { name: 'write' }])
  const nonEmpty = await makeWorld('ack-nonempty', { bindingIdentities: [], modules: [moduleA] })
  try {
    await row.attachA5sfNativeToolModules(nonEmpty.realm, nonEmpty.agentCtx, nonEmpty.config, nonEmpty.agentKey)
    const record = nonEmpty.realm.nativeAttachRecord ?? null
    assert.notEqual(record, null, 'a non-empty attach also publishes its record')
    assert.equal(record.emptyFrontierAcknowledged, false, 'a verified non-empty frontier is NOT an acknowledgement')
    assert.deepEqual([...record.emptyFrontierModules], [])
    assert.deepEqual([...record.emptyFrontierSpecifiers], [])
    assert.deepEqual([...record.acknowledgedNames], [])
  } finally {
    await nonEmpty.realm.dispose()
  }
})

test('ACK-2 (allowEmpty 2026-11-03) `allowEmpty` may acknowledge an EMPTY frontier that DECLARED names: accepted, and the names are carried as acknowledged, never as verified', async () => {
  const silent = writeEventModule('ack2', 'x_ack_probe', 'never/fired')
  const world = await makeWorld('ack-declared-empty', {
    bindingIdentities: [],
    modules: [{ url: silent, config: { enabled: true }, expectedTools: ['x_ack_probe'], allowEmpty: true }],
  })
  try {
    const fibers = await row.attachA5sfNativeToolModules(world.realm, world.agentCtx, world.config, world.agentKey)
    assert.deepEqual([...routingsOf(fibers)[0].forwarded], [], 'the acknowledged frontier is empty')
    const record = world.realm.nativeAttachRecord ?? null
    assert.equal(record.emptyFrontierAcknowledged, true, 'the empty frontier is acknowledged')
    assert.deepEqual([...record.acknowledgedNames], ['x_ack_probe'], 'the DECLARED names are recorded as acknowledged (not shadowed, not verified)')
  } finally {
    await world.realm.dispose()
  }
})
