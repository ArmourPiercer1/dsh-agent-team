/**
 * P8-S5A — the harness observability row (boots 1 and 2; boots 3/4 in the
 * extended world) — the THIN layer over the production `dsh-agent-team`
 * row:
 *
 * The backend graph (TeamDomain open/seed, the production activation
 * provider + runtime + control/messaging/activity satellites, the
 * createTeamTools set, the live root + member agents, and the durable
 * consumption machinery) now lives in the shipped production plugin
 * (packages/runtime, built to
 * packages/runtime/dist/packages/runtime/src/plugin/host.js) and is
 * mounted as the `teamRoot` Cordis service in the SAME profile-patch
 * layer, BEFORE this row. This row contributes only:
 *
 *   - the run directive (`p6t6-directive.json`) validation;
 *   - the five harness HTTP routes (public webServer seam), all of whose
 *     business reads go through the `teamRoot` service:
 *       GET  /__p6t6/health — row readiness, boot, setupError
 *       POST /__p6t6/tool   — {name, args, as, callId?} -> ONE registered
 *                             tool execution on the agent bound to `as`
 *       GET  /__p6t6/state  — durable read-back: members, teamSession,
 *                             control (requests/decisions/consumptions),
 *                             activity facts, the messaging
 *                             restart-recovery scan result, and the
 *                             backend-truth projection (governance
 *                             overrides + per-live-session consumption
 *                             views + observations)
 *       POST /__p6t6/governance/mutate — {as, recordId, scope,
 *                             instanceId?, cells, expectedGeneration?}
 *                             -> the owned governance-override ADMISSION
 *                             authority (the backend truth the live
 *                             agents re-consume at every request boundary)
 *       POST /__p6t6/residency/drop — {sessionId} -> dispose the live
 *                             agent handle bound to `sessionId`
 *   - the row-stop cleanup backstop (the teamRoot bindings' close()).
 *
 * The `teamRoot` service contract (registered SYNCHRONOUSLY by the
 * production row; its async bootstrap is tracked through `ready`):
 *   ready     — Promise: resolves when the production bootstrap finished
 *               successfully (root + member live agents materialized),
 *               rejects with an Error on failure
 *   domain    — the open TeamDomain
 *   live      — the live-agent bindings bundle (the FULL createAgentBindings
 *               result of packages/runtime/src/plugin/live/agent-bindings.mjs):
 *               listLiveSessions(), hasLive(sessionId),
 *               ensureLiveAgent(sessionId), prepareAgentForRequest(sessionId),
 *               executeTool(sessionId, {name, args, callId}),
 *               getConsumptionState(sessionId),
 *               resolveConsumptionViews(sessionId), observations,
 *               governanceAuthority(asSessionId),
 *               dropResidency(sessionId) -> {dropped, disposeError?},
 *               close(), plus the provider-facing ports (childFactory,
 *               sessionDurability, surface, sessionInput, workDelivery,
 *               interrupt, drainDescendants, residency, resolveCaller,
 *               agentSetup, rootSessionId)
 *   tools     — the createTeamTools result ({tools}) of this boot
 *   control   — { listControlState }
 *   activity  — { listActivityFacts }
 *   messaging — { recoverPendingDeliveries }
 *   config    — the row config (rootSessionId, mcpServer {name, port}, ...)
 *
 * Plain node: builtins only: NO @deepseek-ai/* imports, NO TS loader
 * registration, NO backend graph. The one dynamic import is the PURE
 * governance admission authority from the BUILT runtime dist (plain JS,
 * compiled by run.mjs's tsc step before the first boot — the dist mirror
 * path has no extra src/ segment for the top-level mutation directory):
 *   ../../runtime/dist/packages/runtime/mutation/index.js
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

/** Cordis row identity (function-plugin protocol: named exports, no default). */
export const name = 'p6t6-team-tools'

/**
 * Dependency parking (verified Cordis `_refresh` semantics): the fiber epoch
 * stays INACTIVE while ANY injected service lacks an implementation, and the
 * apply body runs only once all of these exist — so this observability row
 * can never apply before (a) the host's `webServer` and (b) the production
 * row's `teamRoot` facade (provided SYNCHRONOUSLY by the production row's
 * apply, before its first await). This is what the attempt-1 incident was
 * missing: without `inject`, the row applied while `webServer` was still
 * absent, threw synchronously, and Cordis absorbed the rejection into its
 * own logger — invisible to the harness, raw 404s forever.
 */
export const inject = ['webServer', 'teamRoot']

const DIRECTIVE_NAME = 'p6t6-directive.json'

// ── module state (one row instance per process = per boot) ────────────────

