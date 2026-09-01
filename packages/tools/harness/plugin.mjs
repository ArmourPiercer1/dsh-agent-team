#!/usr/bin/env node
/**
 * P6-T6 real-instance harness row (boots 1 and 2) — the team-tools layer
 * (packages/tools) driven end-to-end over REAL DSH public seams only:
 *
 *   - the row is mounted ONLY through the public profile-patch seam
 *     (`DshInstance.mountRows` in run.mjs; verified by dump-config);
 *   - the durable TeamDomain opens through the REAL storageDomain seam
 *     (seam.mjs `createRealStorageDomainSeam` -> `createTeamDomain` /
 *     `openTeamDomain`);
 *   - EVERY team action the E2E driver performs goes through the REGISTERED
 *     tool handlers: the ten tools from `createTeamTools` are registered on
 *     each live agent via the public Cordis tool registration seam
 *     (`agentCtx.tools.register`) and executed through the public execution
 *     seam (`handle.agent.ctx.tools.execute` with a caller-owned signal).
 *     The driver never calls the TeamRuntime API directly — G6 criterion 7.
 *   - the T3 `SessionInputPort` lands on the REAL public Session input API:
 *     `agent.followup(createUserMessage(...))` + `agent.whenIdle()`;
 *     commit-or-throw per the port contract;
 *   - the activation protocol's ONE external effect (child-session factory)
 *     binds to `agents.create` with a DETERMINISTIC pre-specified session
 *     id — idempotent on (rootSessionId, instanceId): a live agent for the
 *     derived id short-circuits, a durable one is resumed, otherwise a
 *     fresh one is created;
 *   - the invariant-46 session-durability barrier binds to the REAL
 *     `sessionPersistence.ensureMaterialized(liveAgent.session)`;
 *   - the TeamAgentSetupSurface is a minimal no-op (SD-SURFACE): the
 *     harness needs no overlay slots; the post-commit binder install
 *     resolves the durable member record through the read handle;
 *   - NO real LLM is ever contacted: every agent (create or resume) carries
 *     a STATIC model reference (provider 'p6t6-static' is not configured in
 *     the fresh test DSH_HOME), so followup turns fail contained, log their
 *     input, and settle back to idle.
 *
 * Boot 1 (port 3180): seeds the durable TeamSession/binding/members,
 * creates the root + seed children (materialized), and the driver runs the
 * boot-1 scenarios (E1, E2, E3, E4, E5a-c, E6); run.mjs then kills the
 * process (the E5 kill).
 * Boot 2 (port 3181, SAME DSH_HOME): opens the durable TeamDomain, resumes
 * the root + every bound member child session, and the driver runs the
 * restart scenarios (E5d, E5e) plus the durable read-back (G6 criterion 5:
 * message/control/progress survive the restart).
 *
 * Routes (public webServer seam; effect-cleanup on row stop):
 *   GET  /__p6t6/health — row readiness, boot, setupError
 *   POST /__p6t6/tool   — {name, args, as, callId?} -> ONE registered tool
 *                         execution on the agent bound to `as`
 *   GET  /__p6t6/state  — durable read-back: members, teamSession, control
 *                         (requests/decisions/consumptions), activity facts,
 *                         and the messaging restart-recovery scan result
 */
import { register } from 'node:module'
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { SessionId } from '@deepseek-ai/dsh-session'
import { installModelSelection } from '@deepseek-ai/dsh-agent'
import { ToolCallId, createUserMessage } from '@deepseek-ai/dsh-llm'

// The TS resolution hook MUST be registered before the first dynamic TS
// import (it rewrites worktree-relative .js specifiers that have a .ts
// sibling). The static imports above are prebuilt packages only, so
// top-level registration is safe; the dynamic TS imports happen inside
// run(), after this line executes.
register(
  new URL('../../runtime/root-binding/harness/ts-loader.mjs', import.meta.url),
  import.meta.url,
)

