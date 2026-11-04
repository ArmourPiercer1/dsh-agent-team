/**
 * a5sf-product-assembly.test.mjs — the PRODUCT-ASSEMBLY C1 suite (Alpha.5,
 * 2026-11-05).
 *
 * ZERO Host boots, ZERO ports bound, no DSH_HOME, no pristine-host tree: one
 * in-process Cordis unit root per case and `mkdtemp` fixtures only.
 *
 * Run: node --test tests/world-factory/a5sf-product-assembly.test.mjs
 *
 * WHAT THIS PROVES — the PRODUCT path, not a new mechanism:
 *   PA1 PRODUCT DECLARATION MOUNTS. A row configured with
 *       `a5sfMemberPolicies` (and NO evidence path and NO `teamA5sfRealm`
 *       service) gives a DECLARED template its compiled realm through the SAME
 *       `mountMemberA5sfRealm` -> `mountA5sfRealm` seam the evidence rows use.
 *       The ceiling is compiled by the ONE compiler and the declared
 *       ToolBinding by the ONE projector; nothing is hand-built here.
 *   PA2 UNMANAGED MEMBER IS BYTE-IDENTICAL. The SAME root, the SAME config and
 *       a member whose template is NOT declared: `compiledFor` answers
 *       `undefined`, no realm is mounted, no sink line appears, and the
 *       out-of-lane read that the managed member is refused is SERVED by the
 *       base provider. Measured as a pair, not described.
 *   PA3 THE INTERSECTION IS WHAT BINDS. Two members whose ceiling and
 *       restriction differ in OPPOSITE directions: a path allowed only by the
 *       ceiling and a path allowed only by the restriction are BOTH refused,
 *       and only the intersection is served. The restriction cannot widen the
 *       ceiling and the ceiling cannot widen the restriction.
 *   PA4 THE FACES THAT CANNOT BE EXPRESSED REFUSE TYPED, BEFORE ANY CALL. A
 *       binding-scoped subprocess declaration refuses `SUBPROCESS_UNCONFINED_REALM`
 *       (BL-17's code) at ROW ASSEMBLY; a network narrowing refuses
 *       `NETWORK_UNCONFINED_REALM`; a malformed declaration refuses
 *       `REALM_DECLARATION_INVALID`. In each case: zero provider reads, zero
 *       mounts, the base provider untouched.
 *   PA5 THE EVIDENCE PATH STILL WORKS UNCHANGED. The pre-existing
 *       evidence-shaped config (`a5sfEvidencePath` + a `teamA5sfRealm`
 *       provider) mounts exactly as before and writes the same
 *       `a5sf-guard-consult/1` facts — the regression arm for the evidence
 *       rows.
 *   PA6 TWO SOURCES ARE A FORK. A row carrying BOTH the product declaration and
 *       a `teamA5sfRealm` service refuses instead of picking one.
 *
 * @module tests/world-factory/a5sf-product-assembly.test
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

/** The product row helper — imported the way the glue imports it. */
const row = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs')).href)
/** The product assembly module (declaration, parser, provider). */
const assembly = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'team-services', 'src', 'product-assembly.ts')).href)
/** The seam's transport reader (fact round-trip). */
const transports = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'team-services', 'src', 'guard-observability.ts')).href)
/** `@deepseek-ai/cordis` is a devDependency of `packages/runtime` (pnpm strict). */
const runtimeRequire = createRequire(join(REPO_ROOT, 'packages', 'runtime', 'package.json'))
const { Context, Service } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href)

// --- fixtures ---------------------------------------------------------------

const TEAM = 'team.a5sf.product'
const BINDING = 'dsh.fs/read'

/** Count base-Provider reads so "the Provider was never asked" is measurable. */
let providerReads = 0

/** A real Cordis Service over node:fs (unit-world double, no Host). */
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

async function makeRoot() {
  const root = new Context()
  await root.plugin(TestFileSystem, {})
  return root
}

const CLEANUP = []
after(() => {
  for (const dir of CLEANUP.splice(0)) rmSync(dir, { recursive: true, force: true })
})

/**
 * Three directories under one temp root:
 *   ALLOWED  — inside every lane
 *   CEILING_ONLY — inside the ceiling, outside the restriction
 *   RESTRICTION_ONLY — inside the restriction, outside the ceiling
 */
function makeFixture(label) {
  const dir = mkdtempSync(join(tmpdir(), `a5sf-product-${label}-`))
  const allowed = join(dir, 'allowed')
  const ceilingOnly = join(dir, 'ceiling-only')
  const restrictionOnly = join(dir, 'restriction-only')
  for (const sub of [allowed, ceilingOnly, restrictionOnly]) mkdirSync(sub, { recursive: true })
  writeFileSync(join(allowed, 'a.txt'), 'A\n', 'utf8')
  writeFileSync(join(ceilingOnly, 'b.txt'), 'B\n', 'utf8')
  writeFileSync(join(restrictionOnly, 'c.txt'), 'C\n', 'utf8')
  return {
    dir,
    allowed: join(allowed, 'a.txt'),
    ceilingOnly: join(ceilingOnly, 'b.txt'),
    restrictionOnly: join(restrictionOnly, 'c.txt'),
  }
}

