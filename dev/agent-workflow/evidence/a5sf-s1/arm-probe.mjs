/**
 * a5sf-s1 arm probe — the SIX acceptance arms, driven through the PRODUCT seam
 * (`mountMemberA5sfRealm` + `attachA5sfNativeToolModules`) with the REAL pinned
 * `@deepseek-ai/dsh-tool-fs` package, and printed one line per measured fact.
 *
 * This is the evidence driver for `dev/agent-workflow/evidence/a5sf-s1/`; the
 * permanent regression gate is `tests/world-factory/a5sf-tool-axis.test.mjs`
 * (TA2/TA6/TA7/TA8/TA9/TA10). ZERO Host boots, ZERO ports, no DSH_HOME.
 *
 * Run: node dev/agent-workflow/evidence/a5sf-s1/arm-probe.mjs
 * Exit: 0 = every arm measured as required; 1 = a mismatch (printed with the facts).
 */
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire, register } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..', '..', '..')
register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)

const row = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs')).href)
const policy = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'member-io-policy', 'src', 'index.ts')).href)
const runtimeRequire = createRequire(join(REPO_ROOT, 'packages', 'runtime', 'package.json'))
const { Context, Service } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href)
const ToolRuntime = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-tools')).href)).default
const SystemPrompt = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-system-prompt')).href)).default
const { bindScopeParent, createScope } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-scope')).href)
const BASELINE_TOOL_FS = join(REPO_ROOT, 'tests', 'deepseek-harness-test-use', 'packages', 'fs', 'tool-fs', 'lib', 'index.js')
const native = await import(pathToFileURL(BASELINE_TOOL_FS).href)

const IDENTITY = Object.freeze({ teamId: 'team-a5sf-s1-probe', memberInstanceId: 'member-s1-probe', templateId: 'worker', instanceGeneration: 1 })
const READ_BINDING = 'dsh.fs/read'
const lane = (allow) => ({ mode: 'restricted', allow: [...allow], ask: [], deny: [] })
const ceilingOf = (r) => ({ memberIdentity: IDENTITY.memberInstanceId, templateId: 'worker', instanceGeneration: 1, revision: 'a5sf1:s1:g1', read: lane([r]), write: lane([r]), network: { access: 'allow' } })
const restrictionOf = (r) => ({ bindingIdentity: READ_BINDING, read: lane([r]), write: { mode: 'all', allow: [], ask: [], deny: [] }, network: 'allow' })
const compile = (ceiling, restriction) => {
  const out = policy.compileEffectiveIo(ceiling, restriction, {
    memberIdentity: IDENTITY.memberInstanceId, callId: 'c1', policyRevision: ceiling.revision, toolBindingIdentity: READ_BINDING, approvedOnce: false,
  })
  assert.equal(out.ok, true, `compileEffectiveIo refused: ${JSON.stringify(out)}`)
  return out.value
}

class BaseFs extends Service {
  constructor(ctx, config = {}) { super(ctx, 'fs'); this.config = config }
  processPath(t) { return t.hostPath }
  contains(a, b) { return String(this.processPath(b)).startsWith(String(this.processPath(a))) }
  async resolve(p) { return { hostPath: p, displayPath: p } }
  async readText(t) { return readFileSync(this.processPath(t), 'utf8') }
  async streamText(t) { const text = await this.readText(t); return (async function* () { yield text })() }
  async readBytes(t) { return readFileSync(this.processPath(t)) }
  async readByteRange(t) { return readFileSync(this.processPath(t)) }
  async listDir() { return [] }
  async stat() { return { type: 'file', size: 3, mtimeMs: 0, mode: 0o644 } }
  async lstat() { return { type: 'file', size: 3, mtimeMs: 0, mode: 0o644 } }
  async watch() { return async () => {} }
  async writeText(t, content) {
    const p = this.processPath(t)
    const before = existsSync(p) ? readFileSync(p, 'utf8') : null
    return { operation: before === null ? 'create' : 'update', version: 'v1', before, after: String(content) }
  }
  async editText() { return { version: 'v2', before: '', after: '' } }
}

