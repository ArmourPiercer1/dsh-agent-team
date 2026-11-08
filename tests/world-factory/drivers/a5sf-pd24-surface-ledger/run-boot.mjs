#!/usr/bin/env node
/**
 * tests/world-factory/drivers/a5sf-pd24-surface-ledger/run-boot.mjs — the LIVE
 * driver for PD-24: the governed Member's FULL model-visible tool surface, one
 * row at a time.
 *
 * WHY THIS FILE EXISTS. PD-18 (web/PTC), PD-21/22 (`subagent` family) and PD-23
 * (`send_message`/`interrupt_agent`/`list_agents`/`skill`) fail-closed the rows
 * that were measured and found to execute on the BASE services. The head after
 * those merges still offers a 34-name Member surface, and only the seven
 * confined-face tools had a settled disposition. The rest had never been
 * classified ONE NAME AT A TIME. This driver walks that whole roster in a single
 * real Member turn and records, per name, what the Member actually received.
 *
 * THE ROWS UNDER MEASUREMENT (the ones PD-23 did not settle):
 *   `ask_user_question`  does it BLOCK a delegated turn, or type-refuse?
 *   `exit_plan_mode`     what does it do while plan mode is INACTIVE?
 *   `present`            does its file stat resolve the BASE `fs` (out-of-lane
 *                        existence oracle) and does it record any a5sf fact?
 *   `u5_canary`/`u6fs_probe`  World-composition FIXTURES on the same surface.
 *   the seven confined-face names  re-executed here so the ledger row has a live
 *                        call in THIS run, not only in a sibling lane's.
 *   the eleven FAIL-CLOSED names   each must answer the host router's typed
 *                        `unknown tool`, and nothing may execute.
 *   `create_goal`        ONLY what the task asks: can a Member create a goal and
 *                        start its SELF-CONTINUATION loop (does `roundsStarted`
 *                        grow), and does that loop stay in the Member's OWN
 *                        session? Goal semantics are NOT changed here (PD-25).
 *
 * ONE COMMAND, TWO BOOTS (the agreeing pair), per arm:
 *
 *   node tests/world-factory/drivers/a5sf-pd24-surface-ledger/run-boot.mjs
 *   node tests/world-factory/drivers/a5sf-pd24-surface-ledger/run-boot.mjs --arm prefix
 *
 * `--plan` is host-free (row/blueprint validation, zero boots). `--boots 1` is a
 * development iteration. `--arm postfix` (default) boots the composition in this
 * tree; `--arm prefix` boots a RECORDED pre-fix composition given by
 * `A5SF_PD24_COMPOSITION` (this lane's base commit's `cordis.patch.yml`), so the
 * `present` flip is a measured before/after rather than a story.
 *
 * WHAT IS FIXTURE (disclosed): the model is the shared scripted mock
 * (`packages/tools/harness/mock-deepseek.mjs`); the /proc watcher and the mock
 * request log are test instrumentation; `u5_canary`/`u6fs_probe` are the World's
 * own test-only plugins (they are NOT shipped tool names, and they are reported
 * as fixtures, never counted as shipped capability). The product path is real:
 * the preset row, the realm provider/compiler, the guard sink, the confined
 * faces, the job registry, the goal service, the goal round driver, the host
 * router and the team tool router are the shipped modules the Host loads.
 *
 * Boot evidence is NEVER merge evidence: record class `DEV-LIVE`,
 * `candidateClaimEligibility` false by construction.
 *
 * CORE PATCH BUDGET = 0. No upstream tree is touched.
 *
 * @module tests/world-factory/drivers/a5sf-pd24-surface-ledger/run-boot
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  appendFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, renameSync, writeFileSync,
} from 'node:fs'
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
import { acquireDevLiveSlot } from '../../lib/dev-live-slots.mjs'
import { resolveHeadCommit } from '../../suites/150-a5sf-read.mjs'
import {
  lastUserTextOfStatic, messagesOf, surfaceNamesOf, textOf,
} from '../../lib/u6-fs-assembly.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..')
const EVIDENCE = join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence', 'a5sf-pd24-surface-ledger')
const RUNS_POSTFIX = join(EVIDENCE, 'runs')
const RUNS_PREFIX = join(EVIDENCE, 'archive', 'pair-prefix')
const LEDGER_PATH = join(EVIDENCE, 'run-ledger.jsonl')

const LINE = 'u5a5sfpd24'
const BOOT_ROOT = 'session-a5sf-pd24-boot'
const ACCEPTANCE_ROOT = 'session-a5sf-pd24-team'
const BP_ANCHOR_ID = 'team.a5sf.pd24.anchor'
const BP_MAIN_ID = 'team.a5sf.pd24.main'
const PRESET_ID = 'a5sf-governed-member'

const MK_DISC = 'A5SF_PD24_DISC'
const MK_L1 = 'A5SF_PD24_L1_DRIVE'
const TOK_A = 'a5sf-pd24-turn'
const CALL_LEADER_JOB = 'call-a5sfpd24-leader-job'
const CALL_DELEGATE_A = 'call-a5sfpd24-delegate-a'
const CALL_BASH = 'call-a5sfpd24-bash'
const CALL_READ = 'call-a5sfpd24-read'
const CALL_WRITE = 'call-a5sfpd24-write'
const CALL_EDIT = 'call-a5sfpd24-edit'
const CALL_GREP = 'call-a5sfpd24-grep'
const CALL_GLOB = 'call-a5sfpd24-glob'
const CALL_READ_IMAGE = 'call-a5sfpd24-read-image'
const CALL_JOB_LIST = 'call-a5sfpd24-job-list'
const CALL_JOB_FOREIGN = 'call-a5sfpd24-job-foreign'
const CALL_JOB_KILL = 'call-a5sfpd24-job-kill'
const CALL_TODO = 'call-a5sfpd24-todo'
const CALL_GOAL_GET = 'call-a5sfpd24-goal-get'
const CALL_ASK = 'call-a5sfpd24-ask'
const CALL_EXIT_PLAN = 'call-a5sfpd24-exit-plan'
const CALL_PRESENT_IN = 'call-a5sfpd24-present-in'
const CALL_PRESENT_OUT = 'call-a5sfpd24-present-out'
const CALL_PRESENT_MISSING = 'call-a5sfpd24-present-missing'
const CALL_CANARY = 'call-a5sfpd24-canary'
const CALL_U6FS = 'call-a5sfpd24-u6fs'
const CALL_GOAL_CREATE = 'call-a5sfpd24-goal-create'
const CALL_GOAL_ROUND_GET = 'call-a5sfpd24-goal-round-get'
const CALL_GOAL_COMPLETE = 'call-a5sfpd24-goal-complete'
const DONE_A = 'A5SF_PD24_MEMBER_A_DONE'
const DONE_L1 = 'A5SF_PD24_L1_DONE'
const IN_LANE_TEXT = 'A5SF_PD24_IN_LANE_BYTES'
const SECRET_TEXT = 'A5SF_PD24_OUT_OF_LANE_SECRET'
const IN_LANE_FILE = 'in-lane.txt'
const SECRET_FILE = 'secret-out-of-lane.txt'
const WRITTEN_FILE = 'written-by-member.txt'
const EDITED_FILE = 'edited-by-member.txt'
const IMAGE_FILE = 'in-lane.png'
const MISSING_OUT_OF_LANE = 'does-not-exist-out-of-lane.txt'

/** The eleven names removed fail-closed by PD-18/21/22/23 (+ PD-24's `present`). */
const REMOVED_NAMES = Object.freeze([
  'interrupt_agent', 'list_agents', 'pwsh', 'send_message', 'skill', 'subagent', 'subagent_fork',
  'web_fetch', 'web_search', 'workflow',
])
const REMOVED_BY_PD24 = Object.freeze(['present'])
const FAIL_CLOSED_NAMES = Object.freeze([...REMOVED_NAMES, ...REMOVED_BY_PD24])

const SELECTED_CASES = Object.freeze([
  'pd24:surface-roster',
  'pd24:confined-baseline',
  'pd24:fs-family-live',
  'pd24:jobs-owner-scoped',
  'pd24:todo-session-local',
  'pd24:exit-plan-refused',
  'pd24:present-confined',
  'pd24:fixtures-not-shipped',
  'pd24:fail-closed-typed',
  'pd24:goal-self-continuation-session-local',
  'pd24:no-new-members',
  'pd24:no-out-of-lane-bytes',
])
const ASK_CASES = Object.freeze(['pd24:ask-blocks-delegated-turn'])
const argv = process.argv.slice(2)
const PLAN_ONLY = argv.includes('--plan')
const ARM = (() => {
  const i = argv.indexOf('--arm')
  const value = i === -1 ? 'postfix' : String(argv[i + 1] ?? '')
  if (value !== 'postfix' && value !== 'prefix' && value !== 'ask') {
    throw new Error(`--arm must be 'postfix', 'prefix' or 'ask' (got '${value}')`)
  }
  return value
})()
/** The ASK arm gets its own runs directory: its boot ENDS with a turn that is
 *  still open on purpose, so it must never be read as a settled pair. */
const RUNS_ASK = join(EVIDENCE, 'runs-ask')
const RUNS = ARM === 'prefix' ? RUNS_PREFIX : ARM === 'ask' ? RUNS_ASK : RUNS_POSTFIX
const ASK_ARM = ARM === 'ask'
/** The composition under test. The `prefix` arm boots a RECORDED pre-fix file
 *  (`A5SF_PD24_COMPOSITION`), so the flip is a measured before/after. */
const COMPOSITION_PATH = process.env.A5SF_PD24_COMPOSITION === undefined || process.env.A5SF_PD24_COMPOSITION === ''
  ? join(REPO_ROOT, 'cordis.patch.yml')
  : resolve(process.env.A5SF_PD24_COMPOSITION)
const BOOTS_WANTED = (() => {
  const i = argv.indexOf('--boots')
  if (i === -1) return 2
  const n = Number(argv[i + 1])
  return Number.isInteger(n) && n > 0 ? n : 2
})()

const startedAt = new Date().toISOString()

// ─────────────────────────────────────────────────────────────────────────────
// small helpers
// ─────────────────────────────────────────────────────────────────────────────
let RUN_LOG = join(EVIDENCE, 'driver.log')
function log(line) {
  const text = `[${new Date().toISOString()}] ${String(line)}`.replace(/[ \t]+$/u, '')
  // eslint-disable-next-line no-console
  console.log(text)
  try { appendFileSync(RUN_LOG, text + '\n') } catch { /* console is the live channel */ }
}
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
const readJson = (p) => { try { return JSON.parse(readFileSync(p, 'utf8')) } catch { return null } }
const parseJsonl = (p) => {
  try {
    return readFileSync(p, 'utf8').split('\n').filter((l) => l.trim() !== '').map((l) => {
      try { return JSON.parse(l) } catch { return { leg: 'UNPARSEABLE', raw: l.slice(0, 200) } }
    })
  } catch { return [] }
}
const redact = (t) => String(t ?? '').replace(/\?token=[A-Za-z0-9_-]+/gu, '?token=<redacted>')
const utcStamp = () => new Date().toISOString().replace(/[:.]/gu, '-')

/** The pristine pinned host tree. This driver never writes it. */
function hostTreePath() {
  const local = join(REPO_ROOT, 'tests', 'deepseek-harness-test-use')
  try {
    const st = lstatSync(local)
    if (st.isDirectory() && st.isSymbolicLink() === false) return local
  } catch { /* absent */ }
  return resolve(REPO_ROOT, '..', '..', 'tests', 'deepseek-harness-test-use')
}
const HOST_TREE = hostTreePath()
const require_ = createRequire(join(REPO_ROOT, 'package.json'))

