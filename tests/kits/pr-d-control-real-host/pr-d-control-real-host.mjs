#!/usr/bin/env node
/**
 * pre-alpha3 PR-D (control-plane generalization) — D.6 REAL-HOST GATE.
 *
 * Exercises the plan's §D.6 five criteria against a REAL DSH 0.1.7-rc.1
 * host instance (the pristine `tests/deepseek-harness-test-use` checkout,
 * pinned @ 46a7f68b09) with THIS worktree's built plugin dist mounted
 * ONLY through the public profile-patch seam (CORE PATCH BUDGET = 0):
 *
 *   C1  existing leader/member permission ask path does not regress:
 *       a member ask-lane tool use creates a durable control request
 *       (legacy coupling — subject derived from targetInstanceId, NO
 *       executionCoupling), the leader resolves `allow` through the
 *       model-facing approval tools, the execution proceeds, and the
 *       durable facts (recorded / decision / allow-consumed) all exist.
 *   C2  remote v4 allow/deny does not regress: BOTH decision paths are
 *       driven through the remote v4 `team.resolveControl` endpoint
 *       (host-derived human principal — the T12-B4 trusted-caller seam);
 *       terminal states + guard behavior after each (the denied scope
 *       blocks at the guard with reason `decision-deny`).
 *   C3  template-target INLINE request create / display / resolve:
 *       an inline-coupling request targeting a TEMPLATE subject is
 *       created, listed/displayed (remote ledger page + the p6t6
 *       listControlState read-back), and resolved `allow` over the
 *       remote v4 wire. D.4 lane disjointness is asserted on the wire:
 *       the inline allow produces NO `control-allow-consumed` fact, and
 *       a guarded-lane execution attempt against the inline-allowed
 *       scope is blocked with reason `no-request` (zero authorization,
 *       zero consumption). The template subject is NOT killed by the
 *       instance stale validator (creation + resolution both succeed).
 *   C4  abort / client disconnect -> durable abandoned, zero effect:
 *       leg A — a TRUE client disconnect (the kit aborts the in-flight
 *       synchronous-delegation HTTP prompt while the member's ask-lane
 *       wait is parked) leaves the LEGACY request durably PENDING with
 *       zero execution side effects (the legacy flow never abandons on
 *       abort — the durable row stands; the recovery paths remain; the
 *       observed abort-cascade outcome is recorded as evidence).
 *       leg B — the allow-voiding ABANDON: a guarded-lane request with
 *       a pre-abandon durable ALLOW (committed over the remote v4 wire)
 *       is ABANDONED through the production control-service authority:
 *       a durable `control-request-abandoned` terminal mark
 *       {requestId, rootSessionId, abandonedAt, reason} is written, a
 *       guarded-lane execution attempt on that scope is blocked with
 *       reason `request-abandoned` EVEN OVER the pre-abandon allow
 *       (allow-voiding, zero consumption/execution), the typed
 *       `CONTROL_REQUEST_ABANDONED` code passes through the remote v4
 *       boundary UNCHANGED (invariant 4b) for a late allow with zero
 *       durable side effects, and a repeat abandon is rejected typed
 *       with NO duplicate fact (exactly-once terminal mark).
 *   C5  restart (SAME DSH_HOME) reads abandoned/history: after the host
 *       is killed and restarted on the identical DSH_HOME, the remote
 *       endpoints show the FULL control history intact — the ledger
 *       page carries every durable control fact (recorded / decided /
 *       consumed / abandoned) and the listControlState read-back
 *       returns the derived request statuses (decided, and `abandoned`
 *       for the terminal-marked request) plus the abandonments array.
 *
 * H1  hygiene: the test-use repo (findTestRepoRoot) is porcelain-empty
 *     and at HEAD 46a7f68b0922371ce7144b668b90e377d8e799f4 BEFORE and
 *     AFTER; the stable instances :3080/:3180 are zero-touch (read-only
 *     GET probes pre == post — the kit NEVER writes or controls them).
 * H2  every allocated port is released on exit (host + mock model).
 *
 * HONEST-WIRE MAP (documented gap, per the gate's honesty rule):
 *   - This branch's remote catalog has NO control-request creation
 *     endpoint and NO abandon endpoint (29-method closed catalog; the
 *     only remote control command is v4 `team.resolveControl`).
 *     PR-E's recovery-review flow is the future PRODUCT creator of the
 *     template-subject inline request. Until that wire exists, the
 *     closest REAL wire reachable from this host is the p6t6
 *     test-observability row's thin `/__p6t6/control/mutate` route —
 *     a pass-through wrapper over the SINGLE production control-service
 *     authority (requestControl / abandonControlRequest / guardOperation
 *     live in the service; the route forwards closed input and maps the
 *     typed CONTROL_* codes). C3/C4 use it for the create/abandon/guard
 *     probes and the REMOTE v4 wire for every decision + the typed
 *     abandon pass-through. This is a documented partial surface, not a
 *     faked pass: every assertion that CAN ride the product wire does.
 *   - The C4 "disconnect" leg aborts a real in-flight HTTP prompt.
 *     Whether the host cancels the nested ask-lane wait on client
 *     disconnect is OBSERVED and recorded as evidence (the durable-state
 *     assertions hold under either outcome — the legacy contract is
 *     "abort never fabricates an abandon").
 *
 * The kit is self-contained, deterministic, re-runnable, and
 * self-cleaning (finally-block teardown: hosts killed, mock closed,
 * ports verified free, evidence written token-scrubbed, world home
 * deleted unless --keep).
 *
 * USAGE:
 *   node tests/kits/pr-d-control-real-host/pr-d-control-real-host.mjs \
 *     [--worktree <path>] [--testuse <path>] [--host-port N] \
 *     [--mock-port N] [--evidence-dir <path>] [--keep]
 *   defaults: --worktree = the repo root containing this kit (3 levels
 *   up), --testuse via tests/paths.mjs findTestRepoRoot fallback,
 *   host port = first free of 3182-3186 (NEVER 3080/3180/3181),
 *   mock port = first free of 3497-3498,
 *   evidence dir = dev/agent-workflow/evidence/pre-alpha3-refactor/
 *   pr-d/prd-control-<stamp>/.
 *
 * EXIT: 0 = all five criteria + hygiene pass; 2 = a criterion failed
 * (full evidence dump in the evidence dir); 1 = fatal (environment /
 * boot / row).
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { pathToFileURL } from 'node:url'
import { startMockModel } from '../../../packages/tools/harness/mock-deepseek.mjs'
import { DshInstance } from '../../../tests/characterization/lib/instance.mjs'
import { logTail, portInUse, waitForPortFree } from '../../../tests/characterization/lib/util.mjs'
import { captureGitState } from '../../../tests/characterization/lib/tree-clean.mjs'
import { CLIENT_COMMIT_HASH, TEST_USE_BASELINE_SHA, findTestRepoRoot } from '../../../tests/paths.mjs'

// ── CLI ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
function argValue(name, dflt) {
  const i = args.indexOf(`--${name}`)
  if (i === -1) return dflt
  const v = args[i + 1]
  if (v === undefined || v.startsWith('--')) throw new Error(`--${name} requires a value`)
  return v
}
const FLAG_KEEP = args.includes('--keep')

const KIT_DIR = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(argValue('worktree', resolve(KIT_DIR, '..', '..', '..')))
let TESTUSE = resolve(argValue('testuse', join(WORKTREE, 'tests', 'deepseek-harness-test-use')))
// The gitignored test-use checkout exists only in the MAIN checkout, not
// in task worktrees (<main>/.worktrees/<task>). Fallback: parent repo.
if (!existsSync(TESTUSE) && existsSync(join(WORKTREE, '..', '..', 'tests', 'deepseek-harness-test-use'))) {
  TESTUSE = resolve(join(WORKTREE, '..', '..', 'tests', 'deepseek-harness-test-use'))
}
const EVIDENCE_DIR_ARG = argValue('evidence-dir', null)

// ── run stamp / world paths ─────────────────────────────────────────────────

function utcStamp() {
  const d = new Date().toISOString()
  return d.replace(/[:.]/g, '-').slice(0, 19)
}
const RUN_STAMP = `prd-control-${utcStamp()}`
// EVIDENCE lives in the WORKTREE (committed from the worktree branch).
const EVIDENCE_DIR = join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'pre-alpha3-refactor', 'pr-d')
const RUN_DIR = EVIDENCE_DIR_ARG === null ? join(EVIDENCE_DIR, RUN_STAMP) : resolve(EVIDENCE_DIR_ARG)
// DSH_HOME world: IN-WORKSPACE (the worktree) — host source (HOST_TREE)
// and the data home are independent.
const HOME = join(WORKTREE, 'tests', 'homes', RUN_STAMP)
const LOCK_FILE = `${HOME}.lock`
// Side-effect file target: the 0.1.7 worker `bash` runs under the bwrap
// workspace-write sandbox (`--ro-bind / /` + `--bind <workspaceRoot>
// <workspaceRoot>` + a PRIVATE `--tmpfs /tmp`) — the ONLY durable writable
// path for the worker is its session workspace root, which is the host
// process CWD = the test-use checkout (run-12: writes to
// `HOME/workspace/...` → EROFS + `[sandbox: file access denied]`). The
// test-use checkout is H1-monitored (porcelain must stay empty), so the
// marker files live under its GITIGNORED `tmp/` directory (`.gitignore`
// line `tmp/`) — writable inside the sandbox, invisible to
// `git status --porcelain`. Self-cleaned on teardown (see cleanup sites).
const SIDE_EFFECT_DIR = join(TESTUSE, 'tmp', '.prd-gate', RUN_STAMP)
// Parent chain created solely to host SIDE_EFFECT_DIR (all gitignored under
// test-use's `tmp/`). Pruned bottom-up on teardown, each level ONLY if empty
// — never above `TESTUSE/tmp`, so a pre-existing non-empty tmp/ is untouched.
const SIDE_EFFECT_ROOT = join(TESTUSE, 'tmp', '.prd-gate')
const SIDE_EFFECT_TMP = join(TESTUSE, 'tmp')
const BLUEPRINT_DIR = join(HOME, 'blueprints')

const HOST_TREE = TESTUSE
const HOST_BASELINE_SHA = TEST_USE_BASELINE_SHA // generation lives ONLY in tests/paths.mjs; never restate it here
const HOST_BIN = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const DIST_RUNTIME = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime')
const PRODUCTION_ROW_PATH = join(DIST_RUNTIME, 'src', 'plugin', 'host.js')
const GLUE_PATH = join(DIST_RUNTIME, 'src', 'plugin', 'live', 'agent-bindings.mjs')
const SEAM_PATH = join(WORKTREE, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')
const P6T6_PLUGIN_PATH = join(WORKTREE, 'packages', 'tools', 'harness', 'plugin.mjs')
const PRODUCTION_ROW_NAME = pathToFileURL(PRODUCTION_ROW_PATH).href
const GLUE_URL = pathToFileURL(GLUE_PATH).href
const SEAM_URL = pathToFileURL(SEAM_PATH).href
const P6T6_ROW_NAME = pathToFileURL(P6T6_PLUGIN_PATH).href

// Port families: NEVER 3080/3180 (stable instances) or 3181 (busy).
const HOST_PORT_CANDIDATES = [3182, 3183, 3184, 3185, 3186]
const MOCK_PORT_CANDIDATES = [3497, 3498]
const STABLE_URLS = ['http://127.0.0.1:3080/', 'http://127.0.0.1:3180/']

const ROOT = `session-prdctrl-boot-${RUN_STAMP}` // the row anchor's boot root (legacy)
const ROOT_P = `session-prdctrl-p-${RUN_STAMP}` // the PR-D control team (C1-C5)
const BP_ANCHOR_ID = 'team.prd-anchor'
const BP_PRD_ID = 'team.prd-team'

// ── markers (no substring collisions; the oracle routes on the LAST user
//    message carrying one of them) ───────────────────────────────────────────

const NONCE = RUN_STAMP
const MK = (p) => `${p}_${NONCE}`
const MK_CREATE = MK('PRD_CREATE') // P leader: create worker + async delegate W1 (C1)
const MK_C2L = MK('PRD_C2L') // P leader: async delegate W1 (C2, two asks)
const MK_C4L = MK('PRD_C4L') // P leader: SYNC delegate W1 (C4 leg A disconnect)
const MK_WORK1 = MK('PRD_W1') // W1: C1 bash ask
const MK_WORK2 = MK('PRD_W2') // W1: C2 bash ask (allow) + bash ask (deny)
const MK_WORK4 = MK('PRD_W4') // W1: C4 bash ask (the disconnect leg)
const MK_DISC = MK('PRD_DISC') // boot leader: surface discovery (L0, c1 prior art)
const DONE_DISC = 'PRD_DISC_DONE'
const DONE_CREATE = 'PRD_CREATE_DONE'
const DONE_C2L = 'PRD_C2L_DONE'
const DONE_C4L = 'PRD_C4L_DONE'
const DONE_WORK1 = 'PRD_W1_DONE'
const DONE_WORK2 = 'PRD_W2_DONE'
const DONE_WORK4 = 'PRD_W4_DONE'
const DONE_NOTIF = 'PRD_NOTIF_DONE'

// Ask-lane summary markers (the pre-execute adapter's bash summary carries
// the bounded command preview — these markers ride the notification text).
const SUM_C1 = `prd-c1-${NONCE}`
const SUM_C2A = `prd-c2a-${NONCE}`
const SUM_C2B = `prd-c2b-${NONCE}`
const SUM_C4A = `prd-c4a-${NONCE}`
// C3/C4 inline + abandon request identity (kit-authored, thin-route created).
const SUM_C3 = `prd-c3-${NONCE}`
const CORR_C3 = `prd-c3-corr-${NONCE}`
const FP_C3 = `prd-c3-fp-${NONCE}`
// C4 leg A (the SAME-request cascade: template-subject inline request,
// waited over the p6t6 real-HTTP wait route, abandoned by the true
// client disconnect — the D.6 criterion's star leg; the `2` suffix keeps
// the marker distinct from the ask-lane legacy probe's SUM_C4A).
const SUM_C4A2 = `prd-c4a2-${NONCE}`
const CORR_C4A2 = `prd-c4a2-corr-${NONCE}`
const FP_C4A2 = `prd-c4a2-fp-${NONCE}`
// C4 leg B (the allow-voiding abandon request; guarded lane, instance subject).
const SUM_C4B = `prd-c4b-${NONCE}`
const CORR_C4B = `prd-c4b-corr-${NONCE}`
const FP_C4B = `prd-c4b-fp-${NONCE}`

// Member side-effect files (ABSOLUTE paths — cwd-robust) + commands that
// both WRITE the marker file and PRINT an -executed marker (so the
// executed branch is distinguishable in the tool result).
const FILE_C1 = join(SIDE_EFFECT_DIR, `prd-c1-${NONCE}.txt`)
const FILE_C2A = join(SIDE_EFFECT_DIR, `prd-c2a-${NONCE}.txt`)
const FILE_C2B = join(SIDE_EFFECT_DIR, `prd-c2b-${NONCE}.txt`)
const FILE_C4A = join(SIDE_EFFECT_DIR, `prd-c4a-${NONCE}.txt`)
const CMD_C1 = `echo ${SUM_C1} > ${FILE_C1} && echo c1-executed`
const CMD_C2A = `echo ${SUM_C2A} > ${FILE_C2A} && echo c2a-executed`
const CMD_C2B = `echo ${SUM_C2B} > ${FILE_C2B} && echo c2b-executed`
const CMD_C4A = `echo ${SUM_C4A} > ${FILE_C4A} && echo c4a-executed`

const NOTIF_PREFIX = '[team-control requestId='

// The closed tool-name registries for the coverage-gate deny list (c1 L0
// prior art). The PR-D templates declare strict capabilities.permissions on
// the DEPLOYMENT-DEFAULT standard preset, whose agent surface carries the
// KNOWN_SENSITIVE family (grep/glob, subagent*, web_*, job_*, send_message/
// interrupt_agent/list_agents) + unmanaged host tools (skill/goal/present/
// ...). permission-coverage.ts classifies any unmanaged strict-surface tool
// FATAL (known-sensitive-unmanaged / unknown-unmanaged) UNLESS the
// capability layer removed it — so the strict templates deny EVERYTHING the
// boot leader's surface shows that is not in these three closed sets:
// the seven permission-managed tools, the SAFE_UNMANAGED registry
// (todo_write), and the thirteen team tools (governed by the teamTools
// allow entry, never by builtinToolDeny).
const MANAGED_TOOL_NAMES = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh']
const SAFE_UNMANAGED_TOOL_NAMES = ['todo_write']
// The preset's spawn `subagent` is installed in the agent's OWN tool layer
// post-publication — it is NOT a global tool, so listing it in
// builtinToolDeny makes tools.restrict() reject the agent setup with
// `unknown global tool "subagent"` (team-blueprint-authoring skill §5.2
// item 1, live on this 0.1.7 host: run-6 fatal). It is also invisible to
// the coverage gate (the gate reads the surface before the own-layer
// install lands) — so the strict templates simply do not deny it, and the
// mock oracle never calls it (accepted residual exposure, recorded in the
// evidence). subagent_fork, by contrast, IS a global tool and stays denied.
const OWN_LAYER_SPAWN_TOOLS = ['subagent']
const TEAM_TOOL_CATALOG = [
  'team_list_members',
  'team_list_templates',
  'team_inspect_config',
  'team_create_member',
  'team_delegate',
  'team_follow_up',
  'team_collect',
  'team_send_message',
  'team_report_progress',
  'team_request_control',
  'team_resolve_control',
  'team_list_pending_control',
  'team_archive_member',
]

// ── logging / criteria / fatals ─────────────────────────────────────────────

let RUN_LOG = null
function log(line) {
  const stamped = `[${new Date().toISOString()}] ${line}`
  console.log(stamped)
  if (RUN_LOG !== null) {
    try { writeFileSync(RUN_LOG, stamped + '\n', { flag: 'a' }) } catch { /* evidence best-effort */ }
  }
}

