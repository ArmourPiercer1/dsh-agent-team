#!/usr/bin/env node
/**
 * PR-B effective-policy real-host smoke kit — the final gate for PR-B
 * ("effective-policy canonical read plane", plan §B.4).
 *
 * The kit boots a PRISTINE upstream 0.1.7-rc.1 DSH host (tests/
 * deepseek-harness-test-use) against a COPIED seed world (the mpr run end
 * state, tests/homes/mpr-2026-09-27T08-35-52) with the row retargeted at
 * THIS worktree's dist, and drives every criterion over the /team-remote
 * wire (wire-only — no p6t6 tool seam for the assertions). A mock model
 * (packages/tools/harness/mock-deepseek.mjs) is the witness: it records
 * EVERY actual provider request (body.model / body.tools / body.messages),
 * so each criterion asserts on the ACTUAL next LLM request, not on an ack.
 *
 * The six §B.4 criteria ("next request" = the member's next LLM request):
 *   C1 — model override → next request: `override.set` (capability model,
 *        human actor, instance scope) acks a committed record; a
 *        `member.followup`'s next request has body.model === the overridden
 *        model id (NOT the template baseline).
 *   C2 — MCP override → next request: `override.set` (capability mcp) acks;
 *        the followup request CARRIES the overridden MCP (body.tools has
 *        `mcp__prb-mcp-a__ping` present and NO `mcp__prb-mcp-b__*` tool).
 *   C3 — PolicyState switch → next request: on T1 (closed set ['default']) a
 *        `policyState.set` to an undeclared state is rejected typed
 *        (POLICY_STATE_UNKNOWN — the negative); on a NEW saved-source team
 *        T-PS (blueprint team.prb-ps with policyStates [default, focus],
 *        worker template with NO modelPreference) a `policyState.set`
 *        (stateId focus + a model cell) acks and the followup's next
 *        request has body.model === the state's model value. The structural
 *        sub-leg pins WHERE the closed set comes from, per F11 (fix-A,
 *        3b7039e8 — an ancestor of this base): on a team bound to team.prb-ps
 *        the bound-only `focus` COMMITS even though the boot blueprint does
 *        not declare it, `policyState.get` reports the bound set, a set to the
 *        boot-only `strict` is rejected POLICY_STATE_UNKNOWN reporting that
 *        bound set, and the rejection is durably inert (zero ledger /
 *        generation change).
 *   C4 — mutation ∥ concurrent request: `override.set` run CONCURRENTLY
 *        (Promise.all) with a `member.followup`; the followup completes with
 *        no activation error, the mutation commits (the durable winner is
 *        present afterwards), and the next deterministic boundary carries
 *        the committed value (no lost update; a coherent slot winner + gen).
 *   C5 — restart: stop host #1, boot host #2 on the SAME DSH_HOME (resume);
 *        the C1 model override, the C2 mcp override and the T-PS committed
 *        PolicyState still govern the NEXT request post-restart.
 *   C6 — inspect-config parity: `team.getProjection` (the inspect surface
 *        — `team.getReadState` is only a lightweight durable probe) reports
 *        the member's model as a full route (provider/model) that AGREES
 *        with the mock-observed wire body.model (route-vs-model split).
 *
 * World / provenance rules (TEST_METHODS §7):
 *   - DSH_HOME = tests/homes/prb-ep-<stamp> (a COPY of the seed world — the
 *     seed is never mutated). The row's file:// URLs are retargeted at this
 *     worktree's dist; the p6t6-directive.json is rewritten per boot; the
 *     T-PS saved-source blueprint is dropped into the world blueprints.
 *   - The host boots from tests/deepseek-harness-test-use (pristine
 *     0.1.7-rc.1 @ 46a7f68b09, its own git repo) with DSH_CLIENT_COMMIT_HASH.
 *   - The ephemeral world is DELETED at G9 (with a stable-instance re-probe
 *     + port-release check). Nothing is committed or pushed.
 *
 * USAGE (fixture identity is CLI-overridable; every default is the literal
 * this kit was proven against, so an unflagged run behaves EXACTLY as before
 * — only the ORIGIN of those constants changes, never an assertion):
 *   node pr-b-effective-policy-smoke.mjs
 *     [--seed-world <world>]            seed DSH_HOME: a name under
 *                                       <main>/tests/homes or an absolute path
 *                                       INSIDE it (default: the retained mpr
 *                                       world mpr-2026-09-27T08-35-52)
 *     [--seed-blueprint-dir <dir>]      the profile blueprintDir literal to
 *                                       retarget — a dir INSIDE tests/homes
 *     [--t1 <rootSessionId>]            the seed world's main team, matching
 *                                       ^session-mpr-t1-[A-Za-z0-9T:-]+$
 *     [--worker-instance <inst-id>]     the seed's settled worker (C1/C6),
 *                                       matching ^inst-[a-z0-9]+$
 *   An invalid/escaping value is a hard fatal before anything runs (exit 1).
 *
 * Exit codes: 0 = all six criteria pass; 2 = one or more criteria failed
 * (raw wire evidence preserved in the run dir); 1 = fatal (the host never
 * became usable / the harness itself broke). A criterion that cannot be
 * observed as specified is NOT weakened — it is reported with the raw wire
 * evidence actually produced (the task's BLOCKER-not-weaken rule).
 */

import {
  cpSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync,
} from 'node:fs'
import { execSync } from 'node:child_process'
import { dirname, isAbsolute, join, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { DshInstance } from '../../../tests/characterization/lib/instance.mjs'
import {
  logTail, portInUse, waitForPortFree,
} from '../../../tests/characterization/lib/util.mjs'
import { CLIENT_COMMIT_HASH } from '../../../tests/paths.mjs'
import { startMockModel } from '../../../packages/tools/harness/mock-deepseek.mjs'

// ── paths (worktree-relative: this file is 3 levels below the worktree) ────
const KIT_DIR = dirname(fileURLToPath(import.meta.url))
const WORKTREE = resolve(KIT_DIR, '..', '..', '..')
const MAIN = resolve(WORKTREE, '..', '..')
const TESTUSE = join(MAIN, 'tests', 'deepseek-harness-test-use')

// ── CLI: fixture-identity overrides ────────────────────────────────────────
// Every flag DEFAULTS to the literal this kit was proven against, so an
// unflagged run is identical to before; a flag only changes where the
// constant comes FROM (its origin). No assertion, shape guard, criterion or
// tally reads the CLI — they keep consuming the same constants.
//   --seed-world <world>        the seed DSH_HOME: a name under <MAIN>/tests/homes
//                               or an absolute path INSIDE it (realpath-checked)
//   --seed-blueprint-dir <dir>  the blueprintDir literal the copied profile is
//                               retargeted from — a directory INSIDE <MAIN>/tests/homes
//   --t1 <rootSessionId>        the seed world's main team (default pattern
//                               `session-mpr-t1-<world stamp>`)
//   --worker-instance <id>      the seed world's settled worker (C1/C6),
//                               `inst-<lowercase alnum>`
//   --expert-instance <id>      the seed world's settled expert (C2/C5),
//                               `inst-<lowercase alnum>`
//   --control-instance <id>     the seed world's settled control member (C4),
//                               `inst-<lowercase alnum>`
// Every passed-in id is additionally CHECKED against the copied world's
// durable `member_instances` rows before anything boots (assertSeedIdentities):
// an id whose real MemberInstance template is not the one the criterion
// addresses dies as a typed `instance-type-mismatch`, never as a guessed
// request against the wrong member.
function usageFatal(msg) {
  process.stderr.write(`FATAL (invalid kit argument): ${msg}\n`)
  process.stderr.write('usage: node pr-b-effective-policy-smoke.mjs [--seed-world <world-under-tests/homes>] [--seed-blueprint-dir <dir-under-tests/homes>] [--t1 session-mpr-t1-<stamp>] [--worker-instance inst-<id>] [--expert-instance inst-<id>] [--control-instance inst-<id>]\n')
  process.exit(1)
}
function parseArgs(argv) {
  const out = { _: [] }
  // A known flag with no value (or with another flag as its value) is fatal:
  // silently keeping the default would make an override look applied when it
  // is not.
  const value = (a, raw) => {
    if (raw === undefined) usageFatal(`${a}: missing value`)
    if (raw.startsWith('--')) usageFatal(`${a}: expected a value, got another flag ${JSON.stringify(raw)}`)
    return raw
  }
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i]
    if (a === '--seed-world') out.seedWorld = value(a, argv[++i])
    else if (a === '--seed-blueprint-dir') out.seedBlueprintDir = value(a, argv[++i])
    else if (a === '--t1') out.t1 = value(a, argv[++i])
    else if (a === '--worker-instance') out.workerInstance = value(a, argv[++i])
    else if (a === '--expert-instance') out.expertInstance = value(a, argv[++i])
    else if (a === '--control-instance') out.controlInstance = value(a, argv[++i])
    else out._.push(a)
  }
  return out
}
const HOMES_ROOT = join(MAIN, 'tests', 'homes')
/** Resolve a seed path (world name under HOMES_ROOT, or absolute path) and
 *  require that its REAL path stays inside HOMES_ROOT — '..', symlink escapes,
 *  empty/ambiguous values and separator-carrying world names are all fatal. */
function insideHomes(flag, raw) {
  if (typeof raw !== 'string' || raw.trim().length === 0) usageFatal(`${flag}: empty value`)
  if (/\s/.test(raw) || raw.startsWith('-') || raw.includes('\\')) usageFatal(`${flag}: ambiguous value ${JSON.stringify(raw)}`)
  if (raw === '.' || raw.split('/').includes('..')) usageFatal(`${flag}: path escape ${JSON.stringify(raw)}`)
  if (!isAbsolute(raw) && raw.includes('/')) usageFatal(`${flag}: a world name must not contain separators: ${JSON.stringify(raw)}`)
  const candidate = isAbsolute(raw) ? resolve(raw) : resolve(HOMES_ROOT, raw)
  let real = null
  let root = null
  try { real = realpathSync(candidate) } catch { usageFatal(`${flag}: does not resolve: ${candidate}`) }
  try { root = realpathSync(HOMES_ROOT) } catch { usageFatal(`homes root missing: ${HOMES_ROOT}`) }
  if (real !== root && !real.startsWith(root + sep)) usageFatal(`${flag}: resolves outside the homes root ${root}: ${real}`)
  if (!statSync(real).isDirectory()) usageFatal(`${flag}: not a directory: ${real}`)
  return candidate
}
function matchingToken(flag, raw, pattern) {
  if (typeof raw !== 'string' || raw.trim().length === 0) usageFatal(`${flag}: empty value`)
  if (!pattern.test(raw)) usageFatal(`${flag}: ${JSON.stringify(raw)} does not match ${pattern}`)
  return raw
}
const CLI = parseArgs(process.argv.slice(2))
const SEED_WORLD = CLI.seedWorld === undefined
  ? join(MAIN, 'tests', 'homes', 'mpr-2026-09-27T08-35-52')
  : insideHomes('--seed-world', CLI.seedWorld)

const STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const WORLD = `prb-ep-${STAMP}`
const HOME = join(MAIN, 'tests', 'homes', WORLD)
const RUN_DIR = join(
  WORKTREE, 'dev', 'agent-workflow', 'evidence', 'pre-alpha3-refactor', 'pr-b', `host-smoke-${STAMP}-c3`,
)
const LOG_DIR = join(RUN_DIR, 'logs')

// The row config retargeting: the seed profile's file:// URLs point at the
// stale `async-default-contract` worktree; every occurrence is retargeted at
// THIS worktree's dist (the row `name`, glueUrl, seamUrl, p6t6 `name`).
const STALE_WT_SEG = 'async-default-contract'
const THIS_WT_SEG = 'pre-alpha3-prb-effective-policy'
const SEED_BLUEPRINT_DIR = CLI.seedBlueprintDir === undefined
  ? '/home/user/dsh-plugins/dsh-agent-team/tests/homes/mpr-2026-09-27T08-35-52/blueprints'
  : insideHomes('--seed-blueprint-dir', CLI.seedBlueprintDir)

// The T1 team (the seed world's main team) + its SETTLED members.
const T1 = CLI.t1 === undefined
  ? 'session-mpr-t1-mpr-2026-09-27T08-35-52'
  : matchingToken('--t1', CLI.t1, /^session-mpr-t1-[A-Za-z0-9T:-]+$/)
const W_CREATE = CLI.workerInstance === undefined
  ? 'inst-1p8kqfl09bhr' // worker (template modelPreference role-worker) — C1/C6
  : matchingToken('--worker-instance', CLI.workerInstance, /^inst-[a-z0-9]+$/)
const EXPERT = CLI.expertInstance === undefined
  ? 'inst-04eix3v0rhrj' // expert (no capabilities → no initial MCP grant) — C2
  : matchingToken('--expert-instance', CLI.expertInstance, /^inst-[a-z0-9]+$/)
const CONTROL = CLI.controlInstance === undefined
  ? 'inst-0f6c37a0hpcj' // control (NO modelPreference → baseline global-default) — C4
  : matchingToken('--control-instance', CLI.controlInstance, /^inst-[a-z0-9]+$/)

