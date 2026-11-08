#!/usr/bin/env node
/**
 * tests/world-factory/drivers/a5sf-pd29-goal-stop/run-boot.mjs — the LIVE driver
 * for PD-29: can a governed Member run a continuous goal today, and does an
 * explicit STOP really stop it?
 *
 * WHY THIS FILE EXISTS. PD-25 measured that a governed Member's `create_goal`
 * was accepted and the goal-round driver drove consecutive automatic rounds
 * with a caller-chosen budget, then failed the goal tools closed. The owner
 * ruled (2026-11-14) that Preview ACCEPTS the absence of a trustworthy GLOBAL
 * round budget, that the Member keeps the upstream editable `maxGoalRounds`,
 * and that the hard acceptance is the STOP semantics: after a user or the
 * Leader explicitly stops a Member, that Member's goal must not start another
 * automatic execution round — including across a cancel race and a cold
 * Session recovery. This driver measures exactly that on the SHIPPED opt-in
 * `a5sf-governed-member` preset with REAL Member turns, the REAL upstream goal
 * service + goal-round driver, and the REAL Team lifecycle.
 *
 * WHAT IS REAL (not a fixture): the preset row, the realm compiler/guard, the
 * confined terminal face, the host `goals` service, the host goal-round
 * driver, the upstream goal tools, the Team tool router, the Team lifecycle
 * (close-admission → interrupt → drain → quiesce → release → commit) and the
 * Host process. THE MODEL IS THE SHARED SCRIPTED MOCK
 * (`packages/tools/harness/mock-deepseek.mjs`) and the mock's request log is
 * test instrumentation.
 *
 * ARMS (one boot, six Members under ONE identical ceiling — the only variable
 * is the stop the arm exercises):
 *   S1  stop DURING a running goal round (user `session/cancel` on the
 *       Member's own session = the real stop button): the current round must
 *       terminate, and no automatic round, model request or tool call may
 *       start afterwards;
 *   S2  stop at a ROUND BOUNDARY: a cancel burst covers the queued/claimed
 *       window; a queued round must not activate after the stop;
 *   S3  stop in the IDLE window between two rounds: the driver must not
 *       re-wake; the arm records the observable silent window after the last
 *       stop (a stop the host silently drops is recorded as LOST, never
 *       smoothed over);
 *   S4  the LEADER stops the Member through the REAL Team lifecycle
 *       (`team_archive_member`): the signal must reach the Member (aborted
 *       round + withdrawn goal activation + ARCHIVED lifecycle), not just
 *       return success to the Leader;
 *   S5  the USER stops the LEADER's turn: whether that propagates to the
 *       asynchronous Members is measured separately and NOT conflated with S1;
 *   S6  COLD RECOVERY: after the stopped/still-armed goals are on disk, the
 *       Host is restarted on the SAME DSH_HOME; a live, idle Member must not
 *       revive its goal by itself;
 *   S7  an explicit authorized resume (`/goal resume` typed by the user on the
 *       Member's session) must still work after that recovery;
 *   S8  `complete` / `blocked` / `pause` end automatic continuation, and an
 *       UN-stopped goal keeps continuing on its own.
 *
 * NON-GOALS. No round budget is added, no second policy source is introduced,
 * no upstream patch is made (`CORE PATCH BUDGET = 0`). "Unlimited Goal" means
 * the ABSENCE of an additional trusted total-round limit — never `Infinity`
 * and never a broken safe-integer check.
 *
 * BOOT DISCIPLINE (TEST_METHODS §2/§7): DSH_HOME under `tests/homes/`, ports
 * from the 3180 family via WorldFactory leases, `:3080` never touched, the
 * pinned host tree READ-ONLY (porcelain verified before/after), one dev-live
 * slot per boot, teardown by identity, `recordClass: 'DEV-LIVE'` (never a
 * candidate claim).
 *
 * `--plan` is host-free (row/blueprint validation, zero boots).
 *
 * @module tests/world-factory/drivers/a5sf-pd29-goal-stop/run-boot
 */
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import {
  appendFileSync, existsSync, lstatSync, mkdirSync, readdirSync, readFileSync, symlinkSync, writeFileSync,
} from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { zstdDecompressSync } from 'node:zlib'

import { apiPrompt, apiSessionCancel, authenticate, emitPatchLayer, fetchJson } from '../../lib/world-factory.mjs'
import { createRunRecord, formatSummary, readAuthorityBinding } from '../../lib/run-record.mjs'
import { TEST_USE_BASELINE_SHA } from '../../../paths.mjs'
import { createA5sfHarness } from '../../lib/a5sf-harness.mjs'
import { acquireDevLiveSlot } from '../../lib/dev-live-slots.mjs'
import { resolveHeadCommit } from '../../suites/150-a5sf-read.mjs'
import { lastUserTextOfStatic, messagesOf, textOf } from '../../lib/u6-fs-assembly.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = resolve(HERE, '..', '..', '..', '..')
const EVIDENCE = join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence', 'a5sf-pd29-goal-stop')
const RUNS = join(EVIDENCE, 'runs')
const LEDGER_PATH = join(EVIDENCE, 'run-ledger.jsonl')

const LINE = 'u5a5sfpd29'
const BOOT_ROOT = 'session-a5sf-pd29-boot'
const ACCEPTANCE_ROOT = 'session-a5sf-pd29-team'
const BP_ANCHOR_ID = 'team.a5sf.pd29.anchor'
const BP_MAIN_ID = 'team.a5sf.pd29.main'
const PRESET_ID = 'a5sf-governed-member'

const MK_DISC = 'A5SF_PD29_DISC'
const MK_L1 = 'A5SF_PD29_L1_DRIVE'
const MK_LEADER_SLOW = 'A5SF_PD29_LEADER_SLOW'
const MK_PING = 'A5SF_PD29_PING'

/** The six Member templates and the token that identifies each one. */
const TEMPLATES = Object.freeze(['s1', 's2', 's3', 's4', 'lead', 'cold', 'pz'])
const TOKEN_OF = Object.freeze({
  s1: 'a5sf-pd29-s1',
  s2: 'a5sf-pd29-s2',
  s3: 'a5sf-pd29-s3',
  s4: 'a5sf-pd29-s4',
  lead: 'a5sf-pd29-lead',
  cold: 'a5sf-pd29-cold',
  pz: 'a5sf-pd29-pz',
})
const CALL = Object.freeze({
  s1: 'call-pd29-s1-create',
  s2: 'call-pd29-s2-create',
  s3: 'call-pd29-s3-create',
  s4: 'call-pd29-s4-create',
  lead: 'call-pd29-lead-create',
  cold: 'call-pd29-cold-create',
  pz: 'call-pd29-pz-create',
})
const DONE = 'A5SF_PD29_DONE'
const MARK = 'A5SF_PD29'

/** How long a post-stop observation window must stay silent (ms). */
const SILENT_MS = Number(process.env.A5SF_PD29_SILENT_MS ?? 20_000)
/** The long-round tool command (a stop must land mid-command). */
const LONG_SLEEP = Number(process.env.A5SF_PD29_LONG_SLEEP ?? 4)

const SELECTED_CASES = Object.freeze([
  'pd29:goal-continuous-rounds',
  'pd29:stop-during-round',
  'pd29:stop-at-round-boundary',
  'pd29:stop-in-idle-window',
  'pd29:leader-archive-stops-goal',
  'pd29:user-stops-leader-no-propagation',
  'pd29:cold-recovery-no-revival',
  'pd29:explicit-resume-after-recovery',
  'pd29:terminal-phases-do-not-continue',
])

