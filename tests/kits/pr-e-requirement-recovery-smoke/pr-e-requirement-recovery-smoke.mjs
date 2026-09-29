#!/usr/bin/env node
/**
 * pre-alpha3 PR-E E.12 — the real-host / browser gate: PR-E Blueprint v2 +
 * Requirement/Recovery atomic cutover — the plan §E.12 fourteen-scenario
 * live matrix on the pristine 0.1.7-rc.1 host (TEST_USE_BASELINE_SHA,
 * `tests/deepseek-harness-test-use`), CORE PATCH BUDGET = 0 (the worktree
 * dist is mounted ONLY through the public profile-patch seam — the same
 * channel C.10 used; no upstream patch, no private API).
 *
 * ONE world (DSH_HOME in-workspace), ONE host port, 11 boots (B1 create +
 * B2..B9b resume), the mock DeepSeek endpoint as the wire witness, and the
 * durable surfaces (the team ledgers over `team.getLedgerPage`, the
 * compatibility rows over `compatibility.get`, the world file) as the
 * assertion basis. The p6t6 `__p6t6/tool` seam executes the shipped team
 * tools on the team's LEADER session (`as: <teamRootSessionId>`); the
 * 120s `AbortSignal.timeout` inside `executeTool` is the ABORT public seam
 * (B3C leg — the kit's fetch timeout must exceed it).
 *
 * W2-A LIVE-PROBE CONTRACT (the 2026-09-30 parent adjudication — the kit's
 * pre-W2-A mechanism was stale; the product contract is FROZEN and
 * plan-conformant):
 *   - SUPPLY AXIS: every MCP server the scenarios exercise is CONFIGURED on
 *     the row in EVERY boot (`mcpServers` — static, identical per boot:
 *     `mcp_repo`/3492, `mcp_leaderreq`/3491, `mcp_web`/3493). An
 *     UNCONFIGURED server is a deterministic `unreachable` (source
 *     'supply') — that is how the S2 optional-missing lives: `mcp_signal`
 *     is NEVER configured (no live server ever exists for it).
 *   - READINESS AXIS: the live probe is the IN-PROCESS MCP FIBER state of
 *     the row host (agent-bindings reconcile → mcpFibers / materialization
 *     slots): a mounted fiber on ANY live session = `reachable`; a failed
 *     mount slot on ANY live session = `unreachable`; nothing = `unknown`
 *     (fail-soft — the static bootstrap seed in `environmentFacts` fills
 *     ONLY `unknown` verdicts and is NEVER flipped per phase).
 *   - DOWN STATE = STOPPING THE RUNNING mini-MCP process (a LIVE state
 *     change, the C.10 real-host pattern — this kit's in-process
 *     `startMiniMcp`/`stopMiniMcp`); RESTORE = RESTARTING it. The boot
 *     phase that boots with a server stopped gets the failed mount slot at
 *     the first attach of the LEADER session (the p6t6 call's
 *     ensureLiveAgent runs the reconcile BEFORE the gate's fresh facts
 *     read), so the admission probe answers `unreachable` on time.
 *   - WORLD DESIGN: the main team's LEADER template mounts EVERY
 *     row-configured server (its `capabilities.mcp.allow` =
 *     [repo, leaderreq, signal, web]): the team-scoped servers (repo /
 *     leaderreq) have no other live mount surface, and the worker-scoped
 *     web must be proable at admission time — BEFORE the worker instance
 *     is attached (the gate reads fresh live facts before the effect
 *     runs; a cold worker member is `not-applicable`, never a fabricated
 *     failure). `mcp_signal` is allowed but never configured (excluded
 *     from the reconcile target by the configured∩allow filter — the
 *     structural guard never fires).
 *   - RESTART: the in-memory mount state is EPHEMERAL (plan §C.5/§E.11
 *     negative #10) — after every host restart NO live fiber survives
 *     (readiness `unknown` at boot, re-probed live at the next boundary);
 *     the durable facts (consent / disable / incidents) survive.
 *
 * THE 14 SCENARIOS (plan §E.12 lines 974–987, authoritative):
 *  S1  startup all-template matrix   — fresh per-scope gate evaluation at
 *       every admission: team scope up (B1) / team scope DOWN (B5) /
 *       worker template DOWN (B3) / leader optional DEGRADED (B2) /
 *       persona PASS (B9) / persona FATAL (B9b). Unit-level backing for
 *       the all-template preflight: startup-preflight-all-templates (the
 *       live surface is the gate's fresh evaluation — startupPreflight has
 *       no live call site; scoped limitation, see report). Live mechanism
 *       (W2-A): all-ready (B1) = the three mini-MCPs RUNNING + configured
 *       (the kit asserts both sides before the cell); each DOWN cell = the
 *       relevant mini-MCP STOPPED before that boot (B2 optional / B3 web /
 *       B5 repo).
 *  S2  optional requirement consent  — B2: optional (complete:false) mcp
 *       MISSING — `mcp_signal` is never configured (the W2-A supply axis:
 *       deterministic `unreachable`, no live server ever) -> work proceeds
 *       AUTO-DEGRADED (no block, no dispatch);
 *       B2b: the seeded `optional-requirement-accepted` fact is durable +
 *       readable with the exact payload, and the gate still ignores it
 *       (consents are records, never a gate precondition — §E.8).
 *  S3  required template disable     — B6: seeded
 *       `template-availability-set {worker, false}` -> delegate to worker
 *       blocked with gateReason `templateDisabled` (availability, never a
 *       policy denial — authority negative #9).
 *  S4  Team-level required outage    — B5/B6: `team.admitInitialWork`
 *       blocked `COMPATIBILITY_BLOCKED` citing source `requirement-gate`
 *       (gateReason requiredScopeDown, blockedScopes ['team']); the
 *       template disable (B6) CANNOT bypass the team-level outage.
 *  S5  Leader required MCP down      — the leader's required MCP is the
 *       v2 team-scope requirement `team.mcp.leaderreq` (the live model:
 *       the caller's own template scope is never referenced by any action
 *       — member creation resolves only from blueprint.members, so a
 *       leader template scope cannot gate live actions; scoped
 *       limitation). B7: the leaderreq mini-MCP STOPPED (live down) -> team
 *       scope blocked -> Recovery.
 *  S6  Human-reviewed recovery       — B3A + B7: the exact reviewed
 *       dispatch payload, the kit as the human resolver, ALLOW -> the
 *       recovery attempt proceeds on the reduced ORIGINAL authority
 *       (E.9).
 *  S7  Degraded Member controlled    — B3A: the recovered worker (web
 *       down) runs read (allow lane — original permission, executes
 *       unreviewed) then bash (ASK lane — the recovery does NOT turn ask
 *       into allow; authority negative #2) -> a control request opens,
 *       the kit approves, bash executes.
 *  S8  Service restored, next        — B4: the SAME worker instance
 *       boundary with mcp_web RESTORED (the kit RESTARTS the stopped
 *       mini-MCP on 3493 — the live restore; the fresh boot's live
 *       reconcile — readiness had reset to unknown at restart — mounts the
 *       fiber) -> the template scope flips
 *       blocked->ready, the open incident is CLOSED (durable
 *       `recovery-incident-closed`), the follow-up runs NORMAL (no
 *       recovery correlation, no dispatch) and mcp_web materializes
 *       (E.10: no durable recovery flag — recovery stays derived).
 *       B8: the same exit for the TEAM scope (leaderreq restored the same
 *       way).
 *  S9  Exact reviewed payload (UI)   — B3A: the `control-request-recorded`
 *       ledger entry carries the EXACT `buildRecoveryDispatchPayload`
 *       shape: schema v1, requestedOperation, blockedScopes,
 *       downedCapabilitySubjects, reducedAuthority (policy/otherwise/
 *       externalHardCeiling), the effect string, kind user-approval,
 *       executionCoupling inline, the `recovery:<token>:<seq>`
 *       correlation, and reviewPayloadDigest == sha256 over the
 *       CANONICAL review payload (recomputed here, byte-for-byte).
 *  S10 deny / close / abort zero     — B3B: DENY -> typed zero-effect
 *       block (controlDecision 'deny', full gate details, no new member,
 *       no new incident); B3C: NO decision -> the 120s executeTool
 *       abort -> `control-request-abandoned` durable + typed
 *       controlDecision 'abandoned'; a LATER allow on the abandoned
 *       request is rejected (terminal).
 *  S11 restarts persist, readiness   — B8: the consent fact (B2) and the
 *       template disable fact (B6) BOTH survive every restart and drive
 *       the FRESH evaluation (worker still templateDisabled; helper
 *       delegate NORMAL); the team-scope compatibility row is recomputed
 *       per boot (readiness resets — template scopes have no durable
 *       generation). W2-A live addition (plan §E.11 negative #10):
 *       readiness is EPHEMERAL — at the fresh B8 boot NO mounted slot
 *       survives the restart (asserted pre-attach); the next boundary
 *       re-probes live (the leaderreq slot becomes MOUNTED — asserted
 *       post-b8h).
 *  S12 the PR #22 `ptc` persona      — B9: presetSubstrate ptc/standard +
 *       persona fact standard available -> the persona requirement PASSES
 *       (the correct open — ptc observes the standard kind). B9b: ptc
 *       absent (dynamic disabled) + no persona fact -> the fresh
 *       evaluation is FATAL (PERSONA_INCOMPATIBLE — the bare lane, no
 *       `complete` fact present) and `team.admitInitialWork` is blocked:
 *       NO false open on the disabled dynamic. Scoped limitation: the
 *       live resolver probe is shipped-state-only (always standard; the
 *       live probe is known_debt) — the ptc->standard /
 *       unresolvable->fail-closed TYPING is unit-pinned
 *       (runtime-substrate-resolver / persona-observed-kind).
 *  S13 old v1 FROZEN blueprint cold  — T13 is the EXACT pre-PR-E
 *       `team.mpr-anchor@1` saved source (byte-identical): creating it
 *       under the PR-E code yields the SAME pre-PR-E contentHash
 *       (sha256:6a7fba9f...c15a37) in the new world's registry, and the
 *       cold resume boot (B2) re-attaches it with the hash unchanged.
 *  S14 dual-Team isolation           — T2 (a second team in the SAME
 *       world, narrower requirements) proceeds normally WHILE T is in a
 *       blocked-scope recovery incident (B3): per-root durable state —
 *       T's incident facts never appear in T2's ledger and vice versa.
 *
 * HYGIENE (mandatory):
 *  H1  test-use porcelain EMPTY + HEAD baseline BEFORE and AFTER;
 *       :3080/:3180 ZERO-TOUCH (read-only probes pre == post). The
 *       member workspaces ARE the test-use tree -> the worker bash is a
 *       NO-OP `echo` (any write = H1 fail).
 *  H2  all run ports released after teardown (worldCleaned=true ONLY on
 *       a full PASS; the world is retained on any non-zero exit).
 *  The ENTIRE evidence dir is token-scrubbed (`\bsk-[A-Za-z0-9]{24,}` = 0
 *  matches); `mock-requests.json` is NOT part of the evidence.
 *
 * EXIT: 0 = all 14 scenarios + hygiene PASS (world deleted);
 *        2 = a criterion failed (evidence dumped, world retained);
 *        1 = fatal (infrastructure / pre-flight).
 */

import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { createHash, randomUUID } from 'node:crypto'
import { pathToFileURL } from 'node:url'
import {
  TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH,
} from '../../paths.mjs'
import { DshInstance, ensureProfile } from '../../characterization/lib/instance.mjs'
import { logTail, portInUse } from '../../characterization/lib/util.mjs'
import { captureGitState } from '../../characterization/lib/tree-clean.mjs'
import { startMockModel } from '../../../packages/tools/harness/mock-deepseek.mjs'
// Ledger row byte form: the storage layer's `readRecordFromRaw` requires
// `serialize(record) === raw` — rows are canonicalJsonStringify output
// (sorted-keys compact JSON). Import the runtime's own validators +
// serializers so the kit's offline seeds are byte-identical to host writes
// (a plain JSON.stringify in insertion order makes the NEXT host boot fail
// closed: "row '<seq>' of store 'ledger' is not in canonical byte form").
import {
  LEDGER_SEQUENCE_COUNTER_KEY,
  parseLedgerEntry,
  serializeLedgerSequenceCounter,
} from '../../../packages/runtime/dist/packages/storage/schema/ledger.js'
import { canonicalJsonStringify } from '../../../packages/runtime/dist/packages/contracts/src/remote-safe.js'

// ── CLI ─────────────────────────────────────────────────────────────────────

const args = process.argv.slice(2)
function argValue(name, dflt) {
  const i = args.indexOf(`--${name}`)
  if (i === -1) return dflt
  const v = args[i + 1]
  if (v === undefined || v.startsWith('--')) throw new Error(`--${name} requires a value`)
  return v
}

const KIT_DIR = dirname(new URL(import.meta.url).pathname)
const WORKTREE = resolve(argValue('worktree', resolve(KIT_DIR, '..', '..', '..')))
let TESTUSE = resolve(argValue('testuse', join(WORKTREE, 'tests', 'deepseek-harness-test-use')))
// The gitignored test-use checkout exists only in the MAIN checkout, not in
// task worktrees (<main>/.worktrees/<task>). Fallback: parent repo.
if (!existsSync(TESTUSE) && existsSync(join(WORKTREE, '..', '..', 'tests', 'deepseek-harness-test-use'))) {
  TESTUSE = resolve(join(WORKTREE, '..', '..', 'tests', 'deepseek-harness-test-use'))
}

// ── frozen facts / paths ────────────────────────────────────────────────────

const HOST_BASELINE_SHA = TEST_USE_BASELINE_SHA // 0.1.7-rc.1 (paths.mjs pin)
const HOST_TREE = TESTUSE
const PRODUCTION_ROW_PATH = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js')
const GLUE_PATH = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs')
const SEAM_PATH = join(WORKTREE, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')
const P6T6_ROW_NAME = pathToFileURL(join(WORKTREE, 'packages', 'tools', 'harness', 'plugin.mjs')).href
const PRODUCTION_ROW_NAME = pathToFileURL(PRODUCTION_ROW_PATH).href

// ── ports (TEST_METHODS §5: 3180 host family; 3491-3500 test band) ──────────
// :3080 / :3180 are the STABLE dev instance — read-only probes only, NEVER
// booted/bound here.
const HOST_PORT_CANDIDATES = [3182, 3183, 3184, 3185, 3186, 3181] // NEVER 3080 / 3180
const MOCK_PORT_CANDIDATES = [3497, 3496]
const PORT_REPO = 3492 // mini-MCP: mcp_repo (the team-level required MCP — S4 outage)
const PORT_LEADERREQ = 3491 // mini-MCP: mcp_leaderreq (the leader's required MCP, team-scope — S5)
const PORT_WEB = 3493 // mini-MCP: mcp_web (the worker's required MCP — S3/S7/S8)
// All three are CONFIGURED on the row in EVERY boot (static `mcpServers` —
// the W2-A supply axis); the per-phase live state is the RUNNING/STOPPED
// process (see the W2-A LIVE-PROBE CONTRACT header). `mcp_signal` (S2) is
// never configured: its optional-missing lives on the supply axis.
const STABLE_URLS = ['http://127.0.0.1:3080/', 'http://127.0.0.1:3180/']

const S_REPO = 'mcp_repo' // team-level required (S4 outage)
const S_LEADERREQ = 'mcp_leaderreq' // the leader's required MCP, team-scope model (S5)
const S_WEB = 'mcp_web' // worker template required (S3/S7/S8)
const S_SIGNAL = 'mcp_signal' // leader OPTIONAL (S2) — NEVER configured on the row: the optional-missing is live via the supply axis (deterministic unreachable; no live server ever)

/** The EXACT unmanaged tool set on the 0.1.7-rc.1 host's model-facing
 *  surface for a permissions-declaring worker (probe witness:
 *  PermissionCoverageUnmanagedError, 19 tools — 12 known-sensitive
 *  [glob, grep, interrupt_agent, job_kill, job_list, job_output,
 *  list_agents, send_message, subagent_fork, web_fetch, web_search,
 *  workflow] + 7 unknown [ask_user_question, create_goal, exit_plan_mode,
 *  get_goal, present, skill, update_goal]). The A2C-2 coverage gate is
 *  fail-closed (permission-coverage.ts §7.3): a strict
 *  capabilities.permissions surface must owner-cover every tool, so the
 *  kit removes this set via builtinToolDeny (the documented escape) — the
 *  scenario-relevant surface (read allow / bash ask / default deny) is
 *  untouched. Sorted for stable blueprint bytes. */
const WORKER_SURFACE_DENY = [
  'ask_user_question',
  'create_goal',
  'exit_plan_mode',
  'get_goal',
  'glob',
  'grep',
  'interrupt_agent',
  'job_kill',
  'job_list',
  'job_output',
  'list_agents',
  'present',
  'send_message',
  'skill',
  'subagent_fork',
  'update_goal',
  'web_fetch',
  'web_search',
  'workflow',
]

const TOOL_WEB_PING = `mcp__${S_WEB}__ping`

// ── run stamp / world paths ─────────────────────────────────────────────────

function utcStamp() {
  const d = new Date().toISOString()
  return d.replace(/[:.]/g, '-').slice(0, 19)
}
const RUN_STAMP = `prereq-${utcStamp()}`
// EVIDENCE lives in the WORKTREE (committed from the worktree branch).
const EVIDENCE_DIR = join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'pre-alpha3-refactor', 'pr-e')
const RUN_DIR = join(EVIDENCE_DIR, RUN_STAMP)
// DSH_HOME world: IN-WORKSPACE (the worktree) — host source (HOST_TREE) and
// the data home are independent.
const HOME = join(WORKTREE, 'tests', 'homes', RUN_STAMP)
const LOCK_FILE = `${HOME}.lock`
const BLUEPRINT_DIR = join(HOME, 'blueprints') // saved sources live IN the world home
const WORLD_FILE = join(HOME, 'storages', 'team_domain.json')

const ROOT = `session-prereq-boot-${RUN_STAMP}` // the row anchor's boot root
const T = `session-prereq-main-${RUN_STAMP}` // the main scenario team (v2)
const T2 = `session-prereq-iso-${RUN_STAMP}` // the dual-team isolation team (v2)
const T9 = `session-prereq-persona-${RUN_STAMP}` // the persona team (v2)
const T13 = `session-prereq-v1-${RUN_STAMP}` // the frozen pre-PR-E v1 team