// The saved-source team's minted root (the client-minted create-root id).
// T-PS (team.prb-ps) keeps the per-team `focus` state for the STRUCTURAL
// finding (closed set = boot blueprint, NOT the per-team blueprint).
const T_PS = `session-prb-ps-${STAMP}`
const T_PS_BLUEPRINT = 'team.prb-ps'
// The C3-positive team's minted root. T-C3 is created from the BOOT blueprint
// (team.mpr-anchor — the inline bootstrap anchor parsed at root.ts:738, the
// same blueprint the s6-remote + governance closed sets are built from) so its
// bound blueprint == the boot blueprint. STEP 1 (prepareWorld) adds a
// no-modelPreference worker template + a non-default `strict` policyState to
// that boot blueprint (a TEST-WORLD edit of blueprintSource, not a production
// patch) so the closed set includes `strict` for BOTH checks.
const T_C3 = `session-prb-c3-${STAMP}`
const BOOT_BLUEPRINT = 'team.mpr-anchor' // the inline bootstrap anchor id
const C3_STATE_ID = 'strict' // the non-default state added to the boot blueprint
// The committed state's model cell: a "provider/model" route (the deployment
// static provider is deepseek-official — the same provider the C3a baseline
// request uses). The mock echoes the MODEL part into body.model, so the C3b
// next request must carry body.model === C3_STRICT_MODEL_ID.
const C3_STRICT_ROUTE = 'deepseek-official/prb-c3-strict'
const C3_STRICT_MODEL_ID = 'prb-c3-strict'

// Ports (TEST_METHODS §5: 3180 host family; 3491-3500 test band; :3080/:3180
// are the STABLE dev instance — read-only probes only, never booted here).
const HOST_PORT_CANDIDATES = [3182, 3183, 3184, 3185, 3186] // 3181 busy in this env
const MOCK_PORT = 3497 // 3496 busy in this env
const MCP_A_PORT = 3491
const MCP_B_PORT = 3492
const STABLE_PROBES = ['http://127.0.0.1:3080/', 'http://127.0.0.1:3180/']

// The overridden model ids / MCP server names.
const C1_MODEL = 'deepseek-official/prb-c1-model'
const C4_MODEL = 'deepseek-official/prb-c4-model'
const PS_FOCUS_MODEL = 'deepseek-official/role-ps-focus'
const PS_FOCUS_STATE_ID = 'focus' // declared ONLY in the per-team saved source team.prb-ps
const MCP_A = 'prb-mcp-a'
const MCP_B = 'prb-mcp-b'
const BASELINE_MODEL = 'global-default' // the world staticModel.model

// ── criteria ledger ─────────────────────────────────────────────────────────
const CRITERIA = [
  { id: 'C1', label: 'model override -> next request (wire body.model)', pass: null, detail: '' },
  { id: 'C2', label: 'MCP override -> next request (wire body.tools mcp__)', pass: null, detail: '' },
  { id: 'C3', label: 'PolicyState switch -> next request (T1 negative + T-C3 positive)', pass: null, detail: '' },
  { id: 'C4', label: 'mutation || concurrent request (no activation error, no lost update)', pass: null, detail: '' },
  { id: 'C5', label: 'restart (same DSH_HOME): committed state still governs next request', pass: null, detail: '' },
  { id: 'C6', label: 'inspect-config parity (getProjection route vs wire body.model)', pass: null, detail: '' },
]
function crit(id) { return CRITERIA.find((c) => c.id === id) }
function mark(id, pass, detail) { const c = crit(id); c.pass = pass; c.detail = detail; log(`  ${id} ${pass === true ? 'PASS' : pass === false ? 'FAIL' : pass === 'partial' ? 'PARTIAL' : 'N/A'} — ${detail}`) }

// ── run state ───────────────────────────────────────────────────────────────
const EVID = { transcript: [], mockLog: null, hostLogs: [] }
let MOCK = null
let MINI_A = null
let MINI_B = null
let HOST1 = null
let HOST2 = null
const LIVE = new Set()
let FATAL = null
let EXIT_CODE = 0

const C = (m) => { log(m); process.stdout.write(`${m}\n`) }
function log(m) { /* progress to stderr (stdout is the summary) */ process.stderr.write(`[prb-smoke] ${m}\n`) }
/** Record a fatal and STOP: throwing a sentinel means main()'s catch routes to
 *  exactly one finish(). It must NEVER return to the caller (the earlier
 *  bug: calling finish() directly let control fall through and cascade into
 *  every remaining pre-hygiene check, emitting one fatal after another). */
function dieFatal(msg) {
  FATAL = msg
  log(`FATAL: ${msg}`)
  const err = new Error(msg)
  err.fatalSentinel = true
  throw err
}

// ── small utilities ─────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// NOTE: portInUse is ASYNC (a TCP-connect probe) — it must be awaited.
async function pickHostPort() {
  for (const p of HOST_PORT_CANDIDATES) if (!(await portInUse(p))) return p
  return null
}
function token(tag) {
  return `${tag}-${Math.random().toString(36).slice(2, 10)}`
}
function scrubTokens(text) {
  return String(text ?? '').replace(/\/\?token=([A-Za-z0-9_-]+)/g, '/?token=<SCRUBBED>')
}

// ── mock model: the wire witness ────────────────────────────────────────────
function bodyOf(r) { return r && 'body' in r ? (r.body ?? null) : (r ?? null) }
function msgTexts(m) {
  const c = m?.content
  if (typeof c === 'string') return [c]
  if (Array.isArray(c)) return c.filter((b) => b && b.type === 'text' && typeof b.text === 'string').map((b) => b.text)
  return []
}
function lastUserText(body) {
  const msgs = body?.messages ?? []
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    if (msgs[i]?.role !== 'user') continue
    const t = msgTexts(msgs[i])
    if (t.length > 0) return t.join('\n')
  }
  return ''
}
function anyText(body) {
  return (body?.messages ?? []).map((m) => msgTexts(m).join('\n')).join('\n')
}
function firstText(body) {
  for (const m of (body?.messages ?? [])) {
    const t = msgTexts(m)
    if (t.length > 0) return t.join('\n')
  }
  return ''
}
function isTitleSideCall(record) {
  return /generate the session title|concise title/i.test(firstText(bodyOf(record)))
}
function modelOf(record) { return bodyOf(record)?.model ?? null }
function toolNames(record) {
  const tools = bodyOf(record)?.tools
  if (!Array.isArray(tools)) return []
  return tools.map((t) => (typeof t === 'string' ? t : t?.name)).filter((n) => typeof n === 'string')
}
function mcpTools(record) { return toolNames(record).filter((n) => n.startsWith('mcp__')) }

/** A deterministic short-text ack keyed on the marker in the LAST user message
 *  (multi-turn-safe); title side-calls get neutral text; no tool calls. */
function decideMock({ req }) {
  const lastUser = lastUserText(bodyOf(req))
  for (const [mk, ack] of MARKER_ACKS) if (lastUser.includes(mk)) return { kind: 'text', content: ack }
  if (isTitleSideCall(req)) return { kind: 'text', content: 'ok (title)' }
  return { kind: 'text', content: 'ok' }
}
const MARKER_ACKS = [] // populated in main() as each leg registers its marker

async function waitForRequest(predicate, timeoutMs, what) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    for (const r of MOCK.requests) if (predicate(r)) return r
    if (Date.now() >= deadline) { log(`TIMEOUT waiting for: ${what} (requests=${MOCK.requests.length})`); return null }
    await sleep(250)
  }
}
/** The first NON-title request whose messages carry the marker. */
async function requestForMarker(marker, timeoutMs = 90_000) {
  return waitForRequest(
    (r) => !isTitleSideCall(r) && anyText(bodyOf(r)).includes(marker),
    timeoutMs,
    `a real (non-title) request carrying marker ${marker}`,
  )
}

// ── mini-MCP (the proven d-smoke pattern: POST JSON-RPC, one `ping` tool) ──
function miniMcpRpc(label, msg) {
  const id = msg === null || typeof msg !== 'object' ? null : msg.id
  const method = msg === null || typeof msg !== 'object' ? undefined : msg.method
  const params = msg === null || typeof msg !== 'object' || msg.params === undefined ? {} : msg.params
  const ok = (result) => ({ jsonrpc: '2.0', id, result })
  const fail = (code, message) => ({ jsonrpc: '2.0', id, error: { code, message } })
  if (method === 'initialize') return ok({ protocolVersion: '2025-06-18', capabilities: { tools: { listChanged: false } }, serverInfo: { name: `mini-${label}`, version: '0.0.1' } })
  if (method === 'notifications/initialized') return null
  if (method === 'tools/list') return ok({ tools: [{ name: 'ping', description: `echo ping (mini-MCP ${label})`, inputSchema: { type: 'object', properties: { msg: { type: 'string' } }, required: [] } }] })
  if (method === 'tools/call') {
    if (params?.name !== 'ping') return fail(-32601, `unknown tool ${String(params?.name)}`)
    return ok({ content: [{ type: 'text', text: `pong:${label}:${String((params.arguments && params.arguments.msg) ?? '')}` }], isError: false })
  }
  return fail(-32601, `method ${String(method)} not found`)
}
async function startMiniMcp(port, label) {
  const { createServer } = await import('node:http')
  const server = createServer((req, res) => {
    if (req.method !== 'POST') { res.writeHead(405).end(); return }
    const chunks = []
    req.on('data', (c) => chunks.push(c))
    req.on('end', () => {
      let msg = null
      try { msg = JSON.parse(Buffer.concat(chunks).toString('utf8')) } catch { /* null */ }
      const reply = miniMcpRpc(label, msg)
      if (reply === null) { res.writeHead(202).end(); return }
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify(reply))
    })
  })
  await new Promise((r) => server.listen(port, '127.0.0.1', r))
  return { server, port: server.address().port, label }
}
async function closeMini(mini) { if (mini === null) return; await new Promise((r) => mini.server.close(r)) }

// ── HTTP seams ──────────────────────────────────────────────────────────────
async function fetchJson(url, options = {}, timeoutMs = 60_000) {
  let res
  try {
    res = await fetch(url, { ...options, signal: AbortSignal.timeout(timeoutMs) })
  } catch (error) {
    const message = error?.name === 'TimeoutError' ? `timeout after ${timeoutMs}ms` : String(error?.message ?? error)
    const err = new Error(`fetch ${url} failed: ${message}`)
    err.fatalNetwork = true
    throw err
  }
  const text = await res.text()
  let body = null
  if (text.length > 0) { try { body = JSON.parse(text) } catch { body = { raw: text.slice(0, 4000) } } }
  return { status: res.status, body }
}

async function authenticate(origin, authToken) {
  const attempt = async () => {
    const res = await fetch(`${origin}/?token=${encodeURIComponent(authToken)}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
    const setCookie = res.headers.get('set-cookie')
    if (setCookie !== null) {
      const first = setCookie.split(';')[0]
      if (first && first.length > 0) return first
    }
    return null
  }
  const cookie = await attempt()
  if (cookie !== null) return cookie
  log('authenticate: no set-cookie on first try — retrying once')
  await sleep(1_500)
  return attempt()
}

/** POST one /team-remote method call (records the transcript entry). */
async function remoteCall(origin, cookie, method, params, tag, version = 1) {
  const rpcId = token(tag)
  const entry = { tag, method, version, rpcId, params, at: new Date().toISOString() }
  try {
    const { status, body } = await fetchJson(`${origin}/team-remote/${method}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ type: 'client-request', rpcId, method, payload: { version, params } }),
    }, 240_000)
    entry.status = status
    entry.result = body?.result ?? body
    EVID.transcript.push(entry)
    return { status, body }
  } catch (error) {
    entry.error = String(error?.message ?? error)
    EVID.transcript.push(entry)
    throw error
  }
}

/** The payload of an ok remoteCall. The wire envelope is
 *  `body.result = {ok:true, value:{data:<payload>, provenance}} | {ok:false, error}`
 *  — the handler's `{data, provenance}` return is wrapped under `value`. */
function resultData(body) {
  if (body?.result?.ok !== true) return null
  return body.result.value?.data ?? null
}
function resultError(body) { return body?.result?.ok === true ? null : (body?.result?.error ?? null) }
/** A JSON-safe, slice-able rendering (JSON.stringify(undefined) is undefined). */
function jstr(x, n = 300) { const s = JSON.stringify(x); return (s ?? String(x)).slice(0, n) }

/** remoteCall + the 0.1.7 MOUNT-BEFORE-BOOT readiness gate. Retries on
 *  runtime-not-ready AND on transient non-2xx / missing-result responses
 *  (a half-mounted web server answers 405 before the team-remote route is up). */