function tmpSink(label) {
  const dir = mkdtempSync(join(tmpdir(), `a5sf-product-sink-${label}-`))
  CLEANUP.push(dir)
  return { dir, path: join(dir, 'consult.jsonl') }
}

function rw(allow) {
  return Object.freeze({ mode: 'restricted', allow: Object.freeze([...allow]), ask: Object.freeze([]), deny: Object.freeze([]) })
}

function netAllow() {
  return Object.freeze({ mode: 'allow' })
}

/** One v4 ToolBinding entry (owner/name/io/execution), the declared restriction. */
function toolRestriction({ owner = 'dsh.fs', name = 'read', read, boundary = 'trusted-host' } = {}) {
  return {
    owner,
    name,
    authorization: 'ask',
    io: {
      read,
      write: { mode: 'all', deny: [] },
      network: { mode: 'allow' },
    },
    execution: { implementationOrigin: 'dsh-native', executionBoundary: boundary },
  }
}

function memberDeclaration({ templateId, ceilingRead, restrictionRead, toolRestrictions, ...rest }) {
  return {
    templateId,
    instanceGeneration: 1,
    ceiling: {
      read: ceilingRead,
      write: { mode: 'all', deny: [] },
      network: { mode: 'allow' },
    },
    ...(restrictionRead === undefined && toolRestrictions === undefined
      ? {}
      : { toolRestrictions: toolRestrictions ?? [toolRestriction({ read: restrictionRead })] }),
    ...rest,
  }
}

function declaration(members) {
  return {
    schema: assembly.A5SF_PRODUCT_REALM_SCHEMA,
    teamId: TEAM,
    blueprintRevision: '1',
    authority: { revision: 'a4:product:1', admitted: true },
    members,
  }
}

function managedMember(templateId, fixture) {
  return memberDeclaration({ templateId, ceilingRead: rw([fixture.dir]), restrictionRead: rw([fixture.allowed]) })
}

async function readThrough(fs, path) {
  return fs.readText(await fs.resolve(path))
}

// =============================================================================
// PA1 — the PRODUCT declaration mounts a declared Member, no evidence path
// =============================================================================

test('PA1 a5sfMemberPolicies mounts a declared Member through the same seam (no evidence path, no teamA5sfRealm service)', async () => {
  const fixture = makeFixture('pa1')
  CLEANUP.push(fixture.dir)
  const root = await makeRoot()
  const config = row.a5sfRealmConfigOf({ a5sfMemberPolicies: declaration([managedMember('worker', fixture)]) })

  assert.equal(config.evidencePath, undefined, 'the product path needs NO evidence path')
  assert.notEqual(config.memberPolicies, undefined, 'the parsed plan rides the row config')

  const realm = await row.mountMemberA5sfRealm({
    root,
    a5sfConfig: config,
    // The glue always forwards this accessor; the product path must NOT need a
    // `teamA5sfRealm` service behind it.
    provider: () => undefined,
    member: { sessionId: 'session-child-pa1', instanceId: 'mi-pa1-managed', teamRootSessionId: 'session-root-pa1', templateId: 'worker', bindPath: 'fresh-member' },
  })
  assert.notEqual(realm, undefined, 'a declared Member gets its realm from PRODUCT config alone')

  // The realm is REAL: the confined Provider serves the in-lane file and the
  // binding realm enforces the narrower lane.
  const memberRealm = realm.installation.members[0]
  assert.equal(await readThrough(memberRealm.fs, fixture.allowed), 'A\n')
  assert.equal(realm.bindings.length, 1, 'the declared ToolBinding installed its binding realm')
  const bindingRealm = realm.bindings[0]
  assert.equal(bindingRealm.toolBindingIdentity, BINDING)
  assert.equal(await readThrough(bindingRealm.fs, fixture.allowed), 'A\n')

  // No sink was configured ⇒ no file was written anywhere under the fixtures.
  assert.equal(existsSync(join(fixture.dir, 'consult.jsonl')), false)
  await realm.dispose()
})

// =============================================================================
// PA2 — the discriminating pair: unmanaged is byte-identical
// =============================================================================

