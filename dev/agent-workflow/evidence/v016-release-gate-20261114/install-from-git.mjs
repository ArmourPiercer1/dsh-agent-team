#!/usr/bin/env node
/**
 * install-from-git.mjs — prove (or disprove) the ONE acceptance the owner set
 * for the v0.1.6 internal trial build:
 *
 *     pnpm dsh plugin --profile web add github:ArmourPiercer1/dsh-agent-team
 *
 * WHAT IT DOES, IN ORDER (one invocation = one measurement against an
 * UNMODIFIED install — the repo is never built, patched or pre-prepared for it):
 *
 *   1. GIT-STATE  — records what `master` HEAD is on the remote at measurement
 *                   time, and the local commit/tree, so the install can be
 *                   compared with the branch it claims to track.
 *   2. INSTALL    — creates a FRESH `tests/homes/<world>/home` (throwaway
 *                   DSH_HOME, inside the session workspace), a fresh project
 *                   dir and workspace, then runs the PINNED pristine host CLI:
 *                       node <test-use>/apps/cli/lib/bin.js \
 *                            plugin --profile web add github:ArmourPiercer1/dsh-agent-team
 *                   with no `#ref` (the operator's literal command). No
 *                   `allowBuilds` entry, no profile pre-seeding beyond the
 *                   workspace file that keeps pnpm's store inside the session
 *                   workspace (the default store is outside the write sandbox).
 *   3. FACTS      — profile `package.json` dependency spec, the lockfile
 *                   resolution (is it a commit sha or a branch?), installed
 *                   package version/private, installed tree digest, file count,
 *                   whether the committed `dist/` survived, and whether the
 *                   profile's `dsh.profile.bundles` got the bundle row.
 *   4. LIST       — `dsh plugin --profile web list` (pnpm's own list) — does the
 *                   plugin show up for that profile?
 *   5. BOOT       — boots the profile on a sanctioned port and requires the
 *                   boot line + the plugin's own mount line
 *                   (`[dsh-agent-team] remote mount: MOUNTED`) + the auth gate,
 *                   then tears the process down by identity.
 *
 * SAFE TO RE-RUN: every invocation gets a fresh world under `tests/homes/`
 * (deleted at exit unless `--keep`), writes only its own evidence dir, and never
 * writes product files. It NEVER touches `:3080` or `~/.dsh` (the sandbox makes
 * those read-only for this process anyway).
 *
 * USAGE
 *   node dev/agent-workflow/evidence/v016-release-gate-20261114/install-from-git.mjs \
 *     --label attempt1 [--port 3191] [--keep] [--spec github:OWNER/REPO]
 */

import { spawn, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync, openSync, closeSync,
} from 'node:fs'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = resolve(HERE, '..', '..', '..', '..')
const MAIN_CHECKOUT = resolve(REPO, '..', '..')
// A fresh worktree has no `tests/deepseek-harness-test-use` (gitignored); fall
// back to the main checkout's pinned pristine runtime, exactly as the packaging
// kit does, and record which tree was used.
const TEST_USE = [
  join(REPO, 'tests', 'deepseek-harness-test-use'),
  join(MAIN_CHECKOUT, 'tests', 'deepseek-harness-test-use'),
].find((p) => existsSync(join(p, 'apps', 'cli', 'lib', 'bin.js')))
if (TEST_USE === undefined) throw new Error('no pristine host checkout with apps/cli/lib/bin.js found')
const HOST_BIN = join(TEST_USE, 'apps', 'cli', 'lib', 'bin.js')
const STORE_DIR = join(REPO, '.artifacts', 'pnpm-store')

