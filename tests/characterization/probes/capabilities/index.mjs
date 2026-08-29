/**
 * P2-T4 probe group — `capabilities`.
 *
 * Agent-scope control of the five capability seams (TaskDoc §11.3):
 * pre-step, pre-execute, tool visibility, skills, MCP — each along the four
 * lifecycle dimensions creation / cold resume / tighten / capability
 * disappear. The group is the harness-side half of the probe; the payload
 * (`plugins/capability-scenario.js`) is a self-driving plugin row mounted
 * through the public `cordis.patch.yml` seam that composes, executes,
 * tightens, and disposes an agent-scoped capability world and writes plain
 * observation JSON to a file channel under the dedicated DSH_HOME.
 *
 * This orchestrator (harness process; node: + relative imports only — the
 * C4 static scan enforces that on every group index.mjs):
 *   0. statically whitelist-scans the payload against the LIVE public
 *      surface (same check the smoke group applies to its own plugins);
 *   1. captures the pre-group patch-layer bytes (restored in `finally`);
 *   2. starts a minimal streamable-http MCP server (loopback, auxiliary
 *      port 3491..3495) exposing one `ping` tool — the only MCP endpoint
 *      the scenario needs; the chosen port crosses to the payload through
 *      a file channel (the patch seam carries no config channel);
 *   3. mounts the probe row, proves it appears in the composed tree
 *      (`--dump-config`), then runs TWO boots:
 *        boot 1 — creation + tighten + capability disappear (agent A);
 *        boot 2 — cold resume of boot 1's persisted session, recomposed
 *                 scoped world, tighten + disappear again (agent R);
 *   4. polls the per-boot observation channel (250 ms, 240 s cap) and
 *      asserts every matrix cell from the payload's recorded facts;
 *   5. closes the mini server and restores the exact pre-group patch
 *      layer in `finally` (the group leaves the instance stopped and no
 *      channel files behind).
 *
 * Negative controls are runtime denials observed in the scenario (scoped
 * pre-execute deny/ask, same-scope MCP namespace clash, failOnStartupError
 * rollback, inherited-tool restrict, disposed-agent staleness) — no
 * whitelist-violating fixtures, so this group adds zero scanner findings
 * on top of the smoke group's single expected one.
 */
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { join } from 'node:path'
import { DshInstance, ensureProfile } from '../../lib/instance.mjs'
import { extractSpecifiers } from '../../lib/private-import.mjs'
import { checkSpecifier, matchPackageName } from '../../lib/public-surface.mjs'

const PAYLOAD_REL = 'probes/capabilities/plugins/capability-scenario.js'
const ROW = { id: 'p2t4-capabilities-probe', rel: PAYLOAD_REL }
const OBS_REL = 'p2t4-observations.json'
const STATE_REL = 'p2t4-state.json'
const PORT_REL = 'p2t4-mcp-port.txt'
const MCP_PORT_CANDIDATES = [3491, 3492, 3493, 3494, 3495]
const BOOT_TIMEOUT_MS = 240_000
const POLL_MS = 250

