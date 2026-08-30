#!/usr/bin/env node
/**
 * P5-T5 real-instance harness — drives a REAL DSH test instance through the
 * four root-binding scenarios (S1 fresh root, S2 cold root after process
 * restart, S3 admission fail-closed, S4 ordinary root) using PUBLIC
 * surfaces only (profile-patch row mount, dump-config, webServer-scoped
 * surface routes, DSH_HOME durable files). No real LLM calls are made: the
 * directive carries a static model reference, and no model provider is ever
 * contacted.
 *
 * Usage:
 *   node packages/runtime/root-binding/harness/run.mjs \
 *     --report-dir dev/agent-workflow/evidence/P5-T5/harness-output \
 *     [--scenarios S1,S3,S4,S2] [--port 3180]
 *
 * Layout (resolved by walking up from this file):
 *   REPO_ROOT  — the ancestor containing references/deepseek-harness-test-use
 *   HOST_TREE  — REPO_ROOT/references/deepseek-harness-test-use (pristine
 *                upstream test-use tree; git-clean asserted before AND after)
 *   DSH_HOME   — REPO_ROOT/references/.dsh-test-p5t5 (FRESH per run: removed
 *                and recreated; gitignored; workspace-internal)
 *
 * Boot 1 (port, default 3180): S1 -> S3 -> S4 (S3/S4 run after S1 so the
 * TeamDomain unit exists and the S1 session is the durable anchor).
 * Boot 2 (port+1, default 3181): SAME DSH_HOME (process restart), runs S2
 * (cold root: agents.resume of the S1 root, rehydrate, zero durable writes).
 *
 * Pristine self-checks recorded in summary.json:
 *   - test-use tree `git status` clean before (and after, incl. after any
 *     build chain) and after the run;
 *   - :3080 stable-instance reachability recorded before and after
 *     (GET only, 3s timeout — the stable instance is never touched);
 *   - ports released after every instance stop;
 *   - dump-config proves the row was mounted through the public patch seam.
 *
 * P5-T6 reuse: pass a `--scenarios` subset (e.g. `--scenarios S2`) to rerun
 * a crash/restart/corrupt variant against the same harness; the directive
 * contract and the report schema are stable (see README.md).
 */
import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  appendFileSync,
  writeFileSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  DshInstance,
  ensureProfile,
  ensureProbeResolution,
} from '../../../../tests/characterization/lib/instance.mjs'
import {
  portInUse,
  spawnToLog,
  waitForLogLine,
  waitForPortFree,
} from '../../../../tests/characterization/lib/util.mjs'
import { captureGitState } from '../../../../tests/characterization/lib/tree-clean.mjs'
import { closeMiniServer, startMiniMcpServer } from './mini-mcp.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const WORKTREE_ROOT = resolve(HERE, '..', '..', '..', '..')
const CLIENT_COMMIT_HASH = 'cd5ef814'
const STABLE_URL = 'http://127.0.0.1:3080/'
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=[A-Za-z0-9_-]+/

const LEADER_PERSONA = 'You are the P5-T5 team leader, guiding workers with clear directives and steady judgement.'
const MEMBER_PERSONA = 'You are the p5t5worker member, executing your assigned step and reporting facts.'

/** Tail of an in-memory log string (up to `lines` last lines). */
function tailText(text, lines = 12) {
  if (text === undefined || text === null) return '<no output>'
  return String(text).split('\n').slice(-lines).join('\n')
}

// ── argument parsing ────────────────────────────────────────────────────────

function parseArgs(argv) {
  const args = { reportDir: null, scenarios: 'S1,S3,S4,S2', port: 3180 }
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
  const selected = args.scenarios.split(',').map((s) => s.trim()).filter((s) => s.length > 0)
  for (const s of selected) {
    if (!['S1', 'S2', 'S3', 'S4'].includes(s)) throw new Error(`unknown scenario: ${s}`)
  }
  args.selected = selected
  return args
}

// ── path discovery ──────────────────────────────────────────────────────────