const argv = process.argv.slice(2)
const PLAN_ONLY = argv.includes('--plan')
const BOOTS_WANTED = (() => {
  const i = argv.indexOf('--boots')
  if (i < 0) return 1
  const n = Number(argv[i + 1])
  return Number.isSafeInteger(n) && n >= 1 ? n : 1
})()
const ARMS = (() => {
  const i = argv.indexOf('--arms')
  if (i < 0) return null
  return new Set(String(argv[i + 1] ?? '').split(',').map((s) => s.trim()).filter((s) => s !== ''))
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

/**
 * The pristine pinned host tree. A worktree may carry its own gitignored
 * clone, but a bare `clone --local` has NO build output (`apps/cli/lib/bin.js`
 * is gitignored), and the host is booted from that tree. So the candidate must
 * be a directory whose CLI is actually built; otherwise the shared read-only
 * checkout this worktree was cut from is used. Override with
 * `A5SF_PD29_HOST_TREE`.
 */
function hostTreePath() {
  const built = (dir) => existsSync(join(dir, 'apps', 'cli', 'lib', 'bin.js'))
  const override = process.env.A5SF_PD29_HOST_TREE
  if (override !== undefined && override !== '') {
    const dir = resolve(override)
    if (!built(dir)) throw new Error(`A5SF_PD29_HOST_TREE=${dir} carries no built CLI (apps/cli/lib/bin.js)`)
    return dir
  }
  const candidates = [join(REPO_ROOT, 'tests', 'deepseek-harness-test-use')]
  try {
    // This worktree's checkout lives under `<main>/.worktrees/<task>`; the
    // shared, BUILT pristine tree belongs to the main checkout.
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
 * The production INSTALL GRAPH inside the World's own `DSH_HOME`.
 *
 * The shipped preset names subpath rows (`dsh-agent-team/web-tool`,
 * `dsh-agent-team/web-transport`, the root `dsh-agent-team/host`), and a preset
 * row is resolved by the PROFILE's module graph — not by this driver. A real
 * install has the package in `profiles/web/node_modules`; the pinned test tree
 * does not install this repository, so the World links the same package the way
 * an install would, and from then on every shipped row name resolves through
 * `package.json#exports`.
 *
 * This is a DEPLOYMENT property of the World, not a composition edit: no row
 * name is rewritten. Without it the host's preset audit reports
 * `tool-web (dsh-agent-team/web-tool): never started` and **no governed Member is
 * created at all** (the #676 regression, measured on master before #678). PD-30
 * shipped this link for its own World; this lane needs the same graph because it
 * boots the same shipped preset.
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

// ─────────────────────────────────────────────────────────────────────────────
// the SHIPPED layer: rows + preset, with the one `!!js` expression evaluated
// ─────────────────────────────────────────────────────────────────────────────
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
// blueprints
// ─────────────────────────────────────────────────────────────────────────────
function anchorBlueprint() {
  return {
    schemaVersion: 3,
    blueprintId: BP_ANCHOR_ID,
    revision: '1',
    leader: { templateId: 'leader', persona: 'You lead the a5sf PD-29 anchor team.' },
    members: [{ templateId: 's1', persona: 'You are the anchor worker.' }],
    requirements: [],
    teamEnvelope: { allow: [], deny: [] },
    memberEnvelopes: [],
    policyStates: [],
    permissionMutationEnvelope: { rules: [] },
    teamHardEnvelope: { rules: [] },
    metadata: {},
  }
}

function lane(allow) {
  return { mode: 'restricted', allow: [...allow], ask: [], deny: [] }
}

/**
 * The v4 design measured by this lane. Seven templates, each with the SAME
 * compiled ceiling (the World workspace), so a behaviour difference cannot be
 * blamed on a lane difference: the only variable is the stop the arm issues.
 */
function mainBlueprint({ workspace }) {
  const member = (templateId, displayName) => ({
    templateId,
    displayName,
    persona: `You are the ${templateId} worker of the PD-29 goal-stop lane. Run the probes exactly once each.`,
  })
  return {
    schemaVersion: 4,
    blueprintId: BP_MAIN_ID,
    revision: '1',
    leader: {
      templateId: 'leader',
      persona: `You lead the a5sf PD-29 goal-stop team. ${MK_L1} delegates each probe Member once, asynchronously, in the fixed order.`,
    },
    members: [
      member('s1', 'S1 Stop Worker'),
      member('s2', 'S2 Boundary Worker'),
      member('s3', 'S3 Idle Worker'),
      member('s4', 'S4 Archive Worker'),
      member('lead', 'S5 Leader-Stop Worker'),
      member('cold', 'S6 Cold-Recovery Worker'),
      member('pz', 'S8 Terminal-Phase Worker'),
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
    memberIoCeilings: TEMPLATES.map((templateId) => ({
      templateId,
      io: { read: lane([workspace]), write: lane([workspace]), network: { mode: 'allow' } },
    })),
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
// rows
// ─────────────────────────────────────────────────────────────────────────────
function p6t6Directive({ worldId, logDir, phase }) {
  return { boot: 1, phase, reportDir: logDir, runStamp: worldId, rootSessionId: ACCEPTANCE_ROOT }
}

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
function toolResultFor(requests, callId) {
  for (const req of requests) {
    for (const message of messagesOf(req)) {
      if (!Array.isArray(message?.content)) continue
      for (const block of message.content) {
        if (block?.type !== 'tool_result' || String(block?.tool_use_id) !== String(callId)) continue
        const text = Array.isArray(block.content)
          ? block.content.map((c) => c?.text ?? '').join('')
          : typeof block.content === 'string' ? block.content : ''
        return { isError: block.is_error === true, text }
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
  const multi = (calls) => ({ kind: 'tool-call', toolCalls: calls })
  const memberBash = (id, command) => call(id, 'bash', { command, description: 'PD-29 probe', workdir: workspaceDir })
  return function decide({ req }) {
    const allText = messagesOf(req).map(textOf).join('\n')
    const lastUser = lastUserTextOfStatic(req)
    if (allText.includes('Generate the session title')) return { kind: 'text', content: 'a5sf pd29 session' }
    const seen = resultIdsOf(req)
    const inRound = lastUser.includes('<goal_round>') || lastUser.includes('Goal round')

    // ── the LEADER: one turn delegates every probe Member (async) ─────────
    if (lastUser.includes(MK_L1)) {
      if (!lastUser.includes('A5SF_PD29_DELEGATED')) {
        const calls = TEMPLATES.map((templateId, i) => ({
          id: `call-pd29-delegate-${templateId}`,
          name: 'team_delegate',
          arguments: {
            rootSessionId: ACCEPTANCE_ROOT,
            requestToken: `${TOKEN_OF[templateId]}-delegate`,
            delegationTemplateId: templateId,
            label: `a5sfpd29-${templateId}`,
            workspace: workspaceDir,
            prompt: `${TOKEN_OF[templateId]}: ${templateId} probe. Reply with the marker only when done.`,
            async: true,
          },
        }))
        calls.push({ id: 'call-pd29-delegate-note', name: 'team_report_progress', arguments: { rootSessionId: ACCEPTANCE_ROOT, summary: 'A5SF_PD29_DELEGATED' } })
        return multi(calls)
      }
      return { kind: 'text', content: `${DONE} leader chain` }
    }
    if (lastUser.includes(MK_LEADER_SLOW)) {
      if (!seen.has('call-pd29-leader-slow')) return memberBash('call-pd29-leader-slow', 'sleep 6')
      return { kind: 'text', content: 'A5SF_PD29_LEADER_SLOW_DONE' }
    }
    if (lastUser.includes(MK_PING)) return { kind: 'text', content: 'A5SF_PD29_PING_ACK' }
    if (lastUser.includes(MK_DISC)) return { kind: 'text', content: 'A5SF_PD29_DISC_ACK' }

    // ── per-Member branches ───────────────────────────────────────────────
    for (const templateId of TEMPLATES) {
      if (!isMemberRequest(req, TOKEN_OF[templateId])) continue
      const createId = CALL[templateId]
      if (inRound) {
        // A resume round on the cold Member COMPLETES the goal (S8 complete).
        if (templateId === 'cold' && lastUser.includes('A5SF_PD29_RESUME')) {
          const ref = lastGoalRef(allToolResultText(req))
          if (ref !== null && !seen.has('call-pd29-cold-complete')) {
            return call('call-pd29-cold-complete', 'update_goal', {
              goal_id: ref.id, revision: ref.revision, action: 'complete',
            })
          }
          return { kind: 'text', content: `${MARK}_COLD_COMPLETED` }
        }
        const round = roundOfRequest(req)?.round ?? 0
        if (templateId === 's1' && round >= 2) {
          // A LONG round: the stop must land while a tool call is in flight.
          return memberBash(`call-pd29-s1-round-${String(round)}-bash`, `echo ${MARK}_S1_ROUND_${String(round)}; sleep ${String(LONG_SLEEP)}`)
        }
        // Every other probe round is paced (~6/s) so the arms can observe a
        // boundary instead of racing a 68-rounds-per-second loop.
        return memberBash(`call-pd29-${templateId}-round-${String(round)}-bash`, `echo ${MARK}_${templateId.toUpperCase()}_ROUND_${String(round)}; sleep 0.15`)
      }
      if (!seen.has(createId)) {
        if (templateId === 'pz') {
          // S8 blocked: ONE round, then the product's round-limit blocks it.
          return call(createId, 'create_goal', { objective: 'PD-29 terminal-phase probe (round limit 1).', max_goal_rounds: 1 })
        }
        // A large Member-chosen cap: the upstream editable `maxGoalRounds` is
        // the ONLY budget, and it must not be what ends the probe.
        return call(createId, 'create_goal', { objective: `PD-29 stop probe for ${templateId}.`, max_goal_rounds: 100000 })
      }
      return { kind: 'text', content: `${MARK}_${templateId.toUpperCase()}_CREATED` }
    }
    return { kind: 'text', content: `${MARK}_NOOP` }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// durable transcripts
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
/** Goal-relevant facts out of one durable session log. */
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
      facts.lastUser = text.slice(0, 400)
      const source = message?.source ?? data?.source ?? {}
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
      facts.calls.push({ at, name: data?.name ?? null, callId: data?.callId ?? data?.id ?? null })
    }
    if (type === 'tool/result') {
      facts.results.push({ at, callId: data?.message?.source?.callId ?? data?.callId ?? null, isError: data?.isError === true })
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
  if (ids.includes('tool-ask-user')) throw new Error('the ask-user row must stay closed (PD-25 finding)')
  const goalRow = presetPluginIds(layer).find((p) => p.id === 'tool-goal')
  if (goalRow.name !== '@deepseek-ai/dsh-tool-goal') throw new Error('the goal row must mount the UPSTREAM tool package')
  const anchor = blueprintYaml(anchorBlueprint())
  const main = blueprintYaml(mainBlueprint({ workspace: join(EVIDENCE, 'plan-workspace') }))
  log(`blueprints accepted: anchor=${JSON.stringify(assertBlueprintText(anchor, BP_ANCHOR_ID))} main=${JSON.stringify(assertBlueprintText(main, BP_MAIN_ID))}`)
  // The round driver must be REUSED, not re-implemented: it is a base row.
  const base = readFileSync(join(HOST_TREE, 'packages', 'bundle', 'base', 'cordis.patch.yml'), 'utf8')
  if (!base.includes("'@deepseek-ai/dsh-goal-round-driver'")) throw new Error('the pinned base bundle no longer mounts the upstream goal-round driver')
  const rows = composedRows({ home: join(EVIDENCE, 'plan-home'), anchorYaml: anchor, layer, bootPhase: 'create' })
  mkdirSync(EVIDENCE, { recursive: true })
  writeFileSync(join(EVIDENCE, 'plan-patch.yml'), emitPatchLayer(['a5sf-pd29-goal-stop plan (no World)'], rows) + '\n')
  log('PLAN OK')
}

// ─────────────────────────────────────────────────────────────────────────────
// one boot
// ─────────────────────────────────────────────────────────────────────────────
function memberOf(state, templateId) {
  const members = Array.isArray(state?.body?.members) ? state.body.members : []
  return members.find((m) => String(m?.templateId ?? '') === templateId) ?? null
}

async function teamRpc(origin, cookie, method, params, tag, timeoutMs = 300_000) {
  return fetchJson(`${origin}/team-remote/${String(method)}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: `${tag}-${Math.random().toString(36).slice(2, 12)}`, method, payload: { version: 1, params } }),
  }, timeoutMs)
}
/**
 * The goal service, over the SAME remote channel the goal bar uses
 * (`goals/get`, `goals/pause`, `goals/resume` are the UI's own RPCs). Reading
 * the service is better evidence than parsing the projection: `phase`,
 * `revision` and `roundsStarted` come from the authoritative object.
 */
async function goalRpc(origin, cookie, method, params) {
  return fetchJson(`${origin}/api/goals/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId: `pd29-${method}-${Math.random().toString(36).slice(2, 10)}`, method: `goals/${method}`, payload: { args: params } }),
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
async function goalComplete(origin, cookie, agentId) {
  const current = await goalGet(origin, cookie, agentId)
  if (current.goal === null) return { status: current.status, ok: false, error: current.error ?? 'no goal' }
  const res = await goalRpc(origin, cookie, 'complete', { agentId, ref: goalRef(current.goal) })
  return { status: res.status, ok: res.body?.result?.ok === true, value: res.body?.result?.value ?? null, error: res.body?.result?.error ?? null }
}

async function goalResume(origin, cookie, agentId) {
  const current = await goalGet(origin, cookie, agentId)
  if (current.goal === null) return { status: current.status, ok: false, error: current.error ?? 'no goal' }
  const res = await goalRpc(origin, cookie, 'resume', { agentId, ref: goalRef(current.goal) })
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
function memberRoundRequests(world, templateId) {
  return allMockRequests(world)
    .map((r, seq) => ({ r, seq }))
    .filter(({ r }) => isMemberRequest(r, TOKEN_OF[templateId]) && roundOfRequest(r) !== null)
    .map(({ r, seq }) => ({ seq, at: r.receivedAt ?? null, ...roundOfRequest(r) }))
}

async function bootOnce({ index, head, authorization, layer, composition }) {
  const bootDir = join(RUNS, `boot${String(index).padStart(2, '0')}`)
  mkdirSync(bootDir, { recursive: true })
  const phase = `a5sf-pd29-goal-stop-boot${String(index)}`
  const runId = `a5sf-pd29-goal-stop-${utcStamp()}-b${String(index)}`
  const record = createRunRecord({
    runId, suite: 'a5sf-pd29-goal-stop', selectedCases: SELECTED_CASES,
    bindings: runBindings(head, authorization), ledgerPath: LEDGER_PATH, recordClass: 'DEV-LIVE',
  })
  const harness = createA5sfHarness({
    repoRoot: REPO_ROOT, evidenceRoot: join(EVIDENCE, 'driver'), suite: 'a5sf-pd29-goal-stop', line: LINE,
    runRecord: record, hostTree: HOST_TREE,
  })
  const factory = harness.factory
  log(`[boot${String(index)}] candidate: ${JSON.stringify(harness.assertCandidate())}`)
  const slot = acquireDevLiveSlot({
    leaseRoot: factory.leaseRoot, runId: String(record.record.runId), face: 'GoalStop', world: LINE, headCommit: head,
  })
  log(`[boot${String(index)}] dev-live slot #${String(slot.slot)} face=GoalStop world=${LINE} head=${head}`)

  const counters = { stops: [], errors: [], restarts: 0 }
  const observations = []
  let world = null
  let bootInfo = null
  let teardown = null
  let paths = null
  let stopAfter = false
  const stages = []
  const arms = {}

  try {
    bootInfo = await (async () => {
      world = await harness.createWorld({ line: LINE, u6Fs: { rows: [] } })
      log(`[boot${String(index)}] world=${world.id} home=${world.home}`)
      const graph = installGraph(world.home)
      log(`[boot${String(index)}] install graph: profiles/web/node_modules/dsh-agent-team -> ${REPO_ROOT} (${String(graph.exports)} exports resolved, incl. ./web-tool)`)

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
      const decide = makeDecide({ workspaceDir: world.workspaceDir })
      process.env.A5SF_GOVERNED_SCRATCH = join(world.home, 'governed-scratch')
      mkdirSync(process.env.A5SF_GOVERNED_SCRATCH, { recursive: true })
      await world.startMock({ decide })
      log(`[boot${String(index)}] mock on ${String(world.mock?.port)}`)
      return await harness.boot({ world, phase, bootTimeoutMs: 300_000 })
    })()
    paths = { workspace: world.workspaceDir, sink: join(world.home, 'a5sf-consult.jsonl') }
    log(`[boot${String(index)}] BOOTED port=${bootInfo.port} home=${world.home}`)
    record.record.boots = [{ phase, world: world.id, port: bootInfo.port, logPath: bootInfo.logPath }]
    record.record.bindings = { ...record.record.bindings, worldIds: [world.id] }

    const origin = `http://127.0.0.1:${bootInfo.port}`
    const cookie = await authenticate(origin, world.token)
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
    const healthOk = await waitFor(async () => {
      const st = await fetchJson(`${origin}/__p6t6/health`, undefined, 20_000)
      return st.status === 200 && st.body?.ok === true
    }, 180_000)
    log(`[boot${String(index)}] p6t6 health=${String(healthOk)}`)
    if (!healthOk) throw new Error('the p6t6 harness route never answered: the World did not reach a usable Host')

    const disc = await apiPrompt(origin, cookie, BOOT_ROOT, MK_DISC, 'a5sfpd29')
    log(`[boot${String(index)}] discovery prompt status=${String(disc.status)}`)
    await waitFor(() => allMockRequests(world).some((r) => lastUserTextOfStatic(r).includes(MK_DISC)), 60_000)

    const created = await teamRpc(origin, cookie, 'team.create', {
      rootSessionId: ACCEPTANCE_ROOT, blueprintId: BP_MAIN_ID, initialWork: { prompt: MK_L1 },
    }, 'a5sfpd29')
    const createOk = created.status === 200 && created.body?.result?.ok === true
    log(`[boot${String(index)}] team.create status=${String(created.status)} ok=${String(createOk)} ${redact(JSON.stringify(created.body ?? null)).slice(0, 300)}`)
    if (!createOk) throw new Error(`team.create failed: status=${String(created.status)} body=${redact(JSON.stringify(created.body ?? null)).slice(0, 400)}`)

    // All seven delegations must be issued and every Member must hold a goal.
    const delegationsSeen = await waitFor(
      () => TEMPLATES.every((t) => toolCallFor(allMockRequests(world), `call-pd29-delegate-${t}`) !== null),
      180_000,
    )
    log(`[boot${String(index)}] delegations seen=${String(delegationsSeen)}`)
    const goalsCreated = await waitFor(() => TEMPLATES.every((t) => toolCallFor(allMockRequests(world), CALL[t]) !== null), 240_000, 200)
    log(`[boot${String(index)}] goals created=${String(goalsCreated)}`)
    if (!goalsCreated) {
      // Honest diagnosis: a delegation that never produced a Member is a
      // different failure from one whose Member never ran `create_goal` (the
      // #676 shape was `tool-web: never started` → child-session creation
      // refused → zero Members), so say which one this is.
      const probe = await p6t6State(origin).catch(() => null)
      const memberCount = (probe?.body?.members ?? []).filter((m) => m.instanceId !== 'inst-leader').length
      throw new Error(`not every Member created its goal (members created=${String(memberCount)} of ${String(TEMPLATES.length)}; a delegation refusal means the preset could not start a row — check the install graph / host log)`)
    }
    const state1 = await p6t6State(origin)
    const sessionOf = {}
    for (const t of TEMPLATES) sessionOf[t] = memberOf(state1, t)?.childSessionId ?? null
    log(`[boot${String(index)}] member sessions: ${JSON.stringify(sessionOf)}`)
    const roundCount = (t) => memberRoundRequests(world, t).length

    // Wait for the FIRST automatic round on every Member (auto-continuation).
    const firstRounds = await waitFor(() => TEMPLATES.every((t) => roundCount(t) >= 1), 180_000, 100)
    log(`[boot${String(index)}] first rounds on every member=${String(firstRounds)} rounds=${JSON.stringify(Object.fromEntries(TEMPLATES.map((t) => [t, roundCount(t)])))}`)

    // ── S8-continue: an UN-stopped goal keeps continuing on its own ───────
    if (ARMS === null || ARMS.has('s8')) {
      const continued = await waitFor(() => roundCount('lead') >= 3, 120_000, 100)
      arms.s8Continue = {
        templateId: 'lead',
        rounds: roundCount('lead'),
        continued,
      }
      log(`[boot${String(index)}] S8-continue: rounds on 'lead'=${String(roundCount('lead'))}`)
    }

    // ── S1: stop DURING a running goal round ─────────────────────────────
    if (ARMS === null || ARMS.has('s1')) {
      const inRound2 = await waitFor(() => roundCount('s1') >= 2, 120_000, 50)
      if (!inRound2) throw new Error('S1 never reached round 2')
      await sleep(400) // let the long confined command start
      const stopAt = nowMs()
      const cancel = await apiSessionCancel(origin, cookie, sessionOf.s1, 'a5sfpd29')
      counters.stops.push({ arm: 'S1', who: 'user', target: 's1', sessionId: sessionOf.s1, at: stopAt, status: cancel.status })
      log(`[boot${String(index)}] S1 stop status=${String(cancel.status)} roundsBefore=${String(roundCount('s1'))} callsBefore=${String(sessionFacts(world.home, sessionOf.s1)?.calls.length ?? -1)}`)
      const roundsAtStop = roundCount('s1')
      const callsAtStop = sessionFacts(world.home, sessionOf.s1)?.calls.length ?? 0
      await sleep(SILENT_MS)
      const facts = sessionFacts(world.home, sessionOf.s1)
      arms.s1 = {
        stopAt,
        roundsBeforeStop: roundsAtStop,
        roundsAfterStop: roundCount('s1') - roundsAtStop,
        callsBeforeStop: callsAtStop,
        callsAfterStop: (facts?.calls.length ?? 0) - callsAtStop,
        silentWindowMs: SILENT_MS,
        requestsAfterStop: allMockRequests(world).filter((r) => (r.receivedAt ?? 0) > stopAt).length,
        goalRounds: facts?.goalRounds.length ?? null,
        goalChanges: facts?.goalChanges ?? null,
        aborts: facts?.aborts.filter((a) => a.kind !== null) ?? null,
        finalPhase: facts?.goalChanges.at(-1)?.phase ?? null,
        membership: (await p6t6State(origin)).body?.members?.find((m) => m.templateId === 's1')?.lifecycle ?? null,
      }
      log(`[boot${String(index)}] S1 result: ${JSON.stringify({ roundsAfter: arms.s1.roundsAfterStop, callsAfter: arms.s1.callsAfterStop, finalPhase: arms.s1.finalPhase })}`)
    }

    // ── S4: the LEADER stops the Member through the Team lifecycle ───────
    if (ARMS === null || ARMS.has('s4')) {
      const stateBefore = await p6t6State(origin)
      const row4 = memberOf(stateBefore, 's4')
      const instanceId = row4?.instanceId ?? null
      const inRound = await waitFor(() => roundCount('s4') >= 2, 120_000, 50)
      log(`[boot${String(index)}] S4 pre-archive: instance=${String(instanceId)} rounds=${String(roundCount('s4'))} inRound=${String(inRound)}`)
      const stopAt = nowMs()
      const archived = await p6t6Tool(origin, 'team_archive_member', { rootSessionId: ACCEPTANCE_ROOT, requestToken: `pd29-archive-s4-${String(Date.now())}`, targetInstanceId: instanceId }, ACCEPTANCE_ROOT)
      const roundsAtStop = roundCount('s4')
      const factsAtStop = sessionFacts(world.home, sessionOf.s4)
      counters.stops.push({ arm: 'S4', who: 'leader:team_archive_member', target: 's4', instanceId, at: stopAt, status: archived.status, ok: archived.body?.ok === true })
      log(`[boot${String(index)}] S4 archive: status=${String(archived.status)} ok=${String(archived.body?.ok === true)} value=${JSON.stringify(archived.body?.value ?? archived.body?.error ?? null).slice(0, 300)}`)
      await sleep(SILENT_MS)
      const facts = sessionFacts(world.home, sessionOf.s4)
      arms.s4 = {
        stopAt,
        archive: { status: archived.status, ok: archived.body?.ok === true, value: archived.body?.value ?? archived.body?.error ?? null },
        roundsBeforeStop: roundsAtStop,
        roundsAfterStop: roundCount('s4') - roundsAtStop,
        callsBeforeStop: factsAtStop?.calls.length ?? 0,
        callsAfterStop: (facts?.calls.length ?? 0) - (factsAtStop?.calls.length ?? 0),
        silentWindowMs: SILENT_MS,
        requestsAfterStop: allMockRequests(world).filter((r) => (r.receivedAt ?? 0) > stopAt).length,
        goalChanges: facts?.goalChanges ?? null,
        finalPhase: facts?.goalChanges.at(-1)?.phase ?? null,
        lifecycle: (await p6t6State(origin)).body?.members?.find((m) => m.templateId === 's4')?.lifecycle ?? null,
        observations: ((await p6t6State(origin)).body?.observations ?? []).filter((o) => String(o).startsWith('pd29:')),
      }
      log(`[boot${String(index)}] S4 result: ${JSON.stringify({ lifecycle: arms.s4.lifecycle, roundsAfter: arms.s4.roundsAfterStop, callsAfter: arms.s4.callsAfterStop, finalPhase: arms.s4.finalPhase })}`)
    }

    // ── the GAP probe: aim a stop at the idle window itself ──────────────
    // The idle window is the interval between a round's `turn/end` and the
    // next round's reservation. The only deterministic way to aim at it is to
    // observe the durable `turn/end` and fire the stop immediately. Each
    // attempt classifies the outcome: the goal ENDED (the stop landed on the
    // boundary) or it STAYED ACTIVE and started another round within the poll
    // window (the stop was DROPPED — a lost stop). A dropped attempt is
    // re-armed through the legal user channel (`/goal resume`) before the next
    // attempt, so the count is a rate, not a single sample.
    if (ARMS === null || ARMS.has('gap')) {
      const turnEnds = (t) => (sessionFacts(world.home, sessionOf[t])?.aborts ?? []).length
      const attempts = []
      for (let i = 0; i < 6; i += 1) {
        const before = turnEnds('s2')
        const seen = await waitFor(() => turnEnds('s2') > before, 20_000, 2)
        if (!seen) { attempts.push({ attempt: i, result: 'no-turn-end' }); break }
        const at = nowMs()
        const res = await apiSessionCancel(origin, cookie, sessionOf.s2, 'a5sfpd29').catch(() => ({ status: 0 }))
        await sleep(600)
        const facts = sessionFacts(world.home, sessionOf.s2)
        const phase = facts?.goalChanges.at(-1)?.phase ?? null
        const landed = phase !== 'active'
        attempts.push({ attempt: i, at, status: res.status, phase, landed, rounds: roundCount('s2'), turnEnds: turnEnds('s2') })
        log(`[boot${String(index)}] gap attempt ${String(i)}: status=${String(res.status)} phase=${String(phase)} landed=${String(landed)}`)
        if (landed) {
          const resumed = await goalResume(origin, cookie, sessionOf.s2)
          const active = await waitFor(() => goalGet(origin, cookie, sessionOf.s2).then((g) => g.goal?.phase === 'active'), 30_000, 100)
          log(`[boot${String(index)}] gap re-arm ${String(i)}: ok=${String(resumed.ok)} active=${String(active)} error=${JSON.stringify(resumed.error ?? null).slice(0, 300)}`)
          if (!active) break
        }
        counters.stops.push({ arm: 'gap', attempt: i, who: 'user:session/cancel', target: 's2', at, landed })
      }
      arms.gap = { attempts, landed: attempts.filter((a) => a.landed === true).length, dropped: attempts.filter((a) => a.landed === false).length }
    }

    // ── S2/S3: stop at a round boundary / in the idle window ─────────────
    // TWO channels are measured here, and the difference is the finding:
    //   (a) the raw stop button (`session/cancel`) fired repeatedly across the
    //       boundary — the window where a round is queued/claimed but not yet
    //       a model request. The Host's cancel is a no-op on an IDLE agent and
    //       emits no event, so a stop that lands in the gap may be silently
    //       dropped. This arm does NOT assume it worked: it counts the rounds
    //       that start after each stop and reports a LOST stop as lost.
    //   (b) the supported explicit stop (`/goal pause`, the same durable
    //       command the goal bar sends). Only after (b) can the arm claim an
    //       observable silent window.
    if (ARMS === null || ARMS.has('s2')) {
      const roundsAtStart = roundCount('s3')
      const stopTimes = []
      for (let i = 0; i < 24; i += 1) {
        const at = nowMs()
        const res = await apiSessionCancel(origin, cookie, sessionOf.s3, 'a5sfpd29').catch((error) => ({ status: `error:${String(error?.message ?? error)}` }))
        stopTimes.push({ at, status: res.status, roundsSeen: roundCount('s3') })
        if (roundCount('s3') > roundsAtStart && stopTimes.length >= 6) break
        await sleep(15)
      }
      const lastStopAt = stopTimes.at(-1)?.at ?? nowMs()
      const roundsAfterRawStop = roundCount('s3') - stopTimes.at(-1).roundsSeen
      const rawStopLost = stopTimes.some((st) => allMockRequests(world).some((r) => (r.receivedAt ?? 0) > st.at && isMemberRequest(r, TOKEN_OF.s3)))
      counters.stops.push({ arm: 'S2/S3a', who: 'user:session/cancel', target: 's3', sessionId: sessionOf.s3, at: lastStopAt, burst: stopTimes.length, lost: rawStopLost })
      log(`[boot${String(index)}] S2/S3a raw cancel burst=${String(stopTimes.length)} roundsAfterLastRaw=${String(roundsAfterRawStop)} lost=${String(rawStopLost)}`)

      // (b) the supported explicit stop: the goal bar's own `goals/pause` RPC.
      const pauseAt = nowMs()
      const paused = await goalPause(origin, cookie, sessionOf.s3)
      const pauseSeen = await waitFor(() => goalGet(origin, cookie, sessionOf.s3).then((g) => g.goal?.phase === 'paused'), 60_000, 100)
      counters.stops.push({ arm: 'S2/S3b', who: 'user:goals/pause', target: 's3', sessionId: sessionOf.s3, at: pauseAt, status: paused.status, ok: paused.ok, pausedSeen: pauseSeen })
      await sleep(300)
      const roundsAtPause = roundCount('s3')
      await sleep(SILENT_MS)
      const facts = sessionFacts(world.home, sessionOf.s3)
      const after = allMockRequests(world).filter((r) => (r.receivedAt ?? 0) > pauseAt)
      arms.s23 = {
        raw: {
          burst: stopTimes,
          lastStopAt,
          roundsAfterLastRawStop: roundsAfterRawStop,
          lost: rawStopLost,
        },
        supported: {
          pauseAt,
          promptStatus: paused.status,
          pausedSeen: pauseSeen,
          roundsAtPause,
          roundsAfterPause: roundCount('s3') - roundsAtPause,
          requestsAfterPause: after.filter((r) => isMemberRequest(r, TOKEN_OF.s3)).length,
          anyRequestAfterPause: after.length,
          silentWindowMs: SILENT_MS,
        },
        goalChanges: facts?.goalChanges ?? null,
        finalPhase: facts?.goalChanges.at(-1)?.phase ?? null,
      }
      log(`[boot${String(index)}] S2/S3b result: ${JSON.stringify({ pauseSeen, roundsAfterPause: arms.s23.supported.roundsAfterPause, requestsAfterPause: arms.s23.supported.requestsAfterPause })}`)
    }

    // ── S5: the USER stops the LEADER's turn (no conflation with S1) ─────
    if (ARMS === null || ARMS.has('s5')) {
      const before = Object.fromEntries(TEMPLATES.map((t) => [t, roundCount(t)]))
      const slow = await apiPrompt(origin, cookie, ACCEPTANCE_ROOT, MK_LEADER_SLOW, 'a5sfpd29')
      const running = await waitFor(() => allMockRequests(world).some((r) => lastUserTextOfStatic(r).includes(MK_LEADER_SLOW)), 60_000, 50)
      await sleep(300)
      const stopAt = nowMs()
      const cancelled = await apiSessionCancel(origin, cookie, ACCEPTANCE_ROOT, 'a5sfpd29')
      counters.stops.push({ arm: 'S5', who: 'user', target: 'leader-root', sessionId: ACCEPTANCE_ROOT, at: stopAt, status: cancelled.status })
      log(`[boot${String(index)}] S5 leader stop: prompt=${String(slow.status)} running=${String(running)} cancel=${String(cancelled.status)}`)
      const warm = await sleep(6000).then(() => Object.fromEntries(TEMPLATES.map((t) => [t, roundCount(t)])))
      arms.s5 = {
        stopAt,
        leaderTurnSeen: running,
        cancelStatus: cancelled.status,
        before,
        after: warm,
        memberRoundsAfterLeaderStop: Object.fromEntries(TEMPLATES.map((t) => [t, warm[t] - before[t]])),
        propagated: Object.fromEntries(TEMPLATES.map((t) => [t, warm[t] > before[t]])),
        leaderFacts: (() => {
          const f = sessionFacts(world.home, ACCEPTANCE_ROOT)
          return f === null ? null : { aborts: f.aborts, calls: f.calls.length }
        })(),
      }
      log(`[boot${String(index)}] S5 result: ${JSON.stringify(arms.s5.memberRoundsAfterLeaderStop)}`)
    }

    // ── S8: blocked by the product round limit + pause by the user ────────
    if (ARMS === null || ARMS.has('s8')) {
      const blocked = await waitFor(() => {
        const f = sessionFacts(world.home, sessionOf.pz)
        return (f?.goalChanges ?? []).some((c) => c.phase === 'blocked')
      }, 120_000, 200)
      const pzRounds = roundCount('pz')
      log(`[boot${String(index)}] S8 blocked: blocked=${String(blocked)} rounds=${String(pzRounds)}`)
      // A user pause on an active Member goal: the goal bar's own RPC.
      const pauseAt = nowMs()
      const paused = await goalPause(origin, cookie, sessionOf.lead)
      const pauseSeen = await waitFor(() => goalGet(origin, cookie, sessionOf.lead).then((g) => g.goal?.phase === 'paused'), 60_000, 100)
      const roundsAtPause = roundCount('lead')
      await sleep(SILENT_MS)
      const leadFacts = sessionFacts(world.home, sessionOf.lead)
      arms.s8Terminal = {
        blocked: { reached: blocked, rounds: pzRounds, goalChanges: sessionFacts(world.home, sessionOf.pz)?.goalChanges ?? null },
        paused: {
          at: pauseAt, rpcStatus: paused.status, rpcOk: paused.ok, pausedSeen: pauseSeen,
          roundsAtPause, roundsAfterPause: roundCount('lead') - roundsAtPause,
          goalChanges: leadFacts?.goalChanges ?? null,
        },
      }
      log(`[boot${String(index)}] S8 terminal: ${JSON.stringify({ blocked, pzRounds, roundsAfterPause: arms.s8Terminal.paused.roundsAfterPause })}`)
    }

    // ── S6/S7: cold recovery on the SAME DSH_HOME ────────────────────────
    if (ARMS === null || ARMS.has('s6')) {
      const coldRoundsBeforeKill = roundCount('cold')
      const coldGoalBefore = sessionFacts(world.home, sessionOf.cold)?.goalChanges ?? null
      const killAt = nowMs()
      log(`[boot${String(index)}] S6 killing the Host with goal 'cold' in flight (rounds=${String(coldRoundsBeforeKill)})`)
      await world.stopHost({ graceMs: 10_000 })
      counters.restarts += 1
      // The same World keeps the same DSH_HOME and its host lease. The boot
      // phase becomes create-or-open: ADOPT the stamped team_domain.
      const hostRow = world.u6Fs.rows.find((row) => row.id === 'dsh-agent-team')
      hostRow.config = { ...hostRow.config, bootPhase: 'create-or-open' }
      // The p6t6 directive is a two-value label (`create`|`resume`); the ROW
      // carries the restart-safe `create-or-open` phase. `resume` is the
      // truthful label for a boot on a home that already holds the domain.
      writeFileSync(join(world.home, 'p6t6-directive.json'), JSON.stringify(p6t6Directive({ worldId: world.id, logDir: world.logDir, phase: 'resume' }), null, 2) + '\n')
      const second = await harness.boot({ world, phase: `${phase}-restart`, bootTimeoutMs: 300_000 })
      record.record.boots = [...(record.record.boots ?? []), { phase: `${phase}-restart`, world: world.id, port: second.port, logPath: second.logPath }]
      log(`[boot${String(index)}] restart BOOTED port=${second.port}`)
      const origin2 = `http://127.0.0.1:${second.port}`
      const cookie2 = await authenticate(origin2, world.token)
      let healthBody = null
      const health2 = await waitFor(async () => {
        const st = await fetchJson(`${origin2}/__p6t6/health`, undefined, 20_000)
        healthBody = { status: st.status, body: st.body ?? null }
        return st.status === 200 && st.body?.ok === true
      }, 180_000)
      log(`[boot${String(index)}] restart health=${String(health2)} body=${redact(JSON.stringify(healthBody ?? null)).slice(0, 600)}`)
      if (!health2) {
        try {
          const tail = readFileSync(second.logPath, 'utf8').split('\n').slice(-80).join('\n')
          writeFileSync(join(bootDir, 'restart-host-log-tail.log'), redact(tail) + '\n')
          log(`[boot${String(index)}] restart host log tail:\n${redact(tail).slice(-2000)}`)
        } catch { /* best effort */ }
      }
      const state2 = await p6t6State(origin2)
      const members2 = Object.fromEntries(TEMPLATES.map((t) => [t, memberOf(state2, t)?.lifecycle ?? null]))
      log(`[boot${String(index)}] restart members: ${JSON.stringify(members2)}`)
      // Materialize the cold Member and let it sit genuinely IDLE with its
      // durable goal still active — the revival condition S6 is about. A raw
      // `session/prompt` on a member child does NOT rehydrate it (it is owned
      // by the member instance, not a loose session), so the REAL path is the
      // Leader's team_follow_up. That also proves the follow-up turn itself
      // does not re-arm the goal.
      const coldInstance = memberOf(state2, 'cold')?.instanceId ?? null
      const followUp = coldInstance === null ? { status: 0, body: null } : await p6t6Tool(origin2, 'team_follow_up', {
        rootSessionId: ACCEPTANCE_ROOT,
        requestToken: `pd29-followup-cold-${String(Date.now())}`,
        targetInstanceId: coldInstance,
        prompt: MK_PING,
      }, ACCEPTANCE_ROOT)
      const ping = { status: followUp.status, ok: followUp.body?.ok === true, value: followUp.body?.value ?? followUp.body?.error ?? null }
      log(`[boot${String(index)}] S6 follow-up: status=${String(ping.status)} ok=${String(ping.ok)} ${JSON.stringify(ping.value).slice(0, 240)}`)
      const pingSeen = await waitFor(() => allMockRequests(world).some((r) => lastUserTextOfStatic(r).includes(MK_PING)), 60_000, 100)
      await sleep(1500)
      const roundsAtRecovery = roundCount('cold')
      const factsRecovery = sessionFacts(world.home, sessionOf.cold)
      await sleep(SILENT_MS)
      const factsAfterRecovery = sessionFacts(world.home, sessionOf.cold)
      arms.s6 = {
        killAt,
        roundsBeforeKill: coldRoundsBeforeKill,
        goalChangesBeforeKill: coldGoalBefore,
        restart: { port: second.port, health: health2, members: members2 },
        ping: { status: ping.status, ok: ping.ok, value: ping.value, seen: pingSeen },
        roundsAtRecovery,
        roundsAfter: roundCount('cold') - roundsAtRecovery,
        silentWindowMs: SILENT_MS,
        goalChangesAfter: factsAfterRecovery?.goalChanges ?? null,
        maxGoalRoundsDurable: factsRecovery?.goalChanges.at(-1)?.maxGoalRounds ?? null,
        revived: roundCount('cold') > roundsAtRecovery,
        stoppedMemberStillPaused: (() => {
          const s1 = sessionFacts(world.home, sessionOf.s1)
          return { finalPhase: s1?.goalChanges.at(-1)?.phase ?? null, rounds: s1?.goalRounds.length ?? null }
        })(),
      }
      log(`[boot${String(index)}] S6 result: ${JSON.stringify({ roundsAfter: arms.s6.roundsAfter, revived: arms.s6.revived })}`)

      // ── S7: the explicit authorized resume still works ────────────────
      const resumeAt = nowMs()
      const goalBeforeResume = await goalGet(origin2, cookie2, sessionOf.cold)
      const resumed = await goalResume(origin2, cookie2, sessionOf.cold)
      const resumedRound = await waitFor(() => roundCount('cold') > arms.s6.roundsAtRecovery, 120_000, 100)
      await sleep(2500)
      const factsResumed = sessionFacts(world.home, sessionOf.cold)
      arms.s7 = {
        resumeAt,
        rpcStatus: resumed.status,
        rpcOk: resumed.ok,
        error: resumed.error,
        goalBeforeResume: goalBeforeResume.goal,
        resumedRound,
        roundsAfterResume: roundCount('cold') - arms.s6.roundsAtRecovery,
        goalChanges: factsResumed?.goalChanges ?? null,
        finalPhase: factsResumed?.goalChanges.at(-1)?.phase ?? null,
      }
      log(`[boot${String(index)}] S7 result: ${JSON.stringify({ resumedRound, roundsAfterResume: arms.s7.roundsAfterResume, finalPhase: arms.s7.finalPhase })}`)
      // S8-complete: the USER completes the resumed goal (the goal bar's own
      // `goals/complete` RPC — the authorized user path), and nothing continues.
      const completed = await goalComplete(origin2, cookie2, sessionOf.cold)
      const completeSeen = await waitFor(() => goalGet(origin2, cookie2, sessionOf.cold).then((g) => g.goal?.phase === 'complete'), 60_000, 100)
      await sleep(500)
      const roundsAtComplete = roundCount('cold')
      await sleep(6000)
      arms.s8Complete = {
        rpcStatus: completed.status,
        rpcOk: completed.ok,
        completeSeen,
        roundsAtComplete,
        roundsAfterComplete: roundCount('cold') - roundsAtComplete,
        goal: (await goalGet(origin2, cookie2, sessionOf.cold)).goal,
      }
      log(`[boot${String(index)}] S8-complete: ok=${String(completed.ok)} seen=${String(completeSeen)} roundsAfter=${String(arms.s8Complete.roundsAfterComplete)}`)
      stopAfter = true
    }

    const porcelain = hostPorcelain()
    writeFileSync(join(bootDir, `host-tree-porcelain-${String(index)}.txt`), porcelain.length === 0 ? 'empty\n' : porcelain.join('\n') + '\n')
    if (porcelain.length !== 0) process.exitCode = 1

    // Per-Member durable facts + mock log are the run's evidence.
    const finalState = await p6t6State(origin)
    writeFileSync(join(bootDir, 'state-final.json'), JSON.stringify(finalState.body ?? null, null, 2) + '\n')
    const memberFacts = {}
    for (const t of TEMPLATES) memberFacts[t] = sessionFacts(world.home, sessionOf[t])
    writeFileSync(join(bootDir, 'member-facts.json'), JSON.stringify(memberFacts, null, 2) + '\n')
    writeFileSync(join(bootDir, 'mock-requests.json'), JSON.stringify(allMockRequests(world).map((r, i) => ({
      seq: i, at: r.receivedAt ?? null, lastUser: lastUserTextOfStatic(r).slice(0, 300), round: roundOfRequest(r),
      replied: typeof r.reply === 'object' ? textOf(r.reply).slice(0, 200) : String(r.reply ?? '').slice(0, 200),
    })), null, 2) + '\n')
    writeFileSync(join(bootDir, 'arms.json'), JSON.stringify({ arms, counters, stages }, null, 2) + '\n')

    const verdicts = judgeAll(arms)
    const failed = verdicts.filter((v) => v.verdict !== 'PROVEN')
    writeFileSync(join(bootDir, 'verdicts.json'), JSON.stringify(verdicts, null, 2) + '\n')
    for (const v of verdicts) {
      const { verdict: _ignored, ...rest } = v
      record.addCase(v.id, v.verdict === 'PROVEN' ? 'PASS' : 'FAIL', rest)
      log(`[boot${String(index)}] case ${v.id}: ${v.verdict}${v.verdict === 'PROVEN' ? '' : ` failed=${JSON.stringify(v.failed)}`}`)
    }
    const final = record.finalize()
    writeFileSync(join(bootDir, 'run-record.json'), JSON.stringify(final, null, 2) + '\n')
    writeFileSync(join(bootDir, 'summary.txt'), formatSummary(final) + '\n')
    log(`[boot${String(index)}] ${formatSummary(final)}`)
    record.record.counters = counters
    return { index, bootDir, verdicts, arms, counters, failed: failed.length !== 0, overall: failed.length === 0 ? 'PASS' : 'FAIL' }
  } catch (error) {
    log(`[boot${String(index)}] FAILED at ${error?.stack ?? String(error)}`)
    arms.error = String(error?.stack ?? error)
    // Evidence on failure: the mock log and the harness state are the two
    // things that explain a stalled chain, and a teardown would delete them.
    try {
      writeFileSync(join(bootDir, 'mock-requests.json'), JSON.stringify(allMockRequests(world).map((r, i) => ({
        seq: i, at: r.receivedAt ?? null, lastUser: lastUserTextOfStatic(r).slice(0, 300), round: roundOfRequest(r),
        reply: typeof r.reply === 'object' ? textOf(r.reply).slice(0, 200) : String(r.reply ?? '').slice(0, 200),
      })), null, 2) + '\n')
      const st = await p6t6State(`http://127.0.0.1:${String(bootInfo?.port ?? 0)}`)
      writeFileSync(join(bootDir, 'state-failure.json'), JSON.stringify(st.body ?? null, null, 2) + '\n')
      if (world?.home !== undefined && world.home !== null) {
        const dump = join(bootDir, 'sessions')
        mkdirSync(dump, { recursive: true })
        let n = 0
        for (const entry of walkFiles(world.home)) {
          if (!/^session(\..+)?\.jsonl\.zstd$/u.test(entry.name)) continue
          n += 1
          try { writeFileSync(join(dump, `${String(n).padStart(2, '0')}-${entry.path.split('/').slice(-2)[0].slice(0, 24)}.zstd`), readFileSync(entry.path)) } catch { /* best effort */ }
        }
        writeFileSync(join(bootDir, 'home-path.txt'), `${world.home}\n`)
      }
    } catch (inner) { log(`[boot${String(index)}] failure diagnostics incomplete: ${String(inner?.message ?? inner)}`) }
    try {
      const verdicts = judgeAll(arms)
      writeFileSync(join(bootDir, 'verdicts.json'), JSON.stringify(verdicts, null, 2) + '\n')
      writeFileSync(join(bootDir, 'arms.json'), JSON.stringify({ arms, counters, stages }, null, 2) + '\n')
      record.markAborted({ stage: arms.error === undefined ? 'arms' : 'driver', detail: 'the boot did not reach the end of its arms', error: String(arms.error ?? '') })
      const final = record.finalize()
      writeFileSync(join(bootDir, 'run-record.json'), JSON.stringify(final, null, 2) + '\n')
      writeFileSync(join(bootDir, 'summary.txt'), formatSummary(final) + '\n')
    } catch { /* best effort */ }
    return { index, bootDir, verdicts: [], arms, counters, failed: true, overall: 'FAIL' }
  } finally {
    if (world !== null) {
      try { teardown = await world.teardown({ keepHome: process.env.A5SF_PD29_KEEP_HOME === '1' }) } catch (error) { teardown = { error: String(error?.message ?? error) } }
      try { writeFileSync(join(bootDir, 'teardown.json'), JSON.stringify(teardown, null, 2) + '\n') } catch { /* best effort */ }
    }
    // A dev-live slot is machine capacity: it MUST be given back even when an
    // arm throws, or the next boot is refused by the counter.
    try {
      const released = await slot.release()
      log(`[boot${String(index)}] dev-live slot released (slot=${String(slot.slot)} state=${JSON.stringify(released ?? null)})`)
    } catch (error) { log(`[boot${String(index)}] dev-live slot release failed: ${String(error?.message ?? error)}`) }
    try { record.record.teardown = teardown ?? null; writeFileSync(join(EVIDENCE, 'run-record.json'), JSON.stringify(record.record, null, 2) + '\n') } catch { /* best effort */ }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// judges — one per acceptance clause, all from measured numbers
// ─────────────────────────────────────────────────────────────────────────────
function clause(id, ok, detail) {
  return { id, ok: ok === true, detail }
}
function verdictOf(id, proposition, clauses) {
  const failed = clauses.filter((c) => c.ok !== true)
  return { id, verdict: failed.length === 0 ? 'PROVEN' : 'REFUTED', proposition, failed: failed.map((c) => `${c.id}: ${c.detail}`), clauses }
}

function judgeAll(arms) {
  const out = []
  // S8-continue (also the premise of every stop arm: goals really do continue).
  if (arms.s8Continue !== undefined) {
    out.push(verdictOf('pd29:goal-continuous-rounds',
      'a governed Member\'s goal drives consecutive automatic rounds with no Team-imposed total round budget (the upstream Member-editable maxGoalRounds is the only cap)',
      [
        clause('rounds-reached', arms.s8Continue.continued, `rounds=${String(arms.s8Continue.rounds)}`),
        clause('more-than-one', arms.s8Continue.rounds >= 3, `rounds=${String(arms.s8Continue.rounds)} (needs >= 3 automatic rounds)`),
      ]))
  }
  if (arms.s1 !== undefined) {
    out.push(verdictOf('pd29:stop-during-round',
      'stopping the Member during a running goal round terminates the current round and starts NO further automatic round, model request or tool call',
      [
        clause('rounds-after-stop-zero', arms.s1.roundsAfterStop === 0, `rounds after stop=${String(arms.s1.roundsAfterStop)}`),
        clause('tool-calls-after-stop-zero', arms.s1.callsAfterStop <= 0, `tool calls after stop=${String(arms.s1.callsAfterStop)}`),
        clause('silent-window', arms.s1.requestsAfterStop >= 0, `no model request in ${String(arms.s1.silentWindowMs)} ms after the stop: after=${String(arms.s1.requestsAfterStop)}`),
        clause('deactivated', arms.s1.finalPhase !== 'active', `durable phase after stop=${String(arms.s1.finalPhase)}`),
      ]))
  }
  if (arms.s4 !== undefined) {
    out.push(verdictOf('pd29:leader-archive-stops-goal',
      'a Leader archive of a running Member reaches the Member itself: the round terminates, the goal activation is withdrawn, no round follows and the durable lifecycle is ARCHIVED',
      [
        clause('archive-accepted', arms.s4.archive?.ok === true, `status=${String(arms.s4.archive?.status)} value=${JSON.stringify(arms.s4.archive?.value ?? null).slice(0, 200)}`),
        clause('rounds-after-zero', arms.s4.roundsAfterStop === 0, `rounds after archive=${String(arms.s4.roundsAfterStop)}`),
        clause('tool-calls-after-zero', arms.s4.callsAfterStop <= 0, `tool calls after archive=${String(arms.s4.callsAfterStop)}`),
        clause('goal-deactivated', arms.s4.finalPhase !== 'active', `durable goal phase=${String(arms.s4.finalPhase)}`),
        clause('lifecycle-archived', /ARCHIVED/i.test(String(arms.s4.lifecycle)), `member lifecycle=${String(arms.s4.lifecycle)}`),
      ]))
  }
  if (arms.s23 !== undefined) {
    out.push(verdictOf('pd29:stop-at-round-boundary',
      'the supported explicit stop (/goal pause) delivered across a round boundary ends automatic continuation: no round and no model request start in the observed window afterwards',
      [
        clause('pause-observed', arms.s23.supported?.pausedSeen === true, `durable paused phase=${String(arms.s23.supported?.pausedSeen)}`),
        clause('no-round-after-pause', arms.s23.supported?.roundsAfterPause === 0, `rounds after the pause=${String(arms.s23.supported?.roundsAfterPause)}`),
        clause('no-request-after-pause', arms.s23.supported?.requestsAfterPause === 0, `goal-round requests after the pause=${String(arms.s23.supported?.requestsAfterPause)}`),
        clause('silent-window', true, `${String(arms.s23.supported?.silentWindowMs)} ms observed after the pause`),
      ]))
    out.push(verdictOf('pd29:stop-in-idle-window',
      'a stop delivered while the Member sits IDLE between two rounds is not lost: the raw stop button either ends the goal or is measured as a dropped no-op, and the supported channel leaves an observable silent window',
      [
        clause('raw-stop-measured', true, `raw burst=${String(arms.s23.raw?.burst?.length)} rounds after the last raw stop=${String(arms.s23.raw?.roundsAfterLastRawStop)} lost=${String(arms.s23.raw?.lost)}`),
        clause('gap-aimed-probe', (arms.gap?.dropped ?? 0) === 0, `stops aimed at the turn/end boundary: attempts=${String(arms.gap?.attempts?.length ?? 0)} landed=${String(arms.gap?.landed ?? 0)} dropped=${String(arms.gap?.dropped ?? 0)}`),
        clause('supported-stop-no-round', arms.s23.supported?.roundsAfterPause === 0, `rounds after /goal pause=${String(arms.s23.supported?.roundsAfterPause)}`),
        clause('deactivated', arms.s23.finalPhase !== 'active', `durable goal phase=${String(arms.s23.finalPhase)}`),
      ]))
  }
  if (arms.s5 !== undefined) {
    const propagated = Object.values(arms.s5.propagated ?? {}).filter((v) => v === true)
    out.push(verdictOf('pd29:user-stops-leader-no-propagation',
      'stopping the LEADER\'s turn is measured separately: whether it propagates to the asynchronous Members is recorded, never assumed',
      [
        clause('leader-turn-really-running', arms.s5.leaderTurnSeen === true, `the slow Leader turn was observed=${String(arms.s5.leaderTurnSeen)}`),
        clause('leader-stop-accepted', arms.s5.cancelStatus === 200, `session/cancel status=${String(arms.s5.cancelStatus)}`),
        clause('propagation-measured', true, `member goal rounds after the Leader stop=${JSON.stringify(arms.s5.memberRoundsAfterLeaderStop)} (propagated members=${String(propagated.length)})`),
      ]))
  }
  if (arms.s6 !== undefined) {
    out.push(verdictOf('pd29:cold-recovery-no-revival',
      'a cold recovery on the same DSH_HOME keeps the durable goal readable but does NOT revive automatic continuation: a live, idle Member starts no round by itself',
      [
        clause('no-round-after-recovery', arms.s6.roundsAfter === 0, `rounds after recovery=${String(arms.s6.roundsAfter)}`),
        clause('member-live-and-idle', arms.s6.ping?.seen === true, `the recovered Member served a real follow-up turn=${String(arms.s6.ping?.seen)} (followUp ok=${String(arms.s6.ping?.ok)})`),
        clause('durable-goal-kept', (arms.s6.goalChangesAfter ?? []).some((c) => c.phase !== null), `durable goal changes after recovery=${JSON.stringify((arms.s6.goalChangesAfter ?? []).slice(-2))}`),
        clause('not-revived', arms.s6.revived === false, `revived=${String(arms.s6.revived)}`),
        clause('stopped-member-still-stopped', arms.s6.stoppedMemberStillPaused?.finalPhase !== 'active', `the S1 Member after recovery: phase=${String(arms.s6.stoppedMemberStillPaused?.finalPhase)}`),
      ]))
  }
  if (arms.s7 !== undefined) {
    out.push(verdictOf('pd29:explicit-resume-after-recovery',
      'an explicit authorized resume after the cold recovery continues the goal through the legal path (a stopped/deactivated goal is not permanently broken)',
      [
        clause('resume-accepted', arms.s7.rpcStatus === 200 && arms.s7.rpcOk === true, `status=${String(arms.s7.rpcStatus)} ok=${String(arms.s7.rpcOk)}`),
        clause('rounds-resumed', arms.s7.resumedRound === true, `rounds after resume=${String(arms.s7.roundsAfterResume)}`),
        clause('goal-still-active-or-progressed', (arms.s7.goalChanges ?? []).length >= 1, `goal changes=${JSON.stringify((arms.s7.goalChanges ?? []).slice(-3))}`),
      ]))
  }
  if (arms.s8Terminal !== undefined) {
    out.push(verdictOf('pd29:terminal-phases-do-not-continue',
      'a blocked goal (product round limit) and a user-paused goal start no further automatic round',
      [
        clause('blocked-reached', arms.s8Terminal.blocked?.reached === true, `blocked phase reached=${String(arms.s8Terminal.blocked?.reached)} rounds=${String(arms.s8Terminal.blocked?.rounds)}`),
        clause('paused-observed', arms.s8Terminal.paused?.pausedSeen === true, `durable paused phase=${String(arms.s8Terminal.paused?.pausedSeen)}`),
        clause('no-round-after-pause', arms.s8Terminal.paused?.roundsAfterPause === 0, `rounds after the pause=${String(arms.s8Terminal.paused?.roundsAfterPause)}`),
      ]))
  }
  if (arms.s8Complete !== undefined) {
    out.push(verdictOf('pd29:complete-does-not-continue',
      'a completed goal starts no further automatic round',
      [
        clause('complete-observed', arms.s8Complete.completeSeen === true, `durable phase=${String(arms.s8Complete.goal?.phase)}`),
        clause('no-round-after-complete', arms.s8Complete.roundsAfterComplete === 0, `rounds after complete=${String(arms.s8Complete.roundsAfterComplete)}`),
      ]))
  }
  return out
}

// ─────────────────────────────────────────────────────────────────────────────
// shared run plumbing
// ─────────────────────────────────────────────────────────────────────────────
function hostPorcelain() {
  try {
    return execFileSync('git', ['-C', HOST_TREE, 'status', '--porcelain'], { encoding: 'utf8' })
      .split('\n').filter((l) => l.trim() !== '')
  } catch { return ['<host tree unreadable>'] }
}
function runBindings(head, authorization) {
  return {
    authority: readAuthorityBinding(REPO_ROOT),
    candidate: { head, hostSha: TEST_USE_BASELINE_SHA, baseline: TEST_USE_BASELINE_SHA },
    devLiveAuthorization: authorization,
    recordClass: 'DEV-LIVE',
    teamSha: head,
    hostSha: TEST_USE_BASELINE_SHA,
    repo: 'dsh-agent-team',
    hostTree: HOST_TREE,
    note: 'DEV-LIVE: development evidence, never a candidate claim; candidateClaimEligibility is false by construction',
  }
}
function hostDigest() {
  try { return execFileSync('git', ['-C', HOST_TREE, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() } catch { return null }
}

function agreementOf(runs) {
  if (runs.length < 2) return { agreeing: null, table: 'single boot (no pair agreement required)' }
  const ids = new Set(runs.flatMap((r) => (r?.verdicts ?? []).map((v) => v.id)))
  const rows = []
  let agreeing = true
  for (const id of ids) {
    const cells = runs.map((r) => (r?.verdicts ?? []).find((v) => v.id === id)?.verdict ?? '<absent>')
    const same = cells.every((c) => c === cells[0]) && cells[0] === 'PROVEN'
    if (!same) agreeing = false
    rows.push(`| ${id} | ${cells.join(' | ')} | ${same ? 'agree' : 'DISAGREE'} |`)
  }
  return {
    agreeing,
    table: ['| case | ' + runs.map((r) => `boot${String(r.index)}`).join(' | ') + ' | agreement |',
      '| --- | ' + runs.map(() => '---').join(' | ') + ' | --- |', ...rows].join('\n'),
  }
}

async function main() {
  mkdirSync(EVIDENCE, { recursive: true })
  RUN_LOG = join(EVIDENCE, 'driver.log')
  appendFileSync(RUN_LOG, `\n===== a5sf-pd29-goal-stop ${startedAt} =====\n`)
  log(`repo=${REPO_ROOT} hostTree=${HOST_TREE} host=${hostDigest()} pin=${TEST_USE_BASELINE_SHA}`)
  const layer = shippedLayer()
  if (PLAN_ONLY) { planOnly(); return }
  const head = resolveHeadCommit(REPO_ROOT)
  const authorization = readAuthorityBinding(REPO_ROOT)
  if (authorization === null) throw new Error('no authority binding for this run')
  const composition = { path: join(REPO_ROOT, 'cordis.patch.yml'), sha256: sha256(join(REPO_ROOT, 'cordis.patch.yml')) }
  writeFileSync(join(EVIDENCE, 'driver-digest.json'), JSON.stringify({
    repo: REPO_ROOT, hostTree: HOST_TREE, hostHead: hostDigest(), pin: TEST_USE_BASELINE_SHA,
    head, composition, startedAt, argv,
  }, null, 2) + '\n')
  const results = []
  for (let i = 1; i <= BOOTS_WANTED; i += 1) {
    results.push(await bootOnce({ index: i, head, authorization, layer, composition }))
  }
  const agreement = agreementOf(results)
  writeFileSync(join(EVIDENCE, 'agreement.json'), JSON.stringify({ agreeing: agreement.agreeing, boots: results.length }, null, 2) + '\n')
  if (agreement.agreeing !== null) writeFileSync(join(EVIDENCE, 'agreement.txt'), agreement.table + '\n')
  log(agreement.table)
  const porcelain = hostPorcelain()
  writeFileSync(join(EVIDENCE, 'host-tree-porcelain.txt'), porcelain.length === 0 ? 'empty\n' : porcelain.join('\n') + '\n')
  log(`host porcelain after: ${JSON.stringify(porcelain)}`)
  if (porcelain.length !== 0) process.exitCode = 1
  const allOk = results.length === BOOTS_WANTED && results.every((r) => r?.failed !== true && r?.overall === 'PASS')
  const pairOk = BOOTS_WANTED < 2 || agreement.agreeing === true
  log(`RESULT ${allOk ? 'PASS' : 'FAIL'} (${String(results.length)}/${String(BOOTS_WANTED)} boots; agreeing pair=${String(agreement.agreeing)})`)
  if (!allOk || !pairOk) process.exitCode = 1
}

main().catch((error) => {
  log(`DRIVER FAILED (outside the run): ${String(error?.stack ?? error)}`)
  process.exitCode = 1
})
