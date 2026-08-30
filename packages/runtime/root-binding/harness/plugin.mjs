/**
 * plugin.mjs — P5-T5 (I-1) real-instance Cordis row: Team root FRESH and
 * COLD binding driven through DSH PUBLIC surfaces only.
 *
 * This row is mounted into the test instance's web profile patch layer
 * (`<DSH_HOME>/profiles/web/cordis.patch.yml` — the ONLY allowed seam;
 * see run.mjs + the evidence public-surfaces.md). It does not import any
 * DSH private/internal module: the static imports below are prebuilt
 * public packages (junction-farm resolved), and the dynamic imports are
 * the P5-T5/P3-T5/P4-T3/P4-T4/contracts/storage TS modules of THIS
 * repository, loaded through the worktree-relative TS resolution hook
 * (ts-loader.mjs, registered before the first dynamic import).
 *
 * Scenarios (driven by run.mjs over loopback HTTP, no real LLM calls):
 *
 *   S1 fresh Team root   — agents.create (plain, no preset) -> real overlay
 *      slots (persona = preset mount through the persona slot's prompt
 *      surface; model = real installModelSelection ref; capability =
 *      tools/skills/mini-MCP/pre-step listeners) -> bindFreshTeamRoot ->
 *      control-plane model select -> public verification (persona text,
 *      model read-back at the assembly boundary, tool + MCP visibility,
 *      session events, durable session publication, TeamDomain read-back).
 *   S3 admission closed  — same flow, admission policy 'closed': overlays
 *      install, the decision is rejected (admitted:false +
 *      ADMISSION_TEAM_POLICY_CLOSED), durable state stands, instance
 *      stays healthy.
 *   S4 ordinary root     — rehydrateColdTeamRoot on an unbound session:
 *      zero-effect no-op (noopReason 'ordinary', no events, no writes).
 *   S2 (boot 2) cold root — process restart: agents.resume of the S1 root
 *      (setup installs the model selection + mounts the preset, the
 *      app-faithful resume path), the model ref is re-seeded from the
 *      durable `model/selection` projection (the app's selectionFor
 *      pattern), rehydrateColdTeamRoot -> durable present (wrote:false),
 *      scope restored, re-admitted, zero durable writes.
 *
 * Directive file `<DSH_HOME>/p5t5-directive.json` (written by run.mjs
 * before EVERY boot; the row re-reads it on each process start):
 *
 *   { boot: 1|2,
 *     reportDir: string,
 *     runStamp: string,
 *     teamPersonaPresetId: string,
 *     mcpPort: number,
 *     resumeSessionId?: string,            // boot 2: the S1 root session
 *     sessionIds: { S1: string, S3: string, S4: string },
 *     blueprint: { blueprintId: string, revision: string, contentHash: string,
 *                  leaderPersona: string,
 *                  memberPersonas: Record<string, string>,
 *                  defaultModel: { provider: string, model: string },
 *                  defaultWorkspace?: string },
 *     capability: { toolsPermissions: {...}, skills: {...},
 *                   mcp: {...}, preStepPreExecute: {...} },
 *     admissionPolicyByScenario: { S1: 'open', S2: 'open',
 *                                  S3: 'closed', S4: 'open' } }
 *
 * Public surfaces consumed (name + origin recorded in the evidence
 * public-surfaces.md; the harness proves they are enough):
 *
 *   agents.create / agents.resume / handle.dispose
 *     — @deepseek-ai/dsh-agent (public agent lifecycle)
 *   agentPresets.resolve / mount / composedPreset
 *     — @deepseek-ai/dsh-agent-presets (public preset seam)
 *   systemPrompt.assemble({ scope })
 *     — @deepseek-ai/dsh-system-prompt (public prompt assembly boundary)
 *   scopeOf(agentCtx)
 *     — @deepseek-ai/dsh-scope (public scope key)
 *   installModelSelection(agentCtx, ref)
 *     — @deepseek-ai/dsh-agent (public agent-scoped model selection)
 *   sessionProjections.stateOf(session, 'modelSelection')
 *     — @deepseek-ai/dsh-session-projections (public projection read;
 *       the durable model/selection restore, app-faithful)
 *   agent.ctx.tools.register / .schemas / agent.ctx.get('skills').register
 *     — public agent-scoped capability seams (P2-T4 pinned)
 *   agent.ctx.plugin(mcpClient, cfg)
 *     — @deepseek-ai/dsh-mcp-client (public MCP fiber seam)
 *   agent.ctx.on('tools/pre-execute' | 'agent/pre-step')
 *     — public agent-scoped waterfall listeners (P2-T4 pinned)
 *   agent.session.append / .events / sessions.get(SessionId)
 *     — @deepseek-ai/dsh-session (public session surfaces)
 *   webServer.register({ kind: 'exact', path, handler })
 *     — @deepseek-ai/dsh-webserver (public host route seam)
 *   storageDomain.open(defineDomain(...)) / .closeAll()
 *     — @deepseek-ai/dsh-storage-domain (public durable KV domain form;
 *       routed to the DSH_HOME-resident json backend by the base bundle)
 *   <DSH_HOME>/sessions/<project>/<sessionId>/session.jsonl.zstd
 *     — public durable session artifact (disk read, no API)
 */

import { register } from 'node:module'
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { SessionId } from '@deepseek-ai/dsh-session'
import { scopeOf } from '@deepseek-ai/dsh-scope'
import { PERSONA_SECTION } from '@deepseek-ai/dsh-system-prompt'
import { installModelSelection } from '@deepseek-ai/dsh-agent'

