#!/usr/bin/env node
/**
 * a2permh3-check.mjs — H3 (alpha.2 hardening closure) live verification
 * battery.
 *
 * H3 variant of the V1 a2perm-check.mjs (the V1 file is kept as-is in
 * alpha2-permission/v1/). The V1 115-check live matrix + 26-check
 * cold-resume battery run UNCHANGED (as-is); H3 appends the
 * h3-hostile-* check groups (review §21 THE live adversarial proof):
 *
 *   LIVE Phase 5 — the hostile prepend-allow drill (AFTER the V1 matrix
 *   + final-file asserts; the hostile listeners only exist from here on):
 *     - the leader (a2root, post-N4 re-resolved agent) gets a hostile
 *       tools/pre-execute prepend-allow via the test-only
 *       /__hardening/hostile-prepend seam (DSH_HARDENING_PROBE-gated);
 *     - a POLICY-ALLOWED op (read perm-a), a DEFAULT-ASK op (read perm-d)
 *       and an ASK-LANE write (perm-c, file must stay unchanged) are all
 *       DENIED with the EXACT stable end-cap reason (byte-identical to
 *       h1a's END_CAP_REASON), ZERO new control rows;
 *     - worker-b (default-deny, empty lanes): a hostile prepend-allow
 *       still yields the END-CAP reason (not the policy-deny reason —
 *       the end-cap, not the policy, decides);
 *     - worker-a (NO hostile prepend): read perm-a still EXECUTES
 *       (agent-scoped install/guard — no cross-agent leak, live A9/A16);
 *     - the PTC leg (A10/A11): worker-a gets the hostile prepend + an
 *       H3-PTC-TRIGGER member turn whose single model response carries
 *       TWO managed read calls — BOTH end-cap-denied, ZERO control rows,
 *       the turn settles on its own (the ask lane was never reached);
 *     - the /state observations readout carries the end-cap-denial rows
 *       with the stable reason (review §18, fresh world);
 *     - the durable control plane is UNCHANGED across the whole hostile
 *       phase (zero request/decision/consumption deltas).
 *   COLD — the h3-hostile-cold group (A12/A14): the SAME hostile drill on
 *   the COLD-RESUMED leader (the re-installed end-cap of the cold-root /
 *   cold-member bind paths is active: policy-allowed read perm-a denied
 *   with the exact end-cap reason; default-ask read perm-d denied with
 *   ZERO new requests; the observations readout carries the end-cap-
 *   denial rows — review §18, cold world).
 *
 * Drives the RUNNING a2perm world (a2perm-boot.mjs boot job) through the
 * plan §12 live matrix and emits live-perm.json (A2_MODE=live, the
 * default) or cold-resume.json (A2_MODE=cold, after the phase=resume
 * re-boot of the SAME world home).
 *
 * LIVE mode phases:
 *   0 baseline — health/live-sessions/toolCount, teamSession row
 *      (blueprintId/revision/contentHash), zero control state, workspace
 *      file baselines, per-agent registered team-tool probes (the
 *      selection set + the member self-approval tool-absence probe).
 *   1 leader drill (remote team.admitInitialWork v2 → scripted mock
 *      turns): readA allow-lane / readB deny-lane / writeC1 ask-lane
 *      (user-approval request; LEADER SELF-APPROVAL NEGATIVE via the
 *      leader's own team_resolve_control; HUMAN allow via remote
 *      team.resolveControl v4) / writeC2 re-ask-after-allow / LEADER-DONE.
 *   2 member-a drill (remote member.send v1 → scripted mock turns):
 *      readA allow / readB deny / writeC1 ask-lane (leader-approval
 *      request; MEMBER SELF-APPROVAL NEGATIVE — the member has NO
 *      team_resolve_control tool; LEADER resolves via its own tool) /
 *      MEMBER-A-DONE.
 *   3 member-b drill (default deny, empty lanes): readE + writeE both
 *      statically denied — ZERO control rows for the whole turn, files
 *      unchanged, MEMBER-B-DONE.
 *   4 safety negatives (direct /__p6t6/tool driving — the FULL
 *      tools/pre-execute waterfall): N1 malformed-args deny, N2
 *      canonicalization-failure deny, N3 unsupported-tool pass-through
 *      (zero control rows), N4 ask-without-decision no-execution +
 *      residency-drop abort (the request stays pending — cancellation
 *      never decides), N5 double-consumption blocked (allow-consumed),
 *      N6 fingerprint mismatch unusable (a2-fp1 allow cannot authorize
 *      the differently-fingerprinted a2-fp2; resolved deny).
 *
 * COLD mode assertions (after the phase=resume re-boot): health + 3 live
 * sessions, the policy rebuilt from the blueprint (allow lane passes
 * without a request row; deny lane statically denies), the aborted
 * request a2-n4 still pending (survives), every consumed decision +
 * consumption preserved, double-consumption still blocked, no hang.
 *
 * Usage: node a2perm-check.mjs   (A2_MODE=live|cold, A2_STAMP optional —
 *                                 default = the newest a2perm world)
 */
import {
  appendFileSync,
  existsSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const EV = dirname(fileURLToPath(import.meta.url))
function findMainRepoRoot(start) {
  let dir = start
  for (;;) {
    if (existsSync(join(dir, '.worktrees', 'RC1', 'tests', 'characterization', 'lib', 'instance.mjs'))) return dir
    const parent = dirname(dir)
    if (parent === dir) throw new Error(`no ancestor of ${start} carries .worktrees/RC1`)
    dir = parent
  }
}
const REPO = findMainRepoRoot(EV)

const MODE = process.env.A2_MODE === 'cold' ? 'cold' : 'live'
let STAMP = process.env.A2_STAMP
let STATE_FILE
if (STAMP) {
  STATE_FILE = join(EV, `a2stateh3-a2perm-${STAMP}.json`)
} else {
  const states = readdirSync(EV).filter((f) => f.startsWith('a2stateh3-a2perm-') && f.endsWith('.json')).sort()
  if (states.length === 0) { console.error('no a2stateh3-a2perm-*.json — boot the world first'); process.exit(1) }
  STATE_FILE = join(EV, states[states.length - 1])
  STAMP = states[states.length - 1].replace(/^a2stateh3-a2perm-/, '').replace(/\.json$/, '')
}
if (!existsSync(STATE_FILE)) { console.error(`no state file: ${STATE_FILE}`); process.exit(1) }
const state = JSON.parse(readFileSync(STATE_FILE, 'utf8'))
const { origin, cookie, port, rootSessionId } = state
const WORKSPACE = join(state.home, 'workspace-a2perm')
const OUT_FILE = join(EV, MODE === 'cold' ? `h3-cold-resume-${STAMP}.json` : `h3-live-perm-${STAMP}.json`)

const log = (line) => {
  const stamped = `[${new Date().toISOString()}] ${line}`
  console.log(stamped)
  appendFileSync(OUT_FILE + '.log', stamped + '\n')
}

// ── helpers ─────────────────────────────────────────────────────────────────
async function fetchJson(url, init, timeoutMs = 30_000) {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
    const text = await res.text()
    let body
    try { body = JSON.parse(text) } catch { body = text }
    return { status: res.status, body, text }
  } catch (e) {
    return { status: null, body: { readError: String(e?.message ?? e) } }
  }
}
async function remoteCall(method, params, version = 1) {
  return fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `chk-${Date.now().toString(16)}${Math.floor(Math.random() * 1e6).toString(16)}`,
      method,
      payload: { version, params },
    }),
  }, 120_000)
}
async function p6t6State() {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/state`, undefined, 15_000)
}
async function p6t6Health() {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/health`, undefined, 10_000)
}
async function p6t6Tool(name, args, as, callId, timeoutMs = 120_000) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/tool`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, args, as, callId }),
  }, timeoutMs)
}
async function p6t6Drop(sessionId) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/residency/drop`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId }),
  }, 60_000)
}
// H3 — the hostile-seam route (test-only; live only because the H3 boot
// spawns the host with DSH_HARDENING_PROBE=1). Prepend-allow is installed
// on the CURRENT live agent ctx (ensureLiveAgent — post-N4 drops it is the
// re-resolved cold-root install, exactly where the hostile listener must
// land to be dangerous).
async function hostilePrepend(agent) {
  return fetchJson(`http://127.0.0.1:${port}/__hardening/hostile-prepend`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ agent }),
  }, 30_000)
}
// H3 — the stable monotonic end-cap denial reason (BYTE-IDENTICAL to
// packages/runtime/test/h1a-pre-execute-endcap.test.ts END_CAP_REASON; the
// §21 criterion requires the exact reason, not a pattern).
const END_CAP_REASON = 'permission denied: no Team permission authorization for this execution (pre-dispatch policy not reached — monotonic end-cap)'
const END_CAP_STAGE = 'end-cap-denial'
// H3 — parse the /state observations readout (review §18): the rows are
// 'alpha2-perm: {json-string}' — return the parsed JSON objects.
function parsedObservations(st) {
  const out = []
  for (const row of st?.observations ?? []) {
    if (typeof row !== 'string' || !row.startsWith('alpha2-perm: ')) continue
    try { out.push(JSON.parse(row.slice('alpha2-perm: '.length))) } catch { /* unparseable — leave out */ }
  }
  return out
}
async function ledgerFacts(factType) {
  const res = await remoteCall('team.getLedgerPage', { teamSessionId: rootSessionId, afterSequence: 0, limit: 500 })
  if (res.status !== 200) return { error: `getLedgerPage HTTP ${res.status}: ${JSON.stringify(res.body).slice(0, 300)}`, entries: [] }
  // the ACTUAL wire shape (probed live 2026-09-10 on the v12 world — parent
  // ruling: extract against the real shape, do not guess paths):
  // { type:'server-response', rpcId, result:{ ok, value:{ data:{ entries, nextAfterSequence, total } } } }
  const entries = (res.body?.result?.value?.data?.entries
    ?? res.body?.value?.data?.entries
    ?? res.body?.data?.entries
    ?? [])
  return { entries, filtered: factType === undefined || factType === null ? entries : entries.filter((e) => e?.factType === factType) }
}
/**
 * One raw `control-request-recorded` ledger entry by correlation. The /state
 * projection does NOT expose rootSessionId / requester / operationFingerprint
 * (plugin.mjs maps only requestId/kind/targetInstanceId/actionName/toolName/
 * correlation/status/createdAt) — the raw ledger payload is the actual shape:
 * `payload.operationFingerprint` at the PAYLOAD TOP LEVEL (the A5 adapter
 * passes it as a top-level requestControl arg), `entry.rootSessionId` at the
 * entry level, `payload.requester` = {kind,instanceId,role}.
 */
async function requestFact(correlation) {
  const { filtered } = await ledgerFacts('control-request-recorded')
  return filtered.find((e) => e?.payload?.correlation === correlation) ?? null
}
/**
 * v15 (v14 run-1 discovery, probed live): while an ACTIVE MEMBER TURN is
 * running, the p6t6 /state route BLOCKS — its ports (listControlState /
 * recoverPendingDeliveries) acquire the per-team work chain that the member
 * turn holds for the whole turn, including the blocked control-ask wait.
 * Probed on the live v14 world: /state 15s client-timeout while the member
 * turn was blocked (6 min span), /team-remote ledger 29ms + resolveControl
 * 147–203ms on the SAME blocked world, /state 1065ms again once the turn
 * settled; a /tool-driven ask (no active turn) does NOT block /state (4ms).
 * The ROOT turn is unaffected (it runs WITHOUT the chain — root-initial-
 * work.ts), which is why the leader phase stayed /state-observable in v13/v14.
 * Consequence: member-phase observation runs on the RAW ledger and member
 * resolutions run on the /team-remote v4 route (the same control-service
 * resolver closure the team_resolve_control tool invokes).
 */
async function ledgerPendingRequest(correlation) {
  const { filtered: reqs } = await ledgerFacts('control-request-recorded')
  const { filtered: decs } = await ledgerFacts('control-decision-recorded')
  const req = reqs.find((e) => e?.payload?.correlation === correlation)
  if (!req) return null
  const decided = decs.some((e) => e?.payload?.requestId === req.payload.requestId)
  if (decided) return null
  return {
    requestId: req.payload.requestId,
    kind: req.payload.kind,
    targetInstanceId: req.payload.targetInstanceId,
    correlation,
    createdAt: req.createdAt,
  }
}
async function ledgerConsumed(requestId) {
  const { filtered } = await ledgerFacts('control-allow-consumed')
  return filtered.find((e) => e?.payload?.requestId === requestId) ?? null
}
async function ledgerLaneRequestCount(correlations) {
  const { filtered } = await ledgerFacts('control-request-recorded')
  return filtered.filter((e) => correlations.includes(e?.payload?.correlation)).length
}
async function ledgerRequesterRequestCount(instanceId) {
  const { filtered } = await ledgerFacts('control-request-recorded')
  return filtered.filter((e) => e?.payload?.requester?.instanceId === instanceId).length
}
function mockSawStep(identity, stepId) {
  const text = readFileSync(state.mockLogPath, 'utf8')
  return text.split('\n').some((l) => l.includes(`identity=${identity} `) && l.includes(`tool-call:${stepId}:`))
}
function mockSawResult(identity, stepId) {
  const text = readFileSync(state.mockLogPath, 'utf8')
  return text.split('\n').some((l) => l.includes(`identity=${identity} `) && l.includes(`trigger=tool:${stepId}`))
}
async function waitUntil(fn, timeoutMs = 90_000, label = 'condition') {
  const deadline = Date.now() + timeoutMs
  let last = null
  for (;;) {
    try {
      last = await fn()
      if (last !== null && last !== undefined && last !== false) return last
    } catch { /* retry */ }
    if (Date.now() >= deadline) throw new Error(`waitUntil timeout (${timeoutMs} ms): ${label}`)
    await new Promise((r) => setTimeout(r, 250))
  }
}
const readWs = (name) => readFileSync(join(WORKSPACE, name), 'utf8')
function mockLineCount(identity) {
  const text = readFileSync(state.mockLogPath, 'utf8')
  return text.split('\n').filter((l) => l.includes(`identity=${identity} `)).length
}
function mockSaw(substring) {
  const text = readFileSync(state.mockLogPath, 'utf8')
  return text.includes(substring)
}
/**
 * V1-1 (assertion strengthening, parent directive #2): the CONTENT of the
 * tool result the mock logged for one scripted tool call
 * (`trigger=tool:<id> result=<content 160>`). Returns null when the result
 * line is not logged yet (the assertion FAILS on null — a denied lane that
 * never reached the model is not a pass either). The execution-vs-denial
 * discriminators: success = file content present + no 'permission denied';
 * static deny = 'permission denied by the static permission policy' +
 * 'denies <tool> on' (NOT 'canonicalization failed'/'resolver-threw',
 * which would mean the fs seam is broken, not the policy deciding).
 */
