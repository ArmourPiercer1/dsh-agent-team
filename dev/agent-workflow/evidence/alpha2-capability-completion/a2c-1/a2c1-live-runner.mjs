#!/usr/bin/env node
/**
 * a2c1-live-runner.mjs — LIVE PROOF runner for A2C-1 (pwsh parameter
 * permission), alpha.2 capability-completion, plan §5.8 equivalent
 * adaptation (Linux host, pwsh binary absent by construction — the body
 * failure is the permission-vs-body distinguisher).
 *
 * One DSH_HOME world (tests/homes/a2c1-live-<stamp>Z), SIX boots on
 * port 3183 (3180 family; 3181/3080 untouched):
 *
 *   boot#1 L1  static deny   (root a2c1-l1-root, directive create)
 *   boot#2 L2  ask -> deny   (root a2c1-l2-root, create)
 *   boot#3 L3  ask -> allow-once + second call (root a2c1-l3-root, create)
 *   boot#4 L4  builtinToolDeny:[pwsh] (root a2c1-l4-root, create)
 *   boot#5 L5a ask -> allow-once, durable rows, then PROCESS STOP
 *             (root a2c1-l5-root, create)
 *   boot#6 L5b COLD RESUME same home + same root (bootPhase
 *             create-or-open adopts the stamped domain; directive resume)
 *             -> persistence assertions + a fresh pwsh call re-enforced
 *
 * The dsh-agent-team plugin runs from the .worktrees/a2c-1 build
 * (production dist host row + live glue + seam + p6t6 observability row +
 * client shim — ALL through the public profile-patch seam; CORE PATCH
 * BUDGET 0; test-use tree never written).
 *
 * Model plane: the deterministic DeepSeek-compatible mock
 * (packages/tools/harness/mock-deepseek.mjs) on 127.0.0.1:3497, reached
 * ONLY through the host launch env (DEEPSEEK_BASE_URL/DEEPSEEK_API_KEY) —
 * every model call goes through the real dsh-llm-deepseek adapter + SSE +
 * agent loop + durable session log. The scripted decide() makes the
 * worker call `pwsh` (no real LLM choice involved).
 *
 * Member preset seam: row config memberPresetId = 'a2c1-pwsh' — a LOCAL
 * authored preset under <DSH_HOME>/.agent-presets/a2c1-pwsh/ (a copy of
 * the shipped `standard` preset with the tool-pwsh row ungated). The glue
 * mounts it on the member bind paths (agent-bindings.mjs L1167); the
 * shipped preset is never modified.
 *
 * Driven channels (all public):
 *   - POST /__p6t6/tool  {name:'team_create_member', args, as: ROOT}
 *   - POST /team-remote/member.send        (v1, human caller = bound root)
 *   - POST /team-remote/team.resolveControl (v4, human ingress)
 *   - POST /team-remote/team.getProjection / team.listRoots (reads)
 *   - GET  /__p6t6/state (durable read-back: members/teamSession/control)
 *
 * Evidence: live-boot-<stamp>.log (append), instances/bootN/{instance
 * log, dump-config.txt, mock-requests.json, state-<phase>.json},
 * live-legs-<stamp>.json, live-testuse-post-state.txt.
 */
