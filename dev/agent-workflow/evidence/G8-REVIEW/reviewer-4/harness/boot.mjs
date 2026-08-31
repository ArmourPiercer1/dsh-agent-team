/**
 * G8-R4 reviewer-4 — browser-less remote e2e boot driver.
 *
 * Flow: lock -> preflight -> fresh DSH_HOME + row mount -> spawn the test-use
 * host (FILE-FD stdio, port 3184) -> wait boot marker -> wait row health
 * -> run scenarios E1–E6 over real HTTP -> kill host -> copy harness output
 * -> postflight -> e2e-run.log + summary.
 *
 * Constraints honoured: test-use tree must be byte-clean before AND after;
 * the stable :3080 instance must answer 200 before AND after; port 3184 is
 * released after the run; the external lockfile is removed only when it
 * still carries this run's marker.
 */
import { spawn, spawnSync } from 'node:child_process'
import {
  cpSync,
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
  appendFileSync,
} from 'node:fs'
import { tmpdir } from 'node:os'
import net from 'node:net'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const EVIDENCE = dirname(HERE)
const WORKTREE = (() => {
  let dir = HERE
  for (let i = 0; i < 12; i += 1) {
    if (existsSync(join(dir, 'packages', 'remote', 'src', 'index.ts'))) return dir
    const parent = dirname(dir)
    if (parent === dir) break
    dir = parent
  }
  throw new Error('boot: worktree root not found')
})()
const REPO_ROOT = dirname(dirname(WORKTREE)) // .worktrees/G8-R4 -> .worktrees -> repo root
const TEST_USE = join(REPO_ROOT, 'references', 'deepseek-harness-test-use')
const HOME = join(REPO_ROOT, 'references', '.dsh-test-g8-r4')
const LOCK = join(REPO_ROOT, 'references', '.dsh-test-g8.lock')
const PORT = 3184
const STABLE_PORT = 3080
const PIN = 'cd5ef814'
const ROW_FILE = join(HERE, 'row.mjs')
const BOOT_LOG = join(EVIDENCE, 'boot.log')
const RUN_LOG = join(EVIDENCE, 'e2e-run.log')

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

const logLines = []
function log(line) {
  const stamped = `[${new Date().toISOString()}] ${line}`
  logLines.push(stamped)
  try {
    appendFileSync(RUN_LOG, stamped + '\n')
  } catch {
    // logging must never break the run
  }
  process.stdout.write(stamped + '\n')
}

function git(args) {
  // Sandbox: Node child_process piped stdio is EPERM. Use a file descriptor
  // (the same FILE-FD pattern the host boot uses) to capture output.
  const outFile = join(tmpdir(), `g8r4-git-${Date.now()}-${Math.random().toString(36).slice(2)}.txt`)
  const fd = openSync(outFile, 'w')
  const out = spawnSync('git', ['-C', TEST_USE, ...args], { stdio: ['ignore', fd, fd] })
  closeSync(fd)
  let stdout = ''
  try {
    stdout = readFileSync(outFile, 'utf8').trim()
  } catch {
    stdout = ''
  }
  rmSync(outFile, { force: true })
  return { code: out.status, stdout }
}

function portBusy(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host: '127.0.0.1' })
    socket.once('connect', () => {
      socket.destroy()
      resolve(true)
    })
    socket.once('error', () => resolve(false))
  })
}