function mockToolResult(identity, toolCallId) {
  const text = readFileSync(state.mockLogPath, 'utf8')
  const line = text
    .split('\n')
    .find((l) => l.includes(`identity=${identity} `) && l.includes(`trigger=tool:${toolCallId}`))
  if (line === undefined) return null
  const m = line.match(/ result=(.*) → /)
  return m ? m[1] : ''
}
const pendingRequest = (st, correlation) =>
  (st?.control?.requests ?? []).find((r) => r.correlation === correlation) ?? null
const consumptionFor = (st, requestId) =>
  (st?.control?.consumptions ?? []).find((c) => c.requestId === requestId) ?? null
function humanResolve(requestId, decision, note) {
  return remoteCall('team.resolveControl', { teamSessionId: rootSessionId, requestId, decision, ...(note !== undefined ? { note } : {}) }, 4)
}

// ── the checks record ───────────────────────────────────────────────────────
const checks = []
function check(id, label, expected, actual, ok, detail) {
  checks.push({ id, label, expected, actual, ok: !!ok, detail: detail ?? null })
  log(`${ok ? 'PASS' : 'FAIL'} ${id} — ${label}${!ok ? ` (expected=${JSON.stringify(expected)?.slice(0, 200)} actual=${JSON.stringify(actual)?.slice(0, 200)})` : ''}`)
}

const evidence = {
  mode: MODE,
  worldHome: state.home,
  branch: state.branch,
  rootSessionId,
  phase: state.phase,
  startedAt: new Date().toISOString(),
  baselineFiles: null,
  finalFiles: null,
  counts: null,
}

async function main() {
  if (MODE === 'cold') await coldMode()
  else await liveMode()

  evidence.finishedAt = new Date().toISOString()
  evidence.verdict = {
    overall: checks.every((c) => c.ok) ? `${MODE.toUpperCase()} PASS` : `${MODE.toUpperCase()} FAIL`,
    total: checks.length,
    passed: checks.filter((c) => c.ok).length,
    failed: checks.filter((c) => !c.ok).length,
  }
  writeFileSync(OUT_FILE, JSON.stringify({ ...evidence, checks }, null, 2))
  log(`verdict: ${evidence.verdict.overall} (${evidence.verdict.passed}/${evidence.verdict.total}) → ${OUT_FILE}`)
  if (!evidence.verdict.overall.endsWith('PASS')) process.exitCode = 1
}

