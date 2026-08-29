/**
 * P2-T4 probe plugin — capability seam scenario driver (host half).
 *
 * Mounted as one cordis profile row through the public `cordis.patch.yml`
 * seam (id `p2t4-capabilities-probe`) and imported by the booted DSH host
 * process — never by the harness process. `apply()` returns immediately;
 * the self-driving scenario runs as owned async work and writes plain
 * observation JSON to a file channel under the task-dedicated DSH_HOME
 * (`p2t4-observations.json` per boot, `p2t4-state.json` boot1 -> boot2,
 * `p2t4-mcp-port.txt` harness -> payload). Live Cordis objects are never
 * serialized: only leaf fields and short error strings cross the file
 * boundary.
 *
 * Every import below stays inside the upstream public exports whitelist
 * (statically scanned by the harness; the Node ESM loader re-enforces it
 * at boot, which is part of what a green boot proves).
 *
 * Seam dimensions exercised per row (pre-step, pre-execute, tool
 * visibility, skills, MCP):
 *   creation           — agent-scoped world composed in `setup()` before
 *                        publication (scoped register, scoped listeners,
 *                        scoped skill, agent-scoped MCP instance)
 *   cold resume        — boot 2: `agents.resume()` on the persisted session;
 *                        the scoped world recomposes; durable log retained
 *   tighten            — post-creation control: scoped `restrict()`,
 *                        mutable admission policy flip, scoped skill
 *                        disposer, post-publication registration attempt,
 *                        MCP instance fiber disposal + remount
 *   capability disappear — `handle.dispose()`: registry lookup, stale tool
 *                        execution, scoped skill view, followup on disposed
 */
import { randomUUID } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { installModelSelection } from '@deepseek-ai/dsh-agent'
import { createUserMessage } from '@deepseek-ai/dsh-llm'
import * as mcpClient from '@deepseek-ai/dsh-mcp-client'
import { SessionId } from '@deepseek-ai/dsh-session'

export const name = 'p2t4-capabilities-probe'

const OBS_REL = 'p2t4-observations.json'
const STATE_REL = 'p2t4-state.json'
const MCP_PORT_REL = 'p2t4-mcp-port.txt'
const IDLE_TIMEOUT_MS = 90_000

/**
 * @param {object} ctx - host plugin context (unscoped profile row context).
 */
export function apply(ctx) {
  const dshHome = process.env.DSH_HOME
  if (typeof dshHome !== 'string' || dshHome === '') {
    throw new Error('p2t4-capabilities-probe: DSH_HOME is not set; the harness must launch the instance with it')
  }
  const obsPath = join(dshHome, OBS_REL)
  const statePath = join(dshHome, STATE_REL)
  let priorState = null
  try {
    priorState = JSON.parse(readFileSync(statePath, 'utf8'))
  } catch {
    priorState = null
  }
  const boot = priorState === null ? 1 : 2
  // Clear the previous boot's observation so the harness poll cannot
  // mistake stale completion for this boot's result.
  writeFileSync(obsPath, JSON.stringify({ boot, done: false, results: {} }, null, 2))
  void runScenario(ctx, { boot, state: priorState, obsPath, statePath }).catch((fatal) => {
    try {
      writeFileSync(obsPath, JSON.stringify({ boot, done: true, fatal: describeError(fatal), results: {} }, null, 2))
    } catch {
      /* the harness times out and reports the missing file */
    }
  })
}

/**
 * @param {object} ctx
 * @param {object} env
 * @param {number} env.boot
 * @param {object|null} env.state
 * @param {string} env.obsPath
 * @param {string} env.statePath
 */
