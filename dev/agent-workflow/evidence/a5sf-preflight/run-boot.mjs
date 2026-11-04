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
import { appendFileSync, existsSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { createRequire } from 'node:module'
import { dirname, join, relative, resolve } from 'node:path'
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
import {
  ACCEPTANCE_CASE_IDS,
  ACCEPTANCE_CASES,
  INVALIDATED_CODE,
  INVALIDATED_NAME,
  P2_01_ACCEPTANCE_ROOTS,
  assertAcceptanceRootWiring,
  classifyDisposeFaults,
  isWritePathConsultation,
  judgePrecondition,
  judgeRow1,
  judgeRow2,
  judgeRow3,
  judgeRow4a,
  judgeRow4b,
  judgeRow5,
  judgeRow6,
  toRunVerdict,
} from '../../../../tests/world-factory/lib/a5sf-acceptance-preflight.mjs'

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
/** THE ROOT IDENTITY (the #575 defect). `run-boot.mjs` does NOT carry either
 *  literal: it imports the ONE object the host-free test pins. `BOOT_ROOT` is
 *  the anchor team's root (discovery only); `ACCEPTANCE_ROOT` is where the
 *  acceptance Team is created AND where the p6t6 directive, the state query,
 *  the tool route, the archive dispatch and every row oracle address it. */
const ROOTS = P2_01_ACCEPTANCE_ROOTS
const BOOT_ROOT = ROOTS.bootRoot
const ACCEPTANCE_ROOT = ROOTS.teamRoot

/**
 * The p6t6 directive, built in ONE place. `GET /__p6t6/state` answers for its
 * `rootSessionId`, so this object is the state/tool-route root: an assertion
 * that only checks the constants but not this file's content is exactly the
 * hole review B3 found.
 */
function p6t6Directive({ worldId, logDir }) {
  return { boot: 1, phase: 'create', reportDir: logDir, runStamp: worldId, rootSessionId: ACCEPTANCE_ROOT }
}

/**
 * Assert the root contract INCLUDING the two values that live in product-facing
 * configuration rather than in the constants object: the production row's
 * `rootSessionId` (must stay on the boot root) and the directive's
 * `rootSessionId` (must be the acceptance root). Without these, pointing the
 * production row at the acceptance root passes a naive check and dies at
 * `team.create` on the live path (review B3).
 */
function assertDriverRootWiring() {
  return assertAcceptanceRootWiring(ROOTS, {
    productionRowRoot: teamRowConfig({ home: join(HERE, '.rowcheck') }).rootSessionId,
    directiveRoot: p6t6Directive({ worldId: 'rowcheck', logDir: '.rowcheck' }).rootSessionId,
  })
}
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
const BINDING_IDENTITY = 'dsh.fs/read'
const LATE_TOOL_ROUTE = '/__a5sf/late-tool'

/**
 * The acceptance cases: one precondition + SEVEN rows. The precondition exists so
 * a composition failure is never mis-read as a row failure; rows 4a and 4b are
 * the two halves of the retired row 4 (see `judgeRow4a`/`judgeRow4b` and README
 * §12). The literal is kept as an INDEPENDENT copy of the contract: a drift from
 * `ACCEPTANCE_CASES` throws before the grant (assertCaseListMatchesContract).
 */
const CASES = Object.freeze([
  'live:composition-precondition-read-surface',
  'live:row1-read-a-inside-both-allowed',
  'live:row2-read-b-binding-deny-on-read-path',
  'live:row3-read-c-refused-no-widening',
  'live:row4a-write-in-lane-readable-allowed-ceiling-only',
  'live:row4b-write-b-ceiling-allowed-read-not-implied',
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
  // A truncated dump can end mid-token with a trailing space; the transcript is
  // committed evidence, so keep it free of trailing whitespace (the first live
  // run's run.log:33 carried one, from a 320-char counter slice).
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

/**
 * The HOME-LEVEL patch layer: pin the DEPLOYMENT file-sandbox fallback root to
 * the World workspace.
 *
 * WHY THIS IS A FIXTURE CORRECTION, NOT A PRODUCT RELAXATION. The base bundle
 * mounts `sandbox-policy` with `workspaceRoot: !!js process.cwd()` — the cwd of
 * the spawned `dsh web`, i.e. the PRISTINE HOST TREE (`tests/deepseek-harness-
 * test-use`) — and `mode: !!js process.env.DSH_PERMISSION_MODE ?? 'workspace-write'`.
 * A confined provider that is asked without a per-call policy resolves
 * `ctx.sandboxPolicy.resolve()` with NO session, which falls back to that
 * deployment root; the a5sf realm provider deliberately drops the caller's
 * `policy` (`createConfinedFileSystemClass` → `void policy`), so every Team write
 * is fenced by the DEPLOYMENT root, not by the World. The first live run measured
 * the consequence: row 4's write was refused by the HOST sandbox
 * (`[sandbox: file access denied under workspace-write mode]`) and the row could
 * never observe a Team-lane decision at all.
 *
 * The home patch is the launcher's own documented tweak layer, applied AFTER the
 * profile patch, so it outranks it — and it is written into the World's own
 * DSH_HOME, so it changes nothing shared. The replacement row RESTATES the whole
 * config of the row it replaces (both fields the base sets).
 */
function homeSandboxPin({ home, workspaceRoot }) {
  const root = realpathSync(workspaceRoot)
  const path = join(home, 'cordis.patch.yml')
  const yaml = [
    '# a5sf preflight fixture (see README §12.4): pin the DEPLOYMENT file-sandbox',
    '# fallback root to this World\'s workspace. The base bundle sets',
    '# `workspaceRoot: !!js process.cwd()` (the pristine host tree) and the a5sf',
    '# realm provider calls sandboxPolicy.resolve() WITHOUT a session, so the',
    '# fallback — not the session cwd — fences every Team write.',
    '- id: sandbox-policy',
    '  config:',
    '    mode: "workspace-write"',
    `    workspaceRoot: ${JSON.stringify(root)}`,
    '',
  ].join('\n')
  return { path, yaml, mode: 'workspace-write', workspaceRoot: root }
}

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
 * The worker's six-call script, one call per turn, in the row order:
 * read A -> read B -> read C -> read w4a -> write w4a -> write B -> done.
 * Nothing else is issued by the model; rows 5 and 6 are driver-initiated through
 * the product's own dispatch route (a post-invalidation call cannot be scripted
 * from a model turn whose surface the invalidation just changed).
 *
 * `read w4a` exists for two reasons, both measured: the host's read-before-edit
 * policy turns a write to an UNOBSERVED existing file into `createIfAbsent` (a
 * different refusal than the row is about), and read-then-write is the shape the
 * product's write⇒read coupling describes.
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
      if (reads < 4) {
        // row 4a reads its target first: an EXISTING file whose write must be
        // observed (the fs-observation policy turns an unread existing target
        // into `createIfAbsent`, which would fail for the wrong reason), and the
        // read⇒write shape is what the product's write coupling is about.
        return {
          kind: 'tool-call',
          toolCalls: [{ id: 'call-a5sfacc-read-w4a', name: 'read', arguments: { file_path: rowPaths.w4a.path } }],
        }
      }
      if (writes < 1) {
        return {
          kind: 'tool-call',
          toolCalls: [{ id: 'call-a5sfacc-write-w4a', name: 'write', arguments: { file_path: rowPaths.w4a.path, content: rowPaths.w4a.writeContent } }],
        }
      }
      if (writes < 2) {
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
            rootSessionId: ACCEPTANCE_ROOT,
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
    rootSessionId: BOOT_ROOT,
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
    // THE IDENTITY DECLARATION (host-free measured in
    // evidence/a5sf-preflight/probe-mount-compat.mjs). It grants nothing: it
    // declares what this composition believes the module shadows, and the
    // attach REFUSES (A5SF_EXPECTED_TOOLS_UNSHADOWED, before any row) if the
    // settled fibers do not forward every declared name. `read_image` is the
    // deferred registration that depends on the World's `attachments` service,
    // so this also turns "the World silently lost attachments" into ONE typed
    // activation refusal naming the missing name, instead of six NOT_REACHED.
    a5sfExpectedTools: { [pathToFileURL(HOST_TOOL_FS).href]: ['read', 'write', 'edit', 'read_image'] },
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
    // row 4a: INSIDE the readable in-lane subtree, so write⇒read is satisfiable.
    w4a: { path: join(workspace, 'axis', 'allow', 'w4a.txt') },
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

/**
 * Fail BEFORE the grant when this driver's case list has drifted from the
 * host-free oracle's closed list: a renamed/added case id would otherwise make
 * `record.finalize()` fill the missing case with a mechanical FAIL.
 */
function assertCaseListMatchesContract() {
  const driver = [...CASES].sort()
  const contract = [...ACCEPTANCE_CASES].sort()
  if (driver.length !== contract.length || driver.some((id, index) => id !== contract[index])) {
    throw new Error(`the driver's case list has drifted from the acceptance contract (driver=${JSON.stringify(driver)} contract=${JSON.stringify(contract)})`)
  }
}

/**
 * Copy the World sink into the evidence directory.
 *
 * Called BEFORE the row-6 stop and BEFORE the two post-stop probe dispatches, so
 * this file is the STOP-TIME sink, not the whole run's sink. Boot 2 read it as
 * "the complete live sink" and blamed the oracle for a fact that was not in it;
 * the facts the probes append afterwards are persisted separately
 * (`teardown.json.probeFacts` / `oracle-samples.json` row 6 `sample.probeFacts`),
 * and that split is the defect-A repair (README §12.8.1).
 */
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

/**
 * The `attachments` provider the six-row World's Member assembly needs (the
 * pinned tool-fs defers `read_image` on `ctx.inject(['attachments'])`).
 *
 * MEASURED FROM COMPOSITION, host-free: the World boots `dsh web`, whose
 * profile composes the pinned base bundle, and that bundle mounts
 * `@deepseek-ai/dsh-attachment-local` (the `attachments` service). #575 also
 * OBSERVED the durable store on the live Host. This function returns the
 * evidence lines so the preflight can refuse if the composition ever drops it.
 */
function attachmentsProviderComposition() {
  const files = [
    join(HOST_TREE, 'packages', 'bundle', 'base', 'cordis.patch.yml'),
    join(HOST_TREE, 'packages', 'bundle', 'web-app', 'cordis.patch.yml'),
  ]
  const evidence = []
  for (const file of files) {
    if (!existsSync(file)) continue
    const lines = readFileSync(file, 'utf8').split('\n')
    lines.forEach((line, index) => {
      if (/attachment-local|dsh-attachment-local/.test(line)) evidence.push({ file, line: index + 1, text: line.trim() })
    })
  }
  const mounted = evidence.some((entry) => /id:\s*attachment-local/.test(entry.text))
    && evidence.some((entry) => /@deepseek-ai\/dsh-attachment-local/.test(entry.text))
  return {
    mounted,
    service: 'attachments',
    evidence,
    note: 'the pinned tool-fs declares `inject = ["tools","fs","systemPrompt"]` and a DEFERRED `ctx.inject(["attachments"], …)` for read_image; the World profile composes this bundle, so the service exists app-wide. If `mounted` is false the preflight is BLOCKED (the six-row assembly cannot forward read_image).',
  }
}

// The run-record bindings are built HERE, outside boot(), for one reason: a defect in this
// literal (a typo, a missing import used only by these strings) used to be reachable only in
// boot mode — which is how an attempt was once lost to `ReferenceError: relative is not defined`
// at line 799 with the Host never started. `--plan` now calls this too, so the whole literal is
// exercised host-free and a broken record cannot cost a start.
// The ledger is the ONE counter, so the boot sequence is read from it rather than assumed.
function readLedgerRows(path) {
  if (!existsSync(path)) return []
  return readFileSync(path, 'utf8')
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line) } catch { return null }
    })
    .filter(Boolean)
}

