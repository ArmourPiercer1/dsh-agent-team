#!/usr/bin/env node
/**
 * r8-setup.mjs — issue #1 (R8 live-host final acceptance) world setup.
 *
 * Builds ONE world under references/.dsh-test-issue1-<stamp> (fresh
 * in-workspace DSH_HOME + a plain directory copy of the TASK worktree +
 * the test-use BUILT CLI `plugin --profile web add file:<abs repo-copy>`
 * — the ABSOLUTE spec because the CLI anchors relative file: specs to its
 * invoking dir, see the spec note below).
 *
 * INSTALL MECHANISM NOTE (sandbox-adapted from the H3 V1 bare-repo
 * method): `dsh plugin add` forwards to `pnpm add` in the profile dir;
 * `pnpm add git+file://…` spawns git (upload-pack over pipes), which the
 * workspace-write sandbox denies (named-pipe creation, "couldn't create
 * signal pipe, Win32 error 5"). Instead this setup robocopies the task
 * worktree (the checkout at the task branch tip — WIP commit, i.e. the
 * async-delegation repair + its rebuilt install-surface dist) into
 * <home>/repo-copy and installs it as a `file:` dependency. pnpm packs
 * the directory through the same root `files` whitelist the git install
 * used (the H3 world's installed tree proves the pack surface: only
 * cordis.patch.yml + packages/client/composition-shim +
 * packages/runtime/dist + root-binding + upstream-resolver.mjs land in
 * node_modules), so the install surface is identical. The setup asserts
 * the installed version against the task worktree's root package.json.
 *
 * The user-layer patch OVERRIDES the shipped dsh-agent-team row (last-
 * write-wins, whole config) with:
 *   - the team.issue1 blueprint: leader + worker-a + worker-b, NO
 *     capabilities field (the legacy default = the FULL eleven-tool
 *     catalog, incl. the new team_collect), teamEnvelope allow for the
 *     leader (assign-task + create-member + send-message + report-
 *     progress + request-control + resolve-control — the V1-2 instance-
 *     caller envelope ruling), NO member envelopes (members never make
 *     team calls in this world; they only answer work turns),
 *   - seedMembers inst-r8a (worker-a, session-r8a-a) + inst-r8b (worker-
 *     b, session-r8b-b),
 *   - staticModel deepseek-official/deepseek-v4-flash (every agent's
 *     model resolves via the DEEPSEEK_BASE_URL env → the R8 mock proxy),
 *   - mcpServer null (no MCP in this world) + explicit defaultWorkspace
 *     (the pre-created, empty team workspace).
 *
 * Both worlds carry the p6t6 observability harness row (a file URL into
 * the TASK worktree's packages/tools/harness/plugin.mjs — the /__p6t6/
 * health|state|tool routes; toolCount is expected to be 11 with the new
 * team_collect tool) + the headless directory-picker pin.
 *
 * Evidence: <EV>/r8-setup-<stamp>.log + r8-assertions-<stamp>.json.
 *
 * Usage: node r8-setup.mjs          (R8_STAMP optional)
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { spawnSync } from 'node:child_process'

const EV = dirname(fileURLToPath(import.meta.url))
function findMainRepoRoot(start) {
  let dir = start
  for (;;) {
    if (existsSync(join(dir, 'references', 'deepseek-harness-test-use'))
      && existsSync(join(dir, '.worktrees', 'RC1', 'tests', 'characterization', 'lib', 'instance.mjs'))) return dir
    const parent = dirname(dir)
    if (parent === dir) throw new Error(`no ancestor of ${start} carries references/deepseek-harness-test-use + .worktrees/RC1`)
    dir = parent
  }
}
const REPO = findMainRepoRoot(EV)
const HOST_TREE = join(REPO, 'references', 'deepseek-harness-test-use')
const BIN_JS = join(HOST_TREE, 'apps', 'cli', 'lib', 'bin.js')

// The R8 TASK WORKTREE (the checkout carrying task/issue1-async-delegation
// + the p6t6 harness plugin.mjs the row loads). Walk up from EV to the
// dsh-agent-team worktree root (packages/ + dev/agent-workflow/).
function findR8Worktree(start) {
  let dir = start
  for (;;) {
    if (existsSync(join(dir, 'packages', 'tools', 'harness', 'plugin.mjs')) && existsSync(join(dir, 'dev', 'agent-workflow', 'graph.yaml'))) return dir
    const parent = dirname(dir)
    if (parent === dir) throw new Error(`no ancestor of ${start} is a dsh-agent-team worktree root`)
    dir = parent
  }
}
const R8_WORKTREE = findR8Worktree(EV)
if (!existsSync(BIN_JS)) {
  console.error(`FAIL — test-use CLI not built: ${BIN_JS} (build the test-use checkout first)`)
  process.exit(1)
}

const STAMP = process.env.R8_STAMP ?? new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const BRANCH = 'task/issue1-async-delegation'
const ROOT_SESSION_ID = 'issue1-root'
// The version the task worktree declares (the install must match it).
const EXPECTED_VERSION = JSON.parse(readFileSync(join(R8_WORKTREE, 'package.json'), 'utf8')).version

const LOG = join(EV, `r8-setup-${STAMP}.log`)
const log = (line) => {
  const stamped = `[${new Date().toISOString()}] ${line}`
  appendFileSync(LOG, stamped + '\n')
  console.log(stamped)
}
const die = (msg) => {
  log(`FAIL — ${msg}`)
  process.exit(1)
}

// ── the team.issue1 Blueprint (embedded; no capabilities = full catalog) ──
const ISSUE1_BLUEPRINT = [
  '---',
  'schemaVersion: 1',
  'blueprintId: team.issue1',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: "You are the leader of the issue1 async delegation test team."',
  'members:',
  '  - templateId: worker-a',
  '    persona: "You are member worker-a of the issue1 async delegation test team."',
  '  - templateId: worker-b',
  '    persona: "You are member worker-b of the issue1 async delegation test team."',
  'requirements: []',
  // V1-2 instance-caller envelope ruling (a2perm live run): the LEADER must
  // drive the members (delegate = assign-task + create-member; follow-up =
  // assign-task), send messages, report progress, and request/resolve
  // control. Members make no team calls in this world (no memberEnvelopes).
  'teamEnvelope:',
  '  allow:',
  '    - assign-task',
  '    - create-member',
  '    - send-message',
  '    - report-progress',
  '    - request-control',
  '    - resolve-control',
  '  deny: []',
  'policyStates: []',
  'metadata: {}',
  '---',
].join('\n')

const HOME = join(REPO, 'references', `.dsh-test-issue1-${STAMP}`)
const WORKSPACE_DIR = join(HOME, 'workspace-r8')
if (process.env.R8_SKIP_COPY === '1') {
  // The pwsh orchestrator created the world dir + repo-copy.
  if (!existsSync(join(HOME, 'repo-copy'))) die(`R8_SKIP_COPY=1 but ${join(HOME, 'repo-copy')} is missing`)
  mkdirSync(WORKSPACE_DIR, { recursive: true })
} else {
  if (existsSync(HOME)) die(`world already exists (refusing to clobber): ${HOME}`)
  mkdirSync(HOME, { recursive: true })
  mkdirSync(WORKSPACE_DIR, { recursive: true })
}
log(`r8 world: ${HOME}`)
log(`install source (task worktree, branch ${BRANCH} tip): ${R8_WORKTREE}`)
log(`expected installed version: ${EXPECTED_VERSION} (from the task worktree root package.json)`)

// robocopy the task worktree → <home>/repo-copy (no git involved — the
// sandbox denies git's pipe spawns; the copy carries the branch tip's
// working tree incl. the rebuilt install-surface dist). The copy is done
// by the PWSH orchestrator (R8_SKIP_COPY=1) because node's spawnSync of
// external programs with piped stdio is EPERM-denied in this sandbox;
// when run without the flag the setup performs the copy itself.
const COPY_DIR = join(HOME, 'repo-copy')
if (process.env.R8_SKIP_COPY === '1') {
  if (!existsSync(join(COPY_DIR, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js'))) {
    die(`R8_SKIP_COPY=1 but the copy is missing/incomplete: ${COPY_DIR} (run the pwsh orchestrator first)`)
  }
  log('copy already present (R8_SKIP_COPY=1) — pwsh orchestrator performed the robocopy')
} else {
  const rob = spawnSync('robocopy', [
    R8_WORKTREE,
    COPY_DIR,
    '/E',
    '/XD', '.git', 'node_modules', 'references', '.worktrees', '.tmp-t12a-b2-home', 'dev',
    '/R:1', '/W:1', '/NFL', '/NDL', '/NJH', '/NJS', '/NP',
  ], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: 'inherit' })
  // robocopy exits 0-7 on success (bit flags), >=8 on failure.
  if (rob.status === null || rob.status >= 8) {
    die(`robocopy failed (status=${rob.status})`)
  }
  log('task worktree copied (robocopy; .git/node_modules/references/.worktrees/dev excluded)')
}
if (!existsSync(join(COPY_DIR, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js'))) {
  die(`copy missing the runtime dist host entry (build the task worktree first): ${join(COPY_DIR, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js')}`)
}

// The CLI's anchorPathSpec (test-use apps/cli/src/plugin.ts L104-112)
// rewrites ONLY arguments that start with `.`/`..` (an optional file:/link:
// prefix is kept) and anchors them to the CLI's INVOKING directory (here
// HOME, the spawn cwd). `file:../repo-copy` therefore resolved to
// <HOME>/.. = references/ — observed as ERR_PNPM_LINKED_PKG_DIR_NOT_FOUND
// against references/repo-copy. Absolute specs do not match the anchor
// regex and pass through to pnpm untouched, so pin the copy dir
// explicitly (forward slashes — pnpm consumes the post-`file:` text as a
// plain fs path, which its own error surface already shows).
const spec = `file:${COPY_DIR.split('\\').join('/')}`
log(`installing plugin ${BRANCH} (worktree tip) via ${spec} …`)
// stdio 'inherit' — the sandbox EPERM-denies piped-stdio node spawns; the
// CLI itself forwards to pnpm with stdio 'inherit' (apps/cli/src/plugin.
// ts), so the whole chain is inherit-only. The transcript is the caller's
// console (captured by the running job).
const first = spawnSync(process.execPath, [BIN_JS, 'plugin', '--profile', 'web', 'add', spec], {
  cwd: HOME,
  env: { ...process.env, DSH_HOME: HOME },
  stdio: 'inherit',
  maxBuffer: 256 * 1024 * 1024,
})
const firstOut = `(stdio inherit — transcript in the calling job console; exit=${first.status})`
writeFileSync(join(EV, `r8-setup-${STAMP}-first-add.txt`), firstOut)
log(`install exit=${first.status}`)
if (first.status !== 0) die(`install FAILED:\n${firstOut.slice(-1500)}`)
log('install SUCCEEDED')

const profileDir = join(HOME, 'profiles', 'web')
const pkgDir = join(profileDir, 'node_modules', 'dsh-agent-team')
const assertions = {}
const assert = (label, ok, detail) => {
  assertions[label] = { ok: !!ok, detail: detail ?? null }
  log(`${ok ? 'PASS' : 'FAIL'} r8: ${label}${detail !== undefined && detail !== null ? ` — ${typeof detail === 'string' ? detail.slice(0, 300) : JSON.stringify(detail)}` : ''}`)
  if (!ok) die(`assertion failed: ${label}`)
}
assert('installed package dir exists', existsSync(pkgDir))
const installedRootPkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
assert(`installed version is ${EXPECTED_VERSION}`, installedRootPkg?.version === EXPECTED_VERSION, installedRootPkg?.version ?? null)
assert('installed root manifest declares dsh.bundle.patch', installedRootPkg?.dsh?.bundle?.patch === './cordis.patch.yml')
const profilePkg = JSON.parse(readFileSync(join(profileDir, 'package.json'), 'utf8'))
const bundles = profilePkg?.dsh?.profile?.bundles
assert('dsh.profile.bundles AUTO-contains the dsh-agent-team bundle',
  Array.isArray(bundles) && JSON.stringify(bundles).includes('dsh-agent-team'), JSON.stringify(bundles))

const p6t6Url = pathToFileURL(join(R8_WORKTREE, 'packages', 'tools', 'harness', 'plugin.mjs')).href
const patchLines = [
  `# r8 user-layer patch (world ${STAMP}): issue #1 R8 live-host final acceptance.`,
  '#',
  '# The dsh-agent-team row OVERRIDES the bundle layer config entirely',
  '# (last-write-wins, whole config): blueprintSource = the team.issue1',
  '# blueprint (leader + worker-a + worker-b, NO capabilities = the full',
  '# eleven-tool catalog incl. team_collect), rootSessionId = issue1-root,',
  '# leader teamEnvelope (the V1-2 instance-caller ruling), seedMembers',
  '# inst-r8a/inst-r8b, mcpServer null, explicit defaultWorkspace.',
  '#',
  '# The p6t6 row name points at the TASK worktree tools harness (a test',
  '# device — /__p6t6/health|state|tool; toolCount is expected to be 11).',
  '# The directory-picker rows are the headless pin.',
  '- id: "dsh-agent-team"',
  '  name: "dsh-agent-team/host"',
  '  config:',
  '    bootPhase: "create"',
  `    rootSessionId: "${ROOT_SESSION_ID}"`,
  '    blueprintSource: |',
  ...ISSUE1_BLUEPRINT.split('\n').map((l) => `      ${l}`),
  '    seedMembers:',
  '      - instanceId: inst-r8a',
  '        templateId: worker-a',
  '        label: member-a',
  '        childSessionId: session-r8a-a',
  '      - instanceId: inst-r8b',
  '        templateId: worker-b',
  '        label: member-b',
  '        childSessionId: session-r8b-b',
  `    defaultWorkspace: ${JSON.stringify(WORKSPACE_DIR)}`,
  '    teamSkills: []',
  '    generation: 1',
  '    deniedSelection: null',
  '    mcpServer: null',
  '    staticModel:',
  '      provider: deepseek-official',
  '      model: deepseek-v4-flash',
  '    environmentFacts:',
  '      - { domain: "tool", subject: "web", available: true, generation: 1 }',
  '      - { domain: "skill", subject: "base", available: true, generation: 1 }',
  '      - { domain: "persona", subject: "standard", available: true, generation: 1 }',
  '    externalPolicyFacts:',
  '      hard: {}',
  '      capabilityExists: {}',
  '- insert:',
  `    - id: "p6t6-team-tools"`,
  `      name: "${p6t6Url}"`,
  '- id: "directory-picker"',
  '  disabled: true',
  '- insert:',
  '    - id: "directory-picker-browse"',
  '      name: "@deepseek-ai/dsh-host-directory-picker-browse"',
  '    - id: "directory-picker-browse-client"',
  '      name: "@deepseek-ai/dsh-client-ui-directory-picker-browse"',
  '',
]
const patchPath = join(profileDir, 'cordis.patch.yml')
writeFileSync(patchPath, patchLines.join('\n'))
log(`r8 user-layer patch written to ${patchPath}`)

assertions.spec = spec
assertions.worldHome = HOME
assertions.installDir = pkgDir
assertions.branch = BRANCH
assertions.expectedVersion = EXPECTED_VERSION
assertions.installExit = first.status
assertions.rootSessionId = ROOT_SESSION_ID
assertions.p6t6Url = p6t6Url
assertions.taskWorktree = R8_WORKTREE
writeFileSync(join(EV, `r8-assertions-${STAMP}.json`), JSON.stringify(assertions, null, 2))
log(`r8 assertions → ${join(EV, `r8-assertions-${STAMP}.json`)}`)

log(`R8-SETUP-OK (home=${HOME})`)
console.log('R8-SETUP-OK')
