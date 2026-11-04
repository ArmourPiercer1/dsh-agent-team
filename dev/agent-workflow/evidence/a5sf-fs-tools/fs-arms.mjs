/**
 * a5sf-fs-tools arm probe — the per-tool acceptance arms for `edit` (M-03) and
 * the adoptability measurement for `grep`/`glob` (M-06/M-07), driven through
 * the PRODUCT seam (`mountMemberA5sfRealm` + `attachA5sfNativeToolModules`)
 * with the REAL pinned modules from the 0.2.0-rc.2 baseline:
 *
 *   - `@deepseek-ai/dsh-tool-fs`        (pinned at tests/deepseek-harness-test-use/packages/fs/tool-fs)
 *   - `@deepseek-ai/dsh-tool-fs-search` (pinned at .../packages/fs/tool-fs-search)
 *
 * ZERO Host boots, ZERO ports, no DSH_HOME, no tests/homes/**: the our-worlds
 * are Cordis contexts built in-process. The upstream checkout is only READ.
 *
 * This is the evidence driver for `dev/agent-workflow/evidence/a5sf-fs-tools/`.
 * Run: node dev/agent-workflow/evidence/a5sf-fs-tools/fs-arms.mjs
 * Exit: 0 = every arm measured as required; 1 = a mismatch (printed with facts).
 */
import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire, register } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = join(HERE, '..', '..', '..', '..')
const BASELINE = join(REPO_ROOT, 'tests', 'deepseek-harness-test-use')
register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)

const row = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs')).href)
const policy = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'member-io-policy', 'src', 'index.ts')).href)
const runtimeRequire = createRequire(join(REPO_ROOT, 'packages', 'runtime', 'package.json'))
const { Context, Service } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href)
const ToolRuntime = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-tools')).href)).default
const SystemPrompt = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-system-prompt')).href)).default
const { bindScopeParent, createScope } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-scope')).href)

const BASELINE_TOOL_FS = join(BASELINE, 'packages', 'fs', 'tool-fs', 'lib', 'index.js')
const BASELINE_TOOL_FS_SEARCH = join(BASELINE, 'packages', 'fs', 'tool-fs-search', 'lib', 'index.js')
const BASELINE_SUBPROCESS_LOCAL = join(BASELINE, 'packages', 'subprocess', 'subprocess-local', 'lib', 'index.js')
const native = await import(pathToFileURL(BASELINE_TOOL_FS).href)
const search = await import(pathToFileURL(BASELINE_TOOL_FS_SEARCH).href)
const subprocessLocal = await import(pathToFileURL(BASELINE_SUBPROCESS_LOCAL).href)
/** The product preset's search caps (`sampleOverCapGlobResults` is REQUIRED by the module schema). */
const SEARCH_CONFIG = Object.freeze({ sampleOverCapGlobResults: false })

const IDENTITY = Object.freeze({ teamId: 'team-a5sf-fs-tools-probe', memberInstanceId: 'member-fs-tools-probe', templateId: 'worker', instanceGeneration: 1 })
const READ_BINDING = 'dsh.fs/read'
const lane = (allow) => ({ mode: 'restricted', allow: [...allow], ask: [], deny: [] })
const ceilingOf = ({ read, write }) => ({ memberIdentity: IDENTITY.memberInstanceId, templateId: 'worker', instanceGeneration: 1, revision: 'a5sf1:fs-tools:g1', read: lane(read), write: lane(write), network: { access: 'allow' } })
const readRestrictionOf = (allow) => ({ bindingIdentity: READ_BINDING, read: lane(allow), write: { mode: 'all', allow: [], ask: [], deny: [] }, network: 'allow' })
const compile = (ceiling, restriction) => {
  const out = policy.compileEffectiveIo(ceiling, restriction, {
    memberIdentity: IDENTITY.memberInstanceId, callId: 'c1', policyRevision: ceiling.revision, toolBindingIdentity: READ_BINDING, approvedOnce: false,
  })
  assert.equal(out.ok, true, `compileEffectiveIo refused: ${JSON.stringify(out)}`)
  return out.value
}

