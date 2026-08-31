/**
 * driver.mjs — G8 reviewer-2 e2e boot driver (brief §5.2).
 *
 * Boots a PRISTINE DSH web instance (pinned test-use tree, fresh
 * DSH_HOME, port 3182, FILE-FD stdio spawn only — no piped stdio), mounts
 * the harness row through the public `profiles/web/cordis.patch.yml` seam,
 * waits for the row-activation marker, then hands the launch URL to
 * client.mjs (browser-less E1-E6), stops the instance, and runs postflight
 * checks. The whole run is appended to `../e2e-run.log`; instance logs and
 * per-scenario artifacts land in `../harness-output/`.
 *
 * Lock protocol (brief §5.4, verbatim semantics): the shared file
 * `references/.dsh-test-g8.lock` serializes pristine-host boots across the
 * three G8 reviewers. While the lock is fresh (age < 10 min) the driver
 * sleeps 20 s and retries up to 75 times (~25 min). A stale lock
 * (age >= 10 min) is removed and the marker re-written: `G8-R2 <ISO>`. On
 * exit the lock is removed ONLY when its content still matches this
 * reviewer's marker. Timeout => `e2e: NOT-RUN(LOCK-TIMEOUT)` and the e2e
 * section is skipped (in-process evidence still stands).
 *
 * Reusability: boot mechanics import the repo's own
 * tests/characterization/lib/{instance,util}.mjs (DshInstance +
 * spawnToLog/waitForPortFree/portInUse/logTail) from the MAIN worktree.
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import http from 'node:http'
import { join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HARNESSED_DIR = fileURLToPath(new URL('.', import.meta.url))
const EVIDENCE_DIR = join(HARNESSED_DIR, '..') // .../evidence/G8-REVIEW/reviewer-2
const WORKTREE_ROOT = join(HARNESSED_DIR, '..', '..', '..', '..', '..', '..')
// <worktree> = <main-repo>/.worktrees/G8-R2  =>  main root is one more level up
const MAIN_ROOT = join(HARNESSED_DIR, '..', '..', '..', '..', '..', '..', '..', '..')

const TEST_USE = join(MAIN_ROOT, 'references', 'deepseek-harness-test-use')
const TEST_USE_SHA = 'cd5ef8148158c3a752a658978873241fdf8e2bbc'
const DSH_HOME = join(MAIN_ROOT, 'references', '.dsh-test-g8-r2')
const LOCK_FILE = join(MAIN_ROOT, 'references', '.dsh-test-g8.lock')
const LOCK_MARKER_PREFIX = 'G8-R2 '
const PORT = 3182
const STABLE_PORT = 3080
const ROW_ID = 'g8r2-team-remote'
const ROW_URL = fileURLToPath(new URL('./row.mjs', import.meta.url))

const OUTPUT_DIR = join(EVIDENCE_DIR, 'harness-output')
const LOGS_DIR = join(OUTPUT_DIR, 'logs')
const E2E_LOG = join(EVIDENCE_DIR, 'e2e-run.log')

// ── logging (e2e-run.log is the whole-run record) ─────────────────────────
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`
  appendFileSync(E2E_LOG, line + '\n')
  console.log(line)
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** One-shot HTTP status probe (node:http; no fetch dependency). */
function probeHttp(port, path = '/') {
  return new Promise((resolve) => {
    const req = http.request({ host: '127.0.0.1', port, path, method: 'GET', timeout: 5000 }, (res) => {
      res.resume()
      res.on('end', () => resolve({ ok: true, status: res.statusCode }))
    })
    req.on('timeout', () => req.destroy(new Error('probe timeout')))
    req.on('error', (error) => resolve({ ok: false, status: null, error: error.message }))
    req.end()
  })
}

/** Git one-liner via FILE-FD stdio (spawnToLog; piped stdio is forbidden). */
async function git(cwd, args, logPath) {
  const { spawnToLog } = await import(pathToFileURL(join(MAIN_ROOT, 'tests/characterization/lib/util.mjs')).href)
  const result = await spawnToLog('git', args, { cwd, logPath, timeoutMs: 30_000 })
  if (!result.ok) {
    throw new Error(`git ${args.join(' ')} failed (exit=${result.exitCode}): ${result.text.trim().split('\n')[0]}`)
  }
  return result.text.trim()
}