/** Cordis row identity (function-plugin protocol: named exports, no default). */
export const name = 'p6t6-team-tools'
/**
 * Hard service dependencies: the Loader defers this row's apply until all
 * three exist. The remaining services (sessionPersistence) are resolved
 * lazily at setup time — by then the full host is up.
 */
export const inject = ['agents', 'webServer', 'storageDomain']

const DIRECTIVE_NAME = 'p6t6-directive.json'

/** The static model reference (no real provider in the test DSH_HOME). */
const STATIC_MODEL = { provider: 'p6t6-static', model: 'p6t6-model-v1' }

/** The per-tool-call execution budget (activation involves real agent work). */
const TOOL_EXEC_TIMEOUT_MS = 120_000

/**
 * The P6-T6 fixture blueprint (own id; quotas: team 12/12, per-template
 * 4/4 — the template boundary is the only one the E2E scenarios bind on:
 * workers end at 4 (1 seed + 3 from E1), scouts end at 4 (1 seed + 2 from
 * E4 + exactly 1 admitted from the E6 race); the team total (9 with the
 * leader) never reaches 12).
 */
const P6T6_BLUEPRINT_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: P6T6-BP',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: You lead the P6T6 team.',
  'members:',
  '  - templateId: worker',
  '    displayName: Worker',
  '    persona: You do the P6T6 work.',
  '  - templateId: scout',
  '    displayName: Scout',
  '    persona: You scout for the P6T6 team.',
  '    contextPolicy: fresh_per_delegation',
  'requirements:',
  '  - domain: tool',
  '    name: web',
  '    optional: true',
  '  - domain: skill',
  '    name: base',
  'teamEnvelope:',
  '  allow:',
  '    - assign-task',
  '    - create-member',
  '    - send-message',
  '    - report-progress',
  '    - request-control',
  '    - resolve-control',
  '    - archive-member',
  '    - restore-member',
  '  deny:',
  '    - delete-team',
  'memberEnvelopes:',
  '  - templateId: worker',
  '    envelope:',
  '      allow:',
  '        - send-message',
  '        - report-progress',
  '      deny: []',
  '  - templateId: scout',
  '    envelope:',
  '      allow:',
  '        - send-message',
  '        - report-progress',
  '        - request-control',
  '      deny: []',
  'policyStates:',
  '  - id: default',
  '    description: The P6T6 default state.',
  'quotas:',
  '  team:',
  '    maxInstances: 12',
  '    maxConcurrent: 12',
  '  members:',
  '    maxInstances: 4',
  '    maxConcurrent: 4',
  'metadata: {}',
  '---',
].join('\n')

/** The seeded member template/label pairs (the leader binds the root itself). */
const SEED_WORKER = { instanceId: 'inst-p6t6seedw1', templateId: 'worker', label: 'existing-worker', childSessionId: 'session-child-p6t6seedw1' }
const SEED_SCOUT = { instanceId: 'inst-p6t6seeds1', templateId: 'scout', label: 'existing-scout', childSessionId: 'session-child-p6t6seeds1' }

// ── module state (one row instance per process = per boot) ────────────────

/** @type {object} the validated directive of this boot. */
let directive
/** @type {Promise<void>} resolves when row setup finished (success or failure). */
let readyGate
/** @type {((() => void) | undefined)} */
let resolveReady
/** @type {string|null} setup failure (visible through /__p6t6/health). */
let setupError = null
/** @type {object|null} the open TeamDomain (boot 1 create / boot 2 open). */
let domain
/** @type {object|null} the createTeamTools result ({tools}) of this boot. */
let toolsResult
/** @type {object|null} the agents service (set in run). */
let agentsSVC
/** @type {Map<string, object>} live agent handles keyed by session id. */
const liveAgents = new Map()
/** @type {Array<() => void>} tool-registration + model-selection disposers. */
const toolDisposers = []
/** @type {number} synthetic callId counter (the driver may omit callIds). */
let callCounter = 0
/** @type {string[]} noteworthy async observations (e.g. whenIdle quirks). */
const observations = []

// ── small helpers ─────────────────────────────────────────────────────────