function findRepoRoot(start) {
  let dir = start
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(join(dir, 'references', 'deepseek-harness-test-use'))) return dir
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
  return null
}

function findZodDir(hostTree) {
  const pnpmDir = join(hostTree, 'node_modules', '.pnpm')
  if (existsSync(pnpmDir)) {
    const candidates = readdirSync(pnpmDir)
      .filter((n) => /^zod@\d/.test(n))
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
  const DSH_HOME = join(REPO_ROOT, 'references', '.dsh-test-p5t5')
  const boot1Port = args.port
  const boot2Port = args.port + 1

  log(`P5-T5 harness start: worktree=${WORKTREE_ROOT}`)
  log(`repo root=${REPO_ROOT} hostTree=${HOST_TREE} dshHome=${DSH_HOME}`)
  log(`selected scenarios=${args.selected.join(',')} ports boot1=${boot1Port} boot2=${boot2Port}`)

  const summary = {
    task: 'P5-T5',
    runStamp: `p5t5-${Date.now()}`,
    harness: fileURLToPath(import.meta.url),
    worktree: WORKTREE_ROOT,
    repoRoot: REPO_ROOT,
    hostTree: HOST_TREE,
    dshHome: DSH_HOME,
    selectedScenarios: args.selected,
    ports: { boot1: boot1Port, boot2: boot2Port, mcp: null },
    stable3080: { before: null, after: null },
    pristine: { before: null, afterBuild: null, after: null },
    build: null,
    rowMounted: { boot1: null, boot2: null },
    boots: {},
    scenarios: {},
    pass: false,
    failures: [],
  }

  const finish = (pass, extra) => {
    summary.pass = pass
    Object.assign(summary, extra ?? {})
    writeFileSync(join(reportDir, 'summary.json'), JSON.stringify(summary, null, 2))
    log(`P5-T5 harness ${pass ? 'PASS' : 'FAIL'} — summary: ${join(reportDir, 'summary.json')}`)
    process.exit(pass ? 0 : 1)
  }
  const noteFailure = (why) => {
    summary.failures.push(why)
    log(`FAILURE: ${why}`)
  }

  try {
    // ── pre-flight: pristine tree, stable instance, ports ───────────────────
    summary.pristine.before = await captureGitState(HOST_TREE, logsDir)
    const beforeClean = summary.pristine.before.statusEmpty && summary.pristine.before.diffEmpty
    if (!beforeClean) throw new Error(`test-use tree not pristine before run: ${JSON.stringify(summary.pristine.before.errors)}`)
    log(`preflight: test-use tree pristine (head ${summary.pristine.before.head})`)

    summary.stable3080.before = await probeStableInstance()
    log(`preflight: stable :3080 ${JSON.stringify(summary.stable3080.before)}`)

    if ((await portInUse(boot1Port)) || (await portInUse(boot2Port))) {
      throw new Error(`ports ${boot1Port}/${boot2Port} are already in use — aborting`)
    }

    // ── fresh DSH_HOME per run ───────────────────────────────────────────────
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
        // host-side functionality (the web shell page 404s, the host API and
        // plugin rows work). Tolerate the failure ONLY when the complete
        // build:lib artifact set the harness needs is present.
        const missingAfterBuild = farm.filter((p) => !existsSync(join(p.dir, 'lib', 'index.js')))
        if (missingAfterBuild.length > 0) {
          throw new Error(`node scripts/build.ts failed and build:lib artifacts are missing: ${missingAfterBuild.map((p) => p.name).join(', ')} — ${tailText(build.text)}`)
        }
        log(`build:web failed in-sandbox (vite→esbuild spawn EPERM, documented in TEST_METHODS §3); build:lib artifacts complete — continuing`)
        webSandboxLimited = true
      }
      summary.build = {
        required: true,
        missingBefore: missing.map((p) => p.name),
        installLog: 'logs/build-install.log',
        buildLog: 'logs/build-main.log',
        webBuildSandboxLimited: webSandboxLimited,
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

    // ── junction farm for bare specifiers (harness-local node_modules) ──────
    const zodDir = findZodDir(HOST_TREE)
    if (zodDir === null) throw new Error('zod not found in test-use node_modules')
    ensureProbeResolution({
      probesDir: HERE,
      packages: [...farm, { name: 'zod', dir: zodDir }],
      log,
    })
    log('junction farm ready')

    // ── user preset fixture (DSH_HOME-local persona preset) ─────────────────
    const presetId = 'p5t5-team-persona'
    const presetDir = join(DSH_HOME, '.agent-presets', presetId)
    mkdirSync(presetDir, { recursive: true })
    writeFileSync(join(presetDir, 'agent.cordis.yml'), [
      '# P5-T5 harness fixture: team leader persona preset (user preset, DSH_HOME-local).',
      '- id: persona',
      "  name: '@deepseek-ai/dsh-persona'",
      '  config:',
      `    text: ${LEADER_PERSONA}`,
      '',
    ].join('\n'))
    log(`user preset written: ${presetId}`)

    // ── mini MCP server (127.0.0.1, ports 3481-3485 candidates) ─────────────
    const mini = await startMiniMcpServer([3481, 3482, 3483, 3484, 3485])
    summary.ports.mcp = mini.port
    log(`mini MCP server up on 127.0.0.1:${mini.port}`)

    // ── blueprint + capability directive data ────────────────────────────────
    const blueprint = {
      blueprintId: 'P5T5-BP-REAL',
      revision: '1',
      contentHash: `sha256-${createHash('sha256')
        .update(JSON.stringify({ id: 'P5T5-BP-REAL', leaderPersona: LEADER_PERSONA, memberPersonas: { p5t5worker: MEMBER_PERSONA } }))
        .digest('hex')}`,
      leaderPersona: LEADER_PERSONA,
      memberPersonas: { p5t5worker: MEMBER_PERSONA },
      defaultModel: { provider: 'p5t5-static', model: 'p5t5-model-v1' },
      defaultWorkspace: 'C:/agent-team/work/p5t5',
    }
    const facet = (items) => ({ available: items, teamResolved: items, externalHard: items })
    const capability = {
      toolsPermissions: facet(['p5t5-tool-alpha', 'p5t5-tool-beta']),
      skills: facet(['p5t5-skill-one']),
      mcp: facet(['p5t5mini']),
      preStepPreExecute: facet(['tools/pre-execute', 'agent/pre-step']),
    }
    const sessionIds = { S1: 'session-p5t5-s1', S3: 'session-p5t5-s3', S4: 'session-p5t5-s4' }
    const admissionPolicyByScenario = { S1: 'open', S2: 'open', S3: 'closed', S4: 'open' }

    const directiveFor = (boot) => ({
      boot,
      reportDir,
      runStamp: summary.runStamp,
      teamPersonaPresetId: presetId,
      mcpPort: mini.port,
      ...(boot === 2 ? { resumeSessionId: sessionIds.S1 } : {}),
      ...(boot === 1 ? { sessionIds } : {}),
      blueprint,
      capability,
      admissionPolicyByScenario,
    })
    const writeDirective = (boot) => {
      writeFileSync(join(DSH_HOME, 'p5t5-directive.json'), JSON.stringify(directiveFor(boot), null, 2))
      log(`directive boot=${boot} written to ${join(DSH_HOME, 'p5t5-directive.json')}`)
    }

    // ── boot driver ──────────────────────────────────────────────────────────
    const row = { id: 'p5t5-root-binding', name: pathToFileURL(join(HERE, 'plugin.mjs')).href }

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

    /** Pull the row's setup-failure record (if any) into a scenario failure. */
    const setupFailureSnippet = () => {
      try {
        const text = readFileSync(join(reportDir, 'setup-failure.json'), 'utf8')
        const parsed = JSON.parse(text)
        return `row setup failed: ${parsed.error}`
      } catch {
        return null
      }
    }

    const driveScenario = async (port, scenario) => {
      const t0 = Date.now()
      const { status, body } = await fetchJson(`http://127.0.0.1:${port}/__p5t5/run`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ scenario }),
      }, 240_000)
      const entry = {
        httpStatus: status,
        durationMs: Date.now() - t0,
        pass: status === 200 && body?.pass === true,
        assertions: body?.assertions?.length ?? 0,
        failing: (body?.assertions ?? []).filter((a) => a.pass !== true).map((a) => a.name),
        error: body?.error ?? (status === 200 ? null : body?.nonJsonBody ?? `http ${status}`),
      }
      if (!entry.pass) {
        const scenarioErrorFile = join(reportDir, `${scenario}.error.json`)
        if (existsSync(scenarioErrorFile)) {
          try {
            entry.error = JSON.parse(readFileSync(scenarioErrorFile, 'utf8')).error ?? entry.error
          } catch {
            /* keep the http-level error */
          }
        }
        const setupFailure = setupFailureSnippet()
        if (setupFailure !== null) entry.setupFailure = setupFailure
      }
      log(`scenario ${scenario}: http=${status} pass=${entry.pass} assertions=${entry.assertions} (${entry.durationMs}ms)`)
      return entry
    }

    const driveBoot = async (boot, port, scenarios) => {
      const instLogDir = join(logsDir, `boot${boot}`)
      mkdirSync(instLogDir, { recursive: true })
      const instance = new DshInstance({
        hostTree: HOST_TREE,
        dshHome: DSH_HOME,
        port,
        clientCommitHash: CLIENT_COMMIT_HASH,
        logDir: instLogDir,
      })
      const record = { port, patchFile: instance.patchFile, profile: null, url: null, logPath: null, bootMarkerLine: null, healthBefore: null, healthAfter: null, stop: null, scenarios: {} }
      try {
        const profile = await ensureProfile({ instance, log, timeoutMs: 90_000 })
        record.profile = profile
        instance.mountRows([row], [`P5-T5 harness patch layer (boot ${boot}): the p5t5-root-binding row is mounted ONLY through this public profile-patch seam.`])
        writeDirective(boot)
        const started = await instance.start({ timeoutMs: 120_000 })
        record.url = started.url
        record.logPath = started.logPath
        record.bootMarkerLine = await waitForLogLine(started.logPath, BOOT_MARKER, 30_000, () => true)
        if (record.bootMarkerLine === null) noteFailure(`boot ${boot}: boot marker line not found in log`)

        const dump = await instance.dumpConfig({ timeoutMs: 60_000 })
        writeFileSync(join(reportDir, `dump-config-boot${boot}.txt`), dump.text)
        const rowMounted = DshInstance.rowInDump(dump.text, row)
        if (boot === 1) summary.rowMounted.boot1 = rowMounted
        else summary.rowMounted.boot2 = rowMounted
        if (!rowMounted) noteFailure(`boot ${boot}: row not present in dump-config — the public patch seam did not mount the plugin`)

        // The row's async setup (dynamic TS imports + TeamDomain open)
        // completes AFTER the boot marker; the health route is registered as
        // the final step. Poll it until the row is ready before driving.
        const readyDeadline = Date.now() + 90_000
        let healthBefore = null
        for (;;) {
          const probe = await fetchJson(`http://127.0.0.1:${port}/__p5t5/health`, {}, 10_000)
          if (probe.status === 200 && probe.body !== null && typeof probe.body === 'object' && 'ok' in probe.body) {
            healthBefore = probe.body
            break
          }
          if (Date.now() >= readyDeadline) {
            noteFailure(`boot ${boot}: row routes not ready within 90s (last probe http=${probe.status} body=${JSON.stringify(probe.body)})`)
            healthBefore = probe.body
            break
          }
          await new Promise((r) => setTimeout(r, 500))
        }
        record.healthBefore = healthBefore
        log(`boot ${boot}: health=${JSON.stringify(healthBefore)} rowMounted=${rowMounted}`)

        for (const scenario of scenarios) {
          record.scenarios[scenario] = await driveScenario(port, scenario)
          summary.scenarios[scenario] = { boot, ...record.scenarios[scenario], reportFile: `harness-output/${scenario}.json` }
          if (!record.scenarios[scenario].pass) noteFailure(`scenario ${scenario} failed: ${JSON.stringify(record.scenarios[scenario].failing)}`)
        }

        const healthAfter = (await fetchJson(`http://127.0.0.1:${port}/__p5t5/health`, {}, 10_000)).body
        record.healthAfter = healthAfter
      } finally {
        const stop = await instance.stop({ timeoutMs: 15_000 })
        record.stop = stop
        log(`boot ${boot}: stopped killed=${stop.killed} portFree=${stop.portFree}`)
        if (!stop.portFree) {
          const freed = await waitForPortFree(port, 20_000)
          record.portReleasedAfterWait = freed
          if (!freed) noteFailure(`boot ${boot}: port ${port} still in use after stop+wait`)
        }
      }
      return record
    }

    const boot1Scenarios = ['S1', 'S3', 'S4'].filter((s) => args.selected.includes(s))
    const boot2Scenarios = ['S2'].filter((s) => args.selected.includes(s))

    if (boot1Scenarios.length > 0) {
      summary.boots.boot1 = await driveBoot(1, boot1Port, boot1Scenarios)
    }
    if (boot2Scenarios.length > 0) {
      summary.boots.boot2 = await driveBoot(2, boot2Port, boot2Scenarios)
    }
    if (boot1Scenarios.length === 0 && boot2Scenarios.length === 0) {
      throw new Error('no scenarios selected')
    }

    // ── post-flight: ports, mini server, pristine tree, stable instance ─────
    await closeMiniServer(mini)
    log('mini MCP server closed')
    summary.ports.released = {
      boot1: !(await portInUse(boot1Port)),
      boot2: boot2Scenarios.length > 0 ? !(await portInUse(boot2Port)) : null,
      mcp: !(await portInUse(mini.port)),
    }
    summary.pristine.after = await captureGitState(HOST_TREE, logsDir)
    summary.stable3080.after = await probeStableInstance()
    log(`postflight: stable :3080 ${JSON.stringify(summary.stable3080.after)}`)
    log(`postflight: test-use pristine after=${summary.pristine.after.statusEmpty && summary.pristine.after.diffEmpty}`)

    // ── verdict ──────────────────────────────────────────────────────────────
    if (!(summary.pristine.after.statusEmpty && summary.pristine.after.diffEmpty)) {
      noteFailure('test-use tree not pristine after run')
    }
    for (const s of args.selected) {
      const e = summary.scenarios[s]
      if (e === undefined) noteFailure(`scenario ${s} was selected but never ran`)
      else if (!e.pass) noteFailure(`scenario ${s} did not pass`)
    }
    if (summary.rowMounted.boot1 === false) noteFailure('boot 1 row not mounted via public patch seam')
    if (summary.rowMounted.boot2 === false) noteFailure('boot 2 row not mounted via public patch seam')
    if (summary.ports.released.boot1 === false) noteFailure('boot 1 port not released')
    if (summary.ports.released.mcp === false) noteFailure('mini MCP port not released')

    finish(summary.failures.length === 0)
  } catch (error) {
    noteFailure(`harness aborted: ${error?.message ?? error}${error?.stack ? `\n${error.stack}` : ''}`)
    try {
      if (summary.pristine.after === undefined) summary.pristine.after = await captureGitState(HOST_TREE, logsDir)
      summary.stable3080.after ??= await probeStableInstance()
    } catch {
      /* best effort */
    }
    writeFileSync(join(reportDir, 'summary.json'), JSON.stringify(summary, null, 2))
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(`P5-T5 harness fatal: ${error?.stack ?? error}`)
  process.exit(1)
})