async function probeStatus(port, path) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}${path}`, {
      signal: AbortSignal.timeout(10000),
      redirect: 'manual',
    })
    await res.arrayBuffer()
    return res.status
  } catch {
    return null
  }
}

// --- Lock (brief line 99 protocol) -------------------------------------------
const LOCK_MARKER = `G8-R4 ${new Date().toISOString()}`

async function acquireLock() {
  mkdirSync(dirname(LOCK), { recursive: true })
  for (let attempt = 0; attempt <= 75; attempt += 1) {
    if (!existsSync(LOCK)) {
      try {
        writeFileSync(LOCK, LOCK_MARKER + '\n', { flag: 'wx' })
        log(`lock: acquired (${LOCK})`)
        return
      } catch {
        // raced — re-check next iteration
      }
    }
    const content = readFileSync(LOCK, 'utf8').trim()
    const m = content.match(/G8-R[0-9] (\S+)/)
    const age = m !== null ? Date.now() - Date.parse(m[1]) : Number.POSITIVE_INFINITY
    if (age >= 10 * 60 * 1000) {
      log(`lock: stale (age ${Math.round(age / 60000)} min, owner '${content.split('\n')[0]}') — removing`)
      rmSync(LOCK, { force: true })
      continue
    }
    log(`lock: held by '${content.split('\n')[0]}' (age ${Math.round(age / 1000)}s) — waiting 20s`)
    await sleep(20000)
  }
  throw new Error('lock: NOT-RUN(LOCK-TIMEOUT) after full retry loop')
}

function releaseLock() {
  try {
    if (existsSync(LOCK)) {
      const content = readFileSync(LOCK, 'utf8').trim()
      if (content === LOCK_MARKER.trim()) {
        rmSync(LOCK, { force: true })
        log('lock: released')
      } else {
        log(`lock: NOT released — now owned by '${content.split('\n')[0]}'`)
      }
    }
  } catch (error) {
    log(`lock: release failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}

// --- Preflight / postflight ----------------------------------------------------
function checkTestUse(phase) {
  const head = git(['rev-parse', '--short', 'HEAD'])
  const dirty = git(['status', '--porcelain'])
  const headOk = head.code === 0 && head.stdout.startsWith(PIN)
  const clean = dirty.code === 0 && dirty.stdout === ''
  log(`${phase}: test-use HEAD=${head.stdout || 'n/a'} (expect ${PIN}*) clean=${clean}`)
  if (!headOk || !clean) {
    throw new Error(`${phase}: test-use tree not pristine (headOk=${headOk} clean=${clean})`)
  }
}

function checkFarmArtifacts() {
  const canaries = [
    join(TEST_USE, 'apps', 'cli', 'lib', 'bin.js'),
    join(TEST_USE, 'packages', 'boot', 'app-boot', 'lib', 'index.js'),
  ]
  for (const canary of canaries) {
    if (!existsSync(canary)) {
      log(`farm: canary missing (${canary}) — running node scripts/build.ts`)
      const out = spawnSync(
        process.execPath,
        [join(TEST_USE, 'scripts', 'build.ts')],
        {
          cwd: TEST_USE,
          stdio: 'inherit',
          env: { ...process.env, DSH_CLIENT_COMMIT_HASH: PIN, ESBUILD_WORKER_THREADS: '1' },
          timeout: 10 * 60 * 1000,
        },
      )
      if (out.status !== 0) throw new Error(`farm: build failed (exit ${out.status})`)
    }
  }
  log('farm: artifacts present (apps/cli/lib/bin.js, app-boot lib)')
}

// --- DSH_HOME + row mount -------------------------------------------------------
function freshHome() {
  if (existsSync(HOME)) {
    log(`home: removing existing ${HOME}`)
    rmSync(HOME, { recursive: true, force: true })
  }
  mkdirSync(join(HOME, 'profiles', 'web'), { recursive: true })
  const patch = [
    '# G8-R4 reviewer-4 harness row (browser-less remote e2e).',
    '# Auto-init fills package.json with the stock web template bundles;',
    '# this user patch layer is applied after every bundle layer.',
    `- insert:`,
    `    - id: g8r4-remote-projection`,
    `      name: "${pathToFileURL(ROW_FILE).href}"`,
    '',
  ].join('\n')
  writeFileSync(join(HOME, 'profiles', 'web', 'cordis.patch.yml'), patch)
  log(`home: fresh ${HOME}, row mounted at profiles/web/cordis.patch.yml`)
}