/** @param {import('node:http').ServerResponse} res @param {number} status @param {object} body */
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
 * Read the run directive (written by run.mjs before every boot).
 * @returns {object} the validated directive.
 */
function readDirective() {
  const home = process.env.DSH_HOME
  if (home === undefined) throw new Error('p6t6: DSH_HOME is not set (expected from the harness-spawned host process environment)')
  const parsed = JSON.parse(readFileSync(join(home, DIRECTIVE_NAME), 'utf8'))
  if (!(parsed?.boot === 1 || parsed?.boot === 2 || parsed?.boot === 3 || parsed?.boot === 4)) {
    throw new Error(`p6t6: directive.boot must be 1-4 (got ${JSON.stringify(parsed?.boot)})`)
  }
  // 'phase' is the semantic boot mode; the boot number is world-specific.
  // Backward-compat fallback: boot 1/3 create a fresh team, boot 2/4 resume.
  const phase = parsed?.phase ?? (parsed.boot === 1 || parsed.boot === 3 ? 'create' : 'resume')
  if (phase !== 'create' && phase !== 'resume') {
    throw new Error(`p6t6: directive.phase must be 'create' or 'resume' (got ${JSON.stringify(parsed?.phase)})`)
  }
  if (typeof parsed?.reportDir !== 'string' || parsed.reportDir.length === 0) {
    throw new Error('p6t6: directive.reportDir must be a non-empty string')
  }
  if (typeof parsed?.rootSessionId !== 'string' || parsed.rootSessionId.length === 0) {
    throw new Error('p6t6: directive.rootSessionId must be a non-empty string')
  }
  return {
    boot: parsed.boot,
    phase,
    reportDir: parsed.reportDir,
    runStamp: typeof parsed?.runStamp === 'string' ? parsed.runStamp : null,
    rootSessionId: parsed.rootSessionId,
    mcpPort: typeof parsed?.mcpPort === 'number' ? parsed.mcpPort : null,
  }
}

/**
 * The deterministic child session id for one activated instance (the
 * factory idempotency contract: same (root, instanceId) -> same child id).
 * @param {string} instanceId - an `inst-`-prefixed instance id.
 * @returns {string} the derived child session id.
 */
function childSidFor(instanceId) {
  return `session-child-p6t6-${instanceId.slice(5)}`
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
 * The shared agent setup (create OR resume): install the static model
 * reference and register every team tool in the agent scope. The
 * disposers are collected for row-stop cleanup (the agent-scope unwind
 * covers them on disposal as well).
 * @returns {function(object): Promise<void>} the AgentSetup callback.
 */
function makeAgentSetup() {
  return async (agentCtx) => {
    installModelSelection(agentCtx, { current: { ...STATIC_MODEL }, assembled: undefined })
    if (toolsResult) {
      for (const def of toolsResult.tools) {
        toolDisposers.push(agentCtx.tools.register(def))
      }
    }
  }
}

/**
 * The live-agent-or-resume resolver for one session id (the SD-CALLER
 * execution binding: a tool call `as <session>` runs on that session's
 * agent; a not-live-but-durable session is resumed first).
 * @param {string} sessionId
 * @returns {Promise<object>} the AgentHandle.
 */
async function ensureLiveAgent(sessionId) {
  const existing = liveAgents.get(sessionId)
  if (existing !== undefined) return existing
  if (!sessionIsDurable(sessionId)) {
    throw new Error(`p6t6: session '${sessionId}' is neither live nor durable — no agent to execute a tool on`)
  }
  const handle = await agentsSVC.resume({
    resumeSessionId: SessionId(sessionId),
    setup: makeAgentSetup(),
  })
  liveAgents.set(sessionId, handle)
  return handle
}

/**
 * The row entry point (fire-and-forget async setup, the P5-proven form):
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
      writeFileSync(
        join(directive?.reportDir ?? process.env.DSH_HOME ?? '.', 'setup-failure.json'),
        JSON.stringify({ error: setupError, stack: error?.stack ?? null }, null, 2),
      )
    } catch {
      /* the health route still reports the failure */
    }
    try {
      // A failed setup must still expose the health route: the driver polls
      // it and a raw 404 for 180s would hide the real error.
      const ws = ctx.get('webServer')
      ctx.effect(() => ws.register({
        kind: 'exact',
        path: '/__p6t6/health',
        handler: (req, res) => {
          sendJson(res, 200, {
            ok: false,
            boot: directive?.boot ?? null,
            rootSessionId: directive?.rootSessionId ?? null,
            setupError,
          })
        },
      }, 'p6t6 failure health route'))
    } catch {
      /* the row cannot report; the driver sees the 404 */
    }
    resolveReadyLocal()
  })
}