class ProbeAttachments extends Service {
  constructor(ctx) {
    super(ctx, 'attachments')
    this.imageLimits = {
      mediaTypes: ['image/png', 'image/jpeg', 'image/webp', 'image/gif'],
      maxImageBytes: 10_000_000,
      maxMessageImageBytes: 10_000_000,
      maxImageDimension: 8192,
      maxImagePixels: 40_000_000,
    }
  }

  async saveImage(image) { return { id: 'att', mediaType: image.mediaType, bytes: image.data?.length ?? 0 } }
}

const cleanup = []
const dirs = []
function fixture(label) {
  const dir = mkdtempSync(join(tmpdir(), `a5sf-s1-${label}-`)); dirs.push(dir)
  const inside = join(dir, 'inside'); mkdirSync(inside, { recursive: true })
  writeFileSync(join(inside, 'ok.txt'), 'INSIDE\n')
  writeFileSync(join(dir, 'ceiling-only.txt'), 'CEILING_ONLY\n')
  return { dir, inside, insideFile: join(inside, 'ok.txt'), ceilingOnly: join(dir, 'ceiling-only.txt') }
}
function sinkOf(label) {
  const dir = mkdtempSync(join(tmpdir(), `a5sf-s1-sink-${label}-`)); dirs.push(dir)
  return join(dir, 'consult.jsonl')
}
const factsOf = (p) => (existsSync(p) ? readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [])

async function worldWith({ ceiling, bindings = [], sinkPath, attachments = false }) {
  const root = new Context(); cleanup.push(root)
  await root.plugin(SystemPrompt); await root.plugin(ToolRuntime); await root.plugin(BaseFs, {})
  const standingKey = {}; const standing = createScope(root, standingKey)
  if (attachments) await root.plugin(ProbeAttachments)
  await standing.ctx.plugin(native)
  const agentKey = { session: { header: {} } }; const agent = createScope(root, agentKey); bindScopeParent(agentKey, standingKey)
  const realm = await row.mountMemberA5sfRealm({
    root: agent.ctx,
    a5sfConfig: row.a5sfRealmConfigOf({ a5sfEvidencePath: sinkPath }),
    provider: () => ({
      compiledFor: () => ({
        members: [{ identity: IDENTITY, policy: { ok: true, value: ceiling } }],
        ...(bindings.length === 0 ? {} : { bindings: bindings.map((effective) => ({ identity: IDENTITY, toolBindingIdentity: READ_BINDING, effective })) }),
        providerClass: BaseFs,
      }),
    }),
    member: { sessionId: 'session-s1', instanceId: IDENTITY.memberInstanceId, teamRootSessionId: 'team-root-s1', templateId: IDENTITY.templateId },
  })
  return { root, agentCtx: agent.ctx, agentKey, realm }
}

async function attach(world, sinkPath, specs = [BASELINE_TOOL_FS]) {
  return row.attachA5sfNativeToolModules(world.realm, world.agentCtx, row.a5sfRealmConfigOf({
    a5sfEvidencePath: sinkPath, a5sfNativeToolModules: specs,
  }), world.agentKey)
}

async function call(world, name, args) {
  const settled = await world.root.get('tools').execute({ signal: new AbortController().signal, callId: `probe-${name}`, agent: world.agentKey, name, arguments: args })
  const text = Array.isArray(settled.content) ? settled.content.map((p) => (p?.type === 'text' ? p.text : '')).join('') : ''
  return { isError: settled.isError === true, text }
}
const read = (w, p) => call(w, 'read', { file_path: p })
const write = (w, p, content) => call(w, 'write', { file_path: p, content })
const names = (w) => w.root.get('tools').schemas(w.agentKey).map((s) => s.name)
const sections = async (w) => (await w.root.get('systemPrompt').assemble({ scope: w.agentKey })).sections.map((s) => s.name)
const routing = (fibers) => fibers.map((f) => f.a5sfRegistrationRouting)

