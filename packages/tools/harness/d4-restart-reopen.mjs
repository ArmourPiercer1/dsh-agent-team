#!/usr/bin/env node
/**
 * d4-restart-reopen.mjs — the D4 (Team D1-D6 repair v2, Wave D) REAL-HOST
 * restart/reopen Team UI acceptance runner (plan §12 D4, the 8-step real
 * scenario, G4 exit criteria).
 *
 * A standalone runner that EXTENDS the PATTERN of
 * packages/tools/harness/t12-vertical.mjs (byte-identical precedent,
 * untouched): the same public profile-patch seam, the same production dist
 * host row (this worktree's committed D1-D3 build — D4 changes NO install
 * surface, so no rebuild), the same DshInstance boot chain (file-fd stdio
 * only — TEST_METHODS §5), the same p6t6-team-tools observability row, the
 * same multi-frame zstd durable-log reader, the same deterministic local
 * DeepSeek-compatible mock (mock-deepseek.mjs) reached only via the launch
 * environment (DEEPSEEK_BASE_URL / DEEPSEEK_API_KEY), so every model call
 * goes through the real dsh-llm adapter + SSE + agent loop + durable
 * session log.
 *
 * THE REAL SCENARIO (plan §12 D4, steps 1-8) — executed on the shared
 * TEST_METHODS test host:
 *   source: references/deepseek-harness-test-use (pristine @ 76fda729)
 *   home:   references/.dsh-test (SHARED test home — the same durable home
 *           across stop + restart; pre-existing roots are NOT destroyed and
 *           are asserted as part of the multi-root enumeration)
 *   port:   3180 (both boots, serial; the port is verified free between and
 *           after the boots)
 *
 *   S1 (step 1)  boot 1 (row phase create-or-open, resolves to 'create' for
 *                the nonce row root ROOT_A) + DYNAMIC team root ROOT_B via
 *                the browser-facing public remote channel
 *                POST /team-remote/team.create (contract v2 — the
 *                UI-equivalent programmatic path the Team UI New-Team entry
 *                uses; t12-vertical boot+drive precedent); ROOT_B receives a
 *                real Leader turn (POST /api/session/prompt) whose tool
 *                table is enumerated from the mock capture (baseline ten
 *                team_* tools).
 *   S2 (step 2)  durable-row confirmation: the row state route (root
 *                ROOT_A: TeamSession row + Leader member row), the v3
 *                team.listRoots remote (ALL durable roots incl. the
 *                pre-existing home roots + ROOT_A + ROOT_B, exact wire
 *                shape), a forensic read of storages/team_domain.json
 *                (both roots' TeamSession + Leader rows + team-root
 *                bindings), and the native session artifacts
 *                (session.jsonl.zstd headers under DSH_HOME/sessions,
 *                cwd == defaultWorkspace).
 *   S3 (step 3)  clean stop of the test host (managed instance stop) +
 *                port 3180 verified free.
 *   S4 (step 4)  RESTART with the SAME references/.dsh-test DSH_HOME (same
 *                port): row phase create-or-open now resolves to 'resume'
 *                (the durable ROOT_A identity loads, never re-minted); the
 *                row's own resume boot re-activates ROOT_A live (row
 *                semantics, config root only) while ROOT_B stays COLD —
 *                the D2 precondition. team.listRoots after restart returns
 *                BYTE-IDENTICAL wire rows for ROOT_A/ROOT_B (the D1 index
 *                rebuilds identically over the same durable rows).
 *   S5 (step 5)  the Team UI "open in Team mode" entry (D2 openTeamMode,
 *                phase (a) of the awaited two-phase sequence) driven over
 *                the SAME public remote channel the browser client uses:
 *                POST /team-remote/team.ensureRootLive (contract v3) for
 *                ROOT_B — a cold revive of the durable root through the
 *                live glue's ensureLiveAgent (A3 Q1 live-first / A3 Q2
 *                typed mapping). The native open (phase (b)) is the
 *                browser's session load: POST /api/session/page.
 *   S6 (step 6)  VERIFY: root history renders (the boot-1 turn + its reply
 *                come back through session/page); the Leader prompt is
 *                reachable (a NEW turn on ROOT_B settles); the ten team_*
 *                tools are registered on the LIVE root agent (enumerated
 *                from the real model request's tool schema — the public
 *                seam the repo tests use, t12-vertical V2 deferred checks —
 *                plus the row health toolCount); a REAL team_* tool call
 *                (team_list_members) executes successfully on the
 *                restarted host through the p6t6 observability seam.
 *   S7 (step 7)  the explicit "open in ordinary mode" entry (D3
 *                openOrdinaryMode): a pure native session load with ZERO
 *                team.* remote calls (no ensure-live), verified by the
 *                call ledger of this run; the ordinary entry does NOT
 *                strip the already-live Team agent (A3 documented
 *                caveat: it promises no team_* guarantee and performs no
 *                ensure — a follow-up turn still rides the same live
 *                agent, recorded as evidence, not as a promise). The
 *                client-side mode-badge semantics ('ordinary' shown,
 *                'team' shown after the Team entry) are pinned by the
 *                committed client unit tests (d2-open-team-mode.test.ts /
 *                d3-open-ordinary-mode.test.ts) — cited, not re-claimed.
 *   S8 (step 8)  switch BACK to Team mode: team.ensureRootLive on ROOT_B a
 *                SECOND time succeeds with the closed v3 shape (the no-op
 *                adoption of the already-live glue agent — a second
 *                agents.resume would have surfaced the upstream
 *                'already registered' rejection as typed OUTSIDE_TEAM and
 *                the check would fail); the row health liveSessions holds
 *                ROOT_B EXACTLY once (one agent for the root session id,
 *                by registry construction); exactly ONE durable session
 *                artifact for ROOT_B (no second session minted); the team
 *                setup still re-takes over (a real team_list_members call
 *                succeeds again).
 *
 * EXPLICIT BOUNDARY (plan §12 D4 "不测试/不宣称"): the ordinary SESSION
 * LIST open is NOT auto-Team. This run exercises ONLY the explicit entries
 * on ROOT_B (Team-mode entry x2, ordinary entry x1) plus the row's own
 * create/resume boot of ROOT_A; it never opens an arbitrary ordinary-list
 * session and claims NO team_* availability there. The boundary statement
 * is written into summary.json (`boundary`).
 *
 * No product code is modified by this task (acceptance only); if a product
 * defect surfaces, the scenario fails closed with the exact reproduction
 * in the summary (the D4 contract: record, do not fix).
 *
 * Usage:
 *   node packages/tools/harness/d4-restart-reopen.mjs --report-dir <dir>
 *
 * Layout (resolved by walking up from this file):
 *   REPO_ROOT  - the ancestor containing references/deepseek-harness-test-use
 *   HOST_TREE  - REPO_ROOT/references/deepseek-harness-test-use (pristine
 *                upstream test-use tree; git state asserted before AND after)
 *   DSH_HOME   - REPO_ROOT/references/.dsh-test (the SHARED test home;
 *                workspace-internal, gitignored; pre-existing durable rows
 *                are preserved, never destroyed)
 *   PORT       - 3180 (fixed; the stable instance owns 3080 and is only
 *                probed read-only pre/post, never touched)
 */

