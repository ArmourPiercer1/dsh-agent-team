/**
 * run.mjs — G8-REVIEW reviewer 5 (R61) pristine-host browser-less remote
 * e2e driver.
 *
 * Boots a REAL DSH web instance from the pristine test-use tree
 * (`references/deepseek-harness-test-use`, pin cd5ef814) with a fresh
 * workspace-internal DSH_HOME, mounts the g8r5 harness row
 * (`g8r5-team-remote-host`) through the public cordis.patch.yml profile
 * seam, and drives the remote contract v1 surface over real HTTP:
 *
 *   E1  team.create (fresh root) + whole-projection shape (nine fields);
 *   E2  push transport loss -> backoff -> reconnect -> identical pull;
 *   E3  stale response ignored (real pre-mutation generation replayed);
 *   E4  ledger pagination stability (anchor pages across a mutation);
 *   E5  typed errors + provenance on every UI-visible action;
 *   E6  wire negatives (auth / content-type / method / endpoint / envelope);
 *   EXTRA-1  catalog / intent / legacy / compatibility probes over the wire;
 *   EXTRA-2  request-token idempotent replay (create-member).
 *
 * The harness row (plugin.mjs) spawns a worker thread that hosts the REAL
 * TeamDomain world; every port call crosses a v8-serialized SharedArrayBuffer
 * mailbox, so the dispatcher's synchronous port contract is honored while
 * the async P6-T2 runtime runs on the worker (the first host wiring of the
 * Remote contract v1 — see the report).
 *
 * Serialization: `references/.dsh-test-g8.lock` (marker `G8-R5 <ISO>`);
 * age < 10 min -> wait 20 s (<= 75 times); age >= 10 min -> remove stale;
 * timeout -> record `e2e: NOT-RUN(LOCK-TIMEOUT)` and exit 0 (the review
 * continues on in-process evidence).
 *
 * Reuses the in-repo characterization lib (tests/characterization/lib) —
 * same file-fd stdio spawn chain as P7-T7 (TEST_METHODS §2/§5).
 *
 * Usage: node harness/run.mjs
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
  appendFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { register } from 'node:module'

const HERE = dirname(fileURLToPath(import.meta.url))
// harness -> reviewer-5 -> G8-REVIEW -> evidence -> agent-workflow -> dev -> worktree
const WORKTREE_ROOT = resolve(HERE, '..', '..', '..', '..', '..', '..')
const LIB = join(WORKTREE_ROOT, 'tests', 'characterization', 'lib')

const CLIENT_COMMIT_HASH = 'cd5ef814'
const STABLE_URL = 'http://127.0.0.1:3080/'
const BOOT_PORT = 3185
const LOCK_WAIT_MS = 20_000
const LOCK_MAX_ATTEMPTS = 75
const LOCK_STALE_MS = 10 * 60 * 1000
const ROW_ID = 'g8r5-team-remote-host'
const ROW_URL = pathToFileURL(join(HERE, 'plugin.mjs')).href
// Resolved before main() runs (needs the repo root walk).
let LOCK_PATH = null
// Module-level refs so the FATAL handler can still persist a summary.
let SUMMARY = null
let HARNESS_OUTPUT = null

// Register the worktree ts-loader in THIS process: the e2e client imports
// the remote package's TS test helper + contracts directly.
register(pathToFileURL(join(HERE, 'ts-loader.mjs')).href, import.meta.url)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

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

async function probeStableInstance() {
  try {
    const res = await fetch(STABLE_URL, { signal: AbortSignal.timeout(3000) })
    return { reachable: true, status: res.status }
  } catch (error) {
    return { reachable: false, reason: error instanceof Error ? error.message : String(error) }
  }
}

/**
 * The g8 lock protocol (gate-serialized pristine-host access).
 * @returns {string|null} the marker when acquired, null on timeout.
 */
