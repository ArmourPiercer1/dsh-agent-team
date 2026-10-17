/**
 * a5w7m-veto-plugin.mjs — the Alpha.5 W7M wiring row for the pr8 M-13 RLW
 * line (Domain tools HPC/RPC/research-state/device): the PR7 jobs-gateway
 * PUBLIC BARREL (repo dist, GLUE-1 build include) plus a row-local DOMAIN
 * MOCK with a CAS-guarded simulated device, assembled through the public
 * profile-patch seam (IF-1: plugin row + public services; no upstream patch,
 * no private API, zero lane-source edits, zero W7-kit edits).
 *
 * WHAT THIS ROW IS
 *
 *   The shape is the W7 row's (a5w7-jobs-wiring/a5w7-jobs-plugin.mjs,
 *   reviewed 22/22 and untouched here): `inject = ['webServer','teamRoot']`,
 *   exact-path routes through the public `webServer.register`, and the lane
 *   consumed ONLY through its public barrel — this time the barrel IS the
 *   repo dist (`packages/runtime/dist/.../jobs-gateway/index.js`, in the
 *   build surface since GLUE-1 @933f2f5d), so the kit needs NO kit-local
 *   compile.
 *
 *   THE ONE LAW THIS ROW EXISTS TO OBSERVE (matrix M-13 criterion):
 *   `TeamPermit ∧ DomainPermit` — whichever side refuses, the other cannot
 *   override, and a veto produces ZERO side effects measured at the
 *   effect-commit point, not claimed. The row therefore funnels EVERY effect
 *   through a single gate (`effectCommit`), which:
 *     - reads TeamPermit from the LIVE gateway (a real `admitJob` against a
 *       host-derived member identity — refusal codes are the lane's own),
 *     - reads DomainPermit from the row-local Domain mock's permit bit,
 *     - re-checks the DOMAIN REFERENCE (never guess a binding: an
 *       unresolved/withdrawn reference is a typed deny even with both
 *       permits true),
 *     - and only then moves the simulated device under CAS (stale expected
 *       version ⇒ interlock refusal, device untouched).
 *   Every decision lands in the interlock ledger with the device version
 *   before and after — that ledger IS the `veto_side_effects` observation.
 *
 * DISCLOSED BOUNDARIES (the honest lines):
 *   - member/owner facts: HOST facts (durable MemberInstance rows read
 *     through the production assembly's repositories — same public read W7
 *     used).
 *   - the DOMAIN side (device, CAS store, permit bits, reference table):
 *     ROW-LOCAL by design — the S0 row's test requirement says "Domain mock
 *     (CAS 状态/模拟设备)"; the pinned host has no such face and this row
 *     invents no host capability (`job_start` stays absent, re-grepped by the
 *     kit, never argued).
 *   - the EFFECT actuator for the granted cell is the HOST's own background
 *     path (`bash run_in_background` → `ctx.jobs` → `job_list`/`job_output`,
 *     file:line recorded by the kit from the pinned tree). A vetoed cell
 *     NEVER invokes it — and the kit measures the zero on the same public
 *     face that shows the granted cell's real job.
 *
 * G-g is cited OPEN only (PENDING-GATES); abort propagation is COOPERATIVE;
 * nothing here promises termination.
 *
 * Kit-provided environment: A5W7M_DIRECTIVE (path of the run directive JSON,
 * also findable at $DSH_HOME/a5w7m-directive.json).
 *
 * @module tests/kits/a5-w7m-m13-domain-veto/a5w7m-veto-plugin
 */
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

/** Cordis row identity (function-plugin protocol: named exports, no default). */
export const name = 'a5w7m-domain-veto'

/** Dependency parking, the p6t6/W7-verified form. */
export const inject = ['webServer', 'teamRoot']

/** The public barrel surface the assembly requires, by name. */
const REQUIRED_EXPORTS = [
  'createJobsGateway', 'createLeaseWindow', 'classifyDispatchEvent',
  'jobOwnerKey', 'projectJobForViewer', 'redactCredentials', 'gatewayRefusal', 'REDACTION_MARKER',
]

let directive = null
let setupError = null
let assembly = null
let generation = 0