// ── lock (brief §5.4) ──────────────────────────────────────────────────────
async function acquireLock() {
  const marker = `${LOCK_MARKER_PREFIX}${new Date().toISOString()}`
  for (let attempt = 1; attempt <= 75; attempt += 1) {
    if (!existsSync(LOCK_FILE)) {
      writeFileSync(LOCK_FILE, marker)
      log(`lock: acquired (${marker}) on attempt ${attempt}`)
      return marker
    }
    const mtime = statSync(LOCK_FILE).mtimeMs
    const ageMs = Date.now() - mtime
    if (ageMs >= 10 * 60_000) {
      log(`lock: stale lock (age ${Math.round(ageMs / 1000)}s >= 10min, holder ${JSON.stringify(readFileSync(LOCK_FILE, 'utf8').trim())}) — removing and re-acquiring`)
      rmSync(LOCK_FILE)
      writeFileSync(LOCK_FILE, marker)
      log(`lock: acquired (${marker}) after stale removal`)
      return marker
    }
    if (attempt === 1 || attempt % 5 === 0) {
      log(`lock: held by another reviewer (${JSON.stringify(readFileSync(LOCK_FILE, 'utf8').trim())}, age ${Math.round(ageMs / 1000)}s) — sleeping 20s (attempt ${attempt}/75)`)
    }
    await sleep(20_000)
  }
  return null
}

function releaseLock(marker) {
  try {
    if (!existsSync(LOCK_FILE)) return
    const content = readFileSync(LOCK_FILE, 'utf8').trim()
    if (content === marker) {
      rmSync(LOCK_FILE)
      log('lock: released (content matched my marker)')
    } else {
      log(`lock: left in place (content ${JSON.stringify(content)} is not my marker ${JSON.stringify(marker)})`)
    }
  } catch (error) {
    log(`lock: release check failed (${error.message}) — leaving file untouched`)
  }
}

// ── preflight / postflight helpers ─────────────────────────────────────────
async function probeStable(label) {
  const probe = await probeHttp(STABLE_PORT)
  if (probe.ok && probe.status === 200) {
    log(`${label}: stable instance :${STABLE_PORT} returns 200 (untouched)`)
    return { ok: true, status: 200 }
  }
  log(`${label}: stable instance :${STABLE_PORT} probe => ${probe.ok ? probe.status : `error (${probe.error})`}`)
  return { ok: false, ...probe }
}

async function assertTestUsePinned() {
  const head = await git(TEST_USE, ['rev-parse', 'HEAD'], join(LOGS_DIR, 'git-test-use-head.log'))
  if (head !== TEST_USE_SHA) {
    throw new Error(`test-use tree HEAD ${head} !== pinned ${TEST_USE_SHA}`)
  }
  log(`preflight: test-use tree pinned at ${head}`)
  const status = await git(TEST_USE, ['status', '--porcelain'], join(LOGS_DIR, 'git-test-use-status-before.log'))
  if (status.length > 0) {
    log(`preflight: WARNING — test-use tree not pristine before run: ${JSON.stringify(status)}`)
  } else {
    log('preflight: test-use tree pristine (git status --porcelain empty)')
  }
}

function assertFarmLibs() {
  const critical = [
    join(TEST_USE, 'apps/cli/lib/bin.js'),
    join(TEST_USE, 'packages/storage/storage-domain/lib'),
  ]
  for (const p of critical) {
    if (!existsSync(p)) {
      throw new Error(`farm lib missing: ${p} — run the build chain before booting`)
    }
  }
  const webLib = join(TEST_USE, 'packages/web/lib')
  if (existsSync(webLib)) {
    log('preflight: farm libs present (apps/cli/lib, storage-domain/lib, web/lib)')
  } else {
    log('preflight: farm libs present (apps/cli/lib, storage-domain/lib); web/lib absent — prior reviewer boots in this deployment succeeded without it; recorded as environment note')
  }
}