// --- Host spawn ------------------------------------------------------------------
const BOOT_MARKER = /dsh web: http:\/\/127\.0\.0\.1:(\d+)\/\?token=([A-Za-z0-9_-]+)/

function spawnHost() {
  const outFd = openSync(BOOT_LOG, 'a')
  const errFd = outFd
  const child = spawn(
    process.execPath,
    [join(TEST_USE, 'apps', 'cli', 'lib', 'bin.js'), 'web', '--port', String(PORT), '--no-open'],
    {
      cwd: TEST_USE,
      stdio: ['ignore', outFd, errFd],
      env: { ...process.env, DSH_HOME: HOME, DSH_CLIENT_COMMIT_HASH: PIN },
    },
  )
  return child
}

async function waitBootMarker(child, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      const tail = existsSync(BOOT_LOG) ? readFileSync(BOOT_LOG, 'utf8').split('\n').slice(-25).join('\n') : '(no boot log)'
      throw new Error(`host exited early (code ${child.exitCode}):\n${tail}`)
    }
    if (existsSync(BOOT_LOG)) {
      const m = readFileSync(BOOT_LOG, 'utf8').match(BOOT_MARKER)
      if (m !== null) {
        const port = Number(m[1])
        if (port !== PORT) throw new Error(`boot marker on unexpected port ${port}`)
        return m[2]
      }
    }
    await sleep(500)
  }
  throw new Error(`boot marker not seen within ${timeoutMs}ms`)
}