test('PA2 discriminating pair: the declared Member is confined, the undeclared Member keeps the base provider (no mount, no facts)', async () => {
  const fixture = makeFixture('pa2')
  CLEANUP.push(fixture.dir)
  const sink = tmpSink('pa2')
  const root = await makeRoot()
  const config = row.a5sfRealmConfigOf({
    a5sfMemberPolicies: declaration([managedMember('worker', fixture)]),
    // A sink makes "no new facts" measurable for BOTH halves.
    a5sfEvidencePath: sink.path,
  })

  // --- MANAGED half: the declared template --------------------------------
  providerReads = 0
  const managed = await row.mountMemberA5sfRealm({
    root,
    a5sfConfig: config,
    provider: () => undefined,
    member: { sessionId: 'session-child-managed', instanceId: 'mi-pa2-managed', teamRootSessionId: 'session-root-pa2', templateId: 'worker' },
  })
  assert.notEqual(managed, undefined, 'declared template ⇒ realm')
  // The BINDING realm is where the narrower declared restriction lives; the
  // member realm enforces only the ceiling.
  const managedBindingFs = managed.bindings[0].fs
  assert.equal(await readThrough(managedBindingFs, fixture.allowed), 'A\n')
  assert.ok(providerReads > 0, 'the in-lane read reached a provider')

  // OUT-OF-RESTRICTION on the managed binding realm: inside the ceiling, yet
  // refused by the declared ToolBinding — the base provider is never asked.
  providerReads = 0
  await assert.rejects(readThrough(managedBindingFs, fixture.restrictionOnly), (error) => {
    assert.equal(error.code, 'IO_READ_DENIED', 'the sealed refusal is the seam’s own typed code')
    return true
  })
  assert.equal(providerReads, 0, 'a refused managed read never reaches the provider')
  const managedFacts = await transports.readGuardConsultFile(sink.path)
  assert.ok(managedFacts.length > 0, 'the managed member writes guard-consult facts (allow AND deny)')
  assert.deepEqual(managedFacts.map((fact) => fact.decision).sort(), ['allow', 'deny'])

  // --- UNMANAGED half: the SAME root, the SAME config, another template ---
  providerReads = 0
  const unmounted = await row.mountMemberA5sfRealm({
    root,
    a5sfConfig: config,
    provider: () => undefined,
    member: { sessionId: 'session-child-unmanaged', instanceId: 'mi-pa2-unmanaged', teamRootSessionId: 'session-root-pa2', templateId: 'bystander' },
  })
  assert.equal(unmounted, undefined, 'undeclared template ⇒ NOTHING is mounted')
  assert.equal(providerReads, 0, 'the unmanaged path asks no provider through the realm seam')

  // The unmanaged member still runs on the BASE provider: the exact read the
  // managed member was refused is SERVED here. That is the discriminator.
  const baseFs = root.get('fs')
  assert.equal(baseFs instanceof TestFileSystem, true, 'the base provider is untouched')
  assert.equal(await readThrough(baseFs, fixture.restrictionOnly), 'C\n', 'unmanaged members keep the pre-existing surface')

  // ... and it appended no fact of its own.
  const afterUnmanagedFacts = await transports.readGuardConsultFile(sink.path)
  assert.equal(afterUnmanagedFacts.length, managedFacts.length, 'no new facts for the unmanaged member')

  await managed.dispose()
})

// =============================================================================
// PA3 — the intersection is what binds (both directions)
// =============================================================================

test('PA3 ceiling and restriction differ: the INTERSECTION binds, neither factor can widen the other', async () => {
  const fixture = makeFixture('pa3')
  CLEANUP.push(fixture.dir)
  const root = await makeRoot()
  const config = row.a5sfRealmConfigOf({
    a5sfMemberPolicies: declaration([
      // Ceiling WIDE, restriction NARROW: the restriction must bind.
      memberDeclaration({
        templateId: 'narrow-restriction',
        ceilingRead: rw([fixture.dir]),
        restrictionRead: rw([fixture.allowed]),
      }),
      // Ceiling NARROW, restriction WIDE: the restriction must NOT widen.
      memberDeclaration({
        templateId: 'narrow-ceiling',
        ceilingRead: rw([fixture.allowed]),
        restrictionRead: rw([fixture.dir]),
      }),
    ]),
  })

  const mount = (instanceId, templateId) => row.mountMemberA5sfRealm({
    root,
    a5sfConfig: config,
    provider: () => undefined,
    member: { sessionId: `session-child-${instanceId}`, instanceId, teamRootSessionId: 'session-root-pa3', templateId },
  })

  const narrowRestriction = await mount('mi-pa3-a', 'narrow-restriction')
  const narrowCeiling = await mount('mi-pa3-b', 'narrow-ceiling')
  assert.notEqual(narrowRestriction, undefined)
  assert.notEqual(narrowCeiling, undefined)

  const a = narrowRestriction.bindings[0].fs
  const b = narrowCeiling.bindings[0].fs

  // Both allow the intersection only.
  assert.equal(await readThrough(a, fixture.allowed), 'A\n')
  assert.equal(await readThrough(b, fixture.allowed), 'A\n')

  // The restriction binds: the ceiling allows this path, the restriction does not.
  providerReads = 0
  await assert.rejects(readThrough(a, fixture.ceilingOnly), (error) => error.code === 'IO_READ_DENIED')
  assert.equal(providerReads, 0, 'the restriction-refused path never reached the provider')

  // The ceiling binds: the restriction allows this path (wider), the ceiling does not.
  providerReads = 0
  await assert.rejects(readThrough(b, fixture.restrictionOnly), (error) => error.code === 'IO_READ_DENIED')
  assert.equal(providerReads, 0, 'a restriction can never widen the ceiling')

  // The compiled effective lanes are the intersection, not either input.
  const effectiveA = narrowRestriction.bindings[0].effective ?? null
  assert.equal(effectiveA, null, 'the binding realm does not publish the effective object; the behaviour above is the proof')

  await narrowRestriction.dispose()
  await narrowCeiling.dispose()
})

