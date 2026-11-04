#!/usr/bin/env node
/**
 * run-boot.mjs — the LIVE half of P2-03 / BL-16 (the Search vertical).
 *
 * WHAT THIS MEASURES, AND AGAINST WHAT. Six rows are judged against the PRODUCT
 * call chain — a Member's `grep`/`glob` tool call, routed by the production row
 * through the isolated Member realm, down to the confined `subprocess` face and
 * into the packaged ripgrep. Nothing in a row is satisfied by a unit test of the
 * guard: `evidence/a5sf-bl16-grep/` already measured the seam host-free, and
 * every one of its 18 arms stands. What was NOT measured — and what this boot
 * exists to measure — is whether that seam is what a Member's tool call actually
 * reaches on a real Host, with a real preset, a real realm and a real sink.
 *
 *   row 1  in-lane `grep` is SERVED; exactly ONE `allow` fact at the declared
 *          root, method `spawn`
 *   row 2  a root outside the CEILING is refused BEFORE any process exists;
 *          exactly one `deny`/`IO_READ_DENIED` fact; no forbidden bytes
 *   row 3  a root inside the ceiling but OUTSIDE the narrower binding
 *          RESTRICTION is refused at admission (effective = ceiling ∩ restriction)
 *   row 4  a search cancelled mid-process settles as CANCELLED — not success,
 *          not a fabricated empty result
 *   row 5  an invalid pattern is a TOOL ERROR, never "No matches found"
 *   row 6  teardown: dead Host, released port, deleted home, no orphan, and no
 *          callable shadow of the stopped Member
 *
 * ONE BOOT. The driver refuses a second start (`DEDICATED_STARTS = 1`). The pool
 * item "P2-04 grep (BL-16)" holds 3 starts; the other 2 are NOT this driver's to
 * spend, and a failed boot is reported rather than retried.
 *
 * MODES
 *   node run-boot.mjs --plan     host-free: contract, wiring, patch, provider row,
 *                                static composition preconditions. No gate, no row.
 *   node run-boot.mjs            boot once, judge six rows, reconcile the ledger.
 *
 * WHAT IS FIXTURE (disclosed in README §3, not hidden here)
 *   - the CEILING and the RESTRICTION inputs, and the confined `subprocess` face
 *     itself, are supplied by the EVIDENCE provider row
 *     (`a5sf-search-realm-provider-row.mjs`): the live preset does not compile a
 *     v3 blueprint into a realm lane at this base, and BL-17 refuses a
 *     binding-realm subprocess face;
 *   - the counters (base fs / base subprocess / confined provider) are test
 *     instrumentation in that same row;
 *   - the model is a scripted mock; the interruption is the SHIPPED client route
 *     `/api/session/cancel` (session-controller -> `agent.cancel({kind:'user'})`).
 */
import { createHash } from 'node:crypto'
import { execFileSync } from 'node:child_process'
import {
  appendFileSync,
  readdirSync, existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

import {
  TestWorldFactory,
  apiPrompt,
  apiSessionCancel,
  authenticate,
  emitPatchLayer,
  fetchJson,
  tcpConnectProbe,
} from '../../../../tests/world-factory/lib/world-factory.mjs'
import {
  createRunRecord, formatSummary, readAuthorityBinding,
} from '../../../../tests/world-factory/lib/run-record.mjs'
import { TEST_USE_BASELINE_SHA } from '../../../../tests/paths.mjs'
import { createA5sfHarness } from '../../../../tests/world-factory/lib/a5sf-harness.mjs'
import { preRegisterReadBudget, resolveHeadCommit } from '../../../../tests/world-factory/suites/150-a5sf-read.mjs'
import {
  lastUserTextOfStatic, messagesOf, remoteCall, surfaceNamesOf, textOf,
} from '../../../../tests/world-factory/lib/u6-fs-assembly.mjs'
import { presetDeclarationRow, smokePresetPlugins } from '../../../../tests/kits/_shared/preset-seam.mjs'
import {
  classifyDisposeFaults, P2_01_ACCEPTANCE_ROOTS, assertAcceptanceRootWiring,
} from '../../../../tests/world-factory/lib/a5sf-acceptance-preflight.mjs'
import {
  SEARCH_CASES, SEARCH_CASE_IDS, judgeCase, judgeNegativeControl, judgeSearchRow,
  sampleCompleteness, summarizeRun,
} from '../../../../tests/world-factory/lib/a5sf-search-live.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..')
/** The host tree: this worktree's own pristine checkout if present, else the
 *  main checkout's (worktrees share the gitignored baseline). */
function hostTreePath() {
  const local = join(REPO_ROOT, 'tests', 'deepseek-harness-test-use')
  if (existsSync(join(local, 'packages', 'fs', 'tool-fs-search', 'lib', 'index.js'))) return local
  return join(REPO_ROOT, '..', '..', 'tests', 'deepseek-harness-test-use')
}
const HOST_TREE = hostTreePath()
const HOST_TOOL_FS = join(HOST_TREE, 'packages', 'fs', 'tool-fs', 'lib', 'index.js')
const HOST_TOOL_FS_SEARCH = join(HOST_TREE, 'packages', 'fs', 'tool-fs-search', 'lib', 'index.js')

const LINE = 'a5sfsrch'
const EVIDENCE_ROW = join(HERE, 'a5sf-search-realm-provider-row.mjs')
const RUN_LOG = join(HERE, 'run.log')
const GRANT_PATH = join(HERE, 'grant.json')
const LEDGER_PATH = join(HERE, 'run-ledger.jsonl')
const COUNTER_NAME = 'search-counter.jsonl'
const LANE_REPORT_NAME = 'lane-report.json'
const FACTS_NAME = 'guard-facts.json'

/** Root identity, from the ONE pinned object (never a second literal). */
const ROOTS = P2_01_ACCEPTANCE_ROOTS
const BOOT_ROOT = ROOTS.bootRoot
const ACCEPTANCE_ROOT = ROOTS.teamRoot

const BP_ANCHOR_ID = 'team.a5sf.search.anchor'
const BP_MAIN_ID = 'team.a5sf.search.main'
const PRESET_ID = 'a5sf-search-base'

const MK_DISC = 'A5SF_SEARCH_DISC'
/** The pre-team.create leader grep probe (retry ruling, condition 2). */
const MK_PROBE = 'A5SF_SEARCH_PROBE'
const MK_L1 = 'A5SF_SEARCH_L1_DRIVE'
const TOK_D1 = 'a5sfsrch-d1'
const MEMBER_ENVELOPE = '[team-work requestToken='
const DONE_D1 = 'A5SF_SEARCH_D1_DONE'
const DONE_L1 = 'A5SF_SEARCH_L1_DONE'
const BINDING_IDENTITY = 'dsh.search/grep'

/** Managed tool names: the native modules this boot shadows. `grep`/`glob` are
 *  here so the leader's `builtinToolDeny` does not deny the NEGATIVE CONTROL
 *  (the unconfined search outside any Member) and the Member surface stays
 *  neutral. */
const MANAGED_TOOL_NAMES = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh', 'grep', 'glob']
const SAFE_UNMANAGED_TOOL_NAMES = ['todo_write']
/**
 * Tools that stay on the LEADER's surface without a permission rule.
 *
 * The retry (2026-11-04T15:56Z) proved why this list must NOT include the
 * search tools: `team.create` refused the leader with
 * `TEAM_REMOTE_TEAM_CREATE_ROOT_START_FAILED ... permission coverage gate
 * failed for instance 'inst-leader': 2 unmanaged tool(s) on the final
 * model-facing surface: glob (known-sensitive-unmanaged), grep (known-sensitive-
 * unmanaged)`. The native attach that "manages" grep/glob runs on a MEMBER
 * realm; the leader (root session) has no realm, so the same tools are
 * unmanaged there and the product's coverage gate refuses them — correctly.
 * The leader delegates, so it denies them; the Member gets them through its
 * realm. Verified host-free only: this needs the next authorised start.
 */
const LEADER_MANAGED_TOOL_NAMES = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh']

const CASES = Object.freeze([...SEARCH_CASES])

const CALL_IDS = Object.freeze({
  grepIn: 'call-a5sfsrch-grep-in',
  grepOutsideCeiling: 'call-a5sfsrch-grep-out-ceiling',
  grepOutsideRestriction: 'call-a5sfsrch-grep-out-restriction',
  grepInvalid: 'call-a5sfsrch-grep-invalid',
  globIn: 'call-a5sfsrch-glob-in',
  globOutside: 'call-a5sfsrch-glob-out',
  grepFifo: 'call-a5sfsrch-grep-fifo',
})

const PLAN_ONLY = process.argv.includes('--plan')
const RULING_PATH = join(dirname(fileURLToPath(import.meta.url)), 'lane-ruling.json')
const PLAN_ROWS_PATH = join(dirname(fileURLToPath(import.meta.url)), 'plan-rows.json')
const PLAN_PATHS_PATH = join(dirname(fileURLToPath(import.meta.url)), 'plan-paths.json')

/**
 * The handoff, in ONE place so `--plan` and `boot()` cannot diverge.
 *
 * `emitPatchLayer` only BUILDS the patch text; the World composes the profile
 * it boots from `world.u6Fs.rows`. A row set that is emitted but never pushed
 * boots a BARE World. That is exactly what the lane's first attempt did
 * (2026-11-04T15:36Z): the Host started, the composed profile carried only the
 * base bundle, `/__p6t6/health` never existed, and six rows were lost to one
 * missing statement. `--plan` now runs this function against a probe object and
 * `go-no-go.mjs` compares the ids it returns with the ids in the emitted patch.
 *
 * @param {{u6Fs: {rows: object[]}}} world - the World (or a probe with the same shape).
 * @param {object[]} rows - the rows `rowsFor()` built.
 */
function handOverRows(world, rows) {
  world.u6Fs.rows.push(...rows)
}

/**
 * Wait for the profile the Host actually composed and report which handed row
 * ids it contains.
 *
 * The harness writes `composed-profile-<sha>.patch.yml` into the World's log
 * directory. Reading it is the only way to see the handoff from the host side;
 * `presentRowIds`/`missingRowIds` are what turn "the route never answered" into
 * "the rows never arrived".
 *
 * @param {{logDir: string}} world - the World (for `logDir`).
 * @param {string[]} expectedRowIds - the ids `handOverRows` gave the World.
 * @param {number} timeoutMs - how long to wait for the profile to appear.
 * @returns {Promise<{path: string|null, presentRowIds: string[], missingRowIds: string[]}>}
 */
async function waitForComposedProfile(world, expectedRowIds, timeoutMs) {
  const t0 = Date.now()
  for (;;) {
    let path = null
    try {
      const candidates = readdirSync(world.logDir).filter((name) => name.startsWith('composed-profile-') && name.endsWith('.patch.yml'))
      if (candidates.length > 0) {
        candidates.sort()
        path = join(world.logDir, candidates[candidates.length - 1])
      }
    } catch {
      path = null
    }
    if (path !== null) {
      const text = readFileSync(path, 'utf8')
      // Top-level insert items are indented four spaces in this dialect.
      const present = [...text.matchAll(/^ {4}- id:\s*"?([a-z0-9][a-z0-9._-]*)"?\s*$/gmu)].map((m) => m[1])
      const ids = [...new Set([...present, ...expectedRowIds.filter((id) => present.includes(id))])]
      const missing = expectedRowIds.filter((id) => !ids.includes(id))
      return { path, presentRowIds: ids, missingRowIds: missing }
    }
    if (Date.now() - t0 > timeoutMs) return { path: null, presentRowIds: [], missingRowIds: expectedRowIds }
    await new Promise((r) => setTimeout(r, 250))
  }
}

/** Read the lane's ruling file: how many starts are authorised, and by whom. */
function readRuling() {
  const ruling = JSON.parse(readFileSync(RULING_PATH, 'utf8'))
  // The NAMED entries are the authorisation; `authorisedStarts` is the frozen ORIGINAL
  // allocation that a re-grant may never edit (it appends an entry instead).
  if (!Array.isArray(ruling.rulings) || ruling.rulings.length === 0) throw new Error('lane-ruling.json: no ruling entries')
  const starts = ruling.rulings.reduce((sum, row) => sum + Number(row?.starts ?? 0), 0)
  if (!Number.isFinite(starts) || starts < 1) throw new Error(`lane-ruling.json has no usable ruling entries: ${JSON.stringify(ruling.rulings)}`)
  const declared = Number(ruling.authorisedStarts)
  if (!Number.isFinite(declared) || declared < 1 || declared > starts) {
    throw new Error(`lane-ruling.json: authorisedStarts=${String(ruling.authorisedStarts)} must be >= 1 and <= the ${String(starts)} named start(s) — a re-grant appends an entry, it never edits the frozen number`)
  }
  for (const row of ruling.rulings) {
    if (String(row?.by ?? '') === '' || String(row?.reason ?? '') === '') throw new Error('lane-ruling.json: every ruling needs `by` and `reason`')
  }
  return { starts, rulings: ruling.rulings, note: String(ruling.note ?? '') }
}

/**
 * The ordered ids of the TOP-LEVEL items in an emitted patch layer.
 *
 * Nested config objects also carry `id` fields (a preset declares its plugin
 * rows), so a flat `id:` scan over-collects. `emitPatchLayer` indents each
 * top-level item by four spaces, so an item starts at `^    - ` and its own
 * `id:` is on that line (or at six spaces inside the item).
 *
 * @param {string} patch - the `emitPatchLayer` output.
 * @returns {string[]} the row ids, in emission order.
 */