// ── row-local DOMAIN MOCK (disclosed: not a host registry fact) ────────────
/** Simulated device under CAS: `version` only ever moves through effectCommit. */
const device = { state: 'IDLE', version: 0 }
/** Domain reference table: ref name -> identity string; null = WITHDRAWN. */
const refTable = new Map()
/** DomainPermit bits per cell (deterministic kit input — the mock's answer). */
const permitBits = new Map()
/** Effect-commit ledger: the ONLY records of a side effect having happened. */
const commits = []
/** Every adjudication decision (all four matrix cells + controls). */
const interlockLog = []
/** Negative-control ledger (A4 observations). */
const negativeControls = []

const readDirective = () => {
  const path = process.env['A5W7M_DIRECTIVE']
    ?? join(process.env['DSH_HOME'] ?? '.', 'a5w7m-directive.json')
  const parsed = JSON.parse(readFileSync(path, 'utf8'))
  if (parsed?.boot !== 1) throw new Error(`a5w7m: directive.boot must be 1 (got ${JSON.stringify(parsed?.boot)})`)
  for (const key of ['runStamp', 'gatewayUrl', 'ledger', 'rootSessionId']) {
    if (typeof parsed[key] !== 'string' || parsed[key] === '') throw new Error(`a5w7m: directive.${key} is required`)
  }
  if (!Array.isArray(parsed.memberRootSessionIds)) throw new Error('a5w7m: directive.memberRootSessionIds must be an array')
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

/** Definition reader for the gateway's C-BIND re-read: the row-local ref
 *  table (disclosed store, same boundary W7 disclosed for its definitions). */
function resolveDefinition(scopeKey, name) {
  const key = `${String(scopeKey)}\u0000${String(name)}`
  if (!refTable.has(key)) return { ok: false, identity: 'never-registered' }
  const identity = refTable.get(key)
  return identity === null ? { ok: false, identity: 'withdrawn' } : { ok: true, identity }
}

/** Build one assembly generation from the lane's PUBLIC BARREL (dist). */
async function buildAssembly(mod) {
  generation += 1
  const gateway = mod.createJobsGateway({
    resolveDefinition,
    onObserve: (o) => record({ leg: 'gateway-observation', generation, ...o }),
  })
  assembly = { gateway, builtAt: new Date().toISOString() }
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

/**
 * THE EFFECT-COMMIT GATE — the single funnel every effect of this assembly
 * must pass. Order of checks is part of the observation:
 *   1. dual-permit conjunction (Team ∧ Domain — neither overrides the other);
 *   2. domain reference resolution (fail-closed: no guessed bindings, the
 *      matrix's "未确定引用 fail-closed" leg);
 *   3. CAS on the simulated device (stale version ⇒ interlock refusal,
 *      device untouched).
 * A refusal NEVER touches the device and never raises the commit count —
 * the ledger carries the unchanged version as the positive zero record.
 */
function effectCommit({ cellId, teamPermit, teamCode, ref, expectedVersion }) {
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
      // Both permits say yes but the DOMAIN REFERENCE cannot be resolved:
      // fail-closed typed deny. The binding is never guessed.
      decision.outcome = 'denied'
      decision.error = 'DOMAIN_DENIED'
      decision.detail = `domain-reference-unresolved:${String(ref)}`
      decision.guessed_binding = false
    } else if (device.version !== expectedVersion) {
      decision.outcome = 'interlock-refused'
      decision.error = 'cas-version-conflict'
      decision.detail = `expected=${String(expectedVersion)} actual=${String(device.version)}`
    } else {
      device.version = device.version + 1
      device.state = `COMMITTED-${String(cellId)}`
      commits.push({
        cellId: String(cellId), ref: String(ref), identity,
        versionBefore: device.version - 1, versionAfter: device.version,
        at: decision.at,
      })
      decision.outcome = 'granted'
      decision.effect_committed = true
      decision.device_version_after = device.version
    }
  } else {
    // VETO: at least one side refused. The other side cannot override.
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
    setupError = 'a5w7m: the webServer service is missing despite the inject declaration'
    return
  }
  const failRoute = () => {
    ctx.effect(() => webServer.register({
      kind: 'exact',
      path: '/__a5w7m/health',
      handler: (_req, res) => sendJson(res, 200, { ok: false, setupError }),
    }, 'a5w7m failure health route'), 'a5w7m-fail-health')
  }
  if (setupError !== null) {
    failRoute()
    return
  }
  const teamRoot = ctx.get('teamRoot')
  if (teamRoot === undefined) {
    setupError = 'a5w7m: teamRoot is missing despite the inject declaration'
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
    ctx.effect(() => webServer.register({ kind: 'exact', path, handler }, `a5w7m ${label}`), `a5w7m ${label}`)
  }

  register('/__a5w7m/health', (_req, res) => {
    sendJson(res, 200, {
      ok: true,
      boot: 1,
      gateway: 'assembled',
      barrel: 'repo-dist-public-barrel',
      generation,
      publicExports: REQUIRED_EXPORTS,
      runStamp: directive.runStamp,
    })
  }, 'health')

  register('/__a5w7m/state', (_req, res) => {
    const g = assembly.gateway
    let roster = []
    try {
      roster = (teamRoot.tools?.tools ?? []).map((t) => String(t?.name ?? ''))
    } catch {
      roster = []
    }
    sendJson(res, 200, {
      generation,
      windowState: g.lease.state(),
      outstandingCallIds: g.lease.outstanding().map((t) => t.callId),
      jobs: g.job('*').map((r) => ({
        jobId: r.jobId, ownerKey: r.ownerKey, scopeKey: r.scopeKey, toolName: r.toolName,
        pinnedIdentity: r.pinnedIdentity, state: r.state, cancelRequested: r.cancelRequested,
        outcome: r.outcome, evidenceEvents: r.evidence.map((e) => e.event),
      })),
      device: { ...device },
      refTable: Object.fromEntries([...refTable.entries()]),
      permitBits: Object.fromEntries([...permitBits.entries()]),
      commits,
      interlockLog,
      negativeControls,
      roster,
      rosterHasJobStart: roster.some((n) => /job[_-]?start/i.test(n)),
      durableMembers: durableMembers(teamRoot),
    })
  }, 'state')

  register('/__a5w7m/op', async (req, res) => {
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
      // Deterministic input side of the Domain mock (kit arms these BEFORE a
      // cell runs; the mock's answer is the DomainPermit).
      case 'permitArm':
        permitBits.set(String(args.cellId), args.domainPermit === true)
        out = { ok: true, cellId: String(args.cellId), domain_permit: permitBits.get(String(args.cellId)) === true }
        break
      case 'refPut':
        refTable.set(`${String(args.scopeKey)}\u0000${String(args.name)}`, String(args.identity))
        refTable.set(String(args.name), String(args.identity))
        out = { ok: true, source: 'row-local-domain-reference-table (disclosed: NOT a host registry fact)' }
        break
      case 'refWithdraw':
        refTable.set(String(args.name), null)
        out = { ok: true, source: 'row-local-domain-reference-table (disclosed)' }
        break
      // The gateway's TeamPermit leg, exposed raw (anchor pre-lease + hygiene).
      case 'admit':
        out = g.admitJob({
          jobId: String(args.jobId),
          owner: { rootSessionId: String(args.owner?.rootSessionId), instanceId: String(args.owner?.instanceId) },
          scopeKey: String(args.scopeKey ?? 'kit'),
          toolName: String(args.toolName ?? 'a5w7m_tool'),
          pinnedIdentity: String(args.pinnedIdentity ?? 'def-v1'),
        })
        break
      case 'observe':
        out = g.observeDispatchEvent(args.event)
        break
      /**
       * ONE MATRIX CELL, end to end: the TeamPermit is the LIVE gateway's
       * own verdict on this request (admitJob with a host-derived member
       * identity), the DomainPermit is the mock's armed bit, and the effect
       * passes the single gate. The row returns the adjudication row exactly
       * as the matrix vocabulary words it.
       */
      case 'cellRun': {
        const admitted = g.admitJob({
          jobId: String(args.jobId),
          owner: { rootSessionId: String(args.owner?.rootSessionId), instanceId: String(args.owner?.instanceId) },
          scopeKey: String(args.scopeKey ?? 'a5w7m-scope'),
          toolName: String(args.toolName ?? 'a5w7m_tool'),
          pinnedIdentity: String(args.pinnedIdentity ?? 'def-v1'),
        })
        const teamPermit = admitted.ok === true
        const decision = effectCommit({
          cellId: String(args.cellId),
          teamPermit,
          teamCode: teamPermit ? null : (admitted.code ?? 'team-refused'),
          ref: String(args.ref),
          expectedVersion: Number(args.expectedVersion),
        })
        out = { ok: true, team_leg: admitted.ok ? { ok: true, jobId: admitted.job.jobId } : { ok: false, code: admitted.code }, ...decision }
        break
      }
      /**
       * NEGATIVE CONTROLS (A4). `unresolved-domain-reference` /
       * `withdrawn-domain-reference`: BOTH permits are armed true and the
       * team leg genuinely admits — the deny comes from the reference being
       * unresolvable, which is the fail-closed law, not a permit veto.
       * `cas-stale-version`: permits and reference fine, a STALE expected
       * version — the CAS interlock must refuse and leave the device alone.
       */
      case 'negativeControl': {
        const attempt = String(args.attempt)
        let decision
        if (attempt === 'unresolved-domain-reference') {
          const admitted = g.admitJob({
            jobId: String(args.jobId), owner: { rootSessionId: String(args.owner?.rootSessionId), instanceId: String(args.owner?.instanceId) },
            scopeKey: 'a5w7m-scope', toolName: String(args.toolName ?? 'a5w7m_neg_unresolved'), pinnedIdentity: 'def-v1',
          })
          decision = effectCommit({ cellId: String(args.cellId), teamPermit: admitted.ok === true, teamCode: admitted.ok ? null : admitted.code, ref: String(args.ref ?? 'a5w7m-ref-NEVER-REGISTERED'), expectedVersion: Number(args.expectedVersion ?? device.version) })
        } else if (attempt === 'withdrawn-domain-reference') {
          refTable.set(String(args.ref), null)
          const admitted = g.admitJob({
            jobId: String(args.jobId), owner: { rootSessionId: String(args.owner?.rootSessionId), instanceId: String(args.owner?.instanceId) },
            scopeKey: 'a5w7m-scope', toolName: String(args.toolName ?? 'a5w7m_neg_withdrawn'), pinnedIdentity: 'def-v1',
          })
          decision = effectCommit({ cellId: String(args.cellId), teamPermit: admitted.ok === true, teamCode: admitted.ok ? null : admitted.code, ref: String(args.ref), expectedVersion: Number(args.expectedVersion ?? device.version) })
        } else if (attempt === 'cas-stale-version') {
          const admitted = g.admitJob({
            jobId: String(args.jobId), owner: { rootSessionId: String(args.owner?.rootSessionId), instanceId: String(args.owner?.instanceId) },
            scopeKey: 'a5w7m-scope', toolName: String(args.toolName ?? 'a5w7m_neg_cas'), pinnedIdentity: 'def-v1',
          })
          decision = effectCommit({ cellId: String(args.cellId), teamPermit: admitted.ok === true, teamCode: admitted.ok ? null : admitted.code, ref: String(args.ref), expectedVersion: Number(args.expectedVersion) })
        } else {
          out = { ok: false, error: `unknown negative control ${attempt}` }
          break
        }
        const entry = {
          attempt,
          outcome: decision.outcome === 'denied' && decision.error === 'DOMAIN_DENIED' ? 'typed-deny' : decision.outcome,
          error: decision.error ?? null,
          detail: decision.detail ?? null,
          guessed_binding: decision.guessed_binding ?? false,
          device_version_before: decision.device_version_before,
          device_version_after: decision.device_version_after,
          at: decision.at,
        }
        negativeControls.push(entry)
        out = { ok: true, entry, team_leg_ok: !String(args.attempt).startsWith('cas-') ? decision.team_permit : decision.team_permit }
        break
      }
      /** After the granted cell's REAL host actuator ran (bash background
       *  job observed through job_list/job_output), annotate the cell with
       *  the cross-boundary fact. Veto cells never get here (the kit only
       *  calls this after the allow-leg observation), and their ledgers
       *  keep `actuator_invoked:false`. */
      case 'annotateActuator': {
        const d = interlockLog.find((x) => x.cellId === String(args.cellId) && x.outcome === 'granted')
        if (d === undefined) { out = { ok: false, error: 'no granted cell to annotate' }; break }
        d.actuator_invoked = true
        d.actuator = 'host-tool-bash:run_in_background'
        d.observed_via = 'host-tool-jobs:job_list+job_output'
        d.host_job_id = String(args.hostJobId ?? '')
        record({ leg: 'annotate-actuator', cellId: String(args.cellId), host_job_id: d.host_job_id })
        out = { ok: true, cellId: String(args.cellId), actuator_invoked: true }
        break
      }
      default:
        out = { ok: false, error: `unknown op ${String(op)}` }
    }
    record({ leg: 'op', op, out })
    return sendJson(res, 200, out)
  }, 'op')

  register('/__a5w7m/lease', async (req, res) => {
    // The assembly's OWN lifecycle actions — the window's STATE, never the
    // lease handle: no callId, no end(), no acquire() crosses this face
    // (review-LaneF condition 3, same discipline as the reviewed W7 row).
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