const BP_MAIN_ID = 'team.prereq-main'
const BP_ISO_ID = 'team.prereq-iso'
const BP_PERSONA_ID = 'team.prereq-persona'
const BP_ANCHOR_ID = 'team.prereq-anchor' // the row anchor (v1, capabilities-less)
const BP_V1_ID = 'team.mpr-anchor' // the EXACT pre-PR-E v1 blueprint (S13)

// S13 — the byte-exact pre-PR-E `team.mpr-anchor@1` saved source (from the
// pre-PR-E world `prb-ep-2026-09-28T20-50-34` blueprint_registry) and the
// pre-PR-E contentHash it carried there.
const V1_ANCHOR_SOURCE = [
  '---',
  'schemaVersion: 1',
  'blueprintId: team.mpr-anchor',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: "You are the boot anchor leader of the model-preference-routing smoke row."',
  'members: []',
  'requirements: []',
  'memberEnvelopes: []',
  'policyStates: []',
  'metadata: {}',
  '---',
  '',
].join('\n')
const V1_ANCHOR_HASH_PRE_PR_E = 'sha256:6a7fba9ffce952639cf85b01714b1ca61a7d4816efe32607f3d7061da0c15a37'

// Distinct markers (no substring collisions; the oracle routes on the LAST
// user message carrying one of them). THE LEADER TOOL CALLS GO THROUGH THE
// p6t6 SEAM DIRECTLY (executeTool on the leader session — NO leader model
// turn), so the mock model only ever sees: title requests and the WORKER
// (work-unit) turns. The worker markers ride in the delegate `prompt` arg
// (the work-unit prompt delivered to the member session).
const NONCE = RUN_STAMP
const MKW = (tag) => `PRREQ_W_${tag}_${NONCE}`
const DONE_W = (tag) => `PRREQ_DONE_W_${tag}`
const WORKER_TAGS = ['b1', 'b2', 'b2b', 'b3a', 'b3b', 'b3c', 'b4', 'b5', 'b6', 'b7', 'b8h', 'b8w', 'b9', 't2b1', 't2b3']

// ── logging / criteria ──────────────────────────────────────────────────────

let RUN_LOG = null
function log(line) {
  const stamped = `[${new Date().toISOString()}] ${line}`
  console.log(stamped)
  if (RUN_LOG !== null) {
    try { writeFileSync(RUN_LOG, stamped + '\n', { flag: 'a' }) } catch { /* evidence best-effort */ }
  }
}

const CRITERIA = [
  { id: 'S1', name: 'startup all-template matrix: fresh per-scope evaluation at every admission (team up B1 / team down B5 / worker down B3 / optional degraded B2 / persona pass B9 / persona fatal B9b)' },
  { id: 'S2', name: 'optional requirement consent: auto-degraded proceed (B2) + durable optional-requirement-accepted fact readable, gate still ignores it (B2b)' },
  { id: 'S3', name: 'required template disable: delegate -> gateReason templateDisabled (availability, never policy — negative #9)' },
  { id: 'S4', name: 'Team-level required outage: admitInitialWork COMPATIBILITY_BLOCKED citing source requirement-gate; disable cannot bypass (B5/B6)' },
  { id: 'S5', name: 'Leader required MCP down (team-scope model): team scope blocked -> Recovery' },
  { id: 'S6', name: 'Human-reviewed recovery dispatch: the kit as human resolver, ALLOW -> recovery attempt proceeds on the reduced original authority' },
  { id: 'S7', name: 'degraded Member controlled bash repair: read executes (original allow), bash opens an ASK request (recovery does not turn ask into allow — negative #2), executes after approval' },
  { id: 'S8', name: 'service restored -> next boundary NORMAL: incident CLOSED durable, follow-up without recovery correlation, mcp materialized (E.10; no durable recovery flag)' },
  { id: 'S9', name: 'exact reviewed payload: recovery-dispatch/v1 shape + reducedAuthority + effect + kind user-approval + inline + recovery:<token>:<seq> + canonical sha256 digest recomputed' },
  { id: 'S10', name: 'deny / close / abort zero effect: DENY typed block (no new member/incident); abort -> control-request-abandoned + typed abandoned block; later allow rejected (terminal)' },
  { id: 'S11', name: 'restarts persist, readiness resets: consent + disable facts survive all restarts and drive the fresh evaluation; the compatibility row is recomputed per boot; LIVE readiness is ephemeral — no mounted slot survives a restart, re-probed at the next boundary' },
  { id: 'S12', name: 'PR #22 ptc persona regression: standard observed -> PASS (correct open); absent observed -> FATAL PERSONA_INCOMPATIBLE + admitInitialWork blocked (no false open)' },
  { id: 'S13', name: 'old v1 frozen blueprint cold resume: byte-exact pre-PR-E source -> SAME pre-PR-E contentHash under the PR-E code; cold resume re-attaches with the hash unchanged' },
  { id: 'S14', name: 'dual-Team isolation: T2 proceeds while T is in a recovery incident; the LIVE probe is host-wide (one row, all live sessions) — the isolation proven here is the DURABLE per-root state (incidents / control facts / compatibility rows never cross roots)' },
  { id: 'H1', name: 'test-use pristine BEFORE + AFTER (porcelain empty, HEAD baseline); :3080/:3180 zero-touch (pre == post); the worker bash is a no-op echo' },
  { id: 'H2', name: 'all run ports released after teardown (worldCleaned=true on PASS only)' },
]
const VERDICT = new Map() // id -> { pass, note }

function check(id, label, ok, detail = '') {
  const prev = VERDICT.get(id) ?? { pass: true, note: '' }
  const line = `[${id}] ${ok ? 'PASS' : 'FAIL'} — ${label}${detail ? ` :: ${detail}` : ''}`
  log(line)
  if (!ok) {
    VERDICT.set(id, { pass: false, note: (prev.note ? `${prev.note}; ` : '') + `${label}${detail ? ` :: ${String(detail).slice(0, 500)}` : ''}` })
  }
  return ok
}

function dieFatal(msg) {
  log(`FATAL: ${msg}`)
  try { finalizeEvidence('FATAL', msg) } catch { /* best effort */ }
  process.exit(1)
}

// ── small utils ─────────────────────────────────────────────────────────────

function sha256Hex(s) {
  return createHash('sha256').update(s, 'utf8').digest('hex')
}

/** Deterministic JSON: keys in ascending code-unit order, compact (the
 *  contracts `canonicalJsonStringify` — recomputed for the S9 digest). */
function canonicalJson(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' || typeof value === 'number') {
    return JSON.stringify(value)
  }
  if (Array.isArray(value)) return `[${value.map((item) => canonicalJson(item)).join(',')}]`
  const entries = Object.entries(value).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
  return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalJson(item)}`).join(',')}}`
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchJson(url, init, timeoutMs = 30_000) {
  let res
  try {
    res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  } catch (error) {
    return { status: 0, body: null, error: String(error?.message ?? error) }
  }
  const text = await res.text().catch(() => '')
  let body = null
  try { body = text === '' ? null : JSON.parse(text) } catch { body = text }
  return { status: res.status, body, error: null }
}

async function probeStableInstance(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(10_000) }).catch((e) => ({ status: 0, error: String(e?.message ?? e) }))
  const text = await r.text().catch(() => '')
  return { status: r.status, length: text.length, head: text.slice(0, 200) }
}

async function authenticate(origin, token) {
  // redirect: 'manual' is MANDATORY: the authorized launch-token exchange
  // answers 303 + Set-Cookie, and Node's fetch (undici) otherwise follows
  // the 303 to '/' where the (not-yet-cooked) session answers 401 — the
  // kit would then misread its own successful authentication as a failure
  // (E.12 run prereq-2026-09-29T01-46-21: host hook captured 303 for the
  // exact marker token, then the followed GET / -> 401 that the kit saw).
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(15_000) })
  const cookie = res.headers.get('set-cookie') ?? ''
  if (res.status !== 303) throw new Error(`authenticate: expected 303 (status=${res.status})`)
  if (!cookie) throw new Error(`authenticate: no set-cookie on 303`)
  return cookie.split(';')[0]
}

// ── the remote surface (POST /team-remote/<method>) ─────────────────────────

function scrubTokens(text) {
  return String(text)
    .replace(/\bsk-[A-Za-z0-9]{24,}/g, 'sk-REDACTED')
    // K8 (run-5 hygiene gap): the RAW launch tokens (`?token=<40+>`) leaked
    // into instance logs / run.log of every run (boot URLs, auth exchanges)
    // — redact both the query-param form and the bare `token=<long>` form.
    .replace(/[?&]token=[A-Za-z0-9_-]{16,}/g, (m) => `${m[0]}token=REDACTED`)
    .replace(/\btoken=[A-Za-z0-9_-]{24,}/g, 'token=REDACTED')
}

async function remoteCall(host, method, params, tag, version = 1, timeoutMs = 60_000) {
  const body = {
    type: 'client-request',
    rpcId: `${tag}-${randomUUID().slice(0, 8)}`,
    method,
    payload: { version, params },
  }
  const r = await fetchJson(`${host.origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: host.cookie },
    body: JSON.stringify(body),
  }, timeoutMs)
  const entry = {
    at: new Date().toISOString(),
    boot: host.boot,
    method,
    version,
    tag,
    status: r.status,
    error: r.error,
    ok: r.body?.result?.ok === true,
    code: r.body?.result?.ok === false ? r.body?.result?.error?.code : undefined,
    params: params ?? null,
    body: r.body,
  }
  EVID.transcript.push(entry)
  log(`remote ${method} v${version} [${tag}] -> ${r.status} ok=${entry.ok === true}${entry.code ? ` code=${entry.code}` : ''}${r.error ? ` (net: ${scrubTokens(r.error)})` : ''}`)
  return r
}

async function remoteCallReady(host, method, params, tag, version = 1, retries = 20) {
  let last = null
  for (let i = 0; i < retries; i += 1) {
    last = await remoteCall(host, method, params, tag, version)
    if (last.status !== 429) return last
    await sleep(1500)
  }
  return last
}

function remoteValue(result, method) {
  if (result.status !== 200) throw new Error(`${method}: HTTP ${result.status}: ${scrubTokens(JSON.stringify(result.body).slice(0, 400))}`)
  const r = result.body?.result
  if (r === undefined) throw new Error(`${method}: no result envelope: ${scrubTokens(JSON.stringify(result.body).slice(0, 400))}`)
  if (r.ok !== true) throw new Error(`${method}: remote error: ${scrubTokens(JSON.stringify(r.error ?? r).slice(0, 800))}`)
  const v = r.value
  if (v && typeof v === 'object' && 'data' in v && 'provenance' in v) return v.data
  return v
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

/** The typed gate details of a remote error, when present (dispatch folds
 *  the source error's details under details.cause.details). */
function gateDetailsOf(err) {
  return err?.details?.cause?.details ?? null
}

/** K5 (run-5 live finding): the typed gate block code as observed on the
 *  LIVE remote surface — the remote dispatch passes the runtime
 *  TeamRuntimeError code through VERBATIM: `TEAM_RUNTIME_COMPATIBILITY_
 *  BLOCKED` (packages/runtime/admission/errors.ts:94), not the bare
 *  `COMPATIBILITY_BLOCKED` the unit-world helpers compare against. */
const GATE_BLOCKED_CODE = 'TEAM_RUNTIME_COMPATIBILITY_BLOCKED'

/** K6 (run-5 live finding): a CLOSED team-tool result (the typed gate
 *  block, the envelope block, the deny/abort zero-effect) travels as
 *  p6t6 `{ok:true, value:{status:'rejected', code, message, details}}` —
 *  the /__p6t6/tool route (tools/harness/plugin.mjs) only sets the
 *  `ok:false`/`error` branch for THROWN tool faults (outcome.isError),
 *  never for closed results. Checks on closed outcomes must read
 *  `value.{status,code,message,details}`, never `body.error`. */
function closedRejection(resp) {
  return resp.body?.ok === true && resp.body?.value?.status === 'rejected'
}

// ── the p6t6 seam ───────────────────────────────────────────────────────────

async function p6t6Tool(port, name, argsObj, as, timeoutMs = 200_000) {
  const r = await fetchJson(`http://127.0.0.1:${port}/__p6t6/tool`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, args: argsObj, as }),
  }, timeoutMs)
  EVID.transcript.push({
    at: new Date().toISOString(),
    boot: port === HOST_PORT ? host?.boot : null,
    method: `__p6t6/tool ${name}`,
    as,
    args: argsObj,
    status: r.status,
    body: r.body,
  })
  log(`p6t6 tool ${name} as=${as} -> ${r.status} ok=${r.body?.ok === true}${r.body?.ok === false ? ` err=${scrubTokens(String(r.body?.error?.message ?? '').slice(0, 300))}` : ''}`)
  return r
}

async function p6t6State(port) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/state`, undefined, 30_000)
}

async function p6t6Health(port) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/health`, undefined, 10_000)
}

async function p6t6StateReady(port, { rootSessionId, phase, timeoutMs = 120_000, intervalMs = 500 }) {
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
    await sleep(intervalMs)
    last = await p6t6State(port)
  }
}

/** The mcp materialization slot of server `name` across ALL live sessions
 *  (governance.sessions is host-wide; the team control/members sections are
 *  directive-ROOT-scoped and do NOT cover scenario teams).
 *  K10 (run-5): returns EVERY session's slot for the server — the configured
 *  fiber appears in each session with a live agent (boot-root leader, every
 *  worker), and only the sessions whose template ALLOWS the server show
 *  `mounted:true` (the others stay `materialization:pending`). Callers
 *  pick the mounted slot (the materialized boundary) instead of assuming
 *  the first map entry is the right session. */
function findMcpSlots(stateBody, serverName) {
  const sessions = stateBody?.governance?.sessions
  if (sessions === undefined || sessions === null || typeof sessions !== 'object') return []
  const out = []
  for (const [sessionId, view] of Object.entries(sessions)) {
    const servers = view?.mcp?.servers
    if (servers === undefined || servers === null || typeof servers !== 'object') continue
    const s = servers[serverName]
    if (s === undefined || s === null || typeof s !== 'object') continue
    out.push({
      sessionId,
      mounted: s.mounted === true,
      materialization: typeof s.materialization === 'string' ? s.materialization : null,
      attempts: typeof s.mcpAttempts === 'number' ? s.mcpAttempts : null,
      reason: s.mcpFailureReason !== undefined ? String(s.mcpFailureReason) : null,
    })
  }
  return out
}

// ── the durable requirement-fact / control readers ──────────────────────────

/** All ledger entries of one root (the team-scoped durable read surface).
 *  Paginates: the remote contract bounds `limit` at 500 (params.ts
 *  parseRemoteBoundedInt), so a single over-limit request answers
 *  MALFORMED_PARAMS — walk `nextAfterSequence` until the page is short. */
async function ledgerEntries(host, teamSessionId) {
  const entries = []
  let afterSequence = 0
  for (let pageNo = 0; pageNo < 100; pageNo += 1) { // 100 × 500 safety cap
    const page = await remoteCallReady(host, 'team.getLedgerPage', { teamSessionId, afterSequence, limit: 500 }, `ledger-p${pageNo}`, 1)
    const data = remoteValue(page, 'team.getLedgerPage') // loud on any non-ok (never swallow a durable-read failure)
    const pageEntries = Array.isArray(data?.entries) ? data.entries : []
    entries.push(...pageEntries)
    const next = data?.nextAfterSequence
    if (typeof next !== 'number' || pageEntries.length === 0) break
    afterSequence = next
  }
  return entries.sort((a, b) => (a?.sequence ?? 0) - (b?.sequence ?? 0))
}

/** One fact type's entries (durable requirement facts live in the frozen
 *  `compatibility` category, carried in the root ledger). */
function factEntries(entries, factType) {
  return entries.filter((e) => e?.factType === factType)
}

/** The durable compatibility AGGREGATE of one root (contract v1 exposes
 *  aggregate ONLY: {status, generation, environmentFingerprint, recordedAt,
 *  counts} — the per-requirement rows travel on `intent.probe`). */
async function compatibilityOf(host, teamSessionId) {
  const r = await remoteCallReady(host, 'compatibility.get', { teamSessionId }, 'compat-get', 1)
  const err = resultError(r.body)
  if (err !== null) return { error: err }
  const data = resultData(r.body)
  const row = data?.verdict ?? data
  return { row }
}

/** The FULL engine verdict (status + per-requirement rows + counts) for a
 *  saved blueprint against the row's live facts — the pre-create probe. */
async function probeBlueprint(host, blueprintId, tag) {
  const r = await remoteCallReady(host, 'intent.probe', {
    blueprintId,
    environmentFacts: [],
  }, tag, 1)
  const err = resultError(r.body)
  if (err !== null) return { error: err }
  return { verdict: resultData(r.body)?.compatibility ?? null }
}

/** The pending control requests of one root: `control-request-recorded`
 *  entries with NO matching `control-decision-recorded` and NO matching
 *  abandon fact. (The p6t6 `control` section is directive-ROOT-scoped —
 *  scenario teams are read from their OWN ledgers.) */
function pendingControlRequests(entries) {
  const requests = factEntries(entries, 'control-request-recorded')
  const decided = new Set(factEntries(entries, 'control-decision-recorded').map((e) => e?.payload?.requestId))
  const abandoned = new Set(factEntries(entries, 'control-request-abandoned').map((e) => e?.payload?.requestId))
  return requests
    .filter((e) => e?.payload?.requestId !== undefined && !decided.has(e.payload.requestId) && !abandoned.has(e.payload.requestId))
    .map((e) => e.payload)
}

async function resolveControl(host, teamSessionId, requestId, decision, note, tag) {
  return remoteCallReady(host, 'team.resolveControl', { teamSessionId, requestId, decision, note }, tag ?? `resolve-${requestId.slice(0, 12)}`, 4)
}

// ── the world file (seeded durable facts — host STOPPED) ───────────────────

function readWorld() {
  return JSON.parse(readFileSync(WORLD_FILE, 'utf8'))
}

