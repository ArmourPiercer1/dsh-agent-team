/**
 * P8-S5A — the live-agent binding substrate for the production
 * `dsh-agent-team` plugin.
 *
 * Verbatim port (zero behavior change) of the live-agent glue out of the
 * P6-T6 harness row (packages/tools/harness/plugin.mjs): the idempotent
 * child-session factory, the invariant-46 session-durability barrier, the
 * per-session durable-consumption state (row-owned ModelSelectionRef +
 * mini-MCP fiber + §18.3 applied-record set), the session-input and
 * work-delivery ports, the lifecycle ports (interrupt / drain / residency),
 * the caller map, and the row-owned tool execution budget.
 *
 * Plain JS ESM: node: builtins + prebuilt @deepseek-ai/* packages only (no
 * TypeScript, no loader hooks — the production host row runs as built
 * host.js under plain Node). The built production host dynamically imports
 * this module at apply() and passes the deps below; every mutable piece of
 * state (live agent handles, disposers, call counter, consumption state,
 * observations) lives in the closure — one bindings object per row
 * instance, per boot. No module-level mutable state.
 *
 * deps (all required; `now` is a documented parity field):
 *   agents             - the DSH agents service (create/resume; AgentHandle seam)
 *   sessionPersistence - the DSH sessionPersistence service (ensureMaterialized)
 *   domain             - the OPENED TeamDomain: repositories (memberInstances,
 *                        overrides) plus consumption { model:
 *                        {resolveDurableModelSelection}, capability:
 *                        {resolveDurableMcpFacet} } (the pure governance
 *                        admission authority is NOT part of it — the harness
 *                        row imports it from the built runtime dist itself)
 *   config             - the row config (run.mjs teamRowConfig): rootSessionId,
 *                        blueprintSource (T12-M2: the Team Blueprint document —
 *                        the closed-v1 frontmatter source whose leader/member
 *                        persona fields the persona resolver composes onto the
 *                        real DSH Agent prompt; the glue parses it lazily),
 *                        mcpServer {name, port} | null (null = no MCP server
 *                        configured — T12-H1), staticModel, deniedSelection,
 *                        externalPolicyFacts {hard, capabilityExists} (T12-B3:
 *                        the injected external hard facts; normalized —
 *                        never re-interpreted — into the resolvers),
 *                        presetSubstrate (T12-M2, OPTIONAL: {presetId,
 *                        personaKind} — the AgentPreset substrate fact the
 *                        persona resolver evaluates; absent = the S5A A11
 *                        decision {presetId: 'dsh-agent-team', personaKind:
 *                        'standard'})
 *   teamToolsRef       - the plain { current: <teamTools | undefined> } object
 *                        the production host fills AFTER root assembly; the
 *                        setup callback reads teamToolsRef.current when it
 *                        runs — never before (absent -> the registration
 *                        loop is skipped, as before)
 *   now                - parity field (the row's clock); unused by the ported
 *                        glue paths, which derive time from the services
 *   subagents (OPTIONAL) - the DSH subagents service (SubagentRuntime):
 *                        { drainContinuableDescendants, listDescendants }.
 *                        T12-M3: the recursive drain needs it; ABSENT -> the
 *                        drain fails closed with the typed
 *                        recursive-drain-unavailable error (the
 *                        archive/dispose procedure refuses). NOTE: host.ts
 *                        does not pass it yet — the integrator must add
 *                        `subagents: ctx.get('subagents')` to the glue deps
 *                        (additive; the glue reads deps.subagents
 *                        defensively).
 *
 * Returned bindings (the harness observability surface first — the
 * production host exposes this WHOLE bundle as the teamRoot.live field):
 *   listLiveSessions()                  (sorted live session id strings)
 *   hasLive(sessionId)                  (boolean)
 *   isResuming(sessionId)               (boolean; the resuming marker, P8-S7 R2-5)
 *   ensureLiveAgent(sessionId)          (the live-agent-or-resume resolver)
 *   prepareAgentForRequest(sessionId)   (the request-boundary reconciliation)
 *   executeTool(sessionId, {name, args, callId})
 *   getConsumptionState(sessionId)      (the per-session state or undefined)
 *   resolveConsumptionViews(sessionId)  (the PURE consumption-view derivation)
 *   observations                        (string[]; noteworthy async observations)
 *   governanceAuthority(asSessionId)    (operator | member | undefined)
 *   dropResidency(sessionId)            (-> {dropped, disposeError?})
 *   close()                             (idempotent dispose of every owned side effect)
 * Provider-facing ports (verbatim port):
 *   childFactory.createChildSession(request) -> {childSessionId}
 *   sessionDurability.ensureDurable(childSessionId)
 *   surface                      (TeamAgentSetupSurface; no-op per SD-SURFACE)
 *   sessionInput.submitAttributedInput(input)
 *   workDelivery.deliver(args)
 *   interrupt(target)            (agent.cancel({kind:'user'}))
 *   drainDescendants(childSessionId) -> {drained, quiescent}
 *                                 (T12-M3: the REAL recursive drain — whenIdle
 *                                  + subagents.drainContinuableDescendants +
 *                                  the honest listDescendants count; a drain
 *                                  failure reports {drained, quiescent:false};
 *                                  a drain that cannot establish quiescence
 *                                  rejects with code
 *                                  'recursive-drain-unavailable')
 *   residency {has, hasResidency, dropResidency} (sync boolean port)
 *   resolveCaller(sessionId)     (root -> leader, else bound member)
 * Additive surface (the production root bootstrap):
 *   boot()                           (idempotent full live-agent boot: create
 *                                     or resume the root + every bound member
 *                                     child, materializing each; the
 *                                     production root calls it exactly once,
 *                                     AFTER the tool stack is in teamToolsRef
 *                                     — construction itself never creates or
 *                                     resumes any agent)
 *   agentSetup(sessionId, [hints]) (the AgentSetup callback: create OR resume)
 *   rootSessionId                (config.rootSessionId)
 *   childSessionIdFor(rootSessionId, instanceId)
 *                                 (T12-B2: the deterministic (root, instance)
 *                                  -> child session id derivation, exposed for
 *                                  provider/cold-reconciliation verification)
 *   personaSurface                 (T12-M2: the REAL scoped-prompt persona
 *                                 surface — installScopedPersona(sessionId,
 *                                 identity) registers the composed identity as
 *                                 the agent-scoped 'deployment:persona'
 *                                 system-prompt section on that session's
 *                                 live agent ctx (a pre-setup install is
 *                                 queued and flushed by the setup, still
 *                                 before any work); restoreScopedPersona(
 *                                 sessionId) disposes exactly that scoped
 *                                 entry — the global prompt layer is never
 *                                 touched; idempotent)
 */