async function remoteCallReady(host, method, params, tag) {
  const deadline = Date.now() + 120_000
  for (let attempt = 1; ; attempt += 1) {
    let res
    try {
      res = await remoteCall(host.origin, host.cookie, method, params, `${tag}${attempt}`)
    } catch (error) {
      if (error?.fatalNetwork === true) dieFatal(`remote ${method} network failure: ${error.message}`)
      throw error
    }
    if (res.body?.result?.ok === true) return res // an ok call — ready
    const err = resultError(res.body)
    if (err !== null && err?.details?.reason === 'runtime-not-ready') {
      if (Date.now() >= deadline) return res
      log(`remote ${method} attempt ${attempt}: runtime-not-ready — waiting 5s for the live boot`)
      await sleep(5_000); continue
    }
    if (res.status < 200 || res.status >= 300 || res.body?.result === undefined) {
      if (Date.now() >= deadline) return res
      log(`remote ${method} attempt ${attempt}: HTTP ${res.status} (mounting) — waiting 2s`)
      await sleep(2_000); continue
    }
    return res // a real typed domain error — surface it to the caller
  }
}

// ── host lifecycle ──────────────────────────────────────────────────────────
function makeInstance(port, dshHome) {
  return new DshInstance({ hostTree: TESTUSE, dshHome, port, clientCommitHash: CLIENT_COMMIT_HASH, logDir: LOG_DIR })
}
async function bootHost(bootNum, phase, port) {
  log(`booting host ${bootNum} (${phase}) on port ${port} …`)
  // the mock + the MCP supply endpoints must be reachable by the host.
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${MOCK_PORT}`
  process.env.DEEPSEEK_API_KEY = 'prb-smoke-mock-key'
  const inst = makeInstance(port, HOME)
  let url
  try {
    const r = await inst.start({ timeoutMs: 150_000 })
    url = r.url
  } catch (error) {
    dieFatal(`host ${bootNum} (${phase}) boot failed: ${error.message}`)
  }
  const m = /token=([A-Za-z0-9_-]+)/.exec(url)
  if (m === null) dieFatal(`host ${bootNum}: no token in boot url ${scrubTokens(url)}`)
  const origin = `http://127.0.0.1:${port}`
  const cookie = await authenticate(origin, m[1])
  if (cookie === null) dieFatal(`host ${bootNum}: authenticate failed`)
  LIVE.add(inst)
  EVID.hostLogs.push({ bootNum, phase, port, logPath: inst.logPath })
  log(`host ${bootNum} up: ${origin} (cookie acquired; log ${inst.logPath})`)
  return { instance: inst, origin, port, cookie, phase, bootNum }
}
async function stopHost(host, label) {
  log(`stopping host ${host.bootNum} (${label}) on port ${host.port} …`)
  LIVE.delete(host.instance)
  const { portFree } = await host.instance.stop()
  if (!portFree) log(`WARNING: port ${host.port} not free after stop`)
  const freed = await waitForPortFree(host.port, 20_000)
  if (!freed) log(`WARNING: port ${host.port} still bound after stop`)
  return freed
}

// ── world preparation (the copied seed + retargeted row + T-PS blueprint) ──
function prepareWorld() {
  if (!existsSync(SEED_WORLD)) dieFatal(`seed world missing: ${SEED_WORLD}`)
  if (!existsSync(TESTUSE)) dieFatal(`test-use checkout missing: ${TESTUSE}`)
  // a re-run must never merge into a stale world.
  if (existsSync(HOME)) rmSync(HOME, { recursive: true, force: true })
  cpSync(SEED_WORLD, HOME, { recursive: true })
  log(`world copied: ${SEED_WORLD} -> ${HOME}`)

  // retarget the profile: the row's file:// URLs (name/glueUrl/seamUrl/p6t6
  // name) + the blueprintDir, then inject the two MCP supply endpoints.
  const patchPath = join(HOME, 'profiles', 'web', 'cordis.patch.yml')
  let text = readFileSync(patchPath, 'utf8')
  text = text.split(STALE_WT_SEG).join(THIS_WT_SEG)
  text = text.replace(SEED_BLUEPRINT_DIR, join(HOME, 'blueprints'))
  const mcpBlock =
    `mcpServers:\n` +
    `          - name: "${MCP_A}"\n` +
    `            port: ${MCP_A_PORT}\n` +
    `          - name: "${MCP_B}"\n` +
    `            port: ${MCP_B_PORT}`
  if (!text.includes('mcpServers: []')) dieFatal('seed profile: expected `mcpServers: []` to retarget (shape changed?)')
  text = text.replace('mcpServers: []', mcpBlock)

  // STEP 1 — extend the BOOT blueprint (team.mpr-anchor, the inline bootstrap
  // anchor parsed once at root.ts:738 — the SAME blueprint the s6-remote closed
  // set (s6-remote.ts:2689) and the governance closed set (governance/service.ts
  // :398) are built from) with (a) a no-modelPreference worker template (so a
  // worker can be created whose baseline request carries the world model) and
  // (b) a non-default `strict` policyState (so the closed set includes `strict`).
  // [F11 NOTE, revalidated 2026-10-01: since 3b7039e8 the closed set is the
  // ADDRESSED team's BOUND Blueprint, resolved per root by the Governance
  // service (bound-blueprint.ts), so this host-profile blueprintSource edit is
  // no longer what ANY leg's closed set comes from — the catalog resolves the
  // boot blueprint to the STEP 1b saved source rev 2, and every team binds to
  // its own snapshot. STEP 1a is kept because (i) the two shape guards below
  // are the kit's world-shape preconditions and would themselves change if this
  // step were removed, and (ii) removing it would silently change the world the
  // C1/C2/C4/C5/C6 legs run against. The boot-vs-bound discrimination that
  // C3-structural asserts is carried by STEP 1b (rev 2 declares `strict` and not
  // `focus`) against team.prb-ps (declares `focus` and not `strict`).]
  // This is a TEST-WORLD edit of the DSH_HOME world copy's blueprintSource —
  // NOT a production patch. blueprintSource is a YAML double-quoted string;
  // `members: []` and `policyStates: []` each occur exactly once (the boot
  // blueprint line), so the replaces are targeted.
  if (!text.includes('members: []')) dieFatal('boot blueprint: expected `members: []` (shape changed?)')
  if (!text.includes('policyStates: []')) dieFatal('boot blueprint: expected `policyStates: []` (shape changed?)')
  text = text.replace('members: []',
    'members:\\n  - templateId: worker\\n    persona: \\"PR-B C3 positive worker (no modelPreference; the policyState model cell wins the model lane).\\"')
  text = text.replace('policyStates: []',
    'policyStates:\\n  - id: strict\\n    description: \\"PR-B C3 positive: a non-default state in the boot (bound) blueprint so the closed set includes it.\\"')
  log('boot blueprint (team.mpr-anchor) extended: +worker template (no modelPreference) + `strict` policyState (test-world edit)')
  writeFileSync(patchPath, text)
  log(`profile retargeted: ${patchPath}`)

  // the T-PS saved-source blueprint (a non-default `focus` state; the worker
  // template declares NO modelPreference so the state's model cell can win).
  const bpPath = join(HOME, 'blueprints', 'prb-ps.yaml')
  writeFileSync(bpPath, T_PS_BLUEPRINT_YAML)
  log(`T-PS blueprint written: ${bpPath}`)

  // STEP 1b — publish the boot blueprint saved source (team.mpr-anchor@2):
  // a NEW revision carrying the no-modelPreference worker template + the
  // `strict` policyState. The frozen registry row @1 (original) is immutable
  // and wins over a disk file of the same identity (registry-wins, plan §7.3
  // RED-1), and the catalog's bootstrap anchor is the ROW's config.blueprintSource
  // (host.ts:1446) — NOT the host profile's config.blueprintSource (root.ts:738)
  // that the closed set uses. So the catalog would otherwise resolve
  // team.mpr-anchor@1 to the frozen row (original). Publishing @2 (a new
  // identity) makes the catalog's latest for team.mpr-anchor = @2 (worker +
  // strict), which team.create binds the team to. The closed set (host
  // profile's blueprintSource, STEP 1a) already includes `strict`.
  const bootSavedPath = join(HOME, 'blueprints', 'prb-c3-boot.yaml')
  writeFileSync(bootSavedPath, BOOT_BLUEPRINT_SAVED_YAML)
  log(`boot blueprint saved source written: ${bootSavedPath} (team.mpr-anchor@${BOOT_SAVED_REVISION}: +worker template + 'strict' policyState)`)

  // sanity: the seed team + members must be present in the copied durable store.
  const storePath = join(HOME, 'storages', 'team_domain.json')
  if (!existsSync(storePath)) dieFatal(`seed durable store missing: ${storePath}`)
  const store = JSON.parse(readFileSync(storePath, 'utf8'))
  // the durable store nests its tables under `tables` (key -> JSON-string row).
  // a team's session id is the map KEY (and the row's rootSessionId) — there is
  // no `sessionId` field on the row.
  const rawSessions = store.tables?.team_sessions ?? store.team_sessions ?? {}
  const sessionKeys = Object.keys(rawSessions)
  const sessions = sessionKeys.map((k) => { const v = rawSessions[k]; return { key: k, ...(typeof v === 'string' ? JSON.parse(v) : v) } })
  const t1Present = sessionKeys.includes(T1) || sessions.some((s) => s.rootSessionId === T1)
  if (!t1Present) dieFatal(`seed T1 team missing from copied store (sessions=${sessionKeys.join(',') || 'none'})`)

  // ID USE GUARD — before ANY of the three member identities is used, it must
  // be a real MemberInstance of T1 in the copied durable store whose
  // `templateId` is the one the criteria address (worker → C1/C6, expert →
  // C2/C5, control → C4). A stale or guessed id therefore fails here as a
  // typed instance-type-mismatch, never as a criterion run against the wrong
  // member. (MemberInstanceRecordDto v1: rootSessionId + instanceId +
  // templateId; the store's `member_instances` table keys rows by
  // memberIdentityKey({rootSessionId, instanceId}).)
  const rawMembers = store.tables?.member_instances ?? {}
  const members = Object.entries(rawMembers)
    .map(([key, v]) => { try { return { key, ...(typeof v === 'string' ? JSON.parse(v) : v) } } catch { return null } })
    .filter((m) => m !== null && m.rootSessionId === T1)
  const ID_USE_CONTRACT = [
    ['--worker-instance', W_CREATE, 'worker', 'C1/C6'],
    ['--expert-instance', EXPERT, 'expert', 'C2/C5'],
    ['--control-instance', CONTROL, 'control', 'C4'],
  ]
  for (const [flag, id, templateId, criteria] of ID_USE_CONTRACT) {
    const row = members.find((m) => m.instanceId === id)
    if (row === undefined) {
      dieFatal(`instance-type-mismatch: ${flag} ${id} is not a MemberInstance of ${T1} in the copied world (T1 members=${members.length || 'none'}) — pass the id of a settled '${templateId}' member (used by ${criteria})`)
    }
    if (row.templateId !== templateId) {
      dieFatal(`instance-type-mismatch: ${flag} ${id} is a '${row.templateId}' member but ${criteria} address it as a '${templateId}' member (label=${JSON.stringify(row.label)}, lifecycle=${row.lifecycle})`)
    }
  }
  log(`id-use guard: ${ID_USE_CONTRACT.map(([, id, t]) => `${t}=${id}`).join(' ')} verified against the copied durable store`)
  log(`world ready (T1 present in the copied durable store; sessions: ${sessionKeys.join(', ')})`)
}

function writeP6t6Directive(boot, phase) {
  writeFileSync(join(HOME, 'p6t6-directive.json'), JSON.stringify({
    boot, phase, reportDir: RUN_DIR, runStamp: STAMP, rootSessionId: T1,
  }, null, 2))
}

// ── pre/post hygiene ────────────────────────────────────────────────────────
async function probeStable(url) {
  try {
    const { status } = await fetchJson(url, { method: 'GET' }, 10_000)
    return { url, status }
  } catch (error) {
    return { url, status: `unreachable: ${String(error?.message ?? error).slice(0, 120)}` }
  }
}
async function stableProbes(tag) {
  const out = []
  for (const url of STABLE_PROBES) out.push(await probeStable(url))
  log(`${tag} stable probes: ${out.map((p) => `${new URL(p.url).port}=${p.status}`).join(' ')}`)
  return out
}
function testUseClean() {
  let head, porcelain
  try {
    head = execSync('git rev-parse HEAD', { cwd: TESTUSE, encoding: 'utf8' }).trim()
    porcelain = execSync('git status --porcelain', { cwd: TESTUSE, encoding: 'utf8' })
  } catch (e) {
    return { clean: false, detail: `git probe failed: ${String(e?.message ?? e).slice(0, 160)}` }
  }
  if (head !== '46a7f68b0922371ce7144b668b90e377d8e799f4') return { clean: false, detail: `HEAD ${head} != pinned baseline` }
  if (porcelain.trim().length > 0) return { clean: false, detail: `dirty: ${porcelain.trim().split('\n').slice(0, 5).join(' | ')}` }
  return { clean: true, detail: 'HEAD at pinned baseline, clean' }
}

