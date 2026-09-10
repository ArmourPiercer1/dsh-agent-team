#!/usr/bin/env node
/**
 * cap-legacy-setup.mjs — the R1 legacy-regression world setup.
 *
 * Same world-building chain as cap-setup.mjs (fresh in-workspace DSH_HOME +
 * local bare repo + test-use BUILT CLI `plugin --profile web add`), installs
 * the int/alpha1-capability-wiring branch, but writes a MINIMAL user-layer
 * patch that does NOT override the shipped `dsh-agent-team` row — so the
 * BUNDLE layer's shipped config (the `my-team-bp-1` inline blueprint, the
 * legacy default with NO `capabilities` field) stands. This is the R1
 * regression world: it verifies the legacy full-10-catalog still works
 * (no per-teammate capability selection) after the alpha.1 changes.
 *
 * The user-layer patch carries only the test-harness rows: the p6t6
 * observability row + the headless directory-picker pin.
 *
 * Evidence: <EV>/cap-legacy-setup-<stamp>.log + cap-legacy-assertions-<stamp>.json
 *
 * Usage: node cap-legacy-setup.mjs
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
  console.error(`FAIL — test-use CLI not built: ${BIN_JS}`)
  process.exit(1)
}

const STAMP = process.env.CAP_STAMP ?? new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const HOME = join(REPO, 'references', `.dsh-test-caplegacy-${STAMP}`)
const PROFILE_DIR = join(HOME, 'profiles', 'web')
const PKG_DIR = join(PROFILE_DIR, 'node_modules', 'dsh-agent-team')
const REPO_GIT = join(HOME, 'repo.git')
const BRANCH = 'task/alpha1-hardening'
const SPEC = `git+file:///${REPO_GIT.replace(/\\/g, '/')}#${BRANCH}`
const LOG = join(EV, `cap-legacy-setup-${STAMP}.log`)
const ASSERT_FILE = join(EV, `cap-legacy-assertions-${STAMP}.json`)

const log = (line) => {
  const stamped = `[${new Date().toISOString()}] ${line}`
  appendFileSync(LOG, stamped + '\n')
  console.log(stamped)
}
const die = (msg) => { log(`FAIL — ${msg}`); process.exit(1) }

// ── 1. fresh world + local bare repo ────────────────────────────────────────
if (existsSync(HOME)) die(`world already exists (refusing to clobber): ${HOME}`)
mkdirSync(HOME, { recursive: true })
log(`world: ${HOME}`)
log(`bare repo: cloning ${REPO} (branch ${BRANCH}) → ${REPO_GIT}`)
const clone = spawnSync('git', ['clone', '--bare', REPO, REPO_GIT], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
if (clone.status !== 0) die(`git clone --bare failed: ${String(clone.stderr ?? clone.stdout).slice(0, 800)}`)
log('bare repo cloned')

// ── 2. install the hardening branch ────────────────────────────────────────
log(`SPEC = ${SPEC}`)
log('installing plugin (task/alpha1-hardening) …')
const first = spawnSync(process.execPath, [BIN_JS, 'plugin', '--profile', 'web', 'add', SPEC], {
  cwd: HOME,
  env: { ...process.env, DSH_HOME: HOME },
  encoding: 'utf8',
  maxBuffer: 256 * 1024 * 1024,
})
const firstOut = `${first.stdout ?? ''}${first.stderr ?? ''}`
writeFileSync(join(EV, `cap-legacy-setup-${STAMP}-first-add.txt`), firstOut)
log(`install exit=${first.status}`)
if (first.status !== 0) die(`install FAILED:\n${firstOut.slice(-1500)}`)
log('install SUCCEEDED')

// ── 3. assertions ───────────────────────────────────────────────────────────
const assertions = {}
const assert = (label, ok, detail) => {
  assertions[label] = { ok: !!ok, detail: detail ?? null }
  log(`${ok ? 'PASS' : 'FAIL'} ${label}${detail !== undefined && detail !== null ? ` — ${typeof detail === 'string' ? detail.slice(0, 300) : JSON.stringify(detail)}` : ''}`)
  if (!ok) die(`assertion failed: ${label}`)
}
assert('installed package dir exists', existsSync(PKG_DIR))
const installedRootPkg = JSON.parse(readFileSync(join(PKG_DIR, 'package.json'), 'utf8'))
assert('installed version is 0.1.1-alpha.1', installedRootPkg?.version === '0.1.1-alpha.1', installedRootPkg?.version ?? null)
assert('installed root manifest declares dsh.bundle.patch', installedRootPkg?.dsh?.bundle?.patch === './cordis.patch.yml')
const profilePkg = JSON.parse(readFileSync(join(PROFILE_DIR, 'package.json'), 'utf8'))
const bundles = profilePkg?.dsh?.profile?.bundles
assert('dsh.profile.bundles AUTO-contains the dsh-agent-team bundle',
  Array.isArray(bundles) && JSON.stringify(bundles).includes('dsh-agent-team'), JSON.stringify(bundles))

// ── 4. the LEGACY user-layer patch (NO dsh-agent-team override) ─────────────
// The bundle layer's shipped `dsh-agent-team` row (the `my-team-bp-1` inline
// blueprint, the legacy default with NO capabilities field) stands. The
// user layer carries only the test-harness rows (p6t6 observability + the
// headless directory-picker pin).
const patchLines = [
  `# cap-legacy user-layer patch (world ${STAMP}): R1 legacy regression.`,
  '#',
  '# NO dsh-agent-team override — the BUNDLE layer shipped row (the',
  '# my-team-bp-1 inline blueprint, the legacy default with NO capabilities',
  '# field) stands. This world verifies the legacy full-10-catalog still',
  '# works (no per-teammate capability selection) after the alpha.1 changes.',
  '#',
  '# The user layer carries only the test-harness rows.',
  '- insert:',
  `    - id: "p6t6-team-tools"`,
  `      name: "${pathToFileURL(join(REPO, 'packages', 'tools', 'harness', 'plugin.mjs')).href}"`,
  '- id: "directory-picker"',
  '  disabled: true',
  '- insert:',
  '    - id: "directory-picker-browse"',
  '      name: "@deepseek-ai/dsh-host-directory-picker-browse"',
  '    - id: "directory-picker-browse-client"',
  '      name: "@deepseek-ai/dsh-client-ui-directory-picker-browse"',
  '',
]
const patchPath = join(PROFILE_DIR, 'cordis.patch.yml')
writeFileSync(patchPath, patchLines.join('\n'))
log(`legacy user-layer patch written to ${patchPath}`)

assertions.spec = SPEC
assertions.worldHome = HOME
assertions.installDir = PKG_DIR
assertions.branch = BRANCH
assertions.installExit = first.status
writeFileSync(ASSERT_FILE, JSON.stringify(assertions, null, 2))
log(`assertions → ${ASSERT_FILE}`)
log('CAP-LEGACY-SETUP-OK')
console.log('CAP-LEGACY-SETUP-OK')