// The TS resolution hook MUST be registered before the first dynamic TS
// import (it rewrites worktree-relative .js specifiers that have a .ts
// sibling). The static imports above are prebuilt packages only, so
// top-level registration is safe; the dynamic TS imports happen inside
// run(), after this line executes.
register(new URL('./ts-loader.mjs', import.meta.url), import.meta.url)

/** Cordis row identity (function-plugin protocol: named exports, no default). */
export const name = 'p5t5-root-binding'
/**
 * Hard service dependencies: the Loader defers this row's apply until all
 * three exist (P2 boot-A evidence: a bare early apply races
 * late-registering rows). The remaining services (systemPrompt,
 * agentPresets, sessions, sessionProjections) are resolved lazily at
 * request time — by then the full host is up.
 */
export const inject = ['agents', 'webServer', 'storageDomain']

const DIRECTIVE_NAME = 'p5t5-directive.json'
const SCENARIOS = ['S1', 'S2', 'S3', 'S4']

/**
 * Read the run directive (written by run.mjs before every boot).
 * @returns {object} the validated directive.
 */
function readDirective() {
  const home = process.env.DSH_HOME
  if (!home) throw new Error('p5t5: DSH_HOME is not set in the host process environment')
  const directive = JSON.parse(readFileSync(join(home, DIRECTIVE_NAME), 'utf8'))
  if (directive.boot !== 1 && directive.boot !== 2) {
    throw new Error(`p5t5: directive.boot must be 1 or 2 (got ${JSON.stringify(directive.boot)})`)
  }
  if (typeof directive.reportDir !== 'string' || directive.reportDir.length === 0) {
    throw new Error('p5t5: directive.reportDir is required')
  }
  if (typeof directive.teamPersonaPresetId !== 'string' || directive.teamPersonaPresetId.length === 0) {
    throw new Error('p5t5: directive.teamPersonaPresetId is required')
  }
  if (!Number.isInteger(directive.mcpPort) || directive.mcpPort < 1 || directive.mcpPort > 65535) {
    throw new Error(`p5t5: directive.mcpPort must be a port number (got ${JSON.stringify(directive.mcpPort)})`)
  }
  if (directive.boot === 2 && typeof directive.resumeSessionId !== 'string') {
    throw new Error('p5t5: boot 2 requires directive.resumeSessionId (the S1 root session)')
  }
  if (directive.boot === 1 && (directive.sessionIds === undefined ||
      directive.sessionIds.S1 === undefined || directive.sessionIds.S3 === undefined ||
      directive.sessionIds.S4 === undefined)) {
    throw new Error('p5t5: boot 1 requires directive.sessionIds.{S1,S3,S4}')
  }
  const bp = directive.blueprint
  if (bp === undefined || typeof bp.blueprintId !== 'string' || typeof bp.revision !== 'string' ||
      typeof bp.contentHash !== 'string' || typeof bp.leaderPersona !== 'string') {
    throw new Error('p5t5: directive.blueprint requires blueprintId/revision/contentHash/leaderPersona')
  }
  if (bp.defaultModel === undefined || typeof bp.defaultModel.provider !== 'string' ||
      typeof bp.defaultModel.model !== 'string') {
    throw new Error('p5t5: directive.blueprint.defaultModel requires provider/model')
  }
  if (directive.capability === undefined) throw new Error('p5t5: directive.capability is required')
  if (directive.admissionPolicyByScenario === undefined) {
    throw new Error('p5t5: directive.admissionPolicyByScenario is required')
  }
  return directive
}

/**
 * @param {object} a
 * @param {object} b
 * @returns {boolean} deep structural equality for plain JSON values.
 */
function deepEq(a, b) {
  return JSON.stringify(a) === JSON.stringify(b)
}

/** @param {Array<{name: string}>} schemas @returns {string[]} */
function names(schemas) {
  return (schemas ?? []).map((s) => s.name)
}

/**
 * Send one JSON response on the webserver route.
 * @param {import('node:http').ServerResponse} res
 * @param {number} status
 * @param {object} body
 */
function sendJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) })
  res.end(payload)
}

/** @param {import('node:http').IncomingMessage} req @returns {Promise<string>} */
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/**
 * The on-disk state of one session's durable log (the P2-T3 pinned
 * artifact layout). @param {string} sessionId @returns {object}
 */
function diskFilesFor(sessionId) {
  const home = process.env.DSH_HOME
  if (!home) return { error: 'no DSH_HOME' }
  try {
    const sessionsRoot = join(home, 'sessions')
    for (const pd of readdirSync(sessionsRoot, { withFileTypes: true }).filter((e) => e.isDirectory())) {
      const dir = join(sessionsRoot, pd.name, sessionId)
      let entries
      try {
        entries = readdirSync(dir, { withFileTypes: true })
      } catch {
        continue
      }
      return {
        projectDir: pd.name,
        files: entries.filter((e) => e.isFile()).map((e) => ({
          name: e.name,
          size: statSync(join(dir, e.name)).size,
          final: e.name === 'session.jsonl.zstd',
        })),
      }
    }
    return { found: false, sessionsRoot }
  } catch (error) {
    return { error: String(error?.message ?? error) }
  }
}

/**
 * Poll for the FINAL durable session artifact (write-behind publication;
 * an awaited flush is not a barrier — P2-T3 pinned limitation).
 * @param {string} sessionId
 * @param {number} timeoutMs
 * @returns {Promise<object>} the publication state.
 */
