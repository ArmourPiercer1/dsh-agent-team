/**
 * a5sf-pd17-fs-read-axis.test.mjs — PD-17: a governed Member's NATIVE
 * `read`/`write`/`edit`/`read_image` never reached the confined `fs` face, so
 * the Member's compiled lane was never consulted on the filesystem axis.
 *
 * WHAT THIS SUITE IS (host-free; in-process Cordis roots, no boot, no DSH_HOME,
 * no port): the discriminating pair for the FS face over the PRODUCT seam.
 * The pinned `@deepseek-ai/dsh-tool-fs` module is mounted on a STANDING scope
 * that is the PARENT of the agent scope — the real `@deepseek-ai/dsh-agent-
 * preset-registry` topology — so its injected `fs` resolves the INHERITED base
 * provider, exactly as in the live recon (`a5sf-recon-fs`, PR #657; two-Member
 * confirmation `a5sf-recon-review`, PR #662). The realm mounts the confined
 * `fs` provider (the REAL `createConfinedFileSystemClass` over the same base
 * class) and the route-C attach places the shadow after the capability deny
 * lane.
 *
 * WHY THE DEFECT IS A REAL DEFECT (not a missing config): `fs-sandbox` has no
 * read fence at all — "Reads pass through untouched: every mode permits
 * reading" (`packages/fs/fs-sandbox/src/index.ts:7-8`) — while the realm's
 * confined provider refuses BEFORE the base provider runs. So the read axis
 * has no service-level carrier unless the tool's `ctx.fs` IS the confined one.
 *
 * ARMS
 *   P0  THE DEFECT PIN (env-gated, `A5SF_PD17_PIN=1`). It asserts TODAY'S
 *       PRE-FIX behaviour: `read` returns the bytes of a SIBLING MEMBER's lane
 *       and of `/etc/hostname`, `write`/`edit` create/rewrite an out-of-lane
 *       file — with ZERO guard facts on those locators. It is GREEN before the
 *       fix and RED after it; the default run skips it (a pin is a one-way
 *       marker, not a regression guard).
 *   D1  CROSS-MEMBER READ: `read` of the OTHER Member's lane is refused with
 *       zero bytes, exactly one `deny` fact (`IO_READ_DENIED`), and the base
 *       provider is never asked for the bytes.
 *   D2  HOST REACH: `read` of `/etc/hostname` (outside the ceiling AND outside
 *       the host sandbox's readable surface) is refused the same way.
 *   D3  WRITE OUT OF LANE: `write` creates nothing, is refused with
 *       `IO_WRITE_DENIED`, one deny fact, and zero base writes.
 *   D4  EDIT OUT OF LANE: `edit` rewrites nothing, is refused, one deny fact.
 *   D5  READ_IMAGE OUT OF LANE: the image bytes of an out-of-lane file never
 *       reach the attachment store, refused at the fs face, one deny fact.
 *   A1  ALLOW READ: an in-lane read returns the file text, ≥1 `allow` fact, no
 *       deny fact, and never reaches the inherited base service.
 *   A2  ALLOW WRITE: an in-lane write creates the file (atomic publication is
 *       the base provider's, unchanged) with content, ≥1 allow fact.
 *   A3  ALLOW EDIT: an in-lane edit replaces `old_string` and the file text
 *       changes — the host tool's read-match-write path still works.
 *   A4  WRITE⇒READ IS KEPT: a write to an EXISTING file the write lane covers
 *       but the read lane does not is refused with `IO_WRITE_REQUIRES_READ`
 *       and the file is unchanged (the confined provider's native
 *       read-before-write contract, not a new rule).
 *   A5  READ_IMAGE IN LANE: the image is returned and committed to the
 *       attachment store (the deferred `ctx.inject(['attachments'])`
 *       registration path survives the shadow).
 *   S1  SURFACE NEUTRAL: the model-visible name set is unchanged, the four
 *       parameter schemas are byte-identical before/after, the prompt sections
 *       are unchanged, and the definitions ARE new objects (the shadow took).
 *   D6  DENY-LANE SUBSET: with `write` denied by the capability lane, the
 *       shadow places only the VISIBLE subset — `write` stays invisible and is
 *       not executable, and the attach still succeeds (a shadow that
 *       re-registered a denied name would fail the surface gate / re-enable
 *       the lane).
 *   C1  CONTROL — remove the shadow (dispose the native modules): the fixed
 *       refusal goes RED in place (the ungoverned path returns the bytes).
 *
 * Run:  node --test --test-reporter=spec tests/world-factory/a5sf-pd17-fs-read-axis.test.mjs
 * Pin:  A5SF_PD17_PIN=1 node --test --test-reporter=spec tests/world-factory/a5sf-pd17-fs-read-axis.test.mjs
 */