const CRITERIA = [
  { id: 'C1', name: 'existing leader/member permission ask path does not regress (member ask -> leader tool allow -> execution; durable recorded/decided/consumed)' },
  { id: 'C2', name: 'remote v4 allow/deny does not regress (both decisions over team.resolveControl v4; terminal states; denied scope guard-blocked)' },
  { id: 'C3', name: 'template-target inline request create/display/resolve + D.4 lane disjointness (no consumption; guarded attempt = no-request; template subject survives the stale validator)' },
  { id: 'C4', name: 'abort/disconnect -> durable abandoned, zero effect (SAME-request coupling-aware cascade: the true client abort of the real HTTP wait durably abandons the waited inline request — one abandon fact, reason wait-aborted; guard = request-abandoned; typed pass-through; the LEGACY ask-lane disconnect stays PENDING (untouched contract); the allow-voiding abandon keeps exactly-once)' },
  { id: 'C5', name: 'restart (same DSH_HOME) reads abandoned/history (remote ledger page + listControlState: abandonments + derived statuses + full history intact)' },
  { id: 'H1', name: 'test-use porcelain EMPTY + HEAD baseline; :3080/:3180 zero-touch (read-only probes pre == post)' },
  { id: 'H2', name: 'run ports released after teardown (host + mock)' },
]
const results = {}
for (const c of CRITERIA) results[c.id] = { id: c.id, name: c.name, status: 'not-run', checks: [] }

function check(critId, name, ok, detail) {
  results[critId].status = 'run'
  results[critId].checks.push({
    name,
    ok: ok === true,
    detail: detail === undefined ? undefined : String(detail).slice(0, 2000),
  })
  log(`${critId} ${ok ? 'PASS' : 'FAIL'} — ${name}${detail !== undefined && detail !== null ? ` :: ${String(detail).slice(0, 300)}` : ''}`)
}

function finishCriterion(critId) {
  const r = results[critId]
  r.pass = r.status === 'run' && r.checks.length > 0 && r.checks.every((c) => c.ok === true)
  log(`${critId}: ${r.pass ? 'PASS' : 'FAIL'} (${r.checks.filter((c) => c.ok).length}/${r.checks.length} checks)`)
}

// The honest per-criterion wire notes (recorded in summary.json).
const WIRE_NOTES = {
  C1: 'member ask-lane (real pre-execute adapter, legacy coupling: targetInstanceId, NO subject/coupling input) + leader model-facing tools (team_list_pending_control / team_resolve_control). Durable facts cross-checked via remote team.getLedgerPage (the product wire) and the read-only team_domain.json scan.',
  C2: 'both decisions driven over the REMOTE v4 team.resolveControl endpoint (host-derived human principal). The leader notification turns are deliberately model-neutral (text only) so the remote wire is the sole decision surface.',
  C3: 'CREATED via the p6t6 test-only thin route wrapping the production control-service authority (documented gap: no product wire creates template-subject inline requests in this branch — PR-E recovery-review is the future creator). DISPLAYED via remote team.getLedgerPage + the p6t6 listControlState read-back. RESOLVED over the REMOTE v4 wire. The lane-disjointness guard probe is the production guardOperation through the thin route (a blocked probe writes no ledger fact).',
  C4: 'leg A (the D.6 criterion) = the SAME-request cascade over a REAL HTTP wait: the template-subject inline request is CREATED via the p6t6 test-only thin route (documented gap: no product wire in this branch creates subject-bearing requests — PR-E is the future creator), the kit then opens the p6t6 `wait` action — the PRODUCTION awaitControlDecision wired to the client connection (req close -> AbortController) — parks on the PENDING request, and ABORTS that HTTP connection (a TRUE client disconnect, not a simulated flag). The coupling-aware cascade runs ENTIRELY in the service: it durably writes the one control-request-abandoned fact (reason wait-aborted) BEFORE settling the (now undeliverable) waiter; the kit verifies the SAME request is durably ABANDONED, zero decision/consumption, the guard blocks request-abandoned, and the late allow is rejected typed over the REMOTE v4 boundary. leg A2 = the LEGACY ask-lane disconnect (real synchronous-delegation prompt aborted mid-turn): the coupling-ABSENT request stays PENDING (the untouched contract — pinned at unit level by a4a W2 / a5a S10-S14, evidenced here on the real host). leg B = the allow-voiding abandon: the invalidation request is CREATED via the p6t6 thin route, gets its pre-abandon durable ALLOW over the REMOTE v4 wire, is ABANDONED through the production abandonControlRequest authority (thin route — no remote abandon endpoint exists in this branch), the guard probe = production guardOperation (a blocked probe writes nothing), the typed CONTROL_REQUEST_ABANDONED pass-through observed over the REMOTE v4 boundary (invariant 4b), exactly-once via the typed repeat rejection + the durable ledger count.',
  C5: 'all reads over remote endpoints: team.getLedgerPage (v1) for the full durable history; the p6t6 state route wraps teamRoot.control.listControlState (derived statuses + abandonments). No host-local file reads on this criterion.',
}

/**
 * FATAL setup/criterion-path exit (code 1). ASYNC and never returns: every
 * call site must `await` it — the process exits inside, so code after the
 * await is dead (a sync dieFatal that returns lets the caller race ahead:
 * observed live as a false "team created" log + a second fetch fatal).
 * Order: salvage evidence while the world still exists → stop live
 * processes (bounded) → write the fatal summary → scrub → world cleanup →
 * exit(1).
 */
async function dieFatal(msg) {
  log(`FATAL ${msg}`)
  try {
    mkdirSync(RUN_DIR, { recursive: true })
    // 1. Salvage evidence BEFORE anything goes away (host instance logs
    //    live under the world home; mock log + API transcript are in-memory).
    for (const h of EVID.hostLogs) {
      const dest = join(RUN_DIR, `host${h.bootNum}-${h.phase}-port${h.port}.log`)
      try { writeFileSync(dest, readFileSync(h.logPath, 'utf8')) } catch { /* already gone */ }
    }
    try {
      if (mockRef !== null) writeFileSync(join(RUN_DIR, 'mock.log'), mockRef.requestLogText ? mockRef.requestLogText() : JSON.stringify(mockRef.requests, null, 2))
    } catch { /* ok */ }
    try { writeFileSync(join(RUN_DIR, 'api-transcript.json'), JSON.stringify(TRANSCRIPT, null, 2)) } catch { /* ok */ }
  } catch { /* best-effort */ }
  // 2. Reclaim still-live processes (bounded by a hard backstop so a hung
  //    stop can never hold the exit).
  const backstop = setTimeout(() => process.exit(1), 75_000)
  try { await sweepLiveHosts() } catch { /* ok */ }
  try { if (mockRef !== null) await mockRef.close() } catch { /* ok */ }
  clearTimeout(backstop)
  // 3. Fatal summary (written BEFORE the scrub: `msg` may embed log tails
  //    containing session tokens) → scrub → world cleanup.
  try {
    writeFileSync(join(RUN_DIR, 'summary.json'), JSON.stringify({
      task: 'pre-alpha3 PR-D D.6 real-host control-plane gate',
      runStamp: RUN_STAMP,
      fatal: String(msg).slice(0, 4000),
      criteria: Object.values(results),
      pass: false,
      exitCode: 1,
    }, null, 2))
    scrubDir(RUN_DIR)
  } catch { /* ok */ }
  if (!FLAG_KEEP) {
    try { rmSync(HOME, { recursive: true, force: true }) } catch { /* ok */ }
    try { rmSync(LOCK_FILE, { force: true }) } catch { /* ok */ }
    cleanupSideEffectDir()
  }
  process.exit(1)
}

// ── port selection (dynamic; re-verified at start) ──────────────────────────

async function pickPort(candidates, label) {
  for (const p of candidates) {
    // portInUse is ASYNC (TCP-connect probe, timeout => conservatively busy)
    // — the await is load-bearing (a dropped await makes `!promise` a
    // permanent false and every candidate reads "busy").
    if (!(await portInUse(p, 1500))) {
      log(`${label}: picked free port ${p}`)
      return p
    }
    log(`${label}: port ${p} busy, trying next`)
  }
  await dieFatal(`${label}: no free port in candidates [${candidates.join(', ')}]`)
}

// ── HTTP helpers ────────────────────────────────────────────────────────────

async function fetchJson(url, init, timeoutMs) {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  const text = await res.text()
  let body = null
  try { body = text === '' ? null : JSON.parse(text) } catch { body = { nonJsonBody: text.slice(0, 800) } }
  return { status: res.status, body }
}

async function probeStableInstance(url) {
  try {
    const { status } = await fetchJson(url, undefined, 10_000)
    return { url, status }
  } catch (error) {
    return { url, status: `unreachable: ${String(error?.message ?? error).slice(0, 120)}` }
  }
}

/** Exchange the printed process token for the auth cookie (303 + set-cookie). */
async function authenticate(origin, token) {
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const setCookie = res.headers.get('set-cookie')
  if (res.status !== 303 || setCookie === null) {
    throw new Error(`dsh web authentication returned HTTP ${res.status} (expected 303 + set-cookie)`)
  }
  return setCookie.split(';', 1)[0]
}

function scrubTokens(text) {
  return String(text ?? '').replace(/\/\?token=([A-Za-z0-9_-]+)/g, '/?token=<SCRUBBED>')
    .replace(/("token"\s*:\s*")[A-Za-z0-9_-]+(")/g, '$1<SCRUBBED>$2')
}

/** Recursively scrub EVERY text file under `dir` (the whole evidence dir) so
 *  no launch token leaks into the committed evidence. */
function scrubDir(dir) {
  if (!existsSync(dir)) return 0
  let changed = 0
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    const st = statSync(p)
    if (st.isDirectory()) { changed += scrubDir(p); continue }
    if (!st.isFile()) continue
    let raw
    try { raw = readFileSync(p, 'utf8') } catch { continue } // skip non-utf8 / binary
    const scrubbed = scrubTokens(raw)
    if (scrubbed !== raw) { writeFileSync(p, scrubbed); changed++ }
  }
  return changed
}

/**
 * Remove the per-run side-effect leaf plus its kit-created parent chain
 * (`.prd-gate`, then `tmp/`) — bottom-up, each level ONLY if empty, never
 * above `TESTUSE/tmp`. The test-use tree is H1-monitored for git porcelain
 * (gitignored `tmp/` is invisible either way); this keeps the host tree
 * physically clean too (no orphaned empty dirs left behind on teardown).
 */
function cleanupSideEffectDir() {
  try { rmSync(SIDE_EFFECT_DIR, { recursive: true, force: true }) } catch { /* ok */ }
  for (const parent of [SIDE_EFFECT_ROOT, SIDE_EFFECT_TMP]) {
    try {
      if (existsSync(parent) && readdirSync(parent).length === 0) rmSync(parent, { force: true })
    } catch { /* ok — never delete a non-empty or foreign tmp/ */ }
  }
}

const TRANSCRIPT = []
// Module-level teardown state: dieFatal can fire from any call site and must
// reach the live world (host log paths, the mock handle) before it exits.
const EVID = { hostLogs: [] }
let mockRef = null
function noteTranscript(entry) {
  TRANSCRIPT.push({
    at: new Date().toISOString(),
    ...entry,
  })
}

/** One browser-facing public Remote call: POST /team-remote/<method>. */
async function remoteCall(origin, cookie, method, params, tag = 'prd', version = 1, timeoutMs = 180_000) {
  const res = await fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
      method,
      payload: { version, params },
    }),
  }, timeoutMs)
  noteTranscript({ method, params: scrubTokens(JSON.stringify(params)), status: res.status, body: scrubTokens(JSON.stringify(res.body)) })
  return res
}

/** A remote call that retries on the durable-consumption 429 (the PR-B shape). */
async function remoteCallReady(host, method, params, tag, version = 1, retries = 20) {
  let last = null
  for (let i = 0; i < retries; i += 1) {
    last = await remoteCall(host.origin, host.cookie, method, params, tag, version)
    if (last.status !== 429) return last
    await new Promise((r) => setTimeout(r, 1500))
  }
  return last
}

