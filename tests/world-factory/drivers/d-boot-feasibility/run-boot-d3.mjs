#!/usr/bin/env node
/**
 * tests/world-factory/drivers/d-boot-feasibility/run-boot-d3.mjs — the THIRD
 * D-stage live driver: FOUR remaining D items over the same shipped governed
 * preset, the same product seams and the same boot/teardown discipline as
 * `run-boot.mjs` (round 61) and `run-boot-d2.mjs` (round 62). This file is a
 * COPY of the D2 driver's skeleton with the probes replaced; neither earlier
 * driver is edited.
 *
 * WHAT IT MEASURES (one command, `--boots 2`; the Alpha.6 arm is one extra host
 * START ATTEMPT per boot index, and the crash judge performs ONE real SIGKILL +
 * resume inside each boot):
 *
 *   1. `d3:persistent-subprocess` — a governed Member is asked to run the
 *      product's `bash` tool in turn 1 (a command that would write durable
 *      shell state) and again in turn 2 (a command that reads that state back):
 *      the cross-turn persistence question. The driver measures what the
 *      product ACTUALLY does — which axis the call is admitted on, or the typed
 *      refusal the centre emits — and records the composition fact that decides
 *      the question independently (the shipped governed preset mounts the
 *      ONE-SHOT `@deepseek-ai/dsh-tool-bash` whose own persona says every call
 *      is a fresh confined shell; the host's `tool-bash-persistent` package is
 *      NOT mounted). The verdict is the PRODUCT proposition ("the session
 *      survives across turns"); a refusal is the measured verdict, never a pass.
 *   2. `d3:crash-cold-recovery` — a Member turn is SIGKILLed (the real host
 *      process) while one of its calls is genuinely in flight (an `edit` over a
 *      256 MiB in-lane file, whose body is slow enough to observe; the turn
 *      first runs an IN-LANE `grep` probe over a large corpus, which shape B now
 *      ADMITS and runs — its fact/result are recorded). The host is restarted
 *      against the SAME `DSH_HOME`/state with
 *      `bootPhase: 'create-or-open'` (the product's own restart semantic), and
 *      every durable record is re-read with FRESH readers: completed ledger
 *      facts and settlement survived, the in-flight call reads UNKNOWN (never
 *      `COMPLETED`, never replayed), and a NEW call after recovery is admitted
 *      with a NEW fact.
 *   3. `d3:work-delivery` — async `team_delegate` → `team_collect` through the
 *      real product on a governed Member: admitted delegation, the delivered
 *      unit verbatim, a terminal result that is durable across the cold restart
 *      (a second collect re-reads the identical entry), and the delegated
 *      Member's own calls in ITS ledger (the Leader has no ledger).
 *   4. `d3:alpha6` — the Alpha.6 review-routing configuration attempted on a
 *      live host row (`alpha6ReviewRouting: true` + `centreStatePath`). The
 *      product must be in exactly ONE lawful shape: routed/reachable, or refused
 *      through the typed `ADMISSION_ALPHA6_UNAVAILABLE` path. The measured shape
 *      is the config gate; the closed refusal table supplies code/axis/missing.
 *      Round 68: the gate now records the refusal it decides through the
 *      product's own host-surface point, so this probe additionally reads the
 *      durable fact + settlement back from DISK. The judge is unchanged: a fact
 *      that claims a ROUTE still fails `no-silent-route`; only the probe
 *      distinguishes a recorded refusal from an admitted one.
 *
 * BOOT DISCIPLINE (TEST_METHODS §2/§5/§7): DSH_HOME under the workspace
 * (`tests/homes/u5a5sfdev1-*`), ports from the 3180 family through WorldFactory
 * leases, the pinned host tree read-only (porcelain verified before and after),
 * <= 2 concurrent dev Hosts (`lib/dev-live-slots.mjs`), archive-before-start,
 * teardown by identity, one DEV-LIVE ledger row per start (the crash restart is
 * a SECOND budgeted start through the same harness). The stable instance on
 * :3080 and its DSH_HOME are never touched.
 *
 * EVIDENCE HOME: `dev/agent-workflow/evidence/d-boot-feasibility/d3/` — a NEW
 * subdirectory. Round-61 (`.../runs/`) and round-62 (`.../d2/`) artefacts are
 * never rewritten by this driver.
 *
 * WHAT IS FIXTURE (disclosed): the model is the shared scripted mock
 * (`packages/tools/harness/mock-deepseek.mjs`); the grep corpus, the /proc
 * observation and the mock-request log are test instrumentation. The product
 * path is NOT a fixture: the preset row, the realm provider, the compiler, the
 * centre, the settlement store, the permission plane and the work-delivery
 * chain are the shipped modules the Host loads from `packages/runtime/dist`.
 *
 * CORE PATCH BUDGET = 0.
 *
 * @module tests/world-factory/drivers/d-boot-feasibility/run-boot-d3
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  appendFileSync, closeSync, existsSync, mkdirSync, openSync, readdirSync, readFileSync, renameSync, writeFileSync, writeSync,
} from 'node:fs'
import { createConnection } from 'node:net'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { zstdDecompressSync } from 'node:zlib'

import {
  apiPrompt, authenticate, emitPatchLayer, fetchJson,
} from '../../lib/world-factory.mjs'
import { createRunRecord, formatSummary, readAuthorityBinding } from '../../lib/run-record.mjs'
import { TEST_USE_BASELINE_SHA } from '../../../paths.mjs'
import { createA5sfHarness } from '../../lib/a5sf-harness.mjs'
import { settleDevLiveLease } from '../../lib/dev-live-slots.mjs'
import { preRegisterDevLiveBudget, resolveHeadCommit } from '../../suites/150-a5sf-read.mjs'
import {
  messagesOf, surfaceNamesOf, textOf,
} from '../../lib/u6-fs-assembly.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..')
const EVIDENCE = join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence', 'd-boot-feasibility', 'd3')
const RUNS = join(EVIDENCE, 'runs')
const ARCHIVE = join(EVIDENCE, 'archive')
const LEDGER_PATH = join(EVIDENCE, 'run-ledger.jsonl')
// The FS face's dev-live grant (scope DEV-LIVE, face 'FS Provider', world
// u5a5sfdev1): a scope authorisation, never a candidate claim.
const GRANT_PATH = join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence', 'a5sf-fs-devlive', 'dev-live-grant.json')

// The product's OWN settlement identity derivation — imported, never re-derived.
const { dispatchExecutionId } = await import(pathToFileURL(join(
  REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'settlement', 'dispatch-settlement.js',
)).href)

const LINE = 'u5a5sfdev1'
const BOOT_ROOT = 'session-dboot-d3-root'
const BP_ANCHOR_ID = 'team.dboot.d3.anchor'
const BP_MAIN_ID = 'team.dboot.d3.main'
const PRESET_ID = 'a5sf-governed-member'
const ALPHA6_BP_ID = 'team.dboot.d3.alpha6'
const ALPHA6_ROOT = 'session-dboot-d3-alpha6-root'
const CENTRE_DIR = 'centre'

const MK_DISC = 'DBOOT_D3_DISC'
const MK_L1 = 'DBOOT_D3_L1_DELEGATE_A'
const MK_L2 = 'DBOOT_D3_L2_COLLECT_A'
const MK_L3 = 'DBOOT_D3_L3_FOLLOW_A_BASH2'
const MK_L1B = 'DBOOT_D3_L1B_DELEGATE_B'
const MK_APPROVE = 'DBOOT_D3_APPROVE_ASK'
const MK_L4 = 'DBOOT_D3_L4_COLLECT_A_AFTER_CRASH'
const MK_L5 = 'DBOOT_D3_L5_FOLLOW_A_AFTER_RECOVERY'

const TOK_A = 'dboot-d3-a-work'
const TOK_A2 = 'dboot-d3-a-bash-second-turn'
const TOK_B = 'dboot-d3-b-crash-inflight'
const TOK_A_AFTER = 'dboot-d3-a-after-recovery'
const MEMBER_TOKENS = Object.freeze([TOK_A, TOK_A2, TOK_B, TOK_A_AFTER])

const WORK_A = 'dboot-d3-work-a'
const WORK_B = 'dboot-d3-work-b'
const WORK_A2 = 'dboot-d3-work-a2'
const WORK_A_AFTER = 'dboot-d3-work-a-after'

const CALL_D_A = 'call-d3-delegate-a'
const CALL_D_B = 'call-d3-delegate-b'
const CALL_COLLECT_A = 'call-d3-collect-a'
const CALL_COLLECT_A2 = 'call-d3-collect-a-after'
const CALL_FOLLOW_A2 = 'call-d3-follow-a2'
const CALL_FOLLOW_A_AFTER = 'call-d3-follow-a-after'
const CALL_RESOLVE = 'call-d3-resolve-ask'
const CALL_A_READ = 'call-d3-a-inlane'
const CALL_A_BASH1 = 'call-d3-a-bash-write-state'
const CALL_A_BASH2 = 'call-d3-a-bash-read-state'
const CALL_A_AFTER = 'call-d3-a-after-recovery'
const CALL_B_READ = 'call-d3-b-inlane'
const CALL_B_GREP = 'call-d3-b-grep-probe'
const CALL_B_EDIT = 'call-d3-b-inflight-edit'
const EDIT_NEEDLE = 'DBOOT_D3_EDIT_UNIQUE_NEEDLE_7f3c'
const BIG_EDIT_BYTES = 256 * 1024 * 1024

const DONE_DISC = 'DBOOT_D3_DISC_DONE'
const DONE_L1 = 'DBOOT_D3_L1_DONE'
const DONE_L2 = 'DBOOT_D3_L2_DONE'
const DONE_L3 = 'DBOOT_D3_L3_DONE'
const DONE_L1B = 'DBOOT_D3_L1B_DONE'
const DONE_APPROVE = 'DBOOT_D3_APPROVE_DONE'
const DONE_L4 = 'DBOOT_D3_L4_DONE'
const DONE_L5 = 'DBOOT_D3_L5_DONE'
const DONE_MEMBER_A2 = 'DBOOT_D3_A_SECOND_TURN_DONE'
const DONE_MEMBER_B1 = 'DBOOT_D3_B_FIRST_TURN_DONE'
const DONE_MEMBER_A_AFTER = 'DBOOT_D3_A_AFTER_RECOVERY_DONE'
const UNIT_A = 'DBOOT_D3_DELIVERED_UNIT_ALPHA'
const STATE_BYTES = 'DBOOT_D3_PERSISTENT_SHELL_STATE'
const A_IN_LANE_TEXT = 'DBOOT_D3_A_UNIQUE_BYTES'
const B_IN_LANE_TEXT = 'DBOOT_D3_B_UNIQUE_BYTES'
const A_IN_LANE_FILE = 'in-lane-a.txt'
const B_IN_LANE_FILE = 'in-lane-b.txt'
const STATE_FILE = 'd3-persistent-state.txt'
const CORPUS_DIR = 'corpus'
const BIG_EDIT_FILE = 'big-edit.bin'
const CORPUS_NEEDLE = 'DBOOT_D3_NEVER_MATCH_7f3c1a9e2b5d8046'

const TEAM_TOOL_NAMES = Object.freeze([
  'team_delegate', 'team_collect', 'team_follow_up', 'team_list_members',
  'team_grant_permission', 'team_revoke_permission', 'team_archive_member',
  'team_list_pending_control', 'team_resolve_control',
])
const SELECTED_CASES = Object.freeze(['d3:persistent-subprocess', 'd3:crash-cold-recovery', 'd3:work-delivery', 'd3:alpha6'])
const LEADER_TOOL_ALLOW = Object.freeze(['bash', 'read', 'write', 'edit', 'read_image'])

const argv = process.argv.slice(2)
const PLAN_ONLY = argv.includes('--plan')
const BOOTS_WANTED = (() => {
  const at = argv.indexOf('--boots')
  if (at === -1) return 2
  const n = Number(argv[at + 1])
  return Number.isInteger(n) && n > 0 ? n : 2
})()
const startedAt = new Date().toISOString()

/** `--plan` is HOST-FREE and must never touch the measured record: its own
 *  lines go to `plan.log`, and its patch artefact to `plan/` (a plan run
 *  rewriting the run's `driver.log`/`plan-patch.yml` was measured this round
 *  and is not acceptable evidence hygiene). */
const PLAN_MODE = process.argv.includes('--plan')
function log(line) {
  const text = `[${new Date().toISOString()}] ${line}`
  console.log(text)
  try {
    mkdirSync(EVIDENCE, { recursive: true })
    appendFileSync(join(EVIDENCE, PLAN_MODE ? 'plan.log' : 'driver.log'), `${text}\n`)
  } catch { /* --plan on a fresh clone may not have the evidence dir yet */ }
}

const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
const readJson = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')) } catch { return null } }
const parseJsonl = (p) => {
  try {
    return readFileSync(p, 'utf8').split('\n').filter((l) => l.trim() !== '').map((l) => {
      try { return JSON.parse(l) } catch { return null }
    }).filter((r) => r !== null)
  } catch { return [] }
}
const redact = (t) => String(t ?? '').replace(/\?token=[A-Za-z0-9_-]+/gu, '?token=<redacted>')
const utcStamp = () => new Date().toISOString().replace(/[:.]/gu, '-')
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const HOST_TREE = join(REPO_ROOT, 'tests', 'deepseek-harness-test-use')
const require_ = createRequire(join(REPO_ROOT, 'package.json'))

// ─────────────────────────────────────────────────────────────────────────────
// the shipped composition (the repo's own cordis.patch.yml, !!js evaluated)
// ─────────────────────────────────────────────────────────────────────────────
function shippedLayer() {
  const YAML = require_('yaml')
  const raw = readFileSync(join(REPO_ROOT, 'cordis.patch.yml'), 'utf8')
  const jsSubstitutions = []
  const evaluated = raw.replace(/!!js[ \t]+([^\n]+)/gu, (_m, expr) => {
    const source = expr.trim()
    // The shipped layer's !!js expressions are env/platform predicates. They are
    // evaluated in THIS process (the host's platform); the value is recorded.
    const value = new Function(`"use strict";return (${source})`)()
    jsSubstitutions.push({ expression: source, value })
    return JSON.stringify(value)
  })
  const doc = YAML.parse(evaluated)
  const rows = []
  const visit = (list) => {
    for (const row of list ?? []) {
      if (Array.isArray(row?.insert)) { visit(row.insert); continue }
      rows.push(row)
    }
  }
  visit(doc)
  return { rows, jsSubstitutions }
}

