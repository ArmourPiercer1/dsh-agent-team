#!/usr/bin/env node
/**
 * run-boot.mjs — a5sf LIVE NATIVE 3: the ONE boot that answers whether, with
 * the RUNTIME AGENT as the scope key (#558, already in this tree), a
 * model-visible native `read` on an admitted Member executes through the
 * CONFINED provider.
 *
 * THIS IS BOOT 3 OF THE P2-01 LINE. Boot 1 (`evidence/a5sf-live-native/`) proved
 * the product refused every a5sf-wired Member activation with the unscoped-ctx
 * TypeError (the scope-key seam). Boot 2 (`evidence/a5sf-live-native2/`) spent
 * its start on a COMPOSITION defect at Loader compose (two file-URL rows from
 * one package identity) and never reached the question. This run starts from
 * boot 2's corrected composition — one evidence row, the counter folded into
 * it, and the `rowIdentityCheck` pre-boot guard — and asks the question.
 *
 * WHAT THIS SPENDS: exactly ONE Host start, charged through the BL-14
 * pre-registration gate (`tests/world-factory/suites/150-a5sf-read.mjs#preRegisterReadBudget`):
 *
 *   materialise grant.json (maxStarts = 2 = 1 intent row + 1 boot, bound to
 *   THIS tree's git HEAD) -> preRegisterReadBudget() writes the intent row on
 *   the ONE shared ledger (`tests/world-factory/lib/run-record.mjs`) ->
 *   lease.boot() -> `harness.boot()` writes the start row on the same ledger
 *   -> `world.startHost()` spawns. Order: intent -> start row -> spawn.
 *   A second spawn is refused by the lease (booted >= requiredBoots).
 *
 * WHAT IT ASKS (the reviewer's one line, split into seven cases):
 *   1. a managed Member whose row config carries `a5sfEvidencePath` +
 *      `a5sfNativeToolModules` ACTIVATES, and its model-visible surface
 *      carries exactly ONE `read` (no duplicate tool, no extra prompt section);
 *   2. a model-visible native `read` OUTSIDE the compiled ceiling is REFUSED
 *      by the a5sf Guard (not a crash, not a raw ENOENT);
 *   3. the configured sink holds exactly ONE `a5sf-guard-consult/1` fact with
 *      `decision:"deny"` / `decidedBy:"IO_READ_DENIED"`;
 *   4. a native `read` INSIDE the ceiling succeeds with MATCHING BYTES;
 *   5. the BASE provider's read counter did not move for either call while the
 *      CONFINED provider instance served the inside read (test instrumentation
 *      is disclosed: the shipped host fs has no read counter of its own);
 *   6. after the Member is archived, is a residual shadow observable? (The
 *      seam that would report a disposed agent scope is enumerated; NOT_REACHED
 *      is recorded rather than a witness invented);
 *   7. a deny-native Member (`builtinToolDeny` naming `read`) fails LOUDLY with
 *      route C's SURFACE-NEUTRALITY refusal — and no longer with the unscoped
 *      ctx TypeError the first boot observed.
 *
 * WHAT IT DOES NOT DO: no kernel/OS claim, no second boot, no `:3080`, no
 * product source edit (CORE PATCH BUDGET = 0). The `teamA5sfRealm` provider and
 * the compiled ceiling are supplied by a TEST COMPOSITION row
 * (`a5sf-native-provider-row.mjs`) because no product code provides them at
 * this base — disclosed in the evidence README, not laundered as product. The
 * base-provider read counter is installed by the SAME row behind
 * `config.counterPath` (a second file-URL row from the same package-less
 * evidence directory is refused by the host's client-modules registry — that
 * is what spent the 2026-11-03T13:02:54Z boot; see `run.log`).
 *
 * WORLD/HEATER REUSE: the World material, prescribed blueprint shape, scripted
 * provider and Team-tool drive are the FIRST boot's
 * (`evidence/a5sf-live-native/run-boot.mjs`), with three corrections the first
 * boot never got to exercise:
 *   - member-lane discrimination uses the exact `[team-work requestToken=`
 *     marker (a `[team-work-settled requestToken=…]` note in the leader's own
 *     history must NOT classify the leader as a member lane);
 *   - the second `team_delegate` sends exactly ONE of
 *     `delegationTemplateId` / `delegationInstanceId` (the tool refuses both);
 *   - the leader's tool set adds `team_follow_up`, so the teardown probe is a
 *     model-visible Team call rather than a driver coterie.
 *
 * MODES
 *   node run-boot.mjs --plan   build the World material + emit the patch layer
 *                              and validate both blueprints with the HOST's own
 *                              domain facade; NO gate, NO ledger row, NO spawn.
 *   node run-boot.mjs          the one boot (spends 1 start + 1 intent row).
 *
 * @module dev/agent-workflow/evidence/a5sf-live-native3/run-boot
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
const COUNTER_NAME = 'a5sf-base-reads.jsonl'

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

const LINE = 'a5sflive3'
const ROOT = 'session-a5sf-live3-root'
const CREATE_ROOT = 'session-a5sf-live3-team'
const BP_ANCHOR_ID = 'team.a5sf.live3.anchor'
const BP_MAIN_ID = 'team.a5sf.live3.main'
const PRESET_ID = 'a5sf-live3-base'

const MK_DISC = 'A5SF_LIVE3_DISC'
const MK_L1 = 'A5SF_LIVE3_L1_DRIVE'
const MK_OUTSIDE = 'A5SF_LIVE3_READ_OUTSIDE'
const MK_INSIDE = 'A5SF_LIVE3_READ_INSIDE'
const TOK_D1 = 'a5sf3-d1'
const TOK_D2 = 'a5sf3-d2'
/** The exact prefix the glue writes onto a member's work notice. Only a MEMBER
 *  request carries it; the leader's own settled note is `[team-work-settled
 *  requestToken=…]` and must not match. */
