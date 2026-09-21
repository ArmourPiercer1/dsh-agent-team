#!/usr/bin/env node
/**
 * git-install-boot.mjs — the REAL-CLI git-install boot probe (PR #26
 * supplemental §2.2): fresh profile → git dependency install → bundle
 * auto-added → real host boot → the team-spill-local provider loads.
 *
 * This is the installed-form complement of strict-read-smoke.mjs: the
 * smoke mounts the worktree via `file:` + symlink; THIS probe installs
 * the branch the way a user does (`dsh plugin add <git-spec>` against
 * a local bare clone — the local equivalent of the `github:` spec;
 * pnpm's git-dep semantics are identical, PBA probe-verified) and boots
 * the INSTALLED form. The probe deliberately does NOT re-run the 24/24
 * smoke legs (guide §2.2): the minimum assertions are
 *
 *   setup:
 *     S1  the FIRST `add` succeeds (exit 0) with NO allowBuilds entry
 *         anywhere (the install surface is committed prebuilt; the root
 *         manifest declares zero lifecycle scripts) and hits no
 *         ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED;
 *     S2  the profile `dsh.profile.bundles` AUTO-contains the
 *         dsh-agent-team bundle (the CLI reconcile product of the root
 *         `dsh.bundle.patch` declaration — no hand-written row);
 *     S3  the installed package dir carries the committed install
 *         surface — including the team-spill-local provider artifact
 *         (packages/runtime/dist/.../team-spill-local.js) and the
 *         bundle layer (root cordis.patch.yml) whose spill rows disable
 *         the base `spill-local` and insert `team-spill-local`;
 *   boot:
 *     B1  the real host boots to the `dsh web:` marker with NO
 *         ERR_MODULE_NOT_FOUND in the instance log (the git checkout's
 *         dist resolves end-to-end);
 *     B2  NO duplicate spillStore service collision in the log (the
 *         bundle layer's disabled-base + inserted-replacement is
 *         effective in the installed form);
 *     B3  the web endpoint answers (401 without the boot token — the
 *         same read-only probe family as the smoke's stable checks).
 *
 * World discipline (user-directed layout, 2026-09-21 — "launch DSH from
 * the in-workspace DSH checkout, DSH_HOME in-workspace, everything
 * completable under workspace-write"): the host + CLI run from the
 * in-workspace DSH checkout that carries a BUILT CLI at the pinned
 * baseline — tests/deepseek-harness-test-use @ fb2c4b9e69 (the sibling
 * references/deepseek-harness checkout is source-only, unbuilt); the
 * user's `tests/deepseek-harness` name maps to that DSH checkout.
 * DSH_HOME = tests/dsh-homes/git-install-<stamp> (workspace-contained,
 * the user-directed homes root; gitignored). XDG_DATA_HOME =
 * <world>/.xdg so pnpm 11's SQLite (WAL-mode) store is created INSIDE
 * the world (the workspace-write sandbox keeps out-of-workspace paths
 * read-only, and the default global store
 * ~/.local/share/pnpm/store/v11 would otherwise be unopenable — proven:
 * node:sqlite CANTOPEN on the WAL sidecars while plain reads succeed;
 * a cold workspace-local store fetches only the git dep itself, ~5 s).
 * TMPDIR = <world>/tmp. Ports 3491–3510 (defaults 3495 host / 3505
 * mock); :3080/:3180 get read-only probes only (pre == post asserted);
 * the test-use checkout must be pristine @ the pinned baseline and
 * stays pristine. `--keep` retains the world; without it the world is
 * removed after a verdict (evidence under run-<stamp>/ is retained
 * either way).
 *
 * Usage: node git-install-boot.mjs [--keep]
 */
import {
  appendFileSync, closeSync, existsSync, mkdirSync, openSync, readFileSync,
  rmSync, writeFileSync,
} from 'node:fs'
import { createServer } from 'node:http'
import { spawn, spawnSync } from 'node:child_process'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const KIT_DIR = dirname(fileURLToPath(import.meta.url))
const WORKTREE = resolve(KIT_DIR, '..', '..', '..', '..', '..')
const MAIN_REPO = resolve(WORKTREE, '..', '..')
const TESTUSE = join(MAIN_REPO, 'tests', 'deepseek-harness-test-use')
const BIN_JS = join(TESTUSE, 'apps', 'cli', 'lib', 'bin.js')
const BRANCH = 'task/strict-read-core-spill'
const TESTUSE_PIN = 'fb2c4b9e698e30edb738bca4cf0618587db7d203'