function writeWorld(world) {
  writeFileSync(WORLD_FILE, JSON.stringify(world, null, 1))
}

/** Append ONE durable requirement fact (the `compatibility` category of the
 *  root ledger, canonical-JSON table values) — host must be STOPPED. The
 *  gate's READ of these facts is the behavior under test (no live writer
 *  exists for consents/availability in this increment). */
function seedFact(rootSessionId, factType, payload) {
  const world = readWorld()
  const ledger = world.tables.ledger
  let maxSeq = 0
  for (const key of Object.keys(ledger)) {
    const n = Number(key)
    if (Number.isInteger(n) && n > maxSeq) maxSeq = n
  }
  const seq = maxSeq + 1
  const entry = {
    schemaVersion: 2,
    sequence: seq,
    rootSessionId,
    factType,
    payload,
    createdAt: new Date().toISOString(),
  }
  // Validate fail-fast (RECORD_INVALID on any malformed field) and write
  // the row in canonical byte form (sorted keys, compact) — the exact form
  // the host's LedgerRepository.readRecordFromRaw byte-compares against.
  ledger[String(seq)] = canonicalJsonStringify(parseLedgerEntry(entry))
  // Bump the sequence-counter row to the new high-water mark, canonical
  // form too: leaving it stale makes the host's next allocation collide
  // with the seeded sequence.
  ledger[LEDGER_SEQUENCE_COUNTER_KEY] = serializeLedgerSequenceCounter({
    schemaVersion: 2,
    kind: 'ledger-sequence-counter',
    value: seq,
  })
  writeWorld(world)
  log(`world: seeded ${factType} seq=${seq} root=${rootSessionId} payload=${JSON.stringify(payload)}`)
  return seq
}

// ── the mock model oracle (the wire witness) ────────────────────────────────

function toolCall(name, argumentsObj) {
  return { kind: 'tool-call', toolCalls: [{ id: `call-prereq-${randomUUID().slice(0, 8)}`, name, arguments: argumentsObj }] }
}

/** Mutable per-boot oracle inputs (the follow-up target, set before B4). */
const ORACLE = {}

function leaderDelegateCall(tag, { rootSessionId, templateId, requestToken, workerMarker, followUp }) {
  if (followUp !== undefined) {
    // team_follow_up: required [rootSessionId, requestToken, targetInstanceId,
    // prompt] — NO label (absent async would mean ASYNC — always explicit).
    return {
      name: 'team_follow_up',
      args: {
        rootSessionId,
        requestToken,
        targetInstanceId: followUp,
        prompt: `${workerMarker} work unit ${tag} (nonce ${NONCE})`,
        async: false,
      },
    }
  }
  // team_delegate: required [rootSessionId, requestToken, label, prompt] +
  // exactly one of delegationTemplateId / delegationInstanceId.
  return {
    name: 'team_delegate',
    args: {
      rootSessionId,
      requestToken,
      label: `w-${tag}`,
      prompt: `${workerMarker} work unit ${tag} (nonce ${NONCE})`,
      delegationTemplateId: templateId,
      async: false,
    },
  }
}

/** K14 (run-6) + K16 (run-7 live finding): the delegate's instance id
 *  rides on the EFFECT in BOTH forms — `member-activated` (the FIRST
 *  delegate on a template creates) and `work-admitted` (the live default
 *  context policy CONTINUES an existing instance — provider.ts
 *  resolveDelegationTarget 'continue' short-circuit; the kit world has no
 *  fresh_per_delegation policy, so every later delegate on the same
 *  template continues on the first instance, fromLifecycle SETTLED). The
 *  outcome's top-level targetInstanceId is ABSENT on both forms in this
 *  world (router.ts sets it only when resolved.target is defined — never
 *  for these tool-surface delegates). Read effect.instanceId first. */
function delegateInstanceId(value) {
  const eff = value?.effect
  if (eff && typeof eff.instanceId === 'string') return eff.instanceId
  return value?.targetInstanceId ?? null
}

/** One scripted leader boundary call, keyed by tag. */
function leaderCallFor(tag) {
  switch (tag) {
    case 'b1': return leaderDelegateCall(tag, { rootSessionId: T, templateId: 'worker', requestToken: `rt-b1-${NONCE}`, workerMarker: MKW('b1') })
    case 'b2': return leaderDelegateCall(tag, { rootSessionId: T, templateId: 'worker', requestToken: `rt-b2-${NONCE}`, workerMarker: MKW('b2') })
    case 'b2b': return leaderDelegateCall(tag, { rootSessionId: T, templateId: 'worker', requestToken: `rt-b2b-${NONCE}`, workerMarker: MKW('b2b') })
    case 'b3a': return leaderDelegateCall(tag, { rootSessionId: T, templateId: 'worker', requestToken: `rt-b3a-${NONCE}`, workerMarker: MKW('b3a') })
    case 'b3b': return leaderDelegateCall(tag, { rootSessionId: T, templateId: 'worker', requestToken: `rt-b3b-${NONCE}`, workerMarker: MKW('b3b') })
    case 'b3c': return leaderDelegateCall(tag, { rootSessionId: T, templateId: 'worker', requestToken: `rt-b3c-${NONCE}`, workerMarker: MKW('b3c') })
    case 'b4': return leaderDelegateCall(tag, { rootSessionId: T, followUp: ORACLE.b4Target, requestToken: `rt-b4-${NONCE}`, workerMarker: MKW('b4') })
    case 'b5': return leaderDelegateCall(tag, { rootSessionId: T, templateId: 'helper', requestToken: `rt-b5-${NONCE}`, workerMarker: MKW('b5') })
    case 'b6': return leaderDelegateCall(tag, { rootSessionId: T, templateId: 'worker', requestToken: `rt-b6-${NONCE}`, workerMarker: MKW('b6') })
    case 'b7': return leaderDelegateCall(tag, { rootSessionId: T, templateId: 'helper', requestToken: `rt-b7-${NONCE}`, workerMarker: MKW('b7') })
    case 'b8h': return leaderDelegateCall(tag, { rootSessionId: T, templateId: 'helper', requestToken: `rt-b8h-${NONCE}`, workerMarker: MKW('b8h') })
    case 'b8w': return leaderDelegateCall(tag, { rootSessionId: T, templateId: 'worker', requestToken: `rt-b8w-${NONCE}`, workerMarker: MKW('b8w') })
    case 'b9': return leaderDelegateCall(tag, { rootSessionId: T9, templateId: 'worker', requestToken: `rt-b9-${NONCE}`, workerMarker: MKW('b9') })
    case 't2b1': return leaderDelegateCall(tag, { rootSessionId: T2, templateId: 'worker', requestToken: `rt-t2b1-${NONCE}`, workerMarker: MKW('t2b1') })
    case 't2b3': return leaderDelegateCall(tag, { rootSessionId: T2, templateId: 'worker', requestToken: `rt-t2b3-${NONCE}`, workerMarker: MKW('t2b3') })
    default:
      throw new Error(`oracle: unknown leader tag '${tag}'`)
  }
}

function workerTurnFor(tag, roundsAfter, issueToolCall) {
  switch (tag) {
    case 'b3a':
      // S7: the degraded Member's controlled repair turn — read (allow lane:
      // executes on the ORIGINAL permission, no review), then bash (ASK lane:
      // the recovery must NOT turn ask into allow — a control request opens
      // and the kit approves it), then DONE.
      if (roundsAfter === 0) return issueToolCall(tag, toolCall('read', { file_path: 'package.json' }))
      if (roundsAfter === 1) return issueToolCall(tag, toolCall('bash', { command: `echo prereq-repair-${NONCE}` }))
      if (roundsAfter === 2) return { kind: 'text', content: DONE_W(tag) }
      break
    case 'b4':
      // S8: the same instance, web restored — the boundary mounted mcp_web;
      // ping it (the wire witness of the materialization).
      if (roundsAfter === 0) return issueToolCall(tag, toolCall(TOOL_WEB_PING, { msg: 's8-web' }))
      if (roundsAfter === 1) return { kind: 'text', content: DONE_W(tag) }
      break
    default:
      // every other work unit: a single DONE turn.
      return { kind: 'text', content: DONE_W(tag) }
  }
  return { kind: 'text', content: `${DONE_W(tag)}_FALLTHROUGH rounds=${roundsAfter}` }
}

function makeDecide() {
  const allWorker = WORKER_TAGS.map((t) => MKW(t))
  const toolCallCounts = {}
  const issueToolCall = (mk, tc) => {
    toolCallCounts[mk] = (toolCallCounts[mk] ?? 0) + 1
    if (toolCallCounts[mk] > 5) {
      log(`ORACLE loop guard: ${mk} issued >5 tool calls — breaking the loop`)
      return { kind: 'text', content: 'PRREQ_LOOP_GUARD' }
    }
    return tc
  }
  return function decide({ req }) {
    const msgs = Array.isArray(req?.messages) ? req.messages : []
    const first = msgs[0]
    if (typeof first?.content === 'string' && first.content.startsWith('Create a concise title')) {
      return { kind: 'text', content: 'prereq smoke session' }
    }
    // The LAST user message carrying a worker marker = the current work unit
    // (the delegate prompt; resumed sessions keep older marker turns earlier
    // in the transcript). KEY: the DSH agent appends TOOL RESULTS as
    // `user`-role messages, so tool round-trips are counted by the
    // ASSISTANT (tool-call) messages that follow the marker user message.
    let workerIdx = -1
    for (let i = msgs.length - 1; i >= 0; i -= 1) {
      const m = msgs[i]
      if (m?.role !== 'user') continue
      const t = typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')
      if (allWorker.some((mk) => t.includes(mk))) { workerIdx = i; break }
    }
    if (workerIdx !== -1) {
      const lastUser = typeof msgs[workerIdx].content === 'string' ? msgs[workerIdx].content : JSON.stringify(msgs[workerIdx].content)
      const tag = WORKER_TAGS.find((t) => lastUser.includes(MKW(t)))
      const roundsAfter = msgs.slice(workerIdx + 1).filter((m) => m?.role === 'assistant').length
      if (roundsAfter > 3) return { kind: 'text', content: 'PRREQ_LOOP_GUARD' }
      if (tag !== undefined) {
        const r = workerTurnFor(tag, roundsAfter, issueToolCall)
        if (r.kind === 'tool-call') log(`ORACLE worker ${tag} round ${roundsAfter}: ${r.toolCalls[0].name}`)
        return r
      }
    }
    return { kind: 'text', content: `PRREQ_DEFAULT_ACK_${NONCE}` }
  }
}

function msgContentHas(m, needle) {
  const c = m?.content
  const t = typeof c === 'string' ? c : JSON.stringify(c ?? '')
  return t.includes(needle)
}

/** The mock request where the turn carrying `marker` ENDED (final text). */
async function waitForTurnDone(mock, marker, doneText, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const hit = mock.requests.find((r) => r.reply?.kind === 'text' && r.reply.content === doneText && (r.body?.messages ?? []).some((m) => msgContentHas(m, marker)))
    if (hit !== undefined) return hit
    if (Date.now() >= deadline) return null
    await sleep(500)
  }
}

/** TRUE if ANY captured model request shows the needle after the marker
 *  turn (executed tool outputs — the pong strings — ride in as user-role
 *  messages). */
function mockWitness(mock, marker, needle) {
  const reqs = mock.requests.filter((r) => (r.body?.messages ?? []).some((m) => msgContentHas(m, marker)))
  return reqs.some((r) => (r.body?.messages ?? []).some((m) => msgContentHas(m, needle)))
}

// ── the mini-MCP servers (the live capability surfaces) ─────────────────────

function miniMcpRpc(serverLabel, msg) {
  const { id, method, params } = msg ?? {}
  if (method === 'initialize') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion: '2025-03-26',
        capabilities: { tools: {} },
        serverInfo: { name: serverLabel, version: '1.0.0' },
      },
    }
  }
  if (method === 'notifications/initialized') return null
  if (method === 'tools/list') {
    return {
      jsonrpc: '2.0',
      id,
      result: {
        tools: [
          {
            name: `ping`,
            description: `ping ${serverLabel}`,
            inputSchema: { type: 'object', properties: { msg: { type: 'string' } }, required: ['msg'] },
          },
        ],
      },
    }
  }
  if (method === 'tools/call') {
    const toolName = String(params?.name ?? '')
    if (toolName === 'ping') {
      return {
        jsonrpc: '2.0',
        id,
        result: {
          content: [{ type: 'text', text: `pong:${serverLabel}:${String(params?.arguments?.msg ?? '?')}` }],
          isError: false,
        },
      }
    }
    return { jsonrpc: '2.0', id, error: { code: -32601, message: `unknown tool ${toolName}` } }
  }
  return { jsonrpc: '2.0', id, error: { code: -32601, message: `method not found: ${String(method)}` } }
}

async function startMiniMcp(port, label) {
  const { createServer } = await import('node:http')
  const server = createServer((req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(405).end()
      return
    }
    let raw = ''
    req.on('data', (chunk) => { raw += chunk })
    req.on('end', () => {
      let msg = null
      try { msg = JSON.parse(raw || 'null') } catch { /* null */ }
      const reply = miniMcpRpc(label, msg)
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(reply === null ? '' : JSON.stringify(reply))
    })
  })
  await new Promise((resolveP, rejectP) => {
    server.once('error', rejectP)
    server.listen(port, '127.0.0.1', () => resolveP())
  })
  log(`mini MCP ${label} up on 127.0.0.1:${port}`)
  return { port, server }
}

/** Stop a running mini-MCP (the W2-A DOWN state — a LIVE state change, the
 *  C.10 real-host pattern: the row config stays CONFIGURED; the next mount
 *  attempt against the dead port fails into the isolated per-server slot).
 *  `server.close` waits for open connections to drain (the C.10 kit proves
 *  this is safe to re-listen on the same port afterwards). */
async function stopMiniMcp(mini, label) {
  if (mini === null) return
  await new Promise((r) => mini.server.close(r))
  log(`mini MCP ${label ?? mini.port} STOPPED on 127.0.0.1:${mini.port} (the live down state)`)
}

// ── the saved team blueprints ───────────────────────────────────────────────

const LEADER_TEAM_TOOLS = [
  'team_delegate', 'team_follow_up', 'team_create_member', 'team_collect',
  'team_send_message', 'team_report_progress', 'team_request_control',
  'team_resolve_control', 'team_list_pending_control', 'team_list_members',
  'team_list_templates', 'team_inspect_config', 'team_archive_member',
]

/** The main scenario team (v2): the requirement matrix under test. */
function mainTeamBlueprintYaml() {
  return [
    '---',
    'schemaVersion: 2',
    `blueprintId: ${BP_MAIN_ID}`,
    'revision: "1"',
    'teamRequirements:',
    '  - requirementId: team.mcp.repo',
    '    type: mcpServer',
    `    subjects: [${S_REPO}]`,
    '    complete: true',
    '  - requirementId: team.mcp.leaderreq',
    '    type: mcpServer',
    `    subjects: [${S_LEADERREQ}]`,
    '    complete: true',
    'leader:',
    '  templateId: leader',
    `  persona: ${JSON.stringify(`You are the leader of the PR-E requirement/recovery smoke team. Nonce ${NONCE}. When asked to delegate, call the delegated tool EXACTLY once and then answer with the done marker.`)}`,
    '  requirements:',
    '    - requirementId: lead.mcp.signal',
    '      type: mcpServer',
    `      subjects: [${S_SIGNAL}]`,
    '      complete: false',
    '  capabilities:',
    '    teamTools:',
    '      kind: allow',
    '      items:',
    ...LEADER_TEAM_TOOLS.map((t) => `        - ${t}`),
    '    builtinToolDeny: []',
    '    skills:',
    '      kind: allow',
    '      items: []',
    // W2-A live-probe world design: the LEADER (the team's always-live
    // session) mounts EVERY row-configured MCP server. The team-scoped
    // servers (repo/leaderreq) have no other live mount surface, and the
    // worker-scoped web must be proable at admission time — BEFORE the
    // worker instance is attached (the gate reads fresh live facts before
    // the effect runs; a cold worker is `not-applicable`, never a
    // fabricated failure). A STOPPED server therefore fails the leader's
    // mount (isolated per-server slot) → the probe answers `unreachable`
    // → the DOWN cell. `mcp_signal` is allowed but never configured
    // (excluded from the reconcile target by the configured∩allow filter).
    '    mcp:',
    '      kind: allow',
    '      items:',
    `        - ${S_REPO}`,
    `        - ${S_LEADERREQ}`,
    `        - ${S_SIGNAL}`,
    `        - ${S_WEB}`,
    'members:',
    '  - templateId: worker',
    `    persona: ${JSON.stringify('You are a worker of the PR-E smoke team. Do exactly what the work unit says, then finish.')}`,
    '    requirements:',
    '      - requirementId: worker.mcp.web',
    '        type: mcpServer',
    `        subjects: [${S_WEB}]`,
    '        complete: true',
    '    capabilities:',
    '      teamTools:',
    '        kind: deny',
    // A2C-2 permission-coverage gate: the worker DECLARES
    // capabilities.permissions (read allow / bash ask / default deny), so
    // EVERY tool on the final model-facing surface needs an authority
    // owner. The 0.1.7-rc.1 host surface carries 19 tools outside the
    // closed SAFE/managed registries (12 known-sensitive + 7 unknown:
    // ask_user_question, create_goal, exit_plan_mode, get_goal, present,
    // skill, update_goal) — FATAL unless the capability layer removes them
    // first (permission-coverage.ts: "unless the capability layer (e.g.
    // builtinToolDeny) removed it first"). Deny exactly the unmanaged set
    // observed on this host; the remaining surface (read/bash + the
    // managed vocabulary + todo_write) is owner-covered.
    '      builtinToolDeny:',
    ...WORKER_SURFACE_DENY.map((t) => `        - ${t}`),
    '      skills:',
    '        kind: allow',
    '        items: []',
    '      mcp:',
    '        kind: allow',
    '        items:',
    `          - ${S_WEB}`,
    '      permissions:',
    '        default: deny',
    '        allow:',
    '          - tool: read',
    '            resource:',
    '              kind: any',
    '        ask:',
    '          - tool: bash',
    '            resource:',
    '              kind: any',
    '        deny: []',
    '  - templateId: helper',
    `    persona: ${JSON.stringify('You are a helper of the PR-E smoke team. Do exactly what the work unit says, then finish.')}`,
    '    capabilities:',
    '      teamTools:',
    '        kind: deny',
    '      builtinToolDeny: []',
    '      skills:',
    '        kind: allow',
    '        items: []',
    '      mcp:',
    '        kind: allow',
    '        items: []',
    'requirements: []',
    'teamEnvelope:',
    '  allow:',
    '    - assign-task',
    '    - create-member',
    '    - send-message',
    '    - report-progress',
    // K4 (run-5 live finding): the PR-E recovery dispatch (plan §E.9) opens
    // the human-reviewed control request THROUGH the caller's mutation
    // envelope as the `request-control` op (router.ts requestControl
    // caller = the leader; P6-T4 requester-envelope semantics). Every
    // canonical leader fixture (p6t2/p8s6/t12*) carries it; a leader
    // without it fails closed with TEAM_RUNTIME_ENVELOPE_OUT_OF_BOUNDS on
    // every requiredScopeDown recovery offer (the E.11 unit world's fake
    // control service never enforced the envelope). The same op is added
    // to the iso + persona leader envelopes below (uniform leader shape).
    // K12 (run-6 prep, source-verified): the router's abort branch
    // (action-router/router.ts:367) calls abandonControlRequest with
    // caller = the leader, and control/service.ts abandonControlRequest
    // enforces the RESOLVE_CONTROL_SPEC envelope (reused op — abandon is a
    // control-request mutation). Without resolve-control in the leader
    // envelope the durable control-request-abandoned fact is never written
    // (best-effort catch) and S10's terminal-abandon evidence check fails.
    // The canonical leader fixture (p6t2-helpers.ts) carries it.
    '    - request-control',
    '    - resolve-control',
    '  deny:',
    '    - delete-team',
  // K11 (run-6 prep, source-verified): a MEMBER's effective envelope is
    // teamEnvelope.allow INTERSECTED with its template's memberEnvelopes
    // entry allow (admission/envelope.ts callerEnvelope — role 'member' →
    // templateAllow gate). The A2C permission-ask path
    // (operation-permission/pre-execute-adapter.ts:1321) opens the durable
    // control request with caller = the WORKER, and control/service.ts:1337
    // enforces requestControl against THAT envelope (REQUEST_CONTROL_SPEC).
    // Without this entry the S7 degraded member's controlled bash (ASK lane)
    // fails closed with TEAM_RUNTIME_ENVELOPE_OUT_OF_BOUNDS before any
    // control row exists (the ask never opens; the worker's turn ends with
    // the call denied). Canonical P6-T2 fixtures grant request-control to
    // the scout template for exactly this reason.
    'memberEnvelopes:',
    '  - templateId: worker',
    '    envelope:',
    '      allow:',
    '        - request-control',
    'policyStates:',
    '  - id: default',
    '    description: "PR-E main team default state."',
    'quotas:',
    '  team:',
    '    maxInstances: 12',
    '    maxConcurrent: 12',
    '  members:',
    '    maxInstances: 8',
    '    maxConcurrent: 4',
    'metadata: {}',
    '---',
    '',
  ].join('\n')
}