async function waitForDurable(sessionId, timeoutMs) {
  const startedAt = Date.now()
  for (;;) {
    const disk = diskFilesFor(sessionId)
    if (disk.files !== undefined) {
      const pub = disk.files.find((f) => f.final)
      if (pub !== undefined) {
        return { published: true, projectDir: disk.projectDir, waitMs: Date.now() - startedAt, size: pub.size }
      }
    }
    if (Date.now() - startedAt >= timeoutMs) {
      return { published: false, lastDisk: disk, waitMs: Date.now() - startedAt }
    }
    await new Promise((r) => { setTimeout(r, 100) })
  }
}

/**
 * Poll the agent-scoped tool schemas until the MCP-mounted tool is visible
 * (the MCP fiber activates asynchronously after the setup await — P2-T4).
 * @param {object} handle - the agent handle.
 * @param {string} toolName - the expected mounted tool name.
 * @param {number} timeoutMs
 * @returns {Promise<boolean>}
 */
async function waitForSchemaTool(handle, toolName, timeoutMs) {
  const startedAt = Date.now()
  for (;;) {
    const visible = names(handle.agent.ctx.tools.schemas(handle.agent)).includes(toolName)
    if (visible) return true
    if (Date.now() - startedAt >= timeoutMs) return false
    await new Promise((r) => { setTimeout(r, 250) })
  }
}

// ── module state (one row instance per process = per boot) ────────────────

/** @type {object} the validated directive of this boot. */
let directive
/** @type {Promise<void>} resolves when row setup finished (success or failure). */
let readyGate
/** @type {((() => void) | undefined)} */
let resolveReady
/** @type {string|null} setup failure (visible through /__p5t5/health). */
let setupError = null
/** @type {object|null} the storage-domain TeamDomain facade (boot 1 create / boot 2 open). */
let readHandle
/** @type {object|null} the scenario ports shared by this boot (read handle + write port + surface). */
let basePorts
/** @type {Array<object>} every durable write of this boot (audit trail). */
const writeLog = []
/** @type {Map<string, {installed: string[], restored?: object, restoreEffect?: string}>} live residency bookkeeping. */
const residency = new Map()
/** @type {Array<object>} the binder's agent-setup event records (this boot). */
const eventLog = []
/** @type {Map<string, object>} scenario-registered agent handles (surface restore needs them). */
const residencyAgents = new Map()
/** @type {Array<Promise<void>>} pending preset mounts fired by the real effects. */
const pendingMounts = []
/** @type {Array<object>} mount failures (never thrown into the bind). */
const mountErrors = []
/** @type {Array<object>} admission guard inputs (policy + live facts). */
const guardFacts = []
/** @type {object} the TS module handles (dynamic imports, hook-resolved). */
let modules

/**
 * The row entry point (fire-and-forget async setup, the P2-proven form):
 * the Loader only needs the named exports; the HTTP handlers gate on
 * `readyGate`, so no scenario request can race the TeamDomain open.
 * @param {object} ctx - the Cordis plugin context.
 */
export function apply(ctx) {
  let resolveReadyLocal
  readyGate = new Promise((r) => { resolveReadyLocal = r })
  resolveReady = resolveReadyLocal
  run(ctx).catch((error) => {
    setupError = error instanceof Error ? error.message : String(error)
    try {
      const home = process.env.DSH_HOME
      if (home !== undefined) {
        mkdirSync(join(home, 'p5t5-run'), { recursive: true })
      }
      writeFileSync(
        join(directive?.reportDir ?? join(home ?? '.', 'p5t5-run'), 'setup-failure.json'),
        JSON.stringify({ error: setupError, stack: error?.stack ?? null }, null, 2),
      )
    } catch {
      /* the health route still reports the failure */
    }
    resolveReadyLocal()
  })
}

/**
 * The async row setup: read the directive, open the TeamDomain through
 * the REAL storageDomain seam (boot 1 creates / boot 2 reopens the
 * persisted unit), and register the two host routes.
 * @param {object} ctx
 * @returns {Promise<void>}
 */
