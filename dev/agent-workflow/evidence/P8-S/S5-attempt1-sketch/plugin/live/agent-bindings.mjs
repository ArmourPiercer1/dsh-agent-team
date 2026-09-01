/**
 * agent-bindings.mjs — the production live agent bindings (P8-S5; the
 * harness p6t6 agent layer, moved into the production live layer and
 * parameterized over the plugin config).
 *
 * This module owns EVERY live-Agent effect of the production Team plugin:
 *
 * - the live session registry (`liveAgents`) + the per-session P8-S4B
 *   consumption state (the model selection ref, the mcp facet state, the
 *   applied-boundary record ids, the activation diagnostics);
 * - the shared agent setup (`makeAgentSetup`: resolve the durable
 *   consumption views, install the ModelSelectionRef on the public
 *   model-selection seam, register every team tool, mount the live mini-MCP
 *   server when the durable policy allows it);
 * - the live-agent-or-resume resolver (`ensureLiveAgent`, the SD-CALLER
 *   execution binding), the instance-for-session map
 *   (`instanceIdForSession`), the request-boundary reconciliation
 *   (`prepareAgentForRequest`, P8-S4B §18.2) and the durable consumption
 *   derivation (`resolveConsumptionViews` — PURE, shared by boot setup,
 *   every request boundary, and the row's state-route projection);
 * - the production ports the composition wires to the runtime satellites:
 *   `sessionInput` (the messaging coordinator's real input port),
 *   `workDelivery` (the P8-S3 model-visible delivery + quiescence +
 *   materialization), `lifecyclePorts` (the P7-T3 lifecycle over the real
 *   surfaces), `sessionDurability` (the `sessionPersistence` seam),
 *   `residency` (the live handle map view), `resolveCaller` (the SD-CALLER
 *   map);
 * - the boot materialization (`bootAgents`: create phase -> root + the
 *   seeded member children; resume phase -> root + every bound member
 *   child, each through the shared setup + the durable materialization).
 *
 * LATE BINDING: the agent setup reads the assembled tool set through
 * `teamRootRef.current.tools` at setup EXECUTION time — the setup always
 * runs after the full composition (the row awaits `bootAgents` after
 * mounting the production plugin), so the ref is populated by then.
 *
 * LIVE-WORLD MODULE: bare specifiers (`@deepseek-ai/*`) + `node:`
 * imports; loaded ONLY through the dynamic `import()` in `host.ts` (the
 * harness node_modules junction farm resolves the bare specifiers). The
 * sanctioned test chain never loads this file (T1 injects a fake live
 * bundle). Type surface: the sibling `agent-bindings.d.mts`.
 */
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { SessionId } from '@deepseek-ai/dsh-session'
import { installModelSelection } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import * as mcpClient from '@deepseek-ai/dsh-mcp-client'
import * as modelSetupMod from '../../agent-setup/model/index.js'
import * as capabilitySetupMod from '../../agent-setup/capability/index.js'

/**
 * Build the live agent bindings of one production Team plugin instance.
 *
 * @param {object} args
 * @param {object} args.config - the TeamPluginConfig (JSON-safe core).
 * @param {object} args.domain - the OPENED TeamDomain (the repositories
 *   source of the durable consumption truth + the lifecycle reads).
 * @param {object} args.agents - the DSH `agents` service (create/resume).
 * @param {object} args.sessionPersistence - the DSH `sessionPersistence`
 *   service (ensureMaterialized).
 * @param {object} [args.observationSink] - the substrate observation sink
 *   (test-world diagnostics).
 * @returns the TeamLivePorts bundle (without `storageSeam` / the handoff
 *   surface ports, which the sibling live modules contribute).
 */