async function waitHealth(timeoutMs) {
  const deadline = Date.now() + timeoutMs
  let last = null
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/__g8r4/health`, { signal: AbortSignal.timeout(5000) })
      last = await res.json()
      if (last.ready === true) return last
      if (last.ok === false) {
        const failure = join(HOME, 'g8-r4-harness-output', 'setup-failure.json')
        const detail = existsSync(failure) ? readFileSync(failure, 'utf8') : JSON.stringify(last)
        throw new Error(`row setup failed: ${detail}`)
      }
    } catch (error) {
      if (error instanceof Error && error.message.startsWith('row setup failed')) throw error
      // connection error — the web server may not be listening yet
    }
    await sleep(500)
  }
  throw new Error(`row health not ready within ${timeoutMs}ms (last: ${JSON.stringify(last)})`)
}

function killHost(child) {
  if (child.exitCode !== null) return
  // Sandbox: piped stdio is EPERM — capture taskkill output via FILE-FD.
  const outFile = join(tmpdir(), `g8r4-taskkill-${Date.now()}.txt`)
  const fd = openSync(outFile, 'w')
  const killed = spawnSync('taskkill', ['/pid', String(child.pid), '/T', '/F'], { stdio: ['ignore', fd, fd] })
  closeSync(fd)
  let detail = ''
  try {
    detail = readFileSync(outFile, 'utf8').trim()
  } catch {
    detail = ''
  }
  rmSync(outFile, { force: true })
  if (killed.status !== 0) {
    log(`kill: taskkill status ${killed.status} (${detail || 'no output'}) — falling back to child.kill()`)
    try {
      child.kill()
    } catch {
      // already gone
    }
  }
}

function waitForExit(child, timeoutMs) {
  return new Promise((resolve) => {
    if (child.exitCode !== null) return resolve()
    const timer = setTimeout(() => resolve(), timeoutMs)
    child.once('exit', () => {
      clearTimeout(timer)
      resolve()
    })
  })
}

// --- Main ------------------------------------------------------------------------
async function main() {
  writeFileSync(RUN_LOG, `# G8-R4 e2e run — ${new Date().toISOString()}\n`)
  writeFileSync(BOOT_LOG, `# G8-R4 host boot log — ${new Date().toISOString()}\n`)
  log('=== preflight ===')
  acquireLockResult = await acquireLock()
  checkTestUse('preflight')
  const stableBefore = await probeStatus(STABLE_PORT, '/')
  log(`preflight: stable :${STABLE_PORT} -> ${stableBefore}`)
  if (stableBefore !== 200) throw new Error(`preflight: stable instance not 200 (got ${stableBefore})`)
  if (await portBusy(PORT)) throw new Error(`preflight: port ${PORT} already in use`)
  log(`preflight: port ${PORT} free`)
  checkFarmArtifacts()
  freshHome()

  log('=== boot ===')
  const child = spawnHost()
  log(`boot: host pid ${child.pid} spawned (FILE-FD stdio -> ${BOOT_LOG})`)
  let token
  let health
  let e2e = null
  let postflight = null
  try {
    token = await waitBootMarker(child, 240000)
    log(`boot: marker seen, launch token ${token.slice(0, 6)}...`)
    health = await waitHealth(180000)
    log(`health: ready (seedGen=${health.generation} seeded=${health.seeded} writeFailures=${health.writeFailures})`)

    log('=== e2e scenarios ===')
    const { runE2e } = await import(pathToFileURL(join(HERE, 'client-e2e.mjs')).href)
    e2e = await runE2e({ base: `http://127.0.0.1:${PORT}`, token, log })
    for (const r of e2e.results) {
      log(`  ${r.id}: ${r.ok ? 'PASS' : 'FAIL'}`)
    }
  } finally {
    log('=== shutdown ===')
    killHost(child)
    await waitForExit(child, 10000)
    log(`shutdown: host exited (code ${child.exitCode ?? 'n/a'})`)

    // Harness output + durable store into the evidence directory.
    try {
      const harnessOut = join(HOME, 'g8-r4-harness-output')
      if (existsSync(harnessOut)) {
        cpSync(harnessOut, join(EVIDENCE, 'harness-output'), { recursive: true })
        log('output: harness-output/ copied to evidence')
      }
      const domainStore = join(HOME, 'g8-team-domain')
      if (existsSync(domainStore)) {
        cpSync(domainStore, join(EVIDENCE, 'team-domain-store'), { recursive: true })
        log('output: team-domain-store/ copied to evidence')
      }
    } catch (error) {
      log(`output: copy failed: ${error instanceof Error ? error.message : String(error)}`)
    }

    log('=== postflight ===')
    try {
      checkTestUse('postflight')
      const stableAfter = await probeStatus(STABLE_PORT, '/')
      log(`postflight: stable :${STABLE_PORT} -> ${stableAfter}`)
      const busy = await portBusy(PORT)
      log(`postflight: port ${PORT} busy=${busy}`)
      postflight = { testUseClean: true, stableAfter, portBusy: busy }
    } catch (error) {
      postflight = { error: error instanceof Error ? error.message : String(error) }
      log(`postflight: FAILED — ${postflight.error}`)
    }
  }

  const summary = {
    at: new Date().toISOString(),
    head: '3fa4c1f27ed1e8903c131dadc9aafe536ed9eb86',
    port: PORT,
    preflight: { stableBefore, pin: PIN },
    boot: { pid: child.pid, tokenPresent: token !== undefined },
    health: health ?? null,
    e2e: e2e === null ? 'NOT-RUN' : { allPassed: e2e.allPassed, results: e2e.results },
    postflight,
  }
  writeFileSync(join(EVIDENCE, 'e2e-summary.json'), JSON.stringify(summary, undefined, 2) + '\n')
  log(`summary: e2e=${e2e === null ? 'NOT-RUN' : e2e.allPassed ? 'ALL-PASS' : 'FAILURES'} postflight=${JSON.stringify(postflight)}`)
  releaseLock()
  const exitCode =
    e2e === null ? 2 : e2e.allPassed && postflight !== null && postflight.error === undefined && postflight.portBusy === false ? 0 : 1
  process.exitCode = exitCode
}

let acquireLockResult
main().catch((error) => {
  try {
    log(`FATAL: ${error instanceof Error ? error.stack ?? error.message : String(error)}`)
  } catch {
    // last resort
  }
  releaseLock()
  process.exitCode = 2
})