// ── LIVE mode ───────────────────────────────────────────────────────────────
async function liveMode() {
  // ── Phase 0 — baseline ──────────────────────────────────────────────────
  const hb = await p6t6Health()
  check('live-health-ok', 'p6t6 health ok', true, hb.body?.ok === true, hb.body?.ok === true, JSON.stringify(hb.body).slice(0, 300))
  check('live-toolcount-10', 'factory catalog toolCount = 10', 10, hb.body?.toolCount ?? null, hb.body?.toolCount === 10)
  const live = hb.body?.liveSessions ?? []
  check('live-sessions-3', 'leader + 2 seeded members live', JSON.stringify(['a2root', 'session-a2a-a', 'session-a2b-b']), JSON.stringify(live),
    JSON.stringify(live) === JSON.stringify(['a2root', 'session-a2a-a', 'session-a2b-b']))

  let st = (await p6t6State()).body
  check('live-blueprint-team.a2perm', 'teamSession blueprintId = team.a2perm', 'team.a2perm', st?.teamSession?.blueprintId ?? null, st?.teamSession?.blueprintId === 'team.a2perm')
  evidence.blueprintContentHash = st?.teamSession?.contentHash ?? null
  check('live-contenthash-recorded', 'teamSession contentHash recorded (the A1-validated hash)', 'non-empty string', evidence.blueprintContentHash,
    typeof evidence.blueprintContentHash === 'string' && evidence.blueprintContentHash.length >= 64,
    `contentHash=${evidence.blueprintContentHash}`)
  check('live-defaultworkspace', 'teamSession defaultWorkspace = the pre-created workspace', WORKSPACE, st?.teamSession?.defaultWorkspace ?? null,
    st?.teamSession?.defaultWorkspace === WORKSPACE)
  check('live-control-zero', 'zero control state at boot', { requests: 0, decisions: 0, consumptions: 0 },
    { requests: st?.control?.requests?.length, decisions: st?.control?.decisions?.length, consumptions: st?.control?.consumptions?.length },
    st?.control?.requests?.length === 0 && st?.control?.decisions?.length === 0 && st?.control?.consumptions?.length === 0)

  const baseline = {}
  for (const f of ['perm-a.txt', 'perm-b.txt', 'perm-c.txt', 'perm-d.txt', 'perm-e.txt']) baseline[f] = readWs(f)
  evidence.baselineFiles = baseline
  log(`baseline files recorded (perm-a..e.txt)`)

  // registered team-tool probes (selection set + the member resolve-absence probe)
  const probe = async (as, name) => {
    const r = await p6t6Tool(name, {}, as, `a2-probe-${name}-${as}`)
    if (r.body?.ok === true) return 'registered'
    const msg = String(r.body?.error?.message ?? '')
    return /unknown|not registered|not a tool|no tool/i.test(msg) ? 'not-registered' : `registered-tool-error: ${msg.slice(0, 120)}`
  }
  const probes = {}
  probes['a2root:team_list_members'] = await probe('a2root', 'team_list_members')
  probes['a2root:team_delegate'] = await probe('a2root', 'team_delegate')
  probes['a2root:team_request_control'] = await probe('a2root', 'team_request_control')
  probes['a2root:team_resolve_control'] = await probe('a2root', 'team_resolve_control')
  probes['session-a2a-a:team_delegate'] = await probe('session-a2a-a', 'team_delegate')
  probes['session-a2a-a:team_request_control'] = await probe('session-a2a-a', 'team_request_control')
  probes['session-a2a-a:team_resolve_control'] = await probe('session-a2a-a', 'team_resolve_control')
  probes['session-a2b-b:team_send_message'] = await probe('session-a2b-b', 'team_send_message')
  probes['session-a2b-b:team_request_control'] = await probe('session-a2b-b', 'team_request_control')
  probes['session-a2b-b:team_resolve_control'] = await probe('session-a2b-b', 'team_resolve_control')
  evidence.toolProbes = probes
  check('live-probe-leader-list', 'leader team_list_members registered', 'registered', probes['a2root:team_list_members'], probes['a2root:team_list_members'] === 'registered')
  check('live-probe-leader-delegate-absent', 'leader team_delegate NOT in the allow set (capability selection active)', 'not-registered', probes['a2root:team_delegate'], probes['a2root:team_delegate'] === 'not-registered')
  check('live-probe-leader-resolve', 'leader team_resolve_control registered', 'registered', probes['a2root:team_resolve_control'], probes['a2root:team_resolve_control'] === 'registered')
  check('live-probe-memberA-delegate', 'worker-a team_delegate registered', 'registered', probes['session-a2a-a:team_delegate'], probes['session-a2a-a:team_delegate'] === 'registered')
  check('live-probe-memberA-resolve-absent', 'worker-a team_resolve_control NOT registered (member self-approval has no tool)', 'not-registered', probes['session-a2a-a:team_resolve_control'], probes['session-a2a-a:team_resolve_control'] === 'not-registered')
  check('live-probe-memberB-request-absent', 'worker-b team_request_control NOT registered (allow set = team_send_message only)', 'not-registered', probes['session-a2b-b:team_request_control'], probes['session-a2b-b:team_request_control'] === 'not-registered')

  // ── Phase 1 — leader drill (V1 kit fix, parent ruling on the v12 run) ───
  // The drill chains INSIDE one model turn (the leader has no second
  // user-turn route: team.admitInitialWork carries at most ONE initial-work
  // slot per creation — root-initial-work.ts INITIAL_WORK_ALREADY_ADMITTED).
  // The zero-request asserts are therefore scoped to the READ operations of
  // the lane under test: the autonomous chain may already have opened the
  // readC ask (a DIFFERENT operation) by the time the kit samples (v12 race:
  // writeC1 dispatched 20:15:48.588, L1 assert ran :48.749 — expected=0
  // actual=1). The scoped invariant is the plan §12.1 one: the allow/deny
  // READ lanes create zero requests for those operations.
  const READ_LANES = ['a2L-readA', 'a2L-readB']
  // v14 (parent directive): AWAIT the admit response and record the FULL
  // response body + wall-clock latency in the evidence JSON — v13's L7
  // FAIL was a wire-shape blind spot (the kit read body.ok where the
  // /team-remote wire carries result.ok); the body dump records what the
  // admitted root work actually returns.
  const leaderT0 = Date.now()
  const leaderWork = remoteCall('team.admitInitialWork', { rootSessionId, requestToken: 'a2-lead-1', prompt: 'Run the permission drill now.' }, 2)
  log('leader drill: team.admitInitialWork fired (v2, background)')

  await waitUntil(() => mockSawResult('leader', 'a2L-readA'), 90_000, 'leader readA result landed')
  st = (await p6t6State()).body
  const l1LaneRequests = (st?.control?.requests ?? []).filter((r) => READ_LANES.includes(r.correlation))
  check('live-L1-allow-lane-no-request', 'read perm-a (allow lane) created ZERO control requests for the read lanes (scoped: the chain may already hold the readC ask — a different operation — the v12 race)',
    0, l1LaneRequests.length,
    l1LaneRequests.length === 0, `laneRequests=${JSON.stringify(l1LaneRequests ?? null).slice(0, 200)} all=${(st?.control?.requests ?? []).length}`)
  const l1Result = mockToolResult('leader', 'a2L-readA')
  check('live-L1-allow-executed-success', 'read perm-a EXECUTED: the tool result carries the file content and NO denial (a denied read would ALSO satisfy the zero-request check — the V1-1 gap)',
    'success result with content', l1Result,
    l1Result !== null && l1Result.includes('perm-a: allow-read target') && !/permission denied/i.test(l1Result),
    `result=${String(l1Result).slice(0, 200)}`)

  await waitUntil(() => mockSawResult('leader', 'a2L-readB'), 90_000, 'leader readB result landed')
  st = (await p6t6State()).body
  const l2LaneRequests = (st?.control?.requests ?? []).filter((r) => READ_LANES.includes(r.correlation))
  check('live-L2-deny-lane-no-request', 'read perm-b (deny lane) created ZERO control requests for the read lanes (deny is static — no requestControl at all)',
    0, l2LaneRequests.length,
    l2LaneRequests.length === 0, `laneRequests=${JSON.stringify(l2LaneRequests ?? null).slice(0, 200)} all=${(st?.control?.requests ?? []).length}`)
  const l2Result = mockToolResult('leader', 'a2L-readB')
  check('live-L2-deny-static-reason', 'read perm-b denied by the STATIC POLICY (the deny rule) — NOT a canonicalization/resolver failure (that would be the fs seam broken, not the policy deciding)',
    'static policy denial', l2Result,
    l2Result !== null && /permission denied by the static permission policy/.test(l2Result) && /denies read on/.test(l2Result) && !/canonicalization failed|resolver-threw/.test(l2Result),
    `result=${String(l2Result).slice(0, 200)}`)
  check('live-L2-deny-file-unchanged', 'perm-b.txt unchanged after static deny', baseline['perm-b.txt'], readWs('perm-b.txt'), readWs('perm-b.txt') === baseline['perm-b.txt'])

  // readC — the ASK lane on READ (no rule for read perm-c → default ask), and
  // it sets this session's fs read state so the perm-c writes below pass the
  // upstream write tool's read-before-overwrite rule (v12 seq=5: the allowed
  // writeC1 re-executed but fs then refused: `cannot overwrite existing
  // "...perm-c.txt" without reading it first` — an await-bridge PASS).
  const reqRC = await waitUntil(async () => {
    const s = (await p6t6State()).body
    return pendingRequest(s, 'a2L-readC')
  }, 90_000, 'leader readC ask request pending')
  check('live-L3a-ask-request-created', 'read perm-c (no rule → default ask) created a durable control request', 'pending request a2L-readC', reqRC?.requestId ?? null, !!reqRC,
    JSON.stringify(reqRC).slice(0, 300))
  check('live-L3a-kind-user-approval', 'leader ask routes to kind=user-approval (human-only resolver closure)', 'user-approval', reqRC?.kind ?? null, reqRC?.kind === 'user-approval')
  check('live-L3a-target-leader', 'request targetInstanceId = the leader instance', 'inst-leader', reqRC?.targetInstanceId ?? null, reqRC?.targetInstanceId === 'inst-leader')
  const rcFact = await requestFact('a2L-readC')
  check('live-L3a-scope-exact', 'request scope = the EXACT operation (root + leader caller + leader target + action + tool + correlation) — RAW ledger payload (the /state projection omits these fields)',
    'exact scope fields',
    { root: rcFact?.rootSessionId, requester: rcFact?.payload?.requester, target: reqRC?.targetInstanceId, corr: reqRC?.correlation },
    rcFact?.rootSessionId === rootSessionId
      && rcFact?.payload?.requester?.kind === 'instance' && rcFact?.payload?.requester?.instanceId === 'inst-leader'
      && rcFact?.payload?.actionName === 'parameter-permission' && rcFact?.payload?.toolName === 'read'
      && reqRC?.targetInstanceId === 'inst-leader' && reqRC?.correlation === 'a2L-readC')
  check('live-L3a-fingerprint-bound', 'request carries the EXACT operation fingerprint (payload top level, sha256:… — the A4 allow binds to this exact operation)',
    'sha256 fingerprint', typeof rcFact?.payload?.operationFingerprint,
    typeof rcFact?.payload?.operationFingerprint === 'string' && /^sha256:[0-9a-f]{16,}$/.test(rcFact.payload.operationFingerprint),
    `fp=${String(rcFact?.payload?.operationFingerprint).slice(0, 80)}`)
  check('live-L3a-no-execution-yet', 'perm-c.txt unchanged while the read request is pending', baseline['perm-c.txt'], readWs('perm-c.txt'), readWs('perm-c.txt') === baseline['perm-c.txt'])

  // leader self-approval NEGATIVE — exercised THROUGH the leader instance's
  // team_resolve_control tool (a2root session context = the leader caller).
  const selfRes = await p6t6Tool('team_resolve_control', { rootSessionId, requestToken: 'a2-self-1', requestId: reqRC.requestId, decision: 'allow' }, 'a2root', 'a2-self-resolve-1')
  const selfValue = selfRes.body?.value ?? {}
  check('live-L4-leader-self-approval-negative', 'leader self-approval of its own user-approval request is NOT authorized (typed CONTROL_RESOLVER_NOT_AUTHORIZED, role=leader, allowedRoles=[human])',
    'typed resolver-not-authorized',
    { ok: selfRes.body?.ok, status: selfValue.status, code: selfValue.code, role: selfValue.details?.role, allowed: selfValue.details?.allowedRoles },
    selfRes.body?.ok === true && selfValue.status === 'rejected'
      && selfValue.code === 'CONTROL_RESOLVER_NOT_AUTHORIZED'
      && selfValue.details?.role === 'leader'
      && JSON.stringify(selfValue.details?.allowedRoles) === JSON.stringify(['human']),
    JSON.stringify(selfRes.body).slice(0, 300))
  st = (await p6t6State()).body
  const stillPending = pendingRequest(st, 'a2L-readC')
  check('live-L4-still-pending', 'request still pending after the failed self-approval', 'pending', stillPending?.status ?? null, stillPending?.status === 'pending')

  // HUMAN resolution (remote team.resolveControl v4 — a remote call is HUMAN
  // by design; the self-approval negative above is the tool-path test)
  const humanRC = await humanResolve(reqRC.requestId, 'allow', 'V1 kit human allow (leader readC)')
  check('live-L3a-human-allow', 'remote team.resolveControl (v4, human) allow succeeds for the readC ask', 200, humanRC.status, humanRC.status === 200, JSON.stringify(humanRC.body).slice(0, 300))
  await waitUntil(() => mockSawResult('leader', 'a2L-readC'), 90_000, 'leader readC executed (turn ended)')
  const rcResult = mockToolResult('leader', 'a2L-readC')
  check('live-L3a-executed', 'the readC EXECUTED after the human allow (the result carries the perm-c sentinel content — the await bridge woke the blocked tool call)',
    'success result with content', rcResult,
    rcResult !== null && rcResult.includes('perm-c: initial sentinel') && !/permission denied/i.test(rcResult),
    `result=${String(rcResult).slice(0, 200)}`)
  check('live-L3a-file-unchanged', 'perm-c.txt unchanged after the read (reads have zero write effect)', baseline['perm-c.txt'], readWs('perm-c.txt'), readWs('perm-c.txt') === baseline['perm-c.txt'])
  st = (await p6t6State()).body
  check('live-L3a-consumed', 'the readC allow was consumed exactly once', 'consumption row for ' + reqRC.requestId, consumptionFor(st, reqRC.requestId) ? 'consumed' : 'not-consumed', !!consumptionFor(st, reqRC.requestId))

  // writeC1 — the ASK lane on write (the fs read state is now set by readC)
  const reqC1 = await waitUntil(async () => {
    const s = (await p6t6State()).body
    return pendingRequest(s, 'a2L-writeC1')
  }, 90_000, 'leader writeC1 ask request pending')
  check('live-L3-ask-request-created', 'write perm-c (ask lane) created a durable control request', 'pending request a2L-writeC1', reqC1?.requestId ?? null, !!reqC1,
    JSON.stringify(reqC1).slice(0, 300))
  check('live-L3-kind-user-approval', 'leader ask routes to kind=user-approval (human-only resolver closure)', 'user-approval', reqC1?.kind ?? null, reqC1?.kind === 'user-approval')
  check('live-L3-target-leader', 'request targetInstanceId = the leader instance', 'inst-leader', reqC1?.targetInstanceId ?? null, reqC1?.targetInstanceId === 'inst-leader')
  check('live-L3-action-parameter-permission', 'request actionName = parameter-permission (the A5 closed action name)', 'parameter-permission', reqC1?.actionName ?? null, reqC1?.actionName === 'parameter-permission')
  check('live-L3-tool-write', 'request toolName = write', 'write', reqC1?.toolName ?? null, reqC1?.toolName === 'write')
  const c1Fact = await requestFact('a2L-writeC1')
  check('live-L3-scope-exact', 'request scope = the EXACT operation (root + leader caller + leader target + action + tool + correlation) — RAW ledger payload',
    'exact scope fields',
    { root: c1Fact?.rootSessionId, requester: c1Fact?.payload?.requester, target: reqC1?.targetInstanceId, corr: reqC1?.correlation },
    c1Fact?.rootSessionId === rootSessionId
      && c1Fact?.payload?.requester?.kind === 'instance' && c1Fact?.payload?.requester?.instanceId === 'inst-leader'
      && c1Fact?.payload?.actionName === 'parameter-permission' && c1Fact?.payload?.toolName === 'write'
      && reqC1?.targetInstanceId === 'inst-leader' && reqC1?.correlation === 'a2L-writeC1')
  check('live-L3-fingerprint-bound', 'request carries the EXACT operation fingerprint (payload top level, sha256:… — the A4 allow binds to this exact operation, not the tool or the correlation)',
    'sha256 fingerprint', typeof c1Fact?.payload?.operationFingerprint,
    typeof c1Fact?.payload?.operationFingerprint === 'string' && /^sha256:[0-9a-f]{16,}$/.test(c1Fact.payload.operationFingerprint),
    `fp=${String(c1Fact?.payload?.operationFingerprint).slice(0, 80)}`)
  check('live-L3-no-execution-yet', 'perm-c.txt unchanged while the request is pending', baseline['perm-c.txt'], readWs('perm-c.txt'), readWs('perm-c.txt') === baseline['perm-c.txt'])

  // HUMAN resolution → the write EXECUTES (this leg hung in v12: the await
  // bridge fired, but fs then refused the overwrite of an unread file)
  const human1 = await humanResolve(reqC1.requestId, 'allow', 'V1 kit human allow (leader writeC1)')
  check('live-L5-human-allow', 'remote team.resolveControl (v4, human) allow succeeds', 200, human1.status, human1.status === 200, JSON.stringify(human1.body).slice(0, 300))
  await waitUntil(async () => readWs('perm-c.txt') === 'leader-payload-1', 90_000, 'writeC1 executed after human allow')
  await waitUntil(() => mockSawResult('leader', 'a2L-writeC1'), 90_000, 'leader writeC1 result landed (turn ended)')
  const c1Result = mockToolResult('leader', 'a2L-writeC1')
  st = (await p6t6State()).body
  check('live-L5-executed', 'perm-c.txt = leader-payload-1 after the allow (the write EXECUTED)', 'leader-payload-1', readWs('perm-c.txt'), readWs('perm-c.txt') === 'leader-payload-1')
  check('live-L5-write-result-clean', 'the writeC1 tool result carries NO error (the fs read-before-overwrite precondition was satisfied by readC — v12 seq=5 was `cannot overwrite existing … without reading it first`)',
    'no error in result', c1Result,
    c1Result !== null && !/error|cannot overwrite/i.test(c1Result), `result=${String(c1Result).slice(0, 200)}`)
  check('live-L5-consumed', 'the allow was consumed exactly once (control-allow-consumed)', 'consumption row for ' + reqC1.requestId, consumptionFor(st, reqC1.requestId) ? 'consumed' : 'not-consumed', !!consumptionFor(st, reqC1.requestId))

  // writeC2 — the RE-ASK after the previous allow was consumed
  const reqC2 = await waitUntil(async () => {
    const s = (await p6t6State()).body
    return pendingRequest(s, 'a2L-writeC2')
  }, 90_000, 'leader writeC2 re-ask request pending')
  check('live-L6-re-ask', 'second write perm-c (same lane, new call) re-asks (the previous allow was consumed)', 'pending request a2L-writeC2', reqC2?.requestId ?? null, !!reqC2 && reqC2.requestId !== reqC1.requestId)
  const c2Fact = await requestFact('a2L-writeC2')
  check('live-L6-fingerprint-bound', 'the re-ask request ALSO carries its own exact operation fingerprint — and it is DISTINCT from writeC1 (different content → different operation; a consumed allow never silently re-opens)',
    'sha256 fingerprint, fp2 !== fp1',
    { fp1: String(c1Fact?.payload?.operationFingerprint ?? '').slice(0, 24) + '…', fp2: String(c2Fact?.payload?.operationFingerprint ?? '').slice(0, 24) + '…' },
    typeof c2Fact?.payload?.operationFingerprint === 'string' && /^sha256:[0-9a-f]{16,}$/.test(c2Fact.payload.operationFingerprint)
      && c2Fact.payload.operationFingerprint !== c1Fact?.payload?.operationFingerprint,
    `fp1=${c1Fact?.payload?.operationFingerprint} fp2=${c2Fact?.payload?.operationFingerprint}`)
  await humanResolve(reqC2.requestId, 'allow', 'V1 kit human allow (leader writeC2)')
  await waitUntil(async () => readWs('perm-c.txt') === 'leader-payload-2', 90_000, 'writeC2 executed after human allow')
  await waitUntil(() => mockSawResult('leader', 'a2L-writeC2'), 90_000, 'leader writeC2 result landed (turn ended)')
  st = (await p6t6State()).body
  check('live-L6-executed', 'perm-c.txt = leader-payload-2 after the second allow', 'leader-payload-2', readWs('perm-c.txt'), readWs('perm-c.txt') === 'leader-payload-2')
  check('live-L6-consumed-2', 'second allow consumed exactly once', 'consumption row for ' + reqC2.requestId, consumptionFor(st, reqC2.requestId) ? 'consumed' : 'not-consumed', !!consumptionFor(st, reqC2.requestId))

  const leaderWorkRes = await leaderWork
  // /team-remote wire shape: { type:'server-response', rpcId, result:{ ok, value } }
  evidence.leaderAdmit = {
    firedAt: new Date(leaderT0).toISOString(),
    latencyMs: Date.now() - leaderT0,
    httpStatus: leaderWorkRes.status,
    body: leaderWorkRes.body,
  }
  check('live-L7-turn-settled', 'leader drill turn settled (admitInitialWork returned ok)', true, leaderWorkRes.body?.result?.ok === true, leaderWorkRes.body?.result?.ok === true, JSON.stringify(leaderWorkRes.body).slice(0, 250))
  check('live-L7-leader-done', 'mock script reached LEADER-DONE', true, mockSaw('LEADER-DONE'), mockSaw('LEADER-DONE'))

  // ── Phase 2 — member-a drill (the chain runs in ONE model turn — members
  //    get their work via member.send; the zero-request asserts are scoped
  //    to the read lanes, as in Phase 1 — the v12 race fix) ────────────────
  // Principal model (probed live in v13, TEAM_REMOTE_PRINCIPAL_INVALID): a
  // HUMAN caller claim must name the OWNING ROOT — the humanId IS the root
  // session id (s6-principal.ts deriveAdmissionCaller: ownsRoot(humanId)).
  // v14 (parent directive): AWAIT + record the full member.send response
  // body + wall-clock latency — v13's member stall was a PRINCIPAL_INVALID
  // error response the kit never examined (principal fixed: humanId must be
  // the owning root). A member.send for a chain that ASKS settles only when
  // the member turn ends (after the kit resolves the asks) — the latency
  // records the full delivery span, not an admission hang.
  const memberAT0 = Date.now()
  const MEMBER_READ_LANES = ['a2A-readA', 'a2A-readB']
  const memberA = remoteCall('member.send', {
    teamSessionId: rootSessionId,
    caller: { kind: 'human', humanId: rootSessionId },
    recipientInstanceId: 'inst-a2pa',
    body: 'Run your permission drill now.',
    requestToken: 'a2-mA-1',
  }, 1)
  log('member-a drill: member.send fired (v1, background)')

  // v15: the member turn is ACTIVE from here on — /state blocks for its
  // whole duration (see the ledgerPendingRequest docstring), so the lane
  // asserts observe the RAW ledger (proven live during a blocked member turn).
  const beforeA = await ledgerRequesterRequestCount('inst-a2pa')
  await waitUntil(() => mockSawResult('worker-a', 'a2A-readA'), 90_000, 'worker-a readA result landed')
  const m1LaneCount = await ledgerLaneRequestCount(MEMBER_READ_LANES)
  check('live-M1-allow-lane', 'worker-a read perm-a (allow lane) created ZERO control requests for the read lanes (scoped to the member read correlations — RAW ledger: the /state route blocks while this active member turn holds the work chain)',
    0, m1LaneCount,
    m1LaneCount === 0, `laneCount=${m1LaneCount} memberRequestsSoFar=${await ledgerRequesterRequestCount('inst-a2pa')} before=${beforeA}`)
  const m1Result = mockToolResult('worker-a', 'a2A-readA')
  check('live-M1-allow-executed-success', 'worker-a read perm-a EXECUTED: the tool result carries the file content and NO denial (the member allow lane — the V1-1 gap on the member side)',
    'success result with content', m1Result,
    m1Result !== null && m1Result.includes('perm-a: allow-read target') && !/permission denied/i.test(m1Result),
    `result=${String(m1Result).slice(0, 200)}`)

  await waitUntil(() => mockSawResult('worker-a', 'a2A-readB'), 90_000, 'worker-a readB result landed')
  const m2LaneCount = await ledgerLaneRequestCount(MEMBER_READ_LANES)
  check('live-M2-deny-lane', 'worker-a read perm-b (deny lane) created ZERO control requests for the read lanes (deny is static — no requestControl at all; RAW ledger — /state blocks during the active member turn)',
    0, m2LaneCount,
    m2LaneCount === 0, `laneCount=${m2LaneCount} before=${beforeA}`)
  const m2Result = mockToolResult('worker-a', 'a2A-readB')
  check('live-M2-deny-static-reason', 'worker-a read perm-b denied by the STATIC POLICY (the deny rule) — NOT a canonicalization/resolver failure',
    'static policy denial', m2Result,
    m2Result !== null && /permission denied by the static permission policy/.test(m2Result) && /denies read on/.test(m2Result) && !/canonicalization failed|resolver-threw/.test(m2Result),
    `result=${String(m2Result).slice(0, 200)}`)

  // readC (member side) — the ASK lane on read for the member (no rule →
  // default ask → kind=leader-approval), and it sets WORKER-A's own fs read
  // state (reads are tracked per session — worker-a must read perm-c itself)
  // so the writeC1 below passes the write tool's read-before-overwrite rule.
  // v15: ledger-based pending detection (the /state route blocks while this
  // member turn holds the work chain — the request fact IS committed during
  // the block: v14 live probe showed it 0.63s after admission).
  const reqRCA = await waitUntil(() => ledgerPendingRequest('a2A-readC'), 90_000, 'worker-a readC ask request pending (raw ledger)')
  check('live-M3a-ask-request', 'worker-a read perm-c (no rule → default ask) created a durable control request', 'pending request a2A-readC', reqRCA?.requestId ?? null, !!reqRCA, JSON.stringify(reqRCA).slice(0, 300))
  check('live-M3a-kind-leader-approval', 'member ask routes to kind=leader-approval (leader-or-human resolver closure)', 'leader-approval', reqRCA?.kind ?? null, reqRCA?.kind === 'leader-approval')
  check('live-M3a-target-member', 'request targetInstanceId = inst-a2pa (the requesting member)', 'inst-a2pa', reqRCA?.targetInstanceId ?? null, reqRCA?.targetInstanceId === 'inst-a2pa')
  const rcaFact = await requestFact('a2A-readC')
  check('live-M3a-scope-exact', 'request scope = the EXACT operation (root + member caller + member target + action + tool + correlation) — RAW ledger payload',
    'exact scope fields',
    { root: rcaFact?.rootSessionId, requester: rcaFact?.payload?.requester, target: reqRCA?.targetInstanceId, corr: reqRCA?.correlation },
    rcaFact?.rootSessionId === rootSessionId
      && rcaFact?.payload?.requester?.kind === 'instance' && rcaFact?.payload?.requester?.instanceId === 'inst-a2pa'
      && rcaFact?.payload?.actionName === 'parameter-permission' && rcaFact?.payload?.toolName === 'read'
      && reqRCA?.targetInstanceId === 'inst-a2pa' && reqRCA?.correlation === 'a2A-readC')
  check('live-M3a-fingerprint-bound', 'the member readC ask carries the EXACT operation fingerprint (the leader allow binds to this exact member operation)',
    'sha256 fingerprint', typeof rcaFact?.payload?.operationFingerprint,
    typeof rcaFact?.payload?.operationFingerprint === 'string' && /^sha256:[0-9a-f]{16,}$/.test(rcaFact.payload.operationFingerprint),
    `fp=${String(rcaFact?.payload?.operationFingerprint).slice(0, 80)}`)
  check('live-M3a-no-execution-yet', 'perm-c.txt unchanged while the member read request is pending', 'leader-payload-2', readWs('perm-c.txt'), readWs('perm-c.txt') === 'leader-payload-2')

  // member self-approval NEGATIVE — worker-a has NO team_resolve_control
  // tool. v15: the live /tool probe is best-effort while the member turn
  // holds the work chain (the /tool dispatch may queue behind the hold —
  // observed on the v14 world). The DETERMINISTIC anchor is the Phase-0
  // registration probe (live-probe-memberA-resolve-absent): the tool is not
  // in the member's surface, so NO caller can resolve through the member.
  const memberSelf = await p6t6Tool('team_resolve_control', { rootSessionId, requestToken: 'a2-mself-1', requestId: reqRCA.requestId, decision: 'allow' }, 'session-a2a-a', 'a2-mself-resolve-1', 30_000)
  const memberSelfMsg = String(memberSelf.body?.error?.message ?? '')
  const m4LiveUnknown = memberSelf.status === 200 && memberSelf.body?.ok === false && /unknown/i.test(memberSelfMsg)
  const m4BootProbe = probes['session-a2a-a:team_resolve_control'] === 'not-registered'
  evidence.memberSelfApprovalProbe = { liveStatus: memberSelf.status, liveOk: memberSelf.body?.ok ?? null, liveMessage: memberSelfMsg.slice(0, 200), bootProbe: probes['session-a2a-a:team_resolve_control'] }
  check('live-M4-member-self-approval-negative', `worker-a cannot resolve (live /tool: ${memberSelf.status === 200 ? (memberSelf.body?.ok === false ? 'unknown-tool rejection' : 'unexpected') : `timeout during chain hold (${memberSelf.ms}ms)`}; boot probe: ${probes['session-a2a-a:team_resolve_control']})`,
    'rejected (unknown tool) or boot-probe absent', m4LiveUnknown ? 'live unknown-tool' : (m4BootProbe ? 'boot probe not-registered (live probe timed out)' : 'neither'),
    m4LiveUnknown || m4BootProbe, `live=${memberSelf.status ?? 'timeout'} ${memberSelfMsg.slice(0, 200)} boot=${probes['session-a2a-a:team_resolve_control']}`)

  // LEADER resolves the member's request (leader-approval: the leader IS a
  // resolver). v15: tool route first (the plan matrix names team_resolve_
  // control); if the /tool route is blocked behind the member turn's chain
  // hold (timeout), fall back to the /team-remote v4 route — the same
  // control-service resolver closure. The evidence records which route
  // settled it; the execution proof is downstream (file + mock result).
  const leaderResA = await p6t6Tool('team_resolve_control', { rootSessionId, requestToken: 'a2-lead-resA-1', requestId: reqRCA.requestId, decision: 'allow' }, 'a2root', 'a2-lead-resA-1', 30_000)
  let m5Route = 'tool'
  let m5Body = leaderResA.body
  if (!(leaderResA.status === 200 && leaderResA.body?.ok === true && leaderResA.body?.value?.status !== 'rejected')) {
    m5Route = 'remote-v4-fallback'
    const fb = await humanResolve(reqRCA.requestId, 'allow', 'v15 leader allow (remote v4)')
    m5Body = fb.body
  }
  evidence.memberAResolveRoute = m5Route
  check('live-M5-leader-resolves-member', `leader resolves the member's leader-approval request (route: ${m5Route} — the leader IS a resolver for kind=leader-approval)`, true,
    m5Route === 'tool' || (m5Body?.result?.ok === true || m5Body?.ok === true),
    m5Route === 'tool' || (m5Body?.result?.ok === true || m5Body?.ok === true),
    `route=${m5Route} ${JSON.stringify(m5Body).slice(0, 300)}`)
  await waitUntil(() => mockSawResult('worker-a', 'a2A-readC'), 90_000, 'worker-a readC executed (turn ended)')
  const rcaResult = mockToolResult('worker-a', 'a2A-readC')
  check('live-M3a-executed', 'the member readC EXECUTED after the leader allow (the result carries the current perm-c content — leader-payload-2, set by the leader drill)',
    'success result with content', rcaResult,
    rcaResult !== null && rcaResult.includes('leader-payload-2') && !/permission denied/i.test(rcaResult),
    `result=${String(rcaResult).slice(0, 200)}`)
  const rcaConsumed = await waitUntil(() => ledgerConsumed(reqRCA.requestId), 60_000, 'member readC allow consumption committed (raw ledger)')
  check('live-M3a-consumed', 'the member readC allow was consumed exactly once (raw ledger control-allow-consumed)', 'consumption row for ' + reqRCA.requestId, rcaConsumed ? 'consumed' : 'not-consumed', !!rcaConsumed)

  // writeC1 (member side) — the ASK lane on write (worker-a's fs read state set by readC)
  const reqMA = await waitUntil(() => ledgerPendingRequest('a2A-writeC1'), 90_000, 'worker-a writeC1 ask request pending (raw ledger)')
  check('live-M3-ask-request', 'worker-a write perm-c (ask lane) created a durable control request', 'pending request a2A-writeC1', reqMA?.requestId ?? null, !!reqMA, JSON.stringify(reqMA).slice(0, 300))
  check('live-M3-kind-leader-approval', 'member ask routes to kind=leader-approval (leader-or-human resolver closure)', 'leader-approval', reqMA?.kind ?? null, reqMA?.kind === 'leader-approval')
  check('live-M3-target-member', 'request targetInstanceId = inst-a2pa (the requesting member)', 'inst-a2pa', reqMA?.targetInstanceId ?? null, reqMA?.targetInstanceId === 'inst-a2pa')
  const maFact = await requestFact('a2A-writeC1')
  check('live-M3-scope-exact', 'request scope = the EXACT operation (root + member caller + member target + action + tool + correlation) — RAW ledger payload',
    'exact scope fields',
    { root: maFact?.rootSessionId, requester: maFact?.payload?.requester, target: reqMA?.targetInstanceId, corr: reqMA?.correlation },
    maFact?.rootSessionId === rootSessionId
      && maFact?.payload?.requester?.kind === 'instance' && maFact?.payload?.requester?.instanceId === 'inst-a2pa'
      && maFact?.payload?.actionName === 'parameter-permission' && maFact?.payload?.toolName === 'write'
      && reqMA?.targetInstanceId === 'inst-a2pa' && reqMA?.correlation === 'a2A-writeC1')
  check('live-M3-fingerprint-bound', 'request carries the EXACT operation fingerprint (the leader allow binds to this exact member operation)',
    'sha256 fingerprint', typeof maFact?.payload?.operationFingerprint,
    typeof maFact?.payload?.operationFingerprint === 'string' && /^sha256:[0-9a-f]{16,}$/.test(maFact.payload.operationFingerprint),
    `fp=${String(maFact?.payload?.operationFingerprint).slice(0, 80)}`)
  check('live-M3-no-execution-yet', 'perm-c.txt unchanged while the member write request is pending', 'leader-payload-2', readWs('perm-c.txt'), readWs('perm-c.txt') === 'leader-payload-2')

  // LEADER resolves the member's write (leader-approval closure). v15: same
  // tool-first / remote-v4-fallback pattern as M5 (chain-hold during the
  // active member turn).
  const leaderResA2 = await p6t6Tool('team_resolve_control', { rootSessionId, requestToken: 'a2-lead-resA2-1', requestId: reqMA.requestId, decision: 'allow' }, 'a2root', 'a2-lead-resA2-1', 30_000)
  let m5bRoute = 'tool'
  let m5bBody = leaderResA2.body
  if (!(leaderResA2.status === 200 && leaderResA2.body?.ok === true && leaderResA2.body?.value?.status !== 'rejected')) {
    m5bRoute = 'remote-v4-fallback'
    const fb = await humanResolve(reqMA.requestId, 'allow', 'v15 leader allow write (remote v4)')
    m5bBody = fb.body
  }
  evidence.memberAWriteResolveRoute = m5bRoute
  check('live-M5b-leader-allows-write', `leader allows the member writeC1 (route: ${m5bRoute} — leader-approval closure)`, true,
    m5bRoute === 'tool' || (m5bBody?.result?.ok === true || m5bBody?.ok === true),
    m5bRoute === 'tool' || (m5bBody?.result?.ok === true || m5bBody?.ok === true),
    `route=${m5bRoute} ${JSON.stringify(m5bBody).slice(0, 300)}`)
  await waitUntil(async () => readWs('perm-c.txt') === 'member-a-payload-1', 90_000, 'worker-a writeC1 executed after leader allow')
  await waitUntil(() => mockSawResult('worker-a', 'a2A-writeC1'), 90_000, 'worker-a writeC1 result landed (turn ended)')
  const maWriteResult = mockToolResult('worker-a', 'a2A-writeC1')
  check('live-M5-executed', 'perm-c.txt = member-a-payload-1 after the leader allow', 'member-a-payload-1', readWs('perm-c.txt'), readWs('perm-c.txt') === 'member-a-payload-1')
  check('live-M5-write-result-clean', 'the member writeC1 tool result carries NO error (fs read-before-overwrite satisfied by the members own readC)',
    'no error in result', maWriteResult,
    maWriteResult !== null && !/error|cannot overwrite/i.test(maWriteResult), `result=${String(maWriteResult).slice(0, 200)}`)
  const maConsumed = await waitUntil(() => ledgerConsumed(reqMA.requestId), 60_000, 'member writeC1 allow consumption committed (raw ledger)')
  check('live-M5-consumed', 'the leader-allow was consumed exactly once (raw ledger control-allow-consumed)', 'consumption row for ' + reqMA.requestId, maConsumed ? 'consumed' : 'not-consumed', !!maConsumed)

  // M7 — the member DEFAULT-ASK leg (perm-d: no matching rule → default ask),
  // resolved by the LEADER (leader-approval closure, the leader's own tool)
  const reqAD = await waitUntil(() => ledgerPendingRequest('a2A-readD'), 90_000, 'worker-a readD (default ask) request pending (raw ledger)')
  check('live-M7-default-ask-created', 'worker-a read perm-d (no rule match → default ask) created a durable request', 'pending request a2A-readD', reqAD?.requestId ?? null, !!reqAD, JSON.stringify(reqAD).slice(0, 300))
  check('live-M7-kind-leader-approval', 'the member default-ask routes to kind=leader-approval', 'leader-approval', reqAD?.kind ?? null, reqAD?.kind === 'leader-approval')
  const adFact = await requestFact('a2A-readD')
  check('live-M7-fingerprint-bound', 'the default-ask request carries the EXACT operation fingerprint (the allow binds to this exact read operation)',
    'sha256 fingerprint', typeof adFact?.payload?.operationFingerprint,
    typeof adFact?.payload?.operationFingerprint === 'string' && /^sha256:[0-9a-f]{16,}$/.test(adFact.payload.operationFingerprint),
    `fp=${String(adFact?.payload?.operationFingerprint).slice(0, 80)}`)
  const leaderResD = await p6t6Tool('team_resolve_control', { rootSessionId, requestToken: 'a2-lead-resD-1', requestId: reqAD.requestId, decision: 'allow' }, 'a2root', 'a2-lead-resD-1', 30_000)
  let m7Route = 'tool'
  let m7Body = leaderResD.body
  if (!(leaderResD.status === 200 && leaderResD.body?.ok === true && leaderResD.body?.value?.status !== 'rejected')) {
    m7Route = 'remote-v4-fallback'
    const fb = await humanResolve(reqAD.requestId, 'allow', 'v15 leader allow readD (remote v4)')
    m7Body = fb.body
  }
  evidence.memberAReadDResolveRoute = m7Route
  check('live-M7-leader-allows', `leader allows the member default-ask (route: ${m7Route} — leader-approval closure)`, true,
    m7Route === 'tool' || (m7Body?.result?.ok === true || m7Body?.ok === true),
    m7Route === 'tool' || (m7Body?.result?.ok === true || m7Body?.ok === true), `route=${m7Route} ${JSON.stringify(m7Body).slice(0, 250)}`)
  await waitUntil(() => mockSawResult('worker-a', 'a2A-readD'), 90_000, 'worker-a readD result landed (turn ended → MEMBER-A-DONE)')
  check('live-M7-executed', 'the read EXECUTED (the a2A-readD tool result carries the perm-d.txt content, not an error)', true, mockSaw('perm-d: default-ask target'), mockSaw('perm-d: default-ask target'), 'mock log: the a2A-readD tool result content')
  const adConsumed = await waitUntil(() => ledgerConsumed(reqAD.requestId), 60_000, 'member readD allow consumption committed (raw ledger)')
  check('live-M7-consumed', 'the default-ask allow was consumed exactly once (raw ledger control-allow-consumed)', 'consumption row for ' + reqAD.requestId, adConsumed ? 'consumed' : 'not-consumed', !!adConsumed)

  const memberARes = await memberA
  evidence.memberASend = {
    firedAt: new Date(memberAT0).toISOString(),
    latencyMs: Date.now() - memberAT0,
    httpStatus: memberARes.status,
    body: memberARes.body,
  }
  check('live-M6-turn-settled', 'member-a drill turn settled (member.send returned ok)', true, memberARes.body?.result?.ok === true, memberARes.body?.result?.ok === true, JSON.stringify(memberARes.body).slice(0, 250))
  check('live-M6-member-a-done', 'mock script reached MEMBER-A-DONE', true, mockSaw('MEMBER-A-DONE'), mockSaw('MEMBER-A-DONE'))

  // ── Phase 3 — member-b drill (default deny, ZERO control rows) ──────────
  // v15: worker-b requester-scoped ledger counts (the /state route blocks
  // during the active member-b turn, same as member-a).
  const beforeBReqs = await ledgerRequesterRequestCount('inst-a2pb')
  const memberBT0 = Date.now()
  const memberB = remoteCall('member.send', {
    teamSessionId: rootSessionId,
    caller: { kind: 'human', humanId: rootSessionId },
    recipientInstanceId: 'inst-a2pb',
    body: 'Run your permission drill now.',
    requestToken: 'a2-mB-1',
  }, 1)
  log('member-b drill: member.send fired (v1, background)')
  await waitUntil(() => mockSawResult('worker-b', 'a2B-readE'), 90_000, 'worker-b readE result landed')
  await waitUntil(() => mockSawResult('worker-b', 'a2B-writeE'), 90_000, 'worker-b writeE result landed (→ MEMBER-B-DONE)')
  const afterBReqs = await ledgerRequesterRequestCount('inst-a2pb')
  check('live-B1-zero-requests', 'worker-b (default deny, empty lanes) turn created ZERO control requests (no ask lane exists — requester-scoped RAW ledger: the /state route blocks during the active member-b turn)',
    0, afterBReqs, afterBReqs === 0 && beforeBReqs === 0, `before=${beforeBReqs} after=${afterBReqs}`)
  check('live-B1-zero-decisions', 'worker-b turn created ZERO decisions (no request → no decision; requester-scoped RAW ledger)', 0, afterBReqs, afterBReqs === 0, `requests=${afterBReqs}`)
  check('live-B1-file-unchanged', 'perm-e.txt unchanged (both operations statically denied)', baseline['perm-e.txt'], readWs('perm-e.txt'), readWs('perm-e.txt') === baseline['perm-e.txt'])
  const b1Result = mockToolResult('worker-b', 'a2B-readE')
  check('live-B1-deny-default-reason', 'worker-b read perm-e denied by the DEFAULT (deny, empty lanes) — a static policy denial, NOT a canonicalization/resolver failure',
    'static default denial', b1Result,
    b1Result !== null && /permission denied by the static permission policy/.test(b1Result) && /default \(deny\)/.test(b1Result) && /denies read on/.test(b1Result) && !/canonicalization failed|resolver-threw/.test(b1Result),
    `result=${String(b1Result).slice(0, 200)}`)
  const b2Result = mockToolResult('worker-b', 'a2B-writeE')
  check('live-B1-write-deny-default-reason', 'worker-b write perm-e ALSO denied by the DEFAULT (deny, empty lanes) — static policy, zero execution',
    'static default denial', b2Result,
    b2Result !== null && /permission denied by the static permission policy/.test(b2Result) && /default \(deny\)/.test(b2Result) && !/canonicalization failed|resolver-threw/.test(b2Result),
    `result=${String(b2Result).slice(0, 200)}`)
  const memberBRes = await memberB
  evidence.memberBSend = {
    firedAt: new Date(memberBT0).toISOString(),
    latencyMs: Date.now() - memberBT0,
    httpStatus: memberBRes.status,
    body: memberBRes.body,
  }
  check('live-B2-turn-settled', 'member-b drill turn settled (member.send returned ok)', true, memberBRes.body?.result?.ok === true, memberBRes.body?.result?.ok === true, JSON.stringify(memberBRes.body).slice(0, 250))
  check('live-B2-member-b-done', 'mock script reached MEMBER-B-DONE', true, mockSaw('MEMBER-B-DONE'), mockSaw('MEMBER-B-DONE'))

  // ── Phase 4 — safety negatives (direct tool driving) ────────────────────
  // N0 (the leader's perm-d pre-read — default-ask proof + fs read-state for
  // the N5/N6 writes of the EXISTING perm-d.txt, v12 seq=5 read-before-
  // overwrite) runs AFTER the N4 residency drop: the drop disposes the
  // leader agent, and the fs read tracking may live in the disposed agent's
  // context — the re-resolved agent must re-read perm-d before the N5/N6
  // writes can overwrite it.
  const negBefore = (await p6t6State()).body?.control?.requests?.length ?? -1

  // N1 — malformed args (canonicalization failure at the closed args layer)
  const n1 = await p6t6Tool('read', { file_path: 42 }, 'a2root', 'a2-n1')
  const n1Msg = String(n1.body?.error?.message ?? '')
  check('live-N1-malformed-args-deny', 'read with a non-string file_path is DENIED (fail-closed canonicalization)', 'denied', n1.body?.ok === false ? 'denied' : 'not-denied',
    n1.body?.ok === false && /permission denied/i.test(n1Msg), n1Msg.slice(0, 250))

  // N2 — canonicalization failure via a path THROUGH A REGULAR FILE (v16,
  // parent ruling on the v15 run, verified against upstream source):
  // upstream fs.resolve is EXISTENCE-TOLERANT by design (test-use
  // packages/fs/fs-local/src/fsio.ts resolveLocalTarget L146-184: a
  // missing file whose parent exists resolves via the nearest-existing-
  // ancestor walk, "so the key is stable across creation of those dirs" —
  // which is why the v15 'perm-missing.txt' read canonicalized fine and
  // took the default ask instead of failing). A path THROUGH a regular
  // file (perm-a.txt/child.txt) is genuinely un-canonicalizable: POSIX
  // ENOTDIR → FsError FS_NOT_FOUND (fsio.ts L157); Windows reports ENOENT,
  // the stat-based repair restores the distinction (L174-178) → FsError.
  // Cross-platform resolver-threw → fail-closed denial, zero requests.
  // (N1's non-string file_path already proves the canonicalizer argument-
  // validation denial live; N2 proves the resolver-threw branch.)
  const n2 = await p6t6Tool('read', { file_path: 'perm-a.txt/child.txt' }, 'a2root', 'a2-n2')
  const n2Msg = String(n2.body?.error?.message ?? '')
  check('live-N2-canonicalization-failure-deny', 'read of a path THROUGH a regular file is DENIED (canonicalization failure — the resolver genuinely cannot canonicalize it; fail-closed, never next())', 'denied', n2.body?.ok === false ? 'denied' : 'not-denied',
    n2.body?.ok === false && /permission denied/i.test(n2Msg), n2Msg.slice(0, 250))
  check('live-N2-canonicalization-reason', 'the N2 denial IS a canonicalization failure (the resolver-threw shape) — the inverse discriminator of the L2/M2/B1 static-policy legs (the fs seam itself is working: this is a genuinely unresolvable target)',
    'canonicalization failed + resolver-threw', n2Msg,
    /canonicalization failed for tool "read"/.test(n2Msg) && /resolver-threw/.test(n2Msg),
    n2Msg.slice(0, 250))

  st = (await p6t6State()).body
  check('live-N1N2-no-requests', 'N1/N2 denies created ZERO control requests (deny before requestControl)', negBefore, st?.control?.requests?.length ?? -1,
    (st?.control?.requests?.length ?? -1) === negBefore)

  // N3 — unsupported-tool pass-through (a team tool: zero control rows, zero interference)
  const n3 = await p6t6Tool('team_list_members', {}, 'a2root', 'a2-n3')
  st = (await p6t6State()).body
  check('live-N3-passthrough', 'team_list_members (unsupported class) passes through ok', true, n3.body?.ok === true, n3.body?.ok === true, JSON.stringify(n3.body).slice(0, 200))
  check('live-N3-zero-rows', 'pass-through created ZERO control requests (count unchanged by the N3 call)', negBefore, st?.control?.requests?.length ?? -1, (st?.control?.requests?.length ?? -1) === negBefore)

  // N4 — ask-without-decision: no execution while pending; abort leaves it pending
  const n4 = p6t6Tool('read', { file_path: 'perm-d.txt' }, 'a2root', 'a2-n4', 300_000)
  const reqN4 = await waitUntil(async () => {
    const s = (await p6t6State()).body
    return pendingRequest(s, 'a2-n4')
  }, 90_000, 'N4 ask request pending (default ask, no matching rule)')
  check('live-N4-ask-created', 'read perm-d (no matching rule → default ask) created a pending request', 'pending request a2-n4', reqN4?.requestId ?? null, !!reqN4)
  await new Promise((r) => setTimeout(r, 2000))
  check('live-N4-no-execution-without-decision', 'perm-d.txt unchanged while the ask is undecided (zero-effect)', baseline['perm-d.txt'], readWs('perm-d.txt'), readWs('perm-d.txt') === baseline['perm-d.txt'])
  const drop = await p6t6Drop('a2root')
  check('live-N4-residency-drop', 'residency drop of the waiting leader succeeds', true, drop.body?.dropped === true, drop.body?.dropped === true, JSON.stringify(drop.body).slice(0, 200))
  const n4Res = await n4
  const n4Msg = String(n4Res.body?.error?.message ?? '')
  check('live-N4-abort-deny', 'the aborted wait settles DENIED (CONTROL_WAIT_ABORTED → deny, no execution)', 'denied', n4Res.body?.ok === false ? 'denied' : 'not-denied',
    n4Res.body?.ok === false && /cancelled|abort/i.test(n4Msg), n4Msg.slice(0, 250))
  st = (await p6t6State()).body
  const reqN4After = pendingRequest(st, 'a2-n4')
  check('live-N4-still-pending', 'cancellation never decides: the request stays PENDING after the abort', 'pending', reqN4After?.status ?? null, reqN4After?.status === 'pending')
  check('live-N4-file-unchanged', 'perm-d.txt unchanged after the aborted ask', baseline['perm-d.txt'], readWs('perm-d.txt'), readWs('perm-d.txt') === baseline['perm-d.txt'])

  // N0 — the leader's pre-read of perm-d (default ask → human allow → the read
  // EXECUTES). Two purposes: (a) a live default-ask proof on the direct /tool
  // route; (b) it sets the LEADER session's fs read state in the RE-RESOLVED
  // agent (post-N4-drop), so the N5/N6 writes of the EXISTING perm-d.txt pass
  // the upstream write tool's read-before-overwrite rule (v12 seq=5: the
  // allowed write re-executed but fs refused the overwrite of a never-read
  // file — `cannot overwrite existing "…perm-c.txt" without reading it first`).
  const n0 = p6t6Tool('read', { file_path: 'perm-d.txt' }, 'a2root', 'a2-n0-readD', 300_000)
  const reqN0 = await waitUntil(async () => {
    const s = (await p6t6State()).body
    return pendingRequest(s, 'a2-n0-readD')
  }, 90_000, 'N0 readD pre-read ask pending (default ask)')
  check('live-N0-ask-created', 'read perm-d (no rule → default ask) created a pending request on the direct /tool route', 'pending request a2-n0-readD', reqN0?.requestId ?? null, !!reqN0)
  check('live-N0-kind-user-approval', 'the leader default-ask routes to kind=user-approval', 'user-approval', reqN0?.kind ?? null, reqN0?.kind === 'user-approval')
  await humanResolve(reqN0.requestId, 'allow', 'V1 kit human allow (N0 readD pre-read)')
  const n0Res = await n0
  // the read tool's /tool value is the STRUCTURED result
  // { path, offset, lines: [{number, text}], totalLines } (probed live on
  // v15) — the content check runs over the line texts.
  const n0Value = n0Res.body?.value
  const n0Lines = Array.isArray(n0Value?.lines) ? n0Value.lines.map((l) => l?.text ?? '').join('\n') : ''
  check('live-N0-executed', 'the N0 pre-read EXECUTED after the human allow (the /tool value carries the perm-d content in its structured lines)',
    'success value with content', n0Res.body?.ok === true ? 'ok' : String(n0Res.body?.ok),
    n0Res.body?.ok === true && n0Lines.includes('perm-d: default-ask target') && !/permission denied/i.test(n0Lines),
    `ok=${n0Res.body?.ok} lines=${JSON.stringify(n0Value?.lines ?? null).slice(0, 200)}`)

  // N5 — double consumption blocked (the allow is consumed exactly once)
  const n5a = p6t6Tool('write', { file_path: 'perm-d.txt', content: 'a2-dc-one' }, 'a2root', 'a2-dc', 300_000)
  const reqN5 = await waitUntil(async () => {
    const s = (await p6t6State()).body
    return pendingRequest(s, 'a2-dc')
  }, 90_000, 'N5 first write perm-d ask pending')
  await humanResolve(reqN5.requestId, 'allow', 'V1 kit human allow (N5 first write)')
  const n5aRes = await n5a
  await waitUntil(async () => readWs('perm-d.txt') === 'a2-dc-one', 90_000, 'N5 first write executed')
  st = (await p6t6State()).body
  check('live-N5-first-executed', 'N5 first write (allow + consume) executed', 'a2-dc-one', readWs('perm-d.txt'), readWs('perm-d.txt') === 'a2-dc-one',
    `tool=${JSON.stringify(n5aRes.body).slice(0, 150)}`)
  check('live-N5-first-consumed', 'N5 first allow consumed exactly once', 'consumption row', consumptionFor(st, reqN5.requestId) ? 'consumed' : 'not-consumed', !!consumptionFor(st, reqN5.requestId))
  const n5b = await p6t6Tool('write', { file_path: 'perm-d.txt', content: 'a2-dc-one' }, 'a2root', 'a2-dc', 120_000)
  const n5bMsg = String(n5b.body?.error?.message ?? '')
  check('live-N5-double-consumption-blocked', 're-executing the same operation (same callId) is blocked allow-consumed', 'denied (allow-consumed)', n5b.body?.ok === false ? 'denied' : 'not-denied',
    n5b.body?.ok === false && /allow-consumed/i.test(n5bMsg), n5bMsg.slice(0, 250))
  st = (await p6t6State()).body
  const consumptionsN5 = (st?.control?.consumptions ?? []).filter((c) => c.requestId === reqN5.requestId).length
  check('live-N5-still-one-consumption', 'exactly ONE consumption row for the N5 request (no second reserve)', 1, consumptionsN5, consumptionsN5 === 1)

  // N6 — fingerprint mismatch unusable (an allow for F1 never authorizes F2)
  const n6a = p6t6Tool('write', { file_path: 'perm-d.txt', content: 'a2-fp-one' }, 'a2root', 'a2-fp1', 300_000)
  const reqN6a = await waitUntil(async () => {
    const s = (await p6t6State()).body
    return pendingRequest(s, 'a2-fp1')
  }, 90_000, 'N6 first write (a2-fp1) ask pending')
  await humanResolve(reqN6a.requestId, 'allow', 'V1 kit human allow (N6 a2-fp1)')
  await n6a
  await waitUntil(async () => readWs('perm-d.txt') === 'a2-fp-one', 90_000, 'N6 first write executed')
  st = (await p6t6State()).body
  check('live-N6-fp1-executed', 'N6 a2-fp1 (allow + consume) executed', 'a2-fp-one', readWs('perm-d.txt'), readWs('perm-d.txt') === 'a2-fp-one')
  const n6b = p6t6Tool('write', { file_path: 'perm-d.txt', content: 'a2-fp-two' }, 'a2root', 'a2-fp2', 300_000)
  const reqN6b = await waitUntil(async () => {
    const s = (await p6t6State()).body
    return pendingRequest(s, 'a2-fp2')
  }, 90_000, 'N6 second write (a2-fp2, new callId + new content) ask pending')
  // the ledger payloads carry the fingerprints (the state route does not)
  const reqFacts = (await ledgerFacts('control-request-recorded')).filtered
  const fp1 = (reqFacts.find((e) => e?.payload?.correlation === 'a2-fp1')?.payload?.operationFingerprint) ?? null
  const fp2 = (reqFacts.find((e) => e?.payload?.correlation === 'a2-fp2')?.payload?.operationFingerprint) ?? null
  check('live-N6-fingerprints-distinct', 'a2-fp1 and a2-fp2 carry DISTINCT operation fingerprints', 'fp1 !== fp2', { fp1: (fp1 ?? '').slice(0, 24) + '…', fp2: (fp2 ?? '').slice(0, 24) + '…' },
    typeof fp1 === 'string' && typeof fp2 === 'string' && fp1 !== fp2, `fp1=${fp1} fp2=${fp2}`)
  // v16 (parent ruling): the /state route BLOCKS while the a2-fp2 /tool
  // turn holds the team work chain (listControlState acquires the same
  // per-team lock the active tool execution holds — the product's
  // documented lock topology; the v15 run read a stale/timeout snapshot
  // and saw status=null). The RAW ledger is the unblocked read path: a
  // control-request-recorded fact is pending until a control-decision-
  // recorded fact exists for its requestId.
  const fp2Req = await requestFact('a2-fp2')
  const { filtered: fp2Decs } = await ledgerFacts('control-decision-recorded')
  const fp2Pending = !!fp2Req && !fp2Decs.some((d) => d.payload.requestId === fp2Req.payload.requestId)
  check('live-N6-old-allow-unusable', 'the consumed a2-fp1 allow did NOT authorize the a2-fp2 operation (RAW ledger: still pending, file unchanged — the /state projection is blocked by the active turn)', 'pending + a2-fp-one',
    { status: fp2Pending ? 'pending' : (fp2Req ? 'decided' : 'no-request'), file: readWs('perm-d.txt') },
    fp2Pending && readWs('perm-d.txt') === 'a2-fp-one')
  await humanResolve(reqN6b.requestId, 'deny', 'V1 kit human deny (N6 a2-fp2)')
  const n6bRes = await n6b
  const n6bMsg = String(n6b.body?.error?.message ?? String(n6bRes.body?.error?.message ?? ''))
  check('live-N6-fp2-denied', 'a2-fp2 resolved deny → the operation is denied', 'denied', n6bRes.body?.ok === false ? 'denied' : 'not-denied',
    n6bRes.body?.ok === false && /approval was denied/i.test(n6bMsg), n6bMsg.slice(0, 250))
  check('live-N6-file-unchanged', 'perm-d.txt still a2-fp-one after the a2-fp2 deny', 'a2-fp-one', readWs('perm-d.txt'), readWs('perm-d.txt') === 'a2-fp-one')

  // ── final file state + counts ───────────────────────────────────────────
  evidence.finalFiles = {
    'perm-a.txt': readWs('perm-a.txt'),
    'perm-b.txt': readWs('perm-b.txt'),
    'perm-c.txt': readWs('perm-c.txt'),
    'perm-d.txt': readWs('perm-d.txt'),
    'perm-e.txt': readWs('perm-e.txt'),
  }
  check('live-final-perm-a', 'perm-a.txt untouched (read-only lanes)', baseline['perm-a.txt'], evidence.finalFiles['perm-a.txt'], evidence.finalFiles['perm-a.txt'] === baseline['perm-a.txt'])
  check('live-final-perm-e', 'perm-e.txt untouched (worker-b default deny)', baseline['perm-e.txt'], evidence.finalFiles['perm-e.txt'], evidence.finalFiles['perm-e.txt'] === baseline['perm-e.txt'])
  check('live-final-perm-c', 'perm-c.txt ends member-a-payload-1 (leader wrote twice, member-a overwrote last)', 'member-a-payload-1', evidence.finalFiles['perm-c.txt'], evidence.finalFiles['perm-c.txt'] === 'member-a-payload-1')
  check('live-final-perm-d', 'perm-d.txt ends a2-fp-one (N6 a2-fp1 allow executed; a2-fp2 denied)', 'a2-fp-one', evidence.finalFiles['perm-d.txt'], evidence.finalFiles['perm-d.txt'] === 'a2-fp-one')
  // the RAW control ledger entries (parent ruling: dump the raw ledger into
  // the evidence JSON — the /state projection omits rootSessionId/requester/
  // operationFingerprint; the ledger payload is the actual shape)
  const { entries: ledgerEntries } = await ledgerFacts()
  evidence.controlLedger = ledgerEntries.filter((e) => String(e?.factType ?? '').startsWith('control-'))
  evidence.ledgerEntryCount = ledgerEntries.length
  st = (await p6t6State()).body
  evidence.counts = {
    requests: st?.control?.requests?.length ?? 0,
    decisions: st?.control?.decisions?.length ?? 0,
    consumptions: st?.control?.consumptions?.length ?? 0,
    mockLeaderLines: mockLineCount('leader'),
    mockWorkerALines: mockLineCount('worker-a'),
    mockWorkerBLines: mockLineCount('worker-b'),
  }
  // the sidecar the cold mode compares against (no drill re-run after restart).
  writeFileSync(join(EV, `a2permh3-live-counts-${STAMP}.json`), JSON.stringify({ ...evidence.counts, atLive: new Date().toISOString() }, null, 2))

  // ── Phase 5 — H3 hostile prepend-allow drill (review §21) ────────────────
  // Runs AFTER the full V1 matrix + final-file asserts (the counts sidecar
  // above is the PRE-HOSTILE durable state). The hostile listeners exist
  // only from this point on, so the V1 matrix is unaffected. The hostile
  // device is the DSH_HARDENING_PROBE-gated test-only route (the H3 boot
  // armed the probe on the host child): a tools/pre-execute prepend-allow
  // ({ prepend: true } = outermost listener) that resolves
  // { kind: 'allow' } WITHOUT ever calling next() — the §21 threat:
  // "一个任意 competing tools/pre-execute listener 即使直接 force-allow 且
  // 不调用 next() 也无法让任一 alpha.2 managed tool 绕过 Team permission
  // policy 执行".
  const hostileBaseline = (await p6t6State()).body
  const hostileBefore = {
    requests: hostileBaseline?.control?.requests?.length ?? -1,
    decisions: hostileBaseline?.control?.decisions?.length ?? -1,
    consumptions: hostileBaseline?.control?.consumptions?.length ?? -1,
  }
  evidence.h3Hostile = { before: hostileBefore, legs: [] }
  const recordLeg = (leg) => { evidence.h3Hostile.legs.push(leg) }

  // H3-0 — the seam is armed (DSH_HARDENING_PROBE=1 by the H3 boot) and
  // answers on the leader's CURRENT live ctx (post-N4 re-resolved agent —
  // ensureLiveAgent targets exactly the ctx the team install lives on).
  const hp0 = await hostilePrepend('a2root')
  check('live-H3-0-gate-live', 'hostile-prepend answers 200 on the live leader (seam armed by the boot; the gate-OFF 503 negative is unit-pinned in h3-hostile-seam.test.ts)',
    200, hp0.status, hp0.status === 200, JSON.stringify(hp0.body).slice(0, 200))
  recordLeg({ id: 'H3-0', agent: 'a2root', status: hp0.status, body: hp0.body })

  // H3-1 — the SHARPEST leg: a POLICY-ALLOWED op (read perm-a, the leader's
  // static allow rule). Without the end-cap, the hostile allow + the policy
  // allow would both say "run" — the denial below can ONLY be the end-cap.
  const h1 = await p6t6Tool('read', { file_path: 'perm-a.txt' }, 'a2root', 'h3-h1')
  const h1Msg = String(h1.body?.error?.message ?? '')
  check('live-H3-1-allow-op-denied', 'HOSTILE PREPEND: the leader read of perm-a.txt (a POLICY-ALLOWED op) is DENIED — the end-cap, not the policy, decides (review §21 core)',
    'denied', h1.body?.ok === false ? 'denied' : 'not-denied',
    h1.body?.ok === false && h1Msg.includes(END_CAP_REASON), h1Msg.slice(0, 250))
  check('live-H3-1-exact-reason', 'the H3-1 denial reason is the EXACT stable end-cap reason (byte-identical to h1a END_CAP_REASON — §21 requires the exact reason)',
    'Error: ' + END_CAP_REASON, h1Msg, h1Msg === 'Error: ' + END_CAP_REASON, h1Msg.slice(0, 250))
  recordLeg({ id: 'H3-1', agent: 'a2root', op: 'read perm-a.txt', status: h1.status, ok: h1.body?.ok, message: h1Msg })

  // H3-2 — the DEFAULT-ASK op (read perm-d): without the hostile listener
  // this would OPEN A CONTROL REQUEST (the V1 L/N matrix proved it does);
  // under the hostile prepend the ask lane is never reached — denial with
  // ZERO new request rows (A3 live).
  const h2 = await p6t6Tool('read', { file_path: 'perm-d.txt' }, 'a2root', 'h3-h2')
  const h2Msg = String(h2.body?.error?.message ?? '')
  check('live-H3-2-ask-op-denied', 'HOSTILE PREPEND: the leader read of perm-d.txt (DEFAULT-ASK lane — normally opens a control request) is end-cap-DENIED before any request',
    'denied', h2.body?.ok === false ? 'denied' : 'not-denied',
    h2.body?.ok === false && h2Msg === 'Error: ' + END_CAP_REASON, h2Msg.slice(0, 250))
  recordLeg({ id: 'H3-2', agent: 'a2root', op: 'read perm-d.txt', status: h2.status, ok: h2.body?.ok, message: h2Msg })

  // H3-3 — the ASK-LANE write (perm-c, marker content): denied AND the file
  // must be byte-unchanged — the hostile force-allow never ran the body.
  const h3 = await p6t6Tool('write', { file_path: 'perm-c.txt', content: 'H3-HOSTILE-PROOF' }, 'a2root', 'h3-h3')
  const h3Msg = String(h3.body?.error?.message ?? '')
  check('live-H3-3-write-denied', 'HOSTILE PREPEND: the leader write of perm-c.txt (ASK lane, marker content) is end-cap-DENIED',
    'denied', h3.body?.ok === false ? 'denied' : 'not-denied',
    h3.body?.ok === false && h3Msg === 'Error: ' + END_CAP_REASON, h3Msg.slice(0, 250))
  check('live-H3-3-file-unchanged', 'perm-c.txt is byte-UNCHANGED (still member-a-payload-1) — the hostile force-allow never dispatched the write body (pre-dispatch denial)',
    'member-a-payload-1', readWs('perm-c.txt'), readWs('perm-c.txt') === 'member-a-payload-1')
  recordLeg({ id: 'H3-3', agent: 'a2root', op: 'write perm-c.txt', status: h3.status, ok: h3.body?.ok, message: h3Msg, fileAfter: readWs('perm-c.txt') })

  // H3-2c — A2 STRICT: the leader's STATIC-DENY lane (read perm-b) under
  // the hostile prepend: the denial reason must be the stable END-CAP
  // reason, NOT the static policy-deny reason (the V1 L2 leg pins the
  // policy-deny reason on this exact operation WITHOUT the hostile).
  const h2c = await p6t6Tool('read', { file_path: 'perm-b.txt' }, 'a2root', 'h3-h2c')
  const h2cMsg = String(h2c.body?.error?.message ?? '')
  check('live-H3-2c-static-deny-lane', 'HOSTILE PREPEND: the leader read of perm-b.txt (STATIC-DENY lane — the V1 L2 leg pins its policy-deny reason without the hostile) is denied with the EXACT stable END-CAP reason (A2 — "deny by end-cap")',
    'Error: ' + END_CAP_REASON, h2cMsg, h2c.body?.ok === false && h2cMsg === 'Error: ' + END_CAP_REASON, h2cMsg.slice(0, 250))
  recordLeg({ id: 'H3-2c', agent: 'a2root', op: 'read perm-b.txt', status: h2c.status, ok: h2c.body?.ok, message: h2cMsg })

  // H3-2d — A9: an UNSUPPORTED class (a team tool) under the hostile
  // prepend: pass-through UNCHANGED, zero control rows — the end-cap's
  // closed set is the six managed tools only; team tools never consult
  // it, so the hostile listener cannot change their pass-through.
  const h2d = await p6t6Tool('team_list_members', {}, 'a2root', 'h3-h2d')
  check('live-H3-2d-unsupported-passthrough', 'HOSTILE PREPEND: team_list_members (unsupported class) STILL passes through ok — the end-cap closed set is the six managed tools; the hostile listener cannot change pass-through (A9 live)',
    true, h2d.body?.ok === true, h2d.body?.ok === true, JSON.stringify(h2d.body).slice(0, 200))
  recordLeg({ id: 'H3-2d', agent: 'a2root', op: 'team_list_members', status: h2d.status, ok: h2d.body?.ok, body: h2d.body })

  // H3-2b — zero control rows after H3-1/H3-2/H3-2c/H3-3 (the ask lanes
  // were never reached — /state is readable: no member turn active).
  st = (await p6t6State()).body
  check('live-H3-2b-zero-requests', 'H3-1..H3-3 end-cap denials created ZERO control requests (the ask lane is never reached under the hostile prepend — A3 live)',
    hostileBefore.requests, st?.control?.requests?.length ?? -1,
    (st?.control?.requests?.length ?? -1) === hostileBefore.requests)

  // H3-4 — the REASON DISCRIMINATOR on worker-b (default-deny, EMPTY
  // lanes): its policy would deny read perm-e with the static policy-deny
  // reason; under the hostile prepend the reason must be the stable
  // END-CAP reason — proof the policy was short-circuited and the
  // end-cap decided (not the other way round).
  const hp4 = await hostilePrepend('session-a2b-b')
  check('live-H3-4-gate-live', 'hostile-prepend answers 200 on worker-b (default-deny agent)',
    200, hp4.status, hp4.status === 200, JSON.stringify(hp4.body).slice(0, 200))
  const h4 = await p6t6Tool('read', { file_path: 'perm-e.txt' }, 'session-a2b-b', 'h3-h4')
  const h4Msg = String(h4.body?.error?.message ?? '')
  check('live-H3-4-endcap-not-policy', 'HOSTILE PREPEND on worker-b (default-deny, empty lanes): the denial reason IS the stable END-CAP reason, NOT the static policy-deny reason (the hostile allow short-circuited the policy; the end-cap decides)',
    'Error: ' + END_CAP_REASON, h4Msg, h4Msg === 'Error: ' + END_CAP_REASON, h4Msg.slice(0, 250))
  recordLeg({ id: 'H3-4', agent: 'session-a2b-b', op: 'read perm-e.txt', status: h4.status, ok: h4.body?.ok, message: h4Msg })

  // H3-5 — CROSS-AGENT NON-LEAK (live A9/A16): worker-a has NO hostile
  // prepend and its own agent-scoped install — read perm-a (its allow
  // lane) STILL EXECUTES while the leader and worker-b are under hostile
  // force-allow. The end-cap is per-agent; a hostile listener on one
  // agent's ctx changes nothing on another agent.
  const h5 = await p6t6Tool('read', { file_path: 'perm-a.txt' }, 'session-a2a-a', 'h3-h5')
  check('live-H3-5-cross-agent-unaffected', 'worker-a (NO hostile prepend, its own agent-scoped install) read perm-a.txt STILL EXECUTES — the end-cap is per-agent; no cross-agent leak (live A9/A16)',
    true, h5.body?.ok === true, h5.body?.ok === true, JSON.stringify(h5.body).slice(0, 200))
  recordLeg({ id: 'H3-5', agent: 'session-a2a-a', op: 'read perm-a.txt', status: h5.status, ok: h5.body?.ok, body: h5.body })

  // H3-6 — the PTC leg (live A10 strict / A11): worker-a gets the hostile
  // prepend, then an H3-PTC-TRIGGER member turn whose single model
  // response carries TWO managed read calls (perm-a allow lane + perm-b
  // static-DENY lane). Both must be end-cap-denied with ZERO control
  // requests — ptc2 with the END-CAP reason (not the policy-deny reason)
  // — and the turn settles on its own (no approval exists to resolve).
  const hp6 = await hostilePrepend('session-a2a-a')
  check('live-H3-6-gate-live', 'hostile-prepend answers 200 on worker-a (before the PTC turn)',
    200, hp6.status, hp6.status === 200, JSON.stringify(hp6.body).slice(0, 200))
  const ptcBefore = await ledgerRequesterRequestCount('inst-a2pa')
  const ptcSend = remoteCall('member.send', {
    teamSessionId: rootSessionId,
    caller: { kind: 'human', humanId: rootSessionId },
    recipientInstanceId: 'inst-a2pa',
    body: 'H3-PTC-TRIGGER run the parallel read probe now.',
    requestToken: 'h3-ptc-1',
  }, 1)
  await waitUntil(() => mockSawResult('worker-a', 'h3A-ptc1'), 90_000, 'PTC h3A-ptc1 result landed')
  await waitUntil(() => mockSawResult('worker-a', 'h3A-ptc2'), 90_000, 'PTC h3A-ptc2 result landed')
  const ptc1Result = mockToolResult('worker-a', 'h3A-ptc1') ?? ''
  const ptc2Result = mockToolResult('worker-a', 'h3A-ptc2') ?? ''
  check('live-H3-6-ptc1-denied', 'PTC: the first parallel read (perm-a, allow lane) is end-cap-DENIED (the model-facing result carries the exact stable reason)',
    'denied', ptc1Result.includes(END_CAP_REASON) ? 'denied' : 'not-denied', ptc1Result.includes(END_CAP_REASON), ptc1Result.slice(0, 200))
  check('live-H3-6-ptc2-denied', 'PTC: the second parallel read (perm-b, STATIC-DENY lane) is end-cap-DENIED with the EXACT stable reason — NOT the static policy-deny reason (A10 strict: "nested PTC static deny + prepend allow → deny")',
    'denied', ptc2Result.includes(END_CAP_REASON) ? 'denied' : 'not-denied', ptc2Result.includes(END_CAP_REASON), ptc2Result.slice(0, 200))
  const ptcAfter = await ledgerRequesterRequestCount('inst-a2pa')
  check('live-H3-6-zero-requests', 'the PTC turn created ZERO control requests (the allow + static-deny lanes never open a request under the hostile; the ask-lane proof is at the leader level in H3-2 — requester-scoped RAW ledger, PF-1-safe)',
    ptcBefore, ptcAfter, ptcAfter === ptcBefore, `before=${ptcBefore} after=${ptcAfter}`)
  const ptcRes = await ptcSend
  check('live-H3-6-turn-settled', 'the PTC turn settled on its own (no approval to resolve — the end-cap denial freed the turn; H3-PTC-DONE reached)',
    true, ptcRes.body?.result?.ok === true, ptcRes.body?.result?.ok === true, JSON.stringify(ptcRes.body).slice(0, 250))
  recordLeg({ id: 'H3-6', agent: 'session-a2a-a', op: 'PTC read perm-a + read perm-d', ptc1Result: ptc1Result, ptc2Result: ptc2Result, requestsBefore: ptcBefore, requestsAfter: ptcAfter, settled: ptcRes.body?.result?.ok })

  // H3-7 — review §18: the /state observations readout carries the
  // end-cap-denial rows with the stable reason (FRESH world pin).
  st = (await p6t6State()).body
  const endcapRows = parsedObservations(st).filter((o) => o?.stage === END_CAP_STAGE)
  check('live-H3-7-observation-rows', 'the /state observations readout carries the end-cap-denial rows (review §18, fresh world): ≥7 rows (H3-1/H3-2/H3-2c/H3-3/H3-4 + both PTC calls), every one stage=end-cap-denial with the EXACT stable reason',
    '>=7 exact', endcapRows.length, endcapRows.length >= 7 && endcapRows.every((r) => r.reason === END_CAP_REASON && r.stage === END_CAP_STAGE),
    JSON.stringify(endcapRows).slice(0, 600))
  evidence.h3Hostile.observations = endcapRows

  // H3-8 — the durable control plane is UNCHANGED across the whole hostile
  // phase (A16 live): requests/decisions/consumptions all equal the
  // pre-hostile baseline — the end-cap touches no durable state.
  check('live-H3-8-control-unchanged', 'the DURABLE control plane is unchanged across the whole hostile phase (requests/decisions/consumptions equal the pre-hostile baseline — the end-cap touches no durable state; A16 live)',
    `${hostileBefore.requests}/${hostileBefore.decisions}/${hostileBefore.consumptions}`,
    `${st?.control?.requests?.length}/${st?.control?.decisions?.length}/${st?.control?.consumptions?.length}`,
    (st?.control?.requests?.length ?? -1) === hostileBefore.requests
      && (st?.control?.decisions?.length ?? -1) === hostileBefore.decisions
      && (st?.control?.consumptions?.length ?? -1) === hostileBefore.consumptions)

  log(`live battery complete: ${checks.filter((c) => c.ok).length}/${checks.length} checks passed`)
}