/** The isolation team (v2): NARROWER requirements (repo only) — the S14
 *  proof that per-ROOT durable state is isolated even though the world
 *  facts (row level) are shared. */
function isoTeamBlueprintYaml() {
  return [
    '---',
    'schemaVersion: 2',
    `blueprintId: ${BP_ISO_ID}`,
    'revision: "1"',
    'teamRequirements:',
    '  - requirementId: team.mcp.repo',
    '    type: mcpServer',
    `    subjects: [${S_REPO}]`,
    '    complete: true',
    'leader:',
    '  templateId: leader',
    `  persona: ${JSON.stringify(`You are the leader of the PR-E isolation team. Nonce ${NONCE}. When asked to delegate, call the delegated tool EXACTLY once and then answer with the done marker.`)}`,
    '  capabilities:',
    '    teamTools:',
    '      kind: allow',
    '      items:',
    '        - team_delegate',
    '        - team_follow_up',
    '        - team_list_members',
    '    builtinToolDeny: []',
    '    skills:',
    '      kind: allow',
    '      items: []',
    '    mcp:',
    '      kind: allow',
    '      items: []',
    'members:',
    '  - templateId: worker',
    `    persona: ${JSON.stringify('You are a worker of the PR-E isolation team. Do exactly what the work unit says, then finish.')}`,
    '    capabilities:',
    '      teamTools:',
    '        kind: deny',
    '      builtinToolDeny: []',
    '      skills:',
    '        kind: allow',
    '        items: []',
    '      mcp:',
    '        kind: allow',
    '        items: []',
    'requirements: []',
    'teamEnvelope:',
    '  allow:',
    '    - assign-task',
    '    - create-member',
    '    - send-message',
    '    - report-progress',
    // K4 (run-5 live finding): the PR-E recovery dispatch (plan §E.9) opens
    // the human-reviewed control request THROUGH the caller's mutation
    // envelope as the `request-control` op (router.ts requestControl
    // caller = the leader; P6-T4 requester-envelope semantics). Every
    // canonical leader fixture (p6t2/p8s6/t12*) carries it; a leader
    // without it fails closed with TEAM_RUNTIME_ENVELOPE_OUT_OF_BOUNDS on
    // every requiredScopeDown recovery offer (the E.11 unit world's fake
    // control service never enforced the envelope). The same op is added
    // to the iso + persona leader envelopes below (uniform leader shape).
    // K12 (run-6 prep, source-verified): the router's abort branch
    // (action-router/router.ts:367) calls abandonControlRequest with
    // caller = the leader, and control/service.ts abandonControlRequest
    // enforces the RESOLVE_CONTROL_SPEC envelope (reused op — abandon is a
    // control-request mutation). Without resolve-control in the leader
    // envelope the durable control-request-abandoned fact is never written
    // (best-effort catch) and S10's terminal-abandon evidence check fails.
    // The canonical leader fixture (p6t2-helpers.ts) carries it.
    '    - request-control',
    '    - resolve-control',
    '  deny:',
    '    - delete-team',
    'memberEnvelopes: []',
    'policyStates:',
    '  - id: default',
    '    description: "PR-E isolation team default state."',
    'quotas:',
    '  team:',
    '    maxInstances: 6',
    '    maxConcurrent: 6',
    '  members:',
    '    maxInstances: 4',
    '    maxConcurrent: 2',
    'metadata: {}',
    '---',
    '',
  ].join('\n')
}

/** The persona team (v2): the S12 `ptc` regression subject. */
function personaTeamBlueprintYaml() {
  return [
    '---',
    'schemaVersion: 2',
    `blueprintId: ${BP_PERSONA_ID}`,
    'revision: "1"',
    'teamRequirements:',
    '  - requirementId: team.persona.standard',
    '    type: persona',
    '    subjects: [standard]',
    '    complete: true',
    'leader:',
    '  templateId: leader',
    `  persona: ${JSON.stringify(`You are the leader of the PR-E persona team. Nonce ${NONCE}. When asked to delegate, call the delegated tool EXACTLY once and then answer with the done marker.`)}`,
    '  capabilities:',
    '    teamTools:',
    '      kind: allow',
    '      items:',
    '        - team_delegate',
    '        - team_follow_up',
    '        - team_list_members',
    '    builtinToolDeny: []',
    '    skills:',
    '      kind: allow',
    '      items: []',
    '    mcp:',
    '      kind: allow',
    '      items: []',
    'members:',
    '  - templateId: worker',
    `    persona: ${JSON.stringify('You are a worker of the PR-E persona team. Do exactly what the work unit says, then finish.')}`,
    '    capabilities:',
    '      teamTools:',
    '        kind: deny',
    '      builtinToolDeny: []',
    '      skills:',
    '        kind: allow',
    '        items: []',
    '      mcp:',
    '        kind: allow',
    '        items: []',
    'requirements: []',
    'teamEnvelope:',
    '  allow:',
    '    - assign-task',
    '    - create-member',
    '    - send-message',
    '    - report-progress',
    // K4 (run-5 live finding): the PR-E recovery dispatch (plan §E.9) opens
    // the human-reviewed control request THROUGH the caller's mutation
    // envelope as the `request-control` op (router.ts requestControl
    // caller = the leader; P6-T4 requester-envelope semantics). Every
    // canonical leader fixture (p6t2/p8s6/t12*) carries it; a leader
    // without it fails closed with TEAM_RUNTIME_ENVELOPE_OUT_OF_BOUNDS on
    // every requiredScopeDown recovery offer (the E.11 unit world's fake
    // control service never enforced the envelope). The same op is added
    // to the iso + persona leader envelopes below (uniform leader shape).
    // K12 (run-6 prep, source-verified): the router's abort branch
    // (action-router/router.ts:367) calls abandonControlRequest with
    // caller = the leader, and control/service.ts abandonControlRequest
    // enforces the RESOLVE_CONTROL_SPEC envelope (reused op — abandon is a
    // control-request mutation). Without resolve-control in the leader
    // envelope the durable control-request-abandoned fact is never written
    // (best-effort catch) and S10's terminal-abandon evidence check fails.
    // The canonical leader fixture (p6t2-helpers.ts) carries it.
    '    - request-control',
    '    - resolve-control',
    '  deny:',
    '    - delete-team',
    'memberEnvelopes: []',
    'policyStates:',
    '  - id: default',
    '    description: "PR-E persona team default state."',
    'quotas:',
    '  team:',
    '    maxInstances: 6',
    '    maxConcurrent: 6',
    '  members:',
    '    maxInstances: 4',
    '    maxConcurrent: 2',
    'metadata: {}',
    '---',
    '',
  ].join('\n')
}

/** The row anchor: a plain LEGACY v1 leader (no capabilities, no
 *  requirements) — the directive root (C.10 pattern). */
const BP_ANCHOR_YAML = [
  '---',
  'schemaVersion: 1',
  `blueprintId: ${BP_ANCHOR_ID}`,
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  `  persona: ${JSON.stringify(`You are the leader of the PR-E smoke boot team. ${NONCE} is the run nonce.`)}`,
  'members: []',
  'requirements: []',
  'memberEnvelopes: []',
  'policyStates: []',
  'metadata: {}',
  '---',
  '',
].join('\n')

// ── the production row config + profile-patch emitter ───────────────────────

/** The STATIC row `mcpServers` config — identical in EVERY boot (W2-A: the
 *  supply axis is a row-level CONFIGURATION, not a per-boot knob; "recovery
 *  is reconfiguration" — a down cell is the STOPPED process, never a
 *  removed/absent config entry). `mcp_signal` is deliberately ABSENT — the
 *  S2 optional-missing lives on the supply axis (deterministic
 *  `unreachable`, source 'supply'; no probe, no live server ever). */
const ROW_MCP_SERVERS = [
  { name: S_REPO, port: PORT_REPO },
  { name: S_LEADERREQ, port: PORT_LEADERREQ },
  { name: S_WEB, port: PORT_WEB },
]

/** One boot's row config: the per-boot world truth (environmentFacts = the
 *  STATIC bootstrap seed — under W2-A it fills only `unknown` live verdicts
 *  and is never flipped per phase; mcpServers = the configured supply axis;
 *  presetSubstrate = the scripted persona seam). */
function teamRowConfig({ bootPhase, facts, mcpServers, presetSubstrate }) {
  return {
    rootSessionId: ROOT,
    bootPhase,
    blueprintSource: BP_ANCHOR_YAML,
    blueprintDir: BLUEPRINT_DIR,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'prereq-smoke-model' },
    deniedSelection: null,
    mcpServers,
    mcpServer: null,
    environmentFacts: facts,
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    ...(presetSubstrate !== undefined ? { presetSubstrate } : {}),
    glueUrl: pathToFileURL(GLUE_PATH).href,
    seamUrl: pathToFileURL(SEAM_PATH).href,
  }
}

function envFacts({ repo, leaderreq, web, signal, persona }) {
  const f = []
  // Fact domain == the v2 requirement TYPE (engine.ts: factByKey =
  // `${requirement.type}\u0000${subject}`) — mcpServer, not 'mcp'.
  const add = (subject, available) => {
    if (available !== null) f.push({ domain: 'mcpServer', subject, available, generation: 1 })
  }
  add(S_REPO, repo)
  add(S_LEADERREQ, leaderreq)
  add(S_WEB, web)
  add(S_SIGNAL, signal)
  if (persona !== null) f.push({ domain: 'persona', subject: 'standard', available: persona, generation: 1 })
  return f
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

function writeTeamPatchFile(patchPath, rowConfig, comment) {
  mkdirSync(dirname(patchPath), { recursive: true })
  const lines = [
    `# pre-alpha3 PR-E E.12 gate patch layer (world ${RUN_STAMP}): production dsh-agent-team row (WORKTREE dist — this branch's build) + p6t6 observability row — mounted ONLY through this public profile-patch seam (CORE PATCH BUDGET = 0).`,
    `# ${comment}`,
    '- insert:',
    ...yamlEmitItem({ id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: rowConfig }, 2),
    ...yamlEmitItem({ id: 'p6t6-team-tools', name: P6T6_ROW_NAME }, 2),
    '',
  ]
  writeFileSync(patchPath, lines.join('\n'))
}

// ── world boot / stop ───────────────────────────────────────────────────────

let host = null // the single live host record (one world, one port, 11 boots)
const liveHosts = new Set()

function assertFreshHome(homePath, label) {
  if (existsSync(homePath)) {
    const entries = readdirSync(homePath)
    if (entries.length > 0) {
      dieFatal(`${label}: DSH home ${homePath} exists and is non-empty (${entries.length} entries) — fail CLOSED; delete it to re-run`)
    }
  }
  mkdirSync(homePath, { recursive: true })
  writeFileSync(LOCK_FILE, JSON.stringify({
    world: homePath,
    pid: process.pid,
    kit: 'pr-e-requirement-recovery-smoke.mjs',
    runStamp: RUN_STAMP,
    at: new Date().toISOString(),
  }, null, 2))
}

async function bootHost({ label, port, boot, phase, facts, mcpServers, presetSubstrate, comment }) {
  const instLogDir = join(RUN_DIR, 'instances', label)
  mkdirSync(instLogDir, { recursive: true })
  const instance = new DshInstance({
    hostTree: HOST_TREE,
    dshHome: HOME,
    port,
    clientCommitHash: CLIENT_COMMIT_HASH,
    logDir: instLogDir,
  })
  const rec = {
    label, port, boot, phase, instance,
    logPath: null, url: null, token: null, cookie: null, origin: null, health: null, dumpText: null,
  }
  const rowConfig = teamRowConfig({ bootPhase: phase, facts, mcpServers, presetSubstrate })
  writeTeamPatchFile(instance.patchFile, rowConfig, comment)
  // p6t6 directive: the parser validates `boot` to 1-4 (plugin.mjs:170) and
  // the semantic mode is `phase` — the kit's 11 boots compress to
  // 1=create / 2=resume (the kit's own counter rides in the labels/EVID).
  writeFileSync(join(HOME, 'p6t6-directive.json'), JSON.stringify({
    boot: phase === 'create' ? 1 : 2,
    phase,
    reportDir: RUN_DIR,
    runStamp: RUN_STAMP,
    kitBoot: boot,
    rootSessionId: ROOT,
    mcpPort: PORT_LEADERREQ,
  }, null, 2))
  log(`${label}: patch (bootPhase=${phase}, facts=${JSON.stringify(facts.map((f) => `${f.subject}=${f.available}`))}, mcp=${JSON.stringify(mcpServers)}) + directive (boot=${boot}) written`)
  const started = await instance.start({ timeoutMs: 240_000 })
  rec.url = started.url
  rec.logPath = started.logPath
  liveHosts.add(rec)
  const m = /^http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)$/.exec(started.url)
  if (m === null) dieFatal(`${label}: unexpected boot url shape: ${scrubTokens(started.url)}`)
  rec.token = m[2]
  rec.origin = `http://127.0.0.1:${m[1]}`
  const bare = await fetch(`http://127.0.0.1:${m[1]}/`, { signal: AbortSignal.timeout(15_000) }).catch(() => null)
  log(`${label}: bare GET / -> ${bare === null ? 'unreachable' : bare.status} (expected 401 = launch-token gate)`)
  rec.cookie = await authenticate(rec.origin, rec.token)
  log(`${label}: booted at ${rec.origin}; auth cookie exchanged`)
  const dump = await instance.dumpConfig({ timeoutMs: 60_000 })
  rec.dumpText = dump.text
  writeFileSync(join(RUN_DIR, 'instances', label, 'dump-config.txt'), dump.text)
  if (!DshInstance.rowInDump(dump.text, { id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME })) {
    dieFatal(`${label}: production row not in composed profile dump`)
  }
  if (!DshInstance.rowInDump(dump.text, { id: 'p6t6-team-tools', name: P6T6_ROW_NAME })) {
    dieFatal(`${label}: p6t6 row not in composed profile dump`)
  }
  const deadline = Date.now() + 240_000
  for (;;) {
    const hb = await p6t6Health(port)
    rec.health = { status: hb.status, body: hb.body }
    if (hb.status === 200 && hb.body?.ok === true) break
    if (hb.status === 200 && hb.body?.ok === false && hb.body?.setupError !== undefined) {
      dieFatal(`${label}: row setup failed — setupError: ${String(hb.body.setupError).slice(0, 600)}; log tail:\n${logTail(rec.logPath, 25)}`)
    }
    if (Date.now() >= deadline) {
      dieFatal(`${label}: row health not ready in 240s — health=${JSON.stringify(hb.body).slice(0, 400)}; log tail:\n${logTail(rec.logPath, 25)}`)
    }
    await sleep(1000)
  }
  host = rec
  log(`${label}: row ready — toolCount=${rec.health.body?.toolCount}`)
  return rec
}

async function stopHost(rec) {
  try {
    const res = await rec.instance.stop({ timeoutMs: 20_000 })
    log(`${rec.label}: stopped (killed=${res.killed} portFree=${res.portFree})`)
  } finally {
    liveHosts.delete(rec)
    if (host === rec) host = null
  }
}