function resultError(body) {
  const r = body?.result
  if (r === undefined) return { code: 'NO_RESULT', message: String(body).slice(0, 200) }
  if (r.ok !== true) return r.error ?? { code: 'UNKNOWN', message: JSON.stringify(r).slice(0, 200) }
  return null
}
function resultData(body) {
  const r = body?.result
  if (r === undefined || r.ok !== true) return null
  const v = r.value
  if (v && typeof v === 'object' && 'data' in v) return v.data
  return v
}

/** One user turn on the DSH core public channel: POST /api/session/prompt. */
async function apiPrompt(origin, cookie, sessionId, text, tag = 'prd') {
  const res = await fetchJson(`${origin}/api/session/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
      method: 'session/prompt',
      payload: {
        args: {
          request: {
            requestId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
            sessionId,
            mode: 'queue',
            content: [{ type: 'text', text }],
          },
        },
      },
    }),
  }, 240_000)
  noteTranscript({ method: 'session/prompt', sessionId, text: String(text).slice(0, 200), status: res.status, body: scrubTokens(JSON.stringify(res.body)) })
  return res
}

/** The abortable variant (C4 leg A: a TRUE client disconnect mid-turn). */
function apiPromptAbortable(origin, cookie, sessionId, text, tag = 'prd') {
  const ctrl = new AbortController()
  const promise = fetch(`${origin}/api/session/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
      method: 'session/prompt',
      payload: {
        args: {
          request: {
            requestId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
            sessionId,
            mode: 'queue',
            content: [{ type: 'text', text }],
          },
        },
      },
    }),
    signal: ctrl.signal,
  }).then(async (res) => {
    const t = await res.text()
    let b = null
    try { b = t === '' ? null : JSON.parse(t) } catch { b = { nonJsonBody: t.slice(0, 800) } }
    return { status: res.status, body: b }
  })
  noteTranscript({ method: 'session/prompt', sessionId, text: String(text).slice(0, 200), abortable: true })
  return {
    promise,
    abort: () => ctrl.abort(),
  }
}

async function p6t6State(port) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/state`, undefined, 30_000)
}

async function p6t6Health(port) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/health`, undefined, 10_000)
}

/** Poll the state route until the well-formed body for root+phase appears. */
async function p6t6StateReady(port, { rootSessionId, phase, timeoutMs = 180_000, intervalMs = 500 }) {
  const deadline = Date.now() + timeoutMs
  let last = await p6t6State(port)
  for (;;) {
    const b = last.body
    if (last.status === 200 && b !== null && typeof b === 'object'
      && b.rootSessionId === rootSessionId && b.phase === phase
      && b.teamSession !== null && typeof b.teamSession === 'object'
      && b.teamSession.rootSessionId === rootSessionId) {
      return last
    }
    if (Date.now() >= deadline) {
      throw new Error(`row state not well-formed within ${timeoutMs}ms (expected rootSessionId=${rootSessionId} phase=${phase}); last: status=${last.status} body=${JSON.stringify(last.body).slice(0, 400)}`)
    }
    await new Promise((r) => setTimeout(r, intervalMs))
    last = await p6t6State(port)
  }
}

/** The p6t6 test-only control-plane driver route (the thin wrapper over the
 *  production control-service authority — see the HONEST-WIRE MAP header). */
async function p6t6Control(port, body, timeoutMs = 60_000) {
  const res = await fetchJson(`http://127.0.0.1:${port}/__p6t6/control/mutate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }, timeoutMs)
  noteTranscript({ method: '__p6t6/control/mutate', action: body?.action, params: scrubTokens(JSON.stringify(body)), status: res.status, body: scrubTokens(JSON.stringify(res.body)) })
  return res
}

/** The ABORTABLE variant of the p6t6 driver (C4 leg A: the `wait` action
 *  parks on the production awaitControlDecision until a decision lands OR
 *  the CLIENT CONNECTION closes — `abort()` destroys the socket, a TRUE
 *  client disconnect that the server observes as the request's `close`
 *  event and turns into the bridge's signal). */
function p6t6ControlAbortable(port, body) {
  const ctrl = new AbortController()
  const promise = fetch(`http://127.0.0.1:${port}/__p6t6/control/mutate`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    signal: ctrl.signal,
  }).then(async (res) => {
    const t = await res.text()
    let b = null
    try { b = t === '' ? null : JSON.parse(t) } catch { b = { nonJsonBody: t.slice(0, 800) } }
    return { status: res.status, body: b }
  }).catch((error) => ({ aborted: true, error: String(error?.message ?? error).slice(0, 200) }))
  noteTranscript({ method: '__p6t6/control/mutate', action: body?.action, params: scrubTokens(JSON.stringify(body)), abortable: true })
  return {
    promise,
    abort: () => ctrl.abort(),
  }
}

/** Poll the REMOTE ledger page (the product read plane) until a
 *  control-request-recorded fact whose payload satisfies `pred` appears
 *  (the ask-lane requests are created by the host mid-turn). `pred` routes
 *  on the recorded fact payload (summary markers etc.); returns the payload.
 *
 *  NOTE: the p6t6 state route's control block is root-ANCHOR-scoped (the
 *  legacy boot team), so the ROOT_P team's control state is read exclusively
 *  over the remote team.getLedgerPage — the same plane C5 asserts. */
async function waitForControlRequest(host, pred, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const { byType } = await remoteControlFacts(host)
    const hit = byType['control-request-recorded'].find((f) => pred(f.payload))
    if (hit !== undefined) return hit.payload
    if (Date.now() >= deadline) {
      log(`control-request wait timed out: ${label}`)
      return null
    }
    await new Promise((r) => setTimeout(r, 500))
  }
}

/** Poll the REMOTE ledger page until a `control-request-abandoned` fact
 *  for `requestId` appears (the C4 cascade writes it from the server side
 *  after the client disconnect — bounded, so the gate stays deterministic).
 *  Returns the full remoteControlFacts snapshot, or null on timeout. */
async function waitForControlAbandoned(host, requestId, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const facts = await remoteControlFacts(host)
    if (facts.byType['control-request-abandoned'].some((f) => f.payload.requestId === requestId)) {
      return facts
    }
    if (Date.now() >= deadline) {
      log(`control-abandoned wait timed out: ${label}`)
      return null
    }
    await new Promise((r) => setTimeout(r, 500))
  }
}

/** The PR-D derived status of a request from its durable facts (the honest
 *  read plane — the status is DERIVED: the terminal abandon mark wins over
 *  a decision; a request with neither stands pending). */
function derivedStatus(facts, requestId) {
  if (facts.byType['control-request-abandoned'].some((f) => f.payload.requestId === requestId)) return 'abandoned'
  if (facts.byType['control-decision-recorded'].some((f) => f.payload.requestId === requestId)) return 'decided'
  return 'pending'
}

// ── durable control ledger (read-only cross-check + remote wire) ───────────

function safeParse(v) {
  if (v === null || v === undefined) return {}
  if (typeof v === 'object') return v
  try { return JSON.parse(v) } catch { return { raw: String(v).slice(0, 400) } }
}

/** Detail-string-safe JSON (run-11 crash: `JSON.stringify(undefined)`
 *  returns undefined, and `.slice` on it throws — killing the whole run
 *  with an unhandled TypeError INSTEAD of failing the check with the
 *  diagnostic detail it was meant to carry). */
function jstr(x, n = 400) {
  const s = JSON.stringify(x)
  return (s === undefined ? 'undefined' : s).slice(0, n)
}

/** Read back the plugin's durable control ledger (storages/team_domain.json
 *  → tables.ledger) READ-ONLY. The remote team.getLedgerPage is the primary
 *  wire assertion; this is the forensic cross-check (c1 prior art). */
function readControlLedger() {
  const out = { recorded: [], decisions: [], consumptions: [], abandonments: [], error: null }
  try {
    const parsed = JSON.parse(readFileSync(join(HOME, 'storages', 'team_domain.json'), 'utf8'))
    // storage-json domain document: tables.<name> is a RECORD keyed by row
    // key (Object.fromEntries) — NOT an array (run-11: `for..of` on the
    // record → "entries is not iterable"). On the 0.1.7 host the row
    // VALUES are JSON-STRINGIFIED records (`"1": "{\"sequence\":1,..."`) —
    // run-12: reading `e.rootSessionId` off the raw string → every row
    // filtered out, silent zero-count. safeParse() normalizes both shapes
    // (pass-through for object rows, JSON.parse for string rows). The
    // ledger row key is String(sequence); the `__ledger_sequence_counter`
    // row is skipped by the factType filter below.
    const entries = Object.values(parsed?.tables?.ledger ?? {})
    for (const e of entries) {
      const row = safeParse(e)
      if (row.rootSessionId !== ROOT_P) continue
      const payload = safeParse(row.payload)
      if (row.factType === 'control-request-recorded') out.recorded.push({ sequence: row.sequence, payload })
      else if (row.factType === 'control-decision-recorded') out.decisions.push({ sequence: row.sequence, payload })
      else if (row.factType === 'control-allow-consumed') out.consumptions.push({ sequence: row.sequence, payload })
      else if (row.factType === 'control-request-abandoned') out.abandonments.push({ sequence: row.sequence, payload })
    }
  } catch (error) {
    out.error = String(error?.message ?? error)
  }
  return out
}

/** The FULL durable control history over the REMOTE wire (the C5 surface).
 *  Pages through team.getLedgerPage until the cursor is exhausted. */
async function remoteControlFacts(host) {
  const byType = {
    'control-request-recorded': [],
    'control-decision-recorded': [],
    'control-allow-consumed': [],
    'control-request-abandoned': [],
  }
  let afterSequence = 0
  let totalEntries = 0
  for (let pageNo = 0; pageNo < 50; pageNo++) {
    // 0.1.7 contract: limit is an integer in 1..500 (run-9: limit:1000 →
    // malformed-params on EVERY poll, breaking the whole read plane).
    const page = await remoteCallReady(host, 'team.getLedgerPage', { teamSessionId: ROOT_P, afterSequence, limit: 500 }, `prd-ledger-${pageNo + 1}`, 1)
    const pageErr = resultError(page.body)
    if (pageErr !== null) {
      // FAIL LOUD: an error page is a contract/host problem, not an empty
      // ledger (run-9: limit:1000 malformed-params silently read as "no
      // control requests" and C1 timed out after 90s of error polls).
      throw new Error(`team.getLedgerPage failed (page ${pageNo + 1}, afterSequence=${afterSequence}): ${pageErr.code} ${String(pageErr.message).slice(0, 300)}`)
    }
    const data = resultData(page.body)
    const entries = Array.isArray(data?.entries) ? data.entries : []
    totalEntries += entries.length
    for (const e of entries) {
      if (byType[e?.factType] !== undefined) {
        byType[e.factType].push({ sequence: e.sequence, payload: safeParse(e.payload) })
      }
    }
    const next = data?.nextAfterSequence
    if (next === null || next === undefined || entries.length === 0) break
    afterSequence = Number(next)
  }
  return { totalEntries, byType }
}

// ── the mock model oracle ───────────────────────────────────────────────────

function toolCall(name, argumentsObj) {
  return { kind: 'tool-call', toolCalls: [{ id: `call-prd-${Math.random().toString(36).slice(2, 10)}`, name, arguments: argumentsObj }] }
}

function bodyOf(recordOrBody) {
  if (recordOrBody === null || typeof recordOrBody !== 'object') return null
  return 'body' in recordOrBody ? (recordOrBody.body ?? null) : recordOrBody
}

function messagesOf(req) {
  return bodyOf(req)?.messages ?? []
}

/** Unwrap ONE user message to its text: string content (0.1.5 chat/
 *  completions) as-is; 0.1.7 Messages-API content block arrays → the
 *  text blocks joined (tool_result blocks carry no text → ''). */
function userTextOf(m) {
  if (m === null || typeof m !== 'object') return ''
  if (typeof m.content === 'string') return m.content
  if (Array.isArray(m.content)) {
    return m.content.map((b) => (b !== null && typeof b === 'object' && typeof b.text === 'string' ? b.text : '')).join('\n')
  }
  return ''
}

/** The LAST user message index carrying ANY chain marker or the
 *  notification prefix (or any user msg).
 *  NB (run-10): the NOTIF prefix check must run on the UNWRAPPED text —
 *  on the 0.1.7 wire the notification message's content is a block array,
 *  so `JSON.stringify(content).startsWith('[team-control')` never matches
 *  and the notification turn was misrouted to the stale MK_CREATE trigger
 *  (the leader's approval tools were never called). */
function lastTriggerIndex(msgs) {
  const all = [MK_CREATE, MK_C2L, MK_C4L, MK_WORK1, MK_WORK2, MK_WORK4, MK_DISC]
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    const m = msgs[i]
    if (m?.role !== 'user') continue
    const t = userTextOf(m)
    if (t.startsWith(NOTIF_PREFIX) || all.some((mk) => t.includes(mk))) return i
  }
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    if (msgs[i]?.role === 'user') return i
  }
  return -1
}

function lastUserTextOf(msgs) {
  const i = lastTriggerIndex(msgs)
  if (i === -1) return ''
  return userTextOf(msgs[i])
}

/** Every tool result in the conversation, in EITHER wire format:
 *  - OpenAI chat/completions: role:'tool' messages (0.1.5 host);
 *  - 0.1.7 DeepSeek Messages API: `user` messages whose content array
 *    carries {type:'tool_result', tool_use_id, content} blocks — the
 *    0.1.7 llm-deepseek client serializes internal role:'tool' messages
 *    as wire user+tool_result (lib/index.js), so a `role === 'tool'`
 *    count stays 0 forever on this host (run-7: the 2391-request
 *    team_create_member loop that OOM'd the kit process).
 *  Shape: [{ id, content }] with content always a string. */
/** Unwrap one tool-result content to the plain tool-output text:
 *  - string → as-is (0.1.5 chat/completions role:'tool' messages);
 *  - content-block array (0.1.7 Messages API tool_result blocks carry the
 *    tool output as [{type:'text',text:'...'}]) → the text blocks joined,
 *    UNESCAPED — JSON.stringify would escape the inner JSON's quotes and
 *    break the regex extractors (run-8: "instanceId" unmatchable inside
 *    a stringified block array).
 *  - anything else → stringified. */
function toolResultText(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) {
    return content
      .map((b) => (b !== null && typeof b === 'object' && typeof b.text === 'string' ? b.text : JSON.stringify(b ?? '')))
      .join('\n')
  }
  return JSON.stringify(content ?? '')
}

function allToolResults(msgs) {
  const out = []
  for (const m of msgs) {
    if (m?.role === 'tool') {
      out.push({ id: m.tool_call_id ?? null, content: toolResultText(m.content) })
      continue
    }
    const blocks = Array.isArray(m?.content) ? m.content : []
    for (const b of blocks) {
      if (b?.type === 'tool_result') {
        out.push({ id: b.tool_use_id ?? null, content: toolResultText(b.content) })
      }
    }
  }
  return out
}

/** The tool results AFTER the chain trigger (per-turn chain progress —
 *  robust to whether earlier turns' tool results accumulate in context). */
function toolMsgsOf(msgs) {
  const i = lastTriggerIndex(msgs)
  return allToolResults(msgs.slice(i + 1))
}

