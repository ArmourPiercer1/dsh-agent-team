#!/usr/bin/env node
/**
 * F1 shim-scope probe runner (real DSH 0.1.5-rc.2 host, bounded follow-up
 * to PR #17 review).
 *
 * Boots ONE fresh 0.1.5-rc.2 host world (fresh DSH_HOME under the
 * worktree's tests/homes, 3180-family port, :3080 read-only pre/post)
 * with a profile-patch layer of TWO rows:
 *
 *   1. f1-shim-probe (FIRST — its `internal/get` observer must be live
 *      before the production row's /team-remote mount reads webServer);
 *   2. dsh-agent-team PRODUCTION row (worktree dist — the shim under test).
 *
 * The probe row records (probe/f1-shim-probe-row.mjs):
 *   P1 — an UNRELATED row's own `ctx.webServer` property read (no inject);
 *   P3 — an UNRELATED row's `connection.rpc.handle(...)` (foreign channel);
 *   P4 — reader-identity facts (team-mount vs foreign readerCtx);
 *   E1 — the full `internal/get` event trace (incl. the team mount's
 *        webServer read, passively captured).
 *
 * Verdict semantics (printed + summary.json):
 *   process-wide shim (pre-fix dist): P1 resolved + P3 registered
 *     = the over-broad scope, demonstrated live;
 *   scoped shim (post-fix dist): P1 threw + P3 threw (native Cordis
 *     failure) while the production /team-remote mount still succeeded
 *     (the E1 trace carries the team-mount webServer event served).
 *
 * Exit codes: 0 = probe completed (regardless of verdict), 2 = host boot
 * failed, 3 = probe report missing, 4 = setup failure.
 */
