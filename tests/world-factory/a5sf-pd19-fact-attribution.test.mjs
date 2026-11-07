/**
 * a5sf-pd19-fact-attribution.test.mjs — PD-19: a guard fact names the TOOL CALL
 * it was decided for.
 *
 * THE GAP THIS CLOSES. `a5sf-guard-consult/1` carried the Member, the realm, the
 * policy revision, the provider method and the locator — but no tool identity and
 * no call id. A reader therefore could not answer "which tool call was refused?"
 * from the fact alone; it could only infer a join from timestamps and locators.
 * PD-19 adds two ATTRIBUTION-ONLY fields, `tool` and `callId`, copied from the
 * registry's own `tools/execute` dispatch (`ToolExecution.name` /
 * `ToolExecution.callId`).
 *
 * WHAT THIS SUITE MEASURES (host-free; ZERO boots, ZERO ports, no DSH_HOME):
 *
 *   FA1 ALLOW — a real native `read` dispatched through the REAL
 *       `@deepseek-ai/dsh-tools` registry over the REAL product mount produces
 *       facts carrying `tool:"read"` and the exact dispatch `callId`, together
 *       with the pre-existing Member/policy fields.
 *   FA2 DENY — a refused out-of-lane read is attributed to the SAME call; the
 *       bytes never appear. The decision is exactly the pre-PD-19 one
 *       (`deny` / `IO_READ_DENIED`), so attribution did not soften the refusal.
 *   FA3 CONCURRENCY — two overlapping dispatches keep their own ids; no fact
 *       carries the other call's id (the carrier is async-context-scoped, not a
 *       module-global "last call").
 *   FA4 NO DISPATCH — a direct confined-Provider read (no tool call) records
 *       `tool:null` / `callId:null`: the honest absence, never a fabricated id.
 *   FA5 BACKWARD COMPATIBILITY — an old-format fact (neither key) still parses
 *       through `readGuardConsultFile`; a new-format fact with `null` parses
 *       too; a malformed value is refused. Old evidence is not invalidated.
 *   FA6 BINDING REALM — when a narrower binding realm serves the call, its fact
 *       carries the same `tool` + `callId` as well as its own
 *       `toolBindingIdentity`; attribution is not Member-realm-specific.
 *   FA7 DECISION NEUTRALITY (structural) — the attribution carrier is read only
 *       by `observeGuard`/its installer; the guards (`fs.ts`, `subprocess.ts`,
 *       `web.ts`) never mention it. No second policy source, no decision change.
 *
 * LIMITS: this suite does NOT boot a Host, does NOT prove the live Member
 * preset's `grep` dispatches through this listener (that is a `DEV-LIVE` question
 * and no boot was spent here), and does NOT prove a fact from a tool call is
 * sufficient for a Q7 claim. It proves the join key exists and is honest.
 *
 * CORE PATCH BUDGET = 0. Nothing here touches `tests/deepseek-harness-test-use/`
 * (read only) and no upstream source is modified.
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

register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)

const row = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs')).href)
const transports = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'team-services', 'src', 'guard-observability.ts')).href)

const runtimeRequire = createRequire(join(REPO_ROOT, 'packages', 'runtime', 'package.json'))
const { Context, Service } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href)
const ToolRuntime = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-tools')).href)).default
const SystemPrompt = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-system-prompt')).href)).default
const { bindScopeParent, createScope } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-scope')).href)

const BASELINE_TOOL_FS = join(REPO_ROOT, 'tests', 'deepseek-harness-test-use', 'packages', 'fs', 'tool-fs', 'lib', 'index.js')
assert.equal(
  existsSync(BASELINE_TOOL_FS),
  true,
  `the pinned native tool package must exist (${BASELINE_TOOL_FS}); provision tests/deepseek-harness-test-use per docs/TEST_METHODS.md §1`,
)
const nativeToolModules = await import(pathToFileURL(BASELINE_TOOL_FS).href)

// ===========================================================================
// fixtures: one compiled Member ceiling (and one narrower read binding)
// ===========================================================================

const IDENTITY = Object.freeze({
  teamId: 'team-a5sf-pd19',
  memberInstanceId: 'member-pd19-a',
  templateId: 'worker',
  instanceGeneration: 2,
})
const READ_BINDING = 'dsh.fs/read'
const MEMBER_REVISION = 'a5sf1:member-pd19-a:g2'
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

function effectivePolicy(readRoot, writeRoot = readRoot) {
  return Object.freeze({
    memberIdentity: IDENTITY.memberInstanceId,
    toolBindingIdentity: READ_BINDING,
    invocationId: 'call-pd19-binding-fixture',
    policyRevision: BINDING_REVISION,
    read: lane([readRoot]),
    write: lane([writeRoot]),
    network: Object.freeze({ access: 'allow' }),
  })
}

/** A minimal real `fs` Provider surface (the base the confined class wraps). */
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
    return readFileSync(this.processPath(target), 'utf8')
  }

  async streamText(target) {
    const text = await this.readText(target)
    return (async function* stream() {
      yield text
    })()
  }

  async readBytes(target) {
    return readFileSync(this.processPath(target))
  }

  async readByteRange(target, range) {
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
    writeFileSync(this.processPath(target), String(content))
    return { operation: 'update', version: 'v1', before: '', after: String(content) }
  }

  async editText() {
    return { version: 'v2', before: '', after: '' }
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
function makeFixture() {
  const dir = trackedDir(mkdtempSync(join(tmpdir(), 'a5sf-pd19-')))
  const inside = join(dir, 'lane')
  mkdirSync(inside, { recursive: true })
  writeFileSync(join(inside, 'a.txt'), 'PD19_ALLOW_A\n', 'utf8')
  writeFileSync(join(inside, 'b.txt'), 'PD19_ALLOW_B\n', 'utf8')
  writeFileSync(join(dir, 'outside.txt'), 'PD19_OUTSIDE_SECRET\n', 'utf8')
  return { dir, inside, a: join(inside, 'a.txt'), b: join(inside, 'b.txt'), outside: join(dir, 'outside.txt') }
}
function tmpSink() {
  const dir = trackedDir(mkdtempSync(join(tmpdir(), 'a5sf-pd19-sink-')))
  return join(dir, 'consult.jsonl')
}
function readFacts(sinkPath) {
  if (!existsSync(sinkPath)) return []
  return readFileSync(sinkPath, 'utf8').trim().split('\n').filter(Boolean).map((line) => JSON.parse(line))
}

async function mountRealm({ root, ceiling, bindings = [], sinkPath }) {
  const standingKey = {}
  const standing = createScope(root, standingKey)
  await standing.ctx.plugin(nativeToolModules)
  const agentKey = { session: { header: {} } }
  const agent = createScope(root, agentKey)
  bindScopeParent(agentKey, standingKey)
  const realm = await row.mountMemberA5sfRealm({
    root: agent.ctx,
    a5sfConfig: row.a5sfRealmConfigOf({ a5sfEvidencePath: sinkPath }),
    provider: () => ({
      compiledFor: () => ({
        members: [{ identity: IDENTITY, policy: { ok: true, value: ceiling } }],
        ...(bindings.length === 0
          ? {}
          : { bindings: bindings.map((effective) => ({ identity: IDENTITY, toolBindingIdentity: READ_BINDING, effective })) }),
        providerClass: TestFileSystem,
      }),
    }),
    member: {
      sessionId: 'session-pd19',
      instanceId: IDENTITY.memberInstanceId,
      teamRootSessionId: 'team-root-pd19',
      templateId: IDENTITY.templateId,
    },
  })
  assert.notEqual(realm, undefined, 'a configured row with a provider must mount a realm')
  await row.attachA5sfNativeToolModules(
    realm,
    agent.ctx,
    row.a5sfRealmConfigOf({ a5sfEvidencePath: sinkPath, a5sfNativeToolModules: [BASELINE_TOOL_FS] }),
    agentKey,
  )
  return { realm, agentCtx: agent.ctx, agentKey }
}

async function dispatch(root, agentKey, name, args, callId) {
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
  return { isError: settled.isError === true, text }
}

const factsFor = (facts, callId) => facts.filter((fact) => fact.callId === callId)

after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
})

