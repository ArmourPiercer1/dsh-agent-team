#!/usr/bin/env node
/**
 * d5-setup.mjs — plugin-bundle-form D5 step 1–2 (task brief §D5): the
 * REAL-CLI git-install path in a fresh workspace-internal world.
 *
 *   1. fresh DSH_HOME = references/.dsh-test-pbf-<stamp> + a LOCAL BARE
 *      repo cloned from the main repository (carries the
 *      task/plugin-bundle-form branch = the code under test) — the
 *      git+file:// spec is the github: spec's local equivalent (pnpm's
 *      prepare-blocking semantics are identical for any git spec);
 *   2. the test-use BUILT CLI (references/deepseek-harness-test-use
 *      @ 76fda72979, 0.1.2-rc.1) runs
 *      `node apps/cli/lib/bin.js plugin --profile web add <spec>`:
 *        - FIRST run: pnpm 11 HARD-FAILS the git dependency's prepare
 *          ([ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED]); the exact printed
 *          allowBuilds key (name@spec#commit) is captured as evidence;
 *        - the key is written into the profile's OWN pnpm-workspace.yaml
 *          (initProfile-created) under allowBuilds:;
 *        - RE-RUN: install succeeds AND prepare runs (nested
 *          `pnpm install --ignore-scripts && pnpm build && pnpm build:composition`);
 *   3. assertions (all fail-closed):
 *        - profile package.json dependencies carry dsh-agent-team (the
 *          exact spec);
 *        - `dsh.profile.bundles` AUTO-contains the dsh-agent-team bundle
 *          (the CLI reconcile product of the root `dsh.bundle.patch`
 *          declaration — NO hand-written profile row anywhere);
 *        - the installed package dir carries the prepare-built install
 *          surface (dist host.js + dist glue mirror + composition-shim
 *          client-bundle.js + seam.mjs).
 *
 * Evidence: <EV>/d5-setup-<stamp>.log + d5-assertions-<stamp>.json.
 *
 * Usage: node d5-setup.mjs          (D5_STAMP optional)
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
import { fileURLToPath, pathToFileURL } from 'node:url'
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

const STAMP = process.env.D5_STAMP ?? new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const HOME = join(REPO, 'references', `.dsh-test-pbf-${STAMP}`)
const PROFILE_DIR = join(HOME, 'profiles', 'web')
const REPO_GIT = join(HOME, 'repo.git')
const BRANCH = 'task/plugin-bundle-form'
// git+file:///<drive>:/path/repo.git — THREE slashes + drive colon
// (two-slash form is mangled by pnpm to file://D/... → git "not a
// repository"; probe-verified in .pbf-prepare-probe4.mjs).
const SPEC = `git+file:///${REPO_GIT.replace(/\\/g, '/')}#${BRANCH}`
const LOG = join(EV, `d5-setup-${STAMP}.log`)
const ASSERT_FILE = join(EV, `d5-assertions-${STAMP}.json`)

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

// ── 1. fresh world + local bare repo ────────────────────────────────────────
if (existsSync(HOME)) die(`world already exists (refusing to clobber): ${HOME}`)
mkdirSync(HOME, { recursive: true })
log(`world: ${HOME}`)
log(`bare repo: cloning ${REPO} (branch ${BRANCH}) → ${REPO_GIT}`)
const clone = spawnSync('git', ['clone', '--bare', REPO, REPO_GIT], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
if (clone.status !== 0) die(`git clone --bare failed: ${String(clone.stderr ?? clone.stdout).slice(0, 800)}`)
log('bare repo cloned')

// ── 2a. FIRST `add` — expect the pnpm prepare hard-fail ---------------------
// The CLI anchors everything on DSH_HOME (the HOME env var); cwd is fixed to
// the world root for determinism.
log(`SPEC = ${SPEC}`)
log('first add (expect [ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED] hard fail) …')
const first = spawnSync(process.execPath, [BIN_JS, 'plugin', '--profile', 'web', 'add', SPEC], {
  cwd: HOME,
  env: { ...process.env, DSH_HOME: HOME },
  encoding: 'utf8',
  maxBuffer: 256 * 1024 * 1024,
})
const firstOut = `${first.stdout ?? ''}${first.stderr ?? ''}`
writeFileSync(join(EV, `d5-setup-${STAMP}-first-add.txt`), firstOut)
log(`first add exit=${first.status}`)
if (first.status === 0) die('first add SUCCEEDED unexpectedly — pnpm did not block the git-dep prepare (environment drift?)')
if (!/ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED/.test(firstOut)) {
  die(`first add failed but NOT with the prepare blocker (unexpected failure class): ${firstOut.slice(-800)}`)
}
log('first add blocked with ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED (expected) — evidence saved')

// Extract the EXACT allowBuilds key pnpm printed (the line after the
// `allowBuilds:` hint line — the full name@spec#commit, never the bare name).
const lines = firstOut.split(/\r?\n/)
let key = null
for (let i = 0; i < lines.length; i++) {
  const m = lines[i].match(/allowBuilds:\s*$/)
  if (!m) continue
  for (let j = i + 1; j < lines.length; j++) {
    const t = lines[j].trim()
    if (t.length === 0) continue
    const km = t.match(/^([^\s:]+@[^#\s]+#[0-9a-f]+)\s*:\s*true\s*$/i)
    if (km) { key = km[1]; break }
    break // a non-key line ends the block
  }
  if (key) break
}
if (key === null) die(`could not extract the allowBuilds key from the printed hint:\n${lines.slice(-30).join('\n')}`)
log(`allowBuilds key (exact, as printed): ${key}`)

// ── 2b. write the key into the profile's OWN pnpm-workspace.yaml -----------
if (!existsSync(PROFILE_DIR)) die(`profile dir missing after first add: ${PROFILE_DIR} (initProfile should have created it)`)
const wsYamlPath = join(PROFILE_DIR, 'pnpm-workspace.yaml')
let wsYaml = existsSync(wsYamlPath) ? readFileSync(wsYamlPath, 'utf8') : ''
log(`profile pnpm-workspace.yaml present=${existsSync(wsYamlPath)} (${wsYaml.length} B)`)
if (/^allowBuilds:/m.test(wsYaml)) die('profile pnpm-workspace.yaml already has allowBuilds (unexpected on a fresh world)')
wsYaml = wsYaml.trimEnd()
wsYaml = (wsYaml.length > 0 ? wsYaml + '\n' : '') + `allowBuilds:\n  ${key}: true\n`
writeFileSync(wsYamlPath, wsYaml)
log(`allowBuilds written: ${wsYamlPath}`)

// ── 2c. RE-RUN add — expect success + prepare execution --------------------
log('re-running add (allowBuilds in place) …')
const second = spawnSync(process.execPath, [BIN_JS, 'plugin', '--profile', 'web', 'add', SPEC], {
  cwd: HOME,
  env: { ...process.env, DSH_HOME: HOME },
  encoding: 'utf8',
  maxBuffer: 256 * 1024 * 1024,
})
const secondOut = `${second.stdout ?? ''}${second.stderr ?? ''}`
writeFileSync(join(EV, `d5-setup-${STAMP}-second-add.txt`), secondOut)
log(`second add exit=${second.status}`)
if (second.status !== 0) die(`second add failed:\n${secondOut.slice(-1200)}`)
log('second add OK')

// ── 3. assertions ------------------------------------------------------------
const assertions = {}
const assert = (label, ok, detail) => {
  assertions[label] = { ok: !!ok, detail: detail ?? null }
  log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail !== undefined && detail !== null ? ` — ${typeof detail === 'string' ? detail.slice(0, 300) : JSON.stringify(detail)}` : ''}`)
  if (!ok) die(`assertion failed: ${label}`)
}

const profilePkgPath = join(PROFILE_DIR, 'package.json')
if (!existsSync(profilePkgPath)) die(`profile package.json missing: ${profilePkgPath}`)
const profilePkg = JSON.parse(readFileSync(profilePkgPath, 'utf8'))
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

const PKG_DIR = join(PROFILE_DIR, 'node_modules', 'dsh-agent-team')
assert('installed package dir exists (the git checkout)', existsSync(PKG_DIR))
const artifacts = {
  'host.js (dist entry)': join(PKG_DIR, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js'),
  'agent-bindings.mjs (dist glue mirror)': join(PKG_DIR, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs'),
  'seam.mjs (root-binding)': join(PKG_DIR, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs'),
  'client-bundle.js (composition shim)': join(PKG_DIR, 'packages', 'client', 'composition-shim', 'client-bundle.js'),
  'shim index.js': join(PKG_DIR, 'packages', 'client', 'composition-shim', 'index.js'),
  'shim package.json': join(PKG_DIR, 'packages', 'client', 'composition-shim', 'package.json'),
  'root package.json (dsh.bundle declared)': join(PKG_DIR, 'package.json'),
}
const shas = {}
for (const [label, p] of Object.entries(artifacts)) {
  assert(`prepare-built artifact present: ${label}`, existsSync(p))
  if (existsSync(p)) shas[label] = { path: p, bytes: readFileSync(p).length, sha256: sha256(readFileSync(p)) }
}
const rootPkgInstalled = JSON.parse(readFileSync(artifacts['root package.json (dsh.bundle declared)'], 'utf8'))
assert('installed root manifest declares dsh.bundle.patch', rootPkgInstalled?.dsh?.bundle?.patch === './cordis.patch.yml')
assert('installed root manifest declares dsh.client web', JSON.stringify(rootPkgInstalled?.dsh?.client) === JSON.stringify({ platform: 'web' }))

assertions.allowBuildsKey = key
assertions.spec = SPEC
assertions.worldHome = HOME
assertions.installDir = PKG_DIR
assertions.artifacts = shas
assertions.secondAddExit = second.status
writeFileSync(ASSERT_FILE, JSON.stringify(assertions, null, 2))
log(`assertions → ${ASSERT_FILE}`)
log('D5-SETUP-OK')
console.log('D5-SETUP-OK')
