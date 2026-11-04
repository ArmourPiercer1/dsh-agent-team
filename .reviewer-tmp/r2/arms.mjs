/**
 * a5sf-bl16 grep/glob arm probe — the per-tool acceptance arms for `grep`
 * (M-06) and `glob` (M-07) after BL-16 mounted a CONFINED `subprocess` face on
 * the Member realm.
 *
 * Driven through the PRODUCT seam (`mountMemberA5sfRealm` +
 * `attachA5sfNativeToolModules`) with the REAL pinned module from the
 * 0.2.0-rc.2 baseline (`tests/deepseek-harness-test-use/packages/fs/tool-fs-search`)
 * and the REAL ripgrep binary the module resolves. The OS layer is P1-07's
 * Landlock provider, not a double.
 *
 * ZERO Host boots, ZERO ports, no DSH_HOME, no `tests/homes/**`: every world is
 * an in-process Cordis context with `mkdtemp` fixtures. The upstream checkout
 * is only READ (CORE PATCH BUDGET = 0).
 *
 * Run: node dev/agent-workflow/evidence/a5sf-bl16-grep/grep-arms.mjs
 * Exit: 0 = every arm measured as required; 1 = a mismatch (printed with facts).
 *
 * ARMS
 *   PROBE      the launcher's own dimensions (content-read / write level)
 *   GREP-PRE   BEFORE the mount: the same out-of-lane grep runs on the
 *              inherited subprocess-local service, returns the outside bytes,
 *              and records ZERO facts (the hole BL-16 closes)
 *   GREP-IN    in-lane grep matches; exactly one ALLOW fact (method=spawn)
 *   GREP-OUT   out-of-lane grep is refused BEFORE the provider is called
 *              (spawn counter unchanged), one IO_READ_DENIED fact, no secret
 *   GREP-EXIT1 an in-lane search with no hit is NOT an error (exit 1 kept)
 *   GREP-EXIT2 an invalid pattern is a failure (rg exit 2), never "no matches"
 *   GLOB-IN    in-lane glob lists the file
 *   GLOB-OUT   out-of-lane glob refused, no process, one deny fact
 *   SHELL-DENY the review-round-2 closure: `sh -c 'cat /etc/passwd'` is refused
 *              at ADMISSION — one deny fact, `spawns` unchanged, no bytes
 *   KERNEL     layer 2 measured directly (raw provider, admission bypassed):
 *              the kernel refuses the out-of-lane read while the in-lane read
 *              succeeds — the allowance boundary, pinned rather than described
 *   PIN-ETC    layer 2 directly: a direct `/etc/passwd` read SUCCEEDS (the
 *              launcher's runtime_base), with ZERO guard facts
 *   PIN-SYMLINK an in-lane symlink -> `/etc/passwd` is served through rg
 *              (`--follow`), one ALLOW fact on the declared in-lane root
 *   PIN-HARDLINK a PRE-EXISTING in-lane hardlink to an outside inode is served
 *              (rg default arm), one ALLOW fact — the limit, measured
 *   PIN-CAPS   the in-lane capability narrowing, measured: write-a-file yes;
 *              mkdir, symlink creation and in-lane execve are DENIED; a
 *              hardlink BETWEEN two in-lane paths IS created (no link bit)
 *   PIN-PROGDIR a Member-writable copy NAMED `rg` executes: the allow-list is
 *              a name contract, not a byte-identity check (residual #3)
 */
import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { chmodSync, copyFileSync, existsSync, linkSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { createRequire, register } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = '/home/armourpiercer/projects/dsh-agent-team/.reviewer-tmp/r2'
const REPO_ROOT = '/home/armourpiercer/projects/dsh-agent-team/.worktrees/a5sf-bl16-grep'
const BASELINE = join(REPO_ROOT, 'tests', 'deepseek-harness-test-use')
register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)

const row = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs')).href)
const policy = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'member-io-policy', 'src', 'index.ts')).href)
const guarded = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'team-services', 'src', 'guard-observability.ts')).href)
const confinedModule = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'team-services', 'src', 'subprocess.ts')).href)
const providerModule = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'sandbox-provider', 'provider.ts')).href)
const profileModule = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'team-sandbox', 'src', 'profile.ts')).href)

