/**
 * a5sf-p2-wiring.test.mjs — the PRODUCT-ROW wiring C1 suite (Alpha.5 P2).
 *
 * ZERO Host boots, ZERO ports bound, no DSH_HOME, no `tests/homes/**`, no
 * pristine host tree: the only Context created is an in-process Cordis unit
 * root, and every fixture/sink lives in a `mkdtemp` directory.
 *
 * Run: node --test tests/world-factory/a5sf-p2-wiring.test.mjs
 *
 * What it proves — the call site, not the seam (the seam has its own suite,
 * `a5sf-p2-seam.test.mjs`):
 *   W1 THE CALL-SITE HELPER MOUNTS AND UNMOUNTS — the exact helper the live
 *      Member setup calls (`packages/runtime/src/plugin/live/a5sf-realm-row.mjs`
 *      `mountMemberA5sfRealm`) mounts the compiled realm (ceiling + binding)
 *      over the REAL P2 installers on the row-configured evidence path, one
 *      fact per consultation with the expected schema, and the returned realm's
 *      `dispose()` really releases both realms (a remount of the same identity
 *      proves it — a mounted realm answers SERVICE_ALREADY_INSTALLED).
 *   W2 DEFAULT PATH DOES NOTHING — with no row config, or with config but no
 *      provider, or with a provider that answers `undefined`, the helper
 *      returns `undefined`: the provider accessor is never called, no realm is
 *      mounted, no sink exists, no file is written. That is the normal/legacy
 *      row, and it is the proof the wiring is additive.
 *   W3 SINK FAILURE FAILS CLOSED — a row-configured sink that cannot be written
 *      makes the consulted call reject `GUARD_OBSERVATION_FAILED` and the base
 *      Provider is never asked (`providerReads === 0`): the wiring adds no
 *      catch and cannot degrade an unrecorded decision into an effect.
 *   W4 CONFIG READER — absent ⇒ `undefined`; present blank/non-string ⇒ a loud
 *      TypeError at row assembly; present valid ⇒ a frozen `{ evidencePath }`.
 *      The path is whatever the row configuration says (never hardcoded here).
 *   W5 MALFORMED PROVIDER ANSWERS THROW — a declared wiring that cannot mount
 *      is a configuration fault, never a silent no-op.
 *   W6 THE GLUE'S CALL SITE IS GUARDED (structural pin) — the product glue
 *      mounts only inside the both-halves-present guard, keeps the disposer on
 *      the row drain, and imports the helper (so the wiring cannot be silently
 *      deleted without this suite noticing). This arm reads SOURCE; it proves
 *      the shape of the call site, not a live setup.
 *
 * LIMITS (stated so no reader over-claims): this suite does NOT boot a Host, does
 * NOT run a live agent row, does NOT prove kernel enforcement and does NOT prove
 * a native `read` tool path or a Host-attributable effect. The boot budget is
 * still 0.
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
/** The seam's transport reader for the round-trip arm. */
const transports = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'team-services', 'src', 'guard-observability.ts')).href)
/** `@deepseek-ai/cordis` is a devDependency of `packages/runtime` (pnpm strict). */
const runtimeRequire = createRequire(join(REPO_ROOT, 'packages', 'runtime', 'package.json'))
const { Context, Service } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href)

// --- fixtures: a compiled-shaped Member ceiling + a narrower binding ---------

const IDENTITY = Object.freeze({
  teamId: 'team-a5sf-wiring',
  memberInstanceId: 'member-wiring-a',
  templateId: 'worker',
  instanceGeneration: 3,
})
const BINDING = 'dsh.fs/read'
const MEMBER_REVISION = 'a5sf1:member-wiring-a:g3'
const BINDING_REVISION = 'a5sf1:member-wiring-a:g3:dsh.fs/read'

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
    invocationId: 'call-wiring-1',
    policyRevision: BINDING_REVISION,
    read: lane([allowRoot]),
    write: lane([allowRoot]),
    network: Object.freeze({ access: 'allow' }),
  })
}

