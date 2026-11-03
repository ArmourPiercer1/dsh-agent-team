#!/usr/bin/env node
/**
 * run-boot.mjs — THE ONE AUTHORISED HOST BOOT for route C's effective half.
 *
 * WHAT THIS SPENDS: exactly ONE Host start, charged through the BL-14
 * pre-registration gate (`tests/world-factory/suites/150-a5sf-read.mjs#readBudgetGrant`):
 *
 *   materialise grant.json (maxStarts = 2 = 1 intent row + 1 boot, bound to
 *   THIS tree's git HEAD) -> preRegisterReadBudget() writes the intent row on
 *   the ONE shared ledger (`tests/world-factory/lib/run-record.mjs`) ->
 *   lease.boot() -> `harness.boot()` writes the start row on the same ledger
 *   -> `world.startHost()` spawns. Order: intent -> start row -> spawn.
 *   A second spawn is refused by the lease (booted >= requiredBoots).
 *
 * WHAT IT ASKS THE BOOT (the five points; each becomes a RUN-record case):
 *   1. a Host with a MANAGED MEMBER whose team-row config carries
 *      `a5sfEvidencePath` + `a5sfNativeToolModules` (the #557 key) boots and the
 *      Member's model-visible surface carries exactly ONE `read`;
 *   2. a model-visible native `read` of a file OUTSIDE the compiled ceiling is
 *      REFUSED by the a5sf Guard (typed `IO_READ_DENIED`), not a crash;
 *   3. the configured sink holds exactly ONE `a5sf-guard-consult/1` fact for
 *      that locator (`decision:"deny"`, `decidedBy:"IO_READ_DENIED"`);
 *   4. a native `read` INSIDE the ceiling succeeds and its bytes match the
 *      planted claim;
 *   5. a Member whose `builtinToolDeny` names the native `read` fails LOUDLY at
 *      setup (C2(a)) — legible error, never a silent unconfined row.
 *   Plus C2(b): after the Member is stopped, is a shadow/revoke observable?
 *   (Recorded NOT_REACHED when the product exposes no seam — see the README.)
 *
 * WHAT IT DOES NOT DO: no kernel/OS claim, no second boot, no `:3080`, no
 * product source edit (CORE PATCH BUDGET = 0). The `teamA5sfRealm` provider and
 * the compiled ceiling are supplied by a TEST COMPOSITION row
 * (`a5sf-native-provider-row.mjs`) because no product code provides them at
 * this base — disclosed in the evidence README, not laundered as product.
 *
 * MODES
 *   node run-boot.mjs --plan   build the World material + emit the patch layer
 *                              and validate the blueprints with the HOST's own
 *                              domain facade; NO gate, NO ledger row, NO spawn.
 *   node run-boot.mjs          the one boot (spends 1 start + 1 intent row).
 *
 * @module dev/agent-workflow/evidence/a5sf-live-native/run-boot
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  TestWorldFactory, // not constructed directly: the a5sf harness owns the ONE factory
  apiPrompt,
  authenticate,
  emitPatchLayer,
  fetchJson,
} from '../../../../tests/world-factory/lib/world-factory.mjs'
import { createRunRecord, formatSummary, overallVerdict } from '../../../../tests/world-factory/lib/run-record.mjs'
import { TEST_USE_BASELINE_SHA } from '../../../../tests/paths.mjs'
import { createA5sfHarness } from '../../../../tests/world-factory/lib/a5sf-harness.mjs'
import { preRegisterReadBudget, resolveHeadCommit } from '../../../../tests/world-factory/suites/150-a5sf-read.mjs'
import {
  extractInstanceId,
  hasMarker,
  lastUserTextOfStatic,
  messagesOf,
  remoteCall,
  surfaceNamesOf,
  textOf,
  toolCall,
  toolMsgsOf,
} from '../../../../tests/world-factory/lib/u6-fs-assembly.mjs'
import { presetDeclarationRow, smokePresetPlugins } from '../../../../tests/kits/_shared/preset-seam.mjs'

// ─────────────────────────────────────────────────────────────────────────────
// paths, constants, logging
// ─────────────────────────────────────────────────────────────────────────────

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..')
const RUN_LOG = join(HERE, 'run.log')
const GRANT_PATH = join(HERE, 'grant.json')
const LEDGER_PATH = join(HERE, 'ledger.jsonl')

/** The pristine host runtime tree. A sibling worktree does not carry it (it is
 *  gitignored), so fall back to the MAIN checkout's tree — still the pinned
 *  baseline, still read-only (asserted by the factory before the boot). */
function hostTreePath() {
  const local = join(REPO_ROOT, 'tests', 'deepseek-harness-test-use')
  if (existsSync(local)) return local
  const shared = join(REPO_ROOT, '..', '..', 'tests', 'deepseek-harness-test-use')
  if (existsSync(shared)) return resolve(shared)
  throw new Error(`no pristine host tree: neither ${local} nor ${resolve(shared)} exists`)
}
const HOST_TREE = process.env.A5SF_HOST_TREE !== undefined && process.env.A5SF_HOST_TREE !== ''
  ? resolve(process.env.A5SF_HOST_TREE)
  : hostTreePath()

/** The host's OWN native fs tool module — the SAME package the preset mounts,
 *  named by the row composition (route C's enablement shape). */
const HOST_TOOL_FS = join(HOST_TREE, 'packages', 'fs', 'tool-fs', 'lib', 'index.js')

const LINE = 'a5sflive'
const ROOT = 'session-a5sf-live-root'
const CREATE_ROOT = 'session-a5sf-live-team'
const BP_ANCHOR_ID = 'team.a5sf.live.anchor'
const BP_MAIN_ID = 'team.a5sf.live.main'
const PRESET_ID = 'a5sf-live-base'

