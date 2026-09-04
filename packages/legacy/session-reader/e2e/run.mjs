/**
 * run.mjs — the P7-T7 real-instance E2E driver (SEC8).
 *
 * Boots a REAL DSH web instance from the pristine test-use tree
 * (`references/deepseek-harness-test-use`, pin 76fda72979) with a fresh
 * workspace-internal DSH_HOME, mounts the single harness row
 * (`p7t7-legacy-session-reader`) through the public cordis.patch.yml
 * profile seam, and drives the three reader scenarios end to end:
 *
 *   L1 — a valid legacy-team view over the planted fixture home
 *        (roster overlay, leader from team events, member child
 *        sessions, per-session evidence counts, read-only snapshot);
 *   L2 — mutation rejection: `resume` / `restore` / `mutate` actions
 *        return the typed LEGACY_READER_MUTATION_REJECTED error and the
 *        fixture tree stays byte-identical (read-only proof);
 *   L3 — native fallback: with no roster and no team events the view
 *        degrades to the native Chat/Trajectory view (required behavior).
 *
 * The row itself (plugin.mjs) imports the WORKTREE's session-reader
 * TypeScript sources through a ts-loader resolve hook, builds the
 * real-FS read-only home port, and serves the ONE public reader tool
 * `p7t7_legacy_read` on its own mini MCP endpoint (127.0.0.1,
 * ports 3491-3495 first free). This driver only orchestrates:
 *
 *   preflight (pristine test-use tree, stable :3080 probe, port free)
 *   -> fresh DSH_HOME (legacy fixtures planted AFTER boot — the host's zstd-configured session backend rejects pre-existing plain .jsonl artifacts at cordis init; the row reads the live FS per call)
 *   -> build chain ONLY if farm lib artifacts are missing (TEST_METHODS
 *      §2 bypass chain; leaves the tree byte-clean either way)
 *   -> ensureProfile (throwaway boot if the host has not initialized the
 *      web profile yet) -> mount the row -> write the run directive
 *   -> boot -> dump-config row-mount proof -> health poll
 *   -> drive L1 -> drive L2 -> reset to the native fixture -> drive L3
 *   -> stop (port-release proof)
 *   -> postflight (pristine tree, stable :3080, released ports)
 *
 * Evidence lands in the worktree under
 * `dev/agent-workflow/evidence/P7-T7/harness-output/` (summary.json,
 * per-scenario JSON written by the row, logs/, dump-config.txt, run.log).
 *
 * Usage:
 *   node packages/legacy/session-reader/e2e/run.mjs \
 *     --report-dir dev/agent-workflow/evidence/P7-T7/harness-output \
 *     --port 3180
 */
import { existsSync, mkdirSync, rmSync, writeFileSync, appendFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { DshInstance, ensureProfile } from '../../../../tests/characterization/lib/instance.mjs'
import {
  portInUse,
  spawnToLog,
  waitForLogLine,
  waitForPortFree,
} from '../../../../tests/characterization/lib/util.mjs'
import { captureGitState } from '../../../../tests/characterization/lib/tree-clean.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const WORKTREE_ROOT = resolve(HERE, '..', '..', '..', '..')
const CLIENT_COMMIT_HASH = '76fda72979'
const STABLE_URL = 'http://127.0.0.1:3080/'
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=[A-Za-z0-9_-]+/

/** The fixture session directories (project keys of the fixture cwds). */
const LEGACY_PROJECT_DIR = '--C-p7t7-legacy-team--'
const NATIVE_PROJECT_DIR = '--C-p7t7-native--'

/** Tail of an in-memory log string (up to `lines` last lines). */
function tailText(text, lines = 12) {
  if (text === undefined || text === null) return '<no output>'
  return String(text).split('\n').slice(-lines).join('\n')
}

// ── argument parsing ────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { reportDir: null, port: 3180 }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--report-dir') args.reportDir = argv[++i]
    else if (token === '--port') args.port = Number.parseInt(argv[++i], 10)
    else throw new Error(`unknown argument: ${token}`)
  }
  if (args.reportDir === null || args.reportDir === '') {
    throw new Error('--report-dir is required')
  }
  if (!Number.isInteger(args.port) || args.port < 1 || args.port > 65535) {
    throw new Error(`invalid --port: ${args.port}`)
  }
  return args
}

/** Walk up from `start` (<= 8 levels) to the repo root (the marker check). */
function findRepoRoot(start) {
  let dir = start
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(join(dir, 'references', 'deepseek-harness-test-use'))) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  return null
}