/** Count base-Provider reads so "the Provider was never asked" is measurable. */
let providerReads = 0

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
    providerReads += 1
    return readFileSync(this.processPath(target), 'utf8')
  }

  async streamText(target) {
    const text = await this.readText(target)
    return (async function* stream() {
      yield text
    })()
  }

  async readBytes(target) {
    providerReads += 1
    return readFileSync(this.processPath(target))
  }

  async readByteRange(target, range) {
    providerReads += 1
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

/** One host-free unit root with the base Provider mounted (no boot, no port). */
async function makeRoot() {
  const root = new Context()
  await root.plugin(TestFileSystem, {})
  return root
}

function makeFixture(label) {
  const dir = mkdtempSync(join(tmpdir(), `a5sf-p2-wiring-${label}-`))
  const inside = join(dir, 'inside')
  mkdirSync(inside, { recursive: true })
  writeFileSync(join(inside, 'ok.txt'), 'ok\n', 'utf8')
  writeFileSync(join(dir, 'outside.txt'), 'outside\n', 'utf8')
  return { dir, inside, allowed: join(inside, 'ok.txt'), denied: join(dir, 'outside.txt') }
}

function tmpSink(label) {
  const dir = mkdtempSync(join(tmpdir(), `a5sf-p2-wiring-sink-${label}-`))
  return { dir, path: join(dir, 'consult.jsonl') }
}

/** The compiled objects a row provider supplies (never compiled by the glue). */
function compiledForFixture(fixture) {
  return {
    members: [{ identity: IDENTITY, policy: { ok: true, value: memberPolicy(fixture.dir) } }],
    bindings: [{ identity: IDENTITY, toolBindingIdentity: BINDING, effective: effectivePolicy(fixture.inside) }],
    providerClass: TestFileSystem,
  }
}

/** A provider accessor + counters proving whether it was asked. */
function makeProvider(compiled) {
  const calls = []
  const provider = () => ({
    compiledFor(member) {
      calls.push(member)
      return compiled
    },
  })
  return { provider, calls }
}

const CONFIGURED = Object.freeze({ evidencePath: 'set-per-test' })

const CLEANUP = []
after(() => {
  for (const dir of CLEANUP.splice(0)) rmSync(dir, { recursive: true, force: true })
})

// =============================================================================
// W1 — mount, transport, schema, teardown
// =============================================================================

test('W1 call-site helper mounts the realm, writes one fact per consultation, and dispose unmounts', async () => {
  const fixture = makeFixture('w1')
  CLEANUP.push(fixture.dir)
  const sinkDir = tmpSink('w1')
  CLEANUP.push(sinkDir.dir)
  const { provider, calls } = makeProvider(compiledForFixture(fixture))
  const root = await makeRoot()

  const realm = await row.mountMemberA5sfRealm({
    root,
    a5sfConfig: Object.freeze({ evidencePath: sinkDir.path }),
    provider,
    member: { sessionId: 'session-child-w1', instanceId: IDENTITY.memberInstanceId, teamRootSessionId: 'session-root-w1', templateId: 'worker', bindPath: 'fresh-member' },
  })
  assert.notEqual(realm, undefined, 'a configured row mounts')
  assert.equal(calls.length, 1, 'the provider is asked exactly once for the admitted member')
  assert.deepEqual(calls[0], {
    sessionId: 'session-child-w1',
    instanceId: IDENTITY.memberInstanceId,
    teamRootSessionId: 'session-root-w1',
    templateId: 'worker',
    bindPath: 'fresh-member',
  })
  assert.equal(Object.isFrozen(calls[0]), true, 'the member descriptor handed to the provider is frozen')

  // Two consultations through the BINDING realm (the narrower lane).
  const binding = realm.bindings[0]
  assert.notEqual(binding, undefined, 'the binding realm mounted under the ceiling')
  assert.equal(await binding.fs.readText(await binding.fs.resolve(fixture.allowed)), 'ok\n')
  await assert.rejects(
    binding.fs.readText(await binding.fs.resolve(fixture.denied)),
    (error) => error.code === 'IO_READ_DENIED',
  )

  const facts = await transports.readGuardConsultFile(sinkDir.path)
  assert.equal(facts.length, 2, 'ONE fact per consultation — no coalescing, no extra record')
  assert.deepEqual(facts.map((fact) => fact.sequence), [1, 2])
  assert.deepEqual(facts.map((fact) => fact.decision), ['allow', 'deny'])
  for (const fact of facts) {
    assert.equal(fact.schema, 'a5sf-guard-consult/1')
    assert.equal(fact.realm, 'binding')
    assert.equal(fact.memberIdentity, IDENTITY.memberInstanceId)
    assert.equal(fact.toolBindingIdentity, BINDING)
    assert.equal(fact.policyRevision, BINDING_REVISION)
    assert.equal(fact.method, 'readText')
    assert.equal(typeof fact.observedAt, 'string')
    assert.equal(Number.isNaN(Date.parse(fact.observedAt)), false)
  }
  assert.equal(facts[0].locator, fixture.allowed)

  // TEARDOWN: while mounted, the same identity refuses a second mount; after
  // dispose it mounts again. That is only possible if BOTH realms were released
  // (a leaked ceiling or binding answers SERVICE_ALREADY_INSTALLED).
  const second = row.mountMemberA5sfRealm({
    root,
    a5sfConfig: Object.freeze({ evidencePath: sinkDir.path }),
    provider,
    member: { sessionId: 'session-child-w1b', instanceId: IDENTITY.memberInstanceId, teamRootSessionId: 'session-root-w1', templateId: 'worker', bindPath: 'fresh-member' },
  })
  await assert.rejects(second, (error) => error.code === 'SERVICE_ALREADY_INSTALLED')
  await realm.dispose()
  const remounted = await row.mountMemberA5sfRealm({
    root,
    a5sfConfig: Object.freeze({ evidencePath: sinkDir.path }),
    provider,
    member: { sessionId: 'session-child-w1c', instanceId: IDENTITY.memberInstanceId, teamRootSessionId: 'session-root-w1', templateId: 'worker', bindPath: 'cold-member' },
  })
  assert.notEqual(remounted, undefined, 'dispose released the realms: the same identity remounts')
  await remounted.dispose()
  await remounted.dispose() // idempotent
})

// =============================================================================
// W2 — the default (unconfigured) path does nothing
// =============================================================================

test('W2 default path does nothing: no config ⇒ no provider call, no mount, no file', async () => {
  const root = await makeRoot()
  let providerCalls = 0
  const provider = () => {
    providerCalls += 1
    throw new Error('the provider must never be asked on the unconfigured path')
  }
  const mounted = await row.mountMemberA5sfRealm({
    root,
    a5sfConfig: row.a5sfRealmConfigOf({ rootSessionId: 'session-root-w2' }),
    provider,
    member: { sessionId: 'session-child-w2', instanceId: 'member-w2' },
  })
  assert.equal(mounted, undefined, 'unconfigured ⇒ undefined (the glue then keeps no disposer)')
  assert.equal(providerCalls, 0, 'the provider accessor is never called')
  // Nothing was installed on the root: the base Provider is still the bare one.
  assert.equal(typeof root.get('fs'), 'object')
})

test('W2b config without a provider does nothing; a provider answering undefined mounts nothing', async () => {
  const fixture = makeFixture('w2b')
  CLEANUP.push(fixture.dir)
  const sinkDir = tmpSink('w2b')
  CLEANUP.push(sinkDir.dir)
  const cfg = Object.freeze({ evidencePath: sinkDir.path })

  const noProvider = await row.mountMemberA5sfRealm({
    root: await makeRoot(),
    a5sfConfig: cfg,
    provider: undefined,
    member: { sessionId: 'session-child-w2b' },
  })
  assert.equal(noProvider, undefined, 'config alone (no provider) ⇒ nothing')
  assert.equal(existsSync(sinkDir.path), false, 'no sink ⇒ no file')

  let asked = 0
  const emptyProvider = () => ({
    compiledFor() {
      asked += 1
      return undefined
    },
  })
  const noCompiled = await row.mountMemberA5sfRealm({
    root: await makeRoot(),
    a5sfConfig: cfg,
    provider: emptyProvider,
    member: { sessionId: 'session-child-w2b2' },
  })
  assert.equal(noCompiled, undefined, 'provider answering undefined ⇒ nothing to mount')
  assert.equal(asked, 1)
  assert.equal(existsSync(sinkDir.path), false, 'still no file')
})

// =============================================================================
// W3 — fail-closed sink
// =============================================================================

test('W3 sink write failure fails closed: the consulted call is refused and the Provider is never asked', async () => {
  const fixture = makeFixture('w3')
  CLEANUP.push(fixture.dir)
  const broken = join(fixture.dir, 'no-such-dir', 'nested', 'consult.jsonl')
  const { provider } = makeProvider(compiledForFixture(fixture))
  const mounted = await row.mountMemberA5sfRealm({
    root: await makeRoot(),
    a5sfConfig: Object.freeze({ evidencePath: broken }),
    provider,
    member: { sessionId: 'session-child-w3', instanceId: IDENTITY.memberInstanceId },
  })
  assert.notEqual(mounted, undefined, 'the mount itself does not touch the sink path')
  providerReads = 0
  const member = mounted.installation.members[0]
  await assert.rejects(
    member.fs.readText(await member.fs.resolve(fixture.allowed)),
    (error) => {
      assert.equal(error.code, 'GUARD_OBSERVATION_FAILED', 'the transport failure is TYPED')
      assert.equal(error.decision, 'allow')
      assert.ok(error.cause !== undefined, 'the transport cause rides the error')
      return true
    },
  )
  assert.equal(providerReads, 0, 'an unrecorded decision never becomes an effect')
  await mounted.dispose()
})

// =============================================================================
// W4 — the config reader (path comes from row config, never hardcoded)
// =============================================================================

test('W4 config reader: absent ⇒ undefined; blank/non-string ⇒ loud; valid ⇒ frozen block', () => {
  assert.equal(row.a5sfRealmConfigOf(undefined), undefined)
  assert.equal(row.a5sfRealmConfigOf(null), undefined)
  assert.equal(row.a5sfRealmConfigOf({}), undefined)
  assert.equal(row.a5sfRealmConfigOf({ a5sfEvidencePath: undefined }), undefined)

  for (const bad of ['', '   ', 42, {}, []]) {
    assert.throws(
      () => row.a5sfRealmConfigOf({ a5sfEvidencePath: bad }),
      (error) => error instanceof TypeError && /a5sfEvidencePath/.test(error.message),
      `config.a5sfEvidencePath=${JSON.stringify(bad)} must refuse at assembly`,
    )
  }

  const cfg = row.a5sfRealmConfigOf({ a5sfEvidencePath: '/tmp/evidence/consult.jsonl' })
  assert.deepEqual(cfg, { evidencePath: '/tmp/evidence/consult.jsonl' })
  assert.equal(Object.isFrozen(cfg), true)
})

// =============================================================================
// W5 — a declared wiring that cannot mount is a fault, not a no-op
// =============================================================================

test('W5 malformed provider answers throw: non-object, missing compiledFor, empty members, non-array bindings', async () => {
  const cfg = Object.freeze({ evidencePath: '/tmp/a5sf-w5/consult.jsonl' })
  const member = { sessionId: 'session-child-w5' }
  const cases = [
    [() => 'not-an-object', /compiledFor/],
    [() => ({ compiledFor: 'nope' }), /compiledFor/],
    [() => ({ compiledFor: () => ({ members: [] }) }), /at least one compiled Member ceiling/],
    [() => ({ compiledFor: () => ({ members: [{}], bindings: 'nope' }) }), /non-array/],
  ]
  for (const [provider, pattern] of cases) {
    await assert.rejects(
      row.mountMemberA5sfRealm({ root: await makeRoot(), a5sfConfig: cfg, provider, member }),
      (error) => error instanceof TypeError && pattern.test(error.message),
    )
  }
})

// =============================================================================
// W6 — structural pin on the glue's call site
// =============================================================================

test('W6 the glue call site is guarded, keeps the row disposer, and imports the helper', () => {
  const glue = readFileSync(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs'), 'utf8')
  assert.match(glue, /import \{ a5sfRealmConfigOf, mountMemberA5sfRealm \} from '\.\/a5sf-realm-row\.mjs'/, 'the glue imports the ONE helper')
  assert.match(glue, /const a5sfRowConfig = a5sfRealmConfigOf\(config\)/, 'the row config is read once at assembly')
  assert.match(
    glue,
    /if \(a5sfRowConfig !== undefined && a5sfRealmProvider !== undefined && sessionId !== teamRoot\) \{/,
    'the mount runs only when BOTH halves are present and the session is a member (not a team root)',
  )
  assert.match(glue, /toolDisposers\.push\(\(\) => a5sfRealm\.dispose\(\)\)/, 'the row keeps the disposer (row-stop drain unmounts)')
  assert.match(glue, /onGuardConsult|provider: a5sfRealmProvider/, 'the consult observer is wired at the call site')
  assert.match(
    glue,
    /sessionId !== teamRoot/,
    'a LEADER session (a team root) owns no MemberInstance and never mounts',
  )
})