// ─────────────────────────────────────────────────────────────────────────────
// the SHIPPED layer: rows + preset, with the one `!!js` expression evaluated
// ─────────────────────────────────────────────────────────────────────────────
function shippedLayer() {
  const YAML = require_('yaml')
  const raw = readFileSync(COMPOSITION_PATH, 'utf8')
  const jsSubstitutions = []
  const evaluated = raw.replace(/!!js[ \t]+([^\n]+)/gu, (_m, expr) => {
    const source = expr.trim()
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

/** The governed preset's flattened plugin ids (groups included). */
function presetPluginIds(layer) {
  const preset = layer.rows.find((row) => row?.config?.id === PRESET_ID)
  const flatten = (list) => (list ?? []).flatMap((p) => (p?.group === true ? flatten(p.config) : [p]))
  return flatten(preset?.config?.plugins).map((p) => String(p.id))
}

// ─────────────────────────────────────────────────────────────────────────────
// blueprints
// ─────────────────────────────────────────────────────────────────────────────
function anchorBlueprintYaml() {
  const doc = {
    schemaVersion: 3,
    blueprintId: BP_ANCHOR_ID,
    revision: '1',
    leader: { templateId: 'leader', persona: `You lead the a5sf PD-24 anchor team. ${MK_DISC} is the discovery marker.` },
    members: [{ templateId: 'worker', persona: 'You are the anchor worker.' }],
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

/**
 * The v4 design of the team whose Member turn is measured. ONE governed Member:
 * its IO ceiling covers the World workspace only, while `secret-out-of-lane.txt`
 * lives one directory ABOVE it (outside the compiled lane). The Member has no
 * wider sibling: PD-24 measures the SURFACE, not cross-Member reach (PD-23).
 */
function mainBlueprintYaml({ workspace }) {
  const doc = {
    schemaVersion: 4,
    blueprintId: BP_MAIN_ID,
    revision: '1',
    leader: {
      templateId: 'leader',
      persona: `You lead the a5sf PD-24 surface team. ${MK_L1} drives your chain: start one background job, delegate the governed Member once (sync), then finish.`,
    },
    members: [
      {
        templateId: 'worker',
        displayName: 'Governed Worker A',
        persona: 'You are the governed worker. Run the probes exactly once each, one tool call at a time.',
      },
    ],
    requirements: [],
    teamEnvelope: {
      allow: ['create-member', 'assign-task', 'send-message', 'report-progress', 'archive-member'],
      deny: [],
    },
    memberEnvelopes: [],
    policyStates: [{ id: 'default', description: 'Default state.' }],
    permissionMutationEnvelope: { rules: [] },
    teamHardEnvelope: { rules: [] },
    metadata: {},
    memberIoCeilings: [
      {
        templateId: 'worker',
        io: {
          read: lane([workspace]),
          write: lane([workspace]),
          network: { mode: 'allow' },
        },
      },
    ],
  }
  return `---\n${JSON.stringify(doc, null, 2)}\n---\n`
}

function blueprintFacade() {
  return require_(join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'domain', 'blueprint', 'src', 'index.js'))
}
function assertBlueprintText(text, wantId, label) {
  let parsed
  try {
    parsed = blueprintFacade().parseBlueprint(text)
  } catch (error) {
    throw new Error(`${label} rejected by the host validator: ${String(error?.message ?? error)} ${JSON.stringify(error?.details?.problems ?? null)}`)
  }
  const doc = parsed.blueprint ?? parsed
  if (doc.blueprintId !== wantId) throw new Error(`${label} resolves as ${String(doc.blueprintId)}, want ${wantId}`)
  if (wantId === BP_MAIN_ID && doc.schemaVersion !== 4) throw new Error(`${label} is schemaVersion ${String(doc.schemaVersion)}, want 4`)
  if (wantId === BP_MAIN_ID && !Array.isArray(doc.memberIoCeilings)) throw new Error(`${label} lost its memberIoCeilings family`)
  return { ok: true, schemaVersion: doc.schemaVersion, via: 'parseBlueprint(dist domain facade)' }
}

// ─────────────────────────────────────────────────────────────────────────────
// the composed rows
// ─────────────────────────────────────────────────────────────────────────────
function p6t6Directive({ worldId, logDir }) {
  return { boot: 1, phase: 'create', reportDir: logDir, runStamp: worldId, rootSessionId: ACCEPTANCE_ROOT }
}

function composedRows({ home, anchorYaml, layer }) {
  const hostRow = layer.rows.find((row) => row?.name === 'dsh-agent-team/host')
  const presetRow = layer.rows.find((row) => row?.config?.id === PRESET_ID)
  if (hostRow === undefined) throw new Error('the shipped layer carries no dsh-agent-team/host row')
  if (presetRow === undefined) throw new Error(`the shipped layer carries no preset '${PRESET_ID}' row`)
  const config = {
    ...hostRow.config,
    rootSessionId: BOOT_ROOT,
    bootPhase: 'create',
    blueprintSource: anchorYaml,
    blueprintDir: join(home, 'blueprints'),
    seedMembers: [],
    memberPresetId: PRESET_ID,
    a5sfGovernedRealm: true,
    a5sfEvidencePath: join(home, 'a5sf-consult.jsonl'),
    mcpServers: [],
    mcpServer: null,
  }
  return [
    {
      id: 'dsh-agent-team',
      name: pathToFileURL(join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'src', 'plugin', 'host.js')).href,
      config,
    },
    { id: 'preset-a5sf-governed-member', name: '@deepseek-ai/dsh-agent-preset', config: presetRow.config },
    { id: 'p6t6-team-tools', name: pathToFileURL(join(REPO_ROOT, 'packages', 'tools', 'harness', 'plugin.mjs')).href },
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// the team-remote call, with a budget the MEMBER TURN can actually fit in
// ─────────────────────────────────────────────────────────────────────────────
/**
 * `remoteCall` (lib/u6-fs-assembly) uses fetchJson's 60 s default. `team.create`
 * with `initialWork` does not return until the Leader's first turn SETTLES, and
 * that turn contains a SYNC delegation of the Member's whole surface walk — one
 * confined `bash`, five more confined-face calls and ~25 more tool calls. The
 * body shape is copied from `remoteCall` (same rpc envelope); only the budget
 * differs, and the budget is disclosed here rather than hidden in a library
 * default that was never sized for a full-surface turn.
 */
async function remoteCallLong(fetchJson, origin, cookie, method, params, tag = 'a5sfpd24', timeoutMs = 300_000) {
  const rpcId = `${tag}-${Math.random().toString(36).slice(2, 12)}`
  return fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId, method, payload: { version: 1, params } }),
  }, timeoutMs)
}

// ─────────────────────────────────────────────────────────────────────────────
// mock-model request helpers
// ─────────────────────────────────────────────────────────────────────────────
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
function toolResultFor(requests, callId) {
  for (const req of requests) {
    for (const message of messagesOf(req)) {
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
function firstUserText(req) {
  const first = messagesOf(req).find((m) => m?.role === 'user')
  if (first === undefined) return ''
  return typeof first.content === 'string' ? first.content : JSON.stringify(first.content ?? '')
}
/** The Member's request is identified STRUCTURALLY by the token only its
 *  delegated `[team-work …]` envelope carries. */
function isARequest(req) {
  const text = firstUserText(req)
  return text.includes('[team-work ') && text.includes(TOK_A)
}
function plantedLeaderJobOf(req) {
  const text = firstUserText(req)
  return /A5SF_PD24_LEADER_JOB=([A-Za-z0-9:_-]+)/u.exec(text)?.[1] ?? null
}
function allToolResultText(req) {
  const parts = []
  for (const message of messagesOf(req)) {
    if (!Array.isArray(message?.content)) continue
    for (const block of message.content) {
      if (block?.type !== 'tool_result') continue
      parts.push(Array.isArray(block.content)
        ? block.content.map((c) => c?.text ?? '').join('')
        : typeof block.content === 'string' ? block.content : '')
    }
  }
  return parts.join('\n')
}

/**
 * The scripted model. Two branches, each selected STRUCTURALLY: the Member's
 * turn by the token in its delegated envelope, the Leader's turn by its marker.
 *
 * The probe order is deliberate. `create_goal` is LAST because a successful
 * create opens a SELF-CONTINUATION round in the Member's own session; the round
 * request is answered with `get_goal` (to read `roundsStarted`) and then
 * `update_goal complete`. Every earlier probe therefore runs inside the original
 * turn, which is also how "the turn kept going after ask/exit_plan/present" is
 * witnessed.
 */
function makeDecide({ workspaceDir }) {
  const call = (id, name, args) => ({ kind: 'tool-call', toolCalls: [{ id, name, arguments: args }] })
  return function decide({ req }) {
    const allText = messagesOf(req).map(textOf).join('\n')
    const lastUser = lastUserTextOfStatic(req)
    if (allText.includes('Generate the session title')) return { kind: 'text', content: 'a5sf pd24 session' }

    if (isARequest(req)) {
      const seen = resultIdsOf(req)
      const leaderJob = plantedLeaderJobOf(req)
      // ── ASK ARM: the ONLY thing this turn does after the control is ask ──
      // `ask_user_question` in the legacy (default) mode has NO timeout. The
      // main arm therefore cannot contain it: a blocking call would hide every
      // later probe. Its own arm measures exactly one thing — that the call is
      // ISSUED and that no result ever comes back while the turn stays open.
      if (ASK_ARM) {
        if (!seen.has(CALL_BASH)) {
          return call(CALL_BASH, 'bash', { command: `cat '${join(workspaceDir, IN_LANE_FILE)}'`, description: 'Read the in-lane fixture', workdir: workspaceDir })
        }
        if (!seen.has(CALL_ASK)) {
          return call(CALL_ASK, 'ask_user_question', {
            questions: [{
              id: 'pd24-ask',
              header: 'PD-24 probe',
              question: 'Must a governed Member block its own turn on a human answer?',
              options: [{ label: 'Yes' }, { label: 'No' }],
              multi_select: false,
            }],
          })
        }
        return { kind: 'text', content: `${DONE_A} ask arm (unreachable: the ask call never settles)` }
      }
      // The goal's own round: read roundsStarted, then close the goal.
      if (lastUser.includes('<goal_round>')) {
        if (!seen.has(CALL_GOAL_ROUND_GET)) return call(CALL_GOAL_ROUND_GET, 'get_goal', {})
        const ref = /"goal":\{"id":"(goal-[^"]+)","revision":(\d+)/u.exec(allToolResultText(req))
          ?? /"id":"(goal-[^"]+)","revision":(\d+)/u.exec(allToolResultText(req))
        if (ref !== null) {
          return call(CALL_GOAL_COMPLETE, 'update_goal', { goal_id: ref[1], revision: Number(ref[2]), action: 'complete' })
        }
        return { kind: 'text', content: `${DONE_A} goal round without a goal ref` }
      }
      // Positive control: the confined terminal face.
      if (!seen.has(CALL_BASH)) {
        return call(CALL_BASH, 'bash', { command: `cat '${join(workspaceDir, IN_LANE_FILE)}'`, description: 'Read the in-lane fixture', workdir: workspaceDir })
      }
      if (!seen.has(CALL_READ)) return call(CALL_READ, 'read', { file_path: join(workspaceDir, IN_LANE_FILE) })
      if (!seen.has(CALL_WRITE)) {
        return call(CALL_WRITE, 'write', { file_path: join(workspaceDir, WRITTEN_FILE), content: `${IN_LANE_TEXT} written\n` })
      }
      if (!seen.has(CALL_EDIT)) {
        return call(CALL_EDIT, 'edit', {
          file_path: join(workspaceDir, IN_LANE_FILE),
          old_string: IN_LANE_TEXT,
          new_string: `${IN_LANE_TEXT}\n${IN_LANE_TEXT} edited`,
        })
      }
      if (!seen.has(CALL_GREP)) {
        return call(CALL_GREP, 'grep', { pattern: IN_LANE_TEXT, path: workspaceDir, include: '*.txt' })
      }
      if (!seen.has(CALL_GLOB)) return call(CALL_GLOB, 'glob', { pattern: '*.txt', path: workspaceDir })
      if (!seen.has(CALL_READ_IMAGE)) return call(CALL_READ_IMAGE, 'read_image', { file_path: join(workspaceDir, IMAGE_FILE) })
      if (!seen.has(CALL_JOB_LIST)) return call(CALL_JOB_LIST, 'job_list', {})
      if (!seen.has(CALL_JOB_FOREIGN)) return call(CALL_JOB_FOREIGN, 'job_output', { job_id: leaderJob ?? 'job-unresolved' })
      if (!seen.has(CALL_JOB_KILL)) return call(CALL_JOB_KILL, 'job_kill', { job_id: leaderJob ?? 'job-unresolved', reason: 'pd24 foreign-job probe' })
      if (!seen.has(CALL_TODO)) {
        return call(CALL_TODO, 'todo_write', {
          todos: [
            { content: 'PD-24 surface-ledger probe (member-local)', status: 'in_progress' },
            { content: 'PD-24 report', status: 'pending' },
          ],
        })
      }
      if (!seen.has(CALL_GOAL_GET)) return call(CALL_GOAL_GET, 'get_goal', {})
      // ── the per-session tools measured HERE (ask has its own arm) ────────
      if (!seen.has(CALL_EXIT_PLAN)) {
        return call(CALL_EXIT_PLAN, 'exit_plan_mode', { plan: '# PD-24 probe plan\n\nThis must not leave plan mode.' })
      }
      // ── `present`: in-lane, out-of-lane EXISTING, out-of-lane MISSING ────
      if (!seen.has(CALL_PRESENT_IN)) {
        return call(CALL_PRESENT_IN, 'present', { files: [{ path: join(workspaceDir, IN_LANE_FILE), description: 'in-lane fixture' }] })
      }
      if (!seen.has(CALL_PRESENT_OUT)) {
        return call(CALL_PRESENT_OUT, 'present', {
          files: [{ path: join(dirname(workspaceDir), 'out-of-lane', SECRET_FILE), description: 'out-of-lane fixture' }],
        })
      }
      if (!seen.has(CALL_PRESENT_MISSING)) {
        return call(CALL_PRESENT_MISSING, 'present', {
          files: [{ path: join(dirname(workspaceDir), 'out-of-lane', MISSING_OUT_OF_LANE), description: 'absent out-of-lane fixture' }],
        })
      }
      // ── the two World fixtures that sit on the same surface ─────────────
      if (!seen.has(CALL_CANARY)) return call(CALL_CANARY, 'u5_canary', { mode: 'ok', tag: 'pd24-canary' })
      if (!seen.has(CALL_U6FS)) return call(CALL_U6FS, 'u6fs_probe', { action: 'report', tag: 'pd24-probe' })
      // ── every FAIL-CLOSED name: the router must answer typed `unknown tool`
      for (const name of FAIL_CLOSED_NAMES) {
        const id = `call-a5sfpd24-closed-${name}`
        if (!seen.has(id)) return call(id, name, {})
      }
      // ── LAST: create the goal so its self-continuation round is the tail ─
      if (!seen.has(CALL_GOAL_CREATE)) {
        return call(CALL_GOAL_CREATE, 'create_goal', { objective: 'A Member goal must stay inside its own session.', max_goal_rounds: 2 })
      }
      return { kind: 'text', content: `${DONE_A} ${lastToolResultText(req).slice(0, 300)}` }
    }

    if (lastUser.includes(MK_DISC)) return { kind: 'text', content: 'A5SF_PD24_DISC_DONE' }
    const isLeader = lastUser.includes(MK_L1) || allText.includes(MK_L1)
    if (isLeader) {
      const seen = resultIdsOf(req)
      if (!seen.has(CALL_LEADER_JOB)) {
        return call(CALL_LEADER_JOB, 'bash', {
          command: 'sleep 20',
          description: 'Hold a background job the Member will try to read',
          workdir: workspaceDir,
          run_in_background: true,
        })
      }
      if (!seen.has(CALL_DELEGATE_A)) {
        const results = allToolResultText(req)
        const jobId = /started background job ([A-Za-z0-9:_-]+)/u.exec(results)?.[1]
          ?? /"jobId"\s*:\s*"([^"]+)"/u.exec(results)?.[1] ?? null
        return call(CALL_DELEGATE_A, 'team_delegate', {
          rootSessionId: ACCEPTANCE_ROOT,
          requestToken: `${TOK_A}-delegate`,
          delegationTemplateId: 'worker',
          label: 'a5sfpd24-worker-a',
          workspace: workspaceDir,
          prompt: `${TOK_A}: run the probes exactly once each, one tool call at a time, then report.`
            + ` A5SF_PD24_LEADER_JOB=${jobId ?? 'job-unresolved'}`,
          // ASK ARM: ASYNC, because the Member's turn never settles. A SYNC
          // delegation would hold `team.create` open forever and the driver
          // could not collect the evidence it exists to collect.
          async: ASK_ARM,
        })
      }
      return { kind: 'text', content: DONE_L1 }
    }
    return { kind: 'text', content: 'A5SF_PD24_NOOP' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// independent /proc observation (our counters are NOT the witness)
// ─────────────────────────────────────────────────────────────────────────────
function readProcStat(pid) {
  try {
    const stat = readFileSync(`/proc/${pid}/stat`, 'utf8')
    const tail = stat.slice(stat.lastIndexOf(')') + 2).split(' ')
    return { state: tail[0], ppid: Number(tail[1]) }
  } catch { return null }
}

function scanProc({ inLanePath, secretPath }) {
  const hits = []
  let pids = []
  try { pids = readdirSync('/proc').filter((n) => /^\d+$/u.test(n)) } catch { return hits }
  for (const pid of pids) {
    let cmdline = ''
    try { cmdline = readFileSync(`/proc/${pid}/cmdline`, 'utf8').replaceAll('\0', ' ').trim() } catch { continue }
    if (cmdline === '') continue
    const stat = readProcStat(pid)
    const base = { pid: Number(pid), ppid: stat?.ppid ?? null, state: stat?.state ?? null }
    if (cmdline.includes('landlock-prelauncher.py')) {
      hits.push({ marker: 'confined-launcher', cmdline: cmdline.slice(0, 400), ...base })
    }
    if (cmdline.includes('bwrap')) {
      hits.push({ marker: 'base-bwrap', inLane: cmdline.includes(inLanePath), secret: cmdline.includes(secretPath), cmdline: cmdline.slice(0, 400), ...base })
    }
    if (cmdline.includes(inLanePath)) hits.push({ marker: 'payload-in-lane', cmdline: cmdline.slice(0, 400), ...base })
    if (cmdline.includes(secretPath)) hits.push({ marker: 'payload-secret', cmdline: cmdline.slice(0, 400), ...base })
  }
  return hits
}

// ─────────────────────────────────────────────────────────────────────────────
// the Member's OWN durable transcript
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
function normaliseSession(found, sessionId) {
  let lines = []
  try {
    lines = decompressZstdStream(found.buffer).toString('utf8').split('\n').filter((l) => l !== '')
      .map((l) => { try { return JSON.parse(l) } catch { return { unparsed: l.slice(0, 200) } } })
  } catch { return null }
  const calls = []
  const results = []
  const assistant = []
  const user = []
  const eventTypes = {}
  let todoWrites = 0
  for (const row of lines) {
    const data = row?.data ?? row
    const type = row?.type ?? row?.kind ?? null
    if (type !== null) eventTypes[String(type)] = (eventTypes[String(type)] ?? 0) + 1
    if (type === 'todo/write') todoWrites += 1
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
  const paired = calls.map((callRow) => {
    const result = results.find((r) => String(r.callId) === String(callRow.callId)) ?? null
    let args = null
    try { args = JSON.parse(callRow.arguments) } catch { args = null }
    return { callId: callRow.callId, name: callRow.name, arguments: args, result }
  })
  return {
    sessionId,
    file: found.file,
    header: found.header,
    agentPreset: found.header?.agentPreset ?? null,
    delegationDepth: found.header?.delegationDepth ?? null,
    lineCount: lines.length,
    eventTypes,
    todoWrites,
    user,
    calls: paired,
    assistant,
    finalAssistant: assistant.at(-1) ?? null,
  }
}

/** Every durable session's event-type census, keyed by session id. */
function scanSessionEventTypes(dshHome) {
  const out = {}
  if (!existsSync(dshHome)) return out
  for (const entry of walkFiles(dshHome)) {
    if (!/^session(\..+)?\.jsonl\.zstd$/u.test(entry.name)) continue
    let buf
    try { buf = readFileSync(entry.path) } catch { continue }
    const header = parseFirstJsonLine(buf)
    if (header === null) continue
    const id = String(header.id ?? entry.path)
    let lines = []
    try { lines = decompressZstdStream(buf).toString('utf8').split('\n').filter((l) => l !== '') } catch { continue }
    const types = {}
    for (const line of lines) {
      try {
        const row = JSON.parse(line)
        const t = String(row?.type ?? row?.kind ?? '')
        if (t !== '') types[t] = (types[t] ?? 0) + 1
      } catch { /* unparsable row is not a fact */ }
    }
    const goalEvents = Object.entries(types).filter(([t]) => t.startsWith('goal')).reduce((acc, [, n]) => acc + n, 0)
    out[id] = { file: entry.path, types, goalEvents }
  }
  return out
}

function readMemberTranscript(dshHome, sessionId) {
  const found = findSessionFile(dshHome, sessionId)
  if (found === null) return null
  return normaliseSession(found, sessionId)
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
const toRunVerdict = (verdict) => (verdict === 'PROVEN' ? 'PASS' : 'FAIL')
const resultText = (r) => String(r?.result?.text ?? r?.text ?? '')
const isErrorResult = (r) => r?.result?.isError === true || r?.isError === true
const typedUnknown = (r, name) => isErrorResult(r) && new RegExp(`unknown tool "${name}"`, 'u').test(resultText(r))

function judgeRoster({ expect, surfaceNames, fixtures, removed }) {
  const closed = expect === 'prefix' ? removed.filter((n) => n !== 'present') : removed
  const clauses = [
    { id: 'roster-nonempty', ok: Array.isArray(surfaceNames) && surfaceNames.length > 0, detail: `names=${String(surfaceNames?.length)}` },
    ...fixtures.map((n, i) => ({ id: `fixture-${String(i)}-present`, ok: surfaceNames.includes(n), detail: `fixture ${n} on the surface` })),
    { id: 'no-closed-name-on-surface', ok: closed.every((n) => surfaceNames.includes(n) === false), detail: `closed names present=${JSON.stringify(closed.filter((n) => surfaceNames.includes(n)))}` },
    { id: 'no-skill-row', ok: surfaceNames.includes('skill') === false, detail: 'PD-23 took `skill`' },
  ]
  if (expect === 'prefix') {
    clauses.push({ id: 'pre-fix-present-is-on-the-surface', ok: surfaceNames.includes('present'), detail: 'POST-FIX would be a defect: on the pre-fix composition `present` MUST be present (that is the row under measurement)' })
  }
  return verdictOf(
    expect === 'prefix'
      ? 'PRE-FIX roster: every fail-closed name from PD-18/21/22/23 is absent, `present` is STILL on the surface (the row this lane removes), and the World fixtures are disclosed'
      : 'the measured Member surface is the FULL roster this ledger classifies: every shipped name it claims is present, and none of the fail-closed names (including `present`) is',
    clauses,
  )
}

function judgeBaseline(sample) {
  const record = (() => { try { return JSON.parse(resultText(sample)) } catch { return null } })()
  return verdictOf(
    'the Member\'s model-visible `bash` admits an in-ceiling read through the confined terminal face and records a guard fact (the positive control)',
    [
      { id: 'call-issued', ok: sample.call !== null, detail: 'the Member issued the admitted `bash` call' },
      { id: 'call-is-bash', ok: sample.call?.name === 'bash', detail: `name=${String(sample.call?.name)}` },
      { id: 'result-not-error', ok: sample.result?.isError === false, detail: `isError=${String(sample.result?.isError)}` },
      { id: 'confined-terminal-kind', ok: record?.kind === 'confined-terminal', detail: `kind=${String(record?.kind)}` },
      { id: 'in-lane-bytes', ok: String(record?.stdout ?? '').includes(IN_LANE_TEXT), detail: 'the admitted read returned the in-lane bytes' },
    ],
  )
}

function judgeFsFamily({ read, write, edit, grep, glob, readImage, factTools }) {
  const has = (name) => Number(factTools?.[name] ?? 0) > 0
  return verdictOf(
    'the six confined-face file/search names execute in THIS Member turn through their faces and each records a guard fact carrying `tool`/`callId` (PD-19); `read_image` is refused at the model ROUTE gate before the face',
    [
      { id: 'read-issued', ok: read.call !== null, detail: 'the Member issued `read`' },
      { id: 'read-bytes', ok: isErrorResult(read) === false && resultText(read).includes(IN_LANE_TEXT), detail: `isError=${String(isErrorResult(read))} text=${resultText(read).slice(0, 120)}` },
      { id: 'read-fact', ok: has('read'), detail: `read facts=${String(factTools?.read ?? 0)}` },
      { id: 'write-issued', ok: write.call !== null, detail: 'the Member issued `write`' },
      { id: 'write-accepted', ok: isErrorResult(write) === false, detail: `isError=${String(isErrorResult(write))} text=${resultText(write).slice(0, 160)}` },
      { id: 'write-fact', ok: has('write'), detail: `write facts=${String(factTools?.write ?? 0)}` },
      { id: 'edit-issued', ok: edit.call !== null, detail: 'the Member issued `edit`' },
      { id: 'edit-accepted', ok: isErrorResult(edit) === false, detail: `isError=${String(isErrorResult(edit))} text=${resultText(edit).slice(0, 160)}` },
      { id: 'edit-fact', ok: has('edit'), detail: `edit facts=${String(factTools?.edit ?? 0)}` },
      { id: 'grep-issued', ok: grep.call !== null, detail: 'the Member issued `grep`' },
      { id: 'grep-matches', ok: isErrorResult(grep) === false && resultText(grep).includes(IN_LANE_TEXT), detail: `isError=${String(isErrorResult(grep))} text=${resultText(grep).slice(0, 160)}` },
      { id: 'grep-fact', ok: has('grep'), detail: `grep facts=${String(factTools?.grep ?? 0)}` },
      { id: 'glob-issued', ok: glob.call !== null, detail: 'the Member issued `glob`' },
      { id: 'glob-matches', ok: isErrorResult(glob) === false && resultText(glob).includes(IN_LANE_FILE), detail: `isError=${String(isErrorResult(glob))} text=${resultText(glob).slice(0, 160)}` },
      { id: 'glob-fact', ok: has('glob'), detail: `glob facts=${String(factTools?.glob ?? 0)}` },
      { id: 'read-image-issued', ok: readImage.call !== null, detail: 'the Member issued `read_image` on an in-lane PNG' },
      { id: 'read-image-refused-before-face', ok: isErrorResult(readImage) && /image|modality|attach|not support|unsupported/iu.test(resultText(readImage)), detail: `isError=${String(isErrorResult(readImage))} text=${resultText(readImage).slice(0, 200)}` },
      { id: 'read-image-zero-bytes', ok: resultText(readImage).includes(IN_LANE_TEXT) === false, detail: 'the route refusal carries no file bytes' },
    ],
  )
}

function judgeJobs({ jobList, foreign, kill, factTools }) {
  return verdictOf(
    'the job registry is OWNER-scoped and has no producer on this preset: `job_list` is empty and a FOREIGN Leader job id is a typed refusal for BOTH `job_output` and `job_kill`, with zero job facts',
    [
      { id: 'list-issued', ok: jobList.call !== null, detail: 'the Member issued `job_list`' },
      { id: 'list-empty', ok: /\(no background jobs\)/u.test(resultText(jobList)) || resultText(jobList).trim() === '', detail: `text=${resultText(jobList).slice(0, 140)} (no producer on the confined face)` },
      { id: 'foreign-job-refused', ok: isErrorResult(foreign) && /unknown job|belongs to another session/u.test(resultText(foreign)), detail: `isError=${String(isErrorResult(foreign))} text=${resultText(foreign).slice(0, 200)}` },
      { id: 'foreign-kill-refused', ok: isErrorResult(kill) && /unknown job|belongs to another session/u.test(resultText(kill)), detail: `isError=${String(isErrorResult(kill))} text=${resultText(kill).slice(0, 200)}` },
      { id: 'zero-job-facts', ok: Number(factTools?.job_list ?? 0) === 0 && Number(factTools?.job_output ?? 0) === 0 && Number(factTools?.job_kill ?? 0) === 0, detail: `job facts=${JSON.stringify({ list: factTools?.job_list ?? 0, output: factTools?.job_output ?? 0, kill: factTools?.job_kill ?? 0 })} — the job registry is not an a5sf face` },
    ],
  )
}

function judgeTodo({ todo, transcriptA, eventTypesAll, sessionA }) {
  const aTodo = (transcriptA?.todoWrites ?? 0) > 0
  const others = Object.entries(eventTypesAll ?? {})
    .filter(([id]) => String(id) !== String(sessionA))
    .filter(([, v]) => Number(v?.types?.['todo/write'] ?? 0) > 0)
    .map(([id]) => id)
  return verdictOf(
    '`todo_write` writes a `todo/write` event to the CALLING Member session only; no other session in the World receives one',
    [
      { id: 'todo-issued', ok: todo.call !== null, detail: `todos=${JSON.stringify(todo.call?.arguments?.todos ?? null)}` },
      { id: 'todo-accepted', ok: isErrorResult(todo) === false, detail: `isError=${String(isErrorResult(todo))}` },
      { id: 'todo-in-a-session', ok: aTodo, detail: `A session todo/write events=${String(transcriptA?.todoWrites ?? 0)}` },
      { id: 'no-todo-elsewhere', ok: others.length === 0, detail: `sessions with todo/write other than A: ${JSON.stringify(others)}` },
    ],
  )
}

function judgeExitPlan({ exitPlan, transcriptA }) {
  const text = resultText(exitPlan)
  return verdictOf(
    '`exit_plan_mode` while plan mode is INACTIVE is a typed refusal: it presents nothing, appends no `plan/mode` event, and the turn keeps going',
    [
      { id: 'call-issued', ok: exitPlan.call !== null, detail: 'the Member issued `exit_plan_mode`' },
      { id: 'typed-refusal', ok: isErrorResult(exitPlan) && /plan mode|not in plan/iu.test(text), detail: `isError=${String(isErrorResult(exitPlan))} text=${text.slice(0, 240)}` },
      { id: 'no-plan-mode-event', ok: Number(transcriptA?.eventTypes?.['plan/mode'] ?? 0) === 0, detail: `A session plan/mode events=${String(transcriptA?.eventTypes?.['plan/mode'] ?? 0)}` },
      { id: 'turn-continued', ok: (transcriptA?.calls ?? []).some((c) => String(c.callId) === CALL_PRESENT_IN), detail: 'the next probe ran after this call' },
    ],
  )
}

/**
 * The `present` arm. `present` stats files through the BASE `fs` (it injects
 * `fs` on the registry generation scope), so on the pre-fix tree it is an
 * out-of-lane EXISTENCE ORACLE with zero a5sf facts. Post-fix the row is gone
 * and every call is the router's typed `unknown tool`.
 */
function judgePresent({ expect, presentIn, presentOut, presentMissing, presentFacts, transcriptA }) {
  const outText = resultText(presentOut)
  const inText = resultText(presentIn)
  const presentedEvents = Number(transcriptA?.eventTypes?.['deliverables/presented'] ?? 0)
  if (expect === 'prefix') {
    return verdictOf(
      'PRE-FIX (defect): `present` stats an out-of-lane path through the BASE `fs` — a real file is accepted with ZERO guard facts and a `deliverables/presented` event, and an absent one is refused with `file not found`, so the tool is an unconfined existence oracle above the lane',
      [
        { id: 'present-on-surface', ok: presentIn.call !== null, detail: 'the Member issued `present`' },
        { id: 'in-lane-accepted', ok: isErrorResult(presentIn) === false && inText.includes(IN_LANE_FILE), detail: `isError=${String(isErrorResult(presentIn))} text=${inText.slice(0, 160)}` },
        { id: 'out-of-lane-accepted', ok: isErrorResult(presentOut) === false && outText.includes(SECRET_FILE), detail: `isError=${String(isErrorResult(presentOut))} text=${outText.slice(0, 200)}` },
        { id: 'zero-present-facts', ok: Number(presentFacts) === 0, detail: `present-attributed guard facts=${String(presentFacts)} (a confined stat would record one)` },
        { id: 'deliverables-event-in-session', ok: presentedEvents > 0, detail: `A session deliverables/presented events=${String(presentedEvents)}` },
        { id: 'missing-out-of-lane-is-existence-oracle', ok: isErrorResult(presentMissing) && /file not found|FS_NOT_FOUND|not found/iu.test(resultText(presentMissing)), detail: `isError=${String(isErrorResult(presentMissing))} text=${resultText(presentMissing).slice(0, 200)}` },
      ],
    )
  }
  return verdictOf(
    'a governed Member can no longer stat a path above its lane: `present` is ABSENT, all three calls are the router\'s typed `unknown tool "present"`, no `deliverables/presented` event is appended and no guard fact exists',
    [
      { id: 'in-lane-typed-refusal', ok: typedUnknown(presentIn, 'present'), detail: `isError=${String(isErrorResult(presentIn))} text=${inText.slice(0, 160)}` },
      { id: 'out-of-lane-typed-refusal', ok: typedUnknown(presentOut, 'present'), detail: `isError=${String(isErrorResult(presentOut))} text=${outText.slice(0, 160)}` },
      { id: 'missing-typed-refusal', ok: typedUnknown(presentMissing, 'present'), detail: `isError=${String(isErrorResult(presentMissing))} text=${resultText(presentMissing).slice(0, 160)}` },
      { id: 'zero-out-of-lane-bytes', ok: outText.includes(SECRET_TEXT) === false, detail: 'no result carries out-of-lane bytes' },
      { id: 'no-deliverables-event', ok: presentedEvents === 0, detail: `A session deliverables/presented events=${String(presentedEvents)}` },
      { id: 'zero-present-facts', ok: Number(presentFacts) === 0, detail: `present-attributed guard facts=${String(presentFacts)}` },
    ],
  )
}

function judgeFixtures({ canary, u6fs, factTools }) {
  return verdictOf(
    'the two World-composition FIXTURES (`u5_canary`, `u6fs_probe`) are callable and execute OUTSIDE any a5sf face (zero facts). They are NOT shipped tool names: they are test instrumentation the World mounts beside the preset, disclosed and excluded from the shipped roster',
    [
      { id: 'canary-issued', ok: canary.call !== null, detail: 'the Member issued `u5_canary`' },
      { id: 'canary-executed', ok: isErrorResult(canary) === false, detail: `isError=${String(isErrorResult(canary))} text=${resultText(canary).slice(0, 160)}` },
      { id: 'u6fs-issued', ok: u6fs.call !== null, detail: 'the Member issued `u6fs_probe`' },
      { id: 'u6fs-executed', ok: isErrorResult(u6fs) === false, detail: `isError=${String(isErrorResult(u6fs))} text=${resultText(u6fs).slice(0, 160)}` },
      { id: 'zero-fixture-facts', ok: Number(factTools?.u5_canary ?? 0) === 0 && Number(factTools?.u6fs_probe ?? 0) === 0, detail: `fixture facts=${JSON.stringify({ canary: factTools?.u5_canary ?? 0, probe: factTools?.u6fs_probe ?? 0 })}` },
    ],
  )
}

function judgeFailClosed({ expect, probes }) {
  const clauses = []
  const names = expect === 'prefix' ? REMOVED_NAMES : FAIL_CLOSED_NAMES
  for (const name of names) {
    const p = probes.closed[name]
    clauses.push({
      id: `closed-${name}`,
      ok: typedUnknown(p, name),
      detail: `isError=${String(isErrorResult(p))} text=${resultText(p).slice(0, 140)}`,
    })
  }
  if (expect === 'prefix') {
    const p = probes.closed.present
    clauses.push({
      id: 'pre-fix-present-is-NOT-unknown',
      ok: isErrorResult(p) && /unknown tool "present"/u.test(resultText(p)) === false,
      detail: `isError=${String(isErrorResult(p))} text=${resultText(p).slice(0, 160)} (the pre-fix row is dispatched, so it is not the router's unknown-tool path)`,
    })
  }
  return verdictOf(
    expect === 'prefix'
      ? 'the ten names removed by PD-18/21/22/23 answer the host router\'s typed `unknown tool`, while `present` is still DISPATCHED (the pre-fix state this lane closes)'
      : 'every fail-closed name answers the host router\'s typed `unknown tool "<name>"` and executes nothing — the whole removed set in ONE Member turn',
    clauses,
  )
}

/**
 * The goal arm, LIMITED to what PD-24 owns: CAN a Member create a goal, and does
 * the self-continuation loop START inside the Member's OWN session? The
 * `roundsStarted` counter is read from `get_goal` DURING a `<goal_round>`
 * request; goal semantics are not touched (PD-25).
 */
function judgeGoal({ goalCreate, goalRoundGet, goalComplete, goalEventsBySession, sessionA, goalRoundRequests, goalRoundsInOtherSessions }) {
  const createText = resultText(goalCreate)
  const goalId = /"id":"(goal-[^"]+)"/u.exec(createText)?.[1] ?? null
  const roundText = resultText(goalRoundGet)
  const roundsStarted = Number(/"roundsStarted"\s*:\s*(\d+)/u.exec(roundText)?.[1] ?? -1)
  const roundGoalId = /"id":"(goal-[^"]+)"/u.exec(roundText)?.[1] ?? null
  const aGoal = Number(goalEventsBySession?.[String(sessionA)]?.goalEvents ?? 0)
  const others = Object.entries(goalEventsBySession ?? {})
    .filter(([id]) => String(id) !== String(sessionA))
    .filter(([, v]) => Number(v?.goalEvents ?? 0) > 0)
    .map(([id]) => id)
  return verdictOf(
    'the goal tools are SESSION-LOCAL and the self-continuation loop REALLY STARTS: `create_goal` is accepted in the Member\'s own session, a `<goal_round>` request arrives in that same session with `roundsStarted` grown to 1, `update_goal complete` closes it, and no other session holds any goal state or goal round',
    [
      { id: 'create-issued', ok: goalCreate.call !== null, detail: 'the Member issued `create_goal`' },
      { id: 'create-accepted', ok: isErrorResult(goalCreate) === false && goalId !== null, detail: `goal id=${String(goalId)} text=${createText.slice(0, 200)}` },
      { id: 'goal-state-in-a-session', ok: aGoal > 0, detail: `A goal events=${String(aGoal)}` },
      { id: 'no-goal-state-elsewhere', ok: others.length === 0, detail: `sessions with goal state other than A: ${JSON.stringify(others)}` },
      { id: 'round-request-in-a-session', ok: goalRoundRequests > 0, detail: `A requests carrying <goal_round>=${String(goalRoundRequests)}` },
      { id: 'rounds-started-grew', ok: roundsStarted >= 1, detail: `roundsStarted read from get_goal during the round=${String(roundsStarted)}` },
      { id: 'same-goal-in-round', ok: roundGoalId !== null && roundGoalId === goalId, detail: `round goal id=${String(roundGoalId)} create goal id=${String(goalId)}` },
      { id: 'complete-accepted', ok: isErrorResult(goalComplete) === false && resultText(goalComplete).includes(String(goalId)), detail: `isError=${String(isErrorResult(goalComplete))} text=${resultText(goalComplete).slice(0, 200)}` },
      { id: 'no-goal-round-in-other-sessions', ok: goalRoundsInOtherSessions === 0, detail: `goal-round requests in other sessions=${String(goalRoundsInOtherSessions)}` },
    ],
  )
}

