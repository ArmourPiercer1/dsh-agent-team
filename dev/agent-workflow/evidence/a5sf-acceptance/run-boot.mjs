#!/usr/bin/env node
/**
 * run-boot.mjs — the SIX-ROW ACCEPTANCE BOOT (the last reserved P2-01 Host
 * start), run after the P0 admission-gate merge (`6d1b7a1fb`, PR #574).
 *
 * WHAT THIS SPENDS: exactly ONE Host start, charged through the BL-14
 * pre-registration gate (`tests/world-factory/suites/150-a5sf-read.mjs#
 * preRegisterReadBudget`), against allocation item "P2-01 live read (BL-14 /
 * G2 live half)". Per `dev/agent-workflow/budgets/a5sf-boot-pool-20261103.json`
 * that item holds 3 boots: boot 1 (`a5sf-live-native/`) reached activation and
 * was REFUSED by the unscoped-ctx seam, boot 2 (`a5sf-live-native2/`) aborted at
 * Loader compose on a row-identity defect before any product code ran, boot 3
 * (`a5sf-live-native3/`) proved six points. THIS run is that item's LAST boot.
 * The pool's reserve is untouched. Order: grant (bound to THIS tree's HEAD) ->
 * intent row -> lease.boot() -> start row -> spawn.
 *
 * WHAT IT ASKS — six acceptance rows, each PROVEN / REFUTED / NOT_REACHED with
 * captured output:
 *
 *   row 1  read A (inside the ceiling AND inside the narrower binding
 *          restriction) -> succeeds, bytes match, allow facts present;
 *   row 2  read B (inside the ceiling, OUTSIDE the binding restriction) ->
 *          refused by the BINDING lane with EXACTLY ONE deny fact carrying
 *          `realm:"binding"` and `toolBindingIdentity:"dsh.fs/read"`;
 *   row 3  read C (OUTSIDE the ceiling, inside the restriction) -> refused, and
 *          the refusal shows NO WIDENING by the binding lane (the lane report's
 *          product-algebra dispositions are the witness: ceiling deny,
 *          restriction allow, effective deny);
 *   row 4  native `write` to B -> succeeds on the ceiling lane, and NO read-lane
 *          fact appears for it (the sibling lane is not contaminated);
 *   row 5  POST-INVALIDATION managed call: a live surface change invalidates the
 *          shadow (a tool registered through the public `tools.register` seam
 *          after the settle window), then the SAME out-of-lane read -> refused
 *          with `A5SF_NATIVE_SHADOW_INVALIDATED`, forbidden bytes NOT returned.
 *          This is the first live-Host test of `NoStaleShadow !=
 *          NoUnconfinedExecution` (the P0 merge);
 *   row 6  teardown: after the Member is stopped/archived, is there a usable
 *          but unconstrained shadow, an orphan process, or an unsettled call -
 *          reported through the exact seams that were observed (and NOT_REACHED
 *          where no seam exists, rather than invented).
 *
 * WHAT IS PRODUCT AND WHAT IS FIXTURE (disclosed, never laundered):
 *   - the two-axis lane INPUTS (a ceiling allow [workspace] and a narrower
 *     `dsh.fs/read` restriction allow [workspace/axis/allow,
 *     <home>/restriction-outside]) are TEST COMPOSITION (no product code
 *     bridges a v3 blueprint to compiled ceilings at this base); the
 *     INTERSECTION and every disposition are the PRODUCT's own
 *     `intersectPathRuleSets` / `matchLocator`
 *     (`member-io-policy/src/path-rules.ts`), and the GUARD + binding-realm
 *     installer are the SHIPPED ones (`team-services/src/install.ts`).
 *   - the `teamA5sfRealm` provider is supplied by ONE evidence row
 *     (`a5sf-realm-provider-row.mjs`) because no product code provides that
 *     service at this base (grep: only the consumer in `host.ts`).
 *   - the ROW 5 TRIGGER (an HTTP route that registers one unrelated tool on
 *     demand) is a test fixture; the INVALIDATION + DENY behaviour it triggers
 *     is the product's. No product code registers a tool late in normal
 *     operation, and the tool is never dispatched to.
 *   - the provider counter is test instrumentation (the shipped host `fs`
 *     provider has no counter of its own). It distinguishes the BASE instance
 *     from the isolated confined instances; it cannot prove "the binding realm
 *     served it" beyond the instance identity + the fact's realm.
 *
 * MODES
 *   node run-boot.mjs --identity-check <row file...>
 *        the lane's pre-boot composition precondition (no World, no gate, no
 *        ledger row, no spawn). Exit 0 = PASS.
 *   node run-boot.mjs --plan
 *        host-free preflight: blueprint validation with the HOST's own domain
 *        facade, patch emission, row-identity check. NO gate, NO row, NO spawn.
 *   node run-boot.mjs
 *        the ONE boot.
 *
 * @module dev/agent-workflow/evidence/a5sf-acceptance/run-boot
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
  tcpConnectProbe,
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
const COUNTER_NAME = 'a5sf-provider-counter.jsonl'
const LATE_REPORT_NAME = 'late-tool-report.json'
const LANE_REPORT_NAME = 'lane-report.json'
const EVIDENCE_ROW = join(HERE, 'a5sf-realm-provider-row.mjs')

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
/** The host's OWN tools package — `defineContentToolFixture` for the row 5
 *  trigger (a pure definition factory; no second registry). */
const HOST_TOOLS_LIB = join(HOST_TREE, 'packages', 'core', 'tools', 'lib', 'index.js')

const LINE = 'a5sfacc'
const ROOT = 'session-a5sf-acceptance-root'
const CREATE_ROOT = 'session-a5sf-acceptance-team'
const BP_ANCHOR_ID = 'team.a5sf.acceptance.anchor'
const BP_MAIN_ID = 'team.a5sf.acceptance.main'
const PRESET_ID = 'a5sf-acceptance-base'

const MK_DISC = 'A5SF_ACC_DISC'
const MK_L1 = 'A5SF_ACC_L1_DRIVE'
const TOK_D1 = 'a5sfacc-d1'
/** The exact prefix the glue writes onto a member's work notice. Only a MEMBER
 *  request carries it; the leader's own settled note is `[team-work-settled
 *  requestToken=…]` and must not match. */
const MEMBER_ENVELOPE = '[team-work requestToken='
const DONE_D1 = 'A5SF_ACC_D1_DONE'
const DONE_L1 = 'A5SF_ACC_L1_DONE'

const MANAGED_TOOL_NAMES = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh']
const SAFE_UNMANAGED_TOOL_NAMES = ['todo_write']
/** The read tool's own description — used only to count prompt/section duplication. */
const READ_DESCRIPTION = 'Read a UTF-8 text file and return line-numbered content.'
const READ_SECTION_TEXT = 'Use the read tool — not shell commands like cat'
/** The product's typed refusal code the P0 admission gate materialises. */
const INVALIDATED_CODE = 'A5SF_NATIVE_SHADOW_INVALIDATED'
const BINDING_IDENTITY = 'dsh.fs/read'
const LATE_TOOL_ROUTE = '/__a5sf/late-tool'

/** The six acceptance rows + one precondition case (so a composition failure is
 *  never mis-read as a row failure). */
const CASES = Object.freeze([
  'live:composition-precondition-read-surface',
  'live:row1-read-a-inside-both-allowed',
  'live:row2-read-b-binding-deny-exactly-one-fact',
  'live:row3-read-c-refused-no-widening',
  'live:row4-write-b-ceiling-allowed-no-read-lane-fact',
  'live:row5-post-invalidation-refused-shadow-invalidated',
  'live:row6-teardown-no-usable-unconstrained-shadow',
])

const PLAN_ONLY = process.argv.includes('--plan')
/** `--identity-check <file...>`: run ONLY the row-identity precondition (no
 *  world, no gate, no spawn). The negative path of the guard (two file-URL rows
 *  from one package) is reproducible this way without spending a boot. */
const IDENTITY_CHECK_AT = process.argv.indexOf('--identity-check')
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
  return [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
    'leader:', '  templateId: leader',
    `  persona: ${JSON.stringify(`You are the leader of the a5sf six-row acceptance team. ${MK_L1} drives your chain: delegate the worker script once, then finish.`)}`,
    '  capabilities:', '    teamTools:', '      kind: allow', '      items:',
    '        - team_delegate', '        - team_archive_member', '        - team_follow_up',
    ...denyLines,
    '    skills:', '      kind: allow', '      items: []',
    '    mcp:', '      kind: allow', '      items: []',
    '    permissions:', '      default: deny', '      allow: []', '      ask: []', '      deny: []',
    // teardown NEEDS archive-member in the caller's mutation envelope. The
    // native3 lane measured its omission as a DRIVER defect (not a product
    // finding): the leader's archive was refused TEAM_RUNTIME_ENVELOPE_OUT_OF_BOUNDS.
    'teamEnvelope:', '  allow:', '    - create-member', '    - assign-task', '    - send-message', '    - report-progress', '    - archive-member', '  deny: []',
    'members:',
    // The a5sf-wired Member: NO capabilities block (the CI-03 population shape)
    // — its ONLY confinement is the compiled two-axis realm.
    '  - templateId: worker', '    displayName: "a5sf acceptance worker"',
    `    persona: ${JSON.stringify('You are the a5sf acceptance worker. Follow the delegated script exactly, one tool call at a time.')}`,
    'memberEnvelopes:',
    '  - templateId: worker', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
    'permissionMutationEnvelope:', '  rules: []', 'teamHardEnvelope:', '  rules: []',
    'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')
}