async function run(ctx) {
  directive = readDirective()
  mkdirSync(directive.reportDir, { recursive: true })

  const webServer = ctx.get('webServer')
  const storageDomain = ctx.get('storageDomain')
  if (webServer === undefined || storageDomain === undefined) {
    throw new Error('p5t5: webServer/storageDomain services missing despite inject')
  }

  // Dynamic imports: the TS resolution hook (registered at module top)
  // rewrites the worktree-relative .js specifiers to their .ts sources.
  const seamMod = await import('./seam.mjs')
  const reposMod = await import('../../../storage/repositories/index.js')
  const binderMod = await import('../../agent-setup/binder/index.js')
  const rootMod = await import('../index.js')
  const slotsMod = await import('./slots.mjs')
  modules = { binderMod, rootMod, slotsMod }

  const realSeam = seamMod.createRealStorageDomainSeam(storageDomain)
  const domain = directive.boot === 2
    ? await reposMod.openTeamDomain(realSeam)
    : await reposMod.createTeamDomain(realSeam)
  ctx.effect(() => () => {
    void domain.close().catch(() => {})
  }, 'p5t5 team-domain close')
  readHandle = binderMod.createTeamDomainReadHandle(domain.repositories)

  const baseWritePort = rootMod.createTeamDomainWritePort(domain.repositories)
  const writes = {
    putTeamSession(input) {
      return Promise.resolve(baseWritePort.putTeamSession(input)).then((record) => {
        writeLog.push({
          op: 'putTeamSession',
          sessionId: input.rootSessionId,
          blueprintId: input.blueprint?.blueprintId ?? null,
          revision: input.blueprint?.revision ?? null,
        })
        return record
      })
    },
    putSessionBinding(binding) {
      return Promise.resolve(baseWritePort.putSessionBinding(binding)).then((row) => {
        writeLog.push({ op: 'putSessionBinding', sessionId: binding.sessionId, kind: binding.kind })
        return row
      })
    },
  }

  const surface = createSurface(ctx)

  // The scenario ports are shared; the binder consumes the read handle +
  // the write port + the surface; slots/guard are per scenario.
  basePorts = { teamDomain: readHandle, writes, surface }

  // ── host routes (public webServer seam; effect-cleanup on row stop) ──
  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/__p5t5/health',
    handler: (req, res) => {
      sendJson(res, 200, {
        ok: setupError === null,
        boot: directive.boot,
        ready: setupError === null,
        ...(setupError !== null ? { setupError } : {}),
      })
    },
  }, 'p5t5 health route'))

  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/__p5t5/run',
    handler: async (req, res) => {
      if (req.method !== 'POST') {
        sendJson(res, 405, { error: 'POST only' })
        return
      }
      let body
      try {
        body = JSON.parse((await readBody(req)) || '{}')
      } catch (error) {
        sendJson(res, 400, { error: `bad JSON body: ${String(error?.message ?? error)}` })
        return
      }
      const scenario = body?.scenario
      if (!SCENARIOS.includes(scenario)) {
        sendJson(res, 400, { error: `unknown scenario '${String(scenario)}' (expected one of ${SCENARIOS.join(',')})` })
        return
      }
      try {
        await readyGate
        if (setupError !== null) {
          sendJson(res, 503, { scenario, error: 'row setup failed', setupError })
          return
        }
        const report = scenario === 'S2'
          ? await runColdScenario(ctx)
          : scenario === 'S4'
            ? await runOrdinaryScenario(ctx)
            : await runFreshScenario(ctx, scenario)
        writeFileSync(join(directive.reportDir, `${scenario}.json`), JSON.stringify(report, null, 2))
        writeFileSync(
          join(directive.reportDir, `done-${scenario}.json`),
          JSON.stringify({ scenario, pass: report.pass, assertions: report.assertions }, null, 2),
        )
        sendJson(res, 200, report)
      } catch (error) {
        const failure = {
          scenario,
          error: { name: error?.name ?? 'Error', message: String(error?.message ?? error), stack: error?.stack ?? null },
        }
        try {
          writeFileSync(join(directive.reportDir, `${scenario}.error.json`), JSON.stringify(failure, null, 2))
        } catch {
          /* the response carries the failure */
        }
        sendJson(res, 500, failure)
      }
    },
  }, 'p5t5 run route'))

  await resolveReady()
}

/**
 * Resolve the request-time services (the host is fully up by the time a
 * scenario request arrives; fail loud if one is missing).
 * @param {object} ctx
 * @returns {object}
 */
function resolveServices(ctx) {
  const agents = ctx.get('agents')
  const systemPrompt = ctx.get('systemPrompt')
  const agentPresets = ctx.get('agentPresets')
  const sessions = ctx.get('sessions')
  const sessionProjections = ctx.get('sessionProjections')
  const set = { agents, systemPrompt, agentPresets, sessions }
  const missing = Object.entries(set).filter(([, v]) => v === undefined).map(([k]) => k)
  if (missing.length > 0) {
    throw new Error(`p5t5: services not available at request time: ${missing.join(', ')}`)
  }
  return { agents, systemPrompt, agentPresets, sessions, sessionProjections }
}

/**
 * The REAL TeamAgentSetupSurface over the live DSH agent residency
 * (ruling R28's four-member contract, implemented with public seams only):
 *
 * - getInstalledSlots: the residency bookkeeping (ephemeral by design —
 *   DevPlan §18.5; the durable truth is TeamDomain, never this map);
 * - installOverlay: records the slot name (the real effects live in the
 *   overlay SLOT objects the binder applies — slots.mjs);
 * - restoreScope: the cold-time effect — re-attach the team persona
 *   preset onto the (re)created residency, idempotent (a no-op when the
 *   preset is already composed, the app-faithful resume state);
 * - recordSessionEvent: the binder's agent-setup event channel, recorded
 *   into this boot's audit log (the scenario reports carry it out).
 * @param {object} ctx
 * @returns {object}
 */
function createSurface(ctx) {
  return {
    getInstalledSlots(sessionId) {
      return residency.get(sessionId)?.installed ?? []
    },
    installOverlay(sessionId, slot) {
      const entry = residency.get(sessionId) ?? { installed: [] }
      if (!entry.installed.includes(slot)) entry.installed.push(slot)
      residency.set(sessionId, entry)
    },
    restoreScope(sessionId, scope) {
      const entry = residency.get(sessionId) ?? { installed: [] }
      entry.restored = { kind: scope.kind, slots: [...scope.slots] }
      const binding = residencyAgents.get(sessionId)
      const agentPresets = ctx.get('agentPresets')
      if (binding !== undefined && agentPresets !== undefined) {
        const composed = agentPresets.composedPreset(binding.agent.ctx)
        if (composed !== directive.teamPersonaPresetId) {
          entry.restoreEffect = 'mounted'
          pendingMounts.push(
            Promise.resolve(agentPresets.mount(binding.agent.ctx, directive.teamPersonaPresetId))
              .catch((error) => {
                mountErrors.push({ sessionId, message: String(error?.message ?? error) })
                throw error
              }),
          )
        } else {
          entry.restoreEffect = 'already-composed'
        }
      } else {
        entry.restoreEffect = 'no-residency-agent'
      }
      residency.set(sessionId, entry)
    },
    recordSessionEvent(sessionId, event) {
      eventLog.push({
        sessionId,
        name: event.name,
        ...(event.detail !== undefined ? { detail: event.detail } : {}),
      })
    },
  }
}

