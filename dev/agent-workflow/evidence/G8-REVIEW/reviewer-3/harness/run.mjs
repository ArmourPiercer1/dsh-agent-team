#!/usr/bin/env node
/**
 * G8-REVIEW reviewer-3 (G8-R3) — e2e boot driver.
 *
 * Boots a REAL DSH web instance (pinned test-use tree, fresh per-reviewer
 * DSH_HOME under references/, dedicated port 3183) with the g8r3-remote-e2e
 * row mounted ONLY through the public profile-patch seam, then drives the
 * E1-E6 scenarios (../harness/e2e.mjs) with the REAL p8t4 test client over
 * REAL HTTP.
 *
 * Phase order (brief §6):
 *   1. preflight  : stable :3080 reachable+200 BEFORE, port 3183 free,
 *                   HEAD pins by PLAIN FILE READS, pristine git state
 *   2. lock       : shared G8 lock references/.dsh-test-g8.lock
 *                   (<= 75 x 20s waits; age >= 10 min => stale, removed)
 *   3. farm       : junction farm so the row's seam.mjs bare imports
 *                   (@deepseek-ai/dsh-storage-domain, zod) resolve from the
 *                   worktree (the only bare imports in the whole graph)
 *   4. fresh DSH_HOME (rm + mkdir, gitignored under references/)
 *   5. boot       : ensureProfile -> mountRows -> dump-config proof ->
 *                   start -> mint cookie -> poll /__g8r3/health (cookie)
 *   6. e2e        : register parent ts-hook -> import e2e.mjs -> runE2E
 *   7. finally    : stop instance -> reset patch layer -> port free ->
 *                   release lock (only if still ours) -> postflight
 *
 * Exit 0 iff the E1-E6 scenarios all pass.
 * Outputs: ../e2e-run.log, ../harness-output/summary.json (+ dump config,
 * instance logs).
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

import {
  DshInstance,
  ensureProfile,
  ensureProbeResolution,
} from '../../../../../../tests/characterization/lib/instance.mjs'
import { portInUse, waitForPortFree } from '../../../../../../tests/characterization/lib/util.mjs'
import { captureGitState } from '../../../../../../tests/characterization/lib/tree-clean.mjs'
import { httpRequest, mintCookie } from './http-transport.mjs'

// ── layout ──────────────────────────────────────────────────────────────────

const HERE = dirname(fileURLToPath(import.meta.url))
const EVIDENCE_ROOT = dirname(HERE) // .../evidence/G8-REVIEW/reviewer-3
const REPORT_DIR = join(EVIDENCE_ROOT, 'harness-output')
const LOGS_DIR = join(REPORT_DIR, 'logs')
const RUN_LOG = join(EVIDENCE_ROOT, 'e2e-run.log')

function findWorktreeRoot(start) {
  let dir = start
  for (let i = 0; i < 10; i += 1) {
    if (existsSync(join(dir, 'packages', 'remote')) && existsSync(join(dir, 'dev', 'agent-workflow'))) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error('cannot locate worktree root from ' + start)
}

const WORKTREE_ROOT = findWorktreeRoot(HERE)

function findMainRoot(start) {
  let dir = start
  for (let i = 0; i < 4; i += 1) {
    if (existsSync(join(dir, 'references', 'deepseek-harness-test-use'))) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error('cannot locate main repo root from ' + start)
}

const MAIN_ROOT = findMainRoot(WORKTREE_ROOT)
const HOST_TREE = join(MAIN_ROOT, 'references', 'deepseek-harness-test-use')
const DSH_HOME = join(MAIN_ROOT, 'references', '.dsh-test-g8-r3')
const LOCK_FILE = join(MAIN_ROOT, 'references', '.dsh-test-g8.lock')

// ── pins & constants ────────────────────────────────────────────────────────

const WT_PIN = '93d2a96e3ded6a92820f78ee9de94eac9ea6fffb' // detached worktree head
const TU_PIN = 'cd5ef8148158c3a752a658978873241fdf8e2bbc' // test-use master
const PORT = 3183
const TEAM_ID = 'session-g8r3team01'
const ROW_ID = 'g8r3-remote-e2e'
const ROW = { id: ROW_ID, name: pathToFileURL(join(HERE, 'row.mjs')).href }
const MOUNT_HEADER = ['G8-R3 remote e2e rows (public profile-patch seam only)']
const LOCK_STALE_MS = 10 * 60 * 1000
const LOCK_MAX_ATTEMPTS = 75
const LOCK_WAIT_MS = 20_000

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ── logging ─────────────────────────────────────────────────────────────────

mkdirSync(LOGS_DIR, { recursive: true })
const log = (line) => {
  const stamped = `${new Date().toISOString()} ${line}`
  console.log(stamped)
  appendFileSync(RUN_LOG, `${stamped}\n`)
}

// ── helpers ─────────────────────────────────────────────────────────────────

async function probeStable() {
  const attempt = httpRequest({ host: '127.0.0.1', port: 3080, method: 'GET', pathAndQuery: '/' })
  const timeout = new Promise((r) => {
    const t = setTimeout(() => r({ timeout: true }), 5000)
    if (typeof t.unref === 'function') t.unref()
  })
  try {
    const res = await Promise.race([attempt, timeout])
    if (res && res.timeout) return { reachable: false, reason: 'timeout-5s' }
    return { reachable: true, status: res.status }
  } catch (error) {
    return { reachable: false, reason: error?.message ?? String(error) }
  }
}

/** Plain file read of the detached worktree's head pin. */
function readWtPin() {
  return readFileSync(join(MAIN_ROOT, '.git', 'worktrees', 'G8-R3', 'head'), 'utf8').trim()
}

