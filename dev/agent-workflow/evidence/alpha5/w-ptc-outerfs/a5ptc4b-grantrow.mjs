/**
 * a5ptc4b-grantrow.mjs — W-PTC-OUTERFS-L2 assembly row: the per-call fs resolver
 * driven by REAL one-time TEAM-PLANE Grants (T-1..T-5 of the independent security
 * review of a5ptc4-row.mjs @903c062f — see review-SECURITY.md §7 "L2 归属+消费级").
 *
 * The reviewed L1 row decided on a token string the model carried inside its own
 * `justification` (findings F-1 attribution / F-2 replay / F-3 revocation /
 * F-4 no TTL / F-5 uninstall asymmetry). This row deletes that channel and fixes
 * all five:
 *
 *  T-1 ATTRIBUTION — the ONLY adjudication input is a Grant RECORD bound to the
 *      four HOST-owned fields of the ask: (agent/session, callId, toolName,
 *      requestedMode). `requestedMode` is read from the HOST-COMPOSED prefix of
 *      `reason` (`escalate sandbox to <mode>: ` — packages/sandbox/sandbox/lib/
 *      index.js:109) and must be a member of the host's closed
 *      ESCALATION_TARGETS set (public barrel). Everything after that prefix is
 *      model text: it is logged ONLY (field `modelTextLog`) and no decision path
 *      reads it. There is no token channel: no grant route, no token regex.
 *      Asks whose agent is not on this Team's roster are delegated untouched and
 *      verbatim via next(), and the delegation row lands in the PUBLIC approvals
 *      census (review F-6 fixed as a side effect).
 *
 *  T-2 SINGLE CONSUMPTION — a Grant answers at most one ask. consume() is a
 *      synchronous check-and-set inside one JS turn (no await between read and
 *      write), so neither a second registration face nor a racing ask can draw
 *      the same record twice. Re-presenting a spent quadruple is refused.
 *
 *  T-3 REVOCATION BEFORE CACHE — lookup order is GRANTS FIRST, history second,
 *      and the history/consumed table can NEVER produce a grant: it only refuses,
 *      and only while unexpired. Revoked records refuse; a spent record never
 *      re-answers; once it is also expired it stops answering altogether (the
 *      live Team lane is asked again).
 *
 *  T-4 TTL — every Grant carries expiresAt; an expired record refuses and the
 *      refusal is downstream-visible (closed outcome 'rejected' → the host's
 *      verbatim fail-closed text at the caller, zero execution). A held ask also
 *      carries the lane's own deadline: no lane decision within it = refusal,
 *      never a hang.
 *
 *  T-5 SYMMETRIC UNLOAD — every listener/tool registration keeps its disposer and
 *      the Team lane can unload the resolver (`a5ptc4b_unload`); the hook census
 *      proves the {global,prepend} face is gone, and a later ask in the same
 *      Team's domain is then answered by us ZERO times.
 *
 * Grant issuance channel (the substance of "real Team plane"): the only way a
 * Grant enters this ledger is a TOOL CALL by the provisioned TEAM-LANE actor — a
 * separate session/agent in the world (the ask-lane leader/human resolver
 * stand-in) that reaches the host through the host's own authenticated session
 * API, so the call is dispatched as that agent's own tool call. The issuer
 * recorded on every Grant is the host agent object the tool was registered on,
 * not a string the caller typed. The plugin's own HTTP faces are read-only
 * census plus provisioning: no HTTP face mints, flips or revokes a Grant, and
 * the model of the session being adjudicated has no path to the lane tools
 * (they are registered on the lane agent's own ctx only).
 *
 * Public faces only (zero Core change): profile-patch plugin row,
 * `ctx.sandbox.internals.landlockLauncher` deployment test-hook, the
 * `approval/request` waterfall via ctx.on (documented {global,prepend}) and the
 * per-agent ctx face, defineTool + agent.ctx.tools.register / tools.guard /
 * presentAs, ctx.on('tools/execute') around-seam, ctx.webServer.register.
 *
 * Env: A5PTC4B_ASSEMBLE ('1' GREEN / '0' RED: witnesses only, no adjudication),
 *      A5PTC4B_TESTUSE, A5PTC4B_LEDGER, A5PTC4B_LAUNCHER, A5PTC4B_RUN,
 *      A5PTC4B_ASK_TTL_MS (lane hold deadline, default 12000).
 *
 * @module dev/agent-workflow/evidence/alpha5/w-ptc-outerfs/a5ptc4b-grantrow
 */
import { appendFileSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const name = 'a5ptc4b-grantrow'
export const inject = ['webServer', 'agents', 'sandbox', 'sandboxPolicy']

const ASSEMBLE = (process.env.A5PTC4B_ASSEMBLE ?? '0') === '1'
// OS floor (Landlock launcher test-hook) deployment: independent of ASSEMBLE on
// purpose, so the RED control world differs ONLY by the absent adjudication faces.
const OSFLOOR = (process.env.A5PTC4B_OS ?? '1') === '1'
const TESTUSE = process.env.A5PTC4B_TESTUSE ?? ''
const LEDGER = process.env.A5PTC4B_LEDGER ?? ''
const LAUNCHER = process.env.A5PTC4B_LAUNCHER ?? ''
const RUN = process.env.A5PTC4B_RUN ?? 'run'
const ASK_TTL_MS = Math.max(1000, Number(process.env.A5PTC4B_ASK_TTL_MS ?? 12000))

const URLS = {
  tools: pathToFileURL(join(TESTUSE, 'packages/core/tools/lib/index.js')).href,
  sandbox: pathToFileURL(join(TESTUSE, 'packages/sandbox/sandbox/lib/index.js')).href,
}

// Host's closed escalation-target set (public barrel); fallback only if the
// dynamic import is unavailable, and the census reports which source was used.
const TARGETS_FALLBACK = ['workspace-write', 'danger-full-access']
const HOST_PREFIX = /^escalate sandbox to ([a-z-]+): /

const JOURNAL = []
function record(row) {
  const line = JSON.stringify({ at: new Date().toISOString(), ...row })
  if (LEDGER !== '') {
    try { mkdirSync(dirname(LEDGER), { recursive: true }); appendFileSync(LEDGER, line + '\n') } catch { /* journal copy stands */ }
  }
  try { JOURNAL.push(JSON.parse(line)) } catch { /* push below */ JOURNAL.push({ ...row }) }
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}
const slug = (v) => String(v ?? 'untagged').replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 80)
const agentLabel = (agent) => slug(agent?.id ?? agent?.session?.header?.id ?? agent?.scopeKey ?? 'unknown')
const now = () => Date.now()

// ── Team roster (PROVISIONING, not adjudication): which host agents belong to
// this Team lane. Membership only decides WHICH ASKS WE ADJUDICATE — it
// authorizes nothing: a rostered member with no lane Grant gets zero answer. ──
const ROSTER = new Map()

// ── Grant ledger ─────────────────────────────────────────────────────────────
const GRANTS = new Map() // grantId -> record
const BY_KEY = new Map() // bindKey -> grantId[] (issuance order)
const PENDING = new Map() // bindKey -> held-ask handle (Team lane hold)
const ASKS = [] // public per-callId census: decisions AND delegation rows
const SEEN = new WeakSet() // one request object = one decision, whatever faces it reaches
const MINE = new Set() // fn-source tags of our own approval listeners (hook census)
let askSeq = 0
let grantSeq = 0
let uninstalled = false

const DISPOSERS = [] // T-5: every registration keeps its disposer
const RESOLVER_DISPOSERS = []
// Read-only mirror of the HOST ask lane: `session.append` publishes the public
// `session/event` bus call with args [session, event] for every event, so a
// global observer sees approval/asked (what the host lane RECEIVED, byte-verbatim)
// and approval/decided (who decided it). It answers nothing — a listener on an
// event bus contributes no decision — and it is disposed with the rest of us.
const ASK_EVENTS = []

const bindKey = (b) => `${b.agent}|${b.callId}|${b.toolName}|${b.mode}`
const iso = (ms) => new Date(ms).toISOString()
const grantView = (g) => ({
  grantId: g.grantId, via: g.via, source: g.source, decision: g.decision, state: g.state,
  bind: g.bind, issuerLane: g.issuerLane, ttlMs: g.ttlMs,
  issuedAt: iso(g.issuedAt), expiresAt: iso(g.expiresAt), expired: now() >= g.expiresAt,
  consumedAt: g.consumedAt === undefined ? null : iso(g.consumedAt),
  consumedByAskSeq: g.consumedByAskSeq ?? null,
  revokedAt: g.revokedAt === undefined ? null : iso(g.revokedAt),
  transitions: g.transitions,
})

/**
 * T-3 GRANTS-FIRST + T-4 TTL + T-2 consumed semantics. Pure read: state
 * transitions happen only in consume()/markExpired(), both synchronous.
 */
