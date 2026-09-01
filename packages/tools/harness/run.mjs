#!/usr/bin/env node
/**
 * P8-S3 real-instance harness 鈥?drives a REAL DSH test instance through the
 * team-tools layer end-to-end (P8-S3 criteria W1-W7) using PUBLIC surfaces
 * only: the profile-patch row mount (verified by dump-config),
 * webServer-scoped row routes, and DSH_HOME durable files. The driver NEVER
 * calls the TeamRuntime API: every team action travels driver -> HTTP
 * /__p6t6/tool -> the registered tool handler (public Cordis tool
 * registration + execution seams) -> the TeamRuntime work execution chain
 * (admission -> ensure/resume Member Agent -> submit model-visible prompt ->
 * real child Session -> real turn -> observe completion -> durable settle ->
 * activity interval closure).
 *
 * W4 (delivery failure), W6 (activity interval), W8 (durable CAS version
 * mismatch) and W9 (same-logical-work retry) are covered at the package
 * level (packages/runtime/test/p8s3-work-chain.test.ts,
 * packages/storage/test/p8s3-member-cas.test.ts) and are NOT live criteria.
 *
 * No real LLM calls are made: the row installs a static model reference
 * (p6t6-static/p6t6-model-v1) that no provider in the fresh test DSH_HOME
 * serves, so child turns fail contained at the driver boundary and the
 * quiescence wait settles 鈥?the model-visible prompt still lands in the
 * durable session log before the settle (fail-closed on true anomalies).
 *
 * Usage:
 *   node packages/tools/harness/run.mjs \
 *     --report-dir packages/tools/harness/reports/p8s3-<ts> \
  *     [--scenarios E1,E2,E3,E4,E5,E6,E7,W1,W2,W3,W5,W7] \
 *     [--port 3181] \
 *     [--dsh-home .dsh-test-p8s3] \
  *     [--dsh-home-e .dsh-test-p8s3-e] \
 *     [--lock-file references/.dsh-test-p8s3.lock]
 *
  * Layout (resolved by walking up from this file):
  *   REPO_ROOT  - the ancestor containing references/deepseek-harness-test-use
  *   HOST_TREE  - REPO_ROOT/references/deepseek-harness-test-use (pristine
  *                upstream test-use tree; git-clean asserted before AND after)
  *   DSH_HOME   - REPO_ROOT/references/<--dsh-home> (default .dsh-test-p8s3);
  *                the W world's home; must be FRESH (missing or empty) or the
  *                run aborts fail-closed; gitignored; workspace-internal
  *   DSH_HOME_E - REPO_ROOT/references/<--dsh-home-e> (default
  *                .dsh-test-p8s3-e); the E world's home; same freshness rule
  *   LOCK       - REPO_ROOT/<--lock-file> (default references/.dsh-test-p8s3.lock);
  *                acquired only when free (exclusive create), released only
  *                when the marker still names this runStamp.
 *
  * Boot plan (serial; ports alternate; each boot is a fresh OS process):
  *   Two durable worlds, two boots each. The frozen per-template instance
  *   quota (4 per template in the p6t6 blueprint) makes it impossible to
  *   run the E and W criteria inside one team, so each world gets its own
  *   DSH_HOME; within a world, boot 2 reads boot 1's durable state.
  *   boot 1 (port, default 3181; DSH_HOME): the P8-S3 team row (plugin.mjs)
  *        creates the team root + seeds three members (leader bound to the
  *        root, one worker, one scout), then the driver runs:
  *        W1 delegate TOKEN_A -> a real new Member Session receives TOKEN_A
  *           (executed, member-activated, work settled, the durable child
  *           log carries the exact prompt; row SETTLED at activityVersion 3),
  *        W5 persistent follow-up on the seeded resident worker -> SETTLED
  *           (RUNNING needs no admission CAS) with the work-unit activity
  *           interval opened and closed,
  *        W7 residency drop + cold resume of the W1 member -> the SAME
  *           childSessionId resumes (no re-mint; no new session),
  *        W3 two fresh_per_delegation delegates -> two NEW instances and
  *           two NEW child sessions, both carrying their tokens.
  *   boot 2 (port+1, default 3182; DSH_HOME): the SAME row over the SAME
  *        home; W2's persistent follow-up on the W1 member across a real
  *        process restart lands on the SAME childSessionId and the same
  *        six-member roster.
  *   boot 3 (port+2, default 3183; DSH_HOME_E): the E-world row creates the
  *        E team + the same three seeds, then E1 (three concurrent worker
  *        creates), E2 (label/template addressing probes, live-rejected),
  *        E3 (two follow-ups on the E1 worker, monotonic sequences), E4
  *        (two fresh_per_delegation scout creates), E6 (the scout over-quota
  *        race: exactly one of three admits at ==limit), and the E5 write
  *        phase (E5a: message + two progress reports + one PENDING control
  *        request, all durable).
  *   boot 4 (port+3, default 3184; DSH_HOME_E): the E5 restart phase (E5b):
  *        after the real process restart, the durable read-back, the control
  *        resolution, and the post-restart message/progress land durably.
  *   E7 (static; no instance): the committed bypass scan over the live tree,
  *        run before boot 1.
  *   Hygiene asserted before/after: test-use tree pristine, stable :3080
  *   reachable/200, DSH_HOME(E) freshness, the lockfile handshake, port
  *   release for every boot, and row mount on every boot.
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
import { zstdDecompressSync } from 'node:zlib'

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

/** The team root session id (directive-carried; create-phase boots seed it, resume-phase boots re-open it). */
const ROOT_SESSION_ID = 'session-p6t6root'
/** The leader member instance (its bound child session IS the root). */
const LEADER_INSTANCE_ID = 'inst-leader'
/** The seeded worker / scout instance ids (plugin.mjs mirrors these). */
const SEED_WORKER_ID = 'inst-p6t6seedw1'
const SEED_SCOUT_ID = 'inst-p6t6seeds1'
/** The seeded worker's child session id (plugin.mjs mirrors the derivation). */
const SEED_WORKER_CHILD = 'session-child-p6t6seedw1'
/** E5: the control-request correlation token (the guarded follow-up). */
const E5_CTRL_TOKEN = 'p6t6-e5-ctrl1'
/** W1: the delegate token the fresh member session must receive. */
const W1_TOKEN = 'p8s3-w1-token'
const W1_PROMPT = 'the p8s3 W1 exact model-visible prompt'
/** W2: the persistent follow-up token across the process restart. */
const W2_TOKEN = 'p8s3-w2-token'
const W2_PROMPT = 'the p8s3 W2 exact model-visible follow-up prompt'
/** W3: two fresh_per_delegation delegate tokens (distinct instances). */
const W3_C_TOKEN = 'p8s3-w3-token-c'
const W3_C_PROMPT = 'the p8s3 W3-C exact model-visible prompt'
const W3_D_TOKEN = 'p8s3-w3-token-d'
const W3_D_PROMPT = 'the p8s3 W3-D exact model-visible prompt'
/** W5: the follow-up token on the seeded resident worker. */
const W5_TOKEN = 'p8s3-w5-token'
const W5_PROMPT = 'the p8s3 W5 exact model-visible follow-up prompt'
/** W7: the cold-resume follow-up token after the residency drop. */
const W7_TOKEN = 'p8s3-w7-token'
const W7_PROMPT = 'the p8s3 W7 exact model-visible follow-up prompt'
// ── P8-S4B: the durable-mutation -> actual-Agent-behavior criteria (M1-M5) ──
/** M1: the baseline model-A follow-up token (in-flight stays A). */
const M1_TOKEN = 'p8s4b-m1-token'
const M1_PROMPT = 'the p8s4b M1 baseline model-visible prompt'
/** M2: the model-B follow-up token after the durable allow mutation. */
const M2_TOKEN = 'p8s4b-m2-token'
const M2_PROMPT = 'the p8s4b M2 model-B follow-up prompt'
/** M3: the post-restart model-B follow-up token (restart-effective). */
const M3_TOKEN = 'p8s4b-m3-token'
const M3_PROMPT = 'the p8s4b M3 post-restart model-B follow-up prompt'
/** M5: the post-restart follow-up token proving the model survives boot 2. */
const M5_TOKEN = 'p8s4b-m5-token'
const M5_PROMPT = 'the p8s4b M5 post-restart model-B prompt'
/** M4: the mini-MCP ping payloads (allowed vs denied boundaries). */
const M4_PING_MSG_ALLOW = 'p8s4b-m4-allow'
const M4_PING_MSG_DENY = 'p8s4b-m4-deny'
/** The live mini-MCP server name + the row-owned mini endpoint path. */
const M4_MCP_SERVER = 'p8s4bmini'
const M4_PING_TOOL = `mcp__${M4_MCP_SERVER}__ping`
/** The durable override record ids the M scenarios admit (cumulative re-issue). */
const M_RECORD_MODEL = 'p8s4b-ovr-model'
const M_RECORD_MCP_ALLOW = 'p8s4b-ovr-mcp-allow'
const M_RECORD_MCP_DENY = 'p8s4b-ovr-mcp-deny'
/** The model-B selection the M2 mutation grants (provider/model item). */
const M_MODEL_B = { provider: 'p6t6-static', model: 'p6t6-model-v2' }
/** The static baseline model selection (model A; plugin.mjs mirrors it). */
const M_MODEL_A = { provider: 'p6t6-static', model: 'p6t6-model-v1' }
/** The ten registered team tool names (asserted on health). */
const EXPECTED_TOOL_COUNT = 10
/** The exact tool-layer source files the committed scanner must cover. */
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
  W1: [],
  W2: ['W1'],
  W3: [],
  W5: [],
  W7: ['W1'],
  // P8-S4B: the M chain (M3 proves restart of M1/M2's work; M4's deny
  // generation builds on M2's allow; M5 proves restart of M4's deny).
  M1: [],
  M2: [],
  M3: ['M1', 'M2'],
  M4: ['M2'],
  M5: ['M4'],
}
const ALL_SCENARIOS = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'W1', 'W2', 'W3', 'W5', 'W7', 'M1', 'M2', 'M3', 'M4', 'M5']