/**
 * The REAL T5 admission guard: the directive policy (the stand-in for the
 * durable admission state — see README "documented limitations") plus the
 * LIVE session-existence fact (a real admission input: the root session
 * must exist to be bound). Unknown policy FAILS CLOSED (never admits).
 * @param {string} scenarioId
 * @param {{sessionExists: boolean}} liveFacts
 * @returns {object}
 */
function makeGuard(scenarioId, liveFacts) {
  const policy = directive.admissionPolicyByScenario?.[scenarioId]
  return {
    decide(context) {
      guardFacts.push({
        scenario: scenarioId,
        policy: policy ?? null,
        liveFacts: { sessionExists: liveFacts.sessionExists, path: context.path },
      })
      if (policy === 'open') return { status: 'admitted' }
      if (policy === 'closed') {
        return { status: 'rejected', code: 'ADMISSION_TEAM_POLICY_CLOSED', detail: `session-exists:${liveFacts.sessionExists}` }
      }
      return { status: 'rejected', code: 'ADMISSION_POLICY_UNKNOWN', detail: String(policy) }
    },
  }
}

/** @returns {{blueprintId: string, revision: string, contentHash: string}} */
function blueprintRef() {
  const bp = directive.blueprint
  return { blueprintId: bp.blueprintId, revision: bp.revision, contentHash: bp.contentHash }
}

/**
 * The effective capability of one facet: `available ∩ teamResolved ∩
 * externalHard` (the frozen three-set intersection — the capability
 * types' contract). @param {string} facetKey @returns {string[]}
 */
function effectiveItems(facetKey) {
  const sources = directive.capability[facetKey]
  const avail = new Set(sources?.available ?? [])
  const team = new Set(sources?.teamResolved ?? [])
  const ext = new Set(sources?.externalHard ?? [])
  return [...avail].filter((x) => team.has(x) && ext.has(x)).sort()
}

/** @param {string} sessionId @returns {Array<object>} */
function writesFor(sessionId) {
  return writeLog.filter((w) => w.sessionId === sessionId)
}

/** @param {string} sessionId @returns {Array<object>} */
function eventsFor(sessionId) {
  return eventLog.filter((e) => e.sessionId === sessionId)
}

/**
 * S1/S3 — the FRESH Team root binding (admission open vs closed).
 * @param {object} ctx
 * @param {'S1'|'S3'} scenarioId
 * @returns {Promise<object>} the scenario report (assertions + evidence).
 */