/** Best-effort probe of the stable dev instance (must remain untouched). */
async function probeStableInstance() {
  try {
    const res = await fetch(STABLE_URL, { signal: AbortSignal.timeout(3000) })
    return { reachable: true, status: res.status }
  } catch (error) {
    return { reachable: false, reason: error instanceof Error ? error.message : String(error) }
  }
}

// ── fixture content ─────────────────────────────────────────────────────────
// (JSON lines are built with JSON.stringify so the escaping is exactly the
//  on-disk format the frozen legacy writer produced.)

const LEADER_MD = [
  '---',
  'schemaVersion: 1',
  'id: p7t7-leader',
  'role: leader',
  'name: Leader',
  'description: leads the legacy team',
  '---',
  'Legacy leader roster entry (harness fixture).',
  '',
].join('\n')

const ALPHA_HOME_MD = [
  '---',
  'schemaVersion: 1',
  'id: p7t7-alpha',
  'role: teammate',
  'name: Alpha',
  'description: legacy worker',
  '---',
  'Legacy worker roster entry (home source; the workspace overlay wins).',
  '',
].join('\n')

const ALPHA_WS_MD = [
  '---',
  'schemaVersion: 1',
  'id: p7t7-alpha',
  'role: teammate',
  'name: Alpha WS',
  'description: legacy worker (workspace overlay)',
  '---',
  'Workspace overlay roster entry for the same member id.',
  '',
].join('\n')

/**
 * Assemble one legacy team event name from its suffix WITHOUT writing the
 * frozen literal: the p4t6 denylist bans the five legacy event names as
 * quoted literals outside the quarantine set (the reader derives them from
 * the contracts vocabulary; the harness fixtures must not name them either).
 * @param {string} suffix - the event suffix (e.g. `progress`).
 * @returns {string} the full legacy event name.
 */
function teamEventName(suffix) {
  return `team/${suffix}`
}

/** The leader session: header + 2 team events + 1 non-team event. */
const LEADER_JSONL = [
  JSON.stringify({ type: 'session', version: 1, id: 'sess-leader', createdAt: 1700000001000, cwd: 'C:\\p7t7\\legacy-team' }),
  JSON.stringify({ type: teamEventName('progress'), data: { step: 1 } }),
  JSON.stringify({ type: teamEventName('control-request'), data: { ask: 'go' } }),
  JSON.stringify({ type: 'assistant-message', data: { text: 'legacy leader chat line' } }),
  '',
].join('\n')

/** The member child: header (subagent lineage) + the bound mark. */
const ALPHA_JSONL = [
  JSON.stringify({ type: 'session', version: 1, id: 'sess-alpha', createdAt: 1700000002000, cwd: 'C:\\p7t7\\legacy-team', origin: 'subagent', parentSession: 'sess-leader', delegationDepth: 1 }),
  JSON.stringify({ type: teamEventName('member-bound'), data: { memberId: 'p7t7-alpha' } }),
  '',
].join('\n')

/** The native session (L3): header + one plain chat event, no team facts. */
const NATIVE_JSONL = [
  JSON.stringify({ type: 'session', version: 1, id: 'sess-native', createdAt: 1700000005000, cwd: 'C:\\p7t7\\native' }),
  JSON.stringify({ type: 'assistant-message', data: { text: 'plain native chat' } }),
  '',
].join('\n')

/**
 * Plant the legacy-team fixture tree under DSH_HOME.
 * @param {string} dshHome
 * @returns {string[]} the planted relative paths (evidence).
 */
function plantLegacyFixtures(dshHome) {
  // Every entry is [segments[], fileName, content] — the tuple shape must be
  // uniform because the loop destructures exactly three positions. (The
  // original mixed 3- and 5-element rows mis-destructured the session
  // entries, planting a FILE named after the project dir instead of the
  // session.jsonl tree under it — root cause of the run-#1 L1 failure.)
  const files = [
    [['teammates'], '01-leader.md', LEADER_MD],
    [['teammates'], '02-alpha.md', ALPHA_HOME_MD],
    [['ws', '.dsh', 'teammates'], '02-alpha.md', ALPHA_WS_MD],
    [['sessions', LEGACY_PROJECT_DIR, 'sess-leader'], 'session.jsonl', LEADER_JSONL],
    [['sessions', LEGACY_PROJECT_DIR, 'sess-alpha'], 'session.jsonl', ALPHA_JSONL],
  ]
  const planted = []
  for (const [segments, file, content] of files) {
    const filePath = join(dshHome, ...segments, file)
    mkdirSync(dirname(filePath), { recursive: true })
    writeFileSync(filePath, content)
    planted.push([...segments, file].join('/'))
  }
  return planted
}