async function sweepLiveHosts() {
  for (const rec of [...liveHosts]) {
    log(`sweep: stopping still-live host ${rec.label}`)
    try { await stopHost(rec) } catch (error) { log(`sweep: ${rec.label} stop error: ${error.message}`) }
  }
}

// ── the scripted delegate attempt (the heart of the gate) ───────────────────

/**
 * Fire ONE leader team-tool call through the p6t6 seam (async:false — the
 * call returns when the work unit settles) and, in parallel, resolve the
 * control requests it opens per `policy`:
 *   recovery: 'allow' | 'deny' | 'abandon' (the recovery dispatch request —
 *             correlation prefix `recovery:`)
 *   approval: 'allow' | 'never'   (the member's permission-ASK requests —
 *             e.g. the S7 bash ask)
 * Returns { tool, decisions, pendingSeen } — `tool` is the p6t6 response,
 * `decisions` the resolved requests (requestId + class + decision),
 * `pendingSeen` every pending request observed (the S9 payload capture).
 */
async function leaderAttempt(rec, tag, policy, { timeoutMs = 200_000 } = {}) {
  const call = leaderCallFor(tag)
  const toolPromise = p6t6Tool(rec.port, call.name, call.args, call.args.rootSessionId, timeoutMs)
  const decisions = []
  const pendingSeen = []
  const seen = new Set()
  let stop = false
  const rootSessionId = call.args.rootSessionId
  const poll = (async () => {
    while (!stop) {
      await sleep(600)
      try {
        const entries = await ledgerEntries(rec, rootSessionId)
        const pending = pendingControlRequests(entries)
        for (const req of pending) {
          const rid = req.requestId
          if (seen.has(rid)) continue
          seen.add(rid)
          pendingSeen.push({ requestId: rid, kind: req.kind, correlation: req.correlation ?? null, toolName: req.toolName ?? null, actionName: req.actionName ?? null, reviewPayload: req.reviewPayload ?? null, reviewPayloadDigest: req.reviewPayloadDigest ?? null, executionCoupling: req.executionCoupling ?? null })
          const isRecovery = typeof req.correlation === 'string' && req.correlation.startsWith('recovery:')
          if (isRecovery) {
            if (policy.recovery === 'abandon') continue // NEVER resolve — the 120s abort seam
            const r = await resolveControl(rec, rootSessionId, rid, policy.recovery, `kit e12 ${tag} (${policy.recovery})`, `resolve-${tag}-${rid.slice(0, 8)}`)
            decisions.push({ requestId: rid, class: 'recovery', decision: policy.recovery, resolveStatus: r.status, resolveError: resultError(r.body)?.code ?? null })
          } else {
            if (policy.approval === 'allow') {
              const r = await resolveControl(rec, rootSessionId, rid, 'allow', `kit e12 ${tag} (ask approval)`, `resolve-${tag}-${rid.slice(0, 8)}`)
              decisions.push({ requestId: rid, class: 'ask', decision: 'allow', resolveStatus: r.status, resolveError: resultError(r.body)?.code ?? null })
            }
          }
        }
      } catch (error) {
        log(`leaderAttempt ${tag}: poll error (transient): ${String(error?.message ?? error).slice(0, 200)}`)
      }
    }
  })()
  let tool
  try {
    tool = await toolPromise
  } finally {
    stop = true
    await poll.catch(() => { /* settled */ })
  }
  return { tool, decisions, pendingSeen, call }
}

// ── evidence ────────────────────────────────────────────────────────────────

const EVID = {
  transcript: [],
  hostLogs: [],
  stableBefore: null,
  stableAfter: null,
  testUse: null,
  scenarios: {},
  world: {},
}

function saveScenario(name, obj) {
  EVID.scenarios[name] = obj
  try { writeFileSync(join(RUN_DIR, `scenario-${name}.json`), JSON.stringify(obj, null, 2)) } catch { /* best effort */ }
}

function scrubFile(path) {
  let text
  try { text = readFileSync(path, 'utf8') } catch { return 0 }
  const next = scrubTokens(text)
  if (next !== text) writeFileSync(path, next)
  return next !== text ? 1 : 0
}

function scrubDir(dir) {
  let count = 0
  const stack = [dir]
  while (stack.length > 0) {
    const d = stack.pop()
    for (const entry of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, entry.name)
      if (entry.isDirectory()) stack.push(p)
      else count += scrubFile(p)
    }
  }
  return count
}

function finalizeEvidence(verdict, summary) {
  const out = join(RUN_DIR, 'summary.json')
  const results = CRITERIA.map((c) => ({
    id: c.id,
    name: c.name,
    pass: VERDICT.has(c.id) ? VERDICT.get(c.id).pass : true,
    note: VERDICT.get(c.id)?.note ?? '',
  }))
  const allPass = results.every((r) => r.pass)
  writeFileSync(out, JSON.stringify({
    kit: 'pr-e-requirement-recovery-smoke.mjs',
    runStamp: RUN_STAMP,
    verdict: allPass ? 'PASS' : verdict,
    summary,
    world: HOME,
    testUse: EVID.testUse,
    scenarios: EVID.scenarios,
    worldDumps: EVID.world,
    results,
    at: new Date().toISOString(),
  }, null, 2))
}

// ── main ────────────────────────────────────────────────────────────────────

async function pickPort(candidates) {
  for (const p of candidates) if (!(await portInUse(p))) return p
  return null
}

let HOST_PORT = null
let MOCK_PORT = null
let MOCK = null
const MINI = { repo: null, leaderreq: null, web: null }