function emittedRowIdsOf(patch) {
  const items = []
  let current = null
  for (const line of patch.split('\n')) {
    if (/^ {4}- /u.test(line)) {
      current = [line]
      items.push(current)
    } else if (current !== null) {
      current.push(line)
    }
  }
  const ids = []
  for (const block of items) {
    const first = block[0].match(/^ {4}- id:\s*"?([a-z0-9][a-z0-9._-]*)"?\s*$/u)
    const nested = first === null ? block.join('\n').match(/^ {6}id:\s*"?([a-z0-9][a-z0-9._-]*)"?\s*$/mu) : null
    const id = first?.[1] ?? nested?.[1] ?? null
    if (id !== null) ids.push(id)
  }
  return ids
}
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

// ─────────────────────────────────────────────────────────────────────────────
// blueprints
// ─────────────────────────────────────────────────────────────────────────────

function mainBlueprintYaml(denyList) {
  const denyLines = denyList.length === 0 ? ['    builtinToolDeny: []'] : ['    builtinToolDeny:', ...denyList.map((n) => `      - ${n}`)]
  return [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
    'leader:', '  templateId: leader',
    `  persona: ${JSON.stringify(`You are the leader of the a5sf search-live team. ${MK_L1} drives your chain: delegate the worker script once, then finish.`)}`,
    '  capabilities:', '    teamTools:', '      kind: allow', '      items:',
    '        - team_delegate', '        - team_archive_member', '        - team_follow_up',
    ...denyLines,
    '    skills:', '      kind: allow', '      items: []',
    '    mcp:', '      kind: allow', '      items: []',
    '    permissions:', '      default: deny', '      allow: []', '      ask: []', '      deny: []',
    // teardown NEEDS archive-member in the caller's mutation envelope (the
    // native3 lane measured its omission as a DRIVER defect, not a finding).
    'teamEnvelope:', '  allow:', '    - create-member', '    - assign-task', '    - send-message', '    - report-progress', '    - archive-member', '  deny: []',
    'members:',
    // The search Member: NO capabilities block (the population shape) — its
    // ONLY confinement is the compiled member realm + the confined subprocess face.
    '  - templateId: worker', '    displayName: "a5sf search worker"',
    `    persona: ${JSON.stringify('You are the a5sf search worker. Follow the delegated script exactly, one tool call at a time.')}`,
    'memberEnvelopes:',
    '  - templateId: worker', '    envelope:', '      allow:', '        - send-message', '        - report-progress', '      deny: []',
    'permissionMutationEnvelope:', '  rules: []', 'teamHardEnvelope:', '  rules: []',
    'policyStates: []', 'metadata: {}', '---', '',
  ].join('\n')
}

/** The ANCHOR team: the unconfined control lives here (no realm exists for the
 *  anchor leader, and it declares no capabilities → no permission policy). */
const BP_ANCHOR_YAML = [
  '---', 'schemaVersion: 3', `blueprintId: ${BP_ANCHOR_ID}`, 'revision: "1"',
  'leader:', '  templateId: leader',
  `  persona: ${JSON.stringify(`You are the leader of the a5sf search-live anchor team. ${MK_DISC} is the discovery marker.`)}`,
  'members:', '  - templateId: worker', '    persona: "You are the a5sf search anchor worker."',
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
  return {
    rootSessionId: BOOT_ROOT,
    bootPhase: 'create',
    blueprintSource: BP_ANCHOR_YAML,
    blueprintDir: join(home, 'blueprints'),
    rootPresetId: PRESET_ID,
    memberPresetId: PRESET_ID,
    seedMembers: [],
    generation: 1,
    staticModel: { provider: 'deepseek-official', model: 'a5sf-search-model' },
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
    // ── route C enablement: the sink + the two native tool modules ──────────
    a5sfEvidencePath: join(home, 'a5sf-consult.jsonl'),
    // The search module's Config REQUIRES `sampleOverCapGlobResults` (no default),
    // so a bare string entry mounts it with an empty config and the product
    // refuses the realm install:
    //   SERVICE_MOUNT_FAILED: native tool module re-mount failed: invalid config:
    //   $.sampleOverCapGlobResults missing required value
    // (captured verbatim in delegate-artifact.json, 2026-11-04T19:05Z). False is
    // the deterministic choice: an over-cap glob page keeps the modification-time
    // head instead of sampling across top-level entries, so row 1 and row 5 do not
    // depend on sampling. `tool-fs` keeps the string form: its config is defaulted.
    a5sfNativeToolModules: [
      pathToFileURL(HOST_TOOL_FS).href,
      { url: pathToFileURL(HOST_TOOL_FS_SEARCH).href, config: { sampleOverCapGlobResults: false } },
    ],
    // The identity declaration: grants nothing, but the attach REFUSES before
    // any row if the settled fibers do not forward every declared name.
    a5sfExpectedTools: {
      [pathToFileURL(HOST_TOOL_FS).href]: ['read', 'write', 'edit', 'read_image'],
      [pathToFileURL(HOST_TOOL_FS_SEARCH).href]: ['grep', 'glob'],
    },
    // NOTE: no `teamToolPlane` — the ONLY confinement in this World is the a5sf
    // member realm + its confined subprocess face.
  }
}