/** @type {object} the validated directive of this boot. */
let directive
/** @type {Promise<void>} resolves when row setup finished (success or failure). */
let readyGate
/** @type {string|null} setup failure (visible through /__p6t6/health). */
let setupError = null
/** @type {Promise<unknown>} the governance-mutation route's serialize chain. */
let governanceQueue = Promise.resolve()
/** @type {object} the pure admission authority (the built dist mutation module). */
let mutationAdmission

/** @returns {string} the current timestamp (the governance admission `now`). */
const now = () => new Date().toISOString()

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

// ── the row entry point ───────────────────────────────────────────────────

/**
 * The row entry point (fire-and-forget async setup, the P5-proven form):
 * the Loader only needs the named exports.
 *
 * Failure channel (attempt-1 root cause, now closed): Cordis `_reload`
 * ABSORBS a rejected apply fiber — it logs to its own logger (which never
 * reaches the captured instance log) and resets the fiber to INACTIVE, so a
 * production row that rejects its apply is invisible to the harness and the
 * routes 404 forever. The production row therefore never rejects apply: it
 * provides the `teamRoot` facade synchronously and EVERY setup failure
 * (config validation, missing services, glue/seam/legacy imports, domain
 * open, boot) rejects `teamRoot.ready`. This row's `inject` parks it until
 * the facade exists; the SUCCESS routes are registered only once `ready`
 * resolves — exactly the original driver-visible behavior (the routes 404
 * until the row is ready, then answer with the settled state). On failure
 * ONLY the failure health route is exposed: the driver polls it and a raw
 * 404 for 180s would hide the real error.
 * @param {object} ctx - the Cordis plugin context.
 */
export async function apply(ctx) {
  let resolveReady
  readyGate = new Promise((r) => { resolveReady = r })
  const fail = (error) => {
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
    resolveReady()
  }
  try {
    // Dead-defensive: `inject` parks this row until both services exist, so
    // a miss here means the row config was isolated or the production row
    // was dropped from the profile — report it as such.
    const webServer = ctx.get('webServer')
    if (webServer === undefined) {
      throw new Error('p6t6 observability: the webServer service is missing despite the inject declaration (realm isolation or a malformed row config)')
    }
    directive = readDirective()
    mkdirSync(directive.reportDir, { recursive: true })
    const teamRoot = ctx.get('teamRoot')
    if (teamRoot === undefined) {
      throw new Error('p6t6 observability: the teamRoot service is missing despite the inject declaration — the production dsh-agent-team row must be mounted in the same realm before this observability row')
    }
    // Row-stop backstop: dispose the bindings' owned side effects (the
    // production root may close them itself too — close() is idempotent).
    // The `.live` getter can throw TEAM_PLUGIN_NOT_READY if this row is
    // stopped before the production bootstrap settles — a stop, never a
    // crash.
    ctx.effect(() => () => {
      try {
        void teamRoot.live.close().catch(() => {})
      } catch {
        /* bootstrap not settled at stop time */
      }
    }, 'p6t6 observability cleanup')
    // The PURE governance admission authority: the built runtime dist
    // mutation module (plain JS — the run.mjs tsc step compiles it before
    // the first boot; no TS source is loaded, no loader registered).
    mutationAdmission = await import('../../runtime/dist/packages/runtime/mutation/index.js')
    teamRoot.ready.then(
      () => {
        registerSuccessRoutes(ctx, webServer, teamRoot)
        resolveReady()
      },
      (error) => fail(error),
    )
  } catch (error) {
    fail(error)
  }
}

// ── the success routes (production bootstrap settled) ─────────────────────

/**
 * The route-time teamRoot guard (dead-defensive: apply() already refuses a
 * missing service — this keeps any route failure mode self-describing).
 * @param {import('node:http').ServerResponse} res
 * @param {object|undefined} teamRoot
 * @returns {boolean} false (and a 500 sent) when the service is missing.
 */
function teamRootGuard(res, teamRoot) {
  if (teamRoot === undefined) {
    sendJson(res, 500, { error: 'p6t6 observability: the teamRoot service is missing — the production dsh-agent-team row must be mounted before this observability row' })
    return false
  }
  return true
}

/**
 * Register the five harness routes. All business reads go through the
 * settled `teamRoot` service; the handlers keep the original
 * `await readyGate` + `setupError` gate as a dead defensive branch (the
 * gate is already resolved by the time these routes exist).
 * @param {object} ctx - the Cordis plugin context.
 * @param {object} webServer - the webServer service.
 * @param {object} teamRoot - the production row's service.
 */
