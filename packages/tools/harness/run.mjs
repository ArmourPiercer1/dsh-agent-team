#!/usr/bin/env node
/**
 * P6-T6 real-instance harness — drives a REAL DSH test instance through the
 * team-tools layer end-to-end (G6 criteria E1-E7) using PUBLIC surfaces only:
 * the profile-patch row mount (verified by dump-config), webServer-scoped
 * row routes, and DSH_HOME durable files. The driver NEVER calls the
 * TeamRuntime API: every team action travels driver -> HTTP /__p6t6/tool ->
 * the registered tool handler (public Cordis tool registration + execution
 * seams) -> TeamRuntime/guard/messaging/activity (criterion 7).
 *
 * No real LLM calls are made: the row installs a static model reference
 * (p6t6-static/p6t6-model-v1) that no provider in the fresh test DSH_HOME
 * serves, so followup turns fail contained and the quiescence wait settles.
 *
 * Usage:
 *   node packages/tools/harness/run.mjs \
 *     --report-dir dev/agent-workflow/evidence/P6-T6/harness-output \
 *     [--scenarios E1,E2,E3,E4,E5,E6,E7] \
 *     [--port 3180]
 *
 * Layout (resolved by walking up from this file):
 *   REPO_ROOT  — the ancestor containing references/deepseek-harness-test-use
 *   HOST_TREE  — REPO_ROOT/references/deepseek-harness-test-use (pristine
 *                upstream test-use tree; git-clean asserted before AND after)
 *   DSH_HOME   — REPO_ROOT/references/.dsh-test-p6t6 (task-specific; FRESH
 *                per run: removed and recreated; gitignored; workspace-internal)
 *
 * Boot plan (serial; ports alternate; each boot is a fresh OS process over
 * the SAME DSH_HOME, so boot 2 reads boot 1's durable state):
 *   boot 1 (port, default 3180): the P6-T6 team-tools row (plugin.mjs)
 *        creates the team root + seeds three members (leader bound to the
 *        root, one worker, one scout), then the driver runs:
 *        E1 same-template concurrent creates (3 workers, distinct tokens),
 *        E2 instance-addressed actions live-rejected on label/template
 *        addressing (ACTION_ADDRESSING_REJECTED), E3 persistent follow-up
 *        (same child session), E4 fresh_per_delegation new instances,
 *        E6 template quota race (==limit admitted, >limit rejected, never
 *        over-created), E5 boot-1 write phase (team message to the leader,
 *        two progress reports, one pending control request) — then the
 *        process is KILLED (ordinary stop; the durable state must survive).
 *   boot 2 (port+1, default 3181): the SAME row over the SAME DSH_HOME
 *        resumes the root + every bound member child; the driver runs the
 *        E5 restart phase: durable read-back (members, control request
 *        still pending, activity sequences intact, no skipped deliveries),
 *        leader resolution of the request, the guarded follow-up consuming
 *        the persisted allow exactly once (retry blocked
 *        'allow-consumed', a fresh token proceeds as no-request), and the
 *        per-subject progress sequence continuing (3).
 *   E7 (driver process, no boot): the committed static bypass scan
 *        (packages/tools/test/p6t6-bypass-scan.mjs) re-run over the live
 *        worktree sources: zero violations across the five tool-layer
 *        source files.
 *
 * Pristine self-checks recorded in summary.json:
 *   - test-use tree git status clean before (and after) the run;
 *   - stable :3080 development instance probed (GET only) before and after
 *     — must be reachable/200 both times (never touched);
 *   - the junction farm under packages/node_modules is removed post-flight.
 */

import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { basename, dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  DshInstance,
  ensureProfile,
  ensureProbeResolution,
} from '../../../tests/characterization/lib/instance.mjs'
import {
  portInUse,
  spawnToLog,
  waitForLogLine,
  waitForPortFree,
} from '../../../tests/characterization/lib/util.mjs'
import { captureGitState } from '../../../tests/characterization/lib/tree-clean.mjs'
import { closeMiniServer, startMiniMcpServer } from '../../runtime/root-binding/harness/mini-mcp.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const WORKTREE_ROOT = resolve(HERE, '..', '..', '..')
const CLIENT_COMMIT_HASH = 'cd5ef814'
const STABLE_URL = 'http://127.0.0.1:3080/'
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=[A-Za-z0-9_-]+/

/** The team root session id (directive-carried; boot 1 creates, boot 2 resumes). */
const ROOT_SESSION_ID = 'session-p6t6root'
/** The leader member instance (its bound child session IS the root). */
const LEADER_INSTANCE_ID = 'inst-leader'
/** The seeded worker / scout instance ids (plugin.mjs mirrors these). */
const SEED_WORKER_ID = 'inst-p6t6seedw1'
const SEED_SCOUT_ID = 'inst-p6t6seeds1'
/** The E5 control-plane correlation token (boot 1 request, boot 2 consume). */
const E5_CTRL_TOKEN = 'p6t6-e5-ctrl1'
/** The ten registered team tool names (asserted on health). */
const EXPECTED_TOOL_COUNT = 10
/** E7: the exact tool-layer source files the committed scanner must cover. */
const EXPECTED_SCAN_FILES = [
  'packages/tools/src/guard.ts',
  'packages/tools/src/index.ts',
  'packages/tools/src/tokens.ts',
  'packages/tools/src/tools.ts',
  'packages/tools/src/types.ts',
]
/** Scenario dependency closure (a selected scenario needs its deps selected). */
const SCENARIO_DEPS = {
  E1: [],
  E2: ['E1'],
  E3: ['E1'],
  E4: [],
  E5: ['E1'],
  E6: ['E4'],
  E7: [],
}
const ALL_SCENARIOS = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7']

/** Tail of an in-memory log string (up to `lines` last lines). */
function tailText(text, lines = 12) {
  if (text === undefined || text === null) return '<no output>'
  return String(text).split('\n').slice(-lines).join('\n')
}

// ── argument parsing ────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { reportDir: null, scenarios: ALL_SCENARIOS.join(','), port: 3180 }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--report-dir') args.reportDir = argv[++i]
    else if (token === '--scenarios') args.scenarios = argv[++i]
    else if (token === '--port') args.port = Number.parseInt(argv[++i], 10)
    else throw new Error(`unknown argument: ${token}`)
  }
  if (args.reportDir === null) throw new Error('--report-dir is required')
  if (!Number.isInteger(args.port) || args.port < 1 || args.port > 65535) {
    throw new Error(`invalid --port: ${args.port}`)
  }
  const selected = String(args.scenarios)
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  for (const s of selected) {
    if (!ALL_SCENARIOS.includes(s)) throw new Error(`unknown scenario: ${s}`)
  }
  args.selected = selected
  return args
}

// ── path discovery ──────────────────────────────────────────────────────────