// =============================================================================
// PA4 — the faces the seam cannot express refuse, typed, before any call
// =============================================================================

test('PA4 refusals are typed at ROW ASSEMBLY: subprocess face, network narrowing, malformed declaration — zero calls', async () => {
  const fixture = makeFixture('pa4')
  CLEANUP.push(fixture.dir)

  const refusals = [
    {
      label: 'binding-scoped subprocess face (search live round UNSUPPORTED)',
      config: {
        a5sfMemberPolicies: declaration([
          memberDeclaration({
            templateId: 'searcher',
            ceilingRead: rw([fixture.dir]),
            toolRestrictions: [toolRestriction({ owner: 'dsh.search', name: 'grep', read: rw([fixture.allowed]), boundary: 'confined-subprocess' })],
          }),
        ]),
      },
      code: 'SUBPROCESS_UNCONFINED_REALM',
    },
    {
      label: 'delegated-remote execution boundary',
      config: {
        a5sfMemberPolicies: declaration([
          memberDeclaration({
            templateId: 'remote',
            ceilingRead: rw([fixture.dir]),
            toolRestrictions: [toolRestriction({ owner: 'vendor', name: 'remote-tool', read: rw([fixture.allowed]), boundary: 'delegated-remote' })],
          }),
        ]),
      },
      code: 'NETWORK_UNCONFINED_REALM',
    },
    {
      label: 'network narrowing with no web face',
      config: {
        a5sfMemberPolicies: declaration([
          {
            templateId: 'net',
            instanceGeneration: 1,
            ceiling: {
              read: rw([fixture.dir]),
              write: { mode: 'all', deny: [] },
              network: { mode: 'deny', default: 'deny' },
            },
          },
        ]),
      },
      code: 'NETWORK_UNCONFINED_REALM',
    },
    {
      label: 'malformed declaration (unknown field)',
      config: { a5sfMemberPolicies: { ...declaration([managedMember('worker', fixture)]), typo: true } },
      code: 'REALM_DECLARATION_INVALID',
    },
    {
      label: 'malformed declaration (duplicate template)',
      config: { a5sfMemberPolicies: declaration([managedMember('worker', fixture), managedMember('worker', fixture)]) },
      code: 'REALM_DECLARATION_INVALID',
    },
  ]

  for (const arm of refusals) {
    assert.throws(
      () => row.a5sfRealmConfigOf(arm.config),
      (error) => {
        assert.equal(error.code, arm.code, `${arm.label}: typed code`)
        assert.equal(error.name, 'TeamServiceInstallError', `${arm.label}: the seam’s own refusal idiom`)
        return true
      },
      `${arm.label} must refuse at row assembly`,
    )
  }

  // The refused configuration can never reach a mount: no provider is asked and
  // the root keeps the base provider (no isolated service was created).
  providerReads = 0
  const root = await makeRoot()
  assert.throws(() => row.a5sfRealmConfigOf(refusals[0].config), (error) => error.code === 'SUBPROCESS_UNCONFINED_REALM')
  assert.equal(providerReads, 0, 'a refused declaration performs ZERO provider calls')
  assert.equal(root.get('fs') instanceof TestFileSystem, true, 'and mounts nothing')
})

// =============================================================================
// PA5 — the evidence path still works unchanged (regression arm)
// =============================================================================

