#!/usr/bin/env node
/**
 * tests/world-factory/drivers/a5sf-pd25-unbounded-turn/run-boot.mjs — the LIVE
 * driver for PD-25: is there a TOTAL bound on what a governed Member can do?
 *
 * WHY THIS FILE EXISTS. Alpha.5 compiles a per-CALL ceiling
 * (`EffectiveIo(member, tool, call) ⊆ ceiling ∩ restriction`). Nothing in the
 * pilot measured whether a delegated Member can keep CALLING forever. PD-23
 * found that `create_goal` is ACCEPTED inside a delegated Member turn and wrote
 * that "without a pause it starts a self-continuation loop in that session".
 * From the ceiling's point of view that is UNBOUNDED EXECUTION: no single call
 * crosses the lane, but the number of calls is not bounded by anything the
 * ceiling compiles.
 *
 * WHAT THIS DRIVER MEASURES, on the SHIPPED opt-in `a5sf-governed-member`
 * preset with REAL Member turns (one Leader turn delegates five Members):
 *
 *   1. SELF-CONTINUATION (`loop`): create_goal with NO max_goal_rounds → the
 *      goal is active+armed; the goal-round driver queues round after round in
 *      the Member's own session. The run is ended by the MODEL at this lane's
 *      hard observation cap (`A5SF_PD25_MAX_ROUNDS`, default 5) — never by a
 *      product limit inside that window. The default cap is recorded from the
 *      create result (256).
 *   2. THE LIMIT (`cap2`): create_goal {max_goal_rounds: 2} → exactly 2 rounds,
 *      then the driver blocks the goal with `code: "round-limit"`. Proves the
 *      mechanism EXISTS and is effective.
 *   3. THE CAP IS CALLER-CHOSEN (`raise`): create_goal (default 256) followed
 *      by `update_goal edit max_goal_rounds = 9007199254740991` → accepted.
 *      The round budget therefore is not a ceiling: the Member writes it.
 *   4. TOOL-CALL COUNT (`loop`): 30 sequential `bash` calls in ONE turn with no
 *      refusal, no truncation, no typed cap. The end of the turn is the MODEL,
 *      not the runtime.
 *   5. `ask_user_question` (`ask`): what an unattended Member gets — a typed
 *      rejection or a blocked delegation, with the elapsed time.
 *   6. `exit_plan_mode` (`plan`): what a non-plan Member gets.
 *   7. `todo_write` (`loop`): recheck that the write lands only in the caller's
 *      own durable session.
 *
 * ARMS. `--arm prefix` boots a RECORDED pre-fix composition (this lane's
 * byte-identical copy of `cordis.patch.yml` @ origin/master, passed through
 * `A5SF_PD25_COMPOSITION`): the `loop`/`cap2`/`raise`/`ask`/`plan` arms measure
 * the DEFECT. `--arm postfix` boots this tree: the fail-closed removal must
 * make `create_goal`/`update_goal`/`get_goal` a typed `unknown tool`, with zero
 * goal rounds and zero goal events.
 *
 * BOOT DISCIPLINE (TEST_METHODS §2/§7):
 *   - DSH_HOME = tests/homes/u5a5sfpd25-<stamp> (inside the worktree);
 *   - ports from the 3180 family via WorldFactory leases; :3080 never touched;
 *   - the pinned host tree is READ-ONLY (porcelain verified before/after);
 *   - one machine-wide dev-live slot per boot via lib/dev-live-slots.mjs;
 *   - archive discipline: the PREFIX pair is written under `archive/pair-prefix/`,
 *     the POSTFIX pair under `runs/`; no run overwrites a previous one;
 *   - teardown by identity through the World's own teardown;
 *   - every start appends a `recordClass: 'DEV-LIVE'` ledger row.
 *
 * WHAT IS FIXTURE (disclosed): the model is the shared scripted mock
 * (`packages/tools/harness/mock-deepseek.mjs`) and the mock request log is test
 * instrumentation. The product path is real: the preset row, the realm
 * provider/compiler, the guard, the confined terminal face, the goal service +
 * goal-round driver, the ask-user and plan-mode tools and the team tool router
 * are the shipped modules the Host loads. Boot evidence is NEVER merge
 * evidence: the record class is `DEV-LIVE` and `candidateClaimEligibility` is
 * false by construction.
 *
 * `--plan` is host-free (row/blueprint validation, zero boots). `--boots 1` is a
 * development iteration.
 *
 * CORE PATCH BUDGET = 0.
 *
 * @module tests/world-factory/drivers/a5sf-pd25-unbounded-turn/run-boot
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

import { apiPrompt, authenticate, emitPatchLayer, fetchJson } from '../../lib/world-factory.mjs'
import { createRunRecord, formatSummary, readAuthorityBinding } from '../../lib/run-record.mjs'
import { TEST_USE_BASELINE_SHA } from '../../../paths.mjs'
import { createA5sfHarness } from '../../lib/a5sf-harness.mjs'
import { acquireDevLiveSlot } from '../../lib/dev-live-slots.mjs'
import { resolveHeadCommit } from '../../suites/150-a5sf-read.mjs'
import {
  lastUserTextOfStatic, messagesOf, remoteCall, surfaceNamesOf, textOf,
} from '../../lib/u6-fs-assembly.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..')
const EVIDENCE = join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence', 'a5sf-pd25-unbounded-turn')
const RUNS_POSTFIX = join(EVIDENCE, 'runs')
const RUNS_PREFIX = join(EVIDENCE, 'archive', 'pair-prefix')
const LEDGER_PATH = join(EVIDENCE, 'run-ledger.jsonl')

const LINE = 'u5a5sfpd25'
const BOOT_ROOT = 'session-a5sf-pd25-boot'
const ACCEPTANCE_ROOT = 'session-a5sf-pd25-team'
const BP_ANCHOR_ID = 'team.a5sf.pd25.anchor'
const BP_MAIN_ID = 'team.a5sf.pd25.main'
const PRESET_ID = 'a5sf-governed-member'

const MK_DISC = 'A5SF_PD25_DISC'
const MK_L1 = 'A5SF_PD25_L1_DRIVE'
const MK_L1B = 'A5SF_PD25_L1_ASK'
const TOK_LOOP = 'a5sf-pd25-loop'
const TOK_CAP2 = 'a5sf-pd25-cap2'
const TOK_RAISE = 'a5sf-pd25-raise'
const TOK_ASK = 'a5sf-pd25-ask'
const TOK_PLAN = 'a5sf-pd25-plan'

const CALL_D_CAP2 = 'call-pd25-delegate-cap2'
const CALL_D_RAISE = 'call-pd25-delegate-raise'
const CALL_D_PLAN = 'call-pd25-delegate-plan'
const CALL_D_LOOP = 'call-pd25-delegate-loop'
const CALL_D_ASK = 'call-pd25-delegate-ask'

const CALL_BASH = 'call-pd25-bash'
const CALL_TODO = 'call-pd25-todo'
const CALL_LOOP_GOAL = 'call-pd25-loop-goal-create'
const CALL_LOOP_GET = 'call-pd25-loop-goal-get'
const CALL_LOOP_COMPLETE = 'call-pd25-loop-goal-complete'
const CALL_LOOP_ROUND_BASH = 'call-pd25-round-bash'
const CALL_CAP2_GOAL = 'call-pd25-cap2-goal-create'
const CALL_RAISE_GOAL = 'call-pd25-raise-goal-create'
const CALL_RAISE_EDIT = 'call-pd25-raise-goal-edit'
const CALL_RAISE_PAUSE = 'call-pd25-raise-goal-pause'
const CALL_ASK = 'call-pd25-ask'
const CALL_PLAN = 'call-pd25-plan'

const DONE_LOOP = 'A5SF_PD25_LOOP_DONE'
const DONE_CAP2 = 'A5SF_PD25_CAP2_DONE'
const DONE_RAISE = 'A5SF_PD25_RAISE_DONE'
const DONE_ASK = 'A5SF_PD25_ASK_DONE'
const DONE_PLAN = 'A5SF_PD25_PLAN_DONE'
const DONE_L1 = 'A5SF_PD25_L1_DONE'
const DONE_L1_ASK = 'A5SF_PD25_L1_ASK_DONE'
const ROUND_MARK = 'A5SF_PD25_ROUND'
const BASH_MARK = 'A5SF_PD25_BASH'

const MAX_ROUNDS = (() => {
  const raw = Number(process.env.A5SF_PD25_MAX_ROUNDS ?? 5)
  if (!Number.isSafeInteger(raw) || raw < 2) return 5
  return raw
})()
const BURST = 30
const HUGE_ROUNDS = 9_007_199_254_740_991

const SELECTED_CASES = Object.freeze([
  'pd25:goal-self-continuation',
  'pd25:goal-round-limit',
  'pd25:goal-cap-caller-chosen',
  'pd25:no-tool-call-cap',
  'pd25:ask-user-unattended',
  'pd25:exit-plan-non-plan',
  'pd25:todo-session-local',
  'pd25:goal-tools-absent',
])

const argv = process.argv.slice(2)
const PLAN_ONLY = argv.includes('--plan')
const ARM = (() => {
  const i = argv.indexOf('--arm')
  const value = i >= 0 ? argv[i + 1] : 'postfix'
  if (value !== 'prefix' && value !== 'postfix') throw new Error(`--arm must be prefix|postfix, got ${String(value)}`)
  return value
})()
const RUNS = ARM === 'prefix' ? RUNS_PREFIX : RUNS_POSTFIX
const COMPOSITION_PATH = process.env.A5SF_PD25_COMPOSITION === undefined || process.env.A5SF_PD25_COMPOSITION === ''
  ? join(REPO_ROOT, 'cordis.patch.yml')
  : resolve(process.env.A5SF_PD25_COMPOSITION)
const BOOTS_WANTED = (() => {
  const i = argv.indexOf('--boots')
  if (i < 0) return 2
  const n = Number(argv[i + 1])
  return Number.isSafeInteger(n) && n >= 1 ? n : 2
})()
const startedAt = new Date().toISOString()

let RUN_LOG = null
function log(line) {
  const text = `[${new Date().toISOString()}] ${line}`
  process.stdout.write(`${text}\n`)
  try { if (RUN_LOG !== null) appendFileSync(RUN_LOG, `${text}\n`) } catch { /* best effort */ }
}