function extractInstanceId(content) {
  // NB: the fallback regex has NO capture group — m[1] there is undefined
  // (run-8: undefined silently dropped the delegationInstanceId key from
  // the mock tool-call JSON and team_delegate was rejected with
  // TEAM_TOOL_BAD_ARGUMENTS). m[1] ?? m[0] covers grouped + bare matches.
  const m =
    /"targetInstanceId"\s*:\s*"([^"]+)"/.exec(String(content)) ??
    /"instanceId"\s*:\s*"([^"]+)"/.exec(String(content)) ??
    /inst-[A-Za-z0-9][A-Za-z0-9-]{3,64}/.exec(String(content))
  if (m === null) return null
  return m[1] ?? m[0]
}

function extractNotifRequestId(text) {
  const m = /requestId:\s*([A-Za-z0-9][A-Za-z0-9_-]{3,128})/.exec(String(text))
  return m === null ? null : m[1]
}

function extractListedRequestId(content) {
  const m = /"requestId"\s*:\s*"([^"]+)"/.exec(String(content))
  return m === null ? null : m[1]
}

/**
 * The PR-D mock oracle. Chain routing over (LAST user message with a
 * marker, tool messages AFTER it):
 *
 *   1. title side-calls → neutral;
 *   2. notification turns (`[team-control requestId=`):
 *        SUM_C1 summary → list pending + resolve ALLOW (the C1 model-tool
 *        regression path — the ONLY model-driven decision in the run);
 *        SUM_C2A/SUM_C2B summaries → text only (the C2 decisions ride the
 *        REMOTE v4 wire, driven by the kit — the model stays out);
 *   3. member chains (W1: C1 one bash ask; C2 bash-allow-ask then
 *      bash-deny-ask; C4 one bash ask under the disconnect);
 *   4. leader chains (create + async delegate; C2 async delegate; C4 SYNC
 *      delegate — the turn the kit disconnects mid-wait).
 */
function makeDecide() {
  // Loop breaker: if the same (trigger, tool-name) is issued more than
  // LOOP_BREAK_CAP times without chain progress — a wire-format
  // regression in how the host represents tool results (run-7: the
  // 2391-request team_create_member loop that OOM'd the kit process) —
  // end the turn with a text marker instead of letting the host execute
  // the same tool call in a tight loop. The kit's DONE waits then time
  // out and dieFatal with full evidence.
  const LOOP_BREAK_CAP = 2
  const issued = new Map()
  function decideInner({ req }) {
    const msgs = Array.isArray(req?.messages) ? req.messages : []
    // Title side-calls embed the user prompt VERBATIM — the marker check
    // below would misroute them (run-8: the 0.1.7 title call for the
    // MK_CREATE prompt re-issued team_create_member). Both 0.1.5 and
    // 0.1.7 phrasings; on the 0.1.7 wire the content is a block array.
    const first = msgs[0]
    const firstText = Array.isArray(first?.content)
      ? first.content.map((b) => (b !== null && typeof b === 'object' && typeof b.text === 'string' ? b.text : '')).join('')
      : (typeof first?.content === 'string' ? first.content : '')
    if (firstText.startsWith('Create a concise title') || firstText.startsWith('Generate the session title')) {
      return { kind: 'text', content: 'prd control gate session' }
    }
    const lastUser = lastUserTextOf(msgs)
    const tools = toolMsgsOf(msgs).length

    // (1.5) L0 surface discovery (boot leader, c1 prior art): a single
    // neutral text reply — the model request's `tools` array is the
    // evidence (the coverage-gate deny list source, read by the kit).
    if (lastUser.includes(MK_DISC)) {
      return { kind: 'text', content: DONE_DISC }
    }

    // (2) notification turns.
    if (lastUser.startsWith(NOTIF_PREFIX)) {
      if (lastUser.includes(SUM_C1)) {
        // THE C1 regression path: the leader resolves through the
        // model-facing approval tools.
        if (tools === 0) {
          return toolCall('team_list_pending_control', {
            rootSessionId: ROOT_P,
            requestToken: `prd-notif-list-${extractNotifRequestId(lastUser) ?? 'x'}`,
          })
        }
        if (tools === 1) {
          const requestId = extractListedRequestId(toolMsgsOf(msgs)[0]?.content)
          if (requestId === null) return { kind: 'text', content: `PRD_NOTIF_EXTRACT_FAIL :: ${String(toolMsgsOf(msgs)[0]?.content).slice(0, 300)}` }
          return toolCall('team_resolve_control', {
            rootSessionId: ROOT_P,
            requestToken: `prd-notif-res-${requestId}`,
            requestId,
            decision: 'allow',
          })
        }
        return { kind: 'text', content: DONE_NOTIF }
      }
      // C2 (and any other) notification: model-neutral — the REMOTE v4
      // wire is the decision surface for C2.
      return { kind: 'text', content: 'PRD_NOTIF_IGNORED_REMOTE_DRIVEN' }
    }

    // (3) member chains (W1).
    if (lastUser.includes(MK_WORK1)) {
      switch (tools) {
        // 0.1.7 bash schema REQUIRES `description` (run-11: the ask-lane,
        // decision and allow-consumption all succeeded, then the bash tool
        // rejected the arguments — `missing required property
        // "description"` — so the side-effect file was never written).
        case 0: return toolCall('bash', { command: CMD_C1, description: 'prd c1 side-effect marker write', timeoutMs: 30000 })
        case 1: return { kind: 'text', content: DONE_WORK1 }
        default: return { kind: 'text', content: `PRD_W1_FALLTHROUGH tools=${tools}` }
      }
    }
    if (lastUser.includes(MK_WORK2)) {
      switch (tools) {
        case 0: return toolCall('bash', { command: CMD_C2A, description: 'prd c2a side-effect marker write', timeoutMs: 30000 })
        case 1: return toolCall('bash', { command: CMD_C2B, description: 'prd c2b side-effect marker write', timeoutMs: 30000 })
        case 2: return { kind: 'text', content: DONE_WORK2 }
        default: return { kind: 'text', content: `PRD_W2_FALLTHROUGH tools=${tools}` }
      }
    }
    if (lastUser.includes(MK_WORK4)) {
      switch (tools) {
        case 0: return toolCall('bash', { command: CMD_C4A, description: 'prd c4a side-effect marker write', timeoutMs: 30000 })
        case 1: return { kind: 'text', content: DONE_WORK4 }
        default: return { kind: 'text', content: `PRD_W4_FALLTHROUGH tools=${tools}` }
      }
    }

    // (4) leader chains (the P team root session).
    if (lastUser.includes(MK_CREATE)) {
      switch (tools) {
        case 0: return toolCall('team_create_member', {
          rootSessionId: ROOT_P,
          requestToken: `prd-create-${NONCE}`,
          delegationTemplateId: 'worker',
          label: 'w1',
        })
        case 1: {
          const id = extractInstanceId(toolMsgsOf(msgs)[0]?.content)
          // null/undefined/'' all mean "no id" — an undefined value would
          // silently vanish from the tool-call JSON (JSON.stringify drops
          // undefined) and the host would reject the delegate.
          if (id === null || id === undefined || id === '') {
            return { kind: 'text', content: `PRD_CREATE_EXTRACT_FAIL :: ${String(toolMsgsOf(msgs)[0]?.content).slice(0, 300)}` }
          }
          return toolCall('team_delegate', {
            rootSessionId: ROOT_P,
            requestToken: `prd-delegate-${NONCE}`,
            delegationInstanceId: id,
            label: 'w1',
            prompt: MK_WORK1,
            async: true,
          })
        }
        case 2: return { kind: 'text', content: DONE_CREATE }
        default: return { kind: 'text', content: `PRD_CREATE_FALLTHROUGH tools=${tools}` }
      }
    }
    if (lastUser.includes(MK_C2L)) {
      const allTool = allToolResults(msgs)
      const memberId = allTool.map((m) => extractInstanceId(m.content)).find((v) => v !== null) ?? null
      if (memberId === null) return { kind: 'text', content: 'PRD_C2L_MEMBERID_FAIL :: no instance id in history' }
      switch (tools) {
        case 0: return toolCall('team_delegate', {
          rootSessionId: ROOT_P,
          requestToken: `prd-c2-delegate-${NONCE}`,
          delegationInstanceId: memberId,
          label: 'w1',
          prompt: MK_WORK2,
          async: true,
        })
        case 1: return { kind: 'text', content: DONE_C2L }
        default: return { kind: 'text', content: `PRD_C2L_FALLTHROUGH tools=${tools}` }
      }
    }
    if (lastUser.includes(MK_C4L)) {
      const allTool = allToolResults(msgs)
      const memberId = allTool.map((m) => extractInstanceId(m.content)).find((v) => v !== null) ?? null
      if (memberId === null) return { kind: 'text', content: 'PRD_C4L_MEMBERID_FAIL :: no instance id in history' }
      switch (tools) {
        // THE sync delegation: this call blocks the leader turn until the
        // member's work unit settles — which requires the ask-lane decision
        // the kit will disconnect INSTEAD of providing.
        case 0: return toolCall('team_delegate', {
          rootSessionId: ROOT_P,
          requestToken: `prd-c4-delegate-${NONCE}`,
          delegationInstanceId: memberId,
          label: 'w1',
          prompt: MK_WORK4,
          async: false,
        })
        case 1: return { kind: 'text', content: DONE_C4L }
        default: return { kind: 'text', content: `PRD_C4L_FALLTHROUGH tools=${tools}` }
      }
    }

    return { kind: 'text', content: 'PRD_ORACLE_FALLTHROUGH (no marker)' }
  }
  return function decide({ req }) {
    const reply = decideInner({ req })
    if (reply.kind === 'tool-call') {
      const names = (Array.isArray(reply.toolCalls) ? reply.toolCalls : [reply.toolCalls]).map((c) => String(c.name)).join(',')
      const trigger = lastUserTextOf(Array.isArray(req?.messages) ? req.messages : []).slice(0, 80)
      const key = `${trigger}|${names}`
      const n = (issued.get(key) ?? 0) + 1
      issued.set(key, n)
      if (n > LOOP_BREAK_CAP) {
        log(`oracle: LOOP BREAK — tool-call "${names}" for trigger ${JSON.stringify(trigger)} issued ${n}x without chain progress; ending the turn`)
        return { kind: 'text', content: `PRD_LOOP_BREAK ${names}` }
      }
    }
    return reply
  }
}

/** Poll the mock until a request record satisfying `pred` appears. */
async function waitForMock(mock, pred, timeoutMs, label) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const hit = mock.requests.find(pred)
    if (hit !== undefined) return hit
    if (Date.now() >= deadline) {
      log(`mock wait timed out: ${label} (requests=${mock.requests.length})`)
      return null
    }
    await new Promise((r) => setTimeout(r, 400))
  }
}

// ── the production row config + profile-patch emitter ───────────────────────

function teamRowConfig({ bootPhase }) {
  return {
    rootSessionId: ROOT,
    bootPhase,
    blueprintSource: BP_ANCHOR_YAML,
    // The saved-source catalog (the team.create v1 blueprintId lookup — the
    // real product creation path). The files live under the world home.
    blueprintDir: BLUEPRINT_DIR,
    // PRESET IDS DELIBERATELY ABSENT (= the 0.1.7 deployment default
    // `standard` preset — the production shipped state, PR-C C.10 proven on
    // this exact host). The 0.1.7 user-preset seam is a
    // `@deepseek-ai/dsh-agent-preset` composition row in the profile patch;
    // the legacy `<home>/.agent-presets/<id>/agent.cordis.yml` file shape
    // (the c1/0.1.5-era smoke preset) is NOT loaded by the 0.1.7 registry
    // ("Unknown agent preset" at bootstrap). `standard` already provides the
    // `bash` tool (toolName 'bash' — the mock oracle's execution tool) plus
    // persona/tool-fs; the team tools ride the row envelope, not the preset.
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'prd-gate-model' },
    deniedSelection: null,
    mcpServers: [],
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl: GLUE_URL,
    seamUrl: SEAM_URL,
  }
}

/** The row anchor: a plain legacy leader (the 0.1.0-rc.1 boot shape). */
const BP_ANCHOR_YAML = [
  '---',
  'schemaVersion: 3',
  `blueprintId: ${BP_ANCHOR_ID}`,
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: "You are the leader of the PR-D gate boot team."',
  'members:',
  '  - templateId: worker',
  '    persona: "You are a worker of the PR-D gate boot team."',
  'memberEnvelopes: []',
  'requirements: []',
  'permissionMutationEnvelope:',
  '  rules: []',
  'teamHardEnvelope:',
  '  rules: []',
  'policyStates: []',
  'metadata: {}',
  '---',
  '',
].join('\n')

const LEADER_TEAM_TOOLS_ALLOW = [
  'team_list_members',
  'team_list_templates',
  'team_inspect_config',
  'team_create_member',
  'team_delegate',
  'team_collect',
  'team_list_pending_control',
  'team_resolve_control',
]

/**
 * The saved-source strict PR-D team blueprint: the WORKER declares
 * `capabilities.permissions` (default ask + ask bash any) — that is what
 * makes its bash calls produce durable leader-approval requests (the
 * pre-execute adapter's ask-lane path). The member envelope admits
 * `request-control` (the ask's control-request creation is an admitted
 * mutation op for the calling agent — the LIVE-FOUND rc2 finding) but NOT
 * `resolve-control` (a member is never a resolver).
 */
function savedBlueprintYaml(bpId, denyList) {
  // The coverage-gate deny list (L0-discovered): every strict-surface tool
  // not in MANAGED ∪ SAFE_UNMANAGED ∪ TEAM_TOOL_CATALOG — see the registry
  // constants above. Both templates carry it (the leader is strict too).
  const denyLines = (list, baseIndent) => {
    const pad = '  '.repeat(baseIndent)
    return list.length === 0
      ? [`${pad}builtinToolDeny: []`]
      : [`${pad}builtinToolDeny:`, ...list.map((n) => `${pad}  - ${n}`)]
  }
  const leaderBlock = [
    'leader:',
    '  templateId: leader',
    '  persona: "You are the leader of the PR-D control gate team. Resolve member permission asks when notified; keep answers brief."',
    '  capabilities:',
    '    teamTools:',
    '      kind: allow',
    '      items:',
    ...LEADER_TEAM_TOOLS_ALLOW.map((t) => `        - ${t}`),
    ...denyLines(denyList, 2),
    '    skills:',
    '      kind: allow',
    '      items: []',
    '    mcp:',
    '      kind: allow',
    '      items: []',
    '    permissions:',
    '      default: ask',
    '      allow:',
    '        - tool: read',
    '          resource:',
    '            kind: subtree',
    '            path: team',
    '      ask:',
    '        - tool: bash',
    '          resource:',
    '            kind: any',
    '      deny:',
    '        - tool: read',
    '          resource:',
    '            kind: subtree',
    '            path: runtime',
  ]
  const workerBlock = [
    'members:',
    '  - templateId: worker',
    '    persona: "You are a worker of the PR-D control gate team. Execute the delegated command exactly as instructed; keep answers brief."',
    '    capabilities:',
    '      teamTools:',
    '        kind: deny',
    ...denyLines(denyList, 3),
    '      skills:',
    '        kind: allow',
    '        items: []',
    '      mcp:',
    '        kind: allow',
    '        items: []',
    '      permissions:',
    '        default: ask',
    '        allow:',
    '          - tool: read',
    '            resource:',
    '              kind: subtree',
    '              path: team',
    '        ask:',
    '          - tool: bash',
    '            resource:',
    '              kind: any',
    '        deny:',
    '          - tool: read',
    '            resource:',
    '              kind: subtree',
    '              path: runtime',
  ]
  const teamEnvelope = [
    'teamEnvelope:',
    '  allow:',
    '    - assign-task',
    '    - create-member',
    '    - send-message',
    '    - report-progress',
    '    - request-control',
    '    - resolve-control',
    '  deny: []',
  ]
  const memberEnvelope = [
    'memberEnvelopes:',
    '  - templateId: worker',
    '    envelope:',
    '      allow:',
    '        - send-message',
    '        - report-progress',
    '        - request-control',
    '      deny: []',
  ]
  return [
    '---',
    'schemaVersion: 3',
    `blueprintId: ${bpId}`,
    'revision: "1"',
    ...leaderBlock,
    ...workerBlock,
    ...teamEnvelope,
    ...memberEnvelope,
    'requirements: []',
    'permissionMutationEnvelope:',
    '  rules: []',
    'teamHardEnvelope:',
    '  rules: []',
    'policyStates: []',
    'metadata: {}',
    '---',
    '',
  ].join('\n')
}