async function runFreshScenario(ctx, scenarioId) {
  const svc = resolveServices(ctx)
  const sid = directive.sessionIds[scenarioId]
  const handle = await svc.agents.create({
    sessionId: SessionId(sid),
    meta: { cwd: process.env.DSH_HOME },
  })
  residencyAgents.set(sid, handle)
  let built
  try {
    built = await modules.slotsMod.buildRealSlots({
      agents: svc.agents,
      agentPresets: svc.agentPresets,
      systemPrompt: svc.systemPrompt,
      directive,
      handle,
      presetId: directive.teamPersonaPresetId,
      mcpPort: directive.mcpPort,
      stamp: `${scenarioId}-${directive.runStamp ?? process.pid}`,
    })

    const liveFacts = { sessionExists: svc.sessions.get(SessionId(sid)) !== undefined }
    const ports = { ...basePorts, slots: built.slots, admissionGuard: makeGuard(scenarioId, liveFacts) }
    const result = await modules.rootMod.bindFreshTeamRoot(ports, {
      rootSessionId: sid,
      blueprint: blueprintRef(),
      ...(directive.blueprint.defaultWorkspace !== undefined
        ? { defaultWorkspace: directive.blueprint.defaultWorkspace }
        : {}),
    })

    // The persona slot's mount effect is async (post-publish preset
    // mount) — await it before verifying the assembled persona.
    const effectResults = await Promise.allSettled(built.pendingEffects)
    const mountFailures = effectResults
      .filter((r) => r.status === 'rejected')
      .map((r) => String(r.reason?.message ?? r.reason))

    // Control-plane step (S1 only): the work gate is closed for S3, so no
    // model selection is made on a rejected root.
    if (scenarioId === 'S1') {
      built.modelSource.select(directive.blueprint.defaultModel)
    }

    // ── public verification ────────────────────────────────────────────
    const scope = scopeOf(handle.agent.ctx)
    const assembly = await svc.systemPrompt.assemble({ scope })
    const personaSection = assembly.sections.find((s) => s.name === PERSONA_SECTION)
    const expectedModel = directive.blueprint.defaultModel
    const toolNames = names(handle.agent.ctx.tools.schemas(handle.agent))
    const mcpToolName = 'mcp__p5t5mini__ping'
    const mcpVisible = scenarioId === 'S1' ? await waitForSchemaTool(handle, mcpToolName, 20_000) : null
    const durable = await waitForDurable(sid, 30_000)
    const teamSession = readHandle.getTeamSession(sid)
    const bindingRow = readHandle.getSessionBinding(sid)
    const installedSlots = residency.get(sid)?.installed ?? []
    const setupEvents = eventsFor(sid)
    const sessionEvents = handle.agent.session.events.map((ev) => ({ seq: ev.seq, type: ev.type }))

    const assertions = [
      {
        name: 'durable: TeamSession record + team-root binding written',
        pass: result.durable.wrote === true && teamSession !== undefined && bindingRow?.kind === 'team-root',
        actual: { wrote: result.durable.wrote, teamSessionPresent: teamSession !== undefined, bindingKind: bindingRow?.kind ?? null },
      },
      {
        name: 'durable: read-back pins the immutable blueprint snapshot',
        pass: teamSession !== undefined && deepEq(teamSession.blueprint, blueprintRef()),
        actual: teamSession?.blueprint ?? null,
        expected: blueprintRef(),
      },
      {
        name: 'bind: overlays installed in fixed order',
        pass: result.bind.installed === true && deepEq(installedSlots, ['persona', 'model', 'capability']),
        actual: installedSlots,
      },
      {
        name: 'bind: agent-setup events (3 overlay-installed + 1 admission-decided)',
        pass: setupEvents.filter((e) => e.name === 'agent-setup/overlay-installed').length === 3
          && setupEvents.filter((e) => e.name === 'agent-setup/admission-decided').length === 1,
        actual: setupEvents,
      },
    ]
    if (scenarioId === 'S1') {
      assertions.push(
        {
          name: 'admission: open policy admits (ADMISSION_OPEN)',
          pass: result.bind.admitted === true && result.bind.admissionCode === 'ADMISSION_OPEN',
          actual: { admitted: result.bind.admitted, admissionCode: result.bind.admissionCode ?? null },
        },
        {
          name: 'persona: substrate is the seeded standard preset',
          pass: built.substrate.personaKind === 'standard',
          actual: { personaKind: built.substrate.personaKind, probeSections: built.substrate.probeSections },
        },
        {
          name: 'persona: assembled leader persona text === blueprint text',
          pass: personaSection !== undefined && personaSection.text === directive.blueprint.leaderPersona,
          actual: personaSection?.text ?? null,
        },
        {
          name: 'model: assembly variables carry the selected provider/model',
          pass: assembly.variables?.provider === expectedModel.provider && assembly.variables?.model === expectedModel.model,
          actual: { provider: assembly.variables?.provider ?? null, model: assembly.variables?.model ?? null },
          expected: expectedModel,
        },
        {
          name: 'model: ref.assembled captured the selection at the assembly boundary',
          pass: deepEq(built.modelRef.assembled, expectedModel),
          actual: built.modelRef.assembled ?? null,
          expected: expectedModel,
        },
        {
          name: 'capability: installed tools === available ∩ teamResolved ∩ externalHard',
          pass: deepEq([...built.obs.toolsRegistered].sort(), effectiveItems('toolsPermissions'))
            && built.obs.toolsRegistered.length > 0
            && built.obs.toolsRegistered.every((t) => toolNames.includes(t)),
          actual: { registered: built.obs.toolsRegistered, effective: effectiveItems('toolsPermissions'), visible: toolNames },
        },
        {
          name: 'capability: installed skills === available ∩ teamResolved ∩ externalHard',
          pass: deepEq([...built.obs.skillsRegistered].sort(), effectiveItems('skills'))
            && built.obs.skillsRegistered.length > 0,
          actual: { registered: built.obs.skillsRegistered, effective: effectiveItems('skills') },
        },
        {
          name: 'capability: pre-step/pre-execute listeners registered per effective items',
          pass: deepEq([...built.obs.listeners].sort(), effectiveItems('preStepPreExecute')),
          actual: { listeners: built.obs.listeners, effective: effectiveItems('preStepPreExecute') },
        },
        {
          name: 'capability: mini-MCP tool visible (mcp__p5t5mini__ping)',
          pass: effectiveItems('mcp').length > 0 && mcpVisible === true,
          actual: mcpVisible,
          effective: effectiveItems('mcp'),
        },
        {
          name: 'session: durable model/selection event recorded',
          pass: sessionEvents.some((e) => e.type === 'model/selection'),
          actual: sessionEvents,
        },
        {
          name: 'durable: session log published as session.jsonl.zstd',
          pass: durable.published === true,
          actual: durable,
        },
      )
    } else {
      assertions.push(
        {
          name: 'admission: closed policy rejects (ADMISSION_TEAM_POLICY_CLOSED)',
          pass: result.bind.admitted === false && result.bind.admissionCode === 'ADMISSION_TEAM_POLICY_CLOSED',
          actual: { admitted: result.bind.admitted, admissionCode: result.bind.admissionCode ?? null },
        },
        {
          name: 'admission: rejection is a decision, not a failure (bind completed)',
          pass: result.bind.bound === true && result.bind.installed === true,
          actual: { bound: result.bind.bound, installed: result.bind.installed },
        },
        {
          name: 'durable: state stands after the closed decision',
          pass: teamSession !== undefined && bindingRow?.kind === 'team-root',
          actual: { teamSessionPresent: teamSession !== undefined, bindingKind: bindingRow?.kind ?? null },
        },
        {
          name: 'durable: session log published as session.jsonl.zstd',
          pass: durable.published === true,
          actual: durable,
        },
      )
    }

    return {
      scenario: scenarioId,
      sessionId: sid,
      pass: assertions.every((a) => a.pass),
      assertions,
      bind: result.bind,
      durableState: result.durable,
      verification: {
        substrate: built.substrate,
        persona: { present: personaSection !== undefined, textMatches: personaSection?.text === directive.blueprint.leaderPersona },
        model: {
          current: built.modelRef.current ?? null,
          assembled: built.modelRef.assembled ?? null,
          variables: { provider: assembly.variables?.provider ?? null, model: assembly.variables?.model ?? null },
        },
        tools: { registered: built.obs.toolsRegistered, visible: toolNames },
        skills: { registered: built.obs.skillsRegistered },
        mcp: { toolVisible: mcpVisible, fiberError: built.obs.mcpActivationError, mount: built.obs.mcpMount },
        listeners: built.obs.listeners,
        durable,
        teamDomain: { teamSession, binding: bindingRow },
        writes: writesFor(sid),
        guardFacts,
      },
      obs: built.obs,
      mountFailures,
    }
  } finally {
    if (built !== undefined) await modules.slotsMod.disposeSlotEffects(built.disposers)
    await handle.dispose()
    residencyAgents.delete(sid)
  }
}

