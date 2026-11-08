#!/usr/bin/env node
/**
 * tests/world-factory/drivers/a5sf-pd26-confined-skill/run-boot.mjs — the LIVE
 * driver for PD-26: can a governed Member read SKILL BODIES and declare
 * DELIVERABLES today, and at which layer is the line?
 *
 * THE TWO ROWS UNDER MEASUREMENT (both fail-closed by earlier lanes):
 *   `skill`    PD-23 measured the preset's `skill-filesystem` provider returning
 *              an out-of-lane `SKILL.md` body through the BASE `fs` with ZERO
 *              `a5sf-guard-consult/1` facts (that body then sat in seven
 *              subsequent model requests), and removed the rows: the opt-in
 *              governed preset offered NO SKILLS AT ALL.
 *   `present`  PD-24 measured `lstat`/`stat` on the BASE `fs`: a REAL
 *              out-of-lane file was ACCEPTED and recorded with two
 *              `deliverables/presented` events, a missing one was refused
 *              `file not found` (a cross-lane existence oracle), all with ZERO
 *              guard facts; the row was removed.
 *
 * PD-26 restores both NAMES on the preset and routes the READS through the
 * Member's CONFINED `fs` face by re-mounting two Team modules INSIDE the
 * Member's isolated scope (`attachA5sfNativeToolModules`). This driver measures
 * the result in ONE real delegated Member turn against the REAL Host, the
 * shipped opt-in governed preset, and the shipped route-C attach:
 *
 *   POSITIVE  in-lane `skill` returns the declared body; in-lane `present`
 *             presents the file and appends ONE `deliverables/presented` event;
 *   NEGATIVE  out-of-lane `skill` is a typed `IO_READ_DENIED` with ZERO body
 *             bytes and EXACTLY ONE deny fact; out-of-lane `present` is the same
 *             typed refusal with NO event and no `file not found` oracle;
 *   CONTROLS  `bash`/`read`/`grep` still execute on the confined lane and still
 *             produce allow facts; the names earlier lanes closed stay typed
 *             `unknown tool`.
 *
 * ONE COMMAND, TWO BOOTS (the agreeing pair), per arm:
 *
 *   node tests/world-factory/drivers/a5sf-pd26-confined-skill/run-boot.mjs
 *   node tests/world-factory/drivers/a5sf-pd26-confined-skill/run-boot.mjs --arm prefix
 *
 * `--arm prefix` boots the RECORDED pre-fix composition
 * (`A5SF_PD26_COMPOSITION`, the lane's base commit's `cordis.patch.yml`), so
 * "before" is measured on the same Host: both names are the router's typed
 * `unknown tool` and produce zero facts.
 *
 * `--plan` is host-free (row/blueprint/preset validation, zero boots).
 * `--boots 1` is a development iteration.
 *
 * WHAT IS FIXTURE (disclosed): the model is the shared scripted mock
 * (`packages/tools/harness/mock-deepseek.mjs`); the skill files, the in-lane
 * deliverable and the out-of-lane secret are World files. The product path is
 * real: the shipped `cordis.patch.yml` rows, the realm provider/compiler, the
 * confined `fs` provider + guard sink, the route-C attach, the two Team modules,
 * the host `present` package and the host router are the shipped modules.
 *
 * Boot evidence is NEVER merge evidence: record class `DEV-LIVE`,
 * `candidateClaimEligibility` false by construction.
 *
 * CORE PATCH BUDGET = 0. No upstream tree is touched.
 *
 * @module tests/world-factory/drivers/a5sf-pd26-confined-skill/run-boot
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
const EVIDENCE = join(REPO_ROOT, 'dev', 'agent-workflow', 'evidence', 'a5sf-pd26-confined-skill')
const RUNS_POSTFIX = join(EVIDENCE, 'runs')
const RUNS_PREFIX = join(EVIDENCE, 'archive', 'pair-prefix')
const LEDGER_PATH = join(EVIDENCE, 'run-ledger.jsonl')

const LINE = 'u5a5sfpd26'
const BOOT_ROOT = 'session-a5sf-pd26-boot'
const ACCEPTANCE_ROOT = 'session-a5sf-pd26-team'
const BP_ANCHOR_ID = 'team.a5sf.pd26.anchor'
const BP_MAIN_ID = 'team.a5sf.pd26.main'
const PRESET_ID = 'a5sf-governed-member'

const MK_DISC = 'A5SF_PD26_DISC'
const MK_L1 = 'A5SF_PD26_L1_DRIVE'
const TOK_A = 'a5sf-pd26-turn'
const CALL_DELEGATE_A = 'call-a5sfpd26-delegate-a'
const CALL_BASH = 'call-a5sfpd26-bash'
const CALL_READ = 'call-a5sfpd26-read'
const CALL_GREP = 'call-a5sfpd26-grep'
const CALL_SKILL_IN = 'call-a5sfpd26-skill-in'
const CALL_SKILL_OUT = 'call-a5sfpd26-skill-out'
const CALL_SKILL_UNKNOWN = 'call-a5sfpd26-skill-unknown'
const CALL_PRESENT_IN = 'call-a5sfpd26-present-in'
const CALL_PRESENT_OUT = 'call-a5sfpd26-present-out'
const CALL_PRESENT_MISSING = 'call-a5sfpd26-present-missing'
const DONE_A = 'A5SF_PD26_MEMBER_A_DONE'
const DONE_L1 = 'A5SF_PD26_L1_DONE'

const IN_LANE_FILE = 'in-lane.txt'
const IN_LANE_TEXT = 'A5SF_PD26_IN_LANE_BYTES'
const SECRET_FILE = 'secret-out-of-lane.txt'
const SECRET_TEXT = 'A5SF_PD26_OUT_OF_LANE_SECRET'
const MISSING_OUT_OF_LANE = 'does-not-exist-out-of-lane.txt'
const SKILL_IN_NAME = 'pd26-in-lane-skill'
const SKILL_OUT_NAME = 'pd26-out-of-lane-skill'
const SKILL_IN_BODY = 'A5SF_PD26_SKILL_BODY_IN_LANE'
const SKILL_OUT_BODY = 'A5SF_PD26_SKILL_BODY_OUT_OF_LANE_SECRET'
const SKILL_UNKNOWN_NAME = 'pd26-no-such-skill'
/** The names earlier lanes closed; both arms must keep them typed `unknown tool`. */
const EARLIER_CLOSED = Object.freeze([
  'interrupt_agent', 'list_agents', 'pwsh', 'send_message', 'subagent', 'subagent_fork',
  'web_fetch', 'web_search', 'workflow',
])