async function runScenario(ctx, env) {
  const { boot, state, obsPath, statePath } = env
  const results = {
    services: {},
    creation: {},
    tighten: {},
    disappear: {},
    resume: {},
  }
  const writeObs = () => {
    writeFileSync(obsPath, JSON.stringify({ boot, done: false, fatal: null, results }, null, 2))
  }

  // Let the whole plugin tree settle before creating any agent so the
  // scoped world is not composed against half-mounted services (same
  // pattern as the headless runner).
  const loader = ctx.get('loader')
  if (loader !== undefined && typeof loader.await === 'function') {
    await loader.await()
  }

  const agents = ctx.get('agents')
  const defaultModel = ctx.get('agentDefaultModel')
  const tools = ctx.get('tools')
  const skills = ctx.get('skills')
  const sessions = ctx.get('sessions')
  results.services = {
    agents: agents !== undefined,
    agentDefaultModel: defaultModel !== undefined,
    tools: tools !== undefined,
    skills: skills !== undefined,
    sessions: sessions !== undefined,
  }
  if (agents === undefined || defaultModel === undefined || tools === undefined || skills === undefined || sessions === undefined) {
    throw new Error(`p2t4: missing core services ${JSON.stringify(results.services)}`)
  }

  const selection = defaultModel.currentSelection()
  results.services.selection = { provider: selection.provider, model: selection.model }

  let mcpPort = null
  try {
    mcpPort = Number(readFileSync(join(process.env.DSH_HOME, MCP_PORT_REL), 'utf8').trim())
  } catch {
    mcpPort = null
  }
  results.services.mcpPort = mcpPort

  // ---- global baseline tool (inherited by every agent scope) ----
  const globalDisposer = tools.register(makeTool('p2t4_global', (args) => ({ origin: 'global', msg: args.msg })))
  const globalNames0 = tools.schemas().map((s) => s.name)
  results.creation.globalBaseline = {
    registered: true,
    inGlobalView: globalNames0.includes('p2t4_global'),
    globalToolCount: globalNames0.length,
  }

  let sessionId
  let handle
  let world
  try {
    if (boot === 1) {
      sessionId = `p2t4-session-${randomUUID()}`
      handle = await agents.create({
        sessionId: SessionId(sessionId),
        meta: { cwd: process.cwd() },
        agentOptions: { provider: selection.provider, model: selection.model },
        setup: async (agentCtx) => {
          world = createWorld(agentCtx, 'A', mcpPort, skills)
          const selected = { current: selection, assembled: undefined }
          installModelSelection(agentCtx, selected)
          // Await the MCP instance fiber inside setup: activation blocks on
          // connection + tool discovery, so the tools exist before
          // publication (setup is composition-only, but it may await work).
          // A startup rejection is recorded instead of killing the boot.
          if (world.mcpFiber !== null) {
            try {
              await world.mcpFiber
            } catch (error) {
              world.mcpMount = { threw: true, message: describeError(error) }
              world.mcpFiber = null
            }
          }
        },
      })
    } else {
      if (state === null || typeof state.sessionId !== 'string') {
        throw new Error('p2t4 boot 2: state file from boot 1 is missing or incomplete')
      }
      sessionId = state.sessionId
      handle = await agents.resume({
        resumeSessionId: SessionId(sessionId),
        agentOptions: { provider: selection.provider, model: selection.model },
        setup: async (agentCtx) => {
          world = createWorld(agentCtx, 'R', mcpPort, skills)
          const selected = { current: selection, assembled: undefined }
          installModelSelection(agentCtx, selected)
          if (world.mcpFiber !== null) {
            try {
              await world.mcpFiber
            } catch (error) {
              world.mcpMount = { threw: true, message: describeError(error) }
              world.mcpFiber = null
            }
          }
        },
      })
    }
    const agent = handle.agent
    writeObs()

    if (boot === 2) {
      // Durable history survived the process restart: the pre-restart
      // turn/step events from boot 1 must be in the resumed session log.
      const events = agent.session.events
      const preRestart = state.eventTypes ?? []
      const firstStepStart = events.findIndex((e) => e.type === 'step/start')
      results.resume.durableHistory = {
        eventCount: events.length,
        firstStepStartSeq: firstStepStart,
        expectedFirstStepStartSeq: state.firstStepStartSeq ?? null,
        preRestartEventTypes: preRestart.slice(0, 60),
        hasPreRestartTurnStart: preRestart.includes('turn/start'),
        hasPreRestartStepStart: preRestart.includes('step/start'),
        log: events.slice(0, 40).map((e) => `${e.seq}:${e.type}`),
      }
      writeObs()
    }

    // ---------------- creation ----------------
    const agentCtx = agent.ctx
    const agentNames = names(agentCtx.tools.schemas(agent))
    const globalNames1 = names(tools.schemas())
    results.creation.tool = {
      scopedToolInAgentView: agentNames.includes('p2t4_echo'),
      globalInheritedInAgentView: agentNames.includes('p2t4_global'),
      scopedToolHiddenFromGlobal: !globalNames1.includes('p2t4_echo'),
      agentView: agentNames,
    }
    const agentSkillSnap = await skills.snapshot({ scope: agent })
    const globalSkillSnap = await skills.snapshot()
    results.creation.skills = {
      propAccess: world.skillsPropAccess,
      agentGetAvailable: world.skillsAgentGetAvailable,
      registeredVia: world.skillRegisteredVia,
      scopedSkillInAgentScope: agentSkillSnap.skills.some((s) => s.name === 'p2t4-probe-skill'),
      scopedSkillHiddenFromGlobal: !globalSkillSnap.skills.some((s) => s.name === 'p2t4-probe-skill'),
      agentScopeSkillNames: agentSkillSnap.skills.map((s) => s.name),
      globalSkillCount: globalSkillSnap.skills.length,
    }
    const mcpToolName = 'mcp__p2t4mini__ping'
    results.creation.mcp = {
      mount: world.mcpMount === null ? { ok: true } : world.mcpMount,
      mcpToolInAgentView: agentNames.includes(mcpToolName),
      mcpToolHiddenFromGlobal: !globalNames1.includes(mcpToolName),
    }

    // pre-execute: allow path (scoped listener delegates to next()).
    const allowExec = await execTool(agentCtx, agent, 'p2t4_echo', { msg: 'allow-probe' }, 'p2t4-allow')
    results.creation.preExecute = { allow: execFact(allowExec) }

    // pre-execute: ask path — no approval answerer in this session must
    // fail closed (ask -> denial), naming the probe.
    world.policy.ask.add('p2t4_gate')
    const askExec = await execTool(agentCtx, agent, 'p2t4_gate', { msg: 'ask-probe' }, 'p2t4-ask')
    results.creation.preExecute.ask = execFact(askExec)
    world.policy.ask.delete('p2t4_gate')

    // pre-step: enter path — followup wakes the driver; the scoped
    // listener delegates (next() -> default enter); the loop appends
    // turn/start + step/start + user/message durably before the model
    // call, which fails contained (no API key in this DSH_HOME).
    if (boot === 1) {
      const before = agent.session.seq
      agent.followup(userMsg('p2t4: turn one (creation pre-step)'))
      const idle = await raceIdle(agent, world)
      const afterEvents = agent.session.events
      const stepStarts = afterEvents.map((e) => e.type).filter((t) => t === 'step/start').length
      results.creation.preStep = {
        ...idle,
        newEvents: afterEvents.slice(before).map((e) => `${e.seq}:${e.type}`),
        stepStartCountAfter: stepStarts,
        turnEndReasons: afterEvents.filter((e) => e.type === 'turn/end').map((e) => e.data?.reason?.kind),
        agentErrors: world.obs.agentErrors.slice(),
        statusAfter: String(agent.status),
      }
      const firstStepStart = afterEvents.findIndex((e) => e.type === 'step/start')
      world.firstStepStartSeq = firstStepStart
      writeObs()
    } else {
      // Boot 2 pre-step: one enter turn AFTER resume proves the loop is
      // alive and appends a fresh step/start after the durable history.
      const beforeResumeTurn = agent.session.seq
      agent.followup(userMsg('p2t4: resume enter turn'))
      const idleResume = await raceIdle(agent, world)
      const resumeAfterEvents = agent.session.events
      results.resume.preStepAfterResume = {
        ...idleResume,
        newEvents: resumeAfterEvents.slice(beforeResumeTurn).map((e) => `${e.seq}:${e.type}`),
        newStepStart: resumeAfterEvents.slice(beforeResumeTurn).some((e) => e.type === 'step/start'),
        lastStepStartSeq: resumeAfterEvents.reduce((acc, e, i) => (e.type === 'step/start' ? i : acc), -1),
        turnEndReasons: resumeAfterEvents.slice(beforeResumeTurn).filter((e) => e.type === 'turn/end').map((e) => e.data?.reason?.kind),
        agentErrors: world.obs.agentErrors.slice(),
        statusAfter: String(agent.status),
      }
      writeObs()
    }

    // MCP round-trip: execute the server-qualified tool through the full
    // agent-scoped pipeline.
    const mcpExec = await execTool(agentCtx, agent, mcpToolName, { msg: 'hello-mcp' }, 'p2t4-mcp')
    results.creation.mcp.call = execFact(mcpExec)

    // MCP negative control 1: duplicate serverName inside the SAME agent
    // scope must be mutually exclusive (namespace reservation throws).
    let dup
    try {
      await agentCtx.plugin(mcpClient, mcpConfig(mcpPort, 'p2t4mini'))
      dup = { rejected: false, message: 'second instance activated — mutual exclusion FAILED' }
    } catch (error) {
      dup = { rejected: true, message: describeError(error) }
    }
    results.creation.mcp.duplicateSameScope = dup

    // MCP negative control 2 (boot 1 only): failOnStartupError against a
    // dead endpoint must reject agent creation and roll the unpublished
    // agent back — no agent, no session published.
    if (boot === 1) {
      const rollbackId = `p2t4-rollback-${randomUUID()}`
      let rollback
      try {
        await agents.create({
          sessionId: SessionId(rollbackId),
          meta: { cwd: process.cwd() },
          agentOptions: { provider: selection.provider, model: selection.model },
          setup: async (agentCtx2) => {
            const selected = { current: selection, assembled: undefined }
            installModelSelection(agentCtx2, selected)
            // Dead endpoint + failOnStartupError: the instance fiber rejects,
            // the setup await throws, and creation must roll back without
            // publishing the agent or its session.
            await agentCtx2.plugin(mcpClient, mcpConfig(null, 'p2t4dead', { deadPort: true }))
          },
        })
        rollback = { rejected: false, message: 'create resolved — startup failure did not reject (unexpected)' }
      } catch (error) {
        rollback = { rejected: true, message: describeError(error) }
      }
      results.creation.mcp.failOnStartupRollback = {
        ...rollback,
        agentPublished: agents.get(SessionId(rollbackId)) !== undefined,
        sessionExists: sessions.get(SessionId(rollbackId)) !== undefined,
      }
      writeObs()
    }

    // Cross-agent isolation + agent-scoped namespace reuse (boot 1 only):
    // agent B must not see A's scoped tool, but MAY reuse the same MCP
    // serverName in its own scope.
    if (boot === 1) {
      let bMcpMount = null
      const handleB = await agents.create({
        sessionId: SessionId(`p2t4-session-b-${randomUUID()}`),
        meta: { cwd: process.cwd() },
        agentOptions: { provider: selection.provider, model: selection.model },
        setup: async (agentCtxB) => {
          const selected = { current: selection, assembled: undefined }
          installModelSelection(agentCtxB, selected)
          // Same serverName, different agent scope: the namespace MAY be
          // reused across agents (mutual exclusion is per-scope). A startup
          // rejection is recorded instead of killing the boot.
          try {
            await agentCtxB.plugin(mcpClient, mcpConfig(mcpPort, 'p2t4mini'))
          } catch (error) {
            bMcpMount = { threw: true, message: describeError(error) }
          }
        },
      })
      const agentB = handleB.agent
      const bNames = names(agentB.ctx.tools.schemas(agentB))
      results.creation.isolation = {
        bViewExcludesScopedToolOfA: !bNames.includes('p2t4_echo'),
        bViewIncludesGlobalTool: bNames.includes('p2t4_global'),
        bMcpSameNameAllowed: bNames.includes(mcpToolName),
        bMcpMount: bMcpMount === null ? { ok: true } : bMcpMount,
        bView: bNames,
      }
      await handleB.dispose()
      results.creation.isolation.bDisposedRegistryGone = agents.get(agentB.id) === undefined
      writeObs()
    }

    // ---------------- tighten ----------------
    if (boot === 1) {
      // Tool visibility tighten: a scoped restriction over the INHERITED
      // surface (global p2t4_global) — own-layer tools stay exempt.
      const restrictDisposer = agentCtx.tools.restrict({ deny: ['p2t4_global'] })
      const restrictedNames = names(agentCtx.tools.schemas(agent))
      const globalAfter = names(tools.schemas())
      const execRestricted = await execTool(agentCtx, agent, 'p2t4_global', { msg: 'now-denied' }, 'p2t4-restrict')
      results.tighten.tool = {
        restrictHidesInherited: !restrictedNames.includes('p2t4_global'),
        ownLayerExempt: restrictedNames.includes('p2t4_echo'),
        globalViewUnaffected: globalAfter.includes('p2t4_global'),
        agentViewAfter: restrictedNames,
        executeInheritedNowFails: execFact(execRestricted),
      }
      void restrictDisposer

      // Pre-execute tighten: flip the mutable admission policy after
      // publication — the same call that allowed at creation now denies.
      world.policy.deny.add('p2t4_echo')
      const denyExec = await execTool(agentCtx, agent, 'p2t4_echo', { msg: 'tighten-probe' }, 'p2t4-deny')
      world.policy.deny.delete('p2t4_echo')
      results.tighten.preExecute = { denyAfterFlip: execFact(denyExec) }

      // Pre-step tighten: reject mode closes the turn without a step.
      world.policy.preStep = 'reject'
      const beforeReject = agent.session.events.map((e) => e.type).filter((t) => t === 'step/start').length
      agent.followup(userMsg('p2t4: turn two (tighten pre-step reject)'))
      const idleReject = await raceIdle(agent, world)
      const afterReject = agent.session.events
      const stepStartsReject = afterReject.map((e) => e.type).filter((t) => t === 'step/start').length
      const lastTurnEnd = [...afterReject].reverse().find((e) => e.type === 'turn/end')
      results.tighten.preStep = {
        ...idleReject,
        rejectCausedNoNewStepStart: stepStartsReject === beforeReject,
        stepStartsBefore: beforeReject,
        stepStartsAfter: stepStartsReject,
        lastTurnEndReason: lastTurnEnd ? lastTurnEnd.data?.reason?.kind : null,
        newEventTypes: afterReject.slice(agent.session.seq - 12).map((e) => e.type).slice(-12),
        statusAfter: String(agent.status),
      }
      world.policy.preStep = 'enter'
      writeObs()

      // Skills tighten: the registration disposer removes the scoped skill
      // while the global catalog is unaffected.
      world.skillDisposer()
      const skillAfter = await skills.snapshot({ scope: agent })
      results.tighten.skills = {
        disposerRemovesScoped: !skillAfter.skills.some((s) => s.name === 'p2t4-probe-skill'),
        agentScopeSkillNamesAfter: skillAfter.skills.map((s) => s.name),
      }

      // Post-publication registration attempt on agent.ctx (the doc says
      // contributions "reject registration afterward" — record verbatim).
      let lateTool
      let lateToolName = 'p2t4_late'
      try {
        const lateDisposer = agentCtx.tools.register(makeTool(lateToolName, (args) => ({ msg: args.msg })))
        const visible = names(agentCtx.tools.schemas(agent)).includes(lateToolName)
        lateDisposer()
        lateTool = { threw: false, visibleWhileAlive: visible }
      } catch (error) {
        lateTool = { threw: true, message: describeError(error) }
      }
      let lateSkill
      try {
        const lateSkills = agentCtx.get('skills')
        if (lateSkills === undefined) throw new Error('p2t4: agentCtx.get("skills") unavailable after publication')
        const lateSkillDisposer = lateSkills.register({
          name: 'p2t4-late-skill',
          description: 'P2-T4 post-publication skill attempt',
          content: '# late\n\nbody',
          provider: 'p2t4-probe',
        })
        lateSkill = { threw: false }
        lateSkillDisposer()
      } catch (error) {
        lateSkill = { threw: true, message: describeError(error) }
      }
      results.tighten.postPubRegistration = { tool: lateTool, skill: lateSkill }

      // MCP tighten: dispose the instance fiber (unregister tools, release
      // the namespace), then remount the same serverName (namespace free).
      if (world.mcpFiber !== null) {
        await world.mcpFiber.dispose()
        const afterDispose = names(agentCtx.tools.schemas(agent))
        results.tighten.mcp = { disposeRemovesTool: !afterDispose.includes(mcpToolName) }
        world.mcpFiber = agentCtx.plugin(mcpClient, mcpConfig(mcpPort, 'p2t4mini'))
        try {
          await world.mcpFiber
          const afterRemount = names(agentCtx.tools.schemas(agent))
          results.tighten.mcp.remountRestoresTool = afterRemount.includes(mcpToolName)
        } catch (error) {
          results.tighten.mcp.remountRestoresTool = false
          results.tighten.mcp.remountError = describeError(error)
        }
      } else {
        results.tighten.mcp = { skipped: true, reason: JSON.stringify(world.mcpMount) }
      }
      writeObs()
    } else {
      // Boot 2 tighten: the resumed scoped world honors the same controls.
      world.policy.deny.add('p2t4_echo')
      const denyExec = await execTool(agentCtx, agent, 'p2t4_echo', { msg: 'resume-deny-probe' }, 'p2t4-resume-deny')
      world.policy.deny.delete('p2t4_echo')
      results.tighten.preExecute = { denyAfterResumeFlip: execFact(denyExec) }
      writeObs()
    }

    // ---------------- capability disappear ----------------
    const eventsBeforeDispose = agent.session.events
    const flushResult = await sessionsFlush(sessions, agent.session)
    await handle.dispose()
    const disposedAgent = agent
    const staleExec = await execTool(agentCtx, disposedAgent, 'p2t4_echo', { msg: 'stale' }, 'p2t4-stale')
    let staleSkill
    try {
      const snap = await skills.snapshot({ scope: disposedAgent })
      staleSkill = { threw: false, scopedSkillGone: !snap.skills.some((s) => s.name === 'p2t4-probe-skill') }
    } catch (error) {
      staleSkill = { threw: true, message: describeError(error) }
    }
    let followupAfter
    try {
      disposedAgent.followup(userMsg('p2t4: after dispose'))
      followupAfter = { threw: false }
    } catch (error) {
      followupAfter = { threw: true, message: describeError(error) }
    }
    const registryAfter = agents.get(SessionId(sessionId))
    results.disappear = {
      sessionFlushedBeforeDispose: flushResult,
      registryGetAfterDispose: registryAfter === undefined ? 'undefined' : 'present',
      staleExecute: execFact(staleExec),
      staleSkillScope: staleSkill,
      followupAfterDispose: followupAfter,
      eventCountBeforeDispose: eventsBeforeDispose.length,
    }

    if (boot === 2) {
      results.resume.disappearAfterResume = results.disappear
      results.resume.tightenAfterResume = results.tighten.preExecute
      writeObs()
    }

    if (boot === 1) {
      // State channel for boot 2 (cold resume).
      const stateOut = {
        sessionId,
        selection: { provider: selection.provider, model: selection.model },
        mcpPort,
        firstStepStartSeq: world.firstStepStartSeq ?? null,
        eventTypes: eventsBeforeDispose.map((e) => e.type),
        eventCountAtDispose: eventsBeforeDispose.length,
        summary: {
          creation: results.creation,
          tighten: results.tighten,
        },
      }
      writeFileSync(statePath, JSON.stringify(stateOut, null, 2))
    }

    writeObs()
    writeFileSync(obsPath, JSON.stringify({ boot, done: true, fatal: null, results }, null, 2))
  } catch (fatal) {
    try {
      writeFileSync(obsPath, JSON.stringify({ boot, done: true, fatal: describeError(fatal), results }, null, 2))
    } catch {
      /* harness timeout reports the missing file */
    }
    throw fatal
  } finally {
    try {
      globalDisposer()
    } catch {
      /* global tool is fiber-scoped; it unwinds with the row at boot end anyway */
    }
  }
}

