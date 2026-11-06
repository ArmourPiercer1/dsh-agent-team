/**
 * a5sf-p2-seam.test.mjs — P2 central-seam C1 suite (BL-14/P2-01 follow-up):
 * the guard consultation is MECHANICALLY OBSERVABLE and its record crosses a
 * PROCESS BOUNDARY.
 *
 * ZERO Host boots, ZERO ports bound, no DSH_HOME, no `tests/homes/**` writes,
 * no pristine host tree: the only Context created is an in-process Cordis unit
 * root, and every fixture lives in a `mkdtemp` directory.
 *
 * Run: node --test tests/world-factory/a5sf-p2-seam.test.mjs
 *
 * What it proves (each arm is a law the P2 live path will rely on):
 *   A1 DEFAULT PATH UNCHANGED — an install with no observer returns the exact
 *      same frozen shape and the same allow/deny outcomes as the base package,
 *      and `onGuardConsult: undefined` is the same as omitting it. The seam is
 *      additive; nothing wraps the guard unless a caller asks.
 *   A2 ONE RECORD PER CONSULTATION — the observer receives exactly one fact per
 *      guard call, in call order, with the guard's OWN decision (allow vs the
 *      typed `TeamIoDenial` code), realm, member, tool binding, policy revision,
 *      method and locator. The seam never re-decides: it copies the guard's code.
 *   A3 JSONL TRANSPORT + READ-BACK — a plain append-only file sink writes one
 *      valid JSON object per line, and `readGuardConsultFile` validates and
 *      returns exactly those facts. The file is evidence, not authority.
 *   A4 NEGATIVE CONTROL — a mount with zero consultations writes NOTHING (the
 *      file is absent), and the reader rejects a missing file instead of
 *      answering an empty list that could be mistaken for "nothing consulted".
 *   A5 FAIL-CLOSED TRANSPORT — when the sink cannot write, the observed call is
 *      REFUSED with `GUARD_OBSERVATION_FAILED` carrying the decision and the
 *      cause, and the base Provider is NEVER asked (no unrecorded effect). The
 *      same holds for a refusal whose record cannot be written: the refusal is
 *      preserved on the error, never silently converted.
 *   A6 ONE MOUNT ENTRY POINT — `mountA5sfRealm` mounts the Member ceiling plus
 *      its binding realms over the REAL installers, rolls the whole thing back
 *      when a later binding refuses, and disposes idempotently. It compiles
 *      nothing (it consumes the compiled objects) and launches nothing.
 *   A7 HARNESS WIRING — the world-factory harness's `mountRealm()` is a caller
 *      of that ONE entry point and carries the observer; `installBindingRealm()`
 *      forwards it too. No second mount path exists in the harness.
 *   A8 CROSS-PROCESS — a CHILD node process mounts the compiled realm through
 *      `mountA5sfRealm` and writes the sink; THIS process reads the file back.
 *      That is the fact an in-process callback cannot produce: what the realm's
 *      process actually consulted, transported to another process.
 *
 * LIMITS (stated so no reader over-claims): A8 proves the INSTALLING PROCESS
 * reported the consultations. It does not prove kernel enforcement, a native
 * `read` tool path, a booted Host, or a Host-attributable effect — the boot
 * budget is still 0 and no Host is started here.
 *
 * CORE PATCH BUDGET = 0. Nothing here touches `tests/deepseek-harness-test-use/`.
 */
import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createRequire, register } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import process from 'node:process'
import test, { after } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { createRunRecord } from './lib/run-record.mjs'
import { createA5sfHarness, loadPolicySeams } from './lib/a5sf-harness.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..')
const SELF = fileURLToPath(import.meta.url)
const CHILD_FLAG = '--a5sf-seam-child'

/** The repo's EXISTING TS-under-plain-node hooks (no new loader). */
register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)
/** The P1/P2 seams through the merged R2 adapter (it registers the hooks too). */
const seams = await loadPolicySeams(REPO_ROOT)
/** `@deepseek-ai/cordis` is a devDependency of `packages/runtime` (pnpm strict). */
const runtimeRequire = createRequire(join(REPO_ROOT, 'packages', 'runtime', 'package.json'))
const { Context, Service } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href)

// --- fixtures: a compiled-shaped Member ceiling + a narrower binding ---------