const results = []
function arm(label, fn) {
  return (async () => {
    const line = await fn()
    results.push(`${label}: ${line}`)
    console.log(`${label}: ${line}`)
  })()
}

try {
  // --- ARM 1: TA2 inverted — refused, exactly one binding fact ---------------
  await arm('ARM-1 (invariant)', async () => {
    const fx = fixture('arm1'); const sink = sinkOf('arm1')
    const ceiling = ceilingOf(fx.dir)
    const w = await worldWith({ ceiling, bindings: [compile(ceiling, restrictionOf(fx.inside))], sinkPath: sink })
    try {
      await attach(w, sink)
      const outcome = await read(w, fx.ceilingOnly)
      const facts = factsOf(sink)
      assert.equal(outcome.isError, true, `expected refusal, got ${JSON.stringify(outcome.text)}`)
      assert.equal(facts.length, 1, `expected one fact, got ${JSON.stringify(facts)}`)
      assert.equal(facts[0].realm, 'binding')
      assert.equal(facts[0].toolBindingIdentity, READ_BINDING)
      assert.equal(facts[0].decision, 'deny')
      assert.equal(facts[0].decidedBy, 'IO_READ_DENIED')
      return `REFUSED ${JSON.stringify(outcome.text.slice(0, 96))} facts=[${facts.map((f) => `${f.realm}/${String(f.toolBindingIdentity)}/${f.method}/${f.decision}/${f.decidedBy}`).join(',')}]`
    } finally { await w.realm.dispose() }
  })

  // --- ARM 2: siblings unaffected -------------------------------------------
  await arm('ARM-2 (siblings)', async () => {
    const fx = fixture('arm2'); const sink = sinkOf('arm2')
    const outside = mkdtempSync(join(tmpdir(), 'a5sf-s1-outside-')); dirs.push(outside)
    const ceiling = ceilingOf(fx.dir)
    const w = await worldWith({ ceiling, bindings: [compile(ceiling, restrictionOf(fx.inside))], sinkPath: sink })
    try {
      const fibers = await attach(w, sink)
      const r = routing(fibers)
      const inside = await write(w, join(fx.dir, 'created.txt'), 'CREATED\n')
      const denied = await write(w, join(outside, 'refused.txt'), 'NOPE\n')
      const facts = factsOf(sink)
      assert.equal(inside.isError, false, `inside write failed: ${inside.text}`)
      assert.equal(denied.isError, true, 'outside write must be refused')
      assert.equal(facts.some((f) => f.toolBindingIdentity === READ_BINDING), false, 'a read-lane fact leaked into write')
      assert.equal(facts.every((f) => f.realm === 'member'), true, 'write facts must all be ceiling facts')
      return `ceilingFiber.forwarded=${JSON.stringify(r.find((e) => e.realm === 'ceiling').forwarded)} readFiber.forwarded=${JSON.stringify(r.find((e) => e.realm === 'binding').forwarded)}`
        + ` insideWrite=${inside.isError ? 'ERROR' : 'ok'} outsideWrite=${denied.isError ? 'denied' : 'ALLOWED'} facts=[${facts.map((f) => `${f.realm}/${String(f.toolBindingIdentity)}/${f.method}/${f.decision}/${f.decidedBy}`).join(',')}]`
    } finally { await w.realm.dispose() }
  })

  // --- ARM 3: no widening ----------------------------------------------------
  await arm('ARM-3 (no widening)', async () => {
    const fx = fixture('arm3'); const sink = sinkOf('arm3')
    const ceiling = ceilingOf(fx.inside) // ceiling: inside only
    const effective = compile(ceiling, restrictionOf(fx.dir)) // restriction: whole dir (wider)
    const w = await worldWith({ ceiling, bindings: [effective], sinkPath: sink })
    try {
      await attach(w, sink)
      const outcome = await read(w, fx.ceilingOnly)
      const facts = factsOf(sink)
      assert.equal(outcome.isError, true)
      assert.equal(facts.length, 1)
      assert.equal(facts[0].decision, 'deny')
      return `compiledReadAllow=${JSON.stringify(effective.read.allow)} nativeRead=${outcome.isError ? 'DENIED' : 'ALLOWED'} facts=[${facts.map((f) => `${f.realm}/${String(f.toolBindingIdentity)}/${f.method}/${f.decision}/${f.decidedBy}`).join(',')}]`
    } finally { await w.realm.dispose() }
  })

  // --- ARM 4: unbound tools keep working -------------------------------------
  await arm('ARM-4 (unbound)', async () => {
    const fx = fixture('arm4'); const sink = sinkOf('arm4')
    const w = await worldWith({ ceiling: ceilingOf(fx.dir), bindings: [], sinkPath: sink })
    try {
      const beforeNames = names(w)
      const fibers = await attach(w, sink)
      const outcome = await read(w, fx.ceilingOnly)
      const facts = factsOf(sink)
      assert.equal(outcome.isError, false, `unbound read failed: ${outcome.text}`)
      assert.deepEqual(names(w), beforeNames, 'surface changed')
      assert.equal(beforeNames.filter((n) => n === 'read').length, 1)
      assert.equal(facts.every((f) => f.realm === 'member' && f.toolBindingIdentity === null), true)
      return `fibers=${fibers.length} forwarded=${JSON.stringify(routing(fibers)[0].forwarded)} read=${outcome.isError ? 'ERROR' : 'ok'} facts=[${facts.map((f) => `${f.realm}/${String(f.toolBindingIdentity)}/${f.method}/${f.decision}`).join(',')}]`
    } finally { await w.realm.dispose() }
  })

  // --- ARM 5: surface neutrality per fiber + refusal disposes ----------------
  await arm('ARM-5 (surface)', async () => {
    const fx = fixture('arm5'); const sink = sinkOf('arm5')
    const ceiling = ceilingOf(fx.dir)
    const w = await worldWith({ ceiling, bindings: [compile(ceiling, restrictionOf(fx.inside))], sinkPath: sink })
    try {
      const beforeNames = names(w); const beforeSections = await sections(w)
      const fibers = await attach(w, sink)
      const r = routing(fibers)
      const forwarded = r.flatMap((e) => e.forwarded)
      const forwardedSections = r.flatMap((e) => e.forwardedSections)
      assert.equal(new Set(forwarded).size, forwarded.length, 'a tool name was registered twice')
      assert.deepEqual([...new Set(forwarded)].sort(), [...beforeNames].sort(), 'the union is not the pre-mount surface')
      assert.equal(new Set(forwardedSections).size, forwardedSections.length, 'a prompt section was registered twice')
      assert.deepEqual((await sections(w)).sort(), beforeSections.sort(), 'prompt surface changed')
      return `partition=${JSON.stringify(r.map((e) => ({ realm: e.realm, tools: e.forwarded, sections: e.forwardedSections })))} surfaceBefore=${JSON.stringify(beforeNames)} surfaceAfter=${JSON.stringify(names(w))} sections=${JSON.stringify(forwardedSections)}`
    } finally { await w.realm.dispose() }
  })

  await arm('ARM-5b (surface refusal)', async () => {
    const fx = fixture('arm5b'); const sink = sinkOf('arm5b')
    const w = await worldWith({ ceiling: ceilingOf(fx.dir), bindings: [], sinkPath: sink })
    try {
      const extra = join(`${sink}.d`, 'extra.mjs'); mkdirSync(dirname(extra), { recursive: true })
      writeFileSync(extra, 'export const name = "x"\nexport const inject = ["tools"]\nexport function apply(ctx) { ctx.tools.register({ name: "x_a5sf_extra", description: "p", parameters: {}, output: { schema: { type: "object", properties: {} }, render: () => [] }, async execute() { return {} } }) }\n')
      const before = names(w); const factsBefore = factsOf(sink).length
      let refusal
      try { await attach(w, sink, [BASELINE_TOOL_FS, extra]) } catch (error) { refusal = error }
      assert.ok(refusal instanceof Error, 'the attach did not refuse')
      assert.match(refusal.message, /would CHANGE the Member's model-visible tool surface/)
      assert.deepEqual(names(w), before, 'surface changed after the refusal')
      assert.equal(factsOf(sink).length, factsBefore)
      return `refused=${JSON.stringify(refusal.message.slice(0, 88))} surfaceBefore=${JSON.stringify(before)} surfaceAfter=${JSON.stringify(names(w))} factsDelta=0`
    } finally { await w.realm.dispose() }
  })

  // --- ARM 6: teardown -------------------------------------------------------
  await arm('ARM-6 (teardown)', async () => {
    const mountSource = readFileSync(join(REPO_ROOT, 'packages', 'runtime', 'team-services', 'src', 'mount.ts'), 'utf8')
    const block = mountSource.slice(mountSource.indexOf('dispose: async (): Promise<void> => {'))
    const order = ['await disposeNative()', 'await disposeMounted()', 'await installation.dispose()'].map((call) => block.indexOf(call))
    assert.ok(order.every((at) => at !== -1) && order[0] < order[1] && order[1] < order[2], `dispose order ${order}`)
    const fx = fixture('arm6'); const sink = sinkOf('arm6')
    const ceiling = ceilingOf(fx.dir)
    const w = await worldWith({ ceiling, bindings: [compile(ceiling, restrictionOf(fx.inside))], sinkPath: sink })
    const presetRead = w.root.get('tools').get('read', w.agentKey)
    const fibers = await attach(w, sink)
    const shadowed = w.root.get('tools').get('read', w.agentKey)
    assert.notEqual(shadowed, presetRead, 'the binding shadow did not own read')
    fibers[0].dispose = async () => { throw new Error('router dispose boom') }
    let reported
    try { await w.realm.dispose() } catch (error) { reported = error }
    assert.match(String(reported?.message), /router dispose boom/, 'the teardown failure was swallowed')
    assert.equal(fibers[1].uid, null, 'the sibling fiber stayed mounted')
    const restored = w.root.get('tools').get('read', w.agentKey)
    assert.equal(restored, presetRead, 'the preset definition did not come back')
    return `disposeOrder=[nativeFibers,bindingRealms,memberInstallation] fibers=${fibers.length} throwingFiberReported=true siblingDisposed=${fibers[1].uid === null} presetRestored=${restored === presetRead}`
  })


  // --- ARM 7: deferred registration is refused, never on BASE ---------------
  await arm('ARM-7 (deferred)', async () => {
    const fx = fixture('arm7'); const sink = sinkOf('arm7')
    const ceiling = ceilingOf(fx.dir)
    const w = await worldWith({ ceiling, bindings: [compile(ceiling, restrictionOf(fx.inside))], sinkPath: sink, attachments: true })
    try {
      const presetRead = w.root.get('tools').get('read', w.agentKey)
      let refusal
      try { await attach(w, sink) } catch (error) { refusal = error }
      assert.ok(refusal instanceof Error, 'the attach accepted a module whose deferred registration cannot run')
      assert.match(refusal.message, /registers asynchronously|deferred registration/, `unexpected refusal: ${refusal.message}`)
      assert.equal(w.root.get('tools').get('read', w.agentKey), presetRead, 'a shadow survived the refusal')
      assert.equal(factsOf(sink).length, 0, 'the refused attach wrote a fact')
      // The unshadowed path consults NOTHING — the hole the refusal prevents.
      const outcome = await read(w, fx.ceilingOnly)
      assert.equal(outcome.isError, false, `the preset path should still run: ${outcome.text}`)
      assert.equal(factsOf(sink).length, 0, 'the base path wrote a guard fact')
      return `presetSurface=${JSON.stringify(names(w))} refused=${JSON.stringify(refusal.message.slice(0, 110))} shadowAfterRefusal=false baseReadFacts=0`
    } finally {
      await w.realm.dispose()
    }
  })

  console.log(`\nARMS: PASS ${results.length}/${results.length}`)
} catch (error) {
  console.error(`\nSIX-ARMS: FAIL — ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
} finally {
  for (const root of cleanup) { try { await root.dispose() } catch {} }
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
}