/** Tail of an in-memory log string (up to `lines` last lines). */
function tailText(text, lines = 12) {
  if (text === undefined || text === null) return '<no output>'
  return String(text).split('\n').slice(-lines).join('\n')
}

// 鈹€鈹€ argument parsing 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

function parseArgs(argv) {
  const args = {
    reportDir: null,
    scenarios: ALL_SCENARIOS.join(','),
    port: 3181,
    dshHome: '.dsh-test-p8s3',
    dshHomeE: null,
    lockFile: 'references/.dsh-test-p8s3.lock',
    mcpPorts: '3491,3492,3493,3494,3495',
  }
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i]
    if (token === '--report-dir') args.reportDir = argv[++i]
    else if (token === '--scenarios') args.scenarios = argv[++i]
    else if (token === '--port') args.port = Number.parseInt(argv[++i], 10)
    else if (token === '--dsh-home') args.dshHome = argv[++i]
    else if (token === '--dsh-home-e') args.dshHomeE = argv[++i]
    else if (token === '--lock-file') args.lockFile = argv[++i]
    else if (token === '--mcp-ports') args.mcpPorts = argv[++i]
    else throw new Error(`unknown argument: ${token}`)
  }
  if (args.reportDir === null) throw new Error('--report-dir is required')
  if (!Number.isInteger(args.port) || args.port < 1 || args.port > 65535) {
    throw new Error(`invalid --port: ${args.port}`)
  }
  const mcpPorts = String(args.mcpPorts)
    .split(',')
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => Number.parseInt(s, 10))
  if (mcpPorts.length === 0 || mcpPorts.some((p) => !Number.isInteger(p) || p < 1 || p > 65535)) {
    throw new Error(`invalid --mcp-ports: ${args.mcpPorts}`)
  }
  args.mcpPorts = mcpPorts
  if (args.dshHomeE === null) args.dshHomeE = `${args.dshHome}-e`
  if (typeof args.dshHome !== 'string' || args.dshHome.length === 0 || args.dshHome.includes('..') || args.dshHome.includes('/') || args.dshHome.includes('\\')) {
    throw new Error(`invalid --dsh-home (a bare basename under references/): ${args.dshHome}`)
  }
  if (typeof args.dshHomeE !== 'string' || args.dshHomeE.length === 0 || args.dshHomeE.includes('..') || args.dshHomeE.includes('/') || args.dshHomeE.includes('\\')) {
    throw new Error(`invalid --dsh-home-e (a bare basename under references/): ${args.dshHomeE}`)
  }
  if (args.dshHomeE === args.dshHome) {
    throw new Error('--dsh-home-e must differ from --dsh-home (two separate team lifetimes)')
  }
  if (typeof args.lockFile !== 'string' || args.lockFile.length === 0 || args.lockFile.includes('..')) {
    throw new Error(`invalid --lock-file (a path relative to the repo root): ${args.lockFile}`)
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

// 鈹€鈹€ path discovery 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

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

// 鈹€鈹€ stable-instance probe (GET only 鈥?never mutates) 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

async function probeStableInstance() {
  try {
    const res = await fetch(STABLE_URL, { signal: AbortSignal.timeout(3000) })
    return { reachable: true, status: res.status }
  } catch (error) {
    return { reachable: false, reason: error?.name ?? 'error' }
  }
}

// 鈹€鈹€ main 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

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
  const DSH_HOME = join(REPO_ROOT, 'references', args.dshHome)
  const DSH_HOME_E = join(REPO_ROOT, 'references', args.dshHomeE)
  const LOCK_PATH = resolve(REPO_ROOT, args.lockFile)
  const portA = args.port
  const portB = args.port + 1
  const portC = args.port + 2
  const portD = args.port + 3
  // P8-S4B: the E world (boots 3-4 on DSH_HOME_E) only runs when a scenario
  // of that world is selected; an M/W-only run leaves boots 3-4 (and the E
  // world home + ports) completely unused.
  const eWorldUsed = args.selected.some((sc) => sc.startsWith('E'))

  const runStamp = `p8s3-${Date.now()}`
  log(`P8-S3 harness start: runStamp=${runStamp} worktree=${WORKTREE_ROOT}`)
  log(`repo root=${REPO_ROOT} hostTree=${HOST_TREE} dshHome=${DSH_HOME} dshHomeE=${DSH_HOME_E}`)
  log(`ports: boot1=${portA} boot2=${portB} (W world) boot3=${portC} boot4=${portD} (E world); selected scenarios: ${args.selected.join(',')}`)

  const summary = {
    task: 'P8-S3 team work execution + lifecycle closure E2E (live criteria E1-E7 + W1,W2,W3,W5,W7; W4/W6/W8/W9 package-level)',
    runStamp,
    harness: 'packages/tools/harness',
    worktree: WORKTREE_ROOT,
    hostTree: HOST_TREE,
    dshHome: DSH_HOME,
    dshHomeE: DSH_HOME_E,
    lock: null,
    selectedScenarios: args.selected,
    ports: { boot1: portA, boot2: portB, boot3: portC, boot4: portD, mcp: null, released: {} },
    stable3080: { before: null, after: null },
    pristine: { before: null, afterBuild: null, after: null },
    build: null,
    bypassScan: null,
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
    log(`P8-S3 harness ${pass ? 'PASS' : 'FAIL'} 鈥?summary: ${join(reportDir, 'summary.json')}`)
    process.exit(pass ? 0 : 1)
  }
  const noteFailure = (why) => {
    summary.failures.push(why)
    log(`FAILURE: ${why}`)
  }

  /** Release the lock only when its marker still names THIS run. */
  const releaseLock = () => {
    try {
      const marker = JSON.parse(readFileSync(LOCK_PATH, 'utf8'))
      if (marker !== null && typeof marker === 'object' && marker.runStamp === runStamp) {
        rmSync(LOCK_PATH, { force: true })
        log('postflight: lock released (own marker matched)')
      } else {
        noteFailure(`lock marker at ${LOCK_PATH} does not name this run (marker=${JSON.stringify(marker)}) 鈥?NOT removing it`)
      }
    } catch {
      /* lock file absent or unreadable: nothing to release */
    }
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
    // 鈹€鈹€ pre-flight: pristine tree, stable instance, ports 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
    summary.pristine.before = await captureGitState(HOST_TREE, logsDir)
    const beforeClean = summary.pristine.before.statusEmpty && summary.pristine.before.diffEmpty
    if (!beforeClean) throw new Error(`test-use tree not pristine before run: ${JSON.stringify(summary.pristine.before.errors)}`)
    log(`preflight: test-use tree pristine (head ${summary.pristine.before.head})`)

    summary.stable3080.before = await probeStableInstance()
    log(`preflight: stable :3080 ${JSON.stringify(summary.stable3080.before)}`)
    if (!(summary.stable3080.before.reachable === true && summary.stable3080.before.status === 200)) {
      throw new Error(`stable :3080 instance is not reachable/200 before the run 鈥?refusing to proceed (brief 搂6c)`)
    }

    if ((await portInUse(portA)) || (await portInUse(portB))) {
      throw new Error(`ports ${portA}/${portB} are already in use - aborting`)
    }
    if (eWorldUsed && ((await portInUse(portC)) || (await portInUse(portD)))) {
      throw new Error(`ports ${portC}/${portD} are already in use - aborting`)
    }

    // -- fresh task-specific DSH_HOMEs (fail-closed on non-fresh) + lock --
    // The W world (W1/W2/W3/W5/W7) runs against DSH_HOME; the E world
    // (E1-E7) runs against DSH_HOME_E, because the frozen per-template
    // quota of 4 makes E and W impossible in one durable team.
    // P8-S4B: an M/W-only run never creates or touches the E-world home.
    for (const home of [DSH_HOME, ...(eWorldUsed ? [DSH_HOME_E] : [])]) {
      if (existsSync(home) && readdirSync(home).length > 0) {
        throw new Error(`DSH_HOME ${home} exists and is not empty - the freshness rule forbids reusing it; aborting fail-closed`)
      }
      rmSync(home, { recursive: true, force: true })
      mkdirSync(home, { recursive: true })
      log(`preflight: fresh DSH_HOME created at ${home}`)
    }

    const lockMarker = { runStamp, pid: process.pid, startedAt: new Date().toISOString(), port: portA, dshHome: DSH_HOME, dshHomeE: DSH_HOME_E }
    try {
      writeFileSync(LOCK_PATH, JSON.stringify(lockMarker, null, 2), { flag: 'wx' })
      summary.lock = { path: LOCK_PATH, acquired: true, marker: lockMarker }
      log(`preflight: lock acquired at ${LOCK_PATH}`)
    } catch {
      let existing = null
      try {
        existing = JSON.parse(readFileSync(LOCK_PATH, 'utf8'))
      } catch {
        existing = null
      }
      summary.lock = { path: LOCK_PATH, acquired: false, existingMarker: existing }
      throw new Error(`lock file ${LOCK_PATH} is held (marker: ${existing === null ? 'unreadable' : JSON.stringify(existing)}) 鈥?another run is in progress; aborting fail-closed`)
    }

    // 鈹€鈹€ build artifacts (only when missing; TEST_METHODS 搂2 bypass chain) 鈹€鈹€
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
        // TEST_METHODS 搂3: build:web (vite 鈫?esbuild service spawn) is NOT
        // buildable in-sandbox (piped-stdio spawn EPERM) and does not affect
        // host-side functionality. Tolerate the failure ONLY when the
        // complete build:lib artifact set the harness needs is present.
        const missingAfterBuild = farm.filter((p) => !existsSync(join(p.dir, 'lib', 'index.js')))
        if (missingAfterBuild.length > 0) {
          throw new Error(`node scripts/build.ts failed and build:lib artifacts are missing: ${missingAfterBuild.map((p) => p.name).join(', ')} 鈥?${tailText(build.text)}`)
        }
        log('build:web failed in-sandbox (vite鈫抏sbuild spawn EPERM, documented in TEST_METHODS 搂3); build:lib artifacts complete 鈥?continuing')
        webSandboxLimited = true
      }
      summary.build = {
        required: true,
        missingBefore: missing.map((p) => p.name),
        installLog: 'logs/build-install.log',
        buildLog: 'logs/build-main.log',
        webSandboxLimited,
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

    // 鈹€鈹€ junction farm for bare specifiers (packages/node_modules) 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
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

    // 鈹€鈹€ mini MCP server (127.0.0.1, ports 3491-3495 candidates) 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
    mini = await startMiniMcpServer(args.mcpPorts)
    summary.ports.mcp = mini.port
    log(`mini MCP server up on 127.0.0.1:${mini.port}`)

    // 鈹€鈹€ driver core 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

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

    /** Drop one member child residency through the row's public route. */
    const dropResidencyHttp = async (ctx, port, sessionId) => {
      ctx.http.stateCalls += 1
      const { status, body } = await fetchJson(`http://127.0.0.1:${port}/__p6t6/residency/drop`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ sessionId }),
      }, 30_000)
      if (status !== 200) ctx.http.non200.push({ call: 'residency-drop', status, body: body === null ? null : JSON.stringify(body).slice(0, 400) })
      return { status, body }
    }

    /** One row health probe (no tool/state accounting). */
    const getHealth = async (port) => {
      const { status, body } = await fetchJson(`http://127.0.0.1:${port}/__p6t6/health`, {}, 10_000)
      return { status, body }
    }

    /**
     * P8-S4B: one durable governance mutation through the row's admission
     * route (the backend authority; the driver never touches a repository).
     * `payload.as` is the acting session id; the row derives the authority
     * server-side (root session -> operator, bound member -> member).
     */
    const mutateGovernance = async (ctx, port, payload) => {
      ctx.http.stateCalls += 1
      const { status, body } = await fetchJson(`http://127.0.0.1:${port}/__p6t6/governance/mutate`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      }, 30_000)
      if (status !== 200) ctx.http.non200.push({ call: 'governance-mutate', status, body: body === null ? null : JSON.stringify(body).slice(0, 400) })
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
      w1: { instanceId: null, childSessionId: null },
      // P8-S4B: cross-boot completion flags for the M chain.
      m: { m1: false, m2: false, m4: false },
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
      entry.reportFile = `${args.reportDir.replace(WORKTREE_ROOT, '').replace(/^[/\\]/, '')}/${fileName}`
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
      // P8-S4B: skipping an UNSELECTED scenario is normal (partial runs),
      // not a failure; only skipped-but-selected scenarios fail the verdict.
      if (selected(sc)) {
        noteFailure(`scenario ${sc}${phase !== undefined ? `(${phase})` : ''} skipped: ${reason}`)
      }
      return entry
    }

    // 鈹€鈹€ scenario implementations (driver-side; every action via /__p6t6/tool)

    /** Mirror of the row's child-session derivation (plugin.mjs childSidFor). */
    const childSidFor = (instanceId) => `session-child-p6t6-${String(instanceId).slice(5)}`

    /**
     * Decompress a multi-frame zstd stream (the durable session log format).
     * Each materialized append is a NEW zstd frame without a content size,
     * and node:zlib's zstdDecompressSync only decodes the FIRST frame of a
     * stream — so the frames are walked by magic and each chunk decompressed
     * separately. If a magic hit is spurious (inside a frame payload) the
     * chunk fails to decode and is merged with its successor.
     */
    const decompressZstdStream = (buf) => {
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

    /** Read one child session's durable log (multi-frame zstd) from the test DSH_HOME. */
    const readChildSessionLog = (sessionId) => {
      if (typeof sessionId !== 'string' || sessionId.length === 0) return null
      const sessionsRoot = join(DSH_HOME, 'sessions')
      if (!existsSync(sessionsRoot)) return null
      for (const profileDir of readdirSync(sessionsRoot)) {
        const file = join(sessionsRoot, profileDir, sessionId, 'session.jsonl.zstd')
        if (existsSync(file)) {
          try {
            return decompressZstdStream(readFileSync(file)).toString('utf8')
          } catch {
            return null
          }
        }
      }
      return null
    }

    /** Find one member row in a state snapshot (undefined when absent). */
    const findMember = (state, instanceId) =>
      state !== null && state !== undefined && Array.isArray(state.members)
        ? state.members.find((m) => m.instanceId === instanceId)
        : undefined

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
          : { rootSessionId: ROOT_SESSION_ID, requestToken: a.token, targetInstanceId: a.target, taskSummary: 'p6t6 e2 addressing probe', prompt: 'p6t6 e2 addressing probe' }
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
      const fu1 = await callTool(c, port, 'team_follow_up', { rootSessionId: ROOT_SESSION_ID, requestToken: 'p6t6-e3-1', targetInstanceId: w, taskSummary: 'p6t6 e3 first unit', prompt: 'p6t6 e3 first unit' }, ROOT_SESSION_ID)
      c.check('first follow-up executed on the existing instance', fu1.body?.ok === true && fu1.body?.value?.status === 'executed' && fu1.body?.value?.effect?.kind === 'work-admitted' && fu1.body?.value?.effect?.instanceId === w, JSON.stringify(fu1.body?.value).slice(0, 500))
      const seq1 = fu1.body?.value?.effect?.sequence
      const fu2 = await callTool(c, port, 'team_follow_up', { rootSessionId: ROOT_SESSION_ID, requestToken: 'p6t6-e3-2', targetInstanceId: w, taskSummary: 'p6t6 e3 second unit', prompt: 'p6t6 e3 second unit' }, ROOT_SESSION_ID)
      c.check('second follow-up executed on the SAME instance', fu2.body?.ok === true && fu2.body?.value?.status === 'executed' && fu2.body?.value?.effect?.kind === 'work-admitted' && fu2.body?.value?.effect?.instanceId === w, JSON.stringify(fu2.body?.value).slice(0, 500))
      const seq2 = fu2.body?.value?.effect?.sequence
      // P8-S3 settlement chain (R5, plan §16.6): each work unit now writes
      // MULTIPLE admission-ledger facts (admission, delivery-observed,
      // lifecycle SETTLED, activity interval), so the G6-era "+1 per
      // admission" encoding no longer holds. The meaningful invariant is
      // strict monotonicity ordered by settlement: the second admission may
      // only occur AFTER the first unit fully settled (the settlement owner
      // runs to completion before the next admit).
      const settle1 = fu1.body?.value?.effect?.settledSequence
      const settle2 = fu2.body?.value?.effect?.settledSequence
      c.check('the admission sequences advance strictly (second admit follows the first unit settlement)', Number.isInteger(seq1) && Number.isInteger(seq2) && Number.isInteger(settle1) && Number.isInteger(settle2) && seq1 >= 1 && settle1 > seq1 && seq2 > settle1 && settle2 > seq2, `seq1=${seq1} settle1=${settle1} seq2=${seq2} settle2=${settle2}`)
      const st1 = (await getState(c, port)).body
      const wAfter = st1?.members?.find((m) => m.instanceId === w)
      c.check('the bound child session id is UNCHANGED across follow-ups', wAfter?.childSessionId === wChild, `before=${wChild} after=${wAfter?.childSessionId}`)
      c.check('no new instance was created (six members)', st1?.members?.length === 6, JSON.stringify(st1?.members?.length))
      c.evidence = { w, wChild, sequences: [seq1, seq2], settledSequences: [settle1, settle2] }
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
          prompt: `p6t6 e4 delegation ${i}`,
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

      const fu1 = await callTool(c, port, 'team_follow_up', { rootSessionId: ROOT_SESSION_ID, requestToken: E5_CTRL_TOKEN, targetInstanceId: w, taskSummary: 'p6t6 e5 gated follow-up (boot 2)', prompt: 'p6t6 e5 gated follow-up (boot 2)' }, ROOT_SESSION_ID)
      const fu1Value = fu1.body?.value
      c.check('the guarded follow-up (same correlation token) EXECUTED — the persisted allow was consumed', fu1Value?.status === 'executed' && fu1Value?.effect?.kind === 'work-admitted' && fu1Value?.effect?.instanceId === w, JSON.stringify(fu1Value).slice(0, 500))
      const fu2 = await callTool(c, port, 'team_follow_up', { rootSessionId: ROOT_SESSION_ID, requestToken: E5_CTRL_TOKEN, targetInstanceId: w, taskSummary: 'p6t6 e5 retry of the consumed token', prompt: 'p6t6 e5 retry of the consumed token' }, ROOT_SESSION_ID)
      const fu2Value = fu2.body?.value
      c.check('retrying the SAME token is BLOCKED (allow-consumed, exactly-once)', fu2Value?.status === 'blocked' && fu2Value?.reason === 'allow-consumed' && fu2Value?.requestId === S.e5.requestId, JSON.stringify(fu2Value).slice(0, 500))
      const fu3 = await callTool(c, port, 'team_follow_up', { rootSessionId: ROOT_SESSION_ID, requestToken: 'p6t6-e5-ctrl3', targetInstanceId: w, taskSummary: 'p6t6 e5 fresh token after consumption', prompt: 'p6t6 e5 fresh token after consumption' }, ROOT_SESSION_ID)
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

    /** W1 (boot 1): delegate TOKEN_A -> a real Member Session receives it. */
    const runW1 = async ({ port }) => {
      const c = makeScenarioCtx('W1', undefined, 1)
      const st0 = (await getState(c, port)).body
      c.check('boot1 state: exactly the three seeded members (leader + worker + scout)', st0 !== null && Array.isArray(st0.members) && st0.members.length === 3, JSON.stringify(st0?.members ?? st0))
      const del = await callTool(c, port, 'team_delegate', {
        rootSessionId: ROOT_SESSION_ID,
        requestToken: W1_TOKEN,
        delegationTemplateId: 'worker',
        label: 'p8s3-w1-worker',
        prompt: W1_PROMPT,
      }, ROOT_SESSION_ID)
      const v = del.body?.value
      const eff = v?.effect
      c.check('delegate executed through the public tool seam', del.status === 200 && del.body?.ok === true && v?.status === 'executed' && v?.action === 'delegate', JSON.stringify(v).slice(0, 500))
      // Production semantics (context-policy M4, domain/member): the 'worker'
      // template is PERSISTENT (blueprint default) and exactly one worker
      // instance is work-accepting at this point, so the activation port
      // CONTINUES the seeded worker. The canonical W1 criterion (closure
      // plan 16.8) is that TOKEN_A reaches a REAL member Session with a real
      // settlement; new-instance minting is W3's fresh_per_delegation
      // criterion, not W1's.
      c.check('the persistent worker delegate CONTINUES the seeded worker with a real work settlement (no fake success)', eff?.kind === 'work-admitted' && eff?.instanceId === SEED_WORKER_ID && eff?.settled === true && eff?.replayed === false, JSON.stringify(eff).slice(0, 500))
      c.check('a RUNNING target needs no admission CAS (lifecycleCommitted=false)', eff?.fromLifecycle === 'RUNNING' && eff?.lifecycleCommitted === false, JSON.stringify({ from: eff?.fromLifecycle, committed: eff?.lifecycleCommitted }))
      c.check('the admission + settlement carry positive durable ledger sequences (admission before settlement)', typeof eff?.sequence === 'number' && eff.sequence > 0 && typeof eff?.settledSequence === 'number' && eff.settledSequence > eff.sequence, JSON.stringify({ seq: eff?.sequence, settledSeq: eff?.settledSequence }))
      const instanceId = eff?.instanceId
      const st1 = (await getState(c, port)).body
      const row0 = findMember(st1, instanceId)
      const childSessionId = row0?.childSessionId
      c.check('the target member row carries the seeded worker real child session id', typeof instanceId === 'string' && childSessionId === SEED_WORKER_CHILD, JSON.stringify({ i: instanceId, c: childSessionId }))
      c.check('the request token round-trips into the outcome', v?.requestToken === W1_TOKEN, JSON.stringify({ t: v?.requestToken }))
      S.w1 = { instanceId: instanceId === undefined ? null : instanceId, childSessionId: childSessionId === undefined ? null : childSessionId }
      c.check('state: the member count stays three (a persistent continue mints nothing)', st1 !== null && Array.isArray(st1.members) && st1.members.length === 3, JSON.stringify({ n: st1?.members?.length }))
      c.check('the seeded worker row is durably SETTLED at activityVersion 2 (RUNNING av1 -> settle-only CAS)', row0 !== undefined && row0.lifecycle === 'SETTLED' && row0.activityVersion === 2, JSON.stringify(row0))
      const logText = readChildSessionLog(S.w1.childSessionId)
      c.check('the real child Session log durably carries TOKEN_A + the exact prompt', logText !== null && logText.includes(W1_TOKEN) && logText.includes(W1_PROMPT), `logBytes=${logText === null ? 0 : logText.length}`)
      c.evidence = { effectKind: eff?.kind ?? null, memberCountAfter: st1?.members?.length ?? null, w1Row: row0 ?? null, w1LogBytes: logText === null ? 0 : logText.length }
      return recordScenario(c)
    }

    /** W5 (boot 1): follow-up on the seeded resident worker settles it. */
    const runW5 = async ({ port }) => {
      const c = makeScenarioCtx('W5', undefined, 1)
      const st0 = (await getState(c, port)).body
      const seed0 = findMember(st0, SEED_WORKER_ID)
      c.check('pre-state: seeded worker durably SETTLED at activityVersion 2 by the W1 delegate', seed0 !== undefined && seed0.lifecycle === 'SETTLED' && seed0.activityVersion === 2, JSON.stringify(seed0))
      const fu = await callTool(c, port, 'team_follow_up', {
        rootSessionId: ROOT_SESSION_ID,
        requestToken: W5_TOKEN,
        targetInstanceId: SEED_WORKER_ID,
        prompt: W5_PROMPT,
      }, ROOT_SESSION_ID)
      const v = fu.body?.value
      c.check('follow-up executed with the work-admitted effect', fu.status === 200 && fu.body?.ok === true && v?.status === 'executed' && v?.effect?.kind === 'work-admitted' && v?.effect?.instanceId === SEED_WORKER_ID, JSON.stringify(v).slice(0, 500))
      c.check('the SETTLED member re-admits via the durable CAS (lifecycleCommitted=true) and settles', v?.effect?.fromLifecycle === 'SETTLED' && v?.effect?.lifecycleCommitted === true && v?.effect?.settled === true && v?.effect?.replayed === false, JSON.stringify(v?.effect).slice(0, 500))
      const st1 = (await getState(c, port)).body
      const seed1 = findMember(st1, SEED_WORKER_ID)
      c.check('row durably SETTLED at activityVersion 4 (admit av2->av3, settle av3->av4)', seed1 !== undefined && seed1.lifecycle === 'SETTLED' && seed1.activityVersion === 4, JSON.stringify(seed1))
      const rows = (st1?.activity ?? []).filter((a) => a.requestToken === W5_TOKEN && a.instanceId === SEED_WORKER_ID && a.subject === 'work-unit')
      const open = rows.find((a) => a.op === 'interval-open')
      const close = rows.find((a) => a.op === 'interval-close')
      c.check('the work-unit activity interval opened (in-progress) and closed (completed)', open !== undefined && close !== undefined && open.progress === 'in-progress' && close.progress === 'completed' && close.sequence > open.sequence, JSON.stringify(rows).slice(0, 600))
      c.check('the interval correlates to the request token', open?.correlation === W5_TOKEN, JSON.stringify({ corr: open?.correlation }))
      const logText = readChildSessionLog(SEED_WORKER_CHILD)
      c.check('the seeded worker child log durably carries the token + prompt', logText !== null && logText.includes(W5_TOKEN) && logText.includes(W5_PROMPT), `logBytes=${logText === null ? 0 : logText.length}`)
      c.evidence = { seedRowAfter: seed1 ?? null, intervalRows: rows, w5LogBytes: logText === null ? 0 : logText.length }
      return recordScenario(c)
    }

    /** W7 (boot 1): residency drop -> cold resume lands on the SAME session. */
    const runW7 = async ({ port }) => {
      const c = makeScenarioCtx('W7', undefined, 1)
      c.check('W1 state available (W1 executed on this boot)', S.w1.instanceId !== null && S.w1.childSessionId !== null, JSON.stringify(S.w1))
      const drop = await dropResidencyHttp(c, port, S.w1.childSessionId)
      c.check('residency drop route reports a real dispose', drop.status === 200 && drop.body?.dropped === true && drop.body?.sessionId === S.w1.childSessionId, JSON.stringify(drop.body))
      const health = (await getHealth(port)).body
      c.check('the member is no longer resident (health liveSessions)', health !== null && health !== undefined && Array.isArray(health.liveSessions) && health.liveSessions.includes(S.w1.childSessionId) === false, JSON.stringify(health?.liveSessions))
      const fu = await callTool(c, port, 'team_follow_up', {
        rootSessionId: ROOT_SESSION_ID,
        requestToken: W7_TOKEN,
        targetInstanceId: S.w1.instanceId,
        prompt: W7_PROMPT,
      }, ROOT_SESSION_ID)
      const v = fu.body?.value
      c.check('cold-resume follow-up executed with the work-admitted effect', fu.status === 200 && fu.body?.ok === true && v?.status === 'executed' && v?.effect?.kind === 'work-admitted' && v?.effect?.instanceId === S.w1.instanceId, JSON.stringify(v).slice(0, 500))
      c.check('a SETTLED member re-admits via the durable CAS and settles', v?.effect?.fromLifecycle === 'SETTLED' && v?.effect?.lifecycleCommitted === true && v?.effect?.settled === true, JSON.stringify(v?.effect).slice(0, 500))
      const st1 = (await getState(c, port)).body
      const row = findMember(st1, S.w1.instanceId)
      c.check('row SETTLED at activityVersion 6 on the SAME child session (admit av4->av5, settle av5->av6)', row !== undefined && row.lifecycle === 'SETTLED' && row.activityVersion === 6 && row.childSessionId === S.w1.childSessionId, JSON.stringify(row))
      const logText = readChildSessionLog(S.w1.childSessionId)
      c.check('the SAME durable log now carries the W1 + W7 tokens (cold resume, not a new session)', logText !== null && logText.includes(W1_TOKEN) && logText.includes(W7_TOKEN), `logBytes=${logText === null ? 0 : logText.length}`)
      c.evidence = { w1RowAfter: row ?? null, w1LogBytes: logText === null ? 0 : logText.length }
      return recordScenario(c)
    }

    /** W3 (boot 1): two fresh_per_delegation delegates -> two new sessions. */
    const runW3 = async ({ port }) => {
      const c = makeScenarioCtx('W3', undefined, 1)
      const delC = await callTool(c, port, 'team_delegate', {
        rootSessionId: ROOT_SESSION_ID,
        requestToken: W3_C_TOKEN,
        delegationTemplateId: 'scout',
        label: 'p8s3-w3-scout-c',
        prompt: W3_C_PROMPT,
      }, ROOT_SESSION_ID)
      const delD = await callTool(c, port, 'team_delegate', {
        rootSessionId: ROOT_SESSION_ID,
        requestToken: W3_D_TOKEN,
        delegationTemplateId: 'scout',
        label: 'p8s3-w3-scout-d',
        prompt: W3_D_PROMPT,
      }, ROOT_SESSION_ID)
      const vc = delC.body?.value
      const vd = delD.body?.value
      c.check('both delegates executed and work-settled', vc?.status === 'executed' && vc?.effect?.workSettled === true && vd?.status === 'executed' && vd?.effect?.workSettled === true, JSON.stringify({ c: vc?.status, d: vd?.status }))
      const idC = vc?.effect?.instanceId
      const idD = vd?.effect?.instanceId
      c.check('two DISTINCT member instances (fresh_per_delegation)', typeof idC === 'string' && typeof idD === 'string' && idC !== idD, JSON.stringify({ c: idC, d: idD }))
      c.check('two DISTINCT child sessions, each derived from its instance', vc?.effect?.childSessionId === childSidFor(idC) && vd?.effect?.childSessionId === childSidFor(idD) && vc?.effect?.childSessionId !== vd?.effect?.childSessionId, JSON.stringify({ c: vc?.effect?.childSessionId, d: vd?.effect?.childSessionId }))
      const st1 = (await getState(c, port)).body
      const rowC = findMember(st1, idC)
      const rowD = findMember(st1, idD)
      c.check('state: five members (no W1 mint; W1 continued the seed), both fresh scouts SETTLED at activityVersion 3', st1 !== null && st1.members.length === 5 && rowC?.lifecycle === 'SETTLED' && rowC?.activityVersion === 3 && rowD?.lifecycle === 'SETTLED' && rowD?.activityVersion === 3, JSON.stringify({ n: st1?.members?.length, c: rowC, d: rowD }).slice(0, 600))
      const logC = readChildSessionLog(vc?.effect?.childSessionId)
      const logD = readChildSessionLog(vd?.effect?.childSessionId)
      c.check('both fresh child Session logs durably carry their tokens', logC !== null && logC.includes(W3_C_TOKEN) && logD !== null && logD.includes(W3_D_TOKEN), `bytesC=${logC === null ? 0 : logC.length} bytesD=${logD === null ? 0 : logD.length}`)
      S.memberIdsBoot1Final = st1?.members === undefined ? null : st1.members.map((m) => m.instanceId)
      c.evidence = { memberCountAfter: st1?.members?.length ?? null, rowC: rowC ?? null, rowD: rowD ?? null }
      return recordScenario(c)
    }

    /** W2 (boot 2): persistent follow-up lands on the SAME child session. */
    const runW2 = async ({ port }) => {
      const c = makeScenarioCtx('W2', undefined, 2)
      c.check('W1 state available (W1 executed on boot 1)', S.w1.instanceId !== null && S.w1.childSessionId !== null, JSON.stringify(S.w1))
      const st0 = (await getState(c, port)).body
      const ids0 = st0 !== null && Array.isArray(st0.members) ? st0.members.map((m) => m.instanceId) : []
      c.check('boot2 state: the same five members survive the process restart', st0 !== null && st0.members.length === 5 && S.memberIdsBoot1Final !== null && JSON.stringify([...ids0].sort()) === JSON.stringify([...S.memberIdsBoot1Final].sort()), JSON.stringify({ n: ids0.length, expected: S.memberIdsBoot1Final }))
      const row0 = findMember(st0, S.w1.instanceId)
      c.check('the W1 row survived SETTLED on its original child session', row0 !== undefined && row0.lifecycle === 'SETTLED' && row0.childSessionId === S.w1.childSessionId, JSON.stringify(row0))
      const fu = await callTool(c, port, 'team_follow_up', {
        rootSessionId: ROOT_SESSION_ID,
        requestToken: W2_TOKEN,
        targetInstanceId: S.w1.instanceId,
        prompt: W2_PROMPT,
      }, ROOT_SESSION_ID)
      const v = fu.body?.value
      c.check('persistent follow-up executed with the work-admitted effect', fu.status === 200 && fu.body?.ok === true && v?.status === 'executed' && v?.effect?.kind === 'work-admitted' && v?.effect?.instanceId === S.w1.instanceId, JSON.stringify(v).slice(0, 500))
      c.check('the SETTLED member re-admits via the durable CAS and settles again', v?.effect?.fromLifecycle === 'SETTLED' && v?.effect?.lifecycleCommitted === true && v?.effect?.settled === true, JSON.stringify(v?.effect).slice(0, 500))
      const st1 = (await getState(c, port)).body
      const row1 = findMember(st1, S.w1.instanceId)
      c.check('row SETTLED at activityVersion 8 on the SAME childSessionId (admit av6->av7, settle av7->av8; no new session)', row1 !== undefined && row1.lifecycle === 'SETTLED' && row1.activityVersion === 8 && row1.childSessionId === S.w1.childSessionId, JSON.stringify(row1))
      const logText = readChildSessionLog(S.w1.childSessionId)
      c.check('the same durable log carries W1 + W7 + W2 tokens across the restart', logText !== null && logText.includes(W1_TOKEN) && logText.includes(W7_TOKEN) && logText.includes(W2_TOKEN), `logBytes=${logText === null ? 0 : logText.length}`)
      c.evidence = { w1RowAfter: row1 ?? null, w1LogBytes: logText === null ? 0 : logText.length }
      return recordScenario(c)
    }

    // ── P8-S4B scenarios: durable mutation -> actual future agent behavior ──
    // The M scenarios drive the SEEDED worker (inst-p6t6seedw1 /
    // session-child-p6t6seedw1) - a real member Session whose NEXT requests
    // must run on the mutated durable truth. Every mutation acts `as` the
    // ROOT session: the row maps that to operator authority, i.e.
    // human-override records - the only v1 authority that can GRANT a cell
    // (frozen empty-envelope ruling: autonomy-overlay grants are rejected).

    /** A tool call counts as blocked/absent (never silently allowed). */
    const toolUnavailable = (r) =>
      (r.status === 500 && typeof r.body?.error === 'string' && r.body.error.includes('unknown tool')) ||
      (r.status === 200 && r.body?.ok === false)

    /** One real follow-up turn into the seeded worker, issued by the root. */
    const workerFollowUp = async (c, port, token, prompt) => {
      const fu = await callTool(c, port, 'team_follow_up', {
        rootSessionId: ROOT_SESSION_ID,
        requestToken: token,
        targetInstanceId: SEED_WORKER_ID,
        prompt,
      }, ROOT_SESSION_ID)
      const v = fu.body?.value
      const ok = fu.status === 200 && fu.body?.ok === true && v?.status === 'executed' && v?.effect?.kind === 'work-admitted' && v?.effect?.instanceId === SEED_WORKER_ID
      return { fu, v, ok }
    }

    /**
     * M1 (boot 1, baseline): a real turn on the seeded worker assembles the
     * world-default model A; provenance says "unspecified" (the Team did
     * not speak). The token reaches the durable member session log.
     */
    const runM1 = async ({ port }) => {
      const c = makeScenarioCtx('M1', undefined, 1)
      const { ok, v } = await workerFollowUp(c, port, M1_TOKEN, M1_PROMPT)
      c.check('follow-up executed against the seeded worker (real member turn)', ok, JSON.stringify(v).slice(0, 500))
      const st = (await getState(c, port)).body
      const w = st?.governance?.sessions?.[SEED_WORKER_CHILD]
      c.check('worker model CURRENT = world-default A (no Team override yet)', w?.model?.current !== null && w.model.current.provider === M_MODEL_A.provider && w.model.current.model === M_MODEL_A.model, JSON.stringify(w?.model ?? w ?? st))
      c.check('the real turn ASSEMBLED model A (live selection evidence)', w?.model?.assembled !== null && w.model.assembled.provider === M_MODEL_A.provider && w.model.assembled.model === M_MODEL_A.model, JSON.stringify(w?.model?.assembled ?? null))
      c.check('provenance: the model cell is team-unspecified (static baseline, not silently granted)', w?.model?.source !== undefined && w.model.source.layer === 'unspecified' && w.model.source.recordId === null, JSON.stringify(w?.model?.source ?? null))
      const logText = readChildSessionLog(SEED_WORKER_CHILD)
      c.check('the M1 token reached the durable member session log', logText !== null && logText.includes(M1_TOKEN), `logBytes=${logText === null ? 0 : logText.length}`)
      c.evidence = { workerModelAfter: w?.model ?? null }
      S.m.m1 = true
      return recordScenario(c)
    }

    /**
     * M2 (boot 1, model A -> B): an authorized team-scope human-override
     * grants model B. BEFORE any request the backend truth lists the new
     * record in pendingNextBoundary (§18.3); the NEXT real request
     * assembles B and carries the granting record in its provenance source.
     */
    const runM2 = async ({ port }) => {
      const c = makeScenarioCtx('M2', undefined, 1)
      c.check('M1 ran first (the baseline turn)', S.m.m1 === true, JSON.stringify(S.m))
      const mu = await mutateGovernance(c, port, {
        as: ROOT_SESSION_ID,
        recordId: M_RECORD_MODEL,
        scope: 'team',
        cells: { model: { kind: 'allow', items: ['p6t6-static/p6t6-model-v2'] } },
      })
      const mv = mu.body?.value
      c.check('operator mutation admitted (human-override, generation 1)', mu.status === 200 && mu.body?.ok === true && mv?.recordId === M_RECORD_MODEL && mv?.kind === 'human-override' && mv?.generation === 1, JSON.stringify(mu.body ?? mu.status).slice(0, 500))
      const stPending = (await getState(c, port)).body
      const wPending = stPending?.governance?.sessions?.[SEED_WORKER_CHILD]
      const pendingIds = Array.isArray(wPending?.model?.pendingNextBoundary) ? wPending.model.pendingNextBoundary.map((p) => p.recordId) : []
      c.check('BEFORE any request: the backend truth lists the new record in pendingNextBoundary', pendingIds.includes(M_RECORD_MODEL) === true, JSON.stringify(pendingIds))
      const { ok, v } = await workerFollowUp(c, port, M2_TOKEN, M2_PROMPT)
      c.check('the NEXT real request executed against the worker', ok, JSON.stringify(v).slice(0, 500))
      const st = (await getState(c, port)).body
      const w = st?.governance?.sessions?.[SEED_WORKER_CHILD]
      c.check('worker model CURRENT switched to B at the boundary', w?.model?.current !== null && w.model.current.provider === M_MODEL_B.provider && w.model.current.model === M_MODEL_B.model, JSON.stringify(w?.model?.current ?? null))
      c.check('the real turn ASSEMBLED model B (live evidence: the next request runs on B)', w?.model?.assembled !== null && w.model.assembled.provider === M_MODEL_B.provider && w.model.assembled.model === M_MODEL_B.model, JSON.stringify(w?.model?.assembled ?? null))
      c.check('provenance source names the granting human-override record', w?.model?.source !== undefined && w.model.source.layer === 'humanOverride' && w.model.source.origin === 'human' && w.model.source.recordId === M_RECORD_MODEL, JSON.stringify(w?.model?.source ?? null))
      c.evidence = { mutation: mv ?? null, pendingBefore: pendingIds, workerModelAfter: w?.model ?? null }
      S.m.m2 = true
      return recordScenario(c)
    }

    /**
     * M4 (boot 1, after M2, capability facet `mcp`): baseline the tool is
     * ABSENT (never silently allowed); a durable allow mounts the real
     * mini-MCP (one tool: ping -> pong); a durable deny unmounts it again,
     * with team provenance (layer/origin/recordId) on the denied cell.
     */
    const runM4 = async ({ port }) => {
      const c = makeScenarioCtx('M4', undefined, 1)
      c.check('M2 ran first (the cumulative humanOverride slot)', S.m.m2 === true, JSON.stringify(S.m))
      // (a) baseline: the durable policy is silent on mcp -> fail-closed absent
      const ping0 = await callTool(c, port, M4_PING_TOOL, { msg: M4_PING_MSG_ALLOW }, SEED_WORKER_CHILD)
      c.check('baseline: the mcp tool is ABSENT for the worker (never silently allowed)', toolUnavailable(ping0), JSON.stringify({ status: ping0.status, body: ping0.body === null ? null : JSON.stringify(ping0.body).slice(0, 300) }))
      // (b) durable allow; cumulative re-issue must preserve the model grant
      const muAllow = await mutateGovernance(c, port, {
        as: ROOT_SESSION_ID,
        recordId: M_RECORD_MCP_ALLOW,
        scope: 'team',
        cells: { mcp: { kind: 'allow', items: [M4_MCP_SERVER] } },
      })
      const mvAllow = muAllow.body?.value
      c.check('operator mcp-allow admitted (generation 2, model grant preserved in the re-issue)', muAllow.status === 200 && muAllow.body?.ok === true && mvAllow?.recordId === M_RECORD_MCP_ALLOW && mvAllow?.generation === 2 && mvAllow?.values?.model !== undefined, JSON.stringify(muAllow.body ?? muAllow.status).slice(0, 500))
      const stPending = (await getState(c, port)).body
      const wPending = stPending?.governance?.sessions?.[SEED_WORKER_CHILD]
      const mcpPendingIds = Array.isArray(wPending?.mcp?.pendingNextBoundary) ? wPending.mcp.pendingNextBoundary.map((p) => p.recordId) : []
      c.check('BEFORE the next operation: pendingNextBoundary lists the mcp-allow record', mcpPendingIds.includes(M_RECORD_MCP_ALLOW) === true, JSON.stringify(mcpPendingIds))
      // (c) the next real operation: the tool is present and round-trips
      const ping1 = await callTool(c, port, M4_PING_TOOL, { msg: M4_PING_MSG_ALLOW }, SEED_WORKER_CHILD)
      c.check('after the boundary the mcp tool EXECUTES: pong round-trip against the real mini-MCP', ping1.status === 200 && ping1.body?.ok === true && JSON.stringify(ping1.body?.value ?? null).includes('pong:') === true, JSON.stringify({ status: ping1.status, body: ping1.body === null ? null : JSON.stringify(ping1.body).slice(0, 300) }))
      const stAllow = (await getState(c, port)).body
      const wAllow = stAllow?.governance?.sessions?.[SEED_WORKER_CHILD]
      c.check('state: the mcp facet is MOUNTED, sourced from the granting record', wAllow?.mcp?.mounted === true && wAllow?.mcp?.allowed === true && wAllow?.mcp?.source?.recordId === M_RECORD_MCP_ALLOW, JSON.stringify(wAllow?.mcp ?? null).slice(0, 500))
      // (d) durable deny (tighten); generation 3, model grant still preserved
      const muDeny = await mutateGovernance(c, port, {
        as: ROOT_SESSION_ID,
        recordId: M_RECORD_MCP_DENY,
        scope: 'team',
        cells: { mcp: { kind: 'deny' } },
      })
      const mvDeny = muDeny.body?.value
      c.check('operator mcp-deny admitted (generation 3, model grant preserved)', muDeny.status === 200 && muDeny.body?.ok === true && mvDeny?.recordId === M_RECORD_MCP_DENY && mvDeny?.generation === 3 && mvDeny?.values?.model !== undefined, JSON.stringify(muDeny.body ?? muDeny.status).slice(0, 500))
      // (e) the next real operation: the tool is ABSENT again (fail-closed)
      const ping2 = await callTool(c, port, M4_PING_TOOL, { msg: M4_PING_MSG_DENY }, SEED_WORKER_CHILD)
      c.check('after the deny boundary the mcp tool is ABSENT again (never silently allowed)', toolUnavailable(ping2), JSON.stringify({ status: ping2.status, body: ping2.body === null ? null : JSON.stringify(ping2.body).slice(0, 300) }))
      const st = (await getState(c, port)).body
      const w = st?.governance?.sessions?.[SEED_WORKER_CHILD]
      c.check('state: the mcp facet is UNMOUNTED and the cell is team-denied by the deny record', w?.mcp?.mounted === false && w?.mcp?.allowed === false && w?.mcp?.deniedBy?.by === 'team' && w?.mcp?.deniedBy?.recordId === M_RECORD_MCP_DENY && w?.mcp?.source?.recordId === M_RECORD_MCP_DENY, JSON.stringify(w?.mcp ?? null).slice(0, 500))
      c.evidence = {
        pingBaseline: { status: ping0.status, body: ping0.body === null ? null : JSON.stringify(ping0.body).slice(0, 300) },
        pingAllow: { status: ping1.status, body: ping1.body === null ? null : JSON.stringify(ping1.body).slice(0, 300) },
        pingDeny: { status: ping2.status, body: ping2.body === null ? null : JSON.stringify(ping2.body).slice(0, 300) },
        workerMcpAfter: w?.mcp ?? null,
      }
      S.m.m4 = true
      return recordScenario(c)
    }

    /**
     * M3 (boot 2, restart-effective model): the SAME durable team in a NEW
     * host process: the next real request still assembles model B (durable
     * truth, not projection state), and the durable member log carries the
     * M1+M2+M3 tokens across the restart.
     */
    const runM3 = async ({ port }) => {
      const c = makeScenarioCtx('M3', undefined, 2)
      c.check('M1+M2 ran on boot 1 (the A->B mutation landed)', S.m.m1 === true && S.m.m2 === true, JSON.stringify(S.m))
      const { ok, v } = await workerFollowUp(c, port, M3_TOKEN, M3_PROMPT)
      c.check('the next real request (fresh host process) executed against the worker', ok, JSON.stringify(v).slice(0, 500))
      const st = (await getState(c, port)).body
      const w = st?.governance?.sessions?.[SEED_WORKER_CHILD]
      c.check('AFTER host restart the real turn still ASSEMBLES model B', w?.model?.assembled !== null && w.model.assembled.provider === M_MODEL_B.provider && w.model.assembled.model === M_MODEL_B.model, JSON.stringify(w?.model?.assembled ?? null))
      c.check('provenance source still names a durable human-override (layer+origin stable across re-issues)', w?.model?.source !== undefined && w.model.source.layer === 'humanOverride' && w.model.source.origin === 'human', JSON.stringify(w?.model?.source ?? null))
      const logText = readChildSessionLog(SEED_WORKER_CHILD)
      c.check('the durable member log carries M1+M2+M3 tokens across the restart', logText !== null && logText.includes(M1_TOKEN) && logText.includes(M2_TOKEN) && logText.includes(M3_TOKEN), `logBytes=${logText === null ? 0 : logText.length}`)
      c.evidence = { workerModelAfter: w?.model ?? null }
      return recordScenario(c)
    }

    /**
     * M5 (boot 2, restart-effective mcp deny): in the NEW host process the
     * durable deny is still in force - the next real operation finds the
     * tool absent, the three durable overrides survived, and the model
     * grant (carried by the latest re-issue) still selects B.
     */
    const runM5 = async ({ port }) => {
      const c = makeScenarioCtx('M5', undefined, 2)
      c.check('M4 ran on boot 1 (the mcp deny landed)', S.m.m4 === true, JSON.stringify(S.m))
      const { ok, v } = await workerFollowUp(c, port, M5_TOKEN, M5_PROMPT)
      c.check('the next real request (fresh host process) executed against the worker', ok, JSON.stringify(v).slice(0, 500))
      const st0 = (await getState(c, port)).body
      const w0 = st0?.governance?.sessions?.[SEED_WORKER_CHILD]
      c.check('AFTER restart the worker still ASSEMBLES model B (the carried grant)', w0?.model?.assembled !== null && w0.model.assembled.provider === M_MODEL_B.provider && w0.model.assembled.model === M_MODEL_B.model, JSON.stringify(w0?.model?.assembled ?? null))
      const ping = await callTool(c, port, M4_PING_TOOL, { msg: M4_PING_MSG_DENY }, SEED_WORKER_CHILD)
      c.check('AFTER restart the mcp tool is STILL ABSENT (the durable deny remains effective)', toolUnavailable(ping), JSON.stringify({ status: ping.status, body: ping.body === null ? null : JSON.stringify(ping.body).slice(0, 300) }))
      const st = (await getState(c, port)).body
      const w = st?.governance?.sessions?.[SEED_WORKER_CHILD]
      c.check('state: mcp facet unmounted, team-denied by the deny record', w?.mcp?.mounted === false && w?.mcp?.allowed === false && w?.mcp?.deniedBy?.by === 'team' && w?.mcp?.deniedBy?.recordId === M_RECORD_MCP_DENY && w?.mcp?.source?.recordId === M_RECORD_MCP_DENY, JSON.stringify(w?.mcp ?? null).slice(0, 500))
      const recIds = Array.isArray(st?.governance?.overrides) ? st.governance.overrides.map((r) => r.recordId).sort() : []
      c.check('the THREE durable override records survived the restart', JSON.stringify(recIds) === JSON.stringify([M_RECORD_MODEL, M_RECORD_MCP_ALLOW, M_RECORD_MCP_DENY].sort()), JSON.stringify(recIds))
      c.evidence = { ping: { status: ping.status, body: ping.body === null ? null : JSON.stringify(ping.body).slice(0, 300) }, workerModelAfter: w0?.model ?? null, workerMcpAfter: w?.mcp ?? null, overrideRecordIds: recIds }
      return recordScenario(c)
    }

    // 鈹€鈹€ the boot driver 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€

    const ROW = { id: 'p6t6-team-tools', name: pathToFileURL(join(HERE, 'plugin.mjs')).href }

    /**
     * One boot: mount the row through the public patch seam, start, verify
     * the row mount via dump-config, poll row health, drive the scenario
     * plan, then stop (boot 1's stop is the process-restart boundary W2
     * reads through).
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
        dshHome: opts.dshHome,
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
          `P8-S3 harness patch layer (boot ${boot}): ${ROW.id} mounted ONLY through this public profile-patch seam.`,
        ])
        writeFileSync(join(opts.dshHome, 'p6t6-directive.json'), JSON.stringify(opts.directive, null, 2))
        log(`boot ${boot}: directive written to ${join(opts.dshHome, 'p6t6-directive.json')}`)
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
        if (!mounted) noteFailure(`boot ${boot}: row ${ROW.id} not present in dump-config 鈥?the public patch seam did not mount the plugin`)

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
            log(`boot ${boot}: ready 鈥?toolCount=${hb.toolCount} liveSessions=${(hb.liveSessions ?? []).length} (expected ${EXPECTED_TOOL_COUNT} tools)`)
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
              : `row routes not ready on boot ${boot} 鈥?scenario not executed against a dead row`)
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

    // -- the boot plan -------------------------------------------------------
    // E7 first (static; no instance involved), then the W world (boots 1-2
    // on DSH_HOME) and the E world (boots 3-4 on DSH_HOME_E).
    if (runnable('E7')) {
      await runE7()
    } else if (selected('E7')) {
      skipEntry('E7', undefined, undefined, 'dependency not selected')
    }

    const directiveFor = (boot) => ({
      boot,
      phase: boot === 1 || boot === 3 ? 'create' : 'resume',
      reportDir,
      runStamp,
      rootSessionId: ROOT_SESSION_ID,
      mcpPort: mini.port,
    })

    const boot1Plan = [
      { criterion: 'W1', phase: undefined, runnable: runnable('W1'), skipReason: 'dependency not selected', run: (o) => runW1(o) },
      { criterion: 'W5', phase: undefined, runnable: runnable('W5'), skipReason: 'dependency not selected', run: (o) => runW5(o) },
      { criterion: 'W7', phase: undefined, runnable: runnable('W7'), skipReason: 'requires W1 (its member) - W1 not selected', run: (o) => runW7(o) },
      { criterion: 'W3', phase: undefined, runnable: runnable('W3'), skipReason: 'dependency not selected', run: (o) => runW3(o) },
      // P8-S4B: M1 (baseline model A assembled) -> M2 (model A->B mutation
      // + pendingNextBoundary) -> M4 (mcp facet: fail-closed baseline,
      // allow grants the tool, deny unmounts it) run in this order.
      { criterion: 'M1', phase: undefined, runnable: runnable('M1'), skipReason: 'dependency not selected', run: (o) => runM1(o) },
      { criterion: 'M2', phase: undefined, runnable: runnable('M2'), skipReason: 'dependency not selected', run: (o) => runM2(o) },
      { criterion: 'M4', phase: undefined, runnable: runnable('M4'), skipReason: 'requires M2 (cumulative humanOverride slot) - M2 not selected', run: (o) => runM4(o) },
    ]
    summary.boots.boot1 = await driveBoot(1, portA, {
      dshHome: DSH_HOME,
      directive: directiveFor(1),
      plan: boot1Plan,
    })

    const boot2Plan = [
      { criterion: 'W2', phase: undefined, runnable: runnable('W2'), skipReason: 'requires W1 (its member) - W1 not selected', run: (o) => runW2(o) },
      // P8-S4B: boot2 = fresh host process, same durable team home:
      // M3 (restart-effective model B) then M5 (restart-effective mcp deny).
      { criterion: 'M3', phase: undefined, runnable: runnable('M3'), skipReason: 'requires M1+M2 (the A->B mutation) - not selected', run: (o) => runM3(o) },
      { criterion: 'M5', phase: undefined, runnable: runnable('M5'), skipReason: 'requires M4 (the mcp deny) - not selected', run: (o) => runM5(o) },
    ]
    summary.boots.boot2 = await driveBoot(2, portB, {
      dshHome: DSH_HOME,
      directive: directiveFor(2),
      plan: boot2Plan,
    })

    // P8-S4B: boots 3-4 serve the E world (DSH_HOME_E) only; an M/W-only
    // run skips them entirely (ports + home stay untouched).
    if (eWorldUsed) {
      const boot3Plan = [
        { criterion: 'E1', phase: undefined, runnable: runnable('E1'), skipReason: 'dependency not selected', run: (o) => runE1(o) },
        { criterion: 'E2', phase: undefined, runnable: runnable('E2'), skipReason: 'requires E1 (its labels) - E1 not selected', run: (o) => runE2(o) },
        { criterion: 'E3', phase: undefined, runnable: runnable('E3'), skipReason: 'requires E1 (its worker) - E1 not selected', run: (o) => runE3(o) },
        { criterion: 'E4', phase: undefined, runnable: runnable('E4'), skipReason: 'dependency not selected', run: (o) => runE4(o) },
        { criterion: 'E6', phase: undefined, runnable: runnable('E6'), skipReason: 'requires E4 (scout count 3) - E4 not selected', run: (o) => runE6(o) },
        { criterion: 'E5', phase: 'boot1-writes', runnable: runnable('E5'), skipReason: 'requires E1 (its worker) - E1 not selected', run: (o) => runE5a(o) },
      ]
      summary.boots.boot3 = await driveBoot(3, portC, {
        dshHome: DSH_HOME_E,
        directive: directiveFor(3),
        plan: boot3Plan,
      })
      if (runnable('E5') && (summary.scenarios.E5?.phases?.['boot1-writes'] === undefined)) {
        noteFailure('E5 boot-1 write phase did not record an entry')
      }

      const boot4Plan = [
        { criterion: 'E5', phase: 'boot2-restart', runnable: runnable('E5'), skipReason: 'requires E1 (its worker) - E1 not selected', run: (o) => runE5b(o) },
      ]
      summary.boots.boot4 = await driveBoot(4, portD, {
        dshHome: DSH_HOME_E,
        directive: directiveFor(4),
        plan: boot4Plan,
      })
    }

    // 鈹€鈹€ postflight hygiene: the committed static bypass scan (no boot) 鈹€鈹€鈹€鈹€鈹€鈹€鈹€
    {
      const scanner = await import(pathToFileURL(join(HERE, '..', 'test', 'p6t6-bypass-scan.mjs')).href)
      const scan = await scanner.scanToolsBypass()
      summary.bypassScan = {
        files: scan.files,
        totalImportSpecifiers: scan.totalImportSpecifiers,
        totalViolations: scan.totalViolations,
        violations: scan.violations,
      }
      log(`postflight: bypass scan files=${scan.files.length} violations=${scan.totalViolations}`)
      if (JSON.stringify(scan.files) !== JSON.stringify(EXPECTED_SCAN_FILES)) {
        noteFailure(`bypass scan covers ${JSON.stringify(scan.files)} (expected ${JSON.stringify(EXPECTED_SCAN_FILES)})`)
      }
      if (scan.totalViolations !== 0) {
        noteFailure(`bypass scan found ${scan.totalViolations} violation(s): ${JSON.stringify(scan.violations).slice(0, 600)}`)
      }
    }

    // 鈹€鈹€ post-flight: mini MCP, ports, pristine, stable instance 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
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

    // 鈹€鈹€ verdict 鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€鈹€
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
    // P8-S4B: only verdict the boots this run actually performed.
    const VERDICT_BOOTS = eWorldUsed ? ['boot1', 'boot2', 'boot3', 'boot4'] : ['boot1', 'boot2']
    for (const boot of VERDICT_BOOTS) {
      if (summary.rowMounted[`${ROW.id}-${boot}`] !== true) noteFailure(`${ROW.id} not mounted via the public patch seam on ${boot}`)
    }
    for (const boot of VERDICT_BOOTS) {
      if (summary.ports.released[boot] === false) noteFailure(`${boot} port not released`)
    }
    if (summary.ports.released.mcp === false) noteFailure('mini MCP port not released')
    for (const hb of Object.values(summary.boots)) {
      if (hb?.healthBefore?.ok === true && hb.healthBefore.toolCount !== EXPECTED_TOOL_COUNT) {
        noteFailure(`${hb.port}: health reports ${hb.healthBefore.toolCount} tools (expected ${EXPECTED_TOOL_COUNT})`)
      }
    }

    releaseLock()
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
    releaseLock()
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
  console.error(`P8-S3 harness fatal: ${error?.stack ?? error}`)
  process.exit(1)
})