/**
 * S2 — the COLD root rehydrate after a process restart (boot 2): resume
 * the S1 root (app-faithful resume: model selection installed first,
 * preset mounted second — the P2-T3 pinned order), re-seed the model ref
 * from the durable projection, then rehydrateColdTeamRoot.
 * @param {object} ctx
 * @returns {Promise<object>} the scenario report.
 */
async function runColdScenario(ctx) {
  const svc = resolveServices(ctx)
  const sid = directive.resumeSessionId
  const disposers = []
  const modelRef = { current: undefined, assembled: undefined }
  const handle = await svc.agents.resume({
    resumeSessionId: SessionId(sid),
    setup: async (agentCtx) => {
      disposers.push(installModelSelection(agentCtx, modelRef))
      const resolved = await svc.agentPresets.resolve(directive.teamPersonaPresetId)
      await svc.agentPresets.mount(agentCtx, resolved.id)
    },
  })
  residencyAgents.set(sid, handle)
  try {
    // The persisted selection becomes the live selection — exactly what
    // the app's selectionFor does with projectionState.pending (P2-T3).
    let composePath = 'directive'
    let projectionModel = null
    if (svc.sessionProjections !== undefined) {
      try {
        projectionModel = svc.sessionProjections.stateOf(handle.agent.session, 'modelSelection')
      } catch {
        projectionModel = null
      }
      const pending = projectionModel?.pending
      if (pending !== null && pending !== undefined) {
        modelRef.current = {
          provider: pending.provider,
          model: pending.model,
          ...(pending.reasoningEffort !== undefined ? { reasoningEffort: pending.reasoningEffort } : {}),
        }
        composePath = 'sessionProjections'
      }
    }

    const liveFacts = { sessionExists: svc.sessions.get(SessionId(sid)) !== undefined }
    const ports = { ...basePorts, admissionGuard: makeGuard('S2', liveFacts) }
    const result = await modules.rootMod.rehydrateColdTeamRoot(ports, { rootSessionId: sid })

    // Await any mount the surface's restoreScope fired (usually none: the
    // app-faithful resume setup already composed the preset).
    const effectResults = await Promise.allSettled(pendingMounts)
    const mountFailures = effectResults
      .filter((r) => r.status === 'rejected')
      .map((r) => String(r.reason?.message ?? r.reason))

    // The first post-resume prompt assembly: the pending selection must
    // be captured at the assembly boundary (the §40.3 assembly boundary).
    const assembly = await svc.systemPrompt.assemble({ scope: scopeOf(handle.agent.ctx) })
    const personaSection = assembly.sections.find((s) => s.name === PERSONA_SECTION)
    const expectedModel = directive.blueprint.defaultModel
    const sessionEvents = handle.agent.session.events.map((ev) => ({ seq: ev.seq, type: ev.type }))
    const setupEvents = eventsFor(sid)
    const teamSession = result.durable?.teamSession
    const assertions = [
      {
        name: 'durable: present after restart, re-read WITHOUT writes (wrote:false)',
        pass: result.durable !== undefined && result.durable.wrote === false && teamSession !== undefined,
        actual: { durable: result.durable === undefined ? null : { wrote: result.durable.wrote, blueprint: teamSession?.blueprint ?? null } },
      },
      {
        name: 'durable: read-back pins the immutable blueprint snapshot',
        pass: teamSession !== undefined && deepEq(teamSession.blueprint, blueprintRef()),
        actual: teamSession?.blueprint ?? null,
        expected: blueprintRef(),
      },
      {
        name: 'bind: cold path re-admits (ADMISSION_OPEN)',
        pass: result.bind.admitted === true && result.bind.admissionCode === 'ADMISSION_OPEN',
        actual: { admitted: result.bind.admitted, admissionCode: result.bind.admissionCode ?? null },
      },
      {
        name: 'bind: cold path is a real bind, not an ordinary no-op (bound:true, installed:true, no noopReason)',
        pass: result.bind.bound === true && result.bind.installed === true && result.bind.noopReason === undefined,
        actual: { bound: result.bind.bound, installed: result.bind.installed, noopReason: result.bind.noopReason ?? null },
      },
      {
        name: 'bind: no fresh-time overlay installs (zero overlay-installed events; scope restored instead)',
        pass: setupEvents.filter((e) => e.name === 'agent-setup/overlay-installed').length === 0,
        actual: setupEvents,
      },
      {
        name: 'bind: agent-setup events (1 scope-restored + 1 admission-decided)',
        pass: setupEvents.filter((e) => e.name === 'agent-setup/scope-restored').length === 1
          && setupEvents.filter((e) => e.name === 'agent-setup/admission-decided').length === 1,
        actual: setupEvents,
      },
      {
        name: 'writes: zero durable writes on the cold path (this boot)',
        pass: writeLog.length === 0,
        actual: writeLog,
      },
      {
        name: 'model: durable model/selection survived the process restart',
        pass: sessionEvents.some((e) => e.type === 'model/selection'),
        actual: sessionEvents,
      },
      {
        name: 'model: re-seeded ref captured at the first post-resume assembly',
        pass: deepEq(modelRef.assembled, expectedModel)
          && assembly.variables?.provider === expectedModel.provider
          && assembly.variables?.model === expectedModel.model,
        actual: { assembled: modelRef.assembled ?? null, composePath, variables: { provider: assembly.variables?.provider ?? null, model: assembly.variables?.model ?? null } },
        expected: expectedModel,
      },
      {
        name: 'persona: composed preset carries the blueprint leader persona',
        pass: svc.agentPresets.composedPreset(handle.agent.ctx) === directive.teamPersonaPresetId
          && personaSection !== undefined
          && personaSection.text === directive.blueprint.leaderPersona,
        actual: { composedPreset: svc.agentPresets.composedPreset(handle.agent.ctx), personaPresent: personaSection !== undefined, textMatches: personaSection?.text === directive.blueprint.leaderPersona },
      },
      {
        name: 'surface: restore was a re-entrant no-op or a mount',
        pass: ['already-composed', 'mounted'].includes(residency.get(sid)?.restoreEffect ?? ''),
        actual: { restoreEffect: residency.get(sid)?.restoreEffect ?? null, restored: residency.get(sid)?.restored ?? null },
      },
    ]
    return {
      scenario: 'S2',
      sessionId: sid,
      pass: assertions.every((a) => a.pass),
      assertions,
      bind: result.bind,
      durableState: result.durable ?? null,
      verification: {
        model: { seededFrom: composePath, projection: projectionModel ?? null, current: modelRef.current ?? null, assembled: modelRef.assembled ?? null },
        persona: { present: personaSection !== undefined, textMatches: personaSection?.text === directive.blueprint.leaderPersona },
        durable: { sessionFile: diskFilesFor(sid) },
        writes: writeLog,
        guardFacts,
        mountFailures,
      },
      obs: { listeners: null },
    }
  } finally {
    for (const dispose of disposers) {
      try {
        dispose()
      } catch {
        /* best-effort teardown */
      }
    }
    await handle.dispose()
    residencyAgents.delete(sid)
  }
}