export function buildAgentBindings({ config, domain, agents, sessionPersistence, observationSink }) {
  const rootSid = config.rootSessionId
  const liveAgents = new Map()
  const consumptionState = new Map()
  const toolDisposers = []
  const observations = []
  const teamRootRef = { current: undefined }
  const observe = (note) => {
    observations.push(note)
    if (observationSink !== undefined) {
      try { observationSink(note) } catch { /* the sink is diagnostic-only */ }
    }
  }

  /**
   * The deterministic child session id for one activated instance (the
   * factory idempotency contract: same (root, instanceId) -> same child
   * id).
   * @param {string} instanceId - an `inst-`-prefixed instance id.
   * @returns {string} the derived child session id.
   */
  function childSidFor(instanceId) {
    return `${config.childSessionIdPrefix}${instanceId.slice(5)}`
  }

  /**
   * Whether a session already has FINAL durable artifacts on disk
   * (`session.jsonl.zstd` under <DSH_HOME>/sessions/<profile>/<sessionId>/)
   * — the cold-resume eligibility check (the write-behind publication is
   * long settled by the time a restarted boot asks).
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
   * The instance id bound to one session (root -> the leader instance;
   * member child -> its instance).
   * @param {string} sessionId
   * @returns {string}
   */
  const LEADER_INSTANCE_ID = 'inst-leader'

  function instanceIdForSession(sessionId) {
    if (sessionId === rootSid) {
      const rows = domain.repositories.memberInstances.list(rootSid)
      // The production leader row: the v2 mint (no `childSessionId` key)
      // or the v1 seeded row (`childSessionId === rootSid`) — both carry
      // the reserved leader instance id (invariant 13). The instance id
      // is the authoritative match; the child binding is the fallback for
      // v1 rows whose instance id would ever differ.
      const leader = rows.find((m) => String(m.instanceId) === LEADER_INSTANCE_ID)
        ?? rows.find((m) => m.childSessionId === rootSid)
      if (leader === undefined) throw new Error(`p8s5: no leader instance bound to root session ${rootSid}`)
      return String(leader.instanceId)
    }
    const row = domain.repositories.memberInstances.list(rootSid).find((m) => String(m.childSessionId) === sessionId)
    if (row === undefined) throw new Error(`p8s5: no member instance bound to session ${sessionId}`)
    return String(row.instanceId)
  }

  /**
   * Re-read the backend truth (the durable governance overrides) and
   * resolve the session's model + mcp consumption views. PURE — no
   * live-agent side effects — so boot setup, every request boundary, and
   * the row's state-route next-boundary projection all share the same
   * derivation.
   * @param {string} sessionId
   * @returns {{instanceId: string, modelView: object, mcpView: object}}
   */
  function resolveConsumptionViews(sessionId) {
    const existing = consumptionState.get(sessionId)
    const instanceId = existing !== undefined ? existing.instanceId : instanceIdForSession(sessionId)
    const overrides = domain.repositories.overrides.list(rootSid)
    const external = { hard: {}, capabilityExists: {} }
    const applied = existing !== undefined ? [...existing.appliedRecordIds] : []
    const modelArgs = {
      rootSessionId: rootSid,
      instanceId,
      overrides,
      external,
      baseline: { ...config.staticModel },
    }
    const mcpArgs = { rootSessionId: rootSid, instanceId, overrides, external, serverName: config.mcpServer.name }
    if (applied.length > 0) {
      modelArgs.appliedRecordIds = applied
      mcpArgs.appliedRecordIds = applied
    }
    const { view: modelView } = modelSetupMod.resolveDurableModelSelection(modelArgs)
    const { view: mcpView } = capabilitySetupMod.resolveDurableMcpFacet(mcpArgs)
    return { instanceId, modelView, mcpView }
  }

  /**
   * Mark every record the just-applied boundary consumed as applied (the
   * §18.3 `appliedRecordIds` set advances to "everything admitted for the
   * cells this boundary resolved").
   */
  function applyBoundaryRecords(state, modelView, mcpView) {
    for (const pending of [...modelView.pendingNextBoundary, ...mcpView.pendingNextBoundary]) {
      state.appliedRecordIds.add(pending.recordId)
    }
  }

  /**
   * Mount (or dispose) the live mini-MCP server on one agent per the
   * durable mcp facet. The fiber is a thenable: awaiting it completes
   * activation (connection + tool discovery); `.dispose()` unregisters the
   * tools. A rejected activation is recorded, the fiber is dropped, and the
   * error propagates (fail-closed: the tool is simply absent — never a
   * half mount).
   */
  async function reconcileMcp(agentCtx, state, allowed) {
    if (allowed && state.mcpFiber === undefined) {
      if (config.mcpServer.port === null) {
        throw new Error(`p8s5: the durable policy allows mcp server '${config.mcpServer.name}' but no mini-MCP port is configured (config.mcpServer.port)`)
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
        observe(`p8s5: mcp activation failed: ${state.mcpActivationError}`)
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
        observe(`p8s5: mcp fiber dispose failed: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  /**
   * The shared agent setup (create OR resume): resolve the durable model
   * selection + the mcp facet from the backend truth NOW, install the
   * ModelSelectionRef on the public model-selection seam, register every
   * team tool, and mount the live mini-MCP server when the durable policy
   * allows it. The disposers are collected for root-close cleanup (the
   * agent-scope unwind covers them on disposal as well).
   * @param {string} sessionId - the session this agent embodies.
   * @returns {function(object): Promise<void>} the AgentSetup callback.
   */
  function makeAgentSetup(sessionId) {
    return async (agentCtx) => {
      const { modelView, mcpView, instanceId } = resolveConsumptionViews(sessionId)
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
      // LATE BINDING: the assembled tool set (the production root's
      // satellite) — the setup always runs after the full composition.
      const tools = teamRootRef.current !== undefined ? teamRootRef.current.tools : undefined
      if (tools !== undefined) {
        for (const def of tools.tools) {
          toolDisposers.push(agentCtx.tools.register(def))
        }
      }
      // The mcp facet's fail-closed baseline: no durable allow -> no mount.
      // At a fresh create no overrides exist yet (unspecified), so this is
      // the resume/restart path that re-applies the durable truth on boot.
      if (mcpView.allowed) {
        await reconcileMcp(agentCtx, state, mcpView.allowed)
      }
      applyBoundaryRecords(state, modelView, mcpView)
    }
  }

  /**
   * The live-agent-or-resume resolver for one session id (the SD-CALLER
   * execution binding: a tool call `as <session>` runs on that session's
   * agent; a not-live-but-durable session is resumed first).
   * @param {string} sessionId
   * @returns {Promise<object>} the live session handle.
   */
  async function ensureLiveAgent(sessionId) {
    const existing = liveAgents.get(sessionId)
    if (existing !== undefined) return existing
    if (!sessionIsDurable(sessionId)) {
      throw new Error(`p8s5: session '${sessionId}' is neither live nor durable`)
    }
    const handle = await agents.resume({
      resumeSessionId: SessionId(sessionId),
      setup: makeAgentSetup(sessionId),
    })
    liveAgents.set(sessionId, handle)
    return handle
  }

  /**
   * The request-boundary reconciliation (P8-S4B §18.2): re-read the
   * backend truth and bring the live agent's model selection + mcp mount
   * in line with it BEFORE the next real request. Future-boundary semantics
   * come from the public seam itself: an in-flight turn keeps its own
   * assembly snapshot (`assembled`); only the NEXT assembly sees the new
   * `current`.
   * @param {string} sessionId
   * @returns {Promise<void>}
   */
  async function prepareAgentForRequest(sessionId) {
    const state = consumptionState.get(sessionId)
    if (state === undefined) return // defensive: every row agent has consumption state
    const { modelView, mcpView } = resolveConsumptionViews(sessionId)
    const selection = modelView.selection
    if (selection !== undefined && (state.ref.current.provider !== selection.provider || state.ref.current.model !== selection.model)) {
      state.ref.current = selection
    }
    const handle = liveAgents.get(sessionId)
    if (handle !== undefined) {
      await reconcileMcp(handle.agent.ctx, state, mcpView.allowed)
    }
    applyBoundaryRecords(state, modelView, mcpView)
    state.modelView = modelView
    state.mcpView = mcpView
  }

  // ── the child session factory (the activation provider's creation path) ──
  const childFactory = {
    async createChildSession(request) {
      const childSid = childSidFor(String(request.instanceId))
      // The idempotency short-circuit: a live (or already durable) child is
      // the SAME session (the deterministic derivation is the contract).
      if (liveAgents.has(childSid)) return { childSessionId: childSid }
      if (sessionIsDurable(childSid)) {
        const handle = await agents.resume({
          resumeSessionId: SessionId(childSid),
          setup: makeAgentSetup(childSid),
        })
        liveAgents.set(childSid, handle)
        return { childSessionId: childSid }
      }
      const handle = await agents.create({
        sessionId: SessionId(childSid),
        meta: { cwd: process.env.DSH_HOME },
        setup: makeAgentSetup(childSid),
      })
      liveAgents.set(childSid, handle)
      return { childSessionId: childSid }
    },
  }

  // ── session durability (the sessionPersistence seam) ──
  const sessionDurability = {
    async ensureDurable(childSessionId) {
      const handle = liveAgents.get(String(childSessionId))
      if (handle === undefined) {
        throw new Error(`p8s5: ensureDurable: no live agent for session '${childSessionId}'`)
      }
      await sessionPersistence.ensureMaterialized(handle.agent.session)
    },
  }

  // ── the messaging coordinator's session input port (the real input) ──
  // The followup commit point is the inbox acceptance; the quiescence wait
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
        const note = `p8s5: whenIdle rejected after an accepted followup on ${input.sessionId}: ${error instanceof Error ? error.message : String(error)}`
        observe(note)
        throw error
      }
    },
  }

  // ── the P8-S3 work delivery port (model-visible delivery + quiescence +
  //    the durable materialization) ──
  const workDelivery = {
    async deliver(args) {
      const handle = await ensureLiveAgent(String(args.childSessionId))
      await prepareAgentForRequest(String(args.childSessionId))
      const text = args.attachedContext !== undefined
        ? `${args.prompt}\n\n<attached-context>\n${args.attachedContext}\n</attached-context>`
        : args.prompt
      const message = createUserMessage({
        content: [{ type: 'text', text: `[team-work requestToken=${args.requestToken}] ${text}` }],
        source: { kind: 'user' },
      })
      handle.agent.followup(message)
      try {
        await handle.agent.whenIdle()
      } finally {
        await sessionPersistence.ensureMaterialized(handle.agent.session)
      }
    },
  }

  // ── the P7-T3 lifecycle ports over the REAL production surfaces ──
  // close-admission is a no-op in this composition because it has no
  // separate in-process admission gate — the router's per-team lock
  // serializes the whole procedure and the durable terminal-state commit
  // is what durably blocks new work; interrupt is the public Agent cancel
  // (upstream contract: no-op when the phase is idle); drain quiesces on
  // the public whenIdle; residency is the live-agent handle map (drop =
  // forget the resident handle, the durable session stays on disk under
  // DSH_HOME).
  const lifecycleCommitPort = {
    async commitTransition(args) {
      await domain.repositories.memberInstances.commitTransition(args)
    },
  }
  const lifecyclePorts = {
    teamDomain: domain,
    commit: lifecycleCommitPort,
    admission: {
      async closeNewWork(_target) {
        // no separate admission gate in this composition (see above)
      },
    },
    activity: {
      async interrupt(target) {
        const row = domain.repositories.memberInstances.list(rootSid).find(
          (m) => String(m.instanceId) === String(target.instanceId),
        )
        const handle = row !== undefined ? liveAgents.get(String(row.childSessionId)) : undefined
        if (handle !== undefined) {
          handle.agent.cancel({ kind: 'user' })
        }
      },
    },
    descendants: {
      async drainDescendants(childSessionId) {
        const handle = liveAgents.get(String(childSessionId))
        if (handle !== undefined) {
          await handle.agent.whenIdle()
        }
        return { drained: 0, quiescent: true }
      },
    },
    residency: {
      hasResidency(childSessionId) {
        return liveAgents.has(String(childSessionId))
      },
      dropResidency(childSessionId) {
        const sid = String(childSessionId)
        const handle = liveAgents.get(sid)
        if (handle === undefined) return
        liveAgents.delete(sid)
        handle.dispose().catch((error) => {
          observe(`p8s5: residency dispose failed for '${sid}': ${error instanceof Error ? error.message : String(error)}`)
        })
      },
    },
  }

  // ── the SD-CALLER map (the action caller resolution) ──
  const LEADER_INSTANCE_ID = () => instanceIdForSession(rootSid)
  const resolveCaller = async (sessionId) => {
    if (sessionId === rootSid) {
      return { kind: 'instance', instanceId: LEADER_INSTANCE_ID() }
    }
    const row = domain.repositories.memberInstances.list(rootSid).find((m) => String(m.childSessionId) === sessionId)
    if (row === undefined) throw new Error(`p8s5 caller map: no caller for session ${sessionId}`)
    return { kind: 'instance', instanceId: String(row.instanceId) }
  }

  // ── the boot materialization (root + member children) ──
  async function bootAgents() {
    const rootHandle = config.bootPhase === 'create'
      ? await agents.create({
        sessionId: SessionId(rootSid),
        meta: { cwd: process.env.DSH_HOME },
        setup: makeAgentSetup(rootSid),
      })
      : await agents.resume({
        resumeSessionId: SessionId(rootSid),
        setup: makeAgentSetup(rootSid),
      })
    liveAgents.set(rootSid, rootHandle)
    if (config.bootPhase === 'create') {
      await sessionPersistence.ensureMaterialized(rootHandle.agent.session)
      for (const seed of config.seedMembers) {
        const handle = await agents.create({
          sessionId: SessionId(seed.childSessionId),
          meta: { cwd: process.env.DSH_HOME },
          setup: makeAgentSetup(seed.childSessionId),
        })
        liveAgents.set(seed.childSessionId, handle)
        await sessionPersistence.ensureMaterialized(handle.agent.session)
      }
    } else {
      // Resume: every bound member child session (the leader's is the
      // root, already resumed; dedupe by child session id).
      const members = domain.repositories.memberInstances.list(rootSid)
      const seen = new Set([rootSid])
      for (const member of members) {
        const child = String(member.childSessionId)
        if (seen.has(child)) continue
        seen.add(child)
        const handle = await agents.resume({
          resumeSessionId: SessionId(child),
          setup: makeAgentSetup(child),
        })
        liveAgents.set(child, handle)
      }
    }
  }

  // ── the row observability surface ──
  function consumptionSnapshot(sessionId) {
    const state = consumptionState.get(String(sessionId))
    if (state === undefined) return undefined
    const snapshot = {
      instanceId: state.instanceId,
      model: {
        current: state.ref.current,
        assembled: state.ref.assembled ?? null,
        view: {
          selection: state.modelView.selection ?? null,
          source: state.modelView.source,
          suppressed: state.modelView.suppressed,
          unavailable: state.modelView.unavailable,
          ...(state.modelView.deniedBy !== undefined ? { deniedBy: state.modelView.deniedBy } : {}),
          pendingNextBoundary: [...state.modelView.pendingNextBoundary],
          explanation: state.modelView.explanation ?? null,
        },
      },
      mcp: {
        mounted: state.mcpFiber !== undefined,
        serverName: config.mcpServer.name,
        ...(state.mcpActivationError !== undefined ? { activationError: state.mcpActivationError } : {}),
        view: {
          allowed: state.mcpView.allowed,
          source: state.mcpView.source,
          unavailable: state.mcpView.unavailable,
          ...(state.mcpView.deniedBy !== undefined ? { deniedBy: state.mcpView.deniedBy } : {}),
          pendingNextBoundary: [...state.mcpView.pendingNextBoundary],
          explanation: state.mcpView.explanation ?? null,
        },
      },
      appliedRecordIds: [...state.appliedRecordIds],
    }
    return snapshot
  }

  async function dropResidency(sessionId) {
    const sid = String(sessionId)
    const handle = liveAgents.get(sid)
    if (handle === undefined) return false
    liveAgents.delete(sid)
    await handle.dispose()
    return true
  }

  async function close() {
    for (const dispose of toolDisposers.splice(0)) {
      try { dispose() } catch { /* the scope unwind covers it */ }
    }
    for (const state of consumptionState.values()) {
      if (state.mcpFiber !== undefined) {
        try { state.mcpFiber.dispose() } catch { /* the scope unwind covers it */ }
      }
    }
    consumptionState.clear()
  }

  return {
    liveSessions: liveAgents,
    consumptionSnapshot,
    liveObservations: () => [...observations],
    agentSetup: makeAgentSetup,
    childFactory,
    ensureLiveAgent,
    instanceIdForSession,
    sessionInput,
    workDelivery,
    lifecyclePorts,
    sessionDurability,
    residency: lifecyclePorts.residency,
    resolveCaller,
    bootAgents,
    close,
    bindRoot(root) {
      teamRootRef.current = root
    },
  }
}