const argv = process.argv.slice(2)
const arg = (name, fallback) => {
  const i = argv.indexOf(`--${name}`)
  return i >= 0 ? argv[i + 1] : fallback
}
const LABEL = arg('label', 'attempt1')
const SPEC = arg('spec', 'github:ArmourPiercer1/dsh-agent-team')
const PORT = Number(arg('port', '3191'))
const KEEP = argv.includes('--keep')
// --via-pnpm-dsh runs the operator's LITERAL command form
// (`pnpm dsh plugin --profile web add …`) from the pristine host checkout,
// instead of the same CLI through its built entry. The install command is the
// only step that must be literal; boot keeps the built entry + a workspace cwd.
const VIA_PNPM_DSH = argv.includes('--via-pnpm-dsh')
const STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const WORLD = join(REPO, 'tests', 'homes', `v016-install-from-git-${LABEL}-${STAMP}`)
const HOME = join(WORLD, 'home')
const PROJECT = join(WORLD, 'project')
const WS = join(WORLD, 'workspace')
const PROFILE = join(HOME, 'profiles', 'web')
const OUT = join(HERE, 'install-from-git', LABEL)

mkdirSync(OUT, { recursive: true })
const LOG = join(OUT, 'driver.log')
writeFileSync(LOG, '')
const log = (line) => {
  const text = `[${new Date().toISOString()}] ${line}`
  process.stdout.write(`${text}\n`)
  appendFileSync(LOG, `${text}\n`)
}
const writeEvidence = (name, value) => {
  const path = join(OUT, name)
  mkdirSync(dirname(path), { recursive: true })
  writeFileSync(path, `${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}\n`)
  return path
}
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')
const sha256File = (p) => sha256(readFileSync(p))
const tail = (text, n) => text.split('\n').slice(-n).join('\n')

function treeDigest(dir) {
  const rows = []
  const walk = (current, base) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (entry.name === 'node_modules') continue
      const p = join(current, entry.name)
      if (entry.isDirectory()) { walk(p, base); continue }
      if (!entry.isFile()) continue
      rows.push([relative(base, p).split('\\').join('/'), sha256File(p)])
    }
  }
  walk(dir, dir)
  rows.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0))
  return `sha256:${sha(rows.map(([rel, h]) => `${rel}\u0000${h}`).join('\n'))}`
}
const sha = (text) => sha256(Buffer.from(text, 'utf8'))

function git(args, cwd = REPO) {
  const out = spawnSync('git', ['-C', cwd, ...args], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  return { status: out.status, stdout: (out.stdout ?? '').trim(), stderr: (out.stderr ?? '').trim() }
}

function ensureFreshWorld() {
  if (existsSync(WORLD)) throw new Error(`refusing to reuse world: ${WORLD}`)
  mkdirSync(HOME, { recursive: true })
  mkdirSync(PROJECT, { recursive: true })
  mkdirSync(WS, { recursive: true })
  mkdirSync(PROFILE, { recursive: true })
  // The host CLI installs through pnpm; this workspace file keeps the store
  // inside the session workspace (the default store lives outside the write
  // sandbox). It declares no allowBuilds entry — deliberately: the point is to
  // find out whether the package needs one.
  writeFileSync(join(PROFILE, 'pnpm-workspace.yaml'), [
    'packages:', '  - .', '',
    'nodeLinker: hoisted',
    'autoInstallPeers: false',
    `storeDir: ${STORE_DIR}`,
    'strictDepBuilds: false',
    '',
  ].join('\n'))
}

function runInstall() {
  const command = VIA_PNPM_DSH
    ? `cd ${TEST_USE} && DSH_HOME=${HOME} pnpm dsh plugin --profile web add ${SPEC}`
    : `DSH_HOME=${HOME} node ${HOST_BIN} plugin --profile web add ${SPEC}`
  log(`INSTALL: ${command}`)
  const started = Date.now()
  const out = spawnSync(
    VIA_PNPM_DSH ? 'pnpm' : process.execPath,
    VIA_PNPM_DSH ? ['dsh', 'plugin', '--profile', 'web', 'add', SPEC] : [HOST_BIN, 'plugin', '--profile', 'web', 'add', SPEC],
    {
    cwd: VIA_PNPM_DSH ? TEST_USE : HOME,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    env: {
      ...process.env,
      DSH_HOME: HOME,
      npm_config_store_dir: STORE_DIR,
    },
    timeout: 900_000,
  })
  const elapsedMs = Date.now() - started
  writeEvidence('install-stdout.txt', `$ ${command}\n[exit ${out.status}] [${elapsedMs} ms]\n\n${out.stdout ?? ''}\n--- stderr ---\n${out.stderr ?? ''}`)
  log(`INSTALL exit=${out.status} elapsed=${elapsedMs}ms`)
  return { command, exit: out.status, elapsedMs, stdout: out.stdout ?? '', stderr: out.stderr ?? '', viaPnpmDsh: VIA_PNPM_DSH }
}

/** The `dsh-agent-team` entry of the profile lockfile, verbatim. pnpm writes
 *  git resolutions as `resolution: {commit, repo, type}`; a branch spec would
 *  leave a moving ref in the request field. */
function lockEntry() {
  const lockPath = join(PROFILE, 'pnpm-lock.yaml')
  if (!existsSync(lockPath)) return null
  const lines = readFileSync(lockPath, 'utf8').split('\n')
  const start = lines.findIndex((l) => /^\s{2}dsh-agent-team@/.test(l))
  if (start < 0) return null
  const block = [lines[start]]
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = lines[i]
    // a new package entry / section starts at exactly two leading spaces
    if (/^\s{2}\S/.test(line) || /^\S/.test(line)) break
    block.push(line)
    if (block.length > 80) break
  }
  const text = block.join('\n')
  const commit = /tar\.gz\/([0-9a-f]{40})/u.exec(text)?.[1] ?? /commit:\s*([0-9a-f]{40})/u.exec(text)?.[1] ?? null
  return { text, commit, file: lockPath, sha256: sha256File(lockPath) }
}