// ---------------- helpers ----------------

/**
 * One shared scoped world for one agent scope: scoped tools, scoped
 * admission listeners (pre-execute, pre-step), scoped error capture, a
 * scoped skill, and the agent-scoped MCP instance.
 * @param {object} agentCtx - the unpublished agent scope from setup().
 * @param {string} label
 * @param {number|null} mcpPort
 */
function createWorld(agentCtx, label, mcpPort, rootSkills) {
  const world = {
    label,
    policy: { deny: new Set(), ask: new Set(), preStep: 'enter' },
    obs: { preExecuteCalls: [], preStepCalls: [], agentErrors: [] },
    mcpMount: null,
    firstStepStartSeq: null,
    disposers: [],
  }
  world.echoDisposer = agentCtx.tools.register(makeTool('p2t4_echo', (args) => ({ origin: `scope-${label}`, msg: args.msg })))
  world.gateDisposer = agentCtx.tools.register(makeTool('p2t4_gate', (args) => ({ origin: `scope-${label}`, msg: args.msg })))
  world.disposers.push(world.echoDisposer, world.gateDisposer)

  world.preExecDisposer = agentCtx.on('tools/pre-execute', (exec, next) => {
    const mode = world.policy.deny.has(exec.name) ? 'deny' : world.policy.ask.has(exec.name) ? 'ask' : 'allow'
    world.obs.preExecuteCalls.push({ name: exec.name, mode })
    if (world.policy.deny.has(exec.name)) {
      return Promise.resolve({ kind: 'deny', reason: `p2t4-policy(${label}): ${exec.name} denied by the agent-scoped pre-execute listener` })
    }
    if (world.policy.ask.has(exec.name)) {
      return Promise.resolve({ kind: 'ask', reason: `p2t4-policy(${label}): ${exec.name} asks for approval` })
    }
    return next()
  })
  world.disposers.push(world.preExecDisposer)

  world.preStepDisposer = agentCtx.on('agent/pre-step', (payload, next) => {
    world.obs.preStepCalls.push({ turn: payload.turn, step: payload.step, mode: world.policy.preStep, messageCount: payload.messages.length })
    if (world.policy.preStep === 'reject') return Promise.resolve({ kind: 'reject' })
    return next()
  })
  world.disposers.push(world.preStepDisposer)

  world.errorDisposer = agentCtx.on('agent/error', (payload) => {
    world.obs.agentErrors.push({ turn: payload.turn, step: payload.step, error: describeError(payload.error) })
  })
  world.disposers.push(world.errorDisposer)

  // Skills write path — public surface only. Property access on the
  // agent-scope ctx is topology-sensitive (the skills impl may sit off the
  // scope fiber's ancestor chain), so record whether it resolves; then
  // register through `ctx.get('skills')` — the strict global-store read
  // returns a wrapper bound to THIS ctx, so register() resolves its layer
  // from the caller's scope and the skill lands in the agent scope alone.
  // A root-level fallback would land globally and is recorded distinctly.
  world.skillsPropAccess = { threw: false }
  try {
    void agentCtx.skills
  } catch (error) {
    world.skillsPropAccess = { threw: true, message: describeError(error) }
  }
  let agentSkills
  try {
    agentSkills = agentCtx.get('skills')
  } catch (error) {
    agentSkills = undefined
    world.skillsPropAccess.agentGetThrew = describeError(error)
  }
  world.skillsAgentGetAvailable = agentSkills !== undefined
  const skillDef = {
    name: 'p2t4-probe-skill',
    description: `P2-T4 scoped probe skill (${label})`,
    content: `# P2-T4 probe skill (${label})\n\nScoped skill body for agent-scope control characterization.`,
    provider: 'p2t4-probe',
  }
  if (agentSkills !== undefined) {
    world.skillDisposer = agentSkills.register(skillDef)
    world.skillRegisteredVia = 'agentGet'
  } else {
    world.skillDisposer = rootSkills.register(skillDef)
    world.skillRegisteredVia = 'globalFallback'
  }
  world.disposers.push(world.skillDisposer)

  // MCP instance fiber: a synchronous mount failure is recorded, not fatal;
  // an activation rejection is caught by the setup awaiters.
  try {
    world.mcpFiber = agentCtx.plugin(mcpClient, mcpConfig(mcpPort, 'p2t4mini'))
  } catch (error) {
    world.mcpFiber = null
    world.mcpMount = { threw: true, message: describeError(error) }
  }
  return world
}