function yamlScalar(v) {
  if (v === null) return 'null'
  if (typeof v === 'string') return JSON.stringify(v)
  return String(v)
}

function yamlValueLines(value, indent) {
  if (Array.isArray(value)) return value.flatMap((item) => yamlEmitItem(item, indent))
  return Object.entries(value).flatMap(([k, v]) => yamlEmit(k, v, indent))
}

function yamlEmit(key, value, indent) {
  const pad = '  '.repeat(indent)
  if (value !== null && typeof value === 'object') {
    const empty = Array.isArray(value) ? value.length === 0 : Object.keys(value).length === 0
    if (empty) return [`${pad}${key}: ${Array.isArray(value) ? '[]' : '{}'}`]
    return [`${pad}${key}:`, ...yamlValueLines(value, indent + 1)]
  }
  return [`${pad}${key}: ${yamlScalar(value)}`]
}

function yamlEmitItem(item, indent) {
  const pad = '  '.repeat(indent)
  if (item === null || typeof item !== 'object') return [`${pad}- ${yamlScalar(item)}`]
  if (Array.isArray(item)) {
    if (item.length === 0) return [`${pad}- []`]
    return [`${pad}-`, ...yamlValueLines(item, indent + 1)]
  }
  const entries = Object.entries(item)
  const [firstKey, firstValue] = entries[0]
  const firstLines = yamlEmit(firstKey, firstValue, indent + 1)
  const rest = entries.slice(1).flatMap(([k, v]) => yamlEmit(k, v, indent + 1))
  return [`${pad}- ${firstLines[0].slice((indent + 1) * 2)}`, ...firstLines.slice(1), ...rest]
}

function writeTeamPatchFile(patchPath, bootPhase) {
  mkdirSync(dirname(patchPath), { recursive: true })
  const lines = [
    `# pre-alpha3 PR-D D.6 gate patch layer (world ${RUN_STAMP}): production dsh-agent-team row (WORKTREE ${WORKTREE} built dist — THIS branch's build) + p6t6 observability row (with the D.6 control-mutate test route) — mounted ONLY through this public profile-patch seam (CORE PATCH BUDGET = 0).`,
    `- insert:`,
    ...yamlEmitItem({ id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: teamRowConfig({ bootPhase }) }, 2),
    ...yamlEmitItem({ id: 'p6t6-team-tools', name: P6T6_ROW_NAME }, 2),
    '',
  ]
  writeFileSync(patchPath, lines.join('\n'))
}

// ── world boot / stop ───────────────────────────────────────────────────────

const liveHosts = new Set()

async function assertFreshHome(home, label) {
  if (existsSync(home)) {
    const entries = readdirSync(home)
    if (entries.length > 0) {
      await dieFatal(`${label}: DSH home ${home} exists and is non-empty (${entries.length} entries) — fail CLOSED; delete it to re-run`)
    }
  }
  mkdirSync(home, { recursive: true })
  mkdirSync(SIDE_EFFECT_DIR, { recursive: true })
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  writeFileSync(LOCK_FILE, JSON.stringify({
    world: home,
    pid: process.pid,
    kit: 'pr-d-control-real-host.mjs',
    runStamp: RUN_STAMP,
    at: new Date().toISOString(),
  }, null, 2))
}

async function bootHost({ label, port, boot, phase }) {
  const instLogDir = join(RUN_DIR, 'instances', label)
  mkdirSync(instLogDir, { recursive: true })
  const instance = new DshInstance({
    hostTree: HOST_TREE,
    dshHome: HOME,
    port,
    clientCommitHash: CLIENT_COMMIT_HASH,
    logDir: instLogDir,
  })
  const rec = { label, port, instance, logPath: null, url: null, token: null, cookie: null, origin: null, health: null, dumpText: null }
  writeTeamPatchFile(instance.patchFile, phase) // bootPhase 'create' | 'resume'
  writeFileSync(join(HOME, 'p6t6-directive.json'), JSON.stringify({
    boot,
    phase,
    reportDir: RUN_DIR,
    runStamp: RUN_STAMP,
    rootSessionId: ROOT,
  }, null, 2))
  log(`${label}: patch (bootPhase=${phase}) + directive (boot=${boot}) written`)
  const started = await instance.start({ timeoutMs: 240_000 })
  rec.url = started.url
  rec.logPath = started.logPath
  liveHosts.add(rec)
  const m = /^http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)$/.exec(started.url)
  if (m === null) await dieFatal(`${label}: unexpected boot url shape: ${scrubTokens(started.url)}`)
  rec.token = m[2]
  rec.origin = `http://127.0.0.1:${m[1]}`
  rec.cookie = await authenticate(rec.origin, rec.token)
  log(`${label}: booted at ${rec.origin}; auth cookie exchanged`)
  const dump = await instance.dumpConfig({ timeoutMs: 60_000 })
  rec.dumpText = dump.text
  writeFileSync(join(RUN_DIR, 'instances', label, 'dump-config.txt'), dump.text)
  if (!DshInstance.rowInDump(dump.text, { id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME })) {
    await dieFatal(`${label}: production row not in composed profile dump`)
  }
  if (!DshInstance.rowInDump(dump.text, { id: 'p6t6-team-tools', name: P6T6_ROW_NAME })) {
    await dieFatal(`${label}: p6t6 row not in composed profile dump`)
  }
  const deadline = Date.now() + 240_000
  for (;;) {
    const hb = await p6t6Health(port)
    rec.health = { status: hb.status, body: hb.body }
    if (hb.status === 200 && hb.body?.ok === true) break
    if (hb.status === 200 && hb.body?.ok === false && hb.body?.setupError !== undefined) {
      await dieFatal(`${label}: row setup failed — setupError: ${String(hb.body.setupError).slice(0, 600)}; log tail:\n${logTail(rec.logPath, 25)}`)
    }
    if (Date.now() >= deadline) {
      await dieFatal(`${label}: row health not ready in 240s — health=${JSON.stringify(hb.body).slice(0, 400)}; log tail:\n${logTail(rec.logPath, 25)}`)
    }
    await new Promise((r) => setTimeout(r, 1000))
  }
  log(`${label}: row ready — toolCount=${rec.health.body?.toolCount}`)
  return rec
}

async function stopHost(rec) {
  try {
    const res = await rec.instance.stop({ timeoutMs: 30_000 })
    log(`${rec.label}: stopped (killed=${res.killed} portFree=${res.portFree})`)
  } finally {
    liveHosts.delete(rec)
  }
}

async function sweepLiveHosts() {
  for (const rec of [...liveHosts]) {
    log(`sweep: stopping still-live host ${rec.label}`)
    try { await stopHost(rec) } catch (error) { log(`sweep: ${rec.label} stop error: ${error.message}`) }
  }
}