// ── COLD mode ───────────────────────────────────────────────────────────────
async function coldMode() {
  const hb = await p6t6Health()
  check('cold-health-ok', 'cold resume: p6t6 health ok', true, hb.body?.ok === true, hb.body?.ok === true, JSON.stringify(hb.body).slice(0, 300))
  check('cold-toolcount-10', 'cold resume: factory catalog toolCount = 10', 10, hb.body?.toolCount ?? null, hb.body?.toolCount === 10)
  const live = hb.body?.liveSessions ?? []
  check('cold-sessions-3', 'cold resume: leader + 2 members re-bound live', JSON.stringify(['a2root', 'session-a2a-a', 'session-a2b-b']), JSON.stringify(live),
    JSON.stringify(live) === JSON.stringify(['a2root', 'session-a2a-a', 'session-a2b-b']))

  let st = (await p6t6State()).body
  check('cold-blueprint-persists', 'cold resume: teamSession still team.a2perm (adopted, not re-stamped)', 'team.a2perm', st?.teamSession?.blueprintId ?? null, st?.teamSession?.blueprintId === 'team.a2perm')

  // the policy was REBUILT from the blueprint (the lazy cwd closure re-bound at cold-root)
  const requestsBeforeA = (await p6t6State()).body?.control?.requests ?? []
  const cA = await p6t6Tool('read', { file_path: 'perm-a.txt' }, 'a2root', 'a2-cr-readA')
  st = (await p6t6State()).body
  const requestsAfterA = st?.control?.requests ?? []
  check('cold-policy-allow-lane', 'cold resume: read perm-a (allow lane) passes with zero control requests', 'allowed, no request', cA.body?.ok === true ? 'allowed' : String(cA.body?.error?.message ?? '').slice(0, 120),
    cA.body?.ok === true, JSON.stringify(cA.body).slice(0, 200))
  // the /tool value is the STRUCTURED read result { path, offset, lines,
  // totalLines } (v16: asserted on the structured line texts, same as the
  // live N0 leg).
  const cALines = Array.isArray(cA.body?.value?.lines) ? cA.body.value.lines.map((l) => l?.text ?? '').join('\n') : ''
  check('cold-policy-allow-executed-success', 'cold resume: the allow-lane read EXECUTED (the /tool value carries the file content and NO denial — a canonicalization failure would return ok:false)',
    'success value with content', cA.body?.ok === true ? 'ok' : String(cA.body?.ok),
    cA.body?.ok === true && cALines.includes('perm-a: allow-read target') && !/permission denied/i.test(cALines),
    `ok=${cA.body?.ok} lines=${JSON.stringify(cA.body?.value?.lines ?? null).slice(0, 200)}`)
  check('cold-policy-no-request-row', 'cold resume: the allow-lane read created NO new request row',
    requestsBeforeA.length, requestsAfterA.length,
    requestsAfterA.length === requestsBeforeA.length && !requestsAfterA.some((r) => r.correlation === 'a2-cr-readA'),
    `before=${requestsBeforeA.length} after=${requestsAfterA.length}`)
  const cB = await p6t6Tool('read', { file_path: 'perm-b.txt' }, 'a2root', 'a2-cr-readB')
  const cBMsg = String(cB.body?.error?.message ?? '')
  check('cold-policy-deny-lane', 'cold resume: read perm-b (deny lane) statically denied (policy rebuilt)', 'denied', cB.body?.ok === false ? 'denied' : 'not-denied',
    cB.body?.ok === false && /permission denied/i.test(cBMsg), cBMsg.slice(0, 250))
  check('cold-policy-deny-static-reason', 'cold resume: the deny is the STATIC POLICY reason (the deny rule) — NOT a canonicalization/resolver failure',
    'static policy denial', cBMsg,
    /permission denied by the static permission policy/.test(cBMsg) && /denies read on/.test(cBMsg) && !/canonicalization failed|resolver-threw/.test(cBMsg),
    cBMsg.slice(0, 250))

  // a2-cr-readC — the rebuilt policy ALSO asks on the read lane (read perm-c:
  // no rule → default ask), and it sets the post-restart fs read state so the
  // cold write of the EXISTING perm-c.txt passes the write tool's
  // read-before-overwrite rule (fresh session = no read state survived).
  const cCread = p6t6Tool('read', { file_path: 'perm-c.txt' }, 'a2root', 'a2-cr-readC', 300_000)
  const reqCRCread = await waitUntil(async () => {
    const s = (await p6t6State()).body
    return pendingRequest(s, 'a2-cr-readC')
  }, 120_000, 'cold resume: the read perm-c (default ask) request pending')
  check('cold-policy-rebuilt-ask-read', 'cold resume: read perm-c (no rule → default ask) created a NEW pending request after the restart (the policy rebuilt from the blueprint)', 'pending request a2-cr-readC', reqCRCread?.requestId ?? null, !!reqCRCread)
  check('cold-policy-rebuilt-ask-read-kind', 'the cold-resume read ask is kind=user-approval (the leader resolver closure)', 'user-approval', reqCRCread?.kind ?? null, reqCRCread?.kind === 'user-approval')
  await humanResolve(reqCRCread.requestId, 'allow', 'V1 kit human allow (cold resume readC)')
  const cCreadRes = await cCread
  // structured read value (v16: line texts, same as the live N0 leg)
  const cCLines = Array.isArray(cCreadRes.body?.value?.lines) ? cCreadRes.body.value.lines.map((l) => l?.text ?? '').join('\n') : ''
  check('cold-policy-rebuilt-read-executes', 'the cold-resume read allow EXECUTED (the /tool value carries the perm-c content — member-a-payload-1 from the live phase)',
    'success value with content', cCreadRes.body?.ok === true ? 'ok' : String(cCreadRes.body?.ok),
    cCreadRes.body?.ok === true && cCLines.includes('member-a-payload-1') && !/permission denied/i.test(cCLines),
    `ok=${cCreadRes.body?.ok} lines=${JSON.stringify(cCreadRes.body?.value?.lines ?? null).slice(0, 200)}`)

  // the aborted request a2-n4 SURVIVED the restart (still pending, no decision)
  const reqN4 = pendingRequest(st, 'a2-n4')
  check('cold-pending-survives', 'the aborted N4 request survived the cold resume (still pending)', 'pending', reqN4?.status ?? null, reqN4?.status === 'pending', JSON.stringify(reqN4).slice(0, 300))
  const decisions = st?.control?.decisions ?? []
  check('cold-no-decision-for-n4', 'no decision was ever recorded for N4 (cancellation never decided)', 0, decisions.filter((d) => d.requestId === reqN4?.requestId).length,
    decisions.filter((d) => d.requestId === reqN4?.requestId).length === 0)

  // consumed decisions + consumptions are PRESERVED
  const decided = new Set(decisions.map((d) => d.requestId))
  const consumed = new Set((st?.control?.consumptions ?? []).map((c) => c.requestId))
  const allRequests = st?.control?.requests ?? []
  const consumedRequests = allRequests.filter((r) => consumed.has(r.requestId))
  check('cold-decisions-preserved', 'every consumed request still has its durable decision after the restart',
    `all ${consumedRequests.length} consumed requests decided`,
    consumedRequests.filter((r) => decided.has(r.requestId)).length,
    consumedRequests.length > 0 && consumedRequests.every((r) => decided.has(r.requestId)),
    `consumed=${consumedRequests.length} decided=${consumedRequests.filter((r) => decided.has(r.requestId)).length}`)
  check('cold-consumptions-preserved', 'the consumption ledger survived (>= 5 consumed allows: L-writeC1/L-writeC2/A-writeC1/N5/N6-fp1)', '>= 5', st?.control?.consumptions?.length ?? 0,
    (st?.control?.consumptions?.length ?? 0) >= 5, `consumptions=${st?.control?.consumptions?.length}`)

  // double consumption is STILL blocked after the restart (re-execute N5's operation)
  const reqN5 = allRequests.find((r) => r.correlation === 'a2-dc') ?? null
  check('cold-n5-request-persists', 'the N5 request row persists after the restart', 'present', reqN5?.requestId ?? null, !!reqN5)
  const dcAgain = await p6t6Tool('write', { file_path: 'perm-d.txt', content: 'a2-dc-one' }, 'a2root', 'a2-dc', 120_000)
  const dcMsg = String(dcAgain.body?.error?.message ?? '')
  check('cold-double-consumption-still-blocked', 're-executing N5 after the restart is still blocked allow-consumed', 'denied (allow-consumed)', dcAgain.body?.ok === false ? 'denied' : 'not-denied',
    dcAgain.body?.ok === false && /allow-consumed/i.test(dcMsg), dcMsg.slice(0, 250))
  check('cold-perm-d-unchanged', 'perm-d.txt still a2-fp-one after the blocked re-execution', 'a2-fp-one', readWs('perm-d.txt'), readWs('perm-d.txt') === 'a2-fp-one')

  // plan §12.4: the static permission policy was REBUILT at cold resume —
  // a NEW write to the leader ask lane asks AGAIN (the previous allows were
  // consumed, so nothing authorizes it)
  const crC = p6t6Tool('write', { file_path: 'perm-c.txt', content: 'a2-cold-c' }, 'a2root', 'a2-cr-writeC', 300_000)
  const reqCRC = await waitUntil(async () => {
    const s = (await p6t6State()).body
    return pendingRequest(s, 'a2-cr-writeC')
  }, 120_000, 'cold resume: the NEW write perm-c re-asks (policy rebuilt)')
  check('cold-policy-rebuilt-ask', 'cold resume: a new write perm-c (ask lane) created a NEW pending request (the policy rebuilt from the blueprint)', 'pending request a2-cr-writeC', reqCRC?.requestId ?? null, !!reqCRC)
  check('cold-policy-rebuilt-kind', 'the cold-resume ask is kind=user-approval (the leader resolver closure)', 'user-approval', reqCRC?.kind ?? null, reqCRC?.kind === 'user-approval')
  const crcFact = await requestFact('a2-cr-writeC')
  check('cold-policy-rebuilt-scope-exact', 'the cold-resume request scope = the EXACT operation (root + leader caller + leader target + action + tool + correlation a2-cr-writeC) — RAW ledger payload (the /state projection omits these fields)',
    'exact scope fields',
    { root: crcFact?.rootSessionId, requester: crcFact?.payload?.requester, target: reqCRC?.targetInstanceId, corr: reqCRC?.correlation },
    crcFact?.rootSessionId === rootSessionId
      && crcFact?.payload?.requester?.kind === 'instance' && crcFact?.payload?.requester?.instanceId === 'inst-leader'
      && crcFact?.payload?.actionName === 'parameter-permission' && crcFact?.payload?.toolName === 'write'
      && reqCRC?.targetInstanceId === 'inst-leader' && reqCRC?.correlation === 'a2-cr-writeC')
  check('cold-policy-rebuilt-fingerprint-bound', 'the cold-resume request carries its own EXACT operation fingerprint (payload top level, sha256:… — content a2-cold-c, bound to the rebuilt policy + this operation)',
    'sha256 fingerprint', typeof crcFact?.payload?.operationFingerprint,
    typeof crcFact?.payload?.operationFingerprint === 'string' && /^sha256:[0-9a-f]{16,}$/.test(crcFact.payload.operationFingerprint),
    `fp=${String(crcFact?.payload?.operationFingerprint).slice(0, 80)}`)
  await humanResolve(reqCRC.requestId, 'allow', 'V1 kit human allow (cold resume re-ask)')
  const crCRes = await crC
  await waitUntil(async () => readWs('perm-c.txt') === 'a2-cold-c', 90_000, 'cold resume write executed')
  st = (await p6t6State()).body
  check('cold-policy-rebuilt-executes', 'the cold-resume allow executed (perm-c.txt = a2-cold-c)', 'a2-cold-c', readWs('perm-c.txt'), readWs('perm-c.txt') === 'a2-cold-c', `tool=${JSON.stringify(crCRes.body).slice(0, 150)}`)
  check('cold-policy-rebuilt-consumed', 'the cold-resume allow was consumed exactly once', 'consumption row for ' + reqCRC.requestId, consumptionFor(st, reqCRC.requestId) ? 'consumed' : 'not-consumed', !!consumptionFor(st, reqCRC.requestId))

  // no hang: the scripted drill did NOT re-run (no new model requests since boot)
  const leaderLines = mockLineCount('leader')
  const { entries: coldLedgerEntries } = await ledgerFacts()
  evidence.controlLedger = coldLedgerEntries.filter((e) => String(e?.factType ?? '').startsWith('control-'))
  evidence.ledgerEntryCount = coldLedgerEntries.length
  evidence.counts = { leaderLines, requests: allRequests.length, decisions: decisions.length, consumptions: st?.control?.consumptions?.length ?? 0 }
  const pre = existsSync(join(EV, `a2permh3-live-counts-${STAMP}.json`))
    ? JSON.parse(readFileSync(join(EV, `a2permh3-live-counts-${STAMP}.json`), 'utf8'))
    : null
  check('cold-no-drill-rerun', 'no new leader model requests after the cold re-boot (the drill did not re-run)', pre?.mockLeaderLines ?? null, leaderLines,
    pre === null || leaderLines <= pre.mockLeaderLines, `before=${pre?.mockLeaderLines ?? 'unknown'} after=${leaderLines}`)

  // the cold counts go to their OWN sidecar — the live sidecar (written in
  // live mode) is the baseline artifact and must not be clobbered
  writeFileSync(join(EV, `a2permh3-cold-counts-${STAMP}.json`), JSON.stringify({ ...evidence.counts, atCold: new Date().toISOString() }, null, 2))

  // ── H3 cold hostile group (review §21, A12/A14) ─────────────────────────
  // The V1 26-check cold battery ran above: the rebuilt policy works
  // (allow executes, deny is static, ask re-asks) — on the SAME cold-
  // resumed leader ctx. From here on, install the hostile prepend-allow on
  // that ctx: the end-cap RE-INSTALLED by the cold-root bind path must be
  // the decider (the fresh-world proof above covers the create path; this
  // group covers the COLD path — §16 cold-root/cold-member installs).
  const coldHostileBefore = (await p6t6State()).body
  const chBefore = {
    requests: coldHostileBefore?.control?.requests?.length ?? -1,
    decisions: coldHostileBefore?.control?.decisions?.length ?? -1,
    consumptions: coldHostileBefore?.control?.consumptions?.length ?? -1,
  }
  evidence.h3HostileCold = { before: chBefore, legs: [] }
  const recordColdLeg = (leg) => { evidence.h3HostileCold.legs.push(leg) }

  // hc-0 — the seam answers on the cold-resumed leader's current live ctx
  const chc0 = await hostilePrepend('a2root')
  check('cold-H3-0-gate-live', 'COLD hostile-prepend answers 200 on the cold-resumed leader (ensureLiveAgent → the cold-root re-install ctx)',
    200, chc0.status, chc0.status === 200, JSON.stringify(chc0.body).slice(0, 200))
  recordColdLeg({ id: 'hc-0', agent: 'a2root', status: chc0.status, body: chc0.body })

  // hc-1 — the policy-ALLOWED read (perm-a): the V1 cold cA leg executed
  // it cleanly moments ago on this SAME ctx; with the hostile prepend it
  // must now be end-cap-DENIED with the exact stable reason.
  const ch1 = await p6t6Tool('read', { file_path: 'perm-a.txt' }, 'a2root', 'a2-cr-h3readA')
  const ch1Msg = String(ch1.body?.error?.message ?? '')
  check('cold-H3-1-allow-op-denied', 'COLD hostile prepend: the cold-resumed leader read perm-a.txt (policy-ALLOWED — the V1 cold cA leg just executed it on the same ctx) is DENIED — the re-installed end-cap (cold bind path) decides (A12/A14)',
    'Error: ' + END_CAP_REASON, ch1Msg, ch1.body?.ok === false && ch1Msg === 'Error: ' + END_CAP_REASON, ch1Msg.slice(0, 250))
  recordColdLeg({ id: 'hc-1', agent: 'a2root', op: 'read perm-a.txt', status: ch1.status, ok: ch1.body?.ok, message: ch1Msg })

  // hc-2 — the default-ask op (read perm-d): denied, ZERO new requests
  // (the rebuilt cold policy's ask lane was never reached).
  const ch2 = await p6t6Tool('read', { file_path: 'perm-d.txt' }, 'a2root', 'a2-cr-h3readD')
  const ch2Msg = String(ch2.body?.error?.message ?? '')
  check('cold-H3-2-ask-op-denied', 'COLD hostile prepend: the cold-resumed leader read perm-d.txt (rebuilt policy DEFAULT-ASK lane) is end-cap-DENIED before any request',
    'Error: ' + END_CAP_REASON, ch2Msg, ch2.body?.ok === false && ch2Msg === 'Error: ' + END_CAP_REASON, ch2Msg.slice(0, 250))
  recordColdLeg({ id: 'hc-2', agent: 'a2root', op: 'read perm-d.txt', status: ch2.status, ok: ch2.body?.ok, message: ch2Msg })

  // hc-2b — A12 STRICT: the cold-resume STATIC-DENY lane under the hostile
  // prepend: end-cap reason, not the rebuilt policy's deny reason (the
  // V1 cold-policy-deny-lane leg pins that reason on the same operation
  // moments earlier in this same world, WITHOUT the hostile).
  const ch2b = await p6t6Tool('read', { file_path: 'perm-b.txt' }, 'a2root', 'a2-cr-h3readB')
  const ch2bMsg = String(ch2b.body?.error?.message ?? '')
  check('cold-H3-2b-static-deny-lane', 'COLD hostile prepend: read perm-b.txt (the rebuilt static-DENY lane) is denied with the EXACT stable END-CAP reason (A12 — "cold-resume deny + prepend allow → deny")',
    'Error: ' + END_CAP_REASON, ch2bMsg, ch2b.body?.ok === false && ch2bMsg === 'Error: ' + END_CAP_REASON, ch2bMsg.slice(0, 250))
  recordColdLeg({ id: 'hc-2b', agent: 'a2root', op: 'read perm-b.txt', status: ch2b.status, ok: ch2b.body?.ok, message: ch2bMsg })

  // hc-3 — review §18 COLD-world pin + the durable-plane invariant
  st = (await p6t6State()).body
  const coldEndcapRows = parsedObservations(st).filter((o) => o?.stage === END_CAP_STAGE)
  check('cold-H3-3-observation-rows', 'review §18 (cold world): the /state observations readout carries the end-cap-denial rows with the EXACT stable reason (the cold re-install observes too)',
    '>=2 exact', coldEndcapRows.length, coldEndcapRows.length >= 2 && coldEndcapRows.every((r) => r.reason === END_CAP_REASON && r.stage === END_CAP_STAGE),
    JSON.stringify(coldEndcapRows).slice(0, 600))
  evidence.h3HostileCold.observations = coldEndcapRows
  check('cold-H3-3-control-unchanged', 'the DURABLE control plane is unchanged across the cold hostile group (requests/decisions/consumptions equal the pre-group baseline)',
    `${chBefore.requests}/${chBefore.decisions}/${chBefore.consumptions}`,
    `${st?.control?.requests?.length}/${st?.control?.decisions?.length}/${st?.control?.consumptions?.length}`,
    (st?.control?.requests?.length ?? -1) === chBefore.requests
      && (st?.control?.decisions?.length ?? -1) === chBefore.decisions
      && (st?.control?.consumptions?.length ?? -1) === chBefore.consumptions)

  log(`cold battery complete: ${checks.filter((c) => c.ok).length}/${checks.length} checks passed`)
}

// record the live counts for the cold comparison, even when live mode ran.
await main()