import assert from 'node:assert/strict'
import { createRequire, register } from 'node:module'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import test, { after } from 'node:test'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..')
const PIN = process.env.A5SF_PD17_PIN === '1'

/** The repo's EXISTING TS-under-plain-node hooks (no new loader). */
register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)

const row = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs')).href)
const transports = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'team-services', 'src', 'guard-observability.ts')).href)
const runtimeRequire = createRequire(join(REPO_ROOT, 'packages', 'runtime', 'package.json'))
const { Context, Service } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href)
const ToolRuntime = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-tools')).href)).default
const SystemPrompt = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-system-prompt')).href)).default
const { createScope, bindScopeParent } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-scope')).href)

/** The PINNED baseline's own `@deepseek-ai/dsh-tool-fs` package entry (what the preset mounts). */
const BASELINE_TOOL_FS = join(REPO_ROOT, 'tests', 'deepseek-harness-test-use', 'packages', 'fs', 'tool-fs', 'lib', 'index.js')
assert.equal(
  existsSync(BASELINE_TOOL_FS),
  true,
  `the real native tool package must exist in the pinned baseline checkout (${BASELINE_TOOL_FS}); provision tests/deepseek-harness-test-use per docs/TEST_METHODS.md §1`,
)
const nativeToolModules = await import(pathToFileURL(BASELINE_TOOL_FS).href)

// ===========================================================================
// fixtures
// ===========================================================================

const IDENTITY = Object.freeze({
  teamId: 'team-a5sf-pd17',
  memberInstanceId: 'member-pd17-a',
  templateId: 'worker',
  instanceGeneration: 1,
})
const REVISION = 'a5sf1:member-pd17-a:g1'

const INLANE_BYTES = 'A5SF_PD17_INLANE_BYTES'
const SIBLING_BYTES = 'A5SF_PD17_SIBLING_MEMBER_B_BYTES'
const OUTLANE_BYTES = 'A5SF_PD17_OUTLANE_SECRET_BYTES'
/** A 1x1 PNG (70 bytes) — the recon's own image fixture shape. */
const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64',
)

function lane(allow) {
  return Object.freeze({ mode: 'restricted', allow: Object.freeze([...allow]), ask: Object.freeze([]), deny: Object.freeze([]) })
}

function memberPolicy(readRoots, writeRoots = readRoots) {
  return Object.freeze({
    memberIdentity: IDENTITY.memberInstanceId,
    templateId: IDENTITY.templateId,
    instanceGeneration: IDENTITY.instanceGeneration,
    revision: REVISION,
    read: lane(readRoots),
    write: lane(writeRoots),
    network: Object.freeze({ access: 'allow' }),
  })
}

const dirs = []
function tracked(dir) {
  dirs.push(dir)
  return dir
}
after(() => {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
})

/**
 * The recon's world: TWO Member lanes under one workspace root (`lane-a` is
 * this Member's ceiling, `lane-b` is a SIBLING Member's lane) plus a
 * `not-in-lane/` directory no lane covers. Every fixture is a real path, so
 * the confined guard's real-path identity resolution is exercised, not faked.
 */
