#!/usr/bin/env node
/**
 * run-boot.mjs — the LIVE half of BL-17 (Shell-PTY face), boot #4 of the five
 * owner-granted P2-04 starts (2026-11-06 allocation). ONE start, no retry.
 *
 * WHAT THIS SPENDS: exactly ONE Host start, charged through the BL-14
 * pre-registration gate. The per-run grant is materialised here, bound to THIS
 * tree's HEAD. The shared ledger in this directory is the ONE counter.
 *
 * WHAT IT ASKS — four live questions the host-free arms cannot answer:
 *
 *   item 1  SAME-PTY MULTI-COMMAND. One Member, one terminal: two sequential
 *           `bash` tool calls; the two `$$` / session / tty observations must be
 *           the SAME backend shell. Measured on the live Member's preset
 *           terminal (the host's pinned `tool-bash-persistent` over the pinned
 *           `dsh-terminal` PTY service). DISCLOSED: that Member's `bash` is the
 *           inherited host tool — no governed realm installs a terminal face
 *           (`GAP-PTY-CONTRACT-1`), so this proves the HOST PTY's sharing, not a
 *           confined PTY.
 *
 *   item 2  WRITE-ONLY READ DENIAL, LIVE. A Member whose effective WRITE lane
 *           contains a root and whose effective READ lane does not. A live
 *           `bash_probe` call declares that root as a READ and its body cats the
 *           secret: the refusal must be on the READ axis (`IO_READ_DENIED`),
 *           with zero provider calls and no secret bytes in the tool result.
 *           A supplementary (not preflighted) observation runs the same body
 *           with NO declared read, so the OS profile is the layer: kernel
 *           refusal, non-zero exit, no bytes.
 *
 *   item 3  THE chmod GAP. A file inside the effective READ lane but outside the
 *           effective WRITE lane. A live body `chmod 600 <file>` with NO chmod
 *           declaration must still CHANGE the mode (Landlock has no chmod
 *           right; the declaration is the only layer that could refuse it and
 *           this call declares nothing). Reproduced on THIS tree, not assumed.
 *
 *   item 4  `network: deny` REFUSAL POSITION, LIVE. A second Member whose
 *           effective policy is `network.access = deny`. One live
 *           `bash_probe` call must be refused at admission with
 *           `NETWORK_UNCONFINED_REALM`, zero provider spawn attempts. NOT a
 *           network-isolation claim: see the quoted §7 bar in the README.
 *
 * WHAT IS FIXTURE (disclosed in README §3):
 *   - the CEILING / RESTRICTION lane inputs and the per-template network choice
 *     are test composition (`a5sf-bl17-live-realm-provider-row.mjs`); the
 *     intersection, shell-class admission, guards, OS profile and realm install
 *     are the shipped product code;
 *   - `bash_probe` (`a5sf-bl17-bash-probe-tool.mjs`) is a composition-provided
 *     tool that only CALLS the confined face; it decides nothing;
 *   - counters/ledgers in the provider row and the tool are instrumentation.
 *
 * MODES
 *   node run-boot.mjs --plan   host-free: world, rows, blueprint ingest, patch
 *                              emission, row identity, preflight bundle. No gate,
 *                              no ledger row, no spawn.
 *   node run-boot.mjs          THE ONE BOOT.
 *
 * @module dev/agent-workflow/evidence/a5sf-bl17-live2/run-boot
 */
import { createHash } from 'node:crypto'
import {
  appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, statSync, writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  TestWorldFactory,
  authenticate,
  emitPatchLayer,
  fetchJson,
  tcpConnectProbe,
} from '../../../../tests/world-factory/lib/world-factory.mjs'
import {
  createRunRecord, formatSummary, overallVerdict, readAuthorityBinding,
} from '../../../../tests/world-factory/lib/run-record.mjs'
import { TEST_USE_BASELINE_SHA } from '../../../../tests/paths.mjs'
import { createA5sfHarness } from '../../../../tests/world-factory/lib/a5sf-harness.mjs'
import { preRegisterReadBudget, resolveHeadCommit } from '../../../../tests/world-factory/suites/150-a5sf-read.mjs'
import { remoteCall } from '../../../../tests/world-factory/lib/u6-fs-assembly.mjs'
import { presetDeclarationRow, smokePresetPlugins } from '../../../../tests/kits/_shared/preset-seam.mjs'
import { P2_01_ACCEPTANCE_ROOTS, assertAcceptanceRootWiring } from '../../../../tests/world-factory/lib/a5sf-acceptance-preflight.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..')
/** The host tree: this worktree's own pristine checkout if present, else the
 *  main checkout's (worktrees share the gitignored baseline). */
function hostTreePath() {
  const local = join(REPO_ROOT, 'tests', 'deepseek-harness-test-use')
  if (existsSync(join(local, 'packages', 'shell', 'tool-bash-persistent', 'lib', 'index.js'))) return local
  return resolve(REPO_ROOT, '..', '..', 'tests', 'deepseek-harness-test-use')
}
const HOST_TREE = hostTreePath()
const HOST_TOOL_BASH_PERSISTENT = join(HOST_TREE, 'packages', 'shell', 'tool-bash-persistent', 'lib', 'index.js')

const LINE = 'a5sfbl17'
const RUN_LOG = join(HERE, 'run.log')
const GRANT_PATH = join(HERE, 'grant.json')
const LEDGER_PATH = join(HERE, 'run-ledger.jsonl')
const PREFLIGHT_BUNDLE_PATH = join(HERE, 'preflight-bundle.json')
const PROVIDER_ROW = join(HERE, 'a5sf-bl17-live-realm-provider-row.mjs')
const TOOL_MODULE = join(HERE, 'a5sf-bl17-bash-probe-tool.mjs')

const ROOT = 'session-a5sf-bl17-root'
const CREATE_ROOT = 'session-a5sf-bl17-team'
const BP_ANCHOR_ID = 'team.a5sf.bl17.anchor'
const BP_MAIN_ID = 'team.a5sf.bl17.main'
const PRESET_ID = 'a5sf-bl17-base'

const CASES = Object.freeze(['shell-positive', 'write-only-read', 'chmod-gap', 'network-deny-refusal'])
/** The cases the shared zero-boot preflight schema can express. The network case
 *  is a REFUSAL-POSITION plan, which the schema grades only as a
 *  connection-denial plan (`networkProbeEnforced`), so it is hand-checked. */
const PREFLIGHTED_CASES = Object.freeze(['shell-positive', 'write-only-read', 'chmod-gap'])

const PLAN_ONLY = process.argv.includes('--plan')
const startedAt = new Date().toISOString()

function log(line) {
  const text = `[${new Date().toISOString()}] ${line}`
  // eslint-disable-next-line no-console
  console.log(text)
  try {
    appendFileSync(RUN_LOG, `${text}\n`)
  } catch {
    /* the console is still the live channel */
  }
}
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
const redact = (text) => String(text ?? '').replace(/\?token=[A-Za-z0-9_-]+/gu, '?token=<redacted>')
const parseJsonl = (path) => {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8').split('\n').filter((line) => line.trim() !== '').map((line) => {
    try { return JSON.parse(line) } catch { return { unparseable: line.slice(0, 200) } }
  })
}
const readJson = (path) => {
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null }
}

// ─────────────────────────────────────────────────────────────────────────────
// blueprints
// ─────────────────────────────────────────────────────────────────────────────

function mainBlueprintYaml() {
  return [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
    'leader:', '  templateId: leader',
    `  persona: ${JSON.stringify('You are the leader of the a5sf BL-17 live team. The driver dispatches the probes through the product row tool route; do not delegate on your own.')}`,
    '  capabilities:', '    teamTools:', '      kind: allow', '      items:',
    '        - team_delegate', '        - team_archive_member',
    '    builtinToolDeny: []',
    '    skills:', '      kind: allow', '      items: []',
    '    mcp:', '      kind: allow', '      items: []',
    '    permissions:', '      default: deny', '      allow: []', '      ask: []', '      deny: []',
    'teamEnvelope:', '  allow:', '    - create-member', '    - assign-task', '    - send-message', '    - report-progress', '    - archive-member', '  deny: []',
    'members:',
    '  - templateId: worker', '    displayName: "a5sf bl17 shell worker"',
    `    persona: ${JSON.stringify('You are the a5sf BL-17 shell worker. The driver executes your tool calls through the product row route.')}`,
    '  - templateId: netdeny', '    displayName: "a5sf bl17 network-deny worker"',
    `    persona: ${JSON.stringify('You are the a5sf BL-17 network-deny worker. Your realm declares network: deny.')}`,
    'memberEnvelopes:',
    '  - templateId: worker', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
    '  - templateId: netdeny', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
    'permissionMutationEnvelope:', '  rules: []', 'teamHardEnvelope:', '  rules: []',
    'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')
}