export default {
  name: 'capabilities',
  description:
    'P2-T4: agent-scope control of pre-step / pre-execute / tool visibility / skills / MCP across creation, cold resume, tighten, capability disappear',

  /**
   * @param {object} ctx - harness context (see lib/harness-core.mjs)
   */
  async run(ctx) {
    const { config, instance, check, log } = ctx
    const dshHome = config.dshHome
    const obsPath = join(dshHome, OBS_REL)
    const statePath = join(dshHome, STATE_REL)
    const portPath = join(dshHome, PORT_REL)
    const evidenceDir = config.logDir

    // 0. Static whitelist scan of the payload against the live surface.
    const payloadSource = readFileSync(join(ctx.harnessRoot, PAYLOAD_REL), 'utf8')
    const specs = extractSpecifiers(payloadSource)
    const upstreamSpecs = specs.filter((s) => matchPackageName(s.spec, ctx.surface) !== undefined)
    check(
      upstreamSpecs.length >= 3,
      `payload carries >=3 upstream imports (${upstreamSpecs.map((s) => s.spec).join(', ')})`,
    )
    const denied = upstreamSpecs.filter((s) => !checkSpecifier(s.spec, ctx.surface).admitted)
    check(denied.length === 0, 'payload upstream imports all admitted by the live public surface (static)')
    for (const s of denied) log(`  rejected: "${s.spec}" — ${checkSpecifier(s.spec, ctx.surface).reason}`)

    // 1. Capture the pre-group patch-layer bytes (restored in `finally`).
    const patchFile = instance.patchFile
    const priorPatch = existsSync(patchFile) ? readFileSync(patchFile, 'utf8') : null

    // 2. Fresh channel state (stale files from an earlier run must not leak
    //    into this run's boot detection), then the mini MCP endpoint.
    for (const p of [obsPath, statePath, portPath]) rmSync(p, { force: true })
    const mini = await startMiniMcpServer()
    writeFileSync(portPath, `${mini.port}\n`)
    check(true, `mini MCP streamable-http server listening on 127.0.0.1:${mini.port} (auxiliary; closed in finally)`)
    log(`  evidence: mini MCP port = ${mini.port}`)

    let boot1 = null
    let boot2 = null
    try {
      // 3. Profile + row mounting.
      if (!instance.profileInitialized()) {
        const { initialized } = await ensureProfile({ instance, log, timeoutMs: 90_000 })
        check(initialized, 'web profile ready under dedicated DSH_HOME')
      }
      instance.mountRows([{ id: ROW.id, name: ctx.pluginUrl(ROW.rel) }], [
        'P2-T4 capabilities probe row. Revert: replace with [].',
      ])
      const dump = await instance.dumpConfig()
      check(
        DshInstance.rowInDump(dump.text, { id: ROW.id, name: ctx.pluginUrl(ROW.rel) }),
        'dump-config: capabilities probe row present in the composed profile tree (public seam carries it)',
      )

      // 4. Boot 1: creation + tighten + capability disappear.
      boot1 = await runBoot(ctx, 1)
      writeFileSync(join(evidenceDir, 'p2t4-observations-boot1.json'), JSON.stringify(boot1, null, 2))
      assertBoot1(boot1, check, log)

      // 5. Boot 2: cold resume of the persisted boot-1 session.
      check(existsSync(statePath), 'boot 1 wrote the state channel (sessionId survives the process restart)')
      boot2 = await runBoot(ctx, 2)
      writeFileSync(join(evidenceDir, 'p2t4-observations-boot2.json'), JSON.stringify(boot2, null, 2))
      if (existsSync(statePath)) {
        writeFileSync(join(evidenceDir, 'p2t4-state.json'), readFileSync(statePath, 'utf8'))
      }
      assertBoot2(boot2, check, log)
    } finally {
      await closeMiniServer(mini)
      // Exact pre-group patch-layer bytes (the group contributes no rows
      // to the dedicated DSH_HOME; the smoke group re-mounts its own row
      // afterwards).
      if (priorPatch === null) rmSync(patchFile, { force: true })
      else writeFileSync(patchFile, priorPatch)
      for (const p of [obsPath, statePath, portPath]) rmSync(p, { force: true })
      void boot1
      void boot2
    }
  },
}

// ---------------- boots ----------------

/**
 * One full instance lifecycle around one scenario boot: start (boot marker
 * = machine-level load proof), poll the observation channel to completion,
 * stop, port free. The boot number is part of the observation protocol so a
 * stale file can never satisfy the poll.
 * @param {object} ctx
 * @param {1|2} n
 */
async function runBoot(ctx, n) {
  const { instance, check, config } = ctx
  const obsPath = join(config.dshHome, OBS_REL)
  const boot = await instance.start({ timeoutMs: 120_000 })
  check(
    boot.url.startsWith(`http://127.0.0.1:${config.port}/?token=`),
    `boot ${n}: instance started at ${boot.url}`,
  )
  const obs = await pollObservations(obsPath, n)
  const stop = await instance.stop()
  check(stop.portFree, `boot ${n}: instance stopped, port ${config.port} freed`)
  if (obs.timedOut === true) {
    check(false, `boot ${n}: observation channel incomplete after ${BOOT_TIMEOUT_MS}ms`)
  } else if (obs.fatal !== null && obs.fatal !== undefined) {
    check(false, `boot ${n}: scenario reported fatal: ${obs.fatal}`)
  }
  return obs
}

