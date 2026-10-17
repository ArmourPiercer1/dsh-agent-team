/**
 * a5w7-jobs-plugin.mjs — the Alpha.5 W7 wiring row: the PR7 jobs-gateway
 * PUBLIC FACE assembled into a live Host process through the public
 * profile-patch seam (WIRING-PHASE-PLAN IF-1: plugin row + public services;
 * no upstream patch, no private API, zero lane-source edits).
 *
 * WHAT THIS ROW IS
 *
 *   A plain plugin row (the p6t6 observability row is the accepted shape):
 *   `inject = ['webServer', 'teamRoot']` parks the fiber until the Host web
 *   server and the production Team row's `teamRoot` facade both exist, and
 *   the row registers its own exact-path routes through the public
 *   `webServer.register` seam. It imports the jobs-gateway through the
 *   lane's PUBLIC BARREL only — compiled from unmodified TS sources by the
 *   kit's local project (see tsconfig.lane.json for why the emit is not
 *   repo-dist at base: the shared tsconfig include is GLUE's job, IF-5).
 *
 *   Inside the row lives ONE gateway object per assembly generation, fed by
 *   host-derived member identities the driver READS BACK from the durable
 *   state (`teamRoot.domain.repositories.memberInstances.list`) — the same
 *   public read p6t6 uses. The row is the Web/Jobs consumption face, so per
 *   review-LaneF condition 3 the LEASE HANDLE IS NOT PART OF ANY RESPONSE:
 *   routes expose owner-scoped views, typed refusals, and the window's
 *   STATE + outstanding call ids — never `lease` itself, never an `end` or
 *   `acquire` a consumer can call. Lease lifecycle moves only through the
 *   assembly's own teardown action (drain / release / giveUp), which reports
 *   the typed outcome, nothing else.
 *
 * DISCLOSED IDENTITY-SOURCE BOUNDARY (the honest line this row draws):
 *
 *   - member/owner facts: HOST facts (durable MemberInstance rows, read
 *     through the production assembly's domain repositories);
 *   - tool-Definition identities (the C-BIND re-read target): a ROW-LOCAL
 *     definition store, explicitly labelled. The pinned Host offers a
 *     third-party row no public seam to move another scope's Definition
 *     mid-session, and no host Jobs face at all — the `job_start` anchor
 *     stays absent in the whole host tree (re-measured by the kit, never
 *     argued). So the host-registry-shaped rebind chain stays FIXTURE-LEVEL
 *     (a5p7-mcp-rebind-chain, 6/6) and the live leg here proves the
 *     gateway's law (cancel-only-what-moved, attribution pinned to the
 *     execution-time definition) against a live gateway in the live process,
 *     NOT against a host registry.
 *
 * G-g is cited OPEN only (PENDING-GATES); abort propagation is COOPERATIVE —
 * the plane decides what happened, this face mirrors it with no termination
 * guarantee of its own.
 *
 * Kit-provided environment: A5W7_DIRECTIVE (path of the run directive JSON,
 * also findable at $DSH_HOME/a5w7-directive.json).
 *
 * @module tests/kits/a5-w7-jobs-wiring/a5w7-jobs-plugin
 */
import { appendFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/** Cordis row identity (function-plugin protocol: named exports, no default). */
export const name = 'a5w7-jobs-gateway'

/**
 * Dependency parking, the p6t6-verified form: the fiber stays INACTIVE until
 * both services exist, so `apply` never runs against a half world (and never
 * throws into the absorbed-rejection hole the p6t6 header documents).
 */
export const inject = ['webServer', 'teamRoot']

/** The public barrel surface the assembly requires, by name. */
const REQUIRED_EXPORTS = [
  'createJobsGateway', 'createLeaseWindow', 'classifyDispatchEvent',
  'jobOwnerKey', 'projectJobForViewer', 'redactCredentials', 'gatewayRefusal', 'REDACTION_MARKER',
]

let directive = null
let setupError = null
/** @type {object|null} the current gateway assembly generation. */
let assembly = null
/** @type {number} assembly generations built (re-assembly = recovery path). */
let generation = 0
/** Row-local definition store: `${scopeKey}\u0000${name}` -> identity string | null (withdrawn). */
const defStore = new Map()

const readDirective = () => {
  const path = process.env['A5W7_DIRECTIVE']
    ?? join(process.env['DSH_HOME'] ?? '.', 'a5w7-directive.json')
  const parsed = JSON.parse(readFileSync(path, 'utf8'))
  if (parsed?.boot !== 1) throw new Error(`a5w7: directive.boot must be 1 (got ${JSON.stringify(parsed?.boot)})`)
  for (const key of ['runStamp', 'gatewayUrl', 'ledger', 'rootSessionId']) {
    if (typeof parsed[key] !== 'string' || parsed[key] === '') throw new Error(`a5w7: directive.${key} is required`)
  }
  if (!Array.isArray(parsed.memberRootSessionIds)) throw new Error('a5w7: directive.memberRootSessionIds must be an array')
  return parsed
}

function record(row) {
  if (directive === null) return
  try {
    mkdirSync(dirname(directive.ledger), { recursive: true })
    appendFileSync(directive.ledger, JSON.stringify({ at: new Date().toISOString(), ...row }) + '\n')
  } catch {
    /* best-effort: the routes are the primary channel, the ledger the stream */
  }
}

function sendJson(res, status, body) {
  const payload = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) })
  res.end(payload)
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

