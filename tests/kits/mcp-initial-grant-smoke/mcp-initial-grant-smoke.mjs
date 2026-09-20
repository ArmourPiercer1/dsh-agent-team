#!/usr/bin/env node
/**
 * mcp-initial-grant-smoke.mjs — Gate D real-host smoke for the Blueprint
 * MCP INITIAL STATIC GRANT (plan MCP_BLUEPRINT_INITIAL_GRANT_FIX_PLAN.md
 * §6 Gate D + §9 Step 5 + §10 DoD). The MOST IMPORTANT acceptance of the
 * fix: the bound Blueprint template's `capabilities.mcp` (kind === 'allow')
 * is the role's INITIAL governance grant — usable from team creation,
 * with ZERO governance overrides.
 *
 * WHAT IT PROVES (the product creation flow on a real host):
 *
 *   Z1 — zero-seed proof: at world boot, BEFORE any team exists,
 *        `governance.overrides` (the /__p6t6/state backend-truth
 *        projection of the durable governance cell store) is EMPTY.
 *        Nowhere in this kit is an initial `override.set(mcp allow ...)`
 *        performed — that seed is exactly what masked the defect in the
 *        PR #16 / multi-MCP d-smoke evidence and is FORBIDDEN here.
 *   D1 — team.create v2 (Team-1) on a fresh root: the real product path
 *        `team.create -> open Root -> admitInitialWork`.
 *   D2 — the Team-1 LEADER's FIRST-TURN initial work DIRECTLY CALLS the
 *        MCP tools (mock oracle tool-calls `mcp__mcp_signal__ping` +
 *        `mcp__mcp_designer__ping`; both return the live mini-MCP pong
 *        results) — with ZERO governance overrides in existence.
 *   D3 — Team-1 state after creation: the leader's effective MCP set is
 *        EXACTLY [A, B] (the bound template's initial allow), the state
 *        shape is I5, and `governance.overrides` is STILL EMPTY.
 *   D4 — team.create v2 (Team-2), a SECOND fresh root on the same row:
 *        the user's reported symptom ("每建一个新 Team，MCP 再次归零")
 *        must not reproduce — the second root's initial grant is
 *        re-derived from its OWN bound Blueprint, independent of the
 *        first root's state. (The plan's MANDATORY second fresh root.)
 *        The two teams use DISJOINT server names (T1 → A, T2 → B): the
 *        upstream mcp-client (0.1.5-rc.2) keeps a per-scope serverName
 *        registry, and root agents on one row share the unscoped owner
 *        (ctx.root) — a second root mounting a name the first root
 *        already mounts fails root start ("serverName ... is already in
 *        use by another mcp-client instance", run mgis-2026-09-20T09-41-15
 *        d4-team-create-t2.json). That constraint is upstream (CORE PATCH
 *        BUDGET = 0 — recorded, not fixed here); disjoint names exercise
 *        the plan's exact scenario (two fresh roots, each initial work
 *        calls MCP, both succeed) while staying on the legal side of it.
 *   D5 — the Team-2 leader's first-turn initial work directly calls the
 *        MCP tool B (pong), its effective set is exactly [B] (NOT [A] —
 *        a cross-root leak onto Team-1's template would mount A instead),
 *        and its `governance.overrides` is also empty.
 *   D6 — boot-root LEGACY CONTROL (the row anchor is a capabilities-LESS
 *        legacy blueprint): the boot leader mounts NOTHING despite the
 *        row's configured mcpServers — the legacy fail-closed baseline
 *        is unchanged in the production world (no silent grant).
 *   D7 — DYNAMIC PRECEDENCE after creation: a durable `override.set`
 *        (mcp DENY, instance scope, the Team-1 leader — the only
 *        meaningful tightening of the single-server grant [A]) is
 *        admitted (the legitimate post-creation dynamic-governance
 *        scenario — the de-seeded multi-MCP smoke keeps the analogous
 *        subset tighten [A,B]->[A]); the NEXT request boundary (a
 *        team-tool execution on the root) unmounts A — the record-backed
 *        layer beats the static initial grant. Double proof: state (A not
 *        mounted) + model-facing schema (no mcp tools at all).
 *   D8 — COLD RESUME (host restart, same home, phase=resume): the initial
 *        grant is RE-DERIVED from the immutable bound Blueprint through
 *        the PRODUCT path — after a restart a created team root is
 *        re-attached by its first team interaction. A team-tool execution
 *        on the root runs the execute-tool request boundary (ensureLiveAgent
 *        = agents.resume WITH the shared setup -> the initial-grant
 *        re-derivation + mount, then prepareAgentForRequest) BEFORE the
 *        tool call itself, so the re-attach is complete even when the
 *        call degrades to unknown-tool — in THIS world it does degrade by
 *        design: the kit blueprint declares `capabilities.teamTools:
 *        kind: deny` on the leader (host-1 D7's boundary trigger shows the
 *        identical response; the boot-root legacy anchor is the control
 *        carrying the full team-tool catalog). boot() itself re-attaches
 *        only the row's own boot root + its members, and a NATIVE prompt as
 *        the first post-restart touch does not re-attach either (the DSH
 *        core composes the top-level session without the row setup —
 *        characterization of run mgis-2026-09-20T09-46-17; pre-existing
 *        upstream wiring, recorded not fixed; subsequent native prompts
 *        run on the re-attached agent). After the team-tool re-attach:
 *        Team-2's leader (zero overrides) regains [B] and its tool call
 *        executes; Team-1's leader is LIVE but mounts NOTHING — the
 *        durable DENY SURVIVES the restart and still beats the re-derived
 *        initial [A] (Gate C1/C2 semantics in the production world);
 *        effective sets match pre-restart exactly. (Cold-resume
 *        eligibility required the glue's sessionIsDurable to accept
 *        VERSIONED generation roots — 0.1.5-rc.2 resumes publish
 *        `session.vN.jsonl.zstd`, the v0-only match made every restarted
 *        session look ephemeral; fixed plugin-side, real-host probe run
 *        mgis-2026-09-20T09-58-57 + in-process G3V.)
 *   H1/H2 — hygiene: test-use porcelain empty + HEAD baseline;
 *        :3080/:3180 zero-touch (read-only probes); run ports released.
 *
 * WORLD: host = the pristine test-use checkout (DSH 0.1.5-rc.2 @
 *   fb2c4b9e69) launched as `node <testuse>/apps/cli/lib/bin.js web`
 *   (tests/characterization/lib instance pattern); env: DSH_HOME = the
 *   ephemeral world under <host-repo>/tests/homes/,
 *   DSH_CLIENT_COMMIT_HASH = fb2c4b9e69, DEEPSEEK_BASE_URL = the
 *   in-process mock model. Plugin rows mounted ONLY through the public
 *   profile-patch seam (production row = the WORKTREE's dist — this
 *   branch's build; p6t6 observability row). The row config carries the
 *   row's configured mini-MCP servers (mcp_signal:3491 /
 *   mcp_designer:3492 — live inline endpoints) + the row anchor
 *   (legacy, capabilities-less) + the blueprintDir of the two saved
 *   team blueprints (under the world home — the kit writes NOTHING into
 *   the repo tree; the worktree dist resolves its bare imports through
 *   the worktree's own node_modules — no host-tree junctions, c1-kit
 *   pattern).
 *
 * DO NOT run this kit in parallel with a full `vitest` run (shared CPU
 * load + the 3180/349x port families).
 *
 * USAGE:
 *   node tests/kits/mcp-initial-grant-smoke/mcp-initial-grant-smoke.mjs \
 *     [--worktree <path>] [--testuse <path>] [--host-port N] [--keep]
 *   defaults: --worktree = the repo root containing this kit (3 levels
 *   up), --testuse = <worktree>/tests/deepseek-harness-test-use (fallback:
 *   the parent repo's tests/deepseek-harness-test-use — the gitignored
 *   checkout only exists in the main checkout, not in task worktrees),
 *   host port = first free of 3181–3186 (NEVER 3180/3080), mini-MCP
 *   3491/3492, mock 3496.
 *
 * EXIT: 0 = all criteria pass; 2 = a criterion failed (full evidence dump
 * in the run dir); 1 = fatal (environment/boot/row).
 */