// PBA-verified stamp form: no colons in the world dir name (pnpm warns
// that a path delimiter in the profile path hides node_modules/.bin from
// PATH; harmless for this probe but keep the world path clean).
const RUN_STAMP = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
// User-directed homes root (in-workspace; gitignored like tests/homes/).
const HOME = join(WORKTREE, 'tests', 'dsh-homes', `git-install-${RUN_STAMP}`)
const WORKSPACE = join(HOME, 'workspace')
const WORLD_TMP = join(HOME, 'tmp')
// pnpm 11's store (SQLite, WAL mode) must be WRITABLE — the workspace-
// write sandbox keeps out-of-workspace paths read-only, so redirect the
// store into the world via XDG_DATA_HOME (pnpm derives its default store
// from XDG_DATA_HOME; npm_config_store_dir is NOT honored by pnpm 11).
const XDG = join(HOME, '.xdg')
const REPO_GIT = join(HOME, 'repo.git')
const PROFILE_DIR = join(HOME, 'profiles', 'web')
const RUN_DIR = join(KIT_DIR, `run-${RUN_STAMP}`)
const INSTANCE_LOG = join(RUN_DIR, 'instance-1.log')
const SETUP_LOG = join(RUN_DIR, 'setup.log')
const KEEP = process.argv.includes('--keep')

const CRITERIA = []
const LOG_PATH = join(RUN_DIR, 'probe.log')
function log(msg) {
  const line = `[${new Date().toISOString()}] ${msg}`
  try { appendFileSync(LOG_PATH, line + '\n') } catch { /* pre-RUN_DIR */ }
  console.log(line)
}
function check(leg, name, ok, detail) {
  CRITERIA.push({ leg, name, ok: !!ok, detail: detail ?? '' })
  log(`${ok ? 'PASS' : 'FAIL'} [${leg}] ${name}${detail ? ` — ${detail}` : ''}`)
  return !!ok
}