import {
  appendFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { randomBytes } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { zstdDecompressSync } from 'node:zlib'

import { DshInstance, ensureProfile } from '../../../tests/characterization/lib/instance.mjs'
import { logTail, spawnToLog, walk, waitForPortFree } from '../../../tests/characterization/lib/util.mjs'
import { captureGitState } from '../../../tests/characterization/lib/tree-clean.mjs'
import { startMockModel } from './mock-deepseek.mjs'

// ── paths & constants ──────────────────────────────────────────────────────

const HERE = dirname(fileURLToPath(import.meta.url))
const WORKTREE_ROOT = resolve(HERE, '..', '..', '..')

/** Walk up from the worktree to the ancestor containing references/. */
function findRepoRoot(start) {
  let dir = start
  for (;;) {
    if (existsSync(join(dir, 'references', 'deepseek-harness-test-use'))) return dir
    const parent = dirname(dir)
    if (parent === dir) throw new Error(`no ancestor of ${start} contains references/deepseek-harness-test-use`)
    dir = parent
  }
}

const REPO_ROOT = findRepoRoot(WORKTREE_ROOT)
const HOST_TREE = join(REPO_ROOT, 'references', 'deepseek-harness-test-use')

const argv = process.argv.slice(2)
const reportDirArg = argv.find((a, i) => argv[i - 1] === '--report-dir')
if (reportDirArg === undefined) throw new Error('usage: node d4-restart-reopen.mjs --report-dir <dir>')
const REPORT_DIR = resolve(reportDirArg)

const CLIENT_COMMIT_HASH = '76fda72979'
const STABLE_URL = 'http://127.0.0.1:3080/'
const EXPECTED_HOST_SHA = '76fda729799fe9b3848dbe2c211d4b231032b81e'

const PRODUCTION_ROW_NAME = pathToFileURL(
  join(WORKTREE_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js'),
).href
const P6T6_ROW_NAME = pathToFileURL(join(HERE, 'plugin.mjs')).href
const GLUE_URL = pathToFileURL(
  join(WORKTREE_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs'),
).href
const SEAM_URL = pathToFileURL(
  join(WORKTREE_ROOT, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs'),
).href

const PORT = 3180
const DSH_HOME = join(REPO_ROOT, 'references', '.dsh-test')
// The shared home's workspace registry holds exactly ONE registered
// workspace: the repo root itself (the legacy rows of this same home used
// it as defaultWorkspace). The v2 remote team.create validates the
// workspace parameter against the registry (TEAM_CREATE_WORKSPACE_NOT_FOUND
// for unregistered paths), so the scenario's team works in the registered
// workspace — the real Team-UI "new team" shape. Model turns are pure text
// (the mock never calls tools), so no file writes occur under it.
const WORKSPACE = REPO_ROOT

const NONCE = `${Date.now().toString(36)}${randomBytes(3).toString('hex')}`
const ROOT_A = `session-d4v2-a-${NONCE}`
const ROOT_B = `session-d4v2-b-${NONCE}`
const BLUEPRINT_ID = 'd4v2-bp'
const BLUEPRINT_REVISION = '1' // blueprint doc revision (string, YAML scalar)
const BLUEPRINT_REVISION_NUM = 1 // remote param shape: blueprintRevision is a number (params.ts)
const LEADER_INSTANCE_ID = 'inst-leader'
const EXPECTED_TOOL_COUNT = 10

/** The closed ten team_* tools (packages/tools/src/tools.ts). */
const TEAM_TOOLS = [
  'team_list_members',
  'team_list_templates',
  'team_inspect_config',
  'team_create_member',
  'team_delegate',
  'team_follow_up',
  'team_send_message',
  'team_report_progress',
  'team_request_control',
  'team_resolve_control',
]

/** Turn markers (the mock model decides deterministically on them). */
const M1 = `D4V2_B1_T1_${NONCE}` // boot 1: ROOT_B first Leader turn
const M2 = `D4V2_B2_T2_${NONCE}` // boot 2: ROOT_B Leader turn after the Team-mode open
const M3 = `D4V2_B2_T3_${NONCE}` // boot 2: ROOT_B Leader turn after the ordinary open (adoption evidence)

const BLUEPRINT_DOC = [
  '---',
  'schemaVersion: 1',
  `blueprintId: ${BLUEPRINT_ID}`,
  `revision: "${BLUEPRINT_REVISION}"`,
  'leader:',
  '  templateId: leader',
  '  persona: "D4V2 leader: you lead the d4v2 restart-reopen acceptance team."',
  'members:',
  '  - templateId: worker',
  '    displayName: "D4V2 Worker"',
  '    persona: "D4V2 worker persona: you are the deterministic d4v2 worker."',
  'requirements:',
  '  - domain: persona',
  '    name: standard',
  'teamEnvelope:',
  '  allow:',
  '    - assign-task',
  '    - create-member',
  '    - send-message',
  '    - report-progress',
  '    - archive-member',
  '    - restore-member',
  '  deny:',
  '    - delete-team',
  'memberEnvelopes:',
  '  - templateId: worker',
  '    envelope:',
  '      allow:',
  '        - send-message',
  '        - report-progress',
  '      deny: []',
  'policyStates:',
  '  - id: default',
  '    description: "The d4v2 default state."',
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

// ── logging / scenario plumbing ────────────────────────────────────────────

mkdirSync(REPORT_DIR, { recursive: true })
const RUN_LOG = join(REPORT_DIR, 'run.log')
const log = (line) => {
  const text = `[${new Date().toISOString()}] ${line}`
  console.log(text)
  appendFileSync(RUN_LOG, `${text}\n`)
}

function makeScenarioCtx(criterion) {
  const c = { criterion, t0: Date.now(), assertions: [], evidence: {}, notes: [], error: null }
  c.check = (name, ok, detail) => {
    c.assertions.push({ name, ok: ok === true, detail: detail === undefined ? undefined : String(detail).slice(0, 3000) })
    return ok === true
  }
  c.note = (text) => c.notes.push(String(text))
  c.finish = () => ({
    criterion,
    pass: c.error === null && c.assertions.length > 0 && c.assertions.every((a) => a.ok),
    durationMs: Date.now() - c.t0,
    assertions: c.assertions,
    evidence: c.evidence,
    notes: c.notes,
    ...(c.error !== null ? { error: String(c.error).slice(0, 4000) } : {}),
  })
  return c
}

const scenarioResults = {}
const liveInstances = new Set()

process.on('exit', () => {
  for (const rec of [...liveInstances]) {
    try {
      if (rec.instance?.child !== undefined) rec.instance.child.kill()
    } catch { /* already dead */ }
  }
})

// ── runtime module resolution wiring (worktree node_modules only) ──────────
// The production row's DYNAMIC imports (seam.mjs, agent-bindings.mjs) load
// at boot, outside the static graph the dist import-probe covers. Their bare
// specifiers (@deepseek-ai/*, zod) resolve by the standard Node walk from
// the importing file. t12-vertical wires pnpm-style junctions in the
// worktree (packages/runtime/node_modules + packages/node_modules), each
// pointing at the host tree's pnpm hidden hoist entry; the host tree is
// never touched.
const RUNTIME_LINKS = [
  ['@deepseek-ai', 'dsh-agent'],
  ['@deepseek-ai', 'dsh-llm'],
  ['@deepseek-ai', 'dsh-mcp-client'],
  ['@deepseek-ai', 'dsh-session'],
  ['@deepseek-ai', 'dsh-storage-domain'],
  [null, 'zod'],
]
const PACKAGES_LINKS = [
  ['@deepseek-ai', 'dsh-agent'],
  ['@deepseek-ai', 'dsh-llm'],
  ['@deepseek-ai', 'dsh-mcp-client'],
  ['@deepseek-ai', 'dsh-session'],
  ['@deepseek-ai', 'dsh-storage-domain'],
  ['@deepseek-ai', 'dsh-scope'],
  ['@deepseek-ai', 'dsh-system-prompt'],
]

function ensureJunctions(base, links, logTag) {
  const hoist = join(HOST_TREE, 'node_modules', '.pnpm', 'node_modules')
  mkdirSync(base, { recursive: true })
  for (const [scope, name] of links) {
    const label = scope ? `${scope}/${name}` : name
    const target = scope ? join(hoist, scope, name) : join(hoist, name)
    if (!existsSync(target)) {
      throw new Error(`host tree pnpm hoist has no entry for ${label} at ${target} — cannot wire ${logTag} module links`)
    }
    const scopeDir = scope ? join(base, scope) : base
    mkdirSync(scopeDir, { recursive: true })
    const link = join(scopeDir, name)
    let st = null
    try {
      st = lstatSync(link)
    } catch { /* absent — create below */ }
    if (st !== null) {
      let ok = false
      try { ok = st.isSymbolicLink() && realpathSync(link) === realpathSync(target) } catch { ok = false }
      if (!ok) rmSync(link, { force: true, recursive: true })
      else continue
    }
    symlinkSync(target, link, 'junction')
    log(`${logTag} link: ${label} -> ${target}`)
  }
}

// ── durable session log access (discovery — never hardcoded ids) ───────────

/**
 * Decompress a multi-frame zstd stream (the durable session log format).
 * Each materialized append is a NEW zstd frame without a content size, and
 * node:zlib's zstdDecompressSync only decodes the FIRST frame — frames are
 * walked by magic and each chunk decompressed separately.
 */
function decompressZstdStream(buf) {
  const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
  const starts = []
  let off = 0
  for (;;) {
    const i = buf.indexOf(MAGIC, off)
    if (i === -1) break
    starts.push(i)
    off = i + 4
  }
  if (starts.length === 0) throw new Error('no zstd frame in stream')
  const bounds = [...starts, buf.length]
  const parts = []
  let pending = undefined
  for (let k = 0; k < bounds.length - 1; k++) {
    const chunk = buf.subarray(bounds[k], bounds[k + 1])
    const candidate = pending === undefined ? chunk : Buffer.concat([pending, chunk])
    try {
      parts.push(zstdDecompressSync(candidate))
      pending = undefined
    } catch {
      pending = candidate
    }
  }
  if (pending !== undefined) parts.push(zstdDecompressSync(pending))
  return Buffer.concat(parts)
}

function parseFirstJsonLine(buf) {
  const first = zstdDecompressSync(buf).toString('utf8').split('\n').find((l) => l !== '')
  if (first === undefined) return null
  try {
    return JSON.parse(first)
  } catch {
    return null
  }
}

/** Discover one session's durable log by header id (no hardcoded dirs). */
function findSessionFile(dshHome, sessionId) {
  if (sessionId === undefined || sessionId === null) return null
  const root = join(dshHome, 'sessions')
  if (!existsSync(root)) return null
  for (const entry of walk(root, [])) {
    if (!entry.name.endsWith('session.jsonl.zstd')) continue
    try {
      const buf = readFileSync(entry.path)
      const header = parseFirstJsonLine(buf)
      if (header && header.id === sessionId) return { file: entry.path, header, buffer: buf }
    } catch {
      // undecodable / not a session log — skip
    }
  }
  return null
}

/** The full durable log of one session as parsed JSON lines (or null). */
function readSessionLog(dshHome, sessionId) {
  const found = findSessionFile(dshHome, sessionId)
  if (found === null) return null
  const text = decompressZstdStream(found.buffer).toString('utf8')
  const lines = []
  for (const line of text.split('\n')) {
    if (line === '') continue
    try {
      lines.push(JSON.parse(line))
    } catch {
      lines.push({ unparsed: line.slice(0, 200) })
    }
  }
  return { lines, file: found.file, header: found.header }
}

/** Count durable session artifacts of one session id (double-registration check). */
function countSessionFiles(dshHome, sessionId) {
  if (sessionId === undefined || sessionId === null) return -1
  const root = join(dshHome, 'sessions')
  if (!existsSync(root)) return 0
  let n = 0
  for (const entry of walk(root, [])) {
    if (!entry.name.endsWith('session.jsonl.zstd')) continue
    try {
      const header = parseFirstJsonLine(readFileSync(entry.path))
      if (header?.id === sessionId) n += 1
    } catch { /* skip */ }
  }
  return n
}

/**
 * The last committed event seq of one session's durable log (the browser
 * client tracks this cursor; `session/page` takes it as `throughSeq` —
 * throughSeq -1 is NOT "whole log" on the page path: paginate() computes
 * end = min(throughSeq + 1, ...) = 0 for -1, i.e. an empty page
 * (upstream history.ts L65/L324)). Returns -1 when the log is absent/empty.
 */
function lastSeqOf(dshHome, sessionId) {
  const logRec = readSessionLog(dshHome, sessionId)
  if (logRec === null) return -1
  let last = -1
  for (const line of logRec.lines) {
    const seq = line?.seq
    if (typeof seq === 'number' && seq > last) last = seq
  }
  return last
}

/** Poll a session log until `predicate(line)` matches or the timeout passes. */
async function waitForLogLineJson(dshHome, sessionId, predicate, timeoutMs, intervalMs = 1000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const logRec = readSessionLog(dshHome, sessionId)
    if (logRec !== null) {
      for (const line of logRec.lines) {
        if (predicate(line)) return line
      }
    }
    if (Date.now() >= deadline) return null
    await new Promise((r) => setTimeout(r, intervalMs))
  }
}

// ── HTTP helpers (fetch, cookie auth, the public channels) ─────────────────

const fetchJson = async (url, init, timeoutMs) => {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  const text = await res.text()
  let body = null
  try {
    body = text === '' ? null : JSON.parse(text)
  } catch {
    body = { nonJsonBody: text.slice(0, 800) }
  }
  return { status: res.status, body }
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

/**
 * One browser-facing public Remote call: POST /team-remote/<method>.
 * Every call is appended to `remoteCallLedger` (the S7 zero-ensure window
 * check reads it).
 */
const remoteCallLedger = []
async function remoteCall(origin, cookie, method, params, version) {
  const entry = { at: new Date().toISOString(), method, version, status: null, body: null }
  remoteCallLedger.push(entry)
  const { status, body } = await fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `d4v2-${randomBytes(6).toString('hex')}`,
      method,
      payload: { version, params },
    }),
  }, 180_000)
  entry.status = status
  entry.body = body
  return { status, body }
}

/** One user turn on the DSH core public channel: POST /api/session/prompt. */
async function apiPrompt(origin, cookie, sessionId, text) {
  const { status, body } = await fetchJson(`${origin}/api/session/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `d4v2-${randomBytes(6).toString('hex')}`,
      method: 'session/prompt',
      payload: {
        args: {
          request: {
            requestId: `d4v2-${randomBytes(6).toString('hex')}`,
            sessionId,
            mode: 'queue',
            content: [{ type: 'text', text }],
          },
        },
      },
    }),
  }, 180_000)
  return { status, body }
}

/**
 * One native session-history page: POST /api/session/page. `throughSeq` is
 * the caller's last committed cursor (the browser client tracks it; the
 * page path is a backwards page from that cursor — throughSeq -1 yields an
 * EMPTY page, not the whole log: upstream history.ts paginate() sets
 * end = min(throughSeq + 1, ...) = 0 for -1). maxMessages bounds the
 * message-aligned page.
 */
async function apiPage(origin, cookie, sessionId, { throughSeq, maxMessages }) {
  const { status, body } = await fetchJson(`${origin}/api/session/page`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `d4v2-${randomBytes(6).toString('hex')}`,
      method: 'session/page',
      payload: {
        args: {
          request: {
            address: { kind: 'session', sessionId },
            throughSeq,
            maxMessages,
          },
        },
      },
    }),
  }, 60_000)
  return { status, body }
}

/** One shipped team tool through the pattern-sanctioned observability seam. */
async function p6t6Tool(port, name, args, as) {
  const { status, body } = await fetchJson(`http://127.0.0.1:${port}/__p6t6/tool`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, args, as }),
  }, 180_000)
  return { status, body }
}