const SELECTED_CASES = Object.freeze([
  'pd26:skill-confined',
  'pd26:present-confined',
  'pd26:fs-controls',
  'pd26:fail-closed-typed',
  'pd26:surface-restored',
  'pd26:no-out-of-lane-bytes',
])

const argv = process.argv.slice(2)
const PLAN_ONLY = argv.includes('--plan')
const ARM = (() => {
  const i = argv.indexOf('--arm')
  if (i === -1) return 'postfix'
  const value = argv[i + 1]
  if (value !== 'postfix' && value !== 'prefix') throw new Error(`--arm must be 'postfix' or 'prefix' (got ${String(value)})`)
  return value
})()
const RUNS = ARM === 'prefix' ? RUNS_PREFIX : RUNS_POSTFIX
const COMPOSITION_PATH = process.env.A5SF_PD26_COMPOSITION === undefined || process.env.A5SF_PD26_COMPOSITION === ''
  ? join(REPO_ROOT, 'cordis.patch.yml')
  : resolve(process.env.A5SF_PD26_COMPOSITION)
const BOOTS_WANTED = (() => {
  const i = argv.indexOf('--boots')
  if (i === -1) return 2
  const n = Number(argv[i + 1])
  if (!Number.isInteger(n) || n < 1 || n > 2) throw new Error(`--boots must be 1 or 2 (got ${String(argv[i + 1])})`)
  return n
})()

const startedAt = new Date().toISOString()
let RUN_LOG = join(EVIDENCE, 'driver.log')
function log(line) {
  const text = `[${new Date().toISOString()}] ${line}`
  // eslint-disable-next-line no-console
  console.log(text)
  try { appendFileSync(RUN_LOG, `${text}\n`) } catch { /* evidence is best effort; stdout is not */ }
}
const sha256 = (p) => createHash('sha256').update(readFileSync(p)).digest('hex')
const parseJsonl = (p) => {
  try { return readFileSync(p, 'utf8').split('\n').filter((l) => l.trim() !== '').map((l) => JSON.parse(l)) } catch { return [] }
}
const redact = (t) => String(t ?? '').replace(/\?token=[A-Za-z0-9_-]+/gu, '?token=<redacted>')
const utcStamp = () => new Date().toISOString().replace(/[:.]/gu, '-')

function hostTreePath() {
  const candidates = [process.env.A5SF_PD26_HOST_TREE, join(REPO_ROOT, 'tests', 'deepseek-harness-test-use')]
  const m = /^(.*)\/\.worktrees\/[^/]+$/u.exec(REPO_ROOT)
  if (m !== null) candidates.push(join(m[1], 'tests', 'deepseek-harness-test-use'))
  for (const candidate of candidates) {
    if (candidate !== undefined && candidate !== null && candidate !== '' && existsSync(candidate)) return candidate
  }
  throw new Error('the pinned host tree is not resolvable (set A5SF_PD26_HOST_TREE): a live boot needs it')
}
const HOST_TREE = hostTreePath()
const require_ = createRequire(join(REPO_ROOT, 'package.json'))

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
    leader: { templateId: 'leader', persona: `You lead the a5sf PD-26 anchor team. ${MK_DISC} is the discovery marker.` },
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
 * ONE governed Member. Its read/write lane is the World workspace ONLY: the
 * in-lane deliverable and the in-lane `SKILL.md` live under it, while the
 * out-of-lane secret and the out-of-lane `SKILL.md` live beside the workspace
 * (above the lane) and exist on disk, so a BASE-fs read would succeed.
 */