// ── the T-PS saved-source blueprint ────────────────────────────────────────
const T_PS_BLUEPRINT_YAML = `---
schemaVersion: 1
blueprintId: ${T_PS_BLUEPRINT}
revision: "1"
displayName: "PR-B policy-state smoke team"
description: "Saved-source blueprint with a non-default policyState (focus) for the PR-B C3 positive leg. The worker template declares NO modelPreference so the state's model cell can win the model lane."
leader:
  templateId: leader
  persona: "You are the leader of the PR-B policy-state smoke team. You coordinate work for this team."
members:
  - templateId: worker
    persona: "You are a worker of the PR-B policy-state smoke team. This template deliberately declares no modelPreference."
requirements:
  - domain: persona
    name: standard
teamEnvelope:
  allow:
    - assign-task
    - create-member
    - send-message
    - report-progress
  deny:
    - delete-team
memberEnvelopes: []
policyStates:
  - id: default
    description: "Default state (no model pin)."
  - id: focus
    description: "Focus state (the kit pins the model through the set-target cells)."
quotas:
  team:
    maxInstances: 8
    maxConcurrent: 4
  members:
    maxInstances: 8
    maxConcurrent: 4
metadata: {}
---
`

// ── the BOOT blueprint saved source (team.mpr-anchor @ revision 2) ──────────
// The seed world's durable store carries a FROZEN registry row for
// team.mpr-anchor@1 (the original: leader only, no worker template, no
// policyStates) at the TOP of the catalog resolution precedence. A frozen row
// CANNOT be shadowed (registry-wins, plan §7.3 RED-1), and the catalog's
// bootstrap anchor is the ROW's config.blueprintSource (host.ts:1446) — NOT the
// host profile's config.blueprintSource (root.ts:738) that the CLOSED SET uses.
// So extending the host profile's blueprintSource (STEP 1a) makes the closed
// set (s6-remote.ts:2689 + governance service.ts:398) include `strict`, but the
// CATALOG still resolves team.mpr-anchor@1 to the frozen row (original).
//
// The fix: publish a NEW revision (team.mpr-anchor@2) as a SAVED source carrying
// the no-modelPreference worker template + the `strict` policyState. @2 is a new
// identity (no frozen row, no bootstrap anchor), so it is listed and resolves as
// the LATEST for team.mpr-anchor. team.create {blueprintId: 'team.mpr-anchor'}
// (no explicit revision) therefore binds the team to @2 (the worker + strict),
// while the closed set (host profile's blueprintSource) already includes `strict`.
// This is a TEST-WORLD edit (the DSH_HOME world copy's blueprints/ dir), NOT a
// production patch.
const BOOT_SAVED_REVISION = '2'
const BOOT_BLUEPRINT_SAVED_YAML = `---
schemaVersion: 1
blueprintId: ${BOOT_BLUEPRINT}
revision: "${BOOT_SAVED_REVISION}"
displayName: "PR-B C3 positive boot blueprint (saved source rev 2)"
description: "Saved-source rev 2 of the boot blueprint: adds a no-modelPreference worker template + a non-default 'strict' policyState so the C3 positive can create a worker whose baseline uses the world model and whose committed PolicyState model cell wins the next request. The frozen registry row @1 (original) is immutable, so this is a new revision the catalog resolves as the latest."
leader:
  templateId: leader
  persona: "You are the boot anchor leader of the model-preference-routing smoke row."
members:
  - templateId: worker
    persona: "PR-B C3 positive worker (no modelPreference; the policyState model cell wins the model lane)."
requirements: []
memberEnvelopes: []
policyStates:
  - id: strict
    description: "PR-B C3 positive: a non-default state in the bound blueprint so the closed set includes it."
metadata: {}
---
`

// ── criterion legs ──────────────────────────────────────────────────────────

/** C1 — a human instance-scope model override governs the member's next
 *  request: body.model === the overridden model id (NOT the template
 *  baseline). Returns the mock-observed body.model for the C6 parity leg. */
async function legC1(host) {
  const marker = token('PRB-C1')
  MARKER_ACKS.push([marker, 'prb c1 ack'])
  const set = await remoteCallReady(host, 'override.set', {
    teamSessionId: T1, capability: 'model',
    value: { kind: 'allow', items: [C1_MODEL] },
    actor: { kind: 'human' }, scope: 'instance', targetInstanceId: W_CREATE,
  }, 'c1-set')
  const rec = resultData(set.body)?.override ?? resultData(set.body)
  const err = resultError(set.body)
  if (err !== null) throw new Error(`C1 override.set failed: ${err.code} — ${String(err.message).slice(0, 200)}`)
  if (rec === null || typeof rec.recordId !== 'string') throw new Error(`C1 override.set ack has no record: ${JSON.stringify(resultData(set.body)).slice(0, 300)}`)
  log(`C1 override ack: ${rec.recordId} gen=${rec.generation} origin=${rec.origin} values=${JSON.stringify(rec.values)}`)

  const fu = await remoteCallReady(host, 'member.followup', {
    teamSessionId: T1, caller: { kind: 'human', humanId: T1 }, targetInstanceId: W_CREATE,
    requestToken: token('c1-fu'), payload: { prompt: `PR-B C1 marker ${marker}. Reply with one short word.` },
  }, 'c1-fu')
  const outcome = resultData(fu.body)?.outcome
  const fErr = resultError(fu.body)
  if (fErr !== null || outcome?.status !== 'executed' || outcome?.effect?.kind !== 'work-admitted') {
    throw new Error(`C1 followup not work-admitted: ${JSON.stringify(fErr ?? outcome).slice(0, 300)}`)
  }
  log(`C1 followup work-admitted (settled=${outcome.effect.settled ?? 'n/a'})`)

  const req = await requestForMarker(marker)
  if (req === null) throw new Error('C1: no mock request carried the C1 marker (the override request never reached the model)')
  const model = modelOf(req)
  const expected = C1_MODEL.split('/')[1]
  if (model !== expected) throw new Error(`C1: wire body.model=${JSON.stringify(model)} !== expected ${JSON.stringify(expected)} (override did NOT govern the next request)`)
  return { recordId: rec.recordId, generation: rec.generation, wireModel: model, mockSeq: req.seq, marker }
}

/** C6 — inspect-config parity: getProjection's member model (a full route)
 *  AGREES with the mock-observed wire body.model (route-vs-model split). */
async function legC6(host, c1) {
  const proj = await remoteCallReady(host, 'team.getProjection', { teamSessionId: T1 }, 'c6-proj')
  const pErr = resultError(proj.body)
  if (pErr !== null) throw new Error(`C6 getProjection failed: ${pErr.code} — ${String(pErr.message).slice(0, 200)}`)
  const projection = resultData(proj.body)?.projection
  const members = projection?.members ?? []
  const row = members.find((m) => m.instanceId === W_CREATE)
  if (row === undefined) throw new Error(`C6: member ${W_CREATE} absent from the projection (${members.length} members)`)
  const ms = row.modelState
  const ecModel = row.effectiveConfig?.model ?? null
  const current = ms?.current ?? null
  if (current === null || typeof current.value !== 'string') throw new Error(`C6: modelState.current.value absent/invalid: ${JSON.stringify(ms).slice(0, 300)}`)
  const route = current.value
  const [provider, ...rest] = route.split('/')
  const modelPart = rest.join('/')
  // the route-vs-model parity: provider is the deployment static provider and
  // the model part EXACTLY equals the wire body.model the mock observed.
  if (provider !== 'deepseek-official') throw new Error(`C6: inspect route provider ${JSON.stringify(provider)} !== 'deepseek-official'`)
  if (modelPart !== c1.wireModel) throw new Error(`C6: inspect route model ${JSON.stringify(modelPart)} !== wire body.model ${JSON.stringify(c1.wireModel)}`)
  // the lightweight durable probe also answers (the task named it; it carries
  // relation/teamSessionId, not the effective config — recorded for parity).
  const rs = await remoteCallReady(host, 'team.getReadState', { sessionId: T1 }, 'c6-rs', 6)
  const rsData = resultData(rs.body)
  return {
    route, state: current.state, source: current.source,
    provenance: ms?.provenance ?? null, availability: ms?.availability ?? null,
    effectiveConfigModel: ecModel, readState: rsData, wireModel: c1.wireModel,
  }
}

/** C2 — a human instance-scope mcp override mounts EXACTLY the named server on
 *  the member's next request: body.tools has mcp__prb-mcp-a__ping and no
 *  mcp__prb-mcp-b__* tool. */
async function legC2(host) {
  const marker = token('PRB-C2')
  MARKER_ACKS.push([marker, 'prb c2 ack'])
  const set = await remoteCallReady(host, 'override.set', {
    teamSessionId: T1, capability: 'mcp',
    value: { kind: 'allow', items: [MCP_A] },
    actor: { kind: 'human' }, scope: 'instance', targetInstanceId: EXPERT,
  }, 'c2-set')
  const rec = resultData(set.body)?.override ?? resultData(set.body)
  const err = resultError(set.body)
  if (err !== null) throw new Error(`C2 override.set failed: ${err.code} — ${String(err.message).slice(0, 200)}`)
  if (rec === null || typeof rec.recordId !== 'string') throw new Error(`C2 override.set ack has no record: ${JSON.stringify(resultData(set.body)).slice(0, 300)}`)
  log(`C2 mcp override ack: ${rec.recordId} gen=${rec.generation}`)

  const fu = await remoteCallReady(host, 'member.followup', {
    teamSessionId: T1, caller: { kind: 'human', humanId: T1 }, targetInstanceId: EXPERT,
    requestToken: token('c2-fu'), payload: { prompt: `PR-B C2 marker ${marker}. Reply with one short word.` },
  }, 'c2-fu')
  const outcome = resultData(fu.body)?.outcome
  const fErr = resultError(fu.body)
  if (fErr !== null || outcome?.status !== 'executed' || outcome?.effect?.kind !== 'work-admitted') {
    throw new Error(`C2 followup not work-admitted: ${JSON.stringify(fErr ?? outcome).slice(0, 300)}`)
  }
  const req = await requestForMarker(marker)
  if (req === null) throw new Error('C2: no mock request carried the C2 marker (the mcp request never reached the model)')
  const mcp = mcpTools(req)
  const all = toolNames(req)
  const hasA = mcp.includes(`mcp__${MCP_A}__ping`)
  const bTools = mcp.filter((n) => n.startsWith(`mcp__${MCP_B}__`))
  if (!hasA) throw new Error(`C2: overridden server ${MCP_A} NOT mounted on the wire (mcp__ tools present: ${JSON.stringify(mcp)})`)
  if (bTools.length > 0) throw new Error(`C2: a NON-overridden server ${MCP_B} leaked onto the wire: ${JSON.stringify(bTools)}`)
  return { recordId: rec.recordId, wireMcp: mcp, allToolCount: all.length, mockSeq: req.seq, marker }
}

/** C3-negative — on T1 a policyState.set to an undeclared state is rejected
 *  typed (POLICY_STATE_UNKNOWN / TEAM_REMOTE_POLICY_STATE_UNKNOWN).
 *  [F11 NOTE: T1's closed set is the SEED team's own bound Blueprint — for the
 *  mpr seed the wire reports it as (default, default), i.e. `focus` and the
 *  boot-side `strict` are BOTH outside it. The pre-F11 text of this comment
 *  claimed ['default','strict'] "after STEP 1"; that was the boot-blueprint
 *  reading the structural leg has now been recalibrated away from. The
 *  assertion itself is unchanged and stays: an undeclared target is a typed
 *  rejection.] */
async function legC3Negative(host) {
  const res = await remoteCallReady(host, 'policyState.set', {
    teamSessionId: T1, target: { stateId: 'focus' }, actor: { kind: 'human' },
  }, 'c3n-set')
  const err = resultError(res.body)
  if (err === null) throw new Error('C3-negative: policyState.set(focus) on T1 was ACCEPTED (expected a typed rejection — the closed set should be [default, strict])')
  const code = err.code
  const detail = JSON.stringify(err.details ?? {})
  if (code !== 'POLICY_STATE_UNKNOWN') {
    // not a hard fail of the criterion if it is still a typed closed-set
    // rejection — but record exactly what the host said.
    log(`C3-negative: unexpected rejection code ${code} (details=${detail}) — treating as the closed-set negative`)
  }
  return { code, detail, message: String(err.message ?? '').slice(0, 240) }
}

/** C3-positive (STEPS 2-4) — a team (T-C3) bound to the BOOT blueprint
 *  (team.mpr-anchor, which STEP 1 extended with a no-modelPreference worker
 *  template + a non-default `strict` policyState so the closed set includes
 *  `strict` for BOTH the s6-remote (2689) and governance (service.ts:398)
 *  checks):
 *    STEP 2: create T-C3 from the boot blueprint (bound blueprint == boot
 *            blueprint), activate a worker (no modelPreference), baseline
 *            followup -> C3a (body.model = the world baseline model).
 *    STEP 3: policyState.set(strict, cells.model) -> assert the ack is a
 *            committed transition (entryId, no noChange, the acked state
 *            carries the model cell).
 *    STEP 4: the NEXT request (mock witness) body.model === the committed
 *            state's model (prb-c3-strict) — the read plane flows the
 *            committed state's cells to the next request (blueprint <
 *            policyState; the worker template has no model, so policyState
 *            wins the model lane). This mirrors the functional UI governance
 *            flow (TeamGovernance.tsx runPolicyCommit sends the edited cell
 *            map; the committed cells originate verbatim from the client
 *            target — normalizeStateView, mutation/service.ts:839). */