function makeWorld(label) {
  const root = realpathSync(tracked(mkdtempSync(join(tmpdir(), `a5sf-pd17-${label}-`))))
  const laneA = join(root, 'lane-a')
  const laneB = join(root, 'lane-b')
  const notInLane = join(root, 'not-in-lane')
  mkdirSync(join(laneA, 'sub'), { recursive: true })
  mkdirSync(laneB, { recursive: true })
  mkdirSync(notInLane, { recursive: true })
  writeFileSync(join(laneA, 'ok.txt'), `${INLANE_BYTES}\n`, 'utf8')
  writeFileSync(join(laneA, 'edit.txt'), 'A5SF_PD17_TARGET_ALPHA\n', 'utf8')
  writeFileSync(join(laneA, 'probe.png'), PNG_1X1)
  writeFileSync(join(laneB, 'b.txt'), `${SIBLING_BYTES}\n`, 'utf8')
  writeFileSync(join(notInLane, 'secret.txt'), `${OUTLANE_BYTES}\n`, 'utf8')
  writeFileSync(join(notInLane, 'edit.txt'), 'A5SF_PD17_TARGET_ALPHA\n', 'utf8')
  writeFileSync(join(notInLane, 'probe.png'), PNG_1X1)
  return {
    root,
    laneA,
    laneB,
    notInLane,
    ok: join(laneA, 'ok.txt'),
    edit: join(laneA, 'edit.txt'),
    probe: join(laneA, 'probe.png'),
    sibling: join(laneB, 'b.txt'),
    secret: join(notInLane, 'secret.txt'),
    outEdit: join(notInLane, 'edit.txt'),
    outProbe: join(notInLane, 'probe.png'),
    outWrite: join(notInLane, 'write-deny.txt'),
  }
}

/** Counters over the INHERITED base provider: the negative control every deny arm uses. */
const base = { reads: 0, writes: 0, edits: 0, imageReads: 0 }

/** A real Cordis fs Service over node:fs — the base provider the realm shadows. */
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
    base.reads += 1
    return readFileSync(this.processPath(target), 'utf8')
  }

  async streamText(target) {
    const text = await this.readText(target)
    return (async function* stream() {
      yield text
    })()
  }

  async readBytes(target) {
    base.imageReads += 1
    return readFileSync(this.processPath(target))
  }

  async readByteRange(target, range) {
    base.reads += 1
    return readFileSync(this.processPath(target)).subarray(range.offset, range.offset + range.length)
  }

  async listDir() {
    return []
  }

  async stat(target) {
    const text = existsSync(this.processPath(target)) ? readFileSync(this.processPath(target)) : Buffer.alloc(0)
    return { type: 'file', size: text.length, mtimeMs: 0, mode: 0o644, version: 'v1' }
  }

  async lstat(target) {
    const text = existsSync(this.processPath(target)) ? readFileSync(this.processPath(target)) : Buffer.alloc(0)
    return { type: 'file', size: text.length, mtimeMs: 0, mode: 0o644, version: 'v1' }
  }

  async watch() {
    return async () => {}
  }

  async writeText(target, content) {
    base.writes += 1
    const hostPath = this.processPath(target)
    const before = existsSync(hostPath) ? readFileSync(hostPath, 'utf8') : null
    const temporary = `${hostPath}.tmp-${process.pid}`
    writeFileSync(temporary, String(content), 'utf8')
    const { renameSync } = await import('node:fs')
    renameSync(temporary, hostPath)
    return { operation: before === null ? 'create' : 'update', version: 'v1', before, after: String(content) }
  }

  async editText(target, edit) {
    base.edits += 1
    const hostPath = this.processPath(target)
    const before = existsSync(hostPath) ? readFileSync(hostPath, 'utf8') : ''
    const after = before.replace(String(edit.oldString), String(edit.newString))
    writeFileSync(hostPath, after, 'utf8')
    return { version: 'v2', before, after }
  }
}

/** A REAL-ish durable image store (`attachments`), so the deferred read_image path runs. */
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
    return {
      attachmentId: `sha256:pd17-${this.saved.length}`,
      mediaType: image.mediaType,
      bytes: image.data?.length ?? 0,
      width: 1,
      height: 1,
      name: image.name,
    }
  }
}

/** The model route declares `image` input, so `read_image` reaches the fs face (not its route gate). */
class TestLlm extends Service {
  constructor(ctx) {
    super(ctx, 'llm')
  }

  async resolveModelInfo() {
    return { inputModalities: ['text', 'image'] }
  }
}