test('PA5 evidence-era config unchanged: a5sfEvidencePath + a teamA5sfRealm provider mounts and writes the same facts', async () => {
  const fixture = makeFixture('pa5')
  CLEANUP.push(fixture.dir)
  const sink = tmpSink('pa5')
  const root = await makeRoot()

  // The shape the evidence rows compose: pre-compiled objects handed over by a
  // provider service, and an evidence path in the row config.
  const identity = Object.freeze({ teamId: 'team-evidence', memberInstanceId: 'mi-pa5', templateId: 'worker', instanceGeneration: 1 })
  const policy = Object.freeze({
    memberIdentity: 'mi-pa5',
    templateId: 'worker',
    instanceGeneration: 1,
    revision: 'a5sf1:pa5',
    read: rw([fixture.dir]),
    write: rw([fixture.dir]),
    network: Object.freeze({ access: 'allow' }),
  })
  const effective = Object.freeze({
    memberIdentity: 'mi-pa5',
    toolBindingIdentity: BINDING,
    invocationId: 'call-pa5',
    policyRevision: 'a5sf1:pa5',
    read: rw([fixture.allowed]),
    write: rw([fixture.dir]),
    network: Object.freeze({ access: 'allow' }),
  })
  const provider = () => ({
    compiledFor: () => ({
      members: [{ identity, policy: { ok: true, value: policy } }],
      bindings: [{ identity, toolBindingIdentity: BINDING, effective }],
      providerClass: TestFileSystem,
    }),
  })

  const cfg = row.a5sfRealmConfigOf({ a5sfEvidencePath: sink.path })
  assert.deepEqual(cfg, { evidencePath: sink.path }, 'the evidence block is byte-identical to before')

  const realm = await row.mountMemberA5sfRealm({
    root,
    a5sfConfig: cfg,
    provider,
    member: { sessionId: 'session-child-pa5', instanceId: 'mi-pa5', teamRootSessionId: 'session-root-pa5', templateId: 'worker' },
  })
  assert.notEqual(realm, undefined, 'the evidence path still mounts')
  await readThrough(realm.installation.members[0].fs, fixture.allowed)
  const facts = await transports.readGuardConsultFile(sink.path)
  assert.ok(facts.length > 0, 'the sink still receives guard-consult facts')
  assert.equal(facts[0].schema, 'a5sf-guard-consult/1')
  assert.equal(facts[0].realm, 'member')
  assert.equal(facts[0].memberIdentity, 'mi-pa5')
  await realm.dispose()
})

// =============================================================================
// PA6 — two compiled-realm sources are a fork
// =============================================================================

test('PA6 a row carrying BOTH the declaration and a teamA5sfRealm service refuses instead of picking one', async () => {
  const fixture = makeFixture('pa6')
  CLEANUP.push(fixture.dir)
  const root = await makeRoot()
  const config = row.a5sfRealmConfigOf({ a5sfMemberPolicies: declaration([managedMember('worker', fixture)]) })
  const service = () => ({ compiledFor: () => ({ members: [] }) })

  await assert.rejects(
    row.mountMemberA5sfRealm({
      root,
      a5sfConfig: config,
      provider: service,
      member: { sessionId: 'session-child-pa6', instanceId: 'mi-pa6', teamRootSessionId: 'session-root-pa6', templateId: 'worker' },
    }),
    (error) => error instanceof TypeError && /two compiled-realm sources/.test(error.message),
  )
})

// =============================================================================
// PA7 — the parser/compiler unit surface (same module, no mounts)
// =============================================================================

test('PA7 the declaration compiles with the ONE compiler and the unmanaged template answers undefined', async () => {
  const fixture = makeFixture('pa7')
  CLEANUP.push(fixture.dir)
  const plan = assembly.parseProductRealmDeclaration(declaration([managedMember('worker', fixture)]))
  const provider = assembly.createProductRealmProvider(plan)

  const managed = provider.compiledFor({ instanceId: 'mi-pa7', templateId: 'worker' })
  assert.notEqual(managed, undefined)
  assert.equal(managed.members.length, 1)
  const compiled = managed.members[0].policy
  assert.equal(compiled.ok, true, 'the ONE compiler accepted the declared ceiling')
  assert.equal(compiled.value.read.mode, 'restricted')
  assert.deepEqual([...compiled.value.read.allow], [fixture.dir])
  assert.equal(managed.bindings.length, 1)
  assert.equal(managed.bindings[0].toolBindingIdentity, BINDING)
  assert.deepEqual([...managed.bindings[0].effective.read.allow], [fixture.allowed], 'the published effective lane IS the intersection')

  assert.equal(provider.compiledFor({ instanceId: 'mi-pa7-b', templateId: 'bystander' }), undefined, 'unmanaged ⇒ undefined')

  // A missing template id is a wiring fault, never "unmanaged".
  assert.throws(
    () => provider.compiledFor({ instanceId: 'mi-pa7-c' }),
    (error) => error.code === 'MEMBER_IDENTITY_INVALID',
  )

  // The Alpha.4 authority is CONSUMED, not re-decided: a refused reference refuses the mount.
  const refusedPlan = assembly.parseProductRealmDeclaration({
    ...declaration([managedMember('worker', fixture)]),
    authority: { revision: 'a4:product:2', admitted: false },
  })
  assert.throws(
    () => assembly.createProductRealmProvider(refusedPlan).compiledFor({ instanceId: 'mi-pa7-d', templateId: 'worker' }),
    (error) => {
      assert.equal(error.code, 'MEMBER_POLICY_UNAVAILABLE')
      assert.match(error.detail, /AUTHORITY_REFUSED/)
      return true
    },
  )
})

