// PoC ONLY — a5w-pvpoc Native Reuse First present PoC. NOT a production acceptance asset.
/**
 * In-process harness over the pinned pristine Host runtime libraries
 * (tests/deepseek-harness-test-use @ TEST_USE_BASELINE_SHA, built lib/ artifacts).
 * Zero Host boot, zero port: it constructs a real cordis Context with the REAL
 * ToolRuntime, the REAL agent-scoped `present` plugin
 * (packages/deliverables/tool-present), a real Session with the real
 * turnBoundary projection, and a local filesystem — the same wiring
 * upstream's own packages/deliverables/tool-present/tests/present.spec.ts uses,
 * minus vitest and the source plane.
 *
 * Every experiment in poc-native-present.test.mjs dispatches through
 * ctx.tools.execute(...) — the ToolRuntime pipeline — never by calling a saved
 * ToolDefinition.execute() directly.
 */
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { findTestRepoRoot, testUseTree, TEST_USE_BASELINE_SHA } from '../../paths.mjs'

const require_ = createRequire(import.meta.url)
const repoRoot = findTestRepoRoot(import.meta.dirname)
if (repoRoot === null) throw new Error('poc harness: no ancestor holds the test-use checkout')
const hostTree = testUseTree(repoRoot)

/** Baseline gate: the host tree must be the pinned pristine baseline. */
export const hostBaselineSha = TEST_USE_BASELINE_SHA
export const hostHeadSha = require_('child_process').execSync('git -C ' + JSON.stringify(hostTree) + ' rev-parse HEAD', { encoding: 'utf8' }).trim()
if (hostHeadSha !== hostBaselineSha) {
  throw new Error(`poc harness: host tree at ${hostHeadSha}, pinned ${hostBaselineSha} — refuse to run`)
}

/** Absolute-URL import of one host package's built runtime entry (artifact plane). */
function hostImport(rel) {
  return import(pathToFileURL(join(hostTree, rel)).href)
}

export const cordis = await hostImport('vendor/cordis/lib/index.js')
export const dshScope = await hostImport('packages/core/scope/lib/index.js')
export const dshTools = await hostImport('packages/core/tools/lib/index.js')
export const dshAgent = await hostImport('packages/core/agent/lib/index.js')
export const dshAgentLoop = await hostImport('packages/core/agent-loop/lib/index.js')
export const dshSession = await hostImport('packages/core/session/lib/index.js')
export const dshSessionProjection = await hostImport('packages/session/session-projection/lib/index.js')
export const dshSystemPrompt = await hostImport('packages/core/system-prompt/lib/index.js')
export const dshFsLocal = await hostImport('packages/fs/fs-local/lib/index.js')
export const dshLlm = await hostImport('packages/llm/llm/lib/index.js')
export const testkit = await hostImport('packages/test-support/agent-loop-testkit/lib/index.js')
export const presentPlugin = await hostImport('packages/deliverables/tool-present/lib/index.js')

const { Context, Service } = cordis
const { createScope } = dshScope
const { ToolCallId } = dshLlm
const { SESSION_FORMAT_VERSION, Session, SessionId } = dshSession
const { turnBoundaryProjectionDefinition } = dshAgentLoop
const AgentRegistry = dshAgent.default
const LocalFileSystem = dshFsLocal.default
const SessionProjectionRegistry = dshSessionProjection.default
const SystemPrompt = dshSystemPrompt.default
const ToolRuntime = dshTools.default

/**
 * Build one in-process world.
 * @param options.toolsConfig - ToolRuntime presentation mode config ({ mode }).
 * @param options.maxFiles - present plugin per-call limit.
 * @param options.approval - optional scripted approval stub outcomes;
 *   when provided, an `approval` service is registered so `ask` resolves
 *   through it instead of degrading to deny.
 */
