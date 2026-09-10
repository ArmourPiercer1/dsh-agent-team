#!/usr/bin/env node
/**
 * cap-setup.mjs — 0.1.1-alpha.1 capability-wiring live-host world setup.
 *
 * Reuses the PBA kit's proven world-building chain (fresh in-workspace
 * DSH_HOME + a local BARE repo of the main repository + the test-use BUILT
 * CLI `plugin --profile web add <git+file://spec#branch>`), but installs the
 * task/alpha1-hardening branch (the code under test) and, unlike the
 * PBA kit, WRITES a user-layer patch that OVERRIDES the shipped
 * `dsh-agent-team` row's `blueprintSource` with a CAPABILITY Blueprint
 * (leader + tpl-a + tpl-b, each declaring different capabilities) plus the
 * test-harness rows (p6t6 observability + headless directory-picker pin).
 *
 * The capability Blueprint (from the alpha.1 plan; mirrors the t4a fixture
 * at the live-host scale):
 *   - LEADER (root session `cap-root`): teamTools allow
 *     [team_send_message, team_list_members]; builtinToolDeny [bash];
 *     skills allow [base]; mcp allow [cap-mcp].
 *   - MEMBER tpl-a: teamTools allow [team_delegate]; builtinToolDeny [write];
 *     skills allow [base]; mcp deny.
 *   - MEMBER tpl-b: teamTools allow [] (zero); builtinToolDeny [] (no-op);
 *     skills deny; mcp allow [cap-mcp].
 *
 * The skill `base` is used because the shipped environmentFacts mark
 * `skill/base` available (a catalog-registered skill); the t4a fixture's
 * `leader-skill`/`a-skill` are bridge-only doubles with no live catalog row.
 *
 * The MCP server (`cap-mcp`, port 3494) is configured here and started by
 * cap-boot.mjs (a minimal streamable-HTTP MCP endpoint).
 *
 * Evidence: <EV>/cap-setup-<stamp>.log + cap-assertions-<stamp>.json
 *           + cap-setup-<stamp>-first-add.txt.
 *
 * Usage: node cap-setup.mjs          (CAP_STAMP optional)
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

const STAMP = process.env.CAP_STAMP ?? new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
const HOME = join(REPO, 'references', `.dsh-test-cap-${STAMP}`)
const PROFILE_DIR = join(HOME, 'profiles', 'web')
const PKG_DIR = join(PROFILE_DIR, 'node_modules', 'dsh-agent-team')
const REPO_GIT = join(HOME, 'repo.git')
const BRANCH = 'task/alpha1-hardening'
const SPEC = `git+file:///${REPO_GIT.replace(/\\/g, '/')}#${BRANCH}`
const LOG = join(EV, `cap-setup-${STAMP}.log`)
const ASSERT_FILE = join(EV, `cap-assertions-${STAMP}.json`)

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
const normLF = (buf) => buf.toString('utf8').replace(/\r\n/g, '\n')

// ── the capability Blueprint (live-host scale) ─────────────────────────────
// The `leader` template becomes the root session (`cap-root`); `tpl-a` and
// `tpl-b` are member templates for team.create_member. Each declares all four
// capability sub-fields (the closed-v1 schema requires all four when
// `capabilities` is present). `base` is a catalog-registered skill (the
// shipped environmentFacts mark skill/base available).
//
// NOTE (live-host built-in deny): the live DSH host registers ZERO global
// (built-in) tools in this test profile — `tools.restrict()` names must be
// known GLOBAL tools, and it throws `unknown global tool` for anything
// else (known global tools: (none)). A non-empty `builtinToolDeny` would
// therefore abort the row setup on the live host. The live kit therefore
// boots with `builtinToolDeny: []` for ALL templates (a no-op: the
// restrict seam is not called), isolating N1/N3/N4 on the live host. The
// built-in DENY PATH itself (non-empty deny -> restrict call, disposer
// lift-once, deny-before-team-tool ordering) is covered at the t4a glue
// level (t4a-capability-wiring.test.ts F1/F3) and the t2 unit level
// (t2-tool-selector-deny.test.ts), matching the alpha.1 live precedent.
const CAPABILITY_BLUEPRINT = [
  '---',
  'schemaVersion: 1',
  'blueprintId: cap-bp-1',
  'revision: "1"',
  'leader:',
  '  templateId: leader',
  '  persona: "You lead the capability smoke team."',
  '  capabilities:',
  '    teamTools:',
  '      kind: allow',
  '      items:',
  '        - team_send_message',
  '        - team_list_members',
  '    builtinToolDeny: []',
  '    skills:',
  '      kind: allow',
  '      items:',
  '        - base',
  '    mcp:',
  '      kind: allow',
  '      items:',
  '        - cap-mcp',
  'members:',
  '  - templateId: tpl-a',
  '    displayName: "Member A"',
  '    persona: "You are member A of the capability smoke team."',
  '    capabilities:',
  '      teamTools:',
  '        kind: allow',
  '        items:',
  '          - team_delegate',
  '      builtinToolDeny: []',
  '      skills:',
  '        kind: allow',
  '        items:',
  '          - base',
  '          - alpha1-real-skill',
  '      mcp:',
  '        kind: deny',
  '  - templateId: tpl-b',
  '    displayName: "Member B"',
  '    persona: "You are member B of the capability smoke team."',
  '    capabilities:',
  '      teamTools:',
  '        kind: allow',
  '        items: []',
  '      builtinToolDeny: []',
  '      skills:',
  '        kind: deny',
  '      mcp:',
  '        kind: allow',
  '        items:',
  '          - cap-mcp',
  'requirements:',
  '  - domain: persona',
  '    name: standard',
  '  - domain: skill',
  '    name: base',
  'teamEnvelope:',
  '  allow: [assign-task, create-member, send-message, report-progress, archive-member, restore-member]',
  '  deny: [delete-team]',
  'memberEnvelopes:',
  '  - templateId: tpl-a',
  '    envelope:',
  '      allow: [send-message, report-progress]',
  '      deny: []',
  '  - templateId: tpl-b',
  '    envelope:',
  '      allow: [send-message, report-progress]',
  '      deny: []',
  'policyStates:',
  '  - id: default',
  '    description: "Capability smoke default state."',
  'quotas:',
  '  team:',
  '    maxInstances: 12',
  '    maxConcurrent: 12',
  '  members:',
  '    maxInstances: 4',
  '    maxConcurrent: 4',
  'metadata: {}',
  '---',
].join('\n')

// ── 1. fresh world + local bare repo ────────────────────────────────────────
if (existsSync(HOME)) die(`world already exists (refusing to clobber): ${HOME}`)
mkdirSync(HOME, { recursive: true })
log(`world: ${HOME}`)
log(`bare repo: cloning ${REPO} (branch ${BRANCH}) → ${REPO_GIT}`)
const clone = spawnSync('git', ['clone', '--bare', REPO, REPO_GIT], { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 })
if (clone.status !== 0) die(`git clone --bare failed: ${String(clone.stderr ?? clone.stdout).slice(0, 800)}`)
log('bare repo cloned')

// ── 2. install the hardening branch (the code under test) ─────────────────
log(`SPEC = ${SPEC}`)
log('installing plugin (task/alpha1-hardening) …')
const first = spawnSync(process.execPath, [BIN_JS, 'plugin', '--profile', 'web', 'add', SPEC], {
  cwd: HOME,
  env: { ...process.env, DSH_HOME: HOME },
  encoding: 'utf8',
  maxBuffer: 256 * 1024 * 1024,
})
const firstOut = `${first.stdout ?? ''}${first.stderr ?? ''}`
writeFileSync(join(EV, `cap-setup-${STAMP}-first-add.txt`), firstOut)
log(`install exit=${first.status}`)
if (first.status !== 0) {
  die(`install FAILED:\n${firstOut.slice(-1500)}`)
}
log('install SUCCEEDED')

// ── 3. assertions (install surface present; the PBA byte-identity is the T5 gate's job) ──
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

// ── 4. the CAPABILITY user-layer patch (override the product row + test harness) ──
// The override row replaces the bundle layer's config ENTIRELY (last-write-
// wins, whole config) — so it must carry EVERY field the boot needs
// (bootPhase, rootSessionId, the capability blueprintSource, seedMembers,
// teamSkills, generation, deniedSelection, mcpServer, staticModel,
// environmentFacts, externalPolicyFacts). rootSessionId is `cap-root`
// (distinct from the shipped `team-root` so a capability world never
// collides with a legacy one). teamSkills registers the REAL team skill
// alpha1-real-skill (plan 8.4: not just unknown-skill skip) — the catalog is
// the row config's narrowest production input point; member A's skills
// allow-list names it, so it is registered in member A's agent scope only.
//
// seedMembers MUST carry the two proven seed rows (shape verified against the
// alpha1-capability-live dump-config, the authoritative record of the boot
// that produced 3 live sessions): agent-bindings boot() consumes seedMembers
// ONLY in the create phase (one agents.create per seed, explicit
// childSessionId); the resume phase re-binds members from the durable domain
// truth. An empty seedMembers list boots a leader-only world (hardening3
// regression — no member child sessions, N1/N3 checks fail).
const patchLines = [
  `# cap user-layer patch (world ${STAMP}): CAPABILITY wiring smoke.`,
  '#',
  '# The dsh-agent-team row OVERRIDES the bundle layer config entirely,',
  '# pointing blueprintSource at a CAPABILITY Blueprint (leader + tpl-a +',
  '# tpl-b, each with different capabilities) and mcpServer at cap-mcp:',
  '# 3494 (started by cap-boot.mjs). rootSessionId = cap-root.',
  '#',
  '# The p6t6 row name points at the MAIN repo tools harness (a test',
  '# device); the directory-picker rows are the headless pin (bare disable',
  '# + browse pair).',
  '#',
  '# The dsh-agent-team row is a DIRECT row (same id, no insert) — the',
  '# override mechanism (last-write-wins, whole config replaced). The',
  '# dsh-agent-team-client row is NOT overridden (the bundle layer row',
  '# stands).',
  '- id: "dsh-agent-team"',
  '  name: "dsh-agent-team/host"',
  '  config:',
  '    bootPhase: "create"',
  '    rootSessionId: "cap-root"',
  '    blueprintSource: |',
  ...CAPABILITY_BLUEPRINT.split('\n').map((l) => `      ${l}`),
  '    seedMembers:',
  '      - instanceId: inst-capaa',
  '        templateId: tpl-a',
  '        label: member-a',
  '        childSessionId: session-capa-a',
  '      - instanceId: inst-capbb',
  '        templateId: tpl-b',
  '        label: member-b',
  '        childSessionId: session-capb-b',
  '    teamSkills:',
  '      - name: alpha1-real-skill',
  '        description: "Hardening live-smoke real team skill (plan 8.4)."',
  '        content: "alpha1-real-skill: the hardening live-smoke team skill. It is allowed by member A only, so its loadability in exactly one member scope is the H6 assertion."',
  '    generation: 1',
  '    deniedSelection: null',
  '    mcpServer:',
  '      name: cap-mcp',
  '      port: 3494',
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
log(`capability user-layer patch written to ${patchPath}`)

assertions.spec = SPEC
assertions.worldHome = HOME
assertions.installDir = PKG_DIR
assertions.branch = BRANCH
assertions.installExit = first.status
writeFileSync(ASSERT_FILE, JSON.stringify(assertions, null, 2))
log(`assertions → ${ASSERT_FILE}`)
log('CAP-SETUP-OK')
console.log('CAP-SETUP-OK')