// =============================================================================
// PA8 — a v4 `mode: all` + deny restriction keeps its deny (B1 regression)
// =============================================================================

test('PA8 a mode-all restriction that carries a deny is refused at the realm — IO_READ_DENIED, zero provider reads', async () => {
  const fixture = makeFixture('pa8')
  CLEANUP.push(fixture.dir)
  // A file INSIDE the ceiling and INSIDE the restriction's denied subtree.
  mkdirSync(join(fixture.dir, 'secret'), { recursive: true })
  const secret = join(fixture.dir, 'secret', 's.txt')
  writeFileSync(secret, 'SECRET\n', 'utf8')
  const deniedDir = join(fixture.dir, 'secret')

  const root = await makeRoot()
  const config = row.a5sfRealmConfigOf({
    a5sfMemberPolicies: declaration([
      memberDeclaration({
        templateId: 'worker',
        ceilingRead: rw([fixture.dir]),
        // The LEGAL v4 all-lane form: `deny` is REQUIRED when `mode: all`.
        // Before the B1 fix the projector collapsed this to
        // 'no-additional-narrowing' and DROPPED the deny, so this read served
        // "SECRET\n" through the binding realm.
        restrictionRead: { mode: 'all', deny: [deniedDir] },
      }),
    ]),
  })

  const realm = await row.mountMemberA5sfRealm({
    root,
    a5sfConfig: config,
    provider: () => undefined,
    member: { sessionId: 'session-child-pa8', instanceId: 'mi-pa8', teamRootSessionId: 'session-root-pa8', templateId: 'worker' },
  })
  assert.notEqual(realm, undefined)
  const bindingFs = realm.bindings[0].fs

  // The sibling stays served: the deny narrows one subtree, it does not deny the lane.
  assert.equal(await readThrough(bindingFs, fixture.allowed), 'A\n')

  // The denied subtree is refused with the seam's own typed code, before any provider call.
  providerReads = 0
  await assert.rejects(readThrough(bindingFs, secret), (error) => {
    assert.equal(error.code, 'IO_READ_DENIED', 'the denied path is refused, not served')
    return true
  })
  assert.equal(providerReads, 0, 'the denied read never reached a provider')
  assert.equal(readFileSync(secret, 'utf8'), 'SECRET\n', 'the file exists — the refusal was the lane, not a missing file')

  // The parsed plan carries the deny, not the identity sentinel (the PROJECTOR
  // assertion the realm behaviour above is the consequence of).
  const restriction = config.memberPolicies.members[0].restrictions[0]
  assert.notEqual(restriction.read, 'no-additional-narrowing', 'an all-lane with a deny is a restriction, not the intersection identity')
  assert.deepEqual([...restriction.read.deny], [deniedDir])
  await realm.dispose()
})

// =============================================================================
// PA9 — B2: a declaration may not exceed the row's OWN bound blueprint
// =============================================================================

/** A real v4 blueprint SOURCE (the row's `config.blueprintSource`) for team TEAM. */
function blueprintSourceOf({ teamId = TEAM, read, revision = '7' } = {}) {
  const document = {
    schemaVersion: 4,
    blueprintId: teamId,
    revision,
    leader: { templateId: 'leader', persona: 'Lead.' },
    members: [{ templateId: 'worker', persona: 'Worker.' }],
    requirements: [],
    memberEnvelopes: [],
    policyStates: [],
    permissionMutationEnvelope: { rules: [] },
    teamHardEnvelope: { rules: [] },
    metadata: {},
    memberIoCeilings: [{
      templateId: 'worker',
      io: {
        read,
        // The declarations in this arm leave `write` at the all/empty-deny form,
        // so the blueprint ceiling must be the same identity for the narrowing
        // checks to be about the READ axis under test.
        write: { mode: 'all', deny: [] },
        network: { mode: 'allow' },
      },
    }],
  }
  return `---\n${JSON.stringify(document, null, 2)}\n---\n`
}