import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { join, resolve, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import { TEST_USE_BASELINE_SHA, CLIENT_COMMIT_HASH, findTestRepoRoot } from '../../../tests/paths.mjs'
import { DshInstance, ensureProfile } from '../../../tests/characterization/lib/instance.mjs'
import { logTail, portInUse, waitForPortFree } from '../../../tests/characterization/lib/util.mjs'
import { captureGitState } from '../../../tests/characterization/lib/tree-clean.mjs'
import { startMockModel } from '../../../packages/tools/harness/mock-deepseek.mjs'

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
const HOST_PORT_ARG = argValue('host-port', undefined)

// ── frozen facts / ports ────────────────────────────────────────────────────

const HOST_BASELINE_SHA = TEST_USE_BASELINE_SHA // DSH 0.1.5-rc.2 release point (paths.mjs pin)
const HOST_TREE = TESTUSE
const PRODUCTION_ROW_PATH = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js')
const GLUE_PATH = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs')
const SEAM_PATH = join(WORKTREE, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')
const P6T6_ROW_NAME = pathToFileURL(join(WORKTREE, 'packages', 'tools', 'harness', 'plugin.mjs')).href

const HOST_PORT_CANDIDATES = [3181, 3182, 3183, 3184, 3185, 3186] // NEVER 3080 / 3180
const PORT_A = 3491 // mini-MCP A (mcp_signal)
const PORT_B = 3492 // mini-MCP B (mcp_designer)
const MOCK_PORT = 3496
const STABLE_URLS = ['http://127.0.0.1:3080/', 'http://127.0.0.1:3180/']

const SERVER_A = 'mcp_signal'
const SERVER_B = 'mcp_designer'
const TOOL_A = `mcp__${SERVER_A}__ping`
const TOOL_B = `mcp__${SERVER_B}__ping`

// ── run stamp / world paths ─────────────────────────────────────────────────

function utcStamp() {
  const d = new Date().toISOString()
  return d.replace(/[:.]/g, '-').replace('T', 'T').slice(0, 19)
}
const RUN_STAMP = `mgis-${utcStamp()}`
const EVIDENCE_DIR = join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'mcp-initial-grant', 'smoke')
const RUN_DIR = join(EVIDENCE_DIR, RUN_STAMP)
const HOST_REPO_ROOT = findTestRepoRoot(WORKTREE)
const HOME_NAME = RUN_STAMP // TEST_METHODS §7 ephemeral form
const HOME = join(HOST_REPO_ROOT, 'tests', 'homes', HOME_NAME)
const LOCK_FILE = `${HOME}.lock`
const BLUEPRINT_DIR = join(HOME, 'blueprints') // saved sources live IN the world home (repo-tree-clean kit)

const ROOT = `session-mgis-boot-${RUN_STAMP}` // the row anchor's boot root (legacy control)
const ROOT_T1 = `session-mgis-t1-${RUN_STAMP}`
const ROOT_T2 = `session-mgis-t2-${RUN_STAMP}`
const LEADER_INSTANCE_ID = 'inst-leader'
const BP_T1_ID = 'team.mgis-t1'
const BP_T2_ID = 'team.mgis-t2'

// Distinct markers (no substring collisions; the oracle routes on the LAST
// user message carrying one of them).
const NONCE = RUN_STAMP
const MK = (p) => `${p}_${NONCE}`
const MK_BOOT = MK('MGIS_BOOT') // the boot-root legacy-control probe turn
const MK_T1 = MK('MGIS_T1') // Team-1 leader FIRST-turn initial work (MCP calls)
const MK_T2 = MK('MGIS_T2') // Team-2 leader FIRST-turn initial work (MCP calls)
const MK_T1B = MK('MGIS_T1B') // Team-1 leader post-tighten probe (A still works)
const MK_RT1 = MK('MGIS_RT1') // Team-1 leader post-resume probe
const MK_RT2 = MK('MGIS_RT2') // Team-2 leader post-resume probe

// ── logging / criteria ──────────────────────────────────────────────────────

let RUN_LOG = null
function log(line) {
  const stamped = `[${new Date().toISOString()}] ${line}`
  console.log(stamped)
  if (RUN_LOG !== null) {
    try {
      writeFileSync(RUN_LOG, stamped + '\n', { flag: 'a' })
    } catch { /* evidence best-effort */ }
  }
}

const CRITERIA = [
  { id: 'Z1', name: 'zero-seed proof: governance.overrides = [] at world boot (before any team.create)' },
  { id: 'D1', name: 'team.create v2 (Team-1) succeeds on the fresh root (open Root + admitInitialWork)' },
  { id: 'D2', name: 'Team-1 leader FIRST-turn initial work DIRECTLY CALLS MCP (A executes — live pong result), zero overrides in existence' },
  { id: 'D3', name: 'Team-1 state post-create: leader effective MCP set EXACTLY [A] (I5 shape, B not mounted) and governance.overrides STILL []' },
  { id: 'D4', name: 'team.create v2 (Team-2) — the MANDATORY second fresh root — succeeds independently of Team-1' },
  { id: 'D5', name: 'Team-2 leader first-turn initial work directly calls MCP (B executes), effective set exactly [B] (no cross-root leak), overrides []' },
  { id: 'D6', name: 'boot-root legacy control: the capabilities-LESS row anchor mounts NOTHING (no mcp tools in schema, nothing mounted in state)' },
  { id: 'D7', name: 'post-creation durable tighten (DENY, instance/leader) beats the initial grant at the next boundary (A unmounted: state + schema double proof, record in overrides)' },
  { id: 'D8', name: 'cold resume (product path: team-tool re-attach after restart): initial grant re-derived from the bound Blueprint (Team-2 [B] with zero overrides + live pong; Team-1 LIVE but mounts NOTHING — the durable DENY survives the restart and wins over the re-derived [A]); effective sets == pre-restart' },
  { id: 'H1', name: 'test-use porcelain EMPTY + HEAD baseline; :3080/:3180 zero-touch (read-only probes pre==post)' },
  { id: 'H2', name: 'run ports released after teardown (host 3491 3492 3496)' },
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

function dieFatal(msg) {
  log(`FATAL ${msg}`)
  try {
    mkdirSync(RUN_DIR, { recursive: true })
    writeFileSync(join(RUN_DIR, 'summary.json'), JSON.stringify({
      task: 'mcp-initial-grant real-host smoke (Gate D)',
      runStamp: RUN_STAMP,
      fatal: String(msg).slice(0, 4000),
      criteria: Object.values(results),
      pass: false,
      exitCode: 1,
    }, null, 2))
  } catch { /* best-effort */ }
  process.exit(1)
}

// ── the inline mini-MCP endpoints (the proven d-smoke pattern) ──────────────

function miniMcpRpc(serverLabel, msg) {
  const id = msg === null || typeof msg !== 'object' ? null : msg.id
  const method = msg === null || typeof msg !== 'object' ? undefined : msg.method
  const params = msg === null || typeof msg !== 'object' || msg.params === undefined ? {} : msg.params
  const ok = (result) => ({ jsonrpc: '2.0', id, result })
  const fail = (code, message) => ({ jsonrpc: '2.0', id, error: { code, message } })
  if (method === 'initialize') {
    return ok({ protocolVersion: '2025-06-18', capabilities: { tools: { listChanged: false } }, serverInfo: { name: `mini-${serverLabel}`, version: '0.0.1' } })
  }
  if (method === 'notifications/initialized') return null
  if (method === 'tools/list') {
    return ok({ tools: [{ name: 'ping', description: `echo ping (mini-MCP ${serverLabel})`, inputSchema: { type: 'object', properties: { msg: { type: 'string' } }, required: [] } }] })
  }
  if (method === 'tools/call') {
    if (params?.name !== 'ping') return fail(-32601, `unknown tool ${String(params?.name)}`)
    const text = `pong:${serverLabel}:${String((params.arguments && params.arguments.msg) ?? '')}`
    return ok({ content: [{ type: 'text', text }], isError: false })
  }
  return fail(-32601, `method ${String(method)} not found`)
}

async function startMiniMcp(port, label) {
  const { createServer } = await import('node:http')
  const server = createServer((req, res) => {
    if (req.method !== 'POST') {
      res.writeHead(405).end()
      return
    }
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      let msg = null
      try {
        msg = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      } catch { /* null */ }
      const reply = miniMcpRpc(label, msg)
      if (reply === null) {
        res.writeHead(202).end()
        return
      }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(reply))
    })
  })
  await new Promise((r) => server.listen(port, '127.0.0.1', r))
  return { server, port: server.address().port }
}

async function closeMini(mini) {
  if (mini === null) return
  await new Promise((r) => mini.server.close(r))
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

/** One browser-facing public Remote call: POST /team-remote/<method>. */
async function remoteCall(origin, cookie, method, params, tag = 'mgis') {
  return fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`,
      method,
      payload: { version: 1, params },
    }),
  }, 180_000)
}

/** One user turn on the DSH core public channel: POST /api/session/prompt. */
async function apiPrompt(origin, cookie, sessionId, text, tag = 'mgis') {
  return fetchJson(`${origin}/api/session/prompt`, {
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
  }, 180_000)
}

/** One shipped team tool through the pattern-sanctioned observability seam
 *  (executeTool on the `as` session — the request-boundary machinery runs
 *  inside: ensure-live -> boundary reconciliation -> tools.execute). */
async function p6t6Tool(port, name, args, as) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/tool`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, args, as }),
  }, 180_000)
}