/**
 * Poll the observation file until it reports `{ boot: n, done: true }` or
 * the cap expires; on expiry return the last readable shape (or a synthetic
 * timeout shape) so the cell asserts still run and record failures.
 * @param {string} obsPath
 * @param {1|2} boot
 */
async function pollObservations(obsPath, boot) {
  const deadline = Date.now() + BOOT_TIMEOUT_MS
  while (Date.now() < deadline) {
    try {
      const obs = JSON.parse(readFileSync(obsPath, 'utf8'))
      if (obs !== null && typeof obs === 'object' && obs.boot === boot && obs.done === true) return obs
    } catch {
      /* not written (or mid-write) yet */
    }
    await new Promise((resolve) => setTimeout(resolve, POLL_MS))
  }
  try {
    const obs = JSON.parse(readFileSync(obsPath, 'utf8'))
    if (obs !== null && typeof obs === 'object') return { ...obs, timedOut: true }
  } catch {
    /* no readable file at all */
  }
  return { boot, done: false, timedOut: true, fatal: `observation timeout (${BOOT_TIMEOUT_MS}ms)`, results: {} }
}

// ---------------- cell asserts ----------------

/** Read `a.b.c` from the observation without throwing on missing paths. */
function dig(obs, path) {
  let cur = obs
  for (const part of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = cur[part]
  }
  return cur
}