test('PA9 the declaration is reconciled with config.blueprintSource (B2): narrowing mounts, widening refuses typed, other team/absent skips', async () => {
  const fixture = makeFixture('pa9')
  CLEANUP.push(fixture.dir)

  // --- NARROWING: the declaration allows less than the blueprint ⇒ accepted.
  const narrowing = {
    ...declaration([
      memberDeclaration({
        templateId: 'worker',
        ceilingRead: rw([fixture.allowed]),
        restrictionRead: rw([fixture.allowed]),
      }),
    ]),
  }
  const narrowingConfig = row.a5sfRealmConfigOf({
    a5sfMemberPolicies: narrowing,
    blueprintSource: blueprintSourceOf({ read: rw([fixture.dir]) }),
  })
  assert.notEqual(narrowingConfig.memberPolicies, undefined, 'a narrowing declaration still assembles')
  const acceptingRoot = await makeRoot()
  const acceptingRealm = await row.mountMemberA5sfRealm({
    root: acceptingRoot,
    a5sfConfig: narrowingConfig,
    provider: () => undefined,
    member: { sessionId: 'session-child-pa9a', instanceId: 'mi-pa9a', teamRootSessionId: 'session-root-pa9', templateId: 'worker' },
  })
  assert.equal(await readThrough(acceptingRealm.bindings[0].fs, fixture.allowed), 'A\n')
  await acceptingRealm.dispose()

  // --- WIDENING on the read axis: refused at ROW ASSEMBLY, typed, zero mounts.
  providerReads = 0
  assert.throws(
    () => row.a5sfRealmConfigOf({
      a5sfMemberPolicies: declaration([
        memberDeclaration({
          templateId: 'worker',
          ceilingRead: rw([fixture.dir, fixture.restrictionOnly]),
          restrictionRead: rw([fixture.allowed]),
        }),
      ]),
      blueprintSource: blueprintSourceOf({ read: rw([fixture.allowed]) }),
    }),
    (error) => {
      assert.equal(error.code, 'REALM_DECLARATION_EXCEEDS_BLUEPRINT')
      assert.equal(error.name, 'TeamServiceInstallError')
      assert.match(error.detail, /ceiling\.read/)
      return true
    },
    'a read ceiling wider than the blueprint ceiling must refuse',
  )

  // --- `mode: all` over a restricted blueprint ceiling is a widening too.
  assert.throws(
    () => row.a5sfRealmConfigOf({
      a5sfMemberPolicies: declaration([
        memberDeclaration({
          templateId: 'worker',
          ceilingRead: { mode: 'all', deny: [] },
          restrictionRead: rw([fixture.allowed]),
        }),
      ]),
      blueprintSource: blueprintSourceOf({ read: rw([fixture.allowed]) }),
    }),
    (error) => error.code === 'REALM_DECLARATION_EXCEEDS_BLUEPRINT',
    'an all-lane is not a narrowing of a restricted ceiling',
  )

  // --- A template the blueprint declares NO ceiling for is wider than the authority.
  assert.throws(
    () => row.a5sfRealmConfigOf({
      a5sfMemberPolicies: declaration([managedMember('ghost-template', fixture)]),
      blueprintSource: blueprintSourceOf({ read: rw([fixture.allowed]) }),
    }),
    (error) => error.code === 'REALM_DECLARATION_EXCEEDS_BLUEPRINT',
    'a ceiling for an undeclared template must refuse',
  )

  // --- An unreadable blueprintSource cannot be reconciled ⇒ typed refusal, not a skip.
  assert.throws(
    () => row.a5sfRealmConfigOf({
      a5sfMemberPolicies: declaration([managedMember('worker', fixture)]),
      blueprintSource: 'not: [a valid blueprint',
    }),
    (error) => {
      assert.equal(error.code, 'REALM_DECLARATION_INVALID')
      assert.match(error.detail, /blueprintSource/)
      return true
    },
    'an unparseable bound blueprint must refuse instead of implying "same team"',
  )

  // --- DIFFERENT team: not this Team's authority ⇒ not reconciled (both forms keep working).
  const otherTeam = row.a5sfRealmConfigOf({
    a5sfMemberPolicies: declaration([
      memberDeclaration({
        templateId: 'worker',
        ceilingRead: rw([fixture.dir]),
        restrictionRead: rw([fixture.allowed]),
      }),
    ]),
    blueprintSource: blueprintSourceOf({ teamId: 'team.a5sf.other', read: rw([fixture.allowed]) }),
  })
  assert.notEqual(otherTeam.memberPolicies, undefined, 'another team\'s blueprint is not the same authority')

  // --- ABSENT blueprintSource: host-free assembly keeps working (no reconciliation).
  const noBlueprint = row.a5sfRealmConfigOf({
    a5sfMemberPolicies: declaration([
      memberDeclaration({ templateId: 'worker', ceilingRead: rw([fixture.dir]), restrictionRead: rw([fixture.allowed]) }),
    ]),
  })
  assert.notEqual(noBlueprint.memberPolicies, undefined)

  // The refusals happened before any provider call / mount.
  assert.equal(providerReads, 0, 'a refused reconciliation performs ZERO provider calls')
})