const MK_DISC = 'A5SF_LIVE_DISC'
const MK_L1 = 'A5SF_LIVE_L1_DRIVE'
const MK_OUTSIDE = 'A5SF_LIVE_READ_OUTSIDE'
const MK_INSIDE = 'A5SF_LIVE_READ_INSIDE'
const TOK_D1 = 'a5sf-d1'
const TOK_D2 = 'a5sf-d2'
const DONE_OUTSIDE = 'A5SF_OUTSIDE_DONE'
const DONE_INSIDE = 'A5SF_INSIDE_DONE'
const DONE_L1 = 'A5SF_L1_DONE'

const MANAGED_TOOL_NAMES = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh']
const SAFE_UNMANAGED_TOOL_NAMES = ['todo_write']

const CASES = Object.freeze([
  'live:booted-member-a5sf-wired',
  'live:native-read-outside-refused',
  'live:sink-exactly-one-deny-fact',
  'live:native-read-inside-allowed',
  'live:builtin-deny-native-fails-loud',
  'live:teardown-no-shadow',
  'live:runtime-revoke-reachable',
])

const PLAN_ONLY = process.argv.includes('--plan')
const startedAt = new Date().toISOString()
function log(line) {
  const text = `[${new Date().toISOString()}] ${line}`
  // eslint-disable-next-line no-console
  console.log(text)
  try {
    appendFileSync(RUN_LOG, text + '\n')
  } catch {
    /* the console is still the live channel */
  }
}
const sha256 = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
const redact = (text) => String(text ?? '').replace(/\?token=[A-Za-z0-9_-]+/g, '?token=<redacted>')
const basenameOf = (p) => String(p).slice(String(p).lastIndexOf('/') + 1)

// ─────────────────────────────────────────────────────────────────────────────
// fixtures
// ─────────────────────────────────────────────────────────────────────────────

function mainBlueprintYaml(denyList) {
  const denyLines = denyList.length === 0 ? ['    builtinToolDeny: []'] : ['    builtinToolDeny:', ...denyList.map((n) => `      - ${n}`)]
  const denyLinesMember = denyList.length === 0 ? ['      builtinToolDeny: []'] : ['      builtinToolDeny:', ...denyList.map((n) => `        - ${n}`)]
  return [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
    'leader:', '  templateId: leader',
    `  persona: ${JSON.stringify(`You are the leader of the a5sf live-native boot team. ${MK_L1} drives your chain: delegate the outside read, delegate the inside read, create the deny-native member, archive the first member, then finish.`)}`,
    '  capabilities:', '    teamTools:', '      kind: allow', '      items:',
    '        - team_delegate', '        - team_create_member', '        - team_archive_member',
    ...denyLines,
    '    skills:', '      kind: allow', '      items: []',
    '    mcp:', '      kind: allow', '      items: []',
    '    permissions:', '      default: deny', '      allow: []', '      ask: []', '      deny: []',
    'teamEnvelope:', '  allow:', '    - create-member', '    - assign-task', '    - send-message', '    - report-progress', '  deny: []',
    'members:',
    // (1) the a5sf-wired Member: NO capabilities block (the CI-03 population
    // shape) — its ONLY confinement is the compiled a5sf ceiling.
    '  - templateId: worker', '    displayName: "a5sf live native worker"',
    `    persona: ${JSON.stringify('You are the a5sf live-native worker. Follow the delegated script exactly, one tool call at a time.')}`,
    // (2) the reviewer's C2(a) Member: a builtinToolDeny lane that NAMES the
    // native `read`. Under route C the setup must REFUSE (fail closed) rather
    // than run with an unconfined row.
    '  - templateId: denyread', '    displayName: "a5sf deny-native worker"',
    `    persona: ${JSON.stringify('You are the a5sf deny-native worker. This template must never reach a model turn.')}`,
    '    capabilities:', '      teamTools:', '        kind: deny',
    ...denyLinesMember,
    '        - read',
    '      skills:', '        kind: allow', '        items: []',
    '      mcp:', '        kind: allow', '        items: []',
    '      permissions:', '        default: deny', '        allow: []', '        ask: []', '        deny: []',
    'memberEnvelopes:',
    '  - templateId: worker', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
    '  - templateId: denyread', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
    'permissionMutationEnvelope:', '  rules: []', 'teamHardEnvelope:', '  rules: []',
    'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')
}

const BP_ANCHOR_YAML = [
  '---', 'schemaVersion: 3', `blueprintId: ${BP_ANCHOR_ID}`, 'revision: "1"',
  'leader:', '  templateId: leader',
  `  persona: ${JSON.stringify(`You are the leader of the a5sf live-native boot team. ${MK_DISC} is the discovery marker.`)}`,
  'members:', '  - templateId: worker', '    persona: "You are the a5sf live-native worker."',
  'memberEnvelopes: []', 'requirements: []', 'permissionMutationEnvelope:', '  rules: []',
  'teamHardEnvelope:', '  rules: []', 'policyStates: []', 'metadata: {}', '---', '',
].join('\n')