// A boot overwrites the record it is compared against, so a CRASHED boot silently destroys the
// previous run's fixture (measured 2026-11-04: the `homePin` abort rewrote run.log and
// run-record.json, and the dry run's row-6 replay then had no stop instant). The previous run's
// mutable evidence is therefore MOVED into runs/<stamp>/ before this one starts.
const RUN_ARCHIVE_FILES = [
  'run.log', 'run-record.json', 'oracle-samples.json', 'guard-facts.json', 'consultations.jsonl',
  'counter.json', 'teardown.json', 'ledger-rows.json', 'boot-console.log', 'grant.json',
]

function archivePreviousRun() {
  const present = RUN_ARCHIVE_FILES.filter((name) => existsSync(join(HERE, name)))
  if (present.length === 0) return null
  const stamp = new Date().toISOString().replace(/[:.]/g, '-')
  const dir = join(HERE, 'runs', stamp)
  mkdirSync(dir, { recursive: true })
  for (const name of present) {
    try { renameSync(join(HERE, name), join(dir, name)) } catch { /* keep going: one locked file must not stop the run */ }
  }
  log(`previous run evidence archived: runs/${stamp} (${present.join(', ')})`)
  return `runs/${stamp}`
}

function runBindings(head, grant) {
  return {
    teamSha: head,
    hostSha: TEST_USE_BASELINE_SHA,
    hostTree: HOST_TREE,
    line: LINE,
    sink: 'world-home a5sf-consult.jsonl (copy: consultations.jsonl)',
    grantId: grant.grantId,
    allocationItem: grant.allocationItem,
    providerComposition: `test row ${relative(REPO_ROOT, EVIDENCE_ROW)} (no product provider exists at this base; byte-identical to the #575 composition row)`,
    laneAlgebra: 'packages/runtime/member-io-policy/src/path-rules.ts # intersectPathRuleSets (the product algebra; the lane INPUTS are fixtures)',
    providerCounter: 'installed by the SAME evidence row (config.counterPath): the shipped host fs has no counter; in-memory prototype wrap, pass-through',
    lateToolTrigger: 'test-composition HTTP route in the same evidence row: registers ONE unrelated tool through the public tools.register seam on demand (the invalidation it triggers is the product behaviour)',
    worldReuse: 'dev/agent-workflow/evidence/a5sf-live-native3/run-boot.mjs world/heater, with the corrections documented in the README',
  }
}