/**
 * @param {unknown} args
 * @returns {object} one registered probe tool definition (public surface only).
 */
function makeTool(name, body) {
  return {
    name,
    description: `P2-T4 characterization probe tool ${name}`,
    parameters: {
      type: 'object',
      properties: { msg: { type: 'string' } },
      required: ['msg'],
      additionalProperties: false,
    },
    output: {
      schema: {
        type: 'object',
        properties: { origin: { type: 'string' }, msg: { type: 'string' } },
        required: ['origin', 'msg'],
        additionalProperties: false,
      },
      render(args, value) {
        return [{ type: 'text', text: `${value.origin}: ${value.msg}` }]
      },
    },
    execute(args) {
      return body(args)
    },
  }
}

/**
 * @param {number|null} mcpPort - live mini-server port, or null for a dead endpoint.
 * @param {string} serverName
 * @param {object} [opts]
 */
function mcpConfig(mcpPort, serverName, opts = {}) {
  const port = opts.deadPort ? 3999 : mcpPort
  if (port === null || port === undefined || !Number.isFinite(port)) {
    throw new Error('p2t4: no MCP port available (harness must write p2t4-mcp-port.txt before boot)')
  }
  return {
    transport: 'streamable-http',
    serverName,
    url: `http://127.0.0.1:${port}/mcp`,
    headers: {},
    toolCallTimeoutMs: 15_000,
    failOnStartupError: true,
  }
}