async function makeWorldWithRoots(label, { attachments = true, deny = [], lanes = undefined } = {}) {
  const world = makeWorld(label)
  const root = new Context()
  await root.plugin(SystemPrompt)
  await root.plugin(ToolRuntime)
  await root.plugin(TestFileSystem, {})
  if (attachments) await root.plugin(TestAttachments)
  await root.plugin(TestLlm)
  // THE PRESET TOPOLOGY: the native tool package (the "preset" row) is mounted
  // on a STANDING scope that is the PARENT of the agent scope, exactly as
  // `@deepseek-ai/dsh-agent-preset-registry` does. Re-mounting the shadow on the
  // AGENT layer then replaces the preset definition (the property route-C
  // relies on), so the model-visible surface is unchanged before/after.
  const standingKey = {}
  const standing = createScope(root, standingKey)
  await standing.ctx.plugin(nativeToolModules)
  const agentKey = {
    id: `agent-${label}`,
    session: { header: { cwd: world.laneA }, requestHeader: () => ({ config: { provider: 'mock-provider', model: 'mock-image-model' } }) },
    options: { provider: 'mock-provider', model: 'mock-image-model' },
  }
  const agent = createScope(root, agentKey)
  bindScopeParent(agentKey, standingKey)
  const agentCtx = agent.ctx
  const sinkPath = join(world.root, `consult-${label}.jsonl`)
  const laneRoots = lanes === undefined ? { read: [world.laneA], write: [world.laneA] } : lanes(world)
  const ceiling = memberPolicy(laneRoots.read, laneRoots.write)
  const mounted = await row.mountMemberA5sfRealm({
    root: agentCtx,
    a5sfConfig: row.a5sfRealmConfigOf({ a5sfEvidencePath: sinkPath }),
    provider: () => ({
      compiledFor: () => ({
        members: [{ identity: IDENTITY, policy: { ok: true, value: ceiling } }],
        providerClass: TestFileSystem,
      }),
    }),
    member: {
      sessionId: `session-${label}`,
      instanceId: IDENTITY.memberInstanceId,
      teamRootSessionId: 'team-root-pd17',
      templateId: IDENTITY.templateId,
    },
  })
  assert.ok(mounted !== undefined, 'the configured row must mount a realm')
  return { ...world, label, root, agentKey, agentCtx, sinkPath, mounted, deny, attachments: root.get('attachments') }
}

/** Apply the capability deny lane BEFORE the attach (the glue's own order). */
async function applyDeny(world) {
  if (world.deny.length === 0) return
  await world.agentCtx.plugin({
    inject: ['tools'],
    apply: (ctx) => {
      ctx.tools.restrict({ deny: world.deny })
    },
  })
}

/** Attach the PRODUCT way: NO configured native modules — the PD-17 shadow is the row's. */
async function attachFs(world) {
  await applyDeny(world)
  return await row.attachA5sfNativeToolModules(
    world.mounted,
    world.agentCtx,
    row.a5sfRealmConfigOf({ a5sfEvidencePath: world.sinkPath }),
    world.agentKey,
  )
}

function toolNames(world) {
  return world.root.get('tools').schemas(world.agentKey).map((schema) => schema.name)
}

function schemaOf(world, name) {
  return world.root.get('tools').get(name, world.agentKey)
}

async function dispatch(world, name, args) {
  const settled = await world.root.get('tools').execute({
    signal: new AbortController().signal,
    callId: `a5sf-pd17-${name}-${Math.random().toString(36).slice(2, 8)}`,
    name,
    arguments: args,
    agent: world.agentKey,
  })
  const text = Array.isArray(settled.content)
    ? settled.content.map((part) => (part?.type === 'text' ? part.text : '')).join('')
    : ''
  return { isError: settled.isError === true, text, value: settled.value }
}

async function factsOf(world) {
  if (!existsSync(world.sinkPath)) return []
  return await transports.readGuardConsultFile(world.sinkPath)
}

function denialsOf(facts) {
  return facts.filter((fact) => fact.decision === 'deny')
}

function allowFactsOf(facts) {
  return facts.filter((fact) => fact.decision === 'allow')
}

function counterSnapshot() {
  return { ...base }
}