const MEMBER_ENVELOPE = '[team-work requestToken='
const DONE_OUTSIDE = 'A5SF3_OUTSIDE_DONE'
const DONE_INSIDE = 'A5SF3_INSIDE_DONE'
const DONE_L1 = 'A5SF3_L1_DONE'

const MANAGED_TOOL_NAMES = ['read', 'read_image', 'write', 'edit', 'lsp', 'bash', 'pwsh']
const SAFE_UNMANAGED_TOOL_NAMES = ['todo_write']
/** The read tool's own description — used only to count prompt/section duplication. */
const READ_DESCRIPTION = 'Read a UTF-8 text file and return line-numbered content.'
/** The read tool's OWN system-prompt section text (name `tool:read`) — the
 *  duplicate-section witness the route-C suite uses host-free (arm N2). */
const READ_SECTION_TEXT = 'Use the read tool — not shell commands like cat'

const CASES = Object.freeze([
  'live:member-activated-surface-one-read',
  'live:native-read-outside-refused',
  'live:sink-exactly-one-deny-fact',
  'live:native-read-inside-allowed',
  'live:base-read-counter-did-not-move',
  'live:teardown-no-shadow',
  'live:deny-native-surface-refusal',
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
  // The deny-native Member's lane NAMES the native `read` (point 6).
  const memberDeny = [...denyList, 'read']
  const denyLinesMember = ['      builtinToolDeny:', ...memberDeny.map((n) => `        - ${n}`)]
  return [
    '---', 'schemaVersion: 3', `blueprintId: ${BP_MAIN_ID}`, 'revision: "1"',
    'leader:', '  templateId: leader',
    `  persona: ${JSON.stringify(`You are the leader of the a5sf live-native3 boot team. ${MK_L1} drives your chain: delegate the outside read, delegate the inside read, create the deny-native member, archive the first member, probe the archived member with a follow-up, then finish.`)}`,
    '  capabilities:', '    teamTools:', '      kind: allow', '      items:',
    '        - team_delegate', '        - team_create_member', '        - team_archive_member', '        - team_follow_up',
    ...denyLines,
    '    skills:', '      kind: allow', '      items: []',
    '    mcp:', '      kind: allow', '      items: []',
    '    permissions:', '      default: deny', '      allow: []', '      ask: []', '      deny: []',
    'teamEnvelope:', '  allow:', '    - create-member', '    - assign-task', '    - send-message', '    - report-progress', '  deny: []',
    'members:',
    // (1) the a5sf-wired Member: NO capabilities block (the CI-03 population
    // shape) — its ONLY confinement is the compiled a5sf ceiling.
    '  - templateId: worker', '    displayName: "a5sf live native2 worker"',
    `    persona: ${JSON.stringify('You are the a5sf live-native3 worker. Follow the delegated script exactly, one tool call at a time.')}`,
    // (2) the reviewer's deny-native Member: a builtinToolDeny lane that NAMES
    // the native `read`. Under route C the setup must REFUSE (fail closed)
    // with the surface-neutrality refusal rather than run unconfined.
    '  - templateId: denyread', '    displayName: "a5sf deny-native worker"',
    `    persona: ${JSON.stringify('You are the a5sf deny-native worker. This template must never reach a model turn.')}`,
    '    capabilities:', '      teamTools:', '        kind: deny',
    ...denyLinesMember,
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
  `  persona: ${JSON.stringify(`You are the leader of the a5sf live-native3 boot team. ${MK_DISC} is the discovery marker.`)}`,
  'members:', '  - templateId: worker', '    persona: "You are the a5sf live-native3 worker."',
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
  return function decide({ req }) {
    const allText = messagesOf(req).map(textOf).join('\n')
    const lastUser = lastUserTextOfStatic(req)
    const userText = userTextOf(req)
    if (allText.includes('Generate the session title')) return { kind: 'text', content: 'a5sf live-native3 session' }
    // MEMBER LANES: the glue's own work-notice marker, exact prefix. The
    // leader's settled note (`[team-work-settled requestToken=…]`) does NOT
    // contain `[team-work requestToken=` and therefore cannot cross-wire.
    const isMemberD2 = userText.includes(`${MEMBER_ENVELOPE}${TOK_D2}`)
    const isMemberD1 = userText.includes(`${MEMBER_ENVELOPE}${TOK_D1}`)
    if (isMemberD2 || isMemberD1) {
      const reads = countAssistantToolUses(req, 'read')
      if (isMemberD2) {
        if (reads < 2) return {
          kind: 'tool-call',
          toolCalls: [{ id: `call-a5sf3-inside-${reads}`, name: 'read', arguments: { file_path: insidePath } }],
        }
        return { kind: 'text', content: `${DONE_INSIDE} ${lastToolResultText(req).slice(0, 160)}` }
      }
      if (reads < 1) return {
        kind: 'tool-call',
        toolCalls: [{ id: 'call-a5sf3-outside-0', name: 'read', arguments: { file_path: outsidePath } }],
      }
      return { kind: 'text', content: `${DONE_OUTSIDE} ${lastToolResultText(req).slice(0, 160)}` }
    }
    const isLeader = lastUser.includes(MK_L1)
      || allText.includes(MK_L1)
      || allText.includes('[team-work-settled')
      || allText.includes('A5SF3_LEADER')
    if (isLeader) {
      const teamCalls = ['team_delegate', 'team_create_member', 'team_archive_member', 'team_follow_up']
        .map((n) => countAssistantToolUses(req, n))
        .reduce((a, b) => a + b, 0)
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
        return {
          kind: 'tool-call',
          toolCalls: [{ id: 'call-a5sf3-delegate-outside', name: 'team_delegate', arguments: {
            rootSessionId: CREATE_ROOT,
            requestToken: `${TOK_D1}-delegate`,
            delegationTemplateId: 'worker',
            label: 'a5sf3-worker',
            prompt: `${MK_OUTSIDE} read the planted outside-ceiling file once, then report.`,
            async: false,
          } }],
        }
      }
      if (teamCalls === 1) {
        if (firstInstance === undefined) return { kind: 'text', content: 'A5SF3_LEADER_NO_INSTANCE' }
        // EXACTLY ONE delegation field: the tool refuses both.
        return {
          kind: 'tool-call',
          toolCalls: [{ id: 'call-a5sf3-delegate-inside', name: 'team_delegate', arguments: {
            rootSessionId: CREATE_ROOT,
            requestToken: `${TOK_D2}-delegate`,
            delegationInstanceId: firstInstance,
            label: 'a5sf3-inside',
            prompt: `${MK_INSIDE} read the planted inside-ceiling file once, then report.`,
            async: false,
          } }],
        }
      }
      if (teamCalls === 2) {
        return {
          kind: 'tool-call',
          toolCalls: [{ id: 'call-a5sf3-denyread-create', name: 'team_create_member', arguments: {
            rootSessionId: CREATE_ROOT,
            requestToken: 'a5sf3-denyread-create',
            delegationTemplateId: 'denyread',
            label: 'a5sf3-denyread',
          } }],
        }
      }
      if (teamCalls === 3) {
        if (firstInstance === undefined) return { kind: 'text', content: 'A5SF3_LEADER_NO_INSTANCE' }
        return {
          kind: 'tool-call',
          toolCalls: [{ id: 'call-a5sf3-archive', name: 'team_archive_member', arguments: {
            rootSessionId: CREATE_ROOT,
            requestToken: 'a5sf3-archive',
            targetInstanceId: firstInstance,
          } }],
        }
      }
      if (teamCalls === 4) {
        if (firstInstance === undefined) return { kind: 'text', content: 'A5SF3_LEADER_NO_INSTANCE' }
        return {
          kind: 'tool-call',
          toolCalls: [{ id: 'call-a5sf3-post-archive-followup', name: 'team_follow_up', arguments: {
            rootSessionId: CREATE_ROOT,
            requestToken: 'a5sf3-post-archive-followup',
            targetInstanceId: firstInstance,
            prompt: 'A5SF3_POST_ARCHIVE_PROBE: this follow-up targets an archived member.',
            async: false,
          } }],
        }
      }
      return { kind: 'text', content: DONE_L1 }
    }
    if (lastUser.includes(MK_DISC)) return { kind: 'text', content: 'A5SF3_DISC_DONE' }
    return { kind: 'text', content: 'A5SF3_LIVE_NOOP' }
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
    staticModel: { provider: 'deepseek-official', model: 'a5sf-live3-model' },
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
  }
}

function rowsFor({ home, workspaceDir }) {
  const dist = join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime')
  const PRODUCTION_ROW = pathToFileURL(join(dist, 'src', 'plugin', 'host.js')).href
  const P6T6_ROW = pathToFileURL(join(REPO_ROOT, 'packages', 'tools', 'harness', 'plugin.mjs')).href
  const providerRow = pathToFileURL(join(HERE, 'a5sf-native-provider-row.mjs')).href
  const config = teamRowConfig({ home })
  const basePlugins = [...smokePresetPlugins({
    personaText: 'You are a coding agent powered by the {{model}} model.',
    cwdSuffix: 'Your working directory is {{cwd}}.',
    bashDescription: 'Run commands in a bash shell. State is persistent across calls.',
  }), { id: 'tool-fs-search', name: '@deepseek-ai/dsh-tool-fs-search', config: { sampleOverCapGlobResults: false } }]
  return {
    rows: [
      // ONE evidence row (the host's client-modules registry refuses two
      // file-URL rows that resolve to the same repo-root package). It MUST
      // mount before the Team row so `ctx.get('teamA5sfRealm')` resolves when
      // the first Member setup runs (sibling service, app-wide registry).
      // `counterPath` also installs the disclosed base-provider read counter.
      { id: 'a5sf-native-provider', name: providerRow, config: { allowRoot: realpathSync(workspaceDir), counterPath: join(home, COUNTER_NAME) } },
      { id: 'dsh-agent-team', name: PRODUCTION_ROW, config },
      { id: 'p6t6-team-tools', name: P6T6_ROW },
      presetDeclarationRow({
        id: PRESET_ID,
        displayName: 'a5sf live3 base',
        description: `a5sf live-native3 boot preset (${LINE}) = smoke + tool-fs-search`,
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
 * The 2026-11-03T13:02:54Z boot died at Loader compose, not at the question:
 * the host's client-modules registry refuses two file-URL profile rows whose
 * nearest package.json is the SAME package that declares a client half. Both
 * evidence rows sat in a directory with no package.json, so both resolved to
 * the repo-root package `dsh-agent-team` (`dsh.client.platform = web`), and the
 * registry answered:
 *
 *   client-modules: package dsh-agent-team resolves from multiple active Loader
 *   sources: "file://…/a5sf-base-read-counter-row.mjs" …, "file://…/a5sf-native-provider-row.mjs" …;
 *   remove one entry
 *
 * This check reproduces that rule cheaply over the exact rows the boot WOULD
 * mount, so the class can never spend another start. It is a composition
 * precondition, not a product claim.
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
      'a5sf live-native3 boot: base-read counter + provider row (teamA5sfRealm) + production Team row',
      'with a5sfEvidencePath + a5sfNativeToolModules + p6t6 + preset declaration.',
    ], rows)
    log(`patch layer bytes=${patch.length}; rows=${rows.map((r) => r.id).join(',')}`)
    log('---- patch layer ----\n' + patch + '\n---- end patch ----')
    const provider = await import(pathToFileURL(join(HERE, 'a5sf-native-provider-row.mjs')).href)
    log(`provider row module: name=${provider.name} apply=${typeof provider.apply} inject=${JSON.stringify(provider.inject)}`)
    log(`pre-boot row identity check: ${JSON.stringify(rowIdentityCheck(rows))}`)
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

  // ── composition precondition: never spend a start on a row-identity defect ──
  // An EXISTING directory: rowsFor realpath()s the workspace, and the check
  // only needs module identity, not the World's real paths.
  const dryRun = rowsFor({ home: join(HERE, '.rowcheck'), workspaceDir: HERE })
  const identity = rowIdentityCheck(dryRun.rows)
  log(`pre-boot row identity check: ${JSON.stringify(identity).slice(0, 600)}`)
  if (identity.ok !== true) {
    throw new Error(`row composition refused before any ledger row: ${identity.reason}: ${identity.detail}`)
  }

  // ── the per-run grant, bound to the EXACT HEAD this run executes on ──────
  const grant = {
    grantId: `grant-a5sf-live-native3-${head.slice(0, 12)}`,
    maxStarts: 2,
    grantedBy: 'user ruling 2026-11-03 a5sf-boot-pool-20261103-user-20 — allocation item "P2-01 live read (BL-14 / G2 live half)", which holds 3 boots. This run is that item\'s SECOND boot: boot 1 (evidence/a5sf-live-native/) reached activation and was refused by the unscoped-ctx seam; boot 2 (evidence/a5sf-live-native2/) aborted at Loader compose on a composition defect before any product code ran. One boot of P2-01 remains after this one.',
    allocationItem: 'P2-01 live read (BL-14 / G2 live half)',
    boundCommit: head,
    note: 'maxStarts = 1 pre-registration (intent) row + 1 boot (BL-14 arithmetic: the gate counts shared-ledger rows, not spawns)',
  }
  writeFileSync(GRANT_PATH, JSON.stringify(grant, null, 2) + '\n')
  log(`grant materialised: ${GRANT_PATH} maxStarts=${grant.maxStarts} boundCommit=${grant.boundCommit} item=${grant.allocationItem}`)

  const runId = `a5sf-live-native3-${new Date().toISOString().replace(/[:.]/g, '-')}`
  const record = createRunRecord({
    runId,
    suite: 'a5sf-live-native3',
    selectedCases: CASES,
    bindings: {
      teamSha: head,
      hostSha: TEST_USE_BASELINE_SHA,
      hostTree: HOST_TREE,
      line: LINE,
      sink: 'world-home a5sf-consult.jsonl (copy: consultations.jsonl)',
      grantId: grant.grantId,
      allocationItem: grant.allocationItem,
      providerComposition: 'test row dev/agent-workflow/evidence/a5sf-live-native3/a5sf-native-provider-row.mjs (no product provider exists at this base)',
      baseReadCounter: 'installed by the SAME evidence row (a5sf-native-provider-row.mjs, config.counterPath): the shipped host fs has no read counter; instrumented in-memory, prototype wrap, pass-through',
      worldReuse: 'dev/agent-workflow/evidence/a5sf-live-native/run-boot.mjs world/heater, with three corrections documented in the README',
    },
    ledgerPath: LEDGER_PATH,
  })

  const harness = createA5sfHarness({
    repoRoot: REPO_ROOT,
    evidenceRoot: HERE,
    suite: 'a5sf-live-native3',
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
  const OUTSIDE_CLAIM = `A5SF3_OUTSIDE_CLAIM_${world.id}`
  const INSIDE_CLAIM = `A5SF3_INSIDE_CLAIM_${world.id}`
  const sinkPath = join(world.home, 'a5sf-consult.jsonl')
  const counterPath = join(world.home, COUNTER_NAME)
  let bootInfo = null
  let teardown = null
  let failure = null
  const evidence = { worldId: world.id, outside: { path: outside, claim: OUTSIDE_CLAIM }, inside: { path: inside, claim: INSIDE_CLAIM }, sinkPath, counterPath }

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
    log(`base-read counter ledger: ${counterPath}`)
    world.u6Fs.rows.push(...rows)

    await world.startMock({ decide: makeDecide({ outsidePath: outside, insidePath: inside }) })
    log(`mock started on ${String(world.mock?.port)}`)

    // ── BOOT 1 of 1: intent row (written) -> start row -> spawn ────────────
    bootInfo = await lease.boot(() => harness.boot({ world, phase: 'a5sf-live-native3-boot1', bootTimeoutMs: 180_000 }))
    log(`BOOTED port=${bootInfo.port} (lease bootsSpent=${lease.bootsSpent()}) log=${bootInfo.logPath}`)
    record.record.boots = [{ phase: 'a5sf-live-native3-boot1', world: world.id, port: bootInfo.port, logPath: bootInfo.logPath }]

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
    const discPrompt = await apiPrompt(origin, cookie, ROOT, MK_DISC, 'a5sf3')
    log(`discovery prompt status=${String(discPrompt.status)}`)
    const surfaceOk = await waitA(() => (world.mock?.requests ?? []).some((r) => hasMarker(r, MK_DISC) && surfaceNamesOf(r).length > 0), 150_000)
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
    assertBlueprintText(mainText, BP_MAIN_ID, 2, 'main.yaml')
    writeFileSync(join(config.blueprintDir, 'main.yaml'), mainText)
    log('main blueprint written and validated by the host facade')

    const created = await remoteCall(fetchJson, origin, cookie, 'team.create', {
      rootSessionId: CREATE_ROOT,
      blueprintId: BP_MAIN_ID,
      initialWork: { prompt: MK_L1 },
    }, 'a5sf3')
    const createOk = created.status === 200 && created.body?.result?.ok === true
    log(`team.create status=${String(created.status)} ok=${String(createOk)} ${redact(JSON.stringify(created.body ?? null)).slice(0, 400)}`)
    if (!createOk) throw new Error(`team.create failed: status=${String(created.status)} body=${redact(JSON.stringify(created.body ?? null)).slice(0, 300)}`)

    // ── drive: the leader chain is synchronous (async:false delegates) ──────
    const replySeen = (content) => (world.mock?.requests ?? []).some((r) => r.reply?.kind === 'text' && String(r.reply.content ?? '').startsWith(content))
    const chainOk = await waitA(() => replySeen(DONE_L1), 480_000)
    log(`leader chain closed (${DONE_L1})=${String(chainOk)}`)
    // Give the last tool result one beat to land in the mock corpus.
    await new Promise((r) => setTimeout(r, 1200))

    // ── evidence collection ────────────────────────────────────────────────
    const requests = world.mock?.requests ?? []
    // One entry per TOOL CALL (deduped by call id) and one per RESULT, so a
    // call repeated in each later request's history is not counted twice.
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
    const outsideCall = readCalls.find((c) => String(c.args?.file_path ?? '').includes(basenameOf(outside))) ?? null
    const insideCalls = readCalls.filter((c) => String(c.args?.file_path ?? '').includes(basenameOf(inside)))
    const resultOf = (callId) => results.find((r) => r.callId === callId) ?? null
    const outsideResult = outsideCall === null ? null : resultOf(outsideCall.callId)
    const insideResults = insideCalls.map((c) => resultOf(c.callId)).filter((r) => r !== null)
    const anyClaimLeak = results.some((r) => r.text.includes(OUTSIDE_CLAIM))
    const insideSuccess = insideResults.find((r) => r.isError !== true && r.text.includes(INSIDE_CLAIM)) ?? null

    const memberRequests = requests.filter((r) => {
      const t = userTextOf(r)
      return t.includes(`${MEMBER_ENVELOPE}${TOK_D1}`) || t.includes(`${MEMBER_ENVELOPE}${TOK_D2}`)
    })
    const surfacePerMemberRequest = memberRequests.map((r) => {
      const names = surfaceNamesOf(r)
      return {
        seq: r.seq,
        token: userTextOf(r).includes(`${MEMBER_ENVELOPE}${TOK_D2}`) ? TOK_D2 : TOK_D1,
        readSchemas: names.filter((n) => n === 'read').length,
        surfaceSize: names.length,
        duplicateNames: names.length !== new Set(names).size,
        surface: names,
        systemPromptReadMentions: JSON.stringify(messagesOf(r).filter((m) => m?.role === 'system').map((m) => m.content ?? '')).split(READ_DESCRIPTION).length - 1,
        systemPromptReadSectionMentions: JSON.stringify(messagesOf(r).filter((m) => m?.role === 'system').map((m) => m.content ?? '')).split(READ_SECTION_TEXT).length - 1,
      }
    })
    const memberReads = readCalls.length
    log(`tool calls (deduped): ${calls.map((c) => c.name).join(',')}`)
    log(`member requests=${String(surfacePerMemberRequest.length)} read calls=${String(memberReads)} outsideCall=${String(outsideCall?.args?.file_path)} insideCalls=${String(insideCalls.length)}`)

    // the sink (the product's own transport, not the model transcript)
    const sinkRows = parseJsonl(sinkPath)
    const sinkExists = existsSync(sinkPath)
    const guardFacts = sinkRows.filter((f) => f?.schema === 'a5sf-guard-consult/1')
    const outsideFacts = guardFacts.filter((f) => String(f.locator ?? '').includes(basenameOf(outside)))
    const insideFacts = guardFacts.filter((f) => String(f.locator ?? '').includes(basenameOf(inside)))
    const denyFacts = guardFacts.filter((f) => f.decision === 'deny')
    const outsideDenyFacts = outsideFacts.filter((f) => f.decision === 'deny' && f.decidedBy === 'IO_READ_DENIED')
    log(`sink=${sinkPath} exists=${String(sinkExists)} rows=${String(sinkRows.length)} guardFacts=${String(guardFacts.length)} outside=${String(outsideFacts.length)} inside=${String(insideFacts.length)} deny=${String(denyFacts.length)}`)
    for (const f of guardFacts) log(`  fact ${JSON.stringify(f).slice(0, 460)}`)

    const consulting = writeConsultCopy(sinkPath)
    evidence.consultations = consulting
    log(`consultations.jsonl ${consulting.copied ? 'copied' : 'ABSENT'} sha256=${String(consulting.sha256)} bytes=${String(consulting.bytes)}`)

    // the base-provider read counter (test instrumentation, disclosed)
    const counterRows = parseJsonl(counterPath)
    const counterInstalled = counterRows.find((r) => r.leg === 'counter-installed') ?? null
    const readRows = counterRows.filter((r) => r.leg === 'read-call')
    const outsideAnyRead = readRows.filter((r) => String(r.path ?? '').includes(basenameOf(outside)))
    const outsideBaseRead = outsideAnyRead.filter((r) => r.isBase === true)
    const insideAnyRead = readRows.filter((r) => String(r.path ?? '').includes(basenameOf(inside)))
    const insideBaseRead = insideAnyRead.filter((r) => r.isBase === true)
    const insideConfinedRead = insideAnyRead.filter((r) => r.isBase !== true)
    log(`counter installed=${JSON.stringify(counterInstalled)} readRows=${String(readRows.length)} outsideAny=${String(outsideAnyRead.length)} outsideBase=${String(outsideBaseRead.length)} insideAny=${String(insideAnyRead.length)} insideBase=${String(insideBaseRead.length)} insideConfined=${String(insideConfinedRead.length)}`)
    for (const r of readRows) log(`  counter ${JSON.stringify(r).slice(0, 300)}`)

    // host log witnesses (the product's own lines, never the transcript)
    const hostLog = (() => { try { return readFileSync(bootInfo.logPath, 'utf8') } catch { return '' } })()
    const hostHits = (pattern) => hostLog.split('\n').filter((l) => l.includes(pattern))
    const witnesses = {
      a5sfLines: hostHits('a5sf').slice(-20).map((l) => redact(l).slice(0, 300)),
      guardLines: hostHits('IO_READ_DENIED').slice(-10).map((l) => redact(l).slice(0, 300)),
      disposeLines: hostHits('realm dispose').slice(-10).map((l) => redact(l).slice(0, 300)),
      probeReadExecutes: (world.u6fsLedgerRows?.() ?? []).filter((r) => r?.leg === 'read-execute').map((r) => ({ path: r.path, agent: r.agent })),
    }
    log(`host log witnesses: a5sf=${String(witnesses.a5sfLines.length)} guard=${String(witnesses.guardLines.length)} dispose=${String(witnesses.disposeLines.length)} probeReadExecutes=${String(witnesses.probeReadExecutes.length)}`)
    for (const p of witnesses.probeReadExecutes) log(`  probe read-execute ${JSON.stringify(p).slice(0, 240)}`)

    // ── teardown probes (point 5): what does the product actually expose? ──
    const stateAfter = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000)
    const membersAfter = Array.isArray(stateAfter.body?.members) ? stateAfter.body.members : []
    const workerMember = membersAfter.find((m) => String(m.templateId) === 'worker') ?? null
    const denyMember = membersAfter.find((m) => String(m.templateId) === 'denyread') ?? null
    const observationsAfter = Array.isArray(stateAfter.body?.observations) ? stateAfter.body.observations : []
    const archiveCalls = calls.filter((c) => c.name === 'team_archive_member')
    const archiveResults = results.filter((r) => r.tool === 'team_archive_member')
    const followupCalls = calls.filter((c) => c.name === 'team_follow_up')
    const followupResults = results.filter((r) => r.tool === 'team_follow_up')
    // The test-only harness tool route: can a READ still be dispatched to the
    // archived member's own child session? (A live-scope seam, not a driver read.)
    let postArchiveRead = null
    if (workerMember !== null && String(workerMember.childSessionId ?? '') !== '') {
      postArchiveRead = await fetchJson(`${origin}/__p6t6/tool`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', cookie },
        body: JSON.stringify({ name: 'read', args: { file_path: inside }, as: String(workerMember.childSessionId), callId: 'a5sf3-post-archive-read' }),
      }, 30_000)
      log(`post-archive read dispatch (as=${String(workerMember.childSessionId)}): status=${String(postArchiveRead.status)} body=${redact(JSON.stringify(postArchiveRead.body ?? null)).slice(0, 300)}`)
    }
    const teardownEvidence = {
      stateStatus: stateAfter.status,
      membersAfter: membersAfter.map((m) => ({ instanceId: m.instanceId, templateId: m.templateId, lifecycle: m.lifecycle, childSessionId: m.childSessionId })),
      workerMember,
      denyMember,
      observations: observationsAfter.slice(-20),
      archiveCalls: archiveCalls.length,
      archiveResults: archiveResults.map((r) => ({ isError: r.isError, head: redact(r.text).slice(0, 500) })),
      followupCalls: followupCalls.length,
      followupResults: followupResults.map((r) => ({ isError: r.isError, head: redact(r.text).slice(0, 500) })),
      postArchiveRead: postArchiveRead === null ? null : { status: postArchiveRead.status, body: postArchiveRead.body },
      disposeLines: witnesses.disposeLines,
      a5sfErrorObservations: observationsAfter.filter((o) => /a5sf/i.test(String(o))),
    }
    evidence.teardown = teardownEvidence
    log(`teardown evidence: members=${JSON.stringify(teardownEvidence.membersAfter)} archive=${JSON.stringify(teardownEvidence.archiveResults)} followup=${JSON.stringify(teardownEvidence.followupResults)}`)

    evidence.requests = {
      total: requests.length,
      surfacePerMemberRequest,
      calls,
      readCalls,
      results: results.map((r) => ({ seq: r.seq, tool: r.tool, isError: r.isError, head: redact(r.text).slice(0, 320) })),
    }
    evidence.guardFacts = guardFacts
    evidence.counter = {
      counterInstalled,
      readRows,
      outsideAnyRead,
      outsideBaseRead,
      insideAnyRead,
      insideBaseRead,
      insideConfinedRead,
    }
    evidence.witnesses = witnesses

    // ── verdicts ───────────────────────────────────────────────────────────
    const memberARequest = surfacePerMemberRequest.find((s) => s.token === TOK_D1) ?? null
    const memberSurfaceOk = memberARequest !== null
      && memberARequest.readSchemas === 1
      && memberARequest.duplicateNames === false
      // "no extra prompt section": the Member did not GAIN a second read
      // section relative to the boot-root discovery prompt.
      && memberARequest.systemPromptReadMentions <= discoveryReadMentions
      && memberARequest.systemPromptReadSectionMentions === discoveryReadSectionMentions
    const wiredOk = bootInfo !== null
      && hostAlive()
      && memberARequest !== null
      && memberSurfaceOk
      && discoveryReadSchemas === 1
      && memberReads >= 2
    add('live:member-activated-surface-one-read', wiredOk ? 'PASS' : 'FAIL', {
      hostAlive: hostAlive(),
      memberRequestSeen: memberARequest !== null,
      memberReadSchemas: memberARequest?.readSchemas ?? null,
      memberSurfaceSize: memberARequest?.surfaceSize ?? null,
      memberSurfaceHasDuplicates: memberARequest?.duplicateNames ?? null,
      memberPromptReadMentions: memberARequest?.systemPromptReadMentions ?? null,
      memberPromptReadSectionMentions: memberARequest?.systemPromptReadSectionMentions ?? null,
      discoveryPromptReadSectionMentions: discoveryReadSectionMentions,
      discoveryReadSchemas,
      discoveryPromptReadMentions: discoveryReadMentions,
      discoveryReadSectionMentions,
      memberReadCalls: memberReads,
      memberSurfaceOk,
      surface,
      memberSurface: memberARequest?.surface ?? null,
      note: 'a managed Member ACTIVATED and ran model turns whose surface carried exactly ONE native `read`, while the row config carried a5sfEvidencePath + a5sfNativeToolModules',
    })

    const outsideText = String(outsideResult?.text ?? '')
    const guardRefusal = /outside every allow subtree of the lane/.test(outsideText)
    const crashText = /TypeError|is not a function|\n\s+at |Cannot read propert/i.test(outsideText)
    const enoentText = /ENOENT|no such file or directory/i.test(outsideText)
    const outsideRefused = outsideResult !== null && outsideResult.isError === true && guardRefusal && !crashText && !enoentText
    add('live:native-read-outside-refused', outsideRefused && !anyClaimLeak ? 'PASS' : 'FAIL', {
      outsideCall: outsideCall ?? null,
      outsideReadSeen: outsideResult !== null,
      isError: outsideResult?.isError ?? null,
      guardRefusalText: guardRefusal,
      crashLikeText: crashText,
      enoentLikeText: enoentText,
      outsideClaimLeaked: anyClaimLeak,
      observed: outsideResult === null ? null : { isError: outsideResult.isError, text: redact(outsideText).slice(0, 700) },
      note: 'the model issued `read` on a path outside the compiled ceiling and the a5sf Guard refused it before any byte was returned (the typed code lands in the sink fact, not the model-facing text)',
    })

    const oneDenyFact = outsideFacts.length === 1 && outsideDenyFacts.length === 1 && denyFacts.length === 1
    add('live:sink-exactly-one-deny-fact', oneDenyFact ? 'PASS' : 'FAIL', {
      sinkExists,
      totalGuardFacts: guardFacts.length,
      outsideFacts: outsideFacts.length,
      denyFacts: denyFacts.length,
      outsideDenyFacts: outsideDenyFacts.length,
      fact: outsideDenyFacts[0] ?? null,
      note: 'the product sink (a5sfEvidencePath), not the model transcript, is the witness: exactly ONE deny fact, decision deny, decidedBy IO_READ_DENIED',
    })

    const insideOk = insideSuccess !== null && insideFacts.some((f) => f.decision === 'allow')
    add('live:native-read-inside-allowed', insideOk ? 'PASS' : 'FAIL', {
      insideCalls: insideCalls.length,
      insideResults: insideResults.map((r) => ({ isError: r.isError, head: redact(r.text).slice(0, 300) })),
      insideClaimReturned: insideSuccess !== null,
      insideAllowFacts: insideFacts.filter((f) => f.decision === 'allow').length,
      insideFacts: insideFacts.map((f) => ({ method: f.method, decision: f.decision, decidedBy: f.decidedBy })),
      note: 'the same native `read` inside the ceiling returned the planted bytes and its consultations were recorded as allow',
    })

    const counterOk = outsideAnyRead.length === 0
      && outsideBaseRead.length === 0
      && insideBaseRead.length === 0
      && insideConfinedRead.length >= 1
      && insideSuccess !== null
    add('live:base-read-counter-did-not-move', counterOk ? 'PASS' : 'FAIL', {
      counterInstalled,
      outsideAnyRead: outsideAnyRead.map((r) => ({ method: r.method, instance: r.instance, isBase: r.isBase, path: r.path })),
      outsideBaseRead: outsideBaseRead.length,
      insideAnyRead: insideAnyRead.map((r) => ({ method: r.method, instance: r.instance, isBase: r.isBase })),
      insideBaseRead: insideBaseRead.length,
      insideConfinedRead: insideConfinedRead.length,
      disclosure: 'the shipped host fs provider has NO read counter of its own; this counter is test-composition instrumentation (in-memory prototype wrap, pass-through) installed by a5sf-native-provider-row.mjs config.counterPath. isBase=true = served by the ROOT/base provider instance; the a5sf confined provider is a different instance.',
      note: 'the refused call never reached ANY provider read method; the inside call reached only the CONFINED provider instance; the base instance served neither',
    })

    // Point 5 — teardown. Is a residual shadow observable through ANY seam?
    const seamsChecked = [
      'team_archive_member (product lifecycle) + the leader\'s model-visible team_follow_up to the archived instance',
      'GET /__p6t6/state: members[].lifecycle + observations[] (incl. "a5sf: realm dispose failed")',
      'POST /__p6t6/tool {name:"read", as:<archived child session>}: only a LIVE agent can be dispatched to',
      'the host instance log: no realm-dispose / shadow lines are emitted',
      'the 15 team tools: no a5sf revoke (team_grant/revoke_permission are the Alpha.4 rule lane)',
    ]
    const archivedLifecycle = workerMember?.lifecycle === 'ARCHIVED' || teardownEvidence.archiveResults.some((r) => r.isError === false && /archiv/i.test(r.head))
    const postArchiveNoLive = postArchiveRead !== null && postArchiveRead.status === 422
    const disposeFault = teardownEvidence.a5sfErrorObservations.length > 0
    add('live:teardown-no-shadow', 'NOT_REACHED', {
      reason: 'NO_OBSERVABLE_SEAM_FOR_A_DISPOSED_AGENT_SCOPE_ON_A_SUBSEQUENT_READ',
      archiveCalls: archiveCalls.length,
      archiveOk: teardownEvidence.archiveResults.some((r) => r.isError === false),
      archivedLifecycle,
      postArchiveReadStatus: postArchiveRead?.status ?? null,
      postArchiveReadNoLiveAgent: postArchiveNoLive,
      followupResult: teardownEvidence.followupResults[0] ?? null,
      workerMember,
      disposeFaultObserved: disposeFault,
      disposeLines: witnesses.disposeLines,
      seamsChecked,
      note: 'The Member was stopped through the product lifecycle and the host stayed alive. But a read AFTER the archive cannot exist on that scope: the agent is GONE (the harness tool route answers NO_LIVE_AGENT), so there is no ctx on which "BASE again" could be observed, and no product seam reports a disposed agent scope or its tool layer. This is NOT evidence that the shadow is gone — it is evidence that the live product exposes no read-after-stop witness. Route-c suite arm N4 proves the dispose contract HOST-FREE only.',
    })

    const createDenyResults = results.filter((r) => r.tool === 'team_create_member')
    const createDenyText = createDenyResults.map((r) => r.text).join('\n')
    const surfaceRefusal = /would CHANGE the Member's model-visible tool surface/.test(createDenyText)
    const unscopedTypeError = /needs a SCOPED agent Context/.test(createDenyText)
    add('live:deny-native-surface-refusal', surfaceRefusal && !unscopedTypeError ? 'PASS' : 'FAIL', {
      createMemberResultsSeen: createDenyResults.length,
      isError: createDenyResults.map((r) => r.isError),
      a5sfSurfaceRefusal: surfaceRefusal,
      unscopedCtxTypeError: unscopedTypeError,
      text: redact(createDenyText).slice(0, 1600),
      denyMemberAfter: denyMember,
      note: surfaceRefusal
        ? "the a5sf attach refused with route C's surface-neutrality law (a builtinToolDeny-hidden native tool would have been re-enabled), and the unscoped-ctx TypeError is GONE"
        : 'the setup failure text is NOT the surface-neutrality refusal — reported verbatim, not upgraded',
    })

    // persist per-run evidence JSONs
    // FIXED AFTER THE 2026-11-03T13:20:42Z BOOT (disclosed in the README): this
    // line read `discoveryPromptReadMentions`, an identifier that was never
    // declared, so the persistence block threw a ReferenceError AFTER every
    // verdict and every captured value had been computed. The boot was NOT
    // re-run (1-boot budget); the identifiers are the ones actually used above.
    writeFileSync(join(HERE, 'transcript.json'), JSON.stringify({
      surface,
      discoveryReadSchemas,
      discoveryReadMentions,
      discoveryReadSectionMentions,
      denyList,
      surfacePerMemberRequest,
      calls,
      readCalls,
      results: evidence.requests.results,
    }, null, 2) + '\n')
    writeFileSync(join(HERE, 'guard-facts.json'), JSON.stringify({ sinkPath, sinkExists, sinkBytes: consulting.bytes, guardFacts, outsideFacts, insideFacts }, null, 2) + '\n')
    writeFileSync(join(HERE, 'host-witnesses.json'), JSON.stringify(witnesses, null, 2) + '\n')
    writeFileSync(join(HERE, 'base-reads.json'), JSON.stringify(evidence.counter, null, 2) + '\n')
    writeFileSync(join(HERE, 'teardown.json'), JSON.stringify(teardownEvidence, null, 2) + '\n')
    record.record.evidence = {
      worldId: world.id,
      outside,
      inside,
      sinkPath,
      sinkSha256: consulting.sha256,
      counterPath,
      hostLogPath: bootInfo.logPath,
      surface,
      denyList,
      guardFacts: guardFacts.length,
      counterReadRows: readRows.length,
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
