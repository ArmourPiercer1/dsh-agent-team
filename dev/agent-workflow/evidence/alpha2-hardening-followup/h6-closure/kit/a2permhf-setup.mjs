#!/usr/bin/env node
/**
 * a2permhf-setup.mjs — H6 (alpha.2 hardening FOLLOW-UP closure) live-host
 * world setup.
 *
 * H6 variant of the H3 a2permh3-setup.mjs (H3 file kept as-is in
 * alpha2-hardening/h3/kit/). Deltas:
 *   - BRANCH = task/alpha2hf-h6-closure (the int tip AFTER H4+H5
 *     integration: per-decision fresh exact-rule canonicalization + the
 *     bash effect fingerprint projection {tool, commandHash, workdir,
 *     runInBackground, timeoutMs, sandboxPermissions});
 *   - ONE world only: references/.dsh-test-a2permhf-<stamp> (the H6 brief
 *     has no legacy-regression leg — the R1 legacy world was H3's);
 *   - the p6t6 harness row points at the H6 WORKTREE's
 *     packages/tools/harness/plugin.mjs (the copy carrying the
 *     DSH_HARDENING_PROBE-gated /__hardening/hostile-prepend seam,
 *     inherited at the int tip — the H3 first-world dump-config bug (D1)
 *     is closed by construction: this URL and the boot's artifact check
 *     derive from the SAME worktree root, and the boot verifies the row
 *     name byte-for-byte against the dump);
 *   - WORLD POLICY (the H6 brief's two extensions of the H3 world):
 *       (a) the LEADER gains an exact DENY rule whose path runs THROUGH a
 *           junction: read ./alias/secret.txt — the L1 exact-rule
 *           topology-retarget leg (the H4 P1-A proof on a real host);
 *       (b) bash on the ASK lane — the leader/worker-a default is `ask`
 *           and NO policy lane names bash, so every bash call takes the
 *           default-ask lane (the L2 scope-distinction leg; the H5 P1-B
 *           proof on a real host);
 *     the H3 lanes (allow read ./perm-a.txt / ask write ./perm-c.txt /
 *     deny read ./perm-b.txt, worker-b default deny) are UNCHANGED so the
 *     L3 hostile regression legs run byte-identical to H3's;
 *   - the L1 topology: <workspace>/dirA/secret.txt ("A-payload") +
 *     <workspace>/dirB/secret.txt ("B-payload") + the <workspace>/alias
 *     JUNCTION → dirA (node fs `symlinkSync(target, alias, 'junction')` —
 *     NO PowerShell; non-interactive Remove-Item prompts/fails on
 *     junctions; the parent pre-validated the node mechanics on this host
 *     2026-09-11). The retarget (rmdirSync + symlinkSync → dirB) happens
 *     in the check script's L1 group (mid-run).
 *
 * Everything else (the world shape, the blueprint, the bare-repo install,
 * the user-layer patch, the headless directory-picker pin) is
 * byte-identical to the H3 setup.
 *
 * Builds the world under references/ (fresh in-workspace DSH_HOME + local
 * BARE repo of the main repository + the test-use BUILT CLI
 * `plugin --profile web add git+file:///<home>/repo.git#branch`):
 *
 *   the A2PERM world  `.dsh-test-a2permhf-<stamp>` — installs branch
 *   task/alpha2hf-h6-closure and writes a user-layer patch that
 *   OVERRIDES the shipped `dsh-agent-team` row (last-write-wins, whole
 *   config) with the STATIC PARAMETER-AWARE PERMISSION blueprint
 *   (team.a2perm: leader + worker-a + worker-b, each declaring a
 *   `permissions` policy) + seedMembers for the two worker instances +
 *   mcpServer null + an explicit defaultWorkspace.
 *
 * Evidence: <EV>/a2permhf-setup-<stamp>.log +
 *           a2permhf-assertions-<stamp>.json (+ first-add transcript).
 *
 * Usage: node a2permhf-setup.mjs        (A2_STAMP optional)
 */
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  symlinkSync,
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

// The H6 WORKTREE (the repo checkout carrying task/alpha2hf-h6-closure +
// the hostile-seam plugin.mjs the harness row loads). Walk up from EV to
// the dsh-agent-team worktree root (packages/ + dev/agent-workflow/).
function findH6Worktree(start) {
  let dir = start
  for (;;) {
    if (existsSync(join(dir, 'packages', 'tools', 'harness', 'plugin.mjs')) && existsSync(join(dir, 'dev', 'agent-workflow', 'graph.yaml'))) return dir
    const parent = dirname(dir)
    if (parent === dir) throw new Error(`no ancestor of ${start} is the H6 worktree root`)
    dir = parent
  }
}
const H6_WORKTREE = findH6Worktree(EV)
if (!existsSync(BIN_JS)) {
  console.error(`FAIL — test-use CLI not built: ${BIN_JS} (build the test-use checkout first)`)
  process.exit(1)
}

const STAMP = process.env.A2_STAMP ?? new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const BRANCH = 'task/alpha2hf-h6-closure'
const VERSION = '0.1.1-alpha.2'
const ROOT_SESSION_ID = 'a2root' // the a2perm capability leader's root session

const LOG = join(EV, `a2permhf-setup-${STAMP}.log`)
const log = (line) => {
  const stamped = `[${new Date().toISOString()}] ${line}`
  appendFileSync(LOG, stamped + '\n')
  console.log(stamped)
}
const die = (msg) => {
  log(`FAIL — ${msg}`)
  process.exit(1)
}