function assertBoot1(obs, check, log) {
  const r = (path) => dig(obs, `results.${path}`)
  check(dig(obs, 'fatal') === null, '[boot1] scenario completed without fatal')

  // --- creation ---
  check(r('creation.globalBaseline.inGlobalView') === true, '[tools/creation] global probe tool visible in the global view (public: tools.register in row scope)')
  check(r('creation.tool.scopedToolInAgentView') === true, '[tools/creation] scoped p2t4_echo visible in the agent view (public: register into the unpublished agent scope in setup)')
  check(r('creation.tool.globalInheritedInAgentView') === true, '[tools/creation] global tool inherited into the agent view')
  check(r('creation.tool.scopedToolHiddenFromGlobal') === true, '[tools/creation] scoped tool hidden from the global view (scope isolation)')
  log(`  evidence: agent tool view = ${JSON.stringify(r('creation.tool.agentView'))}`)
  check(r('creation.skills.agentGetAvailable') === true, '[skills/creation] agentCtx.get("skills") resolves from the agent-scope ctx (strict global-store read)')
  check(r('creation.skills.registeredVia') === 'agentGet', '[skills/creation] scoped skill registered through the agent-scope ctx binding (public: agentCtx.get("skills").register in setup)')
  check(r('creation.skills.propAccess.threw') === true, '[skills/creation] negative control: property access agentCtx.skills throws from the agent-scope ctx (topology-sensitive)')
  check(r('creation.skills.scopedSkillInAgentScope') === true, '[skills/creation] scoped skill listed in the agent-scoped snapshot')
  check(r('creation.skills.scopedSkillHiddenFromGlobal') === true, '[skills/creation] scoped skill absent from the global snapshot')
  log(`  evidence: skills write path = ${JSON.stringify({ propAccess: r('creation.skills.propAccess'), registeredVia: r('creation.skills.registeredVia') })}`)
  check(r('creation.mcp.mcpToolInAgentView') === true, '[mcp/creation] mcp__p2t4mini__ping visible in the agent view (public: agent-scoped mcp-client instance)')
  check(r('creation.mcp.mcpToolHiddenFromGlobal') === true, '[mcp/creation] MCP tool hidden from the global view')
  check(r('creation.mcp.call.failed') === false, '[mcp/creation] MCP tool call succeeds through the agent-scoped pipeline')
  check(String(r('creation.mcp.call.detail')).includes('pong:hello-mcp'), '[mcp/creation] MCP round-trip echoed by the mini server (pong:hello-mcp)')
  check(r('creation.preExecute.allow.failed') === false, '[pre-execute/creation] allow path: scoped listener delegates via next(), execution succeeds')
  check(r('creation.preExecute.ask.failed') === true, '[pre-execute/creation] ask path without approval answerer fails closed (public: PreToolDecision kind=ask)')
  log(`  evidence: ask denial = ${JSON.stringify(r('creation.preExecute.ask.detail'))}`)
  check(Number(r('creation.preStep.stepStartCountAfter')) >= 1, '[pre-step/creation] enter path produced a step (step/start appended durably)')
  check((r('creation.preStep.newEvents') ?? []).some((e) => String(e).endsWith(':step/start')), '[pre-step/creation] new events include step/start (public: agent/pre-step waterfall, default enter)')
  check(r('creation.preStep.statusAfter') === 'idle', '[pre-step/creation] driver idle after the turn (model call failed contained — no key in this DSH_HOME)')
  check(r('creation.preStep.timedOut') === false, '[pre-step/creation] turn settled without the whenIdle guard timeout')
  log(`  evidence: creation turn events = ${JSON.stringify(r('creation.preStep.newEvents'))}`)
  log(`  evidence: creation turn ends = ${JSON.stringify(r('creation.preStep.turnEndReasons'))}`)
  check(r('creation.mcp.duplicateSameScope.rejected') === true, '[mcp/creation] duplicate serverName in the SAME scope is rejected (namespace reservation)')
  check(String(r('creation.mcp.duplicateSameScope.message')).includes('already in use'), '[mcp/creation] rejection names the in-use serverName')
  log(`  evidence: same-scope duplicate = ${JSON.stringify(r('creation.mcp.duplicateSameScope.message'))}`)
  check(r('creation.mcp.failOnStartupRollback.rejected') === true, '[mcp/creation] failOnStartupError against a dead endpoint rejects agent creation')
  check(r('creation.mcp.failOnStartupRollback.agentPublished') === false, '[mcp/creation] rolled-back creation published no agent')
  check(r('creation.mcp.failOnStartupRollback.sessionExists') === false, '[mcp/creation] rolled-back creation published no session')
  log(`  evidence: rollback = ${JSON.stringify(r('creation.mcp.failOnStartupRollback.message'))}`)
  check(r('creation.isolation.bViewExcludesScopedToolOfA') === true, '[tools/creation] cross-agent isolation: agent B cannot see A scoped tool')
  check(r('creation.isolation.bViewIncludesGlobalTool') === true, '[tools/creation] cross-agent: agent B inherits the global tool')
  check(r('creation.isolation.bMcpSameNameAllowed') === true, '[mcp/creation] cross-agent: the same MCP serverName MAY be reused in another agent scope')
  check(r('creation.isolation.bDisposedRegistryGone') === true, '[lifecycle/creation] disposed agent B removed from the agent registry')

  // --- tighten ---
  check(r('tighten.tool.restrictHidesInherited') === true, '[tools/tighten] scoped restrict({deny}) hides the INHERITED global tool from the agent view (public: tools.restrict)')
  check(r('tighten.tool.ownLayerExempt') === true, '[tools/tighten] own-layer scoped tool stays visible under the restriction')
  check(r('tighten.tool.globalViewUnaffected') === true, '[tools/tighten] restriction does not leak into the global view')
  check(r('tighten.tool.executeInheritedNowFails.failed') === true, '[tools/tighten] executing the restricted inherited tool now fails')
  check(r('tighten.preExecute.denyAfterFlip.failed') === true, '[pre-execute/tighten] mutable policy flip: the same call allowed at creation now denies')
  check(String(r('tighten.preExecute.denyAfterFlip.detail')).includes('p2t4-policy'), '[pre-execute/tighten] denial reason names the scoped policy listener')
  log(`  evidence: deny after flip = ${JSON.stringify(r('tighten.preExecute.denyAfterFlip.detail'))}`)
  check(r('tighten.preStep.rejectCausedNoNewStepStart') === true, '[pre-step/tighten] reject decision produces NO new step/start (public: PreStepDecision kind=reject)')
  check(r('tighten.preStep.lastTurnEndReason') === 'blocked', '[pre-step/tighten] rejected turn ends with reason blocked')
  log(`  evidence: tighten pre-step events = ${JSON.stringify(r('tighten.preStep.newEventTypes'))}`)
  check(r('tighten.skills.disposerRemovesScoped') === true, '[skills/tighten] registration disposer removes the scoped skill from the agent scope')
  log(`  evidence: post-publication registration (verbatim): ${JSON.stringify(r('tighten.postPubRegistration'))}`)
  check(r('tighten.mcp.disposeRemovesTool') === true, '[mcp/tighten] fiber.dispose() unregisters the MCP tools from the agent view')
  check(r('tighten.mcp.remountRestoresTool') === true, '[mcp/tighten] remounting the same serverName restores the tool (namespace released)')

  // --- capability disappear ---
  check(r('disappear.sessionFlushedBeforeDispose') === true, '[disappear] session flushed to durable storage before dispose')
  check(r('disappear.registryGetAfterDispose') === 'undefined', '[disappear] agents.get(sessionId) is undefined after dispose')
  check(r('disappear.staleExecute.failed') === true, '[disappear] executing a scoped tool through the disposed agent context fails')
  const staleSkill = r('disappear.staleSkillScope')
  check(
    staleSkill !== undefined && (staleSkill.scopedSkillGone === true || staleSkill.threw === true),
    '[skills/disappear] disposed agent scope no longer resolves the scoped skill (gone or hard error)',
  )
  log(`  evidence: stale skill scope = ${JSON.stringify(staleSkill)}`)
  log(`  evidence: followup after dispose = ${JSON.stringify(r('disappear.followupAfterDispose'))}`)
}