// ── the run ────────────────────────────────────────────────────────────────
async function main() {
  mkdirSync(OUTPUT_DIR, { recursive: true })
  mkdirSync(LOGS_DIR, { recursive: true })
  writeFileSync(E2E_LOG, '') // fresh per run (this file is the run record)

  log('=== G8 reviewer-2 e2e (brief §5) — driver start ===')
  log(`paths: worktree=${WORKTREE_ROOT}`)
  log(`        mainRoot=${MAIN_ROOT}`)
  log(`        testUse=${TEST_USE}`)
  log(`        dshHome=${DSH_HOME}`)
  log(`        port=${PORT} lock=${LOCK_FILE}`)

  // Proof header (evidence convention: repo root + HEAD of the reviewed worktree).
  const toplevel = await git(WORKTREE_ROOT, ['rev-parse', '--show-toplevel'], join(LOGS_DIR, 'git-worktree-toplevel.log'))
  const head = await git(WORKTREE_ROOT, ['rev-parse', 'HEAD'], join(LOGS_DIR, 'git-worktree-head.log'))
  log(`git rev-parse --show-toplevel: ${toplevel}`)
  log(`git rev-parse HEAD: ${head}`)
  if (head !== '93d2a96e3ded6a92820f78ee9de94eac9ea6fffb') {
    throw new Error(`worktree HEAD ${head} !== reviewed integration HEAD 93d2a96e3ded6a92820f78ee9de94eac9ea6fffb`)
  }

  let marker = null
  let e2eResult = null
  let instance = null
  try {
    // Preflight.
    await assertTestUsePinned()
    const stableBefore = await probeStable('preflight')
    if (!stableBefore.ok) throw new Error('stable :3080 instance is not healthy before the run — aborting to protect the deployment')
    const { portInUse } = await import(pathToFileURL(join(MAIN_ROOT, 'tests/characterization/lib/util.mjs')).href)
    if (await portInUse(PORT)) {
      throw new Error(`port ${PORT} is already in use — another process owns it; aborting (never kill foreign listeners)`)
    }
    log(`preflight: port ${PORT} is free`)
    assertFarmLibs()

    // Lock (serializes pristine-host boots across G8-R1/R2/R3).
    marker = await acquireLock()
    if (marker === null) {
      log('e2e: NOT-RUN(LOCK-TIMEOUT) — giving up after 75 x 20s; in-process evidence still stands')
      return
    }

    // Fresh DSH_HOME per run.
    rmSync(DSH_HOME, { recursive: true, force: true })
    mkdirSync(DSH_HOME, { recursive: true })
    log(`fresh DSH_HOME created at ${DSH_HOME}`)

    const { DshInstance, ensureProfile } = await import(pathToFileURL(join(MAIN_ROOT, 'tests/characterization/lib/instance.mjs')).href)
    instance = new DshInstance({
      hostTree: TEST_USE,
      dshHome: DSH_HOME,
      port: PORT,
      clientCommitHash: TEST_USE_SHA.slice(0, 8),
      logDir: LOGS_DIR,
    })

    const profile = await ensureProfile({ instance, log, timeoutMs: 120_000 })
    log(`profile: ${JSON.stringify(profile)}`)

    // Mount the harness row (public patch-layer seam) and prove the composed
    // tree contains it before booting.
    instance.mountRows([{ id: ROW_ID, name: pathToFileURL(ROW_URL) }], [
      'G8 reviewer-2 e2e harness row (evidence-only; untracked)',
    ])
    const dump = await instance.dumpConfig()
    if (!DshInstance.rowInDump(dump.text, { id: ROW_ID, name: pathToFileURL(ROW_URL) })) {
      throw new Error('harness row not found in the composed profile dump')
    }
    log('mount: harness row present in the composed web profile (dump-config proof)')

    // Boot (FILE-FD stdio; boot marker = machine-level load proof).
    const boot = await instance.start({ timeoutMs: 120_000 })
    log(`boot: ${boot.url}`)
    log(`boot: instance log at ${boot.logPath}`)

    // Row activation (the row writes its marker after registerRemoteHandlers).
    const activatedPath = join(DSH_HOME, 'g8r2-row-activated.json')
    const rowErrorPath = join(DSH_HOME, 'g8r2-row-error.json')
    const activateDeadline = Date.now() + 30_000
    let activatedRaw = null
    let rowErrorRaw = null
    for (;;) {
      if (existsSync(activatedPath)) activatedRaw = readFileSync(activatedPath, 'utf8')
      if (existsSync(rowErrorPath)) rowErrorRaw = readFileSync(rowErrorPath, 'utf8')
      if (activatedRaw !== null || rowErrorRaw !== null || Date.now() >= activateDeadline) break
      await sleep(250)
    }
    if (rowErrorRaw !== null || activatedRaw === null) {
      const detail = rowErrorRaw ?? '(no row-activation marker within 30s)'
      throw new Error(`harness row failed to activate: ${detail}\n--- instance log tail ---\n${readFileSync(boot.logPath, 'utf8').split('\n').slice(-25).join('\n')}`)
    }
    log(`row: activated — ${activatedRaw.trim().replace(/\n\s*/g, ' ')}`)

    // The browser-less E1-E6 client.
    const client = await import(new URL('./client.mjs', import.meta.url).href)
    e2eResult = await client.run({
      port: PORT,
      launchUrl: boot.url,
      dshHome: DSH_HOME,
      outputDir: OUTPUT_DIR,
      log,
    })

    // Stop + port-release proof.
    const stop = await instance.stop({ timeoutMs: 20_000 })
    log(`stop: ${JSON.stringify(stop)}`)
    if (!stop.portFree) throw new Error(`port ${PORT} did not free after instance stop`)

    // Postflight.
    const stableAfter = await probeStable('postflight')
    const { portInUse: portInUseAfter, waitForPortFree } = await import(pathToFileURL(join(MAIN_ROOT, 'tests/characterization/lib/util.mjs')).href)
    const portFreeAfter = await waitForPortFree(PORT, 5000) && !(await portInUseAfter(PORT))
    log(`postflight: port ${PORT} released=${portFreeAfter}`)
    const statusAfter = await git(TEST_USE, ['status', '--porcelain'], join(LOGS_DIR, 'git-test-use-status-after.log'))
    const treeCleanAfter = statusAfter.length === 0
    log(`postflight: test-use tree byte-clean after run: ${treeCleanAfter}${treeCleanAfter ? '' : ` (${JSON.stringify(statusAfter)})`}`)

    // Remove any stale control file (defensive; the client removes its own).
    const controlPath = join(DSH_HOME, 'g8r2-control.json')
    if (existsSync(controlPath)) {
      rmSync(controlPath)
      log('cleanup: removed leftover control file')
    }

    writeFileSync(join(OUTPUT_DIR, 'e2e-summary.json'), JSON.stringify({
      head,
      testUseSha: TEST_USE_SHA,
      port: PORT,
      stableBefore,
      stableAfter,
      portFreeAfter,
      treeCleanAfter,
      scenarios: e2eResult.scenarios,
      allPass: e2eResult.allPass,
      wireSamples: e2eResult.wireSampleCount,
    }, null, 2))
    log(`e2e: scenarios=${JSON.stringify(e2eResult.scenarios.map((s) => `${s.name}:${s.pass ? 'PASS' : 'FAIL'}`))} allPass=${e2eResult.allPass}`)
    log('=== G8 reviewer-2 e2e — driver done ===')
  } catch (error) {
    log(`FATAL: ${error instanceof Error ? error.stack ?? error.message : String(error)}`)
    if (instance) {
      try {
        const s = await instance.stop({ timeoutMs: 10_000 })
        log(`fatal cleanup: instance stopped (killed=${s.killed} portFree=${s.portFree})`)
      } catch (stopError) {
        log(`fatal cleanup: instance stop failed: ${stopError instanceof Error ? stopError.message : String(stopError)}`)
      }
    }
    writeFileSync(join(OUTPUT_DIR, 'driver-fatal.json'), JSON.stringify({
      at: new Date().toISOString(),
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    }, null, 2))
    process.exitCode = 1
  } finally {
    if (marker !== null) releaseLock(marker)
  }
}

main()
