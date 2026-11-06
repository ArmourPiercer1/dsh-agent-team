#!/usr/bin/env node
/**
 * run-boot.mjs — the LIVE half of the PD-12 fix (DEV-LIVE; development evidence).
 *
 * DERIVED FROM `evidence/a5sf-pd13/driver/run-boot.mjs` (the accepted
 * Subprocess dev-live procedure: same WorldFactory, same a5sf harness, same
 * ledger/lease/slot discipline, same LOCUS style). The two `bash`-path cases
 * carry the SAME ids and the SAME single Host start, but their propositions are
 * the PD-12 fix's: the Member's model-visible `bash` must be served by the
 * CONFINED subprocess face, and the `network: deny` lane must refuse it at
 * admission with zero processes.
 *
 * The original lane's Q1/Q5 verdicts were the DEFECT; this driver measures the
 * same facts after the fix, so the flip is a property of the product path (the
 * realm row now shadows `bash` via route C), not of a rewritten fixture.
 *
 * WHAT THIS MEASURES (one Host start, one team, two Members):
 *
 *   Q1  Which executor a Member's model-visible `bash` actually reaches. The
 *       Member's preset is the SHIPPED `standard`-shaped one
 *       (`@deepseek-ai/dsh-tool-bash` + `@deepseek-ai/dsh-tool-fs`). The
 *       transcript, the `ctx.shell` counter and the base-`subprocess` counter
 *       decide it; the confined face's provider counter is the discriminator.
 *   Q2  The confined face's argv predicate, live: the fixture probe module
 *       drives `/bin/bash -c <body>` (admitted), `bash -c <body>` (the shipped
 *       executor's bare-name shape), `-lc`, an empty body and an extra operand.
 *       Each answer is a typed code plus a provider-call delta.
 *   Q3  Where a `network: deny` lane refuses: the deny Member's probe call must
 *       be refused BEFORE the provider (counter 0) and BEFORE any child
 *       (independent /proc observation 0, marker file absent).
 *   Q4  The positive control: the SAME Host's allow Member really runs a child
 *       with the same argv body shape (stdout marker + /proc sighting), and the
 *       Member's own `bash` really runs one too. So the deny result is not
 *       "nothing ran anywhere".
 *   Q5  What a Member can actually do with `bash` today — recorded, not graded:
 *       the model-visible surface, the executor class, the argv it produced and
 *       whether the Member's a5sf lane was consulted at all.
 *
 * MODES
 *   node run-boot.mjs --plan     host-free: rows, blueprint text, wiring, dist
 *                                face presence. No World, no gate, no ledger row.
 *   node run-boot.mjs            boot once, measure, judge, tear down.
 *
 * WHAT IS FIXTURE (disclosed in the README, not hidden here)
 *   - the Member lane inputs (read/write roots, the network axis) and the
 *     confined `subprocess` face are supplied by the EVIDENCE provider row
 *     (`a5sf-pd13-realm-row.mjs`);
 *   - the `sub_probe` tool and its argv table are a FIXTURE module mounted
 *     through the product's `mountNativeToolModules` seam;
 *   - the model is a scripted mock; the counters and the /proc watcher are test
 *     instrumentation.
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  appendFileSync, existsSync, mkdirSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  apiPrompt,
  authenticate,
  emitPatchLayer,
  fetchJson,
  tcpConnectProbe,
} from '../../../../../tests/world-factory/lib/world-factory.mjs'
import {
  createRunRecord, formatSummary, readAuthorityBinding,
} from '../../../../../tests/world-factory/lib/run-record.mjs'
import { TEST_USE_BASELINE_SHA } from '../../../../../tests/paths.mjs'
import { createA5sfHarness } from '../../../../../tests/world-factory/lib/a5sf-harness.mjs'
import { preRegisterDevLiveBudget, resolveHeadCommit } from '../../../../../tests/world-factory/suites/150-a5sf-read.mjs'
import {
  lastUserTextOfStatic, messagesOf, remoteCall, surfaceNamesOf, textOf,
} from '../../../../../tests/world-factory/lib/u6-fs-assembly.mjs'
import { personaRow, presetDeclarationRow } from '../../../../../tests/kits/_shared/preset-seam.mjs'
import {
  P2_01_ACCEPTANCE_ROOTS, assertAcceptanceRootWiring, runZeroBootPreflight,
} from '../../../../../tests/world-factory/lib/a5sf-acceptance-preflight.mjs'
import { buildPreflightBundle, PREFLIGHT_BUNDLE_NAME } from './preflight-bundle.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..', '..')

/**
 * The host tree: the task worktree's own pristine checkout when present, else
 * the main checkout's. The worktree carries a SYMLINK to the shared read-only
 * checkout (TEST_METHODS §7); nothing under it is written.
 */
function hostTreePath() {
  const local = join(REPO_ROOT, 'tests', 'deepseek-harness-test-use')
  if (existsSync(local)) return local
  return resolve(REPO_ROOT, '..', '..', 'tests', 'deepseek-harness-test-use')
}
const HOST_TREE = hostTreePath()
const HOST_TOOL_BASH_LOCAL = join(HOST_TREE, 'packages', 'shell', 'bash-local', 'lib', 'index.js')

const LINE = 'u5a5sfsub1'
const EVIDENCE_ROW = join(HERE, 'a5sf-pd13-realm-row.mjs')
const PROBE_MODULE = join(HERE, 'sub-probe-module.mjs')
const PROBE_STUB = join(HERE, 'sub-probe-stub.mjs')
const RUN_LOG = join(HERE, 'run.log')
const GRANT_PATH = join(HERE, 'grant.json')
const LEDGER_PATH = join(HERE, 'run-ledger.jsonl')
const COUNTER_NAME = 'sub-counter.jsonl'
const LANE_REPORT_NAME = 'lane-report'
const FACTS_NAME = 'guard-facts.json'
const PROBE_REPORT_NAME = 'probe-report.json'

const ROOTS = P2_01_ACCEPTANCE_ROOTS
const BOOT_ROOT = ROOTS.bootRoot
const ACCEPTANCE_ROOT = ROOTS.teamRoot

const BP_ANCHOR_ID = 'team.a5sf.sub.anchor'
const BP_MAIN_ID = 'team.a5sf.sub.main'
const PRESET_ID = 'a5sf-pd13-base'
const PROBE_TOOL = 'sub_probe'

const MK_DISC = 'A5SF_SUB_DISC'
const MK_L1 = 'A5SF_SUB_L1_DRIVE'
const TOK_D1 = 'a5sfsub-d1'
const TOK_D2 = 'a5sfsub-d2'
const MEMBER_ENVELOPE = '[team-work requestToken='
const DONE_D1 = 'A5SF_SUB_D1_DONE'
const DONE_D2 = 'A5SF_SUB_D2_DONE'
const DONE_L1 = 'A5SF_SUB_L1_DONE'

/** The Member preset's TOOLS. `tool-bash` is the shipped transient bash consumer
 *  (`inject: ['tools','shell','systemPrompt','shellEnv']`), the same row the
 *  upstream `standard` preset carries; `tool-fs` keeps the population shape
 *  realistic. No `persistentShellGroup` and no `tool-fs-search`: this lane
 *  measures ONE executor question, not the preset catalog. */
const PRESET_TOOLS = Object.freeze(['bash', 'read', 'write', 'edit', 'read_image', 'sub_probe'])
const TEAM_TOOL_NAMES = Object.freeze(['team_delegate', 'team_archive_member', 'team_follow_up', 'team_collect', 'team_list_members'])
const LEADER_DENY_SAFE = Object.freeze(['todo_write'])
/** What the LEADER is allowed to keep after `builtinToolDeny`: the shipped
 *  managed tools the preset exposes. Everything else on its discovered surface
 *  (the fixture `sub_probe`, the harness `u5_canary`/`u6fs_probe` rows) is
 *  denied, because A2C-2 refuses an unmanaged name on the leader. */
const LEADER_TOOL_ALLOW = Object.freeze(['bash', 'read', 'write', 'edit', 'read_image'])

/**
 * THE PREFLIGHT-TABLED CASES. `const CASES` is machine-read by
 * `parseDriverCaseManifest` and must equal what `preflight-bundle.mjs` tables,
 * so the network denial is NOT here (see the bundle header: the closed network
 * case class is web-caller-shaped). It is still a SELECTED case of the run
 * record — `SELECTED_CASES` — so a refuted denial turns the run red.
 */
const CASES = Object.freeze([
  'sub:product-bash-executor',
  'sub:face-admitted',
  'pd13:shell-read-denied',
  'pd13:shell-read-admitted',
])
const SELECTED_CASES = Object.freeze([
  'sub:product-bash-executor',
  'sub:face-admitted',
  'pd13:shell-read-denied',
  'pd13:shell-read-admitted',
  'sub:network-deny',
  // The end-state table's surprising row: the deny lane is a fact about the
  // CONFINED face. Does it also govern the Member's model-visible `bash`?
  'sub:network-deny-bash-lane',
])
const DENY_CASE = 'sub:network-deny'
const DENY_BASH_CASE = 'sub:network-deny-bash-lane'
const ADMITTED_CASE = 'sub:face-admitted'
const EXECUTOR_CASE = 'sub:product-bash-executor'

const READ_DENIED_CASE = 'pd13:shell-read-denied'
const READ_ADMITTED_CASE = 'pd13:shell-read-admitted'

const CALL_IDS = Object.freeze({
  bash: 'call-a5sfsub-bash',
  bashDeniedRead: 'call-a5sfpd13-read-denied',
  bashInLaneRead: 'call-a5sfpd13-read-admitted',
  faceControl: 'call-a5sfsub-face-control',
  shippedArgv: 'call-a5sfsub-shipped-argv',
  argvLc: 'call-a5sfsub-argv-lc',
  argvEmpty: 'call-a5sfsub-argv-empty',
  argvExtra: 'call-a5sfsub-argv-extra',
  netDeny: 'call-a5sfsub-net-deny',
  denyBash: 'call-a5sfsub-deny-bash',
})

const PLAN_ONLY = process.argv.includes('--plan')
const GRANT_PATH_DEV_LIVE = join(HERE, '..', '..', 'dev-live-grant.json')

// ─────────────────────────────────────────────────────────────────────────────
// logging / small helpers
// ─────────────────────────────────────────────────────────────────────────────
const startedAt = new Date().toISOString()
function log(line) {
  const text = `[${new Date().toISOString()}] ${String(line)}`.replace(/[ \t]+$/u, '')
  // eslint-disable-next-line no-console
  console.log(text)
  try {
    appendFileSync(RUN_LOG, text + '\n')
  } catch {
    /* the console is still the live channel */
  }
}
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
const redact = (text) => String(text ?? '').replace(/\?token=[A-Za-z0-9_-]+/gu, '?token=<redacted>')
const parseJsonl = (path) => {
  try {
    return readFileSync(path, 'utf8').split('\n').filter((line) => line.trim() !== '').map((line) => JSON.parse(line))
  } catch { return [] }
}
const readJson = (path) => {
  try { return JSON.parse(readFileSync(path, 'utf8')) } catch { return null }
}
function readLedgerRows(path) { return parseJsonl(path) }