// ===========================================================================
// FA1 / FA2 — the allow and deny facts carry the dispatch identity
// ===========================================================================

test('FA1 allow fact names the real tool and callId', async () => {
  const root = await makeRoot()
  const fixture = makeFixture()
  const sinkPath = tmpSink()
  const { agentKey } = await mountRealm({ root, ceiling: memberPolicy(fixture.inside), sinkPath })

  const result = await dispatch(root, agentKey, 'read', { file_path: fixture.a }, 'pd19-call-allow-1')
  assert.equal(result.isError, false, `the in-lane read must succeed, got: ${result.text}`)
  assert.match(result.text, /PD19_ALLOW_A/)

  const facts = readFacts(sinkPath)
  assert.ok(facts.length >= 1, 'the consulted read must emit at least one fact')
  for (const fact of facts) {
    assert.equal(fact.schema, 'a5sf-guard-consult/1')
    assert.equal(fact.realm, 'member')
    assert.equal(fact.memberIdentity, IDENTITY.memberInstanceId)
    assert.equal(fact.policyRevision, MEMBER_REVISION)
    assert.equal(fact.tool, 'read', 'the fact must name the native tool that was dispatched')
    assert.equal(fact.callId, 'pd19-call-allow-1', 'the fact must carry the registry call identity')
  }
  assert.ok(facts.some((fact) => fact.decision === 'allow' && fact.decidedBy === 'ALLOW'))
})