async function p6t6Health(port) {
  const { status, body } = await fetchJson(`http://127.0.0.1:${port}/__p6t6/health`, undefined, 30_000)
  return { status, body }
}

/** Row state diagnostics (durable read-back of the row's config root). */
async function p6t6State(port) {
  const { status, body } = await fetchJson(`http://127.0.0.1:${port}/__p6t6/state`, undefined, 30_000)
  return { status, body }
}

/**
 * Wait for the row state to be well-formed for the expected root + phase
 * (the row's bootstrap is asynchronous with respect to the health gate).
 */
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
      throw new Error(`row state not well-formed within ${timeoutMs}ms (expected rootSessionId=${rootSessionId} phase=${phase}); last: status=${last.status} body=${JSON.stringify(last.body).slice(0, 500)}`)
    }
    await new Promise((r) => setTimeout(r, intervalMs))
    last = await p6t6State(port)
  }
}

/** Unwrap a browser-facing public Remote success value ({data, provenance}). */
function remoteValue(result, method) {
  if (result.status !== 200) throw new Error(`${method}: HTTP ${result.status}: ${JSON.stringify(result.body).slice(0, 400)}`)
  const r = result.body?.result
  if (r === undefined) throw new Error(`${method}: no result envelope: ${JSON.stringify(result.body).slice(0, 400)}`)
  if (r.ok !== true) throw new Error(`${method}: remote error: ${JSON.stringify(r.error ?? r).slice(0, 1200)}`)
  const v = r.value
  if (v && typeof v === 'object' && 'data' in v && 'provenance' in v) return v.data
  return v
}

/** Unwrap the observability-seam tool envelope: {ok:true, value}. */
function toolValue(result, name) {
  if (result.status !== 200) throw new Error(`${name}: HTTP ${result.status}: ${JSON.stringify(result.body).slice(0, 400)}`)
  if (result.body?.ok !== true) throw new Error(`${name}: tool error: ${JSON.stringify(result.body).slice(0, 1200)}`)
  const value = result.body.value
  if (value?.status === 'rejected') throw new Error(`${name}: rejected: ${JSON.stringify(value.effect ?? value).slice(0, 1200)}`)
  return value
}

// ── durable TeamDomain forensic reads (evidence; remote reads assert) ──────

function readTeamDomain(dshHome) {
  const file = join(dshHome, 'storages', 'team_domain.json')
  if (!existsSync(file)) return null
  const doc = JSON.parse(readFileSync(file, 'utf8'))
  const tables = doc?.tables ?? {}
  const parse = (v) => { try { return typeof v === 'string' ? JSON.parse(v) : v } catch { return null } }
  return {
    file,
    teamSessions: Object.fromEntries(Object.entries(tables.team_sessions ?? {}).map(([k, v]) => [k, parse(v)])),
    memberInstances: Object.fromEntries(Object.entries(tables.member_instances ?? {}).map(([k, v]) => [k, parse(v)])),
    sessionBindings: Object.fromEntries(Object.entries(tables.session_bindings ?? {}).map(([k, v]) => [k, parse(v)])),
  }
}