/** Plain file read of the test-use HEAD (loose or packed ref resolution). */
function readTuPin() {
  const head = readFileSync(join(HOST_TREE, '.git', 'HEAD'), 'utf8').trim()
  if (!head.startsWith('ref: ')) return head
  const ref = head.slice('ref: '.length).trim()
  const loose = join(HOST_TREE, '.git', ref)
  if (existsSync(loose)) return readFileSync(loose, 'utf8').trim()
  const packed = readFileSync(join(HOST_TREE, '.git', 'packed-refs'), 'utf8')
  for (const line of packed.split('\n')) {
    if (line.startsWith('#') || line.includes('^')) continue
    const [sha, name] = line.split(/\s+/)
    if (name === ref && /^[0-9a-f]{40}$/i.test(sha)) return sha.toLowerCase()
  }
  throw new Error(`test-use HEAD ref ${ref} not resolvable`)
}

const LOG_TAIL_LINES = 40
function tailText(logPath, lines = LOG_TAIL_LINES) {
  try {
    return readFileSync(logPath, 'utf8').split('\n').slice(-lines).join('\n')
  } catch {
    return ''
  }
}

// ── lock protocol ───────────────────────────────────────────────────────────

const LOCK_MARKER = `G8-R3 ${new Date().toISOString()}`

async function acquireLock() {
  for (let attempt = 1; attempt <= LOCK_MAX_ATTEMPTS; attempt += 1) {
    if (!existsSync(LOCK_FILE)) {
      try {
        writeFileSync(LOCK_FILE, LOCK_MARKER + '\n', { flag: 'wx' })
        log(`lock acquired (attempt ${attempt}): ${LOCK_FILE}`)
        return { ok: true, attempts: attempt }
      } catch {
        // raced with another writer — re-loop
      }
      continue
    }
    let holder = '(unreadable)'
    let ageMs = Infinity
    try {
      holder = readFileSync(LOCK_FILE, 'utf8').trim()
      ageMs = Date.now() - statSync(LOCK_FILE).mtimeMs
    } catch {
      /* re-loop */
    }
    if (ageMs >= LOCK_STALE_MS) {
      log(`lock stale (age ${Math.round(ageMs / 1000)}s, holder ${holder}) — removing`)
      try {
        rmSync(LOCK_FILE)
      } catch (error) {
        log(`stale lock removal failed: ${error.message}`)
      }
      continue
    }
    if (attempt === 1 || attempt % 15 === 0) {
      log(`lock held by ${holder} (age ${Math.round(ageMs / 1000)}s) — waiting (attempt ${attempt}/${LOCK_MAX_ATTEMPTS})`)
    }
    await sleep(LOCK_WAIT_MS)
  }
  log(`lock NOT acquired within ${LOCK_MAX_ATTEMPTS} attempts (${Math.round((LOCK_MAX_ATTEMPTS * LOCK_WAIT_MS) / 1000)}s)`)
  return { ok: false, attempts: LOCK_MAX_ATTEMPTS }
}