/** Walk up from `start` until the references/deepseek-harness-test-use marker. */
function findRepoRoot(start) {
  let dir = start
  for (;;) {
    if (existsSync(join(dir, 'references', 'deepseek-harness-test-use'))) return dir
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
}

/** Locate a zod dir inside the host tree's pnpm store. */
function findZodDir(hostTree) {
  const pnpmDir = join(hostTree, 'node_modules', '.pnpm')
  if (existsSync(pnpmDir)) {
    const candidates = readdirSync(pnpmDir)
      .filter((n) => n.startsWith('zod@'))
      .sort()
    if (candidates.length > 0) {
      const dir = join(pnpmDir, candidates[candidates.length - 1], 'node_modules', 'zod')
      if (existsSync(dir)) return dir
    }
  }
  const fallback = join(hostTree, 'node_modules', 'zod')
  return existsSync(fallback) ? fallback : null
}

// ── stable-instance probe (GET only — never mutates) ───────────────────────

async function probeStableInstance() {
  try {
    const res = await fetch(STABLE_URL, { signal: AbortSignal.timeout(3000) })
    return { reachable: true, status: res.status }
  } catch (error) {
    return { reachable: false, reason: error?.name ?? 'error' }
  }
}

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const reportDir = resolve(WORKTREE_ROOT, args.reportDir)
  const logsDir = join(reportDir, 'logs')
  mkdirSync(logsDir, { recursive: true })

  const runLogPath = join(reportDir, 'run.log')
  const log = (line) => {
    const stamped = `${new Date().toISOString()} ${line}`
    console.log(stamped)
    appendFileSync(runLogPath, `${stamped}\n`)
  }

  const REPO_ROOT = findRepoRoot(HERE)
  if (REPO_ROOT === null) throw new Error('cannot locate repo root (references/deepseek-harness-test-use marker)')
  const HOST_TREE = join(REPO_ROOT, 'references', 'deepseek-harness-test-use')
  const DSH_HOME = join(REPO_ROOT, 'references', '.dsh-test-p6t6')
  const portA = args.port
  const portB = args.port + 1

  const runStamp = `p6t6-${Date.now()}`
  log(`P6-T6 harness start: runStamp=${runStamp} worktree=${WORKTREE_ROOT}`)
  log(`repo root=${REPO_ROOT} hostTree=${HOST_TREE} dshHome=${DSH_HOME}`)
  log(`ports: boot1=${portA} boot2=${portB}; selected scenarios: ${args.selected.join(',')}`)

  const summary = {
    task: 'P6-T6 team tools + orchestration E2E (G6 criteria E1-E7)',
    runStamp,
    harness: 'packages/tools/harness',
    worktree: WORKTREE_ROOT,
    hostTree: HOST_TREE,
    dshHome: DSH_HOME,
    selectedScenarios: args.selected,
    ports: { boot1: portA, boot2: portB, mcp: null, released: {} },
    stable3080: { before: null, after: null },
    pristine: { before: null, afterBuild: null, after: null },
    build: null,
    rowMounted: {},
    boots: {},
    scenarios: {},
    pass: false,
    failures: [],
  }

  const finish = (pass, extra) => {
    summary.pass = pass
    if (extra !== undefined) Object.assign(summary, extra)
    writeFileSync(join(reportDir, 'summary.json'), JSON.stringify(summary, null, 2))
    log(`P6-T6 harness ${pass ? 'PASS' : 'FAIL'} — summary: ${join(reportDir, 'summary.json')}`)
    process.exit(pass ? 0 : 1)
  }
  const noteFailure = (why) => {
    summary.failures.push(why)
    log(`FAILURE: ${why}`)
  }

  let mini = null
  const PROBE_FARM_DIR = resolve(HERE, '..', '..') // packages/ (shared junction farm)
  const removeFarm = () => {
    try {
      rmSync(join(PROBE_FARM_DIR, 'node_modules'), { recursive: true, force: true })
      log('postflight: junction farm removed (packages/node_modules)')
    } catch {
      /* best effort */
    }
  }

  try {
    // ── pre-flight: pristine tree, stable instance, ports ───────────────────
    summary.pristine.before = await captureGitState(HOST_TREE, logsDir)
    const beforeClean = summary.pristine.before.statusEmpty && summary.pristine.before.diffEmpty
    if (!beforeClean) throw new Error(`test-use tree not pristine before run: ${JSON.stringify(summary.pristine.before.errors)}`)
    log(`preflight: test-use tree pristine (head ${summary.pristine.before.head})`)

    summary.stable3080.before = await probeStableInstance()
    log(`preflight: stable :3080 ${JSON.stringify(summary.stable3080.before)}`)
    if (!(summary.stable3080.before.reachable === true && summary.stable3080.before.status === 200)) {
      throw new Error(`stable :3080 instance is not reachable/200 before the run — refusing to proceed (brief §6c)`)
    }

    if ((await portInUse(portA)) || (await portInUse(portB))) {
      throw new Error(`ports ${portA}/${portB} are already in use — aborting`)
    }

    // ── fresh task-specific DSH_HOME per run (never .dsh-test-p5t6) ─────────
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
      { name: '@deepseek-ai/dsh-llm', dir: join(HOST_TREE, 'packages', 'llm', 'llm') },
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
      let webSandboxLimited = false
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
        // buildable in-sandbox (piped-stdio spawn EPERM) and does not affect
        // host-side functionality. Tolerate the failure ONLY when the
        // complete build:lib artifact set the harness needs is present.
        const missingAfterBuild = farm.filter((p) => !existsSync(join(p.dir, 'lib', 'index.js')))
        if (missingAfterBuild.length > 0) {
          throw new Error(`node scripts/build.ts failed and build:lib artifacts are missing: ${missingAfterBuild.map((p) => p.name).join(', ')} — ${tailText(build.text)}`)
        }
        log('build:web failed in-sandbox (vite→esbuild spawn EPERM, documented in TEST_METHODS §3); build:lib artifacts complete — continuing')
        webSandboxLimited = true
      }
      summary.build = {
        required: true,
        missingBefore: missing.map((p) => p.name),
        installLog: 'logs/build-install.log',
        buildLog: 'logs/build-main.log',
        webBuildSandboxLimited,
      }
      summary.pristine.afterBuild = await captureGitState(HOST_TREE, logsDir)
      if (!(summary.pristine.afterBuild.statusEmpty && summary.pristine.afterBuild.diffEmpty)) {
        throw new Error('test-use tree not pristine after build chain')
      }
      log('build chain complete; tree still pristine')
    } else {
      summary.build = { required: false }
    }
    const stillMissing = farm.filter((p) => !existsSync(join(p.dir, 'lib', 'index.js')))
    if (stillMissing.length > 0) {
      throw new Error(`build artifacts still missing after build chain: ${stillMissing.map((p) => p.name).join(', ')}`)
    }

    // ── junction farm for bare specifiers (packages/node_modules) ───────────
    // The farm lives at the COMMON ANCESTOR of every harness dir
    // (packages/): the tools row (packages/tools/harness) and the reused
    // runtime rows resolve their static @deepseek-ai/* imports by walking up
    // to packages/node_modules.
    const zodDir = findZodDir(HOST_TREE)
    if (zodDir === null) throw new Error('zod not found in test-use node_modules')
    rmSync(join(HERE, 'node_modules'), { recursive: true, force: true })
    ensureProbeResolution({
      probesDir: PROBE_FARM_DIR,
      packages: [...farm, { name: 'zod', dir: zodDir }],
      log,
    })
    log('junction farm ready (shared packages/node_modules)')

    // ── mini MCP server (127.0.0.1, ports 3491-3495 candidates) ─────────────
    mini = await startMiniMcpServer([3491, 3492, 3493, 3494, 3495])
    summary.ports.mcp = mini.port
    log(`mini MCP server up on 127.0.0.1:${mini.port}`)

    // ── driver core ──────────────────────────────────────────────────────────

    /** Fetch + tolerant JSON parse (records the raw body when not JSON). */
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

    /** One registered tool call through the public execution seam. */
    const callTool = async (ctx, port, name, args, as) => {
      ctx.http.toolCalls += 1
      const { status, body } = await fetchJson(`http://127.0.0.1:${port}/__p6t6/tool`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name, args, as }),
      }, 180_000)
      if (status !== 200) ctx.http.non200.push({ call: name, status, body: body === null ? null : JSON.stringify(body).slice(0, 400) })
      return { status, body }
    }

    /** One durable read-back through the row state route. */
    const getState = async (ctx, port) => {
      ctx.http.stateCalls += 1
      const { status, body } = await fetchJson(`http://127.0.0.1:${port}/__p6t6/state`, {}, 30_000)
      if (status !== 200) ctx.http.non200.push({ call: 'state', status, body: body === null ? null : JSON.stringify(body).slice(0, 400) })
      return { status, body }
    }

    /**
     * One scenario context: assertion collector + HTTP accounting + shared
     * cross-scenario state. `check` records and returns the predicate.
     */
    const makeScenarioCtx = (criterion, phase, boot) => {
      const c = {
        criterion,
        phase,
        boot,
        t0: Date.now(),
        http: { toolCalls: 0, stateCalls: 0, non200: [] },
        assertions: [],
        evidence: {},
        check(name, cond, detail) {
          const pass = cond === true
          c.assertions.push({ name, pass, ...(detail !== undefined ? { detail: String(detail).slice(0, 600) } : {}) })
          return pass
        },
        failing() {
          return c.assertions.filter((a) => a.pass !== true).map((a) => a.name)
        },
      }
      return c
    }

    /** Shared mutable state carried across scenarios within one run. */
    const S = {
      memberIdsBoot1Final: null,
      e1: { created: [], w: null, wChild: null },
      e4: { created: [] },
      e5: { requestId: null, message: null, progressSequences: [], postMessage: null, postProgress: null },
    }

    /** Record one scenario entry: summary.scenarios + per-scenario JSON file. */
    const recordScenario = (c) => {
      const entry = {
        criterion: c.criterion,
        phase: c.phase,
        boot: c.boot,
        pass: c.failing().length === 0,
        durationMs: Date.now() - c.t0,
        assertions: c.assertions,
        failing: c.failing(),
        http: c.http,
        evidence: c.evidence,
      }
      const fileName = `${c.criterion}${c.phase !== undefined ? `-${c.phase}` : ''}.json`
      writeFileSync(join(reportDir, fileName), JSON.stringify(entry, null, 2))
      entry.reportFile = `harness-output/${fileName}`
      if (c.criterion === 'E5') {
        // E5 spans two boots; merge every phase into ONE summary entry with
        // a phases map so the verdict and the boot-1 sanity check see it.
        const prev = summary.scenarios.E5
        summary.scenarios.E5 = {
          criterion: 'E5',
          pass: (prev === undefined ? true : prev.pass) && entry.pass,
          phases: { ...(prev?.phases ?? {}), [entry.phase]: entry },
          reportFiles: [...(prev?.reportFiles ?? []), entry.reportFile],
        }
      } else {
        summary.scenarios[c.criterion] = entry
      }
      log(`scenario ${c.criterion}${c.phase !== undefined ? `(${c.phase})` : ''}: pass=${entry.pass} assertions=${entry.assertions.length} failing=${JSON.stringify(entry.failing)} (${entry.durationMs}ms)`)
      return entry
    }

    const selected = (sc) => args.selected.includes(sc)
    const runnable = (sc) =>
      selected(sc) && SCENARIO_DEPS[sc].every((d) => selected(d))
    const skipEntry = (sc, phase, boot, reason) => {
      const entry = {
        criterion: sc,
        phase,
        boot,
        pass: false,
        skipped: true,
        reason,
        assertions: [],
        failing: [reason],
      }
      if (sc === 'E5') {
        const prev = summary.scenarios.E5
        summary.scenarios.E5 = {
          criterion: 'E5',
          pass: false,
          phases: { ...(prev?.phases ?? {}), [phase]: entry },
          reportFiles: prev?.reportFiles ?? [],
        }
      } else {
        summary.scenarios[sc] = entry
      }
      noteFailure(`scenario ${sc}${phase !== undefined ? `(${phase})` : ''} skipped: ${reason}`)
      return entry
    }

    // ── scenario implementations (driver-side; every action via /__p6t6/tool)

    /** E7 (criterion 7, static): the committed bypass scan over the live tree. */
    const runE7 = async () => {
      const c = makeScenarioCtx('E7', undefined, undefined)
      const scanner = await import(pathToFileURL(join(HERE, '..', 'test', 'p6t6-bypass-scan.mjs')).href)
      const scan = await scanner.scanToolsBypass()
      c.evidence = {
        files: scan.files,
        totalImportSpecifiers: scan.totalImportSpecifiers,
        totalViolations: scan.totalViolations,
        violations: scan.violations,
      }
      c.check('scan covers exactly the five committed tool-layer source files', JSON.stringify(scan.files) === JSON.stringify(EXPECTED_SCAN_FILES), JSON.stringify(scan.files))
      c.check('zero bypass violations (no direct durable-domain writes, no agent creation, no legacy vocabulary)', scan.totalViolations === 0, JSON.stringify(scan.violations).slice(0, 600))
      return recordScenario(c)
    }

    /** E1: same-template concurrent creates (N=3 workers, distinct tokens). */
    const runE1 = async ({ port }) => {
      const c = makeScenarioCtx('E1', undefined, 1)
      const st0 = (await getState(c, port)).body
      c.check('boot1 state: exactly the three seeded members (leader + worker + scout)', st0 !== null && Array.isArray(st0.members) && st0.members.length === 3, JSON.stringify(st0?.members ?? st0))
      const seedIds = [LEADER_INSTANCE_ID, SEED_WORKER_ID, SEED_SCOUT_ID]
      c.check('boot1 state: the seeded instance ids are present', Array.isArray(st0?.members) && seedIds.every((id) => st0.members.some((m) => m.instanceId === id)), JSON.stringify(st0?.members?.map((m) => m.instanceId)))

      const listMembers = await callTool(c, port, 'team_list_members', { rootSessionId: ROOT_SESSION_ID, requestToken: 'p6t6-e1-list-members' }, ROOT_SESSION_ID)
      c.check('team_list_members executed through the registered handler', listMembers.status === 200 && listMembers.body?.ok === true && listMembers.body?.value?.status === 'executed', JSON.stringify(listMembers.body).slice(0, 400))
      const listed = listMembers.body?.value?.effect
      c.check('list effect is members-listed with the three members', listed?.kind === 'members-listed' && Array.isArray(listed.members) && listed.members.length === 3, JSON.stringify(listed).slice(0, 400))

      const listTemplates = await callTool(c, port, 'team_list_templates', { rootSessionId: ROOT_SESSION_ID, requestToken: 'p6t6-e1-list-templates' }, ROOT_SESSION_ID)
      const templates = listTemplates.body?.value?.effect?.templates
      c.check('team_list_templates executed; worker (persistent) and scout (fresh_per_delegation) listed', listTemplates.body?.ok === true && listTemplates.body?.value?.status === 'executed' && Array.isArray(templates) && templates.some((t) => t.templateId === 'worker' && t.contextPolicy === 'persistent') && templates.some((t) => t.templateId === 'scout' && t.contextPolicy === 'fresh_per_delegation'), JSON.stringify(templates))

      const creations = await Promise.all(
        ['e1-1', 'e1-2', 'e1-3'].map((label, i) =>
          callTool(c, port, 'team_create_member', {
            rootSessionId: ROOT_SESSION_ID,
            requestToken: `p6t6-e1-${i + 1}`,
            delegationTemplateId: 'worker',
            label,
          }, ROOT_SESSION_ID),
        ),
      )
      const results = creations.map((r) => r.body?.value)
      c.check('all three concurrent creates admitted (executed)', results.every((r) => r?.status === 'executed'), JSON.stringify(results.map((r) => r?.status ?? r)))
      const activated = results.map((r) => r?.effect)
      c.check('every create returned a member-activated effect', activated.every((e) => e?.kind === 'member-activated'), JSON.stringify(activated).slice(0, 600))
      const newIds = activated.map((e) => e?.instanceId)
      c.check('three distinct new instance ids', newIds.length === 3 && newIds.every((id) => typeof id === 'string') && new Set(newIds).size === 3, JSON.stringify(newIds))
      c.check('none of the new ids collides with the seeded set', newIds.every((id) => !seedIds.includes(id)), JSON.stringify(newIds))
      c.check('every activation carries a child session id', activated.every((e) => typeof e?.childSessionId === 'string' && e.childSessionId.length > 0), JSON.stringify(activated.map((e) => e?.childSessionId)))
      c.check('every activation is on the worker template', activated.every((e) => e?.templateId === 'worker'), JSON.stringify(activated.map((e) => e?.templateId)))

      const st1 = (await getState(c, port)).body
      c.check('state after E1: six members total', st1?.members?.length === 6, JSON.stringify(st1?.members?.map((m) => m.instanceId)))
      const workerCount = Array.isArray(st1?.members) ? st1.members.filter((m) => m.templateId === 'worker').length : 0
      c.check('state after E1: four worker-template members (1 seed + 3 new)', workerCount === 4, `workerCount=${workerCount}`)
      c.check('state after E1: the three new instance ids are present', newIds.every((id) => st1?.members?.some((m) => m.instanceId === id)), JSON.stringify(newIds))

      S.e1.created = activated.map((e, i) => ({ token: `p6t6-e1-${i + 1}`, instanceId: e?.instanceId, label: `e1-${i + 1}`, childSessionId: e?.childSessionId }))
      const wMember = newIds[0] !== undefined ? st1?.members?.find((m) => m.instanceId === newIds[0]) : undefined
      S.e1.w = newIds[0] ?? null
      S.e1.wChild = wMember?.childSessionId ?? null
      c.evidence = {
        membersBefore: st0?.members?.map((m) => m.instanceId) ?? null,
        templates,
        created: S.e1.created,
        w: S.e1.w,
        wChild: S.e1.wChild,
        memberCountAfter: st1?.members?.length ?? null,
        workerCountAfter: workerCount,
      }
      return recordScenario(c)
    }

    /** E2: instance-addressed actions live-rejected on label/template tokens. */
    const runE2 = async ({ port }) => {
      const c = makeScenarioCtx('E2', undefined, 1)
      const attempts = [
        { tool: 'team_follow_up', target: 'existing-worker', kind: 'seed member LABEL', token: 'p6t6-e2-label' },
        { tool: 'team_follow_up', target: 'worker', kind: 'TEMPLATE id', token: 'p6t6-e2-template' },
        { tool: 'team_send_message', target: 'e1-1', kind: 'E1 member LABEL', token: 'p6t6-e2-label-msg' },
      ]
      const results = []
      for (const a of attempts) {
        const args = a.tool === 'team_send_message'
          ? { rootSessionId: ROOT_SESSION_ID, requestToken: a.token, recipientInstanceId: a.target, body: 'p6t6 e2 addressing probe' }
          : { rootSessionId: ROOT_SESSION_ID, requestToken: a.token, targetInstanceId: a.target, taskSummary: 'p6t6 e2 addressing probe' }
        const r = await callTool(c, port, a.tool, args, ROOT_SESSION_ID)
        results.push({ ...a, httpStatus: r.status, value: r.body?.value })
      }
      c.check('all three out-of-namespace targets live-rejected (rejected status)', results.every((r) => r.httpStatus === 200 && r.value?.status === 'rejected'), JSON.stringify(results.map((r) => ({ tool: r.tool, target: r.target, status: r.value?.status ?? r.value }))))
      c.check('every rejection carries TEAM_RUNTIME_ACTION_ADDRESSING_REJECTED', results.every((r) => r.value?.code === 'TEAM_RUNTIME_ACTION_ADDRESSING_REJECTED'), JSON.stringify(results.map((r) => r.value?.code)))
      c.check('no side effect: member count unchanged (6)', (await getState(c, port)).body?.members?.length === 6)
      c.evidence = { attempts: results }
      return recordScenario(c)
    }

    /** E3: persistent follow-up keeps the SAME bound child session. */
    const runE3 = async ({ port }) => {
      const c = makeScenarioCtx('E3', undefined, 1)
      const w = S.e1.w
      const wChild = S.e1.wChild
      c.check('E1 produced a persistent worker with a bound child session', typeof w === 'string' && typeof wChild === 'string', `w=${w} wChild=${wChild}`)
      const fu1 = await callTool(c, port, 'team_follow_up', { rootSessionId: ROOT_SESSION_ID, requestToken: 'p6t6-e3-1', targetInstanceId: w, taskSummary: 'p6t6 e3 first unit' }, ROOT_SESSION_ID)
      c.check('first follow-up executed on the existing instance', fu1.body?.ok === true && fu1.body?.value?.status === 'executed' && fu1.body?.value?.effect?.kind === 'work-admitted' && fu1.body?.value?.effect?.instanceId === w, JSON.stringify(fu1.body?.value).slice(0, 500))
      const seq1 = fu1.body?.value?.effect?.sequence
      const fu2 = await callTool(c, port, 'team_follow_up', { rootSessionId: ROOT_SESSION_ID, requestToken: 'p6t6-e3-2', targetInstanceId: w, taskSummary: 'p6t6 e3 second unit' }, ROOT_SESSION_ID)
      c.check('second follow-up executed on the SAME instance', fu2.body?.ok === true && fu2.body?.value?.status === 'executed' && fu2.body?.value?.effect?.kind === 'work-admitted' && fu2.body?.value?.effect?.instanceId === w, JSON.stringify(fu2.body?.value).slice(0, 500))
      const seq2 = fu2.body?.value?.effect?.sequence
      // The work-admitted sequence is the root admission-ledger sequence:
      // E1's three activations already consumed 1-3, so E3's units continue
      // the counter (4, 5). The criterion is monotonic advance, not the base.
      c.check('the admission sequences advance by one (monotonic per admission)', Number.isInteger(seq1) && Number.isInteger(seq2) && seq1 >= 1 && seq2 === seq1 + 1, `seq1=${seq1} seq2=${seq2}`)
      const st1 = (await getState(c, port)).body
      const wAfter = st1?.members?.find((m) => m.instanceId === w)
      c.check('the bound child session id is UNCHANGED across follow-ups', wAfter?.childSessionId === wChild, `before=${wChild} after=${wAfter?.childSessionId}`)
      c.check('no new instance was created (six members)', st1?.members?.length === 6, JSON.stringify(st1?.members?.length))
      c.evidence = { w, wChild, sequences: [seq1, seq2] }
      return recordScenario(c)
    }

    /** E4: fresh_per_delegation delegation always mints a NEW instance. */
    const runE4 = async ({ port }) => {
      const c = makeScenarioCtx('E4', undefined, 1)
      const created = []
      for (let i = 1; i <= 2; i += 1) {
        const r = await callTool(c, port, 'team_delegate', {
          rootSessionId: ROOT_SESSION_ID,
          requestToken: `p6t6-e4-${i}`,
          label: `e4-${i}`,
          delegationTemplateId: 'scout',
          taskSummary: `p6t6 e4 delegation ${i}`,
        }, ROOT_SESSION_ID)
        created.push({ token: `p6t6-e4-${i}`, value: r.body?.value })
      }
      c.check('both fresh_per_delegation delegates executed', created.every((e) => e.value?.status === 'executed'), JSON.stringify(created.map((e) => e.value?.status)))
      const effects = created.map((e) => e.value?.effect)
      c.check('both delegates returned member-activated effects', effects.every((e) => e?.kind === 'member-activated'), JSON.stringify(effects).slice(0, 600))
      const ids = effects.map((e) => e?.instanceId)
      c.check('two distinct NEW instance ids (not the seed, not each other)', ids.length === 2 && new Set(ids).size === 2 && !ids.includes(SEED_SCOUT_ID) && ids.every((id) => typeof id === 'string'), JSON.stringify(ids))
      c.check('each activation carries a distinct new child session', new Set(effects.map((e) => e?.childSessionId)).size === 2 && effects.every((e) => typeof e?.childSessionId === 'string' && e.childSessionId.length > 0), JSON.stringify(effects.map((e) => e?.childSessionId)))
      const st1 = (await getState(c, port)).body
      const scoutCount = Array.isArray(st1?.members) ? st1.members.filter((m) => m.templateId === 'scout').length : 0
      c.check('state after E4: three scout-template members (1 seed + 2 new)', scoutCount === 3, `scoutCount=${scoutCount}`)
      S.e4.created = effects.map((e, i) => ({ token: `p6t6-e4-${i + 1}`, instanceId: e?.instanceId, childSessionId: e?.childSessionId }))
      c.evidence = { created: S.e4.created, scoutCountAfter: scoutCount }
      return recordScenario(c)
    }

    /** E6: template quota race — ==limit admitted, >limit rejected, never over. */
    const runE6 = async ({ port }) => {
      const c = makeScenarioCtx('E6', undefined, 1)
      const st0 = (await getState(c, port)).body
      const beforeCount = Array.isArray(st0?.members) ? st0.members.filter((m) => m.templateId === 'scout').length : 0
      c.check('pre-race state: three scout members (limit 4)', beforeCount === 3, `scoutCount=${beforeCount}`)
      const results = await Promise.all(
        ['e6-1', 'e6-2', 'e6-3'].map((label, i) =>
          callTool(c, port, 'team_create_member', {
            rootSessionId: ROOT_SESSION_ID,
            requestToken: `p6t6-e6-${i + 1}`,
            delegationTemplateId: 'scout',
            label,
          }, ROOT_SESSION_ID),
        ),
      )
      const values = results.map((r) => r.body?.value)
      const admitted = values.filter((v) => v?.status === 'executed')
      const rejected = values.filter((v) => v?.status === 'rejected')
      c.check('exactly ONE of the three concurrent creates admitted at ==limit', admitted.length === 1 && rejected.length === 2, JSON.stringify(values.map((v) => v?.status)))
      c.check('the admitted create is member-activated', admitted.every((v) => v?.effect?.kind === 'member-activated'), JSON.stringify(admitted.map((v) => v?.effect?.kind)))
      c.check('both over-limit creates rejected with TEAM_RUNTIME_QUOTA_EXCEEDED_TEMPLATE_INSTANCES', rejected.every((v) => v?.code === 'TEAM_RUNTIME_QUOTA_EXCEEDED_TEMPLATE_INSTANCES'), JSON.stringify(rejected.map((v) => v?.code)))
      const st1 = (await getState(c, port)).body
      const afterCount = Array.isArray(st1?.members) ? st1.members.filter((m) => m.templateId === 'scout').length : 0
      c.check('state after E6: four scout members (== limit; never over-created)', afterCount === 4, `scoutCount=${afterCount}`)
      c.check('state after E6: nine members total (leader + 4 workers + 4 scouts; team limit 12 untouched)', st1?.members?.length === 9, `total=${st1?.members?.length}`)
      c.evidence = {
        scoutCountBefore: beforeCount,
        outcomes: values.map((v, i) => ({ token: `p6t6-e6-${i + 1}`, status: v?.status, code: v?.code, instanceId: v?.effect?.instanceId })),
        scoutCountAfter: afterCount,
        memberCountAfter: st1?.members?.length,
      }
      S.memberIdsBoot1Final = st1?.members?.map((m) => m.instanceId).sort() ?? null
      return recordScenario(c)
    }

    /**
     * E5 boot-1 write phase: the team message to the leader (real Session
     * input API), two progress reports (per-subject sequence 1 then 2), and
     * one PENDING control request — all through registered tools. The
     * process kill happens as driveBoot's ordinary stop after this phase.
     */
    const runE5a = async ({ port }) => {
      const c = makeScenarioCtx('E5', 'boot1-writes', 1)
      const w = S.e1.w
      const wChild = S.e1.wChild
      c.check('E1 produced the persistent worker (message/progress caller)', typeof w === 'string' && typeof wChild === 'string', `w=${w} wChild=${wChild}`)

      const msg = await callTool(c, port, 'team_send_message', {
        rootSessionId: ROOT_SESSION_ID,
        requestToken: 'p6t6-e5-msg1',
        recipientInstanceId: LEADER_INSTANCE_ID,
        body: 'p6t6 e5 hello from worker one',
        subject: 'e5',
      }, wChild)
      const msgValue = msg.body?.value
      c.check('team message from the member to the leader delivered', msg.status === 200 && msg.body?.ok === true && msgValue?.status === 'delivered', JSON.stringify(msg.body).slice(0, 500))
      c.check('delivery targeted the leader instance', msgValue?.recipientInstanceId === LEADER_INSTANCE_ID && msgValue?.deliveredToInstanceId === LEADER_INSTANCE_ID, JSON.stringify({ r: msgValue?.recipientInstanceId, d: msgValue?.deliveredToInstanceId }))
      c.check('delivery landed on the leader bound session (the root)', msgValue?.deliveredToSessionId === ROOT_SESSION_ID, JSON.stringify(msgValue?.deliveredToSessionId))
      c.check('delivery carries durable fact + delivered sequences', typeof msgValue?.factSequence === 'number' && typeof msgValue?.deliveredSequence === 'number', JSON.stringify({ f: msgValue?.factSequence, d: msgValue?.deliveredSequence }))
      S.e5.message = { factSequence: msgValue?.factSequence, deliveredSequence: msgValue?.deliveredSequence, body: 'p6t6 e5 hello from worker one' }

      const p1 = await callTool(c, port, 'team_report_progress', {
        rootSessionId: ROOT_SESSION_ID,
        requestToken: 'p6t6-e5-p1',
        instanceId: w,
        subject: 'e5',
        progress: 'in-progress',
        summary: 'p6t6 e5 in flight',
      }, wChild)
      const p1Value = p1.body?.value
      c.check('first progress report recorded on sequence 1', p1Value?.status === 'progress-recorded' && p1Value?.row?.sequence === 1, JSON.stringify(p1Value).slice(0, 500))
      const p2 = await callTool(c, port, 'team_report_progress', {
        rootSessionId: ROOT_SESSION_ID,
        requestToken: 'p6t6-e5-p2',
        instanceId: w,
        subject: 'e5',
        progress: 'completed',
        summary: 'p6t6 e5 done',
      }, wChild)
      const p2Value = p2.body?.value
      c.check('second progress report recorded on sequence 2', p2Value?.status === 'progress-recorded' && p2Value?.row?.sequence === 2, JSON.stringify(p2Value).slice(0, 500))
      S.e5.progressSequences = [p1Value?.row?.sequence, p2Value?.row?.sequence]

      const ctrl = await callTool(c, port, 'team_request_control', {
        rootSessionId: ROOT_SESSION_ID,
        requestToken: E5_CTRL_TOKEN,
        kind: 'leader-approval',
        targetInstanceId: w,
        actionName: 'follow-up',
        toolName: 'team_follow_up',
        summary: 'p6t6 e5 gated follow-up',
      }, ROOT_SESSION_ID)
      const ctrlValue = ctrl.body?.value
      c.check('control request accepted (control-requested, pending)', ctrlValue?.status === 'control-requested' && ctrlValue?.request?.status === 'pending', JSON.stringify(ctrlValue).slice(0, 500))
      c.check('control request scope carries the E5 correlation token + tool name', ctrlValue?.request?.correlation === E5_CTRL_TOKEN && ctrlValue?.request?.toolName === 'team_follow_up', JSON.stringify({ c: ctrlValue?.request?.correlation, t: ctrlValue?.request?.toolName }))
      S.e5.requestId = ctrlValue?.request?.requestId ?? null

      const st1 = (await getState(c, port)).body
      const req = Array.isArray(st1?.control?.requests) ? st1.control.requests.find((r) => r.correlation === E5_CTRL_TOKEN) : undefined
      c.check('state after E5a: the control request is durably pending', req?.status === 'pending' && req?.requestId === S.e5.requestId, JSON.stringify(req))
      const wRows = Array.isArray(st1?.activity) ? st1.activity.filter((a) => a.instanceId === w && a.subject === 'e5') : []
      c.check('state after E5a: both progress rows for (w, e5) are durable', wRows.some((a) => a.sequence === 1) && wRows.some((a) => a.sequence === 2), JSON.stringify(wRows.map((a) => a.sequence)))
      c.evidence = {
        w,
        wChild,
        message: S.e5.message,
        progressSequences: S.e5.progressSequences,
        controlRequest: { requestId: S.e5.requestId, correlation: E5_CTRL_TOKEN, status: req?.status },
      }
      return recordScenario(c)
    }

    /**
     * E5 boot-2 restart phase: durable read-back after the kill, leader
     * resolution of the pending request, the guarded follow-up consuming the
     * persisted allow exactly once (retry blocked allow-consumed, fresh
     * token proceeds), and the per-subject progress sequence continuing (3).
     */
    const runE5b = async ({ port }) => {
      const c = makeScenarioCtx('E5', 'boot2-restart', 2)
      const st0 = (await getState(c, port)).body
      c.check('state after restart: nine members total', st0?.members?.length === 9, JSON.stringify(st0?.members?.map((m) => m.instanceId)))
      const idsAfter = Array.isArray(st0?.members) ? st0.members.map((m) => m.instanceId).sort() : null
      c.check('state after restart: the member id set is UNCHANGED from boot 1', S.memberIdsBoot1Final !== null && JSON.stringify(idsAfter) === JSON.stringify(S.memberIdsBoot1Final), `boot1=${JSON.stringify(S.memberIdsBoot1Final)} boot2=${JSON.stringify(idsAfter)}`)
      const w = S.e1.w
      const req = Array.isArray(st0?.control?.requests) ? st0.control.requests.find((r) => r.correlation === E5_CTRL_TOKEN) : undefined
      c.check('the boot-1 control request SURVIVED the restart as pending', req?.status === 'pending' && req?.requestId === S.e5.requestId, JSON.stringify(req))
      const wRows = Array.isArray(st0?.activity) ? st0.activity.filter((a) => a.instanceId === w && a.subject === 'e5') : []
      c.check('the boot-1 progress rows (sequences 1 and 2) SURVIVED the restart', wRows.some((a) => a.sequence === 1) && wRows.some((a) => a.sequence === 2), JSON.stringify(wRows.map((a) => a.sequence)))
      c.check('no pending delivery was skipped at recovery (the boot-1 delivery is accounted)', st0?.pendingDeliveries?.skipped?.length === 0, JSON.stringify(st0?.pendingDeliveries))

      const listMembers = await callTool(c, port, 'team_list_members', { rootSessionId: ROOT_SESSION_ID, requestToken: 'p6t6-e5b-list' }, ROOT_SESSION_ID)
      c.check('team_list_members after restart reports nine members through the tool', listMembers.body?.value?.effect?.kind === 'members-listed' && listMembers.body?.value?.effect?.members?.length === 9, JSON.stringify(listMembers.body?.value?.effect?.members?.length))

      const resolve = await callTool(c, port, 'team_resolve_control', {
        rootSessionId: ROOT_SESSION_ID,
        requestToken: 'p6t6-e5-res1',
        requestId: S.e5.requestId,
        decision: 'allow',
        note: 'p6t6 e5 leader allows the follow-up',
      }, ROOT_SESSION_ID)
      const resolveValue = resolve.body?.value
      c.check('leader resolved the request as allow (control-resolved)', resolveValue?.status === 'control-resolved' && resolveValue?.decision?.requestId === S.e5.requestId, JSON.stringify(resolveValue).slice(0, 500))

      const fu1 = await callTool(c, port, 'team_follow_up', { rootSessionId: ROOT_SESSION_ID, requestToken: E5_CTRL_TOKEN, targetInstanceId: w, taskSummary: 'p6t6 e5 gated follow-up (boot 2)' }, ROOT_SESSION_ID)
      const fu1Value = fu1.body?.value
      c.check('the guarded follow-up (same correlation token) EXECUTED — the persisted allow was consumed', fu1Value?.status === 'executed' && fu1Value?.effect?.kind === 'work-admitted' && fu1Value?.effect?.instanceId === w, JSON.stringify(fu1Value).slice(0, 500))
      const fu2 = await callTool(c, port, 'team_follow_up', { rootSessionId: ROOT_SESSION_ID, requestToken: E5_CTRL_TOKEN, targetInstanceId: w, taskSummary: 'p6t6 e5 retry of the consumed token' }, ROOT_SESSION_ID)
      const fu2Value = fu2.body?.value
      c.check('retrying the SAME token is BLOCKED (allow-consumed, exactly-once)', fu2Value?.status === 'blocked' && fu2Value?.reason === 'allow-consumed' && fu2Value?.requestId === S.e5.requestId, JSON.stringify(fu2Value).slice(0, 500))
      const fu3 = await callTool(c, port, 'team_follow_up', { rootSessionId: ROOT_SESSION_ID, requestToken: 'p6t6-e5-ctrl3', targetInstanceId: w, taskSummary: 'p6t6 e5 fresh token after consumption' }, ROOT_SESSION_ID)
      c.check('a fresh token with no request row proceeds (no-request deviation)', fu3.body?.value?.status === 'executed', JSON.stringify(fu3.body?.value).slice(0, 500))

      const msg2 = await callTool(c, port, 'team_send_message', {
        rootSessionId: ROOT_SESSION_ID,
        requestToken: 'p6t6-e5-msg2',
        recipientInstanceId: LEADER_INSTANCE_ID,
        body: 'p6t6 e5 post-restart message',
        subject: 'e5',
      }, S.e1.wChild)
      const msg2Value = msg2.body?.value
      c.check('post-restart team message delivered (new durable sequences)', msg2Value?.status === 'delivered' && typeof msg2Value?.deliveredSequence === 'number' && (S.e5.message === null || msg2Value.deliveredSequence > S.e5.message.deliveredSequence), JSON.stringify(msg2Value).slice(0, 500))
      S.e5.postMessage = { deliveredSequence: msg2Value?.deliveredSequence, factSequence: msg2Value?.factSequence }

      const p3 = await callTool(c, port, 'team_report_progress', {
        rootSessionId: ROOT_SESSION_ID,
        requestToken: 'p6t6-e5-p3',
        instanceId: w,
        subject: 'e5',
        progress: 'in-progress',
        summary: 'p6t6 e5 resumed after restart',
      }, S.e1.wChild)
      const p3Value = p3.body?.value
      c.check('post-restart progress report continues the per-subject sequence (3)', p3Value?.status === 'progress-recorded' && p3Value?.row?.sequence === 3, JSON.stringify(p3Value).slice(0, 500))
      S.e5.postProgress = p3Value?.row?.sequence

      const st1 = (await getState(c, port)).body
      const reqAfter = Array.isArray(st1?.control?.requests) ? st1.control.requests.find((r) => r.correlation === E5_CTRL_TOKEN) : undefined
      c.check('after consumption the request row is decided', reqAfter?.status === 'decided', JSON.stringify(reqAfter))
      c.evidence = {
        membersCountAfter: st0?.members?.length ?? null,
        memberIdsSameAsBoot1: S.memberIdsBoot1Final !== null && JSON.stringify(idsAfter) === JSON.stringify(S.memberIdsBoot1Final),
        controlRequest: { requestId: S.e5.requestId, statusBefore: req?.status, statusAfter: reqAfter?.status },
        activitySequences: wRows.map((a) => a.sequence),
        pendingDeliveries: st0?.pendingDeliveries ?? null,
        guard: { executedToken: E5_CTRL_TOKEN, blockedRetry: fu2Value?.status, blockedReason: fu2Value?.reason, freshTokenExecuted: fu3.body?.value?.status },
        postMessage: S.e5.postMessage,
        postProgressSequence: S.e5.postProgress,
      }
      return recordScenario(c)
    }

    // ── the boot driver ──────────────────────────────────────────────────────

    const ROW = { id: 'p6t6-team-tools', name: pathToFileURL(join(HERE, 'plugin.mjs')).href }

    /**
     * One boot: mount the row through the public patch seam, start, verify
     * the row mount via dump-config, poll row health, drive the scenario
     * plan, stop (the E5 kill is boot 1's ordinary stop).
     * @param {number} boot
     * @param {number} port
     * @param {object} opts
     * @returns {Promise<object>} the boot record.
     */
    const driveBoot = async (boot, port, opts) => {
      const instLogDir = join(logsDir, `boot${boot}`)
      mkdirSync(instLogDir, { recursive: true })
      const instance = new DshInstance({
        hostTree: HOST_TREE,
        dshHome: DSH_HOME,
        port,
        clientCommitHash: CLIENT_COMMIT_HASH,
        logDir: instLogDir,
      })
      const record = {
        port,
        rows: [ROW.id],
        patchFile: instance.patchFile,
        profile: null,
        url: null,
        logPath: null,
        bootMarkerLine: null,
        healthBefore: null,
        healthAfter: null,
        rowMounted: null,
        stop: null,
        scenarios: {},
      }
      try {
        const profile = await ensureProfile({ instance, log, timeoutMs: 90_000 })
        record.profile = profile
        instance.mountRows([ROW], [
          `P6-T6 harness patch layer (boot ${boot}): ${ROW.id} mounted ONLY through this public profile-patch seam.`,
        ])
        writeFileSync(join(DSH_HOME, 'p6t6-directive.json'), JSON.stringify(opts.directive, null, 2))
        log(`boot ${boot}: directive written to ${join(DSH_HOME, 'p6t6-directive.json')}`)
        const started = await instance.start({ timeoutMs: 180_000 })
        record.url = started.url
        record.logPath = started.logPath
        record.bootMarkerLine = await waitForLogLine(started.logPath, BOOT_MARKER, 30_000, () => true)
        if (record.bootMarkerLine === null) noteFailure(`boot ${boot}: boot marker line not found in log`)

        const dump = await instance.dumpConfig({ timeoutMs: 60_000 })
        writeFileSync(join(reportDir, `dump-config-boot${boot}.txt`), dump.text)
        record.rowMounted = { [ROW.id]: DshInstance.rowInDump(dump.text, ROW) }
        const mounted = record.rowMounted[ROW.id]
        summary.rowMounted[`${ROW.id}-boot${boot}`] = mounted
        if (!mounted) noteFailure(`boot ${boot}: row ${ROW.id} not present in dump-config — the public patch seam did not mount the plugin`)

        // Row setup (dynamic TS imports + TeamDomain open + session
        // create/resume) completes AFTER the boot marker; the health route
        // is registered as the final step. Poll it until the row is ready.
        const healthPath = '/__p6t6/health'
        const readyDeadline = Date.now() + 180_000
        for (;;) {
          const probe = await fetchJson(`http://127.0.0.1:${port}${healthPath}`, {}, 10_000)
          if (probe.status === 200 && probe.body !== null && typeof probe.body === 'object' && 'ok' in probe.body) {
            record.healthBefore = probe.body
            if (probe.body.ok !== true) {
              noteFailure(`boot ${boot}: row reported setup failure: ${JSON.stringify(probe.body)}`)
            }
            break
          }
          if (Date.now() >= readyDeadline) {
            noteFailure(`boot ${boot}: row routes not ready within 180s (last probe http=${probe.status} body=${JSON.stringify(probe.body)})`)
            record.healthBefore = probe.body
            break
          }
          await new Promise((r) => setTimeout(r, 500))
        }
        {
          const hb = record.healthBefore
          if (hb?.ok === true) {
            log(`boot ${boot}: ready — toolCount=${hb.toolCount} liveSessions=${(hb.liveSessions ?? []).length} (expected ${EXPECTED_TOOL_COUNT} tools)`)
            if (hb.toolCount !== EXPECTED_TOOL_COUNT) {
              noteFailure(`boot ${boot}: expected ${EXPECTED_TOOL_COUNT} registered tools, health reports ${hb.toolCount}`)
            }
          }
        }

        const rowReady = record.healthBefore?.ok === true
        for (const plan of opts.plan) {
          const entry = plan.runnable && rowReady
            ? await plan.run({ port })
            : skipEntry(plan.criterion, plan.phase, boot, rowReady
              ? plan.skipReason
              : `row routes not ready on boot ${boot} — scenario not executed against a dead row`)
          record.scenarios[`${plan.criterion}${plan.phase !== undefined ? `-${plan.phase}` : ''}`] = entry
        }

        record.healthAfter = (await fetchJson(`http://127.0.0.1:${port}${healthPath}`, {}, 10_000)).body
      } finally {
        const stop = await instance.stop({ timeoutMs: 45_000 })
        record.stop = stop
        log(`boot ${boot}: stopped killed=${stop.killed} portFree=${stop.portFree}`)
        if (!stop.portFree) {
          const freed = await waitForPortFree(port, 30_000)
          record.portReleasedAfterWait = freed
          if (!freed) noteFailure(`boot ${boot}: port ${port} still in use after stop+wait`)
        }
      }
      return record
    }

    // ── the boot plan ────────────────────────────────────────────────────────
    // E7 first (static; no instance involved), then boot 1 (E1..E6 + the E5
    // write phase, then the kill), then boot 2 (the E5 restart phase).
    if (runnable('E7')) {
      await runE7()
    } else if (selected('E7')) {
      skipEntry('E7', undefined, undefined, 'dependency not selected')
    }

    const directiveFor = (boot) => ({
      boot,
      reportDir,
      runStamp,
      rootSessionId: ROOT_SESSION_ID,
      mcpPort: mini.port,
    })

    const boot1Plan = [
      { criterion: 'E1', phase: undefined, runnable: runnable('E1'), skipReason: 'dependency not selected', run: (o) => runE1(o) },
      { criterion: 'E2', phase: undefined, runnable: runnable('E2'), skipReason: 'requires E1 (its labels) — E1 not selected', run: (o) => runE2(o) },
      { criterion: 'E3', phase: undefined, runnable: runnable('E3'), skipReason: 'requires E1 (its worker) — E1 not selected', run: (o) => runE3(o) },
      { criterion: 'E4', phase: undefined, runnable: runnable('E4'), skipReason: 'dependency not selected', run: (o) => runE4(o) },
      { criterion: 'E6', phase: undefined, runnable: runnable('E6'), skipReason: 'requires E4 (scout count 3) — E4 not selected', run: (o) => runE6(o) },
      { criterion: 'E5', phase: 'boot1-writes', runnable: runnable('E5'), skipReason: 'requires E1 (its worker) — E1 not selected', run: (o) => runE5a(o) },
    ]
    summary.boots.boot1 = await driveBoot(1, portA, {
      directive: directiveFor(1),
      plan: boot1Plan,
    })
    if (runnable('E5') && (summary.scenarios.E5?.phases?.['boot1-writes'] === undefined)) {
      noteFailure('E5 boot-1 write phase did not record an entry')
    }

    const boot2Plan = [
      { criterion: 'E5', phase: 'boot2-restart', runnable: runnable('E5'), skipReason: 'requires E1 (its worker) — E1 not selected', run: (o) => runE5b(o) },
    ]
    summary.boots.boot2 = await driveBoot(2, portB, {
      directive: directiveFor(2),
      plan: boot2Plan,
    })

    // ── post-flight: mini MCP, ports, pristine, stable instance ─────────────
    if (mini !== null) {
      closeMiniServer(mini)
      summary.ports.released.mcp = !(await portInUse(mini.port))
      log(`postflight: mini MCP server closed; port ${mini.port} released=${summary.ports.released.mcp}`)
    }
    for (const [name, rec] of Object.entries(summary.boots)) {
      const released = rec?.stop?.portFree === true || rec?.portReleasedAfterWait === true
      summary.ports.released[name] = released
    }
    summary.pristine.after = await captureGitState(HOST_TREE, logsDir)
    summary.stable3080.after = await probeStableInstance()
    log(`postflight: stable :3080 ${JSON.stringify(summary.stable3080.after)}`)
    log(`postflight: test-use pristine after=${summary.pristine.after.statusEmpty && summary.pristine.after.diffEmpty}`)
    removeFarm()

    // ── verdict ──────────────────────────────────────────────────────────────
    if (!(summary.pristine.after.statusEmpty && summary.pristine.after.diffEmpty)) {
      noteFailure('test-use tree not pristine after run')
    }
    if (!(summary.stable3080.after.reachable === true && summary.stable3080.after.status === 200)) {
      noteFailure(`stable :3080 instance not reachable/200 after run: ${JSON.stringify(summary.stable3080.after)}`)
    }
    for (const sc of args.selected) {
      const e = summary.scenarios[sc]
      if (e === undefined || e.pass !== true) noteFailure(`scenario ${sc} missing or failing`)
    }
    for (const boot of ['boot1', 'boot2']) {
      if (summary.rowMounted[`${ROW.id}-${boot}`] !== true) noteFailure(`${ROW.id} not mounted via the public patch seam on ${boot}`)
    }
    if (summary.ports.released.boot1 === false) noteFailure('boot1 port not released')
    if (summary.ports.released.boot2 === false) noteFailure('boot2 port not released')
    if (summary.ports.released.mcp === false) noteFailure('mini MCP port not released')
    for (const hb of Object.values(summary.boots)) {
      if (hb?.healthBefore?.ok === true && hb.healthBefore.toolCount !== EXPECTED_TOOL_COUNT) {
        noteFailure(`${hb.port}: health reports ${hb.healthBefore.toolCount} tools (expected ${EXPECTED_TOOL_COUNT})`)
      }
    }

    finish(summary.failures.length === 0)
  } catch (error) {
    noteFailure(`harness fatal: ${error instanceof Error ? error.stack ?? error.message : String(error)}`)
    if (mini !== null) {
      try {
        closeMiniServer(mini)
      } catch {
        /* best effort */
      }
    }
    removeFarm()
    try {
      summary.pristine.after ??= await captureGitState(HOST_TREE, logsDir)
      summary.stable3080.after ??= await probeStableInstance()
    } catch {
      /* best effort */
    }
    finish(false)
  }
}

main().catch((error) => {
  console.error(`P6-T6 harness fatal: ${error?.stack ?? error}`)
  process.exit(1)
})