// ── the alpha.2 permission Blueprint (H6 = the H3 team.a2perm blueprint
// + the LEADER's exact DENY rule on ./alias/secret.txt — the L1
// junction-topology rule; the H3 lanes stand unchanged) ────────────────────
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
  // H6 L1 — the exact DENY rule whose path runs THROUGH the junction
  // (alias → dirA at T0, retargeted to dirB mid-run by the check script).
  // Fresh per-decision canonicalization (H4 P1-A) must keep this rule
  // matching the retargeted operation identity — no downgrade to the
  // default ask lane.
  '        - tool: read',
  '          resource:',
  '            kind: exact',
  '            path: ./alias/secret.txt',
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
  // H6 L2 — bash on the ASK lane: `default: ask` and NO lane names bash,
  // so every bash call takes the default-ask lane (the H5 scope-
  // distinction legs drive it from the direct /tool route).
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
  // envelopes (byte-identical to the H3 world — the admission envelope
  // check fails closed for instance callers when the team envelope is
  // ABSENT; the leader must drive the members, send messages, report
  // progress, and request/resolve control; worker-a requests control +
  // sends messages + reports; worker-b stays envelope-less).
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

// ── the A2PERMHF world (capability row override) ─────────────────────────────
const HOME = join(REPO, 'references', `.dsh-test-a2permhf-${STAMP}`)
const WORKSPACE_DIR = join(HOME, 'workspace-a2perm')
const DIR_A = join(WORKSPACE_DIR, 'dirA')
const DIR_B = join(WORKSPACE_DIR, 'dirB')
const ALIAS = join(WORKSPACE_DIR, 'alias')
// H6: the harness row loads the H6 WORKTREE's plugin.mjs (the hostile seam
// inherited at the int tip; inert unless DSH_HARDENING_PROBE=1 — the H6
// boot sets it). THE H3 D1 FIX: the URL derives from the same worktree
// root the boot's artifact check uses (no main-repo-copy fallback).
const p6t6Url = pathToFileURL(join(H6_WORKTREE, 'packages', 'tools', 'harness', 'plugin.mjs')).href

const a2PatchLines = [
  `# a2permhf user-layer patch (world ${STAMP}): alpha.2 follow-up (H6) live smoke.`,
  '#',
  '# The dsh-agent-team row OVERRIDES the bundle layer config entirely',
  '# (last-write-wins, whole config): blueprintSource = the team.a2perm',
  '# permission blueprint (leader + worker-a + worker-b, static',
  '# permissions). H6 extensions of the H3 world:',
  '#   (a) leader exact DENY read ./alias/secret.txt — the path runs',
  `#       THROUGH the ${ALIAS} junction (dirA at T0, retargeted to`,
  '#       dirB mid-run by the check script — the H4 P1-A live leg);',
  '#   (b) bash on the ASK lane (default ask, no bash lane) — the H5',
  '#       P1-B scope-distinction live leg;',
  '# the H3 lanes stand unchanged (the L3 hostile legs run as in H3).',
  '#',
  `# rootSessionId = ${ROOT_SESSION_ID}, mcpServer null, explicit defaultWorkspace`,
  '# (the pre-created team workspace with perm-a..e.txt + dirA/dirB + the',
  '# alias junction).',
  '#',
  '# The p6t6 row name points at the H6 worktree tools harness (a test',
  '# device; carries the DSH_HARDENING_PROBE-gated hostile seam). The',
  '# directory-picker rows are the headless pin.',
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
  assertionsFile: join(EV, `a2permhf-assertions-${STAMP}.json`),
  patchLines: a2PatchLines,
  firstAddFile: `a2permhf-setup-${STAMP}-first-add.txt`,
  extraSetup: ({ home, assertions }) => {
    mkdirSync(WORKSPACE_DIR, { recursive: true })
    for (const [name, content] of Object.entries(WORKSPACE_FILES)) {
      writeFileSync(join(home, 'workspace-a2perm', name), content)
    }
    // H6 L1 topology — node fs ONLY (the PowerShell Remove-Item
    // prompts/fails non-interactively on junctions; the parent
    // pre-validated these exact node mechanics on this host 2026-09-11):
    //   fs.symlinkSync(target, alias, 'junction') — no admin needed
    //   fs.rmdirSync(alias)                        — unlinks the link ONLY
    //   fs.realpathSync follows the junction
    mkdirSync(DIR_A, { recursive: true })
    mkdirSync(DIR_B, { recursive: true })
    writeFileSync(join(DIR_A, 'secret.txt'), 'A-payload\n')
    writeFileSync(join(DIR_B, 'secret.txt'), 'B-payload\n')
    symlinkSync(DIR_A, ALIAS, 'junction')
    const realT0 = realpathSync(ALIAS)
    log(`a2perm workspace pre-created: ${WORKSPACE_DIR} (perm-a..e.txt)`)
    log(`H6 L1 topology: dirA/secret.txt=A-payload, dirB/secret.txt=B-payload, alias junction → ${realT0}`)
    if (!realT0.toLowerCase().endsWith(join('dirA').toLowerCase()) && !realT0.replace(/\\/g, '/').endsWith('dirA')) {
      die(`alias junction does not resolve into dirA (got ${realT0})`)
    }
    assertions.l1Topology = {
      alias: ALIAS,
      dirA: DIR_A,
      dirB: DIR_B,
      realT0,
      dirASecret: readFileSync(join(DIR_A, 'secret.txt'), 'utf8'),
      dirBSecret: readFileSync(join(DIR_B, 'secret.txt'), 'utf8'),
    }
  },
})

log(`A2PERMHF-SETUP-OK (a2perm=${HOME})`)
console.log('A2PERMHF-SETUP-OK')
