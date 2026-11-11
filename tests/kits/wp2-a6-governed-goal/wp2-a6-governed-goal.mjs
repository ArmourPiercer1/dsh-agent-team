#!/usr/bin/env node
/**
 * wp2-a6-governed-goal.mjs — WP2 (P0): the Goal × Alpha.6 × Alpha.5-governed
 * conjunction, measured for TWO input provenances.
 *
 * WHY THIS FILE EXISTS. Two successes existed only in isolation: (a) Alpha.6
 * OFF + a governed Member drives the Goal trio across rounds and converges
 * (`a5sf-pd29-goal-stop`); (b) Alpha.6 ON routes approvals to an Officer and
 * executes (`c1-leader-approval-smoke`). No shipped instrument booted
 * `Alpha.5 governed ∧ Alpha.6 review routing/attribution ∧ Goal`, so C2-2
 * recorded that conjunction as NOT ESTABLISHED. This kit measures it, and it
 * measures the documented semantic edge rather than papering over it:
 * upstream `create_goal` requires a DIRECT HUMAN turn (`hasDirectHumanInput`),
 * and the Alpha.6 opt-in makes a machine relay carry
 * `source.kind: 'plugin:dsh-agent-team'`. So the SAME Team wire is expected to
 * AUTHORISE a human `member.send` and REFUSE a machine relay — with the typed
 * refusal, no goal, and ordinary work still delivered.
 *
 * ═════════════ WHAT IS PROVEN / NOT PROVEN (read before citing) ═════════════
 *
 * MEASURED (each arm, twice, fresh World each — n=2 is agreement, not stability):
 *   ARM 1 (direct human input). A human `member.send`
 *     (`caller: {kind:'human', humanId:<owned team root>}` → the messaging
 *     coordinator's `fromHumanId`, i.e. `attribution.fromHumanId` set) starts
 *     the governed Member's turn. The Member's model calls the REAL upstream
 *     `create_goal`; the goal lands durably; `get_goal` agrees; `update_goal
 *     action:"edit"` advances the revision inside the same human-authorised
 *     turn; the goal then runs >= 2 automatic rounds through the REAL upstream
 *     goal-round driver; a HUMAN Stop (`session/cancel` on the Member's own
 *     session — the UI stop button) leaves the durable goal `paused`, with no
 *     further round. The Member's governed tool calls record
 *     `a5sf-guard-consult/1` facts in the same run.
 *   ARM 2 (Team relay input). A machine relay (`member.send` with
 *     `caller:{kind:'instance', instanceId:<Leader>}` — the SAME
 *     `sendTeamMessage` port the `team_send_message` tool calls) starts the
 *     turn under the Alpha.6 opt-in. The Member's `create_goal` is REFUSED by
 *     the existing upstream authority with `GOAL_TOOL_AUTHORITY_REQUIRED`
 *     ("this goal operation requires a direct human turn on a top-level
 *     agent"); NO goal is created; the turn's `user/message` carries
 *     `source.kind:'plugin:dsh-agent-team'` (nothing pretends it was human);
 *     a governed `bash` in the same turn still executes and records an allow
 *     fact. CONTROL: the SAME Member, in a WORK delivery turn
 *     (`member.followup`, which the product keeps human-attributed) DOES
 *     create a goal — the refusal is scoped to the relay provenance, not to
 *     "goals are broken".
 *
 * NOT PROVEN HERE (disclosed, and the reason is a product refusal, not a skip):
 *   - THE THREE-WAY SINGLE-TEAM CONJUNCTION. On this candidate a Team is
 *     EITHER an Alpha.6 v5 Team (Officer routing) OR an Alpha.5 governed-realm
 *     Team: the governed provider derives each Member ceiling through
 *     `derivedMembersOf`, which refuses `schemaVersion !== 4`
 *     (`MEMBER_POLICY_WITHOUT_BLUEPRINT`), while the Alpha.6 opt-in requires a
 *     v5 bound blueprint. That is release-notes §4.8 / PD-42 (F-1), measured by
 *     the packaged acceptance. This kit therefore runs the closest honest
 *     conjunction:
 *       EXACT  — the Alpha.6 OPT-IN is on for the whole Host row
 *                (`alpha6ReviewRouting: true`, v5 root anchor with
 *                `reviewRouting` + Officer template, durable wake-intent path);
 *                the Host boot is fail-closed, so a missing seam/path refuses
 *                the boot instead of degrading. The Alpha.6 machine-relay
 *                attribution branch is the live one this row measures.
 *       EXACT  — the governed Member: shipped `a5sf-governed-member` preset +
 *                `a5sfGovernedRealm: true`; its tool calls go through the
 *                confined faces and record guard-consult facts.
 *       EXACT  — the Goal tools are the upstream ones on that Member, driven by
 *                the upstream goal-round driver.
 *       APPROXIMATED — the governed Member's OWN Team is a v4 Team, so a review
 *                raised in it would route to its Leader, not to an Officer
 *                (`routingForRoot` answers null for a non-v5 root → the router
 *                holds `config-invalid`; not exercised here). The A6 plane's
 *                Officer routing/wake listeners are armed at the boot root
 *                (the v5 A6 Team), not for the governed Team's reviews.
 *     A reader who needs "Officer-routed review ∧ governed realm ∧ Goal in ONE
 *     Team" must treat that as NOT ESTABLISHED on this candidate and cite the
 *     typed refusal, not this kit.
 *
 * FLAGS
 *   --arm arm1|arm2     required; which provenance this invocation measures
 *   --runs N            default 1; sequential runs, each a FRESH World/DSH_HOME
 *   --plan              host-free: validate the composition/blueprints, no boot
 *   --probe-planes      host-free: derive the governed realm from the v4 and v5
 *                       blueprints and record the exact v5 refusal (why one Team
 *                       cannot carry both planes); writes plane-probe.json
 *   --keep-home         keep the run's DSH_HOME for inspection (default: torn down)
 *   Env (diagnostics only, never semantics):
 *   WP2_RUNS_DIR=<dir>  override the evidence root (default the tracked evidence
 *                       dir); WP2_HOST_TREE=<built pinned tree> override the host
 *   WP2_GOAL_SILENT_MS=<ms> observation window after a human Stop/goal pause
 *   WP2_A5_EVIDENCE=<path> override the guard-consult sink path
 *
 * PORTS / WORLD DISCIPLINE. Every Host and mock port is leased by the World
 * factory from the sanctioned bands in `tests/paths.mjs`
 * (`HOST_PORT_BANDS 3181-3199, 13000-13049`; `MOCK_PORT_BANDS 3491-3500,
 * 13050-13099`) so sibling lanes cannot collide; `:3080` is never bound. A
 * fixed 1600x band is deliberately NOT used: it is outside `TEST_PORT_RANGES`
 * (the repo's single source of truth for test ports) and the factory is the
 * only sanctioned leaser. Each run gets a fresh `tests/homes/<world>` home and
 * is torn down by identity; the pinned host tree is read-only
 * (porcelain verified before/after).
 *
 * RECORD CLASS. Runs are written `CANDIDATE-C2` (the PRODUCT under test is the
 * candidate commit; this kit is only the instrument), which permits but does not
 * assert a candidate claim. Evidence: dev/agent-workflow/evidence/wp2-
 * a6-governed-goal/. The kit AUTHORS the two blueprints it boots (v5 for the
 * Alpha.6 anchor, v4 for the governed Team), so it is one recorded identity in
 * the blueprint-version fence baseline — see that baseline's dated note.
 *
 * EXIT CODES
 *   0  every assertion of the selected arm is PROVEN (and, with --runs >= 2,
 *      the pair agrees)
 *   1  an assertion is REFUTED, an arm threw, or the pair disagrees — the
 *      measured failure is in the run's `result.json`
 *   3  CONJUNCTION_REFUSED: the product refused the composition itself (boot /
 *      Team create / Member setup). The typed refusal is recorded under the
 *      run dir; this is the honest "the product makes it impossible" result.
 *   4  usage/configuration error before any World exists
 *
 * @module tests/kits/wp2-a6-governed-goal
 */
import { execFileSync, spawnSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  appendFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { zstdDecompressSync } from 'node:zlib'

import { apiPrompt, apiSessionCancel, authenticate, fetchJson } from '../../world-factory/lib/world-factory.mjs'
import { createRunRecord, formatSummary, readAuthorityBinding } from '../../world-factory/lib/run-record.mjs'
import { acquireDevLiveSlot } from '../../world-factory/lib/dev-live-slots.mjs'
import { createA5sfHarness } from '../../world-factory/lib/a5sf-harness.mjs'
import { resolveHeadCommit } from '../../world-factory/suites/150-a5sf-read.mjs'
import { lastUserTextOfStatic, messagesOf, textOf } from '../../world-factory/lib/u6-fs-assembly.mjs'
import { TEST_USE_BASELINE_SHA } from '../../paths.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..', '..')
const EVIDENCE = process.env.WP2_RUNS_DIR !== undefined && process.env.WP2_RUNS_DIR !== ''
  ? resolve(process.env.WP2_RUNS_DIR)
  : join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence', 'wp2-a6-governed-goal')
const LEDGER_PATH = join(EVIDENCE, 'run-ledger.jsonl')

const LINE = 'wp2a6goal'
const BOOT_ROOT = 'session-wp2-a6-boot'
const TEAM_ROOT = 'session-wp2-governed-team'
const BP_ANCHOR_ID = 'team.wp2.a6.anchor'
const BP_MAIN_ID = 'team.wp2.governed'
const PRESET_ID = 'a5sf-governed-member'
const WORKER_TEMPLATE = 'worker'