const BP_ANCHOR_YAML = [
  '---', 'schemaVersion: 3', `blueprintId: ${BP_ANCHOR_ID}`, 'revision: "1"',
  'leader:', '  templateId: leader',
  `  persona: ${JSON.stringify('You are the leader of the a5sf BL-17 anchor team.')}`,
  'members:', '  - templateId: worker', '    persona: "You are the a5sf BL-17 anchor worker."',
  'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
  'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
].join('\n')

function blueprintFacade() {
  const req = createRequire(join(REPO_ROOT, 'noop.cjs'))
  return req(join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'domain', 'blueprint', 'src', 'index.js'))
}
function assertBlueprintText(text, wantId, wantMembers, label) {
  const facade = blueprintFacade()
  let parsed
  try {
    parsed = facade.parseBlueprint(text)
  } catch (error) {
    throw new Error(`${label} rejected by the host validator: ${String(error?.message ?? error)}`)
  }
  const doc = parsed.blueprint ?? parsed
  if (doc.blueprintId !== wantId) throw new Error(`${label} resolves as ${String(doc.blueprintId)}, want ${wantId}`)
  if (!Array.isArray(doc.members) || doc.members.length !== wantMembers) {
    throw new Error(`${label} members=${String(doc.members?.length)}, want ${wantMembers}`)
  }
  return { ok: true, via: 'parseBlueprint(dist domain facade = the host own import)' }
}

// ─────────────────────────────────────────────────────────────────────────────
// rows / paths
// ─────────────────────────────────────────────────────────────────────────────