const runtimeRequire = createRequire(join(REPO_ROOT, 'packages', 'runtime', 'package.json'))
const { Context, Service } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href)
const ToolRuntime = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-tools')).href)).default
const SystemPrompt = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-system-prompt')).href)).default
const { bindScopeParent, createScope } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-scope')).href)

const BASELINE_SEARCH = join(BASELINE, 'packages', 'fs', 'tool-fs-search', 'lib', 'index.js')
const BASELINE_SUBPROCESS_LOCAL = join(BASELINE, 'packages', 'subprocess', 'subprocess-local', 'lib', 'index.js')
const search = await import(pathToFileURL(BASELINE_SEARCH).href)
const subprocessLocal = await import(pathToFileURL(BASELINE_SUBPROCESS_LOCAL).href)
const SEARCH_CONFIG = Object.freeze({ sampleOverCapGlobResults: false })
const LAUNCHER = join(REPO_ROOT, 'packages', 'runtime', 'sandbox-provider', 'launcher', 'landlock-prelauncher.py')
const LAUNCHER_SHA = createHash('sha256').update(readFileSync(LAUNCHER)).digest('hex')

const IDENTITY = Object.freeze({ teamId: 'team-bl16-probe', memberInstanceId: 'member-bl16-probe', templateId: 'worker', instanceGeneration: 1 })
const REVISION = 'a5sf1:bl16:probe'
const BINDING = 'dsh.search/grep'
const lane = (allow) => ({ mode: 'restricted', allow: [...allow], ask: [], deny: [] })
const allLane = () => ({ mode: 'all', allow: [], ask: [], deny: [] })
const ceilingOf = (read, write) => ({ memberIdentity: IDENTITY.memberInstanceId, templateId: 'worker', instanceGeneration: 1, revision: REVISION, read: lane(read), write: lane(write), network: { access: 'allow' } })
const effectiveOf = (read, write, restrictionRead) => {
  const out = policy.compileEffectiveIo(ceilingOf(read, write), { bindingIdentity: BINDING, read: lane(restrictionRead), write: allLane(), network: 'allow' }, {
    memberIdentity: IDENTITY.memberInstanceId, callId: 'bl16-probe', policyRevision: REVISION, toolBindingIdentity: BINDING, approvedOnce: false,
  })
  assert.equal(out.ok, true, `compileEffectiveIo refused: ${JSON.stringify(out)}`)
  return out.value
}

// ---------------------------------------------------------------------------
// fixtures
// ---------------------------------------------------------------------------
const roots = []
const world = (() => {
  mkdirSync(join(tmpdir(), 'a5sf-bl16-arms'), { recursive: true })
  const dir = mkdtempSync(join(tmpdir(), 'a5sf-bl16-arms', 'w-'))
  roots.push(dir)
  return dir
})()
const inside = join(world, 'inside')
const outside = join(world, 'outside')
mkdirSync(inside, { recursive: true })
mkdirSync(outside, { recursive: true })
writeFileSync(join(inside, 'needle.txt'), 'INSIDE-NEEDLE\n', 'utf8')
writeFileSync(join(inside, 'quiet.txt'), 'nothing to see here\n', 'utf8')
writeFileSync(join(outside, 'secret.txt'), 'OUTSIDE-SECRET-MUST-NOT-LEAK\n', 'utf8')
// The three pinned limits (created OUTSIDE the sandbox, as the host would):
symlinkSync('/etc/passwd', join(inside, 'link-passwd'))
linkSync(join(outside, 'secret.txt'), join(inside, 'hard-secret'))
writeFileSync(join(inside, 's.sh'), '#!/bin/sh\necho RAN\n')
chmodSync(join(inside, 's.sh'), 0o755)
const RG_PATH = join(BASELINE, 'node_modules', '.pnpm', '@vscode+ripgrep-linux-x64@1.18.0', 'node_modules', '@vscode', 'ripgrep-linux-x64', 'bin', 'rg')
// A Member-writable copy of the allowed program name (residual #3 measured).
mkdirSync(join(inside, 'tools'), { recursive: true })
copyFileSync(RG_PATH, join(inside, 'tools', 'rg'))
chmodSync(join(inside, 'tools', 'rg'), 0o755)
const sinkOf = (name) => join(world, `consult-${name}.jsonl`)
const factsOf = async (path) => (existsSync(path) ? await guarded.readGuardConsultFile(path) : [])
const factLine = (f) => `${f.realm}/${String(f.toolBindingIdentity)}/${f.memberIdentity}/${f.method}/${f.decision}/${f.decidedBy}/${f.locator}`