const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
const parseJsonl = (p) => {
  try {
    return readFileSync(p, 'utf8').split('\n').filter((l) => l.trim() !== '')
      .map((l) => { try { return JSON.parse(l) } catch { return null } }).filter((v) => v !== null)
  } catch { return [] }
}
const redact = (t) => String(t ?? '').replace(/\?token=[A-Za-z0-9_-]+/gu, '?token=<redacted>')
const utcStamp = () => new Date().toISOString().replace(/[:.]/gu, '-')

/** The pristine pinned host tree. A worktree may carry a symlink; a symlink
 *  would resolve OUTSIDE the runtime tree for the native-asset preflight, so
 *  the shared read-only checkout is used directly (override for a lane that
 *  runs from a worktree: the shared root checkout owns the built runtime). */
function hostTreePath() {
  const override = process.env.A5SF_PD25_HOST_TREE
  if (override !== undefined && override !== '') return resolve(override)
  const local = join(REPO_ROOT, 'tests', 'deepseek-harness-test-use')
  try {
    const st = lstatSync(local)
    if (st.isDirectory() && st.isSymbolicLink() === false) return local
  } catch { /* absent */ }
  return resolve(REPO_ROOT, '..', '..', 'tests', 'deepseek-harness-test-use')
}
const HOST_TREE = hostTreePath()

const require_ = createRequire(join(REPO_ROOT, 'package.json'))

/** Template id → the token that identifies that Member's model requests. */
const TOK_OF = { loop: TOK_LOOP, cap2: TOK_CAP2, raise: TOK_RAISE, plan: TOK_PLAN, ask: TOK_ASK }

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