// ── the mock model's deterministic decide table ────────────────────────────

function makeDecide() {
  return (ctx) => {
    const body = ctx?.req ?? ctx
    const msgs = Array.isArray(body?.messages) ? body.messages : []
    const userMsgs = msgs.filter((m) => m && m.role === 'user')
    // Walk user messages NEWEST-FIRST: the turn marker of the current turn
    // is the one carried by the newest marker-bearing user message (later
    // turns' history still contains earlier markers, and the harness
    // appends a runtime-context snapshot as a separate user message after
    // the turn text on a session's first turn — durable-log fact:
    // session-d4v2-b-...-mtqbk47c94e592 seq 7/8). Title-generation side
    // calls echo all prior markers in their input JSON; newest-first gives
    // them the latest marker's ack, which is harmless (it becomes the
    // session title, not a turn reply).
    for (let i = userMsgs.length - 1; i >= 0; i--) {
      const m = userMsgs[i]
      const text = String(typeof m.content === 'string' ? m.content : JSON.stringify(m.content))
      for (const marker of [M3, M2, M1]) {
        if (text.includes(marker)) return { kind: 'text', content: `${marker}_ACK` }
      }
    }
    return { kind: 'text', content: `D4V2_DEFAULT_ACK_${NONCE}` }
  }
}

/**
 * Enumerate the agent tool table from the REAL agent model request that
 * carries `marker` in any user message (the public seam the repo tests use —
 * the model request's tools schema, t12-vertical V2 deferred checks).
 * Title-generation side calls ("Generate the session title ...") echo the
 * marker inside their input JSON and carry no tool schema — they are
 * skipped, and the request's tools array is read only from genuine agent
 * turn requests.
 */
function toolTableOf(mock, marker) {
  for (const r of [...mock.requests].reverse()) {
    const msgs = Array.isArray(r.body?.messages) ? r.body.messages : []
    const userMsgs = msgs.filter((m) => m && m.role === 'user')
    const userTexts = userMsgs
      .map((m) => String(typeof m.content === 'string' ? m.content : JSON.stringify(m.content)))
      .join('\n')
    if (!userTexts.includes(marker)) continue
    const lastUser = userMsgs.at(-1)
    const lastUserText = String(typeof lastUser?.content === 'string' ? lastUser.content : JSON.stringify(lastUser?.content))
    if (lastUserText.startsWith('Generate the session title')) continue
    const tools = Array.isArray(r.body?.tools) ? r.body.tools : []
    return {
      seq: r.seq,
      model: r.body?.model ?? null,
      toolNames: tools.map((t) => t?.function?.name).filter((n) => typeof n === 'string'),
      systemText: String(msgs.find((m) => m?.role === 'system')?.content ?? ''),
    }
  }
  return null
}

// ── world boot / stop (port 3180, the shared DSH_HOME) ─────────────────────

/**
 * The profile-patch row config for one boot. Both boots use the production
 * bundle phase 'create-or-open' (host.ts L800-840): boot 1 on this home
 * resolves to 'create' (the stamped domain lacks the ROOT_A identity), boot
 * 2 to 'resume' (the durable ROOT_A identity loads, never re-mints) — the
 * exact semantics a real installed row carries across restarts.
 */
function rowConfig(bootPhase) {
  return {
    rootSessionId: ROOT_A,
    bootPhase,
    blueprintSource: BLUEPRINT_DOC,
    seedMembers: [],
    defaultWorkspace: WORKSPACE,
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'd4v2-model' },
    deniedSelection: { provider: 'd4v2-denied', model: 'd4v2-denied' },
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

// ── profile-patch YAML emitter (hand-rolled, the DSH patch dialect — ──────
// ── byte-identical to the t12-vertical precedent) ─────────────────────────

function yamlScalar(v) {
  if (v === null) return 'null'
  if (typeof v === 'string') return JSON.stringify(v)
  return String(v)
}

function yamlValueLines(value, indent) {
  if (Array.isArray(value)) {
    return value.flatMap((item) => yamlEmitItem(item, indent))
  }
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
  if (item === null || typeof item !== 'object') {
    return [`${pad}- ${yamlScalar(item)}`]
  }
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
    '# D4 (Team D1-D6 repair v2) restart/reopen acceptance mount: production dsh-agent-team row (this worktree\'s committed D1-D3 dist) + observability p6t6-team-tools row, mounted ONLY through this public profile-patch seam.',
    '- insert:',
    ...yamlEmitItem({
      id: 'dsh-agent-team',
      name: PRODUCTION_ROW_NAME,
      config: rowConfig(bootPhase),
    }, 2),
    ...yamlEmitItem({
      id: 'p6t6-team-tools',
      name: P6T6_ROW_NAME,
    }, 2),
    '',
  ]
  writeFileSync(patchPath, lines.join('\n'))
}

async function bootInstance({ label, boot, bootPhase, directivePhase }) {
  const instLogDir = join(REPORT_DIR, 'instances', label)
  mkdirSync(instLogDir, { recursive: true })
  const instance = new DshInstance({
    hostTree: HOST_TREE,
    dshHome: DSH_HOME,
    port: PORT,
    clientCommitHash: CLIENT_COMMIT_HASH,
    logDir: instLogDir,
  })
  const rec = {
    label, boot, bootPhase, instance, logPath: null, url: null, token: null,
    cookie: null, origin: null, health: null, dumpPath: null, rowMounted: null,
  }
  const profile = await ensureProfile({ instance, log, timeoutMs: 120_000 })
  log(`${label}: profile ${profile.created ? 'created via throwaway boot' : 'already initialized'}`)
  writeTeamPatchFile(instance.patchFile, bootPhase)
  log(`${label}: patch layer written to ${instance.patchFile} (phase=${bootPhase})`)
  const directive = { boot, phase: directivePhase, reportDir: REPORT_DIR, runStamp: NONCE, rootSessionId: ROOT_A, mcpPort: null }
  writeFileSync(join(DSH_HOME, 'p6t6-directive.json'), JSON.stringify(directive, null, 2))
  log(`${label}: directive written (boot=${boot} phase=${directivePhase})`)
  const started = await instance.start({ timeoutMs: 240_000 })
  rec.url = started.url
  rec.logPath = started.logPath
  const token = started.url.slice(started.url.indexOf('token=') + 6).trim()
  rec.token = token
  rec.origin = `http://127.0.0.1:${PORT}`
  rec.cookie = await authenticate(rec.origin, token)
  log(`${label}: booted at ${rec.origin}; auth cookie exchanged`)
  const dump = await instance.dumpConfig({ timeoutMs: 60_000 })
  rec.dumpPath = join(instLogDir, 'dump-config.txt')
  writeFileSync(rec.dumpPath, dump.text)
  rec.rowMounted = {
    'dsh-agent-team': DshInstance.rowInDump(dump.text, { id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME }),
    'p6t6-team-tools': DshInstance.rowInDump(dump.text, { id: 'p6t6-team-tools', name: P6T6_ROW_NAME }),
  }
  // Row health gate (plugin ready + ten tool registrations).
  const deadline = Date.now() + 240_000
  for (;;) {
    const hb = await p6t6Health(PORT)
    rec.health = { status: hb.status, body: hb.body }
    if (hb.status === 200 && hb.body?.ok === true && hb.body?.toolCount === EXPECTED_TOOL_COUNT) break
    if (hb.status === 200 && hb.body?.ok === false && hb.body?.setupError !== undefined) {
      throw new Error(`${label}: row setup failed — setupError: ${String(hb.body.setupError).slice(0, 600)}; log tail:\n${logTail(rec.logPath, 25)}`)
    }
    if (Date.now() >= deadline) throw new Error(`${label}: row health not ready in 240s — health=${JSON.stringify(hb.body).slice(0, 500)}; log tail:\n${logTail(rec.logPath, 25)}`)
    await new Promise((r) => setTimeout(r, 1000))
  }
  log(`${label}: row ready — toolCount=${rec.health.body.toolCount} liveSessions=${JSON.stringify(rec.health.body.liveSessions)}`)
  liveInstances.add(rec)
  return rec
}

async function stopInstance(rec) {
  try {
    const res = await rec.instance.stop({ timeoutMs: 20_000 })
    log(`${rec.label}: stopped (killed=${res.killed} portFree=${res.portFree})`)
    return res.portFree === true
  } finally {
    liveInstances.delete(rec)
  }
}

// ── the scenario ───────────────────────────────────────────────────────────