/**
 * The REAL provider semantics the guard sits in front of: the write and edit
 * paths actually mutate the file, and `editText` enforces the tool-level
 * unique-match so the probe can tell the guard's decision apart from the
 * tool's content check. `sandboxMode` is left undefined (no sandboxing
 * backend), so the module exposes no escalation fields.
 */
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
  async stat(t) { return { type: 'file', size: readFileSync(this.processPath(t)).length, mtimeMs: 0, mode: 0o644 } }
  async lstat(t) { return this.stat(t) }
  async watch() { return async () => {} }
  async writeText(t, content) {
    const p = this.processPath(t)
    const before = existsSync(p) ? readFileSync(p, 'utf8') : null
    writeFileSync(p, String(content))
    return { operation: before === null ? 'create' : 'update', version: 'v1', before, after: String(content) }
  }
  async editText(t, edit) {
    const p = this.processPath(t)
    const before = readFileSync(p, 'utf8')
    const { oldString, newString, replaceAll } = edit
    const occurrences = before.split(oldString).length - 1
    if (occurrences === 0) throw new Error(`old_string was not found in ${p}`)
    if (!replaceAll && occurrences > 1) throw new Error(`old_string is not unique in ${p} (${String(occurrences)} matches)`)
    const after = replaceAll ? before.split(oldString).join(newString) : before.replace(oldString, newString)
    writeFileSync(p, after)
    return { path: p, displayPath: p, before, after, version: 'v2' }
  }
}

const cleanup = []
const roots = []
function tree(label) {
  const dir = mkdtempSync(join(tmpdir(), `a5sf-fs-tools-${label}-`)); roots.push(dir)
  const inside = join(dir, 'inside'); mkdirSync(inside, { recursive: true })
  const outside = join(dir, 'outside'); mkdirSync(outside, { recursive: true })
  return { dir, inside, outside }
}
function sinkOf(label) {
  const dir = mkdtempSync(join(tmpdir(), `a5sf-fs-tools-sink-${label}-`)); roots.push(dir)
  return join(dir, 'consult.jsonl')
}
const factsOf = (p) => (existsSync(p) ? readFileSync(p, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)) : [])
const factLine = (f) => `${f.realm}/${String(f.toolBindingIdentity)}/${String(f.memberIdentity)}/${f.method}/${f.decision}/${f.decidedBy}`

async function worldWith({ ceiling, bindings = [], sinkPath, preset = [native], withSubprocess = false }) {
  const root = new Context(); cleanup.push(root)
  await root.plugin(SystemPrompt); await root.plugin(ToolRuntime)
  if (withSubprocess) await root.plugin(subprocessLocal.default ?? subprocessLocal)
  await root.plugin(BaseFs, {})
  const standingKey = {}; const standing = createScope(root, standingKey)
  for (const entry of preset) {
    if (entry && typeof entry === 'object' && 'module' in entry) await standing.ctx.plugin(entry.module, entry.config)
    else await standing.ctx.plugin(entry)
  }
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
    member: { sessionId: 'session-fs-tools', instanceId: IDENTITY.memberInstanceId, teamRootSessionId: 'team-root-fs-tools', templateId: IDENTITY.templateId },
  })
  return { root, agentCtx: agent.ctx, agentKey, realm }
}

async function attach(world, sinkPath, specs) {
  return row.attachA5sfNativeToolModules(world.realm, world.agentCtx, row.a5sfRealmConfigOf({
    a5sfEvidencePath: sinkPath, a5sfNativeToolModules: specs,
  }), world.agentKey)
}

async function call(world, name, args) {
  const settled = await world.root.get('tools').execute({ signal: new AbortController().signal, callId: `probe-${name}-${Math.random().toString(16).slice(2)}`, agent: world.agentKey, name, arguments: args })
  const text = Array.isArray(settled.content) ? settled.content.map((p) => (p?.type === 'text' ? p.text : '')).join('') : ''
  return { isError: settled.isError === true, text }
}
const edit = (w, filePath, oldString, newString) => call(w, 'edit', { file_path: filePath, old_string: oldString, new_string: newString })
const names = (w) => w.root.get('tools').schemas(w.agentKey).map((s) => s.name)
const sections = async (w) => (await w.root.get('systemPrompt').assemble({ scope: w.agentKey })).sections.map((s) => s.name)
const routing = (fibers) => fibers.map((f) => f.a5sfRegistrationRouting)
const ceilingReceipt = (fibers) => routing(fibers).find((e) => e.realm === 'ceiling')
const bindingReceipt = (fibers) => routing(fibers).find((e) => e.realm === 'binding')