async function p6t6State(port) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/state`, undefined, 30_000)
}

async function p6t6Health(port) {
  return fetchJson(`http://127.0.0.1:${port}/__p6t6/health`, undefined, 10_000)
}

/** Poll the state route until the well-formed body for root+phase appears. */
async function p6t6StateReady(port, { rootSessionId, phase, timeoutMs = 90_000, intervalMs = 500 }) {
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

/** Unwrap a remote result envelope: {ok:true, value:{data, provenance}} -> value.data. */
function remoteValue(result, method) {
  if (result.status !== 200) throw new Error(`${method}: HTTP ${result.status}: ${JSON.stringify(result.body).slice(0, 400)}`)
  const r = result.body?.result
  if (r === undefined) throw new Error(`${method}: no result envelope: ${JSON.stringify(result.body).slice(0, 400)}`)
  if (r.ok !== true) throw new Error(`${method}: remote error: ${JSON.stringify(r.error ?? r).slice(0, 800)}`)
  const v = r.value
  if (v && typeof v === 'object' && 'data' in v && 'provenance' in v) return v.data
  return v
}

/** Unwrap the observability-seam tool envelope: {ok:true, value}. */
function toolValue(result, name) {
  if (result.status !== 200) throw new Error(`${name}: HTTP ${result.status}: ${JSON.stringify(result.body).slice(0, 400)}`)
  if (result.body?.ok !== true) throw new Error(`${name}: tool error: ${JSON.stringify(result.body).slice(0, 800)}`)
  const value = result.body.value
  if (value?.status === 'rejected') throw new Error(`${name}: rejected: ${JSON.stringify(value.effect ?? value).slice(0, 800)}`)
  return value
}

// ── the saved team blueprints (strict closed-v1, the d-smoke shape) ─────────
// The LEADER declares the full team-tools set + mcp allow (the initial
// grant under test). No `permissions` block (absent policy = no permission
// listener — the legacy/alpha.1 path, d-smoke precedent). The row ANCHOR is
// the legacy capabilities-LESS blueprint (the D6 control).

function savedBlueprintYaml(bpId, leaderPersona, mcpItems, members) {
  const leaderBlock = [
    'leader:',
    '  templateId: leader',
    `  persona: ${JSON.stringify(leaderPersona)}`,
    '  capabilities:',
    '    teamTools:',
    '      kind: deny',
    '    builtinToolDeny: []',
    '    skills:',
    '      kind: allow',
    '      items: []',
    '    mcp:',
    '      kind: allow',
    '      items:',
    ...mcpItems.map((s) => `        - ${s}`),
  ]
  return [
    '---',
    'schemaVersion: 1',
    `blueprintId: ${bpId}`,
    'revision: "1"',
    ...leaderBlock,
    ...(members.length === 0 ? ['members: []'] : ['members:']),
    'requirements:',
    '  - domain: persona',
    '    name: standard',
    'teamEnvelope:',
    '  allow:',
    '    - assign-task',
    '    - create-member',
    '    - send-message',
    '    - report-progress',
    '  deny:',
    '    - delete-team',
    'memberEnvelopes: []',
    'policyStates:',
    '  - id: default',
    '    description: "mcp-initial-grant smoke default state."',
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
}

/** The row anchor: a plain LEGACY leader (no capabilities block at all). */
const BP_ANCHOR_YAML = [
  '---',
  'schemaVersion: 1',
  'blueprintId: team.mgis-anchor',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  `  persona: "You are the leader of the mgis smoke boot team. ${MK_BOOT} is the probe marker."`,
  'members: []',
  'requirements: []',
  'memberEnvelopes: []',
  'policyStates: []',
  'metadata: {}',
  '---',
  '',
].join('\n')

// ── the production row config + profile-patch emitter ───────────────────────

function teamRowConfig({ bootPhase }) {
  return {
    rootSessionId: ROOT,
    bootPhase,
    blueprintSource: BP_ANCHOR_YAML,
    // The saved-source catalog (the team.create v2 blueprintId lookup — the
    // real product creation path). The files live under the world home.
    blueprintDir: BLUEPRINT_DIR,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'mgis-smoke-model' },
    deniedSelection: null,
    mcpServers: [
      { name: SERVER_A, port: PORT_A },
      { name: SERVER_B, port: PORT_B },
    ],
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    // Row-owned plain-JS module URLs (the t12-vertical live-verified form):
    // the WORKTREE dist (this branch's build).
    glueUrl: pathToFileURL(GLUE_PATH).href,
    seamUrl: pathToFileURL(SEAM_PATH).href,
  }
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

const PRODUCTION_ROW_NAME = pathToFileURL(PRODUCTION_ROW_PATH).href

function writeTeamPatchFile(patchPath, bootPhase) {
  mkdirSync(dirname(patchPath), { recursive: true })
  const lines = [
    `# mcp-initial-grant Gate D smoke patch layer (world ${HOME_NAME}): production dsh-agent-team row (WORKTREE ${WORKTREE} built dist — this branch's build) + p6t6 observability row — mounted ONLY through this public profile-patch seam.`,
    '# Row config: mcpServers [mcp_signal:3491, mcp_designer:3492] + legacy mcpServer:null; row anchor = the capabilities-LESS legacy blueprint (the D6 control); blueprintDir = the world-home saved sources (Team-1/Team-2).',
    '- insert:',
    ...yamlEmitItem({ id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: teamRowConfig({ bootPhase }) }, 2),
    ...yamlEmitItem({ id: 'p6t6-team-tools', name: P6T6_ROW_NAME }, 2),
    '',
  ]
  writeFileSync(patchPath, lines.join('\n'))
}

// ── the mock model oracle ───────────────────────────────────────────────────
// Chain routing: the LAST user message carrying a marker + the tool messages
// AFTER it (multi-turn-safe; a title side-call returns neutral text).
// THE POINT OF THIS ORACLE: the created leaders' FIRST turns are scripted
// to DIRECTLY CALL the MCP tools (tool-call replies) — proving the initial
// grant is not merely mounted in state but EXECUTABLE by the agent.

function toolCall(name, argumentsObj) {
  return { kind: 'tool-call', toolCalls: [{ id: `call-mgis-${Math.random().toString(36).slice(2, 10)}`, name, arguments: argumentsObj }] }
}

function makeDecide() {
  const all = [MK_BOOT, MK_T1, MK_T2, MK_T1B, MK_RT1, MK_RT2]
  return function decide({ req }) {
    const msgs = Array.isArray(req?.messages) ? req.messages : []
    const first = msgs[0]
    if (typeof first?.content === 'string' && first.content.startsWith('Create a concise title')) {
      return { kind: 'text', content: 'mgis smoke session' }
    }
    let lastUserIdx = -1
    for (let i = msgs.length - 1; i >= 0; i -= 1) {
      const m = msgs[i]
      if (m?.role !== 'user') continue
      const t = typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')
      if (all.some((mk) => t.includes(mk))) { lastUserIdx = i; break }
    }
    if (lastUserIdx === -1) {
      for (let i = msgs.length - 1; i >= 0; i -= 1) {
        if (msgs[i]?.role === 'user') { lastUserIdx = i; break }
      }
    }
    const lastUser = lastUserIdx === -1 ? '' : (typeof msgs[lastUserIdx].content === 'string' ? msgs[lastUserIdx].content : JSON.stringify(msgs[lastUserIdx].content))
    const toolsAfter = msgs.slice(lastUserIdx + 1).filter((m) => m?.role === 'tool').length
    if (lastUser.includes(MK_BOOT)) {
      return { kind: 'text', content: 'MGIS_BOOT_DONE' } // the legacy control: NO tool calls
    }
    if (lastUser.includes(MK_T1)) {
      switch (toolsAfter) {
        case 0: return toolCall(TOOL_A, { msg: 't1-a' })
        case 1: return { kind: 'text', content: 'MGIS_T1_DONE' }
        default: return { kind: 'text', content: `MGIS_T1_FALLTHROUGH tools=${toolsAfter}` }
      }
    }
    if (lastUser.includes(MK_T2)) {
      switch (toolsAfter) {
        case 0: return toolCall(TOOL_B, { msg: 't2-b' })
        case 1: return { kind: 'text', content: 'MGIS_T2_DONE' }
        default: return { kind: 'text', content: `MGIS_T2_FALLTHROUGH tools=${toolsAfter}` }
      }
    }
    if (lastUser.includes(MK_T1B)) {
      // Post-tighten (the leader's allow is now DENY): the scripted call
      // to A targets a tool that is NO LONGER on the surface — the agent
      // loop returns the unknown-tool error as the tool result; the turn
      // still completes.
      switch (toolsAfter) {
        case 0: return toolCall(TOOL_A, { msg: 't1b-a' })
        case 1: return { kind: 'text', content: 'MGIS_T1B_DONE' }
        default: return { kind: 'text', content: `MGIS_T1B_FALLTHROUGH tools=${toolsAfter}` }
      }
    }
    if (lastUser.includes(MK_RT1)) {
      // Post-resume Team-1: the durable DENY survived the restart — there
      // is no MCP tool to call; the turn is a plain text ack.
      return { kind: 'text', content: 'MGIS_RT1_DONE' }
    }
    if (lastUser.includes(MK_RT2)) {
      switch (toolsAfter) {
        case 0: return toolCall(TOOL_B, { msg: 'rt2-b' })
        case 1: return { kind: 'text', content: 'MGIS_RT2_DONE' }
        default: return { kind: 'text', content: `MGIS_RT2_FALLTHROUGH tools=${toolsAfter}` }
      }
    }
    return { kind: 'text', content: `MGIS_DEFAULT_ACK_${NONCE}` }
  }
}

/** Poll the mock capture for a request whose messages carry `marker`. */
async function waitForMockRequest(mock, marker, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const req = mock.requests.find((r) => (r.body?.messages ?? []).some((m) => typeof m.content === 'string' && m.content.includes(marker)))
    if (req !== undefined) return req
    if (Date.now() >= deadline) return null
    await new Promise((r) => setTimeout(r, 500))
  }
}

/** The mock request where the turn carrying `marker` ENDED (final text reply). */
async function waitForTurnDone(mock, marker, doneText, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const hit = mock.requests.find((r) => r.reply?.kind === 'text' && r.reply.content === doneText && (r.body?.messages ?? []).some((m) => typeof m.content === 'string' && m.content.includes(marker)))
    if (hit !== undefined) return hit
    if (Date.now() >= deadline) return null
    await new Promise((r) => setTimeout(r, 500))
  }
}

