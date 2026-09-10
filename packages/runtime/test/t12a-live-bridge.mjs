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
 *                        settles (the real DSH semantics the glue relies on).
 *                        alpha.2 (A6): the agent ctx double ALSO carries a
 *                        fake upstream `fs` seam (ctx.fs.resolve — the
 *                        permission adapter's resolveTarget basis) and an
 *                        `agent` back-reference with `session.header.cwd`
 *                        (the lazy FACT 3b cwd read basis) — behavior-inert
 *                        for the alpha.1 worlds (they never read them).
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
 * alpha.2 (A6): the fake upstream `fs` seam for the permission adapter's
 * `resolveTarget` closure (`ctx.fs.resolve(path, { cwd })`). Deterministic
 * and PURE (no fs access): an absolute path (POSIX `/` or Windows `\`)
 * resolves as-is; a relative path joins onto the passed cwd (the FACT 3b
 * lazy-read basis the glue threads from `agent.session.header.cwd`).
 * `..` segments collapse deterministically (no fs). Every call is recorded
 * (`calls: [{ path, cwd? }]`) so a test can assert the exact cwd the glue
 * threaded at RESOLVE time. `targetKey` is a plain `file://`-prefixed
 * string standing in for the branded FsTargetKey (the glue unbrands with
 * String()).
 * @returns {{calls: Array<{path: string, cwd: string | undefined}>, resolve: (path: string, opts?: {cwd?: string}) => Promise<{targetKey: string, displayPath: string}>}}
 */
function makeFakeFs() {
  const calls = []
  function normalize(cwd) {
    return String(cwd).replace(/\\/g, '/').replace(/\/+$/, '')
  }
  function targetOf(path, cwd) {
    const p = String(path).replace(/\\/g, '/')
    let joined
    if (p.startsWith('/')) {
      joined = p
    } else if (typeof cwd === 'string' && cwd !== '') {
      joined = normalize(cwd) + '/' + p
    } else {
      joined = '/' + p
    }
    const out = []
    for (const s of joined.split('/')) {
      if (s === '' || s === '.') continue
      if (s === '..') out.pop()
      else out.push(s)
    }
    const key = '/' + out.join('/')
    return { targetKey: `file://${key}`, displayPath: key }
  }
  return {
    calls,
    async resolve(path, opts = {}) {
      calls.push({
        path: String(path),
        cwd: opts.cwd === undefined ? undefined : String(opts.cwd),
      })
      return targetOf(path, opts.cwd)
    },
  }
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
 * alpha.2 (A6): the double ALSO carries the fake upstream `fs` seam
 * (`ctx.fs.resolve`) — the permission adapter's `resolveTarget` closure
 * basis (absent from the alpha.1 worlds: they never read it, so the
 * addition is behavior-inert for them) and the `agent` back-reference
 * (set by createAgentsDouble's handle factory — the `ctx.agent` DX
 * accessor basis the glue's lazy `session.header.cwd` read uses).
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
  // alpha.1: the agent-scoped restriction seam (tools.restrict({ deny })) —
  // records every restriction call on THIS ctx (sibling-inert by
  // construction: each ctx double is one agent scope); the scoped deny
  // list is the union of all restrict calls (the public seam accumulates).
  const toolRestrictions = []
  // P0-3 (hardening §5): the unified operation-order log — records the
  // SEQUENCE of tools.register / tools.restrict calls on THIS ctx so a test
  // can verify the frozen setup ordering (builtin deny BEFORE the team tool
  // registrations). Each entry is { op, toolName? }.
  const opLog = []
  // alpha.1: the skill registration seam (agent.ctx.get('skills').register)
  // — records every scoped skill registration on THIS ctx with a working
  // disposer (the agent-scope unwind removes them, as with tools).
  const registeredSkills = []
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
  // alpha.2 (A6): the fake upstream fs seam (the permission adapter's
  // resolveTarget closure basis; see makeFakeFs).
  const fs = makeFakeFs()
  return {
    listeners,
    registeredTools,
    toolExecutions,
    plugins,
    systemPrompt,
    toolRestrictions,
    opLog,
    registeredSkills,
    fs,
    // alpha.2 (A6): the agent back-reference — the handle factory sets it
    // to the live agent (the `ctx.agent` DX accessor basis; undefined
    // between construction and the handle wiring, as on a real context
    // outside an initiator boundary).
    agent: undefined,
    on(event, listener) {
      const entry = { event, listener, active: true }
      listeners.push(entry)
      return () => {
        entry.active = false
      }
    },
    get(key) {
      if (key === 'skills') {
        return {
          // The SkillRegistrationDisposer contract (T3 skill-adapter) is an
          // OBJECT with a dispose() method — the adapter calls `d.dispose()`,
          // so returning a bare function would throw (swallowed) and the
          // registration would never be unwound.
          register(def) {
            const entry = { def, disposed: false }
            registeredSkills.push(entry)
            return {
              dispose() {
                entry.disposed = true
              },
            }
          },
        }
      }
      return undefined
    },
    plugin(pluginSpec, options) {
      const fiber = {
        pluginSpec,
        options,
        disposed: false,
        dispose() {
          this.disposed = true
        },
        // `await fiber` (the glue's MCP-activation await) must settle exactly
        // once. The settled value is a NON-thenable (`undefined`): resolving
        // the adoption promise with `fiber` itself would re-enter this `then`
        // forever (fiber IS a thenable — `Promise.resolve(fiber)` / the
        // adoption's `resolve(fiber)` re-adopts it). The glue uses the `fiber`
        // variable (not the resolved value) for `state.mcpFiber`, so settling
        // to `undefined` is behavior-preserving.
        then(onfulfilled) {
          return Promise.resolve().then(() => (onfulfilled ? onfulfilled(undefined) : undefined))
        },
        catch(onrejected) {
          return Promise.resolve().then(() => (onrejected ? onrejected(undefined) : undefined))
        },
      }
      plugins.push(fiber)
      return fiber
    },
    tools: {
      register(def) {
        registeredTools.push(def)
        opLog.push({ op: 'register', toolName: String(def?.name ?? '') })
        return () => {
          const i = registeredTools.indexOf(def)
          if (i !== -1) registeredTools.splice(i, 1)
        }
      },
      execute(call) {
        toolExecutions.push(call)
        return Promise.resolve({ ok: true, callId: call.callId })
      },
      // alpha.1: the public Agent-scoped restriction seam (tools.restrict).
      // Records the deny list on THIS ctx only (sibling-inert); the scoped
      // effective deny is the union of every call (the seam accumulates).
      // P0-2 (hardening §4): the real seam returns the exact disposer that
      // lifts this restriction; the double returns a no-op disposer (the
      // toolRestrictions union is the effective deny; the double does not
      // model the lift) so the adapter's captured-disposer close path works.
      restrict(opts) {
        toolRestrictions.push(opts)
        opLog.push({ op: 'restrict', toolName: (opts?.deny ?? []).join(',') })
        return () => {}
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

  async function makeHandle(sessionId, { setup, meta }) {
    const ctx = makeAgentCtx(globalSections)
    // alpha.2 (A6): the session header double (the lazy `cwd` read basis of
    // the permission adapter's resolveTarget closure, FACT 3b). CREATE
    // carries the meta.cwd the glue requested (the production session
    // header materializes from exactly that meta); RESUME has no meta —
    // the durable-header analogue is a deterministic per-session fixture
    // workspace (a test may still mutate `header.cwd` to pin the lazy
    // read). Mutable on purpose (the bridge is a plain JS double; the
    // lazy-read test rewrites it between resolve calls).
    const createCwd = meta !== undefined && meta !== null && typeof meta.cwd === 'string' && meta.cwd !== ''
      ? meta.cwd
      : join(WORKTREE_ROOT, 'fixture-ws', sessionId)
    const agent = {
      session: { id: sessionId, header: { cwd: createCwd } },
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
    ctx.agent = agent
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
 * @param {object[]} [params.members] memberInstance rows of the DEFAULT
 *   root (childSessionId/instanceId)
 * @param {Object<string, object[]>} [params.membersByRoot] TCM-D4: per-root
 *   memberInstance rows for NON-default roots (a key present with an empty
 *   array says "this root has no members"; an absent key falls back to
 *   `members`, preserving the pre-TCM-D4 behavior)
 * @param {object[]} [params.overrides] governance override records of the
 *   DEFAULT root
 * @param {Object<string, object[]>} [params.overridesByRoot] TCM-D4: per-root
 *   governance override rows for NON-default roots (same fallback semantics
 *   as membersByRoot)
 * @param {object} [params.teamSession] the durable TeamSession row of the
 *   DEFAULT root (T12-M2: exposed as repositories.teamSessions — the
 *   persona step record for the root)
 * @param {object[]} [params.teamSessions] TCM-D4: the durable TeamSession
 *   rows of EVERY team root of the world (a multi-root domain — a freshly
 *   created team is a team root of the same row; `teamSession` is appended
 *   as the default root's row when both are given). `get(id)` resolves by
 *   the row's rootSessionId (the pre-TCM-D4 double returned the default
 *   row for EVERY id — a single-root world cannot observe the difference).
 */
export async function createDomainDouble({
  members = [],
  membersByRoot = {},
  overrides = [],
  overridesByRoot = {},
  teamSession = undefined,
  teamSessions = [],
} = {}) {
  const [modelModule, capabilityModule] = await Promise.all([
    import('../agent-setup/model/index.js'),
    import('../agent-setup/capability/index.js'),
  ])
  const rows = teamSession === undefined ? [...teamSessions] : [...teamSessions, teamSession]
  const findRow = (id) => rows.find((row) => String(row.rootSessionId) === String(id))
  const pickByRoot = (byRoot, root, fallback) =>
    Object.prototype.hasOwnProperty.call(byRoot, String(root)) ? byRoot[String(root)] : fallback
  return {
    repositories: {
      memberInstances: { list: (root) => pickByRoot(membersByRoot, root, members) },
      overrides: { list: (root) => pickByRoot(overridesByRoot, root, overrides) },
      teamSessions: { get: (id) => findRow(id), list: () => rows },
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
 * The agentPresets service double (the DSH AgentPresets public service —
 * the ordinary-preset base-tool substrate for member agents, D1 v2):
 * records every `mount(agentCtx, presetId)` call (`presetId` undefined =
 * the deployment default the service resolves itself); a configurable
 * rejection (the real service rejects on an unknown preset id).
 *
 * @param {object} [options]
 * @param {'reject'} [options.mountBehavior] reject the mount call
 * @param {string} [options.mountErrorMessage]
 */
export function createAgentPresetsDouble(options = {}) {
  const mounts = []
  return {
    mounts,
    mount(agentCtx, presetId) {
      mounts.push({ agentCtx, presetId })
      if (options.mountBehavior === 'reject') {
        return Promise.reject(new Error(options.mountErrorMessage ?? 'agent presets mount failed'))
      }
      return Promise.resolve({ presetId: presetId ?? 'default' })
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
 * @param {object[]} [options.members] domain memberInstance rows of the
 *   world's default (boot) root
 * @param {Object<string, object[]>} [options.membersByRoot] TCM-D4: per-root
 *   member rows for non-boot roots (see createDomainDouble)
 * @param {object[]} [options.overrides] domain governance override records
 *   of the world's default (boot) root
 * @param {Object<string, object[]>} [options.overridesByRoot] TCM-D4: per-root
 *   override rows for non-boot roots (see createDomainDouble)
 * @param {object} [options.teamSession] the durable TeamSession row of the
 *   world's default (boot) root (T12-M2)
 * @param {object[]} [options.teamSessions] TCM-D4: the durable TeamSession
 *   rows of every team root of the world (multi-root domain)
 * @param {Array<{name: string, order: number, text: string}>} [options.systemPromptGlobals]
 *   the world's global prompt layer (T12-M2; default: harness:identity +
 *   a global deployment:persona with empty text)
 * @param {object} [options.configOverrides] extra TeamPluginConfig fields
 *   (bootPhase, seedMembers, mcpServer, externalPolicyFacts, ...)
 * @param {object} [options.teamTools] the tool stack (teamToolsRef.current)
 * @param {object} [options.agents] extra agents-double options (whenIdleBehavior)
 * @param {object} [options.subagents] the subagents service double (absent = the
 *   production host seam not wired: drain is typed fail-closed)
 * @param {object} [options.agentPresets] the agentPresets service double
 *   (D1 v2: the ordinary-preset base-tool substrate for member agents;
 *   absent = the production host seam not wired: a member setup fails
 *   closed with the typed member-base-tools-unavailable error)
 * @param {object} [options.controlServiceRef] the shared control-service
 *   reference (alpha.2 A6, the teamToolsRef pattern): the caller-owned
 *   `{ current }` object the glue reads LAZILY in agentSetup for
 *   `capabilities.permissions` templates. The world returns the SAME
 *   object (world.controlServiceRef) so a test can fill `.current` after
 *   construction and before boot to pin the lazy read. Absent = the glue
 *   dep is not passed (alpha.1/legacy worlds never read it; a
 *   permissions-carrying template then fails closed with the typed
 *   alpha2-permission-control-unavailable error).
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
    membersByRoot: options.membersByRoot ?? {},
    overrides: options.overrides ?? [],
    overridesByRoot: options.overridesByRoot ?? {},
    teamSessions: options.teamSessions,
    // The default root's row is synthesized only when the caller did not
    // supply the row list at all (a multi-root list is assumed to carry
    // the default root's own row — no duplicate at one key).
    teamSession:
      options.teamSession ??
      (options.teamSessions === undefined
        ? { rootSessionId, sessionId: rootSessionId, blueprintId: 'team.t12a', generation: 1 }
        : undefined),
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
  // alpha.2 (A6): the shared control-service reference (the teamToolsRef
  // pattern — the caller owns the object; the world returns the SAME
  // object so a test can fill `.current` after construction and before
  // boot to pin the glue's LAZY read). Absent = the glue dep is not
  // passed at all (the legacy/alpha.1 worlds never read it).
  const controlServiceRef =
    options.controlServiceRef !== undefined ? options.controlServiceRef : undefined
  const now = () => '2026-08-31T00:00:00.000Z'
  const binding = glue.createAgentBindings({
    agents,
    sessionPersistence,
    domain,
    config,
    teamToolsRef,
    controlServiceRef,
    now,
    ...(options.subagents !== undefined ? { subagents: options.subagents } : {}),
    ...(options.agentPresets !== undefined ? { agentPresets: options.agentPresets } : {}),
    // alpha.2 (A6, V1-1): the per-agent fs seam accessor — routes to each
    // agent ctx double's OWN fake fs (makeAgentCtx attaches makeFakeFs()),
    // so per-agent call-record assertions keep working (a6a's
    // memberCtx.fs.calls / leaderCtx.fs.calls). options.fsBackend overrides
    // it (the resolve-time fail-closed leg); options.fsBackend = null OMITS
    // the dep entirely (the install-time fail-closed leg).
    ...(options.fsBackend === null
      ? {}
      : { fsBackend: options.fsBackend ?? ((agentCtx) => agentCtx.fs) }),
  })
  return {
    rootSessionId,
    config,
    binding,
    agents,
    sessionPersistence,
    domain,
    teamToolsRef,
    controlServiceRef,
    subagents: options.subagents,
    agentPresets: options.agentPresets,
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