function registerSuccessRoutes(ctx, webServer, teamRoot) {
  const rootSid = directive.rootSessionId

  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/__p6t6/health',
    handler: (req, res) => {
      if (!teamRootGuard(res, teamRoot)) return
      sendJson(res, 200, {
        ok: setupError === null,
        boot: directive?.boot ?? null,
        ready: setupError === null,
        rootSessionId: directive?.rootSessionId ?? null,
        liveSessions: teamRoot.live.listLiveSessions(),
        toolCount: teamRoot.tools.tools.length,
        ...(setupError !== null ? { setupError } : {}),
      })
    },
  }, 'p6t6 health route'))

  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/__p6t6/tool',
    handler: async (req, res) => {
      if (!teamRootGuard(res, teamRoot)) return
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
        // P8-S4B: the request-boundary machinery (ensure-live -> boundary
        // reconciliation -> the public tools.execute with the row-owned
        // budget) lives in the production row's bindings; the error codes
        // map 1:1 to the original harness statuses.
        let outcome
        try {
          outcome = await teamRoot.live.executeTool(as, {
            name,
            args: body?.args ?? {},
            callId: body?.callId,
          })
        } catch (error) {
          if (error?.code === 'NO_LIVE_AGENT') {
            sendJson(res, 422, { error: `no live agent for '${as}': ${error.message}` })
            return
          }
          if (error?.code === 'CONSUMPTION_BOUNDARY') {
            sendJson(res, 500, { error: `durable consumption boundary failed for '${as}': ${error.message}` })
            return
          }
          if (error?.code === 'TOOLS_EXECUTE') {
            sendJson(res, 500, { error: error.message })
            return
          }
          sendJson(res, 500, { error: String(error?.message ?? error) })
          return
        }
        if (outcome.isError === true) {
          sendJson(res, 200, {
            ok: false,
            error: {
              message: outcome.error.message,
              ...(outcome.error.info !== undefined ? { info: outcome.error.info } : {}),
            },
          })
        } else {
          sendJson(res, 200, { ok: true, value: outcome.value })
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
      if (!teamRootGuard(res, teamRoot)) return
      try {
        await readyGate
        if (setupError !== null) {
          sendJson(res, 503, { error: 'row setup failed', setupError })
          return
        }
        const repositories = teamRoot.domain.repositories
        const members = repositories.memberInstances.list(rootSid).map((m) => ({
          instanceId: String(m.instanceId),
          templateId: String(m.templateId),
          label: String(m.label),
          childSessionId: String(m.childSessionId),
          lifecycle: String(m.lifecycle),
          activityVersion: Number(m.activityVersion),
        }))
        const teamSessionRow = repositories.teamSessions.get(rootSid)
        const controlState = await teamRoot.control.listControlState(rootSid)
        const activityRows = teamRoot.activity.listActivityFacts({ rootSessionId: rootSid })
        const recovery = await teamRoot.messaging.recoverPendingDeliveries(rootSid)
        // P8-S4B: the backend-truth projection. The durable overrides are
        // read fresh from the store; every live session's views are
        // re-resolved NOW (pure) against its applied record set, so a
        // mutation that landed after the last boundary shows up in
        // pendingNextBoundary before any request applies it.
        const governanceOverrides = repositories.overrides.list(rootSid).map((r) => ({
          recordId: String(r.recordId),
          kind: r.kind,
          scope: r.scope,
          ...(r.instanceId !== undefined ? { instanceId: String(r.instanceId) } : {}),
          ...(r.origin !== undefined ? { origin: r.origin } : {}),
          values: r.values,
          generation: Number(r.generation),
          updatedAt: String(r.updatedAt),
        }))
        const governanceSessions = {}
        for (const sid of teamRoot.live.listLiveSessions()) {
          const state = teamRoot.live.getConsumptionState(sid)
          const views = state !== undefined ? teamRoot.live.resolveConsumptionViews(sid) : undefined
          governanceSessions[sid] = {
            instanceId: state !== undefined ? state.instanceId : null,
            model: {
              current: state !== undefined ? state.ref.current : null,
              assembled: state !== undefined ? state.ref.assembled : null,
              ...(views !== undefined ? {
                selection: views.modelView.selection,
                source: views.modelView.source,
                suppressed: views.modelView.suppressed,
                unavailable: views.modelView.unavailable,
                ...(views.modelView.deniedBy !== undefined ? { deniedBy: views.modelView.deniedBy } : {}),
                pendingNextBoundary: views.modelView.pendingNextBoundary,
                explanation: views.modelView.explanation,
              } : {}),
            },
            mcp: {
              mounted: state !== undefined && state.mcpFiber !== undefined,
              serverName: teamRoot.config.mcpServer.name,
              ...(state !== undefined && state.mcpActivationError !== undefined ? { activationError: state.mcpActivationError } : {}),
              ...(views !== undefined ? {
                allowed: views.mcpView.allowed,
                source: views.mcpView.source,
                unavailable: views.mcpView.unavailable,
                ...(views.mcpView.deniedBy !== undefined ? { deniedBy: views.mcpView.deniedBy } : {}),
                pendingNextBoundary: views.mcpView.pendingNextBoundary,
                explanation: views.mcpView.explanation,
              } : {}),
            },
          }
        }
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
          governance: {
            overrides: governanceOverrides,
            sessions: governanceSessions,
          },
          observations: [...teamRoot.live.observations],
        })
      } catch (error) {
        sendJson(res, 500, { error: String(error?.message ?? error) })
      }
    },
  }, 'p6t6 state route'))

  // P8-S4B: the owned governance-override ADMISSION route — the backend
  // authority writer (§20.3/§20.4: the remote handler calls the runtime
  // admission module, never the repository directly). The PURE authority is
  // the built dist mutation module imported in apply(); the {list, put}
  // store port rides on teamRoot.domain.repositories. Authority is derived
  // SERVER-SIDE (the bundle's governanceAuthority) from the principal the
  // driver presents as `as`: the root session is the host-known operator
  // (human overrides); a bound member child is a member (own-instance
  // autonomy overlays only).
  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/__p6t6/governance/mutate',
    handler: async (req, res) => {
      if (!teamRootGuard(res, teamRoot)) return
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
        const as = typeof body?.as === 'string' ? body.as : null
        const recordId = typeof body?.recordId === 'string' ? body.recordId : null
        const scope = body?.scope === 'team' || body?.scope === 'instance' ? body.scope : null
        const cells = body?.cells
        if (as === null || recordId === null || scope === null || typeof cells !== 'object' || cells === null || Array.isArray(cells)) {
          sendJson(res, 400, { error: 'body.as, body.recordId, body.scope (team|instance) and body.cells (object) are required' })
          return
        }
        const args = {
          authority: teamRoot.live.governanceAuthority(as),
          rootSessionId: rootSid,
          recordId,
          scope,
          cells,
          now,
        }
        if (args.authority === undefined) {
          sendJson(res, 403, { error: `no authorized team principal for session '${as}' (not the root and no bound member)` })
          return
        }
        if (scope === 'instance') {
          const instanceId = typeof body?.instanceId === 'string' ? body.instanceId : null
          if (instanceId === null) {
            sendJson(res, 400, { error: 'body.instanceId is a required string for instance scope' })
            return
          }
          args.instanceId = instanceId
        }
        if (typeof body?.expectedGeneration === 'number') args.expectedGeneration = body.expectedGeneration
        // The row-level serialize chain: the admit list-then-put critical
        // section never interleaves with a racing mutation (the optimistic
        // generation guard on top still surfaces concurrent slot writers).
        // The chain itself never rejects: each request awaits its own
        // continuation, so one failure cannot poison the queued next one.
        const admittedRun = governanceQueue.then(() =>
          mutationAdmission.admitGovernanceOverride(args, {
            list: async (root) => teamRoot.domain.repositories.overrides.list(String(root)),
            put: (record) => teamRoot.domain.repositories.overrides.put(record),
          }),
        )
        governanceQueue = admittedRun.then(
          () => undefined,
          () => undefined,
        )
        let admitted
        try {
          admitted = await admittedRun
        } catch (error) {
          if (mutationAdmission.isMutationError(error)) {
            const status = error.code === 'MALFORMED_MUTATION_INPUT'
              ? 400
              : error.code === 'UNAUTHORIZED_MUTATION'
                ? 403
                : 409
            sendJson(res, status, { error: error.message, code: error.code, ...(error.details !== undefined ? { details: error.details } : {}) })
            return
          }
          sendJson(res, 500, { error: String(error?.message ?? error) })
          return
        }
        sendJson(res, 200, {
          ok: true,
          value: {
            recordId: admitted.recordId,
            kind: admitted.kind,
            scope: admitted.scope,
            ...(admitted.instanceId !== undefined ? { instanceId: admitted.instanceId } : {}),
            ...(admitted.origin !== undefined ? { origin: admitted.origin } : {}),
            values: admitted.values,
            generation: admitted.generation,
            updatedAt: admitted.updatedAt,
            supersededRecordId: admitted.supersededRecordId,
          },
        })
      } catch (error) {
        sendJson(res, 500, { error: String(error?.message ?? error) })
      }
    },
  }, 'p6t6 governance mutation route'))

  ctx.effect(() => webServer.register({
    kind: 'exact',
    path: '/__p6t6/residency/drop',
    handler: async (req, res) => {
      if (!teamRootGuard(res, teamRoot)) return
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
        const result = await teamRoot.live.dropResidency(sessionId)
        if (result.disposeError !== undefined) {
          sendJson(res, 500, { error: `dispose failed: ${result.disposeError}` })
          return
        }
        sendJson(res, 200, { sessionId, dropped: result.dropped })
      } catch (error) {
        sendJson(res, 500, { error: String(error?.message ?? error) })
      }
    },
  }, 'p6t6 residency-drop route'))
}