/** The host's own blueprint validator (the compiled domain facade the
 *  host-loaded plugin imports) — a document the host would reject must never
 *  reach `team.create` and burn the boot on a MALFORMED_DTO. */
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
// the scripted provider (mock model)
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
function userTextOf(req) {
  return messagesOf(req)
    .filter((m) => m?.role === 'user')
    .map((m) => (typeof m.content === 'string' ? m.content : JSON.stringify(m.content ?? '')))
    .join('\n')
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
function makeDecide({ outsidePath, insidePath }) {
  const member = { reads: 0 }
  return function decide({ req }) {
    const allText = messagesOf(req).map(textOf).join('\n')
    const lastUser = lastUserTextOfStatic(req)
    if (allText.includes('Generate the session title')) return { kind: 'text', content: 'a5sf live-native session' }
    const userText = userTextOf(req)
    const isMemberD2 = userText.includes(`requestToken=${TOK_D2}`)
    const isMemberD1 = userText.includes(`requestToken=${TOK_D1}`)
    const isLeader = lastUser.includes(MK_L1)
      || userText.includes(MK_L1)
      || allText.includes('[team-work-settled')
      || allText.includes('A5SF_LEADER')
    if (isMemberD2 || isMemberD1) {
      const reads = countAssistantToolUses(req, 'read')
      if (isMemberD2) {
        if (reads < 2) return toolCall('read', { file_path: insidePath })
        return { kind: 'text', content: `${DONE_INSIDE} ${lastToolResultText(req).slice(0, 160)}` }
      }
      if (reads < 1) return toolCall('read', { file_path: outsidePath })
      return { kind: 'text', content: `${DONE_OUTSIDE} ${lastToolResultText(req).slice(0, 160)}` }
    }
    if (isLeader) {
      // Phase = the number of Team tool calls already issued on the leader lane.
      const teamCalls = countAssistantToolUses(req, 'team_delegate')
        + countAssistantToolUses(req, 'team_create_member')
        + countAssistantToolUses(req, 'team_archive_member')
      // The first a5sf-wired Member instance id (from the delegate-create result).
      const seen = []
      for (const m of messagesOf(req)) {
        for (const block of Array.isArray(m?.content) ? m.content : []) {
          if (block?.type !== 'tool_result') continue
          const id = extractInstanceId((Array.isArray(block.content) ? block.content : []).map((c) => c?.text ?? '').join(''))
          if (id !== null && !seen.includes(id)) seen.push(id)
        }
      }
      const firstInstance = seen[0]
      if (teamCalls === 0) {
        return toolCall('team_delegate', {
          rootSessionId: CREATE_ROOT,
          requestToken: `${TOK_D1}-delegate`,
          delegationTemplateId: 'worker',
          label: 'a5sf-worker',
          prompt: `${MK_OUTSIDE} read the planted outside-ceiling file once, then report.`,
          async: false,
        })
      }
      if (teamCalls === 1) {
        if (firstInstance === undefined) return { kind: 'text', content: 'A5SF_LEADER_NO_INSTANCE' }
        return toolCall('team_delegate', {
          rootSessionId: CREATE_ROOT,
          requestToken: `${TOK_D2}-delegate`,
          delegationInstanceId: firstInstance,
          label: 'a5sf-inside',
          prompt: `${MK_INSIDE} read the planted inside-ceiling file once, then report.`,
          async: false,
        })
      }
      if (teamCalls === 2) {
        return toolCall('team_create_member', {
          rootSessionId: CREATE_ROOT,
          requestToken: 'a5sf-denyread-create',
          delegationTemplateId: 'denyread',
          label: 'a5sf-denyread',
        })
      }
      if (teamCalls === 3) {
        if (firstInstance === undefined) return { kind: 'text', content: 'A5SF_LEADER_NO_INSTANCE' }
        return toolCall('team_archive_member', {
          rootSessionId: CREATE_ROOT,
          requestToken: 'a5sf-archive',
          targetInstanceId: firstInstance,
        })
      }
      return { kind: 'text', content: DONE_L1 }
    }
    if (lastUser.includes(MK_DISC)) return { kind: 'text', content: 'A5SF_DISC_DONE' }
    return { kind: 'text', content: 'A5SF_LIVE_NOOP' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// world material
// ─────────────────────────────────────────────────────────────────────────────

function teamRowConfig({ home, workspaceDir }) {
  const dist = join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime')
  const glueUrl = pathToFileURL(join(dist, 'src', 'plugin', 'live', 'agent-bindings.mjs')).href
  const seamUrl = pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'root-binding', 'harness', 'seam.mjs')).href
  return {
    rootSessionId: ROOT,
    bootPhase: 'create',
    blueprintSource: BP_ANCHOR_YAML,
    blueprintDir: join(home, 'blueprints'),
    rootPresetId: PRESET_ID,
    memberPresetId: PRESET_ID,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'a5sf-live-model' },
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
    // ── route C enablement: the evidence sink + the native tool module list ──
    a5sfEvidencePath: join(home, 'a5sf-consult.jsonl'),
    a5sfNativeToolModules: [pathToFileURL(HOST_TOOL_FS).href],
    // NOTE: no `teamToolPlane` — the Alpha.4/U6 governed read plane is
    // deliberately absent, so the ONLY confinement in this World is the a5sf
    // compiled realm the provider row supplies.
    _workspaceDir: workspaceDir,
  }
}

function rowsFor({ home, workspaceDir }) {
  const dist = join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime')
  const PRODUCTION_ROW = pathToFileURL(join(dist, 'src', 'plugin', 'host.js')).href
  const P6T6_ROW = pathToFileURL(join(REPO_ROOT, 'packages', 'tools', 'harness', 'plugin.mjs')).href
  const providerRow = pathToFileURL(join(HERE, 'a5sf-native-provider-row.mjs')).href
  const config = teamRowConfig({ home, workspaceDir })
  delete config._workspaceDir
  const basePlugins = [...smokePresetPlugins({
    personaText: 'You are a coding agent powered by the {{model}} model.',
    cwdSuffix: 'Your working directory is {{cwd}}.',
    bashDescription: 'Run commands in a bash shell. State is persistent across calls.',
  }), { id: 'tool-fs-search', name: '@deepseek-ai/dsh-tool-fs-search', config: { sampleOverCapGlobResults: false } }]
  return {
    rows: [
      // MUST mount before the Team row so `ctx.get('teamA5sfRealm')` resolves
      // when the first Member setup runs (sibling service, app-wide registry).
      { id: 'a5sf-native-provider', name: providerRow, config: { allowRoot: realpathSync(workspaceDir) } },
      { id: 'dsh-agent-team', name: PRODUCTION_ROW, config },
      { id: 'p6t6-team-tools', name: P6T6_ROW },
      presetDeclarationRow({
        id: PRESET_ID,
        displayName: 'a5sf live base',
        description: `a5sf live-native boot preset (${LINE}) = smoke + tool-fs-search`,
        plugins: basePlugins,
      }),
    ],
    config,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// the run
// ─────────────────────────────────────────────────────────────────────────────

function writeConsultCopy(sourcePath) {
  const dest = join(HERE, 'consultations.jsonl')
  if (existsSync(sourcePath)) {
    writeFileSync(dest, readFileSync(sourcePath))
    return { copied: true, sha256: sha256(dest), bytes: readFileSync(dest).length }
  }
  writeFileSync(dest, '')
  return { copied: false, sha256: null, bytes: 0 }
}

function parseLedger(path) {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8').split('\n').filter((l) => l.trim() !== '').map((line) => {
    try {
      return JSON.parse(line)
    } catch {
      return { unparseable: line.slice(0, 200) }
    }
  })
}

async function planOnly() {
  log(`PLAN MODE — no gate, no ledger row, no spawn. repo=${REPO_ROOT} hostTree=${HOST_TREE}`)
  const head = resolveHeadCommit(REPO_ROOT)
  log(`HEAD=${String(head)} pinnedHost=${TEST_USE_BASELINE_SHA}`)
  log(`host tool-fs module: ${HOST_TOOL_FS} exists=${existsSync(HOST_TOOL_FS)}`)
  const anchor = assertBlueprintText(BP_ANCHOR_YAML, BP_ANCHOR_ID, 1, 'anchor.yaml')
  const main = assertBlueprintText(mainBlueprintYaml(['u6fs_probe', 'read']), BP_MAIN_ID, 2, 'main.yaml')
  log(`blueprint ingest: anchor=${JSON.stringify(anchor)} main=${JSON.stringify(main)}`)
  const factory = new TestWorldFactory({ repoRoot: REPO_ROOT, evidenceRoot: HERE, hostTree: HOST_TREE })
  factory.assertHostBase('plan')
  const world = await factory.createWorld({ line: LINE, u6Fs: { rows: [] } })
  try {
    const { rows } = rowsFor({ home: world.home, workspaceDir: world.workspaceDir })
    const patch = emitPatchLayer([
      'a5sf live-native boot: provider row (teamA5sfRealm) + production Team row',
      'with a5sfEvidencePath + a5sfNativeToolModules + p6t6 + preset declaration.',
    ], rows)
    log(`patch layer bytes=${patch.length}; rows=${rows.map((r) => r.id).join(',')}`)
    log('---- patch layer ----\n' + patch + '\n---- end patch ----')
    const provider = await import(pathToFileURL(join(HERE, 'a5sf-native-provider-row.mjs')).href)
    log(`provider row module: name=${provider.name} apply=${typeof provider.apply}`)
  } finally {
    const torn = await world.teardown()
    log(`plan world torn down: homeDeleted=${String(torn.homeDeleted)} releasedPorts=${JSON.stringify(torn.releasedPorts)}`)
  }
}

async function boot() {
  log(`BOOT MODE — exactly ONE Host start. repo=${REPO_ROOT}`)
  log(`hostTree=${HOST_TREE} pin=${TEST_USE_BASELINE_SHA}`)
  const head = resolveHeadCommit(REPO_ROOT)
  if (head === null) throw new Error('git rev-parse HEAD failed: the grant cannot be bound')
  log(`HEAD=${head}`)
  if (!existsSync(HOST_TOOL_FS)) throw new Error(`the host native tool module is missing: ${HOST_TOOL_FS}`)

  // ── the per-run grant, bound to the EXACT HEAD this run executes on ──────
  const grant = {
    grantId: `grant-a5sf-live-native-${head.slice(0, 12)}`,
    maxStarts: 2,
    grantedBy: 'user ruling 2026-11-03 a5sf-boot-pool-20261103-user-20 — allocation item "F1 effective-half verification" (1 boot; the other 2 boots of that item moved to route C and binding acceptance)',
    boundCommit: head,
    note: 'maxStarts = 1 pre-registration (intent) row + 1 boot (BL-14 arithmetic: the gate counts shared-ledger rows, not spawns)',
  }
  writeFileSync(GRANT_PATH, JSON.stringify(grant, null, 2) + '\n')
  log(`grant materialised: ${GRANT_PATH} maxStarts=${grant.maxStarts} boundCommit=${grant.boundCommit}`)

  const runId = `a5sf-live-native-${new Date().toISOString().replace(/[:.]/g, '-')}`
  const record = createRunRecord({
    runId,
    suite: 'a5sf-live-native',
    selectedCases: CASES,
    bindings: {
      teamSha: head,
      hostSha: TEST_USE_BASELINE_SHA,
      hostTree: HOST_TREE,
      line: LINE,
      sink: 'world-home a5sf-consult.jsonl (copy: consultations.jsonl)',
      grantId: grant.grantId,
      providerComposition: 'test row dev/agent-workflow/evidence/a5sf-live-native/a5sf-native-provider-row.mjs (no product provider exists at this base)',
    },
    ledgerPath: LEDGER_PATH,
  })

  const harness = createA5sfHarness({
    repoRoot: REPO_ROOT,
    evidenceRoot: HERE,
    suite: 'a5sf-live-native',
    line: LINE,
    runRecord: record,
    maxHostStarts: grant.maxStarts,
    hostTree: HOST_TREE,
  })
  const factory = harness.factory
  factory.bindRunRecord(record)
  const candidate = harness.assertCandidate()
  log(`candidate asserted: ${JSON.stringify(candidate)}`)

  // ── the gate: intent row BEFORE any World exists ─────────────────────────
  const lease = await preRegisterReadBudget({
    grantPath: GRANT_PATH,
    headCommit: head,
    runRecord: record,
    requiredBoots: 1,
  })
  log(`gate lease: grant=${lease.grant.grantId} intentRows=${lease.intentRows().length} rowsBeforeIntent=${lease.rowsBefore} rowsAfterIntent=${lease.rowsAfterIntent} remaining=${lease.position.remaining}`)

  const add = (id, verdict, detail = {}) => {
    record.addCase(id, verdict, detail)
    log(`case ${id}: ${verdict} ${JSON.stringify(detail).slice(0, 400)}`)
  }

  const world = await harness.createWorld({ line: LINE, u6Fs: { rows: [] } })
  const outside = join(world.home, 'outside-ceiling.txt')
  const inside = join(world.workspaceDir, 'inside-ceiling.txt')
  const OUTSIDE_CLAIM = `A5SF_OUTSIDE_CLAIM_${world.id}`
  const INSIDE_CLAIM = `A5SF_INSIDE_CLAIM_${world.id}`
  const sinkPath = join(world.home, 'a5sf-consult.jsonl')
  let bootInfo = null
  let teardown = null
  let failure = null
  const evidence = { worldId: world.id, outside: { path: outside, claim: OUTSIDE_CLAIM }, inside: { path: inside, claim: INSIDE_CLAIM }, sinkPath }

  try {
    const { rows, config } = rowsFor({ home: world.home, workspaceDir: world.workspaceDir })
    mkdirSync(config.blueprintDir, { recursive: true })
    writeFileSync(join(config.blueprintDir, 'anchor.yaml'), BP_ANCHOR_YAML)
    // The real main blueprint is written after the discovery surface is known;
    // a placeholder keeps the pre-boot ingest honest.
    writeFileSync(join(config.blueprintDir, 'main.yaml'), mainBlueprintYaml([]))
    writeFileSync(join(world.home, 'p6t6-directive.json'), JSON.stringify({
      boot: 1, phase: 'create', reportDir: world.logDir, runStamp: world.id, rootSessionId: ROOT,
    }, null, 2))
    assertBlueprintText(BP_ANCHOR_YAML, BP_ANCHOR_ID, 1, 'anchor.yaml')
    writeFileSync(inside, `${INSIDE_CLAIM}\n`)
    writeFileSync(outside, `${OUTSIDE_CLAIM}\n`)
    log(`planted inside=${inside} (${INSIDE_CLAIM}); outside=${outside} (${OUTSIDE_CLAIM})`)
    log(`rows: ${rows.map((r) => r.id).join(',')}`)
    log(`team row a5sfEvidencePath=${String(config.a5sfEvidencePath)} a5sfNativeToolModules=${JSON.stringify(config.a5sfNativeToolModules)}`)
    world.u6Fs.rows.push(...rows)

    await world.startMock({ decide: makeDecide({ outsidePath: outside, insidePath: inside }) })
    log(`mock started on ${String(world.mock?.port)}`)

    // ── BOOT 1 of 1: intent row (written) -> start row -> spawn ────────────
    bootInfo = await lease.boot(() => harness.boot({ world, phase: 'a5sf-live-native-boot1', bootTimeoutMs: 180_000 }))
    log(`BOOTED port=${bootInfo.port} (lease bootsSpent=${lease.bootsSpent()}) log=${bootInfo.logPath}`)
    record.record.boots = [{ phase: 'a5sf-live-native-boot1', world: world.id, port: bootInfo.port, logPath: bootInfo.logPath }]

    const origin = `http://127.0.0.1:${bootInfo.port}`
    const hostAlive = () => world.instance?.child !== null && world.instance?.child !== undefined && world.instance?.child.exitCode === null
    const cookie = await authenticate(origin, world.token)
    log('authenticated (token never recorded)')

    // readiness: p6t6 health + anchored team session at phase create
    const waitA = async (predicate, timeoutMs) => {
      const t0 = Date.now()
      for (;;) {
        let hit = false
        try { hit = (await predicate()) === true } catch { hit = false }
        if (hit) return true
        if (Date.now() - t0 > timeoutMs) return false
        await new Promise((r) => setTimeout(r, 400))
      }
    }
    const healthOk = await waitA(async () => {
      const st = await fetchJson(`${origin}/__p6t6/health`, undefined, 20_000)
      return st.status === 200 && st.body?.ok === true
    }, 120_000)
    log(`p6t6 health=${String(healthOk)} hostAlive=${String(hostAlive())}`)
    const stateOk = await waitA(async () => {
      const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
      return st.status === 200 && st.body?.rootSessionId === ROOT && st.body?.teamSession !== null
    }, 90_000)
    log(`p6t6 state (rootSessionId=${ROOT}, teamSession!=null)=${String(stateOk)}`)

    // discovery -> the model-visible surface -> the real main blueprint
    const discPrompt = await apiPrompt(origin, cookie, ROOT, MK_DISC, 'a5sf')
    log(`discovery prompt status=${String(discPrompt.status)}`)
    const surfaceOk = await waitA(() => (world.mock?.requests ?? []).some((r) => hasMarker(r, MK_DISC) && surfaceNamesOf(r).length > 0), 150_000)
    if (!surfaceOk) throw new Error('discovery model request with a tool surface never arrived')
    const surface = (() => {
      const candidates = (world.mock?.requests ?? []).filter((r) => hasMarker(r, MK_DISC)).map((r) => surfaceNamesOf(r)).sort((a, b) => b.length - a.length)
      return [...new Set(candidates[0] ?? [])].sort()
    })()
    const denyList = surface.filter((n) => !String(n).startsWith('team_') && !MANAGED_TOOL_NAMES.includes(n) && !SAFE_UNMANAGED_TOOL_NAMES.includes(n))
    log(`model-visible surface (${String(surface.length)}): ${surface.join(',')}`)
    log(`builtinToolDeny base list: ${denyList.join(',')}`)
    const mainText = mainBlueprintYaml(denyList)
    assertBlueprintText(mainText, BP_MAIN_ID, 2, 'main.yaml')
    writeFileSync(join(config.blueprintDir, 'main.yaml'), mainText)
    log('main blueprint written and validated by the host facade')

    const created = await remoteCall(fetchJson, origin, cookie, 'team.create', {
      rootSessionId: CREATE_ROOT,
      blueprintId: BP_MAIN_ID,
      initialWork: { prompt: MK_L1 },
    }, 'a5sf')
    const createOk = created.status === 200 && created.body?.result?.ok === true
    log(`team.create status=${String(created.status)} ok=${String(createOk)} ${redact(JSON.stringify(created.body ?? null)).slice(0, 400)}`)
    if (!createOk) throw new Error(`team.create failed: status=${String(created.status)} body=${redact(JSON.stringify(created.body ?? null)).slice(0, 300)}`)

    // ── drive: the leader chain is synchronous (async:false delegates) ──────
    const replySeen = (content) => (world.mock?.requests ?? []).some((r) => r.reply?.kind === 'text' && String(r.reply.content ?? '').startsWith(content))
    const chainOk = await waitA(() => replySeen(DONE_L1), 420_000)
    log(`leader chain closed (${DONE_L1})=${String(chainOk)}`)
    // Give the last tool result one beat to land in the mock corpus.
    await new Promise((r) => setTimeout(r, 1000))

    // ── evidence collection ────────────────────────────────────────────────
    const requests = world.mock?.requests ?? []
    const findRequestsWithTool = (name) => requests.filter((r) => surfaceNamesOf(r).includes(name))
    const memberRequests = requests.filter((r) => userTextOf(r).includes(`requestToken=${TOK_D1}`) || userTextOf(r).includes(`requestToken=${TOK_D2}`))
    const surfacePerMemberRequest = memberRequests.map((r) => {
      const names = surfaceNamesOf(r)
      return {
        seq: r.seq,
        token: userTextOf(r).includes(`requestToken=${TOK_D2}`) ? TOK_D2 : TOK_D1,
        readCount: names.filter((n) => n === 'read').length,
        surfaceSize: names.length,
        surface: names,
      }
    })
    // every tool result the model ever saw, with the call it belongs to
    const results = []
    for (const r of requests) {
      const msgs = messagesOf(r)
      const assistantByCall = new Map()
      for (const m of msgs) {
        if (m?.role === 'assistant' && Array.isArray(m.content)) {
          for (const b of m.content) if (b?.type === 'tool_use') assistantByCall.set(b.id, b.name)
        }
      }
      for (const m of msgs) {
        for (const b of Array.isArray(m?.content) ? m.content : []) {
          if (b?.type === 'tool_result') {
            results.push({
              seq: r.seq,
              callId: b.tool_use_id ?? null,
              tool: assistantByCall.get(b.tool_use_id) ?? null,
              isError: b.is_error === true,
              text: (Array.isArray(b.content) ? b.content : []).map((c) => c?.text ?? '').join(''),
            })
          }
        }
        if (m?.role === 'tool') {
          results.push({ seq: r.seq, callId: m.tool_call_id ?? null, tool: assistantByCall.get(m.tool_call_id) ?? null, isError: m.is_error === true, text: String(m.content ?? '') })
        }
      }
    }
    const readResults = results.filter((r) => r.tool === 'read')
    const outsideReads = readResults.filter((r) => r.text.includes(basenameOf(outside)) || r.text.includes(OUTSIDE_CLAIM) || r.text.includes('outside-ceiling'))
    const insideReads = readResults.filter((r) => r.text.includes(basenameOf(inside)) || r.text.includes(INSIDE_CLAIM) || r.text.includes('inside-ceiling'))
    const outsideClaimInAnyResult = results.filter((r) => r.text.includes(OUTSIDE_CLAIM))
    const insideClaimInAnyResult = results.filter((r) => r.text.includes(INSIDE_CLAIM))
    const createDenyResults = results.filter((r) => r.tool === 'team_create_member')
    const createDenyText = createDenyResults.map((r) => r.text).join('\n')
    // Which team_* calls were actually issued, and their results
    const teamCallsIssued = []
    for (const r of requests) {
      for (const m of messagesOf(r)) {
        if (m?.role === 'assistant' && Array.isArray(m.content)) {
          for (const b of m.content) if (b?.type === 'tool_use' && String(b?.name ?? '').startsWith('team_')) teamCallsIssued.push({ seq: r.seq, name: b.name, args: b.input ?? b.arguments ?? null })
        }
      }
    }

    // the sink (the product's own transport, not the model transcript)
    const sinkRows = existsSync(sinkPath)
      ? readFileSync(sinkPath, 'utf8').split('\n').filter((l) => l.trim() !== '').map((l) => { try { return JSON.parse(l) } catch { return { unparseable: l.slice(0, 200) } } })
      : null
    const guardFacts = (sinkRows ?? []).filter((f) => f?.schema === 'a5sf-guard-consult/1')
    const outsideFacts = guardFacts.filter((f) => String(f.locator ?? '').includes(basenameOf(outside)))
    const insideFacts = guardFacts.filter((f) => String(f.locator ?? '').includes(basenameOf(inside)))
    const denyFacts = outsideFacts.filter((f) => f.decision === 'deny')
    log(`sink=${sinkPath} exists=${String(sinkRows !== null)} rows=${String((sinkRows ?? []).length)} guardFacts=${String(guardFacts.length)} outside=${String(outsideFacts.length)} inside=${String(insideFacts.length)}`)
    for (const f of guardFacts) log(`  fact ${JSON.stringify(f).slice(0, 420)}`)

    const consulting = writeConsultCopy(sinkPath)
    evidence.consultations = consulting
    log(`consultations.jsonl ${consulting.copied ? 'copied' : 'ABSENT'} sha256=${String(consulting.sha256)} bytes=${String(consulting.bytes)}`)

    // host log witnesses (the product's own lines, never the transcript)
    const hostLog = (() => { try { return readFileSync(bootInfo.logPath, 'utf8') } catch { return '' } })()
    const hostHits = (pattern) => hostLog.split('\n').filter((l) => l.includes(pattern))
    const witnesses = {
      a5sfLines: hostHits('a5sf').slice(-20).map((l) => redact(l).slice(0, 300)),
      guardLines: hostHits('IO_READ_DENIED').slice(-10).map((l) => redact(l).slice(0, 300)),
      disposeLines: hostHits('realm dispose').slice(-10).map((l) => redact(l).slice(0, 300)),
      // The U6 probe row's own ledger (an independent channel for what the
      // host dispatcher saw) — present because the u6-fs World kind mounts it.
      probeReadExecutes: (world.u6fsLedgerRows?.() ?? []).filter((r) => r?.leg === 'read-execute').map((r) => ({ path: r.path, agent: r.agent })),
    }
    log(`host log witnesses: a5sf=${String(witnesses.a5sfLines.length)} guard=${String(witnesses.guardLines.length)} dispose=${String(witnesses.disposeLines.length)}`)

    evidence.requests = {
      total: requests.length,
      surfacePerMemberRequest,
      teamCallsIssued,
      results: results.map((r) => ({ seq: r.seq, tool: r.tool, isError: r.isError, head: redact(r.text).slice(0, 300) })),
      createDenyText: redact(createDenyText).slice(0, 2000),
    }
    evidence.guardFacts = guardFacts
    evidence.witnesses = witnesses

    // ── verdicts ───────────────────────────────────────────────────────────
    const memberARequest = surfacePerMemberRequest.find((s) => s.token === TOK_D1) ?? null
    const wiredOk = bootInfo !== null
      && hostAlive()
      && memberARequest !== null
      && memberARequest.readCount === 1
    add('live:booted-member-a5sf-wired', wiredOk ? 'PASS' : 'FAIL', {
      hostAlive: hostAlive(),
      memberRequestSeen: memberARequest !== null,
      readVisibleCount: memberARequest?.readCount ?? null,
      surfaceSize: memberARequest?.surfaceSize ?? null,
      surface: memberARequest?.surface ?? null,
      note: 'a managed Member ran a model turn whose surface carried exactly ONE native `read` while the row config carried a5sfEvidencePath + a5sfNativeToolModules',
    })

    const outsideRefused = outsideReads.some((r) => r.isError === true && /IO_READ_DENIED/.test(r.text))
    const outsideLeak = outsideClaimInAnyResult.length > 0
    add('live:native-read-outside-refused', outsideRefused && !outsideLeak ? 'PASS' : 'FAIL', {
      outsideReadSeen: outsideReads.length > 0,
      refusedWithIoReadDenied: outsideRefused,
      outsideClaimLeaked: outsideLeak,
      observed: outsideReads.map((r) => ({ isError: r.isError, head: redact(r.text).slice(0, 240) })),
      note: 'the model issued `read` on a path outside the compiled ceiling and the Guard refused it before any byte was returned',
    })

    const oneDenyFact = outsideFacts.length === 1 && denyFacts.length === 1 && denyFacts[0]?.decidedBy === 'IO_READ_DENIED'
    add('live:sink-exactly-one-deny-fact', oneDenyFact ? 'PASS' : 'FAIL', {
      sinkExists: sinkRows !== null,
      totalGuardFacts: guardFacts.length,
      outsideFacts: outsideFacts.length,
      denyFacts: denyFacts.length,
      fact: denyFacts[0] ?? null,
      note: 'the product sink (a5sfEvidencePath), not the model transcript, is the witness',
    })

    const insideOk = insideReads.some((r) => r.isError !== true && r.text.includes(INSIDE_CLAIM))
    const insideFact = insideFacts.some((f) => f.decision === 'allow')
    add('live:native-read-inside-allowed', insideOk && insideFact ? 'PASS' : 'FAIL', {
      insideReadSeen: insideReads.length > 0,
      insideClaimReturned: insideClaimInAnyResult.length > 0,
      allowedFactWritten: insideFact,
      observed: insideReads.map((r) => ({ isError: r.isError, head: redact(r.text).slice(0, 240) })),
      note: 'the same native `read` inside the ceiling returned the planted bytes and its consultation was recorded as allow',
    })

    const denyNativeLoud = createDenyResults.length > 0
      && createDenyResults.every((r) => r.isError === true)
      && /surface|builtinToolDeny|read|coverage/i.test(createDenyText)
    const attachRefusal = /would CHANGE the Member's model-visible tool surface/.test(createDenyText)
    add('live:builtin-deny-native-fails-loud', denyNativeLoud ? 'PASS' : 'FAIL', {
      createMemberResultSeen: createDenyResults.length > 0,
      isError: createDenyResults.map((r) => r.isError),
      a5sfSurfaceRefusal: attachRefusal,
      text: redact(createDenyText).slice(0, 1200),
      note: attachRefusal
        ? "the a5sf attach itself refused (route C's surface-neutrality law)"
        : 'the setup failed loudly, but the observed refusal text is NOT the a5sf surface-neutrality refusal — reported verbatim, not upgraded',
    })

    // C2(b): teardown / runtime revoke. Archive A already ran (leader phase);
    // judge what the product actually exposes.
    const archiveCalls = teamCallsIssued.filter((c) => c.name === 'team_archive_member')
    const archiveResult = results.filter((r) => r.tool === 'team_archive_member')
    const factsAfterArchive = existsSync(sinkPath)
      ? readFileSync(sinkPath, 'utf8').split('\n').filter((l) => l.trim() !== '').length
      : 0
    evidence.teardown = {
      archiveCalls: archiveCalls.length,
      archiveResults: archiveResult.map((r) => ({ isError: r.isError, head: redact(r.text).slice(0, 400) })),
      sinkRowsAtEnd: factsAfterArchive,
      hostAlive: hostAlive(),
      disposeLines: witnesses.disposeLines,
      a5sfErrorLines: witnesses.a5sfLines.filter((l) => /fail|error|refus/i.test(l)),
    }
    add('live:teardown-no-shadow', 'NOT_REACHED', {
      reason: 'NO_OBSERVABLE_SEAM_FOR_A_DEAD_SCOPE',
      archiveCalls: archiveCalls.length,
      archiveOk: archiveResult.some((r) => r.isError !== true),
      sinkRowsAtEnd: factsAfterArchive,
      hostAlive: hostAlive(),
      disposeLines: witnesses.disposeLines,
      note: 'The Member was stopped through the product lifecycle (team_archive_member) and the host stayed alive with no realm-dispose fault line, but no host-exposed seam reports a residual shadow on the disposed agent scope. Route C §5(b)\'s fail-open (realm disposed while the agent lives) has no model-reachable revoke path in this boot; see live:runtime-revoke-reachable.',
    })
    add('live:runtime-revoke-reachable', 'NOT_REACHED', {
      reason: 'NO_A5SF_RUNTIME_REVOKE_SEAM',
      note: 'The 15 team tools expose no a5sf revoke; team_grant_permission_rule/team_revoke_permission_rule are the Alpha.4 permission-rule lane and do not re-evaluate a mounted a5sf realm. The only a5sf revoke is the row teardown (realm.dispose), which co-terminates with the agent on archive. This is the seam gap the next boot/lane must close before §5(b) can be pinned live.',
    })

    // persist per-run evidence JSONs
    writeFileSync(join(HERE, 'transcript.json'), JSON.stringify({
      surface,
      denyList,
      surfacePerMemberRequest,
      teamCallsIssued,
      results: evidence.requests.results,
      createDenyText: evidence.requests.createDenyText,
    }, null, 2) + '\n')
    writeFileSync(join(HERE, 'guard-facts.json'), JSON.stringify({ sinkPath, guardFacts, outsideFacts, insideFacts }, null, 2) + '\n')
    writeFileSync(join(HERE, 'host-witnesses.json'), JSON.stringify(witnesses, null, 2) + '\n')
    record.record.evidence = {
      worldId: world.id,
      outside,
      inside,
      sinkPath,
      sinkSha256: consulting.sha256,
      hostLogPath: bootInfo.logPath,
      surface,
      denyList,
      guardFacts: guardFacts.length,
    }
  } catch (error) {
    failure = error
    log(`RUN FAILED: ${String(error?.stack ?? error)}`)
    for (const id of CASES) {
      if (record.getCase(id) === undefined) add(id, 'FAIL', { reason: 'RUN_ABORTED', detail: redact(String(error?.message ?? error)).slice(0, 600) })
    }
  } finally {
    try {
      if (world !== null) teardown = await world.teardown()
      log(`teardown: ${JSON.stringify(teardown ?? null).slice(0, 800)}`)
    } catch (error) {
      log(`teardown error: ${String(error?.message ?? error)}`)
    }
    const ledgerRows = parseLedger(LEDGER_PATH)
    writeFileSync(join(HERE, 'ledger-rows.json'), JSON.stringify({
      ledgerPath: LEDGER_PATH,
      rowCount: ledgerRows.length,
      rows: ledgerRows,
    }, null, 2) + '\n')
    log(`ledger rows (${String(ledgerRows.length)}): ${ledgerRows.map((r) => `${String(r.kind ?? r.phase ?? '?')}:${String(r.grantId ?? r.world ?? '')}`).join(' | ')}`)
    const finalized = record.finalize()
    writeFileSync(join(HERE, 'run-record.json'), JSON.stringify(finalized, null, 2) + '\n')
    const summary = formatSummary(finalized)
    log(summary)
    log(`bootsSpent=${String(lease.bootsSpent())} overall=${String(overallVerdict(finalized.cases))} failure=${failure === null ? 'none' : redact(String(failure.message)).slice(0, 400)}`)
  }
  if (failure !== null) process.exitCode = 1
}

if (PLAN_ONLY) {
  await planOnly()
} else {
  rmSync(RUN_LOG, { force: true })
  await boot()
}