export async function createWorld(options = {}) {
  const { toolsConfig = {}, maxFiles = 4, approval = null } = options
  const scratch = join(repoRoot, '.artifacts', 'tmp')
  await mkdir(scratch, { recursive: true })
  const root = await mkdtemp(join(scratch, 'dsh-pvpoc-')) // TEST_METHODS §8: workspace-local scratch, never a DSH_HOME world
  const ctx = new Context()
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime, toolsConfig)
  await ctx.plugin(AgentRegistry)
  await ctx.plugin(LocalFileSystem, { cwd: root })
  await ctx.plugin(SessionProjectionRegistry)
  ctx.sessionProjections.register(turnBoundaryProjectionDefinition)
  await ctx.plugin(presentPlugin, { maxFiles })
  const approvalCalls = []
  if (approval !== null) {
    // Service registration via direct construction is how optional services
    // land in the global store that ctx.get('approval') reads.
    new ApprovalStub(ctx, approval, approvalCalls)
  }
  const agents = []
  const disposers = [() => ctx.fiber.dispose(), () => rm(root, { recursive: true, force: true })]
  /**
   * Mint one agent with its own session and scope, open turn 1.
   * @param name - session id seed.
   * @param opts - { parent: ScopeKey } to nest under an ancestor (preset) scope.
   */
  async function makeAgent(name, opts = {}) {
    const id = SessionId(`pvpoc-${name}-${agents.length}`)
    let scope
    const session = Session.create(id, [], {
      version: SESSION_FORMAT_VERSION, id, createdAt: 0, cwd: root, isSeeded: false,
    })
    const value = {
      id,
      options: {},
      session,
      inbox: testkit.unsupportedInbox(),
      status: 'idle',
      get ctx() { return scope.ctx },
      send: () => {},
      followup: () => {},
      steer: () => ({ outcome: Promise.resolve({ status: 'rejected' }) }),
      inject: () => {},
      cancel() {},
      runMaintenance: task => task(new AbortController().signal),
      whenIdle: () => Promise.resolve(),
    }
    await ctx.plugin(Object.assign(inner => { scope = createScope(inner, value, opts.parent === undefined ? undefined : { parent: opts.parent }) }, { inject: ['tools'] }))
    await ctx.agents.register(value)
    session.append('turn/start', { turn: 1 })
    agents.push(value)
    return value
  }
  /**
   * Mint an ancestor (preset-shaped) scope key the given agents can be nested
   * under; registrations through its ctx land in that layer.
   */
  async function makePresetScope(key) {
    let scope
    await ctx.plugin(Object.assign(inner => { scope = createScope(inner, key) }, { inject: ['tools'] }))
    disposers.push(() => scope.dispose())
    return scope
  }
  let callNumber = 0
  /** Execute one call through the ToolRuntime pipeline (never a raw definition). */
  function executePresent(agent, files, extra = {}) {
    return ctx.tools.execute({
      signal: extra.signal ?? new AbortController().signal,
      callId: ToolCallId(`pvpoc-${++callNumber}`),
      name: 'present',
      arguments: { files },
      ...agent === undefined ? {} : { agent },
      ...extra.parent === undefined ? {} : { parent: extra.parent },
    })
  }
  async function dispose() {
    for (const off of disposers.reverse()) await off()
  }
  return { ctx, root, agents, makeAgent, makePresetScope, executePresent, dispose, approvalCalls, call: id => ToolCallId(String(id)) }
}

/** Scripted approval service so pre-execute `ask` routes through a PA/Control stub. */
class ApprovalStub extends Service {
  constructor(ctx, script, calls) {
    super(ctx, 'approval')
    this.script = script
    this.calls = calls
  }
  async request(request) {
    this.calls.push(request)
    const outcome = typeof this.script === 'function' ? this.script(request, this.calls.length - 1) : this.script
    return outcome
  }
}

/** present-relevant session events in append order. */
export function presentedEvents(session) {
  return session.snapshotEvents().filter(event => event.type === 'deliverables/presented')
}

/** sha256 over a stable string for definition fingerprints. */
export function fingerprint(text) {
  return createRequire(import.meta.url)('node:crypto') && require_('node:crypto').createHash('sha256').update(text).digest('hex')
}
