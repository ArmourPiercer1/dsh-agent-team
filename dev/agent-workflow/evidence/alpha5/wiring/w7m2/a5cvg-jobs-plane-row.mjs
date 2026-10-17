/**
 * a5cvg-jobs-plane-row.mjs — the Alpha.5 W7M-2 wiring row: the PR7
 * jobs-gateway PUBLIC BARREL (repo dist) assembled around the HOST's OWN
 * public jobs registry (`ctx.jobs` — the `@deepseek-ai/dsh-jobs` abstract
 * seam, service id 'jobs'), observed through exact-path routes on the public
 * `webServer.register` face. Public profile-patch seam only; zero upstream
 * patch, zero lane-source edits, zero glue edits.
 *
 * WHY THIS ROW EXISTS (the W7M-2 question)
 *
 *   W7M-A3a booked the real-registration trio on a PLAIN ordinary session,
 *   because the lane's OWN Permission Coverage Gate
 *   (packages/runtime/operation-permission/permission-coverage.ts) makes the
 *   model-facing `job_*` trio a FATAL known-sensitive-unmanaged finding on
 *   any surface that declares `capabilities.permissions`. This row asks the
 *   narrow follow-up: on a GOVERNED team whose templates take the gate's own
 *   prescribed remediation (`builtinToolDeny` removes the model-facing job_*
 *   trio — the capability-layer removal the gate's remediation text names),
 *   does the HOST jobs PLANE still register and fence for the governed
 *   members, with allow/deny adjudicated by the lane's own gateway law?
 *
 *   The row therefore funnels every effect through ONE gate:
 *     1. TeamPermit   — a real `admitJob` on the live lane gateway against a
 *                       HOST-derived durable member identity (refusal codes
 *                       are the lane's own),
 *     2. DomainPermit — the row-local Domain mock's armed bit (disclosed),
 *     3. domain reference + CAS device interlock (fail-closed),
 *     4. the ACTUATOR — the host's OWN `ctx.jobs.start` with a real spawned
 *                       producer process, owner = the member's real child
 *                       session id (the registry's own owner fence).
 *   A veto at any step invokes NO actuator; the registry is the zero meter.
 *
 *   Observation faces are the host's own public registry calls:
 *   `list(caller)`, `get(id, caller)`, `readAt(id, from, caller)` — the same
 *   per-session fence the `job_*` tools and the `job` Remote namespace use.
 *
 * DISCLOSED BOUNDARIES
 *   - member/owner facts: HOST facts (durable MemberInstance rows read
 *     through the production assembly's repositories — same public read W7/
 *     W7M used);
 *   - the DOMAIN side (device/CAS/permit bits/reference table): row-local by
 *     design (the M-13 row's own test requirement words it "Domain mock");
 *   - the row-driven actuator is ROW-DRIVEN (the lane assembly face), NOT a
 *     model tool call — the model-driven registration leg runs separately
 *     through the real bash tool edge in the governed LEADER session;
 *   - `jobs.start` may refuse per its own invariant ("start refuses work
 *     while no attached job controller serves the spec's owner"): a refusal
 *     is recorded VERBATIM as a measured gap, never retried away.
 *
 * Kit-provided environment: A5CVG_DIRECTIVE (path of the run directive JSON).
 *
 * @module evidence/alpha5/wiring/w7m2/a5cvg-jobs-plane-row
 */
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join } from 'node:path'

/** Cordis row identity (function-plugin protocol: named exports, no default). */
export const name = 'a5cvg-jobs-plane'

/** The host's own jobs registry is a public cordis service (ctx.jobs). */
export const inject = ['webServer', 'teamRoot', 'jobs']

const REQUIRED_EXPORTS = [
  'createJobsGateway', 'createLeaseWindow', 'classifyDispatchEvent',
  'jobOwnerKey', 'projectJobForViewer', 'redactCredentials', 'gatewayRefusal', 'REDACTION_MARKER',
]

let directive = null
let setupError = null
let assembly = null
let generation = 0

// ── row-local DOMAIN MOCK (disclosed: not a host registry fact) ────────────
const device = { state: 'IDLE', version: 0 }
const refTable = new Map()
const permitBits = new Map()
const commits = []
const interlockLog = []

