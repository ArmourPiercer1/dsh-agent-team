#!/usr/bin/env node
/**
 * P5-T6 real-instance harness — drives a REAL DSH test instance through
 * the member create/resume residency scenarios (M1 fresh create, M2 cold
 * resume after process death, M3 evict settled, M4 re-admit idempotency,
 * M5 ordinary invariance + the negative continuable-subagent probe) and
 * the I-1 hard group (I1a crash in the durable-write window, I1b schema
 * version mismatch fail-loudly, I1c record-loss replay) using PUBLIC
 * surfaces only (profile-patch row mount, dump-config, webServer-scoped
 * surface routes, DSH_HOME durable files). No real LLM calls are made:
 * the directive carries a static model reference, and no model provider
 * is ever contacted.
 *
 * Usage:
 *   node packages/runtime/member-residency/harness/run.mjs \
 *     --report-dir dev/agent-workflow/evidence/P5-T6/harness-output \
 *     [--port 3180]
 *
 * Layout (resolved by walking up from this file):
 *   REPO_ROOT  — the ancestor containing references/deepseek-harness-test-use
 *   HOST_TREE  — REPO_ROOT/references/deepseek-harness-test-use (pristine
 *                upstream test-use tree; git-clean asserted before AND after)
 *   DSH_HOME   — REPO_ROOT/references/.dsh-test-p5t6 (FRESH per run: removed
 *                and recreated; gitignored; workspace-internal)
 *
 * Boot plan (ports alternate; each boot is a fresh OS process):
 *   boot 1 (port, default 3180): the P5-T5 root-binding row (read-only
 *        reuse) — S1: the team root is created + bound (durable
 *        TeamSession + team-root binding). "T5 delivered, T6 re-verified".
 *   boot 2 (port+1, default 3181): the P5-T5 row — S2: the COLD team root
 *        after a process restart (same root re-verified cold).
 *   boot 3 (port): the P5-T6 member row — M1 (fresh member A) +
 *        M5 (ordinary invariance + followup UNAUTHORIZED probe), then the
 *        I1a crash: the row's audited write proxy freezes the process in
 *        the durable-write window (member B record durable, binding not);
 *        this driver polls /__p5t6/i1a/state and KILLS the real process.
 *   boot 4 (port+1): the P5-T6 row — M2 (cold member A: zero fresh side
 *        effects, zero writes) + I1A (convergent replay of the crashed
 *        member B: binding-only write, no duplicate) + M3 (evict settled)
 *        + M4 (re-admit idempotency: no duplicate member/binding/session).
 *   boot 5 (port): pre-boot, the durable member A record is DELETED under
 *        DSH_HOME; the P5-T6 row — I1C: replay recreates the record with
 *        no duplicate Member/Session, no crash.
 *   boot 6 (port+1): pre-boot, the persisted team_domain unit version is
 *        CORRUPTED under DSH_HOME; the P5-T6 row's setup must fail
 *        LOUDLY (SCHEMA_VERSION_MISMATCH, setup-failure.json) and the
 *        corrupted file must NOT be rewritten (no silent migration).
 *
 * Pristine self-checks recorded in summary.json:
 *   - test-use tree `git status` clean before (and after, incl. after the
 *     build chain) and after the run;
 *   - :3080 stable-instance reachability recorded before and after
 *     (GET only, 3s timeout — the stable instance is never touched);
 *   - ports released after every instance stop;
 *   - dump-config proves every row was mounted through the public patch
 *     seam.
 *
 * The P4-T5 file-seam suites stay canonical in the unit chain (part of the
 * 888); this harness is the I-1 real-process supplement (not a
 * replacement).
 */