// (The former `saveStateBody` helper was REMOVED with the read-plane
//  rework: the p6t6 state route's control block is root-ANCHOR-scoped and
//  cannot see the ROOT_P team — every ROOT_P control read now rides the
//  remote team.getLedgerPage via remoteControlFacts / derivedStatus.)

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  // Environment preflight.
  if (!existsSync(HOST_BIN)) await dieFatal(`test-use host bin missing: ${HOST_BIN}`)
  if (!existsSync(PRODUCTION_ROW_PATH)) await dieFatal(`production row dist missing (run pnpm build in the worktree): ${PRODUCTION_ROW_PATH}`)
  if (!existsSync(P6T6_PLUGIN_PATH)) await dieFatal(`p6t6 row source missing: ${P6T6_PLUGIN_PATH}`)

  const HOST_PORT = Number(argValue('host-port', 0)) || await pickPort(HOST_PORT_CANDIDATES, 'host')
  const MOCK_PORT = Number(argValue('mock-port', 0)) || await pickPort(MOCK_PORT_CANDIDATES, 'mock')

  // Model endpoint wiring: the host's `deepseek-official` provider resolves
  // its base URL from $DEEPSEEK_BASE_URL ("falls back to $DEEPSEEK_BASE_URL
  // from a trusted environment layer, then the public API" — 0.1.7
  // llm-deepseek config). DshInstance spreads process.env into the spawned
  // child, so pointing it at the mock keeps EVERY model call of the run
  // local (without it the turns hit the public API and the mock sees zero
  // requests — run-5 fatal).
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${MOCK_PORT}`
  process.env.DEEPSEEK_API_KEY = `prd-gate-mock-${NONCE}`

  mkdirSync(RUN_DIR, { recursive: true })
  RUN_LOG = join(RUN_DIR, 'run.log')
  log(`PR-D D.6 real-host gate — stamp=${RUN_STAMP} hostPort=${HOST_PORT} mockPort=${MOCK_PORT}`)
  log(`worktree=${WORKTREE} testuse=${TESTUSE}`)

  // H1 (pre): stable probes + test-use git state.
  const stableBefore = {}
  for (const u of STABLE_URLS) stableBefore[u] = await probeStableInstance(u)
  // captureGitState writes its three snapshot logs into logDir without
  // creating it (spawnToLog opens the log file directly) — pre-create.
  mkdirSync(join(RUN_DIR, 'git-pre'), { recursive: true })
  const testUsePre = await captureGitState(TESTUSE, join(RUN_DIR, 'git-pre'))
  writeFileSync(join(RUN_DIR, 'testuse-pre.json'), JSON.stringify(testUsePre, null, 2))
  log(`H1 pre: stable=${JSON.stringify(stableBefore)} testuse head=${testUsePre.head} statusEmpty=${testUsePre.statusEmpty}`)

  // World + mock.
  await assertFreshHome(HOME, 'world')
  writeFileSync(join(BLUEPRINT_DIR, 'prd-anchor.yaml'), BP_ANCHOR_YAML)
  // NOTE: prd-team.yaml is written AFTER boot + L0 surface discovery — its
  // strict capabilities carry the coverage-gate builtinToolDeny computed
  // from the boot leader's model-facing surface (c1 L0 prior art). The
  // saved-source index is stateless (per-query rescan), so a file added
  // after boot is visible on the next catalog query.

  const mock = await startMockModel({
    port: MOCK_PORT,
    decide: makeDecide(),
    log: (line) => log(`mock: ${line}`),
  })
  if (mock.port !== MOCK_PORT) await dieFatal(`mock model landed on ${mock.port}, expected ${MOCK_PORT}`)
  log(`mock model up on 127.0.0.1:${mock.port}`)
  mockRef = mock // for dieFatal's bounded teardown

  let host = null
  let host2 = null
  // Hoisted so the finally/catch summary cannot hit a TDZ ReferenceError
  // when a fatal lands before the H1 post-section assigns them.
  let stableAfter = {}
  let testUsePost = null
  let W1 = null // the worker instance id (learned from C1's request row)
  let rC1 = null, rC2A = null, rC2B = null, rC3 = null, rC4A = null, rC4AL = null, rC4B = null

  try {
    // ── boot (create phase) ─────────────────────────────────────────────────
    host = await bootHost({ label: 'HOST1-CREATE', port: HOST_PORT, boot: 1, phase: 'create' })
    EVID.hostLogs.push({ bootNum: 1, phase: 'create', port: HOST_PORT, logPath: host.logPath })
    const st1 = await p6t6StateReady(HOST_PORT, { rootSessionId: ROOT, phase: 'create' })
    log(`HOST1: state ready (boot team ${ROOT})`)
    writeFileSync(join(RUN_DIR, 'host1-boot-state.json'), JSON.stringify(st1.body, null, 2))

    // ── L0: surface discovery (the coverage-gate deny list) ────────────────
    // The strict PR-D templates declare capabilities.permissions on the
    // deployment-default standard preset. Its agent surface carries the
    // KNOWN_SENSITIVE family + unmanaged host tools; the coverage gate
    // FATALs any strict-surface tool the capability layer did not remove —
    // so we learn the boot leader's (legacy, capabilities-less) full
    // model-facing surface and deny everything not managed/safe/team.
    {
      const pDisc = await apiPrompt(host.origin, host.cookie, ROOT, `${MK_DISC} Report your tool inventory, then finish.`, 'l0-disc')
      if (!(pDisc.status === 200 && pDisc.body?.result?.ok === true)) {
        await dieFatal(`L0 discovery prompt not admitted (status=${pDisc.status} body=${JSON.stringify(pDisc.body).slice(0, 300)})`)
      }
      const discReq = await waitForMock(mock, (r) => r.body !== null && lastUserTextOf(r.body.messages ?? []).includes(MK_DISC) && Array.isArray(r.body?.tools) && r.body.tools.length > 0, 120_000, 'L0 discovery model request')
      if (discReq === null) await dieFatal(`L0 discovery model request with tools not observed within 120s (requests=${mock.requests.length})`)
      const surface = (discReq.body.tools ?? []).map((t) => t.function?.name ?? t.name ?? String(t)).sort()
      const denyList = surface.filter(
        (n) => !MANAGED_TOOL_NAMES.includes(n) && !SAFE_UNMANAGED_TOOL_NAMES.includes(n) && !TEAM_TOOL_CATALOG.includes(n) && !OWN_LAYER_SPAWN_TOOLS.includes(n),
      )
      if (!surface.includes('bash')) await dieFatal(`L0 discovery surface missing bash (surface=${surface.length} tools)`)
      writeFileSync(join(RUN_DIR, 'l0-surface.json'), JSON.stringify({ surface, denyList, managed: MANAGED_TOOL_NAMES, safeUnmanaged: SAFE_UNMANAGED_TOOL_NAMES }, null, 2))
      log(`L0 surface (${surface.length} tools) → strict builtinToolDeny = ${denyList.length} names: ${denyList.join(', ')}`)
      writeFileSync(join(BLUEPRINT_DIR, 'prd-team.yaml'), savedBlueprintYaml(BP_PRD_ID, denyList))

      const discDone = await waitForMock(mock, (r) => r.body !== null && r.reply?.kind === 'text' && r.reply?.content === DONE_DISC, 120_000, 'L0 discovery turn')
      if (discDone === null) await dieFatal(`L0 discovery turn did not complete with ${DONE_DISC} within 120s`)
    }

    // ── create the PR-D control team (the real product creation wire) ──────
    {
      const createP = await remoteCallReady(host, 'team.create', {
        rootSessionId: ROOT_P,
        blueprintId: BP_PRD_ID,
      }, 'p-create', 1)
      if (resultError(createP.body) !== null) {
        await dieFatal(`team.create (PR-D team) failed: ${JSON.stringify(resultError(createP.body)).slice(0, 400)}`)
      }
      log(`PR-D team created at ${ROOT_P}`)
    }

    // ── C1: the existing ask path (member ask -> leader tool allow -> exec) ─
    {
      const p1 = await apiPrompt(host.origin, host.cookie, ROOT_P, `${MK_CREATE} Create worker w1 from template worker, then delegate the C1 task asynchronously.`, 'c1-create')
      if (!(p1.status === 200 && p1.body?.result?.ok === true)) {
        await dieFatal(`C1 create turn not admitted (status=${p1.status} body=${JSON.stringify(p1.body).slice(0, 300)})`)
      }
      const createDone = await waitForMock(mock, (r) => r.reply?.kind === 'text' && r.reply?.content === DONE_CREATE, 240_000, 'C1 leader create+delegate')
      if (createDone === null) await dieFatal(`C1 leader create+delegate turn did not complete (requests=${mock.requests.length})`)

      // The member's bash ask lands as a durable request (the pre-execute
      // adapter, legacy coupling: targetInstanceId, NO subject/coupling).
      rC1 = await waitForControlRequest(host, (r) => String(r.summary ?? '').includes(SUM_C1), 90_000, 'C1 ask-lane request')
      if (rC1 === null) await dieFatal('C1: the member bash ask produced no durable control request within 90s')
      W1 = rC1.targetInstanceId
      log(`C1: ask request ${rC1.requestId} (target=${W1} kind=${rC1.kind})`)

      // The leader's notification turn resolves it through the MODEL-
      // FACING tools (the regression path under test).
      const w1Done = await waitForMock(mock, (r) => r.reply?.kind === 'text' && r.reply?.content === DONE_WORK1, 240_000, 'C1 worker turn')
      if (w1Done === null) await dieFatal(`C1 worker turn did not complete with ${DONE_WORK1} within 240s (requests=${mock.requests.length})`)

      const ledger = readControlLedger()
      const remote = await remoteControlFacts(host)

      // The recorded fact payload is the durable row (the p6t6 state route
      // is root-ANCHOR-scoped and cannot see the ROOT_P team — the remote
      // ledger page is the product read plane).
      const c1Req = remote.byType['control-request-recorded'].find((f) => f.payload.requestId === rC1.requestId)?.payload
      check('C1', 'the member bash ask created a durable leader-approval request with the LEGACY shape (instance subject derived from targetInstanceId; NO executionCoupling field) over the REMOTE ledger page',
        c1Req !== undefined && c1Req.kind === 'leader-approval'
        && c1Req.subject?.kind === 'instance' && c1Req.subject?.instanceId === W1
        && c1Req.executionCoupling === undefined,
        `req=${JSON.stringify(c1Req)}`)
      check('C1', 'the leader resolved allow through the model-facing approval tools (terminal state `decided` — derived from the durable decision fact)',
        derivedStatus(remote, rC1.requestId) === 'decided',
        `status=${derivedStatus(remote, rC1.requestId)}`)
      const c1Decision = remote.byType['control-decision-recorded'].find((f) => f.payload.requestId === rC1.requestId)
      check('C1', 'durable facts over the REMOTE ledger page: control-request-recorded / control-decision-recorded (allow, decider = the LEADER principal — the model-tool path, not a human) / control-allow-consumed each present exactly once for this request',
        remote.byType['control-request-recorded'].filter((f) => f.payload.requestId === rC1.requestId).length === 1
        && c1Decision !== undefined && c1Decision.payload.decision === 'allow'
        && c1Decision.payload.decider?.kind === 'instance'
        && remote.byType['control-decision-recorded'].filter((f) => f.payload.requestId === rC1.requestId).length === 1
        && remote.byType['control-allow-consumed'].filter((f) => f.payload.requestId === rC1.requestId).length === 1,
        `recorded=${remote.byType['control-request-recorded'].length} decisions=${remote.byType['control-decision-recorded'].length} consumptions=${remote.byType['control-allow-consumed'].length} decider=${JSON.stringify(c1Decision?.payload?.decider)}`)
      check('C1', 'the read-only team_domain.json cross-check agrees (the durable ledger is the single source)',
        ledger.error === null
        && ledger.recorded.filter((f) => f.payload.requestId === rC1.requestId).length === 1
        && ledger.decisions.filter((f) => f.payload.requestId === rC1.requestId && f.payload.decision === 'allow').length === 1
        && ledger.consumptions.filter((f) => f.payload.requestId === rC1.requestId).length === 1,
        ledger.error !== null ? `ledger read error: ${ledger.error}` : `recorded=${ledger.recorded.length} decisions=${ledger.decisions.length} consumptions=${ledger.consumptions.length}`)
      check('C1', 'the execution PROCEEDED: the side-effect file exists with the marker (the one-shot allow was consumed by the guard)',
        existsSync(FILE_C1) && readFileSync(FILE_C1, 'utf8').includes(SUM_C1),
        `file=${FILE_C1} exists=${existsSync(FILE_C1)}`)
      finishCriterion('C1')
    }

    // ── C2: remote v4 allow/deny (both paths over the product wire) ────────
    {
      const p2 = await apiPrompt(host.origin, host.cookie, ROOT_P, `${MK_C2L} Delegate the C2 task to w1 (two bash steps) asynchronously.`, 'c2-delegate')
      if (!(p2.status === 200 && p2.body?.result?.ok === true)) {
        await dieFatal(`C2 delegate turn not admitted (status=${p2.status} body=${JSON.stringify(p2.body).slice(0, 300)})`)
      }

      // C2a: the first ask is resolved ALLOW over the REMOTE v4 wire.
      rC2A = await waitForControlRequest(host, (r) => String(r.summary ?? '').includes(SUM_C2A), 120_000, 'C2a ask-lane request')
      if (rC2A === null) await dieFatal('C2a: no durable ask request for the first bash within 120s')
      const resA = await remoteCallReady(host, 'team.resolveControl', {
        teamSessionId: ROOT_P,
        requestId: rC2A.requestId,
        decision: 'allow',
        note: 'prd-c2a remote v4 allow',
      }, `res-c2a`, 4)
      const errA = resultError(resA.body)
      const dataA = resultData(resA.body)
      check('C2', 'remote v4 team.resolveControl ALLOW: the closed v4 success envelope (requestId + decision=allow + host-derived HUMAN decider + scope)',
        errA === null && dataA?.decision?.requestId === rC2A.requestId
        && dataA?.decision?.decision === 'allow'
        && dataA?.decision?.decider?.kind === 'human' && dataA?.decision?.decider?.humanId === ROOT_P
        && dataA?.decision?.scope !== null && typeof dataA?.decision?.scope === 'object',
        `status=${resA.status} err=${JSON.stringify(errA)} data=${jstr(dataA, 400)}`)

      // C2b: the second ask is resolved DENY over the REMOTE v4 wire.
      rC2B = await waitForControlRequest(host, (r) => String(r.summary ?? '').includes(SUM_C2B), 120_000, 'C2b ask-lane request')
      if (rC2B === null) await dieFatal('C2b: no durable ask request for the second bash within 120s')
      const resB = await remoteCallReady(host, 'team.resolveControl', {
        teamSessionId: ROOT_P,
        requestId: rC2B.requestId,
        decision: 'deny',
        note: 'prd-c2b remote v4 deny',
      }, `res-c2b`, 4)
      const errB = resultError(resB.body)
      const dataB = resultData(resB.body)
      check('C2', 'remote v4 team.resolveControl DENY: the closed v4 success envelope (decision=deny + human decider)',
        errB === null && dataB?.decision?.requestId === rC2B.requestId
        && dataB?.decision?.decision === 'deny'
        && dataB?.decision?.decider?.kind === 'human',
        `status=${resB.status} err=${JSON.stringify(errB)} data=${jstr(dataB, 400)}`)

      const w2Done = await waitForMock(mock, (r) => r.reply?.kind === 'text' && r.reply?.content === DONE_WORK2, 240_000, 'C2 worker turn')
      if (w2Done === null) await dieFatal(`C2 worker turn did not complete with ${DONE_WORK2} within 240s (requests=${mock.requests.length})`)

      const remote = await remoteControlFacts(host)

      check('C2', 'terminal states: both requests `decided` after the remote resolutions (derived from the durable decision facts)',
        derivedStatus(remote, rC2A.requestId) === 'decided' && derivedStatus(remote, rC2B.requestId) === 'decided',
        `c2a=${derivedStatus(remote, rC2A.requestId)} c2b=${derivedStatus(remote, rC2B.requestId)}`)
      check('C2', 'the ALLOWED scope EXECUTED (one-shot allow consumed; side-effect file present) and the DENIED scope was BLOCKED (no consumption; side-effect file absent)',
        existsSync(FILE_C2A) && readFileSync(FILE_C2A, 'utf8').includes(SUM_C2A)
        && remote.byType['control-allow-consumed'].filter((f) => f.payload.requestId === rC2A.requestId).length === 1
        && !existsSync(FILE_C2B)
        && remote.byType['control-allow-consumed'].filter((f) => f.payload.requestId === rC2B.requestId).length === 0
        && remote.byType['control-decision-recorded'].filter((f) => f.payload.requestId === rC2B.requestId && f.payload.decision === 'deny').length === 1,
        `c2aFile=${existsSync(FILE_C2A)} c2bFile=${existsSync(FILE_C2B)}`)

      // The guard's post-deny verdict on the wire (the production
      // guardOperation; a BLOCKED probe writes no ledger fact).
      const c2bPayload = remote.byType['control-request-recorded'].find((f) => f.payload.requestId === rC2B.requestId)?.payload ?? {}
      const guardB = await p6t6Control(HOST_PORT, {
        action: 'guard',
        rootSessionId: ROOT_P,
        subject: { kind: 'instance', instanceId: W1 },
        actionName: 'parameter-permission',
        toolName: 'bash',
        correlation: c2bPayload.correlation,
        ...(c2bPayload.operationFingerprint !== undefined ? { operationFingerprint: c2bPayload.operationFingerprint } : {}),
      })
      check('C2', 'guard behavior after the deny: a guarded-lane attempt on the denied scope is blocked with reason `decision-deny` (zero effect — still no side-effect file, no consumption)',
        guardB.status === 200 && guardB.body?.ok === true
        && guardB.body?.value?.allowed === false
        && guardB.body?.value?.reason === 'decision-deny'
        && !existsSync(FILE_C2B),
        `guard=${JSON.stringify(guardB.body).slice(0, 300)}`)
      finishCriterion('C2')
    }

    // ── C3: template-target inline request (create/display/resolve + D.4) ──
    {
      // CREATED via the p6t6 thin route wrapping the production
      // control-service authority (the HONEST-WIRE MAP gap: no product
      // wire creates subject/coupling-bearing requests in this branch).
      const reqC3 = await p6t6Control(HOST_PORT, {
        action: 'request',
        rootSessionId: ROOT_P,
        kind: 'user-approval',
        subject: { kind: 'template', templateId: 'worker' },
        actionName: 'parameter-permission',
        toolName: 'bash',
        correlation: CORR_C3,
        operationFingerprint: FP_C3,
        summary: SUM_C3,
        executionCoupling: 'inline',
      })
      const errC3 = resultError(reqC3.body)
      check('C3', 'the TEMPLATE-subject inline request is created (the instance stale validator does NOT kill it — creation succeeds; subject recorded as kind=template, NO targetInstanceId)',
        reqC3.status === 200 && reqC3.body?.ok === true
        && reqC3.body?.value?.subject?.kind === 'template'
        && reqC3.body?.value?.subject?.templateId === 'worker'
        && reqC3.body?.value?.executionCoupling === 'inline'
        && reqC3.body?.value?.targetInstanceId === undefined
        && reqC3.body?.value?.status === 'pending',
        `status=${reqC3.status} err=${JSON.stringify(errC3)} record=${jstr(reqC3.body?.value, 400)}`)
      if (reqC3.status !== 200 || reqC3.body?.ok !== true) await dieFatal(`C3: inline request creation failed: ${JSON.stringify(reqC3.body).slice(0, 400)}`)
      rC3 = reqC3.body.value

      // DISPLAYED over the remote wire (the ledger page carries the durable
      // row with the subject payload; the pre-decision status is derived).
      const remote1 = await remoteControlFacts(host)
      const c3Fact = remote1.byType['control-request-recorded'].find((f) => f.payload.requestId === rC3.requestId)
      check('C3', 'display over the REMOTE ledger page: the durable control-request-recorded row carries subject={kind:template,templateId:worker} + executionCoupling=inline',
        c3Fact !== undefined
        && c3Fact.payload.subject?.kind === 'template' && c3Fact.payload.subject?.templateId === 'worker'
        && c3Fact.payload.executionCoupling === 'inline',
        `fact=${jstr(c3Fact, 300)}`)
      check('C3', 'display state over the durable facts: the request is `pending` before its resolution (derived status — no decision/abandonment fact yet)',
        derivedStatus(remote1, rC3.requestId) === 'pending',
        `status=${derivedStatus(remote1, rC3.requestId)}`)

      // RESOLVED `allow` over the REMOTE v4 wire (the resolver-role closure
      // admits the human for the user-approval kind).
      const resC3 = await remoteCallReady(host, 'team.resolveControl', {
        teamSessionId: ROOT_P,
        requestId: rC3.requestId,
        decision: 'allow',
        note: 'prd-c3 remote v4 inline allow',
      }, `res-c3`, 4)
      const errC3b = resultError(resC3.body)
      const dataC3 = resultData(resC3.body)
      check('C3', 'remote v4 team.resolveControl ALLOW on the template-subject inline request (the resolve-time instance stale validator skips the template subject — resolution succeeds; scope carries the subject)',
        errC3b === null && dataC3?.decision?.requestId === rC3.requestId
        && dataC3?.decision?.decision === 'allow'
        && dataC3?.decision?.scope?.subject?.kind === 'template',
        `status=${resC3.status} err=${JSON.stringify(errC3b)} scope=${jstr(dataC3?.decision?.scope, 300)}`)

      // D.4 lane disjointness ON THE WIRE:
      //  (a) the inline allow is NEVER consumed by the guard — zero
      //      control-allow-consumed facts for this request;
      //  (b) a GUARDED-lane execution attempt against the inline-allowed
      //      scope is blocked with reason `no-request` (zero
      //      authorization, zero consumption).
      const remote2 = await remoteControlFacts(host)
      const guardC3 = await p6t6Control(HOST_PORT, {
        action: 'guard',
        rootSessionId: ROOT_P,
        subject: { kind: 'template', templateId: 'worker' },
        actionName: 'parameter-permission',
        toolName: 'bash',
        correlation: CORR_C3,
        operationFingerprint: FP_C3,
      })
      check('C3', 'D.4 lane disjointness: the inline allow produced NO control-allow-consumed fact (the inline allow authorizes the frozen invocation only, never the guard lane)',
        remote2.byType['control-allow-consumed'].filter((f) => f.payload.requestId === rC3.requestId).length === 0,
        `consumptionsForC3=${remote2.byType['control-allow-consumed'].filter((f) => f.payload.requestId === rC3.requestId).length}`)
      check('C3', 'D.4 lane disjointness: the guarded-lane attempt against the inline-allowed scope is blocked with reason `no-request` (the template subject survives the guard stale validator — the verdict is no-request, NOT target-stale)',
        guardC3.status === 200 && guardC3.body?.ok === true
        && guardC3.body?.value?.allowed === false
        && guardC3.body?.value?.reason === 'no-request',
        `guard=${JSON.stringify(guardC3.body).slice(0, 300)}`)
      check('C3', 'terminal state: the inline request is `decided` (derived from the durable decision fact — the decision is durable)',
        derivedStatus(remote2, rC3.requestId) === 'decided',
        `status=${derivedStatus(remote2, rC3.requestId)}`)
      finishCriterion('C3')
    }

    // ── C4: disconnect -> durable abandoned, zero effect ───────────────────
    {
      // LEG A — the D.6 criterion (the round-2 fix): the SAME-request
      // coupling-aware cascade over a REAL HTTP wait. The template-
      // subject inline request is created via the p6t6 thin route (the
      // documented gap: no product wire creates subject-bearing
      // requests in this branch), the kit then parks on the PRODUCTION
      // awaitControlDecision over the p6t6 `wait` action (the route
      // wires the bridge's AbortController to the client connection),
      // and ABORTS that HTTP connection — a TRUE client disconnect, not
      // a simulated flag. The cascade runs ENTIRELY in the service: it
      // durably abandons the SAME request FIRST, then settles the
      // (now undeliverable) waiter.
      const reqC4A = await p6t6Control(HOST_PORT, {
        action: 'request',
        rootSessionId: ROOT_P,
        kind: 'user-approval',
        subject: { kind: 'template', templateId: 'worker' },
        actionName: 'parameter-permission',
        toolName: 'bash',
        correlation: CORR_C4A2,
        operationFingerprint: FP_C4A2,
        summary: SUM_C4A2,
        executionCoupling: 'inline',
      })
      const errC4A = resultError(reqC4A.body)
      check('C4', 'leg A: the template-subject INLINE request is created over the p6t6 thin route (pending, coupling inline, template subject)',
        reqC4A.status === 200 && reqC4A.body?.ok === true
        && reqC4A.body?.value?.status === 'pending'
        && reqC4A.body?.value?.executionCoupling === 'inline'
        && reqC4A.body?.value?.subject?.kind === 'template',
        `status=${reqC4A.status} err=${JSON.stringify(errC4A)} record=${jstr(reqC4A.body?.value, 300)}`)
      if (reqC4A.status !== 200 || reqC4A.body?.ok !== true) await dieFatal(`C4: inline cascade request creation failed: ${JSON.stringify(reqC4A.body).slice(0, 400)}`)
      rC4A = reqC4A.body.value

      // The REAL HTTP wait: the p6t6 `wait` action parks on the
      // production awaitControlDecision; no response is sent until the
      // wait settles or the client connection closes. The request is
      // PENDING (no decision can land), so the park is guaranteed —
      // then the kit ABORTS the connection (the true disconnect).
      const c4w = p6t6ControlAbortable(HOST_PORT, {
        action: 'wait',
        rootSessionId: ROOT_P,
        requestId: rC4A.requestId,
      })
      log(`C4: parking the real HTTP wait on ${rC4A.requestId} (p6t6 wait route — the production awaitControlDecision wired to the client connection)`)
      await new Promise((r) => setTimeout(r, 2_500))
      log(`C4: aborting the wait's HTTP connection (TRUE client disconnect)`)
      c4w.abort()
      const waitOutcome = await c4w.promise
      log(`C4: disconnect landed (outcome=${JSON.stringify(waitOutcome).slice(0, 200)})`)

      // Poll the REMOTE ledger page until the cascade's durable abandon
      // fact lands (the server observes the close event, writes the
      // fact, and settles the undeliverable waiter — a fast in-process
      // ledger op; the bounded poll keeps the gate deterministic).
      const remoteA = await waitForControlAbandoned(host, rC4A.requestId, 30_000, 'C4a cascade abandon fact (post-disconnect)')
      const ledgerA = readControlLedger()
      const c4aAbandons = ledgerA.abandonments.filter((f) => f.payload.requestId === rC4A.requestId)
      check('C4', 'the disconnect durably ABANDONED the SAME inline request (the coupling-aware cascade — exactly ONE control-request-abandoned fact, reason wait-aborted)',
        remoteA !== null
        && derivedStatus(remoteA, rC4A.requestId) === 'abandoned'
        && c4aAbandons.length === 1
        && c4aAbandons[0]?.payload?.reason === 'wait-aborted',
        `status=${remoteA === null ? 'wait-timeout' : derivedStatus(remoteA, rC4A.requestId)} abandonFacts=${c4aAbandons.length} reason=${c4aAbandons[0]?.payload?.reason}`)
      check('C4', 'zero execution side effects after the cascade (no decision fact, no consumption fact for the abandoned request)',
        ledgerA.decisions.filter((f) => f.payload.requestId === rC4A.requestId).length === 0
        && ledgerA.consumptions.filter((f) => f.payload.requestId === rC4A.requestId).length === 0,
        `decisions=${ledgerA.decisions.filter((f) => f.payload.requestId === rC4A.requestId).length} consumptions=${ledgerA.consumptions.filter((f) => f.payload.requestId === rC4A.requestId).length}`)
      // The guard over the cascaded scope: blocked with reason
      // `request-abandoned` (zero effect — the blocked probe writes
      // nothing).
      const guardC4A = await p6t6Control(HOST_PORT, {
        action: 'guard',
        rootSessionId: ROOT_P,
        subject: { kind: 'template', templateId: 'worker' },
        actionName: 'parameter-permission',
        toolName: 'bash',
        correlation: CORR_C4A2,
        operationFingerprint: FP_C4A2,
      })
      check('C4', 'guarded-lane attempt on the cascaded-abandoned scope is blocked with reason `request-abandoned` (zero effect, zero consumption)',
        guardC4A.status === 200 && guardC4A.body?.ok === true
        && guardC4A.body?.value?.allowed === false
        && guardC4A.body?.value?.reason === 'request-abandoned',
        `guard=${JSON.stringify(guardC4A.body).slice(0, 300)}`)
      // The late allow over the REMOTE v4 boundary: the typed
      // CONTROL_REQUEST_ABANDONED pass-through (invariant 4b) with ZERO
      // durable side effects.
      const lateAllowC4A = await remoteCallReady(host, 'team.resolveControl', {
        teamSessionId: ROOT_P,
        requestId: rC4A.requestId,
        decision: 'allow',
        note: 'prd-c4a2 late allow after the disconnect cascade',
      }, `res-c4a2-late`, 4)
      const lateErrC4A = resultError(lateAllowC4A.body)
      const ledgerA2 = readControlLedger()
      check('C4', 'the typed CONTROL_REQUEST_ABANDONED passes through the REMOTE v4 boundary UNCHANGED for the late allow on the cascaded request (invariant 4b — no decision fact is written)',
        lateErrC4A?.code === 'CONTROL_REQUEST_ABANDONED'
        && resultData(lateAllowC4A.body) === null
        && ledgerA2.decisions.filter((f) => f.payload.requestId === rC4A.requestId).length === 0,
        `errCode=${lateErrC4A?.code} decisions=${ledgerA2.decisions.filter((f) => f.payload.requestId === rC4A.requestId).length}`)

      // LEG A2 — the LEGACY ask-lane disconnect (the untouched
      // contract, evidenced on the real host): the kit sends the
      // leader's sync-delegation prompt and ABORTS the HTTP request
      // while the member's ask-lane wait is parked. The ask-lane
      // request is coupling-ABSENT (the production ask lane is
      // legacy-shaped), so the cascade does not fire: abort never
      // fabricates an abandon — the durable request stands PENDING for
      // the recovery paths (a4a W2 / a5a S10–S14, pinned at the unit
      // level).
      const c4p = apiPromptAbortable(host.origin, host.cookie, ROOT_P, `${MK_C4L} Delegate the C4 task to w1 SYNCHRONOUSLY.`, 'c4-delegate')
      rC4AL = await waitForControlRequest(host, (r) => String(r.summary ?? '').includes(SUM_C4A), 120_000, 'C4a ask-lane request (pre-disconnect)')
      if (rC4AL === null) await dieFatal('C4: no durable ask request for the sync-delegated bash within 120s')
      log(`C4: ask request ${rC4AL.requestId} parked — aborting the client connection (TRUE disconnect)`)
      c4p.abort()
      let abortOutcome
      try {
        abortOutcome = await c4p.promise
      } catch (error) {
        abortOutcome = { aborted: true, error: String(error?.message ?? error).slice(0, 200) }
      }
      log(`C4: disconnect landed (outcome=${JSON.stringify(abortOutcome).slice(0, 200)})`)

      // Observe whether the host cancels the nested ask-lane wait on the
      // client disconnect (EVIDENCE — the durable assertions below hold
      // under either cascade outcome).
      const w4Done = await waitForMock(mock, (r) => r.reply?.kind === 'text' && r.reply?.content === DONE_WORK4, 45_000, 'C4a worker turn post-disconnect (abort cascade)')
      const c4lDone = await waitForMock(mock, (r) => r.reply?.kind === 'text' && r.reply?.content === DONE_C4L, 10_000, 'C4a leader turn post-disconnect (abort cascade)')
      const disconnectObservation = {
        abortOutcome,
        workerWaitAborted: w4Done !== null,
        leaderTurnSettled: c4lDone !== null,
        note: 'the legacy ask-lane flow never abandons on abort (CONTROL_WAIT_ABORTED -> deny; the durable request stands as pending for the recovery paths)',
      }
      log(`C4: disconnect observation ${JSON.stringify(disconnectObservation)}`)

      const remoteA3 = await remoteControlFacts(host)
      const ledgerA3 = readControlLedger()
      check('C4', 'leg A2: the disconnect left the LEGACY ask-lane request durably PENDING (the untouched contract — abort never fabricates an abandon; no decision, no abandon mark; the request stands for the recovery paths)',
        derivedStatus(remoteA3, rC4AL.requestId) === 'pending'
        && ledgerA3.decisions.filter((f) => f.payload.requestId === rC4AL.requestId).length === 0
        && ledgerA3.abandonments.filter((f) => f.payload.requestId === rC4AL.requestId).length === 0,
        `status=${derivedStatus(remoteA3, rC4AL.requestId)} observation=${JSON.stringify(disconnectObservation)}`)
      check('C4', 'leg A2: zero execution side effects after the disconnect (no consumption, the side-effect file was never written)',
        ledgerA3.consumptions.filter((f) => f.payload.requestId === rC4AL.requestId).length === 0
        && !existsSync(FILE_C4A),
        `c4aFile=${existsSync(FILE_C4A)}`)

      // LEG B — the allow-voiding ABANDON (the production
      // abandonControlRequest authority via the thin test route — no
      // remote abandon endpoint exists in this branch; the same
      // authority PR-E's abort path will call): a request with a
      // PRE-ABANDON durable ALLOW is abandoned; the terminal mark wins
      // over the allow.
      const reqC4B = await p6t6Control(HOST_PORT, {
        action: 'request',
        rootSessionId: ROOT_P,
        kind: 'user-approval',
        subject: { kind: 'instance', instanceId: W1 },
        actionName: 'parameter-permission',
        toolName: 'bash',
        correlation: CORR_C4B,
        operationFingerprint: FP_C4B,
        summary: SUM_C4B,
      })
      const errC4B = resultError(reqC4B.body)
      check('C4', 'the invalidation request is created (instance subject, GUARDED lane — the lane the abandon must void; no executionCoupling field = legacy coupling)',
        reqC4B.status === 200 && reqC4B.body?.ok === true
        && reqC4B.body?.value?.status === 'pending'
        && reqC4B.body?.value?.subject?.kind === 'instance'
        && reqC4B.body?.value?.executionCoupling === undefined,
        `status=${reqC4B.status} err=${JSON.stringify(errC4B)} record=${jstr(reqC4B.body?.value, 300)}`)
      if (reqC4B.status !== 200 || reqC4B.body?.ok !== true) await dieFatal(`C4: invalidation request creation failed: ${JSON.stringify(reqC4B.body).slice(0, 400)}`)
      rC4B = reqC4B.body.value

      const resAllow = await remoteCallReady(host, 'team.resolveControl', {
        teamSessionId: ROOT_P,
        requestId: rC4B.requestId,
        decision: 'allow',
        note: 'prd-c4b pre-abandon durable allow',
      }, `res-c4b`, 4)
      const errAllow = resultError(resAllow.body)
      check('C4', 'the pre-abandon durable ALLOW lands over the REMOTE v4 wire (the allow is committed durably before the abandon; human decider)',
        errAllow === null && resultData(resAllow.body)?.decision?.decision === 'allow'
        && resultData(resAllow.body)?.decision?.decider?.kind === 'human'
        && resultData(resAllow.body)?.decision?.decider?.humanId === ROOT_P,
        `status=${resAllow.status} err=${JSON.stringify(errAllow)}`)

      const ab = await p6t6Control(HOST_PORT, {
        action: 'abandon',
        rootSessionId: ROOT_P,
        requestId: rC4B.requestId,
        reason: 'prd-c4 aborted-work-unit',
      })
      check('C4', 'the ABANDON writes the durable terminal mark {requestId, rootSessionId, abandonedAt, reason} (the control-request-abandoned close fact)',
        ab.status === 200 && ab.body?.ok === true
        && ab.body?.value?.requestId === rC4B.requestId
        && ab.body?.value?.rootSessionId === ROOT_P
        && typeof ab.body?.value?.abandonedAt === 'string' && ab.body.value.abandonedAt.length > 0
        && ab.body?.value?.reason === 'prd-c4 aborted-work-unit',
        `status=${ab.status} value=${jstr(ab.body?.value, 300)}`)

      const ledgerB = readControlLedger()
      check('C4', 'exactly ONE durable control-request-abandoned fact for the request (exactly-once terminal mark)',
        ledgerB.abandonments.filter((f) => f.payload.requestId === rC4B.requestId).length === 1,
        `abandonFacts=${ledgerB.abandonments.filter((f) => f.payload.requestId === rC4B.requestId).length}`)

      // The guard over the ABANDONED scope — blocked with reason
      // `request-abandoned` EVEN OVER the pre-abandon durable allow
      // (allow-voiding; the blocked probe writes nothing — zero effect).
      const guardC4 = await p6t6Control(HOST_PORT, {
        action: 'guard',
        rootSessionId: ROOT_P,
        subject: { kind: 'instance', instanceId: W1 },
        actionName: 'parameter-permission',
        toolName: 'bash',
        correlation: CORR_C4B,
        operationFingerprint: FP_C4B,
      })
      check('C4', 'guarded-lane attempt on the abandoned scope is blocked with reason `request-abandoned` EVEN OVER the pre-abandon durable allow (allow-voiding; zero consumption, zero execution)',
        guardC4.status === 200 && guardC4.body?.ok === true
        && guardC4.body?.value?.allowed === false
        && guardC4.body?.value?.reason === 'request-abandoned'
        && ledgerB.consumptions.filter((f) => f.payload.requestId === rC4B.requestId).length === 0,
        `guard=${JSON.stringify(guardC4.body).slice(0, 300)}`)

      // The typed CONTROL_REQUEST_ABANDONED pass-through over the REMOTE
      // v4 boundary (invariant 4b): a LATE allow on the abandoned request
      // is rejected typed, with ZERO durable side effects (the late allow
      // wrote no decision fact — exactly one decision exists: the
      // pre-abandon one).
      const lateAllow = await remoteCallReady(host, 'team.resolveControl', {
        teamSessionId: ROOT_P,
        requestId: rC4B.requestId,
        decision: 'allow',
        note: 'prd-c4b late allow after abandon',
      }, `res-c4b-late`, 4)
      const lateErr = resultError(lateAllow.body)
      const ledgerC = readControlLedger()
      check('C4', 'the typed CONTROL_REQUEST_ABANDONED passes through the REMOTE v4 boundary UNCHANGED for the late allow (invariant 4b) — zero durable side effects (no second decision fact)',
        lateErr?.code === 'CONTROL_REQUEST_ABANDONED'
        && resultData(lateAllow.body) === null
        && ledgerC.decisions.filter((f) => f.payload.requestId === rC4B.requestId).length === 1,
        `errCode=${lateErr?.code} errMessage=${String(lateErr?.message).slice(0, 200)} decisions=${ledgerC.decisions.filter((f) => f.payload.requestId === rC4B.requestId).length}`)

      // The repeat abandon: typed rejection, NO duplicate fact.
      const ab2 = await p6t6Control(HOST_PORT, {
        action: 'abandon',
        rootSessionId: ROOT_P,
        requestId: rC4B.requestId,
        reason: 'prd-c4b repeat abandon probe',
      })
      const ledgerD = readControlLedger()
      check('C4', 'the REPEAT abandon is rejected typed (CONTROL_REQUEST_ABANDONED) with NO duplicate durable fact (exactly-once)',
        ab2.status === 409 && ab2.body?.ok === false && ab2.body?.code === 'CONTROL_REQUEST_ABANDONED'
        && ledgerD.abandonments.filter((f) => f.payload.requestId === rC4B.requestId).length === 1,
        `status=${ab2.status} code=${ab2.body?.code} abandonFacts=${ledgerD.abandonments.filter((f) => f.payload.requestId === rC4B.requestId).length}`)

      const remoteB = await remoteControlFacts(host)
      const c4AbandonFact = remoteB.byType['control-request-abandoned'].find((f) => f.payload.requestId === rC4B.requestId)
      check('C4', 'the durable read plane shows status `abandoned` (the terminal mark wins over the pre-abandon decision) + the control-request-abandoned fact {requestId, rootSessionId, abandonedAt}',
        derivedStatus(remoteB, rC4B.requestId) === 'abandoned'
        && c4AbandonFact !== undefined
        && c4AbandonFact.payload.rootSessionId === ROOT_P
        && typeof c4AbandonFact.payload.abandonedAt === 'string',
        `status=${derivedStatus(remoteB, rC4B.requestId)} abandon=${jstr(c4AbandonFact?.payload, 300)}`)
      finishCriterion('C4')
    }

    // ── C5: restart (same DSH_HOME) reads abandoned/history ────────────────
    {
      await stopHost(host)
      const portFreeAfterKill = await waitForPortFree(HOST_PORT, 15_000)
      log(`C5: host killed; port ${HOST_PORT} free=${portFreeAfterKill}`)

      host2 = await bootHost({ label: 'HOST2-RESUME', port: HOST_PORT, boot: 2, phase: 'resume' })
      EVID.hostLogs.push({ bootNum: 2, phase: 'resume', port: HOST_PORT, logPath: host2.logPath })
      const st2 = await p6t6StateReady(HOST_PORT, { rootSessionId: ROOT, phase: 'resume' })
      log(`HOST2: resumed state ready (phase=resume)`)
      writeFileSync(join(RUN_DIR, 'host2-boot-state.json'), JSON.stringify(st2.body, null, 2))

      // The REMOTE ledger page: the FULL durable control history survived.
      // (All C5 control reads ride the remote endpoints — the p6t6 state
      // route is root-ANCHOR-scoped and cannot see the ROOT_P team.)
      const remote = await remoteControlFacts(host2)

      check('C5', 'after the restart, the REMOTE ledger page carries the FULL control history: 7 recorded / 5 decided / 2 consumed / 2 abandoned (every durable fact intact)',
        remote.byType['control-request-recorded'].length === 7
        && remote.byType['control-decision-recorded'].length === 5
        && remote.byType['control-allow-consumed'].length === 2
        && remote.byType['control-request-abandoned'].length === 2,
        `recorded=${remote.byType['control-request-recorded'].length} decided=${remote.byType['control-decision-recorded'].length} consumed=${remote.byType['control-allow-consumed'].length} abandoned=${remote.byType['control-request-abandoned'].length} total=${remote.totalEntries}`)

      const s5 = {
        c1: derivedStatus(remote, rC1?.requestId),
        c2a: derivedStatus(remote, rC2A?.requestId),
        c2b: derivedStatus(remote, rC2B?.requestId),
        c3: derivedStatus(remote, rC3?.requestId),
        c4a: derivedStatus(remote, rC4A?.requestId),
        c4al: derivedStatus(remote, rC4AL?.requestId),
        c4b: derivedStatus(remote, rC4B?.requestId),
      }
      check('C5', 'the DERIVED request statuses after restart (from the full durable history over the REMOTE endpoints): C1/C2a/C2b/C3 `decided`, C4a `abandoned` (the SAME-request cascade durably closed it — the abandon history is intact), C4a-legacy `pending` (the ask-lane disconnect never decided it — the pending history is intact), C4b `abandoned` (the terminal mark wins over its pre-abandon decision)',
        s5.c1 === 'decided' && s5.c2a === 'decided' && s5.c2b === 'decided' && s5.c3 === 'decided' && s5.c4a === 'abandoned' && s5.c4al === 'pending' && s5.c4b === 'abandoned',
        `statuses=${JSON.stringify(s5)}`)
      const c5abA = remote.byType['control-request-abandoned'].find((f) => f.payload.requestId === rC4A?.requestId)
      const c5abB = remote.byType['control-request-abandoned'].find((f) => f.payload.requestId === rC4B?.requestId)
      check('C5', 'the REMOTE endpoint history returns BOTH abandonments after restart: the C4a cascade fact {requestId, rootSessionId, abandonedAt, reason: wait-aborted} and the C4b explicit fact {requestId, rootSessionId, abandonedAt} are durable and readable (exactly two, one per request)',
        c5abA !== undefined && c5abA.payload.rootSessionId === ROOT_P && typeof c5abA.payload.abandonedAt === 'string'
        && c5abA.payload.reason === 'wait-aborted'
        && c5abB !== undefined && c5abB.payload.rootSessionId === ROOT_P && typeof c5abB.payload.abandonedAt === 'string'
        && remote.byType['control-request-abandoned'].length === 2,
        `abandonments=${JSON.stringify(remote.byType['control-request-abandoned']).slice(0, 400)}`)
      const late5 = await remoteCallReady(host2, 'team.resolveControl', {
        teamSessionId: ROOT_P,
        requestId: rC4B.requestId,
        decision: 'allow',
        note: 'prd-c5 post-restart late allow',
      }, `res-c5-late`, 4)
      const lateErr5 = resultError(late5.body)
      check('C5', 'the abandoned request CANNOT be re-decided after the restart (a late allow over the REMOTE v4 wire is still rejected typed — the terminal mark is durable across the host restart)',
        lateErr5?.code === 'CONTROL_REQUEST_ABANDONED' && resultData(late5.body) === null,
        `errCode=${lateErr5?.code} errMessage=${String(lateErr5?.message).slice(0, 200)}`)
      finishCriterion('C5')
    }


    // ── H1 / H2 ─────────────────────────────────────────────────────────────
    await stopHost(host2)
    host2 = null

    for (const u of STABLE_URLS) stableAfter[u] = await probeStableInstance(u)
    const stableSame = STABLE_URLS.every((u) => JSON.stringify(stableBefore[u]) === JSON.stringify(stableAfter[u]))
    mkdirSync(join(RUN_DIR, 'git-post'), { recursive: true })
    testUsePost = await captureGitState(TESTUSE, join(RUN_DIR, 'git-post'))
    writeFileSync(join(RUN_DIR, 'testuse-post.json'), JSON.stringify(testUsePost, null, 2))

    check('H1', 'test-use repo: HEAD == baseline + porcelain empty BEFORE the run',
      testUsePre.head === HOST_BASELINE_SHA && testUsePre.statusEmpty === true && testUsePre.diffEmpty === true,
      `pre: head=${testUsePre.head} statusEmpty=${testUsePre.statusEmpty} diffEmpty=${testUsePre.diffEmpty}`)
    check('H1', 'test-use repo: HEAD == baseline + porcelain empty AFTER the run (the kit touched the host source tree not at all)',
      testUsePost.head === HOST_BASELINE_SHA && testUsePost.statusEmpty === true && testUsePost.diffEmpty === true,
      `post: head=${testUsePost.head} statusEmpty=${testUsePost.statusEmpty} diffEmpty=${testUsePost.diffEmpty}`)
    check('H1', 'the stable instances :3080/:3180 are zero-touch: read-only GET probes pre == post (the kit sent no write/control to them)',
      stableSame,
      `before=${JSON.stringify(stableBefore)} after=${JSON.stringify(stableAfter)}`)
    finishCriterion('H1')

    const hostFree = await waitForPortFree(HOST_PORT, 15_000)
    const mockFree = await (async () => {
      await mock.close()
      return waitForPortFree(MOCK_PORT, 15_000)
    })()
    check('H2', 'every allocated port is released after teardown (host + mock)',
      hostFree === true && mockFree === true,
      `hostPort=${HOST_PORT} free=${hostFree} mockPort=${MOCK_PORT} free=${mockFree}`)
    finishCriterion('H2')
  } catch (error) {
    const detail = String(error?.stack ?? error)
    log(`ERROR ${detail}`)
    await dieFatal(`unhandled error: ${String(error?.message ?? error)}\n--- host log tail ---\n${host !== null ? logTail(host.logPath, 25) : '<no host>'}`)
  } finally {
    await sweepLiveHosts().catch(() => { /* best-effort */ })
    try { await mock.close() } catch { /* already closed */ }

    // Evidence: copy the instance logs + scrub every text file (tokens).
    try {
      for (const h of EVID.hostLogs) {
        const dest = join(RUN_DIR, `host${h.bootNum}-${h.phase}-port${h.port}.log`)
        try { writeFileSync(dest, readFileSync(h.logPath, 'utf8')) } catch (e) { EVID.hostLogs[EVID.hostLogs.indexOf(h)].error = String(e.message) }
      }
      try {
        writeFileSync(join(RUN_DIR, 'mock.log'), mock.requestLogText?.() ?? JSON.stringify(mock.requests, null, 2))
      } catch { /* best-effort */ }
    } catch { /* best-effort */ }
    try { writeFileSync(join(RUN_DIR, 'api-transcript.json'), JSON.stringify(TRANSCRIPT, null, 2)) } catch { /* best-effort */ }

    // World cleanup (unless --keep).
    let worldCleaned = false
    if (!FLAG_KEEP) {
      try {
        rmSync(HOME, { recursive: true, force: true })
        try { rmSync(LOCK_FILE, { force: true }) } catch { /* ok */ }
        cleanupSideEffectDir()
        worldCleaned = !existsSync(HOME)
      } catch { /* best-effort */ }
    }
    scrubDir(RUN_DIR)

    const criteria = Object.values(results)
    const pass = criteria.every((c) => c.pass === true)
    const exitCode = pass ? 0 : 2
    const summary = {
      kit: 'pr-d-control-real-host',
      stamp: RUN_STAMP,
      world: `tests/homes/${RUN_STAMP}`,
      worldPath: HOME,
      worldCleaned,
      worktree: WORKTREE,
      hostTree: TESTUSE,
      hostBaselineSha: HOST_BASELINE_SHA,
      clientCommitHash: CLIENT_COMMIT_HASH,
      testUse: {
        tree: TESTUSE,
        clean: testUsePost?.statusEmpty === true && testUsePost?.diffEmpty === true && testUsePost?.head === HOST_BASELINE_SHA,
        head: testUsePost?.head ?? null,
        detail: testUsePost !== undefined
          ? `statusEmpty=${testUsePost.statusEmpty} diffEmpty=${testUsePost.diffEmpty} head=${testUsePost.head}`
          : 'not captured',
      },
      ports: { hostPort: HOST_PORT, mockPort: MOCK_PORT },
      stable: { before: stableBefore, after: stableAfter },
      criteria: criteria.map((c) => ({ ...c, wireNote: WIRE_NOTES[c.id] })),
      wireGap: 'No product wire in this branch creates template-subject inline requests or abandons requests (the remote catalog has only team.resolveControl v4 for control). C3/C4 creation/abandon/guard/wait ride the p6t6 test-only thin route wrapping the SINGLE production control-service authority; every DECISION and the typed CONTROL_REQUEST_ABANDONED pass-through ride the REMOTE v4 product wire. The C4 leg A disconnect is a TRUE in-flight HTTP abort of the REAL wait route (the production awaitControlDecision wired to the client connection), and the SAME-request cascade outcome (the durable abandon fact, reason wait-aborted) is asserted over the durable read plane; leg A2 evidences that the LEGACY ask-lane disconnect still leaves its request PENDING (the untouched contract).',
      instanceLogs: EVID.hostLogs.map((h) => ({ bootNum: h.bootNum, phase: h.phase, port: h.port })),
      fatal: null,
      exitCode,
      pass,
    }
    try {
      writeFileSync(join(RUN_DIR, 'summary.json'), JSON.stringify(summary, null, 2))
    } catch { /* best-effort */ }
    log(`GATE RESULT: ${pass ? 'PASS' : 'FAIL'} (exitCode=${exitCode}) — evidence: ${RUN_DIR}`)
    process.exitCode = exitCode
  }
}

main().catch((error) => {
  // A thrown fatal (dieFatal) already exited; this is the last resort.
  console.error(`prd-control-real-host: uncaught ${String(error?.stack ?? error)}`)
  process.exitCode = 1
})