async function planOnly() {
  log(`PLAN MODE — no gate, no ledger row, no spawn. repo=${REPO_ROOT} hostTree=${HOST_TREE}`)
  assertCaseListMatchesContract()
  const wiring = assertDriverRootWiring()
  log(`root identity (plan): ${JSON.stringify(wiring)}`)
  const head = resolveHeadCommit(REPO_ROOT)
  log(`HEAD=${String(head)} pinnedHost=${TEST_USE_BASELINE_SHA}`)
  log(`host tool-fs module: ${HOST_TOOL_FS} exists=${existsSync(HOST_TOOL_FS)}`)
  log(`host tools lib: ${HOST_TOOLS_LIB} exists=${existsSync(HOST_TOOLS_LIB)}`)
  const attachments = attachmentsProviderComposition()
  log(`attachments provider composition: mounted=${String(attachments.mounted)} evidence=${JSON.stringify(attachments.evidence)}`)
  if (!attachments.mounted) throw new Error('PREFLIGHT BLOCKER: the pinned World composition does not mount @deepseek-ai/dsh-attachment-local, so the six-row Member assembly cannot shadow read_image')
  const anchor = assertBlueprintText(BP_ANCHOR_YAML, BP_ANCHOR_ID, 1, 'anchor.yaml')
  const main = assertBlueprintText(mainBlueprintYaml(['u6fs_probe', 'read']), BP_MAIN_ID, 1, 'main.yaml')
  log(`blueprint ingest: anchor=${JSON.stringify(anchor)} main=${JSON.stringify(main)}`)
  const factory = new TestWorldFactory({ repoRoot: REPO_ROOT, evidenceRoot: HERE, hostTree: HOST_TREE })
  factory.assertHostBase('plan')
  const world = await factory.createWorld({ line: LINE, u6Fs: { rows: [] } })
  const plan = {
    schema: 'a5sf-acceptance-preflight/plan/1',
    at: new Date().toISOString(),
    head: head === null ? null : String(head),
    pinnedHost: TEST_USE_BASELINE_SHA,
    hostTree: HOST_TREE,
    toolFsModule: HOST_TOOL_FS,
    attachmentsProvider: attachments,
    roots: ROOTS,
    rootWiring: wiring,
    expectedTools: { module: pathToFileURL(HOST_TOOL_FS).href, names: ['read', 'write', 'edit', 'read_image'] },
    // Exercise the boot-mode record literal host-free (see runBindings): a broken binding
    // string must fail here, not after a start has been spent.
    runBindings: runBindings(head === null ? 'plan-probe' : String(head), {
      grantId: 'plan-probe',
      allocationItem: 'P2-01 live read (BL-14 / G2 live half)',
    }),
    blueprints: { anchor, main },
    world: null,
  }
  try {
    const { rows, paths } = rowsFor({ home: world.home, workspaceDir: world.workspaceDir })
    const patch = emitPatchLayer([
      'a5sf six-row acceptance boot: two-axis realm provider row + production Team row',
      'with a5sfEvidencePath + a5sfNativeToolModules + a5sfExpectedTools + p6t6 + preset declaration.',
    ], rows)
    log(`patch layer bytes=${patch.length}; rows=${rows.map((r) => r.id).join(',')}`)
    log('---- patch layer ----\n' + patch + '\n---- end patch ----')
    plan.patch = {
      bytes: Buffer.byteLength(patch),
      sha256: createHash('sha256').update(patch).digest('hex'),
      rows: rows.map((row) => String(row.id)),
      // The PRODUCTION row anchors the ANCHOR team on the boot root; the
      // acceptance root reaches the p6t6 row at RUN time through the directive
      // the driver writes (asserted equal to `createRoot` by the wiring above),
      // not through the emitted patch.
      containsBootRoot: patch.includes(BOOT_ROOT),
      containsExpectedTools: patch.includes('a5sfExpectedTools'),
      containsAttachmentProviderRow: false,
    }
    if (!plan.patch.containsBootRoot) throw new Error('the emitted patch layer does not carry the boot root the production row anchors')
    const provider = await import(pathToFileURL(EVIDENCE_ROW).href)
    log(`provider row module: name=${provider.name} apply=${typeof provider.apply} inject=${JSON.stringify(provider.inject)}`)
    log(`row paths: ${JSON.stringify(paths)}`)
    const identity = rowIdentityCheck(rows)
    log(`pre-boot row identity check: ${JSON.stringify(identity)}`)
    if (identity.ok !== true) throw new Error(`row composition refused in plan: ${identity.reason}: ${identity.detail}`)
    plan.rowIdentity = identity
    // The home-level pin (helper header): recorded host-free, never applied in
    // plan mode — the plan World is torn down without a spawn.
    const homePin = homeSandboxPin({ home: world.home, workspaceRoot: world.workspaceDir })
    const profilePatch = world.instance?.patchFile ?? null
    plan.homePatch = {
      path: homePin.path,
      insideWorldHome: homePin.path === join(world.home, 'cordis.patch.yml'),
      isNotTheProfilePatch: profilePatch === null ? null : homePin.path !== profilePatch,
      bytes: Buffer.byteLength(homePin.yaml),
      sha256: createHash('sha256').update(homePin.yaml).digest('hex'),
      yaml: homePin.yaml,
      mode: homePin.mode,
      workspaceRoot: homePin.workspaceRoot,
      outranksProfilePatch: 'the launcher applies the per-profile patch first, then the home-level cordis.patch.yml (app-boot README)',
    }
    if (plan.homePatch.insideWorldHome !== true) throw new Error(`the home patch is not inside the World home: ${homePin.path}`)
    if (plan.homePatch.isNotTheProfilePatch === false) throw new Error('the home patch path collides with the profile patch path')
    log(`home patch layer: ${homePin.path} mode=${homePin.mode} workspaceRoot=${homePin.workspaceRoot}`)
    // The lane report is emitted by the ROW at apply time; the plan mode cannot
    // run it, so the same product algebra is exercised here to make a lane-shape
    // defect visible BEFORE the boot.
    const pathRules = await import(pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'member-io-policy', 'src', 'path-rules.js')).href)
    const workspace = realpathSync(world.workspaceDir)
    const ceilingRead = { mode: 'restricted', allow: [workspace], ask: [], deny: [] }
    const restrictionRead = { mode: 'restricted', allow: paths.restrictionReadAllow, ask: [], deny: [] }
    const effectiveRead = pathRules.intersectPathRuleSets(ceilingRead, restrictionRead)
    const dispositions = [paths.a.path, paths.b.path, paths.c.path].map((locator) => ({
      locator,
      ceiling: pathRules.matchLocator(ceilingRead, locator),
      restriction: pathRules.matchLocator(restrictionRead, locator),
      effective: pathRules.matchLocator(effectiveRead, locator),
    }))
    log(`lane algebra: ceiling=${JSON.stringify(ceilingRead.allow)} restriction=${JSON.stringify(restrictionRead.allow)} effective=${JSON.stringify(effectiveRead.allow)}`)
    log(`lane dispositions: ${JSON.stringify(dispositions)}`)
    plan.lane = { ceilingReadAllow: ceilingRead.allow, restrictionReadAllow: restrictionRead.allow, effectiveReadAllow: effectiveRead.allow, dispositions }
  } finally {
    const torn = await world.teardown()
    plan.world = {
      id: world.id,
      home: world.home,
      workspace: world.workspaceDir,
      patchFile: world.instance?.patchFile ?? null,
      teardown: { homeDeleted: torn.homeDeleted, releasedPorts: torn.releasedPorts },
    }
    log(`plan world torn down: homeDeleted=${String(torn.homeDeleted)} releasedPorts=${JSON.stringify(torn.releasedPorts)}`)
    writeFileSync(join(HERE, 'plan.json'), JSON.stringify(plan, null, 2) + '\n')
  }
}