function adjudicateRecords(key) {
  const ids = BY_KEY.get(key) ?? []
  for (let i = ids.length - 1; i >= 0; i -= 1) {
    const g = GRANTS.get(ids[i])
    if (g === undefined) continue
    if (g.state === 'revoked') return { kind: 'revoked', g }
    if (g.state === 'consumed') {
      // The ANSWERED-role: an unexpired spent record can only REFUSE.
      if (now() < g.expiresAt) return { kind: 'consumed', g }
      continue // spent AND stale: stops answering entirely; the lane is asked again
    }
    if (g.state !== 'issued') continue
    if (now() >= g.expiresAt) return { kind: 'expired', g }
    return { kind: 'live', g }
  }
  return { kind: 'none' }
}

/** T-2 atomic single consumption (synchronous check-and-set, one JS turn). */
function consume(g, askSeqNo, outcome) {
  if (g.state !== 'issued') return false
  if (now() >= g.expiresAt) { markExpired(g); return false }
  g.state = 'consumed'
  g.consumedAt = now()
  g.consumedByAskSeq = askSeqNo
  g.transitions.push({ at: iso(g.consumedAt), to: 'consumed', byAskSeq: askSeqNo, outcome })
  return true
}
function markExpired(g) {
  if (g.state === 'expired') return
  const from = g.state
  g.state = 'expired'
  g.transitions.push({ at: iso(now()), to: 'expired', from })
}

/** Mint a Grant. Only the Team-lane actor's tool call reaches this (T-1). */
function mintLaneGrant({ source, bind, decision, ttlMs, issuer, pendingSeq }) {
  if (issuer?.role !== 'lane') return { ok: false, error: 'issuer is not a provisioned Team-lane actor' }
  const ttl = Math.max(1, Math.min(Number(ttlMs) || 60_000, 15 * 60_000))
  const grantId = `g${(grantSeq += 1)}`
  const g = {
    grantId,
    via: 'team-lane-tool', // sole issuance channel; no HTTP face can mint
    source, // 'ask-bound' = bindings copied from the HOST ask record
    decision: decision === 'allow' ? 'allow' : 'reject',
    state: 'issued',
    bind: { ...bind },
    issuerLane: { label: issuer.label, sessionId: issuer.sessionId, role: issuer.role },
    ttlMs: ttl,
    issuedAt: now(),
    expiresAt: now() + ttl,
    transitions: [{ at: iso(now()), to: 'issued', source, ttlMs: ttl }],
  }
  GRANTS.set(grantId, g)
  const key = bindKey(g.bind)
  if (!BY_KEY.has(key)) BY_KEY.set(key, [])
  BY_KEY.get(key).push(grantId)
  record({ leg: 'grant-minted', ...grantView(g), pendingSeq: pendingSeq ?? null })
  return { ok: true, grantId, key, decision: g.decision, ttl }
}

/** Refuse a held ask outright (lane refusal before any Grant was spent). */
function refusePending(seqNo, issuerLabel) {
  const handle = [...PENDING.values()].find((p) => p.seq === seqNo)
  if (handle === undefined) return null
  PENDING.delete(handle.key)
  clearTimeout(handle.timer)
  handle.settle('rejected', { decision: 'lane-refused', issuerLane: issuerLabel })
  return handle
}