/**
 * S4 — the ORDINARY root: a cold rehydrate on a session that was never
 * team-bound. Must be a zero-effect no-op (no slots, no events, no
 * writes, no durable state).
 * @param {object} ctx
 * @returns {Promise<object>} the scenario report.
 */
async function runOrdinaryScenario(ctx) {
  const svc = resolveServices(ctx)
  const sid = directive.sessionIds.S4
  const handle = await svc.agents.create({
    sessionId: SessionId(sid),
    meta: { cwd: process.env.DSH_HOME },
  })
  residencyAgents.set(sid, handle)
  try {
    const liveFacts = { sessionExists: svc.sessions.get(SessionId(sid)) !== undefined }
    const ports = { ...basePorts, admissionGuard: makeGuard('S4', liveFacts) }
    const result = await modules.rootMod.rehydrateColdTeamRoot(ports, { rootSessionId: sid })
    const setupEvents = eventsFor(sid)
    const assertions = [
      {
        name: 'bind: ordinary no-op (bound:false, noopReason ordinary)',
        pass: result.bind.noopReason === 'ordinary' && result.bind.bound === false,
        actual: { bound: result.bind.bound, noopReason: result.bind.noopReason ?? null },
      },
      {
        name: 'bind: no install, no events',
        pass: result.bind.installed === false && result.bind.emittedEvents.length === 0 && setupEvents.length === 0,
        actual: { installed: result.bind.installed, emitted: result.bind.emittedEvents, recorded: setupEvents },
      },
      {
        name: 'durable: absent (an ordinary session carries no Team state)',
        pass: result.durable === undefined,
        actual: result.durable ?? null,
      },
      {
        name: 'writes: zero durable writes touched this session',
        pass: writesFor(sid).length === 0,
        actual: writesFor(sid),
      },
      {
        name: 'residency: no overlay slots recorded',
        pass: (residency.get(sid)?.installed ?? []).length === 0,
        actual: residency.get(sid)?.installed ?? [],
      },
    ]
    return {
      scenario: 'S4',
      sessionId: sid,
      pass: assertions.every((a) => a.pass),
      assertions,
      bind: result.bind,
      durableState: result.durable ?? null,
      verification: { writes: writesFor(sid), guardFacts },
      obs: {},
    }
  } finally {
    await handle.dispose()
    residencyAgents.delete(sid)
  }
}