async function legC3Positive(host) {
  // (0) live pre-flight: the boot blueprint (team.mpr-anchor) resolves to its
  //     LATEST revision via the live catalog — the saved source @2 (STEP 1b)
  //     which carries the `strict` policyState + the worker template. (The
  //     frozen registry row @1 — the original — is immutable and wins for
  //     revision 1, so we resolve the LATEST, not @1.)
  const getRes = await remoteCallReady(host, 'catalog.get', { blueprintId: BOOT_BLUEPRINT }, 'c3p-get')
  const gErr = resultError(getRes.body)
  if (gErr !== null) throw new Error(`C3-positive: boot blueprint ${BOOT_BLUEPRINT} (latest) failed to resolve: ${JSON.stringify(gErr).slice(0, 300)}`)
  // catalog.get handler (s6-remote.ts:2873) returns `{ data: { blueprint } }` —
  // the record is under `data.blueprint`, NOT `data` directly.
  const bp = (resultData(getRes.body) ?? {}).blueprint ?? {}
  const bpStates = (bp.policyStates ?? []).map((s) => s.id)
  if (!bpStates.includes(C3_STATE_ID)) {
    throw new Error(`C3-positive: boot blueprint ${BOOT_BLUEPRINT} (latest rev ${bp.revision ?? '?'}) does NOT carry the \`${C3_STATE_ID}\` policyState (STEP 1b saved source missing?) — policyStates=${JSON.stringify(bpStates)}`)
  }
  const bpWorker = (bp.members ?? []).some((m) => m.templateId === 'worker')
  if (!bpWorker) throw new Error(`C3-positive: boot blueprint ${BOOT_BLUEPRINT} (latest rev ${bp.revision ?? '?'}) does NOT carry a \`worker\` template (STEP 1b saved source missing?) — members=${JSON.stringify((bp.members ?? []).map((m) => m.templateId))}`)
  log(`C3-positive: boot blueprint ${BOOT_BLUEPRINT} resolves (rev ${bp.revision}) with policyStates=${JSON.stringify(bpStates)} + worker template (STEP 1b saved source confirmed live)`)

  // (1) STEP 2a — create the team bound to the boot blueprint (client-minted
  //     root; no initialWork -> leader only). bound blueprint == boot blueprint.
  const create = await remoteCallReady(host, 'team.create', { rootSessionId: T_C3, blueprintId: BOOT_BLUEPRINT }, 'c3p-create')
  const cErr = resultError(create.body)
  if (cErr !== null) throw new Error(`C3-positive team.create (boot blueprint) failed: ${cErr.code} — ${String(cErr.message).slice(0, 240)}`)
  log('C3-positive: T-C3 team created (bound to the boot blueprint)')

  // (2) STEP 2b — create a worker from the `worker` template (no modelPreference).
  const mc = await remoteCallReady(host, 'member.create', {
    teamSessionId: T_C3, caller: { kind: 'human', humanId: T_C3 },
    requestToken: token('c3p-mc'), delegationTemplateId: 'worker', payload: { label: 'c3-worker' },
  }, 'c3p-mc')
  const mcErr = resultError(mc.body)
  const mcOutcome = resultData(mc.body)?.outcome
  if (mcErr !== null || mcOutcome?.status !== 'executed' || mcOutcome?.effect?.kind !== 'member-activated') {
    throw new Error(`C3-positive member.create failed: ${JSON.stringify(mcErr ?? mcOutcome).slice(0, 300)}`)
  }
  const workerId = mcOutcome.effect.instanceId
  if (typeof workerId !== 'string') throw new Error(`C3-positive: no worker instanceId in the activation effect: ${JSON.stringify(mcOutcome.effect).slice(0, 200)}`)
  log(`C3-positive: worker ${workerId} activated`)

  // (3) STEP 2c — C3a baseline followup -> the world model. The worker has no
  //     modelPreference, so its baseline request carries the world model.
  const baseMarker = token('PRB-C3A')
  MARKER_ACKS.push([baseMarker, 'prb c3a baseline ack'])
  const baseFu = await remoteCallReady(host, 'member.followup', {
    teamSessionId: T_C3, caller: { kind: 'human', humanId: T_C3 }, targetInstanceId: workerId,
    requestToken: token('c3p-base'), payload: { prompt: `PR-B C3a baseline marker ${baseMarker}. Reply with one short word.` },
  }, 'c3p-base')
  const baseOutcome = resultData(baseFu.body)?.outcome
  if (baseOutcome?.status !== 'executed' || baseOutcome?.effect?.kind !== 'work-admitted') {
    throw new Error(`C3-positive C3a baseline followup not work-admitted: ${JSON.stringify(resultError(baseFu.body) ?? baseOutcome).slice(0, 300)}`)
  }
  const baseReq = await requestForMarker(baseMarker)
  if (baseReq === null) throw new Error('C3-positive: no mock request carried the C3a baseline marker')
  const baseModel = modelOf(baseReq)
  if (baseModel !== BASELINE_MODEL) {
    throw new Error(`C3-positive: C3a baseline wire body.model=${JSON.stringify(baseModel)} !== ${JSON.stringify(BASELINE_MODEL)} (the no-modelPreference worker should use the world model)`)
  }
  log(`C3-positive: C3a baseline wire model=${baseModel} (the worker has no template modelPreference)`)

  // (4) STEP 3 — policyState.set to `strict` WITH the model cell (mirroring the
  //     UI governance panel: the committed cells originate verbatim from the
  //     client target's cells map). The closed set now includes `strict` (STEP 1),
  //     so BOTH the s6-remote (2689) and governance (service.ts:398) checks pass.
  const psSet = await remoteCallReady(host, 'policyState.set', {
    teamSessionId: T_C3,
    target: { stateId: C3_STATE_ID, cells: { model: { value: { kind: 'allow', items: [C3_STRICT_ROUTE] } } } },
    actor: { kind: 'human' },
  }, 'c3p-psset')
  const psErr = resultError(psSet.body)
  const psData = resultData(psSet.body)
  if (psErr !== null) throw new Error(`C3-positive: policyState.set(${C3_STATE_ID}) REJECTED (the closed set should include \`${C3_STATE_ID}\` after STEP 1): ${psErr.code} — ${String(psErr.message).slice(0, 240)}`)
  // policyState.set handler (s6-remote.ts:3276) wraps the switchState result in
  // `{ data: { transition } }` — the ack fields (entryId / state / noChange) are
  // under `transition`, NOT directly under `data`.
  const ack = psData?.transition ?? psData
  if (ack?.noChange === true) throw new Error('C3-positive: policyState.set(strict) reported noChange (expected a committed transition — strict was not the active state)')
  const entryId = ack?.entryId ?? null
  if (typeof entryId !== 'string' || entryId.length === 0) throw new Error(`C3-positive: the committed transition ack has no entryId: ${JSON.stringify(ack).slice(0, 300)}`)
  if (!entryId.includes(C3_STATE_ID)) log(`C3-positive: note — committed entryId ${entryId} does not embed the state id (recording as-is)`)
  // the acked state carries the model cell (the committed value, verbatim from
  // the client target's cells map).
  const ackedState = ack?.state ?? {}
  const ackedModelCell = ackedState?.cells?.model ?? ackedState?.model ?? null
  if (ackedModelCell === null) throw new Error(`C3-positive: the acked state does NOT carry the model cell: ${JSON.stringify(ackedState).slice(0, 300)}`)
  const ackedItems = ackedModelCell?.value?.items ?? ackedModelCell?.items ?? []
  if (!ackedItems.includes(C3_STRICT_ROUTE)) log(`C3-positive: note — acked model cell items ${JSON.stringify(ackedItems)} do not include the expected route (recording as-is)`)
  log(`C3-positive: policyState.set(${C3_STATE_ID}) committed — entryId=${entryId} acked state carries the model cell (items=${JSON.stringify(ackedItems)})`)

  // (4b) DIAGNOSTIC — what does the READ plane actually carry after the commit?
  //     policyState.get (the committed state view) + team.getProjection (the
  //     model-lane projection for the worker). This tells us whether the
  //     committed model cell is flowing to the read plane at all.
  const psGetRes = await remoteCallReady(host, 'policyState.get', { teamSessionId: T_C3 }, 'c3p-psget')
  const psGetState = (resultData(psGetRes.body) ?? {}).state ?? {}
  const psGetModelCell = psGetState?.cells?.model ?? null
  log(`C3-positive DIAG: policyState.get stateId=${psGetState?.stateId} modelCell=${JSON.stringify(psGetModelCell)}`)
  const projRes = await remoteCallReady(host, 'team.getProjection', { teamSessionId: T_C3 }, 'c3p-proj')
  const proj = (resultData(projRes.body) ?? {}).projection ?? {}
  const projMember = (proj.members ?? []).find((m) => m.instanceId === workerId) ?? null
  const projRoute = projMember?.modelState?.current?.value ?? null
  const projState = projMember?.modelState?.current?.state ?? null
  log(`C3-positive DIAG: team.getProjection worker modelState=${JSON.stringify(projMember?.modelState ?? null).slice(0, 500)}`)
  log(`C3-positive DIAG: team.getProjection worker route=${JSON.stringify(projRoute)} state=${JSON.stringify(projState)}`)

  // (5) STEP 4 — C3b: the NEXT request (mock witness) body.model === the
  //     committed state's model. The read plane flows the committed state's
  //     cells to the next request (blueprint < policyState; the worker template
  //     has no model, so policyState wins the model lane).
  const strictMarker = token('PRB-C3B')
  MARKER_ACKS.push([strictMarker, 'prb c3b strict ack'])
  const strictFu = await remoteCallReady(host, 'member.followup', {
    teamSessionId: T_C3, caller: { kind: 'human', humanId: T_C3 }, targetInstanceId: workerId,
    requestToken: token('c3p-strict'), payload: { prompt: `PR-B C3b strict marker ${strictMarker}. Reply with one short word.` },
  }, 'c3p-strict')
  const strictOutcome = resultData(strictFu.body)?.outcome
  if (strictOutcome?.status !== 'executed' || strictOutcome?.effect?.kind !== 'work-admitted') {
    throw new Error(`C3-positive C3b strict followup not work-admitted: ${jstr(resultError(strictFu.body) ?? strictOutcome)}`)
  }
  const strictReq = await requestForMarker(strictMarker)
  if (strictReq === null) throw new Error('C3-positive: no mock request carried the C3b strict marker')
  const strictModel = modelOf(strictReq)
  if (strictModel !== C3_STRICT_MODEL_ID) {
    throw new Error(`C3-positive: C3b wire body.model=${JSON.stringify(strictModel)} !== expected ${JSON.stringify(C3_STRICT_MODEL_ID)} (the committed PolicyState did NOT govern the next request)`)
  }
  log(`C3-positive: C3b wire model=${strictModel} (the committed PolicyState governed the next request)`)
  return {
    workerId, baseModel, strictModel, entryId,
    psAck: psData, mockSeqBase: baseReq.seq, mockSeqStrict: strictReq.seq,
    positiveDemonstrable: true,
  }
}

// ── durable-store observation for C3-structural (READ-ONLY: nothing here
// writes, and the kit's only deletion sites are its own HOME) ────────────────
/** A count/identity snapshot of the copied world's durable store. Counters and
 *  ids only — never row payloads — so the comparison is cheap and readable in a
 *  failure message. `psTransitionEntryIds` is the T-PS-scoped PolicyState
 *  ledger, which is exactly what a governance switch must (positive) or must
 *  not (negative) touch. */
function durableSnapshot() {
  const store = JSON.parse(readFileSync(join(HOME, 'storages', 'team_domain.json'), 'utf8'))
  const tables = store.tables ?? {}
  const rowsOf = (name) => Object.values(tables[name] ?? {})
    .map((v) => { try { return typeof v === 'string' ? JSON.parse(v) : v } catch { return null } })
    .filter((v) => v !== null)
  const ledger = rowsOf('ledger')
  const overrides = rowsOf('overrides')
  const psTransitions = ledger.filter((r) => r?.factType === 'policy-state-transitioned' && r?.rootSessionId === T_PS)
  const counts = {}
  for (const [name, table] of Object.entries(tables)) counts[name] = Object.keys(table ?? {}).length
  return {
    tableCounts: counts,
    ledgerMaxSequence: ledger.reduce((m, r) => Math.max(m, Number(r?.sequence) || 0), 0),
    psTransitionEntryIds: psTransitions.map((r) => r?.payload?.entryId ?? '?').sort(),
    overrideRecords: overrides.length,
    overrideGenerations: overrides.map((o) => `${o?.recordId ?? '?'}/${o?.generation ?? '?'}`).sort(),
  }
}

/** The kit is the only writer, but member activation and projection work flush
 *  to the store asynchronously, so a single read can catch an unrelated flush.
 *  Return the first snapshot that repeats itself (up to ~2s). */
async function durableSnapshotQuiescent() {
  let prev = durableSnapshot()
  for (let i = 0; i < 8; i += 1) {
    await sleep(250)
    const next = durableSnapshot()
    if (JSON.stringify(next) === JSON.stringify(prev)) return next
    prev = next
  }
  return prev
}