const readDirective = () => {
  const path = process.env['A5CVG_DIRECTIVE']
    ?? join(process.env['DSH_HOME'] ?? '.', 'a5cvg-directive.json')
  const parsed = JSON.parse(readFileSync(path, 'utf8'))
  if (parsed?.boot !== 1) throw new Error(`a5cvg: directive.boot must be 1 (got ${JSON.stringify(parsed?.boot)})`)
  for (const key of ['runStamp', 'gatewayUrl', 'ledger', 'rootSessionId']) {
    if (typeof parsed[key] !== 'string' || parsed[key] === '') throw new Error(`a5cvg: directive.${key} is required`)
  }
  if (!Array.isArray(parsed.memberRootSessionIds)) throw new Error('a5cvg: directive.memberRootSessionIds must be an array')
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

function resolveDefinition(scopeKey, name) {
  const key = `${String(scopeKey)}\u0000${String(name)}`
  if (!refTable.has(key)) return { ok: false, identity: 'never-registered' }
  const identity = refTable.get(key)
  return identity === null ? { ok: false, identity: 'withdrawn' } : { ok: true, identity }
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

/** The registry's own fence errors are typed refusals — surface them verbatim. */
function safeRegistry(label, fn) {
  try {
    return { ok: true, value: fn() }
  } catch (error) {
    const text = String(error?.message ?? error)
    record({ leg: 'registry-refusal', face: label, error: text })
    return { ok: false, refusal: text }
  }
}

function viewLine(v) {
  return {
    id: String(v.id), kind: String(v.kind), label: String(v.label),
    owner: v.owner === undefined ? null : String(v.owner),
    status: String(v.status),
    outputTotal: v.output?.total,
    startedAt: v.startedAt, finishedAt: v.finishedAt ?? null, detail: v.detail ?? null,
  }
}

/**
 * THE ACTUATOR — the host's OWN ctx.jobs.start with a REAL spawned producer,
 * owner = the member's real child session (registry-level owner fence).
 * A refusal from the registry (e.g. its no-attached-controller invariant)
 * propagates as a typed refusal to the caller and is NEVER retried.
 */
function startRealJob(jobs, { ownerSessionId, label, marker }) {
  return jobs.start({
    kind: 'a5cvg',
    label: String(label),
    owner: String(ownerSessionId),
    run: (handle) => {
      const child = spawn('/bin/bash', ['-c', `echo ${String(marker)} && sleep 1 && echo ${String(marker)}_END`], {
        stdio: ['ignore', 'pipe', 'pipe'],
      })
      child.stdout.on('data', (b) => { try { handle.append(String(b), { channel: 'stdout' }) } catch { /* settled */ } })
      child.stderr.on('data', (b) => { try { handle.append(String(b), { channel: 'stderr' }) } catch { /* settled */ } })
      const done = new Promise((resolve) => {
        child.on('close', (code, signal) => {
          resolve(code === 0
            ? { status: 'completed' }
            : { status: signal === 'SIGTERM' ? 'killed' : 'failed', detail: `exit code: ${String(code)}${signal === null ? '' : ` signal ${String(signal)}`}` })
        })
        child.on('error', (e) => resolve({ status: 'failed', detail: String(e?.message ?? e) }))
      })
      return {
        cancel: () => { try { child.kill('SIGTERM') } catch { /* already gone */ } },
        done,
      }
    },
  })
}

/**
 * THE EFFECT-COMMIT GATE — the single funnel. Order is part of the
 * observation: dual-permit conjunction -> domain reference -> CAS device ->
 * registry actuator. A refusal NEVER touches the device, NEVER calls
 * ctx.jobs, and lands in the ledger as a positive zero record.
 */
function effectCommit({ cellId, teamPermit, teamCode, ref, expectedVersion }, act) {
  const domainPermit = permitBits.get(cellId) === true
  const decision = {
    cellId,
    team_permit: teamPermit === true,
    domain_permit: domainPermit,
    team_refusal_code: teamPermit === true ? null : (teamCode ?? null),
    ref: String(ref),
    device_version_before: device.version,
    at: new Date().toISOString(),
  }
  if (decision.team_permit && domainPermit) {
    const identity = refTable.get(String(ref))
    if (identity === undefined || identity === null) {
      decision.outcome = 'denied'
      decision.error = 'DOMAIN_DENIED'
      decision.detail = `domain-reference-unresolved:${String(ref)}`
      decision.actuator_invoked = false
    } else if (device.version !== expectedVersion) {
      decision.outcome = 'interlock-refused'
      decision.error = 'cas-version-conflict'
      decision.detail = `expected=${String(expectedVersion)} actual=${String(device.version)}`
      decision.actuator_invoked = false
    } else {
      decision.actuator_invoked = true
      const started = safeRegistry('actuator:start', () => act())
      if (started.ok === false) {
        // The HOST registry itself refused the registration: typed, verbatim,
        // device untouched (the actuator is the effect; no effect => no move).
        decision.outcome = 'actuator-refused'
        decision.error = 'REGISTRY_REFUSED'
        decision.detail = started.refusal
        decision.effect_committed = false
      } else {
        device.version = device.version + 1
        device.state = `COMMITTED-${String(cellId)}`
        commits.push({ cellId: String(cellId), ref: String(ref), identity, jobId: String(started.value), versionBefore: device.version - 1, versionAfter: device.version, at: decision.at })
        decision.outcome = 'granted'
        decision.effect_committed = true
        decision.registry_job_id = String(started.value)
        decision.device_version_after = device.version
      }
    }
  } else {
    decision.outcome = 'denied'
    decision.error = domainPermit === false ? 'DOMAIN_DENIED' : String(teamCode ?? 'team-refused')
    decision.effect_committed = false
    decision.actuator_invoked = false
  }
  decision.device_version_after = device.version
  interlockLog.push(decision)
  record({ leg: 'effect-commit-gate', ...decision })
  return decision
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
    setupError = 'a5cvg: the webServer service is missing despite the inject declaration'
    return
  }
  const failRoute = () => {
    ctx.effect(() => webServer.register({
      kind: 'exact',
      path: '/__a5cvg/health',
      handler: (_req, res) => sendJson(res, 200, { ok: false, setupError }),
    }, 'a5cvg failure health route'), 'a5cvg-fail-health')
  }
  if (setupError !== null) {
    failRoute()
    return
  }
  const teamRoot = ctx.get('teamRoot')
  if (teamRoot === undefined) {
    setupError = 'a5cvg: teamRoot is missing despite the inject declaration'
    failRoute()
    return
  }
  const jobs = ctx.get('jobs')
  if (jobs === undefined) {
    setupError = 'a5cvg: ctx.jobs (the public @deepseek-ai/dsh-jobs registry seam) is missing despite the inject declaration'
    failRoute()
    return
  }
  try {
    const mod = await import(directive.gatewayUrl)
    const missing = REQUIRED_EXPORTS.filter((n) => mod[n] === undefined)
    if (missing.length > 0) throw new Error(`public barrel misses ${missing.join(', ')}`)
    await teamRoot.ready
    generation += 1
    const gateway = mod.createJobsGateway({
      resolveDefinition,
      onObserve: (o) => record({ leg: 'gateway-observation', generation, ...o }),
    })
    assembly = { gateway, builtAt: new Date().toISOString() }
    record({ leg: 'assembly-built', generation, gatewayUrl: directive.gatewayUrl, jobsPlane: 'ctx.jobs injected' })
  } catch (error) {
    setupError = error instanceof Error ? error.message : String(error)
    record({ leg: 'assembly-failed', error: setupError })
    failRoute()
    return
  }

  const register = (path, handler, label) => {
    ctx.effect(() => webServer.register({ kind: 'exact', path, handler }, `a5cvg ${label}`), `a5cvg ${label}`)
  }

  register('/__a5cvg/health', (_req, res) => {
    sendJson(res, 200, {
      ok: true,
      boot: 1,
      gateway: 'assembled',
      barrel: 'repo-dist-public-barrel',
      jobsPlane: 'ctx.jobs injected (public @deepseek-ai/dsh-jobs seam)',
      generation,
      publicExports: REQUIRED_EXPORTS,
      runStamp: directive.runStamp,
    })
  }, 'health')

  register('/__a5cvg/state', (_req, res) => {
    const g = assembly.gateway
    sendJson(res, 200, {
      generation,
      windowState: g.lease.state(),
      jobs: g.job('*').map((r) => ({
        jobId: r.jobId, ownerKey: r.ownerKey, scopeKey: r.scopeKey, toolName: r.toolName,
        pinnedIdentity: r.pinnedIdentity, state: r.state, outcome: r.outcome,
      })),
      device: { ...device },
      refTable: Object.fromEntries([...refTable.entries()]),
      permitBits: Object.fromEntries([...permitBits.entries()]),
      commits,
      interlockLog,
      durableMembers: durableMembers(teamRoot),
    })
  }, 'state')

  register('/__a5cvg/op', async (req, res) => {
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
      case 'permitArm':
        permitBits.set(String(args.cellId), args.domainPermit === true)
        out = { ok: true, cellId: String(args.cellId), domain_permit: permitBits.get(String(args.cellId)) === true }
        break
      case 'refPut':
        refTable.set(`${String(args.scopeKey)}\u0000${String(args.name)}`, String(args.identity))
        refTable.set(String(args.name), String(args.identity))
        out = { ok: true, source: 'row-local-domain-reference-table (disclosed: NOT a host registry fact)' }
        break
      case 'admit':
        out = g.admitJob({
          jobId: String(args.jobId),
          owner: { rootSessionId: String(args.owner?.rootSessionId), instanceId: String(args.owner?.instanceId) },
          scopeKey: String(args.scopeKey ?? 'a5cvg-scope'),
          toolName: String(args.toolName ?? 'a5cvg_tool'),
          pinnedIdentity: String(args.pinnedIdentity ?? 'def-v1'),
        })
        break
      case 'observe':
        out = g.observeDispatchEvent(args.event)
        break
      case 'cellRun': {
        const admitted = g.admitJob({
          jobId: String(args.jobId),
          owner: { rootSessionId: String(args.owner?.rootSessionId), instanceId: String(args.owner?.instanceId) },
          scopeKey: String(args.scopeKey ?? 'a5cvg-scope'),
          toolName: String(args.toolName ?? 'a5cvg_tool'),
          pinnedIdentity: String(args.pinnedIdentity ?? 'def-v1'),
        })
        const teamPermit = admitted.ok === true
        const decision = effectCommit({
          cellId: String(args.cellId),
          teamPermit,
          teamCode: teamPermit ? null : (admitted.code ?? 'team-refused'),
          ref: String(args.ref),
          expectedVersion: Number(args.expectedVersion),
        }, () => startRealJob(jobs, {
          ownerSessionId: String(args.owner?.childSessionId),
          label: `a5cvg cell ${String(args.cellId)}: ${String(args.jobId)}`,
          marker: String(args.marker ?? 'A5CVG_EFFECT'),
        }))
        decision.team_admission = { ok: admitted.ok === true, code: admitted.ok === true ? null : (admitted.code ?? 'team-refused') }
        out = { ok: true, decision, owner: { rootSessionId: String(args.owner?.rootSessionId), instanceId: String(args.owner?.instanceId), childSessionId: String(args.owner?.childSessionId ?? '') } }
        break
      }
      // ── the host registry's OWN public faces, caller-fenced ─────────────
      case 'list':
        out = safeRegistry('list', () => jobs.list(String(args.caller)).map(viewLine))
        break
      case 'listAll':
        out = safeRegistry('listAll', () => jobs.list().map(viewLine))
        break
      case 'get':
        out = safeRegistry('get', () => viewLine(jobs.get(String(args.jobId), String(args.caller))))
        break
      case 'readOutput':
        out = safeRegistry('readAt', () => {
          const r = jobs.readAt(String(args.jobId), Number(args.from ?? 0), String(args.caller))
          return {
            text: r.chunks.map((c) => c.text ?? '').join(''),
            next: r.next, lossy: r.lossy === true,
          }
        })
        break
      case 'wait': {
        const caller = String(args.caller)
        const id = String(args.jobId)
        out = await jobs.wait(id, Number(args.timeoutMs ?? 20_000), caller)
          .then((v) => ({ ok: true, value: viewLine(v) }))
          .catch((error) => ({ ok: false, refusal: String(error?.message ?? error) }))
        break
      }
      default:
        out = { ok: false, error: `unknown op ${String(op)}` }
    }
    record({ leg: 'op', op, out: JSON.stringify(out).slice(0, 400) })
    return sendJson(res, 200, out)
  }, 'op')

  register('/__a5cvg/lease', async (req, res) => {
    // The assembly's OWN lifecycle actions — the window's STATE, never the
    // lease handle (same discipline as the reviewed W7/W7M rows).
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
    else out = { ok: false, code: 'unknown-action', detail: String(body.action) }
    record({ leg: 'assembly-action', action: body.action, out, windowState: g.lease.state() })
    return sendJson(res, 200, { ...out, windowState: g.lease.state() })
  }, 'lease')

  record({ leg: 'routes-registered', generation })
}