export async function apply(ctx) {
  record({ leg: 'plugin-apply', pid: process.pid, assemble: ASSEMBLE, launcher: LAUNCHER, testUse: TESTUSE, askTtlMs: ASK_TTL_MS })

  let TARGETS = TARGETS_FALLBACK
  let targetsSource = 'fallback-constant'
  try {
    const sb = await import(URLS.sandbox)
    if (Array.isArray(sb?.ESCALATION_TARGETS) && sb.ESCALATION_TARGETS.length > 0) {
      TARGETS = [...sb.ESCALATION_TARGETS]
      targetsSource = 'host-barrel:ESCALATION_TARGETS'
    }
  } catch { /* fallback */ }
  record({ leg: 'escalation-targets', source: targetsSource, targets: TARGETS })

  // ── 1. OS backend deployment — the SAME public provider test-hook as L1.
  // Deliberately NOT tied to ASSEMBLE: the RED control world must differ from
  // GREEN in ONE respect only (the adjudication faces absent). Leaving the OS
  // floor out of RED would conflate "no governance" with "no sandbox backend"
  // (run_code would then fail with sandbox-unavailable, which is not a
  // governance result at all).
  const provider = ctx.get?.('sandbox') ?? undefined
  const deploy = { attempted: OSFLOOR, ok: false, note: '' }
  if (OSFLOOR) {
    if (provider === undefined) deploy.note = 'sandbox service not resolvable'
    else if (typeof provider.internals !== 'object' || provider.internals === null) deploy.note = 'public internals property absent'
    else {
      provider.internals.landlockLauncher = LAUNCHER
      deploy.ok = provider.internals.landlockLauncher === LAUNCHER
      deploy.note = 'public `internals.landlockLauncher` test-hook property set before first confine()'
    }
  }
  record({ leg: 'launcher-deploy', ...deploy, osFloor: OSFLOOR, assemble: ASSEMBLE, selectedRunnerAtApply: provider?.selectedRunner ?? null })

  // ── 2. The Team resolver on the approval waterfall (the adjudicator) ──────
  function askRow(source, request) {
    const reason = String(request?.reason ?? '')
    const m = HOST_PREFIX.exec(reason)
    return {
      seq: (askSeq += 1),
      at: iso(now()),
      face: source,
      agent: agentLabel(request?.agent),
      callId: String(request?.callId ?? ''),
      toolName: String(request?.toolName ?? ''),
      mode: m?.[1] ?? '', // host-composed prefix, checked against the closed set
      // Model-controlled text below the prefix: LOG ONLY (T-1), never an input.
      modelTextLog: reason.slice(m === null ? 0 : m[0].length).slice(0, 160),
    }
  }

  function pushAsk(row, decision, outcome, extra) {
    const out = { ...row, decision, outcome, ...extra }
    ASKS.push(out)
    record({ leg: 'approval-ask', ...out })
    return out
  }

  function resolverHandler(source) {
    return (request, next) => {
      // Source marker: the hook census identifies our own listeners by tag and
      // by this literal (robust if the bus ever wraps the callback).
      const A5PTC4B_RESOLVER_FACE = 'a5ptc4b-approval-resolver'
      if (!ASSEMBLE || uninstalled) return next()
      if (SEEN.has(request)) {
        record({ leg: 'approval-ask', face: source, decision: 'already-decided-at-another-face', outcome: 'pass-through' })
        return next()
      }
      const row = askRow(source, request)
      void A5PTC4B_RESOLVER_FACE
      SEEN.add(request)

      // T-1 domain check on HOST fields only. Not ours → delegate, verbatim.
      const member = ROSTER.get(row.agent)
      if (member === undefined || member.role !== 'member'
        || row.callId === '' || row.toolName === ''
        || !TARGETS.includes(row.mode)) {
        pushAsk(row, 'foreign', 'pass-through', { why: 'agent not on this Team roster, or not a host-recognised escalation target' })
        return next()
      }

      const key = bindKey(row)
      // T-3: GRANTS FIRST. The history can refuse, never grant.
      const hit = adjudicateRecords(key)

      if (hit.kind === 'live') {
        const outcome = hit.g.decision === 'allow' ? 'allowed-once' : 'rejected'
        if (consume(hit.g, row.seq, outcome)) {
          pushAsk(row, `lane-${hit.g.decision}`, outcome, {
            grantId: hit.g.grantId, grantSource: hit.g.source, issuerLane: hit.g.issuerLane.label, ttlMs: hit.g.ttlMs,
          })
          return outcome
        }
        return pushAsk(row, 'grant-expired-at-answer', 'rejected', { grantId: hit.g.grantId }).outcome
      }
      if (hit.kind === 'revoked') return pushAsk(row, 'revoked', 'rejected', { grantId: hit.g.grantId, ttlMs: hit.g.ttlMs }).outcome
      if (hit.kind === 'expired') {
        markExpired(hit.g)
        return pushAsk(row, 'expired', 'rejected', { grantId: hit.g.grantId, ttlMs: hit.g.ttlMs, expiredAt: iso(hit.g.expiresAt) }).outcome
      }
      if (hit.kind === 'consumed') {
        return pushAsk(row, 'replay-of-consumed', 'rejected', { grantId: hit.g.grantId, consumedAt: iso(hit.g.consumedAt) }).outcome
      }

      // Nothing on the ledger can answer: put the ask on the LIVE Team lane and
      // hold it there (the ACP/GUI bridge posture on the same seam) until the
      // lane decides or its deadline passes. T-4: deadline = refusal, not hang.
      const existing = PENDING.get(key)
      if (existing !== undefined) {
        record({ leg: 'approval-ask', ...row, decision: 'already-pending', outcome: 'held' })
        return existing.promise
      }
      let settleRef = () => { /* replaced immediately below */ }
      const promise = new Promise((res) => { settleRef = res })
      const handle = { seq: row.seq, key, ask: row, askedAt: now(), deadline: now() + ASK_TTL_MS, promise }
      handle.timer = setTimeout(() => {
        if (PENDING.get(key) !== handle) return
        PENDING.delete(key)
        pushAsk(row, 'lane-timeout', 'rejected', { heldMs: now() - handle.askedAt, laneDeadlineMs: ASK_TTL_MS })
        settleRef('rejected')
      }, ASK_TTL_MS)
      handle.settle = (decision, extra) => {
        pushAsk(row, extra?.decision ?? `lane-${decision === 'allowed-once' ? 'allow' : 'reject'}`, decision, {
          heldMs: now() - handle.askedAt, ...extra,
        })
        settleRef(decision)
      }
      PENDING.set(key, handle)
      record({ leg: 'approval-ask', ...row, decision: 'pending-lane', outcome: 'held', laneDeadlineMs: ASK_TTL_MS })
      return promise
    }
  }

  if (ASSEMBLE) {
    const bootHooks = (ctx.events?._hooks?.['approval/request'] ?? []).map((h) => ({ global: h.global === true, prepend: h.prepend === true }))
    record({ leg: 'approval-hooks-at-apply', count: bootHooks.length, shape: bootHooks })
    // T-5: BOTH disposers are RETAINED (L1 discarded them = finding F-5).
    const h1 = resolverHandler('plugin-ctx')
    const h2 = resolverHandler('plugin-ctx-global-outer')
    h1.__a5ptc4b = 'plugin-ctx'
    h2.__a5ptc4b = 'plugin-ctx-global-outer'
    MINE.add('plugin-ctx')
    MINE.add('plugin-ctx-global-outer')
    RESOLVER_DISPOSERS.push(ctx.on('approval/request', h1))
    RESOLVER_DISPOSERS.push(ctx.on('approval/request', h2, { global: true, prepend: true }))
    DISPOSERS.push(...RESOLVER_DISPOSERS)
    const mirror = ctx.on?.('session/event', (session, ev) => {
      if (ev?.type !== 'approval/asked' && ev?.type !== 'approval/decided') return
      const d = ev.data ?? {}
      ASK_EVENTS.push({
        at: new Date().toISOString(),
        seq: ev.seq ?? null,
        type: ev.type,
        session: session?.label ?? session?.id ?? null,
        approvalId: d.id ?? null,
        toolName: d.toolName ?? null,
        callId: d.callId ?? null,
        reason: d.reason ?? null,
        outcome: d.outcome ?? null,
      })
      if (ASK_EVENTS.length > 500) ASK_EVENTS.shift()
    }, { global: true })
    if (typeof mirror === 'function') { RESOLVER_DISPOSERS.push(mirror); DISPOSERS.push(mirror) }
    record({ leg: 'resolver-installed', ok: true, faces: ['plugin-ctx', 'plugin-ctx-global-outer'], mirror: typeof mirror === 'function', disposersRetained: RESOLVER_DISPOSERS.filter((d) => typeof d === 'function').length })
  }

  // ── read-only census + provisioning faces ────────────────────────────────
  // No face here mints, flips or revokes a Grant: the T-1 issuance channel is
  // the Team-lane AGENT'S TOOL CALL, never an unauthenticated HTTP route.
  if (typeof ctx.webServer?.register === 'function') {
    const get = (path, handler, title) => ctx.webServer.register({ kind: 'exact', path, handler: async (_req, res) => handler(res) }, `a5ptc4b ${title}`)
    const post = (path, handler, title) => ctx.webServer.register({ kind: 'exact', path, handler: async (req, res) => {
      let body = ''
      for await (const c of req) body += c
      let p = {}
      try { p = JSON.parse(body || '{}') } catch { /* census */ }
      await handler(p, res)
    } }, `a5ptc4b ${title}`)

    get('/__a5ptc4b/health', (res) => sendJson(res, 200, { ok: true, applied: true, pid: process.pid, assemble: ASSEMBLE, uninstalled, askTtlMs: ASK_TTL_MS }), 'health')
    get('/__a5ptc4b/journal', (res) => sendJson(res, 200, { rows: JOURNAL }), 'journal')
    get('/__a5ptc4b/approvals', (res) => sendJson(res, 200, { rows: ASKS }), 'per-callId approvals census')
    get('/__a5ptc4b/grants', (res) => sendJson(res, 200, {
      rows: [...GRANTS.values()].map(grantView),
      issuanceChannels: ['team-lane-tool'], httpCanMint: false,
    }), 'grant ledger')
    get('/__a5ptc4b/pending', (res) => sendJson(res, 200, {
      askTtlMs: ASK_TTL_MS,
      rows: [...PENDING.values()].map((p) => ({ seq: p.seq, bind: p.ask, askedAt: iso(p.askedAt), deadlineMsLeft: Math.max(0, p.deadline - now()) })),
    }), 'Team ask-lane pending queue (what the lane actor may see)')
    get('/__a5ptc4b/roster', (res) => sendJson(res, 200, { rows: [...ROSTER.entries()].map(([label, e]) => ({ label, role: e.role, sessionId: e.sessionId, witness: e.witness ?? null, laneTools: e.laneTools ?? null, error: e.error })) }), 'roster census')
    get('/__a5ptc4b/state', (res) => {
      const out = {}
      for (const [label, a] of ROSTER) out[label] = a.role === 'member'
        ? { role: a.role, sessionId: a.sessionId, witness: a.witness, legs: a.legs, runs: a.runs, guardRows: a.guardRows }
        : { role: a.role, sessionId: a.sessionId, laneTools: a.laneTools }
      sendJson(res, 200, { assemble: ASSEMBLE, uninstalled, assemblies: out })
    }, 'state')
    get('/__a5ptc4b/ask-events', (res) => {
      sendJson(res, 200, { count: ASK_EVENTS.length, rows: ASK_EVENTS.map((x) => ({ ...x, reason: x.reason === null ? null : x.reason.slice(0, 400) })) })
    }, 'host ask-lane mirror')
    get('/__a5ptc4b/sandbox', (res) => {
      const p = ctx.get?.('sandbox')
      sendJson(res, 200, { selectedRunner: p?.selectedRunner?.runner ?? null, enforcement: p?.selectedRunner?.enforcement ?? null, landlockLauncher: p?.internals?.landlockLauncher ?? null, deploy })
    }, 'sandbox census')
    get('/__a5ptc4b/hooks', (res) => {
      const hooks = ctx.events?._hooks?.['approval/request'] ?? []
      sendJson(res, 200, {
        count: hooks.length,
        uninstalled,
        mineTags: [...MINE],
        rows: hooks.map((h, i) => {
          const src = String(h.callback?.toString?.() ?? '').replace(/\s+/g, ' ')
          return {
            idx: i, global: h.global === true, prepend: h.prepend === true,
            tag: h.callback?.__a5ptc4b ?? null,
            mineBySource: src.includes('a5ptc4b') || src.includes('resolverHandler'),
            fnHead: src.slice(0, 90),
          }
        }),
      })
    }, 'hook chain census')

    post('/__a5ptc4b/mode', async (p, res) => {
      const agent = findAgent(String(p.sessionId ?? ''))
      let mode = null
      try {
        const r = await Promise.resolve(ctx.get?.('sandboxPolicy')?.resolve?.({ session: agent?.session }))
        mode = r?.mode ?? null
      } catch { /* census */ }
      sendJson(res, 200, { mode, approvalPolicy: ctx.get?.('approval')?.overrideOf?.(agent?.session) ?? null })
    }, 'mode+policy census')

    // PROVISIONING (world operator, assembly time): declare a host agent as this
    // Team's MEMBER (adjudicated, with witnesses), as the Team-LANE actor (the
    // grant tools), or as an OUTSIDER (witnesses only, never adjudicated: its
    // asks are delegated downstream verbatim — the shape the delegation leg
    // observes).
    post('/__a5ptc4b/provision', async (p, res) => {
      const sid = String(p.sessionId ?? '')
      const role = p.role === 'lane' ? 'lane' : p.role === 'outsider' ? 'outsider' : 'member'
      const agent = findAgent(sid)
      if (agent == null) { sendJson(res, 404, { ok: false, error: 'no agent for session' }); return }
      const label = agentLabel(agent)
      if (ROSTER.has(label)) { sendJson(res, 200, { ok: true, already: true, label, role: ROSTER.get(label).role }); return }
      const entry = { role, label, sessionId: sid, legs: [], runs: [], guardRows: [], witness: null, laneTools: null, error: null }
      ROSTER.set(label, entry)
      try {
        await provisionAgent(entry, agent)
        record({ leg: 'provision-complete', label, role })
      } catch (error) {
        entry.error = String(error?.stack ?? error).slice(0, 700)
        record({ leg: 'provision-failed', label, role, error: entry.error })
      }
      sendJson(res, 200, { ok: true, label, role, error: entry.error })
    }, 'provision roster entry')
  }

  function findAgent(sessionId) {
    try {
      for (const a of ctx.agents.list?.() ?? []) if (a?.id === sessionId || a?.session?.header?.id === sessionId) return a
      return null
    } catch { return null }
  }

  // ── witnesses (members) / Team-lane tools (the sole Grant issuer) ─────────
  async function provisionAgent(entry, agent) {
    const { defineTool } = await import(URLS.tools)
    const acx = agent.ctx
    if (acx?.tools?.register == null) throw new Error('agent.ctx.tools unavailable')
    const issuer = { label: entry.label, sessionId: entry.sessionId, role: entry.role }

    if (entry.role !== 'lane') { // member and outsider both get witnesses; only members are adjudicated
      const echoDef = defineTool({
        name: 'a5ptc4b_echo',
        description: 'Witness tool: proves the outer program body really ran (inner pipeline canary).',
        parameters: { tag: { type: 'string', required: true, description: 'tag' } },
        output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: String(v) }] },
        execute: async (args) => `A5PTC4B-ECHO:${args.tag}`,
      })
      DISPOSERS.push(acx.tools.register(echoDef))
      let seq = 0
      DISPOSERS.push(acx.tools.guard((exec) => {
        seq += 1
        entry.guardRows.push({ seq, name: String(exec?.name), callId: String(exec?.callId ?? ''), rootCallId: String(exec?.rootCallId ?? ''), inner: exec?.parent !== undefined })
        return undefined
      }))
      DISPOSERS.push(acx.tools.presentAs('ptc'))
      if (ASSEMBLE) DISPOSERS.push(acx.on?.('approval/request', resolverHandler('agent-ctx')) ?? (() => {}))
      acx.on?.('tools/execute', (exec, next) => {
        const out = next()
        if (exec?.name === 'run_code' && exec?.parent === undefined) {
          void Promise.resolve(out).then(
            (value) => { entry.runs.push({ at: now(), text: extractText(value), raw: safeClone(value) }) },
            () => { entry.runs.push({ at: now(), text: '(execute rejected)', raw: null }) })
        }
        return out
      })
      entry.witness = { echo: true, guard: true, presentAs: 'ptc', aroundSeam: true }
      return
    }

    // ── TEAM-LANE ACTOR: the only Grant issuance face (T-1) ─────────────────
    const grantDef = defineTool({
      name: 'a5ptc4b_grant',
      description: 'Team ask-lane: answer ONE pending escalation ask (ask-bound grant: the four bindings are copied from the HOST ask record, not typed), or declare a bound one-time grant, with a TTL. Issued as this agent\'s own tool call; the recorded issuer is the host agent the tool is registered on.',
      parameters: {
        pending_seq: { type: 'number', description: 'seq of the pending ask in the lane queue (ask-bound grant)' },
        declared: { type: 'string', description: 'agent|callId|toolName|mode for a declared one-time grant (no pending ask yet)' },
        decision: { type: 'string', required: true, description: 'allow | reject' },
        ttl_ms: { type: 'number', description: 'grant time-to-live in milliseconds' },
      },
      output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: String(v) }] },
      execute: async (args) => {
        const seqNo = args.pending_seq === undefined || args.pending_seq === null || args.pending_seq === '' ? null : Number(args.pending_seq)
        if (seqNo !== null) {
          const handle = [...PENDING.values()].find((p) => p.seq === seqNo)
          if (handle === undefined) return `A5PTC4B-GRANT-REJECTED no pending ask with seq=${seqNo}`
          // BINDINGS FROM THE HOST ASK RECORD — the lane cannot retarget them.
          const bind = { agent: handle.ask.agent, callId: handle.ask.callId, toolName: handle.ask.toolName, mode: handle.ask.mode }
          const r = mintLaneGrant({ source: 'ask-bound', bind, decision: args.decision, ttlMs: args.ttl_ms, issuer, pendingSeq: seqNo })
          if (!r.ok) return `A5PTC4B-GRANT-REJECTED ${r.error}`
          const g = GRANTS.get(r.grantId)
          const outcome = r.decision === 'allow' ? 'allowed-once' : 'rejected'
          consume(g, handle.seq, outcome) // T-2: spent at the moment it answers
          PENDING.delete(bindKey(bind))
          clearTimeout(handle.timer)
          handle.settle(outcome, { decision: `lane-${r.decision}@pending`, grantId: r.grantId, grantSource: 'ask-bound', issuerLane: issuer.label, ttlMs: g.ttlMs })
          return `A5PTC4B-GRANT ${r.grantId} bound=${r.key} decision=${r.decision} ttl=${g.ttlMs}ms state=consumed(ask-bound@pending)`
        }
        const parts = String(args.declared ?? '').split('|')
        if (parts.length !== 4 || parts.some((x) => x === '')) return 'A5PTC4B-GRANT-REJECTED declared must be agent|callId|toolName|mode'
        const bind = { agent: parts[0], callId: parts[1], toolName: parts[2], mode: parts[3] }
        if (!TARGETS.includes(bind.mode)) return `A5PTC4B-GRANT-REJECTED mode "${bind.mode}" is not a host escalation target`
        const r = mintLaneGrant({ source: 'declared', bind, decision: args.decision, ttlMs: args.ttl_ms, issuer })
        if (!r.ok) return `A5PTC4B-GRANT-REJECTED ${r.error}`
        return `A5PTC4B-GRANT ${r.grantId} bound=${r.key} decision=${r.decision} ttl=${GRANTS.get(r.grantId).ttlMs}ms state=issued`
      },
    })

    const revokeDef = defineTool({
      name: 'a5ptc4b_revoke',
      description: 'Team ask-lane: revoke an issued one-time grant, or refuse a pending ask outright, BEFORE it is spent. Revocation outranks every cached answer.',
      parameters: {
        grant_id: { type: 'string', description: 'grant id to revoke' },
        pending_seq: { type: 'number', description: 'pending ask seq to refuse outright' },
      },
      output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: String(v) }] },
      execute: async (args) => {
        if (args.pending_seq !== undefined && args.pending_seq !== null && args.pending_seq !== '') {
          const handle = refusePending(Number(args.pending_seq), issuer.label)
          if (handle === null) return `A5PTC4B-REVOKE-NOOP no pending ask with seq=${args.pending_seq}`
          record({ leg: 'lane-refused-pending', seq: handle.seq, bind: handle.ask, issuerLane: issuer.label })
          return `A5PTC4B-REFUSED pending seq=${handle.seq} bind=${handle.key}`
        }
        const g = GRANTS.get(String(args.grant_id ?? ''))
        if (g === undefined) return 'A5PTC4B-REVOKE-NOOP unknown grant id'
        if (g.state === 'consumed') return `A5PTC4B-REVOKE-NOOP ${g.grantId} already consumed (a spent authorization cannot be un-spent; re-presentation is refused by the consumed record)`
        const from = g.state
        g.state = 'revoked'
        g.revokedAt = now()
        g.transitions.push({ at: iso(g.revokedAt), to: 'revoked', from, by: issuer.label })
        record({ leg: 'grant-revoked', grantId: g.grantId, from, bind: g.bind, issuerLane: issuer.label })
        const handle = [...PENDING.values()].find((p) => p.key === bindKey(g.bind))
        if (handle !== undefined) refusePending(handle.seq, issuer.label)
        return `A5PTC4B-REVOKED ${g.grantId} bind=${bindKey(g.bind)}`
      },
    })

    const unloadDef = defineTool({
      name: 'a5ptc4b_unload',
      description: 'Team ask-lane: unload the per-call resolver symmetrically to its installation (T-5). Afterwards the {global,prepend} approval face is gone and this lane answers nothing.',
      parameters: { confirm: { type: 'string', required: true, description: 'the literal string "unload"' } },
      output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: String(v) }] },
      execute: async (args) => {
        if (String(args.confirm) !== 'unload') return 'A5PTC4B-UNLOAD-NOOP confirm must be "unload"'
        let n = 0
        for (const d of RESOLVER_DISPOSERS) { try { if (typeof d === 'function') { d(); n += 1 } } catch { /* gone */ } }
        uninstalled = true
        const count = (ctx.events?._hooks?.['approval/request'] ?? []).length
        record({ leg: 'resolver-unloaded', disposersRun: n, hookCount: count, issuerLane: issuer.label })
        return `A5PTC4B-UNLOADED disposers=${n} hookCount=${count}`
      },
    })

    DISPOSERS.push(acx.tools.register(grantDef))
    DISPOSERS.push(acx.tools.register(revokeDef))
    DISPOSERS.push(acx.tools.register(unloadDef))
    entry.laneTools = ['a5ptc4b_grant', 'a5ptc4b_revoke', 'a5ptc4b_unload']
  }
}

function extractText(value) {
  try {
    const t = value?.content ?? value?.blocks ?? value
    if (typeof t === 'string') return t
    if (Array.isArray(t)) return t.map((b) => b?.text ?? JSON.stringify(b)).join('\n')
    return JSON.stringify(t)
  } catch { return String(value) }
}
function safeClone(value) {
  try { return JSON.parse(JSON.stringify(value)) } catch { return null }
}