const BP_ANCHOR_YAML = [
  '---', 'schemaVersion: 3', `blueprintId: ${BP_ANCHOR_ID}`, 'revision: "1"',
  'leader:', '  templateId: leader',
  `  persona: ${JSON.stringify(`You are the leader of the a5sf six-row acceptance team. ${MK_DISC} is the discovery marker.`)}`,
  'members:', '  - templateId: worker', '    persona: "You are the a5sf acceptance worker."',
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

/**
 * The worker's eight-call script, one call per turn, in the row order:
 * read A -> read B -> read C -> write B -> done. Nothing else is issued by the
 * model; rows 5 and 6 are driver-initiated through the product's own dispatch
 * route (a post-invalidation call cannot be scripted from a model turn whose
 * surface the invalidation just changed).
 */
function makeDecide({ rowPaths }) {
  return function decide({ req }) {
    const allText = messagesOf(req).map(textOf).join('\n')
    const lastUser = lastUserTextOfStatic(req)
    const userText = userTextOf(req)
    if (allText.includes('Generate the session title')) return { kind: 'text', content: 'a5sf acceptance session' }
    // MEMBER LANE: the glue's own work-notice marker, exact prefix.
    if (userText.includes(`${MEMBER_ENVELOPE}${TOK_D1}`)) {
      const reads = countAssistantToolUses(req, 'read')
      const writes = countAssistantToolUses(req, 'write')
      if (reads < 1) {
        return {
          kind: 'tool-call',
          toolCalls: [{ id: 'call-a5sfacc-read-a', name: 'read', arguments: { file_path: rowPaths.a.path } }],
        }
      }
      if (reads < 2) {
        return {
          kind: 'tool-call',
          toolCalls: [{ id: 'call-a5sfacc-read-b', name: 'read', arguments: { file_path: rowPaths.b.path } }],
        }
      }
      if (reads < 3) {
        return {
          kind: 'tool-call',
          toolCalls: [{ id: 'call-a5sfacc-read-c', name: 'read', arguments: { file_path: rowPaths.c.path } }],
        }
      }
      if (writes < 1) {
        return {
          kind: 'tool-call',
          toolCalls: [{ id: 'call-a5sfacc-write-b', name: 'write', arguments: { file_path: rowPaths.b.path, content: rowPaths.b.writeContent } }],
        }
      }
      return { kind: 'text', content: `${DONE_D1} ${lastToolResultText(req).slice(0, 160)}` }
    }
    const isLeader = lastUser.includes(MK_L1)
      || allText.includes(MK_L1)
      || allText.includes('[team-work-settled')
      || allText.includes('A5SF_ACC_LEADER')
    if (isLeader) {
      const teamCalls = ['team_delegate', 'team_archive_member', 'team_follow_up']
        .map((n) => countAssistantToolUses(req, n))
        .reduce((a, b) => a + b, 0)
      if (teamCalls === 0) {
        return {
          kind: 'tool-call',
          toolCalls: [{ id: 'call-a5sfacc-delegate', name: 'team_delegate', arguments: {
            rootSessionId: CREATE_ROOT,
            requestToken: `${TOK_D1}-delegate`,
            delegationTemplateId: 'worker',
            label: 'a5sfacc-worker',
            prompt: `A5SF_ACC_WORK: run the four-call script from the acceptance evidence, one call at a time, then report.`,
            async: false,
          } }],
        }
      }
      return { kind: 'text', content: DONE_L1 }
    }
    if (lastUser.includes(MK_DISC)) return { kind: 'text', content: 'A5SF_ACC_DISC_DONE' }
    return { kind: 'text', content: 'A5SF_ACC_LIVE_NOOP' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// world material
// ─────────────────────────────────────────────────────────────────────────────

function teamRowConfig({ home }) {
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
    staticModel: { provider: 'deepseek-official', model: 'a5sf-acceptance-model' },
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
    // two-axis realm the provider row supplies.
  }
}

function rowPathsOf({ home, workspaceDir }) {
  const workspace = realpathSync(workspaceDir)
  return {
    workspace,
    a: { path: join(workspace, 'axis', 'allow', 'a.txt') },
    b: { path: join(workspace, 'axis', 'b.txt') },
    c: { path: join(home, 'restriction-outside', 'c.txt') },
    restrictionReadAllow: [
      join(workspace, 'axis', 'allow'),
      join(home, 'restriction-outside'),
    ],
  }
}

function rowsFor({ home, workspaceDir }) {
  const dist = join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime')
  const PRODUCTION_ROW = pathToFileURL(join(dist, 'src', 'plugin', 'host.js')).href
  const P6T6_ROW = pathToFileURL(join(REPO_ROOT, 'packages', 'tools', 'harness', 'plugin.mjs')).href
  const providerRow = pathToFileURL(EVIDENCE_ROW).href
  const paths = rowPathsOf({ home, workspaceDir })
  const config = teamRowConfig({ home })
  const basePlugins = [...smokePresetPlugins({
    personaText: 'You are a coding agent powered by the {{model}} model.',
    cwdSuffix: 'Your working directory is {{cwd}}.',
    bashDescription: 'Run commands in a bash shell. State is persistent across calls.',
  }), { id: 'tool-fs-search', name: '@deepseek-ai/dsh-tool-fs-search', config: { sampleOverCapGlobResults: false } }]
  return {
    paths,
    rows: [
      // ONE evidence row (the host's client-modules registry refuses two
      // file-URL rows that resolve to the same repo-root package). It MUST
      // mount before the Team row so `ctx.get('teamA5sfRealm')` resolves when
      // the first Member setup runs (sibling service, app-wide registry).
      { id: 'a5sf-acceptance-realm', name: providerRow, config: {
        allowRoot: paths.workspace,
        restrictionReadAllow: paths.restrictionReadAllow,
        bindingIdentity: BINDING_IDENTITY,
        laneReportPath: join(home, LANE_REPORT_NAME),
        laneProbePaths: [paths.a.path, paths.b.path, paths.c.path],
        counterPath: join(home, COUNTER_NAME),
        // row 5's test-composition trigger (see the driver + row module docs)
        lateToolRoute: LATE_TOOL_ROUTE,
        lateToolName: 'x_acceptance_late_unrelated',
        lateToolReportPath: join(home, LATE_REPORT_NAME),
        hostToolsModule: pathToFileURL(HOST_TOOLS_LIB).href,
      } },
      { id: 'dsh-agent-team', name: PRODUCTION_ROW, config },
      { id: 'p6t6-team-tools', name: P6T6_ROW },
      presetDeclarationRow({
        id: PRESET_ID,
        displayName: 'a5sf acceptance base',
        description: `a5sf six-row acceptance boot preset (${LINE}) = smoke + tool-fs-search`,
        plugins: basePlugins,
      }),
    ],
    config,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// pre-boot composition guard (NO ledger row, NO spawn)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The host's client-modules registry refuses two file-URL profile rows whose
 * nearest package.json is the SAME package that declares a client half:
 *   `package dsh-agent-team resolves from multiple active Loader sources: …;
 *    remove one entry`
 * (that is what spent the 2026-11-03T13:02:54Z boot,
 * `evidence/a5sf-live-native2/`). This check reproduces the rule cheaply over
 * the exact rows the boot WOULD mount, so the class can never spend a start.
 */
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
    const entry = { rowId: String(row.id), modulePath, packageName: pkg?.name ?? null, packagePath: pkgPath, hasClientHalf: pkg?.dsh?.client !== undefined }
    checked.push(entry)
    if (entry.hasClientHalf !== true) continue
    const key = entry.packagePath
    const list = byPackage.get(key) ?? []
    list.push(entry)
    byPackage.set(key, list)
  }
  for (const [pkgPath, list] of byPackage) {
    if (list.length > 1) {
      return {
        ok: false,
        reason: 'DUPLICATE_CLIENT_PACKAGE_SOURCES',
        detail: `package ${String(list[0].packageName)} (${String(pkgPath)}) would be sourced from ${String(list.length)} file-URL rows: ${list.map((e) => e.rowId).join(', ')} — the host client-modules registry refuses this ("remove one entry")`,
        sources: list,
      }
    }
  }
  return { ok: true, rows: checked }
}

// ─────────────────────────────────────────────────────────────────────────────
// the run helpers
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

function parseJsonl(path) {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8').split('\n').filter((l) => l.trim() !== '').map((line) => {
    try {
      return JSON.parse(line)
    } catch {
      return { unparseable: line.slice(0, 200) }
    }
  })
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

/** Facts about ONE locator (the sink is the product's own transport). */
function factsFor(facts, locator) {
  const base = basenameOf(locator)
  return facts.filter((f) => String(f?.locator ?? '') === locator || String(f?.locator ?? '').endsWith(`/${base}`))
}

async function planOnly() {
  log(`PLAN MODE — no gate, no ledger row, no spawn. repo=${REPO_ROOT} hostTree=${HOST_TREE}`)
  const head = resolveHeadCommit(REPO_ROOT)
  log(`HEAD=${String(head)} pinnedHost=${TEST_USE_BASELINE_SHA}`)
  log(`host tool-fs module: ${HOST_TOOL_FS} exists=${existsSync(HOST_TOOL_FS)}`)
  log(`host tools lib: ${HOST_TOOLS_LIB} exists=${existsSync(HOST_TOOLS_LIB)}`)
  const anchor = assertBlueprintText(BP_ANCHOR_YAML, BP_ANCHOR_ID, 1, 'anchor.yaml')
  const main = assertBlueprintText(mainBlueprintYaml(['u6fs_probe', 'read']), BP_MAIN_ID, 1, 'main.yaml')
  log(`blueprint ingest: anchor=${JSON.stringify(anchor)} main=${JSON.stringify(main)}`)
  const factory = new TestWorldFactory({ repoRoot: REPO_ROOT, evidenceRoot: HERE, hostTree: HOST_TREE })
  factory.assertHostBase('plan')
  const world = await factory.createWorld({ line: LINE, u6Fs: { rows: [] } })
  try {
    const { rows, paths } = rowsFor({ home: world.home, workspaceDir: world.workspaceDir })
    const patch = emitPatchLayer([
      'a5sf six-row acceptance boot: two-axis realm provider row + production Team row',
      'with a5sfEvidencePath + a5sfNativeToolModules + p6t6 + preset declaration.',
    ], rows)
    log(`patch layer bytes=${patch.length}; rows=${rows.map((r) => r.id).join(',')}`)
    log('---- patch layer ----\n' + patch + '\n---- end patch ----')
    const provider = await import(pathToFileURL(EVIDENCE_ROW).href)
    log(`provider row module: name=${provider.name} apply=${typeof provider.apply} inject=${JSON.stringify(provider.inject)}`)
    log(`row paths: ${JSON.stringify(paths)}`)
    const identity = rowIdentityCheck(rows)
    log(`pre-boot row identity check: ${JSON.stringify(identity)}`)
    if (identity.ok !== true) throw new Error(`row composition refused in plan: ${identity.reason}: ${identity.detail}`)
    // The lane report is emitted by the ROW at apply time; the plan mode cannot
    // run it, so the same product algebra is exercised here to make a lane-shape
    // defect visible BEFORE the boot.
    const pathRules = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'member-io-policy', 'src', 'path-rules.js')).href)
    const workspace = realpathSync(world.workspaceDir)
    const ceilingRead = { mode: 'restricted', allow: [workspace], ask: [], deny: [] }
    const restrictionRead = { mode: 'restricted', allow: paths.restrictionReadAllow, ask: [], deny: [] }
    const effectiveRead = pathRules.intersectPathRuleSets(ceilingRead, restrictionRead)
    log(`lane algebra: ceiling=${JSON.stringify(ceilingRead.allow)} restriction=${JSON.stringify(restrictionRead.allow)} effective=${JSON.stringify(effectiveRead.allow)}`)
    log(`lane dispositions: ${JSON.stringify([paths.a.path, paths.b.path, paths.c.path].map((locator) => ({
      locator,
      ceiling: pathRules.matchLocator(ceilingRead, locator),
      restriction: pathRules.matchLocator(restrictionRead, locator),
      effective: pathRules.matchLocator(effectiveRead, locator),
    })))}`)
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
  if (!existsSync(HOST_TOOLS_LIB)) throw new Error(`the host tools package is missing: ${HOST_TOOLS_LIB}`)

  // ── composition precondition: never spend a start on a row-identity defect ──
  const dryRun = rowsFor({ home: join(HERE, '.rowcheck'), workspaceDir: HERE })
  const identity = rowIdentityCheck(dryRun.rows)
  log(`pre-boot row identity check: ${JSON.stringify(identity).slice(0, 800)}`)
  if (identity.ok !== true) {
    throw new Error(`row composition refused before any ledger row: ${identity.reason}: ${identity.detail}`)
  }

  // ── the per-run grant, bound to the EXACT HEAD this run executes on ──────
  const grant = {
    grantId: `grant-a5sf-acceptance-${head.slice(0, 12)}`,
    maxStarts: 2,
    grantedBy: 'user ruling 2026-11-03 a5sf-boot-pool-20261103-user-20 — allocation item "P2-01 live read (BL-14 / G2 live half)", which holds 3 boots. This is that item\'s LAST boot: boot 1 (evidence/a5sf-live-native/) was refused at activation by the unscoped-ctx seam; boot 2 (evidence/a5sf-live-native2/) aborted at Loader compose on a composition defect; boot 3 (evidence/a5sf-live-native3/) proved the confined native read and left the teardown seam open. The +6 RCA reserve is NOT touched.',
    allocationItem: 'P2-01 live read (BL-14 / G2 live half)',
    boundCommit: head,
    note: 'maxStarts = 1 pre-registration (intent) row + 1 boot (the BL-14 gate counts shared-ledger rows, not spawns)',
  }
  writeFileSync(GRANT_PATH, JSON.stringify(grant, null, 2) + '\n')
  log(`grant materialised: ${GRANT_PATH} maxStarts=${grant.maxStarts} boundCommit=${grant.boundCommit} item=${grant.allocationItem}`)

  const runId = `a5sf-acceptance-${new Date().toISOString().replace(/[:.]/g, '-')}`
  const record = createRunRecord({
    runId,
    suite: 'a5sf-acceptance',
    selectedCases: CASES,
    bindings: {
      teamSha: head,
      hostSha: TEST_USE_BASELINE_SHA,
      hostTree: HOST_TREE,
      line: LINE,
      sink: 'world-home a5sf-consult.jsonl (copy: consultations.jsonl)',
      grantId: grant.grantId,
      allocationItem: grant.allocationItem,
      providerComposition: 'test row dev/agent-workflow/evidence/a5sf-acceptance/a5sf-realm-provider-row.mjs (no product provider exists at this base)',
      laneAlgebra: 'packages/runtime/member-io-policy/src/path-rules.ts # intersectPathRuleSets (the product algebra; the lane INPUTS are fixtures)',
      providerCounter: 'installed by the SAME evidence row (config.counterPath): the shipped host fs has no counter; in-memory prototype wrap, pass-through',
      lateToolTrigger: 'test-composition HTTP route in the same evidence row: registers ONE unrelated tool through the public tools.register seam on demand (the invalidation it triggers is the product behaviour)',
      worldReuse: 'dev/agent-workflow/evidence/a5sf-live-native3/run-boot.mjs world/heater, with the corrections documented in the README',
    },
    ledgerPath: LEDGER_PATH,
  })

  const harness = createA5sfHarness({
    repoRoot: REPO_ROOT,
    evidenceRoot: HERE,
    suite: 'a5sf-acceptance',
    line: LINE,
    runRecord: record,
    maxHostStarts: grant.maxStarts,
    hostTree: HOST_TREE,
  })
  const factory = harness.factory
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
    log(`case ${id}: ${verdict} ${JSON.stringify(detail).slice(0, 500)}`)
  }

  const world = await harness.createWorld({ line: LINE, u6Fs: { rows: [] } })
  const { paths: rowPaths } = rowsFor({ home: world.home, workspaceDir: world.workspaceDir })
  const claimA = `A5SF_ACC_A_${world.id}`
  const claimB = `A5SF_ACC_B_${world.id}`
  const claimC = `A5SF_ACC_C_${world.id}`
  const writeContent = `A5SF_ACC_WRITE_${world.id}\n`
  rowPaths.b.writeContent = writeContent
  const sinkPath = join(world.home, 'a5sf-consult.jsonl')
  const counterPath = join(world.home, COUNTER_NAME)
  const laneReportPath = join(world.home, LANE_REPORT_NAME)
  const lateReportPath = join(world.home, LATE_REPORT_NAME)
  let bootInfo = null
  let teardown = null
  let failure = null
  const evidence = {
    worldId: world.id,
    rows: {
      a: { path: rowPaths.a.path, claim: claimA, lane: 'inside ceiling AND inside the binding restriction' },
      b: { path: rowPaths.b.path, claim: claimB, writeContent, lane: 'inside ceiling, OUTSIDE the binding restriction' },
      c: { path: rowPaths.c.path, claim: claimC, lane: 'OUTSIDE the ceiling, inside the binding restriction' },
    },
    sinkPath,
    counterPath,
    laneReportPath,
  }

  try {
    const { rows, config } = rowsFor({ home: world.home, workspaceDir: world.workspaceDir })
    mkdirSync(config.blueprintDir, { recursive: true })
    writeFileSync(join(config.blueprintDir, 'anchor.yaml'), BP_ANCHOR_YAML)
    writeFileSync(join(config.blueprintDir, 'main.yaml'), mainBlueprintYaml([]))
    writeFileSync(join(world.home, 'p6t6-directive.json'), JSON.stringify({
      boot: 1, phase: 'create', reportDir: world.logDir, runStamp: world.id, rootSessionId: ROOT,
    }, null, 2))
    assertBlueprintText(BP_ANCHOR_YAML, BP_ANCHOR_ID, 1, 'anchor.yaml')
    mkdirSync(dirname(rowPaths.a.path), { recursive: true })
    mkdirSync(dirname(rowPaths.c.path), { recursive: true })
    writeFileSync(rowPaths.a.path, `${claimA}\n`)
    writeFileSync(rowPaths.c.path, `${claimC}\n`)
    log(`planted A=${rowPaths.a.path} (${claimA}); C=${rowPaths.c.path} (${claimC}); B=${rowPaths.b.path} (not created; written by row 4)`)
    log(`rows: ${rows.map((r) => r.id).join(',')}`)
    log(`team row a5sfEvidencePath=${String(config.a5sfEvidencePath)} a5sfNativeToolModules=${JSON.stringify(config.a5sfNativeToolModules)}`)
    log(`provider counter ledger: ${counterPath}`)
    world.u6Fs.rows.push(...rows)

    await world.startMock({ decide: makeDecide({ rowPaths }) })
    log(`mock started on ${String(world.mock?.port)}`)

    // ── BOOT 1 of 1: intent row (written) -> start row -> spawn ────────────
    bootInfo = await lease.boot(() => harness.boot({ world, phase: 'a5sf-acceptance-boot1', bootTimeoutMs: 180_000 }))
    log(`BOOTED port=${bootInfo.port} (lease bootsSpent=${lease.bootsSpent()}) log=${bootInfo.logPath}`)
    record.record.boots = [{ phase: 'a5sf-acceptance-boot1', world: world.id, port: bootInfo.port, logPath: bootInfo.logPath }]

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
    log(`p6t6 health=${String(healthOk)} hostAlive=${String(hostAlive())}`)
    const stateOk = await waitFor(async () => {
      const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
      return st.status === 200 && st.body?.rootSessionId === ROOT && st.body?.teamSession !== null
    }, 90_000)
    log(`p6t6 state (rootSessionId=${ROOT}, teamSession!=null)=${String(stateOk)}`)

    // discovery -> the model-visible surface -> the real main blueprint
    const discPrompt = await apiPrompt(origin, cookie, ROOT, MK_DISC, 'a5sfacc')
    log(`discovery prompt status=${String(discPrompt.status)}`)
    const surfaceOk = await waitFor(() => (world.mock?.requests ?? []).some((r) => hasMarker(r, MK_DISC) && surfaceNamesOf(r).length > 0), 150_000)
    if (!surfaceOk) throw new Error('discovery model request with a tool surface never arrived')
    const discoveryRequest = (world.mock?.requests ?? []).filter((r) => hasMarker(r, MK_DISC) && surfaceNamesOf(r).length > 0).sort((a, b) => surfaceNamesOf(b).length - surfaceNamesOf(a).length)[0]
    const surface = [...new Set(surfaceNamesOf(discoveryRequest))].sort()
    const discoveryReadSchemas = surfaceNamesOf(discoveryRequest).filter((n) => n === 'read').length
    const discoveryPromptText = JSON.stringify(messagesOf(discoveryRequest).filter((m) => m?.role === 'system').map((m) => m.content ?? ''))
    const discoveryReadMentions = discoveryPromptText.split(READ_DESCRIPTION).length - 1
    const discoveryReadSectionMentions = discoveryPromptText.split(READ_SECTION_TEXT).length - 1
    const denyList = surface.filter((n) => !String(n).startsWith('team_') && !MANAGED_TOOL_NAMES.includes(n) && !SAFE_UNMANAGED_TOOL_NAMES.includes(n))
    log(`model-visible surface (${String(surface.length)}): ${surface.join(',')}`)
    log(`discovery read schemas=${String(discoveryReadSchemas)} prompt read-description mentions=${String(discoveryReadMentions)} prompt tool:read section mentions=${String(discoveryReadSectionMentions)}`)
    log(`builtinToolDeny base list: ${denyList.join(',')}`)
    const mainText = mainBlueprintYaml(denyList)
    assertBlueprintText(mainText, BP_MAIN_ID, 1, 'main.yaml')
    writeFileSync(join(config.blueprintDir, 'main.yaml'), mainText)
    log('main blueprint written and validated by the host facade')

    const created = await remoteCall(fetchJson, origin, cookie, 'team.create', {
      rootSessionId: CREATE_ROOT,
      blueprintId: BP_MAIN_ID,
      initialWork: { prompt: MK_L1 },
    }, 'a5sfacc')
    const createOk = created.status === 200 && created.body?.result?.ok === true
    log(`team.create status=${String(created.status)} ok=${String(createOk)} ${redact(JSON.stringify(created.body ?? null)).slice(0, 400)}`)
    if (!createOk) throw new Error(`team.create failed: status=${String(created.status)} body=${redact(JSON.stringify(created.body ?? null)).slice(0, 300)}`)

    // ── drive: the leader chain is synchronous (async:false delegate) ──────
    const replySeen = (content) => (world.mock?.requests ?? []).some((r) => r.reply?.kind === 'text' && String(r.reply.content ?? '').startsWith(content))
    const d1Ok = await waitFor(() => replySeen(DONE_D1), 300_000)
    const chainOk = await waitFor(() => replySeen(DONE_L1), 180_000)
    log(`worker D1 turn closed (${DONE_D1})=${String(d1Ok)} leader chain closed (${DONE_L1})=${String(chainOk)}`)
    // Give the last tool result one beat to land in the mock corpus + the sink.
    await new Promise((r) => setTimeout(r, 1500))

    // ── evidence collection (rows 1-4) ──────────────────────────────────────
    const requests = world.mock?.requests ?? []
    const callsById = new Map()
    const resultsByCall = new Map()
    const resultsNoId = []
    for (const r of requests) {
      for (const m of messagesOf(r)) {
        if (m?.role === 'assistant' && Array.isArray(m.content)) {
          for (const b of m.content) {
            if (b?.type === 'tool_use') {
              if (!callsById.has(b.id)) callsById.set(b.id, { callId: b.id, seq: r.seq, name: b.name, args: b.input ?? b.arguments ?? null })
            }
          }
        }
      }
      for (const m of messagesOf(r)) {
        for (const b of Array.isArray(m?.content) ? m.content : []) {
          if (b?.type === 'tool_result') {
            const entry = {
              seq: r.seq,
              callId: b.tool_use_id ?? null,
              isError: b.is_error === true,
              text: (Array.isArray(b.content) ? b.content : []).map((c) => c?.text ?? '').join(''),
            }
            if (entry.callId !== null) resultsByCall.set(entry.callId, entry)
            else resultsNoId.push(entry)
          }
        }
        if (m?.role === 'tool') {
          const entry = {
            seq: r.seq,
            callId: m.tool_call_id ?? null,
            isError: m.is_error === true,
            text: String(m.content ?? ''),
          }
          if (entry.callId !== null) resultsByCall.set(entry.callId, entry)
          else resultsNoId.push(entry)
        }
      }
    }
    const calls = [...callsById.values()]
    const results = [...resultsByCall.values(), ...resultsNoId].map((r) => ({ ...r, tool: callsById.get(r.callId)?.name ?? null }))
    const readCalls = calls.filter((c) => c.name === 'read')
    const writeCalls = calls.filter((c) => c.name === 'write')
    const callFor = (path) => readCalls.find((c) => String(c.args?.file_path ?? '') === path) ?? null
    const callA = callFor(rowPaths.a.path)
    const callB = callFor(rowPaths.b.path)
    const callC = callFor(rowPaths.c.path)
    const writeCall = writeCalls.find((c) => String(c.args?.file_path ?? '') === rowPaths.b.path) ?? null
    const resultOf = (call) => (call === null ? null : results.find((r) => r.callId === call.callId) ?? null)
    const resultA = resultOf(callA)
    const resultB = resultOf(callB)
    const resultC = resultOf(callC)
    const resultWrite = resultOf(writeCall)

    const memberRequests = requests.filter((r) => userTextOf(r).includes(`${MEMBER_ENVELOPE}${TOK_D1}`))
    const surfacePerMemberRequest = memberRequests.map((r) => {
      const names = surfaceNamesOf(r)
      return {
        seq: r.seq,
        readSchemas: names.filter((n) => n === 'read').length,
        surfaceSize: names.length,
        duplicateNames: names.length !== new Set(names).size,
        surface: names,
        systemPromptReadMentions: JSON.stringify(messagesOf(r).filter((m) => m?.role === 'system').map((m) => m.content ?? '')).split(READ_DESCRIPTION).length - 1,
        systemPromptReadSectionMentions: JSON.stringify(messagesOf(r).filter((m) => m?.role === 'system').map((m) => m.content ?? '')).split(READ_SECTION_TEXT).length - 1,
      }
    })

    // the sink (the product's own transport, not the model transcript)
    const sinkRows = parseJsonl(sinkPath)
    const sinkExists = existsSync(sinkPath)
    const guardFacts = sinkRows.filter((f) => f?.schema === 'a5sf-guard-consult/1')
    const factsA = factsFor(guardFacts, rowPaths.a.path)
    const factsB = factsFor(guardFacts, rowPaths.b.path)
    const factsC = factsFor(guardFacts, rowPaths.c.path)
    const bindingFacts = guardFacts.filter((f) => f.realm === 'binding' && f.toolBindingIdentity === BINDING_IDENTITY)
    log(`sink=${sinkPath} exists=${String(sinkExists)} rows=${String(sinkRows.length)} guardFacts=${String(guardFacts.length)} A=${String(factsA.length)} B=${String(factsB.length)} C=${String(factsC.length)} bindingLane=${String(bindingFacts.length)}`)
    for (const f of guardFacts) log(`  fact ${JSON.stringify(f).slice(0, 460)}`)

    const consulting = writeConsultCopy(sinkPath)
    evidence.consultations = consulting
    log(`consultations.jsonl ${consulting.copied ? 'copied' : 'ABSENT'} sha256=${String(consulting.sha256)} bytes=${String(consulting.bytes)}`)

    // the provider counter (test instrumentation, disclosed)
    const counterRows = parseJsonl(counterPath)
    const counterInstalled = counterRows.find((r) => r.leg === 'counter-installed') ?? null
    const readRows = counterRows.filter((r) => r.leg === 'read-call')
    const writeRows = counterRows.filter((r) => r.leg === 'write-call')
    const rowsForPath = (list, path) => list.filter((r) => String(r.path ?? '') === path)
    log(`counter installed=${JSON.stringify(counterInstalled)} readRows=${String(readRows.length)} writeRows=${String(writeRows.length)}`)
    for (const r of counterRows) log(`  counter ${JSON.stringify(r).slice(0, 320)}`)

    // the product's own lane report (written by the evidence row at apply time)
    const laneReport = readJson(laneReportPath)
    log(`lane report: ${JSON.stringify(laneReport?.effective ?? null)}`)
    evidence.laneReport = laneReport

    const diskB = existsSync(rowPaths.b.path) ? readFileSync(rowPaths.b.path, 'utf8') : null
    const hostLogAtRows = (() => { try { return readFileSync(bootInfo.logPath, 'utf8') } catch { return '' } })()
    evidence.requests = {
      total: requests.length,
      surfacePerMemberRequest,
      calls,
      readCalls,
      // FULL tool-result text: the ONE-alive-boot's activation refusal was clipped
      // at 320 chars and the cause was lost with the World. Never clip a result.
      results: results.map((r) => ({ seq: r.seq, tool: r.tool, isError: r.isError, text: redact(r.text) })),
    }
    evidence.guardFacts = guardFacts
    evidence.counter = { counterInstalled, readRows, writeRows }
    evidence.rowValues = {
      a: { call: callA, result: resultA === null ? null : { isError: resultA.isError, text: redact(resultA.text).slice(0, 900) } },
      b: { call: callB, result: resultB === null ? null : { isError: resultB.isError, text: redact(resultB.text).slice(0, 900) } },
      c: { call: callC, result: resultC === null ? null : { isError: resultC.isError, text: redact(resultC.text).slice(0, 900) } },
      write: { call: writeCall, result: resultWrite === null ? null : { isError: resultWrite.isError, text: redact(resultWrite.text).slice(0, 900) }, disk: diskB },
    }

    // ── PERSIST FIRST (a late typo must not cost the record again) ──────────
    writeFileSync(join(HERE, 'transcript.json'), JSON.stringify({
      surface,
      discoveryReadSchemas,
      discoveryReadMentions,
      discoveryReadSectionMentions,
      denyList,
      surfacePerMemberRequest,
      calls,
      readCalls,
      writeCalls,
      results: evidence.requests.results,
      rowValues: evidence.rowValues,
    }, null, 2) + '\n')
    writeFileSync(join(HERE, 'guard-facts.json'), JSON.stringify({
      sinkPath, sinkExists, sinkBytes: consulting.bytes, guardFacts,
      factsA, factsB, factsC, bindingFacts,
    }, null, 2) + '\n')
    writeFileSync(join(HERE, 'counter.json'), JSON.stringify(evidence.counter, null, 2) + '\n')
    log('persisted transcript.json / guard-facts.json / counter.json (before any optional step)')

    // ── verdicts: precondition + rows 1-4 ───────────────────────────────────
    const memberARequest = surfacePerMemberRequest[0] ?? null
    const preconditionOk = bootInfo !== null && hostAlive() && memberARequest !== null
      && memberARequest.readSchemas === 1
      && memberARequest.duplicateNames === false
      && memberARequest.systemPromptReadMentions <= discoveryReadMentions
      && memberARequest.systemPromptReadSectionMentions === discoveryReadSectionMentions
      && discoveryReadSchemas === 1
      && readCalls.length >= 3
    add('live:composition-precondition-read-surface', preconditionOk ? 'PASS' : 'FAIL', {
      hostAlive: hostAlive(),
      memberRequestSeen: memberARequest !== null,
      memberReadSchemas: memberARequest?.readSchemas ?? null,
      memberSurfaceSize: memberARequest?.surfaceSize ?? null,
      memberSurfaceHasDuplicates: memberARequest?.duplicateNames ?? null,
      memberPromptReadMentions: memberARequest?.systemPromptReadMentions ?? null,
      memberPromptReadSectionMentions: memberARequest?.systemPromptReadSectionMentions ?? null,
      discoveryPromptReadMentions: discoveryReadMentions,
      discoveryReadSectionMentions,
      discoveryReadSchemas,
      readCalls: readCalls.length,
      writeCalls: writeCalls.length,
      surface,
      note: 'the a5sf-wired Member ACTIVATED and ran model turns whose surface carried exactly ONE native `read`; this is the precondition for every row below, not one of the six',
    })

    // ── row 1: read A (inside both) ─────────────────────────────────────────
    const aAllowFacts = factsA.filter((f) => f.decision === 'allow')
    const aBindingAllow = aAllowFacts.filter((f) => f.realm === 'binding' && f.toolBindingIdentity === BINDING_IDENTITY)
    const aCounter = rowsForPath(readRows, rowPaths.a.path)
    const aCounterConfined = aCounter.filter((r) => r.isBase !== true)
    const aClaimReturned = resultA !== null && resultA.isError !== true && resultA.text.includes(claimA)
    const row1Ok = aClaimReturned && aBindingAllow.length >= 1 && aCounterConfined.length >= 1 && aCounter.every((r) => r.isBase !== true)
    add('live:row1-read-a-inside-both-allowed', row1Ok ? 'PASS' : 'FAIL', {
      call: callA ?? null,
      isError: resultA?.isError ?? null,
      claimReturned: aClaimReturned,
      observed: resultA === null ? null : { isError: resultA.isError, text: redact(resultA.text).slice(0, 800) },
      allowFacts: aAllowFacts.length,
      bindingLaneAllowFacts: aBindingAllow.map((f) => ({ realm: f.realm, toolBindingIdentity: f.toolBindingIdentity, method: f.method, decision: f.decision, decidedBy: f.decidedBy, policyRevision: f.policyRevision })),
      counterRows: aCounter.map((r) => ({ leg: r.leg, method: r.method, instance: r.instance, isBase: r.isBase })),
      lane: 'inside ceiling [workspace] AND inside the binding read restriction [workspace/axis/allow]',
      note: 'the model-visible native `read` on A returned the planted bytes, the sink recorded allow facts on the BINDING realm (toolBindingIdentity dsh.fs/read), and the confined provider instance served it',
    })

    // ── row 2: read B (ceiling yes, restriction no) ────────────────────────
    const bDeny = factsB.filter((f) => f.decision === 'deny')
    const bBindingDeny = bDeny.filter((f) => f.realm === 'binding' && f.toolBindingIdentity === BINDING_IDENTITY)
    const bRefusalText = /outside every allow subtree of the lane/.test(String(resultB?.text ?? ''))
    const bNoLeak = resultB !== null && !String(resultB.text).includes(claimB) && !String(resultB.text).includes(writeContent.trim())
    const bCounterReads = rowsForPath(readRows, rowPaths.b.path)
    add('live:row2-read-b-binding-deny-exactly-one-fact', (resultB?.isError === true && bRefusalText && bNoLeak && factsB.length === 1 && bBindingDeny.length === 1 && bCounterReads.length === 0) ? 'PASS' : 'FAIL', {
      call: callB ?? null,
      isError: resultB?.isError ?? null,
      refusalText: bRefusalText,
      claimLeaked: !bNoLeak,
      observed: resultB === null ? null : { isError: resultB.isError, text: redact(resultB.text).slice(0, 800) },
      factsForB: factsB.length,
      denyFactsForB: bDeny.length,
      bindingLaneDenyFacts: bBindingDeny.map((f) => ({ schema: f.schema, realm: f.realm, toolBindingIdentity: f.toolBindingIdentity, memberIdentity: f.memberIdentity, method: f.method, decision: f.decision, decidedBy: f.decidedBy, policyRevision: f.policyRevision, sequence: f.sequence, observedAt: f.observedAt, locator: f.locator })),
      providerReadRowsForB: bCounterReads.length,
      lane: 'inside ceiling [workspace], OUTSIDE the binding read restriction [workspace/axis/allow]',
      note: 'the binding lane refused it; exactly ONE deny fact carries realm:"binding" + toolBindingIdentity:"dsh.fs/read"; no provider read method ran for it',
    })

    // ── row 3: read C (ceiling no, restriction yes) ────────────────────────
    const cDeny = factsC.filter((f) => f.decision === 'deny')
    const cBindingDeny = cDeny.filter((f) => f.realm === 'binding' && f.toolBindingIdentity === BINDING_IDENTITY)
    const cRefusalText = /outside every allow subtree of the lane/.test(String(resultC?.text ?? ''))
    const cNoLeak = resultC !== null && !String(resultC.text).includes(claimC)
    const probeC = laneReport?.probePaths?.find((p) => p.locator === rowPaths.c.path) ?? null
    const probeB = laneReport?.probePaths?.find((p) => p.locator === rowPaths.b.path) ?? null
    const probeA = laneReport?.probePaths?.find((p) => p.locator === rowPaths.a.path) ?? null
    const cCounterReads = rowsForPath(readRows, rowPaths.c.path)
    const noWidening = probeC !== null
      && probeC.ceilingRead === 'deny'
      && probeC.restrictionRead === 'allow'
      && probeC.effectiveRead === 'deny'
      && !laneReport?.effective?.read?.allow?.includes(join(world.home, 'restriction-outside'))
    add('live:row3-read-c-refused-no-widening', (resultC?.isError === true && cRefusalText && cNoLeak && cBindingDeny.length === 1 && cCounterReads.length === 0 && noWidening) ? 'PASS' : 'FAIL', {
      call: callC ?? null,
      isError: resultC?.isError ?? null,
      refusalText: cRefusalText,
      claimLeaked: !cNoLeak,
      observed: resultC === null ? null : { isError: resultC.isError, text: redact(resultC.text).slice(0, 800) },
      denyFactsForC: cDeny.length,
      bindingLaneDenyFacts: cBindingDeny.map((f) => ({ realm: f.realm, toolBindingIdentity: f.toolBindingIdentity, method: f.method, decision: f.decision, decidedBy: f.decidedBy })),
      providerReadRowsForC: cCounterReads.length,
      laneReport: {
        computedBy: laneReport?.computedBy ?? null,
        ceilingReadAllow: laneReport?.ceiling?.read?.allow ?? null,
        restrictionReadAllow: laneReport?.restriction?.read?.allow ?? null,
        effectiveReadAllow: laneReport?.effective?.read?.allow ?? null,
        restrictionWrite: laneReport?.restriction?.write ?? null,
        effectiveWriteAllow: laneReport?.effective?.write?.allow ?? null,
        dispositions: [probeA, probeB, probeC],
      },
      noWidening,
      lane: 'OUTSIDE the ceiling [workspace], INSIDE the binding read restriction [<home>/restriction-outside]',
      note: 'the restriction alone would ALLOW C; the request was refused anyway, and the product algebra report shows the binding lane enforces the INTERSECTION (ceiling deny + restriction allow => effective deny). A binding lane cannot widen the ceiling.',
    })

    // ── row 4: native write to B (ceiling only) ────────────────────────────
    const writeFactsB = factsB.filter((f) => /write|edit/i.test(String(f.method ?? '')))
    const writeAllow = writeFactsB.filter((f) => f.decision === 'allow')
    const writeOnCeiling = writeFactsB.filter((f) => f.realm === 'member' && f.toolBindingIdentity === null)
    const writeReadLaneFacts = factsB.filter((f) => f.realm === 'binding' && f.toolBindingIdentity === BINDING_IDENTITY && /write|edit/i.test(String(f.method ?? '')))
    const writeCounterRows = rowsForPath(writeRows, rowPaths.b.path)
    const writeOk = resultWrite !== null && resultWrite.isError !== true && diskB === writeContent
    const row4Ok = writeOk && writeAllow.length >= 1 && writeOnCeiling.length === writeFactsB.length && writeReadLaneFacts.length === 0
      && writeCounterRows.length >= 1 && writeCounterRows.every((r) => r.isBase !== true)
    add('live:row4-write-b-ceiling-allowed-no-read-lane-fact', row4Ok ? 'PASS' : 'FAIL', {
      call: writeCall ?? null,
      isError: resultWrite?.isError ?? null,
      observed: resultWrite === null ? null : { isError: resultWrite.isError, text: redact(resultWrite.text).slice(0, 800) },
      diskContent: diskB,
      expectedContent: writeContent,
      writeFacts: writeFactsB.map((f) => ({ realm: f.realm, toolBindingIdentity: f.toolBindingIdentity, method: f.method, decision: f.decision, decidedBy: f.decidedBy })),
      writeFactsOnCeilingRealm: writeOnCeiling.length,
      readLaneWriteFacts: writeReadLaneFacts.length,
      readLaneFactsForBOverall: factsB.filter((f) => f.realm === 'binding').map((f) => ({ method: f.method, decision: f.decision })),
      counterRows: writeCounterRows.map((r) => ({ leg: r.leg, method: r.method, instance: r.instance, isBase: r.isBase })),
      lane: 'B is inside the ceiling write lane [workspace]; the binding declares no-additional-narrowing for write',
      note: 'the native write succeeded on the CEILING lane (realm:"member", toolBindingIdentity:null); NO read-lane fact (realm binding / dsh.fs/read) was produced by it — the sibling lane is not contaminated',
    })

    // ── row 5: post-invalidation managed call (THE P0 ROW) ─────────────────
    const stateBefore = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
    const membersBefore = Array.isArray(stateBefore.body?.members) ? stateBefore.body.members : []
    const workerBefore = membersBefore.find((m) => String(m.templateId) === 'worker') ?? null
    const workerSession = workerBefore === null ? '' : String(workerBefore.childSessionId ?? '')
    log(`row5 worker member: ${JSON.stringify(workerBefore)}`)
    const factsBefore5 = parseJsonl(sinkPath).filter((f) => f?.schema === 'a5sf-guard-consult/1').length
    const counterBefore5 = parseJsonl(counterPath).length
    const hostLogBefore5 = (() => { try { return readFileSync(bootInfo.logPath, 'utf8') } catch { return '' } })()

    let lateTrigger = null
    let invalidationLine = null
    let postInvalidationRead = null
    let sinkDelta5 = null
    let counterDelta5 = null
    let presetDefinitionVisible = null
    if (workerSession === '') {
      add('live:row5-post-invalidation-refused-shadow-invalidated', 'NOT_REACHED', {
        reason: 'NO_WORKER_CHILD_SESSION_IN_STATE',
        state: redact(JSON.stringify(stateBefore.body ?? null)).slice(0, 800),
      })
    } else {
      // (a) the live surface change: one REAL tool through the public seam.
      lateTrigger = await fetchJson(`${origin}${LATE_TOOL_ROUTE}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ reason: 'a5sf-acceptance-row5' }),
      }, 30_000)
      log(`late-tool trigger: status=${String(lateTrigger.status)} body=${JSON.stringify(lateTrigger.body ?? null).slice(0, 300)}`)
      // (b) the product's own invalidation line (the realm console.error).
      const invalidated = await waitFor(() => {
        const text = (() => { try { return readFileSync(bootInfo.logPath, 'utf8') } catch { return '' } })()
        const hit = text.split('\n').find((l) => l.includes('native tool shadow INVALIDATED'))
        if (hit !== undefined) invalidationLine = hit
        return hit !== undefined
      }, 30_000, 300)
      log(`invalidation observed in the Host log=${String(invalidated)} line=${String(invalidationLine).slice(0, 400)}`)
      // (c) THE SAME out-of-lane read, through the product's dispatch route.
      postInvalidationRead = await fetchJson(`${origin}/__p6t6/tool`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ name: 'read', args: { file_path: rowPaths.b.path }, as: workerSession, callId: 'a5sfacc-post-invalidation-read' }),
      }, 60_000)
      log(`post-invalidation read: status=${String(postInvalidationRead.status)} body=${redact(JSON.stringify(postInvalidationRead.body ?? null)).slice(0, 800)}`)
      // (d) an IN-LANE read after invalidation (out of service, not "less governed").
      const postInvalidationInLane = await fetchJson(`${origin}/__p6t6/tool`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ name: 'read', args: { file_path: rowPaths.a.path }, as: workerSession, callId: 'a5sfacc-post-invalidation-inlane' }),
      }, 60_000)
      log(`post-invalidation in-lane read: status=${String(postInvalidationInLane.status)} body=${redact(JSON.stringify(postInvalidationInLane.body ?? null)).slice(0, 600)}`)
      // (e) the unknown-name control: the gate must NOT deny an unmanaged name.
      const unknownControl = await fetchJson(`${origin}/__p6t6/tool`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ name: 'x_acceptance_late_unrelated', args: {}, as: workerSession, callId: 'a5sfacc-late-tool-control' }),
      }, 60_000)
      const lateReport = readJson(lateReportPath)
      const factsAfter5 = parseJsonl(sinkPath).filter((f) => f?.schema === 'a5sf-guard-consult/1').length
      const counterAfter5 = parseJsonl(counterPath).length
      sinkDelta5 = factsAfter5 - factsBefore5
      counterDelta5 = counterAfter5 - counterBefore5
      const hostLogAfter5 = (() => { try { return readFileSync(bootInfo.logPath, 'utf8') } catch { return '' } })()
      const resultText5 = String(postInvalidationRead.body?.error?.message ?? '')
      const code5 = postInvalidationRead.body?.error?.info?.code ?? null
      const name5 = postInvalidationRead.body?.error?.info?.name ?? null
      const refused5 = postInvalidationRead.status === 200 && postInvalidationRead.body?.ok === false
      const typed5 = code5 === INVALIDATED_CODE
      const noBytes5 = !resultText5.includes(claimB) && !JSON.stringify(postInvalidationRead.body ?? {}).includes(claimB)
      const inLaneRefused = postInvalidationInLane.status === 200
        && postInvalidationInLane.body?.ok === false
        && postInvalidationInLane.body?.error?.info?.code === INVALIDATED_CODE
        && !JSON.stringify(postInvalidationInLane.body ?? {}).includes(claimA)
      // The preset definition identity is NOT HTTP-observable. What IS observed:
      // the product's own invalidation line (the realm restored the preset
      // surface) + the typed admission refusal, which only exists while the
      // shadow is gone and the preset definition is what would have served.
      presetDefinitionVisible = {
        observable: false,
        seamNeeded: 'an in-process seam that reads tools.get("read", <agent scope>) and compares it to the routed definition (the P0 host-free arm P0-1 asserts this identity directly)',
        indirectWitness: invalidationLine,
        note: 'the run does not claim to have PRINTED the preset definition object; it claims the product recorded an invalidation and then refused the covered name at admission with A5SF_NATIVE_SHADOW_INVALIDATED, which is the refusal that exists BECAUSE the preset definition is the one the agent would resolve',
      }
      const row5Ok = refused5 && typed5 && name5 === 'A5sfNativeShadowInvalidatedError' && noBytes5
        && invalidationLine !== null && lateTrigger.body?.ok === true && lateReport?.registered === true
        && sinkDelta5 === 0 && counterDelta5 === 0
      add('live:row5-post-invalidation-refused-shadow-invalidated', row5Ok ? 'PASS' : 'FAIL', {
        lateToolTrigger: lateTrigger === null ? null : { status: lateTrigger.status, body: lateTrigger.body },
        lateToolReport: lateReport,
        invalidationLine,
        presetDefinitionVisible,
        postInvalidationRead: {
          status: postInvalidationRead.status,
          ok: postInvalidationRead.body?.ok ?? null,
          error: postInvalidationRead.body?.error ?? null,
          typedCode: code5,
          typedName: name5,
          forbiddenBytesReturned: !noBytes5,
        },
        postInvalidationInLaneRead: {
          status: postInvalidationInLane.status,
          ok: postInvalidationInLane.body?.ok ?? null,
          error: postInvalidationInLane.body?.error ?? null,
          plantNotReturned: !JSON.stringify(postInvalidationInLane.body ?? {}).includes(claimA),
        },
        lateToolControl: { status: unknownControl.status, body: unknownControl.body ?? null },
        sinkFactsBefore: factsBefore5,
        sinkFactsAfter: factsAfter5,
        sinkDelta: sinkDelta5,
        counterRowsBefore: counterBefore5,
        counterRowsAfter: counterAfter5,
        counterDelta: counterDelta5,
        hostLogLinesAdded: hostLogAfter5.split('\n').length - hostLogBefore5.split('\n').length,
        note: 'the P0 admission deny fires at tools/pre-execute, so it writes NO a5sf-guard-consult/1 fact and reaches NO provider method (sinkDelta 0 AND counterDelta 0 are the expected, asserted values — the refusal happens before either seam; that is the proof the forbidden bytes were never read). The witness is the typed refusal + the product invalidation line.',
      })
    }

    // ── row 6: teardown ────────────────────────────────────────────────────
    const stateMid = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
    const membersMid = Array.isArray(stateMid.body?.members) ? stateMid.body.members : []
    const workerMid = membersMid.find((m) => String(m.templateId) === 'worker') ?? null
    const targetSession = String(workerMid?.childSessionId ?? workerSession)
    const archiveCall = targetSession === ''
      ? null
      : await fetchJson(`${origin}/__p6t6/tool`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({
          name: 'team_archive_member',
          args: { rootSessionId: CREATE_ROOT, requestToken: 'a5sfacc-archive', targetInstanceId: String(workerMid?.instanceId ?? '') },
          as: ROOT,
          callId: 'a5sfacc-archive',
        }),
      }, 60_000)
    log(`archive via product tool route: status=${String(archiveCall?.status)} body=${redact(JSON.stringify(archiveCall?.body ?? null)).slice(0, 600)}`)
    const stateAfterArchive = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
    const membersAfter = Array.isArray(stateAfterArchive.body?.members) ? stateAfterArchive.body.members : []
    const observations = Array.isArray(stateAfterArchive.body?.observations) ? stateAfterArchive.body.observations : []
    // The ROOT SESSION NAME contains 'a5sf', so a bare /a5sf/ filter counted every
    // observation as a dispose fault (measured in the ONE-alive boot). Match the
    // product's own fault phrases instead.
    const DISPOSE_FAULT = /a5sf: realm dispose failed|residency dispose failed|a5sf: native shadow/i
    const a5sfFaults = observations.filter((o) => DISPOSE_FAULT.test(String(o)))
    const factsBefore6 = parseJsonl(sinkPath).filter((f) => f?.schema === 'a5sf-guard-consult/1').length

    // seam 1: the product dispatch route. Only a LIVE agent can be dispatched
    // to; an archived member must answer NO_LIVE_AGENT (422) — no usable shadow.
    const postArchiveRead = targetSession === ''
      ? null
      : await fetchJson(`${origin}/__p6t6/tool`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ name: 'read', args: { file_path: rowPaths.b.path }, as: targetSession, callId: 'a5sfacc-post-archive-read' }),
      }, 60_000)
    // seam 2: a residency drop on the SAME session — the disposed-agent-scope
    // seam (disposes the live handle, which drains the agent's setup disposers,
    // including the a5sf realm). A fault is REPORTED through observations.
    const residencyDrop = targetSession === ''
      ? null
      : await fetchJson(`${origin}/__p6t6/residency/drop`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ sessionId: targetSession }),
      }, 60_000)
    const stateAfterDrop = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
    const observationsAfterDrop = Array.isArray(stateAfterDrop.body?.observations) ? stateAfterDrop.body.observations : []
    const a5sfFaultsAfterDrop = observationsAfterDrop.filter((o) => DISPOSE_FAULT.test(String(o)))
    const postDropRead = targetSession === ''
      ? null
      : await fetchJson(`${origin}/__p6t6/tool`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ name: 'read', args: { file_path: rowPaths.b.path }, as: targetSession, callId: 'a5sfacc-post-drop-read' }),
      }, 90_000)
    const factsAfter6 = parseJsonl(sinkPath).filter((f) => f?.schema === 'a5sf-guard-consult/1').length
    const healthAfter = await fetchJson(`${origin}/__p6t6/health`, undefined, 20_000)
    log(`row6: archive=${String(archiveCall?.status)} postArchiveRead=${String(postArchiveRead?.status)} residencyDrop=${JSON.stringify(residencyDrop?.body ?? null)} postDropRead=${String(postDropRead?.status)} health=${String(healthAfter.status)} sinkDelta=${String(factsAfter6 - factsBefore6)}`)
    const postArchiveNoLive = postArchiveRead !== null && postArchiveRead.status === 422
    const archiveOk = archiveCall !== null && archiveCall.status === 200 && archiveCall.body?.ok === true
    // THE PROPERTY, not the mechanism: after the stop, a dispatch to that scope
    // must either be refused (422 NO_LIVE_AGENT) or answer a REFUSAL — never a
    // success that carries the forbidden bytes. A cold-resume that re-assembles
    // a FRESH constrained realm is not an unconstrained shadow; a success on B
    // would be (B is outside the binding lane).
    const dispatchedAfterStop = [postArchiveRead, postDropRead].filter((r) => r !== null)
    const anySuccessAfterStop = dispatchedAfterStop.filter((r) => r.status === 200 && r.body?.ok === true)
    const unconstrainedAfterDrop = anySuccessAfterStop.some((r) => String(JSON.stringify(r.body ?? {})).includes(claimB))
    const allExplained = dispatchedAfterStop.length > 0 && dispatchedAfterStop.every((r) => r.status === 422
      || (r.status === 200 && r.body?.ok === false))
    const refusalCodesAfterStop = dispatchedAfterStop.map((r) => ({
      status: r.status,
      code: r.body?.error?.info?.code ?? null,
      ok: r.body?.ok ?? null,
      message: redact(String(r.body?.error?.message ?? '')).slice(0, 300),
    }))
    const row6Ok = allExplained
      && !unconstrainedAfterDrop
      && anySuccessAfterStop.length === 0
      && a5sfFaults.length === 0
      && a5sfFaultsAfterDrop.length === 0
      && healthAfter.status === 200
      && hostAlive()
    const teardownEvidence = {
      archive: archiveCall === null ? null : { status: archiveCall.status, body: archiveCall.body, ok: archiveOk },
      membersAfterArchive: membersAfter.map((m) => ({ instanceId: m.instanceId, templateId: m.templateId, lifecycle: m.lifecycle, childSessionId: m.childSessionId })),
      observations: observations.slice(-20),
      a5sfFaults,
      postArchiveRead: postArchiveRead === null ? null : { status: postArchiveRead.status, body: postArchiveRead.body },
      postArchiveNoLiveAgent: postArchiveNoLive,
      residencyDrop: residencyDrop === null ? null : { status: residencyDrop.status, body: residencyDrop.body },
      observationsAfterDrop: observationsAfterDrop.slice(-20),
      a5sfFaultsAfterDrop,
      postDropRead: postDropRead === null ? null : { status: postDropRead.status, body: postDropRead.body },
      postDropStillServedForbiddenBytes: unconstrainedAfterDrop,
      anySuccessAfterStop: anySuccessAfterStop.map((r) => ({ status: r.status, body: r.body })),
      refusalCodesAfterStop,
      healthAfterDrop: { status: healthAfter.status, body: healthAfter.body },
      sinkFactsBefore: factsBefore6,
      sinkFactsAfter: factsAfter6,
      hostAlive: hostAlive(),
      seamsObserved: [
        'product archive lifecycle: team_archive_member dispatched through the row tool route (as the root/leader)',
        'product dispatch seam: POST /__p6t6/tool {as:<member child session>} — only a LIVE agent can be dispatched to; an archived member must answer NO_LIVE_AGENT (422)',
        'the product residency seam: POST /__p6t6/residency/drop {sessionId} — disposes the live agent handle, draining the setup disposers (incl. the a5sf realm)',
        'the row dispose-observation channel: GET /__p6t6/state .observations (carries "a5sf: realm dispose failed" / "residency dispose failed" on a fault)',
        'the a5sf sink: the fact count after teardown (no fact can appear for a scope that no longer runs)',
        'the process seam: the Host child alive + the World teardown report (port released, home deleted)',
      ],
      seamsNotReached: [
        'an in-process read of the DISPOSED scope\'s tool registry (tools.get("read", <old agent>)) — no public HTTP route exposes a disposed scope, and this lane did not fork an infrastructure plugin for it',
      ],
      note: 'PROVEN for the three asked properties as OBSERVED through the seams above: no dispatch path reaches the stopped Member (so no usable shadow, constrained or not), no dispose fault was reported, no fact was written after the stop, and the Host/port/home teardown is clean. NOT claimed: that the disposed scope\'s definition registry is empty — that needs an in-process seam this lane did not add.',
    }
    evidence.teardown = teardownEvidence
    writeFileSync(join(HERE, 'teardown.json'), JSON.stringify(teardownEvidence, null, 2) + '\n')
    log(`teardown.json written: ${JSON.stringify(teardownEvidence).slice(0, 700)}`)
    add('live:row6-teardown-no-usable-unconstrained-shadow', row6Ok ? 'PASS' : 'FAIL', {
      archiveOk,
      archivedLifecycle: membersAfter.some((m) => String(m.templateId) === 'worker' && String(m.lifecycle) === 'ARCHIVED'),
      postArchiveReadStatus: postArchiveRead?.status ?? null,
      postArchiveNoLiveAgent: postArchiveNoLive,
      residencyDropped: residencyDrop?.body?.dropped ?? null,
      postDropReadStatus: postDropRead?.status ?? null,
      postDropStillServedForbiddenBytes: unconstrainedAfterDrop,
      refusalCodesAfterStop,
      anySuccessAfterStop: anySuccessAfterStop.length,
      a5sfDisposeFaults: a5sfFaults,
      a5sfFaultsAfterDrop,
      sinkDeltaAfterStop: factsAfter6 - factsBefore6,
      hostAlive: hostAlive(),
      healthStatus: healthAfter.status,
      seamsObserved: teardownEvidence.seamsObserved,
      seamsNotReached: teardownEvidence.seamsNotReached,
      note: teardownEvidence.note,
    })

    record.record.evidence = {
      worldId: world.id,
      sinkPath,
      sinkSha256: consulting.sha256,
      counterPath,
      laneReportPath,
      lateReportPath,
      hostLogPath: bootInfo.logPath,
      surface,
      denyList,
      guardFacts: guardFacts.length,
      counterRows: counterRows.length,
      rowPaths: { a: rowPaths.a.path, b: rowPaths.b.path, c: rowPaths.c.path },
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
    // The process seam (row 6, outside the Host's lifetime).
    const hostPid = bootInfo === null ? null : world.instance?.child?.pid ?? null
    const portStillOpen = bootInfo === null ? null : await tcpConnectProbe(bootInfo.port, 1500)
    const processSeam = {
      hostPid,
      hostChildExitCode: world.instance?.child?.exitCode ?? null,
      portStillListening: portStillOpen,
      worldTeardown: teardown ?? null,
      homeExistsAfterTeardown: existsSync(world.home),
      note: 'the Host child is the process this run spawned; the World teardown kills it and releases the port. portStillListening=true would be an orphan.',
    }
    log(`process seam: ${JSON.stringify(processSeam).slice(0, 800)}`)
    try {
      const prior = readJson(join(HERE, 'teardown.json')) ?? {}
      writeFileSync(join(HERE, 'teardown.json'), JSON.stringify({ ...prior, processSeam }, null, 2) + '\n')
    } catch {
      /* teardown.json is best-effort here; the run record still carries the verdict */
    }
    const ledgerRows = parseJsonl(LEDGER_PATH)
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

if (IDENTITY_CHECK_AT >= 0) {
  const files = process.argv.slice(IDENTITY_CHECK_AT + 1)
  const rows = files.map((file, index) => ({ id: `row-${String(index)}`, name: pathToFileURL(resolve(file)).href }))
  const result = rowIdentityCheck(rows)
  log(`identity-check ${result.ok === true ? 'PASS' : 'REFUSED'} ${JSON.stringify(result).slice(0, 900)}`)
  process.exitCode = result.ok === true ? 0 : 1
} else if (PLAN_ONLY) {
  await planOnly()
} else {
  rmSync(RUN_LOG, { force: true })
  await boot()
}
