#!/usr/bin/env node
/**
 * a2perm-setup.mjs — V1 (0.1.1-alpha.2 freeze) live-host world setup.
 *
 * Builds TWO worlds under references/ (fresh in-workspace DSH_HOME + local
 * BARE repo of the main repository + the test-use BUILT CLI
 * `plugin --profile web add git+file:///<home>/repo.git#branch`):
 *
 *   1. the A2PERM world  `.dsh-test-a2perm-<stamp>` — installs branch
 *      task/alpha2-v1-verification and writes a user-layer patch that
 *      OVERRIDES the shipped `dsh-agent-team` row (last-write-wins, whole
 *      config) with the STATIC PARAMETER-AWARE PERMISSION blueprint
 *      (team.a2perm: leader + worker-a + worker-b, each declaring a
 *      `permissions` policy with allow/ask/deny exact-path lanes over
 *      perm-a..e.txt) + seedMembers for the two worker instances +
 *      mcpServer null (no MCP in this world) + an explicit
 *      defaultWorkspace (the pre-created team workspace).
 *   2. the LEGACY world  `.dsh-test-a2permlegacy-<stamp>` — installs the
 *      SAME branch but the user-layer patch does NOT override the product
 *      row: the BUNDLE layer shipped row (my-team-bp-1, NO capabilities —
 *      the alpha.1 default) stands. The R1 legacy-regression world.
 *
 * Both worlds carry the p6t6 observability harness row (a file URL into the
 * MAIN repo tools harness — a test device) + the headless directory-picker
 * pin.
 *
 * Evidence: <EV>/a2perm-setup-<stamp>.log + a2perm-assertions-<stamp>.json
 *           + a2legacy-assertions-<stamp>.json (+ first-add transcripts).
 *
 * Usage: node a2perm-setup.mjs        (A2_STAMP optional)
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

const STAMP = process.env.A2_STAMP ?? new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const BRANCH = 'task/alpha2-v1-verification'
const VERSION = '0.1.1-alpha.2'
const ROOT_SESSION_ID = 'a2root' // the a2perm capability leader's root session
const LEGACY_ROOT_SESSION_ID = 'team-root' // the shipped row's root session

const LOG = join(EV, `a2perm-setup-${STAMP}.log`)
const log = (line) => {
  const stamped = `[${new Date().toISOString()}] ${line}`
  appendFileSync(LOG, stamped + '\n')
  console.log(stamped)
}
const die = (msg) => {
  log(`FAIL — ${msg}`)
  process.exit(1)
}

// ── the alpha.2 permission Blueprint (embedded; the validated dispatch-input
// a2perm-blueprint.yml, contentHash sha256:b8bdcf7197e…) ────────────────────
const A2PERM_BLUEPRINT = [
  '---',
  'schemaVersion: 1',
  'blueprintId: team.a2perm',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: "You are the leader of the alpha.2 permission test team."',
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
  '    permissions:',
  '      default: ask',
  '      allow:',
  '        - tool: read',
  '          resource:',
  '            kind: exact',
  '            path: ./perm-a.txt',
  '      ask:',
  '        - tool: write',
  '          resource:',
  '            kind: exact',
  '            path: ./perm-c.txt',
  '      deny:',
  '        - tool: read',
  '          resource:',
  '            kind: exact',
  '            path: ./perm-b.txt',
  'members:',
  '  - templateId: worker-a',
  '    persona: "You are member worker-a of the alpha.2 permission test team."',
  '    capabilities:',
  '      teamTools:',
  '        kind: allow',
  '        items:',
  '          - team_delegate',
  '          - team_send_message',
  '          - team_request_control',
  '      builtinToolDeny: []',
  '      skills:',
  '        kind: deny',
  '      mcp:',
  '        kind: deny',
  '      permissions:',
  '        default: ask',
  '        allow:',
  '          - tool: read',
  '            resource:',
  '              kind: exact',
  '              path: ./perm-a.txt',
  '        ask:',
  '          - tool: write',
  '            resource:',
  '              kind: exact',
  '              path: ./perm-c.txt',
  '        deny:',
  '          - tool: read',
  '            resource:',
  '              kind: exact',
  '              path: ./perm-b.txt',
  '  - templateId: worker-b',
  '    persona: "You are member worker-b of the alpha.2 permission test team."',
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
  '      permissions:',
  '        default: deny',
  '        allow: []',
  '        ask: []',
  '        deny: []',
  'requirements: []',
  // V1-2 (live-run kit fix, router ruling): the instance-caller mutation
  // envelopes. The admission envelope check (runtime/admission/envelope.ts)
  // fails closed for instance callers when the team envelope is ABSENT
  // (empty in-bounds op set) — the first live run died at the leader
  // writeC1 ask with ENVELOPE_OUT_OF_BOUNDS ('request-control outside the
  // caller's mutation envelope'). The ruling's set: the LEADER must drive
  // the members (delegate = assign-task + create-member; follow-up =
  // assign-task), send messages, report progress, and request/resolve
  // control; worker-a requests control + sends messages + reports;
  // worker-b stays envelope-less (default-deny, never asks). Field names
  // verified against packages/domain/blueprint (MutationEnvelope allow/deny;
  // memberEnvelopes[] templateId + envelope).
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
  '  - templateId: worker-a',
  '    envelope:',
  '      allow:',
  '        - request-control',
  '        - send-message',
  '        - report-progress',
  '      deny: []',
  'policyStates: []',
  'metadata: {}',
  '---',
].join('\n')

// The pre-created team workspace files (defaultWorkspace targets).
const WORKSPACE_FILES = {
  'perm-a.txt': 'perm-a: allow-read target.\n',
  'perm-b.txt': 'perm-b: deny-read target.\n',
  'perm-c.txt': 'perm-c: initial sentinel.\n',
  'perm-d.txt': 'perm-d: default-ask target (no matching rule).\n',
  'perm-e.txt': 'perm-e: default-deny target (worker-b).\n',
}

// ── one world build (bare repo + install + assertions + user-layer patch) ───
function buildWorld({ home, worldLabel, assertionsFile, patchLines, firstAddFile, extraSetup }) {
  if (existsSync(home)) die(`world already exists (refusing to clobber): ${home}`)
  mkdirSync(home, { recursive: true })
  log(`${worldLabel} world: ${home}`)
  const repoGit = join(home, 'repo.git')
  log(`bare repo: cloning ${REPO} (branch ${BRANCH}) → ${repoGit}`)
  const clone = spawnSync('git', ['clone', '--bare', REPO, repoGit], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
  if (clone.status !== 0) die(`git clone --bare failed: ${String(clone.stderr ?? clone.stdout).slice(0, 800)}`)
  log('bare repo cloned')

  const spec = `git+file:///${repoGit.replace(/\\/g, '/')}#${BRANCH}`
  log(`installing plugin ${BRANCH} via ${spec} …`)
  const first = spawnSync(process.execPath, [BIN_JS, 'plugin', '--profile', 'web', 'add', spec], {
    cwd: home,
    env: { ...process.env, DSH_HOME: home },
    encoding: 'utf8',
    maxBuffer: 256 * 1024 * 1024,
  })
  const firstOut = `${first.stdout ?? ''}${first.stderr ?? ''}`
  writeFileSync(join(EV, firstAddFile), firstOut)
  log(`install exit=${first.status}`)
  if (first.status !== 0) die(`install FAILED:\n${firstOut.slice(-1500)}`)
  log('install SUCCEEDED')

  const profileDir = join(home, 'profiles', 'web')
  const pkgDir = join(profileDir, 'node_modules', 'dsh-agent-team')
  const assertions = {}
  const assert = (label, ok, detail) => {
    assertions[label] = { ok: !!ok, detail: detail ?? null }
    log(`${ok ? 'PASS' : 'FAIL'} ${worldLabel}: ${label}${detail !== undefined && detail !== null ? ` — ${typeof detail === 'string' ? detail.slice(0, 300) : JSON.stringify(detail)}` : ''}`)
    if (!ok) die(`assertion failed: ${worldLabel} ${label}`)
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
  log(`${worldLabel} user-layer patch written to ${patchPath}`)

  if (typeof extraSetup === 'function') extraSetup({ home, profileDir, assertions })

  assertions.spec = spec
  assertions.worldHome = home
  assertions.installDir = pkgDir
  assertions.branch = BRANCH
  assertions.installExit = first.status
  writeFileSync(assertionsFile, JSON.stringify(assertions, null, 2))
  log(`${worldLabel} assertions → ${assertionsFile}`)
}

// ── 1. the A2PERM world (capability row override) ───────────────────────────
const HOME = join(REPO, 'references', `.dsh-test-a2perm-${STAMP}`)
const WORKSPACE_DIR = join(HOME, 'workspace-a2perm')
const p6t6Url = pathToFileURL(join(REPO, 'packages', 'tools', 'harness', 'plugin.mjs')).href

const a2PatchLines = [
  `# a2perm user-layer patch (world ${STAMP}): alpha.2 static parameter-aware permission live smoke.`,
  '#',
  '# The dsh-agent-team row OVERRIDES the bundle layer config entirely',
  '# (last-write-wins, whole config): blueprintSource = the team.a2perm',
  `# permission blueprint (leader + worker-a + worker-b, static permissions),`,
  `# rootSessionId = ${ROOT_SESSION_ID}, mcpServer null, explicit defaultWorkspace`,
  '# (the pre-created team workspace with perm-a..e.txt).',
  '#',
  '# The p6t6 row name points at the MAIN repo tools harness (a test',
  '# device); the directory-picker rows are the headless pin.',
  '- id: "dsh-agent-team"',
  '  name: "dsh-agent-team/host"',
  '  config:',
  '    bootPhase: "create"',
  `    rootSessionId: "${ROOT_SESSION_ID}"`,
  '    blueprintSource: |',
  ...A2PERM_BLUEPRINT.split('\n').map((l) => `      ${l}`),
  '    seedMembers:',
  '      - instanceId: inst-a2pa',
  '        templateId: worker-a',
  '        label: member-a',
  '        childSessionId: session-a2a-a',
  '      - instanceId: inst-a2pb',
  '        templateId: worker-b',
  '        label: member-b',
  '        childSessionId: session-a2b-b',
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

buildWorld({
  home: HOME,
  worldLabel: 'a2perm',
  assertionsFile: join(EV, `a2perm-assertions-${STAMP}.json`),
  patchLines: a2PatchLines,
  firstAddFile: `a2perm-setup-${STAMP}-first-add.txt`,
  extraSetup: ({ home }) => {
    mkdirSync(WORKSPACE_DIR, { recursive: true })
    for (const [name, content] of Object.entries(WORKSPACE_FILES)) {
      writeFileSync(join(home, 'workspace-a2perm', name), content)
    }
    log(`a2perm workspace pre-created: ${WORKSPACE_DIR} (perm-a..e.txt)`)
  },
})

// ── 2. the LEGACY world (NO product row override — the shipped row stands) ──
const LEGACY_HOME = join(REPO, 'references', `.dsh-test-a2permlegacy-${STAMP}`)
const legacyPatchLines = [
  `# a2legacy user-layer patch (world ${STAMP}): R1 legacy regression.`,
  '#',
  '# NO dsh-agent-team override — the BUNDLE layer shipped row (the',
  '# my-team-bp-1 inline blueprint, the legacy default with NO capabilities',
  '# field) stands. This world verifies the legacy full-10-catalog + zero',
  '# permission listeners still work on the alpha.2 build.',
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

buildWorld({
  home: LEGACY_HOME,
  worldLabel: 'a2legacy',
  assertionsFile: join(EV, `a2legacy-assertions-${STAMP}.json`),
  patchLines: legacyPatchLines,
  firstAddFile: `a2legacy-setup-${STAMP}-first-add.txt`,
})

log(`A2PERM-SETUP-OK (a2perm=${HOME}; legacy=${LEGACY_HOME})`)
console.log('A2PERM-SETUP-OK')
