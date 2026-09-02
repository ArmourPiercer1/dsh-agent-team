/**
 * T12 lane A — the in-chain bridge for the REAL live-agent glue bundle.
 *
 * Why this exists: `packages/runtime/src/plugin/live/agent-bindings.mjs`
 * has module-scope `@deepseek-ai/*` imports that are unresolvable in the
 * plain-node runner process (the worktree node_modules carries no such
 * scope; the precedent p8s7r2-residency-resuming.test.ts documents exactly
 * this). The T12 lane A acceptance criteria require assertions at the
 * ACTUAL agents.create / consumption / drain boundaries, so this bridge
 * loads the real glue in-chain with test doubles for the DSH services.
 *
 * Self-provisioning: importing this module idempotently creates
 * `node_modules/@deepseek-ai/{dsh-agent,dsh-session,dsh-llm,dsh-mcp-client}`
 * junction links in the worktree, pointing at the prebuilt DSH test-use
 * workspace packages (references/deepseek-harness-test-use — the pristine
 * upstream test instance per docs/TEST_METHODS.md). `node_modules/` is
 * gitignored: this is local environment provisioning, NOT a repository
 * change. Transitive imports inside those packages resolve from the DSH
 * checkout's own pnpm layout; only the four top-level bare specifiers of
 * the glue need the worktree links.
 *
 * Reproduction on a fresh checkout (one-liner, run from the worktree root):
 *   node --input-type=module -e "await import('./packages/runtime/test/t12a-live-bridge.mjs')"
 *
 * The doubles mirror ONLY the service surface the glue consumes:
 *   agents               create({sessionId, meta, setup}) / resume({resumeSessionId, setup})
 *                        -> { agent, dispose() }; the setup callback runs
 *                        with the agent-scoped ctx before the handle
 *                        settles (the real DSH semantics the glue relies on)
 *   sessionPersistence   ensureMaterialized(session)
 *   domain               repositories.memberInstances.list / overrides.list
 *                        + the REAL durable-consumption resolvers from
 *                        packages/runtime/agent-setup (model + capability)
 *   subagents            (optional) the SubagentRuntime surface used by
 *                        drainDescendants (drainContinuableDescendants,
 *                        listDescendants)
 */