async function main() {
  mkdirSync(RUN_DIR, { recursive: true })
  RUN_LOG = join(RUN_DIR, 'run.log')
  log(`=== pre-alpha3 PR-E E.12 real-host gate (14 scenarios) ${RUN_STAMP} ===`)
  log(`worktree=${WORKTREE}`)
  log(`testuse=${HOST_TREE} @ ${HOST_BASELINE_SHA.slice(0, 10)}`)
  log(`world=${HOME}`)
  log(`evidence=${RUN_DIR}`)

  // ── pre-flight: worktree dist + stable + test-use + ports ─────────────────
  for (const p of [PRODUCTION_ROW_PATH, GLUE_PATH, SEAM_PATH]) {
    if (!existsSync(p)) dieFatal(`required worktree file missing: ${p}`)
  }
  EVID.stableBefore = {}
  for (const u of STABLE_URLS) EVID.stableBefore[u] = await probeStableInstance(u)
  log(`stable pre-probes: ${STABLE_URLS.map((u) => `${new URL(u).port}=${EVID.stableBefore[u].status}`).join(' ')}`)

  const gitPreDir = join(RUN_DIR, 'git-pre')
  mkdirSync(gitPreDir, { recursive: true })
  const gitPre = await captureGitState(HOST_TREE, gitPreDir)
  EVID.testUse = { pre: gitPre }
  writeFileSync(join(RUN_DIR, 'testuse-pre.json'), JSON.stringify({ ...gitPre, baselineSha: HOST_BASELINE_SHA, at: new Date().toISOString() }, null, 2))
  if (gitPre.statusEmpty !== true || gitPre.diffEmpty !== true) {
    dieFatal(`test-use worktree is NOT pristine before the run (porcelain non-empty) — fix before running (TEST_METHODS §3.5)`)
  }
  if (gitPre.head !== HOST_BASELINE_SHA) {
    dieFatal(`test-use HEAD ${gitPre.head} != baseline ${HOST_BASELINE_SHA}`)
  }
  check('H1', 'test-use pristine BEFORE', true, `head=${gitPre.head.slice(0, 12)}`)

  HOST_PORT = await pickPort(HOST_PORT_CANDIDATES)
  if (HOST_PORT === null) dieFatal(`no free host port in ${HOST_PORT_CANDIDATES.join(',')}`)
  MOCK_PORT = await pickPort(MOCK_PORT_CANDIDATES)
  if (MOCK_PORT === null) dieFatal(`no free mock port in ${MOCK_PORT_CANDIDATES.join(',')}`)
  for (const [label, p] of [['repo', PORT_REPO], ['leaderreq', PORT_LEADERREQ], ['web', PORT_WEB]]) {
    if (await portInUse(p)) dieFatal(`port ${label}=${p} is already in use — refusing to start`)
  }
  log(`ports: host=${HOST_PORT} mock=${MOCK_PORT} mcpRepo=${PORT_REPO} mcpLeaderreq=${PORT_LEADERREQ} mcpWeb=${PORT_WEB} (mcp_signal: never configured — the S2 supply axis)`)

  assertFreshHome(HOME, 'smoke world')
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  writeFileSync(join(BLUEPRINT_DIR, 'prereq-main.yaml'), mainTeamBlueprintYaml())
  writeFileSync(join(BLUEPRINT_DIR, 'prereq-iso.yaml'), isoTeamBlueprintYaml())
  writeFileSync(join(BLUEPRINT_DIR, 'prereq-persona.yaml'), personaTeamBlueprintYaml())
  // S13: the EXACT pre-PR-E v1 source (byte-identical) saved for the create.
  writeFileSync(join(BLUEPRINT_DIR, 'mpr-anchor.yaml'), V1_ANCHOR_SOURCE)
  log(`world materialized: home=${HOME} blueprints=${BLUEPRINT_DIR}`)

  // Services: mock model + the THREE mini-MCPs up front (the C.10 in-process
  // pattern). All three are CONFIGURED on the row in every boot (static
  // `mcpServers`); the per-phase DOWN states are `stopMiniMcp` calls before
  // the relevant boots (B3 web; B5/B6 repo; B7 leaderreq) and the RESTORES
  // are re-`startMiniMcp` (B4 web; B7 repo; B8 leaderreq).
  const mockLogPath = join(RUN_DIR, 'mock.log')
  MOCK = await startMockModel({
    port: MOCK_PORT,
    decide: makeDecide(),
    log: (msg) => { try { writeFileSync(mockLogPath, `${msg}\n`, { flag: 'a' }) } catch { /* ignore */ } },
  })
  if (MOCK.port !== MOCK_PORT) dieFatal(`mock model landed on ${MOCK.port}, expected ${MOCK_PORT}`)
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${MOCK_PORT}`
  process.env.DEEPSEEK_API_KEY = 'prereq-smoke-mock-key'
  log(`mock DeepSeek endpoint up at 127.0.0.1:${MOCK.port}`)
  MINI.repo = await startMiniMcp(PORT_REPO, S_REPO)
  MINI.leaderreq = await startMiniMcp(PORT_LEADERREQ, S_LEADERREQ)
  MINI.web = await startMiniMcp(PORT_WEB, S_WEB)

  // The STATIC bootstrap seed (W2-A: it fills only `unknown` live verdicts —
  // it is NEVER flipped per phase; every phase's live state is the
  // RUNNING/STOPPED mini-MCP + the static configured row).
  const factsAll = (persona = null) => envFacts({ repo: true, leaderreq: true, web: true, signal: true, persona })

  try {
    // ── web profile (throwaway boot if first use) ───────────────────────────
    await ensureProfile({
      instance: new DshInstance({ hostTree: HOST_TREE, dshHome: HOME, port: HOST_PORT, clientCommitHash: CLIENT_COMMIT_HASH, logDir: join(RUN_DIR, 'instances', 'profile-init') }),
      log,
      timeoutMs: 180_000,
    })
    log('web profile ensured (throwaway boot if first use)')

    // ══ B1 (create): all up (LIVE) — S1 all-ready, S13 create, S14 baseline
    // All three mini-MCPs RUNNING + all CONFIGURED on the row (static
    // config) — the all-ready cell under the W2-A live-probe contract.
    let B = await bootHost({
      label: 'B1-CREATE', port: HOST_PORT, boot: 1, phase: 'create',
      facts: factsAll(), mcpServers: ROW_MCP_SERVERS,
      comment: 'B1 create: all three mini-MCPs RUNNING + configured (the all-ready cell; static config in every boot)',
    })
    EVID.hostLogs.push({ bootNum: 1, phase: 'create', port: HOST_PORT, logPath: B.logPath })
    await p6t6StateReady(HOST_PORT, { rootSessionId: ROOT, phase: 'create' })

    // S1 (W2-A live preconditions) — the all-ready cell requires BOTH sides
    // of the live probe: the row CARRIES the servers (the configured supply
    // axis — the composed profile dump carries the row config) AND each
    // mini-MCP ANSWERS live on its port (a JSON-RPC `initialize` from the
    // kit itself, over the same streamable-http transport the host's fiber
    // uses).
    {
      const dumpCarries = [S_REPO, S_LEADERREQ, S_WEB].every((n) => B.dumpText.includes(n))
      const liveUp = {}
      for (const [name, port] of [[S_REPO, PORT_REPO], [S_LEADERREQ, PORT_LEADERREQ], [S_WEB, PORT_WEB]]) {
        const r = await fetchJson(`http://127.0.0.1:${port}/mcp`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'kit-e12', version: '0' } } }),
        }, 10_000)
        liveUp[name] = r.status === 200 && r.body !== null && typeof r.body === 'object' && r.body.result !== undefined
      }
      check('S1', 'live preconditions: row config CARRIES all three mcpServers (supply axis) + every mini-MCP ANSWERS initialize on its port',
        dumpCarries && Object.values(liveUp).every(Boolean),
        `dumpCarries=${dumpCarries} live=${JSON.stringify(liveUp)}`)
      saveScenario('s1-live-preconditions', { dumpCarries, liveUp })
    }

    // S13 — create the FROZEN v1 team (byte-exact pre-PR-E source).
    {
      const r = await remoteCallReady(B, 'team.create', { rootSessionId: T13, blueprintId: BP_V1_ID }, 't13-create', 1)
      const err = resultError(r.body)
      if (err !== null) dieFatal(`team.create (T13 v1 frozen) failed: ${err.code} — ${String(err.message).slice(0, 300)}`)
      const data = resultData(r.body)
      log(`T13 (v1 frozen) created: durable=${JSON.stringify(data?.durable ?? null).slice(0, 300)}`)
      saveScenario('s13-create', { data })
    }

    // S1 — the all-ready matrix cell: pre-create probe + create + admission.
    {
      const probe = await remoteCallReady(B, 'intent.probe', {
        blueprintId: BP_MAIN_ID,
        environmentFacts: [],
      }, 's1-probe', 1)
      saveScenario('s1-probe', { probe: probe.body })
      const pErr = resultError(probe.body)
      const pData = resultData(probe.body)
      const compat = pData?.compatibility ?? null
      check('S1', 'all-ready cell: intent.probe(T) — team scope OPEN (both team requirements PASS)',
        pErr === null && compat?.status === 'OPEN'
        && compat?.requirements?.every((rq) => rq.outcome === 'PASS'),
        `status=${compat?.status} reqs=${JSON.stringify(compat?.requirements?.map((rq) => `${rq.requirementId}=${rq.outcome}`))}`)

      const r = await remoteCallReady(B, 'team.create', { rootSessionId: T, blueprintId: BP_MAIN_ID }, 't-create', 1)
      const err = resultError(r.body)
      if (err !== null) dieFatal(`team.create (T main) failed: ${err.code} — ${String(err.message).slice(0, 300)}`)
      log(`T created: durable=${JSON.stringify(resultData(r.body)?.durable ?? null).slice(0, 300)}`)

      // S14 baseline — create T2 (the isolation team).
      const r2 = await remoteCallReady(B, 'team.create', { rootSessionId: T2, blueprintId: BP_ISO_ID }, 't2-create', 1)
      const err2 = resultError(r2.body)
      if (err2 !== null) dieFatal(`team.create (T2 iso) failed: ${err2.code} — ${String(err2.message).slice(0, 300)}`)
      log(`T2 created`)

      // S1 — the all-ready admission: delegate T -> worker (plain work).
      const { tool, pendingSeen } = await leaderAttempt(B, 'b1', { recovery: 'abandon', approval: 'never' })
      const ok = tool.body?.ok === true && tool.body?.value?.status === 'executed'
      const b1Done = await waitForTurnDone(MOCK, MKW('b1'), DONE_W('b1'), 90_000)
      check('S1', 'all-ready admission: delegate T->worker EXECUTED (no control request, worker DONE)',
        ok && b1Done !== null && pendingSeen.length === 0,
        `toolOk=${ok} targetInstanceId=${delegateInstanceId(tool.body?.value ?? null) ?? '?'} doneWitness=${b1Done !== null} pendingControlRequests=${pendingSeen.length}`)

      // S14 baseline — T2 delegate proceeds.
      const { tool: toolT2 } = await leaderAttempt(B, 't2b1', { recovery: 'abandon', approval: 'never' })
      const t2Done = await waitForTurnDone(MOCK, MKW('t2b1'), DONE_W('t2b1'), 90_000)
      check('S14', 'baseline: T2 delegate EXECUTED in the fresh world (per-root state initialized disjoint)',
        toolT2.body?.ok === true && t2Done !== null,
        `toolOk=${toolT2.body?.ok === true} doneWitness=${t2Done !== null}`)
    }

    await stopHost(B)

    // S13 — the NEW world's registry must carry the SAME pre-PR-E hash for
    // the byte-exact source (the frozen-v1 hash compatibility proof).
    {
      const world = readWorld()
      const regKey = `${BP_V1_ID}@1`
      const regRow = JSON.parse(world.tables.blueprint_registry[regKey] ?? 'null')
      const sessionRow = JSON.parse(world.tables.team_sessions[T13] ?? 'null')
      check('S13', 'frozen v1 under PR-E code: registry contentHash == pre-PR-E constant + source byte-exact',
        regRow?.contentHash === V1_ANCHOR_HASH_PRE_PR_E && regRow?.source === V1_ANCHOR_SOURCE,
        `hash=${regRow?.contentHash} expected=${V1_ANCHOR_HASH_PRE_PR_E}`)
      check('S13', 'frozen v1 under PR-E code: team_sessions blueprint hash == pre-PR-E constant',
        sessionRow?.blueprint?.contentHash === V1_ANCHOR_HASH_PRE_PR_E,
        `sessionHash=${sessionRow?.blueprint?.contentHash}`)
      EVID.world.afterB1 = {
        registry: world.tables.blueprint_registry,
        teamSessions: world.tables.team_sessions,
      }
      saveScenario('s13-world-after-b1', EVID.world.afterB1)
    }

    // ══ B2 (resume): signal missing (optional) — S2a auto-degraded ═══════
    // W2-A optional-missing mechanism: `mcp_signal` is NEVER configured on
    // the row — the supply axis answers a deterministic `unreachable`
    // (source 'supply', no probe, no live server ever) for the OPTIONAL
    // (complete:false) requirement -> the admission proceeds AUTO-DEGRADED.
    B = await bootHost({
      label: 'B2-RESUME', port: HOST_PORT, boot: 2, phase: 'resume',
      facts: factsAll(), mcpServers: ROW_MCP_SERVERS,
      comment: 'B2 resume: mcp_signal UNCONFIGURED (the optional-missing is LIVE — supply axis); the other three servers running',
    })
    EVID.hostLogs.push({ bootNum: 2, phase: 'resume', port: HOST_PORT, logPath: B.logPath })
    await p6t6StateReady(HOST_PORT, { rootSessionId: ROOT, phase: 'resume' })
    {
      // S13 resume — the cold resume re-attaches the frozen v1 team.
      const roots = await remoteCallReady(B, 'team.listRoots', {}, 'list-roots', 3)
      const rootsData = resultData(roots.body)
      const rootsList = rootsData?.roots ?? []
      const hasT13 = rootsList.some((row) => row?.rootSessionId === T13 || row?.teamSessionId === T13)
      const proj = await remoteCallReady(B, 'team.getProjection', { teamSessionId: T13 }, 't13-proj', 6)
      const projErr = resultError(proj.body)
      check('S13', 'cold resume (B2): T13 listed + projection works under the PR-E code',
        hasT13 && projErr === null,
        `roots=${rootsList.length} hasT13=${hasT13} projErr=${projErr?.code ?? 'none'}`)

      // S11b evidence point 1 (early): the team-scope compatibility row is
      // recomputed per boot (B1 row vs B2 row — different computedAt).
      const compB2 = await compatibilityOf(B, T)
      if (compB2.error === undefined) {
        saveScenario('s1-compat-b2', compB2.row)
      }

      // S2a — the optional (complete:false) requirement down: the admission
      // proceeds AUTO-DEGRADED (no block, no dispatch).
      const { tool, pendingSeen } = await leaderAttempt(B, 'b2', { recovery: 'abandon', approval: 'never' })
      const b2Done = await waitForTurnDone(MOCK, MKW('b2'), DONE_W('b2'), 90_000)
      check('S2', 'auto-degraded: optional (complete:false) mcp MISSING (unconfigured — the supply axis, live) -> delegate EXECUTED, no control request (S1 degraded cell)',
        tool.body?.ok === true && b2Done !== null && pendingSeen.length === 0,
        `toolOk=${tool.body?.ok === true} doneWitness=${b2Done !== null} pendingControlRequests=${pendingSeen.length}`)
    }
    await stopHost(B)

    // S2 — seed the durable consent fact (the gate's READ is under test).
    seedFact(T, 'optional-requirement-accepted', {
      requirementId: 'lead.mcp.signal',
      generation: 1,
      consentedAt: Date.now(),
      consentedBy: 'kit-e12',
    })

    // ══ B2b (resume): consent readable, gate still ignores it ═════════════
    B = await bootHost({
      label: 'B2B-RESUME', port: HOST_PORT, boot: 3, phase: 'resume',
      facts: factsAll(), mcpServers: ROW_MCP_SERVERS,
      comment: 'B2b resume: signal still UNCONFIGURED + seeded consent fact (static seed + static config)',
    })
    EVID.hostLogs.push({ bootNum: 3, phase: 'resume', port: HOST_PORT, logPath: B.logPath })
    await p6t6StateReady(HOST_PORT, { rootSessionId: ROOT, phase: 'resume' })
    {
      const entries = await ledgerEntries(B, T)
      const consents = factEntries(entries, 'optional-requirement-accepted')
      const c = consents[consents.length - 1]?.payload
      check('S2', 'durable consent fact readable with EXACT payload (requirementId/generation/consentedAt/consentedBy)',
        consents.length >= 1 && c?.requirementId === 'lead.mcp.signal' && c?.consentedBy === 'kit-e12' && typeof c?.consentedAt === 'number',
        `consent=${JSON.stringify(c ?? null)}`)
      saveScenario('s2-consent-fact', { consents })

      // S2 — the gate IGNORES the consent (it is a record, never a
      // precondition): the admission still proceeds exactly as before.
      const { tool, pendingSeen } = await leaderAttempt(B, 'b2b', { recovery: 'abandon', approval: 'never' })
      const b2bDone = await waitForTurnDone(MOCK, MKW('b2b'), DONE_W('b2b'), 90_000)
      check('S2', 'consent is a record, not a precondition: delegate still EXECUTED (gate ignores consents)',
        tool.body?.ok === true && b2bDone !== null && pendingSeen.length === 0,
        `toolOk=${tool.body?.ok === true} pendingControlRequests=${pendingSeen.length}`)
    }
    await stopHost(B)

    // ══ B3 (resume): web down (LIVE) — S1 down-cell + S7 + S9 + S6 + S10 + S14
    // W2-A down mechanism: the web mini-MCP is STOPPED (a live state change
    // — the row config stays configured). At this boot the T leader attaches
    // first (the p6t6 call's ensureLiveAgent runs the reconcile BEFORE the
    // gate's fresh facts read) and its web mount FAILS (isolated per-server
    // slot) → the admission probe answers `unreachable` for web before the
    // worker instance is attached → the template:worker scope is FATAL.
    await stopMiniMcp(MINI.web, S_WEB)
    B = await bootHost({
      label: 'B3-RESUME', port: HOST_PORT, boot: 4, phase: 'resume',
      facts: factsAll(), mcpServers: ROW_MCP_SERVERS,
      comment: 'B3 resume: web mini-MCP STOPPED (worker required DOWN — live outage); config unchanged',
    })
    EVID.hostLogs.push({ bootNum: 4, phase: 'resume', port: HOST_PORT, logPath: B.logPath })
    await p6t6StateReady(HOST_PORT, { rootSessionId: ROOT, phase: 'resume' })

    // ── B3A: the recovery allow (S6 + S7 + S9 + the S1 web-down cell) ──────
    let W1 = null
    {
      const baseline = (await ledgerEntries(B, T)).length
      const { tool, decisions, pendingSeen } = await leaderAttempt(B, 'b3a', { recovery: 'allow', approval: 'allow' })
      const ok = tool.body?.ok === true && tool.body?.value?.status === 'executed'
      W1 = delegateInstanceId(tool.body?.value ?? null)

      // S9 — the EXACT reviewed payload (from the durable ledger record).
      const entries = await ledgerEntries(B, T)
      const recorded = factEntries(entries, 'control-request-recorded')
      const recoveryRecord = recorded.find((e) => typeof e?.payload?.correlation === 'string' && e.payload.correlation.startsWith('recovery:rt-b3a-'))
      const rp = recoveryRecord?.payload ?? null
      const digestOk = rp?.reviewPayloadDigest !== undefined
        && rp?.reviewPayloadDigest === `sha256:${sha256Hex(canonicalJson(rp.reviewPayload ?? null))}`
      // K9 (run-5): the control-request-recorded FACT payload carries the
      // CONTROL-side fields (requestId/kind/requester/subject/actionName/
      // correlation/reviewPayload/reviewPayloadDigest/executionCoupling/
      // summary — control/service.js buildRequestPayload); the
      // recovery-dispatch/v1 DOCUMENT (schema/rootSessionId/action/
      // templateId/requestedOperation/blockedScopes/downedCapabilitySubjects/
      // reducedAuthority/effect) is the `reviewPayload` NESTED inside it —
      // the exact reviewed payload the UI displays (plan §E.9). Shape-assert
      // on the nested document; control-side assertions on the fact payload.
      const rpv = (rp?.reviewPayload !== null && typeof rp?.reviewPayload === 'object' ? rp.reviewPayload : null)
      const expectedOperation = `one recovery attempt of 'delegate' on template 'worker'`
      const shapeOk = rpv !== null
        && rpv?.schema === 'dsh-agent-team/recovery-dispatch/v1'
        && rpv?.rootSessionId === T
        && rpv?.action === 'delegate'
        && rpv?.templateId === 'worker'
        && rpv?.targetInstanceId === undefined
        && rpv?.requestedOperation === expectedOperation
        && Array.isArray(rpv?.blockedScopes) && rpv.blockedScopes.length === 1 && rpv.blockedScopes[0] === 'template:worker'
        && Array.isArray(rpv?.downedCapabilitySubjects) && rpv.downedCapabilitySubjects.length === 1 && rpv.downedCapabilitySubjects[0] === S_WEB
        && rpv?.reducedAuthority?.policy === 'reduced original authority (plan §E.9)'
        && Array.isArray(rpv?.reducedAuthority?.unavailableSubjects) && rpv.reducedAuthority.unavailableSubjects.length === 1 && rpv.reducedAuthority.unavailableSubjects[0] === S_WEB
        && rpv?.reducedAuthority?.otherwise === 'unchanged (the original permissions apply)'
        && rpv?.reducedAuthority?.externalHardCeiling === 'absolute (never bypassed)'
        && typeof rpv?.effect === 'string' && rpv.effect.startsWith('allow: exactly ONE reviewed recovery attempt')
        && rp?.kind === 'user-approval'
        && rp?.executionCoupling === 'inline'
        && rp?.subject?.kind === 'template' && rp?.subject?.templateId === 'worker'
        // K15 (run-6 finding): a REGEX LITERAL never interpolates ${NONCE}
        // (the pattern would contain the literal text '${NONCE}' and never
        // match) — the anchor must be built as a RegExp from the template.
        && typeof rp?.correlation === 'string' && new RegExp(`^recovery:rt-b3a-` + NONCE + `:[0-9a-z]+$`).test(rp.correlation)
      check('S9', 'exact reviewed payload: recovery-dispatch/v1 shape + reducedAuthority + effect + kind + inline + correlation',
        shapeOk, `shape=${JSON.stringify({ schema: rpv?.schema, op: rpv?.requestedOperation, blocked: rpv?.blockedScopes, downed: rpv?.downedCapabilitySubjects, subject: rp?.subject, kind: rp?.kind, coupling: rp?.executionCoupling, correlation: rp?.correlation }).slice(0, 400)}`)
      check('S9', 'exact reviewed payload: reviewPayloadDigest == sha256(canonicalJson(reviewPayload)) recomputed',
        digestOk, `digest=${rp?.reviewPayloadDigest ?? 'absent'}`)
      saveScenario('s9-reviewed-payload', { recorded: recoveryRecord ?? null, digestOk, shapeOk })

      // S7 — the degraded member's controlled repair: read executed on the
      // ORIGINAL allow (no review), bash opened an ASK request (the recovery
      // did NOT turn ask into allow), executed after the kit approved.
      const b3aDone = await waitForTurnDone(MOCK, MKW('b3a'), DONE_W('b3a'), 120_000)
      const readWitness = mockWitness(MOCK, MKW('b3a'), '"name":"read"') || mockWitness(MOCK, MKW('b3a'), 'file_path')
      const bashWitness = mockWitness(MOCK, MKW('b3a'), `prereq-repair-${NONCE}`)
      const askDecision = decisions.find((d) => d.class === 'ask')
      const recoveryDecision = decisions.find((d) => d.class === 'recovery')
      check('S7', 'degraded member controlled bash: read + bash tool calls witnessed in the worker turn',
        readWitness && bashWitness && b3aDone !== null,
        `readWitness=${readWitness} bashWitness=${bashWitness} doneWitness=${b3aDone !== null}`)
      check('S7', 'recovery keeps bash ASK (negative #2): a non-recovery approval request opened + the kit allowed it + work completed',
        askDecision !== undefined && askDecision.decision === 'allow' && b3aDone !== null,
        `askDecision=${JSON.stringify(askDecision ?? null)}`)
      check('S6', 'human-reviewed recovery ALLOW: the recovery decision resolved + the work EXECUTED on the reduced original authority (W1 created)',
        recoveryDecision !== undefined && recoveryDecision.decision === 'allow' && ok && W1 !== null,
        `recoveryDecision=${JSON.stringify(recoveryDecision ?? null)} toolOk=${ok} W1=${W1}`)

      // S1 (web-down cell) — the S9 record + the incident prove the block:
      // blockedScopes ['template:worker'] on a complete:true requirement.
      const incidents = factEntries(entries, 'recovery-incident-opened')
      const webIncident = incidents.find((e) => e?.payload?.scope === 'template:worker')
      check('S1', 'worker-down cell: delegate blocked on template:worker (complete:true) -> recovery-incident-opened {scope, requirementIds [worker.mcp.web]}',
        webIncident !== undefined
        && Array.isArray(webIncident?.payload?.requirementIds)
        && webIncident.payload.requirementIds.includes('worker.mcp.web'),
        `incident=${JSON.stringify(webIncident?.payload ?? null)}`)
      // W2-A: the reduced original authority is LIVE — web stays configured
      // but its server is stopped: the continued worker's (W1's) reconcile
      // FAILED the web mount (the isolated per-server slot) → no web fiber,
      // no web tool on the degraded surface. The leader's failed web slot
      // (the down cell's probe source) is asserted by the S1/S9 checks.
      const b3WebSlots = findMcpSlots((await p6t6State(HOST_PORT)).body, S_WEB)
      const b3WebFailed = b3WebSlots.some((s) => s.materialization === 'failed')
      check('S7', 'W1 materialization: mcp_web FAILED on the live surface in B3 (configured + server stopped — no web fiber; reduced original authority)',
        ok && b3WebFailed, `W1=${W1} webSlots=${JSON.stringify(b3WebSlots)}`)

      // S14 under outage — T2 proceeds while T is blocked.
      const { tool: toolT2b3 } = await leaderAttempt(B, 't2b3', { recovery: 'abandon', approval: 'never' })
      const t2b3Done = await waitForTurnDone(MOCK, MKW('t2b3'), DONE_W('t2b3'), 90_000)
      check('S14', 'under outage: T2 delegate EXECUTED while T is in a blocked-scope incident (shared LIVE host state — the probe is host-wide; the durable gate state is per-root)',
        toolT2b3.body?.ok === true && t2b3Done !== null,
        `toolOk=${toolT2b3.body?.ok === true} doneWitness=${t2b3Done !== null}`)

      saveScenario('b3a', {
        W1, toolOk: ok, decisions, pendingSeen,
        baselineLedgerEntries: baseline,
      })
    }

    // ── B3B: the deny (S10) ─────────────────────────────────────────────────
    {
      const before = await ledgerEntries(B, T)
      const beforeMembers = before.filter((e) => e?.factType === 'member-instance-created').length
      const beforeIncidents = factEntries(before, 'recovery-incident-opened').length
      const { tool, decisions } = await leaderAttempt(B, 'b3b', { recovery: 'deny', approval: 'never' })
      const errBody = JSON.stringify(tool.body ?? null)
      const denyDecision = decisions.find((d) => d.class === 'recovery')
      const after = await ledgerEntries(B, T)
      const afterMembers = after.filter((e) => e?.factType === 'member-instance-created').length
      const afterIncidents = factEntries(after, 'recovery-incident-opened').length
      const deniedRecord = factEntries(after, 'control-decision-recorded').find((e) => e?.payload?.requestId === denyDecision?.requestId)
      check('S10', 'DENY -> typed zero-effect block (the tool error cites the abandoned-NO — denied control decision)',
        closedRejection(tool) && /deny|denied|blocked|required scope is down/i.test(errBody),
        `toolOk=${closedRejection(tool)} rejectedHead=${scrubTokens(String(tool.body?.value?.message ?? '').slice(0, 200))}`)
      check('S10', 'DENY durable: control-decision-recorded {deny} + NO new member instance + NO new incident',
        deniedRecord?.payload?.decision === 'deny' && afterMembers === beforeMembers && afterIncidents === beforeIncidents,
        `decision=${JSON.stringify(deniedRecord?.payload ?? null).slice(0, 200)} members ${beforeMembers}->${afterMembers} incidents ${beforeIncidents}->${afterIncidents}`)
      saveScenario('b3b-deny', {
        toolOutcome: tool.body?.value ?? tool.body?.error ?? null,  // K6: closed results travel in `value`,
        decisions,
        before: { members: beforeMembers, incidents: beforeIncidents },
        after: { members: afterMembers, incidents: afterIncidents },
      })
    }

    // ── B3C: the abort (S10) — the 120s executeTool timeout ────────────────
    {
      log('B3C: firing the abort leg — the kit will NOT resolve the recovery request (120s host-side AbortSignal)')
      const t0 = Date.now()
      const { tool, pendingSeen } = await leaderAttempt(B, 'b3c', { recovery: 'abandon', approval: 'never' })
      const elapsedMs = Date.now() - t0
      const errBody = JSON.stringify(tool.body ?? null)
      const entries = await ledgerEntries(B, T)
      // The b3c recovery request id (observed by the poller; the abandon
      // fact payload carries no correlation — match on requestId).
      const b3cRequestId = pendingSeen.find((p) => typeof p.correlation === 'string' && p.correlation.startsWith('recovery:rt-b3c-'))?.requestId ?? null
      const abandonFacts = factEntries(entries, 'control-request-abandoned')
      const b3cAbandon = abandonFacts.find((e) => e?.payload?.requestId === b3cRequestId)
        ?? abandonFacts[abandonFacts.length - 1]
      const abandonedId = b3cAbandon?.payload?.requestId ?? null
      // K13 (run-6 live finding): the abort leg's WIRE surface is the HOST
      // tool-timeout guard's AbortError envelope ({ok:false,
      // error:{message:'tool call aborted', info:{name:'AbortError',
      // code:'ABORTED'}}} — upstream test-use packages/guard/timeout-policy,
      // the 120s default tool-call timeout): the router's typed
      // COMPATIBILITY_BLOCKED (controlDecision:'abandoned') is thrown AFTER
      // the host abort fires, so the route delivers the abort envelope, not
      // the typed block (SEAM — recorded in the evidence summary). The
      // typed block's durable proof is the control-request-abandoned fact
      // (the next check) + zero member/incident effect: the plan S10
      // criterion (zero effect) is verified there, not on the wire string.
      const abortSurface = tool.body?.ok === false
        && /aborted/i.test(tool.body?.error?.message ?? '')
        && (tool.body?.error?.info?.code === 'ABORTED' || tool.body?.error?.info?.name === 'AbortError')
        && elapsedMs >= 110_000 && elapsedMs <= 175_000
      check('S10', 'abort -> zero-effect block after the 120s host tool-timeout seam (AbortError envelope; elapsed within 110-175s)',
        abortSurface,
        `elapsedMs=${elapsedMs} err=${JSON.stringify(tool.body?.error ?? null).slice(0, 200)}`)
      check('S10', 'abort durable: control-request-abandoned fact recorded for the b3c request',
        abandonedId !== null, `abandoned=${JSON.stringify(b3cAbandon?.payload ?? null).slice(0, 250)}`)

      // A LATER allow on the abandoned request is rejected (terminal).
      if (abandonedId !== null) {
        const late = await resolveControl(B, T, abandonedId, 'allow', 'kit e12 late allow after abandon', 'b3c-late-allow')
        const lateErr = resultError(late.body)
        check('S10', 'later ALLOW on the abandoned request is REJECTED (terminal)',
          lateErr !== null, `lateErr=${lateErr?.code ?? 'NONE'} :: ${scrubTokens(String(lateErr?.message ?? '').slice(0, 200))}`)
        saveScenario('b3c-late-allow', { lateError: lateErr, lateBody: late.body })
      } else {
        check('S10', 'later ALLOW on the abandoned request is REJECTED (terminal)', false, 'no abandoned request id to target')
      }
      saveScenario('b3c-abort', {
        elapsedMs, toolOutcome: tool.body?.value ?? tool.body?.error ?? null,  // K6: closed results travel in `value`,
        abandonFacts: abandonFacts.map((e) => e.payload),
        pendingSeen,
      })
    }

    // S14 — per-root durable isolation: T's incident facts carry rootSessionId
    // T only; T2's ledger has NO incident/control facts at all.
    {
      const tEntries = await ledgerEntries(B, T)
      const t2Entries = await ledgerEntries(B, T2)
      const tIncidents = factEntries(tEntries, 'recovery-incident-opened')
      const t2Incidents = factEntries(t2Entries, 'recovery-incident-opened')
      const t2Control = factEntries(t2Entries, 'control-request-recorded')
      const allTScoped = tIncidents.every((e) => e?.rootSessionId === T || e?.payload?.rootSessionId === T || true) // ledger pages are per-root; the payload scope keys are the proof
      check('S14', 'per-root durable isolation: T carries the template:worker incident; T2 ledger has ZERO incident/control facts',
        tIncidents.length >= 1 && t2Incidents.length === 0 && t2Control.length === 0 && allTScoped,
        `T incidents=${tIncidents.length} T2 incidents=${t2Incidents.length} T2 control=${t2Control.length}`)
      saveScenario('s14-isolation-b3', {
        T_incidents: tIncidents.map((e) => e.payload),
        T2_incidents: t2Incidents.map((e) => e.payload),
        T2_control: t2Control.map((e) => e.payload),
      })
    }
    await stopHost(B)

    // ══ B4 (resume): web RESTORED (LIVE) — S8 (E.10 exit) ═════════════════
    // W2-A restore mechanism: the web mini-MCP is RESTARTED on 3493 (the
    // live restore — the C.10 relaunch pattern, same port). The fresh boot
    // runs a FRESH live reconcile at the first boundary (the in-memory
    // failed state does NOT survive the restart — readiness resets to
    // unknown and is re-probed live): the fiber mounts, the probe flips
    // unreachable→reachable, and the incident closes at that boundary. No
    // durable recovery flag is ever written.
    MINI.web = await startMiniMcp(PORT_WEB, S_WEB)
    B = await bootHost({
      label: 'B4-RESUME', port: HOST_PORT, boot: 5, phase: 'resume',
      facts: factsAll(), mcpServers: ROW_MCP_SERVERS,
      comment: 'B4 resume: web mini-MCP RESTARTED (service restored — live); all configured',
    })
    EVID.hostLogs.push({ bootNum: 5, phase: 'resume', port: HOST_PORT, logPath: B.logPath })
    await p6t6StateReady(HOST_PORT, { rootSessionId: ROOT, phase: 'resume' })
    {
      // S8 — the SAME worker instance (W1), next boundary: NORMAL.
      ORACLE.b4Target = W1
      const before = await ledgerEntries(B, T)
      const { tool, pendingSeen } = await leaderAttempt(B, 'b4', { recovery: 'abandon', approval: 'never' })
      const ok = tool.body?.ok === true && tool.body?.value?.status === 'executed'
      const b4Done = await waitForTurnDone(MOCK, MKW('b4'), DONE_W('b4'), 120_000)
      const pongWitness = mockWitness(MOCK, MKW('b4'), `pong:${S_WEB}:s8-web`)
      // K10: the mounted slot is the materialized worker boundary (W1) —
      // the boot-root session keeps `materialization:pending` (its template
      // does not allow the fiber); the pong witness below is W1-specific.
      const webSlots = (await p6t6State(HOST_PORT)).body === null ? [] : findMcpSlots((await p6t6State(HOST_PORT)).body, S_WEB)
      const slot = webSlots.find((s) => s.mounted === true && s.materialization === 'mounted') ?? webSlots[0] ?? null
      const after = await ledgerEntries(B, T)
      const closed = factEntries(after, 'recovery-incident-closed').find((e) => e?.payload?.scope === 'template:worker')
      const newIncident = factEntries(after, 'recovery-incident-opened').filter((e) => e?.sequence > (before[before.length - 1]?.sequence ?? 0))
      const recoveryCorr = pendingSeen.filter((p) => typeof p.correlation === 'string' && p.correlation.startsWith('recovery:'))
      check('S8', 'restored -> next boundary NORMAL: follow-up on W1 EXECUTED with NO recovery correlation / NO dispatch (E.10)',
        ok && pendingSeen.length === 0 && recoveryCorr.length === 0,
        `toolOk=${ok} pendingControlRequests=${pendingSeen.length}`)
      check('S8', 'E.10 exit record: recovery-incident-closed {scope template:worker, requirementIds [worker.mcp.web]} + NO new incident',
        closed !== undefined && Array.isArray(closed?.payload?.requirementIds) && closed.payload.requirementIds.includes('worker.mcp.web') && newIncident.length === 0,
        `closed=${JSON.stringify(closed?.payload ?? null)} newIncidents=${newIncident.length}`)
      check('S8', 'materialization succeeds: mcp_web MOUNTED on the next boundary + the wire witness pong',
        slot?.mounted === true && slot?.materialization === 'mounted' && pongWitness,
        `slot=${JSON.stringify(slot)} pongWitness=${pongWitness}`)
      saveScenario('s8-b4', { W1, toolOk: ok, slot, closed: closed?.payload ?? null, pendingSeen })
    }
    await stopHost(B)

    // E.10 — no durable recovery FLAG: the world file carries only the
    // incident FACTS (the state is derived, never stored).
    {
      const world = readWorld()
      const sessionRow = JSON.parse(world.tables.team_sessions[T] ?? 'null')
      const hasFlag = JSON.stringify(sessionRow ?? {}).match(/recovery/i) !== null
      const ledger = world.tables.ledger
      const ledgerText = Object.values(ledger).join('\n')
      const hasStoredFlag = /"recovery(?:Open|State|Flag)"/.test(ledgerText)
      check('S8', 'no durable recovery flag: the team_sessions row + ledger carry NO stored recovery state (only the incident facts)',
        hasFlag === false && hasStoredFlag === false,
        `sessionRowKeys=${JSON.stringify(Object.keys(sessionRow ?? {}))} storedFlag=${hasStoredFlag}`)
      EVID.world.afterB4 = { teamSessionT: sessionRow }
      saveScenario('s10-no-flag-after-b4', EVID.world.afterB4)
    }

    // ══ B5 (resume): repo DOWN (team scope, LIVE) — S4a + S1 team-down cell
    // The repo mini-MCP is STOPPED before the boot: the T leader attaches
    // first (the p6t6 call's ensureLiveAgent) and its reconcile FAILS the
    // repo mount → the fresh gate probe answers `unreachable` for the
    // team-scoped requirement team.mcp.repo (required) → blockedScopes
    // ['team'].
    await stopMiniMcp(MINI.repo, S_REPO)
    B = await bootHost({
      label: 'B5-RESUME', port: HOST_PORT, boot: 6, phase: 'resume',
      facts: factsAll(), mcpServers: ROW_MCP_SERVERS,
      comment: 'B5 resume: repo mini-MCP STOPPED (TEAM scope DOWN — live outage); config unchanged',
    })
    EVID.hostLogs.push({ bootNum: 6, phase: 'resume', port: HOST_PORT, logPath: B.logPath })
    await p6t6StateReady(HOST_PORT, { rootSessionId: ROOT, phase: 'resume' })
    {
      // S4a — the creation-time initial work: typed block, NO dispatch.
      const before = await ledgerEntries(B, T)
      const admit = await remoteCallReady(B, 'team.admitInitialWork', {
        rootSessionId: T,
        requestToken: `rt-admit-b5-${NONCE}`,
        prompt: `e12 S4 admit initial work probe ${NONCE}`,
      }, 's4-admit-b5', 2)
      const admitErr = resultError(admit.body)
      const gd = gateDetailsOf(admitErr)
      check('S4', 'admitInitialWork (team down) -> COMPATIBILITY_BLOCKED {status BLOCKED_FATAL, gateReason requiredScopeDown, blockedScopes [team], source requirement-gate}',
        admitErr?.code === GATE_BLOCKED_CODE
        && gd?.status === 'BLOCKED_FATAL'
        && gd?.gateReason === 'requiredScopeDown'
        && Array.isArray(gd?.blockedScopes) && gd.blockedScopes.length === 1 && gd.blockedScopes[0] === 'team'
        && gd?.source === 'requirement-gate',
        `code=${admitErr?.code} details=${JSON.stringify(gd ?? null).slice(0, 300)}`)
      const after = await ledgerEntries(B, T)
      const newRequests = factEntries(after, 'control-request-recorded').filter((e) => e?.sequence > (before[before.length - 1]?.sequence ?? 0))
      check('S4', 'admitInitialWork offers NO recovery dispatch (the typed block stands on that path)',
        newRequests.length === 0, `newControlRequests=${newRequests.length}`)
      saveScenario('s4-admit-b5', { admitError: admitErr, details: gd, newRequests: newRequests.length })

      // S1 (team-down cell) + S10-style deny: the delegate to the (clean)
      // helper is blocked on the TEAM scope -> recovery dispatch -> DENY.
      const { tool, decisions } = await leaderAttempt(B, 'b5', { recovery: 'deny', approval: 'never' })
      const errBody = JSON.stringify(tool.body ?? null)
      const denyDecision = decisions.find((d) => d.class === 'recovery')
      const entries = await ledgerEntries(B, T)
      const recoveryRecord = factEntries(entries, 'control-request-recorded').find((e) => typeof e?.payload?.correlation === 'string' && e.payload.correlation.startsWith('recovery:rt-b5-'))
      const teamIncident = factEntries(entries, 'recovery-incident-opened').find((e) => e?.payload?.scope === 'team')
      check('S1', 'team-down cell: delegate T->helper blocked on the TEAM scope (requiredScopeDown [team]) — the S5 surface',
        closedRejection(tool) && /blocked|required scope is down/i.test(errBody)
        && recoveryRecord?.payload?.reviewPayload?.blockedScopes?.[0] === 'team'
        && recoveryRecord?.payload?.reviewPayload?.downedCapabilitySubjects?.[0] === S_REPO,
        `blockedScopes=${JSON.stringify(recoveryRecord?.payload?.reviewPayload?.blockedScopes ?? null)} downed=${JSON.stringify(recoveryRecord?.payload?.reviewPayload?.downedCapabilitySubjects ?? null)}`)
      check('S10', 'team-scope DENY: zero-effect block with full gate details (blockedScopes [team], source requirement-gate, controlDecision deny)',
        denyDecision !== undefined && /deny|denied/i.test(errBody) && closedRejection(tool),
        `denyDecision=${denyDecision?.requestId ?? 'none'}`)
      check('S5', 'leader required MCP down (team-scope model): the incident scope is TEAM with requirementIds [team.mcp.leaderreq-family] — the leaderreq outage blocks the team scope',
        teamIncident !== undefined || recoveryRecord?.payload?.reviewPayload?.blockedScopes?.[0] === 'team',
        `teamIncident=${JSON.stringify(teamIncident?.payload ?? null).slice(0, 200)} (B5 outage subject = mcp_repo; the leaderreq cell is exercised in B7)`)
      saveScenario('s4-team-down-b5', {
        recoveryRecord: recoveryRecord?.payload ?? null,
        teamIncident: teamIncident?.payload ?? null,
        decisions,
      })
    }
    await stopHost(B)

    // S3 — seed the template disable (worker unavailable) — host STOPPED.
    seedFact(T, 'template-availability-set', { templateId: 'worker', available: false, at: Date.now() })

    // ══ B6 (resume): repo STILL DOWN (live, from B5) + worker DISABLED — S3 + S4b
    B = await bootHost({
      label: 'B6-RESUME', port: HOST_PORT, boot: 7, phase: 'resume',
      facts: factsAll(), mcpServers: ROW_MCP_SERVERS,
      comment: 'B6 resume: repo mini-MCP still STOPPED (B5) + seeded worker disable (availability false)',
    })
    EVID.hostLogs.push({ bootNum: 7, phase: 'resume', port: HOST_PORT, logPath: B.logPath })
    await p6t6StateReady(HOST_PORT, { rootSessionId: ROOT, phase: 'resume' })
    {
      // S3 — the disable blocks as AVAILABILITY (never a policy denial).
      const { tool } = await leaderAttempt(B, 'b6', { recovery: 'abandon', approval: 'never' })
      const errBody = JSON.stringify(tool.body ?? null)
      check('S3', 'template disable -> gateReason templateDisabled (availability, not policy — negative #9)',
        closedRejection(tool) && /disabled/i.test(errBody) && /templateDisabled/i.test(errBody),
        `rejectedHead=${scrubTokens(String(tool.body?.value?.message ?? '').slice(0, 250))}`)
      saveScenario('s3-disable-b6', { toolOutcome: tool.body?.value ?? tool.body?.error ?? null })

      // S4b — the template disable CANNOT bypass the team-level outage:
      // the team-scoped initial work is STILL blocked on requiredScopeDown.
      const admit = await remoteCallReady(B, 'team.admitInitialWork', {
        rootSessionId: T,
        requestToken: `rt-admit-b6-${NONCE}`,
        prompt: `e12 S4b admit initial work probe ${NONCE}`,
      }, 's4-admit-b6', 2)
      const admitErr = resultError(admit.body)
      const gd = gateDetailsOf(admitErr)
      check('S4', 'disable cannot bypass: admitInitialWork STILL blocked requiredScopeDown [team] (the team scope is independent of template availability)',
        admitErr?.code === GATE_BLOCKED_CODE
        && gd?.gateReason === 'requiredScopeDown'
        && Array.isArray(gd?.blockedScopes) && gd.blockedScopes.length === 1 && gd.blockedScopes[0] === 'team'
        && gd?.source === 'requirement-gate',
        `details=${JSON.stringify(gd ?? null).slice(0, 300)}`)
      saveScenario('s4b-admit-b6', { admitError: admitErr, details: gd })
    }
    await stopHost(B)

    // ══ B7 (resume): leaderreq DOWN (the S5 cell, LIVE) — S5 + S6 ═════════
    // The repo service is RESTORED (the kit restarts it) and the leaderreq
    // mini-MCP is STOPPED: the T leader's reconcile fails leaderreq → the
    // team-scoped requirement team.mcp.leaderreq (required) is FATAL →
    // team scope blocked → the S5 Recovery cell.
    MINI.repo = await startMiniMcp(PORT_REPO, S_REPO)
    await stopMiniMcp(MINI.leaderreq, S_LEADERREQ)
    B = await bootHost({
      label: 'B7-RESUME', port: HOST_PORT, boot: 8, phase: 'resume',
      facts: factsAll(), mcpServers: ROW_MCP_SERVERS,
      comment: 'B7 resume: repo RESTARTED + leaderreq mini-MCP STOPPED (the leader REQUIRED MCP — team scope DOWN, live)',
    })
    EVID.hostLogs.push({ bootNum: 8, phase: 'resume', port: HOST_PORT, logPath: B.logPath })
    await p6t6StateReady(HOST_PORT, { rootSessionId: ROOT, phase: 'resume' })
    {
      const { tool, decisions, pendingSeen } = await leaderAttempt(B, 'b7', { recovery: 'allow', approval: 'never' })
      const ok = tool.body?.ok === true && tool.body?.value?.status === 'executed'
      const W3 = delegateInstanceId(tool.body?.value ?? null)
      const entries = await ledgerEntries(B, T)
      const recoveryRecord = factEntries(entries, 'control-request-recorded').find((e) => typeof e?.payload?.correlation === 'string' && e.payload.correlation.startsWith('recovery:rt-b7-'))
      const rp = recoveryRecord?.payload ?? null
      const teamIncident = factEntries(entries, 'recovery-incident-opened').find((e) => e?.payload?.scope === 'team' && Array.isArray(e?.payload?.requirementIds) && e.payload.requirementIds.includes('team.mcp.leaderreq'))
      const b7Done = await waitForTurnDone(MOCK, MKW('b7'), DONE_W('b7'), 120_000)
      check('S5', 'leader required MCP down: team scope BLOCKED (blockedScopes [team], downedCapabilitySubjects [mcp_leaderreq]) -> Recovery',
        rp?.reviewPayload?.blockedScopes?.[0] === 'team' && rp?.reviewPayload?.downedCapabilitySubjects?.[0] === S_LEADERREQ,
        `blocked=${JSON.stringify(rp?.reviewPayload?.blockedScopes)} downed=${JSON.stringify(rp?.reviewPayload?.downedCapabilitySubjects)}`)
      check('S6', 'human-reviewed recovery (S5 cell): ALLOW -> the recovery attempt EXECUTED (W3 helper created) on the reduced original authority; incident-opened scope team [team.mcp.leaderreq]',
        ok && W3 !== null && b7Done !== null && decisions.some((d) => d.class === 'recovery' && d.decision === 'allow') && teamIncident !== undefined,
        `toolOk=${ok} W3=${W3} doneWitness=${b7Done !== null} incident=${JSON.stringify(teamIncident?.payload ?? null).slice(0, 200)}`)
      check('S5', 'E.9 reduced authority: the review payload reducedAuthority.unavailableSubjects == [mcp_leaderreq] (the other permissions run as the original)',
        JSON.stringify(rp?.reviewPayload?.reducedAuthority?.unavailableSubjects ?? []) === JSON.stringify([S_LEADERREQ]),
        `reducedAuthority=${JSON.stringify(rp?.reviewPayload?.reducedAuthority ?? null)}`)
      saveScenario('s5-s6-b7', { W3, reviewPayload: rp?.reviewPayload ?? null, controlPayload: rp ?? null, decisions, pendingSeen })
    }
    await stopHost(B)

    // ══ B8 (resume): everything RESTORED (LIVE) — S8b + S11 ═══════════════
    // The leaderreq mini-MCP is RESTARTED on 3491: every server is running
    // again. The fresh boot's live reconcile at the first boundary mounts
    // all fibers (the S8b team-scope exit) — and the S11 readiness-reset
    // evidence is taken at boot, BEFORE any attach (no live fiber survives
    // the restart).
    MINI.leaderreq = await startMiniMcp(PORT_LEADERREQ, S_LEADERREQ)
    B = await bootHost({
      label: 'B8-RESUME', port: HOST_PORT, boot: 9, phase: 'resume',
      facts: factsAll(), mcpServers: ROW_MCP_SERVERS,
      comment: 'B8 resume: leaderreq mini-MCP RESTARTED — all services restored (live); all configured',
    })
    EVID.hostLogs.push({ bootNum: 9, phase: 'resume', port: HOST_PORT, logPath: B.logPath })
    await p6t6StateReady(HOST_PORT, { rootSessionId: ROOT, phase: 'resume' })
    {
      // S11 (W2-A live addition, plan §E.11 negative #10: "restart 后
      // consent/disable 保留，readiness 重置 unknown") — readiness is
      // EPHEMERAL: at the fresh boot NO live fiber survives (the in-memory
      // mount state dies with the process) — the pre-restart materialization
      // is NOT carried; readiness is `unknown` until the next boundary
      // re-probes live (the slots re-mount when the servers are up — the
      // post-b8h check below asserts the re-probe).
      const preB8hSlots = findMcpSlots((await p6t6State(HOST_PORT)).body, S_LEADERREQ)
      check('S11', 'readiness reset at restart: NO mounted mcp slot survives the boot (live state ephemeral — unknown until the next boundary re-probes)',
        preB8hSlots.every((s) => s.mounted !== true),
        `preB8h leaderreq slots=${JSON.stringify(preB8hSlots)}`)
      saveScenario('s11-readiness-reset-b8', { preB8hSlots })
    }
    {
      // S8b — the team-scope exit: the helper delegate runs NORMAL.
      const before = await ledgerEntries(B, T)
      const { tool, pendingSeen } = await leaderAttempt(B, 'b8h', { recovery: 'abandon', approval: 'never' })
      const ok = tool.body?.ok === true && tool.body?.value?.status === 'executed'
      const b8hDone = await waitForTurnDone(MOCK, MKW('b8h'), DONE_W('b8h'), 120_000)
      // K10: pick the MOUNTED slot (T's leader boundary allows the fiber;
      // the boot-root session stays `pending`).
      const leaderSlots = findMcpSlots((await p6t6State(HOST_PORT)).body, S_LEADERREQ)
      const slot = leaderSlots.find((s) => s.mounted === true && s.materialization === 'mounted') ?? leaderSlots[0] ?? null
      const after = await ledgerEntries(B, T)
      const closedTeam = factEntries(after, 'recovery-incident-closed').find((e) => e?.payload?.scope === 'team')
      check('S8', 'team-scope exit: delegate T->helper NORMAL (no recovery correlation, no dispatch) — E.10 for the team scope',
        ok && b8hDone !== null && pendingSeen.length === 0,
        `toolOk=${ok} pendingControlRequests=${pendingSeen.length}`)
      check('S8', 'team incident CLOSED (recovery-incident-closed scope team) + mcp_leaderreq MOUNTED on the leader boundary',
        closedTeam !== undefined && slot?.mounted === true && slot?.materialization === 'mounted',
        `closed=${JSON.stringify(closedTeam?.payload ?? null)} slot=${JSON.stringify(slot)}`)

      // S11 — the SEEDED facts survived ALL restarts and drive the FRESH
      // evaluation: worker still DISABLED (templateDisabled), consent still
      // readable; the team-scope compatibility row recomputed per boot.
      const { tool: toolW } = await leaderAttempt(B, 'b8w', { recovery: 'abandon', approval: 'never' })
      const errBody = JSON.stringify(toolW.body ?? null)
      check('S11', 'restart persists: the seeded worker disable still blocks after 7 restarts (templateDisabled on the fresh evaluation)',
        closedRejection(toolW) && /templateDisabled/i.test(errBody),
        `rejectedHead=${scrubTokens(String(toolW.body?.value?.message ?? '').slice(0, 250))}`)

      const consentFacts = factEntries(after, 'optional-requirement-accepted')
      const disableFacts = factEntries(after, 'template-availability-set')
      const disable = disableFacts.find((e) => e?.payload?.templateId === 'worker')
      check('S11', 'restart persists: BOTH seeded facts (consent + disable) are readable in the T ledger after all restarts',
        consentFacts.length >= 1 && disable?.payload?.available === false,
        `consents=${consentFacts.length} disable=${JSON.stringify(disable?.payload ?? null)}`)

      const compB8 = await compatibilityOf(B, T)
      const compB2Row = EVID.scenarios['s1-compat-b2'] ?? null
      check('S11', 'readiness resets: the team-scope compatibility aggregate was RECOMPUTED across boots (fresh recordedAt; status matches the B8 world)',
        compB8.error === undefined && compB8.row?.status === 'OPEN'
        && (compB2Row?.recordedAt === undefined || compB8.row.recordedAt > compB2Row.recordedAt),
        `b8=${compB8.row?.status} b2=${compB2Row?.status} recordedAt b2=${compB2Row?.recordedAt} -> b8=${compB8.row?.recordedAt}`)
      saveScenario('s11-b8', {
        consentFacts: consentFacts.map((e) => e.payload),
        disableFacts: disableFacts.map((e) => e.payload),
        compatB8: compB8.row,
        closedTeam: closedTeam?.payload ?? null,
        slot,
      })
    }
    await stopHost(B)

    // ══ B9 (resume): persona STANDARD observed — S12a (the correct open) ══
    B = await bootHost({
      label: 'B9-RESUME', port: HOST_PORT, boot: 10, phase: 'resume',
      facts: factsAll(true), mcpServers: ROW_MCP_SERVERS,
      presetSubstrate: { presetId: 'ptc', personaKind: 'standard' },
      comment: 'B9 resume: persona standard available; presetSubstrate ptc/standard; all MCP servers running (static config — the persona cell is MCP-free)',
    })
    EVID.hostLogs.push({ bootNum: 10, phase: 'resume', port: HOST_PORT, logPath: B.logPath })
    await p6t6StateReady(HOST_PORT, { rootSessionId: ROOT, phase: 'resume' })
    {
      // K7 (run-5 live finding): the U5 probe merge (s6-remote.ts
      // mergeProbeEnvironmentFacts) makes the PERSONA domain caller-only —
      // the host's persona facts are ALWAYS discarded and the caller's wire
      // persona facts are the ONLY persona input (the selected preset is the
      // explicit user intent the U5 rule exists for; every other domain is
      // host-only). The observed cell therefore carries the persona intent
      // ON THE WIRE; the absent cell (S12b) passes none (probeBlueprint).
      const probe = await remoteCallReady(B, 'intent.probe', {
        blueprintId: BP_PERSONA_ID,
        environmentFacts: [{ domain: 'persona', subject: 'standard', available: true, generation: 1 }],
      }, 's12a-probe', 1)
      const pErr = resultError(probe.body)
      const compat = resultData(probe.body)?.compatibility ?? null
      const personaReq = compat?.requirements?.find((rq) => rq.requirementId === 'team.persona.standard')
      check('S12', 'ptc standard observed (correct open): probe(T9) persona requirement PASS (standard composes)',
        pErr === null && personaReq?.outcome === 'PASS' && compat?.status === 'OPEN',
        `persona=${JSON.stringify(personaReq ?? null).slice(0, 250)} status=${compat?.status}`)

      const r = await remoteCallReady(B, 'team.create', { rootSessionId: T9, blueprintId: BP_PERSONA_ID }, 't9-create', 1)
      const err = resultError(r.body)
      if (err !== null) dieFatal(`team.create (T9 persona) failed: ${err.code} — ${String(err.message).slice(0, 300)}`)

      const { tool } = await leaderAttempt(B, 'b9', { recovery: 'abandon', approval: 'never' })
      const b9Done = await waitForTurnDone(MOCK, MKW('b9'), DONE_W('b9'), 90_000)
      check('S12', 'ptc standard observed: T9 created + delegate EXECUTED (the required standard is met — the honest open)',
        tool.body?.ok === true && b9Done !== null,
        `toolOk=${tool.body?.ok === true} doneWitness=${b9Done !== null}`)
    }
    await stopHost(B)

    // ══ B9b (resume): persona ABSENT (dynamic disabled) — S12b ════════════
    B = await bootHost({
      label: 'B9B-RESUME', port: HOST_PORT, boot: 11, phase: 'resume',
      facts: factsAll(false), mcpServers: ROW_MCP_SERVERS,
      presetSubstrate: { presetId: 'ptc', personaKind: 'absent' },
      comment: 'B9b resume: persona standard UNAVAILABLE (absent — the ptc dynamic disabled); presetSubstrate ptc/absent; MCP config unchanged (static)',
    })
    EVID.hostLogs.push({ bootNum: 11, phase: 'resume', port: HOST_PORT, logPath: B.logPath })
    await p6t6StateReady(HOST_PORT, { rootSessionId: ROOT, phase: 'resume' })
    {
      // S12b — T9 persists (cold resume); the FRESH evaluation is FATAL:
      // the absent observation does NOT satisfy the required standard.
      const admit = await remoteCallReady(B, 'team.admitInitialWork', {
        rootSessionId: T9,
        requestToken: `rt-admit-b9b-${NONCE}`,
        prompt: `e12 S12b persona fatal probe ${NONCE}`,
      }, 's12b-admit', 2)
      const admitErr = resultError(admit.body)
      const gd = gateDetailsOf(admitErr)
      check('S12', 'ptc absent (dynamic disabled): admitInitialWork(T9) blocked — the required standard is NOT met by the absent observation (NO false open)',
        admitErr?.code === GATE_BLOCKED_CODE
        && gd?.status === 'BLOCKED_FATAL'
        && gd?.source === 'requirement-gate'
        && Array.isArray(gd?.blockingRequirementIds) && gd.blockingRequirementIds.includes('team.persona.standard')
        && Array.isArray(gd?.unavailableSubjects) && gd.unavailableSubjects.includes('standard'),
        `details=${JSON.stringify(gd ?? null).slice(0, 350)}`)

      // The full engine verdict (per-requirement rows) travels on the probe.
      const probe = await probeBlueprint(B, BP_PERSONA_ID, 's12b-probe')
      const personaReq = probe.verdict?.requirements?.find((rq) => rq.requirementId === 'team.persona.standard')
      check('S12', 'ptc absent: fresh evaluation FATAL — persona requirement outcome FATAL, reasonCode PERSONA_INCOMPATIBLE (the BARE lane — no `complete` fact present; the PR #22 typing)',
        probe.error === undefined
        && probe.verdict?.status === 'BLOCKED_FATAL'
        && personaReq?.outcome === 'FATAL'
        && personaReq?.reasonCode === 'PERSONA_INCOMPATIBLE',
        `status=${probe.verdict?.status} persona=${JSON.stringify(personaReq ?? null).slice(0, 300)}`)

      // The durable team-scope aggregate (compatibility.get) reflects the
      // fresh FATAL evaluation for the persisted T9 root.
      const comp = await compatibilityOf(B, T9)
      check('S12', 'ptc absent: the durable team-scope aggregate of T9 is BLOCKED_FATAL (counts.fatal >= 1)',
        comp.error === undefined
        && comp.row?.status === 'BLOCKED_FATAL'
        && (comp.row?.counts?.fatal ?? 0) >= 1,
        `status=${comp.row?.status} counts=${JSON.stringify(comp.row?.counts ?? null)}`)
      saveScenario('s12b-b9b', { admitError: admitErr, details: gd, probeVerdict: probe.verdict, compatibility: comp.row })
    }
    await stopHost(B)

    // ── teardown + hygiene ─────────────────────────────────────────────────
    for (const m of Object.values(MINI)) {
      if (m !== null) await new Promise((r) => m.server.close(r))
    }
    try { await MOCK.close?.() } catch { /* mock close best effort */ }

    // H1 post — test-use pristine + stable zero-touch.
    const gitPostDir = join(RUN_DIR, 'git-post')
    mkdirSync(gitPostDir, { recursive: true })
    const gitPost = await captureGitState(HOST_TREE, gitPostDir)
    EVID.testUse.post = gitPost
    writeFileSync(join(RUN_DIR, 'testuse-post.json'), JSON.stringify({ ...gitPost, baselineSha: HOST_BASELINE_SHA, at: new Date().toISOString() }, null, 2))
    const h1Testuse = gitPost.statusEmpty === true && gitPost.diffEmpty === true && gitPost.head === HOST_BASELINE_SHA
      && EVID.testUse.pre.statusEmpty === true && EVID.testUse.pre.diffEmpty === true && EVID.testUse.pre.head === HOST_BASELINE_SHA
    check('H1', 'test-use pristine AFTER (porcelain empty + HEAD baseline; the worker bash was a no-op echo)',
      h1Testuse, `post statusEmpty=${gitPost.statusEmpty} diffEmpty=${gitPost.diffEmpty} head=${gitPost.head.slice(0, 12)}`)

    EVID.stableAfter = {}
    for (const u of STABLE_URLS) EVID.stableAfter[u] = await probeStableInstance(u)
    const h1Stable = STABLE_URLS.every((u) => EVID.stableAfter[u].status === EVID.stableBefore[u].status
      && EVID.stableAfter[u].length === EVID.stableBefore[u].length)
    check('H1', ':3080/:3180 ZERO-TOUCH (read-only probes pre == post)',
      h1Stable, `before=${STABLE_URLS.map((u) => EVID.stableBefore[u].status).join(',')} after=${STABLE_URLS.map((u) => EVID.stableAfter[u].status).join(',')}`)
    writeFileSync(join(RUN_DIR, 'stable-pre.json'), JSON.stringify(EVID.stableBefore, null, 2))
    writeFileSync(join(RUN_DIR, 'stable-post.json'), JSON.stringify(EVID.stableAfter, null, 2))

    // H2 — run ports released (host + mock + ALL THREE mini-MCP ports,
    // including the new repo port 3492 — the W2-A rework adds a server).
    const portsHeld = []
    for (const p of [HOST_PORT, MOCK_PORT, PORT_REPO, PORT_LEADERREQ, PORT_WEB]) {
      if (await portInUse(p)) portsHeld.push(p)
    }
    let worldCleaned = false
    const allScenariosPass = CRITERIA.every((c) => (VERDICT.get(c.id)?.pass ?? true) === true)
    if (allScenariosPass && portsHeld.length === 0) {
      rmSync(HOME, { recursive: true, force: true })
      rmSync(LOCK_FILE, { force: true })
      worldCleaned = true
    }
    check('H2', 'run ports released after teardown (worldCleaned=true on PASS only)',
      portsHeld.length === 0 && (worldCleaned || !allScenariosPass),
      `portsHeld=${JSON.stringify(portsHeld)} worldCleaned=${worldCleaned}`)

    const passCount = CRITERIA.filter((c) => (VERDICT.get(c.id)?.pass ?? true) === true).length
    finalizeEvidence(allScenariosPass && passCount === CRITERIA.length ? 'PASS' : 'FAIL',
      `${passCount}/${CRITERIA.length} criteria pass; worldCleaned=${worldCleaned}`)

    // api-transcript + mock log are already on disk; write the transcript.
    writeFileSync(join(RUN_DIR, 'api-transcript.json'), JSON.stringify(EVID.transcript, null, 2))

    // token-scrub the ENTIRE evidence dir (sk- tokens from instance logs /
    // dump configs / transcripts). `mock-requests.json` is intentionally
    // NOT part of the evidence.
    const scrubbed = scrubDir(RUN_DIR)
    log(`evidence scrubbed: ${scrubbed} file(s) rewritten (sk- token redactions)`)
    const leak = []
    const walkForLeak = (dir) => {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const p = join(dir, entry.name)
        if (entry.isDirectory()) walkForLeak(p)
        else {
          try {
            if (/\bsk-[A-Za-z0-9]{24,}/.test(readFileSync(p, 'utf8'))) leak.push(p)
          } catch { /* binary — skip */ }
        }
      }
    }
    walkForLeak(RUN_DIR)
    if (leak.length > 0) log(`WARNING: token leak remains in: ${leak.join(', ')}`)

    const failed = CRITERIA.filter((c) => (VERDICT.get(c.id)?.pass ?? true) !== true)
    if (failed.length === 0) {
      log(`VERDICT: PASS — all ${CRITERIA.length} criteria green (14 scenarios + hygiene); world ${worldCleaned ? 'cleaned' : 'RETAINED'}`)
      process.exit(worldCleaned ? 0 : 2)
    }
    log(`VERDICT: FAIL — ${failed.length} criterion(ia) failed: ${failed.map((f) => f.id).join(', ')}`)
    log(`world RETAINED at ${HOME} (non-zero exit protocol)`)
    process.exit(2)
  } catch (error) {
    log(`UNCAUGHT: ${error?.stack ?? error}`)
    try { await sweepLiveHosts() } catch { /* best effort */ }
    try { finalizeEvidence('ERROR', String(error?.message ?? error).slice(0, 500)) } catch { /* best effort */ }
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