async function boot() {
  log(`BOOT MODE — exactly ONE Host start. repo=${REPO_ROOT}`)
  assertCaseListMatchesContract()
  const rootWiring = assertDriverRootWiring()
  log(`root identity (boot): ${JSON.stringify(rootWiring)}`)
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
  // ONE GRANT PER BOOT. The grant carries maxStarts = intent + start, so keying it to the
  // HEAD alone makes a second run at the same head collide with the first run's two rows and
  // the BL-14 gate refuses with GRANT_EXHAUSTED (observed 2026-11-04, and the refusal is
  // correct — the bookkeeping was not). The sequence is derived from the ledger, so it cannot
  // be faked by re-running, and it is capped by the DEDICATED allocation: three preflight-gated
  // P2-01 starts, never the pool reserve.
  const ledgerRowsSoFar = readLedgerRows(LEDGER_PATH)
  const archivedPreviousRun = archivePreviousRun()
  const priorRows = ledgerRowsSoFar.length
  const priorBoots = ledgerRowsSoFar.filter((row) => String(row?.phase ?? '').startsWith('a5sf-acceptance-boot')).length
  const bootSequence = priorBoots + 1
  const DEDICATED_STARTS = 3
  if (bootSequence > DEDICATED_STARTS) {
    const refusal = new Error(`BUDGET_NOT_GRANTED reason=DEDICATED_ALLOCATION_EXHAUSTED: this driver's dedicated allocation is ${DEDICATED_STARTS} starts and the ledger already holds ${priorBoots} boot row(s); a further run needs a new user ruling, not the pool reserve`)
    refusal.code = 'BUDGET_NOT_GRANTED'
    refusal.reason = 'DEDICATED_ALLOCATION_EXHAUSTED'
    refusal.detail = `dedicated starts=${DEDICATED_STARTS} ledger boot rows=${priorBoots}`
    throw refusal
  }
  log(`boot sequence: ${String(bootSequence)} of ${String(DEDICATED_STARTS)} dedicated P2-01 start(s) (ledger boot rows=${String(priorBoots)})`)
  const grant = {
    grantId: `grant-a5sf-acceptance-${head.slice(0, 12)}-b${String(bootSequence)}`,
    // CUMULATIVE, not per-run: the BL-14 gate compares the SHARED LEDGER's row count against
    // maxStarts (one intent row + one boot row per lease). Keying it to 2 made the second run
    // at any head refuse with GRANT_EXHAUSTED — measured 2026-11-04 — so this run's grant pays
    // for every earlier row plus its own two.
    maxStarts: priorRows + 2,
    grantedBy: 'user ruling 2026-11-03 a5sf-boot-pool-20261103-user-20, as AMENDED: allocation item "P2-01 live read (BL-14 / G2 live half)" now holds 6 boots, three of them newly granted and dedicated to the post-preflight six-row acceptance. The preflight in evidence/a5sf-preflight/ must be green before the first of those three is spent; this driver is the one that preflight certifies. Prior P2-01 boots: a5sf-live-native (activation refused by the unscoped-ctx seam), a5sf-live-native2 (Loader compose abort on a composition defect), a5sf-live-native3 (confined native read proven, teardown seam open), a5sf-acceptance (6/6 NOT_REACHED: create-root/observe-root split). The pool reserve is NOT touched.',
    allocationItem: 'P2-01 live read (BL-14 / G2 live half)',
    boundCommit: head,
    note: `maxStarts = ${String(priorRows)} prior shared-ledger row(s) + 1 pre-registration (intent) row + 1 boot = ${String(priorRows + 2)}; the BL-14 gate counts shared-ledger rows, not spawns`,
    bootSequence,
    dedicatedStarts: DEDICATED_STARTS,
  }
  writeFileSync(GRANT_PATH, JSON.stringify(grant, null, 2) + '\n')
  log(`grant materialised: ${GRANT_PATH} maxStarts=${grant.maxStarts} boundCommit=${grant.boundCommit} item=${grant.allocationItem}`)

  const runId = `a5sf-acceptance-${new Date().toISOString().replace(/[:.]/g, '-')}`
  const record = createRunRecord({
    runId,
    suite: 'a5sf-acceptance',
    selectedCases: CASES,
    bindings: runBindings(head, grant),
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
  const claim4aOrig = `A5SF_ACC_W4A_ORIG_${world.id}`
  const writeContent = `A5SF_ACC_WRITE_${world.id}\n`
  const writeContent4a = `A5SF_ACC_WRITE_4A_${world.id}\n`
  rowPaths.b.writeContent = writeContent
  rowPaths.w4a.writeContent = writeContent4a
  const sinkPath = join(world.home, 'a5sf-consult.jsonl')
  const counterPath = join(world.home, COUNTER_NAME)
  const laneReportPath = join(world.home, LANE_REPORT_NAME)
  const lateReportPath = join(world.home, LATE_REPORT_NAME)
  let bootInfo = null
  let teardown = null
  let failure = null
  /** Set when the Host was started. After that point an aborted run is a FAIL:
   *  a live regression must never be laundered into NOT_REACHED (review B2). */
  let hostReached = false
  let abortStage = 'pre-boot'
  // Computed ONCE, before the record that cites it. This used to be declared further down, so
  // the boot path referenced a binding that did not exist yet (`ReferenceError: homePin is not
  // defined`) — and by then the intent row had been written, so the attempt was already visible
  // in the ledger. The `--plan` smoke cannot see this class; a `no-undef` lint can.
  // HOISTED out of the try: the finally-block that writes oracle-samples.json used to reference a
  // `const` declared inside that try — out of scope there, so `no-undef` caught it and, on the
  // boot path, it would have thrown AFTER the Host was up (a real start lost). Similarly the home
  // pin must exist before the evidence record that cites it (`homePin is not defined`, 08:11Z).
  const oracleSamples = {}
  const homePin = homeSandboxPin({ home: world.home, workspaceRoot: world.workspaceDir })
  const evidence = {
    worldId: world.id,
    homePatch: { path: homePin.path, mode: homePin.mode, workspaceRoot: homePin.workspaceRoot },
    rows: {
      a: { path: rowPaths.a.path, claim: claimA, lane: 'inside ceiling AND inside the binding restriction' },
      b: { path: rowPaths.b.path, claim: claimB, writeContent, lane: 'inside ceiling, OUTSIDE the binding restriction' },
      c: { path: rowPaths.c.path, claim: claimC, lane: 'OUTSIDE the ceiling, inside the binding restriction' },
      w4a: { path: rowPaths.w4a.path, claim: claim4aOrig, writeContent: writeContent4a, lane: 'inside ceiling AND inside the binding restriction (row 4a read+writes it)' },
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
    writeFileSync(join(world.home, 'p6t6-directive.json'), JSON.stringify(p6t6Directive({ worldId: world.id, logDir: world.logDir }), null, 2))
    assertBlueprintText(BP_ANCHOR_YAML, BP_ANCHOR_ID, 1, 'anchor.yaml')
    mkdirSync(dirname(rowPaths.a.path), { recursive: true })
    mkdirSync(dirname(rowPaths.c.path), { recursive: true })
    writeFileSync(rowPaths.a.path, `${claimA}\n`)
    writeFileSync(rowPaths.c.path, `${claimC}\n`)
    // B is PLANTED, not created by the write rows. Row 4b asks for the product's
    // write⇒read refusal, and that branch fires only for an EXISTING target
    // (`team-services/src/fs.ts`: the coupling is skipped when the target is
    // absent). A missing B made the old row 4 measure a different refusal. It also
    // makes row 2's "no claim leak" clause non-vacuous: B now HAS content that
    // must not be served.
    writeFileSync(rowPaths.b.path, `${claimB}\n`)
    // 4a's target exists too, so its write is a REPLACE of an observed file and
    // not a `createIfAbsent` — the same read⇒write shape as 4b, on an allowed lane.
    writeFileSync(rowPaths.w4a.path, `${claim4aOrig}\n`)
    log(`planted A=${rowPaths.a.path} (${claimA}); B=${rowPaths.b.path} (${claimB}, writable by the ceiling but unreadable by the binding lane); C=${rowPaths.c.path} (${claimC}); w4a=${rowPaths.w4a.path} (${claim4aOrig}, read+written by row 4a)`)
    log(`rows: ${rows.map((r) => r.id).join(',')}`)
    log(`team row a5sfEvidencePath=${String(config.a5sfEvidencePath)} a5sfNativeToolModules=${JSON.stringify(config.a5sfNativeToolModules)}`)
    log(`provider counter ledger: ${counterPath}`)
    world.u6Fs.rows.push(...rows)

    // ── the home-level pin, written BEFORE the spawn (helper header) ────────
    // homePin was computed once above (single source; see the note there).
    writeFileSync(homePin.path, homePin.yaml)
    const homePinRead = readFileSync(homePin.path, 'utf8')
    if (homePinRead !== homePin.yaml) throw new Error(`the home patch did not persist verbatim: ${homePin.path}`)
    log(`home patch written: ${homePin.path} (mode=${homePin.mode} workspaceRoot=${homePin.workspaceRoot}) sha256=${createHash('sha256').update(homePinRead).digest('hex')}`)

    await world.startMock({ decide: makeDecide({ rowPaths }) })
    log(`mock started on ${String(world.mock?.port)}`)

    // ── BOOT 1 of 1: intent row (written) -> start row -> spawn ────────────
    bootInfo = await lease.boot(() => harness.boot({ world, phase: 'a5sf-acceptance-boot1', bootTimeoutMs: 180_000 }))
    hostReached = true
    abortStage = 'post-boot'
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

    // ORDER, MEASURED (#575 defect 1). The production row anchors the ANCHOR
    // team on the BOOT root at boot, and `team.create` on an already-bound root
    // takes the cold path and refuses a DIFFERENT blueprint
    // (`TEAM_CREATE_BLUEPRINT_MISMATCH`, s6-remote.ts) — so the dynamically
    // built acceptance blueprint cannot be bound to the boot root. Discovery
    // therefore samples the ANCHOR root, the acceptance Team is created on
    // ACCEPTANCE_ROOT, and only THEN is the state query (whose p6t6 directive
    // names ACCEPTANCE_ROOT) expected to report a teamSession. The previous
    // driver waited for state BEFORE create and read a DIFFERENT team forever.
    //
    // discovery -> the model-visible surface -> the real main blueprint
    const discPrompt = await apiPrompt(origin, cookie, BOOT_ROOT, MK_DISC, 'a5sfacc')
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

    abortStage = 'team.create'
    const created = await remoteCall(fetchJson, origin, cookie, 'team.create', {
      rootSessionId: ACCEPTANCE_ROOT,
      blueprintId: BP_MAIN_ID,
      initialWork: { prompt: MK_L1 },
    }, 'a5sfacc')
    const createOk = created.status === 200 && created.body?.result?.ok === true
    log(`team.create status=${String(created.status)} ok=${String(createOk)} ${redact(JSON.stringify(created.body ?? null)).slice(0, 400)}`)
    if (!createOk) throw new Error(`team.create failed: status=${String(created.status)} body=${redact(JSON.stringify(created.body ?? null)).slice(0, 300)}`)

    abortStage = 'state-query'
    // THE IDENTITY ASSERTION, IN THE BOOT: the state query is the root the Team
    // was created on. A false here is the #575 defect, not a row failure.
    const stateOk = await waitFor(async () => {
      const st = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
      return st.status === 200 && st.body?.rootSessionId === ACCEPTANCE_ROOT && st.body?.teamSession !== null
    }, 90_000)
    log(`p6t6 state (rootSessionId=${ACCEPTANCE_ROOT}, teamSession!=null)=${String(stateOk)}`)
    if (!stateOk) {
      throw new Error(`the state query does not report the acceptance Team at the root it was created on (${ACCEPTANCE_ROOT}) — refusing to evaluate any row against a foreign team`)
    }

    abortStage = 'drive'
    // ── drive: the leader chain is synchronous (async:false delegate) ──────
    const replySeen = (content) => (world.mock?.requests ?? []).some((r) => r.reply?.kind === 'text' && String(r.reply.content ?? '').startsWith(content))
    const d1Ok = await waitFor(() => replySeen(DONE_D1), 300_000)
    const chainOk = await waitFor(() => replySeen(DONE_L1), 180_000)
    log(`worker D1 turn closed (${DONE_D1})=${String(d1Ok)} leader chain closed (${DONE_L1})=${String(chainOk)}`)
    // Give the last tool result one beat to land in the mock corpus + the sink.
    await new Promise((r) => setTimeout(r, 1500))

    abortStage = 'evidence-collection'
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
    const writeFor = (path) => writeCalls.find((c) => String(c.args?.file_path ?? '') === path) ?? null
    const callA = callFor(rowPaths.a.path)
    const callB = callFor(rowPaths.b.path)
    const callC = callFor(rowPaths.c.path)
    const call4a = callFor(rowPaths.w4a.path)
    // Row 4a and 4b are DISTINCT dispatches at distinct locators: the same
    // `write` tool is called twice, and the rows must not share a result.
    const writeCall = writeFor(rowPaths.b.path)
    const writeCall4a = writeFor(rowPaths.w4a.path)
    const resultOf = (call) => (call === null ? null : results.find((r) => r.callId === call.callId) ?? null)
    const resultA = resultOf(callA)
    const resultB = resultOf(callB)
    const resultC = resultOf(callC)
    const result4a = resultOf(call4a)
    const resultWrite = resultOf(writeCall)
    const resultWrite4a = resultOf(writeCall4a)

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
    const facts4a = factsFor(guardFacts, rowPaths.w4a.path)
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
    const disk4a = existsSync(rowPaths.w4a.path) ? readFileSync(rowPaths.w4a.path, 'utf8') : null
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
    // THE CLIP IS GONE (the #575 defect 3). The activation refusal was persisted
    // at 320 chars and its cause `(deferred …)` was lost with the World. There is
    // NO driver-imposed character bound on any row-verdict input or on the
    // persisted rowValues/transcript: the only bound is the Host's own tool-result
    // size (and the mock's response), which is evidence, not a capture decision.
    // Console log lines are display-only; the JSON records are complete.
    evidence.rowValues = {
      a: { call: callA, result: resultA === null ? null : { isError: resultA.isError, text: redact(resultA.text) } },
      b: { call: callB, result: resultB === null ? null : { isError: resultB.isError, text: redact(resultB.text) } },
      c: { call: callC, result: resultC === null ? null : { isError: resultC.isError, text: redact(resultC.text) } },
      write4a: { call: call4a, result: result4a === null ? null : { isError: result4a.isError, text: redact(result4a.text) }, disk: disk4a },
      writeB: { call: writeCall, result: resultWrite === null ? null : { isError: resultWrite.isError, text: redact(resultWrite.text) }, disk: diskB },
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
    // Every verdict below comes from the SHARED, host-free oracle
    // (`tests/world-factory/lib/a5sf-acceptance-preflight.mjs`). The judges are
    // three-way: a row whose observable was never produced is NOT_REACHED, not
    // FAIL — the #575 record printed FAIL:6 for exactly that reason. The sample
    // each judge received is persisted in `oracle-samples.json` so a reader can
    // re-run the decision without the World.
    const memberARequest = surfacePerMemberRequest[0] ?? null
    const preconditionSample = {
      hostAlive: hostAlive(),
      memberRequest: memberARequest,
      discovery: { readSchemas: discoveryReadSchemas, readMentions: discoveryReadMentions, readSectionMentions: discoveryReadSectionMentions },
      readCalls: readCalls.length,
    }
    const precondition = judgePrecondition(preconditionSample)
    oracleSamples[ACCEPTANCE_CASE_IDS.precondition] = { sample: preconditionSample, ...precondition }
    add(ACCEPTANCE_CASE_IDS.precondition, toRunVerdict(precondition.verdict), {
      ...precondition.detail,
      writeCalls: writeCalls.length,
      surface,
      note: 'the a5sf-wired Member ACTIVATED and ran model turns whose surface carried exactly ONE native `read`; this is the precondition for every row below, not one of the six',
    })

    // ── row 1: read A (inside both) ─────────────────────────────────────────
    const aAllowFacts = factsA.filter((f) => f.decision === 'allow')
    const aBindingAllow = aAllowFacts.filter((f) => f.realm === 'binding' && f.toolBindingIdentity === BINDING_IDENTITY)
    const aCounter = rowsForPath(readRows, rowPaths.a.path)
    const row1Sample = { call: callA ?? null, result: resultA ?? null, claim: claimA, allowFacts: aAllowFacts, bindingAllowFacts: aBindingAllow, counterRows: aCounter }
    const row1 = judgeRow1(row1Sample)
    oracleSamples[ACCEPTANCE_CASE_IDS.row1] = { sample: row1Sample, ...row1 }
    add(ACCEPTANCE_CASE_IDS.row1, toRunVerdict(row1.verdict), {
      ...row1.detail,
      call: callA ?? null,
      observed: resultA === null ? null : { isError: resultA.isError, text: redact(resultA.text) },
      bindingLaneAllowFacts: aBindingAllow.map((f) => ({ realm: f.realm, toolBindingIdentity: f.toolBindingIdentity, method: f.method, decision: f.decision, decidedBy: f.decidedBy, policyRevision: f.policyRevision })),
      counterRows: aCounter.map((r) => ({ leg: r.leg, method: r.method, instance: r.instance, isBase: r.isBase })),
      lane: 'inside ceiling [workspace] AND inside the binding read restriction [workspace/axis/allow]',
      note: 'the model-visible native `read` on A returned the planted bytes, the sink recorded allow facts on the BINDING realm (toolBindingIdentity dsh.fs/read), and the confined provider instance served it',
    })

    // ── row 2: read B (ceiling yes, restriction no) ────────────────────────
    const bDeny = factsB.filter((f) => f.decision === 'deny')
    const bBindingDeny = bDeny.filter((f) => f.realm === 'binding' && f.toolBindingIdentity === BINDING_IDENTITY)
    const bCounterReads = rowsForPath(readRows, rowPaths.b.path)
    const row2Sample = { call: callB ?? null, result: resultB ?? null, claim: claimB, writeContent, facts: factsB, counterRows: bCounterReads }
    const row2 = judgeRow2(row2Sample)
    oracleSamples[ACCEPTANCE_CASE_IDS.row2] = { sample: row2Sample, ...row2 }
    add(ACCEPTANCE_CASE_IDS.row2, toRunVerdict(row2.verdict), {
      ...row2.detail,
      call: callB ?? null,
      observed: resultB === null ? null : { isError: resultB.isError, text: redact(resultB.text) },
      denyFactsForB: bDeny.length,
      bindingLaneDenyFacts: bBindingDeny.map((f) => ({ schema: f.schema, realm: f.realm, toolBindingIdentity: f.toolBindingIdentity, memberIdentity: f.memberIdentity, method: f.method, decision: f.decision, decidedBy: f.decidedBy, policyRevision: f.policyRevision, sequence: f.sequence, observedAt: f.observedAt, locator: f.locator })),
      providerReadRowsForB: bCounterReads.length,
      lane: 'inside ceiling [workspace], OUTSIDE the binding read restriction [workspace/axis/allow]',
      note: 'the binding lane refused it: EVERY read-path consultation at B (the live one was `stat`, because a refused read never reaches `readText`) is a binding-lane deny, and no provider read method ran for it. The row does NOT assert a count — see judgeRow2 and README §12.1.',
    })

    // ── row 3: read C (ceiling no, restriction yes) ────────────────────────
    const cDeny = factsC.filter((f) => f.decision === 'deny')
    const cBindingDeny = cDeny.filter((f) => f.realm === 'binding' && f.toolBindingIdentity === BINDING_IDENTITY)
    const probeC = laneReport?.probePaths?.find((p) => p.locator === rowPaths.c.path) ?? null
    const probeB = laneReport?.probePaths?.find((p) => p.locator === rowPaths.b.path) ?? null
    const probeA = laneReport?.probePaths?.find((p) => p.locator === rowPaths.a.path) ?? null
    const cCounterReads = rowsForPath(readRows, rowPaths.c.path)
    const row3Sample = {
      call: callC ?? null,
      result: resultC ?? null,
      claim: claimC,
      denyFacts: cDeny,
      bindingDenyFacts: cBindingDeny,
      counterRows: cCounterReads,
      probeC,
      laneReport,
    }
    const row3 = judgeRow3(row3Sample)
    oracleSamples[ACCEPTANCE_CASE_IDS.row3] = { sample: row3Sample, ...row3 }
    add(ACCEPTANCE_CASE_IDS.row3, toRunVerdict(row3.verdict), {
      ...row3.detail,
      call: callC ?? null,
      observed: resultC === null ? null : { isError: resultC.isError, text: redact(resultC.text) },
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
      lane: 'OUTSIDE the ceiling [workspace], INSIDE the binding read restriction [<home>/restriction-outside]',
      note: 'the restriction alone would ALLOW C; the request was refused anyway, and the product algebra report shows the binding lane enforces the INTERSECTION (ceiling deny + restriction allow => effective deny). A binding lane cannot widen the ceiling.',
    })

    // ── row 4a: native write INSIDE the readable in-lane subtree ───────────
    // The product ALLOWS this write (the target is inside the ceiling write lane
    // AND inside the binding read allowance, and it was read first). What the row
    // asserts is that the ALLOWANCE did not cross channels: every write fact is
    // ceiling-realm, none is on the binding (read) lane.
    const writeFacts4a = facts4a.filter((f) => /write|edit/i.test(String(f.method ?? '')))
    const row4aSample = {
      call: writeCall4a ?? null,
      result: resultWrite4a ?? null,
      expectedContent: writeContent4a,
      disk: disk4a,
      facts: facts4a,
      counterRows: rowsForPath(writeRows, rowPaths.w4a.path),
    }
    const row4a = judgeRow4a(row4aSample)
    oracleSamples[ACCEPTANCE_CASE_IDS.row4a] = { sample: row4aSample, ...row4a }
    add(ACCEPTANCE_CASE_IDS.row4a, toRunVerdict(row4a.verdict), {
      ...row4a.detail,
      call: writeCall4a ?? null,
      readOfTarget: call4a ?? null,
      observed: resultWrite4a === null ? null : { isError: resultWrite4a.isError, text: redact(resultWrite4a.text) },
      diskContent: disk4a,
      plantedContentBefore: `${claim4aOrig}\n`,
      writeFacts: writeFacts4a.map((f) => ({ realm: f.realm, toolBindingIdentity: f.toolBindingIdentity, method: f.method, decision: f.decision, decidedBy: f.decidedBy })),
      lane: 'w4a.txt is inside the ceiling write lane [workspace] AND inside the binding read allowance [workspace/axis/allow], and it was READ before the write',
      note: 'the native write was ALLOWED and landed on disk; EVERY write fact is ceiling-realm (realm:"member", toolBindingIdentity:null). No write fact exists on the read (binding) lane — the allow did not cross channels.',
    })

    // ── row 4b: native write to B is CEILING-allowed and READ-not-implied ──
    // Boot 2 measured the product: B is inside the ceiling write lane but
    // OUTSIDE the binding read allowance, and the guard ALLOWS the write (the
    // restriction constrains READ only); the fact lands on the CEILING realm.
    // The write reaches the confined provider and the HOST's read-before-write
    // policy then refuses it downstream ("file has not been read") — the planted
    // content is unchanged and no planted byte comes back. That host refusal is
    // the upstream tool policy, NOT a Team-lane security property. The row
    // asserts the two-axis statement + "not delivered blindly"; the provider
    // counter is reported, not checked (§12.8).
    const writeFactsB = factsB.filter((f) => /write|edit/i.test(String(f.method ?? '')))
    const writeCounterRows = rowsForPath(writeRows, rowPaths.b.path)
    const row4bSample = {
      call: writeCall ?? null,
      result: resultWrite ?? null,
      plantedContent: `${claimB}\n`,
      disk: diskB,
      facts: factsB,
      counterRows: writeCounterRows,
    }
    const row4b = judgeRow4b(row4bSample)
    oracleSamples[ACCEPTANCE_CASE_IDS.row4b] = { sample: row4bSample, ...row4b }
    add(ACCEPTANCE_CASE_IDS.row4b, toRunVerdict(row4b.verdict), {
      ...row4b.detail,
      call: writeCall ?? null,
      observed: resultWrite === null ? null : { isError: resultWrite.isError, text: redact(resultWrite.text) },
      diskContent: diskB,
      plantedContent: `${claimB}\n`,
      writeFacts: writeFactsB.map((f) => ({ realm: f.realm, toolBindingIdentity: f.toolBindingIdentity, method: f.method, decision: f.decision, decidedBy: f.decidedBy })),
      readLaneFactsForBOverall: factsB.filter((f) => f.realm === 'binding').map((f) => ({ method: f.method, decision: f.decision })),
      counterRows: writeCounterRows.map((r) => ({ leg: r.leg, method: r.method, instance: r.instance, isBase: r.isBase })),
      lane: 'B is inside the ceiling write lane [workspace] but OUTSIDE the binding read allowance [workspace/axis/allow]; the binding restriction constrains READ only, so the guard ADMITS the write on the ceiling realm',
      note: 'the guard ALLOWED the write (writeText/allow, realm "member") because the binding restriction constrains the READ axis only — a write is bounded by the ceiling alone. The write reached the confined provider; the HOST read-before-write policy then refused it ("file has not been read"), the planted content is unchanged, and no planted byte came back to the model. That refusal is the upstream tool policy, NOT a Team-lane refusal and NOT a security property of the Team lanes; the row asserts exactly that, plus that the two lanes were not crossed.',
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
    let lateToolReport = null
    let invalidationLine = null
    let postInvalidationRead = null
    let postInvalidationInLane = null
    let unknownControl = null
    let factsAfter5 = factsBefore5
    let counterAfter5 = counterBefore5
    let sinkDelta5 = null
    let counterDelta5 = null
    let hostLogAfter5 = hostLogBefore5
    let presetDefinitionVisible = null
    let row5Sample = { member: workerBefore, forbiddenClaim: claimB }
    if (workerSession !== '') {
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
      postInvalidationInLane = await fetchJson(`${origin}/__p6t6/tool`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ name: 'read', args: { file_path: rowPaths.a.path }, as: workerSession, callId: 'a5sfacc-post-invalidation-inlane' }),
      }, 60_000)
      log(`post-invalidation in-lane read: status=${String(postInvalidationInLane.status)} body=${redact(JSON.stringify(postInvalidationInLane.body ?? null)).slice(0, 600)}`)
      // (e) the unknown-name control: the gate must NOT deny an unmanaged name.
      unknownControl = await fetchJson(`${origin}/__p6t6/tool`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ name: 'x_acceptance_late_unrelated', args: {}, as: workerSession, callId: 'a5sfacc-late-tool-control' }),
      }, 60_000)
      lateToolReport = readJson(lateReportPath)
      factsAfter5 = parseJsonl(sinkPath).filter((f) => f?.schema === 'a5sf-guard-consult/1').length
      counterAfter5 = parseJsonl(counterPath).length
      sinkDelta5 = factsAfter5 - factsBefore5
      counterDelta5 = counterAfter5 - counterBefore5
      hostLogAfter5 = (() => { try { return readFileSync(bootInfo.logPath, 'utf8') } catch { return '' } })()
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
      row5Sample = {
        member: workerBefore,
        lateTrigger,
        lateReport: lateToolReport,
        invalidationLine,
        postRead: postInvalidationRead,
        inLaneRead: postInvalidationInLane,
        forbiddenClaim: claimB,
        sinkDelta: sinkDelta5,
        counterDelta: counterDelta5,
      }
    }
    const row5 = judgeRow5(row5Sample)
    oracleSamples[ACCEPTANCE_CASE_IDS.row5] = { sample: row5Sample, ...row5 }
    add(ACCEPTANCE_CASE_IDS.row5, toRunVerdict(row5.verdict), {
      ...row5.detail,
      state: redact(JSON.stringify(stateBefore.body ?? null)),
      lateToolTrigger: lateTrigger === null ? null : { status: lateTrigger.status, body: lateTrigger.body },
      lateToolReport: lateToolReport,
      invalidationLine: row5Sample.invalidationLine ?? null,
      presetDefinitionVisible,
      postInvalidationRead: postInvalidationRead === null ? null : {
        status: postInvalidationRead.status,
        ok: postInvalidationRead.body?.ok ?? null,
        error: postInvalidationRead.body?.error ?? null,
        forbiddenBytesReturned: JSON.stringify(postInvalidationRead.body ?? {}).includes(claimB),
      },
      postInvalidationInLaneRead: postInvalidationInLane === null ? null : {
        status: postInvalidationInLane.status,
        ok: postInvalidationInLane.body?.ok ?? null,
        error: postInvalidationInLane.body?.error ?? null,
        plantNotReturned: !JSON.stringify(postInvalidationInLane.body ?? {}).includes(claimA),
      },
      lateToolControl: unknownControl === null ? null : { status: unknownControl.status, body: unknownControl.body ?? null },
      sinkFactsBefore: factsBefore5,
      sinkFactsAfter: factsAfter5,
      counterRowsBefore: counterBefore5,
      counterRowsAfter: counterAfter5,
      hostLogLinesAdded: hostLogAfter5.split('\n').length - hostLogBefore5.split('\n').length,
      note: 'the P0 admission deny fires at tools/pre-execute, so it writes NO a5sf-guard-consult/1 fact and reaches NO provider method (sinkDelta 0 AND counterDelta 0 are the expected, asserted values — the refusal happens before either seam; that is the proof the forbidden bytes were never read). The witness is the typed refusal + the product invalidation line. A row whose invalidation event never fired is NOT_REACHED, never FAIL: the product was never asked.',
    })

    // ── row 6: teardown ────────────────────────────────────────────────────
    const stateMid = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
    const membersMid = Array.isArray(stateMid.body?.members) ? stateMid.body.members : []
    const workerMid = membersMid.find((m) => String(m.templateId) === 'worker') ?? null
    const targetSession = String(workerMid?.childSessionId ?? workerSession)
    // THE STOP INSTANT. The row's temporal bound is "no fact observed AFTER the
    // stop", so the driver records the instant the product ANSWERED the archive
    // dispatch (and the dispatch instant, so a reader can see the window). The
    // instant is taken immediately after the response resolves, before any other
    // dispatch — never derived from the sink.
    const archiveDispatchedAt = new Date().toISOString()
    const archiveCall = targetSession === ''
      ? null
      : await fetchJson(`${origin}/__p6t6/tool`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({
          name: 'team_archive_member',
          args: { rootSessionId: ACCEPTANCE_ROOT, requestToken: 'a5sfacc-archive', targetInstanceId: String(workerMid?.instanceId ?? '') },
          as: ACCEPTANCE_ROOT,
          callId: 'a5sfacc-archive',
        }),
      }, 60_000)
    const stopInstant = new Date().toISOString()
    log(`archive via product tool route: status=${String(archiveCall?.status)} dispatchedAt=${archiveDispatchedAt} stopInstant=${stopInstant} body=${redact(JSON.stringify(archiveCall?.body ?? null)).slice(0, 600)}`)
    // THE STOP-TIME SINK, captured as an ARRAY immediately after the archive was
    // answered and BEFORE any post-stop probe. This is the set the temporal bound
    // is judged over. Boot 2 re-read the sink after its own probes and counted
    // the two facts those probes appended as "facts after the stop" — the row
    // refuted itself (§12.8.1). The probes' delta is carried separately.
    const factsAtStop = parseJsonl(sinkPath).filter((f) => f?.schema === 'a5sf-guard-consult/1')
    const stateAfterArchive = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
    const membersAfter = Array.isArray(stateAfterArchive.body?.members) ? stateAfterArchive.body.members : []
    const observations = Array.isArray(stateAfterArchive.body?.observations) ? stateAfterArchive.body.observations : []
    // THE #575 FILTER DEFECT, fixed structurally: the old filter matched the
    // ROOT SESSION NAME (every observation line carries `agent=session-a5sf-…`,
    // so `a5sfFaults` in the #575 teardown evidence was ALL 30 guard lines and
    // the real fault would have been invisible among them). Faults are now
    // classified against the CLOSED fault grammar and the MANAGED MEMBER
    // IDENTITY (exact child-session id; the identity-less realm fault only
    // inside this Member's disposal window with exactly one managed realm).
    const managedIdentity = { sessionId: targetSession, instanceId: String(workerMid?.instanceId ?? '') }
    const faultsAtArchive = classifyDisposeFaults({
      observations,
      managed: managedIdentity,
      duringManagedDisposal: true,
      managedRealmCount: membersAfter.filter((m) => String(m.templateId) === 'worker').length || 1,
    })
    const factsBefore6 = factsAtStop.length

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
    const faultsAfterDrop = classifyDisposeFaults({
      observations: observationsAfterDrop,
      managed: managedIdentity,
      duringManagedDisposal: true,
      managedRealmCount: membersAfter.filter((m) => String(m.templateId) === 'worker').length || 1,
    })
    const postDropRead = targetSession === ''
      ? null
      : await fetchJson(`${origin}/__p6t6/tool`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ name: 'read', args: { file_path: rowPaths.b.path }, as: targetSession, callId: 'a5sfacc-post-drop-read' }),
      }, 90_000)
    const factsAtEnd = parseJsonl(sinkPath).filter((f) => f?.schema === 'a5sf-guard-consult/1')
    // THE PROBE DELTA: every fact the sink gained after the stop-time snapshot.
    // The row's two probes are the only dispatches in this window, so the delta
    // is their stimulus; it is judged as "must be a refusal", never as a leak.
    const probeFacts = factsAtEnd.slice(factsAtStop.length)
    const factsAfter6 = factsAtEnd.length
    const healthAfter = await fetchJson(`${origin}/__p6t6/health`, undefined, 20_000)
    log(`row6: archive=${String(archiveCall?.status)} postArchiveRead=${String(postArchiveRead?.status)} residencyDrop=${JSON.stringify(residencyDrop?.body ?? null)} postDropRead=${String(postDropRead?.status)} health=${String(healthAfter.status)} factsAtStop=${String(factsAtStop.length)} probeFacts=${String(probeFacts.length)} sinkDelta=${String(factsAfter6 - factsBefore6)}`)
    const postArchiveNoLive = postArchiveRead !== null && postArchiveRead.status === 422
    const archiveOk = archiveCall !== null && archiveCall.status === 200 && archiveCall.body?.ok === true
    // THE PROPERTY, not the mechanism: after the stop, a dispatch to that scope
    // must either be refused (422 NO_LIVE_AGENT) or answer a REFUSAL — never a
    // success that carries the forbidden bytes. A cold-resume that re-assembles
    // a FRESH constrained realm is not an unconstrained shadow; a success on B
    // would be (B is outside the binding lane).
    const dispatchedAfterStop = [postArchiveRead, postDropRead].filter((r) => r !== null)
    const anySuccessAfterStop = dispatchedAfterStop.filter((r) => r.status === 200 && r.body?.ok === true)
    const refusalCodesAfterStop = dispatchedAfterStop.map((r) => ({
      status: r.status,
      code: r.body?.error?.info?.code ?? null,
      ok: r.body?.ok ?? null,
      message: redact(String(r.body?.error?.message ?? '')),
    }))
    const row6Sample = {
      member: workerMid,
      archive: archiveCall,
      membersAfter,
      observations: observationsAfterDrop.length > 0 ? observationsAfterDrop : observations,
      managed: managedIdentity,
      duringManagedDisposal: true,
      managedRealmCount: membersAfter.filter((m) => String(m.templateId) === 'worker').length || 1,
      postStopDispatches: dispatchedAfterStop,
      residencyDrop,
      forbiddenClaim: claimB,
      // THE TEMPORAL BOUND: the sink AS OF THE STOP (captured before any probe).
      // The judge compares each `observedAt` with the stop instant; the old
      // `sinkDelta` count is carried as an informational number and is NOT a
      // check. The probe delta is a SECOND, separate input (must be refusals).
      facts: factsAtStop,
      probeFacts,
      stopInstant,
      sinkDelta: factsAfter6 - factsBefore6,
      healthStatus: healthAfter.status,
      hostAlive: hostAlive(),
    }
    const row6 = judgeRow6(row6Sample)
    // The sample keeps the FULL facts array (not a count): a reader must be able
    // to re-run `judgeRow6` on this evidence without the World.
    oracleSamples[ACCEPTANCE_CASE_IDS.row6] = { sample: { ...row6Sample, observations: row6Sample.observations.length, membersAfter: row6Sample.membersAfter.length }, ...row6 }
    const teardownEvidence = {
      archive: archiveCall === null ? null : { status: archiveCall.status, body: archiveCall.body, ok: archiveOk },
      membersAfterArchive: membersAfter.map((m) => ({ instanceId: m.instanceId, templateId: m.templateId, lifecycle: m.lifecycle, childSessionId: m.childSessionId })),
      observations,
      disposeFaultsAtArchive: faultsAtArchive,
      postArchiveRead: postArchiveRead === null ? null : { status: postArchiveRead.status, body: postArchiveRead.body },
      postArchiveNoLiveAgent: postArchiveNoLive,
      residencyDrop: residencyDrop === null ? null : { status: residencyDrop.status, body: residencyDrop.body },
      observationsAfterDrop,
      disposeFaultsAfterDrop: faultsAfterDrop,
      postDropRead: postDropRead === null ? null : { status: postDropRead.status, body: postDropRead.body },
      anySuccessAfterStop: anySuccessAfterStop.map((r) => ({ status: r.status, body: r.body })),
      refusalCodesAfterStop,
      healthAfterDrop: { status: healthAfter.status, body: healthAfter.body },
      stopInstant,
      archiveDispatchedAt,
      sinkFactsAtStop: factsAtStop.length,
      probeFacts,
      sinkFactsAfterProbes: factsAfter6,
      hostAlive: hostAlive(),
      seamsObserved: [
        'product archive lifecycle: team_archive_member dispatched through the row tool route (as the acceptance root/leader)',
        'product dispatch seam: POST /__p6t6/tool {as:<member child session>} — only a LIVE agent can be dispatched to; an archived member must answer NO_LIVE_AGENT (422)',
        'the product residency seam: POST /__p6t6/residency/drop {sessionId} — disposes the live agent handle, draining the setup disposers (incl. the a5sf realm)',
        'the row dispose-observation channel: GET /__p6t6/state .observations (classified against the CLOSED fault grammar and this Member\'s exact session id; the identity-less realm fault only inside this disposal window)',
        'the a5sf sink: the fact set AS OF THE STOP (captured before any probe) plus the probe delta; the row asserts no STOP-TIME fact follows the stop and every probe-added fact is a refusal',
        'the process seam: the Host child alive + the World teardown report (port released, home deleted)',
      ],
      seamsNotReached: [
        'an in-process read of the DISPOSED scope\'s tool registry (tools.get("read", <old agent>)) — no public HTTP route exposes a disposed scope, and this lane did not fork an infrastructure plugin for it',
      ],
      note: 'PROVEN for the asked properties as OBSERVED through the seams above: no dispatch path reaches the stopped Member with a success (so no usable shadow, constrained or not), no MANAGED dispose fault was reported, no STOP-TIME fact was written after the stop, every fact the row\'s own post-stop probes appended is a refusal, and the Host/port/home teardown is clean. NOT claimed: that the disposed scope\'s definition registry is empty — that needs an in-process seam this lane did not add. The realm-dispose observation carries NO session identity in the product text; it is attributed by the disposal window + single-managed-realm rule and that residual gap is disclosed, not hidden.',
    }
    evidence.teardown = teardownEvidence
    writeFileSync(join(HERE, 'teardown.json'), JSON.stringify(teardownEvidence, null, 2) + '\n')
    log(`teardown.json written: ${JSON.stringify({ faultsAtArchive: faultsAtArchive.managed.length, foreign: faultsAtArchive.foreign.length, ignored: faultsAtArchive.ignoredNonFaultCount, faultsAfterDrop: faultsAfterDrop.managed.length }).slice(0, 700)}`)
    add(ACCEPTANCE_CASE_IDS.row6, toRunVerdict(row6.verdict), {
      ...row6.detail,
      archiveOk,
      postArchiveReadStatus: postArchiveRead?.status ?? null,
      postArchiveNoLiveAgent: postArchiveNoLive,
      residencyDropped: residencyDrop?.body?.dropped ?? null,
      postDropReadStatus: postDropRead?.status ?? null,
      refusalCodesAfterStop,
      anySuccessAfterStop: anySuccessAfterStop.length,
      stopInstant,
      archiveDispatchedAt,
      factsAtStop: row6.detail.factsObserved ?? null,
      factsAfterStop: row6.detail.factsAfterStop ?? null,
      probeFactsObserved: row6.detail.probeFactsObserved ?? null,
      sinkDeltaObserved: factsAfter6 - factsBefore6,
      disposeFaultsAtArchive: faultsAtArchive,
      disposeFaultsAfterDrop: faultsAfterDrop,
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
      rowPaths: { a: rowPaths.a.path, b: rowPaths.b.path, c: rowPaths.c.path, w4a: rowPaths.w4a.path },
      homePatch: {
        path: homePin.path,
        mode: homePin.mode,
        workspaceRoot: homePin.workspaceRoot,
        sha256: createHash('sha256').update(homePin.yaml).digest('hex'),
        why: 'pins the deployment file-sandbox fallback root to this World workspace (README §12.4)',
      },
      stopInstant,
      archiveDispatchedAt,
    }
  } catch (error) {
    failure = error
    log(`RUN FAILED at stage=${abortStage} hostReached=${String(hostReached)}: ${String(error?.stack ?? error)}`)
    for (const id of CASES) {
      if (record.getCase(id) === undefined) {
        // A row that was never judged BECAUSE THE RUN ABORTED is not an absence
        // of the observable; it is an aborted run. Before the Host exists the
        // honest word is NOT_REACHED (no product was asked); after the Host
        // exists it is FAIL — otherwise a live mount/create regression reads as
        // "not reached" and the overall verdict outranks it (review B2).
        add(id, hostReached ? 'FAIL' : 'NOT_REACHED', {
          reason: hostReached ? 'RUN_ABORTED_AFTER_HOST_REACHED' : 'RUN_ABORTED_BEFORE_BOOT',
          unjudged: true,
          abortStage,
          detail: redact(String(error?.message ?? error)),
          note: hostReached
            ? 'UNJUDGED: the run aborted after the Host was reached, so no row was evaluated. This is a FAIL, not NOT_REACHED.'
            : 'UNJUDGED: the run aborted before any Host start, so no product was asked. This is NOT_REACHED.',
        })
      }
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
    if (Object.keys(oracleSamples).length > 0) {
      writeFileSync(join(HERE, 'oracle-samples.json'), JSON.stringify({
        schema: 'a5sf-acceptance-preflight/oracle-samples/1',
        note: 'the exact sample object handed to each judge, plus the judge output. Re-running the judge over the sample reproduces the verdict without a Host.',
        roots: ROOTS,
        rootWiring: assertDriverRootWiring(),
        cases: oracleSamples,
      }, null, 2) + '\n')
    }
    const summary = formatSummary(finalized)
    log(summary)
    log(`bootsSpent=${String(lease.bootsSpent())} overall=${String(overallVerdict(finalized.cases))} failure=${failure === null ? 'none' : redact(String(failure.message)).slice(0, 400)}`)
  }
  // AN ABORT MUST RECONCILE ITSELF. An attempt that dies before the Host is reached has already
  // written its intent row, so leaving it unreconciled makes the ledger read like an unexplained
  // spend and every later gate refuses (measured: the 08:11Z `homePin` abort). The abort row is
  // appended only when the ledger actually holds an intent for this run and no boot row for it, so
  // re-running the same driver cannot double-count.
  if (failure !== null && !hostReached) {
    try {
      const rows = readLedgerRows(LEDGER_PATH)
      const mine = rows.filter((row) => String(row.runId ?? '') === runId)
      const hasIntent = mine.some((row) => row.kind === 'budget-intent')
      const hasBoot = mine.some((row) => row.kind !== 'budget-intent' && String(row.phase ?? '').startsWith('a5sf-acceptance-boot'))
      const hasAbort = mine.some((row) => row.kind === 'budget-abort')
      if (hasIntent && !hasBoot && !hasAbort) {
        appendFileSync(LEDGER_PATH, JSON.stringify({
          at: new Date().toISOString(),
          runId,
          suite: 'a5sf-acceptance',
          kind: 'budget-abort',
          phase: 'a5sf-acceptance-abort-prehost',
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
