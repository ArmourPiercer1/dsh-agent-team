#!/usr/bin/env node
/**
 * t12-vertical.mjs — the T12 vertical-slice E2E runner (plan §10–§12).
 *
 * A standalone runner that EXTENDS the PATTERN of packages/tools/harness/run.mjs
 * (the 17-scenario legacy harness — BYTE-IDENTICAL, untouched): the same
 * public profile-patch seam, the same production dist host row, the same
 * DshInstance boot chain, the same multi-frame zstd durable-log reader — but
 * driving the T12 vertical scenarios against REAL DSH agents/sessions through
 * a deterministic local DeepSeek-compatible mock (mock-deepseek.mjs) reached
 * only via the launch environment (DEEPSEEK_BASE_URL / DEEPSEEK_API_KEY), so
 * every model call goes through the real dsh-llm adapter + SSE + agent loop +
 * durable session log.
 *
 * The eight scenarios (each {criterion, pass, durationMs, assertions, evidence}
 * in summary.json):
 *
 *   V1        fresh Root — minimal legal Team create through the production
 *             row create path; TeamSession durable; fresh RootBinding; leader
 *             identity valid; REAL Root Agent under DSH_HOME whose session
 *             header cwd == W_root (session meta, not projection); ZERO
 *             synthetic worker/scout rows (seedMembers stays []).
 *   V2        real Member — real DSH child Session, cwd == W_child, persona
 *             installed and visible in the REAL prompt assembly (mock capture
 *             of the system prompt), effective model from the row's static
 *             selection; the mcpServer:null config variant (world B) does not
 *             crash.
 *   V3        real policy — external hard DENY of the mcp capability + a
 *             Team/member override ALLOW => mcp remains denied at the ACTUAL
 *             consumption boundary (the model request's tool schema omits the
 *             mcp tool, the agent loop fails the call, no mcp mount is
 *             established) — not just in the projection.
 *   V4        delegate real work — the exact task text T12_VERTICAL_TASK_<nonce>
 *             reaches the real child session log; the real turn against the
 *             mock completes; durable truth settles.
 *   V5        Projection/Remote — TeamProjection read through the BROWSER-
 *             FACING public Remote mounted endpoint (/team-remote) after Lane C
 *             M4; the test side NEVER uses TeamDomain direct reads as an
 *             assertion source.
 *   HANDOFF   plan §11.1 — source team (world C row, root C1) + requestToken X
 *             + context C => target team B1 (distinct minted identity, real
 *             target Root Agent, C reaches it in the durable log); then a
 *             DIFFERENT source team (world B row, root B) + the SAME requestToken
 *             X => a DIFFERENT target identity B2 (the B5 composite).
 *   LIFECYCLE plan §11.2 — real archive of a member with a live background
 *             descendant (TRULY recursive drain through the real subagents
 *             service, honest numeric drained count), restore, then a real
 *             follow-up turn; NO fake quiescent=true (the quiescence gate
 *             rejects non-true drains with LIFECYCLE_NOT_QUIESCENT).
 *   RESTART   plan §12 — fresh #1/#2 under different RootSessionIds: all
 *             observable no-collision invariants plus an honest precondition-
 *             reachability verdict (same instanceId under a different root is
 *             unreachable by construction — the canonical member spec string
 *             includes rootSessionId, packages/runtime/member-residency/
 *             identity.ts); then restart/resume: same Team root / same
 *             MemberInstance / same child Session / no duplicates / projection
 *             resumes.
 *
 * Test-side channels (production surfaces only):
 *   - shipped team tools (team_create_member / team_delegate) through the
 *     pattern-sanctioned observability seam POST /__p6t6/tool — the same
 *     executeTool entry the agent loop itself calls;
 *   - team/projection/lifecycle/policy/handoff reads+writes through
 *     POST /team-remote/<method> — the browser-facing public Remote,
 *     cookie-authed, the channel the browser UI uses;
 *   - user turns through POST /api/session/prompt — the DSH core public
 *     Remote channel, cookie-authed, the browser-facing chat path;
 *   - diagnostics ONLY (never an assertion source for V5): GET
 *     /__p6t6/state and GET /__p6t6/health.
 *
 * Anti-cheat (plan §10.1): the SHIPPED production dist host row is mounted
 * via the profile patch; seedMembers stays []; child session ids are
 * DISCOVERED from durable session logs under DSH_HOME (no hardcoded legacy
 * ids); the mock model is reached only through the real DSH lifecycle.
 *
 * Remote value shapes (verified against packages/remote/src/contracts/types.ts
 * + handlers): member.create/send/followup -> {outcome:{status:'executed',
 * effect, targetInstanceId, ...}}; member.archive -> {member, steps,
 * settledCommitted, drained:number, residencyDropped}; member.restore ->
 * {member, steps}; override.set -> {record}; handoff.prepare -> {summary,
 * sourceSessionId}; handoff.create -> {state:<HandoffOperationState>}.
 *
 * Usage:
 *   node packages/tools/harness/t12-vertical.mjs [--phases build,fresh1,fresh2,restart1,handoff]
 *   node packages/tools/harness/t12-vertical.mjs --phases smoke   (world A boot smoke)
 *
 * Fresh worlds (fail CLOSED if the home exists non-empty; re-runs require
 * deleting the home dirs first):
 *   A  references/.dsh-test-t12-a  port 3181 (fresh #1 create) / 3182 (resume)
 *   B  references/.dsh-test-t12-b  port 3183 (fresh #2 create; instance stays
 *      alive as the handoff second-source team)
 *   C  references/.dsh-test-t12-c  port 3184 (handoff first-source team create)
 * Mock model endpoint: 127.0.0.1:3496 (one per runner invocation, shared).
 * Mini MCP server:     127.0.0.1:3492 (world A row config only).
 *
 * Evidence (MAIN repo dev/agent-workflow/evidence/T12/, prefix t12v-):
 *   t12v-run.log, t12v-build-dist.log, t12v-fresh1.log, t12v-fresh2.log,
 *   t12v-restart1.log, t12v-handoff-lifecycle.log, t12v-smoke.log,
 *   t12v-testuse-pre.txt, t12v-testuse-post.txt, t12v-port3080-pre.txt,
 *   t12v-port3080-post.txt, t12v-mock-capture.json, t12v-state.json, summary.json
 */