import { appendFileSync, cpSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import net from 'node:net'
import { createHash, randomBytes } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { zstdDecompressSync } from 'node:zlib'

// ── paths ─────────────────────────────────────────────────────────────────
const EV = dirname(fileURLToPath(import.meta.url))
const WT = resolve(EV, '..', '..', '..', '..', '..') // .worktrees/a2c-1
const MAIN = resolve(WT, '..', '..') // repo root
if (!existsSync(join(MAIN, 'tests', 'deepseek-harness-test-use'))) {
  throw new Error(`no test-use checkout under ${MAIN} — path derivation broken`)
}
const HOST_TREE = join(MAIN, 'tests', 'deepseek-harness-test-use')
const HOME = join(MAIN, 'tests', 'homes', 'a2c1-live-20260912T162326Z')
const STAMP = '20260912T162326Z'
const CLIENT_COMMIT_HASH = 'a66e470204'

// Host file-policy knob for the test world ONLY (documented process fallback:
// apps/cli/reference/README.md — "DSH_PERMISSION_MODE changes the process
// fallback"; the harness's own e2e suite drives it exactly this way, e.g.
// apps/cli/tests/built-bin.e2e.ts:501, packages/subagent/subagent-acp/tests/
// subagent-acp.e2e.ts:38). This host has NO bubblewrap and no usable Landlock
// backend (verified live: the sandbox package refuses with "no sandbox backend
// is usable on this host" under the default workspace-write mode), so a body
// under the default workspace-write policy fails at the sandbox stage and
// never reaches the binary — the brief's expected ENOENT body signature is
// unreachable. danger-full-access pins the fresh-session default preset to a
// mode needing no confinement, so an ALLOWED body reaches spawn and fails on
// the missing pwsh binary exactly as the brief predicts on Linux. It does not
// touch the A2C-1 tool-permission layer (evaluated upstream, at the
// tool-call level) and is not asserted on; DshInstance.start inherits it via
// its `...process.env` spread.
process.env.DSH_PERMISSION_MODE = 'danger-full-access'

// The production row + glue point at an OUT-OF-TREE build of the worktree
// source (this evidence dir): the committed packages/runtime/dist predates
// the A2C-1 working-tree source (no 'pwsh' in PERMISSION_TOOL_NAMES, no
// pwsh lane rules, zero pwsh handling in the pre-execute adapter), so the
// committed build cannot even parse a blueprint carrying a pwsh permission
// rule. The build is byte-equivalent to the canonical pipeline
// (tsc -p packages/runtime/tsconfig.build.json + place-dist-glue.mjs) with
// only outDir redirected into the evidence dir — the worktree therefore
// stays exactly as the parent left it (no writes to tracked files).
const DIST_OUT = join(EV, 'dist-a2c1-build')
const PRODUCTION_ROW_NAME = pathToFileURL(join(DIST_OUT, 'packages', 'runtime', 'src', 'plugin', 'host.js')).href
const GLUE_URL = pathToFileURL(join(DIST_OUT, 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs')).href

/**
 * Ensure the out-of-tree dist carries the two layout artifacts the
 * canonical in-tree dist gets from its location (host.ts layout-candidate
 * contracts, production layout = "five up from host.js"):
 *   1. `<EV>/src/plugin/upstream-resolver.mjs` — registerUpstreamResolverOnce
 *      candidate #1 (five up from host.js's dir is EV). Symlinked to the
 *      worktree source file so the hook's import.meta.url stays the REAL
 *      path (its checkout discovery derives from its own location; the
 *      hook also only re-parents @deepseek-ai/* on resolution failure, and
 *      bare specifiers resolve normally from this tree).
 *   2. the frozen legacy reader mirror — loadLegacyInspect candidate #2
 *      (`<EV>/dist-a2c1-build/packages/legacy/session-reader/index.js`) and
 *      candidate #1 (`<EV>/dist/packages/legacy/...`). The legacy package
 *      is FROZEN (AGENTS.md: no vNext development; the committed runtime
 *      dist mirror is the authoritative built legacy), and A2C-1 does not
 *      touch it, so copying the committed mirror is the byte-faithful move.
 * Idempotent.
 */
function ensureDistLayout() {
  // 1. upstream-resolver symlink
  const resolverTarget = join(WT, 'packages', 'runtime', 'src', 'plugin', 'upstream-resolver.mjs')
  const resolverLink = join(EV, 'src', 'plugin', 'upstream-resolver.mjs')
  mkdirSync(dirname(resolverLink), { recursive: true })
  rmSync(resolverLink, { force: true })
  symlinkSync(resolverTarget, resolverLink)
  log(`dist-layout: upstream-resolver symlink ${resolverLink} -> ${resolverTarget}`)
  // 2. legacy reader mirror (both candidate depths)
  const legacySrc = join(WT, 'packages', 'runtime', 'dist', 'packages', 'legacy')
  for (const dest of [join(DIST_OUT, 'packages', 'legacy'), join(EV, 'dist', 'packages', 'legacy')]) {
    mkdirSync(dirname(dest), { recursive: true })
    rmSync(dest, { recursive: true, force: true })
    cpSync(legacySrc, dest, { recursive: true })
    log(`dist-layout: legacy reader mirror ${legacySrc} -> ${dest}`)
  }
}
const SEAM_URL = pathToFileURL(join(WT, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href
const P6T6_URL = pathToFileURL(join(WT, 'packages', 'tools', 'harness', 'plugin.mjs')).href
const CLIENT_URL = pathToFileURL(join(WT, 'packages', 'client', 'composition-shim', 'index.js')).href

const WEB_PORT = 3183
const MOCK_PORT = 3497
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=[A-Za-z0-9_-]+/

const NONCE = `a2c1${randomBytes(4).toString('hex')}`
const WORK = { root: join(HOME, 'work', 'root'), child: join(HOME, 'work', 'child') }

const { DshInstance, ensureProfile } = await import(pathToFileURL(join(MAIN, 'tests', 'characterization', 'lib', 'instance.mjs')).href)
const { waitForLogLine } = await import(pathToFileURL(join(MAIN, 'tests', 'characterization', 'lib', 'util.mjs')).href)
const { startMockModel } = await import(pathToFileURL(join(WT, 'packages', 'tools', 'harness', 'mock-deepseek.mjs')).href)
const { parseBlueprint } = await import(pathToFileURL(join(EV, 'dist-a2c1-build', 'packages', 'domain', 'blueprint', 'src', 'validate.js')).href)

const BOOT_LOG = join(EV, `live-boot-${STAMP}.log`)
const state = {
  stamp: STAMP, nonce: NONCE, home: HOME, webPort: WEB_PORT, mockPort: MOCK_PORT,
  legs: {}, boots: [],
}

function log(line) {
  const stamped = `[${new Date().toISOString()}] ${line}`
  console.log(stamped)
  appendFileSync(BOOT_LOG, `${stamped}\n`)
}

function die(msg) {
  log(`FATAL: ${msg}`)
  writeFileSync(join(EV, 'live-legs-live-proof-state.json'), JSON.stringify(state, null, 2))
  process.exit(1)
}

// ── YAML emitter (the DSH patch dialect; JSON strings are legal YAML
//    double-quoted scalars — same emitter the T12-vertical kit proved) ──────
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

// ── blueprints (a2c1 test shape; worker capabilities per leg) ──────────────
const CAPS_NO_POL = {
  teamTools: { kind: 'allow', items: [] },
  builtinToolDeny: [],
  skills: { kind: 'allow', items: [] },
  mcp: { kind: 'allow', items: [] },
}
const PWSH_DENY_POLICY = { default: 'deny', allow: [], ask: [], deny: [{ tool: 'pwsh', resource: { kind: 'any' } }] }
const PWSH_ASK_POLICY = { default: 'deny', allow: [], ask: [{ tool: 'pwsh', resource: { kind: 'any' } }], deny: [] }

function blueprintDoc(bpId, workerCaps) {
  // The worker template fields sit at 4-space indent under `members:`;
  // `capabilities` is emitted with the generic emitter (children at 6).
  const capLines = ['    capabilities:', ...yamlValueLines(workerCaps, 3)]
  return [
    '---',
    'schemaVersion: 1',
    `blueprintId: ${bpId}`,
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    `  persona: "A2C1 live leader: you lead the a2c1 ${bpId} live proof team."`,
    'members:',
    '  - templateId: worker',
    `    displayName: "A2C1 Worker ${bpId}"`,
    `    persona: "A2C1 live worker: deterministic pwsh operator for ${bpId}."`,
    ...capLines,
    'requirements:',
    '  - domain: tool',
    '    name: web',
    '    optional: true',
    // The LEADER's mutation envelope (T12 known-good shape + the A2C-1-era
    // ops): without it the leader's envelope is empty and team_create_member
    // fails closed with TEAM_RUNTIME_ENVELOPE_OUT_OF_BOUNDS. resolve-control
    // covers a leader acting as leader-approval resolver.
    'teamEnvelope:',
    '  allow:',
    '    - assign-task',
    '    - create-member',
    '    - send-message',
    '    - report-progress',
    '    - request-control',
    '    - resolve-control',
    '    - archive-member',
    '    - restore-member',
    '  deny:',
    '    - delete-team',
    // The WORKER's envelope must carry request-control: the ask path's
    // controlService.requestControl is a team op envelope-checked against
    // the CALLING member (without it the ask fails closed with
    // "operation 'request-control' ... outside the caller's mutation
    // envelope" and no control row is created).
    'memberEnvelopes:',
    '  - templateId: worker',
    '    envelope:',
    '      allow:',
    '        - request-control',
    '      deny: []',
    'policyStates:',
    '  - id: default',
    '    description: "The a2c1 default state."',
    'metadata: {}',
    '---',
    '',
  ].join('\n')
}

// ── leg table ─────────────────────────────────────────────────────────────
const LEGS = [
  {
    key: 'L1', bootNum: 1, root: 'a2c1-l1-root', bpId: 'a2c1-live-l1',
    directive: { boot: 1, phase: 'create' },
    workerCaps: { ...CAPS_NO_POL, permissions: PWSH_DENY_POLICY },
    policy: 'static deny (explicit deny rule pwsh any)',
  },
  {
    key: 'L2', bootNum: 2, root: 'a2c1-l2-root', bpId: 'a2c1-live-l2',
    directive: { boot: 1, phase: 'create' },
    workerCaps: { ...CAPS_NO_POL, permissions: PWSH_ASK_POLICY },
    policy: 'ask (pwsh any) -> resolve DENY',
  },
  {
    key: 'L3', bootNum: 3, root: 'a2c1-l3-root', bpId: 'a2c1-live-l3',
    directive: { boot: 1, phase: 'create' },
    workerCaps: { ...CAPS_NO_POL, permissions: PWSH_ASK_POLICY },
    policy: 'ask (pwsh any) -> resolve ALLOW once; second call (new callId) re-asks',
  },
  {
    key: 'L4', bootNum: 4, root: 'a2c1-l4-root', bpId: 'a2c1-live-l4',
    directive: { boot: 1, phase: 'create' },
    workerCaps: { ...CAPS_NO_POL, builtinToolDeny: ['pwsh'] },
    policy: 'builtinToolDeny:[pwsh] (no permissions policy)',
  },
  {
    key: 'L5a', bootNum: 5, root: 'a2c1-l5-root', bpId: 'a2c1-live-l5',
    directive: { boot: 1, phase: 'create' },
    workerCaps: { ...CAPS_NO_POL, permissions: PWSH_ASK_POLICY },
    policy: 'ask (pwsh any) -> resolve ALLOW once; durable rows; then process stop',
  },
  {
    key: 'L5b', bootNum: 6, root: 'a2c1-l5-root', bpId: 'a2c1-live-l5',
    directive: { boot: 2, phase: 'resume' },
    workerCaps: { ...CAPS_NO_POL, permissions: PWSH_ASK_POLICY },
    policy: 'COLD RESUME: same home + root (create-or-open adopts stamped domain)',
  },
]

// ── HTTP helpers ───────────────────────────────────────────────────────────
const fetchJson = async (url, init, timeoutMs) => {
  const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
  const text = await res.text()
  let body = null
  try { body = text === '' ? null : JSON.parse(text) } catch { body = { nonJsonBody: text.slice(0, 800) } }
  return { status: res.status, body }
}

async function authenticate(origin, token) {
  const res = await fetch(`${origin}/?token=${token}`, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
  const setCookie = res.headers.get('set-cookie')
  if (res.status !== 303 || setCookie === null) {
    throw new Error(`dsh web authentication returned HTTP ${res.status} (expected 303 + set-cookie)`)
  }
  return setCookie.split(';', 1)[0]
}

async function remoteCall(rec, method, params, version = 1, timeoutMs = 180_000) {
  const { status, body } = await fetchJson(`${rec.origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie: rec.cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `a2c1-${randomBytes(6).toString('hex')}`,
      method,
      payload: { version, params },
    }),
  }, timeoutMs)
  return { status, body }
}

function remoteValue(result, method) {
  if (result.status !== 200) throw new Error(`${method}: HTTP ${result.status}: ${JSON.stringify(result.body).slice(0, 400)}`)
  const r = result.body?.result
  if (r === undefined) throw new Error(`${method}: no result envelope: ${JSON.stringify(result.body).slice(0, 400)}`)
  if (r.ok !== true) throw new Error(`${method}: remote error: ${JSON.stringify(r.error ?? r).slice(0, 800)}`)
  const v = r.value
  if (v && typeof v === 'object' && 'data' in v && 'provenance' in v) return v.data
  return v
}

async function p6t6Tool(rec, name, args, as) {
  const { status, body } = await fetchJson(`http://127.0.0.1:${WEB_PORT}/__p6t6/tool`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, args, as }),
  }, 300_000)
  return { status, body }
}
function toolValue(result, name) {
  if (result.status !== 200) throw new Error(`${name}: HTTP ${result.status}: ${JSON.stringify(result.body).slice(0, 400)}`)
  if (result.body?.ok !== true) throw new Error(`${name}: tool error: ${JSON.stringify(result.body).slice(0, 800)}`)
  const value = result.body.value
  if (value?.status === 'rejected') throw new Error(`${name}: rejected: ${JSON.stringify(value.effect ?? value).slice(0, 800)}`)
  return value
}

async function p6t6State(rec) {
  const { status, body } = await fetchJson(`http://127.0.0.1:${WEB_PORT}/__p6t6/state`, undefined, 30_000)
  if (status !== 200 || body === null || typeof body !== 'object') return null
  return body
}
async function p6t6Health(rec) {
  const { status, body } = await fetchJson(`http://127.0.0.1:${WEB_PORT}/__p6t6/health`, undefined, 10_000)
  return { status, body }
}
async function p6t6StateReady(rec, { rootSessionId, phase, timeoutMs = 90_000 }) {
  const deadline = Date.now() + timeoutMs
  let last = null
  for (;;) {
    last = await p6t6State(rec)
    if (last !== null && last.rootSessionId === rootSessionId && last.phase === phase
      && last.teamSession !== null && last.teamSession.rootSessionId === rootSessionId) return last
    if (Date.now() >= deadline) throw new Error(`row state not well-formed within ${timeoutMs}ms (expected root=${rootSessionId} phase=${phase}); last: ${JSON.stringify(last)?.slice(0, 400)}`)
    await sleep(500)
  }
}

// ── durable session log access (multi-frame zstd; discovery by header id) ─
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
    try { parts.push(zstdDecompressSync(candidate)); pending = undefined } catch { pending = candidate }
  }
  if (pending !== undefined) parts.push(zstdDecompressSync(pending))
  return Buffer.concat(parts)
}
function* walk(dir) {
  let entries
  try { entries = readdirSync(dir, { withFileTypes: true }) } catch { return }
  for (const e of entries) {
    const p = join(dir, e.name)
    if (e.isDirectory()) yield* walk(p)
    else if (e.isFile()) yield { path: p, name: e.name }
  }
}
function parseFirstJsonLine(buf) {
  try {
    const first = zstdDecompressSync(buf).toString('utf8').split('\n').find((l) => l !== '')
    if (first === undefined) return null
    return JSON.parse(first)
  } catch { return null }
}
function findSessionFile(dshHome, sessionId) {
  const root = join(dshHome, 'sessions')
  if (!existsSync(root) || sessionId === undefined) return null
  for (const entry of walk(root)) {
    if (!entry.name.endsWith('session.jsonl.zstd')) continue
    try {
      const header = parseFirstJsonLine(readFileSync(entry.path))
      if (header && header.id === sessionId) return { file: entry.path, header }
    } catch { /* skip */ }
  }
  return null
}
function readSessionLog(dshHome, sessionId) {
  const found = findSessionFile(dshHome, sessionId)
  if (found === null) return null
  const text = decompressZstdStream(readFileSync(found.file)).toString('utf8')
  const lines = []
  for (const line of text.split('\n')) {
    if (line === '') continue
    try { lines.push(JSON.parse(line)) } catch { lines.push({ unparsed: line.slice(0, 200) }) }
  }
  return { lines, file: found.file }
}
function maxTurn(log) {
  if (log === null) return 0
  let m = 0
  for (const l of log.lines) {
    const t = turnNumOf(l)
    if (typeof t === 'number' && t > m) m = t
  }
  return m
}
/** Durable log rows carry the turn number in `data.turn` (not top-level). */
function turnNumOf(l) {
  if (l === null || l === undefined) return undefined
  if (typeof l.turn === 'number') return l.turn
  if (typeof l.data?.turn === 'number') return l.data.turn
  return undefined
}
async function waitForTurnEnd(dshHome, sessionId, baselineTurn, timeoutMs, intervalMs = 1000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const log = readSessionLog(dshHome, sessionId)
    if (log !== null) {
      const ends = log.lines.filter((l) => {
        const t = turnNumOf(l)
        return l?.type === 'turn/end' && typeof t === 'number' && t > baselineTurn
      })
      if (ends.length > 0) {
        const last = ends[ends.length - 1]
        return { turnEnd: { type: 'turn/end', seq: last.seq, turn: turnNumOf(last), data: last.data }, log }
      }
    }
    if (Date.now() >= deadline) return { turnEnd: null, log }
    await sleep(intervalMs)
  }
}
function toolCallOf(log, name) {
  if (log === null) return null
  for (const l of log.lines) if (l?.type === 'tool/call' && l?.data?.name === name) return l
  return null
}
function toolResultsOf(log, name) {
  if (log === null) return []
  const out = []
  const calls = new Set(log.lines.filter((l) => l?.type === 'tool/call' && l?.data?.name === name).map((l) => l?.data?.callId ?? l?.callId))
  for (const l of log.lines) {
    if (l?.type !== 'tool/result') continue
    const cid = l?.data?.message?.source?.callId ?? l?.data?.callId
    if (calls.size > 0 && !calls.has(cid)) continue
    out.push(l)
  }
  return out
}
function resultTextOf(l) {
  if (l === null || l === undefined) return ''
  const d = l.data ?? l
  const content = d?.message?.content ?? d?.content ?? d
  return typeof content === 'string' ? content : JSON.stringify(content)
}

// ── control-plane helpers ──────────────────────────────────────────────────
function controlSlice(st) {
  return st?.control ?? { requests: [], decisions: [], consumptions: [] }
}

/**
 * Read the control-plane ledger DIRECTLY from the durable team-domain store
 * (read-only file read; independent of the team lock chain).
 *
 * WHY NOT /__p6t6/state while a send is in flight: `member.send` in the
 * default (sync) work mode awaits the member's whole turn (the settlement
 * persists the turn's member result), and while that send is in flight the
 * state route's `messaging.recoverPendingDeliveries` serializes behind the
 * same coordinator chain — the route blocks. The durable file does not:
 * the A4 control rows are written to the ledger by the ControlService
 * (which takes NO team lock), so they are observable mid-suspension.
 */
function readDurableControl(home, rootSessionId) {
  let st
  try {
    st = JSON.parse(readFileSync(join(home, 'storages', 'team_domain.json'), 'utf8'))
  } catch {
    return null // missing or mid-write — retry on the next poll
  }
  const requests = []
  const decisions = []
  const consumptions = []
  const ledger = st?.tables?.ledger
  if (ledger !== null && typeof ledger === 'object') {
    for (const v of Object.values(ledger)) {
      let row = v
      if (typeof row === 'string') { try { row = JSON.parse(row) } catch { continue } }
      if (row === null || typeof row !== 'object') continue
      if (row.rootSessionId !== rootSessionId) continue
      if (row.factType === 'control-request-recorded') requests.push(row)
      else if (row.factType === 'control-decision-recorded') decisions.push(row)
      else if (row.factType === 'control-allow-consumed') consumptions.push(row)
    }
  }
  return { requests, decisions, consumptions }
}

/**
 * Poll the durable ledger until the control-request row for the given
 * worker callId (correlation) appears. `callId` is known in advance: the
 * mock mints it (the scripted tool-call id), so the wait is precise — no
 * "newest request" races.
 */
async function waitForDurableRequest(home, rootSessionId, callId, timeoutMs, knownRequestIds = new Set()) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const ctrl = readDurableControl(home, rootSessionId)
    if (ctrl !== null) {
      const hit = ctrl.requests.find(
        (r) => r.payload?.toolName === 'pwsh' && r.payload?.correlation === callId && !knownRequestIds.has(r.payload?.requestId),
      )
      if (hit !== undefined) return hit
    }
    if (Date.now() >= deadline) {
      const ctrl = readDurableControl(home, rootSessionId) ?? { requests: [], decisions: [], consumptions: [] }
      throw new Error(`no durable pwsh control request for callId=${callId} within ${timeoutMs}ms; ledger=${JSON.stringify(ctrl).slice(0, 500)}`)
    }
    await sleep(500)
  }
}