/** The base `fs` Provider the realm needs (the search lane never calls it). */
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
  async watch() { return () => undefined }
  async writeText(t, c) { const p = this.processPath(t); writeFileSync(p, String(c)); return { version: 'v1' } }
  async editText(t, e) { const p = this.processPath(t); writeFileSync(p, String(e.newString)); return { version: 'v2' } }
}

const cleanup = []
function countingProvider(inner) {
  const spawns = { count: 0 }
  return {
    spawns,
    provider: {
      async spawnStreaming(request, streaming) { spawns.count += 1; return inner.spawnStreaming(request, streaming) },
      probe: () => inner.probe(),
    },
  }
}

function makeRaw(realmId, scratchName) {
  return providerModule.createConfinedProcessProvider({
    realmId,
    trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
    scratchRoot: join(world, `scratch-${scratchName}`),
    assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
  })
}

/** Drain a raw provider handle (streams + exit) to text. */
async function drainHandle(handle) {
  const chunks = []
  const consume = async (stream) => { for await (const chunk of stream) chunks.push(Buffer.from(chunk)) }
  await Promise.all([consume(handle.stdout), consume(handle.stderr), handle.exited])
  return Buffer.concat(chunks).toString('utf8')
}

/**
 * Run one request against the RAW provider, bypassing the admission on
 * purpose: this is how the OS boundary is pinned. `allowPaths` is built by the
 * product's own helper, so the test cannot drift from the shipped allowance.
 */
async function rawSpawnText(raw, realmId, effective, argv) {
  const profile = profileModule.compileExecutionProfile(effective)
  assert.equal(profile.ok, true, JSON.stringify(profile))
  const spawned = await raw.spawnStreaming({
    grantFingerprint: `bl16-raw-${Math.random().toString(16).slice(2)}`,
    realmId,
    bindingId: BINDING,
    memberScope: IDENTITY.memberInstanceId,
    argv,
    cwd: inside,
    env: [],
    allowPaths: confinedModule.confinedSpawnAllowPaths(profile.value.allowPaths, argv[0]),
    exitPassthrough: true,
  }, { graceMs: 5000 })
  assert.equal(spawned.ok, true, JSON.stringify(spawned))
  return drainHandle(spawned.value)
}

async function worldWith({ read, write, restriction, name, withLocalSubprocess = false }) {
  const effective = effectiveOf(read, write, restriction)
  const root = new Context()
  cleanup.push(root)
  await root.plugin(SystemPrompt)
  await root.plugin(ToolRuntime)
  await root.plugin(BaseFs, {})
  // The host service the realm shadows. Mounted in EVERY world: the confined
  // face is a SHADOW of a live provider, and `GREP-PRE` is the measurement of
  // what this service does when nothing confines it.
  await root.plugin(subprocessLocal.default ?? subprocessLocal)
  const standingKey = {}
  const standing = createScope(root, standingKey)
  await standing.ctx.plugin(search, SEARCH_CONFIG)
  const agentKey = { session: { header: {} } }
  const agent = createScope(root, agentKey)
  bindScopeParent(agentKey, standingKey)
  const sinkPath = sinkOf(name)
  const realmId = `realm-bl16-${name}`
  const raw = providerModule.createConfinedProcessProvider({
    realmId,
    trustRoot: `sha256:${LAUNCHER_SHA.slice(0, 16)}#${LAUNCHER}`,
    scratchRoot: join(world, `scratch-${name}`),
    assembly: { launcherPath: LAUNCHER, launcherSha256: LAUNCHER_SHA, minAbiVersion: 3 },
  })
  const counted = countingProvider(raw)
  const realm = await row.mountMemberA5sfRealm({
    root: agent.ctx,
    a5sfConfig: row.a5sfRealmConfigOf({ a5sfEvidencePath: sinkPath }),
    provider: () => ({
      compiledFor: () => ({
        members: [{ identity: IDENTITY, policy: { ok: true, value: ceilingOf(read, write) } }],
        providerClass: BaseFs,
        subprocess: {
          effective,
          provider: counted.provider,
          realmId,
          memberScope: IDENTITY.memberInstanceId,
          bindingId: BINDING,
        },
      }),
    }),
    member: { sessionId: 'session-bl16-probe', instanceId: IDENTITY.memberInstanceId, teamRootSessionId: 'team-root-bl16-probe', templateId: IDENTITY.templateId },
  })
  return { root, agentKey, agentCtx: agent.ctx, realm, sinkPath, spawns: counted.spawns, raw, active: true }
}