function assertBoot2(obs, check, log) {
  const r = (path) => dig(obs, `results.${path}`)
  check(dig(obs, 'fatal') === null, '[boot2] scenario completed without fatal')
  check(dig(obs, 'boot') === 2, '[boot2] observation channel reports boot 2 (cold resume)')

  // --- cold resume ---
  check(r('resume.durableHistory.hasPreRestartTurnStart') === true, '[resume] durable history: pre-restart turn/start retained after cold resume')
  check(r('resume.durableHistory.hasPreRestartStepStart') === true, '[resume] durable history: pre-restart step/start retained after cold resume')
  check(
    Number.isInteger(r('resume.durableHistory.firstStepStartSeq')) &&
      r('resume.durableHistory.firstStepStartSeq') === r('resume.durableHistory.expectedFirstStepStartSeq'),
    '[resume] resumed session log positions boot-1 step/start at the recorded index (same durable log)',
  )
  log(`  evidence: resumed log head = ${JSON.stringify(r('resume.durableHistory.log'))}`)
  check(r('resume.preStepAfterResume.newStepStart') === true, '[pre-step/resume] an enter turn after resume appends a fresh step/start (loop alive on the resumed session)')
  check(r('resume.preStepAfterResume.timedOut') === false, '[pre-step/resume] resumed turn settled without the whenIdle guard timeout')
  check(r('resume.preStepAfterResume.statusAfter') === 'idle', '[pre-step/resume] driver idle after the resumed turn')
  log(`  evidence: resume turn events = ${JSON.stringify(r('resume.preStepAfterResume.newEvents'))}`)
  check(r('resume.preStepAfterResume.turnEndReasons') !== undefined, '[pre-step/resume] turn ended (reasons recorded)')

  // --- tighten after resume ---
  check(r('tighten.preExecute.denyAfterResumeFlip.failed') === true, '[pre-execute/resume] policy flip on the recomposed world denies the same call')
  check(String(r('tighten.preExecute.denyAfterResumeFlip.detail')).includes('p2t4-policy'), '[pre-execute/resume] denial names the recomposed scoped listener')

  // --- disappear after resume ---
  check(r('resume.disappearAfterResume.registryGetAfterDispose') === 'undefined', '[disappear/resume] resumed agent gone from the registry after dispose')
  check(r('resume.disappearAfterResume.staleExecute.failed') === true, '[disappear/resume] stale execution through the disposed resumed agent fails')
  const staleSkill = r('resume.disappearAfterResume.staleSkillScope')
  check(
    staleSkill !== undefined && (staleSkill.scopedSkillGone === true || staleSkill.threw === true),
    '[skills/disappear/resume] disposed resumed scope no longer resolves the scoped skill',
  )
}