// ===========================================================================
// P0 — THE DEFECT PIN (pre-fix behaviour). RED on the fixed tree by design.
// ===========================================================================
test('P0 PD-17 defect pin (PRE-FIX): the Member read returns a sibling lane\'s bytes and /etc/hostname, write/edit touch an out-of-lane file, and no guard fact names any of them', { skip: !PIN }, async () => {
  const world = await makeWorldWithRoots('pin')
  await attachFs(world)
  try {
    const before = counterSnapshot()
    const sibling = await dispatch(world, 'read', { file_path: world.sibling })
    // THE OLD BEHAVIOUR, asserted verbatim. On the fixed tree the shadow's
    // confined face refuses this locator, so this arm goes RED — the flip is
    // the evidence, not a regression.
    assert.equal(sibling.isError, false, 'PRE-FIX: read of the sibling lane executed')
    assert.match(sibling.text, new RegExp(SIBLING_BYTES, 'u'), 'PRE-FIX: the sibling Member\'s lane bytes reached the model')

    const hostReach = await dispatch(world, 'read', { file_path: '/etc/hostname' })
    assert.equal(hostReach.isError, false, 'PRE-FIX: read of /etc/hostname executed')
    assert.ok(hostReach.text.trim().length > 0, 'PRE-FIX: host bytes reached the model')

    const write = await dispatch(world, 'write', { file_path: world.outWrite, content: `${OUTLANE_BYTES}\n` })
    assert.equal(write.isError, false, 'PRE-FIX: the out-of-lane write executed')
    assert.equal(existsSync(world.outWrite), true, 'PRE-FIX: the out-of-lane file was created')

    const edit = await dispatch(world, 'edit', { file_path: world.outEdit, old_string: 'A5SF_PD17_TARGET_ALPHA', new_string: 'A5SF_PD17_TARGET_EDITED' })
    assert.equal(edit.isError, false, 'PRE-FIX: the out-of-lane edit executed')
    assert.match(readFileSync(world.outEdit, 'utf8'), /A5SF_PD17_TARGET_EDITED/u, 'PRE-FIX: the out-of-lane file was rewritten')

    assert.equal(base.reads > before.reads, true, 'PRE-FIX: the INHERITED base provider served the reads')
    assert.deepEqual(await denialsOf(await factsOf(world)), [], 'PRE-FIX: zero deny facts — the lane was never consulted')
  } finally {
    await world.mounted.dispose()
  }
})

// ===========================================================================
// D — the fix: the confined fs face refuses BEFORE any provider call
// ===========================================================================
test('D1 cross-Member read: read of the OTHER Member\'s lane is refused with 0 bytes, 1 deny fact, 0 base reads', async () => {
  const world = await makeWorldWithRoots('d1')
  const fibers = await attachFs(world)
  try {
    assert.ok(Array.isArray(fibers) && fibers.length > 0, 'the row appended its FS shadow to the attach')
    const before = counterSnapshot()
    const outcome = await dispatch(world, 'read', { file_path: world.sibling })
    assert.equal(outcome.isError, true, 'the read failed instead of answering')
    assert.doesNotMatch(outcome.text, new RegExp(SIBLING_BYTES, 'u'), 'no sibling-Member byte reached the model')
    assert.equal(base.reads, before.reads, 'the INHERITED base provider was never asked for the bytes')
    const denials = denialsOf(await factsOf(world))
    assert.equal(denials.length, 1, 'exactly one deny fact')
    assert.equal(denials[0].method, 'stat')
    assert.equal(denials[0].decidedBy, 'IO_READ_DENIED')
    assert.equal(denials[0].realm, 'member')
    assert.equal(denials[0].memberIdentity, IDENTITY.memberInstanceId)
    assert.equal(denials[0].locator, world.sibling)
  } finally {
    await world.mounted.dispose()
  }
})

test('D2 host reach: read of /etc/hostname is refused with 0 bytes and one deny fact', async () => {
  const world = await makeWorldWithRoots('d2')
  await attachFs(world)
  try {
    const before = counterSnapshot()
    const outcome = await dispatch(world, 'read', { file_path: '/etc/hostname' })
    assert.equal(outcome.isError, true)
    assert.equal(outcome.text.trim().length > 0, true, 'the refusal still carries a message')
    assert.equal(base.reads, before.reads, 'the base provider was never asked')
    const denials = denialsOf(await factsOf(world))
    assert.equal(denials.length, 1)
    assert.equal(denials[0].decidedBy, 'IO_READ_DENIED')
    assert.equal(denials[0].locator, '/etc/hostname')
  } finally {
    await world.mounted.dispose()
  }
})