import {
  appendFileSync,
  copyFileSync,
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import { randomBytes } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { zstdDecompressSync } from 'node:zlib'

import {
  DshInstance,
  ensureProfile,
} from '../../../tests/characterization/lib/instance.mjs'
import {
  logTail,
  portInUse,
  spawnToLog,
  walk,
  waitForLogLine,
  waitForPortFree,
} from '../../../tests/characterization/lib/util.mjs'
import { captureGitState } from '../../../tests/characterization/lib/tree-clean.mjs'
import { closeMiniServer, startMiniMcpServer } from '../../runtime/root-binding/harness/mini-mcp.mjs'
import { startMockModel } from './mock-deepseek.mjs'

// ── paths & constants ──────────────────────────────────────────────────────

const HERE = dirname(fileURLToPath(import.meta.url))
const WORKTREE_ROOT = resolve(HERE, '..', '..', '..')

/** Walk up from the worktree to the ancestor holding the test-use tree. */
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
const EVIDENCE_DIR = join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence', 'T12')
const INSTANCES_DIR = join(EVIDENCE_DIR, 'instances')

const CLIENT_COMMIT_HASH = 'cd5ef814'
const STABLE_URL = 'http://127.0.0.1:3080/'
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=[A-Za-z0-9_-]+/

const PRODUCTION_ROW_NAME = pathToFileURL(
  join(WORKTREE_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js')
).href

const NONCE = `${Date.now().toString(36)}${randomBytes(3).toString('hex')}`
const TASK_TEXT = `T12_VERTICAL_TASK_${NONCE}`
const C_TEXT = `T12V_HANDBACK_CTX_${NONCE}`
const REQUEST_TOKEN_X = `t12v-handoff-X-${NONCE}`

const MOCK_PORT = 3496
const MINI_PORT = 3492
const PORT_A1 = 3181
const PORT_A2 = 3182
const PORT_B = 3183
const PORT_C = 3184

const HOME_A = join(REPO_ROOT, 'references', '.dsh-test-t12-a')
const HOME_B = join(REPO_ROOT, 'references', '.dsh-test-t12-b')
const HOME_C = join(REPO_ROOT, 'references', '.dsh-test-t12-c')

const ROOT_A = `session-t12v-a-root-${NONCE}`
const ROOT_B = `session-t12v-b-root-${NONCE}`
const ROOT_C1 = `session-t12v-c1-root-${NONCE}`

const W_ROOT_A = 'C:/agent-team/work/t12v/a'
const W_CHILD_A = 'C:/agent-team/work/t12v/child-a'
const W_ROOT_B = 'C:/agent-team/work/t12v/b'
const W_CHILD_B = 'C:/agent-team/work/t12v/child-b'
const W_ROOT_C = 'C:/agent-team/work/t12v/c'

const MCP_SERVER_NAME = 't12vmini'
const MCP_PING_TOOL = `mcp__${MCP_SERVER_NAME}__ping`
const LEADER_INSTANCE_ID = 'inst-leader'

const EXPECTED_TOOL_COUNT = 10

/**
 * The admission-caller claim for browser-facing public Remote calls.
 *
 * s6-principal.ts (deriveAdmissionCaller, L249-257): a `caller` with
 * kind 'human' is accepted only when `humanId` EXACTLY equals the bound root
 * session id of this host — the host-known operator of the connection gate is
 * the bound root session itself (any other humanId => TEAM_REMOTE_PRINCIPAL_INVALID
 * reason 'spoofed-human'). An instance claim must resolve to a durable member
 * row (L259-267), so the ROOT session id cannot be claimed as an instance.
 * => every remote call in world W must claim {kind:'human', humanId: ROOT_W}.
 */
function humanCaller(rootSessionId) {
  return { kind: 'human', humanId: rootSessionId }
}

// ── blueprint documents (known-good structure; one worker template) ────────
// NOTE: persona values are DOUBLE-QUOTED — a YAML plain scalar may not
// contain ": " and the blueprint parser (yaml) is strict.

function blueprintDoc(world, bpId) {
  return [
    '---',
    'schemaVersion: 1',
    `blueprintId: ${bpId}`,
    'revision: "1"',
    'leader:',
    '  templateId: leader',
    `  persona: "T12V leader persona world ${world.toUpperCase()}: you lead the t12v ${world} vertical E2E team."`,
    'members:',
    '  - templateId: worker',
    `    displayName: "T12V Worker ${world.toUpperCase()}"`,
    `    persona: "T12V worker persona world ${world.toUpperCase()}: you are the deterministic t12v-${world} worker."`,
    'requirements:',
    '  - domain: tool',
    '    name: web',
    '    optional: true',
    '  - domain: skill',
    '    name: base',
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
    '    description: "The t12v default state."',
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

const BLUEPRINTS = {
  a: { bpId: 't12v-bp-a', doc: blueprintDoc('a', 't12v-bp-a') },
  b: { bpId: 't12v-bp-b', doc: blueprintDoc('b', 't12v-bp-b') },
  c: { bpId: 't12v-bp-c', doc: blueprintDoc('c', 't12v-bp-c') },
}

// ── the production row config (T12 values; seedMembers stays []) ───────────

function teamRowConfig({ bootPhase, rootSessionId, world, mcpPort }) {
  const externalPolicyFacts = world === 'a'
    // V3: the external stage-1 HARD deny of the mcp capability (cell is
    // capability-scoped; model stays granted-by-existence so the model cell
    // resolves to the row static selection).
    ? { hard: { mcp: { kind: 'deny' } }, capabilityExists: { mcp: true, model: true } }
    : { hard: {}, capabilityExists: {} }
  const defaultWorkspace = world === 'a' ? W_ROOT_A : world === 'b' ? W_ROOT_B : W_ROOT_C
  return {
    rootSessionId,
    bootPhase,
    blueprintSource: BLUEPRINTS[world].doc,
    seedMembers: [],
    defaultWorkspace,
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: `t12v-model-${world}` },
    deniedSelection: { provider: 't12v-denied', model: 't12v-denied' },
    mcpServer: mcpPort === null ? null : { name: MCP_SERVER_NAME, port: mcpPort },
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
    ],
    externalPolicyFacts,
    // Row-owned plain-JS module URLs (the live FINAL agent-bindings glue;
    // no TestAgentBindings — the real agents.create/resume boundary).
    // The glue's relative imports (domain/blueprint, agent-setup/persona)
    // only resolve from INSIDE the single dist tree (rootDir = packages/),
    // so the build step places a byte-identical copy there and the row
    // points at the dist copy; the implementation itself is unmodified.
    glueUrl: pathToFileURL(join(WORKTREE_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs')).href,
    seamUrl: pathToFileURL(join(WORKTREE_ROOT, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href,
  }
}

// ── profile-patch YAML emitter (hand-rolled, the DSH patch dialect) ────────

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

function writeTeamPatchFile(patchPath, world, bootPhase, rootSessionId, mcpPort, comment) {
  mkdirSync(dirname(patchPath), { recursive: true })
  const lines = [
    `# T12 vertical harness patch layer (${comment}): production dsh-agent-team row (built packages/runtime host) + observability p6t6-team-tools row, mounted ONLY through this public profile-patch seam.`,
    '- insert:',
    ...yamlEmitItem({
      id: 'dsh-agent-team',
      name: PRODUCTION_ROW_NAME,
      config: teamRowConfig({ bootPhase, rootSessionId, world, mcpPort }),
    }, 2),
    ...yamlEmitItem({
      id: 'p6t6-team-tools',
      name: pathToFileURL(join(HERE, 'plugin.mjs')).href,
    }, 2),
    '',
  ]
  writeFileSync(patchPath, lines.join('\n'))
}

// ── production runtime build (the sanctioned dist recipe) ──────────────────

async function buildProductionRuntime(log) {
  const logPath = join(EVIDENCE_DIR, 't12v-build-dist.log')
  mkdirSync(EVIDENCE_DIR, { recursive: true })
  const stamp = (line) => {
    appendFileSync(logPath, `${line}\n`)
    log(line)
  }
  stamp(`== T12-V build dist ${new Date().toISOString()} ==`)
  const tscBin = join(WORKTREE_ROOT, 'node_modules', 'typescript', 'bin', 'tsc')
  const legacyTsconfig = join(WORKTREE_ROOT, 'packages', 'legacy', 'tsconfig.build.json')
  const runtimeTsconfig = join(WORKTREE_ROOT, 'packages', 'runtime', 'tsconfig.build.json')
  const legacyResult = await spawnToLog(
    process.execPath,
    [tscBin, '-p', legacyTsconfig],
    { cwd: WORKTREE_ROOT, logPath: join(INSTANCES_DIR, 'build-legacy.log'), timeoutMs: 300_000 },
  )
  stamp(`== legacy exit ${legacyResult.ok ? 0 : legacyResult.exitCode ?? 'n/a'} ==`)
  if (!legacyResult.ok) {
    stamp(tailText(legacyResult.text, 40))
    throw new Error(`T12-V legacy dist build failed: ${tailText(legacyResult.text, 20)}`)
  }
  const result = await spawnToLog(
    process.execPath,
    [tscBin, '-p', runtimeTsconfig],
    { cwd: WORKTREE_ROOT, logPath: join(INSTANCES_DIR, 'build-runtime.log'), timeoutMs: 300_000 },
  )
  stamp(`== runtime exit ${result.ok ? 0 : result.exitCode ?? 'n/a'} ==`)
  if (!result.ok) {
    stamp(tailText(result.text, 40))
    throw new Error(`T12-V production runtime build failed: ${tailText(result.text, 20)}`)
  }
  // tsc never emits .mjs: place the FINAL glue byte-identically at its dist
  // location so its relative imports resolve to the compiled sibling entries
  // in this one dist tree (dist/packages/domain/..., dist/packages/runtime/
  // agent-setup/...). Environment wiring only — the source file is untouched.
  const glueSrc = join(WORKTREE_ROOT, 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs')
  const glueDist = join(WORKTREE_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs')
  if (!existsSync(glueSrc)) throw new Error(`glue source missing: ${glueSrc}`)
  mkdirSync(dirname(glueDist), { recursive: true })
  copyFileSync(glueSrc, glueDist)
  stamp(`== glue placed: ${glueDist} (byte-identical copy of the source .mjs) ==`)
  // Import probe: the built dist host must load under plain node (the yaml
  // bare import resolves from packages/runtime/node_modules).
  const probe = await spawnToLog(
    process.execPath,
    ['-e', `import(${JSON.stringify(PRODUCTION_ROW_NAME)}).then(m => console.log('LOADED name=' + m.name)).catch(e => { console.error('PROBE_FAIL ' + e.message); process.exit(1) })`],
    { cwd: WORKTREE_ROOT, logPath: join(INSTANCES_DIR, 'build-probe.log'), timeoutMs: 120_000 },
  )
  stamp(`== import probe exit ${probe.ok ? 0 : probe.exitCode ?? 'n/a'}: ${probe.text.trim().split('\n').pop() ?? ''} ==`)
  if (!probe.ok) throw new Error(`T12-V dist import probe failed: ${probe.text.slice(-400)}`)
  if (!probe.text.includes('LOADED name=dsh-agent-team')) throw new Error(`T12-V dist import probe unexpected output: ${probe.text.slice(-400)}`)
}

function tailText(text, lines = 12) {
  if (text === undefined || text === null) return '<no output>'
  return String(text).split('\n').slice(-lines).join('\n')
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

/**
 * Discover one session's durable log file under <DSH_HOME>/sessions by
 * walking the on-disk layout (<projectKey(cwd)>/<encoded-id>/session.jsonl.zstd)
 * and matching the SessionHeader id — NO hardcoded directory names.
 */
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

/** The immutable SessionHeader of one session (first zstd frame) or null. */
function readSessionHeader(dshHome, sessionId) {
  return findSessionFile(dshHome, sessionId)
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

/** The flattened text of one durable log (for marker containment checks). */
function logTextOf(dshHome, sessionId) {
  const log = readSessionLog(dshHome, sessionId)
  if (log === null) return null
  return log.lines.map((l) => JSON.stringify(l)).join('\n')
}

/**
 * Epoch-ms timestamp of the FIRST `turn/start` record in one session's durable
 * log, or null. Records are {type:'turn/start', seq, time, data:{turn}} — the
 * `time` field is the durable turn-open timestamp (verified against the real
 * DSH log, e.g. run #5 world-A worker child).
 */
function firstTurnStartMs(dshHome, sessionId) {
  const log = readSessionLog(dshHome, sessionId)
  if (log === null) return null
  for (const rec of log.lines) {
    if (rec !== null && typeof rec === 'object' && rec.type === 'turn/start' && typeof rec.time === 'number') return rec.time
  }
  return null
}

/**
 * Epoch-ms timestamp of the `turn/start` record that OPENS the turn containing
 * `text` in the durable log, or null. Log order per turn (verified against the
 * real DSH log): `turn/start` is written first, then the relayed `user/message`
 * carrying the text is appended — so the opener is the nearest `turn/start`
 * record immediately preceding the first record containing `text`.
 */
function turnStartBeforeText(dshHome, sessionId, text) {
  const log = readSessionLog(dshHome, sessionId)
  if (log === null) return null
  for (let i = 0; i < log.lines.length; i++) {
    if (JSON.stringify(log.lines[i]).includes(text)) {
      for (let j = i - 1; j >= 0; j--) {
        const rec = log.lines[j]
        if (rec !== null && typeof rec === 'object' && rec.type === 'turn/start' && typeof rec.time === 'number') return rec.time
      }
      return null
    }
  }
  return null
}

/**
 * Measured first-turn latency evidence: the gap between when the RUNNER issued
 * the admission call (`admittedAtMs`, epoch ms) and when the target session's
 * durable log first recorded a `turn/start`. This isolates the observed
 * intermittent ~360 s first-turn delay on freshly materialized child agents
 * (t12v-finding-360s-first-turn.md): the session log is SILENT between
 * admission and the delayed turn, so only this (admission clock, durable
 * turn/start) pair brackets the latency. Returns null when the turn never
 * started (the wait timed out).
 */
function firstTurnLatencyEvidence(dshHome, sessionId, admittedAtMs) {
  const startMs = firstTurnStartMs(dshHome, sessionId)
  return {
    admittedAtMs,
    firstTurnStartMs: startMs,
    latencyMs: startMs !== null ? startMs - admittedAtMs : null,
  }
}

/** Poll a session log until `predicate(line)` matches or the timeout passes. */
async function waitForLogLineJson(dshHome, sessionId, predicate, timeoutMs, intervalMs = 1000) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const log = readSessionLog(dshHome, sessionId)
    if (log !== null) {
      for (const line of log.lines) {
        if (predicate(line)) return line
      }
    }
    if (Date.now() >= deadline) return null
    await new Promise((r) => setTimeout(r, intervalMs))
  }
}

async function waitForLogTextContains(dshHome, sessionId, text, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const t = logTextOf(dshHome, sessionId)
    if (t !== null && t.includes(text)) return t
    if (Date.now() >= deadline) return null
    await new Promise((r) => setTimeout(r, 1000))
  }
}

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

/** Discover a descendant session of `parentId` via durable session headers. */
async function waitForDescendantSession(dshHome, parentId, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    const root = join(dshHome, 'sessions')
    if (existsSync(root)) {
      for (const entry of walk(root, [])) {
        if (!entry.name.endsWith('session.jsonl.zstd')) continue
        try {
          const header = parseFirstJsonLine(readFileSync(entry.path))
          if (header?.parentSession === parentId) return { id: header.id, origin: header.origin, delegationDepth: header.delegationDepth, file: entry.path }
        } catch { /* skip */ }
      }
    }
    if (Date.now() >= deadline) return null
    await new Promise((r) => setTimeout(r, 1000))
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

/** One browser-facing public Remote call: POST /team-remote/<method>. */
async function remoteCall(origin, cookie, method, params) {
  const { status, body } = await fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `t12v-${randomBytes(6).toString('hex')}`,
      method,
      payload: { version: 1, params },
    }),
  }, 180_000)
  return { status, body }
}

/** One user turn on the DSH core public channel: POST /api/session/prompt. */
async function apiPrompt(origin, cookie, sessionId, text) {
  const { status, body } = await fetchJson(`${origin}/api/session/prompt`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({
      type: 'client-request',
      rpcId: `t12v-${randomBytes(6).toString('hex')}`,
      method: 'session/prompt',
      payload: {
        args: {
          request: {
            requestId: `t12v-${randomBytes(6).toString('hex')}`,
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

/** One shipped team tool through the pattern-sanctioned observability seam. */
async function p6t6Tool(port, name, args, as) {
  const { status, body } = await fetchJson(`http://127.0.0.1:${port}/__p6t6/tool`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, args, as }),
  }, 180_000)
  return { status, body }
}

/** Row state diagnostics (NEVER an assertion source for V5). */
async function p6t6State(port) {
  const { status, body } = await fetchJson(`http://127.0.0.1:${port}/__p6t6/state`, undefined, 30_000)
  return { status, body }
}

/**
 * Poll the row state until it returns the WELL-FORMED body for the expected
 * root + phase (directive echo + durable TeamSession row). The row's bootstrap
 * (createAndStartTeam / resume reconciliation) is asynchronous with respect to
 * the health gate, so an immediate state query can land in a transient window
 * and receive an error-shaped body (observed on a real boot: world B fresh #2
 * got a non-state body ~ms after row-ready, while the very next tool call
 * succeeded). The state route stays a diagnostic: this only waits for shape.
 */
async function p6t6StateReady(port, { rootSessionId, phase, timeoutMs = 60_000, intervalMs = 500 }) {
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

/**
 * LENIENT sibling of p6t6StateReady: polls until the well-formed body appears
 * or the (short) deadline passes, then RETURNS {ok, body?, error?} instead of
 * throwing. For worlds where a state-route defect is suspected: the boot
 * health gate (bootWorld) already proved the instance is up, and the remote
 * teamSessionId parameter is the ROOT session id itself (invariant 9), so a
 * broken state route is an evidence finding, not a run abort.
 */
async function p6t6StateProbe(port, { rootSessionId, phase, timeoutMs = 10_000, intervalMs = 500 }) {
  const deadline = Date.now() + timeoutMs
  let last = await p6t6State(port)
  for (;;) {
    const b = last.body
    if (last.status === 200 && b !== null && typeof b === 'object'
      && b.rootSessionId === rootSessionId && b.phase === phase
      && b.teamSession !== null && typeof b.teamSession === 'object'
      && b.teamSession.rootSessionId === rootSessionId) {
      return { ok: true, body: b }
    }
    if (Date.now() >= deadline) {
      return { ok: false, error: `row state not well-formed within ${timeoutMs}ms (expected rootSessionId=${rootSessionId} phase=${phase}); last: status=${last.status} body=${JSON.stringify(last.body).slice(0, 300)}` }
    }
    await new Promise((r) => setTimeout(r, intervalMs))
    last = await p6t6State(port)
  }
}

/**
 * Forensic read of the durable leader member row from the row's own durable
 * store (<DSH_HOME>/storages/team_domain.json) — evidence only (root-cause
 * documentation); never an assertion source for live behavior.
 */
function readDurableLeaderRow(dshHome, rootSessionId) {
  try {
    const raw = JSON.parse(readFileSync(join(dshHome, 'storages', 'team_domain.json'), 'utf8'))
    const table = raw?.tables?.member_instances ?? {}
    for (const [key, value] of Object.entries(table)) {
      if (key.startsWith('__')) continue
      let k
      try { k = JSON.parse(key) } catch { continue }
      if (k.instanceId !== LEADER_INSTANCE_ID || k.rootSessionId !== rootSessionId) continue
      return JSON.parse(value)
    }
    return null
  } catch (error) {
    return { readError: String(error?.message ?? error) }
  }
}

async function p6t6Health(port) {
  const { status, body } = await fetchJson(`http://127.0.0.1:${port}/__p6t6/health`, undefined, 10_000)
  return { status, body }
}

/** Unwrap a remote result envelope: {ok:true, value} -> value.data.
 *  dispatch.ts L166 wraps every success value as {data, provenance}
 *  (Invariant 6: lossless check + provenance on the success value), so
 *  consumers receive the inner data object ({outcome}, {projection},
 *  {record}, {member, steps}, {summary, sourceSessionId}, ...). */
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
  if (result.status !== 200) throw new Error(`${name}: HTTP ${status0(result)}: ${JSON.stringify(result.body).slice(0, 400)}`)
  if (result.body?.ok !== true) throw new Error(`${name}: tool error: ${JSON.stringify(result.body).slice(0, 800)}`)
  const value = result.body.value
  if (value?.status === 'rejected') throw new Error(`${name}: rejected: ${JSON.stringify(value.effect ?? value).slice(0, 800)}`)
  return value
}

function status0(result) {
  return result.status
}

/** Unwrap a remote admission outcome value: {outcome:{status:'executed',...}}. */
function admissionOutcome(value, method) {
  const outcome = value?.outcome
  if (outcome === undefined || outcome?.status !== 'executed') {
    throw new Error(`${method}: unexpected outcome value: ${JSON.stringify(value).slice(0, 600)}`)
  }
  return outcome
}

// ── scenario context ───────────────────────────────────────────────────────

function makeScenarioCtx(criterion) {
  const c = {
    criterion,
    t0: Date.now(),
    assertions: [],
    evidence: {},
    notes: [],
    error: null,
  }
  c.check = (name, ok, detail) => {
    c.assertions.push({ name, ok: ok === true, detail: detail === undefined ? undefined : String(detail).slice(0, 2000) })
    return ok === true
  }
  c.note = (text) => c.notes.push(String(text))
  c.finish = (extraEvidence) => ({
    criterion,
    pass: c.error === null && c.assertions.length > 0 && c.assertions.every((a) => a.ok),
    durationMs: Date.now() - c.t0,
    assertions: c.assertions,
    evidence: { ...c.evidence, ...(extraEvidence ?? {}) },
    notes: c.notes,
    ...(c.error !== null ? { error: String(c.error).slice(0, 4000) } : {}),
  })
  return c
}

// ── the mock model's deterministic decide table ────────────────────────────

function makeDecide() {
  return (ctx) => {
    // startMockModel calls decide({ seq, req }) with req = the parsed body;
    // tolerate a bare body too.
    const body = ctx?.req ?? ctx
    const msgs = Array.isArray(body?.messages) ? body.messages : []
    const last = [...msgs].reverse().find((m) => m && (m.role === 'user' || m.role === 'tool'))
    const text = last === undefined ? '' : String(typeof last.content === 'string' ? last.content : JSON.stringify(last.content))
    if (text.includes(`T12V_USE_MCP_${NONCE}`)) {
      return { kind: 'tool-call', toolCalls: [{ id: `call_t12v_${NONCE}`, name: MCP_PING_TOOL, arguments: { msg: 't12v' } }] }
    }
    if (text.includes(`T12V_SUBSPAWN_${NONCE}`)) {
      return {
        kind: 'tool-call',
        toolCalls: [{
          id: `call_sub_${NONCE}`,
          name: 'subagent',
          arguments: { description: 't12v descendant work', prompt: `T12V_DESC_TASK_${NONCE}`, run_in_background: true },
        }],
      }
    }
    // Tool-result turns: the mcp attempt (call id prefix call_t12v_) gets the
    // explicit denied-ack; any other tool result (e.g. the subagent spawn)
    // falls through to the default ack below.
    if (last?.role === 'tool' && (String(last?.tool_call_id ?? '').startsWith('call_t12v_') || text.includes(MCP_PING_TOOL))) {
      return { kind: 'text', content: `T12V_MCP_DENIED_ACK_${NONCE}` }
    }
    if (text.includes(`T12V_ROOT_FIRST_${NONCE}`)) return { kind: 'text', content: `T12V_ROOT_FIRST_ACK_${NONCE}` }
    if (text.includes(`T12V_CHILD_FIRST_${NONCE}`)) return { kind: 'text', content: `T12V_CHILD_FIRST_ACK_${NONCE}` }
    if (text.includes(TASK_TEXT)) return { kind: 'text', content: `T12V_TASK_ACK_${NONCE}` }
    if (text.includes(`T12V_DESC_TASK_${NONCE}`)) return { kind: 'text', content: `T12V_DESC_ACK_${NONCE}` }
    if (text.includes(`T12V_FOLLOWUP_${NONCE}`)) return { kind: 'text', content: `T12V_FOLLOWUP_ACK_${NONCE}` }
    if (text.includes(`T12V_RESTART_FOLLOWUP_${NONCE}`)) return { kind: 'text', content: `T12V_RESTART_ACK_${NONCE}` }
    if (text.includes(C_TEXT)) return { kind: 'text', content: `T12V_HANDBACK_ACK_${NONCE}` }
    return { kind: 'text', content: `T12V_DEFAULT_ACK_${NONCE}` }
  }
}

// ── logging / phase plumbing ───────────────────────────────────────────────

const argv = process.argv.slice(2)
const phaseArg = argv.find((a, i) => argv[i - 1] === '--phases')
const PHASES = (phaseArg ?? 'build,fresh1,fresh2,restart1,handoff').split(',').map((s) => s.trim()).filter(Boolean)

function hasPhase(name) {
  return PHASES.includes(name)
}

const scenarioResults = {}
const liveWorlds = new Set()
let mock = null
let mini = null

const phaseFiles = {
  build: null, // owned by the build stamp
  smoke: join(EVIDENCE_DIR, 't12v-smoke.log'),
  fresh1: join(EVIDENCE_DIR, 't12v-fresh1.log'),
  fresh2: join(EVIDENCE_DIR, 't12v-fresh2.log'),
  restart1: join(EVIDENCE_DIR, 't12v-restart1.log'),
  handoff: join(EVIDENCE_DIR, 't12v-handoff-lifecycle.log'),
}
let currentPhase = null

function log(line) {
  const stamped = `[${new Date().toISOString()}] ${line}`
  console.log(stamped)
  try {
    appendFileSync(join(EVIDENCE_DIR, 't12v-run.log'), `${stamped}\n`)
  } catch { /* evidence dir not ready yet */ }
  if (currentPhase !== null && phaseFiles[currentPhase] !== null && phaseFiles[currentPhase] !== undefined) {
    try {
      appendFileSync(phaseFiles[currentPhase], `${stamped}\n`)
    } catch { /* ignore */ }
  }
}

function setPhase(name) {
  currentPhase = name
  const p = phaseFiles[name]
  if (p !== null && p !== undefined) {
    mkdirSync(EVIDENCE_DIR, { recursive: true })
    appendFileSync(p, `== T12 phase ${name} ${new Date().toISOString()} ==\n`)
  }
}

// Cross-process (partial-run) state: the durable identities the later phases
// need, plus the RESTART identity-part assertions for separate-process runs.
function saveState(extra) {
  try {
    const st = {
      nonce: NONCE,
      a1: scenarioResults.__a1 ?? null,
      restartIdentity: scenarioResults.__restartIdentity === undefined
        ? loadStateRef()?.restartIdentity ?? null
        : { criterion: scenarioResults.__restartIdentity.criterion, assertions: scenarioResults.__restartIdentity.assertions, evidence: scenarioResults.__restartIdentity.evidence, notes: scenarioResults.__restartIdentity.notes },
      ...(extra ?? {}),
    }
    writeFileSync(join(EVIDENCE_DIR, 't12v-state.json'), JSON.stringify(st, null, 2))
  } catch (error) {
    log(`state save failed: ${error?.message ?? error}`)
  }
}

function loadStateRef() {
  try {
    const p = join(EVIDENCE_DIR, 't12v-state.json')
    if (!existsSync(p)) return null
    const st = JSON.parse(readFileSync(p, 'utf8'))
    if (st.nonce !== NONCE) return null
    return st
  } catch {
    return null
  }
}

function loadPreviousSummary() {
  try {
    const p = join(EVIDENCE_DIR, 'summary.json')
    if (!existsSync(p)) return null
    const s = JSON.parse(readFileSync(p, 'utf8'))
    if (s.nonce !== NONCE) return null
    return s
  } catch {
    return null
  }
}

// ── world boot / stop ──────────────────────────────────────────────────────

function assertFreshHome(home, label) {
  if (existsSync(home)) {
    const entries = readdirSync(home)
    if (entries.length > 0) {
      throw new Error(`${label}: DSH home ${home} exists and is non-empty (${entries.length} entries) — fail CLOSED; delete it to re-run`)
    }
  }
  mkdirSync(home, { recursive: true })
}

async function bootWorld({ label, world, dshHome, port, boot, bootPhase, rootSessionId, mcpPort }) {
  const instLogDir = join(INSTANCES_DIR, label)
  mkdirSync(instLogDir, { recursive: true })
  const instance = new DshInstance({
    hostTree: HOST_TREE,
    dshHome,
    port,
    clientCommitHash: CLIENT_COMMIT_HASH,
    logDir: instLogDir,
  })
  const rec = {
    label, world, dshHome, port, boot, bootPhase, rootSessionId,
    instance,
    logPath: null,
    url: null,
    token: null,
    cookie: null,
    origin: null,
    bootMarkerLine: null,
    health: null,
    dumpPath: null,
    rowMounted: null,
    teamSession: null,
  }
  const profile = await ensureProfile({ instance, log, timeoutMs: 90_000 })
  log(`${label}: profile ${profile.created ? 'created via throwaway boot' : 'already initialized'}`)
  writeTeamPatchFile(instance.patchFile, world, bootPhase, rootSessionId, mcpPort, label)
  log(`${label}: patch layer written to ${instance.patchFile}`)
  const directive = { boot, phase: bootPhase, reportDir: EVIDENCE_DIR, runStamp: NONCE, rootSessionId, mcpPort }
  writeFileSync(join(dshHome, 'p6t6-directive.json'), JSON.stringify(directive, null, 2))
  log(`${label}: directive written (boot=${boot} phase=${bootPhase})`)
  const started = await instance.start({ timeoutMs: 180_000 })
  rec.url = started.url
  rec.logPath = started.logPath
  rec.bootMarkerLine = await waitForLogLine(started.logPath, BOOT_MARKER, 30_000, () => true)
  if (rec.bootMarkerLine === null) throw new Error(`${label}: boot marker not found in ${started.logPath}`)
  const markerMatch = BOOT_MARKER.exec(rec.bootMarkerLine)
  const token = rec.bootMarkerLine.slice(rec.bootMarkerLine.indexOf('token=') + 6).trim()
  rec.token = token
  rec.origin = `http://127.0.0.1:${markerMatch[1]}`
  rec.cookie = await authenticate(rec.origin, token)
  log(`${label}: booted at ${rec.origin}; auth cookie exchanged`)
  const dump = await instance.dumpConfig({ timeoutMs: 60_000 })
  rec.dumpPath = join(INSTANCES_DIR, label, 'dump-config.txt')
  writeFileSync(rec.dumpPath, dump.text)
  rec.rowMounted = {
    'dsh-agent-team': DshInstance.rowInDump(dump.text, { id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME }),
    'p6t6-team-tools': DshInstance.rowInDump(dump.text, { id: 'p6t6-team-tools', name: pathToFileURL(join(HERE, 'plugin.mjs')).href }),
  }
  // Row health (the plugin ready gate + tool registration).
  const deadline = Date.now() + 180_000
  for (;;) {
    const hb = await p6t6Health(port)
    rec.health = { status: hb.status, body: hb.body }
    if (hb.status === 200 && hb.body?.ok === true && hb.body?.toolCount === EXPECTED_TOOL_COUNT) break
    // A reported setupError is definitive (bootstrap rejected; the row's fail()
    // latches it for the process lifetime) — fail fast instead of waiting out
    // the full window.
    if (hb.status === 200 && hb.body?.ok === false && hb.body?.setupError !== undefined) {
      throw new Error(`${label}: row setup failed — setupError: ${String(hb.body.setupError).slice(0, 400)}; log tail:\n${logTail(rec.logPath, 20)}`)
    }
    if (Date.now() >= deadline) throw new Error(`${label}: row health not ready in 180s — health=${JSON.stringify(hb.body).slice(0, 400)}; log tail:\n${logTail(rec.logPath, 20)}`)
    await new Promise((r) => setTimeout(r, 1000))
  }
  log(`${label}: row ready — toolCount=${rec.health.body.toolCount}`)
  liveWorlds.add(rec)
  return rec
}

async function stopWorld(rec) {
  try {
    const res = await rec.instance.stop({ timeoutMs: 15_000 })
    const portFree = await waitForPortFree(rec.port, 15_000)
    log(`${rec.label}: stopped (portFree=${portFree}, ${JSON.stringify(res ?? {}).slice(0, 200)})`)
  } finally {
    liveWorlds.delete(rec)
  }
}

async function sweepLiveWorlds() {
  for (const rec of [...liveWorlds]) {
    log(`sweep: stopping still-live world ${rec.label}`)
    await stopWorld(rec)
  }
}

// ── runtime module resolution wiring (worktree node_modules only) ──────────
//
// The production row's DYNAMIC imports (seam.mjs, agent-bindings.mjs) load at
// boot, outside the static graph the dist import-probe covers. Their bare
// specifiers (@deepseek-ai/*, zod) resolve by the STANDARD Node walk from the
// importing file — and the row's upstream-resolver hook (module.register,
// async activation, redirect parent apps/cli/lib) only covers packages linked
// under apps/cli/node_modules. dsh-storage-domain and zod are NOT in that set,
// so the seamUrl real-seam path cannot resolve them there. We wire the worktree
// instead: pnpm-style junctions in packages/runtime/node_modules (gitignored,
// worktree-only; the host tree is never touched), each pointing at the host
// tree's pnpm hidden hoist entry for the same package. With the links in place
// both dynamic modules resolve deterministically by the standard walk, with or
// without the hook. Host tree pristine; row/glue/seam code unmodified.
const RUNTIME_LINKS = [
  ['@deepseek-ai', 'dsh-agent'],
  ['@deepseek-ai', 'dsh-llm'],
  ['@deepseek-ai', 'dsh-mcp-client'],
  ['@deepseek-ai', 'dsh-session'],
  ['@deepseek-ai', 'dsh-storage-domain'],
  [null, 'zod'],
]

function linkRuntimeNodeModules() {
  const base = join(WORKTREE_ROOT, 'packages', 'runtime', 'node_modules')
  const hoist = join(HOST_TREE, 'node_modules', '.pnpm', 'node_modules')
  mkdirSync(base, { recursive: true })
  for (const [scope, name] of RUNTIME_LINKS) {
    const label = scope ? `${scope}/${name}` : name
    const target = scope ? join(hoist, scope, name) : join(hoist, name)
    if (!existsSync(target)) {
      throw new Error(`host tree pnpm hoist has no link for ${label} at ${target} — cannot wire runtime module links`)
    }
    const scopeDir = scope ? join(base, scope) : base
    mkdirSync(scopeDir, { recursive: true })
    const link = join(scopeDir, name)
    let st = null
    try {
      st = lstatSync(link)
    } catch { /* absent — create below */ }
    if (st !== null) {
      if (st.isSymbolicLink() || st.isDirectory()) {
        // Keep only if it resolves to the exact expected hoist entry; a
        // stale or dangling link from an earlier layout gets re-linked.
        let ok = false
        try { ok = realpathSync(link) === realpathSync(target) } catch { ok = false }
        if (ok) continue
        rmSync(link, { force: true })
      } else {
        rmSync(link, { force: true })
      }
    }
    symlinkSync(target, link, 'junction')
    log(`runtime link: packages/runtime/node_modules/${label} -> ${target}`)
  }
}

// ── pre/post-flight probes ─────────────────────────────────────────────────

async function probeStableInstance() {
  try {
    const { status } = await fetchJson(STABLE_URL, undefined, 10_000)
    return { url: STABLE_URL, status }
  } catch (error) {
    return { url: STABLE_URL, status: `unreachable: ${String(error?.message ?? error).slice(0, 120)}` }
  }
}

async function writeGitState(label) {
  const sub = join(INSTANCES_DIR, label)
  mkdirSync(sub, { recursive: true })
  const git = await captureGitState(HOST_TREE, sub)
  const file = join(EVIDENCE_DIR, `t12v-testuse-${label === 'pre' ? 'pre' : 'post'}.txt`)
  writeFileSync(file, JSON.stringify({ ...git, at: new Date().toISOString() }, null, 2))
  return git
}

// ── MAIN ───────────────────────────────────────────────────────────────────

async function main() {
  mkdirSync(EVIDENCE_DIR, { recursive: true })
  mkdirSync(INSTANCES_DIR, { recursive: true })
  log(`T12 vertical runner start; nonce=${NONCE}; phases=${PHASES.join(',')}`)
  log(`worktree=${WORKTREE_ROOT}`)
  log(`repoRoot=${REPO_ROOT}`)
  log(`hostTree=${HOST_TREE}`)
  log(`evidenceDir=${EVIDENCE_DIR}`)

  // ── pre-flight: stable instance :3080, test-use pristine, ports ──────────
  const stablePre = await probeStableInstance()
  writeFileSync(join(EVIDENCE_DIR, 't12v-port3080-pre.txt'),
    `# :3080 pre-flight probe\nurl: ${STABLE_URL}\nhttpStatus: ${stablePre.status}\nat: ${new Date().toISOString()}\n`)
  log(`:3080 pre: ${stablePre.status}`)
  const gitPre = await writeGitState('pre')
  log(`test-use pre: head=${gitPre.head} statusEmpty=${gitPre.statusEmpty} diffEmpty=${gitPre.diffEmpty}`)

  const ports = { mock: MOCK_PORT, mini: MINI_PORT, a1: PORT_A1, a2: PORT_A2, b: PORT_B, c: PORT_C }
  for (const [label, port] of Object.entries(ports)) {
    if (await portInUse(port)) throw new Error(`port ${label}=${port} is already in use — refusing to start (sacred port bands must be free)`)
  }
  log(`ports free: ${JSON.stringify(ports)}`)

  // Fresh homes (fail closed on non-empty).
  assertFreshHome(HOME_A, 'world A')
  assertFreshHome(HOME_B, 'world B')
  assertFreshHome(HOME_C, 'world C')
  log('fresh homes A/B/C asserted (non-empty would fail CLOSED)')

  // Wire worktree runtime module links (gitignored node_modules junctions)
  // so the dynamic seam/glue imports resolve in real boots.
  linkRuntimeNodeModules()
  log('runtime node_modules links verified (packages/runtime/node_modules)')

  // Workspace dirs for the agent cwds (best effort — the cwd is recorded in
  // the session header regardless).
  for (const dir of [W_ROOT_A, W_CHILD_A, W_ROOT_B, W_CHILD_B, W_ROOT_C]) {
    try { mkdirSync(dir, { recursive: true }) } catch { /* outside workspace — fine */ }
  }

  // Mock model endpoint (shared across worlds) + launch environment.
  mock = await startMockModel({ port: MOCK_PORT, decide: makeDecide(), log: (l) => log(`mock: ${l}`) })
  process.env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${MOCK_PORT}`
  process.env.DEEPSEEK_API_KEY = 't12v-mock-key'
  log(`mock DeepSeek endpoint up at 127.0.0.1:${MOCK_PORT}; DEEPSEEK_BASE_URL/DEEPSEEK_API_KEY exported to instance launches`)

  mini = await startMiniMcpServer([MINI_PORT])
  if (mini.port !== MINI_PORT) throw new Error(`mini MCP server landed on ${mini.port}, expected ${MINI_PORT}`)
  log(`mini MCP server up on 127.0.0.1:${MINI_PORT}`)

  let exitCode = 0
  try {
    if (hasPhase('smoke')) {
      setPhase('smoke')
      await runSmoke()
    }
    if (hasPhase('build')) {
      setPhase('build')
      await buildProductionRuntime(log)
      log('build: production dist built + import-probed OK')
    }

    if (hasPhase('fresh1')) {
      setPhase('fresh1')
      await runFresh1()
    }

    if (hasPhase('fresh2')) {
      setPhase('fresh2')
      await runFresh2()
    }

    if (hasPhase('restart1')) {
      setPhase('restart1')
      await runRestart1()
    }

    if (hasPhase('handoff')) {
      setPhase('handoff')
      await runHandoff()
    }
  } catch (error) {
    exitCode = 1
    log(`FATAL: ${error?.stack ?? error}`)
    try {
      writeFileSync(join(EVIDENCE_DIR, 't12v-blocker.md'),
        `# T12 vertical runner blocker\n\nat: ${new Date().toISOString()}\nphases requested: ${PHASES.join(',')}\nsee t12v-run.log for the full trace\n\n## error\n\n\`\`\`\n${String(error?.stack ?? error)}\n\`\`\`\n`)
    } catch { /* ignore */ }
  } finally {
    await sweepLiveWorlds()
  }

  // ── post-flight + summary ─────────────────────────────────────────────────
  const gitPost = await writeGitState('post')
  const stablePost = await probeStableInstance()
  writeFileSync(join(EVIDENCE_DIR, 't12v-port3080-post.txt'),
    `# :3080 post-flight probe\nurl: ${STABLE_URL}\nhttpStatus: ${stablePost.status}\nat: ${new Date().toISOString()}\n`)
  log(`test-use post: head=${gitPost.head} statusEmpty=${gitPost.statusEmpty} diffEmpty=${gitPost.diffEmpty}`)
  log(`:3080 post: ${stablePost.status}`)

  // Dump the mock capture.
  const mockCapture = {
    endpoint: `http://127.0.0.1:${MOCK_PORT}`,
    totalRequests: mock.requests.length,
    requests: mock.requests.map((r) => ({
      seq: r.seq,
      receivedAt: r.receivedAt,
      status: r.status,
      model: r.body?.model,
      stream: r.body?.stream,
      messages: (r.body?.messages ?? []).map((m) => ({
        role: m.role,
        content: typeof m.content === 'string' ? m.content.slice(0, 4000) : m.content,
        ...(Array.isArray(m.tool_calls) ? { tool_calls: m.tool_calls.map((tc) => ({ id: tc.id, name: tc.function?.name, arguments: String(tc.function?.arguments ?? '').slice(0, 2000) })) } : {}),
        ...(m.tool_call_id ? { tool_call_id: m.tool_call_id } : {}),
      })),
      tools: (r.body?.tools ?? []).map((t) => t?.function?.name ?? t?.name).filter(Boolean),
      reply: r.reply,
    })),
  }
  writeFileSync(join(EVIDENCE_DIR, 't12v-mock-capture.json'), JSON.stringify(mockCapture, null, 2))
  log(`mock capture dumped: ${mock.requests.length} requests -> t12v-mock-capture.json`)

  if (mini !== null) {
    await closeMiniServer(mini)
    log('mini MCP server closed')
  }
  await mock.close()
  log('mock model endpoint closed')

  // Merge with any previous partial-run summary (same nonce) so incremental
  // phase runs accumulate into one summary.
  const prevSummary = loadPreviousSummary()
  const mergedScenarios = { ...(prevSummary?.scenarios ?? {}) }
  for (const [key, value] of Object.entries(scenarioResults)) {
    if (key === '__a1' || key === '__restartIdentity') continue
    mergedScenarios[key] = value
  }
  const CANONICAL = ['V1', 'V2', 'V3', 'V4', 'V5', 'HANDOFF', 'LIFECYCLE', 'RESTART']
  const scenarios = {}
  for (const key of CANONICAL) {
    if (mergedScenarios[key] !== undefined) scenarios[key] = mergedScenarios[key]
  }

  const summary = {
    task: 'T12 production vertical closure — vertical E2E',
    generatedAt: new Date().toISOString(),
    nonce: NONCE,
    modelPath: {
      used: 'mock-env',
      note: 'DEEPSEEK_BASE_URL=http://127.0.0.1:3496 + DEEPSEEK_API_KEY=t12v-mock-key exported to every instance launch; the real dsh-llm deepseek-official adapter resolves the launch environment, so every model call ran through the mock SSE endpoint. The qiyuan-self/qwen3.8-27b fallback was NOT used.',
      baseUrl: process.env.DEEPSEEK_BASE_URL,
      fallbackUsed: false,
    },
    ports,
    homes: { a: HOME_A, b: HOME_B, c: HOME_C },
    scenarios,
    testUsePristine: {
      pre: { head: gitPre.head, statusEmpty: gitPre.statusEmpty, diffEmpty: gitPre.diffEmpty },
      post: { head: gitPost.head, statusEmpty: gitPost.statusEmpty, diffEmpty: gitPost.diffEmpty },
      pristine: gitPre.head === gitPost.head && gitPost.statusEmpty === true && gitPost.diffEmpty === true,
    },
    port3080: { pre: stablePre.status, post: stablePost.status },
    exitCode,
  }
  writeFileSync(join(EVIDENCE_DIR, 'summary.json'), JSON.stringify(summary, null, 2))
  log(`summary written: ${join(EVIDENCE_DIR, 'summary.json')}`)
  log('T12 vertical runner done')
  process.exit(exitCode)
}

// ── phase: smoke (world A boot smoke) ──────────────────────────────────────

async function runSmoke() {
  // The smoke boots the production row, so the dist must be current: build
  // (idempotent) + glue placement + import probe before anything boots.
  await buildProductionRuntime(log)
  log('smoke: production dist built + glue placed + import-probed OK')
  const a = await bootWorld({
    label: 'SMOKE', world: 'a', dshHome: HOME_A, port: PORT_A1, boot: 1,
    bootPhase: 'create', rootSessionId: ROOT_A, mcpPort: MINI_PORT,
  })
  try {
    const st = await p6t6State(a.port)
    log(`smoke: state boot=${st.body?.boot} phase=${st.body?.phase} root=${st.body?.rootSessionId} team=${st.body?.teamSession} members=${JSON.stringify((st.body?.members ?? []).map((m) => m?.instanceId))}`)
    const header = readSessionHeader(HOME_A, ROOT_A)
    log(`smoke: root session header ${header === null ? 'NOT FOUND' : `cwd=${header.header.cwd} id=${header.header.id} file=${header.file}`}`)
    const promptRes = await apiPrompt(a.origin, a.cookie, ROOT_A, `T12V_ROOT_FIRST_${NONCE}`)
    log(`smoke: session/prompt status=${promptRes.status} body=${JSON.stringify(promptRes.body).slice(0, 300)}`)
    const ack = await waitForLogLineJson(HOME_A, ROOT_A, (l) => JSON.stringify(l).includes(`T12V_ROOT_FIRST_ACK_${NONCE}`), 120_000)
    log(`smoke: root turn ${ack === null ? 'NO ACK within 120s' : 'settled (ack in durable root log)'}`)
    const mockModels = [...new Set(mock.requests.map((r) => r.body?.model))]
    log(`smoke: mock saw models=${JSON.stringify(mockModels)} requests=${mock.requests.length}`)
  } finally {
    await stopWorld(a)
    // The smoke consumed HOME_A — restore pristine state for the real run.
    rmSync(HOME_A, { recursive: true, force: true })
    mkdirSync(HOME_A, { recursive: true })
    log('smoke: HOME_A reset to empty for the real fresh #1 run')
  }
}

// ── phase: fresh #1 (world A) — V1, V2, V3, V4, LIFECYCLE, V5 ──────────────

async function runFresh1() {
  const a = await bootWorld({
    label: 'A1', world: 'a', dshHome: HOME_A, port: PORT_A1, boot: 1,
    bootPhase: 'create', rootSessionId: ROOT_A, mcpPort: MINI_PORT,
  })
  log(`A1: rowMounted=${JSON.stringify(a.rowMounted)}`)

  let workerA = null
  let workerV4 = null

  // ── V1: fresh Root ────────────────────────────────────────────────────────
  const v1 = makeScenarioCtx('V1 fresh Root: minimal legal Team create via production row create path; durable TeamSession; fresh RootBinding; valid Leader identity; REAL Root Agent under DSH_HOME with cwd == W_root (session meta, not projection); zero synthetic members')
  try {
    const st = await p6t6StateReady(a.port, { rootSessionId: ROOT_A, phase: 'create' })
    // Invariant 9 (packages/remote/src/contracts/ids.ts L15-19): TeamSessionId ===
    // RootSessionId. The state route exposes the durable TeamSession row as an
    // OBJECT; every remote call's teamSessionId param must be the root session id STRING.
    a.teamSession = st.body?.teamSession?.rootSessionId
    v1.evidence.stateRoot = { boot: st.body?.boot, phase: st.body?.phase, rootSessionId: st.body?.rootSessionId, teamSession: st.body?.teamSession, members: (st.body?.members ?? []).map((m) => ({ instanceId: m?.instanceId, childSessionId: m?.childSessionId })) }
    v1.check('state.boot === 1 (create boot)', st.body?.boot === 1, `boot=${st.body?.boot}`)
    v1.check('state.phase === "create"', st.body?.phase === 'create', `phase=${st.body?.phase}`)
    v1.check('state.rootSessionId === ROOT_A', st.body?.rootSessionId === ROOT_A, `rootSessionId=${st.body?.rootSessionId}`)
    v1.check('TeamSession durable (row keyed by ROOT_A; invariant 9: teamSessionId === rootSessionId)', st.body?.teamSession !== null && typeof st.body.teamSession === 'object' && st.body.teamSession.rootSessionId === ROOT_A && a.teamSession === ROOT_A, `teamSession=${JSON.stringify(st.body?.teamSession)} param=${a.teamSession}`)
    const members = st.body?.members ?? []
    v1.check('members contain EXACTLY the leader (no synthetic worker/scout rows; seedMembers stayed [])',
      members.length === 1 && members[0]?.instanceId === LEADER_INSTANCE_ID,
      `members=${JSON.stringify(members.map((m) => m?.instanceId))}`)
    // The REAL Root Agent under DSH_HOME: durable session log + header cwd.
    const rootHeader = readSessionHeader(HOME_A, ROOT_A)
    v1.check('root session log materialized under DSH_HOME (real Root Agent)', rootHeader !== null, rootHeader?.file ?? '<not found>')
    v1.evidence.rootSessionFile = rootHeader?.file ?? null
    v1.evidence.rootSessionHeader = rootHeader?.header ?? null
    v1.check('root session header cwd == W_root (session meta at agents.create boundary, not projection)',
      rootHeader?.header?.cwd === W_ROOT_A, `header.cwd=${rootHeader?.header?.cwd} expected=${W_ROOT_A}`)
    // A REAL first turn on the Root Agent through the browser-facing chat path.
    const promptRes = await apiPrompt(a.origin, a.cookie, ROOT_A, `T12V_ROOT_FIRST_${NONCE}`)
    v1.check('session/prompt accepted (browser-facing chat path)',
      promptRes.status === 200 && promptRes.body?.result?.ok === true,
      `status=${promptRes.status} body=${JSON.stringify(promptRes.body).slice(0, 300)}`)
    const v1AdmittedAt = Date.now()
    // 480 s budget: first turn on a freshly materialized agent can hit the
    // intermittent ~360 s start delay (t12v-finding-360s-first-turn.md); the
    // root agent was observed immediate in runs #4/#5 — the budget only
    // protects against the intermittent gap, it costs nothing on pass.
    const rootAck = await waitForLogLineJson(HOME_A, ROOT_A, (l) => JSON.stringify(l).includes(`T12V_ROOT_FIRST_ACK_${NONCE}`), 480_000)
    v1.check('root agent turn settled against the mock (real dsh-llm adapter + agent loop + session log)',
      rootAck !== null, rootAck === null ? '<ack not in log within 480s>' : 'ack found in durable root log')
    v1.evidence.firstTurnLatencyMs = firstTurnLatencyEvidence(HOME_A, ROOT_A, v1AdmittedAt)
    const rootModelReq = mock.requests.find((r) => (r.body?.messages ?? []).some((m) => typeof m.content === 'string' && m.content.includes(`T12V_ROOT_FIRST_${NONCE}`)))
    v1.evidence.rootModelRequest = rootModelReq === undefined ? null : { seq: rootModelReq.seq, model: rootModelReq.body?.model, endpoint: `http://127.0.0.1:${MOCK_PORT}` }
    v1.check('model call reached the mock endpoint with the row static model (mock-env path)',
      rootModelReq?.body?.model === 't12v-model-a', `model=${rootModelReq?.body?.model}`)
    const rootSystemTexts = (rootModelReq?.body?.messages ?? []).filter((m) => m.role === 'system').map((m) => String(m.content ?? ''))
    v1.evidence.rootSystemMessages = rootSystemTexts.map((t) => t.slice(0, 1200))
    v1.check('leader identity valid: leader persona installed and visible in the REAL prompt assembly',
      rootSystemTexts.some((t) => t.includes('T12V leader persona world A')),
      `system texts=${JSON.stringify(rootSystemTexts.map((t) => t.slice(0, 160)))}`)
  } catch (error) {
    v1.error = error
    v1.check('V1 scenario completed without fatal error', false, String(error?.message ?? error))
  }
  scenarioResults.V1 = v1.finish()
  log(`V1: pass=${scenarioResults.V1.pass}`)

  // ── V2: real Member (world A) ────────────────────────────────────────────
  const v2a = makeScenarioCtx('V2 real Member (world A): real DSH child Session; cwd == W_child; persona installed and visible in real prompt assembly (mock capture); effective model = row static selection')
  try {
    const createRes = await p6t6Tool(a.port, 'team_create_member', {
      rootSessionId: ROOT_A,
      requestToken: `t12v-v2-create-${NONCE}`,
      delegationTemplateId: 'worker',
      label: 'v2-worker',
      workspace: W_CHILD_A,
    }, ROOT_A)
    const created = toolValue(createRes, 'team_create_member')
    v2a.evidence.createResult = created
    v2a.check('team_create_member executed (shipped tool via the production executeTool seam)', created?.status === 'executed', JSON.stringify(created).slice(0, 400))
    workerA = created?.effect
    v2a.check('effect carries instanceId + childSessionId (discovered, not hardcoded)',
      typeof workerA?.instanceId === 'string' && typeof workerA?.childSessionId === 'string',
      `effect=${JSON.stringify(workerA).slice(0, 300)}`)
    // Record the durable identity as soon as it is known (not at the end of
    // the try): the RESTART phase consumes it via __a1 even if a later V2
    // step fails fatally.
    v2a.evidence.workerA = { instanceId: workerA?.instanceId, childSessionId: workerA?.childSessionId }
    // REAL child session under DSH_HOME + cwd == W_child (session meta).
    const childHeader = readSessionHeader(HOME_A, workerA?.childSessionId)
    v2a.check('child session log materialized under DSH_HOME (real DSH child Session)', childHeader !== null, childHeader?.file ?? '<not found>')
    v2a.evidence.childSessionFile = childHeader?.file ?? null
    v2a.evidence.childSessionHeader = childHeader?.header ?? null
    v2a.check('child session header cwd == W_child', childHeader?.header?.cwd === W_CHILD_A, `header.cwd=${childHeader?.header?.cwd} expected=${W_CHILD_A}`)
    // A real turn on the child via the browser-facing public Remote.
    // 480 s budget: first relayed turn on a freshly materialized child agent
    // showed a ~360 s start delay in run #5 (t12v-finding-360s-first-turn.md).
    const v2aAdmittedAt = Date.now()
    const sendRes = await remoteCall(a.origin, a.cookie, 'member.send', {
      teamSessionId: a.teamSession,
      caller: humanCaller(ROOT_A),
      recipientInstanceId: workerA.instanceId,
      body: `T12V_CHILD_FIRST_${NONCE}`,
      requestToken: `t12v-v2-send-${NONCE}`,
    })
    const sent = admissionOutcome(remoteValue(sendRes, 'member.send'), 'member.send')
    v2a.evidence.sendResult = { outcome: sent }
    v2a.check('member.send delivered (admission executed)', sent.status === 'executed' && sent.targetInstanceId === workerA.instanceId, JSON.stringify(sent).slice(0, 300))
    const childAck = await waitForLogLineJson(HOME_A, workerA.childSessionId, (l) => JSON.stringify(l).includes(`T12V_CHILD_FIRST_ACK_${NONCE}`), 480_000)
    v2a.check('child turn settled against the mock', childAck !== null, childAck === null ? '<ack not in child log within 480s>' : 'ack found in durable child log')
    v2a.evidence.firstTurnLatencyMs = firstTurnLatencyEvidence(HOME_A, workerA.childSessionId, v2aAdmittedAt)
    const childReq = mock.requests.find((r) => (r.body?.messages ?? []).some((m) => typeof m.content === 'string' && m.content.includes(`T12V_CHILD_FIRST_${NONCE}`)))
    const systemTexts = (childReq?.body?.messages ?? []).filter((m) => m.role === 'system').map((m) => String(m.content ?? ''))
    v2a.evidence.childModelRequest = childReq === undefined ? null : { seq: childReq.seq, model: childReq.body?.model, systemMessages: systemTexts.map((t) => t.slice(0, 1200)), tools: (childReq.body?.tools ?? []).map((t) => t?.function?.name ?? t?.name).filter(Boolean) }
    v2a.check('persona installed and visible in the REAL prompt assembly (system prompt in the mock-captured request)',
      systemTexts.some((t) => t.includes('T12V worker persona world A')),
      `system texts=${JSON.stringify(systemTexts.map((t) => t.slice(0, 200)))}`)
    v2a.check('effective model = row static selection (deepseek-official/t12v-model-a)', childReq?.body?.model === 't12v-model-a', `model=${childReq?.body?.model}`)
  } catch (error) {
    v2a.error = error
    v2a.check('V2 (world A) completed without fatal error', false, String(error?.message ?? error))
  }
  scenarioResults.__v2a = v2a.finish()
  log(`V2 (world A part): pass=${scenarioResults.__v2a.pass}`)

  // ── V3: real policy — external hard deny beats the override ──────────────
  const v3 = makeScenarioCtx('V3 real policy: external hard DENY of mcp + member override ALLOW mcp => mcp remains denied at the ACTUAL consumption boundary (model tool schema omits the mcp tool; the agent loop fails the call; no mcp mount established) — not just the projection')
  try {
    const setRes = await remoteCall(a.origin, a.cookie, 'override.set', {
      teamSessionId: a.teamSession,
      capability: 'mcp',
      value: { kind: 'allow', items: [MCP_SERVER_NAME] },
      actor: { kind: 'human' },
      scope: 'instance',
      targetInstanceId: workerA.instanceId,
    })
    const setVal = remoteValue(setRes, 'override.set')
    v3.evidence.overrideSet = setVal
    v3.check('member override ALLOW mcp[t12vmini] admitted (durable override record returned)',
      setVal?.record !== null && typeof setVal.record === 'object', JSON.stringify(setVal).slice(0, 400))
    // Drive the worker to actually TRY the mcp tool.
    const useRes = await remoteCall(a.origin, a.cookie, 'member.send', {
      teamSessionId: a.teamSession,
      caller: humanCaller(ROOT_A),
      recipientInstanceId: workerA.instanceId,
      body: `T12V_USE_MCP_${NONCE}`,
      requestToken: `t12v-v3-use-${NONCE}`,
    })
    admissionOutcome(remoteValue(useRes, 'member.send'), 'member.send')
    const deniedAck = await waitForLogLineJson(HOME_A, workerA.childSessionId, (l) => JSON.stringify(l).includes(`T12V_MCP_DENIED_ACK_${NONCE}`), 180_000)
    v3.check('turn settled after the mcp tool call was handled by the real agent loop', deniedAck !== null, deniedAck === null ? '<denied-ack not in child log within 180s>' : 'settled')
    const childLogText = logTextOf(HOME_A, workerA.childSessionId) ?? ''
    const toolAttemptVisible = childLogText.includes(MCP_PING_TOOL)
    v3.check('child session log records the mcp tool attempt at the consumption boundary',
      toolAttemptVisible, `log contains attempted tool name ${MCP_PING_TOOL}: ${toolAttemptVisible}`)
    // The ACTUAL consumption boundary at the model level: the tool schema
    // sent to the model on that turn must NOT include the mcp tool.
    const mcpTurnReq = mock.requests.find((r) => (r.body?.messages ?? []).some((m) => typeof m.content === 'string' && m.content.includes(`T12V_USE_MCP_${NONCE}`)))
    const toolNames = (mcpTurnReq?.body?.tools ?? []).map((t) => t?.function?.name ?? t?.name).filter(Boolean)
    v3.evidence.mcpTurnTools = toolNames
    v3.check('model request tool schema omits the mcp tool (denied at the model-consumption boundary)',
      mcpTurnReq !== undefined && toolNames.length > 0 && !toolNames.includes(MCP_PING_TOOL),
      `tools=${JSON.stringify(toolNames)}`)
    // Diagnostics (never the assertion source): the override is recorded but
    // the effective mcp cell stays denied (mounted === false) — i.e. no real
    // mcp mount was established, so no mcp request could have been served.
    const st = await p6t6State(a.port)
    const mcpDiag = st.body?.governance?.sessions?.[workerA.childSessionId]?.mcp
    v3.evidence.mcpDiag = mcpDiag ?? null
    v3.check('no mcp mount established: effective mcp cell mounted===false despite the override (external hard deny held)',
      mcpDiag !== undefined && mcpDiag?.mounted === false, `diag=${JSON.stringify(mcpDiag).slice(0, 400)}`)
  } catch (error) {
    v3.error = error
    v3.check('V3 scenario completed without fatal error', false, String(error?.message ?? error))
  }
  scenarioResults.V3 = v3.finish()
  log(`V3: pass=${scenarioResults.V3.pass}`)

  // ── V4: delegate real work ────────────────────────────────────────────────
  const v4 = makeScenarioCtx('V4 delegate real work: the exact task text T12_VERTICAL_TASK_<nonce> reaches the real child session log; the real turn against the mock completes; durable truth settles')
  try {
    const delRes = await p6t6Tool(a.port, 'team_delegate', {
      rootSessionId: ROOT_A,
      requestToken: `t12v-v4-delegate-${NONCE}`,
      delegationTemplateId: 'worker',
      label: 'v4-worker',
      prompt: TASK_TEXT,
      taskSummary: 'T12 vertical delegation',
      workspace: W_CHILD_A,
    }, ROOT_A)
    const delegated = toolValue(delRes, 'team_delegate')
    const v4AdmittedAt = Date.now()
    v4.evidence.delegateResult = delegated
    // The frozen work-admitted effect shape carries the instanceId but NOT the
    // childSessionId (observed: {kind:'work-admitted', instanceId, fromLifecycle,
    // lifecycleCommitted, sequence, replayed, settled, settledSequence}).
    workerV4 = { instanceId: delegated?.effect?.instanceId, childSessionId: delegated?.effect?.childSessionId }
    v4.check('team_delegate executed (work admitted)', delegated?.status === 'executed', JSON.stringify(delegated).slice(0, 400))
    v4.check('effect carries a real instanceId', typeof workerV4?.instanceId === 'string' && workerV4.instanceId !== 'undefined', `effect=${JSON.stringify(delegated?.effect ?? null).slice(0, 300)}`)
    // Resolve the child session id from the LIVE row state (discovery, never
    // hardcoded): the member row keyed by the delegated instanceId carries it.
    if (typeof workerV4?.instanceId === 'string' && (typeof workerV4?.childSessionId !== 'string' || workerV4.childSessionId === 'undefined')) {
      const stV4 = await p6t6State(a.port)
      const rowV4 = (stV4.body?.members ?? []).find((m) => m?.instanceId === workerV4.instanceId)
      v4.evidence.v4ChildResolution = { stateStatus: stV4.status, memberRow: rowV4 ?? null }
      if (rowV4 !== undefined && rowV4 !== null && typeof rowV4?.childSessionId === 'string' && rowV4.childSessionId !== 'undefined') {
        workerV4 = { ...workerV4, childSessionId: rowV4.childSessionId }
      }
    }
    v4.check('childSessionId resolved for the delegated instance (live state discovery)', typeof workerV4?.childSessionId === 'string' && workerV4.childSessionId !== 'undefined', `resolved=${workerV4?.childSessionId}`)
    const v4LogText = await waitForLogTextContains(HOME_A, workerV4.childSessionId, TASK_TEXT, 480_000)
    v4.check('exact task text reached the REAL child session log', v4LogText !== null, v4LogText === null ? '<task text not in child log within 480s>' : 'exact task present in durable child log')
    const v4Ack = await waitForLogLineJson(HOME_A, workerV4.childSessionId, (l) => JSON.stringify(l).includes(`T12V_TASK_ACK_${NONCE}`), 480_000)
    v4.check('real turn against the mock completed and settled', v4Ack !== null, v4Ack === null ? '<task ack not in child log within 480s>' : 'ack settled in durable child log')
    v4.evidence.firstTurnLatencyMs = firstTurnLatencyEvidence(HOME_A, workerV4.childSessionId, v4AdmittedAt)
    const v4Req = mock.requests.find((r) => (r.body?.messages ?? []).some((m) => typeof m.content === 'string' && m.content.includes(TASK_TEXT)))
    v4.evidence.v4ModelRequest = v4Req === undefined ? null : { seq: v4Req.seq, model: v4Req.body?.model }
    v4.check('model request carried the exact task text', v4Req !== undefined, `found=${v4Req !== undefined}`)
    v4.evidence.workerV4 = { instanceId: workerV4?.instanceId, childSessionId: workerV4?.childSessionId }
  } catch (error) {
    v4.error = error
    v4.check('V4 scenario completed without fatal error', false, String(error?.message ?? error))
  }
  scenarioResults.V4 = v4.finish()
  log(`V4: pass=${scenarioResults.V4.pass}`)

  // ── LIFECYCLE: archive with a live descendant, restore, follow-up ────────
  const lc = makeScenarioCtx('LIFECYCLE plan §11.2: real archive of a member with a live background descendant (truly recursive drain, honest numeric drained count), restore, real follow-up turn; NO fake quiescent=true (the quiescence gate rejects non-true drains with LIFECYCLE_NOT_QUIESCENT)')
  try {
    // The worker spawns a REAL background subagent (a real DSH descendant session).
    const subRes = await remoteCall(a.origin, a.cookie, 'member.send', {
      teamSessionId: a.teamSession,
      caller: humanCaller(ROOT_A),
      recipientInstanceId: workerA.instanceId,
      body: `T12V_SUBSPAWN_${NONCE}`,
      requestToken: `t12v-lc-subspawn-${NONCE}`,
    })
    admissionOutcome(remoteValue(subRes, 'member.send'), 'member.send (subspawn)')
    const lcAdmittedAt = Date.now()
    // Wait for the DESCENDANT session to appear (discovered via durable logs)
    // and to settle its own real turn against the mock. 480 s budgets: the
    // descendant session materialization + its first turn on a freshly
    // materialized subagent agent showed a ~360 s start delay in run #5
    // (t12v-finding-360s-first-turn.md).
    const descendant = await waitForDescendantSession(HOME_A, workerA.childSessionId, 480_000)
    lc.evidence.descendantSession = descendant
    lc.check('a real descendant session was created under the member child session (real subagent lifecycle)', descendant !== null, descendant?.id ?? '<not found within 480s>')
    lc.check('descendant session header marks origin=subagent with parentSession == member child (durable session meta)',
      descendant !== null && descendant.origin === 'subagent', `origin=${descendant?.origin} (parentSession match was the discovery criterion)`)
    const descAck = descendant === null ? null : await waitForLogLineJson(HOME_A, descendant.id, (l) => JSON.stringify(l).includes(`T12V_DESC_ACK_${NONCE}`), 480_000)
    lc.check('descendant turn settled against the mock (real subagent agent loop + session log)', descAck !== null, descAck === null ? '<desc ack not in descendant log within 480s>' : 'settled')
    if (descendant !== null) lc.evidence.descendantFirstTurnLatencyMs = firstTurnLatencyEvidence(HOME_A, descendant.id, lcAdmittedAt)
    await new Promise((r) => setTimeout(r, 3000)) // let the descendant registry settle to idle
    // Archive: the quiescence gate requires a TRUE quiescent drain of the
    // descendant tree — a failed drain rejects the archive with
    // LIFECYCLE_NOT_QUIESCENT (no fake quiescent=true).
    const archRes = await remoteCall(a.origin, a.cookie, 'member.archive', {
      teamSessionId: a.teamSession,
      instanceId: workerA.instanceId,
    })
    const archived = remoteValue(archRes, 'member.archive')
    lc.evidence.archiveResult = archived
    lc.check('member.archive executed (quiescence gate passed — a failed drain would have rejected it)',
      archived?.member !== undefined && Array.isArray(archived?.steps), JSON.stringify(archived).slice(0, 500))
    lc.check('archive reports an HONEST numeric drained count >= 1 (the live descendant was drained)',
      typeof archived?.drained === 'number' && archived.drained >= 1,
      `drained=${JSON.stringify(archived?.drained)} (a non-numeric drain fails the quiescence gate, so this number is genuine)`)
    lc.check('residency dropped on archive', archived?.residencyDropped === true, `residencyDropped=${archived?.residencyDropped}`)
    // Restore, then a REAL follow-up turn on the restored member.
    const restRes = await remoteCall(a.origin, a.cookie, 'member.restore', {
      teamSessionId: a.teamSession,
      instanceId: workerA.instanceId,
    })
    const restored = remoteValue(restRes, 'member.restore')
    lc.evidence.restoreResult = restored
    lc.check('member.restore executed', restored?.member !== undefined && Array.isArray(restored?.steps), JSON.stringify(restored).slice(0, 400))
    const fuRes = await remoteCall(a.origin, a.cookie, 'member.followup', {
      teamSessionId: a.teamSession,
      caller: humanCaller(ROOT_A),
      targetInstanceId: workerA.instanceId,
      requestToken: `t12v-lc-followup-${NONCE}`,
      payload: { body: `T12V_FOLLOWUP_${NONCE}` },
    })
    const followed = admissionOutcome(remoteValue(fuRes, 'member.followup'), 'member.followup')
    lc.evidence.followupOutcome = followed
    lc.check('member.followup admitted after restore (work admitted)', followed.status === 'executed', JSON.stringify(followed).slice(0, 300))
    // 480 s: after archive→restore the member agent is re-materialized, so the
    // follow-up can be a first turn on a fresh agent handle (~360 s gap class).
    const lcFuAdmittedAt = Date.now()
    const fuAck = await waitForLogLineJson(HOME_A, workerA.childSessionId, (l) => JSON.stringify(l).includes(`T12V_FOLLOWUP_ACK_${NONCE}`), 480_000)
    lc.check('real follow-up turn settled on the restored member', fuAck !== null, fuAck === null ? '<followup ack not in child log within 480s>' : 'settled')
    const fuTurnStartMs = turnStartBeforeText(HOME_A, workerA.childSessionId, `T12V_FOLLOWUP_${NONCE}`)
    lc.evidence.followupTurnStartMs = fuTurnStartMs
    lc.evidence.followupLatencyMs = fuTurnStartMs !== null ? fuTurnStartMs - lcFuAdmittedAt : null
  } catch (error) {
    lc.error = error
    lc.check('LIFECYCLE scenario completed without fatal error', false, String(error?.message ?? error))
  }
  scenarioResults.LIFECYCLE = lc.finish()
  log(`LIFECYCLE: pass=${scenarioResults.LIFECYCLE.pass}`)

  // ── V5: Projection through the browser-facing public Remote ──────────────
  const v5 = makeScenarioCtx('V5 Projection/Remote: TeamProjection read through the BROWSER-FACING public Remote mounted endpoint (/team-remote) — the test side NEVER uses TeamDomain direct reads as an assertion source')
  try {
    const projRes = await remoteCall(a.origin, a.cookie, 'team.getProjection', { teamSessionId: a.teamSession })
    // The value shape is { projection: TeamProjectionDto } (contracts/types.ts
    // RemoteTeamGetProjectionValue) — unwrap before reading DTO fields.
    const projValue = remoteValue(projRes, 'team.getProjection')
    const projection = projValue?.projection
    v5.evidence.projectionKeys = projValue === undefined ? null : Object.keys(projValue)
    v5.check('team.getProjection answered through the public Remote (HTTP 200 + ok result)', projRes.status === 200 && projRes.body?.result?.ok === true, `status=${projRes.status}`)
    v5.check('projection teamSessionId matches the durable TeamSession', projection?.teamSessionId === a.teamSession, `projection=${projection?.teamSessionId} expected=${a.teamSession}`)
    // Frozen contract: v1 field set (TEAM_PROJECTION_FIELDS) or v2 (S7-R2:
    // additive optional disposedHistory) — contracts/src/projection/projection.ts.
    // The shipped runtime currently stamps 2; accept the frozen set, require
    // the nine v1 top-level fields to be present either way.
    const V1_FIELDS = ['schemaVersion', 'teamSessionId', 'blueprint', 'generation', 'generatedAt', 'root', 'templates', 'members', 'ledger']
    const sv = projection?.schemaVersion
    v5.check('projection carries a frozen schemaVersion (1 or 2) with the nine v1 top-level fields',
      sv === 1 || sv === 2, `schemaVersion=${sv}`)
    v5.check('projection top-level field set matches the frozen v1 contract (superset for v2)',
      projection !== undefined && V1_FIELDS.every((f) => f in projection), `keys=${JSON.stringify(projection === undefined ? null : Object.keys(projection))}`)
    const projMembers = projection?.members ?? []
    // The delegate targets the existing worker instance (template resolution),
    // so V2's and V4's instances may be the SAME row — expect leader plus every
    // DISTINCT discovered worker instance, each with a stable childSessionId.
    const expectedInstances = [...new Set([workerA?.instanceId, workerV4?.instanceId].filter((x) => typeof x === 'string' && x !== 'undefined'))]
    v5.check('projection members include the real leader + every discovered worker instance (childSessionIds stable)',
      projMembers.some((m) => m?.instanceId === LEADER_INSTANCE_ID)
      && expectedInstances.length > 0
      && expectedInstances.every((iid) => projMembers.some((m) => m?.instanceId === iid && typeof m?.childSessionId === 'string' && m.childSessionId !== 'undefined')),
      `members=${JSON.stringify(projMembers.map((m) => ({ instanceId: m?.instanceId, lifecycle: m?.lifecycle })))} expected=${JSON.stringify(expectedInstances)}`)
    // ledger is the frozen LedgerSummaryDto {latestSequence,totalEntries,byCategory,pendingControlCount}
    // (contracts/src/projection/ledger.ts) — "non-empty" means totalEntries > 0.
    const ledger = projection?.ledger
    const ledgerTotal = typeof ledger?.totalEntries === 'number' ? ledger.totalEntries : null
    v5.check('projection ledger non-empty (durable event truth projected)', ledgerTotal !== null && ledgerTotal > 0, `ledger=${JSON.stringify(ledger)} totalEntries=${ledgerTotal}`)
    v5.evidence.projection = projection
  } catch (error) {
    v5.error = error
    v5.check('V5 scenario completed without fatal error', false, String(error?.message ?? error))
  }
  scenarioResults.V5 = v5.finish()
  log(`V5: pass=${scenarioResults.V5.pass}`)

  // Compose the combined V2 record (world A part now; world B part in fresh #2).
  scenarioResults.V2 = composeV2()
  // Remember the durable identities for the RESTART phase.
  scenarioResults.__a1 = {
    rootSessionId: ROOT_A,
    teamSessionId: a.teamSession,
    workerA: v2a.evidence.workerA ?? null,
    workerV4: v4.evidence.workerV4 ?? null,
  }
  saveState()
  await stopWorld(a)
}

function composeV2() {
  const partA = scenarioResults.__v2a
  if (partA === undefined) return null
  const partB = scenarioResults.__v2b
  if (partB === undefined) {
    return {
      criterion: 'V2 real Member (world A part recorded; world B mcpServer:null variant pending fresh #2)',
      pass: partA.pass,
      durationMs: partA.durationMs,
      assertions: partA.assertions.map((x) => ({ ...x, name: `[A] ${x.name}` })),
      evidence: { worldA: partA.evidence },
    }
  }
  return {
    criterion: 'V2 real Member: real DSH child Session (cwd == W_child, persona visible in real prompt assembly, effective model); the mcpServer:null config variant (world B) does not crash',
    pass: partA.pass && partB.pass,
    durationMs: partA.durationMs + partB.durationMs,
    assertions: [...partA.assertions.map((x) => ({ ...x, name: `[A] ${x.name}` })), ...partB.assertions.map((x) => ({ ...x, name: `[B] ${x.name}` }))],
    evidence: { worldA: partA.evidence, worldB: partB.evidence },
  }
}

// ── phase: fresh #2 (world B) — V2 variant (mcpServer:null) + RESTART identity ──

async function runFresh2() {
  const b = await bootWorld({
    label: 'B1', world: 'b', dshHome: HOME_B, port: PORT_B, boot: 3,
    bootPhase: 'create', rootSessionId: ROOT_B, mcpPort: null,
  })
  // World B carries the mcpServer:null row variant. The SHIPPED state route
  // (plugin.mjs L433: `serverName: teamRoot.config.mcpServer.name`)
  // dereferences config.mcpServer unconditionally, so for this variant the
  // state route 500s deterministically with
  // `Cannot read properties of null (reading 'name')` — a shipped-code defect
  // against a row-config-legal value (host.ts row validation accepts
  // mcpServer: null). Boot health is already gated by bootWorld, and the
  // remote teamSessionId parameter is the ROOT session id itself (invariant 9,
  // ids.ts L15-19), so probe LENIENTLY: the state-route failure is recorded as
  // evidence, not a run abort.
  const st0 = await p6t6StateProbe(b.port, { rootSessionId: ROOT_B, phase: 'create', timeoutMs: 10_000 })
  b.teamSession = (st0.ok === true && st0.body?.teamSession?.rootSessionId === ROOT_B) ? st0.body.teamSession.rootSessionId : ROOT_B
  if (st0.ok !== true) {
    log(`B1: state route not well-formed — recorded as evidence, continuing via invariant 9: ${st0.error}`)
  }
  const a1rec = scenarioResults.__a1 ?? loadStateRef()?.a1
  if (a1rec === undefined || a1rec === null) {
    throw new Error('fresh #2 requires the fresh #1 state (scenarioResults.__a1 or t12v-state.json) — run the fresh1 phase first')
  }
  const v2b = makeScenarioCtx('V2 variant (world B): config mcpServer:null does not crash — real boot, real member, real child turn')
  let workerB = null
  try {
    v2b.evidence.state = st0.ok === true
      ? { boot: st0.body?.boot, phase: st0.body?.phase, rootSessionId: st0.body?.rootSessionId, teamSession: st0.body?.teamSession, memberCount: (st0.body?.members ?? []).length }
      : { probeFailed: true, error: st0.error, teamSessionVia: 'invariant 9 (teamSessionId === rootSessionId)' }
    v2b.check('world B booted with mcpServer:null (instance up, row mounted, health ok — bootWorld gate)', typeof b.url === 'string' && b.port === PORT_B, `url=${b.url} port=${b.port}`)
    v2b.check('state route well-formed for the mcpServer:null row (shipped-code expectation — KNOWN DEFECT: plugin.mjs L433 dereferences config.mcpServer.name)', st0.ok === true, st0.ok === true ? JSON.stringify(v2b.evidence.state) : `state route failed: ${st0.error}`)
    const createRes = await p6t6Tool(b.port, 'team_create_member', {
      rootSessionId: ROOT_B,
      requestToken: `t12v-v2b-create-${NONCE}`,
      delegationTemplateId: 'worker',
      label: 'v2-worker',
      workspace: W_CHILD_B,
    }, ROOT_B)
    const created = toolValue(createRes, 'team_create_member')
    v2b.evidence.createResult = created
    workerB = created?.effect
    v2b.check('team_create_member executed under mcpServer:null', created?.status === 'executed' && typeof workerB?.childSessionId === 'string', JSON.stringify(created).slice(0, 300))
    // Record the durable identity as soon as it is known: the RESTART phase
    // consumes v2b.evidence.workerB even if a later V2-B step fails fatally.
    v2b.evidence.workerB = { instanceId: workerB?.instanceId, childSessionId: workerB?.childSessionId }
    const sendRes = await remoteCall(b.origin, b.cookie, 'member.send', {
      teamSessionId: b.teamSession,
      caller: humanCaller(ROOT_B),
      recipientInstanceId: workerB.instanceId,
      body: `T12V_CHILD_FIRST_${NONCE}`,
      requestToken: `t12v-v2b-send-${NONCE}`,
    })
    admissionOutcome(remoteValue(sendRes, 'member.send'), 'member.send (world B)')
    const v2bAdmittedAt = Date.now()
    // 480 s budget: first relayed turn on world B's freshly materialized child
    // agent (~360 s gap class, t12v-finding-360s-first-turn.md).
    const childAck = await waitForLogLineJson(HOME_B, workerB.childSessionId, (l) => JSON.stringify(l).includes(`T12V_CHILD_FIRST_ACK_${NONCE}`), 480_000)
    v2b.check('child turn settled against the mock (no crash from mcpServer:null)', childAck !== null, childAck === null ? '<ack missing after 480s>' : 'settled')
    v2b.evidence.firstTurnLatencyMs = firstTurnLatencyEvidence(HOME_B, workerB.childSessionId, v2bAdmittedAt)
    const childReq = mock.requests.find((r) => r.body?.model === 't12v-model-b' && (r.body?.messages ?? []).some((m) => typeof m.content === 'string' && m.content.includes(`T12V_CHILD_FIRST_${NONCE}`)))
    v2b.check('effective model = t12v-model-b (row static selection, mcpServer:null variant)', childReq !== undefined, `found=${childReq !== undefined}`)
    const childHeader = readSessionHeader(HOME_B, workerB.childSessionId)
    v2b.check('child session header cwd == W_child (world B)', childHeader?.header?.cwd === W_CHILD_B, `cwd=${childHeader?.header?.cwd}`)
  } catch (error) {
    v2b.error = error
    v2b.check('V2 variant completed without fatal error', false, String(error?.message ?? error))
  }
  scenarioResults.__v2b = v2b.finish()
  scenarioResults.V2 = composeV2()
  log(`V2: pass=${scenarioResults.V2?.pass}`)

  // ── RESTART identity part (fresh #1 vs fresh #2, different roots) ─────────
  const rs = makeScenarioCtx('RESTART plan §12: fresh #1/#2 under different RootSessionIds — observable no-collision invariants + honest precondition reachability verdict; then restart/resume (same Team root / MemberInstance / child Session, no duplicates, projection resumes)')
  try {
    const wA = a1rec.workerA
    const wB = v2b.evidence.workerB
    rs.evidence.fresh1 = { root: ROOT_A, worker: wA }
    rs.evidence.fresh2 = { root: ROOT_B, worker: wB }
    rs.check('fresh #1 worker is a REAL child session (durable log under home A)', readSessionHeader(HOME_A, wA?.childSessionId) !== null, wA?.childSessionId)
    rs.check('fresh #2 worker is a REAL child session (durable log under home B)', readSessionHeader(HOME_B, wB?.childSessionId) !== null, wB?.childSessionId)
    rs.check('distinct member instanceIds across the two roots (no instance collision)',
      typeof wA?.instanceId === 'string' && typeof wB?.instanceId === 'string' && wA.instanceId !== wB.instanceId,
      `A=${wA?.instanceId} B=${wB?.instanceId}`)
    rs.check('distinct child SessionIds across the two roots (no child SessionId collision)',
      typeof wA?.childSessionId === 'string' && typeof wB?.childSessionId === 'string' && wA.childSessionId !== wB.childSessionId,
      `A=${wA?.childSessionId} B=${wB?.childSessionId}`)
    rs.check('each child Session materialized exactly once under its home (no duplicate Agent bindings)',
      countSessionFiles(HOME_A, wA?.childSessionId) === 1 && countSessionFiles(HOME_B, wB?.childSessionId) === 1,
      `A files=${countSessionFiles(HOME_A, wA?.childSessionId)} B files=${countSessionFiles(HOME_B, wB?.childSessionId)}`)
    // The plan's LITERAL precondition: "same member instanceId under a
    // different RootSessionId". Verdict: UNREACHABLE by construction — the
    // canonical member spec string (packages/runtime/member-residency/
    // identity.ts canonicalMemberSpecString, L289-298) includes
    // rootSessionId, so instanceId = 'inst-' + token([root, template, label,
    // group, workspace]) necessarily differs across roots, and no public
    // surface (team_create_member / remote member.create) accepts an
    // explicit instanceId. All observable no-collision invariants above
    // still hold.
    rs.check('precondition reachability: SAME member instanceId under a DIFFERENT root (plan §12 literal) — UNREACHABLE by construction',
      false,
      'identity.ts canonicalMemberSpecString L289-298: specString = [rootSessionId, templateId, label, groupId ?? "", workspace ?? ""].join("\\u0000"); instanceId = "inst-" + token(specString, 12). rootSessionId is part of the spec, so the same instanceId under a different root cannot be produced through shipped template creation; no explicit-instanceId parameter exists on team_create_member or remote member.create. Plan-vs-code divergence flagged for main-agent adjudication; all observable no-collision invariants verified above.')
  } catch (error) {
    rs.error = error
    rs.check('RESTART identity part completed without fatal error', false, String(error?.message ?? error))
  }
  scenarioResults.__restartIdentity = rs
  saveState()
  // NOTE: world B's instance stays ALIVE — it is the handoff phase's second
  // source team (plan §11.1 "source Team C, same requestToken X").
  log('fresh #2 done; world B instance left alive for the handoff second-source leg')
}

// ── phase: restart #1 (world A resume) ─────────────────────────────────────

async function runRestart1() {
  const a1rec = scenarioResults.__a1 ?? loadStateRef()?.a1
  if (a1rec === undefined || a1rec === null) {
    throw new Error('restart #1 requires the fresh #1 state (scenarioResults.__a1 or t12v-state.json) — run the fresh1 phase first')
  }
  const wA = a1rec.workerA
  // Invariant 9: the persisted teamSessionId is the root session id STRING
  // (older state refs may carry the object shape — normalize).
  const a1TeamSessionId = typeof a1rec.teamSessionId === 'string' ? a1rec.teamSessionId : a1rec.teamSessionId?.rootSessionId
  // The RESTART ctx: in-memory from fresh #2 (same process), or reconstructed
  // from the persisted identity part (separate-process phase runs).
  let rs = scenarioResults.__restartIdentity
  if (rs === undefined) {
    const prevIdentity = loadStateRef()?.restartIdentity ?? loadPreviousSummary()?.scenarios?.__restartIdentity
    rs = makeScenarioCtx(prevIdentity?.criterion ?? 'RESTART plan §12 (resume part; identity part recorded in an earlier phase run)')
    if (prevIdentity?.assertions !== undefined) {
      for (const a of prevIdentity.assertions) rs.assertions.push(a)
      rs.evidence = { ...(prevIdentity.evidence ?? {}), identityPartSource: 'persisted from the fresh #2 phase run' }
      rs.notes.push(...(prevIdentity.notes ?? []))
    } else {
      rs.note('identity part (fresh #1/#2 no-collision invariants) was not recorded in this process; resume-part assertions only')
    }
  }
  // A REAL restart: stop the live A1 instance first so the new process is the
  // only writer on the durable home, then boot a NEW instance on the SAME
  // DSH_HOME with phase=resume.
  const a1 = [...liveWorlds].find((w) => w.world === 'a')
  if (a1 !== undefined) {
    log('restart1: stopping A1 — real restart on the same durable DSH_HOME')
    await stopWorld(a1)
  }
  let a2 = null
  let bootError = null
  try {
    a2 = await bootWorld({
      label: 'A2', world: 'a', dshHome: HOME_A, port: PORT_A2, boot: 2,
      bootPhase: 'resume', rootSessionId: ROOT_A, mcpPort: MINI_PORT,
    })
  } catch (error) {
    bootError = error
  }
  if (a2 === null) {
    // Honest record of the resume failure + durable root-cause evidence.
    // The shipped glue's resume loop (agent-bindings.mjs L883-890) does
    // String(member.childSessionId) for every durable member row WITHOUT the
    // structural guard the projection/overlay ports have ('childSessionId' in
    // row, projection-source.ts L575 / s6-live-overlay.ts L99). The production
    // create path mints a v2 leader row carrying NO childSessionId (the leader
    // IS the root session), so the loop attempts agents.resume(SessionId(
    // "undefined")) and the boot dies. The v1-shaped leader row (childSessionId
    // === root) only exists on the fixture seedBootWorld path, where the
    // seen-set skip happens to work.
    const leaderRow = readDurableLeaderRow(HOME_A, ROOT_A)
    rs.evidence.resumeBootFailure = String(bootError?.message ?? bootError)
    rs.evidence.durableLeaderRow = leaderRow
    rs.check('resume boot: A2 instance booted (phase=resume, same root)', false, `boot failed: ${String(bootError?.message ?? bootError).slice(0, 300)}`)
    rs.check('resume boot: root-cause evidence — durable leader row is the v2 shape (no childSessionId key) the shipped resume loop stringifies to "undefined"', leaderRow !== null && typeof leaderRow === 'object' && !('childSessionId' in leaderRow), `leaderRow=${JSON.stringify(leaderRow)}`)
    rs.check('resume boot: same durable TeamSession id on resume', false, 'not evaluated — A2 resume boot failed')
    rs.check('resume boot: SAME MemberInstance re-opened (instanceId + childSessionId stable across restart)', false, 'not evaluated — A2 resume boot failed')
    rs.check('resume boot: NO duplicate members (each instanceId exactly once)', false, 'not evaluated — A2 resume boot failed')
    rs.check('resume boot: no duplicate root session materialization (exactly one root session log)', countSessionFiles(HOME_A, ROOT_A) === 1, `files=${countSessionFiles(HOME_A, ROOT_A)}`)
    rs.check('resume boot: no duplicate child session materialization for the worker', countSessionFiles(HOME_A, wA?.childSessionId) === 1, `files=${countSessionFiles(HOME_A, wA?.childSessionId)}`)
    rs.check('projection resumes after restart (same TeamSession, members intact)', false, 'not evaluated — A2 resume boot failed')
    rs.check('real follow-up turn admitted after restart', false, 'not evaluated — A2 resume boot failed')
    rs.check('restart follow-up turn settled against the mock (durable child log)', false, 'not evaluated — A2 resume boot failed')
    rs.note('resume part failed inside the shipped glue (agent-bindings.mjs L883-890): the v2 leader row (no childSessionId) is stringified to "undefined"; plan §12 restart is not satisfiable by the shipped code — divergence recorded with durable evidence')
  } else {
    try {
      const st = await p6t6StateReady(a2.port, { rootSessionId: ROOT_A, phase: 'resume' })
      a2.teamSession = st.body?.teamSession?.rootSessionId
      rs.evidence.resume = { boot: st.body?.boot, phase: st.body?.phase, rootSessionId: st.body?.rootSessionId, teamSession: st.body?.teamSession, members: (st.body?.members ?? []).map((m) => ({ instanceId: m?.instanceId, childSessionId: m?.childSessionId, lifecycle: m?.lifecycle })) }
      rs.check('resume boot: same Team root (rootSessionId unchanged)', st.body?.rootSessionId === ROOT_A, `root=${st.body?.rootSessionId}`)
      rs.check('resume boot: same durable TeamSession id', st.body?.teamSession?.rootSessionId === a1TeamSessionId, `teamSession=${st.body?.teamSession?.rootSessionId} expected=${a1TeamSessionId}`)
      const memberList = st.body?.members ?? []
      rs.check('resume boot: SAME MemberInstance re-opened (instanceId + childSessionId stable across restart)',
        memberList.some((m) => m?.instanceId === wA?.instanceId && m?.childSessionId === wA?.childSessionId),
        JSON.stringify(rs.evidence.resume.members))
      const instanceIds = memberList.map((m) => m?.instanceId)
      rs.check('resume boot: NO duplicate members (each instanceId exactly once)',
        Array.isArray(instanceIds) && new Set(instanceIds).size === instanceIds.length, `members=${JSON.stringify(instanceIds)}`)
      rs.check('resume boot: no duplicate root session materialization (exactly one root session log)',
        countSessionFiles(HOME_A, ROOT_A) === 1, `files=${countSessionFiles(HOME_A, ROOT_A)}`)
      rs.check('resume boot: no duplicate child session materialization for the worker',
        countSessionFiles(HOME_A, wA?.childSessionId) === 1, `files=${countSessionFiles(HOME_A, wA?.childSessionId)}`)
      // Projection resumes correctly (browser-facing public Remote).
      const projRes = await remoteCall(a2.origin, a2.cookie, 'team.getProjection', { teamSessionId: a2.teamSession })
      const projection = remoteValue(projRes, 'team.getProjection')?.projection
      rs.check('projection resumes after restart (same TeamSession, members intact)',
        projection?.teamSessionId === a1TeamSessionId
        && (projection?.members ?? []).some((m) => m?.instanceId === wA?.instanceId && m?.childSessionId === wA?.childSessionId),
        `teamSession=${projection?.teamSessionId} members=${JSON.stringify((projection?.members ?? []).map((m) => m?.instanceId))}`)
      rs.evidence.resumeProjection = projection
      // A REAL follow-up turn after restart on the same member.
      const fuRes = await remoteCall(a2.origin, a2.cookie, 'member.followup', {
        teamSessionId: a2.teamSession,
        caller: humanCaller(ROOT_A),
        targetInstanceId: wA?.instanceId,
        requestToken: `t12v-restart-followup-${NONCE}`,
        payload: { body: `T12V_RESTART_FOLLOWUP_${NONCE}` },
      })
      const followed = admissionOutcome(remoteValue(fuRes, 'member.followup'), 'member.followup (restart)')
      rs.check('real follow-up turn admitted after restart', followed.status === 'executed', JSON.stringify(followed).slice(0, 300))
      rs.evidence.restartFollowup = followed
      // 480 s budget: a resumed agent handle is re-materialized, so the
      // follow-up can be a first turn on a fresh agent (~360 s gap class).
      const ack = await waitForLogLineJson(HOME_A, wA?.childSessionId, (l) => JSON.stringify(l).includes(`T12V_RESTART_ACK_${NONCE}`), 480_000)
      rs.check('restart follow-up turn settled against the mock (durable child log)', ack !== null, ack === null ? '<ack missing after 480s>' : 'settled')
    } catch (error) {
      // Capture the row's own failure report if the failure landed after
      // row-ready (bootstrap can reject between the health gate and the
      // first state read — the setupError latch is definitive).
      let hb = null
      try { hb = await p6t6Health(a2.port) } catch { /* instance already gone */ }
      rs.evidence.healthAtFailure = hb?.body ?? null
      const setupErr = hb?.body?.setupError !== undefined ? ` | row setupError: ${String(hb.body.setupError).slice(0, 300)}` : ''
      rs.error = error
      rs.check('RESTART resume part completed without fatal error', false, `${String(error?.message ?? error)}${setupErr}`)
    }
    await stopWorld(a2)
  }
  scenarioResults.RESTART = rs.finish()
  delete scenarioResults.__restartIdentity
  saveState()
  log(`RESTART: pass=${scenarioResults.RESTART.pass}`)
}

// ── phase: handoff (world C first-source + world B second-source) ──────────

async function runHandoff() {
  const c = await bootWorld({
    label: 'C1', world: 'c', dshHome: HOME_C, port: PORT_C, boot: 4,
    bootPhase: 'create', rootSessionId: ROOT_C1, mcpPort: null,
  })
  const ho = makeScenarioCtx('HANDOFF plan §11.1: source team (world C row, root C1) + requestToken X + context C => target team B1 (distinct minted identity, real target Root Agent, C reaches it); then a DIFFERENT source team (world B row, root B) + the SAME requestToken X => a DIFFERENT target identity B2 (the B5 composite)')
  // World C's row — like world B's — has mcpServer: null (mini-MCP exists for
  // world A only), so the shipped state route (plugin.mjs L433 dereferences
  // config.mcpServer.name) 500s deterministically on that config-legal value.
  // Probe LENIENTLY; invariant 9 (ids.ts L15-19) makes the state query
  // unnecessary — the bound root IS the team session id. The probe failure is
  // evidence here; the defect itself is scored as a V2 check.
  const stC = await p6t6StateProbe(c.port, { rootSessionId: ROOT_C1, phase: 'create', timeoutMs: 10_000 })
  c.teamSession = (stC.ok === true && stC.body?.teamSession?.rootSessionId === ROOT_C1) ? stC.body.teamSession.rootSessionId : ROOT_C1
  ho.evidence.stateProbeC = stC.ok === true
    ? { boot: stC.body?.boot, phase: stC.body?.phase, rootSessionId: stC.body?.rootSessionId, teamSession: stC.body?.teamSession, memberCount: (stC.body?.members ?? []).length }
    : { probeFailed: true, error: stC.error, teamSessionVia: 'invariant 9 (teamSessionId === rootSessionId)' }
  if (stC.ok !== true) {
    log(`C1: state route not well-formed — recorded as evidence, continuing via invariant 9: ${stC.error}`)
  }
  // The second-source team: world B (kept alive from fresh #2) with its own
  // live row on its own instance — a real, distinct source team.
  const b = [...liveWorlds].find((w) => w.world === 'b')
  let b1 = null
  let b2 = null
  try {
    if (b === undefined) throw new Error('the handoff second-source leg requires the world B instance (fresh #2 must have run and not stopped it)')
    // Invariant 9 (ids.ts L15-19): TeamSessionId === RootSessionId. World B's
    // state route is defective for the mcpServer:null row (shipped plugin.mjs
    // L433 dereferences config.mcpServer.name), so no state query is needed or
    // attempted here — the bound root IS the team session id.
    b.teamSession ??= ROOT_B

    // ── leg 1: world C root C1 -> target B1 ─────────────────────────────────
    const p1 = await apiPrompt(c.origin, c.cookie, ROOT_C1, C_TEXT)
    ho.check('context C delivered to source team C1 root (session/prompt accepted)', p1.status === 200 && p1.body?.result?.ok === true, JSON.stringify(p1.body).slice(0, 200))
    const c1AdmittedAt = Date.now()
    // 480 s budget: first relayed turn on world C's freshly materialized root
    // agent (~360 s gap class, t12v-finding-360s-first-turn.md).
    const c1Ack = await waitForLogLineJson(HOME_C, ROOT_C1, (l) => JSON.stringify(l).includes(`T12V_HANDBACK_ACK_${NONCE}`), 480_000)
    ho.check('source C1 turn settled with C in the durable log', c1Ack !== null, c1Ack === null ? '<ack missing after 480s>' : 'settled')
    ho.evidence.sourceC1FirstTurnLatencyMs = firstTurnLatencyEvidence(HOME_C, ROOT_C1, c1AdmittedAt)
    const prep1 = remoteValue(await remoteCall(c.origin, c.cookie, 'handoff.prepare', { sourceSessionId: ROOT_C1 }), 'handoff.prepare')
    ho.evidence.prepare1 = prep1
    ho.check('handoff.prepare returned a deterministic source summary for C1 (title + non-empty bullets)',
      prep1?.sourceSessionId === ROOT_C1 && typeof prep1?.summary?.title === 'string' && Array.isArray(prep1?.summary?.bullets) && prep1.summary.bullets.length > 0,
      `summary=${JSON.stringify(prep1?.summary).slice(0, 400)}`)
    ho.evidence.prepare1CarriesC = JSON.stringify(prep1?.summary ?? {}).includes(C_TEXT)
    const create1AdmittedAt = Date.now()
    const create1 = remoteValue(await remoteCall(c.origin, c.cookie, 'handoff.create', { sourceSessionId: ROOT_C1, requestToken: REQUEST_TOKEN_X }), 'handoff.create')
    ho.evidence.create1 = create1
    b1 = create1?.state
    ho.check('handoff.create completed for (C1, X)', b1?.kind === 'completed', `state=${JSON.stringify(b1).slice(0, 300)}`)
    ho.check('target B1 identity distinct from source C1 (minted handoff root)',
      typeof b1?.team?.teamSessionId === 'string' && b1.team.teamSessionId !== ROOT_C1 && b1.team.teamSessionId.startsWith('session-handoff-'),
      `B1=${b1?.team?.teamSessionId}`)
    ho.check('invariant 9: B1 teamSessionId === B1 rootSessionId', b1?.team?.teamSessionId === b1?.team?.rootSessionId, `team=${b1?.team?.teamSessionId} root=${b1?.team?.rootSessionId}`)
    const b1Header = readSessionHeader(HOME_C, b1?.team?.teamSessionId)
    ho.check('target B1 real Root Agent exists (durable root session log materialized under home C)', b1Header !== null, b1Header?.file ?? '<not found>')
    // 480 s budget: B1 is a freshly materialized handoff target root agent —
    // its first turn can hit the ~360 s gap (t12v-finding-360s-first-turn.md).
    const b1Text = await waitForLogTextContains(HOME_C, b1?.team?.teamSessionId, C_TEXT, 480_000)
    ho.check('context C reached the REAL target Agent B1 (durable root session log)', b1Text !== null, b1Text === null ? '<C not in B1 log within 480s>' : 'C present in B1 durable log')
    ho.evidence.targetB1FirstTurnLatencyMs = firstTurnLatencyEvidence(HOME_C, b1?.team?.teamSessionId, create1AdmittedAt)
    ho.check('B1 durable log carries the handoff provenance (sourceSessionId === C1 in the delivered context)',
      (logTextOf(HOME_C, b1?.team?.teamSessionId) ?? '').includes(ROOT_C1), 'provenance sourceSessionId containment')

    // ── leg 2: world B root (a DIFFERENT source team) + SAME token X -> B2 ──
    const p2 = await apiPrompt(b.origin, b.cookie, ROOT_B, C_TEXT)
    ho.check('context C delivered to the DIFFERENT source team (world B root)', p2.status === 200 && p2.body?.result?.ok === true, JSON.stringify(p2.body).slice(0, 200))
    const c2AdmittedAt = Date.now()
    // 480 s budget: first relayed turn on world B's root agent (~360 s gap class).
    const c2Ack = await waitForLogLineJson(HOME_B, ROOT_B, (l) => JSON.stringify(l).includes(`T12V_HANDBACK_ACK_${NONCE}`), 480_000)
    ho.check('second source turn settled with C in the durable log', c2Ack !== null, c2Ack === null ? '<ack missing after 480s>' : 'settled')
    ho.evidence.sourceBFirstTurnLatencyMs = firstTurnLatencyEvidence(HOME_B, ROOT_B, c2AdmittedAt)
    const prep2 = remoteValue(await remoteCall(b.origin, b.cookie, 'handoff.prepare', { sourceSessionId: ROOT_B }), 'handoff.prepare')
    ho.evidence.prepare2 = prep2
    ho.check('handoff.prepare returned a source summary for the second source team',
      prep2?.sourceSessionId === ROOT_B && Array.isArray(prep2?.summary?.bullets), `summary=${JSON.stringify(prep2?.summary).slice(0, 300)}`)
    ho.evidence.prepare2CarriesC = JSON.stringify(prep2?.summary ?? {}).includes(C_TEXT)
    const create2AdmittedAt = Date.now()
    const create2 = remoteValue(await remoteCall(b.origin, b.cookie, 'handoff.create', { sourceSessionId: ROOT_B, requestToken: REQUEST_TOKEN_X }), 'handoff.create')
    ho.evidence.create2 = create2
    b2 = create2?.state
    ho.check('handoff.create completed for (world B root, SAME X)', b2?.kind === 'completed', `state=${JSON.stringify(b2).slice(0, 300)}`)
    ho.check('B5 composite: SAME requestToken X from a DIFFERENT source team => DIFFERENT target identity',
      typeof b2?.team?.teamSessionId === 'string'
      && b2.team.teamSessionId !== b1?.team?.teamSessionId
      && b2.team.teamSessionId !== ROOT_B
      && b2.team.teamSessionId.startsWith('session-handoff-'),
      `B1=${b1?.team?.teamSessionId} B2=${b2?.team?.teamSessionId} X=${REQUEST_TOKEN_X}`)
    const b2Header = readSessionHeader(HOME_B, b2?.team?.teamSessionId)
    ho.check('target B2 real Root Agent exists (durable root session log materialized under home B)', b2Header !== null, b2Header?.file ?? '<not found>')
    // 480 s budget: B2 is a freshly materialized handoff target root agent
    // (~360 s gap class, t12v-finding-360s-first-turn.md).
    const b2Text = await waitForLogTextContains(HOME_B, b2?.team?.teamSessionId, C_TEXT, 480_000)
    ho.check('context C reached the REAL target Agent B2 (durable root session log)', b2Text !== null, b2Text === null ? '<C not in B2 log within 480s>' : 'C present in B2 durable log')
    ho.evidence.targetB2FirstTurnLatencyMs = firstTurnLatencyEvidence(HOME_B, b2?.team?.teamSessionId, create2AdmittedAt)
    ho.check('B2 durable log carries the handoff provenance (sourceSessionId === world B root in the delivered context)',
      (logTextOf(HOME_B, b2?.team?.teamSessionId) ?? '').includes(ROOT_B), 'provenance sourceSessionId containment')
  } catch (error) {
    ho.error = error
    ho.check('HANDOFF scenario completed without fatal error', false, String(error?.message ?? error))
  }
  scenarioResults.HANDOFF = ho.finish()
  log(`HANDOFF: pass=${scenarioResults.HANDOFF.pass}`)
  await stopWorld(c)
  const worldB = [...liveWorlds].find((w) => w.world === 'b')
  if (worldB !== undefined) await stopWorld(worldB)
}

main().catch((error) => {
  console.error(`t12-vertical fatal: ${error?.stack ?? error}`)
  try {
    mkdirSync(EVIDENCE_DIR, { recursive: true })
    appendFileSync(join(EVIDENCE_DIR, 't12v-run.log'), `[${new Date().toISOString()}] FATAL main: ${String(error?.stack ?? error)}\n`)
  } catch { /* ignore */ }
  process.exitCode = 1
})