function rowPathsOf({ home, workspaceDir }) {
  const workspace = realpathSync(workspaceDir)
  const inLane = join(workspace, 'lane', 'inside')
  return {
    workspace,
    inLaneDir: inLane,
    inLaneFile: join(inLane, 'needle.txt'),
    /** A SUBDIRECTORY of the in-lane root for the invalid-pattern call: inside
     *  the restriction, but a DIFFERENT locator, so row 1's "exactly one allow
     *  fact at the declared root" cannot be polluted by row 5's consultation
     *  (the sink is append-only and carries no call id). */
    invalidDir: join(inLane, 'invalid'),
    /** Same reasoning for the `glob` face check (M-07) and for the second
     *  out-of-lane operand. */
    globDir: join(inLane, 'glob'),
    restrictedFile: join(workspace, 'lane', 'outside-restriction.txt'),
    // The FIFO must sit INSIDE the effective read lane (`lane/inside`), because the
    // tool restriction narrows reads to that subtree. At `lane/blocking.fifo` the
    // guard refused it (fact: deny IO_READ_DENIED), no confined spawn ever happened,
    // the cancellation window never opened and the run aborted with
    // CANCELLATION_WINDOW_NO_CONFINED_SPAWN after 240 s (2026-11-04T19:17Z). The
    // window needs an ADMITTED search that then blocks, so the operand must be legal.
    fifo: join(inLane, 'blocking.fifo'),
    outsideDir: join(home, 'ceiling-outside'),
    outsideFile: join(home, 'ceiling-outside', 'secret.txt'),
    outsideGlobDir: join(home, 'ceiling-outside-glob'),
    outsideGlobFile: join(home, 'ceiling-outside-glob', 'secret.txt'),
    /** The narrower read allow list: the in-lane subtree ONLY. `restrictedFile`
     *  is inside the ceiling but outside this → the row-3 premise. */
    restrictionReadAllow: [inLane],
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
    config,
    rows: [
      // ONE evidence row: it MUST mount before the Team row so
      // `ctx.get('teamA5sfRealm')` resolves when the first Member setup runs.
      { id: 'a5sf-search-realm', name: providerRow, config: {
        allowRoot: paths.workspace,
        restrictionReadAllow: paths.restrictionReadAllow,
        bindingIdentity: BINDING_IDENTITY,
        laneReportPath: join(home, LANE_REPORT_NAME),
        laneProbePaths: [paths.inLaneFile, paths.restrictedFile, paths.outsideFile, paths.outsideGlobFile, paths.fifo],
        counterPath: join(home, COUNTER_NAME),
        scratchRoot: join(home, 'search-scratch'),
      } },
      { id: 'dsh-agent-team', name: PRODUCTION_ROW, config },
      { id: 'p6t6-team-tools', name: P6T6_ROW },
      presetDeclarationRow({
        id: PRESET_ID,
        displayName: 'a5sf search base',
        description: `a5sf search-live boot preset (${LINE}) = smoke + tool-fs-search`,
        plugins: basePlugins,
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
    const entry = { rowId: String(row.id), modulePath, packageName: pkg?.name ?? null, packagePath: pkgPath, hasClientHalf: pkg?.dsh?.client !== undefined }
    checked.push(entry)
    if (entry.hasClientHalf !== true) continue
    const list = byPackage.get(entry.packagePath) ?? []
    list.push(entry)
    byPackage.set(entry.packagePath, list)
  }
  for (const [pkgPath, list] of byPackage) {
    if (list.length > 1) {
      return {
        ok: false,
        reason: 'DUPLICATE_CLIENT_PACKAGE_SOURCES',
        detail: `package ${String(list[0].packageName)} (${String(pkgPath)}) would be sourced from ${String(list.length)} file-URL rows: ${list.map((e) => e.rowId).join(', ')} — the host client-modules registry refuses this`,
        sources: list,
      }
    }
  }
  return { ok: true, rows: checked }
}

function homeSandboxPin({ home, workspaceRoot }) {
  const root = realpathSync(workspaceRoot)
  const path = join(home, 'cordis.patch.yml')
  const yaml = [
    '# a5sf search-live fixture (README §4): pin the DEPLOYMENT file-sandbox',
    '# fallback root to this World\'s workspace. The base bundle sets',
    '# `workspaceRoot: !!js process.cwd()` (the pristine host tree) and the',
    '# confined realm resolves sandboxPolicy WITHOUT a session, so the fallback',
    '# — not the session cwd — fences every Team read/write.',
    '- id: sandbox-policy',
    '  config:',
    '    mode: "workspace-write"',
    `    workspaceRoot: ${JSON.stringify(root)}`,
    '',
  ].join('\n')
  return { path, yaml, mode: 'workspace-write', workspaceRoot: root }
}

function attachmentsProviderComposition() {
  const files = [
    join(HOST_TREE, 'packages', 'bundle', 'base', 'cordis.patch.yml'),
    join(HOST_TREE, 'packages', 'bundle', 'web-app', 'cordis.patch.yml'),
  ]
  const evidence = []
  for (const file of files) {
    if (!existsSync(file)) continue
    readFileSync(file, 'utf8').split('\n').forEach((line, index) => {
      if (/attachment-local|dsh-attachment-local/u.test(line)) evidence.push({ file, line: index + 1, text: line.trim() })
    })
  }
  const mounted = evidence.some((entry) => /id:\s*attachment-local/u.test(entry.text))
    && evidence.some((entry) => /@deepseek-ai\/dsh-attachment-local/u.test(entry.text))
  return { mounted, service: 'attachments', evidence }
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
/**
 * The tool results the transcript carries, by `tool_use_id`.
 *
 * WHY THIS EXISTS (2026-11-04T18:58Z run): counting ASSISTANT tool_use blocks does
 * not survive this harness's follow-up requests — the assistant echo is not there,
 * so every turn's counter stayed 0 and the mock re-issued the same call. Each turn
 * then burned its full 120 s settle timeout and issued a DUPLICATE tool call (two
 * rg spawns 121 s apart). Tool RESULTS are present and are keyed by id, so the
 * mock now decides on what it has actually been told back.
 */
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

/**
 * The member's eight-step script, one call per turn:
 *   grep in-lane -> grep outside ceiling -> grep outside restriction ->
 *   grep invalid pattern -> glob in-lane -> glob outside ceiling -> grep FIFO.
 * The FIFO call is LAST because it is the one that gets cancelled.
 *
 * The ANCHOR leader's script is the NEGATIVE CONTROL: before `team.create` it
 * greps the outside file with nothing confining it. That is what makes row 2
 * discriminating — the same search leaks when no Member realm exists.
 */
function makeDecide({ rowPaths, claims }) {
  return function decide({ req }) {
    const allText = messagesOf(req).map(textOf).join('\n')
    const lastUser = lastUserTextOfStatic(req)
    const userText = userTextOf(req)
    if (allText.includes('Generate the session title')) return { kind: 'text', content: 'a5sf search session' }

    // ── MEMBER LANE ────────────────────────────────────────────────────────
    if (userText.includes(`${MEMBER_ENVELOPE}${TOK_D1}`)) {
      // Sequenced by TOOL RESULTS (ids), not by assistant tool_use counts: this
      // harness does not echo the assistant tool_use block back, so a counter over
      // them never advances and the mock would re-issue call #1 forever.
      const seen = resultIdsOf(req)
      const chain = [
        [CALL_IDS.grepIn, 'grep', { pattern: claims.needle, path: rowPaths.inLaneDir }],
        [CALL_IDS.grepOutsideCeiling, 'grep', { pattern: claims.outsidePattern, path: rowPaths.outsideDir }],
        [CALL_IDS.grepOutsideRestriction, 'grep', { pattern: claims.restrictedPattern, path: rowPaths.restrictedFile }],
        [CALL_IDS.grepInvalid, 'grep', { pattern: 'A5SF_(', path: rowPaths.invalidDir }],
        [CALL_IDS.globIn, 'glob', { pattern: 'needle.txt', path: rowPaths.globDir }],
        [CALL_IDS.globOutside, 'glob', { pattern: 'secret.txt', path: rowPaths.outsideGlobDir }],
        [CALL_IDS.grepFifo, 'grep', { pattern: claims.fifoPattern, path: rowPaths.fifo }],
      ]
      for (const [id, name, args] of chain) {
        if (!seen.has(id)) return { kind: 'tool-call', toolCalls: [{ id, name, arguments: args }] }
      }
      return { kind: 'text', content: `${DONE_D1} ${lastToolResultText(req).slice(0, 160)}` }
    }

    // THE UNCONFINED CONTROL, on the anchor leader, before any Member exists.
    // Checked BEFORE the leader branch: the anchor persona mentions the lane name,
    // so a loose `allText.includes('A5SF_SEARCH')` predicate would send the anchor
    // into `team_delegate` and turn the control into a second, unconfined team.
    // THE LEADER GREP PROBE (retry ruling, condition 2): one unconfined grep on
    // the IN-LANE fixture, before team.create. It must succeed and return the
    // needle; the counter records `base-spawn-failed` with the Node cause, so a
    // failure here is attributable instead of a bare "ripgrep launch failed".
    if (lastUser.includes(MK_PROBE)) {
      if (!resultIdsOf(req).has('call-a5sfsrch-probe')) {
        return { kind: 'tool-call', toolCalls: [{ id: 'call-a5sfsrch-probe', name: 'grep', arguments: { pattern: claims.needle, path: rowPaths.inLaneDir } }] }
      }
      return { kind: 'text', content: 'A5SF_SEARCH_PROBE_DONE' }
    }

    if (lastUser.includes(MK_DISC)) {
      if (!resultIdsOf(req).has('call-a5sfsrch-control')) {
        return { kind: 'tool-call', toolCalls: [{ id: 'call-a5sfsrch-control', name: 'grep', arguments: { pattern: claims.outsidePattern, path: rowPaths.outsideDir } }] }
      }
      return { kind: 'text', content: 'A5SF_SEARCH_DISC_DONE' }
    }
    const isLeader = lastUser.includes(MK_L1) || allText.includes(MK_L1) || allText.includes('[team-work-settled')
    if (isLeader) {
      if (!resultIdsOf(req).has('call-a5sfsrch-delegate')) {
        return {
          kind: 'tool-call',
          toolCalls: [{ id: 'call-a5sfsrch-delegate', name: 'team_delegate', arguments: {
            rootSessionId: ACCEPTANCE_ROOT,
            requestToken: `${TOK_D1}-delegate`,
            delegationTemplateId: 'worker',
            label: 'a5sfsrch-worker',
            prompt: 'A5SF_SEARCH_WORK: run the eight-call search script from the evidence, one call at a time, then report.',
            async: false,
          } }],
        }
      }
      return { kind: 'text', content: DONE_L1 }
    }
    return { kind: 'text', content: 'A5SF_SEARCH_LIVE_NOOP' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// run helpers
// ─────────────────────────────────────────────────────────────────────────────

function assertCaseListMatchesContract() {
  const driver = [...CASES].sort()
  const contract = [...SEARCH_CASES].sort()
  if (driver.length !== contract.length || driver.some((id, index) => id !== contract[index])) {
    throw new Error(`the driver's case list has drifted from the search contract (driver=${JSON.stringify(driver)} contract=${JSON.stringify(contract)})`)
  }
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
function readLedgerRows(path) {
  return parseJsonl(path).filter((row) => row !== null && row !== undefined)
}
function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return null
  }
}

const RUN_ARCHIVE_FILES = [
  'run.log', 'run-record.json', 'oracle-samples.json', 'guard-facts.json', 'consultations.jsonl',
  'search-counter.jsonl', 'lane-report.json', 'teardown.json', 'ledger-rows.json',
  'boot-console.log', 'grant.json', 'negative-control.json',
]

function archivePreviousRun() {
  const present = RUN_ARCHIVE_FILES.filter((name) => existsSync(join(HERE, name)))
  if (present.length === 0) return null
  const stamp = new Date().toISOString().replace(/[:.]/gu, '-')
  const dir = join(HERE, 'runs', stamp)
  mkdirSync(dir, { recursive: true })
  for (const name of present) {
    try {
      renameSync(join(HERE, name), join(dir, name))
    } catch {
      /* keep going: one locked file must not stop the run */
    }
  }
  log(`previous run evidence archived: runs/${stamp} (${present.join(', ')})`)
  return `runs/${stamp}`
}

function runBindings(head, grant) {
  return {
    // EB3 RUN rule: a NEW record must bind the live authority generation. This driver predated the
    // rule and the gate (eb3-run-manifest --new-since) refused two records for the omission; the
    // helper is the one home for the stamp, so it is called here rather than hand-rolled.
    authority: readAuthorityBinding(REPO_ROOT),
    teamSha: head,
    hostSha: TEST_USE_BASELINE_SHA,
    hostTree: HOST_TREE,
    line: LINE,
    sink: 'world-home a5sf-consult.jsonl (copy: consultations.jsonl)',
    grantId: grant.grantId,
    allocationItem: grant.allocationItem,
    providerComposition: `test row ${relative(REPO_ROOT, EVIDENCE_ROW)} (no product provider exists at this base)`,
    laneAlgebra: 'packages/runtime/member-io-policy/src/path-rules.ts # intersectPathRuleSets / matchLocator (the product algebra; the lane INPUTS are fixtures)',
    providerCounter: 'installed by the SAME evidence row (config.counterPath): the shipped services have no counter; in-memory prototype wrap, pass-through',
    cancelTrigger: 'the SHIPPED client route /api/session/cancel (session-controller/commands.ts -> agent.cancel({kind:"user"})); no test route composes a cancel',
    negativeControl: 'the ANCHOR leader (no Member realm exists) greps the same outside file: it must succeed and leak, otherwise row 2 is vacuous',
  }
}

/** Copy the sink at the STOP time, before any post-stop probe. */
function writeConsultCopy(sourcePath) {
  const dest = join(HERE, 'consultations.jsonl')
  if (existsSync(sourcePath)) {
    writeFileSync(dest, readFileSync(sourcePath))
    return { copied: true, sha256: sha256(dest), bytes: readFileSync(dest).length }
  }
  writeFileSync(dest, '')
  return { copied: false, sha256: null, bytes: 0 }
}

// ─────────────────────────────────────────────────────────────────────────────
// --plan
// ─────────────────────────────────────────────────────────────────────────────

async function planOnly() {
  log(`PLAN MODE — no gate, no ledger row, no spawn. repo=${REPO_ROOT} hostTree=${HOST_TREE}`)
  assertCaseListMatchesContract()
  const wiring = assertDriverRootWiring()
  log(`root identity (plan): ${JSON.stringify(wiring)}`)
  const head = resolveHeadCommit(REPO_ROOT)
  log(`HEAD=${String(head)} pinnedHost=${TEST_USE_BASELINE_SHA}`)
  for (const [label, path] of [
    ['host tool-fs', HOST_TOOL_FS],
    ['host tool-fs-search', HOST_TOOL_FS_SEARCH],
    ['evidence row', EVIDENCE_ROW],
    ['dist install', join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'team-services', 'src', 'install.js')],
    ['dist subprocess', join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'team-services', 'src', 'subprocess.js')],
  ]) {
    log(`${label}: ${path} exists=${existsSync(path)}${existsSync(path) ? ` sha256=${sha256(path).slice(0, 16)}` : ''}`)
  }
  const attachments = attachmentsProviderComposition()
  log(`attachments provider composition: mounted=${String(attachments.mounted)}`)
  if (!attachments.mounted) throw new Error('BLOCKER: the pinned World composition does not mount @deepseek-ai/dsh-attachment-local, so the native tool-fs module cannot shadow read_image')
  const anchor = assertBlueprintText(BP_ANCHOR_YAML, BP_ANCHOR_ID, 1, 'anchor.yaml')
  const main = assertBlueprintText(mainBlueprintYaml(['u6fs_probe', 'grep']), BP_MAIN_ID, 1, 'main.yaml')
  log(`blueprint ingest: anchor=${JSON.stringify(anchor)} main=${JSON.stringify(main)}`)
  // The emitted patch, over a throwaway home (no World, no ledger row).
  const dry = rowsFor({ home: join(HERE, '.rowcheck'), workspaceDir: HERE })
  const identity = rowIdentityCheck(dry.rows)
  log(`row identity check: ${JSON.stringify(identity).slice(0, 700)}`)
  if (identity.ok !== true) throw new Error(`row composition refused: ${identity.reason}: ${identity.detail}`)
  const patch = emitPatchLayer([
    'a5sf search-live boot: confined member realm (fs + subprocess) + production Team row',
    'with a5sfEvidencePath + a5sfNativeToolModules + a5sfExpectedTools + p6t6 + preset declaration.',
  ], dry.rows)
  // CONTENT-BEARING HANDOFF PROOF, host-free: run the SAME function boot() runs
  // against a probe, and compare the ids it hands over with the ids the patch
  // text carries. A length check would have passed the 2026-11-04 attempt.
  const probeWorld = { u6Fs: { rows: [] } }
  handOverRows(probeWorld, dry.rows)
  const emittedRowIds = emittedRowIdsOf(patch)
  const worldRowIds = probeWorld.u6Fs.rows.map((row) => row.id)
  const planRows = {
    schema: 'a5sf-search-live/plan-rows/1',
    at: new Date().toISOString(),
    head,
    patchBytes: patch.length,
    patchSha256: createHash('sha256').update(patch).digest('hex'),
    emittedRowIds,
    worldRowIds,
    identityHolds: emittedRowIds.length === worldRowIds.length && emittedRowIds.every((id, index) => id === worldRowIds[index]),
    healthProbeRowPresent: worldRowIds.includes('p6t6-team-tools'),
    allFourRowsPresent: ['a5sf-search-realm', 'dsh-agent-team', 'p6t6-team-tools', 'preset-a5sf-search-base'].every((id) => worldRowIds.includes(id)),
    handoff: {
      usesHandOverRows: /handOverRows\(world, rows\)/u.test(readFileSync(fileURLToPath(import.meta.url), 'utf8')),
      beforeBoot: readFileSync(fileURLToPath(import.meta.url), 'utf8').indexOf('handOverRows(world, rows)') < readFileSync(fileURLToPath(import.meta.url), 'utf8').indexOf('harness.boot('),
    },
  }
  writeFileSync(PLAN_ROWS_PATH, JSON.stringify(planRows, null, 2) + '\n')
  // THE LANE INPUTS, as the boot will compose them. Not a decision: the dry run
  // runs `rowPathsOf` (this function) inside `--plan`, so the artifact carries
  // the SAME paths `boot()` will hand to the row, and the dry run checks the
  // FIFO's position against the product algebra itself. A FIFO one directory
  // outside the restriction (`lane/blocking.fifo`) passed every text-level check
  // and cost the 2026-11-04T19:17Z run 240 s and all six rows.
  const planPaths = {
    schema: 'a5sf-search-live/plan-paths/1',
    at: new Date().toISOString(),
    head,
    /** The ceiling READ allow list the row compiles from `allowRoot`. */
    ceilingReadAllow: [dry.paths.workspace],
    /** The narrower tool restriction the row compiles from config. */
    restrictionReadAllow: [...dry.paths.restrictionReadAllow],
    inLaneDir: dry.paths.inLaneDir,
    inLaneFile: dry.paths.inLaneFile,
    restrictedFile: dry.paths.restrictedFile,
    outsideFile: dry.paths.outsideFile,
    outsideGlobFile: dry.paths.outsideGlobFile,
    /** The cancellation operand: it must be ADMITTED by the effective lane. */
    fifo: dry.paths.fifo,
  }
  writeFileSync(PLAN_PATHS_PATH, JSON.stringify(planPaths, null, 2) + '\n')
  log(`plan paths: ${JSON.stringify({ ceilingReadAllow: planPaths.ceilingReadAllow, restrictionReadAllow: planPaths.restrictionReadAllow, fifo: planPaths.fifo })}`)
  log(`plan rows: ${JSON.stringify({ emittedRowIds, worldRowIds, identityHolds: planRows.identityHolds, healthProbeRowPresent: planRows.healthProbeRowPresent, allFourRowsPresent: planRows.allFourRowsPresent, handoff: planRows.handoff })}`)
  if (planRows.identityHolds !== true) throw new Error(`the emitted rows and the rows handed to the World DIFFER: emitted=${JSON.stringify(emittedRowIds)} world=${JSON.stringify(worldRowIds)} — this is the 2026-11-04 defect`)
  if (planRows.healthProbeRowPresent !== true || planRows.allFourRowsPresent !== true) throw new Error(`the World would not compose the health probe and the four evidence rows: ${JSON.stringify(worldRowIds)}`)
  if (planRows.handoff.usesHandOverRows !== true || planRows.handoff.beforeBoot !== true) throw new Error('the handoff is not a `handOverRows(world, rows)` call before `harness.boot(`')
  log(`patch layer bytes=${patch.length}; rows=${dry.rows.map((r) => r.id).join(',')}`)
  log('---- patch layer ----\n' + patch + '\n---- end patch ----')
  const provider = await import(pathToFileURL(EVIDENCE_ROW).href)
  log(`provider row: name=${provider.name} apply=${typeof provider.apply} inject=${JSON.stringify(provider.inject)}`)
  if (typeof provider.apply !== 'function') throw new Error('the evidence provider row exports no apply()')
  const lane = await import(pathToFileURL(join(REPO_ROOT, 'tests', 'world-factory', 'lib', 'a5sf-search-live.mjs')).href)
  log(`oracle: cases=${lane.SEARCH_CASES.length} first=${lane.SEARCH_CASES[0]}`)
  // The EMITTED dist must carry BL-16/BL-17 (an interface name is erased by
  // tsc, so the check is on the emitted FUNCTIONS, not the type).
  const installJs = readFileSync(join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'team-services', 'src', 'install.js'), 'utf8')
  const subprocessJs = readFileSync(join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'team-services', 'src', 'subprocess.js'), 'utf8')
  const distFace = {
    mountsConfinedSubprocess: installJs.includes('createConfinedSubprocessClass'),
    statesFacesTotal: installJs.includes('faces'),
    typedRefusalConstant: subprocessJs.includes('SUBPROCESS_GUARD_METHOD'),
    staticProgramAllowList: subprocessJs.includes('CONFINED_SUBPROCESS_STATIC_PROGRAMS'),
  }
  log(`dist confined-subprocess face: ${JSON.stringify(distFace)}`)
  if (distFace.mountsConfinedSubprocess !== true || distFace.staticProgramAllowList !== true) {
    throw new Error(`the emitted dist does NOT carry the BL-16 confined subprocess face (${JSON.stringify(distFace)}); run pnpm run build before spending a boot`)
  }
  // The run-record literal is exercised host-free so a broken string cannot
  // cost a start (the 2026-11-04 `homePin` lesson).
  log(`runBindings probe: ${JSON.stringify(runBindings(head === null ? 'plan-probe' : String(head), { grantId: 'plan-probe', allocationItem: 'P2-04 grep (BL-16)' })).slice(0, 500)}`)
  log('PLAN OK')
}

// ─────────────────────────────────────────────────────────────────────────────
// boot
// ─────────────────────────────────────────────────────────────────────────────

async function boot() {
  log(`repo=${REPO_ROOT} hostTree=${HOST_TREE} pin=${TEST_USE_BASELINE_SHA} startedAt=${startedAt}`)
  assertCaseListMatchesContract()
  const wiring = assertDriverRootWiring()
  log(`root identity: ${JSON.stringify(wiring)}`)
  const head = resolveHeadCommit(REPO_ROOT)
  if (head === null) throw new Error('git rev-parse HEAD failed: the grant cannot be bound')
  log(`HEAD=${head}`)
  if (!existsSync(HOST_TOOL_FS_SEARCH)) throw new Error(`the host search module is missing: ${HOST_TOOL_FS_SEARCH}`)

  // Composition precondition: never spend a start on a row-identity defect.
  const dry = rowsFor({ home: join(HERE, '.rowcheck'), workspaceDir: HERE })
  const identity = rowIdentityCheck(dry.rows)
  log(`pre-boot row identity check: ${JSON.stringify(identity).slice(0, 800)}`)
  if (identity.ok !== true) throw new Error(`row composition refused before any ledger row: ${identity.reason}: ${identity.detail}`)

  // ── the per-run grant, bound to the EXACT HEAD this run executes on ──────
  const archivedPreviousRun = archivePreviousRun()
  const ledgerRowsSoFar = readLedgerRows(LEDGER_PATH)
  const priorRows = ledgerRowsSoFar.length
  const priorBoots = ledgerRowsSoFar.filter((row) => String(row?.phase ?? '').startsWith('a5sf-search-boot')).length
  const bootSequence = priorBoots + 1
  // THE BUDGET IS THE RULING FILE, not a constant this driver may raise itself.
  // `authorisedStarts` sums named rulings; a start without a named ruling is a
  // self-authorisation and is refused here, before any ledger row exists.
  const ruling = readRuling()
  if (bootSequence > ruling.starts) {
    const refusal = new Error(`BUDGET_NOT_GRANTED reason=DEDICATED_ALLOCATION_EXHAUSTED: lane-ruling.json authorises ${String(ruling.starts)} start(s) (${ruling.rulings.map((row) => String(row.by)).join('; ')}) and the shared ledger already holds ${String(priorBoots)} boot row(s); a further start needs a NEW ruling entry, not a retry`)
    refusal.code = 'BUDGET_NOT_GRANTED'
    refusal.reason = 'DEDICATED_ALLOCATION_EXHAUSTED'
    refusal.detail = `authorised starts=${ruling.starts} ledger boot rows=${priorBoots}`
    throw refusal
  }
  log(`boot sequence: ${String(bootSequence)} of ${String(ruling.starts)} authorised P2-04 start(s) (ledger boot rows=${String(priorBoots)}; rulings: ${ruling.rulings.map((row) => `${String(row.starts)}x ${String(row.by)}`).join(' | ')})`)
  const grant = {
    grantId: `grant-a5sf-search-${head.slice(0, 12)}-b${String(bootSequence)}`,
    maxStarts: priorRows + 2,
    grantedBy: ruling.rulings.map((row) => `${String(row.starts)} start(s) by ${String(row.by)}: ${String(row.reason)}`).join(' || '),
    allocationItem: 'P2-04 grep (BL-16)',
    boundCommit: head,
    note: `maxStarts = ${String(priorRows)} prior shared-ledger row(s) + 1 pre-registration (intent) row + 1 boot = ${String(priorRows + 2)}; the BL-14 gate counts shared-ledger rows, not spawns`,
    bootSequence,
    authorisedStarts: ruling.starts,
    rulingPath: RULING_PATH,
  }
  writeFileSync(GRANT_PATH, JSON.stringify(grant, null, 2) + '\n')
  log(`grant materialised: ${GRANT_PATH} maxStarts=${grant.maxStarts} boundCommit=${grant.boundCommit} item=${grant.allocationItem}`)

  const runId = `a5sf-search-${new Date().toISOString().replace(/[:.]/gu, '-')}`
  const record = createRunRecord({
    runId,
    suite: 'a5sf-search',
    selectedCases: CASES,
    bindings: runBindings(head, grant),
    ledgerPath: LEDGER_PATH,
  })
  const harness = createA5sfHarness({
    repoRoot: REPO_ROOT,
    evidenceRoot: HERE,
    suite: 'a5sf-search',
    line: LINE,
    runRecord: record,
    maxHostStarts: grant.maxStarts,
    hostTree: HOST_TREE,
  })
  const factory = harness.factory
  log(`candidate asserted: ${JSON.stringify(harness.assertCandidate())}`)

  const lease = await preRegisterReadBudget({
    grantPath: GRANT_PATH,
    headCommit: head,
    runRecord: record,
    requiredBoots: 1,
  })
  log(`gate lease: grant=${lease.grant.grantId} intentRows=${lease.intentRows().length} rowsBeforeIntent=${lease.rowsBefore} rowsAfterIntent=${lease.rowsAfterIntent} remaining=${lease.position.remaining}`)

  const add = (id, verdict, detail = {}) => {
    record.addCase(id, verdict, detail)
    log(`case ${id}: ${verdict} ${JSON.stringify(detail).slice(0, 600)}`)
  }

  let world = null
  let bootInfo = null
  let teardown = null
  let failure = null
  let hostReached = false
  let abortStage = 'pre-boot'
  let abortStageDetail = 'fixtures / rows / grant / policy before any Host exists'
  /** What the catch can still inspect: set as soon as each path exists. */
  const stageCtx = {
    rows: null, paths: null, counterPath: null, laneReportPath: null, sinkPath: null,
    composedProfile: null, member: null,
    /** The evidence the ABORT path must be able to re-judge from: the lane
     *  inputs, the counter slice that excludes the pre-realm control, the
     *  cancellation answer and the claims. Without these, an abort can only
     *  report "nothing was measured" — which is what the 2026-11-04T19:17Z run
     *  did with seven facts in hand. */
    claims: null, counterPrefixEnd: null, cancelCall: null,
    /** Set once the sink/counter transcript copier exists, so the abort path
     *  uses it instead of a second, drifting copy implementation. */
    persistRunChannels: null,
  }
  const oracleSamples = {}
  const negativeControl = { sample: null, verdict: null }

  // ── THE PARTIAL-RUN MACHINERY ───────────────────────────────────────────
  // The sample builders live in ONE place so the success path and the ABORT
  // path cannot drift: an abort that rebuilt samples its own way would be a
  // second oracle. `settledSamples()` reads only what exists at the call site
  // (sink facts, counter rows, lane report, mock transcript), and the judges
  // decide the rest.
  const readSinkFacts = () => {
    try { return parseJsonl(stageCtx.sinkPath).filter((f) => f?.schema === 'a5sf-guard-consult/1') } catch { return [] }
  }
  const readCounterRows = () => {
    try {
      const all = parseJsonl(stageCtx.counterPath)
      const from = stageCtx.counterPrefixEnd === null ? 0 : stageCtx.counterPrefixEnd
      return all.slice(from)
    } catch { return [] }
  }
  const readLaneReport = () => {
    try { return stageCtx.laneReportPath !== null && existsSync(stageCtx.laneReportPath) ? readJson(stageCtx.laneReportPath) : null } catch { return null }
  }
  const settledSamples = ({ requests = [], includeFifo = false } = {}) => {
    const allFacts = readSinkFacts()
    const allRecords = readCounterRows()
    const laneReport = readLaneReport()
    const claimsNow = stageCtx.claims
    const p = stageCtx.paths
    if (p === null || claimsNow === null) return {}
    const resultOf = (callId) => toolResultFor(requests, callId)
    const normPath = (value) => String(value ?? '').replace(/\/+$/u, '')
    const recordsFor = (operand) => allRecords.filter((row) => (row?.argv ?? []).some((a) => normPath(a) === normPath(operand)))
    const factsFor = (operand) => allFacts.filter((f) => normPath(f?.locator) === normPath(operand))
    const samples = {
      [SEARCH_CASE_IDS.row1]: {
        result: resultOf(CALL_IDS.grepIn),
        facts: factsFor(p.inLaneDir),
        records: recordsFor(p.inLaneDir),
        declaredRoot: p.inLaneDir,
        needle: claimsNow.needle,
        fileName: 'needle.txt',
      },
      [SEARCH_CASE_IDS.row2]: {
        result: resultOf(CALL_IDS.grepOutsideCeiling),
        facts: factsFor(p.outsideDir),
        records: recordsFor(p.outsideDir),
        declaredRoot: p.outsideDir,
        forbidden: [claimsNow.outsideClaim, claimsNow.outsideSecond],
      },
      [SEARCH_CASE_IDS.row3]: {
        result: resultOf(CALL_IDS.grepOutsideRestriction),
        facts: factsFor(p.restrictedFile),
        records: recordsFor(p.restrictedFile),
        declaredRoot: p.restrictedFile,
        forbidden: [claimsNow.restrictedClaim],
        laneReport,
      },
      [SEARCH_CASE_IDS.row5]: {
        result: resultOf(CALL_IDS.grepInvalid),
        facts: factsFor(p.invalidDir),
        records: recordsFor(p.invalidDir),
        declaredRoot: p.invalidDir,
        pattern: 'A5SF_(',
      },
    }
    if (includeFifo) {
      samples[SEARCH_CASE_IDS.row4] = {
        result: resultOf(CALL_IDS.grepFifo),
        facts: factsFor(p.fifo),
        records: recordsFor(p.fifo),
        declaredRoot: p.fifo,
        needle: claimsNow.needle,
        interrupt: stageCtx.cancelCall === null ? null : { status: stageCtx.cancelCall.status, ok: stageCtx.cancelCall.status === 200 && stageCtx.cancelCall.body?.ok === true },
        transcriptAfterCall: '',
      }
    }
    return samples
  }
  /**
   * Judge every SETTLED row whose sample is COMPLETE, and nothing else. An
   * incomplete sample is NOT frozen here: its call may still be in flight, and
   * freezing "not reached" would be its own inaccuracy. Only the abort path
   * (which knows the run stopped) is allowed to turn incompleteness into
   * NOT_REACHED.
   */
  const judgeSettledRows = (stage, { includeFifo = false } = {}) => {
    const requests = world?.mock?.requests ?? []
    const samples = settledSamples({ requests, includeFifo })
    const judgedNow = []
    for (const [id, sample] of Object.entries(samples)) {
      if (oracleSamples[id] !== undefined) continue
      const completeness = sampleCompleteness(id, sample)
      if (completeness.complete !== true) continue
      const judged = judgeCase(id, sample, { stage })
      oracleSamples[id] = { sample, ...judged, judgedAtStage: stage }
      add(id, judged.verdict, {
        status: judged.status,
        reason: judged.reason,
        failed: judged.failed,
        sampleComplete: judged.sampleComplete,
        missing: judged.missing,
        judgedAtStage: stage,
      })
      judgedNow.push(`${id}=${judged.verdict}`)
    }
    log(`judged ${String(judgedNow.length)} settled row(s) at ${stage}${judgedNow.length === 0 ? '' : `: ${judgedNow.join(' ')}`}`)
    return judgedNow
  }

  try {
    world = await harness.createWorld({ line: LINE, u6Fs: { rows: [] } })
    const { rows, config, paths } = rowsFor({ home: world.home, workspaceDir: world.workspaceDir })
    // THE HANDOFF. `emitPatchLayer` only BUILDS the text; the World composes the
    // profile it boots from `world.u6Fs.rows`, so a row set that is emitted but
    // never pushed boots a BARE World. That is what the first attempt did on
    // 2026-11-04T15:36Z: the composed profile carried only the base bundle, so
    // `/__p6t6/health` never existed and the run aborted with FAIL:6/6 — a
    // DRIVER defect, not a product finding. `handOverRows` is the one place this
    // happens, `--plan` runs it against a probe and writes `plan-rows.json`, and
    // `go-no-go.mjs` compares that identity (content, not length) before any
    // start is spent.
    handOverRows(world, rows)
    const claims = {
      needle: `A5SF_SEARCH_NEEDLE_${world.id}`,
      outsideClaim: `A5SF_SEARCH_OUTSIDE_SECRET_${world.id}`,
      outsideSecond: `A5SF_SEARCH_OUTSIDE_SECOND_${world.id}`,
      outsidePattern: 'A5SF_SEARCH_OUTSIDE',
      restrictedClaim: `A5SF_SEARCH_RESTRICTION_ONLY_${world.id}`,
      restrictedPattern: 'A5SF_SEARCH_RESTRICTION',
      fifoPattern: 'A5SF_SEARCH_FIFO',
    }
    stageCtx.claims = claims
    const sinkPath = join(world.home, 'a5sf-consult.jsonl')
    stageCtx.rows = rows
    stageCtx.paths = paths
    stageCtx.sinkPath = sinkPath
    const counterPath = join(world.home, COUNTER_NAME)
    const laneReportPath = join(world.home, LANE_REPORT_NAME)
    stageCtx.counterPath = counterPath
    stageCtx.laneReportPath = laneReportPath
    const homePin = homeSandboxPin({ home: world.home, workspaceRoot: world.workspaceDir })

    const evidence = {
      worldId: world.id,
      homePatch: { path: homePin.path, mode: homePin.mode, workspaceRoot: homePin.workspaceRoot },
      fixtures: {
        workspace: paths.workspace,
        inLaneDir: paths.inLaneDir,
        inLaneFile: paths.inLaneFile,
        restrictedFile: paths.restrictedFile,
        outsideDir: paths.outsideDir,
        outsideFile: paths.outsideFile,
        outsideGlobDir: paths.outsideGlobDir,
        invalidDir: paths.invalidDir,
        globDir: paths.globDir,
        fifo: paths.fifo,
        ceiling: { read: paths.workspace, write: paths.workspace },
        restrictionReadAllow: paths.restrictionReadAllow,
        effectiveRead: paths.restrictionReadAllow,
      },
      claims,
      sinkPath,
      counterPath,
      laneReportPath,
    }
    writeFileSync(join(HERE, 'fixtures.json'), JSON.stringify(evidence, null, 2) + '\n')

    mkdirSync(config.blueprintDir, { recursive: true })
    writeFileSync(join(config.blueprintDir, 'anchor.yaml'), BP_ANCHOR_YAML)
    writeFileSync(join(config.blueprintDir, 'main.yaml'), mainBlueprintYaml([]))
    writeFileSync(join(world.home, 'p6t6-directive.json'), JSON.stringify(p6t6Directive({ worldId: world.id, logDir: world.logDir }), null, 2))
    assertBlueprintText(BP_ANCHOR_YAML, BP_ANCHOR_ID, 1, 'anchor.yaml')

    // ── the fixtures ────────────────────────────────────────────────────────
    for (const dir of [paths.inLaneDir, paths.invalidDir, paths.globDir, paths.outsideDir, paths.outsideGlobDir]) {
      mkdirSync(dir, { recursive: true })
    }
    writeFileSync(paths.inLaneFile, `${claims.needle}\nplain second line\n`)
    writeFileSync(join(paths.invalidDir, 'other.txt'), 'no needle here\n')
    writeFileSync(join(paths.globDir, 'needle.txt'), `${claims.needle}\n`)
    writeFileSync(paths.restrictedFile, `${claims.restrictedClaim}\n`)
    writeFileSync(paths.outsideFile, `${claims.outsideClaim}\n${claims.outsideSecond}\n`)
    writeFileSync(paths.outsideGlobFile, `${claims.outsideClaim}\n`)
    // THE CANCELLATION WINDOW: ripgrep blocks on a FIFO named as an EXPLICIT
    // operand (measured in BL-16 §6.3; a directory traversal skips it). That is
    // what keeps the process alive long enough to be cancelled.
    try {
      execFileSync('mkfifo', [paths.fifo], { stdio: 'ignore' })
    } catch (error) {
      throw new Error(`cannot create the FIFO cancellation window (${paths.fifo}): ${String(error?.message ?? error)} — without it row 4 has no measurable window and the boot must not be spent`)
    }
    log(`fixtures: in=${paths.inLaneFile} restricted=${paths.restrictedFile} outside=${paths.outsideFile} fifo=${paths.fifo}`)
    log(`rows: ${rows.map((r) => r.id).join(',')}`)
    log(`team row a5sfEvidencePath=${String(config.a5sfEvidencePath)} modules=${JSON.stringify(config.a5sfNativeToolModules)}`)

    writeFileSync(homePin.path, homePin.yaml)
    const homePinRead = readFileSync(homePin.path, 'utf8')
    if (homePinRead !== homePin.yaml) throw new Error(`the home patch did not persist verbatim: ${homePin.path}`)
    log(`home patch written: ${homePin.path} sha256=${sha256(homePin.path).slice(0, 16)}`)

    await world.startMock({ decide: makeDecide({ rowPaths: paths, claims }) })
    log(`mock started on ${String(world.mock?.port)}`)

    // ── THE BOOT (the only one) ─────────────────────────────────────────────
    bootInfo = await lease.boot(() => harness.boot({ world, phase: 'a5sf-search-boot1', bootTimeoutMs: 240_000 }))
    hostReached = true
    // STAGE 1 of the taxonomy: COMPOSITION. The Host has started; the first
    // question is whether the profile it composed carries the rows it was given.
    // This is checked BEFORE the health poll so a handoff failure reports itself
    // in seconds and with the missing ids, not as a 120 s "the route never
    // answered" (the 2026-11-04 attempt's only symptom).
    abortStage = 'composition'
    const expectedRowIds = rows.map((row) => row.id)
    const composedProfile = await waitForComposedProfile(world, expectedRowIds, 30_000)
    stageCtx.composedProfile = composedProfile
    log(`composed profile: ${JSON.stringify({ path: composedProfile.path, presentRowIds: composedProfile.presentRowIds, missingRowIds: composedProfile.missingRowIds })}`)
    // ABSENCE of the profile file is NOT evidence that the rows are missing: it
    // may be a naming/path change. Only a profile that EXISTS and lacks a handed
    // row is a composition failure; otherwise the health probe decides.
    if (composedProfile.path === null) {
      log('composed profile: NOT FOUND under the world log dir within 30s — the health probe decides (a path change is not evidence of a missing row)')
    } else if (composedProfile.missingRowIds.length > 0) {
      throw new Error(`COMPOSITION_ROWS_MISSING: the profile the Host composed is missing ${JSON.stringify(composedProfile.missingRowIds)} of the rows it was handed (${JSON.stringify(expectedRowIds)}); present=${JSON.stringify(composedProfile.presentRowIds)} at ${String(composedProfile.path)} — this is the composition handoff, not the product`)
    }
    log(`BOOTED port=${bootInfo.port} (lease bootsSpent=${lease.bootsSpent()}) log=${bootInfo.logPath}`)
    record.record.boots = [{ phase: 'a5sf-search-boot1', world: world.id, port: bootInfo.port, logPath: bootInfo.logPath }]

    const origin = `http://127.0.0.1:${bootInfo.port}`
    const hostAlive = () => world.instance?.child !== null && world.instance?.child !== undefined && world.instance?.child.exitCode === null
    const cookie = await authenticate(origin, world.token)
    log('authenticated (token never recorded)')

    const waitFor = async (predicate, timeoutMs, everyMs = 250) => {
      const t0 = Date.now()
      for (;;) {
        let hit = false
        try {
          hit = (await predicate()) === true
        } catch {
          hit = false
        }
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

    // ── CONDITION 2: the leader grep probe, and the channels it writes ──────
    // `persistRunChannels` copies the counter and the fact sink OUT of the World
    // home. Teardown deletes the home, and that is what swallowed F1's cause
    // twice: the instrument's own record died with the world it was measuring.
    const persistRunChannels = (label) => {
      const out = {}
      for (const [name, source] of [['search-counter.jsonl', stageCtx.counterPath], ['consultations.jsonl', stageCtx.sinkPath]]) {
        try {
          if (source === null) continue
          if (!existsSync(source)) { out[name] = 'absent'; continue }
          const bytes = readFileSync(source)
          writeFileSync(join(HERE, name), bytes)
          out[name] = `${String(bytes.length)} bytes`
        } catch (error) { out[name] = `copy failed: ${String(error?.message ?? error)}` }
      }
      // THE THIRD CHANNEL: the mock transcript. It carries the TOOL RESULTS —
      // the bytes every row judge compares against — and it lived only in this
      // process's memory until now. That is exactly why attempt 6's seven facts
      // could not be re-judged offline: the sink and the counter were copied out,
      // the results were not.
      out['mock-requests.json'] = writeMockTranscript(world, label)
      log(`run channels persisted (${label}): ${JSON.stringify(out)}`)
      return out
    }
    stageCtx.persistRunChannels = persistRunChannels

    const counterPrefixEndAtProbe = parseJsonl(counterPath).length
    abortStage = 'leader-grep-probe'
    abortStageDetail = 'the anchor leader must be able to grep the in-lane file through the base subprocess face; a failure here makes the negative control vacuous'
    const probePrompt = await apiPrompt(origin, cookie, BOOT_ROOT, MK_PROBE, 'a5sfsrch')
    const probeDone = await waitFor(() => (world.mock?.requests ?? []).some((r) => r.reply?.kind === 'text' && String(r.reply.content ?? '').startsWith('A5SF_SEARCH_PROBE_DONE')), 120_000)
    await new Promise((r) => setTimeout(r, 500))
    const probeRequests = world.mock?.requests ?? []
    const probeCall = probeRequests.flatMap((r) => messagesOf(r)).flatMap((m) => (Array.isArray(m?.content) ? m.content : []))
      .find((b) => b?.type === 'tool_use' && b?.name === 'grep' && String(b?.input?.path ?? '') === paths.inLaneDir) ?? null
    const probeResult = probeCall === null ? null : toolResultFor(probeRequests, probeCall.id)
    const probeText = String(probeResult?.text ?? '')
    const probeCounter = parseJsonl(counterPath).slice(counterPrefixEndAtProbe)
    const probeRowsForOperand = probeCounter.filter((row) => (row?.argv ?? []).some((a) => String(a) === paths.inLaneDir))
    const probeArtifact = {
      schema: 'a5sf-search-live/leader-grep-probe/1',
      at: new Date().toISOString(),
      stage: 'before team.create, no Member realm exists',
      promptStatus: probePrompt.status,
      turnSettled: probeDone,
      toolResult: probeResult,
      success: probeResult !== null && probeResult.isError !== true && probeText.includes(claims.needle),
      counterRowsForOperand: probeRowsForOperand,
      baseSpawnRows: probeRowsForOperand.filter((row) => row?.leg === 'base-spawn').length,
      baseSpawnFailedRows: probeRowsForOperand.filter((row) => row?.leg === 'base-spawn-failed'),
      factsBeforeRealm: parseJsonl(sinkPath).filter((f) => f?.schema === 'a5sf-guard-consult/1').length,
      note: 'base-spawn-failed carries the Node cause (name/code/errno/syscall/path/message) and whether argv[0] and the cwd existed: a launch failure can never again be recorded as a successful spawn',
    }
    writeFileSync(join(HERE, 'probe-leader-grep.json'), JSON.stringify(probeArtifact, null, 2) + '\n')
    persistRunChannels('after leader grep probe')
    log(`LEADER GREP PROBE: success=${String(probeArtifact.success)} baseSpawn=${String(probeArtifact.baseSpawnRows)} failed=${String(probeArtifact.baseSpawnFailedRows.length)} facts=${String(probeArtifact.factsBeforeRealm)}`)
    if (probeArtifact.success !== true) {
      throw new Error(`LEADER_GREP_PROBE_FAILED: the anchor leader's unconfined grep did not return the needle (isError=${String(probeResult?.isError)}); text=${redact(probeText).slice(0, 200)}; base-spawn-failed=${JSON.stringify(probeArtifact.baseSpawnFailedRows).slice(0, 600)} — the base subprocess face cannot launch rg, so the negative control is vacuous and no Member row can be measured`)
    }

    // ── THE NEGATIVE CONTROL, before any Member exists ──────────────────────
    abortStage = 'negative-control'
    abortStageDetail = 'the anchor leader (no Member realm) must grep the out-of-lane file and LEAK; a refusal here means the control is vacuous'
    const discPrompt = await apiPrompt(origin, cookie, BOOT_ROOT, MK_DISC, 'a5sfsrch')
    log(`discovery prompt status=${String(discPrompt.status)}`)
    const controlDone = await waitFor(() => (world.mock?.requests ?? []).some((r) => r.reply?.kind === 'text' && String(r.reply.content ?? '').startsWith('A5SF_SEARCH_DISC_DONE')), 180_000)
    await new Promise((r) => setTimeout(r, 800))
    const controlRequests = world.mock?.requests ?? []
    const controlCall = controlRequests.flatMap((r) => messagesOf(r)).flatMap((m) => (Array.isArray(m?.content) ? m.content : []))
      .find((b) => b?.type === 'tool_use' && b?.name === 'grep' && String(b?.input?.path ?? '') === paths.outsideDir) ?? null
    const controlResult = controlCall === null ? null : toolResultFor(controlRequests, controlCall.id)
    const counterAtControl = parseJsonl(counterPath)
    const controlSample = {
      result: controlResult,
      forbidden: [claims.outsideClaim, claims.outsideSecond],
      guardFactsBeforeRealm: parseJsonl(sinkPath).filter((f) => f?.schema === 'a5sf-guard-consult/1'),
      baseSpawns: counterAtControl.filter((row) => row?.leg === 'base-spawn'),
      confinedSpawns: counterAtControl.filter((row) => row?.leg === 'confined-spawn'),
      controlDone,
    }
    const counterPrefixEnd = parseJsonl(counterPath).length
    // The abort path slices the counter at the same boundary: everything before
    // this index belongs to the leader probe / the unconfined control and must
    // never be counted as a Member row's process.
    stageCtx.counterPrefixEnd = counterPrefixEnd
    const control = judgeNegativeControl(controlSample)
    negativeControl.sample = controlSample
    negativeControl.verdict = control
    log(`NEGATIVE CONTROL: verdict=${control.verdict} reason=${control.reason} failed=${JSON.stringify(control.failed)} detail=${JSON.stringify(control.detail).slice(0, 700)}`)
    writeFileSync(join(HERE, 'negative-control.json'), JSON.stringify({ sample: controlSample, verdict: control }, null, 2) + '\n')

    // ── team.create + state ─────────────────────────────────────────────────
    abortStage = 'surface'
    abortStageDetail = 'the discovery turn must expose `grep` on the model-visible surface of the anchor preset'
    const discoveryRequest = controlRequests[controlRequests.length - 1] ?? null
    const surface = discoveryRequest === null ? [] : [...new Set(surfaceNamesOf(discoveryRequest))].sort()
    // `grep`/`glob` are deliberately NOT in the exemption: on the leader they are
    // unmanaged and the coverage gate refuses them (see LEADER_MANAGED_TOOL_NAMES).
    const denyList = surface.filter((n) => !String(n).startsWith('team_') && !LEADER_MANAGED_TOOL_NAMES.includes(n) && !SAFE_UNMANAGED_TOOL_NAMES.includes(n))
    log(`model-visible surface (${String(surface.length)}): ${surface.join(',')}`)
    log(`builtinToolDeny base list: ${denyList.join(',')}`)
    if (!surface.includes('grep')) {
      throw new Error(`the model-visible surface has no \`grep\`: ${surface.join(',')} — the preset did not expose the search module, so no row can be measured (a composition failure, not a row result)`)
    }
    const mainText = mainBlueprintYaml(denyList)
    assertBlueprintText(mainText, BP_MAIN_ID, 1, 'main.yaml')
    writeFileSync(join(config.blueprintDir, 'main.yaml'), mainText)
    log('main blueprint written and validated by the host facade')

    abortStage = 'team-create'
    abortStageDetail = 'team.create must accept the main blueprint (leader + worker template + preset), or the Team row is not composed'
    // THE CANCELLATION WINDOW OPENS INSIDE `team.create`, NOT AFTER IT.
    // `initialWork` makes the create call wait for the leader's first turn, and that
    // turn is the synchronous delegate: leader -> member -> the member's FIFO grep,
    // which blocks. So the ONLY moment at which the FIFO search is in flight is
    // while the create promise is unresolved (attempt 7, 2026-11-04T20:07Z: the
    // child was already gone — exit 143 from the module's OWN 30 s timeout — by the
    // time the driver got control back, and the cancel arrived 0.9 s too late).
    // Therefore: issue the create, and watch + interrupt CONCURRENTLY.
    const createPromise = remoteCall(fetchJson, origin, cookie, 'team.create', {
      rootSessionId: ACCEPTANCE_ROOT,
      blueprintId: BP_MAIN_ID,
      initialWork: { prompt: MK_L1 },
    }, 'a5sfsrch')
    const cancelWatch = (async () => {
      const deadline = Date.now() + 180_000
      let spawnSeen = null
      let session = ''
      while (Date.now() < deadline) {
        const rows = parseJsonl(counterPath)
        spawnSeen = rows.find((row) => row?.leg === 'confined-spawn' && (row?.argv ?? []).some((a) => String(a) === paths.fifo || String(a).endsWith('/blocking.fifo'))) ?? null
        if (spawnSeen !== null) {
          try {
            const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 10_000)
            const worker = (Array.isArray(st.body?.members) ? st.body.members : []).find((m) => String(m?.templateId) === 'worker' && String(m?.childSessionId ?? '') !== '')
            session = String(worker?.childSessionId ?? '')
          } catch { session = '' }
          if (session !== '') break
        }
        await new Promise((r) => setTimeout(r, 120))
      }
      if (spawnSeen === null || session === '') return { spawnSeen, session, cancelCall: null, at: null }
      const call = await apiSessionCancel(origin, cookie, session, 'a5sfsrch')
      log(`concurrent cancel: fifo spawn observed; session=${session.slice(0, 24)}… status=${String(call.status)} body=${redact(JSON.stringify(call.body ?? null)).slice(0, 200)}`)
      return { spawnSeen, session, cancelCall: call, at: new Date().toISOString() }
    })()
    const created = await createPromise
    const cancelEarly = await cancelWatch
    const createOk = created.status === 200 && created.body?.result?.ok === true
    log(`team.create status=${String(created.status)} ok=${String(createOk)} ${redact(JSON.stringify(created.body ?? null)).slice(0, 400)}`)
    if (!createOk) throw new Error(`team.create failed: status=${String(created.status)} body=${redact(JSON.stringify(created.body ?? null)).slice(0, 300)}`)

    abortStage = 'team-state'
    abortStageDetail = 'the p6t6 state route must report the acceptance Team at its creation root'
    const stateOk = await waitFor(async () => {
      const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
      return st.status === 200 && st.body?.rootSessionId === ACCEPTANCE_ROOT && st.body?.teamSession !== null
    }, 90_000)
    log(`p6t6 state (rootSessionId=${ACCEPTANCE_ROOT}, teamSession!=null)=${String(stateOk)}`)
    if (!stateOk) throw new Error(`the state query does not report the acceptance Team at its creation root (${ACCEPTANCE_ROOT}) — refusing to evaluate any row against a foreign team`)

    // ── drive: one synchronous delegate; the member's script runs one call/turn ──
    // STAGE 2 of the taxonomy: MEMBER INSTALL. The team exists; did a worker
    // instance appear with a session, and did the evidence row's realm get
    // installed on it? The lane report is written by the row's `apply`, so its
    // presence is what separates "the provider row never applied" (composition)
    // from "the member never started" (member install).
    abortStage = 'member-install'
    abortStageDetail = 'a worker instance with a child session must appear; its realm install is evidenced by the lane report'
    const replySeen = (content) => (world.mock?.requests ?? []).some((r) => r.reply?.kind === 'text' && String(r.reply.content ?? '').startsWith(content))
    const memberVisible = await waitFor(async () => {
      const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 20_000)
      return Array.isArray(st.body?.members) && st.body.members.some((m) => String(m?.templateId) === 'worker' && String(m?.childSessionId ?? '') !== '')
    }, 120_000)
    const stateFresh = await fetchJson(`${origin}/__p6t6/state`, undefined, 20_000)
    const member = (Array.isArray(stateFresh.body?.members) ? stateFresh.body.members : []).find((m) => String(m?.templateId) === 'worker') ?? null
    const memberSession = String(member?.childSessionId ?? '')
    stageCtx.member = { visible: memberVisible, instanceId: String(member?.instanceId ?? ''), hasSession: memberSession !== '' }
    log(`member visible=${String(memberVisible)} instanceId=${String(member?.instanceId ?? '')} childSessionId=${memberSession === '' ? '<none>' : '<set>'}`)
    // The attribution the abort needs: what the delegate call itself SAID. Until
    // this artifact existed, "no Member appeared" could mean refused, accepted but
    // the worker failed to start, or a turn the mock never drove.
    const teamToolNames = ['team_delegate', 'team_create_member', 'team_list_members', 'team_inspect_config']
    const teamCalls = []
    for (const message of (world.mock?.requests ?? []).flatMap((r) => messagesOf(r))) {
      if (message?.role !== 'assistant' || !Array.isArray(message?.content)) continue
      for (const block of message.content) {
        if (block?.type !== 'tool_use' || !teamToolNames.includes(String(block?.name))) continue
        const result = toolResultFor(world.mock?.requests ?? [], block.id)
        teamCalls.push({ name: block.name, id: block.id, input: block.input, result })
      }
    }
    const delegateArtifact = {
      schema: 'a5sf-search-live/team-call-artifact/1',
      at: new Date().toISOString(),
      stage: 'member-install',
      memberSeen: { visible: memberVisible, instanceId: String(member?.instanceId ?? ''), childSessionId: memberSession === '' ? null : '<set>' },
      teamCalls,
      rawState: stateFresh.body ?? null,
      mockRequests: (world.mock?.requests ?? []).length,
      memberTurnSeen: (world.mock?.requests ?? []).some((r) => userTextOf(r).includes(`${MEMBER_ENVELOPE}${TOK_D1}`)),
      note: 'tool_result text is the product-side answer to the call; a refusal carries its typed error, an acceptance with no Member means the worker never started',
    }
    writeFileSync(join(HERE, 'delegate-artifact.json'), JSON.stringify(delegateArtifact, null, 2) + '\n')
    stageCtx.delegate = delegateArtifact
    log(`team calls: ${JSON.stringify(teamCalls.map((c) => ({ name: c.name, isError: c.result?.isError, text: String(c.result?.text ?? '').slice(0, 220) }))).slice(0, 900)}`)
    persistRunChannels('member-install abort')
    if (member === null || memberSession === '') {
      throw new Error(`MEMBER_INSTALL_NO_WORKER: the team reports no worker instance with a session after 120s (laneReport=${existsSync(laneReportPath) ? 'present' : 'MISSING'}, team.create was ok). The delegate produced no Member, so no row can be measured`)
    }
    // STAGE 3: DELEGATE DISPATCH. A worker exists; did the leader's delegate
    // actually reach it? A member turn is a mock request whose transcript carries
    // the team-work envelope — if none arrives, the handoff that is broken is the
    // leader -> member dispatch, NOT the realm install.
    abortStage = 'delegate-dispatch'
    abortStageDetail = 'the leader delegate must deliver the worker script to the member session (a request carrying the team-work envelope)'
    const memberTurnSeen = () => (world.mock?.requests ?? []).some((r) => messagesOf(r).some((m) => String(m?.role) === 'user' && JSON.stringify(m?.content ?? '').includes(MEMBER_ENVELOPE)))
    const dispatched = await waitFor(memberTurnSeen, 120_000)
    log(`member turn dispatched=${String(dispatched)} laneReport=${existsSync(laneReportPath) ? 'present' : 'MISSING'}`)
    if (!dispatched) {
      throw new Error(`DELEGATE_DISPATCH_NEVER_REACHED_MEMBER: a worker instance exists (${String(member?.instanceId ?? '')}) but no request ever carried the team-work envelope within 120s (laneReport=${existsSync(laneReportPath) ? 'present' : 'MISSING'}). The broken handoff is leader -> member dispatch`)
    }
    // Judge the settled rows AS SOON AS their evidence is complete — before the
    // cancellation window, which is where the 2026-11-04T19:17Z run died with
    // four rows already measured. A complete sample is judged by the normal
    // judge whatever happens next; an incomplete one is left alone (its call may
    // still be in flight) and is only resolved by the abort path or the end.
    persistRunChannels('member turn dispatched')
    judgeSettledRows('delegate-dispatch')

    // The FIFO call must be in flight before the cancel is dispatched. Poll the
    // confined-provider record for the exact operand, then cancel through the
    // SHIPPED client route.
    // STAGE 4: CANCELLATION WINDOW. The member runs; did its `grep` reach the
    // confined face at all? If no confined spawn ever appears, the search never
    // crossed the realm boundary — that is an install/composition handoff, and
    // the lane report tells which.
    abortStage = 'cancellation-window'
    abortStageDetail = 'the member grep on the FIFO must be admitted by the confined subprocess face (a confined-spawn record) before a cancel can be dispatched'
    const fifoInFlight = cancelEarly.spawnSeen !== null || await waitFor(() => parseJsonl(counterPath).some((row) => row?.leg === 'confined-spawn' && (row?.argv ?? []).some((a) => String(a) === paths.fifo || String(a).endsWith('/blocking.fifo'))), 240_000)
    log(`fifo call admitted (confined spawn observed)=${String(fifoInFlight)}`)
    if (!fifoInFlight) {
      const rows = parseJsonl(counterPath)
      throw new Error(`CANCELLATION_WINDOW_NO_CONFINED_SPAWN: the member ran but no confined spawn for the FIFO appeared within 240s (laneReport=${existsSync(laneReportPath) ? 'present' : 'MISSING'}, confined-spawn=${String(rows.filter((row) => row?.leg === 'confined-spawn').length)}, base-spawn=${String(rows.filter((row) => row?.leg === 'base-spawn').length)}, installFs=${String(rows.filter((row) => row?.leg === 'install-fs').length)}). The search never reached the confined face`)
    }
    // The interrupt was already dispatched concurrently with `team.create`; only fall
    // back to the post-hoc route if that watcher never saw the spawn.
    let cancelCall = cancelEarly.cancelCall
    if (cancelCall !== null) log(`cancel already dispatched in the activity window at ${String(cancelEarly.at)}`)
    await new Promise((r) => setTimeout(r, 600))
    if (cancelCall === null && fifoInFlight) {
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        cancelCall = await apiSessionCancel(origin, cookie, memberSession, 'a5sfsrch')
        log(`cancel attempt ${String(attempt)}: status=${String(cancelCall.status)} body=${redact(JSON.stringify(cancelCall.body ?? null)).slice(0, 300)}`)
        if (cancelCall.status === 200) break
        await new Promise((r) => setTimeout(r, 500))
      }
    }
    const fifoExited = await waitFor(() => parseJsonl(counterPath).some((row) => row?.leg === 'confined-exit' && (row?.argv ?? []).some((a) => String(a).endsWith('/blocking.fifo'))), 60_000)
    log(`fifo call terminated=${String(fifoExited)}`)
    // The cancellation answer is evidence for row 4, and it must survive an
    // abort in the row-6/teardown stages, so it is parked where the abort path
    // can read it.
    stageCtx.cancelCall = cancelCall
    const chainOk = await waitFor(() => replySeen(DONE_L1), 240_000)
    log(`leader chain closed (${DONE_L1})=${String(chainOk)}`)
    // A row whose result arrived late (after the dispatch flush) is judged here,
    // still before anything that could throw in row 6 / teardown.
    judgeSettledRows('post-cancel')
    await new Promise((r) => setTimeout(r, 1500))

    // ── evidence collection: results, facts, and the counter ────────────────
    abortStage = 'evidence-collection'
    const requests = world.mock?.requests ?? []
    const callsById = new Map()
    for (const r of requests) {
      for (const m of messagesOf(r)) {
        if (m?.role === 'assistant' && Array.isArray(m.content)) {
          for (const b of m.content) {
            if (b?.type === 'tool_use' && !callsById.has(b.id)) {
              callsById.set(b.id, { callId: b.id, seq: r.seq, name: b.name, args: b.input ?? b.arguments ?? null })
            }
          }
        }
      }
    }
    const factsAll = parseJsonl(sinkPath).filter((f) => f?.schema === 'a5sf-guard-consult/1')
    // Only rows produced AFTER the unconfined control: the control's own
    // base-service spawn targets the same outside operand, and including it
    // would make row 2's "no inherited process" clause count the control.
    const recordsAll = parseJsonl(counterPath).slice(counterPrefixEnd)
    const laneReport = readJson(laneReportPath)
    writeFileSync(join(HERE, FACTS_NAME), JSON.stringify(factsAll, null, 2) + '\n')
    writeFileSync(join(HERE, 'search-counter.jsonl'), recordsAll.map((r) => JSON.stringify(r)).join('\n') + (recordsAll.length === 0 ? '' : '\n'))
    log(`collected: facts=${String(factsAll.length)} counterRows=${String(recordsAll.length)} laneReport=${laneReport === null ? 'MISSING' : 'present'}`)
    for (const [leg, count] of [['confined-spawn', recordsAll.filter((r) => r?.leg === 'confined-spawn').length], ['confined-exit', recordsAll.filter((r) => r?.leg === 'confined-exit').length], ['base-spawn', recordsAll.filter((r) => r?.leg === 'base-spawn').length]]) {
      log(`counter ${leg}=${String(count)}`)
    }
    log(`guard facts:`)
    for (const fact of factsAll) {
      log(`  fact ${String(fact.method)} ${String(fact.decision)} ${String(fact.decidedBy)} realm=${String(fact.realm)} binding=${String(fact.toolBindingIdentity)} locator=${String(fact.locator)} at=${String(fact.observedAt)}`)
    }

    // Row 1 is a two-way test: an in-lane grep that exits 2 is a REAL refuted row
    // (the pinned module maps exit not in {0,1} to SearchError), and the reason is in
    // the payload's stderr, not in the tool text. Log both before judging.
    for (const row of recordsAll) {
      if (row?.leg !== 'confined-exit') continue
      const isRow1 = (row?.argv ?? []).some((a) => String(a).replace(/\/+$/u, '') === paths.inLaneDir)
      if (!isRow1) continue
      log(`row 1 confined-exit code=${String(row.code)} signal=${String(row.signal)} stderrBytes=${String(row.stderrBytes ?? 0)} stderr=${JSON.stringify(String(row.stderr ?? '').slice(0, 600))}`)
    }

    // ── rows 1, 2, 3, 5 + row 4 (the cancelled search) ─────────────────────
    const resultOf = (callId) => toolResultFor(requests, callId)
    const normPath = (value) => String(value ?? '').replace(/\/+$/u, '')
    // EXACT locator match: every call has its OWN operand (see rowPathsOf), so a
    // basename fallback could only cross-match two rows' evidence.
    const recordsFor = (operand) => recordsAll.filter((row) => (row?.argv ?? []).some((a) => normPath(a) === normPath(operand)))
    const factsFor = (operand) => factsAll.filter((f) => normPath(f?.locator) === normPath(operand))

    // The SAME builders the abort path uses (settledSamples), so the two paths
    // cannot drift into two oracles. Rows already judged at dispatch keep that
    // verdict: re-judging identical evidence would only invite a different answer.
    const settled = settledSamples({ requests, includeFifo: true })
    for (const id of [SEARCH_CASE_IDS.row1, SEARCH_CASE_IDS.row2, SEARCH_CASE_IDS.row3, SEARCH_CASE_IDS.row5, SEARCH_CASE_IDS.row4]) {
      if (oracleSamples[id] !== undefined) continue
      const judged = judgeCase(id, settled[id], { stage: 'evidence-collection' })
      oracleSamples[id] = { sample: settled[id], ...judged, judgedAtStage: 'evidence-collection' }
      add(id, judged.verdict, {
        status: judged.status,
        reason: judged.reason,
        failed: judged.failed,
        sampleComplete: judged.sampleComplete,
        missing: judged.missing,
        judgedAtStage: 'evidence-collection',
      })
    }

    // ── M-07: the SAME face for `glob` (not one of the six rows; reported
    //    alongside them so M-07 is never promoted on grep evidence alone) ──
    const globInSample = {
      result: resultOf(CALL_IDS.globIn),
      facts: factsFor(paths.globDir),
      records: recordsFor(paths.globDir),
      declaredRoot: paths.globDir,
      needle: 'needle.txt',
      fileName: 'needle.txt',
    }
    const globOutSample = {
      result: resultOf(CALL_IDS.globOutside),
      facts: factsFor(paths.outsideGlobDir),
      records: recordsFor(paths.outsideGlobDir),
      declaredRoot: paths.outsideGlobDir,
      forbidden: [claims.outsideClaim, claims.outsideSecond],
    }
    const globIn = judgeSearchRow(SEARCH_CASE_IDS.row1, globInSample)
    const globOut = judgeSearchRow(SEARCH_CASE_IDS.row2, globOutSample)
    writeFileSync(join(HERE, 'glob-face.json'), JSON.stringify({ inLane: { sample: globInSample, ...globIn }, outside: { sample: globOutSample, ...globOut } }, null, 2) + '\n')
    log(`M-07 glob: in-lane=${globIn.verdict}(${globIn.reason}) outside-ceiling=${globOut.verdict}(${globOut.reason})`)

    // ── row 6: stop the Member, then probe for a callable shadow ────────────
    abortStage = 'row6'
    const stateMid = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
    const membersMid = Array.isArray(stateMid.body?.members) ? stateMid.body.members : []
    const workerMid = membersMid.find((m) => String(m.templateId) === 'worker') ?? member
    const targetInstance = String(workerMid?.instanceId ?? '')
    const archiveDispatchedAt = new Date().toISOString()
    const archiveCall = targetInstance === '' ? null : await fetchJson(`${origin}/__p6t6/tool`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({
        name: 'team_archive_member',
        args: { rootSessionId: ACCEPTANCE_ROOT, requestToken: 'a5sfsrch-archive', targetInstanceId: targetInstance },
        as: ACCEPTANCE_ROOT,
        callId: 'a5sfsrch-archive',
      }),
    }, 60_000)
    const stopInstant = new Date().toISOString()
    log(`archive via product tool route: status=${String(archiveCall?.status)} dispatchedAt=${archiveDispatchedAt} stopInstant=${stopInstant} body=${redact(JSON.stringify(archiveCall?.body ?? null)).slice(0, 500)}`)
    // THE STOP-TIME SINK, captured as an ARRAY before any post-stop probe.
    const factsAtStop = parseJsonl(sinkPath).filter((f) => f?.schema === 'a5sf-guard-consult/1')
    const consultCopy = writeConsultCopy(sinkPath)
    const stateAfterArchive = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
    const membersAfter = Array.isArray(stateAfterArchive.body?.members) ? stateAfterArchive.body.members : []
    const observations = Array.isArray(stateAfterArchive.body?.observations) ? stateAfterArchive.body.observations : []
    const counterAtStop = parseJsonl(counterPath)

    const postStopDispatch = await fetchJson(`${origin}/__p6t6/tool`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ name: 'grep', args: { pattern: claims.needle, path: paths.inLaneDir }, as: memberSession, callId: 'a5sfsrch-post-stop-grep' }),
    }, 60_000)
    const postStopDispatch2 = await fetchJson(`${origin}/__p6t6/tool`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', cookie },
      body: JSON.stringify({ name: 'glob', args: { pattern: 'needle.txt', path: paths.globDir }, as: memberSession, callId: 'a5sfsrch-post-stop-glob' }),
    }, 60_000)
    const factsAtEnd = parseJsonl(sinkPath).filter((f) => f?.schema === 'a5sf-guard-consult/1')
    const probeFacts = factsAtEnd.slice(factsAtStop.length)
    const counterAtEnd = parseJsonl(counterPath)
    const postStopSpawns = counterAtEnd.slice(counterAtStop.length)
    log(`row6: postStopGrep=${String(postStopDispatch?.status)} postStopGlob=${String(postStopDispatch2?.status)} factsAtStop=${String(factsAtStop.length)} probeFacts=${String(probeFacts.length)} postStopCounterRows=${String(postStopSpawns.length)}`)

    // ── teardown ───────────────────────────────────────────────────────────
    abortStage = 'teardown'
    try {
      teardown = await world.teardown()
    } catch (error) {
      log(`world.teardown threw: ${redact(String(error?.message ?? error))}`)
    }
    const hostPid = world.instance?.child?.pid ?? null
    const portStillListening = bootInfo === null ? null : await tcpConnectProbe(bootInfo.port, 1500)
    const homeExistsAfterTeardown = existsSync(world.home)
    const orphanPids = findOrphanProcesses({ home: world.home, workspace: paths.workspace })
    log(`process seam: hostPid=${String(hostPid)} portStillListening=${String(portStillListening)} homeExists=${String(homeExistsAfterTeardown)} orphanPids=${JSON.stringify(orphanPids)} hostAlive=${String(hostAlive())}`)

    const managedIdentity = { sessionId: memberSession, realmLabel: `member:${targetInstance}` }
    const row6Sample = {
      member,
      archive: archiveCall === null ? null : { status: archiveCall.status, body: archiveCall.body },
      membersAfter,
      postStopDispatches: [postStopDispatch, postStopDispatch2].filter((r) => r !== null),
      facts: factsAtStop,
      probeFacts,
      stopInstant,
      observations,
      managed: managedIdentity,
      duringManagedDisposal: true,
      managedRealmCount: membersAfter.filter((m) => String(m.templateId) === 'worker').length || 1,
      hostAlive: hostAlive(),
      portStillListening,
      homeDeleted: homeExistsAfterTeardown === false,
      orphanPids,
      confinedSpawnsAfterStop: postStopSpawns.filter((r) => r?.leg === 'confined-spawn'),
      baseSpawnsAfterStop: postStopSpawns.filter((r) => r?.leg === 'base-spawn'),
    }
    const row6Judged = judgeCase(SEARCH_CASE_IDS.row6, row6Sample, { stage: 'teardown' })
    oracleSamples[SEARCH_CASE_IDS.row6] = {
      sample: { ...row6Sample, observations: observations.length, membersAfter: membersAfter.length },
      ...row6Judged,
      judgedAtStage: 'teardown',
    }

    const teardownEvidence = {
      archive: archiveCall === null ? null : { status: archiveCall.status, body: archiveCall.body },
      membersAfterArchive: membersAfter.map((m) => ({ instanceId: m.instanceId, templateId: m.templateId, lifecycle: m.lifecycle })),
      observations,
      disposeFaultsAtArchive: classifyDisposeFaults({ observations, managed: managedIdentity, duringManagedDisposal: true, managedRealmCount: 1 }),
      postStopDispatches: [postStopDispatch, postStopDispatch2].map((r) => (r === null ? null : { status: r.status, body: r.body })),
      probeFacts,
      consultCopy,
      processSeam: {
        hostPid,
        hostChildExitCode: world.instance?.child?.exitCode ?? null,
        portStillListening,
        homeExistsAfterTeardown,
        orphanPids,
        worldTeardown: teardown ?? null,
      },
    }
    writeFileSync(join(HERE, 'teardown.json'), JSON.stringify(teardownEvidence, null, 2) + '\n')
    writeFileSync(join(HERE, 'ledger-rows.json'), JSON.stringify({
      ledgerPath: LEDGER_PATH,
      rowCount: readLedgerRows(LEDGER_PATH).length,
      rows: readLedgerRows(LEDGER_PATH),
    }, null, 2) + '\n')

    // ── the verdicts ───────────────────────────────────────────────────────
    // Rows judged earlier (at dispatch / evidence-collection / teardown) are
    // already in the record; only a row nothing ever observed is resolved here.
    for (const id of CASES) {
      if (record.getCase(id) !== undefined) continue
      const judged = oracleSamples[id]
      if (judged === undefined) {
        const unresolved = judgeCase(id, null, { stage: 'verdict-fold' })
        add(id, unresolved.verdict, {
          status: unresolved.status,
          reason: unresolved.reason,
          missing: unresolved.missing,
          sampleComplete: false,
          judgedAtStage: 'verdict-fold',
        })
        continue
      }
      add(id, judged.verdict, {
        status: judged.status,
        reason: judged.reason,
        failed: judged.failed,
        detail: judged.detail,
        sampleComplete: judged.sampleComplete,
        missing: judged.missing,
        judgedAtStage: judged.judgedAtStage,
      })
    }
    // The RUN-level fold: on a completed run this is the worst case verdict; an
    // abort below overrides it to FAIL via `record.markAborted()`.
    const runFold = summarizeRun([...CASES].map((id) => record.getCase(id)).filter(Boolean), { abortedAt: null })
    record.record.runVerdict = runFold
    // The negative control is NOT a Member row: it is reported, never folded in.
    record.record.negativeControl = {
      verdict: negativeControl.verdict?.verdict ?? null,
      reason: negativeControl.verdict?.reason ?? null,
      failed: negativeControl.verdict?.failed ?? [],
      detail: negativeControl.verdict?.detail ?? null,
    }
    record.record.globFace = { inLane: globIn.verdict, outsideCeiling: globOut.verdict }
    record.record.fixtures = evidence.fixtures
    record.record.claims = claims
    record.record.sink = { path: sinkPath, facts: factsAll.length, copy: consultCopy }
    record.record.boots = [{ phase: 'a5sf-search-boot1', world: world.id, port: bootInfo.port, logPath: bootInfo.logPath }]
    record.record.archive = { previousRun: archivedPreviousRun }
  } catch (error) {
    failure = error
    log(`FAILURE at stage ${abortStage} (${abortStageDetail}): ${redact(String(error?.message ?? error))}`)
    // THE STAGE PROBE: what the abort can still see. This is what converts a
    // spent start into information — which handoff was broken, and what the
    // world looked like at that moment.
    const probe = (() => {
      const out = { stage: abortStage, stageDetail: abortStageDetail, hostReached, rows: stageCtx.rows === null ? null : stageCtx.rows.map((row) => row.id), composedProfile: stageCtx.composedProfile }
      try {
        if (stageCtx.counterPath !== null) {
          const counterRows = parseJsonl(stageCtx.counterPath)
          out.counter = Object.fromEntries(['install-fs', 'install-subprocess', 'base-spawn', 'confined-spawn', 'confined-exit', 'confined-spawn-failed'].map((leg) => [leg, counterRows.filter((row) => row?.leg === leg).length]))
        }
      } catch { out.counter = 'unreadable' }
      try {
        if (stageCtx.laneReportPath !== null) out.laneReport = existsSync(stageCtx.laneReportPath) ? readJson(stageCtx.laneReportPath) : null
      } catch { out.laneReport = 'unreadable' }
      try {
        if (stageCtx.sinkPath !== null) out.sinkFacts = parseJsonl(stageCtx.sinkPath).filter((fact) => fact?.schema === 'a5sf-guard-consult/1').length
      } catch { out.sinkFacts = 'unreadable' }
      out.member = stageCtx.member
      try {
        const requests = world?.mock?.requests ?? []
        out.mockRequests = requests.length
        out.memberTurnSeen = requests.some((r) => messagesOf(r).some((m) => String(m?.role) === 'user' && JSON.stringify(m?.content ?? '').includes(MEMBER_ENVELOPE)))
        out.toolUseNames = [...new Set(requests.flatMap((r) => messagesOf(r)).flatMap((m) => (Array.isArray(m?.content) ? m.content : [])).filter((b) => b?.type === 'tool_use').map((b) => String(b.name)))].sort()
      } catch { /* ignore */ }
      return out
    })()
    try {
      writeFileSync(join(HERE, 'stage-diagnosis.json'), JSON.stringify({ schema: 'a5sf-search-live/stage-diagnosis/1', at: new Date().toISOString(), error: redact(String(error?.message ?? error)), probe }, null, 2) + '\n')
    } catch { /* best-effort */ }
    log(`stage probe: ${JSON.stringify(probe).slice(0, 900)}`)
    try {
      if (stageCtx.persistRunChannels !== null) {
        stageCtx.persistRunChannels('abort path, before teardown deletes the home')
      } else {
        for (const [name, source] of [['search-counter.jsonl', stageCtx.counterPath], ['consultations.jsonl', stageCtx.sinkPath]]) {
          if (source !== null && existsSync(source)) writeFileSync(join(HERE, name), readFileSync(source))
        }
        const transcript = writeMockTranscript(world, `abort path (${abortStage})`)
        log(`run channels persisted (abort path, before teardown deletes the home): mock-requests.json=${transcript}`)
      }
    } catch (copyError) { log(`run channel copy failed: ${String(copyError?.message ?? copyError)}`) }
    if (hostReached) {
      // ── JUDGE WHAT WAS MEASURED, AND ONLY WHAT WAS MEASURED ────────────────
      // The 2026-11-04T19:17Z run measured seven live guard facts in 400 ms and
      // then aborted in the cancellation window. The old loop here turned all six
      // rows into `FAIL / DRIVER_ABORTED`, discarding every observation it had
      // made. The rule that must survive is "never launder a MISSING observation
      // into a pass"; the rule that must not is "discard observations you made".
      // So: a COMPLETE sample is judged by the row's normal judge and keeps its
      // real verdict (a PASS is a CASE verdict); an INCOMPLETE one is NOT_REACHED
      // with status `driver-aborted`; and the RUN is FAIL + partial, always.
      const abortDetail = redact(String(error?.message ?? error))
      record.markAborted({ stage: abortStage, detail: abortStageDetail, error: abortDetail.slice(0, 300) })
      log(`abort: run verdict FAIL (partial=true, stage=${abortStage}); re-judging what was measured`)
      try {
        judgeSettledRows(`abort:${abortStage}`, { includeFifo: true })
      } catch (judgeError) {
        log(`abort re-judge failed (the run is still FAIL and partial): ${redact(String(judgeError?.message ?? judgeError))}`)
      }
      let rebuilt = {}
      try { rebuilt = settledSamples({ requests: world?.mock?.requests ?? [], includeFifo: true }) } catch { rebuilt = {} }
      for (const id of CASES) {
        if (record.getCase(id) !== undefined) continue
        const sample = rebuilt[id] ?? null
        const judged = judgeCase(id, sample, { abortedAt: abortStage, stage: `abort:${abortStage}` })
        oracleSamples[id] = { sample, ...judged, judgedAtStage: `abort:${abortStage}` }
        add(id, judged.verdict, {
          status: judged.status,
          reason: judged.reason,
          missing: judged.missing,
          sampleComplete: judged.sampleComplete,
          abortedAt: abortStage,
          stage: abortStage,
          stageDetail: abortStageDetail,
          error: abortDetail.slice(0, 300),
          judgedAtStage: `abort:${abortStage}`,
        })
      }
      record.record.runVerdict = summarizeRun([...CASES].map((id) => record.getCase(id)).filter(Boolean), { abortedAt: abortStage })
      record.record.abortDetail = abortStageDetail
    } else {
      throw error
    }
  } finally {
    if (world !== null && teardown === null) {
      try {
        teardown = await world.teardown()
      } catch {
        /* already failing */
      }
    }
    try {
      writeFileSync(join(HERE, 'oracle-samples.json'), JSON.stringify({
        schema: 'a5sf-search-live/oracle-samples/1',
        note: 'the exact sample object handed to each judge, plus the judge output and WHY (status/reason/missing). Re-running the judge over the sample reproduces the verdict without a Host; a sample with `missing` non-empty is NOT judgeable and can never be a pass.',
        roots: ROOTS,
        partial: record.isAborted(),
        abortedAt: record.isAborted() ? abortStage : null,
        cases: oracleSamples,
        negativeControl,
      }, null, 2) + '\n')
    } catch {
      /* best-effort */
    }
    const finalized = record.finalize()
    writeFileSync(join(HERE, 'run-record.json'), JSON.stringify(finalized, null, 2) + '\n')
    log(formatSummary(finalized))
    log(`bootsSpent=${String(lease.bootsSpent())} overall=${String(finalized.overall)} partial=${String(finalized.partial === true)} failure=${failure === null ? 'none' : redact(String(failure.message)).slice(0, 400)}`)
  }

  // An abort must reconcile itself: the intent row is spent even when no start is.
  if (failure !== null && !hostReached) {
    try {
      const rows = readLedgerRows(LEDGER_PATH)
      const mine = rows.filter((row) => String(row.runId ?? '') === runId)
      const hasIntent = mine.some((row) => row.kind === 'budget-intent')
      const hasBoot = mine.some((row) => row.kind !== 'budget-intent' && String(row.phase ?? '').startsWith('a5sf-search-boot'))
      const hasAbort = mine.some((row) => row.kind === 'budget-abort')
      if (hasIntent && !hasBoot && !hasAbort) {
        appendFileSync(LEDGER_PATH, JSON.stringify({
          at: new Date().toISOString(),
          runId,
          suite: 'a5sf-search',
          kind: 'budget-abort',
          phase: 'a5sf-search-abort-prehost',
          reason: redact(String(failure.message ?? failure)).slice(0, 400),
          stage: abortStage,
          grantId: grant.grantId,
          boundCommit: grant.boundCommit,
          note: 'aborted BEFORE the Host was reached: the intent row was spent, no start was',
        }) + '\n')
        log('ledger reconciled: budget-abort row appended (intent spent, no start)')
      }
    } catch (error) {
      log(`ledger reconciliation FAILED (the ledger keeps the dangling intent): ${redact(String(error?.message ?? error))}`)
    }
  }
  if (failure !== null) process.exitCode = 1
}

