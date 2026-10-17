/**
 * a5ptc4c-grantrow.mjs — W-PTC-OUTERFS-L2 CLOSURE row (F-L2-1 + F-L2-2).
 *
 * Inherits EVERYTHING the reviewed L2 row (a5ptc4b-grantrow.mjs @e80ca6eb, kept
 * byte-identical as the reviewed artifact) proved — T-1 four-way bound Grants,
 * T-2 single consumption, T-3 revocation-before-cache, T-4 TTL, T-5 symmetric
 * unload, the read-only census faces and the delegation posture — and closes the
 * two carried preconditions of review-SECURITY-L2.md §7:
 *
 *  F-L2-1  GRANT-AUTHORITY BOOTSTRAP IS THE TRUSTED TEAM LIFECYCLE, NOT HTTP.
 *      The L2 row's unauthenticated `POST /__a5ptc4b/provision` let any loopback
 *      caller (the adjudicated member's own confined child proven reachable)
 *      register an unrostered session AS A MINTING LANE. Here that face does not
 *      exist: the row registers no mutating HTTP route at all (the mode census
 *      stays read-only). Roster/authority ingress moves to a private lifecycle
 *      channel the member cannot reach: an append-only 0600 IPC file under the
 *      world root, written ONLY by the assembler process (the Team host side —
 *      the process that spawns the host and the member sessions). The plugin
 *      consumes appended records:
 *        {kind:'register', nonce, sessionId, role}  — one-time: a consumed or
 *            missing nonce is refused, and a record appended after the channel's
 *            `seal` is refused with an observable ledger row. Lane registration
 *            therefore arrives exactly once per spawn, from the trusted side.
 *        {kind:'seal'}                              — closes registration.
 *        {kind:'lifecycle', op:'install'|'uninstall-all'} — host-side lifecycle.
 *      A member has no write path to that file: its only execution face is the
 *      confined outer program, whose OS floor (Landlock workspace-write) refuses
 *      every write outside its workspace (proven in-world: EACCES at open).
 *
 *  F-L2-2  DISPOSERS ARE BOUND TO A REAL LIFECYCLE, AND RESIDUE IS DISCLOSED.
 *      L2 kept the member agent-ctx `approval/request` disposer in a list that
 *      nothing ran, and gated that face on an `uninstalled` flag. Here:
 *        - every registration keeps an IDEMPOTENT wrapped disposer in ONE of two
 *          tiers: ADJ (adjudication faces: the two plugin-ctx approval faces, the
 *          read-only ask-lane mirror, AND every member's agent-ctx approval face)
 *          and LIFE (witness tools/guards/presentAs/around-seam, the lane tools);
 *        - the lane's `a5ptc4c_unload` runs tier ADJ (T-5, now including member
 *          faces — disposed, not flag-gated);
 *        - the trusted channel's `uninstall-all` runs BOTH tiers; `install`
 *          (re-)builds every face from the roster — reinstalling cannot
 *          double-register (an installed face set is rebuilt from zero, census
 *          proves the count), so a post-reinstall ask is decided exactly once;
 *        - `/__a5ptc4c/lifecycle` + `/__a5ptc4c/routes` + the ledger disclose the
 *          residue that REMAINS by design after any unload: the read-only census
 *          HTTP faces, the lifecycle-channel listener, and the in-memory audit
 *          ledger — none of which can mint, flip, revoke, or answer an ask.
 *
 * Public faces only (zero Core change): profile-patch plugin rows,
 * `ctx.sandbox.internals.landlockLauncher` deployment test-hook, the
 * `approval/request` waterfall via ctx.on (documented {global,prepend}) and the
 * per-agent ctx face, defineTool + agent.ctx.tools.register / tools.guard /
 * presentAs, ctx.on('tools/execute') around-seam, ctx.webServer.register, and a
 * plain fs-polled append-only file for the assembler-private lifecycle channel.
 *
 * Env: A5PTC4C_ASSEMBLE ('1' GREEN / '0' RED: witnesses only, no adjudication),
 *      A5PTC4C_TESTUSE, A5PTC4C_LEDGER, A5PTC4C_LAUNCHER, A5PTC4C_RUN,
 *      A5PTC4C_ASK_TTL_MS (lane hold deadline, default 12000),
 *      A5PTC4C_IPC (assembler-private lifecycle-channel file).
 *
 * @module dev/agent-workflow/evidence/alpha5/w-ptc-outerfs/a5ptc4c-grantrow
 */