// ── the async row setup ───────────────────────────────────────────────────

/**
 * The full boot setup: read the directive, open the TeamDomain through the
 * REAL storageDomain seam, seed (boot 1) / resume (boot 2) the bound
 * sessions, wire the activation provider + runtime + satellites + tools,
 * and register the three host routes.
 * @param {object} ctx
 * @returns {Promise<void>}
 */
async function run(ctx) {
  directive = readDirective()
  mkdirSync(directive.reportDir, { recursive: true })
  const rootSid = directive.rootSessionId

  const webServer = ctx.get('webServer')
  const storageDomain = ctx.get('storageDomain')
  agentsSVC = ctx.get('agents')
  if (webServer === undefined || storageDomain === undefined || agentsSVC === undefined) {
    throw new Error('p6t6: agents/webServer/storageDomain services missing despite inject')
  }
  const persistence = ctx.get('sessionPersistence')
  if (persistence === undefined) {
    throw new Error('p6t6: sessionPersistence service missing — the durability barrier seam is unavailable')
  }

  // Dynamic imports: the TS resolution hook (registered at module top)
  // rewrites the worktree-relative .js specifiers to their .ts sources.
  const seamMod = await import('../../runtime/root-binding/harness/seam.mjs')
  const reposMod = await import('../../storage/repositories/index.js')
  const contractsMod = await import('../../contracts/src/index.js')
  const blueprintMod = await import('../../domain/blueprint/src/index.js')
  const routerMod = await import('../../runtime/action-router/index.js')
  const activationMod = await import('../../runtime/activation/index.js')
  const controlMod = await import('../../runtime/control/index.js')
  const messagingMod = await import('../../runtime/messaging/index.js')
  const activityMod = await import('../../runtime/activity/index.js')
  const toolsMod = await import('../src/index.js')

  const realSeam = seamMod.createRealStorageDomainSeam(storageDomain)
  domain = directive.phase === 'resume'
    ? await reposMod.openTeamDomain(realSeam)
    : await reposMod.createTeamDomain(realSeam)
  ctx.effect(() => () => {
    void domain.close().catch(() => {})
    for (const dispose of toolDisposers.splice(0)) {
      try { dispose() } catch { /* the scope unwind covers it */ }
    }
  }, 'p6t6 team-domain + tool registrations cleanup')

  const blueprint = blueprintMod.parseBlueprint(P6T6_BLUEPRINT_SOURCE)
  const catalog = blueprintMod.createBlueprintCatalog([blueprint])

  if (directive.phase === 'create') {
    // Seed the durable TeamSession + team-root binding + the three seeded
    // members (leader binds the root session itself as its residency).
    const repositories = domain.repositories
    await repositories.teamSessions.put({
      rootSessionId: contractsMod.parseRootSessionId(rootSid),
      blueprint: contractsMod.createBlueprintSnapshotRef({
        blueprintId: contractsMod.parseBlueprintId(String(blueprint.blueprintId)),
        revision: contractsMod.parseBlueprintRevision(String(blueprint.revision)),
        contentHash: contractsMod.parseBlueprintContentHash(String(blueprint.contentHash)),
      }),
      defaultWorkspace: 'C:/agent-team/work/p6t6',
      createdAt: new Date(0).toISOString(),
      generation: 1,
    })
    await repositories.sessionBindings.put({
      kind: 'team-root',
      schemaVersion: 1,
      sessionId: contractsMod.parseRootSessionId(rootSid),
    })
    const seedRows = [
      {
        instanceId: contractsMod.parseInstanceId(String(contractsMod.LEADER_INSTANCE_ID)),
        templateId: contractsMod.parseTemplateId('leader'),
        label: 'leader',
        childSessionId: contractsMod.parseChildSessionId(rootSid),
      },
      {
        instanceId: contractsMod.parseInstanceId(SEED_WORKER.instanceId),
        templateId: contractsMod.parseTemplateId(SEED_WORKER.templateId),
        label: SEED_WORKER.label,
        childSessionId: contractsMod.parseChildSessionId(SEED_WORKER.childSessionId),
      },
      {
        instanceId: contractsMod.parseInstanceId(SEED_SCOUT.instanceId),
        templateId: contractsMod.parseTemplateId(SEED_SCOUT.templateId),
        label: SEED_SCOUT.label,
        childSessionId: contractsMod.parseChildSessionId(SEED_SCOUT.childSessionId),
      },
    ]
    for (const row of seedRows) {
      await repositories.memberInstances.put({
        rootSessionId: contractsMod.parseRootSessionId(rootSid),
        instanceId: row.instanceId,
        templateId: row.templateId,
        label: row.label,
        childSessionId: row.childSessionId,
        lifecycle: 'RUNNING',
        createdAt: new Date(0).toISOString(),
        activityVersion: 1,
      })
    }
  }

  // ── the activation ports (real external effects, minimal surface) ──
  const environmentFacts = async () => [
    { domain: 'tool', subject: 'web', available: true, generation: 1 },
    { domain: 'skill', subject: 'base', available: true, generation: 1 },
  ]
  const externalPolicyFacts = async () => ({ hard: {}, capabilityExists: {} })
  const now = () => new Date().toISOString()

  const childFactory = {
    async createChildSession(request) {
      const childSid = childSidFor(String(request.instanceId))
      const live = liveAgents.get(childSid)
      if (live !== undefined) return { childSessionId: childSid }
      if (sessionIsDurable(childSid)) {
        const handle = await agentsSVC.resume({
          resumeSessionId: SessionId(childSid),
          setup: makeAgentSetup(),
        })
        liveAgents.set(childSid, handle)
        return { childSessionId: childSid }
      }
      const handle = await agentsSVC.create({
        sessionId: SessionId(childSid),
        meta: { cwd: process.env.DSH_HOME },
        setup: makeAgentSetup(),
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
      await persistence.ensureMaterialized(handle.agent.session)
    },
  }

  // SD-SURFACE: the minimal no-op TeamAgentSetupSurface (the harness needs
  // no overlay slots; the post-commit binder resolves the durable member
  // record through the real read handle).
  const surface = {
    getInstalledSlots() { return [] },
    installOverlay() {},
    restoreScope() {},
    recordSessionEvent() {},
  }

  // The REAL SessionInputPort over the public Session input API: the
  // followup commit point is the inbox acceptance; the quiescence wait
  // follows. Commit-or-throw: a rejection means the input was not
  // delivered (the coordinator keeps the intent pending).
  const sessionInput = {
    async submitAttributedInput(input) {
      const handle = await ensureLiveAgent(String(input.sessionId))
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

  // ── runtime + satellites + tools ──
  const provider = activationMod.createActivationProvider({
    teamDomain: domain,
    blueprintCatalog: catalog,
    environmentFacts,
    externalPolicyFacts,
    childSessionFactory: childFactory,
    sessionDurability,
    surface,
    now,
  })
  // ── P8-S3 production work-chain ports (R1–R7) ──
  // The durable lifecycle commit is the P8-S3 CAS repository surface
  // (R4/CR-10): identity + expectedActivityVersion + from-state
  // compare-and-swap in the durable layer.
  const lifecycleCommitPort = {
    async commitTransition(args) {
      await domain.repositories.memberInstances.commitTransition(args)
    },
  }
  // The P7-T3 lifecycle ports (R7/CR-9) over the REAL production surfaces:
  // close-admission is a no-op in this row because it has no separate
  // in-process admission gate — the router's per-team lock serializes the
  // whole procedure and the durable terminal-state commit is what durably
  // blocks new work (documented in S3-result.md); interrupt is the public
  // Agent cancel (upstream contract: no-op when the phase is idle); drain
  // quiesces on the public whenIdle; residency is the live-agent handle
  // map (drop = forget the resident handle, the durable session stays on
  // disk under DSH_HOME).
  const lifecyclePorts = {
    teamDomain: domain,
    commit: lifecycleCommitPort,
    admission: {
      async closeNewWork(_target) {
        // no separate admission gate in this row (see above)
      },
    },
    activity: {
      async interrupt(target) {
        const row = domain.repositories.memberInstances.list(rootSid).find(
          (m) => String(m.instanceId) === String(target.instanceId),
        )
        const handle = row !== undefined ? liveAgents.get(String(row.childSessionId)) : undefined
        if (handle === undefined) return // no activity in flight: no-op by contract
        handle.agent.cancel({ kind: 'user' })
      },
    },
    descendants: {
      async drainDescendants(childSessionId) {
        const handle = liveAgents.get(String(childSessionId))
        if (handle !== undefined) {
          try {
            await handle.agent.whenIdle()
          } catch {
            // a rejected turn is over (idle or failed): the member is
            // quiescent either way; a non-turn fault still propagates
          }
        }
        return { drained: 0, quiescent: true }
      },
    },
    residency: {
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
      await persistence.ensureMaterialized(handle.agent.session)
    },
  }
  const runtime = routerMod.createTeamRuntime({
    teamDomain: domain,
    activationProvider: provider,
    blueprintCatalog: catalog,
    environmentFacts,
    externalPolicyFacts,
    now,
    lifecycleCommit: lifecycleCommitPort,
    lifecyclePorts,
    workDelivery,
    workActivity: activityMod.createWorkActivityWriter({ teamDomain: domain, now }),
  })
  const control = controlMod.createControlService({
    teamDomain: domain,
    blueprintCatalog: catalog,
    externalPolicyFacts,
    now,
  })
  const messaging = messagingMod.createMessagingCoordinator({
    teamRuntime: runtime,
    teamDomain: domain,
    sessionInput,
    now,
  })
  const activity = activityMod.createActivityLedger({
    teamDomain: domain,
    runtime,
    now,
  })

  // SD-CALLER: the tool layer only LOOKS UP the caller identity from the
  // durable domain; the runtime re-validates it on every call.
  const resolveCaller = async (sessionId) => {
    if (sessionId === rootSid) {
      return { kind: 'instance', instanceId: String(contractsMod.LEADER_INSTANCE_ID) }
    }
    const members = domain.repositories.memberInstances.list(rootSid)
    for (const member of members) {
      if (String(member.childSessionId) === sessionId) {
        return { kind: 'instance', instanceId: String(member.instanceId) }
      }
    }
    throw new Error(`p6t6 caller map: no caller for session ${sessionId}`)
  }

  toolsResult = toolsMod.createTeamTools({
    teamRuntime: runtime,
    controlService: control,
    messaging,
    activity,
    resolveCaller,
  })
  for (const name of toolsResult.tools.map((t) => t.name)) {
    // the registration set is asserted by the driver's health read-back
    if (typeof name !== 'string' || name.length === 0) throw new Error('p6t6: malformed tool name in the created tool set')
  }

  // ── live agents: the root (create / resume) + the bound children ──
  // Order matters: the agent setup callback (which registers the tools)
  // runs INSIDE create/resume, so the tool stack must exist before the
  // first agent is created.
  const rootHandle = directive.phase === 'create'
    ? await agentsSVC.create({
      sessionId: SessionId(rootSid),
      meta: { cwd: process.env.DSH_HOME },
      setup: makeAgentSetup(),
    })
    : await agentsSVC.resume({
      resumeSessionId: SessionId(rootSid),
      setup: makeAgentSetup(),
    })
  liveAgents.set(rootSid, rootHandle)
  if (directive.phase === 'create') {
    await persistence.ensureMaterialized(rootHandle.agent.session)
    for (const seed of [SEED_WORKER, SEED_SCOUT]) {
      const handle = await agentsSVC.create({
        sessionId: SessionId(seed.childSessionId),
        meta: { cwd: process.env.DSH_HOME },
        setup: makeAgentSetup(),
      })
      liveAgents.set(seed.childSessionId, handle)
      await persistence.ensureMaterialized(handle.agent.session)
    }
  } else {
    // Boot 2: resume every bound member child session (the leader's is the
    // root, already resumed; dedupe by child session id).
    const members = domain.repositories.memberInstances.list(rootSid)
    const seen = new Set([rootSid])
    for (const member of members) {
      const child = String(member.childSessionId)
      if (seen.has(child)) continue
      seen.add(child)
      const handle = await agentsSVC.resume({
        resumeSessionId: SessionId(child),
        setup: makeAgentSetup(),
      })
      liveAgents.set(child, handle)
    }
  }

  // ── host routes (public webServer seam; effect-cleanup on row stop) ──
  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/__p6t6/health',
    handler: (req, res) => {
      sendJson(res, 200, {
        ok: setupError === null,
        boot: directive?.boot ?? null,
        ready: setupError === null,
        rootSessionId: directive?.rootSessionId ?? null,
        liveSessions: [...liveAgents.keys()],
        toolCount: toolsResult?.tools.length ?? 0,
        ...(setupError !== null ? { setupError } : {}),
      })
    },
  }, 'p6t6 health route'))

  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/__p6t6/tool',
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
      try {
        await readyGate
        if (setupError !== null) {
          sendJson(res, 503, { error: 'row setup failed', setupError })
          return
        }
        const name = typeof body?.name === 'string' ? body.name : null
        const as = typeof body?.as === 'string' ? body.as : null
        if (name === null || as === null) {
          sendJson(res, 400, { error: 'body.name and body.as are required strings' })
          return
        }
        let handle
        try {
          handle = await ensureLiveAgent(as)
        } catch (error) {
          sendJson(res, 422, { error: `no live agent for '${as}': ${error instanceof Error ? error.message : String(error)}` })
          return
        }
        callCounter += 1
        const callId = ToolCallId(typeof body?.callId === 'string' && body.callId.length > 0 ? body.callId : `p6t6-call-${callCounter}`)
        let result
        try {
          result = await handle.agent.ctx.tools.execute({
            callId,
            name,
            arguments: body?.args ?? {},
            agent: handle.agent,
            signal: AbortSignal.timeout(TOOL_EXEC_TIMEOUT_MS),
          })
        } catch (error) {
          sendJson(res, 500, { error: `tools.execute failed: ${error instanceof Error ? `${error.message}${error.stack ? `\n${error.stack}` : ''}` : String(error)}` })
          return
        }
        if (result.isError === true) {
          sendJson(res, 200, {
            ok: false,
            error: {
              message: result.error.message,
              ...(result.error.info !== undefined ? { info: result.error.info } : {}),
            },
          })
        } else {
          sendJson(res, 200, { ok: true, value: result.value })
        }
      } catch (error) {
        sendJson(res, 500, { error: String(error?.message ?? error) })
      }
    },
  }, 'p6t6 tool route'))

  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/__p6t6/state',
    handler: async (req, res) => {
      try {
        await readyGate
        if (setupError !== null) {
          sendJson(res, 503, { error: 'row setup failed', setupError })
          return
        }
        const repositories = domain.repositories
        const members = repositories.memberInstances.list(rootSid).map((m) => ({
          instanceId: String(m.instanceId),
          templateId: String(m.templateId),
          label: String(m.label),
          childSessionId: String(m.childSessionId),
          lifecycle: String(m.lifecycle),
          activityVersion: Number(m.activityVersion),
        }))
        const teamSessionRow = repositories.teamSessions.get(rootSid)
        const controlState = await control.listControlState(rootSid)
        const activityRows = activity.listActivityFacts({ rootSessionId: rootSid })
        const recovery = await messaging.recoverPendingDeliveries(rootSid)
        sendJson(res, 200, {
          boot: directive.boot,
          phase: directive.phase,
          rootSessionId: rootSid,
          teamSession: teamSessionRow === undefined ? null : {
            rootSessionId: String(teamSessionRow.rootSessionId),
            blueprintId: String(teamSessionRow.blueprint.blueprintId),
            revision: String(teamSessionRow.blueprint.revision),
            contentHash: String(teamSessionRow.blueprint.contentHash),
            defaultWorkspace: String(teamSessionRow.defaultWorkspace),
            createdAt: String(teamSessionRow.createdAt),
            generation: Number(teamSessionRow.generation),
          },
          members,
          control: {
            requests: controlState.requests.map((r) => ({
              requestId: r.requestId,
              kind: r.kind,
              targetInstanceId: String(r.targetInstanceId),
              actionName: r.actionName,
              ...(r.toolName !== undefined ? { toolName: r.toolName } : {}),
              correlation: r.correlation,
              status: r.status,
              createdAt: r.createdAt,
            })),
            decisions: controlState.decisions.map((d) => ({
              requestId: d.requestId,
              decision: d.decision,
              ...(d.note !== undefined ? { note: d.note } : {}),
              decisionSequence: d.decisionSequence,
              requestSequence: d.requestSequence,
              createdAt: d.createdAt,
            })),
            consumptions: controlState.consumptions.map((c) => ({
              requestId: c.requestId,
              decisionSequence: c.decisionSequence,
              consumedAt: c.consumedAt,
            })),
          },
          activity: activityRows.map((row) => ({
            globalSequence: row.globalSequence,
            factType: row.factType,
            instanceId: String(row.instanceId),
            subject: row.subject,
            sequence: row.sequence,
            op: row.op,
            progress: row.progress,
            ...(row.summary !== undefined ? { summary: row.summary } : {}),
            ...(row.lastAction !== undefined ? { lastAction: row.lastAction } : {}),
            ...(row.correlation !== undefined ? { correlation: row.correlation } : {}),
            requestToken: row.requestToken,
          })),
          pendingDeliveries: {
            recovered: recovery.recovered,
            skipped: recovery.skipped,
          },
          observations: [...observations],
        })
      } catch (error) {
        sendJson(res, 500, { error: String(error?.message ?? error) })
      }
    },
  }, 'p6t6 state route'))

  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/__p6t6/residency/drop',
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
      try {
        await readyGate
        if (setupError !== null) {
          sendJson(res, 503, { error: 'row setup failed', setupError })
          return
        }
        const sessionId = typeof body?.sessionId === 'string' ? body.sessionId : null
        if (sessionId === null) {
          sendJson(res, 400, { error: 'body.sessionId is required string' })
          return
        }
        // The real production dropResidency semantics (P5-T6): dispose the
        // live agent handle — stop the loop, unregister, remove the session
        // from the store — and forget the residency. Awaiting the teardown
        // first guarantees no second live agent on the same session when the
        // next execution cold-resumes from the durable log (W7). The durable
        // session stays under DSH_HOME.
        const handle = liveAgents.get(sessionId)
        if (handle === undefined) {
          sendJson(res, 200, { sessionId, dropped: false })
          return
        }
        liveAgents.delete(sessionId)
        try {
          await handle.dispose()
        } catch (error) {
          sendJson(res, 500, { error: `dispose failed: ${String(error?.message ?? error)}` })
          return
        }
        sendJson(res, 200, { sessionId, dropped: true })
      } catch (error) {
        sendJson(res, 500, { error: String(error?.message ?? error) })
      }
    },
  }, 'p6t6 residency-drop route'))

  resolveReady()
}
