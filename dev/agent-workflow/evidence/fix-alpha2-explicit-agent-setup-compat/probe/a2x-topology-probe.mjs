#!/usr/bin/env node
/**
 * a2x-topology-probe.mjs — diagnostic runner (fix/alpha2-explicit-agent-setup-compat).
 *
 * Answers ONE question: from a top-level profile-patch row fiber (the
 * exact position of the dsh-agent-team production row), can the host
 * resolve the `webServer` service — by property read (what
 * dsh-client-connection does internally when a row registers an RPC
 * channel) and by strict `ctx.get` — and where does the webServer
 * provider fiber sit relative to that row fiber?
 *
 * Runs the probe row (probe-row.mjs) on TWO real hosts, one fresh
 * DSH_HOME world each (TEST_METHODS §7 temp worlds under the worktree's
 * tests/homes; 3180 family only; :3080 read-only probe before/after):
 *
 *   1. npm @deepseek-ai/dsh@0.1.5-rc.2 (tests/live-host-015rc2 — the
 *      kit's host; the one whose bootstrap failed with
 *      `cannot get property "webServer" without inject`);
 *   2. pristine test-use 0.1.2-rc.1 (tests/deepseek-harness-test-use @
 *      a66e470204 — the host the plugin's pinned dependencies target,
 *      where the production /team-remote mount has always worked).
 *
 * Output: <this dir>/runs/<stamp>/probe-<host>.log + summary.json.
 * This kit MODIFIES nothing outside the two temp worlds + its own run dir.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const KIT_DIR = dirname(fileURLToPath(import.meta.url))
// probe/ -> fix-alpha2-explicit-agent-setup-compat -> evidence ->
// agent-workflow -> dev -> the task worktree root (five up); the main
// repo checkout is one level above the .worktrees dir (six up).
const WORKTREE = resolve(KIT_DIR, '..', '..', '..', '..', '..')
const REPO = resolve(WORKTREE, '..', '..')

const stamp = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '').replace('T', 'T')
const RUN_DIR = join(KIT_DIR, 'runs', 'probe-' + stamp)
mkdirSync(RUN_DIR, { recursive: true })

const STABLE_URL = 'http://127.0.0.1:3080/'
const probeStable = async () =>
  fetch(STABLE_URL, { signal: AbortSignal.timeout(5_000) })
    .then((r) => `http ${r.status}`)
    .catch((e) => `unreachable (${e.name ?? e})`)

const HOSTS = [
  {
    label: 'npm-0.1.5-rc.2',
    bin: join(WORKTREE, 'tests', 'live-host-015rc2', 'node_modules', '@deepseek-ai', 'dsh', 'lib', 'bin.js'),
    cwd: join(WORKTREE, 'tests', 'live-host-015rc2', 'node_modules', '@deepseek-ai', 'dsh'),
    port: 3183,
    // The published dist carries no .git; a pinned hash skips any
    // in-build git spawn (the kit's DshInstance pattern).
    env: { DSH_CLIENT_COMMIT_HASH: 'npm-0.1.5-rc.2' },
  },
  {
    label: 'test-use-0.1.2-rc.1',
    bin: join(REPO, 'tests', 'deepseek-harness-test-use', 'apps', 'cli', 'lib', 'bin.js'),
    cwd: join(REPO, 'tests', 'deepseek-harness-test-use'),
    port: 3184,
    env: {},
  },
]

const PROBE_ROW_URL = pathToFileURL(join(KIT_DIR, 'probe-row.mjs')).href

function probePatchYml() {
  return [
    '# a2x topology probe world (run probe-' + stamp + ') — probe row ONLY (no production rows).',
    `- insert:`,
    `  - id: a2x-probe`,
    `    name: ${PROBE_ROW_URL}`,
    '',
  ].join('\n')
}

async function runHost(host, stableBefore) {
  const home = join(WORKTREE, 'tests', 'homes', `a2x-probe-${host.label}-` + stamp)
  const profileDir = join(home, 'profiles', 'web')
  mkdirSync(profileDir, { recursive: true })
  // Match the kit exactly: the profile skeleton (cordis.yml, package.json,
  // node_modules) is initialized by the host at first boot; only the patch
  // layer is pre-written.
  writeFileSync(join(profileDir, 'cordis.patch.yml'), probePatchYml())
  const logPath = join(RUN_DIR, `probe-${host.label}.log`)
  const result = { host: host.label, bin: host.bin, cwd: host.cwd, port: host.port, home, probe: null, bootUrl: null, fatal: null }
  if (!existsSync(host.bin)) {
    result.fatal = `host bin missing: ${host.bin}`
    return result
  }
  const child = spawn('node', [host.bin, 'web', '--port', String(host.port), '--no-open'], {
    cwd: host.cwd,
    env: { ...process.env, DSH_HOME: home, ...host.env },
    stdio: ['ignore', 'pipe', 'pipe'],
  })
  let out = ''
  const onData = (chunk) => {
    out += chunk.toString()
    try { writeFileSync(logPath, out) } catch { /* best effort */ }
  }
  child.stdout.on('data', onData)
  child.stderr.on('data', onData)
  const deadline = Date.now() + 90_000
  for (;;) {
    const m = out.match(/\[A2X-PROBE\] (.*)/)
    if (m !== null) {
      try { result.probe = JSON.parse(m[1]) } catch (e) { result.probe = m[1] }
      break
    }
    const u = out.match(/dsh web: (http:\/\/[^\s]+?\/)\?token=[A-Za-z0-9_-]+/)
    if (u !== null) result.bootUrl = u[1]
    if (child.exitCode !== null) break
    if (Date.now() > deadline) { result.fatal = 'timeout: no probe line within 90s'; break }
    await new Promise((r) => setTimeout(r, 500))
  }
  child.kill('SIGTERM')
  await new Promise((r) => {
    if (child.exitCode !== null || child.signalCode !== null) return r()
    const t = setTimeout(() => child.kill('SIGKILL'), 5_000)
    child.once('exit', () => { clearTimeout(t); r() })
  })
  rmSync(home, { recursive: true, force: true })
  result.homeDeleted = true
  return result
}

const stableBefore = await probeStable()
const results = []
for (const host of HOSTS) {
  results.push(await runHost(host, stableBefore))
}
const stableAfter = await probeStable()

const summary = {
  stamp,
  stableInstance: { before: stableBefore, after: stableAfter, note: 'read-only GET probe; no operation performed' },
  results,
}
writeFileSync(join(RUN_DIR, 'summary.json'), JSON.stringify(summary, null, 2))
console.log(JSON.stringify(summary, null, 2))
process.exit(0)