function mainBlueprintYaml({ workspace }) {
  const doc = {
    schemaVersion: 4,
    blueprintId: BP_MAIN_ID,
    revision: '1',
    leader: {
      templateId: 'leader',
      persona: `You lead the a5sf PD-26 confined-skill team. ${MK_L1} drives your chain: delegate the governed Member once (sync), then finish.`,
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

function composedRows({ home, anchorYaml, layer, skillInPath, skillOutPath }) {
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
    // PD-26: the DECLARED catalog. Two entries, same tool, one lane: the
    // in-lane path is admitted, the out-of-lane path must be refused AT THE
    // READ by the Member's compiled lane (the declaration authorizes nothing).
    a5sfSkillCatalog: [
      { name: SKILL_IN_NAME, description: 'in-lane fixture skill', path: skillInPath },
      { name: SKILL_OUT_NAME, description: 'out-of-lane fixture skill', path: skillOutPath },
    ],
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
async function remoteCallLong(fetchJson, origin, cookie, method, params, tag = 'a5sfpd26', timeoutMs = 300_000) {
  const rpcId = `${tag}-${Math.random().toString(36).slice(2, 12)}`
  return fetchJson(`${origin}/team-remote/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', cookie },
    body: JSON.stringify({ type: 'client-request', rpcId, method, payload: { version: 1, params } }),
  }, timeoutMs)
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
  return /A5SF_PD26_LEADER_JOB=([A-Za-z0-9:_-]+)/u.exec(text)?.[1] ?? null
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
 * The scripted model. Two branches, selected STRUCTURALLY: the Member's turn by
 * the token in its delegated `[team-work …]` envelope, the Leader's by its
 * marker. Every probe runs in the ONE Member turn; a probe that ended the turn
 * early would hide the rest, which is also how "the turn kept going" is
 * witnessed.
 */
function makeDecide({ workspaceDir }) {
  const call = (id, name, args) => ({ kind: 'tool-call', toolCalls: [{ id, name, arguments: args }] })
  return function decide({ req }) {
    const allText = messagesOf(req).map(textOf).join('\n')
    const lastUser = lastUserTextOfStatic(req)
    if (allText.includes('Generate the session title')) return { kind: 'text', content: 'a5sf pd26 session' }

    if (isARequest(req)) {
      const seen = resultIdsOf(req)
      // Positive controls first: the confined faces must stay live.
      if (!seen.has(CALL_BASH)) return call(CALL_BASH, 'bash', { command: `cat '${join(workspaceDir, IN_LANE_FILE)}'`, description: 'Read the in-lane fixture', workdir: workspaceDir })
      if (!seen.has(CALL_READ)) return call(CALL_READ, 'read', { file_path: join(workspaceDir, IN_LANE_FILE) })
      if (!seen.has(CALL_GREP)) return call(CALL_GREP, 'grep', { pattern: IN_LANE_TEXT, path: workspaceDir, include: '*.txt' })
      // ── the SKILL arm: in-lane body, out-of-lane body, unknown name ──────
      if (!seen.has(CALL_SKILL_IN)) return call(CALL_SKILL_IN, 'skill', { name: SKILL_IN_NAME })
      if (!seen.has(CALL_SKILL_OUT)) return call(CALL_SKILL_OUT, 'skill', { name: SKILL_OUT_NAME })
      if (!seen.has(CALL_SKILL_UNKNOWN)) return call(CALL_SKILL_UNKNOWN, 'skill', { name: SKILL_UNKNOWN_NAME })
      // ── the PRESENT arm: in-lane, out-of-lane EXISTING, out-of-lane MISSING ─
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
      // ── every earlier FAIL-CLOSED name: typed `unknown tool`, nothing runs ─
      for (const name of EARLIER_CLOSED) {
        const id = `call-a5sfpd26-closed-${name}`
        if (!seen.has(id)) return call(id, name, {})
      }
      return { kind: 'text', content: `${DONE_A} ${lastToolResultText(req).slice(0, 300)}` }
    }

    if (lastUser.includes(MK_DISC)) return { kind: 'text', content: 'A5SF_PD26_DISC_DONE' }
    const isLeader = lastUser.includes(MK_L1) || allText.includes(MK_L1)
    if (isLeader) {
      const seen = resultIdsOf(req)
      if (!seen.has(CALL_DELEGATE_A)) {
        return call(CALL_DELEGATE_A, 'team_delegate', {
          rootSessionId: ACCEPTANCE_ROOT,
          requestToken: `${TOK_A}-delegate`,
          delegationTemplateId: 'worker',
          label: 'a5sfpd26-worker-a',
          workspace: workspaceDir,
          prompt: `${TOK_A}: run the probes exactly once each, one tool call at a time, then report.`,
        })
      }
      return { kind: 'text', content: DONE_L1 }
    }
    return { kind: 'text', content: 'A5SF_PD26_NOOP' }
  }
}
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


// ─────────────────────────────────────────────────────────────────────────────
// judges
// ─────────────────────────────────────────────────────────────────────────────
// `resultText` / `isErrorResult` / `typedUnknown` come from the verdict block above.

/**
 * The two ways `skill` can be WRONG, each named:
 *   - the body bytes reach the model from outside the lane (base-fs read), or
 *   - the refusal is not typed / leaves no fact (silent absence).
 * The post-fix line must be: in-lane body + ONE allow fact; out-of-lane
 * `IO_READ_DENIED` + ZERO body bytes + ONE deny fact. The pre-fix line (no row
 * at all) must be: BOTH names typed `unknown tool` with zero facts.
 */
function judgeSkill({ expect, skillIn, skillOut, skillUnknown, factsFor, transcriptA }) {
  const inFacts = factsFor(CALL_SKILL_IN)
  const outFacts = factsFor(CALL_SKILL_OUT)
  const unknownFacts = factsFor(CALL_SKILL_UNKNOWN)
  const inText = resultText(skillIn)
  const outText = resultText(skillOut)
  if (expect === 'prefix') {
    return verdictOf(
      'PRE-FIX (defect): the governed preset offers NO `skill` row, so both loads are the host router\'s typed `unknown tool "skill"` and no body is read at all — the capability is fail-closed, not confined',
      [
        { id: 'in-lane-typed-refusal', ok: typedUnknown(skillIn, 'skill'), detail: `isError=${String(isErrorResult(skillIn))} text=${inText.slice(0, 160)}` },
        { id: 'out-of-lane-typed-refusal', ok: typedUnknown(skillOut, 'skill'), detail: `isError=${String(isErrorResult(skillOut))} text=${outText.slice(0, 160)}` },
        { id: 'zero-facts', ok: inFacts.length + outFacts.length === 0, detail: `skill-sourced facts=${String(inFacts.length + outFacts.length)}` },
        { id: 'zero-out-of-lane-bytes', ok: outText.includes(SKILL_OUT_BODY) === false && inText.includes(SKILL_OUT_BODY) === false, detail: 'no result carries the out-of-lane body' },
      ],
    )
  }
  return verdictOf(
    'a governed Member CAN load a declared skill body through its CONFINED `fs` face: the in-lane body returns with exactly ONE allow fact; the out-of-lane body is a typed `IO_READ_DENIED` with ZERO body bytes and exactly ONE deny fact; an undeclared name is a typed name refusal that reads nothing',
    [
      { id: 'in-lane-body-returned', ok: isErrorResult(skillIn) === false && inText.includes(SKILL_IN_BODY), detail: `isError=${String(isErrorResult(skillIn))} text=${inText.slice(0, 200)}` },
      { id: 'in-lane-one-allow-fact', ok: inFacts.length === 1 && inFacts[0]?.decision === 'allow' && inFacts[0]?.method === 'readText', detail: `facts=${JSON.stringify(inFacts.map((f) => [f.method, f.decision, f.decidedBy]))}` },
      { id: 'in-lane-attributed-to-skill', ok: inFacts.every((f) => String(f.tool ?? '') === 'skill' && String(f.callId ?? '') === CALL_SKILL_IN), detail: `tools=${JSON.stringify(inFacts.map((f) => [f.tool, f.callId]))}` },
      { id: 'out-of-lane-typed-refusal', ok: isErrorResult(skillOut) && /IO_READ_DENIED/u.test(outText), detail: `isError=${String(isErrorResult(skillOut))} text=${outText.slice(0, 200)}` },
      { id: 'out-of-lane-zero-bytes', ok: outText.includes(SKILL_OUT_BODY) === false, detail: 'the refusal carries no body bytes' },
      { id: 'out-of-lane-one-deny-fact', ok: outFacts.length === 1 && outFacts[0]?.decision === 'deny' && String(outFacts[0]?.decidedBy ?? '') === 'IO_READ_DENIED', detail: `facts=${JSON.stringify(outFacts.map((f) => [f.method, f.decision, f.decidedBy]))}` },
      { id: 'out-of-lane-attributed-to-skill', ok: outFacts.every((f) => String(f.tool ?? '') === 'skill' && String(f.callId ?? '') === CALL_SKILL_OUT), detail: `tools=${JSON.stringify(outFacts.map((f) => [f.tool, f.callId]))}` },
      { id: 'unknown-name-is-not-a-read', ok: isErrorResult(skillUnknown) && /unknown or no longer available/u.test(resultText(skillUnknown)) && unknownFacts.length === 0, detail: `isError=${String(isErrorResult(skillUnknown))} facts=${String(unknownFacts.length)} text=${resultText(skillUnknown).slice(0, 160)}` },
      { id: 'turn-kept-going', ok: Number(transcriptA?.eventTypes?.['turn/end'] ?? 0) >= 1, detail: 'the Member turn settled after the probes' },
    ],
  )
}

function judgePresent({ expect, presentIn, presentOut, presentMissing, factsFor, transcriptA }) {
  const inFacts = factsFor(CALL_PRESENT_IN)
  const outFacts = factsFor(CALL_PRESENT_OUT)
  const missingFacts = factsFor(CALL_PRESENT_MISSING)
  const outText = resultText(presentOut)
  const inText = resultText(presentIn)
  const delivered = Number(transcriptA?.eventTypes?.['deliverables/presented'] ?? 0)
  if (expect === 'prefix') {
    return verdictOf(
      'PRE-FIX (defect): the governed preset offers NO `present` row; all three calls are typed `unknown tool "present"`, no deliverables event is appended and no guard fact exists — the capability is fail-closed, not confined',
      [
        { id: 'in-lane-typed-refusal', ok: typedUnknown(presentIn, 'present'), detail: `text=${inText.slice(0, 160)}` },
        { id: 'out-of-lane-typed-refusal', ok: typedUnknown(presentOut, 'present'), detail: `text=${outText.slice(0, 160)}` },
        { id: 'missing-typed-refusal', ok: typedUnknown(presentMissing, 'present'), detail: `text=${resultText(presentMissing).slice(0, 160)}` },
        { id: 'zero-facts', ok: inFacts.length + outFacts.length + missingFacts.length === 0, detail: `present-sourced facts=${String(inFacts.length + outFacts.length + missingFacts.length)}` },
        { id: 'no-deliverables-event', ok: delivered === 0, detail: `A session deliverables/presented events=${String(delivered)}` },
      ],
    )
  }
  return verdictOf(
    'a governed Member CAN declare an in-lane deliverable through its CONFINED `fs` face (file presented, ONE `deliverables/presented` event, guard facts), while an out-of-lane path — existing or absent — is a typed `IO_READ_DENIED` at the FIRST stat with NO event and no `file not found` existence oracle',
    [
      { id: 'in-lane-presented', ok: isErrorResult(presentIn) === false && inText.includes(IN_LANE_FILE), detail: `isError=${String(isErrorResult(presentIn))} text=${inText.slice(0, 200)}` },
      { id: 'in-lane-guard-facts', ok: inFacts.length >= 1 && inFacts.every((f) => f.decision === 'allow') && inFacts.some((f) => ['lstat', 'stat'].includes(String(f.method))), detail: `facts=${JSON.stringify(inFacts.map((f) => [f.method, f.decision]))}` },
      { id: 'in-lane-attributed-to-present', ok: inFacts.every((f) => String(f.tool ?? '') === 'present'), detail: `tools=${JSON.stringify(inFacts.map((f) => f.tool))}` },
      { id: 'in-lane-one-deliverables-event', ok: delivered === 1, detail: `A session deliverables/presented events=${String(delivered)}` },
      { id: 'out-of-lane-typed-refusal', ok: isErrorResult(presentOut) && /IO_READ_DENIED/u.test(outText), detail: `isError=${String(isErrorResult(presentOut))} text=${outText.slice(0, 240)}` },
      { id: 'out-of-lane-zero-bytes', ok: outText.includes(SECRET_TEXT) === false, detail: 'the refusal carries no out-of-lane bytes' },
      { id: 'out-of-lane-one-deny-fact', ok: outFacts.length === 1 && outFacts[0]?.decision === 'deny' && String(outFacts[0]?.decidedBy ?? '') === 'IO_READ_DENIED' && String(outFacts[0]?.method ?? '') === 'lstat', detail: `facts=${JSON.stringify(outFacts.map((f) => [f.method, f.decision, f.decidedBy]))}` },
      { id: 'missing-is-not-an-existence-oracle', ok: isErrorResult(presentMissing) && /IO_READ_DENIED/u.test(resultText(presentMissing)) && /not found/iu.test(resultText(presentMissing)) === false && missingFacts.length === 1, detail: `isError=${String(isErrorResult(presentMissing))} facts=${String(missingFacts.length)} text=${resultText(presentMissing).slice(0, 240)}` },
      { id: 'no-extra-deliverables-event', ok: delivered === 1, detail: 'a refused presentation must not append an event' },
    ],
  )
}

function judgeControls({ bash, read, grep, factsFor }) {
  return verdictOf(
    'the confined native faces are UNAFFECTED by the restoration: `bash`, `read` and `grep` still execute on the lane and each writes its own allow fact (so the facts above are not a global shutdown)',
    [
      { id: 'bash-ok', ok: isErrorResult(bash) === false && resultText(bash).includes(IN_LANE_TEXT), detail: `text=${resultText(bash).slice(0, 160)}` },
      { id: 'read-ok', ok: isErrorResult(read) === false && resultText(read).includes(IN_LANE_TEXT), detail: `text=${resultText(read).slice(0, 160)}` },
      { id: 'grep-ok', ok: isErrorResult(grep) === false && resultText(grep).includes(IN_LANE_TEXT), detail: `text=${resultText(grep).slice(0, 160)}` },
      { id: 'bash-fact', ok: factsFor(CALL_BASH).some((f) => f.decision === 'allow'), detail: `facts=${JSON.stringify(factsFor(CALL_BASH).map((f) => [f.method, f.decision]))}` },
      { id: 'read-fact', ok: factsFor(CALL_READ).some((f) => f.decision === 'allow' && String(f.method) === 'readText'), detail: `facts=${JSON.stringify(factsFor(CALL_READ).map((f) => [f.method, f.decision]))}` },
      { id: 'grep-fact', ok: factsFor(CALL_GREP).some((f) => f.decision === 'allow'), detail: `facts=${JSON.stringify(factsFor(CALL_GREP).map((f) => [f.method, f.decision]))}` },
    ],
  )
}

function judgeFailedClosed({ probes }) {
  const bad = EARLIER_CLOSED.filter((name) => typedUnknown(probes.closed[name], name) === false)
  return verdictOf(
    'every name an earlier lane fail-closed is STILL the host router\'s typed `unknown tool`, and none executed — the restoration is additive, not a reopening',
    [
      { id: 'all-typed-unknown', ok: bad.length === 0, detail: bad.length === 0 ? 'all typed unknown' : `not typed unknown: ${bad.join(',')}` },
    ],
  )
}

function judgeSurface({ surfaceNames, expect }) {
  const hasSkill = surfaceNames.includes('skill')
  const hasPresent = surfaceNames.includes('present')
  const hasProvider = surfaceNames.includes('skill-filesystem')
  if (expect === 'prefix') {
    return verdictOf(
      'PRE-FIX surface: neither `skill` nor `present` is offered to the Member (the fail-closed rows are gone)',
      [
        { id: 'skill-absent', ok: hasSkill === false, detail: 'skill absent' },
        { id: 'present-absent', ok: hasPresent === false, detail: 'present absent' },
      ],
    )
  }
  return verdictOf(
    'the Member surface offers `skill` and `present` (both restored) and still offers no base-fs skill provider row',
    [
      { id: 'skill-present', ok: hasSkill, detail: 'skill on the surface' },
      { id: 'present-present', ok: hasPresent, detail: 'present on the surface' },
      { id: 'no-base-fs-provider', ok: hasProvider === false, detail: 'skill-filesystem is not a Member tool' },
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
      { id: 'zero-requests-with-secret', ok: requestsCarryingSecret === 0, detail: `mock requests carrying an out-of-lane secret=${String(requestsCarryingSecret)}` },
      { id: 'zero-secret-skill-bytes', ok: aText.includes(SKILL_OUT_BODY) === false, detail: 'the Member\'s durable turn carries no out-of-lane skill body' },
      { id: 'zero-secret-file-bytes', ok: aText.includes(SECRET_TEXT) === false, detail: 'the Member\'s durable turn carries no out-of-lane file bytes' },
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
  const rows = composedRows({
    home: join(EVIDENCE, 'plan-home'),
    anchorYaml: anchor,
    layer,
    skillInPath: join(EVIDENCE, 'plan-workspace', 'skills', SKILL_IN_NAME, 'SKILL.md'),
    skillOutPath: join(EVIDENCE, 'plan-home', 'skills-out-of-lane', SKILL_OUT_NAME, 'SKILL.md'),
  })
  writeFileSync(join(EVIDENCE, 'plan-patch.yml'), emitPatchLayer(['a5sf-pd26-confined-skill plan (no World)'], rows) + '\n')
  log(`rows: ${JSON.stringify(rows.map((r) => ({ id: r.id, name: String(r.name).slice(0, 90) })))}`)
  const plugins = presetPluginIds(layer)
  log(`governed preset plugins (${String(plugins.length)}): ${plugins.join(',')}`)
  for (const required of ['tool-bash', 'tool-fs', 'tool-fs-search', 'tool-skill', 'tool-present']) {
    if (!plugins.includes(required)) throw new Error(`the shipped governed preset lost '${required}'`)
  }
  for (const forbidden of ['skill-filesystem', 'tool-pwsh', 'tool-subagent', 'tool-subagent-fork', 'tool-web', 'tool-workflow']) {
    if (plugins.includes(forbidden)) throw new Error(`the shipped governed preset unexpectedly carries '${forbidden}'`)
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
  const phase = `a5sf-pd26-confined-skill-${ARM}-boot${String(index)}`
  const runId = `a5sf-pd26-confined-skill-${ARM}-${utcStamp()}-b${String(index)}`
  const record = createRunRecord({
    runId, suite: 'a5sf-pd26-confined-skill', selectedCases: SELECTED_CASES,
    bindings: runBindings(head, authorization), ledgerPath: LEDGER_PATH, recordClass: 'DEV-LIVE',
  })
  const harness = createA5sfHarness({
    repoRoot: REPO_ROOT, evidenceRoot: join(EVIDENCE, 'driver'), suite: 'a5sf-pd26-confined-skill', line: LINE,
    runRecord: record, hostTree: HOST_TREE,
  })
  const factory = harness.factory
  log(`[boot${String(index)}] candidate: ${JSON.stringify(harness.assertCandidate())}`)
  const slot = acquireDevLiveSlot({
    leaseRoot: factory.leaseRoot,
    runId: String(record.record.runId),
    face: 'ConfinedSkill',
    world: LINE,
    headCommit: head,
  })
  log(`[boot${String(index)}] dev-live slot #${String(slot.slot)} face=ConfinedSkill world=${LINE} head=${head}`)

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
      writeFileSync(inLanePath, `${IN_LANE_TEXT}\n`, 'utf8')
      writeFileSync(join(outsideDir, SECRET_FILE), `${SECRET_TEXT}\n`, 'utf8')
      // The declared SKILL.md files: the in-lane one under the workspace (the
      // compiled lane), the out-of-lane one beside it, ABOVE the lane. Both
      // exist on disk, so a BASE-fs read would return the secret body — the
      // deny arm is about admission, not about absence.
      const skillInPath = join(workspace, 'skills', SKILL_IN_NAME, 'SKILL.md')
      const skillOutPath = join(world.home, 'skills-out-of-lane', SKILL_OUT_NAME, 'SKILL.md')
      mkdirSync(dirname(skillInPath), { recursive: true })
      mkdirSync(dirname(skillOutPath), { recursive: true })
      writeFileSync(skillInPath, `---\nname: ${SKILL_IN_NAME}\ndescription: in-lane fixture skill\n---\n${SKILL_IN_BODY}\n`, 'utf8')
      writeFileSync(skillOutPath, `---\nname: ${SKILL_OUT_NAME}\ndescription: out-of-lane fixture skill\n---\n${SKILL_OUT_BODY}\n`, 'utf8')
      writeFileSync(join(world.home, 'p6t6-directive.json'), JSON.stringify(p6t6Directive({ worldId: world.id, logDir: world.logDir }), null, 2) + '\n')

      const anchor = anchorBlueprintYaml()
      writeFileSync(join(world.home, 'blueprints', 'anchor.yaml'), anchor)
      const rows = composedRows({ home: world.home, anchorYaml: anchor, layer, skillInPath, skillOutPath })
      world.u6Fs.rows.push(...rows)
      log(`[boot${String(index)}] rows: ${rows.map((r) => r.id).join(',')}`)

      await world.startMock({ decide: makeDecide({ workspaceDir: workspace }) })
      log(`[boot${String(index)}] mock on ${String(world.mock?.port)}`)
      return await harness.boot({ world, phase, bootTimeoutMs: 300_000 })
    })()
    abortStage = 'composition'
    paths = {
      workspace: world.workspaceDir,
      inLane: join(world.workspaceDir, IN_LANE_FILE),
      secret: join(world.home, 'out-of-lane', SECRET_FILE),
      skillIn: join(world.workspaceDir, 'skills', SKILL_IN_NAME, 'SKILL.md'),
      skillOut: join(world.home, 'skills-out-of-lane', SKILL_OUT_NAME, 'SKILL.md'),
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

    const memberWindowFrom = new Date().toISOString()

    // ── discovery turn: the REAL surface the preset offers ─────────────────
    abortStage = 'discovery'
    await apiPrompt(origin, cookie, BOOT_ROOT, MK_DISC, 'a5sfpd26')
    await waitFor(() => (world.mock?.requests ?? []).some((r) => String(r.reply?.content ?? '').startsWith('A5SF_PD26_DISC_DONE')), 60_000)
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
      try { out.hostLogTail = redact(readFileSync(bootInfo.logPath, 'utf8').split('\n').slice(-120).join('\n')) } catch { out.hostLogTail = '<absent>' }
      try { out.guardFacts = parseJsonl(paths.sink) } catch { out.guardFacts = [] }
      out.counters = { ...counters }
      writeFileSync(join(bootDir, `diagnostics-${label}.json`), JSON.stringify(out, null, 2) + '\n')
      try { writeFileSync(join(bootDir, `host-log-${label}.log`), out.hostLogTail + '\n') } catch { /* best effort */ }
      log(`[boot${String(index)}] diagnostics(${label}): mockRequests=${String(out.mockRequests.length)} guardFacts=${String(out.guardFacts.length)}`)
      return out
    }

    // ── team.create: one Leader turn delegates the governed Member ─────────
    abortStage = 'team-create'
    const created = await remoteCallLong(fetchJson, origin, cookie, 'team.create', {
      rootSessionId: ACCEPTANCE_ROOT, blueprintId: BP_MAIN_ID, initialWork: { prompt: MK_L1 },
    }, 'a5sfpd26')
    const createOk = created.status === 200 && created.body?.result?.ok === true
    log(`[boot${String(index)}] team.create status=${String(created.status)} ok=${String(createOk)} ${redact(JSON.stringify(created.body ?? null)).slice(0, 400)}`)
    if (!createOk) throw new Error(`team.create failed: status=${String(created.status)} body=${redact(JSON.stringify(created.body ?? null)).slice(0, 400)}`)

    const chainTimeoutMs = Number(process.env.A5SF_PD26_CHAIN_TIMEOUT_MS ?? 420_000)
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
    await new Promise((r) => setTimeout(r, 1200))
    // The Member turn must be SETTLED before the transcript is read.
    const quiesced = await (async () => {
      const t0 = Date.now()
      for (;;) {
        const n = (world.mock?.requests ?? []).length
        await new Promise((r) => setTimeout(r, 2000))
        if ((world.mock?.requests ?? []).length === n) return true
        if (Date.now() - t0 > 120_000) return false
      }
    })()
    log(`[boot${String(index)}] mock quiesced=${String(quiesced)}`)
    abortStage = 'evidence-collection'

    const requests = world.mock?.requests ?? []
    const callOf = (id) => toolCallFor(requests, id)
    const resultOf = (id) => toolResultFor(requests, id)
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
    } else {
      log(`[boot${String(index)}] MEMBER TRANSCRIPT MISSING for ${String(sessionA)}`)
    }

    const ownA = (id) => transcriptA?.calls.find((c) => String(c.callId) === String(id)) ?? null
    const probe = (id) => ({ call: callOf(id), result: ownA(id)?.result ?? resultOf(id) ?? null })
    const probes = {
      bash: probe(CALL_BASH),
      read: probe(CALL_READ),
      grep: probe(CALL_GREP),
      skillIn: probe(CALL_SKILL_IN),
      skillOut: probe(CALL_SKILL_OUT),
      skillUnknown: probe(CALL_SKILL_UNKNOWN),
      presentIn: probe(CALL_PRESENT_IN),
      presentOut: probe(CALL_PRESENT_OUT),
      presentMissing: probe(CALL_PRESENT_MISSING),
      closed: Object.fromEntries(EARLIER_CLOSED.map((n) => [n, probe(`call-a5sfpd26-closed-${n}`)])),
    }
    writeFileSync(join(bootDir, 'member-probes.json'), JSON.stringify({
      schema: 'a5sf-pd26-confined-skill/member-probes/1',
      at: new Date().toISOString(),
      note: 'every Member surface call and the result the Member actually received (durable session first, mock transcript fallback)',
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
    const factsFor = (callId) => factsAll.filter((f) => String(f?.callId ?? '') === String(callId))
    const factTools = {}
    for (const f of factsAll) factTools[String(f?.tool ?? '<none>')] = (factTools[String(f?.tool ?? '<none>')] ?? 0) + 1
    const skillFacts = factsAll.filter((f) => String(f?.tool ?? '') === 'skill')
    const presentFacts = factsAll.filter((f) => String(f?.tool ?? '') === 'present')

    counters.guardFacts = {
      allow: factsAll.filter((f) => f.decision === 'allow').length,
      deny: factsAll.filter((f) => f.decision === 'deny').length,
      byTool: factTools,
      skill: {
        total: skillFacts.length,
        allow: skillFacts.filter((f) => f.decision === 'allow').length,
        deny: skillFacts.filter((f) => f.decision === 'deny').length,
        denyCodes: skillFacts.filter((f) => f.decision === 'deny').map((f) => String(f.decidedBy)),
      },
      present: {
        total: presentFacts.length,
        allow: presentFacts.filter((f) => f.decision === 'allow').length,
        deny: presentFacts.filter((f) => f.decision === 'deny').length,
        denyCodes: presentFacts.filter((f) => f.decision === 'deny').map((f) => String(f.decidedBy)),
      },
    }
    counters.mockRequests = requests.length
    counters.aModelRequests = requests.filter((r) => isARequest(r) && surfaceNamesOf(r).length > 0).length
    counters.surfaceACount = surfaceANames.length
    counters.surfaceANames = surfaceANames
    // Any out-of-lane marker in ANY request body is a leak, whichever arm.
    counters.skillOutBodyInRequests = requests.filter((r) => JSON.stringify(r.body ?? r).includes(SKILL_OUT_BODY)).length
    counters.secretTextInRequests = requests.filter((r) => JSON.stringify(r.body ?? r).includes(SECRET_TEXT)).length
    counters.requestsCarryingSecret = counters.skillOutBodyInRequests + counters.secretTextInRequests
    counters.sessionEvents = scanSessionEventTypes(world.home)
    counters.deliverablesEvents = Number(transcriptA?.eventTypes?.['deliverables/presented'] ?? 0)
    counters.membersAfter = members.length
    counters.memberTemplates = members.map((m) => String(m?.templateId ?? '')).sort()
    counters.memberWindow = { from: memberWindowFrom, to: memberWindowTo }
    counters.composition = { path: composition.path, sha256: composition.sha256, arm: ARM }
    counters.quiesced = quiesced
    counters.skillOnSurface = surfaceANames.includes('skill')
    counters.presentOnSurface = surfaceANames.includes('present')
    writeFileSync(join(bootDir, 'counters.json'), JSON.stringify(counters, null, 2) + '\n')

    // ── judges ─────────────────────────────────────────────────────────────
    const verdicts = {
      skill: judgeSkill({ expect: ARM, skillIn: probes.skillIn, skillOut: probes.skillOut, skillUnknown: probes.skillUnknown, factsFor, transcriptA }),
      present: judgePresent({ expect: ARM, presentIn: probes.presentIn, presentOut: probes.presentOut, presentMissing: probes.presentMissing, factsFor, transcriptA }),
      controls: judgeControls({ bash: probes.bash, read: probes.read, grep: probes.grep, factsFor }),
      failClosed: judgeFailedClosed({ probes }),
      surface: judgeSurface({ surfaceNames: surfaceANames, expect: ARM }),
      bytes: judgeNoLaneBytes({ requestsCarryingSecret: counters.requestsCarryingSecret, transcriptA }),
    }
    const add = (id, verdict, detail) => {
      const { verdict: _ignored, ...rest } = detail ?? {}
      const runVerdict = toRunVerdict(verdict)
      record.addCase(id, runVerdict, rest)
      log(`[boot${String(index)}] case ${id}: ${runVerdict}${verdict === 'PROVEN' ? '' : ` failed=${JSON.stringify(detail?.failed ?? [])}`}`)
    }
    add('pd26:skill-confined', verdicts.skill.verdict, verdicts.skill)
    add('pd26:present-confined', verdicts.present.verdict, verdicts.present)
    add('pd26:fs-controls', verdicts.controls.verdict, verdicts.controls)
    add('pd26:fail-closed-typed', verdicts.failClosed.verdict, verdicts.failClosed)
    add('pd26:surface-restored', verdicts.surface.verdict, verdicts.surface)
    add('pd26:no-out-of-lane-bytes', verdicts.bytes.verdict, verdicts.bytes)

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
    skillVerdict: r?.verdicts?.skill?.verdict ?? null,
    presentVerdict: r?.verdicts?.present?.verdict ?? null,
    controlsVerdict: r?.verdicts?.controls?.verdict ?? null,
    failClosedVerdict: r?.verdicts?.failClosed?.verdict ?? null,
    surfaceVerdict: r?.verdicts?.surface?.verdict ?? null,
    bytesVerdict: r?.verdicts?.bytes?.verdict ?? null,
    surfaceACount: r?.counters?.surfaceACount ?? null,
    skillOnSurface: r?.counters?.skillOnSurface ?? null,
    presentOnSurface: r?.counters?.presentOnSurface ?? null,
    skillFacts: JSON.stringify(r?.counters?.guardFacts?.skill ?? null),
    presentFacts: JSON.stringify(r?.counters?.guardFacts?.present ?? null),
    guardAllow: r?.counters?.guardFacts?.allow ?? null,
    guardDeny: r?.counters?.guardFacts?.deny ?? null,
    factTools: JSON.stringify(r?.counters?.guardFacts?.byTool ?? null),
    deliverablesEvents: r?.counters?.deliverablesEvents ?? null,
    requestsCarryingSecret: r?.counters?.requestsCarryingSecret ?? null,
    skillOutBodyInRequests: r?.counters?.skillOutBodyInRequests ?? null,
    aModelRequests: r?.counters?.aModelRequests ?? null,
  })
  const rows = ok.map((r) => ({ boot: r.boot, ...pick(r) }))
  const keys = Object.keys(pick({}))
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
  return { schema: 'a5sf-pd26-confined-skill/agreement/1', arm: ARM, at: new Date().toISOString(), boots: results.length, agreeing, differing, rows, table }
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
    scope: 'DEV-LIVE', face: 'ConfinedSkill', world: LINE,
    source: `task PD26-CONFINED-SKILL explicit boot authorisation (2026-11-14), arm=${ARM}`,
  }
  const archived = ARM === 'prefix' ? null : archivePriorRuns()
  log(`ARCHIVE: ${archived === null ? '(nothing to archive)' : archived}`)
  writeFileSync(join(EVIDENCE, `driver-digest-${ARM}.json`), JSON.stringify({
    at: startedAt, arm: ARM, head, hostTree: HOST_TREE, hostSha: hostDigest(), pin: TEST_USE_BASELINE_SHA,
    driverSha256: sha256(fileURLToPath(import.meta.url)), jsSubstitutions: layer.jsSubstitutions,
    composition, authorization,
    command: `node tests/world-factory/drivers/a5sf-pd26-confined-skill/run-boot.mjs --arm ${ARM}${BOOTS_WANTED === 2 ? '' : ` --boots ${String(BOOTS_WANTED)}`}`,
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
  writeFileSync(join(RUNS, 'agreement.json'), JSON.stringify(agreement, null, 2) + '\n')
  writeFileSync(join(RUNS, 'agreement.txt'), agreement.table + '\n')
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