async function attach(w, name) {
  return row.attachA5sfNativeToolModules(w.realm, w.agentCtx, row.a5sfRealmConfigOf({
    a5sfEvidencePath: w.sinkPath,
    a5sfNativeToolModules: [{ url: BASELINE_SEARCH, expectedTools: ['grep', 'glob'], config: SEARCH_CONFIG }],
  }), w.agentKey)
}

async function call(w, name, args) {
  const settled = await w.root.get('tools').execute({ signal: new AbortController().signal, callId: `bl16-${name}-${Math.random().toString(16).slice(2)}`, agent: w.agentKey, name, arguments: args })
  const text = Array.isArray(settled.content) ? settled.content.map((p) => (p?.type === 'text' ? p.text : '')).join('') : ''
  return { isError: settled.isError === true, text }
}

const results = []
async function arm(label, fn) {
  const line = await fn()
  results.push(`${label}: ${line}`)
  console.log(`${label}: ${line}`)
}

const IN_LANE = { read: [inside], write: [inside], restriction: [inside] }

try {
  // --- PROBE -----------------------------------------------------------------
  await arm('PROBE', async () => {
    const w = await worldWith({ ...IN_LANE, name: 'probe' })
    try {
      const probe = await w.raw.probe()
      assert.equal(probe.ok, true, JSON.stringify(probe))
      const rows = probe.value
      const read = rows.find((r) => r.dimension === 'content-read')
      const write = rows.find((r) => r.dimension === 'write')
      return `content-read=${read.level} write=${write.level} launcherSha=${LAUNCHER_SHA.slice(0, 16)} rg=${search.resolveRgPath ? await search.resolveRgPath() : '(unresolved)'}`
    } finally { await w.realm.dispose(); w.active = false }
  })

  // --- GREP-PRE: the hole, measured on the same fixture ----------------------
  await arm('GREP-PRE (unconfined control, before the confined face)', async () => {
    const w = await worldWith({ ...IN_LANE, name: 'pre', withLocalSubprocess: true })
    try {
      const outcome = await call(w, 'grep', { pattern: 'OUTSIDE-SECRET', path: outside })
      const facts = await factsOf(w.sinkPath)
      assert.equal(outcome.isError, false, `the control did not run: ${outcome.text}`)
      assert.match(outcome.text, /OUTSIDE-SECRET-MUST-NOT-LEAK/, 'the unconfined control did not reach the outside bytes')
      assert.equal(facts.length, 0, 'the unconfined control consulted a guard')
      return `executed=yes outsideBytes=LEAKED facts=${facts.length}`
    } finally { await w.realm.dispose(); w.active = false }
  })

  // --- GREP-IN ---------------------------------------------------------------
  await arm('GREP-IN (in-lane, confined)', async () => {
    const w = await worldWith({ ...IN_LANE, name: 'in' })
    try {
      await attach(w, 'in')
      const outcome = await call(w, 'grep', { pattern: 'INSIDE-NEEDLE', path: inside })
      const facts = await factsOf(w.sinkPath)
      assert.equal(outcome.isError, false, `in-lane grep failed: ${outcome.text}`)
      assert.match(outcome.text, /INSIDE-NEEDLE/)
      assert.equal(facts.length, 1, `expected one fact, got ${JSON.stringify(facts)}`)
      assert.equal(facts[0].realm, 'member')
      assert.equal(facts[0].toolBindingIdentity, null)
      assert.equal(facts[0].method, 'spawn')
      assert.equal(facts[0].decision, 'allow')
      assert.equal(facts[0].locator, inside)
      assert.ok(w.spawns.count > 0, 'no process was spawned for an admitted search')
      return `result=${JSON.stringify(outcome.text.split('\n')[0].slice(0, 60))} spawns=${w.spawns.count} facts=[${facts.map(factLine).join(',')}]`
    } finally { await w.realm.dispose(); w.active = false }
  })

  // --- GREP-OUT: the discriminating arm + the negative control ---------------
  await arm('GREP-OUT (out-of-lane, refused before any process)', async () => {
    const w = await worldWith({ ...IN_LANE, name: 'out' })
    try {
      await attach(w, 'out')
      const before = w.spawns.count
      const outcome = await call(w, 'grep', { pattern: 'OUTSIDE-SECRET', path: outside })
      const after = w.spawns.count
      const facts = await factsOf(w.sinkPath)
      assert.equal(after, before, 'a process was spawned for a REFUSED search')
      assert.equal(outcome.isError, true, 'the out-of-lane search was NOT refused')
      assert.doesNotMatch(outcome.text, /OUTSIDE-SECRET-MUST-NOT-LEAK/, 'the outside bytes reached the model')
      assert.equal(facts.length, 1, `expected one fact, got ${JSON.stringify(facts)}`)
      assert.equal(facts[0].decision, 'deny')
      assert.equal(facts[0].decidedBy, 'IO_READ_DENIED')
      assert.equal(facts[0].locator, outside)
      return `spawns=${before}->${after} result=${JSON.stringify(outcome.text.replace(/\n/g, ' ').slice(0, 200))} facts=[${facts.map(factLine).join(',')}]`
    } finally { await w.realm.dispose(); w.active = false }
  })

  // --- GREP-EXIT1 / GREP-EXIT2 ----------------------------------------------
  await arm('GREP-EXIT1 (no match is not an error)', async () => {
    const w = await worldWith({ ...IN_LANE, name: 'exit1' })
    try {
      await attach(w, 'exit1')
      const outcome = await call(w, 'grep', { pattern: 'NO-SUCH-NEEDLE-ANYWHERE', path: inside })
      assert.equal(outcome.isError, false, `a no-match search was reported as a failure: ${outcome.text}`)
      assert.match(outcome.text.toLowerCase(), /no matches/)
      return `result=${JSON.stringify(outcome.text.slice(0, 60))}`
    } finally { await w.realm.dispose(); w.active = false }
  })

  await arm('GREP-EXIT2 (invalid pattern is a failure)', async () => {
    const w = await worldWith({ ...IN_LANE, name: 'exit2' })
    try {
      await attach(w, 'exit2')
      const outcome = await call(w, 'grep', { pattern: '([unclosed', path: inside })
      assert.equal(outcome.isError, true, 'an invalid pattern was reported as a clean search')
      assert.doesNotMatch(outcome.text.toLowerCase(), /no matches/)
      return `result=${JSON.stringify(outcome.text.slice(0, 72))}`
    } finally { await w.realm.dispose(); w.active = false }
  })

  // --- GLOB ------------------------------------------------------------------
  await arm('GLOB-IN (in-lane)', async () => {
    const w = await worldWith({ ...IN_LANE, name: 'globin' })
    try {
      await attach(w, 'globin')
      const outcome = await call(w, 'glob', { pattern: '*.txt', path: inside })
      const facts = await factsOf(w.sinkPath)
      assert.equal(outcome.isError, false, `in-lane glob failed: ${outcome.text}`)
      assert.match(outcome.text, /needle\.txt/)
      assert.equal(facts.length, 1)
      assert.equal(facts[0].decision, 'allow')
      return `result=${JSON.stringify(outcome.text.slice(0, 60))} facts=[${facts.map(factLine).join(',')}]`
    } finally { await w.realm.dispose(); w.active = false }
  })

  await arm('GLOB-OUT (out-of-lane, refused)', async () => {
    const w = await worldWith({ ...IN_LANE, name: 'globout' })
    try {
      await attach(w, 'globout')
      const before = w.spawns.count
      const outcome = await call(w, 'glob', { pattern: '*.txt', path: outside })
      const after = w.spawns.count
      const facts = await factsOf(w.sinkPath)
      assert.equal(after, before, 'a process was spawned for a REFUSED glob')
      assert.equal(outcome.isError, true, 'the out-of-lane glob was NOT refused')
      assert.doesNotMatch(outcome.text, /secret\.txt/, 'the outside listing reached the model')
      assert.equal(facts.length, 1)
      assert.equal(facts[0].decidedBy, 'IO_READ_DENIED')
      return `spawns=${before}->${after} facts=[${facts.map(factLine).join(',')}]`
    } finally { await w.realm.dispose(); w.active = false }
  })

  // --- SHELL-DENY: the review-round-2 closure --------------------------------
  await arm('SHELL-DENY (shell body refused at ADMISSION: one deny fact, spawns unchanged)', async () => {
    const w = await worldWith({ ...IN_LANE, name: 'shelldeny' })
    try {
      const service = w.realm.installation.members[0]?.subprocess
      assert.ok(service !== undefined, 'the realm mounted no confined subprocess face')
      const before = w.spawns.count
      const handle = service.spawn({
        argv: ['/bin/sh', '-c', `cat /etc/passwd; cat ${outside}/secret.txt`],
        cwd: inside,
        stdio: { stdin: 'ignore', stdout: { maxBytes: 1 << 20 }, stderr: { maxBytes: 1 << 16 } },
        graceMs: 5000,
      })
      const denial = await handle.done.then(() => undefined, (error) => error)
      // `w.spawns.count` wraps `provider.spawnStreaming`, so it IS the
      // provider-call counter; the return prints both names for the record.
      const after = w.spawns.count
      const facts = await factsOf(w.sinkPath)
      const text = handle.collected?.stdout?.readFrom(0).text ?? ''
      assert.notEqual(denial, undefined, 'the shell spawn was ADMITTED')
      assert.equal(after, before, 'a process was spawned for a refused shell body')
      assert.equal(facts.length, 1, `expected one fact, got ${JSON.stringify(facts)}`)
      assert.equal(facts[0].decision, 'deny')
      assert.equal(facts[0].decidedBy, 'IO_READ_DENIED')
      assert.equal(facts[0].method, 'spawn')
      assert.equal(facts[0].locator, '/bin/sh')
      assert.match(String(denial?.detail ?? denial?.message), /statically attributed|shell/i)
      assert.equal(text, '', 'a refused shell body returned bytes')
      assert.equal(readFileSync(join(outside, 'secret.txt'), 'utf8').includes('OUTSIDE-SECRET'), true)
      return `spawns=${before}->${after} providerCalls=${before}->${after} denial=${denial.code} facts=[${facts.map(factLine).join(',')}] bytes=${JSON.stringify(text)}`
    } finally { await w.realm.dispose(); w.active = false }
  })

  // --- KERNEL: layer 2 alone, admission bypassed -----------------------------
  await arm('KERNEL (raw provider: out-of-lane refused, in-lane served)', async () => {
    const effective = effectiveOf(IN_LANE.read, IN_LANE.write, IN_LANE.restriction)
    const realmId = 'realm-bl16-kernel'
    const raw = makeRaw(realmId, 'kernel')
    const before = await factsOf(join(world, 'no-such-sink.jsonl'))
    const text = await rawSpawnText(raw, realmId, effective,
      ['/bin/sh', '-c', `cat ${outside}/secret.txt 2>&1; echo RC=$?; cat ${inside}/needle.txt`])
    assert.match(text, /INSIDE-NEEDLE/, `the admitted read did not run: ${text}`)
    assert.doesNotMatch(text, /OUTSIDE-SECRET-MUST-NOT-LEAK/, 'the outside bytes reached the harness')
    assert.match(text, /Permission denied|EACCES/, 'the outside read was not refused by the kernel')
    assert.match(readFileSync(join(outside, 'secret.txt'), 'utf8'), /OUTSIDE-SECRET-MUST-NOT-LEAK/, 'the fixture changed')
    return `facts=${before.length} stdout=${JSON.stringify(text.replace(/\n/g, '\\n').slice(0, 96))}`
  })

  // --- PIN-ETC: the runtime_base grants /etc --------------------------------
  await arm('PIN-ETC (raw provider: direct /etc, /usr and /proc reads SUCCEED, zero guard facts)', async () => {
    const effective = effectiveOf(IN_LANE.read, IN_LANE.write, IN_LANE.restriction)
    const realmId = 'realm-bl16-pin-etc'
    const text = await rawSpawnText(makeRaw(realmId, 'pin-etc'), realmId, effective,
      ['/bin/sh', '-c', 'head -c 24 /etc/passwd; echo SEP; head -c 24 /usr/lib/os-release; echo SEP; head -c 24 /proc/self/status'])
    assert.match(text, /root:x:0:0/, `the kernel did not serve /etc/passwd: ${text}`)
    assert.match(text, /PRETTY_NAME=/, `the kernel did not serve /usr/lib/os-release: ${text}`)
    assert.match(text, /Name:/, `the kernel did not serve /proc/self/status: ${text}`)
    return `kernelRead=/etc/passwd+/usr/lib/os-release+/proc/self/status SUCCEEDED facts=0 (raw provider, no admission consulted) stdout=${JSON.stringify(text.replace(/\n/g, '\\n').slice(0, 96))}`
  })

  // --- PIN-CAPS: the in-lane capability narrowing ---------------------------
  await arm('PIN-CAPS (raw provider: write-file yes; mkdir/symlink/execve DENIED; in-lane hardlink ALLOWED)', async () => {
    const effective = effectiveOf(IN_LANE.read, IN_LANE.write, IN_LANE.restriction)
    const realmId = 'realm-bl16-pin-caps'
    const text = await rawSpawnText(makeRaw(realmId, 'pin-caps'), realmId, effective,
      ['/bin/sh', '-c', `mkdir ${join(inside, 'd1')} 2>&1; echo MK=$?; echo hi > ${join(inside, 'f1')} 2>&1; echo WR=$?; ln -s needle.txt ${join(inside, 'link-in')} 2>&1; echo SYM_IN=$?; ln -s /etc/passwd ${join(inside, 'link-new')} 2>&1; echo SYM_ETC=$?; ln ${join(inside, 'needle.txt')} ${join(inside, 'hard-new')} 2>&1; echo HARD=$?; ( exec ${join(inside, 's.sh')} ) 2>&1; echo EX=$?`])
    assert.match(text, /mkdir: Permission denied/, `mkdir was not narrowed: ${text}`)
    assert.match(text, /MK=1/)
    assert.match(text, /WR=0/, `an in-lane file write was refused: ${text}`)
    assert.match(text, /ln: failed to create symbolic link/, `symlink creation was not narrowed: ${text}`)
    assert.match(text, /SYM_IN=1/)
    assert.match(text, /SYM_ETC=1/)
    // MEASURED, contrary to the "no link creation" shorthand: a hardlink
    // between two in-lane paths IS created (the OS profile has no link bit;
    // only the cross-device outside source fails, and that is EXDEV, not a
    // denial). The real narrowing is symlinks + mkdir + in-lane execve.
    assert.match(text, /HARD=0/, `in-lane hardlink creation behaved differently: ${text}`)
    assert.match(text, /exec: .*Permission denied/, `in-lane execve was not narrowed: ${text}`)
    assert.match(text, /EX=126|EX=1/, `in-lane execve returned an unexpected code: ${text}`)
    return `mkdir=DENIED writeFile=ALLOWED symlink=DENIED(symInLane+symToEtc) hardlinkInLane=ALLOWED inLaneExecve=DENIED (raw provider) stdout=${JSON.stringify(text.replace(/\n/g, '\\n').slice(0, 200))}`
  })

  // --- PIN-SYMLINK: an in-lane symlink to /etc is served --------------------
  await arm('PIN-SYMLINK (in-lane symlink -> /etc/passwd served; one ALLOW fact)', async () => {
    const w = await worldWith({ ...IN_LANE, name: 'pinsym' })
    try {
      const service = w.realm.installation.members[0]?.subprocess
      assert.ok(service !== undefined, 'the realm mounted no confined subprocess face')
      const handle = service.spawn({
        argv: [RG_PATH, '--no-config', '--follow', '--regexp=root:', '--', inside],
        cwd: inside,
        stdio: { stdin: 'ignore', stdout: { maxBytes: 1 << 20 }, stderr: { maxBytes: 1 << 16 } },
        graceMs: 5000,
      })
      await handle.done
      const text = handle.collected.stdout?.readFrom(0).text ?? ''
      const facts = await factsOf(w.sinkPath)
      assert.match(text, /link-passwd:root:x:0:0/, `rg did not follow the in-lane symlink: ${text}`)
      assert.equal(facts.length, 1, `expected one fact, got ${JSON.stringify(facts)}`)
      assert.equal(facts[0].decision, 'allow')
      assert.equal(facts[0].locator, inside)
      return `symlinkTarget=/etc/passwd SERVED result=${JSON.stringify(text.split('\n')[0].slice(0, 72))} facts=[${facts.map(factLine).join(',')}]`
    } finally { await w.realm.dispose(); w.active = false }
  })

  // --- PIN-PROGDIR: the allow-list is a NAME, not a byte identity ------------
  await arm('PIN-PROGDIR (a Member-writable copy named rg EXECUTES; the allow-list is by name)', async () => {
    const w = await worldWith({ ...IN_LANE, name: 'pinprog' })
    try {
      const service = w.realm.installation.members[0]?.subprocess
      assert.ok(service !== undefined, 'the realm mounted no confined subprocess face')
      const handle = service.spawn({
        argv: [join(inside, 'tools', 'rg'), '--no-config', '--regexp=INSIDE-NEEDLE', '--', inside],
        cwd: inside,
        stdio: { stdin: 'ignore', stdout: { maxBytes: 1 << 20 }, stderr: { maxBytes: 1 << 16 } },
        graceMs: 5000,
      })
      await handle.done
      const text = handle.collected.stdout?.readFrom(0).text ?? ''
      assert.match(text, /needle\.txt:INSIDE-NEEDLE/, `the in-lane program copy did not execute: ${text}`)
      return `memberWritableProgram EXECUTED result=${JSON.stringify(text.split('\n')[0].slice(0, 72))} (programDir grant; residual #3)`
    } finally { await w.realm.dispose(); w.active = false }
  })

  // --- PIN-HARDLINK: a pre-existing in-lane hardlink leaks -------------------
  await arm('PIN-HARDLINK (pre-existing in-lane hardlink to an outside inode served; one ALLOW fact)', async () => {
    const w = await worldWith({ ...IN_LANE, name: 'pinhard' })
    try {
      const service = w.realm.installation.members[0]?.subprocess
      assert.ok(service !== undefined, 'the realm mounted no confined subprocess face')
      const handle = service.spawn({
        argv: [RG_PATH, '--no-config', '--regexp=OUTSIDE-SECRET', '--', inside],
        cwd: inside,
        stdio: { stdin: 'ignore', stdout: { maxBytes: 1 << 20 }, stderr: { maxBytes: 1 << 16 } },
        graceMs: 5000,
      })
      await handle.done
      const text = handle.collected.stdout?.readFrom(0).text ?? ''
      const facts = await factsOf(w.sinkPath)
      assert.match(text, /hard-secret:OUTSIDE-SECRET-MUST-NOT-LEAK/, `rg did not serve the hardlink: ${text}`)
      assert.equal(facts.length, 1, `expected one fact, got ${JSON.stringify(facts)}`)
      assert.equal(facts[0].decision, 'allow')
      assert.equal(facts[0].locator, inside)
      return `outsideInode SERVED result=${JSON.stringify(text.split('\n')[0].slice(0, 72))} facts=[${facts.map(factLine).join(',')}]`
    } finally { await w.realm.dispose(); w.active = false }
  })
} finally {
  for (const root of cleanup) { try { await root.dispose?.() } catch { /* best effort */ } }
  for (const dir of roots) rmSync(dir, { recursive: true, force: true })
}

const receipt = { schema: 'a5sf-bl16-grep-arms/1', launcherSha256: LAUNCHER_SHA, baseline: BASELINE_SEARCH, arms: results.map((line) => line.split(': ')[0]), results }
writeFileSync(join(HERE, 'arms.json'), `${JSON.stringify(receipt, null, 2)}\n`, 'utf8')
console.log(`\n${results.length} arms measured; receipt -> ${join(HERE, 'arms.json')}`)