// ── boot machinery ─────────────────────────────────────────────────────────
let profileEnsured = false
const instances = []

function writePatchFile(leg) {
  const patchPath = join(HOME, 'profiles', 'web', 'cordis.patch.yml')
  mkdirSync(dirname(patchPath), { recursive: true })
  const rowConfig = {
    bootPhase: 'create-or-open',
    rootSessionId: leg.root,
    blueprintSource: blueprintDoc(leg.bpId, leg.workerCaps),
    seedMembers: [],
    defaultWorkspace: WORK.root,
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'a2c1-live-model' },
    deniedSelection: { provider: 'a2c1-denied', model: 'a2c1-denied' },
    mcpServer: null,
    memberPresetId: 'a2c1-pwsh',
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl: GLUE_URL,
    seamUrl: SEAM_URL,
  }
  const lines = [
    `# A2C-1 live proof patch layer (${leg.key} / boot#${leg.bootNum}): production dsh-agent-team row (built from .worktrees/a2c-1) + client shim + p6t6 observability row, mounted ONLY through this public profile-patch seam.`,
    '- insert:',
    ...yamlEmitItem({ id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: rowConfig }, 2),
    ...yamlEmitItem({ id: 'dsh-agent-team-client', name: CLIENT_URL }, 2),
    ...yamlEmitItem({ id: 'p6t6-team-tools', name: P6T6_URL }, 2),
    '',
  ]
  writeFileSync(patchPath, lines.join('\n'))
  return patchPath
}

function writeDirective(leg) {
  const directive = {
    boot: leg.directive.boot,
    phase: leg.directive.phase,
    reportDir: EV,
    runStamp: NONCE,
    rootSessionId: leg.root,
    mcpPort: null,
  }
  writeFileSync(join(HOME, 'p6t6-directive.json'), JSON.stringify(directive, null, 2))
}

function makeDecide(legKey) {
  // tool-pwsh's argument schema requires `command` AND `description` (upstream
  // harness tool definition); without description the BODY's argument
  // validation rejects the call before spawn (observed live in run #7).
  const pwshArgs = {
    command: 'Get-ChildItem -Name',
    description: 'List directory names (A2C-1 live probe)',
    workdir: WORK.child,
  }
  return (ctx) => {
    const body = ctx?.req ?? ctx
    const msgs = Array.isArray(body?.messages) ? body.messages : []
    const contentOf = (m) => (typeof m?.content === 'string' ? m.content : JSON.stringify(m?.content ?? ''))
    // 1) the session-title LLM call (concurrent with the turn; its messages
    //    carry the turn's human text, so it must be answered as plain text
    //    BEFORE any marker match, or the mock would return a tool call to a
    //    text-only request).
    const systemText = msgs.filter((m) => m?.role === 'system').map(contentOf).join('\n')
    if (systemText.includes('Create a concise title')) {
      return { kind: 'text', content: `A2C1_TITLE_${legKey}` }
    }
    // 2) after a tool result the model is called again: ack and end the turn.
    const last = msgs[msgs.length - 1]
    if (last?.role === 'tool') return { kind: 'text', content: `A2C1_TOOL_RESULT_ACK_${legKey}` }
    // 3) the harness splices system-reminder / runtime-context messages
    //    AFTER the relayed body, so the marker may sit in an EARLIER user
    //    message — match across all user messages (history accumulates
    //    markers across turns, hence newest-first precedence).
    const userText = msgs.filter((m) => m?.role === 'user').map(contentOf).join('\n')
    const call = (idSuffix) => ({
      kind: 'tool-call',
      toolCalls: [{ id: `a2c1-${legKey}-call-${idSuffix}`, name: 'pwsh', arguments: pwshArgs }],
    })
    if (userText.includes(`A2C1_PWSH3_${NONCE}`)) return call('c')
    if (userText.includes(`A2C1_PWSH2_${NONCE}`)) return call('b')
    if (userText.includes(`A2C1_PWSH_${NONCE}`)) return call('a')
    return { kind: 'text', content: `A2C1_DEFAULT_ACK_${NONCE}` }
  }
}