test('D3 write out of lane: nothing is created, refused with IO_WRITE_DENIED, 1 deny fact, 0 base writes', async () => {
  const world = await makeWorldWithRoots('d3')
  await attachFs(world)
  try {
    const before = counterSnapshot()
    const outcome = await dispatch(world, 'write', { file_path: world.outWrite, content: `${OUTLANE_BYTES}\n` })
    assert.equal(outcome.isError, true)
    assert.equal(existsSync(world.outWrite), false, 'the out-of-lane file was NOT created')
    assert.equal(base.writes, before.writes, 'the base provider never wrote')
    const denials = denialsOf(await factsOf(world))
    assert.equal(denials.length, 1)
    assert.equal(denials[0].decidedBy, 'IO_WRITE_DENIED')
    assert.equal(denials[0].locator, world.outWrite)
  } finally {
    await world.mounted.dispose()
  }
})

test('D4 edit out of lane: the file is unchanged, refused with IO_WRITE_DENIED, 1 deny fact', async () => {
  const world = await makeWorldWithRoots('d4')
  await attachFs(world)
  try {
    const before = counterSnapshot()
    const original = readFileSync(world.outEdit, 'utf8')
    const outcome = await dispatch(world, 'edit', { file_path: world.outEdit, old_string: 'A5SF_PD17_TARGET_ALPHA', new_string: 'A5SF_PD17_TARGET_EDITED' })
    assert.equal(outcome.isError, true)
    assert.equal(readFileSync(world.outEdit, 'utf8'), original, 'the out-of-lane file was NOT rewritten')
    assert.equal(base.edits, before.edits)
    const denials = denialsOf(await factsOf(world))
    assert.equal(denials.length, 1)
    assert.equal(denials[0].decidedBy, 'IO_WRITE_DENIED')
  } finally {
    await world.mounted.dispose()
  }
})

test('D5 read_image out of lane: 0 attachment saves, 0 image bytes, refused at the fs face, 1 deny fact', async () => {
  const world = await makeWorldWithRoots('d5')
  await attachFs(world)
  try {
    const before = counterSnapshot()
    const outcome = await dispatch(world, 'read_image', { file_path: world.outProbe })
    assert.equal(outcome.isError, true, 'the out-of-lane image read failed')
    assert.equal(world.attachments.saved.length, 0, 'no attachment was committed')
    assert.equal(base.imageReads, before.imageReads, 'the base provider never read the image bytes')
    const denials = denialsOf(await factsOf(world))
    assert.equal(denials.length, 1)
    assert.equal(denials[0].decidedBy, 'IO_READ_DENIED')
    assert.equal(denials[0].locator, world.outProbe)
  } finally {
    await world.mounted.dispose()
  }
})

// ===========================================================================
// A — in-lane functionality did not regress
// ===========================================================================
test('A1 allow read: an in-lane read returns the bytes, ≥1 allow fact, 0 deny facts', async () => {
  const world = await makeWorldWithRoots('a1')
  await attachFs(world)
  try {
    const before = counterSnapshot()
    const outcome = await dispatch(world, 'read', { file_path: world.ok })
    assert.equal(outcome.isError, false)
    assert.match(outcome.text, new RegExp(INLANE_BYTES, 'u'), 'the in-lane bytes were returned')
    assert.equal(base.reads, before.reads + 1, 'exactly one base read served it (the confined provider delegated)')
    const facts = await factsOf(world)
    assert.ok(allowFactsOf(facts).length >= 1, 'the allow decision was recorded')
    assert.equal(denialsOf(facts).length, 0)
    assert.equal(allowFactsOf(facts)[0].memberIdentity, IDENTITY.memberInstanceId)
  } finally {
    await world.mounted.dispose()
  }
})

test('A2 allow write: an in-lane write publishes the file through the base provider, ≥1 allow fact', async () => {
  const world = await makeWorldWithRoots('a2')
  await attachFs(world)
  try {
    const target = join(world.laneA, 'written.txt')
    const before = counterSnapshot()
    const outcome = await dispatch(world, 'write', { file_path: target, content: 'A5SF_PD17_WRITTEN\n' })
    assert.equal(outcome.isError, false)
    assert.equal(readFileSync(target, 'utf8'), 'A5SF_PD17_WRITTEN\n', 'the file was created with the requested content')
    assert.equal(base.writes, before.writes + 1, 'exactly one base write (the atomic publication is the base provider\'s)')
    assert.ok(allowFactsOf(await factsOf(world)).length >= 1)
    assert.equal(denialsOf(await factsOf(world)).length, 0)
  } finally {
    await world.mounted.dispose()
  }
})