// =============================================================================
// PA10 — B3/B4: authorization + implementationOrigin + lane grammar are validated
// =============================================================================

test('PA10 the shipped v4 grammar validates the restriction family; `authorization: deny` is refused, not mounted', async () => {
  const fixture = makeFixture('pa10')
  CLEANUP.push(fixture.dir)

  const restrictionWith = (overrides) => ({
    ...toolRestriction({ read: rw([fixture.allowed]) }),
    ...overrides,
  })
  const configWith = (restriction) => ({
    a5sfMemberPolicies: declaration([
      memberDeclaration({
        templateId: 'worker',
        ceilingRead: rw([fixture.dir]),
        toolRestrictions: [restriction],
      }),
    ]),
  })

  const refusals = [
    {
      label: 'authorization deny (B3: the realm cannot both serve and deny)',
      config: configWith(restrictionWith({ authorization: 'deny' })),
      detail: /authorization is "deny"/,
    },
    {
      label: 'authorization outside the closed v4 enum (B3)',
      config: configWith(restrictionWith({ authorization: 'maybe' })),
      detail: /closed v4 vocabulary/,
    },
    {
      label: 'implementationOrigin outside the closed v4 enum (B4, shipped validator)',
      config: configWith(restrictionWith({
        execution: { implementationOrigin: 'bogus-origin', executionBoundary: 'trusted-host' },
      })),
      detail: /implementationOrigin|production-governance vocabulary/,
    },
    {
      label: 'scalar-shaped allow silently became DENY-ALL before B4 (projection filters non-arrays)',
      config: configWith(restrictionWith({
        io: {
          read: { mode: 'restricted', allow: '/not-a-list', ask: [], deny: [] },
          write: { mode: 'all', deny: [] },
          network: { mode: 'allow' },
        },
      })),
      detail: /toolBindings|allow|array/i,
    },
    {
      // The object shape was ALREADY typed before this round (the mapping engine
      // flattens leaves, so `allow.dir` is an unmapped field) — measured, not
      // assumed: it refuses at projection, never silently deny-all.
      label: 'object-shaped allow is refused at projection (never silently deny-all)',
      config: configWith(restrictionWith({
        io: {
          read: { mode: 'restricted', allow: { dir: true }, ask: [], deny: [] },
          write: { mode: 'all', deny: [] },
          network: { mode: 'allow' },
        },
      })),
      code: 'MEMBER_POLICY_UNAVAILABLE',
      detail: /projected|unmapped\/source-field|allow\.dir/,
    },
  ]

  for (const arm of refusals) {
    assert.throws(
      () => row.a5sfRealmConfigOf(arm.config),
      (error) => {
        assert.equal(error.code, arm.code ?? 'REALM_DECLARATION_INVALID', `${arm.label}: typed code`)
        assert.equal(error.name, 'TeamServiceInstallError', `${arm.label}: the seam refusal idiom`)
        assert.match(error.detail, arm.detail, `${arm.label}: names the defect`)
        return true
      },
      `${arm.label} must refuse at row assembly`,
    )
  }
})

// =============================================================================
// PA11 — B8: the effective policy revision covers the tool restrictions
// =============================================================================

test('PA11 the policy revision (contentHash) covers the declared bindings, not only the ceilings', async () => {
  const fixture = makeFixture('pa11')
  CLEANUP.push(fixture.dir)

  const planFor = (restrictionRead) => assembly.parseProductRealmDeclaration(declaration([
    memberDeclaration({
      templateId: 'worker',
      ceilingRead: rw([fixture.dir]),
      restrictionRead,
    }),
  ]))
  const narrow = planFor(rw([fixture.allowed]))
  const wider = planFor(rw([fixture.dir]))

  // Same ceilings, different restriction ⇒ different blueprint content identity
  // ⇒ a different MemberPolicy revision. Before B8 the bindings were outside the
  // synthetic document, so these two were byte-identical in every revision.
  assert.notEqual(narrow.blueprint.contentHash, wider.blueprint.contentHash, 'the content hash binds the restriction')

  const revisionOf = (plan) => {
    const answer = assembly.createProductRealmProvider(plan).compiledFor({ instanceId: 'mi-pa11', templateId: 'worker' })
    return {
      member: answer.members[0].policy.value.revision,
      effective: answer.bindings[0].effective.policyRevision,
    }
  }
  const narrowRevisions = revisionOf(narrow)
  const widerRevisions = revisionOf(wider)
  assert.notEqual(narrowRevisions.member, widerRevisions.member, 'a restriction edit changes the policy revision')
  assert.equal(narrowRevisions.effective, narrowRevisions.member, 'the effective lane carries that same revision')
  assert.equal(widerRevisions.member, widerRevisions.effective)
})