const MK_DISC = 'WP2_DISC'
const MK_LEADER = 'WP2_LEADER_DELEGATE'
const MK_READY = 'WP2_WORKER_READY'
const MK_ARM1 = 'WP2_ARM1_HUMAN_GOAL'
const MK_ARM2 = 'WP2_ARM2_MACHINE_RELAY'
const MK_ARM2_WORK = 'WP2_ARM2_WORK_CONTROL'
const DONE = 'WP2_DONE'

const CALL = Object.freeze({
  delegate: 'call-wp2-delegate-worker',
  a1Create: 'call-wp2-a1-create-goal',
  a1Get: 'call-wp2-a1-get-goal',
  a1Edit: 'call-wp2-a1-edit-goal',
  a1Round: (round) => `call-wp2-a1-round-${String(round)}`,
  a2Create: 'call-wp2-a2-create-goal',
  a2Bash: 'call-wp2-a2-governed-bash',
  a2WorkCreate: 'call-wp2-a2work-create-goal',
  a2WorkRound: (round) => `call-wp2-a2work-round-${String(round)}`,
})
const SILENT_MS = Number(process.env.WP2_GOAL_SILENT_MS ?? 6000)

const argv = process.argv.slice(2)
const PLAN_ONLY = argv.includes('--plan')
const PROBE_ONLY = argv.includes('--probe-planes')
const KEEP_HOME = argv.includes('--keep-home')
const argOf = (name) => {
  const i = argv.indexOf(name)
  return i < 0 ? undefined : argv[i + 1]
}
const ARM = argOf('--arm')
const RUNS_WANTED = (() => {
  const n = Number(argOf('--runs') ?? 1)
  return Number.isSafeInteger(n) && n >= 1 ? n : 1
})()
const startedAt = new Date().toISOString()

let RUN_LOG = null
function log(line) {
  const text = `[${new Date().toISOString()}] ${line}`
  process.stdout.write(`${text}\n`)
  try { if (RUN_LOG !== null) appendFileSync(RUN_LOG, `${text}\n`) } catch { /* best effort */ }
}
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
const redact = (t) => String(t ?? '').replace(/\?token=[A-Za-z0-9_-]+/gu, '?token=<redacted>')
const utcStamp = () => new Date().toISOString().replace(/[:.]/gu, '-')
const nowMs = () => Date.now()
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

// ─────────────────────────────────────────────────────────────────────────────
// host tree / install graph / shipped composition (the pd29-proven pieces)
// ─────────────────────────────────────────────────────────────────────────────
function hostTreePath() {
  const built = (dir) => existsSync(join(dir, 'apps', 'cli', 'lib', 'bin.js'))
  const override = process.env.WP2_HOST_TREE
  if (override !== undefined && override !== '') {
    const dir = resolve(override)
    if (!built(dir)) throw new Error(`WP2_HOST_TREE=${dir} carries no built CLI (apps/cli/lib/bin.js)`)
    return dir
  }
  const candidates = [join(REPO_ROOT, 'tests', 'deepseek-harness-test-use')]
  try {
    const common = execFileSync('git', ['-C', REPO_ROOT, 'rev-parse', '--path-format=absolute', '--git-common-dir'], { encoding: 'utf8' }).trim()
    candidates.push(join(dirname(common), 'tests', 'deepseek-harness-test-use'))
  } catch { /* not a git checkout */ }
  candidates.push('/srv/workspace/dsh-stable-3-0.2.0-rc.2/deepseek-harness')
  for (const dir of candidates) {
    try {
      if (lstatSync(dir).isDirectory() && built(dir)) return dir
    } catch { /* absent */ }
  }
  throw new Error(`no BUILT pinned host tree found (tried ${candidates.join(', ')})`)
}
const HOST_TREE = hostTreePath()

/**
 * The production INSTALL GRAPH inside the World's own DSH_HOME (pd29, the
 * #676/#678 regression): the shipped governed preset names subpath rows, and a
 * preset row resolves through the PROFILE's module graph. A real install has
 * the package under `profiles/web/node_modules`; the pinned test tree does not
 * install this repository, so the World links it the way an install would. No
 * row name is rewritten — this is a deployment property of the World.
 */