const layer = shippedLayer()
const COMPOSITION_DROPS = []

// ─────────────────────────────────────────────────────────────────────────────
// blueprints (host-free parse through the DIST domain facade)
// ─────────────────────────────────────────────────────────────────────────────
function parseBlueprintText(text) {
  // The dist runtime BUNDLES the domain blueprint facade (the same path the D2
  // driver's plan used); the domain package has no standalone dist here.
  const facade = require_(join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'domain', 'blueprint', 'src', 'index.js'))
  const parse = facade.parseBlueprint
  if (typeof parse !== 'function') throw new Error('the dist runtime bundle exposes no domain parseBlueprint')
  const parsed = parse(text)
  return parsed?.blueprint ?? parsed
}
function anchorBlueprintYaml() {
  const doc = {
    schemaVersion: 3,
    blueprintId: BP_ANCHOR_ID,
    revision: '1',
    leader: { templateId: 'leader', persona: `You lead the dboot d3 anchor team. ${DONE_DISC} is the discovery marker.` },
    members: [{ templateId: 'worker-a', persona: 'You are the anchor worker.' }],
    requirements: [],
    teamEnvelope: { allow: [], deny: [] },
    memberEnvelopes: [],
    policyStates: [],
    permissionMutationEnvelope: { rules: [] },
    teamHardEnvelope: { rules: [] },
    metadata: {},
  }
  return `---\n${JSON.stringify(doc, null, 2)}\n---\n`
}

function lane(allow) {
  return { mode: 'restricted', allow: [...allow], ask: [], deny: [] }
}

/** The v4 design of the TWO-member team this driver measures. */
function v4Doc({ blueprintId, dirs, workers = ['worker-a', 'worker-b'] }) {
  const memberIoCeilings = workers.map((templateId) => ({
    templateId,
    io: {
      read: lane([templateId === 'worker-a' ? dirs.aDir : dirs.bDir]),
      write: lane([templateId === 'worker-a' ? dirs.aDir : dirs.bDir]),
      network: { mode: 'allow' },
    },
  }))
  return {
    schemaVersion: 4,
    blueprintId,
    revision: '1',
    leader: {
      templateId: 'leader',
      persona: `You lead the dboot d3 team. ${MK_L1} delegates worker A; then the driver drives the remaining turns by their markers.`,
      // NO `capabilities` block (the permission-coverage gate only runs for a
      // template that DECLARES capabilities, and a declared set must name every
      // tool on the final surface — measured in round 62).
    },
    members: workers.map((templateId) => ({
      templateId,
      displayName: templateId === 'worker-a' ? 'Governed Worker A' : 'Governed Worker B',
      persona: `You are governed ${templateId}. Read exactly the files your prompt names, one tool call at a time.`,
    })),
    requirements: [],
    teamEnvelope: {
      allow: ['create-member', 'assign-task', 'send-message', 'report-progress', 'request-control', 'archive-member'],
      deny: [],
    },
    memberEnvelopes: workers.map((templateId) => ({
      templateId,
      envelope: { allow: ['send-message', 'report-progress', 'request-control'], deny: [] },
    })),
    policyStates: [{ id: 'default', description: 'Default state.' }],
    permissionMutationEnvelope: { rules: [] },
    teamHardEnvelope: { rules: [] },
    metadata: {},
    memberIoCeilings,
  }
}
function mainBlueprintYaml({ dirs }) {
  return `---\n${JSON.stringify(v4Doc({ blueprintId: BP_MAIN_ID, dirs }), null, 2)}\n---\n`
}
function alpha6BlueprintYaml() {
  const dirs = { aDir: join(EVIDENCE, 'alpha6-plan', 'team-a'), bDir: join(EVIDENCE, 'alpha6-plan', 'team-b') }
  return `---\n${JSON.stringify(v4Doc({ blueprintId: ALPHA6_BP_ID, dirs, workers: ['worker-a'] }), null, 2)}\n---\n`
}
function assertBlueprintText(text, wantId, label) {
  let parsed
  try {
    parsed = parseBlueprintText(text)
  } catch (error) {
    throw new Error(`${label} rejected by the host validator: ${String(error?.message ?? error)}`)
  }
  const schemaVersion = parsed?.schemaVersion ?? null
  const blueprintId = parsed?.blueprintId ?? null
  if (blueprintId !== wantId) throw new Error(`${label}: blueprintId ${JSON.stringify(blueprintId)} != ${JSON.stringify(wantId)}`)
  if (wantId === BP_MAIN_ID && schemaVersion !== 4) throw new Error(`${label}: schemaVersion ${String(schemaVersion)} != 4`)
  log(`blueprint ${label} accepted: schemaVersion=${String(schemaVersion)} id=${String(blueprintId)}`)
  return { ok: true, schemaVersion, via: 'parseBlueprint(dist runtime domain facade)' }
}
/** The CCR probe: does the v4 member ceiling accept a `process` lane? */
function processLaneProbe() {
  const dir = join(EVIDENCE, 'plan-workspace', 'team-a')
  const doc = v4Doc({ blueprintId: 'team.dboot.d3.process-probe', dirs: { aDir: dir, bDir: join(EVIDENCE, 'plan-workspace', 'team-b') }, workers: ['worker-a'] })
  doc.memberIoCeilings[0].io.process = lane([dir])
  const text = `---\n${JSON.stringify(doc, null, 2)}\n---\n`
  try {
    const parsed = parseBlueprintText(text)
    const io = parsed?.memberIoCeilings?.[0]?.io ?? parsed?.templates?.[0]?.memberIoCeilings?.[0]?.io ?? null
    return { accepted: true, parsedProcess: io?.process ?? null, keysOfIo: io === null ? null : Object.keys(io) }
  } catch (error) {
    return {
      accepted: false,
      code: error?.code ?? null,
      error: String(error?.message ?? error).slice(0, 800),
      details: error?.details ?? null,
    }
  }
}

function p6t6Directive({ worldId, logDir, rootSessionId = BOOT_ROOT }) {
  // The p6t6 row's OWN contract (measured): boot 1-4, phase, reportDir,
  // runStamp, rootSessionId. A directive missing `boot` fails the row setup.
  return { boot: 1, phase: 'create', reportDir: logDir, runStamp: worldId, rootSessionId }
}