/** The D6 kill->restart collision signature (boot.mjs header, wait-end-seed.mjs). */
const COLLISION_RE = /cannot prepare session|while it is live/i

/** Wait until ANY session durable log under the home ends with an end-seed row. */
async function waitForEndSeedAnywhere(dshHome, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const root = join(dshHome, 'sessions')
    if (existsSync(root)) {
      for (const entry of walk(root)) {
        if (!entry.name.endsWith('session.jsonl.zstd')) continue
        try {
          const text = decompressZstdStream(readFileSync(entry.path)).toString('utf8')
          const rows = text.split('\n').filter((l) => l !== '').map((l) => { try { return JSON.parse(l) } catch { return null } }).filter(Boolean)
          const last = rows[rows.length - 1]
          if (last && typeof last.type === 'string' && last.type.includes('end-seed')) return { file: entry.path, last }
        } catch { /* skip */ }
      }
    }
    if (Date.now() >= deadline) return null
    await sleep(1000)
  }
}

async function bootLeg(leg, mock) {
  const instLogDir = join(EV, 'instances', `boot${leg.bootNum}`)
  const instance = new DshInstance({
    hostTree: HOST_TREE, dshHome: HOME, port: WEB_PORT, clientCommitHash: CLIENT_COMMIT_HASH, logDir: instLogDir,
  })
  instances.push(instance)
  log(`boot#${leg.bootNum} ${leg.key}: starting (root=${leg.root} phase=${leg.directive.phase} policy=${leg.policy})`)
  if (!profileEnsured) {
    const profile = await ensureProfile({ instance, log, timeoutMs: 120_000 })
    log(`boot#${leg.bootNum} ${leg.key}: profile ${profile.created ? 'created via throwaway boot' : 'already initialized'}`)
    profileEnsured = true
  }
  writePatchFile(leg)
  writeDirective(leg)

  const origin = `http://127.0.0.1:${WEB_PORT}`
  const attempt = async (attemptNo) => {
    const started = await instance.start({ timeoutMs: 180_000 })
    const markerLine = await waitForLogLine(started.logPath, BOOT_MARKER, 30_000)
    if (markerLine === null) throw new Error(`boot marker missing; log tail: ${logTail(started.logPath, 15)}`)
    log(`boot#${leg.bootNum} ${leg.key} attempt#${attemptNo}: ${markerLine}`)
    const token = markerLine.slice(markerLine.indexOf('token=') + 6).trim()
    // 401 verification (no token)
    const noAuth = await fetch(`${origin}/`, { signal: AbortSignal.timeout(15_000) }).then((r) => r.status)
    log(`boot#${leg.bootNum} ${leg.key} attempt#${attemptNo}: GET / without token -> HTTP ${noAuth} (expect 401)`)
    const cookie = await authenticate(origin, token)
    log(`boot#${leg.bootNum} ${leg.key} attempt#${attemptNo}: auth cookie exchanged (303 + set-cookie)`)
    // composed row dump
    const dump = await instance.dumpConfig({ timeoutMs: 90_000 })
    writeFileSync(join(instLogDir, attemptNo === 1 ? 'dump-config.txt' : `dump-config-attempt${attemptNo}.txt`), dump.text)
    const rows = {
      'dsh-agent-team': DshInstance.rowInDump(dump.text, { id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME }),
      'dsh-agent-team-client': DshInstance.rowInDump(dump.text, { id: 'dsh-agent-team-client', name: CLIENT_URL }),
      'p6t6-team-tools': DshInstance.rowInDump(dump.text, { id: 'p6t6-team-tools', name: P6T6_URL }),
      'memberPresetId-config': dump.text.includes('memberPresetId: a2c1-pwsh'),
    }
    log(`boot#${leg.bootNum} ${leg.key} attempt#${attemptNo}: rows mounted ${JSON.stringify(rows)}`)
    // row health
    let health = null
    const deadline = Date.now() + 180_000
    for (;;) {
      const hb = await p6t6Health({ origin })
      health = { status: hb.status, body: hb.body }
      // toolCount is observed, not pinned: the p6t6 row registers the
      // team tools present in this alpha.2 build (10 in the T12-era kit,
      // 11 observed in this run — recorded per boot below). Readiness is
      // `ok` + `ready` + the directive root being live.
      if (hb.status === 200 && hb.body?.ok === true && hb.body?.ready === true && typeof hb.body?.toolCount === 'number' && hb.body.toolCount >= 10) break
      if (hb.status === 200 && hb.body?.ok === false && hb.body?.setupError !== undefined) {
        const err = new Error(`row setup failed — setupError: ${String(hb.body.setupError).slice(0, 500)}; log tail: ${logTail(started.logPath, 20)}`)
        err.setupError = String(hb.body.setupError)
        throw err
      }
      if (Date.now() >= deadline) throw new Error(`row health not ready in 180s; last: ${JSON.stringify(hb.body).slice(0, 400)}`)
      await sleep(1000)
    }
    log(`boot#${leg.bootNum} ${leg.key} attempt#${attemptNo}: row ready — toolCount=${health.body.toolCount}`)
    // durable state ready (directive root + phase + teamSession row)
    const ready = await p6t6StateReady({ origin }, { rootSessionId: leg.root, phase: leg.directive.phase, timeoutMs: 120_000 })
    log(`boot#${leg.bootNum} ${leg.key} attempt#${attemptNo}: state ready — teamSession=${JSON.stringify(ready.teamSession)}`)
    return { instance, token, cookie, origin, health, teamSession: ready.teamSession, markerLine }
  }

  try {
    return await attempt(1)
  } catch (error) {
    // D6 kill->restart recipe (boot.mjs header / wait-end-seed.mjs): a cold
    // resume of a world whose sessions the killed boot left OPEN can collide
    // ("cannot prepare session ... while it is live"); the failing process
    // retires the revived session (end-seed row) — wait for it, stop, retry
    // the boot ONCE.
    if (COLLISION_RE.test(error?.setupError ?? '')) {
      log(`boot#${leg.bootNum} ${leg.key}: collision signature detected (${String(error.setupError).slice(0, 200)}) — waiting for end-seed (D6 recipe)`)
      const endSeed = await waitForEndSeedAnywhere(HOME, 120_000)
      log(`boot#${leg.bootNum} ${leg.key}: end-seed ${endSeed !== null ? `seen in ${endSeed.file} (type=${endSeed.last.type})` : 'NOT seen (timeout) — retrying anyway per round-1 recipe'}`)
      await instance.stop({ timeoutMs: 20_000 })
      const failedLog = join(instLogDir, `instance-port${WEB_PORT}.log`)
      if (existsSync(failedLog)) writeFileSync(join(instLogDir, `instance-port${WEB_PORT}-attempt1-failed.log`), readFileSync(failedLog))
      const retried = await attempt(2)
      log(`boot#${leg.bootNum} ${leg.key}: retry boot succeeded (D6 recipe, one retry)`)
      return retried
    }
    throw error
  }
}

async function stopLeg(rec, leg) {
  const res = await rec.instance.stop({ timeoutMs: 20_000 })
  // The dsh web shutdown (SIGTERM -> graceful close) can exceed the stop()
  // wait window — poll the port itself with a bounded grace.
  const released = await waitPortReleased(WEB_PORT, 60_000)
  log(`boot#${leg.bootNum} ${leg.key}: stopped (killed=${JSON.stringify(res)} portReleased=${released})`)
  if (!released) throw new Error(`port ${WEB_PORT} still held 60s after stop`)
}

function portInUseCheck(port) {
  return new Promise((r) => {
    const s = net.connect(port, '127.0.0.1')
    s.on('connect', () => { s.destroy(); r(true) })
    s.on('error', () => r(false))
    setTimeout(() => { try { s.destroy() } catch { /* */ }; r(true) }, 3000)
  })
}

async function waitPortReleased(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    if (!(await portInUseCheck(port))) return true
    if (Date.now() >= deadline) return false
    await sleep(1000)
  }
}

async function portFreeCheck(port) {
  return !(await portInUseCheck(port))
}