// ---------------- mini MCP endpoint ----------------

const MINI_TOOL = {
  name: 'ping',
  description: 'P2-T4 mini MCP echo tool',
  inputSchema: {
    type: 'object',
    properties: { msg: { type: 'string' } },
    required: ['msg'],
    additionalProperties: false,
  },
}

/**
 * One minimal streamable-http MCP endpoint: initialize / notifications /
 * tools/list / tools/call over plain JSON (Content-Type application/json,
 * no SSE). Sufficient for the mcp-client's startup handshake and one tool
 * round-trip; nothing else is served.
 */
function startMiniMcpServer() {
  return new Promise((resolve, reject) => {
    const server = createServer((req, res) => {
      if (req.method === 'DELETE' && req.url === '/mcp') {
        res.writeHead(200)
        res.end()
        return
      }
      if (req.method !== 'POST' || req.url !== '/mcp') {
        res.writeHead(404, { 'content-type': 'application/json' })
        res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32000, message: 'not found' } }))
        return
      }
      const chunks = []
      req.on('data', (c) => chunks.push(c))
      req.on('end', () => {
        let msg
        try {
          msg = JSON.parse(Buffer.concat(chunks).toString('utf8') || 'null')
        } catch {
          res.writeHead(400, { 'content-type': 'application/json' })
          res.end(JSON.stringify({ jsonrpc: '2.0', id: null, error: { code: -32700, message: 'parse error' } }))
          return
        }
        const reply = mcpRpc(msg)
        if (reply === null) {
          res.writeHead(202)
          res.end()
          return
        }
        res.writeHead(200, { 'content-type': 'application/json' })
        res.end(JSON.stringify(reply))
      })
    })
    const attempt = (i) => {
      if (i >= MCP_PORT_CANDIDATES.length) {
        reject(new Error(`p2t4: no free mini-MCP port among ${MCP_PORT_CANDIDATES.join(', ')}`))
        return
      }
      const port = MCP_PORT_CANDIDATES[i]
      const onError = (error) => {
        if (error.code === 'EADDRINUSE') attempt(i + 1)
        else reject(error)
      }
      server.once('error', onError)
      server.listen(port, '127.0.0.1', () => {
        server.removeListener('error', onError)
        resolve({ port, server })
      })
    }
    attempt(0)
  })
}

/** JSON-RPC dispatch for the mini endpoint. `null` = notification (202). */
function mcpRpc(msg) {
  const id = msg === null || typeof msg !== 'object' ? null : msg.id
  const method = msg === null || typeof msg !== 'object' ? undefined : msg.method
  const params = msg === null || typeof msg !== 'object' || msg.params === undefined ? {} : msg.params
  const ok = (result) => ({ jsonrpc: '2.0', id, result })
  const fail = (code, message) => ({ jsonrpc: '2.0', id, error: { code, message } })
  switch (method) {
    case 'initialize':
      return ok({
        protocolVersion: (params && params.protocolVersion) || '2025-06-18',
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'p2t4-mini-mcp', version: '0.0.1' },
      })
    case 'notifications/initialized':
    case 'notifications/cancelled':
      return null
    case 'tools/list':
      return ok({ tools: [MINI_TOOL] })
    case 'tools/call':
      if (params.name === 'ping') {
        const text = `pong:${String((params.arguments && params.arguments.msg) ?? '')}`
        return ok({ content: [{ type: 'text', text }], isError: false })
      }
      return fail(-32602, `unknown tool: ${String(params.name)}`)
    default:
      if (id === null) return null
      return fail(-32601, `method not found: ${String(method)}`)
  }
}

/** Close the mini server, swallowing a double close. */
function closeMiniServer(mini) {
  return new Promise((resolve) => {
    if (mini === null || mini === undefined || mini.server === undefined) return resolve()
    try {
      mini.server.close(() => resolve())
      // Belt and braces: unclosed keep-alive sockets must not hold the
      // harness process open.
      mini.server.closeAllConnections?.()
    } catch {
      resolve()
    }
  })
}