test('FA2 deny fact is attributed to the same call, and the decision is unchanged', async () => {
  const root = await makeRoot()
  const fixture = makeFixture()
  const sinkPath = tmpSink()
  const { agentKey } = await mountRealm({ root, ceiling: memberPolicy(fixture.inside), sinkPath })

  const result = await dispatch(root, agentKey, 'read', { file_path: fixture.outside }, 'pd19-call-deny-1')
  assert.equal(result.isError, true, 'the out-of-lane read must be refused')
  assert.doesNotMatch(result.text, /PD19_OUTSIDE_SECRET/, 'the refused bytes must never be returned')

  const denied = readFacts(sinkPath).filter((fact) => fact.decision === 'deny')
  assert.equal(denied.length, 1, 'exactly one deny fact for the refused read')
  const [fact] = denied
  assert.equal(fact.decidedBy, 'IO_READ_DENIED')
  assert.equal(fact.tool, 'read')
  assert.equal(fact.callId, 'pd19-call-deny-1')
  assert.equal(fact.locator, fixture.outside, 'the fact still names the locator it decided on')
})

// ===========================================================================
// FA3 — concurrency: one carrier per async dispatch, never a "last call" global
// ===========================================================================

test('FA3 overlapping dispatches keep their own call ids', async () => {
  const root = await makeRoot()
  const fixture = makeFixture()
  const sinkPath = tmpSink()
  const { agentKey } = await mountRealm({ root, ceiling: memberPolicy(fixture.inside), sinkPath })

  const [a, b] = await Promise.all([
    dispatch(root, agentKey, 'read', { file_path: fixture.a }, 'pd19-concurrent-a'),
    dispatch(root, agentKey, 'read', { file_path: fixture.b }, 'pd19-concurrent-b'),
  ])
  assert.equal(a.isError, false)
  assert.equal(b.isError, false)

  const facts = readFacts(sinkPath)
  const forA = factsFor(facts, 'pd19-concurrent-a')
  const forB = factsFor(facts, 'pd19-concurrent-b')
  assert.ok(forA.length >= 1, 'call A must have its own facts')
  assert.ok(forB.length >= 1, 'call B must have its own facts')
  for (const fact of forA) assert.equal(fact.locator, fixture.a, 'call A never records call B\'s locator')
  for (const fact of forB) assert.equal(fact.locator, fixture.b, 'call B never records call A\'s locator')
})

// ===========================================================================
// FA4 — no dispatch in scope ⇒ null, never a fabricated identity
// ===========================================================================

test('FA4 a direct Provider read records null tool/callId', async () => {
  const root = await makeRoot()
  const fixture = makeFixture()
  const sinkPath = tmpSink()
  const { realm } = await mountRealm({ root, ceiling: memberPolicy(fixture.inside), sinkPath })

  const fs = realm.installation.members[0].fs
  const target = await fs.resolve(fixture.a)
  const text = await fs.readText(target)
  assert.match(text, /PD19_ALLOW_A/)

  const facts = readFacts(sinkPath)
  assert.equal(facts.length, 1, 'one direct consultation, one fact')
  assert.equal(facts[0].decision, 'allow')
  assert.equal(facts[0].tool, null, 'no tool dispatch in scope => no tool identity')
  assert.equal(facts[0].callId, null, 'no tool dispatch in scope => no call identity')
})