test('A3 allow edit: the in-lane edit replaces old_string and the file changes', async () => {
  const world = await makeWorldWithRoots('a3')
  await attachFs(world)
  try {
    const before = counterSnapshot()
    const outcome = await dispatch(world, 'edit', { file_path: world.edit, old_string: 'A5SF_PD17_TARGET_ALPHA', new_string: 'A5SF_PD17_TARGET_BETA' })
    assert.equal(outcome.isError, false)
    assert.match(readFileSync(world.edit, 'utf8'), /A5SF_PD17_TARGET_BETA/u)
    assert.equal(base.edits, before.edits + 1)
    assert.equal(denialsOf(await factsOf(world)).length, 0)
  } finally {
    await world.mounted.dispose()
  }
})

test('A4 write⇒read is kept: a write to an existing file outside the READ lane is refused IO_WRITE_REQUIRES_READ and the file is unchanged', async () => {
  // The write lane covers the whole workspace root; the read lane covers only
  // `lane-a`, so an EXISTING file in `lane-b` is writable and unreadable. The
  // confined provider's native read-before-write contract must still refuse it
  // (the host's `write` replaces a file without reading it first).
  const world = await makeWorldWithRoots('a4', { lanes: (w) => ({ read: [w.laneA], write: [w.root] }) })
  await attachFs(world)
  try {
    const target = join(world.laneB, 'existing.txt')
    writeFileSync(target, 'A5SF_PD17_EXISTING_BYTES\n', 'utf8')
    const before = counterSnapshot()
    const outcome = await dispatch(world, 'write', { file_path: target, content: 'A5SF_PD17_OVERWRITTEN\n' })
    assert.equal(outcome.isError, true, 'a write without read coverage of an existing file is refused')
    assert.match(outcome.text, /write does not imply read/u)
    assert.equal(readFileSync(target, 'utf8'), 'A5SF_PD17_EXISTING_BYTES\n', 'the file was unchanged')
    assert.equal(base.writes, before.writes)
    const denials = denialsOf(await factsOf(world))
    assert.equal(denials.length, 1)
    assert.equal(denials[0].decidedBy, 'IO_WRITE_REQUIRES_READ')
  } finally {
    await world.mounted.dispose()
  }
})

test('A5 allow read_image: the in-lane image is returned and committed to the attachment store', async () => {
  const world = await makeWorldWithRoots('a5')
  await attachFs(world)
  try {
    const before = counterSnapshot()
    const outcome = await dispatch(world, 'read_image', { file_path: world.probe })
    assert.equal(outcome.isError, false, `the in-lane image read failed: ${outcome.text}`)
    assert.equal(world.attachments.saved.length, 1, 'one attachment commit')
    assert.equal(world.attachments.saved[0].data.length, PNG_1X1.length)
    assert.equal(base.imageReads, before.imageReads + 1, 'the confined provider delegated the byte read')
    assert.equal(denialsOf(await factsOf(world)).length, 0)
  } finally {
    await world.mounted.dispose()
  }
})

// ===========================================================================
// S — surface neutrality, and the deny-lane subset
// ===========================================================================
test('S1 surface neutral: names unchanged, the four parameter schemas byte-identical, prompt sections unchanged, definitions replaced', async () => {
  const world = await makeWorldWithRoots('s1')
  const namesBefore = toolNames(world)
  const schemasBefore = new Map(['read', 'write', 'edit', 'read_image'].map((name) => [name, JSON.stringify(schemaOf(world, name))]))
  const sectionsBefore = (await world.root.get('systemPrompt').assemble({ scope: world.agentKey })).sections.map((section) => section.name).sort()
  const definitionsBefore = new Map(['read', 'write', 'edit', 'read_image'].map((name) => [name, schemaOf(world, name)]))
  await attachFs(world)
  try {
    assert.deepEqual(toolNames(world), namesBefore, 'the model-visible name set is unchanged')
    for (const name of ['read', 'write', 'edit', 'read_image']) {
      assert.equal(JSON.stringify(schemaOf(world, name)), schemasBefore.get(name), `${name}'s parameter schema is byte-identical`)
      assert.notEqual(schemaOf(world, name), definitionsBefore.get(name), `${name} is the SHADOW definition, not the preset one`)
    }
    const sectionsAfter = (await world.root.get('systemPrompt').assemble({ scope: world.agentKey })).sections.map((section) => section.name).sort()
    assert.deepEqual(sectionsAfter, sectionsBefore, 'the prompt sections are unchanged')
  } finally {
    await world.mounted.dispose()
  }
})