function installGraph(home) {
  const profileModules = join(home, 'profiles', 'web', 'node_modules')
  mkdirSync(profileModules, { recursive: true })
  const link = join(profileModules, 'dsh-agent-team')
  if (!existsSync(link)) symlinkSync(REPO_ROOT, link, process.platform === 'win32' ? 'junction' : 'dir')
  const manifest = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'))
  for (const subpath of ['./host', './web-tool', './web-transport', './client']) {
    const target = manifest.exports?.[subpath]
    if (target === undefined) throw new Error(`install graph: package.json declares no export '${subpath}'`)
    const absolute = join(REPO_ROOT, String(target).replace(/^\.\//u, ''))
    if (!existsSync(absolute)) throw new Error(`install graph: export '${subpath}' -> ${String(target)} does not exist in this tree`)
  }
  return { link, exports: Object.keys(manifest.exports ?? {}).length }
}

const require_ = createRequire(join(REPO_ROOT, 'package.json'))

function shippedLayer() {
  const YAML = require_('yaml')
  const raw = readFileSync(join(REPO_ROOT, 'cordis.patch.yml'), 'utf8')
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
function presetPluginIds(layer) {
  const preset = layer.rows.find((row) => row?.config?.id === PRESET_ID)
  if (preset === undefined) throw new Error(`the shipped layer carries no preset '${PRESET_ID}' row`)
  const flatten = (list) => (list ?? []).flatMap((p) => (p?.group === true ? flatten(p.config) : [p]))
  return flatten(preset.config.plugins)
}

// ─────────────────────────────────────────────────────────────────────────────
// blueprints — the A6 v5 anchor (boot root) + the v4 governed Team (created)
// ─────────────────────────────────────────────────────────────────────────────
/**
 * The Alpha.6 OPT-IN anchor: a v5 blueprint with `reviewRouting` enabled and one
 * legal Officer template. `root.ts` fail-closes the boot when the composition
 * cannot be created from it (`TEAM_PLUGIN_CONFIG_INVALID`), so a running Host
 * carrying this anchor IS the "the A6 plane composed" fact. It declares the
 * Officer and the governed Team's worker template, but the boot root has NO
 * Member instance: the v5 root never mounts the governed realm (which would
 * refuse a v5 source — the disclosed F-1/PD-42 limit).
 */
function anchorBlueprint() {
  return {
    schemaVersion: 5,
    blueprintId: BP_ANCHOR_ID,
    revision: '1',
    leader: { templateId: 'leader', persona: 'You lead the WP2 Alpha.6 anchor team. Do not delegate.' },
    members: [
      { templateId: 'officer', persona: 'You are the WP2 Alpha.6 Officer. Resolve review legs routed to you; do not execute work.' },
      { templateId: WORKER_TEMPLATE, persona: 'You are a WP2 worker template of the anchor; no instance is created here.' },
    ],
    requirements: [],
    memberEnvelopes: [],
    policyStates: [{ id: 'default', description: 'Default state.' }],
    permissionMutationEnvelope: { rules: [] },
    teamHardEnvelope: { rules: [] },
    teamEnvelope: { allow: ['request-control', 'create-member', 'assign-task', 'send-message', 'report-progress'], deny: [] },
    metadata: {},
    reviewRouting: {
      enabled: true,
      officerTemplateId: 'officer',
      ordinaryToolApprovals: { default: 'officer', leaderExceptions: [] },
      whenOfficerUnavailable: 'hold',
    },
  }
}

function lane(allow) {
  return { mode: 'restricted', allow: [...allow], ask: [], deny: [] }
}

/**
 * The v4 GOVERNED Team (created through `team.create` on the SAME host row).
 * `memberIoCeilings` is the ONE authoring carrier the governed realm derives
 * from (`derivedMembersOf` accepts v4 and only v4).
 */
function mainBlueprint({ workspace }) {
  return {
    schemaVersion: 4,
    blueprintId: BP_MAIN_ID,
    revision: '1',
    leader: {
      templateId: 'leader',
      persona: `You lead the WP2 governed team. ${MK_LEADER} delegates the worker exactly once.`,
    },
    members: [
      { templateId: WORKER_TEMPLATE, displayName: 'WP2 Governed Worker', persona: 'You are the WP2 governed worker. Run the probes exactly once each.' },
    ],
    requirements: [],
    teamEnvelope: {
      allow: ['create-member', 'assign-task', 'send-message', 'report-progress', 'archive-member', 'restore-member'],
      deny: [],
    },
    memberEnvelopes: [],
    policyStates: [{ id: 'default', description: 'Default state.' }],
    permissionMutationEnvelope: { rules: [] },
    teamHardEnvelope: { rules: [] },
    metadata: {},
    memberIoCeilings: [
      { templateId: WORKER_TEMPLATE, io: { read: lane([workspace]), write: lane([workspace]), network: { mode: 'allow' } } },
    ],
  }
}

function blueprintYaml(doc) {
  return `---\n${JSON.stringify(doc, null, 2)}\n---\n`
}
function blueprintFacade() {
  return require_(join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'domain', 'blueprint', 'src', 'index.js'))
}
function assertBlueprintText(text, wantId) {
  let parsed
  try {
    parsed = blueprintFacade().parseBlueprint(text)
  } catch (error) {
    throw new Error(`${wantId} rejected by the host validator: ${String(error?.message ?? error)} ${JSON.stringify(error?.details?.problems ?? null)}`)
  }
  const doc = parsed.blueprint ?? parsed
  if (doc.blueprintId !== wantId) throw new Error(`${wantId} resolves as ${String(doc.blueprintId)}`)
  return { ok: true, schemaVersion: doc.schemaVersion, via: 'parseBlueprint(dist domain facade)' }
}

// ─────────────────────────────────────────────────────────────────────────────
// the host row + the World composition
// ─────────────────────────────────────────────────────────────────────────────
function composedRows({ home, anchorYaml, layer, bootPhase }) {
  const hostRow = layer.rows.find((row) => row?.name === 'dsh-agent-team/host')
  const presetRow = layer.rows.find((row) => row?.config?.id === PRESET_ID)
  if (hostRow === undefined) throw new Error('the shipped layer carries no dsh-agent-team/host row')
  if (presetRow === undefined) throw new Error(`the shipped layer carries no preset '${PRESET_ID}' row`)
  const config = {
    ...hostRow.config,
    rootSessionId: BOOT_ROOT,
    bootPhase,
    blueprintSource: anchorYaml,
    blueprintDir: join(home, 'blueprints'),
    seedMembers: [],
    memberPresetId: PRESET_ID,
    // The governed realm (Alpha.5) — the neutral opt-in key.
    a5sfGovernedRealm: true,
    a5sfEvidencePath: join(home, 'a5sf-consult.jsonl'),
    // The Alpha.6 opt-in (whole Host row). Boot is fail-closed.
    alpha6ReviewRouting: true,
    alpha6WakeIntentPath: join(home, 'alpha6-wake-intents'),
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
function p6t6Directive({ worldId, logDir, phase }) {
  return { boot: 1, phase, reportDir: logDir, runStamp: worldId, rootSessionId: TEAM_ROOT }
}

// ─────────────────────────────────────────────────────────────────────────────
// mock-model request helpers
// ─────────────────────────────────────────────────────────────────────────────
function firstUserText(req) {
  const first = messagesOf(req).find((m) => m?.role === 'user')
  if (first === undefined) return ''
  return typeof first.content === 'string' ? first.content : JSON.stringify(first.content ?? '')
}
function resultIdsOf(req) {
  const ids = new Set()
  for (const message of messagesOf(req)) {
    if (message?.tool_call_id !== undefined) ids.add(String(message.tool_call_id))
    if (message?.toolCallId !== undefined) ids.add(String(message.toolCallId))
    if (!Array.isArray(message?.content)) continue
    for (const block of message.content) {
      if (block?.type === 'tool_result') {
        const id = block?.tool_use_id ?? block?.tool_call_id ?? block?.callId
        if (id !== undefined) ids.add(String(id))
      }
    }
  }
  return ids
}
function anyMessageText(req) {
  return messagesOf(req).map(textOf).join('\n')
}
/** Does THIS model request carry `needle` anywhere in its conversation? */
function reqCarries(req, needle) {
  return anyMessageText(req).includes(needle)
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
function lastGoalRef(text) {
  const re = /"goal"\s*:\s*\{\s*"id"\s*:\s*"(goal-[^"]+)"\s*,\s*"revision"\s*:\s*(\d+)/gu
  let hit = null
  let m
  while ((m = re.exec(text)) !== null) hit = { id: m[1], revision: Number(m[2]) }
  return hit
}
function roundOfRequest(req) {
  const m = /Round: (\d+)\/(\d+)/u.exec(lastUserTextOfStatic(req))
  return m === null ? null : { round: Number(m[1]), maxRounds: Number(m[2]) }
}
/**
 * The goal-round driver's OWN user message, found anywhere in the request (a
 * request that follows a tool result no longer has it as the LAST user-shaped
 * message; the upstream conversion may render the tool result in that slot).
 */
function goalRoundOf(str) {
  const marker = String(str ?? '')
  const idx = marker.lastIndexOf('<goal_round>')
  if (idx < 0) return null
  const m = /Round: (\d+)\/(\d+)/u.exec(marker.slice(idx))
  return m === null ? null : { round: Number(m[1]), maxRounds: Number(m[2]) }
}
function roundOfUserText(text) {
  const m = /Round: (\d+)\/(\d+)/u.exec(String(text ?? ''))
  return m === null ? null : { round: Number(m[1]), maxRounds: Number(m[2]) }
}
function toolCallFor(requests, callId) {
  for (const req of requests) {
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

/**
 * The scripted model. Every branch is selected structurally by a marker so no
 * branch can bleed into another turn. The model never fabricates an authority:
 * every `create_goal` is a real tool call whose verdict the Host renders.
 */
function makeDecide({ workspaceDir, arm }) {
  const call = (id, name, args) => ({ kind: 'tool-call', toolCalls: [{ id, name, arguments: args }] })
  const multi = (calls) => ({ kind: 'tool-call', toolCalls: calls })
  const memberBash = (id, command) => call(id, 'bash', { command, description: 'WP2 governed probe', workdir: workspaceDir })
  return function decide({ req }) {
    const allText = anyMessageText(req)
    const lastUser = lastUserTextOfStatic(req)
    if (allText.includes('Generate the session title')) return { kind: 'text', content: 'wp2 a6 governed goal session' }
    const seen = resultIdsOf(req)
    const round = goalRoundOf(allText)

    // ── boot-root discovery ───────────────────────────────────────────────
    if (allText.includes(MK_DISC)) return { kind: 'text', content: 'WP2_DISC_ACK' }

    // ── the LEADER (initial root work) ────────────────────────────────────
    // Checked BEFORE the worker markers: the delegate call's ARGUMENTS carry
    // the worker's marker, and a Leader request that echoes its own tool call
    // must never be routed into a worker branch.
    if (allText.includes(MK_LEADER)) {
      if (!seen.has(CALL.delegate) && !allText.includes('WP2_DELEGATED_NOTE')) {
        return multi([
          {
            id: CALL.delegate,
            name: 'team_delegate',
            arguments: {
              rootSessionId: TEAM_ROOT,
              requestToken: `wp2-delegate-${String(Date.now())}`,
              delegationTemplateId: WORKER_TEMPLATE,
              label: 'wp2-worker',
              workspace: workspaceDir,
              prompt: `${MK_READY}: worker probe. Reply with the marker only.`,
              async: true,
            },
          },
          { id: 'call-wp2-delegate-note', name: 'team_report_progress', arguments: { rootSessionId: TEAM_ROOT, summary: 'WP2_DELEGATED_NOTE' } },
        ])
      }
      return { kind: 'text', content: `${DONE} leader` }
    }

    // ── the worker ────────────────────────────────────────────────────────
    const isWorker = allText.includes(MK_READY) || allText.includes(MK_ARM1)
      || allText.includes(MK_ARM2) || allText.includes('[team-work ')
    if (!isWorker) return { kind: 'text', content: `${DONE} noop` }

    // AN AUTOMATIC GOAL ROUND: exactly ONE governed tool call per round, then
    // text ends the round (a bare text on every request would spin the round
    // driver at memory speed). The round ids are arm-specific so a goal that
    // should not exist is visible as an `unexpected-round` call, never hidden.
    if (round !== null) {
      const id = arm === 'arm1'
        ? CALL.a1Round(round.round)
        : CALL.a2WorkRound(round.round)
      if (!seen.has(id)) return memberBash(id, `echo WP2_GOVERNED_ROUND_${String(round.round)}; sleep 0.15`)
      return { kind: 'text', content: `${DONE} round ${String(round.round)}` }
    }

    // ARM 1 — the human-attributed turn: create → get → edit, then the turn
    // ends and the goal-round driver takes over.
    if (arm === 'arm1') {
      if (!seen.has(CALL.a1Create)) {
        return call(CALL.a1Create, 'create_goal', { objective: 'WP2 Arm 1: a governed Member runs a human-authorised goal to the Stop probe.', max_goal_rounds: 100000 })
      }
      if (!seen.has(CALL.a1Get)) return call(CALL.a1Get, 'get_goal', {})
      if (!seen.has(CALL.a1Edit)) {
        const ref = lastGoalRef(allToolResultText(req))
        if (ref === null) return { kind: 'text', content: `${DONE} arm1-no-ref` }
        return call(CALL.a1Edit, 'update_goal', {
          goal_id: ref.id,
          revision: ref.revision,
          action: 'edit',
          objective: 'WP2 Arm 1: objective edited by the same direct-human turn (revision probe).',
        })
      }
      return { kind: 'text', content: `${DONE} arm1-created` }
    }

    // ARM 2 — the WORK-delivery control (the product keeps this human-attributed).
    if (allText.includes(MK_ARM2_WORK)) {
      if (!seen.has(CALL.a2WorkCreate)) {
        return call(CALL.a2WorkCreate, 'create_goal', { objective: 'WP2 Arm 2 control: a WORK delivery still authorises create_goal.', max_goal_rounds: 100000 })
      }
      return { kind: 'text', content: `${DONE} arm2-work-created` }
    }
    // ARM 2 — the machine relay turn only: create_goal must be REFUSED, then a
    // governed tool call proves the turn is otherwise a normal working turn.
    // A first-turn work delivery (MK_READY, human-attributed by the product) is
    // NOT this arm and must not borrow its probes.
    if (allText.includes(MK_ARM2)) {
      if (!seen.has(CALL.a2Create)) {
        return call(CALL.a2Create, 'create_goal', { objective: 'WP2 Arm 2: this must be refused — the turn is a machine relay.', max_goal_rounds: 100000 })
      }
      if (!seen.has(CALL.a2Bash)) {
        return memberBash(CALL.a2Bash, `echo WP2_ARM2_GOVERNED_BASH_OK; test -d ${JSON.stringify(workspaceDir)} && echo WP2_WORKSPACE_VISIBLE`)
      }
      return { kind: 'text', content: `${DONE} arm2-refused` }
    }
    return { kind: 'text', content: `${DONE} worker-ready` }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// durable transcripts (pd29-proven zstd + event readers)
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
    try { parts.push(zstdDecompressSync(pending)) } catch { /* partial tail frame */ }
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
    if (header !== null && header.id === sessionId) return { file: entry.path, header }
  }
  return null
}
function contentText(content) {
  if (typeof content === 'string') return content
  if (Array.isArray(content)) return content.map((c) => (typeof c === 'string' ? c : String(c?.text ?? ''))).join('')
  return JSON.stringify(content ?? '')
}
/**
 * Goal-and-provenance facts out of one durable session log. Everything the
 * verdicts read is a durable row: the `user/message` source kind (the
 * provenance the two authorities read), the tool call/result pairs with their
 * typed error codes, the goal/change operations, and the automatic rounds.
 */
function sessionFacts(dshHome, sessionId) {
  const found = sessionId === null ? null : findSessionFile(dshHome, sessionId)
  if (found === null) return null
  let lines = []
  try {
    lines = decompressZstdStream(readFileSync(found.file)).toString('utf8').split('\n').filter((l) => l !== '')
      .map((l) => { try { return JSON.parse(l) } catch { return null } }).filter((v) => v !== null)
  } catch { return null }
  const facts = {
    sessionId,
    file: found.file,
    agentPreset: found.header?.agentPreset ?? null,
    lineCount: lines.length,
    types: {},
    userMessages: [],
    goalRounds: [],
    goalChanges: [],
    calls: [],
    results: [],
    aborts: [],
    lastUser: null,
    lastAssistant: null,
  }
  for (const row of lines) {
    const data = row?.data ?? row
    const type = String(row?.type ?? row?.kind ?? '')
    if (type !== '') facts.types[type] = (facts.types[type] ?? 0) + 1
    const at = row?.at ?? row?.time ?? row?.timestamp ?? null
    if (type === 'user/message') {
      const message = data?.message ?? data
      const text = contentText(message?.content)
      const source = message?.source ?? data?.source ?? {}
      facts.lastUser = text.slice(0, 400)
      facts.userMessages.push({ at, seq: row?.seq ?? null, kind: source?.kind ?? null, text: text.slice(0, 600), round: source?.round ?? null, goalId: source?.goalId ?? null })
      if (source?.kind === 'goal') facts.goalRounds.push({ round: source.round, goalId: source.goalId, revision: source.revision, at })
    }
    if (type === 'goal/change') {
      const goal = data?.goal ?? data?.snapshot ?? null
      facts.goalChanges.push({
        at,
        operation: data?.operation ?? null,
        phase: goal?.phase ?? null,
        revision: goal?.revision ?? null,
        id: goal?.id ?? null,
        roundsStarted: data?.roundsStarted ?? null,
        maxGoalRounds: goal?.maxGoalRounds ?? null,
        blockedCode: goal?.blockedReason?.code ?? null,
      })
    }
    if (type === 'tool/call') {
      facts.calls.push({ at, name: data?.name ?? null, callId: data?.callId ?? data?.id ?? null, input: data?.input ?? data?.arguments ?? null })
    }
    if (type === 'tool/result') {
      const message = data?.message ?? data
      const error = data?.error ?? message?.error ?? null
      facts.results.push({
        at,
        callId: message?.source?.callId ?? data?.callId ?? message?.toolCallId ?? null,
        isError: data?.isError === true || message?.isError === true,
        text: contentText(message?.content).slice(0, 1200),
        code: error?.code ?? null,
        errorName: error?.name ?? null,
      })
    }
    if (type === 'turn/end') {
      const reason = data?.reason ?? data?.cause ?? null
      const kind = typeof reason === 'string' ? reason : reason?.kind ?? null
      facts.aborts.push({ at, kind })
    }
    if (type === 'assistant/message') {
      const message = data?.message ?? data
      const text = contentText(message?.content)
      if (text.trim() !== '') facts.lastAssistant = text.slice(0, 400)
    }
  }
  return facts
}

// ─────────────────────────────────────────────────────────────────────────────
// remote RPC helpers (the same surfaces the UI/messaging tools use)
// ─────────────────────────────────────────────────────────────────────────────
async function teamRpc(origin, cookie, method, params, tag, timeoutMs = 300_000) {
  return fetchJson(`${origin}/team-remote/${String(method)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`, method, payload: { version: 1, params } }),
  }, timeoutMs)
}
async function goalRpc(origin, cookie, method, params) {
  return fetchJson(`${origin}/api/goals/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: `wp2-${method}-${Math.random().toString(36).slice(2, 10)}`, method: `goals/${method}`, payload: { args: params } }),
  }, 60_000)
}
async function goalGet(origin, cookie, agentId) {
  const res = await goalRpc(origin, cookie, 'get', { agentId })
  const value = res.body?.result?.value ?? null
  return { status: res.status, ok: res.body?.result?.ok === true, goal: value ?? null, error: res.body?.result?.error ?? null }
}
const goalRef = (goal) => goal === null ? null : { id: goal.id, revision: goal.revision }
async function goalPause(origin, cookie, agentId) {
  const current = await goalGet(origin, cookie, agentId)
  if (current.goal === null) return { status: current.status, ok: false, error: current.error ?? 'no goal' }
  const res = await goalRpc(origin, cookie, 'pause', { agentId, ref: goalRef(current.goal) })
  return { status: res.status, ok: res.body?.result?.ok === true, value: res.body?.result?.value ?? null, error: res.body?.result?.error ?? null }
}
async function p6t6Tool(origin, name, args, as) {
  return fetchJson(`${origin}/__p6t6/tool`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ name, args, as }),
  }, 240_000)
}
async function p6t6State(origin) {
  return fetchJson(`${origin}/__p6t6/state`, undefined, 60_000)
}
function allMockRequests(world) {
  return world?.mock?.requests ?? []
}
function memberRoundRequests(world, token) {
  return allMockRequests(world)
    .map((r, seq) => ({ r, seq }))
    .filter(({ r }) => firstUserText(r).includes(token) && roundOfRequest(r) !== null)
    .map(({ r, seq }) => ({ seq, at: r.receivedAt ?? null, ...roundOfRequest(r) }))
}

// ─────────────────────────────────────────────────────────────────────────────
// guard-consult facts (the Alpha.5 governance oracle)
// ─────────────────────────────────────────────────────────────────────────────
function consultFacts(home, memberInstanceId) {
  const path = process.env.WP2_A5_EVIDENCE !== undefined && process.env.WP2_A5_EVIDENCE !== ''
    ? resolve(process.env.WP2_A5_EVIDENCE)
    : join(home, 'a5sf-consult.jsonl')
  if (!existsSync(path)) return { path, rows: [], forMember: [], summary: { rows: 0, allow: 0, deny: 0, ask: 0 } }
  const rows = readFileSync(path, 'utf8').split('\n').filter((l) => l.trim() !== '').map((l) => {
    try { return JSON.parse(l) } catch { return null }
  }).filter((r) => r !== null)
  const forMember = rows.filter((r) => r?.memberIdentity === memberInstanceId)
  const summary = { rows: rows.length, forMember: forMember.length, allow: 0, deny: 0, ask: 0, tools: {} }
  for (const row of forMember) {
    if (row.decision === 'allow') summary.allow += 1
    else if (row.decision === 'deny') summary.deny += 1
    else if (row.decision === 'ask') summary.ask += 1
    const key = String(row.tool ?? row.method ?? '?')
    summary.tools[key] = (summary.tools[key] ?? 0) + 1
  }
  return { path, rows, forMember, summary }
}

// ─────────────────────────────────────────────────────────────────────────────
// judges — every clause reads a durable/remote measurement, never the kit log
// ─────────────────────────────────────────────────────────────────────────────
function clause(id, ok, detail) {
  return { id, ok: ok === true, detail }
}
function verdictOf(id, proposition, clauses) {
  const failed = clauses.filter((c) => c.ok !== true)
  return { id, verdict: failed.length === 0 ? 'PROVEN' : 'REFUTED', proposition, failed: failed.map((c) => `${c.id}: ${c.detail}`), clauses }
}

function judgeArm1(arm) {
  const facts = arm.facts ?? {}
  const goals = facts.goalChanges ?? []
  const created = goals.find((c) => c.operation === 'create') ?? null
  const edited = goals.find((c) => c.operation === 'edit') ?? null
  const createResult = arm.createResult ?? {}
  const getResult = arm.getResult ?? {}
  const editResult = arm.editResult ?? {}
  const createGoal = arm.createGoal ?? null
  const getGoalTool = arm.getGoalTool ?? null
  return [
    verdictOf('wp2-a6:arm1-create-authorized',
      'a direct-human member.send on the Alpha.6-on governed Member AUTHORISES the upstream create_goal',
      [
        clause('human-turn-provenance', arm.startSourceKind === 'user', `starting user/message source.kind=${String(arm.startSourceKind)} (the human member.send attribution)`),
        clause('create-not-error', createResult.isError === false, `create_goal isError=${String(createResult.isError)} text=${String(createResult.text).slice(0, 200)}`),
        clause('create-returned-goal', createGoal !== null, `create_goal result goal=${JSON.stringify(createGoal)}`),
      ]),
    verdictOf('wp2-a6:arm1-goal-durable',
      'the goal is durably created and the goal service agrees with the tool result',
      [
        clause('durable-create-row', created !== null && created.id === (createGoal?.id ?? '<none>') && created.revision === (createGoal?.revision ?? -1), `goal/change create=${JSON.stringify(created)}`),
        clause('get-tool-same-id', getGoalTool !== null && getGoalTool.id === (createGoal?.id ?? '<none>'), `get_goal tool id=${String(getGoalTool?.id)} create id=${String(createGoal?.id)}`),
        clause('get-goal-not-error', getResult.isError === false, `get_goal isError=${String(getResult.isError)}`),
        clause('get-tool-same-revision', getGoalTool !== null && getGoalTool.revision === (createGoal?.revision ?? -1), `get_goal tool revision=${String(getGoalTool?.revision)} create revision=${String(createGoal?.revision)}`),
      ]),
    verdictOf('wp2-a6:arm1-update-advances',
      'update_goal advances a phase/revision (edit is the direct-human update)',
      [
        clause('edit-not-error', editResult.isError === false, `update_goal edit isError=${String(editResult.isError)} text=${String(editResult.text).slice(0, 200)}`),
        clause('durable-edit-row', edited !== null, `goal/change edit=${JSON.stringify(edited)}`),
        clause('revision-advanced', edited !== null && createGoal !== null && Number(edited.revision) > Number(createGoal.revision), `revision ${String(createGoal?.revision)} -> ${String(edited?.revision)}`),
        clause('phase-preserved-active', edited !== null && edited.phase === 'active', `phase after edit=${String(edited?.phase)}`),
      ]),
    verdictOf('wp2-a6:arm1-rounds',
      'the goal runs >= 2 automatic rounds on the real upstream goal-round driver',
      [
        clause('rounds-count', (facts.goalRounds ?? []).length >= 2, `automatic rounds=${String((facts.goalRounds ?? []).length)}`),
        clause('round-goal-id-matches', (facts.goalRounds ?? []).every((r) => r.goalId === (createGoal?.id ?? '<none>')), `round goal ids=${JSON.stringify((facts.goalRounds ?? []).map((r) => r.goalId))}`),
      ]),
    verdictOf('wp2-a6:arm1-human-stop-terminal',
      'a human Stop leaves the durable goal non-active and starts no further round',
      [
        clause('stop-accepted', arm.stopStatus === 200, `session/cancel status=${String(arm.stopStatus)}`),
        clause('durable-paused', arm.pausedSeen === true, `durable phase after Stop=${String(arm.finalPhase)}`),
        clause('no-round-after-stop', arm.roundsAfterStop === 0, `goal rounds after the Stop=${String(arm.roundsAfterStop)} (window ${String(arm.silentWindowMs)} ms)`),
      ]),
    verdictOf('wp2-a6:arm1-governed-facts',
      "the Member's governed tool calls are recorded in the same run",
      [
        clause('guard-facts-present', (arm.consult?.summary?.allow ?? 0) > 0, `a5sf-guard-consult allow facts for the Member=${String(arm.consult?.summary?.allow ?? 0)} of rows=${String(arm.consult?.summary?.rows ?? 0)} tools=${JSON.stringify(arm.consult?.summary?.tools ?? {})}`),
        clause('facts-share-the-goal-turns', (arm.consult?.summary?.tools?.bash ?? 0) > 0, `bash consult facts=${String(arm.consult?.summary?.tools?.bash ?? 0)}`),
      ]),
  ]
}

function judgeArm2(arm) {
  const facts = arm.facts ?? {}
  const createResult = arm.createResult ?? {}
  const createGoal = arm.createGoal ?? null
  const goals = facts.goalChanges ?? []
  const machineMsg = (facts.userMessages ?? []).find((m) => String(m.text).includes(MK_ARM2)) ?? null
  const humanMsgWithRelay = (facts.userMessages ?? []).find((m) => String(m.text).includes(MK_ARM2) && m.kind === 'user') ?? null
  const bashResult = arm.bashResult ?? {}
  return [
    verdictOf('wp2-a6:arm2-create-refused',
      'a machine Team relay on the Alpha.6-on governed Member is REFUSED create_goal by the existing upstream authority, with the typed refusal',
      [
        clause('relay-provenance-machine', machineMsg !== null && machineMsg.kind === 'plugin:dsh-agent-team', `relay user/message source.kind=${String(machineMsg?.kind)}`),
        clause('create-is-error', createResult.isError === true, `create_goal isError=${String(createResult.isError)}`),
        clause('typed-code', createResult.code === 'GOAL_TOOL_AUTHORITY_REQUIRED', `tool/result error.code=${String(createResult.code)}`),
        clause('authority-text', /requires a direct human turn on a top-level agent/u.test(String(createResult.text)), `refusal text=${String(createResult.text).slice(0, 240)}`),
      ]),
    verdictOf('wp2-a6:arm2-no-goal',
      'the refusal creates NO goal',
      [
        clause('no-create-return', createGoal === null, `create_goal result goal=${JSON.stringify(createGoal)}`),
        clause('service-has-no-goal', arm.serviceGoal === null, `goals/get goal=${JSON.stringify(arm.serviceGoal)}`),
        clause('no-durable-goal-row', goals.length === 0, `goal/change rows=${JSON.stringify(goals)}`),
      ]),
    verdictOf('wp2-a6:arm2-nothing-pretends-human',
      'nothing in the run pretends the relay was a human turn',
      [
        clause('no-human-attributed-relay-text', humanMsgWithRelay === null, `user/message with relay text and source.kind=user: ${JSON.stringify(humanMsgWithRelay)}`),
        clause('machine-kind-recorded', machineMsg !== null, `machine relay message recorded=${String(machineMsg !== null)}`),
      ]),
    verdictOf('wp2-a6:arm2-refusal-scoped',
      'the refusal is scoped: ordinary tool work still runs on that turn, and a WORK delivery still authorises a goal',
      [
        clause('governed-bash-executed', bashResult.isError === false && /WP2_ARM2_GOVERNED_BASH_OK/u.test(String(bashResult.text)), `governed bash isError=${String(bashResult.isError)} text=${String(bashResult.text).slice(0, 200)}`),
        clause('governed-bash-allow-fact', (arm.consult?.summary?.allow ?? 0) > 0, `a5sf-guard-consult allow facts=${String(arm.consult?.summary?.allow ?? 0)}`),
        clause('work-delivery-authorises', arm.workControl?.createGoal !== null, `WORK-delivery create_goal goal=${JSON.stringify(arm.workControl?.createGoal ?? null)} (source.kind=${String(arm.workControl?.startSourceKind)})`),
      ]),
  ]
}

// ─────────────────────────────────────────────────────────────────────────────
// plane probe (host-free): WHY one Team cannot carry both planes
// ─────────────────────────────────────────────────────────────────────────────
/**
 * The governed provider derives every Member ceiling from the Team's BOUND
 * blueprint through the shipped `deriveProductRealmPlanFromBlueprint`. Run it
 * on the SAME two blueprints this kit boots with, and record the exact
 * refusal a v5 (Alpha.6) source produces. This is the measured form of the
 * release-notes §4.8 / PD-42 constraint, not a paraphrase of it.
 */
function probePlanes() {
  const facade = blueprintFacade()
  const asm = require_(join(REPO_ROOT, 'packages', 'runtime', 'dist', 'packages', 'runtime', 'team-services', 'src', 'product-assembly.js'))
  const out = { at: new Date().toISOString(), blueprints: {} }
  const cases = {
    'v4-governed(main)': facade.parseBlueprint(blueprintYaml(mainBlueprint({ workspace: '/tmp/wp2-probe' }))),
    'v5-alpha6(anchor)': facade.parseBlueprint(blueprintYaml(anchorBlueprint())),
  }
  for (const [name, bound] of Object.entries(cases)) {
    try {
      const plan = asm.deriveProductRealmPlanFromBlueprint({
        blueprint: bound,
        authority: { revision: 'wp2-plane-probe', admitted: false },
      })
      out.blueprints[name] = {
        ok: true,
        schemaVersion: bound.schemaVersion ?? bound.blueprint?.schemaVersion ?? null,
        members: (plan.members ?? []).map((m) => m.templateId),
      }
    } catch (error) {
      out.blueprints[name] = {
        ok: false,
        schemaVersion: bound.schemaVersion ?? bound.blueprint?.schemaVersion ?? null,
        code: error?.code ?? null,
        reveal: error?.reveal ?? null,
        message: String(error?.message ?? error),
        detail: error?.detail ?? null,
      }
    }
  }
  out.conclusion = out.blueprints['v4-governed(main)']?.ok === true
    && out.blueprints['v5-alpha6(anchor)']?.ok === false
    && out.blueprints['v5-alpha6(anchor)']?.code === 'MEMBER_POLICY_WITHOUT_BLUEPRINT'
    ? 'PLANES_DISJOINT: the governed realm derives from a v4 memberIoCeilings family and REFUSES a v5 (Alpha.6) blueprint; one Team cannot carry both planes'
    : 'UNEXPECTED: inspect blueprints{} — the plane constraint did not reproduce'
  mkdirSync(EVIDENCE, { recursive: true })
  writeFileSync(join(EVIDENCE, 'plane-probe.json'), JSON.stringify(out, null, 2) + '\n')
  log(`PLANE PROBE ${out.conclusion}`)
  for (const [name, r] of Object.entries(out.blueprints)) log(`  ${name}: ${JSON.stringify(r)}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// plan (host-free)
// ─────────────────────────────────────────────────────────────────────────────
function planOnly() {
  const layer = shippedLayer()
  log(`PLAN repo=${REPO_ROOT} hostTree=${HOST_TREE} pin=${TEST_USE_BASELINE_SHA}`)
  log(`composition sha256=${sha256(join(REPO_ROOT, 'cordis.patch.yml'))}`)
  const ids = presetPluginIds(layer).map((p) => p.id)
  log(`governed preset plugins (${String(ids.length)}): ${ids.join(',')}`)
  for (const required of ['tool-goal', 'command-goal', 'tool-bash', 'tool-fs', 'tool-fs-search', 'tool-todo', 'plan-mode']) {
    if (!ids.includes(required)) throw new Error(`the shipped governed preset is missing '${required}'`)
  }
  const anchor = blueprintYaml(anchorBlueprint())
  const main = blueprintYaml(mainBlueprint({ workspace: join(EVIDENCE, 'plan-workspace') }))
  log(`blueprints accepted: anchor=${JSON.stringify(assertBlueprintText(anchor, BP_ANCHOR_ID))} main=${JSON.stringify(assertBlueprintText(main, BP_MAIN_ID))}`)
  const base = readFileSync(join(HOST_TREE, 'packages', 'bundle', 'base', 'cordis.patch.yml'), 'utf8')
  if (!base.includes("'@deepseek-ai/dsh-goal-round-driver'")) throw new Error('the pinned base bundle no longer mounts the upstream goal-round driver')
  mkdirSync(EVIDENCE, { recursive: true })
  const rows = composedRows({ home: join(EVIDENCE, 'plan-home'), anchorYaml: anchor, layer, bootPhase: 'create' })
  writeFileSync(join(EVIDENCE, 'plan-patch.yml'), JSON.stringify(rows.map((r) => ({ id: r.id, name: r.name, configKeys: Object.keys(r.config ?? {}) })), null, 2) + '\n')
  log(`PLAN OK rows=${rows.map((r) => r.id).join(',')}`)
}

// ─────────────────────────────────────────────────────────────────────────────
// one run
// ─────────────────────────────────────────────────────────────────────────────
function memberOf(state, templateId) {
  const members = Array.isArray(state?.body?.members) ? state.body.members : []
  return members.find((m) => String(m?.templateId ?? '') === templateId) ?? null
}
function leaderOf(state) {
  const members = Array.isArray(state?.body?.members) ? state.body.members : []
  return members.find((m) => String(m?.templateId ?? '') === 'leader') ?? null
}

function hostPorcelain() {
  try {
    return execFileSync('git', ['-C', HOST_TREE, 'status', '--porcelain'], { encoding: 'utf8' })
      .split('\n').filter((l) => l.trim() !== '')
  } catch { return ['<host tree unreadable>'] }
}
function hostDigest() {
  try { return execFileSync('git', ['-C', HOST_TREE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() } catch { return null }
}
function runBindings(head, authorization) {
  return {
    authority: readAuthorityBinding(REPO_ROOT),
    candidate: { head, hostSha: TEST_USE_BASELINE_SHA, baseline: TEST_USE_BASELINE_SHA },
    devLiveAuthorization: authorization,
    recordClass: 'CANDIDATE-C2',
    teamSha: head,
    hostSha: TEST_USE_BASELINE_SHA,
    repo: 'dsh-agent-team',
    hostTree: HOST_TREE,
    note: 'CANDIDATE-C2: the PRODUCT under test is the candidate commit (teamSha); the instrument is this task branch\'s new kit. The class is necessary, not sufficient: this run makes no V@B=yes claim',
  }
}

const SELECTED_CASES = {
  arm1: [
    'wp2-a6:arm1-create-authorized',
    'wp2-a6:arm1-goal-durable',
    'wp2-a6:arm1-update-advances',
    'wp2-a6:arm1-rounds',
    'wp2-a6:arm1-human-stop-terminal',
    'wp2-a6:arm1-governed-facts',
  ],
  arm2: [
    'wp2-a6:arm2-create-refused',
    'wp2-a6:arm2-no-goal',
    'wp2-a6:arm2-nothing-pretends-human',
    'wp2-a6:arm2-refusal-scoped',
  ],
}

class ConjunctionRefused extends Error {
  constructor(detail) {
    super(`CONJUNCTION_REFUSED: ${detail}`)
    this.name = 'ConjunctionRefused'
    this.detail = detail
  }
}

async function runOnce({ arm, index, head, authorization, layer }) {
  const runId = `wp2-a6-governed-goal-${arm}-r${String(index)}-${utcStamp()}`
  const runDir = join(EVIDENCE, `run-${arm}-r${String(index)}`)
  mkdirSync(runDir, { recursive: true })
  const record = createRunRecord({
    runId, suite: 'wp2-a6-governed-goal', selectedCases: SELECTED_CASES[arm],
    bindings: runBindings(head, authorization), ledgerPath: LEDGER_PATH, recordClass: 'CANDIDATE-C2',
  })
  const harness = createA5sfHarness({
    repoRoot: REPO_ROOT, evidenceRoot: join(EVIDENCE, 'driver'), suite: 'wp2-a6-governed-goal', line: LINE,
    runRecord: record, hostTree: HOST_TREE,
  })
  const factory = harness.factory
  log(`[${arm}#${String(index)}] candidate: ${JSON.stringify(harness.assertCandidate())}`)
  const slot = acquireDevLiveSlot({
    leaseRoot: factory.leaseRoot, runId: String(record.record.runId), face: 'A6GovernedGoal', world: LINE, headCommit: head,
  })
  log(`[${arm}#${String(index)}] dev-live slot #${String(slot.slot)} face=A6GovernedGoal world=${LINE} head=${head}`)

  let world = null
  let bootInfo = null
  let teardown = null
  const armFacts = { arm, run: index, startedAt: new Date().toISOString() }
  let verdicts = []
  let outcome = 'FAIL'

  const waitFor = async (predicate, timeoutMs, everyMs = 100) => {
    const t0 = nowMs()
    for (;;) {
      let hit = false
      try { hit = (await predicate()) === true } catch { hit = false }
      if (hit) return true
      if (nowMs() - t0 > timeoutMs) return false
      await sleep(everyMs)
    }
  }

  try {
    world = await harness.createWorld({ line: LINE, u6Fs: { rows: [] } })
    log(`[${arm}#${String(index)}] world=${world.id} home=${world.home}`)
    const graph = installGraph(world.home)
    log(`[${arm}#${String(index)}] install graph: profiles/web/node_modules/dsh-agent-team -> ${REPO_ROOT} (${String(graph.exports)} exports)`)

    mkdirSync(join(world.home, 'blueprints'), { recursive: true })
    const anchor = blueprintYaml(anchorBlueprint())
    const mainText = blueprintYaml(mainBlueprint({ workspace: world.workspaceDir }))
    assertBlueprintText(anchor, BP_ANCHOR_ID)
    assertBlueprintText(mainText, BP_MAIN_ID)
    writeFileSync(join(world.home, 'blueprints', 'anchor.yaml'), anchor)
    writeFileSync(join(world.home, 'blueprints', 'main.yaml'), mainText)
    const rows = composedRows({ home: world.home, anchorYaml: anchor, layer, bootPhase: 'create' })
    world.u6Fs.rows.push(...rows)
    writeFileSync(join(world.home, 'p6t6-directive.json'), JSON.stringify(p6t6Directive({ worldId: world.id, logDir: world.logDir, phase: 'create' }), null, 2) + '\n')
    writeFileSync(join(runDir, 'composition.json'), JSON.stringify({
      runId,
      hostRow: {
        rootSessionId: BOOT_ROOT,
        memberPresetId: PRESET_ID,
        a5sfGovernedRealm: rows[0].config.a5sfGovernedRealm,
        a5sfEvidencePath: rows[0].config.a5sfEvidencePath,
        alpha6ReviewRouting: rows[0].config.alpha6ReviewRouting,
        alpha6WakeIntentPath: rows[0].config.alpha6WakeIntentPath,
        blueprintAnchorId: BP_ANCHOR_ID,
      },
      blueprints: {
        anchor: { id: BP_ANCHOR_ID, schemaVersion: 5, reviewRouting: 'enabled + officerTemplateId=officer' },
        governedTeam: { id: BP_MAIN_ID, schemaVersion: 4, memberIoCeilings: [WORKER_TEMPLATE] },
      },
      installGraph: graph,
      presetPlugins: presetPluginIds(layer).map((p) => p.id),
      compositionSha256: sha256(join(REPO_ROOT, 'cordis.patch.yml')),
      note: 'EXACT: Alpha.6 opt-in + governed realm + upstream Goal tools; APPROXIMATED: the governed Team itself is v4, so its reviews would route to its Leader (F-1/PD-42)',
    }, null, 2) + '\n')

    const decide = makeDecide({ workspaceDir: world.workspaceDir, arm })
    process.env.A5SF_GOVERNED_SCRATCH = join(world.home, 'governed-scratch')
    mkdirSync(process.env.A5SF_GOVERNED_SCRATCH, { recursive: true })
    await world.startMock({ decide })
    log(`[${arm}#${String(index)}] mock on ${String(world.mock?.port)}`)
    try {
      bootInfo = await harness.boot({ world, phase: `wp2-a6-governed-goal-${arm}-${String(index)}`, bootTimeoutMs: 300_000 })
    } catch (error) {
      const text = String(error?.message ?? error)
      if (/TEAM_PLUGIN_CONFIG_INVALID|alpha6ReviewRouting/u.test(text)) {
        throw new ConjunctionRefused(`the Alpha.6 composition refused the boot: ${text}`)
      }
      throw error
    }
    log(`[${arm}#${String(index)}] BOOTED port=${bootInfo.port} home=${world.home}`)
    record.record.boots = [{ phase: arm, world: world.id, port: bootInfo.port, logPath: bootInfo.logPath }]

    const origin = `http://127.0.0.1:${bootInfo.port}`
    const cookie = await authenticate(origin, world.token)
    const healthOk = await waitFor(async () => {
      const st = await fetchJson(`${origin}/__p6t6/health`, undefined, 20_000)
      return st.status === 200 && st.body?.ok === true
    }, 180_000)
    log(`[${arm}#${String(index)}] p6t6 health=${String(healthOk)}`)
    if (!healthOk) throw new Error('the p6t6 harness route never answered: the World did not reach a usable Host')

    const disc = await apiPrompt(origin, cookie, BOOT_ROOT, MK_DISC, 'wp2a6goal')
    log(`[${arm}#${String(index)}] discovery prompt status=${String(disc.status)}`)
    await waitFor(() => allMockRequests(world).some((r) => lastUserTextOfStatic(r).includes(MK_DISC)), 60_000)

    // The governed Team is CREATED on the A6-on host row (same row, new root).
    const created = await teamRpc(origin, cookie, 'team.create', {
      rootSessionId: TEAM_ROOT, blueprintId: BP_MAIN_ID, initialWork: { prompt: MK_LEADER },
    }, 'wp2a6goal')
    const createOk = created.status === 200 && created.body?.result?.ok === true
    log(`[${arm}#${String(index)}] team.create status=${String(created.status)} ok=${String(createOk)} ${redact(JSON.stringify(created.body ?? null)).slice(0, 400)}`)
    if (!createOk) {
      const body = JSON.stringify(created.body ?? null)
      writeFileSync(join(runDir, 'team-create-refusal.json'), body + '\n')
      throw new ConjunctionRefused(`team.create of the v4 governed Team on the A6-on row was refused: status=${String(created.status)} body=${body.slice(0, 800)}`)
    }

    const workerReady = await waitFor(() => allMockRequests(world).some((r) => {
      const text = firstUserText(r)
      return text.includes('[team-work ') && text.includes(MK_READY)
    }), 240_000, 200)
    log(`[${arm}#${String(index)}] worker work-delivery turn seen=${String(workerReady)}`)
    const state1 = await p6t6State(origin)
    const worker = memberOf(state1, WORKER_TEMPLATE)
    const leader = leaderOf(state1)
    if (worker === null || leader === null) {
      throw new ConjunctionRefused(`the governed Member was not created (state members=${JSON.stringify((state1.body?.members ?? []).map((m) => m.templateId))}); a governed realm refusal is the expected F-1 shape — see state-failure.json`)
    }
    const workerSession = String(worker.childSessionId)
    const workerInstance = String(worker.instanceId)
    const leaderInstance = String(leader.instanceId)
    armFacts.member = { templateId: WORKER_TEMPLATE, instanceId: workerInstance, childSessionId: workerSession, lifecycle: worker.lifecycle }
    armFacts.leaderInstanceId = leaderInstance
    log(`[${arm}#${String(index)}] worker instance=${workerInstance} session=${workerSession} leader=${leaderInstance}`)

    const workerToken = MK_READY
    const roundsBefore = memberRoundRequests(world, workerToken).length
    log(`[${arm}#${String(index)}] rounds before the arm=${String(roundsBefore)} (the delegation turn is work delivery, not a goal round)`)

    const relayBody = arm === 'arm1' ? MK_ARM1 : MK_ARM2
    const caller = arm === 'arm1'
      ? { kind: 'human', humanId: TEAM_ROOT }
      : { kind: 'instance', instanceId: leaderInstance }
    const send = await teamRpc(origin, cookie, 'member.send', {
      teamSessionId: TEAM_ROOT,
      caller,
      recipientInstanceId: workerInstance,
      body: relayBody,
      requestToken: `wp2-${arm}-relay-${String(Date.now())}`,
    }, `wp2-${arm}-relay`)
    log(`[${arm}#${String(index)}] member.send (${arm === 'arm1' ? 'human' : 'machine'}) status=${String(send.status)} ok=${String(send.body?.result?.ok === true)} ${redact(JSON.stringify(send.body ?? null)).slice(0, 400)}`)
    armFacts.relaySend = { status: send.status, ok: send.body?.result?.ok === true, body: send.body?.result ?? send.body ?? null, caller }
    const relaySeen = await waitFor(() => allMockRequests(world).some((r) => reqCarries(r, relayBody)), 120_000, 100)
    log(`[${arm}#${String(index)}] relay turn seen by the model=${String(relaySeen)}`)

    if (arm === 'arm1') {
      // Wait for the create/get/edit triple in the SAME human turn.
      const tripleSeen = await waitFor(() => toolCallFor(allMockRequests(world), CALL.a1Edit) !== null, 180_000, 150)
      log(`[${arm}#${String(index)}] create/get/edit triple seen=${String(tripleSeen)}`)
      const rounds2 = await waitFor(() => memberRoundRequests(world, workerToken).length >= 2, 240_000, 150)
      log(`[${arm}#${String(index)}] rounds>=2=${String(rounds2)} (now ${String(memberRoundRequests(world, workerToken).length)})`)

      // Durable facts BEFORE the Stop (the tool results are in the log).
      let preFacts = sessionFacts(world.home, workerSession)
      const createResult = (preFacts?.results ?? []).find((r) => r.callId === CALL.a1Create) ?? null
      const getResult = (preFacts?.results ?? []).find((r) => r.callId === CALL.a1Get) ?? null
      armFacts.getGoalTool = lastGoalRef(String(getResult?.text ?? ''))
      const editResult = (preFacts?.results ?? []).find((r) => r.callId === CALL.a1Edit) ?? null
      const createCall = (preFacts?.calls ?? []).find((c) => c.callId === CALL.a1Create) ?? null
      armFacts.createCall = createCall
      armFacts.createResult = createResult
      armFacts.getResult = getResult
      armFacts.editResult = editResult
      armFacts.createGoal = lastGoalRef(String(createResult?.text ?? ''))
      armFacts.startMsg = (preFacts?.userMessages ?? []).find((m) => String(m.text).includes(MK_ARM1)) ?? null
      armFacts.startSourceKind = armFacts.startMsg?.kind ?? null

      const serviceBefore = await goalGet(origin, cookie, workerSession)
      armFacts.getGoal = serviceBefore.goal
      armFacts.serviceGoalBeforeStop = serviceBefore.goal

      // HUMAN STOP: the UI stop button on the Member's own session.
      const roundsAtStopImmediate = memberRoundRequests(world, workerToken).length
      const stopStatus = await apiSessionCancel(origin, cookie, workerSession, 'wp2a6goal')
      const stopAt = nowMs()
      const pausedSeen = await waitFor(() => goalGet(origin, cookie, workerSession).then((g) => g.goal?.phase !== undefined && g.goal?.phase !== 'active'), 60_000, 100)
      await sleep(SILENT_MS)
      const roundsAtWindowEnd = memberRoundRequests(world, workerToken).length
      const postFacts = sessionFacts(world.home, workerSession)
      const finalGoal = (await goalGet(origin, cookie, workerSession)).goal
      armFacts.stopStatus = stopStatus?.status ?? 0
      armFacts.stopAt = stopAt
      armFacts.pausedSeen = pausedSeen
      armFacts.finalPhase = finalGoal?.phase ?? (postFacts?.goalChanges ?? []).at(-1)?.phase ?? null
      armFacts.roundsAtStop = roundsAtStopImmediate
      armFacts.roundsAfterStop = Math.max(0, roundsAtWindowEnd - roundsAtStopImmediate)
      armFacts.silentWindowMs = SILENT_MS
      armFacts.facts = postFacts
      armFacts.finalGoal = finalGoal
      armFacts.consult = consultFacts(world.home, workerInstance)
      armFacts.afterStopRounds = roundsAtWindowEnd
      verdicts = judgeArm1(armFacts)
    } else {
      // The refusal + the governed tool in the same turn.
      const bashSeen = await waitFor(() => toolCallFor(allMockRequests(world), CALL.a2Bash) !== null, 180_000, 150)
      log(`[${arm}#${String(index)}] relay turn bash seen=${String(bashSeen)}`)
      // Give the turn a moment to settle durably.
      await waitFor(() => {
        const f = sessionFacts(world.home, workerSession)
        return (f?.results ?? []).some((r) => r.callId === CALL.a2Bash)
      }, 120_000, 150)
      const facts = sessionFacts(world.home, workerSession)
      const createResult = (facts?.results ?? []).find((r) => r.callId === CALL.a2Create) ?? null
      const bashResult = (facts?.results ?? []).find((r) => r.callId === CALL.a2Bash) ?? null
      const machineMsg = (facts?.userMessages ?? []).find((m) => String(m.text).includes(MK_ARM2)) ?? null
      armFacts.createResult = createResult
      armFacts.bashResult = bashResult
      armFacts.createGoal = lastGoalRef(String(createResult?.text ?? ''))
      armFacts.startSourceKind = machineMsg?.kind ?? null
      armFacts.startMsg = machineMsg
      armFacts.facts = facts
      const svc = await goalGet(origin, cookie, workerSession)
      armFacts.serviceGoal = svc.goal
      const consultBeforeWork = consultFacts(world.home, workerInstance)
      armFacts.consult = consultBeforeWork
      log(`[${arm}#${String(index)}] refusal code=${String(createResult?.code)} goals/get=${JSON.stringify(svc.goal)} consultAllow=${String(consultBeforeWork.summary.allow)}`)

      // CONTROL: a WORK delivery (member.followup) is human-attributed by the
      // product and must still authorise create_goal.
      const followup = await teamRpc(origin, cookie, 'member.followup', {
        teamSessionId: TEAM_ROOT,
        caller: { kind: 'instance', instanceId: leaderInstance },
        targetInstanceId: workerInstance,
        requestToken: `wp2-arm2-work-${String(Date.now())}`,
        payload: { prompt: MK_ARM2_WORK },
      }, 'wp2-arm2-work')
      const workSeen = await waitFor(() => allMockRequests(world).some((r) => reqCarries(r, MK_ARM2_WORK)), 120_000, 100)
      const workCreateSeen = await waitFor(() => toolCallFor(allMockRequests(world), CALL.a2WorkCreate) !== null, 180_000, 150)
      log(`[${arm}#${String(index)}] work control followup status=${String(followup.status)} seen=${String(workSeen)} create_goal=${String(workCreateSeen)}`)
      await waitFor(() => memberRoundRequests(world, workerToken).length >= 1, 120_000, 150)
      await sleep(1500)
      const afterWork = sessionFacts(world.home, workerSession)
      const workCreateResult = (afterWork?.results ?? []).find((r) => r.callId === CALL.a2WorkCreate) ?? null
      const workMsg = [...(afterWork?.userMessages ?? [])].reverse().find((m) => String(m.text).includes(MK_ARM2_WORK)) ?? null
      armFacts.workControl = {
        followupStatus: followup.status,
        followupOk: followup.body?.result?.ok === true,
        workSeen,
        createResult: workCreateResult,
        createGoal: lastGoalRef(String(workCreateResult?.text ?? '')),
        startSourceKind: workMsg?.kind ?? null,
        startText: workMsg?.text ?? null,
      }
      // Stop the control goal so nothing keeps running.
      const stopStatus = await apiSessionCancel(origin, cookie, workerSession, 'wp2a6goal')
      armFacts.workControl.stopStatus = stopStatus?.status ?? 0
      await waitFor(() => goalGet(origin, cookie, workerSession).then((g) => g.goal?.phase === 'paused'), 60_000, 100)
      armFacts.consult = consultFacts(world.home, workerInstance)
      verdicts = judgeArm2(armFacts)
    }

    const porcelain = hostPorcelain()
    writeFileSync(join(runDir, `host-tree-porcelain.txt`), porcelain.length === 0 ? 'empty\n' : porcelain.join('\n') + '\n')
    if (porcelain.length !== 0) process.exitCode = 1
    outcome = verdicts.every((v) => v.verdict === 'PROVEN') ? 'PASS' : 'FAIL'
  } catch (error) {
    if (error instanceof ConjunctionRefused) {
      outcome = 'CONJUNCTION_REFUSED'
      armFacts.refusal = error.detail
      log(`[${arm}#${String(index)}] CONJUNCTION_REFUSED: ${error.detail}`)
    } else {
      outcome = 'FAIL'
      armFacts.error = String(error?.stack ?? error)
      log(`[${arm}#${String(index)}] FAILED at ${String(error?.stack ?? error)}`)
    }
    // Diagnostics on refusal/failure: the mock corpus + the Harness state are
    // what explain a stalled or refused chain, and teardown deletes the home.
    try {
      writeFileSync(join(runDir, 'mock-requests.json'), JSON.stringify(allMockRequests(world).map((r, i) => ({
        seq: i, at: r.receivedAt ?? null, lastUser: lastUserTextOfStatic(r).slice(0, 400), round: roundOfRequest(r),
      })), null, 2) + '\n')
    } catch { /* best effort */ }
    try {
      if (bootInfo !== null) {
        const st = await p6t6State(`http://127.0.0.1:${String(bootInfo.port)}`)
        writeFileSync(join(runDir, 'state-failure.json'), JSON.stringify(st.body ?? null, null, 2) + '\n')
      }
    } catch { /* best effort */ }
    try {
      if (world?.home !== undefined && world.home !== null) {
        writeFileSync(join(runDir, 'home-path.txt'), `${world.home}\n`)
        const dump = join(runDir, 'sessions')
        mkdirSync(dump, { recursive: true })
        let n = 0
        for (const entry of walkFiles(world.home)) {
          if (!/^session(\..+)?\.jsonl\.zstd$/u.test(entry.name)) continue
          n += 1
          try { writeFileSync(join(dump, `${String(n).padStart(2, '0')}-${entry.path.split('/').slice(-2)[0].slice(0, 24)}.zstd`), readFileSync(entry.path)) } catch { /* best effort */ }
        }
      }
    } catch { /* best effort */ }
  } finally {
    try {
      writeFileSync(join(runDir, 'result.json'), JSON.stringify({ runId, arm, run: index, outcome, verdicts, facts: armFacts }, null, 2) + '\n')
    } catch { /* best effort */ }
    for (const v of verdicts) {
      record.addCase(v.id, v.verdict === 'PROVEN' ? 'PASS' : 'FAIL', { failed: v.failed, clauses: v.clauses })
    }
    if (verdicts.length === 0) record.markAborted({ stage: 'arm', detail: `no verdicts: outcome=${outcome}`, error: String(armFacts.refusal ?? armFacts.error ?? '') })
    try {
      const final = record.finalize()
      writeFileSync(join(runDir, 'run-record.json'), JSON.stringify(final, null, 2) + '\n')
      writeFileSync(join(runDir, 'summary.txt'), formatSummary(final) + '\n')
      log(`[${arm}#${String(index)}] ${formatSummary(final)}`)
    } catch { /* best effort */ }
    if (world !== null) {
      try { teardown = await world.teardown({ keepHome: KEEP_HOME }) } catch (error) { teardown = { error: String(error?.message ?? error) } }
      try { writeFileSync(join(runDir, 'teardown.json'), JSON.stringify(teardown, null, 2) + '\n') } catch { /* best effort */ }
    }
    try {
      const released = await slot.release()
      log(`[${arm}#${String(index)}] dev-live slot released (slot=${String(slot.slot)} state=${JSON.stringify(released ?? null)})`)
    } catch (error) { log(`[${arm}#${String(index)}] dev-live slot release failed: ${String(error?.message ?? error)}`) }
  }
  return { index, runDir, outcome, verdicts, facts: armFacts }
}

function agreementOf(runs) {
  if (runs.length < 2) return { agreeing: null, table: 'single run (no pair agreement required)' }
  const ids = new Set(runs.flatMap((r) => (r?.verdicts ?? []).map((v) => v.id)))
  const rows = []
  let agreeing = true
  for (const id of ids) {
    const cells = runs.map((r) => (r?.verdicts ?? []).find((v) => v.id === id)?.verdict ?? '<absent>')
    const same = cells.every((c) => c === cells[0])
    if (!same) agreeing = false
    rows.push(`| ${id} | ${cells.join(' | ')} | ${same ? 'agree' : 'DISAGREE'} |`)
  }
  return {
    agreeing,
    table: ['| case | ' + runs.map((r) => `run${String(r.index)}`).join(' | ') + ' | agreement |',
      '| --- | ' + runs.map(() => '---').join(' | ') + ' | --- |', ...rows].join('\n'),
  }
}

async function main() {
  if (PLAN_ONLY) {
    mkdirSync(EVIDENCE, { recursive: true })
    RUN_LOG = join(EVIDENCE, 'driver.log')
    planOnly()
    return
  }
  if (PROBE_ONLY) {
    mkdirSync(EVIDENCE, { recursive: true })
    RUN_LOG = join(EVIDENCE, 'driver.log')
    probePlanes()
    return
  }
  if (ARM !== 'arm1' && ARM !== 'arm2') {
    process.stderr.write('usage: wp2-a6-governed-goal.mjs --arm arm1|arm2 [--runs N] [--plan] [--keep-home]\n')
    process.exitCode = 4
    return
  }
  mkdirSync(EVIDENCE, { recursive: true })
  RUN_LOG = join(EVIDENCE, `driver-${ARM}.log`)
  appendFileSync(RUN_LOG, `\n===== wp2-a6-governed-goal ${ARM} ${startedAt} =====\n`)
  log(`repo=${REPO_ROOT} hostTree=${HOST_TREE} host=${hostDigest()} pin=${TEST_USE_BASELINE_SHA} arm=${ARM} runs=${String(RUNS_WANTED)}`)
  const layer = shippedLayer()
  const head = resolveHeadCommit(REPO_ROOT)
  const authorization = readAuthorityBinding(REPO_ROOT)
  if (authorization === null) throw new Error('no authority binding for this run')
  writeFileSync(join(EVIDENCE, `driver-digest-${ARM}.json`), JSON.stringify({
    repo: REPO_ROOT, hostTree: HOST_TREE, hostHead: hostDigest(), pin: TEST_USE_BASELINE_SHA,
    head, composition: { path: join(REPO_ROOT, 'cordis.patch.yml'), sha256: sha256(join(REPO_ROOT, 'cordis.patch.yml')) },
    startedAt, argv, arm: ARM,
  }, null, 2) + '\n')

  const results = []
  for (let i = 1; i <= RUNS_WANTED; i += 1) {
    results.push(await runOnce({ arm: ARM, index: i, head, authorization, layer }))
  }
  const agreement = agreementOf(results)
  writeFileSync(join(EVIDENCE, `agreement-${ARM}.json`), JSON.stringify({ arm: ARM, agreeing: agreement.agreeing, runs: results.length, outcomes: results.map((r) => r.outcome) }, null, 2) + '\n')
  if (agreement.agreeing !== null) writeFileSync(join(EVIDENCE, `agreement-${ARM}.txt`), agreement.table + '\n')
  log(agreement.table)
  const porcelain = hostPorcelain()
  writeFileSync(join(EVIDENCE, 'host-tree-porcelain.txt'), porcelain.length === 0 ? 'empty\n' : porcelain.join('\n') + '\n')
  log(`host porcelain after: ${JSON.stringify(porcelain)}`)
  const refused = results.some((r) => r.outcome === 'CONJUNCTION_REFUSED')
  const allOk = results.length === RUNS_WANTED && results.every((r) => r.outcome === 'PASS')
  const pairOk = RUNS_WANTED < 2 || agreement.agreeing === true
  log(`RESULT ${allOk ? 'PASS' : refused ? 'CONJUNCTION_REFUSED' : 'FAIL'} (${String(results.length)}/${String(RUNS_WANTED)} runs; agreeing pair=${String(agreement.agreeing)})`)
  if (refused) process.exitCode = 3
  else if (!allOk || !pairOk) process.exitCode = 1
}

main().catch((error) => {
  log(`DRIVER FAILED (outside the run): ${String(error?.stack ?? error)}`)
  process.exitCode = 1
})