/** The gateway's definition reader: a ROW-LOCAL store (see header). */
function resolveDefinition(scopeKey, name) {
  const key = `${String(scopeKey)}\u0000${String(name)}`
  if (!defStore.has(key)) return { ok: false, identity: 'never-registered' }
  const identity = defStore.get(key)
  return identity === null ? { ok: false, identity: 'withdrawn' } : { ok: true, identity }
}

/** Build one assembly generation from the lane's PUBLIC BARREL. */
async function buildAssembly(mod) {
  generation += 1
  const observations = []
  const gateway = mod.createJobsGateway({
    resolveDefinition,
    onObserve: (o) => {
      if (observations.length < 4000) observations.push({ ...o, at: new Date().toISOString() })
      record({ leg: 'gateway-observation', generation, ...o })
    },
  })
  assembly = { gateway, observations, builtAt: new Date().toISOString() }
  record({ leg: 'assembly-built', generation, gatewayUrl: directive.gatewayUrl })
  return assembly
}

/** Durable member identities through the production assembly's public read. */
function durableMembers(teamRoot) {
  const out = {}
  try {
    for (const rootSid of directive.memberRootSessionIds) {
      out[rootSid] = teamRoot.domain.repositories.memberInstances.list(rootSid).map((m) => ({
        instanceId: String(m.instanceId),
        templateId: String(m.templateId),
        childSessionId: String(m.childSessionId),
        lifecycle: String(m.lifecycle),
      }))
    }
  } catch (error) {
    out.__error = String(error?.message ?? error)
  }
  return out
}

/** Owner-scoped list: the viewer sees what `projectFor` grants, nothing else.
 *  Cross-scope refusals carry the lane's static detail — never an owner key. */
function listForViewer(gateway, viewer) {
  const visible = []
  const refused = []
  for (const rec of gateway.job('*')) {
    const view = gateway.projectFor(viewer, rec.jobId)
    if (view.ok) visible.push(view.view)
    else refused.push({ jobId: rec.jobId, code: view.code, detail: view.detail })
  }
  return { visible, refused }
}