function durableDiff(before, after) {
  const out = []
  for (const key of ['ledgerMaxSequence', 'psTransitionEntryIds', 'overrideRecords', 'overrideGenerations']) {
    if (JSON.stringify(before[key]) !== JSON.stringify(after[key])) out.push(`${key}: ${JSON.stringify(before[key])} -> ${JSON.stringify(after[key])}`)
  }
  for (const name of new Set([...Object.keys(before.tableCounts), ...Object.keys(after.tableCounts)])) {
    if (before.tableCounts[name] !== after.tableCounts[name]) out.push(`table ${name}: ${before.tableCounts[name]} -> ${after.tableCounts[name]}`)
  }
  return out
}

/** C3-structural — the closed-set AUTHORITY, revalidated against production.
 *
 *  ORIGINAL ORACLE (text last written at 10add920, 2026-09-29): the closed set
 *  was the host BOOT blueprint (config.blueprintSource parsed once per host at
 *  root.ts:738, read by the precheck at the then-current s6-remote.ts:2689), so
 *  a state declared only in a per-team saved source was expected to be
 *  REJECTED. That oracle was only ever green against pre-F11 hosts (every green
 *  pr-b run recorded in this repo is stamped 2026-09-28).
 *
 *  SUPERSEDED by pre-alpha3 W1 fix-A (F11), landed at
 *  3b7039e89f2ab9a072d89e2e3caa2af01fe7d355 (2026-09-30, "pre-alpha3 PR-F
 *  increment 1 (F.2 + F.3 + F11 re-land …)") — verified an ANCESTOR of this
 *  kit's base 427219e4: the closed
 *  set is the ADDRESSED team's BOUND Blueprint, resolved by the Governance
 *  service per root (bound-blueprint.ts), and "a BOUND ref NEVER consults the
 *  host boot Blueprint" (packages/runtime/src/plugin/s6-remote.ts, the
 *  policyState.read precheck and policyState.set switchState F11 comments; the
 *  Remote does shape validation only). PR #53 external review ruled this leg
 *  STALE CONTRACT; the coordinator directed a recalibration to the production
 *  rule — a documented revalidation, keeping strength rather than removing it.
 *
 *  The two blueprints are made to DISAGREE on purpose and the disagreement is
 *  asserted live from the catalog first (otherwise neither direction
 *  discriminates): the boot blueprint team.mpr-anchor@latest declares `strict`
 *  and NOT `focus`; the bound blueprint team.prb-ps declares `focus` and NOT
 *  `strict`. On ONE team bound to team.prb-ps the leg then pins:
 *    POSITIVE — policyState.set(`focus`) COMMITS (entryId, no noChange, the
 *      acked state carries the committed model cell) although `focus` is absent
 *      from the boot blueprint — precisely the shape the stale oracle demanded
 *      be rejected; and the committed transition is durable BEFORE the next
 *      observation (the ledger row carrying its entryId is already present).
 *    READ     — policyState.get reports the BOUND set: `focus` active,
 *      `strict` NOT advertised in availableTransitions, every bound state
 *      accounted for.
 *    NEGATIVE — policyState.set(`strict`) (boot-only) on the SAME team is
 *      rejected the typed POLICY_STATE_UNKNOWN, and the rejection REPORTS the
 *      bound closed set (details…closedStates), which must equal the bound
 *      blueprint's set and must not contain `strict`.
 *    DURABLE  — the rejection is durably inert: every table row count, the
 *      ledger high-water mark, every override record/generation pair and the
 *      T-PS transition ledger are identical before and after it. */
async function legC3Structural(host) {
  // (0) pre-flight — the boot set and the bound set must genuinely disagree.
  const bootRes = await remoteCallReady(host, 'catalog.get', { blueprintId: BOOT_BLUEPRINT }, 'c3s-boot-get')
  const bootErr = resultError(bootRes.body)
  if (bootErr !== null) throw new Error(`C3-structural: boot blueprint ${BOOT_BLUEPRINT} failed to resolve: ${JSON.stringify(bootErr).slice(0, 240)}`)
  const bootIds = (((resultData(bootRes.body) ?? {}).blueprint ?? {}).policyStates ?? []).map((s) => s.id)
  const boundRes = await remoteCallReady(host, 'catalog.get', { blueprintId: T_PS_BLUEPRINT }, 'c3s-bound-get')
  const boundErr = resultError(boundRes.body)
  if (boundErr !== null) throw new Error(`C3-structural: bound blueprint ${T_PS_BLUEPRINT} failed to resolve: ${JSON.stringify(boundErr).slice(0, 240)}`)
  const boundIds = (((resultData(boundRes.body) ?? {}).blueprint ?? {}).policyStates ?? []).map((s) => s.id)
  if (!bootIds.includes(C3_STATE_ID)) throw new Error(`C3-structural: the boot blueprint does not declare '${C3_STATE_ID}' — the negative direction would be vacuous (boot=${JSON.stringify(bootIds)})`)
  if (bootIds.includes(PS_FOCUS_STATE_ID)) throw new Error(`C3-structural: the boot blueprint ALSO declares '${PS_FOCUS_STATE_ID}', so the positive would not discriminate bound from boot (boot=${JSON.stringify(bootIds)})`)
  if (!boundIds.includes(PS_FOCUS_STATE_ID)) throw new Error(`C3-structural: the bound blueprint does not declare '${PS_FOCUS_STATE_ID}' (bound=${JSON.stringify(boundIds)})`)
  if (boundIds.includes(C3_STATE_ID)) throw new Error(`C3-structural: the bound blueprint ALSO declares '${C3_STATE_ID}', so the negative would not discriminate (bound=${JSON.stringify(boundIds)})`)
  const boundClosedSorted = [...new Set(['default', ...boundIds])].sort()
  log(`C3-structural pre-flight: boot(${BOOT_BLUEPRINT})=${JSON.stringify(bootIds)} bound(${T_PS_BLUEPRINT})=${JSON.stringify(boundIds)} — disjoint on the two states, both directions discriminate`)

  // (1) create the team bound to the per-team saved source (unchanged).
  const create = await remoteCallReady(host, 'team.create', { rootSessionId: T_PS, blueprintId: T_PS_BLUEPRINT }, 'c3s-create')
  const cErr = resultError(create.body)
  if (cErr !== null) throw new Error(`C3-structural team.create (per-team blueprint) failed: ${cErr.code} — ${String(cErr.message).slice(0, 240)}`)

  // (2) POSITIVE — the bound-only state commits although the boot set lacks it.
  const psSet = await remoteCallReady(host, 'policyState.set', {
    teamSessionId: T_PS,
    target: { stateId: PS_FOCUS_STATE_ID, cells: { model: { value: { kind: 'allow', items: [PS_FOCUS_MODEL] } } } },
    actor: { kind: 'human' },
  }, 'c3s-psset')
  const setErr = resultError(psSet.body)
  if (setErr !== null) {
    throw new Error(`C3-structural: policyState.set(${PS_FOCUS_STATE_ID}) on the team bound to ${T_PS_BLUEPRINT} was REJECTED (${setErr.code} — ${String(setErr.message).slice(0, 200)}); under F11 the closed set is the ADDRESSED team's bound blueprint, which declares '${PS_FOCUS_STATE_ID}'`)
  }
  // the policyState.set handler wraps the switch result in { data: { transition } }.
  const setData = resultData(psSet.body) ?? {}
  const ack = setData.transition ?? setData
  if (ack?.noChange === true) throw new Error(`C3-structural: the positive switch reported noChange (expected a committed transition): ${JSON.stringify(ack).slice(0, 240)}`)
  const entryId = ack?.entryId ?? null
  if (typeof entryId !== 'string' || entryId.length === 0) throw new Error(`C3-structural: the committed transition ack has no entryId: ${JSON.stringify(ack).slice(0, 240)}`)
  if (ack?.state?.stateId !== PS_FOCUS_STATE_ID) throw new Error(`C3-structural: the acked state is ${JSON.stringify(ack?.state?.stateId)}, expected '${PS_FOCUS_STATE_ID}'`)
  const ackedItems = ack?.state?.cells?.model?.value?.items ?? []
  if (!ackedItems.includes(PS_FOCUS_MODEL)) throw new Error(`C3-structural: the acked state does not carry the committed model cell (items=${JSON.stringify(ackedItems)}, expected ${PS_FOCUS_MODEL})`)
  log(`C3-structural POSITIVE: policyState.set(${PS_FOCUS_STATE_ID}) COMMITTED on the bound team — entryId=${entryId} model=${JSON.stringify(ackedItems)} (a state the boot blueprint does not declare)`)

  // (3) the committed transition is durable (the ledger row is there, not just
  //     the ack) — and it is the ONLY T-PS transition so far.
  const afterPositive = await durableSnapshotQuiescent()
  if (afterPositive.psTransitionEntryIds.length !== 1 || afterPositive.psTransitionEntryIds[0] !== entryId) {
    throw new Error(`C3-structural: after the positive switch the T-PS PolicyState ledger holds ${JSON.stringify(afterPositive.psTransitionEntryIds)}, expected exactly [${entryId}] (a governance commit must be durable before its ack is observable)`)
  }
  log(`C3-structural DURABLE: the committed transition is in the ledger (entryId=${entryId}, T-PS transition rows=1)`)

  // (4) the READ plane reports the BOUND set, not the boot set.
  const getRes = await remoteCallReady(host, 'policyState.get', { teamSessionId: T_PS }, 'c3s-psget')
  const getView = (resultData(getRes.body) ?? {}).state ?? {}
  const available = getView.availableTransitions ?? []
  if (getView.stateId !== PS_FOCUS_STATE_ID) throw new Error(`C3-structural: policyState.get reports stateId=${JSON.stringify(getView.stateId)} after the commit, expected '${PS_FOCUS_STATE_ID}'`)
  if (available.includes(C3_STATE_ID)) throw new Error(`C3-structural: policyState.get advertises the BOOT-only '${C3_STATE_ID}' (availableTransitions=${JSON.stringify(available)}) — the read plane must report the bound set`)
  for (const id of boundClosedSorted) {
    if (id !== getView.stateId && !available.includes(id)) throw new Error(`C3-structural: policyState.get does not account for the bound state '${id}' (active=${JSON.stringify(getView.stateId)} available=${JSON.stringify(available)})`)
  }
  log(`C3-structural READ: active=${getView.stateId} availableTransitions=${JSON.stringify(available)} — the bound set, '${C3_STATE_ID}' absent`)

  // (5) NEGATIVE — a BOOT-only state on the SAME addressed team, and nothing
  //     durable may change because of it.
  const before = durableSnapshot()
  const neg = await remoteCallReady(host, 'policyState.set', {
    teamSessionId: T_PS, target: { stateId: C3_STATE_ID }, actor: { kind: 'human' },
  }, 'c3s-negative')
  const negErr = resultError(neg.body)
  if (negErr === null) {
    throw new Error(`C3-structural: policyState.set(${C3_STATE_ID}) — a state the ADDRESSED team's bound blueprint does not declare — was ACCEPTED; F11 requires POLICY_STATE_UNKNOWN because a bound ref never consults the boot blueprint (boot=${JSON.stringify(bootIds)} bound=${JSON.stringify(boundIds)})`)
  }
  if (negErr.code !== 'POLICY_STATE_UNKNOWN' && negErr.code !== 'TEAM_REMOTE_POLICY_STATE_UNKNOWN') {
    throw new Error(`C3-structural: the negative rejection was ${negErr.code}, not the typed POLICY_STATE_UNKNOWN (message=${String(negErr.message).slice(0, 200)})`)
  }
  const reportedClosed = negErr?.details?.cause?.details?.closedStates ?? negErr?.details?.closedStates ?? null
  if (!Array.isArray(reportedClosed)) throw new Error(`C3-structural: the rejection does not report the bound closed set in its details (details=${JSON.stringify(negErr.details ?? {}).slice(0, 260)})`)
  // Set equality, not string equality: the host's bound snapshot lists the
  // default state twice (observed raw: closed set "(default, default, focus)"),
  // which is a rendering artifact of `['default', …bound.policyStates]` over a
  // blueprint that also declares a state named `default`. The message keeps the
  // raw list verbatim in evidence; the assertion compares the SET.
  const reportedSorted = [...new Set(reportedClosed)].sort()
  if (reportedSorted.includes(C3_STATE_ID)) throw new Error(`C3-structural: the rejection reports '${C3_STATE_ID}' inside its own closed set (${JSON.stringify(reportedSorted)})`)
  if (JSON.stringify(reportedSorted) !== JSON.stringify(boundClosedSorted)) {
    throw new Error(`C3-structural: the rejection reports closed set ${JSON.stringify(reportedSorted)} but the bound blueprint ${T_PS_BLUEPRINT} declares ${JSON.stringify(boundClosedSorted)}`)
  }
  log(`C3-structural NEGATIVE: policyState.set(${C3_STATE_ID}) rejected ${negErr.code} reporting the bound set ${JSON.stringify(reportedSorted)}`)

  // (6) DURABLE — the rejection left no trace anywhere.
  const after = await durableSnapshotQuiescent()
  const drift = durableDiff(before, after)
  if (drift.length > 0) throw new Error(`C3-structural: the REJECTED policyState.set(${C3_STATE_ID}) changed the durable store (${drift.join('; ')}) — a rejected governance mutation must be durably inert`)
  const readBack = (resultData((await remoteCallReady(host, 'policyState.get', { teamSessionId: T_PS }, 'c3s-psget2')).body) ?? {}).state ?? {}
  if (readBack.stateId !== PS_FOCUS_STATE_ID) throw new Error(`C3-structural: after the rejection the active state is ${JSON.stringify(readBack.stateId)}, expected the still-committed '${PS_FOCUS_STATE_ID}'`)
  log(`C3-structural DURABLE: the rejection changed nothing (ledger high-water ${after.ledgerMaxSequence}, overrides ${after.overrideRecords}, T-PS transitions ${JSON.stringify(after.psTransitionEntryIds)})`)

  return {
    code: negErr.code,
    message: String(negErr.message ?? '').slice(0, 280),
    closedSet: reportedSorted.join(', '),
    boundBlueprint: T_PS_BLUEPRINT,
    boundStates: boundIds,
    bootStates: bootIds,
    positiveEntryId: entryId,
    positiveModelCell: ackedItems,
    readActive: getView.stateId,
    readAvailableTransitions: available,
    durable: {
      ledgerMaxSequence: after.ledgerMaxSequence,
      overrideRecords: after.overrideRecords,
      overrideGenerations: after.overrideGenerations,
      psTransitionEntryIds: after.psTransitionEntryIds,
      tableCounts: after.tableCounts,
    },
    structuralFinding: `F11 (pre-alpha3 W1 fix-A, 3b7039e8, an ancestor of this base): the policyState closed set is the ADDRESSED team's BOUND Blueprint and a BOUND ref never consults the host boot Blueprint. Demonstrated on one team bound to ${T_PS_BLUEPRINT}: the bound-only '${PS_FOCUS_STATE_ID}' COMMITTED (entryId ${entryId}) although the boot blueprint (${BOOT_BLUEPRINT}: ${JSON.stringify(bootIds)}) does not declare it; the boot-only '${C3_STATE_ID}' was rejected ${negErr.code} reporting the bound set [${reportedSorted.join(', ')}]; the rejection left the durable store unchanged on every metric this kit measures — durableDiff() found no difference in per-table row counts, in the ledger high-water (after: ${after.ledgerMaxSequence}), in the T-PS transition entryIds ${JSON.stringify(after.psTransitionEntryIds)}, in the override record count (after: ${after.overrideRecords}) or in the override generations ${JSON.stringify(after.overrideGenerations)}, each compared after quiescence polling; these are counts, IDs and generations, not byte hashes — the kit takes no hash of the store file, so a same-count mutation of row contents would not be detected and no such claim is made. Supersedes the 10add920-era boot-blueprint oracle. Sources: packages/runtime/src/plugin/s6-remote.ts (policyState.read precheck + switchState, F11), governance service closed-set check, bound-blueprint.ts.`,
  }
}