function collectFacts(install) {
  const profilePackagePath = join(PROFILE, 'package.json')
  const profilePackage = existsSync(profilePackagePath) ? JSON.parse(readFileSync(profilePackagePath, 'utf8')) : null
  const installedRoot = join(PROFILE, 'node_modules', 'dsh-agent-team')
  const installedPackage = existsSync(join(installedRoot, 'package.json'))
    ? JSON.parse(readFileSync(join(installedRoot, 'package.json'), 'utf8'))
    : null
  const hostEntry = join(installedRoot, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js')
  const distFiles = existsSync(join(installedRoot, 'packages', 'runtime', 'dist'))
    ? readdirSync(join(installedRoot, 'packages', 'runtime', 'dist'), { recursive: true })
      .filter((p) => typeof p === 'string' && !p.endsWith('/')).length
    : 0
  const installedFiles = existsSync(installedRoot)
    ? readdirSync(installedRoot, { recursive: true }).filter((p) => typeof p === 'string').length
    : 0
  const bundlePatch = join(installedRoot, 'cordis.patch.yml')
  const facts = {
    command: install.command,
    exit: install.exit,
    elapsedMs: install.elapsedMs,
    spec: SPEC,
    viaPnpmDsh: VIA_PNPM_DSH,
    world: WORLD,
    dshHome: HOME,
    profile: PROFILE,
    installed: existsSync(installedRoot),
    installedName: installedPackage?.name ?? null,
    installedVersion: installedPackage?.version ?? null,
    installedPrivate: installedPackage?.private ?? null,
    installedHasDshBundle: Boolean(installedPackage?.dsh?.bundle),
    installedHasBin: Boolean(installedPackage?.bin),
    installedScripts: installedPackage?.scripts ? Object.keys(installedPackage.scripts) : null,
    installedHostEntry: existsSync(hostEntry),
    installedHostEntrySha256: existsSync(hostEntry) ? sha256File(hostEntry) : null,
    installedDistFiles: distFiles,
    installedFiles,
    installedTreeDigest: existsSync(installedRoot) ? treeDigest(installedRoot) : null,
    bundlePatchPresent: existsSync(bundlePatch),
    profileDependency: profilePackage?.dependencies?.['dsh-agent-team'] ?? null,
    profileBundles: profilePackage?.dsh?.profile?.bundles ?? null,
    lock: lockEntry(),
  }
  writeEvidence('install-facts.json', facts)
  if (profilePackage !== null) writeEvidence('profile-package.json', profilePackage)
  if (installedPackage !== null) writeEvidence('installed-package.json', installedPackage)
  return facts
}

function runList() {
  const command = `DSH_HOME=${HOME} node ${HOST_BIN} plugin --profile web list`
  log(`LIST: ${command}`)
  const out = spawnSync(process.execPath, [HOST_BIN, 'plugin', '--profile', 'web', 'list'], {
    cwd: HOME,
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
    env: { ...process.env, DSH_HOME: HOME, npm_config_store_dir: STORE_DIR },
    timeout: 300_000,
  })
  writeEvidence('plugin-list.txt', `$ ${command}\n[exit ${out.status}]\n\n${out.stdout ?? ''}\n--- stderr ---\n${out.stderr ?? ''}`)
  const mentions = `${out.stdout ?? ''}`.includes('dsh-agent-team')
  log(`LIST exit=${out.status} mentionsPlugin=${mentions}`)
  return { command, exit: out.status, mentionsPlugin: mentions, stdout: out.stdout ?? '', stderr: out.stderr ?? '' }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function boot(port) {
  const instanceLog = join(OUT, 'instance.log')
  rmSync(instanceLog, { force: true })
  log(`BOOT: DSH_HOME=${HOME} node ${HOST_BIN} web --port ${port} --no-open`)
  const fd = openSync(instanceLog, 'a')
  const child = spawn(process.execPath, [HOST_BIN, 'web', '--port', String(port), '--no-open'], {
    cwd: WS,
    stdio: ['ignore', fd, fd],
    env: { ...process.env, DSH_HOME: HOME },
  })
  closeSync(fd)
  const result = { port, booted: false, bootLine: null, authStatus: null, pluginMounted: false, skillsRegistered: false, error: null }
  try {
    const deadline = Date.now() + 180_000
    let url = null
    while (Date.now() < deadline) {
      const text = existsSync(instanceLog) ? readFileSync(instanceLog, 'utf8') : ''
      const hits = [...text.matchAll(/dsh web: (http:\/\/127\.0\.0\.1:\d+\/\?token=[A-Za-z0-9_-]+)/gu)]
      if (hits.length > 0) { url = hits.at(-1)[1]; result.booted = true; result.bootLine = url.replace(/token=.*/u, 'token=<redacted>'); break }
      if (child.exitCode !== null) break
      // eslint-disable-next-line no-await-in-loop
      await sleep(400)
    }
    const text = existsSync(instanceLog) ? readFileSync(instanceLog, 'utf8') : ''
    result.pluginMounted = /\[dsh-agent-team\] remote mount: MOUNTED channel=\/team-remote/u.test(text)
    result.skillsRegistered = /\[dsh-agent-team\] registered \d+ bundled team skill/u.test(text)
    result.logSha256 = sha256(text)
    result.logBytes = Buffer.byteLength(text)
    if (url === null) {
      result.error = `no boot line in 180s; log tail:\n${tail(text, 25)}`
    } else {
      const auth = await fetch(url, { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
      result.authStatus = auth.status
      // the operator's browser path: token URL answers 303 (accepted) or 200;
      // the bare origin must refuse with 401.
      result.tokenAccepted = auth.status === 303 || auth.status === 200
      const bare = await fetch(url.replace(/\/\?token=.*$/u, '/'), { redirect: 'manual', signal: AbortSignal.timeout(30_000) })
        .catch(() => null)
      result.noTokenStatus = bare === null ? null : bare.status
      // the plugin's own remote surface: 401/404 without auth would also be
      // "the channel exists"; the mount line above is the load proof.
      const origin = url.replace(/\/\?token=.*$/u, '')
      const noToken = await fetch(`${origin}/team-remote/team.getProjection`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}', signal: AbortSignal.timeout(30_000),
      }).catch(() => null)
      result.remoteRouteStatusWithoutAuth = noToken === null ? null : noToken.status
    }
  } catch (error) {
    result.error = String(error?.stack ?? error)
  } finally {
    if (child.exitCode === null) child.kill('SIGTERM')
    const deadline = Date.now() + 15_000
    while (child.exitCode === null && Date.now() < deadline) {
      // eslint-disable-next-line no-await-in-loop
      await sleep(200)
    }
    if (child.exitCode === null) child.kill('SIGKILL')
    result.exitCodeAfterTeardown = child.exitCode
  }
  writeEvidence('boot.json', result)
  log(`BOOT booted=${result.booted} tokenAuth=${result.authStatus} noToken=${result.noTokenStatus} mounted=${result.pluginMounted} skills=${result.skillsRegistered} err=${result.error ? 'yes' : 'no'}`)
  return result
}

async function main() {
  const head = git(['rev-parse', 'HEAD'])
  const remoteHead = git(['ls-remote', 'https://github.com/ArmourPiercer1/dsh-agent-team', 'HEAD'])
  const remoteMaster = git(['ls-remote', 'https://github.com/ArmourPiercer1/dsh-agent-team', 'refs/heads/master'])
  const identity = {
    measuredAt: new Date().toISOString(),
    localRepo: REPO,
    localHead: head.stdout,
    localBranch: git(['rev-parse', '--abbrev-ref', 'HEAD']).stdout,
    localStatusPorcelain: git(['status', '--porcelain']).stdout,
    remoteHead: remoteHead.stdout,
    remoteMaster: remoteMaster.stdout,
    hostBin: HOST_BIN,
    hostCheckout: TEST_USE,
    hostPin: git(['rev-parse', 'HEAD'], TEST_USE).stdout,
    hostPorcelain: git(['status', '--porcelain'], TEST_USE).stdout,
    node: process.version,
    pnpm: spawnSync('pnpm', ['-v'], { encoding: 'utf8' }).stdout.trim(),
    storeDir: STORE_DIR,
    spec: SPEC,
  }
  writeEvidence('identity.json', identity)
  log(`identity: local HEAD ${identity.localHead} remote HEAD ${identity.remoteHead.split(/\s+/)[0]} host ${identity.hostPin}`)

  ensureFreshWorld()
  log(`world: ${WORLD}`)
  const install = runInstall()
  const facts = collectFacts(install)
  const list = runList()
  const bootResult = await boot(PORT)

  const verdict = install.exit === 0 && facts.installed === true
    && facts.installedVersion === '0.1.6'
    && facts.installedHasDshBundle === true
    && Array.isArray(facts.profileBundles) && facts.profileBundles.includes('dsh-agent-team')
    && list.exit === 0 && list.mentionsPlugin === true
    && bootResult.booted === true && bootResult.tokenAccepted === true && bootResult.noTokenStatus === 401
    && bootResult.pluginMounted === true
  const summary = { label: LABEL, spec: SPEC, installExit: install.exit, verdict: verdict ? 'PASS' : 'FAIL', facts, list, boot: bootResult }
  writeEvidence('summary.json', summary)
  log(`VERDICT: ${summary.verdict}`)

  if (!KEEP) {
    // teardown by verified path: only ever delete the world this run created
    if (!WORLD.startsWith(join(REPO, 'tests', 'homes', 'v016-install-from-git-'))) {
      throw new Error(`refusing teardown of unexpected path: ${WORLD}`)
    }
    rmSync(WORLD, { recursive: true, force: true })
    log(`teardown: removed ${WORLD}`)
  } else {
    log(`teardown: kept ${WORLD} (--keep)`)
  }
  process.exit(summary.verdict === 'PASS' ? 0 : 1)
}

await main()