const IDENTITY = Object.freeze({
  teamId: 'team-a5sf',
  memberInstanceId: 'member-seam-a',
  templateId: 'worker',
  instanceGeneration: 2,
})
const BINDING = 'dsh.fs/read'
const MEMBER_REVISION = 'a5sf1:member-seam-a:g2'
const BINDING_REVISION = 'a5sf1:member-seam-a:g2:dsh.fs/read'

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
    invocationId: 'call-seam-1',
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
    return { size: 0 }
  }

  async lstat() {
    return { size: 0 }
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

async function mountBinding(root, fixture, { onGuardConsult } = {}) {
  return seams.installToolBindingRealm({
    root,
    spec: { identity: IDENTITY, toolBindingIdentity: BINDING, effective: effectivePolicy(fixture.inside) },
    ...(onGuardConsult === undefined ? {} : { onGuardConsult }),
  })
}

function makeFixture(label) {
  const dir = mkdtempSync(join(tmpdir(), `a5sf-p2-seam-${label}-`))
  const inside = join(dir, 'inside')
  mkdirSync(inside, { recursive: true })
  writeFileSync(join(inside, 'ok.txt'), 'ok\n', 'utf8')
  writeFileSync(join(dir, 'outside.txt'), 'outside\n', 'utf8')
  return { dir, inside, allowed: join(inside, 'ok.txt'), denied: join(dir, 'outside.txt') }
}

function tmpSink(label) {
  const dir = mkdtempSync(join(tmpdir(), `a5sf-p2-seam-sink-${label}-`))
  return { dir, path: join(dir, 'consult.jsonl') }
}

const CLEANUP = []
after(() => {
  for (const dir of CLEANUP.splice(0)) rmSync(dir, { recursive: true, force: true })
})

// =============================================================================
// child branch — a DIFFERENT process mounts the realm and writes the sink
// =============================================================================

async function runChild(sinkPath, fixtureRoot) {
  const root = new Context()
  await root.plugin(TestFileSystem, {})
  const sink = seams.createGuardConsultFileSink({ path: sinkPath })
  const mounted = await seams.mountA5sfRealm({
    root,
    members: [{ identity: IDENTITY, policy: { ok: true, value: memberPolicy(fixtureRoot) } }],
    bindings: [{
      identity: IDENTITY,
      toolBindingIdentity: BINDING,
      effective: effectivePolicy(join(fixtureRoot, 'inside')),
    }],
    providerClass: TestFileSystem,
    onGuardConsult: (fact) => sink.record(fact),
  })
  const binding = mounted.bindings[0]
  const target = await binding.fs.resolve(join(fixtureRoot, 'inside', 'ok.txt'))
  await binding.fs.readText(target)
  await binding.fs.readText(target)
  const denied = await binding.fs.resolve(join(fixtureRoot, 'outside.txt'))
  try {
    await binding.fs.readText(denied)
    throw new Error('the child expected the narrower binding lane to refuse outside.txt')
  } catch (error) {
    if (error?.code !== 'IO_READ_DENIED') throw error
  }
  await mounted.dispose()
  console.log(`A5SF_SEAM_CHILD_OK pid=${String(process.pid)}`)
}

if (process.argv.includes(CHILD_FLAG)) {
  const flagAt = process.argv.indexOf(CHILD_FLAG)
  const sinkPath = process.argv[flagAt + 1]
  const fixtureRoot = process.argv[flagAt + 2]
  try {
    await runChild(sinkPath, fixtureRoot)
  } catch (error) {
    console.error(`A5SF_SEAM_CHILD_FAILED ${String(error?.stack ?? error)}`)
    process.exitCode = 1
  }
}

// =============================================================================
// A1 — default path unchanged
// =============================================================================

if (!process.argv.includes(CHILD_FLAG)) {
  test('A1 default path: no observer ⇒ identical shape and identical allow/deny behaviour', async () => {
    const fixture = makeFixture('a1')
    CLEANUP.push(fixture.dir)
    // 2026-11-04 (BL-16/BL-17 refusal round): `faces` joins the frozen surface. A realm that does
    // not say which services it actually mounts is exactly the bug class the refusal exists to
    // prevent, so the answer is a REQUIRED total field rather than an optional one that can be
    // omitted; a binding realm answers `{fs:'confined', subprocess:null, web:null}`. Widening this
    // pinned shape is deliberate and is recorded in dev/agent-workflow/evidence/a5sf-bl16-grep/README.md §6.3.
    //
    // 2026-11-05 (BL-18/P2-05): the same TOTAL-answer law gains the NETWORK face. A binding realm
    // still mounts `fs` only, so its answer is `web: null` — an explicit "this realm confines no
    // web", which `mountNativeToolModules` turns into the typed composition-time refusal for a
    // `web`-consuming module. The field is not optional for the same reason `subprocess` is not.
    const realmKeys = ['ctx', 'dispose', 'faces', 'fs', 'identity', 'policyRevision', 'toolBindingIdentity']

    const rootDefault = await makeRoot()
    const realmDefault = await mountBinding(rootDefault, fixture)
    const rootUndefined = await makeRoot()
    const realmUndefined = await mountBinding(rootUndefined, fixture, { onGuardConsult: undefined })
    const collected = []
    const rootObserved = await makeRoot()
    const realmObserved = await mountBinding(rootObserved, fixture, { onGuardConsult: (fact) => collected.push(fact) })

    // Return shape: the same frozen object shape on all three paths.
    for (const realm of [realmDefault, realmUndefined, realmObserved]) {
      assert.deepEqual(Object.keys(realm).sort(), realmKeys)
      assert.equal(Object.isFrozen(realm), true)
      // PD-13 (2026-11-11): `RealmServiceFaces` gained the TOTAL `terminals`
      // answer; a binding realm owns no terminal face, so it answers `null`.
      // The shape is still one frozen object on every path.
      assert.deepEqual(realm.faces, { fs: 'confined', subprocess: null, web: null, terminals: null })
      assert.equal(realm.toolBindingIdentity, BINDING)
      assert.equal(realm.policyRevision, BINDING_REVISION)
      assert.deepEqual(JSON.parse(JSON.stringify(realm.identity)), { ...IDENTITY })
    }

    // Behaviour: the same allow and the same typed deny, on every path.
    const readThrough = async (realm, path) => realm.fs.readText(await realm.fs.resolve(path))
    for (const realm of [realmDefault, realmUndefined, realmObserved]) {
      assert.equal(await readThrough(realm, fixture.allowed), 'ok\n')
      await assert.rejects(readThrough(realm, fixture.denied), (error) => {
        assert.equal(error.code, 'IO_READ_DENIED')
        return true
      })
    }
    // The default path performed ZERO reports (only the observed path has any).
    assert.equal(collected.length, 2, 'the observed path reports its own two consultations')
    for (const realm of [realmDefault, realmUndefined]) await realm.dispose()
    await realmObserved.dispose()
  })

  // ===========================================================================
  // A2 — one record per consultation, expected fields and order
  // ===========================================================================

  test('A2 observer: exactly one fact per consultation, in call order, carrying the guard’s own decision', async () => {
    const fixture = makeFixture('a2')
    CLEANUP.push(fixture.dir)
    const facts = []
    const root = await makeRoot()
    const realm = await mountBinding(root, fixture, { onGuardConsult: (fact) => facts.push(fact) })
    const read = async (path) => realm.fs.readText(await realm.fs.resolve(path))

    assert.equal(await read(fixture.allowed), 'ok\n')
    await assert.rejects(read(fixture.denied), (error) => error.code === 'IO_READ_DENIED')
    assert.equal(await read(fixture.allowed), 'ok\n')

    assert.equal(facts.length, 3, 'one record per consultation, no coalescing and no extra record')
    assert.deepEqual(facts.map((fact) => fact.sequence), [1, 2, 3])
    assert.deepEqual(facts.map((fact) => fact.decision), ['allow', 'deny', 'allow'])
    assert.deepEqual(facts.map((fact) => fact.decidedBy), ['ALLOW', 'IO_READ_DENIED', 'ALLOW'])
    for (const fact of facts) {
      assert.equal(fact.schema, 'a5sf-guard-consult/1')
      assert.equal(fact.realm, 'binding')
      assert.equal(fact.memberIdentity, IDENTITY.memberInstanceId)
      assert.equal(fact.toolBindingIdentity, BINDING)
      assert.equal(fact.policyRevision, BINDING_REVISION)
      assert.equal(fact.method, 'readText')
      assert.equal(typeof fact.observedAt, 'string')
      assert.equal(Number.isNaN(Date.parse(fact.observedAt)), false)
      assert.equal(Object.isFrozen(fact), true)
    }
    assert.equal(facts[0].locator, join(fixture.inside, 'ok.txt'))
    assert.equal(facts[1].locator, fixture.denied)
    await realm.dispose()
  })

  test('A2b Member-ceiling realm reports realm=member with no tool binding', async () => {
    const fixture = makeFixture('a2b')
    CLEANUP.push(fixture.dir)
    const facts = []
    const root = await makeRoot()
    const installation = await seams.installMemberIoProviders({
      root,
      members: [{ identity: IDENTITY, policy: { ok: true, value: memberPolicy(fixture.dir) } }],
      providerClass: TestFileSystem,
      onGuardConsult: (fact) => facts.push(fact),
    })
    const member = installation.members[0]
    assert.equal(await member.fs.readText(await member.fs.resolve(fixture.denied)), 'outside\n')
    assert.equal(facts.length, 1)
    assert.equal(facts[0].realm, 'member')
    assert.equal(facts[0].toolBindingIdentity, null)
    assert.equal(facts[0].memberIdentity, IDENTITY.memberInstanceId)
    await installation.dispose()
  })

  test('A2c observer records the ask lane for IO_POLICY_UNSUPPORTED', async () => {
    const fixture = makeFixture('a2c')
    CLEANUP.push(fixture.dir)
    // A self-referential symlink inside the allowed subtree: lstat sees a link,
    // realpath fails ELOOP, and the shipped guard refuses as IO_POLICY_UNSUPPORTED
    // ("cannot prove admission") — the ASK lane, not a deny.
    const loop = join(fixture.inside, 'loop')
    symlinkSync('loop', loop)
    const facts = []
    const root = await makeRoot()
    const realm = await mountBinding(root, fixture, { onGuardConsult: (fact) => facts.push(fact) })
    await assert.rejects(realm.fs.readText(await realm.fs.resolve(loop)), (error) => {
      assert.equal(error.code, 'IO_POLICY_UNSUPPORTED')
      return true
    })
    assert.equal(facts.length, 1, 'the ask decision is recorded once')
    assert.equal(facts[0].decision, 'ask')
    assert.equal(facts[0].decidedBy, 'IO_POLICY_UNSUPPORTED')
    assert.equal(facts[0].method, 'readText')
    assert.equal(facts[0].locator, loop)
    await realm.dispose()
  })

  test('A2d a non-TeamIoDenial fault is rethrown unchanged and NOT recorded', async () => {
    const facts = []
    const boom = new TypeError('resolver exploded outside the guard vocabulary')
    const observed = seams.observeGuard(
      async () => { throw boom },
      (fact) => facts.push(fact),
      { realm: 'binding', memberIdentity: IDENTITY.memberInstanceId, toolBindingIdentity: BINDING, policyRevision: BINDING_REVISION },
    )
    await assert.rejects(observed('readText', '/tmp/whatever'), (error) => error === boom)
    assert.equal(facts.length, 0, 'a fault outside the guard vocabulary is not a decision')
  })

  // ===========================================================================
  // A3 — plain JSONL transport + strict read-back
  // ===========================================================================

  test('A3 file sink: append-only valid JSONL, and the reader returns exactly those facts', async () => {
    const fixture = makeFixture('a3')
    CLEANUP.push(fixture.dir)
    const sinkDir = tmpSink('a3')
    CLEANUP.push(sinkDir.dir)
    const sink = seams.createGuardConsultFileSink({ path: sinkDir.path })
    const root = await makeRoot()
    const mounted = await seams.mountA5sfRealm({
      root,
      members: [{ identity: IDENTITY, policy: { ok: true, value: memberPolicy(fixture.dir) } }],
      bindings: [{ identity: IDENTITY, toolBindingIdentity: BINDING, effective: effectivePolicy(fixture.inside) }],
      providerClass: TestFileSystem,
      onGuardConsult: (fact) => sink.record(fact),
    })
    const binding = mounted.bindings[0]
    await binding.fs.readText(await binding.fs.resolve(fixture.allowed))
    await assert.rejects(
      binding.fs.readText(await binding.fs.resolve(fixture.denied)),
      (error) => error.code === 'IO_READ_DENIED',
    )

    const raw = readFileSync(sinkDir.path, 'utf8')
    assert.equal(raw.endsWith('\n'), true, 'every record is one newline-terminated line')
    const lines = raw.split('\n').filter((line) => line !== '')
    assert.equal(lines.length, 2)
    const parsed = lines.map((line) => JSON.parse(line))
    assert.deepEqual(parsed.map((fact) => fact.sequence), [1, 2])
    assert.deepEqual(parsed.map((fact) => fact.realm), ['binding', 'binding'])
    assert.deepEqual(parsed.map((fact) => fact.decision), ['allow', 'deny'])

    const readBack = await seams.readGuardConsultFile(sinkDir.path)
    assert.deepEqual(readBack, parsed, 'the reader returns the transported facts unchanged')
    await mounted.dispose()
  })

  // ===========================================================================
  // A4 — negative control
  // ===========================================================================

  test('A4 negative control: a mount with zero consultations writes nothing', async () => {
    const fixture = makeFixture('a4')
    CLEANUP.push(fixture.dir)
    const sinkDir = tmpSink('a4')
    CLEANUP.push(sinkDir.dir)
    const sink = seams.createGuardConsultFileSink({ path: sinkDir.path })
    const root = await makeRoot()
    const mounted = await seams.mountA5sfRealm({
      root,
      members: [{ identity: IDENTITY, policy: { ok: true, value: memberPolicy(fixture.dir) } }],
      providerClass: TestFileSystem,
      onGuardConsult: (fact) => sink.record(fact),
    })
    assert.equal(existsSync(sinkDir.path), false, 'no consultation ⇒ no file (not an empty file)')
    await assert.rejects(seams.readGuardConsultFile(sinkDir.path), (error) => {
      assert.equal(error.code, 'ENOENT')
      return true
    })
    await mounted.dispose()
  })

  // ===========================================================================
  // A5 — fail-closed transport
  // ===========================================================================

  test('A5 sink failure (allow): the call is refused and the Provider is never asked', async () => {
    const fixture = makeFixture('a5')
    CLEANUP.push(fixture.dir)
    const brokenPath = join(fixture.dir, 'no-such-dir', 'nested', 'consult.jsonl')
    const sink = seams.createGuardConsultFileSink({ path: brokenPath })
    const root = await makeRoot()
    const realm = await mountBinding(root, fixture, { onGuardConsult: (fact) => sink.record(fact) })
    providerReads = 0
    await assert.rejects(realm.fs.readText(await realm.fs.resolve(fixture.allowed)), (error) => {
      assert.equal(error instanceof seams.GuardObservationError, true)
      assert.equal(error.code, 'GUARD_OBSERVATION_FAILED')
      assert.equal(error.decision, 'allow')
      assert.equal(error.decidedBy, 'ALLOW')
      assert.equal(error.fact.sequence, 1)
      assert.equal(error.fact.locator, fixture.allowed)
      assert.equal(error.denial, null)
      assert.equal(error.cause instanceof Error, true, 'the transport failure is reported, not swallowed')
      return true
    })
    assert.equal(providerReads, 0, 'an unrecorded allow never reaches the base Provider')
    await realm.dispose()
  })

  test('A5b sink failure (deny): the refusal is preserved on the error, never converted to an allow', async () => {
    const fixture = makeFixture('a5b')
    CLEANUP.push(fixture.dir)
    const brokenPath = join(fixture.dir, 'no-such-dir', 'consult.jsonl')
    const sink = seams.createGuardConsultFileSink({ path: brokenPath })
    const root = await makeRoot()
    const realm = await mountBinding(root, fixture, { onGuardConsult: (fact) => sink.record(fact) })
    providerReads = 0
    await assert.rejects(realm.fs.readText(await realm.fs.resolve(fixture.denied)), (error) => {
      assert.equal(error instanceof seams.GuardObservationError, true)
      assert.equal(error.decision, 'deny')
      assert.equal(error.decidedBy, 'IO_READ_DENIED')
      assert.equal(error.denial?.code, 'IO_READ_DENIED')
      assert.equal(error.cause instanceof Error, true)
      return true
    })
    assert.equal(providerReads, 0)
    await realm.dispose()
  })

  // ===========================================================================
  // A6 — the ONE mount entry point
  // ===========================================================================

  test('A6 mountA5sfRealm: mounts ceiling + bindings over the real installers and disposes idempotently', async () => {
    const fixture = makeFixture('a6')
    CLEANUP.push(fixture.dir)
    const root = await makeRoot()
    const facts = []
    const mounted = await seams.mountA5sfRealm({
      root,
      members: [{ identity: IDENTITY, policy: { ok: true, value: memberPolicy(fixture.dir) } }],
      bindings: [{ identity: IDENTITY, toolBindingIdentity: BINDING, effective: effectivePolicy(fixture.inside) }],
      providerClass: TestFileSystem,
      onGuardConsult: (fact) => facts.push(fact),
    })
    assert.equal(mounted.members.length, 1)
    assert.equal(mounted.installation.members.length, 1)
    assert.equal(mounted.bindings.length, 1)
    assert.equal(await mounted.bindings[0].fs.readText(await mounted.bindings[0].fs.resolve(fixture.allowed)), 'ok\n')
    assert.equal(facts.length, 1)
    assert.equal(facts[0].realm, 'binding')

    await mounted.dispose()
    await mounted.dispose() // idempotent
    // The Member may be mounted again in the same root: dispose released it.
    const again = await seams.mountA5sfRealm({
      root,
      members: [{ identity: IDENTITY, policy: { ok: true, value: memberPolicy(fixture.dir) } }],
      providerClass: TestFileSystem,
    })
    assert.equal(again.installation.members.length, 1)
    await again.dispose()
  })

  test('A6b mountA5sfRealm rolls the whole realm back when a later binding refuses', async () => {
    const fixture = makeFixture('a6b')
    CLEANUP.push(fixture.dir)
    const root = await makeRoot()
    const foreign = { ...IDENTITY, memberInstanceId: 'some-other-member' }
    await assert.rejects(seams.mountA5sfRealm({
      root,
      members: [{ identity: IDENTITY, policy: { ok: true, value: memberPolicy(fixture.dir) } }],
      bindings: [{
        identity: foreign, // compiled for another member ⇒ typed install refusal
        toolBindingIdentity: BINDING,
        effective: effectivePolicy(fixture.inside),
      }],
      providerClass: TestFileSystem,
    }), (error) => {
      assert.equal(error.code, 'MEMBER_IDENTITY_INVALID')
      return true
    })
    // The Member ceiling was disposed by the rollback: remounting it succeeds.
    const remount = await seams.installMemberIoProviders({
      root,
      members: [{ identity: IDENTITY, policy: { ok: true, value: memberPolicy(fixture.dir) } }],
      providerClass: TestFileSystem,
    })
    assert.equal(remount.members.length, 1)
    await remount.dispose()
  })

  test('A6c mountA5sfRealm releases a PREVIOUSLY mounted binding when a later binding refuses', async () => {
    const fixture = makeFixture('a6c')
    CLEANUP.push(fixture.dir)
    const root = await makeRoot()
    const firstBinding = {
      identity: IDENTITY,
      toolBindingIdentity: 'seam/one',
      effective: { ...effectivePolicy(fixture.inside), toolBindingIdentity: 'seam/one', policyRevision: 'rev-seam-one' },
    }
    const secondBinding = {
      identity: { ...IDENTITY, memberInstanceId: 'some-other-member' }, // foreign ⇒ typed refusal
      toolBindingIdentity: 'seam/two',
      effective: { ...effectivePolicy(fixture.inside), toolBindingIdentity: 'seam/two', policyRevision: 'rev-seam-two' },
    }
    await assert.rejects(seams.mountA5sfRealm({
      root,
      members: [{ identity: IDENTITY, policy: { ok: true, value: memberPolicy(fixture.dir) } }],
      bindings: [firstBinding, secondBinding],
      providerClass: TestFileSystem,
    }), (error) => {
      assert.equal(error.code, 'MEMBER_IDENTITY_INVALID')
      return true
    })
    // The FIRST binding was mounted before the second refused. If the rollback
    // loop did not release it, this remount is SERVICE_ALREADY_INSTALLED.
    const remount = await seams.installToolBindingRealm({
      root,
      spec: { identity: IDENTITY, toolBindingIdentity: 'seam/one', effective: firstBinding.effective },
      providerClass: TestFileSystem,
    })
    assert.equal(remount.toolBindingIdentity, 'seam/one')
    assert.equal(await remount.fs.readText(await remount.fs.resolve(fixture.allowed)), 'ok\n')
    await remount.dispose()
  })

  // ===========================================================================
  // A7 — harness wiring (no second mount path)
  // ===========================================================================

  test('A7 harness mountRealm() is a caller of the ONE entry point and carries the observer', async () => {
    const fixture = makeFixture('a7')
    CLEANUP.push(fixture.dir)
    const sinkDir = tmpSink('a7')
    CLEANUP.push(sinkDir.dir)
    const ledgerPath = join(sinkDir.dir, 'budget.jsonl')
    const runRecord = createRunRecord({
      runId: 'a5sf-p2-seam-c1',
      suite: 'a5sf-p2-seam',
      selectedCases: [],
      bindings: {},
      ledgerPath,
    })
    const harness = createA5sfHarness({
      repoRoot: REPO_ROOT,
      evidenceRoot: join(sinkDir.dir, 'evidence'),
      suite: 'a5sf-p2-seam',
      line: 'p2seam',
      runRecord,
      maxHostStarts: 1,
      hostTree: join(sinkDir.dir, 'no-host-tree'),
      leaseRoot: join(sinkDir.dir, 'leases'),
    })
    const sink = seams.createGuardConsultFileSink({ path: sinkDir.path })
    const root = await makeRoot()
    const mounted = await harness.mountRealm({
      root,
      members: [{ identity: IDENTITY, policy: { ok: true, value: memberPolicy(fixture.dir) } }],
      bindings: [{ identity: IDENTITY, toolBindingIdentity: BINDING, effective: effectivePolicy(fixture.inside) }],
      providerClass: TestFileSystem,
      onGuardConsult: (fact) => sink.record(fact),
    })
    assert.equal(mounted.bindings.length, 1)
    assert.equal(await mounted.bindings[0].fs.readText(await mounted.bindings[0].fs.resolve(fixture.allowed)), 'ok\n')
    const facts = await seams.readGuardConsultFile(sinkDir.path)
    assert.equal(facts.length, 1)
    assert.equal(facts[0].realm, 'binding')
    await mounted.dispose()

    // installBindingRealm forwards the observer too (same installer input).
    const singleSink = tmpSink('a7-single')
    CLEANUP.push(singleSink.dir)
    const singleSinkWriter = seams.createGuardConsultFileSink({ path: singleSink.path })
    const singular = await harness.installBindingRealm({
      root: await makeRoot(),
      identity: IDENTITY,
      toolBindingIdentity: BINDING,
      effective: effectivePolicy(fixture.inside),
      providerClass: TestFileSystem,
      onGuardConsult: (fact) => singleSinkWriter.record(fact),
    })
    await singular.fs.readText(await singular.fs.resolve(fixture.allowed))
    assert.equal((await seams.readGuardConsultFile(singleSink.path)).length, 1)
    await singular.dispose()
  })

  // ===========================================================================
  // A8 — cross-process transport
  // ===========================================================================

  test('A8 cross-process: a CHILD process mounts the realm and THIS process reads its consultations', async () => {
    const fixture = makeFixture('a8')
    CLEANUP.push(fixture.dir)
    const sinkDir = tmpSink('a8')
    CLEANUP.push(sinkDir.dir)
    const run = spawnSync(
      process.execPath,
      [SELF, CHILD_FLAG, sinkDir.path, fixture.dir],
      { cwd: REPO_ROOT, encoding: 'utf8' },
    )
    assert.equal(run.status, 0, `child failed: ${String(run.stderr)}`)
    assert.match(String(run.stdout), /A5SF_SEAM_CHILD_OK pid=(\d+)/)
    const childPid = Number(String(run.stdout).match(/A5SF_SEAM_CHILD_OK pid=(\d+)/)[1])
    assert.notEqual(childPid, process.pid, 'the writer is a DIFFERENT process')
    assert.equal(run.stderr, '')

    const facts = await seams.readGuardConsultFile(sinkDir.path)
    assert.equal(facts.length, 3, 'two admitted reads + one refused read in the child')
    assert.deepEqual(facts.map((fact) => fact.sequence), [1, 2, 3])
    assert.deepEqual(facts.map((fact) => fact.decision), ['allow', 'allow', 'deny'])
    assert.deepEqual(facts.map((fact) => fact.decidedBy), ['ALLOW', 'ALLOW', 'IO_READ_DENIED'])
    assert.deepEqual(facts.map((fact) => fact.realm), ['binding', 'binding', 'binding'])
    for (const fact of facts) {
      assert.equal(fact.memberIdentity, IDENTITY.memberInstanceId)
      assert.equal(fact.policyRevision, BINDING_REVISION)
    }
  })
}