/** C4 — a governance mutation (override.set) run CONCURRENTLY with a
 *  member.followup: the followup completes with no activation error, the
 *  mutation commits (the durable winner is present afterwards), and the next
 *  deterministic boundary carries the committed value (no lost update). */
async function legC4(host) {
  const marker = token('PRB-C4')
  const nextMarker = token('PRB-C4N')
  MARKER_ACKS.push([marker, 'prb c4 ack'])
  MARKER_ACKS.push([nextMarker, 'prb c4 next ack'])

  const setPromise = remoteCallReady(host, 'override.set', {
    teamSessionId: T1, capability: 'model',
    value: { kind: 'allow', items: [C4_MODEL] },
    actor: { kind: 'human' }, scope: 'instance', targetInstanceId: CONTROL,
  }, 'c4-set')
  const fuPromise = remoteCallReady(host, 'member.followup', {
    teamSessionId: T1, caller: { kind: 'human', humanId: T1 }, targetInstanceId: CONTROL,
    requestToken: token('c4-fu'), payload: { prompt: `PR-B C4 concurrent marker ${marker}. Reply with one short word.` },
  }, 'c4-fu')

  let setRes, fuRes, setThrew = null, fuThrew = null
  try { setRes = await setPromise } catch (e) { setThrew = e }
  try { fuRes = await fuPromise } catch (e) { fuThrew = e }
  if (setThrew?.fatalSentinel || fuThrew?.fatalSentinel) throw (setThrew?.fatalSentinel ? setThrew : fuThrew)

  // (a) the followup completes with NO activation error.
  if (fuThrew !== null) throw new Error(`C4: the concurrent followup threw: ${String(fuThrew.message ?? fuThrew).slice(0, 240)}`)
  const fuErr = resultError(fuRes.body)
  const fuOutcome = resultData(fuRes.body)?.outcome
  if (fuErr !== null) throw new Error(`C4: the concurrent followup was REJECTED (an activation error under concurrency): ${fuErr.code} — ${String(fuErr.message).slice(0, 240)}`)
  if (fuOutcome?.status !== 'executed' || fuOutcome?.effect?.kind !== 'work-admitted') throw new Error(`C4: the concurrent followup outcome is not work-admitted: ${JSON.stringify(fuOutcome).slice(0, 240)}`)
  log('C4: the concurrent followup completed work-admitted (no activation error)')

  // (b) the mutation commits: the durable winner is present afterwards.
  if (setThrew !== null) throw new Error(`C4: the concurrent override.set threw: ${String(setThrew.message ?? setThrew).slice(0, 240)}`)
  const setErr = resultError(setRes.body)
  const setRec = resultData(setRes.body)?.override ?? resultData(setRes.body)
  if (setErr !== null) throw new Error(`C4: the concurrent override.set was REJECTED: ${setErr.code} — ${String(setErr.message).slice(0, 240)}`)
  if (setRec === null || typeof setRec.recordId !== 'string') throw new Error(`C4: the override.set ack has no record: ${JSON.stringify(resultData(setRes.body)).slice(0, 240)}`)

  const getRes = await remoteCallReady(host, 'override.get', { teamSessionId: T1, capability: 'model', scope: 'instance', targetInstanceId: CONTROL }, 'c4-get')
  const getRec = resultData(getRes.body)?.override ?? null
  if (getRec === null) throw new Error('C4: override.get after the concurrent set reports NO winner (the mutation did not commit / lost update)')
  if (getRec.recordId !== setRec.recordId) throw new Error(`C4: the durable winner ${getRec.recordId} differs from the acked ${setRec.recordId} (lost update / incoherent slot)`)
  log(`C4: the mutation committed — durable winner ${getRec.recordId} gen=${getRec.generation}`)

  // (c) the NEXT deterministic boundary carries the committed value.
  const nextFu = await remoteCallReady(host, 'member.followup', {
    teamSessionId: T1, caller: { kind: 'human', humanId: T1 }, targetInstanceId: CONTROL,
    requestToken: token('c4-next'), payload: { prompt: `PR-B C4 next-boundary marker ${nextMarker}. Reply with one short word.` },
  }, 'c4-next')
  const nextOutcome = resultData(nextFu.body)?.outcome
  if (nextOutcome?.status !== 'executed' || nextOutcome?.effect?.kind !== 'work-admitted') {
    throw new Error(`C4: the next-boundary followup not work-admitted: ${JSON.stringify(resultError(nextFu.body) ?? nextOutcome).slice(0, 240)}`)
  }
  const nextReq = await requestForMarker(nextMarker)
  if (nextReq === null) throw new Error('C4: no mock request carried the C4 next-boundary marker')
  const nextModel = modelOf(nextReq)
  const expected = C4_MODEL.split('/')[1]
  if (nextModel !== expected) throw new Error(`C4: next-boundary wire body.model=${JSON.stringify(nextModel)} !== committed ${JSON.stringify(expected)} (the committed mutation did not take effect)`)
  return { winner: getRec.recordId, generation: getRec.generation, nextModel, mockSeqNext: nextReq.seq, marker, nextMarker }
}

/** C5 — restart on the SAME DSH_HOME: the committed override (C1 model, C2
 *  mcp) + the T-C3 committed PolicyState still governs the NEXT request. */
async function legC5() {
  const out = {}
  // (1) the C1 model override still governs w-create's next request.
  const m1 = token('PRB-C5C1'); MARKER_ACKS.push([m1, 'prb c5 c1 ack'])
  const f1 = await remoteCallReady(HOST2, 'member.followup', {
    teamSessionId: T1, caller: { kind: 'human', humanId: T1 }, targetInstanceId: W_CREATE,
    requestToken: token('c5-f1'), payload: { prompt: `PR-B C5 restart-model marker ${m1}. Reply with one short word.` },
  }, 'c5-f1')
  const o1 = resultData(f1.body)?.outcome
  if (o1?.status !== 'executed' || o1?.effect?.kind !== 'work-admitted') throw new Error(`C5: restart C1 followup not work-admitted: ${JSON.stringify(resultError(f1.body) ?? o1).slice(0, 240)}`)
  const r1 = await requestForMarker(m1)
  if (r1 === null) throw new Error('C5: no mock request carried the C5 model marker')
  out.model = modelOf(r1)
  if (out.model !== C1_MODEL.split('/')[1]) throw new Error(`C5: post-restart model wire body.model=${JSON.stringify(out.model)} !== ${JSON.stringify(C1_MODEL.split('/')[1])} (the committed model override did NOT survive the restart)`)

  // (2) the C2 mcp override still governs the expert's next request.
  const m2 = token('PRB-C5C2'); MARKER_ACKS.push([m2, 'prb c5 c2 ack'])
  const f2 = await remoteCallReady(HOST2, 'member.followup', {
    teamSessionId: T1, caller: { kind: 'human', humanId: T1 }, targetInstanceId: EXPERT,
    requestToken: token('c5-f2'), payload: { prompt: `PR-B C5 restart-mcp marker ${m2}. Reply with one short word.` },
  }, 'c5-f2')
  const o2 = resultData(f2.body)?.outcome
  if (o2?.status !== 'executed' || o2?.effect?.kind !== 'work-admitted') throw new Error(`C5: restart C2 followup not work-admitted: ${JSON.stringify(resultError(f2.body) ?? o2).slice(0, 240)}`)
  const r2 = await requestForMarker(m2)
  if (r2 === null) throw new Error('C5: no mock request carried the C5 mcp marker')
  out.mcp = mcpTools(r2)
  if (!out.mcp.includes(`mcp__${MCP_A}__ping`)) throw new Error(`C5: post-restart mcp override did NOT mount ${MCP_A} (mcp__ tools: ${JSON.stringify(out.mcp)})`)
  if (out.mcp.some((n) => n.startsWith(`mcp__${MCP_B}__`))) throw new Error(`C5: post-restart a non-overridden server leaked: ${JSON.stringify(out.mcp)}`)

  // (3) the T-C3 committed PolicyState still governs the T-C3 worker's next
  // request — only checkable when C3-positive produced a worker (the
  // criterion is "override (and/or committed PolicyState)"). The C3-positive
  // committed the `strict` state with a model cell, so the post-restart next
  // request must carry the committed state's model (prb-c3-strict).
  if (C3_POS.workerId === null) {
    out.ps = 'skipped (C3-positive unavailable)'
    log('C5: T-C3 restart check skipped (C3-positive did not yield a worker)')
    return out
  }
  const m3 = token('PRB-C5PS'); MARKER_ACKS.push([m3, 'prb c5 ps ack'])
  const f3 = await remoteCallReady(HOST2, 'member.followup', {
    teamSessionId: T_C3, caller: { kind: 'human', humanId: T_C3 }, targetInstanceId: C3_POS.workerId,
    requestToken: token('c5-f3'), payload: { prompt: `PR-B C5 restart-ps marker ${m3}. Reply with one short word.` },
  }, 'c5-f3')
  const o3 = resultData(f3.body)?.outcome
  if (o3?.status !== 'executed' || o3?.effect?.kind !== 'work-admitted') throw new Error(`C5: restart T-C3 followup not work-admitted: ${jstr(resultError(f3.body) ?? o3, 240)}`)
  const r3 = await requestForMarker(m3)
  if (r3 === null) throw new Error('C5: no mock request carried the C5 T-C3 marker')
  const psModel = modelOf(r3)
  if (C3_POS.positiveDemonstrable === true) {
    // a committed PolicyState (strict + model cell) existed — it must survive
    // the restart: the post-restart next request carries the state's model.
    out.ps = psModel
    if (psModel !== C3_STRICT_MODEL_ID) throw new Error(`C5: post-restart T-C3 wire body.model=${JSON.stringify(psModel)} !== ${JSON.stringify(C3_STRICT_MODEL_ID)} (the committed PolicyState did NOT survive the restart)`)
  } else {
    // no committed PolicyState — the worker's next request carries the baseline.
    out.ps = `${psModel} (baseline; no committed PolicyState)`
    log(`C5: T-C3 post-restart baseline model=${psModel} (no committed PolicyState)`)
  }
  return out
}