// ─────────────────────────────────────────────────────────────────────────────
// blueprints
// ─────────────────────────────────────────────────────────────────────────────
function mainBlueprintYaml(denyList) {
  const denyLines = denyList.length === 0 ? ['    builtinToolDeny: []'] : ['    builtinToolDeny:', ...denyList.map((n) => `      - ${n}`)]
  return [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
    'leader:', '  templateId: leader',
    `  persona: ${JSON.stringify(`You are the leader of the a5sf subprocess dev-live team. ${MK_L1} drives your chain: delegate the allow-lane worker once, then the deny-lane worker once, then finish.`)}`,
    '  capabilities:', '    teamTools:', '      kind: allow', '      items:',
    '        - team_delegate', '        - team_archive_member', '        - team_follow_up', '        - team_collect',
    ...denyLines,
    '    skills:', '      kind: allow', '      items: []',
    '    mcp:', '      kind: allow', '      items: []',
    '    permissions:', '      default: deny', '      allow: []', '      ask: []', '      deny: []',
    'teamEnvelope:', '  allow:', '    - create-member', '    - assign-task', '    - send-message', '    - report-progress', '    - archive-member', '  deny: []',
    'members:',
    // The allow-lane Member: NO capabilities block (the population shape). Its
    // ONLY confinement is the compiled Member realm + the confined subprocess face.
    '  - templateId: worker', '    displayName: "a5sf sub allow worker"',
    `    persona: ${JSON.stringify('You are the a5sf subprocess allow worker. Follow the delegated script exactly, one tool call at a time.')}`,
    // The deny-lane Member: same shape, a DIFFERENT template so the realm's
    // compiled network axis is deny for it and allow for the other.
    '  - templateId: worker-deny', '    displayName: "a5sf sub deny worker"',
    `    persona: ${JSON.stringify('You are the a5sf subprocess deny worker. Run the delegated script exactly once.')}`,
    'memberEnvelopes:',
    '  - templateId: worker', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
    '  - templateId: worker-deny', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
    'permissionMutationEnvelope:', '  rules: []', 'teamHardEnvelope:', '  rules: []',
    'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')
}

/** The ANCHOR team: one leader, one worker template, no capabilities, no realm
 *  member. It is the composition precondition, not a measured lane. */
const BP_ANCHOR_YAML = [
  '---', 'schemaVersion: 3', `blueprintId: ${BP_ANCHOR_ID}`, 'revision: "1"',
  'leader:', '  templateId: leader',
  `  persona: ${JSON.stringify(`You are the leader of the a5sf subprocess anchor team. ${MK_DISC} is the discovery marker.`)}`,
  'members:', '  - templateId: worker', '    persona: "You are the a5sf subprocess anchor worker."',
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
// world material
// ─────────────────────────────────────────────────────────────────────────────
const p6t6Directive = ({ worldId, logDir }) => ({ boot: 1, phase: 'create', reportDir: logDir, runStamp: worldId, rootSessionId: ACCEPTANCE_ROOT })

function assertDriverRootWiring() {
  return assertAcceptanceRootWiring(ROOTS, {
    productionRowRoot: teamRowConfig({ home: join(HERE, '.rowcheck') }).rootSessionId,
    directiveRoot: p6t6Directive({ worldId: 'rowcheck', logDir: '.rowcheck' }).rootSessionId,
  })
}

function teamRowConfig({ home }) {
  const dist = join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime')
  const glueUrl = pathToFileURL(join(dist, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href
  const seamUrl = pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href
  const probeUrl = pathToFileURL(PROBE_MODULE).href
  return {
    rootSessionId: BOOT_ROOT,
    bootPhase: 'create',
    blueprintSource: BP_ANCHOR_YAML,
    blueprintDir: join(home, 'blueprints'),
    rootPresetId: PRESET_ID,
    memberPresetId: PRESET_ID,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'a5sf-sub-model' },
    deniedSelection: null,
    mcpServers: [],
    mcpServer: null,
    environmentFacts: [
      { domain: 'tool', subject: 'web', available: true, generation: 1 },
      { domain: 'skill', subject: 'base', available: true, generation: 1 },
      { domain: 'persona', subject: 'standard', available: true, generation: 1 },
    ],
    externalPolicyFacts: { hard: {}, capabilityExists: {} },
    glueUrl,
    seamUrl,
    // route C enablement: the guard-fact sink + the ONE fixture native tool module
    a5sfEvidencePath: join(home, 'a5sf-consult.jsonl'),
    a5sfNativeToolModules: [{ url: probeUrl, config: { workspace: home } }],
    a5sfExpectedTools: { [probeUrl]: [PROBE_TOOL] },
    // NOTE: no `teamToolPlane` — the ONLY confinement in this World is the a5sf
    // member realm + its confined subprocess face. That is deliberate: Q1 asks
    // what the PRODUCT PATH does when no governed plane takes the name over.
  }
}

/** The probe module's CONFIG (per-Member fixture paths; the module builds the
 *  argv table itself). The realm row forwards the module config verbatim. */
function probeModuleConfig({ paths, claims }) {
  return {
    workspace: paths.workspace,
    allowTag: claims.allowTag,
    denyTag: claims.denyTag,
    // Two DISTINCT marker files: the allow control's witness and the deny
    // lane's would-be witness can never be confused with one another.
    allowMarker: paths.allowMarker,
    denyMarker: paths.denyMarker,
  }
}

function rowPathsOf({ home, workspaceDir }) {
  const workspace = realpathSync(workspaceDir)
  const lane = join(workspace, 'lane')
  return {
    workspace,
    lane,
    inLaneDir: lane,
    inLaneFile: join(lane, 'in-lane.txt'),
    pd13InLaneFile: join(lane, 'pd13-in-lane.txt'),
    denyMarker: join(lane, 'deny-marker.txt'),
    allowMarker: join(lane, 'allow-marker.txt'),
    outsideDir: join(home, 'ceiling-outside'),
    outsideFile: join(home, 'ceiling-outside', 'secret.txt'),
  }
}

function rowsFor({ home, workspaceDir }) {
  const dist = join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime')
  const PRODUCTION_ROW = pathToFileURL(join(dist, 'src', 'plugin', 'host.js')).href
  const P6T6_ROW = pathToFileURL(join(REPO_ROOT, 'packages', 'tools', 'harness', 'plugin.mjs')).href
  const providerRow = pathToFileURL(EVIDENCE_ROW).href
  const probeUrl = pathToFileURL(PROBE_MODULE).href
  const paths = rowPathsOf({ home, workspaceDir })
  const config = teamRowConfig({ home })
  // The probe module's config is authored AFTER the claims exist; `rowsFor` is
  // called once for the row-identity check (no claims) and once for the run.
  const probeConfig = probeModuleConfig({
    paths,
    claims: {
      allowTag: `A5SF_SUB_ALLOW_${String(home).slice(-12)}`,
      denyTag: `A5SF_SUB_DENY_${String(home).slice(-12)}`,
    },
  })
  config.a5sfNativeToolModules = [{ url: probeUrl, config: probeConfig, expectedTools: [PROBE_TOOL] }]
  return {
    paths,
    config,
    rows: [
      { id: 'a5sf-pd13-realm', name: providerRow, config: {
        allowRoot: paths.workspace,
        laneReportPath: join(home, LANE_REPORT_NAME),
        counterPath: join(home, COUNTER_NAME),
        scratchRoot: join(home, 'sub-scratch'),
        denyTemplateId: 'worker-deny',
      } },
      { id: 'dsh-agent-team', name: PRODUCTION_ROW, config },
      { id: 'p6t6-team-tools', name: P6T6_ROW },
      // THE DEPLOYMENT SANDBOX ROOT, pinned to THIS World's workspace through
      // the same insert-override the base bundle's `sandbox-policy` row accepts.
      // Without it `workspaceRoot: !!js process.cwd()` resolves to the PRISTINE
      // HOST TREE and a Member's `bash` child gets the host tree as its writable
      // bind. NOTE (measured 2026-11-06): writing `<home>/cordis.patch.yml` does
      // NOT do this — the profile patch the host reads is
      // `<home>/profiles/web/cordis.patch.yml`, which the World itself rewrites
      // from `rows` immediately before the spawn. An override row is the only
      // handover that survives.
      presetDeclarationRow({
        id: PRESET_ID,
        displayName: 'a5sf subprocess dev-live base',
        description: `a5sf subprocess dev-live boot preset (${LINE}) = the shipped standard preset's tool-bash + tool-fs`,
        plugins: [
          personaRow({ text: 'You are a coding agent powered by the {{model}} model.', suffix: 'Your working directory is {{cwd}}.' }),
          { id: 'tool-fs', name: '@deepseek-ai/dsh-tool-fs' },
          { id: 'tool-bash', name: '@deepseek-ai/dsh-tool-bash', config: { timeoutMs: 60_000 } },
          // The NAME `sub_probe` is declared here so the route-C native module
          // can SHADOW it (the product refuses a module that ADDS a name).
          { id: 'sub-probe-stub', name: pathToFileURL(PROBE_STUB).href },
        ],
      }),
    ],
  }
}

function rowIdentityCheck(rows) {
  const byPackage = new Map()
  const checked = []
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
        try {
          pkg = JSON.parse(readFileSync(candidate, 'utf8'))
          pkgPath = candidate
        } catch {
          return { ok: false, reason: 'ROW_PACKAGE_UNREADABLE', detail: candidate }
        }
        break
      }
      const parent = dirname(dir)
      if (parent === dir) break
      dir = parent
    }
    checked.push({ rowId: String(row.id), modulePath, packageName: pkg?.name ?? null, hasClientHalf: pkg?.dsh?.client !== undefined })
  }
  return { ok: true, rows: checked }
}

/**
 * The deployment sandbox's resolved root for a Member session, as MEASURED.
 *
 * Two fixture attempts were spent on this and both are recorded because the
 * result is a live product fact, not a fixture preference:
 *   - `<home>/cordis.patch.yml` is not a file the host reads (the live profile
 *     patch is `<home>/profiles/web/cordis.patch.yml`, which the World rewrites
 *     from `rows` immediately before the spawn) — writing it changed nothing;
 *   - a `sandbox-policy` insert-override row DOES compose, but the resolver is
 *     `resolveWorkspaceRoot(session?.header.cwd ?? this.workspaceRoot)`
 *     (`packages/sandbox/sandbox-policy/src/index.ts:168`): a SESSION cwd wins
 *     over the config, and the World gives the Team a session cwd of the
 *     PRISTINE HOST TREE. So the config fallback is never consulted here.
 *
 * The consequence is stated in the README: a Member's `bash` child is fenced
 * `workspace-write` on the HOST TREE, not on its World workspace.
 */
function deploymentSandboxObservation({ shellExec, expectedWorkspaceRoot }) {
  const policy = shellExec[0]?.sandboxPolicy ?? null
  return {
    resolved: policy,
    expectedWorkspaceRoot,
    precedence: 'session.header.cwd ?? config.workspaceRoot',
    source: 'tests/deepseek-harness-test-use/packages/sandbox/sandbox-policy/src/index.ts:168',
    note: 'the Member session cwd (the pristine host tree) wins over the deployment config; the World workspace is NOT the sandbox root in this composition',
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// the scripted model
// ─────────────────────────────────────────────────────────────────────────────
function countAssistantToolUses(req, name) {
  let n = 0
  for (const message of messagesOf(req)) {
    if (message?.role !== 'assistant' || !Array.isArray(message?.content)) continue
    for (const block of message.content) {
      if (block?.type === 'tool_use' && (name === undefined || block?.name === name)) n += 1
    }
  }
  return n
}
function resultIdsOf(req) {
  const ids = new Set()
  for (const message of messagesOf(req)) {
    if (!Array.isArray(message?.content)) continue
    for (const block of message.content) {
      if (block?.type === 'tool_result' && block?.tool_use_id !== undefined) ids.add(String(block.tool_use_id))
    }
  }
  return ids
}
function userTextOf(req) {
  return messagesOf(req).filter((m) => m?.role === 'user')
    .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? ''))).join('\n')
}
function lastToolResultText(req) {
  const messages = messagesOf(req)
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const blocks = Array.isArray(messages[i]?.content) ? messages[i].content : []
    const results = blocks.filter((b) => b?.type === 'tool_result')
    if (results.length > 0) {
      return results.map((b) => (Array.isArray(b.content) ? b.content : []).map((c) => c?.text ?? '').join('')).join('\n')
    }
  }
  return ''
}

/** The tool_use block the model issued, from the recorded provider transcript. */
function toolCallFor(requests, callId) {
  for (const req of requests) {
    for (const message of messagesOf(req)) {
      if (message?.role !== 'assistant' || !Array.isArray(message?.content)) continue
      for (const block of message.content) {
        if (block?.type === 'tool_use' && String(block?.id) === String(callId)) {
          return { id: String(block.id), name: block.name, arguments: block.input ?? block.arguments ?? {} }
        }
      }
    }
  }
  return null
}