function releaseLock() {
  try {
    if (existsSync(LOCK_FILE)) {
      const current = readFileSync(LOCK_FILE, 'utf8').trim()
      if (current === LOCK_MARKER) {
        rmSync(LOCK_FILE)
        log('lock released (marker matched)')
      } else {
        log(`lock NOT released (marker changed: ${current})`)
      }
    }
  } catch (error) {
    log(`lock release failed: ${error.message}`)
  }
}

// ── main ────────────────────────────────────────────────────────────────────

async function main() {
  const runStamp = `g8r3-${Date.now()}`
  log(`G8R3 e2e driver start: runStamp=${runStamp}`)
  log(`worktree=${WORKTREE_ROOT}`)
  log(`mainRoot=${MAIN_ROOT} hostTree=${HOST_TREE}`)
  log(`dshHome=${DSH_HOME} port=${PORT}`)

  const summary = {
    task: 'G8-REVIEW',
    reviewer: '3 (G8-R3)',
    runStamp,
    worktree: WORKTREE_ROOT,
    mainRoot: MAIN_ROOT,
    hostTree: HOST_TREE,
    dshHome: DSH_HOME,
    e2ePort: PORT,
    pins: { worktree: null, testUse: null },
    stable3080: { before: null, after: null },
    pristine: { mainBefore: null, testUseBefore: null, mainAfter: null, testUseAfter: null },
    lock: null,
    farm: null,
    boot: null,
    e2e: { status: 'NOT-RUN', allPass: false, scenarios: [] },
    failures: [],
  }
  const noteFailure = (why) => {
    summary.failures.push(why)
    log(`FAILURE: ${why}`)
  }
  const writeSummary = () => writeFileSync(join(REPORT_DIR, 'summary.json'), JSON.stringify(summary, null, 2))
  const skipE2E = (reason) => {
    e2eSkipped = true
    summary.e2e.status = `NOT-RUN(${reason})`
    noteFailure(`e2e not run: ${reason}`)
  }

  let instance = undefined
  let e2eRan = false
  let e2eSkipped = false

  try {
    // ── 1. preflight ─────────────────────────────────────────────────────────
    summary.stable3080.before = await probeStable()
    log(`preflight: stable :3080 ${JSON.stringify(summary.stable3080.before)}`)
    if (!summary.stable3080.before.reachable || summary.stable3080.before.status !== 200) {
      noteFailure(`stable :3080 not 200 before run (pre-existing condition; this run never touches it): ${JSON.stringify(summary.stable3080.before)}`)
    }

    const portBusy = await portInUse(PORT)
    log(`preflight: port ${PORT} ${portBusy ? 'BUSY' : 'free'}`)

    let pinsOk = true
    try {
      const wtActual = readWtPin()
      summary.pins.worktree = { expected: WT_PIN, actual: wtActual, ok: wtActual === WT_PIN }
      const tuActual = readTuPin()
      summary.pins.testUse = { expected: TU_PIN, actual: tuActual, ok: tuActual === TU_PIN }
    } catch (error) {
      noteFailure(`HEAD pin read failed: ${error.message}`)
      pinsOk = false
    }
    pinsOk = pinsOk && summary.pins.worktree?.ok === true && summary.pins.testUse?.ok === true
    log(`preflight: pins ${JSON.stringify(summary.pins)}`)

    summary.pristine.mainBefore = await captureGitState(MAIN_ROOT, LOGS_DIR)
    summary.pristine.testUseBefore = await captureGitState(HOST_TREE, LOGS_DIR)
    const mainCleanBefore = summary.pristine.mainBefore.statusEmpty
    const tuCleanBefore = summary.pristine.testUseBefore.statusEmpty && summary.pristine.testUseBefore.diffEmpty
    log(`preflight: main tree clean=${mainCleanBefore} (head ${summary.pristine.mainBefore.head})`)
    log(`preflight: test-use tree clean=${tuCleanBefore} (head ${summary.pristine.testUseBefore.head})`)
    if (!tuCleanBefore) noteFailure(`test-use tree not pristine before run: ${JSON.stringify(summary.pristine.testUseBefore.errors)}`)

    // ── 2. lock ──────────────────────────────────────────────────────────────
    if (portBusy) skipE2E('PORT-BUSY')
    else if (!pinsOk) skipE2E('PIN-MISMATCH')
    else if (!tuCleanBefore) skipE2E('TEST-USE-NOT-PRISTINE')

    if (e2eSkipped) {
      log('skipping boot: e2e marked NOT-RUN in preflight')
    } else {
      summary.lock = await acquireLock()
      if (!summary.lock.ok) skipE2E('LOCK-TIMEOUT')

      if (e2eSkipped) {
        log('skipping boot: lock not acquired')
      } else {
        // ── 3. junction farm (only bare imports in the dynamic graph) ──────
        const zodDir = join(HOST_TREE, 'node_modules', '.pnpm', 'zod@4.4.3', 'node_modules', 'zod')
        if (!existsSync(zodDir)) throw new Error('zod@4.4.3 missing from test-use pnpm store: ' + zodDir)
        summary.farm = ensureProbeResolution({
          probesDir: WORKTREE_ROOT,
          packages: [
            { name: '@deepseek-ai/dsh-storage-domain', dir: join(HOST_TREE, 'packages', 'storage', 'storage-domain') },
            { name: 'zod', dir: zodDir },
          ],
          log,
        })
        log(`farm ready under ${join(WORKTREE_ROOT, 'node_modules')}`)

        // ── 4. fresh DSH_HOME ───────────────────────────────────────────────
        rmSync(DSH_HOME, { recursive: true, force: true })
        mkdirSync(DSH_HOME, { recursive: true })
        log(`fresh DSH_HOME created at ${DSH_HOME}`)

        // ── 5. boot ─────────────────────────────────────────────────────────
        instance = new DshInstance({
          hostTree: HOST_TREE,
          dshHome: DSH_HOME,
          port: PORT,
          clientCommitHash: TU_PIN,
          logDir: LOGS_DIR,
        })
        const bootRecord = { profile: null, rowMounted: null, url: null, logPath: null, cookie: null, health: null }
        try {
          bootRecord.profile = await ensureProfile({ instance, log, timeoutMs: 240_000 })
          instance.mountRows([ROW], MOUNT_HEADER)
          log(`row mounted via public patch seam: ${instance.patchFile}`)

          const dump = await instance.dumpConfig({ timeoutMs: 60_000 })
          writeFileSync(join(REPORT_DIR, 'dump-config.txt'), dump.text)
          bootRecord.rowMounted = DshInstance.rowInDump(dump.text, ROW)
          log(`dump-config: row mounted = ${bootRecord.rowMounted}`)
          if (!bootRecord.rowMounted) throw new Error('row not present in dump-config — public patch seam did not mount the plugin')

          const started = await instance.start({ timeoutMs: 180_000 })
          bootRecord.url = started.url
          bootRecord.logPath = started.logPath
          log(`instance up: ${started.url}`)

          // Auth is global on the web seam: mint the cookie BEFORE polling.
          const minted = await mintCookie({ host: '127.0.0.1', port: PORT, launchUrl: started.url })
          bootRecord.cookie = { name: minted.name, httpOnly: minted.httpOnly, sameSiteStrict: minted.sameSiteStrict }
          log(`cookie minted: ${minted.name} (HttpOnly=${minted.httpOnly}, SameSite=Strict=${minted.sameSiteStrict})`)

          // The row's async boot (dynamic TS imports + real TeamDomain seed)
          // completes after the boot marker; poll the health route (WITH the
          // cookie — the auth middleware guards all routes).
          const deadline = Date.now() + 120_000
          for (;;) {
            const probe = await httpRequest({
              host: '127.0.0.1',
              port: PORT,
              method: 'GET',
              pathAndQuery: '/__g8r3/health',
              headers: { cookie: minted.cookie },
            })
            bootRecord.health = { http: probe.status, body: probe.json }
            // Fail fast on the row's error record (the handler answers 500).
            if (probe.json !== null && typeof probe.json === 'object' && probe.json.status === 'error') {
              throw new Error('row boot error: ' + JSON.stringify(probe.json.error))
            }
            if (probe.status === 200 && probe.json !== null) {
              if (probe.json.status === 'ready') {
                log(`row ready: ${JSON.stringify(probe.json)}`)
                break
              }
            }
            if (Date.now() >= deadline) {
              throw new Error(`row not ready within 120s (last: http=${probe.status} body=${JSON.stringify(probe.json)})`)
            }
            await sleep(500)
          }
          summary.boot = bootRecord
        } catch (bootError) {
          const detail = bootError?.message ?? String(bootError)
          if (instance.logPath && existsSync(instance.logPath)) {
            const tail = tailText(instance.logPath)
            if (tail) log('instance log tail:\n' + tail)
          }
          throw new Error(`boot failed: ${detail}`)
        }

        // ── 6. e2e ──────────────────────────────────────────────────────────
        register(pathToFileURL(join(HERE, 'ts-loader.mjs')).href, import.meta.url)
        const e2eMod = await import(pathToFileURL(join(HERE, 'e2e.mjs')).href)
        e2eRan = true
        const e2eResult = await e2eMod.runE2E({
          host: '127.0.0.1',
          port: PORT,
          launchUrl: summary.boot.url,
          teamSessionId: TEAM_ID,
          log,
          wtRoot: WORKTREE_ROOT,
          here: HERE,
        })
        summary.e2e = { status: e2eResult.allPass ? 'PASS' : 'FAIL', allPass: e2eResult.allPass, scenarios: e2eResult.scenarios }
        if (!e2eResult.allPass) {
          for (const s of e2eResult.scenarios.filter((x) => !x.pass)) {
            noteFailure(`scenario ${s.id} failed: ${s.error ?? 'unknown'}`)
          }
          if (instance.logPath && existsSync(instance.logPath)) {
            summary.boot.instanceLogTail = tailText(instance.logPath)
          }
        }
      }
    }
  } catch (fatal) {
    noteFailure(`harness fatal: ${fatal?.stack ?? fatal}`)
    if (summary.e2e.status === 'NOT-RUN') summary.e2e.status = 'NOT-RUN(HARNESS-FATAL)'
  } finally {
    // ── 7. teardown + postflight ─────────────────────────────────────────────
    if (instance !== undefined) {
      try {
        const stop = await instance.stop({ timeoutMs: 20_000 })
        summary.boot = { ...(summary.boot ?? {}), stop }
        log(`instance stop: ${JSON.stringify(stop)}`)
      } catch (error) {
        noteFailure(`instance stop failed: ${error?.message ?? error}`)
      }
      try {
        instance.resetPatchLayer(MOUNT_HEADER)
        log('patch layer reset to baseline []')
      } catch (error) {
        log(`patch layer reset failed (non-fatal): ${error?.message ?? error}`)
      }
      try {
        const portFree = await waitForPortFree(PORT, 20_000)
        log(`port ${PORT} free after stop = ${portFree}`)
        if (!portFree) noteFailure(`port ${PORT} still bound after instance stop`)
      } catch (error) {
        noteFailure(`port free check failed: ${error?.message ?? error}`)
      }
    }
    releaseLock()

    summary.stable3080.after = await probeStable()
    log(`postflight: stable :3080 ${JSON.stringify(summary.stable3080.after)}`)
    if (!summary.stable3080.after.reachable || summary.stable3080.after.status !== 200) {
      noteFailure(`stable :3080 not 200 after run: ${JSON.stringify(summary.stable3080.after)}`)
    } else if (summary.stable3080.before?.status === 200) {
      log('postflight: stable :3080 unchanged (200 -> 200)')
    }

    summary.pristine.mainAfter = await captureGitState(MAIN_ROOT, LOGS_DIR)
    summary.pristine.testUseAfter = await captureGitState(HOST_TREE, LOGS_DIR)
    const mainCleanAfter = summary.pristine.mainAfter.statusEmpty
    const tuCleanAfter = summary.pristine.testUseAfter.statusEmpty && summary.pristine.testUseAfter.diffEmpty
    log(`postflight: main tree clean=${mainCleanAfter} status=${JSON.stringify(summary.pristine.mainAfter.status)}`)
    log(`postflight: test-use tree clean=${tuCleanAfter} status=${JSON.stringify(summary.pristine.testUseAfter.status)} diffEmpty=${summary.pristine.testUseAfter.diffEmpty}`)
    if (!mainCleanAfter) noteFailure(`main tree NOT clean after run: ${JSON.stringify(summary.pristine.mainAfter.status)}`)
    if (!tuCleanAfter) noteFailure(`test-use tree NOT clean after run: ${JSON.stringify(summary.pristine.testUseAfter.status)}`)
  }

  writeSummary()
  const pass = e2eRan && summary.e2e.allPass === true && summary.failures.length === 0
  log(`G8R3 e2e driver RESULT: ${pass ? 'PASS' : 'FAIL'} — summary: ${join(REPORT_DIR, 'summary.json')}`)
  process.exit(pass ? 0 : 1)
}

main().catch((error) => {
  log(`G8R3 e2e driver FATAL: ${error?.stack ?? error}`)
  process.exit(1)
})