// ─────────────────────────────────────────────────────────────────────────────
// small helpers that reference the world only through arguments
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Persist the mock transcript — the ONLY channel that carries the tool-result
 * bytes a row judge compares against. Teardown deletes the World home, and the
 * transcript otherwise lives in this process's memory only: attempt 6's sink and
 * counter were copied out, its results were not, and the seven facts it measured
 * became un-re-judgeable the moment the driver was certain it had failed.
 *
 * Capped by request COUNT only, so the file has a bound; this is a test
 * transcript, not a model context, and writing it adds no token to any prompt.
 *
 * @param {{mock?: {requests?: object[]}}|null} world
 * @param {string} label why it was written (stage name)
 * @returns {string} a one-line status for the caller's log
 */
function writeMockTranscript(world, label) {
  try {
    const requests = (world?.mock?.requests ?? []).slice(-60).map((r) => ({
      seq: r?.seq ?? null,
      reply: r?.reply ?? null,
      messages: messagesOf(r),
    }))
    writeFileSync(join(HERE, 'mock-requests.json'), JSON.stringify({
      schema: 'a5sf-search-live/mock-requests/1',
      at: new Date().toISOString(),
      label,
      note: 'the model-visible transcript the tool-result bytes live in; written OUTSIDE the World home so teardown cannot swallow it',
      requests,
    }, null, 2) + '\n')
    return `${String(requests.length)} request(s)`
  } catch (error) {
    return `write failed: ${String(error?.message ?? error)}`
  }
}