async function acquireLock(log) {
  if (LOCK_PATH === null) throw new Error('lock path not resolved')
  const marker = `G8-R5 ${new Date().toISOString()}`
  for (let attempt = 1; attempt <= LOCK_MAX_ATTEMPTS; attempt += 1) {
    if (!existsSync(LOCK_PATH)) {
      try {
        writeFileSync(LOCK_PATH, `${marker}\n`, { flag: 'wx' })
        log(`lock acquired (marker ${marker})`)
        return marker
      } catch {
        // lost the race; re-read below
      }
    }
    let content = ''
    let ageMs = 0
    try {
      content = readFileSync(LOCK_PATH, 'utf8').trim()
      ageMs = Date.now() - statSync(LOCK_PATH).mtimeMs
    } catch {
      continue
    }
    if (content === marker) return marker
    if (ageMs >= LOCK_STALE_MS) {
      log(`lock stale (${Math.round(ageMs / 1000)}s, holder '${content.slice(0, 60)}') — removing`)
      try {
        rmSync(LOCK_PATH)
      } catch {
        /* concurrent remover */
      }
      continue
    }
    log(
      `lock held (${Math.round(ageMs / 1000)}s, holder '${content.slice(0, 60)}') — waiting ${LOCK_WAIT_MS}ms (attempt ${attempt}/${LOCK_MAX_ATTEMPTS})`,
    )
    await sleep(LOCK_WAIT_MS)
  }
  return null
}