/** The tool RESULT for a call id (the harness records it as a `tool_result`
 *  block on the next provider request). */
function toolResultFor(requests, callId) {
  for (const req of requests) {
    for (const message of messagesOf(req)) {
      for (const block of Array.isArray(message?.content) ? message.content : []) {
        const id = block?.type === 'tool_result' ? (block?.tool_use_id ?? block?.call_use_id ?? null) : (message?.role === 'tool' ? message?.tool_call_id : null)
        if (id !== String(callId)) continue
        const text = block?.type === 'tool_result'
          ? (Array.isArray(block.content) ? block.content.map((c) => c?.text ?? '').join('') : typeof block.content === 'string' ? block.content : '')
          : String(message?.content ?? '')
        const isError = block?.type === 'tool_result' ? block?.is_error === true : message?.is_error === true
        return { source: 'model', isError: isError === true, text }
      }
    }
  }
  return null
}

/**
 * MAP the face-contract verdict onto the run-record vocabulary. A face
 * proposition is PROVEN or REFUTED; the run record speaks PASS/FAIL (its
 * closed set). Nothing else is invented: an unmeasured proposition never
 * becomes PASS.
 */
function toRunVerdict(verdict) {
  if (verdict === 'PROVEN') return 'PASS'
  return 'FAIL'
}

/**
 * The scripted model.
 *
 * LEADER:  discovery turn -> surface read; `MK_L1` -> delegate D1, then delegate
 *          D2, then DONE.
 * WORKER (allow):  model `bash` FIRST (Q1), then the probe vectors in a fixed
 *          order; every step is sequenced by TOOL RESULTS (the harness does not
 *          echo the assistant tool_use block).
 * WORKER-DENY:  one probe vector (`net_deny`), then DONE.
 */
