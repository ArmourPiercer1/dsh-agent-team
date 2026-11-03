#!/usr/bin/env node
/**
 * red-arm.mjs — the RED arm for the TOOL axis (Alpha.5 P2, dated 2026-11-03).
 *
 * WHAT IT ASSERTS (the DESIRED behaviour, not today's):
 *   A Member's `read` is allowed by the Member CEILING on `ceiling-only.txt`
 *   but the `dsh.fs/read` TOOL RESTRICTION is strictly narrower (the `inside`
 *   subtree). Dispatched through the REAL native `@deepseek-ai/dsh-tool-fs`
 *   re-mounted by the PRODUCT attach (`attachA5sfNativeToolModules`), the call
 *   MUST be refused with `IO_READ_DENIED`.
 *
 * WHY IT FAILS TODAY: the attach mounts the native package into
 * `installation.members[0].ctx` — the MEMBER ceiling realm. The mounted
 * per-ToolBinding realm (`realm.bindings[0]`) is never addressed by the
 * execution path, so the restriction is decorative at runtime.
 *
 * EXIT: 0 = the seam landed (the assert passed); 1 = RED (today's tree).
 * This is a one-shot evidence probe, NOT a committed test: a red assertion may
 * not sit in the CI graph. The committed regression sentinel is
 * `tests/world-factory/a5sf-tool-axis.test.mjs` arm TA2, which encodes TODAY's
 * behaviour and must be inverted when the seam lands.
 *
 * NO Host boot, no ports, no DSH_HOME, no writes to the pinned baseline.
 */
import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { createRequire, register } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const REPO_ROOT = resolveRepoRoot()
function resolveRepoRoot() {
  const here = dirname(fileURLToPath(import.meta.url))
  return join(here, '..', '..', '..', '..')
}

register(pathToFileURL(join(REPO_ROOT, 'scripts', 'run-tests-hooks.mjs')).href)