/**
 * @param {object} agentCtx
 * @param {object} agent
 * @param {string} name
 * @param {object} args
 * @param {string} callId
 */
async function execTool(agentCtx, agent, name, args, callId) {
  const controller = new AbortController()
  try {
    const result = await agentCtx.tools.execute({ callId, name, arguments: args, agent, signal: controller.signal })
    return { rejected: false, result: summarizeResult(result) }
  } catch (error) {
    return { rejected: true, error: describeError(error) }
  }
}

/**
 * @param {object} result - settled ToolExecutionResult (plain, frozen).
 */
function summarizeResult(result) {
  const texts = []
  for (const block of result.content ?? []) {
    if (block && block.type === 'text' && typeof block.text === 'string') texts.push(block.text)
  }
  return {
    isError: result.isError === true,
    value: result.value === undefined ? null : result.value,
    contentText: texts.join(' | ').slice(0, 400),
    error: result.error === undefined ? null : describeError(result.error),
  }
}

/** @param {object} exec - execTool() outcome. */
function execFact(exec) {
  if (exec.rejected) return { failed: true, kind: 'rejected', detail: exec.error }
  return { failed: exec.result.isError, kind: exec.result.isError ? 'error-result' : 'success', detail: exec.result.error ?? exec.result.contentText, value: exec.result.value }
}