test('D6 deny-lane subset: with write denied the shadow places only the visible names — write stays invisible, the attach still succeeds', async () => {
  const world = await makeWorldWithRoots('d6', { deny: ['write'] })
  await attachFs(world)
  try {
    assert.equal(toolNames(world).includes('write'), false, 'write stays invisible after the shadow')
    const outcome = await dispatch(world, 'write', { file_path: join(world.laneA, 'denied.txt'), content: 'NOPE\n' })
    assert.equal(outcome.isError, true, 'the denied tool is not executable')
    assert.equal(existsSync(join(world.laneA, 'denied.txt')), false)
    // The remaining three really are shadowed and governed.
    const sibling = await dispatch(world, 'read', { file_path: world.sibling })
    assert.equal(sibling.isError, true)
    assert.doesNotMatch(sibling.text, new RegExp(SIBLING_BYTES, 'u'))
  } finally {
    await world.mounted.dispose()
  }
})

// ===========================================================================
// S2 — a composition that OWNS the fs face keeps the shadow silent
// ===========================================================================
test('S2 configured fs-face module: a native module that DECLARES fs owns the face; the row appends no second registration and the surface is unchanged', async () => {
  const world = await makeWorldWithRoots('s2')
  // A real module file, shaped like a shipped tool package: it injects
  // tools/fs/systemPrompt (the fs declaration is the ownership signal) and
  // registers `read` with a marker body.
  const fixturePath = join(dirname(world.laneA), 'owned-fs-face.mjs')
  writeFileSync(fixturePath, `
export const name = 'fixture-owned-fs-face'
export const inject = ['tools', 'fs', 'systemPrompt']
export function apply(ctx) {
  ctx.systemPrompt.section({ name: 'tool:read', order: 50, text: 'owned fs face' })
  ctx.tools.register({
    name: 'read',
    description: 'owned read',
    parameters: { type: 'object', properties: { file_path: { type: 'string' } }, required: ['file_path'], additionalProperties: false },
    output: { schema: { type: 'string' }, render: (_a, value) => [{ type: 'text', text: String(value) }] },
    async execute(args) {
      const fs = ctx.get('fs')
      return 'OWNED:' + await fs.readText(await fs.resolve(args.file_path))
    },
  })
}
`, 'utf8')
  const namesBefore = toolNames(world)
  const config = row.a5sfRealmConfigOf({
    a5sfEvidencePath: world.sinkPath,
    a5sfNativeToolModules: [{ url: pathToFileURL(fixturePath).href }],
  })
  applyDeny(world)
  const fibers = await row.attachA5sfNativeToolModules(world.mounted, world.agentCtx, config, world.agentKey)
  try {
    assert.ok(Array.isArray(fibers) && fibers.length === 1, 'exactly the configured module was re-mounted (no appended fs shadow)')
    assert.deepEqual(toolNames(world), namesBefore, 'the model-visible surface is unchanged')
    const outcome = await dispatch(world, 'read', { file_path: world.ok })
    assert.equal(outcome.isError, false)
    assert.match(outcome.text, /OWNED:/u, 'the composition\'s own definition served the call (the row did not replace it)')
  } finally {
    await world.mounted.dispose()
  }
})

// ===========================================================================
// C1 — control: remove the shadow, the leak returns
// ===========================================================================
test('C1 control: disposing the native modules restores the ungoverned preset path (the refusal goes RED in place)', async () => {
  const world = await makeWorldWithRoots('c1')
  await attachFs(world)
  try {
    const refusal = await dispatch(world, 'read', { file_path: world.sibling })
    assert.equal(refusal.isError, true, 'the shadow refuses while mounted')
    await world.mounted.disposeNativeToolModules()
    const leaked = await dispatch(world, 'read', { file_path: world.sibling })
    assert.equal(leaked.isError, false, 'without the shadow the preset definition serves the read again')
    assert.match(leaked.text, new RegExp(SIBLING_BYTES, 'u'), 'and it returns the sibling Member\'s bytes')
  } finally {
    await world.mounted.dispose()
  }
})