function logTail(path, lines = 12) {
  try { return readFileSync(path, 'utf8').split('\n').slice(-lines).join('\n') } catch { return '<no log>' }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── leg runners ────────────────────────────────────────────────────────────
async function createWorker(rec, leg, label, workspace) {
  const res = await p6t6Tool(rec, 'team_create_member', {
    rootSessionId: leg.root,
    requestToken: `a2c1-${leg.key}-create-${NONCE}`,
    delegationTemplateId: 'worker',
    label,
    workspace,
  }, leg.root)
  const value = toolValue(res, 'team_create_member')
  if (value?.status !== 'executed') throw new Error(`${leg.key}: team_create_member status=${JSON.stringify(value).slice(0, 300)}`)
  const effect = value.effect
  if (typeof effect?.instanceId !== 'string' || typeof effect?.childSessionId !== 'string') {
    throw new Error(`${leg.key}: create effect missing ids: ${JSON.stringify(effect).slice(0, 300)}`)
  }
  log(`${leg.key}: worker created instanceId=${effect.instanceId} childSessionId=${effect.childSessionId}`)
  return effect
}

async function sendToWorker(rec, leg, instanceId, body, tokenSuffix) {
  const res = await remoteCall(rec, 'member.send', {
    teamSessionId: leg.root,
    caller: { kind: 'human', humanId: leg.root },
    recipientInstanceId: instanceId,
    body,
    requestToken: `a2c1-${tokenSuffix}-${NONCE}`,
  })
  const value = remoteValue(res, 'member.send')
  const outcome = value?.outcome
  if (outcome?.status !== 'delivered' && outcome?.status !== 'executed') {
    throw new Error(`${leg.key}: member.send unexpected outcome: ${JSON.stringify(value).slice(0, 400)}`)
  }
  log(`${leg.key}: member.send ${outcome?.status} (recipient=${instanceId})`)
  return outcome
}

/**
 * Fire member.send WITHOUT awaiting it (returns the completion promise).
 *
 * In the default (sync) work mode the send only returns after the member's
 * turn has settled (the settlement persists the turn's member result) — so
 * while the turn is suspended on an approval ask the call is legitimately
 * in flight. Ask legs fire the send, observe the pending ask in the durable
 * ledger (readDurableControl — the ControlService takes no team lock),
 * resolve it, and only then await this promise.
 */
function fireSendToWorker(rec, leg, instanceId, body, tokenSuffix) {
  const promise = (async () => {
    const res = await remoteCall(rec, 'member.send', {
      teamSessionId: leg.root,
      caller: { kind: 'human', humanId: leg.root },
      recipientInstanceId: instanceId,
      body,
      requestToken: `a2c1-${tokenSuffix}-${NONCE}`,
    }, 1, 300_000)
    const value = remoteValue(res, 'member.send')
    const outcome = value?.outcome
    if (outcome?.status !== 'delivered' && outcome?.status !== 'executed') {
      throw new Error(`${leg.key}: member.send unexpected outcome: ${JSON.stringify(value).slice(0, 400)}`)
    }
    log(`${leg.key}: member.send ${outcome?.status} (recipient=${instanceId})`)
    return outcome
  })()
  // A fired send may never be awaited if the leg fails before the resolve
  // (e.g. the ask never materializes). The no-op rejection observer keeps
  // the process from dying on an unhandled rejection; the leg's own error
  // path still carries the failure.
  promise.catch(() => {})
  return promise
}

async function resolveControl(rec, leg, requestId, decision, note) {
  const res = await remoteCall(rec, 'team.resolveControl', {
    teamSessionId: leg.root,
    requestId,
    decision,
    note,
  }, 4)
  const value = remoteValue(res, 'team.resolveControl')
  log(`${leg.key}: team.resolveControl ${decision} for ${requestId} -> ${JSON.stringify(value).slice(0, 300)}`)
  return value
}

async function snapshotState(rec, leg, name) {
  const st = await p6t6State(rec)
  if (st === null) throw new Error(`${leg.key}: state snapshot ${name} failed`)
  writeFileSync(join(EV, 'instances', `boot${leg.bootNum}`, `state-${name}.json`), JSON.stringify(st, null, 2))
  return st
}

function snapshotMock(mock, leg) {
  const redacted = mock.requests.map((r) => ({
    seq: r.seq,
    path: r.path,
    receivedAt: r.receivedAt,
    status: r.status,
    auth: r.headers?.authorization !== undefined ? 'Bearer <redacted>' : undefined,
    model: r.body?.model,
    tools: Array.isArray(r.body?.tools) ? r.body.tools.map((t) => t?.function?.name ?? t?.name ?? null) : null,
    lastUserText: (() => {
      const msgs = r.body?.messages ?? []
      const last = [...msgs].reverse().find((m) => m?.role === 'user')
      return last?.content !== undefined ? String(last.content).slice(0, 300) : undefined
    })(),
    reply: r.reply !== null ? { kind: r.reply?.kind, toolCalls: r.reply?.toolCalls } : null,
  }))
  writeFileSync(join(EV, 'instances', `boot${leg.bootNum}`, 'mock-requests.json'), JSON.stringify(redacted, null, 2))
  return redacted
}

function check(leg, name, ok, detail) {
  const a = { name, ok: ok === true, detail: detail === undefined ? undefined : String(detail).slice(0, 2000) }
  leg.assertions.push(a)
  log(`${leg.key} CHECK ${a.ok ? 'PASS' : 'FAIL'}: ${a.name}${a.ok || a.detail === undefined ? '' : ` :: ${a.detail}`}`)
  return a.ok
}

function legRecord(leg) {
  return {
    key: leg.key, policy: leg.policy, root: leg.root, bootNum: leg.bootNum,
    directive: leg.directive, blueprintId: leg.bpId,
    assertions: (leg.assertions ??= []),
    evidence: (leg.evidence ??= {}),
    pass: false,
    error: null,
  }
}

async function runLegL1(rec, leg, mock) {
  const worker = await createWorker(rec, leg, 'a2c1-worker', WORK.child)
  leg.evidence.worker = worker
  const baseline = maxTurn(readSessionLog(HOME, worker.childSessionId))
  await sendToWorker(rec, leg, worker.instanceId, `A2C1_PWSH_${NONCE} run the pwsh probe now`, 'l1-send')
  const { turnEnd, log: slog } = await waitForTurnEnd(HOME, worker.childSessionId, baseline, 420_000)
  check(leg, 'worker turn completed (turn/end after the pwsh call)', turnEnd !== null, `turnEnd=${JSON.stringify(turnEnd)?.slice(0, 200)}`)
  const call = toolCallOf(slog, 'pwsh')
  const results = toolResultsOf(slog, 'pwsh')
  const result = results[results.length - 1]
  const text = resultTextOf(result)
  leg.evidence.workerToolCall = call ? { name: call.data?.name, arguments: call.data?.arguments } : null
  leg.evidence.workerToolResult = result ? { isError: result.data?.isError, text: text.slice(0, 600) } : null
  check(leg, 'worker model-visible call: pwsh tool/call recorded in the durable log', call !== null, JSON.stringify(call?.data ?? null).slice(0, 300))
  check(leg, 'denial text contains "permission denied by the static permission policy"', text.includes('permission denied by the static permission policy'), text.slice(0, 300))
  check(leg, 'denial text contains "denies pwsh on"', text.includes('denies pwsh on'), text.slice(0, 300))
  check(leg, 'ZERO body executions: no spawn/ENOENT in the tool result (body never attempted)', !/ENOENT|spawn/i.test(text), text.slice(0, 300))
  const st = await snapshotState(rec, leg, 'l1-final')
  const ctrl = controlSlice(st)
  check(leg, 'NO permission consumption row (a static deny never asks): zero requests/decisions/consumptions',
    ctrl.requests.length === 0 && ctrl.decisions.length === 0 && ctrl.consumptions.length === 0,
    JSON.stringify(ctrl).slice(0, 300))
  leg.evidence.state = { members: st.members, control: ctrl }
}

async function runLegL2(rec, leg, mock) {
  const worker = await createWorker(rec, leg, 'a2c1-worker', WORK.child)
  leg.evidence.worker = worker
  const baseline = maxTurn(readSessionLog(HOME, worker.childSessionId))
  const CALL_ID = 'a2c1-L2-call-a'
  const sendP = fireSendToWorker(rec, leg, worker.instanceId, `A2C1_PWSH_${NONCE} run the pwsh probe now`, 'l2-send')
  const reqRow = await waitForDurableRequest(HOME, leg.root, CALL_ID, 180_000)
  const request = reqRow.payload
  leg.evidence.requestAtAsk = {
    requestId: request.requestId, kind: request.kind, toolName: request.toolName,
    correlation: request.correlation, requester: request.requester,
    summary: request.summary, operationFingerprint: request.operationFingerprint,
  }
  check(leg, 'control request created on ask (kind recorded = leader-approval)', request.kind === 'leader-approval', JSON.stringify(request).slice(0, 300))
  check(leg, 'control request names tool pwsh (toolName) and the exact worker callId (correlation)',
    request.toolName === 'pwsh' && request.correlation === CALL_ID, JSON.stringify(request).slice(0, 300))
  check(leg, 'the ask originates from the suspended worker turn (requester = worker member instance)',
    request.requester?.kind === 'instance' && request.requester?.instanceId === worker.instanceId, JSON.stringify(request?.requester ?? null).slice(0, 300))
  const resolution = await resolveControl(rec, leg, request.requestId, 'deny', 'a2c1 L2: human denies the pwsh ask')
  leg.evidence.resolution = resolution
  const outcome = await sendP
  leg.evidence.sendOutcome = outcome
  const { turnEnd, log: slog } = await waitForTurnEnd(HOME, worker.childSessionId, baseline, 240_000)
  check(leg, 'worker turn completed after the deny resolution', turnEnd !== null, JSON.stringify(turnEnd)?.slice(0, 200))
  const results = toolResultsOf(slog, 'pwsh')
  const text = resultTextOf(results[results.length - 1])
  leg.evidence.workerToolResult = { isError: results[results.length - 1]?.data?.isError, text: text.slice(0, 600) }
  check(leg, 'decision result text = "the approval was denied"', text.includes('the approval was denied'), text.slice(0, 300))
  check(leg, 'ZERO body executions after denial: no spawn/ENOENT in the tool result', !/ENOENT|spawn/i.test(text), text.slice(0, 300))
  const ctrl = readDurableControl(HOME, leg.root)
  check(leg, 'durable ledger: exactly one request row + one decision row (deny, decider human), zero consumptions',
    ctrl !== null && ctrl.requests.length === 1
      && ctrl.decisions.length === 1 && ctrl.decisions[0].payload.decision === 'deny'
      && (ctrl.decisions[0].payload.decider?.kind === 'human')
      && ctrl.consumptions.length === 0,
    JSON.stringify(ctrl).slice(0, 500))
  leg.evidence.controlDurable = ctrl
  leg.evidence.ledgerRows = { requestRow: reqRow, decisionRow: ctrl?.decisions[0] ?? null }
}

async function runLegL3(rec, leg, mock) {
  const worker = await createWorker(rec, leg, 'a2c1-worker', WORK.child)
  leg.evidence.worker = worker
  const baseline = maxTurn(readSessionLog(HOME, worker.childSessionId))

  // call 1 — allow (one-shot)
  const CALL_ID_1 = 'a2c1-L3-call-a'
  const sendP1 = fireSendToWorker(rec, leg, worker.instanceId, `A2C1_PWSH_${NONCE} run the pwsh probe now`, 'l3-send1')
  const reqRow1 = await waitForDurableRequest(HOME, leg.root, CALL_ID_1, 180_000)
  const req1 = reqRow1.payload
  leg.evidence.request1 = { requestId: req1.requestId, kind: req1.kind, toolName: req1.toolName }
  check(leg, 'call 1: control request created (leader-approval, pwsh)', req1.kind === 'leader-approval' && req1.toolName === 'pwsh', JSON.stringify(req1).slice(0, 300))
  await resolveControl(rec, leg, req1.requestId, 'allow', 'a2c1 L3: allow-once for the exact pwsh call')
  const outcome1 = await sendP1
  leg.evidence.sendOutcome1 = outcome1
  const { turnEnd: t1, log: slog1 } = await waitForTurnEnd(HOME, worker.childSessionId, baseline, 240_000)
  check(leg, 'call 1: worker turn completed after the allow resolution', t1 !== null, JSON.stringify(t1)?.slice(0, 200))
  const r1 = toolResultsOf(slog1, 'pwsh')
  const text1 = resultTextOf(r1[r1.length - 1])
  leg.evidence.call1ToolResult = { isError: r1[r1.length - 1]?.data?.isError, text: text1.slice(0, 800) }
  check(leg, 'call 1: BODY IS ATTEMPTED — tool result carries a body-level failure (ENOENT / missing pwsh binary), NOT a permission denial',
    /ENOENT|not found|No such file/i.test(text1) && !text1.includes('the approval was denied') && !text1.includes('static permission policy'),
    text1.slice(0, 400))
  const ctrlMid = readDurableControl(HOME, leg.root)
  check(leg, 'call 1: permission allow = 1 (one decision row, allow)',
    ctrlMid !== null && ctrlMid.decisions.length === 1 && ctrlMid.decisions[0].payload.decision === 'allow',
    JSON.stringify(ctrlMid?.decisions ?? []).slice(0, 300))
  check(leg, 'call 1: EXACTLY ONE dispatch authorized — one consumption row for request 1',
    ctrlMid !== null && ctrlMid.consumptions.length === 1 && ctrlMid.consumptions[0].payload.requestId === req1.requestId,
    JSON.stringify(ctrlMid?.consumptions ?? []).slice(0, 300))
  leg.evidence.stateAfterCall1 = { control: ctrlMid }

  // call 2 — same command, fresh callId: the one-shot allow is consumed
  const CALL_ID_2 = 'a2c1-L3-call-b'
  const baseline2 = maxTurn(readSessionLog(HOME, worker.childSessionId))
  const sendP2 = fireSendToWorker(rec, leg, worker.instanceId, `A2C1_PWSH2_${NONCE} run the pwsh probe again`, 'l3-send2')
  const reqRow2 = await waitForDurableRequest(HOME, leg.root, CALL_ID_2, 180_000, new Set([req1.requestId]))
  const req2 = reqRow2.payload
  leg.evidence.request2 = { requestId: req2.requestId, kind: req2.kind, toolName: req2.toolName }
  check(leg, 'call 2 (allow consumed): a NEW control request is created — live re-ask (unit G4c: a new call asks again; no static shell allow)',
    req2.requestId !== req1.requestId && req2.toolName === 'pwsh', JSON.stringify(req2).slice(0, 300))
  await resolveControl(rec, leg, req2.requestId, 'deny', 'a2c1 L3: second ask denied')
  const outcome2 = await sendP2
  leg.evidence.sendOutcome2 = outcome2
  const { turnEnd: t2, log: slog2 } = await waitForTurnEnd(HOME, worker.childSessionId, baseline2, 240_000)
  check(leg, 'call 2: worker turn completed after the deny resolution', t2 !== null, JSON.stringify(t2)?.slice(0, 200))
  const r2 = toolResultsOf(slog2, 'pwsh')
  const text2 = r2.length > 1 ? resultTextOf(r2[r2.length - 1]) : ''
  leg.evidence.call2ToolResult = { isError: r2[r2.length - 1]?.data?.isError, text: text2.slice(0, 600) }
  check(leg, 'call 2: body NOT executed after the deny (no second ENOENT body failure beyond call 1)',
    !/ENOENT|not found|No such file/i.test(text2), text2.slice(0, 300))
  const ctrl = readDurableControl(HOME, leg.root)
  check(leg, 'final: two request rows, two decision rows (allow, deny), one consumption row (call 1 only)',
    ctrl !== null && ctrl.requests.length === 2 && ctrl.decisions.length === 2 && ctrl.consumptions.length === 1,
    JSON.stringify(ctrl).slice(0, 500))
  leg.evidence.controlDurable = ctrl
  leg.evidence.ledgerRows = { requestRow1: reqRow1, requestRow2: reqRow2, consumptionRow: ctrl?.consumptions[0] ?? null }
  leg.evidence.liveObservation = 'second identical call (fresh callId) RE-ASKS (new request row); the same-callId allow-consumed retry (unit G4b) is not reachable through the live agent loop (callIds are minted per loop step) — recorded as live semantics; units pin the retry path.'
}

async function runLegL4(rec, leg, mock) {
  const worker = await createWorker(rec, leg, 'a2c1-worker', WORK.child)
  leg.evidence.worker = worker
  const baseline = maxTurn(readSessionLog(HOME, worker.childSessionId))
  await sendToWorker(rec, leg, worker.instanceId, `A2C1_PWSH_${NONCE} run the pwsh probe now`, 'l4-send')
  // wait for the worker model request (the model-visible tool table) + turn end
  const { turnEnd, log: slog } = await waitForTurnEnd(HOME, worker.childSessionId, baseline, 420_000)
  check(leg, 'worker turn completed (the hidden-tool call settles)', turnEnd !== null, JSON.stringify(turnEnd)?.slice(0, 200))
  const mockReq = [...mock.requests].reverse().find((r) => JSON.stringify(r.body?.messages ?? []).includes(`A2C1_PWSH_${NONCE}`))
  const toolNames = Array.isArray(mockReq?.body?.tools) ? mockReq.body.tools.map((t) => t?.function?.name ?? t?.name ?? null) : null
  leg.evidence.workerModelTools = toolNames
  check(leg, 'pwsh ABSENT from the worker model-visible tool table (capability-layer hide)',
    toolNames !== null && !toolNames.includes('pwsh'), JSON.stringify(toolNames))
  check(leg, 'sibling tool bash still present in the worker tool table (the deny is targeted, not blanket)',
    toolNames !== null && toolNames.includes('bash'), JSON.stringify(toolNames))
  const call = toolCallOf(slog, 'pwsh')
  check(leg, 'the scripted model still TRIED pwsh (tool/call recorded) — the hide is at the surface, not the model', call !== null, JSON.stringify(call?.data ?? null).slice(0, 300))
  const results = toolResultsOf(slog, 'pwsh')
  const text = resultTextOf(results[results.length - 1])
  leg.evidence.workerToolResult = { isError: results[results.length - 1]?.data?.isError, text: text.slice(0, 600) }
  check(leg, 'ZERO body executions: the hidden-tool result carries NO spawn/ENOENT (executor never reached)', !/ENOENT|spawn/i.test(text), text.slice(0, 300))
  const st = await snapshotState(rec, leg, 'l4-final')
  const ctrl = controlSlice(st)
  check(leg, 'ZERO permission rows for pwsh (the tool never reaches the permission layer)',
    ctrl.requests.length === 0 && ctrl.decisions.length === 0 && ctrl.consumptions.length === 0, JSON.stringify(ctrl).slice(0, 300))
  leg.evidence.state = { control: ctrl }
}

async function runLegL5a(rec, leg, mock) {
  const worker = await createWorker(rec, leg, 'a2c1-worker', WORK.child)
  leg.evidence.worker = worker
  const baseline = maxTurn(readSessionLog(HOME, worker.childSessionId))
  const CALL_ID = 'a2c1-L5a-call-a'
  const sendP = fireSendToWorker(rec, leg, worker.instanceId, `A2C1_PWSH_${NONCE} run the pwsh probe now`, 'l5a-send')
  const reqRow = await waitForDurableRequest(HOME, leg.root, CALL_ID, 180_000)
  const req1 = reqRow.payload
  leg.evidence.request1 = { requestId: req1.requestId, kind: req1.kind, toolName: req1.toolName }
  check(leg, 'L5a: control request created (leader-approval, pwsh)', req1.kind === 'leader-approval' && req1.toolName === 'pwsh', JSON.stringify(req1).slice(0, 300))
  await resolveControl(rec, leg, req1.requestId, 'allow', 'a2c1 L5a: allow-once (durable rows for the cold-resume leg)')
  const outcome = await sendP
  leg.evidence.sendOutcome = outcome
  const { turnEnd, log: slog } = await waitForTurnEnd(HOME, worker.childSessionId, baseline, 240_000)
  check(leg, 'L5a: worker turn completed after the allow', turnEnd !== null, JSON.stringify(turnEnd)?.slice(0, 200))
  const r1 = toolResultsOf(slog, 'pwsh')
  const text1 = resultTextOf(r1[r1.length - 1])
  leg.evidence.call1ToolResult = { text: text1.slice(0, 800) }
  check(leg, 'L5a: body attempted (ENOENT-class failure) — permission verdict was allow', /ENOENT|not found|No such file/i.test(text1), text1.slice(0, 300))
  const ctrl = readDurableControl(HOME, leg.root)
  check(leg, 'L5a: durable rows present before the stop (1 request / 1 decision allow / 1 consumption)',
    ctrl !== null && ctrl.requests.length === 1 && ctrl.decisions.length === 1 && ctrl.decisions[0].payload.decision === 'allow' && ctrl.consumptions.length === 1,
    JSON.stringify(ctrl).slice(0, 500))
  const st = await snapshotState(rec, leg, 'l5a-final')
  leg.evidence.state = { members: st.members, control: controlSlice(st), teamSession: st.teamSession, controlDurable: ctrl }
}

async function runLegL5b(rec, leg, mock) {
  const st0 = await p6t6State(rec)
  const members0 = st0?.members ?? []
  const ctrl0 = readDurableControl(HOME, leg.root)
  const l5a = state.legs['L5a']?.evidence
  const l5aTeam = l5a?.state?.teamSession
  const l5aWorker = l5a?.worker
  check(leg, 'cold resume: teamSession durable row reopens with the SAME team identity (rootSessionId + blueprintId + contentHash)',
    st0?.teamSession?.rootSessionId === leg.root && st0?.teamSession?.blueprintId === leg.bpId && st0?.teamSession?.contentHash !== undefined,
    JSON.stringify(st0?.teamSession ?? null).slice(0, 300))
  if (l5aTeam !== undefined) {
    check(leg, 'cold resume: teamSession contentHash UNCHANGED since L5a (same blueprint document, adopted — not re-created)',
      st0?.teamSession?.contentHash === l5aTeam?.contentHash && st0?.teamSession?.blueprintId === l5aTeam?.blueprintId,
      `l5a=${JSON.stringify(l5aTeam)?.slice(0, 200)} now=${JSON.stringify(st0?.teamSession)?.slice(0, 200)}`)
  }
  check(leg, 'cold resume: prior permission rows persist (1 request / 1 decision allow / 1 consumption from L5a)',
    ctrl0 !== null && ctrl0.requests.length === 1 && ctrl0.decisions.length === 1 && ctrl0.decisions[0].payload.decision === 'allow' && ctrl0.consumptions.length === 1,
    JSON.stringify(ctrl0).slice(0, 500))
  const workerRow = members0.find((m) => m.templateId === 'worker')
  check(leg, 'cold resume: the member row persists (same instanceId + childSessionId as L5a)',
    workerRow !== undefined && workerRow.instanceId !== undefined && workerRow.childSessionId !== undefined,
    JSON.stringify(workerRow ?? null).slice(0, 300))
  if (l5aWorker !== undefined && workerRow !== undefined) {
    check(leg, 'cold resume: member identity identical to L5a (no duplicate member rows; same instance + child session)',
      workerRow.instanceId === l5aWorker.instanceId && workerRow.childSessionId === l5aWorker.childSessionId,
      `l5a=${JSON.stringify(l5aWorker)} now=${JSON.stringify(workerRow).slice(0, 300)}`)
  }
  leg.evidence.resumed = { teamSession: st0?.teamSession ?? null, members: members0, controlDurable: ctrl0 }
  // Ensure the re-opened root is live in Team mode (contract v3, idempotent
  // guarantee). If the row already kept it live during boot this answers
  // "already live" — which is the desired state; log and continue.
  try {
    const liveRes = await remoteCall(rec, 'team.ensureRootLive', { teamSessionId: leg.root }, 3)
    const liveValue = remoteValue(liveRes, 'team.ensureRootLive')
    log(`L5b: team.ensureRootLive -> ${JSON.stringify(liveValue).slice(0, 200)}`)
    leg.evidence.ensureRootLive = liveValue
  } catch (error) {
    const msg = String(error?.message ?? error)
    log(`L5b: team.ensureRootLive answered with error (tolerated): ${msg.slice(0, 300)}`)
    leg.evidence.ensureRootLive = { error: msg.slice(0, 400) }
  }
  // all five roots visible in the world (listRoots v3)
  const rootsRes = await remoteCall(rec, 'team.listRoots', {}, 3)
  const rootsValue = remoteValue(rootsRes, 'team.listRoots')
  const rootIds = (rootsValue?.roots ?? []).map((r) => r?.rootSessionId)
  check(leg, 'cold resume: team.listRoots sees all five leg roots (world state is shared and durable)',
    ['a2c1-l1-root', 'a2c1-l2-root', 'a2c1-l3-root', 'a2c1-l4-root', 'a2c1-l5-root'].every((r) => rootIds.includes(r)),
    JSON.stringify(rootIds))
  leg.evidence.roots = rootIds

  // The fresh call (marker A2C1_PWSH3, callId a2c1-L5b-call-c — the mock
  // mints ids from the leg key) must RE-ASK on
  // the re-opened original worker (strongest form: the L5a member's session
  // rebinds through the cold path and the policy re-applies). Fallback: a
  // fresh worker (still a fresh callId, still a re-ask).
  const CALL_ID = 'a2c1-L5b-call-c'
  const knownReqIds = new Set((ctrl0?.requests ?? []).map((r) => r.payload?.requestId))
  let drivePath
  let turnRes = null
  let reqRow2 = null
  if (workerRow !== undefined) {
    try {
      drivePath = 'reopened-original-worker'
      const worker = { instanceId: workerRow.instanceId, childSessionId: workerRow.childSessionId }
      const baseline = maxTurn(readSessionLog(HOME, worker.childSessionId))
      const sendP = fireSendToWorker(rec, leg, worker.instanceId, `A2C1_PWSH3_${NONCE} run the pwsh probe after cold resume`, 'l5b-send')
      leg.evidence.worker2 = worker
      let waitErr
      try {
        reqRow2 = await waitForDurableRequest(HOME, leg.root, CALL_ID, 120_000, knownReqIds)
      } catch (err) {
        waitErr = err
        // post-mortem: what happened to the in-flight send?
        const settled = await Promise.race([
          sendP.then(() => 'settled-ok', (e) => `settled-rejected:${String(e?.message ?? e).slice(0, 200)}`),
          sleep(3000).then(() => 'still-pending'),
        ])
        throw new Error(`reopened drive produced no durable pwsh ask (send=${settled}): ${String(err?.message ?? err).slice(0, 300)}`)
      }
      const req2 = reqRow2.payload
      leg.evidence.request2 = { requestId: req2.requestId, kind: req2.kind, toolName: req2.toolName }
      check(leg, 'cold resume: a fresh pwsh call on the re-opened worker RE-ASKS (policy re-enforced after restart; the L5a allow does not cover a new call)',
        req2.requestId !== undefined && req2.toolName === 'pwsh' && !knownReqIds.has(req2.requestId), JSON.stringify(req2).slice(0, 300))
      knownReqIds.add(req2.requestId)
      await resolveControl(rec, leg, req2.requestId, 'deny', 'a2c1 L5b: post-resume ask denied')
      const outcome = await sendP
      leg.evidence.sendOutcome = outcome
      turnRes = await waitForTurnEnd(HOME, worker.childSessionId, baseline, 240_000)
    } catch (error) {
      log(`L5b: re-opened original worker drive failed (${String(error?.message ?? error).slice(0, 300)}) — falling back to a fresh worker`)
      drivePath = 'fresh-worker-fallback'
      turnRes = null
      leg.evidence.reopenedDriveError = String(error?.message ?? error).slice(0, 500)
    }
  } else {
    drivePath = 'fresh-worker-fallback'
  }
  if (drivePath === 'fresh-worker-fallback') {
    const worker = await createWorker(rec, leg, 'a2c1-worker-2', WORK.child)
    leg.evidence.worker2 = worker
    const baseline = maxTurn(readSessionLog(HOME, worker.childSessionId))
    const sendP = fireSendToWorker(rec, leg, worker.instanceId, `A2C1_PWSH3_${NONCE} run the pwsh probe after cold resume`, 'l5b-send2')
    reqRow2 = await waitForDurableRequest(HOME, leg.root, CALL_ID, 180_000, knownReqIds)
    const req2 = reqRow2.payload
    leg.evidence.request2 = { requestId: req2.requestId, kind: req2.kind, toolName: req2.toolName }
    check(leg, 'cold resume: a fresh pwsh call (fresh worker) RE-ASKS (policy re-enforced after restart)',
      req2.requestId !== undefined && req2.toolName === 'pwsh' && !knownReqIds.has(req2.requestId), JSON.stringify(req2).slice(0, 300))
    knownReqIds.add(req2.requestId)
    await resolveControl(rec, leg, req2.requestId, 'deny', 'a2c1 L5b: post-resume ask denied')
    const outcome = await sendP
    leg.evidence.sendOutcome = outcome
    turnRes = await waitForTurnEnd(HOME, worker.childSessionId, baseline, 240_000)
  }
  leg.evidence.drivePath = drivePath
  leg.evidence.ledgerRows = { requestRow2: reqRow2 }
  check(leg, 'cold resume: worker turn completed after the deny', turnRes !== null && turnRes.turnEnd !== null, JSON.stringify(turnRes?.turnEnd ?? null)?.slice(0, 200))
  const results = toolResultsOf(turnRes?.log, 'pwsh')
  const text = resultTextOf(results[results.length - 1])
  leg.evidence.call2ToolResult = { text: text.slice(0, 600) }
  check(leg, 'cold resume: the deny is enforced (result = "the approval was denied"; no body execution)',
    text.includes('the approval was denied') && !/ENOENT|spawn/i.test(text), text.slice(0, 300))
  const ctrl = readDurableControl(HOME, leg.root)
  check(leg, 'cold resume: final control state = 2 requests / 2 decisions (allow, deny) / 1 consumption',
    ctrl !== null && ctrl.requests.length === 2 && ctrl.decisions.length === 2 && ctrl.consumptions.length === 1,
    JSON.stringify(ctrl).slice(0, 500))
  leg.evidence.controlDurable = ctrl
}

// ── main ───────────────────────────────────────────────────────────────────
async function main() {
  // If this runner is killed (job cancellation / signal), do NOT orphan the
  // spawned dsh instance on the web port.
  let shuttingDown = false
  for (const signal of ['SIGTERM', 'SIGINT']) {
    process.on(signal, () => {
      if (shuttingDown) return
      shuttingDown = true
      log(`received ${signal} — stopping all live instances before exit`)
      for (const inst of instances) {
        if (inst.booted) { try { inst.stop({ timeoutMs: 5_000 }) } catch { /* */ } }
      }
      setTimeout(() => process.exit(130), 8_000).unref()
    })
  }
  log(`=== A2C-1 LIVE PROOF start; nonce=${NONCE} home=${HOME} web=${WEB_PORT} mock=${MOCK_PORT} ===`)
  log(`worktree=${WT}`)
  log(`hostTree=${HOST_TREE}`)
  mkdirSync(WORK.root, { recursive: true })
  mkdirSync(WORK.child, { recursive: true })
  const [webBusy, mockBusy] = await Promise.all([portInUseCheck(WEB_PORT), portInUseCheck(MOCK_PORT)])
  if (webBusy || mockBusy) die(`ports not free: web=${WEB_PORT} mock=${MOCK_PORT}`)
  log(`ports free: web=${WEB_PORT} mock=${MOCK_PORT} (3181/3080 untouched by this run)`)

  // out-of-tree dist layout artifacts (upstream-resolver symlink + frozen
  // legacy reader mirror) + a fast load probe of the production entry.
  ensureDistLayout()
  const probe = await import(PRODUCTION_ROW_NAME)
  log(`dist-layout: production entry probe OK — name=${probe.default?.name ?? probe.name}`)

  // preflight: every leg blueprint must parse + validate through the built
  // domain (the same parseBlueprint the production row uses) — catches YAML
  // or schema mistakes before any boot.
  for (const leg of LEGS) {
    const src = blueprintDoc(leg.bpId, leg.workerCaps)
    try {
      const bp = parseBlueprint(src)
      const caps = bp.members?.[0]?.capabilities
      const policy = caps?.permissions
      log(`preflight ${leg.key}: blueprint ${bp.blueprintId} parsed; worker capabilities present=${caps !== undefined} permissions=${policy === undefined ? 'absent' : `default:${policy.default} ask:${policy.ask.length} deny:${policy.deny.length}`} builtinToolDeny=${JSON.stringify(caps?.builtinToolDeny ?? null)}`)
    } catch (error) {
      die(`preflight ${leg.key}: blueprint parse failed: ${String(error?.message ?? error).slice(0, 400)}\n--- source ---\n${src}`)
    }
  }

  let lastMock
  for (const leg of LEGS) {
    const rec0 = legRecord(leg)
    state.legs[leg.key] = rec0
    const instLogDir = join(EV, 'instances', `boot${leg.bootNum}`)
    mkdirSync(instLogDir, { recursive: true })
    let mock
    try {
      mock = await startMockModel({ port: MOCK_PORT, decide: makeDecide(leg.key), log: (l) => log(`mock ${l}`) })
      lastMock = mock
      log(`boot#${leg.bootNum} ${leg.key}: mock model listening on 127.0.0.1:${mock.port}`)
      process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${mock.port}`
      process.env.DEEPSEEK_API_KEY = 'a2c1-mock-key'
      const rec = await bootLeg(leg, mock)
      state.boots.push({ bootNum: leg.bootNum, key: leg.key, url: rec.origin, token: rec.token, logPath: join(instLogDir, `instance-port${WEB_PORT}.log`) })
      snapshotMock(mock, leg)
      switch (leg.key) {
        case 'L1': await runLegL1(rec, leg, mock); break
        case 'L2': await runLegL2(rec, leg, mock); break
        case 'L3': await runLegL3(rec, leg, mock); break
        case 'L4': await runLegL4(rec, leg, mock); break
        case 'L5a': await runLegL5a(rec, leg, mock); break
        case 'L5b': await runLegL5b(rec, leg, mock); break
        default: throw new Error(`unknown leg ${leg.key}`)
      }
      snapshotMock(mock, leg)
      rec0.pass = rec0.assertions.length > 0 && rec0.assertions.every((a) => a.ok)
      log(`boot#${leg.bootNum} ${leg.key}: leg done — pass=${rec0.pass} (${rec0.assertions.length} assertions)`)
      if (leg.key !== 'L5b') {
        await stopLeg(rec, leg)
        await mock.close()
      }
    } catch (error) {
      rec0.error = String(error?.stack ?? error).slice(0, 4000)
      rec0.pass = false
      log(`boot#${leg.bootNum} ${leg.key}: LEG FAILED — ${String(error?.message ?? error).slice(0, 600)}`)
      // failure-path diagnostics: mock traffic + row state + instance log tail
      try {
        if (mock !== undefined) snapshotMock(mock, leg)
        const stFail = await p6t6State({ origin: `http://127.0.0.1:${WEB_PORT}` })
        if (stFail !== null) {
          writeFileSync(join(instLogDir, 'state-at-failure.json'), JSON.stringify(stFail, null, 2))
          log(`boot#${leg.bootNum} ${leg.key}: state-at-failure saved (members=${stFail.members?.length ?? 0} control=${JSON.stringify(controlSlice(stFail)).slice(0, 300)})`)
        }
        const lastInst = instances[instances.length - 1]
        if (lastInst !== undefined && existsSync(lastInst.logPath)) {
          writeFileSync(join(instLogDir, 'instance-log-tail-at-failure.txt'), logTail(lastInst.logPath, 60))
        }
      } catch (diagError) {
        log(`boot#${leg.bootNum} ${leg.key}: diagnostics capture failed: ${String(diagError?.message ?? diagError).slice(0, 200)}`)
      }
      if (mock !== undefined) { try { await mock.close() } catch { /* */ } }
      const last = instances[instances.length - 1]
      if (last !== undefined && last.booted) { try { await last.stop({ timeoutMs: 15_000 }) } catch { /* */ } }
      await waitPortReleased(WEB_PORT, 60_000)
      // continue to teardown: the remaining legs are recorded as not-run
      writeFileSync(join(EV, 'live-legs-live-proof-state.json'), JSON.stringify(state, null, 2))
      break
    }
  }

  // teardown: stop any still-live instance, close the last leg's mock (L5b's
  // mock is not closed per-leg above), verify port free (bounded grace),
  // post git state
  for (const inst of instances) {
    if (inst.booted) { try { await inst.stop({ timeoutMs: 20_000 }) } catch { /* */ } }
  }
  if (lastMock !== undefined) { try { await lastMock.close() } catch { /* */ } }
  const webFreeNow = await waitPortReleased(WEB_PORT, 60_000)
  log(`teardown: instance stopped, port ${WEB_PORT} released=${webFreeNow}`)

  // live-legs artifact
  const legsOut = {}
  for (const leg of LEGS) {
    const r = state.legs[leg.key]
    legsOut[leg.key] = r === undefined
      ? { key: leg.key, policy: leg.policy, root: leg.root, pass: false, error: 'NOT RUN (a preceding leg failed; see live-boot log)' }
      : {
        key: r.key, policy: r.policy, root: r.root, bootNum: r.bootNum, pass: r.pass,
        ...(r.error !== null ? { error: r.error } : {}),
        assertions: r.assertions,
        evidence: r.evidence,
      }
  }
  writeFileSync(join(EV, `live-legs-${STAMP}.json`), JSON.stringify({
    stamp: STAMP, nonce: NONCE, home: HOME, webPort: WEB_PORT, mockPort: MOCK_PORT,
    summary: Object.fromEntries(LEGS.map((l) => [l.key, legsOut[l.key]?.pass === true ? 'PASS' : legsOut[l.key]?.error === undefined ? 'FAIL' : 'NOT-RUN'])),
    legs: legsOut,
  }, null, 2))
  log(`live-legs-${STAMP}.json written`)
  log(`=== A2C-1 LIVE PROOF finished ===`)
  writeFileSync(join(EV, 'live-proof-run-state.json'), JSON.stringify(state, null, 2))
  // Explicit clean exit: run #8 proved a lingering handle (the last leg's mock
  // server) keeps the process alive past all artifacts. Exit once the
  // artifacts are final so the job's process cannot outlive its evidence.
  process.exit(0)
}

main().catch((error) => {
  log(`FATAL (main): ${error?.stack ?? error}`)
  process.exit(1)
})