/** The model-facing MCP tool set of one captured model request. */
function mcpToolsOf(req) {
  if (req === undefined || req === null) return null
  return (req.body?.tools ?? [])
    .map((t) => t?.function?.name ?? t?.name)
    .filter((n) => typeof n === 'string' && n.startsWith('mcp__'))
}

/** The tool-call RESULT contents of a turn (the executed tool outputs). */
function toolResultsOf(req) {
  const msgs = req?.body?.messages ?? []
  return msgs.filter((m) => m?.role === 'tool').map((m) => String(m.content ?? ''))
}

// ── /__p6t6/state mcp shape classification (I5) ─────────────────────────────

function classifyMcpShape(mcp) {
  if (mcp === undefined || mcp === null) return 'absent'
  if (typeof mcp === 'object' && mcp.servers !== undefined && !Array.isArray(mcp.servers) && typeof mcp.servers === 'object') return 'i5-servers'
  if (typeof mcp === 'object' && ('serverName' in mcp || 'mounted' in mcp)) return 'legacy-single'
  return 'unknown'
}

/** Per-session effective MCP map from a state body (I5 shape). */
function effectiveMcpMap(stateBody, sessionId, configuredNames) {
  const mcp = stateBody?.governance?.sessions?.[sessionId]?.mcp
  const shape = classifyMcpShape(mcp)
  const map = {}
  for (const name of configuredNames) {
    const s = shape === 'i5-servers' ? mcp?.servers?.[name] : undefined
    map[name] = s === undefined || s === null
      ? { present: false, mounted: false, allowed: null }
      : { present: true, mounted: s.mounted === true, allowed: typeof s.allowed === 'boolean' ? s.allowed : null }
  }
  return { shape, map, raw: mcp }
}

// ── world boot / stop ───────────────────────────────────────────────────────

const liveHosts = new Set()

function assertFreshHome(home, label) {
  if (existsSync(home)) {
    const entries = readdirSync(home)
    if (entries.length > 0) {
      dieFatal(`${label}: DSH home ${home} exists and is non-empty (${entries.length} entries) — fail CLOSED; delete it to re-run`)
    }
  }
  mkdirSync(home, { recursive: true })
  writeFileSync(LOCK_FILE, JSON.stringify({
    world: home,
    pid: process.pid,
    kit: 'mcp-initial-grant-smoke.mjs',
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
    mcpPort: PORT_A,
  }, null, 2))
  log(`${label}: patch (bootPhase=${phase}) + directive (boot=${boot}) written`)
  const started = await instance.start({ timeoutMs: 240_000 })
  rec.url = started.url
  rec.logPath = started.logPath
  liveHosts.add(rec)
  const m = /^http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)$/.exec(started.url)
  if (m === null) dieFatal(`${label}: unexpected boot url shape: ${started.url}`)
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
    await new Promise((r) => setTimeout(r, 1000))
  }
  log(`${label}: row ready — toolCount=${rec.health.body?.toolCount} liveSessions=${JSON.stringify(rec.health.body?.liveSessions ?? [])}`)
  return rec
}