import { createHash } from 'node:crypto'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { SessionId } from '@deepseek-ai/dsh-session'
import { installModelSelection } from '@deepseek-ai/dsh-agent'
import { ToolCallId, createUserMessage } from '@deepseek-ai/dsh-llm'
import * as mcpClient from '@deepseek-ai/dsh-mcp-client'
// T12-M2: READ-ONLY reuse of the persona resolver (agent-setup/persona) and
// the blueprint parser (the domain facade) — the composition that puts the
// blueprint persona onto the real DSH Agent at create/setup.
import { parseBlueprint } from '../../../../domain/blueprint/src/index.js'
import { createPersonaOverlaySlot } from '../../../agent-setup/persona/index.js'

/**
 * The leader instance id (packages/contracts LEADER_INSTANCE_ID). The
 * plain-JS substrate cannot import the TS contracts package (no loader in
 * the production host row), so the constant is mirrored here.
 */
const LEADER_INSTANCE_ID = 'inst-leader'

/** The per-tool-call execution budget (activation involves real agent work). */
const TOOL_EXEC_TIMEOUT_MS = 120_000

/**
 * Create the bindings closure over one row instance's deps.
 * @param {object} deps - see the module header.
 * @returns {object} the bindings (see the module header).
 */
export function createAgentBindings(deps) {
  const { agents, sessionPersistence, domain, config, teamToolsRef } = deps
  if (agents === undefined) throw new Error('agent-bindings: deps.agents is required')
  if (sessionPersistence === undefined) throw new Error('agent-bindings: deps.sessionPersistence is required')
  if (config === undefined || config === null) throw new Error('agent-bindings: deps.config is required')
  if (domain === undefined || domain === null) throw new Error('agent-bindings: deps.domain is required (the opened TeamDomain)')
  if (teamToolsRef === undefined || teamToolsRef === null || typeof teamToolsRef !== 'object') {
    throw new Error('agent-bindings: deps.teamToolsRef is required (a { current } object the production host fills after root assembly)')
  }
  // The durable-consumption resolvers ride on the opened domain.
  const consumption = domain.consumption
  if (consumption === undefined || consumption === null) {
    throw new Error('agent-bindings: domain.consumption is required ({ model, capability } durable resolvers)')
  }

  const rootSid = config.rootSessionId

  // ── closure state (one row instance per process = per boot) ───────────

  /** @type {Map<string, object>} live agent handles keyed by session id. */
  const liveAgents = new Map()
  /** @type {Array<() => void>} tool-registration + model-selection disposers. */
  const toolDisposers = []
  /** @type {number} synthetic callId counter (the driver may omit callIds). */
  let callCounter = 0
  /** @type {string[]} noteworthy async observations (e.g. whenIdle quirks). */
  const observations = []
  /**
   * @type {Map<string, object>} per-session durable consumption state, keyed
   * by session id: `{ instanceId, ref, modelView, mcpView (null = no MCP
   * facet, T12-H1), mcpFiber,
   * mcpActivationError, appliedRecordIds: Set<string> }`. The `ref` is the
   * row-owned ModelSelectionRef installed on the public model-selection seam;
   * the views are the last APPLIED consumption views; `appliedRecordIds` is
   * the §18.3 boundary record set (which durable records this session has
   * already applied at its last request boundary).
   */
  const consumptionState = new Map()
  /**
   * @type {Promise<void> | undefined} the single boot() promise; boot() is
   * idempotent — a second call re-awaits the same promise.
   */
  let bootPromise = undefined
  /**
   * @type {Set<string>} Session ids with a live resume in flight (the
   * resuming marker, P8-S7 R2-5 / F12): written at the production resume
   * points (ensureLiveAgent + the boot resume phase) and cleared when the
   * resume settles (success or failure). The projection live-residency
   * overlay reads it through isResuming; it is ephemeral by design (the
   * frozen residency vocabulary is a non-durable overlay fact — UI §24).
   * The childFactory durable-child resume is deliberately UNMARKED: it
   * runs in the member-creation crash window, BEFORE the MemberInstance
   * row is committed, so no projection row exists to carry the fact.
   */
  const resumingSessions = new Set()
  // T12-M2: the persona surface state — the agent-scoped 'deployment:persona'
  // section disposers per session id, the identities installed before the
  // session's setup captured its agent ctx (queued until the setup flushes
  // them — still before any work on the session), the per-session live agent
  // ctx captured by the shared setup, and the lazy persona overlay slot.
  const personaDisposers = new Map()
  const personaPending = new Map()
  const liveAgentCtxs = new Map()
  let personaSlot

  // ── the durable-mutation consumption boundary (ported) ─────────────────

  /**
   * The deterministic child session id for one (root session, instance)
   * pair — the factory idempotency contract: same pair -> same child id,
   * across restarts (the derivation is stateless; a re-driven activation
   * re-derives the SAME id, never a second child). T12-B2: the identity
   * input is the PAIR, never the instance id alone — the same instanceId
   * under a different root gets a different child.
   *
   * Canonical tuple `${rootSessionId}\u0000${instanceId}` -> SHA-256 ->
   * first 32 hex chars: fixed-length, stable, no random UUID. The NUL
   * separator removes the concatenation ambiguity.
   * @param {string} rootSessionId - the team root session id.
   * @param {string} instanceId - an `inst-`-prefixed instance id.
   * @returns {string} the derived child session id.
   */
  function childSessionIdFor(rootSessionId, instanceId) {
    const digest = createHash('sha256')
      .update(`${String(rootSessionId)}\u0000${String(instanceId)}`, 'utf8')
      .digest('hex')
    return `session-team-child-${digest.slice(0, 32)}`
  }

  /**
   * Whether a session already has FINAL durable artifacts on disk
   * (`session.jsonl.zstd` under <DSH_HOME>/sessions/<project>/<sessionId>/) —
   * the cold-resume eligibility check (the write-behind publication is long
   * settled by the time a restarted boot asks).
   * @param {string} sessionId
   * @returns {boolean}
   */
  function sessionIsDurable(sessionId) {
    const home = process.env.DSH_HOME
    if (home === undefined) return false
    const sessionsRoot = join(home, 'sessions')
    let profiles
    try {
      profiles = readdirSync(sessionsRoot, { withFileTypes: true }).filter((e) => e.isDirectory())
    } catch {
      return false
    }
    for (const pd of profiles) {
      const dir = join(sessionsRoot, pd.name, sessionId)
      let entries
      try {
        entries = readdirSync(dir, { withFileTypes: true })
      } catch {
        continue
      }
      if (entries.some((e) => e.isFile() && e.name === 'session.jsonl.zstd')) return true
    }
    return false
  }

  /**
   * The durable instance binding for one session (the root embodies the
   * leader instance; every other live session is a bound member child).
   * @param {string} sessionId
   * @returns {string} the clean instance id.
   */
  function instanceIdForSession(sessionId) {
    if (sessionId === rootSid) return String(LEADER_INSTANCE_ID)
    const members = domain.repositories.memberInstances.list(rootSid)
    for (const member of members) {
      if (String(member.childSessionId) === sessionId) return String(member.instanceId)
    }
    throw new Error(`p6t6 consumption: no team instance for session '${sessionId}'`)
  }

  /**
   * Re-read the backend truth (the durable governance overrides) and resolve
   * the session's model + mcp consumption views. PURE — no live-agent side
   * effects — so boot setup, every request boundary, and the state route's
   * next-boundary projection all share the same derivation.
   * @param {string} sessionId
   * @param {string} [instanceIdHint] - the instance id the activation flow
   *   allocated for a FRESH child session: between the frozen flow's
   *   child-session creation (provider step 13) and the MemberInstance
   *   commit (step 15) the domain row does not exist yet, so the domain
   *   lookup would fail closed; the hint bridges exactly that window and
   *   carries the same value step 15 commits. The lookup stays
   *   authoritative for every other caller (boot, request boundary,
   *   projection).
   * @returns {{instanceId: string, modelView: object, mcpView: object | null}}
   *   `mcpView` is `null` when no Team MCP server is configured
   *   (config.mcpServer === null — T12-H1): no MCP facet exists, so
   *   consumers must treat null as "no MCP" (never dereference).
   */
  function resolveConsumptionViews(sessionId, instanceIdHint) {
    const existing = consumptionState.get(sessionId)
    let instanceId
    if (existing !== undefined) instanceId = existing.instanceId
    else if (instanceIdHint !== undefined) instanceId = String(instanceIdHint)
    else instanceId = instanceIdForSession(sessionId)
    const overrides = domain.repositories.overrides.list(rootSid)
    // T12-B3: the external hard facts come from the boot config (the host
    // injects them at plugin construction). This is schema normalization
    // ONLY — shallow copies so a mutation of the normalized object cannot
    // reach the config, and undefined-safe for a config that predates the
    // field. The POLICY semantics stay in the resolvers: an external hard
    // entry wins over every Team layer (including human overrides —
    // invariant 34), and a capabilityExists:false cell denies with
    // 'capabilityMissing'.
    const facts = config.externalPolicyFacts
    const external = {
      hard: { ...(facts?.hard ?? {}) },
      capabilityExists: { ...(facts?.capabilityExists ?? {}) },
    }
    const applied = existing !== undefined ? [...existing.appliedRecordIds] : []
    const modelArgs = {
      rootSessionId: rootSid,
      instanceId,
      overrides,
      external,
      baseline: { ...config.staticModel },
    }
    if (applied.length > 0) {
      modelArgs.appliedRecordIds = applied
    }
    const { view: modelView } = consumption.model.resolveDurableModelSelection(modelArgs)
    // T12-H1: mcpServer === null means NO Team MCP server is configured —
    // no dereference of the server config, no facet resolution, no
    // reconcile/create attempt downstream. The consumption view stays
    // valid with mcpView: null (no MCP facet).
    const mcpView =
      config.mcpServer === null
        ? null
        : consumption.capability.resolveDurableMcpFacet({
            rootSessionId: rootSid,
            instanceId,
            overrides,
            external,
            serverName: config.mcpServer.name,
            ...(applied.length > 0 ? { appliedRecordIds: applied } : {}),
          }).view
    return { instanceId, modelView, mcpView }
  }

  /**
   * Mark every record the just-applied boundary consumed as applied (the
   * §18.3 `appliedRecordIds` set advances to "everything admitted for the
   * cells this boundary resolved").
   * @param {object} state
   * @param {object} modelView
   * @param {object | null} mcpView (null = no MCP facet, T12-H1)
   */
  function applyBoundaryRecords(state, modelView, mcpView) {
    const mcpPending = mcpView === null ? [] : mcpView.pendingNextBoundary
    for (const pending of [...modelView.pendingNextBoundary, ...mcpPending]) {
      state.appliedRecordIds.add(pending.recordId)
    }
  }

  /**
   * Mount (or dispose) the live mini-MCP server on one agent per the durable
   * mcp facet. The fiber is a thenable: awaiting it completes activation
   * (connection + tool discovery); `.dispose()` unregisters the tools. A
   * rejected activation is recorded, the fiber is dropped, and the error
   * propagates (fail-closed: the tool is simply absent — never a half mount).
   * @param {object} agentCtx
   * @param {object} state - the session's consumption state (holds the fiber).
   * @param {boolean} allowed - the facet's mount decision.
   */
  async function reconcileMcp(agentCtx, state, allowed) {
    // T12-H1: no configured server — nothing to mount or dispose (the
    // port-null throw below stays for a CONFIGURED server without port).
    if (config.mcpServer === null) return
    if (allowed && state.mcpFiber === undefined) {
      if (config.mcpServer.port === null) {
        throw new Error(`p6t6: the durable policy allows mcp server '${config.mcpServer.name}' but no mini-MCP port is configured (config.mcpServer.port)`)
      }
      const fiber = agentCtx.plugin(mcpClient, {
        transport: 'streamable-http',
        serverName: config.mcpServer.name,
        url: `http://127.0.0.1:${config.mcpServer.port}/mcp`,
        headers: {},
        toolCallTimeoutMs: 15_000,
        failOnStartupError: true,
      })
      try {
        await fiber
        state.mcpFiber = fiber
      } catch (error) {
        state.mcpActivationError = error instanceof Error ? error.message : String(error)
        observations.push(`p6t6: mcp activation failed: ${state.mcpActivationError}`)
        try { fiber.dispose() } catch { /* the fiber is already dead */ }
        throw error
      }
      return
    }
    if (!allowed && state.mcpFiber !== undefined) {
      const fiber = state.mcpFiber
      state.mcpFiber = undefined
      state.mcpActivationError = undefined
      try {
        fiber.dispose()
      } catch (error) {
        observations.push(`p6t6: mcp fiber dispose failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  /**
   * The shared agent setup (create OR resume): resolve the durable model
   * selection + the mcp facet from the backend truth NOW, install the
   * row-owned ModelSelectionRef on the public model-selection seam, register
   * every team tool, and mount the live mini-MCP server when the durable
   * policy allows it. The disposers are collected for row-stop cleanup (the
   * agent-scope unwind covers them on disposal as well).
   * @param {string} sessionId - the session this agent embodies.
   * @param {string} [instanceIdHint] - the fresh-child instance id carried
   *   by the child factory (see resolveConsumptionViews); only that caller
   *   passes it.
   * @param {string} [templateIdHint] - the member template id the child
   *   factory request carries (T12-M2: the fresh-create window, before the
   *   MemberInstance row commits the same value).
   * @param {string} [bindPath] - one of the four T1 bind paths (the persona
   *   overlay step context carries it).
   *
   * T12-M2: the setup also installs the blueprint persona into the REAL DSH
   * Agent prompt — the agent-scoped 'deployment:persona' system-prompt
   * section — through the reused persona resolver (the resolver evaluates
   * the preset substrate and composes the scoped identity; this glue is the
   * last layer it installs onto). A pre-setup
   * personaSurface.installScopedPersona for the same session flushes here
   * too. Both installs precede any work on the session.
   * @returns {function(object): Promise<void>} the AgentSetup callback.
   */
  function agentSetup(sessionId, instanceIdHint, templateIdHint, bindPath) {
    return async (agentCtx) => {
      // T12-M2: capture the agent ctx for the persona surface (the
      // production-facing installs and the overlay slot resolve through it).
      liveAgentCtxs.set(sessionId, agentCtx)
      const { modelView, mcpView, instanceId } = resolveConsumptionViews(sessionId, instanceIdHint)
      const ref = { current: modelView.selection === undefined ? { ...config.deniedSelection } : modelView.selection, assembled: undefined }
      const state = {
        instanceId,
        ref,
        modelView,
        mcpView,
        mcpFiber: undefined,
        mcpActivationError: undefined,
        appliedRecordIds: new Set(),
      }
      consumptionState.set(sessionId, state)
      toolDisposers.push(installModelSelection(agentCtx, ref))
      // The host fills teamToolsRef.current AFTER root assembly; the setup
      // callback reads it when it runs — never before. Absent -> the
      // registration loop is skipped, as before.
      const teamTools = teamToolsRef.current
      if (teamTools) {
        for (const def of teamTools.tools) {
          toolDisposers.push(agentCtx.tools.register(def))
        }
      }
      // T12-M2: the persona boundary — the blueprint persona enters the REAL
      // DSH Agent prompt here (the agent-scoped 'deployment:persona'
      // section), after the tools and before the mcp mount: before ANY work
      // can run on this session. The reused resolver evaluates the preset
      // substrate first (complete -> FATAL, thrown before any install).
      installPersonaForSetup(sessionId, instanceId, templateIdHint, bindPath)
      // A pre-setup personaSurface.installScopedPersona for this session
      // (the pending window) flushes here too — still before any work.
      const pendingIdentity = personaPending.get(sessionId)
      if (pendingIdentity !== undefined) {
        personaPending.delete(sessionId)
        registerPersonaSection(sessionId, agentCtx, pendingIdentity)
      }
      // The mcp facet's fail-closed baseline: no durable allow -> no mount.
      // At a fresh create no overrides exist yet (unspecified), so this is
      // the resume/restart path that re-applies the durable truth on boot.
      if (mcpView !== null && mcpView.allowed) {
        await reconcileMcp(agentCtx, state, mcpView.allowed)
      }
      applyBoundaryRecords(state, modelView, mcpView)
    }
  }

  // ── T12-M2: the persona boundary (the reused resolver + the REAL layer) ──
  //
  // The persona resolver (agent-setup/persona, READ-ONLY) is the S5A-frozen
  // authority: preset substrate fact + blueprint persona fields -> the scoped
  // identity (PASS) or a FATAL TeamPersonaOverlayError (a complete preset is
  // never downgraded — thrown before any install, so no Team work starts).
  // This glue provides the LAST layer the resolver installs onto: the real
  // DSH Agent prompt surface — the agent-scoped 'deployment:persona'
  // system-prompt section on the session's live agent ctx (ctx.systemPrompt
  // is the public DSH builtin the agent loop always injects). Restore disposes
  // exactly that scoped entry; the global prompt layer is never touched.
  const personaSubstrate = () => {
    // config.presetSubstrate is the OPTIONAL additive override the production
    // root can pass (absent today) — the S5A A11 decision for the
    // dsh-agent-team preset: a standard (non-complete) substrate.
    return config.presetSubstrate ?? { presetId: 'dsh-agent-team', personaKind: 'standard' }
  }

  /**
   * Register (or re-register) the agent-scoped 'deployment:persona' section
   * on one agent ctx — the real DSH prompt-surface installation. An empty
   * persona text is a no-op (nothing to scope); a ctx without the
   * systemPrompt builtin fails loud (the pinned DSH agent ctx ALWAYS has it —
   * a missing seam is a broken host, never a silent skip). Re-installing
   * disposes the previous scoped entry for the same session first, so
   * repeated installs converge to exactly one scoped section (a later
   * delegation by the production root cannot double-register).
   */
  function registerPersonaSection(sessionId, agentCtx, identity) {
    const text = String(identity.personaText ?? '')
    const previous = personaDisposers.get(sessionId)
    if (previous !== undefined) {
      personaDisposers.delete(sessionId)
      try { previous() } catch { /* the scope unwind covers it */ }
    }
    if (text === '') return
    const systemPrompt = agentCtx.systemPrompt
    if (systemPrompt === undefined || typeof systemPrompt !== 'object' || typeof systemPrompt.section !== 'function') {
      throw new Error(`agent-bindings: persona install for '${sessionId}': the agent ctx has no systemPrompt.section seam (broken host — the pinned DSH agent ctx always has it)`)
    }
    const dispose = systemPrompt.section({
      name: 'deployment:persona',
      order: 0,
      text,
    })
    personaDisposers.set(sessionId, () => {
      try { dispose() } catch { /* the scope unwind covers it */ }
    })
  }

  const personaSurface = {
    /**
     * The production-facing install seam (the slot the production root's
     * binder currently fills through its own in-memory map): register one
     * composed identity on the session's live agent ctx. When the session's
     * agent ctx is not captured yet (the pre-setup window), the identity is
     * queued and flushed by the shared setup the moment it runs — the install
     * still precedes any work on the session.
     */
    installScopedPersona(sessionId, identity) {
      const key = String(sessionId)
      const agentCtx = liveAgentCtxs.get(key)
      if (agentCtx === undefined) {
        personaPending.set(key, identity)
        return
      }
      registerPersonaSection(key, agentCtx, identity)
    },
    /**
     * Remove exactly the agent-scoped 'deployment:persona' entry for one
     * session — the global prompt layer (the harness:identity + the global
     * deployment:persona sections the DSH service registered) is never
     * touched. Idempotent: restoring an already-restored session is a no-op.
     */
    restoreScopedPersona(sessionId) {
      const key = String(sessionId)
      const dispose = personaDisposers.get(key)
      if (dispose === undefined) return
      personaDisposers.delete(key)
      try {
        dispose()
      } catch (error) {
        observations.push(`p6t6: persona restore for '${key}' failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    },
  }

  /**
   * The lazy persona overlay slot — built once, on first use, over the
   * config.blueprintSource document (parsed through the domain blueprint
   * facade) and the preset substrate fact. Its apply() IS the reused persona
   * resolver: it evaluates the requirement against the substrate (complete ->
   * FATAL TeamPersonaOverlayError BEFORE any install), composes the scoped
   * identity from the blueprint persona fields (member: the template persona
   * — the templateId is REQUIRED, absent -> the resolver's loud TypeError),
   * and installs it through the prompt surface below.
   */
  function getPersonaSlot() {
    if (personaSlot !== undefined) return personaSlot
    const blueprint = parseBlueprint(String(config.blueprintSource ?? ''))
    const substrate = personaSubstrate()
    personaSlot = createPersonaOverlaySlot({
      presetSeam: {
        // The seam is keyed by the root session id ONLY (Architecture §13.1 —
        // members inherit the root substrate); one substrate for the team.
        getSubstrate: () => ({ presetId: substrate.presetId, personaKind: substrate.personaKind }),
      },
      personaSource: {
        getLeaderPersona: () => String(blueprint.leader.persona ?? ''),
        getMemberPersona: (_rootSessionId, templateId) => {
          const member = blueprint.members.find((entry) => entry.templateId === String(templateId))
          if (member === undefined) {
            throw new Error(`agent-bindings: persona overlay: template '${templateId}' is not a member template of the team blueprint`)
          }
          return String(member.persona ?? '')
        },
      },
      promptSurface: {
        // The REAL installation: the agent-scoped section on the session's
        // live agent ctx (captured by the shared setup — the slot only ever
        // applies from inside a setup).
        installScopedPersona: (sessionId, identity) => {
          const agentCtx = liveAgentCtxs.get(String(sessionId))
          if (agentCtx === undefined) {
            throw new Error(`agent-bindings: persona overlay install for '${sessionId}': no live agent ctx (the overlay slot only installs at setup time)`)
          }
          registerPersonaSection(String(sessionId), agentCtx, identity)
        },
      },
    })
    return personaSlot
  }

  /**
   * The setup-time persona install for one session (agentSetup calls it AFTER
   * the team tools are registered and BEFORE the mcp reconcile — the persona
   * must be in the prompt before any work on the session):
   *  - an empty blueprintSource -> no persona authority exists, skip;
   *  - the root: the substrate target is the root identity; the durable
   *    teamSessions row (when the repository carries it) is the step record;
   *  - a member: the MemberInstance row looked up by childSessionId is the
   *    step record; in the fresh-create window the row is not committed yet,
   *    so the templateIdHint the child factory carries (exactly the value the
   *    flow commits moments later) stands in for the row — a member with
   *    neither a row nor a hint fails closed with a loud error (no silent
   *    persona-less member).
   */
  function installPersonaForSetup(sessionId, instanceId, templateIdHint, bindPath) {
    if (String(config.blueprintSource ?? '') === '') return
    const slot = getPersonaSlot()
    let target
    let record
    if (sessionId === rootSid) {
      const row =
        domain.repositories.teamSessions !== undefined ? domain.repositories.teamSessions.get(rootSid) : undefined
      target = { kind: 'root', sessionId: rootSid, rootSessionId: rootSid, instanceId: LEADER_INSTANCE_ID }
      record = row ?? {}
    } else {
      const members = domain.repositories.memberInstances.list(rootSid)
      const row = members.find((member) => String(member.childSessionId) === sessionId)
      if (row !== undefined) {
        target = { kind: 'member', sessionId, rootSessionId: rootSid, instanceId: String(row.instanceId) }
        record = row
      } else if (templateIdHint !== undefined && templateIdHint !== '') {
        // The fresh-create window: the row commits AFTER this setup runs.
        target = { kind: 'member', sessionId, rootSessionId: rootSid, instanceId }
        record = { childSessionId: sessionId, instanceId, templateId: templateIdHint }
      } else {
        throw new Error(`agent-bindings: persona install for member '${sessionId}': no committed MemberInstance row and no templateId hint (fail closed — no silent persona-less member)`)
      }
    }
    slot.apply({ target, record, path: bindPath })
  }

  /**
   * The live-agent-or-resume resolver for one session id (a not-live-but-
   * durable session is resumed first; a session that is neither live nor
   * durable has no agent to run on).
   * @param {string} sessionId
   * @returns {Promise<object>} the AgentHandle.
   */
  async function ensureLiveAgent(sessionId) {
    const existing = liveAgents.get(sessionId)
    if (existing !== undefined) return existing
    if (!sessionIsDurable(sessionId)) {
      throw new Error(`p6t6: session '${sessionId}' is neither live nor durable — no agent to execute a tool on`)
    }
    resumingSessions.add(sessionId)
    try {
      const handle = await agents.resume({
        resumeSessionId: SessionId(sessionId),
        setup: agentSetup(sessionId, undefined, undefined, 'cold-member'),
      })
      liveAgents.set(sessionId, handle)
      return handle
    } finally {
      resumingSessions.delete(sessionId)
    }
  }

  /**
   * The request-boundary reconciliation (P8-S4B §18.2): re-read the backend
   * truth and bring the live agent's model selection + mcp mount in line with
   * it BEFORE the next real request. Future-boundary semantics come from the
   * public seam itself: an in-flight turn keeps its own assembly snapshot
   * (`assembled`); only the NEXT assembly sees the new `current`.
   * @param {string} sessionId
   * @returns {Promise<void>}
   */
  async function prepareAgentForRequest(sessionId) {
    const state = consumptionState.get(sessionId)
    if (state === undefined) return // defensive: every row agent has consumption state
    const { modelView, mcpView } = resolveConsumptionViews(sessionId)
    const selection = modelView.selection === undefined ? { ...config.deniedSelection } : modelView.selection
    if (state.ref.current.provider !== selection.provider || state.ref.current.model !== selection.model) {
      state.ref.current = selection
    }
    const handle = liveAgents.get(sessionId)
    if (handle !== undefined && mcpView !== null) {
      await reconcileMcp(handle.agent.ctx, state, mcpView.allowed)
    }
    applyBoundaryRecords(state, modelView, mcpView)
    state.modelView = modelView
    state.mcpView = mcpView
  }

  // ── the activation ports (real external effects, minimal surface) ─────

  const childFactory = {
    async createChildSession(request) {
      // T12-B2: the derivation key is the (root, instance) pair. The request
      // carries the root (the provider passes it); the row's own root is the
      // contract fallback when the field is absent.
      const childRoot =
        typeof request.rootSessionId === 'string' && request.rootSessionId !== ''
          ? request.rootSessionId
          : rootSid
      const childSid = childSessionIdFor(childRoot, String(request.instanceId))
      // The fresh-child instance id, carried into the setup callback: the
      // frozen activation flow creates the child session BEFORE the
      // MemberInstance row is committed (crash-window semantics — the
      // child artifact is durable before the member record), so the setup's
      // consumption resolution cannot derive the id from the domain yet.
      // The hint is exactly the value the flow commits moments later.
      const instanceIdHint = String(request.instanceId)
      // T12-M2: the template id hint — the factory request carries the
      // member's static template identity (exactly the value the flow
      // commits into the MemberInstance row moments after this setup
      // runs); the persona resolver needs it in the fresh-create window.
      const templateIdHint =
        typeof request.templateId === 'string' && request.templateId !== ''
          ? request.templateId
          : undefined
      const live = liveAgents.get(childSid)
      if (live !== undefined) return { childSessionId: childSid }
      if (sessionIsDurable(childSid)) {
        const handle = await agents.resume({
          resumeSessionId: SessionId(childSid),
          setup: agentSetup(childSid, instanceIdHint, templateIdHint, 'cold-member'),
        })
        liveAgents.set(childSid, handle)
        return { childSessionId: childSid }
      }
      // T12-M1: the actual Agent cwd is the member's EFFECTIVE workspace —
      // the contract-explicit request.workspace, falling back to the team's
      // default workspace (config.defaultWorkspace). DSH_HOME is the
      // session store, never the working directory.
      const memberCwd =
        typeof request.workspace === 'string' && request.workspace !== ''
          ? request.workspace
          : config.defaultWorkspace
      const handle = await agents.create({
        sessionId: SessionId(childSid),
        meta: { cwd: memberCwd },
        setup: agentSetup(childSid, instanceIdHint, templateIdHint, 'fresh-member'),
      })
      liveAgents.set(childSid, handle)
      return { childSessionId: childSid }
    },
  }

  const sessionDurability = {
    async ensureDurable(childSessionId) {
      const handle = liveAgents.get(String(childSessionId))
      if (handle === undefined) {
        throw new Error(`p6t6: no live agent for child session '${childSessionId}' — the invariant-46 durability barrier is impossible`)
      }
      await sessionPersistence.ensureMaterialized(handle.agent.session)
    },
  }

  /**
   * The full live-agent boot (the sequence the P6-T6 harness ran after the
   * tool stack existed; the production root calls it exactly once, after
   * filling teamToolsRef, because the setup callback registers tools INSIDE
   * create/resume). Idempotent: a second call re-awaits the same promise.
   *   create phase: create the root agent (deterministic root session id,
   *     the team's default-workspace cwd — T12-M1: never DSH_HOME) ->
   *     liveAgents -> ensureMaterialized -> then every
   *     seeded NON-leader member (config.seedMembers, leader excluded —
   *     the leader IS the root session): create the child agent on its
   *     config childSessionId -> liveAgents -> ensureMaterialized.
   *   resume phase: resume the root (same call shape), then re-bind every
   *     bound member child from the domain truth (dedupe by childSessionId,
   *     seen set starting {rootSid}): resume -> liveAgents ->
   *     ensureMaterialized.
   * @returns {Promise<void>}
   */
  function boot() {
    if (bootPromise !== undefined) return bootPromise
    bootPromise = (async () => {
      if (config.bootPhase !== 'create' && config.bootPhase !== 'resume') {
        throw new Error(`agent-bindings: config.bootPhase must be 'create' or 'resume' (got ${JSON.stringify(config.bootPhase)})`)
      }
      const rootResuming = config.bootPhase === 'resume'
      if (rootResuming) resumingSessions.add(rootSid)
      let rootHandle
      try {
        rootHandle = config.bootPhase === 'create'
          ? await agents.create({
            sessionId: SessionId(rootSid),
            // T12-M1: the root agent works in the team's effective default
            // workspace (config.defaultWorkspace) — never DSH_HOME.
            meta: { cwd: config.defaultWorkspace },
            setup: agentSetup(rootSid, undefined, undefined, 'fresh-root'),
          })
          : await agents.resume({
            resumeSessionId: SessionId(rootSid),
            setup: agentSetup(rootSid, undefined, undefined, 'cold-root'),
          })
      } finally {
        if (rootResuming) resumingSessions.delete(rootSid)
      }
      liveAgents.set(rootSid, rootHandle)
      if (config.bootPhase === 'create') {
        await sessionPersistence.ensureMaterialized(rootHandle.agent.session)
        for (const seed of config.seedMembers) {
          // The leader instance IS the root session — never a child.
          if (String(seed.instanceId) === LEADER_INSTANCE_ID) continue
          const child = String(seed.childSessionId)
          const handle = await agents.create({
            sessionId: SessionId(child),
            // T12-M1: seeded members carry no per-member workspace in the
            // boot config — they work in the team's effective default
            // workspace (never DSH_HOME); the child factory path uses the
            // request-explicit workspace when one is passed.
            meta: { cwd: config.defaultWorkspace },
            setup: agentSetup(child, String(seed.instanceId), seed.templateId, 'fresh-member'),
          })
          liveAgents.set(child, handle)
          await sessionPersistence.ensureMaterialized(handle.agent.session)
        }
      } else {
        // Resume phase: re-bind every bound member child (the leader's is
        // the root, already resumed; dedupe by child session id).
        const members = domain.repositories.memberInstances.list(rootSid)
        const seen = new Set([rootSid])
        for (const member of members) {
          const child = String(member.childSessionId)
          if (seen.has(child)) continue
          seen.add(child)
          resumingSessions.add(child)
          let handle
          try {
            handle = await agents.resume({
              resumeSessionId: SessionId(child),
              setup: agentSetup(child, undefined, undefined, 'cold-member'),
            })
          } finally {
            resumingSessions.delete(child)
          }
          liveAgents.set(child, handle)
          await sessionPersistence.ensureMaterialized(handle.agent.session)
        }
      }
    })()
    return bootPromise
  }

  // SD-SURFACE: the minimal no-op TeamAgentSetupSurface with the port's real
  // signatures (the harness needs no overlay slots; the post-commit binder
  // resolves the durable member record through the read handle).
  const surface = {
    getInstalledSlots(_sessionId) { return [] },
    installOverlay(_sessionId, _slot) {},
    restoreScope(_sessionId, _scope) {},
    recordSessionEvent(_sessionId, _event) {},
  }

  // The REAL SessionInputPort over the public Session input API: the
  // followup commit point is the inbox acceptance; the quiescence wait
  // follows. Commit-or-throw: a rejection means the input was not
  // delivered (the coordinator keeps the intent pending).
  const sessionInput = {
    async submitAttributedInput(input) {
      const handle = await ensureLiveAgent(String(input.sessionId))
      // P8-S4B: request boundary — re-apply the durable truth first.
      await prepareAgentForRequest(String(input.sessionId))
      const message = createUserMessage({
        content: [{ type: 'text', text: input.text }],
        source: { kind: 'user' },
      })
      handle.agent.followup(message)
      try {
        await handle.agent.whenIdle()
      } catch (error) {
        const note = `p6t6: whenIdle rejected after an accepted followup on ${input.sessionId}: ${error instanceof Error ? error.message : String(error)}`
        observations.push(note)
        throw error
      }
    },
  }

  // The work-delivery port (R1/R6): the ONLY model-visible delivery path —
  // the requestToken rides visibly so at-least-once deliveries stay
  // dedupe-able from the durable child log, and the turn is observed to
  // idle before the chain settles. A fault here throws: the chain settles
  // fail-closed, never a fake RUNNING success.
  const workDelivery = {
    async deliver(args) {
      const handle = await ensureLiveAgent(String(args.childSessionId))
      // P8-S4B: request boundary — re-apply the durable truth first.
      await prepareAgentForRequest(String(args.childSessionId))
      const text = args.attachedContext !== undefined && args.attachedContext.length > 0
        ? `${args.prompt}\n\n[attached-context]\n${args.attachedContext}`
        : args.prompt
      const message = createUserMessage({
        content: [{ type: 'text', text: `[team-work requestToken=${args.requestToken}] ${text}` }],
        source: { kind: 'user' },
      })
      handle.agent.followup(message)
      await handle.agent.whenIdle()
      // Materialize the durable log (the same public persistence seam the
      // activation barrier uses) so the delivered turn's model-visible
      // content is on disk before the chain settles. A contained upstream
      // turn failure does NOT reject whenIdle (errors are contained at the
      // driver boundary and reported, not propagated), so reaching here
      // means the model-visible message was submitted and the turn is over.
      await sessionPersistence.ensureMaterialized(handle.agent.session)
    },
  }

  // The P7-T3 lifecycle bindings over the REAL production surfaces: close-
  // admission stays with the production row (no separate in-process
  // admission gate — the router's per-team lock serializes the whole
  // procedure); interrupt is the public Agent cancel (upstream contract:
  // no-op when the phase is idle); drain is the REAL recursive descendant
  // drain (T12-M3: whenIdle + the subagents service, honest count, typed
  // fail-closed); residency is the live-agent handle map (drop = forget the
  // resident handle, the durable session stays on disk under DSH_HOME).
  async function interrupt(target) {
    const row = domain.repositories.memberInstances.list(rootSid).find(
      (m) => String(m.instanceId) === String(target.instanceId),
    )
    const handle = row !== undefined ? liveAgents.get(String(row.childSessionId)) : undefined
    if (handle === undefined) return // no activity in flight: no-op by contract
    handle.agent.cancel({ kind: 'user' })
  }

  // T12-M3: the typed fail-closed error for a drain that cannot ESTABLISH
  // quiescence (no live agent, subagents service absent/unusable,
  // infrastructural rejection). Carries code 'recursive-drain-unavailable';
  // the lifecycle layer (lifecycle/quiesce.ts) maps the REJECTION to a
  // live-effect failure and the archive/dispose procedure REFUSES
  // completion — quiescence is never faked.
  function recursiveDrainUnavailable(sessionId, reason) {
    const error = new Error(`agent-bindings: recursive drain unavailable for '${sessionId}': ${reason} (code: recursive-drain-unavailable)`)
    error.code = 'recursive-drain-unavailable'
    observations.push(`p6t6: recursive-drain-unavailable for ${sessionId}: ${reason}`)
    return error
  }

  /**
   * T12-M3: the REAL recursive descendant drain (stop + quiesce).
   *
   * Cancel semantics: this is invoked BEFORE any dropResidency /
   * handle.dispose (a disposed agent cannot be quiesced — the durable
   * session on disk is not quiescence). The sequence:
   *   (a) `await handle.agent.whenIdle()` — the member's own in-flight turn
   *       settles first (a rejection PROPAGATES as a fault: a rejected
   *       settle is not quiescence);
   *   (b) `await subagents.drainContinuableDescendants([handle.agent])` —
   *       the SubagentRuntime closes admission below the member, stops its
   *       visible descendant Activations, and awaits them; it REJECTS with
   *       an aggregate AFTER ALL BRANCHES SETTLE when any failed — that
   *       rejection is a DRAIN FAILURE: the report is
   *       `{drained: <count>, quiescent: false}`, never `quiescent: true`;
   *   (c) `await subagents.listDescendants(handle.agent.session.id)` — the
   *       HONEST descendant count (the complete tree after the drain).
   *
   * `quiescent: true` is returned ONLY when (a) and (b) settled without
   * rejection and (c) listed successfully.
   *
   * Throws the typed `recursive-drain-unavailable` error (the lifecycle
   * maps the rejection to LIFECYCLE_LIVE_EFFECT_FAILED; the procedure
   * refuses before any commit) when:
   *   - there is no live agent for the session (quiescence cannot be
   *     established for a member that has no resident agent);
   *   - the subagents service is absent or structurally unusable (the
   *     production host seam is not wired yet — integrator note: host.ts
   *     must pass `subagents: ctx.get('subagents')` into the glue deps for
   *     this drain to be active in production);
   *   - the drain or the listing fails for an infrastructural reason (as
   *     opposed to the (b) aggregate drain FAILURE, which reports
   *     `quiescent: false` with the best-effort count).
   *
   * @param {string} childSessionId
   * @returns {Promise<{drained: number, quiescent: boolean}>}
   */
  async function drainDescendants(childSessionId) {
    const sid = String(childSessionId)
    const handle = liveAgents.get(sid)
    if (handle === undefined) {
      throw recursiveDrainUnavailable(sid, 'no live agent (quiescence cannot be established)')
    }
    // (a) the member's own turn settles first.
    await handle.agent.whenIdle()
    // (b) the real recursive drain of every continuable descendant.
    const subagents = deps.subagents
    if (
      subagents === undefined ||
      typeof subagents.drainContinuableDescendants !== 'function' ||
      typeof subagents.listDescendants !== 'function'
    ) {
      throw recursiveDrainUnavailable(sid, 'the subagents service is absent or unusable')
    }
    let drainFailed = false
    try {
      await subagents.drainContinuableDescendants([handle.agent])
    } catch {
      // The aggregate settles only AFTER all branches: a rejection here is
      // a DRAIN FAILURE (residual descendant activity), not a fault — it
      // reports quiescent: false, never a throw and never quiescent: true.
      drainFailed = true
    }
    // (c) the honest descendant count (the tree after the drain).
    let drained
    try {
      const entries = await subagents.listDescendants(handle.agent.session.id)
      drained = entries.length
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error)
      throw recursiveDrainUnavailable(
        sid,
        drainFailed ? `the drain failed and the descendant listing rejected: ${detail}` : `the descendant listing rejected: ${detail}`,
      )
    }
    if (drainFailed) return { drained, quiescent: false }
    return { drained, quiescent: true }
  }

  const residency = {
    has(sessionId) { return liveAgents.has(String(sessionId)) },
    // alias: the frozen port name
    hasResidency(sessionId) { return liveAgents.has(String(sessionId)) },
    dropResidency(sessionId) {
      const sid = String(sessionId)
      const handle = liveAgents.get(sid)
      if (handle === undefined) return false // the handle may be absent: no-op by contract
      liveAgents.delete(sid)
      // The sync port cannot await: the public handle dispose (stop the
      // loop, unregister, remove the session from the store) proceeds
      // in flight. Quiescence was already observed at the previous step,
      // so no model-visible write can follow the unregister.
      handle.dispose().catch((error) => {
        observations.push(`p6t6: residency dispose failed for '${sid}': ${error instanceof Error ? error.message : String(error)}`)
      })
      return true
    },
  }

  // SD-CALLER: the tool layer only LOOKS UP the caller identity from the
  // durable domain; the runtime re-validates it on every call.
  const resolveCaller = async (sessionId) => {
    if (sessionId === rootSid) {
      return { kind: 'instance', instanceId: String(LEADER_INSTANCE_ID) }
    }
    const members = domain.repositories.memberInstances.list(rootSid)
    for (const member of members) {
      if (String(member.childSessionId) === sessionId) {
        return { kind: 'instance', instanceId: String(member.instanceId) }
      }
    }
    throw new Error(`p6t6 caller map: no caller for session ${sessionId}`)
  }

  // ── the live-handle surface (harness routes + root bootstrap) ─────────

  /**
   * The governance authority for the principal session (verbatim from the
   * P6-T6 governance route): the root session is the host-known operator
   * (human overrides); a bound member child is a member (own-instance
   * autonomy overlays only); anything else has no authorized team principal.
   * @param {string} asSessionId
   * @returns {{kind: string, instanceId?: string} | undefined}
   */
  function governanceAuthority(asSessionId) {
    if (asSessionId === rootSid) return { kind: 'operator' }
    const member = domain.repositories.memberInstances
      .list(rootSid)
      .find((m) => String(m.childSessionId) === asSessionId)
    if (member === undefined) return undefined
    return { kind: 'member', instanceId: String(member.instanceId) }
  }

  /**
   * Forget + dispose one live handle with the route-facing result object:
   * absent -> {dropped:false}; present -> delete + await the teardown,
   * surfacing a dispose rejection as disposeError (and an observation).
   * Awaiting the teardown first guarantees no second live agent on the same
   * session when the next execution cold-resumes from the durable log (W7).
   * @param {string} sessionId
   * @returns {Promise<{dropped: boolean, disposeError?: string}>}
   */
  async function dropResidency(sessionId) {
    const sid = String(sessionId)
    const handle = liveAgents.get(sid)
    if (handle === undefined) return { dropped: false } // the handle may be absent: no-op by contract
    liveAgents.delete(sid)
    try {
      await handle.dispose()
      return { dropped: true }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      observations.push(`p6t6: residency dispose failed for '${sid}': ${message}`)
      return { dropped: true, disposeError: message }
    }
  }

  // ── the row-owned tool execution budget (the tool-route internals) ────

  /** A route-facing execution fault: `code` maps to the harness status. */
  function toolRouteError(code, message) {
    return Object.assign(new Error(message), { code })
  }

  /**
   * One registered-tool execution on the agent bound to `sessionId`
   * (ensure-live -> request boundary -> synthetic callId -> the public
   * tools.execute with the row-owned budget). Faults surface as an Error
   * with a `code`: NO_LIVE_AGENT (harness 422), CONSUMPTION_BOUNDARY
   * (harness 500), TOOLS_EXECUTE (harness 500).
   * @param {string} sessionId
   * @param {{name: string, args?: object, callId?: string}} request
   * @returns {Promise<object>} the tools.execute result ({isError, value, error}).
   */
  async function executeTool(sessionId, request) {
    const { name, args, callId } = request
    let handle
    try {
      handle = await ensureLiveAgent(String(sessionId))
    } catch (error) {
      throw toolRouteError('NO_LIVE_AGENT', error instanceof Error ? error.message : String(error))
    }
    // P8-S4B: request boundary — the next real request runs on the
    // durable truth (an in-flight turn on `sessionId` keeps its own snapshot).
    try {
      await prepareAgentForRequest(String(sessionId))
    } catch (error) {
      throw toolRouteError('CONSUMPTION_BOUNDARY', error instanceof Error ? error.message : String(error))
    }
    callCounter += 1
    const resolvedCallId = ToolCallId(typeof callId === 'string' && callId.length > 0 ? callId : `p6t6-call-${callCounter}`)
    try {
      return await handle.agent.ctx.tools.execute({
        callId: resolvedCallId,
        name,
        arguments: args ?? {},
        agent: handle.agent,
        signal: AbortSignal.timeout(TOOL_EXEC_TIMEOUT_MS),
      })
    } catch (error) {
      throw toolRouteError('TOOLS_EXECUTE', `tools.execute failed: ${error instanceof Error ? `${error.message}${error.stack ? `\n${error.stack}` : ''}` : String(error)}`)
    }
  }

  // ── row-stop cleanup (idempotent) ──────────────────────────────────────

  /**
   * Dispose every owned side effect (idempotent — the row-stop backstop;
   * safe if the production root also calls it on its own stop): the live
   * agent handles, the tool-registration + model-selection disposers, every
   * mounted mini-MCP fiber (the agent-scope unwind covers each one on
   * disposal as well), and the per-session consumption state. The TeamDomain
   * close stays with the production root.
   * @returns {Promise<void>}
   */
  async function close() {
    for (const [sid, handle] of [...liveAgents]) {
      liveAgents.delete(sid)
      try {
        await handle.dispose()
      } catch (error) {
        observations.push(`p6t6: close: agent dispose failed for '${sid}': ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    for (const dispose of toolDisposers.splice(0)) {
      try { dispose() } catch { /* the scope unwind covers it */ }
    }
    // T12-M2: the persona scope — dispose every agent-scoped
    // 'deployment:persona' entry (exactly the scoped sections; the global
    // prompt layer is never touched) and clear the persona surface state.
    for (const dispose of [...personaDisposers.values()]) {
      try { dispose() } catch { /* the scope unwind covers it */ }
    }
    personaDisposers.clear()
    personaPending.clear()
    liveAgentCtxs.clear()
    for (const state of consumptionState.values()) {
      if (state.mcpFiber !== undefined) {
        try { state.mcpFiber.dispose() } catch { /* the scope unwind covers it */ }
        state.mcpFiber = undefined
      }
    }
    consumptionState.clear()
  }

  return {
    // the harness observability surface (the production host exposes this
    // whole bundle as the teamRoot.live field)
    listLiveSessions: () => [...liveAgents.keys()].sort(),
    hasLive: (sessionId) => liveAgents.has(String(sessionId)),
    isResuming: (sessionId) => resumingSessions.has(String(sessionId)),
    ensureLiveAgent,
    prepareAgentForRequest,
    executeTool,
    getConsumptionState: (sessionId) => consumptionState.get(String(sessionId)),
    resolveConsumptionViews,
    observations,
    governanceAuthority,
    dropResidency,
    close,
    // the provider-facing ports (verbatim port)
    childFactory,
    sessionDurability,
    surface,
    sessionInput,
    workDelivery,
    interrupt,
    drainDescendants,
    residency,
    resolveCaller,
    // additive: the production root bootstrap
    boot,
    agentSetup,
    rootSessionId: rootSid,
    // additive (T12-B2): the deterministic child-id derivation
    childSessionIdFor,
    // additive (T12-M2): the REAL scoped-prompt persona surface
    personaSurface,
  }
}