export async function apply(ctx) {
  try {
    directive = readDirective()
  } catch (error) {
    setupError = String(error?.message ?? error)
    record({ leg: 'directive-failed', error: setupError })
  }
  const webServer = ctx.get('webServer')
  if (webServer === undefined) {
    setupError = 'a5w7: the webServer service is missing despite the inject declaration'
    return
  }
  const failRoute = () => {
    // p6t6 shape: the effect OWNS the registration (lazy) and the returned
    // disposer tears it down at row stop.
    ctx.effect(() => webServer.register({
      kind: 'exact',
      path: '/__a5w7/health',
      handler: (_req, res) => sendJson(res, 200, { ok: false, setupError }),
    }, 'a5w7 failure health route'), 'a5w7-fail-health')
  }
  if (setupError !== null) {
    failRoute()
    return
  }
  const teamRoot = ctx.get('teamRoot')
  if (teamRoot === undefined) {
    setupError = 'a5w7: teamRoot is missing despite the inject declaration'
    failRoute()
    return
  }
  try {
    const mod = await import(directive.gatewayUrl)
    const missing = REQUIRED_EXPORTS.filter((n) => mod[n] === undefined)
    if (missing.length > 0) throw new Error(`public barrel misses ${missing.join(', ')}`)
    await teamRoot.ready
    await buildAssembly(mod)
    record({ leg: 'row-ready', generation })
  } catch (error) {
    setupError = error instanceof Error ? error.message : String(error)
    record({ leg: 'assembly-failed', error: setupError })
    failRoute()
    return
  }

  const register = (path, handler, label) => {
    ctx.effect(() => webServer.register({ kind: 'exact', path, handler }, `a5w7 ${label}`), `a5w7 ${label}`)
  }

  register('/__a5w7/health', (_req, res) => {
    sendJson(res, 200, {
      ok: true,
      boot: 1,
      gateway: 'assembled',
      generation,
      publicExports: REQUIRED_EXPORTS,
      runStamp: directive.runStamp,
    })
  }, 'health')

  register('/__a5w7/state', (_req, res) => {
    const g = assembly.gateway
    let roster = []
    try {
      roster = (teamRoot.tools?.tools ?? []).map((t) => String(t?.name ?? ''))
    } catch {
      roster = []
    }
    sendJson(res, 200, {
      generation,
      // Window facts WITHOUT the handle: state + outstanding call ids only
      // (review-LaneF condition 3 — the lease object never crosses this face).
      windowState: g.lease.state(),
      outstandingCallIds: g.lease.outstanding().map((t) => t.callId),
      jobs: g.job('*').map((r) => ({
        jobId: r.jobId,
        ownerKey: r.ownerKey,
        scopeKey: r.scopeKey,
        toolName: r.toolName,
        pinnedIdentity: r.pinnedIdentity,
        state: r.state,
        cancelRequested: r.cancelRequested,
        outcome: r.outcome,
        evidenceEvents: r.evidence.map((e) => e.event),
      })),
      roster,
      rosterHasJobStart: roster.some((n) => /job[_-]?start/i.test(n)),
      durableMembers: durableMembers(teamRoot),
      definitionStore: Object.fromEntries([...defStore.entries()].map(([k, v]) => [k.replace('\u0000', ' | '), v])),
      observations: assembly.observations,
    })
  }, 'state')

  register('/__a5w7/op', async (req, res) => {
    let body
    try {
      body = JSON.parse(await readBody(req) || '{}')
    } catch (error) {
      return sendJson(res, 400, { ok: false, error: `bad json: ${String(error?.message ?? error)}` })
    }
    const g = assembly.gateway
    const { op, args = {} } = body
    let out
    switch (op) {
      case 'admit':
        out = g.admitJob({
          jobId: String(args.jobId),
          owner: { rootSessionId: String(args.owner?.rootSessionId), instanceId: String(args.owner?.instanceId) },
          scopeKey: String(args.scopeKey ?? 'kit'),
          toolName: String(args.toolName ?? 'a5w7-tool'),
          pinnedIdentity: String(args.pinnedIdentity ?? 'def-v1'),
        })
        break
      case 'observe':
        out = g.observeDispatchEvent(args.event)
        break
      case 'list':
        out = { ok: true, ...listForViewer(g, { rootSessionId: String(args.viewer?.rootSessionId), instanceId: String(args.viewer?.instanceId) }) }
        break
      case 'project':
        out = g.projectFor(
          { rootSessionId: String(args.viewer?.rootSessionId), instanceId: String(args.viewer?.instanceId) },
          String(args.jobId),
        )
        break
      case 'defPut':
        defStore.set(`${String(args.scopeKey)}\u0000${String(args.name)}`, String(args.identity))
        out = { ok: true, source: 'row-local-definition-store (disclosed: NOT a host registry fact)' }
        break
      case 'defWithdraw':
        defStore.set(`${String(args.scopeKey)}\u0000${String(args.name)}`, null)
        out = { ok: true, source: 'row-local-definition-store (disclosed: NOT a host registry fact)' }
        break
      case 'registryChange':
        out = { ok: true, moved: g.onRegistryChange() }
        break
      case 'ownerPinProbe': {
        // The lane's value-copy pin, re-verified live: mutate the CALLER'S
        // owner object after admission and re-read the record. The job rides
        // B's own registered (scope,name) pair so a later rebind probe never
        // counts it as moved.
        const ownerObj = { rootSessionId: String(args.owner?.rootSessionId), instanceId: String(args.owner?.instanceId) }
        const admitted = g.admitJob({ jobId: String(args.jobId), owner: ownerObj, scopeKey: 'a5w7-scope-b', toolName: 'a5w7_def_tool', pinnedIdentity: 'def-v1' })
        const keyAtAdmission = admitted.ok ? admitted.job.ownerKey : null
        ownerObj.rootSessionId = 'MUTATED-AFTER-ADMISSION'
        ownerObj.instanceId = 'MUTATED-AFTER-ADMISSION'
        const recordNow = g.job(String(args.jobId))[0]
        out = { ok: true, keyAtAdmission, keyAfterMutation: recordNow?.ownerKey ?? null }
        break
      }
      case 'canonicalKey':
        // Pure lane math over HOST-derived values, run inside the host process.
        out = { ok: true, key: (await import(directive.gatewayUrl)).jobOwnerKey({ rootSessionId: String(args.owner?.rootSessionId), instanceId: String(args.owner?.instanceId) }) }
        break
      case 'reassemble':
        await buildAssembly(await import(directive.gatewayUrl))
        out = { ok: true, generation }
        break
      default:
        out = { ok: false, error: `unknown op ${String(op)}` }
    }
    record({ leg: 'op', op, out })
    return sendJson(res, 200, out)
  }, 'op')

  register('/__a5w7/assembly', async (req, res) => {
    // The assembly's OWN teardown actions — the window's lifecycle, never the
    // lease handle: no callId, no end(), no acquire() crosses this face.
    let body
    try {
      body = JSON.parse(await readBody(req) || '{}')
    } catch {
      body = {}
    }
    const g = assembly.gateway
    let out
    if (body.action === 'drain') out = g.lease.drain()
    else if (body.action === 'release') out = g.lease.release()
    else if (body.action === 'giveup') out = g.lease.giveUp(String(body.reason ?? 'kit-decision'))
    else out = { ok: false, code: 'unknown-action', detail: String(body.action) }
    record({ leg: 'assembly-action', action: body.action, out, windowState: g.lease.state() })
    return sendJson(res, 200, { ...out, windowState: g.lease.state() })
  }, 'assembly')

  record({ leg: 'routes-registered', generation })
}