import { spawn } from 'node:child_process'
import {
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import net from 'node:net'
import { dirname, join } from 'node:path'
import { pathToFileURL, fileURLToPath } from 'node:url'

const WORKTREE = '/home/user/dsh-plugins/dsh-agent-team/.worktrees/fix-alpha2-explicit-agent-setup-compat'
const LIVE_HOST_DIR = join(WORKTREE, 'tests', 'live-host-015rc2', 'node_modules', '@deepseek-ai', 'dsh')
const HOST_BIN = join(LIVE_HOST_DIR, 'lib', 'bin.js')
const DIST_RUNTIME = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime')
const PRODUCTION_ROW_NAME = pathToFileURL(join(DIST_RUNTIME, 'src', 'plugin', 'host.js')).href
const FIXED_GLUE_URL = pathToFileURL(join(DIST_RUNTIME, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href
const SEAM_URL = pathToFileURL(join(WORKTREE, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href
const PROBE_ROW_NAME = pathToFileURL(join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'fix-alpha2-explicit-agent-setup-compat', 'probe', 'f1-shim-probe-row.mjs')).href

const STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19) // f1-shim-2026-09-14T08-xx-xxZ-ish
const RUN_DIR = join(WORKTREE, 'dev', 'agent-workflow', 'evidence', 'fix-alpha2-explicit-agent-setup-compat', 'probe', 'runs', `f1-shim-probe-${STAMP}`)
const HOME = join(WORKTREE, 'tests', 'homes', `f1-shim-probe-${STAMP}`)
const PROBE_REPORT = join(HOME, 'f1-probe-report.json')
const STABLE_URL = 'http://127.0.0.1:3080/'

function die(code, message) {
  console.error(`FATAL ${message}`)
  process.exit(code)
}

const pkg = JSON.parse(readFileSync(join(LIVE_HOST_DIR, 'package.json'), 'utf8'))
if (pkg.version !== '0.1.5-rc.2') die(4, `host version is ${pkg.version}, expected 0.1.5-rc.2`)
if (!existsSync(HOST_BIN)) die(4, 'host bin missing')
if (!existsSync(fileURLToPath(PRODUCTION_ROW_NAME))) die(4, 'production dist row missing (run pnpm build first)')

// ── :3080 redline (read-only probe; the stable instance must be unreachable) ─

function probe3080() {
  return new Promise((resolve) => {
    const req = net.connect(3080, '127.0.0.1', () => {
      req.destroy()
      resolve('REACHABLE')
    })
    req.on('error', (error) => resolve(`unreachable (${error.code})`))
    req.setTimeout(3000, () => {
      req.destroy()
      resolve('timeout')
    })
  })
}

// ── port selection (3180 family) ───────────────────────────────────────────

function portFree(port) {
  return new Promise((resolve) => {
    const srv = net.createServer()
    srv.once('error', () => resolve(false))
    srv.listen(port, '127.0.0.1', () => {
      srv.close(() => resolve(true))
    })
  })
}

async function pickPort() {
  for (const p of [3180, 3181, 3182, 3183, 3184, 3185, 3186]) {
    if (await portFree(p)) return p
  }
  die(4, 'no free port in the 3180 family')
}

// ── patch file ─────────────────────────────────────────────────────────────

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

const BOOT_BLUEPRINT = [
  '---',
  'schemaVersion: 1',
  'blueprintId: team.f1-probe-boot',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: "You are the leader of the f1 probe boot team."',
  'requirements: []',
  'memberEnvelopes: []',
  'policyStates: []',
  'metadata: {}',
  '---',
  '',
].join('\n')

function teamRowConfig() {
  return {
    rootSessionId: 'f1-probe-root',
    bootPhase: 'create',
    blueprintSource: BOOT_BLUEPRINT,
    blueprintDir: join(RUN_DIR, 'blueprints'),
    // The boot root uses the SHIPPED minimal preset (light surface; the F1
    // probe does not create team members and does not care about the
    // preset — the shim under test is preset-agnostic).
    rootPresetId: 'minimal',
    memberPresetId: 'minimal',
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'f1-probe-model' },
    deniedSelection: null,
    mcpServers: [],
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl: FIXED_GLUE_URL,
    seamUrl: SEAM_URL,
  }
}

function writePatchFile() {
  const patchPath = join(HOME, 'profiles', 'web', 'cordis.patch.yml')
  mkdirSync(dirname(patchPath), { recursive: true })
  const lines = [
    `# f1 shim-scope probe patch layer (run ${STAMP}): f1 observer row FIRST (its internal/get observer must be live before the production row's /team-remote mount) + production dsh-agent-team row (worktree dist).`,
    '- insert:',
    ...yamlEmitItem({ id: 'f1-shim-probe', name: PROBE_ROW_NAME, config: { outputPath: PROBE_REPORT } }, 2),
    ...yamlEmitItem({ id: 'dsh-agent-team', name: PRODUCTION_ROW_NAME, config: teamRowConfig() }, 2),
    '',
  ]
  writeFileSync(patchPath, lines.join('\n'))
  return patchPath
}

// ── host boot ──────────────────────────────────────────────────────────────

const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=[A-Za-z0-9_-]+/

function waitForLogLine(logPath, regex, timeoutMs, alive) {
  const deadline = Date.now() + timeoutMs
  let seen = 0
  return (async function loop() {
    for (;;) {
      let text = ''
      try {
        text = readFileSync(logPath, 'utf8')
      } catch { /* not written yet */ }
      const lines = text.split('\n')
      for (let i = seen; i < lines.length; i += 1) {
        const m = regex.exec(lines[i])
        if (m !== null) return lines[i]
      }
      seen = lines.length
      if (Date.now() >= deadline) return null
      if (alive() === false) return null
      await new Promise((r) => setTimeout(r, 300))
    }
  })()
}

function logTail(logPath, n = 30) {
  try {
    return readFileSync(logPath, 'utf8').split('\n').slice(-n).join('\n')
  } catch {
    return '<no log>'
  }
}

function spawnNpmHost({ port, home, logPath }) {
  const outFd = openSync(logPath, 'a')
  const errFd = openSync(logPath, 'a')
  const child = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(port), '--no-open'], {
    cwd: LIVE_HOST_DIR,
    stdio: ['ignore', outFd, errFd],
    env: {
      ...process.env,
      DSH_HOME: home,
      DSH_CLIENT_COMMIT_HASH: 'npm-0.1.5-rc.2',
    },
  })
  const exitInfo = { exited: false, code: undefined, signal: undefined }
  child.on('error', (error) => {
    exitInfo.exited = true
    exitInfo.message = error.message
  })
  child.on('close', (code, signal) => {
    exitInfo.exited = true
    exitInfo.code = code
    exitInfo.signal = signal
  })
  return { child, exitInfo, alive: () => !exitInfo.exited, logPath }
}