const row = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'a5sf-realm-row.mjs')).href)
const transports = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'team-services', 'src', 'guard-observability.ts')).href)
const policy = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'member-io-policy', 'src', 'index.ts')).href)
const runtimeRequire = createRequire(join(REPO_ROOT, 'packages', 'runtime', 'package.json'))
const { Context, Service } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/cordis')).href)
const ToolRuntime = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-tools')).href)).default
const SystemPrompt = (await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-system-prompt')).href)).default
const { bindScopeParent, createScope } = await import(pathToFileURL(runtimeRequire.resolve('@deepseek-ai/dsh-scope')).href)

const BASELINE_TOOL_FS = join(REPO_ROOT, 'tests', 'deepseek-harness-test-use', 'packages', 'fs', 'tool-fs', 'lib', 'index.js')
assert.equal(existsSync(BASELINE_TOOL_FS), true, `pinned baseline tool-fs missing at ${BASELINE_TOOL_FS}`)
const nativeToolModules = await import(pathToFileURL(BASELINE_TOOL_FS).href)

const IDENTITY = { teamId: 'team-red-arm', memberInstanceId: 'member-red-arm-a', templateId: 'worker', instanceGeneration: 1 }
const READ_BINDING = 'dsh.fs/read'
const lane = (allow) => ({ mode: 'restricted', allow: [...allow], ask: [], deny: [] })
const ceiling = {
  memberIdentity: IDENTITY.memberInstanceId,
  templateId: IDENTITY.templateId,
  instanceGeneration: IDENTITY.instanceGeneration,
  revision: 'a5sf1:member-red-arm-a:g1',
  read: lane([]),
  write: lane([]),
  network: { access: 'allow' },
}
const restriction = {
  bindingIdentity: READ_BINDING,
  read: lane([]),
  write: { mode: 'all', allow: [], ask: [], deny: [] },
  network: 'allow',
}

const dir = mkdtempSync(join(tmpdir(), 'a5sf-red-arm-'))
const inside = join(dir, 'inside')
mkdirSync(inside, { recursive: true })
writeFileSync(join(inside, 'ok.txt'), 'INSIDE\n')
writeFileSync(join(dir, 'ceiling-only.txt'), 'CEILING_ONLY\n')
const sinkPath = join(dir, 'consult.jsonl')

class TestFileSystem extends Service {
  constructor(ctx, config = {}) { super(ctx, 'fs'); this.config = config }
  processPath(t) { return t.hostPath }
  contains(p, c) { return this.processPath(c).startsWith(this.processPath(p)) }
  async resolve(p) { return { hostPath: p, displayPath: p } }
  async readText(t) { return readFileSync(this.processPath(t), 'utf8') }
  async streamText(t) { const text = await this.readText(t); return (async function* () { yield text })() }
  async readBytes(t) { return readFileSync(this.processPath(t)) }
  async readByteRange(t, r) { return (await this.readBytes(t)).subarray(r.offset, r.offset + r.length) }
  async listDir() { return [] }
  async stat() { return { type: 'file', size: 3, mtimeMs: 0, mode: 0o644 } }
  async lstat() { return { type: 'file', size: 3, mtimeMs: 0, mode: 0o644 } }
  async watch() { return async () => {} }
  async writeText() { return { version: 'v1' } }
  async editText() { return { version: 'v2' } }
}

const root = new Context()
await root.plugin(SystemPrompt)
await root.plugin(ToolRuntime)
await root.plugin(TestFileSystem, {})

ceiling.read = lane([dir])
restriction.read = lane([inside])
const compiled = policy.compileEffectiveIo(ceiling, restriction, {
  memberIdentity: IDENTITY.memberInstanceId,
  callId: 'red-arm-1',
  policyRevision: ceiling.revision,
  toolBindingIdentity: READ_BINDING,
  approvedOnce: false,
})
assert.equal(compiled.ok, true, `compileEffectiveIo refused the pair: ${JSON.stringify(compiled)}`)

const standingKey = {}
const standing = createScope(root, standingKey)
await standing.ctx.plugin(nativeToolModules)
const agentKey = { session: { header: {} } }
const agent = createScope(root, agentKey)
bindScopeParent(agentKey, standingKey)
const sink = transports.createGuardConsultFileSink({ path: sinkPath })

const realm = await row.mountMemberA5sfRealm({
  root: agent.ctx,
  a5sfConfig: row.a5sfRealmConfigOf({ a5sfEvidencePath: sinkPath }),
  provider: () => ({
    compiledFor: () => ({
      members: [{ identity: IDENTITY, policy: { ok: true, value: ceiling } }],
      bindings: [{ identity: IDENTITY, toolBindingIdentity: READ_BINDING, effective: compiled.value }],
      providerClass: TestFileSystem,
    }),
  }),
  member: { sessionId: 'session-red-arm', instanceId: IDENTITY.memberInstanceId, teamRootSessionId: 'team-root-red-arm', templateId: IDENTITY.templateId },
})

await row.attachA5sfNativeToolModules(realm, agent.ctx, row.a5sfRealmConfigOf({
  a5sfEvidencePath: sinkPath,
  a5sfNativeToolModules: [BASELINE_TOOL_FS],
}), agentKey)

const settled = await root.get('tools').execute({
  signal: new AbortController().signal,
  callId: 'red-arm-call-1',
  agent: agentKey,
  name: 'read',
  arguments: { file_path: join(dir, 'ceiling-only.txt') },
})
const text = Array.isArray(settled.content) ? settled.content.map((p) => (p?.type === 'text' ? p.text : '')).join('') : ''

console.log(`ceiling allows: ${dir}`)
console.log(`read binding allows: ${inside}`)
console.log(`locator: ${join(dir, 'ceiling-only.txt')}`)
console.log(`dispatch isError=${settled.isError} text=${JSON.stringify(text.slice(0, 160))}`)
console.log(`facts: ${existsSync(sinkPath) ? readFileSync(sinkPath, 'utf8').trim().split('\n').join(' | ') : '(none)'}`)

try {
  assert.equal(settled.isError, true, 'DESIRED: a ceiling-allowed, restriction-denied read must be REFUSED')
  assert.ok(!text.includes('CEILING_ONLY'), 'DESIRED: zero bytes of the restriction-denied file are disclosed')
  console.log('RED-ARM: PASS — the tool axis is consumed by the execution path')
  await realm.dispose()
  rmSync(dir, { recursive: true, force: true })
  process.exit(0)
} catch (error) {
  console.error(`RED-ARM: FAIL — ${error instanceof Error ? error.message : String(error)}`)
  await realm.dispose()
  rmSync(dir, { recursive: true, force: true })
  process.exit(1)
}