import { existsSync, lstatSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const TEST_DIR = dirname(fileURLToPath(import.meta.url))
/** The worktree root (test -> runtime -> packages -> root). */
export const WORKTREE_ROOT = resolve(TEST_DIR, '..', '..', '..')
/** The repository root (the worktree lives under <repo>/.worktrees/). */
const REPO_ROOT = resolve(WORKTREE_ROOT, '..', '..')
/** The pristine upstream DSH test-use checkout (docs/TEST_METHODS.md). */
const DSH_TEST_USE = resolve(REPO_ROOT, 'references', 'deepseek-harness-test-use')

/** The four top-level @deepseek-ai/* specifiers of the real glue. */
const GLUE_PACKAGE_LINKS = [
  ['dsh-agent', ['packages', 'core', 'agent']],
  ['dsh-session', ['packages', 'core', 'session']],
  ['dsh-llm', ['packages', 'llm', 'llm']],
  ['dsh-mcp-client', ['packages', 'mcp', 'mcp-client']],
]

function entryExists(p) {
  try {
    lstatSync(p)
    return true
  } catch {
    return false
  }
}

/**
 * Idempotently provision the four top-level @deepseek-ai/* specifiers as
 * junction links under the worktree node_modules (local env only —
 * gitignored).
 */
export function ensureGlueResolvable() {
  const scopeDir = join(WORKTREE_ROOT, 'node_modules', '@deepseek-ai')
  for (const [name, parts] of GLUE_PACKAGE_LINKS) {
    const linkPath = join(scopeDir, name)
    if (entryExists(linkPath)) continue
    const target = join(DSH_TEST_USE, ...parts)
    if (!existsSync(join(target, 'package.json'))) {
      throw new Error(`t12a-live-bridge: the DSH test-use package dir is missing: ${target}`)
    }
    mkdirSync(scopeDir, { recursive: true })
    symlinkSync(target, linkPath, 'junction')
  }
}

let glueModulePromise
/** Import the real glue module (provisions the links first; cached). The
 *  relative string specifier keeps the runner's `.js -> .ts` sibling hook
 *  applicable (a URL object would arrive pre-resolved and bypass it). */
export async function loadGlueModule() {
  ensureGlueResolvable()
  if (glueModulePromise === undefined) {
    glueModulePromise = import('../src/plugin/live/agent-bindings.mjs')
  }
  return glueModulePromise
}

/**
 * One agent-scoped ctx double: records every `on(event, listener)`
 * registration (with a working disposer), every plugin() fiber (a thenable
 * that resolves immediately, with a recording .dispose()), the tools
 * register/execute surface the glue uses, and — T12-M2 — the DSH
 * systemPrompt builtin double (agent-scoped sections that shadow
 * same-named globals; duplicate scoped names in one agent scope throw;
 * assemble() composes the prompt layer the assertions read).
 *
 * @param {Array<{name: string, order: number, text: string}>} [globalSections]
 *   the world's global prompt layer (one shared array per world).
 */
function makeAgentCtx(globalSections) {
  const listeners = []
  const registeredTools = []
  const toolExecutions = []
  const plugins = []
  const scopedSections = []
  const systemPrompt = {
    globals: globalSections,
    section(spec) {
      if (spec === null || typeof spec !== 'object' || typeof spec.name !== 'string' || spec.name === '') {
        throw new TypeError('systemPrompt.section: spec.name (non-empty string) is required')
      }
      if (typeof spec.order !== 'number' || !Number.isFinite(spec.order)) {
        throw new TypeError('systemPrompt.section: spec.order must be a finite number')
      }
      const existing = scopedSections.find((entry) => !entry.disposed && entry.name === spec.name)
      if (existing !== undefined) {
        throw new Error(`systemPrompt.section: duplicate scoped section name '${spec.name}' in one agent scope`)
      }
      const entry = {
        name: spec.name,
        order: spec.order,
        text: typeof spec.text === 'function' ? spec.text({}) : String(spec.text ?? ''),
        scope: 'scoped',
        disposed: false,
      }
      scopedSections.push(entry)
      return () => {
        entry.disposed = true
      }
    },
    assemble() {
      const activeScoped = scopedSections.filter((entry) => !entry.disposed)
      return globalSections
        .filter((section) => !activeScoped.some((entry) => entry.name === section.name))
        .map((section) => ({ ...section, scope: 'global' }))
        .concat(activeScoped.map((entry) => ({ ...entry, scope: 'scoped' })))
        .sort((a, b) => a.order - b.order || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    },
  }
  return {
    listeners,
    registeredTools,
    toolExecutions,
    plugins,
    systemPrompt,
    on(event, listener) {
      const entry = { event, listener, active: true }
      listeners.push(entry)
      return () => {
        entry.active = false
      }
    },
    plugin(pluginSpec, options) {
      const fiber = {
        pluginSpec,
        options,
        disposed: false,
        dispose() {
          this.disposed = true
        },
        then(onfulfilled) {
          return Promise.resolve(fiber).then(onfulfilled)
        },
        catch() {
          return Promise.resolve(fiber)
        },
      }
      plugins.push(fiber)
      return fiber
    },
    tools: {
      register(def) {
        registeredTools.push(def)
        return () => {
          const i = registeredTools.indexOf(def)
          if (i !== -1) registeredTools.splice(i, 1)
        }
      },
      execute(call) {
        toolExecutions.push(call)
        return Promise.resolve({ ok: true, callId: call.callId })
      },
    },
  }
}

/**
 * The agents service double (the DSH agents create/resume seam). Records
 * every create/resume request (sessionId + meta + setup presence) and
 * every dispose/followup/cancel. `create`/`resume` run the provided setup
 * callback with the agent-scoped ctx and settle only after it completes —
 * the real DSH handle semantics the glue relies on.
 *
 * @param {object} [options]
 * @param {(agent: object) => Promise<void>} [options.whenIdleBehavior]
 *   the per-agent whenIdle() behavior (default: resolves immediately).
 * @param {Array<{name: string, order: number, text: string}>} [options.systemPromptGlobals]
 *   the world's global prompt layer for every agent ctx (T12-M2; default:
 *   the DSH service pair harness:identity + a global deployment:persona).
 */
export function createAgentsDouble(options = {}) {
  const creates = []
  const resumes = []
  const disposals = []
  const followups = []
  const cancels = []
  const handles = new Map()
  const whenIdleBehavior = options.whenIdleBehavior ?? (() => Promise.resolve())
  // T12-M2: one shared global prompt layer per world (the DSH service
  // registers harness:identity + a global deployment:persona section at
  // construction; the persona glue's scoped installs shadow that global).
  const globalSections = options.systemPromptGlobals ?? [
    { name: 'harness:identity', order: -1000, text: 'You are an AI agent powered by DeepSeek Harness.' },
    { name: 'deployment:persona', order: 0, text: '' },
  ]

  async function makeHandle(sessionId, { setup }) {
    const ctx = makeAgentCtx(globalSections)
    const agent = {
      session: { id: sessionId },
      ctx,
      followup(message) {
        followups.push({ sessionId, message })
      },
      whenIdle() {
        return whenIdleBehavior(agent)
      },
      cancel(args) {
        cancels.push({ sessionId, args })
      },
    }
    const handle = {
      agent,
      dispose() {
        disposals.push(sessionId)
        handles.delete(sessionId)
        return Promise.resolve()
      },
    }
    handles.set(sessionId, handle)
    if (setup !== undefined) await setup(ctx)
    return handle
  }

  return {
    creates,
    resumes,
    disposals,
    followups,
    cancels,
    handles,
    globalSections,
    async create(req) {
      const sessionId = String(req.sessionId)
      creates.push({ sessionId, meta: req.meta, setupProvided: req.setup !== undefined })
      return makeHandle(sessionId, req)
    },
    async resume(req) {
      const sessionId = String(req.resumeSessionId)
      resumes.push({ sessionId, setupProvided: req.setup !== undefined })
      return makeHandle(sessionId, req)
    },
  }
}

/** The sessionPersistence service double (records every materialization). */
export function createSessionPersistenceDouble() {
  const materialized = []
  return {
    materialized,
    ensureMaterialized(session) {
      materialized.push(String(session.id))
      return Promise.resolve()
    },
  }
}

/**
 * The opened-TeamDomain double: the repository lists the glue reads
 * (memberInstances + overrides + teamSessions, T12-M2) plus the REAL
 * durable-consumption resolvers (the glue's consumption boundary stays the
 * production code path).
 *
 * @param {object} [params]
 * @param {object[]} [params.members] memberInstance rows (childSessionId/instanceId)
 * @param {object[]} [params.overrides] governance override records
 * @param {object} [params.teamSession] the durable TeamSession row (T12-M2:
 *   always exposed as repositories.teamSessions — the persona step record
 *   for the root)
 */
export async function createDomainDouble({ members = [], overrides = [], teamSession = undefined } = {}) {
  const [modelModule, capabilityModule] = await Promise.all([
    import('../agent-setup/model/index.js'),
    import('../agent-setup/capability/index.js'),
  ])
  return {
    repositories: {
      memberInstances: { list: () => members },
      overrides: { list: () => overrides },
      teamSessions: { get: () => teamSession, list: () => (teamSession === undefined ? [] : [teamSession]) },
    },
    consumption: {
      model: { resolveDurableModelSelection: modelModule.resolveDurableModelSelection },
      capability: { resolveDurableMcpFacet: capabilityModule.resolveDurableMcpFacet },
    },
  }
}

/**
 * The subagents service double (the SubagentRuntime surface drainDescendants
 * consumes): records every drain/list call; configurable rejection of the
 * drain (the real service rejects with an aggregate after all branches
 * settle when any failed) and a configurable descendant tree.
 *
 * @param {object} [options]
 * @param {'reject'} [options.drainBehavior] reject the drain call
 * @param {string} [options.drainErrorMessage]
 * @param {object[]} [options.descendants] listDescendants result entries
 */
export function createSubagentsDouble(options = {}) {
  const drainCalls = []
  const listCalls = []
  const descendants = options.descendants ?? []
  return {
    drainCalls,
    listCalls,
    drainContinuableDescendants(parents) {
      drainCalls.push(parents)
      if (options.drainBehavior === 'reject') {
        return Promise.reject(new Error(options.drainErrorMessage ?? 'subagent drain failed (aggregate)'))
      }
      return Promise.resolve()
    },
    listDescendants(rootSessionId) {
      listCalls.push(rootSessionId)
      return Promise.resolve(descendants)
    },
  }
}

/**
 * Invoke the REAL `system-prompt/assemble` waterfall listener the glue's
 * agentSetup registered through installModelSelection (the public DSH
 * seam), with next() returning the minimal assembled payload. The result
 * IS the actual agent boundary: when a selection is installed the returned
 * variables carry its provider/model; when none may be selected the
 * assembled payload passes through untouched (no provider/model).
 *
 * @param {object} agentCtx - the agent-scoped ctx of a settled handle.
 * @returns {Promise<object|undefined>} the assembled payload (undefined
 *   when no model-selection listener is installed).
 */
export async function observeAssembly(agentCtx) {
  const entry = agentCtx.listeners.find((l) => l.event === 'system-prompt/assemble' && l.active)
  if (entry === undefined) return undefined
  return entry.listener(null, null, async () => ({ variables: {} }))
}

/**
 * The full live-binding test world: the real glue over the doubles.
 *
 * @param {object} [options]
 * @param {string} [options.rootSessionId]
 * @param {object[]} [options.members] domain memberInstance rows
 * @param {object[]} [options.overrides] domain governance override records
 * @param {object} [options.teamSession] the durable TeamSession row (T12-M2)
 * @param {Array<{name: string, order: number, text: string}>} [options.systemPromptGlobals]
 *   the world's global prompt layer (T12-M2; default: harness:identity +
 *   a global deployment:persona with empty text)
 * @param {object} [options.configOverrides] extra TeamPluginConfig fields
 *   (bootPhase, seedMembers, mcpServer, externalPolicyFacts, ...)
 * @param {object} [options.teamTools] the tool stack (teamToolsRef.current)
 * @param {object} [options.agents] extra agents-double options (whenIdleBehavior)
 * @param {object} [options.subagents] the subagents service double (absent = the
 *   production host seam not wired: drain is typed fail-closed)
 * @returns {Promise<object>} the world (binding + records + doubles).
 */
export async function createLiveWorld(options = {}) {
  const glue = await loadGlueModule()
  const rootSessionId = options.rootSessionId ?? 'session-t12a-root'
  const agents = createAgentsDouble({
    ...(options.agents ?? {}),
    systemPromptGlobals: options.systemPromptGlobals,
  })
  const sessionPersistence = createSessionPersistenceDouble()
  const domain = await createDomainDouble({
    members: options.members ?? [],
    overrides: options.overrides ?? [],
    teamSession:
      options.teamSession ??
      { rootSessionId, sessionId: rootSessionId, blueprintId: 'team.t12a', generation: 1 },
  })
  const config = {
    bootPhase: 'create',
    rootSessionId,
    // T12-M2: a VALID closed-v1 blueprint document (the persona glue parses
    // it lazily — the previous malformed 'team: {}' default broke the
    // parse). The default carries distinct leader/member personas so the
    // persona assertions have stable text to expect.
    blueprintSource: [
      '---',
      'schemaVersion: 1',
      'blueprintId: team.t12a',
      'revision: "1"',
      'leader:',
      '  templateId: leader',
      '  persona: "You are the leader of the t12a test team."',
      'members:',
      '  - templateId: tpl-t12a',
      '    persona: "You are member tpl-t12a of the t12a test team."',
      '  - templateId: t12a-worker',
      '    persona: "You are member t12a-worker of the t12a test team."',
      'requirements: []',
      'memberEnvelopes: []',
      'policyStates: []',
      'metadata: {}',
      '---',
      '',
    ].join('\n'),
    generation: 1,
    defaultWorkspace: join(WORKTREE_ROOT, 'default-workspace'),
    seedMembers: [],
    staticModel: { provider: 't12a-baseline', model: 't12a-baseline-model' },
    deniedSelection: { provider: 't12a-denied', model: 't12a-denied-model' },
    mcpServer: { name: 't12a-mini-mcp', port: 3999 },
    environmentFacts: [],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl: new URL('../src/plugin/live/agent-bindings.mjs', import.meta.url).href,
    ...options.configOverrides,
  }
  const teamToolsRef = { current: options.teamTools !== undefined ? options.teamTools : undefined }
  const now = () => '2026-08-31T00:00:00.000Z'
  const binding = glue.createAgentBindings({
    agents,
    sessionPersistence,
    domain,
    config,
    teamToolsRef,
    now,
    ...(options.subagents !== undefined ? { subagents: options.subagents } : {}),
  })
  return {
    rootSessionId,
    config,
    binding,
    agents,
    sessionPersistence,
    domain,
    teamToolsRef,
    subagents: options.subagents,
    records: {
      creates: agents.creates,
      resumes: agents.resumes,
      disposals: agents.disposals,
      followups: agents.followups,
      cancels: agents.cancels,
      materialized: sessionPersistence.materialized,
    },
  }
}

/**
 * Run `fn` with DSH_HOME pointed at `home` (restore the previous value —
 * including absent — afterwards, AFTER `fn` settles, so an async `fn` sees
 * the home for its whole lifetime). The glue's sessionIsDurable reads
 * process.env.DSH_HOME; tests that need durable fixtures on disk set it,
 * snapshot the recorded state, and let this restore it BEFORE any later
 * file's setup runs.
 */
export async function withDshHome(home, fn) {
  const previous = process.env.DSH_HOME
  process.env.DSH_HOME = home
  try {
    return await fn()
  } finally {
    if (previous === undefined) delete process.env.DSH_HOME
    else process.env.DSH_HOME = previous
  }
}

/**
 * Write an empty durable-session fixture (`session.jsonl.zstd`) under
 * `<home>/sessions/<profile>/<sessionId>/` so the glue's sessionIsDurable
 * check sees the session as durable. The fixture must live INSIDE the
 * worktree (the workspace-write sandbox); remove it with
 * removeFixtureHome before the test file's setup completes (git status
 * must stay clean).
 *
 * @param {string} home the fake DSH_HOME root
 * @param {string} sessionId the session id the fixture stands for
 * @param {string} [profile] the profile dir name (any non-empty name)
 * @returns {string} the fixture home root (for cleanup).
 */
export function writeDurableFixture(home, sessionId, profile = 'test-profile') {
  const dir = join(home, 'sessions', profile, sessionId)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'session.jsonl.zstd'), '', 'utf8')
  return home
}

/** Remove a whole fixture home tree (idempotent). */
export function removeFixtureHome(home) {
  rmSync(home, { recursive: true, force: true })
}