import { appendFileSync, closeSync, mkdirSync, openSync, readSync, statSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { pathToFileURL } from 'node:url'

export const name = 'a5ptc4c-grantrow'
export const inject = ['webServer', 'agents', 'sandbox', 'sandboxPolicy']

const ASSEMBLE = (process.env.A5PTC4C_ASSEMBLE ?? '0') === '1'
// OS floor (Landlock launcher test-hook) deployment: independent of ASSEMBLE on
// purpose, so the RED control world differs ONLY by the absent adjudication faces.
const OSFLOOR = (process.env.A5PTC4C_OS ?? '1') === '1'
const TESTUSE = process.env.A5PTC4C_TESTUSE ?? ''
const LEDGER = process.env.A5PTC4C_LEDGER ?? ''
const LAUNCHER = process.env.A5PTC4C_LAUNCHER ?? ''
const RUN = process.env.A5PTC4C_RUN ?? 'run'
const ASK_TTL_MS = Math.max(1000, Number(process.env.A5PTC4C_ASK_TTL_MS ?? 12000))
const IPC_PATH = process.env.A5PTC4C_IPC ?? ''

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
const iso = (ms) => new Date(ms).toISOString()

// ── Team roster (registration comes ONLY from the trusted lifecycle channel;
// membership only decides WHICH ASKS WE ADJUDICATE — it authorizes nothing: a
// rostered member with no lane Grant gets zero answer). ─────────────────────
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

// F-L2-2: two disposer tiers, every entry wrapped idempotent (run-once).
const ADJ = [] // adjudication faces (unload + uninstall-all run these)
const LIFE = [] // witnesses + lane tools (uninstall-all only)
const ROUTES = [] // {path, kind, disposed} for the route census
const disposer = (d, _tier, what) => {
  let done = false
  const fn = () => {
    if (done || typeof d !== 'function') return false
    done = true
    try { d(); return true } catch { return false }
  }
  fn.__what = what
  fn.__done = () => done
  return fn
}
const runTier = (tier) => {
  let n = 0
  for (const d of tier) { if (typeof d === 'function' && d()) n += 1 }
  return n
}
// Read-only mirror of the HOST ask lane: `session.append` publishes the public
// `session/event` bus call with args [session, event] for every event, so a
// global observer sees approval/asked (what the host lane RECEIVED, byte-verbatim)
// and approval/decided (who decided it). It answers nothing — a listener on an
// event bus contributes no decision — and it is disposed with the rest of us.
const ASK_EVENTS = []

const bindKey = (b) => `${b.agent}|${b.callId}|${b.toolName}|${b.mode}`
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
  record({ leg: 'plugin-apply', row: 'a5ptc4c', pid: process.pid, assemble: ASSEMBLE, launcher: LAUNCHER, testUse: TESTUSE, askTtlMs: ASK_TTL_MS, ipc: IPC_PATH })

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

  // ── 1. OS backend deployment — the SAME public provider test-hook as L1/L2.
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
      const A5PTC4C_RESOLVER_FACE = 'a5ptc4c-approval-resolver'
      if (!ASSEMBLE || uninstalled) return next()
      if (SEEN.has(request)) {
        record({ leg: 'approval-ask', face: source, decision: 'already-decided-at-another-face', outcome: 'pass-through' })
        return next()
      }
      const row = askRow(source, request)
      void A5PTC4C_RESOLVER_FACE
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
      // hold it there until the lane decides or its deadline passes. T-4: no
      // lane decision within the deadline = refusal, never a hang.
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

  // F-L2-2: face installation is a FUNCTION (initial install AND the trusted
  // channel's re-install run the same build). It never appends to a face set
  // that already has faces: uninstall empties ADJ, so a reinstall cannot
  // double-register and a post-reinstall ask cannot be decided twice.
  let facesInstalled = 0
  function installAdjudicationFaces() {
    if (!ASSEMBLE) return 0
    // No-double-registration guarantee: reinstalling while faces are live is
    // a no-op (a lifecycle `install` record can never double-register).
    const activeCount = ADJ.filter((d) => !d.__done()).length
    if (activeCount > 0) {
      record({ leg: 'resolver-install-noop', reason: 'faces already installed and live', active: activeCount })
      return activeCount
    }
    const bootHooks = (ctx.events?._hooks?.['approval/request'] ?? []).map((h) => ({ global: h.global === true, prepend: h.prepend === true }))
    record({ leg: 'approval-hooks-at-install', count: bootHooks.length, shape: bootHooks })
    const h1 = resolverHandler('plugin-ctx')
    const h2 = resolverHandler('plugin-ctx-global-outer')
    h1.__a5ptc4c = 'plugin-ctx'
    h2.__a5ptc4c = 'plugin-ctx-global-outer'
    MINE.add('plugin-ctx')
    MINE.add('plugin-ctx-global-outer')
    ADJ.push(disposer(ctx.on('approval/request', h1), ADJ, 'plugin-ctx'))
    ADJ.push(disposer(ctx.on('approval/request', h2, { global: true, prepend: true }), ADJ, 'plugin-ctx-global-outer'))
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
    if (typeof mirror === 'function') ADJ.push(disposer(mirror, ADJ, 'session-event-mirror'))
    facesInstalled += 1
    const mine = ADJ.filter((d) => d.__what !== 'member-approval-ctx').length
    record({ leg: 'resolver-installed', ok: true, installSeq: facesInstalled, faces: ['plugin-ctx', 'plugin-ctx-global-outer'], mirror: typeof mirror === 'function', disposersRetained: mine })
    return mine
  }

  async function rebindMemberFaces(entry, agent) {
    if (entry.role !== 'member' && entry.role !== 'outsider') return
    const acx = agent?.ctx
    if (acx?.on == null) return
    if (ASSEMBLE && entry.role === 'member') {
      // F-L2-2: the member's OWN agent-ctx approval face now rides tier ADJ
      // (a real disposer), not the uninstalled flag alone.
      const mh = resolverHandler('agent-ctx')
      mh.__a5ptc4c = `member-approval-ctx:${entry.label.slice(-8)}` // census tags survive ctx.on binding
      const d = acx.on('approval/request', mh)
      entry.memberFaceDisposers.push(disposer(d, ADJ, 'member-approval-ctx'))
      ADJ.push(entry.memberFaceDisposers[entry.memberFaceDisposers.length - 1])
      record({ leg: 'member-face-bound', label: entry.label, disposer: typeof d === 'function' })
    }
  }

  if (ASSEMBLE) installAdjudicationFaces()
  else record({ leg: 'resolver-not-installed', reason: 'A5PTC4C_ASSEMBLE=0 (RED control world)' })

  // ── read-only census faces (NO mutating route is ever registered) ────────
  // No face here mints, flips, revokes a Grant or registers a roster entry:
  // the T-1 issuance channel is the Team-lane AGENT'S TOOL CALL and F-L2-1's
  // ingress is the assembler-private lifecycle file. Both live OUTSIDE HTTP.
  if (typeof ctx.webServer?.register === 'function') {
    const get = (path, handler, title) => {
      const d = ctx.webServer.register({ kind: 'exact', path, handler: async (_req, res) => handler(res) }, `a5ptc4c ${title}`)
      ROUTES.push({ path, kind: 'exact', title, disposed: false, release: () => { try { if (typeof d === 'function') d(); ROUTES.find((r) => r.path === path).disposed = true } catch { /* gone */ } } })
    }
    get('/__a5ptc4c/health', (res) => sendJson(res, 200, { ok: true, applied: true, row: 'a5ptc4c', pid: process.pid, assemble: ASSEMBLE, uninstalled, askTtlMs: ASK_TTL_MS, mutatingRoutes: 0 }), 'health')
    get('/__a5ptc4c/journal', (res) => sendJson(res, 200, { rows: JOURNAL }), 'journal')
    get('/__a5ptc4c/approvals', (res) => sendJson(res, 200, { rows: ASKS }), 'per-callId approvals census')
    get('/__a5ptc4c/grants', (res) => sendJson(res, 200, {
      rows: [...GRANTS.values()].map(grantView),
      issuanceChannels: ['team-lane-tool'], httpCanMint: false, httpCanRegister: false,
    }), 'grant ledger')
    get('/__a5ptc4c/pending', (res) => sendJson(res, 200, {
      askTtlMs: ASK_TTL_MS,
      rows: [...PENDING.values()].map((p) => ({ seq: p.seq, bind: p.ask, askedAt: iso(p.askedAt), deadlineMsLeft: Math.max(0, p.deadline - now()) })),
    }), 'Team ask-lane pending queue (what the lane actor may see)')
    get('/__a5ptc4c/roster', (res) => sendJson(res, 200, { rows: [...ROSTER.entries()].map(([label, e]) => ({ label, role: e.role, sessionId: e.sessionId, witness: e.witness ?? null, laneTools: e.laneTools ?? null, error: e.error, registeredVia: e.registeredVia, nonce: e.nonce })) }), 'roster census')
    get('/__a5ptc4c/state', (res) => {
      const out = {}
      for (const [label, a] of ROSTER) out[label] = { role: a.role, sessionId: a.sessionId, witness: a.witness ?? null, laneTools: a.laneTools ?? null, legs: a.legs, runs: a.runs, guardRows: a.guardRows }
      sendJson(res, 200, { assemble: ASSEMBLE, uninstalled, assemblies: out })
    }, 'state')
    get('/__a5ptc4c/ask-events', (res) => {
      sendJson(res, 200, { count: ASK_EVENTS.length, rows: ASK_EVENTS.map((x) => ({ ...x, reason: x.reason === null ? null : x.reason.slice(0, 400) })) })
    }, 'host ask-lane mirror')
    get('/__a5ptc4c/sandbox', (res) => {
      const p = ctx.get?.('sandbox')
      sendJson(res, 200, { selectedRunner: p?.selectedRunner?.runner ?? null, enforcement: p?.selectedRunner?.enforcement ?? null, landlockLauncher: p?.internals?.landlockLauncher ?? null, deploy })
    }, 'sandbox census')
    get('/__a5ptc4c/hooks', (res) => {
      const hooks = ctx.events?._hooks?.['approval/request'] ?? []
      sendJson(res, 200, {
        count: hooks.length,
        uninstalled,
        mineTags: [...MINE],
        rows: hooks.map((h, i) => {
          const src = String(h.callback?.toString?.() ?? '').replace(/\s+/g, ' ')
          return {
            idx: i, global: h.global === true, prepend: h.prepend === true,
            tag: h.callback?.__a5ptc4c ?? null,
            mineBySource: src.includes('a5ptc4c') || src.includes('resolverHandler'),
            fnHead: src.slice(0, 90),
          }
        }),
      })
    }, 'hook chain census')
    get('/__a5ptc4c/routes', (res) => {
      sendJson(res, 200, {
        registered: ROUTES.map((r) => ({ path: r.path, kind: r.kind, title: r.title, disposed: r.disposed })),
        mutating: ROUTES.filter((r) => r.mutating === true).length,
        note: 'every registered route is a read-only census; no HTTP face registers, mints, flips or revokes',
      })
    }, 'route census')
    get('/__a5ptc4c/lifecycle', (res) => {
      sendJson(res, 200, {
        assemble: ASSEMBLE, uninstalled, facesInstalled,
        tierAdjudication: ADJ.map((d) => ({ what: d.__what ?? 'fn', done: d.__done ? d.__done() : null })),
        tierLife: LIFE.map((d) => ({ what: d.__what ?? 'fn', done: d.__done ? d.__done() : null })),
        channel: { path: IPC_PATH, sealed: CHANNEL.sealed, consumedNonces: [...NONCES].length, refused: CHANNEL.refused.slice(-20), mode: channelMode() },
        residueAfterUninstall: [
          'read-only census HTTP faces (cannot mint/register/answer; verified by POST probes)',
          'assembler-private lifecycle-channel listener (registration sealed; lifecycle ops only)',
          'in-memory audit ledger (journal/approvals/grants census; read-only)',
        ],
      })
    }, 'lifecycle+residue census')
    get('/__a5ptc4c/registration', (res) => {
      sendJson(res, 200, {
        channel: IPC_PATH, sealed: CHANNEL.sealed,
        consumed: [...NONCES], refused: CHANNEL.refused,
        rows: [...ROSTER.values()].map((e) => ({ label: e.label, role: e.role, via: e.registeredVia, nonce: e.nonce })),
      })
    }, 'registration-channel census')

    // Read-only echo, kept as POST only because the reviewed row's runner
    // census contract posts {sessionId} to it; it reads mode+policy and
    // mutates NOTHING (no register/mint/flip/revoke route exists anywhere).
    const post = (path, handler, title) => {
      const d = ctx.webServer.register({ kind: 'exact', path, handler: async (req, res) => {
        let body = ''
        for await (const c of req) body += c
        let p = {}
        try { p = JSON.parse(body || '{}') } catch { /* census */ }
        await handler(p, res)
      } }, `a5ptc4c ${title}`)
      ROUTES.push({ path, kind: 'exact', title, disposed: false, mutating: false, release: () => { try { if (typeof d === 'function') d() } catch { /* gone */ } } })
    }
    post('/__a5ptc4c/mode', async (p, res) => {
      const agent = findAgent(String(p.sessionId ?? ''))
      let mode = null
      try {
        const r = await Promise.resolve(ctx.get?.('sandboxPolicy')?.resolve?.({ session: agent?.session }))
        mode = r?.mode ?? null
      } catch { /* census */ }
      sendJson(res, 200, { mode, approvalPolicy: ctx.get?.('approval')?.overrideOf?.(agent?.session) ?? null })
    }, 'mode+policy census (read-only echo)')
  }

  function findAgent(sessionId) {
    try {
      for (const a of ctx.agents.list?.() ?? []) if (a?.id === sessionId || a?.session?.header?.id === sessionId) return a
      return null
    } catch { return null }
  }

  // ── 3. THE TRUSTED LIFECYCLE CHANNEL (F-L2-1): assembler-private 0600 file ─
  // Written only by the assembler (the host parent: it spawns the host AND the
  // member sessions). The plugin only READS appended bytes. A member cannot
  // write it: its only execution surface is the confined outer program whose
  // workspace-write floor refuses every open-for-write outside the workspace
  // (same Landlock mechanism this kit proves on the forbidden directory).
  const NONCES = new Set()
  const CHANNEL = { sealed: false, refused: [] }
  let ipcOffset = 0
  function channelMode() {
    if (IPC_PATH === '') return null
    try { return (statSync(IPC_PATH).mode & 0o777).toString(8) } catch { return null }
  }
  if (IPC_PATH !== '') {
    try { mkdirSync(dirname(IPC_PATH), { recursive: true }) } catch { /* assembler created it */ }
    record({ leg: 'lifecycle-channel', path: IPC_PATH, mode: channelMode(), note: 'append-only; plugin reads, never writes; assembler is the only writer' })
  }

  async function handleLifecycleRecord(rec) {
    if (rec.kind === 'register') {
      const nonce = typeof rec.nonce === 'string' ? rec.nonce : ''
      const base = { leg: 'lifecycle-register', nonce, role: rec.role, sessionId: String(rec.sessionId ?? '').slice(0, 60) }
      if (CHANNEL.sealed) {
        CHANNEL.refused.push({ ...base, reason: 'channel sealed — registration is one-time per spawn' })
        record({ ...base, decision: 'refused', reason: 'sealed' })
        return
      }
      if (nonce === '' || NONCES.has(nonce)) {
        CHANNEL.refused.push({ ...base, reason: 'nonce missing or already consumed (one-time)' })
        record({ ...base, decision: 'refused', reason: 'replay-or-missing-nonce' })
        return
      }
      NONCES.add(nonce)
      const agent = findAgent(String(rec.sessionId ?? ''))
      if (agent == null) {
        CHANNEL.refused.push({ ...base, reason: 'no agent for session' })
        record({ ...base, decision: 'refused', reason: 'no-agent-for-session' })
        return
      }
      const label = agentLabel(agent)
      if (ROSTER.has(label)) {
        // an existing roster entry is NEVER re-registered or promoted here —
        // lifecycle records carry a fresh nonce per spawn, roster is per-agent.
        CHANNEL.refused.push({ ...base, reason: 'already rostered', label })
        record({ ...base, label, decision: 'refused', reason: 'already-rostered' })
        return
      }
      const role = rec.role === 'lane' ? 'lane' : rec.role === 'outsider' ? 'outsider' : 'member'
      const entry = { role, label, sessionId: String(rec.sessionId ?? ''), legs: [], runs: [], guardRows: [], witness: null, laneTools: null, error: null, registeredVia: 'trusted-lifecycle-channel', nonce, memberFaceDisposers: [] }
      ROSTER.set(label, entry)
      try {
        await provisionAgent(entry, agent)
        record({ leg: 'lifecycle-register', nonce, label, role, decision: 'registered', via: 'trusted-lifecycle-channel' })
      } catch (error) {
        entry.error = String(error?.stack ?? error).slice(0, 700)
        record({ leg: 'lifecycle-register', nonce, label, role, decision: 'provision-failed', error: entry.error })
      }
      return
    }
    if (rec.kind === 'seal') {
      CHANNEL.sealed = true
      record({ leg: 'lifecycle-seal', ok: true, note: 'registration closed; lifecycle ops remain (host-side only)' })
      return
    }
    if (rec.kind === 'lifecycle' && rec.op === 'uninstall-all') {
      const memberFaces = ADJ.filter((d) => d.__what === 'member-approval-ctx' && !d.__done()).length
      const adj = runTier(ADJ)
      const life = runTier(LIFE)
      uninstalled = true
      // Forget built-state so a subsequent `install` rebuilds EVERY face from
      // zero (witnesses, lane tools, member faces) — never appends onto live ones.
      for (const e of ROSTER.values()) { e.witness = null; e.laneTools = null; e.memberFaceDisposers = [] }
      const count = (ctx.events?._hooks?.['approval/request'] ?? []).length
      record({ leg: 'lifecycle-uninstall-all', adjudicationDisposed: adj, lifeDisposed: life, memberFaces, hookCount: count })
      return
    }
    if (rec.kind === 'lifecycle' && rec.op === 'install') {
      // Reinstall builds the face set from zero (installAdjudicationFaces
      // no-ops while faces are live), so a double install CANNOT
      // double-register faces and CANNOT decide one ask twice.
      const rebuilt = installAdjudicationFaces()
      uninstalled = false
      for (const e of ROSTER.values()) {
        const agent = findAgent(e.sessionId)
        if (agent == null) continue
        if (e.role === 'lane') {
          if (e.laneTools == null) { try { await provisionAgent(e, agent) } catch { /* census */ } }
        } else if (e.witness == null) {
          // provisionAgent rebuilds witnesses AND the member approval face
          try { await provisionAgent(e, agent) } catch { /* census */ }
        } else if (e.role === 'member') {
          await rebindMemberFaces(e, agent)
        }
      }
      const liveFaces = ADJ.filter((d) => !d.__done()).length
      // Reviewer precision (c): `faces` reports the LIVE face count after this install
      // (the primary number). The pre-fix value — a cumulative since-boot counter that
      // kept disposed entries — is disclosed unchanged under its own field, flagged stale.
      record({ leg: 'lifecycle-install', ok: true, faces: liveFaces, liveFaces, facesCumulativeSinceBoot: rebuilt, facesNote: 'faces/liveFaces = live ADJ entries NOW; facesCumulativeSinceBoot = the old (stale) faces field incl. already-disposed entries', roster: ROSTER.size, note: 'reinstall never appends onto an installed face set' })
      return
    }
    record({ leg: 'lifecycle-unknown-record', kind: String(rec.kind ?? 'missing') })
  }

  function pumpLifecycleChannel() {
    if (IPC_PATH === '') return
    let st = null
    try { st = statSync(IPC_PATH) } catch { return }
    if (st.size <= ipcOffset) { if (st.size < ipcOffset) ipcOffset = 0; return }
    let buf = null
    let fd = null
    try {
      fd = openSync(IPC_PATH, 'r')
      buf = Buffer.alloc(st.size - ipcOffset)
      const n = readSync(fd, buf, 0, buf.length, ipcOffset)
      ipcOffset += n
    } catch (error) {
      record({ leg: 'lifecycle-channel-read-failed', error: String(error?.message ?? error) })
      return
    } finally { if (fd !== null) try { closeSync(fd) } catch { /* gone */ } }
    const lines = buf.toString('utf8').split('\n').map((x) => x.trim()).filter((x) => x !== '')
    for (const line of lines) {
      let rec = null
      try { rec = JSON.parse(line) } catch { record({ leg: 'lifecycle-malformed-record', head: line.slice(0, 120) }); continue }
      void handleLifecycleRecord(rec)
    }
  }
  // fs-poll: public fs only; the timer is part of the DISCLOSED residue after
  // any unload (it carries authority only inside the assembler's file).
  if (IPC_PATH !== '') {
    const t = setInterval(pumpLifecycleChannel, 250)
    if (typeof t?.unref === 'function') t.unref()
  }

  // ── witnesses (members) / Team-lane tools (the sole Grant issuer) ─────────
  async function provisionAgent(entry, agent) {
    const { defineTool } = await import(URLS.tools)
    const acx = agent.ctx
    if (acx?.tools?.register == null) throw new Error('agent.ctx.tools unavailable')
    const issuer = { label: entry.label, sessionId: entry.sessionId, role: entry.role }

    if (entry.role !== 'lane') { // member and outsider both get witnesses; only members are adjudicated
      const echoDef = defineTool({
        name: 'a5ptc4c_echo',
        description: 'Witness tool: proves the outer program body really ran (inner pipeline canary).',
        parameters: { tag: { type: 'string', required: true, description: 'tag' } },
        output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: String(v) }] },
        execute: async (args) => `A5PTC4C-ECHO:${args.tag}`,
      })
      LIFE.push(disposer(acx.tools.register(echoDef), LIFE, 'member-echo-tool'))
      let seq = 0
      LIFE.push(disposer(acx.tools.guard((exec) => {
        seq += 1
        entry.guardRows.push({ seq, name: String(exec?.name), callId: String(exec?.callId ?? ''), rootCallId: String(exec?.rootCallId ?? ''), inner: exec?.parent !== undefined })
        return undefined
      }), LIFE, 'member-guard'))
      LIFE.push(disposer(acx.tools.presentAs('ptc'), LIFE, 'member-presentAs'))
      await rebindMemberFaces(entry, agent)
      LIFE.push(disposer(acx.on?.('tools/execute', (exec, next) => {
        const out = next()
        if (exec?.name === 'run_code' && exec?.parent === undefined) {
          void Promise.resolve(out).then(
            (value) => { entry.runs.push({ at: now(), text: extractText(value), raw: safeClone(value) }) },
            () => { entry.runs.push({ at: now(), text: '(execute rejected)', raw: null }) })
        }
        return out
      }), LIFE, 'member-around-seam'))
      entry.witness = { echo: true, guard: true, presentAs: 'ptc', aroundSeam: true }
      return
    }

    // ── TEAM-LANE ACTOR: the only Grant issuance face (T-1) ─────────────────
    const grantDef = defineTool({
      name: 'a5ptc4c_grant',
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
          if (handle === undefined) return `A5PTC4C-GRANT-REJECTED no pending ask with seq=${seqNo}`
          // BINDINGS FROM THE HOST ASK RECORD — the lane cannot retarget them.
          const bind = { agent: handle.ask.agent, callId: handle.ask.callId, toolName: handle.ask.toolName, mode: handle.ask.mode }
          const r = mintLaneGrant({ source: 'ask-bound', bind, decision: args.decision, ttlMs: args.ttl_ms, issuer, pendingSeq: seqNo })
          if (!r.ok) return `A5PTC4C-GRANT-REJECTED ${r.error}`
          const g = GRANTS.get(r.grantId)
          const outcome = r.decision === 'allow' ? 'allowed-once' : 'rejected'
          consume(g, handle.seq, outcome) // T-2: spent at the moment it answers
          PENDING.delete(bindKey(bind))
          clearTimeout(handle.timer)
          handle.settle(outcome, { decision: `lane-${r.decision}@pending`, grantId: r.grantId, grantSource: 'ask-bound', issuerLane: issuer.label, ttlMs: g.ttlMs })
          return `A5PTC4C-GRANT ${r.grantId} bound=${r.key} decision=${r.decision} ttl=${g.ttlMs}ms state=consumed(ask-bound@pending)`
        }
        const parts = String(args.declared ?? '').split('|')
        if (parts.length !== 4 || parts.some((x) => x === '')) return 'A5PTC4C-GRANT-REJECTED declared must be agent|callId|toolName|mode'
        const bind = { agent: parts[0], callId: parts[1], toolName: parts[2], mode: parts[3] }
        if (!TARGETS.includes(bind.mode)) return `A5PTC4C-GRANT-REJECTED mode "${bind.mode}" is not a host escalation target`
        const r = mintLaneGrant({ source: 'declared', bind, decision: args.decision, ttlMs: args.ttl_ms, issuer })
        if (!r.ok) return `A5PTC4C-GRANT-REJECTED ${r.error}`
        return `A5PTC4C-GRANT ${r.grantId} bound=${r.key} decision=${r.decision} ttl=${GRANTS.get(r.grantId).ttlMs}ms state=issued`
      },
    })

    const revokeDef = defineTool({
      name: 'a5ptc4c_revoke',
      description: 'Team ask-lane: revoke an issued one-time grant, or refuse a pending ask outright, BEFORE it is spent. Revocation outranks every cached answer.',
      parameters: {
        grant_id: { type: 'string', description: 'grant id to revoke' },
        pending_seq: { type: 'number', description: 'pending ask seq to refuse outright' },
      },
      output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: String(v) }] },
      execute: async (args) => {
        if (args.pending_seq !== undefined && args.pending_seq !== null && args.pending_seq !== '') {
          const handle = refusePending(Number(args.pending_seq), issuer.label)
          if (handle === null) return `A5PTC4C-REVOKE-NOOP no pending ask with seq=${args.pending_seq}`
          record({ leg: 'lane-refused-pending', seq: handle.seq, bind: handle.ask, issuerLane: issuer.label })
          return `A5PTC4C-REFUSED pending seq=${handle.seq} bind=${handle.key}`
        }
        const g = GRANTS.get(String(args.grant_id ?? ''))
        if (g === undefined) return 'A5PTC4C-REVOKE-NOOP unknown grant id'
        if (g.state === 'consumed') return `A5PTC4C-REVOKE-NOOP ${g.grantId} already consumed (a spent authorization cannot be un-spent; re-presentation is refused by the consumed record)`
        const from = g.state
        g.state = 'revoked'
        g.revokedAt = now()
        g.transitions.push({ at: iso(g.revokedAt), to: 'revoked', from, by: issuer.label })
        record({ leg: 'grant-revoked', grantId: g.grantId, from, bind: g.bind, issuerLane: issuer.label })
        const handle = [...PENDING.values()].find((p) => p.key === bindKey(g.bind))
        if (handle !== undefined) refusePending(handle.seq, issuer.label)
        return `A5PTC4C-REVOKED ${g.grantId} bind=${bindKey(g.bind)}`
      },
    })

    const unloadDef = defineTool({
      name: 'a5ptc4c_unload',
      description: 'Team ask-lane: unload the per-call resolver symmetrically to its installation (T-5, F-L2-2: this runs tier ADJ — the two plugin-ctx faces, the read-only mirror, AND every member agent-ctx approval face as real disposers). Afterwards the hook census loses all our faces and this lane answers nothing.',
      parameters: { confirm: { type: 'string', required: true, description: 'the literal string "unload"' } },
      output: { schema: { type: 'string' }, render: (_a, v) => [{ type: 'text', text: String(v) }] },
      execute: async (args) => {
        if (String(args.confirm) !== 'unload') return 'A5PTC4C-UNLOAD-NOOP confirm must be "unload"'
        const n = runTier(ADJ)
        uninstalled = true
        const count = (ctx.events?._hooks?.['approval/request'] ?? []).length
        record({ leg: 'resolver-unloaded', disposersRun: n, hookCount: count, issuerLane: issuer.label, memberFaces: ADJ.filter((d) => d.__what === 'member-approval-ctx' && d.__done()).length })
        return `A5PTC4C-UNLOADED disposers=${n} hookCount=${count}`
      },
    })

    LIFE.push(disposer(acx.tools.register(grantDef), LIFE, 'lane-grant-tool'))
    LIFE.push(disposer(acx.tools.register(revokeDef), LIFE, 'lane-revoke-tool'))
    LIFE.push(disposer(acx.tools.register(unloadDef), LIFE, 'lane-unload-tool'))
    entry.laneTools = ['a5ptc4c_grant', 'a5ptc4c_revoke', 'a5ptc4c_unload']
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