// ─────────────────────────────────────────────────────────────────────────────
// blueprints
// ─────────────────────────────────────────────────────────────────────────────
function anchorBlueprintYaml() {
  const doc = {
    schemaVersion: 3,
    blueprintId: BP_ANCHOR_ID,
    revision: '1',
    leader: { templateId: 'leader', persona: 'You lead the a5sf PD-25 anchor team.' },
    members: [{ templateId: 'loop', persona: 'You are the anchor worker.' }],
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
 * The v4 design of the team whose Member turns are measured. Five templates,
 * each with the SAME compiled ceiling (the World workspace), so a behaviour
 * difference cannot be blamed on a lane difference: the only variable is the
 * probe the Member's turn runs.
 */
function mainBlueprintYaml({ workspace }) {
  const member = (templateId, displayName, persona) => ({ templateId, displayName, persona })
  const doc = {
    schemaVersion: 4,
    blueprintId: BP_MAIN_ID,
    revision: '1',
    leader: {
      templateId: 'leader',
      persona: `You lead the a5sf PD-25 unbounded-turn team. ${MK_L1} drives your chain: delegate each probe Member once, synchronously, in the fixed order.`,
    },
    members: [
      member('cap2', 'Cap-2 Worker', 'You are the round-limit worker. Run the probes exactly once each.'),
      member('raise', 'Raise Worker', 'You are the caller-chosen-cap worker. Run the probes exactly once each.'),
      member('plan', 'Plan Worker', 'You are the plan-mode worker. Run the probe once.'),
      member('loop', 'Loop Worker', 'You are the self-continuation worker. Run the probes exactly once each.'),
      member('ask', 'Ask Worker', 'You are the unattended-question worker. Run the probe once.'),
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
    memberIoCeilings: ['cap2', 'raise', 'plan', 'loop', 'ask'].map((templateId) => ({
      templateId,
      io: {
        read: lane([workspace]),
        write: lane([workspace]),
        network: { mode: 'allow' },
      },
    })),
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

function composedRows({ home, workspaceDir, anchorYaml, layer }) {
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
// mock-model request helpers
// ─────────────────────────────────────────────────────────────────────────────
function firstUserText(req) {
  const first = messagesOf(req).find((m) => m?.role === 'user')
  if (first === undefined) return ''
  return typeof first.content === 'string' ? first.content : JSON.stringify(first.content ?? '')
}
/** A delegated Member's request is identified STRUCTURALLY by the token only
 *  its delegated `[team-work …]` envelope carries. */
function isMemberRequest(req, token) {
  const text = firstUserText(req)
  return text.includes('[team-work ') && text.includes(token)
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
/** The LAST goal {id, revision} a result text mentions — a goal revision only
 *  moves forward, so last-wins is the current ref. */
function lastGoalRef(text) {
  const re = /"goal"\s*:\s*\{\s*"id"\s*:\s*"(goal-[^"]+)"\s*,\s*"revision"\s*:\s*(\d+)/gu
  let hit = null
  let m
  while ((m = re.exec(text)) !== null) hit = { id: m[1], revision: Number(m[2]) }
  return hit
}
function roundOf(req) {
  const m = /Round: (\d+)\/(\d+)/u.exec(lastUserTextOfStatic(req))
  return m === null ? null : { round: Number(m[1]), maxRounds: Number(m[2]) }
}
function toolCallFor(requests, callId) {
  for (const req of requests) {
    // A call whose turn never advanced (a blocked delegation, a blocked tool)
    // exists ONLY as the mock's reply, never as a later request's history.
    if (Array.isArray(req.reply?.toolCalls)) {
      const hit = req.reply.toolCalls.find((t) => String(t?.id) === String(callId))
      if (hit !== undefined) return { id: String(hit.id), name: hit.name, arguments: hit.arguments ?? {} }
    }
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

/**
 * The scripted model. Each branch is selected STRUCTURALLY by the token in the
 * Member's delegated envelope, so no branch can bleed into another Member.
 */
function makeDecide({ workspaceDir }) {
  const call = (id, name, args) => ({ kind: 'tool-call', toolCalls: [{ id, name, arguments: args }] })
  const memberBash = (id, command) => call(id, 'bash', { command, description: 'PD-25 probe', workdir: workspaceDir })
  return function decide({ req }) {
    const allText = messagesOf(req).map(textOf).join('\n')
    const lastUser = lastUserTextOfStatic(req)
    if (allText.includes('Generate the session title')) return { kind: 'text', content: 'a5sf pd25 session' }
    const seen = resultIdsOf(req)

    // ── cap2: the round-limit arm ──────────────────────────────────────────
    if (isMemberRequest(req, TOK_CAP2)) {
      if (lastUser.includes('<goal_round>')) {
        const r = roundOf(req)
        return { kind: 'text', content: `A5SF_PD25_CAP2_ROUND_${String(r?.round ?? '?')} observed with max=${String(r?.maxRounds ?? '?')}` }
      }
      if (!seen.has(CALL_CAP2_GOAL)) {
        return call(CALL_CAP2_GOAL, 'create_goal', {
          objective: 'PD-25 cap probe: the product round limit must stop this goal.',
          max_goal_rounds: 2,
        })
      }
      return { kind: 'text', content: DONE_CAP2 }
    }

    // ── raise: the caller-chosen cap arm ──────────────────────────────────
    if (isMemberRequest(req, TOK_RAISE)) {
      if (lastUser.includes('<goal_round>')) return { kind: 'text', content: 'A5SF_PD25_RAISE_UNEXPECTED_ROUND' }
      if (!seen.has(CALL_RAISE_GOAL)) {
        return call(CALL_RAISE_GOAL, 'create_goal', { objective: 'PD-25 cap-raise probe.' })
      }
      if (!seen.has(CALL_RAISE_EDIT)) {
        const ref = lastGoalRef(allToolResultText(req))
        return call(CALL_RAISE_EDIT, 'update_goal', {
          goal_id: ref?.id ?? 'goal-unresolved',
          revision: ref?.revision ?? 1,
          action: 'edit',
          max_goal_rounds: HUGE_ROUNDS,
        })
      }
      if (!seen.has(CALL_RAISE_PAUSE)) {
        const ref = lastGoalRef(allToolResultText(req))
        return call(CALL_RAISE_PAUSE, 'update_goal', {
          goal_id: ref?.id ?? 'goal-unresolved',
          revision: ref?.revision ?? 2,
          action: 'pause',
        })
      }
      return { kind: 'text', content: DONE_RAISE }
    }

    // ── plan: exit_plan_mode outside plan mode ────────────────────────────
    if (isMemberRequest(req, TOK_PLAN)) {
      if (!seen.has(CALL_PLAN)) {
        return call(CALL_PLAN, 'exit_plan_mode', {
          plan: '# PD-25 probe plan\n\nA non-plan governed Member submits a plan it must not be able to submit.',
        })
      }
      return { kind: 'text', content: DONE_PLAN }
    }

    // ── ask: ask_user_question with no human ──────────────────────────────
    if (isMemberRequest(req, TOK_ASK)) {
      if (!seen.has(CALL_ASK)) {
        return call(CALL_ASK, 'ask_user_question', {
          questions: [{
            id: 'pd25-q1',
            header: 'PD-25',
            question: 'Should the unattended governed Member continue?',
            options: [{ label: 'Yes (Recommended)' }, { label: 'No' }],
          }],
        })
      }
      return { kind: 'text', content: DONE_ASK }
    }

    // ── loop: the tool-call burst + the self-continuation goal ────────────
    if (isMemberRequest(req, TOK_LOOP)) {
      if (lastUser.includes('<goal_round>')) {
        const r = roundOf(req)
        const round = r?.round ?? 0
        if (round >= MAX_ROUNDS) {
          const ref = lastGoalRef(allToolResultText(req))
          if (ref !== null) {
            return call(CALL_LOOP_COMPLETE, 'update_goal', {
              goal_id: ref.id, revision: ref.revision, action: 'complete',
            })
          }
          return { kind: 'text', content: `${DONE_LOOP} round ${String(round)} without a goal ref` }
        }
        if (round === MAX_ROUNDS - 1) return call(CALL_LOOP_GET, 'get_goal', {})
        return memberBash(`${CALL_LOOP_ROUND_BASH}-${String(round)}`, `echo ${ROUND_MARK}_${String(round)}`)
      }
      for (let i = 1; i <= BURST; i += 1) {
        if (!seen.has(`${CALL_BASH}-${String(i)}`)) return memberBash(`${CALL_BASH}-${String(i)}`, `echo ${BASH_MARK}_${String(i)}`)
      }
      if (!seen.has(CALL_TODO)) {
        return call(CALL_TODO, 'todo_write', {
          todos: [
            { content: 'PD-25 unbounded-turn probe (member-local)', status: 'in_progress' },
            { content: 'PD-25 report', status: 'pending' },
          ],
        })
      }
      if (!seen.has(CALL_LOOP_GOAL)) {
        return call(CALL_LOOP_GOAL, 'create_goal', {
          objective: 'PD-25: continue the delegated task across automatic rounds until it is done.',
        })
      }
      return { kind: 'text', content: DONE_LOOP }
    }

    // ── the Leader: five synchronous delegations, fixed order ─────────────
    // The `ask` arm is split into a SECOND Leader turn: a blocking
    // `ask_user_question` must not hold the first turn open, or the create RPC
    // (which settles with the initial work) could never return.
    if (lastUser.includes(MK_L1B)) {
      if (!seen.has(CALL_D_ASK)) {
        return call(CALL_D_ASK, 'team_delegate', {
          rootSessionId: ACCEPTANCE_ROOT,
          requestToken: `${TOK_ASK}-delegate`,
          delegationTemplateId: 'ask',
          label: 'a5sfpd25-ask',
          workspace: workspaceDir,
          prompt: `${TOK_ASK}: call ask_user_question once, then report what happened. Reply with the marker only when done.`,
          async: false,
        })
      }
      return { kind: 'text', content: DONE_L1_ASK }
    }
    if (lastUser.includes(MK_L1) || allText.includes(MK_L1)) {
      const delegations = [
        [CALL_D_CAP2, 'cap2', TOK_CAP2, 'create a goal capped at two rounds, then report.'],
        [CALL_D_RAISE, 'raise', TOK_RAISE, 'create a goal, raise its round cap, pause it, then report.'],
        [CALL_D_PLAN, 'plan', TOK_PLAN, 'call exit_plan_mode once, then report what happened.'],
        [CALL_D_LOOP, 'loop', TOK_LOOP, `run ${String(BURST)} sequential in-lane reads, write a todo, create a goal with no cap, then report.`],
      ]
      for (const [callId, templateId, token, task] of delegations) {
        if (seen.has(callId)) continue
        return call(callId, 'team_delegate', {
          rootSessionId: ACCEPTANCE_ROOT,
          requestToken: `${token}-delegate`,
          delegationTemplateId: templateId,
          label: `a5sfpd25-${templateId}`,
          workspace: workspaceDir,
          prompt: `${token}: ${task} Reply with the marker only when done.`,
          async: false,
        })
      }
      return { kind: 'text', content: DONE_L1 }
    }
    return { kind: 'text', content: 'A5SF_PD25_NOOP' }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// the Member's OWN durable transcript
// ────────────────────────────────────��────────────────────────────────────────
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
  const goalRounds = []
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
      const source = m?.source ?? data?.source ?? {}
      if (source?.kind === 'goal') goalRounds.push({ round: source.round, goalId: source.goalId, revision: source.revision, at: row?.at ?? null })
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
  const paired = calls.map((c) => {
    const result = results.find((r) => String(r.callId) === String(c.callId)) ?? null
    let args = null
    try { args = JSON.parse(c.arguments) } catch { args = null }
    return { callId: c.callId, name: c.name, arguments: args, at: c.at, result }
  })
  return {
    sessionId,
    file: found.file,
    header: found.header,
    agentPreset: found.header?.agentPreset ?? null,
    lineCount: lines.length,
    eventTypes,
    todoWrites,
    user,
    goalRounds,
    calls: paired,
    assistant,
    finalAssistant: assistant.at(-1) ?? null,
  }
}
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
    const goalBlocked = []
    for (const line of lines) {
      try {
        const row = JSON.parse(line)
        const t = String(row?.type ?? row?.kind ?? '')
        if (t !== '') types[t] = (types[t] ?? 0) + 1
        const data = row?.data ?? row
        if (t === 'goal/change' && data?.goal?.phase === 'blocked') {
          goalBlocked.push({ code: data?.goal?.blockedReason?.code ?? null, message: data?.goal?.blockedReason?.message ?? null, maxGoalRounds: data?.goal?.maxGoalRounds ?? null, roundsStarted: data?.roundsStarted ?? null })
        }
      } catch { /* unparsable row is not a fact */ }
    }
    const goalEvents = Object.entries(types).filter(([t]) => t.startsWith('goal')).reduce((acc, [, n]) => acc + n, 0)
    out[id] = { file: entry.path, types, goalEvents, goalBlocked }
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

/** Parsed JSON of a goal-tool result (the compact model result). */
function goalValueOf(probe) {
  const text = resultText(probe)
  try { return JSON.parse(text) } catch { return null }
}

function judgeSelfContinuation({ expect, createProbe, rounds, completeProbe, goalBlocked, sessionGoalRounds, delegateReturned }) {
  const created = goalValueOf(createProbe)
  if (expect === 'postfix') {
    return verdictOf(
      'a governed Member cannot open a self-continuation loop: the goal tools are ABSENT (typed unknown tool), no goal is created, and ZERO goal rounds are driven',
      [
        { id: 'create-issued', ok: createProbe.call !== null, detail: 'the Member issued `create_goal`' },
        { id: 'typed-unknown', ok: isErrorResult(createProbe) && /unknown tool "create_goal"/u.test(resultText(createProbe)), detail: `isError=${String(isErrorResult(createProbe))} text=${resultText(createProbe).slice(0, 160)}` },
        { id: 'no-goal-created', ok: created === null || created?.goal === null || created?.goal === undefined, detail: `create result=${resultText(createProbe).slice(0, 160)}` },
        { id: 'zero-goal-rounds', ok: rounds.length === 0, detail: `goal-round model requests=${String(rounds.length)}` },
        { id: 'zero-goal-events', ok: sessionGoalRounds.length === 0, detail: `durable goal-round user messages=${String(sessionGoalRounds.length)}` },
        { id: 'no-round-limit-block', ok: (goalBlocked ?? []).length === 0, detail: `blocked goals=${String((goalBlocked ?? []).length)}` },
      ],
    )
  }
  return verdictOf(
    'a delegated governed Member CAN open a self-continuation loop: `create_goal` is ACCEPTED, the round driver keeps issuing rounds in the Member\'s own session, and inside this lane\'s observation cap the run is ended by the MODEL — never by a product limit',
    [
      { id: 'create-issued', ok: createProbe.call !== null, detail: 'the Member issued `create_goal` with NO max_goal_rounds' },
      { id: 'create-accepted', ok: isErrorResult(createProbe) === false && created?.goal?.phase === 'active', detail: `phase=${String(created?.goal?.phase)} activation=${String(created?.activation)}` },
      { id: 'armed', ok: created?.activation === 'armed', detail: `activation=${String(created?.activation)}` },
      { id: 'default-cap-recorded', ok: created?.goal?.maxGoalRounds === 256, detail: `maxGoalRounds=${String(created?.goal?.maxGoalRounds)} (the deployment default, NOT chosen by this probe)` },
      { id: 'rounds-arrived', ok: rounds.length >= MAX_ROUNDS, detail: `goal-round model requests=${String(rounds.length)} (observation cap=${String(MAX_ROUNDS)})` },
      { id: 'rounds-are-sequential-bash', ok: rounds.filter((r) => r.roundsBefore >= 2).length >= 1 || rounds.length >= MAX_ROUNDS, detail: `rounds=${JSON.stringify(rounds.map((r) => r.round))}` },
      { id: 'not-stopped-by-product', ok: (goalBlocked ?? []).length === 0, detail: `goal reached a blocked phase inside the window: ${JSON.stringify(goalBlocked ?? [])}` },
      { id: 'model-ended-it', ok: isErrorResult(completeProbe) === false && goalValueOf(completeProbe)?.goal?.phase === 'complete', detail: `complete result=${resultText(completeProbe).slice(0, 160)}` },
      { id: 'durable-rounds', ok: sessionGoalRounds.length >= MAX_ROUNDS, detail: `durable goal-round user messages=${String(sessionGoalRounds.length)}` },
      { id: 'delegation-returned', ok: delegateReturned === true, detail: 'the synchronous `team_delegate` call returned (the member answered)' },
    ],
  )
}

function judgeRoundLimit({ expect, createProbe, rounds, goalBlocked }) {
  const created = goalValueOf(createProbe)
  const blocked = (goalBlocked ?? [])[0] ?? null
  if (expect === 'postfix') {
    return verdictOf(
      'with the goal tools removed there is no round budget to exercise: `create_goal {max_goal_rounds: 2}` is a typed unknown-tool refusal and zero goal rounds are driven',
      [
        { id: 'create-typed-unknown', ok: isErrorResult(createProbe) && /unknown tool "create_goal"/u.test(resultText(createProbe)), detail: resultText(createProbe).slice(0, 160) },
        { id: 'zero-rounds', ok: rounds.length === 0, detail: `goal-round requests=${String(rounds.length)}` },
        { id: 'no-blocked-goal', ok: (goalBlocked ?? []).length === 0, detail: `blocked goals=${String((goalBlocked ?? []).length)}` },
      ],
    )
  }
  return verdictOf(
    'the product round budget EXISTS and is effective: `create_goal {max_goal_rounds: 2}` runs exactly two rounds and is then BLOCKED by the goal-round driver with `round-limit`',
    [
      { id: 'create-accepted', ok: isErrorResult(createProbe) === false && created?.goal?.maxGoalRounds === 2, detail: `maxGoalRounds=${String(created?.goal?.maxGoalRounds)}` },
      { id: 'exactly-two-rounds', ok: rounds.length === 2 && rounds.map((r) => r.round).join(',') === '1,2', detail: `rounds=${JSON.stringify(rounds.map((r) => r.round))}` },
      { id: 'blocked-by-round-limit', ok: blocked?.code === 'round-limit', detail: `blocked=${JSON.stringify(blocked)}` },
      { id: 'blocked-at-two', ok: blocked?.roundsStarted === 2, detail: `roundsStarted at block=${String(blocked?.roundsStarted)}` },
      { id: 'no-third-round', ok: rounds.some((r) => r.round === 3) === false, detail: 'no third round was ever issued' },
    ],
  )
}

function judgeCallerChosenCap({ expect, createProbe, editProbe, pauseProbe }) {
  const created = goalValueOf(createProbe)
  const edited = goalValueOf(editProbe)
  if (expect === 'postfix') {
    return verdictOf(
      'with the goal tools removed the Member can neither create a goal nor raise a cap: both are typed unknown-tool refusals and no goal state is written',
      [
        { id: 'create-typed-unknown', ok: isErrorResult(createProbe) && /unknown tool "create_goal"/u.test(resultText(createProbe)), detail: resultText(createProbe).slice(0, 160) },
        { id: 'edit-typed-unknown', ok: isErrorResult(editProbe) && /unknown tool "update_goal"/u.test(resultText(editProbe)), detail: resultText(editProbe).slice(0, 160) },
        { id: 'no-goal-state', ok: created === null && edited === null, detail: 'no goal JSON was ever returned' },
      ],
    )
  }
  return verdictOf(
    'the round budget is CALLER-CHOSEN, not a ceiling: the same Member raises its own goal cap from the deployment default 256 to 9007199254740991 with `update_goal edit`, and the edit is accepted',
    [
      { id: 'create-default-256', ok: isErrorResult(createProbe) === false && created?.goal?.maxGoalRounds === 256, detail: `create maxGoalRounds=${String(created?.goal?.maxGoalRounds)}` },
      { id: 'edit-accepted', ok: isErrorResult(editProbe) === false, detail: `isError=${String(isErrorResult(editProbe))} text=${resultText(editProbe).slice(0, 200)}` },
      { id: 'cap-is-huge', ok: edited?.goal?.maxGoalRounds === HUGE_ROUNDS, detail: `maxGoalRounds=${String(edited?.goal?.maxGoalRounds)}` },
      { id: 'same-goal', ok: edited?.goal?.id === created?.goal?.id, detail: 'the raised cap belongs to the goal the Member just created' },
      { id: 'paused-after', ok: isErrorResult(pauseProbe) === false && goalValueOf(pauseProbe)?.goal?.phase === 'paused', detail: `pause result=${resultText(pauseProbe).slice(0, 160)}` },
    ],
  )
}

function judgeBurst({ bashProbes }) {
  const issued = bashProbes.filter((p) => p.call !== null)
  const answered = issued.filter((p) => p.result !== null)
  const errors = answered.filter((p) => isErrorResult(p))
  const markerOk = answered.filter((p) => resultText(p).includes(BASH_MARK)).length
  return verdictOf(
    `a delegated Member turn has NO tool-call cap: ${String(BURST)} sequential confined \`bash\` calls in ONE turn all executed (no typed refusal, no truncation, no counter)`,
    [
      { id: 'all-issued', ok: issued.length === BURST, detail: `issued=${String(issued.length)}/${String(BURST)}` },
      { id: 'all-answered', ok: answered.length === BURST, detail: `answered=${String(answered.length)}` },
      { id: 'none-refused', ok: errors.length === 0, detail: `error results=${JSON.stringify(errors.map((p) => resultText(p).slice(0, 120)))}` },
      { id: 'each-executed', ok: markerOk >= BURST - 1, detail: `results carrying the command marker=${String(markerOk)} (one may be a trajectory/flush race)` },
    ],
  )
}

function judgeAsk({ expect, askProbe, askOutcome, blockedSeconds, delegationReturned }) {
  const text = resultText(askProbe)
  const answered = askProbe.result !== null
  const typed = answered && isErrorResult(askProbe) && /NO_PROVIDER|no user-questions answerer|DELEGATED_CALLER|not.*root|UNAVAILABLE|UNSUPPORTED/iu.test(text)
  const fabricated = answered && isErrorResult(askProbe) === false
  if (expect === 'postfix') {
    return verdictOf(
      'with `tool-ask-user` removed the unattended Member cannot ask at all: the call is a typed `unknown tool` refusal, the delegation RETURNS, and no question is queued for a non-existent client',
      [
        { id: 'tool-absent', ok: answered && isErrorResult(askProbe) && /unknown tool "ask_user_question"/u.test(text), detail: text.slice(0, 200) },
        { id: 'no-block', ok: delegationReturned === true && blockedSeconds === null, detail: `delegationReturned=${String(delegationReturned)} blockedSeconds=${String(blockedSeconds)}` },
        { id: 'no-fabricated-answer', ok: fabricated === false, detail: `isError=${String(isErrorResult(askProbe))}` },
      ],
    )
  }
  return verdictOf(
    'an unattended governed Member\'s `ask_user_question` is answered by the HOST, not by a human: either a typed rejection that returns promptly, or a measured block — never a fabricated answer',
    [
      { id: 'call-issued', ok: askProbe.call !== null, detail: 'the Member issued `ask_user_question`' },
      { id: 'no-fabricated-answer', ok: fabricated === false, detail: `isError=${String(isErrorResult(askProbe))} text=${text.slice(0, 200)}` },
      {
        id: 'typed-or-blocked',
        ok: (answered && typed) || (answered === false && blockedSeconds !== null),
        detail: answered
          ? `typed=${String(typed)} elapsedMs=${String(askOutcome?.elapsedMs ?? null)} text=${text.slice(0, 220)}`
          : `no result within ${String(blockedSeconds)}s — the delegation is BLOCKED`,
      },
      { id: 'delegation-outcome-recorded', ok: true, detail: `outcome=${String(askOutcome?.kind ?? '<none>')}` },
    ],
  )
}

function judgePlan({ planProbe }) {
  const text = resultText(planProbe)
  return verdictOf(
    '`exit_plan_mode` outside plan mode is a TYPED REFUSAL and does not switch the session mode',
    [
      { id: 'call-issued', ok: planProbe.call !== null, detail: 'the Member issued `exit_plan_mode` from a non-plan turn' },
      { id: 'typed-refusal', ok: isErrorResult(planProbe) && /only available in plan mode/iu.test(text), detail: `isError=${String(isErrorResult(planProbe))} text=${text.slice(0, 240)}` },
      { id: 'nothing-executed', ok: /plan/i.test(text), detail: 'the refusal names the plan-mode precondition' },
    ],
  )
}

function judgeTodo({ todoProbe, loopTranscript, otherTranscripts }) {
  const others = otherTranscripts.filter((t) => t !== null)
  const othersTodo = others.reduce((n, t) => n + (t.todoWrites ?? 0), 0)
  return verdictOf(
    '`todo_write` is SESSION-LOCAL: the `todo/write` event lands in the CALLING Member\'s own durable session and in no other Member\'s',
    [
      { id: 'call-issued', ok: todoProbe.call !== null, detail: 'the Member issued `todo_write`' },
      { id: 'accepted', ok: isErrorResult(todoProbe) === false && /Updated todo list/u.test(resultText(todoProbe)), detail: `text=${resultText(todoProbe).slice(0, 160)}` },
      { id: 'write-in-calling-session', ok: (loopTranscript?.todoWrites ?? 0) >= 1, detail: `todo/write events in the calling session=${String(loopTranscript?.todoWrites ?? 0)}` },
      { id: 'no-write-elsewhere', ok: othersTodo === 0, detail: `todo/write events in the other ${String(others.length)} member sessions=${String(othersTodo)}` },
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
  const rows = composedRows({ home: join(EVIDENCE, 'plan-home'), workspaceDir: join(EVIDENCE, 'plan-workspace'), anchorYaml: anchor, layer })
  writeFileSync(join(EVIDENCE, 'plan-patch.yml'), emitPatchLayer(['a5sf-pd25-unbounded-turn plan (no World)'], rows) + '\n')
  log(`rows: ${JSON.stringify(rows.map((r) => ({ id: r.id, name: String(r.name).slice(0, 80) })))}`)
  const preset = layer.rows.find((r) => r?.config?.id === PRESET_ID)
  const flatten = (list) => (list ?? []).flatMap((p) => (p?.group === true ? flatten(p.config) : [p]))
  const plugins = flatten(preset?.config?.plugins).map((p) => p.id)
  log(`governed preset plugins (${String(plugins.length)}): ${plugins.join(',')}`)
  log(`governed preset goal rows: ${JSON.stringify(plugins.filter((p) => p === 'tool-goal' || p === 'command-goal'))}`)
  log(`governed preset ask/plan rows: ${JSON.stringify(plugins.filter((p) => p === 'tool-ask-user' || p === 'plan-mode' || p === 'tool-todo'))}`)
  for (const required of ['tool-bash', 'tool-fs', 'tool-jobs', 'persona', 'compaction-basic', 'plan-mode', 'tool-todo', 'command-goal']) {
    if (!plugins.includes(required)) throw new Error(`the shipped governed preset lost '${required}'`)
  }
  // PD-24/UNBOUNDED-TURN: the two rows this lane removes must NOT be declared.
  for (const removed of ['tool-goal', 'tool-ask-user']) {
    if (plugins.includes(removed)) throw new Error(`the shipped governed preset still declares '${removed}' (the PD-24 removal did not land)`)
  }
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
  const phase = `a5sf-pd25-unbounded-turn-${ARM}-boot${String(index)}`
  const runId = `a5sf-pd25-unbounded-turn-${ARM}-${utcStamp()}-b${String(index)}`
  const record = createRunRecord({
    runId, suite: 'a5sf-pd25-unbounded-turn', selectedCases: SELECTED_CASES,
    bindings: runBindings(head, authorization), ledgerPath: LEDGER_PATH, recordClass: 'DEV-LIVE',
  })
  const harness = createA5sfHarness({
    repoRoot: REPO_ROOT, evidenceRoot: join(EVIDENCE, 'driver'), suite: 'a5sf-pd25-unbounded-turn', line: LINE,
    runRecord: record, hostTree: HOST_TREE,
  })
  const factory = harness.factory
  log(`[boot${String(index)}] candidate: ${JSON.stringify(harness.assertCandidate())}`)
  const slot = acquireDevLiveSlot({
    leaseRoot: factory.leaseRoot,
    runId: String(record.record.runId),
    face: 'UnboundedTurn',
    world: LINE,
    headCommit: head,
  })
  log(`[boot${String(index)}] dev-live slot #${String(slot.slot)} face=UnboundedTurn world=${LINE} head=${head}`)

  let world = null
  let bootInfo = null
  let teardown = null
  let failure = null
  let abortStage = 'pre-boot'
  let paths = null
  let collectDiagnostics = () => ({})
  const counters = {}
  let result = null
  const dumpMock = (label) => {
    const out = {}
    const requestsNow = world?.mock?.requests ?? []
    out.mockRequests = requestsNow.map((r, i) => ({
      seq: i,
      at: r.receivedAt ?? null,
      lastUser: lastUserTextOfStatic(r).slice(0, 400),
      rounds: roundOf(r),
      reply: typeof r.reply === 'object' ? JSON.stringify(r.reply).slice(0, 300) : String(r.reply ?? '').slice(0, 300),
    }))
    try { out.hostLogTail = redact(readFileSync(bootInfo.logPath, 'utf8').split('\n').slice(-160).join('\n')) } catch { out.hostLogTail = '<absent>' }
    writeFileSync(join(bootDir, `diagnostics-${label}.json`), JSON.stringify(out, null, 2) + '\n')
    try { writeFileSync(join(bootDir, `host-log-${label}.log`), out.hostLogTail + '\n') } catch { /* best effort */ }
    log(`[boot${String(index)}] diagnostics(${label}): mockRequests=${String(out.mockRequests.length)}`)
    return out
  }
  collectDiagnostics = dumpMock
  try {
    bootInfo = await (async () => {
      world = await harness.createWorld({ line: LINE, u6Fs: { rows: [] } })
      log(`[boot${String(index)}] world=${world.id} home=${world.home}`)
      mkdirSync(join(world.home, 'blueprints'), { recursive: true })
      const workspace = world.workspaceDir
      const anchor = anchorBlueprintYaml()
      writeFileSync(join(world.home, 'blueprints', 'anchor.yaml'), anchor)
      const rows = composedRows({ home: world.home, workspaceDir: workspace, anchorYaml: anchor, layer })
      world.u6Fs.rows.push(...rows)
      log(`[boot${String(index)}] rows: ${rows.map((r) => r.id).join(',')}`)
      writeFileSync(join(world.home, 'p6t6-directive.json'), JSON.stringify(p6t6Directive({ worldId: world.id, logDir: world.logDir }), null, 2) + '\n')
      const decide = makeDecide({ workspaceDir: workspace })
      process.env.A5SF_GOVERNED_SCRATCH = join(world.home, 'governed-scratch')
      mkdirSync(process.env.A5SF_GOVERNED_SCRATCH, { recursive: true })
      await world.startMock({ decide })
      log(`[boot${String(index)}] mock on ${String(world.mock?.port)}`)
      return await harness.boot({ world, phase, bootTimeoutMs: 300_000 })
    })()
    abortStage = 'composition'
    paths = { workspace: world.workspaceDir }
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

    // PD-23 precedent: a discovery turn on the BOOT ROOT first, so the row's
    // own root session is live before a SECOND team root is created.
    const disc = await apiPrompt(origin, cookie, BOOT_ROOT, MK_DISC, 'a5sfpd25')
    log(`[boot${String(index)}] discovery prompt status=${String(disc.status)}`)
    const discSeen = await waitFor(() => (world.mock?.requests ?? []).some((r) => lastUserTextOfStatic(r).includes(MK_DISC)), 60_000)
    log(`[boot${String(index)}] discovery turn seen=${String(discSeen)}`)

    abortStage = 'team-create'
    const mainText = mainBlueprintYaml({ workspace: paths.workspace })
    assertBlueprintText(mainText, BP_MAIN_ID, 'main.yaml')
    writeFileSync(join(world.home, 'blueprints', 'main.yaml'), mainText)
    const created = await teamRpc(origin, cookie, 'team.create', {
      rootSessionId: ACCEPTANCE_ROOT, blueprintId: BP_MAIN_ID, initialWork: { prompt: MK_L1 },
    }, 'a5sfpd25')
    const createOk = created.status === 200 && created.body?.result?.ok === true
    log(`[boot${String(index)}] team.create status=${String(created.status)} error=${String(created.error ?? '<none>')} ok=${String(createOk)} ${redact(JSON.stringify(created.body ?? null)).slice(0, 400)}`)
    if (!createOk) throw new Error(`team.create failed: status=${String(created.status)} body=${redact(JSON.stringify(created.body ?? null)).slice(0, 400)}`)

    abortStage = 'member-turns'
    // Second Leader turn (the blocking `ask` arm), now that create returned.
    const askTurn = await apiPrompt(origin, cookie, ACCEPTANCE_ROOT, MK_L1B, 'a5sfpd25')
    log(`[boot${String(index)}] ask turn prompt status=${String(askTurn.status)} error=${String(askTurn.error ?? '<none>')}`)
    collectDiagnostics = (label) => {
      const out = dumpMock(label)
      out.counters = { ...counters }
      try { out.guardFacts = parseJsonl(paths?.sink) } catch { out.guardFacts = [] }
      writeFileSync(join(bootDir, `diagnostics-${label}.json`), JSON.stringify(out, null, 2) + '\n')
      return out
    }

    // Wait for the chain to reach QUIESCENCE: all five delegations start, the
    // cap-2 goal blocks, the loop goal completes, and then 6 s of no new mock
    // request (the `ask` arm may be a blocked delegation — it must not hang the
    // driver, so quiescence, not DONE_L1, is the stop condition).
    const chainTimeoutMs = Number(process.env.A5SF_PD25_CHAIN_TIMEOUT_MS ?? 420_000)
    const askBlockAfterMs = Number(process.env.A5SF_PD25_ASK_BLOCK_AFTER_MS ?? 45_000)
    const started = Date.now()
    let quietSince = null
    let lastCount = -1
    let sawAskBlocked = null
    const askDelegationAt = { at: null }
    for (;;) {
      const requests = world.mock?.requests ?? []
      const n = requests.length
      if (n !== lastCount) { lastCount = n; quietSince = Date.now() }
      const askDelegationCall = toolCallFor(requests, CALL_D_ASK)
      if (askDelegationCall !== null && askDelegationAt.at === null) askDelegationAt.at = Date.now()
      const askDelegationResult = toolResultFor(requests, CALL_D_ASK)
      if (askDelegationCall !== null && askDelegationResult === undefined
        && Date.now() - (askDelegationAt.at ?? Date.now()) > askBlockAfterMs) {
        sawAskBlocked = Math.round((Date.now() - (askDelegationAt.at ?? Date.now())) / 1000)
      }
      const goalComplete = toolResultFor(requests, CALL_LOOP_COMPLETE) !== undefined
      const mainDone = requests.some((r) => String(r.reply?.content ?? '').startsWith(DONE_L1))
      const askSettled = askDelegationResult !== undefined || sawAskBlocked !== null
      const quiet = Date.now() - (quietSince ?? Date.now())
      // `goalComplete` can only exist on the PREFIX arm; on POSTFIX the goal
      // tools are absent and the loop Member's turn simply ends. The quiescence
      // window is the arm-agnostic stop: a running goal round issues a request
      // every few hundred ms, so 3 s of silence means nothing is still driving.
      const goalSettled = goalComplete || quiet > 3_000
      if (mainDone && askSettled && goalSettled && quiet > 3_000) break
      if (Date.now() - started > chainTimeoutMs) break
      await new Promise((r) => setTimeout(r, 500))
    }
    log(`[boot${String(index)}] chain wait done: requests=${String((world.mock?.requests ?? []).length)} blockedAsk=${String(sawAskBlocked)}`)
    abortStage = 'evidence-collection'

    const requests = world.mock?.requests ?? []
    const callOf = (id) => toolCallFor(requests, id)
    const resultOf = (id) => toolResultFor(requests, id)

    const state = await fetchJson(`${origin}/__p6t6/state`, undefined, 30_000).catch(() => null)
    const members = Array.isArray(state?.body?.members) ? state.body.members : []
    const memberIds = {}
    for (const templateId of ['cap2', 'raise', 'plan', 'loop', 'ask']) {
      const m = memberOf(state, templateId)
      memberIds[templateId] = m?.childSessionId ?? derivedChildSessionId(ACCEPTANCE_ROOT, m?.instanceId)
    }
    log(`[boot${String(index)}] members=${JSON.stringify(members.map((m) => ({ templateId: m.templateId, lifecycle: m.lifecycle })))} ids=${JSON.stringify(memberIds)}`)

    const transcripts = {}
    for (const [templateId, sessionId] of Object.entries(memberIds)) {
      const t = sessionId === null ? null : readMemberTranscript(world.home, sessionId)
      transcripts[templateId] = t
      if (t === null) continue
      writeFileSync(join(bootDir, `member-${templateId}-transcript.json`), JSON.stringify(t, null, 2) + '\n')
      writeFileSync(join(bootDir, `member-${templateId}-transcript.txt`), renderTranscript(t) + '\n')
      try { writeFileSync(join(bootDir, `member-${templateId}-session.v4.jsonl.zstd`), readFileSync(t.file)) } catch { /* normalised copy is the evidence */ }
    }

    // ── per-round curve (the pre-fix core artifact) ────────────────────────
    const roundRequests = (token) => requests
      .map((r, seq) => ({ r, seq }))
      .filter(({ r }) => isMemberRequest(r, token) && roundOf(r) !== null)
      .map(({ r, seq }) => ({ seq, at: r.receivedAt ?? null, ...roundOf(r), lastUser: lastUserTextOfStatic(r).slice(0, 120) }))
    const loopRounds = roundRequests(TOK_LOOP).map((r, i) => ({
      ...r,
      roundsBefore: i,
      // the tool the Member's model asked for in THIS round (if any)
      toolCalls: (() => {
        const reply = requests[r.seq]?.reply
        return Array.isArray(reply?.toolCalls) ? reply.toolCalls.map((t) => t.name) : []
      })(),
    }))
    const cap2Rounds = roundRequests(TOK_CAP2)
    const wall = (list) => (list.length < 2 ? null : (new Date(list.at(-1).at).getTime() - new Date(list[0].at).getTime()) / 1000)
    writeFileSync(join(bootDir, 'self-continuation-rounds.json'), JSON.stringify({
      schema: 'a5sf-pd25-unbounded-turn/rounds/1',
      at: new Date().toISOString(),
      hardObservationCap: MAX_ROUNDS,
      note: 'each row is ONE model request whose last user message is the goal-round prompt; timestamps are the mock provider\'s receipt time',
      loop: { token: TOK_LOOP, rounds: loopRounds, secondsFromFirstToLast: wall(loopRounds) },
      cap2: { token: TOK_CAP2, rounds: cap2Rounds, secondsFromFirstToLast: wall(cap2Rounds) },
    }, null, 2) + '\n')

    // ── probes ─────────────────────────────────────────────────────────────
    const transcript = (templateId) => transcripts[templateId] ?? null
    const own = (templateId, id) => transcript(templateId)?.calls.find((c) => String(c.callId) === String(id)) ?? null
    const probeOf = (templateId, id) => ({ call: callOf(id), result: own(templateId, id)?.result ?? resultOf(id) ?? null })
    const bashProbes = Array.from({ length: BURST }, (_, i) => probeOf('loop', `${CALL_BASH}-${String(i + 1)}`))
    const probes = {
      loopGoalCreate: probeOf('loop', CALL_LOOP_GOAL),
      loopGoalGet: probeOf('loop', CALL_LOOP_GET),
      loopGoalComplete: probeOf('loop', CALL_LOOP_COMPLETE),
      cap2GoalCreate: probeOf('cap2', CALL_CAP2_GOAL),
      raiseGoalCreate: probeOf('raise', CALL_RAISE_GOAL),
      raiseGoalEdit: probeOf('raise', CALL_RAISE_EDIT),
      raiseGoalPause: probeOf('raise', CALL_RAISE_PAUSE),
      ask: probeOf('ask', CALL_ASK),
      plan: probeOf('plan', CALL_PLAN),
      todo: probeOf('loop', CALL_TODO),
      bash: bashProbes,
    }
    writeFileSync(join(bootDir, 'member-probes.json'), JSON.stringify({
      schema: 'a5sf-pd25-unbounded-turn/member-probes/1',
      at: new Date().toISOString(),
      note: 'every probe call and the result the Member actually received (durable session first, mock transcript fallback)',
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
    const requestOf = (token) => requests.filter((r) => isMemberRequest(r, token) && surfaceNamesOf(r).length > 0).at(-1) ?? null
    const surfaceFor = (token) => {
      const request = requestOf(token)
      const names = request === null ? [] : [...new Set(surfaceNamesOf(request))].sort()
      return {
        tools: names,
        goalTools: Object.fromEntries(['get_goal', 'create_goal', 'update_goal'].map((n) => [n, names.includes(n)])),
        ask: names.includes('ask_user_question'),
        plan: names.includes('exit_plan_mode'),
        todo: names.includes('todo_write'),
        createGoal: surfaceEntry(request, 'create_goal'),
        updateGoal: surfaceEntry(request, 'update_goal'),
      }
    }
    const surfaces = Object.fromEntries(['loop', 'cap2', 'raise', 'plan', 'ask'].map((t) => [t, surfaceFor(TOK_OF[t])]))
    writeFileSync(join(bootDir, 'member-surface.json'), JSON.stringify(surfaces, null, 2) + '\n')

    // ── goal facts ─────────────────────────────────────────────────────────
    const eventsBySession = scanSessionEventTypes(world.home)
    const sessionOf = (templateId) => memberIds[templateId] ?? null
    const goalFactsOf = (templateId) => eventsBySession[String(sessionOf(templateId))] ?? null
    counters.goalEventsBySession = eventsBySession
    counters.loopGoalBlocked = goalFactsOf('loop')?.goalBlocked ?? []
    counters.cap2GoalBlocked = goalFactsOf('cap2')?.goalBlocked ?? []
    counters.loopDurableRounds = transcript('loop')?.goalRounds ?? []
    counters.cap2DurableRounds = transcript('cap2')?.goalRounds ?? []
    counters.loopRounds = loopRounds
    counters.cap2Rounds = cap2Rounds
    counters.burst = BURST
    counters.burstElapsedMs = (() => {
      const answered = bashProbes.map((p) => p.result?.at).filter((v) => v !== null && v !== undefined)
      return answered.length < 2 ? null : answered.at(-1) - answered[0]
    })()
    counters.askElapsedMs = (() => {
      if (callOf(CALL_ASK) === null) return null
      const times = requests.filter((r) => firstUserText(r).includes(TOK_ASK)).map((r) => new Date(r.receivedAt).getTime())
      return times.length < 2 ? null : times.at(-1) - times[0]
    })()
    counters.askBlockedSeconds = sawAskBlocked
    counters.askResult = resultOf(CALL_ASK) ?? null
    counters.planResult = resultOf(CALL_PLAN) ?? null
    counters.surfaces = Object.fromEntries(Object.entries(surfaces).map(([k, v]) => [k, { count: v.tools.length, goalTools: v.goalTools, ask: v.ask, plan: v.plan, todo: v.todo }]))
    counters.mockRequests = requests.length
    counters.memberModelRequests = Object.fromEntries(['loop', 'cap2', 'raise', 'plan', 'ask'].map((t) => [t, requests.filter((r) => isMemberRequest(r, TOK_OF[t]) && surfaceNamesOf(r).length > 0).length]))
    counters.delegationsReturned = Object.fromEntries([CALL_D_CAP2, CALL_D_RAISE, CALL_D_PLAN, CALL_D_LOOP, CALL_D_ASK].map((id) => [id, resultOf(id) !== undefined]))
    counters.askDelegationBlocked = resultOf(CALL_D_ASK) === undefined && callOf(CALL_D_ASK) !== null
    counters.membersAfter = members.length
    counters.composition = { path: composition.path, sha256: composition.sha256, arm: ARM }
    counters.raiseEditedCap = goalValueOf(probes.raiseGoalEdit)?.goal?.maxGoalRounds ?? null
    counters.raiseCreatedCap = goalValueOf(probes.raiseGoalCreate)?.goal?.maxGoalRounds ?? null
    counters.loopGoalCreateResult = resultOf(CALL_LOOP_GOAL) ?? null
    counters.cap2GoalCreateResult = resultOf(CALL_CAP2_GOAL) ?? null
    counters.maxRoundsObserved = loopRounds.length
    counters.hardObservationCap = MAX_ROUNDS
    writeFileSync(join(bootDir, 'counters.json'), JSON.stringify(counters, null, 2) + '\n')

    // ── orchestration semantics: does the delegation "return" while the ────
    // ── Member is still driving automatic rounds?                      ────
    // The Leader's history carries the delegation's tool_result; the first
    // Leader request whose payload contains that result is the moment the
    // Leader COULD observe "the delegation completed". Every goal round whose
    // model request arrived after that timestamp is a round the Leader ran
    // obliviously to.
    const leaderSawResultOf = (callId) => {
      const needle = `tool_use_id":"${callId}`
      const hit = requests.find((r) => JSON.stringify(r.messages ?? r.body ?? r).includes(needle))
      return hit === undefined ? null : hit.receivedAt
    }
    const delegationReturn = {
      schema: 'a5sf-pd25-unbounded-turn/delegation-return/1',
      at: new Date().toISOString(),
      note: 'leaderSawResultAt = receipt time of the first Leader model request whose history carries that delegation tool_result (the earliest moment the Leader can act on "delegation completed"); roundsAfterAre goal-round requests that arrived later',
      loop: (() => {
        const sawAt = leaderSawResultOf(CALL_D_LOOP)
        const after = sawAt === null ? null : loopRounds.filter((r) => r.at !== null && r.at > sawAt)
        return {
          delegateCallId: CALL_D_LOOP,
          delegationReturned: resultOf(CALL_D_LOOP) !== undefined,
          leaderSawResultAt: sawAt,
          totalRounds: loopRounds.length,
          roundsAfterLeaderSawResult: after === null ? null : after.length,
          roundTimesAfterLeaderSawResult: after === null ? null : after.map((r) => ({ round: r.round, at: r.at })),
          secondsResultToLastRound: sawAt === null || loopRounds.at(-1)?.at == null
            ? null
            : Math.round((new Date(loopRounds.at(-1).at) - new Date(sawAt)) / 100) / 10,
        }
      })(),
      ask: {
        delegateCallId: CALL_D_ASK,
        delegationReturned: resultOf(CALL_D_ASK) !== undefined,
        blockedSecondsObserved: sawAskBlocked,
      },
    }
    writeFileSync(join(bootDir, 'delegation-return.json'), JSON.stringify(delegationReturn, null, 2) + '\n')
    counters.loopRoundsAfterLeaderSawResult = delegationReturn.loop.roundsAfterLeaderSawResult

    // ── judges ─────────────────────────────────────────────────────────────
    const verdicts = {
      selfContinuation: judgeSelfContinuation({
        expect: ARM,
        createProbe: probes.loopGoalCreate,
        rounds: loopRounds,
        completeProbe: probes.loopGoalComplete,
        goalBlocked: counters.loopGoalBlocked,
        sessionGoalRounds: counters.loopDurableRounds,
        delegateReturned: resultOf(CALL_D_LOOP) !== undefined,
      }),
      roundLimit: judgeRoundLimit({ expect: ARM, createProbe: probes.cap2GoalCreate, rounds: cap2Rounds, goalBlocked: counters.cap2GoalBlocked }),
      callerChosenCap: judgeCallerChosenCap({ expect: ARM, createProbe: probes.raiseGoalCreate, editProbe: probes.raiseGoalEdit, pauseProbe: probes.raiseGoalPause }),
      burst: judgeBurst({ bashProbes }),
      ask: judgeAsk({ expect: ARM, delegationReturned: resultOf(CALL_D_ASK) !== undefined, askProbe: probes.ask, askOutcome: { kind: sawAskBlocked !== null ? 'blocked' : 'answered', elapsedMs: counters.askElapsedMs }, blockedSeconds: sawAskBlocked }),
      plan: judgePlan({ planProbe: probes.plan }),
      todo: judgeTodo({ todoProbe: probes.todo, loopTranscript: transcript('loop'), otherTranscripts: ['cap2', 'raise', 'plan', 'ask'].map(transcript) }),
      goalToolsAbsent: verdictOf(
        ARM === 'postfix'
          ? 'the goal tools are GONE from the governed Member surface: every goal call is a typed `unknown tool` and nothing executes'
          : 'PRE-FIX (defect baseline): the goal tools ARE on the governed Member surface and accept calls',
        ARM === 'postfix'
          ? [
            { id: 'create-goal-absent', ok: surfaces.loop.goalTools.create_goal === false, detail: `create_goal on surface=${String(surfaces.loop.goalTools.create_goal)}` },
            { id: 'update-goal-absent', ok: surfaces.loop.goalTools.update_goal === false, detail: `update_goal on surface=${String(surfaces.loop.goalTools.update_goal)}` },
            { id: 'get-goal-absent', ok: surfaces.loop.goalTools.get_goal === false, detail: `get_goal on surface=${String(surfaces.loop.goalTools.get_goal)}` },
            { id: 'create-typed-unknown', ok: isErrorResult(probes.loopGoalCreate) && /unknown tool "create_goal"/u.test(resultText(probes.loopGoalCreate)), detail: resultText(probes.loopGoalCreate).slice(0, 160) },
          ]
          : [
            { id: 'create-goal-present', ok: surfaces.loop.goalTools.create_goal === true, detail: `create_goal on surface=${String(surfaces.loop.goalTools.create_goal)}` },
            { id: 'update-goal-present', ok: surfaces.loop.goalTools.update_goal === true, detail: `update_goal on surface=${String(surfaces.loop.goalTools.update_goal)}` },
            { id: 'get-goal-present', ok: surfaces.loop.goalTools.get_goal === true, detail: `get_goal on surface=${String(surfaces.loop.goalTools.get_goal)}` },
            { id: 'create-accepted', ok: isErrorResult(probes.loopGoalCreate) === false, detail: resultText(probes.loopGoalCreate).slice(0, 160) },
          ],
      ),
    }
    const add = (id, verdict, detail) => {
      const { verdict: _ignored, ...rest } = detail ?? {}
      const runVerdict = toRunVerdict(verdict)
      record.addCase(id, runVerdict, rest)
      log(`[boot${String(index)}] case ${id}: ${runVerdict}${verdict === 'PROVEN' ? '' : ` failed=${JSON.stringify(detail?.failed ?? [])}`}`)
    }
    add('pd25:goal-self-continuation', verdicts.selfContinuation.verdict, verdicts.selfContinuation)
    add('pd25:goal-round-limit', verdicts.roundLimit.verdict, verdicts.roundLimit)
    add('pd25:goal-cap-caller-chosen', verdicts.callerChosenCap.verdict, verdicts.callerChosenCap)
    add('pd25:no-tool-call-cap', verdicts.burst.verdict, verdicts.burst)
    add('pd25:ask-user-unattended', verdicts.ask.verdict, verdicts.ask)
    add('pd25:exit-plan-non-plan', verdicts.plan.verdict, verdicts.plan)
    add('pd25:todo-session-local', verdicts.todo.verdict, verdicts.todo)
    add('pd25:goal-tools-absent', verdicts.goalToolsAbsent.verdict, verdicts.goalToolsAbsent)

    collectDiagnostics('final')
    const final = record.finalize()
    const summary = formatSummary(final)
    writeFileSync(join(bootDir, 'run-record.json'), JSON.stringify(final, null, 2) + '\n')
    writeFileSync(join(bootDir, 'summary.txt'), summary + '\n')
    log(`[boot${String(index)}] ${summary}`)

    result = {
      boot: index, arm: ARM, worldId: world.id, port: bootInfo.port,
      runId, summary, overall: final.overall,
      memberIds,
      counters, verdicts, paths,
      transcripts: Object.fromEntries(Object.entries(transcripts).map(([k, t]) => [k, t === null ? null : {
        sessionId: t.sessionId, lineCount: t.lineCount, todoWrites: t.todoWrites,
        goalRounds: t.goalRounds, calls: t.calls, finalAssistant: t.finalAssistant, user: t.user,
      }])),
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
        teardown = await world.teardown({ keepHome: process.env.A5SF_PD25_KEEP_HOME === '1' })
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

/** team-remote call with a lane-long deadline (the create RPC settles with the
 *  initial work turn, so the shared 60 s default is not enough). */
async function teamRpc(origin, cookie, method, params, tag, timeoutMs = 300_000) {
  return fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`, method, payload: { version: 1, params } }),
  }, timeoutMs)
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
  out.push('')
  for (const u of transcript.user) {
    const text = u.trim()
    out.push('USER:', text.length <= 900 ? text : `${text.slice(0, 900)}\n… [rendered truncated at 900 chars; the full text is in the transcript JSON]`, '')
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

/**
 * The agreed set is every DISCRETE measurement the two boots must reproduce.
 * Wall-clock durations (`burstElapsedMs`, `askElapsedMs`) are recorded in the
 * per-boot counters but deliberately NOT agreed: they vary with host load and
 * agreeing on them would make the pair a timing test.
 */
function buildAgreement(results) {
  const ok = results.filter((r) => r?.failed !== true)
  const pick = (r) => ({
    arm: r?.arm ?? null,
    overall: r?.overall ?? null,
    selfContinuation: r?.verdicts?.selfContinuation?.verdict ?? null,
    roundLimit: r?.verdicts?.roundLimit?.verdict ?? null,
    callerChosenCap: r?.verdicts?.callerChosenCap?.verdict ?? null,
    burstVerdict: r?.verdicts?.burst?.verdict ?? null,
    ask: r?.verdicts?.ask?.verdict ?? null,
    plan: r?.verdicts?.plan?.verdict ?? null,
    todo: r?.verdicts?.todo?.verdict ?? null,
    goalToolsAbsent: r?.verdicts?.goalToolsAbsent?.verdict ?? null,
    surfaceCount: r?.counters?.surfaces?.loop?.count ?? null,
    createGoalOnSurface: r?.counters?.surfaces?.loop?.goalTools?.create_goal ?? null,
    loopRounds: r?.counters?.maxRoundsObserved ?? null,
    loopDefaultCap: (() => { try { return JSON.parse(String(r?.counters?.loopGoalCreateResult?.text ?? 'null'))?.goal?.maxGoalRounds ?? null } catch { return null } })(),
    cap2Rounds: (r?.counters?.cap2Rounds ?? []).length,
    cap2Blocked: (r?.counters?.cap2GoalBlocked ?? [])[0]?.code ?? null,
    raisedCap: r?.counters?.raiseEditedCap ?? null,
    burst: r?.counters?.burst ?? null,
    askBlockedSeconds: r?.counters?.askBlockedSeconds ?? null,
    askError: r?.counters?.askResult?.isError ?? null,
    planError: r?.counters?.planResult?.isError ?? null,
    memberModelRequests: JSON.stringify(r?.counters?.memberModelRequests ?? null),
    delegationsReturned: JSON.stringify(r?.counters?.delegationsReturned ?? null),
    askDelegationBlocked: r?.counters?.askDelegationBlocked ?? null,
  })
  const rows = ok.map((r) => ({ boot: r.boot, ...pick(r) }))
  const keys = Object.keys(pick(ok[0] ?? {}))
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
  return { schema: 'a5sf-pd25-unbounded-turn/agreement/1', arm: ARM, at: new Date().toISOString(), boots: results.length, agreeing, differing, rows, table }
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
    scope: 'DEV-LIVE', face: 'UnboundedTurn', world: LINE,
    source: `task PD25-UNBOUNDED-TURN explicit boot authorisation (2026-11-14), arm=${ARM}`,
  }
  const archived = archivePriorRuns()
  log(`ARCHIVE: ${archived === null ? '(nothing to archive)' : archived}`)
  writeFileSync(join(EVIDENCE, `driver-digest-${ARM}.json`), JSON.stringify({
    at: startedAt, arm: ARM, head, hostTree: HOST_TREE, hostSha: hostDigest(), pin: TEST_USE_BASELINE_SHA,
    driverSha256: sha256(fileURLToPath(import.meta.url)), jsSubstitutions: layer.jsSubstitutions,
    composition, authorization, hardObservationCap: MAX_ROUNDS, burst: BURST,
    command: `node tests/world-factory/drivers/a5sf-pd25-unbounded-turn/run-boot.mjs --arm ${ARM}${BOOTS_WANTED === 2 ? '' : ` --boots ${String(BOOTS_WANTED)}`}`,
  }, null, 2) + '\n')
  log(`START arm=${ARM} head=${head} composition=${composition.path} sha256=${composition.sha256} hostTree=${HOST_TREE} pin=${TEST_USE_BASELINE_SHA} boots=${String(BOOTS_WANTED)} cap=${String(MAX_ROUNDS)}`)
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
  const agreementPath = ARM === 'prefix' ? join(EVIDENCE, 'archive', 'pair-prefix') : EVIDENCE
  mkdirSync(agreementPath, { recursive: true })
  writeFileSync(join(agreementPath, 'agreement.json'), JSON.stringify(agreement, null, 2) + '\n')
  writeFileSync(join(agreementPath, 'agreement.txt'), agreement.table + '\n')
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