import {
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  rmSync,
  appendFileSync,
  writeFileSync,
  copyFileSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'node:module'

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
import { closeMiniServer, startMiniMcpServer } from '../../root-binding/harness/mini-mcp.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const T5_HARNESS = join(HERE, '..', '..', 'root-binding', 'harness')
const WORKTREE_ROOT = resolve(HERE, '..', '..', '..', '..')
const CLIENT_COMMIT_HASH = 'cd5ef814'
const STABLE_URL = 'http://127.0.0.1:3080/'
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=[A-Za-z0-9_-]+/

const LEADER_PERSONA = 'You are the p5t6 team leader, guiding workers with clear directives and steady judgement.'
const MEMBER_PERSONA = 'You are the p5t6worker member, executing your assigned step and reporting facts.'

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
  if (args.reportDir === null) throw new Error('--report-dir is required')
  if (!Number.isInteger(args.port) || args.port < 1 || args.port > 65535) {
    throw new Error(`invalid --port: ${args.port}`)
  }
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

// ── TeamDomain file manipulation (I1b/I1c — DSH_HOME is harness-owned) ─────

/** @param {string} dshHome @returns {string} the raw file text. */
function readDomainFileText(dshHome) {
  return readFileSync(join(dshHome, 'storages', 'team_domain.json'), 'utf8')
}

/**
 * I1C: delete the member A record row from the persisted unit (the durable
 * record loss). @param {object} ctx @returns {{deletedKey: string}}
 */
function deleteMemberRecord(dshHome, key, label) {
  const text = readDomainFileText(dshHome)
  const doc = JSON.parse(text)
  const table = doc?.tables?.member_instances
  if (table === undefined || table === null || typeof table !== 'object') {
    throw new Error(`p5t6 I1C: the persisted unit has no member_instances table (label ${label})`)
  }
  if (table[key] === undefined) {
    throw new Error(`p5t6 I1C: member record key not found in the persisted unit: ${key}`)
  }
  delete table[key]
  writeFileSync(join(dshHome, 'storages', 'team_domain.json'), `${JSON.stringify(doc, null, 2)}\n`)
  return { deletedKey: key }
}

/**
 * I1B: corrupt the persisted unit's version stamp (stored version != the
 * supported version -> the open must fail loudly with a mismatch).
 * @param {string} dshHome
 * @returns {{originalText: string, corruptedText: string, corruptedVersion: number}}
 */
function corruptDomainVersion(dshHome) {
  const originalText = readDomainFileText(dshHome)
  const doc = JSON.parse(originalText)
  if (doc?.unit === undefined || typeof doc.unit !== 'object') {
    throw new Error('p5t6 I1B: the persisted unit has no unit header to corrupt')
  }
  doc.unit.version = 999
  const corruptedText = `${JSON.stringify(doc, null, 2)}\n`
  writeFileSync(join(dshHome, 'storages', 'team_domain.json'), corruptedText)
  return { originalText, corruptedText, corruptedVersion: 999 }
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
  const DSH_HOME = join(REPO_ROOT, 'references', '.dsh-test-p5t6')
  const portA = args.port
  const portB = args.port + 1

  log(`P5-T6 harness start: worktree=${WORKTREE_ROOT}`)
  log(`repo root=${REPO_ROOT} hostTree=${HOST_TREE} dshHome=${DSH_HOME}`)
  log(`ports: odd boots=${portA} even boots=${portB}`)

  // Product identity derivation (worktree TS sources through the shared
  // resolve hook — the same rewrite the row uses; pure functions only).
  register(new URL('../../root-binding/harness/ts-loader.mjs', import.meta.url), import.meta.url)
  const memberMod = await import('../index.js')
  const contractsMod = await import('../../../contracts/src/index.js')
  log(`product modules loaded: deriveMemberIdentity + memberIdentityKey (worktree TS sources)`)

  const summary = {
    task: 'P5-T6 member create/resume residency (I-1 real instance)',
    runStamp: Date.now(),
    worktree: WORKTREE_ROOT,
    hostTree: HOST_TREE,
    dshHome: DSH_HOME,
    ports: { odd: portA, even: portB, mcp: null, released: {} },
    stable3080: { before: null, after: null },
    pristine: { before: null, afterBuild: null, after: null },
    build: null,
    rowMounted: {},
    boots: {},
    scenarios: {},
    i1: { a: null, b: null, c: null },
    pass: false,
    failures: [],
  }

  const finish = (pass, extra) => {
    summary.pass = pass
    if (extra !== undefined) Object.assign(summary, extra)
    writeFileSync(join(reportDir, 'summary.json'), JSON.stringify(summary, null, 2))
    log(`P5-T6 harness ${pass ? 'PASS' : 'FAIL'} — summary: ${join(reportDir, 'summary.json')}`)
    process.exit(pass ? 0 : 1)
  }
  const noteFailure = (why) => {
    summary.failures.push(why)
    log(`FAILURE: ${why}`)
  }

  let mini = null
  try {
    // ── pre-flight: pristine tree, stable instance, ports ───────────────────
    summary.pristine.before = await captureGitState(HOST_TREE, logsDir)
    const beforeClean = summary.pristine.before.statusEmpty && summary.pristine.before.diffEmpty
    if (!beforeClean) throw new Error(`test-use tree not pristine before run: ${JSON.stringify(summary.pristine.before.errors)}`)
    log(`preflight: test-use tree pristine (head ${summary.pristine.before.head})`)

    summary.stable3080.before = await probeStableInstance()
    log(`preflight: stable :3080 ${JSON.stringify(summary.stable3080.before)}`)

    if ((await portInUse(portA)) || (await portInUse(portB))) {
      throw new Error(`ports ${portA}/${portB} are already in use — aborting`)
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
        log('build:web failed in-sandbox (vite→esbuild spawn EPERM, documented in TEST_METHODS §3); build:lib artifacts complete — continuing')
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
    // The junction farm lives in the COMMON ANCESTOR of both harness dirs
    // (packages/runtime): the T5 row (root-binding/harness) and the T6 row
    // (member-residency/harness) both resolve their static @deepseek-ai/*
    // imports by walking up to packages/runtime/node_modules. A per-dir
    // farm would leave the other row's bare imports unresolvable.
    const SHARED_PROBES_DIR = resolve(HERE, '..', '..')
    rmSync(join(HERE, 'node_modules'), { recursive: true, force: true })
    ensureProbeResolution({
      probesDir: SHARED_PROBES_DIR,
      packages: [...farm, { name: 'zod', dir: zodDir }],
      log,
    })
    log('junction farm ready (shared packages/runtime/node_modules)')

    // ── user preset fixtures (DSH_HOME-local persona presets) ───────────────
    const leaderPresetId = 'p5t6-leader-persona'
    const memberPresetId = 'p5t6-member-persona'
    const writePreset = (presetId, text) => {
      const presetDir = join(DSH_HOME, '.agent-presets', presetId)
      mkdirSync(presetDir, { recursive: true })
      writeFileSync(join(presetDir, 'agent.cordis.yml'), [
        `# P5-T6 harness fixture: ${presetId} persona preset (user preset, DSH_HOME-local).`,
        '- id: persona',
        "  name: '@deepseek-ai/dsh-persona'",
        '  config:',
        `    text: ${text}`,
        '',
      ].join('\n'))
    }
    writePreset(leaderPresetId, LEADER_PERSONA)
    writePreset(memberPresetId, MEMBER_PERSONA)
    log(`user presets written: ${leaderPresetId}, ${memberPresetId}`)

    // ── mini MCP server (127.0.0.1, ports 3491-3495 candidates) ─────────────
    mini = await startMiniMcpServer([3491, 3492, 3493, 3494, 3495])
    summary.ports.mcp = mini.port
    log(`mini MCP server up on 127.0.0.1:${mini.port}`)

    // ── blueprint + capability directive data ────────────────────────────────
    const blueprint = {
      blueprintId: 'P5T6-BP-REAL',
      revision: '1',
      contentHash: `sha256-${createHash('sha256')
        .update(JSON.stringify({ id: 'P5T6-BP-REAL', leaderPersona: LEADER_PERSONA, memberPersonas: { p5t6worker: MEMBER_PERSONA } }))
        .digest('hex')}`,
      leaderPersona: LEADER_PERSONA,
      memberPersonas: { p5t6worker: MEMBER_PERSONA },
      defaultModel: { provider: 'p5t6-static', model: 'p5t6-model-v1' },
      defaultWorkspace: 'C:/agent-team/work/p5t6',
    }
    const facet = (items) => ({ available: items, teamResolved: items, externalHard: items })
    const capability = {
      toolsPermissions: facet(['p5t6-tool-alpha', 'p5t6-tool-beta']),
      skills: facet(['p5t6-skill-one']),
      mcp: facet(['p5t6mini']),
      preStepPreExecute: facet(['tools/pre-execute', 'agent/pre-step']),
    }

    const rootSid = 'session-p5t6-root'
    const ordinarySid = 'session-p5t6-ordinary'
    const specA = { rootSessionId: rootSid, templateId: 'p5t6worker', label: 'worker-a' }
    const specB = { rootSessionId: rootSid, templateId: 'p5t6worker', label: 'worker-b' }
    const identityA = memberMod.deriveMemberIdentity(specA)
    const identityB = memberMod.deriveMemberIdentity(specB)
    const admissionPolicyByScenario = { M1: 'open', M2: 'open', M3: 'open', M4: 'open', M5: 'open', I1A: 'open', I1C: 'open' }
    log(`derived identities: A=${JSON.stringify(identityA)} B=${JSON.stringify(identityB)}`)

    summary.members = {
      rootSessionId: rootSid,
      ordinarySessionId: ordinarySid,
      A: { spec: specA, identity: identityA },
      B: { spec: specB, identity: identityB },
    }

    /** The T5 directive (boots 1-2: the root-binding row, read-only reuse). */
    const t5DirectiveFor = (boot) => ({
      boot,
      reportDir,
      runStamp: summary.runStamp,
      teamPersonaPresetId: leaderPresetId,
      mcpPort: mini.port,
      ...(boot === 2 ? { resumeSessionId: rootSid } : {}),
      ...(boot === 1 ? { sessionIds: { S1: rootSid, S3: 'session-p5t6-s3', S4: 'session-p5t6-s4' } } : {}),
      blueprint,
      capability,
      admissionPolicyByScenario: { S1: 'open', S2: 'open', S3: 'closed', S4: 'open' },
    })

    /** The T6 directive (boots 3-6: the member-residency row). */
    const t6DirectiveFor = (boot) => ({
      boot,
      reportDir,
      runStamp: summary.runStamp,
      memberPersonaPresetId: memberPresetId,
      mcpPort: mini.port,
      rootSessionId: rootSid,
      ordinarySessionId: ordinarySid,
      specs: { A: specA, B: specB },
      admissionPolicyByScenario,
      blueprint,
      capability,
    })

    // ── boot driver ──────────────────────────────────────────────────────────
    const t5Row = { id: 'p5t5-root-binding', name: pathToFileURL(join(T5_HARNESS, 'plugin.mjs')).href }
    const t6Row = { id: 'p5t6-member-residency', name: pathToFileURL(join(HERE, 'plugin.mjs')).href }

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

    /** Drive one scenario of one row over loopback. */
    const driveScenario = async (port, rowTag, scenario) => {
      const t0 = Date.now()
      const { status, body } = await fetchJson(`http://127.0.0.1:${port}/__${rowTag}/run`, {
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
        error: body?.error?.message ?? (status === 200 ? null : body?.nonJsonBody ?? `http ${status}`),
      }
      log(`scenario ${scenario} (${rowTag}): http=${status} pass=${entry.pass} assertions=${entry.assertions} (${entry.durationMs}ms)`)
      return entry
    }

    /**
     * One boot: mount rows through the public patch seam, start, verify the
     * row mount via dump-config, poll row health, drive scenarios, stop.
     * @param {number} boot
     * @param {number} port
     * @param {Array<object>} rows
     * @param {object} opts
     * @returns {Promise<object>} the boot record.
     */
    const driveBoot = async (boot, port, rows, opts) => {
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
        rows: rows.map((r) => r.id),
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
        instance.mountRows(rows, [
          `P5-T6 harness patch layer (boot ${boot}): ${rows.map((r) => r.id).join(', ')} mounted ONLY through this public profile-patch seam.`,
        ])
        if (opts.t5Directive !== undefined) {
          writeFileSync(join(DSH_HOME, 'p5t5-directive.json'), JSON.stringify(opts.t5Directive, null, 2))
        }
        if (opts.t6Directive !== undefined) {
          writeFileSync(join(DSH_HOME, 'p5t6-directive.json'), JSON.stringify(opts.t6Directive, null, 2))
        }
        log(`directive(s) boot=${boot} written to ${DSH_HOME}`)
        const started = await instance.start({ timeoutMs: 120_000 })
        record.url = started.url
        record.logPath = started.logPath
        record.bootMarkerLine = await waitForLogLine(started.logPath, BOOT_MARKER, 30_000, () => true)
        if (record.bootMarkerLine === null) noteFailure(`boot ${boot}: boot marker line not found in log`)

        const dump = await instance.dumpConfig({ timeoutMs: 60_000 })
        writeFileSync(join(reportDir, `dump-config-boot${boot}.txt`), dump.text)
        record.rowMounted = {}
        for (const row of rows) {
          const mounted = DshInstance.rowInDump(dump.text, row)
          record.rowMounted[row.id] = mounted
          summary.rowMounted[`${row.id}-boot${boot}`] = mounted
          if (!mounted) noteFailure(`boot ${boot}: row ${row.id} not present in dump-config — the public patch seam did not mount the plugin`)
        }

        if (opts.expectSetupFailure === true) {
          // I1B boot: the row's setup must FAIL LOUDLY (setup-failure.json
          // with the mismatch code); its health route is never registered.
          const setupFailure = await pollFile(join(reportDir, 'setup-failure.json'), 120_000)
          record.setupFailure = setupFailure
          if (setupFailure !== null && setupFailure.code !== 'SCHEMA_VERSION_MISMATCH') {
            noteFailure(`boot ${boot}: expected SCHEMA_VERSION_MISMATCH setup failure, got code=${JSON.stringify(setupFailure?.code)} error=${JSON.stringify(setupFailure?.error)}`)
          }
          return record
        }

        // The row's async setup (dynamic TS imports + TeamDomain open)
        // completes AFTER the boot marker; the health route is registered
        // as the final step. Poll it until the row is ready before driving.
        const healthPath = rows.some((r) => r.id === 'p5t6-member-residency') ? '/__p5t6/health' : '/__p5t5/health'
        const readyDeadline = Date.now() + 90_000
        let healthBefore = null
        for (;;) {
          const probe = await fetchJson(`http://127.0.0.1:${port}${healthPath}`, {}, 10_000)
          if (probe.status === 200 && probe.body !== null && typeof probe.body === 'object' && 'ok' in probe.body) {
            healthBefore = probe.body
            if (probe.body.ok !== true) {
              noteFailure(`boot ${boot}: row reported setup failure: ${JSON.stringify(probe.body)}`)
            }
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
        log(`boot ${boot}: health=${JSON.stringify(healthBefore)} rowMounted=${JSON.stringify(record.rowMounted)}`)

        for (const [rowTag, scenario] of opts.scenarios) {
          const entry = await driveScenario(port, rowTag, scenario)
          record.scenarios[scenario] = entry
          summary.scenarios[scenario] = { boot, row: rowTag, ...entry, reportFile: `harness-output/${scenario}.json` }
          if (!entry.pass) noteFailure(`scenario ${scenario} failed: ${JSON.stringify(entry.failing)} ${entry.error ?? ''}`)
        }

        // I1a crash: the gated create of member B hangs inside the audited
        // write proxy (record durable, binding not). Poll the window, then
        // kill the REAL process.
        if (opts.i1aKill === true) {
          const i1a = await runI1aCrash(instance, port)
          record.i1aCrash = i1a
          summary.i1.a = i1a
          if (!i1a.windowObserved) {
            noteFailure(`I1a: the durable-write window was not observed before the kill (state=${JSON.stringify(i1a.stateAtKill)})`)
          }
        }

        // After an I1a kill the process is dead by design — no probe.
        if (opts.i1aKill !== true) {
          record.healthAfter = (await fetchJson(`http://127.0.0.1:${port}${healthPath}`, {}, 10_000)).body
        }
      } finally {
        const stop = await instance.stop({ timeoutMs: 20_000 })
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

    /**
     * The I1a crash run: arm the gate, fire the gated create (fire-and-
     * forget — the response is never sent by design), poll /i1a/state
     * until the window is open (record durable, binding absent), then kill
     * the real process.
     * @param {object} instance
     * @param {number} port
     * @returns {Promise<object>} the crash record.
     */
    const runI1aCrash = async (instance, port) => {
      const record = { armed: false, windowObserved: false, stateAtKill: null, kill: null, windowWaitMs: null }
      const arm = await fetchJson(`http://127.0.0.1:${port}/__p5t6/i1a/run`, { method: 'POST' }, 30_000)
      record.armed = arm.status === 202 && arm.body?.armed === true
      if (!record.armed) {
        log(`I1a: arm failed (http=${arm.status} body=${JSON.stringify(arm.body).slice(0, 400)})`)
        return record
      }
      log('I1a: gate armed — the gated create of member B is running')
      const t0 = Date.now()
      let state = null
      const deadline = Date.now() + 90_000
      for (;;) {
        const probe = await fetchJson(`http://127.0.0.1:${port}/__p5t6/i1a/state`, {}, 10_000)
        state = probe.body
        if (state !== null && state.recordWritten === true && state.bindingWritten === false) {
          record.windowObserved = true
          record.windowWaitMs = Date.now() - t0
          break
        }
        if (Date.now() >= deadline) {
          log(`I1a: window not observed within 90s (last state=${JSON.stringify(state)})`)
          break
        }
        await new Promise((r) => setTimeout(r, 250))
      }
      record.stateAtKill = state
      // Kill the real OS process in the window (no graceful shutdown).
      record.kill = await instance.stop({ timeoutMs: 20_000 })
      log(`I1a: process killed in the durable-write window (killed=${record.kill?.killed} portFree=${record.kill?.portFree} state=${JSON.stringify(state)})`)
      if (!record.kill?.portFree) {
        const freed = await waitForPortFree(port, 20_000)
        record.portReleasedAfterWait = freed
      }
      return record
    }

    /**
     * Poll a file until it exists and parses as JSON (or the deadline).
     * @param {string} path
     * @param {number} timeoutMs
     * @returns {Promise<object|null>}
     */
    const pollFile = async (path, timeoutMs) => {
      const deadline = Date.now() + timeoutMs
      for (;;) {
        if (existsSync(path)) {
          try {
            return JSON.parse(readFileSync(path, 'utf8'))
          } catch {
            /* partial write — retry */
          }
        }
        if (Date.now() >= deadline) return null
        await new Promise((r) => setTimeout(r, 500))
      }
    }

    // ── the boot plan ────────────────────────────────────────────────────────
    // boot 1: the T5 root row — S1 fresh team root (re-verified for G5).
    summary.boots.boot1 = await driveBoot(1, portA, [t5Row], {
      t5Directive: t5DirectiveFor(1),
      scenarios: [['p5t5', 'S1']],
    })

    // boot 2: the T5 root row — S2 cold team root after the restart.
    summary.boots.boot2 = await driveBoot(2, portB, [t5Row], {
      t5Directive: t5DirectiveFor(2),
      scenarios: [['p5t5', 'S2']],
    })

    // boot 3: the T6 member row — M1 + M5, then the I1a crash (kill).
    summary.boots.boot3 = await driveBoot(3, portA, [t6Row], {
      t6Directive: t6DirectiveFor(3),
      scenarios: [['p5t6', 'M1'], ['p5t6', 'M5']],
      i1aKill: true,
    })

    // boot 4: the T6 member row — M2 (cold after the crash) + I1A (replay)
    // + M3 (evict settled) + M4 (re-admit idempotency).
    summary.boots.boot4 = await driveBoot(4, portB, [t6Row], {
      t6Directive: t6DirectiveFor(4),
      scenarios: [['p5t6', 'M2'], ['p5t6', 'I1A'], ['p5t6', 'M3'], ['p5t6', 'M4']],
    })

    // boot 5: pre-boot, delete the member A record (I1c record loss);
    // the row — I1C replay.
    const memberKeyA = contractsMod.memberIdentityKey({
      rootSessionId: rootSid,
      instanceId: identityA.instanceId,
    })
    const i1cDelete = deleteMemberRecord(DSH_HOME, memberKeyA, 'I1C pre-boot')
    log(`I1c: member A record deleted pre-boot (key=${i1cDelete.deletedKey})`)
    summary.boots.boot5 = await driveBoot(5, portA, [t6Row], {
      t6Directive: t6DirectiveFor(5),
      scenarios: [['p5t6', 'I1C']],
    })
    summary.i1.c = {
      deletedKey: i1cDelete.deletedKey,
      boot: 5,
      scenario: summary.scenarios.I1C ?? null,
    }

    // boot 6: pre-boot, corrupt the unit version (I1b); the row's setup
    // must fail loudly with SCHEMA_VERSION_MISMATCH (no silent migration).
    rmSync(join(reportDir, 'setup-failure.json'), { force: true })
    const i1b = corruptDomainVersion(DSH_HOME)
    copyFileSync(join(DSH_HOME, 'storages', 'team_domain.json'), join(reportDir, 'team_domain.json.corrupted-preboot'))
    log(`I1b: team_domain unit version corrupted pre-boot (999; original ${i1b.originalText.length} bytes backed up)`)
    summary.i1.b = {
      corruptedVersion: i1b.corruptedVersion,
      boot: 6,
      expectedCode: 'SCHEMA_VERSION_MISMATCH',
    }
    summary.boots.boot6 = await driveBoot(6, portB, [t6Row], {
      t6Directive: t6DirectiveFor(6),
      expectSetupFailure: true,
    })
    // No silent migration: the corrupted file must be byte-identical after
    // the failed boot (nothing may have rewritten the unit document).
    const textAfterBoot6 = readFileSync(join(DSH_HOME, 'storages', 'team_domain.json'), 'utf8')
    summary.i1.b.fileUnchangedAfterFailedBoot = textAfterBoot6 === i1b.corruptedText
    if (summary.i1.b.fileUnchangedAfterFailedBoot !== true) {
      noteFailure('I1b: the corrupted unit file was rewritten by the failed boot (a silent migration occurred)')
    }
    const i1bFailure = summary.boots.boot6?.setupFailure
    summary.i1.b.setupFailureCode = i1bFailure?.code ?? null
    if (i1bFailure?.code !== 'SCHEMA_VERSION_MISMATCH') {
      noteFailure(`I1b: setup failure code was ${JSON.stringify(i1bFailure?.code ?? null)} (expected SCHEMA_VERSION_MISMATCH)`)
    }

    // ── post-flight: ports, mini server, pristine tree, stable instance ─────
    await closeMiniServer(mini)
    log('mini MCP server closed')
    summary.ports.released = {
      odd: !(await portInUse(portA)),
      even: !(await portInUse(portB)),
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
    for (const s of ['S1', 'S2', 'M1', 'M2', 'M3', 'M4', 'M5', 'I1A', 'I1C']) {
      const e = summary.scenarios[s]
      if (e === undefined || e.pass !== true) noteFailure(`scenario ${s} missing or failing`)
    }
    for (const [boot, rows] of Object.entries({ boot1: ['p5t5-root-binding'], boot2: ['p5t5-root-binding'], boot3: ['p5t6-member-residency'], boot4: ['p5t6-member-residency'], boot5: ['p5t6-member-residency'], boot6: ['p5t6-member-residency'] })) {
      for (const row of rows) {
        if (summary.rowMounted[`${row}-${boot}`] !== true) noteFailure(`${row} not mounted via the public patch seam on ${boot}`)
      }
    }
    if (summary.ports.released.odd === false) noteFailure('odd port not released')
    if (summary.ports.released.even === false) noteFailure('even port not released')
    if (summary.ports.released.mcp === false) noteFailure('mini MCP port not released')
    if (summary.i1.a?.windowObserved !== true) noteFailure('I1a: crash window not observed')
    if (summary.i1.a?.kill?.killed === false) noteFailure('I1a: the process kill did not settle')
    if (summary.i1.b?.setupFailureCode !== 'SCHEMA_VERSION_MISMATCH') noteFailure('I1b: expected SCHEMA_VERSION_MISMATCH')
    if (summary.i1.b?.fileUnchangedAfterFailedBoot !== true) noteFailure('I1b: silent migration detected')
    if (summary.i1.c?.scenario?.pass !== true) noteFailure('I1c: replay scenario missing or failing')

    if (summary.failures.length === 0) {
      finish(true)
    }
    log(`P5-T6 harness FAIL — ${summary.failures.length} failure(s)`)
    finish(false)
  } catch (error) {
    log(`P5-T6 harness fatal: ${error?.stack ?? error}`)
    try {
      if (mini !== null) await closeMiniServer(mini)
    } catch {
      /* best effort */
    }
    try {
      summary.pristine.after ??= await captureGitState(HOST_TREE, logsDir)
      summary.stable3080.after ??= await probeStableInstance()
    } catch {
      /* best effort */
    }
    writeFileSync(join(reportDir, 'summary.json'), JSON.stringify(summary, null, 2))
    process.exit(1)
  }
}

main().catch((error) => {
  console.error(`P5-T6 harness fatal: ${error?.stack ?? error}`)
  process.exit(1)
})