async function main() {
  const t0 = Date.now()
  log(`== d4-restart-reopen ${new Date().toISOString()} (nonce ${NONCE}) ==`)
  log(`ROOT_A=${ROOT_A} ROOT_B=${ROOT_B} home=${DSH_HOME} port=${PORT}`)

  // ── S0: pre-flight ────────────────────────────────────────────────────────
  const s0 = makeScenarioCtx('S0 pre-flight: test-use pristine at the pinned SHA; :3080 only probed read-only; worktree D1-D3 dist import-probed; junction bridges wired')
  mkdirSync(join(REPORT_DIR, 'git'), { recursive: true })
  const preGit = await captureGitState(HOST_TREE, join(REPORT_DIR, 'git'))
  s0.evidence.testUsePre = { head: preGit.head, statusEmpty: preGit.statusEmpty, diffEmpty: preGit.diffEmpty, errors: preGit.errors }
  s0.check('test-use HEAD == 76fda729 (the pinned audit baseline)', preGit.head === EXPECTED_HOST_SHA, `head=${preGit.head}`)
  s0.check('test-use git status --porcelain empty (pre)', preGit.statusEmpty, `status=${JSON.stringify(preGit.status.slice(0, 300))}`)
  const stablePre = await fetchJson(STABLE_URL, undefined, 10_000).catch((e) => ({ status: null, body: String(e) }))
  s0.evidence.stablePre = { url: STABLE_URL, httpStatus: stablePre.status }
  s0.check('stable :3080 reachable read-only (pre; NO interaction)', stablePre.status !== null, `status=${stablePre.status}`)
  // dist sanity (D4 changes no install surface; the D3 commit carries the
  // built artifacts — verify the row entry + glue + v3 handler files exist
  // and the dist row loads under plain node, t12-vertical import-probe form,
  // file-fd stdio per repo discipline).
  const distFiles = {
    'plugin/host.js': existsSync(join(WORKTREE_ROOT, 'packages/runtime/dist/packages/runtime/src/plugin/host.js')),
    'plugin/root.js': existsSync(join(WORKTREE_ROOT, 'packages/runtime/dist/packages/runtime/src/plugin/root.js')),
    'plugin/s6-remote.js': existsSync(join(WORKTREE_ROOT, 'packages/runtime/dist/packages/runtime/src/plugin/s6-remote.js')),
    'plugin/live/agent-bindings.mjs': existsSync(join(WORKTREE_ROOT, 'packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs')),
  }
  s0.evidence.distFiles = distFiles
  s0.check('worktree dist carries the D1-D3 build artifacts (host/root/s6-remote/glue)', Object.values(distFiles).every(Boolean), JSON.stringify(distFiles))
  const probe = await spawnToLog(
    process.execPath,
    ['-e', `import(${JSON.stringify(PRODUCTION_ROW_NAME)}).then(m => console.log('LOADED name=' + m.name)).catch(e => { console.error('PROBE_FAIL ' + e.message); process.exit(1) })`],
    { cwd: WORKTREE_ROOT, logPath: join(REPORT_DIR, 'dist-import-probe.log'), timeoutMs: 120_000 },
  )
  s0.check('dist import probe: the D1-D3 dist row loads under plain node', probe.ok && probe.text.includes('LOADED name=dsh-agent-team'), probe.text.trim().split('\n').slice(-3).join(' | ').slice(0, 400))
  ensureJunctions(join(WORKTREE_ROOT, 'packages', 'runtime', 'node_modules'), RUNTIME_LINKS, 'runtime')
  ensureJunctions(join(WORKTREE_ROOT, 'packages', 'node_modules'), PACKAGES_LINKS, 'packages')
  s0.check('junction bridges wired (worktree node_modules only; host tree untouched)', true, 'RUNTIME_LINKS + PACKAGES_LINKS')
  // Pre-state: the shared home's existing durable roots (preserved, not touched).
  const domainPre = readTeamDomain(DSH_HOME)
  s0.evidence.homePreExistingRoots = domainPre ? Object.keys(domainPre.teamSessions).sort() : null
  s0.note(`pre-existing durable roots in the shared home: ${JSON.stringify(s0.evidence.homePreExistingRoots)} (preserved; listed by listRoots after boot)`)
  scenarioResults.S0 = s0.finish()
  log(`S0: pass=${scenarioResults.S0.pass}`)
  if (!scenarioResults.S0.pass) throw new Error('S0 pre-flight failed — aborting before any host boot')

  // The deterministic model (in-process; the host reaches it via env only).
  const mock = await startMockModel({ port: 0, decide: makeDecide(), log: (l) => log(`mock: ${l}`) })
  // The mock serves POST /chat/completions (the dsh-llm deepseek adapter
  // appends the path itself — the t12-vertical precedent sets the base
  // WITHOUT a /v1 suffix).
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${mock.port}`
  process.env.DEEPSEEK_API_KEY = 'd4v2-mock-key'
  log(`mock model on 127.0.0.1:${mock.port}`)

  let inst1 = null
  let inst2 = null
  try {
    // ── S1: boot 1 + dynamic team root via remote team.create (step 1) ──────
    const s1 = makeScenarioCtx('S1 (step 1): boot 1 on the shared home (create-or-open resolves to create for the nonce row root ROOT_A) + dynamic team root ROOT_B via the browser-facing public remote channel team.create (contract v2) + a real Leader turn on ROOT_B')
    inst1 = await bootInstance({ label: 'BOOT1', boot: 1, bootPhase: 'create-or-open', directivePhase: 'create' })
    s1.evidence.boot1 = {
      url: inst1.url, logPath: inst1.logPath, rowMounted: inst1.rowMounted,
      health: { status: inst1.health.status, toolCount: inst1.health.body?.toolCount, liveSessions: inst1.health.body?.liveSessions },
    }
    s1.check('row mounted (production row + p6t6 observability row in the composed profile)', inst1.rowMounted?.['dsh-agent-team'] === true && inst1.rowMounted?.['p6t6-team-tools'] === true, JSON.stringify(inst1.rowMounted))
    s1.check('health: row ready with EXACTLY the ten team tool registrations (row level)', inst1.health.body?.toolCount === EXPECTED_TOOL_COUNT, `toolCount=${inst1.health.body?.toolCount}`)
    s1.check('live root agent ROOT_A materialized by the row create boot', (inst1.health.body?.liveSessions ?? []).includes(ROOT_A), JSON.stringify(inst1.health.body?.liveSessions))
    await p6t6StateReady(PORT, { rootSessionId: ROOT_A, phase: 'create' })
    // The dynamic root through the SAME channel the browser UI uses.
    const createRes = await remoteCall(inst1.origin, inst1.cookie, 'team.create', {
      rootSessionId: ROOT_B,
      blueprintId: BLUEPRINT_ID,
      blueprintRevision: BLUEPRINT_REVISION_NUM,
      workspace: WORKSPACE,
    }, 2)
    const created = remoteValue(createRes, 'team.create')
    s1.evidence.teamCreate = { status: createRes.status, value: created }
    s1.check('remote team.create (v2) minted the dynamic root ROOT_B', createRes.status === 200 && created?.durable !== undefined, JSON.stringify(created).slice(0, 400))
    // A real Leader turn on ROOT_B (the durable history the restart renders).
    const p1 = await apiPrompt(inst1.origin, inst1.cookie, ROOT_B, `first leader turn on the dynamic root: ${M1}`)
    s1.evidence.boot1Prompt = { status: p1.status, body: p1.body }
    s1.check('Leader prompt accepted on ROOT_B (browser-facing chat path)', p1.status === 200 && p1.body?.result?.ok === true, `status=${p1.status} body=${JSON.stringify(p1.body).slice(0, 300)}`)
    const ack1 = await waitForLogLineJson(DSH_HOME, ROOT_B, (l) => l?.type === 'assistant/message' && JSON.stringify(l.data?.message?.content ?? '').includes(`${M1}_ACK`), 180_000)
    s1.check('boot-1 turn settled (the assistant message carrying the mock ack is durable in ROOT_B)', ack1 !== null, ack1 === null ? 'no assistant ack within 180s' : 'assistant ack present')
    const t1 = toolTableOf(mock, M1)
    s1.evidence.toolTableBoot1 = t1
    s1.check('baseline: the ten team_* tools are registered on the live ROOT_B agent (model request tool schema)',
      t1 !== null && TEAM_TOOLS.every((n) => t1.toolNames.includes(n)),
      t1 === null ? 'no model request carried the marker' : `tools=${JSON.stringify(t1.toolNames)}`)
    s1.note(`ROOT_B agent tool table at boot 1 (${t1?.toolNames.length} tools): ${JSON.stringify(t1?.toolNames ?? [])}`)
    scenarioResults.S1 = s1.finish()
    log(`S1: pass=${scenarioResults.S1.pass}`)

    // ── S2: durable rows + native session artifacts (step 2) ───────────────
    const s2 = makeScenarioCtx('S2 (step 2): root/member durable rows (row state route + v3 team.listRoots + team_domain.json forensic read) and the native session artifacts of ROOT_A/ROOT_B')
    const st1 = await p6t6State(PORT)
    s2.evidence.rowStateRootA = { status: st1.status, body: st1.body }
    s2.check('row state: ROOT_A TeamSession durable row + Leader member row', st1.body?.teamSession?.rootSessionId === ROOT_A && Array.isArray(st1.body?.members) && st1.body.members.some((m) => m?.instanceId === LEADER_INSTANCE_ID), `members=${JSON.stringify((st1.body?.members ?? []).map((m) => m?.instanceId))}`)
    const roots1Res = await remoteCall(inst1.origin, inst1.cookie, 'team.listRoots', {}, 3)
    const roots1 = remoteValue(roots1Res, 'team.listRoots')
    const roots1List = roots1?.roots
    s2.evidence.listRootsBoot1 = { status: roots1Res.status, roots: roots1List }
    const rootIds1 = Array.isArray(roots1List) ? roots1List.map((r) => r?.rootSessionId).sort() : []
    s2.check('team.listRoots (v3) enumerates BOTH new roots + the pre-existing home roots (multi-root, read-only host authority)',
      Array.isArray(roots1List) && [ROOT_A, ROOT_B, ...(s0.evidence.homePreExistingRoots ?? [])].every((id) => rootIds1.includes(id)),
      `roots=${JSON.stringify(rootIds1)}`)
    const wireRow = (list, id) => (list ?? []).find((r) => r?.rootSessionId === id)
    const wireA1 = wireRow(roots1List, ROOT_A)
    const wireB1 = wireRow(roots1List, ROOT_B)
    const wireOk = (row) => row !== undefined
      && typeof row.blueprintId === 'string' && typeof row.revision === 'string'
      && typeof row.createdAt === 'string' && typeof row.generation === 'number'
      && typeof row.memberCount === 'number'
    s2.check('ROOT_A wire row carries the closed v3 shape {rootSessionId, blueprintId, revision, defaultWorkspace?, createdAt, generation, memberCount}', wireOk(wireA1), JSON.stringify(wireA1))
    s2.check('ROOT_B wire row carries the closed v3 shape (the dynamic root is indexed like any durable root)', wireOk(wireB1) && wireB1.blueprintId === BLUEPRINT_ID, JSON.stringify(wireB1))
    s2.check('ROOT_B memberCount excludes the Leader (zero seeded members)', wireB1?.memberCount === 0, `memberCount=${wireB1?.memberCount}`)
    const domainAfterCreate = readTeamDomain(DSH_HOME)
    const domRow = (rootId) => domainAfterCreate?.teamSessions?.[rootId]
    const domLeader = (rootId) => domainAfterCreate?.memberInstances?.[JSON.stringify({ instanceId: LEADER_INSTANCE_ID, rootSessionId: rootId })]
    const domBinding = (rootId) => domainAfterCreate?.sessionBindings?.[rootId]
    s2.evidence.durableRows = {
      ROOT_A: { teamSession: domRow(ROOT_A), leader: domLeader(ROOT_A), binding: domBinding(ROOT_A) },
      ROOT_B: { teamSession: domRow(ROOT_B), leader: domLeader(ROOT_B), binding: domBinding(ROOT_B) },
    }
    s2.check('team_domain.json: ROOT_A TeamSession + Leader row + team-root binding durable',
      domRow(ROOT_A)?.blueprint?.blueprintId === BLUEPRINT_ID && domLeader(ROOT_A)?.schemaVersion === 2 && domBinding(ROOT_A)?.kind === 'team-root',
      JSON.stringify(s2.evidence.durableRows.ROOT_A).slice(0, 500))
    s2.check('team_domain.json: ROOT_B TeamSession + Leader row + team-root binding durable (the remote create path writes the same canonical rows)',
      domRow(ROOT_B)?.blueprint?.blueprintId === BLUEPRINT_ID && domLeader(ROOT_B)?.schemaVersion === 2 && domBinding(ROOT_B)?.kind === 'team-root',
      JSON.stringify(s2.evidence.durableRows.ROOT_B).slice(0, 500))
    const hdrA = findSessionFile(DSH_HOME, ROOT_A)
    const hdrB = findSessionFile(DSH_HOME, ROOT_B)
    s2.evidence.sessionArtifacts = {
      ROOT_A: hdrA === null ? null : { file: hdrA.file, cwd: hdrA.header?.cwd, id: hdrA.header?.id },
      ROOT_B: hdrB === null ? null : { file: hdrB.file, cwd: hdrB.header?.cwd, id: hdrB.header?.id },
    }
    s2.check('native session artifact for ROOT_A under DSH_HOME (real Root Agent session)', hdrA !== null, hdrA?.file ?? '<not found>')
    s2.check('native session artifact for ROOT_B under DSH_HOME (the dynamic root is a real DSH session)', hdrB !== null, hdrB?.file ?? '<not found>')
    s2.check('ROOT_B session header cwd == the row default workspace (session meta, not projection)', hdrB?.header?.cwd === WORKSPACE, `cwd=${hdrB?.header?.cwd}`)
    scenarioResults.S2 = s2.finish()
    log(`S2: pass=${scenarioResults.S2.pass}`)

    // ── S3: clean stop of the test host (step 3) ───────────────────────────
    const s3 = makeScenarioCtx('S3 (step 3): the test host stops cleanly and port 3180 is free')
    const stopped1 = await stopInstance(inst1)
    inst1 = null
    s3.evidence.stop = { portFree: stopped1 }
    s3.check('instance 1 stopped and port 3180 free', stopped1 === true, `portFree=${stopped1}`)
    scenarioResults.S3 = s3.finish()
    log(`S3: pass=${scenarioResults.S3.pass}`)

    // ── S4: restart with the SAME shared DSH_HOME (step 4) ─────────────────
    const s4 = makeScenarioCtx('S4 (step 4): RESTART on the same references/.dsh-test (create-or-open now resolves to resume; the row re-activates its config root ROOT_A only; ROOT_B stays cold) and the D1 index rebuilds byte-identically')
    remoteCallLedger.length = 0
    inst2 = await bootInstance({ label: 'BOOT2', boot: 2, bootPhase: 'create-or-open', directivePhase: 'resume' })
    s4.evidence.boot2 = {
      url: inst2.url, logPath: inst2.logPath, rowMounted: inst2.rowMounted,
      health: { status: inst2.health.status, toolCount: inst2.health.body?.toolCount, liveSessions: inst2.health.body?.liveSessions },
    }
    s4.check('row mounted again (both rows)', inst2.rowMounted?.['dsh-agent-team'] === true && inst2.rowMounted?.['p6t6-team-tools'] === true, JSON.stringify(inst2.rowMounted))
    s4.check('health: row ready with the ten tool registrations after restart', inst2.health.body?.toolCount === EXPECTED_TOOL_COUNT, `toolCount=${inst2.health.body?.toolCount}`)
    const st2 = await p6t6StateReady(PORT, { rootSessionId: ROOT_A, phase: 'resume' })
    s4.evidence.rowStateRootAResume = { status: st2.status, teamSession: st2.body?.teamSession, members: (st2.body?.members ?? []).map((m) => m?.instanceId) }
    s4.check('row state after restart: ROOT_A phase=resume with the SAME durable TeamSession id (a resume loads, never re-mints)', st2.body?.phase === 'resume' && st2.body?.teamSession?.rootSessionId === ROOT_A, JSON.stringify(st2.body?.teamSession).slice(0, 300))
    const liveAfterBoot2 = inst2.health.body?.liveSessions ?? []
    s4.check('the row resume boot re-activated its config root ROOT_A live (row semantics)', liveAfterBoot2.includes(ROOT_A), JSON.stringify(liveAfterBoot2))
    s4.check('ROOT_B is COLD after the restart (the D2 ensure precondition: the row re-activates only its config root)', !liveAfterBoot2.includes(ROOT_B), JSON.stringify(liveAfterBoot2))
    const roots2Res = await remoteCall(inst2.origin, inst2.cookie, 'team.listRoots', {}, 3)
    const roots2 = remoteValue(roots2Res, 'team.listRoots')
    const roots2List = roots2?.roots
    const wireA2 = wireRow(roots2List, ROOT_A)
    const wireB2 = wireRow(roots2List, ROOT_B)
    s4.evidence.listRootsBoot2 = { status: roots2Res.status, roots: roots2List }
    s4.check('team.listRoots after restart still enumerates both new roots + the pre-existing home roots', Array.isArray(roots2List) && [ROOT_A, ROOT_B, ...(s0.evidence.homePreExistingRoots ?? [])].every((id) => roots2List.map((r) => r?.rootSessionId).includes(id)), `roots=${JSON.stringify(roots2List?.map((r) => r?.rootSessionId))}`)
    const identicalA = JSON.stringify(wireA1) === JSON.stringify(wireA2)
    const identicalB = JSON.stringify(wireB1) === JSON.stringify(wireB2)
    s4.check('D1 index rebuild: the ROOT_A wire row is BYTE-IDENTICAL across the restart (same durable rows, same index)', identicalA, `boot1=${JSON.stringify(wireA1)} boot2=${JSON.stringify(wireA2)}`)
    s4.check('D1 index rebuild: the ROOT_B wire row is BYTE-IDENTICAL across the restart', identicalB, `boot1=${JSON.stringify(wireB1)} boot2=${JSON.stringify(wireB2)}`)
    scenarioResults.S4 = s4.finish()
    log(`S4: pass=${scenarioResults.S4.pass}`)

    // ── S5: open ROOT_B in Team mode (step 5) ──────────────────────────────
    const s5 = makeScenarioCtx('S5 (step 5): the Team UI "以 Team 模式打开" entry for ROOT_B — the D2 openTeamMode phase (a): the v3 team.ensureRootLive cold-ensures the durable root through the live glue (A3 Q1/Q2); phase (b): the native session open (session/page)')
    const ensure1 = await remoteCall(inst2.origin, inst2.cookie, 'team.ensureRootLive', { teamSessionId: ROOT_B }, 3)
    s5.evidence.ensureRootLive1 = { status: ensure1.status, body: ensure1.body }
    let ensure1Value = null
    let ensure1Error = null
    try {
      ensure1Value = remoteValue(ensure1, 'team.ensureRootLive')
    } catch (error) {
      ensure1Error = String(error)
    }
    s5.check('team.ensureRootLive (v3) on the COLD root succeeds with the closed shape {rootSessionId, mode:"team", live:true}',
      ensure1Error === null && ensure1Value?.rootSessionId === ROOT_B && ensure1Value?.mode === 'team' && ensure1Value?.live === true,
      ensure1Error ?? JSON.stringify(ensure1Value))
    const seqBeforeOpen = lastSeqOf(DSH_HOME, ROOT_B)
    s5.check('the durable ROOT_B log has a committed cursor to page from (the boot-1 turn is durable before the open)', seqBeforeOpen >= 0, `lastSeq=${seqBeforeOpen}`)
    const page1 = await apiPage(inst2.origin, inst2.cookie, ROOT_B, { throughSeq: seqBeforeOpen, maxMessages: 100 })
    s5.evidence.openPage = { status: page1.status, bodyJson: JSON.stringify(page1.body).slice(0, 600) }
    s5.check('the native open (session/page) of ROOT_B succeeds after the ensure', page1.status === 200 && page1.body?.result?.ok === true, `status=${page1.status}`)
    scenarioResults.S5 = s5.finish()
    log(`S5: pass=${scenarioResults.S5.pass}`)

    // ── S6: history / Leader prompt / tool table / real tool call (step 6) ─
    const s6 = makeScenarioCtx('S6 (step 6): VERIFY — root history renders, the Leader prompt is reachable, the ten team_* tools are registered on the live root agent, and a REAL team_* tool call executes on the restarted host')
    const pageJson = JSON.stringify(page1.body)
    const nRecords = (page1.body?.result?.value?.records ?? []).length
    s6.check('root history renders: the boot-1 user turn comes back through session/page', pageJson.includes(M1), pageJson.includes(M1) ? `records=${nRecords}` : 'marker missing from the page response')
    s6.check('root history renders: the boot-1 assistant reply (mock ack) comes back too', pageJson.includes(`${M1}_ACK`), pageJson.includes(`${M1}_ACK`) ? `records=${nRecords}` : 'ack missing from the page response')
    const p2 = await apiPrompt(inst2.origin, inst2.cookie, ROOT_B, `leader turn after the Team-mode open on the restarted host: ${M2}`)
    s6.evidence.boot2Prompt = { status: p2.status, body: p2.body }
    s6.check('the Leader prompt is reachable on the restarted host (session/prompt accepted)', p2.status === 200 && p2.body?.result?.ok === true, `status=${p2.status} body=${JSON.stringify(p2.body).slice(0, 300)}`)
    const ack2 = await waitForLogLineJson(DSH_HOME, ROOT_B, (l) => l?.type === 'assistant/message' && JSON.stringify(l.data?.message?.content ?? '').includes(`${M2}_ACK`), 180_000)
    s6.check('the post-restart Leader turn settles (assistant ack durable in the log)', ack2 !== null, ack2 === null ? 'no assistant ack within 180s' : 'assistant ack present')
    const t2 = toolTableOf(mock, M2)
    s6.evidence.toolTableBoot2 = t2
    s6.check('the ten team_* tools are registered on the LIVE root agent after the ensure (model request tool schema)',
      t2 !== null && TEAM_TOOLS.every((n) => t2.toolNames.includes(n)),
      t2 === null ? 'no model request carried the marker' : `tools=${JSON.stringify(t2.toolNames)}`)
    s6.check('the scoped root Team context block is installed on the live agent (persona seam)', t2 !== null && t2.systemText.includes('rootSessionId') && t2.systemText.includes(ROOT_B), `systemExcerpt=${(t2?.systemText ?? '<none>').slice(0, 200)}`)
    const toolCall1 = await p6t6Tool(PORT, 'team_list_members', { rootSessionId: ROOT_B, requestToken: `d4v2-list-1-${NONCE}` }, ROOT_B)
    s6.evidence.teamToolCall1 = { status: toolCall1.status, body: toolCall1.body }
    let toolCall1Value = null
    let toolCall1Error = null
    try {
      toolCall1Value = toolValue(toolCall1, 'team_list_members')
    } catch (error) {
      toolCall1Error = String(error)
    }
    s6.check('a REAL team_* tool call (team_list_members) executes successfully on the restarted host',
      toolCall1Error === null && toolCall1Value !== null && JSON.stringify(toolCall1Value).includes(LEADER_INSTANCE_ID),
      toolCall1Error ?? JSON.stringify(toolCall1Value).slice(0, 400))
    scenarioResults.S6 = s6.finish()
    log(`S6: pass=${scenarioResults.S6.pass}`)

    // ── S7: explicit ordinary-mode open (step 7) ───────────────────────────
    const s7 = makeScenarioCtx('S7 (step 7): the explicit "以普通模式打开" entry — a pure native session load with ZERO team.* remote calls (no ensure-live); the ordinary entry does not strip the live Team agent (documented A3 caveat: no team_* promise, no removal)')
    const ensureCallsBefore = remoteCallLedger.filter((e) => e.method === 'team.ensureRootLive').length
    const seqOrdinaryOpen = lastSeqOf(DSH_HOME, ROOT_B)
    const page2 = await apiPage(inst2.origin, inst2.cookie, ROOT_B, { throughSeq: seqOrdinaryOpen, maxMessages: 100 })
    s7.evidence.ordinaryOpenPage = { status: page2.status, bodyJson: JSON.stringify(page2.body).slice(0, 400) }
    s7.check('the ordinary entry loads the same session (session/page succeeds, no team remote involved)', page2.status === 200 && page2.body?.result?.ok === true, `status=${page2.status}`)
    const p3 = await apiPrompt(inst2.origin, inst2.cookie, ROOT_B, `turn after the explicit ordinary open (adoption evidence, not a team promise): ${M3}`)
    s7.evidence.afterOrdinaryPrompt = { status: p3.status, body: p3.body }
    s7.check('the session remains usable through the ordinary entry (Leader turn accepted)', p3.status === 200 && p3.body?.result?.ok === true, `status=${p3.status} body=${JSON.stringify(p3.body).slice(0, 300)}`)
    const ack3 = await waitForLogLineJson(DSH_HOME, ROOT_B, (l) => l?.type === 'assistant/message' && JSON.stringify(l.data?.message?.content ?? '').includes(`${M3}_ACK`), 180_000)
    s7.check('the post-ordinary-open turn settles', ack3 !== null, ack3 === null ? 'no ack within 180s' : 'ack present')
    const ensureCallsAfter = remoteCallLedger.filter((e) => e.method === 'team.ensureRootLive').length
    s7.check('NO ensure-live remote call occurred during the ordinary-mode window (the D3 explicit-ordinary semantics)', ensureCallsAfter === ensureCallsBefore, `ensureRootLive calls before=${ensureCallsBefore} after=${ensureCallsAfter}`)
    const t3 = toolTableOf(mock, M3)
    s7.evidence.toolTableAfterOrdinary = t3
    s7.note('client-side mode badge ("ordinary" shown; "team" only after a completed openTeamMode) is pinned by the committed client unit tests packages/client/test/d3-open-ordinary-mode.test.ts + d2-open-team-mode.test.ts — cited, not re-claimed here')
    if (t3 !== null && TEAM_TOOLS.every((n) => t3.toolNames.includes(n))) {
      s7.note('A3 documented caveat (recorded, NOT a promise): the ordinary entry adopts the already-live Team agent (upstream live-first resolve), so the ten team_* tools REMAIN registered on this live agent; the ordinary entry guarantees no team_* availability — it simply performs no Team ensure')
    }
    scenarioResults.S7 = s7.finish()
    log(`S7: pass=${scenarioResults.S7.pass}`)

    // ── S8: switch back to Team mode — no double registration (step 8) ─────
    const s8 = makeScenarioCtx('S8 (step 8): switch BACK to Team mode — the second team.ensureRootLive is a no-op adoption (the live glue returns the existing agent; a second agents.resume would have surfaced the upstream already-registered rejection as typed OUTSIDE_TEAM); the agents registry holds exactly one agent for the root session id; no second durable session; the Team setup re-takes over')
    const ensure2 = await remoteCall(inst2.origin, inst2.cookie, 'team.ensureRootLive', { teamSessionId: ROOT_B }, 3)
    s8.evidence.ensureRootLive2 = { status: ensure2.status, body: ensure2.body }
    let ensure2Value = null
    let ensure2Error = null
    try {
      ensure2Value = remoteValue(ensure2, 'team.ensureRootLive')
    } catch (error) {
      ensure2Error = String(error)
    }
    s8.check('the second ensureRootLive SUCCEEDS with the closed v3 shape (no-op adoption — NOT a second setup; a double registration attempt would have failed typed OUTSIDE_TEAM/START_FAILED)',
      ensure2Error === null && ensure2Value?.rootSessionId === ROOT_B && ensure2Value?.mode === 'team' && ensure2Value?.live === true,
      ensure2Error ?? JSON.stringify(ensure2Value))
    const hb8 = await p6t6Health(PORT)
    s8.evidence.healthAfterSwitchBack = { status: hb8.status, liveSessions: hb8.body?.liveSessions, toolCount: hb8.body?.toolCount }
    const live8 = hb8.body?.liveSessions ?? []
    s8.check('the agents registry holds EXACTLY one agent for the root session id (liveSessions contains ROOT_B once)', live8.filter((s) => s === ROOT_B).length === 1, JSON.stringify(live8))
    const artifacts = countSessionFiles(DSH_HOME, ROOT_B)
    s8.evidence.rootBSessionArtifacts = artifacts
    s8.check('exactly ONE durable session artifact for ROOT_B (no second session minted by the switch)', artifacts === 1, `count=${artifacts}`)
    const toolCall2 = await p6t6Tool(PORT, 'team_list_members', { rootSessionId: ROOT_B, requestToken: `d4v2-list-2-${NONCE}` }, ROOT_B)
    s8.evidence.teamToolCall2 = { status: toolCall2.status, body: toolCall2.body }
    let toolCall2Ok = false
    let toolCall2Detail = ''
    try {
      const v2 = toolValue(toolCall2, 'team_list_members')
      toolCall2Ok = v2 !== null && JSON.stringify(v2).includes(LEADER_INSTANCE_ID)
      toolCall2Detail = JSON.stringify(v2).slice(0, 300)
    } catch (error) {
      toolCall2Detail = String(error).slice(0, 300)
    }
    s8.check('the Team setup re-takes over: a real team_list_members call still succeeds after the switch back', toolCall2Ok, toolCall2Detail)
    scenarioResults.S8 = s8.finish()
    log(`S8: pass=${scenarioResults.S8.pass}`)
  } catch (error) {
    log(`FATAL: ${error instanceof Error ? error.stack : String(error)}`)
    scenarioResults.FATAL = { pass: false, error: String(error?.message ?? error).slice(0, 4000) }
  } finally {
    // ── cleanup: stop every live instance, free the port, dump evidence ────
    const cleanup = makeScenarioCtx('cleanup: the test host is stopped, port 3180 is free, the mock model is closed, and test-use is still pristine at the pinned SHA')
    for (const rec of [inst1, inst2]) {
      if (rec !== null && liveInstances.has(rec)) await stopInstance(rec)
    }
    try {
      await mock.close()
    } catch { /* mock already closed */ }
    const portFreeFinal = await waitForPortFree(PORT, 15_000)
    cleanup.evidence.port3180FreeAtEnd = portFreeFinal
    cleanup.check('no host process left on port 3180', portFreeFinal === true, `portFree=${portFreeFinal}`)
    const stablePost = await fetchJson(STABLE_URL, undefined, 10_000).catch((e) => ({ status: null, body: String(e) }))
    cleanup.evidence.stablePost = { url: STABLE_URL, httpStatus: stablePost.status }
    cleanup.check('stable :3080 reachable read-only (post; never touched)', stablePost.status !== null, `status=${stablePost.status}`)
    const postGit = await (async () => {
      mkdirSync(join(REPORT_DIR, 'git-post'), { recursive: true })
      return await captureGitState(HOST_TREE, join(REPORT_DIR, 'git-post'))
    })()
    cleanup.evidence.testUsePost = { head: postGit.head, statusEmpty: postGit.statusEmpty, diffEmpty: postGit.diffEmpty, errors: postGit.errors }
    cleanup.check('test-use HEAD still 76fda729 (post)', postGit.head === EXPECTED_HOST_SHA, `head=${postGit.head}`)
    cleanup.check('test-use git status --porcelain still empty (post — the tree was only read/booted, never written)', postGit.statusEmpty, `status=${JSON.stringify(postGit.status.slice(0, 300))}`)
    cleanup.check('test-use git diff still empty (post)', postGit.diffEmpty, `diff=${JSON.stringify(postGit.diff.slice(0, 300))}`)
    writeFileSync(join(REPORT_DIR, 'mock-capture.json'), JSON.stringify({ port: mock.port, requestCount: mock.requests.length, requests: mock.requests }, null, 2))
    scenarioResults.CLEANUP = cleanup.finish()
    log(`CLEANUP: pass=${scenarioResults.CLEANUP.pass}`)
  }

  // ── summary ──────────────────────────────────────────────────────────────
  const summary = {
    task: 'D4 (Team D1-D6 repair v2, Wave D — restart/reopen Team UI acceptance)',
    nonce: NONCE,
    startedAt: new Date(t0).toISOString(),
    finishedAt: new Date().toISOString(),
    durationMs: Date.now() - t0,
    host: {
      source: HOST_TREE,
      hostSha: EXPECTED_HOST_SHA,
      dshHome: DSH_HOME,
      port: PORT,
      worktree: WORKTREE_ROOT,
      rowDist: PRODUCTION_ROW_NAME,
    },
    roots: { ROOT_A, ROOT_B, blueprintId: BLUEPRINT_ID },
    scenarios: scenarioResults,
    pass: Object.values(scenarioResults).every((s) => s.pass === true),
    boundary: {
      statement: 'the ordinary SESSION LIST open is NOT auto-Team (plan §12 D4 不测试/不宣称). This run exercised ONLY: the row create/resume boot of ROOT_A (row semantics, its config root); the dynamic ROOT_B created via the browser-facing public remote channel team.create (v2); the explicit Team-mode entry (team.ensureRootLive v3 x2 + session/page) on ROOT_B; and the explicit ordinary-mode entry (session/page, zero team.* remote calls) on ROOT_B. No ordinary-list session was opened and NO team_* availability is claimed for the ordinary list.',
      entriesExercised: [
        `row create boot: ROOT_A=${ROOT_A} (bootPhase create-or-open -> create)`,
        `row resume boot: ROOT_A=${ROOT_A} (bootPhase create-or-open -> resume)`,
        `remote team.create (v2): ROOT_B=${ROOT_B}`,
        'remote team.ensureRootLive (v3): ROOT_B (S5 cold ensure + S8 switch-back adoption)',
        'remote team.listRoots (v3): host-authority read (S2 + S4)',
        'api/session/prompt: ROOT_B (S1 boot-1 turn, S6 post-Team-open turn, S7 post-ordinary-open turn)',
        'api/session/page: ROOT_B (S5 Team-mode native open, S7 ordinary native open)',
        'p6t6 observability: team_list_members tool calls on ROOT_B (S6, S8)',
      ],
      notExercised: ['ordinary session-list open of an arbitrary session (auto-Team not claimed, not tested)'],
    },
  }
  writeFileSync(join(REPORT_DIR, 'summary.json'), JSON.stringify(summary, null, 2))
  log(`== done: pass=${summary.pass} (duration ${(summary.durationMs / 1000).toFixed(1)}s) ==`)
  if (!summary.pass) process.exitCode = 1
}

main().catch((error) => {
  log(`FATAL main: ${error instanceof Error ? error.stack : String(error)}`)
  process.exitCode = 1
})