function judgeNoNewMembers({ membersAfter, templates }) {
  const list = Array.isArray(templates) ? templates.slice().sort() : []
  return verdictOf(
    'the Member turn establishes no Team-level state and mints no member: the roster is exactly the Leader plus the one template the Leader created',
    [
      { id: 'roster-size-two', ok: membersAfter === 2, detail: `members after=${String(membersAfter)} (leader + worker)` },
      { id: 'templates-are-the-two', ok: list.join(',') === 'leader,worker', detail: `templates=${list.join(',')}` },
    ],
  )
}

function transcriptText(transcript) {
  if (transcript === null || transcript === undefined) return ''
  return [
    ...(transcript.user ?? []),
    ...(transcript.calls ?? []).map((c) => `${String(c.name)}\n${JSON.stringify(c.arguments ?? null)}\n${String(c.result?.text ?? '')}`),
    ...(transcript.assistant ?? []),
  ].join('\n')
}

function judgeNoLaneBytes({ requestsCarryingSecret, transcriptA }) {
  const aText = transcriptText(transcriptA)
  return verdictOf(
    'ZERO out-of-lane bytes reach any model request or the Member\'s durable turn',
    [
      { id: 'zero-requests-with-secret', ok: requestsCarryingSecret === 0, detail: `mock requests carrying the FILE secret=${String(requestsCarryingSecret)}` },
      { id: 'zero-a-transcript-bytes', ok: aText.includes(SECRET_TEXT) === false, detail: 'the Member\'s own durable turn carries no out-of-lane bytes' },
    ],
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// plan (host-free)
// ─────────────────────────────────────────────────────────────────────────────
function planOnly() {
  const layer = shippedLayer()
  log(`PLAN repo=${REPO_ROOT} hostTree=${HOST_TREE} pin=${TEST_USE_BASELINE_SHA}`)
  log(`composition=${COMPOSITION_PATH} sha256=${sha256(COMPOSITION_PATH)}`)
  log(`shipped !!js substitutions: ${JSON.stringify(layer.jsSubstitutions)}`)
  const anchor = anchorBlueprintYaml()
  const main = mainBlueprintYaml({ workspace: join(EVIDENCE, 'plan-workspace') })
  const a = assertBlueprintText(anchor, BP_ANCHOR_ID, 'anchor.yaml')
  const m = assertBlueprintText(main, BP_MAIN_ID, 'main.yaml')
  log(`blueprints accepted: anchor=${JSON.stringify(a)} main=${JSON.stringify(m)}`)
  const rows = composedRows({ home: join(EVIDENCE, 'plan-home'), anchorYaml: anchor, layer })
  writeFileSync(join(EVIDENCE, 'plan-patch.yml'), emitPatchLayer(['a5sf-pd24-surface-ledger plan (no World)'], rows) + '\n')
  log(`rows: ${JSON.stringify(rows.map((r) => ({ id: r.id, name: String(r.name).slice(0, 80) })))}`)
  const plugins = presetPluginIds(layer)
  log(`governed preset plugins (${String(plugins.length)}): ${plugins.join(',')}`)
  for (const required of ['tool-bash', 'tool-fs', 'tool-fs-search', 'tool-jobs', 'tool-goal', 'tool-todo', 'tool-ask-user', 'plan-mode']) {
    if (!plugins.includes(required)) throw new Error(`the shipped governed preset lost '${required}'`)
  }
  if (plugins.includes('tool-pwsh')) throw new Error('the shipped governed preset unexpectedly carries tool-pwsh')
  const controlRows = plugins.filter((p) => ['tool-subagent-control', 'tool-subagent-list-agents', 'tool-subagent', 'tool-subagent-fork'].includes(p))
  const skillRows = plugins.filter((p) => p === 'tool-skill' || p === 'skill-filesystem')
  const webRows = plugins.filter((p) => p === 'tool-web' || p === 'tool-workflow' || p === 'workflow-ptc')
  const presentRows = plugins.filter((p) => p === 'present')
  log(`governed preset control rows: ${JSON.stringify(controlRows)}`)
  log(`governed preset skill rows: ${JSON.stringify(skillRows)}`)
  log(`governed preset web/ptc rows: ${JSON.stringify(webRows)}`)
  log(`governed preset present rows: ${JSON.stringify(presentRows)}`)
  log('PLAN OK')
}

// ─────────────────────────────────────────────────────────────────────────────
// one boot
// ─────────────────────────────────────────────────────────────────────────────
function memberOf(state, templateId) {
  const members = Array.isArray(state?.body?.members) ? state.body.members : []
  return members.find((m) => String(m?.templateId ?? '') === templateId) ?? null
}
function derivedChildSessionId(rootSessionId, instanceId) {
  if (instanceId === null || instanceId === undefined) return null
  const digest = createHash('sha256').update(`${String(rootSessionId)}\u0000${String(instanceId)}`, 'utf8').digest('hex')
  return `session-team-child-${digest.slice(0, 32)}`
}

async function bootOnce({ index, head, authorization, layer, composition }) {
  const bootDir = join(RUNS, `boot${String(index).padStart(2, '0')}`)
  mkdirSync(bootDir, { recursive: true })
  const phase = `a5sf-pd24-surface-ledger-${ARM}-boot${String(index)}`
  const runId = `a5sf-pd24-surface-ledger-${ARM}-${utcStamp()}-b${String(index)}`
  const record = createRunRecord({
    runId, suite: 'a5sf-pd24-surface-ledger', selectedCases: ASK_ARM ? ASK_CASES : SELECTED_CASES,
    bindings: runBindings(head, authorization), ledgerPath: LEDGER_PATH, recordClass: 'DEV-LIVE',
  })
  const harness = createA5sfHarness({
    repoRoot: REPO_ROOT, evidenceRoot: join(EVIDENCE, 'driver'), suite: 'a5sf-pd24-surface-ledger', line: LINE,
    runRecord: record, hostTree: HOST_TREE,
  })
  const factory = harness.factory
  log(`[boot${String(index)}] candidate: ${JSON.stringify(harness.assertCandidate())}`)
  const slot = acquireDevLiveSlot({
    leaseRoot: factory.leaseRoot,
    runId: String(record.record.runId),
    face: 'SurfaceLedger',
    world: LINE,
    headCommit: head,
  })
  log(`[boot${String(index)}] dev-live slot #${String(slot.slot)} face=SurfaceLedger world=${LINE} head=${head}`)

  let world = null
  let bootInfo = null
  let teardown = null
  let failure = null
  let abortStage = 'pre-boot'
  let paths = null
  let collectDiagnostics = () => ({})
  const counters = {}
  let result = null
  try {
    bootInfo = await (async () => {
      world = await harness.createWorld({ line: LINE, u6Fs: { rows: [] } })
      log(`[boot${String(index)}] world=${world.id} home=${world.home}`)
      mkdirSync(join(world.home, 'blueprints'), { recursive: true })
      const workspace = world.workspaceDir
      const inLanePath = join(workspace, IN_LANE_FILE)
      const outsideDir = join(world.home, 'out-of-lane')
      mkdirSync(outsideDir, { recursive: true })
      const secretPath = join(outsideDir, SECRET_FILE)
      writeFileSync(inLanePath, `${IN_LANE_TEXT}\n`, 'utf8')
      writeFileSync(secretPath, `${SECRET_TEXT}\n`, 'utf8')
      writeFileSync(join(workspace, EDITED_FILE), `${IN_LANE_TEXT} seed\n`, 'utf8')
      // A 1x1 PNG so `read_image` has a REAL image file to be pointed at.
      writeFileSync(join(workspace, IMAGE_FILE), Buffer.from(
        'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
        'base64',
      ))
      writeFileSync(join(world.home, 'p6t6-directive.json'), JSON.stringify(p6t6Directive({ worldId: world.id, logDir: world.logDir }), null, 2) + '\n')

      const anchor = anchorBlueprintYaml()
      writeFileSync(join(world.home, 'blueprints', 'anchor.yaml'), anchor)
      const rows = composedRows({ home: world.home, anchorYaml: anchor, layer })
      world.u6Fs.rows.push(...rows)
      log(`[boot${String(index)}] rows: ${rows.map((r) => r.id).join(',')}`)

      const decide = makeDecide({ workspaceDir: workspace })
      process.env.A5SF_GOVERNED_SCRATCH = join(world.home, 'governed-scratch')
      mkdirSync(process.env.A5SF_GOVERNED_SCRATCH, { recursive: true })
      await world.startMock({ decide })
      log(`[boot${String(index)}] mock on ${String(world.mock?.port)}`)
      return await harness.boot({ world, phase, bootTimeoutMs: 300_000 })
    })()
    abortStage = 'composition'
    paths = {
      workspace: world.workspaceDir,
      inLane: join(world.workspaceDir, IN_LANE_FILE),
      secret: join(world.home, 'out-of-lane', SECRET_FILE),
      sink: join(world.home, 'a5sf-consult.jsonl'),
    }
    log(`[boot${String(index)}] BOOTED port=${bootInfo.port} log=${bootInfo.logPath}`)
    record.record.boots = [{ phase, world: world.id, port: bootInfo.port, logPath: bootInfo.logPath }]
    record.record.bindings = { ...record.record.bindings, worldIds: [world.id] }

    const origin = `http://127.0.0.1:${bootInfo.port}`
    const cookie = await authenticate(origin, world.token)
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
    }, 150_000)
    log(`[boot${String(index)}] p6t6 health=${String(healthOk)}`)
    if (!healthOk) throw new Error('the p6t6 harness route never answered: the World did not reach a usable Host')

    const procLog = []
    const otherBwrapPids = new Set()
    const memberWindowFrom = new Date().toISOString()
    const watcher = setInterval(() => {
      try {
        const hits = scanProc({ inLanePath: paths.inLane, secretPath: paths.secret })
        const kept = []
        for (const hit of hits) {
          if (hit.marker === 'base-bwrap' && hit.inLane !== true && hit.secret !== true) { otherBwrapPids.add(hit.pid); continue }
          kept.push(hit)
        }
        if (kept.length > 0) procLog.push({ at: new Date().toISOString(), hits: kept })
      } catch { /* observation must never break the run */ }
    }, 40)

    // ── discovery turn: the REAL Leader surface (composition fact) ─────────
    abortStage = 'discovery'
    await apiPrompt(origin, cookie, BOOT_ROOT, MK_DISC, 'a5sfpd24')
    await waitFor(() => (world.mock?.requests ?? []).some((r) => String(r.reply?.content ?? '').startsWith('A5SF_PD24_DISC_DONE')), 60_000)
    const discRequest = (world.mock?.requests ?? []).filter((r) => surfaceNamesOf(r).length > 0).at(-1) ?? null
    const leaderSurface = discRequest === null ? [] : [...new Set(surfaceNamesOf(discRequest))].sort()
    log(`[boot${String(index)}] leader surface (${String(leaderSurface.length)}): ${leaderSurface.join(',')}`)
    writeFileSync(join(bootDir, 'leader-surface.json'), JSON.stringify({ at: new Date().toISOString(), tools: leaderSurface }, null, 2) + '\n')
    const mainText = mainBlueprintYaml({ workspace: paths.workspace })
    assertBlueprintText(mainText, BP_MAIN_ID, 'main.yaml')
    writeFileSync(join(world.home, 'blueprints', 'main.yaml'), mainText)

    collectDiagnostics = (label) => {
      const out = {}
      const requestsNow = world?.mock?.requests ?? []
      out.mockRequests = requestsNow.map((r, i) => ({
        seq: i,
        lastUser: lastUserTextOfStatic(r).slice(0, 600),
        isARequest: isARequest(r),
        tools: surfaceNamesOf(r).length,
        reply: typeof r.reply === 'object' ? JSON.stringify(r.reply).slice(0, 400) : String(r.reply ?? '').slice(0, 400),
      }))
      try { out.hostLogTail = redact(readFileSync(bootInfo.logPath, 'utf8').split('\n').slice(-100).join('\n')) } catch { out.hostLogTail = '<absent>' }
      try { out.guardFacts = parseJsonl(paths.sink) } catch { out.guardFacts = [] }
      out.counters = { ...counters, procBatches: procLog.length }
      writeFileSync(join(bootDir, `diagnostics-${label}.json`), JSON.stringify(out, null, 2) + '\n')
      try { writeFileSync(join(bootDir, `host-log-${label}.log`), out.hostLogTail + '\n') } catch { /* best effort */ }
      log(`[boot${String(index)}] diagnostics(${label}): mockRequests=${String(out.mockRequests.length)}`)
      return out
    }
    // ── team.create: one Leader turn starts a job and creates the Member ───
    abortStage = 'team-create'
    const created = await remoteCallLong(fetchJson, origin, cookie, 'team.create', {
      rootSessionId: ACCEPTANCE_ROOT, blueprintId: BP_MAIN_ID, initialWork: { prompt: MK_L1 },
    }, 'a5sfpd24')
    const createOk = created.status === 200 && created.body?.result?.ok === true
    log(`[boot${String(index)}] team.create status=${String(created.status)} ok=${String(createOk)} ${redact(JSON.stringify(created.body ?? null)).slice(0, 400)}`)
    if (!createOk) throw new Error(`team.create failed: status=${String(created.status)} body=${redact(JSON.stringify(created.body ?? null)).slice(0, 400)}`)

    // ── ASK ARM: the call is ISSUED, and the evidence is that it never settles ─
    if (ASK_ARM) {
      abortStage = 'ask-arm'
      const state0 = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000).catch(() => null)
      const members0 = Array.isArray(state0?.body?.members) ? state0.body.members : []
      const member0 = memberOf(state0, 'worker')
      const sessionAsk = member0?.childSessionId ?? derivedChildSessionId(ACCEPTANCE_ROOT, member0?.instanceId)
      // Wait for the ask CALL to appear in the Member's durable session.
      const askSeen = await waitFor(() => {
        const t = sessionAsk === null ? null : readMemberTranscript(world.home, sessionAsk)
        return t !== null && (t.calls ?? []).some((c) => String(c.callId) === CALL_ASK)
      }, 180_000, 1000)
      const askWindowMs = Number(process.env.A5SF_PD24_ASK_WINDOW_MS ?? 60_000)
      log(`[boot${String(index)}] ASK call issued=${String(askSeen)}; holding ${String(askWindowMs)} ms to see whether it settles`)
      await new Promise((r) => setTimeout(r, Number.isFinite(askWindowMs) && askWindowMs > 0 ? askWindowMs : 60_000))
      clearInterval(watcher)
      const transcriptAsk = sessionAsk === null ? null : readMemberTranscript(world.home, sessionAsk)
      const askCall = (transcriptAsk?.calls ?? []).find((c) => String(c.callId) === CALL_ASK) ?? null
      const askResult = askCall?.result ?? null
      const turnEnded = Number(transcriptAsk?.eventTypes?.['turn/end'] ?? 0) > 0
      const bashResult = (transcriptAsk?.calls ?? []).find((c) => String(c.callId) === CALL_BASH)?.result ?? null
      const verdict = verdictOf(
        '`ask_user_question` BLOCKS a delegated governed Member turn: the call is issued, NO result arrives inside a 60 s window, no `turn/end` is recorded, and the Member\'s own session is still open (its Leader/Team state is untouched)',
        [
          { id: 'control-ran', ok: bashResult !== null && bashResult.isError === false, detail: `the in-lane bash control settled first (isError=${String(bashResult?.isError)})` },
          { id: 'ask-call-issued', ok: askCall !== null, detail: 'the Member issued `ask_user_question`' },
          { id: 'no-tool-result', ok: askResult === null, detail: 'no tool result was recorded for the ask call' },
          { id: 'turn-still-open', ok: turnEnded === false, detail: `turn/end events=${String(transcriptAsk?.eventTypes?.['turn/end'])}` },
          { id: 'team-state-untouched', ok: members0.length === 2, detail: `members=${String(members0.length)} (leader + worker; the ask wrote no Team state)` },
          { id: 'no-question-event', ok: Number(transcriptAsk?.eventTypes?.['user/questions'] ?? 0) === 0, detail: `user/questions events=${String(transcriptAsk?.eventTypes?.['user/questions'] ?? 0)}` },
        ],
      )
      writeFileSync(join(bootDir, 'ask-blocked.json'), JSON.stringify({
        schema: 'a5sf-pd24-surface-ledger/ask-blocked/1',
        at: new Date().toISOString(),
        memberSession: sessionAsk,
        windowMs: askWindowMs,
        call: askCall,
        result: askResult,
        turnEnded,
        eventTypes: transcriptAsk?.eventTypes ?? null,
        bashControl: bashResult,
        note: 'the ask call never settles: legacy mode has no timeout, and a delegated turn has no human answerer; the 60 s hold is the observation window, not a product timeout',
      }, null, 2) + '\n')
      if (transcriptAsk !== null) {
        writeFileSync(join(bootDir, 'member-transcript.json'), JSON.stringify(transcriptAsk, null, 2) + '\n')
        writeFileSync(join(bootDir, 'member-transcript.txt'), renderTranscript(transcriptAsk) + '\n')
        try { writeFileSync(join(bootDir, 'member-session.v4.jsonl.zstd'), readFileSync(transcriptAsk.file)) } catch { /* normalised copy is the evidence */ }
      }
      writeFileSync(join(bootDir, 'member-surface.json'), JSON.stringify({
        tools: (() => {
          const ra = (world.mock?.requests ?? []).filter((r) => isARequest(r) && surfaceNamesOf(r).length > 0).at(-1) ?? null
          return ra === null ? [] : [...new Set(surfaceNamesOf(ra))].sort()
        })(),
      }, null, 2) + '\n')
      counters.surfaceACount = (world.mock?.requests ?? []).filter((r) => isARequest(r) && surfaceNamesOf(r).length > 0).length
      counters.membersAfter = members0.length
      counters.askWindowMs = askWindowMs
      counters.askSettled = askResult !== null
      counters.turnEnded = turnEnded
      writeFileSync(join(bootDir, 'counters.json'), JSON.stringify(counters, null, 2) + '\n')
      // NOTE: the third argument is SPREAD into the case object, so passing the
      // clause verdict itself would overwrite `verdict` with `PROVEN` (a clause
      // verdict, not a RUN verdict). Pass only the clause detail.
      record.addCase('pd24:ask-blocks-delegated-turn', verdict.verdict === 'PROVEN' ? 'PASS' : 'FAIL', {
        proposition: verdict.proposition, clauses: verdict.clauses, failed: verdict.failed,
      })
      log(`[boot${String(index)}] case pd24:ask-blocks-delegated-turn: ${verdict.verdict}`)
      collectDiagnostics('final')
      const final = record.finalize()
      writeFileSync(join(bootDir, 'run-record.json'), JSON.stringify(final, null, 2) + '\n')
      writeFileSync(join(bootDir, 'summary.txt'), formatSummary(final) + '\n')
      log(`[boot${String(index)}] ${formatSummary(final)}`)
      result = {
        boot: index, arm: ARM, worldId: world.id, port: bootInfo.port, runId,
        summary: formatSummary(final), overall: final.overall, sessionA: sessionAsk,
        transcriptA: transcriptAsk === null ? null : {
          sessionId: transcriptAsk.sessionId, lineCount: transcriptAsk.lineCount,
          eventTypes: transcriptAsk.eventTypes, calls: transcriptAsk.calls,
          finalAssistant: transcriptAsk.finalAssistant, user: transcriptAsk.user,
        },
        counters, facts: [], verdicts: { askBlocks: verdict }, paths,
      }
      return result
    }

    const chainTimeoutMs = Number(process.env.A5SF_PD24_CHAIN_TIMEOUT_MS ?? 420_000)
    const chainDeadline = Date.now() + (Number.isFinite(chainTimeoutMs) && chainTimeoutMs > 0 ? chainTimeoutMs : 420_000)
    let chainOk = false
    for (;;) {
      chainOk = (world.mock?.requests ?? []).some((r) => String(r.reply?.content ?? '').startsWith(DONE_L1))
      if (chainOk || Date.now() > chainDeadline) break
      await new Promise((r) => setTimeout(r, 500))
    }
    log(`[boot${String(index)}] leader chain closed (${DONE_L1})=${String(chainOk)}`)
    if (!chainOk) {
      collectDiagnostics('chain-timeout')
      throw new Error('the Leader chain never closed: the Member turn did not settle')
    }
    const memberWindowTo = new Date().toISOString()
    clearInterval(watcher)
    await new Promise((r) => setTimeout(r, 1200))
    // The goal loop may still be settling; wait for the mock to go QUIET so the
    // collected turn is the settled one and not a mid-loop slice.
    const quiesced = await (async () => {
      const t0 = Date.now()
      for (;;) {
        const n = (world.mock?.requests ?? []).length
        await new Promise((r) => setTimeout(r, 2000))
        if ((world.mock?.requests ?? []).length === n) return true
        if (Date.now() - t0 > 180_000) return false
      }
    })()
    log(`[boot${String(index)}] mock quiesced=${String(quiesced)}`)
    abortStage = 'evidence-collection'

    const requests = world.mock?.requests ?? []
    const callOf = (id) => toolCallFor(requests, id)
    const resultOf = (id) => toolResultFor(requests, id)
    const leaderJobResult = resultOf(CALL_LEADER_JOB)
    const leaderJob = (() => {
      const text = String(leaderJobResult?.text ?? '')
      return /started background job ([A-Za-z0-9:_-]+)/u.exec(text)?.[1]
        ?? /"jobId"\s*:\s*"([^"]+)"/u.exec(text)?.[1] ?? null
    })()
    writeFileSync(join(bootDir, 'leader-job.json'), JSON.stringify({ call: callOf(CALL_LEADER_JOB), result: leaderJobResult ?? null, jobId: leaderJob }, null, 2) + '\n')
    log(`[boot${String(index)}] leader background job=${String(leaderJob)}`)

    const state = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000).catch(() => null)
    const members = Array.isArray(state?.body?.members) ? state.body.members : []
    const memberA = memberOf(state, 'worker')
    const sessionA = memberA?.childSessionId ?? derivedChildSessionId(ACCEPTANCE_ROOT, memberA?.instanceId)
    log(`[boot${String(index)}] members=${JSON.stringify(members.map((m) => ({ instanceId: m.instanceId, templateId: m.templateId, lifecycle: m.lifecycle })))} A=${String(sessionA)}`)

    const transcriptA = sessionA === null ? null : readMemberTranscript(world.home, sessionA)
    if (transcriptA !== null) {
      writeFileSync(join(bootDir, 'member-transcript.json'), JSON.stringify(transcriptA, null, 2) + '\n')
      writeFileSync(join(bootDir, 'member-transcript.txt'), renderTranscript(transcriptA) + '\n')
      try { writeFileSync(join(bootDir, 'member-session.v4.jsonl.zstd'), readFileSync(transcriptA.file)) } catch { /* normalised copy is the evidence */ }
    }

    const ownA = (id) => transcriptA?.calls.find((c) => String(c.callId) === String(id)) ?? null
    const probe = (id) => ({ call: callOf(id), result: ownA(id)?.result ?? resultOf(id) ?? null })
    const probes = {
      bash: probe(CALL_BASH),
      read: probe(CALL_READ),
      write: probe(CALL_WRITE),
      edit: probe(CALL_EDIT),
      grep: probe(CALL_GREP),
      glob: probe(CALL_GLOB),
      readImage: probe(CALL_READ_IMAGE),
      jobList: probe(CALL_JOB_LIST),
      jobForeign: probe(CALL_JOB_FOREIGN),
      jobKill: probe(CALL_JOB_KILL),
      todo: probe(CALL_TODO),
      goalGet: probe(CALL_GOAL_GET),
      exitPlan: probe(CALL_EXIT_PLAN),
      presentIn: probe(CALL_PRESENT_IN),
      presentOut: probe(CALL_PRESENT_OUT),
      presentMissing: probe(CALL_PRESENT_MISSING),
      canary: probe(CALL_CANARY),
      u6fs: probe(CALL_U6FS),
      goalCreate: probe(CALL_GOAL_CREATE),
      goalRoundGet: probe(CALL_GOAL_ROUND_GET),
      goalComplete: probe(CALL_GOAL_COMPLETE),
      closed: Object.fromEntries(FAIL_CLOSED_NAMES.map((n) => [n, probe(`call-a5sfpd24-closed-${n}`)])),
    }
    writeFileSync(join(bootDir, 'member-probes.json'), JSON.stringify({
      schema: 'a5sf-pd24-surface-ledger/member-probes/1',
      at: new Date().toISOString(),
      note: 'every Member-A surface call and the result the Member actually received (durable session first, mock transcript fallback)',
      probes,
    }, null, 2) + '\n')

    // ── surfaces ───────────────────────────────────────────────────────────
    const surfaceEntry = (request, name) => {
      if (request === null) return null
      const schema = (request.body?.tools ?? []).find((t) => String(t?.name ?? t?.function?.name ?? '') === name)
      if (schema === undefined) return null
      const fn = schema?.function ?? null
      const params = schema?.parameters ?? fn?.parameters ?? schema?.input_schema ?? schema?.inputSchema ?? null
      return { name, description: schema?.description ?? fn?.description ?? null, parameters: params }
    }
    const requestA = requests.filter((r) => isARequest(r) && surfaceNamesOf(r).length > 0).at(-1) ?? null
    const surfaceANames = requestA === null ? [] : [...new Set(surfaceNamesOf(requestA))].sort()
    const surfaceA = {
      tools: surfaceANames,
      entries: Object.fromEntries(surfaceANames.map((n) => [n, surfaceEntry(requestA, n)])),
      requestSeq: requestA === null ? null : requests.indexOf(requestA),
    }
    writeFileSync(join(bootDir, 'member-surface.json'), JSON.stringify(surfaceA, null, 2) + '\n')

    // ── guard facts (PD-19 attribution: tool + callId) ─────────────────────
    const factsAll = parseJsonl(paths.sink).filter((f) => f?.schema === 'a5sf-guard-consult/1')
    writeFileSync(join(bootDir, 'guard-facts.json'), JSON.stringify(factsAll, null, 2) + '\n')
    const factTools = {}
    for (const f of factsAll) factTools[String(f?.tool ?? '<none>')] = (factTools[String(f?.tool ?? '<none>')] ?? 0) + 1
    const presentFacts = factsAll.filter((f) => String(f?.tool ?? '') === 'present').length

    // ── independent /proc counters ─────────────────────────────────────────
    const sightingPids = (marker, filter = () => true) => {
      const pids = new Set()
      for (const batch of procLog) for (const hit of batch.hits) {
        if (hit.marker !== marker) continue
        if (filter(hit) === false) continue
        pids.add(hit.pid)
      }
      return pids
    }
    counters.confinedTurnLaunchers = sightingPids('confined-launcher', (h) => h.cmdline.includes('--confined-exec-stream')).size
    counters.baseBwrapWithMarkers = sightingPids('base-bwrap', (h) => h.inLane === true || h.secret === true).size
    counters.guardFacts = {
      allow: factsAll.filter((f) => f.decision === 'allow').length,
      deny: factsAll.filter((f) => f.decision === 'deny').length,
      byTool: factTools,
      present: presentFacts,
    }
    counters.mockRequests = requests.length
    counters.aModelRequests = requests.filter((r) => isARequest(r) && surfaceNamesOf(r).length > 0).length
    counters.surfaceACount = surfaceANames.length
    counters.surfaceANames = surfaceANames
    counters.requestsCarryingSecret = requests.filter((r) => JSON.stringify(r.body ?? r).includes(SECRET_TEXT)).length
    counters.sessionEvents = scanSessionEventTypes(world.home)
    counters.goalEventsBySession = counters.sessionEvents
    counters.goalRounds = requests.filter((r) => isARequest(r) && lastUserTextOfStatic(r).includes('<goal_round>')).length
    counters.goalRoundsInOtherSessions = requests.filter((r) => isARequest(r) === false && lastUserTextOfStatic(r).includes('<goal_round>')).length
    counters.membersAfter = members.length
    counters.memberTemplates = members.map((m) => String(m?.templateId ?? '')).sort()
    counters.memberWindow = { from: memberWindowFrom, to: memberWindowTo }
    counters.procBatches = procLog.length
    counters.otherBwrapPids = otherBwrapPids.size
    counters.composition = { path: composition.path, sha256: composition.sha256, arm: ARM }
    counters.leaderJob = leaderJob
    counters.quiesced = quiesced
    counters.presentOnSurface = surfaceANames.includes('present')
    writeFileSync(join(bootDir, 'counters.json'), JSON.stringify(counters, null, 2) + '\n')
    writeFileSync(join(bootDir, 'proc-observations.json'), JSON.stringify({
      schema: 'a5sf-pd24-surface-ledger/proc-observations/1', at: new Date().toISOString(),
      note: 'independent /proc/<pid>/cmdline scan; a sighting is an OS-level fact, not a product counter',
      sightings: procLog,
    }, null, 2) + '\n')

    // ── judges ─────────────────────────────────────────────────────────────
    const verdicts = {
      roster: judgeRoster({ expect: ARM, surfaceNames: surfaceANames, fixtures: ['u5_canary', 'u6fs_probe'], removed: FAIL_CLOSED_NAMES }),
      baseline: judgeBaseline(probes.bash),
      fsFamily: judgeFsFamily({
        read: probes.read, write: probes.write, edit: probes.edit, grep: probes.grep, glob: probes.glob,
        readImage: probes.readImage, factTools,
      }),
      jobs: judgeJobs({ jobList: probes.jobList, foreign: probes.jobForeign, kill: probes.jobKill, factTools }),
      todo: judgeTodo({
        todo: probes.todo, transcriptA, eventTypesAll: counters.sessionEvents, sessionA,
      }),
      exitPlan: judgeExitPlan({ exitPlan: probes.exitPlan, transcriptA }),
      present: judgePresent({
        expect: ARM, presentIn: probes.presentIn, presentOut: probes.presentOut,
        presentMissing: probes.presentMissing, presentFacts, transcriptA,
      }),
      fixtures: judgeFixtures({ canary: probes.canary, u6fs: probes.u6fs, factTools }),
      failClosed: judgeFailClosed({ expect: ARM, probes }),
      goal: judgeGoal({
        goalCreate: probes.goalCreate, goalRoundGet: probes.goalRoundGet, goalComplete: probes.goalComplete,
        goalEventsBySession: counters.goalEventsBySession, sessionA,
        goalRoundRequests: counters.goalRounds, goalRoundsInOtherSessions: counters.goalRoundsInOtherSessions,
      }),
      members: judgeNoNewMembers({ membersAfter: members.length, templates: counters.memberTemplates }),
      bytes: judgeNoLaneBytes({ requestsCarryingSecret: counters.requestsCarryingSecret, transcriptA }),
    }
    const add = (id, verdict, detail) => {
      const { verdict: _ignored, ...rest } = detail ?? {}
      const runVerdict = toRunVerdict(verdict)
      record.addCase(id, runVerdict, rest)
      log(`[boot${String(index)}] case ${id}: ${runVerdict}${verdict === 'PROVEN' ? '' : ` failed=${JSON.stringify(detail?.failed ?? [])}`}`)
    }
    add('pd24:surface-roster', verdicts.roster.verdict, verdicts.roster)
    add('pd24:confined-baseline', verdicts.baseline.verdict, verdicts.baseline)
    add('pd24:fs-family-live', verdicts.fsFamily.verdict, verdicts.fsFamily)
    add('pd24:jobs-owner-scoped', verdicts.jobs.verdict, verdicts.jobs)
    add('pd24:todo-session-local', verdicts.todo.verdict, verdicts.todo)
    add('pd24:exit-plan-refused', verdicts.exitPlan.verdict, verdicts.exitPlan)
    add('pd24:present-confined', verdicts.present.verdict, verdicts.present)
    add('pd24:fixtures-not-shipped', verdicts.fixtures.verdict, verdicts.fixtures)
    add('pd24:fail-closed-typed', verdicts.failClosed.verdict, verdicts.failClosed)
    add('pd24:goal-self-continuation-session-local', verdicts.goal.verdict, verdicts.goal)
    add('pd24:no-new-members', verdicts.members.verdict, verdicts.members)
    add('pd24:no-out-of-lane-bytes', verdicts.bytes.verdict, verdicts.bytes)

    collectDiagnostics('final')
    const final = record.finalize()
    const summary = formatSummary(final)
    writeFileSync(join(bootDir, 'run-record.json'), JSON.stringify(final, null, 2) + '\n')
    writeFileSync(join(bootDir, 'summary.txt'), summary + '\n')
    log(`[boot${String(index)}] ${summary}`)

    result = {
      boot: index, arm: ARM, worldId: world.id, port: bootInfo.port,
      runId, summary, overall: final.overall,
      sessionA,
      transcriptA: transcriptA === null ? null : {
        sessionId: transcriptA.sessionId, lineCount: transcriptA.lineCount, eventTypes: transcriptA.eventTypes,
        calls: transcriptA.calls, finalAssistant: transcriptA.finalAssistant, user: transcriptA.user,
      },
      counters, facts: factsAll, verdicts, paths,
    }
  } catch (error) {
    failure = error
    if (world !== null) {
      try { collectDiagnostics('abort') } catch (diagnosticError) { log(`[boot${String(index)}] diagnostics failed: ${String(diagnosticError?.message ?? diagnosticError)}`) }
    }
    record.markAborted({ stage: abortStage, detail: `boot ${String(index)} aborted at ${abortStage}`, error: String(error?.stack ?? error) })
    const final = record.finalize()
    writeFileSync(join(bootDir, 'run-record.json'), JSON.stringify(final, null, 2) + '\n')
    writeFileSync(join(bootDir, 'summary.txt'), formatSummary(final) + '\n')
    log(`[boot${String(index)}] FAILED at ${abortStage}: ${String(error?.stack ?? error)}`)
  } finally {
    if (world !== null) {
      try {
        teardown = await world.teardown({ keepHome: false })
        log(`[boot${String(index)}] teardown: ${JSON.stringify(teardown).slice(0, 600)}`)
      } catch (error) {
        log(`[boot${String(index)}] teardown failed: ${String(error?.message ?? error)}`)
      }
    }
    try {
      const released = await slot.release()
      log(`[boot${String(index)}] dev-live slot released (slot=${String(slot.slot)} state=${JSON.stringify(released ?? null)})`)
    } catch (error) {
      log(`[boot${String(index)}] SLOT RELEASE FAILED: ${String(error?.stack ?? error)}`)
      if (failure === null) { failure = error; abortStage = 'slot-release' }
    }
    const porcelain = hostPorcelain()
    writeFileSync(join(bootDir, 'teardown.json'), JSON.stringify({ at: new Date().toISOString(), teardown, hostTreePorcelain: porcelain }, null, 2) + '\n')
    if (porcelain.length > 0) log(`[boot${String(index)}] HOST TREE IS DIRTY: ${JSON.stringify(porcelain)}`)
  }
  if (failure !== null) return { boot: index, failed: true, stage: abortStage, error: String(failure?.message ?? failure), result }
  return result
}
function hostPorcelain() {
  try {
    return execFileSync('git', ['-C', HOST_TREE, 'status', '--porcelain'], { encoding: 'utf8' }).trim().split('\n').filter(Boolean)
  } catch { return ['git status failed'] }
}