// ===========================================================================
// FA5 — old evidence stays valid
// ===========================================================================

test('FA5 old-format facts parse; malformed attribution is refused', async () => {
  const dir = trackedDir(mkdtempSync(join(tmpdir(), 'a5sf-pd19-compat-')))
  const path = join(dir, 'facts.jsonl')
  const oldShape = {
    schema: 'a5sf-guard-consult/1',
    realm: 'member',
    memberIdentity: IDENTITY.memberInstanceId,
    toolBindingIdentity: null,
    policyRevision: MEMBER_REVISION,
    method: 'readText',
    locator: '/old/tree/inside.txt',
    decision: 'allow',
    decidedBy: 'ALLOW',
    sequence: 1,
    observedAt: '2026-11-04T00:00:00.000Z',
  }
  const newShape = { ...oldShape, sequence: 2, tool: 'read', callId: 'pd19-old-reader-call' }
  const nullShape = { ...oldShape, sequence: 3, tool: null, callId: null }
  writeFileSync(path, [oldShape, newShape, nullShape].map((fact) => JSON.stringify(fact)).join('\n') + '\n')

  const facts = await transports.readGuardConsultFile(path)
  assert.equal(facts.length, 3, 'all three records are valid')
  assert.equal(facts[0].tool, undefined, 'a pre-PD-19 fact has no tool key — that is the previous schema, not an error')
  assert.equal(facts[0].callId, undefined)
  assert.equal(facts[1].tool, 'read')
  assert.equal(facts[1].callId, 'pd19-old-reader-call')
  assert.equal(facts[2].tool, null)
  assert.equal(facts[2].callId, null)

  writeFileSync(path, `${JSON.stringify({ ...oldShape, tool: 7 })}\n`)
  await assert.rejects(
    () => transports.readGuardConsultFile(path),
    (error) => error?.code === 'CONSULT_FILE_INVALID',
    'a non-string tool value must be refused by the strict reader',
  )
})

// ===========================================================================
// FA6 — the narrower binding realm's fact carries the same attribution
// ===========================================================================

test('FA6 binding-realm facts also carry tool + callId', async () => {
  const root = await makeRoot()
  const fixture = makeFixture()
  const sinkPath = tmpSink()
  const { agentKey } = await mountRealm({
    root,
    ceiling: memberPolicy(fixture.inside),
    bindings: [effectivePolicy(fixture.inside)],
    sinkPath,
  })

  const result = await dispatch(root, agentKey, 'read', { file_path: fixture.a }, 'pd19-binding-call-1')
  assert.equal(result.isError, false)

  const bindingFacts = readFacts(sinkPath).filter((fact) => fact.realm === 'binding')
  assert.ok(bindingFacts.length >= 1, 'the bound read must consult the binding realm')
  for (const fact of bindingFacts) {
    assert.equal(fact.toolBindingIdentity, READ_BINDING)
    assert.equal(fact.tool, 'read')
    assert.equal(fact.callId, 'pd19-binding-call-1')
  }
})

// ===========================================================================
// FA7 — the carrier is not a policy input (structural, not a runtime claim)
// ===========================================================================

test('FA7 no guard module reads the attribution carrier', () => {
  const guards = [
    'packages/runtime/team-services/src/fs.ts',
    'packages/runtime/team-services/src/subprocess.ts',
    'packages/runtime/team-services/src/web.ts',
    'packages/runtime/team-services/src/terminal.ts',
  ]
  for (const relative of guards) {
    const source = readFileSync(join(REPO_ROOT, relative), 'utf8')
    assert.doesNotMatch(source, /TOOL_CALL_ATTRIBUTION|currentGuardToolCallAttribution|attachGuardToolCallAttribution/, `${relative} must not read the attribution carrier`)
  }
  const observability = readFileSync(join(REPO_ROOT, 'packages/runtime/team-services/src/guard-observability.ts'), 'utf8')
  assert.match(observability, /const TOOL_CALL_ATTRIBUTION = new AsyncLocalStorage/)
  assert.equal(
    (observability.match(/TOOL_CALL_ATTRIBUTION\.getStore\(\)/g) ?? []).length,
    2,
    'the exported accessor plus the ONE fact read site (observeGuard); a third reader would need its own justification',
  )
})