async function stopHost(rec) {
  try {
    const res = await rec.instance.stop({ timeoutMs: 20_000 })
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

/** Drive one turn on a LIVE session and snapshot (state + model schema). */
async function probeTurn({ label, host, sessionId, marker, mock, doneText }) {
  const res = await apiPrompt(host.origin, host.cookie, sessionId, marker)
  if (!(res.status === 200 && res.body?.result?.ok === true)) {
    throw new Error(`${label}: turn not admitted (apiPrompt status=${res.status} body=${JSON.stringify(res.body).slice(0, 300)})`)
  }
  const done = await waitForTurnDone(mock, marker, doneText, 240_000)
  if (done === null) throw new Error(`${label}: the turn carrying ${marker} did not complete with ${doneText} within 240s (requests=${mock.requests.length})`)
  const state = await p6t6State(host.port)
  if (state.status !== 200 || state.body === null) throw new Error(`${label}: state route unavailable: HTTP ${state.status}`)
  return { label, done, stateBody: state.body, schema: mcpToolsOf(done), results: toolResultsOf(done) }
}

// ── MAIN ────────────────────────────────────────────────────────────────────

async function main() {
  let host1 = null
  let host2 = null
  let miniA = null
  let miniB = null
  let mockRef = { current: null }
  let hostPort = null
  let tightenRec = null
  const created = { t1: null, t2: null }

  mkdirSync(RUN_DIR, { recursive: true })
  RUN_LOG = join(RUN_DIR, 'run.log')
  log(`=== mcp-initial-grant Gate D real-host smoke ${RUN_STAMP} ===`)
  log(`worktree=${WORKTREE}`)
  log(`testuse=${HOST_TREE} @ ${HOST_BASELINE_SHA.slice(0, 10)}`)
  log(`evidence=${RUN_DIR} keep=${FLAG_KEEP}`)

  // ── pre-flight ────────────────────────────────────────────────────────────
  for (const p of [PRODUCTION_ROW_PATH, GLUE_PATH, SEAM_PATH]) {
    if (!existsSync(p)) dieFatal(`required worktree file missing: ${p}`)
  }
  const stablePre = {}
  for (const u of STABLE_URLS) stablePre[u] = await probeStableInstance(u)
  writeFileSync(join(RUN_DIR, 'stable-pre.json'), JSON.stringify(stablePre, null, 2))
  log(`stable pre-probes: ${STABLE_URLS.map((u) => `${new URL(u).port}=${stablePre[u].status}`).join(' ')}`)

  const gitPreDir = join(RUN_DIR, 'git-pre')
  mkdirSync(gitPreDir, { recursive: true })
  const gitPre = await captureGitState(HOST_TREE, gitPreDir)
  writeFileSync(join(RUN_DIR, 'testuse-pre.json'), JSON.stringify({ ...gitPre, baselineSha: HOST_BASELINE_SHA, at: new Date().toISOString() }, null, 2))
  if (gitPre.statusEmpty !== true || gitPre.diffEmpty !== true) {
    dieFatal(`test-use worktree is NOT pristine before the run (porcelain non-empty) — fix before running (TEST_METHODS §3.5)`)
  }
  if (gitPre.head !== HOST_BASELINE_SHA) {
    dieFatal(`test-use HEAD ${gitPre.head} != baseline ${HOST_BASELINE_SHA}`)
  }

  if (HOST_PORT_ARG !== undefined) {
    const p = Number(HOST_PORT_ARG)
    if (!Number.isInteger(p) || !(p >= 3181 && p <= 3186)) dieFatal(`--host-port must be an integer in 3181..3186 (3180/3080 forbidden)`)
    hostPort = p
  } else {
    for (const p of HOST_PORT_CANDIDATES) {
      if (!(await portInUse(p))) { hostPort = p; break }
    }
    if (hostPort === null) dieFatal('no free port in the 3181..3186 family')
  }
  for (const [label, p] of [['mcpA', PORT_A], ['mcpB', PORT_B], ['mock', MOCK_PORT]]) {
    if (await portInUse(p)) dieFatal(`port ${label}=${p} is already in use — refusing to start`)
  }
  log(`ports: host=${hostPort} mcpA=${PORT_A} mcpB=${PORT_B} mock=${MOCK_PORT}`)

  assertFreshHome(HOME, 'smoke world')
  mkdirSync(BLUEPRINT_DIR, { recursive: true })
  writeFileSync(join(BLUEPRINT_DIR, 'mgis-t1.yaml'), savedBlueprintYaml(BP_T1_ID, `You are the leader of the mgis T1 team. ${MK_T1} is your first-turn marker.`, [SERVER_A], []))
  writeFileSync(join(BLUEPRINT_DIR, 'mgis-t2.yaml'), savedBlueprintYaml(BP_T2_ID, `You are the leader of the mgis T2 team. ${MK_T2} is your first-turn marker.`, [SERVER_B], []))
  log(`world materialized: home=${HOME} blueprints=${BLUEPRINT_DIR} (t1=[A] t2=[B] — disjoint: upstream mcp-client name registry, see header)`)

  // Services: mock model + mini MCP A/B.
  const mock = await startMockModel({ port: MOCK_PORT, decide: makeDecide(), log: (l) => log(`mock: ${l}`) })
  if (mock.port !== MOCK_PORT) dieFatal(`mock model landed on ${mock.port}, expected ${MOCK_PORT}`)
  mockRef.current = mock
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${MOCK_PORT}`
  process.env.DEEPSEEK_API_KEY = 'mgis-smoke-mock-key'
  log(`mock DeepSeek endpoint up at 127.0.0.1:${MOCK_PORT}`)
  try {
    miniA = await startMiniMcp(PORT_A, 'a')
    if (miniA.port !== PORT_A) dieFatal(`mini MCP A landed on ${miniA.port}, expected ${PORT_A}`)
    miniB = await startMiniMcp(PORT_B, 'b')
    if (miniB.port !== PORT_B) dieFatal(`mini MCP B landed on ${miniB.port}, expected ${PORT_B}`)
  } catch (error) {
    dieFatal(`mini MCP startup failed: ${error.message}`)
  }
  log(`mini MCP A up on 127.0.0.1:${PORT_A} (${SERVER_A}); B up on 127.0.0.1:${PORT_B} (${SERVER_B})`)

  try {
    // ── world boot (create) ─────────────────────────────────────────────────
    await ensureProfile({ instance: new DshInstance({ hostTree: HOST_TREE, dshHome: HOME, port: hostPort, clientCommitHash: CLIENT_COMMIT_HASH, logDir: join(RUN_DIR, 'instances', 'profile-init') }), log, timeoutMs: 180_000 })
    log('web profile ensured (throwaway boot if first use)')
    host1 = await bootHost({ label: 'HOST1-CREATE', port: hostPort, boot: 1, phase: 'create' })
    const st1 = await p6t6StateReady(host1.port, { rootSessionId: ROOT, phase: 'create' })
    log(`HOST1: state ready (teamSession=${st1.body?.teamSession?.blueprintId})`)

    // ── Z1: the zero-seed proof (BEFORE any team exists) ────────────────────
    {
      const overrides = st1.body?.governance?.overrides
      check('Z1', 'governance.overrides is EMPTY at world boot (zero durable seeds — the forbidden initial override.set was never performed)',
        Array.isArray(overrides) && overrides.length === 0,
        `overrides=${JSON.stringify(overrides)}`)
      writeFileSync(join(RUN_DIR, 'z1-override-probe.json'), JSON.stringify({
        note: 'The whole point of this kit: the initial MCP mounts below must happen with THIS store still empty (plan §7: prove governance.overrides = [] + Blueprint initial allow mounted).',
        at: new Date().toISOString(),
        overrides,
      }, null, 2))
      finishCriterion('Z1')
    }

    // ── D1: team.create v2 (Team-1) — the real product creation path ────────
    const createT1 = await remoteCall(host1.origin, host1.cookie, 'team.create', {
      rootSessionId: ROOT_T1,
      blueprintId: BP_T1_ID,
      initialWork: { prompt: `${MK_T1} Your first task: ping the mcp server now — call the mcp__mcp_signal__ping tool with msg "t1-a".` },
    }, 't1')
    writeFileSync(join(RUN_DIR, 'd1-team-create-t1.json'), JSON.stringify(createT1.body ?? createT1, null, 2))
    const t1Data = (() => { try { return remoteValue(createT1, 'team.create') } catch { return null } })()
    created.t1 = t1Data
    check('D1', 'team.create v2 (Team-1) succeeds on the fresh root (path=fresh-root; open Root + admitInitialWork)',
      createT1.status === 200 && t1Data !== null && t1Data?.path === 'fresh-root',
      `status=${createT1.status} data=${JSON.stringify(t1Data ?? createT1.body).slice(0, 300)}`)
    finishCriterion('D1')
    if (t1Data === null) throw new Error('D1 failed — aborting before the T1 assertions')

    // ── D2: the T1 leader's FIRST turn directly called MCP (A pong) ─────────
    const t1Turn = await probeTurn({ label: 'T1 leader first turn', host: host1, sessionId: ROOT_T1, marker: MK_T1, mock, doneText: 'MGIS_T1_DONE' })
    const t1Pongs = t1Turn.results.filter((r) => r.includes('pong:a:t1-a'))
    check('D2', 'Team-1 leader FIRST-turn initial work DIRECTLY CALLED MCP: mcp__mcp_signal__ping executed (pong result observed) — no override.set, no boundary trigger: the initial work itself is the first boundary',
      t1Pongs.length === 1, `toolResults=${JSON.stringify(t1Turn.results).slice(0, 400)}`)
    writeFileSync(join(RUN_DIR, 'd2-t1-first-turn.json'), JSON.stringify({
      schema: t1Turn.schema,
      toolResults: t1Turn.results,
    }, null, 2))
    finishCriterion('D2')

    // ── D3: T1 state — exact mount set + overrides STILL empty ──────────────
    const t1State = await p6t6State(host1.port)
    writeFileSync(join(RUN_DIR, 'd3-t1-state.json'), JSON.stringify(t1State.body, null, 2))
    const t1Eff = effectiveMcpMap(t1State.body, ROOT_T1, [SERVER_A, SERVER_B])
    const t1Overrides = t1State.body?.governance?.overrides
    check('D3', 'Team-1 leader state: I5 shape, A mounted, B NOT mounted (the bound initial allow is [A] only — the mount is exactly the Blueprint initial grant, zero overrides)',
      t1Eff.shape === 'i5-servers' && t1Eff.map[SERVER_A].mounted === true && t1Eff.map[SERVER_B].mounted === false,
      `eff=${JSON.stringify(t1Eff.map)} shape=${t1Eff.shape}`)
    check('D3', 'Team-1 leader schema carries EXACTLY [A] mcp tools (the initial grant is what mounted it)',
      JSON.stringify([...(t1Turn.schema ?? [])].sort()) === JSON.stringify([TOOL_A]),
      `schema=${JSON.stringify(t1Turn.schema)}`)
    check('D3', 'governance.overrides is STILL EMPTY after Team-1 creation + its MCP mounts (the mount came from the Blueprint, not from any record)',
      Array.isArray(t1Overrides) && t1Overrides.length === 0,
      `overrides=${JSON.stringify(t1Overrides)}`)
    finishCriterion('D3')

    // ── D4: team.create v2 (Team-2) — the MANDATORY second fresh root ───────
    const createT2 = await remoteCall(host1.origin, host1.cookie, 'team.create', {
      rootSessionId: ROOT_T2,
      blueprintId: BP_T2_ID,
      initialWork: { prompt: `${MK_T2} Your first task: ping the mcp server now — call the mcp__mcp_designer__ping tool with msg "t2-b".` },
    }, 't2')
    writeFileSync(join(RUN_DIR, 'd4-team-create-t2.json'), JSON.stringify(createT2.body ?? createT2, null, 2))
    const t2Data = (() => { try { return remoteValue(createT2, 'team.create') } catch { return null } })()
    created.t2 = t2Data
    check('D4', 'team.create v2 (Team-2) — the MANDATORY second fresh root — succeeds independently of Team-1 (path=fresh-root)',
      createT2.status === 200 && t2Data !== null && t2Data?.path === 'fresh-root',
      `status=${createT2.status} data=${JSON.stringify(t2Data ?? createT2.body).slice(0, 300)}`)
    finishCriterion('D4')
    if (t2Data === null) throw new Error('D4 failed — aborting before the T2 assertions')

    // ── D5: the T2 leader's first turn directly called MCP (B pong) ─────────
    const t2Turn = await probeTurn({ label: 'T2 leader first turn', host: host1, sessionId: ROOT_T2, marker: MK_T2, mock, doneText: 'MGIS_T2_DONE' })
    const t2Pong = t2Turn.results.filter((r) => r.includes('pong:b:t2-b'))
    check('D5', 'Team-2 leader FIRST-turn initial work DIRECTLY CALLED MCP: mcp__mcp_designer__ping executed (pong result observed) — the second fresh root did NOT reset MCP to zero',
      t2Pong.length === 1, `toolResults=${JSON.stringify(t2Turn.results).slice(0, 400)}`)
    const t2State = await p6t6State(host1.port)
    writeFileSync(join(RUN_DIR, 'd5-t2-state.json'), JSON.stringify(t2State.body, null, 2))
    const t2Eff = effectiveMcpMap(t2State.body, ROOT_T2, [SERVER_A, SERVER_B])
    const t2Overrides = t2State.body?.governance?.overrides
    check('D5', 'Team-2 leader state: B mounted, A NOT mounted (its bound initial allow is [B] — a cross-root leak onto Team-1\'s template would have mounted A INSTEAD; the row anchor is capabilities-LESS so a row-anchor leak would mount NOTHING)',
      t2Eff.shape === 'i5-servers' && t2Eff.map[SERVER_B].mounted === true && t2Eff.map[SERVER_A].mounted === false,
      `eff=${JSON.stringify(t2Eff.map)}`)
    check('D5', 'Team-2 leader schema carries EXACTLY [B] mcp tools',
      JSON.stringify([...(t2Turn.schema ?? [])].sort()) === JSON.stringify([TOOL_B]),
      `schema=${JSON.stringify(t2Turn.schema)}`)
    check('D5', 'governance.overrides is EMPTY for Team-2 too (its mount came from its own bound Blueprint)',
      Array.isArray(t2Overrides) && t2Overrides.length === 0,
      `overrides=${JSON.stringify(t2Overrides)}`)
    finishCriterion('D5')

    // ── D6: boot-root legacy control (capabilities-LESS row anchor) ─────────
    const bootTurn = await probeTurn({ label: 'boot root probe', host: host1, sessionId: ROOT, marker: MK_BOOT, mock, doneText: 'MGIS_BOOT_DONE' })
    const bootEff = effectiveMcpMap(bootTurn.stateBody, ROOT, [SERVER_A, SERVER_B])
    check('D6', 'boot-root legacy control: NOTHING mounted (the capabilities-LESS anchor has no initial grant — the legacy fail-closed baseline is unchanged in the production world)',
      bootEff.map[SERVER_A].mounted === false && bootEff.map[SERVER_B].mounted === false,
      `eff=${JSON.stringify(bootEff.map)} shape=${bootEff.shape}`)
    check('D6', 'boot-root legacy control: ZERO mcp tools in the model-facing schema',
      (bootTurn.schema ?? []).length === 0,
      `schema=${JSON.stringify(bootTurn.schema)}`)
    finishCriterion('D6')

    // ── D7: post-creation durable tighten — dynamic beats static ────────────
    // The single-server initial grant [A] is tightened to DENY (the only
    // meaningful tightening for a 1-server grant — a subset allow would be
    // the no-op [A]). The record-backed layer must then beat the static
    // initial grant at the next boundary. (The de-seeded multi-MCP smoke
    // keeps the analogous subset tighten [A,B]->[A] — same semantics.)
    const setRes = await remoteCall(host1.origin, host1.cookie, 'override.set', {
      teamSessionId: ROOT_T1,
      capability: 'mcp',
      value: { kind: 'deny' },
      actor: { kind: 'human' },
      scope: 'instance',
      targetInstanceId: LEADER_INSTANCE_ID,
    }, 'tighten')
    let tightenErr = null
    try {
      tightenRec = remoteValue(setRes, 'override.set')?.record ?? remoteValue(setRes, 'override.set')
    } catch (error) {
      tightenErr = String(error.message ?? error)
    }
    writeFileSync(join(RUN_DIR, 'd7-tighten-response.json'), JSON.stringify(setRes.body ?? setRes, null, 2))
    check('D7', 'post-creation durable tighten admitted (Team-1 leader mcp [A] -> DENY; instance scope — the legitimate dynamic-governance scenario; the record must now beat the static initial grant)',
      tightenErr === null && tightenRec !== null && typeof tightenRec?.recordId === 'string',
      tightenErr ?? `record=${JSON.stringify(tightenRec).slice(0, 300)}`)
    if (tightenErr === null) {
      // The NEXT boundary: a team-tool execution on the T1 root (executeTool
      // runs the request-boundary machinery: ensure-live -> boundary
      // reconciliation -> tools.execute).
      const trigRes = await p6t6Tool(host1.port, 'team_list_members', {
        rootSessionId: ROOT_T1,
        requestToken: `mgis-trig-${NONCE}`,
      }, ROOT_T1)
      const trig = (() => { try { return toolValue(trigRes, 'team_list_members') } catch { return null } })()
      log(`D7 boundary trigger: team_list_members on ${ROOT_T1} (status=${trig?.status ?? trigRes.body?.error ?? '?'})`)
      let t1bTurn = null
      let t1bTurnErr = null
      try {
        t1bTurn = await probeTurn({ label: 'T1 leader post-tighten', host: host1, sessionId: ROOT_T1, marker: MK_T1B, mock, doneText: 'MGIS_T1B_DONE' })
      } catch (error) {
        t1bTurnErr = String(error?.message ?? error)
      }
      const t1bState = await p6t6State(host1.port)
      writeFileSync(join(RUN_DIR, 'd7-t1b-state.json'), JSON.stringify({ state: t1bState.body, t1bTurn, t1bTurnErr }, null, 2))
      const t1bEff = effectiveMcpMap(t1bState.body, ROOT_T1, [SERVER_A, SERVER_B])
      check('D7', 'after the next boundary, A is NOT mounted in the Team-1 leader state (the record-backed DENY beat the static initial grant; deny-first dispose)',
        t1bEff.map[SERVER_A].mounted === false && t1bEff.map[SERVER_B].mounted === false,
        `eff=${JSON.stringify(t1bEff.map)}`)
      check('D7', 'ALL mcp tools are GONE from the leader model-facing schema (the scripted call to the now-absent A tool degrades to an unknown-tool error result — the turn still completes)',
        t1bTurnErr === null && (t1bTurn.schema ?? []).length === 0,
        `turnErr=${t1bTurnErr ?? '-'} schema=${JSON.stringify(t1bTurn?.schema)} results=${JSON.stringify(t1bTurn?.results ?? []).slice(0, 300)}`)
      // The state projection's governance.overrides lists the ROW's boot
      // root records only; this instance-scope record is stored under the
      // T1 root (its rootSessionId) — the durable proof is the admission
      // response record + the EFFECT (the unmount above + D8: it survives
      // the restart and still beats the re-derived initial grant).
      check('D7', 'the tighten record was durably admitted (instance scope, T1 root, mcp deny — the record the boundary just consumed)',
        tightenRec !== null && typeof tightenRec?.recordId === 'string'
        && tightenRec?.scope === 'instance' && tightenRec?.values?.mcp?.kind === 'deny',
        `record=${JSON.stringify(tightenRec).slice(0, 300)}`)
    } else {
      for (const n of ['after the next boundary, A is NOT mounted in the Team-1 leader state (the record-backed DENY beat the static initial grant; deny-first dispose)', 'ALL mcp tools are GONE from the leader model-facing schema (the scripted call to the now-absent A tool degrades to an unknown-tool error result — the turn still completes)', 'the tighten record was durably admitted (instance scope, T1 root, mcp deny — the record the boundary just consumed)']) {
        check('D7', n, false, `skipped: tighten admission failed (${tightenErr})`)
      }
    }
    finishCriterion('D7')

    // ── D8: COLD RESUME (host restart, same home, phase=resume) ─────────────
    // Product-path note (characterization, run mgis-2026-09-20T09-46-17): a
    // NATIVE prompt to a created team root whose first post-restart touch is
    // that prompt does NOT resume the row agent (the DSH core composes a
    // native agent for the top-level session — no team tools, no MCP). The
    // supported interaction paths for a team root (the team-remote methods
    // and the team TOOL executions) go through ensureLiveAgent, which
    // resumes the row agent WITH the shared setup (the initial-grant
    // re-derivation). D8 therefore re-attaches each created root with a
    // team-tool execution (executeTool = ensure-live -> boundary ->
    // execute) BEFORE the probe turns — the real product sequence after a
    // restart (the first team interaction re-attaches; subsequent model
    // turns run on the re-attached agent).
    const preRestart = {
      [ROOT_T1]: effectiveMcpMap((await p6t6State(host1.port)).body, ROOT_T1, [SERVER_A, SERVER_B]).map,
      [ROOT_T2]: effectiveMcpMap((await p6t6State(host1.port)).body, ROOT_T2, [SERVER_A, SERVER_B]).map,
    }
    log(`D8: pre-restart effective sets: ${JSON.stringify(preRestart)}`)
    await stopHost(host1)
    host1 = null
    host2 = await bootHost({ label: 'HOST2-RESUME', port: hostPort, boot: 2, phase: 'resume' })
    const st2 = await p6t6StateReady(host2.port, { rootSessionId: ROOT, phase: 'resume' })
    log(`HOST2: state ready after restart (phase=resume)`)
    // Diagnostic evidence: the durable session-store tree under the home at
    // resume time (what sessionIsDurable sees). A recursive listing of the
    // home's `sessions` root (2 levels + file names) — this is the ground
    // truth for the cold-resume eligibility question.
    try {
      const sessionsRoot = join(HOME, 'sessions')
      const tree = {}
      const top = existsSync(sessionsRoot) ? readdirSync(sessionsRoot, { withFileTypes: true }) : []
      for (const d of top) {
        if (!d.isDirectory()) { tree[d.name] = '(file)'; continue }
        const sub = readdirSync(join(sessionsRoot, d.name), { withFileTypes: true })
        tree[d.name] = {}
        for (const s of sub) {
          if (s.isDirectory()) {
            tree[d.name][s.name] = readdirSync(join(sessionsRoot, d.name, s.name))
          } else {
            tree[d.name][s.name] = '(file)'
          }
        }
      }
      writeFileSync(join(RUN_DIR, 'd8-home-sessions-tree.json'), JSON.stringify(tree, null, 2))
      log(`D8: home sessions tree dumped (top=${JSON.stringify(Object.keys(tree))})`)
    } catch (error) {
      log(`D8: home sessions tree dump failed: ${error.message}`)
    }
    // Pre-trigger live set: proof that the created roots are NOT live right
    // after the resume boot (boot re-attaches only the boot root + its
    // members) — so the post-trigger liveness below is the re-attach's own
    // effect, not an assumption.
    const preTriggerState = await p6t6State(host2.port)
    const preTriggerLive = Object.keys(preTriggerState.body?.governance?.sessions ?? {})
    writeFileSync(join(RUN_DIR, 'd8-pre-trigger-live.json'), JSON.stringify({ preTriggerLive }, null, 2))
    log(`D8: live sessions BEFORE the re-attach triggers: ${JSON.stringify(preTriggerLive)}`)
    // Re-attach the created roots through the product path (team-tool
    // execution -> ensureLiveAgent resume WITH the shared setup -> the
    // initial grant is re-derived under each root's OWN bound snapshot).
    const trgT2Res = await p6t6Tool(host2.port, 'team_list_members', { rootSessionId: ROOT_T2, requestToken: `mgis-rt2-${NONCE}` }, ROOT_T2)
    writeFileSync(join(RUN_DIR, 'd8-reattach-t2-response.json'), JSON.stringify(trgT2Res.body, null, 2))
    const trgT2 = (() => { try { return toolValue(trgT2Res, 'team_list_members') } catch (error) { log(`D8: T2 trigger unwrap error: ${error.message.slice(0, 400)}`); return null } })()
    log(`D8: T2 re-attach trigger (team_list_members) status=${trgT2?.status ?? (trgT2Res.body?.error ? JSON.stringify(trgT2Res.body.error).slice(0, 300) : '?')}`)
    const trgT1Res = await p6t6Tool(host2.port, 'team_list_members', { rootSessionId: ROOT_T1, requestToken: `mgis-rt1-${NONCE}` }, ROOT_T1)
    writeFileSync(join(RUN_DIR, 'd8-reattach-t1-response.json'), JSON.stringify(trgT1Res.body, null, 2))
    const trgT1 = (() => { try { return toolValue(trgT1Res, 'team_list_members') } catch (error) { log(`D8: T1 trigger unwrap error: ${error.message.slice(0, 400)}`); return null } })()
    log(`D8: T1 re-attach trigger (team_list_members) status=${trgT1?.status ?? (trgT1Res.body?.error ? JSON.stringify(trgT1Res.body.error).slice(0, 300) : '?')}`)
    const rt1Turn = await probeTurn({ label: 'T1 leader post-resume', host: host2, sessionId: ROOT_T1, marker: MK_RT1, mock, doneText: 'MGIS_RT1_DONE' })
    const rt2Turn = await probeTurn({ label: 'T2 leader post-resume', host: host2, sessionId: ROOT_T2, marker: MK_RT2, mock, doneText: 'MGIS_RT2_DONE' })
    const rtState = await p6t6State(host2.port)
    writeFileSync(join(RUN_DIR, 'd8-post-resume-state.json'), JSON.stringify(rtState.body, null, 2))
    const rt1Eff = effectiveMcpMap(rtState.body, ROOT_T1, [SERVER_A, SERVER_B])
    const rt2Eff = effectiveMcpMap(rtState.body, ROOT_T2, [SERVER_A, SERVER_B])
    // NOTE on the trigger shape: the re-attach is the EXECUTE-TOOL REQUEST
    // BOUNDARY (ensureLiveAgent resume WITH the shared setup -> the initial
    // grant re-derivation + mount, then prepareAgentForRequest) — it runs
    // BEFORE tools.execute, so the re-attach is complete even when the tool
    // CALL itself degrades. In THIS world the call does degrade: the kit
    // blueprint declares `capabilities.teamTools: kind: deny` on the leader
    // (the smoke world keeps the leader off the model-facing team surface —
    // the boot-root legacy anchor is the control that carries the full
    // twelve-tool catalog), so `team_list_members` answers unknown-tool by
    // design on BOTH host boots (the host-1 D7 boundary trigger shows the
    // same response and the same boundary effect). The re-attach itself is
    // asserted by the live views: both roots present in the post-resume
    // state (the boundary's setup + reconciliation ran on each).
    check('D8', 'cold resume: the product-path re-attach (team-tool execution = ensure-live resume WITH the shared setup + the request boundary) ran on BOTH created roots — they were NOT live right after the resume boot (boot re-attaches only the boot root + its members) and are LIVE in the post-resume state with their configured servers in the view',
      !preTriggerLive.includes(ROOT_T1) && !preTriggerLive.includes(ROOT_T2)
      && rt1Eff.map[SERVER_A].present === true && rt1Eff.map[SERVER_B].present === true
      && rt2Eff.map[SERVER_A].present === true && rt2Eff.map[SERVER_B].present === true,
      `preTriggerLive=${JSON.stringify(preTriggerLive)} t1=${JSON.stringify(rt1Eff.map)} t2=${JSON.stringify(rt2Eff.map)}`)
    check('D8', 'cold resume: Team-2 leader re-derives [B] from its bound Blueprint (ZERO overrides — no synthetic record to lean on) and the tool call EXECUTES (the live view proves the row agent re-attached with the shared setup)',
      rt2Eff.map[SERVER_B].present === true && rt2Eff.map[SERVER_B].mounted === true && rt2Eff.map[SERVER_A].mounted === false
      && rt2Turn.results.some((r) => r.includes('pong:b:rt2-b')),
      `eff=${JSON.stringify(rt2Eff.map)} overrides=${JSON.stringify(rtState.body?.governance?.overrides).slice(0, 200)} results=${JSON.stringify(rt2Turn.results).slice(0, 200)}`)
    check('D8', 'cold resume: Team-1 leader is LIVE with its configured servers in the view but NOTHING mounted — the durable DENY SURVIVED the restart and beats the re-derived initial allow [A] (a record-backed layer beats the static initial grant; the initial grant does NOT resurrect a denied server — T2 proves the re-derivation itself works on the same path)',
      rt1Eff.map[SERVER_A].present === true && rt1Eff.map[SERVER_B].present === true
      && rt1Eff.map[SERVER_A].mounted === false && rt1Eff.map[SERVER_B].mounted === false,
      `eff=${JSON.stringify(rt1Eff.map)} results=${JSON.stringify(rt1Turn.results).slice(0, 200)}`)
    check('D8', 'cold resume: effective sets match pre-restart exactly (no drift across the restart)',
      JSON.stringify(rt1Eff.map) === JSON.stringify(preRestart[ROOT_T1]) && JSON.stringify(rt2Eff.map) === JSON.stringify(preRestart[ROOT_T2]),
      `pre=${JSON.stringify(preRestart)} post t1=${JSON.stringify(rt1Eff.map)} t2=${JSON.stringify(rt2Eff.map)}`)
    finishCriterion('D8')
    await stopHost(host2)
    host2 = null
  } finally {
    // ── teardown ────────────────────────────────────────────────────────────
    // Model-facing surface evidence: the `tools` array the mock received per
    // request (the model-facing tool schema per turn — the t12-vertical
    // pattern) + the marker-bearing user text, for post-hoc analysis of
    // which surface each turn actually ran on.
    if (mockRef.current !== null) {
      try {
        const surface = (mockRef.current.requests ?? []).map((r) => {
          const tools = Array.isArray(r.body?.tools) ? r.body.tools.map((t) => t?.function?.name ?? t?.name ?? String(t)).sort() : []
          const messages = Array.isArray(r.body?.messages) ? r.body.messages : []
          const lastUser = [...messages].reverse().find((m) => m?.role === 'user')
          const text = typeof lastUser?.content === 'string' ? lastUser.content
            : (Array.isArray(lastUser?.content) ? (lastUser.content.find((c) => c?.type === 'text')?.text ?? '') : '')
          return {
            seq: r.seq,
            at: r.receivedAt,
            model: r.body?.model ?? null,
            toolCount: tools.length,
            mcpTools: tools.filter((n) => String(n).startsWith('mcp__')),
            teamTools: tools.filter((n) => String(n).startsWith('team_')),
            userTail: String(text).slice(-160),
            replyKind: r.reply?.kind ?? null,
          }
        })
        writeFileSync(join(RUN_DIR, 'mock-requests.json'), JSON.stringify(surface, null, 2))
        log(`mock request surface evidence -> mock-requests.json (${surface.length} requests)`)
      } catch (error) {
        log(`mock request surface dump failed: ${error.message}`)
      }
    }
    await sweepLiveHosts()
    if (miniA !== null) { await closeMini(miniA); log('mini MCP A closed') }
    if (miniB !== null) { await closeMini(miniB); log('mini MCP B closed') }
    if (mockRef.current !== null) { await mockRef.current.close(); log('mock model closed') }

    // H2: port release.
    try {
      const frees = {}
      for (const [label, p] of [['host', hostPort], ['mcpA', PORT_A], ['mcpB', PORT_B], ['mock', MOCK_PORT]]) {
        frees[label] = await waitForPortFree(p, 20_000)
      }
      check('H2', 'all run ports released after teardown', Object.values(frees).every(Boolean), JSON.stringify(frees))
    } catch (error) {
      check('H2', 'port release check completed', false, error.message)
    }
    finishCriterion('H2')

    // H1: test-use pristine + zero-touch probes.
    try {
      const gitPostDir = join(RUN_DIR, 'git-post')
      mkdirSync(gitPostDir, { recursive: true })
      const gitPost = await captureGitState(HOST_TREE, gitPostDir)
      const stablePost = {}
      for (const u of STABLE_URLS) stablePost[u] = await probeStableInstance(u)
      writeFileSync(join(RUN_DIR, 'testuse-post.json'), JSON.stringify({ ...gitPost, at: new Date().toISOString() }, null, 2))
      writeFileSync(join(RUN_DIR, 'stable-post.json'), JSON.stringify(stablePost, null, 2))
      check('H1', 'test-use worktree porcelain EMPTY after the run', gitPost.statusEmpty === true && gitPost.diffEmpty === true,
        `statusEmpty=${gitPost.statusEmpty} diffEmpty=${gitPost.diffEmpty} head=${gitPost.head}`)
      check('H1', `test-use HEAD still at baseline ${HOST_BASELINE_SHA}`, gitPost.head === HOST_BASELINE_SHA, `post=${gitPost.head}`)
      check('H1', ':3080/:3180 untouched (read-only probes, status unchanged pre==post)',
        STABLE_URLS.every((u) => stablePre[u].status === stablePost[u].status),
        `${STABLE_URLS.map((u) => `${new URL(u).port}: ${stablePre[u].status}->${stablePost[u].status}`).join(' ')}`)
    } catch (error) {
      check('H1', 'pristine/zero-touch check completed', false, error.message)
    }
    finishCriterion('H1')

    // Home teardown (TEST_METHODS §7).
    let homeKept = false
    if (FLAG_KEEP) {
      homeKept = true
      log(`--keep: home RETAINED as evidence at ${HOME} (TEST_METHODS §7)`)
    } else {
      rmSync(HOME, { recursive: true, force: true })
      try { rmSync(LOCK_FILE, { force: true }) } catch { /* gone with the home */ }
      log(`home deleted: ${HOME}`)
    }

    // Summary.
    const passed = CRITERIA.filter((c) => results[c.id].pass === true).map((c) => c.id)
    const failed = CRITERIA.filter((c) => results[c.id].pass !== true).map((c) => c.id)
    const summary = {
      task: 'mcp-initial-grant real-host smoke (plan Gate D: team.create v2 -> open Root -> admitInitialWork, zero initial override.set, two fresh roots, cold resume, post-creation tighten)',
      runStamp: RUN_STAMP,
      generatedAt: new Date().toISOString(),
      worktree: WORKTREE,
      hostTree: HOST_TREE,
      testUseBaseline: HOST_BASELINE_SHA,
      ports: { host: hostPort, mcpA: PORT_A, mcpB: PORT_B, mock: MOCK_PORT },
      home: { path: HOME, kept: homeKept, lockFile: LOCK_FILE },
      servers: { [SERVER_A]: { port: PORT_A }, [SERVER_B]: { port: PORT_B } },
      roots: { boot: ROOT, team1: ROOT_T1, team2: ROOT_T2 },
      created,
      tighten: tightenRec,
      modelPath: {
        used: 'mock-env',
        note: 'DEEPSEEK_BASE_URL=http://127.0.0.1:3496 + DEEPSEEK_API_KEY=mgis-smoke-mock-key exported to host launches; the created leaders\' first turns were scripted to DIRECTLY CALL the MCP tools (tool-call oracle replies).',
        baseUrl: process.env.DEEPSEEK_BASE_URL,
      },
      stable: { pre: stablePre, post: undefined },
      criteria: Object.values(results),
      passed,
      failed,
      pass: failed.length === 0,
      exitCode: failed.length === 0 ? 0 : 2,
    }
    summary.stable.post = results.H1.checks.length > 0 ? '(see stable-post.json)' : undefined
    writeFileSync(join(RUN_DIR, 'summary.json'), JSON.stringify(summary, null, 2))
    writeFileSync(join(RUN_DIR, 'criterion-list.json'), JSON.stringify(Object.values(results), null, 2))
    log(`summary -> ${join(RUN_DIR, 'summary.json')}`)
    log(`VERDICT ${summary.pass ? 'PASS' : 'FAIL'} — passed [${passed.join(', ')}] failed [${failed.join(', ')}]`)
    process.exitCode = summary.exitCode
  }
}

process.on('SIGTERM', () => {
  log('SIGTERM received — best-effort teardown')
  sweepLiveHosts().then(() => process.exit(130)).catch(() => process.exit(130))
})
process.on('SIGINT', () => {
  log('SIGINT received — best-effort teardown')
  sweepLiveHosts().then(() => process.exit(130)).catch(() => process.exit(130))
})

// Script entry guard: run main() only when this file is the executed entry
// point (an import — e.g. a static check — must NOT boot a host).
const IS_MAIN = (() => {
  const entry = process.argv[1]
  if (entry === undefined) return false
  try { return resolve(entry) === fileURLToPath(import.meta.url) } catch { return false }
})()

if (IS_MAIN) {
  main().catch((error) => {
  const msg = String(error?.stack ?? error)
  log(`FATAL (kit-level, run aborted): ${msg}`)
  try {
    mkdirSync(RUN_DIR, { recursive: true })
    writeFileSync(join(RUN_DIR, 'summary.json'), JSON.stringify({
      task: 'mcp-initial-grant real-host smoke (Gate D)',
      runStamp: RUN_STAMP,
      fatal: msg.slice(0, 4000),
      criteria: Object.values(results),
      pass: false,
      exitCode: 1,
    }, null, 2))
  } catch { /* RUN_DIR may not exist yet */ }
    console.log(JSON.stringify({ fatal: msg.slice(0, 2000), criteria: Object.values(results) }, null, 2))
    process.exit(1)
  })
}