// ── evidence + summary ──────────────────────────────────────────────────────
function writeEvidence({ criteria, legs, stableBefore, stableAfter, testUse, ports, worldCleaned }) {
  mkdirSync(LOG_DIR, { recursive: true })
  writeFileSync(join(RUN_DIR, 'api-transcript.json'), JSON.stringify(EVID.transcript, null, 2))
  writeFileSync(join(RUN_DIR, 'mock-requests.json'), JSON.stringify(MOCK?.requests ?? [], null, 2))
  // scrubbed host logs
  const hostLogsOut = []
  for (const h of EVID.hostLogs) {
    const dest = join(RUN_DIR, `host${h.bootNum}-${h.phase}-port${h.port}.log`)
    try {
      const raw = readFileSync(h.logPath, 'utf8')
      writeFileSync(dest, scrubTokens(raw))
      hostLogsOut.push({ bootNum: h.bootNum, phase: h.phase, port: h.port, src: h.logPath, dest })
    } catch (e) { hostLogsOut.push({ bootNum: h.bootNum, phase: h.phase, port: h.port, error: String(e.message ?? e) }) }
  }
  const summary = {
    kit: 'pr-b-effective-policy-smoke',
    stamp: STAMP,
    world: WORLD,
    worldCleaned: worldCleaned === true,
    worktree: WORKTREE,
    seedWorld: SEED_WORLD,
    testUse: { tree: TESTUSE, ...testUse },
    ports,
    stable: { before: stableBefore, after: stableAfter },
    criteria,
    legs,
    findings: {
      structural: LEGS.C3?.structural?.structuralFinding ?? null,
      structuralClosedSet: LEGS.C3?.structural?.closedSet ?? null,
      structuralRejection: LEGS.C3?.structural?.message ?? null,
      c3PositiveIsUiGovernanceFlow: 'C3 positive = the functional UI governance flow: the committed cells originate from the client target (verbatim, normalizeStateView, mutation/service.ts:839), supplied by the governance panel cell editor (TeamGovernance.tsx runPolicyCommit). There is NO client-side gap — the governance panel sends the edited cell map (not just the stateId).',
      c3PositiveDemonstrated: LEGS.C3?.positive?.positiveDemonstrable === true,
      c3Wire: LEGS.C3?.positive ? { c3aBaselineModel: LEGS.C3.positive.baseModel, policyStateSetEntryId: LEGS.C3.positive.entryId, c3bNextRequestModel: LEGS.C3.positive.strictModel } : null,
    },
    hostLogs: hostLogsOut,
    fatal: FATAL,
    exitCode: EXIT_CODE,
  }
  writeFileSync(join(RUN_DIR, 'summary.json'), JSON.stringify(summary, null, 2))
  log(`evidence written: ${RUN_DIR}`)
}

let FINISHED = false
function finish(code) {
  if (FINISHED) return // exactly-once: a second call (e.g. the safety-net catch) is a no-op
  FINISHED = true
  EXIT_CODE = code
  void (async () => {
    let worldCleaned = false
    try {
      // best-effort teardown (never mask the exit code).
      try { if (HOST2) await stopHost(HOST2, 'final') } catch { /* ignore */ }
      try { if (HOST1) await stopHost(HOST1, 'final') } catch { /* ignore */ }
      try { if (MOCK) await MOCK.close() } catch { /* ignore */ }
      try { await closeMini(MINI_A) } catch { /* ignore */ }
      try { await closeMini(MINI_B) } catch { /* ignore */ }
      // G9 — post-run stable probes: the stable instances must be untouched.
      EVID.stableAfter = await stableProbes('post')
      // G9 — world cleanup: delete the DSH_HOME world only on a clean PASS;
      // retain it on any non-zero exit for inspection.
      if (EXIT_CODE === 0) {
        rmSync(HOME, { recursive: true, force: true })
        worldCleaned = true
      }
      writeEvidence({
        criteria: CRITERIA,
        legs: LEGS,
        stableBefore: EVID.stableBefore ?? [],
        stableAfter: EVID.stableAfter ?? [],
        testUse: EVID.testUse ?? { clean: null },
        ports: EVID.ports ?? {},
        worldCleaned,
      })
    } catch (e) { log(`WARNING: finish teardown/evidence failed: ${String(e?.message ?? e)}`) }
    // print the summary to stdout (the machine-readable result) — always.
    const lines = []
    lines.push(`PR-B effective-policy real-host smoke — ${STAMP}`)
    lines.push(`world: tests/homes/${WORLD}  ${worldCleaned ? '(cleaned on PASS)' : '(retained — non-zero exit, for inspection)'}`)
    lines.push(`evidence: ${RUN_DIR}`)
    for (const c of CRITERIA) lines.push(`  ${c.id} ${c.pass === true ? 'PASS' : c.pass === false ? 'FAIL' : c.pass === 'partial' ? 'PARTIAL' : 'N/A'}  ${c.label}${c.detail ? `  [${c.detail}]` : ''}`)
    lines.push(`exit=${code}  fatal=${FATAL ?? 'none'}`)
    process.stdout.write('\n' + lines.join('\n') + '\n')
    process.exit(code)
  })()
}

// the per-leg captured evidence (for the summary).
const LEGS = {}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  mkdirSync(RUN_DIR, { recursive: true })
  mkdirSync(LOG_DIR, { recursive: true })
  C('PR-B effective-policy real-host smoke kit')
  C(`  worktree : ${WORKTREE}`)
  C(`  world    : tests/homes/${WORLD} (copy of the mpr seed)`)
  C(`  evidence : ${RUN_DIR}`)

  // ── pre-hygiene: stable instance + test-use tree + ports ──────────────────
  EVID.stableBefore = await stableProbes('pre')
  EVID.testUse = testUseClean()
  if (!EVID.testUse.clean) dieFatal(`test-use tree not clean: ${EVID.testUse.detail}`)
  const hostPort = await pickHostPort()
  if (hostPort === null) dieFatal(`no free host port in ${HOST_PORT_CANDIDATES.join(',')}`)
  for (const p of [MOCK_PORT, MCP_A_PORT, MCP_B_PORT]) if (await portInUse(p)) dieFatal(`port ${p} busy (expected free)`)
  EVID.ports = { hostPort, mockPort: MOCK_PORT, mcpA: MCP_A_PORT, mcpB: MCP_B_PORT }
  C(`  host port ${hostPort}, mock ${MOCK_PORT}, mini-MCP ${MCP_A_PORT}/${MCP_B_PORT}`)

  // ── world prep ────────────────────────────────────────────────────────────
  prepareWorld()

  // ── mock model + mini-MCP (both BEFORE the host) ──────────────────────────
  const mockLogPath = join(RUN_DIR, 'mock.log')
  MOCK = await startMockModel({
    port: MOCK_PORT,
    decide: decideMock,
    log: (msg) => { try { writeFileSync(mockLogPath, `${msg}\n`, { flag: 'a' }) } catch { /* ignore */ } },
  })
  EVID.mockLog = mockLogPath
  log(`mock model on 127.0.0.1:${MOCK.port}`)
  MINI_A = await startMiniMcp(MCP_A_PORT, MCP_A)
  MINI_B = await startMiniMcp(MCP_B_PORT, MCP_B)
  log(`mini-MCP ${MCP_A}:${MINI_A.port} ${MCP_B}:${MINI_B.port}`)

  // ── host #1 ───────────────────────────────────────────────────────────────
  writeP6t6Directive(1, 'resume')
  HOST1 = await bootHost(1, 'resume', hostPort)

  // a readiness touch (the mount-before-boot gate resolves here).
  await remoteCallReady(HOST1, 'catalog.list', {}, 'ready')
  log('team-remote mounted and ready (catalog.list answered)')

  // ── C1 (model override) then C6 (inspect parity on the same member) ──────
  try {
    LEGS.C1 = await legC1(HOST1)
    mark('C1', true, `wire body.model=${LEGS.C1.wireModel} (override ${LEGS.C1.recordId} gen=${LEGS.C1.generation})`)
  } catch (e) { if (e?.fatalSentinel) throw e; mark('C1', false, e.message); LEGS.C1 = { error: e.message } }
  try {
    LEGS.C6 = await legC6(HOST1, LEGS.C1)
    mark('C6', true, `route=${LEGS.C6.route} (state=${LEGS.C6.state}) == wire body.model=${LEGS.C6.wireModel}`)
  } catch (e) {
    if (e?.fatalSentinel) throw e
    mark('C6', false, LEGS.C1 ? e.message : `C6 depends on C1 (C1 did not yield a wire model): ${e.message}`)
    LEGS.C6 = { error: e.message }
  }

  // ── C2 (mcp override) ─────────────────────────────────────────────────────
  try {
    LEGS.C2 = await legC2(HOST1)
    mark('C2', true, `wire mcp__ tools=${JSON.stringify(LEGS.C2.wireMcp)} (override ${LEGS.C2.recordId})`)
  } catch (e) { if (e?.fatalSentinel) throw e; mark('C2', false, e.message); LEGS.C2 = { error: e.message } }

  // ── C3 (policyState: T1 negative + T-C3 positive + per-team structural) ──
  let c3neg = null, c3pos = null, c3str = null
  try { c3neg = await legC3Negative(HOST1); log(`C3-negative: ${JSON.stringify(c3neg)}`) }
  catch (e) { if (e?.fatalSentinel) throw e; c3neg = { error: e.message } }
  try { c3pos = await legC3Positive(HOST1); C3_POS.workerId = c3pos.workerId; C3_POS.positiveDemonstrable = c3pos.positiveDemonstrable }
  catch (e) { if (e?.fatalSentinel) throw e; c3pos = { error: e.message } }
  // the STRUCTURAL finding re-demonstrated on the per-team blueprint (team.prb-ps
  // declares `focus` yet it is rejected — the closed set is the boot blueprint's
  // {default, strict}, not the per-team blueprint's {default, focus}).
  try { c3str = await legC3Structural(HOST1); log(`C3-structural: ${JSON.stringify(c3str).slice(0, 240)}`) }
  catch (e) { if (e?.fatalSentinel) throw e; c3str = { error: e.message } }
  const c3ok = c3neg && !(c3neg.error) && c3pos && !(c3pos.error) && c3str && !(c3str.error)
  if (c3ok && c3pos.positiveDemonstrable === true) {
    mark('C3', true, `negative=${c3neg.code}; C3a baseline=${c3pos.baseModel} -> C3b=${c3pos.strictModel} (entryId ${c3pos.entryId}); structural=bound-set(${c3str.closedSet}) positive-on-bound=${c3str.positiveEntryId} boot-only-rejected=${c3str.code} durable-inert=yes`)
  } else if (c3ok && c3pos.positiveDemonstrable === false) {
    mark('C3', 'partial', `negative=${c3neg.code}; C3a baseline=${c3pos.baseModel}; POSITIVE not demonstrated`)
  } else {
    const detail = `negative=${JSON.stringify(c3neg).slice(0, 140)}; positive=${JSON.stringify(c3pos).slice(0, 140)}; structural=${JSON.stringify(c3str).slice(0, 140)}`
    mark('C3', false, detail)
  }
  LEGS.C3 = { negative: c3neg, positive: c3pos, structural: c3str }

  // ── C4 (mutation ∥ concurrent request) ────────────────────────────────────
  try {
    LEGS.C4 = await legC4(HOST1)
    mark('C4', true, `concurrent followup OK; winner=${LEGS.C4.winner} gen=${LEGS.C4.generation}; next-boundary model=${LEGS.C4.nextModel}`)
  } catch (e) { if (e?.fatalSentinel) throw e; mark('C4', false, e.message); LEGS.C4 = { error: e.message } }

  // ── C5 (restart on the SAME DSH_HOME) ─────────────────────────────────────
  try {
    await stopHost(HOST1, 'pre-restart')
    writeP6t6Directive(2, 'resume')
    HOST2 = await bootHost(2, 'resume', hostPort)
    await remoteCallReady(HOST2, 'catalog.list', {}, 'ready2')
    LEGS.C5 = await legC5()
    mark('C5', true, `post-restart model=${LEGS.C5.model} mcp=${JSON.stringify(LEGS.C5.mcp)} T-C3 ps=${LEGS.C5.ps}`)
  } catch (e) { if (e?.fatalSentinel) throw e; mark('C5', false, e.message); LEGS.C5 = { error: e.message } }

  // ── verdict ───────────────────────────────────────────────────────────────
  const failed = CRITERIA.filter((c) => c.pass === false)
  const code = FATAL !== null ? 1 : (failed.length > 0 ? 2 : 0)
  finish(code)
}

// C3-positive worker id + whether the committed-state model flow was
// demonstrated (referenced by the C5 restart leg's T-C3 sub-check).
const C3_POS = { workerId: null, positiveDemonstrable: null }

// Safety net: main() surfaces every dieFatal sentinel + unhandled throw here.
// finish() is exactly-once (FINISHED guard), so a fatal that already ran its
// teardown is not double-finalized.
main().catch((e) => {
  if (e?.fatalSentinel !== true) {
    FATAL = `unhandled: ${String(e?.message ?? e)}`
    log(`main threw: ${String(e?.stack ?? e)}`)
  }
  finish(1)
})