function teamRowConfig({ home }) {
  const dist = join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime')
  return {
    rootSessionId: ROOT,
    bootPhase: 'create',
    blueprintSource: BP_ANCHOR_YAML,
    blueprintDir: join(home, 'blueprints'),
    rootPresetId: PRESET_ID,
    memberPresetId: PRESET_ID,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'a5sf-bl17-model' },
    deniedSelection: null,
    mcpServers: [],
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl: pathToFileURL(join(dist, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href,
    seamUrl: pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href,
    a5sfEvidencePath: join(home, 'a5sf-consult.jsonl'),
    // The ONE composition-provided tool this run adds. It is mounted by the
    // SAME product row a real native module rides; it decides nothing.
    a5sfNativeToolModules: [{ url: pathToFileURL(TOOL_MODULE).href, config: { ledgerPath: join(home, 'bash-probe-ledger.jsonl') } }],
    // NOTE: no `teamToolPlane` — the ONLY confinement is the a5sf two-axis
    // realm the provider row supplies.
  }
}

function rowPathsOf({ home, workspaceDir }) {
  const workspace = realpathSync(workspaceDir)
  return {
    workspace,
    laneInside: join(workspace, 'lane', 'inside'),
    writeOnly: join(workspace, 'lane', 'write-only'),
    secret: join(workspace, 'lane', 'write-only', 'secret.txt'),
    modeFile: join(workspace, 'lane', 'inside', 'mode.txt'),
    homeOutside: join(home, 'realm-outside'),
  }
}

function rowsFor({ home, workspaceDir }) {
  const dist = join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime')
  const PRODUCTION_ROW = pathToFileURL(join(dist, 'src', 'plugin', 'host.js')).href
  const P6T6_ROW = pathToFileURL(join(REPO_ROOT, 'packages', 'tools', 'harness', 'plugin.mjs')).href
  const paths = rowPathsOf({ home, workspaceDir })
  return {
    paths,
    config: teamRowConfig({ home }),
    rows: [
      { id: 'a5sf-bl17-live-realm', name: pathToFileURL(PROVIDER_ROW).href, config: {
        allowRoot: paths.workspace,
        readAllow: [paths.laneInside],
        writeAllow: [paths.writeOnly],
        shellPrograms: ['bash'],
        networkDenyTemplates: ['netdeny'],
        bindingIdentity: 'team/bl17-shell',
        laneReportPath: join(home, 'lane-report.json'),
        laneProbePaths: [paths.laneInside, paths.writeOnly, paths.secret, paths.modeFile, paths.homeOutside],
        counterPath: join(home, 'confined-counter.jsonl'),
        scratchRoot: join(home, 'shell-scratch'),
      } },
      { id: 'dsh-agent-team', name: PRODUCTION_ROW, config: teamRowConfig({ home }) },
      { id: 'p6t6-team-tools', name: P6T6_ROW },
      presetDeclarationRow({
        id: PRESET_ID,
        displayName: 'a5sf bl17 base',
        description: `a5sf BL-17 live boot preset (${LINE}) = the smoke preset (persistent bash over the pinned PTY service)`,
        plugins: smokePresetPlugins({
          personaText: 'You are a coding agent powered by the {{model}} model.',
          cwdSuffix: 'Your working directory is {{cwd}}.',
          bashDescription: 'Run commands in a bash shell. State is persistent across calls.',
        }),
      }),
    ],
  }
}

function handOverRows(world, rows) {
  if (world?.u6Fs === undefined || !Array.isArray(world.u6Fs.rows)) {
    throw new Error('World contract changed: world.u6Fs.rows is not an array')
  }
  world.u6Fs.rows.push(...rows)
  return world.u6Fs.rows.map((row) => String(row.id))
}

function rowIdentityCheck(rows) {
  const byPackage = new Map()
  for (const row of rows) {
    const spec = String(row?.name ?? '')
    if (!spec.startsWith('file://')) continue
    const modulePath = fileURLToPath(spec)
    if (!existsSync(modulePath)) {
      return { ok: false, reason: 'ROW_MODULE_MISSING', detail: `${String(row.id)} -> ${modulePath} does not exist` }
    }
    let dir = dirname(modulePath)
    let pkgPath = null
    let pkg = null
    for (;;) {
      const candidate = join(dir, 'package.json')
      if (existsSync(candidate)) {
        try { pkg = JSON.parse(readFileSync(candidate, 'utf8')); pkgPath = candidate } catch { return { ok: false, reason: 'ROW_PACKAGE_UNREADABLE', detail: candidate } }
        break
      }
      const parent = dirname(dir)
      if (parent === dir) break
      dir = parent
    }
    if (pkg?.dsh?.client === undefined) continue
    const list = byPackage.get(pkgPath) ?? []
    list.push(String(row.id))
    byPackage.set(pkgPath, list)
  }
  for (const [pkgPath, list] of byPackage) {
    if (list.length > 1) return { ok: false, reason: 'DUPLICATE_CLIENT_PACKAGE_SOURCES', detail: `${pkgPath} sourced from ${list.join(', ')}` }
  }
  return { ok: true }
}

function homeSandboxPin({ home, workspaceRoot }) {
  const root = realpathSync(workspaceRoot)
  const path = join(home, 'cordis.patch.yml')
  const yaml = [
    '# a5sf BL-17 live fixture: pin the DEPLOYMENT file-sandbox fallback root to',
    '# this World\'s workspace (the confined realm resolves sandboxPolicy without a',
    '# session, so the fallback — not the session cwd — fences every Team read/write).',
    '- id: sandbox-policy',
    '  config:',
    '    mode: "workspace-write"',
    `    workspaceRoot: ${JSON.stringify(root)}`,
    '',
  ].join('\n')
  writeFileSync(path, yaml)
  return { path, mode: 'workspace-write', workspaceRoot: root }
}

// ─────────────────────────────────────────────────────────────────────────────
// the preflight bundle (schema a5sf-zero-boot-preflight/1)
// ─────────────────────────────────────────────────────────────────────────────

function authorityBlock() {
  const pointer = readJson(join(REPO_ROOT, 'dev', 'engineering', 'current-authority.json')) ?? {}
  const snapshot = readJson(join(REPO_ROOT, 'dev', 'engineering', 'authority-snapshots', `${String(pointer.snapshot_version)}.json`)) ?? {}
  const contract = snapshot.current_contract ?? {}
  return {
    pointerPath: 'dev/engineering/current-authority.json',
    snapshotVersion: String(pointer.snapshot_version ?? ''),
    contentDigest: String(pointer.content_digest ?? ''),
    baseline: String(contract.baseline ?? ''),
    pointerSha256: sha256(join(REPO_ROOT, 'dev', 'engineering', 'current-authority.json')),
  }
}

function preflightBundle({ head, paths, rows }) {
  const authority = authorityBlock()
  const caseDef = {
    'shell-positive': {
      face: 'subprocess', axis: 'read', locator: paths.laneInside, guardFactKey: 'shell-positive',
      expected: 'allow', method: 'spawn', collector: 'guard-fact', corpus: ['shell-positive'], deniedBy: undefined,
    },
    'write-only-read': {
      face: 'subprocess', axis: 'read', locator: paths.secret, guardFactKey: 'write-only-read',
      expected: 'deny', method: 'spawn', collector: 'guard-fact', corpus: ['write-only-read'], deniedBy: 'restriction',
    },
    'chmod-gap': {
      face: 'subprocess', axis: 'read', locator: paths.modeFile, guardFactKey: 'chmod-gap',
      expected: 'allow', method: 'spawn', collector: 'guard-fact', corpus: ['chmod-gap'], deniedBy: undefined,
    },
  }
  const cases = PREFLIGHTED_CASES.map((id) => ({
    id,
    ...caseDef[id],
    ...(caseDef[id].deniedBy === undefined ? {} : { deniedBy: caseDef[id].deniedBy }),
    returnShape: ['call', 'result', 'claim'],
    terminate: true,
    archiveBeforeStart: true,
  }))
  return {
    schema: 'a5sf-zero-boot-preflight/1',
    label: 'BL-17 live half, boot 4 of 5 (Shell-PTY face; one Member terminal + one network-deny Member)',
    sources: {
      note: 'Derived from the driver plan at the exact HEAD this run executes on. The CHMOD case is an ALLOWED call (axis read, inside the read lane) whose body performs an UNDECLARED chmod; the gap is measured on the file mode, not on an admission disposition. `plannedCases` lists only the three cases the shared schema can table; the network-deny case is a REFUSAL-POSITION observation and is hand-checked by the driver (see policy.note).',
      driver: 'dev/agent-workflow/evidence/a5sf-bl17-live2/run-boot.mjs',
      providerRow: 'dev/agent-workflow/evidence/a5sf-bl17-live2/a5sf-bl17-live-realm-provider-row.mjs',
      toolModule: 'dev/agent-workflow/evidence/a5sf-bl17-live2/a5sf-bl17-bash-probe-tool.mjs',
    },
    // ── the declared step order (grades `driver.gate-order` / `driver.log-capture`)
    // Tokens are plan-owned (`team-session`, `member`). `read-pre-create-state`
    // deliberately REQUIRES NOTHING: it is a diagnostic on a root that has no
    // team session yet, so requiring `team-session` there is exactly the boot-3
    // defect this declaration must not repeat. The state GATE requires it and
    // runs after `create-team` produces it.
    driver: {
      note: 'Step order as the driver actually executes it. `canFail` is declared for steps whose failure is diagnosed from an HTTP status/body; infrastructure steps that throw synchronously before any ledger row are covered by the run log, not by a route body.',
      steps: [
        { id: 'compose-rows', produces: ['rows'], canFail: false },
        { id: 'boot-host', produces: ['host'], canFail: false },
        { id: 'health-gate', requires: ['host'], canFail: true, gate: true, captures: ['status', 'body'] },
        { id: 'read-pre-create-state', canFail: true, captures: ['status', 'body'] },
        { id: 'create-team', produces: ['team-session', 'member'], canFail: true, captures: ['status', 'body'] },
        { id: 'state-gate', requires: ['team-session'], canFail: true, gate: true, captures: ['status', 'body'] },
        { id: 'delegate-worker', requires: ['team-session'], produces: ['member'], canFail: true, captures: ['status', 'body'] },
        { id: 'item1-same-pty', requires: ['member'], canFail: true, captures: ['status', 'body'] },
        { id: 'item2-write-only-read', requires: ['member'], canFail: true, captures: ['status', 'body'] },
        { id: 'item2b-write-only-kernel-read', requires: ['member'], canFail: true, captures: ['status', 'body'] },
        { id: 'item3-chmod-gap', requires: ['member'], canFail: true, captures: ['status', 'body'] },
        { id: 'delegate-netdeny', requires: ['team-session'], produces: ['member'], canFail: true, captures: ['status', 'body'] },
        { id: 'item4-network-deny', requires: ['member'], canFail: true, captures: ['status', 'body'] },
        { id: 'teardown', canFail: false },
      ],
    },
    assembly: {
      requiredDistFaces: ['subprocess'],
      distFaces: { subprocess: true, fs: true, web: true },
      hostModules: [
        { path: 'tests/deepseek-harness-test-use/packages/shell/tool-bash-persistent/lib/index.js', exists: true },
        { path: 'dev/agent-workflow/evidence/a5sf-bl17-live2/a5sf-bl17-bash-probe-tool.mjs', exists: true },
        { path: 'dev/agent-workflow/evidence/a5sf-bl17-live2/a5sf-bl17-live-realm-provider-row.mjs', exists: true },
      ],
      rowHandoff: {
        usesHandOverRows: true,
        beforeBoot: true,
        emittedRowIds: rows.map((r) => String(r.id)),
        worldRowIds: rows.map((r) => String(r.id)),
        healthProbeRowPresent: true,
      },
    },
    identity: {
      bootRoot: ROOT,
      teamRoot: CREATE_ROOT,
      createRoot: CREATE_ROOT,
      stateQueryRoot: CREATE_ROOT,
      toolRouteRoot: CREATE_ROOT,
      archiveRoot: CREATE_ROOT,
      oracleRoot: CREATE_ROOT,
      directiveRoot: CREATE_ROOT,
      blueprints: [
        { blueprintId: BP_ANCHOR_ID, members: 1 },
        { blueprintId: BP_MAIN_ID, members: 2 },
      ],
      memberBindings: PREFLIGHTED_CASES.map((id) => ({
        caseId: id,
        memberIdentity: 'worker',
        toolBindingIdentity: 'team/bl17-shell',
      })),
    },
    nativeModules: [
      { name: '@deepseek-ai/dsh-tool-bash-persistent', inject: ['tools', 'terminals'], requiredConfig: [], config: {}, role: 'the Member preset terminal (item 1); NOT mounted on a governed realm' },
      { name: 'a5sf-bl17-bash-probe', inject: ['tools', 'subprocess'], requiredConfig: [], config: { ledgerPath: join(dirname(PREFLIGHT_BUNDLE_PATH), 'bash-probe-ledger.jsonl') }, role: 'the composition caller of the confined face (items 2-4)' },
    ],
    policy: {
      effectiveReadAllow: [paths.laneInside],
      effectiveWriteAllow: [paths.writeOnly],
      networkAccess: 'allow',
      fifo: undefined,
      dispositions: {
        'shell-positive': { ceiling: 'allow', restriction: 'allow', effective: 'allow' },
        'write-only-read': { ceiling: 'allow', restriction: 'deny', effective: 'deny' },
        'chmod-gap': { ceiling: 'allow', restriction: 'allow', effective: 'allow' },
      },
      note: 'the network-deny case is NOT in `cases`: the shared schema grades a network case only as a connection-denial plan (`networkProbeEnforced`), while this run plans a REFUSAL-POSITION observation (zero provider calls). It is hand-checked in the driver and reported separately.',
    },
    cases,
    plannedCases: [...PREFLIGHTED_CASES],
    fixtures: {
      'shell-positive': {
        caseId: 'shell-positive',
        member: 'worker',
        locator: paths.laneInside,
        command: 'echo "pid=$$"; ps -o pid=,sess=,tty=,cmd= -p $$; echo "shell=persistent"',
        route: 'bash (the Member preset terminal; inherited host PTY, not a confined face)',
      },
      'write-only-read': {
        caseId: 'write-only-read',
        member: 'worker',
        locator: paths.secret,
        declaredRead: paths.secret,
        cwd: paths.laneInside,
        route: 'bash_probe (the composition caller of the confined face)',
      },
      'chmod-gap': {
        caseId: 'chmod-gap',
        member: 'worker',
        locator: paths.modeFile,
        declaredRead: paths.modeFile,
        declaredWrites: [],
        declaredChmod: [],
        cwd: paths.laneInside,
        route: 'bash_probe (the composition caller of the confined face)',
      },
    },
    candidate: { head, baseline: authority.baseline, frozen: false },
    authority,
    grant: {
      grantId: `grant-a5sf-bl17-live2-${head.slice(0, 12)}`,
      grantedBy: 'owner allocation 2026-11-06 ("批准5次P2-04预算"), allocation #2 = BL-17 live half; this run is start 4 of 5',
      boundCommit: head,
      priorRows: 0,
      plannedStarts: 1,
      maxStarts: 2,
      aborts: 0,
    },
    runRecord: {
      teamSha: head,
      hostSha: TEST_USE_BASELINE_SHA,
      bindings: {
        authority: {
          pointer: { snapshot_version: authority.snapshotVersion, content_digest: authority.contentDigest },
          baseline: authority.baseline,
          pointerSha256: authority.pointerSha256,
        },
      },
      ledger: { bootRows: 1, plannedStarts: 1, aborts: 0 },
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// plan mode
// ─────────────────────────────────────────────────────────────────────────────

async function planOnly() {
  log(`PLAN MODE — no gate, no ledger row, no spawn. repo=${REPO_ROOT} hostTree=${HOST_TREE}`)
  const head = resolveHeadCommit(REPO_ROOT)
  log(`HEAD=${String(head)} pinnedHost=${TEST_USE_BASELINE_SHA}`)
  log(`host persistent-bash module: ${HOST_TOOL_BASH_PERSISTENT} exists=${existsSync(HOST_TOOL_BASH_PERSISTENT)}`)
  log(`anchor blueprint: ${JSON.stringify(assertBlueprintText(BP_ANCHOR_YAML, BP_ANCHOR_ID, 1, 'anchor.yaml'))}`)
  log(`main blueprint: ${JSON.stringify(assertBlueprintText(mainBlueprintYaml(), BP_MAIN_ID, 2, 'main.yaml'))}`)
  const factory = new TestWorldFactory({ repoRoot: REPO_ROOT, evidenceRoot: HERE, hostTree: HOST_TREE })
  factory.assertHostBase('plan')
  const world = await factory.createWorld({ line: LINE, u6Fs: { rows: [] } })
  try {
    const { rows, paths, config } = rowsFor({ home: world.home, workspaceDir: world.workspaceDir })
    mkdirSync(config.blueprintDir, { recursive: true })
    const patch = emitPatchLayer([
      'a5sf BL-17 live boot: two-axis realm provider row + production Team row',
      'with a5sfEvidencePath + a5sfNativeToolModules + p6t6 + preset declaration.',
    ], rows)
    log(`patch layer bytes=${patch.length}; rows=${rows.map((r) => r.id).join(',')}`)
    const identity = rowIdentityCheck(rows)
    log(`pre-boot row identity check: ${JSON.stringify(identity)}`)
    if (identity.ok !== true) throw new Error(`row composition refused in plan: ${identity.reason}: ${identity.detail}`)
    const handed = handOverRows(world, rows)
    const emitted = rows.map((r) => String(r.id))
    if (JSON.stringify(emitted) !== JSON.stringify(handed)) {
      throw new Error(`ROW HANDOFF DEFECT: emitted ${JSON.stringify(emitted)} != world ${JSON.stringify(handed)}`)
    }
    log(`row handoff identity: emitted === world (${handed.length} rows) BEFORE boot`)
    const provider = await import(pathToFileURL(PROVIDER_ROW).href)
    const tool = await import(pathToFileURL(TOOL_MODULE).href)
    log(`provider row: name=${provider.name} apply=${typeof provider.apply} inject=${JSON.stringify(provider.inject)}`)
    log(`tool module: name=${tool.name} apply=${typeof tool.apply} inject=${JSON.stringify(tool.inject)}`)
    const pathRules = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'member-io-policy', 'src', 'path-rules.js')).href)
    const ceiling = { mode: 'restricted', allow: [paths.workspace], ask: [], deny: [] }
    const restrictionRead = { mode: 'restricted', allow: [paths.laneInside], ask: [], deny: [] }
    const restrictionWrite = { mode: 'restricted', allow: [paths.writeOnly], ask: [], deny: [] }
    const effectiveRead = pathRules.intersectPathRuleSets(ceiling, restrictionRead)
    const effectiveWrite = pathRules.intersectPathRuleSets(ceiling, restrictionWrite)
    log(`lane algebra: read=${JSON.stringify(effectiveRead.allow)} write=${JSON.stringify(effectiveWrite.allow)}`)
    log(`dispositions: ${JSON.stringify([paths.laneInside, paths.secret, paths.modeFile, paths.homeOutside].map((locator) => ({
      locator,
      read: pathRules.matchLocator(effectiveRead, locator),
      write: pathRules.matchLocator(effectiveWrite, locator),
    })))}`)
    const bundle = preflightBundle({ head, paths, rows })
    writeFileSync(PREFLIGHT_BUNDLE_PATH, `${JSON.stringify(bundle, null, 2)}\n`)
    log(`preflight bundle written: ${PREFLIGHT_BUNDLE_PATH}`)
  } finally {
    const torn = await world.teardown()
    log(`plan world torn down: homeDeleted=${String(torn.homeDeleted)} releasedPorts=${JSON.stringify(torn.releasedPorts)}`)
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// boot mode
// ─────────────────────────────────────────────────────────────────────────────

function writeMockTranscript(world, label) {
  const requests = world?.mock?.requests ?? []
  writeFileSync(join(HERE, `${label}-mock-requests.json`), `${JSON.stringify(requests, null, 2)}\n`)
  return requests.length
}

async function boot() {
  log(`BOOT MODE — exactly ONE Host start. repo=${REPO_ROOT} hostTree=${HOST_TREE}`)
  log(`pinned host=${TEST_USE_BASELINE_SHA}`)
  const head = resolveHeadCommit(REPO_ROOT)
  if (head === null) throw new Error('git rev-parse HEAD failed: the grant cannot be bound')
  log(`HEAD=${head}`)
  if (!existsSync(HOST_TOOL_BASH_PERSISTENT)) throw new Error(`the pinned persistent-bash module is missing: ${HOST_TOOL_BASH_PERSISTENT}`)

  // ── composition precondition: never spend a start on a row-identity defect ─
  const dry = rowsFor({ home: join(HERE, '.rowcheck'), workspaceDir: HERE })
  const identity = rowIdentityCheck(dry.rows)
  log(`pre-boot row identity check: ${JSON.stringify(identity).slice(0, 800)}`)
  if (identity.ok !== true) throw new Error(`row composition refused before any ledger row: ${identity.reason}: ${identity.detail}`)
  if (!existsSync(PREFLIGHT_BUNDLE_PATH)) {
    throw new Error(`NO PREFLIGHT BUNDLE at ${PREFLIGHT_BUNDLE_PATH}: run --plan and the shared preflight first; a boot without one is the defect class this gate exists to stop`)
  }

  // ── the per-run grant, bound to the EXACT HEAD this run executes on ───────
  const priorRows = parseJsonl(LEDGER_PATH).length
  const priorBoots = parseJsonl(LEDGER_PATH).filter((row) => String(row?.phase ?? '').startsWith('a5sf-bl17-live2-boot')).length
  if (priorBoots >= 1) throw new Error(`BUDGET_NOT_GRANTED: this driver authorises exactly ONE start and the ledger already holds ${String(priorBoots)} boot row(s); a retry needs a NEW owner ruling`)
  const grant = {
    grantId: `grant-a5sf-bl17-live2-${head.slice(0, 12)}`,
    grantedBy: 'owner allocation 2026-11-06 ("批准5次P2-04预算"), allocation #2 = BL-17 live half; this run is start 4 of 5. After it: 1 start remains (BL-18 live or an FS/Search re-validation, owner call).',
    allocationItem: 'P2-04 boot #4 of 5 — BL-17 live half (Shell-PTY face)',
    boundCommit: head,
    priorRows,
    plannedStarts: 1,
    maxStarts: priorRows + 2,
    aborts: 0,
    note: 'maxStarts = prior shared-ledger rows + 1 pre-registration (intent) row + 1 boot; the BL-14 gate counts shared-ledger rows, not spawns',
  }
  writeFileSync(GRANT_PATH, `${JSON.stringify(grant, null, 2)}\n`)
  log(`grant materialised: ${GRANT_PATH} maxStarts=${grant.maxStarts} boundCommit=${grant.boundCommit}`)

  const runId = `a5sf-bl17-live2-${new Date().toISOString().replace(/[:.]/gu, '-')}`
  const authority = authorityBlock()
  const record = createRunRecord({
    runId,
    suite: 'a5sf-bl17-live2',
    selectedCases: CASES,
    bindings: {
      teamSha: head,
      hostSha: TEST_USE_BASELINE_SHA,
      hostTree: HOST_TREE,
      line: LINE,
      sink: 'world-home a5sf-consult.jsonl (copy: consultations.jsonl)',
      grantId: grant.grantId,
      allocationItem: grant.allocationItem,
      authority: {
        pointer: { snapshot_version: authority.snapshotVersion, content_digest: authority.contentDigest },
        baseline: authority.baseline,
        pointerSha256: authority.pointerSha256,
      },
      providerComposition: 'test row a5sf-bl17-live-realm-provider-row.mjs (no product composition declares a shell class at this base)',
      laneAlgebra: 'packages/runtime/dist/packages/runtime/member-io-policy/src/path-rules.js # intersectPathRuleSets',
      toolCaller: 'test-composition tool a5sf-bl17-bash-probe-tool.mjs (calls the shipped confined face; decides nothing)',
    },
    ledgerPath: LEDGER_PATH,
  })
  const harness = createA5sfHarness({
    repoRoot: REPO_ROOT,
    evidenceRoot: HERE,
    suite: 'a5sf-bl17-live2',
    line: LINE,
    runRecord: record,
    maxHostStarts: grant.maxStarts,
    hostTree: HOST_TREE,
  })
  log(`candidate asserted: ${JSON.stringify(harness.assertCandidate())}`)

  const lease = await preRegisterReadBudget({
    grantPath: GRANT_PATH,
    headCommit: head,
    runRecord: record,
    requiredBoots: 1,
  })
  log(`intent row written; bootsSpent=${String(lease.bootsSpent())}`)

  let world = null
  let bootInfo = null
  let teardown = null
  let failure = null
  const add = (id, verdict, detail = {}) => {
    record.addCase(id, verdict, detail)
    log(`case ${id}: ${verdict} ${JSON.stringify(detail).slice(0, 600)}`)
  }

  try {
    world = await harness.createWorld({ line: LINE, u6Fs: { rows: [] } })
    const { rows, config, paths } = rowsFor({ home: world.home, workspaceDir: world.workspaceDir })
    const handed = handOverRows(world, rows)
    log(`row handoff: emitted=${JSON.stringify(rows.map((r) => r.id))} world=${JSON.stringify(handed)}`)
    const sinkPath = join(world.home, 'a5sf-consult.jsonl')
    const counterPath = join(world.home, 'confined-counter.jsonl')
    const probeLedgerPath = join(world.home, 'bash-probe-ledger.jsonl')
    const laneReportPath = join(world.home, 'lane-report.json')
    const claims = {
      positive: `A5SF_BL17_SHELL_OK_${world.id}`,
      secret: `A5SF_BL17_WRITE_ONLY_SECRET_${world.id}`,
      mode: '600',
    }
    const homePin = homeSandboxPin({ home: world.home, workspaceRoot: world.workspaceDir })
    writeFileSync(join(HERE, 'fixtures.json'), `${JSON.stringify({
      worldId: world.id,
      homePatch: homePin,
      laneInside: paths.laneInside,
      writeOnly: paths.writeOnly,
      secret: paths.secret,
      modeFile: paths.modeFile,
      homeOutside: paths.homeOutside,
      claims: { positive: claims.positive, secret: claims.secret },
      sinkPath,
      counterPath,
      probeLedgerPath,
      laneReportPath,
    }, null, 2)}\n`)

    mkdirSync(config.blueprintDir, { recursive: true })
    writeFileSync(join(config.blueprintDir, 'anchor.yaml'), BP_ANCHOR_YAML)
    writeFileSync(join(config.blueprintDir, 'main.yaml'), mainBlueprintYaml())
    writeFileSync(join(world.home, 'p6t6-directive.json'), `${JSON.stringify({ boot: 1, phase: 'create', reportDir: world.logDir, runStamp: world.id, rootSessionId: CREATE_ROOT }, null, 2)}\n`)
    assertBlueprintText(BP_ANCHOR_YAML, BP_ANCHOR_ID, 1, 'anchor.yaml')
    assertBlueprintText(mainBlueprintYaml(), BP_MAIN_ID, 2, 'main.yaml')

    // ── fixtures: one read-lane file, one write-only secret, one mode file ──
    mkdirSync(paths.laneInside, { recursive: true })
    mkdirSync(paths.writeOnly, { recursive: true })
    mkdirSync(paths.homeOutside, { recursive: true })
    writeFileSync(paths.secret, `${claims.secret}\n`)
    writeFileSync(paths.modeFile, 'mode-carrier\n')
    statSync(paths.modeFile)
    log(`fixtures: lane=${paths.laneInside} writeOnly=${paths.writeOnly} secret=${paths.secret} modeFile=${paths.modeFile}`)

    await world.startMock({ decide: () => ({ kind: 'text', content: 'A5SF_BL17_IDLE' }) })
    log(`mock started on ${String(world.mock?.port)}`)
    bootInfo = await lease.boot(() => harness.boot({ world, phase: 'a5sf-bl17-live2-boot1', bootTimeoutMs: 180_000 }))
    log(`BOOTED port=${bootInfo.port} (lease bootsSpent=${lease.bootsSpent()}) log=${bootInfo.logPath}`)
    record.record.boots = [{ phase: 'a5sf-bl17-live2-boot1', world: world.id, port: bootInfo.port, logPath: bootInfo.logPath }]

    const origin = `http://127.0.0.1:${bootInfo.port}`
    const hostAlive = () => world.instance?.child !== null && world.instance?.child !== undefined && world.instance?.child.exitCode === null
    const cookie = await authenticate(origin, world.token)
    log('authenticated (token never recorded)')
    const waitFor = async (predicate, timeoutMs, everyMs = 400) => {
      const t0 = Date.now()
      for (;;) {
        let hit = false
        try { hit = (await predicate()) === true } catch { hit = false }
        if (hit) return true
        if (Date.now() - t0 > timeoutMs) return false
        await new Promise((r) => setTimeout(r, everyMs))
      }
    }
    const healthOk = await waitFor(async () => {
      const st = await fetchJson(`${origin}/__p6t6/health`, undefined, 20_000)
      return st.status === 200 && st.body?.ok === true
    }, 120_000)
    const healthBody = await fetchJson(`${origin}/__p6t6/health`, undefined, 20_000)
    log(`p6t6 health=${String(healthOk)} hostAlive=${String(hostAlive())} body=${redact(JSON.stringify(healthBody.body ?? null)).slice(0, 400)}`)
    if (healthOk !== true) throw new Error(`the p6t6 health route never answered ok:true (setupError would be set); no row is measurable on a bare World: ${redact(JSON.stringify(healthBody.body ?? null)).slice(0, 300)}`)

    // DIAGNOSTIC ONLY, never a gate: `/__p6t6/state` reads control state and
    // pending deliveries for `rootSid`, and on a root with NO team session yet
    // `listControlState` throws TEAM_RUNTIME_TEAM_SESSION_NOT_FOUND (root.ts:3774)
    // — so the route answers non-200 until `team.create` has created the team.
    // Boot #3 of 5 gated on this route BEFORE create and aborted here; the
    // response body was not recorded. Record it now, and gate AFTER create.
    const preCreateState = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
    log(`p6t6 state BEFORE team.create (diagnostic, not a gate): status=${String(preCreateState.status)} body=${redact(JSON.stringify(preCreateState.body ?? null)).slice(0, 500)}`)

    const created = await remoteCall(fetchJson, origin, cookie, 'team.create', {
      rootSessionId: CREATE_ROOT,
      blueprintId: BP_MAIN_ID,
      initialWork: { prompt: 'A5SF_BL17_IDLE: the driver dispatches everything; reply with one short line.' },
    }, 'a5sfbl17')
    const createOk = created.status === 200 && created.body?.result?.ok === true
    log(`team.create status=${String(created.status)} ok=${String(createOk)} ${redact(JSON.stringify(created.body ?? null)).slice(0, 400)}`)
    if (!createOk) throw new Error(`team.create failed: status=${String(created.status)} body=${redact(JSON.stringify(created.body ?? null)).slice(0, 300)}`)

    // The team now exists on CREATE_ROOT, which is the ONLY root `/__p6t6/state`
    // can read (the directive root). This is the gate that boot #3 should have used.
    const stateOk = await waitFor(async () => {
      const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
      return st.status === 200 && st.body?.rootSessionId === CREATE_ROOT && st.body?.teamSession !== null
    }, 120_000)
    const stateAfterCreate = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
    log(`p6t6 state AFTER team.create (rootSessionId=${CREATE_ROOT}, teamSession!=null)=${String(stateOk)} status=${String(stateAfterCreate.status)} members=${String(Array.isArray(stateAfterCreate.body?.members) ? stateAfterCreate.body.members.length : 'n/a')}`)
    if (stateOk !== true) throw new Error(`the created team never appeared on the directive root ${CREATE_ROOT}: status=${String(stateAfterCreate.status)} body=${redact(JSON.stringify(stateAfterCreate.body ?? null)).slice(0, 300)}`)

    const toolRoute = async (name, args, as, callId) => fetchJson(`${origin}/__p6t6/tool`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ name, args, as, callId }),
    }, 120_000)

    const delegate = async (templateId, label) => {
      const callId = `a5sfbl17-delegate-${templateId}`
      const res = await toolRoute('team_delegate', {
        rootSessionId: CREATE_ROOT,
        requestToken: callId,
        delegationTemplateId: templateId,
        label,
        prompt: 'A5SF_BL17_IDLE: the driver dispatches the probes directly through the product row route. Reply with one short line.',
      }, ROOT, callId)
      log(`delegate ${templateId}: status=${String(res.status)} body=${redact(JSON.stringify(res.body ?? null)).slice(0, 500)}`)
      const live = await waitFor(async () => {
        const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
        const members = Array.isArray(st.body?.members) ? st.body.members : []
        const found = members.find((m) => String(m.templateId) === templateId && String(m.childSessionId ?? '') !== '')
        return st.status === 200 && found !== undefined
      }, 120_000)
      const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
      const member = (st.body?.members ?? []).find((m) => String(m.templateId) === templateId && String(m.childSessionId ?? '') !== '') ?? null
      log(`member ${templateId}: live=${String(live)} childSessionId=${String(member?.childSessionId ?? '')} lifecycle=${String(member?.lifecycle ?? '')}`)
      if (live !== true || member === null) throw new Error(`member ${templateId} never became live`)
      return member
    }

    const memberOf = async (templateId) => {
      const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
      return (st.body?.members ?? []).find((m) => String(m.templateId) === templateId) ?? null
    }

    const probe = async (as, callId, args) => {
      const res = await toolRoute('bash_probe', args, as, callId)
      const errorCode = res.body?.error?.info?.code ?? null
      let value = null
      if (res.body?.ok === true && typeof res.body?.value === 'string') {
        try { value = JSON.parse(res.body.value) } catch { value = null }
      }
      return { status: res.status, ok: res.body?.ok === true, code: errorCode, error: res.body?.error ?? null, value }
    }

    const factsOf = () => parseJsonl(sinkPath)
    const counterOf = () => parseJsonl(counterPath)
    const probeLedgerOf = () => parseJsonl(probeLedgerPath)

    // ═══════════════════════════════════════════════════════════════════════
    // item 1 — the SAME PTY across two sequential commands on ONE Member
    // ═══════════════════════════════════════════════════════════════════════
    const worker = await delegate('worker', 'a5sfbl17-worker')
    const workerSession = String(worker.childSessionId)
    const ptyCommand = 'echo "pid=$$"; ps -o pid=,sess=,tty=,cmd= -p $$; echo "shell=persistent"'
    const samePtyBefore = { at: new Date().toISOString(), counterRows: counterOf().length }
    const bash1 = await toolRoute('bash', { command: ptyCommand }, workerSession, 'a5sfbl17-bash-1')
    const bash2 = await toolRoute('bash', { command: ptyCommand }, workerSession, 'a5sfbl17-bash-2')
    const bashText = (res) => {
      const v = res.body?.value
      if (typeof v === 'string') return v
      if (v !== null && typeof v === 'object') return JSON.stringify(v)
      return JSON.stringify(res.body ?? {})
    }
    const observedPids = [bash1, bash2].map((res) => {
      const text = bashText(res)
      const pid = /pid=(\d+)/u.exec(text)?.[1] ?? null
      const ps = /^\s*(\d+)\s+(\d+)\s+(\S+)\s+(.*)$/mu.exec(text)
      return {
        status: res.status,
        ok: res.body?.ok === true,
        pid,
        psPid: ps?.[1] ?? null,
        session: ps?.[2] ?? null,
        tty: ps?.[3] ?? null,
        text: text.slice(0, 400),
      }
    })
    const samePty = observedPids[0].pid !== null
      && observedPids[0].pid === observedPids[1].pid
      && observedPids[0].pid === observedPids[0].psPid
      && observedPids[1].pid === observedPids[1].psPid
      && observedPids[0].tty !== null && observedPids[0].tty !== '?'
      && observedPids[0].tty === observedPids[1].tty
    const item1 = {
      schema: 'a5sf-bl17-live2/same-pty/1',
      at: new Date().toISOString(),
      member: { instanceId: String(worker.instanceId), childSessionId: workerSession, templateId: 'worker' },
      calls: observedPids,
      samePid: observedPids[0].pid !== null && observedPids[0].pid === observedPids[1].pid,
      sameSession: observedPids[0].session !== null && observedPids[0].session === observedPids[1].session,
      sameTty: observedPids[0].tty !== null && observedPids[0].tty === observedPids[1].tty,
      verdict: samePty ? 'PROVEN' : 'REFUTED',
      ptyBackend: 'the pinned @deepseek-ai/dsh-tool-bash-persistent over the pinned @deepseek-ai/dsh-terminal PTY service (the Member preset terminal)',
      disclosure: 'this Member\'s `bash` is the INHERITED host tool: no governed realm installs a terminal face (GAP-PTY-CONTRACT-1). The pid/session sharing is the HOST PTY service\'s; it is NOT a confined PTY and it is NOT the shell-class subprocess face.',
      counterRowsBefore: samePtyBefore.counterRows,
      counterRowsAfter: counterOf().length,
      note: 'zero confined spawns are expected for these two calls: the PTY lane is the host terminal service, not the confined subprocess face.',
    }
    writeFileSync(join(HERE, 'item1-same-pty.json'), `${JSON.stringify(item1, null, 2)}\n`)
    add('same-pty-multi-command', samePty ? 'PASS' : 'FAIL', {
      pids: observedPids.map((p) => p.pid),
      sessions: observedPids.map((p) => p.session),
      ttys: observedPids.map((p) => p.tty),
      samePty,
      disclosure: item1.disclosure,
    })

    // ═══════════════════════════════════════════════════════════════════════
    // item 2 — write-only root declared as a READ: refusal on the READ axis
    // ═══════════════════════════════════════════════════════════════════════
    const factsBefore2 = factsOf().length
    const counterBefore2 = counterOf().length
    const readAttempt = await probe(workerSession, 'a5sfbl17-write-only-read', {
      body: `cat ${JSON.stringify(paths.secret)}`,
      cwd: paths.laneInside,
      reads: [paths.secret],
    })
    const lastProbe2 = probeLedgerOf().at(-1) ?? null
    const refusal2Code = readAttempt.code ?? lastProbe2?.code ?? null
    const refusal2Message = readAttempt.error?.message ?? lastProbe2?.message ?? null
    const facts2 = factsOf().slice(factsBefore2)
    const counter2 = counterOf().slice(counterBefore2)
    const secretDenyFacts = facts2.filter((f) => String(f?.locator ?? '') === paths.secret && f?.decision === 'deny')
    const readDenyFacts = secretDenyFacts.filter((f) => f?.decidedBy === 'IO_READ_DENIED')
    const bodyText2 = JSON.stringify(readAttempt.error ?? readAttempt.value ?? {})
    const noBytes2 = !bodyText2.includes(claims.secret)
    const item2 = {
      schema: 'a5sf-bl17-live2/write-only-read/1',
      at: new Date().toISOString(),
      member: { instanceId: String(worker.instanceId), childSessionId: workerSession },
      declaredRead: paths.secret,
      effectiveReadLane: [paths.laneInside],
      effectiveWriteLane: [paths.writeOnly],
      refusal: { status: readAttempt.status, ok: readAttempt.ok, code: refusal2Code, message: refusal2Message, error: readAttempt.error, bodyIncludedSecretBytes: !noBytes2 },
      facts: secretDenyFacts,
      readAxisOnly: secretDenyFacts.length === 1 && readDenyFacts.length === 1 && !secretDenyFacts.some((f) => f?.decidedBy === 'IO_WRITE_DENIED'),
      providerCallsDuringCall: counter2.length,
      confinedSpawnAttempts: counter2.filter((r) => r?.leg === 'confined-spawn-attempt').length,
      probeLedgerDuringCall: probeLedgerOf().slice(-1),
      verdict: (secretDenyFacts.length === 1 && readDenyFacts.length === 1 && counter2.length === 0 && noBytes2) ? 'PROVEN' : 'REFUTED',
      note: 'the refusal is the READ lane of the shipped confined face (IO_READ_DENIED), decided before any provider call; the secret bytes are absent from the tool result because no process existed.',
    }
    writeFileSync(join(HERE, 'item2-write-only-read.json'), `${JSON.stringify(item2, null, 2)}\n`)
    add('write-only-read-denied-on-read-axis', item2.verdict === 'PROVEN' ? 'PASS' : 'FAIL', {
      code: refusal2Code,
      facts: secretDenyFacts.length,
      decidedBy: secretDenyFacts.map((f) => f.decidedBy),
      providerCalls: counter2.length,
      bytesReturned: !noBytes2,
    })

    // ── supplementary: the SAME body with NO declared read (the OS layer) ──
    const factsBefore2b = factsOf().length
    const counterBefore2b = counterOf().length
    const kernelAttempt = await probe(workerSession, 'a5sfbl17-kernel-read', {
      body: `cat ${JSON.stringify(paths.secret)}; rc=$?; echo "cat_rc=$rc"; exit $rc`,
      cwd: paths.laneInside,
    })
    const counter2b = counterOf().slice(counterBefore2b)
    const kernelText = kernelAttempt.value?.stdout ?? ''
    const kernelDenied = kernelAttempt.ok === true
      && kernelAttempt.value?.exitCode !== 0
      && !kernelText.includes(claims.secret)
      && counter2b.some((r) => r?.leg === 'confined-spawn')
    const item2b = {
      schema: 'a5sf-bl17-live2/write-only-kernel-read/1',
      at: new Date().toISOString(),
      supplementary: true,
      preflighted: false,
      why_not_preflighted: 'the shared zero-boot schema models a deny case as an admission disposition; this call is ADMITTED (no declared read) and the OS profile is the refusing layer. Declaring it `expected: deny` on the read axis would contradict the declared lane and the preflight would (correctly) reject the plan.',
      member: { instanceId: String(worker.instanceId), childSessionId: workerSession },
      body: `cat ${JSON.stringify(paths.secret)}; rc=$?; echo "cat_rc=$rc"; exit $rc`,
      result: kernelAttempt.value,
      status: kernelAttempt.status,
      ok: kernelAttempt.ok,
      exitCode: kernelAttempt.value?.exitCode ?? null,
      stdout: kernelText,
      stderr: kernelAttempt.value?.stderr ?? '',
      secretBytesReturned: kernelText.includes(claims.secret),
      confinedSpawnAttempts: counter2b.filter((r) => r?.leg === 'confined-spawn-attempt').length,
      confinedSpawns: counter2b.filter((r) => r?.leg === 'confined-spawn').length,
      factsDuringCall: factsOf().slice(factsBefore2b),
      verdict: kernelDenied ? 'PROVEN' : 'REFUTED',
      note: 'the body runs (the call is admitted); the kernel denies the read because the write-only root carries no READ_FILE bit. `cat_rc` is the child\'s own exit status, so "it failed" cannot be the command\'s own bug alone: the byte token is absent and the process really ran.',
    }
    writeFileSync(join(HERE, 'item2b-write-only-kernel-read.json'), `${JSON.stringify(item2b, null, 2)}\n`)
    add('write-only-read-denied-by-kernel', item2b.verdict === 'PROVEN' ? 'PASS' : 'FAIL', {
      exitCode: item2b.exitCode,
      secretBytesReturned: item2b.secretBytesReturned,
      confinedSpawns: item2b.confinedSpawns,
    })

    // ═══════════════════════════════════════════════════════════════════════
    // item 3 — the chmod gap: an UNDECLARED same-uid chmod still changes mode
    // ═══════════════════════════════════════════════════════════════════════
    const modeBefore = statSync(paths.modeFile).mode & 0o777
    const chmodAttempt = await probe(workerSession, 'a5sfbl17-chmod-gap', {
      body: `chmod 600 ${JSON.stringify(paths.modeFile)}; rc=$?; echo "chmod_rc=$rc"; stat -c '%a' ${JSON.stringify(paths.modeFile)}; exit $rc`,
      cwd: paths.laneInside,
      reads: [paths.modeFile],
    })
    const modeAfter = statSync(paths.modeFile).mode & 0o777
    const item3 = {
      schema: 'a5sf-bl17-live2/chmod-gap/1',
      at: new Date().toISOString(),
      member: { instanceId: String(worker.instanceId), childSessionId: workerSession },
      file: paths.modeFile,
      lane: { read: 'inside the effective read lane', write: 'OUTSIDE the effective write lane' },
      declared: { reads: [paths.modeFile], writes: [], chmod: [] },
      modeBefore: `0o${modeBefore.toString(8)}`,
      modeAfter: `0o${modeAfter.toString(8)}`,
      exitCode: chmodAttempt.value?.exitCode ?? null,
      stdout: chmodAttempt.value?.stdout ?? null,
      stderr: chmodAttempt.value?.stderr ?? null,
      modeChanged: modeBefore !== modeAfter && modeAfter === 0o600,
      verdict: (modeBefore !== modeAfter && modeAfter === 0o600) ? 'GAP-REPRODUCED' : 'NOT-REPRODUCED',
      note: 'the composition declared NO chmod target, so the admission had nothing to refuse. Landlock has no chmod right: the same-uid mode change is outside the OS profile. This is the disclosed gap (a5sf-bash README §6.2), reproduced on THIS tree.',
    }
    writeFileSync(join(HERE, 'item3-chmod-gap.json'), `${JSON.stringify(item3, null, 2)}\n`)
    add('chmod-gap-reproduced', item3.verdict === 'GAP-REPRODUCED' ? 'PASS' : 'FAIL', {
      modeBefore: item3.modeBefore,
      modeAfter: item3.modeAfter,
      exitCode: item3.exitCode,
      modeChanged: item3.modeChanged,
    })

    // ═══════════════════════════════════════════════════════════════════════
    // item 4 — `network: deny`: refusal at admission, zero processes
    // ═══════════════════════════════════════════════════════════════════════
    const netMember = await delegate('netdeny', 'a5sfbl17-netdeny')
    const netSession = String(netMember.childSessionId)
    const factsBefore4 = factsOf().length
    const counterBefore4 = counterOf().length
    const netAttempt = await probe(netSession, 'a5sfbl17-network-deny', {
      body: 'echo A5SF_BL17_NET_BODY_SHOULD_NOT_RUN',
      cwd: paths.laneInside,
      reads: [paths.laneInside],
    })
    const lastProbe4 = probeLedgerOf().at(-1) ?? null
    const refusal4Code = netAttempt.code ?? lastProbe4?.code ?? null
    const refusal4Message = netAttempt.error?.message ?? lastProbe4?.message ?? null
    const counter4 = counterOf().slice(counterBefore4)
    const facts4 = factsOf().slice(factsBefore4)
    const item4 = {
      schema: 'a5sf-bl17-live2/network-deny-refusal/1',
      at: new Date().toISOString(),
      member: { instanceId: String(netMember.instanceId), childSessionId: netSession, templateId: 'netdeny' },
      declaredPolicy: { network: { access: 'deny' }, read: [paths.laneInside], write: [paths.writeOnly] },
      refusal: { status: netAttempt.status, ok: netAttempt.ok, code: refusal4Code, message: refusal4Message, error: netAttempt.error },
      refusalIsAdmission: refusal4Code === 'NETWORK_UNCONFINED_REALM',
      providerCallsDuringCall: counter4.length,
      confinedSpawnAttempts: counter4.filter((r) => r?.leg === 'confined-spawn-attempt').length,
      confinedSpawns: counter4.filter((r) => r?.leg === 'confined-spawn').length,
      bodyRan: JSON.stringify(netAttempt.value ?? netAttempt.error ?? {}).includes('A5SF_BL17_NET_BODY_SHOULD_NOT_RUN'),
      factsDuringCall: facts4,
      capabilityProbe: {
        dimension: 'network-destination',
        levelExpected: 'unsupported',
        source: 'the shipped provider\'s own probe (packages/runtime/sandbox-provider/probe-abi.ts -> networkProbeRow); the face refuses deny unless the probe says `enforced`',
        note: 'THIS RUN DOES NOT CLAIM NETWORK ISOLATION. It claims the refusal happened before any process, because the backend measured `unsupported`.',
      },
      verdict: (refusal4Code === 'NETWORK_UNCONFINED_REALM'
        && counter4.length === 0
        && !JSON.stringify(netAttempt.value ?? netAttempt.error ?? {}).includes('A5SF_BL17_NET_BODY_SHOULD_NOT_RUN')) ? 'PROVEN' : 'REFUTED',
      osLevelNetworkIsolationClaimed: false,
      quotedBar: 'a5sf-subprocess-face README §7: refusing to spawn is not evidence of network isolation; a claim would require (1) an enforced capability row with a mechanism and evidence, (2) a real child attempt that fails at the kernel/transport under the deny lane, (3) a positive control on the wire, (4) an out-of-band transport observation, and (5) a second consumer path on the live Host preset. NONE of 1-5 exists on this host.',
    }
    writeFileSync(join(HERE, 'item4-network-deny.json'), `${JSON.stringify(item4, null, 2)}\n`)
    add('network-deny-refused-at-admission', item4.verdict === 'PROVEN' ? 'PASS' : 'FAIL', {
      code: refusal4Code,
      providerCalls: counter4.length,
      bodyRan: item4.bodyRan,
      osLevelNetworkIsolationClaimed: false,
    })

    // ── copies + teardown ─────────────────────────────────────────────────
    if (existsSync(sinkPath)) writeFileSync(join(HERE, 'consultations.jsonl'), readFileSync(sinkPath))
    if (existsSync(counterPath)) writeFileSync(join(HERE, 'confined-counter.jsonl'), readFileSync(counterPath))
    if (existsSync(probeLedgerPath)) writeFileSync(join(HERE, 'bash-probe-ledger.jsonl'), readFileSync(probeLedgerPath))
    if (existsSync(laneReportPath)) writeFileSync(join(HERE, 'lane-report.json'), readFileSync(laneReportPath))
    const proxyMarketing = {
      workerMember: await memberOf('worker'),
      netdenyMember: await memberOf('netdeny'),
    }
    for (const member of [proxyMarketing.workerMember, proxyMarketing.netdenyMember]) {
      if (member === null) continue
      const archived = await toolRoute('team_archive_member', {
        rootSessionId: CREATE_ROOT,
        requestToken: `a5sfbl17-archive-${String(member.templateId)}`,
        targetInstanceId: String(member.instanceId),
      }, ROOT, `a5sfbl17-archive-${String(member.templateId)}`)
      log(`archive ${String(member.templateId)}: status=${String(archived.status)} body=${redact(JSON.stringify(archived.body ?? null)).slice(0, 300)}`)
    }
    writeFileSync(join(HERE, 'members-final.json'), `${JSON.stringify(proxyMarketing, null, 2)}\n`)

    record.record.evidence = {
      worldId: world.id,
      sinkPath,
      sinkSha256: existsSync(sinkPath) ? sha256(sinkPath) : null,
      counterPath,
      probeLedgerPath,
      laneReportPath,
      hostLogPath: bootInfo.logPath,
      cases: { item1: 'item1-same-pty.json', item2: 'item2-write-only-read.json', item2b: 'item2b-write-only-kernel-read.json', item3: 'item3-chmod-gap.json', item4: 'item4-network-deny.json' },
    }
  } catch (error) {
    failure = error
    log(`RUN FAILED: ${String(error?.stack ?? error)}`)
    for (const id of CASES) {
      if (record.getCase(id) === undefined) add(id, 'NOT_REACHED', { reason: 'RUN_ABORTED', detail: redact(String(error?.message ?? error)).slice(0, 600) })
    }
  } finally {
    try {
      if (world !== null) teardown = await world.teardown()
      log(`teardown: ${JSON.stringify(teardown ?? null).slice(0, 900)}`)
    } catch (error) {
      log(`teardown error: ${String(error?.message ?? error)}`)
    }
    const hostPid = bootInfo === null ? null : world?.instance?.child?.pid ?? null
    const portStillOpen = bootInfo === null ? null : await tcpConnectProbe(bootInfo.port, 1500)
    const processSeam = {
      hostPid,
      hostChildExitCode: world?.instance?.child?.exitCode ?? null,
      portStillListening: portStillOpen,
      worldTeardown: teardown ?? null,
      homeExistsAfterTeardown: world === null ? null : existsSync(world.home),
      note: 'the Host child is the process this run spawned; the World teardown kills it and releases the port. portStillListening=true would be an orphan.',
    }
    log(`process seam: ${JSON.stringify(processSeam).slice(0, 800)}`)
    writeFileSync(join(HERE, 'teardown.json'), `${JSON.stringify(processSeam, null, 2)}\n`)
    const bootLog = world?.logDir === undefined ? null : join(world.logDir, 'host.log')
    if (bootLog !== null && existsSync(bootLog)) writeFileSync(join(HERE, 'host.log'), readFileSync(bootLog))
    const ledgerRows = parseJsonl(LEDGER_PATH)
    writeFileSync(join(HERE, 'ledger-rows.json'), `${JSON.stringify({ ledgerPath: LEDGER_PATH, rowCount: ledgerRows.length, rows: ledgerRows }, null, 2)}\n`)
    log(`ledger rows (${String(ledgerRows.length)}): ${ledgerRows.map((r) => `${String(r.kind ?? r.phase ?? '?')}:${String(r.grantId ?? r.world ?? '')}`).join(' | ')}`)
    const finalized = record.finalize()
    writeFileSync(join(HERE, 'run-record.json'), `${JSON.stringify(finalized, null, 2)}\n`)
    const summary = formatSummary(finalized)
    log(summary)
    log(`bootsSpent=${String(lease.bootsSpent())} overall=${String(overallVerdict(finalized.cases))} failure=${failure === null ? 'none' : redact(String(failure.message)).slice(0, 400)}`)
    writeMockTranscript(world ?? {}, 'final')
  }
  if (failure !== null) process.exitCode = 1
}

if (PLAN_ONLY) {
  await planOnly()
} else {
  rmSync(RUN_LOG, { force: true })
  await boot()
}