const results = []
function arm(label, fn) {
  return (async () => {
    const line = await fn()
    results.push(`${label}: ${line}`)
    console.log(`${label}: ${line}`)
  })()
}

try {
  // === PART A — `edit` (M-03) ================================================

  // --- E1: in-lane edit succeeds through the ROUTED (confined) definition ----
  await arm('EDIT-1 (in-lane, routed definition)', async () => {
    const fx = tree('e1'); const sink = sinkOf('e1')
    const target = join(fx.inside, 'edit-me.txt'); writeFileSync(target, 'alpha\nbeta\n')
    const control = join(fx.inside, 'control.txt'); writeFileSync(control, 'alpha\n')
    const ceiling = ceilingOf({ read: [fx.inside], write: [fx.inside] })
    const w = await worldWith({ ceiling, bindings: [compile(ceiling, readRestrictionOf(fx.inside))], sinkPath: sink })
    try {
      // CONTROL: before the attach the PRESET definition runs unconfined — same
      // successful edit, ZERO guard facts. The fact delta below is therefore
      // attributable to the routed (confined) definition, not to the tool.
      const presetEdit = w.root.get('tools').get('edit', w.agentKey)
      const before = await edit(w, control, 'alpha', 'ALPHA')
      const factsAfterControl = factsOf(sink).length
      assert.equal(before.isError, false, `preset control edit failed: ${before.text}`)
      assert.equal(factsAfterControl, 0, 'the preset definition unexpectedly consulted the guard')
      assert.equal(readFileSync(control, 'utf8'), 'ALPHA\n')

      const fibers = await attach(w, sink, [{ url: BASELINE_TOOL_FS, expectedTools: ['read', 'write', 'edit'] }])
      const routedEdit = w.root.get('tools').get('edit', w.agentKey)
      assert.notEqual(routedEdit, presetEdit, 'the attach did not shadow edit')
      assert.equal(ceilingReceipt(fibers).forwarded.includes('edit'), true, 'the ceiling receipt did not forward edit')

      const outcome = await edit(w, target, 'alpha', 'ALPHA')
      const facts = factsOf(sink)
      assert.equal(outcome.isError, false, `in-lane edit failed: ${outcome.text}`)
      assert.equal(readFileSync(target, 'utf8'), 'ALPHA\nbeta\n', 'the new bytes are not on disk')
      assert.equal(facts.length, 1, `expected one guard fact, got ${JSON.stringify(facts)}`)
      assert.equal(facts[0].realm, 'member')
      assert.equal(facts[0].toolBindingIdentity, null)
      assert.equal(facts[0].method, 'editText')
      assert.equal(facts[0].decision, 'allow')
      assert.equal(facts[0].memberIdentity, IDENTITY.memberInstanceId)
      return `presetEdit=unconfined(facts=0) routedEdit=shadow ceilingForwarded=${JSON.stringify(ceilingReceipt(fibers).forwarded)}`
        + ` result=${JSON.stringify(outcome.text)} disk=${JSON.stringify(readFileSync(target, 'utf8'))}`
        + ` facts=[${facts.map(factLine).join(',')}]`
    } finally { await w.realm.dispose() }
  })

  // --- E2: out-of-lane edit is REFUSED by the guard, bytes unchanged ---------
  await arm('EDIT-2 (out-of-lane refused)', async () => {
    const fx = tree('e2'); const sink = sinkOf('e2')
    const target = join(fx.outside, 'outside.txt'); writeFileSync(target, 'DO-NOT-TOUCH\n')
    const ceiling = ceilingOf({ read: [fx.inside], write: [fx.inside] })
    const w = await worldWith({ ceiling, bindings: [compile(ceiling, readRestrictionOf(fx.inside))], sinkPath: sink })
    try {
      await attach(w, sink, [{ url: BASELINE_TOOL_FS, expectedTools: ['read', 'write', 'edit'] }])
      const outcome = await edit(w, target, 'DO-NOT-TOUCH', 'CHANGED')
      const facts = factsOf(sink)
      assert.equal(outcome.isError, true, 'the out-of-lane edit was NOT refused')
      // The model-facing text is the provider's remediation; the TYPED code is
      // the guard fact below (decidedBy=IO_WRITE_DENIED).
      assert.match(outcome.text, /outside every allow subtree/, `unexpected refusal text: ${outcome.text}`)
      assert.equal(readFileSync(target, 'utf8'), 'DO-NOT-TOUCH\n', 'the refused edit changed bytes')
      assert.equal(facts.length, 1, `expected one guard fact, got ${JSON.stringify(facts)}`)
      assert.equal(facts[0].realm, 'member')
      assert.equal(facts[0].toolBindingIdentity, null)
      assert.equal(facts[0].method, 'editText')
      assert.equal(facts[0].decision, 'deny')
      assert.equal(facts[0].decidedBy, 'IO_WRITE_DENIED')
      assert.equal(facts[0].memberIdentity, IDENTITY.memberInstanceId)
      return `result=${JSON.stringify(outcome.text.slice(0, 88))} disk=${JSON.stringify(readFileSync(target, 'utf8'))}`
        + ` facts=[${facts.map(factLine).join(',')}]`
    } finally { await w.realm.dispose() }
  })

  // --- E3a: the READ axis governs an edit on an existing file ----------------
  // write lane covers the whole tree, read lane only `inside/`: the target's
  // PATH is inside the write allowance, so the write lane alone would admit it.
  await arm('EDIT-3a (read-before-write: write lane yes, read lane no)', async () => {
    const fx = tree('e3a'); const sink = sinkOf('e3a')
    const target = join(fx.dir, 'axis.txt'); writeFileSync(target, 'gamma\n')
    const ceiling = ceilingOf({ read: [fx.inside], write: [fx.dir] })
    const w = await worldWith({ ceiling, sinkPath: sink })
    try {
      await attach(w, sink, [{ url: BASELINE_TOOL_FS, expectedTools: ['read', 'write', 'edit'] }])
      const outcome = await edit(w, target, 'gamma', 'GAMMA')
      const facts = factsOf(sink)
      assert.equal(outcome.isError, true, 'an edit the read axis does not cover was admitted')
      assert.match(outcome.text, /read axis does not cover it/, `unexpected denial text: ${outcome.text}`)
      assert.equal(readFileSync(target, 'utf8'), 'gamma\n', 'bytes changed despite the read-axis denial')
      assert.equal(facts.length, 1, `expected one guard fact, got ${JSON.stringify(facts)}`)
      assert.equal(facts[0].method, 'editText')
      assert.equal(facts[0].decision, 'deny')
      assert.equal(facts[0].decidedBy, 'IO_WRITE_REQUIRES_READ')
      return `compiledReadAllow=${JSON.stringify(ceiling.read.allow)} compiledWriteAllow=${JSON.stringify(ceiling.write.allow)}`
        + ` targetInsideWrite=true targetInsideRead=false result=${JSON.stringify(outcome.text.slice(0, 96))}`
        + ` disk=${JSON.stringify(readFileSync(target, 'utf8'))} facts=[${facts.map(factLine).join(',')}]`
    } finally { await w.realm.dispose() }
  })

  // --- E3b: the WRITE axis denies a target the read axis covers --------------
  await arm('EDIT-3b (write lane no, read lane yes)', async () => {
    const fx = tree('e3b'); const sink = sinkOf('e3b')
    const target = join(fx.dir, 'axis2.txt'); writeFileSync(target, 'delta\n')
    const ceiling = ceilingOf({ read: [fx.dir], write: [fx.inside] })
    const w = await worldWith({ ceiling, sinkPath: sink })
    try {
      await attach(w, sink, [{ url: BASELINE_TOOL_FS, expectedTools: ['read', 'write', 'edit'] }])
      const outcome = await edit(w, target, 'delta', 'DELTA')
      const facts = factsOf(sink)
      assert.equal(outcome.isError, true, 'a write the write axis does not cover was admitted')
      assert.match(outcome.text, /outside every allow subtree/, `unexpected denial text: ${outcome.text}`)
      assert.equal(readFileSync(target, 'utf8'), 'delta\n')
      assert.equal(facts[0].decidedBy, 'IO_WRITE_DENIED')
      return `result=${JSON.stringify(outcome.text.slice(0, 88))} disk=${JSON.stringify(readFileSync(target, 'utf8'))} facts=[${facts.map(factLine).join(',')}]`
    } finally { await w.realm.dispose() }
  })

  // --- E3c: the read requirement is conditioned on the target EXISTING -------
  // A brand-new file has nothing to read, so a write lane that covers it is
  // enough even though the read lane does not (measured on `write`, the sibling
  // that shares the same guard rule; `edit` cannot create a file).
  await arm('EDIT-3c (read-before-write is existence-conditioned)', async () => {
    const fx = tree('e3c'); const sink = sinkOf('e3c')
    const fresh = join(fx.dir, 'created.txt')
    const existing = join(fx.dir, 'existing.txt'); writeFileSync(existing, 'epsilon\n')
    const ceiling = ceilingOf({ read: [fx.inside], write: [fx.dir] })
    const w = await worldWith({ ceiling, sinkPath: sink })
    try {
      await attach(w, sink, [{ url: BASELINE_TOOL_FS, expectedTools: ['read', 'write', 'edit'] }])
      const created = await call(w, 'write', { file_path: fresh, content: 'NEW\n' })
      const contradicted = await edit(w, existing, 'epsilon', 'EPSILON')
      const facts = factsOf(sink)
      assert.equal(created.isError, false, `the create in the write lane failed: ${created.text}`)
      assert.equal(readFileSync(fresh, 'utf8'), 'NEW\n')
      assert.equal(contradicted.isError, true, 'the existing-file edit bypassed the read requirement')
      assert.match(contradicted.text, /read axis does not cover it/)
      return `createInWriteLane=${created.isError ? 'ERROR' : 'ok'} existingEdit=${contradicted.isError ? 'denied(IO_WRITE_REQUIRES_READ)' : 'ALLOWED'}`
        + ` facts=[${facts.map(factLine).join(',')}]`
    } finally { await w.realm.dispose() }
  })

  // --- E3d: CONTENT is not a lane dimension ---------------------------------
  // `old_string` that does not occur: the guard has already admitted the path
  // (one allow fact), and the provider's unique-match check refuses the edit.
  // This is the honest boundary of "read the old content": the read axis is
  // path-scoped, and the only content-sensitive check is the tool's match.
  await arm('EDIT-3d (content is not a lane; unique-match is tool-level)', async () => {
    const fx = tree('e3d'); const sink = sinkOf('e3d')
    const target = join(fx.inside, 'content.txt'); writeFileSync(target, 'zeta\neta\n')
    const ceiling = ceilingOf({ read: [fx.inside], write: [fx.inside] })
    const w = await worldWith({ ceiling, sinkPath: sink })
    try {
      await attach(w, sink, [{ url: BASELINE_TOOL_FS, expectedTools: ['read', 'write', 'edit'] }])
      const outcome = await edit(w, target, 'not-present', 'X')
      const facts = factsOf(sink)
      assert.equal(outcome.isError, true, 'a mismatching old_string was admitted')
      assert.match(outcome.text, /not found/i, `unexpected tool error: ${outcome.text}`)
      assert.equal(readFileSync(target, 'utf8'), 'zeta\neta\n', 'bytes changed on a content mismatch')
      assert.equal(facts.length, 1, `expected the PATH admission fact, got ${JSON.stringify(facts)}`)
      assert.equal(facts[0].method, 'editText')
      assert.equal(facts[0].decision, 'allow')
      assert.equal(facts[0].decidedBy, 'ALLOW')
      return `pathAdmission=${facts[0].decision} then toolContentCheck=refused result=${JSON.stringify(outcome.text.slice(0, 80))} diskUnchanged=true`
    } finally { await w.realm.dispose() }
  })

  // --- E4: surface neutrality — `edit` once, on the ceiling partition --------
  await arm('EDIT-4 (surface neutrality)', async () => {
    const fx = tree('e4'); const sink = sinkOf('e4')
    const ceiling = ceilingOf({ read: [fx.inside], write: [fx.inside] })
    const w = await worldWith({ ceiling, bindings: [compile(ceiling, readRestrictionOf(fx.inside))], sinkPath: sink })
    try {
      const beforeNames = names(w); const beforeSections = await sections(w)
      const fibers = await attach(w, sink, [{ url: BASELINE_TOOL_FS, expectedTools: ['read', 'write', 'edit'] }])
      const ceilingPart = ceilingReceipt(fibers); const bindingPart = bindingReceipt(fibers)
      const forwarded = routing(fibers).flatMap((e) => e.forwarded)
      assert.equal(new Set(forwarded).size, forwarded.length, 'a tool name was registered twice')
      assert.deepEqual([...new Set(forwarded)].sort(), [...beforeNames].sort(), 'the union is not the pre-mount surface')
      assert.equal(ceilingPart.forwarded.filter((n) => n === 'edit').length, 1, 'edit is not forwarded exactly once by the ceiling')
      assert.equal(bindingPart.forwarded.includes('edit'), false, 'edit leaked onto the binding lane')
      assert.equal(routing(fibers).flatMap((e) => e.forwardedSections).filter((s) => s === 'tool:edit').length, 1)
      assert.deepEqual((await sections(w)).sort(), beforeSections.sort(), 'prompt surface changed')
      return `partition=${JSON.stringify(routing(fibers).map((e) => ({ realm: e.realm, tools: e.forwarded })))}`
        + ` editOnCeiling=${ceilingPart.forwarded.includes('edit')} editOnBinding=${bindingPart.forwarded.includes('edit')}`
        + ` surfaceBefore=${JSON.stringify(beforeNames)} surfaceAfter=${JSON.stringify(names(w))}`
    } finally { await w.realm.dispose() }
  })

  // === PART B — `grep` / `glob` (M-06 / M-07) ================================

  // --- SEARCH-1: the module mounts and forwards both tools ------------------
  await arm('SEARCH-1 (mount + forwarding + identity)', async () => {
    const fx = tree('s1'); const sink = sinkOf('s1')
    writeFileSync(join(fx.inside, 'needle.txt'), 'INSIDE-NEEDLE\n')
    writeFileSync(join(fx.outside, 'secret.txt'), 'OUTSIDE-SECRET\n')
    const ceiling = ceilingOf({ read: [fx.inside], write: [fx.inside] })
    const w = await worldWith({ ceiling, sinkPath: sink, preset: [{ module: search, config: SEARCH_CONFIG }], withSubprocess: true })
    try {
      const presetGrep = w.root.get('tools').get('grep', w.agentKey)
      const beforeNames = names(w)
      const fibers = await attach(w, sink, [{ url: BASELINE_TOOL_FS_SEARCH, config: SEARCH_CONFIG, expectedTools: ['grep', 'glob'] }])
      const routedGrep = w.root.get('tools').get('grep', w.agentKey)
      const routedGlob = w.root.get('tools').get('glob', w.agentKey)
      assert.notEqual(routedGrep, presetGrep, 'the attach did not shadow grep')
      assert.deepEqual([...new Set(routing(fibers).flatMap((e) => e.forwarded))].sort(), [...beforeNames].sort())
      assert.equal(ceilingReceipt(fibers).forwarded.includes('grep'), true)
      assert.equal(ceilingReceipt(fibers).forwarded.includes('glob'), true)
      return `module=@deepseek-ai/dsh-tool-fs-search registration=synchronous inject=["tools","systemPrompt","subprocess"]`
        + ` forwarded=${JSON.stringify(ceilingReceipt(fibers).forwarded)} routedDefinitionsShadowed=true`
        + ` surfaceBefore=${JSON.stringify(beforeNames)} surfaceAfter=${JSON.stringify(names(w))}`
    } finally { await w.realm.dispose() }
  })

  // --- SEARCH-2: in-lane search succeeds ------------------------------------
  await arm('SEARCH-2 (in-lane grep)', async () => {
    const fx = tree('s2'); const sink = sinkOf('s2')
    writeFileSync(join(fx.inside, 'needle.txt'), 'INSIDE-NEEDLE\n')
    const ceiling = ceilingOf({ read: [fx.inside], write: [fx.inside] })
    const w = await worldWith({ ceiling, sinkPath: sink, preset: [{ module: search, config: SEARCH_CONFIG }], withSubprocess: true })
    try {
      await attach(w, sink, [{ url: BASELINE_TOOL_FS_SEARCH, config: SEARCH_CONFIG, expectedTools: ['grep', 'glob'] }])
      const outcome = await call(w, 'grep', { pattern: 'INSIDE-NEEDLE', path: fx.inside })
      assert.equal(outcome.isError, false, `in-lane grep failed: ${outcome.text}`)
      assert.match(outcome.text, /INSIDE-NEEDLE/)
      const facts = factsOf(sink)
      assert.equal(facts.length, 0, `the fs guard was consulted for a subprocess search: ${JSON.stringify(facts)}`)
      return `result=${JSON.stringify(outcome.text.slice(0, 120).replace(/\n/g, '\\n'))} guardFacts=${facts.length}`
    } finally { await w.realm.dispose() }
  })

  // --- SEARCH-3: out-of-lane search is NOT refused by the guard -------------
  await arm('SEARCH-3 (out-of-lane grep: measured bypass)', async () => {
    const fx = tree('s3'); const sink = sinkOf('s3')
    writeFileSync(join(fx.inside, 'needle.txt'), 'INSIDE-NEEDLE\n')
    writeFileSync(join(fx.outside, 'secret.txt'), 'OUTSIDE-SECRET\n')
    const ceiling = ceilingOf({ read: [fx.inside], write: [fx.inside] })
    const w = await worldWith({ ceiling, sinkPath: sink, preset: [{ module: search, config: SEARCH_CONFIG }], withSubprocess: true })
    try {
      await attach(w, sink, [{ url: BASELINE_TOOL_FS_SEARCH, config: SEARCH_CONFIG, expectedTools: ['grep', 'glob'] }])
      const grep = await call(w, 'grep', { pattern: 'OUTSIDE-SECRET', path: fx.outside })
      const glob = await call(w, 'glob', { pattern: '**/*.txt', path: fx.outside })
      const facts = factsOf(sink)
      // The honest measurement: the ceiling read lane does NOT cover fx.outside,
      // yet both searches ran and returned the outside content.
      assert.equal(ceiling.read.allow.includes(fx.outside), false)
      assert.equal(grep.isError, false, `out-of-lane grep was refused (unexpected): ${grep.text}`)
      assert.match(grep.text, /OUTSIDE-SECRET/, 'the out-of-lane grep returned no content')
      assert.equal(glob.isError, false, `out-of-lane glob was refused (unexpected): ${glob.text}`)
      assert.match(glob.text, /secret\.txt/)
      assert.equal(facts.length, 0, `the guard produced facts for a subprocess search: ${JSON.stringify(facts)}`)
      return `readAllow=${JSON.stringify(ceiling.read.allow)} searched=${JSON.stringify(fx.outside)}`
        + ` grep=${grep.isError ? 'ERROR' : 'EXECUTED'} glob=${glob.isError ? 'ERROR' : 'EXECUTED'}`
        + ` guardFacts=${facts.length} grepText=${JSON.stringify(grep.text.slice(0, 100).replace(/\n/g, '\\n'))}`
    } finally { await w.realm.dispose() }
  })

  // --- SEARCH-4: what the module actually injects, read from the pinned source
  await arm('SEARCH-4 (pinned source: inject + unconfined spawn)', async () => {
    const src = readFileSync(BASELINE_TOOL_FS_SEARCH, 'utf8')
    const injectLine = src.match(/inject\s*=\s*\[[^\]]*\]/)?.[0] ?? 'NOT-FOUND'
    const spawnAt = src.indexOf('ctx.subprocess.spawn({')
    assert.notEqual(spawnAt, -1, 'the pinned module no longer spawns through ctx.subprocess')
    const claim = src.slice(Math.max(0, spawnAt - 700), spawnAt).match(/The spawn is unconfined[^\n]*/)?.[0] ?? 'no-comment'
    return `inject=${JSON.stringify(injectLine)} spawnSite=ctx.subprocess.spawn argvVector=true comment=${JSON.stringify(claim.slice(0, 90))}`
  })

  console.log(`\nFS-TOOLS ARMS: PASS ${results.length}/${results.length}`)
} catch (error) {
  console.error(`\nFS-TOOLS ARMS: FAIL — ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
} finally {
  for (const root of cleanup) { try { await root.dispose() } catch {} }
  for (const dir of roots) rmSync(dir, { recursive: true, force: true })
}