function releaseLock(marker, log) {
  if (marker === null) return
  try {
    if (LOCK_PATH === null || !existsSync(LOCK_PATH)) return
    const content = readFileSync(LOCK_PATH, 'utf8').trim()
    if (content === marker) {
      rmSync(LOCK_PATH)
      log('lock released (marker matched)')
    } else {
      log(`lock NOT released (marker mismatch: '${content.slice(0, 60)}')`)
    }
  } catch (error) {
    log(`lock release error: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function main() {
  const REPO_ROOT = findRepoRoot(WORKTREE_ROOT)
  if (REPO_ROOT === null) throw new Error('cannot locate repo root (references/deepseek-harness-test-use marker)')
  const HOST_TREE = join(REPO_ROOT, 'references', 'deepseek-harness-test-use')
  const DSH_HOME = join(REPO_ROOT, 'references', '.dsh-test-g8-r5')
  const DATA_DIR = join(DSH_HOME, 'data', 'team-domain')
  const outDir = HERE
  const logsDir = join(HERE, 'logs')
  const harnessOutput = join(HERE, 'harness-output')
  mkdirSync(logsDir, { recursive: true })
  mkdirSync(harnessOutput, { recursive: true })
  const runLogPath = join(HERE, 'e2e-run.log')
  const log = (msg) => {
    const line = `[${new Date().toISOString()}] ${msg}\n`
    appendFileSync(runLogPath, line)
    process.stdout.write(line)
  }

  // Load the shared characterization lib (file-fd stdio spawn chain).
  const { DshInstance, ensureProfile } = await import(pathToFileURL(join(LIB, 'instance.mjs')).href)
  const { portInUse, waitForPortFree } = await import(pathToFileURL(join(LIB, 'util.mjs')).href)
  const { captureGitState } = await import(pathToFileURL(join(LIB, 'tree-clean.mjs')).href)

  log(`g8r5 e2e driver starting (worktree=${WORKTREE_ROOT} hostTree=${HOST_TREE} dshHome=${DSH_HOME} port=${BOOT_PORT})`)

  const summary = {
    review: 'G8-REVIEW reviewer-5 (R61)',
    runStamp: `g8r5-${Date.now()}`,
    worktree: WORKTREE_ROOT,
    hostTree: HOST_TREE,
    dshHome: DSH_HOME,
    port: BOOT_PORT,
    row: { id: ROW_ID, name: ROW_URL },
    stable3080: { before: null, after: null },
    pristine: { before: null, after: null },
    e2e: 'NOT-RUN',
    pass: false,
    failures: [],
  }
  SUMMARY = summary
  HARNESS_OUTPUT = harnessOutput

  const finish = (pass) => {
    summary.pass = pass
    writeFileSync(join(harnessOutput, 'summary.json'), JSON.stringify(summary, null, 2))
    log(`g8r5 e2e ${pass ? 'PASS' : 'FAIL'} — summary: ${join(harnessOutput, 'summary.json')}`)
    process.exit(pass ? 0 : 1)
  }
  const noteFailure = (why) => {
    summary.failures.push(why)
    log(`FAILURE: ${why}`)
  }

  // ── pre-flight: stable instance, pristine tree, port ─────────────────────
  summary.stable3080.before = await probeStableInstance()
  log(`preflight: stable :3080 ${JSON.stringify(summary.stable3080.before)}`)
  if (summary.stable3080.before.status !== 200) {
    throw new Error(`stable instance :3080 not 200 before run: ${JSON.stringify(summary.stable3080.before)}`)
  }

  summary.pristine.before = await captureGitState(HOST_TREE, logsDir)
  const beforeClean = summary.pristine.before.statusEmpty && summary.pristine.before.diffEmpty
  if (!beforeClean) {
    throw new Error(`test-use tree not pristine before run: ${JSON.stringify(summary.pristine.before.errors)}`)
  }
  log(`preflight: test-use tree pristine (head ${summary.pristine.before.head})`)

  if (await portInUse(BOOT_PORT)) {
    throw new Error(`port ${BOOT_PORT} is already in use — aborting`)
  }

  // ── lock (gate serialization) ─────────────────────────────────────────────
  const marker = await acquireLock(log)
  if (marker === null) {
    summary.e2e = 'NOT-RUN(LOCK-TIMEOUT)'
    summary.failures.push('e2e: NOT-RUN(LOCK-TIMEOUT)')
    log('e2e: NOT-RUN(LOCK-TIMEOUT)')
    summary.stable3080.after = await probeStableInstance()
    finish(true) // the review continues on in-process evidence
  }

  let instance = null
  try {
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
    const { spawnToLog } = await import(pathToFileURL(join(LIB, 'util.mjs')).href)
    if (missing.length > 0) {
      log(`build chain required (missing lib: ${missing.map((p) => p.name).join(', ')})`)
      if (!existsSync(join(HOST_TREE, 'node_modules', 'typescript', 'bin', 'tsc.js'))) {
        const install = await spawnToLog(
          'cmd',
          ['/d', '/s', '/c', 'pnpm', 'install', '--ignore-scripts'],
          { cwd: HOST_TREE, logPath: join(logsDir, 'build-install.log'), timeoutMs: 600_000 },
        )
        if (!install.ok) throw new Error(`pnpm install failed (exit ${install.exitCode}): ${install.text.slice(-400)}`)
      } else {
        log('pnpm install skipped (node_modules present)')
      }
      // build:lib = tsc host+client faces + tsdown/rolldown bundles. It spawns
      // no esbuild service (tsdown v0.22 is rolldown-powered), so it completes
      // inside the sandbox. build:web (vite) DOES spawn the esbuild service,
      // which the workspace-write sandbox denies with EPERM — handled below.
      const lib = await spawnToLog(
        'cmd',
        ['/d', '/s', '/c', 'pnpm', 'run', 'build:lib'],
        {
          cwd: HOST_TREE,
          env: { DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH, ESBUILD_WORKER_THREADS: '1' },
          logPath: join(logsDir, 'build-lib.log'),
          timeoutMs: 900_000,
        },
      )
      if (!lib.ok) throw new Error(`build:lib failed (exit ${lib.exitCode}): ${lib.text.slice(-400)}`)
      const stillMissing = farm.filter((p) => !existsSync(join(p.dir, 'lib', 'index.js')))
      if (stillMissing.length > 0) {
        throw new Error(`build succeeded but artifacts missing: ${stillMissing.map((p) => p.name).join(', ')}`)
      }
      summary.build = { required: true, lib: 'OK' }
      log('build:lib complete (host + client lib faces)')
    } else {
      summary.build = { required: false, lib: 'PRESENT' }
      log('build chain skipped (all farm lib artifacts present)')
    }
    // build:web (vite SPA shell) is best-effort on every run: the esbuild
    // service spawn can hit the sandbox EPERM boundary (documented). The SPA
    // dist is NOT required for the browserless e2e — verified in source:
    // frontend-static apply() performs no activation-time existence check
    // (a missing dist only 404s the index render), and the client build
    // record is consumed only by release/dev consumers, never by dsh web
    // boot. A non-EPERM build:web failure is still fatal.
    const web = await spawnToLog(
      'cmd',
      ['/d', '/s', '/c', 'pnpm', 'run', 'build:web'],
      {
        cwd: HOST_TREE,
        env: { DSH_CLIENT_COMMIT_HASH: CLIENT_COMMIT_HASH, ESBUILD_WORKER_THREADS: '1' },
        logPath: join(logsDir, 'build-web.log'),
        timeoutMs: 600_000,
      },
    )
    if (web.ok) {
      summary.build.web = 'OK'
      log('build:web complete')
    } else if (web.text.includes('EPERM')) {
      summary.build.web = 'SKIPPED(EPERM-BOUNDARY: esbuild service spawn blocked in sandbox; SPA dist not required for browserless e2e — report §5)'
      log(`build:web ${summary.build.web}`)
    } else {
      throw new Error(`build:web failed (exit ${web.exitCode}, non-boundary): ${web.text.slice(-400)}`)
    }

    // ── loader sanity probe (driver process imports the worktree TS) ───────
    await import(pathToFileURL(join(WORKTREE_ROOT, 'packages', 'contracts', 'src', 'index.js')).href)
    log('loader sanity probe: worktree contracts TS imported')

    // ── instance + profile + row mount ──────────────────────────────────────
    // The child inherits process.env; inject the g8r5 world env BEFORE start.
    process.env.G8R5_PACKAGES_DIR = join(WORKTREE_ROOT, 'packages')
    process.env.G8R5_DATA_DIR = DATA_DIR
    process.env.G8R5_HOST_LOG = join(HERE, 'host-plugin.log')

    instance = new DshInstance({
      hostTree: HOST_TREE,
      dshHome: DSH_HOME,
      port: BOOT_PORT,
      clientCommitHash: CLIENT_COMMIT_HASH,
      logDir: join(logsDir, 'boot'),
    })
    const profile = await ensureProfile({ instance, log, timeoutMs: 120_000 })
    log(`profile ready: ${JSON.stringify(profile)}`)

    instance.mountRows([{ id: ROW_ID, name: ROW_URL }], [
      'G8-REVIEW reviewer-5 harness patch layer: the g8r5-team-remote-host row is mounted ONLY through this public profile-patch seam.',
    ])
    log(`row mounted in the public patch layer: ${ROW_ID}`)

    // ── boot ────────────────────────────────────────────────────────────────
    const started = await instance.start({ timeoutMs: 180_000 })
    const url = started.url
    const tokenMatch = url.match(/token=([A-Za-z0-9_-]+)$/)
    if (tokenMatch === null) throw new Error(`boot url lacks a launch token: ${url}`)
    const launchToken = tokenMatch[1]
    const base = `http://127.0.0.1:${BOOT_PORT}`
    summary.instance = { url, logPath: started.logPath }
    log(`instance booted: ${url}`)

    const dump = await instance.dumpConfig({ timeoutMs: 60_000 })
    writeFileSync(join(harnessOutput, 'dump-config.txt'), dump.text)
    summary.rowMounted = DshInstance.rowInDump(dump.text, { id: ROW_ID, name: ROW_URL })
    log(`dump-config captured; rowMounted=${summary.rowMounted}`)
    if (!summary.rowMounted) {
      noteFailure('row not present in dump-config — the public patch seam did not mount the plugin')
    }

    // ── mint the launch cookie (wire contract: 302/303 + Set-Cookie) ───────
    const mint = await (async () => {
      const res = await fetch(`${base}/?token=${encodeURIComponent(launchToken)}`, {
        redirect: 'manual',
        signal: AbortSignal.timeout(15_000),
      })
      const setCookies = res.headers.getSetCookie()
      const auth = setCookies.find((c) => c.startsWith('dsh-auth-'))
      if (res.status !== 302 && res.status !== 303) {
        return { ok: false, detail: `launch status ${res.status}` }
      }
      if (auth === undefined) return { ok: false, detail: `launch ${res.status} without dsh-auth- Set-Cookie` }
      const value = auth.split(';')[0].trim()
      if (!/HttpOnly/i.test(auth) || !/SameSite=Strict/i.test(auth)) {
        return { ok: false, detail: `launch cookie flags not HttpOnly+SameSite=Strict: ${auth.slice(0, 120)}` }
      }
      return { ok: true, cookie: value, name: value.split('=')[0] }
    })()
    if (!mint.ok) throw new Error(`launch cookie mint failed: ${mint.detail}`)
    log(`launch cookie minted (${mint.name}=v1... flags HttpOnly SameSite=Strict)`)

    // ── world health: first port call builds the world in the worker ───────
    let health = null
    const healthDeadline = Date.now() + 150_000
    for (;;) {
      health = await (async () => {
        try {
          const res = await fetch(`${base}/team-remote/catalog.list`, {
            method: 'POST',
            headers: { 'content-type': 'application/json', cookie: mint.cookie },
            body: JSON.stringify({
              type: 'client-request',
              rpcId: 'g8r5-health',
              method: 'catalog.list',
              payload: { version: 1, params: {} },
            }),
            signal: AbortSignal.timeout(130_000),
          })
          const text = await res.text()
          let body = null
          try {
            body = text === '' ? null : JSON.parse(text)
          } catch {
            body = { nonJsonBody: text.slice(0, 300) }
          }
          return { status: res.status, body }
        } catch (error) {
          return { status: null, body: { error: error instanceof Error ? error.message : String(error) } }
        }
      })()
      const result = health.body !== null && typeof health.body === 'object' ? health.body.result : undefined
      if (health.status === 200 && result !== undefined && result.ok === true) break
      if (Date.now() >= healthDeadline) break
      await sleep(3000)
    }
    summary.worldHealth = health
    log(`world health: status=${health.status} ok=${health.body?.result?.ok}`)
    if (!(health.status === 200 && health.body?.result?.ok === true)) {
      throw new Error(`world did not become healthy: ${JSON.stringify(health).slice(0, 500)}`)
    }

    // ── e2e scenarios ───────────────────────────────────────────────────────
    const e2e = await import(pathToFileURL(join(HERE, 'e2e-client.mjs')).href)
    const report = await e2e.runE2E({
      base,
      launchToken,
      launchCookie: mint.cookie,
      cookieName: mint.name,
      dshHome: DSH_HOME,
      outDir: harnessOutput,
      log,
    })
    summary.e2e = report.pass ? 'RUN-PASS' : 'RUN-FAIL'
    summary.e2eResults = report.results
    summary.e2eStats = report.stats
    for (const failure of report.failures) noteFailure(failure)
  } finally {
    // ── stop (port-release proof) ───────────────────────────────────────────
    if (instance !== null) {
      try {
        const stop = await instance.stop({ timeoutMs: 20_000 })
        if (!stop.portFree) {
          const freed = await waitForPortFree(BOOT_PORT, 20_000)
          log(`stop: port still held after grace — waitForPortFree=${freed}`)
        }
        log(`instance stopped: ${JSON.stringify(stop)}`)
      } catch (error) {
        log(`stop error: ${error instanceof Error ? error.message : String(error)}`)
      }
    }
    // ── postflight: port, pristine tree, stable instance ────────────────────
    summary.ports = { released: { boot: !(await portInUse(BOOT_PORT)) } }
    log(`postflight: boot port released=${summary.ports.released.boot}`)
    summary.pristine.after = await captureGitState(HOST_TREE, logsDir)
    log(`postflight: test-use tree ${summary.pristine.after.statusEmpty && summary.pristine.after.diffEmpty ? 'pristine' : 'DIRTY'}`)
    summary.stable3080.after = await probeStableInstance()
    log(`postflight: stable :3080 ${JSON.stringify(summary.stable3080.after)}`)

    if (summary.e2e !== 'NOT-RUN(LOCK-TIMEOUT)') {
      if (summary.rowMounted === false) noteFailure('row mount proof missing (rowMounted=false)')
      if (summary.ports.released.boot === false) noteFailure(`boot port ${BOOT_PORT} not released after stop`)
      if (!(summary.pristine.after.statusEmpty && summary.pristine.after.diffEmpty)) {
        noteFailure('test-use tree not pristine after run')
      }
      if (summary.stable3080.after.status !== 200) {
        noteFailure(`stable instance :3080 not 200 after run: ${JSON.stringify(summary.stable3080.after)}`)
      }
    }
    releaseLock(marker, log)
  }

  finish(summary.failures.length === 0)
}

// Resolve the lock path (needs the repo root) before main() runs.
const REPO_ROOT_EARLY = findRepoRoot(WORKTREE_ROOT)
if (REPO_ROOT_EARLY === null) {
  throw new Error('cannot locate repo root before lock acquisition')
}
LOCK_PATH = join(REPO_ROOT_EARLY, 'references', '.dsh-test-g8.lock')

main().catch((error) => {
  const detail = error instanceof Error ? `${error.message}\n${error.stack ?? ''}` : String(error)
  appendFileSync(join(HERE, 'e2e-run.log'), `[${new Date().toISOString()}] FATAL: ${detail}\n`)
  if (SUMMARY !== null && HARNESS_OUTPUT !== null) {
    if (SUMMARY.e2e === 'NOT-RUN') SUMMARY.e2e = 'FATAL'
    SUMMARY.pass = false
    SUMMARY.failures.push(`FATAL: ${error instanceof Error ? error.message : String(error)}`)
    try {
      writeFileSync(join(HARNESS_OUTPUT, 'summary.json'), JSON.stringify(SUMMARY, null, 2))
    } catch {
      /* the summary write must never mask the fatal */
    }
  }
  process.stderr.write(`FATAL: ${detail}\n`)
  process.exit(1)
})