function renderTranscript(transcript) {
  if (transcript === null) return 'NO MEMBER TRANSCRIPT (the Member session log was not found before teardown)'
  const out = []
  out.push(`# Member transcript — ${transcript.sessionId}`)
  out.push(`# durable log: ${transcript.file}`)
  out.push(`# event types: ${JSON.stringify(transcript.eventTypes)}`)
  out.push('')
  for (const u of transcript.user) {
    const text = u.trim()
    out.push('USER:', text.length <= 900 ? text : `${text.slice(0, 900)}\n… [rendered truncated at 900 chars; the full text is in member-transcript.json]`, '')
  }
  for (const call of transcript.calls) {
    const args = call.arguments ?? {}
    out.push(`TOOL CALL [${call.name}] ${String(call.callId)}`)
    const shown = JSON.stringify(args)
    out.push(`  arguments: ${shown.length <= 700 ? shown : `${shown.slice(0, 700)}…`}`)
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

function runBindings(head, authorization) {
  return {
    authority: readAuthorityBinding(REPO_ROOT),
    candidate: { head, hostSha: TEST_USE_BASELINE_SHA, baseline: TEST_USE_BASELINE_SHA },
    devLiveAuthorization: authorization,
    recordClass: 'DEV-LIVE',
    teamSha: head,
    hostSha: TEST_USE_BASELINE_SHA,
    note: 'DEV-LIVE: development evidence, never a candidate claim; candidateClaimEligibility is false by construction',
  }
}

function buildAgreement(results) {
  const ok = results.filter((r) => r?.failed !== true)
  const pick = (r) => ({
    arm: r?.arm ?? null,
    overall: r?.overall ?? null,
    rosterVerdict: r?.verdicts?.roster?.verdict ?? null,
    baselineVerdict: r?.verdicts?.baseline?.verdict ?? null,
    fsFamilyVerdict: r?.verdicts?.fsFamily?.verdict ?? null,
    jobsVerdict: r?.verdicts?.jobs?.verdict ?? null,
    todoVerdict: r?.verdicts?.todo?.verdict ?? null,
    askBlocksVerdict: r?.verdicts?.askBlocks?.verdict ?? null,
    exitPlanVerdict: r?.verdicts?.exitPlan?.verdict ?? null,
    presentVerdict: r?.verdicts?.present?.verdict ?? null,
    fixturesVerdict: r?.verdicts?.fixtures?.verdict ?? null,
    failClosedVerdict: r?.verdicts?.failClosed?.verdict ?? null,
    goalVerdict: r?.verdicts?.goal?.verdict ?? null,
    membersVerdict: r?.verdicts?.members?.verdict ?? null,
    bytesVerdict: r?.verdicts?.bytes?.verdict ?? null,
    surfaceACount: r?.counters?.surfaceACount ?? null,
    surfaceANames: (r?.counters?.surfaceANames ?? []).join(','),
    presentOnSurface: r?.counters?.presentOnSurface ?? null,
    goalRounds: r?.counters?.goalRounds ?? null,
    membersAfter: r?.counters?.membersAfter ?? null,
    guardAllow: r?.counters?.guardFacts?.allow ?? null,
    guardDeny: r?.counters?.guardFacts?.deny ?? null,
    guardPresent: r?.counters?.guardFacts?.present ?? null,
    factTools: JSON.stringify(r?.counters?.guardFacts?.byTool ?? null),
    requestsCarryingSecret: r?.counters?.requestsCarryingSecret ?? null,
    aModelRequests: r?.counters?.aModelRequests ?? null,
    confinedTurnLaunchers: r?.counters?.confinedTurnLaunchers ?? null,
    baseBwrapWithMarkers: r?.counters?.baseBwrapWithMarkers ?? null,
  })
  const rows = ok.map((r) => ({ boot: r.boot, ...pick(r) }))
  // PROC OBSERVATIONS are sighting counts of short-lived processes: they are
  // inherently racy (a launcher may exit before the sweep sees it) and are NOT
  // verdict inputs, so they are excluded from the AGREEMENT test and shown as
  // observations instead.
  const OBSERVATIONS = new Set(['confinedTurnLaunchers', 'baseBwrapWithMarkers'])
  const keys = Object.keys(pick({})).filter((k) => OBSERVATIONS.has(k) === false)
  const differing = keys.filter((k) => new Set(rows.map((r) => JSON.stringify(r[k]))).size > 1)
  const agreeing = rows.length >= 2 && differing.length === 0
  const header = ['fact', ...rows.map((r) => `boot${String(r.boot)}`)]
  const body = keys.map((k) => [k, ...rows.map((r) => String(r[k]))])
  const width = Math.max(28, ...header.map((h) => h.length)) + 2
  const cell = (v) => String(v).padEnd(width)
  const table = [
    `TWO-RUN AGREEMENT (${ARM} arm; the same command, two boots; every row must be identical)`,
    header.map(cell).join('').replace(/ +$/u, ''),
    ...body.map(([k, ...vals]) => `${cell(k)}${vals.map(cell).join('')}`.replace(/ +$/u, '')),
    '',
    `agreeing=${String(agreeing)} differing=${JSON.stringify(differing)}`,
  ].join('\n')
  return { schema: 'a5sf-pd24-surface-ledger/agreement/1', arm: ARM, at: new Date().toISOString(), boots: results.length, agreeing, differing, rows, table }
}

/** Archive-before-start: a previous arm directory is moved aside, never overwritten. */
function archivePriorRuns() {
  if (!existsSync(RUNS)) return null
  const entries = readdirSync(RUNS)
  if (entries.length === 0) return null
  const archiveRoot = join(EVIDENCE, 'archive')
  mkdirSync(archiveRoot, { recursive: true })
  const target = join(archiveRoot, `${ARM}-${utcStamp()}`)
  renameSync(RUNS, target)
  mkdirSync(RUNS, { recursive: true })
  return target
}

// ─────────────────────────────────────────────────────────────────────────────
// main
// ─────────────────────────────────────────────────────────────────────────────
async function main() {
  mkdirSync(EVIDENCE, { recursive: true })
  RUN_LOG = join(EVIDENCE, 'driver.log')
  if (PLAN_ONLY) { planOnly(); return }
  mkdirSync(RUNS, { recursive: true })

  const head = resolveHeadCommit(REPO_ROOT)
  if (head === null) throw new Error('git rev-parse HEAD failed: the start cannot be bound')
  const layer = shippedLayer()
  const composition = { path: COMPOSITION_PATH, sha256: sha256(COMPOSITION_PATH), arm: ARM }
  const authorization = {
    scope: 'DEV-LIVE', face: 'SurfaceLedger', world: LINE,
    source: `task PD24-SURFACE-LEDGER explicit boot authorisation (2026-11-14), arm=${ARM}`,
  }
  const archived = archivePriorRuns()
  log(`ARCHIVE: ${archived === null ? '(nothing to archive)' : archived}`)
  writeFileSync(join(EVIDENCE, `driver-digest-${ARM}.json`), JSON.stringify({
    at: startedAt, arm: ARM, head, hostTree: HOST_TREE, hostSha: hostDigest(), pin: TEST_USE_BASELINE_SHA,
    driverSha256: sha256(fileURLToPath(import.meta.url)), jsSubstitutions: layer.jsSubstitutions,
    composition, authorization,
    command: `node tests/world-factory/drivers/a5sf-pd24-surface-ledger/run-boot.mjs --arm ${ARM}${BOOTS_WANTED === 2 ? '' : ` --boots ${String(BOOTS_WANTED)}`}`,
  }, null, 2) + '\n')
  log(`START arm=${ARM} head=${head} composition=${composition.path} sha256=${composition.sha256} hostTree=${HOST_TREE} pin=${TEST_USE_BASELINE_SHA} boots=${String(BOOTS_WANTED)}`)
  log(`host porcelain before: ${JSON.stringify(hostPorcelain())}`)
  if (hostPorcelain().length !== 0) throw new Error('the pinned host tree is not clean (porcelain non-empty): refusing to boot')

  const results = []
  for (let i = 1; i <= BOOTS_WANTED; i += 1) {
    const r = await bootOnce({ index: i, head, authorization, layer, composition })
    results.push(r)
    if (r?.failed === true) {
      log(`boot ${String(i)} failed at ${String(r.stage)}; continuing is pointless (no agreeing pair)`)
      break
    }
  }

  const agreement = buildAgreement(results)
  // The agreement belongs to the ARM's run directory: writing every arm to the
  // evidence root means the last arm silently overwrites the earlier pair (that
  // is exactly what happened on the first pass). The root keeps a per-arm copy
  // for convenience, and the canonical file lives with the boots it compares.
  mkdirSync(RUNS, { recursive: true })
  writeFileSync(join(RUNS, 'agreement.json'), JSON.stringify(agreement, null, 2) + '\n')
  writeFileSync(join(RUNS, 'agreement.txt'), agreement.table + '\n')
  mkdirSync(EVIDENCE, { recursive: true })
  writeFileSync(join(EVIDENCE, `agreement-${ARM}.json`), JSON.stringify(agreement, null, 2) + '\n')
  writeFileSync(join(EVIDENCE, `agreement-${ARM}.txt`), agreement.table + '\n')
  log(agreement.table)
  const porcelain = hostPorcelain()
  writeFileSync(join(EVIDENCE, `host-tree-porcelain-${ARM}.txt`), porcelain.length === 0 ? 'empty\n' : porcelain.join('\n') + '\n')
  log(`host porcelain after: ${JSON.stringify(porcelain)}`)
  if (porcelain.length !== 0) process.exitCode = 1
  const allOk = results.length === BOOTS_WANTED && results.every((r) => r?.failed !== true && r?.overall === 'PASS')
  const pairOk = BOOTS_WANTED < 2 || agreement.agreeing === true
  log(`RESULT ${allOk ? 'PASS' : 'FAIL'} arm=${ARM} (${String(results.length)}/${String(BOOTS_WANTED)} boots; agreeing pair=${String(agreement.agreeing)})`)
  if (!allOk || !pairOk) process.exitCode = 1
}

function hostDigest() {
  try { return execFileSync('git', ['-C', HOST_TREE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() } catch { return null }
}

main().catch((error) => {
  log(`DRIVER FAILED (outside the run): ${String(error?.stack ?? error)}`)
  process.exitCode = 1
})