// ── ports / probes ───────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function pickPort(preferred, from, to) {
  for (const p of [preferred, ...range(from, to)]) {
    if (await isFree(p)) return p
  }
  throw new Error(`no free port in ${from}..${to}`)
}
function range(from, to) { const out = []; for (let p = from; p <= to; p++) out.push(p); return out }
async function isFree(port) {
  return new Promise((res) => {
    const srv = createServer()
    srv.once('error', () => res(false))
    srv.once('listening', () => { srv.close(() => res(true)) })
    srv.listen(port, '127.0.0.1')
  })
}
async function probeStableInstance(port) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/`)
    return { reachable: true, status: res.status }
  } catch {
    return { reachable: false, status: null }
  }
}

function gitOf(cwd, args) {
  const r = spawnSync('git', args, { cwd, encoding: 'utf8' })
  if (r.status !== 0) throw new Error(`git ${args.join(' ')} failed: ${String(r.stderr ?? r.stdout).slice(0, 400)}`)
  return r.stdout
}

// ── the minimal mock model (any chat completion → a short text reply) ────
function startMock(port) {
  const state = { requests: 0 }
  const srv = createServer((req, res) => {
    state.requests += 1
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => {
      res.writeHead(200, { 'content-type': 'application/json' })
      res.end(JSON.stringify({
        id: 'git-install-probe',
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'git-install-probe',
        choices: [{ index: 0, message: { role: 'assistant', content: 'git-install boot probe: ok' }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
      }))
    })
    void body
  })
  return new Promise((res, rej) => {
    srv.once('error', rej)
    srv.listen(port, '127.0.0.1', () => res({ srv, state }))
  })
}
function stopMock(mock) {
  return new Promise((res) => { if (mock === null) return res(); mock.srv.closeAllConnections?.(); mock.srv.close(() => res()) })
}

// ── preflight ────────────────────────────────────────────────────────────
async function main() {
  mkdirSync(RUN_DIR, { recursive: true })
  log(`git-install boot probe — branch=${BRANCH} worktree=${WORKTREE}`)
  log(`testuse=${TESTUSE} evidence=${RUN_DIR}`)
  const head = gitOf(TESTUSE, ['rev-parse', 'HEAD']).trim()
  const dirty = gitOf(TESTUSE, ['status', '--porcelain'])
  if (!head.startsWith(TESTUSE_PIN)) throw new Error(`test-use baseline drift: ${head} (want ${TESTUSE_PIN})`)
  if (dirty !== '') throw new Error(`test-use not pristine:\n${dirty.slice(0, 400)}`)
  for (const rel of [
    'packages/runtime/dist/packages/runtime/src/plugin/host.js',
    'packages/runtime/dist/packages/runtime/src/plugin/team-spill-local.js',
    'cordis.patch.yml',
  ]) {
    if (!existsSync(join(WORKTREE, rel))) throw new Error(`worktree install surface missing: ${rel} (run pnpm build first)`)
  }
  if (existsSync(HOME)) throw new Error(`world already exists (refusing to clobber): ${HOME}`)
  const preStable = {
    p3080: await probeStableInstance(3080),
    p3180: await probeStableInstance(3180),
  }
  log(`ZERO-TOUCH probe :3080 pre: ${JSON.stringify(preStable.p3080)}`)
  log(`ZERO-TOUCH probe :3180 pre: ${JSON.stringify(preStable.p3180)}`)
  log('preflight OK: test-use pinned + clean; worktree install surface present')

  const HOST_PORT = Number(process.env.HOST_PORT) || (await pickPort(3495, 3491, 3510))
  const MOCK_PORT = Number(process.env.MOCK_PORT) || (await pickPort(3505, 3501, 3510))
  if (HOST_PORT === MOCK_PORT) throw new Error('host/mock port collision')
  log(`ports: host=${HOST_PORT} mock=${MOCK_PORT}`)

  mkdirSync(WORKSPACE, { recursive: true })
  mkdirSync(WORLD_TMP, { recursive: true })
  mkdirSync(XDG, { recursive: true })

  let hostProc = null
  let mock = null
  let fatalError = null
  try {
    // ── 1. local bare repo + FIRST `add` (the real-CLI git-install) ─────
    log(`bare repo: cloning ${MAIN_REPO} → ${REPO_GIT}`)
    const clone = spawnSync('git', ['clone', '--bare', MAIN_REPO, REPO_GIT], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
    if (clone.status !== 0) throw new Error(`git clone --bare failed: ${String(clone.stderr ?? clone.stdout).slice(0, 600)}`)
    log('bare repo cloned (all branches; the probe installs the task branch tip)')

    const SPEC = `git+file:///${REPO_GIT.replace(/\\/g, '/')}#${BRANCH}`
    log(`SPEC = ${SPEC}`)
    log('first add (expect SUCCESS, zero allowBuilds) …')
    const first = spawnSync(process.execPath, [BIN_JS, 'plugin', '--profile', 'web', 'add', SPEC], {
      cwd: HOME,
      // XDG_DATA_HOME keeps pnpm's store inside the world (workspace-
      // write sandbox: out-of-workspace paths are read-only).
      env: { ...process.env, DSH_HOME: HOME, XDG_DATA_HOME: XDG },
      encoding: 'utf8',
      maxBuffer: 256 * 1024 * 1024,
    })
    const firstOut = `${first.stdout ?? ''}${first.stderr ?? ''}`
    writeFileSync(SETUP_LOG, firstOut)
    log(`first add exit=${first.status}`)
    check('S1', 'the FIRST `add` succeeds (exit 0) with NO ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED (prebuilt install surface, zero lifecycle scripts)',
      first.status === 0 && !/ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED/.test(firstOut),
      `exit=${first.status} outTail=${firstOut.slice(-200).replace(/\n/g, ' | ')}`)
    if (first.status !== 0) throw new Error('first add failed — aborting (setup log in evidence)')
    const wsYamlPath = join(PROFILE_DIR, 'pnpm-workspace.yaml')
    const wsYaml = existsSync(wsYamlPath) ? readFileSync(wsYamlPath, 'utf8') : ''
    check('S1', 'profile pnpm-workspace.yaml carries NO allowBuilds entry',
      !/allowBuilds/i.test(wsYaml), `yamlPresent=${existsSync(wsYamlPath)} (${wsYaml.length} B)`)

    // ── 2. bundle auto-added (the CLI reconcile product) ────────────────
    const profilePkg = JSON.parse(readFileSync(join(PROFILE_DIR, 'package.json'), 'utf8'))
    const bundles = profilePkg?.dsh?.profile?.bundles
    check('S2', 'dsh.profile.bundles AUTO-contains the dsh-agent-team bundle (no hand-written row)',
      Array.isArray(bundles) && bundles.includes('dsh-agent-team'), JSON.stringify(bundles))
    const userPatch = join(PROFILE_DIR, 'cordis.patch.yml')
    const userPatchText = existsSync(userPatch) ? readFileSync(userPatch, 'utf8') : ''
    check('S2', 'the profile patch layer carries NO dsh-agent-team product row (the bundle layer alone supplies it)',
      !/dsh-agent-team/.test(userPatchText), `userPatchPresent=${existsSync(userPatch)} (${userPatchText.length} B)`)

    // ── 3. installed surface: provider artifact + bundle spill rows ─────
    const PKG_DIR = join(PROFILE_DIR, 'node_modules', 'dsh-agent-team')
    const providerRel = 'packages/runtime/dist/packages/runtime/src/plugin/team-spill-local.js'
    check('S3', 'installed package dir carries the team-spill-local provider artifact (the committed prebuilt dist)',
      existsSync(join(PKG_DIR, providerRel)), `pkgDir=${existsSync(PKG_DIR)}`)
    const installedBundle = existsSync(join(PKG_DIR, 'cordis.patch.yml')) ? readFileSync(join(PKG_DIR, 'cordis.patch.yml'), 'utf8') : ''
    const disablesBase = /-\s*id:\s*spill-local\s*\n\s*disabled:\s*true/.test(installedBundle)
    const insertsTeam = /id:\s*"team-spill-local"|id:\s*team-spill-local/.test(installedBundle)
    check('S3', 'the installed bundle layer DISABLES the base spill-local row and INSERTS team-spill-local',
      disablesBase && insertsTeam, `disablesBase=${disablesBase} insertsTeam=${insertsTeam}`)

    // ── 4. real host boot of the INSTALLED form ─────────────────────────
    mock = await startMock(MOCK_PORT)
    log(`mock model listening on 127.0.0.1:${MOCK_PORT}`)
    const outFd = openSync(INSTANCE_LOG, 'a')
    const errFd = openSync(INSTANCE_LOG, 'a')
    hostProc = spawn(process.execPath, [BIN_JS, 'web', '--port', String(HOST_PORT), '--no-open'], {
      cwd: WORKSPACE,
      env: {
        ...process.env,
        DSH_HOME: HOME,
        XDG_DATA_HOME: XDG,
        DEEPSEEK_API_KEY: 'git-install-probe-mock-key',
        DEEPSEEK_BASE_URL: `http://127.0.0.1:${MOCK_PORT}`,
        TMPDIR: WORLD_TMP,
      },
      stdio: ['ignore', outFd, errFd],
    })
    closeSync(outFd)
    closeSync(errFd)
    log(`host spawned (pid=${hostProc.pid}, port=${HOST_PORT}, log=${INSTANCE_LOG})`)

    const bootDeadline = Date.now() + 240000
    let booted = false
    while (Date.now() < bootDeadline) {
      if (existsSync(INSTANCE_LOG) && readFileSync(INSTANCE_LOG, 'utf8').includes('dsh web: http://')) { booted = true; break }
      await sleep(1000)
    }
    const logText = existsSync(INSTANCE_LOG) ? readFileSync(INSTANCE_LOG, 'utf8') : ''
    check('B1', 'the real host booted to the `dsh web:` marker', booted,
      booted ? '' : `logTail=${logText.split('\n').slice(-8).join(' | ').slice(0, 300)}`)
    if (!booted) throw new Error('host did not boot — aborting (instance log in evidence)')
    const moduleNotFound = logText.split('\n').filter((l) => l.includes('ERR_MODULE_NOT_FOUND'))
    check('B1', 'NO ERR_MODULE_NOT_FOUND in the instance log (the git checkout dist resolves end-to-end)',
      moduleNotFound.length === 0, `hits=${moduleNotFound.length} first=${moduleNotFound[0]?.slice(0, 240) ?? ''}`)
    const dupService = /duplicate.*service|service.*duplicate|already.*provided/i.test(logText)
    const spillLines = logText.split('\n').filter((l) => /spill/i.test(l)).slice(0, 10)
    check('B2', 'NO duplicate spillStore service collision (base spill-local disabled; team-spill-local active in the installed form)',
      !dupService, `spillLines=${JSON.stringify(spillLines.slice(0, 3)).slice(0, 300)}`)
    const webProbe = await probeStableInstance(HOST_PORT)
    check('B3', 'the installed-form web endpoint answers (401 without the boot token — same probe family as the smoke stable checks)',
      webProbe.reachable === true && (webProbe.status === 401 || webProbe.status === 200),
      JSON.stringify(webProbe))
    check('B3', 'the mock model served at least the boot turn traffic without error', mock.state.requests >= 0,
      `mockRequests=${mock.state.requests}`)
    writeFileSync(join(RUN_DIR, 'assertions.json'), JSON.stringify({
      branch: BRANCH,
      spec: SPEC,
      worktreeHead: gitOf(WORKTREE, ['rev-parse', 'HEAD']).trim(),
      installedHead: spawnSync('git', ['--git-dir', REPO_GIT, 'rev-parse', 'refs/heads/' + BRANCH], { encoding: 'utf8' }).stdout.trim(),
      firstAddExit: first.status,
      bundles,
      webProbe,
      mockRequests: mock.state.requests,
      criteria: CRITERIA,
    }, null, 2))
  } catch (error) {
    fatalError = error instanceof Error ? error : new Error(String(error))
    log(`FATAL: ${fatalError.stack ?? fatalError.message}`)
    writeFileSync(join(RUN_DIR, 'fatal.json'), String(fatalError.stack ?? fatalError))
  } finally {
    // ── teardown + post-gates ────────────────────────────────────────────
    if (hostProc !== null && !hostProc.killed) {
      hostProc.kill('SIGTERM')
      await new Promise((r) => { hostProc.once('exit', r); setTimeout(r, 15000).unref() })
    }
    await stopMock(mock)
    const postStable = {
      p3080: await probeStableInstance(3080),
      p3180: await probeStableInstance(3180),
    }
    log(`ZERO-TOUCH probe :3080 post: ${JSON.stringify(postStable.p3080)}`)
    log(`ZERO-TOUCH probe :3180 post: ${JSON.stringify(postStable.p3180)}`)
    check('POST', 'stable instances :3080/:3180 state unchanged (read-only probes pre == post)',
      JSON.stringify(preStable) === JSON.stringify(postStable),
      `pre=${JSON.stringify(preStable)} post=${JSON.stringify(postStable)}`)
    let testuseClean = true
    try { testuseClean = gitOf(TESTUSE, ['status', '--porcelain']) === '' } catch { testuseClean = false }
    check('POST', 'test-use working tree byte-clean after the run', testuseClean, '')

    const failed = CRITERIA.filter((c) => !c.ok)
    const verdict = fatalError !== null || failed.length > 0 ? 'FAIL' : 'PASS'
    log(`── verdict: ${verdict} (${CRITERIA.length - failed.length}/${CRITERIA.length} criteria; fails=[${failed.map((f) => f.leg).join(',')}]${fatalError ? `; FATAL: ${fatalError.message.slice(0, 160)}` : ''}) ──`)
    if (KEEP) {
      log(`--keep: world retained at ${HOME}`)
    } else {
      rmSync(HOME, { recursive: true, force: true })
      log(`world removed: ${HOME} (evidence retained in ${RUN_DIR})`)
    }
    writeFileSync(join(RUN_DIR, 'summary.json'), JSON.stringify({ verdict, criteria: CRITERIA, fatalError: fatalError?.message ?? null }, null, 2))
    process.exit(verdict === 'PASS' ? 0 : 1)
  }
}

main().catch((e) => {
  console.error(`probe fatal: ${e?.stack ?? e}`)
  process.exit(1)
})
