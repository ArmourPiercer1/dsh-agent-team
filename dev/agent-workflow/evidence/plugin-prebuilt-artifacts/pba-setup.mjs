#!/usr/bin/env node
/**
 * pba-setup.mjs — plugin-prebuilt-artifacts D5-equivalent step 1–2 (task
 * brief §D5): the REAL-CLI git-install path in a fresh workspace-internal
 * world, with the CORE PBA criterion:
 *
 *   the FIRST `add` must SUCCEED (exit 0) with NO allowBuilds entry anywhere
 *   — the install surface is committed prebuilt and the root package.json
 *   declares zero lifecycle scripts, so pnpm ≥10's git-dep build-script
 *   policy has nothing to block. The kit is FAIL-LOUD: any first-add failure
 *   aborts (unlike the PBF kit, which expected the block and retried with an
 *   allowBuilds key).
 *
 *   1. fresh DSH_HOME = references/.dsh-test-pba-<stamp> + a LOCAL BARE repo
 *      cloned from the main repository (carries the
 *      task/plugin-prebuilt-artifacts branch = the code under test) — the
 *      git+file:// spec is the github: spec's local equivalent (pnpm's
 *      git-dep script-blocking semantics are identical for any git spec; the
 *      user's real github: run reproduced the PBF-era block signature);
 *   2. the test-use BUILT CLI (references/deepseek-harness-test-use @
 *      76fda72979, 0.1.2-rc.1) runs
 *      `node apps/cli/lib/bin.js plugin --profile web add <spec>`;
 *   3. assertions (all fail-closed):
 *        - profile pnpm-workspace.yaml carries NO allowBuilds entry
 *          (structural precondition — the whole point of the task);
 *        - installed root package.json declares ZERO lifecycle scripts
 *          (no prepare/preinstall/postinstall/preprepare in scripts);
 *        - profile package.json dependencies carry dsh-agent-team (exact spec);
 *        - `dsh.profile.bundles` AUTO-contains the dsh-agent-team bundle
 *          (CLI reconcile product of the root `dsh.bundle.patch`
 *          declaration — NO hand-written profile row anywhere);
 *        - the installed package dir carries the committed install surface
 *          (dist host.js + dist glue mirror + composition-shim
 *          client-bundle.js + seam.mjs);
 *        - CONTENT-IDENTITY: each of those artifacts' sha256 (LF-normalized —
 *          consumer-side git checkouts smudge CRLF via the system autocrlf
 *          default; git's clean filter maps CRLF→LF, so identity is asserted
 *          on the normalized form) equals the task tree's committed copy
 *          (the PBA baseline = the task worktree).
 *
 * Evidence: <EV>/pba-setup-<stamp>.log + pba-assertions-<stamp>.json
 *           + pba-setup-<stamp>-first-add.txt.
 *
 * Usage: node pba-setup.mjs          (PBA_STAMP optional)
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { createHash } from 'node:crypto'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync } from 'node:child_process'

const EV = dirname(fileURLToPath(import.meta.url))
function findRepoRoot(start) {
  let dir = start
  for (;;) {
    if (existsSync(join(dir, 'references', 'deepseek-harness-test-use'))) return dir
    const parent = dirname(dir)
    if (parent === dir) throw new Error(`no ancestor of ${start} contains references/deepseek-harness-test-use`)
    dir = parent
  }
}
const REPO = findRepoRoot(EV)
const HOST_TREE = join(REPO, 'references', 'deepseek-harness-test-use')
const BIN_JS = join(HOST_TREE, 'apps', 'cli', 'lib', 'bin.js')
if (!existsSync(BIN_JS)) {
  console.error(`FAIL — test-use CLI not built: ${BIN_JS} (build the test-use checkout first)`)
  process.exit(1)
}
// Task tree under test = the worktree that contains THIS evidence dir
// (walk up until an ancestor carries both the committed install surface and
// the dev/agent-workflow tree — the task worktree root).
function findTaskTree(start) {
  let dir = start
  for (;;) {
    if (existsSync(join(dir, 'packages', 'runtime', 'dist')) && existsSync(join(dir, 'dev', 'agent-workflow'))) return dir
    const parent = dirname(dir)
    if (parent === dir) throw new Error(`no ancestor of ${start} looks like the task worktree root`)
    dir = parent
  }
}
const TASK_TREE = findTaskTree(EV)

const STAMP = process.env.PBA_STAMP ?? new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const HOME = join(REPO, 'references', `.dsh-test-pba-${STAMP}`)
const PROFILE_DIR = join(HOME, 'profiles', 'web')
const REPO_GIT = join(HOME, 'repo.git')
const BRANCH = 'task/plugin-prebuilt-artifacts'
// git+file:///<drive>:/path/repo.git — THREE slashes + drive colon (PBF probe-verified).
const SPEC = `git+file:///${REPO_GIT.replace(/\\/g, '/')}#${BRANCH}`
const LOG = join(EV, `pba-setup-${STAMP}.log`)
const ASSERT_FILE = join(EV, `pba-assertions-${STAMP}.json`)

const log = (line) => {
  const stamped = `[${new Date().toISOString()}] ${line}`
  appendFileSync(LOG, stamped + '\n')
  console.log(stamped)
}
const die = (msg) => {
  log(`FAIL — ${msg}`)
  process.exit(1)
}
const sha256 = (buf) => createHash('sha256').update(buf).digest('hex')
// Consumer-side git checkouts may smudge CRLF (system-default autocrlf on
// Windows); git's CLEAN filter maps CRLF → LF, so identity is asserted on
// the normalized (LF) form — exactly what the committed blob contains.
const normLF = (buf) => buf.toString('utf8').replace(/\r\n/g, '\n')

// ── 1. fresh world + local bare repo ────────────────────────────────────────
if (existsSync(HOME)) die(`world already exists (refusing to clobber): ${HOME}`)
mkdirSync(HOME, { recursive: true })
log(`world: ${HOME}`)
log(`task tree under test (byte-identity baseline): ${TASK_TREE} @ ${spawnSync('git', ['rev-parse', '--short', 'HEAD'], { cwd: TASK_TREE, encoding: 'utf8' }).stdout.trim()}`)
log(`bare repo: cloning ${REPO} (branch ${BRANCH}) → ${REPO_GIT}`)
const clone = spawnSync('git', ['clone', '--bare', REPO, REPO_GIT], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
if (clone.status !== 0) die(`git clone --bare failed: ${String(clone.stderr ?? clone.stdout).slice(0, 800)}`)
log('bare repo cloned')

// ── 2. FIRST `add` — must SUCCEED directly (the core PBA criterion) ─────────
log(`SPEC = ${SPEC}`)
log('first add (expect SUCCESS with zero allowBuilds — the PBA core criterion) …')
const first = spawnSync(process.execPath, [BIN_JS, 'plugin', '--profile', 'web', 'add', SPEC], {
  cwd: HOME,
  env: { ...process.env, DSH_HOME: HOME },
  encoding: 'utf8',
  maxBuffer: 256 * 1024 * 1024,
})
const firstOut = `${first.stdout ?? ''}${first.stderr ?? ''}`
writeFileSync(join(EV, `pba-setup-${STAMP}-first-add.txt`), firstOut)
log(`first add exit=${first.status}`)
if (first.status !== 0) {
  die(`first add FAILED — the PBA core criterion is violated (install surface must need no build scripts):\n${firstOut.slice(-1500)}`)
}
if (/ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED/.test(firstOut)) {
  die('first add hit ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED — a build script is still declared (regression)')
}
log('first add SUCCEEDED directly — zero allowBuilds, zero retries (PBA core criterion met)')

// ── 3. assertions ------------------------------------------------------------
const assertions = {}
const assert = (label, ok, detail) => {
  assertions[label] = { ok: !!ok, detail: detail ?? null }
  log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail !== undefined && detail !== null ? ` — ${typeof detail === 'string' ? detail.slice(0, 300) : JSON.stringify(detail)}` : ''}`)
  if (!ok) die(`assertion failed: ${label}`)
}

// 3a. profile pnpm-workspace.yaml: NO allowBuilds entry (structural precondition).
const wsYamlPath = join(PROFILE_DIR, 'pnpm-workspace.yaml')
const wsYaml = existsSync(wsYamlPath) ? readFileSync(wsYamlPath, 'utf8') : ''
assert('profile pnpm-workspace.yaml carries NO allowBuilds entry (the point of the task)',
  !/allowBuilds/i.test(wsYaml), `yaml present=${existsSync(wsYamlPath)} (${wsYaml.length} B)`)

// 3b. installed root package.json: ZERO lifecycle scripts (structural no-block proof).
const PKG_DIR = join(PROFILE_DIR, 'node_modules', 'dsh-agent-team')
assert('installed package dir exists (the git checkout)', existsSync(PKG_DIR))
const installedRootPkg = JSON.parse(readFileSync(join(PKG_DIR, 'package.json'), 'utf8'))
const scripts = installedRootPkg?.scripts ?? {}
const lifecycle = ['prepare', 'preprepare', 'preinstall', 'install', 'postinstall'].filter((k) => k in scripts)
assert('installed root manifest declares ZERO lifecycle scripts (pnpm has nothing to block)',
  lifecycle.length === 0, `scripts keys: ${JSON.stringify(Object.keys(scripts))}`)

// 3c. profile manifest + bundle registration (unchanged PBF criteria).
const profilePkg = JSON.parse(readFileSync(join(PROFILE_DIR, 'package.json'), 'utf8'))
assert('profile dependencies carry dsh-agent-team @ the exact spec',
  profilePkg?.dependencies?.['dsh-agent-team'] === SPEC, profilePkg?.dependencies?.['dsh-agent-team'] ?? null)
const bundles = profilePkg?.dsh?.profile?.bundles
assert('dsh.profile.bundles AUTO-contains the dsh-agent-team bundle (CLI reconcile product)',
  Array.isArray(bundles) && JSON.stringify(bundles).includes('dsh-agent-team'),
  JSON.stringify(bundles))
assert('profile cordis.patch.yml carries NO dsh-agent-team row (the bundle layer alone supplies it)',
  (() => {
    const patch = join(PROFILE_DIR, 'cordis.patch.yml')
    if (!existsSync(patch)) return true
    return !/dsh-agent-team/.test(readFileSync(patch, 'utf8'))
  })(), existsSync(join(PROFILE_DIR, 'cordis.patch.yml')) ? 'user patch absent or clean' : 'user patch absent')

// 3d. committed install surface: presence + BYTE-IDENTITY vs the task tree.
const artifacts = {
  'host.js (dist entry)': ['packages/runtime/dist/packages/runtime/src/plugin/host.js'],
  'agent-bindings.mjs (dist glue mirror)': ['packages/runtime/dist/packages/runtime/src/plugin/live/agent-bindings.mjs'],
  'seam.mjs (root-binding)': ['packages/runtime/root-binding/harness/seam.mjs'],
  'upstream-resolver.mjs': ['packages/runtime/src/plugin/upstream-resolver.mjs'],
  'cordis.patch.yml (bundle layer)': ['cordis.patch.yml'],
  'client-bundle.js (composition shim)': ['packages/client/composition-shim/client-bundle.js'],
  'shim index.js': ['packages/client/composition-shim/index.js'],
  'shim package.json': ['packages/client/composition-shim/package.json'],
}
const shas = {}
for (const [label, [rel]] of Object.entries(artifacts)) {
  const installed = join(PKG_DIR, ...rel.split('/'))
  const baseline = join(TASK_TREE, ...rel.split('/'))
  assert(`committed artifact present: ${label}`, existsSync(installed) && existsSync(baseline))
  if (!existsSync(installed) || !existsSync(baseline)) continue
  const a = readFileSync(installed)
  const b = readFileSync(baseline)
  const aN = sha256(normLF(a))
  const bN = sha256(normLF(b))
  shas[label] = {
    installedSha256: sha256(a),
    baselineSha256: sha256(b),
    installedNormalizedSha256: aN,
    baselineNormalizedSha256: bN,
    bytes: a.length,
    normalizedBytes: normLF(a).length,
  }
  assert(`content-identical (LF-normalized) to task tree baseline: ${label}`, aN === bN,
    `installed=${aN.slice(0, 12)}… baseline=${bN.slice(0, 12)}… (${a.length} B raw / ${normLF(a).length} B LF)`)
}

assert('installed root manifest declares dsh.bundle.patch', installedRootPkg?.dsh?.bundle?.patch === './cordis.patch.yml')
assert('installed root manifest declares dsh.client web', JSON.stringify(installedRootPkg?.dsh?.client) === JSON.stringify({ platform: 'web' }))

// shell:true — spawnSync does not resolve PATHEXT (pnpm.cmd) on Windows.
const pnpmRes = spawnSync('pnpm', ['--version'], { encoding: 'utf8', shell: true })
const pnpmVer = (pnpmRes.stdout ?? '').trim() || `unresolved (${pnpmRes.error?.code ?? 'unknown'})`

assertions.spec = SPEC
assertions.worldHome = HOME
assertions.installDir = PKG_DIR
assertions.taskTree = TASK_TREE
assertions.pnpmVersion = pnpmVer
assertions.firstAddExit = first.status
assertions.allowBuildsInProfileYaml = false
assertions.lifecycleScriptsDeclared = lifecycle
assertions.artifacts = shas
writeFileSync(ASSERT_FILE, JSON.stringify(assertions, null, 2))
log(`assertions → ${ASSERT_FILE}`)
log('PBA-SETUP-OK')
console.log('PBA-SETUP-OK')