/** @param {string} text */
function userMsg(text) {
  return createUserMessage({ content: [{ type: 'text', text }], source: { kind: 'user' } })
}

/**
 * @param {object} agent
 * @param {object} world
 * @returns {Promise<{timedOut: boolean, canceled: boolean}>}
 */
async function raceIdle(agent, world) {
  const timeout = new Promise((resolve) => {
    setTimeout(() => resolve('timeout'), IDLE_TIMEOUT_MS)
  })
  const outcome = await Promise.race([agent.whenIdle().then(() => 'idle'), timeout])
  if (outcome === 'idle') return { timedOut: false, canceled: false }
  try {
    agent.cancel({ kind: 'user' })
    await Promise.race([agent.whenIdle().then(() => 'idle'), new Promise((resolve) => setTimeout(() => resolve('timeout2'), 30_000))])
  } catch {
    /* cancel is contained at the driver boundary */
  }
  return { timedOut: true, canceled: true }
}

/**
 * @param {object} sessions
 * @param {object} session
 */
async function sessionsFlush(sessions, session) {
  try {
    await sessions.flush(session)
    return true
  } catch (error) {
    return `flush failed: ${describeError(error)}`
  }
}

/** @param {unknown} value - any leaf/error value crossing the file boundary. */
function describeError(value) {
  if (value === undefined) return 'undefined'
  if (value === null) return 'null'
  if (value instanceof Error) {
    const code = value.code === undefined ? '' : ` [code=${value.code}]`
    return `${value.name}: ${value.message}${code}`
  }
  if (typeof value === 'string') return value.slice(0, 500)
  try {
    return JSON.stringify(value)?.slice(0, 500) ?? String(value).slice(0, 500)
  } catch {
    return String(value).slice(0, 500)
  }
}

/** @param {Array<{name: string}>} schemas */
function names(schemas) {
  return (schemas ?? []).map((s) => s.name)
}