function composedRows({ home, workspaceDir, mainYaml, alpha6 = false }) {
  const hostRow = layer.rows.find((r) => r?.id === 'dsh-agent-team')
  if (hostRow === undefined) throw new Error('the shipped layer carries no dsh-agent-team/host row')
  const presetRow = layer.rows.find((r) => r?.config?.id === PRESET_ID)
  if (presetRow === undefined) throw new Error(`the shipped composition lost the '${PRESET_ID}' preset row`)

  // DEAD SHIPPED SPECIFIER (measured by round 62, still true at this HEAD): the
  // A1 cut deleted `confined-web-tool.mjs` but the preset still names
  // `dsh-agent-team/web-tool`; a preset row that cannot import makes World
  // creation refuse the WHOLE Agent. The row is dropped HERE, in the driver's
  // composition, and the drop is recorded verbatim. The product file is not
  // touched. `read`/`bash`/`grep` are unaffected.
  const webToolTarget = join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'live', 'confined-web-tool.mjs')
  const presetConfig = JSON.parse(JSON.stringify(presetRow.config))
  if (!existsSync(webToolTarget)) {
    presetConfig.plugins = (presetConfig.plugins ?? []).filter((p) => {
      const dead = p?.name === 'dsh-agent-team/web-tool'
      if (dead) COMPOSITION_DROPS.push({ id: p?.id ?? null, name: p?.name ?? null, reason: 'the cut deleted the module this export targets', target: webToolTarget })
      return dead === false
    })
  }

  const config = {
    ...hostRow.config,
    rootSessionId: alpha6 ? ALPHA6_ROOT : BOOT_ROOT,
    blueprintSource: mainYaml,
    blueprintDir: join(home, 'blueprints'),
    bootPhase: 'create',
    generation: 1,
    seedMembers: [],
    // THE OPT-IN (both keys explicit; a v3 design would refuse at Member
    // attach, never silently grant a default ceiling).
    memberPresetId: PRESET_ID,
    a5sfGovernedRealm: true,
    // THE ONE admission centre: with a compiled realm, installMemberExecution
    // REQUIRES this path and refuses the member rather than run unrecorded.
    centreStatePath: join(home, CENTRE_DIR),
    a5sfEvidencePath: join(home, 'a5sf-consult.jsonl'),
    mcpServers: [],
    mcpServer: null,
    // NO SHADOW: the row carries no native tool modules (the Member's `read`
    // is the preset's own host `@deepseek-ai/dsh-tool-fs` row).
    a5sfNativeToolModules: [],
    // staticModel is INHERITED from the shipped row: the launcher points the
    // shipped provider at the scripted mock through DEEPSEEK_BASE_URL (an
    // override to an unregistered provider id makes the model call fail and no
    // request ever reaches the mock — measured this round).
    ...(alpha6 ? { alpha6ReviewRouting: true } : {}),
  }
  return [
    { id: 'dsh-agent-team', name: pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js')).href, config },
    { id: 'preset-a5sf-governed-member', name: '@deepseek-ai/dsh-agent-preset', config: presetConfig },
    // The p6t6 row reads `p6t6-directive.json` from DSH_HOME and takes NO row
    // config (its directive is the file, measured).
    { id: 'p6t6-team-tools', name: pathToFileURL(join(REPO_ROOT, 'packages', 'tools', 'harness', 'plugin.mjs')).href },
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// mock-model request helpers
// ─────────────────────────────────────────────────────────────────────────────
function memberTokenOf(record) {
  const users = messagesOf(record).filter((m) => m?.role === 'user')
  for (let i = users.length - 1; i >= 0; i -= 1) {
    const text = textOf(users[i])
    if (!text.includes('[team-work ')) continue
    return MEMBER_TOKENS.find((token) => text.includes(token)) ?? null
  }
  return null
}
function isMemberRequest(record) {
  return memberTokenOf(record) !== null
}
function resultIdsOf(record) {
  const ids = new Set()
  for (const message of messagesOf(record)) {
    if (!Array.isArray(message?.content)) continue
    for (const block of message.content) {
      if (block?.type === 'tool_result' && block?.tool_use_id !== undefined) ids.add(String(block.tool_use_id))
    }
  }
  return ids
}
function lastToolResultText(record) {
  const messages = messagesOf(record)
  for (let i = messages.length - 1; i >= 0; i -= 1) {
    const blocks = Array.isArray(messages[i]?.content) ? messages[i].content : []
    const results = blocks.filter((b) => b?.type === 'tool_result')
    if (results.length > 0) {
      return results.map((b) => (Array.isArray(b.content) ? b.content : []).map((c) => c?.text ?? '').join('')).join('\n')
    }
  }
  return ''
}
function toolResultFor(records, callId) {
  for (const record of records) {
    for (const message of messagesOf(record)) {
      if (!Array.isArray(message?.content)) continue
      for (const block of message.content) {
        if (block?.type !== 'tool_result' || String(block?.tool_use_id) !== String(callId)) continue
        const text = Array.isArray(block.content)
          ? block.content.map((c) => c?.text ?? '').join('')
          : typeof block.content === 'string' ? block.content : ''
        return { source: 'model', isError: block.is_error === true, text }
      }
    }
  }
  return undefined
}
function allMessagesText(records) {
  return records.map((r) => messagesOf(r).map(textOf).join('\n')).join('\n')
}

/**
 * The scripted model. The MEMBER branch is selected STRUCTURALLY by the token
 * only our delegated prompt carries. `ids` is filled from the durable state
 * read (never guessed).
 */
function makeDecide({ paths, ids }) {
  const text = (content) => ({ kind: 'text', content })
  const readCall = (id, filePath) => ({ kind: 'tool-call', toolCalls: [{ id, name: 'read', arguments: { file_path: filePath } }] })
  const bashCall = (id, command) => ({ kind: 'tool-call', toolCalls: [{ id, name: 'bash', arguments: { command, description: 'D3 persistent-shell probe' } }] })
  const grepCall = (id, pattern, searchPath) => ({ kind: 'tool-call', toolCalls: [{ id, name: 'grep', arguments: { pattern, path: searchPath } }] })
  const editCall = (id, filePath, oldString, newString) => ({ kind: 'tool-call', toolCalls: [{ id, name: 'edit', arguments: { file_path: filePath, old_string: oldString, new_string: newString } }] })

  return function decide({ req }) {
    const allText = messagesOf(req).map(textOf).join('\n')

    const token = memberTokenOf(req)
    if (token !== null) {
      const seen = resultIdsOf(req)
      if (token === TOK_A) {
        if (!seen.has(CALL_A_READ)) return readCall(CALL_A_READ, paths.aInLane)
        if (!seen.has(CALL_A_BASH1)) {
          return bashCall(CALL_A_BASH1, `printf '%s\\n' '${STATE_BYTES}' > '${paths.stateFile}' && printf 'DBOOT_D3_STATE_WRITTEN\\n'`)
        }
        return text(UNIT_A)
      }
      if (token === TOK_A2) {
        if (!seen.has(CALL_A_BASH2)) {
          return bashCall(CALL_A_BASH2, `cat '${paths.stateFile}' && printf 'DBOOT_D3_STATE_READ\\n'`)
        }
        return text(`${DONE_MEMBER_A2} ${lastToolResultText(req).slice(0, 200)}`)
      }
      if (token === TOK_B) {
        if (!seen.has(CALL_B_READ)) return readCall(CALL_B_READ, paths.bInLane)
        if (!seen.has(CALL_B_GREP)) return grepCall(CALL_B_GREP, CORPUS_NEEDLE, paths.corpus)
        // THE IN-LANE SEARCH PROBE: shape B (CCR search-face, round 64) makes
        // the durable overlay abstain on a face outside its vocabulary
        // (`overlayOutcome: 'no-opinion'`), so the compiled LANE alone judges
        // this `grep` and it is ADMITTED and RUNS. Its fact and tool result are
        // recorded; the flow continues to the in-flight call below either way.
        //
        // THE IN-FLIGHT CALL: a small-argument `edit` over a 256 MiB in-lane
        // file. `grep` is not used as the in-flight record (its corpus scan is
        // the search probe), and `bash` has no process axis at all.
        if (!seen.has(CALL_B_EDIT)) return editCall(CALL_B_EDIT, paths.bigFile, EDIT_NEEDLE, `${EDIT_NEEDLE}_edited`)
        return text(`${DONE_MEMBER_B1} ${lastToolResultText(req).slice(0, 200)}`)
      }
      if (token === TOK_A_AFTER) {
        if (!seen.has(CALL_A_AFTER)) return readCall(CALL_A_AFTER, paths.aInLane)
        return text(`${DONE_MEMBER_A_AFTER} ${lastToolResultText(req).slice(0, 200)}`)
      }
      return text('DBOOT_D3_MEMBER_NOOP')
    }

    // Discovery: the first Leader turn. It must answer its OWN marker (the
    // marker is in the prompt; the reply is the done token the driver waits
    // for), not fall through to the no-op.
    if (allText.includes(MK_DISC) && !allText.includes(MK_L1)) return text(DONE_DISC)

    // The Leader's phase is the LATEST marker present (after a restart the
    // durable root transcript carries every earlier marker).
    const leaderPhase = [MK_L1, MK_L2, MK_L3, MK_L1B, MK_APPROVE, MK_L4, MK_L5]
      .filter((m) => allText.includes(m)).at(-1) ?? null

    if (leaderPhase === MK_L1) {
      const seen = resultIdsOf(req)
      if (!seen.has(CALL_D_A)) {
        return {
          kind: 'tool-call',
          toolCalls: [{
            id: CALL_D_A,
            name: 'team_delegate',
            arguments: {
              rootSessionId: BOOT_ROOT,
              requestToken: WORK_A,
              delegationTemplateId: 'worker-a',
              label: 'dboot-d3-worker-a',
              async: true,
              prompt: [
                `${TOK_A} You are worker-a in a D-stage acceptance run.`,
                'Deliverable: read the in-lane file, then run the requested bash command, then reply with EXACTLY the line',
                UNIT_A,
                'and nothing else. No prose, no quotes, no trailing text.',
              ].join('\n'),
            },
          }],
        }
      }
      return text(DONE_L1)
    }

    if (leaderPhase === MK_L2) {
      const seen = resultIdsOf(req)
      if (!seen.has(CALL_COLLECT_A)) {
        return {
          kind: 'tool-call',
          toolCalls: [{
            id: CALL_COLLECT_A,
            name: 'team_collect',
            arguments: { rootSessionId: BOOT_ROOT, requestToken: 'dboot-d3-collect-a', requestTokens: [WORK_A] },
          }],
        }
      }
      return text(DONE_L2)
    }

    if (leaderPhase === MK_L3) {
      const seen = resultIdsOf(req)
      if (!seen.has(CALL_FOLLOW_A2)) {
        return {
          kind: 'tool-call',
          toolCalls: [{
            id: CALL_FOLLOW_A2,
            name: 'team_follow_up',
            arguments: {
              rootSessionId: BOOT_ROOT,
              requestToken: WORK_A2,
              targetInstanceId: ids.a,
              async: true,
              prompt: [
                `${TOK_A2} Second turn on the same member session.`,
                'Run the requested bash command that reads the state file the first turn wrote, then report done.',
              ].join('\n'),
            },
          }],
        }
      }
      return text(DONE_L3)
    }

    if (leaderPhase === MK_L1B) {
      const seen = resultIdsOf(req)
      if (!seen.has(CALL_D_B)) {
        return {
          kind: 'tool-call',
          toolCalls: [{
            id: CALL_D_B,
            name: 'team_delegate',
            arguments: {
              rootSessionId: BOOT_ROOT,
              requestToken: WORK_B,
              delegationTemplateId: 'worker-b',
              label: 'dboot-d3-worker-b',
              async: true,
              prompt: [
                `${TOK_B} You are worker-b in a D-stage acceptance run.`,
                'First read the in-lane file. Then run the grep over the corpus directory and report the result.',
              ].join('\n'),
            },
          }],
        }
      }
      return text(DONE_L1B)
    }

    if (leaderPhase === MK_APPROVE) {
      const seen = resultIdsOf(req)
      if (!seen.has(CALL_RESOLVE)) {
        return {
          kind: 'tool-call',
          toolCalls: [{
            id: CALL_RESOLVE,
            name: 'team_resolve_control',
            arguments: {
              rootSessionId: BOOT_ROOT,
              requestToken: 'dboot-d3-resolve-ask',
              requestId: ids.pendingRequestId ?? 'dboot-d3-no-pending',
              decision: 'allow',
              note: 'D3 crash-in-flight probe',
            },
          }],
        }
      }
      return text(DONE_APPROVE)
    }

    if (leaderPhase === MK_L4) {
      const seen = resultIdsOf(req)
      if (!seen.has(CALL_COLLECT_A2)) {
        return {
          kind: 'tool-call',
          toolCalls: [{
            id: CALL_COLLECT_A2,
            name: 'team_collect',
            arguments: { rootSessionId: BOOT_ROOT, requestToken: 'dboot-d3-collect-a-after', requestTokens: [WORK_A] },
          }],
        }
      }
      return text(DONE_L4)
    }

    if (leaderPhase === MK_L5) {
      const seen = resultIdsOf(req)
      if (!seen.has(CALL_FOLLOW_A_AFTER)) {
        return {
          kind: 'tool-call',
          toolCalls: [{
            id: CALL_FOLLOW_A_AFTER,
            name: 'team_follow_up',
            arguments: {
              rootSessionId: BOOT_ROOT,
              requestToken: WORK_A_AFTER,
              targetInstanceId: ids.a,
              async: true,
              prompt: [
                `${TOK_A_AFTER} Post-recovery turn on the same member session.`,
                'Read the in-lane file again and report done.',
              ].join('\n'),
            },
          }],
        }
      }
      return text(DONE_L5)
    }

    return text('DBOOT_D3_NOOP')
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// FRESH durable readers (files only, no live process state)
// ─────────────────────────────────────────────────────────────────────────────
function decompressZstdStream(buf) {
  const MAGIC = Buffer.from([0x28, 0xb5, 0x2f, 0xfd])
  const starts = []
  let off = 0
  for (;;) {
    const i = buf.indexOf(MAGIC, off)
    if (i === -1) break
    starts.push(i)
    off = i + 4
  }
  if (starts.length === 0) throw new Error('no zstd frame in stream')
  const bounds = [...starts, buf.length]
  const parts = []
  let pending
  for (let k = 0; k < bounds.length - 1; k += 1) {
    const chunk = buf.subarray(bounds[k], bounds[k + 1])
    const candidate = pending === undefined ? chunk : Buffer.concat([pending, chunk])
    try { parts.push(zstdDecompressSync(candidate)); pending = undefined } catch { pending = candidate }
  }
  if (pending !== undefined) {
    try { parts.push(zstdDecompressSync(pending)) } catch { /* partial tail frame while the host flushes */ }
  }
  return Buffer.concat(parts)
}
function parseFirstJsonLine(buf) {
  try {
    const first = zstdDecompressSync(buf).toString('utf8').split('\n').find((l) => l !== '')
    if (first === undefined) return null
    return JSON.parse(first)
  } catch { return null }
}
function walkFiles(root, out = []) {
  let entries = []
  try { entries = readdirSync(root, { withFileTypes: true }) } catch { return out }
  for (const entry of entries) {
    const path = join(root, entry.name)
    if (entry.isDirectory()) walkFiles(path, out)
    else if (entry.isFile()) out.push({ name: entry.name, path })
  }
  return out
}
function findSessionFile(dshHome, sessionId) {
  if (!existsSync(dshHome)) return null
  for (const entry of walkFiles(dshHome)) {
    if (!/^session(\..+)?\.jsonl\.zstd$/u.test(entry.name)) continue
    let buf
    try { buf = readFileSync(entry.path) } catch { continue }
    const header = parseFirstJsonLine(buf)
    if (header !== null && header.id === sessionId) return { file: entry.path, header, buffer: buf }
  }
  return null
}
function contentText(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map((c) => (typeof c === 'string' ? c : String(c?.text ?? ''))).join('')
  return JSON.stringify(content ?? '')
}
/** Normalise the durable session log into the Member-visible turn. */
function readMemberTranscript(dshHome, sessionId) {
  const found = findSessionFile(dshHome, sessionId)
  if (found === null) return null
  let lines = []
  try {
    lines = decompressZstdStream(found.buffer).toString('utf8').split('\n').filter((l) => l !== '')
      .map((l) => { try { return JSON.parse(l) } catch { return { unparsed: l.slice(0, 200) } } })
  } catch { return null }
  const calls = []
  const results = []
  const assistant = []
  const user = []
  for (const row of lines) {
    const data = row?.data ?? row
    const type = row?.type ?? row?.kind ?? null
    if (type === 'user/message') {
      const m = data?.message ?? data
      user.push(contentText(m?.content))
    }
    if (type === 'assistant/message') {
      const m = data?.message ?? data
      const t = contentText(m?.content)
      if (t.trim() !== '') assistant.push(t)
    }
    if (type === 'tool/call') {
      const name = data?.name ?? data?.message?.name ?? null
      const callId = data?.callId ?? data?.id ?? data?.message?.source?.callId ?? null
      const args = data?.arguments ?? data?.input ?? data?.message?.arguments ?? null
      calls.push({ callId, name, arguments: typeof args === 'string' ? args : JSON.stringify(args), at: row?.at ?? row?.time ?? null })
    }
    if (type === 'tool/result') {
      const src = data?.message?.source ?? data?.source ?? {}
      const callId = src.callId ?? data?.callId ?? null
      const body = data?.message?.content ?? data?.content ?? data?.result ?? ''
      const isError = data?.isError === true || data?.message?.isError === true || data?.message?.error !== undefined
      results.push({ callId, isError, text: contentText(body), at: row?.at ?? row?.time ?? null })
    }
  }
  const paired = calls.map((call) => {
    const result = results.find((r) => String(r.callId) === String(call.callId)) ?? null
    let args = null
    try { args = JSON.parse(call.arguments) } catch { args = null }
    return { callId: call.callId, name: call.name, arguments: args, result }
  })
  return {
    sessionId, file: found.file, header: found.header, lineCount: lines.length,
    user, calls: paired, assistant, finalAssistant: assistant.at(-1) ?? null,
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// the centre's durable records (FRESH readers)
// ─────────────────────────────────────────────────────────────────────────────
function centreDirOf(home) { return join(home, CENTRE_DIR) }
function ledgerPathOf(home, instanceId) { return join(centreDirOf(home), `${instanceId}.facts.jsonl`) }
function readLedger(home, instanceId) { return parseJsonl(ledgerPathOf(home, instanceId)) }
function factsFor(ledger, callId, kind = null) {
  return ledger.filter((r) => String(r?.callId ?? '') === String(callId) && (kind === null || r?.kind === kind))
}
function settlementOf(home, instanceId, callId) {
  const executionId = dispatchExecutionId({ rootSessionId: BOOT_ROOT, agentInstanceId: String(instanceId) }, callId)
  const file = join(centreDirOf(home), 'settlement', String(instanceId), `${executionId}.settlement.json`)
  let envelope = null
  try { envelope = JSON.parse(readFileSync(file, 'utf8')) } catch { envelope = null }
  const record = envelope === null ? null : (envelope.payload ?? envelope)
  return {
    executionId, file, present: record !== null,
    state: record?.state ?? null,
    dispatch: record?.observation?.dispatch ?? null,
    bodyOutcome: record?.observation?.bodyOutcome ?? null,
    stops: record?.stops ?? [],
    transitions: Array.isArray(record?.transitions) ? record.transitions.map((t) => t?.to ?? t) : [],
  }
}
function allCentreLedgerFiles(home) {
  let names = []
  try { names = readdirSync(centreDirOf(home)) } catch { return [] }
  return names.filter((n) => n.endsWith('.facts.jsonl'))
    .map((n) => ({ name: n, path: join(centreDirOf(home), n), rows: parseJsonl(join(centreDirOf(home), n)) }))
}
/** Fresh disk scan: which files under the home carry this literal? */
function diskFilesContaining(home, needle) {
  const hits = []
  const bufNeedle = Buffer.from(needle, 'utf8')
  for (const entry of walkFiles(home)) {
    let buf
    try {
      if (statSize(entry.path) > 64 * 1024 * 1024) continue
      buf = readFileSync(entry.path)
    } catch { continue }
    if (buf.includes(bufNeedle)) hits.push({ path: entry.path, bytes: buf.length })
  }
  return hits
}
function statSize(p) {
  try { return readFileSync(p).length } catch { return 0 }
}

// ─────────────────────────────────────────────────────────────────────────────
// judges
// ─────────────────────────────────────────────────────────────────────────────
function verdictOf(proposition, clauses) {
  const failing = clauses.filter((c) => c.ok !== true)
  return { proposition, verdict: failing.length === 0 ? 'PROVEN' : 'REFUTED', clauses, failing: failing.map((c) => c.id) }
}
const toRunVerdict = (verdict) => (verdict === 'PROVEN' ? 'PASS' : 'FAIL')

function judgePersistent({ bash1, bash2, ledger, settle1, settle2, paths, presetPlugins, memberSurface }) {
  const stateExists = existsSync(paths.stateFile)
  const b1 = bash1?.result ?? null
  const b2 = bash2?.result ?? null
  const b1Text = String(b1?.text ?? '')
  const b2Text = String(b2?.text ?? '')
  const fact1 = factsFor(ledger, CALL_A_BASH1)[0] ?? null
  const fact2 = factsFor(ledger, CALL_A_BASH2)[0] ?? null
  const persistentMounted = presetPlugins.includes('tool-bash-persistent')
  return verdictOf(
    'a governed Member runs the product\'s subprocess tool as a PERSISTENT session: the first call is admitted, its shell state is durable, and a SECOND turn reuses the same shell and sees that state',
    [
      { id: 'bash-on-member-surface', ok: memberSurface.includes('bash'), detail: `member surface=${JSON.stringify(memberSurface)}` },
      { id: 'persistent-tool-mounted', ok: persistentMounted, detail: `preset mounts tool-bash-persistent=${String(persistentMounted)}; mounted shell rows=${JSON.stringify(presetPlugins.filter((p) => p.startsWith('tool-bash')))}` },
      { id: 'first-call-admitted', ok: b1 !== null && b1?.isError === false, detail: `isError=${String(b1?.isError)} text=${b1Text.slice(0, 400)}` },
      { id: 'state-written-by-shell', ok: stateExists, detail: `state file ${paths.stateFile} exists=${String(stateExists)}` },
      { id: 'second-turn-saw-state', ok: b2 !== null && b2?.isError === false && b2Text.includes(STATE_BYTES), detail: `isError=${String(b2?.isError)} sawState=${String(b2Text.includes(STATE_BYTES))} text=${b2Text.slice(0, 400)}` },
      { id: 'first-call-centre-fact', ok: fact1 !== null && fact1?.decision === 'allow', detail: `fact=${JSON.stringify(fact1 === null ? null : { axis: fact1.axis, decision: fact1.decision, refusalCode: fact1.refusalCode ?? null })}` },
      { id: 'second-call-centre-fact', ok: fact2 !== null && fact2?.decision === 'allow', detail: `fact=${JSON.stringify(fact2 === null ? null : { axis: fact2.axis, decision: fact2.decision, refusalCode: fact2.refusalCode ?? null })}` },
      { id: 'first-call-settled-completed', ok: settle1?.state === 'COMPLETED', detail: `settlement state=${String(settle1?.state)} transitions=${JSON.stringify(settle1?.transitions ?? [])}` },
      { id: 'second-call-settled-completed', ok: settle2?.state === 'COMPLETED', detail: `settlement state=${String(settle2?.state)} transitions=${JSON.stringify(settle2?.transitions ?? [])}` },
    ],
  )
}

function judgeCrash({ before, after, restart, home }) {
  const bKill = before?.bOpen ?? null
  const bAfter = after?.bOpen ?? null
  const aBefore = before?.aRead ?? null
  const aAfter = after?.aRead ?? null
  const aFactsBefore = before?.aReadFacts ?? []
  const aFactsAfter = after?.aReadFacts ?? []
  const bOpenAdmissionsAfter = after?.bOpenAdmissions ?? []
  const bExecutionsAfter = after?.bOpenExecutions ?? []
  const newFacts = after?.aNewFacts ?? []
  return verdictOf(
    'after a REAL SIGKILL of the host, the ledger and settlement survive a cold restart on the SAME DSH_HOME; a call in flight at the crash reads UNKNOWN (never silently COMPLETED and never replayed); a NEW call after recovery is admitted with a NEW fact',
    [
      { id: 'kill-was-sigkill', ok: restart?.killedPid !== null && restart?.pidGone === true && restart?.signal === 'SIGKILL', detail: `pid=${String(restart?.killedPid)} signal=${String(restart?.signal)} pidGone=${String(restart?.pidGone)} exit=${JSON.stringify(restart?.exit ?? null)}` },
      { id: 'restart-same-home', ok: restart?.firstHome === home && restart?.booted === true && restart?.bootPhase === 'create-or-open', detail: `firstHome=${String(restart?.firstHome)} restartHome=${String(home)} booted=${String(restart?.booted)} bootPhase=${String(restart?.bootPhase)}` },
      { id: 'completed-ledger-survives', ok: aFactsBefore.length > 0 && aFactsAfter.length >= aFactsBefore.length && aFactsAfter.every((f, i) => JSON.stringify(f) === JSON.stringify(aFactsBefore[i])), detail: `factsBefore=${aFactsBefore.length} factsAfter=${aFactsAfter.length}` },
      { id: 'completed-settlement-survives', ok: aBefore?.state === 'COMPLETED' && aAfter?.state === 'COMPLETED', detail: `before=${String(aBefore?.state)} after=${String(aAfter?.state)} transitions=${JSON.stringify(aAfter?.transitions ?? [])}` },
      { id: 'inflight-was-open-at-crash', ok: bKill?.state === 'ADMITTED' || bKill?.state === 'RUNNING', detail: `in-flight settlement state at SIGKILL=${String(bKill?.state)} transitions=${JSON.stringify(bKill?.transitions ?? [])}` },
      { id: 'inflight-unknown-after-recovery', ok: bAfter?.state === 'UNKNOWN', detail: `after restart=${String(bAfter?.state)} transitions=${JSON.stringify(bAfter?.transitions ?? [])}` },
      { id: 'never-completed', ok: bAfter?.state !== 'COMPLETED' && !bExecutionsAfter.some((f) => f?.outcome === 'completed'), detail: `state=${String(bAfter?.state)} execution facts=${JSON.stringify(bExecutionsAfter.map((f) => f?.outcome))}` },
      { id: 'never-replayed', ok: bOpenAdmissionsAfter.length === 1 && (before?.bOpenAdmissions ?? []).length === 1 && bAfter?.state !== 'RUNNING', detail: `admission facts before=${(before?.bOpenAdmissions ?? []).length} after=${bOpenAdmissionsAfter.length}` },
      { id: 'new-call-new-fact', ok: newFacts.length === 1 && String(newFacts[0]?.callId) === CALL_A_AFTER && newFacts[0]?.decision === 'allow', detail: `new facts=${JSON.stringify(newFacts.map((f) => ({ callId: f?.callId, decision: f?.decision, axis: f?.axis })))}` },
      { id: 'new-call-settled-completed', ok: after?.aNewSettle?.state === 'COMPLETED', detail: `new call settlement=${String(after?.aNewSettle?.state)} transitions=${JSON.stringify(after?.aNewSettle?.transitions ?? [])}` },
      { id: 'work-fact-survived', ok: (after?.workDiskHits ?? []).length > 0, detail: `fresh disk hits carrying the delivered unit=${JSON.stringify((after?.workDiskHits ?? []).map((h) => h.path))}` },
      { id: 'state-file-never-written', ok: !existsSync(after?.stateFile ?? '/nonexistent'), detail: `the persistent-shell probe never ran a shell: ${String(after?.stateFile)} exists=${String(existsSync(after?.stateFile ?? '/nonexistent'))}` },
    ],
  )
}

function judgeWork({ a, collect1, collect2, otherLedgers, workDiskHits, memberSurface, unitText }) {
  const e1 = collect1?.entry ?? null
  const e2 = collect2?.entry ?? null
  const readFacts = factsFor(a?.ledger ?? [], CALL_A_READ, 'invocation-authority')
  // THE PROPOSITION: the Member's OWN calls land in ITS ledger, never the
  // Leader's. A leader-level HOST-SURFACE refusal fact (a different subject:
  // the remote plane) is not a member call and is recorded, never counted as
  // a violation.
  const memberCallIds = new Set((a?.ledger ?? []).filter((r) => r?.kind === 'invocation-authority').map((r) => String(r?.callId)))
  const stray = (otherLedgers ?? []).flatMap((f) => (f.rows ?? [])
    .filter((r) => r?.kind === 'invocation-authority' && memberCallIds.has(String(r?.callId)))
    .map((r) => ({ file: f.name, callId: r.callId, axis: r.axis ?? null })))
  const promptSeen = String(a?.user0 ?? '')
  const delegation = a?.delegateResult ?? null
  return verdictOf(
    'work delivery through the real product: the async delegation is admitted, the delivered unit arrives VERBATIM, the collected result is terminal and durable across a cold restart, and the delegated Member\'s own calls land in ITS ledger',
    [
      { id: 'delegation-admitted', ok: delegation !== null && /"workStatus"\s*:\s*"admitted"/u.test(String(delegation?.text ?? '')), detail: `delegate result=${String(delegation?.text ?? '').slice(0, 700)}` },
      { id: 'member-created', ok: typeof a?.instance === 'string' && a.instance.length > 0 && typeof a?.childSessionId === 'string' && a.childSessionId.length > 0, detail: `instance=${String(a?.instance)} childSession=${String(a?.childSessionId)}` },
      { id: 'prompt-delivered-verbatim', ok: promptSeen.includes(TOK_A) && promptSeen.includes(UNIT_A), detail: `first member user message=${String(promptSeen.slice(0, 700))}` },
      { id: 'member-unit-verbatim', ok: String(unitText ?? '').trim() === UNIT_A, detail: `member turn-1 final text=${JSON.stringify(String(unitText ?? '').slice(0, 300))}` },
      { id: 'collect-succeeded', ok: e1?.status === 'succeeded', detail: `collect entry=${JSON.stringify(e1).slice(0, 900)}` },
      { id: 'collect-body-verbatim', ok: e1?.memberResult?.body === UNIT_A, detail: `memberResult.body=${JSON.stringify(String(e1?.memberResult?.body ?? ''))}` },
      { id: 'collect-terminal-and-durable', ok: e2 !== null && e1 !== null && JSON.stringify(e2) === JSON.stringify(e1), detail: `before=${JSON.stringify(e1).slice(0, 600)} after=${JSON.stringify(e2).slice(0, 600)}` },
      { id: 'work-fact-durable-on-disk', ok: (workDiskHits ?? []).length > 0, detail: `fresh disk hits carrying the unit=${JSON.stringify((workDiskHits ?? []).map((h) => h.path))}` },
      { id: 'member-calls-in-own-ledger', ok: readFacts.length >= 1 && readFacts.every((f) => String(f?.instanceId ?? f?.agentId ?? '') === String(a?.instance) || String(f?.sessionId ?? '') === String(a?.childSessionId)), detail: `A ledger fs.read admission facts=${readFacts.length} instances=${JSON.stringify([...new Set(readFacts.map((f) => f?.instanceId ?? null))])}` },
      { id: 'member-calls-not-in-leader-ledger', ok: stray.length === 0 && memberCallIds.size > 0, detail: `member callIds=${memberCallIds.size} stray member call facts in other ledgers=${JSON.stringify(stray)}; other ledger files=${JSON.stringify((otherLedgers ?? []).map((f) => f.name))}` },
      { id: 'member-surface-measured', ok: (memberSurface ?? []).length > 0, detail: `member surface tools=${JSON.stringify((memberSurface ?? []).slice(0, 40))}` },
    ],
  )
}

function judgeAlpha6({ arm, refusalTable, configGate }) {
  const text = String(arm?.error ?? '')
  return verdictOf(
    'the Alpha.6 review-routing configuration on a live host is in exactly ONE lawful shape: reachable and routed, or refused with the typed ADMISSION_ALPHA6_UNAVAILABLE path — never silently accepted and never a generic failure',
    [
      { id: 'host-process-was-spawned', ok: arm?.spawned === true, detail: `spawned=${String(arm?.spawned)} port=${String(arm?.port)} log=${String(arm?.logPath)}` },
      // MEASURED SHAPE: the config gate is a ROW gate. The row bootstrap throws
      // (the typed error is in the host log) while the host process itself
      // still boots — a host with no team row is not a routed host, and the
      // refusal is not a generic crash. The judge requires the typed row
      // refusal AND that nothing live claims the Alpha.6 route.
      { id: 'row-refused-with-typed-code', ok: arm?.rowRefused === true, detail: `rowRefused=${String(arm?.rowRefused)} threw=${String(arm?.threw)} reachable=${String(arm?.reachable)}` },
      { id: 'typed-code-present', ok: text.includes('ADMISSION_ALPHA6_UNAVAILABLE'), detail: `refusal text=${text.slice(0, 1200)}` },
      { id: 'missing-axis-named', ok: text.includes('no review-routing axis'), detail: `names the missing axis=${String(text.includes('no review-routing axis'))}` },
      { id: 'config-gate-is-product-rule', ok: typeof configGate === 'string' && configGate.includes('ADMISSION_ALPHA6_UNAVAILABLE') && configGate.includes('no review-routing axis'), detail: `centreConfigViolation=${String(configGate).slice(0, 600)}` },
      { id: 'closed-refusal-table-entry', ok: refusalTable?.code === 'ADMISSION_ALPHA6_UNAVAILABLE' && refusalTable?.axis === 'host.service' && String(refusalTable?.missing ?? '').includes('no review-routing axis'), detail: `HOST_SURFACE_REFUSALS.alpha6=${JSON.stringify(refusalTable).slice(0, 700)}` },
      { id: 'no-team-row-live', ok: arm?.teamRowLive === false && arm?.liveMemberCount === 0, detail: `teamSession present=${String(arm?.teamRowLive)} liveMembers=${String(arm?.liveMemberCount)} stateHttp=${String(arm?.liveStateHttp)} stateError=${String(arm?.liveStateError)}` },
      // ROUND 68: the CONDITION is unchanged; the probe now evaluates it as "a fact that claims a
      // route (or is not this row's typed denial)" instead of "any fact file exists", because the
      // refusal itself is now correctly durable. A recorded refusal is not a silent route.
      { id: 'no-silent-route', ok: arm?.liveAlpha6Decision === null && arm?.recordedFactPresent === false && arm?.wakeIntentFiles === 0, detail: `alpha6 decision in live state=${JSON.stringify(arm?.liveAlpha6Decision)} non-refusal fact present=${String(arm?.recordedFactPresent)} wake-intent files=${String(arm?.wakeIntentFiles)}` },
    ],
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// plan (host-free)
// ─────────────────────────────────────────────────────────────────────────────
function planOnly() {
  log(`PLAN repo=${REPO_ROOT} hostTree=${HOST_TREE} pin=${TEST_USE_BASELINE_SHA}`)
  log(`shipped !!js substitutions: ${JSON.stringify(layer.jsSubstitutions)}`)
  const planRoot = join(EVIDENCE, 'plan-workspace')
  const aDir = join(planRoot, 'team-a')
  const bDir = join(planRoot, 'team-b')
  // The corpus lives INSIDE B's own declared lane: the in-flight grep must be
  // an ADMITTED call, and a path outside the member's compiled ceiling is
  // refused at admission (measured this round: an out-of-lane grep is
  // REFUSED, which cannot be the in-flight-at-crash record).
  const dirs = { aDir, bDir, corpus: join(bDir, CORPUS_DIR), aInLane: join(aDir, A_IN_LANE_FILE), bInLane: join(bDir, B_IN_LANE_FILE), stateFile: join(aDir, STATE_FILE) }
  const a = assertBlueprintText(anchorBlueprintYaml(), BP_ANCHOR_ID, 'anchor.yaml')
  const m = assertBlueprintText(mainBlueprintYaml({ dirs }), BP_MAIN_ID, 'main.yaml')
  log(`blueprints accepted: anchor=${JSON.stringify(a)} main=${JSON.stringify(m)}`)
  const probe = processLaneProbe()
  log(`CCR probe (v4 member ceiling with io.process): ${JSON.stringify(probe)}`)
  const rows = composedRows({ home: join(EVIDENCE, 'plan-home'), workspaceDir: planRoot, mainYaml: mainBlueprintYaml({ dirs }) })
  mkdirSync(join(EVIDENCE, 'plan'), { recursive: true })
  writeFileSync(join(EVIDENCE, 'plan', 'plan-patch.yml'), `${emitPatchLayer(['dboot-d3 plan (no World)'], rows)}\n`)
  log(`rows: ${JSON.stringify(rows.map((r) => ({ id: r.id, name: String(r.name).slice(0, 90) })))}`)
  const preset = layer.rows.find((r) => r?.config?.id === PRESET_ID)
  const plugins = (preset?.config?.plugins ?? []).map((p) => p.id)
  log(`governed preset plugins (${String(plugins.length)}): ${plugins.join(',')}`)
  for (const required of ['tool-bash', 'tool-fs', 'tool-fs-search']) {
    if (!plugins.includes(required)) throw new Error(`the shipped governed preset lost '${required}'`)
  }
  if (plugins.includes('tool-bash-persistent')) throw new Error('the shipped governed preset unexpectedly mounts tool-bash-persistent')
  const persistentPackage = existsSync(join(HOST_TREE, 'packages', 'shell', 'tool-bash-persistent', 'package.json'))
  log(`host persistent-bash package present=${String(persistentPackage)} mounted=${String(plugins.includes('tool-bash-persistent'))}`)
  log('PLAN OK')
}

// ─────────────────────────────────────────────────────────────────────────────
// porta / health helpers
// ─────────────────────────────────────────────────────────────────────────────
function portRefuses(port) {
  return new Promise((resolvePort) => {
    const socket = createConnection({ host: '127.0.0.1', port })
    let done = false
    const finish = (free) => {
      if (done) return
      done = true
      try { socket.destroy() } catch { /* already closed */ }
      resolvePort(free)
    }
    socket.setTimeout(1500, () => finish(false))
    socket.once('connect', () => finish(false))
    socket.once('error', () => finish(true))
  })
}
async function waitPortFree(port, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  for (;;) {
    if (await portRefuses(port)) return true
    if (Date.now() >= deadline) return false
    await sleep(100)
  }
}
async function waitHealthy(origin, cookie, timeoutMs) {
  const deadline = Date.now() + timeoutMs
  let last = null
  for (;;) {
    try {
      const res = await fetchJson(`${origin}/__p6t6/health`, { headers: { cookie } }, 5000)
      last = res?.body ?? null
      if (res?.status === 200 && last?.ok === true) return { ok: true, body: last }
      if (res?.status === 200 && last?.ok === false && last?.setupError !== undefined) return { ok: false, body: last }
    } catch { /* still starting */ }
    if (Date.now() >= deadline) return { ok: false, body: last, timeout: true }
    await sleep(250)
  }
}
async function readState(origin, cookie) {
  const res = await fetchJson(`${origin}/__p6t6/state`, { headers: { cookie } }, 20000)
  return res?.body ?? null
}
function membersOf(state) {
  const list = state?.members ?? []
  return Array.isArray(list) ? list : []
}
function pendingAskOf(state, instanceId) {
  const raw = state?.control?.requests ?? []
  const list = Array.isArray(raw) ? raw : Object.values(raw)
  return list.find((r) => String(r?.targetInstanceId ?? '') === String(instanceId) && String(r?.status ?? 'pending') === 'pending') ?? null
}
function collectEntryOf(result, token) {
  let parsed = null
  try { parsed = JSON.parse(String(result?.text ?? '')) } catch { parsed = null }
  const entries = parsed?.effect?.entries ?? parsed?.effect?.workStatus ?? []
  const list = Array.isArray(entries) ? entries : []
  return list.find((e) => String(e?.requestToken ?? '') === String(token)) ?? null
}

function hostPorcelain() {
  try {
    return execFileSync('git', ['-C', HOST_TREE, 'status', '--porcelain'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
  } catch { return ['git status failed'] }
}
function hostDigest() {
  try { return execFileSync('git', ['-C', HOST_TREE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() } catch { return null }
}

// ─────────────────────────────────────────────────────────────────────────────
// one boot
// ─────────────────────────────────────────────────────────────────────────────
async function bootOnce({ index, head, grant }) {
  const bootDir = join(RUNS, `boot${String(index).padStart(2, '0')}`)
  mkdirSync(bootDir, { recursive: true })
  const phase = `a5sf-live-d3-boot${String(index)}`
  const runId = `a5sf-live-d3-${utcStamp()}-b${String(index)}`
  const record = createRunRecord({
    runId, suite: 'a5sf-live-d3', selectedCases: SELECTED_CASES,
    bindings: runBindings(head, grant), ledgerPath: LEDGER_PATH, recordClass: 'DEV-LIVE',
  })
  const harness = createA5sfHarness({
    repoRoot: REPO_ROOT, evidenceRoot: join(EVIDENCE, 'driver'), suite: 'a5sf-live-d3', line: LINE,
    runRecord: record, hostTree: HOST_TREE,
  })
  const factory = harness.factory
  log(`[boot${String(index)}] candidate: ${JSON.stringify(harness.assertCandidate())}`)
  const lease = await preRegisterDevLiveBudget({
    grantPath: GRANT_PATH, headCommit: head, runRecord: record,
    face: 'FS Provider', world: LINE, leaseRoot: factory.leaseRoot, requiredBoots: 2,
  })
  log(`[boot${String(index)}] dev-live lease grant=${lease.grant.grantId} world=${LINE} head=${head}`)

  let world = null
  let alpha6World = null
  let bootInfo = null
  let restartInfo = null
  let teardown = null
  let failure = null
  let abortStage = 'pre-boot'
  let paths = null
  let alpha6Arm = null
  let crash = null
  let before = null
  let after = null
  let rowA = null
  let rowB = null
  let collect1 = null
  let collect2 = null
  let txA1 = null
  let txAAll = null
  let txB = null
  let leaderSurface = []
  let memberSurface = []
  const ids = { a: null, b: null, pendingRequestId: null }
  const counters = {}
  let result = null
  const bootStartedAt = Date.now()

  try {
    bootInfo = await lease.boot(async () => {
      const { centreConfigViolation } = await import(pathToFileURL(join(
        REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'vnext', 'centre-config.js',
      )).href)
      const { HOST_SURFACE_REFUSALS } = await import(pathToFileURL(join(
        REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'vnext', 'host-surface-refusal.mjs',
      )).href)
      const configGate = centreConfigViolation({ alpha6ReviewRouting: true, centreStatePath: join(EVIDENCE, 'alpha6-centre') })
      log(`[boot${String(index)}] alpha6 config gate: ${String(configGate).slice(0, 300)}`)

      // ── d3:alpha6 — ONE real host START with the Alpha.6 opt-in, inside the
      //    SAME dev-live lease. A separate World because the row must refuse to
      //    boot at all. ──
      alpha6World = await harness.createWorld({ line: LINE, u6Fs: { rows: [] } })
      mkdirSync(alpha6World.workspaceDir, { recursive: true })
      const alpha6Main = alpha6BlueprintYaml()
      assertBlueprintText(alpha6Main, ALPHA6_BP_ID, 'alpha6.yaml')
      writeFileSync(join(alpha6World.home, 'p6t6-directive.json'), `${JSON.stringify(p6t6Directive({ worldId: alpha6World.id, logDir: alpha6World.logDir, rootSessionId: ALPHA6_ROOT }), null, 2)}\n`)
      alpha6World.u6Fs.rows.push(...composedRows({ home: alpha6World.home, workspaceDir: alpha6World.workspaceDir, mainYaml: alpha6Main, alpha6: true }))
      await alpha6World.startMock({ decide: () => ({ kind: 'text', content: 'the alpha6 arm never reaches a model call' }) })
      let threw = false
      let errorText = ''
      let bootUrl = null
      try {
        const booted = await harness.boot({ world: alpha6World, phase: `${phase}-alpha6`, bootTimeoutMs: 180_000 })
        bootUrl = booted.url
      } catch (error) {
        threw = true
        errorText = String(error?.message ?? error)
      }
      const alpha6Log = alpha6World.instance?.logPath ?? null
      let logText = ''
      try { logText = alpha6Log === null ? '' : readFileSync(alpha6Log, 'utf8') } catch { logText = '' }
      // MEASURED: the row's config gate refuses the ROW, not the process — the
      // plugin bootstrap throws inside the fiber and the host still boots (no
      // team row live). Read the live state to verify nothing was silently
      // routed: no TeamSession, no Alpha.6 decision, no wake intent.
      let liveState = null
      let liveStateError = null
      let liveStateHttp = null
      if (bootUrl !== null) {
        try {
          const a6Origin = new URL(bootUrl).origin
          const a6Cookie = await authenticate(a6Origin, alpha6World.token)
          const res = await fetchJson(`${a6Origin}/__p6t6/state`, { headers: { cookie: a6Cookie } }, 20_000)
          liveStateHttp = res?.status ?? null
          liveState = res?.body ?? null
        } catch (error) {
          liveStateError = String(error?.message ?? error)
        }
      }
      // A host that booted WITHOUT the team row has no team root, so the state
      // route answers 200 with a null body (measured). That is "nothing live",
      // not a transport failure: a THROWN read stays null and fails the judge.
      const teamRowLive = liveState !== null ? Boolean(liveState.teamSession) : (liveStateError === null ? false : null)
      const liveMemberCount = liveState === null ? 0 : membersOf(liveState).length
      const factFile = join(alpha6World.home, CENTRE_DIR, 'alpha6.host-surface.facts.jsonl')
      // ── ROUND 68 PROBE (probe only; the judge's assertion strength is untouched) ──
      // The row gate now records its refusal through the product's own host-surface point, so
      // the probe reads the durable fact + settlement back from DISK and splits the old
      // `recordedFactPresent` into what it always meant for `no-silent-route`: an ADMITTED /
      // route-claiming fact. A refusal fact is the lawful record and must NOT fail that clause;
      // any fact that is not this row's typed denial still does.
      let factRows = []
      try { factRows = existsSync(factFile) ? readFileSync(factFile, 'utf8').split('\n').filter((line) => line.trim() !== '').map((line) => JSON.parse(line)) : [] } catch { factRows = [] }
      const alpha6AdmissionFacts = factRows.filter((row) => row?.kind === 'invocation-authority')
      const refusalFacts = alpha6AdmissionFacts.filter((row) => row?.decision === 'deny' && row?.refusalCode === HOST_SURFACE_REFUSALS.alpha6.code)
      const nonRefusalFacts = alpha6AdmissionFacts.filter((row) => row?.decision !== 'deny' || row?.refusalCode !== HOST_SURFACE_REFUSALS.alpha6.code)
      const refusalFact = refusalFacts[0] ?? null
      let refusalSettlement = null
      let refusalSettlementError = null
      let refusalSettlementRecordFile = null
      if (refusalFact !== null) {
        try {
          // READ-ONLY probe: the HOST process still owns the settlement writer lock at this point
          // (the store enforces one live writer per root), so opening a store here would be a
          // SETTLEMENT_WRITER_CONFLICT, not a missing record. The raw envelope is the durable record
          // the host wrote; the probe only parses it.
          const settlementDir = join(alpha6World.home, CENTRE_DIR, 'settlement', 'host-surface', 'alpha6')
          const identity = dispatchExecutionId({ rootSessionId: ALPHA6_ROOT, agentInstanceId: 'host-surface' }, String(refusalFact.callId))
          refusalSettlementRecordFile = join(settlementDir, `${identity}.settlement.json`)
          const envelope = JSON.parse(readFileSync(refusalSettlementRecordFile, 'utf8'))
          const payload = envelope?.payload ?? null
          refusalSettlement = {
            state: payload?.state ?? null,
            dispatch: payload?.observation?.dispatch ?? null,
            bodyOutcome: payload?.observation?.bodyOutcome ?? null,
            terminalReason: String(payload?.terminalReason ?? '').slice(0, 400),
            transitions: (payload?.transitions ?? []).map((transition) => transition?.to ?? null),
          }
        } catch (error) {
          refusalSettlementError = String(error?.message ?? error)
        }
      }
      alpha6Arm = {
        spawned: alpha6Log !== null,
        port: alpha6World.hostLease?.port ?? null,
        threw,
        reachable: !threw,
        bootUrl: bootUrl === null ? null : redact(bootUrl),
        error: `${errorText}\n${logText}`.slice(0, 20_000),
        errorHead: errorText.slice(0, 2000),
        hostLog: logText.slice(-6000),
        rowRefused: /bootstrap FAILED/u.test(logText) && logText.includes('ADMISSION_ALPHA6_UNAVAILABLE'),
        // The entry's own observability line (it cannot un-refuse anything; it names the files).
        recordedLogLine: /row refused at validation and RECORDED/u.test(logText),
        teamRowLive,
        liveAlpha6Decision: liveState === null ? null : (liveState.alpha6 ?? liveState.reviewRouting ?? null),
        liveStateError,
        liveStateHttp,
        liveMemberCount,
        // `no-silent-route` semantics, preserved: a fact that claims a ROUTE (or is not this row's
        // typed denial) is still present=false-forbidden. The recorded REFUSAL is measured separately.
        recordedFactPresent: nonRefusalFacts.length > 0,
        recordedFactReachable: refusalFact !== null,
        recordedFactReason: 'round 68: the row gate (host.ts validateTeamPluginConfig -> centre-config.ts) builds the product host-surface point at the refusal and records the invocation-authority fact + REFUSED/not-started settlement before the unchanged typed throw; this probe reads them back from disk',
        refusalFactFile: factFile,
        refusalFactCount: refusalFacts.length,
        refusalFact: refusalFact === null ? null : { callId: refusalFact.callId, decision: refusalFact.decision, refusalCode: refusalFact.refusalCode, axis: refusalFact.axis, toolName: refusalFact.toolName, reason: String(refusalFact.reason ?? '').slice(0, 600) },
        nonRefusalFactCount: nonRefusalFacts.length,
        refusalSettlement,
        refusalSettlementRecordFile,
        refusalSettlementError,
        wakeIntentFiles: walkFiles(alpha6World.home).filter((f) => f.name.includes('wake-intent')).length,
        logPath: alpha6Log,
        home: alpha6World.home,
        configGate,
        refusalTable: HOST_SURFACE_REFUSALS.alpha6,
      }
      writeFileSync(join(bootDir, 'alpha6-arm.json'), `${JSON.stringify({ ...alpha6Arm, error: errorText, hostLog: undefined, liveState: liveState === null ? null : { teamSession: liveState.teamSession ?? null, members: membersOf(liveState), alpha6: liveState.alpha6 ?? null } }, null, 2)}\n`)
      if (logText !== '') writeFileSync(join(bootDir, 'alpha6-host.log'), logText.slice(-200_000))
      try { await alpha6World.teardown() } catch (error) { log(`[boot${String(index)}] alpha6 teardown note: ${String(error?.message ?? error)}`) }
      alpha6World = null

      // ── the main governed World ──
      world = await harness.createWorld({ line: LINE, u6Fs: { rows: [] } })
      log(`[boot${String(index)}] world=${world.id} home=${world.home}`)
      const workspace = world.workspaceDir
      const aDir = join(workspace, 'team-a')
      const bDir = join(workspace, 'team-b')
      const corpus = join(bDir, CORPUS_DIR)
      mkdirSync(aDir, { recursive: true })
      mkdirSync(corpus, { recursive: true })
      paths = {
        aDir, bDir, corpus,
        aInLane: join(aDir, A_IN_LANE_FILE),
        bInLane: join(bDir, B_IN_LANE_FILE),
        stateFile: join(aDir, STATE_FILE),
        bigFile: join(bDir, BIG_EDIT_FILE),
      }
      writeFileSync(paths.aInLane, `${A_IN_LANE_TEXT}\n`, 'utf8')
      writeFileSync(paths.bInLane, `${B_IN_LANE_TEXT}\n`, 'utf8')
      const startedCorpus = Date.now()
      const filler = 'lorem ipsum dolor sit amet consectetur adipiscing elit sed do eiusmod tempor\n'
      const body = filler.repeat(64)
      for (let i = 0; i < 50_000; i += 1) writeFileSync(join(corpus, `f-${String(i).padStart(5, '0')}.txt`), body)
      const big = filler.repeat(8192)
      for (let i = 0; i < 64; i += 1) writeFileSync(join(corpus, `big-${String(i).padStart(3, '0')}.txt`), big)
      const huge = filler.repeat(65536)
      for (let i = 0; i < 8; i += 1) writeFileSync(join(corpus, `huge-${String(i)}.txt`), huge)
      // ONE match, in the LAST file written: the scan cannot return before it
      // has read every other file, so the admitted grep stays RUNNING long
      // enough to be the in-flight-at-crash record (and its result is a real
      // match, never an empty-scan artefact).
      appendFileSync(join(corpus, 'huge-7.txt'), `${CORPUS_NEEDLE}\n`)
      // The in-flight `edit` target: one 256 MiB in-lane file whose unique
      // needle is the LAST line, so the tool must read every byte and rewrite
      // the whole file — the body stays RUNNING for a measurable window with
      // only a 60-byte tool call.
      const bigChunk = Buffer.alloc(1024 * 1024, 0x41)
      const bigFd = openSync(paths.bigFile, 'w')
      try {
        for (let i = 0; i < BIG_EDIT_BYTES / bigChunk.length; i += 1) writeSync(bigFd, bigChunk)
        writeSync(bigFd, Buffer.from(`\n${EDIT_NEEDLE}\n`, 'utf8'))
      } finally {
        closeSync(bigFd)
      }
      log(`[boot${String(index)}] grep corpus built in ${String(Date.now() - startedCorpus)}ms (50000 small + 64 big + 8 huge files)`)
      writeFileSync(join(world.home, 'p6t6-directive.json'), `${JSON.stringify(p6t6Directive({ worldId: world.id, logDir: world.logDir }), null, 2)}\n`)
      mkdirSync(join(world.home, 'blueprints'), { recursive: true })
      const mainText = mainBlueprintYaml({ dirs: paths })
      assertBlueprintText(mainText, BP_MAIN_ID, 'main.yaml')
      writeFileSync(join(world.home, 'blueprints', 'main.yaml'), mainText)
      world.u6Fs.rows.push(...composedRows({ home: world.home, workspaceDir: workspace, mainYaml: mainText }))
      record.record.bindings.compositionDrops = COMPOSITION_DROPS
      writeFileSync(join(bootDir, 'composition-drops.json'), `${JSON.stringify(COMPOSITION_DROPS, null, 2)}\n`)
      await world.startMock({ decide: makeDecide({ paths, ids }) })
      return harness.boot({ world, phase, bootTimeoutMs: 300_000 })
    })
    record.record.boots = [{ phase, world: world.id, port: bootInfo.port, logPath: bootInfo.logPath, role: 'main' }]
    record.record.bindings = { ...record.record.bindings, worldIds: [world.id] }
    const origin = new URL(bootInfo.url).origin
    const cookie = await authenticate(origin, world.token)
    const health = await waitHealthy(origin, cookie, 120_000)
    if (health?.ok !== true) throw new Error(`the booted host never became ready: ${JSON.stringify(health?.body ?? null).slice(0, 800)}`)
    log(`[boot${String(index)}] host ready on ${origin}; health=${JSON.stringify(health.body).slice(0, 400)}`)

    const requests = () => world.mock?.requests ?? []
    const replyOf = (r) => String(r?.reply?.content ?? '')
    const sawReply = (marker) => requests().some((r) => replyOf(r).trim().startsWith(marker))
    const waitFor = async (predicate, timeoutMs, everyMs = 200) => {
      const deadline = Date.now() + timeoutMs
      for (;;) {
        let hit = false
        try { hit = (await predicate()) === true } catch { hit = false }
        if (hit) return true
        if (Date.now() >= deadline) return false
        await sleep(everyMs)
      }
    }
    const promptTurn = async (marker, doneMarker, tag) => {
      const res = await apiPrompt(origin, cookie, BOOT_ROOT, marker, tag)
      if (res?.status !== 200) throw new Error(`session/prompt(${tag}) failed: status=${String(res?.status)} body=${redact(JSON.stringify(res?.body ?? null)).slice(0, 500)}`)
      const ok = await waitFor(() => sawReply(doneMarker), 180_000)
      if (!ok) {
        const tail = requests().slice(-4).map((r) => ({
          seq: r?.seq ?? null,
          status: r?.status ?? null,
          error: r?.error === undefined ? null : String(r.error).slice(0, 200),
          replyKind: r?.reply?.kind ?? null,
          replyHead: replyOf(r).slice(0, 160),
          lastText: messagesOf(r).slice(-1).map(textOf).join('').slice(0, 240),
        }))
        throw new Error(`the Leader turn ${tag} never produced ${doneMarker} (mock requests=${String(requests().length)}; tail=${JSON.stringify(tail)})`)
      }
    }
    const waitSettled = async (instanceId, label) => {
      const ok = await waitFor(async () => {
        const st = await readState(origin, cookie)
        const row = membersOf(st).find((m) => String(m?.instanceId) === String(instanceId))
        return row !== undefined && row?.lifecycle === 'SETTLED'
      }, 150_000, 300)
      if (!ok) throw new Error(`${label} never reached lifecycle SETTLED`)
    }

    // ── discovery: MEASURE the real Leader surface ──
    abortStage = 'discovery'
    await promptTurn(MK_DISC, DONE_DISC, 'd3disc')
    const discovery = requests().filter((r) => surfaceNamesOf(r).length > 0 && !isMemberRequest(r)).at(-1) ?? null
    leaderSurface = discovery === null ? [] : surfaceNamesOf(discovery)
    writeFileSync(join(bootDir, 'leader-surface.json'), `${JSON.stringify({ tools: leaderSurface, teamTools: leaderSurface.filter((n) => n.startsWith('team_')) }, null, 2)}\n`)
    for (const required of TEAM_TOOL_NAMES) {
      if (!leaderSurface.includes(required)) throw new Error(`the Leader surface lost '${required}'`)
    }
    log(`[boot${String(index)}] leader surface tools=${String(leaderSurface.length)} team=${String(leaderSurface.filter((n) => n.startsWith('team_')).length)}`)

    // ── L1: delegate A (work unit + persistent-shell second turn) ──
    abortStage = 'delegate-a'
    await promptTurn(MK_L1, DONE_L1, 'd3l1')
    if (!(await waitFor(() => sawReply(UNIT_A), 180_000))) throw new Error('member A never delivered its unit')
    let state = await readState(origin, cookie)
    rowA = membersOf(state).find((m) => String(m?.templateId ?? '') === 'worker-a') ?? null
    if (rowA === null) throw new Error(`the product projection does not carry worker-a: ${JSON.stringify(membersOf(state).map((m) => `${m?.templateId}:${m?.instanceId}`))}`)
    ids.a = String(rowA.instanceId)
    log(`[boot${String(index)}] member A instance=${ids.a} childSession=${String(rowA.childSessionId)}`)
    await waitSettled(ids.a, 'member A')
    txA1 = readMemberTranscript(world.home, rowA.childSessionId)
    const delegateResultA = toolResultFor(requests(), CALL_D_A) ?? null
    // THE SURFACE IS READ FROM A REQUEST THAT CARRIES ONE. The first token-carrying request is not
    // always the member's tool turn: the host also issues tools-less auxiliary requests (title /
    // summary) over the same session content, so `.find(token)` alone is a race — a measured boot
    // picked one and recorded `tools: []` while the member's surface was intact. Selecting the
    // token-carrying request WITH a non-empty tool list observes the same fact deterministically; if
    // NO request carries tools, the surface stays [] and the judge still fails (the clause is not
    // relaxed: it still requires a non-empty surface containing `bash`).
    const tokenRequestsA = requests().filter((r) => memberTokenOf(r) === TOK_A)
    const memberRequestA = tokenRequestsA.find((r) => surfaceNamesOf(r).length > 0) ?? tokenRequestsA[0] ?? null
    memberSurface = memberRequestA === null ? [] : surfaceNamesOf(memberRequestA)
    writeFileSync(join(bootDir, 'member-surface.json'), `${JSON.stringify({ token: TOK_A, tools: memberSurface, tokenRequests: tokenRequestsA.length }, null, 2)}\n`)

    // ── L2: collect A while the delegation result is terminal ──
    abortStage = 'collect-a'
    collect1 = await driveCollect({ origin, cookie, requests, mk: MK_L2, done: DONE_L2, bootDir, callId: CALL_COLLECT_A, tag: 'd3l2' })

    // ── L3: A's second turn (the persistent-shell question) ──
    abortStage = 'follow-up-a-second-turn'
    await promptTurn(MK_L3, DONE_L3, 'd3l3')
    if (!(await waitFor(() => sawReply(DONE_MEMBER_A2), 180_000))) throw new Error('member A never finished its second turn')

    // ── L1B: delegate B — the crash in-flight turn. NOW, so the SIGKILL can
    //    land immediately after the grep settlement opens. ──
    abortStage = 'delegate-b'
    await promptTurn(MK_L1B, DONE_L1B, 'd3l1b')
    const sawB = await waitFor(async () => {
      const st = await readState(origin, cookie)
      const row = membersOf(st).find((m) => String(m?.templateId ?? '') === 'worker-b')
      if (row === undefined) return false
      rowB = row
      ids.b = String(row.instanceId)
      return true
    }, 90_000, 150)
    if (!sawB || ids.b === null) throw new Error('the product never created worker-b for the crash probe')
    log(`[boot${String(index)}] member B instance=${ids.b} childSession=${String(rowB.childSessionId)}`)
    writeFileSync(join(bootDir, 'members.json'), `${JSON.stringify({ a: rowA, b: rowB }, null, 2)}\n`)

    // The in-flight window: the grep settlement must be ADMITTED/RUNNING (the
    // centre opened it, the body has not settled) when the SIGKILL lands.
    abortStage = 'in-flight-window'
    const opened = await waitInFlight({ home: world.home, instanceId: ids.b, callId: CALL_B_EDIT, stateRoute: () => readState(origin, cookie), ids })
    if (opened.ask !== null) {
      ids.pendingRequestId = String(opened.ask.requestId ?? opened.ask.id ?? '')
      log(`[boot${String(index)}] in-flight call parked at an ask (${ids.pendingRequestId}); driving the Leader resolve_control`)
      await promptTurn(MK_APPROVE, DONE_APPROVE, 'd3approve')
      const opened2 = await waitInFlight({ home: world.home, instanceId: ids.b, callId: CALL_B_EDIT, stateRoute: () => readState(origin, cookie), ids })
      if (opened2.ask !== null) throw new Error('the approved in-flight call re-parked at a second ask')
      if (opened2.state === null) throw new Error('the approved in-flight call never opened a settlement')
    }
    if (opened.state === null && opened.ask === null) throw new Error(`the in-flight call never opened a settlement: ${JSON.stringify(opened).slice(0, 600)}`)
    log(`[boot${String(index)}] in-flight settlement state=${String(opened.state)} executionId=${String(opened.executionId)}`)

    // ── THE REAL KILL + cold restart on the SAME DSH_HOME ──
    abortStage = 'sigkill-restart'
    crash = await killAndRestart({ world, harness, phase, bootDir, ids, bootInfo })
    restartInfo = crash.bootInfo
    before = crash.before
    record.record.boots.push({ phase: `${phase}-resume`, world: world.id, port: restartInfo.port, logPath: restartInfo.logPath, role: 'resume-after-sigkill' })
    const origin2 = new URL(restartInfo.url).origin
    const cookie2 = await authenticate(origin2, world.token)
    const health2 = await waitHealthy(origin2, cookie2, 180_000)
    if (health2?.ok !== true) throw new Error(`the restarted host never became ready: ${JSON.stringify(health2?.body ?? null).slice(0, 900)}`)
    log(`[boot${String(index)}] restarted host ready on ${origin2}`)

    // ── post-restart durable reads: B's recovery is expected to have run at
    //    member re-bind during boot. Wait (bounded) for the UNKNOWN transition.
    abortStage = 'post-restart-records'
    const recovered = await waitFor(() => settlementOf(world.home, ids.b, CALL_B_EDIT).state === 'UNKNOWN', 60_000, 250)
    if (!recovered) log(`[boot${String(index)}] WARNING: the in-flight settlement did not read UNKNOWN within 60s`)
    const stateAfter = await readState(origin2, cookie2)
    writeFileSync(join(bootDir, 'state-after-restart.json'), `${JSON.stringify({
      members: membersOf(stateAfter).map((m) => ({ instanceId: m?.instanceId, templateId: m?.templateId, lifecycle: m?.lifecycle })),
      controlRequests: stateAfter?.control?.requests ?? null,
      teamSession: stateAfter?.teamSession ?? null,
    }, null, 2)}\n`)

    // ── L4: collect A AGAIN, after the cold restart (durable + terminal) ──
    abortStage = 'collect-a-after-restart'
    collect2 = await driveCollect({ origin: origin2, cookie: cookie2, requests, mk: MK_L4, done: DONE_L4, bootDir, callId: CALL_COLLECT_A2, tag: 'd3l4', suffix: '-after' })

    // ── L5: a NEW call after recovery on the same member A ──
    abortStage = 'follow-up-a-after-recovery'
    const l5 = await apiPrompt(origin2, cookie2, BOOT_ROOT, MK_L5, 'd3l5')
    if (l5?.status !== 200) throw new Error(`session/prompt(d3l5) failed: status=${String(l5?.status)}`)
    if (!(await waitFor(() => sawReply(DONE_L5), 180_000))) throw new Error('the L5 Leader turn never closed')
    if (!(await waitFor(() => sawReply(DONE_MEMBER_A_AFTER), 180_000))) throw new Error('member A never finished the post-recovery turn')
    await waitSettled(ids.a, 'member A after recovery')

    // ── evidence: FRESH disk readers (never the live process) ──
    abortStage = 'evidence-collection'
    const allRequests = requests()
    txAAll = readMemberTranscript(world.home, rowA.childSessionId)
    txB = readMemberTranscript(world.home, rowB.childSessionId)
    for (const [label, tx] of [['a', txAAll], ['b', txB]]) {
      if (tx === null) continue
      writeFileSync(join(bootDir, `member-${label}-transcript.json`), `${JSON.stringify(tx, null, 2)}\n`)
      try { writeFileSync(join(bootDir, `member-${label}-session.v4.jsonl.zstd`), readFileSync(tx.file)) } catch { /* normalised copy remains */ }
      writeFileSync(join(bootDir, `member-${label}-transcript.txt`), `${renderTranscript(tx)}\n`)
    }
    const ledgerA = readLedger(world.home, ids.a)
    const ledgerB = readLedger(world.home, ids.b)
    writeFileSync(join(bootDir, 'centre-facts-a.json'), `${JSON.stringify(ledgerA, null, 2)}\n`)
    writeFileSync(join(bootDir, 'centre-facts-b.json'), `${JSON.stringify(ledgerB, null, 2)}\n`)
    const callOf = (tx, id) => tx?.calls?.find((c) => String(c.callId) === String(id)) ?? null
    const settleA1 = settlementOf(world.home, ids.a, CALL_A_BASH1)
    const settleA2 = settlementOf(world.home, ids.a, CALL_A_BASH2)
    const settlements = {
      bash1: settleA1,
      bash2: settleA2,
      aReadAfterRestart: settlementOf(world.home, ids.a, CALL_A_READ),
      bOpenAtKill: before.bOpen,
      bOpenAfterRestart: settlementOf(world.home, ids.b, CALL_B_EDIT),
      // The in-lane search probe's DURABLE FACT (shape B: decision=allow, overlayOutcome=no-opinion)
      // and its tool result, recorded on both sides of the cold restart. Not a judge — an observation.
      bGrepFactsBefore: factsFor(ledgerB, CALL_B_GREP, 'invocation-authority'),
      bGrepFactsAfter: factsFor(readLedger(world.home, ids.b), CALL_B_GREP, 'invocation-authority'),
      bGrepResult: callOf(txB, CALL_B_GREP)?.result ?? null,
      aAfter: settlementOf(world.home, ids.a, CALL_A_AFTER),
    }
    writeFileSync(join(bootDir, 'settlement.json'), `${JSON.stringify(settlements, null, 2)}\n`)
    if (txB !== null) {
      writeFileSync(join(bootDir, 'crash-call.json'), `${JSON.stringify({
        at: new Date().toISOString(),
        bOpenCall: callOf(txB, CALL_B_EDIT),
        bGrepCall: callOf(txB, CALL_B_GREP),
        bReadCall: callOf(txB, CALL_B_READ),
        note: 'the crashed call (the edit) is present with NO tool result (its body never returned); the same callId never reappears as a second admission. The grep probe before it is a COMPLETED admitted call, not the in-flight record',
      }, null, 2)}\n`)
    }

    after = {
      home: world.home,
      stateFile: paths.stateFile,
      aRead: settlementOf(world.home, ids.a, CALL_A_READ),
      aReadFacts: factsFor(ledgerA, CALL_A_READ, 'invocation-authority'),
      bOpen: settlementOf(world.home, ids.b, CALL_B_EDIT),
      bOpenAdmissions: factsFor(ledgerB, CALL_B_EDIT, 'invocation-authority'),
      bOpenExecutions: factsFor(ledgerB, CALL_B_EDIT, 'execution'),
      bGrepFacts: factsFor(ledgerB, CALL_B_GREP, 'invocation-authority'),
      aNewFacts: factsFor(ledgerA, CALL_A_AFTER, 'invocation-authority'),
      aNewSettle: settlementOf(world.home, ids.a, CALL_A_AFTER),
      workDiskHits: diskFilesContaining(world.home, UNIT_A),
    }
    const otherLedgers = allCentreLedgerFiles(world.home).filter((f) => f.name !== `${ids.a}.facts.jsonl` && f.name !== `${ids.b}.facts.jsonl`)
    counters.aAdmissions = ledgerA.filter((r) => r?.kind === 'invocation-authority').length
    counters.bAdmissions = ledgerB.filter((r) => r?.kind === 'invocation-authority').length
    counters.aExecutions = ledgerA.filter((r) => r?.kind === 'execution').length
    counters.bExecutions = ledgerB.filter((r) => r?.kind === 'execution').length
    counters.mockRequests = allRequests.length
    counters.memberModelRequests = allRequests.filter((r) => isMemberRequest(r) && surfaceNamesOf(r).length > 0).length
    // Normalize the ONE timing-dependent counter: the kill may land while the
    // settlement is still ADMITTED or already RUNNING — both mean "open at the
    // crash", and the two-boot agreement compares the MEANING, not the race.
    counters.inflightBefore = ['ADMITTED', 'RUNNING'].includes(before.bOpen?.state) ? 'open' : (before.bOpen?.state ?? null)
    counters.inflightAfter = after.bOpen?.state ?? null
    counters.collectStatus = collect1?.entry?.status ?? null
    counters.bash1State = settleA1.state
    counters.bash2State = settleA2.state
    counters.restartAt = restartInfo?.logPath ?? null
    counters.elapsedMs = Date.now() - bootStartedAt
    writeFileSync(join(bootDir, 'counters.json'), `${JSON.stringify(counters, null, 2)}\n`)
    writeFileSync(join(bootDir, 'before-crash.json'), `${JSON.stringify(before, null, 2)}\n`)
    writeFileSync(join(bootDir, 'after-restart.json'), `${JSON.stringify(after, null, 2)}\n`)

    // ── judges ─────────────────────────────────────────────────────────────
    const presetPlugins = (layer.rows.find((r) => r?.config?.id === PRESET_ID)?.config?.plugins ?? []).map((p) => p.id)
    const verdicts = {
      persistent: judgePersistent({
        bash1: callOf(txAAll, CALL_A_BASH1), bash2: callOf(txAAll, CALL_A_BASH2),
        ledger: ledgerA, settle1: settleA1, settle2: settleA2, paths, presetPlugins, memberSurface,
      }),
      crash: judgeCrash({ before, after, restart: { ...crash, bootPhase: 'create-or-open', home: world.home }, home: world.home }),
      work: judgeWork({
        a: {
          instance: ids.a, childSessionId: rowA.childSessionId, ledger: ledgerA,
          user0: txA1?.user?.[0] ?? null, delegateResult: delegateResultA,
        },
        collect1, collect2, otherLedgers, workDiskHits: after.workDiskHits, memberSurface,
        unitText: txA1?.finalAssistant ?? null,
      }),
      alpha6: judgeAlpha6({ arm: alpha6Arm, refusalTable: alpha6Arm.refusalTable, configGate: alpha6Arm.configGate }),
    }
    writeFileSync(join(bootDir, 'verdicts.json'), `${JSON.stringify(verdicts, null, 2)}\n`)

    const add = (id, verdict, detail) => {
      const { verdict: _ignored, ...rest } = detail ?? {}
      record.addCase(id, toRunVerdict(verdict), rest)
      log(`[boot${String(index)}] case ${id}: ${toRunVerdict(verdict)} (${verdict})${verdict === 'PROVEN' ? '' : ` failing=${JSON.stringify(detail.failing)}`}`)
    }
    add('d3:persistent-subprocess', verdicts.persistent.verdict, verdicts.persistent)
    add('d3:crash-cold-recovery', verdicts.crash.verdict, verdicts.crash)
    add('d3:work-delivery', verdicts.work.verdict, verdicts.work)
    add('d3:alpha6', verdicts.alpha6.verdict, verdicts.alpha6)

    const final = record.finalize()
    const summary = formatSummary(final)
    writeFileSync(join(bootDir, 'run-record.json'), `${JSON.stringify(final, null, 2)}\n`)
    writeFileSync(join(bootDir, 'summary.txt'), `${summary}\n`)
    log(`[boot${String(index)}] ${summary}`)

    result = {
      boot: index, worldId: world.id, runId, summary, overall: final.overall,
      verdicts: {
        persistent: verdicts.persistent.verdict, crash: verdicts.crash.verdict,
        work: verdicts.work.verdict, alpha6: verdicts.alpha6.verdict,
      },
      failedClauses: {
        persistent: verdicts.persistent.failing, crash: verdicts.crash.failing,
        work: verdicts.work.failing, alpha6: verdicts.alpha6.failing,
      },
      counters,
      evidence: bootDir,
      home: world.home,
      host: { port: bootInfo.port, log: bootInfo.logPath, restartLog: restartInfo?.logPath ?? null },
      alpha6: {
        thrown: alpha6Arm.threw,
        recordedFactPresent: alpha6Arm.recordedFactPresent,
        refusalFactRecorded: alpha6Arm.refusalFactCount === 1,
        refusalFactCount: alpha6Arm.refusalFactCount,
        refusalSettlement: alpha6Arm.refusalSettlement,
      },
    }
  } catch (error) {
    failure = error
    record.markAborted({ stage: abortStage, detail: `boot ${String(index)} aborted at ${abortStage}`, error: String(error?.stack ?? error) })
    try {
      const final = record.finalize()
      writeFileSync(join(bootDir, 'run-record.json'), `${JSON.stringify(final, null, 2)}\n`)
      writeFileSync(join(bootDir, 'summary.txt'), `${formatSummary(final)}\n`)
    } catch { /* record write is best-effort on abort */ }
    log(`[boot${String(index)}] FAILED at ${abortStage}: ${String(error?.stack ?? error)}`)
  } finally {
    if (alpha6World !== null) {
      try { await alpha6World.teardown() } catch { /* best effort */ }
    }
    if (world !== null) {
      try {
        teardown = await world.teardown()
        log(`[boot${String(index)}] teardown: ${JSON.stringify(teardown).slice(0, 400)}`)
      } catch (error) {
        log(`[boot${String(index)}] teardown failed: ${String(error?.message ?? error)}`)
      }
    }
    try {
      const settled = settleDevLiveLease(lease)
      log(`[boot${String(index)}] dev-live slot released (released=${String(settled.released)} held=${String(settled.held)})`)
    } catch (error) {
      log(`[boot${String(index)}] SLOT RELEASE FAILED: ${String(error?.stack ?? error)}`)
      if (failure === null) { failure = error; abortStage = 'slot-release' }
    }
    const porcelain = hostPorcelain()
    writeFileSync(join(bootDir, 'teardown.json'), `${JSON.stringify({ at: new Date().toISOString(), teardown, hostTreePorcelain: porcelain }, null, 2)}\n`)
    if (porcelain.length > 0) log(`[boot${String(index)}] HOST TREE IS DIRTY: ${JSON.stringify(porcelain)}`)
  }
  if (failure !== null) return { boot: index, failed: true, stage: abortStage, error: String(failure?.message ?? failure), result }
  return result
}

// ─────────────────────────────────────────────────────────────────────────────
// driving helpers
// ─────────────────────────────────────────────────────────────────────────────
async function waitInFlight({ home, instanceId, callId, stateRoute, ids }) {
  const deadline = Date.now() + 120_000
  let ticks = 0
  for (;;) {
    const s = settlementOf(home, instanceId, callId)
    if (s.state === 'ADMITTED' || s.state === 'RUNNING') return { ...s, ask: null }
    if (s.state === 'COMPLETED' || s.state === 'FAILED' || s.state === 'REFUSED' || s.state === 'UNKNOWN') return { ...s, ask: null, closedTooEarly: true }
    ticks += 1
    if (ids !== undefined && ticks % 20 === 0) {
      const state = await stateRoute().catch(() => null)
      const ask = state === null ? null : pendingAskOf(state, instanceId)
      if (ask !== null) return { ...s, ask }
    }
    if (Date.now() >= deadline) return { ...s, ask: null, timeout: true }
    await sleep(10)
  }
}

async function driveCollect({ origin, cookie, requests, mk, done, bootDir, callId, tag, suffix = '' }) {
  const before = requests().length
  const res = await apiPrompt(origin, cookie, BOOT_ROOT, mk, tag)
  if (res?.status !== 200) throw new Error(`session/prompt(${tag}) failed: status=${String(res?.status)} body=${redact(JSON.stringify(res?.body ?? null)).slice(0, 400)}`)
  const deadline = Date.now() + 150_000
  for (;;) {
    const record = requests().slice(before).find((r) => !isMemberRequest(r) && resultIdsOf(r).has(callId))
    if (record !== undefined) {
      const result = toolResultFor([record], callId) ?? null
      writeFileSync(join(bootDir, `collect${suffix}.json`), `${JSON.stringify({ at: new Date().toISOString(), callId, result }, null, 2)}\n`)
      return { result, entry: collectEntryOf(result, WORK_A), text: String(result?.text ?? '') }
    }
    if (Date.now() >= deadline) throw new Error(`the Leader turn ${tag} never issued/answered ${callId}`)
    await sleep(150)
  }
}

async function killAndRestart({ world, harness, phase, bootDir, ids, bootInfo }) {
  const child = world.instance?.child ?? null
  const pid = typeof child?.pid === 'number' ? child.pid : null
  if (pid === null) throw new Error('the crash judge needs the real host process pid; none was recorded')
  const firstHome = world.home
  const before = {
    at: new Date().toISOString(),
    home: firstHome,
    aRead: settlementOf(firstHome, ids.a, CALL_A_READ),
    aReadFacts: factsFor(readLedger(firstHome, ids.a), CALL_A_READ, 'invocation-authority'),
    bOpen: settlementOf(firstHome, ids.b, CALL_B_EDIT),
    bOpenAdmissions: factsFor(readLedger(firstHome, ids.b), CALL_B_EDIT, 'invocation-authority'),
    bOpenExecutions: factsFor(readLedger(firstHome, ids.b), CALL_B_EDIT, 'execution'),
    bGrepFacts: factsFor(readLedger(firstHome, ids.b), CALL_B_GREP, 'invocation-authority'),
    aLedgerBytes: (() => { try { return readFileSync(ledgerPathOf(firstHome, ids.a), 'utf8').length } catch { return null } })(),
  }
  if (before.bOpen.state !== 'RUNNING' && before.bOpen.state !== 'ADMITTED') {
    const admissions = factsFor(readLedger(firstHome, ids.b), CALL_B_EDIT)
    writeFileSync(join(bootDir, 'inflight-refusal.json'), `${JSON.stringify({ at: new Date().toISOString(), callId: CALL_B_EDIT, state: before.bOpen.state, settlement: settlementOf(firstHome, ids.b, CALL_B_EDIT), admissions }, null, 2)}\n`)
    throw new Error(`no genuine in-flight call at crash time: ${CALL_B_EDIT} settlement state=${JSON.stringify(before.bOpen.state)} fact=${JSON.stringify(admissions.map((f) => ({ decision: f.decision, axis: f.axis, code: f.code ?? null, reason: String(f.reason ?? f.detail ?? '').slice(0, 300) })))} (the crash judge cannot fake an in-flight call)`)
  }
  const exit = new Promise((resolveExit) => {
    child.once('exit', (code, signal) => resolveExit({ code, signal }))
    child.once('close', (code, signal) => resolveExit({ code, signal }))
    child.once('error', (error) => resolveExit({ code: null, signal: null, error: String(error?.message ?? error) }))
  })
  process.kill(pid, 'SIGKILL')
  const killedAt = new Date().toISOString()
  const exitInfo = await Promise.race([exit, sleep(15_000).then(() => ({ timeout: true }))])
  let pidGone = false
  try { readFileSync(`/proc/${pid}/stat`, 'utf8') } catch { pidGone = true }
  const port = world.hostLease?.port ?? 0
  const portFree = await waitPortFree(port, 30_000)
  world.instance = null
  log(`[boot] SIGKILL pid=${String(pid)} exit=${JSON.stringify(exitInfo)} pidGone=${String(pidGone)} portFree=${String(portFree)}`)

  // Preserve the pre-crash host log: DshInstance truncates the SAME
  // instance-port<port>.log on the restart.
  try { writeFileSync(join(bootDir, 'host-log-before-crash.log'), readFileSync(bootInfo.logPath)) } catch { /* best effort */ }
  const hostRow = world.u6Fs.rows.find((r) => r?.id === 'dsh-agent-team')
  if (hostRow === undefined) throw new Error('the host row disappeared before the restart')
  hostRow.config.bootPhase = 'create-or-open'
  const restartInfo = await harness.boot({ world, phase: `${phase}-resume`, bootTimeoutMs: 300_000 })
  writeFileSync(join(bootDir, 'crash.json'), `${JSON.stringify({
    at: killedAt, pid, exit: exitInfo, pidGone, portFree,
    settlementBefore: {
      aRead: { state: before.aRead.state, transitions: before.aRead.transitions },
      bOpen: { state: before.bOpen.state, transitions: before.bOpen.transitions, executionId: before.bOpen.executionId, file: before.bOpen.file },
    },
    restart: { url: redact(restartInfo.url), logPath: restartInfo.logPath },
  }, null, 2)}\n`)
  return { before, firstHome, killedPid: pid, signal: 'SIGKILL', exit: exitInfo, pidGone, portFree, bootInfo: restartInfo, bootPhase: 'create-or-open', booted: true }
}

function renderTranscript(transcript) {
  if (transcript === null) return 'NO MEMBER TRANSCRIPT (the Member session log was not found before teardown)'
  const out = []
  out.push(`# Member transcript — ${transcript.sessionId}`)
  out.push(`# durable log: ${transcript.file}`)
  out.push('')
  for (const u of transcript.user) {
    const text = String(u).trim()
    out.push('USER:', text.length <= 900 ? text : `${text.slice(0, 900)}\n… [rendered truncated at 900 chars; the full text is in member-transcript.json]`, '')
  }
  for (const call of transcript.calls) {
    const args = call.arguments ?? {}
    out.push(`TOOL CALL [${call.name}] ${String(call.callId)}`)
    out.push(`  file_path: ${String(args.file_path ?? args.path ?? '')}`)
    out.push(`  command: ${String(args.command ?? '')}`)
    if (call.result === null) {
      out.push('TOOL RESULT: <missing>', '')
      continue
    }
    out.push(`TOOL RESULT isError=${String(call.result.isError)}`)
    out.push(indent(call.result.text))
    out.push('')
  }
  out.push('ASSISTANT (final):', String(transcript.finalAssistant ?? '').trim())
  return out.join('\n')
}
function indent(text) {
  return String(text ?? '').split('\n').map((l) => `  ${l}`).join('\n')
}

// ─────────────────────────────────────────────────────────────────────────────
// bindings, agreement, main
// ─────────────────────────────────────────────────────────────────────────────
function runBindings(head, grant) {
  return {
    authority: readAuthorityBinding(REPO_ROOT),
    candidate: { head, hostSha: TEST_USE_BASELINE_SHA, baseline: TEST_USE_BASELINE_SHA },
    grant: { grantId: grant.grantId, scope: 'DEV-LIVE', face: grant.face, world: grant.world },
    recordClass: 'DEV-LIVE',
    compositionDrops: COMPOSITION_DROPS,
    layout: 'centre',
    installGraph: process.env.A5SF_WF_NO_INSTALL_GRAPH === '1' ? 'skipped (negative control A5SF_WF_NO_INSTALL_GRAPH=1)' : 'provisioned',
    teamSha: head,
    hostSha: TEST_USE_BASELINE_SHA,
    note: 'DEV-LIVE: development evidence, never a candidate claim; candidateClaimEligibility is false by construction',
    driver: 'run-boot-d3',
  }
}

function archivePriorRuns() {
  if (!existsSync(RUNS)) return null
  const entries = readdirSync(RUNS)
  if (entries.length === 0) return null
  mkdirSync(ARCHIVE, { recursive: true })
  const target = join(ARCHIVE, utcStamp())
  renameSync(RUNS, target)
  log(`archived previous runs -> ${target}`)
  return target
}

function buildAgreement(results) {
  const ok = results.filter((r) => r?.failed !== true)
  const rows = ok.map((r) => ({
    boot: r.boot,
    overall: r.overall,
    persistent: r.verdicts?.persistent ?? null,
    crash: r.verdicts?.crash ?? null,
    work: r.verdicts?.work ?? null,
    alpha6: r.verdicts?.alpha6 ?? null,
    aAdmissions: r.counters?.aAdmissions ?? null,
    bAdmissions: r.counters?.bAdmissions ?? null,
    inflightBefore: r.counters?.inflightBefore ?? null,
    inflightAfter: r.counters?.inflightAfter ?? null,
    collectStatus: r.counters?.collectStatus ?? null,
    bash1State: r.counters?.bash1State ?? null,
    bash2State: r.counters?.bash2State ?? null,
  }))
  const keys = ['overall', 'persistent', 'crash', 'work', 'alpha6', 'aAdmissions', 'bAdmissions', 'inflightBefore', 'inflightAfter', 'collectStatus', 'bash1State', 'bash2State']
  const differing = keys.filter((k) => new Set(rows.map((r) => JSON.stringify(r[k]))).size > 1)
  const agreeing = rows.length >= 2 && differing.length === 0
  const header = ['fact', ...rows.map((r) => `boot${String(r.boot)}`)]
  const body = keys.map((k) => [k, ...rows.map((r) => String(r[k]))])
  const width = Math.max(34, ...header.map((h) => h.length)) + 2
  const cell = (v) => String(v).padEnd(width)
  const table = [
    'TWO-RUN AGREEMENT (the same command, two boots; every measured row must be identical)',
    header.map(cell).join('').replace(/ +$/u, ''),
    ...body.map(([k, ...vals]) => `${cell(k)}${vals.map(cell).join('')}`.replace(/ +$/u, '')),
    '',
    `agreeing=${String(agreeing)} differing=${JSON.stringify(differing)}`,
  ].join('\n')
  return { schema: 'dboot-d3/agreement/1', at: new Date().toISOString(), boots: results.length, agreeing, differing, rows, table }
}

async function main() {
  mkdirSync(EVIDENCE, { recursive: true })
  const head = resolveHeadCommit(REPO_ROOT)
  if (head === null) throw new Error('git rev-parse HEAD failed: the start cannot be bound')
  const grant = readJson(GRANT_PATH)
  if (grant === null) throw new Error(`no dev-live grant at ${GRANT_PATH}`)
  const archived = archivePriorRuns()
  log(`ARCHIVE: ${archived === null ? '(nothing to archive)' : archived}`)
  writeFileSync(join(EVIDENCE, 'driver-digest.json'), `${JSON.stringify({
    at: startedAt, head, hostTree: HOST_TREE, hostSha: hostDigest(), pin: TEST_USE_BASELINE_SHA,
    driverSha256: sha256(fileURLToPath(import.meta.url)), jsSubstitutions: layer.jsSubstitutions,
    command: `node tests/world-factory/drivers/d-boot-feasibility/run-boot-d3.mjs${BOOTS_WANTED === 2 ? '' : ` --boots ${String(BOOTS_WANTED)}`}`,
  }, null, 2)}\n`)
  log(`START head=${head} hostTree=${HOST_TREE} pin=${TEST_USE_BASELINE_SHA} boots=${String(BOOTS_WANTED)}`)
  log(`host porcelain before: ${JSON.stringify(hostPorcelain())}`)
  if (hostPorcelain().length !== 0) throw new Error('the pinned host tree is not clean (porcelain non-empty): refusing to boot')

  const results = []
  for (let i = 1; i <= BOOTS_WANTED; i += 1) {
    const r = await bootOnce({ index: i, head, grant })
    results.push(r)
    if (r?.failed === true) {
      log(`boot ${String(i)} failed at ${String(r.stage)}; continuing is pointless (no agreeing pair)`)
      break
    }
  }

  const agreement = buildAgreement(results)
  writeFileSync(join(EVIDENCE, 'agreement.json'), `${JSON.stringify(agreement, null, 2)}\n`)
  writeFileSync(join(EVIDENCE, 'agreement.txt'), `${agreement.table}\n`)
  log(agreement.table)
  const porcelain = hostPorcelain()
  writeFileSync(join(EVIDENCE, 'host-tree-porcelain.txt'), porcelain.length === 0 ? 'empty\n' : `${porcelain.join('\n')}\n`)
  log(`host porcelain after: ${JSON.stringify(porcelain)}`)
  if (porcelain.length !== 0) process.exitCode = 1
  const allRan = results.length === BOOTS_WANTED && results.every((r) => r?.failed !== true)
  const pairOk = BOOTS_WANTED < 2 || agreement.agreeing === true
  const allProven = results.every((r) => r?.overall === 'PASS')
  log(`RESULT evidence-complete=${String(allRan && pairOk)} allProven=${String(allProven)} (${String(results.length)}/${String(BOOTS_WANTED)} boots; agreeing pair=${String(agreement.agreeing)})`)
  if (!allRan || !pairOk || !allProven) process.exitCode = 1
}

if (PLAN_ONLY) {
  try {
    planOnly()
  } catch (error) {
    log(`PLAN FAILED: ${String(error?.stack ?? error)}`)
    process.exitCode = 1
  }
} else {
  main().catch((error) => {
    log(`DRIVER FAILED (outside the run): ${String(error?.stack ?? error)}`)
    process.exitCode = 1
  })
}