function makeDecide({ paths, claims }) {
  const probe = (id, vector) => ({ kind: 'tool-call', toolCalls: [{ id, name: PROBE_TOOL, arguments: { vector } }] })
  return function decide({ req }) {
    const allText = messagesOf(req).map(textOf).join('\n')
    const lastUser = lastUserTextOfStatic(req)
    const userText = userTextOf(req)
    if (allText.includes('Generate the session title')) return { kind: 'text', content: 'a5sf subprocess session' }

    // ── MEMBER LANE (allow) ────────────────────────────────────────────────
    if (userText.includes(`${MEMBER_ENVELOPE}${TOK_D1}`)) {
      const seen = resultIdsOf(req)
      if (!seen.has(CALL_IDS.bash)) {
        return { kind: 'tool-call', toolCalls: [{ id: CALL_IDS.bash, name: 'bash', arguments: {
          command: `printf '${claims.bashTag}\\n'; sleep 1.5`,
          description: 'Print the lane marker and sleep briefly',
          workdir: paths.workspace,
          timeoutMs: 30_000,
        } }] }
      }
      // PD-13: the Member's own shell reads a file the compiled READ lane
      // denies (the World's `outside` directory). The fix's proposition: the
      // confined terminal face refuses it BEFORE the confined process face is
      // asked to spawn — typed IO_READ_DENIED, zero bytes, one guard fact.
      if (!seen.has(CALL_IDS.bashDeniedRead)) {
        return { kind: 'tool-call', toolCalls: [{ id: CALL_IDS.bashDeniedRead, name: 'bash', arguments: {
          command: `cat '${paths.outsideFile}'`,
          description: 'Read the file outside the compiled read lane',
          workdir: paths.workspace,
          timeoutMs: 30_000,
        } }] }
      }
      // The POSITIVE CONTROL on the same path: an in-lane read is admitted and
      // served by the confined terminal face.
      if (!seen.has(CALL_IDS.bashInLaneRead)) {
        return { kind: 'tool-call', toolCalls: [{ id: CALL_IDS.bashInLaneRead, name: 'bash', arguments: {
          // The child REPORTS ITS OWN process facts: the host sandbox runs the
          // Member's process group in a private PID namespace, so the driver
          // cannot see the confined child from outside. `/proc/self/stat` read
          // INSIDE the child is the measurement: field 7 = tty_nr (0 = no
          // controlling terminal, i.e. not a PTY), field 5 = pgrp.
          // The child reports its own terminal + process-group facts with `tty`
          // and `ps` (which name NO path in the body). Reading
          // /proc/self/stat directly would itself be a read OUTSIDE the lane
          // and is refused by the read axis — measured in run-04, kept as the
          // reason this uses `tty`/`ps` instead.
          command: `cat '${paths.pd13InLaneFile}'; echo A5SF_PD13_PROC; tty || true; ps -o pid=,pgid=,tty=,stat= -p $$ || true`,
          description: 'Read the in-lane fixture through the Member shell and report the child\'s terminal/process facts',
          workdir: paths.workspace,
          timeoutMs: 30_000,
        } }] }
      }
      const chain = [
        [CALL_IDS.faceControl, 'face_control'],
        [CALL_IDS.shippedArgv, 'shipped_argv'],
        [CALL_IDS.argvLc, 'argv_lc'],
        [CALL_IDS.argvEmpty, 'argv_empty_body'],
        [CALL_IDS.argvExtra, 'argv_extra_operand'],
      ]
      for (const [id, vector] of chain) {
        if (!seen.has(id)) return probe(id, vector)
      }
      return { kind: 'text', content: `${DONE_D1} ${lastToolResultText(req).slice(0, 160)}` }
    }

    // ── MEMBER LANE (deny) ─────────────────────────────────────────────────
    if (userText.includes(`${MEMBER_ENVELOPE}${TOK_D2}`)) {
      const seen = resultIdsOf(req)
      if (!seen.has(CALL_IDS.netDeny)) return probe(CALL_IDS.netDeny, 'net_deny')
      // The SAME Member, on a lane whose declared network access is deny, now
      // uses the shipped `bash` tool. Nothing in the fixture's confined face is
      // involved: if the command runs, the lane's deny does not reach this path.
      if (!seen.has(CALL_IDS.denyBash)) {
        return { kind: 'tool-call', toolCalls: [{ id: CALL_IDS.denyBash, name: 'bash', arguments: {
          command: `printf '${claims.denyBashTag}\n'`,
          description: 'Print the deny-lane bash marker',
          workdir: paths.workspace,
          timeoutMs: 30_000,
        } }] }
      }
      return { kind: 'text', content: `${DONE_D2} ${lastToolResultText(req).slice(0, 160)}` }
    }

    if (lastUser.includes(MK_DISC)) {
      return { kind: 'text', content: 'A5SF_SUB_DISC_DONE' }
    }
    const isLeader = lastUser.includes(MK_L1) || allText.includes(MK_L1) || allText.includes('[team-work-settled')
    if (isLeader) {
      const seen = resultIdsOf(req)
      if (!seen.has('call-a5sfsub-delegate-d1')) {
        return {
          kind: 'tool-call',
          toolCalls: [{ id: 'call-a5sfsub-delegate-d1', name: 'team_delegate', arguments: {
            rootSessionId: ACCEPTANCE_ROOT,
            requestToken: `${TOK_D1}-delegate`,
            delegationTemplateId: 'worker',
            label: 'a5sfsub-worker',
            prompt: 'A5SF_SUB_WORK_ALLOW: run the delegated script exactly, one tool call at a time, then report.',
            async: false,
          } }],
        }
      }
      if (!seen.has('call-a5sfsub-delegate-d2')) {
        return {
          kind: 'tool-call',
          toolCalls: [{ id: 'call-a5sfsub-delegate-d2', name: 'team_delegate', arguments: {
            rootSessionId: ACCEPTANCE_ROOT,
            requestToken: `${TOK_D2}-delegate`,
            delegationTemplateId: 'worker-deny',
            label: 'a5sfsub-worker-deny',
            prompt: 'A5SF_SUB_WORK_DENY: run the delegated script exactly once, then report.',
            async: false,
          } }],
        }
      }
      return { kind: 'text', content: DONE_L1 }
    }
    return { kind: 'text', content: 'A5SF_SUB_DEVLIVE_NOOP' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// process observation (independent of our counters)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * Scan `/proc/<pid>/cmdline` for a marker. This is the ONE observation that
 * does not pass through our own instrumentation: if a child ran, its argv is
 * visible here; if the deny lane produced no process, nothing is.
 */
function scanProcForMarkers(markers) {
  const hits = []
  let pids = []
  try { pids = readdirSync('/proc').filter((name) => /^\d+$/u.test(name)) } catch { return hits }
  for (const pid of pids) {
    let cmdline = ''
    try { cmdline = readFileSync(`/proc/${pid}/cmdline`, 'utf8') } catch { continue }
    for (const [name, marker] of Object.entries(markers)) {
      if (cmdline.includes(marker)) {
        // PD-13 PROCESS-LEVEL FACTS (measured, not claimed): the child's
        // controlling terminal device (`tty_nr`), its process group, session
        // and state, read from /proc/<pid>/stat INDEPENDENTLY of our counters.
        // tty_nr 0 = no controlling terminal: the confined child is NOT on a
        // PTY. A zombie (`state Z`) would show up here too.
        const proc = { pgrp: null, session: null, ttyNr: null, state: null }
        try {
          const statText = readFileSync(`/proc/${pid}/stat`, 'utf8')
          const close = statText.lastIndexOf(')')
          const fields = statText.slice(close + 2).split(' ')
          proc.state = fields[0] ?? null
          proc.pgrp = Number(fields[2]) || null
          proc.session = Number(fields[3]) || null
          proc.ttyNr = Number(fields[4]) || 0
        } catch { /* the process may have exited between the two reads */ }
        hits.push({ marker: name, pid: Number(pid), pty: proc.ttyNr === 0 ? 'none' : `tty_nr:${String(proc.ttyNr)}`, pgrp: proc.pgrp, session: proc.session, state: proc.state, cmdline: cmdline.replaceAll('\0', ' ').slice(0, 400) })
      }
    }
  }
  return hits
}

// ─────────────────────────────────────────────────────────────────────────────
// local judges
// ─────────────────────────────────────────────────────────────────────────────
function verdictOf(proposition, clauses) {
  const failed = clauses.filter((c) => c.ok !== true).map((c) => `${c.id}: ${c.detail}`)
  return {
    verdict: failed.length === 0 ? 'PROVEN' : 'REFUTED',
    proposition,
    failed,
    clauses: clauses.map((c) => ({ id: c.id, ok: c.ok === true, detail: c.detail })),
  }
}

function judgeExecutorCase(sample) {
  const resultText = String(sample.result?.text ?? '')
  return verdictOf(
    "a Member's model-visible `bash` is served by the Member's CONFINED subprocess face (PD-12 fix): the confined provider is called once with this command, the inherited base executor and the shipped `ctx.shell` executor are never reached, and the allow lane admits the declared invocation",
    [
      { id: 'call-issued', ok: sample.call !== null, detail: 'the Member issued a `bash` tool call' },
      { id: 'call-settled-ok', ok: sample.result !== null && sample.result.isError !== true, detail: `tool result isError=${String(sample.result?.isError)}` },
      { id: 'marker-in-stdout', ok: resultText.includes(sample.bashTag), detail: `stdout carries ${JSON.stringify(sample.bashTag)}: ${JSON.stringify(resultText.slice(0, 200))}` },
      { id: 'confined-provider-called-once', ok: sample.confinedProviderCalls === 1, detail: `${String(sample.confinedProviderCalls)} confined provider call(s) carrying the bash marker` },
      { id: 'confined-spawn-recorded', ok: sample.confinedSpawns === 1, detail: `${String(sample.confinedSpawns)} confined-spawn record(s) carrying the bash marker` },
      { id: 'base-executor-not-reached', ok: sample.baseSpawnsWithMarker === 0, detail: `${String(sample.baseSpawnsWithMarker)} base-spawn record(s) carrying the bash marker` },
      { id: 'shell-executor-not-reached', ok: sample.shellExec.length === 0, detail: `${String(sample.shellExec.length)} shell-exec record(s) carrying the bash marker (the preset executor must never see it)` },
      { id: 'declared-argv-shape', ok: sample.argvIsDeclaredShape === true, detail: `request argv=${JSON.stringify(sample.requestArgv)} (closed shape: ['/bin/bash','-c',<body>])` },
      { id: 'network-profile-absent', ok: sample.networkProfiles.length === 1 && sample.networkProfiles[0] === null, detail: `request networkProfile=${JSON.stringify(sample.networkProfiles)} (the allow lane claims no network profile)` },
    ],
  )
}

function judgeAdmittedCase(sample) {
  const parsed = sample.parsed
  return verdictOf(
    'the confined face ADMITS the declared argv shape (`/bin/bash -c <non-empty>`) and a real child runs through the OS provider',
    [
      { id: 'probe-returned', ok: parsed !== null, detail: parsed === null ? `probe result is not JSON: ${JSON.stringify(String(sample.result?.text ?? '').slice(0, 200))}` : 'JSON' },
      { id: 'settled-ok', ok: parsed?.ok === true && parsed?.code === null, detail: `ok=${String(parsed?.ok)} code=${String(parsed?.code)} message=${String(parsed?.message).slice(0, 160)}` },
      { id: 'stdout-marker', ok: String(parsed?.stdout ?? '').includes(sample.allowTag), detail: `stdout=${JSON.stringify(String(parsed?.stdout ?? '').slice(0, 200))}` },
      { id: 'provider-called-once', ok: sample.providerCalls === 1, detail: `${String(sample.providerCalls)} provider call(s) for this argv` },
      { id: 'confined-spawn-once', ok: sample.confinedSpawns === 1, detail: `${String(sample.confinedSpawns)} confined-spawn record(s) for this argv` },
      { id: 'independent-marker-file', ok: sample.markerExists === true, detail: `the child-created marker file exists=${String(sample.markerExists)} (an OS fact, not our counter)` },
    ],
  )
}

function judgeDenyBashCase(sample) {
  const text = String(sample.result?.text ?? '')
  return verdictOf(
    'the PD-12 fix makes a `network: deny` lane GOVERN the Member\'s model-visible `bash`: the same command is refused at the confined face\'s network admission with the typed capability code, before the provider and before any process',
    [
      { id: 'call-issued', ok: sample.call !== null, detail: 'the deny-lane Member issued a `bash` tool call' },
      { id: 'call-settled-as-error', ok: sample.result !== null && sample.result.isError === true, detail: `tool result isError=${String(sample.result?.isError)}` },
      { id: 'typed-refusal-code', ok: sample.refusedByFace === 'NETWORK_UNCONFINED_REALM', detail: `the result carries ${String(sample.refusedByFace)}` },
      { id: 'refusal-names-capability', ok: /network-destination/u.test(text), detail: `the refusal names the probed dimension: ${JSON.stringify(text.slice(0, 260))}` },
      { id: 'body-never-ran', ok: !text.includes(sample.bashTag), detail: `stdout carries ${JSON.stringify(sample.bashTag)}: ${String(text.includes(sample.bashTag))}` },
      { id: 'zero-confined-provider-calls', ok: sample.confinedProviderCalls === 0, detail: `${String(sample.confinedProviderCalls)} confined provider call(s) carrying the deny-lane bash marker` },
      { id: 'zero-base-spawns', ok: sample.baseSpawnsWithMarker === 0, detail: `${String(sample.baseSpawnsWithMarker)} base-spawn record(s) carrying the deny-lane bash marker` },
      { id: 'zero-shell-execs', ok: sample.shellExec.length === 0, detail: `${String(sample.shellExec.length)} shell-exec record(s) carrying the deny-lane bash marker (the preset executor must never see it)` },
      { id: 'zero-proc-sightings', ok: sample.procSightings === 0, detail: `${String(sample.procSightings)} independent /proc sighting(s) of the deny-lane bash marker` },
      { id: 'refusal-is-admission-not-os-denial', ok: sample.claimsConfinement === false, detail: 'the refusal is our admission code (the provider probe reports network-destination unsupported); no OS-level network isolation is claimed' },
    ],
  )
}

function judgeDenyCase(sample) {
  const parsed = sample.parsed
  return verdictOf(
    'a `network: deny` lane REFUSES the call at admission, before the provider and before any process exists',
    [
      { id: 'probe-returned', ok: parsed !== null, detail: parsed === null ? 'probe result is not JSON' : 'JSON' },
      { id: 'typed-code', ok: parsed?.code === 'NETWORK_UNCONFINED_REALM', detail: `code=${String(parsed?.code)} message=${String(parsed?.message).slice(0, 220)}` },
      { id: 'zero-provider-calls', ok: sample.providerCalls === 0, detail: `${String(sample.providerCalls)} provider call(s) with this argv` },
      { id: 'zero-base-fallback', ok: sample.baseSpawns === 0, detail: `${String(sample.baseSpawns)} base-spawn record(s) carrying the body` },
      { id: 'zero-proc-sightings', ok: sample.procSightings === 0, detail: `${String(sample.procSightings)} /proc sighting(s) of the deny marker` },
      { id: 'no-marker-file', ok: sample.markerExists === false, detail: `marker file exists=${String(sample.markerExists)}` },
      { id: 'no-guard-fact', ok: sample.facts.length === 0, detail: `guard facts with decidedBy=NETWORK_UNCONFINED_REALM: ${String(sample.facts.length)}. The refusal is thrown directly by the face's network admission (subprocess.ts, after provider.probe()), so NO guard consult happens — unlike the argv refusals, which write one IO_READ_DENIED fact. Recorded as an asymmetry, not a defect.` },
      { id: 'provider-capability-refusal', ok: sample.capability?.level === 'unsupported' && String(sample.capability?.dimension ?? '') === 'network-destination', detail: `the provider's own capability row: ${JSON.stringify(sample.capability).slice(0, 400)}` },
      { id: 'no-confinement-claim', ok: sample.claimsConfinement === false, detail: 'the refusal is a statement about our own admission code, not about isolation' },
    ],
  )
}

/**
 * PD-13 — THE READ AXIS. A Member's model-visible `bash` reads a file the
 * compiled read lane denies. The face must refuse at admission: typed
 * IO_READ_DENIED, ZERO bytes of the file, exactly ONE `shellRead` guard fact
 * naming the locator, and ZERO confined provider calls (the body never ran).
 */
function judgeShellReadDenied(sample) {
  const text = String(sample.result?.text ?? '')
  const secretRead = text.includes(sample.secretMarker)
  const fact = sample.readFacts.find((f) => f?.locator === sample.locator) ?? null
  return verdictOf(
    "PD-13: a Member's own `bash` read of a path the compiled read lane denies is refused at admission — typed IO_READ_DENIED, zero bytes, one shellRead fact, zero provider calls",
    [
      { id: 'call-issued', ok: sample.call !== null, detail: 'the Member issued a `bash` tool call' },
      { id: 'call-settled-as-error', ok: sample.result !== null && sample.result.isError === true, detail: `tool result isError=${String(sample.result?.isError)}` },
      { id: 'typed-read-denial', ok: text.includes('IO_READ_DENIED'), detail: `the result names the typed read denial: ${JSON.stringify(text.slice(0, 300))}` },
      { id: 'zero-secret-bytes', ok: !secretRead, detail: `the file's bytes appear in the result: ${String(secretRead)} (a correct verdict with bytes present would be a false pass)` },
      { id: 'zero-confined-provider-calls', ok: sample.confinedProviderCalls === 0, detail: `${String(sample.confinedProviderCalls)} confined provider call(s) carrying the denied body — the body never ran` },
      { id: 'zero-base-spawns', ok: sample.baseSpawns === 0, detail: `${String(sample.baseSpawns)} base-spawn record(s) carrying the denied body` },
      { id: 'zero-shell-execs', ok: sample.shellExec === 0, detail: `${String(sample.shellExec)} shell-exec record(s) carrying the denied body (the preset executor must never see it)` },
      { id: 'zero-proc-sightings', ok: sample.procSightings === 0, detail: `${String(sample.procSightings)} independent /proc sighting(s) of the denied body` },
      { id: 'one-read-fact', ok: sample.readFacts.filter((f) => f?.locator === sample.locator).length === 1, detail: `shellRead facts for the locator: ${String(sample.readFacts.filter((f) => f?.locator === sample.locator).length)}` },
      { id: 'fact-is-a-deny-on-the-read-lane', ok: fact?.decision === 'deny' && fact?.decidedBy === 'IO_READ_DENIED' && fact?.method === 'shellRead', detail: `fact=${JSON.stringify(fact).slice(0, 400)}` },
      { id: 'fact-names-the-member', ok: String(fact?.memberIdentity ?? '') !== '' && String(fact?.realm ?? '') === 'member', detail: `realm=${String(fact?.realm)} member=${String(fact?.memberIdentity)}` },
      { id: 'no-confinement-claim', ok: sample.claimsConfinement === false, detail: 'the denial is our admission decision on the read axis, not an OS-level isolation claim' },
    ],
  )
}

/** PD-13 — the POSITIVE CONTROL on the same path: an in-lane read is admitted
 *  and served by the confined terminal face (bytes present, one provider call,
 *  one ALLOW read fact). Without this the denial could be "nothing runs". */
function judgeShellReadAdmitted(sample) {
  const text = String(sample.result?.text ?? '')
  let payload = null
  try { payload = JSON.parse(text) } catch { payload = null }
  return verdictOf(
    'PD-13 positive control: an in-lane shell read is admitted by the confined terminal face, served by the confined process face, and produces one ALLOW shellRead fact',
    [
      { id: 'call-issued', ok: sample.call !== null, detail: 'the Member issued the in-lane `bash` tool call' },
      { id: 'call-settled-ok', ok: sample.result !== null && sample.result.isError !== true, detail: `tool result isError=${String(sample.result?.isError)}` },
      { id: 'served-by-the-confined-terminal-face', ok: payload?.kind === 'confined-terminal', detail: `kind=${String(payload?.kind)} (the face that served the call)` },
      { id: 'exit-zero', ok: payload?.exitCode === 0, detail: `exitCode=${String(payload?.exitCode)}` },
      { id: 'lane-bytes-present', ok: String(payload?.stdout ?? '').includes(sample.allowTag), detail: `stdout=${JSON.stringify(String(payload?.stdout ?? '').slice(0, 200))}` },
      { id: 'one-confined-provider-call', ok: sample.confinedProviderCalls === 1, detail: `${String(sample.confinedProviderCalls)} confined provider call(s) carrying the in-lane body` },
      { id: 'one-confined-spawn', ok: sample.confinedSpawns === 1, detail: `${String(sample.confinedSpawns)} confined-spawn record(s) carrying the in-lane body` },
      { id: 'one-allow-read-fact', ok: sample.readFacts.filter((f) => f?.locator === sample.locator && f?.decision === 'allow').length === 1, detail: `ALLOW shellRead facts for the locator: ${String(sample.readFacts.filter((f) => f?.locator === sample.locator && f?.decision === 'allow').length)}` },
      { id: 'child-not-on-a-pty', ok: sample.ttyOfChild === 'none', detail: `the confined child's own \`tty\` answer: ${JSON.stringify(String(sample.ttyOfChild))} ("none" = no controlling terminal, i.e. not a PTY); its \`ps\` row: ${JSON.stringify(sample.childStat)}` },
      { id: 'no-zombie-left', ok: sample.zombieSightings === 0, detail: `${String(sample.zombieSightings)} /proc sighting(s) of the in-lane child in state Z` },
    ],
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// plan (host-free)
// ─────────────────────────────────────────────────────────────────────────────
async function planOnly() {
  log(`PLAN: repo=${REPO_ROOT} hostTree=${HOST_TREE} pin=${TEST_USE_BASELINE_SHA}`)
  assertDriverRootWiring()
  const dry = rowsFor({ home: join(HERE, '.rowcheck'), workspaceDir: HERE })
  const identity = rowIdentityCheck(dry.rows)
  log(`row identity: ${JSON.stringify(identity).slice(0, 1200)}`)
  if (identity.ok !== true) throw new Error(`row composition refused: ${identity.reason}: ${identity.detail}`)
  const patch = emitPatchLayer(['a5sf subprocess dev-live row layer (--plan, no World)'], dry.rows)
  writeFileSync(join(HERE, 'plan-patch.yml'), patch)
  writeFileSync(join(HERE, 'plan-rows.json'), JSON.stringify({
    schema: 'a5sf-pd13/plan-rows/1',
    at: new Date().toISOString(),
    rowIds: dry.rows.map((row) => row.id),
    nativeModules: dry.config.a5sfNativeToolModules,
    expectedTools: dry.config.a5sfExpectedTools,
    leaderSurface: [...PRESET_TOOLS, 'todo_write', ...TEAM_TOOL_NAMES],
  }, null, 2) + '\n')
  assertBlueprintText(BP_ANCHOR_YAML, BP_ANCHOR_ID, 1, 'anchor.yaml')
  assertBlueprintText(mainBlueprintYaml([]), BP_MAIN_ID, 2, 'main.yaml')
  log('plan: both blueprints are accepted by the dist blueprint validator')
  if (!existsSync(HOST_TOOL_BASH_LOCAL)) throw new Error(`the pinned shell executor entry is missing: ${HOST_TOOL_BASH_LOCAL}`)
  log(`plan: pinned bash-local entry present (${HOST_TOOL_BASH_LOCAL})`)
  const toolBash = readFileSync(join(HOST_TREE, 'packages', 'shell', 'tool-bash', 'lib', 'index.js'), 'utf8')
  log(`plan: pinned tool-bash consumer present (inject=${/inject\s*=\s*\[([^\]]*)\]/u.exec(toolBash)?.[1] ?? '?'})`)
  log('PLAN OK')
}

// ─────────────────────────────────────────────────────────────────────────────
// boot
// ─────────────────────────────────────────────────────────────────────────────
async function boot() {
  assertDriverRootWiring()
  const head = resolveHeadCommit(REPO_ROOT)
  if (head === null) throw new Error('git rev-parse HEAD failed: the start cannot be bound')
  log(`BOOT: repo=${REPO_ROOT} hostTree=${HOST_TREE} pin=${TEST_USE_BASELINE_SHA} head=${head} startedAt=${startedAt}`)
  log(`git status porcelain (recorded, must be empty for the product tree): ${JSON.stringify(readPorcelain())}`)
  if (!existsSync(HOST_TOOL_BASH_LOCAL)) throw new Error(`the pinned shell executor entry is missing: ${HOST_TOOL_BASH_LOCAL}`)

  const dry = rowsFor({ home: join(HERE, '.rowcheck'), workspaceDir: HERE })
  const identity = rowIdentityCheck(dry.rows)
  log(`pre-boot row identity check: ${JSON.stringify(identity).slice(0, 900)}`)
  if (identity.ok !== true) throw new Error(`row composition refused before any ledger row: ${identity.reason}: ${identity.detail}`)

  const priorRows = readLedgerRows(LEDGER_PATH)
  const priorBoots = priorRows.filter((row) => String(row?.phase ?? '').startsWith('a5sf-pd13-boot')).length
  const bootSequence = priorBoots + 1
  const BOOT_PHASE = `a5sf-pd13-boot${String(bootSequence)}`
  const grant = devLiveGrant()
  writeFileSync(GRANT_PATH, JSON.stringify({
    ...grant,
    headAtThisStart: head,
    bootSequence,
    note: `dev-live start #${String(bootSequence)} of the Subprocess face at ${head}; the authorisation is reusable and uncapped, the executed commit is recorded here and in the ledger`,
  }, null, 2) + '\n')
  log(`dev-live authorisation: ${grant.path} grant=${grant.grantId} face=${grant.face} world=${grant.world} boot#${String(bootSequence)} head=${head}`)

  const runId = `a5sf-pd13-${new Date().toISOString().replace(/[:.]/gu, '-')}`
  const record = createRunRecord({
    runId,
    suite: 'a5sf-pd13',
    selectedCases: SELECTED_CASES,
    bindings: runBindings(head, grant),
    ledgerPath: LEDGER_PATH,
    recordClass: 'DEV-LIVE',
  })
  const harness = createA5sfHarness({
    repoRoot: REPO_ROOT, evidenceRoot: HERE, suite: 'a5sf-pd13', line: LINE,
    runRecord: record, hostTree: HOST_TREE,
  })
  const factory = harness.factory
  log(`candidate asserted: ${JSON.stringify(harness.assertCandidate())}`)

  const lease = await preRegisterDevLiveBudget({
    grantPath: GRANT_PATH_DEV_LIVE, headCommit: head, runRecord: record,
    face: 'Subprocess', world: LINE, leaseRoot: factory.leaseRoot, requiredBoots: 1,
  })
  log(`dev-live lease: grant=${lease.grant.grantId} intentRows=${lease.intentRows().length} rows=${String(priorRows.length)} head=${head}`)

  const add = (id, verdict, detail = {}) => {
    record.addCase(id, verdict, detail)
    log(`case ${id}: ${verdict} ${JSON.stringify(detail).slice(0, 700)}`)
  }

  let world = null
  let bootInfo = null
  let teardown = null
  let failure = null
  let hostReached = false
  let abortStage = 'pre-boot'
  const stageCtx = { paths: null, counterPath: null, sinkPath: null, laneReportPath: null, claims: null }
  let procWatcher = null
  const procLog = []
  /** The abort path writes the same channels as the success path; one
   *  implementation, assigned once the World exists. */
  let persistRunChannels = null

  try {
    world = await harness.createWorld({ line: LINE, u6Fs: { rows: [] } })
    const { rows, config, paths } = rowsFor({ home: world.home, workspaceDir: world.workspaceDir })
    const claims = {
      bashTag: `A5SF_SUB_BASH_${world.id}`,
      allowTag: `A5SF_SUB_ALLOW_${world.id}`,
      denyTag: `A5SF_SUB_DENY_${world.id}`,
      denyBashTag: `A5SF_SUB_DENYBASH_${world.id}`,
    }
    // the probe module's config must carry the run's real tags
    const probeConfig = probeModuleConfig({ paths, claims })
    config.a5sfNativeToolModules = [{ url: pathToFileURL(PROBE_MODULE).href, config: probeConfig, expectedTools: [PROBE_TOOL] }]
    stageCtx.claims = claims
    stageCtx.paths = paths
    world.u6Fs.rows.push(...rows)
    const sinkPath = join(world.home, 'a5sf-consult.jsonl')
    const counterPath = join(world.home, COUNTER_NAME)
    const laneReportPath = join(world.home, LANE_REPORT_NAME)
    stageCtx.sinkPath = sinkPath
    stageCtx.counterPath = counterPath
    stageCtx.laneReportPath = laneReportPath

    mkdirSync(paths.lane, { recursive: true })
    mkdirSync(paths.outsideDir, { recursive: true })
    writeFileSync(paths.inLaneFile, `${claims.allowTag} in-lane fixture\n`)
    writeFileSync(paths.pd13InLaneFile, `${claims.allowTag} pd13 in-lane fixture\n`)
    writeFileSync(paths.outsideFile, `A5SF_SUB_OUTSIDE_SECRET_${world.id}\n`)
    mkdirSync(config.blueprintDir, { recursive: true })
    writeFileSync(join(config.blueprintDir, 'anchor.yaml'), BP_ANCHOR_YAML)
    writeFileSync(join(config.blueprintDir, 'main.yaml'), mainBlueprintYaml([]))
    writeFileSync(join(world.home, 'p6t6-directive.json'), JSON.stringify(p6t6Directive({ worldId: world.id, logDir: world.logDir }), null, 2))
    assertBlueprintText(BP_ANCHOR_YAML, BP_ANCHOR_ID, 1, 'anchor.yaml')
    const fixtures = {
      schema: 'a5sf-pd13/fixtures/1',
      at: new Date().toISOString(),
      worldId: world.id,
      workspace: paths.workspace,
      lane: paths.lane,
      inLaneFile: paths.inLaneFile,
      denyMarker: paths.denyMarker,
      allowMarker: paths.allowMarker,
      outsideFile: paths.outsideFile,
      claims,
      sinkPath, counterPath, laneReportPath: laneReportPath + '.jsonl',
      probeConfig,
      deploymentSandbox: 'measured at the shell-exec record, see probe-report.json#executor.deploymentSandbox',
    }
    writeFileSync(join(HERE, 'fixtures.json'), JSON.stringify(fixtures, null, 2) + '\n')

    // ── the ZERO-BOOT PREFLIGHT (a PASS is a hygiene gate for every start) ──
    const preflightBundle = buildPreflightBundle({
      repoRoot: REPO_ROOT, head, bootSequence, priorRows: priorRows.length, paths, caseIds: CASES,
      fixtures: {
        [EXECUTOR_CASE]: { caseId: EXECUTOR_CASE, inputs: { locator: paths.workspace, tool: 'bash', memberTemplate: 'worker' } },
        [ADMITTED_CASE]: { caseId: ADMITTED_CASE, inputs: { locator: paths.inLaneFile, vector: 'face_control' } },
        [READ_DENIED_CASE]: { caseId: READ_DENIED_CASE, inputs: { locator: paths.outsideFile, tool: 'bash', command: `cat '${paths.outsideFile}'` } },
        [READ_ADMITTED_CASE]: { caseId: READ_ADMITTED_CASE, inputs: { locator: paths.pd13InLaneFile, tool: 'bash', command: `cat '${paths.pd13InLaneFile}'` } },
      },
      emittedRowIds: rows.map((row) => row.id),
      worldRowIds: world.u6Fs.rows.map((row) => row.id),
      leaderSurface: [...PRESET_TOOLS, 'todo_write', ...TEAM_TOOL_NAMES],
      nativeModules: [
        { name: 'a5sf-sub-probe (fixture)', inject: ['tools', 'subprocess'], requiredConfig: ['workspace', 'allowTag', 'denyTag', 'allowMarker', 'denyMarker'], config: probeConfig, requiredTools: [PROBE_TOOL] },
      ],
      grant,
      hostModules: [EVIDENCE_ROW, PROBE_MODULE, join(HERE, 'run-boot.mjs')],
    })
    writeFileSync(join(HERE, PREFLIGHT_BUNDLE_NAME), JSON.stringify(preflightBundle, null, 2) + '\n')
    const preflight = runZeroBootPreflight(preflightBundle, {
      fileExists: (declaredPath) => existsSync(String(declaredPath).startsWith('/') ? String(declaredPath) : join(REPO_ROOT, String(declaredPath))),
      readFile: (declaredPath) => readFileSync(join(REPO_ROOT, String(declaredPath)), 'utf8'),
    })
    writeFileSync(join(HERE, 'preflight.log'), JSON.stringify(preflight, null, 2) + '\n')
    log(`zero-boot preflight: ${preflight.summary}${preflight.findings.length === 0 ? '' : ` findings=${JSON.stringify(preflight.findings.map((f) => ({ code: f.code, detail: String(f.detail).slice(0, 240) })))}`}`)
    if (preflight.verdict !== 'PASS') {
      const refusal = new Error(`PREFLIGHT_${preflight.verdict}: ${preflight.summary}; no Host start is spent`)
      refusal.code = 'PREFLIGHT_REFUSED'
      throw refusal
    }

    // the independent process observation runs for the WHOLE drive
    procWatcher = setInterval(() => {
      try {
        const hits = scanProcForMarkers({ bash: claims.bashTag, allow: claims.allowTag, deny: claims.denyTag, denyBash: claims.denyBashTag, readDenied: paths.outsideFile, readOk: paths.inLaneFile })
        if (hits.length > 0) procLog.push({ at: new Date().toISOString(), hits })
      } catch { /* observation must never break the run */ }
    }, 40)

    await world.startMock({ decide: makeDecide({ paths, claims }) })
    log(`mock started on ${String(world.mock?.port)}`)

    bootInfo = await lease.boot(() => harness.boot({ world, phase: BOOT_PHASE, bootTimeoutMs: 300_000 }))
    hostReached = true
    abortStage = 'composition'
    const expectedRowIds = rows.map((row) => row.id)
    const composed = await waitForComposedProfile(world, expectedRowIds, 30_000)
    log(`composed profile: ${JSON.stringify({ path: composed.path, missing: composed.missingRowIds })}`)
    if (composed.path !== null && composed.missingRowIds.length > 0) {
      throw new Error(`COMPOSITION_ROWS_MISSING: ${JSON.stringify(composed.missingRowIds)} of ${JSON.stringify(expectedRowIds)}`)
    }
    log(`BOOTED port=${bootInfo.port} log=${bootInfo.logPath}`)
    record.record.boots = [{ phase: BOOT_PHASE, world: world.id, port: bootInfo.port, logPath: bootInfo.logPath }]
    const origin = `http://127.0.0.1:${bootInfo.port}`
    const hostAlive = () => world.instance?.child !== null && world.instance?.child !== undefined && world.instance?.child.exitCode === null
    const cookie = await authenticate(origin, world.token)
    log('authenticated (token never recorded)')
    const waitFor = async (predicate, timeoutMs, everyMs = 250) => {
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
    log(`p6t6 health=${String(healthOk)} hostAlive=${String(hostAlive())}`)
    if (!healthOk) throw new Error('the p6t6 harness route never answered: the World did not reach a usable Host')

    const persistChannels = (label) => {
      const out = {}
      for (const [name, source] of [['sub-counter.jsonl', counterPath], ['consultations.jsonl', sinkPath]]) {
        try {
          if (!existsSync(source)) { out[name] = 'absent'; continue }
          const bytes = readFileSync(source)
          writeFileSync(join(HERE, name), bytes)
          out[name] = `${String(bytes.length)} bytes`
        } catch (error) { out[name] = `copy failed: ${String(error?.message ?? error)}` }
      }
      try {
        writeFileSync(join(HERE, 'proc-observations.json'), JSON.stringify({ schema: 'a5sf-pd13/proc-observations/1', at: new Date().toISOString(), note: 'an independent /proc/<pid>/cmdline scan; a sighting is an OS-level fact, not our counter', sightings: procLog }, null, 2) + '\n')
        writeFileSync(join(HERE, 'mock-requests.json'), JSON.stringify({
          schema: 'a5sf-pd13/mock-requests/1', at: new Date().toISOString(),
          requests: (world.mock?.requests ?? []).map((r) => ({ seq: r.seq ?? null, path: r.path ?? null, reply: r.reply ?? null, tools: surfaceNamesOf(r), messages: messagesOf(r) })),
        }, null, 2) + '\n')
      } catch (error) {
        out.channels = `write failed: ${String(error?.message ?? error)}`
      }
      out.proc = `${String(procLog.length)} observation batch(es)`
      log(`run channels persisted (${label}): ${JSON.stringify(out)}`)
      return out
    }
    persistRunChannels = persistChannels

    // ── the discovery turn (surface read; no tool call) ────────────────────
    abortStage = 'discovery'
    const disc = await apiPrompt(origin, cookie, BOOT_ROOT, MK_DISC, 'a5sfsub')
    await waitFor(() => (world.mock?.requests ?? []).some((r) => r.reply?.kind === 'text' && String(r.reply.content ?? '').startsWith('A5SF_SUB_DISC_DONE')), 60_000)
    const discRequests = world.mock?.requests ?? []
    // The LAST request is not necessarily the discovery turn (a title/compaction
    // request can follow it, and carries no tools). Select the request whose
    // messages carry the discovery marker AND whose body actually declares tools;
    // if none does, print every request's shape so the composition failure is
    // attributable instead of a bare "surface has no bash".
    const discoveryCandidates = discRequests.filter((r) => messagesOf(r).some((m) => textOf(m).includes(MK_DISC)))
    const byMarker = discoveryCandidates.filter((r) => surfaceNamesOf(r).length > 0).at(-1) ?? null
    const byTools = discRequests.filter((r) => surfaceNamesOf(r).length > 0).at(-1) ?? null
    const discRequest = byMarker ?? byTools ?? null
    const surfaceBasis = byMarker !== null ? 'discovery-turn' : (byTools !== null ? 'last-tool-bearing-request' : 'none')
    log(`mock requests (${String(discRequests.length)}): ${JSON.stringify(discRequests.map((r) => ({ seq: r?.seq ?? null, path: r?.path ?? null, nMessages: messagesOf(r).length, nTools: surfaceNamesOf(r).length, replyKind: r?.reply?.kind ?? null }))).slice(0, 2000)}`)
    const leaderSurface = discRequest === null ? [] : [...new Set(surfaceNamesOf(discRequest))].sort()
    const denyList = leaderSurface.filter((name) => !String(name).startsWith('team_') && !LEADER_TOOL_ALLOW.includes(name) && !LEADER_DENY_SAFE.includes(name))
    log(`leader surface basis=${surfaceBasis} (${String(leaderSurface.length)}): ${leaderSurface.join(',')}`)
    writeFileSync(join(HERE, 'leader-surface.json'), JSON.stringify({ schema: 'a5sf-pd13/leader-surface/1', at: new Date().toISOString(), basis: surfaceBasis, tools: leaderSurface, requests: discRequests.length }, null, 2) + '\n')
    log(`leader builtinToolDeny: ${denyList.join(',')}`)
    if (!leaderSurface.includes('bash')) throw new Error(`the model-visible leader surface has no \`bash\` (${leaderSurface.join(',')}) — the preset row did not expose it, so the executor question cannot be measured (composition failure)`)
    const mainText = mainBlueprintYaml(denyList)
    assertBlueprintText(mainText, BP_MAIN_ID, 2, 'main.yaml')
    writeFileSync(join(config.blueprintDir, 'main.yaml'), mainText)

    // ── team.create: the leader's first turn delegates BOTH workers ────────
    abortStage = 'team-create'
    const created = await remoteCall(fetchJson, origin, cookie, 'team.create', {
      rootSessionId: ACCEPTANCE_ROOT, blueprintId: BP_MAIN_ID, initialWork: { prompt: MK_L1 },
    }, 'a5sfsub')
    const createOk = created.status === 200 && created.body?.result?.ok === true
    log(`team.create status=${String(created.status)} ok=${String(createOk)} ${redact(JSON.stringify(created.body ?? null)).slice(0, 500)}`)
    const teamDefaultWorkspace = (() => {
      const text = JSON.stringify(created.body ?? null)
      const m = /"defaultWorkspace":"([^"]+)"/.exec(text)
      return m === null ? null : m[1]
    })()
    log(`team defaultWorkspace=${String(teamDefaultWorkspace)}`)
    if (!createOk) throw new Error(`team.create failed: status=${String(created.status)} body=${redact(JSON.stringify(created.body ?? null)).slice(0, 400)}`)

    abortStage = 'team-state'
    const stateOk = await waitFor(async () => {
      const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
      return st.status === 200 && st.body?.rootSessionId === ACCEPTANCE_ROOT && st.body?.teamSession !== null
    }, 90_000)
    if (!stateOk) throw new Error(`the state query does not report the acceptance Team at ${ACCEPTANCE_ROOT}`)

    abortStage = 'member-install'
    const replySeen = (content) => (world.mock?.requests ?? []).some((r) => r.reply?.kind === 'text' && String(r.reply.content ?? '').startsWith(content))
    const chainOk = await waitFor(() => replySeen(DONE_L1), 300_000)
    await new Promise((r) => setTimeout(r, 1500))
    log(`leader chain closed (${DONE_L1})=${String(chainOk)}`)
    persistChannels('after drive')
    const stateFresh = await fetchJson(`${origin}/__p6t6/state`, undefined, 20_000).catch(() => null)
    const members = Array.isArray(stateFresh?.body?.members) ? stateFresh.body.members : []
    writeFileSync(join(HERE, 'team-state.json'), JSON.stringify({
      schema: 'a5sf-pd13/team-state/1', at: new Date().toISOString(),
      members: members.map((m) => ({ instanceId: m.instanceId, templateId: m.templateId, lifecycle: m.lifecycle, childSessionIdSet: String(m.childSessionId ?? '') !== '' })),
      laneReportExists: existsSync(laneReportPath + '.jsonl'),
      mockRequests: (world.mock?.requests ?? []).length,
    }, null, 2) + '\n')

    // ── evidence collection ────────────────────────────────────────────────
    abortStage = 'evidence-collection'
    const requests = world.mock?.requests ?? []
    const counterRows = parseJsonl(counterPath)
    const factsAll = parseJsonl(sinkPath).filter((f) => f?.schema === 'a5sf-guard-consult/1')
    writeFileSync(join(HERE, FACTS_NAME), JSON.stringify(factsAll, null, 2) + '\n')
    writeFileSync(join(HERE, 'sub-counter.jsonl'), counterRows.map((r) => JSON.stringify(r)).join('\n') + (counterRows.length === 0 ? '' : '\n'))
    writeFileSync(join(HERE, 'proc-observations.json'), JSON.stringify({ schema: 'a5sf-pd13/proc-observations/1', at: new Date().toISOString(), note: 'an independent /proc/<pid>/cmdline scan; a sighting is an OS-level fact, not our counter', sightings: procLog }, null, 2) + '\n')
    writeFileSync(join(HERE, 'mock-requests.json'), JSON.stringify({
      schema: 'a5sf-pd13/mock-requests/1', at: new Date().toISOString(),
      requests: requests.map((r) => ({ seq: r.seq ?? null, reply: r.reply ?? null, messages: messagesOf(r) })),
    }, null, 2) + '\n')
    const resultOf = (callId) => toolResultFor(requests, callId)
    const callOf = (callId) => toolCallFor(requests, callId)
    const procSightings = (marker) => procLog.filter((batch) => batch.hits.some((h) => h.marker === marker)).length
    const argvKey = (argv) => JSON.stringify(argv.map(String))
    const rowsForArgv = (argv) => counterRows.filter((row) => Array.isArray(row?.argv) && argvKey(row.argv) === argvKey(argv))
    const bodyKey = (text) => String(text ?? '')
    const baseSpawnsWith = (needle) => counterRows.filter((row) => row?.leg === 'base-spawn' && (row?.argv ?? []).some((a) => String(a).includes(needle)))
    const factsByCode = (code) => factsAll.filter((f) => f?.decidedBy === code)

    const probeVectors = {
      face_control: { argv: ['/bin/bash', '-c', `printf '${claims.allowTag}\\n'; touch '${paths.allowMarker}'; sleep 1.5`] },
      net_deny: { argv: ['/bin/bash', '-c', `printf '${claims.denyTag}\\n'; touch '${paths.denyMarker}'; sleep 1.5`] },
      shipped_argv: { argv: ['bash', '-c', "printf 'a5sf-sub-shipped\\n'"] },
      argv_lc: { argv: ['/bin/bash', '-lc', 'true'] },
      argv_empty_body: { argv: ['/bin/bash', '-c', '   '] },
      argv_extra_operand: { argv: ['/bin/bash', '-c', 'true', 'extra'] },
    }
    const probeOf = (callId, vector) => {
      const result = resultOf(callId)
      let parsed = null
      try { parsed = JSON.parse(String(result?.text ?? '')) } catch { parsed = null }
      const argv = probeVectors[vector].argv
      const closed = rowsForArgv(argv)
      return {
        vector,
        call: callOf(callId),
        result,
        parsed,
        argv,
        providerCalls: closed.filter((r) => r?.leg === 'provider-call').length,
        confinedSpawns: closed.filter((r) => r?.leg === 'confined-spawn').length,
        confinedExits: closed.filter((r) => r?.leg === 'confined-exit'),
        closedRows: closed,
        facts: factsAll.filter((f) => f?.locator === argv[0] || String(f?.detail ?? '').includes(bodyKey(argv[2] ?? '').slice(0, 40))),
      }
    }

    // the `bash` call the MEMBER's model issued (Q1)
    const bashCall = callOf(CALL_IDS.bash)
    const bashResult = resultOf(CALL_IDS.bash)
    const bashMarker = claims.bashTag
    const shellExec = counterRows.filter((row) => row?.leg === 'shell-exec' && String(row?.command ?? '').includes(bashMarker))
    const bashProviderRows = counterRows.filter((row) => row?.leg === 'provider-call' && (row?.argv ?? []).some((a) => String(a).includes(bashMarker)))
    const bashSample = {
      call: bashCall, result: bashResult, bashTag: bashMarker,
      shellExec,
      shellService: counterRows.filter((row) => row?.leg === 'shell-service'),
      baseSpawns: counterRows.filter((row) => row?.leg === 'base-spawn'),
      baseSpawnsWithMarker: baseSpawnsWith(bashMarker).length,
      confinedSpawns: counterRows.filter((row) => row?.leg === 'confined-spawn' && (row?.argv ?? []).some((a) => String(a).includes(bashMarker))).length,
      requestArgv: bashProviderRows.at(-1)?.argv ?? null,
      networkProfiles: bashProviderRows.map((row) => row?.networkProfile ?? null),
      procSightings: procSightings('bash'),
      expectedWorkspaceRoot: paths.workspace,
      deploymentSandbox: deploymentSandboxObservation({ shellExec, expectedWorkspaceRoot: paths.workspace }),
      leaderSurface,
      note: 'the fix claim is `confinedProviderCalls`/`confinedSpawns` from the provider ledger that carry the bash marker, plus `baseSpawnsWithMarker`/`shellExec` = 0',
    }
    bashSample.confinedProviderCalls = bashProviderRows.length
    bashSample.argvIsDeclaredShape = Array.isArray(bashSample.requestArgv)
      && bashSample.requestArgv.length === 3
      && bashSample.requestArgv[0] === '/bin/bash'
      && bashSample.requestArgv[1] === '-c'
      && String(bashSample.requestArgv[2]).includes(bashMarker)
    const executorVerdict = judgeExecutorCase(bashSample)

    const admitted = probeOf(CALL_IDS.faceControl, 'face_control')
    const admittedSample = { ...admitted, allowTag: claims.allowTag, markerExists: existsSync(paths.allowMarker), procSightings: procSightings('allow') }
    const admittedVerdict = judgeAdmittedCase(admittedSample)

    const denied = probeOf(CALL_IDS.netDeny, 'net_deny')
    const denyFacts = factsByCode('NETWORK_UNCONFINED_REALM')
    const capabilityRow = (() => {
      const rec = counterRows.filter((row) => row?.leg === 'network-probe').at(-1) ?? null
      const rows = Array.isArray(rec?.answer?.value) ? rec.answer.value : (Array.isArray(rec?.answer) ? rec.answer : [])
      const found = rows.find((r) => String(r?.dimension ?? '') === 'network-destination') ?? null
      return found === null ? null : { dimension: found.dimension, level: found.level, note: String(found.note ?? '').slice(0, 300), mechanism: String(found.mechanism ?? '').slice(0, 200) }
    })()
    const denySample = {
      ...denied,
      denyTag: claims.denyTag,
      providerCalls: denied.providerCalls,
      baseSpawns: baseSpawnsWith(claims.denyTag).length,
      procSightings: procSightings('deny'),
      markerExists: existsSync(paths.denyMarker),
      allowMarkerExists: existsSync(paths.allowMarker),
      facts: denyFacts,
      capability: capabilityRow,
      claimsConfinement: false,
    }
    const denyVerdict = judgeDenyCase(denySample)

    // ── does the deny lane govern the Member's `bash`? ─────────────────────
    const denyBashCall = callOf(CALL_IDS.denyBash)
    const denyBashResult = resultOf(CALL_IDS.denyBash)
    const denyBashExec = counterRows.filter((row) => row?.leg === 'shell-exec' && String(row?.command ?? '').includes(claims.denyBashTag))
    const denyBashSample = {
      call: denyBashCall,
      result: denyBashResult,
      bashTag: claims.denyBashTag,
      shellExec: denyBashExec,
      executionRequest: denyBashCall?.arguments ?? null,
      bwrap: baseSpawnsWith(claims.denyBashTag),
      baseSpawnsWithMarker: baseSpawnsWith(claims.denyBashTag).length,
      procSightings: procSightings('denyBash'),
      confinedProviderCalls: counterRows.filter((row) => row?.leg === 'provider-call' && (row?.argv ?? []).some((a) => String(a).includes(claims.denyBashTag))).length,
      claimsConfinement: false,
      refusedByFace: (() => {
        const text = String(denyBashResult?.text ?? '')
        return ['NETWORK_UNCONFINED_REALM', 'SUBPROCESS_PROGRAM_NOT_ABSOLUTE', 'SUBPROCESS_SHELL_ARGV_UNSUPPORTED', 'SUBPROCESS_SHELL_NOT_DECLARED', 'IO_READ_DENIED'].find((code) => text.includes(code)) ?? null
      })(),
    }
    const denyBashVerdict = judgeDenyBashCase(denyBashSample)

    // ── PD-13: the Member's own shell and the READ axis ────────────────────
    const readFacts = factsAll.filter((f) => f?.method === 'shellRead')
    const deniedReadCall = callOf(CALL_IDS.bashDeniedRead)
    const deniedReadResult = resultOf(CALL_IDS.bashDeniedRead)
    const deniedBody = `cat '${paths.outsideFile}'`
    const deniedReadSample = {
      call: deniedReadCall,
      result: deniedReadResult,
      locator: paths.outsideFile,
      secretMarker: 'A5SF_SUB_OUTSIDE_SECRET',
      readFacts,
      confinedProviderCalls: counterRows.filter((row) => row?.leg === 'provider-call' && (row?.argv ?? []).some((a) => String(a).includes(paths.outsideFile))).length,
      baseSpawns: baseSpawnsWith(paths.outsideFile).length,
      shellExec: counterRows.filter((row) => row?.leg === 'shell-exec' && String(row?.command ?? '').includes(paths.outsideFile)).length,
      procSightings: procSightings('readDenied'),
      claimsConfinement: false,
    }
    const deniedReadVerdict = judgeShellReadDenied(deniedReadSample)

    const admittedReadCall = callOf(CALL_IDS.bashInLaneRead)
    const admittedReadResult = resultOf(CALL_IDS.bashInLaneRead)
    const inLaneRows = counterRows.filter((row) => (row?.argv ?? []).some((a) => String(a).includes(paths.pd13InLaneFile)))
    // The child's own /proc/self/stat, printed by the command itself (see the
    // mock above). Parsed here, not asserted from a claim.
    const statOfChild = (() => {
      const text = String(admittedReadResult?.text ?? '')
      let payload = null
      try { payload = JSON.parse(text) } catch { return null }
      const stdout = String(payload?.stdout ?? '')
      const at = stdout.indexOf('A5SF_PD13_PROC')
      if (at < 0) return null
      const tail = stdout.slice(at + 'A5SF_PD13_PROC'.length).trim()
      const lines = tail.split('\n').map((line) => line.trim()).filter((line) => line !== '')
      // `tty` answers "not a tty" when there is no controlling terminal;
      // otherwise `ps` prints the child's own pid/pgid/tty/state.
      const noTty = lines.some((line) => line === 'not a tty')
      const psLine = lines.find((line) => /^\d+\s+\d+\s+\S+\s+\S+/u.test(line)) ?? null
      const psFields = psLine === null ? [] : psLine.split(/\s+/u)
      return {
        tty: noTty ? 'none' : (psFields[2] ?? 'unknown'),
        pgrp: psFields[1] === undefined ? null : Number(psFields[1]) || null,
        pid: psFields[0] === undefined ? null : Number(psFields[0]) || null,
        state: psFields[3] ?? null,
        raw: lines.slice(0, 4),
      }
    })()
    const admittedReadSample = {
      call: admittedReadCall,
      result: admittedReadResult,
      locator: paths.pd13InLaneFile,
      allowTag: claims.allowTag,
      readFacts,
      confinedProviderCalls: inLaneRows.filter((row) => row?.leg === 'provider-call').length,
      confinedSpawns: inLaneRows.filter((row) => row?.leg === 'confined-spawn').length,
      ttyOfChild: statOfChild === null ? 'unobserved' : statOfChild.tty,
      childStat: statOfChild,
      zombieSightings: statOfChild?.state === 'Z' ? 1 : 0,
    }
    const admittedReadVerdict = judgeShellReadAdmitted(admittedReadSample)
    writeFileSync(join(HERE, 'read-axis.json'), JSON.stringify({
      schema: 'a5sf-pd13/read-axis/1',
      at: new Date().toISOString(),
      note: 'PD-13 read-axis measurement: the Member\'s own model-visible `bash`. Process-level facts (pty/pgrp/state) come from an independent /proc scan; the guard facts come from the Member realm\'s consult sink.',
      denied: { ...deniedReadVerdict, locator: paths.outsideFile, confinedProviderCalls: deniedReadSample.confinedProviderCalls, facts: readFacts.filter((f) => f?.locator === paths.outsideFile) },
      admitted: { ...admittedReadVerdict, locator: paths.pd13InLaneFile, confinedProviderCalls: admittedReadSample.confinedProviderCalls, confinedSpawns: admittedReadSample.confinedSpawns, ttyOfChild: admittedReadSample.ttyOfChild, zombieSightings: admittedReadSample.zombieSightings, childStat: admittedReadSample.childStat },
      readFacts,
      childProcess: statOfChild,
    }, null, 2) + '\n')

    // every probe vector gets a measurement verdict (reported, NOT folded into
    // the run's case algebra — the preflight's case schema is lane-shaped)
    const probeReport = {
      schema: 'a5sf-pd13/probe-report/1',
      at: new Date().toISOString(),
      note: 'fixture argv table driven through the product-mounted confined face; each PROVEN/REFUTED pair is a face-contract measurement, not a lane grade',
      laneReport: parseJsonl(laneReportPath + '.jsonl'),
      vectors: {
        face_control: { ...admittedVerdict, providerCalls: admitted.providerCalls, confinedSpawns: admitted.confinedSpawns, code: admitted.parsed?.code ?? null, stdout: admitted.parsed?.stdout ?? null },
        net_deny: { ...denyVerdict, providerCalls: denySample.providerCalls, baseSpawns: denySample.baseSpawns, procSightings: denySample.procSightings, markerExists: denySample.markerExists, allowMarkerExists: denySample.allowMarkerExists, capability: denySample.capability, facts: denyFacts, code: denied.parsed?.code ?? null, stdout: denied.parsed?.stdout ?? null, message: denied.parsed?.message ?? null },
      },
      argvPredicate: {},
      readAxis: {
        denied: { ...deniedReadVerdict, locator: paths.outsideFile, confinedProviderCalls: deniedReadSample.confinedProviderCalls, facts: readFacts.filter((f) => f?.locator === paths.outsideFile) },
        admitted: { ...admittedReadVerdict, locator: paths.pd13InLaneFile, confinedProviderCalls: admittedReadSample.confinedProviderCalls, confinedSpawns: admittedReadSample.confinedSpawns, ttyOfChild: admittedReadSample.ttyOfChild, zombieSightings: admittedReadSample.zombieSightings },
      },
      denyBash: {
        ...denyBashVerdict,
        shellExec: denyBashExec,
        bwrap: denyBashSample.bwrap,
        procSightings: denyBashSample.procSightings,
        confinedProviderCalls: denyBashSample.confinedProviderCalls,
        refusedByFace: denyBashSample.refusedByFace,
        executionRequest: denyBashSample.executionRequest,
      },
      executor: {
        ...executorVerdict,
        shellService: bashSample.shellService,
        shellExec: shellExec,
        deploymentSandbox: bashSample.deploymentSandbox,
        baseSpawnCount: bashSample.baseSpawns.length,
        confinedProviderCalls: bashSample.confinedProviderCalls,
        procSightings: bashSample.procSightings,
        leaderSurface,
      },
    }
    for (const vector of ['shipped_argv', 'argv_lc', 'argv_empty_body', 'argv_extra_operand']) {
      const sampled = probeOf(CALL_IDS[{
        shipped_argv: 'shippedArgv', argv_lc: 'argvLc', argv_empty_body: 'argvEmpty', argv_extra_operand: 'argvExtra',
      }[vector]], vector)
      const expected = vector === 'shipped_argv' ? 'SUBPROCESS_PROGRAM_NOT_ABSOLUTE' : 'SUBPROCESS_SHELL_ARGV_UNSUPPORTED'
      probeReport.argvPredicate[vector] = {
        ...verdictOf(`the confined face REFUSES ${JSON.stringify(sampled.argv)} with ${expected} and zero processes, never handing it to the unconfined executor`, [
          { id: 'typed-code', ok: sampled.parsed?.code === expected, detail: `code=${String(sampled.parsed?.code)} message=${String(sampled.parsed?.message).slice(0, 200)}` },
          { id: 'zero-provider-calls', ok: sampled.providerCalls === 0, detail: `${String(sampled.providerCalls)} provider call(s)` },
          { id: 'zero-base-fallback', ok: baseSpawnsWith(sampled.argv[2] ?? '__none__').length === 0, detail: `${String(baseSpawnsWith(sampled.argv[2] ?? '__none__').length)} base-spawn record(s) with the body` },
        ]),
        code: sampled.parsed?.code ?? null,
        message: sampled.parsed?.message ?? null,
        providerCalls: sampled.providerCalls,
        baseSpawns: baseSpawnsWith(sampled.argv[2] ?? '__none__').length,
        argv: sampled.argv,
      }
    }
    writeFileSync(join(HERE, PROBE_REPORT_NAME), JSON.stringify(probeReport, null, 2) + '\n')
    log(`probe report: ${JSON.stringify({
      executor: executorVerdict.verdict,
      face_control: admittedVerdict.verdict,
      net_deny: denyVerdict.verdict,
      deny_bash: denyBashVerdict.verdict,
      argv: Object.fromEntries(Object.entries(probeReport.argvPredicate).map(([k, v]) => [k, v.verdict])),
    })}`)

    add(EXECUTOR_CASE, toRunVerdict(executorVerdict.verdict), { faceVerdict: executorVerdict.verdict, proposition: executorVerdict.proposition, failed: executorVerdict.failed, clauses: executorVerdict.clauses })
    add(ADMITTED_CASE, toRunVerdict(admittedVerdict.verdict), { faceVerdict: admittedVerdict.verdict, proposition: admittedVerdict.proposition, failed: admittedVerdict.failed, clauses: admittedVerdict.clauses })
    add(DENY_CASE, toRunVerdict(denyVerdict.verdict), { faceVerdict: denyVerdict.verdict, proposition: denyVerdict.proposition, failed: denyVerdict.failed, clauses: denyVerdict.clauses })
    add(READ_DENIED_CASE, toRunVerdict(deniedReadVerdict.verdict), { faceVerdict: deniedReadVerdict.verdict, proposition: deniedReadVerdict.proposition, failed: deniedReadVerdict.failed, clauses: deniedReadVerdict.clauses })
    add(READ_ADMITTED_CASE, toRunVerdict(admittedReadVerdict.verdict), { faceVerdict: admittedReadVerdict.verdict, proposition: admittedReadVerdict.proposition, failed: admittedReadVerdict.failed, clauses: admittedReadVerdict.clauses })
    add(DENY_BASH_CASE, toRunVerdict(denyBashVerdict.verdict), { faceVerdict: denyBashVerdict.verdict, proposition: denyBashVerdict.proposition, failed: denyBashVerdict.failed, clauses: denyBashVerdict.clauses })
    record.record.probeReport = { path: PROBE_REPORT_NAME, executor: executorVerdict.verdict, faceControl: admittedVerdict.verdict, netDeny: denyVerdict.verdict, denyBash: denyBashVerdict.verdict, readDenied: deniedReadVerdict.verdict, readAdmitted: admittedReadVerdict.verdict, argv: Object.fromEntries(Object.entries(probeReport.argvPredicate).map(([k, v]) => [k, v.verdict])) }

    // ── teardown ───────────────────────────────────────────────────────────
    abortStage = 'teardown'
    try { teardown = await world.teardown() } catch (error) { log(`world.teardown threw: ${redact(String(error?.message ?? error))}`) }
    const hostPid = world.instance?.child?.pid ?? null
    const portStillListening = bootInfo === null ? null : await tcpConnectProbe(bootInfo.port, 1500)
    const homeExistsAfterTeardown = existsSync(world.home)
    writeFileSync(join(HERE, 'teardown.json'), JSON.stringify({
      schema: 'a5sf-pd13/teardown/1', at: new Date().toISOString(),
      worldTeardown: teardown ?? null,
      processSeam: { hostPid, hostChildExitCode: world.instance?.child?.exitCode ?? null, portStillListening, homeExistsAfterTeardown },
    }, null, 2) + '\n')
    log(`teardown: hostPid=${String(hostPid)} portStillListening=${String(portStillListening)} homeExists=${String(homeExistsAfterTeardown)}`)

    log(`RUN VERDICT (faces): ${JSON.stringify({ executor: executorVerdict.verdict, admitted: admittedVerdict.verdict, deny: denyVerdict.verdict, denyBash: denyBashVerdict.verdict })}`)
  } catch (error) {
    failure = error
    log(`ABORT at ${abortStage}: ${redact(String(error?.message ?? error))}`)
    if (world !== null) {
      try { persistRunChannels?.('after abort') } catch (error) { log(`abort channel persist failed: ${String(error?.message ?? error)}`) }
      try { teardown = await world.teardown() } catch (teardownError) { log(`teardown after abort threw: ${redact(String(teardownError?.message ?? teardownError))}`) }
    }
    for (const id of SELECTED_CASES) {
      if (record.getCase(id) !== undefined) continue
      add(id, 'NOT_REACHED', { status: 'NOT_REACHED', reason: 'RUN_ABORTED', abortStage, detail: redact(String(error?.message ?? error)).slice(0, 1200) })
    }
    record.markAborted({ stage: abortStage, detail: redact(String(error?.message ?? error)).slice(0, 2000) })
  } finally {
    if (procWatcher !== null) clearInterval(procWatcher)
  }

  // ── the outcome row (the dev-live ledger's third row) ───────────────────
  let outcome = null
  try {
    outcome = lease.finish({
      overall: failure !== null ? 'FAIL' : (SELECTED_CASES.every((id) => record.getCase(id)?.verdict === 'PASS') ? 'PASS' : 'FAIL'),
      cases: SELECTED_CASES.map((id) => ({ id, verdict: record.getCase(id)?.verdict ?? 'NOT_REACHED' })),
      teardown: { releasedPorts: teardown?.releasedPorts ?? [], homeDeleted: teardown?.homeDeleted ?? null, hostPid: world?.instance?.child?.pid ?? null },
    })
    log(`dev-live outcome: ${JSON.stringify(outcome).slice(0, 800)}`)
  } catch (error) {
    log(`lease.finish threw: ${redact(String(error?.message ?? error))}`)
  }
  record.record.teardown = teardown ?? null
  record.record.abort = failure === null ? null : { stage: abortStage, detail: redact(String(failure?.message ?? failure)).slice(0, 2000) }
  record.record.recordClass = 'DEV-LIVE'
  record.record.candidateClaimEligibility = { eligible: false, reason: 'DEV_LIVE_EVIDENCE_NOT_CANDIDATE' }
  record.record.osLevelNetworkIsolationClaimed = false
  const finalized = record.finalize()
  const written = record.write(join(HERE, 'run-record.json'))
  finalized.runRecordPath = written
  writeFileSync(join(HERE, 'run-record.json'), JSON.stringify(finalized, null, 2) + '\n')
  writeFileSync(join(HERE, 'summary.txt'), formatSummary(finalized) + '\n')
  log(formatSummary(finalized))
  log(`RUN COMPLETE overall=${String(finalized.overall)} abort=${failure === null ? 'none' : abortStage}`)
  if (failure !== null) process.exitCode = 1
}

// ─────────────────────────────────────────────────────────────────────────────
// helpers copied from the accepted driver (unchanged semantics)
// ─────────────────────────────────────────────────────────────────────────────
async function waitForComposedProfile(world, expectedRowIds, timeoutMs) {
  const t0 = Date.now()
  for (;;) {
    let path = null
    try {
      const candidates = readdirSync(world.logDir).filter((name) => name.startsWith('composed-profile-') && name.endsWith('.patch.yml'))
      if (candidates.length > 0) { candidates.sort(); path = join(world.logDir, candidates[candidates.length - 1]) }
    } catch { path = null }
    if (path !== null) {
      const text = readFileSync(path, 'utf8')
      const present = [...text.matchAll(/^ {4}- id:\s*"?([a-z0-9][a-z0-9._-]*)"?\s*$/gmu)].map((m) => m[1])
      const missing = expectedRowIds.filter((id) => !present.includes(id))
      return { path, presentRowIds: present, missingRowIds: missing }
    }
    if (Date.now() - t0 > timeoutMs) return { path: null, presentRowIds: [], missingRowIds: expectedRowIds }
    await new Promise((r) => setTimeout(r, 250))
  }
}

function devLiveGrant() {
  const grant = {
    grantId: 'devlive-subprocess-1', scope: 'DEV-LIVE',
    grantedBy: 'owner 2026-11-09 ruling (relayed): scope authorisation for the Subprocess/Shell face — repeated self-authorised development starts, no per-start approval, no cumulative cap',
    face: 'Subprocess', world: LINE,
    note: 'dev-live measurement of the Subprocess face: executor identity, the argv predicate, the network-deny position and a positive control. Development evidence only: this class can never produce V@B=yes and no candidate claim is made.',
  }
  const path = GRANT_PATH_DEV_LIVE
  const existing = existsSync(path) ? readJson(path) : null
  if (existing === null) {
    mkdirSync(dirname(path), { recursive: true })
    writeFileSync(path, JSON.stringify(grant, null, 2) + '\n')
    log(`dev-live authorisation written: ${path}`)
  } else if (existing.scope !== 'DEV-LIVE' || existing.face !== grant.face) {
    throw new Error(`the recorded authorisation at ${path} is not a DEV-LIVE authorisation for face ${JSON.stringify(grant.face)}`)
  }
  return { path, scope: 'DEV-LIVE', face: grant.face, world: grant.world, grantId: grant.grantId, grantedBy: grant.grantedBy }
}

function runBindings(head, grant) {
  return {
    // EB3 strict binding: the record must carry the two 40-hex commits it was
    // measured against. `teamSha` = the tree under test, `hostSha` = the pinned
    // test-use HEAD; a record without them is not evidence.
    teamSha: head,
    hostSha: TEST_USE_BASELINE_SHA,
    authority: readAuthorityBinding(REPO_ROOT),
    candidate: { head, hostSha: TEST_USE_BASELINE_SHA, baseline: TEST_USE_BASELINE_SHA },
    grant: { grantId: grant.grantId, scope: 'DEV-LIVE', face: grant.face, world: grant.world },
    recordClass: 'DEV-LIVE',
    note: 'DEV-LIVE: development evidence, never a candidate claim; candidateClaimEligibility is false by construction',
  }
}

function readPorcelain() {
  try {
    return execFileSync('git', ['status', '--porcelain'], { cwd: REPO_ROOT, encoding: 'utf8' }).trim().split('\n').filter(Boolean)
  } catch { return [] }
}

if (PLAN_ONLY) {
  planOnly().catch((error) => {
    log(`PLAN FAILED: ${String(error?.stack ?? error)}`)
    process.exitCode = 1
  })
} else {
  boot().catch((error) => {
    log(`DRIVER FAILED (outside the run): ${String(error?.stack ?? error)}`)
    process.exitCode = 1
  })
}
