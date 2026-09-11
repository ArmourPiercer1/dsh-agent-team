#!/usr/bin/env node
/**
 * issue2-setup.mjs — I2 (issue #2, line B: permission repair) B2 live-world
 * builder.
 *
 * Builds ONE ephemeral DSH world under `references/.dsh-test-i2-<stamp>`:
 *   1. BARE clone of the main repo (carries the fix/alpha2-issue2-permission
 *      branch ref — a worktree branch is a repo-level ref) into <home>/repo.git;
 *   2. `dsh plugin --profile web add git+file:///<home>/repo.git#fix/alpha2-issue2-permission`
 *      (the git-install world; the BUILT test-use CLI at
 *      references/deepseek-harness-test-use/apps/cli/lib/bin.js, DSH_HOME
 *      = the world home — the PBA D5 install mechanism);
 *   3. install-surface assertions (package dir, version, dsh.bundle.patch,
 *      dsh.profile.bundles auto-inclusion);
 *   4. the USER-LAYER patch (profiles/web/cordis.patch.yml): the
 *      dsh-agent-team row OVERRIDE (whole-config, last-write-wins) carrying
 *      the team.issue2 B2 blueprint + memberPresetId/rootPresetId =
 *      "standard" + mcpServer null + explicit defaultWorkspace, plus the
 *      p6t6 harness row (my worktree's plugin.mjs) and the
 *      directory-picker headless pin.
 *
 * B2 world shape (plan §8.3, production-equivalent):
 *   - leader   — capabilities.builtinToolDeny []      (control: no deny)
 *   - expert   — capabilities.builtinToolDeny []      (control member)
 *   - researcher — capabilities.builtinToolDeny [pwsh] (the deny member)
 *   ALL templates share memberPresetId = "standard" (the shipped preset;
 *   its win32 tool-pwsh row is ACTIVE on this host). The `permissions`
 *   facet is ABSENT on every template (validate.ts L519-524: absent = no
 *   permission gating at all — legacy/alpha.1 behavior), so the B2 battery
 *   isolates the capability (builtinToolDeny) mechanism from the
 *   parameter-permission facet (that coupling is I2-P3's own world).
 *   mcpServer = null (deviation from the production shape — the 58
 *   mcp__rc-* globals are orthogonal to the preset-layer visibility the
 *   defect is about; recorded in the closure report).
 *
 * Sandbox posture (TEST_METHODS §5): EVERY spawn in this script is
 * file-fd stdio (spawnToLog from the RC1 characterization util) — no
 * piped-stdio spawn anywhere (node→git / node→node EPERM boundary).
 *
 * Usage: node issue2-setup.mjs
 * Env:   I2_STAMP (world stamp; default = ISO timestamp)
 * Emits: issue2-assertions-<stamp>.json (+ the setup log) in this directory.
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const EV = dirname(fileURLToPath(import.meta.url))

// The MAIN REPO (carries .worktrees/RC1 + references/deepseek-harness-test-use).
function findMainRepoRoot(start) {
  let dir = start
  for (;;) {
    if (existsSync(join(dir, '.worktrees', 'RC1')) && existsSync(join(dir, 'references', 'deepseek-harness-test-use'))) return dir
    const parent = dirname(dir)
    if (parent === dir) throw new Error(`no ancestor of ${start} carries .worktrees/RC1 + references/deepseek-harness-test-use`)
    dir = parent
  }
}
const MAIN_REPO = findMainRepoRoot(EV)
const HOST_TREE = join(MAIN_REPO, 'references', 'deepseek-harness-test-use')
const BIN_JS = join(HOST_TREE, 'apps', 'cli', 'lib', 'bin.js')

// MY worktree (the branch checkout whose dist + harness plugin.mjs the
// world installs / loads). Walk up from EV: the first ancestor with
// packages/tools/harness/plugin.mjs + dev/agent-workflow/graph.yaml.
function findWorktree(start) {
  let dir = start
  for (;;) {
    if (existsSync(join(dir, 'packages', 'tools', 'harness', 'plugin.mjs')) && existsSync(join(dir, 'dev', 'agent-workflow', 'graph.yaml'))) return dir
    const parent = dirname(dir)
    if (parent === dir) throw new Error(`no ancestor of ${start} is a dsh-agent-team worktree root`)
    dir = parent
  }
}
const WORKTREE = findWorktree(EV)

const { spawnToLog } = await import(
  pathToFileURL(join(MAIN_REPO, '.worktrees', 'RC1', 'tests', 'characterization', 'lib', 'util.mjs')).href
)

const BRANCH = 'fix/alpha2-issue2-permission'
const VERSION = '0.1.1-alpha.2'
const ROOT_SESSION_ID = 'i2root'
const STAMP = process.env.I2_STAMP ?? new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const HOME = join(MAIN_REPO, 'references', `.dsh-test-i2-${STAMP}`)
const WORKSPACE_DIR = join(HOME, 'workspace-issue2')

const LOG = join(EV, `issue2-setup-${STAMP}.log`)
const log = (line) => {
  const stamped = `[${new Date().toISOString()}] ${line}`
  appendFileSync(LOG, stamped + '\n')
  console.log(stamped)
}
const die = (msg) => {
  log(`FAIL — ${msg}`)
  process.exit(1)
}

if (!existsSync(BIN_JS)) {
  die(`test-use CLI not built: ${BIN_JS} (build the test-use checkout first)`)
}
if (existsSync(HOME) && !existsSync(join(HOME, 'repo.git'))) {
  die(`world directory exists but is not this kit's world (no repo.git — refusing to clobber): ${HOME}`)
}

// ── the team.issue2 B2 blueprint (plan §8.3) ────────────────────────────────
// `permissions` deliberately ABSENT on every template (no permission
// gating — the facet is I2-P3's subject, not B2's). teamEnvelope/
// memberEnvelopes mirror the H3/H3 admission-envelope shapes (the
// admission check fails closed for instance callers without them).
const ISSUE2_BLUEPRINT = [
  '---',
  'schemaVersion: 1',
  'blueprintId: team.issue2',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: "You are the leader of the issue2 permission test team."',
  '  capabilities:',
  '    teamTools:',
  '      kind: allow',
  '      items:',
  '        - team_send_message',
  '        - team_list_members',
  '        - team_request_control',
  '        - team_resolve_control',
  '    builtinToolDeny: []',
  '    skills:',
  '      kind: deny',
  '    mcp:',
  '      kind: deny',
  'members:',
  '  - templateId: expert',
  '    persona: "You are member expert of the issue2 permission test team."',
  '    capabilities:',
  '      teamTools:',
  '        kind: allow',
  '        items:',
  '          - team_send_message',
  '      builtinToolDeny: []',
  '      skills:',
  '        kind: deny',
  '      mcp:',
  '        kind: deny',
  '  - templateId: researcher',
  '    persona: "You are member researcher of the issue2 permission test team."',
  '    capabilities:',
  '      teamTools:',
  '        kind: allow',
  '        items:',
  '          - team_send_message',
  '      builtinToolDeny:',
  '        - pwsh',
  '      skills:',
  '        kind: deny',
  '      mcp:',
  '        kind: deny',
  'requirements: []',
  'teamEnvelope:',
  '  allow:',
  '    - assign-task',
  '    - create-member',
  '    - send-message',
  '    - report-progress',
  '    - request-control',
  '    - resolve-control',
  '  deny: []',
  'memberEnvelopes:',
  '  - templateId: expert',
  '    envelope:',
  '      allow:',
  '        - send-message',
  '        - report-progress',
  '      deny: []',
  '  - templateId: researcher',
  '    envelope:',
  '      allow:',
  '        - send-message',
  '        - report-progress',
  '      deny: []',
  'policyStates: []',
  'metadata: {}',
  '---',
].join('\n')

const WORKSPACE_FILES = {
  'issue2-a.txt': 'issue2: expert sentinel.\n',
  'issue2-b.txt': 'issue2: researcher sentinel.\n',
}

const p6t6Url = pathToFileURL(join(WORKTREE, 'packages', 'tools', 'harness', 'plugin.mjs')).href

const patchLines = [
  `# issue2 user-layer patch (world ${STAMP}): B2 (builtinToolDeny vs preset)`,
  '# live world.',
  '#',
  '# The dsh-agent-team row OVERRIDES the bundle layer config entirely',
  '# (last-write-wins, whole config): blueprintSource = the team.issue2',
  '# B2 blueprint (leader + expert + researcher; expert deny [], researcher',
  '# deny [pwsh]; NO permissions facet anywhere — the parameter-permission',
  '# coupling is I2-P3\'s own world).',
  '#',
  `# rootSessionId = ${ROOT_SESSION_ID}, memberPresetId = rootPresetId =`,
  '# "standard" (the shipped preset; win32 tool-pwsh row active), mcpServer',
  '# null (production-equivalence deviation — recorded in the closure',
  '# report), explicit defaultWorkspace.',
  '#',
  '# The p6t6 row name points at MY worktree\'s tools harness (a test',
  '# device — the /__p6t6 capture routes).',
  '- id: "dsh-agent-team"',
  '  name: "dsh-agent-team/host"',
  '  config:',
  '    bootPhase: "create"',
  `    rootSessionId: "${ROOT_SESSION_ID}"`,
  '    blueprintSource: |',
  ...ISSUE2_BLUEPRINT.split('\n').map((l) => `      ${l}`),
  '    seedMembers:',
  '      - instanceId: inst-i2e',
  '        templateId: expert',
  '        label: expert',
  '        childSessionId: session-i2e',
  '      - instanceId: inst-i2r',
  '        templateId: researcher',
  '        label: researcher',
  '        childSessionId: session-i2r',
  `    defaultWorkspace: ${JSON.stringify(WORKSPACE_DIR)}`,
  '    teamSkills: []',
  '    generation: 1',
  '    deniedSelection: null',
  '    mcpServer: null',
  '    memberPresetId: "standard"',
  '    rootPresetId: "standard"',
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

// ── build the world ─────────────────────────────────────────────────────────
mkdirSync(HOME, { recursive: true })
log(`world: ${HOME}`)
log(`main repo: ${MAIN_REPO}`)
log(`worktree:  ${WORKTREE}`)
log(`host tree: ${HOST_TREE}`)

// The branch ref must exist in the main repo (a worktree branch is a
// repo-level ref). Record its tip SHA (artifact identity).
const refLog = join(EV, `issue2-setup-${STAMP}-ref.txt`)
const ref = await spawnToLog('git', ['for-each-ref', `refs/heads/${BRANCH}`, '--format=%(objectname)'], {
  cwd: MAIN_REPO,
  logPath: refLog,
  timeoutMs: 30_000,
})
// note: backtick inside single-quoted powershell is fine; node arg is literal
const branchTip = (ref.text ?? '').trim().split('\n')[0]?.trim()
if (!ref.ok || !/^[0-9a-f]{40}$/.test(branchTip ?? '')) {
  die(`branch ${BRANCH} not resolvable in ${MAIN_REPO}: exit=${ref.exitCode} text=${(ref.text ?? '').slice(0, 200)} err=${ref.error}`)
}
log(`branch ${BRANCH} tip = ${branchTip}`)

const repoGit = join(HOME, 'repo.git')
const branchRefResolvable = (text) => /refs\/heads\/fix\/alpha2-issue2-permission/.test(text ?? '')
if (existsSync(join(repoGit, 'HEAD'))) {
  const probe = await spawnToLog('git', ['--git-dir', repoGit, 'for-each-ref', `refs/heads/${BRANCH}`], {
    cwd: HOME,
    logPath: join(EV, `issue2-setup-${STAMP}-ref-probe.txt`),
    timeoutMs: 30_000,
  })
  if (probe.ok && branchRefResolvable(probe.text)) {
    log(`bare repo already present (git-clone-free hand-assembled copy of the main .git — the sandbox named-pipe boundary blocks git clone's MSYS sh signal pipe): ${repoGit}`)
  } else {
    die(`bare repo at ${repoGit} exists but the ${BRANCH} ref is not resolvable in it — remove it and re-run`)
  }
} else {
  log(`bare repo: cloning ${MAIN_REPO} → ${repoGit} (file-fd stdio)`)
  const clone = await spawnToLog('git', ['clone', '--bare', MAIN_REPO, repoGit], {
    cwd: HOME,
    logPath: join(EV, `issue2-setup-${STAMP}-clone.txt`),
    timeoutMs: 300_000,
  })
  if (!clone.ok) die(`git clone --bare failed: exit=${clone.exitCode} err=${clone.error} tail=${(clone.text ?? '').slice(-500)}`)
  log('bare repo cloned')
}

const spec = `git+file:///${repoGit.replace(/\\/g, '/')}#${BRANCH}`
const pkgDirEarly = join(HOME, 'profiles', 'web', 'node_modules', 'dsh-agent-team')
let first
if (existsSync(pkgDirEarly)) {
  log(`install already present at ${pkgDirEarly} (skipping the pnpm install step)`)
  first = { ok: true, exitCode: 0, text: '(skipped — install present)', error: '' }
} else {
  log(`installing plugin ${BRANCH} via ${spec} …`)
  const firstAddFile = join(EV, `issue2-setup-${STAMP}-first-add.txt`)
  first = await spawnToLog(process.execPath, [BIN_JS, 'plugin', '--profile', 'web', 'add', spec], {
    cwd: HOME,
    env: { DSH_HOME: HOME, DSH_CLIENT_COMMIT_HASH: 'a66e470204' },
    logPath: firstAddFile,
    timeoutMs: 600_000,
  })
  if (!first.ok) die(`install FAILED (exit=${first.exitCode} err=${first.error}):\n${(first.text ?? '').slice(-1500)}`)
  log('install SUCCEEDED')
}

const profileDir = join(HOME, 'profiles', 'web')
const pkgDir = join(profileDir, 'node_modules', 'dsh-agent-team')
const assertions = {}
const assert = (label, ok, detail) => {
  assertions[label] = { ok: !!ok, detail: detail ?? null }
  log(`${ok ? 'PASS' : 'FAIL'} issue2: ${label}${detail !== undefined && detail !== null ? ` — ${typeof detail === 'string' ? detail.slice(0, 300) : JSON.stringify(detail)}` : ''}`)
  if (!ok) die(`assertion failed: ${label}`)
}
assert('installed package dir exists', existsSync(pkgDir))
const installedRootPkg = JSON.parse(readFileSync(join(pkgDir, 'package.json'), 'utf8'))
assert(`installed version is ${VERSION}`, installedRootPkg?.version === VERSION, installedRootPkg?.version ?? null)
assert('installed root manifest declares dsh.bundle.patch', installedRootPkg?.dsh?.bundle?.patch === './cordis.patch.yml')
const profilePkg = JSON.parse(readFileSync(join(profileDir, 'package.json'), 'utf8'))
const bundles = profilePkg?.dsh?.profile?.bundles
assert('dsh.profile.bundles AUTO-contains the dsh-agent-team bundle',
  Array.isArray(bundles) && JSON.stringify(bundles).includes('dsh-agent-team'), JSON.stringify(bundles))

const patchPath = join(profileDir, 'cordis.patch.yml')
writeFileSync(patchPath, patchLines.join('\n'))
log(`user-layer patch written to ${patchPath}`)

mkdirSync(WORKSPACE_DIR, { recursive: true })
for (const [name, content] of Object.entries(WORKSPACE_FILES)) {
  writeFileSync(join(WORKSPACE_DIR, name), content)
}
log(`issue2 workspace pre-created: ${WORKSPACE_DIR} (${Object.keys(WORKSPACE_FILES).join(', ')})`)

// The installed dist mirror identity (the artifact-under-test): SHA-256 of
// the installed agent-bindings.mjs + the worktree DIST MIRROR it copies
// (the dist mirror is the install-surface artifact; the src file differs
// only in line endings — CRLF working tree vs LF-normalized dist, .git
// eol=lf — so it is NOT the identity pair).
import { createHash } from 'node:crypto'
const hashFile = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
const installedGlue = join(pkgDir, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs')
const sourceGlue = join(WORKTREE, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live', 'agent-bindings.mjs')
assert('installed dist glue mirror exists', existsSync(installedGlue))
assert('installed dist glue == worktree dist glue (byte-identical artifact)', hashFile(installedGlue) === hashFile(sourceGlue), `${hashFile(installedGlue).slice(0, 12)} vs ${hashFile(sourceGlue).slice(0, 12)}`)
assertions.artifactIdentity = {
  branch: BRANCH,
  branchTip,
  installSpec: spec,
  installedGlueSha256: hashFile(installedGlue),
  sourceGlueSha256: hashFile(sourceGlue),
  installedGluePath: installedGlue,
  sourceGluePath: sourceGlue,
  testUseClientCommitLabel: 'a66e470204',
  p6t6Url,
  worktree: WORKTREE,
}

assertions.spec = spec
assertions.worldHome = HOME
assertions.installDir = pkgDir
assertions.branch = BRANCH
assertions.installExit = first.exitCode
const assertionsFile = join(EV, `issue2-assertions-${STAMP}.json`)
writeFileSync(assertionsFile, JSON.stringify(assertions, null, 2))
log(`issue2 assertions → ${assertionsFile}`)
log(`I2-SETUP-OK (stamp=${STAMP})`)