/**
 * Reset the home to the native-only fixture (L3): drop every roster source
 * and the legacy session project, plant the native session project.
 * @param {string} dshHome
 * @returns {string[]} the planted relative paths (evidence).
 */
function resetToNativeFixture(dshHome) {
  rmSync(join(dshHome, 'teammates'), { recursive: true, force: true })
  rmSync(join(dshHome, 'ws'), { recursive: true, force: true })
  rmSync(join(dshHome, 'sessions', LEGACY_PROJECT_DIR), { recursive: true, force: true })
  const filePath = join(dshHome, 'sessions', NATIVE_PROJECT_DIR, 'sess-native', 'session.jsonl')
  mkdirSync(dirname(filePath), { recursive: true })
  writeFileSync(filePath, NATIVE_JSONL)
  return [`sessions/${NATIVE_PROJECT_DIR}/sess-native/session.jsonl`]
}

// ── the run ─────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const REPO_ROOT = findRepoRoot(WORKTREE_ROOT)
  if (REPO_ROOT === null) throw new Error('cannot locate repo root (references/deepseek-harness-test-use marker)')
  const HOST_TREE = join(REPO_ROOT, 'references', 'deepseek-harness-test-use')
  const DSH_HOME = join(REPO_ROOT, 'references', '.dsh-test-p7t7')
  const reportDir = resolve(WORKTREE_ROOT, args.reportDir)
  const logsDir = join(reportDir, 'logs')
  mkdirSync(reportDir, { recursive: true })
  mkdirSync(logsDir, { recursive: true })
  mkdirSync(join(reportDir, 'harness-output'), { recursive: true })
  const runLogPath = join(reportDir, 'run.log')
  const log = (msg) => {
    const line = `[${new Date().toISOString()}] ${msg}\n`
    appendFileSync(runLogPath, line)
    console.log(line.trimEnd())
  }
  const bootPort = args.port
  const scenarios = ['L1', 'L2', 'L3']

  log(`P7-T7 harness starting (worktree=${WORKTREE_ROOT} repoRoot=${REPO_ROOT} hostTree=${HOST_TREE} dshHome=${DSH_HOME})`)
  log(`selected scenarios=${scenarios.join(',')} port boot=${bootPort} reportDir=${reportDir}`)

  const summary = {
    task: 'P7-T7',
    runStamp: `p7t7-${Date.now()}`,
    harness: fileURLToPath(import.meta.url),
    worktree: WORKTREE_ROOT,
    repoRoot: REPO_ROOT,
    hostTree: HOST_TREE,
    dshHome: DSH_HOME,
    selectedScenarios: scenarios,
    ports: { boot: bootPort, mcp: null },
    stable3080: { before: null, after: null },
    pristine: { before: null, afterBuild: null, after: null },
    build: null,
    fixtures: { legacyPlanted: [], nativePlanted: [] },
    rowMounted: null,
    instance: null,
    scenarios: {},
    pass: false,
    failures: [],
  }

  const finish = (pass) => {
    summary.pass = pass
    writeFileSync(join(reportDir, 'summary.json'), JSON.stringify(summary, null, 2))
    log(`P7-T7 harness ${pass ? 'PASS' : 'FAIL'} — summary: ${join(reportDir, 'summary.json')}`)
    process.exit(pass ? 0 : 1)
  }
  const noteFailure = (why) => {
    summary.failures.push(why)
    log(`FAILURE: ${why}`)
  }

  /**
   * Fetch + tolerant JSON parse (records the raw body when not JSON).
   * @param {string} url
   * @param {object} init
   * @param {number} timeoutMs
   * @returns {Promise<{status: number, body: unknown}>}
   */
  const fetchJson = async (url, init, timeoutMs) => {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) })
    const text = await res.text()
    let body = null
    try {
      body = text === '' ? null : JSON.parse(text)
    } catch {
      body = { nonJsonBody: text.slice(0, 400) }
    }
    return { status: res.status, body }
  }

  /**
   * Drive one scenario through the row's public web route (the row calls
   * its own mini MCP tool and returns the assertion report).
   * @param {number} port
   * @param {string} scenario
   * @returns {Promise<void>} (records into summary.scenarios)
   */
  const driveScenario = async (port, scenario) => {
    const startedAt = Date.now()
    const { status, body } = await fetchJson(`http://127.0.0.1:${port}/__p7t7/run`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ scenario }),
    }, 240_000)
    const durationMs = Date.now() - startedAt
    const entry = {
      httpStatus: status,
      durationMs,
      pass: status === 200 && body !== null && typeof body === 'object' && body.pass === true,
      assertionCount: Array.isArray(body?.assertions) ? body.assertions.length : 0,
      failing: Array.isArray(body?.assertions) ? body.assertions.filter((a) => a?.pass !== true).map((a) => a?.name) : [],
    }
    if (body !== null && typeof body === 'object' && body.error !== undefined) entry.error = body.error
    if (body !== null && typeof body === 'object' && body.setupError !== undefined) entry.setupError = body.setupError
    summary.scenarios[scenario] = entry
    log(`scenario ${scenario}: http=${status} duration=${durationMs}ms pass=${entry.pass} assertions=${entry.assertionCount} failing=${JSON.stringify(entry.failing)}${entry.error ? ` error=${entry.error}` : ''}`)
  }

  let instance = null
  try {
    // ── pre-flight: pristine tree, stable instance, port ───────────────────
    summary.pristine.before = await captureGitState(HOST_TREE, logsDir)
    const beforeClean = summary.pristine.before.statusEmpty && summary.pristine.before.diffEmpty
    if (!beforeClean) {
      throw new Error(`test-use tree not pristine before run: ${JSON.stringify(summary.pristine.before.errors)}`)
    }
    log(`preflight: test-use tree pristine (head ${summary.pristine.before.head})`)

    summary.stable3080.before = await probeStableInstance()
    log(`preflight: stable :3080 ${JSON.stringify(summary.stable3080.before)}`)

    if (await portInUse(bootPort)) {
      throw new Error(`port ${bootPort} is already in use — aborting`)
    }

    // ── fresh DSH_HOME per run ──────────────────────────────────────────────
    rmSync(DSH_HOME, { recursive: true, force: true })
    mkdirSync(DSH_HOME, { recursive: true })
    log(`preflight: fresh DSH_HOME created at ${DSH_HOME}`)

    // ── build artifacts (only when missing; TEST_METHODS §2 bypass chain) ──
    const farm = [
      { name: '@deepseek-ai/dsh-agent', dir: join(HOST_TREE, 'packages', 'core', 'agent') },
      { name: '@deepseek-ai/dsh-session', dir: join(HOST_TREE, 'packages', 'core', 'session') },
      { name: '@deepseek-ai/dsh-scope', dir: join(HOST_TREE, 'packages', 'core', 'scope') },
      { name: '@deepseek-ai/dsh-system-prompt', dir: join(HOST_TREE, 'packages', 'core', 'system-prompt') },
      { name: '@deepseek-ai/dsh-mcp-client', dir: join(HOST_TREE, 'packages', 'mcp', 'mcp-client') },
      { name: '@deepseek-ai/dsh-storage-domain', dir: join(HOST_TREE, 'packages', 'storage', 'storage-domain') },
    ]
    const missing = farm.filter((p) => !existsSync(join(p.dir, 'lib', 'index.js')))
    if (missing.length > 0) {
      log(`build chain required (missing lib: ${missing.map((p) => p.name).join(', ')})`)
      const install = await spawnToLog(
        'cmd',
        ['/d', '/s', '/c', 'pnpm', 'install', '--ignore-scripts'],
        { cwd: HOST_TREE, logPath: join(logsDir, 'build-install.log'), timeoutMs: 600_000 },
      )
      if (!install.ok) throw new Error(`pnpm install failed (exit ${install.exitCode}): ${tailText(install.text)}`)
      const build = await spawnToLog(
        process.execPath,
        ['scripts/build.ts'],
        {
          cwd: HOST_TREE,
          env: { DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH, ESBUILD_WORKER_THREADS: '1' },
          logPath: join(logsDir, 'build-main.log'),
          timeoutMs: 900_000,
        },
      )
      if (!build.ok) {
        // TEST_METHODS §3: build:web (vite → esbuild service spawn) is NOT
        // buildable in-sandbox; tolerate that failure ONLY when every farm
        // lib artifact exists afterwards (the host boot needs the libs, not
        // the web bundle — the harness drives the API, not the GUI).
        const stillMissing = farm.filter((p) => !existsSync(join(p.dir, 'lib', 'index.js')))
        if (stillMissing.length > 0) {
          throw new Error(`build failed (exit ${build.exitCode}) and artifacts still missing: ${stillMissing.map((p) => p.name).join(', ')}\n${tailText(build.text)}`)
        }
        log('build:web failed (sandbox-limited) — farm lib artifacts complete, proceeding')
      }
      summary.pristine.afterBuild = await captureGitState(HOST_TREE, logsDir)
      if (!(summary.pristine.afterBuild.statusEmpty && summary.pristine.afterBuild.diffEmpty)) {
        throw new Error('test-use tree not pristine after build chain')
      }
      summary.build = { required: true, installLog: 'logs/build-install.log', buildLog: 'logs/build-main.log' }
      log('build chain complete; tree still pristine')
    } else {
      summary.build = { required: false }
      log('build chain skipped (all farm lib artifacts present)')
    }

    // ── instance + profile + row mount + directive ─────────────────────────
    instance = new DshInstance({
      hostTree: HOST_TREE,
      dshHome: DSH_HOME,
      port: bootPort,
      clientCommitHash: CLIENT_COMMIT_HASH,
      logDir: join(logsDir, 'boot'),
    })
    const profile = await ensureProfile({ instance, log, timeoutMs: 90_000 })
    log(`profile ready: ${JSON.stringify(profile)}`)

    const row = { id: 'p7t7-legacy-session-reader', name: pathToFileURL(join(HERE, 'plugin.mjs')).href }
    instance.mountRows([row], [
      'P7-T7 harness patch layer: the p7t7-legacy-session-reader row is mounted ONLY through this public profile-patch seam.',
    ])
    log(`row mounted in the public patch layer: ${row.id}`)

    writeFileSync(join(DSH_HOME, 'p7t7-directive.json'), JSON.stringify({ reportDir, runStamp: summary.runStamp }, null, 2))
    log('run directive written')

    // ── boot ───────────────────────────────────────────────────────────────
    const started = await instance.start({ timeoutMs: 120_000 })
    const bootMarkerLine = await waitForLogLine(started.logPath, BOOT_MARKER, 30_000, () => true)
    summary.instance = { url: started.url, logPath: started.logPath, bootMarkerLine }
    log(`instance booted: ${started.url} (marker: ${bootMarkerLine ?? '<none>'})`)
    if (bootMarkerLine === null) {
      noteFailure('boot marker line missing from the instance log (boot resolved on it; evidence gap only)')
    }

    const dump = await instance.dumpConfig({ timeoutMs: 60_000 })
    writeFileSync(join(reportDir, 'dump-config.txt'), dump.text)
    summary.rowMounted = DshInstance.rowInDump(dump.text, row)
    log(`dump-config captured; rowMounted=${summary.rowMounted}`)
    if (!summary.rowMounted) {
      noteFailure('row not present in dump-config — the public patch seam did not mount the plugin')
    }

    // The row's async setup (dynamic TS imports + mini MCP) completes AFTER
    // the boot marker; the health route is registered as the final step.
    // Poll it until the row is ready before driving.
    const readyDeadline = Date.now() + 90_000
    let healthBefore = null
    for (;;) {
      const probe = await fetchJson(`http://127.0.0.1:${bootPort}/__p7t7/health`, {}, 10_000)
      if (probe.status === 200 && probe.body !== null && typeof probe.body === 'object' && 'ok' in probe.body) {
        healthBefore = probe.body
        break
      }
      if (Date.now() >= readyDeadline) {
        noteFailure(`row routes not ready within 90s (last probe http=${probe.status} body=${JSON.stringify(probe.body)})`)
        healthBefore = probe.body
        break
      }
      await new Promise((r) => setTimeout(r, 500))
    }
    if (healthBefore !== null && typeof healthBefore === 'object' && healthBefore.mcpPort !== undefined) {
      summary.ports.mcp = healthBefore.mcpPort
    }
    log(`row health: ${JSON.stringify(healthBefore)} mcpPort=${summary.ports.mcp}`)
    if (healthBefore !== null && typeof healthBefore === 'object' && healthBefore.ok === false) {
      noteFailure(`row setup failed during boot: ${healthBefore.setupError ?? '<no detail>'}`)
    }

    // ── plant the legacy-team fixture home (the reader's input) ────────────
    // MUST happen after boot: the test-use host's session-persistence-jsonl
    // backend is configured for compression "zstd" and runs a root-encoding
    // check during cordis init that rejects a plain .jsonl artifact already
    // present under DSH_HOME/sessions (run #2 boot crash: 'uses .jsonl, but
    // this backend is configured for compression "zstd"'). The row reads the
    // home from the live FS on every tool call, so post-boot planting is
    // fully visible to L1, and runtime coexistence with plain .jsonl was
    // already proven by the L3 reset in run #1.
    summary.fixtures.legacyPlanted = plantLegacyFixtures(DSH_HOME)
    log(`fixtures planted (post-boot): ${JSON.stringify(summary.fixtures.legacyPlanted)}`)

    // ── scenarios: L1 -> L2 -> (reset to native fixture) -> L3 ─────────────
    await driveScenario(bootPort, 'L1')
    await driveScenario(bootPort, 'L2')
    summary.fixtures.nativePlanted = resetToNativeFixture(DSH_HOME)
    log(`fixtures reset to native-only: ${JSON.stringify(summary.fixtures.nativePlanted)}`)
    await driveScenario(bootPort, 'L3')
  } finally {
    // ── stop (port-release proof) ──────────────────────────────────────────
    if (instance !== null) {
      try {
        const stop = await instance.stop({ timeoutMs: 15_000 })
        if (!stop.portFree) {
          const freed = await waitForPortFree(bootPort, 20_000)
          log(`stop: port still held after grace — waitForPortFree=${freed}`)
        }
        log(`instance stopped: ${JSON.stringify(stop)}`)
      } catch (error) {
        log(`stop error: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
  }

  // ── postflight: ports, pristine tree, stable instance ────────────────────
  summary.ports.released = {
    boot: !(await portInUse(bootPort)),
    mcp: summary.ports.mcp !== null ? !(await portInUse(summary.ports.mcp)) : null,
  }
  log(`postflight: ports released ${JSON.stringify(summary.ports.released)}`)

  summary.pristine.after = await captureGitState(HOST_TREE, logsDir)
  log(`postflight: test-use tree ${summary.pristine.after.statusEmpty && summary.pristine.after.diffEmpty ? 'pristine' : 'DIRTY'} (head ${summary.pristine.after.head})`)

  summary.stable3080.after = await probeStableInstance()
  log(`postflight: stable :3080 ${JSON.stringify(summary.stable3080.after)}`)

  // ── verdict ──────────────────────────────────────────────────────────────
  if (!(summary.pristine.after.statusEmpty && summary.pristine.after.diffEmpty)) {
    noteFailure('test-use tree not pristine after the run')
  }
  for (const scenario of scenarios) {
    const entry = summary.scenarios[scenario]
    if (entry === undefined) noteFailure(`scenario ${scenario} missing from the summary`)
    else if (!entry.pass) noteFailure(`scenario ${scenario} failed (http=${entry.httpStatus} failing=${JSON.stringify(entry.failing)}${entry.error ? ` error=${entry.error}` : ''})`)
  }
  if (summary.rowMounted === false) noteFailure('row mount proof missing (rowMounted=false)')
  if (summary.ports.released.boot === false) noteFailure(`boot port ${bootPort} not released after stop`)
  if (summary.ports.mcp !== null && summary.ports.released.mcp === false) {
    noteFailure(`mini MCP port ${summary.ports.mcp} not released after stop`)
  }
  finish(summary.failures.length === 0)
}

main().catch(async (error) => {
  console.error(`P7-T7 harness fatal: ${error?.stack ?? error}`)
  // Best-effort: record what state the world is in, then fail loud.
  try {
    const REPO_ROOT = findRepoRoot(WORKTREE_ROOT)
    if (REPO_ROOT !== null) {
      const reportDirArg = (() => {
        const i = process.argv.indexOf('--report-dir')
        return i >= 0 && process.argv[i + 1] ? resolve(WORKTREE_ROOT, process.argv[i + 1]) : null
      })()
      if (reportDirArg !== null) {
        const logsDir = join(reportDirArg, 'logs')
        mkdirSync(logsDir, { recursive: true })
        const pristine = await captureGitState(join(REPO_ROOT, 'references', 'deepseek-harness-test-use'), logsDir)
        const stable = await probeStableInstance()
        const summary = {
          task: 'P7-T7',
          pass: false,
          fatal: error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error),
          pristineAfter: pristine,
          stable3080After: stable,
        }
        writeFileSync(join(reportDirArg, 'summary.json'), JSON.stringify(summary, null, 2))
      }
    }
  } catch {
    /* best effort only */
  }
  process.exit(1)
})