function toolResultFor(requests, callId) {  for (const req of requests) {
    for (const m of messagesOf(req)) {
      for (const b of Array.isArray(m?.content) ? m.content : []) {
        const id = b?.type === 'tool_result' ? (b?.tool_use_id ?? b?.call_use_id ?? null) : (m?.role === 'tool' ? m?.tool_call_id : null)
        if (id !== callId) continue
        const text = b?.type === 'tool_result'
          ? (Array.isArray(b.content) ? b.content.map((c) => c?.text ?? '').join('') : typeof b.content === 'string' ? b.content : '')
          : String(m?.content ?? '')
        const isError = b?.type === 'tool_result' ? b?.is_error === true : m?.is_error === true
        return { source: 'model', isError: isError === true || /^error/iu.test(text), text }
      }
    }
  }
  return null
}

/** Processes that still carry the World's home or workspace in their argv. */
function findOrphanProcesses({ home, workspace }) {
  let out = ''
  try {
    out = execFileSync('ps', ['-eo', 'pid=,args='], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
  } catch {
    return []
  }
  const pins = [home, workspace].filter((p) => typeof p === 'string' && p !== '')
  const orphans = []
  for (const line of out.split('\n')) {
    const match = /^\s*(\d+)\s+(.*)$/u.exec(line)
    if (match === null) continue
    const pid = Number(match[1])
    const args = match[2]
    if (pid === process.pid) continue
    if (pins.some((pin) => args.includes(pin))) orphans.push({ pid, args: args.slice(0, 300) })
  }
  return orphans
}

if (PLAN_ONLY) {
  await planOnly()
} else {
  rmSync(RUN_LOG, { force: true })
  await boot()
}