// ── main ───────────────────────────────────────────────────────────────────

const pre3080 = await probe3080()
console.log(`[f1-probe] :3080 pre  = ${pre3080}`)
if (pre3080 === 'REACHABLE') die(4, ':3080 reachable BEFORE the probe — aborting (redline)')

const port = await pickPort()
mkdirSync(RUN_DIR, { recursive: true })
mkdirSync(join(RUN_DIR, 'blueprints'), { recursive: true })
const patchPath = writePatchFile()
console.log(`[f1-probe] patch   = ${patchPath}`)
console.log(`[f1-probe] home    = ${HOME}`)
console.log(`[f1-probe] run     = ${RUN_DIR}`)
console.log(`[f1-probe] port    = ${port}`)

const h = spawnNpmHost({ port, home: HOME, logPath: join(RUN_DIR, 'instance.log') })
let report = null
try {
  const line = await waitForLogLine(h.logPath, BOOT_MARKER, 240_000, h.alive)
  if (line === null) {
    const detail = h.exitInfo.exited
      ? `process exited (code=${h.exitInfo.code} signal=${h.exitInfo.signal ?? 'none'})`
      : 'no boot marker within 240s'
    console.error(`--- instance log tail ---\n${logTail(h.logPath)}`)
    die(2, `host boot failed: ${detail}`)
  }
  console.log(`[f1-probe] host booted: ${line.replace(/.*dsh web:\s*/, '')}`)

  // The probe row writes its report when its apply completes (bounded
  // 60s connection poll inside the row).
  const rDeadline = Date.now() + 180_000
  for (;;) {
    if (existsSync(PROBE_REPORT)) {
      try {
        report = JSON.parse(readFileSync(PROBE_REPORT, 'utf8').trim().split('\n').pop())
        break
      } catch { /* half-written */ }
    }
    if (h.exitInfo.exited) {
      console.error(`--- instance log tail ---\n${logTail(h.logPath)}`)
      die(2, `host process exited before the probe report (code=${h.exitInfo.code})`)
    }
    if (Date.now() >= rDeadline) break
    await new Promise((r) => setTimeout(r, 500))
  }
  if (report === null) {
    console.error(`--- instance log tail ---\n${logTail(h.logPath)}`)
    die(3, 'probe report missing within 180s')
  }
  writeFileSync(join(RUN_DIR, 'probe-report.json'), JSON.stringify(report, null, 2))
} finally {
  try { h.child.kill() } catch { /* already gone */ }
  await new Promise((r) => setTimeout(r, 1500))
  try { if (!h.exitInfo.exited) h.child.kill('SIGKILL') } catch { /* already gone */ }
}

const post3080 = await probe3080()
console.log(`[f1-probe] :3080 post = ${post3080}`)

// ── verdict summary ────────────────────────────────────────────────────────

const r = report.results
const teamMountEvent = report.events.filter((e) => e.prop === 'webServer')
const summary = {
  probe: 'f1-shim-scope',
  stamp: STAMP,
  port,
  hostVersion: pkg.version,
  distRow: PRODUCTION_ROW_NAME,
  port3080: { pre: pre3080, post: post3080 },
  teamMountWebServerEvents: teamMountEvent.map((e) => ({ seq: e.seq, chain: e.reader.chain, fiber: e.reader.fiber })),
  p1_selfRead: r.p1_selfRead,
  p3_foreignRpcHandle: r['/f1-probe-foreign'],
  p3b_foreignRpcHandle2: r['/f1-probe-foreign-2'],
  p4_identity: r.p4_identity,
  thisRowChain: report.thisRowCtxBrief.chain,
}
writeFileSync(join(RUN_DIR, 'summary.json'), JSON.stringify(summary, null, 2))
console.log('[f1-probe] summary:')
console.log(JSON.stringify(summary, null, 2))
console.log('[f1-probe] done')
process.exit(0)
